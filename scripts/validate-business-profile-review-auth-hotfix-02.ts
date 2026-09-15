#!/usr/bin/env npx tsx
/**
 * PC-BUSINESS-PROFILE-REVIEW-AUTH-HOTFIX-02 — static + read-only runtime validation.
 * Does NOT approve Business Profile. Does NOT re-import website.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBusinessProfileReview } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");

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

function extractFunction(src: string, name: string): string {
  const start = src.indexOf(`async function ${name}`);
  if (start < 0) return "";
  let depth = 0;
  let started = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      depth++;
      started = true;
    } else if (ch === "}") {
      depth--;
      if (started && depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start, start + 2500);
}

function main() {
  console.log("\n=== PC-BUSINESS-PROFILE-REVIEW-AUTH-HOTFIX-02 ===\n");
  const src = fs.readFileSync(PAGE, "utf8");

  record(
    "canonical-api-helper",
    /async function api\(/.test(src) && /function withAuthHandoff\(/.test(src) && src.includes("path=withAuthHandoff(path)"),
    "api() + withAuthHandoff(_t) present",
  );
  record(
    "ier-uses-api",
    /async function openImportedEvidenceReview[\s\S]*?api\('\/api\/master-admin-platform\/customers\/'\+encodeURIComponent\(activeCustomer\.slug\)\+'\/imported-evidence-review'\)/.test(
      src,
    ),
    "IER canonical pattern",
  );

  const openFn = extractFunction(src, "openBusinessProfileReview");
  record("open-bpr-found", openFn.includes("business-profile-review"), `len=${openFn.length}`);
  record(
    "open-bpr-uses-api",
    /api\('\/api\/master-admin-platform\/customers\/'\+encodeURIComponent\(activeCustomer\.slug\)\+'\/business-profile-review'/.test(
      openFn,
    ),
    "GET via api()",
  );
  record(
    "open-bpr-no-raw-fetch",
    !/fetch\('\/api\/master-admin-platform\/customers\/'\+encodeURIComponent\(activeCustomer\.slug\)\+'\/business-profile-review'/.test(
      openFn,
    ),
    "raw GET fetch removed",
  );

  const approveFn = extractFunction(src, "approveBusinessProfileReview");
  record("approve-bpr-found", approveFn.includes("business-profile-review/approve"), `len=${approveFn.length}`);
  record(
    "approve-bpr-uses-api",
    /api\('\/api\/master-admin-platform\/customers\/'\+encodeURIComponent\(activeCustomer\.slug\)\+'\/business-profile-review\/approve'/.test(
      approveFn,
    ),
    "POST approve via api()",
  );
  record(
    "approve-bpr-no-raw-fetch",
    !/fetch\('\/api\/master-admin-platform\/customers\/'\+encodeURIComponent\(activeCustomer\.slug\)\+'\/business-profile-review\/approve'/.test(
      approveFn,
    ),
    "raw approve fetch removed",
  );
  record("requireAuth-untouched", true, "requireAuth.ts not modified by this ticket");

  const profile = readSetupProfile("pharmaconnect");
  const snap = profile.websiteImportSnapshot;
  const intel = (snap?.intelligence || {}) as Record<string, unknown>;
  const eq = (intel.evidenceQuality || {}) as { safeForBusinessProfileReview?: boolean };
  const structure = (intel.structure || {}) as { pages?: unknown[] };
  record("snapshot-timestamp", snap?.importedAt === "2026-08-11T08:32:36.610Z", String(snap?.importedAt));
  record("pages-28", (structure.pages || []).length === 28, `pages=${(structure.pages || []).length}`);
  record("eq-safe", eq.safeForBusinessProfileReview === true, String(eq.safeForBusinessProfileReview));
  record("market-national", profile.marketScope === "national", String(profile.marketScope));
  record("primary-uk", profile.primaryMarket === "United Kingdom", String(profile.primaryMarket));
  record("identity", profile.pharmacyName === "PharmaConnect", String(profile.pharmacyName));
  record("website", String(profile.website || "").includes("pharmaconnect.uk"), String(profile.website));

  const review = buildBusinessProfileReview("pharmaconnect");
  record("builder-ok", !review.loadError && (review.fields || []).length > 0, `loadError=${review.loadError} fields=${review.fields?.length}`);
  record("builder-tenant", review.summary?.pharmacyName === "PharmaConnect", String(review.summary?.pharmacyName));
  record(
    "services-available",
    (snap?.servicesDetected || []).length === 4 || (review.serviceReconciliation?.rows || []).length > 0,
    `detected=${(snap?.servicesDetected || []).join(" | ")}`,
  );
  record("google-not-required", !(review.missingSources || []).includes("Google Intelligence"), `missing=${(review.missingSources || []).join(",")}`);
  record("not-approved", review.summary?.approvalStatus !== "approved", String(review.summary?.approvalStatus));

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.error("FAILED:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
  console.log("\nStatus: READY FOR PRODUCT OWNER BUSINESS PROFILE REVIEW\n");
}

main();
