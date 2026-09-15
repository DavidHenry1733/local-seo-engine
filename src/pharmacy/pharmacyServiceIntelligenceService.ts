/**
 * PharmaConnect Growth Engine — Service Intelligence Library.
 * Deep service-specific knowledge layer for page generation, FAQs, blogs, schema and CTAs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadServiceLibraryCatalog,
  normalizeServiceId,
  type CatalogService,
  type ServiceLibraryCatalog,
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
    if (fs.existsSync(path.join(root, "config/pharmacy/service-intelligence.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const CONFIG_PATH = path.join(WORKSPACE_ROOT, "config/pharmacy/service-intelligence.json");
export const STORAGE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-intelligence");
export const LEGACY_SI_PATH = path.join(WORKSPACE_ROOT, "output/pharmacy-blueprint/service-intelligence.json");
export const INDEX_PATH = path.join(STORAGE_DIR, "_index.json");

export const MIN_BLOG_TOPICS = 10;
export const MIN_FAQ_TOPICS = 10;
export const MAX_BLOG_TOPICS = 20;
export const MAX_FAQ_TOPICS = 20;

export interface ServiceIntelligenceProfile {
  serviceId: string;
  serviceName: string;
  category: string;
  categoryLabel: string;
  description: string;
  generatedAt: string;
  patientBenefits: string[];
  idealPatients: string[];
  commonQuestions: string[];
  serviceFeatures: string[];
  serviceOutcomes: string[];
  localRelevanceSignals: string[];
  trustSignals: string[];
  ctaOptions: string[];
  schemaType: string;
  blogTopics: string[];
  faqTopics: string[];
  pageSectionOptions: string[];
}

export interface ServiceIntelligenceIndexEntry {
  serviceId: string;
  serviceName: string;
  category: string;
  schemaType: string;
  patientBenefitsCount: number;
  faqTopicsCount: number;
  blogTopicsCount: number;
  pageSectionsCount: number;
  generatedAt: string;
}

export interface ServiceIntelligenceIndex {
  generatedAt: string;
  totalServices: number;
  services: ServiceIntelligenceIndexEntry[];
}

interface ServiceIntelligenceConfig {
  version: string;
  defaults: {
    trustSignals: string[];
    ctaOptions: string[];
    pageSectionOptions: string[];
  };
  schemaByCategory: Record<string, string>;
  categoryProfiles: Record<
    string,
    {
      idealPatients?: string[];
      localRelevanceSignals?: string[];
      serviceFeatures?: string[];
      serviceOutcomes?: string[];
      trustSignals?: string[];
    }
  >;
  services: Record<
    string,
    Partial<Omit<ServiceIntelligenceProfile, "serviceId" | "serviceName" | "category" | "generatedAt">>
  >;
}

interface LegacyServiceEntry {
  serviceProfile?: {
    serviceName?: string;
    category?: string;
    shortDescription?: string;
    primaryAudience?: string;
    secondaryAudience?: string[];
  };
  serviceBenefits?: string[];
  customerQuestions?: Array<{ question?: string }>;
  contentTopics?: { blog?: string[] };
  aiSearchTopics?: { commonQuestions?: string[]; featuredSnippetOpportunities?: string[] };
  localSearchIntent?: { commercial?: string[]; informational?: string[]; local?: string[] };
  trustSignals?: {
    serviceSpecificTrustFactors?: string[];
    regulatoryCompliance?: string[];
    professionalCredentials?: string[];
  };
}

interface LegacyServiceIntelligence {
  services?: Record<string, LegacyServiceEntry>;
}

/** Map catalog service IDs to legacy service-intelligence.json keys. */
const LEGACY_KEY_ALIASES: Record<string, string> = {
  "repeat-prescriptions": "repeat-prescription-service",
  "blood-pressure-checks": "nhs-blood-pressure-checks",
  "new-medicine-service": "nhs-new-medicine-service-nms",
  "smoking-cessation": "nhs-smoking-cessation-support",
  "flu-vaccinations": "nhs-flu-vaccination",
  "covid-vaccinations": "covid-19-vaccination",
  "dosette-trays": "blister-packs-and-compliance-aids",
  "emergency-medicines-supply": "emergency-supply",
  "medication-reviews": "medicines-use-review-mur-structured-medication-review",
  "travel-health-consultations": "travel-health-consultation",
  "private-prescribing": "private-prescription-dispensing",
  "weight-management": "weight-management-consultation",
  "nhs-health-advice": "healthy-living-advice",
  "care-home-support": "palliative-care-dispensing",
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

function uniqueStrings(items: string[], limit?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = String(item || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (limit && out.length >= limit) break;
  }
  return out;
}

export function intelligencePath(serviceId: string): string {
  return path.join(STORAGE_DIR, `${normalizeServiceId(serviceId)}.json`);
}

export function loadServiceIntelligenceConfig(): ServiceIntelligenceConfig {
  const config = readJson<ServiceIntelligenceConfig>(CONFIG_PATH);
  if (!config?.defaults) {
    throw new Error("Service intelligence config not found at config/pharmacy/service-intelligence.json");
  }
  return config;
}

function loadLegacyServiceIntelligence(): LegacyServiceIntelligence | null {
  return readJson<LegacyServiceIntelligence>(LEGACY_SI_PATH);
}

function resolveLegacyKey(serviceId: string): string {
  const id = normalizeServiceId(serviceId);
  return LEGACY_KEY_ALIASES[id] || id;
}

function flattenTrustSignals(legacy?: LegacyServiceEntry["trustSignals"]): string[] {
  if (!legacy) return [];
  return uniqueStrings([
    ...(legacy.serviceSpecificTrustFactors || []),
    ...(legacy.regulatoryCompliance || []),
    ...(legacy.professionalCredentials || []),
  ]);
}

function extractLocalSignals(legacy?: LegacyServiceEntry): string[] {
  const intent = legacy?.localSearchIntent;
  if (!intent) return [];
  const local = (intent.local || []).map((s) =>
    s.replace(/\[(town|postcode|landmark|area)\]/gi, "local area"),
  );
  return uniqueStrings([
    ...local.slice(0, 6),
    ...(intent.commercial || []).slice(0, 4).map((s) => `Search intent: ${s}`),
  ]);
}

function generateBlogTopics(serviceName: string, category: string): string[] {
  const name = serviceName;
  return uniqueStrings([
    `${name} explained: a patient guide`,
    `Who should use ${name} and when to see your GP instead`,
    `How ${name} works: step-by-step at your local pharmacy`,
    `NHS vs private options for ${name.toLowerCase()}`,
    `Common myths about ${name} debunked`,
    `What to expect during your first ${name.toLowerCase()} appointment`,
    `How pharmacists deliver ${name} safely`,
    `${name}: eligibility, cost and booking explained`,
    `Top questions patients ask about ${name}`,
    `How ${name} supports better health outcomes in your community`,
    `Preparing for ${name}: checklist for patients and carers`,
    `${name} and your medicines: what you need to know`,
    `Why local pharmacies are expanding ${name.toLowerCase()} services`,
    `${name} for families: what parents should know`,
    `Accessibility and ${name}: inclusive pharmacy care`,
    `Digital booking and ${name}: modern pharmacy access`,
    `${name} in rural communities: pharmacy as front door care`,
    `Seasonal demand and planning ahead for ${name.toLowerCase()}`,
    `Patient stories: how ${name} helped avoid GP waits`,
    `${name} after hospital discharge: continuity of care`,
  ]).slice(0, MAX_BLOG_TOPICS);
}

function generateFaqTopics(serviceName: string): string[] {
  const lower = serviceName.toLowerCase();
  return uniqueStrings([
    `What is ${serviceName}?`,
    `How do I access ${serviceName} at my local pharmacy?`,
    `Do I need an appointment for ${serviceName}?`,
    `Is ${serviceName} available on the NHS?`,
    `How much does ${serviceName} cost?`,
    `Who is eligible for ${serviceName}?`,
    `How long does a ${lower} appointment take?`,
    `What should I bring to my ${lower} appointment?`,
    `Can I book ${serviceName} online?`,
    `Is ${serviceName} confidential?`,
    `Can children receive ${serviceName} at a pharmacy?`,
    `Is ${serviceName} available at weekends?`,
    `What qualifications do pharmacy staff need to provide ${serviceName}?`,
    `Can ${serviceName} replace seeing my GP?`,
    `What happens after my ${lower} consultation?`,
    `Are there any risks or side effects associated with ${serviceName}?`,
    `How do I know if ${serviceName} is right for me?`,
    `Does ${serviceName} require a GP referral?`,
    `What is the difference between pharmacy ${lower} and a GP service?`,
    `Where can I get ${lower} near me?`,
  ]).slice(0, MAX_FAQ_TOPICS);
}

function generateServiceFeatures(serviceName: string, description: string): string[] {
  return uniqueStrings([
    `Professional ${serviceName.toLowerCase()} consultation`,
    "Qualified pharmacist clinical assessment",
    "Private consultation room where available",
    "Clear patient counselling and next steps",
    "Safety-netting and GP referral when needed",
    description.split(".")[0]?.trim() || "",
  ]).slice(0, 8);
}

function generateServiceOutcomes(serviceName: string): string[] {
  const lower = serviceName.toLowerCase();
  return uniqueStrings([
    `Better access to ${lower}`,
    "Reduced waiting for primary care appointments",
    "Clearer understanding of treatment options",
    "Improved medicines safety and adherence",
    "Confident next steps after consultation",
    "Convenient local healthcare on your high street",
  ]).slice(0, 6);
}

function buildProfileForService(
  serviceId: string,
  catalogService: CatalogService,
  categoryId: string,
  categoryLabel: string,
  config: ServiceIntelligenceConfig,
  legacy: LegacyServiceIntelligence | null,
): ServiceIntelligenceProfile {
  const id = normalizeServiceId(serviceId);
  const override = config.services[id] || {};
  const categoryProfile = config.categoryProfiles[categoryId] || {};
  const legacyKey = resolveLegacyKey(id);
  const legacyEntry = legacy?.services?.[legacyKey] || legacy?.services?.[id];

  const serviceName = catalogService.serviceName;
  const description = catalogService.description;

  const patientBenefits = uniqueStrings([
    ...(override.patientBenefits || []),
    ...(legacyEntry?.serviceBenefits || []).slice(0, 12),
    `Professional pharmacist oversight for ${serviceName.toLowerCase()}`,
    "Convenient local access on your high street",
    "Confidential consultation in a private room",
  ]).slice(0, 12);

  const idealPatients = uniqueStrings([
    ...(override.idealPatients || []),
    legacyEntry?.serviceProfile?.primaryAudience || "",
    ...(legacyEntry?.serviceProfile?.secondaryAudience || []),
    ...(categoryProfile.idealPatients || []),
  ]).slice(0, 8);

  const commonQuestions = uniqueStrings([
    ...(override.commonQuestions || []),
    ...(legacyEntry?.customerQuestions || []).map((q) => q.question || "").slice(0, 12),
    ...(legacyEntry?.aiSearchTopics?.commonQuestions || []).slice(0, 8),
  ]).slice(0, 15);

  const serviceFeatures = uniqueStrings([
    ...(override.serviceFeatures || []),
    ...(categoryProfile.serviceFeatures || []),
    ...generateServiceFeatures(serviceName, description),
  ]).slice(0, 8);

  const serviceOutcomes = uniqueStrings([
    ...(override.serviceOutcomes || []),
    ...(categoryProfile.serviceOutcomes || []),
    ...generateServiceOutcomes(serviceName),
  ]).slice(0, 8);

  const localRelevanceSignals = uniqueStrings([
    ...(override.localRelevanceSignals || []),
    ...(categoryProfile.localRelevanceSignals || []),
    ...extractLocalSignals(legacyEntry),
    "Local high street pharmacy access",
    "Serving nearby residential communities",
    "Convenient for patients without transport to GP hubs",
  ]).slice(0, 10);

  const trustSignals = uniqueStrings([
    ...(override.trustSignals || []),
    ...(categoryProfile.trustSignals || []),
    ...flattenTrustSignals(legacyEntry?.trustSignals),
    ...config.defaults.trustSignals,
  ]).slice(0, 10);

  const blogTopics = uniqueStrings([
    ...(override.blogTopics || []),
    ...(legacyEntry?.contentTopics?.blog || []),
    ...generateBlogTopics(serviceName, categoryId),
  ]).slice(0, MAX_BLOG_TOPICS);

  const faqTopics = uniqueStrings([
    ...(override.faqTopics || []),
    ...commonQuestions,
    ...(legacyEntry?.aiSearchTopics?.featuredSnippetOpportunities || []),
    ...generateFaqTopics(serviceName),
  ]).slice(0, MAX_FAQ_TOPICS);

  const schemaType =
    override.schemaType ||
    config.schemaByCategory[categoryId] ||
    "MedicalClinic";

  return {
    serviceId: id,
    serviceName,
    category: categoryId,
    categoryLabel,
    description,
    generatedAt: new Date().toISOString(),
    patientBenefits,
    idealPatients,
    commonQuestions,
    serviceFeatures,
    serviceOutcomes,
    localRelevanceSignals,
    trustSignals,
    ctaOptions: uniqueStrings([...(override.ctaOptions || []), ...config.defaults.ctaOptions]).slice(0, 8),
    schemaType,
    blogTopics: blogTopics.length >= MIN_BLOG_TOPICS
      ? blogTopics
      : generateBlogTopics(serviceName, categoryId).slice(0, MAX_BLOG_TOPICS),
    faqTopics: faqTopics.length >= MIN_FAQ_TOPICS
      ? faqTopics
      : generateFaqTopics(serviceName).slice(0, MAX_FAQ_TOPICS),
    pageSectionOptions: uniqueStrings([
      ...(override.pageSectionOptions || []),
      ...config.defaults.pageSectionOptions,
    ]),
  };
}

function profileToIndexEntry(profile: ServiceIntelligenceProfile): ServiceIntelligenceIndexEntry {
  return {
    serviceId: profile.serviceId,
    serviceName: profile.serviceName,
    category: profile.category,
    schemaType: profile.schemaType,
    patientBenefitsCount: profile.patientBenefits.length,
    faqTopicsCount: profile.faqTopics.length,
    blogTopicsCount: profile.blogTopics.length,
    pageSectionsCount: profile.pageSectionOptions.length,
    generatedAt: profile.generatedAt,
  };
}

export function loadServiceIntelligenceProfile(serviceId: string): ServiceIntelligenceProfile | null {
  return readJson<ServiceIntelligenceProfile>(intelligencePath(serviceId));
}

export function loadServiceIntelligenceIndex(): ServiceIntelligenceIndex | null {
  return readJson<ServiceIntelligenceIndex>(INDEX_PATH);
}

export function getServiceIntelligenceStatus(): {
  hasIndex: boolean;
  totalServices: number;
  builtCount: number;
  catalogCount: number;
  lastGeneratedAt: string | null;
} {
  const catalog = loadServiceLibraryCatalog();
  const catalogCount = catalog.categories.reduce(
    (n, c) => n + c.services.filter((s) => s.enabled).length,
    0,
  );
  const index = loadServiceIntelligenceIndex();
  const builtCount = index?.services?.length || 0;
  return {
    hasIndex: !!index,
    totalServices: builtCount,
    builtCount,
    catalogCount,
    lastGeneratedAt: index?.generatedAt ?? null,
  };
}

export function listServiceIntelligenceProfiles(): ServiceIntelligenceIndexEntry[] {
  const index = loadServiceIntelligenceIndex();
  if (index?.services?.length) return index.services;

  if (!fs.existsSync(STORAGE_DIR)) return [];
  return fs
    .readdirSync(STORAGE_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => {
      const profile = readJson<ServiceIntelligenceProfile>(path.join(STORAGE_DIR, f));
      return profile ? profileToIndexEntry(profile) : null;
    })
    .filter(Boolean) as ServiceIntelligenceIndexEntry[];
}

export function buildAllServiceIntelligence(): {
  index: ServiceIntelligenceIndex;
  profiles: ServiceIntelligenceProfile[];
} {
  const config = loadServiceIntelligenceConfig();
  const catalog = loadServiceLibraryCatalog();
  const legacy = loadLegacyServiceIntelligence();
  const profiles: ServiceIntelligenceProfile[] = [];

  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (!service.enabled) continue;
      const profile = buildProfileForService(
        service.id,
        service,
        category.id,
        category.label,
        config,
        legacy,
      );
      writeJson(intelligencePath(profile.serviceId), profile);
      profiles.push(profile);
    }
  }

  profiles.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

  const index: ServiceIntelligenceIndex = {
    generatedAt: new Date().toISOString(),
    totalServices: profiles.length,
    services: profiles.map(profileToIndexEntry),
  };

  writeJson(INDEX_PATH, index);

  return { index, profiles };
}

export function buildServiceIntelligenceForId(serviceId: string): ServiceIntelligenceProfile {
  const config = loadServiceIntelligenceConfig();
  const catalog = loadServiceLibraryCatalog();
  const legacy = loadLegacyServiceIntelligence();

  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (normalizeServiceId(service.id) !== normalizeServiceId(serviceId)) continue;
      const profile = buildProfileForService(
        service.id,
        service,
        category.id,
        category.label,
        config,
        legacy,
      );
      writeJson(intelligencePath(profile.serviceId), profile);
      return profile;
    }
  }

  throw new Error(`Service "${serviceId}" not found in service library catalog.`);
}
