/**
 * Persist a Growth Plan from the current approved Commercial Intelligence.
 * Reads stored Growth Intelligence. Does not collect Google Places or DataForSEO,
 * and does not rewrite the approved intelligence records.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { loadGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import {
  isWorkflowAcknowledged,
  readCommercialIntelligenceApproval,
} from "./masterAdminWorkflowAckService.ts";
import {
  commercialIntelligenceApprovedVersion,
  isCommercialIntelligenceApproved,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";

export interface ApprovedGrowthPlanService {
  serviceId: string;
  serviceName: string;
  opportunityClassification: string;
  demandEvidenceStatus: string;
  recommendedAction: string;
}

export interface ApprovedGrowthPlanRecord {
  version: 1;
  slug: string;
  generatedAt: string;
  status: "ready_for_review";
  source: "approved-commercial-intelligence";
  approvedIntelligenceRevision: string;
  competitorEvidenceRevision: string | null;
  localMarketRevision: string | null;
  growthIntelligenceRevision: string | null;
  priorityServiceId: string | null;
  priorityServiceName: string | null;
  priorityOpportunity: string | null;
  services: ApprovedGrowthPlanService[];
  evidenceLimitations: string[];
}

function planPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-growth-plan.json`);
}

export function readPersistedGrowthPlan(slug: string): ApprovedGrowthPlanRecord | null {
  const file = planPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ApprovedGrowthPlanRecord;
    if (raw?.version !== 1 || raw.slug !== slug || raw.source !== "approved-commercial-intelligence") return null;
    return raw;
  } catch {
    return null;
  }
}

function approvedRevisionIsCurrent(slug: string, revision: string | null | undefined): boolean {
  if (!isCommercialIntelligenceApproved(slug) && !isWorkflowAcknowledged(slug, "commercial-intelligence-approved")) {
    return false;
  }
  const approval = readCommercialIntelligenceApproval(slug);
  const current = commercialIntelligenceApprovedVersion(slug);
  return Boolean(revision && approval?.approvedVersion && revision === approval.approvedVersion && revision === current);
}

/** The stored plan only when it was derived from the current approved intelligence revision. */
export function readCurrentGrowthPlan(slug: string): ApprovedGrowthPlanRecord | null {
  const plan = readPersistedGrowthPlan(slug);
  if (!plan || !approvedRevisionIsCurrent(slug, plan.approvedIntelligenceRevision)) return null;
  return plan;
}

function demandLimitation(status: string): string | null {
  if (status === "unknown" || status === "unavailable") return "Keyword demand is unavailable.";
  return null;
}

function deriveGrowthPlan(slug: string, revision: string): ApprovedGrowthPlanRecord | null {
  const report = loadGrowthOpportunityReport(slug);
  if (!report) return null;
  const approval = readCommercialIntelligenceApproval(slug);
  const assessment = report.serviceOpportunityAssessment;
  const services: ApprovedGrowthPlanService[] = (assessment?.services || []).map((row) => ({
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    opportunityClassification: row.opportunityClassification,
    demandEvidenceStatus: row.demand?.demandEvidenceStatus || "unknown",
    recommendedAction: row.recommendedAction,
  }));
  const ranked = assessment?.topPriorityServices?.[0];
  const priority = (ranked && services.find((row) => row.serviceId === ranked.serviceId)) || services[0] || null;
  const opportunity = priority
    ? report.opportunities.find((row) => row.serviceId === priority.serviceId)
    : null;
  const limitations = [...(assessment?.evidenceLimitations || [])];
  const demandNote = priority ? demandLimitation(priority.demandEvidenceStatus) : null;
  if (demandNote && !limitations.some((line) => /demand/i.test(line))) limitations.push(demandNote);
  const profile = readSetupProfile(slug);
  if (resolveGoogleProfileOnboardingState(profile) === "deferred") {
    const deferred = "Google profile setup deferred — website and business profile evidence used instead.";
    if (!limitations.includes(deferred)) limitations.push(deferred);
  }
  return {
    version: 1,
    slug,
    generatedAt: new Date().toISOString(),
    status: "ready_for_review",
    source: "approved-commercial-intelligence",
    approvedIntelligenceRevision: revision,
    competitorEvidenceRevision: approval?.competitorEvidenceRevision || null,
    localMarketRevision: approval?.localMarketRevision || null,
    growthIntelligenceRevision: approval?.growthIntelligenceRevision || report.generatedAt || null,
    priorityServiceId: priority?.serviceId || null,
    priorityServiceName: priority?.serviceName || null,
    priorityOpportunity: opportunity?.title || priority?.recommendedAction || null,
    services,
    evidenceLimitations: limitations,
  };
}

/**
 * Create the Growth Plan after Commercial Intelligence approval.
 * A later unapproved intelligence revision does not replace or relabel the plan.
 */
export function ensureGrowthPlanFromApprovedIntelligence(slug: string): ApprovedGrowthPlanRecord | null {
  if (isNationalGrowthPlatform(slug)) return null;
  const approval = readCommercialIntelligenceApproval(slug);
  const current = commercialIntelligenceApprovedVersion(slug);
  if (!approvedRevisionIsCurrent(slug, approval?.approvedVersion) || approval?.approvedVersion !== current) {
    return null;
  }
  const existing = readPersistedGrowthPlan(slug);
  if (existing?.approvedIntelligenceRevision === current) return existing;
  const plan = deriveGrowthPlan(slug, current);
  if (!plan) return null;
  const file = planPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(plan, null, 2));
  return plan;
}

export function growthPlanStatusLabel(plan: ApprovedGrowthPlanRecord | null): string {
  if (!plan) return "NOT AVAILABLE";
  if (plan.priorityServiceName) return `READY FOR REVIEW · ${plan.priorityServiceName}`;
  return "READY FOR REVIEW";
}
