/**
 * Pharmacy Master Service Blueprint Library V1 — Foundation Layer.
 * Definitive service intelligence and content blueprint source for page generation.
 * Does not modify publishing, deployment, or existing generators.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
export const BLUEPRINT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-blueprints");
export const BLUEPRINT_INDEX_PATH = path.join(BLUEPRINT_DIR, "_index.json");
export const BLUEPRINT_VERSION = "1.1";

export const BLUEPRINT_SERVICE_IDS = [
  "prescription-dispensing",
  "repeat-prescriptions",
  "pharmacy-first",
  "blood-pressure-checks",
  "new-medicine-service",
  "pharmacy-contraception-service",
  "smoking-cessation",
  "flu-vaccinations",
  "covid-vaccinations",
  "travel-vaccinations",
  "travel-health-consultations",
  "weight-management",
  "ear-wax-removal",
  "vitamin-b12-injections",
  "emergency-contraception",
  "minor-ailments",
  "nhs-services",
  "malaria-prevention",
  "health-checks",
  "medication-reviews",
] as const;

export type BlueprintServiceId = (typeof BLUEPRINT_SERVICE_IDS)[number];

export const MIN_FAQS = 50;
export const MIN_MYTHS = 25;
export const MIN_AUTHORITY_TOPICS = 40;
export const MIN_PATIENT_QUESTIONS = 40;
export const MIN_TRUST_TOPICS = 20;
export const MIN_PREPARATION = 15;
export const MIN_AFTERCARE = 15;
export const MIN_SUITABILITY = 15;
export const MIN_RISKS = 15;
export const MIN_BENEFITS = 15;
export const MIN_RELATED_SERVICES = 10;

/** Minimum estimated words for page-type readiness (blueprint depth audit). */
export const TARGET_SERVICE_PAGE_WORDS = { min: 1500, max: 2500 };
export const TARGET_HUB_PAGE_WORDS = { min: 1500, max: 2500 };
export const TARGET_AREA_PAGE_WORDS = { min: 1200, max: 1800 };

export interface MythFactPair {
  myth: string;
  fact: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
  category?: string;
}

export interface RelatedServiceOpportunity {
  serviceId: string;
  serviceName: string;
  reason: string;
  linkContext: string;
}

export interface NhsPrivateComparison {
  myth: string;
  fact: string;
}

export interface ServiceBlueprint {
  serviceId: string;
  serviceName: string;
  version: string;
  generatedAt: string;
  serviceSummary: string;
  patientIntent: string[];
  whoBenefits: string[];
  whoMayNotBeSuitable: string[];
  suitabilityTopics: string[];
  commonConditions: string[];
  symptoms: string[];
  benefits: string[];
  risks: string[];
  preparation: string[];
  appointmentProcess: string[];
  aftercare: string[];
  trustSignals: string[];
  trustTopics: string[];
  clinicalFacts: string[];
  mythsVsFacts: MythFactPair[];
  patientQuestions: string[];
  faqLibrary: FaqEntry[];
  relatedServices: RelatedServiceOpportunity[];
  authorityTopics: string[];
  internalEntities: string[];
  externalEntities: string[];
  medicalTerms: string[];
  localIntentTopics: string[];
  conversionTopics: string[];
  commonPatientObjections: string[];
  bookingBarriers: string[];
  safetyConcerns: string[];
  eligibilityQuestions: string[];
  costValueQuestions: string[];
  nhsPrivateComparisons: string[];
}

export interface ServiceBlueprintIndexEntry {
  serviceId: string;
  serviceName: string;
  version: string;
  generatedAt: string;
  faqCount: number;
  mythCount: number;
  authorityTopicCount: number;
  patientQuestionCount: number;
  trustTopicCount: number;
  relatedServiceCount: number;
  wordPotential: {
    servicePage: number;
    hubPage: number;
    areaPage: number;
    totalUnique: number;
  };
  sectionCounts: Record<string, number>;
}

export interface ServiceBlueprintIndex {
  version: string;
  generatedAt: string;
  totalServices: number;
  services: ServiceBlueprintIndexEntry[];
}

export interface BlueprintValidationIssue {
  serviceId: string;
  field: string;
  message: string;
}

export interface BlueprintValidationResult {
  valid: boolean;
  serviceCount: number;
  issues: BlueprintValidationIssue[];
  totals: {
    faqs: number;
    myths: number;
    authorityTopics: number;
    patientQuestions: number;
    relatedServices: number;
  };
}

