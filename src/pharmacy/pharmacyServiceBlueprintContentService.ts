/**
 * Pharmacy Enriched Blueprint Content Service V1.
 * Seeded selection of blueprint fields per page type — avoids section repetition.
 */
import {
  loadServiceBlueprint,
  type FaqEntry,
  type MythFactPair,
  type ServiceBlueprint,
} from "./pharmacyServiceBlueprintLibrary.ts";
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";

export type BlueprintPageKind = "service" | "hub" | "area";

export interface BlueprintSection {
  type: string;
  heading: string;
  body: string;
  bullets: string[];
}

export interface BlueprintFaq {
  question: string;
  answer: string;
}

const FAQ_OFFSET: Record<BlueprintPageKind, number> = {
  service: 0,
  hub: 17,
  area: 34,
};

const MYTH_OFFSET: Record<BlueprintPageKind, number> = {
  service: 0,
  hub: 10,
  area: 18,
};

const AUTHORITY_OFFSET: Record<BlueprintPageKind, number> = {
  service: 0,
  hub: 18,
  area: 30,
};

function pickSlice<T>(items: T[], offset: number, count: number, step: number): T[] {
  if (!items.length || count <= 0) return [];
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (offset + i * step) % items.length;
    const item = items[idx];
    if (item !== undefined && !out.includes(item)) out.push(item);
  }
  let cursor = 0;
  while (out.length < Math.min(count, items.length)) {
    const item = items[(offset + cursor) % items.length];
    if (!out.includes(item)) out.push(item);
    cursor++;
  }
  return out.slice(0, count);
}

function seededStep(serviceId: string, kind: BlueprintPageKind, category: string): number {
  return 2 + (hashSeed(serviceId, kind, category) % 3);
}

function seededOffset(serviceId: string, kind: BlueprintPageKind, category: string, base: number): number {
  const span = kind === "service" ? 5 : kind === "hub" ? 7 : 11;
  return base + (hashSeed(serviceId, kind, category, "off") % span);
}

export function getEnrichedBlueprint(serviceId: string): ServiceBlueprint | null {
  return loadServiceBlueprint(normalizeServiceId(serviceId));
}

export function selectBlueprintFaqs(
  blueprint: ServiceBlueprint,
  kind: BlueprintPageKind,
  serviceId: string,
  count: number,
  areaSlug = "",
): BlueprintFaq[] {
  const base = FAQ_OFFSET[kind];
  const areaBump = areaSlug ? hashSeed(areaSlug, serviceId) % 8 : 0;
  const offset = seededOffset(serviceId, kind, "faqs", base + areaBump);
  const step = seededStep(serviceId, kind, "faqs");
  const picked = pickSlice(blueprint.faqLibrary, offset, count, step);
  return picked.map((f) => ({ question: f.question, answer: f.answer }));
}

export function selectBlueprintMyths(
  blueprint: ServiceBlueprint,
  kind: BlueprintPageKind,
  serviceId: string,
  count: number,
  areaSlug = "",
): MythFactPair[] {
  const base = MYTH_OFFSET[kind];
  const areaBump = areaSlug ? hashSeed(areaSlug, "myths") % 5 : 0;
  const offset = seededOffset(serviceId, kind, "myths", base + areaBump);
  return pickSlice(blueprint.mythsVsFacts, offset, count, seededStep(serviceId, kind, "myths"));
}

export function selectBlueprintAuthority(
  blueprint: ServiceBlueprint,
  kind: BlueprintPageKind,
  serviceId: string,
  count: number,
): string[] {
  const offset = seededOffset(serviceId, kind, "authority", AUTHORITY_OFFSET[kind]);
  return pickSlice(blueprint.authorityTopics, offset, count, seededStep(serviceId, kind, "authority"));
}

export function selectBlueprintStrings(
  items: string[],
  kind: BlueprintPageKind,
  serviceId: string,
  category: string,
  count: number,
  areaSlug = "",
): string[] {
  const areaBump = areaSlug ? hashSeed(areaSlug, category) % Math.max(1, Math.floor(items.length / 4)) : 0;
  const offset = hashSeed(serviceId, kind, category, areaSlug) % Math.max(1, items.length) + areaBump;
  return pickSlice(items, offset % items.length, count, seededStep(serviceId, kind, category));
}

function joinBullets(items: string[], max = 6): string {
  if (!items.length) return "";
  return items.slice(0, max).join(". ") + (items.length > max ? "." : "");
}

