/**
 * Generation-session state for cross-locality uniqueness (Content Engine V1).
 */
import { resolveLocalityIntelligencePack, type LocalityIntelPack } from "./pharmacyLocalityIntelligencePackV1.ts";
import {
  nextStrategyCandidate,
  resolveLocalityPageStrategyV1,
  type LocalityPageStrategyId,
} from "./pharmacyLocalityPageStrategyV1.ts";

export type AiLocalCopyOverlayV1 = {
  heroIntroduction: string;
  localContextHeading: string;
  localIntroduction: string;
  localContextParagraphs: string[];
  relationshipToPharmacy: string;
  localAccessIntroduction: string;
  localFaqs: Array<{ question: string; answer: string }>;
  localCtaBridge: string;
};

export type LocalityVariationSessionV1 = {
  usedStrategies: Set<LocalityPageStrategyId>;
  forceStrategyBySlug: Map<string, LocalityPageStrategyId>;
  restoreStrategyVariants: boolean;
  areaIndexBySlug: Map<string, number>;
  strategyBySlug: Map<string, LocalityPageStrategyId>;
  aiCopyBySlug: Map<string, AiLocalCopyOverlayV1>;
};

let active: LocalityVariationSessionV1 | null = null;

export function beginLocalityVariationSessionV1(areaSlugs: string[] = []): LocalityVariationSessionV1 {
  active = {
    usedStrategies: new Set(),
    forceStrategyBySlug: new Map(),
    restoreStrategyVariants: false,
    areaIndexBySlug: new Map(areaSlugs.map((slug, i) => [slug, i])),
    strategyBySlug: new Map(),
    aiCopyBySlug: new Map(),
  };
  return active;
}

export function setSessionAiLocalCopy(areaSlug: string, copy: AiLocalCopyOverlayV1): void {
  if (!active) return;
  active.aiCopyBySlug.set(areaSlug, copy);
}

export function getSessionAiLocalCopy(areaSlug: string): AiLocalCopyOverlayV1 | null {
  return active?.aiCopyBySlug.get(areaSlug) || null;
}

export function setSessionForceStrategy(areaSlug: string, strategy: LocalityPageStrategyId): void {
  if (!active) return;
  active.forceStrategyBySlug.set(areaSlug, strategy);
}

export function setSessionRestoreStrategyVariants(enabled: boolean): void {
  if (!active) return;
  active.restoreStrategyVariants = enabled;
}

export function sessionRestoresStrategyVariants(): boolean {
  return Boolean(active?.restoreStrategyVariants);
}

export function getLocalityVariationSessionV1(): LocalityVariationSessionV1 | null {
  return active;
}

export function endLocalityVariationSessionV1(): void {
  active = null;
}

export function rememberStrategyForSlug(slug: string, strategy: LocalityPageStrategyId): void {
  if (!active) return;
  active.strategyBySlug.set(slug, strategy);
  active.usedStrategies.add(strategy);
}

/**
 * Reload-safe assignment of existing locality strategies across a campaign session.
 * Uses resolveLocalityPageStrategyV1 with accumulating usedStrategies. Does not invent a new matrix.
 */
export function assignLocalityVariationStrategiesV1(opts: {
  areas: Array<{ areaName: string; areaSlug: string }>;
  pharmacyName: string;
  serviceName: string;
  nearbyAreaNames?: string[];
  pharmacyAddress?: string;
  packForArea?: (area: { areaName: string; areaSlug: string }, index: number) => LocalityIntelPack;
}): Map<string, LocalityPageStrategyId> {
  const assigned = new Map<string, LocalityPageStrategyId>();
  if (!active) return assigned;
  opts.areas.forEach((area, index) => {
    const existing = active?.forceStrategyBySlug.get(area.areaSlug);
    if (existing) {
      rememberStrategyForSlug(area.areaSlug, existing);
      assigned.set(area.areaSlug, existing);
      return;
    }
    const uniqueNonJourney = [...(active?.usedStrategies || [])].filter((strategy) => strategy !== "patient-journey-led");
    if (uniqueNonJourney.length >= 5) {
      const previous = assigned.size ? [...assigned.values()].at(-1)! : uniqueNonJourney[uniqueNonJourney.length - 1]!;
      const rotated = nextStrategyCandidate(previous, new Set());
      setSessionForceStrategy(area.areaSlug, rotated);
      rememberStrategyForSlug(area.areaSlug, rotated);
      assigned.set(area.areaSlug, rotated);
      return;
    }
    const nearby = (opts.nearbyAreaNames || []).filter(
      (name) => name.trim().toLowerCase() !== area.areaName.trim().toLowerCase(),
    );
    const pack = opts.packForArea
      ? opts.packForArea(area, index)
      : resolveLocalityIntelligencePack({
          areaName: area.areaName,
          nearbyAreaNames: nearby,
          pharmacyAddress: opts.pharmacyAddress,
        });
    const plan = resolveLocalityPageStrategyV1({
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      pharmacyName: opts.pharmacyName,
      serviceName: opts.serviceName,
      pack,
      areaIndex: active?.areaIndexBySlug.get(area.areaSlug) ?? index,
      usedStrategies: active?.usedStrategies,
    });
    setSessionForceStrategy(area.areaSlug, plan.strategyId);
    rememberStrategyForSlug(area.areaSlug, plan.strategyId);
    assigned.set(area.areaSlug, plan.strategyId);
  });
  return assigned;
}
