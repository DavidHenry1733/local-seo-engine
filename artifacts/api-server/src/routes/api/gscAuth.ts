/**
 * GSC OAuth2 Routes
 *
 * GET  /api/gsc/auth/status      — check if connected
 * GET  /api/gsc/auth/start       — begin OAuth2 flow (redirects to Google)
 * GET  /api/gsc/auth/callback    — Google redirects here after user approves
 * DELETE /api/gsc/auth/disconnect — remove stored tokens
 *
 * Sitemap submission requires the Search Console write scope.
 * Existing readonly consent is never treated as write-authorised.
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const TOKENS_FILE = "/tmp/.gsc-oauth-tokens.json";
const DISCONNECTED_FILE = "/tmp/.gsc-oauth-disconnected";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GSC_OAUTH_SCOPE_READONLY = "https://www.googleapis.com/auth/webmasters.readonly";
export const GSC_OAUTH_SCOPE_WRITE = "https://www.googleapis.com/auth/webmasters";
const GSC_SCOPE = GSC_OAUTH_SCOPE_WRITE;

const router = Router();

export type GscOAuthTokenRecord = {
  refresh_token: string;
  granted_scope?: string;
  granted_scope_source?: "google_token_response" | "unverified";
  granted_at?: string;
};

function clientId(): string {
  return (process.env.GSC_OAUTH_CLIENT_ID ?? "").trim();
}
function clientSecret(): string {
  return (process.env.GSC_OAUTH_CLIENT_SECRET ?? "").trim();
}

function safeReturnSlug(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function GSC_OAUTH_CALLBACK_URL(): string {
  const explicit = (process.env.GSC_OAUTH_CALLBACK_URL ?? "").trim();
  if (explicit) return explicit;
  const publicApp = (process.env.PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (publicApp) return `${publicApp}/api/gsc/auth/callback`;
  const domain = (process.env.REPLIT_DEV_DOMAIN ?? "").trim();
  if (domain) return `https://${domain}/api/gsc/auth/callback`;
  return "https://app.pharmaconnect.uk/api/gsc/auth/callback";
}

function callbackUrl(): string {
  return GSC_OAUTH_CALLBACK_URL();
}

function encodeState(payload: { slug?: string }): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeState(raw: string | undefined): { slug?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(Buffer.from(String(raw), "base64url").toString("utf8")) as { slug?: string };
    return { slug: safeReturnSlug(parsed.slug) };
  } catch {
    return {};
  }
}

export function loadOAuthTokenRecord(): GscOAuthTokenRecord | null {
  if (fs.existsSync(DISCONNECTED_FILE)) return null;
  if (fs.existsSync(TOKENS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8")) as Partial<GscOAuthTokenRecord>;
      if (parsed.refresh_token) {
        return {
          refresh_token: parsed.refresh_token,
          granted_scope: parsed.granted_scope,
          granted_scope_source: parsed.granted_scope_source,
          granted_at: parsed.granted_at,
        };
      }
    } catch {
      /* corrupt file — fall through to env var */
    }
  }
  const envToken = (process.env.GSC_OAUTH_REFRESH_TOKEN ?? "").trim();
  if (envToken) return { refresh_token: envToken, granted_scope_source: "unverified" };
  return null;
}

/** Load saved OAuth tokens from file or env var. */
export function loadOAuthTokens(): { refresh_token: string } | null {
  const record = loadOAuthTokenRecord();
  return record ? { refresh_token: record.refresh_token } : null;
}

export function persistGrantedOauthScope(scope: string): void {
  const record = loadOAuthTokenRecord();
  if (!record?.refresh_token) return;
  const next: GscOAuthTokenRecord = {
    refresh_token: record.refresh_token,
    granted_scope: String(scope || "").trim(),
    granted_scope_source: "google_token_response",
    granted_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(next, null, 2), "utf8");
}

export function buildSearchConsoleAuthUrl(options: { slug?: string } = {}): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: encodeState({ slug: safeReturnSlug(options.slug) }),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function buildAuthUrl(slug?: string): string {
  return buildSearchConsoleAuthUrl({ slug });
}

function reconnectRequired(record: GscOAuthTokenRecord | null): boolean {
  if (!record?.refresh_token) return true;
  if (record.granted_scope_source !== "google_token_response") return true;
  const scopes = String(record.granted_scope || "").split(/[,\s]+/).filter(Boolean);
  return !scopes.includes(GSC_OAUTH_SCOPE_WRITE);
}

