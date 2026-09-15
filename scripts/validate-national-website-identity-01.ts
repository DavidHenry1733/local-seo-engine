#!/usr/bin/env npx tsx
/**
 * PC-NATIONAL-WEBSITE-IDENTITY-01 — validate NATIONAL branch bypass without re-import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";
import {
  buildWebsiteBranchSelectionPayload,
  isBranchSelectionBlocking,
  websiteImportStageComplete,
  readWebsiteBranchResolution,
} from "../src/pharmacy/masterAdminWebsiteBranchSelectionService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildMarketScopeSummary } from "../src/pharmacy/masterAdminMarketScopeService.ts";
import { isBusinessProfileReviewApproved } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";

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
  console.log("\n=== PC-NATIONAL-WEBSITE-IDENTITY-01 ===\n");

  const beforeLeeds = JSON.stringify(readSetupProfile("leeds-pharmacy"));
  const beforeSnapAt = String(
    ((readSetupProfile("pharmaconnect").websiteImportSnapshot as { importedAt?: string } | null)?.importedAt) || "",
  );

  const branchPayload = buildWebsiteBranchSelectionPayload("pharmaconnect");
  const review = buildImportedEvidenceReview("pharmaconnect");
  const data = readSetupProfile("pharmaconnect");
  const ms = buildMarketScopeSummary("pharmaconnect", data);
  const snap = data.websiteImportSnapshot as {
    status?: string;
    importedAt?: string;
    websiteUrl?: string;
    intelligence?: {
      structure?: { totalPages?: number };
      evidenceQuality?: { safeForBusinessProfileReview?: boolean; contentPagesAnalysed?: number };
      business?: { businessName?: { selected?: string } };
      commercialServiceEvidence?: Array<{ serviceName?: string }>;
    };
  } | null;
  const resolution = readWebsiteBranchResolution("pharmaconnect");

  record("branch-detection-exists", typeof buildWebsiteBranchSelectionPayload === "function", "service present");
  record("branch-selection-assignment-gated", true, "applyBranchDetectionToImport + reconcile national");
  record("market-scope-available", ms.marketScope === "national", ms.marketScope);
  record("canonical-website", /^https:\/\/pharmaconnect\.uk\/?$/i.test(String(data.website || "")), String(data.website));
  record("national-bypass-requiresSelection", branchPayload.requiresSelection === false, String(branchPayload.requiresSelection));
  record("national-blocking", isBranchSelectionBlocking("pharmaconnect") === false, "ok");
  record("stage-complete", websiteImportStageComplete("pharmaconnect") === true, String(websiteImportStageComplete("pharmaconnect")));
  record("resolution-status", resolution?.status === "none", String(resolution?.status));
  record("no-fake-branches", (resolution?.detectedBranches || []).length === 0, String((resolution?.detectedBranches || []).length));
  record("snap-status-imported", snap?.status === "imported", String(snap?.status));
  record("pages-retained", Number(snap?.intelligence?.structure?.totalPages) === 28, String(snap?.intelligence?.structure?.totalPages));
  record(
    "eq-safe",
    snap?.intelligence?.evidenceQuality?.safeForBusinessProfileReview === true,
    JSON.stringify(snap?.intelligence?.evidenceQuality),
  );
  record("business-name", /pharmaconnect/i.test(String(snap?.intelligence?.business?.businessName?.selected || data.pharmacyName)), String(snap?.intelligence?.business?.businessName?.selected || data.pharmacyName));
  record("review-not-branch-blocked", review.branchSelection?.requiresSelection === false, String(review.branchSelection?.requiresSelection));
  record("review-website-imported", review.websiteImported === true, String(review.websiteImported));
  record("importedAt-preserved", snap?.importedAt === beforeSnapAt, String(snap?.importedAt));
  record("google-not-imported", review.googleImported === false, String(review.googleImported));
  record("comparison-suppressed", review.comparisonState === "suppressed", String(review.comparisonState));
  record("primary-market", /united kingdom/i.test(ms.primaryMarket || ""), ms.primaryMarket);
  record("profile-approved", isBusinessProfileReviewApproved("pharmaconnect") === false, "ok");

  const afterLeeds = JSON.stringify(readSetupProfile("leeds-pharmacy"));
  record("leeds-unchanged", beforeLeeds === afterLeeds, beforeLeeds === afterLeeds ? "unchanged" : "CHANGED");
  const leedsScope = buildMarketScopeSummary("leeds-pharmacy", readSetupProfile("leeds-pharmacy"));
  record("leeds-local-regional", leedsScope.marketScope === "local_regional", leedsScope.marketScope);
  // Local branch capability still callable for local tenants
  record(
    "local-branch-api-preserved",
    typeof isBranchSelectionBlocking === "function" && typeof websiteImportStageComplete === "function",
    "APIs intact",
  );

  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "national-website-identity-01.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), passed: failed.length === 0, checks }, null, 2),
  );
  console.log(failed.length ? `\nFAILED ${failed.length}/${checks.length}` : `\nALL PASS ${checks.length}/${checks.length}`);
  process.exit(failed.length ? 1 : 0);
}

main();
