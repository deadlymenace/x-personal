/**
 * OAuth 2.0 PKCE flow for Twitter/X bookmark access.
 */

import crypto from "crypto";
import { config } from "../config.js";
import { getDb } from "../db/connection.js";

// In-memory store for PKCE state (cleared on server restart)
const pendingAuth = new Map<
  string,
  { codeVerifier: string; createdAt: number }
>();

// Clean up stale auth attempts (older than 10 minutes)
function cleanupPending() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, val] of pendingAuth) {
    if (val.createdAt < cutoff) pendingAuth.delete(key);
  }
}

export function getAuthUrl(): { url: string; state: string } {
  cleanupPending();

  if (!config.X_CLIENT_ID) {
    throw new Error(
      "X_CLIENT_ID not configured. Get it from https://developer.twitter.com"
    );
  }

  const state = crypto.randomBytes(32).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  pendingAuth.set(state, { codeVerifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.X_CLIENT_ID,
    redirect_uri: config.OAUTH_CALLBACK_URL,
    scope: "tweet.read users.read bookmark.read bookmark.write offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    url: `https://twitter.com/i/oauth2/authorize?${params}`,
    state,
  };
}

export async function handleCallback(
  code: string,
  state: string
): Promise<{ username: string; user_id: string }> {
  const pending = pendingAuth.get(state);
  if (!pending) {
    throw new Error("Invalid or expired state parameter");
  }
  pendingAuth.delete(state);

  // Exchange code for tokens
  const basicAuth = Buffer.from(
    `${config.X_CLIENT_ID}:${config.X_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: config.X_CLIENT_ID,
      redirect_uri: config.OAUTH_CALLBACK_URL,
      code_verifier: pending.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json();

  // Fetch user identity
  const userRes = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Failed to fetch user identity");
  }

  const userData = (await userRes.json()) as any;
  const user_id = userData.data.id;
  const username = userData.data.username;

  // Calculate expiry
  const expiresAt = new Date(
    Date.now() + (tokens.expires_in || 7200) * 1000
  ).toISOString();

  // Store in DB
  const db = getDb();
  db.prepare(
    `INSERT INTO oauth_tokens (id, access_token, refresh_token, expires_at, scope, user_id, username, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       scope = excluded.scope,
       user_id = excluded.user_id,
       username = excluded.username,
       updated_at = datetime('now')`
  ).run(
    tokens.access_token,
    tokens.refresh_token || null,
    expiresAt,
    tokens.scope || null,
    user_id,
    username
  );

  return { username, user_id };
}

export async function getValidToken(): Promise<string> {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM oauth_tokens WHERE id = 1")
    .get() as any;

  if (!row) throw new Error("Not authenticated. Please connect your X account.");

  const expiresAt = new Date(row.expires_at).getTime();
  const now = Date.now();

  // Refresh if expires within 5 minutes
  if (now > expiresAt - 5 * 60 * 1000 && row.refresh_token) {
    const basicAuth = Buffer.from(
      `${config.X_CLIENT_ID}:${config.X_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
        client_id: config.X_CLIENT_ID,
      }),
    });

    if (!res.ok) {
      throw new Error("Token refresh failed. Please re-authenticate.");
    }

    const tokens = await res.json();
    const newExpiry = new Date(
      Date.now() + (tokens.expires_in || 7200) * 1000
    ).toISOString();

    db.prepare(
      `UPDATE oauth_tokens SET
        access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now')
       WHERE id = 1`
    ).run(tokens.access_token, tokens.refresh_token || row.refresh_token, newExpiry);

    return tokens.access_token;
  }

  return row.access_token;
}

export function isAuthenticated(): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM oauth_tokens WHERE id = 1")
    .get();
  return !!row;
}

export function getUserInfo(): { user_id: string; username: string } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT user_id, username FROM oauth_tokens WHERE id = 1")
    .get() as any;
  return row ? { user_id: row.user_id, username: row.username } : null;
}

export function logout() {
  const db = getDb();
  db.prepare("DELETE FROM oauth_tokens WHERE id = 1").run();
}
