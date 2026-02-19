import { Router } from "express";
import { getDb } from "../db/connection.js";
import { isAuthenticated, getUserInfo } from "../services/oauth.js";
import { config } from "../config.js";
import * as cache from "../lib/cache.js";

export const settingsRouter = Router();

// System status
settingsRouter.get("/status", (_req, res) => {
  const db = getDb();
  const bookmarkCount = (
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

  const user = isAuthenticated() ? getUserInfo() : null;

  res.json({
    authenticated: isAuthenticated(),
    user,
    hasBearerToken: !!config.X_BEARER_TOKEN,
    hasClientId: !!config.X_CLIENT_ID,
    bookmarkCount,
    tagCount,
    categoryCount,
    lastSync: syncState?.last_sync_at,
    totalSynced: syncState?.total_synced || 0,
  });
});

// Clear research cache
settingsRouter.post("/cache/clear", (_req, res) => {
  const removed = cache.clear();
  res.json({ removed });
});
