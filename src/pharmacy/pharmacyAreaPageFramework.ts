/**
 * Pharmacy Service Area Page Publish Framework V1 —
 * Local pages reuse master service framework content with natural area context.
 */
import type { GeneratedServicePage, ServicePageFaq, ServicePageSection } from "./pharmacyServicePageGenerator.ts";
import { ensureCompleteSentence, publishMetaDescription, stripBlueprintLabels } from "./pharmacySafeText.ts";

export const AREA_FRAMEWORK_SECTION_ORDER = [
  "localServiceIntro",
  "howItWorks",
  "eligibility",
  "preparationGuide",
  "scope",
  "mythVsFact",
  "localAccess",
] as const;

const MASTER_SCOPE_TYPES = new Set(["conditionsCovered", "benefits", "patientOutcomes"]);

const ALLOWED_MASTER_TYPES = new Set([
  "howItWorks",
  "eligibility",
  "preparationGuide",
  "mythVsFact",
  "conditionsCovered",
  "benefits",
  "patientOutcomes",
]);

export interface AreaFrameworkContext {
  serviceId: string;
  serviceName: string;
  pharmacyName: string;
  town: string;
  area: string;
  areaSlug: string;
}

export function usesAreaPublishFramework(_serviceId?: string): boolean {
  return true;
}

function weaveArea(text: string, area: string, town: string, pharmacyName: string): string {
  let t = stripBlueprintLabels(text).trim();
  if (!t.toLowerCase().includes(area.toLowerCase())) {
    t = t.replace(/\.$/, "");
    t = `${t} — relevant for patients travelling from ${area} in ${town}.`;
  }
  if (!t.toLowerCase().includes(pharmacyName.toLowerCase()) && t.length < 220) {
    t = `${t} ${pharmacyName} serves ${area} with the same clinical pathway as our main ${town} pharmacy.`;
  }
  return ensureCompleteSentence(t);
}

function adaptSection(
  section: ServicePageSection,
  ctx: AreaFrameworkContext,
  targetType?: string,
): ServicePageSection {
  return {
    type: targetType || section.type,
    heading: section.heading,
    body: weaveArea(section.body || "", ctx.area, ctx.town, ctx.pharmacyName),
    bullets: (section.bullets || []).map((b) => {
      if (b.includes(":")) return b;
      return `${b}: Available at ${ctx.pharmacyName} for ${ctx.area} patients following the standard ${ctx.serviceName.toLowerCase()} pathway.`;
    }),
  };
}

function buildLocalIntro(ctx: AreaFrameworkContext, master: GeneratedServicePage): ServicePageSection {
  const problem = master.sections.find((s) => s.type === "problem");
  const body = ensureCompleteSentence(
    `${ctx.pharmacyName} provides ${ctx.serviceName.toLowerCase()} for patients in ${ctx.area}, ${ctx.town}. ` +
      `${stripBlueprintLabels(problem?.body || master.intro).split(".").slice(0, 1).join(".")}.`,
  );
  return {
    type: "localServiceIntro",
    heading: `${ctx.serviceName} in ${ctx.area}`,
    body,
    bullets: (problem?.bullets || []).slice(0, 2),
  };
}

function buildLocalAccess(ctx: AreaFrameworkContext, nearbyAreas: string[]): ServicePageSection {
  const nearby =
    nearbyAreas.length > 0
      ? `Patients also travel from ${nearbyAreas.slice(0, 2).join(" and ")} — each area has its own dedicated page.`
      : "";
  return {
    type: "localAccess",
    heading: `Access From ${ctx.area}`,
    body: ensureCompleteSentence(
      `${ctx.pharmacyName} in ${ctx.town} is accessible from ${ctx.area}. ${nearby} Book or call ahead so the team can confirm appointment times and anything to bring for ${ctx.serviceName.toLowerCase()}.`,
    ),
    bullets: [
      `Getting here: Plan your journey from ${ctx.area} to ${ctx.pharmacyName} in ${ctx.town} — ask about parking or public transport when you book.`,
      `Same-day access: Call ${ctx.pharmacyName} to check walk-in or same-day ${ctx.serviceName.toLowerCase()} availability from ${ctx.area}.`,
      `Clinical standards: ${ctx.area} patients receive the same ${ctx.serviceName.toLowerCase()} pathway and safety-netting as every ${ctx.town} neighbourhood page.`,
    ],
  };
}

