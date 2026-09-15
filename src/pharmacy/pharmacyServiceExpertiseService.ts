/**
 * PharmaConnect Growth Engine — Service Expertise Library (Content Quality Layer V1).
 * Deep clinical and marketing expertise for high-quality service page copy.
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
    if (fs.existsSync(path.join(root, "config/pharmacy/service-expertise-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const CONFIG_PATH = path.join(WORKSPACE_ROOT, "config/pharmacy/service-expertise-library.json");
export const STORAGE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-expertise");
export const INDEX_PATH = path.join(STORAGE_DIR, "_index.json");

export interface ServiceExpertiseProfile {
  serviceId: string;
  serviceName: string;
  category: string;
  generatedAt: string;
  clinicalConcepts: string[];
  patientConcerns: string[];
  riskFactors: string[];
  consultationTopics: string[];
  commonMistakes: string[];
  serviceTerminology: string[];
  serviceExplanations: string[];
  authorityStatements: string[];
  contentDo: string[];
  contentAvoid: string[];
}

export interface ServiceExpertiseIndexEntry {
  serviceId: string;
  serviceName: string;
  category: string;
  clinicalConceptCount: number;
  terminologyCount: number;
  generatedAt: string;
}

export interface ServiceExpertiseIndex {
  generatedAt: string;
  totalServices: number;
  services: ServiceExpertiseIndexEntry[];
}

type ExpertiseFields = Omit<ServiceExpertiseProfile, "serviceId" | "serviceName" | "category" | "generatedAt">;

interface ExpertiseConfig {
  version: string;
  categoryDefaults: Record<string, Partial<ExpertiseFields>>;
  services: Record<string, Partial<ExpertiseFields>>;
}

const FIELD_KEYS: (keyof ExpertiseFields)[] = [
  "clinicalConcepts",
  "patientConcerns",
  "riskFactors",
  "consultationTopics",
  "commonMistakes",
  "serviceTerminology",
  "serviceExplanations",
  "authorityStatements",
  "contentDo",
  "contentAvoid",
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

function mergeFields(...sources: Array<Partial<ExpertiseFields> | undefined>): ExpertiseFields {
  const out = {} as ExpertiseFields;
  for (const key of FIELD_KEYS) {
    const merged: string[] = [];
    for (const src of sources) {
      if (src?.[key]?.length) merged.push(...src[key]!);
    }
    out[key] = uniqueStrings(merged);
  }
  return out;
}

function fallbackFromCatalog(service: CatalogService, categoryId: string): Partial<ExpertiseFields> {
  const name = service.serviceName;
  const lower = name.toLowerCase();
  return {
    patientConcerns: [
      `What does ${name} involve?`,
      `Who is ${name} suitable for?`,
      `How do I access ${name} at a pharmacy?`,
    ],
    consultationTopics: [`${name} assessment`, "Patient counselling", "Safety-netting and referral"],
    serviceExplanations: [
      `${name} is delivered by qualified pharmacy teams following clinical governance.`,
      service.description,
    ],
    authorityStatements: [
      `Community pharmacies can provide convenient access to ${lower} where commissioned or clinically appropriate.`,
    ],
    contentDo: ["Use plain language", "Explain eligibility clearly", "Signpost to GP when needed"],
    contentAvoid: ["Do not guarantee outcomes", "Do not replace emergency care", "Do not overclaim NHS funding"],
  };
}

export function expertisePath(serviceId: string): string {
  return path.join(STORAGE_DIR, `${normalizeServiceId(serviceId)}.json`);
}

export function loadServiceExpertiseConfig(): ExpertiseConfig {
  const config = readJson<ExpertiseConfig>(CONFIG_PATH);
  if (!config?.categoryDefaults) {
    throw new Error("Service expertise config not found at config/pharmacy/service-expertise-library.json");
  }
  return config;
}

export function loadServiceExpertiseProfile(serviceId: string): ServiceExpertiseProfile | null {
  return readJson<ServiceExpertiseProfile>(expertisePath(serviceId));
}

export function loadServiceExpertiseIndex(): ServiceExpertiseIndex | null {
  return readJson<ServiceExpertiseIndex>(INDEX_PATH);
}

function profileToIndexEntry(profile: ServiceExpertiseProfile): ServiceExpertiseIndexEntry {
  return {
    serviceId: profile.serviceId,
    serviceName: profile.serviceName,
    category: profile.category,
    clinicalConceptCount: profile.clinicalConcepts.length,
    terminologyCount: profile.serviceTerminology.length,
    generatedAt: profile.generatedAt,
  };
}

export function getServiceExpertiseStatus(): {
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
  const index = loadServiceExpertiseIndex();
  return {
    hasIndex: !!index,
    totalServices: index?.totalServices || 0,
    catalogCount,
    lastGeneratedAt: index?.generatedAt ?? null,
  };
}

export function listServiceExpertiseProfiles(): ServiceExpertiseIndexEntry[] {
  const index = loadServiceExpertiseIndex();
  if (index?.services?.length) return index.services;
  if (!fs.existsSync(STORAGE_DIR)) return [];
  return fs
    .readdirSync(STORAGE_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => readJson<ServiceExpertiseProfile>(path.join(STORAGE_DIR, f)))
    .filter(Boolean)
    .map((p) => profileToIndexEntry(p!));
}

function buildProfileForService(
  service: CatalogService,
  categoryId: string,
  config: ExpertiseConfig,
): ServiceExpertiseProfile {
  const id = normalizeServiceId(service.id);
  const fields = mergeFields(
    config.services[id],
    config.categoryDefaults[categoryId],
    fallbackFromCatalog(service, categoryId),
  );

  return {
    serviceId: id,
    serviceName: service.serviceName,
    category: categoryId,
    generatedAt: new Date().toISOString(),
    ...fields,
  };
}

export function buildAllServiceExpertise(): {
  index: ServiceExpertiseIndex;
  profiles: ServiceExpertiseProfile[];
} {
  const config = loadServiceExpertiseConfig();
  const catalog = loadServiceLibraryCatalog();
  const profiles: ServiceExpertiseProfile[] = [];

  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (!service.enabled) continue;
      const profile = buildProfileForService(service, category.id, config);
      writeJson(expertisePath(profile.serviceId), profile);
      profiles.push(profile);
    }
  }

  profiles.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

  const index: ServiceExpertiseIndex = {
    generatedAt: new Date().toISOString(),
    totalServices: profiles.length,
    services: profiles.map(profileToIndexEntry),
  };

  writeJson(INDEX_PATH, index);
  return { index, profiles };
}

export function buildServiceExpertiseForId(serviceId: string): ServiceExpertiseProfile {
  const config = loadServiceExpertiseConfig();
  const catalog = loadServiceLibraryCatalog();

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (normalizeServiceId(service.id) !== normalizeServiceId(serviceId)) continue;
      const profile = buildProfileForService(service, category.id, config);
      writeJson(expertisePath(profile.serviceId), profile);
      return profile;
    }
  }

  throw new Error(`Service "${serviceId}" not found in service library catalog.`);
}

/** Count how many expertise terms appear in generated text. */
export function countExpertiseTerms(text: string, profile: ServiceExpertiseProfile): {
  clinicalConceptCount: number;
  serviceTerminologyCount: number;
} {
  const lower = text.toLowerCase();
  let clinicalConceptCount = 0;
  let serviceTerminologyCount = 0;

  for (const term of profile.clinicalConcepts) {
    if (lower.includes(term.toLowerCase())) clinicalConceptCount++;
  }
  for (const term of profile.serviceTerminology) {
    if (lower.includes(term.toLowerCase())) serviceTerminologyCount++;
  }

  return { clinicalConceptCount, serviceTerminologyCount };
}

export const GENERIC_ANSWER_PATTERNS = [
  /contact us in .+ to discuss your question/i,
  /contact .+ to discuss your question in more detail/i,
  /call or visit our .+ pharmacy for current costs\.?$/i,
  /contact us to arrange a suitable slot at our .+ branch/i,
  /^High blood pressure often has no symptoms but can increase the risk of stroke, heart disease and kidney problems\. Community pharmacies can provide convenient access to blood pressure checks/i,
];

export function isGenericAnswer(answer: string): boolean {
  return GENERIC_ANSWER_PATTERNS.some((p) => p.test(answer));
}
