/**
 * Growth Engine Framework V1 — 7-step workflow orchestration.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { isRequiredProfileComplete } from "./pharmacyProfileFieldClassification.ts";
import { computePharmacyProgrammeCompletionPct } from "./pharmacyProfileWizardScoring.ts";
import { buildWizardImportFields, countImportSummary } from "./pharmacyProfileWizardEnrichment.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { contentPackageGenerated } from "./pharmacyContentPackageService.ts";
import { buildGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import { toGrowthEnginePlanRecommendation } from "./growthEngineCampaignRecommendationEngine.ts";
import { PRIMARY_PLATFORM_SERVICE_ID } from "./pharmacyPlatformDashboardService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";
import { resolveGrowthPlan } from "./growthEngineGrowthPlanResolver.ts";
import { readNationalSearchIntelligence } from "./nationalSearchIntelligenceV1Service.ts";
import { buildAuthoritativeCampaignProgramme } from "./pharmacyAuthoritativeCampaignProgrammeService.ts";

export const GROWTH_ENGINE_VERSION = 1;

/** Four commercial reports shown to pharmacy owners before content generation. */
export const CUSTOMER_REPORT_STEP_IDS = [
  "business-intelligence",
  "local-market",
  "website-intelligence",
  "growth-plan",
] as const;

export type CustomerReportStepId = (typeof CUSTOMER_REPORT_STEP_IDS)[number];

export function isCustomerVisibleInStepper(id: GrowthEngineStepId): boolean {
  return id !== "growth-intelligence";
}

export const GROWTH_ENGINE_STEPS = [
  {
    step: 1,
    id: "business-intelligence",
    title: "Your Pharmacy",
    subtitle: "Import from your website and Google — confirm what we found",
  },
  {
    step: 2,
    id: "local-market",
    title: "Your Local Market",
    subtitle: "See how you compare to nearby pharmacies",
  },
  {
    step: 3,
    id: "website-intelligence",
    title: "Your Website Report",
    subtitle: "What your website contains and what is missing",
  },
  {
    step: 4,
    id: "growth-intelligence",
    title: "Growth Intelligence",
    subtitle: "Evidence synthesis (internal — not shown in customer stepper)",
  },
  {
    step: 5,
    id: "growth-plan",
    title: "Your Growth Plan",
    subtitle: "One evidence-backed campaign recommendation",
  },
  {
    step: 6,
    id: "generate",
    title: "Create Content",
    subtitle: "Build your campaign pages and supporting content",
  },
  {
    step: 7,
    id: "dashboard",
    title: "Your Dashboard",
    subtitle: "Track progress, publish, and monitor results",
  },
] as const;

export type GrowthEngineStepId = (typeof GROWTH_ENGINE_STEPS)[number]["id"];
export type GrowthEngineStepStatus = "not_started" | "in_progress" | "complete";

export interface GrowthEngineStepState {
  id: GrowthEngineStepId;
  step: number;
  title: string;
  subtitle: string;
  status: GrowthEngineStepStatus;
  completionPct: number;
  summary: string;
  url: string;
}

export interface GrowthEnginePlanRecommendation {
  suggestedCampaign: string;
  suggestedEcosystem: string;
  estimatedPages: number;
  estimatedPublishingDays: string;
  expectedIndexingTimeline: string;
  expectedReviewPeriod: string;
  primaryServiceId: string;
  primaryServiceName: string;
  areaCount: number;
}

export interface GrowthEngineWorkflowDoc {
  slug: string;
  version: number;
  updatedAt: string;
  acknowledgedSteps: Partial<Record<GrowthEngineStepId, string>>;
}

export interface GrowthEngineFramework {
  version: number;
  slug: string;
  generatedAt: string;
  overallCompletionPct: number;
  currentStep: GrowthEngineStepId;
  nextStep: GrowthEngineStepState | null;
  steps: GrowthEngineStepState[];
  importSummary: { imported: number; confirmed: number; missing: number };
  plan: GrowthEnginePlanRecommendation;
}

function workflowPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-workflow.json`);
}

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function loadWorkflowDoc(slug: string): GrowthEngineWorkflowDoc {
  const file = workflowPath(slug);
  if (!fs.existsSync(file)) {
    return { slug, version: GROWTH_ENGINE_VERSION, updatedAt: "", acknowledgedSteps: {} };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      slug,
      version: Number(raw.version) || GROWTH_ENGINE_VERSION,
      updatedAt: String(raw.updatedAt || ""),
      acknowledgedSteps: raw.acknowledgedSteps && typeof raw.acknowledgedSteps === "object" ? raw.acknowledgedSteps : {},
    };
  } catch {
    return { slug, version: GROWTH_ENGINE_VERSION, updatedAt: "", acknowledgedSteps: {} };
  }
}

export function saveWorkflowAcknowledgement(slug: string, stepId: GrowthEngineStepId): GrowthEngineWorkflowDoc {
  fs.mkdirSync(path.dirname(workflowPath(slug)), { recursive: true });
  const doc = loadWorkflowDoc(slug);
  doc.acknowledgedSteps[stepId] = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(workflowPath(slug), JSON.stringify(doc, null, 2));
  return doc;
}

function stepUrl(slug: string, id: GrowthEngineStepId): string {
  const map: Record<GrowthEngineStepId, string> = {
    "business-intelligence": `/api/growth-engine/business-intelligence?slug=${encodeURIComponent(slug)}`,
    "local-market": isNationalGrowthPlatform(slug)
      ? `/api/growth-engine/search-intelligence?slug=${encodeURIComponent(slug)}`
      : `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`,
    "website-intelligence": `/api/growth-engine/website-intelligence?slug=${encodeURIComponent(slug)}`,
    "growth-intelligence": `/api/growth-engine/growth-intelligence?slug=${encodeURIComponent(slug)}`,
    "growth-plan": `/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}`,
    generate: `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}`,
    dashboard: `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`,
  };
  return map[id];
}

function resolvePrimaryService(data: ReturnType<typeof normalizeProfileData>): {
  serviceId: string;
  serviceName: string;
} {
  const selected = data.selectedServices || [];
  const serviceId = selected[0] || PRIMARY_PLATFORM_SERVICE_ID;
  const serviceName = serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { serviceId, serviceName };
}

export function buildGrowthPlanRecommendation(slug: string): GrowthEnginePlanRecommendation {
  const data = loadProfile(slug);
  const { serviceId, serviceName } = resolvePrimaryService(data);
  const areas = (data.selectedAreas || []).filter((a) => a.selected !== false);
  const areaCount = areas.length || (data.rankingAreas || []).length || 5;
  const clusterPages = Math.min(areaCount, 12);
  const estimatedPages = 1 + clusterPages + 4;

  return {
    suggestedCampaign: "Pharmacy First",
    suggestedEcosystem: `${serviceName} service ecosystem with local area pages`,
    estimatedPages,
    estimatedPublishingDays: "2–4 weeks",
    expectedIndexingTimeline: "2–6 weeks after publishing",
    expectedReviewPeriod: "3–5 business days for content review",
    primaryServiceId: serviceId,
    primaryServiceName: serviceName,
    areaCount: areaCount || 5,
  };
}

function businessIntelligencePct(data: ReturnType<typeof normalizeProfileData>): number {
  return computePharmacyProgrammeCompletionPct(data);
}

export function buildGrowthEngineFramework(slug: string): GrowthEngineFramework {
  const copy = growthEnginePlatformCopy(slug);
  const national = isNationalGrowthPlatform(slug);
  const data = loadProfile(slug);
  const workflow = loadWorkflowDoc(slug);
  const searchIntel = national ? readNationalSearchIntelligence(slug) : null;
  const competitors = national ? null : loadCompetitorSnapshot(slug);
  const resolvedPlan = resolveGrowthPlan(slug);
  const plan =
    resolvedPlan.platform === "national"
      ? {
          suggestedCampaign: resolvedPlan.plan.primary?.primaryKeyword || "National commercial strategy",
          suggestedEcosystem: resolvedPlan.plan.market,
          estimatedPages: 0,
          estimatedPublishingDays: "Strategy only",
          expectedIndexingTimeline: "Not applicable until national generation exists",
          expectedReviewPeriod: "Strategy review",
          primaryServiceId: resolvedPlan.plan.primary?.actionId || "",
          primaryServiceName: resolvedPlan.plan.primary?.primaryKeyword || "National commercial action",
          areaCount: 0,
        }
      : toGrowthEnginePlanRecommendation(resolvedPlan.plan, data);
  const programme = national ? null : buildAuthoritativeCampaignProgramme(slug);
  if (programme?.nextCampaign) {
    plan.suggestedCampaign = programme.nextCampaign.serviceName;
    plan.primaryServiceId = programme.nextCampaign.serviceId;
    plan.primaryServiceName = programme.nextCampaign.serviceName;
  }
  const generated = national
    ? false
    : Boolean(programme?.hasGeneratedCampaigns) || contentPackageGenerated(slug, plan.primaryServiceId);
  const importFields = buildWizardImportFields(data);
  const importSummary = countImportSummary(importFields);

  const bizPct = businessIntelligencePct(data);
  const bizComplete = national ? true : isRequiredProfileComplete(data);
  const localComplete = national
    ? searchIntel?.status === "collected" || searchIntel?.status === "empty" || searchIntel?.status === "partial"
    : competitors?.analysis?.dataSource === "google-places-live" && (competitors.competitors.length || 0) >= 5;
  const websiteSnapshot = resolveWebsiteIntelligenceSnapshot(slug);
  const websiteComplete = websiteSnapshot?.analysis?.understandingComplete === true;
  const opportunityReport = national ? null : buildGrowthOpportunityReport(slug, competitors);
  const growthIntelAck = Boolean(workflow.acknowledgedSteps["growth-intelligence"]);
  const hasOpportunities = Boolean(opportunityReport && opportunityReport.overview.total > 0);
  const nationalStrategyReady = resolvedPlan.platform === "national" && resolvedPlan.plan.strategyReady;
  const planAck = Boolean(workflow.acknowledgedSteps["growth-plan"]);
  const generateComplete = generated;
  const dashboardAck = Boolean(workflow.acknowledgedSteps.dashboard);
  const evidenceBackedPlanExists = national
    ? nationalStrategyReady
    : Boolean(plan.suggestedCampaign && plan.primaryServiceId);
  const planComplete = growthPlanStepIsComplete({
    planAcknowledged: planAck,
    evidenceBackedPlanExists,
    campaignGenerated: generateComplete,
  });

  const titles: Record<string, { title: string; subtitle: string }> = {
    "business-intelligence": { title: copy.businessStepTitle, subtitle: copy.businessStepSubtitle },
    "local-market": { title: copy.marketStepTitle, subtitle: copy.marketStepSubtitle },
    "website-intelligence": { title: copy.websiteStepTitle, subtitle: copy.websiteStepSubtitle },
    "growth-plan": { title: copy.planStepTitle, subtitle: copy.planStepSubtitle },
    generate: { title: copy.generateStepTitle, subtitle: copy.generateStepSubtitle },
    dashboard: { title: copy.dashboardStepTitle, subtitle: "Track progress and next actions" },
  };

  const states: GrowthEngineStepState[] = GROWTH_ENGINE_STEPS.map((meta) => {
    const labelled = titles[meta.id];
    const base = {
      id: meta.id,
      step: meta.step,
      title: labelled?.title || meta.title,
      subtitle: labelled?.subtitle || meta.subtitle,
      url: stepUrl(slug, meta.id),
    };
    switch (meta.id) {
      case "business-intelligence":
        return {
          ...base,
          status: bizComplete ? "complete" : bizPct > 0 ? "in_progress" : "not_started",
          completionPct: bizComplete ? 100 : bizPct,
          summary: national
            ? "National digital-growth identity"
            : bizComplete
              ? "Profile ready — required fields confirmed"
              : `${importSummary.imported} imported · ${importSummary.missing} need review`,
        };
      case "local-market":
        return {
          ...base,
          status: localComplete ? "complete" : competitors?.competitors.length ? "in_progress" : "not_started",
          completionPct: localComplete ? 100 : Math.min(99, (competitors?.competitors.length || 0) * 10),
          summary: national
            ? searchIntel?.status === "collected" || searchIntel?.status === "empty" || searchIntel?.status === "partial"
              ? `Search intelligence collected · ${searchIntel?.customerKeywords.length || 0} ranking keywords`
              : searchIntel?.status === "error"
                ? "Search intelligence collection failed"
                : "Collect organic ranking keywords and search competitors"
            : localComplete
              ? `${competitors?.competitors.length || 0} nearby pharmacies compared`
              : "Load your local market comparison",
        };
      case "website-intelligence":
        return {
          ...base,
          status: websiteComplete ? "complete" : websiteSnapshot?.analysis ? "in_progress" : localComplete ? "in_progress" : "not_started",
          completionPct: websiteComplete ? 100 : websiteSnapshot?.analysis ? 60 : localComplete ? 20 : 0,
          summary: websiteComplete
            ? `${websiteSnapshot?.analysis?.inventory.totalPages || 0} pages inventoried`
            : "Analyse your website inventory",
        };
      case "growth-intelligence":
        return {
          ...base,
          status: national
            ? nationalStrategyReady || growthIntelAck
              ? "complete"
              : "in_progress"
            : growthIntelAck
              ? "complete"
              : hasOpportunities || websiteComplete
                ? "in_progress"
                : "not_started",
          completionPct: national ? (nationalStrategyReady ? 100 : 60) : growthIntelAck ? 100 : hasOpportunities ? 70 : websiteComplete ? 40 : 0,
          summary: national
            ? "National commercial intelligence feeds the Growth Plan"
            : growthIntelAck
              ? `${opportunityReport?.overview.total || 0} opportunities reviewed`
              : hasOpportunities
                ? `${opportunityReport?.overview.total || 0} evidence-backed opportunities`
                : "Evidence feeds your Growth Plan automatically",
        };
      case "growth-plan":
        return {
          ...base,
          status: planComplete ? "complete" : nationalStrategyReady || websiteComplete || growthIntelAck ? "in_progress" : "not_started",
          completionPct: planComplete ? 100 : nationalStrategyReady || websiteComplete ? 50 : 0,
          summary: planComplete ? `Recommended: ${plan.suggestedCampaign}` : `Suggested: ${plan.suggestedCampaign}`,
        };
      case "generate":
        return {
          ...base,
          status: generateComplete ? "complete" : national ? "not_started" : planAck ? "in_progress" : "not_started",
          completionPct: generateComplete ? 100 : national ? 0 : planAck ? 30 : 0,
          summary: national
            ? "National content generation not yet implemented"
            : generateComplete
              ? programme?.campaigns.length
                ? `${programme.campaigns.length} campaign${programme.campaigns.length === 1 ? "" : "s"} generated`
                : "Content package created"
              : `~${plan.estimatedPages} pages estimated`,
        };
      case "dashboard":
        return {
          ...base,
          status: dashboardAck || generateComplete ? "complete" : "not_started",
          completionPct: dashboardAck || generateComplete ? 100 : 0,
          summary: national
            ? "Monitor national strategy"
            : generateComplete
              ? "Campaign records available"
              : "Monitor your campaign progress",
        };
      default:
        return { ...base, status: "not_started" as const, completionPct: 0, summary: "" };
    }
  });

  const overallCompletionPct = Math.round(
    states.reduce((sum, s) => sum + s.completionPct, 0) / states.length,
  );

  const current =
    states.find((s) => s.status !== "complete") ||
    states[states.length - 1];
  const nextIncomplete = states.find((s) => s.status !== "complete") || null;

  return {
    version: GROWTH_ENGINE_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    overallCompletionPct,
    currentStep: current.id,
    nextStep: nextIncomplete,
    steps: states,
    importSummary,
    plan,
  };
}

export function growthEngineHubUrl(slug: string): string {
  return `/api/growth-engine?slug=${encodeURIComponent(slug)}`;
}

export function growthEngineWizardUrl(slug: string): string {
  return `/api/pharmacy-profile-wizard?slug=${encodeURIComponent(slug)}`;
}

export function growthEngineContentPackageUrl(slug: string, serviceId: string): string {
  return `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=choose&campaign=${encodeURIComponent(serviceId)}`;
}

export function growthEngineLegacyDashboardUrl(slug: string): string {
  return `/api/pharmacy-growth-dashboard?slug=${encodeURIComponent(slug)}`;
}

/** Growth Plan is complete when acknowledged, or when the plan exists and the campaign is already generated. */
export function growthPlanStepIsComplete(input: {
  planAcknowledged: boolean;
  evidenceBackedPlanExists: boolean;
  campaignGenerated: boolean;
}): boolean {
  if (input.planAcknowledged) return true;
  return Boolean(input.evidenceBackedPlanExists && input.campaignGenerated);
}

export interface GrowthPlanContinueCta {
  nextUrl: string | null;
  nextLabel: string | null;
}

/**
 * Primary Continue CTA from Growth Plan.
 * Does not send the operator back through Create Content or Dashboard once those steps are complete.
 */
export function resolveGrowthPlanContinueCta(framework: GrowthEngineFramework): GrowthPlanContinueCta {
  const generate = framework.steps.find((s) => s.id === "generate");
  const dashboard = framework.steps.find((s) => s.id === "dashboard");
  if (generate && generate.status !== "complete") {
    return { nextUrl: generate.url, nextLabel: "Continue to Create Content →" };
  }
  if (dashboard && dashboard.status !== "complete") {
    return { nextUrl: dashboard.url, nextLabel: `Continue to ${dashboard.title} →` };
  }
  const outstanding = framework.steps.find(
    (s) =>
      s.status !== "complete" &&
      s.id !== "generate" &&
      s.id !== "dashboard" &&
      s.id !== "growth-intelligence" &&
      s.id !== "growth-plan",
  );
  if (outstanding) {
    return { nextUrl: outstanding.url, nextLabel: `Continue to ${outstanding.title} →` };
  }
  return { nextUrl: null, nextLabel: null };
}
