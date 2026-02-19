import { Router } from "express";
import { getDb } from "../db/connection.js";
import {
  autoCategorize,
  suggestCategories,
} from "../services/ai-categorizer.js";

export const categoriesRouter = Router();

// AI: Suggest new categories
categoriesRouter.post("/suggest", async (_req, res) => {
  try {
    const suggestions = await suggestCategories();
    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI: Accept a suggestion (create category + auto-categorize)
categoriesRouter.post("/accept-suggestion", async (req, res) => {
  const db = getDb();
  const { name, icon } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  try {
    // Create the category
    const result = db
      .prepare("INSERT INTO categories (name, icon) VALUES (?, ?)")
      .run(name, icon || "folder");
    const categoryId = result.lastInsertRowid as number;

    // Auto-categorize into it
    const categorizeResult = await autoCategorize(categoryId);
    const category = db
      .prepare(
        `SELECT c.*, COUNT(b.id) as bookmark_count
         FROM categories c
         LEFT JOIN bookmarks b ON b.category_id = c.id
         WHERE c.id = ?
         GROUP BY c.id`
      )
      .get(categoryId);

    res.status(201).json({
      category,
      categorized: categorizeResult.categorized,
    });
  } catch (err: any) {
    if (err.message.includes("UNIQUE")) {
      res.status(409).json({ error: "Category already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// AI: Auto-categorize bookmarks into an existing category (SSE)
categoriesRouter.post("/:id/auto-categorize", async (req, res) => {
  const categoryId = parseInt(req.params.id);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    const result = await autoCategorize(categoryId, (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    });
    res.write(
      `data: ${JSON.stringify({ done: true, ...result })}\n\n`
    );
  } catch (err: any) {
    res.write(
      `data: ${JSON.stringify({ error: err.message })}\n\n`
    );
  }

  res.end();
});

// List categories with bookmark counts
categoriesRouter.get("/", (_req, res) => {
  const db = getDb();
  const categories = db
    .prepare(
      `SELECT c.*, COUNT(b.id) as bookmark_count
       FROM categories c
       LEFT JOIN bookmarks b ON b.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    )
    .all();
  res.json(categories);
});

// Create category
categoriesRouter.post("/", (req, res) => {
  const db = getDb();
  const { name, icon } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  try {
    const result = db
      .prepare("INSERT INTO categories (name, icon) VALUES (?, ?)")
      .run(name, icon || "folder");
    const category = db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err: any) {
    if (err.message.includes("UNIQUE")) {
      res.status(409).json({ error: "Category already exists" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update category
categoriesRouter.patch("/:id", (req, res) => {
  const db = getDb();
  const { name, icon, sort_order } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (name) {
    updates.push("name = ?");
    params.push(name);
  }
  if (icon) {
    updates.push("icon = ?");
    params.push(icon);
  }
  if (sort_order !== undefined) {
    updates.push("sort_order = ?");
    params.push(sort_order);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  params.push(req.params.id);
  db.prepare(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`).run(
    ...params
  );
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(req.params.id);
  res.json(category);
});

// Delete category
categoriesRouter.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});
