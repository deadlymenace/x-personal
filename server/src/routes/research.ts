import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import * as api from "../lib/api.js";
import * as cache from "../lib/cache.js";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";

export const researchRouter = Router();

// Search tweets
researchRouter.post("/search", async (req, res) => {
  try {
    const { query, sort, pages, since, minLikes, minImpressions, limit } =
      req.body;

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    // Check cache
    const cacheParams = JSON.stringify({ sort, pages, since });
    const cached = cache.get(query, cacheParams);
    if (cached) {
      let results = cached;
      if (sort && sort !== "recent") {
        results = api.sortBy(results, sort);
      }
      if (minLikes || minImpressions) {
        results = api.filterEngagement(results, { minLikes, minImpressions });
      }
      res.json({
        data: results.slice(0, limit || 30),
        total: results.length,
        cached: true,
        cost: "$0.00",
      });
      return;
    }

    let tweets = await api.search(query, {
      pages: pages || 1,
      sortOrder: sort === "recent" ? "recency" : "relevancy",
      since,
    });

    // Cache the raw results
    cache.set(query, cacheParams, tweets);

    // Post-process
    if (sort && sort !== "recent") {
      tweets = api.sortBy(tweets, sort);
    }
    if (minLikes || minImpressions) {
      tweets = api.filterEngagement(tweets, { minLikes, minImpressions });
    }

    tweets = api.dedupe(tweets);

    res.json({
      data: tweets.slice(0, limit || 30),
      total: tweets.length,
      cached: false,
      cost: `~$${(tweets.length * 0.005).toFixed(2)}`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Deep search: fetch tweets + stream AI analysis via SSE
researchRouter.post("/deep-search", async (req, res) => {
  const { query, sort, pages, since, minLikes, minImpressions, limit } =
    req.body;

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  if (!config.ANTHROPIC_API_KEY) {
    res.status(500).json({
      error: "ANTHROPIC_API_KEY not configured. Add it to your .env file.",
    });
    return;
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    // Phase 1: status
    res.write(
      `data: ${JSON.stringify({ type: "status", message: "Searching X..." })}\n\n`
    );

    // Fetch tweets (use cache if available)
    const cacheParams = JSON.stringify({ sort, pages, since });
    let tweets: api.Tweet[];
    let cached = false;

    const cachedTweets = cache.get(query, cacheParams);
    if (cachedTweets) {
      tweets = cachedTweets;
      cached = true;
    } else {
      tweets = await api.search(query, {
        pages: pages || 2,
        sortOrder: sort === "recent" ? "recency" : "relevancy",
        since,
      });
      cache.set(query, cacheParams, tweets);
    }

    // Post-process
    if (sort && sort !== "recent") {
      tweets = api.sortBy(tweets, sort as any);
    }
    if (minLikes || minImpressions) {
      tweets = api.filterEngagement(tweets, { minLikes, minImpressions });
    }
    tweets = api.dedupe(tweets);
    const finalTweets = tweets.slice(0, limit || 50);

    // Phase 2: send the tweets
    res.write(
      `data: ${JSON.stringify({
        type: "tweets",
        data: finalTweets,
        total: tweets.length,
        cached,
      })}\n\n`
    );

    if (finalTweets.length === 0) {
      res.write(
        `data: ${JSON.stringify({
          type: "analysis",
          content:
            "No tweets found for this query. Try broadening your search terms or time range.",
        })}\n\n`
      );
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
      return;
    }

    // Phase 3: AI analysis (streamed)
    res.write(
      `data: ${JSON.stringify({ type: "status", message: "Analyzing conversation..." })}\n\n`
    );

    const tweetSample = finalTweets.slice(0, 40);
    const tweetText = tweetSample
      .map(
        (t) =>
          `@${t.username} (${t.metrics.likes}L/${t.metrics.retweets}RT/${t.metrics.impressions}V): ${t.text.slice(0, 280)}`
      )
      .join("\n\n");

    const systemPrompt = `You are an expert social media analyst. You analyze tweets/posts from X (formerly Twitter) and provide insightful, concise research summaries. Write in a direct, analytical style. Use markdown formatting.`;

    const userPrompt = `The user searched for: "${query}"

Here are ${tweetSample.length} tweets from this search (out of ${tweets.length} total). Metrics shown as Likes/Retweets/Views:

${tweetText}

Provide a research briefing with these sections:

## Summary
2-3 sentences capturing the overall conversation.

## Key Themes
Bullet points of the main themes/narratives being discussed.

## Sentiment
Overall sentiment (bullish/bearish/mixed/neutral) with a brief explanation.

## Notable Voices
The most influential accounts speaking on this topic and what they're saying (based on engagement metrics).

## Key Takeaways
3-5 actionable insights or important points someone tracking this topic should know.`;

    const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(
          `data: ${JSON.stringify({ type: "analysis_chunk", content: event.delta.text })}\n\n`
        );
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err: any) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`
    );
  }

  res.end();
});

// Analyze existing tweets with a follow-up question
researchRouter.post("/analyze", async (req, res) => {
  const { tweets, question } = req.body;

  if (!tweets || !question) {
    res.status(400).json({ error: "tweets and question are required" });
    return;
  }

  if (!config.ANTHROPIC_API_KEY) {
    res.status(500).json({
      error: "ANTHROPIC_API_KEY not configured.",
    });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    const tweetText = tweets
      .slice(0, 40)
      .map(
        (t: any) =>
          `@${t.username} (${t.metrics?.likes || 0}L): ${(t.text || "").slice(0, 280)}`
      )
      .join("\n\n");

    const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system:
        "You are an expert social media analyst. Answer the user's follow-up question about these tweets. Be direct and insightful. Use markdown.",
      messages: [
        {
          role: "user",
          content: `Here are the tweets being discussed:\n\n${tweetText}\n\nQuestion: ${question}`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(
          `data: ${JSON.stringify({ type: "analysis_chunk", content: event.delta.text })}\n\n`
        );
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err: any) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`
    );
  }

  res.end();
});

// Get thread
researchRouter.get("/thread/:tweetId", async (req, res) => {
  try {
    const tweets = await api.thread(req.params.tweetId, {
      pages: parseInt(req.query.pages as string) || 2,
    });
    res.json({ data: tweets, total: tweets.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get profile
researchRouter.get("/profile/:username", async (req, res) => {
  try {
    const result = await api.profile(req.params.username, {
      count: parseInt(req.query.count as string) || 20,
      includeReplies: req.query.replies === "true",
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get single tweet
researchRouter.get("/tweet/:tweetId", async (req, res) => {
  try {
    const tweet = await api.getTweet(req.params.tweetId);
    if (!tweet) {
      res.status(404).json({ error: "Tweet not found" });
      return;
    }
    res.json(tweet);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Save research result as a bookmark
researchRouter.post("/bookmark/:tweetId", async (req, res) => {
  try {
    const tweet = await api.getTweet(req.params.tweetId);
    if (!tweet) {
      res.status(404).json({ error: "Tweet not found" });
      return;
    }

    const db = getDb();
    db.prepare(
      `INSERT INTO bookmarks (
        id, text, author_id, author_username, author_name, tweet_url,
        created_at, conversation_id, likes, retweets, replies, quotes,
        impressions, bookmark_count, urls, mentions, hashtags,
        bookmarked_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO NOTHING`
    ).run(
      tweet.id,
      tweet.text,
      tweet.author_id,
      tweet.username,
      tweet.name,
      tweet.tweet_url,
      tweet.created_at,
      tweet.conversation_id || null,
      tweet.metrics.likes,
      tweet.metrics.retweets,
      tweet.metrics.replies,
      tweet.metrics.quotes,
      tweet.metrics.impressions,
      tweet.metrics.bookmarks,
      JSON.stringify(tweet.urls),
      JSON.stringify(tweet.mentions),
      JSON.stringify(tweet.hashtags)
    );

    res.json({ success: true, bookmark: tweet });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Watchlist
researchRouter.get("/watchlist", (_req, res) => {
  const db = getDb();
  const watchlist = db
    .prepare("SELECT * FROM watchlist ORDER BY added_at DESC")
    .all();
  res.json(watchlist);
});

researchRouter.post("/watchlist", (req, res) => {
  const db = getDb();
  const { username, note } = req.body;
  if (!username) {
    res.status(400).json({ error: "username is required" });
    return;
  }

  try {
    const result = db
      .prepare("INSERT INTO watchlist (username, note) VALUES (?, ?)")
      .run(username.replace("@", ""), note || "");
    const entry = db
      .prepare("SELECT * FROM watchlist WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(entry);
  } catch (err: any) {
    if (err.message.includes("UNIQUE")) {
      res.status(409).json({ error: "Already watching this account" });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

researchRouter.delete("/watchlist/:username", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM watchlist WHERE username = ?").run(
    req.params.username
  );
  res.json({ success: true });
});

researchRouter.post("/watchlist/check", async (_req, res) => {
  try {
    const db = getDb();
    const accounts = db
      .prepare("SELECT * FROM watchlist")
      .all() as any[];

    const results = [];
    for (const account of accounts) {
      try {
        const { user, tweets } = await api.profile(account.username, {
          count: 5,
        });
        results.push({
          username: account.username,
          note: account.note,
          user,
          tweets: tweets.slice(0, 3),
        });
      } catch (err: any) {
        results.push({
          username: account.username,
          note: account.note,
          error: err.message,
          tweets: [],
        });
      }
    }

    res.json(results);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
