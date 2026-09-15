/**
 * BLOOD-PRESSURE-REVIEW-TRUST-COMPLETION-19 validation.
 * Fixtures/local only — no provider calls.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;

const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "blood-pressure-checks";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
const fetchCalls: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  fetchCalls.push(String(input));
  throw new Error(`Unexpected external request: ${String(input)}`);
}) as typeof fetch;

function record(name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function sha(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function main(): Promise<void> {
  console.log("\n=== BLOOD-PRESSURE-REVIEW-TRUST-COMPLETION-19 ===\n");

  const { loadContentPackage } = await import("../src/pharmacy/pharmacyContentPackageService.ts");
  const { loadReviewTrustPack } = await import("../src/pharmacy/pharmacyReviewTrustPackService.ts");
  const { buildPharmacyWideServiceOpportunityAssessment } = await import(
    "../src/pharmacy/growthEngineServiceOpportunityEvidence.ts"
  );

  const bp = loadContentPackage(SLUG, SERVICE);
  const pf = loadContentPackage(SLUG, "pharmacy-first");
  const rt = bp?.assets.find((a) => a.type === "review-trust");
  const pack = loadReviewTrustPack(SLUG, SERVICE);

  record("01-review-trust-required-true", rt?.required === true, String(rt?.required));
  record("02-review-trust-included-true", rt?.included === true && rt?.status === "included", String(rt?.included));
  record(
    "03-all-required-included",
    Boolean(bp?.assets.filter((a) => a.required).every((a) => a.included)),
    JSON.stringify(bp?.assets.filter((a) => a.required).map((a) => a.type)),
  );

  const assessment = buildPharmacyWideServiceOpportunityAssessment(SLUG);
  const bpRow = assessment.services.find((s) => s.serviceId === SERVICE);
  const pfRow = assessment.services.find((s) => s.serviceId === "pharmacy-first");
  record("04-bp-workflow-review-generated-package", bpRow?.workflowAction === "review-generated-package", bpRow?.workflowAction);
  record(
    "05-pf-still-complete-generated-package",
    pfRow?.workflowAction === "complete-generated-package",
    pfRow?.workflowAction,
  );

  const packages = fs.readdirSync(path.join(ROOT, "data/pharmacy-content-packages", SLUG));
  record("06-only-bp-and-pf-packages", packages.length === 2 && packages.includes("pharmacy-first.json"), packages.join(","));

  record("07-pack-uses-confirmed-evidence", Boolean(pack?.pharmacy.name && pack.evidenceStatus.pharmacyIdentity === "confirmed"), pack?.pharmacy.name);
  record("08-no-invented-reviewer", pack?.reviewer === null && pack?.evidenceStatus.reviewer === "unavailable", String(pack?.reviewer));
  record(
    "09-existing-assets-present",
    Boolean(
      bp?.assets.find((a) => a.type === "service-page")?.included &&
        bp?.assets.find((a) => a.type === "faq")?.included &&
        bp?.assets.find((a) => a.type === "guides")?.included &&
        bp?.assets.find((a) => a.type === "blog")?.included &&
        bp?.assets.find((a) => a.type === "images")?.included &&
        bp?.assets.find((a) => a.type === "local-area-pages")?.included,
    ),
    "ok",
  );

  record("10-approval-pending", bp?.approvalStatus === "pending" && !bp.approvedAt, bp?.approvalStatus);
  record("11-no-external-calls", fetchCalls.length === 0, "none");

  const pfHashExpected = "10bb8ad3ebd07048c53f9e290b15d64b859b66976c107d8d1c7034ff729eac02";
  record("12-pf-package-hash-unchanged", sha(`data/pharmacy-content-packages/${SLUG}/pharmacy-first.json`) === pfHashExpected, "ok");

  const protectedOk =
    sha(`data/growth-engine/${SLUG}-service-search-demand.json`) ===
      "894140539a2cc6237ab6ff3b2ee1c2af241a40fc0f070d9d02a6ca8392b194a4" &&
    sha(`data/national-growth-engine/${SLUG}-competitor-discovery.json`) ===
      "c665daa679675d3352b51c8f14ae004fcee03370adf1a1312d7812e5d7409ea2" &&
    sha(`data/growth-engine/${SLUG}-opportunities.json`) ===
      "4a97fe44edd785094d24eb16ba01bb7d420fc40071b2098c696dbea9fa93d189";
  record("13-demand-serp-gi-unchanged", protectedOk, "ok");

  const passed = steps.filter((s) => s.passed).length;
  const failed = steps.filter((s) => !s.passed).length;
  console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${steps.length} checks\n`);
  globalThis.fetch = originalFetch;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
