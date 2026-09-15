/**
 * PharmaConnect Growth Engine — Service Expansion Library (Content Expansion Layer V1).
 * Structured depth modules: additional sections, deep dives, timelines and expanded FAQs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadServiceLibraryCatalog,
  normalizeServiceId,
  type CatalogService,
} from "./pharmacyServiceLibraryService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-expansion-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const CONFIG_PATH = path.join(WORKSPACE_ROOT, "config/pharmacy/service-expansion-library.json");
export const STORAGE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-expansion");
export const INDEX_PATH = path.join(STORAGE_DIR, "_index.json");

export interface ExpansionSectionSpec {
  type: string;
  heading: string;
}

export interface DeepDiveBlock {
  heading: string;
  paragraphs: string[];
  bulletTopics: string[];
}

export interface ContentTargets {
  minWordCount: number;
  minFaqCount: number;
  minExpansionSections: number;
}

export interface ServiceExpansionProfile {
  serviceId: string;
  serviceName: string;
  category: string;
  generatedAt: string;
  expansionSections: ExpansionSectionSpec[];
  deepDiveBlocks: DeepDiveBlock[];
  preparationGuide: string[];
  timelineNotes: string[];
  comparisonPoints: string[];
  expandedFaqQuestions: string[];
  relatedTopicLinks: string[];
  contentTargets: ContentTargets;
}

export interface ServiceExpansionIndexEntry {
  serviceId: string;
  serviceName: string;
  category: string;
  expansionSectionCount: number;
  deepDiveBlockCount: number;
  expandedFaqCount: number;
  minWordCountTarget: number;
  generatedAt: string;
}

export interface ServiceExpansionIndex {
  generatedAt: string;
  totalServices: number;
  services: ServiceExpansionIndexEntry[];
}

type ExpansionFields = Omit<ServiceExpansionProfile, "serviceId" | "serviceName" | "category" | "generatedAt">;

interface ExpansionConfig {
  version: string;
  categoryDefaults: Record<string, Partial<ExpansionFields>>;
  services: Record<string, Partial<ExpansionFields>>;
}

const DEFAULT_TARGETS: ContentTargets = {
  minWordCount: 1000,
  minFaqCount: 10,
  minExpansionSections: 2,
};

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = String(item || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function mergeDeepDiveBlocks(...sources: Array<DeepDiveBlock[] | undefined>): DeepDiveBlock[] {
  const seen = new Set<string>();
  const out: DeepDiveBlock[] = [];
  for (const src of sources) {
    for (const block of src || []) {
      const k = block.heading.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        heading: block.heading,
        paragraphs: [...(block.paragraphs || [])],
        bulletTopics: uniqueStrings(block.bulletTopics || []),
      });
    }
  }
  return out;
}

function mergeExpansionSections(...sources: Array<ExpansionSectionSpec[] | undefined>): ExpansionSectionSpec[] {
  const seen = new Set<string>();
  const out: ExpansionSectionSpec[] = [];
  for (const src of sources) {
    for (const section of src || []) {
      const k = `${section.type}:${section.heading}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ type: section.type, heading: section.heading });
    }
  }
  return out;
}

function mergeContentTargets(...sources: Array<Partial<ContentTargets> | undefined>): ContentTargets {
  const out = { ...DEFAULT_TARGETS };
  for (const src of sources) {
    if (!src) continue;
    if (src.minWordCount != null) out.minWordCount = src.minWordCount;
    if (src.minFaqCount != null) out.minFaqCount = src.minFaqCount;
    if (src.minExpansionSections != null) out.minExpansionSections = src.minExpansionSections;
  }
  return out;
}

function mergeExpansionFields(
  service: CatalogService,
  categoryId: string,
  config: ExpansionConfig,
): ExpansionFields {
  const id = normalizeServiceId(service.id);
  const cat = config.categoryDefaults[categoryId] || {};
  const svc = config.services[id];

  if (svc) {
    return {
      expansionSections: mergeExpansionSections(svc.expansionSections?.length ? svc.expansionSections : cat.expansionSections),
      deepDiveBlocks: mergeDeepDiveBlocks(svc.deepDiveBlocks?.length ? svc.deepDiveBlocks : cat.deepDiveBlocks),
      preparationGuide: uniqueStrings(svc.preparationGuide?.length ? svc.preparationGuide : cat.preparationGuide || []),
      timelineNotes: uniqueStrings(svc.timelineNotes?.length ? svc.timelineNotes : cat.timelineNotes || []),
      comparisonPoints: uniqueStrings(svc.comparisonPoints?.length ? svc.comparisonPoints : cat.comparisonPoints || []),
      expandedFaqQuestions: uniqueStrings([...(svc.expandedFaqQuestions || []), ...(cat.expandedFaqQuestions || [])]),
      relatedTopicLinks: uniqueStrings(svc.relatedTopicLinks?.length ? svc.relatedTopicLinks : cat.relatedTopicLinks || []),
      contentTargets: mergeContentTargets(svc.contentTargets, cat.contentTargets),
    };
  }

  return {
    expansionSections: mergeExpansionSections(cat.expansionSections),
    deepDiveBlocks: mergeDeepDiveBlocks(cat.deepDiveBlocks),
    preparationGuide: uniqueStrings(cat.preparationGuide || []),
    timelineNotes: uniqueStrings(cat.timelineNotes || []),
    comparisonPoints: uniqueStrings(cat.comparisonPoints || []),
    expandedFaqQuestions: uniqueStrings(cat.expandedFaqQuestions || []),
    relatedTopicLinks: uniqueStrings(cat.relatedTopicLinks || []),
    contentTargets: mergeContentTargets(cat.contentTargets),
  };
}

export function expansionPath(serviceId: string): string {
  return path.join(STORAGE_DIR, `${normalizeServiceId(serviceId)}.json`);
}

export function loadServiceExpansionConfig(): ExpansionConfig {
  const config = readJson<ExpansionConfig>(CONFIG_PATH);
  if (!config?.categoryDefaults) {
    throw new Error("Service expansion config not found at config/pharmacy/service-expansion-library.json");
  }
  return config;
}

export function loadServiceExpansionProfile(serviceId: string): ServiceExpansionProfile | null {
  return readJson<ServiceExpansionProfile>(expansionPath(serviceId));
}

export function loadServiceExpansionIndex(): ServiceExpansionIndex | null {
  return readJson<ServiceExpansionIndex>(INDEX_PATH);
}

function profileToIndexEntry(profile: ServiceExpansionProfile): ServiceExpansionIndexEntry {
  return {
    serviceId: profile.serviceId,
    serviceName: profile.serviceName,
    category: profile.category,
    expansionSectionCount: profile.expansionSections.length,
    deepDiveBlockCount: profile.deepDiveBlocks.length,
    expandedFaqCount: profile.expandedFaqQuestions.length,
    minWordCountTarget: profile.contentTargets.minWordCount,
    generatedAt: profile.generatedAt,
  };
}

export function getServiceExpansionStatus(): {
  hasIndex: boolean;
  totalServices: number;
  catalogCount: number;
  lastGeneratedAt: string | null;
} {
  const catalog = loadServiceLibraryCatalog();
  const catalogCount = catalog.categories.reduce(
    (n, c) => n + c.services.filter((s) => s.enabled).length,
    0,
  );
  const index = loadServiceExpansionIndex();
  return {
    hasIndex: !!index,
    totalServices: index?.totalServices || 0,
    catalogCount,
    lastGeneratedAt: index?.generatedAt ?? null,
  };
}

export function listServiceExpansionProfiles(): ServiceExpansionIndexEntry[] {
  const index = loadServiceExpansionIndex();
  if (index?.services?.length) return index.services;
  if (!fs.existsSync(STORAGE_DIR)) return [];
  return fs
    .readdirSync(STORAGE_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => readJson<ServiceExpansionProfile>(path.join(STORAGE_DIR, f)))
    .filter(Boolean)
    .map((p) => profileToIndexEntry(p!));
}

function buildProfileForService(
  service: CatalogService,
  categoryId: string,
  config: ExpansionConfig,
): ServiceExpansionProfile {
  const id = normalizeServiceId(service.id);
  const fields = mergeExpansionFields(service, categoryId, config);

  return {
    serviceId: id,
    serviceName: service.serviceName,
    category: categoryId,
    generatedAt: new Date().toISOString(),
    ...fields,
  };
}

export function buildAllServiceExpansion(): {
  index: ServiceExpansionIndex;
  profiles: ServiceExpansionProfile[];
} {
  const config = loadServiceExpansionConfig();
  const catalog = loadServiceLibraryCatalog();
  const profiles: ServiceExpansionProfile[] = [];

  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (!service.enabled) continue;
      const profile = buildProfileForService(service, category.id, config);
      writeJson(expansionPath(profile.serviceId), profile);
      profiles.push(profile);
    }
  }

  profiles.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

  const index: ServiceExpansionIndex = {
    generatedAt: new Date().toISOString(),
    totalServices: profiles.length,
    services: profiles.map(profileToIndexEntry),
  };

  writeJson(INDEX_PATH, index);
  return { index, profiles };
}

export function buildServiceExpansionForId(serviceId: string): ServiceExpansionProfile {
  const config = loadServiceExpansionConfig();
  const catalog = loadServiceLibraryCatalog();

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (normalizeServiceId(service.id) !== normalizeServiceId(serviceId)) continue;
      const profile = buildProfileForService(service, category.id, config);
      writeJson(expansionPath(profile.serviceId), profile);
      return profile;
    }
  }

  throw new Error(`Service "${serviceId}" not found in service library catalog.`);
}

export function countExpansionWords(sections: Array<{ heading: string; body: string; bullets: string[] }>): number {
  const text = sections.flatMap((s) => [s.heading, s.body, ...s.bullets]).join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}
