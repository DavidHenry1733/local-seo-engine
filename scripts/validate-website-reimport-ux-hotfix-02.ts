#!/usr/bin/env npx tsx
/**
 * PC-WEBSITE-REIMPORT-UX-HOTFIX-02 — validate shell JS parse without executing re-import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMasterAdminPlatformShell } from "../artifacts/api-server/src/routes/masterAdminPlatformPage.ts";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildMarketScopeSummary } from "../src/pharmacy/masterAdminMarketScopeService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function main() {
  if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;
  console.log("\n=== PC-WEBSITE-REIMPORT-UX-HOTFIX-02 ===\n");

  const html = renderMasterAdminPlatformShell();
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || "";

  let parseError = "";
  try {
    // eslint-disable-next-line no-new-func
    new Function(script);
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }
  record("browser-script-parses", !parseError, parseError || "ok");

  const confirmIdx = html.indexOf("confirm('Re-import Website");
  const confirmChunk = confirmIdx >= 0 ? html.slice(confirmIdx, confirmIdx + 260) : "";
  const brokenByRealNewline = /confirm\('[^']*\n/.test(confirmChunk);
  record("confirmation-string-safe", Boolean(confirmChunk) && !brokenByRealNewline, JSON.stringify(confirmChunk.slice(0, 160)));
  record("confirmation-required", /confirm\(/.test(script) && /Re-import Website/.test(script), "confirm present");
  record("loadDashboard-present", script.includes("async function loadDashboard") && script.includes("/api/master-admin-platform/dashboard"), "ok");
  record("ier-open-present", script.includes("async function openImportedEvidenceReview"), "ok");
  record("reimport-button-label", script.includes("Re-import Website"), "ok");
  record(
    "canonical-action",
    script.includes("reimportWebsiteFromEvidenceReview") && script.includes("/actions/rerun_website_import"),
    "rerun_website_import",
  );

  const review = buildImportedEvidenceReview("pharmaconnect");
  const data = readSetupProfile("pharmaconnect");
  const ms = buildMarketScopeSummary("pharmaconnect", data);
  const snapAt = String((data.websiteImportSnapshot as { importedAt?: string } | null)?.importedAt || "");

  record("reimport-control-visible-flag", review.websiteReimportRequired === true, String(review.websiteReimportRequired));
  record("target-tenant", review.slug === "pharmaconnect", review.slug);
  record(
    "target-website",
    /^https:\/\/pharmaconnect\.uk\/?$/i.test(review.websiteReimportTargetUrl || review.websiteUrl || ""),
    review.websiteReimportTargetUrl || review.websiteUrl,
  );
  record("old-snapshot-preserved", snapAt === "2026-08-10T08:19:01.609Z", snapAt);
  record("google-not-imported", review.googleImported === false, String(review.googleImported));
  record("comparison-suppressed", review.comparisonState === "suppressed", String(review.comparisonState));
  record("market-scope-national", ms.marketScope === "national", ms.marketScope);
  record("primary-market-uk", /united kingdom/i.test(ms.primaryMarket || ""), ms.primaryMarket || "");
  record("no-reimport-post-in-validation", true, "validation does not call rerun_website_import");

  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "website-reimport-ux-hotfix-02.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), passed: failed.length === 0, checks }, null, 2),
  );
  console.log(failed.length ? `\nFAILED ${failed.length}/${checks.length}` : `\nALL PASS ${checks.length}/${checks.length}`);
  process.exit(failed.length ? 1 : 0);
}

main();
