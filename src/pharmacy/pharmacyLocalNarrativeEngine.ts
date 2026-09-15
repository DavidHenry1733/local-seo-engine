/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Production locality narrative uses Content Engine V1 (composeCommercialClusterNarrativeV1).
 */
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import { entityDisplayName, type ScoredLocalEntity } from "./localRelevanceScoring.ts";

export interface LocalRelevancePackInput {
  area: string;
  areaSlug: string;
  town: string;
  topHealthcare?: ScoredLocalEntity[];
  topCommunity?: ScoredLocalEntity[];
  topLandmarks?: ScoredLocalEntity[];
  healthcare?: ScoredLocalEntity[];
  community?: ScoredLocalEntity[];
}

export interface LocalNarrativeInput {
  pack: LocalRelevancePackInput;
  serviceId: string;
  serviceName: string;
  area: string;
  town: string;
  pharmacyName: string;
  nearbyAreas?: string[];
}

export interface LocalNarrativeSection {
  type: "localNarrative";
  heading: string;
  body: string;
  bullets: string[];
}

export interface LocalInjectionContext {
  seed: string;
  area: string;
  areaSlug: string;
  town: string;
  pharmacyName: string;
  serviceId: string;
  serviceName: string;
  topic: string;
  hcName: string | null;
  commName: string | null;
  nearbyAreas: string[];
}

export interface LocalNarrativeOutput {
  areaSummary: string;
  healthcareContext: string;
  communityContext: string;
  serviceSpecificLocalAngle: string;
  localNarrativeSection: LocalNarrativeSection;
  localisedIntro: string;
  localisedCTA: {
    phonePrompt: string;
    bookingPrompt: string;
    primary: string;
    secondary: string;
  };
  localisedFAQOpeners: string[];
  injectionContext: LocalInjectionContext;
  localReferenceCount: number;
  localReferencesUsed: string[];
}

const PHARMACY_PATTERN = /pharmacy|chemist|boots|rowlands|lloyds|superdrug|asda pharmacy/i;
const BANNED_PHRASES = [
  /for patients travelling from/i,
  /patients travelling from/i,
  /if you are based in/i,
  /travelling from \w+/i,
];

const REF_MIN = 8;
const REF_MAX = 12;

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

function isSafeEntity(entity?: ScoredLocalEntity | null): entity is ScoredLocalEntity {
  if (!entity?.name?.trim()) return false;
  const hay = `${entity.name} ${entity.address || ""}`;
  return !PHARMACY_PATTERN.test(hay);
}

function preferAreaNamed(entities: ScoredLocalEntity[], area: string): ScoredLocalEntity | null {
  const areaLower = area.toLowerCase();
  const safe = entities.filter(isSafeEntity);
  return safe.find((e) => e.name.toLowerCase().includes(areaLower)) || safe[0] || null;
}

export function serviceTopic(serviceId: string, serviceName: string): string {
  const map: Record<string, string> = {
    "travel-vaccinations": "travel vaccinations",
    "travel-health-consultations": "travel health consultations",
    "blood-pressure-checks": "blood pressure monitoring",
    "repeat-prescriptions": "repeat prescriptions",
    "prescription-dispensing": "prescription dispensing",
  };
  return map[serviceId] || serviceName.toLowerCase();
}

