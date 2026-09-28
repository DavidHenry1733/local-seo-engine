/**
 * Canonical physical branch resolution.
 * Repeated website evidence is one branch. Different addresses stay separate.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { detectMultiLocationBranches, resolvePhysicalWebsiteBranches } from "../src/pharmacy/masterAdminWebsiteBranchDetectionService.ts";
import { projectCanonicalBranchResolution, buildWebsiteBranchSelectionPayload } from "../src/pharmacy/masterAdminWebsiteBranchSelectionService.ts";
import { validateImportTenantIsolationGate } from "../src/pharmacy/masterAdminImportTenantIsolationService.ts";
import type { DetectedWebsiteBranch, WebsiteBranchResolution } from "../src/pharmacy/masterAdminWebsiteBranchResolutionModel.ts";

const failures: string[] = [];
const SLUGS = ["branch-resolution-tenant-a", "branch-resolution-tenant-b"];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
}

function shaFile(rel: string): string {
  const file = path.join(WORKSPACE_ROOT, rel);
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function branch(partial: Partial<DetectedWebsiteBranch>): DetectedWebsiteBranch {
  return {
    branchId: "",
    branchName: "Example Pharmacy",
    parentBrandName: "Example Pharmacy",
    addressLine1: "",
    addressLine2: "",
    town: "",
    postcode: "",
    phone: "",
    email: "",
    branchUrl: "https://example-pharmacy.test/",
    logoUrl: "",
    openingHours: "",
    services: [],
    googlePlaceId: null,
    googleBusinessName: null,
    googleAddress: null,
    googleMatchConfidence: null,
    evidenceSources: [{ sourceUrl: "https://example-pharmacy.test/", detectionMethod: "visible-text" }],
    detectionSignals: ["test"],
    ...partial,
  };
}

function resolution(partial: Partial<WebsiteBranchResolution>): WebsiteBranchResolution {
  return {
    status: "branch_selection_required",
    detectedAt: "2026-09-28T00:00:00.000Z",
    selectedAt: null,
    selectedBy: null,
    parentBrand: {
      tradingName: "Example Pharmacy",
      parentWebsite: "https://example-pharmacy.test",
      logoUrl: "",
      brandPrimaryColor: "",
      brandSecondaryColor: "",
      brandAccentColor: "",
    },
    detectedBranches: [],
    selectedBranchId: null,
    selectedBranch: null,
    rawImportPreserved: true,
    googleBranchMatchStatus: "pending",
    googleBranchMatchNotes: [],
    ...partial,
  };
}

function intelligence(pages: Array<{ path: string; title: string; url: string; category?: string }>) {
  return {
    identity: { title: "Example Pharmacy", resolvedUrl: "https://example-pharmacy.test/", logoUrl: "", brandPrimaryColor: "", brandSecondaryColor: "", brandAccentColor: "" },
    structure: { pages },
  } as never;
}

function cleanup(): void {
  for (const slug of SLUGS) {
    const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

function main(): void {
  const gilbertRel = "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json";
  const beforeGilbert = shaFile(gilbertRel);
  cleanup();

  const repeatedHtml = `<html><head><script type="application/ld+json">
    {"@type":"Pharmacy","name":"Example Pharmacy & Health Clinic","telephone":"01417373133","address":{"streetAddress":"4 Blackford Road","addressLocality":"Paisley","postalCode":"PA2 7EP"}}
    </script></head><body>
    <p>Example Pharmacy, 4 Blackford Rd, Paisley, PA2 7EP</p>
    <footer>Example Pharmacy & Health Clinic, 4 Blackford Road, PA2 7EP, 0141 737 3133</footer>
    </body></html>`;
  const repeated = detectMultiLocationBranches({
    websiteUrl: "https://example-pharmacy.test",
    homepageHtml: repeatedHtml,
    intelligence: intelligence([
      { path: "/contact", title: "Contact Example Pharmacy", url: "https://example-pharmacy.test/contact", category: "contact" },
      { path: "/service/pharmacy-first", title: "Pharmacy First – Example Pharmacy & Health Clinic", url: "https://example-pharmacy.test/service/pharmacy-first", category: "service" },
      { path: "/2025/11/06/what-is-pharmacy-first", title: "What is Pharmacy First and When Should I Use It? - Example Pharmacy & Health Clinic", url: "https://example-pharmacy.test/2025/11/06/what-is-pharmacy-first", category: "blog" },
    ]),
    submittedBusinessName: "Example Pharmacy & Health Clinic",
    googleCandidates: [{
      businessName: "Example Pharmacy & Health Clinic",
      address: "4 Blackford Rd, Paisley PA2 7EP, UK",
      postcode: "PA2 7EP",
      phone: "0141 737 3133",
      website: "https://example-pharmacy.test",
      placeId: "place-example-1",
      confidence: 100,
    }],
  });
  assert(repeated.detectedBranches.length === 1, "A. repeated evidence is one physical branch");
  assert(repeated.requiresSelection === false, "A. one physical branch does not require selection");
  assert(repeated.ambiguous === false, "A. repeated evidence is not ambiguous");
  assert((repeated.detectedBranches[0]?.evidenceSources.length || 0) > 1, "A. provenance from more than one source is retained");
  assert(repeated.parentBrand.tradingName === "Example Pharmacy & Health Clinic", "A. parent brand stays separate from the branch record");

  const multiHtml = `<html><body>
    <p>North Pharmacy, 1 High Street, PA1 1AA, 01411111111</p>
    <p>South Pharmacy, 20 Main Road, PA2 2BB, 01412222222</p>
    <p>West Pharmacy, 8 Church Lane, PA3 3CC, 01413333333</p>
    </body></html>`;
  const multi = detectMultiLocationBranches({
    websiteUrl: "https://example-pharmacy.test",
    homepageHtml: multiHtml,
    intelligence: intelligence([]),
    submittedBusinessName: "Example Pharmacy",
  });
  assert(multi.detectedBranches.length === 3, "B. three addresses remain three branches");
  assert(multi.requiresSelection === true, "B. genuine multi-branch requires selection");
  assert(new Set(multi.detectedBranches.map((item) => item.postcode.replace(/\s/g, ""))).size === 3, "B. postcodes were not collapsed");

  const ambiguous = resolvePhysicalWebsiteBranches([
    branch({ branchName: "North Clinic Pharmacy", phone: "0141 111 1111", evidenceSources: [{ sourceUrl: "https://example-pharmacy.test/a", detectionMethod: "visible-text" }] }),
    branch({ branchName: "South Clinic Pharmacy", phone: "0141 111 1111", evidenceSources: [{ sourceUrl: "https://example-pharmacy.test/b", detectionMethod: "visible-text" }] }),
  ]);
  assert(ambiguous.ambiguous === true && ambiguous.requiresSelection === true, "C. ambiguous records require review");
  assert(ambiguous.branches.length === 2, "C. ambiguous records are not guessed into one branch");

  writeSetupProfile("branch-resolution-tenant-a", normalizeProfileData({
    pharmacyName: "Tenant A Pharmacy",
    website: "https://tenant-a.example",
    websiteImportSnapshot: { status: "imported", importedAt: "2026-09-28T00:00:00.000Z", message: "Website Intelligence imported.", websiteUrl: "https://tenant-a.example" },
    websiteBranchResolution: resolution({
      status: "none",
      detectedBranches: [branch({ branchName: "Tenant A Pharmacy", addressLine1: "1 High Street", postcode: "PA1 1AA", phone: "0141 111 1111" })],
    }),
  }));
  writeSetupProfile("branch-resolution-tenant-b", normalizeProfileData({
    pharmacyName: "Tenant B Pharmacy",
    website: "https://tenant-b.example",
    websiteImportSnapshot: { status: "imported", importedAt: "2026-09-28T00:00:00.000Z", message: "Website Intelligence imported.", websiteUrl: "https://tenant-b.example" },
    websiteBranchResolution: resolution({
      status: "none",
      parentBrand: { tradingName: "Tenant B Pharmacy", parentWebsite: "https://tenant-b.example", logoUrl: "", brandPrimaryColor: "", brandSecondaryColor: "", brandAccentColor: "" },
      detectedBranches: [branch({ branchName: "Tenant B Pharmacy", addressLine1: "20 Main Road", postcode: "PA2 2BB", phone: "0141 222 2222", branchUrl: "https://tenant-b.example/" })],
    }),
  }));
  const gateA = validateImportTenantIsolationGate("branch-resolution-tenant-a");
  const payloadA = buildWebsiteBranchSelectionPayload("branch-resolution-tenant-a");
  const payloadB = buildWebsiteBranchSelectionPayload("branch-resolution-tenant-b");
  assert(gateA.passed === true, "D. tenant A isolation passes");
  assert(!gateA.blockers.some((item) => /tenant-b|PA2 2BB|Main Road/i.test(item)), "D. tenant B evidence is not an isolation finding for tenant A");
  assert(payloadA.resolution.detectedBranches.every((item) => item.postcode.replace(/\s/g, "") === "PA11AA"), "D. tenant A branch payload stays on tenant A");
  assert(payloadB.resolution.detectedBranches.every((item) => item.postcode.replace(/\s/g, "") === "PA22BB"), "D. tenant B branch payload stays on tenant B");

  const confirmed = branch({ branchName: "Example Pharmacy", addressLine1: "4 Blackford Road", postcode: "PA2 7EP", phone: "0141 737 3133", branchId: "confirmed-branch" });
  const kept = projectCanonicalBranchResolution(resolution({
    status: "branch_selected",
    selectedAt: "2026-09-28T01:00:00.000Z",
    selectedBy: "operator",
    selectedBranchId: "confirmed-branch",
    selectedBranch: confirmed,
    detectedBranches: [
      confirmed,
      branch({ branchName: "Example Pharmacy & Health Clinic", addressLine1: "4 Blackford Rd", postcode: "PA2 7EP", phone: "0141 737 3133", evidenceSources: [{ sourceUrl: "https://example-pharmacy.test/contact", detectionMethod: "schema.org" }] }),
    ],
  }));
  assert(kept.status === "branch_selected" && kept.selectedBranchId === "confirmed-branch", "E. unchanged physical identity keeps the confirmation");
  assert(kept.detectedBranches.length === 1, "E. re-import duplicates do not replace the confirmed branch with extra candidates");

  const changed = projectCanonicalBranchResolution(resolution({
    status: "branch_selected",
    selectedAt: "2026-09-28T01:00:00.000Z",
    selectedBy: "operator",
    selectedBranchId: "old-branch",
    selectedBranch: branch({ branchId: "old-branch", branchName: "Example Pharmacy", addressLine1: "1 High Street", postcode: "PA1 1AA", phone: "0141 111 1111" }),
    detectedBranches: [branch({ branchName: "Example Pharmacy", addressLine1: "20 Main Road", postcode: "PA2 2BB", phone: "0141 222 2222" })],
  }));
  assert(changed.status === "branch_selection_required" && changed.selectedBranch == null, "F. a changed address does not inherit the old confirmation");

  const gilbert = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, gilbertRel), "utf8")) as { data?: { websiteBranchResolution?: WebsiteBranchResolution } };
  const gilbertResolution = gilbert.data?.websiteBranchResolution;
  assert(Boolean(gilbertResolution), "Gilbert stored branch resolution is readable");
  const gilbertPhysical = gilbertResolution ? projectCanonicalBranchResolution(gilbertResolution) : null;
  assert(gilbertPhysical?.detectedBranches.length === 1, "Gilbert repeated evidence resolves to one physical branch");
  assert(gilbertPhysical?.status === "none", "Gilbert does not require a duplicate branch choice");
  assert((gilbertPhysical?.detectedBranches[0]?.evidenceSources.length || 0) >= 4, "Gilbert provenance from the original records is retained");
  const gilbertGate = validateImportTenantIsolationGate("gilbert-pharmacy-health-clinic");
  assert(gilbertGate.passed === true, "Gilbert tenant isolation is not blocked by its own repeated evidence");
  assert(shaFile(gilbertRel) === beforeGilbert, "Gilbert profile bytes are unchanged");

  cleanup();
  if (failures.length) {
    console.log(`FAILED ${failures.length}`);
    process.exit(1);
  }
  console.log("ALL PASS");
}

main();
