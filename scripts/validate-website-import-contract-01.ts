/**
 * Website import success, partial, and failure share one contract.
 * A stored snapshot is not a successful import.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { normalizeProfileData, type WebsiteImportSnapshot } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildWebsiteSourceSummary, archiveWebsiteImportSnapshot } from "../src/pharmacy/masterAdminCanonicalWebsiteService.ts";
import {
  classifyWebsiteImportContract,
  resolveCanonicalWebsiteImportWorkflowState,
} from "../src/pharmacy/masterAdminWebsiteImportWorkflowStateService.ts";
import { buildCustomerCanonicalStatuses } from "../src/pharmacy/masterAdminCanonicalStatusService.ts";
import { fetchBrandSourceDocument } from "../src/generator/brandImporter.ts";

const failures: string[] = [];
const SLUGS = [
  "website-import-contract-success",
  "website-import-contract-failed",
  "website-import-contract-partial",
  "website-import-contract-stale",
  "website-import-contract-retry",
  "website-import-contract-isolated",
];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
}

function shaFile(rel: string): string {
  const file = path.join(WORKSPACE_ROOT, rel);
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function snap(partial: Partial<WebsiteImportSnapshot>): WebsiteImportSnapshot {
  return {
    status: "not_found",
    importedAt: "2026-09-28T08:18:39.317Z",
    message: "",
    websiteUrl: "https://example-pharmacy.test",
    logoUrl: "",
    brandPrimaryColor: "",
    brandSecondaryColor: "",
    brandAccentColor: "",
    brandBackgroundColor: "",
    brandTextColor: "",
    phone: "",
    email: "",
    address: "",
    town: "",
    postcode: "",
    socialLinks: [],
    footerLinks: [],
    servicesDetected: [],
    customerVisibleServices: [],
    description: "",
    openingHours: "",
    intelligence: null,
    ...partial,
  };
}

function writeFixture(slug: string, websiteSnap: WebsiteImportSnapshot | null): void {
  writeSetupProfile(slug, normalizeProfileData({
    pharmacyName: "Contract Fixture Pharmacy",
    website: "https://example-pharmacy.test",
    websiteImportSnapshot: websiteSnap,
  }));
}

function cleanup(): void {
  for (const slug of SLUGS) {
    for (const rel of [
      `data/pharmacy-profiles/${slug}.json`,
      `data/pharmacy-master-admin/website-import-history/${slug}.json`,
    ]) {
      const file = path.join(WORKSPACE_ROOT, rel);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}

async function assertFetchRetriesAfterTimeout(): Promise<void> {
  let attempts = 0;
  const server = http.createServer((req, res) => {
    attempts += 1;
    if (attempts === 1) return;
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html><title>Imported</title></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const result = await fetchBrandSourceDocument(`http://127.0.0.1:${port}/`, 100_000, 300);
    assert(attempts === 2, "timed-out homepage fetch is retried once");
    assert(result.body.includes("Imported"), "retry returns the completed homepage");
    assert(result.status === 200, "retry status is the successful response");
  } finally {
    server.close();
  }
}

async function main(): Promise<void> {
  const protectedFiles = [
    "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
    "data/pharmacy-profiles/pharmaconnect-e2e-test-pharmacy.json",
    "data/pharmacy-profiles/brook-pharmacy.json",
    "data/pharmacy-profiles/leeds-pharmacy.json",
  ];
  const before = Object.fromEntries(protectedFiles.map((rel) => [rel, shaFile(rel)]));
  cleanup();

  writeFixture("website-import-contract-success", snap({
    status: "imported",
    message: "Website Intelligence imported.",
    phone: "01000000000",
    servicesDetected: ["pharmacy-first"],
  }));
  const success = buildWebsiteSourceSummary("website-import-contract-success");
  const successContract = classifyWebsiteImportContract("website-import-contract-success", {
    websiteImportSnapshot: success.importedEvidence,
  });
  assert(success.websiteStatus === "IMPORTED", "A. successful import status is IMPORTED");
  assert(success.websiteImported === true, "A. successful import websiteImported is yes");
  assert(successContract.downstreamReady === true, "A. successful import is downstream ready");
  assert(resolveCanonicalWebsiteImportWorkflowState("website-import-contract-success").progressLabel === "Completed", "A. workflow label is Completed");

  writeFixture("website-import-contract-failed", snap({
    status: "not_found",
    message: "Website import incomplete. Could not fetch https://example-pharmacy.test: Request timed out",
  }));
  const failed = buildWebsiteSourceSummary("website-import-contract-failed");
  const failedContract = classifyWebsiteImportContract("website-import-contract-failed", {
    websiteImportSnapshot: failed.importedEvidence,
  });
  assert(failed.websiteStatus === "FAILED", "B. timed-out import status is FAILED");
  assert(failed.websiteImported === false, "B. timed-out import is not websiteImported");
  assert(failed.importEvidenceUrl === null, "B. timed-out import does not present a successful evidence URL");
  assert(failedContract.downstreamReady === false, "B. timed-out import is not downstream ready");
  assert(resolveCanonicalWebsiteImportWorkflowState("website-import-contract-failed").progressLabel === "Failed", "B. workflow label is Failed");
  assert(
    resolveCanonicalWebsiteImportWorkflowState("website-import-contract-failed").importState === "failed",
    "B. workflow import state is failed",
  );

  writeFixture("website-import-contract-partial", snap({
    status: "needs_review",
    message: "Website import incomplete. You can continue with Google Profile only.",
    phone: "01000000001",
  }));
  const partial = buildWebsiteSourceSummary("website-import-contract-partial");
  assert(partial.websiteStatus === "PARTIAL", "C. partial import status is PARTIAL");
  assert(partial.websiteImported === false, "C. partial import is not websiteImported");
  assert(classifyWebsiteImportContract("website-import-contract-partial", {
    websiteImportSnapshot: partial.importedEvidence,
  }).downstreamReady === false, "C. partial import is not downstream ready");
  assert(resolveCanonicalWebsiteImportWorkflowState("website-import-contract-partial").progressLabel === "Partial", "C. workflow label is Partial");

  writeFixture("website-import-contract-stale", snap({
    status: "not_found",
    message: "Website import incomplete. Could not fetch https://example-pharmacy.test: Request timed out",
    importedAt: "2026-09-28T09:00:00.000Z",
  }));
  const historyFile = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/website-import-history/website-import-contract-stale.json");
  fs.mkdirSync(path.dirname(historyFile), { recursive: true });
  fs.writeFileSync(historyFile, JSON.stringify({
    slug: "website-import-contract-stale",
    entries: [{
      archivedAt: "2026-09-01T00:00:00.000Z",
      reason: "older successful import",
      canonicalWebsite: "https://example-pharmacy.test",
      snapshot: snap({ status: "imported", message: "Website Intelligence imported.", phone: "01000000002" }),
    }],
  }));
  const stale = buildWebsiteSourceSummary("website-import-contract-stale");
  assert(stale.websiteStatus === "FAILED", "D. current failed attempt is FAILED");
  assert(stale.websiteImported === false, "D. older success is not the current imported flag");
  assert(stale.importHistory.some((entry) => entry.snapshot.status === "imported"), "D. older success remains in history");
  assert(String(stale.importedEvidence?.message || "").includes("Request timed out"), "D. current evidence is the failed attempt");

  writeFixture("website-import-contract-retry", snap({
    status: "not_found",
    message: "Website import incomplete. Could not fetch https://example-pharmacy.test: Request timed out",
  }));
  archiveWebsiteImportSnapshot("website-import-contract-retry", "Re-run Website Import — previous snapshot archived");
  writeFixture("website-import-contract-retry", snap({
    status: "imported",
    message: "Website Intelligence imported.",
    phone: "01000000003",
    importedAt: "2026-09-28T10:00:00.000Z",
  }));
  const retried = buildWebsiteSourceSummary("website-import-contract-retry");
  assert(retried.websiteStatus === "IMPORTED", "E. retry current state is IMPORTED");
  assert(retried.websiteImported === true, "E. retry downstream flag is imported");
  assert(retried.importHistory.some((entry) => String(entry.snapshot.message || "").includes("Request timed out")), "E. failed attempt remains auditable");
  assert(!String(retried.lastImportMessage || "").includes("Request timed out"), "E. stale failure is not the current message");

  writeFixture("website-import-contract-isolated", snap({
    status: "not_found",
    message: "Website import incomplete. Could not fetch https://other-pharmacy.test: Request timed out",
    websiteUrl: "https://other-pharmacy.test",
  }));
  const isolatedSuccess = buildWebsiteSourceSummary("website-import-contract-success");
  const isolatedFailed = buildWebsiteSourceSummary("website-import-contract-isolated");
  assert(isolatedSuccess.websiteStatus === "IMPORTED" && isolatedFailed.websiteStatus === "FAILED", "F. tenants do not share import status");
  assert(isolatedSuccess.canonicalWebsite === "https://example-pharmacy.test", "F. success tenant keeps its own website");
  assert(String(isolatedFailed.importedEvidence?.websiteUrl || "") === "https://other-pharmacy.test", "F. failed tenant keeps its own website");

  const canonical = buildCustomerCanonicalStatuses("website-import-contract-success").find((row) => row.key === "website_import");
  assert(!canonical || canonical.state === "IMPORTED" || canonical.state === "NOT CONFIGURED", "canonical reader does not invent a status for an unregistered fixture");

  await assertFetchRetriesAfterTimeout();

  for (const rel of protectedFiles) {
    assert(shaFile(rel) === before[rel], `protected file unchanged: ${rel}`);
  }

  cleanup();
  if (failures.length) {
    console.log(`FAILED ${failures.length}`);
    process.exit(1);
  }
  console.log("ALL PASS");
}

main().catch((err) => {
  cleanup();
  console.error(err);
  process.exit(1);
});
