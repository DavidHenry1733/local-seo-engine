/**
 * Local cluster page content — Content Engine V1 canonical cluster narrative planner.
 * composeCommercialClusterNarrativeV1 is the only locality-copy owner.
 * It calls the existing Gemini introduction writer. It does not use slot prose,
 * Pharmacy First narrative, or Local Patient Copy V1.
 */
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { buildAreaNarrativeProfile } from "./pharmacyAreaNarrativeProfiles.ts";
import type { ProfileLocalEntity } from "./pharmacyProfileLocalIntelligenceSelection.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  isApprovedBankRegisteredService,
  loadServiceVariantPack,
  localizeFaqQuestion,
  pickServiceVariantFaqs,
  type FaqVariant,
  type SectionVariant,
} from "./pharmacyServiceVariantLibrary.ts";
import { selectRegisteredApprovedBank } from "./pharmacyApprovedBankRunProvenance.ts";
import { buildApprovedBankLocalityPageContract } from "./pharmacyApprovedBankCorePageContract.ts";
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";
import { stripAreaPrefixCopy } from "./pharmacyLocalClusterVariantFamilies.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import {
  areaDiscoveryForName,
  providersForArea,
} from "./pharmacyLocalMarketSnapshot.ts";
import { phraseAreaTravelContext } from "./contentEngine/pharmacyLocalMarketIntelligencePhrases.ts";
import { synthesiseCanonicalGroundedLocalCopyV1 } from "./contentEngine/pharmacyCanonicalLocalSynthesisV1.ts";
import { localityArrangementCopy } from "./contentEngine/pharmacyLocalitySectionArrangementV1.ts";
import { premisesAddressForArea, premisesLocalityFromCanonicalAddress } from "./contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { finalizeLocalClusterPageContent } from "./pharmacyLocalClusterCompositionDedupe.ts";
import { commercialNarrativeSequenceV1 } from "./contentEngine/pharmacyCommercialSectionPlannerV1.ts";
import { allocateLocalityEvidenceV1 } from "./contentEngine/pharmacyLocalityEvidenceAllocatorV1.ts";
import { bindVerifiedLocalityEvidenceV1 } from "./contentEngine/pharmacyVerifiedLocalityEvidenceV1.ts";
import {
  buildLocalityEvidenceInventory,
  buildUniqueLocalityNarrative,
  siblingFactsFromCampaignContext,
  type LocalitySiblingFact,
} from "./contentEngine/pharmacyLocalityUniqueNarrativeV1.ts";

export interface LocalClusterContentInput {
  slug: string;
  serviceId: string;
  serviceName: string;
  areaName: string;
  areaSlug: string;
  nearbyAreaNames: string[];
  areaSlugsInCluster: string[];
  siblingLocalities?: Array<{ areaName: string; areaSlug: string; distanceLabel?: string; relationship?: string; evidence?: string[]; source?: string }>;
  localityRecord?: { distanceLabel?: string; relationship?: string; evidence?: string[]; source?: string };
}

export interface LocalClusterProcessStep {
  title: string;
  body: string;
  bullets?: string[];
}

export interface LocalClusterPageContent {
  heroIntro: string;
  localRelevanceHeading: string;
  localRelevanceIntro: string;
  localRelevanceBody: string;
  localRelevanceBullets: string[];
  whyChecksHeading: string;
  whyChecksBody: string;
  whyChecksBullets: string[];
  processHeading: string;
  processIntro: string;
  processSteps: LocalClusterProcessStep[];
  accessHeading: string;
  accessBody: string;
  clinicalEnvironmentHeading: string;
  clinicalEnvironmentBody: string;
  trustHeading: string;
  trustIntro?: string;
  trustBullets?: string[];
  trustClosing?: string;
  trustBody: string;
  eligibilityHeading?: string;
  eligibilityBody?: string;
  eligibilityBullets?: string[];
  preparationBullets?: string[];
  faqs: FaqVariant[];
  ctaPrimary: string;
  ctaSecondary: string;
  ctaPhonePrompt: string;
  contentFingerprint: string;
  localIntelligenceUsed: boolean;
  narrativeType: string;
  wordCountEstimate: number;
  seoTitle?: string;
  metaDescription?: string;
  supportingHeading?: string;
  supportingIntro?: string;
  supportingItems?: Array<{ title: string; body: string; evidence: string; bullets?: string[] }>;
  nearbyLocalityLinks?: Array<{ areaName: string; areaSlug: string; reason: string; geographic?: boolean }>;
  sectionEvidence?: Record<string, string[]>;
  evidenceLimited?: boolean;
}

