/**
 * Pharmacy-wide service opportunity assessment from stored evidence only.
 * Connects search demand, website import, organic SERP, content packages and Google-local.
 */
import fs from "node:fs";
import path from "node:path";
import { readNationalCompetitorDiscovery } from "./nationalCompetitorDiscoveryStorageService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import type {
  GrowthOpportunity,
  OpportunityConfidence,
} from "./growthEngineOpportunityModel.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  loadContentPackage,
} from "./pharmacyContentPackageService.ts";
import { PHARMACY_WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import { readServiceSearchDemandArtifact } from "./serviceSearchDemandStorage.ts";
import { buildServiceSearchDemandQuerySpecs } from "./serviceSearchDemandQueryBuilder.ts";
import type { ServiceSearchDemandQueryRow } from "./serviceSearchDemandModel.ts";

export type WebsiteCoverageClassification =
  | "adequate-existing-page"
  | "weak-existing-evidence"
  | "missing-dedicated-page"
  | "unknown";

export type OrganicVisibilityClassification =
  | "visible-top-3"
  | "visible-top-10"
  | "visible-below-10"
  | "not-visible-in-collected-results"
  | "unavailable";

export type ServiceOpportunityClassification =
  | "ready-to-build"
  | "improve-existing"
  | "optimise-and-track"
  | "maintain"
  | "insufficient-evidence";

export type ServiceWorkflowAction =
  | "review-generated-package"
  | "complete-generated-package"
  | "build-dedicated-content"
  | "improve-existing-page"
  | "publish-approved-package"
  | "track-published-content";

export type ServicePriorityComparisonFields = {
  websiteCoverageRank: number;
  websiteCoverage: WebsiteCoverageClassification;
  organicVisibilityRank: number;
  organicVisibility: OrganicVisibilityClassification;
  highestQueryVolume: number | null;
  pharmacyIntentVolume: number | null;
  nearMeVolume: number | null;
  serviceId: string;
};

export type ServiceDemandEvidenceSummary = {
  canonicalQueryVolume: number | null;
  highestQueryVolume: number | null;
  highestQuery: string | null;
  pharmacyIntentVolume: number | null;
  nearMeVolume: number | null;
  nhsQueryVolume: number | null;
  queriesWithData: number;
  totalQueries: number;
  demandEvidenceStatus: "complete" | "partial" | "unavailable" | "unknown";
  monthlyHistoryAvailable: boolean;
  cpcRange: { min: number | null; max: number | null; currency: "USD" | null };
  paidCompetitionRange: { levels: string[] };
};

export type ServiceWebsiteCoverageEvidence = {
  dedicatedImportedPageUrl: string | null;
  pageTitleOrEvidence: string | null;
  storedConfidence: number | null;
  evidenceStrength: string | null;
  generatedPackageStatus: "generated" | "not-generated" | "unknown";
  existingServicePage: "yes" | "no" | "unknown";
  supportingCoverage: string[];
  classification: WebsiteCoverageClassification;
};

export type ServiceOrganicVisibilityEvidence = {
  localQueriesCollected: string[];
  tenantDomainAppears: boolean;
  bestTenantPosition: number | null;
  bestTenantRankingUrl: string | null;
  otherRankingDomains: string[];
  evidenceCapturedAt: string | null;
  classification: OrganicVisibilityClassification;
};

export type ServiceGeneratedContentCoverage = {
  packageGenerated: boolean;
  servicePageIncluded: boolean;
  faqIncluded: boolean;
  guidesIncluded: boolean;
  blogIncluded: boolean;
  localClusterIncluded: boolean;
};

export type ServiceOpportunityRow = {
  serviceId: string;
  serviceName: string;
  confirmed: true;
  demand: ServiceDemandEvidenceSummary;
  websiteCoverage: ServiceWebsiteCoverageEvidence;
  organicVisibility: ServiceOrganicVisibilityEvidence;
  generatedContentCoverage: ServiceGeneratedContentCoverage;
  opportunityClassification: ServiceOpportunityClassification;
  priorityComparisonFields: ServicePriorityComparisonFields;
  workflowAction: ServiceWorkflowAction;
  packageStatus: string;
  priorityRationale: string;
  recommendedAction: string;
  evidenceConfidence: OpportunityConfidence;
  priorityRank: number;
};

export type ServiceTopPrioritySummary = {
  serviceId: string;
  serviceName: string;
  priorityRationale: string;
  websiteEvidence: string;
  demandEvidence: string;
  organicVisibility: string;
  packageStatus: string;
  workflowAction: ServiceWorkflowAction;
  recommendedAction: string;
  priorityComparisonFields: ServicePriorityComparisonFields;
};

export type PharmacyWideServiceOpportunityAssessment = {
  slug: string;
  generatedAt: string;
  confirmedServiceCount: number;
  services: ServiceOpportunityRow[];
  topPriorityServices: ServiceTopPrioritySummary[];
  googleProfileActions: GrowthOpportunity[];
  evidenceLimitations: string[];
};

const GENERIC_PAGE_PATH =
  /\/privacy-policy|\/cookie|\/terms|\/about-us\/?$|\/services\/?$|^\/$|\/book-a-service/i;

const SERVICE_PATH_HINTS: Record<string, RegExp[]> = {
  "blood-pressure-checks": [/blood-pressure/, /hypertension/, /blood-pressure-check/],
  "discharge-medicines-service": [/discharge-medicines/, /discharge-medicine/],
  "flu-vaccinations": [/flu-vaccination/, /flu-jab/, /flu-vacc/],
  "health-checks": [/health-check/, /health-screen/],
  "independent-prescriber": [/independent-prescriber/, /private-prescriber/, /prescriber/],
  "malaria-prevention": [/malaria/, /antimalarial/, /travel-health/],
  "medication-reviews": [/medication-review/, /medicines-review/],
  "minor-ailments": [/minor-ailment/, /pharmacy-first/],
  "new-medicine-service": [/new-medicine/, /nms/],
  "pharmacy-first": [/pharmacy-first/],
  "prescription-dispensing": [/prescription-dispensing/, /dispensing/],
  "repeat-prescriptions": [/repeat-prescription/, /repeat-prescriptions/],
  "smoking-cessation": [/smoking-cessation/, /stop-smoking/, /healthy-lifestyle/],
  "weight-management": [/weight-loss/, /weight-management/, /weight-loss-clinic/],
};

function clean(value: unknown): string {
  return String(value || "").trim();
}

function resolveConfirmedServiceIds(profile: ReturnType<typeof readSetupProfile>): string[] {
  const selected = Array.isArray(profile.selectedServices) ? profile.selectedServices : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of selected) {
    const id = clean(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function serviceLabel(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function canonicalHost(raw: unknown): string {
  const value = clean(raw);
  if (!value) return "";
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function hostsMatch(a: string, b: string): boolean {
  const left = canonicalHost(a);
  const right = canonicalHost(b);
  return Boolean(left && right && left === right);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function competitionWeight(level: string | null): number {
  const v = clean(level).toUpperCase();
  if (v === "LOW") return 1;
  if (v === "MEDIUM") return 2;
  if (v === "HIGH") return 3;
  return 0;
}

function classifyDemandRow(
  query: string,
  specs: ReturnType<typeof buildServiceSearchDemandQuerySpecs>,
): "canonical" | "pharmacy" | "near-me" | "nhs" | "other" {
  const spec = specs.find((s) => s.query.toLowerCase() === query.toLowerCase());
  if (!spec) return "other";
  if (spec.queryType === "nhs") return "nhs";
  if (spec.queryType === "near-me") return "near-me";
  if (spec.queryType === "pharmacy") return "pharmacy";
  if (spec.queryType === "canonical") return "canonical";
  return "other";
}

function buildDemandSummary(
  slug: string,
  serviceId: string,
  rows: ServiceSearchDemandQueryRow[],
): ServiceDemandEvidenceSummary {
  const specs = buildServiceSearchDemandQuerySpecs({ serviceId, slug });
  const totalQueries = specs.length || rows.length;
  const withData = rows.filter(
    (r) => r.availability === "available" || r.availability === "zero",
  );

  let canonicalQueryVolume: number | null = null;
  let pharmacyIntentVolume: number | null = null;
  let nearMeVolume: number | null = null;
  let nhsQueryVolume: number | null = null;
  let highestQueryVolume: number | null = null;
  let highestQuery: string | null = null;

  for (const row of rows) {
    const vol = row.searchVolume;
    const kind = classifyDemandRow(row.query, specs);
    if (kind === "canonical") canonicalQueryVolume = vol;
    if (kind === "pharmacy") pharmacyIntentVolume = vol;
    if (kind === "near-me") nearMeVolume = vol;
    if (kind === "nhs") nhsQueryVolume = vol;
    if (vol !== null && (highestQueryVolume === null || vol > highestQueryVolume)) {
      highestQueryVolume = vol;
      highestQuery = row.query;
    }
  }

  const cpcs = rows.map((r) => r.cpc).filter((v): v is number => v !== null);
  const competitionLevels = [
    ...new Set(rows.map((r) => r.competition).filter(Boolean) as string[]),
  ].sort((a, b) => competitionWeight(a) - competitionWeight(b));

  let demandEvidenceStatus: ServiceDemandEvidenceSummary["demandEvidenceStatus"] = "unknown";
  if (!rows.length) demandEvidenceStatus = "unknown";
  else if (withData.length === 0) demandEvidenceStatus = "unavailable";
  else if (withData.length === rows.length) demandEvidenceStatus = "complete";
  else demandEvidenceStatus = "partial";

  return {
    canonicalQueryVolume,
    highestQueryVolume,
    highestQuery,
    pharmacyIntentVolume,
    nearMeVolume,
    nhsQueryVolume,
    queriesWithData: withData.length,
    totalQueries,
    demandEvidenceStatus,
    monthlyHistoryAvailable: rows.some((r) => r.monthlySearches.length > 0),
    cpcRange: {
      min: cpcs.length ? Math.min(...cpcs) : null,
      max: cpcs.length ? Math.max(...cpcs) : null,
      currency: cpcs.length ? "USD" : null,
    },
    paidCompetitionRange: { levels: competitionLevels },
  };
}

function pathMatchesService(serviceId: string, url: string): boolean {
  if (!url) return false;
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  if (GENERIC_PAGE_PATH.test(path)) return false;
  const hints = SERVICE_PATH_HINTS[serviceId] || [new RegExp(serviceId.replace(/-/g, "[-/]"))];
  return hints.some((re) => re.test(path));
}

function buildWebsiteCoverage(slug: string, serviceId: string): ServiceWebsiteCoverageEvidence {
  const profile = readSetupProfile(slug);
  const snap = profile.websiteImportSnapshot as {
    customerVisibleServices?: Array<{
      serviceId?: string;
      sourceUrl?: string;
      matchedSnippet?: string;
      confidence?: number;
      detectionMethod?: string;
    }>;
    intelligence?: {
      services?: Array<{
        serviceId?: string;
        serviceName?: string;
        exists?: boolean;
        url?: string;
        contentQualityEstimate?: string;
        evidence?: { sourceUrl?: string; confidence?: number; detectionMethod?: string };
      }>;
      commercialServiceEvidence?: Array<{
        serviceId?: string;
        sourceUrl?: string;
        pageTitle?: string;
        confidence?: number;
      }>;
    };
  } | null;

  if (!snap) {
    return {
      dedicatedImportedPageUrl: null,
      pageTitleOrEvidence: null,
      storedConfidence: null,
      evidenceStrength: null,
      generatedPackageStatus: contentPackageGenerated(slug, serviceId) ? "generated" : "not-generated",
      existingServicePage: "unknown",
      supportingCoverage: [],
      classification: "unknown",
    };
  }

  const intelServices = snap.intelligence?.services || [];
  const imported = intelServices.find((s) => clean(s.serviceId) === serviceId);
  const commercial = (snap.intelligence?.commercialServiceEvidence || []).find(
    (s) => clean(s.serviceId) === serviceId || clean(s.serviceId) === `website:${serviceId}`,
  );
  const visible = (snap.customerVisibleServices || []).find((s) => clean(s.serviceId) === serviceId);

  const dedicatedUrl = clean(commercial?.sourceUrl || imported?.url);
  const pageTitle = clean(commercial?.pageTitle || imported?.serviceName);
  const evidenceText = clean(visible?.matchedSnippet || imported?.evidence?.sourceUrl);
  const storedConfidence =
    num(commercial?.confidence) ??
    num(imported?.evidence?.confidence) ??
    num(visible?.confidence);
  const evidenceStrength = clean(imported?.contentQualityEstimate) || null;

  const packageGeneratedFlag = contentPackageGenerated(slug, serviceId);
  const pkg = packageGeneratedFlag ? loadContentPackage(slug, serviceId) : null;
  const servicePageIncluded = Boolean(pkg?.assets?.some((a) => a.type === "service-page" && a.included));

  let classification: WebsiteCoverageClassification = "missing-dedicated-page";
  if (commercial && pathMatchesService(serviceId, dedicatedUrl)) {
    classification = "adequate-existing-page";
  } else if (imported?.exists && dedicatedUrl && pathMatchesService(serviceId, dedicatedUrl)) {
    classification = "adequate-existing-page";
  } else if (imported?.exists || visible || dedicatedUrl) {
    classification = "weak-existing-evidence";
  } else if (imported && imported.exists === false) {
    classification = "missing-dedicated-page";
  }

  const supporting: string[] = [];
  if (visible?.detectionMethod === "service-listing") {
    supporting.push("Listed on services index page");
  }
  if (pkg?.assets?.some((a) => a.type === "faq" && a.included)) supporting.push("Generated FAQ package");
  if (pkg?.assets?.some((a) => a.type === "guides" && a.included)) supporting.push("Generated guide content");
  if (pkg?.assets?.some((a) => a.type === "blog" && a.included)) supporting.push("Generated blog content");

  return {
    dedicatedImportedPageUrl: dedicatedUrl || null,
    pageTitleOrEvidence: pageTitle || evidenceText || null,
    storedConfidence,
    evidenceStrength,
    generatedPackageStatus: packageGeneratedFlag ? "generated" : "not-generated",
    existingServicePage: servicePageIncluded ? "yes" : packageGeneratedFlag ? "no" : "unknown",
    supportingCoverage: supporting,
    classification,
  };
}

function buildOrganicVisibility(slug: string, serviceId: string): ServiceOrganicVisibilityEvidence {
  const profile = readSetupProfile(slug);
  const tenantHost = canonicalHost(profile.website);
  const discovery = readNationalCompetitorDiscovery(slug);
  const run = discovery?.organicSearchByService?.[serviceId] || null;

  if (!run?.generated || !run.queries?.length) {
    return {
      localQueriesCollected: [],
      tenantDomainAppears: false,
      bestTenantPosition: null,
      bestTenantRankingUrl: null,
      otherRankingDomains: [],
      evidenceCapturedAt: null,
      classification: "unavailable",
    };
  }

  const tenantRows = run.competitors.filter((row) => hostsMatch(row.host || row.domain, tenantHost));
  const bestTenant = tenantRows
    .filter((r) => r.position != null)
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))[0];

  const otherDomains = [
    ...new Set(
      run.competitors
        .filter((r) => !hostsMatch(r.host || r.domain, tenantHost))
        .map((r) => clean(r.domain || r.host))
        .filter(Boolean),
    ),
  ].slice(0, 8);

  let classification: OrganicVisibilityClassification = "not-visible-in-collected-results";
  if (bestTenant?.position != null) {
    if (bestTenant.position <= 3) classification = "visible-top-3";
    else if (bestTenant.position <= 10) classification = "visible-top-10";
    else classification = "visible-below-10";
  }

  return {
    localQueriesCollected: [...run.queries],
    tenantDomainAppears: tenantRows.length > 0,
    bestTenantPosition: bestTenant?.position ?? null,
    bestTenantRankingUrl: bestTenant?.url ?? null,
    otherRankingDomains: otherDomains,
    evidenceCapturedAt: run.capturedAt,
    classification,
  };
}

function buildGeneratedContentCoverage(slug: string, serviceId: string): ServiceGeneratedContentCoverage {
  const generated = contentPackageGenerated(slug, serviceId);
  const pkg = generated ? loadContentPackage(slug, serviceId) : null;
  const has = (type: string) => Boolean(pkg?.assets?.some((a) => a.type === type && a.included));
  return {
    packageGenerated: generated,
    servicePageIncluded: has("service-page"),
    faqIncluded: has("faq"),
    guidesIncluded: has("guides"),
    blogIncluded: has("blog"),
    localClusterIncluded: has("local-area-pages"),
  };
}

function hasCredibleDemand(demand: ServiceDemandEvidenceSummary): boolean {
  return demand.queriesWithData > 0 && demand.highestQueryVolume !== null && demand.highestQueryVolume > 0;
}

function classifyOpportunity(input: {
  demand: ServiceDemandEvidenceSummary;
  website: ServiceWebsiteCoverageEvidence;
  organic: ServiceOrganicVisibilityEvidence;
  content: ServiceGeneratedContentCoverage;
}): ServiceOpportunityClassification {
  const { demand, website, organic, content } = input;
  const credibleDemand = hasCredibleDemand(demand);
  const weakOrMissingPage =
    website.classification === "missing-dedicated-page" ||
    website.classification === "weak-existing-evidence";
  const adequatePage = website.classification === "adequate-existing-page" || content.servicePageIncluded;
  const poorVisibility =
    organic.classification === "not-visible-in-collected-results" ||
    organic.classification === "visible-below-10";
  const strongVisibility =
    organic.classification === "visible-top-3" || organic.classification === "visible-top-10";

  if (
    demand.demandEvidenceStatus === "unknown" &&
    website.classification === "unknown" &&
    organic.classification === "unavailable"
  ) {
    return "insufficient-evidence";
  }

  if (credibleDemand && weakOrMissingPage && !content.servicePageIncluded) {
    return "ready-to-build";
  }

  if (
    (website.classification === "weak-existing-evidence" || content.packageGenerated) &&
    (poorVisibility || !content.servicePageIncluded)
  ) {
    return "improve-existing";
  }

  if (adequatePage && (poorVisibility || demand.demandEvidenceStatus === "partial")) {
    return "optimise-and-track";
  }

  if (adequatePage && strongVisibility && credibleDemand) {
    return "maintain";
  }

  if (!credibleDemand && weakOrMissingPage) {
    return "insufficient-evidence";
  }

  if (weakOrMissingPage) return "ready-to-build";
  if (poorVisibility) return "improve-existing";
  return "optimise-and-track";
}

function websiteCoverageRank(classification: WebsiteCoverageClassification): number {
  const order: WebsiteCoverageClassification[] = [
    "missing-dedicated-page",
    "weak-existing-evidence",
    "adequate-existing-page",
    "unknown",
  ];
  return order.indexOf(classification);
}

function organicVisibilityRank(classification: OrganicVisibilityClassification): number {
  const order: OrganicVisibilityClassification[] = [
    "not-visible-in-collected-results",
    "visible-below-10",
    "unavailable",
    "visible-top-10",
    "visible-top-3",
  ];
  return order.indexOf(classification);
}

function compareDescNullable(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function buildServicePriorityComparisonFields(input: {
  serviceId: string;
  websiteCoverage: ServiceWebsiteCoverageEvidence;
  organicVisibility: ServiceOrganicVisibilityEvidence;
  demand: ServiceDemandEvidenceSummary;
}): ServicePriorityComparisonFields {
  return {
    websiteCoverageRank: websiteCoverageRank(input.websiteCoverage.classification),
    websiteCoverage: input.websiteCoverage.classification,
    organicVisibilityRank: organicVisibilityRank(input.organicVisibility.classification),
    organicVisibility: input.organicVisibility.classification,
    highestQueryVolume: input.demand.highestQueryVolume,
    pharmacyIntentVolume: input.demand.pharmacyIntentVolume,
    nearMeVolume: input.demand.nearMeVolume,
    serviceId: input.serviceId,
  };
}

export function compareServicePriority(
  a: ServicePriorityComparisonFields,
  b: ServicePriorityComparisonFields,
): number {
  if (a.websiteCoverageRank !== b.websiteCoverageRank) {
    return a.websiteCoverageRank - b.websiteCoverageRank;
  }
  if (a.organicVisibilityRank !== b.organicVisibilityRank) {
    return a.organicVisibilityRank - b.organicVisibilityRank;
  }
  const highest = compareDescNullable(a.highestQueryVolume, b.highestQueryVolume);
  if (highest !== 0) return highest;
  const pharmacy = compareDescNullable(a.pharmacyIntentVolume, b.pharmacyIntentVolume);
  if (pharmacy !== 0) return pharmacy;
  const nearMe = compareDescNullable(a.nearMeVolume, b.nearMeVolume);
  if (nearMe !== 0) return nearMe;
  return a.serviceId.localeCompare(b.serviceId);
}

function isServicePublished(slug: string, serviceId: string): boolean {
  const file = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-publish",
    safePharmacySlug(slug),
    "_publish-index.json",
  );
  if (!fs.existsSync(file)) return false;
  try {
    const index = JSON.parse(fs.readFileSync(file, "utf8")) as {
      pages?: Array<{ serviceId?: string; pageType?: string; status?: string }>;
    };
    return (index.pages || []).some(
      (page) =>
        clean(page.serviceId) === serviceId &&
        clean(page.pageType) === "service" &&
        clean(page.status || "published") === "published",
    );
  } catch {
    return false;
  }
}

function packageRequiredAssetsComplete(slug: string, serviceId: string): boolean {
  const pkg = loadContentPackage(slug, serviceId);
  if (!pkg) return false;
  const required = (pkg.assets || []).filter((asset) => asset.required);
  if (!required.length) return true;
  return required.every(
    (asset) => asset.included && asset.status !== "missing" && asset.status !== "error",
  );
}

export function resolveServiceWorkflowAction(input: {
  slug: string;
  serviceId: string;
  websiteCoverage: ServiceWebsiteCoverageEvidence;
  generatedContentCoverage: ServiceGeneratedContentCoverage;
}): ServiceWorkflowAction {
  const { slug, serviceId, websiteCoverage, generatedContentCoverage } = input;

  if (isServicePublished(slug, serviceId)) {
    return "track-published-content";
  }

  if (contentPackageApproved(slug, serviceId)) {
    return "publish-approved-package";
  }

  if (generatedContentCoverage.packageGenerated) {
    if (!packageRequiredAssetsComplete(slug, serviceId)) {
      return "complete-generated-package";
    }
    return "review-generated-package";
  }

  if (websiteCoverage.classification === "adequate-existing-page") {
    return "improve-existing-page";
  }

  return "build-dedicated-content";
}

function buildWorkflowActionCopy(action: ServiceWorkflowAction, serviceName: string): string {
  switch (action) {
    case "review-generated-package":
      return `Package generated — review the ${serviceName} service page and supporting assets.`;
    case "complete-generated-package":
      return `Package started — complete the missing required ${serviceName} assets before review.`;
    case "build-dedicated-content":
      return `No dedicated ${serviceName} page yet — build a dedicated service page and supporting content.`;
    case "improve-existing-page":
      return `An imported ${serviceName} page exists — improve page depth, local relevance and visibility.`;
    case "publish-approved-package":
      return `${serviceName} content is approved — publish the service page and supporting assets.`;
    case "track-published-content":
      return `${serviceName} content is published — track ranking and indexing for this service.`;
  }
}

function formatWebsiteEvidence(website: ServiceWebsiteCoverageEvidence): string {
  const label = website.classification.replace(/-/g, " ");
  if (website.dedicatedImportedPageUrl) {
    return `${label} — ${website.dedicatedImportedPageUrl}`;
  }
  if (website.pageTitleOrEvidence) {
    return `${label} — ${website.pageTitleOrEvidence}`;
  }
  return label;
}

function formatDemandEvidence(demand: ServiceDemandEvidenceSummary): string {
  if (demand.demandEvidenceStatus === "unknown") return "Demand evidence unknown";
  if (demand.demandEvidenceStatus === "unavailable") return "No returned search volume";
  const parts: string[] = [];
  if (demand.highestQueryVolume !== null && demand.highestQuery) {
    parts.push(
      `Peak query "${demand.highestQuery}" ${demand.highestQueryVolume.toLocaleString("en-GB")}/mo`,
    );
  }
  if (demand.pharmacyIntentVolume !== null) {
    parts.push(`Pharmacy-intent ${demand.pharmacyIntentVolume.toLocaleString("en-GB")}/mo`);
  }
  if (demand.nearMeVolume !== null) {
    parts.push(`Near-me ${demand.nearMeVolume.toLocaleString("en-GB")}/mo`);
  }
  return parts.join("; ") || "No returned search volume";
}

function formatOrganicEvidence(organic: ServiceOrganicVisibilityEvidence): string {
  if (organic.classification === "unavailable") {
    return "Organic visibility unavailable — no service-scoped SERP evidence stored";
  }
  return organic.classification.replace(/-/g, " ");
}

function formatPackageStatus(
  slug: string,
  serviceId: string,
  content: ServiceGeneratedContentCoverage,
): string {
  if (!content.packageGenerated) return "No content package generated";
  if (isServicePublished(slug, serviceId)) return "Published — tracking ranking and indexing";
  if (contentPackageApproved(slug, serviceId)) return "Package approved — ready to publish";
  const pkg = loadContentPackage(slug, serviceId);
  if (pkg?.reviewedAt) return "Package reviewed — awaiting approval";
  if (!packageRequiredAssetsComplete(slug, serviceId)) {
    return "Package generated — required assets still incomplete";
  }
  return "Package generated — awaiting Product Owner review";
}

function buildPriorityRationale(fields: ServicePriorityComparisonFields): string {
  const parts: string[] = [];
  parts.push(`Website coverage: ${fields.websiteCoverage.replace(/-/g, " ")}`);
  parts.push(`Organic visibility: ${fields.organicVisibility.replace(/-/g, " ")}`);
  if (fields.highestQueryVolume !== null) {
    parts.push(`Highest query volume: ${fields.highestQueryVolume.toLocaleString("en-GB")}`);
  }
  if (fields.pharmacyIntentVolume !== null) {
    parts.push(`Pharmacy-intent volume: ${fields.pharmacyIntentVolume.toLocaleString("en-GB")}`);
  }
  if (fields.nearMeVolume !== null) {
    parts.push(`Near-me volume: ${fields.nearMeVolume.toLocaleString("en-GB")}`);
  }
  return parts.join("; ");
}

function buildTopPrioritySummary(
  slug: string,
  row: ServiceOpportunityRow,
): ServiceTopPrioritySummary {
  return {
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    priorityRationale: row.priorityRationale,
    websiteEvidence: formatWebsiteEvidence(row.websiteCoverage),
    demandEvidence: formatDemandEvidence(row.demand),
    organicVisibility: formatOrganicEvidence(row.organicVisibility),
    packageStatus: row.packageStatus,
    workflowAction: row.workflowAction,
    recommendedAction: row.recommendedAction,
    priorityComparisonFields: row.priorityComparisonFields,
  };
}

function evidenceConfidence(row: {
  demand: ServiceDemandEvidenceSummary;
  websiteCoverage: ServiceWebsiteCoverageEvidence;
  organicVisibility: ServiceOrganicVisibilityEvidence;
}): OpportunityConfidence {
  let score = 0;
  if (row.demand.queriesWithData >= 3) score += 2;
  else if (row.demand.queriesWithData >= 1) score += 1;
  if (row.websiteCoverage.classification !== "unknown") score += 1;
  if (row.organicVisibility.classification !== "unavailable") score += 1;
  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function buildEvidenceLimitations(
  services: ServiceOpportunityRow[],
  demandArtifactPresent: boolean,
): string[] {
  const limits: string[] = [];
  if (!demandArtifactPresent) {
    limits.push("Search demand artifact missing — demand metrics unavailable.");
  }
  const noOrganic = services.filter((s) => s.organicVisibility.classification === "unavailable").length;
  if (noOrganic > 0) {
    limits.push(
      `Local organic visibility unavailable for ${noOrganic} of ${services.length} confirmed services (no service-scoped SERP evidence stored).`,
    );
  }
  const unknownWebsite = services.filter((s) => s.websiteCoverage.classification === "unknown").length;
  if (unknownWebsite > 0) {
    limits.push(`Website import coverage unknown for ${unknownWebsite} services.`);
  }
  limits.push("Paid search CPC and competition reflect Google Ads demand only — not organic ranking difficulty.");
  limits.push("Organic-ranking domains are visibility evidence only — not verified physical competitors.");
  return limits;
}

export function buildPharmacyWideServiceOpportunityAssessment(
  slug: string,
  googleOpportunities: GrowthOpportunity[] = [],
): PharmacyWideServiceOpportunityAssessment {
  const profile = readSetupProfile(slug);
  const enabledServices = resolveConfirmedServiceIds(profile);
  const demandArtifact = readServiceSearchDemandArtifact(slug);
  const generatedAt = new Date().toISOString();

  const services: ServiceOpportunityRow[] = enabledServices.map((serviceId) => {
    const demandRows = demandArtifact?.demandByService?.[serviceId]?.queries || [];
    const demand = buildDemandSummary(slug, serviceId, demandRows);
    const websiteCoverage = buildWebsiteCoverage(slug, serviceId);
    const organicVisibility = buildOrganicVisibility(slug, serviceId);
    const generatedContentCoverage = buildGeneratedContentCoverage(slug, serviceId);

    const base = {
      serviceId,
      serviceName: serviceLabel(serviceId),
      confirmed: true as const,
      demand,
      websiteCoverage,
      organicVisibility,
      generatedContentCoverage,
      opportunityClassification: classifyOpportunity({
        demand,
        website: websiteCoverage,
        organic: organicVisibility,
        content: generatedContentCoverage,
      }),
    };

    const priorityComparisonFields = buildServicePriorityComparisonFields(base);
    const workflowAction = resolveServiceWorkflowAction({
      slug,
      serviceId,
      websiteCoverage,
      generatedContentCoverage,
    });
    const packageStatus = formatPackageStatus(slug, serviceId, generatedContentCoverage);
    const recommendedAction = buildWorkflowActionCopy(workflowAction, base.serviceName);

    return {
      ...base,
      priorityComparisonFields,
      workflowAction,
      packageStatus,
      priorityRationale: buildPriorityRationale(priorityComparisonFields),
      recommendedAction,
      evidenceConfidence: evidenceConfidence(base),
      priorityRank: 0,
    };
  });

  const ranked = [...services]
    .sort((a, b) => compareServicePriority(a.priorityComparisonFields, b.priorityComparisonFields))
    .map((row, index) => ({ ...row, priorityRank: index + 1 }));

  const topPriorityServices = ranked.slice(0, 5).map((row) => buildTopPrioritySummary(slug, row));

  return {
    slug,
    generatedAt,
    confirmedServiceCount: ranked.length,
    services: ranked,
    topPriorityServices,
    googleProfileActions: googleOpportunities.filter((o) => !o.serviceId),
    evidenceLimitations: buildEvidenceLimitations(ranked, Boolean(demandArtifact)),
  };
}

export function serviceOpportunityRowsToGrowthOpportunities(
  assessment: PharmacyWideServiceOpportunityAssessment,
): GrowthOpportunity[] {
  const priorityMap: Record<ServiceOpportunityClassification, GrowthOpportunity["priority"]> = {
    "ready-to-build": "high",
    "improve-existing": "high",
    "optimise-and-track": "medium",
    maintain: "low",
    "insufficient-evidence": "low",
  };

  return assessment.services.map((row) => ({
    id: `service-opportunity-${row.serviceId}`,
    title: `${row.serviceName}: ${row.opportunityClassification.replace(/-/g, " ")}`,
    category: "pharmacy-services",
    priority: priorityMap[row.opportunityClassification],
    evidenceSource: "Business Profile",
    evidenceSummary: row.priorityRationale,
    whyItMatters: row.recommendedAction,
    currentValue: row.demand.highestQueryVolume != null ? String(row.demand.highestQueryVolume) : "—",
    comparisonValue: row.websiteCoverage.classification,
    recommendedAction: row.recommendedAction,
    expectedBenefit: `Evidence-backed ${row.serviceName} opportunity from stored demand, website and organic data.`,
    confidence: row.evidenceConfidence,
    futureStatus: null,
    serviceId: row.serviceId,
    sortScore: 1000 - row.priorityRank,
  }));
}
