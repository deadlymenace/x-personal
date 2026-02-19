import { Router } from "express";
import { getDb } from "../db/connection.js";
import { syncBookmarks } from "../services/bookmark-sync.js";

export const bookmarksRouter = Router();

// List bookmarks with filtering, sorting, pagination
bookmarksRouter.get("/", (req, res) => {
  const db = getDb();
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const sort = (req.query.sort as string) || "bookmarked_at";
  const order = (req.query.order as string) === "asc" ? "ASC" : "DESC";
  const tag = req.query.tag as string;
  const category = req.query.category as string;
  const author = req.query.author as string;
  const pinned = req.query.pinned as string;
  const q = req.query.q as string;

  const allowedSorts = ["bookmarked_at", "created_at", "likes", "impressions", "retweets"];
  const sortCol = allowedSorts.includes(sort) ? sort : "bookmarked_at";

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (tag) {
    const tags = tag.split(",").map((t) => t.trim());
    where += ` AND b.id IN (
      SELECT bt.bookmark_id FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE t.name IN (${tags.map(() => "?").join(",")})
    )`;
    params.push(...tags);
  }

  if (category) {
    where += " AND b.category_id = ?";
    params.push(parseInt(category));
  }

  if (author) {
    where += " AND b.author_username = ?";
    params.push(author);
  }

  if (pinned === "true") {
    where += " AND b.is_pinned = 1";
  }

  if (q) {
    where += ` AND b.rowid IN (
      SELECT rowid FROM bookmarks_fts WHERE bookmarks_fts MATCH ?
    )`;
    params.push(q);
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM bookmarks b ${where}`)
    .get(...params) as any;

  const rows = db
    .prepare(
      `SELECT b.* FROM bookmarks b ${where} ORDER BY b.is_pinned DESC, b.${sortCol} ${order} LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as any[];

  // Attach tags to each bookmark
  const tagStmt = db.prepare(
    `SELECT t.id, t.name, t.color FROM tags t
     JOIN bookmark_tags bt ON bt.tag_id = t.id
     WHERE bt.bookmark_id = ?`
  );

  const bookmarks = rows.map((row) => ({
    ...row,
    urls: JSON.parse(row.urls || "[]"),
    mentions: JSON.parse(row.mentions || "[]"),
    hashtags: JSON.parse(row.hashtags || "[]"),
    is_pinned: !!row.is_pinned,
    tags: tagStmt.all(row.id),
  }));

  res.json({
    data: bookmarks,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit),
  });
});

// Export bookmarks
bookmarksRouter.get("/export", (req, res) => {
  const db = getDb();
  const format = (req.query.format as string) || "json";

  const rows = db
    .prepare("SELECT * FROM bookmarks ORDER BY bookmarked_at DESC")
    .all() as any[];

  const tagStmt = db.prepare(
    `SELECT t.id, t.name, t.color FROM tags t
     JOIN bookmark_tags bt ON bt.tag_id = t.id
     WHERE bt.bookmark_id = ?`
  );

  const bookmarks = rows.map((row) => ({
    ...row,
    urls: JSON.parse(row.urls || "[]"),
    mentions: JSON.parse(row.mentions || "[]"),
    hashtags: JSON.parse(row.hashtags || "[]"),
    is_pinned: !!row.is_pinned,
    tags: tagStmt.all(row.id),
  }));

  if (format === "csv") {
    const headers = [
      "id", "text", "author_username", "author_name", "tweet_url",
      "created_at", "likes", "retweets", "impressions", "bookmarked_at",
      "notes", "is_pinned", "tags",
    ];
    const csvRows = bookmarks.map((b) =>
      [
        b.id,
        `"${(b.text || "").replace(/"/g, '""')}"`,
        b.author_username,
        b.author_name,
        b.tweet_url,
        b.created_at,
        b.likes,
        b.retweets,
        b.impressions,
        b.bookmarked_at,
        `"${(b.notes || "").replace(/"/g, '""')}"`,
        b.is_pinned ? "true" : "false",
        `"${b.tags.map((t: any) => t.name).join(", ")}"`,
      ].join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=bookmarks.csv");
    res.send(csv);
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=bookmarks.json");
  res.json({
    exportedAt: new Date().toISOString(),
    count: bookmarks.length,
    bookmarks,
  });
});

// Import bookmarks from JSON
bookmarksRouter.post("/import", (req, res) => {
  const db = getDb();
  const { bookmarks } = req.body;

  if (!Array.isArray(bookmarks)) {
    res.status(400).json({ error: "Request body must contain a 'bookmarks' array" });
    return;
  }

  let imported = 0;
  let skipped = 0;

  const upsertStmt = db.prepare(`
    INSERT INTO bookmarks (
      id, text, author_id, author_username, author_name, tweet_url,
      created_at, conversation_id, likes, retweets, replies, quotes,
      impressions, bookmark_count, urls, mentions, hashtags,
      category_id, notes, is_pinned, bookmarked_at, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO NOTHING
  `);

  const tagStmt = db.prepare(
    "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
  );
  const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const createTag = db.prepare(
    "INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)"
  );

  const importTransaction = db.transaction(() => {
    for (const b of bookmarks) {
      if (!b.id || !b.text) {
        skipped++;
        continue;
      }

      const result = upsertStmt.run(
        b.id,
        b.text,
        b.author_id || "",
        b.author_username || "unknown",
        b.author_name || "Unknown",
        b.tweet_url || `https://x.com/${b.author_username || "unknown"}/status/${b.id}`,
        b.created_at || new Date().toISOString(),
        b.conversation_id || null,
        b.likes || 0,
        b.retweets || 0,
        b.replies || 0,
        b.quotes || 0,
        b.impressions || 0,
        b.bookmark_count || 0,
        JSON.stringify(b.urls || []),
        JSON.stringify(b.mentions || []),
        JSON.stringify(b.hashtags || []),
        b.category_id || null,
        b.notes || "",
        b.is_pinned ? 1 : 0,
        b.bookmarked_at || new Date().toISOString()
      );

      if (result.changes > 0) {
        imported++;
        if (Array.isArray(b.tags)) {
          for (const tag of b.tags) {
            if (tag.name) {
              createTag.run(tag.name, tag.color || "#6366f1");
              const existing = findTag.get(tag.name) as any;
              if (existing) {
                tagStmt.run(b.id, existing.id);
              }
            }
          }
        }
      } else {
        skipped++;
      }
    }
  });

  importTransaction();
  res.json({ success: true, imported, skipped, total: bookmarks.length });
});

// Bulk delete bookmarks
bookmarksRouter.post("/bulk/delete", (req, res) => {
  const db = getDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }

  const placeholders = ids.map(() => "?").join(",");
  const result = db
    .prepare(`DELETE FROM bookmarks WHERE id IN (${placeholders})`)
    .run(...ids);

  res.json({ success: true, deleted: result.changes });
});

// Bulk add tags to bookmarks
bookmarksRouter.post("/bulk/tag", (req, res) => {
  const db = getDb();
  const { ids, tagIds } = req.body;
  if (!Array.isArray(ids) || !Array.isArray(tagIds)) {
    res.status(400).json({ error: "ids and tagIds must be arrays" });
    return;
  }

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
  );
  let added = 0;

  const bulkTag = db.transaction(() => {
    for (const bookmarkId of ids) {
      for (const tagId of tagIds) {
        const result = stmt.run(bookmarkId, tagId);
        added += result.changes;
      }
    }
  });

  bulkTag();
  res.json({ success: true, added });
});