const STRING_SECTIONS: Array<keyof ServiceBlueprint> = [
  "patientIntent",
  "whoBenefits",
  "whoMayNotBeSuitable",
  "suitabilityTopics",
  "commonConditions",
  "symptoms",
  "benefits",
  "risks",
  "preparation",
  "appointmentProcess",
  "aftercare",
  "trustSignals",
  "trustTopics",
  "clinicalFacts",
  "patientQuestions",
  "authorityTopics",
  "internalEntities",
  "externalEntities",
  "medicalTerms",
  "localIntentTopics",
  "conversionTopics",
  "commonPatientObjections",
  "bookingBarriers",
  "safetyConcerns",
  "eligibilityQuestions",
  "costValueQuestions",
  "nhsPrivateComparisons",
];

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function blueprintPath(serviceId: string): string {
  return path.join(BLUEPRINT_DIR, `${normalizeServiceId(serviceId)}.json`);
}

export function saveServiceBlueprint(blueprint: ServiceBlueprint): ServiceBlueprint {
  fs.mkdirSync(BLUEPRINT_DIR, { recursive: true });
  fs.writeFileSync(blueprintPath(blueprint.serviceId), JSON.stringify(blueprint, null, 2));
  return blueprint;
}

export function loadServiceBlueprint(serviceId: string): ServiceBlueprint | null {
  return readJson<ServiceBlueprint>(blueprintPath(serviceId));
}

export function loadServiceBlueprintIndex(): ServiceBlueprintIndex | null {
  return readJson<ServiceBlueprintIndex>(BLUEPRINT_INDEX_PATH);
}

export function loadAllServiceBlueprints(): ServiceBlueprint[] {
  return BLUEPRINT_SERVICE_IDS.map((id) => loadServiceBlueprint(id)).filter(Boolean) as ServiceBlueprint[];
}

function indexEntryFromBlueprint(
  b: ServiceBlueprint,
  wordPotential?: ServiceBlueprintIndexEntry["wordPotential"],
): ServiceBlueprintIndexEntry {
  const sectionCounts: Record<string, number> = {};
  for (const key of STRING_SECTIONS) {
    const val = b[key];
    sectionCounts[key] = Array.isArray(val) ? val.length : 0;
  }
  sectionCounts.serviceSummary = b.serviceSummary?.trim() ? 1 : 0;
  sectionCounts.mythsVsFacts = b.mythsVsFacts.length;
  sectionCounts.faqLibrary = b.faqLibrary.length;
  sectionCounts.relatedServices = b.relatedServices.length;

  return {
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    version: b.version,
    generatedAt: b.generatedAt,
    faqCount: b.faqLibrary.length,
    mythCount: b.mythsVsFacts.length,
    authorityTopicCount: b.authorityTopics.length,
    patientQuestionCount: b.patientQuestions.length,
    trustTopicCount: b.trustTopics.length,
    relatedServiceCount: b.relatedServices.length,
    wordPotential: wordPotential || { servicePage: 0, hubPage: 0, areaPage: 0, totalUnique: 0 },
    sectionCounts,
  };
}

export function saveServiceBlueprintIndex(
  blueprints: ServiceBlueprint[],
  wordPotentials?: Map<string, ServiceBlueprintIndexEntry["wordPotential"]>,
): ServiceBlueprintIndex {
  const index: ServiceBlueprintIndex = {
    version: BLUEPRINT_VERSION,
    generatedAt: new Date().toISOString(),
    totalServices: blueprints.length,
    services: blueprints
      .map((b) => indexEntryFromBlueprint(b, wordPotentials?.get(b.serviceId)))
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName)),
  };
  fs.mkdirSync(BLUEPRINT_DIR, { recursive: true });
  fs.writeFileSync(BLUEPRINT_INDEX_PATH, JSON.stringify(index, null, 2));
  return index;
}

function isNonEmptyString(val: unknown): boolean {
  return typeof val === "string" && val.trim().length > 0;
}

function isNonEmptyStringArray(val: unknown): boolean {
  return Array.isArray(val) && val.length > 0 && val.every((s) => isNonEmptyString(s));
}