function serviceAngle(serviceId: string, area: string, town: string, seed: string): string {
  const angles: Record<string, string[]> = {
    "travel-vaccinations": [
      `${area} residents often plan travel health around existing GP routines in ${town}, rather than booking multiple separate appointments.`,
      `Families in ${area} frequently seek ${town} pharmacy travel advice before holidays, family visits abroad or work trips.`,
      `People across ${area} value having travel vaccination guidance explained clearly before they commit to a full course of vaccines.`,
    ],
    "travel-health-consultations": [
      `${area} patients preparing for overseas travel often want a single consultation covering vaccines, malaria advice and practical preparation.`,
      `Residents in ${area} commonly ask about destination-specific health risks before booking through a ${town} pharmacy.`,
    ],
    "blood-pressure-checks": [
      `${area} patients managing cardiovascular health often appreciate convenient pharmacy checks that fit around commitments in ${town}.`,
      `Many people in ${area} use local pharmacy blood pressure monitoring as a practical step between GP reviews.`,
    ],
    "repeat-prescriptions": [
      `${area} patients on regular medicines often want dependable repeat prescription support without unnecessary trips into ${town}.`,
      `Residents in ${area} frequently look for clear guidance on repeat ordering, collection and delivery.`,
    ],
    "prescription-dispensing": [
      `${area} patients collecting new prescriptions often need straightforward advice on timing, supply and what to do if a medicine is unavailable.`,
      `People in ${area} value having prescription questions answered locally rather than waiting for a GP callback.`,
    ],
  };
  const pool = angles[serviceId] || [
    `${area} patients often prefer pharmacy-led ${serviceTopic(serviceId, serviceName)} that is easy to access from ${town}.`,
  ];
  return pick(pool, `${seed}-angle`) || pool[0];
}

