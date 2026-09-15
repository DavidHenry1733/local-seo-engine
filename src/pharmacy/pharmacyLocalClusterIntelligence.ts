/**
 * Local cluster pages — Business Profile Intelligence enrichment.
 * Profile-first; reuses phrase helpers without modifying service/long-form renderers.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import {
  collectIntelligenceSentences,
  intelligenceSupportsClaim,
  phraseBookingCta,
  phraseBusinessDescription,
  phraseConsultationLength,
  phraseConsultationRoom,
  phraseParking,
  phraseResultsProcess,
  phraseServiceAftercare,
  phraseServiceEquipment,
  phraseServicePreparation,
  phraseServicePricing,
  phraseTagline,
  phraseWalkIn,
  phraseWheelchairAccess,
  teamSubjectPhrase,
} from "./contentEngine/pharmacyLongFormIntelligencePhrases.ts";
import type { LocalClusterPageContent } from "./pharmacyLocalClusterContentEngine.ts";
import {
  appendExtrasToParagraph,
  preferredServicePageCta,
  servicePageFaqEntries,
  servicePageLocalExtras,
  servicePageTrustProseExtras,
} from "./pharmacyServicePageIntelligence.ts";
import { phraseLocalMarketClusterIntro } from "./contentEngine/pharmacyLocalMarketIntelligencePhrases.ts";
import type { FaqVariant } from "./pharmacyServiceVariantLibrary.ts";

export { intelligenceSupportsClaim };

export interface ClusterIntelligenceInput {
  areaName: string;
  serviceName: string;
  pharmacyName: string;
}

function localizeFaqForArea(question: string, areaName: string, pharmacyName: string): string {
  const q = question.trim();
  if (q.toLowerCase().includes(areaName.toLowerCase())) return q;
  if (q.includes(` at ${pharmacyName}?`)) return q.replace(` at ${pharmacyName}?`, ` in ${areaName}?`);
  return q.replace(/\?$/, ` in ${areaName}?`);
}

export function clusterHeroIntro(
  ctx: ContentGenerationContext | undefined,
  input: ClusterIntelligenceInput,
  fallbackIntro: string,
): string {
  const { areaName, serviceName, pharmacyName } = input;
  const serviceLower = serviceName.toLowerCase();

  if (!ctx?.businessProfileIntelligence?.slug) {
    return ctx ? phraseLocalMarketClusterIntro(ctx, input.areaName, fallbackIntro) : fallbackIntro;
  }

  const team = teamSubjectPhrase(ctx);
  const tagline = phraseTagline(ctx);
  const desc = phraseBusinessDescription(ctx);

  if (tagline) {
    return phraseLocalMarketClusterIntro(
      ctx,
      areaName,
      `${tagline} — ${pharmacyName} provides ${serviceLower} for patients in ${areaName} and nearby communities.`,
    );
  }
  if (desc) {
    const provider = team ? `${team} at ${pharmacyName}` : pharmacyName;
    return phraseLocalMarketClusterIntro(
      ctx,
      areaName,
      `${desc} ${provider} supports ${serviceLower} for patients in ${areaName}.`,
    );
  }
  if (team) {
    return phraseLocalMarketClusterIntro(
      ctx,
      areaName,
      `${team} at ${pharmacyName} provides ${serviceLower} for patients in ${areaName}. ${fallbackIntro}`,
    );
  }

  const enriched = phraseLocalMarketClusterIntro(ctx, areaName, fallbackIntro);
  const extras = collectIntelligenceSentences([phraseConsultationRoom(ctx), phraseWalkIn(ctx)]);
  if (extras.length) return appendExtrasToParagraph(enriched, extras);
  return enriched;
}

export function mergeClusterFaqs(
  ctx: ContentGenerationContext | undefined,
  baseFaqs: FaqVariant[],
  input: ClusterIntelligenceInput,
  max = 8,
): FaqVariant[] {
  if (!ctx?.businessProfileIntelligence?.slug) return baseFaqs.slice(0, max);

  const profileFaqs = servicePageFaqEntries(ctx).map((f) => ({
    question: localizeFaqForArea(f.question, input.areaName, input.pharmacyName),
    answer: f.answer,
  }));

  const seen = new Set<string>();
  const merged: FaqVariant[] = [];
  for (const f of [...profileFaqs, ...baseFaqs]) {
    const key = f.question.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(f);
    if (merged.length >= max) break;
  }
  return merged;
}

export function applyClusterIntelligence(
  content: LocalClusterPageContent,
  ctx: ContentGenerationContext | undefined,
  input: ClusterIntelligenceInput,
): LocalClusterPageContent {
  if (!ctx?.businessProfileIntelligence?.slug) return content;

  const processExtras = collectIntelligenceSentences([
    phraseConsultationRoom(ctx),
    phraseConsultationLength(ctx),
    phraseWalkIn(ctx),
  ]);
  const accessExtras = servicePageLocalExtras(ctx);
  const prepExtras = collectIntelligenceSentences([
    phraseServicePreparation(ctx),
    phraseServiceEquipment(ctx),
  ]);
  const trustExtras = servicePageTrustProseExtras(ctx);
  const definitionExtras = collectIntelligenceSentences([
    phraseServicePricing(ctx),
    phraseResultsProcess(ctx),
    phraseServiceAftercare(ctx),
  ]);

  const processSteps = content.processSteps.map((step, index) => {
    if (index !== 1) return step;
    const stepExtras = collectIntelligenceSentences([phraseConsultationRoom(ctx), phraseServiceEquipment(ctx)]);
    return stepExtras.length
      ? { ...step, body: appendExtrasToParagraph(step.body, stepExtras) }
      : step;
  });

  const bookingCta = phraseBookingCta(ctx);
  const ctaPrimary = preferredServicePageCta(ctx, ctx.profile);
  const pharmacyFirstNarrative = String(content.narrativeType || "").startsWith("pharmacy-first-intelligence");
  const servicePackNarrative = String(content.narrativeType || "").startsWith("service-variant-pack");
  const approvedBankDirect = String(content.narrativeType || "").startsWith("approved-bank-locality-direct");

  // Pharmacy First locality planner owns narrative uniqueness — do not re-homogenise with shared extras.
  if (pharmacyFirstNarrative) {
    return {
      ...content,
      heroIntro: content.heroIntro,
      localRelevanceIntro: content.localRelevanceIntro,
      whyChecksBody: content.whyChecksBody,
      processIntro: content.processIntro,
      processSteps: content.processSteps,
      accessBody: content.accessBody,
      clinicalEnvironmentBody: content.clinicalEnvironmentBody,
      trustBody: content.trustBody,
      trustClosing: content.trustClosing,
      faqs: content.faqs,
      ctaPrimary: content.ctaPrimary,
      ctaPhonePrompt: content.ctaPhonePrompt,
      contentFingerprint: content.contentFingerprint,
      wordCountEstimate: content.wordCountEstimate,
    };
  }

  // Service variant-pack locality drafts are bank-owned — do not enrich or re-merge foreign banks.
  if (servicePackNarrative || approvedBankDirect) {
    return content;
  }

  return {
    ...content,
    heroIntro: clusterHeroIntro(ctx, input, content.heroIntro),
    localRelevanceIntro: appendExtrasToParagraph(content.localRelevanceIntro, definitionExtras.slice(0, 1)),
    whyChecksBody: appendExtrasToParagraph(content.whyChecksBody, definitionExtras.slice(1, 2)),
    processIntro: appendExtrasToParagraph(content.processIntro, processExtras),
    processSteps,
    accessBody: appendExtrasToParagraph(
      content.accessBody,
      collectIntelligenceSentences([...accessExtras, phraseParking(ctx), phraseWheelchairAccess(ctx)]),
    ),
    clinicalEnvironmentBody: appendExtrasToParagraph(content.clinicalEnvironmentBody, prepExtras),
    trustBody: appendExtrasToParagraph(content.trustBody, trustExtras),
    trustClosing: content.trustClosing,
    faqs: mergeClusterFaqs(ctx, content.faqs, input),
    ctaPrimary: ctaPrimary || content.ctaPrimary,
    ctaPhonePrompt: bookingCta || content.ctaPhonePrompt,
    contentFingerprint: [
      content.contentFingerprint,
      processExtras.join("|"),
      trustExtras.join("|"),
      bookingCta || "",
    ].join("::"),
    wordCountEstimate: content.wordCountEstimate,
  };
}
