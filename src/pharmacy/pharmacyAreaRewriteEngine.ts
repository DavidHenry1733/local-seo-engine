import {
  applyFAQOpeners,
  computePageLocalReferences,
  generateLocalNarrative,
  injectLocalIntoSections,
  serviceTopic,
  type LocalRelevancePackInput,
} from "./pharmacyLocalNarrativeEngine.ts";

export type LocalRelevancePackV2 = LocalRelevancePackInput;

export interface RewriteContext {
  pharmacyName: string;
  town: string;
  serviceId: string;
  serviceName: string;
  area: string;
  nearbyAreas?: string[];
}

export interface RewrittenAreaContent {
  intro: string;
  metaDescription: string;
  localServiceIntro: { heading: string; body: string; bullets: string[] };
  localNarrative: { type: "localNarrative"; heading: string; body: string; bullets: string[] };
  faqs: Array<{ question: string; answer: string }>;
  cta: { phonePrompt: string; bookingPrompt: string; primary: string; secondary: string };
  injectionContext: ReturnType<typeof generateLocalNarrative>["injectionContext"];
  localReferenceCount: number;
  localReferencesUsed: string[];
  localReferencesWithinTarget: boolean;
}

function pick<T>(items: T[], seed: string, index = 0): T | undefined {
  if (!items.length) return undefined;
  const hash = seed.split("").reduce((n, c) => n + c.charCodeAt(0), 0);
  return items[(hash + index) % items.length];
}

function buildFirstFaq(ctx: RewriteContext, pack: LocalRelevancePackV2) {
  const topic = serviceTopic(ctx.serviceId, ctx.serviceName);
  const variants = [
    {
      question: `Can patients in ${pack.area} access ${ctx.serviceName}?`,
      answer: `Yes. Patients in ${pack.area} can contact ${ctx.pharmacyName} in ${ctx.town} to ask about ${topic}, availability and booking options.`,
    },
    {
      question: `Is ${ctx.serviceName} available to ${pack.area} residents?`,
      answer: `Yes — ${pack.area} residents can reach ${ctx.pharmacyName} in ${ctx.town} for ${topic} and practical booking guidance.`,
    },
    {
      question: `How do ${pack.area} patients arrange ${ctx.serviceName}?`,
      answer: `${pack.area} patients can contact ${ctx.pharmacyName} directly to discuss ${topic}, suitability and next steps.`,
    },
    {
      question: `Do ${pack.area} residents need a GP referral for ${ctx.serviceName}?`,
      answer: `Not usually — ${pack.area} patients can contact ${ctx.pharmacyName} in ${ctx.town} directly. Suitability is confirmed at assessment.`,
    },
  ];
  return pick(variants, `${pack.areaSlug}-${ctx.serviceId}-faq0`) || variants[0];
}

export function rewriteAreaContent(
  ctx: RewriteContext,
  pack: LocalRelevancePackV2,
  master: { faqs?: Array<{ question: string; answer: string }> },
): RewrittenAreaContent {
  const narrative = generateLocalNarrative({
    pack,
    serviceId: ctx.serviceId,
    serviceName: ctx.serviceName,
    area: ctx.area,
    town: ctx.town,
    pharmacyName: ctx.pharmacyName,
    nearbyAreas: ctx.nearbyAreas,
  });

  const topic = serviceTopic(ctx.serviceId, ctx.serviceName);
  const localServiceIntro = {
    heading: `${ctx.serviceName} at ${ctx.pharmacyName}`,
    body: `${ctx.pharmacyName} provides ${topic} for patients in ${ctx.town}. The service covers suitability checks, clear advice and booking support — whether you need a single consultation or ongoing guidance.`,
    bullets: ["Professional pharmacy assessment", "Plain-language advice", "Clear next steps before booking"],
  };

  const masterFaqs = master.faqs || [];
  const firstFaq = buildFirstFaq(ctx, pack);
  const restFaqs = masterFaqs.filter((f) => f.question !== firstFaq.question).slice(0, 7);
  const faqs = applyFAQOpeners(narrative.localisedFAQOpeners, pack.areaSlug, [firstFaq, ...restFaqs], 4);

  const draftPage = {
    intro: narrative.localisedIntro,
    sections: [narrative.localNarrativeSection],
    faqs,
    cta: narrative.localisedCTA,
  };
  const refs = computePageLocalReferences(draftPage, narrative.injectionContext);

  return {
    intro: narrative.localisedIntro,
    metaDescription: `${ctx.serviceName} for patients in ${pack.area}. ${ctx.pharmacyName} in ${ctx.town} provides assessment, advice and booking support.`,
    localServiceIntro,
    localNarrative: narrative.localNarrativeSection,
    faqs,
    cta: narrative.localisedCTA,
    injectionContext: narrative.injectionContext,
    localReferenceCount: refs.mentionCount,
    localReferencesUsed: refs.used,
    localReferencesWithinTarget: refs.withinTarget,
  };
}

export { injectLocalIntoSections };