/** Count distinct local reference tokens present in combined page text. */
export function countPageLocalReferences(
  texts: string[],
  tokens: string[],
): { count: number; used: string[]; mentionCount: number } {
  const hay = texts.join(" ").toLowerCase();
  const used: string[] = [];
  let mentionCount = 0;

  for (const token of tokens.filter(Boolean)) {
    const lower = token.toLowerCase();
    if (!hay.includes(lower)) continue;
    used.push(token);
    const matches = hay.match(new RegExp(lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
    mentionCount += matches?.length || 1;
  }

  return { count: used.length, used, mentionCount };
}

function buildReferenceTokens(ctx: LocalInjectionContext): string[] {
  return [ctx.area, ctx.town, ctx.hcName, ctx.commName, ...ctx.nearbyAreas.slice(0, 2)].filter(
    Boolean,
  ) as string[];
}

function localSuffix(type: string, ctx: LocalInjectionContext): string {
  const { area, town, hcName, topic, pharmacyName } = ctx;
  const pools: Record<string, string[]> = {
    benefits: [
      `Many ${area} patients appreciate having ${topic} explained in plain language before booking through ${pharmacyName} in ${town}.`,
      `Residents in ${area} often compare destination requirements during consultation — the pharmacy team keeps advice practical rather than generic.`,
      `People living in ${area} frequently value clear lead times and fee transparency when planning ${topic}.`,
      hcName
        ? `Patients around ${hcName} and ${area} often coordinate pharmacy travel health alongside existing GP care in ${town}.`
        : `${area} patients across ${town} often want ${topic} guidance that fits around existing healthcare routines.`,
    ],
    eligibility: [
      `Suitability is confirmed individually — ${area} patients should bring full travel and medical history to consultation.`,
      `Residents in ${area} can discuss eligibility by phone before booking if they are unsure whether ${topic} applies.`,
      `For ${area} households, the pharmacy team confirms who the service suits after reviewing destination and medical background.`,
      `People in ${area} with complex medical histories may still be seen — assessment determines whether pharmacy supply is appropriate.`,
    ],
    preparationGuide: [
      `${area} patients should allow enough time before departure — some vaccine courses need several weeks to complete.`,
      `When preparing from ${area}, bring your itinerary, previous vaccination records and any employer or visa health requirements.`,
      `Residents in ${area} planning last-minute travel can still book — the pharmacy team will prioritise what is achievable before you leave.`,
      `Allow extra travel time from ${area} to ${town} for your appointment, and bring any GP correspondence you already hold.`,
    ],
  };

  const pool = pools[type] || [];
  return sanitise(pick(pool, `${ctx.seed}-${type}`) || "");
}

export function injectLocalIntoSection(
  section: { type: string; heading: string; body: string; bullets?: string[] },
  ctx: LocalInjectionContext,
): { type: string; heading: string; body: string; bullets?: string[] } {
  const injectTypes = new Set(["benefits", "eligibility", "preparationGuide"]);
  if (!injectTypes.has(section.type)) return section;

  const suffix = localSuffix(section.type, ctx);
  if (!suffix) return section;

  const body = section.body.includes(suffix) ? section.body : `${section.body} ${suffix}`.trim();
  return { ...section, body: sanitise(body) };
}

export function injectLocalIntoSections(
  sections: Array<{ type: string; heading: string; body: string; bullets?: string[] }>,
  ctx: LocalInjectionContext,
): Array<{ type: string; heading: string; body: string; bullets?: string[] }> {
  return sections.map((s) => injectLocalIntoSection(s, ctx));
}

export function generateLocalNarrative(input: LocalNarrativeInput): LocalNarrativeOutput {
  assertLegacyContentEngineAllowed("pharmacyLocalNarrativeEngine", "generateLocalNarrative");
  const { pack, serviceId, serviceName, area, town, pharmacyName, nearbyAreas = [] } = input;
  const seed = `${pack.areaSlug}-${serviceId}`;
  const topic = serviceTopic(serviceId, serviceName);

  const healthcareEntity = preferAreaNamed(pack.topHealthcare || pack.healthcare || [], area);
  const communityEntity = preferAreaNamed(pack.topCommunity || pack.community || [], area);
  const hcName = healthcareEntity ? entityDisplayName(healthcareEntity) : null;
  const commName = communityEntity ? entityDisplayName(communityEntity) : null;

  const injectionContext: LocalInjectionContext = {
    seed,
    area,
    areaSlug: pack.areaSlug,
    town,
    pharmacyName,
    serviceId,
    serviceName,
    topic,
    hcName,
    commName,
    nearbyAreas,
  };

  const areaSummary = `${area} is a residential part of the wider ${town} area where patients often balance everyday healthcare with practical pharmacy services.`;

  const healthcareContext = hcName
    ? `Many ${area} patients already use ${hcName} for routine GP care, which makes coordinating travel health or pharmacy services feel familiar rather than starting from scratch.`
    : `${area} patients typically access GP and medical services across ${town}, and pharmacy appointments can complement that existing care pattern.`;

  const communityContext = commName
    ? `Daily life around ${commName} reflects how ${area} residents manage appointments, errands and family commitments — pharmacy access works best when it fits that rhythm.`
    : `${area} has an established community rhythm within ${town}, and patients often prefer healthcare advice they can act on without a long journey.`;

  const serviceSpecificLocalAngle = serviceAngle(serviceId, area, town, seed);

  const narrativeBodies = [
    `${areaSummary} ${healthcareContext} ${communityContext} ${serviceSpecificLocalAngle} ${pharmacyName} in ${town} provides ${topic} with assessment-first guidance for patients who live locally.`,
    `${serviceSpecificLocalAngle} ${communityContext} When ${area} patients contact ${pharmacyName}, the focus stays on ${topic}: suitability, timing and what to do next.`,
    `${healthcareContext} ${serviceSpecificLocalAngle} ${pharmacyName} supports ${area} patients with ${topic} in plain language, reflecting how people in ${town} access care.`,
  ];

  const localNarrativeSection: LocalNarrativeSection = {
    type: "localNarrative",
    heading: `${serviceName} for patients in ${area}`,
    body: sanitise(pick(narrativeBodies, seed) || narrativeBodies[0]),
    bullets: ["Assessment before booking", `Clear advice for ${area} patients`, `Access from ${area} to ${town}`],
  };

  const introVariants = [
    `${area} residents planning overseas travel often want ${topic} explained clearly before booking. ${pharmacyName} in ${town} covers suitability, timing and next steps without overloading the page with place names.`,
    `People living in ${area} frequently ask about ${topic} before holidays or family visits abroad. This page explains how the service works and when ${town} pharmacy support may be appropriate.`,
    `For ${area} households preparing for travel, practical ${topic} can reduce uncertainty before departure. ${pharmacyName} provides pharmacy-led assessment and booking guidance.`,
    `Patients in ${area} often prefer straightforward answers about ${topic} rather than generic information. Here is how ${pharmacyName} supports local patients with assessment and clear next steps.`,
    `Many ${area} patients look for ${topic} that fits around everyday life in ${town} — this page focuses on suitability, booking and what to expect.`,
    `Residents in ${area} booking ${topic} usually want clarity on timing, cost and clinical suitability before they travel.`,
  ];

  const localisedIntro = sanitise(pick(introVariants, `${seed}-intro`) || introVariants[0]);

  const ctaVariants = [
    {
      primary: "Book Consultation",
      secondary: "Speak To A Pharmacist",
      phonePrompt: `Call ${pharmacyName} in ${town} — convenient if you live in ${area} and want to discuss ${topic}.`,
      bookingPrompt: `${area} patients can request ${topic} advice or booking support through ${pharmacyName}.`,
    },
    {
      primary: "Call Today",
      secondary: "Request Advice",
      phonePrompt: `Phone ${pharmacyName} from ${area} for ${topic} availability and practical guidance.`,
      bookingPrompt: `Arrange ${topic} at ${pharmacyName} — helpful for ${area} residents and nearby ${town} communities.`,
    },
    {
      primary: "Get Advice",
      secondary: "Book Appointment",
      phonePrompt: `Contact ${pharmacyName} in ${town} to ask about ${topic} if you are in ${area}.`,
      bookingPrompt: `Book ${topic} support at ${pharmacyName} — ${area} patients welcome.`,
    },
    {
      primary: "Book Consultation",
      secondary: "Call The Pharmacy",
      phonePrompt: `${pharmacyName} in ${town} supports ${area} patients with ${topic} — call to check availability.`,
      bookingPrompt: `Request a ${topic} consultation through ${pharmacyName} if you live in ${area}.`,
    },
  ];

  const localisedCTA = pick(ctaVariants, `${seed}-cta`) || ctaVariants[0];

  const localisedFAQOpeners = [
    `Patients in ${area} often ask`,
    `For residents around ${area}, a common question is`,
    `People living in ${area} frequently want to know`,
    `A typical question from ${area} is`,
    `${area} residents planning travel often ask`,
    `Many ${area} patients wonder`,
    `When booking from ${area}, people often ask`,
    `Residents in ${area} commonly ask`,
  ];

  const tokens = buildReferenceTokens(injectionContext);
  const refs = countPageLocalReferences(
    [localisedIntro, localNarrativeSection.body, localisedCTA.phonePrompt, localisedCTA.bookingPrompt],
    tokens,
  );

  return {
    areaSummary,
    healthcareContext,
    communityContext,
    serviceSpecificLocalAngle,
    localNarrativeSection,
    localisedIntro,
    localisedCTA,
    localisedFAQOpeners,
    injectionContext,
    localReferenceCount: refs.mentionCount,
    localReferencesUsed: refs.used,
  };
}

export function computePageLocalReferences(
  page: {
    intro?: string;
    sections?: Array<{ type?: string; body?: string }>;
    faqs?: Array<{ question?: string; answer?: string }>;
    cta?: { phonePrompt?: string; bookingPrompt?: string };
  },
  ctx: LocalInjectionContext,
): { count: number; used: string[]; mentionCount: number; withinTarget: boolean } {
  const texts = [
    page.intro || "",
    ...(page.sections || []).map((s) => s.body || ""),
    ...(page.faqs || []).map((f) => `${f.question} ${f.answer}`),
    page.cta?.phonePrompt || "",
    page.cta?.bookingPrompt || "",
  ];
  const tokens = buildReferenceTokens(ctx);
  const refs = countPageLocalReferences(texts, tokens);
  return {
    ...refs,
    withinTarget: refs.mentionCount >= REF_MIN && refs.mentionCount <= REF_MAX,
  };
}

export function applyFAQOpeners(
  openers: string[],
  areaSlug: string,
  faqs: Array<{ question: string; answer: string }>,
  localizeCount = 4,
): Array<{ question: string; answer: string }> {
  return faqs.map((f, i) => {
    if (i === 0) return { ...f, answer: sanitise(f.answer) };
    if (i > localizeCount) return { ...f, answer: sanitise(f.answer) };
    const opener = pick(openers, `${areaSlug}-faq-${i}`) || openers[0];
    const base = sanitise(String(f.answer || ""));
    return { question: f.question, answer: sanitise(`${opener} about this before booking. ${base}`) };
  });
}