function pick<T>(items: T[], seed: string, offset = 0): T | undefined {
  if (!items.length) return undefined;
  return items[(hashSeed(seed, String(offset)) % items.length + items.length) % items.length]!;
}

function entityLabel(entity: ProfileLocalEntity): string {
  const name = String(entity.name || "").trim();
  const category = String(entity.category || entity.entityType || "").trim();
  if (name && category) return `${name} (${category.replace(/_/g, " ")})`;
  return name;
}

function safeEntities(entities: ProfileLocalEntity[] | undefined, limit = 3): string[] {
  if (!entities?.length) return [];
  const pharmacyPattern = /pharmacy|chemist|boots|rowlands|lloyds|superdrug/i;
  return entities
    .filter((e) => e.name?.trim() && !pharmacyPattern.test(`${e.name} ${e.address || ""}`))
    .slice(0, limit)
    .map(entityLabel)
    .filter(Boolean);
}

function buildLocalBullets(
  areaName: string,
  entities: ProfileLocalEntity[] | undefined,
  nearbyAreaNames: string[],
  narrative: ReturnType<typeof buildAreaNarrativeProfile>,
  pharmacyName: string,
  town: string,
  ctx?: ContentGenerationContext,
): { bullets: string[]; used: boolean } {
  const bullets: string[] = [];
  const entityNames = safeEntities(entities, 3);

  for (const name of entityNames) {
    bullets.push(
      `Some patients in ${areaName} plan pharmacy visits alongside appointments or errands near ${name}.`,
    );
  }

  if (!entityNames.length && ctx?.localMarket) {
    const gps = providersForArea(ctx.localMarket, areaName, { groupKeys: ["gpSurgeries"], limit: 1 });
    for (const gp of gps) {
      const distance =
        gp.distanceKm === 0
          ? "on the same street as the pharmacy"
          : gp.distanceLabel
            ? `${gp.distanceLabel} from the pharmacy`
            : "nearby";
      // Only mention GP practices when they help patients coordinate the active service.
      const servicePurpose =
        ctx.serviceId === "pharmacy-first" || /pharmacy first/i.test(ctx.serviceName || "")
          ? "Pharmacy First when symptoms fit the NHS pathway"
          : `${ctx.serviceName || "pharmacy services"}`;
      bullets.push(
        `Patients in ${areaName} near ${gp.businessName} (${distance}) can also contact ${pharmacyName} about ${servicePurpose}.`,
      );
    }
  }

  const travel = ctx ? phraseAreaTravelContext(ctx, areaName) : null;
  if (travel) bullets.push(travel);

  const discovery = ctx ? areaDiscoveryForName(ctx.areaDiscovery, areaName) : null;
  if (discovery?.evidence?.length) {
    const evidence = discovery.evidence.find((e) => /km from|suburban|commuter|residential|road|route/i.test(e));
    if (evidence) {
      bullets.push(`${areaName} is ${evidence.toLowerCase()} for patients travelling to ${pharmacyName}.`);
    }
  }

  const neighbours = nearbyAreaNames.filter((n) => n !== areaName).slice(0, 2);
  if (neighbours.length) {
    bullets.push(
      `${pharmacyName} also supports patients travelling from ${neighbours.join(" and ")} for the same pharmacy team and booking process.`,
    );
  }

  const healthcareContext = String(narrative.localHealthcareContext || "").replace(/\bthe pharmacy\b/gi, pharmacyName).trim();
  if (healthcareContext.length > 45) bullets.push(healthcareContext);

  if (town && town !== areaName) {
    bullets.push(
      `Although ${areaName} is the focus for this page, the pharmacy team serves wider ${town} communities with the same clinical standards.`,
    );
  }

  const deduped = [...new Set(bullets.map((b) => b.trim()).filter((b) => b.length > 45))].slice(0, 5);
  const used = entityNames.length > 0 || Boolean(ctx?.localMarket?.healthcareProviders.length) || deduped.length >= 3;
  return { bullets: deduped, used };
}