function buildAreaFaqs(ctx: AreaFrameworkContext, masterFaqs: ServicePageFaq[]): ServicePageFaq[] {
  const areaSpecific: ServicePageFaq[] = [
    {
      question: `Can I get ${ctx.serviceName.toLowerCase()} if I live in ${ctx.area}?`,
      answer: `Yes — ${ctx.pharmacyName} provides ${ctx.serviceName.toLowerCase()} for ${ctx.area} patients in ${ctx.town}. Eligibility is confirmed at consultation using the same clinical criteria as our main service page.`,
    },
    {
      question: `How do I book ${ctx.serviceName.toLowerCase()} from ${ctx.area}?`,
      answer: `Call ${ctx.pharmacyName} or use online booking if available. Mention you are coming from ${ctx.area} so the team allows appropriate time and confirms anything to bring.`,
    },
  ];

  const fromMaster = masterFaqs.slice(0, 6).map((f) => ({
    question: f.question,
    answer: weaveArea(f.answer, ctx.area, ctx.town, ctx.pharmacyName),
  }));

  const seen = new Set<string>();
  const out: ServicePageFaq[] = [];
  for (const f of [...areaSpecific, ...fromMaster]) {
    const k = f.question.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
    if (out.length >= 8) break;
  }
  return out;
}

export function buildAreaFrameworkSections(
  ctx: AreaFrameworkContext,
  master: GeneratedServicePage,
  nearbyAreas: string[],
): ServicePageSection[] {
  const sections: ServicePageSection[] = [buildLocalIntro(ctx, master)];

  for (const type of ["howItWorks", "eligibility", "preparationGuide"] as const) {
    const src = master.sections.find((s) => s.type === type);
    if (src) sections.push(adaptSection(src, ctx));
  }

  const scope =
    master.sections.find((s) => MASTER_SCOPE_TYPES.has(s.type) && s.bullets.length > 0) ||
    master.sections.find((s) => MASTER_SCOPE_TYPES.has(s.type));
  if (scope) {
    sections.push(adaptSection(scope, ctx, scope.type === "patientOutcomes" ? "patientOutcomes" : scope.type));
  }

  const myth = master.sections.find((s) => s.type === "mythVsFact");
  if (myth) sections.push(adaptSection(myth, ctx));

  sections.push(buildLocalAccess(ctx, nearbyAreas));
  return sections;
}

export function applyAreaFramework(input: {
  ctx: AreaFrameworkContext;
  master: GeneratedServicePage;
  nearbyAreas: string[];
}): {
  intro: string;
  metaDescription: string;
  sections: ServicePageSection[];
  faqs: ServicePageFaq[];
} {
  const { ctx, master, nearbyAreas } = input;
  const intro = ensureCompleteSentence(
    `${ctx.pharmacyName} provides ${ctx.serviceName.toLowerCase()} for patients in ${ctx.area}, ${ctx.town}. ` +
      `${stripBlueprintLabels(master.intro).split(".").slice(0, 2).join(".")}.`,
  );
  const metaDescription = publishMetaDescription(
    `${ctx.serviceName} in ${ctx.area}, ${ctx.town} — ${ctx.pharmacyName} local access, booking and clinical guidance.`,
  );

  return {
    intro,
    metaDescription,
    sections: buildAreaFrameworkSections(ctx, master, nearbyAreas),
    faqs: buildAreaFaqs(ctx, master.faqs),
  };
}
