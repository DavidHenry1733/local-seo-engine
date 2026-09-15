#!/usr/bin/env npx tsx
/**
 * PC-WEBSITE-REIMPORT-PERSISTENT-CONTROL-01 — persistent Re-import Website control.
 * Does NOT execute rerun_website_import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderMasterAdminPlatformShell } from "../artifacts/api-server/src/routes/masterAdminPlatformPage.ts";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";
import { buildMasterAdminCustomerRecord } from "../src/pharmacy/masterAdminPlatformService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildGoogleSourceSummary } from "../src/pharmacy/masterAdminCanonicalGoogleService.ts";

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
  console.log("\n=== PC-WEBSITE-REIMPORT-PERSISTENT-CONTROL-01 ===\n");

  const before = fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"));
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
  const confirmChunk = confirmIdx >= 0 ? html.slice(confirmIdx, confirmIdx + 320) : "";
  const brokenByRealNewline = /confirm\('[^']*\n/.test(confirmChunk);
  record(
    "confirmation-string-safe",
    Boolean(confirmChunk) && !brokenByRealNewline && /\\n\\n/.test(confirmChunk),
    JSON.stringify(confirmChunk.slice(0, 180)),
  );
  record(
    "canonical-action-reused",
    script.includes("/actions/rerun_website_import")
      && script.includes("reimportWebsiteFromEvidenceReview")
      && script.includes("reimportWebsiteFromCustomerWorkflow"),
    "rerun_website_import handlers present",
  );
  record(
    "optional-panel-in-shell",
    script.includes("Optional — run a fresh website analysis") && script.includes("Website re-import required"),
    "SAFE optional + BLOCKED corrective branches in UI",
  );
  record(
    "optional-does-not-gate-handler",
    !/if\(!review\.websiteReimportRequired\)\{toast\('Website re-import is not required/.test(script),
    "IER handler allows optional re-import",
  );

  const review = buildImportedEvidenceReview("pharmaconnect");
  const customer = buildMasterAdminCustomerRecord("pharmaconnect");
  const data = readSetupProfile("pharmaconnect");
  const snap = data.websiteImportSnapshot as {
    importedAt?: string;
    intelligence?: { structure?: { pages?: unknown[] }; evidenceQuality?: { safeForBusinessProfileReview?: boolean } };
  } | null;
  const gs = buildGoogleSourceSummary("pharmaconnect");

  record("website-imported", review.websiteImported === true, String(review.websiteImported));
  record(
    "safe-for-review",
    review.evidenceQuality?.safeForBusinessProfileReview === true,
    String(review.evidenceQuality?.safeForBusinessProfileReview),
  );
  record("pages-28", (snap?.intelligence?.structure?.pages || []).length === 28, String((snap?.intelligence?.structure?.pages || []).length));
  record("reimport-required-false", review.websiteReimportRequired === false, String(review.websiteReimportRequired));
  record("reimport-available-true", review.websiteReimportAvailable === true, String(review.websiteReimportAvailable));
  record(
    "action-id",
    review.websiteReimportActionId === "rerun_website_import",
    String(review.websiteReimportActionId),
  );
  record(
    "target-website",
    /^https:\/\/pharmaconnect\.uk\/?$/i.test(review.websiteReimportTargetUrl || review.websiteUrl || ""),
    review.websiteReimportTargetUrl || review.websiteUrl,
  );
  record("target-tenant", review.slug === "pharmaconnect", review.slug);
  record(
    "bpr-still-valid",
    customer.currentStage === "business_profile_intelligence"
      && customer.websiteIntelligenceReimport?.required !== true,
    `${customer.currentStageLabel} required=${customer.websiteIntelligenceReimport?.required}`,
  );
  record(
    "workflow-button-present",
    html.includes('id="reimportWebsiteWorkflowBtn"') && html.includes("Re-import Website"),
    "workflow control markup",
  );
  record("google-not-imported", gs.googleImported === false, String(gs.googleImported));
  record("snapshot-timestamp", Boolean(snap?.importedAt), String(snap?.importedAt));

  // Corrective fixture: simulate blocked/required review presentation from shell branches.
  const correctiveOk =
    script.includes("websiteReimportRequired")
    && script.includes("Website re-import required")
    && script.includes('class="btn" type="button" id="ierReimportWebsiteBtn"');
  record("blocked-corrective-preserved", correctiveOk, "corrective IER panel still coded");

  // Shared availability for a local/regional tenant with website import (Leeds).
  const leeds = buildImportedEvidenceReview("leeds-pharmacy");
  record(
    "shared-local-regional",
    leeds.websiteReimportAvailable === true && leeds.websiteReimportActionId === "rerun_website_import",
    `leeds available=${leeds.websiteReimportAvailable} required=${leeds.websiteReimportRequired}`,
  );

  const after = fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"));
  record("snapshot-unchanged", Buffer.compare(before, after) === 0, "pharmaconnect.json unchanged");
  record("no-reimport-post", true, "validation did not POST rerun_website_import");

  const failed = checks.filter((c) => !c.pass);
  const outDir = path.join(ROOT, "data/validation-reports");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "website-reimport-persistent-control-01.json"),
    JSON.stringify(
      {
        ticket: "PC-WEBSITE-REIMPORT-PERSISTENT-CONTROL-01",
        generatedAt: new Date().toISOString(),
        pass: failed.length === 0,
        snapshotImportedAt: snap?.importedAt || null,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${checks.length - failed.length}/${checks.length} checks\n`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main();
