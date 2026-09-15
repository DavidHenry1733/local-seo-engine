/**
 * Pharmacy Service Publish Framework V1 —
 * Reusable section structure for all service pages.
 * Hand-curated specs override framework for benchmark services.
 */
import type { ServicePageFaq, ServicePageSection } from "./pharmacyServicePageGenerator.ts";
import type { ServiceAuthorityProfile } from "./pharmacyServiceAuthorityService.ts";
import type { ServiceExpertiseProfile } from "./pharmacyServiceExpertiseService.ts";
import type { ServiceIntelligenceProfile } from "./pharmacyServiceIntelligenceService.ts";
import { publishMetaDescription } from "./pharmacySafeText.ts";
import {
  applyGoldStandardToServicePage,
  getGoldStandardSpec,
  isGoldStandardService,
  type GoldStandardContext,
} from "./pharmacyServiceGoldStandard.ts";

export const HAND_CURATED_SERVICE_IDS = isGoldStandardService;

export interface PublishFrameworkContext {
  serviceId: string;
  serviceName: string;
  pharmacyName: string;
  town: string;
}

export interface PublishFrameworkInput extends PublishFrameworkContext {
  intro: string;
  metaDescription: string;
  faqs: ServicePageFaq[];
  sections: ServicePageSection[];
  intel: ServiceIntelligenceProfile;
  expertise: ServiceExpertiseProfile | null;
  authority: ServiceAuthorityProfile | null;
}

/** Standard publish section order by service category. */
export const FRAMEWORK_SECTION_ORDER: Record<string, string[]> = {
  "nhs-clinical": ["problem", "conditionsCovered", "howItWorks", "eligibility", "preparationGuide", "mythVsFact"],
  "core-pharmacy": ["problem", "howItWorks", "benefits", "eligibility", "preparationGuide"],
  "private-clinical": ["problem", "benefits", "howItWorks", "eligibility", "preparationGuide", "mythVsFact"],
  specialist: ["problem", "benefits", "howItWorks", "eligibility", "preparationGuide", "mythVsFact"],
};

export const PUBLISH_FRAMEWORK_SPEC = {
  requiredSections: [
    "hero",
    "problem",
    "scope (conditionsCovered | benefits)",
    "howItWorks",
    "eligibility",
    "preparationGuide (where relevant)",
    "mythVsFact (where relevant)",
    "trust layer (publish chrome)",
    "faqs",
    "cta",
  ],
  maxCoreSections: 8,
  faqCount: "6–8 direct patient questions",
  removedSectionTypes: [
    "deepDive",
    "serviceOverview",
    "aftercare",
    "patientObjections",
    "authorityInsights",
    "trustSafety",
    "conversionReassurance",
    "relatedTopics",
    "comparison",
    "localExpansion",
    "patientEducation (heading-only)",
  ],
} as const;

export function usesPublishFramework(_serviceId?: string): boolean {
  return true;
}

function cleanIntelText(text: string): string {
  return String(text || "")
    .replace(/\b(?:local area|near me|pharmacy \w+ local area)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isSeoNoise(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("near me") ||
    t.includes("local area") ||
    t.includes("service specification covers") ||
    /\bnhs \w+ pharmacy\b/.test(t) ||
    t.length < 12
  );
}

function toCardBullet(title: string, body: string): string {
  const t = title.replace(/[.:]+$/, "").trim();
  let b = cleanIntelText(body);
  if (!b.endsWith(".")) b += ".";
  if (/^[a-z]/.test(b)) b = b.charAt(0).toUpperCase() + b.slice(1);
  return `${t}: ${b}`;
}

function pickClean(items: string[], count: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const t = cleanIntelText(raw);
    if (!t || isSeoNoise(t)) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= count) break;
  }
  return out;
}

function cardFromFeature(feature: string, pharmacy: string, town: string, serviceLower: string): string {
  const f = cleanIntelText(feature);
  const short = f.length <= 48 ? f : f.slice(0, 45).replace(/\s+\S*$/, "");
  const body =
    f.length > 48
      ? f
      : `${pharmacy} delivers this as part of ${serviceLower} in ${town}, following professional pharmacy standards and clear patient counselling.`;
  return toCardBullet(short, body);
}

