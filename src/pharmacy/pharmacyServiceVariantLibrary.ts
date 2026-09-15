/**
 * Pharmacy Service Variant Library V1 — types, selection, build and load.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";
import {
  getEnrichedBlueprint,
  selectBlueprintFaqs,
} from "./pharmacyServiceBlueprintContentService.ts";
import { SERVICE_VARIANT_DEFINITIONS } from "./serviceVariantContent.part1.ts";
import { SERVICE_VARIANT_DEFINITIONS_PART2 } from "./serviceVariantContent.part2.ts";
import { SERVICE_VARIANT_DEFINITIONS_PART3 } from "./serviceVariantContent.part3.ts";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export { WORKSPACE_ROOT };
export const VARIANT_OUTPUT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-variants");
export const APPROVED_SERVICE_BANK_REGISTRY_PATH = path.join(
  WORKSPACE_ROOT,
  "data/pharmacy-approved-service-banks/registry.json",
);

/** Registered approved-bank services must never fall back to in-code variant packs. */
export const REGISTERED_APPROVED_BANK_SERVICE_IDS = [
  "pharmacy-first",
  "blood-pressure-checks",
  "travel-vaccinations",
  "flu-vaccinations",
] as const;

export interface ApprovedServiceBankRegistryEntry {
  serviceId: string;
  approvedBankVersion: string;
  approvedBankHash: string;
  approvedBankRelativePath: string;
  allowedGeneratorContract?: {
    servicePage?: string;
    localityPage?: string;
    selectionRule?: string;
    servicePageContractRelativePath?: string;
  };
}

export interface ApprovedServiceBankRegistry {
  registryId: string;
  immutable: boolean;
  services: Record<string, ApprovedServiceBankRegistryEntry>;
}

/** Load immutable approved-bank registry (metadata only — no tenant HTML). */
export function loadApprovedServiceBankRegistry(): ApprovedServiceBankRegistry | null {
  if (!fs.existsSync(APPROVED_SERVICE_BANK_REGISTRY_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(APPROVED_SERVICE_BANK_REGISTRY_PATH, "utf8")) as ApprovedServiceBankRegistry;
  } catch {
    return null;
  }
}

/**
 * Resolve the pinned approved content bank for a serviceId.
 * Selection is solely by serviceId — no tenant or campaign overrides.
 */
