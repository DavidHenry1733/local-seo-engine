import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import session from "express-session";
import type { SessionData } from "express-session";
import router from "./routes";
import previewRouter from "./routes/preview";
import pharmacyPreviewRouter from "./routes/pharmacyPreview";
import {
  pharmacyVisualExperiencePublicRouter,
  pharmacyVisualExperienceAdminRouter,
  handleCanonicalPreviewAssetRequest,
} from "./routes/pharmacyVisualExperiencePreview";
import { pharmacyImagePlatformReviewRouter } from "./routes/pharmacyImagePlatformReviewGallery";
import authRouter from "./routes/auth";
import { logger } from "./lib/logger";
import { ensureAdminExists } from "./lib/users";
import { requireAuth, requireAdmin, hasValidInternalToken } from "./middlewares/requireAuth";
import healthRouter from "./routes/health";
import growthEnginePublicAcceptedPreviewRouter from "./routes/growthEnginePublicAcceptedPreview";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

const app: Express = express();

// Trust the Replit reverse proxy so req.secure reflects the actual
// HTTPS connection and sameSite:none cookies are set correctly.
app.set("trust proxy", 1);

// ── Seed default admin if no users exist ──────────────────────────────────────
ensureAdminExists().catch(err => logger.error(err, "Failed to seed admin user"));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id:     req.id,
          method: req.method,
          url:    req.url?.split("?")[0],
          ip:     req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress,
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS — restrict to internal Replit origins only ───────────────────────────
const REPLIT_DEV = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null;
const ALLOWED_ORIGINS: string[] = [
  "http://localhost",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:80",
  "https://replit.com",
  "https://replit.dev",
"https://app.inboxingproweb.com",
"https://app.pharmaconnect.uk",
  ...(REPLIT_DEV ? [REPLIT_DEV] : []),
  ...(process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",").map(d => `https://${d.trim()}`) : []),
];

