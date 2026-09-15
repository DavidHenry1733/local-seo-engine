/**
 * PharmaConnect Growth Engine — Service Authority Library (AI Authority Layer V1).
 * Expert-style educational content, patient guidance and professional authority signals.
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
    if (fs.existsSync(path.join(root, "config/pharmacy/service-authority-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const CONFIG_PATH = path.join(WORKSPACE_ROOT, "config/pharmacy/service-authority-library.json");
export const STORAGE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-authority");
export const INDEX_PATH = path.join(STORAGE_DIR, "_index.json");

export interface MythVsFactEntry {
  myth: string;
  fact: string;
}

export interface ServiceAuthorityProfile {
  serviceId: string;
  serviceName: string;
  category: string;
  generatedAt: string;
  professionalInsights: string[];
  commonPatientMistakes: string[];
  patientEducationTopics: string[];
  whenToSeekAdvice: string[];
  authorityStatements: string[];
  mythVsFact: MythVsFactEntry[];
  patientQuestionsWeOftenHear: string[];
  bestPracticeGuidance: string[];
  safetyConsiderations: string[];
}

export interface ServiceAuthorityIndexEntry {
  serviceId: string;
  serviceName: string;
  category: string;
  insightCount: number;
  mythVsFactCount: number;
  educationTopicCount: number;
  generatedAt: string;
}

export interface ServiceAuthorityIndex {
  generatedAt: string;
  totalServices: number;
  services: ServiceAuthorityIndexEntry[];
}

type AuthorityFields = Omit<ServiceAuthorityProfile, "serviceId" | "serviceName" | "category" | "generatedAt">;

interface AuthorityConfig {
  version: string;
  categoryDefaults: Record<string, Partial<AuthorityFields>>;
  services: Record<string, Partial<AuthorityFields>>;
}

const FIELD_KEYS: (keyof AuthorityFields)[] = [
  "professionalInsights",
  "commonPatientMistakes",
  "patientEducationTopics",
  "whenToSeekAdvice",
  "authorityStatements",
  "patientQuestionsWeOftenHear",
  "bestPracticeGuidance",
  "safetyConsiderations",
];

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

function mergeMythVsFact(...sources: Array<MythVsFactEntry[] | undefined>): MythVsFactEntry[] {
  const seen = new Set<string>();
  const out: MythVsFactEntry[] = [];
  for (const src of sources) {
    for (const entry of src || []) {
      if (!entry?.myth || !entry?.fact) continue;
      const k = entry.myth.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ myth: entry.myth.trim(), fact: entry.fact.trim() });
    }
  }
  return out;
}

function mergeStringFields(...sources: Array<Partial<AuthorityFields> | undefined>): Pick<
  AuthorityFields,
  | "professionalInsights"
  | "commonPatientMistakes"
  | "patientEducationTopics"
  | "whenToSeekAdvice"
  | "authorityStatements"
  | "patientQuestionsWeOftenHear"
  | "bestPracticeGuidance"
  | "safetyConsiderations"
> {
  const out = {} as Pick<
    AuthorityFields,
    | "professionalInsights"
    | "commonPatientMistakes"
    | "patientEducationTopics"
    | "whenToSeekAdvice"
    | "authorityStatements"
    | "patientQuestionsWeOftenHear"
    | "bestPracticeGuidance"
    | "safetyConsiderations"
  >;
  for (const key of FIELD_KEYS) {
    const merged: string[] = [];
    for (const src of sources) {
      const val = src?.[key];
      if (Array.isArray(val) && val.length && typeof val[0] === "string") {
        merged.push(...(val as string[]));
      }
    }
    out[key] = uniqueStrings(merged);
  }
  return out;
}

function fallbackFromCatalog(service: CatalogService): Partial<AuthorityFields> {
  const name = service.serviceName;
  return {
    professionalInsights: [
      `${name} is most effective when patients understand what to expect before their appointment.`,
      `Pharmacist-led assessment ensures care is proportionate, safe and clearly explained.`,
    ],
    patientEducationTopics: [`What ${name} involves`, "Who the service is suitable for", "What happens after your appointment"],
    whenToSeekAdvice: ["Symptoms worsen or change unexpectedly", "You are unsure whether pharmacy scope is appropriate", "Red-flag symptoms requiring GP or urgent care"],
    authorityStatements: [`${name} at a community pharmacy combines convenient access with professional clinical governance.`],
    patientQuestionsWeOftenHear: [`What does ${name} involve?`, `Who is ${name} suitable for?`, `Do I need an appointment?`],
    bestPracticeGuidance: ["Bring relevant medical history", "Ask questions during your consultation", "Follow safety-netting advice given"],
    safetyConsiderations: ["Not for medical emergencies — call 999", "Individual assessment required before supply or treatment"],
  };
}

function mergeAuthorityFields(
  service: CatalogService,
  categoryId: string,
  config: AuthorityConfig,
): AuthorityFields {
  const id = normalizeServiceId(service.id);
  const cat = config.categoryDefaults[categoryId] || {};
  const svc = config.services[id];

  if (svc) {
    const fallback = fallbackFromCatalog(service);
    return {
      professionalInsights: uniqueStrings(svc.professionalInsights?.length ? svc.professionalInsights : cat.professionalInsights || fallback.professionalInsights || []),
      commonPatientMistakes: uniqueStrings(svc.commonPatientMistakes?.length ? svc.commonPatientMistakes : cat.commonPatientMistakes || fallback.commonPatientMistakes || []),
      patientEducationTopics: uniqueStrings(svc.patientEducationTopics?.length ? svc.patientEducationTopics : cat.patientEducationTopics || fallback.patientEducationTopics || []),
      whenToSeekAdvice: uniqueStrings(svc.whenToSeekAdvice?.length ? svc.whenToSeekAdvice : cat.whenToSeekAdvice || fallback.whenToSeekAdvice || []),
      authorityStatements: uniqueStrings(svc.authorityStatements?.length ? svc.authorityStatements : cat.authorityStatements || fallback.authorityStatements || []),
      patientQuestionsWeOftenHear: uniqueStrings([
        ...(svc.patientQuestionsWeOftenHear || []),
        ...(cat.patientQuestionsWeOftenHear || []),
      ]),
      bestPracticeGuidance: uniqueStrings(svc.bestPracticeGuidance?.length ? svc.bestPracticeGuidance : cat.bestPracticeGuidance || fallback.bestPracticeGuidance || []),
      safetyConsiderations: uniqueStrings(svc.safetyConsiderations?.length ? svc.safetyConsiderations : cat.safetyConsiderations || fallback.safetyConsiderations || []),
      mythVsFact: mergeMythVsFact(svc.mythVsFact, cat.mythVsFact),
    };
  }

  const strings = mergeStringFields(cat, fallbackFromCatalog(service));
  return {
    ...strings,
    mythVsFact: mergeMythVsFact(cat.mythVsFact),
  };
}

export function authorityPath(serviceId: string): string {
  return path.join(STORAGE_DIR, `${normalizeServiceId(serviceId)}.json`);
}

export function loadServiceAuthorityConfig(): AuthorityConfig {
  const config = readJson<AuthorityConfig>(CONFIG_PATH);
  if (!config?.categoryDefaults) {
    throw new Error("Service authority config not found at config/pharmacy/service-authority-library.json");
  }
  return config;
}

export function loadServiceAuthorityProfile(serviceId: string): ServiceAuthorityProfile | null {
  return readJson<ServiceAuthorityProfile>(authorityPath(serviceId));
}

export function loadServiceAuthorityIndex(): ServiceAuthorityIndex | null {
  return readJson<ServiceAuthorityIndex>(INDEX_PATH);
}

function profileToIndexEntry(profile: ServiceAuthorityProfile): ServiceAuthorityIndexEntry {
  return {
    serviceId: profile.serviceId,
    serviceName: profile.serviceName,
    category: profile.category,
    insightCount: profile.professionalInsights.length,
    mythVsFactCount: profile.mythVsFact.length,
    educationTopicCount: profile.patientEducationTopics.length,
    generatedAt: profile.generatedAt,
  };
}

export function getServiceAuthorityStatus(): {
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
  const index = loadServiceAuthorityIndex();
  return {
    hasIndex: !!index,
    totalServices: index?.totalServices || 0,
    catalogCount,
    lastGeneratedAt: index?.generatedAt ?? null,
  };
}

export function listServiceAuthorityProfiles(): ServiceAuthorityIndexEntry[] {
  const index = loadServiceAuthorityIndex();
  if (index?.services?.length) return index.services;
  if (!fs.existsSync(STORAGE_DIR)) return [];
  return fs
    .readdirSync(STORAGE_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => readJson<ServiceAuthorityProfile>(path.join(STORAGE_DIR, f)))
    .filter(Boolean)
    .map((p) => profileToIndexEntry(p!));
}

function buildProfileForService(
  service: CatalogService,
  categoryId: string,
  config: AuthorityConfig,
): ServiceAuthorityProfile {
  const id = normalizeServiceId(service.id);
  const fields = mergeAuthorityFields(service, categoryId, config);

  return {
    serviceId: id,
    serviceName: service.serviceName,
    category: categoryId,
    generatedAt: new Date().toISOString(),
    ...fields,
  };
}

export function buildAllServiceAuthority(): {
  index: ServiceAuthorityIndex;
  profiles: ServiceAuthorityProfile[];
} {
  const config = loadServiceAuthorityConfig();
  const catalog = loadServiceLibraryCatalog();
  const profiles: ServiceAuthorityProfile[] = [];

  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (!service.enabled) continue;
      const profile = buildProfileForService(service, category.id, config);
      writeJson(authorityPath(profile.serviceId), profile);
      profiles.push(profile);
    }
  }

  profiles.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

  const index: ServiceAuthorityIndex = {
    generatedAt: new Date().toISOString(),
    totalServices: profiles.length,
    services: profiles.map(profileToIndexEntry),
  };

  writeJson(INDEX_PATH, index);
  return { index, profiles };
}

export function buildServiceAuthorityForId(serviceId: string): ServiceAuthorityProfile {
  const config = loadServiceAuthorityConfig();
  const catalog = loadServiceLibraryCatalog();

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (normalizeServiceId(service.id) !== normalizeServiceId(serviceId)) continue;
      const profile = buildProfileForService(service, category.id, config);
      writeJson(authorityPath(profile.serviceId), profile);
      return profile;
    }
  }

  throw new Error(`Service "${serviceId}" not found in service library catalog.`);
}

/** Count authority layer terms appearing in generated text. */
export function countAuthorityTerms(text: string, profile: ServiceAuthorityProfile): {
  authorityInsightCount: number;
  mythVsFactCount: number;
  patientEducationCount: number;
  commonMistakeCount: number;
} {
  const lower = text.toLowerCase();
  let authorityInsightCount = 0;
  let mythVsFactCount = 0;
  let patientEducationCount = 0;
  let commonMistakeCount = 0;

  for (const insight of profile.professionalInsights) {
    const words = insight.toLowerCase().split(/\s+/).slice(0, 6).join(" ");
    if (words.length > 20 && lower.includes(words.slice(0, 30))) authorityInsightCount++;
  }
  for (const entry of profile.mythVsFact) {
    const mythSnippet = entry.myth.toLowerCase().slice(0, 30);
    if (lower.includes("myth:") && lower.includes(mythSnippet.slice(0, 20))) mythVsFactCount++;
  }
  if (mythVsFactCount === 0 && lower.includes("myth:") && lower.includes("fact:")) {
    mythVsFactCount = Math.min(profile.mythVsFact.length, (lower.match(/myth:/g) || []).length);
  }
  for (const topic of profile.patientEducationTopics) {
    if (lower.includes(topic.toLowerCase().slice(0, 25))) patientEducationCount++;
  }
  for (const mistake of profile.commonPatientMistakes) {
    if (lower.includes(mistake.toLowerCase().slice(0, 25))) commonMistakeCount++;
  }

  return { authorityInsightCount, mythVsFactCount, patientEducationCount, commonMistakeCount };
}
