#!/usr/bin/env npx tsx
/**
 * Canonical existing-service coverage. Temp fixtures only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const checks: Array<{ id: string; pass: boolean }> = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function shaFile(rel: string): string {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function main() {
  const protectedFiles = [
    "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
    "data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json",
  ];
  const before = Object.fromEntries(protectedFiles.map((rel) => [rel, shaFile(rel)]));
  const opportunities = path.join(ROOT, "data/growth-engine/gilbert-pharmacy-health-clinic-opportunities.json");
  const opportunitiesBefore = fs.existsSync(opportunities);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "service-coverage-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  fs.cpSync(path.join(ROOT, "config/pharmacy"), path.join(tmp, "config/pharmacy"), { recursive: true });
  process.env.WORKSPACE_ROOT = tmp;
  process.env.GOOGLE_PLACES_API_KEY = "";

  const { resolveCanonicalServiceCoverage } = await import("../src/pharmacy/canonicalExistingServiceCoverage.ts");

  const one = (pages: Array<Record<string, unknown>>, revision = "rev-a") =>
    resolveCanonicalServiceCoverage({ serviceIds: ["blood-pressure-checks"], pages, sourceRevision: revision })[0];

  const exact = one([{ category: "service-page", url: "https://example.test/service/blood-pressure-checks", title: "Blood Pressure Checks", h1: "Blood Pressure Checks" }]);
  record("1-exact-page", exact.dedicatedServicePage === "PRESENT" && exact.servicePresence === "PRESENT" && exact.servicePageUrl.endsWith("/blood-pressure-checks"), exact.dedicatedServicePage);

  const alias = one([{ category: "service-page", url: "https://example.test/service/hypertension-case-finding", title: "NHS Hypertension Case-Finding Service", h1: "NHS Hypertension Case-Finding Service" }]);
  record("2-alias-page", alias.dedicatedServicePage === "PRESENT" && alias.servicePageUrl.endsWith("/hypertension-case-finding"), alias.evidence[0]?.method || alias.dedicatedServicePage);

  const blog = one([{ category: "blog", url: "https://example.test/blog/blood-pressure", title: "Understanding blood pressure checks", h1: "Understanding blood pressure checks" }]);
  record("3-blog-not-dedicated", blog.dedicatedServicePage === "NOT_FOUND" && blog.supportingContent.length === 1 && blog.servicePresence === "NOT_FOUND", blog.dedicatedServicePage);

  const body = one([{ category: "service-page", url: "https://example.test/service/travel-health", title: "Travel Health", h1: "Travel Health", detectedServiceIds: ["blood-pressure-checks"] }]);
  record("4-body-mention-not-coverage", body.dedicatedServicePage === "NOT_FOUND" && body.servicePresence === "NOT_FOUND" && body.evidence.length === 0, body.servicePresence);

  const listing = one([{ category: "services", url: "https://example.test/services", title: "Services", h1: "Blood Pressure Checks" }]);
  record("5-listing-not-dedicated-page", listing.servicePresence === "PRESENT" && listing.dedicatedServicePage === "NOT_FOUND" && listing.servicePageUrl === "", listing.servicePresence);

  const similar = one([{ category: "service-page", url: "https://example.test/service/phlebotomy-services", title: "Phlebotomy Services", h1: "Phlebotomy Services" }]);
  record("6-similar-service-no-match", similar.dedicatedServicePage === "NOT_FOUND" && similar.servicePresence === "NOT_FOUND", similar.servicePresence);

  const none = one([]);
  record("7-no-evidence", none.servicePresence === "NOT_FOUND" && none.dedicatedServicePage === "NOT_FOUND" && none.servicePageUrl === "", none.servicePresence);

  const ambiguous = one([{ category: "service-page", url: "https://example.test/service/blood-pressure-checks", title: "Health Checks", h1: "Health Checks" }]);
  record("8-ambiguous-uncertain", ambiguous.dedicatedServicePage === "UNCERTAIN" && ambiguous.servicePageUrl === "", ambiguous.dedicatedServicePage);

  record("9-provenance", exact.evidence[0]?.source === "website-import" && exact.evidence[0]?.url.endsWith("/blood-pressure-checks"), exact.evidence[0]?.source || "missing");
  record("10-revision", exact.sourceRevision === "rev-a" && one([{ category: "service-page", url: "https://example.test/service/blood-pressure-checks", title: "Blood Pressure Checks", h1: "Blood Pressure Checks" }], "rev-b").sourceRevision === "rev-b", exact.sourceRevision);

  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const { buildGrowthIntelligenceInputContext } = await import("../src/pharmacy/canonicalWebsiteGrowthContext.ts");

  function writeTenant(slug: string, pageUrl: string, revision: string, title = "Blood Pressure Checks") {
    fs.mkdirSync(path.join(tmp, "config/projects", slug), { recursive: true });
    fs.mkdirSync(path.join(tmp, "data/website-design-evidence", slug), { recursive: true });
    fs.writeFileSync(path.join(tmp, "config/projects", slug, "brand-dna.json"), JSON.stringify({
      version: "brand-dna-v1", slug, sourceUrl: "https://example.test", frozenAt: "2026-09-28T00:00:00.000Z",
      businessName: "Example Pharmacy", logoUrl: "", faviconUrl: "",
      colours: { primary: "", secondary: "", accent: "", background: "", heading: "", headingPrimary: "", headingSecondary: "", body: "", muted: "", button: "", buttonText: "", headerBackground: "", headerText: "", footerBackground: "", footerText: "", footerLink: "", footerAccent: "", sectionBackground: "", topBarBackground: "", topBarText: "" },
      typography: { headingFont: "", bodyFont: "", headingWeight: "", bodyWeight: "", h1Scale: "", h2Scale: "", h3Size: "", bodySize: "" },
      layout: {}, surfaces: {}, trustCta: {}, navigationLinks: [], footerLinks: [], headerCtaText: "", headerCtaUrl: "", topInfoBarText: "",
      confidence: { logo: 0, colours: 0, fonts: 0 }, sourceImportRevision: revision,
    }));
    fs.writeFileSync(path.join(tmp, "data/website-design-evidence", slug, "design-intelligence.json"), JSON.stringify({
      version: "design-intelligence-v1", tenant: slug, sourceRevision: revision, capturedAt: "2026-09-28T00:00:00.000Z", primaryUrl: "https://example.test",
      navigation: { tree: [], hierarchyDepth: 0, rootId: "" },
      header: { rowCount: 0, announcementBar: null, logoBlock: { logoUrl: "" }, navigationBlock: {}, ctaBlock: { labels: [] }, spacing: {}, alignment: {}, sticky: false, responsive: {} },
      footer: { upperLayer: {}, lowerLayer: {}, groups: [], mobileStackOrder: [] },
      colours: [], images: [], validation: {},
    }));
    writeSetupProfile(slug, {
      pharmacyName: "Example Pharmacy",
      website: "https://example.test",
      selectedServices: ["blood-pressure-checks"],
      websiteImportSnapshot: {
        status: "imported",
        importedAt: "2026-09-28T00:00:00.000Z",
        websiteUrl: "https://example.test",
        intelligence: {
          version: 2,
          structure: { pages: [{ url: pageUrl, path: new URL(pageUrl).pathname, title, h1: title, category: "service-page" }] },
        },
      },
    } as never);
    fs.mkdirSync(path.join(tmp, "data/pharmacy-master-admin/business-profile-approvals", slug), { recursive: true });
    fs.writeFileSync(path.join(tmp, "data/pharmacy-master-admin/business-profile-approvals", slug, "latest.json"), JSON.stringify({ approvedAt: "2026-09-28T12:00:00.000Z", approvedBy: "admin" }));
  }

  writeTenant("coverage-a", "https://a.example/service/blood-pressure-checks", "rev-a");
  writeTenant("coverage-b", "https://b.example/service/blood-pressure-checks", "rev-b");
  const a = buildGrowthIntelligenceInputContext("coverage-a").serviceCoverage.services[0];
  const b = buildGrowthIntelligenceInputContext("coverage-b").serviceCoverage.services[0];
  record("11-tenant-isolation", a.servicePageUrl.includes("a.example") && b.servicePageUrl.includes("b.example") && a.servicePageUrl !== b.servicePageUrl, a.servicePageUrl);
  record("12-second-pharmacy", b.dedicatedServicePage === "PRESENT" && b.canonicalServiceName === "Blood Pressure Checks", b.serviceId);
  record("13-growth-context-consumes-coverage", a.dedicatedServicePage === "PRESENT" && a.sourceRevision === "rev-a", a.sourceRevision);

  writeTenant("coverage-a", "https://a.example/contact", "rev-new", "Contact");
  const refreshed = buildGrowthIntelligenceInputContext("coverage-a");
  const refreshedRow = refreshed.serviceCoverage.services[0];
  record("15-reimport-changes-coverage", refreshedRow.sourceRevision === "rev-new" && refreshedRow.dedicatedServicePage === "NOT_FOUND" && refreshed.serviceCoverage.approvedWithoutImportedPage.includes("blood-pressure-checks"), refreshedRow.dedicatedServicePage);

  const contextSource = fs.readFileSync(path.join(ROOT, "src/pharmacy/canonicalWebsiteGrowthContext.ts"), "utf8");
  const engineSource = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineOpportunityEngine.ts"), "utf8");
  const coverageSource = fs.readFileSync(path.join(ROOT, "src/pharmacy/canonicalExistingServiceCoverage.ts"), "utf8");
  const assessmentSource = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineServiceOpportunityEvidence.ts"), "utf8");
  record("14-no-slug-decision-in-growth-context", !contextSource.includes("url.toLowerCase().includes(key)") && !engineSource.includes("pathMatchesService") && !assessmentSource.includes("pathMatchesService"), "removed");
  record("16-no-live-tenant-in-resolver", !/gilbert/i.test(coverageSource) && !/gilbertpharmacy/i.test(coverageSource), "resolver");
  record("16-archive-not-imported", !fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineServiceOpportunityEvidence.ts"), "utf8").includes("legacy-service-coverage"), "import");

  for (const rel of protectedFiles) record(`protected ${path.basename(rel)}`, shaFile(rel) === before[rel], rel);
  record("protected opportunities", fs.existsSync(opportunities) === opportunitiesBefore, "opportunities");

  const failed = checks.filter((item) => !item.pass);
  if (failed.length) {
    console.log(`FAILED ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`ALL PASS ${checks.length}/${checks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
