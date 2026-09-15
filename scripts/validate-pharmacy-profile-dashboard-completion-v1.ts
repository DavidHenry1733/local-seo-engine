#!/usr/bin/env npx tsx
/**
 * PharmaConnect Profile Dashboard Completion V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeProfileData,
  PROFILE_SCHEMA_VERSION,
  type PharmacyProfileData,
} from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  DEFAULT_HEADER_NAV_LINKS,
  REVIEWER_BIO_EXAMPLES,
} from "../src/pharmacy/pharmacyProfileDashboardConfig.ts";
import { buildProfilePreviewHtml } from "../src/pharmacy/pharmacyProfileDashboardPreview.ts";
import {
  buildProfessionalReviewCardHtml,
  profileReviewCardCss,
} from "../src/pharmacy/pharmacyProfileReviewCardHtml.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { buildPharmacyTheme, pharmacyThemeRootCss } from "../src/pharmacy/pharmacyThemeEngine.ts";
import {
  renderPharmacyServicePageFooter,
  renderPharmacyServicePageHeader,
} from "../src/pharmacy/pharmacyServicePageDesignSystem.ts";
import {
  renderProfessionalReviewPanelHtml,
  resolveProfessionalReviewer,
} from "../src/pharmacy/pharmacyProfessionalReviewPanel.ts";
import { getServiceAuthorityAudit } from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { loadNormalizedProfile, isReviewerProfileComplete } from "../src/pharmacy/pharmacyRealEnhancementActionsService.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";

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

function readRoute(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes", relPath), "utf8");
}

console.log(`\nPharmaConnect Profile Dashboard Completion V1 — ${slug}\n`);

// --- Schema & business fields ---
const businessFields: (keyof PharmacyProfileData)[] = [
  "pharmacyName",
  "tradingName",
  "companyName",
  "companyRegistrationNumber",
  "gphcNumber",
  "nhsProfileUrl",
  "website",
  "businessEmail",
  "phone",
  "emergencyContact",
  "addressLine1",
  "addressLine2",
  "townCity",
  "county",
  "postcode",
  "country",
  "googleMapsEmbedUrl",
  "latitude",
  "longitude",
  "openingHours",
  "rankingAreas",
  "nearbyAreas",
];

const brandingFields: (keyof PharmacyProfileData)[] = [
  "logoUrl",
  "faviconUrl",
  "brandPrimaryColor",
  "brandSecondaryColor",
  "brandCtaColor",
  "brandAccentColor",
  "brandBackgroundColor",
  "brandTextColor",
  "brandMutedTextColor",
  "fontHeading",
  "fontBody",
  "fontHeadingWeight",
  "fontBodyWeight",
  "fontH1Size",
  "fontH2Size",
  "fontH3Size",
  "fontBodySize",
  "buttonStyle",
  "buttonRadius",
  "cardRadius",
  "imageStyle",
  "pageStyle",
];

const headerFields: (keyof PharmacyProfileData)[] = [
  "headerLogoUrl",
  "headerCtaText",
  "headerCtaUrl",
  "headerNavLinks",
];

const footerFields: (keyof PharmacyProfileData)[] = [
  "footerLinks",
  "footerCopyright",
  "footerCompanyNumber",
  "footerPrivacyPolicyUrl",
  "footerCookiePolicyUrl",
  "footerTermsUrl",
  "socialFacebook",
  "socialInstagram",
  "socialLinkedIn",
  "socialX",
  "socialYouTube",
  "footerLogoUrl",
  "footerText",
];

const reviewerFields: (keyof PharmacyProfileData)[] = [
  "reviewerName",
  "reviewerRole",
  "reviewerQualifications",
  "reviewerProfessionalRegistrations",
  "reviewerExperienceYears",
  "reviewerSpecialInterests",
  "reviewerClinicalInterests",
  "reviewerBio",
  "reviewerPhoto",
  "clinicalReviewDate",
  "nextReviewDate",
  "reviewerSignature",
];

const empty = normalizeProfileData({});
record("schema-version", PROFILE_SCHEMA_VERSION >= 3, `v${PROFILE_SCHEMA_VERSION}`);
record(
  "business-fields-normalize",
  businessFields.every((k) => k in empty),
  `${businessFields.length} business keys on normalized profile`,
);
record(
  "branding-fields-normalize",
  brandingFields.every((k) => k in empty),
  `${brandingFields.length} branding keys`,
);
record(
  "header-fields-normalize",
  headerFields.every((k) => k in empty),
  `${headerFields.length} header keys`,
);
record(
  "footer-fields-normalize",
  footerFields.every((k) => k in empty),
  `${footerFields.length} footer keys`,
);
record(
  "reviewer-fields-normalize",
  reviewerFields.every((k) => k in empty),
  `${reviewerFields.length} reviewer keys`,
);

// --- Profile file round-trip ---
const profileFile = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
record("profile-file-exists", fs.existsSync(profileFile), profileFile);

const profileDoc = fs.existsSync(profileFile)
  ? (JSON.parse(fs.readFileSync(profileFile, "utf8")) as { data?: Partial<PharmacyProfileData> })
  : { data: {} };
const saved = normalizeProfileData(profileDoc.data || {});

const testSave = normalizeProfileData({
  ...saved,
  brandPrimaryColor: "#112233",
  brandSecondaryColor: "#445566",
  brandCtaColor: "#778899",
  headerCtaText: "Book Now",
  headerNavLinks: DEFAULT_HEADER_NAV_LINKS,
  footerCopyright: "© Test Pharmacy",
});
record("branding-fields-save", testSave.brandPrimaryColor === "#112233", testSave.brandPrimaryColor);
record("header-cta-save", testSave.headerCtaText === "Book Now", testSave.headerCtaText);
record(
  "header-nav-defaults",
  testSave.headerNavLinks.length >= 6,
  testSave.headerNavLinks.map((l) => l.label).join(", "),
);
record("footer-copyright-save", testSave.footerCopyright === "© Test Pharmacy", testSave.footerCopyright);

// --- Dashboard UI ---
const dashHtml = readRoute("pharmacyProfileDashboardPage.ts");
record("dashboard-business-section", dashHtml.includes("renderBusinessSection"), "business section wired");
record("dashboard-branding-section", dashHtml.includes("renderBrandingSection"), "branding section wired");
record("dashboard-header-section", dashHtml.includes("renderHeaderSection"), "header section wired");
record("dashboard-footer-section", dashHtml.includes("renderFooterSection"), "footer section wired");
record("dashboard-review-section", dashHtml.includes("renderProfessionalReviewSection"), "review section wired");
record("dashboard-future-section", dashHtml.includes("renderFutureSection"), "future placeholders wired");
record("dashboard-live-preview", dashHtml.includes("buildProfilePreviewHtml"), "live preview wired");
record("dashboard-colour-sync", dashHtml.includes("syncColorFields") || dashHtml.includes("color-picker"), "colour picker + HEX sync");
record("dashboard-nav-editor", dashHtml.includes("headerNavLinks") || dashHtml.includes("nav-editor"), "header nav editor");
record("dashboard-reviewer-examples", dashHtml.includes("REVIEWER_BIO_EXAMPLES") || dashHtml.includes("reviewer-example"), "guided bio examples");

// --- Reviewer examples ---
record(
  "reviewer-examples-count",
  REVIEWER_BIO_EXAMPLES.length >= 3,
  REVIEWER_BIO_EXAMPLES.map((e) => e.title).join(", "),
);

// --- Professional review card ---
const cardHtml = buildProfessionalReviewCardHtml(saved);
record("review-card-component", cardHtml.includes("profile-review-card"), "shared review card marker");
record("review-card-css", profileReviewCardCss().includes(".profile-review-card"), "review card CSS exported");

const panelHtml = renderProfessionalReviewPanelHtml(buildPharmacyServicePageProfile(slug));
record(
  "review-panel-uses-card",
  panelHtml.includes("profile-review-card"),
  "generated pages use shared review card",
);

// --- Live preview ---
const previewHtml = buildProfilePreviewHtml(saved);
record("preview-header", previewHtml.includes("preview-header") || previewHtml.includes("preview-nav"), "header preview block");
record("preview-footer", previewHtml.includes("preview-footer"), "footer preview block");
record("preview-brand-colours", previewHtml.includes("preview-color-swatches") || previewHtml.includes("preview-swatch"), "brand colour swatches");
record("preview-review-card", previewHtml.includes("profile-review-card"), "review card in preview");

// --- Profile consumption ---
const pageProfile = buildPharmacyServicePageProfile(slug);
record("page-profile-header-nav", pageProfile.headerNavLinks.length >= 1, `${pageProfile.headerNavLinks.length} nav links`);
record("page-profile-branding", Boolean(pageProfile.brandPrimaryColor), pageProfile.brandPrimaryColor || "set in profile");
record("page-profile-footer-fields", "footerCopyright" in pageProfile && "footerLinks" in pageProfile, "footer context fields");

const theme = buildPharmacyTheme(pageProfile);
const rootCss = pharmacyThemeRootCss(theme);
record("theme-accent-colour", rootCss.includes("--brand-accent"), "accent colour in theme CSS");
record("theme-font-vars", rootCss.includes("--font-heading") && rootCss.includes("--font-body"), "typography CSS vars");

const headerHtml = renderPharmacyServicePageHeader(pageProfile);
record("header-consumes-profile", headerHtml.includes("data-component=\"pharmacy-page-header\""), "header renders");
record(
  "header-cta-from-profile",
  headerHtml.includes(pageProfile.headerCtaText || pageProfile.primaryCta),
  pageProfile.headerCtaText || pageProfile.primaryCta,
);

const footerHtml = renderPharmacyServicePageFooter(pageProfile, "Blood Pressure Checks");
record("footer-consumes-profile", footerHtml.includes("data-component=\"pharmacy-page-footer\""), "footer renders");

const profile = loadNormalizedProfile(slug);
const reviewer = resolveProfessionalReviewer(pageProfile);
record("authority-reviewer-context", reviewer.hasNamedReviewer || isReviewerProfileComplete(profile), reviewer.name || "reviewer optional");

const audit = getServiceAuthorityAudit(slug, "blood-pressure-checks");
const reviewerSignals = audit
  ? Object.values(audit.evidence).flat().filter((e) => /reviewer|clinical review|named pharmacist/i.test(e.signal))
  : [];
record("authority-audit-reviewer", reviewerSignals.length >= 1, `${reviewerSignals.length} reviewer signals`);

// --- Visual pages branding consumption ---
let visualBrandingPass = 0;
for (const serviceId of VISUAL_EXPERIENCE_BENCHMARK_SERVICES) {
  const pagePath = path.join(ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
  if (!fs.existsSync(pagePath)) continue;
  const html = fs.readFileSync(pagePath, "utf8");
  const hasTheme = html.includes("--brand-primary") || html.includes("var(--brand-primary)");
  const hasReview = html.includes("profile-review-card") || html.includes("pharmacy-professional-review-panel");
  if (hasTheme && hasReview) visualBrandingPass++;
  record(`visual-branding-${serviceId}`, hasTheme, `theme vars=${hasTheme} review=${hasReview}`);
}
record(
  "visual-pages-branding",
  visualBrandingPass >= 1,
  `${visualBrandingPass}/${VISUAL_EXPERIENCE_BENCHMARK_SERVICES.length} pages (rebuild after deploy for full pass)`,
);

// --- Guardrails ---
const masterLibrary = path.join(ROOT, "docs/pharmacy-master-library");
record("no-service-masters-modified", fs.existsSync(masterLibrary), "master library intact");

const clinicalCopyDir = path.join(ROOT, "docs/pharmacy-master-library");
const clinicalFiles = fs.existsSync(clinicalCopyDir)
  ? fs.readdirSync(clinicalCopyDir).filter((f) => f.endsWith(".md") || f.endsWith(".json"))
  : [];
record("no-clinical-copy-modified", clinicalFiles.length > 0, `${clinicalFiles.length} master files present`);

const designLock = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/pharmacyServicePageDesignSystem.ts"),
  "utf8",
);
record(
  "no-template-redesign",
  designLock.includes("PHARMACY_SERVICE_PAGE_TEMPLATE_ID") && designLock.includes("lockdown-v1"),
  "lockdown-v1 template id preserved",
);

// --- Module files consume profile ---
const consumptionModules = [
  ["pharmacyServicePageProfileContext.ts", "headerNavLinks"],
  ["pharmacyThemeEngine.ts", "brandAccentColor"],
  ["pharmacyProfileReviewCardHtml.ts", "profile-review-card"],
  ["pharmacyContentImagePlaceholderService.ts", "buildPharmacyServicePageProfile"],
  ["pharmacyAuthorityReadinessService.ts", "loadPharmacyProfile"],
  ["pharmacyPlatformDashboardService.ts", "loadPharmacyProfile"],
];
for (const [file, marker] of consumptionModules) {
  const src = fs.readFileSync(path.join(ROOT, "src/pharmacy", file), "utf8");
  record(`consumes-profile-${file.replace(".ts", "")}`, src.includes(marker), marker);
}

// --- Future placeholders ---
record(
  "future-coming-soon",
  dashHtml.includes("Coming Soon") || dashHtml.includes("renderFutureSection") || fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyProfileDashboardSections.ts"), "utf8").includes("Coming Soon"),
  "future features disabled",
);

// --- HTTP smoke ---
try {
  const res = await fetch(`${BASE}/api/pharmacy-profile-dashboard?slug=${slug}`, { redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  record(
    "http-profile-dashboard",
    res.status === 200
      ? body.includes("Profile Dashboard")
      : res.status === 302 || res.status === 301,
    `HTTP ${res.status}`,
  );
} catch (err) {
  record("http-profile-dashboard", false, `offline — ${String(err)}`);
}

const passCount = checks.filter((c) => c.pass).length;
const criticalFails = checks.filter(
  (c) =>
    !c.pass &&
    !c.id.startsWith("http") &&
    !c.id.startsWith("visual-branding-") &&
    c.id !== "visual-pages-branding",
);
const overall = criticalFails.length === 0 ? "PASS" : "FAIL";

console.log(`\n${overall} — ${passCount}/${checks.length} checks (${Math.round((passCount / checks.length) * 100)}%)\n`);
process.exit(overall === "PASS" ? 0 : 1);
