#!/usr/bin/env npx tsx
/**
 * Brook restore-access regressions: legacy campaign normalisation + tenant-scoped identity.
 * Does not generate pages, publish, or write Yorkshire/Derby outputs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCampaignLinks,
  normalizePharmacyCampaign,
  readPharmacyCampaignStore,
} from "../src/pharmacy/pharmacyCampaignService.ts";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { validateVisualPageTenant } from "../src/pharmacy/pharmacyAssetWorkflowService.ts";
import {
  detectForeignPharmacyIdentities,
  detectForeignPharmacyIdentitiesInImageAlts,
  htmlMatchesRequestedTenantIdentity,
  isRequestedTenantIdentity,
} from "../src/pharmacy/pharmacyTenantIdentityIsolation.ts";
import { validateCustomerFacingServicePageHtml } from "../src/pharmacy/pharmacyServicePagePublicationQualityGate.ts";
import {
  loadContentPackage,
  reevaluateContentPackageMetadataFromExistingOutputs,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import { loadGenerationReport } from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "brook-pharmacy";
const SERVICE_ID = "pharmacy-first";
const BROOK_NAME = "Brook Pharmacy";
const LEEDS_NAME = "Leeds Pharmacy";
const YORKSHIRE_NAME = "Yorkshire Pharmacy and Health Clinic";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

const campaignPath = path.join(ROOT, "data/pharmacy-campaigns", `${SLUG}.json`);
const visualHtmlPath = path.join(
  ROOT,
  "output/pharmacy-visual-experience",
  SLUG,
  SERVICE_ID,
  "index.html",
);
const identitySource = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/pharmacyTenantIdentityIsolation.ts"),
  "utf8",
);
const assetWorkflowSource = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/pharmacyAssetWorkflowService.ts"),
  "utf8",
);
const integritySource = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/pharmacyGenerationIntegrityService.ts"),
  "utf8",
);
const qualityGateSource = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/pharmacyServicePagePublicationQualityGate.ts"),
  "utf8",
);

const diskCampaign = JSON.parse(fs.readFileSync(campaignPath, "utf8")) as {
  campaigns?: Array<Record<string, unknown>>;
};
const diskPrimary = diskCampaign.campaigns?.[0] || {};
record(
  "disk-legacy-missing-links",
  !diskPrimary.links && !diskPrimary.publishingStatus && !diskPrimary.indexingStatus && !diskPrimary.visibilityStatus,
  "on-disk CR02 campaign still has no links or publication statuses",
);

const normalized = normalizePharmacyCampaign(SLUG, {
  id: String(diskPrimary.id || "cr02-brook-pharmacy-first"),
  serviceId: String(diskPrimary.serviceId || SERVICE_ID),
  name: String(diskPrimary.name || ""),
  status: diskPrimary.status === "archived" ? "archived" : "active",
  assetCounts: diskPrimary.assetCounts as { servicePage?: number } | undefined,
});
record(
  "legacy-links-derived",
  Boolean(normalized.links?.ecosystem && normalized.links?.publishedPage),
  `ecosystem=${normalized.links.ecosystem}`,
);
record(
  "legacy-links-tenant-scoped",
  normalized.links.ecosystem.includes(`slug=${SLUG}`) &&
    normalized.links.publishedPage.includes(`slug=${SLUG}`) &&
    normalized.links.indexing.includes(`slug=${SLUG}`) &&
    normalized.links.visibility.includes(`slug=${SLUG}`),
  `${normalized.links.publishedPage} · ${normalized.links.ecosystem}`,
);
record(
  "legacy-links-not-other-tenant",
  !normalized.links.ecosystem.includes("yorkshire") &&
    !normalized.links.publishedPage.includes("pharmaconnect") &&
    !normalized.links.publishedPage.includes("brook-pharmacy-demo-derby"),
  "links stay on brook-pharmacy",
);
record(
  "legacy-status-unknown",
  normalized.publishingStatus === "unknown" &&
    normalized.indexingStatus === "unknown" &&
    normalized.visibilityStatus === "unknown",
  `${normalized.publishingStatus}/${normalized.indexingStatus}/${normalized.visibilityStatus}`,
);
record(
  "legacy-status-not-success",
  normalized.publishingStatus !== "published" &&
    normalized.indexingStatus !== "indexed" &&
    normalized.visibilityStatus !== "visible" &&
    normalized.publishedPages === 0 &&
    normalized.indexedPages === 0 &&
    normalized.visiblePages === 0,
  `pages ${normalized.publishedPages}/${normalized.indexedPages}/${normalized.visiblePages}`,
);

const helperLinks = buildCampaignLinks(SLUG, SERVICE_ID);
record(
  "helper-links-match-normalisation",
  helperLinks.ecosystem === normalized.links.ecosystem && helperLinks.publishedPage === normalized.links.publishedPage,
  helperLinks.publishedPage,
);

const store = readPharmacyCampaignStore(SLUG);
const stored = store?.campaigns.find((campaign) => campaign.serviceId === SERVICE_ID);
record(
  "read-store-normalises-in-memory",
  Boolean(stored?.links?.ecosystem?.includes(`slug=${SLUG}`)) && stored?.publishingStatus === "unknown",
  stored ? `${stored.links.publishedPage} · ${stored.publishingStatus}` : "missing store",
);

const diskAfterRead = fs.readFileSync(campaignPath, "utf8");
record(
  "read-store-does-not-persist",
  diskAfterRead === JSON.stringify(diskCampaign, null, 2) || !diskAfterRead.includes('"links"'),
  "campaign JSON on disk remains legacy",
);

let dashboardOk = false;
let dashboardError = "";
try {
  const dashboard = buildPharmacyPlatformDashboard(SLUG);
  dashboardOk = dashboard.slug === SLUG && Boolean(dashboard.identity.pharmacyName);
  record(
    "dashboard-builds",
    dashboardOk,
    `${dashboard.identity.pharmacyName} · campaign=${dashboard.currentCampaign?.name || "none"}`,
  );
} catch (err) {
  dashboardError = String(err);
  record("dashboard-builds", false, dashboardError);
}

const brookHtml = fs.existsSync(visualHtmlPath) ? fs.readFileSync(visualHtmlPath, "utf8") : "";
record("brook-visual-html-present", brookHtml.includes(BROOK_NAME), visualHtmlPath);

record(
  "brook-passes-own-identity",
  isRequestedTenantIdentity(BROOK_NAME, BROOK_NAME) && htmlMatchesRequestedTenantIdentity(brookHtml, BROOK_NAME),
  "canonical Brook identity matches Brook HTML",
);
record(
  "brook-html-own-identity-not-foreign",
  detectForeignPharmacyIdentities(brookHtml, BROOK_NAME).length === 0,
  "Brook HTML is not foreign against Brook canonical name",
);

const visualCheck = validateVisualPageTenant(SLUG, SERVICE_ID, BROOK_NAME);
record(
  "brook-visual-tenant-ok",
  visualCheck.ok === true,
  visualCheck.ok ? visualCheck.path || "ok" : `${visualCheck.reason}: ${visualCheck.detail || ""}`,
);

const brookVsLeeds = detectForeignPharmacyIdentities(brookHtml, LEEDS_NAME);
record(
  "brook-html-fails-leeds-canonical",
  brookVsLeeds.some((hit) => hit.name === BROOK_NAME),
  brookVsLeeds.map((hit) => hit.name).join(", ") || "no foreign hits",
);

const leedsBranded = `<html><body><h1>${LEEDS_NAME}</h1><p>${LEEDS_NAME} Pharmacy First in Leeds.</p></body></html>`;
const leedsVsBrook = detectForeignPharmacyIdentities(leedsBranded, BROOK_NAME);
record(
  "leeds-html-fails-brook-canonical",
  leedsVsBrook.some((hit) => hit.name === LEEDS_NAME) && !htmlMatchesRequestedTenantIdentity(leedsBranded, BROOK_NAME),
  leedsVsBrook.map((hit) => hit.name).join(", "),
);

const yorkshireBranded = `<html><body><h1>${YORKSHIRE_NAME}</h1><p>Yorkshire Pharmacy &amp; Health Clinic Pharmacy First.</p></body></html>`;
const yorkshireVsBrook = detectForeignPharmacyIdentities(yorkshireBranded, BROOK_NAME);
record(
  "yorkshire-html-fails-brook-canonical",
  yorkshireVsBrook.some((hit) => /Yorkshire/i.test(hit.name)),
  yorkshireVsBrook.map((hit) => hit.name).join(", "),
);

const brookWithLeedsAlts = `<html><body><h1>${BROOK_NAME}</h1><img alt="Leeds Pharmacy, Leeds" src="/hero.jpg"><img alt="Leeds Pharmacy, Leeds" src="/trust.jpg"></body></html>`;
const altHits = detectForeignPharmacyIdentitiesInImageAlts(brookWithLeedsAlts, BROOK_NAME);
const brandHitsIgnoringAlts = detectForeignPharmacyIdentities(brookWithLeedsAlts, BROOK_NAME);
record(
  "leeds-image-alts-are-warnings-not-identity-fail",
  brandHitsIgnoringAlts.length === 0 && altHits.some((hit) => hit.name === LEEDS_NAME && hit.inImageAlt),
  `brandHits=${brandHitsIgnoringAlts.length} altHits=${altHits.map((hit) => hit.name).join(",")}`,
);

const brookQuality = validateCustomerFacingServicePageHtml(brookHtml, { canonicalPharmacyName: BROOK_NAME });
record(
  "quality-gate-brook-not-self-leak",
  !brookQuality.failures.some((failure) => failure.id === "demo-tenant-leak"),
  brookQuality.failures.map((failure) => failure.id).join(", ") || "no demo-tenant-leak",
);
const leedsQuality = validateCustomerFacingServicePageHtml(leedsBranded, { canonicalPharmacyName: BROOK_NAME });
record(
  "quality-gate-foreign-still-fails",
  leedsQuality.failures.some((failure) => failure.id === "demo-tenant-leak"),
  leedsQuality.failures.map((failure) => `${failure.id}:${failure.detail}`).join("; "),
);

record(
  "no-brook-slug-bypass",
  !/slug\s*===\s*["']brook-pharmacy["']/.test(identitySource) &&
    !/slug\s*===\s*["']brook-pharmacy["']/.test(assetWorkflowSource) &&
    !/if\s*\(\s*key\s*===\s*["']brook-pharmacy["']/.test(assetWorkflowSource),
  "identity checks are canonical-name based",
);
record(
  "no-blanket-brook-foreign-rule",
  !/if\s*\(\s*\/Brook Pharmacy\/i\.test\(html\)/.test(assetWorkflowSource) &&
    !/if\s*\(\s*\/Brook Pharmacy\/i\.test\(html\)/.test(integritySource) &&
    !/if\s*\(\s*\/Brook Pharmacy\/i\.test\(html\)/.test(qualityGateSource),
  "blanket Brook Pharmacy HTML fail-closed rule removed",
);

const beforePkg = loadContentPackage(SLUG, SERVICE_ID);
const preservedGeneratedAt = beforePkg?.generatedAt || "";
const preservedApproval = beforePkg?.approvalStatus || "";
const pkg = reevaluateContentPackageMetadataFromExistingOutputs(SLUG, SERVICE_ID);
const report = loadGenerationReport(SLUG, SERVICE_ID);
const serviceAsset = pkg.assets.find((asset) => asset.type === "service-page");
const localAsset = pkg.assets.find((asset) => asset.type === "local-area-pages");

record(
  "reeval-tenant-ok",
  pkg.tenantValidation?.ok === true && report?.tenantValidation.ok === true,
  pkg.tenantValidation?.detail || "missing tenantValidation",
);
record(
  "reeval-service-included",
  serviceAsset?.status === "included" && Boolean(serviceAsset.previewUrl?.includes(`slug=${SLUG}`)),
  `${serviceAsset?.status} · ${serviceAsset?.previewUrl || "no preview"}`,
);
record(
  "reeval-local-count-discrepancy-kept",
  localAsset?.status === "error" &&
    /Expected 8 local pages, generated 17/.test(localAsset?.notes || "") &&
    localAsset?.count === 17,
  localAsset?.notes || "missing local notes",
);
record(
  "reeval-package-still-error",
  pkg.status === "error" && pkg.packageValidation?.ok === false,
  `${pkg.status} · ${pkg.packageValidation?.detail || ""}`,
);
record(
  "reeval-approval-unchanged",
  pkg.approvalStatus === preservedApproval && pkg.generatedAt === preservedGeneratedAt && pkg.reviewedAt == null,
  `approval=${pkg.approvalStatus} generatedAt=${pkg.generatedAt}`,
);
record(
  "reeval-generation-error-not-foreign-assets",
  !/foreign assets:/i.test(pkg.generationError || "") && /local/i.test(pkg.generationError || ""),
  pkg.generationError || "null",
);
record(
  "reeval-leeds-alt-warning",
  Boolean(report?.warnings.some((warning) => /Image alt foreign identity: Leeds Pharmacy/.test(warning))) &&
    /Image alt remnants: Leeds Pharmacy/.test(serviceAsset?.notes || "") &&
    /Image alt remnants: Leeds Pharmacy/.test(localAsset?.notes || ""),
  `warnings=${(report?.warnings || []).filter((warning) => /Image alt/.test(warning)).join(" | ")}`,
);
record(
  "reeval-local-preview-restored",
  Boolean(localAsset?.previewUrl) && localAsset?.status === "error",
  localAsset?.previewUrl || "no local preview",
);

const diskCampaignAfter = fs.readFileSync(campaignPath, "utf8");
record("campaign-json-still-legacy", !/"links"\s*:/.test(diskCampaignAfter), campaignPath);

const failed = checks.filter((check) => !check.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) {
  console.error(failed.map((check) => `FAIL ${check.id}: ${check.detail}`).join("\n"));
  process.exit(1);
}
console.log("PASS  brook-legacy-campaign-access-v1");