export function resolveApprovedServiceBank(
  serviceId: string,
): { entry: ApprovedServiceBankRegistryEntry; absolutePath: string; hash: string } | null {
  const registry = loadApprovedServiceBankRegistry();
  const entry = registry?.services?.[serviceId];
  if (!entry?.approvedBankRelativePath || !entry.approvedBankHash) return null;
  const absolutePath = path.join(WORKSPACE_ROOT, entry.approvedBankRelativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Approved service bank missing for ${serviceId}: ${absolutePath}`);
  }
  const hash = crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
  if (hash !== entry.approvedBankHash) {
    throw new Error(
      `Approved service bank hash mismatch for ${serviceId}: expected ${entry.approvedBankHash}, got ${hash}`,
    );
  }
  return { entry, absolutePath, hash };
}

export interface SectionVariant {
  heading: string;
  body: string;
  bullets?: string[];
  type?: string;
}

export interface IntroVariant {
  body: string;
}

export interface CtaVariant {
  primary: string;
  secondary: string;
  phonePrompt: string;
  bookingPrompt: string;
}

export interface FaqVariant {
  question: string;
  answer: string;
}

/** Optional locality-only reusable copy. Never used by the locked service-page contract. */
export interface ApprovedBankLocalityPageSource {
  overviewHeading?: string;
  overviewParagraphs?: string[];
  overviewBullets?: string[];
  considerHeading?: string;
  considerBody?: string;
  considerBullets?: string[];
  scopeHeading?: string;
  scopeBody?: string;
  scopeBullets?: string[];
  processHeading?: string;
  processBody?: string;
  processSteps?: SectionVariant[];
  preparationHeading?: string;
  preparationBody?: string;
  preparationBullets?: string[];
  safetyHeading?: string;
  safetyBody?: string;
  safetyBullets?: string[];
  faqs?: FaqVariant[];
}

export interface ServiceVariantPack {
  serviceId: string;
  serviceName: string;
  version: number;
  generatedAt: string;
  intro: IntroVariant[];
  problem?: SectionVariant[];
  benefits: SectionVariant[];
  eligibility: SectionVariant[];
  howItWorks: SectionVariant[];
  treatmentProcess?: SectionVariant[];
  preparationGuide: SectionVariant[];
  trustSafety: SectionVariant[];
  patientEducation: SectionVariant[];
  mythVsFact: SectionVariant[];
  patientOutcomes?: SectionVariant[];
  cta: CtaVariant[];
  faqs: FaqVariant[];
  /** Locality-page overlay. Must not alter locked service-page contract derivation. */
  localityPage?: ApprovedBankLocalityPageSource;
  /** CORE-PAGE-28: optional embedded service-page contract; otherwise derived at load. */
  servicePage?: {
    contractId: string;
    serviceId: string;
    serviceName: string;
    bankVersion: number | string;
    sections: Array<{ num: string; kicker: string; title: string; proseHtml: string }>;
    faqs: FaqVariant[];
    heroIntroBody: string;
  };
}

export interface SelectedAreaVariants {
  serviceId: string;
  areaSlug: string;
  layoutTemplateId: string;
  intro: IntroVariant;
  sections: Record<string, SectionVariant>;
  cta: CtaVariant;
  faqs: FaqVariant[];
}

const ALL_DEFINITIONS: Record<string, Omit<ServiceVariantPack, "version" | "generatedAt">> = {
  ...SERVICE_VARIANT_DEFINITIONS,
  ...SERVICE_VARIANT_DEFINITIONS_PART2,
  ...SERVICE_VARIANT_DEFINITIONS_PART3,
};

export const SERVICE_IDS = Object.keys(ALL_DEFINITIONS);

function pickVariant<T>(items: T[], serviceId: string, areaSlug: string, category: string): T {
  if (!items.length) throw new Error(`No variants for ${serviceId}/${category}`);
  const idx = hashSeed(serviceId, areaSlug, category) % items.length;
  return items[idx];
}

export function localizeFaqQuestion(
  question: string,
  area: string,
  areaSlug: string,
  index: number,
  serviceId?: string,
): string {
  const q = question.trim();
  if (serviceId && isApprovedBankRegisteredService(serviceId)) return q;
  if (q.toLowerCase().includes(area.toLowerCase())) return q;
  const templateIdx = hashSeed(areaSlug, String(index), "faq-q") % 5;
  const prefixes = [
    `${area} patients — `,
    `For ${area} residents: `,
    `${area} — `,
    `Local guidance for ${area}: `,
    `${area} pharmacy access — `,
  ];
  const lower = q.charAt(0).toLowerCase() + q.slice(1);
  return `${prefixes[templateIdx]}${lower}`;
}

export function pickFaqs(
  faqs: FaqVariant[],
  serviceId: string,
  areaSlug: string,
  count = 8,
  areaSlugsInCluster: string[] = [],
): FaqVariant[] {
  const blueprint = getEnrichedBlueprint(serviceId);
  if (blueprint?.faqLibrary.length) {
    const blueprintFaqs = selectBlueprintFaqs(blueprint, "area", serviceId, count, areaSlug).map((f) => ({
      question: f.question,
      answer: f.answer,
    }));
    if (blueprintFaqs.length >= count) return blueprintFaqs;
    const fallback = pickFaqsFromVariants(faqs, serviceId, areaSlug, count, areaSlugsInCluster);
    const seen = new Set(blueprintFaqs.map((f) => f.question.toLowerCase()));
    for (const f of fallback) {
      if (seen.has(f.question.toLowerCase())) continue;
      blueprintFaqs.push(f);
      if (blueprintFaqs.length >= count) break;
    }
    return blueprintFaqs;
  }
  return pickFaqsFromVariants(faqs, serviceId, areaSlug, count, areaSlugsInCluster);
}

/** Pack-owned FAQ selection — does not prefer blueprint libraries (avoids cross-service FAQ bleed). */
export function pickServiceVariantFaqs(
  faqs: FaqVariant[],
  serviceId: string,
  areaSlug: string,
  count = 8,
  areaSlugsInCluster: string[] = [],
): FaqVariant[] {
  return pickFaqsFromVariants(faqs, serviceId, areaSlug, count, areaSlugsInCluster);
}

function pickFaqsFromVariants(
  faqs: FaqVariant[],
  serviceId: string,
  areaSlug: string,
  count = 8,
  areaSlugsInCluster: string[] = [],
): FaqVariant[] {
  if (!faqs.length) return [];
  const sorted = areaSlugsInCluster.length >= 2 ? [...areaSlugsInCluster].sort() : [areaSlug];
  const areaIdx = Math.max(0, sorted.indexOf(areaSlug));
  const areaCount = sorted.length;

  if (faqs.length >= count * areaCount) {
    const chunk = Math.floor(faqs.length / areaCount);
    const start = areaIdx * chunk;
    return faqs.slice(start, start + count);
  }

  const offset = hashSeed(serviceId, areaSlug, "faqs") % faqs.length;
  const step = 2 + (hashSeed(areaSlug, serviceId) % 3);
  const selected: FaqVariant[] = [];
  for (let i = 0; i < count; i++) {
    const item = faqs[(offset + i * step) % faqs.length];
    if (!selected.some((s) => s.question === item.question)) selected.push(item);
  }
  let cursor = 0;
  const maxCursor = faqs.length + count + 2;
  while (selected.length < Math.min(count, faqs.length) && cursor < maxCursor) {
    const item = faqs[(offset + cursor) % faqs.length];
    if (!selected.some((s) => s.question === item.question)) selected.push(item);
    cursor++;
  }
  return selected;
}

export function buildServiceVariantPack(serviceId: string): ServiceVariantPack {
  const def = ALL_DEFINITIONS[serviceId];
  if (!def) throw new Error(`Unknown service variant definition: ${serviceId}`);
  return {
    ...def,
    version: 1,
    generatedAt: new Date().toISOString(),
  };
}

export function buildAllServiceVariantPacks(): ServiceVariantPack[] {
  return SERVICE_IDS.map(buildServiceVariantPack);
}

export function writeServiceVariantPacks(): { written: string[]; outputDir: string } {
  fs.mkdirSync(VARIANT_OUTPUT_DIR, { recursive: true });
  const written: string[] = [];
  for (const pack of buildAllServiceVariantPacks()) {
    const file = path.join(VARIANT_OUTPUT_DIR, `${pack.serviceId}.json`);
    fs.writeFileSync(file, JSON.stringify(pack, null, 2));
    written.push(file);
  }
  return { written, outputDir: VARIANT_OUTPUT_DIR };
}

export function loadServiceVariantPack(serviceId: string): ServiceVariantPack | null {
  // Locked services: bank selection is solely by serviceId via the immutable registry.
  const approved = resolveApprovedServiceBank(serviceId);
  if (approved) {
    return JSON.parse(fs.readFileSync(approved.absolutePath, "utf8")) as ServiceVariantPack;
  }
  if ((REGISTERED_APPROVED_BANK_SERVICE_IDS as readonly string[]).includes(serviceId)) {
    throw new Error(
      `Registered approved bank could not be loaded for ${serviceId} (registry=${APPROVED_SERVICE_BANK_REGISTRY_PATH})`,
    );
  }
  const file = path.join(VARIANT_OUTPUT_DIR, `${serviceId}.json`);
  if (!fs.existsSync(file)) {
    const built = ALL_DEFINITIONS[serviceId];
    if (!built) return null;
    return buildServiceVariantPack(serviceId);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as ServiceVariantPack;
}

/** True when serviceId is covered by the approved-bank registry (core pages must use the bank). */
export function isApprovedBankRegisteredService(serviceId: string): boolean {
  return Boolean(resolveApprovedServiceBank(serviceId));
}

export function getSectionVariant(
  pack: ServiceVariantPack,
  slot: string,
  serviceId: string,
  areaSlug: string,
): SectionVariant | null {
  const categoryMap: Record<string, keyof ServiceVariantPack> = {
    problem: "problem",
    benefits: "benefits",
    eligibility: "eligibility",
    howItWorks: "howItWorks",
    treatmentProcess: "treatmentProcess",
    preparationGuide: "preparationGuide",
    trustSafety: "trustSafety",
    patientEducation: "patientEducation",
    mythVsFact: "mythVsFact",
    patientOutcomes: "patientOutcomes",
  };
  const key = categoryMap[slot];
  if (!key) return null;
  let pool = (pack[key] as SectionVariant[] | undefined) || [];
  if (slot === "benefits" && !pool.length && pack.problem?.length) {
    pool = pack.problem;
  }
  if (slot === "problem" && !pool.length && pack.benefits?.length) {
    pool = pack.benefits;
  }
  if (!pool.length) return null;
  const variant = pickVariant(pool, serviceId, areaSlug, slot);
  const defaultType =
    slot === "trustSafety"
      ? variant.type || "safetyConsiderations"
      : slot === "treatmentProcess"
        ? "treatmentProcess"
        : slot;
  return { ...variant, type: variant.type || defaultType };
}

export function selectAreaVariants(
  pack: ServiceVariantPack,
  areaSlug: string,
  layoutTemplateId: string,
  areaSlugsInCluster: string[] = [],
): SelectedAreaVariants {
  const { serviceId } = pack;
  const slots = [
    "problem",
    "benefits",
    "eligibility",
    "howItWorks",
    "treatmentProcess",
    "preparationGuide",
    "patientOutcomes",
    "trustSafety",
    "patientEducation",
    "mythVsFact",
  ];
  const sections: Record<string, SectionVariant> = {};
  for (const slot of slots) {
    const v = getSectionVariant(pack, slot, serviceId, areaSlug);
    if (v) sections[slot] = v;
  }
  return {
    serviceId,
    areaSlug,
    layoutTemplateId,
    intro: pickVariant(pack.intro, serviceId, areaSlug, "intro"),
    sections,
    cta: pickVariant(pack.cta, serviceId, areaSlug, "cta"),
    faqs: pickFaqs(pack.faqs, serviceId, areaSlug, 8, areaSlugsInCluster),
  };
}

export function sectionVariantToBlock(
  slot: string,
  variant: SectionVariant,
): { type: string; heading: string; body: string; bullets?: string[] } {
  const typeMap: Record<string, string> = {
    trustSafety: variant.type || "safetyConsiderations",
    problem: "problem",
    benefits: "benefits",
    eligibility: "eligibility",
    howItWorks: "howItWorks",
    treatmentProcess: "treatmentProcess",
    preparationGuide: "preparationGuide",
    patientOutcomes: "patientOutcomes",
    patientEducation: "patientEducation",
    mythVsFact: "mythVsFact",
  };
  return {
    type: typeMap[slot] || variant.type || slot,
    heading: variant.heading,
    body: variant.body,
    bullets: variant.bullets,
  };
}