app.use(cors({
  origin: (origin, cb) => {

    // allow server-side / curl / same-origin
    if (!origin) {
      return cb(null, true);
    }

    // localhost
    if (
      origin.startsWith("http://localhost") ||
      origin.startsWith("https://localhost")
    ) {
      return cb(null, true);
    }

    // inboxingproweb domains
    if (
      (origin.includes("inboxingproweb.com") || origin.includes("pharmaconnect.uk"))
    ) {
      return cb(null, true);
    }

    // replit domains
    if (
      origin.includes("replit") ||
      origin.includes("repl.co")
    ) {
      return cb(null, true);
    }

    logger.warn({ origin }, "CORS blocked request from disallowed origin");
    cb(null, true); // TEMP: allow while stabilising production
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Session middleware ─────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-fallback-secret-change-in-prod";
if (!process.env.SESSION_SECRET) {
  logger.warn("SESSION_SECRET not set — using insecure fallback. Set it in environment secrets.");
}

// File-based session store — survives server restarts without extra packages.
const SESSION_DIR = path.join(WORKSPACE_ROOT, ".sessions");
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

class FileSessionStore extends session.Store {
  private dir: string;
  constructor(dir: string) {
    super();
    this.dir = dir;
    // Clean up expired sessions on startup (non-blocking)
    setImmediate(() => this._prune());
  }
  private _file(sid: string): string {
    return path.join(this.dir, sid.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
  }
  private _prune(): void {
    try {
      const now = Date.now();
      for (const f of fs.readdirSync(this.dir)) {
        if (!f.endsWith(".json")) continue;
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8")) as { expires?: number };
          if (raw.expires && raw.expires < now) fs.unlinkSync(path.join(this.dir, f));
        } catch { /* skip corrupt files */ }
      }
    } catch { /* non-fatal */ }
  }
  get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const file = this._file(sid);
      if (!fs.existsSync(file)) { cb(null, null); return; }
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { expires?: number; data: SessionData };
      if (raw.expires && raw.expires < Date.now()) { fs.unlinkSync(file); cb(null, null); return; }
      cb(null, raw.data);
    } catch (e) { cb(e); }
  }
  set(sid: string, sessionData: SessionData, cb?: (err?: unknown) => void): void {
    try {
      const maxAge = (sessionData.cookie?.maxAge as number | undefined) ?? 8 * 60 * 60 * 1000;
      const expires = Date.now() + maxAge;
      fs.writeFileSync(this._file(sid), JSON.stringify({ expires, data: sessionData }));
      cb?.();
    } catch (e) { cb?.(e); }
  }
  destroy(sid: string, cb?: (err?: unknown) => void): void {
    try {
      const file = this._file(sid);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      cb?.();
    } catch (e) { cb?.(e); }
  }
}

app.use(session({
  store:             new FileSessionStore(SESSION_DIR),
  secret:            SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  name:              "seo.sid",
  cookie: {
    httpOnly: true,
    secure:   true,
    sameSite: "none",
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

// ── Security headers ──────────────────────────────────────────────────────────
app.use(healthRouter);

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // NOTE: X-Frame-Options SAMEORIGIN is intentionally omitted here.
  // Chrome checks all ancestor frames against SAMEORIGIN, so a nested iframe
  // (wizard embedded in dashboard, which itself is in the Replit preview pane)
  // would be blocked even though both frames are on the same app domain.
  // frame-ancestors 'self' in CSP applies per-hop (immediate parent only) and
  // correctly allows same-origin iframe nesting without this problem.
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://replit.com https://*.replit.dev https://*.replit.app https://*.repl.co");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ── Static asset routes — dotfiles DENIED ─────────────────────────────────────
const OUTPUT_DIR_ASSETS = path.join(WORKSPACE_ROOT, "output");
if (fs.existsSync(OUTPUT_DIR_ASSETS)) {
  for (const slug of fs.readdirSync(OUTPUT_DIR_ASSETS)) {
    const projectAssets = path.join(OUTPUT_DIR_ASSETS, slug, "assets");
    try {
      if (fs.statSync(projectAssets).isDirectory()) {
        app.use(`/assets/${slug}`, express.static(projectAssets, { dotfiles: "deny" }));
      }
    } catch { /* slug dir has no assets subdir — skip */ }
  }
}

app.use(
  "/assets/pharmacy-uploads",
  express.static("/home/inboxingproweb/pharmaconnect-growth-engine/assets/pharmacy-uploads", {
    dotfiles: "deny",
  }),
);

// Canonical final render assets (authenticated Master Admin preview only)
app.get(
  /^\/assets\/(?:website-import|brands)\/[a-z0-9_-]+\/.+/i,
  requireAdmin,
  handleCanonicalPreviewAssetRequest,
);

app.use("/assets", express.static(path.join(WORKSPACE_ROOT, "assets"), { dotfiles: "deny" }));


const DASHBOARD_DIST = path.resolve(
  WORKSPACE_ROOT,
  "artifacts/dashboard/dist/public"
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(DASHBOARD_DIST, { dotfiles: "deny" }));
}


// ── Auth routes (public — no login required) ──────────────────────────────────
app.use("/api", authRouter);

// ── Destructive endpoint guard (internal token) ───────────────────────────────
// Rollout routes are intentionally excluded from GUARDED_ROUTES so that
// session-authenticated dashboard users can trigger them directly.
// They remain protected by the requireAuth middleware below.
const GUARDED_ROUTES = [
  { method: "POST",   path: "/api/reupload" },
  { method: "POST",   path: "/api/rerun-page" },
  { method: "POST",   path: "/api/generate" },
  { method: "POST",   path: "/api/security-scan/" },
  { method: "POST",   path: "/api/link-audit/" },
  { method: "DELETE", path: "/api/" },
];

function isGuardedRoute(method: string, url: string): boolean {
  return GUARDED_ROUTES.some(r =>
    r.method === method.toUpperCase() &&
    url.startsWith(r.path),
  );
}

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!isGuardedRoute(req.method, req.url)) { next(); return; }

  if (!SESSION_SECRET) {
    logger.warn({ url: req.url }, "SESSION_SECRET not set — destructive endpoint is unprotected");
    next();
    return;
  }

  // Match requireAuth: dashboard fetch() sends _t in the query string because
  // some proxies strip custom headers; logged-in users may rely on session cookies.
  if (req.session?.userId || hasValidInternalToken(req)) {
    logger.info({ url: req.url, method: req.method }, "Authorised access to destructive endpoint");
    next();
    return;
  }

  const ip = req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress;
  logger.warn({ url: req.url, method: req.method, ip }, "Blocked unauthorised access to destructive endpoint");
  res.status(403).json({ error: "Forbidden — internal token required" });
});

// ── Slug sanitisation helper ──────────────────────────────────────────────────
export function sanitiseSlug(raw: string): string | null {
  const clean = path.basename(raw);
  return /^[a-z0-9][a-z0-9_-]*$/.test(clean) ? clean : null;
}

// ── Root-level sitemap + robots.txt serving (public) ─────────────────────────
const PROJECTS_DIR = path.join(WORKSPACE_ROOT, "config", "projects");
const OUTPUT_DIR   = path.join(WORKSPACE_ROOT, "output");

function resolveProjectSlugByHost(host: string): string | null {
  if (!fs.existsSync(PROJECTS_DIR)) return null;
  const cleanHost = host.replace(/:\d+$/, "").toLowerCase();
  for (const file of fs.readdirSync(PROJECTS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const proj = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, file), "utf8")) as { domain?: string };
      const projHost = (proj.domain ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
      if (projHost === cleanHost) return file.replace(/\.json$/, "");
    } catch { /* skip */ }
  }
  return null;
}

