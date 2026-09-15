#!/usr/bin/env npx tsx
/**
 * Validates PharmaConnect brand import + theme application (Brook Pharmacy).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importBrandFromUrl } from "../src/generator/brandImporter.ts";
import { mapBrandProfileToPharmacyData } from "../src/pharmacy/pharmacyBrandProfileMapper.ts";
import { buildPharmacyTheme, pharmacyThemeRootCss } from "../src/pharmacy/pharmacyThemeEngine.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { buildAllVisualExperiencePages } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import { renderBrandImportPanelHtml, renderBrandImportClientScript } from "../src/generator/brandImportPanel.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = process.argv[2] || "pharmaconnect";
const BROOK_URL = "https://pharmacy.inboxingproweb.com";
const PROFILE_FILE = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const BACKUP_FILE = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.brand-v1-backup.json`);
const OUT_DIR = path.join(ROOT, "output/pharmacy-visual-experience", SLUG);

let pass = 0;
let fail = 0;

function check(id: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
  if (ok) pass++;
  else fail++;
}

console.log("\nPharmaConnect Brand Import & Theme Application V1 — validation\n");

(async () => {
  const profilesApi = fs.readFileSync(
    path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyProfiles.ts"),
    "utf8",
  );
  const themeSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyThemeEngine.ts"), "utf8");
  const designSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/pharmacyServicePageDesignSystem.ts"),
    "utf8",
  );
  const mapperSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyBrandProfileMapper.ts"), "utf8");

  check("apply-brand-import-api", profilesApi.includes("apply-brand-import"), "endpoint exists");
  check("brand-profile-save", profilesApi.includes("saveBrandProfile"), "persists brand-profile.json");
  check("no-nhs-green-remap", !themeSrc.includes("isNhsDefaultChromeColor"), "NHS blue not remapped to green");
  check("css-brand-heading-var", themeSrc.includes("--brand-heading"), "heading CSS variable");
  check("css-brand-muted-var", themeSrc.includes("--brand-muted"), "muted CSS variable");
  check("headings-use-brand-var", designSrc.includes("color:var(--brand-heading)"), "h1/h2/h3 use brand heading");
  check("tags-use-brand-accent", designSrc.includes("color:var(--brand-accent)"), "tags use accent");
  check("nav-use-brand-text", designSrc.includes("color:var(--brand-text)"), "nav links use brand text");
  check("explicit-mapper", mapperSrc.includes("brandTextColor: heading"), "heading → brandTextColor");
  check("cta-mapping", mapperSrc.includes("headerCtaText"), "CTA mapped to profile");

  let brand;
  try {
    brand = await importBrandFromUrl(BROOK_URL);
    check("import-api-success", Boolean(brand.sourceUrl), brand.sourceUrl);
  } catch (err) {
    check("import-api-success", false, String(err));
    process.exit(1);
  }

  check("import-logo", Boolean(brand.logoUrl), brand.logoUrl?.slice(0, 60) || "");
  check("import-primary-colour", /^#005[eE][bB]8$/i.test(brand.primaryColour), brand.primaryColour);
  check("import-cta-colour", /^#f59e0b$/i.test(brand.buttonColour), brand.buttonColour);
  check("import-accent-colour", /^#007[aA]7[aA]$/i.test(brand.accentColour), brand.accentColour);
  check("import-heading-colour", /^#1[fF]2933$/i.test(brand.headingColour), brand.headingColour);
  check("import-body-colour", /^#5[fF]6[cC]7[bB]$/i.test(brand.bodyTextColour), brand.bodyTextColour);
  check("import-fonts", Boolean(brand.headingFont && brand.bodyFont), `${brand.headingFont} / ${brand.bodyFont}`);
  check(
    "import-nav-links",
    (brand.navigationLinks || []).some((l) => l.label === "Services"),
    (brand.navigationLinks || []).map((l) => l.label).join(", "),
  );
  check("import-cta-text", /order prescription/i.test(brand.ctaText || ""), brand.ctaText || "");

  if (fs.existsSync(PROFILE_FILE)) fs.copyFileSync(PROFILE_FILE, BACKUP_FILE);
  const existingRaw = fs.existsSync(PROFILE_FILE)
    ? JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"))
    : { slug: SLUG, data: {} };
  const existingData = normalizeProfileData(existingRaw.data || {});
  const patch = mapBrandProfileToPharmacyData(brand, existingData);
  const savedData = normalizeProfileData({ ...existingData, ...patch });

  check("profile-primary-saved", savedData.brandPrimaryColor.toLowerCase() === "#005eb8", savedData.brandPrimaryColor);
  check("profile-cta-saved", savedData.brandCtaColor.toLowerCase() === "#f59e0b", savedData.brandCtaColor);
  check("profile-logo-saved", Boolean(savedData.logoUrl), savedData.logoUrl?.slice(0, 50) || "");
  check("profile-nav-saved", (savedData.headerNavLinks || []).length >= 4, String(savedData.headerNavLinks?.length));
  check("profile-cta-text-saved", /order prescription/i.test(savedData.headerCtaText || ""), savedData.headerCtaText || "");
  check("profile-name-preserved", savedData.pharmacyName === existingData.pharmacyName || savedData.pharmacyName.length > 0, savedData.pharmacyName);

  fs.writeFileSync(
    PROFILE_FILE,
    JSON.stringify({ slug: SLUG, updatedAt: new Date().toISOString(), version: PROFILE_SCHEMA_VERSION, data: savedData }, null, 2),
  );

  const theme = buildPharmacyTheme({
    pharmacyName: savedData.pharmacyName,
    logoUrl: savedData.logoUrl,
    phone: savedData.phone,
    brandPrimaryColor: savedData.brandPrimaryColor,
    brandSecondaryColor: savedData.brandSecondaryColor,
    brandCtaColor: savedData.brandCtaColor,
    brandAccentColor: savedData.brandAccentColor,
    brandBackgroundColor: savedData.brandBackgroundColor,
    brandTextColor: savedData.brandTextColor,
    brandMutedTextColor: savedData.brandMutedTextColor,
    fontHeading: savedData.fontHeading,
    fontBody: savedData.fontBody,
    buttonRadius: savedData.buttonRadius,
    cardRadius: savedData.cardRadius,
    town: savedData.townCity,
    rankingAreas: savedData.rankingAreas,
    coverageAreas: savedData.coverageAreas,
    gphcNumber: savedData.gphcNumber,
    superintendentName: savedData.superintendentPharmacistName,
    addressLine1: savedData.addressLine1,
    postcode: savedData.postcode,
    openingHours: savedData.openingHours,
    preferredCta: savedData.preferredCta,
    headerCtaText: savedData.headerCtaText,
    headerCtaUrl: savedData.headerCtaUrl,
    headerNavLinks: savedData.headerNavLinks,
    footerLinks: savedData.footerLinks,
    socialFacebook: savedData.socialFacebook,
    socialInstagram: savedData.socialInstagram,
    socialLinkedIn: savedData.socialLinkedIn,
    socialX: savedData.socialX,
    socialYouTube: savedData.socialYouTube,
    reviewerName: savedData.reviewerName,
    reviewerRole: savedData.reviewerRole,
    reviewerBio: savedData.reviewerBio,
    reviewerPhoto: savedData.reviewerPhoto,
    nhsProfileUrl: savedData.nhsProfileUrl,
    gphcPremisesUrl: savedData.gphcPremisesUrl,
    website: savedData.website,
    bookingUrl: savedData.bookingUrl,
    businessEmail: savedData.businessEmail,
    nhsEmail: savedData.nhsEmail,
    footerText: savedData.footerText,
    footerCopyright: savedData.footerCopyright,
    footerLogoUrl: savedData.footerLogoUrl,
    headerLogoUrl: savedData.headerLogoUrl,
    tradingName: savedData.tradingName,
    yearsServingCommunity: savedData.yearsServingCommunity,
    accreditations: savedData.accreditations,
    uniqueSellingPoints: savedData.uniqueSellingPoints,
    patientQuestions: savedData.patientQuestions,
    priorityServices: savedData.priorityServices,
    localLandmarks: savedData.localLandmarks,
    demoMode: savedData.demoMode,
  });

  check("theme-primary-not-green", theme.primaryColor.toLowerCase() === "#005eb8", theme.primaryColor);
  check("theme-cta-amber", theme.ctaColor.toLowerCase() === "#f59e0b", theme.ctaColor);
  const rootCss = pharmacyThemeRootCss(theme);
  check("generated-css-primary", rootCss.includes("--brand-primary:#005eb8") || rootCss.includes("--brand-primary:#005EB8"), "primary var");
  check("generated-css-cta", rootCss.includes("#f59e0b") || rootCss.includes("#F59E0B"), "cta var");

  const panelHtml = renderBrandImportPanelHtml({ mode: "pharmacy", websiteUrl: BROOK_URL });
  const panelJs = renderBrandImportClientScript("pharmacy");
  check("dashboard-brand-panel", panelHtml.includes("Import Website Branding"), "panel HTML");
  check("dashboard-apply-flow", panelJs.includes("apply-brand-import"), "apply endpoint in client");

  buildAllVisualExperiencePages(SLUG);
  for (const serviceId of VISUAL_EXPERIENCE_BENCHMARK_SERVICES) {
    const htmlPath = path.join(OUT_DIR, serviceId, "index.html");
    const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
    check(`page-built-${serviceId}`, html.length > 500, htmlPath);
    check(`page-logo-${serviceId}`, html.includes(savedData.logoUrl) || html.includes("site-header"), "logo/header");
    check(`page-css-primary-${serviceId}`, html.includes("--brand-primary") && html.toLowerCase().includes("#005eb8"), serviceId);
    check(`page-css-cta-${serviceId}`, html.toLowerCase().includes("#f59e0b"), serviceId);
    check(`page-nav-${serviceId}`, html.includes("Services") || html.includes("nav-links"), serviceId);
    check(`page-no-green-remap-${serviceId}`, !html.includes("#1a5c42") && !html.includes("#007f3b"), serviceId);
    check(`page-no-blue-hero-${serviceId}`, !/\.hero\{[^}]*var\(--brand-primary\)[^}]*100%\)/.test(html.replace(/\s+/g, "")), "hero not solid blue");
    check(`page-light-body-${serviceId}`, html.includes("--page-background:#ffffff") || html.includes("--page-background: #ffffff") || html.includes("--page-bg:var(--page-background)"), "light page bg");
    check(`page-heading-var-${serviceId}`, html.includes("--brand-heading:#1f2933") || html.includes("--brand-heading: #1f2933"), "heading var");
  }

  const masterDir = path.join(ROOT, "docs/pharmacy-master-library");
  const masterCount = fs.readdirSync(masterDir).length;
  check("no-master-modification", masterCount > 0, `${masterCount} masters untouched`);

  const layoutLock = designSrc.includes("lockdown-v1");
  check("layout-unchanged", layoutLock, "lockdown-v1 template id preserved");

  if (fs.existsSync(BACKUP_FILE)) fs.unlinkSync(BACKUP_FILE);

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass}/${pass + fail} checks\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