function cardFromPatientGroup(group: string, serviceName: string): string {
  const g = cleanIntelText(group);
  const title = g.length <= 40 ? g : g.slice(0, 38).replace(/\s+\S*$/, "");
  return toCardBullet(
    title,
    `${g} may benefit from ${serviceName.toLowerCase()} — suitability is confirmed individually at consultation rather than assumed from online information.`,
  );
}

function buildFrameworkIntro(ctx: PublishFrameworkContext, intel: ServiceIntelligenceProfile): string {
  const p = ctx.pharmacyName;
  const t = ctx.town;
  const desc = cleanIntelText(intel.description);
  return `${p} offers ${ctx.serviceName.toLowerCase()} in ${t}. ${desc.charAt(0).toUpperCase()}${desc.slice(1)} A pharmacist explains eligibility, what to expect and next steps before any supply or referral.`;
}

function buildFrameworkMeta(ctx: PublishFrameworkContext, intel: ServiceIntelligenceProfile): string {
  return publishMetaDescription(
    `${ctx.serviceName} at ${ctx.pharmacyName}, ${ctx.town} — ${cleanIntelText(intel.description)}`,
  );
}

function buildProblemSection(
  ctx: PublishFrameworkContext,
  intel: ServiceIntelligenceProfile,
  expertise: ServiceExpertiseProfile | null,
): { heading: string; body: string; bullets: string[] } {
  const p = ctx.pharmacyName;
  const explanation =
    cleanIntelText(expertise?.serviceExplanations.find((e) => e.length > 40 && !isSeoNoise(e)) || "") ||
    cleanIntelText(intel.description);
  const benefits = pickClean(intel.patientBenefits, 2);
  return {
    heading: `What Is ${ctx.serviceName}?`,
    body: `${explanation} At ${p}, consultations take place with a registered pharmacist who assesses suitability, provides advice and refers to GP or urgent care when needed.`,
    bullets: benefits.map((b) => toCardBullet(b.split(/[.–-]/)[0].trim().slice(0, 36), b)),
  };
}

function buildScopeSection(
  ctx: PublishFrameworkContext,
  intel: ServiceIntelligenceProfile,
  type: "conditionsCovered" | "benefits",
): { heading: string; body: string; bullets: string[] } {
  const p = ctx.pharmacyName;
  const t = ctx.town;
  const lower = ctx.serviceName.toLowerCase();
  const features = pickClean(intel.serviceFeatures, type === "conditionsCovered" ? 6 : 4);
  const heading =
    type === "conditionsCovered" ? "Conditions We Can Help With" : "What You Can Expect";
  const body =
    type === "conditionsCovered"
      ? `The pharmacist assesses your presentation against clinical and NHS pathway criteria. If care falls outside pharmacy scope, you receive clear referral advice.`
      : `${ctx.serviceName} at ${p} follows a structured clinical pathway with patient safety at the centre.`;
  const bullets = features.map((f) => cardFromFeature(f, p, t, lower));
  return { heading, body, bullets };
}

function buildEligibilitySection(
  ctx: PublishFrameworkContext,
  intel: ServiceIntelligenceProfile,
  authority: ServiceAuthorityProfile | null,
): { heading: string; body: string; bullets: string[] } {
  const seek = pickClean(authority?.whenToSeekAdvice || [], 2);
  const groups = pickClean(intel.idealPatients, 4);
  const bullets = [
    ...groups.map((g) => cardFromPatientGroup(g, ctx.serviceName)),
    ...seek.map((s) => toCardBullet("When to seek GP care", s)),
  ].slice(0, 4);
  return {
    heading: "Who This Service Is For",
    body: `${ctx.serviceName} suits many patients in ${ctx.town}, but eligibility depends on individual assessment. Your pharmacist will advise honestly if GP or urgent care is more appropriate.`,
    bullets,
  };
}

