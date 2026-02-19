import dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

dotenv.config({ path: resolve(__dirname, "..", "..", ".env") });

export const config = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  X_BEARER_TOKEN: process.env.X_BEARER_TOKEN || "",
  X_CONSUMER_KEY: process.env.X_CONSUMER_KEY || "",
  X_CONSUMER_SECRET: process.env.X_CONSUMER_SECRET || "",
  X_CLIENT_ID: process.env.X_CLIENT_ID || "",
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET || "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  OAUTH_CALLBACK_URL:
    process.env.OAUTH_CALLBACK_URL || "http://localhost:5173/callback",
  DB_PATH: resolve(__dirname, "..", "data", "x-bookmarks.db"),
  CACHE_DIR: resolve(__dirname, "..", "data", "cache"),
};

export function validateConfig() {
  if (!config.X_BEARER_TOKEN) {
    console.warn(
      "WARNING: X_BEARER_TOKEN not set. Research features will not work."
    );
  }
  if (!config.X_CLIENT_ID) {
    console.warn(
      "WARNING: X_CLIENT_ID not set. Bookmark sync (OAuth) will not work. Get it from https://developer.twitter.com"
    );
  }
}
