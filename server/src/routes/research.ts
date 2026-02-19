import { Router } from "express";
import * as api from "../lib/api.js";
import * as cache from "../lib/cache.js";
import { getDb } from "../db/connection.js";

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