export function buildServicePageBlueprintSections(
  blueprint: ServiceBlueprint,
  pharmacyName: string,
  town: string,
): BlueprintSection[] {
  const sid = blueprint.serviceId;
  const name = blueprint.serviceName;
  const sections: BlueprintSection[] = [];

  sections.push({
    type: "serviceOverview",
    heading: `${name} — clinical overview`,
    body: `${blueprint.serviceSummary} At ${pharmacyName} in ${town}, ${name.toLowerCase()} is delivered with structured assessment, plain-language advice and documented next steps.`,
    bullets: selectBlueprintStrings(blueprint.patientIntent, "service", sid, "intent", 4),
  });

  sections.push({
    type: "benefits",
    heading: "Who benefits from this service",
    body: `${name} supports patients who need convenient pharmacy access with professional oversight. Suitability is always confirmed individually at consultation.`,
    bullets: selectBlueprintStrings(blueprint.whoBenefits, "service", sid, "benefits", 6),
  });

  sections.push({
    type: "eligibility",
    heading: "Suitability and limitations",
    body: `Not every presentation qualifies for pharmacy-led care. The following groups may need GP, specialist or urgent care instead of ${name.toLowerCase()} alone:`,
    bullets: selectBlueprintStrings(blueprint.whoMayNotBeSuitable, "service", sid, "unsuitable", 5),
  });

  sections.push({
    type: "howItWorks",
    heading: "Appointment process",
    body: `Your ${name.toLowerCase()} appointment follows a structured clinical pathway from booking through to aftercare:`,
    bullets: selectBlueprintStrings(blueprint.appointmentProcess, "service", sid, "process", 6),
  });

  sections.push({
    type: "preparationGuide",
    heading: "How to prepare",
    body: `Preparation helps your pharmacist allocate adequate time and give accurate advice during ${name.toLowerCase()}:`,
    bullets: selectBlueprintStrings(blueprint.preparation, "service", sid, "prep", 6),
  });

  sections.push({
    type: "aftercare",
    heading: "After your appointment",
    body: `Follow safety-netting advice after ${name.toLowerCase()}. Contact the pharmacy or your GP if symptoms persist, worsen or new concerns arise:`,
    bullets: selectBlueprintStrings(blueprint.aftercare, "service", sid, "aftercare", 6),
  });

  sections.push({
    type: "risksAndLimitations",
    heading: "Risks and clinical limitations",
    body: `${name} operates within defined pharmacy scope. Understanding limitations helps you use the service safely:`,
    bullets: selectBlueprintStrings(blueprint.risks, "service", sid, "risks", 6),
  });

  if (blueprint.nhsPrivateComparisons.length) {
    sections.push({
      type: "nhsPrivateComparison",
      heading: "NHS and private options",
      body: `Patients often ask about NHS eligibility versus private ${name.toLowerCase()}. The pharmacy team explains commissioning, fees and scope before supply:`,
      bullets: selectBlueprintStrings(blueprint.nhsPrivateComparisons, "service", sid, "nhs-private", 5),
    });
  }

  sections.push({
    type: "patientObjections",
    heading: "Common questions before booking",
    body: `These concerns are frequently raised before ${name.toLowerCase()} appointments — your pharmacist addresses them during consultation:`,
    bullets: selectBlueprintStrings(blueprint.commonPatientObjections, "service", sid, "objections", 5),
  });

  sections.push({
    type: "safetyConsiderations",
    heading: "Safety considerations",
    body: `Patient safety is central to ${name.toLowerCase()} at ${pharmacyName}. Red-flag symptoms need GP or urgent care — not routine pharmacy management alone:`,
    bullets: selectBlueprintStrings(blueprint.safetyConcerns, "service", sid, "safety", 6),
  });

  const myths = selectBlueprintMyths(blueprint, "service", sid, 5);
  if (myths.length) {
    sections.push({
      type: "mythVsFact",
      heading: "Myths versus facts",
      body: `Evidence-based ${name.toLowerCase()} advice from your pharmacy team:`,
      bullets: myths.map((m) => `Myth: ${m.myth} Fact: ${m.fact}`),
    });
  }

  const authority = selectBlueprintAuthority(blueprint, "service", sid, 5);
  if (authority.length) {
    sections.push({
      type: "authorityInsights",
      heading: "Professional standards",
      body: `${name} at ${pharmacyName} follows regulated clinical governance and NHS specifications where commissioned:`,
      bullets: authority,
    });
  }

  sections.push({
    type: "trustSafety",
    heading: "Trust and professional care",
    body: `${pharmacyName} delivers ${name.toLowerCase()} from GPhC-registered premises with confidential consultation facilities:`,
    bullets: selectBlueprintStrings(blueprint.trustTopics, "service", sid, "trust", 6),
  });

  return sections;
}

