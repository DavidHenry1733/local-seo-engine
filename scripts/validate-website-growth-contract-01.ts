#!/usr/bin/env npx tsx
/**
 * Growth Intelligence reads canonical website intelligence before generation.
 * Temp workspace only. Does not generate a live tenant report.
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

function dna(slug: string, logo: string, accent = "#112233", revision = "rev-a") {
  return {
    version: "brand-dna-v1",
    slug,
    sourceUrl: "https://example-pharmacy.test",
    frozenAt: "2026-09-28T00:00:00.000Z",
    businessName: "Example Pharmacy",
    logoUrl: logo,
    faviconUrl: "https://example-pharmacy.test/favicon.png",
    colours: {
      primary: "#CC3366",
      secondary: "#2255AA",
      accent,
      background: "#ffffff",
      heading: "#333333",
      headingPrimary: "#333333",
      headingSecondary: "#333333",
      body: "#333333",
      muted: "#666666",
      button: "#CC3366",
      buttonText: "#ffffff",
      headerBackground: "#ffffff",
      headerText: "#333333",
      footerBackground: "#333333",
      footerText: "#ffffff",
      footerLink: "#ffffff",
      footerAccent: "#ffffff",
      sectionBackground: "#f8fafc",
      topBarBackground: "#CC3366",
      topBarText: "#ffffff",
    },
    typography: { headingFont: "Inter", bodyFont: "Georgia", headingWeight: "700", bodyWeight: "400", h1Scale: "", h2Scale: "", h3Size: "", bodySize: "16px" },
    layout: { navigationStyle: "multi-link", footerLayout: "multi-column" },
    surfaces: {},
    trustCta: {},
    navigationLinks: [
      { label: "Home", href: "https://example-pharmacy.test/" },
      { label: "Services", href: "https://example-pharmacy.test/services" },
    ],
    footerLinks: [{ label: "Contact", href: "https://example-pharmacy.test/contact" }],
    headerCtaText: "Book",
    headerCtaUrl: "https://example-pharmacy.test/book",
    topInfoBarText: "",
    confidence: { logo: 90, colours: 88, fonts: 70 },
    sourceImportRevision: revision,
  };
}

function manifest(slug: string, logo: string, accent = "#112233", revision = "rev-a") {
  return {
    version: "design-intelligence-v1",
    tenant: slug,
    sourceRevision: revision,
    capturedAt: "2026-09-28T00:00:00.000Z",
    primaryUrl: "https://example-pharmacy.test",
    navigation: { tree: [], hierarchyDepth: 0, rootId: "" },
    header: {
      rowCount: 1,
      announcementBar: null,
      logoBlock: { logoUrl: logo, logoMaxHeight: "", logoPosition: "left", selector: "header .logo", backgroundColour: "", textColour: "", paddingTop: "", paddingBottom: "", paddingLeft: "", paddingRight: "", alignment: "", sticky: false },
      navigationBlock: { navPlacement: "inline", mobileMenuBehaviour: "stacked", selector: "header nav", backgroundColour: "", textColour: "", paddingTop: "", paddingBottom: "", paddingLeft: "", paddingRight: "", alignment: "", sticky: false },
      ctaBlock: { labels: ["Book"], hrefs: ["https://example-pharmacy.test/book"], selector: "header .cta", backgroundColour: "", textColour: "", paddingTop: "", paddingBottom: "", paddingLeft: "", paddingRight: "", alignment: "", sticky: false },
      spacing: { paddingY: "", paddingX: "", gap: "" },
      alignment: { logo: "left", nav: "inline", cta: "right" },
      sticky: false,
      responsive: { desktopBreakpoint: "980px", mobileMenuBehaviour: "stacked" },
    },
    footer: {
      upperLayer: { selector: "footer", backgroundColour: "", textColour: "", linkColour: "", paddingTop: "", paddingBottom: "" },
      lowerLayer: { selector: "footer", backgroundColour: "", textColour: "", linkColour: "", paddingTop: "", paddingBottom: "" },
      groups: [],
      mobileStackOrder: [],
    },
    colours: [
      { role: "primary", selector: ":root", computedColour: "#cc3366", hex: "#cc3366", layer: "body" },
      { role: "secondary", selector: ":root", computedColour: "#2255aa", hex: "#2255aa", layer: "body" },
      { role: "accent", selector: ":root", computedColour: accent, hex: accent, layer: "body" },
    ],
    images: [{ id: "logo-1", role: "logo", selector: "header .logo img", asset: logo, width: 120, height: 40, aspectRatio: "3:1", alt: "Example Pharmacy", lazyLoad: false, backgroundImage: "", visibility: "visible" }],
    validation: { navigationTreeComplete: true, headerHierarchyComplete: true, footerHierarchyComplete: true, colourRolesComplete: true, imageRolesComplete: true, navigationFlatteningRemoved: true, footerLayerMergeRemoved: true },
    summary: { buttonStyle: "filled", layoutClassification: "with-top-bar" },
  };
}

async function main() {
  const protectedFiles = [
    "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
    "data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json",
    "config/projects/gilbert-pharmacy-health-clinic/brand-dna.json",
    "data/website-design-evidence/gilbert-pharmacy-health-clinic/design-intelligence.json",
  ];
  const before = Object.fromEntries(protectedFiles.map((rel) => [rel, shaFile(rel)]));
  const opportunities = path.join(ROOT, "data/growth-engine/gilbert-pharmacy-health-clinic-opportunities.json");
  const opportunitiesBefore = fs.existsSync(opportunities);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "website-growth-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  fs.cpSync(path.join(ROOT, "config/pharmacy"), path.join(tmp, "config/pharmacy"), { recursive: true });
  process.env.WORKSPACE_ROOT = tmp;
  process.env.GOOGLE_PLACES_API_KEY = "";

  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const { buildGrowthIntelligenceInputContext, authoritativeImportedValue } = await import("../src/pharmacy/canonicalWebsiteGrowthContext.ts");
  const { buildGrowthOpportunityReport } = await import("../src/pharmacy/growthEngineOpportunityEngine.ts");

  function pages() {
    return [
      { url: "https://example-pharmacy.test/", path: "/", title: "Home", category: "homepage" },
      { url: "https://example-pharmacy.test/about", path: "/about", title: "About", category: "about" },
      { url: "https://example-pharmacy.test/contact", path: "/contact", title: "Contact", category: "contact" },
      { url: "https://example-pharmacy.test/services", path: "/services", title: "Services", category: "services" },
      { url: "https://example-pharmacy.test/services/blood-pressure-checks", path: "/services/blood-pressure-checks", title: "Blood Pressure", category: "service-page" },
      { url: "https://example-pharmacy.test/guides/winter", path: "/guides/winter", title: "Winter guide", category: "guide" },
      { url: "https://example-pharmacy.test/blog/flu", path: "/blog/flu", title: "Flu blog", category: "blog" },
    ];
  }

  function writeTenant(slug: string, options: { logo?: string; accent?: string; identityAccent?: string; revision?: string; services?: string[]; brand?: boolean; partial?: boolean }) {
    const logo = options.logo ?? "";
    const revision = options.revision || "rev-a";
    if (options.brand !== false) {
      fs.mkdirSync(path.join(tmp, "config/projects", slug), { recursive: true });
      fs.mkdirSync(path.join(tmp, "data/website-design-evidence", slug), { recursive: true });
      const accent = options.accent || "#112233";
      const recordDna = dna(slug, logo, accent, revision);
      if (options.partial) {
        recordDna.colours.primary = "";
        recordDna.colours.secondary = "";
        recordDna.colours.accent = "";
        recordDna.typography.headingFont = "";
        recordDna.typography.bodyFont = "";
      }
      fs.writeFileSync(path.join(tmp, "config/projects", slug, "brand-dna.json"), JSON.stringify(recordDna));
      fs.writeFileSync(path.join(tmp, "data/website-design-evidence", slug, "design-intelligence.json"), JSON.stringify(manifest(slug, logo, accent, revision)));
    }
    writeSetupProfile(slug, {
      pharmacyName: "Example Pharmacy",
      website: "https://example-pharmacy.test",
      townCity: "Exampletown",
      postcode: "EX1 1AA",
      phone: "0100 000 0000",
      selectedServices: options.services || ["blood-pressure-checks"],
      websiteImportSnapshot: {
        status: "imported",
        importedAt: "2026-09-28T00:00:00.000Z",
        websiteUrl: "https://example-pharmacy.test",
        intelligence: {
          version: 2,
          identity: {
            logoUrl: logo,
            brandPrimaryColor: "#cc3366",
            brandSecondaryColor: "#2255aa",
            brandAccentColor: options.identityAccent || options.accent || "#112233",
          },
          services: [
            { serviceId: "blood-pressure-checks", serviceName: "Blood Pressure Checks", exists: true, url: "https://example-pharmacy.test/services/blood-pressure-checks" },
          ],
          ctaEvidence: [{ ctaText: "Book", sourceUrl: "https://example-pharmacy.test/book" }],
          structure: { pages: pages() },
        },
      },
    } as never);
    fs.mkdirSync(path.join(tmp, "data/pharmacy-master-admin/business-profile-approvals", slug), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "data/pharmacy-master-admin/business-profile-approvals", slug, "latest.json"),
      JSON.stringify({ approvedAt: "2026-09-28T12:00:00.000Z", approvedBy: "admin", revision: 1 }),
    );
  }

  writeTenant("gi-with-brand", { logo: "https://example-pharmacy.test/logo.svg", services: ["blood-pressure-checks", "flu-vaccinations"] });
  const full = buildGrowthIntelligenceInputContext("gi-with-brand");
  record("1-approved-profile", full.businessProfile.approved && full.businessProfile.pharmacyName === "Example Pharmacy" && full.businessProfile.selectedServices.includes("blood-pressure-checks"), String(full.businessProfile.approved));
  record("2-page-structure", full.website.status === "PRESENT" && full.website.pages.length === 7 && full.website.importantPages.some((page) => page.category === "contact"), String(full.website.pages.length));
  record("3-service-pages", full.website.servicePages.length === 1 && full.importedServices[0]?.serviceName === "Blood Pressure Checks", full.importedServices[0]?.url || "");
  record("4-guide-blog", full.website.guidePages.length === 1 && full.website.blogPages.length === 1, `${full.website.guidePages.length}/${full.website.blogPages.length}`);
  record("5-cta-navigation", full.navigation.links.join(",") === "Home,Services" && full.cta.label === "Book" && full.cta.destination.endsWith("/book"), full.cta.destination);
  record("6-canonical-brand", full.authoritativeBrand.logo?.endsWith("/logo.svg") === true && full.brand.logo.status === "IMPORTED" && full.sourceRevision === "rev-a", full.sourceRevision);
  record("7-missing-visual-stays-missing", full.visualCapture === "NOT CAPTURED" && full.imagery.hero === "NOT CAPTURED" && full.authoritativeBrand.logo !== null, full.imagery.hero);
  record("10-provenance", full.method === "design-intelligence-v1" && full.primaryUrl === "https://example-pharmacy.test" && full.capturedAt.length > 0, full.method);
  record("3-coverage-gap", full.serviceCoverage.approvedWithoutImportedPage.includes("flu-vaccinations") && !full.serviceCoverage.approvedWithoutImportedPage.includes("blood-pressure-checks"), full.serviceCoverage.approvedWithoutImportedPage.join(","));

  writeTenant("gi-conflict", { logo: "https://example-pharmacy.test/logo.svg", accent: "#112233", identityAccent: "#445566" });
  const conflict = buildGrowthIntelligenceInputContext("gi-conflict");
  record("8-conflict-remains-conflict", conflict.brand.accentColour.status === "CONFLICT" && conflict.unresolvedBrandFields.includes("accent-colour"), conflict.brand.accentColour.value);
  record("9-conflict-not-resolved", authoritativeImportedValue(conflict.brand.accentColour) === null && conflict.authoritativeBrand.accentColour === null, conflict.authoritativeBrand.accentColour || "null");

  const report = buildGrowthOpportunityReport("gi-conflict", null);
  const reportAccent = report.websiteIntelligence?.authoritativeBrand.accentColour;
  record("9-report-keeps-conflict", report.websiteIntelligence?.brand.accentColour.status === "CONFLICT" && reportAccent == null, `${report.websiteIntelligence?.brand.accentColour.status} accent=${String(reportAccent)}`);
  const saved = path.join(tmp, "data/growth-engine/gi-conflict-opportunities.json");
  record("9-report-not-saved", !fs.existsSync(saved), saved);

  writeTenant("gi-none", { brand: false });
  const none = buildGrowthIntelligenceInputContext("gi-none");
  record("13-no-brand-still-works", none.website.pages.length === 7 && none.brand.logo.status === "NOT FOUND" && none.authoritativeBrand.logo === null && none.businessProfile.approved, none.brand.logo.status);

  writeTenant("gi-partial", { logo: "https://example-pharmacy.test/partial.svg", partial: true, identityAccent: "" });
  const partial = buildGrowthIntelligenceInputContext("gi-partial");
  record("14-partial-evidence", partial.authoritativeBrand.logo?.endsWith("/partial.svg") === true && partial.authoritativeBrand.headingFont === null && partial.website.status === "PRESENT", partial.authoritativeBrand.headingFont || "null");

  writeTenant("gi-reimport", { logo: "https://example-pharmacy.test/old.svg", revision: "rev-old" });
  writeTenant("gi-reimport", { logo: "https://example-pharmacy.test/new.svg", revision: "rev-new" });
  const refreshed = buildGrowthIntelligenceInputContext("gi-reimport");
  record("15-reimport-revision", refreshed.sourceRevision === "rev-new" && refreshed.authoritativeBrand.logo?.endsWith("/new.svg") === true, refreshed.sourceRevision);

  writeTenant("gi-tenant-a", { logo: "https://a.example/logo.svg" });
  writeTenant("gi-tenant-b", { logo: "https://b.example/logo.svg" });
  const a = buildGrowthIntelligenceInputContext("gi-tenant-a");
  const b = buildGrowthIntelligenceInputContext("gi-tenant-b");
  record("11-tenant-isolation", a.authoritativeBrand.logo?.includes("a.example") === true && b.authoritativeBrand.logo?.includes("b.example") === true && a.slug !== b.slug, `${a.slug}|${b.slug}`);
  record("12-second-pharmacy", b.navigation.links.join(",") === "Home,Services" && b.businessProfile.approved, b.slug);

  const source = fs.readFileSync(path.join(ROOT, "src/pharmacy/canonicalWebsiteGrowthContext.ts"), "utf8");
  const engine = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineOpportunityEngine.ts"), "utf8");
  record("16-no-live-tenant-in-contract", !/gilbert/i.test(source) && !/gilbert/i.test(engine), "source");
  record("16-engine-uses-shared-context", engine.includes("buildGrowthIntelligenceInputContext"), "engine");
  record("16-engine-does-not-pick-accent", !engine.includes("brandAccentColor"), "engine");

  for (const rel of protectedFiles) {
    record(`protected ${path.basename(rel)}`, shaFile(rel) === before[rel], rel);
  }
  record("protected opportunities absent-or-unchanged", fs.existsSync(opportunities) === opportunitiesBefore, "opportunities");

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
