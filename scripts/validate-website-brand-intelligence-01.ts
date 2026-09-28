#!/usr/bin/env npx tsx
/**
 * Canonical website brand evidence is read from the stored Website Import brand record.
 * No live crawl and no tenant writes outside the temp workspace.
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

function dna(slug: string, logo: string, extra: Record<string, unknown> = {}) {
  return {
    version: "brand-dna-v1",
    slug,
    sourceUrl: "https://example-pharmacy.test",
    frozenAt: "2026-09-28T00:00:00.000Z",
    businessName: "Example Pharmacy",
    logoUrl: logo,
    faviconUrl: logo ? "https://example-pharmacy.test/favicon.png" : "",
    colours: {
      primary: "#CC3366",
      secondary: "#99264D",
      accent: "#99264D",
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
    footerLinks: [
      { label: "Contact", href: "https://example-pharmacy.test/contact" },
      { label: "Privacy", href: "https://example-pharmacy.test/privacy" },
    ],
    headerCtaText: "Book",
    headerCtaUrl: "https://example-pharmacy.test/book",
    topInfoBarText: "",
    confidence: { logo: 90, colours: 88, fonts: 70 },
    sourceImportRevision: "rev-a",
    ...extra,
  };
}

function manifest(slug: string, logo: string) {
  return {
    version: "design-intelligence-v1",
    tenant: slug,
    sourceRevision: "rev-a",
    capturedAt: "2026-09-28T00:00:00.000Z",
    primaryUrl: "https://example-pharmacy.test",
    navigation: {
      tree: [
        { id: "nav-1", parentId: null, depth: 0, role: "primary-navigation", order: 1, selector: "header nav a", href: "https://example-pharmacy.test/", text: "Home", visibility: "visible", breakpointVisibility: { desktop: true, tablet: true, mobile: true } },
        { id: "nav-2", parentId: null, depth: 0, role: "primary-navigation", order: 2, selector: "header nav a", href: "https://example-pharmacy.test/services", text: "Services", visibility: "visible", breakpointVisibility: { desktop: true, tablet: true, mobile: true } },
      ],
      hierarchyDepth: 1,
      rootId: "nav-1",
    },
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
      upperLayer: { selector: "footer", backgroundColour: "#333333", textColour: "#ffffff", linkColour: "#ffffff", paddingTop: "", paddingBottom: "" },
      lowerLayer: { selector: "footer", backgroundColour: "", textColour: "", linkColour: "", paddingTop: "", paddingBottom: "" },
      groups: [
        { id: "contact", role: "contact", selector: "footer", heading: "Contact", links: [{ text: "0141 000 0000", href: "tel:01410000000", selector: "footer a" }], backgroundColour: "", textColour: "" },
        { id: "legal", role: "legal", selector: "footer", heading: "Legal", links: [{ text: "Privacy", href: "https://example-pharmacy.test/privacy", selector: "footer a" }], backgroundColour: "", textColour: "" },
        { id: "links", role: "company", selector: "footer", heading: "Footer", links: [{ text: "Contact", href: "https://example-pharmacy.test/contact", selector: "footer a" }], backgroundColour: "", textColour: "" },
      ],
      mobileStackOrder: [],
    },
    colours: [
      { role: "primary", selector: ":root", computedColour: "#cc3366", hex: "#cc3366", layer: "body" },
      { role: "secondary", selector: ":root", computedColour: "#99264d", hex: "#99264d", layer: "body" },
      { role: "accent", selector: ":root", computedColour: "#99264d", hex: "#99264d", layer: "body" },
    ],
    images: [{ id: "hero-1", role: "hero", selector: ".hero img", asset: "https://example-pharmacy.test/hero.jpg", width: 1200, height: 600, aspectRatio: "2:1", alt: "Pharmacy front", lazyLoad: false, backgroundImage: "", visibility: "visible" }],
    validation: { navigationTreeComplete: true, headerHierarchyComplete: true, footerHierarchyComplete: true, colourRolesComplete: true, imageRolesComplete: true, navigationFlatteningRemoved: true, footerLayerMergeRemoved: true },
    summary: { buttonStyle: "filled", layoutClassification: "with-top-bar" },
  };
}

async function main() {
  const protectedFiles = [
    "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
    "config/projects/gilbert-pharmacy-health-clinic/brand-dna.json",
    "data/website-design-evidence/gilbert-pharmacy-health-clinic/design-intelligence.json",
  ];
  const before = Object.fromEntries(protectedFiles.map((rel) => [rel, shaFile(rel)]));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "website-brand-"));
  fs.mkdirSync(path.join(tmp, "data/pharmacy-profiles"), { recursive: true });
  fs.cpSync(path.join(ROOT, "config/pharmacy"), path.join(tmp, "config/pharmacy"), { recursive: true });
  process.env.WORKSPACE_ROOT = tmp;
  process.env.GOOGLE_PLACES_API_KEY = "";

  const { writeSetupProfile } = await import("../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts");
  const { projectCanonicalWebsiteBrandEvidence } = await import("../src/pharmacy/canonicalWebsiteBrandEvidence.ts");
  const { classifyWebsiteImportContract } = await import("../src/pharmacy/masterAdminWebsiteImportWorkflowStateService.ts");
  const { buildImportedEvidenceReview } = await import("../src/pharmacy/masterAdminImportedEvidenceReviewService.ts");

  function writeTenant(slug: string, logo: string, pages = true) {
    fs.mkdirSync(path.join(tmp, "config/projects", slug), { recursive: true });
    fs.mkdirSync(path.join(tmp, "data/website-design-evidence", slug), { recursive: true });
    fs.writeFileSync(path.join(tmp, "config/projects", slug, "brand-dna.json"), JSON.stringify(dna(slug, logo)));
    fs.writeFileSync(path.join(tmp, "data/website-design-evidence", slug, "design-intelligence.json"), JSON.stringify(manifest(slug, logo)));
    writeSetupProfile(slug, {
      pharmacyName: "Example Pharmacy",
      website: "https://example-pharmacy.test",
      websiteImportSnapshot: {
        status: "imported",
        importedAt: "2026-09-28T00:00:00.000Z",
        message: "Website intelligence imported.",
        websiteUrl: "https://example-pharmacy.test",
        socialLinks: ["https://example-pharmacy.test/social"],
        intelligence: {
          version: 2,
          identity: { logoUrl: logo, faviconUrl: logo ? "https://example-pharmacy.test/favicon.png" : "", brandPrimaryColor: "#cc3366", resolvedUrl: "https://example-pharmacy.test/" },
          structure: {
            pages: pages ? [
              { url: "https://example-pharmacy.test/", path: "/", title: "Home", category: "homepage" },
              { url: "https://example-pharmacy.test/contact", path: "/contact", title: "Contact", category: "contact" },
              { url: "https://example-pharmacy.test/services/flu", path: "/services/flu", title: "Flu", category: "service-page" },
            ] : [],
          },
        },
      },
    } as never);
  }

  writeTenant("brand-with-logo", "https://example-pharmacy.test/logo.svg");
  const withLogo = projectCanonicalWebsiteBrandEvidence("brand-with-logo");
  record("1-logo-captured", withLogo.logo.status === "IMPORTED" && withLogo.logo.assetUrl.endsWith("/logo.svg"), withLogo.logo.status);
  record("3-colours-normalised", withLogo.primaryColour.status === "IMPORTED" && withLogo.primaryColour.value.toLowerCase() === "#cc3366", withLogo.primaryColour.value);
  record("4-fonts-captured", withLogo.headingFont.value === "Inter" && withLogo.bodyFont.value === "Georgia", `${withLogo.headingFont.value}/${withLogo.bodyFont.value}`);
  record("5-header-navigation", withLogo.headerNavigation.join(",") === "Home,Services" && withLogo.headerCta.value === "Book", withLogo.headerNavigation.join(","));
  record("6-footer-links", withLogo.footerContact.includes("0141 000 0000") && withLogo.footerLegal.includes("Privacy") && withLogo.footerLinks.includes("Contact"), withLogo.footerLinks.join(","));
  record("7-structure", withLogo.structure.some((page) => page.category === "service-page") && withLogo.structureSummary.status === "IMPORTED", String(withLogo.structure.length));
  record("8-imagery", withLogo.imagery.some((image) => image.role === "hero" && image.url.endsWith("/hero.jpg")), withLogo.imagerySummary.value);
  record("9-provenance", withLogo.sourceRevision === "rev-a" && withLogo.method === "design-intelligence-v1" && withLogo.logo.method.length > 0, withLogo.sourceRevision);

  const review = buildImportedEvidenceReview("brand-with-logo");
  record("9-review-exposes-brand", review.websiteBrand?.logo.status === "IMPORTED" && review.websiteEvidence.some((row) => row.id === "heading-font" && row.value === "Inter"), review.websiteBrand?.logo.status || "missing");

  writeTenant("brand-no-logo", "");
  const noLogo = projectCanonicalWebsiteBrandEvidence("brand-no-logo");
  record("2-missing-logo-not-found", noLogo.logo.status === "NOT FOUND" && noLogo.logo.value === "", noLogo.logo.status);

  const staleLogo = "https://example-pharmacy.test/old-logo.svg";
  const freshLogo = "https://example-pharmacy.test/new-logo.svg";
  writeTenant("brand-reimport", staleLogo);
  writeTenant("brand-reimport", freshLogo);
  const refreshed = projectCanonicalWebsiteBrandEvidence("brand-reimport");
  record("10-reimport-supersedes", refreshed.logo.assetUrl === freshLogo && !refreshed.logo.assetUrl.includes("old-logo"), refreshed.logo.assetUrl);

  writeTenant("brand-tenant-a", "https://a.example/logo.svg");
  writeTenant("brand-tenant-b", "https://b.example/logo.svg");
  const a = projectCanonicalWebsiteBrandEvidence("brand-tenant-a");
  const b = projectCanonicalWebsiteBrandEvidence("brand-tenant-b");
  record("11-tenant-isolation", a.logo.assetUrl.includes("a.example") && b.logo.assetUrl.includes("b.example") && a.logo.assetUrl !== b.logo.assetUrl, `${a.logo.assetUrl} | ${b.logo.assetUrl}`);

  writeSetupProfile("brand-incomplete-visual", {
    pharmacyName: "Plain Pharmacy",
    website: "https://plain.example",
    websiteImportSnapshot: {
      status: "imported",
      importedAt: "2026-09-28T00:00:00.000Z",
      websiteUrl: "https://plain.example",
      intelligence: { structure: { pages: [{ url: "https://plain.example/", path: "/", title: "Home", category: "homepage" }] } },
    },
  } as never);
  const plain = JSON.parse(fs.readFileSync(path.join(tmp, "data/pharmacy-profiles/brand-incomplete-visual.json"), "utf8")).data;
  const contract = classifyWebsiteImportContract("brand-incomplete-visual", plain);
  const plainBrand = projectCanonicalWebsiteBrandEvidence("brand-incomplete-visual");
  record("12-incomplete-visual-does-not-fail-import", contract.state === "imported" && plainBrand.logo.status === "NOT FOUND", contract.state);

  const second = projectCanonicalWebsiteBrandEvidence("brand-tenant-b");
  record("13-second-pharmacy", second.logo.status === "IMPORTED" && second.headingFont.value === "Inter", second.logo.assetUrl);

  const source = fs.readFileSync(path.join(ROOT, "src/pharmacy/canonicalWebsiteBrandEvidence.ts"), "utf8");
  const page = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  record("14-no-live-tenant-in-production-reader", !/gilbert/i.test(source), "reader");
  record("14-admin-section", page.includes("Brand / Website Style") && page.includes("renderImportedBrandStyle"), "page");

  const gilbert = projectCanonicalWebsiteBrandEvidence("gilbert-pharmacy-health-clinic");
  record("gilbert-not-read-from-live-workspace", gilbert.logo.status === "NOT FOUND", gilbert.logo.status);

  for (const rel of protectedFiles) {
    record(`protected ${path.basename(rel)}`, shaFile(rel) === before[rel], rel);
  }

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