function estimateWords(content: LocalClusterPageContent): number {
  const parts = [
    content.heroIntro,
    content.localRelevanceIntro,
    content.localRelevanceBody,
    content.whyChecksBody,
    content.processIntro,
    ...content.processSteps.map((s) => `${s.title} ${s.body}`),
    content.accessBody,
    content.clinicalEnvironmentBody,
    content.trustBody,
    ...content.faqs.map((f) => `${f.question} ${f.answer}`),
    ...content.localRelevanceBullets,
    ...content.whyChecksBullets,
  ];
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

function cleanServiceSpecificLocalCopy(text: string, input: LocalClusterContentInput): string {
  if (input.serviceId === "blood-pressure-checks") return text;
  const serviceLower = input.serviceName.toLowerCase();
  return text
    .replace(/\bBlood pressure is taken in a professional setting with time to discuss context, not rushed at the counter\./gi, "The pharmacist completes a structured assessment in a professional setting with time to discuss symptoms and next steps.")
    .replace(/\bprofessional reading\b/gi, "pharmacist assessment")
    .replace(/\bhome monitor readings?\b/gi, "symptoms")
    // Never emit "symptom monitoring" for non-BP services (Travel/etc. inherit BP locality families).
    .replace(/\bwhen home monitoring shows a reading they want verified\b/gi, "when they want concerns verified")
    .replace(/\bhome monitoring comparisons\b/gi, "follow-up comparisons")
    .replace(/\bhome monitoring tips\b/gi, "self-care tips")
    .replace(/\bhome monitoring\b/gi, "follow-up advice")
    .replace(/\bGP monitoring\b/gi, "GP care")
    .replace(/\brepeat the check\b/gi, "seek further advice")
    .replace(/\brepeat checks\b/gi, "follow-up advice")
    .replace(/\bpharmacy check\b/gi, "pharmacy consultation")
    .replace(/\bblood pressure screening\b/gi, serviceLower)
    .replace(/\bblood pressure checks?\b/gi, serviceLower)
    .replace(/\bblood pressure\b/gi, serviceLower)
    .replace(/\bblood pressure review\b/gi, `${serviceLower} review`)
    .replace(/\bblood pressure history\b/gi, "relevant medical history")
    .replace(/\bhypertension\b/gi, "health concern")
    .replace(/\bsystolic and diastolic readings\b/gi, "the assessment outcome")
    .replace(/\bwhat your numbers mean\b/gi, "what the assessment means")
    .replace(/\byour numbers\b/gi, "your symptoms")
    .replace(/\byour reading\b/gi, "your assessment")
    .replace(/\bthe reading\b/gi, "the assessment")
    .replace(/\breadings\b/gi, "symptoms")
    .replace(/\breading\b/gi, "assessment")
    .replace(/\bmeasurement\b/gi, "assessment")
    .replace(/\bmeasured\b/gi, "structured")
    .replace(/\bWear loose clothing on your upper arm and mention if you have already taken symptoms at home\./gi, "Bring details of your symptoms, medicines, allergies and when the problem started.")
    .replace(/\bAvoid caffeine beforehand if possible\b/gi, "Bring your medicines list if possible")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanLocalContentForService(content: LocalClusterPageContent, input: LocalClusterContentInput): LocalClusterPageContent {
  // Pack-composed locality pages are already service-specific — never run BP→generic scrubbing on them.
  if (String(content.narrativeType || "").startsWith("service-variant-pack")) return content;
  const clean = (text: string) => cleanServiceSpecificLocalCopy(text, input);
  return {
    ...content,
    heroIntro: clean(content.heroIntro),
    localRelevanceHeading: clean(content.localRelevanceHeading),
    localRelevanceIntro: clean(content.localRelevanceIntro),
    localRelevanceBody: clean(content.localRelevanceBody),
    localRelevanceBullets: content.localRelevanceBullets.map(clean),
    whyChecksHeading: clean(content.whyChecksHeading),
    whyChecksBody: clean(content.whyChecksBody),
    whyChecksBullets: content.whyChecksBullets.map(clean),
    processIntro: clean(content.processIntro),
    processSteps: content.processSteps.map((step) => ({ title: clean(step.title), body: clean(step.body) })),
    accessHeading: clean(content.accessHeading),
    accessBody: clean(content.accessBody),
    clinicalEnvironmentHeading: clean(content.clinicalEnvironmentHeading),
    clinicalEnvironmentBody: clean(content.clinicalEnvironmentBody),
    trustHeading: clean(content.trustHeading),
    trustIntro: content.trustIntro ? clean(content.trustIntro) : undefined,
    trustBullets: content.trustBullets?.map(clean),
    trustClosing: content.trustClosing ? clean(content.trustClosing) : undefined,
    trustBody: clean(content.trustBody),
    faqs: content.faqs.map((faq) => ({ ...faq, question: clean(faq.question), answer: clean(faq.answer) })),
    ctaPrimary: clean(content.ctaPrimary),
    ctaSecondary: clean(content.ctaSecondary),
    ctaPhonePrompt: clean(content.ctaPhonePrompt),
  };
}

function sectionBody(variant: SectionVariant | undefined): string {
  return String(variant?.body || "").trim();
}

function sectionBullets(variant: SectionVariant | undefined): string[] {
  return (variant?.bullets || []).map((b) => String(b).trim()).filter(Boolean);
}

function injectServiceContext(
  text: string,
  pharmacyName: string,
  areaName: string,
  town: string,
  serviceName: string,
): string {
  // Only expand explicit placeholders. Do not rewrite "the pharmacy" to the trading name —
  // that repeats the full name across FAQs/trust and fails patient-copy quality.
  return text
    .replace(/\{pharmacy\}/gi, pharmacyName)
    .replace(/\{area\}/gi, areaName)
    .replace(/\{town\}/gi, town)
    .replace(/\{service\}/gi, serviceName)
    .trim();
}

/** One natural locality mention in bank copy — never stamp the name onto every sentence. */
function weaveLocalityOnce(text: string, areaName: string): string {
  const body = String(text || "").trim();
  const area = String(areaName || "").trim();
  if (!body || !area) return body;
  const areaRe = new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (areaRe.test(body)) return body;
  return body.replace(/\byour area\b/i, area);
}

/** Consultation journey steps from the service bank only — omit when the bank has none. */
function buildPackProcessStepsFromBank(
  howItWorks: SectionVariant | undefined,
  treatmentProcess: SectionVariant | undefined,
): LocalClusterProcessStep[] {
  const steps: LocalClusterProcessStep[] = [];
  for (const bullet of sectionBullets(howItWorks)) {
    steps.push({ title: bullet, body: bullet });
  }
  for (const bullet of sectionBullets(treatmentProcess)) {
    steps.push({ title: bullet, body: bullet });
  }
  return steps;
}

function assertServiceIsolatedLocalClusterContent(
  content: LocalClusterPageContent,
  input: LocalClusterContentInput,
): void {
  if (input.serviceId === "pharmacy-first" || input.serviceId === "blood-pressure-checks") return;
  const hay = [
    content.heroIntro,
    content.localRelevanceIntro,
    content.localRelevanceBody,
    content.whyChecksHeading,
    content.whyChecksBody,
    ...content.whyChecksBullets,
    content.processIntro,
    ...content.processSteps.map((s) => `${s.title} ${s.body}`),
    content.accessBody,
    content.clinicalEnvironmentHeading,
    content.clinicalEnvironmentBody,
    content.trustBody,
    ...content.faqs.map((f) => `${f.question} ${f.answer}`),
  ].join("\n");

  const forbidden: Array<{ label: string; re: RegExp }> = [
    { label: "Pharmacy First pathways", re: /Pharmacy First pathway/i },
    { label: "seven NHS pathways", re: /seven NHS pathway/i },
    { label: "symptom monitoring", re: /symptom monitoring/i },
    { label: "blood-pressure monitoring", re: /blood[- ]pressure monitoring/i },
    { label: "home monitoring", re: /\bhome monitoring\b/i },
    { label: "screening checks", re: /\bscreening checks?\b/i },
    { label: "point-of-care blood tests", re: /point-of-care\s+blood\s+tests?/i },
    { label: "blood-pressure assessment", re: /blood[- ]pressure assessment/i },
    { label: "sore throat pathway copy", re: /\bsore throat\b/i },
    { label: "earache pathway copy", re: /\bearache\b/i },
    { label: "UTI pathway copy", re: /\bUTI\b/ },
    { label: "impetigo pathway copy", re: /\bimpetigo\b/i },
    { label: "malformed FAQ grammar", re: /Can patients in [^?]+\bhow do I\b/i },
    { label: "malformed FAQ grammar", re: /Do people in [^?]+\bI need\b/i },
  ];
  for (const rule of forbidden) {
    if (rule.re.test(hay)) {
      throw new Error(
        `Locality content isolation failed for ${input.serviceId}/${input.areaSlug}: found "${rule.label}". Service variant pack routing must not emit cross-service fragments.`,
      );
    }
  }
}

/**
 * Content Engine V1 — service variant-pack locality draft.
 * Architecture lock: serviceId → content bank → selectAreaVariants → render.
 * Missing bank sections are omitted. Never borrow PF / BP / screening / generic copy.
 */
function composeServiceVariantPackClusterDraft(
  input: LocalClusterContentInput,
  _ctx?: ContentGenerationContext,
): LocalClusterPageContent {
  throw new Error(
    `Slot locality narrative is not a live writer for ${input.serviceId}/${input.areaSlug}. composeCommercialClusterNarrativeV1 owns locality synthesis.`,
  );
}

function finalizeCommercialClusterPipeline(
  draft: LocalClusterPageContent,
  input: LocalClusterContentInput,
  ctx: ContentGenerationContext | undefined,
  pharmacyName: string,
): LocalClusterPageContent {
  // Touch shared commercial sequence so service + cluster planners stay coupled.
  void commercialNarrativeSequenceV1();

  let content = applyClusterIntelligence(draft, ctx, {
    areaName: input.areaName,
    serviceName: input.serviceName,
    pharmacyName,
  });
  content = finalizeLocalClusterPageContent(content);
  content = cleanLocalContentForService(content, input);
  assertServiceIsolatedLocalClusterContent(content, input);
  content.wordCountEstimate = estimateWords(content);
  content.contentFingerprint = [
    input.areaSlug,
    input.serviceId,
    "content-engine-v1",
    hashSeed(input.areaSlug, input.serviceId, content.narrativeType || "cluster"),
    content.heroIntro.slice(0, 120),
    content.processIntro.slice(0, 80),
    content.trustBody.slice(0, 80),
    content.faqs[0]?.question || "",
    ctx?.businessProfileIntelligence?.slug || "",
  ]
    .join("::")
    .toLowerCase();
  return content;
}

const preparedCanonicalNarratives = new Map<string, LocalClusterPageContent>();

export function canonicalNarrativeKey(serviceId: string, areaSlug: string): string {
  return `${serviceId}::${areaSlug}`;
}

export function readPreparedCanonicalClusterNarrative(
  serviceId: string,
  areaSlug: string,
): LocalClusterPageContent {
  const content = preparedCanonicalNarratives.get(canonicalNarrativeKey(serviceId, areaSlug));
  if (!content) {
    throw new Error(
      `Canonical local content is missing for ${serviceId}/${areaSlug}. composeCommercialClusterNarrativeV1 must run before render.`,
    );
  }
  return content;
}

function serviceSectionsForCanonicalNarrative(
  input: LocalClusterContentInput,
  ctx: ContentGenerationContext,
) {
  const selected = isApprovedBankRegisteredService(input.serviceId)
    ? selectRegisteredApprovedBank(input.serviceId)
    : null;
  const pack = selected?.pack || ctx.variantPack || loadServiceVariantPack(input.serviceId);
  if (!pack || pack.serviceId !== input.serviceId) {
    throw new Error(
      `No service-specific locality content bank for service "${input.serviceId}". Refusing silent cross-service fallback.`,
    );
  }
  return buildApprovedBankLocalityPageContract(pack, input.areaSlug, input.areaSlugsInCluster);
}

function facilityNamedBeforeIs(sentence: string): string {
  const named = sentence.replace(/^The\s+/i, "").match(/^([^.]{3,90}?)\s+is\b/i);
  if (!named) return "";
  const facility = named[1].replace(/\s+/g, " ").trim();
  if (facility.split(/\s+/).length < 2) return "";
  if (/^(it|they|this|that)$/i.test(facility)) return "";
  if (/\b(serves|includes|operates|provides|manages|holds|include)\b/i.test(facility)) return "";
  return facility;
}

function properFacilityName(text: string): string {
  const named = text.match(
    /\b(NHS\s+[A-Z][A-Za-z]+(?:\s+(?:and|[A-Z][A-Za-z]+)){1,6}|[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,5}\s(?:Hospital|Infirmary))\b/,
  );
  return named?.[1]?.replace(/\s+/g, " ").trim() || "";
}

/** Keep the arrangement slot, but do not leave a heading that names a place or service the introduction does not support. */
function editorialHeadingAlignedToCopy(heading: string, area: string, hero: string, local: string): string {
  const body = `${hero}\n${local}`;
  const claimsGp = /\bgp practices\b/i.test(heading) && !/\bgp practice/i.test(body);
  const claimsPrimaryCarePlaces = /\bprimary care places\b/i.test(heading) && !/\bprimary care\b/i.test(body);
  const withoutArea = heading.replace(new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), " ");
  const properNames = withoutArea.match(/\b[A-Z][A-Za-z0-9'&-]+(?:\s+[A-Z][A-Za-z0-9'&-]+){1,6}/g) || [];
  const namesMissingPlace = properNames.some((phrase) => !body.toLowerCase().includes(phrase.toLowerCase()));
  if (!claimsGp && !claimsPrimaryCarePlaces && !namesMissingPlace) return heading;
  const facility = facilityNamedBeforeIs(local) || facilityNamedBeforeIs(hero) || properFacilityName(`${hero}\n${local}`);
  return facility ? `${facility} in ${area}` : heading;
}

