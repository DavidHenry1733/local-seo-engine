/**
 * Generation-session state for cross-locality uniqueness (Content Engine V1).
 */
import type { LocalityPageStrategyId } from "./pharmacyLocalityPageStrategyV1.ts";

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
