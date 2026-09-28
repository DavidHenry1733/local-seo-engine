/**
 * Canonical website evidence is what Imported Evidence Review and the import contract read.
 * Google values are not copied into website evidence.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyServiceLibraryService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { archiveWebsiteImportSnapshot } from "../src/pharmacy/masterAdminCanonicalWebsiteService.ts";
import { classifyWebsiteImportContract } from "../src/pharmacy/masterAdminWebsiteImportWorkflowStateService.ts";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";

const failures: string[] = [];
const SLUGS = [
  "website-evidence-complete",
  "website-evidence-missing-field",
  "website-evidence-failed",
  "website-evidence-equivalent",
  "website-evidence-disagree",
  "website-evidence-reimport",
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

function field(selected: string, sourceUrl = "https://example-pharmacy.test/contact-us") {
  return {
    selected,
    confidence: selected ? 90 : 0,
    candidates: [],
    evidence: selected
      ? { sourceUrl, detectionMethod: "contact-page", confidence: 90, detectedAt: "2026-09-28T00:00:00.000Z", matchedSnippet: selected }
      : null,
  };
}

function intelligence(input: {
  pages?: number;
  name?: string;
  address?: string;
  town?: string;
  postcode?: string;
  phone?: string;
  snippet?: string;
}) {
  return {
    version: 2,
    importedAt: "2026-09-28T00:00:00.000Z",
    identity: { title: "Example Pharmacy", websiteUrl: "https://example-pharmacy.test", resolvedUrl: "https://example-pharmacy.test/" },
    business: {
      businessName: field(input.name || ""),
      phone: field(input.phone || ""),
      email: field(""),
      address: field(input.address || ""),
      town: field(input.town || ""),
      postcode: field(input.postcode || ""),
      openingHours: field(""),
      addressCandidates: input.address
        ? [{
          addressLine1: input.address,
          addressLine2: "",
          town: input.town || "Exampleford",
          postcode: input.postcode || "PA1 1AA",
          sourceUrl: "https://example-pharmacy.test/contact-us",
          sourceType: "contact-page",
          matchedSnippet: input.snippet || `${input.name || "Example Pharmacy"}, ${input.address}, ${input.town || "Exampleford"}, ${input.postcode || "PA1 1AA"}`,
          confidence: 82,
        }]
        : [],
    },
    structure: {
      totalPages: input.pages || 1,
      pages: Array.from({ length: input.pages || 1 }, (_, index) => ({
        url: `https://example-pharmacy.test/page-${index}`,
        path: `/page-${index}`,
        title: "Example",
        category: index === 0 ? "homepage" : "service",
      })),
    },
  };
}

function writeFixture(slug: string, snapshot: Record<string, unknown>, google?: Record<string, unknown>): void {
  writeSetupProfile(slug, normalizeProfileData({
    pharmacyName: "Example Pharmacy",
    website: "https://example-pharmacy.test",
    websiteImportSnapshot: snapshot,
    googleImportSnapshot: google || null,
  }));
}

function row(review: ReturnType<typeof buildImportedEvidenceReview>, id: string) {
  return review.websiteEvidence.find((item) => item.id === id);
}

function comparison(review: ReturnType<typeof buildImportedEvidenceReview>, label: string) {
  return review.comparison.find((item) => item.label === label);
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

function main(): void {
  const gilbertRel = "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json";
  const before = shaFile(gilbertRel);
  cleanup();

  writeFixture("website-evidence-complete", {
    status: "imported",
    importedAt: "2026-09-28T00:00:00.000Z",
    message: "Website Intelligence imported.",
    websiteUrl: "https://example-pharmacy.test",
    intelligence: intelligence({ pages: 4, name: "Example Pharmacy", address: "1 High Street", town: "Exampleford", postcode: "PA1 1AA", phone: "0141 111 1111" }),
  });
  const complete = buildImportedEvidenceReview("website-evidence-complete");
  const completeContract = classifyWebsiteImportContract("website-evidence-complete", {
    websiteImportSnapshot: complete.websiteEvidence ? { status: "imported" } : null,
  });
  assert(classifyWebsiteImportContract("website-evidence-complete", JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles/website-evidence-complete.json"), "utf8")).data).state === "imported", "A. completed crawl contract is imported");
  assert(complete.websiteImported === true, "A. website imported is yes");
  assert(row(complete, "business-name")?.value === "Example Pharmacy", "A. business name has website provenance");
  assert(row(complete, "address")?.extractionMethod !== "google-places", "A. address method is not Google");
  assert(row(complete, "phone")?.value === "0141 111 1111", "A. phone is populated");
  void completeContract;

  writeFixture("website-evidence-missing-field", {
    status: "needs_review",
    importedAt: "2026-09-28T00:00:00.000Z",
    message: "Website import incomplete.",
    websiteUrl: "https://example-pharmacy.test",
    intelligence: intelligence({
      pages: 3,
      address: "1 High Street",
      town: "Exampleford",
      postcode: "PA1 1AA",
      snippet: "Example Pharmacy, 1 High Street, Exampleford, PA1 1AA",
    }),
  }, {
    status: "imported",
    importedAt: "2026-09-28T00:00:00.000Z",
    businessName: "Example Pharmacy",
    address: "1 High Street",
    postcode: "PA1 1AA",
    phone: "0999 999 9999",
    website: "https://example-pharmacy.test",
  });
  const missing = buildImportedEvidenceReview("website-evidence-missing-field");
  const missingData = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles/website-evidence-missing-field.json"), "utf8")).data;
  assert(classifyWebsiteImportContract("website-evidence-missing-field", missingData).websiteImported === true, "B. crawl with a missing field stays imported");
  assert(row(missing, "phone")?.value === "Not Found", "B. missing website phone stays Not Found");
  assert(row(missing, "phone")?.value !== "0999 999 9999", "B. Google phone is not copied into website evidence");
  assert(row(missing, "address")?.value === "1 High Street", "B. website address still comes from the website candidate");

  writeFixture("website-evidence-failed", {
    status: "not_found",
    importedAt: "2026-09-28T00:00:00.000Z",
    message: "Website import incomplete. Could not fetch https://example-pharmacy.test: Request timed out",
    websiteUrl: "https://example-pharmacy.test",
    intelligence: null,
  });
  const failedData = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles/website-evidence-failed.json"), "utf8")).data;
  const failedContract = classifyWebsiteImportContract("website-evidence-failed", failedData);
  const failedReview = buildImportedEvidenceReview("website-evidence-failed");
  assert(failedContract.state === "failed" && failedContract.websiteImported === false, "C. timed-out crawl is failed");
  assert(failedReview.websiteImported === false, "C. failed crawl is not website imported");
  assert(row(failedReview, "business-name")?.value === "Not Found", "C. failed crawl does not invent a business name");
  writeFixture("website-evidence-failed", {
    status: "not_found",
    importedAt: "2026-09-28T00:00:00.000Z",
    message: "Website import incomplete. Could not fetch https://example-pharmacy.test: Request timed out",
    websiteUrl: "https://example-pharmacy.test",
    intelligence: intelligence({ pages: 4, name: "Leftover Pharmacy", address: "1 High Street", town: "Exampleford", postcode: "PA1 1AA", phone: "0141 111 1111" }),
  });
  const leftover = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles/website-evidence-failed.json"), "utf8")).data;
  assert(classifyWebsiteImportContract("website-evidence-failed", leftover).state === "failed", "C. stored pages do not turn a timed-out crawl into success");
  assert(buildImportedEvidenceReview("website-evidence-failed").websiteImported === false, "C. leftover artifact is not website imported");

  writeFixture("website-evidence-equivalent", {
    status: "imported",
    importedAt: "2026-09-28T00:00:00.000Z",
    message: "Website Intelligence imported.",
    websiteUrl: "https://example-pharmacy.test",
    intelligence: intelligence({
      pages: 2,
      name: "Example Pharmacy",
      address: "4 Blackford Road",
      town: "Paisley",
      postcode: "PA2 7EP",
      phone: "0141 737 3133",
    }),
  }, {
    status: "imported",
    importedAt: "2026-09-28T00:00:00.000Z",
    businessName: "Example Pharmacy",
    address: "4 Blackford Rd, Paisley PA2 7EP, UK",
    postcode: "PA27EP",
    phone: "0141 737 3133",
    website: "https://www.example-pharmacy.test/",
  });
  const equivalent = buildImportedEvidenceReview("website-evidence-equivalent");
  assert(comparison(equivalent, "Website")?.matchStatus === "match", "D. www and non-www websites match");
  assert(comparison(equivalent, "Postcode")?.matchStatus === "match", "D. spaced and compact postcodes match");
  assert(comparison(equivalent, "Address")?.matchStatus === "match", "D. road formatting matches");
  assert(comparison(equivalent, "Phone")?.matchStatus === "match", "D. telephone formatting matches");
  assert(comparison(equivalent, "Business name")?.matchStatus === "match", "D. business names match");

  writeFixture("website-evidence-disagree", {
    status: "imported",
    importedAt: "2026-09-28T00:00:00.000Z",
    message: "Website Intelligence imported.",
    websiteUrl: "https://example-pharmacy.test",
    intelligence: intelligence({ pages: 2, name: "Example Pharmacy", address: "1 High Street", town: "Exampleford", postcode: "PA1 1AA", phone: "0141 111 1111" }),
  }, {
    status: "imported",
    importedAt: "2026-09-28T00:00:00.000Z",
    businessName: "Other Pharmacy",
    address: "20 Main Road, Otherford PA2 2BB, UK",
    postcode: "PA2 2BB",
    phone: "0141 222 2222",
    website: "https://other-pharmacy.test",
  });
  const disagree = buildImportedEvidenceReview("website-evidence-disagree");
  assert(comparison(disagree, "Business name")?.matchStatus === "difference", "E. different business names stay visible");
  assert(comparison(disagree, "Postcode")?.matchStatus === "difference", "E. different postcodes stay visible");
  assert(comparison(disagree, "Phone")?.matchStatus === "difference", "E. different phones stay visible");

  writeFixture("website-evidence-reimport", {
    status: "imported",
    importedAt: "2026-09-28T00:00:00.000Z",
    message: "old evidence",
    websiteUrl: "https://example-pharmacy.test",
    phone: "0141 000 0000",
    intelligence: intelligence({ pages: 1, name: "Old Pharmacy", address: "9 Old Road", town: "Oldford", postcode: "PA9 9ZZ", phone: "0141 000 0000" }),
  });
  archiveWebsiteImportSnapshot("website-evidence-reimport", "Re-run Website Import — previous snapshot archived");
  writeFixture("website-evidence-reimport", {
    status: "imported",
    importedAt: "2026-09-28T02:00:00.000Z",
    message: "Website Intelligence imported.",
    websiteUrl: "https://example-pharmacy.test",
    intelligence: intelligence({ pages: 2, name: "Example Pharmacy", address: "1 High Street", town: "Exampleford", postcode: "PA1 1AA", phone: "0141 111 1111" }),
  });
  const retried = buildImportedEvidenceReview("website-evidence-reimport");
  assert(row(retried, "business-name")?.value === "Example Pharmacy", "F. current evidence replaces the old name");
  assert(row(retried, "phone")?.value === "0141 111 1111", "F. stale phone is not authoritative");
  const history = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/website-import-history/website-evidence-reimport.json"), "utf8")) as { entries?: Array<{ snapshot?: { message?: string } }> };
  assert(history.entries?.some((entry) => String(entry.snapshot?.message || "").includes("old evidence")), "F. old evidence remains in history");

  const gilbert = buildImportedEvidenceReview("gilbert-pharmacy-health-clinic");
  assert(gilbert.websiteImported === true, "Gilbert website imported is yes");
  assert(row(gilbert, "business-name")?.value === "Gilbert Pharmacy & Health Clinic", "Gilbert website name comes from website evidence");
  assert(row(gilbert, "address")?.value === "4 Blackford Rd", "Gilbert website address comes from the contact page");
  assert(row(gilbert, "town")?.value === "Paisley", "Gilbert website town comes from the contact page");
  assert(row(gilbert, "postcode")?.value === "PA2 7EP", "Gilbert website postcode comes from the contact page");
  assert(row(gilbert, "phone")?.value.includes("0141"), "Gilbert website phone comes from the contact-page snippet");
  assert(row(gilbert, "address")?.sourceUrl.includes("gilbertpharmacy.co.uk"), "Gilbert address provenance is the website");
  assert(comparison(gilbert, "Business name")?.matchStatus === "match", "Gilbert business name comparison matches");
  assert(comparison(gilbert, "Address")?.matchStatus === "match", "Gilbert address comparison matches formatting");
  assert(comparison(gilbert, "Town or City")?.matchStatus === "website_only", "Gilbert town stays website-only when Google has no town");
  assert(comparison(gilbert, "Phone")?.matchStatus === "match", "Gilbert phone comparison matches");
  assert(comparison(gilbert, "Postcode")?.matchStatus === "match", "Gilbert postcode comparison matches formatting");
  assert(comparison(gilbert, "Website")?.matchStatus === "match", "Gilbert website comparison ignores www");
  assert(shaFile(gilbertRel) === before, "Gilbert profile bytes are unchanged");

  cleanup();
  if (failures.length) {
    console.log(`FAILED ${failures.length}`);
    process.exit(1);
  }
  console.log("ALL PASS");
}

main();
