/**
 * Master Admin Workflow Stage Executor V1 — one execution function per stage.
 */
import { buildWizardImportFields, countImportSummary } from "./pharmacyProfileWizardEnrichment.ts";
import { readSetupProfile, runSetupGoogleImport, runSetupWebsiteImport, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { runCustomerSetupConfirm } from "./growthEngineCustomerSetupConfirmService.ts";
import { loadContentPackage, markContentPackageReviewed } from "./pharmacyContentPackageService.ts";
import { writeWorkflowAcknowledgement } from "./masterAdminWorkflowAckService.ts";
import { isBusinessProfileReviewApproved } from "./masterAdminBusinessProfileReviewService.ts";
import { websiteImportStageComplete } from "./masterAdminWebsiteBranchSelectionService.ts";
import {
  isCommercialIntelligenceApproved,
  isCompetitorAnalysisGenerated,
  isGrowthIntelligenceGenerated,
  isLocalMarketIntelligenceGenerated,
  approveCommercialIntelligence,
  runCompetitorAnalysisWorkflowAction,
  runLocalMarketIntelligenceWorkflowAction,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { ensureLegacyAutoAdvance, isLegacyAutoAdvance, legacyIntelligenceStagesComplete } from "./masterAdminWorkflowLegacyService.ts";
import type { MasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import type { WorkflowStageId } from "./masterAdminWorkflowModel.ts";
import { readOnboardingBatch } from "./masterAdminOnboardingBatchService.ts";
import {
  isGoogleImportWorkflowStageComplete,
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
} from "./masterAdminGoogleProfileOnboardingService.ts";
import { readLatestCommercialQualityApproval } from "./masterAdminCommercialQualityReviewService.ts";
import { readLatestCommercialIndexingApproval } from "./masterAdminCommercialIndexingReviewService.ts";
import { readLatestCommercialPerformanceAcknowledgement } from "./masterAdminCommercialPerformanceDashboardService.ts";
import { isAuthorisedEcosystemQualityReviewReady } from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  isCoreProductRecoveryMode,
  readCoreProductRecoveryContract,
  isServicePageEvidenceReviewApproved,
  isServicePageReviewApproved,
  isCprLocalClusterGenerationComplete,
  isCprClusterReviewApproved,
} from "./masterAdminCoreProductRecoveryService.ts";

/** Single canonical Commercial Intelligence completion signal for timeline, preflight, and stage verification. */
export function isCommercialIntelligenceWorkflowStageComplete(ctx: MasterAdminCustomerContext): boolean {
  if (isCoreProductRecoveryMode(ctx.slug) && isBusinessProfileReviewApproved(ctx.slug)) {
    return true;
  }
  return isCommercialIntelligenceApproved(ctx.slug);
}

export interface StageExecutionResult {
  ok: boolean;
  evidence: string;
  warnings: string[];
  errors: string[];
  result?: unknown;
  redirectUrl?: string;
}

export async function executeWorkflowStageAction(
  stageId: WorkflowStageId,
  actionId: string,
  ctx: MasterAdminCustomerContext,
  operator: string,
  body: Record<string, unknown> = {},
): Promise<StageExecutionResult> {
  const slug = ctx.slug;
  const warnings: string[] = [];
  const errors: string[] = [];
  const validationMode = Boolean(body.validationMode);

  try {
    switch (actionId) {
      case "import_website": {
        if (validationMode) {
          const data = readSetupProfile(slug);
          writeSetupProfile(slug, {
            ...data,
            websiteImportSnapshot: { source: "validation", importedAt: new Date().toISOString(), fields: {} },
          });
          return { ok: true, evidence: "Website import simulated (validation)", warnings, errors };
        }
        const data = readSetupProfile(slug);
        const result = await runSetupWebsiteImport(slug, {
          websiteUrl: String(body.websiteUrl || body.website || data.website || ctx.website || ""),
        });
        return { ok: true, evidence: "Website import completed", warnings, errors, result };
      }
      case "import_google": {
        if (validationMode) {
          const data = readSetupProfile(slug);
          writeSetupProfile(slug, {
            ...data,
            googleImportSnapshot: { source: "validation", importedAt: new Date().toISOString(), fields: {} },
            customerSetupGoogleMatchStatus: "confirmed",
          });
          return { ok: true, evidence: "Google import simulated (validation)", warnings, errors };
        }
        const data = readSetupProfile(slug);
        const result = await runSetupGoogleImport(slug, {
          googleBusinessUrl: String(body.googleBusinessUrl || data.googleBusinessProfileUrl || ""),
          pharmacyName: String(body.pharmacyName || data.pharmacyName || ctx.pharmacyName || ""),
          town: String(body.town || data.primaryTown || ""),
          postcode: String(body.postcode || data.postcode || ""),
        });
        return { ok: true, evidence: "Google import completed", warnings, errors, result };
      }
      case "orchestrate_bpi": {
        if (!isBusinessProfileReviewApproved(slug)) {
          return {
            ok: false,
            evidence: "Business Profile Review and Approval required before advancing",
            warnings,
            errors: ["Complete Business Profile Review and click Approve Business Profile"],
            redirectUrl: `/api/admin/master?customer=${encodeURIComponent(slug)}&panel=business-profile-review`,
          };
        }
        const ack = writeWorkflowAcknowledgement(slug, "business-profile-intelligence", operator);
        return {
          ok: true,
          evidence: `Business Profile Intelligence acknowledged at ${ack.acknowledgedAt}`,
          warnings,
          errors,
          result: ack,
        };
      }
      case "orchestrate_resolve_conflicts": {
        const data = readSetupProfile(slug);
        const importSummary = countImportSummary(buildWizardImportFields(data));
        const googleMatch = data.customerSetupGoogleMatchStatus || "none";
        if (importSummary.missing > 0 || googleMatch === "pending" || googleMatch === "candidates") {
          return {
            ok: false,
            evidence: "Import conflicts remain",
            warnings,
            errors: [`${importSummary.missing} missing fields; Google match: ${googleMatch}`],
            redirectUrl: `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(slug)}`,
          };
        }
        return { ok: true, evidence: "All import conflicts resolved", warnings, errors };
      }
      case "approve_profile": {
        if (validationMode) {
          const data = readSetupProfile(slug);
          writeSetupProfile(slug, {
            ...data,
            platformClientStatus: "active",
            profileFieldConfirmations: {
              pharmacyName: "validation",
              website: "validation",
              phone: "validation",
              email: "validation",
              postcode: "validation",
            },
          });
          return { ok: true, evidence: "Profile approval simulated (validation)", warnings, errors };
        }
        const data = readSetupProfile(slug);
        const result = runCustomerSetupConfirm(slug, {
          pharmacyName: data.pharmacyName,
          website: data.website,
          phone: data.phone,
          email: data.businessEmail || data.email,
          address: data.addressLine1,
          town: data.primaryTown || data.townCity,
          postcode: data.postcode,
          gphcNumber: data.gphcNumber,
          gphcConfirmation: data.gphcNumber ? "confirm" : "",
          fieldSources: data.customerSetupFieldSources,
        });
        return { ok: true, evidence: "Business profile approved", warnings, errors, result };
      }
      case "orchestrate_competitor_analysis": {
        const executingJobId = typeof body.masterAdminJobId === "string" ? body.masterAdminJobId : null;
        const outcome = await runCompetitorAnalysisWorkflowAction(slug, operator, executingJobId);
        if (!outcome.ok) {
          return { ok: false, evidence: outcome.evidence, warnings, errors: outcome.errors.length ? outcome.errors : [outcome.evidence] };
        }
        return { ok: true, evidence: outcome.evidence, warnings, errors, result: outcome };
      }
      case "orchestrate_local_market_intelligence": {
        const outcome = await runLocalMarketIntelligenceWorkflowAction(slug, operator);
        if (!outcome.ok) {
          return { ok: false, evidence: outcome.evidence, warnings, errors: outcome.errors.length ? outcome.errors : [outcome.evidence] };
        }
        return { ok: true, evidence: outcome.evidence, warnings, errors, result: outcome };
      }
      case "approve_commercial_intelligence": {
        const outcome = approveCommercialIntelligence(slug, operator);
        if (!outcome.ok) return { ok: false, evidence: outcome.evidence, warnings, errors: outcome.errors };
        return { ok: true, evidence: outcome.evidence, warnings, errors, result: outcome };
      }
      case "orchestrate_growth_intelligence": {
        const { runGrowthIntelligenceWorkflowAction } = await import(
          "./masterAdminGrowthIntelligenceWorkflowService.ts"
        );
        const outcome = runGrowthIntelligenceWorkflowAction(slug, operator);
        if (!outcome.ok) {
          return {
            ok: false,
            evidence: outcome.evidence,
            warnings,
            errors: outcome.errors.length ? outcome.errors : [outcome.evidence],
          };
        }
        return {
          ok: true,
          evidence: outcome.evidence,
          warnings,
          errors,
          result: outcome,
        };
      }
      case "orchestrate_quality_review": {
        const pkg = loadContentPackage(slug, ctx.serviceId);
        if (!pkg) {
          return { ok: false, evidence: "Content package missing", warnings, errors: ["Generate ecosystem first"] };
        }
        markContentPackageReviewed(slug, ctx.serviceId);
        return { ok: true, evidence: "Quality review recorded on content package", warnings, errors };
      }
      default:
        return {
          ok: false,
          evidence: `Stage ${stageId} action ${actionId} must run via platform action executor`,
          warnings,
          errors: ["Unsupported stage executor action"],
        };
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { ok: false, evidence: errors[0] || "Stage execution failed", warnings, errors };
  }
}

export function verifyStageCompletion(stageId: WorkflowStageId, ctx: MasterAdminCustomerContext): boolean {
  ensureLegacyAutoAdvance(ctx.slug);
  const data = ctx.data;
  const importSummary = countImportSummary(buildWizardImportFields(data));
  const hasWebsite = Boolean(data.websiteImportSnapshot);
  const hasGoogle = Boolean(data.googleImportSnapshot);
  const googleMatch = data.customerSetupGoogleMatchStatus || "none";

  switch (stageId) {
    case "create_customer":
      return true;
    case "website_import":
      return hasWebsite && websiteImportStageComplete(ctx.slug);
    case "google_import": {
      const batch = readOnboardingBatch(ctx.slug);
      const googleMatch = data.customerSetupGoogleMatchStatus || "none";
      return isGoogleImportWorkflowStageComplete(data, {
        hasGoogleImportSnapshot: hasGoogle,
        googleMatchConfirmed: googleMatch === "confirmed",
        batchGoogleSkipped: batch?.google?.importState === "skipped",
      });
    }
    case "business_profile_intelligence":
    case "resolve_import_conflicts":
    case "approve_business_profile":
      return isBusinessProfileReviewApproved(ctx.slug);
    case "competitor_analysis":
      return isCompetitorAnalysisGenerated(ctx.slug) || legacyIntelligenceStagesComplete(ctx.slug, ctx.contentGenerated);
    case "local_market_intelligence":
      return isLocalMarketIntelligenceGenerated(ctx.slug) || legacyIntelligenceStagesComplete(ctx.slug, ctx.contentGenerated);
    case "generate_growth_intelligence":
      return isGrowthIntelligenceGenerated(ctx.slug) || legacyIntelligenceStagesComplete(ctx.slug, ctx.contentGenerated);
    case "commercial_intelligence":
      return isCommercialIntelligenceWorkflowStageComplete(ctx);
    case "generate_ecosystem":
      if (isCoreProductRecoveryMode(ctx.slug)) {
        const contract = readCoreProductRecoveryContract(ctx.slug);
        if (!contract?.servicePageGenerated) return false;
        if (!isServicePageReviewApproved(ctx.slug)) return true;
        return isCprLocalClusterGenerationComplete(ctx.slug);
      }
      return isAuthorisedEcosystemQualityReviewReady(ctx.slug);
    case "quality_review":
      if (isCoreProductRecoveryMode(ctx.slug)) {
        return isServicePageReviewApproved(ctx.slug);
      }
      if (!isAuthorisedEcosystemQualityReviewReady(ctx.slug)) return false;
      return Boolean(readLatestCommercialQualityApproval(ctx.slug)?.approvedAt);
    case "publish":
      return Boolean(ctx.live.lastPublishedAt);
    case "request_indexing":
      return (
        Boolean(readLatestCommercialIndexingApproval(ctx.slug)?.requestedAt) ||
        ctx.indexing.submitted > 0 ||
        ctx.indexing.indexed > 0
      );
    case "initialise_rank_tracking":
      return (
        Boolean(readLatestCommercialPerformanceAcknowledgement(ctx.slug)?.acknowledgedAt) ||
        ctx.rank.keywords > 0 ||
        (ctx.rank.status !== "not_started" && ctx.rank.status !== "limited")
      );
    case "monitoring":
      return ctx.live.lastPublishedAt && (ctx.indexing.submitted > 0 || ctx.indexing.indexed > 0) && ctx.rank.keywords === 0;
    case "live_customer":
      return ctx.rank.keywords > 0 && Boolean(ctx.live.lastPublishedAt);
    default:
      return false;
  }
}

function resolveCoreProductRecoveryWorkflowStage(ctx: MasterAdminCustomerContext): WorkflowStageId | null {
  if (!isCoreProductRecoveryMode(ctx.slug)) return null;

  const preGenerationStages = [
    "create_customer",
    "website_import",
    "google_import",
    "business_profile_intelligence",
    "resolve_import_conflicts",
    "approve_business_profile",
  ] as const;

  for (const stageId of preGenerationStages) {
    if (stageId === "google_import") {
      const state = resolveGoogleProfileOnboardingState(ctx.data);
      if (!shouldRunGoogleImport(state) && verifyStageCompletion("website_import", ctx)) {
        continue;
      }
    }
    if (!verifyStageCompletion(stageId, ctx)) return stageId;
  }

  const contract = readCoreProductRecoveryContract(ctx.slug);
  if (!contract?.servicePageGenerated) {
    return "generate_ecosystem";
  }

  if (!isServicePageReviewApproved(ctx.slug)) {
    return "quality_review";
  }

  if (!isCprLocalClusterGenerationComplete(ctx.slug)) {
    return "generate_ecosystem";
  }

  if (!isCprClusterReviewApproved(ctx.slug)) {
    return "quality_review";
  }

  return null;
}

export function resolveWorkflowStage(ctx: MasterAdminCustomerContext): WorkflowStageId {
  if (ctx.archived) return "archived";
  if (ctx.suspended) return "suspended";

  const cprStage = resolveCoreProductRecoveryWorkflowStage(ctx);
  if (cprStage) return cprStage;

  const order = [
    "create_customer",
    "website_import",
    "google_import",
    "business_profile_intelligence",
    "resolve_import_conflicts",
    "approve_business_profile",
    "competitor_analysis",
    "local_market_intelligence",
    "generate_growth_intelligence",
    "commercial_intelligence",
    "generate_ecosystem",
    "quality_review",
    "publish",
    "request_indexing",
    "initialise_rank_tracking",
    "monitoring",
    "live_customer",
  ] as const;
  for (const stageId of order) {
    if (stageId === "google_import") {
      const state = resolveGoogleProfileOnboardingState(ctx.data);
      if (!shouldRunGoogleImport(state) && verifyStageCompletion("website_import", ctx)) {
        continue;
      }
    }
    if (!verifyStageCompletion(stageId, ctx)) return stageId;
  }
  return "live_customer";
}
