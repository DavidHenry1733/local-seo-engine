/**
 * PharmaConnect Enhancement Workspace V1 — operational task workflow for authority enhancements.
 * Real actions V1: validates underlying data before completion; test mode for other types.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  analyseServiceAuthorityEnhancement,
  loadPharmacyAuthorityEnhancement,
  refreshPharmacyAuthorityEnhancement,
  type EnhancementRecommendation,
  type ServiceAuthorityEnhancement,
  ENHANCEMENT_CATEGORY_LABELS,
} from "./pharmacyAuthorityEnhancementService.ts";
import { resolveCampaignImprovementsServiceForTenant } from "./pharmacyCampaignImprovementsServiceAuthority.ts";
import {
  publicationAllowsLaunch,
  type CampaignImprovementsLaunchAuthority,
} from "./pharmacyCampaignImprovementsLaunchAuthority.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import {
  getServiceAuthorityAudit,
  refreshPharmacyAuthorityReadiness,
  type PublishGate,
} from "./pharmacyAuthorityReadinessService.ts";
import { refreshPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import { refreshPharmacyCampaignLaunchQueue } from "./pharmacyCampaignLaunchQueueService.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  classifyRealEnhancementAction,
  EnhancementCompletionError,
  resolveImageSlotForSignal,
  validateRealEnhancementAction,
} from "./pharmacyRealEnhancementActionsService.ts";

export const ENHANCEMENT_WORKSPACE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-enhancement-workspace");

export type EnhancementTaskStatus = "ready" | "in_progress" | "completed" | "deferred";

export interface EnhancementWorkspaceTaskRecord {
  id: string;
  recommendationId: string;
  serviceId: string;
  status: EnhancementTaskStatus;
  completedAt: string | null;
  completedBy: string | null;
  linkedModule: string;
  beforeScore: number | null;
  afterScore: number | null;
  notes: string | null;
  testMode: boolean;
}

export interface PharmacyEnhancementWorkspaceStore {
  version: 1;
  slug: string;
  testMode: boolean;
  updatedAt: string;
  tasks: EnhancementWorkspaceTaskRecord[];
}

export interface EnhancementPrimaryAction {
  label: string;
  url: string;
}

export interface EnhancementWorkspaceTask extends EnhancementRecommendation {
  serviceId: string;
  serviceName: string;
  workspaceTaskId: string;
  status: EnhancementTaskStatus;
  completedAt: string | null;
  completedBy: string | null;
  beforeScore: number | null;
  afterScore: number | null;
  notes: string | null;
  testMode: boolean;
  primaryAction: EnhancementPrimaryAction;
  estimatedAuthorityGain: number;
}

export interface EnhancementWorkspaceBoard {
  ready: EnhancementWorkspaceTask[];
  inProgress: EnhancementWorkspaceTask[];
  completed: EnhancementWorkspaceTask[];
  deferred: EnhancementWorkspaceTask[];
}

export interface EnhancementWorkspaceSummary {
  currentAuthorityScore: number;
  projectedAuthorityScore: number;
  potentialAuthorityScore: number;
  recommendationsRemaining: number;
  easyWinsRemaining: number;
  highImpactRemaining: number;
  completed: number;
  inProgress: number;
  deferred: number;
  estimatedOverallGain: number;
  testMode: boolean;
}

export interface EnhancementWorkspaceProgress {
  currentScore: number;
  projectedScore: number;
  potentialScore: number;
  completed: number;
  realCompleted: number;
  remaining: number;
  easyWinsRemaining: number;
  highImpactRemaining: number;
  estimatedGain: number;
  publishGate: PublishGate;
  nextRecommendedRealAction: EnhancementPrimaryAction | null;
  workspaceUrl: string;
}

export interface EnhancementWorkspaceView {
  slug: string;
  pharmacyName: string;
  brandPrimaryColor: string;
  selectedServiceId: string | null;
  selectedServiceName: string | null;
  authoritativeServiceIds: string[];
  serviceSource: string;
  visualPageRecognised: boolean;
  launchAuthority: CampaignImprovementsLaunchAuthority;
  summary: EnhancementWorkspaceSummary;
  board: EnhancementWorkspaceBoard;
  store: PharmacyEnhancementWorkspaceStore;
  lastRefreshedAt: string;
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function workspacePath(slug: string): string {
  fs.mkdirSync(ENHANCEMENT_WORKSPACE_DIR, { recursive: true });
  return path.join(ENHANCEMENT_WORKSPACE_DIR, `${safeSlug(slug)}.json`);
}

export function loadEnhancementWorkspaceStore(slug: string): PharmacyEnhancementWorkspaceStore {
  const file = workspacePath(slug);
  if (!fs.existsSync(file)) {
    return {
      version: 1,
      slug: safeSlug(slug),
      testMode: false,
      updatedAt: new Date().toISOString(),
      tasks: [],
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as PharmacyEnhancementWorkspaceStore;
    return { ...parsed, slug: safeSlug(slug) };
  } catch {
    return {
      version: 1,
      slug: safeSlug(slug),
      testMode: false,
      updatedAt: new Date().toISOString(),
      tasks: [],
    };
  }
}

export function saveEnhancementWorkspaceStore(store: PharmacyEnhancementWorkspaceStore): string {
  const file = workspacePath(store.slug);
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
  return file;
}

export function resolveEnhancementPrimaryAction(
  recommendation: EnhancementRecommendation,
  slug: string,
  serviceId: string,
): EnhancementPrimaryAction {
  const s = safeSlug(slug);
  const sig = recommendation.signalId;
  const title = recommendation.title.toLowerCase();
  const cat = recommendation.category;

  if (
    sig.startsWith("he-") &&
    (sig.includes("reviewer") || sig.includes("accountability") || sig.includes("bio") || sig.includes("review"))
  ) {
    return { label: "Open Profile Dashboard", url: `/api/pharmacy-profile-dashboard?slug=${s}#section-professional-review` };
  }
  if (title.includes("review date") || sig.includes("review-date") || sig.includes("clinical-review")) {
    return { label: "Open Professional Review", url: `/api/pharmacy-profile-dashboard?slug=${s}#section-professional-review` };
  }
  if (sig === "tq-canonical" || title.includes("canonical")) {
    return { label: "Open Publishing Settings", url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}` };
  }
  if (sig === "tq-no-noindex" || title.includes("noindex")) {
    return { label: "Open Publishing Settings", url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}` };
  }
  if (
    sig.includes("schema") ||
    sig.startsWith("tq-schema") ||
    sig === "he-reviewer-schema" ||
    title.includes("structured data")
  ) {
    return { label: "Open Publishing Settings", url: `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}` };
  }
  if (
    sig.includes("image") ||
    sig.includes("photo") ||
    sig === "cd-images-present" ||
    sig === "tq-images-assigned" ||
    recommendation.linkedModule === "Image Library"
  ) {
    const slot = resolveImageSlotForSignal(sig);
    const slotParam = slot ? `&slot=${slot}` : "";
    return { label: "Open Image Library", url: `/api/pharmacy-image-library?slug=${s}&service=${serviceId}${slotParam}` };
  }
  if (cat === "contentEcosystem" || sig.startsWith("ce-") || title.includes("ecosystem")) {
    return { label: "Open Campaign OS", url: `/api/pharmacy-campaigns?slug=${s}&serviceId=${serviceId}` };
  }
  if (sig.includes("faq") || title.includes("faq")) {
    return { label: "Open FAQ Workspace", url: `/api/pharmacy-faq-workspace?slug=${s}&service=${serviceId}` };
  }
  if (recommendation.linkedModule === "Profile Dashboard") {
    return { label: "Open Profile Dashboard", url: recommendation.linkedUrl };
  }
  if (recommendation.linkedModule === "Content Ecosystem") {
    return { label: "Open Content Ecosystem", url: recommendation.linkedUrl };
  }
  if (recommendation.linkedModule === "Campaign OS") {
    return { label: "Open Campaign OS", url: `/api/pharmacy-campaigns?slug=${s}&serviceId=${serviceId}` };
  }

  return {
    label: `Open ${recommendation.linkedModule}`,
    url: recommendation.linkedUrl,
  };
}

function scoreGainApplied(gain: number): number {
  return Math.max(1, Math.round(gain * 0.15));
}

function analyseAuthoritativeService(
  slug: string,
  serviceId: string,
): ServiceAuthorityEnhancement {
  return analyseServiceAuthorityEnhancement(slug, serviceId as VisualExperienceServiceId);
}

function resolveWorkspaceServiceId(slug: string, requested?: string | null): string | null {
  return resolveCampaignImprovementsServiceForTenant(slug, requested).resolvedServiceId;
}

function buildWorkspaceTasks(
  slug: string,
  store: PharmacyEnhancementWorkspaceStore,
  serviceFilter?: string | null,
): EnhancementWorkspaceTask[] {
  const serviceId = resolveWorkspaceServiceId(slug, serviceFilter);
  if (!serviceId) return [];
  const service = analyseAuthoritativeService(slug, serviceId);

  const taskByRecId = new Map(store.tasks.map((t) => [t.recommendationId, t]));
  const tasks: EnhancementWorkspaceTask[] = [];
  const seenRecIds = new Set<string>();

  for (const rec of service.recommendations) {
    seenRecIds.add(rec.id);
    const existing = taskByRecId.get(rec.id);
    const status: EnhancementTaskStatus = existing?.status || "ready";
    tasks.push({
      ...rec,
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      workspaceTaskId: existing?.id || `ws-${service.serviceId}-${rec.id}`,
      status,
      completedAt: existing?.completedAt || null,
      completedBy: existing?.completedBy || null,
      beforeScore: existing?.beforeScore ?? null,
      afterScore: existing?.afterScore ?? null,
      notes: existing?.notes || null,
      testMode: existing?.testMode ?? !classifyRealEnhancementAction(rec),
      primaryAction: resolveEnhancementPrimaryAction(rec, slug, service.serviceId),
      estimatedAuthorityGain: rec.estimatedScoreGain,
    });
  }

  for (const record of store.tasks) {
    if (record.status !== "completed" || seenRecIds.has(record.recommendationId)) continue;
    if (serviceId && record.serviceId !== serviceId) continue;
    tasks.push({
      id: record.recommendationId,
      signalId: record.recommendationId,
      title: `Completed: ${record.recommendationId}`,
      category: "humanExpertise",
      reason: record.notes || "Completed real enhancement action",
      evidence: [],
      difficulty: "Easy",
      estimatedImpact: "Medium",
      estimatedScoreGain: 0,
      estimatedAiGain: 0,
      estimatedVisibilityGain: 0,
      linkedModule: record.linkedModule,
      linkedUrl: "",
      nextAction: "",
      serviceId: record.serviceId,
      serviceName: record.serviceId,
      workspaceTaskId: record.id,
      status: "completed",
      completedAt: record.completedAt,
      completedBy: record.completedBy,
      beforeScore: record.beforeScore,
      afterScore: record.afterScore,
      notes: record.notes,
      testMode: record.testMode,
      primaryAction: { label: "View workspace", url: `/api/pharmacy-enhancement-workspace?slug=${slug}&service=${record.serviceId}` },
      estimatedAuthorityGain: 0,
    });
  }

  return tasks;
}

function buildSummary(
  tasks: EnhancementWorkspaceTask[],
  service: ServiceAuthorityEnhancement | null,
): EnhancementWorkspaceSummary {
  const active = tasks.filter((t) => t.status !== "completed" && t.status !== "deferred");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const baseCurrent = service?.currentAuthorityScore ?? 0;
  const potential = service?.potentialAuthorityScore ?? 100;
  const realCompleted = completedTasks.filter((t) => !t.testMode).length;
  const testCompleted = completedTasks.filter((t) => t.testMode).length;
  const projectedGain = testCompleted > 0
    ? completedTasks.filter((t) => t.testMode).reduce((sum, t) => sum + scoreGainApplied(t.estimatedScoreGain), 0)
    : 0;
  const realScores = completedTasks.filter((t) => !t.testMode && t.afterScore !== null).map((t) => t.afterScore as number);
  const projected = realScores.length
    ? Math.round(realScores.reduce((a, b) => a + b, 0) / realScores.length)
    : Math.min(potential, baseCurrent + projectedGain);

  return {
    currentAuthorityScore: baseCurrent,
    projectedAuthorityScore: projected,
    potentialAuthorityScore: potential,
    recommendationsRemaining: active.length,
    easyWinsRemaining: active.filter((t) => t.difficulty === "Easy").length,
    highImpactRemaining: active.filter((t) => t.estimatedImpact === "High").length,
    completed: completedTasks.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    deferred: tasks.filter((t) => t.status === "deferred").length,
    estimatedOverallGain: Math.max(0, potential - projected),
    testMode: completedTasks.some((t) => t.testMode) && realCompleted === 0,
  };
}

function findRecommendation(
  doc: ReturnType<typeof loadPharmacyAuthorityEnhancement>,
  recommendationId: string,
): { rec: EnhancementRecommendation; serviceId: string; beforeScore: number } | null {
  if (!doc) return null;
  for (const svc of doc.services) {
    const rec = svc.recommendations.find((r) => r.id === recommendationId);
    if (rec) return { rec, serviceId: svc.serviceId, beforeScore: svc.currentAuthorityScore };
  }
  return null;
}

function resolveAfterScore(slug: string, serviceId: string, beforeScore: number | null, testMode: boolean): number | null {
  if (beforeScore === null) return null;
  if (testMode) return beforeScore;
  const audit = getServiceAuthorityAudit(slug, serviceId as Parameters<typeof getServiceAuthorityAudit>[1]);
  return audit?.overallScore ?? beforeScore;
}

export function buildEnhancementWorkspaceBoard(
  slug: string,
  options?: { serviceId?: string | null },
): EnhancementWorkspaceBoard {
  const store = loadEnhancementWorkspaceStore(slug);
  const tasks = buildWorkspaceTasks(slug, store, options?.serviceId);
  return {
    ready: tasks.filter((t) => t.status === "ready"),
    inProgress: tasks.filter((t) => t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed"),
    deferred: tasks.filter((t) => t.status === "deferred"),
  };
}

export function buildEnhancementWorkspaceView(
  slug: string,
  options?: { serviceId?: string | null },
): EnhancementWorkspaceView {
  const s = safeSlug(slug);
  const pageProfile = buildPharmacyServicePageProfile(s);
  const store = loadEnhancementWorkspaceStore(s);
  const authority = resolveCampaignImprovementsServiceForTenant(s, options?.serviceId);
  const serviceId = authority.resolvedServiceId;
  const service = serviceId ? analyseAuthoritativeService(s, serviceId) : null;
  const tasks = buildWorkspaceTasks(s, store, serviceId);
  const board: EnhancementWorkspaceBoard = {
    ready: tasks.filter((t) => t.status === "ready"),
    inProgress: tasks.filter((t) => t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed"),
    deferred: tasks.filter((t) => t.status === "deferred"),
  };
  const buildPageOnly =
    Boolean(service) &&
    service!.recommendations.length === 1 &&
    service!.recommendations[0]!.signalId === "build-page";
  const audit = serviceId ? getServiceAuthorityAudit(s, serviceId) : null;
  const launchAuthority: CampaignImprovementsLaunchAuthority = audit
    ? {
        publishGate: audit.publishGate,
        overallScore: audit.overallScore,
        label: audit.label,
        criticalIssues: [...audit.criticalIssues],
        missingSignals: [...audit.missingSignals],
        livePublishReady: publicationAllowsLaunch(audit.publishGate),
      }
    : {
        publishGate: "FAIL",
        overallScore: 0,
        label: "Not Ready",
        criticalIssues: ["Authority audit not run"],
        missingSignals: [],
        livePublishReady: false,
      };

  return {
    slug: s,
    pharmacyName: pageProfile.pharmacyName,
    brandPrimaryColor: pageProfile.brandPrimaryColor,
    selectedServiceId: serviceId,
    selectedServiceName: service?.serviceName || null,
    authoritativeServiceIds: authority.authoritativeServiceIds,
    serviceSource: authority.source,
    visualPageRecognised: Boolean(service) && !buildPageOnly,
    launchAuthority,
    summary: buildSummary(tasks, service),
    board,
    store,
    lastRefreshedAt: service?.lastAnalysedAt || store.updatedAt,
  };
}

export function refreshPlatformAfterEnhancementComplete(slug: string): {
  authorityRefreshedAt: string;
  enhancementRefreshedAt: string;
  growthRefreshedAt: string;
  launchQueueRefreshedAt: string;
} {
  const s = safeSlug(slug);
  const authority = refreshPharmacyAuthorityReadiness(s);
  const enhancement = refreshPharmacyAuthorityEnhancement(s);
  const growth = refreshPharmacyGrowthActionPlan(s);
  const launchQueue = refreshPharmacyCampaignLaunchQueue(s);
  return {
    authorityRefreshedAt: authority.updatedAt,
    enhancementRefreshedAt: enhancement.updatedAt,
    growthRefreshedAt: growth.plan.lastUpdated,
    launchQueueRefreshedAt: launchQueue.store.updatedAt,
  };
}

export function updateEnhancementTaskStatus(
  slug: string,
  recommendationId: string,
  status: EnhancementTaskStatus,
  options?: { completedBy?: string; notes?: string; serviceId?: string },
): { store: PharmacyEnhancementWorkspaceStore; view: EnhancementWorkspaceView; refresh: ReturnType<typeof refreshPlatformAfterEnhancementComplete> | null } {
  const s = safeSlug(slug);
  const store = loadEnhancementWorkspaceStore(s);
  const doc = loadPharmacyAuthorityEnhancement(s);
  const found = findRecommendation(doc, recommendationId);
  let serviceId = options?.serviceId || found?.serviceId || "";
  let beforeScore: number | null = found?.beforeScore ?? null;
  const isComplete = status === "completed";

  if (isComplete && found) {
    const validation = validateRealEnhancementAction(s, serviceId, found.rec);
    const actionType = classifyRealEnhancementAction(found.rec);
    if (actionType && !validation.valid) {
      throw new EnhancementCompletionError(
        "Action not complete yet — please complete the required fields first.",
      );
    }
  }

  const existingIdx = store.tasks.findIndex((t) => t.recommendationId === recommendationId);
  const now = new Date().toISOString();
  const useTestMode = isComplete && found ? !classifyRealEnhancementAction(found.rec) : existingIdx >= 0 ? store.tasks[existingIdx]!.testMode : true;

  const record: EnhancementWorkspaceTaskRecord = {
    id: existingIdx >= 0 ? store.tasks[existingIdx]!.id : `ws-${serviceId}-${recommendationId}`,
    recommendationId,
    serviceId,
    status,
    completedAt: isComplete ? now : existingIdx >= 0 ? store.tasks[existingIdx]!.completedAt : null,
    completedBy: isComplete ? options?.completedBy || "pharmacy-owner" : existingIdx >= 0 ? store.tasks[existingIdx]!.completedBy : null,
    linkedModule: existingIdx >= 0 ? store.tasks[existingIdx]!.linkedModule : found?.rec.linkedModule || "Enhancement Workspace",
    beforeScore: isComplete ? beforeScore : existingIdx >= 0 ? store.tasks[existingIdx]!.beforeScore : null,
    afterScore: null,
    notes: options?.notes ?? (existingIdx >= 0 ? store.tasks[existingIdx]!.notes : null),
    testMode: useTestMode,
  };

  if (existingIdx >= 0) {
    store.tasks[existingIdx] = record;
  } else {
    store.tasks.push(record);
  }

  saveEnhancementWorkspaceStore(store);

  let refresh: ReturnType<typeof refreshPlatformAfterEnhancementComplete> | null = null;
  if (isComplete) {
    refresh = refreshPlatformAfterEnhancementComplete(s);
    const afterScore = resolveAfterScore(s, serviceId, beforeScore, useTestMode);
    if (useTestMode && beforeScore !== null && found) {
      record.afterScore = Math.min(
        100,
        beforeScore +
          scoreGainApplied(found.rec.estimatedScoreGain),
      );
    } else {
      record.afterScore = afterScore;
    }
    const idx = store.tasks.findIndex((t) => t.recommendationId === recommendationId);
    if (idx >= 0) store.tasks[idx] = record;
    saveEnhancementWorkspaceStore(store);
  }

  return {
    store,
    view: buildEnhancementWorkspaceView(s, { serviceId: options?.serviceId }),
    refresh,
  };
}

export function markEnhancementTaskComplete(
  slug: string,
  recommendationId: string,
  options?: { completedBy?: string; notes?: string; serviceId?: string },
) {
  return updateEnhancementTaskStatus(slug, recommendationId, "completed", options);
}

export function getEnhancementWorkspaceProgress(slug: string, serviceId?: string): EnhancementWorkspaceProgress {
  const s = safeSlug(slug);
  const store = loadEnhancementWorkspaceStore(s);
  const resolvedServiceId = resolveWorkspaceServiceId(s, serviceId || null);
  const tasks = buildWorkspaceTasks(s, store, resolvedServiceId);
  const svcEnhancement = resolvedServiceId ? analyseAuthoritativeService(s, resolvedServiceId) : null;
  const baseCurrent = svcEnhancement?.currentAuthorityScore ?? 0;
  const potential = svcEnhancement?.potentialAuthorityScore ?? 100;
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const realCompletedTasks = completedTasks.filter((t) => !t.testMode);
  const remaining = tasks.filter((t) => t.status !== "completed" && t.status !== "deferred");
  const testCompleted = completedTasks.filter((t) => t.testMode);
  const projectedGain = testCompleted.reduce((sum, t) => sum + scoreGainApplied(t.estimatedScoreGain), 0);
  const realAfterScores = realCompletedTasks.filter((t) => t.afterScore !== null).map((t) => t.afterScore as number);
  const projected = realAfterScores.length
    ? Math.round(realAfterScores.reduce((a, b) => a + b, 0) / realAfterScores.length)
    : Math.min(potential, baseCurrent + projectedGain);

  const audit = resolvedServiceId
    ? getServiceAuthorityAudit(s, resolvedServiceId as Parameters<typeof getServiceAuthorityAudit>[1])
    : null;
  const publishGate = audit?.publishGate ?? "FAIL";

  const nextReal = remaining.find((t) => classifyRealEnhancementAction(t));

  return {
    currentScore: baseCurrent,
    projectedScore: projected,
    potentialScore: potential,
    completed: completedTasks.length,
    realCompleted: realCompletedTasks.length,
    remaining: remaining.length,
    easyWinsRemaining: remaining.filter((t) => t.difficulty === "Easy").length,
    highImpactRemaining: remaining.filter((t) => t.estimatedImpact === "High").length,
    estimatedGain: Math.max(0, potential - projected),
    publishGate,
    nextRecommendedRealAction: nextReal
      ? resolveEnhancementPrimaryAction(nextReal, s, nextReal.serviceId)
      : null,
    workspaceUrl: `/api/pharmacy-enhancement-workspace?slug=${s}${resolvedServiceId ? `&service=${resolvedServiceId}` : ""}`,
  };
}

export { EnhancementCompletionError, classifyRealEnhancementAction, validateRealEnhancementAction };

export function getEnhancementWorkspacePath(slug: string): string {
  return workspacePath(slug);
}

export { ENHANCEMENT_CATEGORY_LABELS };
