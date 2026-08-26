/**
 * Pharmacy Service Variant Library V1 — types, selection, build and load.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";
import {
  getEnrichedBlueprint,
  selectBlueprintFaqs,
} from "./pharmacyServiceBlueprintContentService.ts";
import { SERVICE_VARIANT_DEFINITIONS } from "./serviceVariantContent.part1.ts";
import { SERVICE_VARIANT_DEFINITIONS_PART2 } from "./serviceVariantContent.part2.ts";
import { SERVICE_VARIANT_DEFINITIONS_PART3 } from "./serviceVariantContent.part3.ts";

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
export const VARIANT_OUTPUT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-variants");

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
): string {
  const q = question.trim();
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
  const file = path.join(VARIANT_OUTPUT_DIR, `${serviceId}.json`);
  if (!fs.existsSync(file)) {
    const built = ALL_DEFINITIONS[serviceId];
    if (!built) return null;
    return buildServiceVariantPack(serviceId);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as ServiceVariantPack;
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
