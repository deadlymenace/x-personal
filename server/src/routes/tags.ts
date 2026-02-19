import { Router } from "express";
import { getDb } from "../db/connection.js";
import { applyAllRules } from "../services/auto-tagger.js";

export const tagsRouter = Router();

// List all tags with bookmark counts
tagsRouter.get("/", (_req, res) => {
  const db = getDb();
  const tags = db
    .prepare(
      `SELECT t.*, COUNT(bt.bookmark_id) as bookmark_count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name`
    )
    .all();
  res.json(tags);
});

// Create tag
tagsRouter.post("/", (req, res) => {
  const db = getDb();
  const { name, color } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  try {
    const result = db
      .prepare("INSERT INTO tags (name, color) VALUES (?, ?)")
      .run(name, color || "#6366f1");
    const tag = db
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(tag);
  } catch (err: any) {
    if (err.message.includes("UNIQUE")) {
      res.status(409).json({ error: "Tag already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update tag
tagsRouter.patch("/:id", (req, res) => {
  const db = getDb();
  const { name, color } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name) {
    updates.push("name = ?");
    params.push(name);
  }
  if (color) {
    updates.push("color = ?");
    params.push(color);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  params.push(req.params.id);
  db.prepare(`UPDATE tags SET ${updates.join(", ")} WHERE id = ?`).run(
    ...params
  );
  const tag = db
    .prepare("SELECT * FROM tags WHERE id = ?")
    .get(req.params.id);
  res.json(tag);
});

// Delete tag
tagsRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM tags WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Add tags to bookmark
tagsRouter.post("/bookmark/:bookmarkId", (req, res) => {
  const db = getDb();
  const { tagIds } = req.body;
  if (!Array.isArray(tagIds)) {
    res.status(400).json({ error: "tagIds must be an array" });
    return;
  }

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
  );

  for (const tagId of tagIds) {
    stmt.run(req.params.bookmarkId, tagId);
  }

  const tags = db
    .prepare(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?`
    )
    .all(req.params.bookmarkId);

  res.json(tags);
});

// Remove tag from bookmark
tagsRouter.delete("/bookmark/:bookmarkId/:tagId", (req, res) => {
  const db = getDb();
  db.prepare(
    "DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?"
  ).run(req.params.bookmarkId, req.params.tagId);
  res.json({ success: true });
});

// List auto-tag rules
tagsRouter.get("/rules", (_req, res) => {
  const db = getDb();
  const rules = db
    .prepare(
      `SELECT r.*, t.name as tag_name, t.color as tag_color
       FROM auto_tag_rules r
       JOIN tags t ON t.id = r.tag_id
       ORDER BY r.created_at DESC`
    )
    .all();
  res.json(rules);
});

// Create auto-tag rule
tagsRouter.post("/rules", (req, res) => {
  const db = getDb();
  const { tag_id, rule_type, pattern } = req.body;

  if (!tag_id || !rule_type || !pattern) {
    res.status(400).json({ error: "tag_id, rule_type, and pattern are required" });
    return;
  }

  try {
    const result = db
      .prepare(
        "INSERT INTO auto_tag_rules (tag_id, rule_type, pattern) VALUES (?, ?, ?)"
      )
      .run(tag_id, rule_type, pattern);
    const rule = db
      .prepare("SELECT * FROM auto_tag_rules WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete auto-tag rule
tagsRouter.delete("/rules/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM auto_tag_rules WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Apply all rules to all bookmarks
tagsRouter.post("/rules/apply", (_req, res) => {
  const applied = applyAllRules();
  res.json({ applied });
});
