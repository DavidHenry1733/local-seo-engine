/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Production section intent uses Content Engine V1 commercial section planner.
 */
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import {
  fillSectionVariantTemplate,
  getVariantForGroupCategory,
  VARIANT_CATEGORIES,
  type LocalEntityGroup,
  type VariantCategory,
} from "./pharmacyLocalEntitySectionVariants.ts";
import {
  loadProfileEntities,
  type EntityNarrativeInjectionResult,
} from "./pharmacyLocalEntityNarrativeEngine.ts";
import type { EntityGroupKey, ProfileLocalEntity } from "./pharmacyProfileLocalIntelligenceSelection.ts";
import type { GeneratedServiceAreaPage } from "./pharmacyServiceAreaPageGenerator.ts";

const MIN_SECTIONS = 3;
const MAX_SECTIONS = 5;
const MAX_ENTITIES_PER_PAGE = 2;
const INJECTION_TARGETS = ["localContext", "areaNarrativeIntelligence"] as const;

const clusterUsedVariants = new Map<string, Set<string>>();
const clusterUsedOrders = new Map<string, Set<string>>();

export function resetLocalEntitySectionClusterTracker(): void {
  clusterUsedVariants.clear();
  clusterUsedOrders.clear();
}

function hashSeed(...parts: string[]): number {
  return parts.join("|").split("").reduce((n, c) => n + c.charCodeAt(0), 0);
}

