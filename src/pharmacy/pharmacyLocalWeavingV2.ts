/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Production evidence weaving uses applyClusterIntelligence (Locality Engine V1).
 */
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import type { LocalInjectionContext } from "./pharmacyLocalNarrativeEngine.ts";

const BANNED_PHRASES = [
  /for patients travelling from/i,
  /patients travelling from/i,
  /if you are based in/i,
];

export interface WeavingMetrics {
  areaMentions: number;
  pharmacyMentions: number;
  areaInTarget: boolean;
  pharmacyInTarget: boolean;
  meetsWeavingTarget: boolean;
}

function pick<T>(items: T[], seed: string, offset = 0): T | undefined {
  if (!items.length) return undefined;
  const hash = seed.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  return items[(hash + offset) % items.length];
}

function sanitise(text: string): string {
  let out = text;
  for (const pat of BANNED_PHRASES) out = out.replace(pat, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

function countMentions(text: string, token: string): number {
  if (!token.trim()) return 0;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.toLowerCase().match(new RegExp(escaped, "gi")) || []).length;
}

function sectionIntroWeave(type: string, ctx: LocalInjectionContext): string {
  const { area, pharmacyName, topic, seed, serviceName } = ctx;
  const pools: Record<string, string[]> = {
    benefits: [
      `${pharmacyName} helps ${area} patients understand the benefits of ${topic} before they book.`,
      `For people in ${area}, ${pharmacyName} explains what ${topic} offers in practical terms.`,
      `Residents in ${area} often ask ${pharmacyName} why ${topic} matters before travel.`,
      `${area} patients booking ${serviceName.toLowerCase()} through ${pharmacyName} usually want clarity on what the service delivers.`,
    ],
    eligibility: [
      `${pharmacyName} confirms who ${topic} suits for ${area} patients after individual assessment.`,
      `Residents in ${area} can check eligibility with ${pharmacyName} before arranging ${topic}.`,
      `For ${area} households, ${pharmacyName} reviews medical history and travel plans to confirm suitability.`,
      `People in ${area} often contact ${pharmacyName} first to ask whether ${topic} applies to them.`,
    ],
    preparationGuide: [
      `${area} patients visiting ${pharmacyName} for ${topic} should prepare the following before their appointment.`,
      `Before your ${topic} consultation at ${pharmacyName}, ${area} residents should gather the items below.`,
      `${pharmacyName} recommends ${area} patients bring the following when preparing for ${topic}.`,
      `If you are in ${area} and booking ${topic} with ${pharmacyName}, preparing these details helps the consultation run smoothly.`,
    ],
  };
  return sanitise(pick(pools[type] || [], `${seed}-weave-${type}`) || "");
}

export function weaveSectionIntroduction(
  section: { type: string; heading: string; body: string; bullets?: string[] },
  ctx: LocalInjectionContext,
): { type: string; heading: string; body: string; bullets?: string[] } {
  const weaveTypes = new Set(["benefits", "eligibility", "preparationGuide"]);
  if (!weaveTypes.has(section.type)) return section;

  const intro = sectionIntroWeave(section.type, ctx);
  if (!intro) return section;

  const bodyLower = section.body.toLowerCase();
  if (bodyLower.startsWith(intro.toLowerCase().slice(0, 40))) return section;

  return { ...section, body: sanitise(`${intro} ${section.body}`) };
}

export function weaveSections(
  sections: Array<{ type: string; heading: string; body: string; bullets?: string[] }>,
  ctx: LocalInjectionContext,
): Array<{ type: string; heading: string; body: string; bullets?: string[] }> {
  assertLegacyContentEngineAllowed("pharmacyLocalWeavingV2", "weaveSections");
  return sections.map((s) => weaveSectionIntroduction(s, ctx));
}

export function weaveFAQOpeningSentence(
  faq: { question: string; answer: string },
  index: number,
  ctx: LocalInjectionContext,
): { question: string; answer: string } {
  if (index === 0) return { ...faq, answer: sanitise(faq.answer) };

  const { area, pharmacyName, areaSlug, topic } = ctx;
  const openers = [
    `Patients in ${area} often ask ${pharmacyName} about this before booking ${topic}.`,
    `${pharmacyName} hears this question frequently from ${area} residents.`,
    `For people in ${area}, ${pharmacyName} explains the following about this topic.`,
    `Residents in ${area} planning ${topic} with ${pharmacyName} often want to know the following.`,
    `At ${pharmacyName}, ${area} patients commonly ask about this during consultation.`,
    `Before booking ${topic}, ${area} patients often discuss this with ${pharmacyName}.`,
  ];

  const opener = pick(openers, `${areaSlug}-weave-faq-${index}`) || openers[0];
  const base = sanitise(String(faq.answer || ""));
  if (base.toLowerCase().startsWith(opener.toLowerCase().slice(0, 30))) {
    return { question: faq.question, answer: base };
  }
  return { question: faq.question, answer: sanitise(`${opener} ${base}`) };
}

export function weaveFAQOpenings(
  faqs: Array<{ question: string; answer: string }>,
  ctx: LocalInjectionContext,
  weaveCount = 4,
): Array<{ question: string; answer: string }> {
  assertLegacyContentEngineAllowed("pharmacyLocalWeavingV2", "weaveFAQOpenings");
  return faqs.map((f, i) => {
    if (i > weaveCount) return { ...f, answer: sanitise(f.answer) };
    return weaveFAQOpeningSentence(f, i, ctx);
  });
}

export function weaveCTASupporting(ctx: LocalInjectionContext): {
  phonePrompt: string;
  bookingPrompt: string;
  primary: string;
  secondary: string;
} {
  const { area, pharmacyName, town, topic, seed } = ctx;
  const variants = [
    {
      primary: "Book Consultation",
      secondary: "Speak To A Pharmacist",
      phonePrompt: `${pharmacyName} in ${town} welcomes enquiries from ${area} — call to discuss ${topic}.`,
      bookingPrompt: `Book ${topic} through ${pharmacyName} if you live in ${area}.`,
    },
    {
      primary: "Call Today",
      secondary: "Request Advice",
      phonePrompt: `Speak to ${pharmacyName} about ${topic} — ${area} patients can call for availability and guidance.`,
      bookingPrompt: `${pharmacyName} can arrange ${topic} for ${area} residents — request advice or booking support online or by phone.`,
    },
    {
      primary: "Get Advice",
      secondary: "Book Appointment",
      phonePrompt: `Contact ${pharmacyName} in ${town}. The team supports ${area} patients with ${topic} questions every week.`,
      bookingPrompt: `Arrange ${topic} at ${pharmacyName} — convenient for ${area} and surrounding ${town} communities.`,
    },
  ];
  return pick(variants, `${seed}-weave-cta`) || variants[0];
}

/** Measure weaving outside the dedicated localNarrative section. */
export function measureLocalWeaving(
  page: {
    sections?: Array<{ type?: string; body?: string }>;
    faqs?: Array<{ answer?: string }>;
    cta?: { phonePrompt?: string; bookingPrompt?: string };
  },
  ctx: LocalInjectionContext,
): WeavingMetrics {
  const weaveTypes = new Set(["benefits", "eligibility", "preparationGuide"]);
  const wovenTexts = [
    ...(page.sections || []).filter((s) => s.type && weaveTypes.has(s.type)).map((s) => s.body || ""),
    ...(page.faqs || []).slice(0, 5).map((f) => f.answer || ""),
    page.cta?.phonePrompt || "",
    page.cta?.bookingPrompt || "",
  ];

  const hay = wovenTexts.join(" ");
  const areaMentions = countMentions(hay, ctx.area);
  const pharmacyMentions = countMentions(hay, ctx.pharmacyName);

  const areaInTarget = areaMentions >= 2 && areaMentions <= 4;
  const pharmacyInTarget = pharmacyMentions >= 2 && pharmacyMentions <= 3;

  return {
    areaMentions,
    pharmacyMentions,
    areaInTarget,
    pharmacyInTarget,
    meetsWeavingTarget: areaInTarget && pharmacyInTarget,
  };
}

export function pageWithoutLocalNarrative(page: {
  intro?: string;
  sections?: Array<{ type?: string; heading?: string; body?: string; bullets?: string[] }>;
  faqs?: Array<{ question?: string; answer?: string }>;
  cta?: { phonePrompt?: string; bookingPrompt?: string };
}) {
  return {
    ...page,
    sections: (page.sections || []).filter((s) => s.type !== "localNarrative"),
  };
}
