/**
 * GSC OAuth2 Routes
 *
 * GET  /api/gsc/auth/status      — check if connected
 * GET  /api/gsc/auth/start       — begin OAuth2 flow (redirects to Google)
 * GET  /api/gsc/auth/callback    — Google redirects here after user approves
 * DELETE /api/gsc/auth/disconnect — remove stored tokens
 */

import { Router } from "express";
import fs          from "node:fs";
import path        from "node:path";

// Store OAuth tokens in /tmp (never under output/ which is web-accessible)
const TOKENS_FILE       = "/tmp/.gsc-oauth-tokens.json";
const DISCONNECTED_FILE = "/tmp/.gsc-oauth-disconnected";

const GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_SCOPE        = "https://www.googleapis.com/auth/webmasters.readonly";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clientId():     string { return (process.env.GSC_OAUTH_CLIENT_ID     ?? "").trim(); }
function clientSecret(): string { return (process.env.GSC_OAUTH_CLIENT_SECRET  ?? "").trim(); }

function callbackUrl(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN ?? "";
  return domain
    ? `https://${domain}/api/gsc/auth/callback`
    : `http://localhost:8080/api/gsc/auth/callback`;
}

/** Load saved OAuth tokens from file or env var.
 *  Returns null if the user has explicitly disconnected (marker file present). */
export function loadOAuthTokens(): { refresh_token: string } | null {
  // If user explicitly disconnected, ignore env var until they reconnect via UI
  if (fs.existsSync(DISCONNECTED_FILE)) return null;
  // Token file written by callback takes priority over env var
  if (fs.existsSync(TOKENS_FILE)) {
    try { return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8")); }
    catch { /* corrupt file — fall through to env var */ }
  }
  const envToken = (process.env.GSC_OAUTH_REFRESH_TOKEN ?? "").trim();
  if (envToken) return { refresh_token: envToken };
  return null;
}

function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:     clientId(),
    redirect_uri:  callbackUrl(),
    response_type: "code",
    scope:         GSC_SCOPE,
    access_type:   "offline",
    prompt:        "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─── GET /api/gsc/auth/status ────────────────────────────────────────────────

router.get("/gsc/auth/status", (_req, res) => {
  const id     = clientId();
  const secret = clientSecret();
  const tokens = loadOAuthTokens();

  res.json({
    clientConfigured: !!(id && secret),
    connected:        !!tokens?.refresh_token,
    callbackUrl:      callbackUrl(),
    authUrl:          id ? buildAuthUrl() : null,
  });
});

// ─── GET /api/gsc/auth/start ─────────────────────────────────────────────────

router.get("/gsc/auth/start", (req, res) => {
  if (!clientId()) {
    res.status(400).send("GSC_OAUTH_CLIENT_ID is not configured as a secret.");
    return;
  }
  if (!clientSecret()) {
    res.status(400).send("GSC_OAUTH_CLIENT_SECRET is not configured as a secret.");
    return;
  }
  res.redirect(buildAuthUrl());
});

// ─── GET /api/gsc/auth/callback ──────────────────────────────────────────────

router.get("/gsc/auth/callback", async (req, res) => {
  const { code, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`/api/dashboard?gsc_error=${encodeURIComponent(error)}`);
    return;
  }
  if (!code) {
    res.status(400).send("No authorisation code received from Google.");
    return;
  }

  const id     = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    res.status(400).send("OAuth credentials (GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET) not set.");
    return;
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        code,
        client_id:     id,
        client_secret: secret,
        redirect_uri:  callbackUrl(),
        grant_type:    "authorization_code",
      }),
    });

    const data = await tokenRes.json() as { refresh_token?: string; error?: string; error_description?: string };

    if (!tokenRes.ok || !data.refresh_token) {
      const msg = data.error_description ?? data.error ?? "Failed to get refresh token";
      res.redirect(`/api/dashboard?gsc_error=${encodeURIComponent(msg)}`);
      return;
    }

    fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify({ refresh_token: data.refresh_token }, null, 2), "utf8");
    // Clear any "disconnected" marker so env var is no longer suppressed
    if (fs.existsSync(DISCONNECTED_FILE)) fs.unlinkSync(DISCONNECTED_FILE);

    // Redirect back to Business Setup (Stage 1) where the connect UI now lives
    res.redirect("/api/setup?stage=1&gsc_connected=1");
  } catch (err) {
    const msg = (err as Error).message ?? "Unknown error";
    res.redirect(`/api/dashboard?gsc_error=${encodeURIComponent(msg)}`);
  }
});

// ─── DELETE /api/gsc/auth/disconnect ─────────────────────────────────────────

router.delete("/gsc/auth/disconnect", (_req, res) => {
  if (fs.existsSync(TOKENS_FILE)) fs.unlinkSync(TOKENS_FILE);
  // Write a marker file so env var token is suppressed until user reconnects
  fs.mkdirSync(path.dirname(DISCONNECTED_FILE), { recursive: true });
  fs.writeFileSync(DISCONNECTED_FILE, "", "utf8");
  res.json({ success: true });
});

export default router;
