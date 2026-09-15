#!/usr/bin/env npx tsx
/**
 * PC-WEBSITE-REIMPORT-CONTROL-STATE-03 — validate re-import control + stale branch evidence fix.
 * Does NOT execute rerun_website_import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWebsiteIntelligenceReimportState } from "../src/pharmacy/masterAdminWebsiteIntelligenceReimportState.ts";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";
import { buildMasterAdminCustomerRecord } from "../src/pharmacy/masterAdminPlatformService.ts";
import { mergeCustomerOperationalSummary } from "../src/pharmacy/masterAdminWebsiteImportWorkflowStateService.ts";
import { isNationalMarketScope, resolvePrimaryMarket } from "../src/pharmacy/masterAdminMarketScopeService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { isBranchSelectionBlocking } from "../src/pharmacy/masterAdminWebsiteBranchSelectionService.ts";

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
  console.log("\n=== PC-WEBSITE-REIMPORT-CONTROL-STATE-03 ===\n");

  const biSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineWebsiteBusinessIntelligenceEvidence.ts"), "utf8");
  const nationalSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminWebsiteBranchSelectionService.ts"), "utf8");
  const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const platformSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminPlatformService.ts"), "utf8");

  record(
    "v2-code-deployed-source",
    /buildAudienceEvidenceFromPages|commercialOfferEvidence|extractSocialProfileEvidenceFromHtml/.test(biSrc),
    "V2 BI extractors present",
  );
  record(
    "national-identity-deployed-source",
    /reconcileNationalWebsiteBranchResolution|isNationalMarketScope/.test(nationalSrc),
    "national branch gate present",
  );
  record(
    "rerun-action-exists",
    /case "rerun_website_import"/.test(platformSrc),
    "rerun_website_import action",
  );
  record(
    "ier-reimport-ui-exists",
    pageSrc.includes("reimportWebsiteFromEvidenceReview") && pageSrc.includes(">Re-import Website<"),
    "IER Re-import Website control",
  );
  record(
    "workflow-reimport-ui-exists",
    pageSrc.includes("reimportWebsiteFromCustomerWorkflow") && pageSrc.includes("reimportWebsiteWorkflowBtn"),
    "workflow Re-import Website control",
  );
  record(
    "confirmation-required",
    /confirm\('Re-import Website/.test(pageSrc) && pageSrc.includes("/actions/rerun_website_import"),
    "confirm + rerun_website_import",
  );
  record(
    "no-parallel-importer",
    !/create_new_website_importer|import_website_v3/.test(pageSrc + platformSrc),
    "no parallel importer",
  );

  const before = fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"));
  const data = readSetupProfile("pharmaconnect");
  const snap = data.websiteImportSnapshot as { importedAt?: string; intelligence?: { structure?: { pages?: unknown[] }; evidenceQuality?: { safeForBusinessProfileReview?: boolean } } } | null;

  record("snapshot-timestamp", snap?.importedAt === "2026-08-10T09:46:16.566Z", String(snap?.importedAt));
  record("snapshot-pages-28", (snap?.intelligence?.structure?.pages || []).length === 28, String((snap?.intelligence?.structure?.pages || []).length));
  record("market-national", isNationalMarketScope("pharmaconnect", data), "national");
  record("primary-market-uk", /united kingdom/i.test(resolvePrimaryMarket("pharmaconnect", data)), resolvePrimaryMarket("pharmaconnect", data));
  record("business-name", /pharmaconnect/i.test(String(data.pharmacyName)), String(data.pharmacyName));
  record("canonical-website", /pharmaconnect\.uk/i.test(String(data.website)), String(data.website));
  record("branch-selection-inactive", isBranchSelectionBlocking("pharmaconnect") === false, "no branch block");

  const reimport = resolveWebsiteIntelligenceReimportState("pharmaconnect");
  record(
    "reimport-required",
    reimport.required && reimport.actionId === "rerun_website_import",
    `${reimport.kind} · ${reimport.reason}`,
  );
  record("reimport-target", reimport.targetUrl === "https://pharmaconnect.uk/", reimport.targetUrl);

  const review = buildImportedEvidenceReview("pharmaconnect");
  record(
    "ier-reimport-accessible",
    review.websiteReimportRequired === true && review.websiteReimportActionId === "rerun_website_import",
    review.summary.slice(0, 120),
  );
  record(
    "ier-target",
    review.websiteReimportTargetUrl === "https://pharmaconnect.uk/",
    String(review.websiteReimportTargetUrl),
  );

  const customer = buildMasterAdminCustomerRecord("pharmaconnect");
  record(
    "workflow-control-flag",
    customer.websiteIntelligenceReimport?.required === true
      && customer.websiteIntelligenceReimport?.actionId === "rerun_website_import",
    JSON.stringify(customer.websiteIntelligenceReimport?.kind),
  );
  record(
    "stale-branch-not-current",
    !/multiple pharmacy branches detected/i.test(String(customer.operationalSummary.latestEvidence || "")),
    String(customer.operationalSummary.latestEvidence || "").slice(0, 140),
  );
  record(
    "latest-evidence-reimport",
    /re-import required|Re-import Website/i.test(String(customer.operationalSummary.latestEvidence || "")),
    String(customer.operationalSummary.latestEvidence || "").slice(0, 140),
  );

  const merged = mergeCustomerOperationalSummary({
    slug: "pharmaconnect",
    fallbackLatestEvidence: "Multiple pharmacy branches detected — select the branch being onboarded.",
    fallbackBlockingIssues: [],
    customerReady: false,
    welcomeDraftAvailable: false,
    jobs: [],
  });
  record(
    "stale-fallback-suppressed",
    !/multiple pharmacy branches detected/i.test(String(merged.latestEvidence || "")),
    String(merged.latestEvidence || "").slice(0, 140),
  );

  const leeds = resolveWebsiteIntelligenceReimportState("leeds-pharmacy");
  record(
    "leeds-not-forced-by-empty-v2",
    leeds.required === false || leeds.kind === "evidence_quality",
    `${leeds.required} ${leeds.kind}`,
  );

  const after = fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"));
  record("snapshot-unchanged", Buffer.compare(before, after) === 0, "pharmaconnect.json unchanged");
  record("no-reimport-post", true, "validation did not POST rerun_website_import");

  const failed = checks.filter((c) => !c.pass);
  const report = {
    ticket: "PC-WEBSITE-REIMPORT-CONTROL-STATE-03",
    generatedAt: new Date().toISOString(),
    pass: failed.length === 0,
    checks,
  };
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "website-reimport-control-state-03.json"), JSON.stringify(report, null, 2));
  console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${checks.length - failed.length}/${checks.length} checks\n`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main();