function buildPreparationSection(
  ctx: PublishFrameworkContext,
  expertise: ServiceExpertiseProfile | null,
): { heading: string; body: string; bullets: string[] } {
  const topics = pickClean(expertise?.consultationTopics || [], 4);
  const bullets =
    topics.length >= 3
      ? topics.map((topic) =>
          toCardBullet(
            topic,
            `Have this information ready for your ${ctx.serviceName.toLowerCase()} appointment at ${ctx.pharmacyName} so the pharmacist can assess safely.`,
          ),
        )
      : [
          toCardBullet(
            "Medicines list",
            `Bring current medicines and allergy history to ${ctx.pharmacyName} so the pharmacist can check interactions before any supply.`,
          ),
          toCardBullet(
            "Questions ready",
            `Note your symptoms, concerns and when they started to help the pharmacist triage ${ctx.serviceName.toLowerCase()} appropriately.`,
          ),
          toCardBullet(
            "Booking details",
            `Call ${ctx.pharmacyName} to confirm appointment length, NHS eligibility and anything specific to bring for ${ctx.serviceName.toLowerCase()}.`,
          ),
        ];
  return {
    heading: "Before Your Appointment",
    body: `A few minutes of preparation helps your pharmacist give accurate advice at ${ctx.pharmacyName}.`,
    bullets: bullets.slice(0, 4),
  };
}

function buildMythSection(expertise: ServiceExpertiseProfile | null): { heading: string; body: string; bullets: string[] } {
  const mistakes = pickClean(expertise?.commonMistakes || [], 4);
  const bullets = mistakes.map((m) => {
    const myth = m.replace(/\.$/, "");
    const fact =
      myth.toLowerCase().includes("every")
        ? "Services vary by pharmacy commissioning — confirm availability and scope at consultation."
        : myth.toLowerCase().includes("delay")
          ? "Seek GP, NHS 111 or urgent care if symptoms worsen — pharmacy care complements but does not replace emergency assessment."
          : "The pharmacist confirms eligibility and scope during a structured consultation before any supply.";
    return `Myth: ${myth}. Fact: ${fact}`;
  });
  return {
    heading: "Common questions — myths and facts",
    body: "Clear information helps you use pharmacy services safely.",
    bullets: bullets.length ? bullets : [
      "Myth: Every pharmacy offers every service. Fact: Availability depends on local NHS commissioning and clinical scope — confirm with the pharmacy before attending.",
      "Myth: Pharmacy care replaces your GP. Fact: Pharmacists complement GP care and refer clearly when symptoms fall outside pharmacy scope.",
    ],
  };
}

function normalizeQuestion(q: string, serviceName: string): string {
  let t = cleanIntelText(q).replace(/\?+$/, "").trim();
  t = t.replace(new RegExp(serviceName, "gi"), serviceName);
  if (!t.endsWith("?")) t += "?";
  return t;
}

function scoreFaqQuestion(q: string): number {
  const t = q.toLowerCase();
  let score = 10;
  if (isSeoNoise(q)) score -= 8;
  if (t.includes("service specification")) score -= 6;
  if (t.includes("what is") && t.includes("and who")) score -= 2;
  if (t.length > 90) score -= 3;
  if (t.length < 20) score -= 2;
  return score;
}

function buildFrameworkFaqs(
  ctx: PublishFrameworkContext,
  intel: ServiceIntelligenceProfile,
  expertise: ServiceExpertiseProfile | null,
  authority: ServiceAuthorityProfile | null,
  answerFn: (question: string) => string,
): ServicePageFaq[] {
  const pool = [
    ...(expertise?.patientConcerns || []),
    ...intel.commonQuestions,
    ...(authority?.patientQuestionsWeOftenHear || []),
  ]
    .map((q) => normalizeQuestion(q, ctx.serviceName))
    .filter((q) => scoreFaqQuestion(q) >= 4);

  const seen = new Set<string>();
  const selected: string[] = [];
  for (const q of pool) {
    const k = q.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    selected.push(q);
    if (selected.length >= 8) break;
  }

  const defaults = [
    `Is ${ctx.serviceName} free on the NHS?`,
    `Do I need an appointment for ${ctx.serviceName}?`,
    `Who is eligible for ${ctx.serviceName}?`,
    `How long does a ${ctx.serviceName.toLowerCase()} appointment take?`,
    `Can I get ${ctx.serviceName} at ${ctx.pharmacyName}?`,
  ];
  for (const q of defaults) {
    if (selected.length >= 8) break;
    const n = normalizeQuestion(q, ctx.serviceName);
    if (!seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      selected.push(n);
    }
  }

  return selected.slice(0, 8).map((question) => ({
    question,
    answer: answerFn(question),
  }));
}

