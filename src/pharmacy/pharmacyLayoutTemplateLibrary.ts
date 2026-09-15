/**
 * Pharmacy Layout Template Library V1 — area page section ordering.
 * Every template preserves hero (localServiceIntro), localContext, FAQ and CTA slots.
 */
export interface AreaLayoutTemplate {
  id: string;
  name: string;
  /** Clinical section types in render order (local blocks inserted separately). */
  clinicalOrder: string[];
  /** Insert localNarrative after this clinical type (or "start" / "end"). */
  narrativeAfter: string;
  /** Insert localContext immediately after localNarrative. */
  contextAfterNarrative: true;
  /** Optional deep-dive / comparison slots — included when variants exist. */
  optionalSlots?: string[];
}

export const AREA_LAYOUT_TEMPLATES: AreaLayoutTemplate[] = [
  {
    id: "classic-clinical",
    name: "Classic Clinical Flow",
    clinicalOrder: [
      "problem",
      "benefits",
      "eligibility",
      "howItWorks",
      "preparationGuide",
      "patientOutcomes",
      "trustSafety",
      "patientEducation",
      "mythVsFact",
    ],
    narrativeAfter: "benefits",
    contextAfterNarrative: true,
  },
  {
    id: "process-first",
    name: "Process First",
    clinicalOrder: [
      "problem",
      "howItWorks",
      "eligibility",
      "preparationGuide",
      "benefits",
      "patientOutcomes",
      "trustSafety",
      "mythVsFact",
      "patientEducation",
    ],
    narrativeAfter: "howItWorks",
    contextAfterNarrative: true,
  },
  {
    id: "eligibility-led",
    name: "Eligibility Led",
    clinicalOrder: [
      "problem",
      "eligibility",
      "benefits",
      "preparationGuide",
      "howItWorks",
      "trustSafety",
      "patientOutcomes",
      "patientEducation",
      "mythVsFact",
    ],
    narrativeAfter: "eligibility",
    contextAfterNarrative: true,
  },
  {
    id: "education-forward",
    name: "Education Forward",
    clinicalOrder: [
      "problem",
      "patientEducation",
      "benefits",
      "eligibility",
      "howItWorks",
      "preparationGuide",
      "mythVsFact",
      "trustSafety",
      "patientOutcomes",
    ],
    narrativeAfter: "patientEducation",
    contextAfterNarrative: true,
  },
  {
    id: "trust-forward",
    name: "Trust Forward",
    clinicalOrder: [
      "problem",
      "trustSafety",
      "benefits",
      "eligibility",
      "howItWorks",
      "preparationGuide",
      "mythVsFact",
      "patientEducation",
      "patientOutcomes",
    ],
    narrativeAfter: "trustSafety",
    contextAfterNarrative: true,
  },
  {
    id: "preparation-led",
    name: "Preparation Led",
    clinicalOrder: [
      "problem",
      "preparationGuide",
      "eligibility",
      "howItWorks",
      "benefits",
      "patientOutcomes",
      "trustSafety",
      "patientEducation",
      "mythVsFact",
    ],
    narrativeAfter: "preparationGuide",
    contextAfterNarrative: true,
  },
  {
    id: "outcomes-focused",
    name: "Outcomes Focused",
    clinicalOrder: [
      "problem",
      "benefits",
      "howItWorks",
      "patientOutcomes",
      "eligibility",
      "preparationGuide",
      "trustSafety",
      "mythVsFact",
      "patientEducation",
    ],
    narrativeAfter: "patientOutcomes",
    contextAfterNarrative: true,
  },
  {
    id: "myth-fact-mid",
    name: "Myth Fact Mid Flow",
    clinicalOrder: [
      "problem",
      "benefits",
      "eligibility",
      "mythVsFact",
      "howItWorks",
      "preparationGuide",
      "trustSafety",
      "patientEducation",
      "patientOutcomes",
    ],
    narrativeAfter: "mythVsFact",
    contextAfterNarrative: true,
  },
];

export function hashSeed(...parts: string[]): number {
  return parts.join("|").split("").reduce((n, c) => n + c.charCodeAt(0), 0);
}

export function selectLayoutTemplate(serviceId: string, areaSlug: string): AreaLayoutTemplate {
  const idx = hashSeed(serviceId, areaSlug, "layout") % AREA_LAYOUT_TEMPLATES.length;
  return AREA_LAYOUT_TEMPLATES[idx];
}

export function buildLayoutTemplatesIndex() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    templateCount: AREA_LAYOUT_TEMPLATES.length,
    templates: AREA_LAYOUT_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      clinicalOrder: t.clinicalOrder,
      narrativeAfter: t.narrativeAfter,
    })),
  };
}

type AreaSection = { type: string; heading: string; body: string; bullets?: string[] };

export function assembleAreaSections(input: {
  layout: AreaLayoutTemplate;
  localServiceIntro: AreaSection;
  sectionMap: Record<string, AreaSection>;
  localNarrative: AreaSection;
  localContext: AreaSection;
  tail: AreaSection[];
}): AreaSection[] {
  const clinical: AreaSection[] = [];
  for (const type of input.layout.clinicalOrder) {
    const section = input.sectionMap[type];
    if (section) clinical.push(section);
  }
  for (const type of input.layout.optionalSlots || []) {
    const section = input.sectionMap[type];
    if (section && !clinical.some((s) => s.type === type)) clinical.push(section);
  }

  const out: AreaSection[] = [input.localServiceIntro];
  const anchor = input.layout.narrativeAfter;
  let inserted = false;

  if (anchor === "start") {
    out.push(input.localNarrative, input.localContext, ...clinical);
    inserted = true;
  } else if (anchor === "end") {
    out.push(...clinical, input.localNarrative, input.localContext);
    inserted = true;
  } else {
    for (const section of clinical) {
      out.push(section);
      if (!inserted && section.type === anchor) {
        out.push(input.localNarrative, input.localContext);
        inserted = true;
      }
    }
    if (!inserted) {
      out.push(input.localNarrative, input.localContext);
    }
  }

  return [...out, ...input.tail.filter(Boolean)];
}