export function installValidatedCanonicalClusterNarrative(
  input: LocalClusterContentInput,
  ctx: ContentGenerationContext,
  synthesised: {
    heroIntroduction: string;
    localIntroduction: string;
    nextStep: string;
    provenance: Array<{ name: string; category: string; provenance: string }>;
    sufficiency: "sufficient" | "limited";
    fingerprint: string;
    synthesis: string;
  },
): LocalClusterPageContent {
  const contract = serviceSectionsForCanonicalNarrative(input, ctx);
  const pharmacyName = ctx.profile.pharmacyName;
  const address = premisesAddressForArea(ctx.profile);
  const premises = premisesLocalityFromCanonicalAddress(address);
  const leadHealthcare = synthesised.provenance.find((fact) => fact.category === "healthcare")?.name || "";
  const leadPlace = synthesised.provenance.find((fact) => fact.category === "landmarks" || fact.category === "community")?.name || "";
  const draftedHeading = localityArrangementCopy({
    areaSlug: input.areaSlug,
    areaName: input.areaName,
    pharmacyName,
    phone: String(ctx.profile.displayPhone || ctx.profile.phone || ""),
    serviceName: input.serviceName,
    address,
    premisesInArea: Boolean(premises) && premises.toLowerCase() === input.areaName.trim().toLowerCase(),
    leadHealthcare,
    leadPlace,
  });
  const arrangement = {
    ...draftedHeading,
    editorialHeading: editorialHeadingAlignedToCopy(
      draftedHeading.editorialHeading,
      input.areaName,
      synthesised.heroIntroduction,
      synthesised.localIntroduction,
    ),
  };
  const processSteps = contract.processSteps.map((step) => ({
    title: step.title,
    body: step.body,
    bullets: (step.bullets || []).map((bullet) => String(bullet).trim()).filter(Boolean),
  }));
  const draft: LocalClusterPageContent = {
    heroIntro: synthesised.heroIntroduction,
    localRelevanceHeading: arrangement.editorialHeading,
    localRelevanceIntro: "",
    localRelevanceBody: synthesised.localIntroduction,
    localRelevanceBullets: [...contract.considerBullets, ...contract.scopeBullets]
      .map((bullet) => String(bullet).trim())
      .filter(Boolean)
      .filter((bullet, index, all) => all.indexOf(bullet) === index)
      .slice(0, 8),
    whyChecksHeading: contract.explanationHeading,
    whyChecksBody: contract.explanationBody,
    whyChecksBullets: (contract.explanationBullets || []).map((bullet) => String(bullet).trim()).filter(Boolean),
    processHeading: contract.processHeading,
    processIntro: contract.processBody,
    processSteps,
    accessHeading: arrangement.addressHeading,
    accessBody: address ? `${pharmacyName} is at ${address}.` : "",
    clinicalEnvironmentHeading: contract.preparationHeading,
    clinicalEnvironmentBody: contract.preparationBody,
    preparationBullets: contract.preparationBullets.map((bullet) => String(bullet).trim()).filter(Boolean),
    eligibilityHeading: contract.scopeHeading,
    eligibilityBody: contract.scopeBody,
    eligibilityBullets: contract.scopeBullets.map((bullet) => String(bullet).trim()).filter(Boolean),
    trustHeading: contract.safetyHeading || `Preparing and staying safe with ${input.serviceName}`,
    trustBullets: contract.safetyBullets.map((bullet) => String(bullet).trim()).filter(Boolean),
    trustBody: contract.safetyBody,
    faqs: contract.faqs.slice(0, 6).map((faq) => ({
      question: String(faq.question || "").trim(),
      answer: faq.answer,
    })),
    ctaPrimary: "Contact the pharmacy",
    ctaSecondary: "Get directions",
    ctaPhonePrompt: arrangement.nextStep,
    contentFingerprint: synthesised.fingerprint,
    localIntelligenceUsed: true,
    narrativeType: `canonical-local-content-engine:${synthesised.synthesis}`,
    wordCountEstimate: 0,
    seoTitle: `${input.serviceName} for patients from ${input.areaName} | ${pharmacyName}`,
    metaDescription: synthesised.heroIntroduction.slice(0, 180),
    supportingHeading: contract.processHeading,
    supportingIntro: contract.processBody,
    supportingItems: processSteps.map((step) => ({
      title: step.title,
      body: step.body,
      evidence: "approved-service-intelligence",
      bullets: step.bullets,
    })),
    sectionEvidence: {
      "local-introduction": synthesised.provenance.map(
        (fact) => `${fact.name}|${fact.category}|${fact.provenance}`,
      ),
    },
    evidenceLimited: synthesised.sufficiency === "limited",
  };
  let content = finalizeLocalClusterPageContent(draft);
  content = cleanLocalContentForService(content, input);
  assertServiceIsolatedLocalClusterContent(content, input);
  content.wordCountEstimate = estimateWords(content);
  preparedCanonicalNarratives.set(canonicalNarrativeKey(input.serviceId, input.areaSlug), content);
  return content;
}