function buildFrameworkSections(
  ctx: PublishFrameworkContext,
  intel: ServiceIntelligenceProfile,
  expertise: ServiceExpertiseProfile | null,
  authority: ServiceAuthorityProfile | null,
  existing: ServicePageSection[],
): ServicePageSection[] {
  const order = FRAMEWORK_SECTION_ORDER[intel.category] || FRAMEWORK_SECTION_ORDER["nhs-clinical"];
  const hero = existing.find((s) => s.type === "hero");
  const cta = existing.find((s) => s.type === "cta");
  const scopeType = order.includes("conditionsCovered") ? "conditionsCovered" : "benefits";

  const sectionBuilders: Record<string, () => { heading: string; body: string; bullets: string[] }> = {
    problem: () => buildProblemSection(ctx, intel, expertise),
    conditionsCovered: () => buildScopeSection(ctx, intel, "conditionsCovered"),
    benefits: () => buildScopeSection(ctx, intel, "benefits"),
    eligibility: () => buildEligibilitySection(ctx, intel, authority),
    preparationGuide: () => buildPreparationSection(ctx, expertise),
    mythVsFact: () => buildMythSection(expertise),
  };

  const curated: ServicePageSection[] = [];
  if (hero) curated.push(hero);

  for (const type of order) {
    if (type === "howItWorks") {
      curated.push({
        type: "howItWorks",
        heading: `How ${ctx.serviceName} Works`,
        body: `At ${ctx.pharmacyName}, your appointment follows a clear clinical pathway from assessment through to advice, supply or referral.`,
        bullets: [],
      });
      continue;
    }
    const builder = sectionBuilders[type];
    if (!builder) continue;
    if (type === "conditionsCovered" && scopeType !== "conditionsCovered") continue;
    if (type === "benefits" && scopeType !== "benefits") continue;
    const src = builder();
    curated.push({ type, heading: src.heading, body: src.body, bullets: src.bullets });
  }

  if (cta) curated.push(cta);
  return curated;
}

export function applyPublishFrameworkToServicePage(input: PublishFrameworkInput): {
  intro: string;
  metaDescription: string;
  faqs: ServicePageFaq[];
  sections: ServicePageSection[];
} {
  if (isGoldStandardService(input.serviceId)) {
    return applyGoldStandardToServicePage(input);
  }

  const ctx: PublishFrameworkContext = {
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    pharmacyName: input.pharmacyName,
    town: input.town,
  };

  const intro = buildFrameworkIntro(ctx, input.intel);
  const metaDescription = buildFrameworkMeta(ctx, input.intel);
  const faqs = buildFrameworkFaqs(
    ctx,
    input.intel,
    input.expertise,
    input.authority,
    (question) => {
      const existing = input.faqs.find((f) => f.question.toLowerCase() === question.toLowerCase());
      if (existing && existing.answer && existing.answer.length > 40 && !existing.answer.includes("relates to")) {
        return existing.answer;
      }
      const fallback = input.faqs.find((f) =>
        question.toLowerCase().includes(f.question.toLowerCase().slice(0, 20)),
      );
      return fallback?.answer || input.faqs[0]?.answer || `${input.pharmacyName} answers this during your ${input.serviceName.toLowerCase()} consultation in ${input.town}.`;
    },
  );

  return {
    intro,
    metaDescription,
    faqs,
    sections: buildFrameworkSections(ctx, input.intel, input.expertise, input.authority, input.sections),
  };
}

export function getHandCuratedSpec(ctx: GoldStandardContext) {
  return getGoldStandardSpec(ctx);
}
