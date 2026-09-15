/**
 * Pharmacy Local Entity Narrative Engine V1 —
 * lightweight additive micro-layer inside area narrative / localContext flow.
 * Does not replace Area Narrative Intelligence content.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fillEntityNarrativeTemplate,
  getEntityNarrativeLibrary,
  pickEntityNarrativeBlock,
  PROFILE_GROUP_TO_ENTITY_TYPE,
  type EntityNarrativeBlock,
  type EntityType,
  type NarrativeCategory,
} from "./pharmacyLocalEntityNarrativeLibrary.ts";
import {
  ENTITY_GROUP_KEYS,
  normalizeEntityList,
  type EntityGroupKey,
  type ProfileLocalEntity,
} from "./pharmacyProfileLocalIntelligenceSelection.ts";
import type { GeneratedServiceAreaPage } from "./pharmacyServiceAreaPageGenerator.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIN_ENTITY_WORDS = 80;
const MAX_ENTITY_WORDS = 120;
const MAX_ENTITIES_PER_PAGE = 2;
const INJECTION_TARGETS = ["localContext", "areaNarrativeIntelligence"] as const;

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();

export interface EntityNarrativeInjectionResult {
  intro: string;
  sections: Array<{ type: string; heading: string; body: string; bullets?: string[] }>;
  cta: GeneratedServiceAreaPage["cta"];
  entitiesUsed: string[];
  blockIds: string[];
  sectionVariantIds: string[];
  entityCount: number;
  blockCount: number;
  sectionVariantCount: number;
  wordCount: number;
}

const clusterUsedBlocks = new Map<string, Set<string>>();

export function resetEntityNarrativeClusterTracker(): void {
  clusterUsedBlocks.clear();
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

const LEGACY_FIELD_MAP: Array<[EntityGroupKey, string[]]> = [
  ["gpSurgeries", ["localGpSurgeries", "localGps"]],
  ["hospitals", ["nearbyHospitals", "localHospitals"]],
  ["healthCentres", ["nearbyHealthCentres"]],
  ["careHomes", ["careHomesServed", "localCareHomes"]],
  ["schools", ["nearbySchools", "localSchools"]],
  ["landmarks", ["localLandmarks"]],
  ["communityFacilities", ["communityLinks", "localCommunityLocations"]],
  ["transportLinks", ["localTransportLinks"]],
  ["retailCentres", ["localRetailCentres"]],
  ["residentialAreas", ["localResidentialAreas"]],
];

function stringsToEntities(names: string[], group: EntityGroupKey): ProfileLocalEntity[] {
  return names
    .filter(Boolean)
    .map((name) => ({
      id: `${group}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      address: "",
      category: group,
      entityType: group,
      distanceKm: null,
      distanceLabel: "",
      source: "local intelligence" as const,
      types: [],
    }));
}

function legacyEntitiesFromProfile(data: Record<string, unknown>): ProfileLocalEntity[] {
  const out: ProfileLocalEntity[] = [];
  for (const [group, fields] of LEGACY_FIELD_MAP) {
    const names: string[] = [];
    for (const field of fields) {
      const val = data[field];
      if (Array.isArray(val)) names.push(...val.map(String).filter(Boolean));
    }
    out.push(...stringsToEntities(names, group));
  }
  return out;
}

function entitiesFromLocalIntelFile(slug: string): ProfileLocalEntity[] {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-local-intelligence", `${slug}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const li = JSON.parse(fs.readFileSync(file, "utf8"));
    const out: ProfileLocalEntity[] = [];
    for (const group of ENTITY_GROUP_KEYS) {
      if (Array.isArray(li[group])) {
        out.push(...normalizeEntityList(li[group], group));
      }
    }
    if (!out.some((e) => e.entityType === "gpSurgeries")) {
      out.push(...stringsToEntities(li.localGps || [], "gpSurgeries"));
    }
    if (!out.some((e) => e.entityType === "hospitals")) {
      out.push(...stringsToEntities(li.localHospitals || [], "hospitals"));
    }
    out.push(...stringsToEntities(li.localHealthcareLocations || [], "healthCentres"));
    out.push(...stringsToEntities(li.localCareHomes || [], "careHomes"));
    out.push(...stringsToEntities(li.localSchools || [], "schools"));
    out.push(...stringsToEntities(li.localLandmarks || [], "landmarks"));
    out.push(...stringsToEntities(li.localCommunityLocations || [], "communityFacilities"));
    out.push(...stringsToEntities(li.localTransportLinks || [], "transportLinks"));
    out.push(...stringsToEntities(li.localRetailCentres || [], "retailCentres"));
    out.push(...stringsToEntities(li.localAreas || li.localResidentialAreas || [], "residentialAreas"));
    return out;
  } catch {
    return [];
  }
}

export function loadProfileEntities(
  profileData: Record<string, unknown>,
  slug?: string,
): ProfileLocalEntity[] {
  const structured: ProfileLocalEntity[] = [];
  for (const group of ENTITY_GROUP_KEYS) {
    structured.push(...normalizeEntityList(profileData[group], group));
  }

  const seen = new Set(structured.map((e) => e.name.toLowerCase()));
  for (const e of legacyEntitiesFromProfile(profileData)) {
    if (!seen.has(e.name.toLowerCase())) {
      structured.push(e);
      seen.add(e.name.toLowerCase());
    }
  }

  if (structured.length < 2 && slug) {
    for (const e of entitiesFromLocalIntelFile(slug)) {
      if (!seen.has(e.name.toLowerCase())) {
        structured.push(e);
        seen.add(e.name.toLowerCase());
      }
    }
  }

  return structured.filter((e) => e.name && !/pharmacy|chemist|boots|rowlands/i.test(e.name));
}

function entityTypeFor(entity: ProfileLocalEntity): EntityType {
  const fromGroup = PROFILE_GROUP_TO_ENTITY_TYPE[entity.entityType];
  if (fromGroup) return fromGroup;
  const cat = entity.category.toLowerCase();
  if (/gp|surgery|doctor/.test(cat)) return "gpSurgery";
  if (/hospital/.test(cat)) return "hospital";
  if (/health centre|health center/.test(cat)) return "healthCentre";
  if (/care home/.test(cat)) return "careHome";
  if (/school|college/.test(cat)) return "school";
  if (/landmark|park|museum/.test(cat)) return "landmark";
  if (/transport|station|bus|train/.test(cat)) return "transportLink";
  if (/retail|shopping|supermarket/.test(cat)) return "retailCentre";
  if (/residential|estate|neighbourhood|neighborhood/.test(cat)) return "residentialArea";
  return "communityFacility";
}

function pickEntitiesForPage(
  entities: ProfileLocalEntity[],
  pageSlug: string,
  serviceId: string,
  areaSlug: string,
): ProfileLocalEntity[] {
  if (!entities.length) return [];
  const seed = hashSeed(pageSlug, serviceId, areaSlug);
  const pool = [...entities];
  const picked: ProfileLocalEntity[] = [];
  const types = new Set<EntityType>();

  for (let i = 0; i < pool.length && picked.length < MAX_ENTITIES_PER_PAGE; i++) {
    const entity = pool[(seed + i * 7) % pool.length];
    const type = entityTypeFor(entity);
    if (picked.some((p) => p.name === entity.name)) continue;
    if (picked.length >= 1 && types.has(type)) continue;
    picked.push(entity);
    types.add(type);
  }

  return picked.slice(0, MAX_ENTITIES_PER_PAGE);
}

function pickUniqueBlock(
  serviceId: string,
  entityType: EntityType,
  category: NarrativeCategory,
  seed: number,
): EntityNarrativeBlock {
  const used = clusterUsedBlocks.get(serviceId) || new Set<string>();
  const pool = getEntityNarrativeLibrary().byType[entityType].filter((b) => b.category === category);

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const idx = ((seed + attempt * 11) % pool.length + pool.length) % pool.length;
    const block = pool[idx];
    if (!used.has(block.id)) {
      used.add(block.id);
      clusterUsedBlocks.set(serviceId, used);
      return block;
    }
  }

  const fallback = pickEntityNarrativeBlock(entityType, category, seed + pool.length);
  used.add(fallback.id);
  clusterUsedBlocks.set(serviceId, used);
  return fallback;
}

function firstSentence(text: string): string {
  const t = String(text || "").trim();
  const match = t.match(/^(.+?[.!?])(?:\s|$)/);
  return (match ? match[1] : t.split(/\s+/).slice(0, 16).join(" ")).trim();
}

function renderMicroBridge(
  block: EntityNarrativeBlock,
  entity: ProfileLocalEntity,
  ctx: { areaName: string; town: string; pharmacyName: string; serviceName: string },
): string {
  const full = fillEntityNarrativeTemplate(block.template, {
    entityName: entity.name,
    areaName: ctx.areaName,
    town: ctx.town,
    pharmacyName: ctx.pharmacyName,
    serviceName: ctx.serviceName,
  });
  return firstSentence(full);
}

function entityMentioned(body: string, entityName: string): boolean {
  const needle = entityName.trim().toLowerCase();
  if (!needle) return false;
  const short = needle.slice(0, Math.min(needle.length, 14));
  return body.toLowerCase().includes(short);
}

function trimToWordCap(text: string, maxWords: number): string {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(" ").trim();
  return `${words.slice(0, maxWords).join(" ").replace(/[,;:]?$/, "")}.`.trim();
}

function buildMicroLayer(
  picked: ProfileLocalEntity[],
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
): { text: string; blockIds: string[]; entitiesUsed: string[] } {
  const ctx = {
    areaName: input.area,
    town: input.town,
    pharmacyName: input.pharmacyName,
    serviceName: input.serviceName,
  };
  const categories: NarrativeCategory[] = ["healthcareAccess", "localCommunity"];
  const bridges: string[] = [];
  const blockIds: string[] = [];
  const entitiesUsed: string[] = [];

  for (let i = 0; i < picked.length; i++) {
    const entity = picked[i];
    if (entityMentioned(existingBody, entity.name)) continue;

    const category = categories[i % categories.length];
    const block = pickUniqueBlock(
      input.serviceId,
      entityTypeFor(entity),
      category,
      hashSeed(input.pageSlug, input.serviceId, input.areaSlug, entity.name, category),
    );
    const bridge = renderMicroBridge(block, entity, ctx);
    if (!bridge) continue;

    bridges.push(bridge);
    blockIds.push(block.id);
    entitiesUsed.push(entity.name);
  }

  if (!bridges.length) {
    return { text: "", blockIds: [], entitiesUsed: [] };
  }

  const seed = hashSeed(input.pageSlug, input.serviceId, input.areaSlug, "format");
  let text =
    seed % 2 === 0 || bridges.length === 1
      ? bridges.join(" ")
      : bridges.join(" ");

  text = trimToWordCap(text, MAX_ENTITY_WORDS);
  if (countWords(text) < MIN_ENTITY_WORDS && bridges.length > 1) {
    text = trimToWordCap(bridges.join(" "), MAX_ENTITY_WORDS);
  }

  return { text, blockIds, entitiesUsed };
}

function appendMicroLayer(body: string, microLayer: string): string {
  const base = String(body || "").trim();
  const addition = String(microLayer || "").trim();
  if (!addition) return base;
  if (base.toLowerCase().includes(addition.slice(0, 32).toLowerCase())) return base;
  return `${base} ${addition}`.replace(/\s+/g, " ").trim();
}

export function injectLocalEntityNarratives(input: {
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
}): EntityNarrativeInjectionResult {
  const empty: EntityNarrativeInjectionResult = {
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

  const micro = buildMicroLayer(picked, input, sections[targetIdx].body || "");
  if (!micro.text) return empty;

  sections = sections.map((s, idx) =>
    idx === targetIdx ? { ...s, body: appendMicroLayer(s.body, micro.text) } : s,
  );

  return {
    intro: input.intro,
    sections,
    cta: input.cta,
    entitiesUsed: micro.entitiesUsed,
    blockIds: micro.blockIds,
    sectionVariantIds: [],
    entityCount: micro.entitiesUsed.length,
    blockCount: micro.blockIds.length,
    sectionVariantCount: 0,
    wordCount: countWords(micro.text),
  };
}

export interface EntityNarrativeUsageMetrics {
  pagesWithEntityNarratives: number;
  avgEntitiesPerPage: number;
  avgBlocksPerPage: number;
  avgSectionVariantsPerPage: number;
  avgWordCount: number;
  uniqueBlockRatio: number;
  coveragePct: number;
  repeatedEntitySectionHeadings: number;
}

export function scoreEntityNarrativeUsage(pages: GeneratedServiceAreaPage[]): EntityNarrativeUsageMetrics {
  const qs = (p: GeneratedServiceAreaPage) => p.qualitySignals as Record<string, unknown>;
  const withEntity = pages.filter((p) => qs(p).usesEntityNarrative);
  const entityCounts = pages.map((p) => Number(qs(p).entityNarrativeEntityCount || 0));
  const blockCounts = pages.map((p) => Number(qs(p).entityNarrativeBlockCount || 0));
  const wordCounts = pages.map((p) => Number(qs(p).entityNarrativeWordCount || 0));
  const allBlocks = pages.flatMap((p) => (qs(p).entityNarrativeBlockIds as string[]) || []);
  const meetsCoverage = pages.filter(
    (p) =>
      Boolean(qs(p).usesEntityNarrative) &&
      Number(qs(p).entityNarrativeEntityCount || 0) >= 1 &&
      Number(qs(p).entityNarrativeWordCount || 0) >= 20 &&
      Number(qs(p).entityNarrativeWordCount || 0) <= MAX_ENTITY_WORDS + 10,
  );
  const repeatedEntitySectionHeadings = pages.filter((p) =>
    (p.sections || []).some((s) => s.type === "localEntityNarrative"),
  ).length;

  return {
    pagesWithEntityNarratives: withEntity.length,
    avgEntitiesPerPage:
      entityCounts.length > 0
        ? Math.round((entityCounts.reduce((a, b) => a + b, 0) / entityCounts.length) * 10) / 10
        : 0,
    avgBlocksPerPage:
      blockCounts.length > 0
        ? Math.round((blockCounts.reduce((a, b) => a + b, 0) / blockCounts.length) * 10) / 10
        : 0,
    avgSectionVariantsPerPage: 0,
    avgWordCount:
      wordCounts.length > 0
        ? Math.round((wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) * 10) / 10
        : 0,
    uniqueBlockRatio: allBlocks.length
      ? Math.round((new Set(allBlocks).size / allBlocks.length) * 1000) / 10
      : 0,
    coveragePct: pages.length ? Math.round((meetsCoverage.length / pages.length) * 1000) / 10 : 0,
    repeatedEntitySectionHeadings,
  };
}

export function computeNarrativeUtilisation(pages: GeneratedServiceAreaPage[]): {
  blockUsage: Array<{ id: string; count: number }>;
  entityUsage: Array<{ name: string; count: number }>;
  sectionVariantUsage: Array<{ id: string; count: number }>;
  narrativeOverlapPct: number;
} {
  const blockCounts = new Map<string, number>();
  const entityCounts = new Map<string, number>();
  let totalBlocks = 0;

  for (const page of pages) {
    const signals = page.qualitySignals as Record<string, unknown>;
    for (const id of (signals.entityNarrativeBlockIds as string[]) || []) {
      blockCounts.set(id, (blockCounts.get(id) || 0) + 1);
      totalBlocks++;
    }
    for (const name of (signals.entityNarrativeEntities as string[]) || []) {
      entityCounts.set(name, (entityCounts.get(name) || 0) + 1);
    }
  }

  const duplicateBlocks = [...blockCounts.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0);
  const narrativeOverlapPct = totalBlocks
    ? Math.round((duplicateBlocks / totalBlocks) * 1000) / 10
    : 0;

  const top = (map: Map<string, number>, n: number) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id, count]) => ({ id, count }));

  return {
    blockUsage: top(blockCounts, 10),
    entityUsage: top(entityCounts, 10).map(({ id, count }) => ({ name: id, count })),
    sectionVariantUsage: [],
    narrativeOverlapPct,
  };
}