// Bulk remove tags from bookmarks
bookmarksRouter.post("/bulk/untag", (req, res) => {
  const db = getDb();
  const { ids, tagIds } = req.body;
  if (!Array.isArray(ids) || !Array.isArray(tagIds)) {
    res.status(400).json({ error: "ids and tagIds must be arrays" });
    return;
  }

  const bookmarkPlaceholders = ids.map(() => "?").join(",");
  const tagPlaceholders = tagIds.map(() => "?").join(",");

  const result = db
    .prepare(
      `DELETE FROM bookmark_tags
       WHERE bookmark_id IN (${bookmarkPlaceholders})
       AND tag_id IN (${tagPlaceholders})`
    )
    .run(...ids, ...tagIds);

  res.json({ success: true, removed: result.changes });
});

// Get single bookmark
bookmarksRouter.get("/:id", (req, res) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM bookmarks WHERE id = ?")
    .get(req.params.id) as any;

  if (!row) {
    res.status(404).json({ error: "Bookmark not found" });
    return;
  }

  const tags = db
    .prepare(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?`
    )
    .all(req.params.id);

  res.json({
    ...row,
    urls: JSON.parse(row.urls || "[]"),
    mentions: JSON.parse(row.mentions || "[]"),
    hashtags: JSON.parse(row.hashtags || "[]"),
    is_pinned: !!row.is_pinned,
    tags,
  });
});

// Update bookmark (notes, category, pinned)
bookmarksRouter.patch("/:id", (req, res) => {
  const db = getDb();
  const { notes, category_id, is_pinned } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (notes !== undefined) {
    updates.push("notes = ?");
    params.push(notes);
  }
  if (category_id !== undefined) {
    updates.push("category_id = ?");
    params.push(category_id);
  }
  if (is_pinned !== undefined) {
    updates.push("is_pinned = ?");
    params.push(is_pinned ? 1 : 0);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  params.push(req.params.id);
  db.prepare(
    `UPDATE bookmarks SET ${updates.join(", ")} WHERE id = ?`
  ).run(...params);

  const updated = db
    .prepare("SELECT * FROM bookmarks WHERE id = ?")
    .get(req.params.id);
  res.json(updated);
});

// Delete bookmark
bookmarksRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM bookmarks WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Sync bookmarks from X API
bookmarksRouter.post("/sync", async (_req, res) => {
  try {
    const result = await syncBookmarks();
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Dashboard stats
bookmarksRouter.get("/meta/stats", (_req, res) => {
  const db = getDb();
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM bookmarks").get() as any
  ).count;
  const tagCount = (
    db.prepare("SELECT COUNT(*) as count FROM tags").get() as any
  ).count;
  const categoryCount = (
    db.prepare("SELECT COUNT(*) as count FROM categories").get() as any
  ).count;
  const syncState = db
    .prepare("SELECT * FROM sync_state WHERE id = 1")
    .get() as any;

  // Top tags
  const topTags = db
    .prepare(
      `SELECT t.name, t.color, COUNT(bt.bookmark_id) as count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC
       LIMIT 10`
    )
    .all();

  // Top authors
  const topAuthors = db
    .prepare(
      `SELECT author_username, COUNT(*) as count
       FROM bookmarks
       GROUP BY author_username
       ORDER BY count DESC
       LIMIT 10`
    )
    .all();

  res.json({
    total,
    tagCount,
    categoryCount,
    lastSync: syncState?.last_sync_at,
    totalSynced: syncState?.total_synced || 0,
    topTags,
    topAuthors,
  });
});
