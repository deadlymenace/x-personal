import { Router } from "express";
import {
  getAuthUrl,
  handleCallback,
  isAuthenticated,
  getUserInfo,
  logout,
} from "../services/oauth.js";

export const authRouter = Router();

authRouter.get("/status", (_req, res) => {
  const authenticated = isAuthenticated();
  const user = authenticated ? getUserInfo() : null;
  res.json({
    authenticated,
    username: user?.username,
    user_id: user?.user_id,
  });
});

authRouter.get("/login", (_req, res) => {
  try {
    const { url } = getAuthUrl();
    res.json({ url });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).json({ error: "Missing code or state parameter" });
      return;
    }

    const result = await handleCallback(code as string, state as string);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post("/logout", (_req, res) => {
  logout();
  res.json({ success: true });
});
