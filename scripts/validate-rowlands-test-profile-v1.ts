#!/usr/bin/env npx tsx
/**
 * Real Pharmacy Test Profile V1 — validation report for rowlands-test.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_MARKET_BRANCH_REQUIRED_MESSAGE } from "../src/pharmacy/localMarketBranchLocation.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { renderLocalMarketPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "rowlands-test";
const PROFILE_FILE = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const REPORT_FILE = path.join(ROOT, "data/validation-reports", `${SLUG}-profile-v1.json`);

if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const checks: Array<{ id: string; pass: boolean; detail?: string }> = [];
function record(id: string, pass: boolean, detail?: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}${detail ? ` — ${detail}` : ""}`);
}

record("profile-exists", fs.existsSync(PROFILE_FILE));
record("report-exists", fs.existsSync(REPORT_FILE));

const report = fs.existsSync(REPORT_FILE) ? JSON.parse(fs.readFileSync(REPORT_FILE, "utf8")) : null;

const profile = fs.existsSync(PROFILE_FILE)
  ? normalizeProfileData(JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8")).data || {})
  : null;

record("website-import-completed", Boolean(profile?.websiteAnalysisAt), profile?.websiteAnalysisAt);
record("business-name-imported", Boolean(profile?.pharmacyName), profile?.pharmacyName);
record("logo-imported", Boolean(profile?.logoUrl));
record("colours-imported", Boolean(profile?.brandPrimaryColor), profile?.brandPrimaryColor);
record(
  "header-footer-colours",
  report?.websiteImport?.headerFooterColours !== undefined,
  profile?.brandHeaderBackgroundColor || profile?.brandFooterBackgroundColor || "not detected on website",
);
record("footer-links-imported", (profile?.footerLinks?.length ?? 0) > 0, String(profile?.footerLinks?.length ?? 0));
record("services-detected", (profile?.detectedWebsiteServices?.length ?? 0) > 0, String(profile?.detectedWebsiteServices?.length ?? 0));

record("branch-not-ready", report?.branchLocationReady === false, "chain site — branch required");
record(
  "next-action-branch",
  report?.nextActionRequired === "Select a branch/location to run Local Market Report.",
);

const html = renderLocalMarketPage(SLUG, loadCompetitorSnapshot(SLUG));
record("local-market-branch-message", html.includes(LOCAL_MARKET_BRANCH_REQUIRED_MESSAGE));

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length ? "❌" : "✅"} ${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
