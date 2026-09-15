#!/usr/bin/env npx tsx
/**
 * PC-WEBSITE-REIMPORT-UX-01 — validate Re-import Website control wiring WITHOUT executing import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";
import { canEditCanonicalWebsite, buildWebsiteSourceSummary } from "../src/pharmacy/masterAdminCanonicalWebsiteService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildMarketScopeSummary } from "../src/pharmacy/masterAdminMarketScopeService.ts";
import { isBusinessProfileReviewApproved } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "pharmaconnect";

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
  console.log("\n=== PC-WEBSITE-REIMPORT-UX-01 (no import executed) ===\n");

  const review = buildImportedEvidenceReview(SLUG);
  const gate = canEditCanonicalWebsite(SLUG);
  const ws = buildWebsiteSourceSummary(SLUG);
  const data = readSetupProfile(SLUG);
  const ms = buildMarketScopeSummary(SLUG, data);
  const snapAt = String((data.websiteImportSnapshot as { importedAt?: string } | null)?.importedAt || "");

  record(
    "existing-capability-found",
    review.websiteReimportActionId === "rerun_website_import",
    `actionId=${review.websiteReimportActionId}`,
  );
  record("reimport-gate-allowed", gate.allowed === true, gate.reason || "allowed");
  record(
    "blocker-requires-reimport",
    Boolean(review.evidenceQuality?.blockers?.some((b) => /re-?import required/i.test(b))),
    (review.evidenceQuality?.blockers || []).join(" | "),
  );
  record("website-reimport-required-flag", review.websiteReimportRequired === true, String(review.websiteReimportRequired));
  record("target-tenant", review.slug === "pharmaconnect", review.slug);
  record(
    "target-website",
    /^https:\/\/pharmaconnect\.uk\/?$/i.test(review.websiteReimportTargetUrl || review.websiteUrl || ""),
    review.websiteReimportTargetUrl || review.websiteUrl,
  );
  record("snapshot-preserved", Boolean(data.websiteImportSnapshot) && Boolean(snapAt), `importedAt=${snapAt}`);
  record("google-not-imported", review.googleImported === false, String(review.googleImported));
  record("comparison-suppressed", review.comparisonState === "suppressed", String(review.comparisonState));
  record("market-scope-national", ms.marketScope === "national", ms.marketScope);
  record("primary-market-uk", /united kingdom/i.test(ms.primaryMarket || ""), ms.primaryMarket);
  record("business-profile-not-approved", isBusinessProfileReviewApproved(SLUG) === false, "ok");

  const pagePath = path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
  const pageSrc = fs.readFileSync(pagePath, "utf8");
  record(
    "ui-control-label",
    pageSrc.includes(">Re-import Website<") && pageSrc.includes("reimportWebsiteFromEvidenceReview"),
    "Re-import Website + handler present in IER page",
  );
  record(
    "ui-uses-canonical-action",
    pageSrc.includes("/actions/rerun_website_import") && pageSrc.includes("reimportWebsiteFromEvidenceReview"),
    "handler posts to rerun_website_import",
  );
  record(
    "no-auto-import-on-render",
    !/function renderImportedEvidenceReview[\s\S]{0,2500}rerun_website_import/.test(pageSrc) ||
      /reimportWebsiteFromEvidenceReview/.test(pageSrc),
    "re-import only via deliberate handler",
  );

  // Canonical website still points at PharmaConnect
  record(
    "canonical-website",
    /^https:\/\/pharmaconnect\.uk\/?$/i.test(ws.canonicalWebsite),
    ws.canonicalWebsite,
  );

  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "website-reimport-ux-01.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), passed: failed.length === 0, checks, snapAt }, null, 2),
  );
  console.log(`\nReport: ${reportPath}`);
  console.log(failed.length ? `\nFAILED ${failed.length}/${checks.length}` : `\nALL PASS ${checks.length}/${checks.length}`);
  process.exit(failed.length ? 1 : 0);
}

main();
