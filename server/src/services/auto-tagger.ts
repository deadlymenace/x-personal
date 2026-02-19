/**
 * Auto-tagging engine: applies rules to bookmarks.
 */

import { getDb } from "../db/connection.js";

export function applyAutoTags(bookmarkId: string) {
  const db = getDb();

  const bookmark = db
    .prepare("SELECT * FROM bookmarks WHERE id = ?")
    .get(bookmarkId) as any;
  if (!bookmark) return;

  const rules = db
    .prepare("SELECT * FROM auto_tag_rules")
    .all() as any[];

  const textLower = bookmark.text.toLowerCase();
  const hashtags: string[] = JSON.parse(bookmark.hashtags || "[]").map(
    (h: string) => h.toLowerCase()
  );
  const urls: string[] = JSON.parse(bookmark.urls || "[]");

  const insertTag = db.prepare(
    "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)"
  );

  for (const rule of rules) {
    let matches = false;

    switch (rule.rule_type) {
      case "keyword":
        matches = textLower.includes(rule.pattern.toLowerCase());
        break;
      case "hashtag":
        matches = hashtags.includes(rule.pattern.toLowerCase());
        break;
      case "author":
        matches =
          bookmark.author_username.toLowerCase() ===
          rule.pattern.toLowerCase();
        break;
      case "url_domain":
        matches = urls.some((u: string) => {
          try {
            return new URL(u).hostname.includes(rule.pattern.toLowerCase());
          } catch {
            return false;
          }
        });
        break;
    }

    if (matches) {
      insertTag.run(bookmarkId, rule.tag_id);
    }
  }
}

export function applyAllRules() {
  const db = getDb();
  const bookmarks = db
    .prepare("SELECT id FROM bookmarks")
    .all() as any[];

  let applied = 0;
  for (const bookmark of bookmarks) {
    applyAutoTags(bookmark.id);
    applied++;
  }
  return applied;
}