/** Canonical Narrative Planner V1. Grounded Gemini synthesis plus approved service facts. */
export async function composeCommercialClusterNarrativeV1(
  input: LocalClusterContentInput,
  ctx?: ContentGenerationContext,
): Promise<LocalClusterPageContent> {
  if (!ctx) {
    throw new Error("Canonical local content requires the campaign generation context.");
  }
  const contract = serviceSectionsForCanonicalNarrative(input, ctx);
  const synthesised = await synthesiseCanonicalGroundedLocalCopyV1({
    input,
    ctx,
    serviceMeaning: {
      conditionSet: contract.explanationBody,
      suitability: contract.scopeBody || contract.explanationBody,
      process: contract.processBody,
      safety: contract.safetyBody,
    },
  });
  return installValidatedCanonicalClusterNarrative(input, ctx, synthesised);
}

export function installSavedLocalIntroductionForRender(
  input: LocalClusterContentInput,
  ctx: ContentGenerationContext,
  copy: { heroIntroduction: string; localIntroduction: string; localCtaBridge?: string },
): LocalClusterPageContent {
  const phone = String(ctx.profile.displayPhone || ctx.profile.phone || "").trim();
  const bridge = String(copy.localCtaBridge || "").trim();
  const nextStep = /\bcontact\b/i.test(bridge)
    ? bridge
    : phone
      ? `Contact ${ctx.profile.pharmacyName} on ${phone} to ask how ${input.serviceName} is arranged.`
      : `Contact ${ctx.profile.pharmacyName} to ask how ${input.serviceName} is arranged.`;
  return installValidatedCanonicalClusterNarrative(input, ctx, {
    heroIntroduction: copy.heroIntroduction,
    localIntroduction: copy.localIntroduction,
    nextStep,
    provenance: [],
    sufficiency: "sufficient",
    fingerprint: copy.localIntroduction,
    synthesis: "requestUkLocalIntroductionProseV1",
  });
}

/** @deprecated Prefer composeCommercialClusterNarrativeV1 — kept as stable cluster builder alias. */
export async function buildLocalClusterPageContent(
  input: LocalClusterContentInput,
  ctx?: ContentGenerationContext,
): Promise<LocalClusterPageContent> {
  return composeCommercialClusterNarrativeV1(input, ctx);
}

export function contentHasAreaPrefix(text: string, areaName: string): boolean {
  const escaped = areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}\\s*:`, "i").test(text.trim());
}
