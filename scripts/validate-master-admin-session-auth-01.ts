#!/usr/bin/env npx tsx
/**
 * Master Admin session auth for Generate Growth Intelligence.
 * Uses production requireAuth and FileSessionStore.
 * Does not call Gilbert's continue-workflow route and does not generate intelligence.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { SessionData } from "../artifacts/api-server/node_modules/express-session/index.js";

const SECRET = "fixture-master-admin-auth-secret";
process.env.SESSION_SECRET = SECRET;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
const APP = path.join(ROOT, "artifacts/api-server/src/app.ts");
const AUTH = path.join(ROOT, "artifacts/api-server/src/middlewares/requireAuth.ts");

interface Check { id: string; pass: boolean; detail: string }
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function extractFunction(src: string, name: string): string {
  const start = src.indexOf(`async function ${name}`);
  const alt = start >= 0 ? start : src.indexOf(`function ${name}`);
  if (alt < 0) return "";
  let depth = 0;
  let started = false;
  for (let i = alt; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") {
      depth--;
      if (started && depth === 0) return src.slice(alt, i + 1);
    }
  }
  return "";
}

async function main() {
  console.log("\n=== MASTER ADMIN SESSION AUTH 01 ===\n");
  const page = fs.readFileSync(PAGE, "utf8");
  const appSrc = fs.readFileSync(APP, "utf8");
  const authSrc = fs.readFileSync(AUTH, "utf8");
  const cont = extractFunction(page, "continueWorkflow");
  const accept = extractFunction(page, "acceptImportedEvidenceReview");
  const approve = extractFunction(page, "approveBusinessProfileReview");
  const saveField = extractFunction(page, "bprSaveField");

  record("continue-found", cont.includes("continue-workflow"), `len=${cont.length}`);
  record(
    "gi-uses-canonical-handoff",
    cont.includes("withAuthHandoff(") && cont.includes("'/continue-workflow'"),
    "continueWorkflow attaches _t",
  );
  record(
    "gi-no-raw-fetch",
    !cont.includes("fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/continue-workflow'"),
    "raw continue-workflow fetch removed",
  );
  record("ier-accept-uses-api", accept.includes("api(") && accept.includes("imported-evidence-review/accept"), "IER accept");
  record("approve-uses-api", approve.includes("api(") && approve.includes("business-profile-review/approve"), "profile approve");
  record("field-save-uses-api", saveField.includes("api(") && saveField.includes("business-profile-review/field"), "confirmations and hours");
  record(
    "file-session-store",
    appSrc.includes('new FileSessionStore(SESSION_DIR)') && !appSrc.includes("MemoryStore") && appSrc.includes('name:              "seo.sid"') && appSrc.includes('sameSite: "none"') && appSrc.includes("secure:   true") && appSrc.includes("8 * 60 * 60 * 1000"),
    "persistent seo.sid cookie",
  );
  record(
    "require-auth-401",
    authSrc.includes('req.session?.userId || hasValidInternalToken(req)') && authSrc.includes('error: "Session expired. Please refresh the page and log in again."'),
    "same middleware rejects missing credentials",
  );
  record(
    "no-tenant-hardcode",
    !cont.includes("gilbert") && !fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/lib/fileSessionStore.ts"), "utf8").includes("gilbert"),
    "no pharmacy name in the auth path",
  );
  record(
    "archive-not-imported",
    !page.includes("legacy-master-admin-auth") && !appSrc.includes("legacy-master-admin-auth") && !authSrc.includes("legacy-master-admin-auth"),
    "superseded fetch is not wired",
  );

  const { requireAuth } = await import("../artifacts/api-server/src/middlewares/requireAuth.ts");
  const { FileSessionStore } = await import("../artifacts/api-server/src/lib/fileSessionStore.ts");
  const express = (await import("../artifacts/api-server/node_modules/express/index.js")).default;
  const session = (await import("../artifacts/api-server/node_modules/express-session/index.js")).default;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pc-session-"));
  const store = new FileSessionStore(dir);
  const app = express();
  app.use(express.json());
  app.use(session({
    store,
    secret: SECRET,
    resave: false,
    saveUninitialized: false,
    name: "seo.sid",
    cookie: { httpOnly: true, secure: false, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
  }));
  app.post("/api/test-login", (req, res) => {
    const data = req.session as SessionData & { userId?: string; userRole?: string };
    data.userId = "product-owner";
    data.userRole = "admin";
    res.json({ ok: true });
  });
  app.use("/api", requireAuth);
  app.post("/api/master-admin-platform/customers/:slug/continue-workflow", (req, res) => {
    res.json({ ok: true, auth: "canonical", slug: req.params.slug, generated: false });
  });
  app.post("/api/master-admin-platform/customers/:slug/imported-evidence-review/accept", (req, res) => {
    res.json({ ok: true, action: "accept", slug: req.params.slug });
  });
  app.post("/api/master-admin-platform/customers/:slug/business-profile-review/approve", (req, res) => {
    res.json({ ok: true, action: "approve", slug: req.params.slug });
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;

  async function call(urlPath: string, cookie?: string) {
    const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: "{}",
      redirect: "manual",
    });
    const text = await res.text();
    let json: { ok?: boolean; error?: string; slug?: string; auth?: string; action?: string; generated?: boolean } | null = null;
    try { json = JSON.parse(text); } catch { json = null; }
    const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    return { status: res.status, json, setCookie, location: res.headers.get("location") };
  }

  const anon = await call("/api/master-admin-platform/customers/pharmacy-a/continue-workflow");
  record("unauthenticated-rejected", anon.status === 401 && anon.json?.error === "Session expired. Please refresh the page and log in again." && !anon.location, `status=${anon.status}`);

  const tampered = await call("/api/master-admin-platform/customers/pharmacy-a/continue-workflow", "seo.sid=tampered-cookie");
  record("tampered-cookie-rejected", tampered.status === 401 && tampered.json?.generated !== true, `status=${tampered.status}`);

  const badToken = await call("/api/master-admin-platform/customers/pharmacy-a/continue-workflow?_t=not-the-secret");
  record("invalid-token-rejected", badToken.status === 401, `status=${badToken.status}`);

  const login = await call("/api/test-login");
  const cookie = (login.setCookie[0] || "").split(";")[0];
  const authed = await call("/api/master-admin-platform/customers/pharmacy-a/continue-workflow", cookie);
  record(
    "valid-session-reaches-action",
    login.status === 200 && authed.status === 200 && authed.json?.auth === "canonical" && authed.json?.generated === false && authed.json?.slug === "pharmacy-a",
    `login=${login.status} action=${authed.status}`,
  );

  const second = await call("/api/master-admin-platform/customers/pharmacy-b/continue-workflow", cookie);
  record(
    "second-pharmacy-same-auth",
    second.status === 200 && second.json?.slug === "pharmacy-b" && second.json?.slug !== authed.json?.slug,
    `slug=${second.json?.slug}`,
  );
  const acceptRes = await call("/api/master-admin-platform/customers/pharmacy-a/imported-evidence-review/accept", cookie);
  const approveRes = await call("/api/master-admin-platform/customers/pharmacy-a/business-profile-review/approve", cookie);
  record(
    "working-actions-same-middleware",
    acceptRes.status === 200 && acceptRes.json?.action === "accept" && approveRes.status === 200 && approveRes.json?.action === "approve",
    `accept=${acceptRes.status} approve=${approveRes.status}`,
  );

  const tokenOnly = await call(`/api/master-admin-platform/customers/pharmacy-b/continue-workflow?_t=${encodeURIComponent(SECRET)}`);
  record(
    "handoff-token-reaches-action",
    tokenOnly.status === 200 && tokenOnly.json?.slug === "pharmacy-b" && tokenOnly.json?.generated === false,
    `status=${tokenOnly.status}`,
  );

  const anonB = await call("/api/master-admin-platform/customers/pharmacy-b/continue-workflow");
  record("tenant-unauthenticated-still-blocked", anonB.status === 401 && anonB.json?.slug !== "pharmacy-b", `status=${anonB.status}`);

  await new Promise<void>((resolve, reject) => {
    store.set("restart-sid", { cookie: { maxAge: 60_000 }, userId: "product-owner" } as SessionData, (err) => err ? reject(err as Error) : resolve());
  });
  const restarted = new FileSessionStore(dir);
  const survived = await new Promise<SessionData | null | undefined>((resolve, reject) => {
    restarted.get("restart-sid", (err, data) => err ? reject(err as Error) : resolve(data));
  });
  record("restart-keeps-session", (survived as { userId?: string } | null)?.userId === "product-owner", "new store instance read the same file");

  await new Promise<void>((resolve, reject) => {
    store.set("expired-sid", { cookie: { maxAge: -5_000 }, userId: "product-owner" } as SessionData, (err) => err ? reject(err as Error) : resolve());
  });
  const expired = await new Promise<SessionData | null | undefined>((resolve, reject) => {
    new FileSessionStore(dir).get("expired-sid", (err, data) => err ? reject(err as Error) : resolve(data));
  });
  record("expired-session-rejected", expired == null, "expired file is not a session");

  server.close();
  fs.rmSync(dir, { recursive: true, force: true });

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