router.get("/gsc/auth/status", (_req, res) => {
  const id = clientId();
  const secret = clientSecret();
  const tokens = loadOAuthTokenRecord();
  const grantedScope = tokens?.granted_scope || null;
  const writeAuthorized = Boolean(
    tokens?.granted_scope_source === "google_token_response" &&
      String(grantedScope || "").split(/[,\s]+/).includes(GSC_OAUTH_SCOPE_WRITE),
  );

  res.json({
    clientConfigured: !!(id && secret),
    connected: !!tokens?.refresh_token,
    requestedScope: GSC_OAUTH_SCOPE_WRITE,
    grantedScope,
    grantedScopeProvenByGoogle: tokens?.granted_scope_source === "google_token_response",
    writeAuthorized,
    reconnectRequired: reconnectRequired(tokens),
    canSubmitSitemaps: writeAuthorized,
    callbackUrl: callbackUrl(),
    authUrl: id ? buildAuthUrl() : null,
  });
});

router.get("/gsc/auth/start", (req, res) => {
  if (!clientId()) {
    res.status(400).send("GSC_OAUTH_CLIENT_ID is not configured as a secret.");
    return;
  }
  if (!clientSecret()) {
    res.status(400).send("GSC_OAUTH_CLIENT_SECRET is not configured as a secret.");
    return;
  }
  const slug = safeReturnSlug(req.query.returnSlug || req.query.slug);
  res.redirect(buildAuthUrl(slug));
});

router.get("/gsc/auth/callback", async (req, res) => {
  const { code, error, state } = req.query as Record<string, string>;
  const returnSlug = decodeState(state).slug || "";

  if (error) {
    const dest = returnSlug
      ? `/api/pharmacy-growth-dashboard?slug=${encodeURIComponent(returnSlug)}&gsc_error=${encodeURIComponent(error)}#indexing`
      : `/api/dashboard?gsc_error=${encodeURIComponent(error)}`;
    res.redirect(dest);
    return;
  }
  if (!code) {
    res.status(400).send("No authorisation code received from Google.");
    return;
  }

  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) {
    res.status(400).send("OAuth credentials (GSC_OAUTH_CLIENT_ID / GSC_OAUTH_CLIENT_SECRET) not set.");
    return;
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: callbackUrl(),
        grant_type: "authorization_code",
      }),
    });

    const data = await tokenRes.json() as {
      refresh_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    const existing = loadOAuthTokenRecord();
    const refreshToken = data.refresh_token || existing?.refresh_token;
    if (!tokenRes.ok || !refreshToken) {
      const msg = data.error_description ?? data.error ?? "Failed to get refresh token";
      const dest = returnSlug
        ? `/api/pharmacy-growth-dashboard?slug=${encodeURIComponent(returnSlug)}&gsc_error=${encodeURIComponent(msg)}#indexing`
        : `/api/dashboard?gsc_error=${encodeURIComponent(msg)}`;
      res.redirect(dest);
      return;
    }

    const grantedScope = String(data.scope || "").trim();
    fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
    fs.writeFileSync(
      TOKENS_FILE,
      JSON.stringify(
        {
          refresh_token: refreshToken,
          granted_scope: grantedScope,
          granted_scope_source: "google_token_response",
          granted_at: new Date().toISOString(),
        } satisfies GscOAuthTokenRecord,
        null,
        2,
      ),
      "utf8",
    );
    if (fs.existsSync(DISCONNECTED_FILE)) fs.unlinkSync(DISCONNECTED_FILE);

    const dest = returnSlug
      ? `/api/pharmacy-growth-dashboard?slug=${encodeURIComponent(returnSlug)}&gsc_connected=1#indexing`
      : "/api/admin/master?gsc_connected=1";
    res.redirect(dest);
  } catch (err) {
    const msg = (err as Error).message ?? "Unknown error";
    const dest = returnSlug
      ? `/api/pharmacy-growth-dashboard?slug=${encodeURIComponent(returnSlug)}&gsc_error=${encodeURIComponent(msg)}#indexing`
      : `/api/dashboard?gsc_error=${encodeURIComponent(msg)}`;
    res.redirect(dest);
  }
});

router.delete("/gsc/auth/disconnect", (_req, res) => {
  if (fs.existsSync(TOKENS_FILE)) fs.unlinkSync(TOKENS_FILE);
  fs.mkdirSync(path.dirname(DISCONNECTED_FILE), { recursive: true });
  fs.writeFileSync(DISCONNECTED_FILE, "", "utf8");
  res.json({ success: true });
});

export default router;
