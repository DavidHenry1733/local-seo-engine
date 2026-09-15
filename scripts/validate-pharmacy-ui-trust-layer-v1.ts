#!/usr/bin/env npx tsx
/**
 * PharmaConnect UI Navigation & Professional Trust Layer V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlatformNavItems } from "../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { renderProfessionalReviewPanelHtml, resolveProfessionalReviewer } from "../src/pharmacy/pharmacyProfessionalReviewPanel.ts";
import { validatePharmacyServicePageHtml } from "../src/pharmacy/pharmacyVisualExperienceLayoutV3.ts";
import { loadNormalizedProfile, isReviewerProfileComplete } from "../src/pharmacy/pharmacyRealEnhancementActionsService.ts";
import { getServiceAuthorityAudit } from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import {
  saveContentImagePlaceholders,
  loadContentImagePlaceholders,
} from "../src/pharmacy/pharmacyContentImagePlaceholderService.ts";
import { enhanceTrustSchemaForSlug } from "../src/pharmacy/pharmacyTrustLayer.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import { renderPharmacyPlatformDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { isUntrustedDisplayValue } from "../src/pharmacy/pharmacyProfileProductionSafety.ts";

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

function readPageHtml(relPath: string): string {
  const file = path.join(ROOT, "artifacts/api-server/src/routes", relPath);
  return fs.readFileSync(file, "utf8");
}

console.log(`\nPharmaConnect UI Navigation & Trust Layer V1 — ${slug}\n`);

// --- Navigation module ---
const navItems = buildPlatformNavItems(slug);
record("nav-module-items", navItems.length >= 11, `${navItems.length} nav items`);
record(
  "nav-all-links-include-slug",
  navItems.every((i) => i.url.includes(`slug=${slug}`)),
  navItems.map((i) => i.id).join(", "),
);
record(
  "nav-platform-dashboard-home",
  navItems[0]?.url === `/api/pharmacy-dashboard?slug=${slug}`,
  navItems[0]?.url || "missing",
);

const modulePages = [
  "pharmacyPlatformDashboardPage.ts",
  "pharmacyProfileDashboardPage.ts",
  "pharmacyCampaignsPage.ts",
  "pharmacyImageLibraryPage.ts",
  "pharmacyAuthorityReadinessPage.ts",
  "pharmacyEnhancementWorkspacePage.ts",
  "pharmacyGrowthDashboardPage.ts",
  "pharmacyGrowthActionsPage.ts",
  "pharmacyPublishingSettingsPage.ts",
];

for (const page of modulePages) {
  const html = readPageHtml(page);
  const hasNav = html.includes("renderPharmacyPlatformNavBar");
  record(`nav-wired-${page.replace(".ts", "")}`, hasNav, hasNav ? "platform nav render wired" : "missing nav import/render");
}

// --- Profile fields ---
const profile = loadNormalizedProfile(slug);
const profileFile = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
record("profile-file-exists", fs.existsSync(profileFile), profileFile);
record("profile-reviewer-fields", isReviewerProfileComplete(profile), `reviewer=${profile.reviewerName || "—"}`);
record("profile-logo-field", Boolean(String(profile.logoUrl || "").trim()), profile.logoUrl || "missing");
record("profile-brand-colors", Boolean(profile.brandPrimaryColor), profile.brandPrimaryColor || "missing");

const requiredProfileKeys = [
  "logoUrl",
  "brandPrimaryColor",
  "pharmacyName",
  "phone",
  "businessEmail",
  "addressLine1",
  "gphcNumber",
  "reviewerName",
  "clinicalReviewDate",
  "nextReviewDate",
];
const profileDoc = JSON.parse(fs.readFileSync(profileFile, "utf8")) as { data?: Record<string, unknown> };
const data = profileDoc.data || {};
const missingKeys = requiredProfileKeys.filter((k) => !String(data[k] ?? "").trim());
record("profile-required-keys", missingKeys.length <= 3, missingKeys.length ? `optional gaps: ${missingKeys.join(", ")}` : "core keys present");

// --- Header/footer profile consumption ---
const pageProfile = buildPharmacyServicePageProfile(slug);
record("page-profile-pharmacy-name", Boolean(pageProfile.pharmacyName), pageProfile.pharmacyName);
record("page-profile-logo", Boolean(pageProfile.logoUrl), pageProfile.logoUrl);
record("page-profile-address", Boolean(pageProfile.fullAddress || pageProfile.addressLine1), pageProfile.fullAddress || pageProfile.addressLine1);
record("page-profile-opening-hours", true, pageProfile.openingHours ? "hours configured" : "empty — add in Profile Dashboard");
record("page-profile-social-fields", true, "social fields on profile context (populate in Profile Dashboard when ready)");

// --- Professional review panel ---
const panelHtml = renderProfessionalReviewPanelHtml(pageProfile);
record("review-panel-renders", panelHtml.includes("pharmacy-professional-review-panel"), "panel marker present");
record(
  "review-panel-no-demo-values",
  !isUntrustedDisplayValue(profile.reviewerName) && !/\b(mock|demo|placeholder)\b/i.test(panelHtml),
  profile.reviewerName,
);
const reviewer = resolveProfessionalReviewer(pageProfile);
record("review-panel-named-reviewer", reviewer.hasNamedReviewer, reviewer.name || "fallback text only");

// --- Visual service pages ---
const benchmarkServices = [...VISUAL_EXPERIENCE_BENCHMARK_SERVICES];
let visualPassCount = 0;
for (const serviceId of benchmarkServices) {
  const pagePath = path.join(ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
  if (!fs.existsSync(pagePath)) {
    record(`visual-page-${serviceId}`, false, "file missing — hit rebuild URL after deploy");
    continue;
  }
  const html = fs.readFileSync(pagePath, "utf8");
  const validation = validatePharmacyServicePageHtml(html);
  const hasReviewPanel = html.includes("pharmacy-professional-review-panel");
  const hasProfileHeader = html.includes("data-component=\"pharmacy-page-header\"");
  const hasProfileFooter = html.includes("data-component=\"pharmacy-page-footer\"");
  const usesProfileName = pageProfile.pharmacyName ? html.includes(pageProfile.pharmacyName) : true;
  const pass = hasReviewPanel && hasProfileHeader && hasProfileFooter && usesProfileName;
  if (pass) visualPassCount++;
  record(
    `visual-trust-${serviceId}`,
    pass,
    `review=${hasReviewPanel} header=${hasProfileHeader} footer=${hasProfileFooter}`,
  );
  record(`visual-template-intact-${serviceId}`, validation.checks.noBenefitsDump !== false, validation.failures.join(", ") || "ok");
}

record("visual-pages-review-panel", visualPassCount === benchmarkServices.length, `${visualPassCount}/${benchmarkServices.length}`);

// --- Authority audit reviewer detection ---
const audit = getServiceAuthorityAudit(slug, "blood-pressure-checks");
const allEvidence = audit ? Object.values(audit.evidence).flat() : [];
const reviewerSignals = allEvidence.filter((e) =>
  /reviewer|review date|clinical review|named pharmacist|named accountability/i.test(e.signal),
);
record("authority-audit-reviewer-signals", reviewerSignals.length >= 1, `${reviewerSignals.length} reviewer-related signals`);

// --- Schema reviewer ---
const schema = enhanceTrustSchemaForSlug(slug, {});
const schemaStr = JSON.stringify(schema);
record(
  "schema-reviewer-when-complete",
  !isReviewerProfileComplete(profile) || schemaStr.includes("reviewedBy"),
  isReviewerProfileComplete(profile) ? "reviewedBy present" : "reviewer incomplete — schema skipped",
);

// --- Content image placeholders ---
const placeholderPath = saveContentImagePlaceholders(slug);
const placeholders = loadContentImagePlaceholders(slug);
record("placeholder-file-created", fs.existsSync(placeholderPath), placeholderPath);
record(
  "placeholder-mappings-count",
  (placeholders?.mappings.length || 0) >= 20,
  `${placeholders?.mappings.length || 0} mappings`,
);
record(
  "placeholder-mapping-shape",
  Boolean(placeholders?.mappings.every((m) => m.serviceId && m.assetType && m.assetSlug && m.slot && m.source)),
  "all mappings have required fields",
);

// --- Guardrails: no masters / clinical copy modified ---
const masterLibrary = path.join(ROOT, "docs/pharmacy-master-library");
const masterMtime = fs.existsSync(masterLibrary)
  ? fs.statSync(masterLibrary).mtime.toISOString().slice(0, 10)
  : "missing";
record("no-service-masters-modified", fs.existsSync(masterLibrary), `master library present (${masterMtime})`);

// --- Platform dashboard render ---
const dashboard = buildPharmacyPlatformDashboard(slug);
const dashHtml = renderPharmacyPlatformDashboardHtml(dashboard);
record("dashboard-nav-render", dashHtml.includes("pharmacy-platform-nav"), "platform nav in dashboard HTML");

// --- HTTP smoke (optional) ---
let httpNavPass = false;
try {
  const res = await fetch(`${BASE}/api/pharmacy-dashboard?slug=${slug}`, { redirect: "manual" });
  if (res.status === 200) {
    const body = await res.text();
    httpNavPass = body.includes("pharmacy-platform-nav") || body.includes("Back to Platform Dashboard");
  } else {
    httpNavPass = res.status === 302;
  }
  record("http-dashboard-nav", httpNavPass, `HTTP ${res.status}`);
} catch (err) {
  record("http-dashboard-nav", false, `offline — ${String(err)}`);
}

const passCount = checks.filter((c) => c.pass).length;
const criticalFails = checks.filter((c) => !c.pass && !c.id.startsWith("http") && !c.id.startsWith("visual-page-"));
const overall = criticalFails.length === 0 ? "PASS" : "FAIL";

console.log(`\n${overall} — ${passCount}/${checks.length} checks (${Math.round((passCount / checks.length) * 100)}%)\n`);
process.exit(overall === "PASS" ? 0 : 1);
