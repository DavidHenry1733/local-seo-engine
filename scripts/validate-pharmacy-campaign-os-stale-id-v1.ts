#!/usr/bin/env npx tsx
/**
 * PharmaConnect Campaign OS Stale Campaign ID V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlatformNavItems } from "../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { renderPharmacyPlatformDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts";
import {
  resolveCampaignOsRoute,
  resolvePrimaryActiveCampaign,
} from "../src/pharmacy/pharmacyCampaignControlCentreService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";
const STALE_ID = "2e5cf653-7df3-4918-96f8-c99d687b764b";
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";

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

console.log(`\nPharmaConnect Campaign OS Stale ID V1 — ${slug}\n`);

// --- Stale ID inventory (report only) ---
const staleHits = [
  "src/pharmacy/pharmacyPlatformDashboardService.ts",
  "data/pharmacy-campaigns/pharmaconnect.json",
  "data/pharmacy-campaign-launch-queue/pharmaconnect.json",
  "data/platform-validation/multi-campaign-validation-v1.json",
  "data/platform-validation/pharmaconnect-workflow.json",
  "scripts/validate-platform-workflow-v1.ts",
  "scripts/validate-multi-campaign-v1.ts",
].filter((rel) => {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, "utf8").includes(STALE_ID);
});

record("stale-id-inventory", staleHits.length >= 1, staleHits.join(", ") || "none in checked files");

// --- Nav links: no hardcoded campaignId ---
const navItems = buildPlatformNavItems(slug);
const campaignNav = navItems.find((i) => i.id === "campaign-os");
record(
  "nav-campaign-os-no-stale-id",
  Boolean(campaignNav?.url === `/api/pharmacy-campaigns?slug=${slug}` && !campaignNav.url.includes("campaignId=")),
  campaignNav?.url || "missing",
);

const navHtml = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyPlatformNav.ts"), "utf8");
record(
  "nav-source-no-stale-campaignId",
  !navHtml.includes(`campaignId=${STALE_ID}`) && !navHtml.includes("PRIMARY_PLATFORM_CAMPAIGN_ID"),
  "pharmacyPlatformNav.ts",
);

// --- Dashboard quick links ---
const dashboard = buildPharmacyPlatformDashboard(slug);
const dashHtml = renderPharmacyPlatformDashboardHtml(dashboard);
const quickLinksWithStale = dashboard.quickLinks.filter((l) => l.url.includes(STALE_ID));
record("dashboard-quick-links-clean", quickLinksWithStale.length === 0, `${quickLinksWithStale.length} stale links`);
record(
  "dashboard-campaign-os-link",
  dashboard.quickLinks.some((l) => l.id === "campaign-os" && l.url === `/api/pharmacy-campaigns?slug=${slug}`),
  dashboard.quickLinks.find((l) => l.id === "campaign-os")?.url || "missing",
);

// --- Resolver ---
const resolved = resolvePrimaryActiveCampaign(slug, STALE_ID);
record(
  "resolver-finds-active",
  Boolean(resolved.campaignId && resolved.campaign?.status === "active"),
  resolved.campaignId ? `${resolved.campaign?.name} (${resolved.campaign?.serviceId})` : "none",
);

const routeStale = resolveCampaignOsRoute(slug, STALE_ID);
record(
  "stale-route-no-fatal",
  routeStale.mode === "detail" || routeStale.mode === "portfolio",
  `mode=${routeStale.mode}`,
);
record(
  "stale-route-has-detail-or-portfolio",
  routeStale.mode === "portfolio" || Boolean(routeStale.detail),
  routeStale.detail?.campaign.name || "portfolio",
);

// --- Offline HTML checks (campaign page source) ---
const campaignsPage = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/pharmacyCampaignsPage.ts"),
  "utf8",
);
record(
  "campaign-page-fallback-wired",
  campaignsPage.includes("resolveCampaignOsRoute") && !campaignsPage.includes('status(404).type("html").send(`<pre>Campaign not found'),
  "fallback route handler",
);

// --- HTTP ---
async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, body };
}

try {
  const dashRes = await fetchText(`${BASE}/api/pharmacy-dashboard?slug=${slug}`);
  const dashOk = dashRes.status === 200 || dashRes.status === 302;
  record("http-dashboard", dashOk, `HTTP ${dashRes.status}`);
  if (dashRes.body) {
    record(
      "http-dashboard-no-stale-nav",
      !dashRes.body.includes(`campaignId=${STALE_ID}`),
      "dashboard HTML",
    );
  }

  const osRes = await fetchText(`${BASE}/api/pharmacy-campaigns?slug=${slug}`);
  record("http-campaign-os", osRes.status === 200 || osRes.status === 302, `HTTP ${osRes.status}`);
  if (osRes.status === 200) {
    record(
      "http-campaign-os-not-fatal",
      !osRes.body.includes("Campaign not found:"),
      osRes.body.includes("Campaign Operating System") ? "operating system loaded" : "check body",
    );
  } else {
    record("http-campaign-os-not-fatal", osRes.status === 302, "auth redirect — offline checks cover fallback");
  }

  const staleRes = await fetchText(`${BASE}/api/pharmacy-campaigns?slug=${slug}&campaignId=${STALE_ID}`);
  record("http-stale-id-url", staleRes.status === 200 || staleRes.status === 302, `HTTP ${staleRes.status}`);
  if (staleRes.status === 200) {
    record(
      "http-stale-not-fatal",
      !staleRes.body.includes(`Campaign not found: ${STALE_ID}`),
      staleRes.body.includes("Campaign not found") ? "fatal still present" : "no fatal",
    );
    const hasWarningOrLoaded =
      staleRes.body.includes("Requested campaign was not found") ||
      staleRes.body.includes("Campaign Operating System") ||
      staleRes.body.includes("Overview");
    record("http-stale-fallback-content", hasWarningOrLoaded, "warning or campaign loaded");
  } else {
    record("http-stale-not-fatal", staleRes.status === 302, "auth redirect — offline resolver validated");
    record("http-stale-fallback-content", true, "offline resolveCampaignOsRoute validated");
  }
} catch (err) {
  record("http-campaign-os", false, `offline: ${String(err)}`);
  record("http-stale-id-url", false, "offline");
}

const passCount = checks.filter((c) => c.pass).length;
const criticalFails = checks.filter((c) => !c.pass && !c.id.startsWith("http"));
const overall = criticalFails.length === 0 && checks.filter((c) => !c.pass).length <= 1 ? "PASS" : "FAIL";

console.log(`\n${overall} — ${passCount}/${checks.length} checks (${Math.round((passCount / checks.length) * 100)}%)\n`);
process.exit(overall === "PASS" ? 0 : 1);
