/**
 * Growth Engine — Growth Memory V1.
 * Permanent history: recommendations, generations, publishes, submissions, completions.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import {
  GROWTH_MEMORY_VERSION,
  type GrowthCycleLaunchPlan,
  type GrowthMemoryDoc,
  type GrowthMemoryEvent,
  type GrowthMemoryEventType,
} from "./growthEngineCycleModel.ts";

const GROWTH_ENGINE_DIR = path.join(WORKSPACE_ROOT, "data/growth-engine");

function memoryPath(slug: string): string {
  return path.join(GROWTH_ENGINE_DIR, `${slug}-memory.json`);
}

function launchPlansPath(slug: string): string {
  return path.join(GROWTH_ENGINE_DIR, `${slug}-launch-plans.json`);
}

interface LaunchPlanStoreDoc {
  version: 1;
  slug: string;
  updatedAt: string;
  plans: GrowthCycleLaunchPlan[];
}

export function loadGrowthMemory(slug: string): GrowthMemoryDoc {
  const file = memoryPath(slug);
  if (!fs.existsSync(file)) {
    return { version: GROWTH_MEMORY_VERSION, slug, updatedAt: "", events: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as GrowthMemoryDoc;
    return {
      version: GROWTH_MEMORY_VERSION,
      slug,
      updatedAt: String(raw.updatedAt || ""),
      events: Array.isArray(raw.events) ? raw.events : [],
    };
  } catch {
    return { version: GROWTH_MEMORY_VERSION, slug, updatedAt: "", events: [] };
  }
}

export function saveGrowthMemory(doc: GrowthMemoryDoc): string {
  fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(memoryPath(doc.slug), JSON.stringify(doc, null, 2));
  return memoryPath(doc.slug);
}

export function recordGrowthMemoryEvent(
  slug: string,
  type: GrowthMemoryEventType,
  detail: string,
  options?: {
    serviceId?: string | null;
    cycleNumber?: number | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
): GrowthMemoryEvent {
  const doc = loadGrowthMemory(slug);
  const event: GrowthMemoryEvent = {
    id: randomUUID(),
    type,
    at: new Date().toISOString(),
    serviceId: options?.serviceId ?? null,
    cycleNumber: options?.cycleNumber ?? null,
    detail,
    metadata: options?.metadata,
  };
  doc.events.push(event);
  saveGrowthMemory(doc);
  return event;
}

export function hasMemoryEventType(slug: string, type: GrowthMemoryEventType, serviceId?: string): boolean {
  return loadGrowthMemory(slug).events.some(
    (e) => e.type === type && (serviceId == null || e.serviceId === serviceId),
  );
}

export function getCompletedServiceIds(slug: string): string[] {
  return [
    ...new Set(
      loadGrowthMemory(slug)
        .events.filter((e) => e.type === "cycle_completed" && e.serviceId)
        .map((e) => e.serviceId as string),
    ),
  ];
}

export function getRejectedServiceIds(slug: string): string[] {
  return [
    ...new Set(
      loadGrowthMemory(slug)
        .events.filter((e) => e.type === "recommendation_rejected" && e.serviceId)
        .map((e) => e.serviceId as string),
    ),
  ];
}

export function getPostponedServiceIds(slug: string): string[] {
  return [
    ...new Set(
      loadGrowthMemory(slug)
        .events.filter((e) => e.type === "recommendation_postponed" && e.serviceId)
        .map((e) => e.serviceId as string),
    ),
  ];
}

export function getAcceptedServiceIds(slug: string): string[] {
  return [
    ...new Set(
      loadGrowthMemory(slug)
        .events.filter((e) => e.type === "recommendation_accepted" && e.serviceId)
        .map((e) => e.serviceId as string),
    ),
  ];
}

export function recordRecommendationDecision(
  slug: string,
  serviceId: string,
  decision: "accepted" | "rejected" | "postponed",
  detail: string,
  cycleNumber?: number,
): GrowthMemoryEvent {
  const typeMap = {
    accepted: "recommendation_accepted" as const,
    rejected: "recommendation_rejected" as const,
    postponed: "recommendation_postponed" as const,
  };
  return recordGrowthMemoryEvent(slug, typeMap[decision], detail, { serviceId, cycleNumber });
}

export function loadLaunchPlans(slug: string): GrowthCycleLaunchPlan[] {
  const file = launchPlansPath(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as LaunchPlanStoreDoc;
    return Array.isArray(raw.plans) ? raw.plans : [];
  } catch {
    return [];
  }
}

export function saveLaunchPlan(slug: string, plan: GrowthCycleLaunchPlan): void {
  fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
  const existing = loadLaunchPlans(slug).filter((p) => p.id !== plan.id);
  const doc: LaunchPlanStoreDoc = {
    version: 1,
    slug,
    updatedAt: new Date().toISOString(),
    plans: [...existing, plan],
  };
  fs.writeFileSync(launchPlansPath(slug), JSON.stringify(doc, null, 2));
  recordGrowthMemoryEvent(slug, "launch_plan_created", `Launch plan created for ${plan.serviceName}`, {
    serviceId: plan.serviceId,
    cycleNumber: plan.cycleNumber,
    metadata: { planId: plan.id, weeks: plan.schedule.recommendedWeeks },
  });
}

export function findLaunchPlanForCycle(slug: string, cycleNumber: number): GrowthCycleLaunchPlan | null {
  return loadLaunchPlans(slug).find((p) => p.cycleNumber === cycleNumber) || null;
}

export function syncMemoryFromBridges(
  slug: string,
  serviceId: string,
  cycleNumber: number,
  state: {
    generated: boolean;
    reviewed: boolean;
    approved: boolean;
    publishedCount: number;
    submittedCount: number;
    indexedCount: number;
  },
): void {
  if (state.generated && !hasMemoryEventType(slug, "generation_complete", serviceId)) {
    recordGrowthMemoryEvent(slug, "generation_complete", `Content ecosystem generated for ${serviceId}`, {
      serviceId,
      cycleNumber,
    });
  }
  if (state.reviewed && !hasMemoryEventType(slug, "content_reviewed", serviceId)) {
    recordGrowthMemoryEvent(slug, "content_reviewed", `Content reviewed for ${serviceId}`, {
      serviceId,
      cycleNumber,
    });
  }
  if (state.approved && !hasMemoryEventType(slug, "quality_approved", serviceId)) {
    recordGrowthMemoryEvent(slug, "quality_approved", `Quality approved for ${serviceId}`, {
      serviceId,
      cycleNumber,
    });
  }
  if (state.publishedCount > 0 && !hasMemoryEventType(slug, "page_published", serviceId)) {
    recordGrowthMemoryEvent(slug, "page_published", `${state.publishedCount} pages published for ${serviceId}`, {
      serviceId,
      cycleNumber,
      metadata: { count: state.publishedCount },
    });
  }
  if (state.submittedCount > 0 && !hasMemoryEventType(slug, "url_submitted", serviceId)) {
    recordGrowthMemoryEvent(slug, "url_submitted", `${state.submittedCount} URLs submitted for ${serviceId}`, {
      serviceId,
      cycleNumber,
      metadata: { count: state.submittedCount },
    });
  }
  if (state.indexedCount > 0 && !hasMemoryEventType(slug, "page_indexed", serviceId)) {
    recordGrowthMemoryEvent(slug, "page_indexed", `${state.indexedCount} pages indexed for ${serviceId}`, {
      serviceId,
      cycleNumber,
      metadata: { count: state.indexedCount },
    });
  }
}
