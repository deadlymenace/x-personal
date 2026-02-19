/**
 * Syncs bookmarks from X API into local SQLite database.
 */

import { getDb } from "../db/connection.js";
import { getValidToken, getUserInfo } from "./oauth.js";
import { applyAutoTags } from "./auto-tagger.js";
import type { SyncResult } from "../types/index.js";

const BOOKMARKS_FIELDS =
  "tweet.fields=created_at,public_metrics,author_id,conversation_id,entities&expansions=author_id&user.fields=username,name&max_results=100";

export async function syncBookmarks(
  opts: { fullSync?: boolean } = {}
): Promise<SyncResult> {
  const token = await getValidToken();
  const userInfo = getUserInfo();
  if (!userInfo) throw new Error("Not authenticated");

  const db = getDb();
  let newCount = 0;
  let updatedCount = 0;
  let paginationToken: string | undefined;

  // For incremental sync, get the last pagination token
  if (!opts.fullSync) {
    const state = db
      .prepare("SELECT last_pagination_token FROM sync_state WHERE id = 1")
      .get() as any;
    // We always do a full pass for bookmarks since the API returns newest first
  }

  const upsertStmt = db.prepare(`
    INSERT INTO bookmarks (
      id, text, author_id, author_username, author_name, tweet_url,
      created_at, conversation_id, likes, retweets, replies, quotes,
      impressions, bookmark_count, urls, mentions, hashtags,
      bookmarked_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      likes = excluded.likes,
      retweets = excluded.retweets,
      replies = excluded.replies,
      quotes = excluded.quotes,
      impressions = excluded.impressions,
      bookmark_count = excluded.bookmark_count,
      synced_at = datetime('now')
  `);

  do {
    const url = `https://api.x.com/2/users/${userInfo.user_id}/bookmarks?${BOOKMARKS_FIELDS}${paginationToken ? `&pagination_token=${paginationToken}` : ""}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const reset = res.headers.get("x-rate-limit-reset");
      const waitSec = reset
        ? Math.max(parseInt(reset) - Math.floor(Date.now() / 1000), 1)
        : 60;
      throw new Error(`Rate limited. Resets in ${waitSec}s`);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bookmarks API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as any;

    if (!data.data) break;

    // Build user map
    const users: Record<string, any> = {};
    for (const u of data.includes?.users || []) {
      users[u.id] = u;
    }

    for (const tweet of data.data) {
      const user = users[tweet.author_id] || {};
      const m = tweet.public_metrics || {};
      const urls = (tweet.entities?.urls || [])
        .map((u: any) => u.expanded_url)
        .filter(Boolean);
      const mentions = (tweet.entities?.mentions || [])
        .map((m: any) => m.username)
        .filter(Boolean);
      const hashtags = (tweet.entities?.hashtags || [])
        .map((h: any) => h.tag)
        .filter(Boolean);

      const username = user.username || "unknown";
      const tweetUrl = `https://x.com/${username}/status/${tweet.id}`;

      // Check if it already exists
      const existing = db
        .prepare("SELECT id FROM bookmarks WHERE id = ?")
        .get(tweet.id);

      upsertStmt.run(
        tweet.id,
        tweet.text,
        tweet.author_id,
        username,
        user.name || "Unknown",
        tweetUrl,
        tweet.created_at,
        tweet.conversation_id || null,
        m.like_count || 0,
        m.retweet_count || 0,
        m.reply_count || 0,
        m.quote_count || 0,
        m.impression_count || 0,
        m.bookmark_count || 0,
        JSON.stringify(urls),
        JSON.stringify(mentions),
        JSON.stringify(hashtags)
      );

      if (existing) {
        updatedCount++;
      } else {
        newCount++;
        // Apply auto-tag rules to new bookmarks
        applyAutoTags(tweet.id);
      }
    }

    paginationToken = data.meta?.next_token;

    // Rate limit safety
    if (paginationToken) {
      await new Promise((r) => setTimeout(r, 350));
    }
  } while (paginationToken);

  // Update sync state
  const totalSynced = (
    db.prepare("SELECT COUNT(*) as count FROM bookmarks").get() as any
  ).count;

  db.prepare(
    `UPDATE sync_state SET last_sync_at = datetime('now'), total_synced = ? WHERE id = 1`
  ).run(totalSynced);

  return { newCount, updatedCount, totalSynced };
}