export function buildHubPageBlueprintSections(
  blueprint: ServiceBlueprint,
  pharmacyName: string,
  town: string,
): BlueprintSection[] {
  const sid = blueprint.serviceId;
  const name = blueprint.serviceName;

  const sections: BlueprintSection[] = [
    {
      type: "patientIntent",
      heading: "Why patients choose this service",
      body: `Patients across ${town} access ${name.toLowerCase()} at ${pharmacyName} for practical reasons — not as a substitute for GP care when symptoms require medical review:`,
      bullets: selectBlueprintStrings(blueprint.patientIntent, "hub", sid, "intent", 6),
    },
    {
      type: "servicePathway",
      heading: "Service pathway",
      body: `From first contact to follow-up, ${name.toLowerCase()} follows the same structured pathway at every ${pharmacyName} location:`,
      bullets: selectBlueprintStrings(blueprint.appointmentProcess, "hub", sid, "pathway", 6),
    },
    {
      type: "authorityHighlights",
      heading: "Clinical governance highlights",
      body: `Professional standards governing ${name.toLowerCase()} delivery:`,
      bullets: selectBlueprintAuthority(blueprint, "hub", sid, 6),
    },
    {
      type: "patientQuestions",
      heading: "Questions patients ask",
      body: `Before booking ${name.toLowerCase()}, patients commonly want clarity on these points:`,
      bullets: selectBlueprintStrings(blueprint.patientQuestions, "hub", sid, "questions", 8),
    },
    {
      type: "trustSafety",
      heading: "Trust and safety",
      body: `${pharmacyName} maintains professional standards for ${name.toLowerCase()} across ${town}:`,
      bullets: selectBlueprintStrings(blueprint.trustTopics, "hub", sid, "trust", 6),
    },
  ];

  const myths = selectBlueprintMyths(blueprint, "hub", sid, 4);
  if (myths.length) {
    sections.push({
      type: "mythVsFact",
      heading: "Understanding the service",
      body: `Separating common misconceptions from accurate information about ${name.toLowerCase()}:`,
      bullets: myths.map((m) => `Myth: ${m.myth} Fact: ${m.fact}`),
    });
  }

  if (blueprint.bookingBarriers.length) {
    sections.push({
      type: "bookingGuidance",
      heading: "Booking guidance",
      body: `Practical tips to help you access ${name.toLowerCase()} without delay:`,
      bullets: selectBlueprintStrings(blueprint.bookingBarriers, "hub", sid, "booking", 5).map(
        (b) => `Barrier addressed: ${b}`,
      ),
    });
  }

  return sections;
}

export function buildAreaPageBlueprintSections(
  blueprint: ServiceBlueprint,
  area: string,
  town: string,
  pharmacyName: string,
  areaSlug: string,
): BlueprintSection[] {
  const sid = blueprint.serviceId;
  const name = blueprint.serviceName;

  return [
    {
      type: "localEligibility",
      heading: `${name} eligibility for ${area} patients`,
      body: `Patients in ${area} and surrounding ${town} areas can access ${name.toLowerCase()} at ${pharmacyName} subject to individual clinical assessment:`,
      bullets: selectBlueprintStrings(blueprint.eligibilityQuestions, "area", sid, "eligibility", 5, areaSlug),
    },
    {
      type: "localAccess",
      heading: `Accessing ${name} from ${area}`,
      body: `Local patients in ${area} often ask about booking, fees and NHS eligibility before attending ${name.toLowerCase()}:`,
      bullets: [
        ...selectBlueprintStrings(blueprint.costValueQuestions, "area", sid, "cost", 3, areaSlug),
        ...selectBlueprintStrings(blueprint.bookingBarriers, "area", sid, "access", 3, areaSlug),
      ].slice(0, 6),
    },
    {
      type: "areaSuitability",
      heading: `Is ${name} right for you?`,
      body: `Suitability for ${name.toLowerCase()} depends on clinical criteria — confirmed at consultation, not assumed from online information alone:`,
      bullets: selectBlueprintStrings(blueprint.suitabilityTopics, "area", sid, "suitability", 5, areaSlug),
    },
    {
      type: "mythVsFact",
      heading: "Local service facts",
      body: `Accurate information helps ${area} patients use ${name.toLowerCase()} appropriately:`,
      bullets: selectBlueprintMyths(blueprint, "area", sid, 4, areaSlug).map(
        (m) => `Myth: ${m.myth} Fact: ${m.fact}`,
      ),
    },
  ];
}

export function mergeBlueprintFaqs(
  primary: BlueprintFaq[],
  secondary: BlueprintFaq[],
  maxCount: number,
): BlueprintFaq[] {
  const seen = new Set<string>();
  const out: BlueprintFaq[] = [];
  for (const f of [...primary, ...secondary]) {
    const key = f.question.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= maxCount) break;
  }
  return out;
}

export function blueprintRelatedServices(blueprint: ServiceBlueprint, max = 6) {
  return blueprint.relatedServices.slice(0, max);
}

export function enrichIntroFromBlueprint(intro: string, blueprint: ServiceBlueprint, kind: BlueprintPageKind): string {
  const extra = selectBlueprintStrings(blueprint.patientIntent, kind, blueprint.serviceId, "intro", 1)[0];
  if (!extra || intro.includes(extra.slice(0, 40))) return intro;
  return `${intro} ${extra}`.trim();
}
