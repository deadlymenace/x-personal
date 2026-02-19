/**
 * AI-powered bookmark categorization using Anthropic Claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";

function getClient() {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured. Add it to your .env file."
    );
  }
  return new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
}

interface ProgressCallback {
  (progress: { current: number; total: number; message: string }): void;
}

interface CategorySuggestion {
  name: string;
  icon: string;
  reason: string;
  estimatedCount: number;
  sampleBookmarkIds: string[];
}

/**
 * Auto-categorize uncategorized bookmarks into a specific category using AI.
 */
export async function autoCategorize(
  categoryId: number,
  onProgress?: ProgressCallback
) {
  const db = getDb();
  const client = getClient();

  // Load target category
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(categoryId) as any;
  if (!category) throw new Error("Category not found");

  // Load all categories for context
  const allCategories = db
    .prepare("SELECT name FROM categories")
    .all() as any[];
  const otherCategories = allCategories
    .filter((c: any) => c.name !== category.name)
    .map((c: any) => c.name);

  // Load uncategorized bookmarks
  const uncategorized = db
    .prepare(
      `SELECT id, text, author_username, hashtags, urls, notes
       FROM bookmarks WHERE category_id IS NULL`
    )
    .all() as any[];

  if (uncategorized.length === 0) {
    return { categorized: 0, total: 0 };
  }

  const BATCH_SIZE = 25;
  let totalCategorized = 0;
  const batches = [];
  for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
    batches.push(uncategorized.slice(i, i + BATCH_SIZE));
  }

  const updateStmt = db.prepare(
    "UPDATE bookmarks SET category_id = ? WHERE id = ?"
  );

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    onProgress?.({
      current: batchIdx * BATCH_SIZE,
      total: uncategorized.length,
      message: `Analyzing batch ${batchIdx + 1}/${batches.length}...`,
    });

    const bookmarkDescriptions = batch
      .map((b: any) => {
        const hashtags = JSON.parse(b.hashtags || "[]").join(", ");
        const urls = JSON.parse(b.urls || "[]").join(", ");
        return `[${b.id}] @${b.author_username}: ${b.text.slice(0, 200)}${hashtags ? ` | tags: ${hashtags}` : ""}${urls ? ` | urls: ${urls}` : ""}${b.notes ? ` | notes: ${b.notes}` : ""}`;
      })
      .join("\n");

    const prompt = `You are categorizing bookmarked tweets. Determine which of the following bookmarks belong in the category "${category.name}".

Other existing categories for context: ${otherCategories.length > 0 ? otherCategories.join(", ") : "none"}

Bookmarks (format: [id] @author: text):
${bookmarkDescriptions}

Return a JSON array of bookmark IDs that match the category "${category.name}". Only include bookmarks that clearly fit. If none match, return an empty array.

Respond with ONLY the JSON array, no other text. Example: ["123", "456"]`;

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const matchedIds: string[] = JSON.parse(match[0]);
        // Validate IDs against the batch
        const validIds = matchedIds.filter((id) =>
          batch.some((b: any) => b.id === id)
        );

        const txn = db.transaction(() => {
          for (const id of validIds) {
            updateStmt.run(categoryId, id);
          }
        });
        txn();
        totalCategorized += validIds.length;
      }
    } catch (err: any) {
      console.error(`AI categorization batch ${batchIdx + 1} failed:`, err.message);
    }
  }

  onProgress?.({
    current: uncategorized.length,
    total: uncategorized.length,
    message: `Done! Categorized ${totalCategorized} bookmarks.`,
  });

  return { categorized: totalCategorized, total: uncategorized.length };
}

/**
 * Ask AI to suggest new categories based on uncategorized bookmark patterns.
 */
export async function suggestCategories(): Promise<CategorySuggestion[]> {
  const db = getDb();
  const client = getClient();

  // Load existing categories
  const existing = db
    .prepare("SELECT name FROM categories")
    .all() as any[];
  const existingNames = existing.map((c: any) => c.name.toLowerCase());

  // Load sample of uncategorized bookmarks
  const bookmarks = db
    .prepare(
      `SELECT id, text, author_username, hashtags, urls, notes
       FROM bookmarks WHERE category_id IS NULL
       ORDER BY bookmarked_at DESC LIMIT 200`
    )
    .all() as any[];

  if (bookmarks.length === 0) {
    return [];
  }

  const bookmarkDescriptions = bookmarks
    .map((b: any) => {
      const hashtags = JSON.parse(b.hashtags || "[]").join(", ");
      return `[${b.id}] @${b.author_username}: ${b.text.slice(0, 150)}${hashtags ? ` | ${hashtags}` : ""}`;
    })
    .join("\n");

  const prompt = `Analyze these bookmarked tweets and suggest 3-6 categories to organize them.

${existingNames.length > 0 ? `Existing categories (do NOT suggest duplicates): ${existingNames.join(", ")}` : "No existing categories yet."}

Bookmarks:
${bookmarkDescriptions}

For each category suggestion, provide:
- name: short category name (2-3 words max)
- icon: a lucide icon name (e.g. "code", "lightbulb", "trending-up", "heart", "briefcase", "globe", "zap", "book-open", "cpu", "palette")
- reason: one sentence explaining what connects these bookmarks
- estimatedCount: approximate number of bookmarks that would fit
- sampleBookmarkIds: 2-3 bookmark IDs from above that would fit

Respond with ONLY a JSON array. Example:
[{"name":"AI & ML","icon":"cpu","reason":"Tweets about artificial intelligence and machine learning","estimatedCount":15,"sampleBookmarkIds":["123","456"]}]`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  const suggestions: CategorySuggestion[] = JSON.parse(match[0]);

  // Filter out duplicates of existing categories
  return suggestions.filter(
    (s) => !existingNames.includes(s.name.toLowerCase())
  );
}