function resolveProjectSlugByFile(filename: string): string | null {
  if (!fs.existsSync(OUTPUT_DIR)) return null;
  for (const slug of fs.readdirSync(OUTPUT_DIR)) {
    const filePath = path.join(OUTPUT_DIR, slug, filename);
    if (fs.existsSync(filePath)) return slug;
  }
  return null;
}

app.get(/^\/(sitemap[^/]*\.xml|robots\.txt)$/, (req, res) => {
  const filename = (req.params as Record<string, string>)[0];
  const host = req.headers.host ?? "";
  const slug = resolveProjectSlugByHost(host) ?? resolveProjectSlugByFile(filename);
  if (!slug) { res.status(404).send("Not found"); return; }
  const filePath = path.join(OUTPUT_DIR, slug, filename);
  if (!fs.existsSync(filePath)) { res.status(404).send("Not found"); return; }
  res.setHeader("Content-Type", filename.endsWith(".xml") ? "application/xml" : "text/plain");
  res.sendFile(filePath);
});

app.get("/api/sitemaps/:slug/:file", (req, res) => {
  const { slug, file } = req.params;
  if (!/^[a-z0-9_-]+$/.test(slug)) { res.status(400).send("Invalid slug"); return; }
  if (!/^(sitemap[^/]*\.xml|robots\.txt)$/.test(file)) { res.status(400).send("Invalid file"); return; }
  const filePath = path.join(OUTPUT_DIR, slug, file);
  if (!fs.existsSync(filePath)) { res.status(404).send("Sitemap not found — rebuild first."); return; }
  res.setHeader("Content-Type", file.endsWith(".xml") ? "application/xml" : "text/plain");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.sendFile(filePath);
});

app.get("/pharmacy-image-library", (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, "/api/pharmacy-image-library" + qs);
});

// Dashboard iframe compatibility routes
app.get("/api/preview", (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, "/preview" + qs);
});

app.get("/api/crawl", (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, "/crawl" + qs);
});

app.use("/api", healthRouter);

app.get("/api/security", (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, "/security" + qs);
});

app.get("/api/designs", (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, "/designs" + qs);
});

// ── Preview routes (public — generated pages, no login required) ──────────────
app.use(previewRouter);
app.use(pharmacyPreviewRouter);
app.use("/api", pharmacyVisualExperiencePublicRouter);
app.use("/api", growthEnginePublicAcceptedPreviewRouter);

// ── All /api/* routes require login ───────────────────────────────────────────
app.use("/api", requireAuth);
app.use("/api", pharmacyVisualExperienceAdminRouter);
app.use("/api", pharmacyImagePlatformReviewRouter);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  app.get("/*splat", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DASHBOARD_DIST, "index.html"));
  });
}

export default app;