export function validateServiceBlueprint(blueprint: ServiceBlueprint): BlueprintValidationIssue[] {
  const issues: BlueprintValidationIssue[] = [];
  const id = blueprint.serviceId || "unknown";

  if (!isNonEmptyString(blueprint.serviceName)) {
    issues.push({ serviceId: id, field: "serviceName", message: "serviceName is empty" });
  }
  if (!isNonEmptyString(blueprint.serviceSummary)) {
    issues.push({ serviceId: id, field: "serviceSummary", message: "serviceSummary is empty" });
  }

  for (const key of STRING_SECTIONS) {
    if (!isNonEmptyStringArray(blueprint[key])) {
      issues.push({ serviceId: id, field: key, message: `${key} is empty or contains blank entries` });
    }
  }

  if (blueprint.faqLibrary.length < MIN_FAQS) {
    issues.push({ serviceId: id, field: "faqLibrary", message: `faqLibrary has ${blueprint.faqLibrary.length}, minimum ${MIN_FAQS}` });
  }
  for (const faq of blueprint.faqLibrary) {
    if (!isNonEmptyString(faq.question) || !isNonEmptyString(faq.answer)) {
      issues.push({ serviceId: id, field: "faqLibrary", message: "FAQ entry has empty question or answer" });
      break;
    }
  }

  if (blueprint.mythsVsFacts.length < MIN_MYTHS) {
    issues.push({ serviceId: id, field: "mythsVsFacts", message: `mythsVsFacts has ${blueprint.mythsVsFacts.length}, minimum ${MIN_MYTHS}` });
  }
  for (const pair of blueprint.mythsVsFacts) {
    if (!isNonEmptyString(pair.myth) || !isNonEmptyString(pair.fact)) {
      issues.push({ serviceId: id, field: "mythsVsFacts", message: "Myth/fact pair has empty myth or fact" });
      break;
    }
  }

  if (blueprint.authorityTopics.length < MIN_AUTHORITY_TOPICS) {
    issues.push({
      serviceId: id,
      field: "authorityTopics",
      message: `authorityTopics has ${blueprint.authorityTopics.length}, minimum ${MIN_AUTHORITY_TOPICS}`,
    });
  }

  if (blueprint.patientQuestions.length < MIN_PATIENT_QUESTIONS) {
    issues.push({
      serviceId: id,
      field: "patientQuestions",
      message: `patientQuestions has ${blueprint.patientQuestions.length}, minimum ${MIN_PATIENT_QUESTIONS}`,
    });
  }

  const countChecks: Array<[keyof ServiceBlueprint, number, string]> = [
    ["benefits", MIN_BENEFITS, "benefits"],
    ["risks", MIN_RISKS, "risks"],
    ["preparation", MIN_PREPARATION, "preparation"],
    ["aftercare", MIN_AFTERCARE, "aftercare"],
    ["suitabilityTopics", MIN_SUITABILITY, "suitabilityTopics"],
    ["trustTopics", MIN_TRUST_TOPICS, "trustTopics"],
  ];

  for (const [field, min] of countChecks) {
    const arr = blueprint[field];
    if (!Array.isArray(arr) || arr.length < min) {
      issues.push({
        serviceId: id,
        field: field as string,
        message: `${field} has ${Array.isArray(arr) ? arr.length : 0}, minimum ${min}`,
      });
    }
  }

  if (blueprint.relatedServices.length < MIN_RELATED_SERVICES) {
    issues.push({
      serviceId: id,
      field: "relatedServices",
      message: `relatedServices has ${blueprint.relatedServices.length}, minimum ${MIN_RELATED_SERVICES}`,
    });
  }
  for (const rel of blueprint.relatedServices) {
    if (!isNonEmptyString(rel.serviceId) || !isNonEmptyString(rel.serviceName) || !isNonEmptyString(rel.reason)) {
      issues.push({ serviceId: id, field: "relatedServices", message: "Related service entry is incomplete" });
      break;
    }
  }

  return issues;
}

export function validateAllServiceBlueprints(blueprints: ServiceBlueprint[]): BlueprintValidationResult {
  const issues: BlueprintValidationIssue[] = [];
  for (const b of blueprints) {
    issues.push(...validateServiceBlueprint(b));
  }

  const totals = blueprints.reduce(
    (acc, b) => ({
      faqs: acc.faqs + b.faqLibrary.length,
      myths: acc.myths + b.mythsVsFacts.length,
      authorityTopics: acc.authorityTopics + b.authorityTopics.length,
      patientQuestions: acc.patientQuestions + b.patientQuestions.length,
      relatedServices: acc.relatedServices + b.relatedServices.length,
    }),
    { faqs: 0, myths: 0, authorityTopics: 0, patientQuestions: 0, relatedServices: 0 },
  );

  return {
    valid: issues.length === 0 && blueprints.length === BLUEPRINT_SERVICE_IDS.length,
    serviceCount: blueprints.length,
    issues,
    totals,
  };
}
