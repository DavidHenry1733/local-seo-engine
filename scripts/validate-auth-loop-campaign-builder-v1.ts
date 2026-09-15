#!/usr/bin/env npx tsx
/**
 * Auth loop emergency fix — Campaign Builder login must not loop.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAMPAIGN_BUILDER_ACTION_SUFFIXES,
  loginNextContainsActionEndpoint,
  safeCampaignBuilderLoginDestination,
  sanitizeCampaignBuilderLoginNext,
} from "../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SLUG = "pharmacy-delivered-4u-test";
const BASE = process.env.CB_AUTH_TEST_BASE || "http://127.0.0.1:3001";
const TOKEN = process.env.SESSION_SECRET || "4a92c9e0d7155a3a4c230c3a110aadf65bb3a5b6693ac12fae204d3d1ca4b430";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

async function fetchHead(url: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...opts, redirect: "manual" });
}

async function followRedirects(startUrl: string, max = 8): Promise<{ urls: string[]; statuses: number[] }> {
  const urls: string[] = [];
  const statuses: number[] = [];
  let url = startUrl;
  for (let i = 0; i < max; i++) {
    const res = await fetchHead(url);
    statuses.push(res.status);
    urls.push(url);
    if (res.status < 300 || res.status >= 400) break;
    const location = res.headers.get("location");
    if (!location) break;
    url = location.startsWith("http") ? location : `${BASE}${location}`;
  }
  return { urls, statuses };
}

async function main() {
  console.log("\n=== Auth Loop Campaign Builder V1 ===\n");

  const pageRouter = readSrc("artifacts/api-server/src/routes/growthEngineCampaignBuilderPageRouter.ts");
  const requireAuth = readSrc("artifacts/api-server/src/middlewares/requireAuth.ts");
  const auth = readSrc("artifacts/api-server/src/routes/auth.ts");

  record(
    "pending-replay-disabled",
    !pageRouter.includes("applyPendingCampaignBuilderAction") &&
      !requireAuth.includes("stashPendingCampaignBuilderAction"),
    "no pending POST replay",
  );

  record(
    "session-save-on-login",
    auth.includes("req.session.save"),
    "session persisted before post-login redirect",
  );

  record(
    "safe-login-destination",
    safeCampaignBuilderLoginDestination(SLUG).includes("step=choose") &&
      !safeCampaignBuilderLoginDestination(SLUG).includes("/select"),
    safeCampaignBuilderLoginDestination(SLUG),
  );

  const badNext = `/api/growth-engine/${SLUG}/campaign-builder/select`;
  const sanitized = sanitizeCampaignBuilderLoginNext(badNext);
  record(
    "sanitize-action-to-choose",
    sanitized.includes("step=choose") && !loginNextContainsActionEndpoint(sanitized),
    sanitized,
  );

  for (const suffix of CAMPAIGN_BUILDER_ACTION_SUFFIXES) {
    const sample = sanitizeCampaignBuilderLoginNext(`/api/growth-engine/${SLUG}${suffix}`);
    record(
      `never-next-${suffix.split("/").pop()}`,
      !loginNextContainsActionEndpoint(sample),
      sample,
    );
  }

  const builderPage = `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(SLUG)}&step=choose`;
  const unauth = await followRedirects(`${BASE}${builderPage}`);
  const loginRedirects = unauth.urls.filter((u) => u.includes("/api/login"));
  record(
    "unauth-page-one-login-redirect",
    loginRedirects.length === 1 && unauth.statuses[0] === 302,
    `${loginRedirects.length} login hop(s) · first status ${unauth.statuses[0]}`,
  );

  if (loginRedirects.length) {
    const loginUrl = loginRedirects[0];
    const nextParam = new URL(loginUrl).searchParams.get("next") || "";
    record(
      "login-next-is-page-route",
      nextParam.includes("/api/growth-engine/campaign-builder") &&
        nextParam.includes("step=choose") &&
        !loginNextContainsActionEndpoint(nextParam),
      decodeURIComponent(nextParam),
    );
  } else {
    record("login-next-is-page-route", false, "no login redirect captured");
  }

  const authedUrl = `${BASE}${builderPage}&_t=${encodeURIComponent(TOKEN)}`;
  const authed = await fetchHead(authedUrl);
  const authedBody = authed.status === 200 ? await authed.text() : "";
  record(
    "authed-campaign-builder-200",
    authed.status === 200 && authedBody.includes("Build Campaign"),
    `status ${authed.status}`,
  );

  const authedChain = await followRedirects(authedUrl);
  const authedLoginHops = authedChain.urls.filter((u) => u.includes("/api/login"));
  record(
    "authed-no-login-loop",
    authedLoginHops.length === 0 && authedChain.statuses[0] === 200,
    `${authedLoginHops.length} login hop(s) after auth handoff`,
  );

  const actionGet = await followRedirects(`${BASE}/api/growth-engine/${SLUG}/campaign-builder/select`);
  const actionLoginHops = actionGet.urls.filter((u) => u.includes("/api/login"));
  const actionLoginNext = actionLoginHops.map((u) => decodeURIComponent(new URL(u).searchParams.get("next") || ""));
  record(
    "action-get-no-loop",
    actionLoginHops.length <= 1 &&
      actionLoginNext.every((n) => n.includes("step=choose") && !loginNextContainsActionEndpoint(n)),
    actionGet.urls.map((u) => u.replace(BASE, "")).join(" → "),
  );

  record(
    "choose-html-renders",
    renderCampaignBuilderPage(SLUG, "choose").includes("Build Campaign"),
    "Build Campaign button present",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
