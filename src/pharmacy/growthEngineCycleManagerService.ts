/**
 * Growth Engine — Growth Cycle Manager V1.
 * Orchestrates Growth Cycles, timeline, and journey view from read-only bridges.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import {
  GROWTH_CYCLE_STAGES,
  GROWTH_CYCLE_VERSION,
  type GrowthCycle,
  type GrowthCycleStage,
  type GrowthCycleStageRecord,
  type GrowthCycleStatus,
  type GrowthCycleStoreDoc,
  type GrowthJourneyView,
  type GrowthTimeline,
  type GrowthTimelineCycleItem,
  type GrowthTimelineFoundationStep,
} from "./growthEngineCycleModel.ts";
import {
  findLaunchPlanForCycle,
  getCompletedServiceIds,
  loadGrowthMemory,
  recordGrowthMemoryEvent,
  saveGrowthMemory,
  syncMemoryFromBridges,
} from "./growthEngineCycleMemoryService.ts";
import {
  buildConsultantMessage,
  buildCycleAwareRecommendation,
  buildCycleLearningContext,
} from "./growthEngineCycleLearningEngine.ts";
import {
  computeLaunchWeek,
  createLaunchPlanIfEligible,
  getLaunchPlanForCycle,
} from "./growthEngineLaunchManagerService.ts";
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { buildGrowthPlanIntelligence } from "./growthEngineCampaignRecommendationEngine.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  contentPackageReviewed,
  loadContentPackage,
} from "./pharmacyContentPackageService.ts";
import {
  readPharmacyIndexingSummary,
  readPharmacyRegistry,
} from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

const GROWTH_ENGINE_DIR = path.join(WORKSPACE_ROOT, "data/growth-engine");

function cyclesPath(slug: string): string {
  return path.join(GROWTH_ENGINE_DIR, `${slug}-cycles.json`);
}

function serviceLabel(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function loadGrowthCycleStore(slug: string): GrowthCycleStoreDoc {
  const file = cyclesPath(slug);
  if (!fs.existsSync(file)) {
    return { version: GROWTH_CYCLE_VERSION, slug, updatedAt: "", cycles: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as GrowthCycleStoreDoc;
    return {
      version: GROWTH_CYCLE_VERSION,
      slug,
      updatedAt: String(raw.updatedAt || ""),
      cycles: Array.isArray(raw.cycles) ? raw.cycles : [],
    };
  } catch {
    return { version: GROWTH_CYCLE_VERSION, slug, updatedAt: "", cycles: [] };
  }
}

export function saveGrowthCycleStore(doc: GrowthCycleStoreDoc): string {
  fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(cyclesPath(doc.slug), JSON.stringify(doc, null, 2));
  return cyclesPath(doc.slug);
}

function stageIndex(stage: GrowthCycleStage): number {
  return GROWTH_CYCLE_STAGES.indexOf(stage);
}

function ensureStageHistory(
  history: GrowthCycleStageRecord[],
  stage: GrowthCycleStage,
  note?: string,
): GrowthCycleStageRecord[] {
  if (history.some((h) => h.stage === stage)) return history;
  return [...history, { stage, enteredAt: new Date().toISOString(), note }];
}

function countServiceAssets(slug: string, serviceId: string) {
  const pkg = loadContentPackage(slug, serviceId);
  const generated = pkg?.assets.filter((a) => a.included).reduce((n, a) => n + (a.count || 1), 0) || 0;
  const registry = readPharmacyRegistry(slug);
  const servicePages = registry?.pages.filter((p) => p.serviceId === serviceId) || [];
  const published = servicePages.filter((p) => p.lastPublishedAt).length;
  const submitted = servicePages.filter((p) => p.submittedAt).length;
  const indexed = servicePages.filter((p) => p.indexingStatus === "indexed").length;
  return { generated, published, submitted, indexed, pkg };
}

function inferStage(
  slug: string,
  serviceId: string,
  cycleNumber: number,
  cycleStatus: GrowthCycleStatus,
  history: GrowthCycleStageRecord[],
): GrowthCycleStage {
  if (cycleStatus === "completed") return "completed";
  if (cycleStatus === "recommended" || cycleStatus === "postponed" || cycleStatus === "rejected") {
    return "recommended";
  }

  const generated = contentPackageGenerated(slug, serviceId);
  const reviewed = contentPackageReviewed(slug, serviceId);
  const approved = contentPackageApproved(slug, serviceId);
  const assets = countServiceAssets(slug, serviceId);
  const launchPlan = findLaunchPlanForCycle(slug, cycleNumber);

  if (assets.indexed > 0 && assets.published > 0 && assets.indexed >= Math.ceil(Math.max(assets.published, 1) * 0.5)) {
    const visibility = readPharmacyVisibilityReport(slug);
    if (visibility && assets.indexed >= 3) return "performance-review";
    return "index-monitoring";
  }
  if (assets.submitted > 0) return "submitted";
  if (assets.published > 0) return "publishing";
  if (launchPlan) return "launch-plan-created";
  if (approved) return "approved-for-launch";
  if (reviewed) return "quality-review";
  if (generated) return "generated";
  if (history.some((h) => h.stage === "generating")) return "generating";
  if (history.some((h) => h.stage === "approved")) return "approved";
  return "recommended";
}

function computeCycleStatus(stage: GrowthCycleStage, previous: GrowthCycleStatus): GrowthCycleStatus {
  if (stage === "completed") return "completed";
  if (previous === "postponed" || previous === "rejected") return previous;
  if (stage === "recommended") return "recommended";
  return "in_progress";
}

function computeProgressPct(stage: GrowthCycleStage): number {
  const idx = stageIndex(stage);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / GROWTH_CYCLE_STAGES.length) * 100);
}

function buildFoundationTimeline(slug: string): GrowthTimelineFoundationStep[] {
  const framework = buildGrowthEngineFramework(slug);
  const labels: Record<string, string> = {
    "business-intelligence": "Your Pharmacy",
    "local-market": "Your Local Market",
    "website-intelligence": "Your Website Report",
    "growth-plan": "Your Growth Plan",
  };
  return ["business-intelligence", "local-market", "website-intelligence", "growth-plan"].map(
    (id) => {
      const step = framework.steps.find((s) => s.id === id);
      return {
        id,
        label: labels[id] || id,
        complete: step?.status === "complete",
      };
    },
  );
}

function syncCycleFromState(
  slug: string,
  cycleNumber: number,
  serviceId: string,
  reason: string,
  evidenceSources: string[],
  existing?: GrowthCycle,
): GrowthCycle {
  const assets = countServiceAssets(slug, serviceId);
  const generated = contentPackageGenerated(slug, serviceId);
  const reviewed = contentPackageReviewed(slug, serviceId);
  const approved = contentPackageApproved(slug, serviceId);
  const visibility = readPharmacyVisibilityReport(slug);
  const serviceVisibility = visibility?.services?.find((s) => s.serviceId === serviceId);

  syncMemoryFromBridges(slug, serviceId, cycleNumber, {
    generated,
    reviewed,
    approved,
    publishedCount: assets.published,
    submittedCount: assets.submitted,
    indexedCount: assets.indexed,
  });

  let history = existing?.stageHistory || [];
  let status = existing?.status || "recommended";
  history = ensureStageHistory(history, "recommended", "Evidence-backed recommendation");

  if (existing?.status === "completed") {
    history = ensureStageHistory(history, "completed");
  } else {
    if (status === "in_progress" || generated) history = ensureStageHistory(history, "approved", "Cycle approved");
    if (generated) history = ensureStageHistory(history, "generated");
    if (reviewed) history = ensureStageHistory(history, "quality-review");
    if (approved) history = ensureStageHistory(history, "approved-for-launch");
    if (assets.published > 0) history = ensureStageHistory(history, "publishing");
    if (assets.submitted > 0) history = ensureStageHistory(history, "submitted");
    if (assets.indexed > 0) history = ensureStageHistory(history, "index-monitoring");
    if (assets.indexed >= 3) history = ensureStageHistory(history, "performance-review");
  }

  const currentStage = existing?.status === "completed" ? "completed" : inferStage(slug, serviceId, cycleNumber, status, history);
  status = computeCycleStatus(currentStage, status);

  const launchPlan = findLaunchPlanForCycle(slug, cycleNumber);
  if (launchPlan) history = ensureStageHistory(history, "launch-plan-created");

  const startDate = existing?.startDate || history.find((h) => h.stage === "approved")?.enteredAt || null;
  const launchDate =
    existing?.launchDate ||
    history.find((h) => h.stage === "launch-plan-created")?.enteredAt ||
    history.find((h) => h.stage === "publishing")?.enteredAt ||
    null;
  const completionDate =
    existing?.completionDate || (status === "completed" ? history.find((h) => h.stage === "completed")?.enteredAt || null : null);

  let durationDays: number | null = null;
  if (startDate && completionDate) {
    durationDays = Math.ceil((new Date(completionDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000));
  }

  const cycle: GrowthCycle = {
    cycleNumber,
    serviceId,
    recommendedService: serviceLabel(serviceId),
    status,
    reasonRecommended: reason,
    evidenceSources,
    startDate,
    launchDate,
    completionDate,
    durationDays,
    currentStage,
    stageHistory: history,
    generatedAssets: { generated: assets.generated, published: 0, indexed: 0 },
    publishedAssets: { generated: assets.generated, published: assets.published, indexed: assets.indexed },
    indexedAssets: { generated: assets.generated, published: assets.published, indexed: assets.indexed },
    rankingSummary: {
      servicesTracked: visibility?.trackedServices || 0,
      indexedPages: assets.indexed,
      visibilityStatus: serviceVisibility?.visibilityStatus || visibility?.visibilityStatus || "Not tracked",
      note: serviceVisibility
        ? `${serviceVisibility.indexedStatus} — ${serviceVisibility.visibilityStatus}`
        : "Visibility data will appear after publishing and indexing",
    },
    reviewSummary: {
      contentReviewed: reviewed,
      qualityApproved: approved,
      reviewedAt: assets.pkg?.reviewedAt || null,
      approvedAt: assets.pkg?.approvedAt || null,
      note: approved
        ? "Content approved for launch"
        : reviewed
          ? "In quality review — approve when ready to launch"
          : generated
            ? "Awaiting content review"
            : "Not yet generated",
    },
    completionNotes: existing?.completionNotes || null,
    lessonsLearned: existing?.lessonsLearned || buildDefaultLessons(slug, serviceId, status),
    nextRecommendation: null,
    launchPlanId: launchPlan?.id || null,
    launchWeek: null,
  };

  if (status === "in_progress" && approved) {
    const plan = createLaunchPlanIfEligible(slug, cycle);
    if (plan) cycle.launchPlanId = plan.id;
  }

  cycle.launchWeek = computeLaunchWeek(cycle, getLaunchPlanForCycle(slug, cycle));

  if (currentStage === "performance-review" && assets.indexed >= 3 && status !== "completed") {
    cycle.status = "completed";
    cycle.currentStage = "completed";
    cycle.completionDate = new Date().toISOString();
    cycle.stageHistory = ensureStageHistory(cycle.stageHistory, "completed", "Cycle completed after indexing review");
    if (!loadGrowthMemory(slug).events.some((e) => e.type === "cycle_completed" && e.serviceId === serviceId)) {
      recordGrowthMemoryEvent(slug, "cycle_completed", `${cycle.recommendedService} Growth Cycle completed`, {
        serviceId,
        cycleNumber,
      });
    }
  }

  return cycle;
}

function buildDefaultLessons(slug: string, serviceId: string, status: GrowthCycleStatus): string[] {
  if (status !== "completed") return [];
  const assets = countServiceAssets(slug, serviceId);
  const lessons: string[] = [];
  if (assets.indexed > 0) lessons.push(`${assets.indexed} pages indexed — local search visibility improved for ${serviceLabel(serviceId)}.`);
  if (assets.published > 0) lessons.push(`${assets.published} pages published — patient education content now live.`);
  return lessons;
}

export function syncGrowthCycles(slug: string): GrowthCycleStoreDoc {
  const store = loadGrowthCycleStore(slug);
  const intel = buildGrowthPlanIntelligence(slug);
  const nextRec = buildCycleAwareRecommendation(slug);
  const completedIds = getCompletedServiceIds(slug);

  const activeServiceId = nextRec?.serviceId || intel.primaryCampaign?.serviceId;
  if (!activeServiceId) {
    saveGrowthCycleStore(store);
    return store;
  }

  const existingActive = store.cycles.find((c) => c.status === "in_progress" || c.status === "recommended");
  const alreadyHasService = store.cycles.some((c) => c.serviceId === activeServiceId);
  const nextCycleNumber = store.cycles.length ? Math.max(...store.cycles.map((c) => c.cycleNumber)) + 1 : 1;

  if (!existingActive && !completedIds.includes(activeServiceId) && !alreadyHasService) {
    const reason = nextRec?.reason || intel.primaryCampaign?.reason || "Evidence-backed recommendation";
    const evidence = nextRec ? [nextRec.evidenceSummary] : intel.primaryCampaign?.evidenceSources || [];

    const cycle = syncCycleFromState(slug, nextCycleNumber, activeServiceId, reason, evidence);
    store.cycles.push(cycle);

    const memory = loadGrowthMemory(slug);
    if (!memory.events.some((e) => e.type === "recommendation_created" && e.serviceId === activeServiceId)) {
      recordGrowthMemoryEvent(slug, "recommendation_created", reason, {
        serviceId: activeServiceId,
        cycleNumber: nextCycleNumber,
      });
    }
    if (!memory.events.some((e) => e.type === "cycle_started" && e.serviceId === activeServiceId)) {
      recordGrowthMemoryEvent(slug, "cycle_started", `Growth Cycle ${nextCycleNumber} started for ${cycle.recommendedService}`, {
        serviceId: activeServiceId,
        cycleNumber: nextCycleNumber,
      });
    }
  } else if (existingActive) {
    const idx = store.cycles.findIndex((c) => c.cycleNumber === existingActive.cycleNumber);
    store.cycles[idx] = syncCycleFromState(
      slug,
      existingActive.cycleNumber,
      existingActive.serviceId,
      existingActive.reasonRecommended,
      existingActive.evidenceSources,
      existingActive,
    );
  }

  for (let i = 0; i < store.cycles.length; i++) {
    if (store.cycles[i].status === "completed") continue;
    if (store.cycles[i].cycleNumber === (existingActive?.cycleNumber ?? -1)) continue;
    store.cycles[i] = syncCycleFromState(
      slug,
      store.cycles[i].cycleNumber,
      store.cycles[i].serviceId,
      store.cycles[i].reasonRecommended,
      store.cycles[i].evidenceSources,
      store.cycles[i],
    );
  }

  const next = buildCycleAwareRecommendation(slug);
  for (const cycle of store.cycles) {
    if (cycle.status === "completed") {
      cycle.nextRecommendation = next;
    }
  }

  saveGrowthCycleStore(store);
  return store;
}

export function buildGrowthTimeline(slug: string): GrowthTimeline {
  const store = syncGrowthCycles(slug);
  const foundationSteps = buildFoundationTimeline(slug);

  const cycles: GrowthTimelineCycleItem[] = store.cycles.map((c) => ({
    cycleNumber: c.cycleNumber,
    serviceName: c.recommendedService,
    serviceId: c.serviceId,
    status: c.status,
    currentStage: c.currentStage,
    launchWeek: c.launchWeek,
    label:
      c.status === "completed"
        ? "Completed"
        : c.status === "in_progress" && c.launchWeek
          ? `Week ${c.launchWeek}`
          : c.status === "in_progress"
            ? "In Progress"
            : "Recommended",
  }));

  return { foundationSteps, cycles };
}

export function buildGrowthJourneyView(slug: string): GrowthJourneyView {
  const store = syncGrowthCycles(slug);
  const timeline = buildGrowthTimeline(slug);
  const memory = loadGrowthMemory(slug);
  const nextRecommendation = buildCycleAwareRecommendation(slug);

  const completedCycles = store.cycles.filter((c) => c.status === "completed");
  const currentCycle =
    store.cycles.find((c) => c.status === "in_progress") ||
    store.cycles.find((c) => c.status === "recommended") ||
    null;

  const launchPlan = currentCycle ? getLaunchPlanForCycle(slug, currentCycle) : null;
  const progressPct = currentCycle ? computeProgressPct(currentCycle.currentStage) : completedCycles.length ? 100 : 0;

  const expectedOutcome = nextRecommendation
    ? `Improves local content coverage for ${nextRecommendation.serviceName}, supports Google Business Profile activity, and builds patient education assets.`
    : currentCycle
      ? `Launch and monitor ${currentCycle.recommendedService} — structured publishing, indexing, and performance review.`
      : "Complete foundation steps to begin your ongoing growth programme.";

  return {
    version: GROWTH_CYCLE_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    currentCycle,
    completedCycles,
    timeline,
    currentLaunchWeek: currentCycle?.launchWeek ?? null,
    currentProgressPct: progressPct,
    nextRecommendation,
    expectedBusinessOutcome: expectedOutcome,
    consultantMessage: buildConsultantMessage(slug, nextRecommendation),
    launchPlan,
    memoryEventCount: memory.events.length,
  };
}

export function completeGrowthCycle(slug: string, cycleNumber: number, notes?: string): GrowthCycle | null {
  const store = loadGrowthCycleStore(slug);
  const idx = store.cycles.findIndex((c) => c.cycleNumber === cycleNumber);
  if (idx < 0) return null;

  const cycle = store.cycles[idx];
  cycle.status = "completed";
  cycle.currentStage = "completed";
  cycle.completionDate = new Date().toISOString();
  cycle.completionNotes = notes || "Growth Cycle marked complete.";
  cycle.stageHistory = ensureStageHistory(cycle.stageHistory, "completed", cycle.completionNotes);

  recordGrowthMemoryEvent(slug, "cycle_completed", cycle.completionNotes, {
    serviceId: cycle.serviceId,
    cycleNumber,
  });
  recordGrowthMemoryEvent(slug, "launch_complete", `Launch complete for ${cycle.recommendedService}`, {
    serviceId: cycle.serviceId,
    cycleNumber,
  });

  store.cycles[idx] = cycle;
  saveGrowthCycleStore(store);
  return cycle;
}
