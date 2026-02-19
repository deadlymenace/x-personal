import { getDb } from "./connection.js";

export function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id               TEXT PRIMARY KEY,
      text             TEXT NOT NULL,
      author_id        TEXT NOT NULL,
      author_username  TEXT NOT NULL,
      author_name      TEXT NOT NULL,
      tweet_url        TEXT NOT NULL,
      created_at       TEXT NOT NULL,
      conversation_id  TEXT,
      likes            INTEGER DEFAULT 0,
      retweets         INTEGER DEFAULT 0,
      replies          INTEGER DEFAULT 0,
      quotes           INTEGER DEFAULT 0,
      impressions      INTEGER DEFAULT 0,
      bookmark_count   INTEGER DEFAULT 0,
      urls             TEXT DEFAULT '[]',
      mentions         TEXT DEFAULT '[]',
      hashtags         TEXT DEFAULT '[]',
      category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      notes            TEXT DEFAULT '',
      is_pinned        INTEGER DEFAULT 0,
      bookmarked_at    TEXT NOT NULL,
      synced_at        TEXT NOT NULL,
      created_locally  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      color       TEXT NOT NULL DEFAULT '#6366f1',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      icon        TEXT DEFAULT 'folder',
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL UNIQUE,
      note        TEXT DEFAULT '',
      added_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auto_tag_rules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      rule_type   TEXT NOT NULL CHECK(rule_type IN ('keyword', 'hashtag', 'author', 'url_domain')),
      pattern     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tag_id, rule_type, pattern)
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id              INTEGER PRIMARY KEY CHECK(id = 1),
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      expires_at      TEXT,
      scope           TEXT,
      user_id         TEXT,
      username        TEXT,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      id                    INTEGER PRIMARY KEY CHECK(id = 1),
      last_sync_at          TEXT,
      last_pagination_token TEXT,
      total_synced          INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_author ON bookmarks(author_username);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_pinned ON bookmarks(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);
  `);

  // FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
      text,
      author_username,
      author_name,
      notes,
      content=bookmarks,
      content_rowid=rowid
    );
  `);

  // FTS sync triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
      INSERT INTO bookmarks_fts(rowid, text, author_username, author_name, notes)
      VALUES (new.rowid, new.text, new.author_username, new.author_name, new.notes);
    END;

    CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
      INSERT INTO bookmarks_fts(bookmarks_fts, rowid, text, author_username, author_name, notes)
      VALUES ('delete', old.rowid, old.text, old.author_username, old.author_name, old.notes);
    END;

    CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
      INSERT INTO bookmarks_fts(bookmarks_fts, rowid, text, author_username, author_name, notes)
      VALUES ('delete', old.rowid, old.text, old.author_username, old.author_name, old.notes);
      INSERT INTO bookmarks_fts(rowid, text, author_username, author_name, notes)
      VALUES (new.rowid, new.text, new.author_username, new.author_name, new.notes);
    END;
  `);

  // Initialize sync_state if empty
  db.exec(`
    INSERT OR IGNORE INTO sync_state (id, total_synced) VALUES (1, 0);
  `);

  console.log("Database initialized successfully");
}