function countWords(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function entityGroupFor(entity: ProfileLocalEntity): LocalEntityGroup {
  const group = entity.entityType as EntityGroupKey;
  if (VARIANT_CATEGORIES.length && group) return group as LocalEntityGroup;
  return "communityFacilities";
}

function pickEntitiesForPage(
  entities: ProfileLocalEntity[],
  pageSlug: string,
  serviceId: string,
  areaSlug: string,
): ProfileLocalEntity[] {
  if (!entities.length) return [];
  const seed = hashSeed(pageSlug, serviceId, areaSlug, "entities");
  const pool = [...entities];
  const picked: ProfileLocalEntity[] = [];
  const groups = new Set<LocalEntityGroup>();

  for (let i = 0; i < pool.length && picked.length < MAX_ENTITIES_PER_PAGE; i++) {
    const entity = pool[(seed + i * 13) % pool.length];
    const group = entityGroupFor(entity);
    if (picked.some((p) => p.name === entity.name)) continue;
    if (picked.length >= 1 && groups.has(group)) continue;
    picked.push(entity);
    groups.add(group);
  }

  return picked.slice(0, MAX_ENTITIES_PER_PAGE);
}

function pickSectionCount(seed: number): number {
  const span = MAX_SECTIONS - MIN_SECTIONS + 1;
  return MIN_SECTIONS + (seed % span);
}

function pickCategories(seed: number, count: number): VariantCategory[] {
  const pool = [...VARIANT_CATEGORIES];
  const picked: VariantCategory[] = [];
  for (let i = 0; i < pool.length && picked.length < count; i++) {
    const idx = ((seed + i * 17) % pool.length + pool.length) % pool.length;
    const cat = pool[idx];
    if (!picked.includes(cat)) picked.push(cat);
  }
  return picked;
}

function pickUniqueVariant(
  serviceId: string,
  group: LocalEntityGroup,
  category: VariantCategory,
  seed: number,
): { id: string; text: string; category: VariantCategory } {
  const used = clusterUsedVariants.get(serviceId) || new Set<string>();
  const variant = getVariantForGroupCategory(group, category);
  if (!used.has(variant.id)) {
    used.add(variant.id);
    clusterUsedVariants.set(serviceId, used);
    return { id: variant.id, text: variant.template, category: variant.category };
  }

  for (let attempt = 1; attempt < VARIANT_CATEGORIES.length; attempt++) {
    const altCat = VARIANT_CATEGORIES[(VARIANT_CATEGORIES.indexOf(category) + attempt) % VARIANT_CATEGORIES.length];
    const alt = getVariantForGroupCategory(group, altCat);
    if (!used.has(alt.id)) {
      used.add(alt.id);
      clusterUsedVariants.set(serviceId, used);
      return { id: alt.id, text: alt.template, category: alt.category };
    }
  }

  used.add(variant.id);
  clusterUsedVariants.set(serviceId, used);
  return { id: variant.id, text: variant.template, category: variant.category };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = ((seed + i * 31) % (i + 1) + (i + 1)) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function entityMentioned(body: string, entityName: string): boolean {
  const needle = entityName.trim().toLowerCase();
  if (!needle) return false;
  const short = needle.slice(0, Math.min(needle.length, 14));
  return body.toLowerCase().includes(short);
}

function buildSectionParagraphs(
  picked: ProfileLocalEntity[],
  categories: VariantCategory[],
  input: {
    pageSlug: string;
    serviceId: string;
    areaSlug: string;
    area: string;
    town: string;
    pharmacyName: string;
    serviceName: string;
  },
  existingBody: string,
): {
  paragraphs: string[];
  variantIds: string[];
  categoriesUsed: VariantCategory[];
  entitiesUsed: string[];
} {
  const paragraphs: string[] = [];
  const variantIds: string[] = [];
  const categoriesUsed: VariantCategory[] = [];
  const entitiesUsed: string[] = [];
  const usedCategories = new Set<VariantCategory>();

  const entities = picked.filter((e) => !entityMentioned(existingBody, e.name));
  if (!entities.length) return { paragraphs, variantIds, categoriesUsed, entitiesUsed };

  const orderSeed = hashSeed(input.pageSlug, input.serviceId, input.areaSlug, "order");
  const orderKey = categories.join(",");
  const usedOrders = clusterUsedOrders.get(input.serviceId) || new Set<string>();
  let shuffledCats = shuffleWithSeed(categories, orderSeed);
  if (usedOrders.has(orderKey)) {
    shuffledCats = shuffleWithSeed(categories, orderSeed + 7);
  }
  usedOrders.add(shuffledCats.join(","));
  clusterUsedOrders.set(input.serviceId, usedOrders);

  for (let i = 0; i < shuffledCats.length; i++) {
    const category = shuffledCats[i];
    if (usedCategories.has(category)) continue;

    const entity = entities[i % entities.length];
    const group = entityGroupFor(entity);
    const seed = hashSeed(input.pageSlug, input.serviceId, input.areaSlug, entity.name, category);
    const pickedVariant = pickUniqueVariant(input.serviceId, group, category, seed);

    const rendered = fillSectionVariantTemplate(pickedVariant.text, {
      entityName: entity.name,
      area: input.area,
      areaName: input.area,
      town: input.town,
      pharmacyName: input.pharmacyName,
      service: input.serviceName,
      serviceName: input.serviceName,
    });

    if (!rendered || paragraphs.some((p) => p.slice(0, 60) === rendered.slice(0, 60))) continue;

    paragraphs.push(rendered);
    variantIds.push(pickedVariant.id);
    categoriesUsed.push(pickedVariant.category);
    usedCategories.add(pickedVariant.category);
    if (!entitiesUsed.includes(entity.name)) entitiesUsed.push(entity.name);
  }

  return { paragraphs, variantIds, categoriesUsed, entitiesUsed };
}

function appendSectionsToBody(body: string, paragraphs: string[]): string {
  const base = String(body || "").trim();
  if (!paragraphs.length) return base;
  const addition = paragraphs.join("\n\n");
  if (base.toLowerCase().includes(paragraphs[0].slice(0, 40).toLowerCase())) return base;
  return `${base}\n\n${addition}`.replace(/\n{3,}/g, "\n\n").trim();
}

export interface LocalEntitySectionInjectionResult extends EntityNarrativeInjectionResult {
  localEntityVariantCategories: VariantCategory[];
  localEntityCount: number;
  localEntitySectionCount: number;
}

export function injectLocalEntitySectionVariants(input: {
  slug: string;
  area: string;
  areaSlug: string;
  serviceId: string;
  serviceName: string;
  pharmacyName: string;
  town: string;
  pageSlug: string;
  intro: string;
  sections: Array<{ type: string; heading: string; body: string; bullets?: string[] }>;
  cta: GeneratedServiceAreaPage["cta"];
  profileData?: Record<string, unknown>;
}): LocalEntitySectionInjectionResult {
  assertLegacyContentEngineAllowed("pharmacyLocalEntitySectionEngine", "injectLocalEntitySectionVariants");
  const empty: LocalEntitySectionInjectionResult = {
    intro: input.intro,
    sections: input.sections,
    cta: input.cta,
    entitiesUsed: [],
    blockIds: [],
    sectionVariantIds: [],
    entityCount: 0,
    blockCount: 0,
    sectionVariantCount: 0,
    wordCount: 0,
    localEntityVariantCategories: [],
    localEntityCount: 0,
    localEntitySectionCount: 0,
  };

  const entities = loadProfileEntities(input.profileData || {}, input.slug);
  const picked = pickEntitiesForPage(entities, input.pageSlug, input.serviceId, input.areaSlug);
  if (!picked.length) return empty;

  let sections = input.sections.filter((s) => s.type !== "localEntityNarrative");
  let targetIdx = -1;
  for (const targetType of INJECTION_TARGETS) {
    targetIdx = sections.findIndex((s) => s.type === targetType);
    if (targetIdx >= 0) break;
  }
  if (targetIdx < 0) return empty;

  const seed = hashSeed(input.pageSlug, input.serviceId, input.areaSlug, "sections");
  const sectionCount = pickSectionCount(seed);
  const categories = pickCategories(seed + 3, sectionCount);

  const built = buildSectionParagraphs(picked, categories, input, sections[targetIdx].body || "");
  if (!built.paragraphs.length) return empty;

  sections = sections.map((s, idx) =>
    idx === targetIdx ? { ...s, body: appendSectionsToBody(s.body, built.paragraphs) } : s,
  );

  const wordCount = built.paragraphs.reduce((n, p) => n + countWords(p), 0);

  return {
    intro: input.intro,
    sections,
    cta: input.cta,
    entitiesUsed: built.entitiesUsed,
    blockIds: built.variantIds,
    sectionVariantIds: built.variantIds,
    entityCount: built.entitiesUsed.length,
    blockCount: built.paragraphs.length,
    sectionVariantCount: built.paragraphs.length,
    wordCount,
    localEntityVariantCategories: built.categoriesUsed,
    localEntityCount: built.entitiesUsed.length,
    localEntitySectionCount: built.paragraphs.length,
  };
}

export interface LocalEntitySectionUsageMetrics {
  pagesWithSections: number;
  avgSectionVariantsPerPage: number;
  avgEntitiesPerPage: number;
  avgWordCount: number;
  uniqueVariantRatio: number;
  coveragePct: number;
  clusterReuseCount: number;
}

export function scoreLocalEntitySectionUsage(pages: GeneratedServiceAreaPage[]): LocalEntitySectionUsageMetrics {
  const qs = (p: GeneratedServiceAreaPage) => p.qualitySignals as Record<string, unknown>;
  const withSections = pages.filter((p) => Number(qs(p).localEntitySectionCount || 0) > 0);
  const sectionCounts = pages.map((p) => Number(qs(p).localEntitySectionCount || 0));
  const entityCounts = pages.map((p) => Number(qs(p).localEntityCount || 0));
  const wordCounts = pages.map((p) => Number(qs(p).entityNarrativeWordCount || 0));
  const allIds = pages.flatMap((p) => (qs(p).entityNarrativeSectionVariantIds as string[]) || []);

  const byService = new Map<string, Map<string, number>>();
  for (const page of pages) {
    const ids = (qs(page).entityNarrativeSectionVariantIds as string[]) || [];
    const map = byService.get(page.serviceId) || new Map<string, number>();
    for (const id of ids) map.set(id, (map.get(id) || 0) + 1);
    byService.set(page.serviceId, map);
  }
  const clusterReuseCount = Math.max(
    0,
    ...[...byService.values()].map((m) => [...m.values()].filter((c) => c > 1).length),
  );

  const meetsCoverage = pages.filter(
    (p) =>
      Number(qs(p).localEntitySectionCount || 0) >= MIN_SECTIONS &&
      Number(qs(p).localEntityCount || 0) >= 1 &&
      Number(qs(p).localEntityCount || 0) <= MAX_ENTITIES_PER_PAGE,
  );

  return {
    pagesWithSections: withSections.length,
    avgSectionVariantsPerPage:
      sectionCounts.length > 0
        ? Math.round((sectionCounts.reduce((a, b) => a + b, 0) / sectionCounts.length) * 10) / 10
        : 0,
    avgEntitiesPerPage:
      entityCounts.length > 0
        ? Math.round((entityCounts.reduce((a, b) => a + b, 0) / entityCounts.length) * 10) / 10
        : 0,
    avgWordCount:
      wordCounts.length > 0
        ? Math.round((wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) * 10) / 10
        : 0,
    uniqueVariantRatio: allIds.length
      ? Math.round((new Set(allIds).size / allIds.length) * 1000) / 10
      : 0,
    coveragePct: pages.length ? Math.round((meetsCoverage.length / pages.length) * 1000) / 10 : 0,
    clusterReuseCount,
  };
}
