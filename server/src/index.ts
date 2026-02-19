import express from "express";
import cors from "cors";
import { config, validateConfig } from "./config.js";
import { initializeDatabase } from "./db/schema.js";
import { authRouter } from "./routes/auth.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { tagsRouter } from "./routes/tags.js";
import { categoriesRouter } from "./routes/categories.js";
import { researchRouter } from "./routes/research.js";
import { settingsRouter } from "./routes/settings.js";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const app = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3001"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/bookmarks", bookmarksRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/research", researchRouter);
app.use("/api/settings", settingsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve frontend in production
const clientDist = resolve(__dirname, "..", "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(resolve(clientDist, "index.html"));
  });
}

// Initialize
validateConfig();
initializeDatabase();

app.listen(config.PORT, () => {
  console.log(`Server running at http://localhost:${config.PORT}`);
});
