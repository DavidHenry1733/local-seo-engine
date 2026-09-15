/**
 * Local cluster page content — Content Engine V1 canonical cluster narrative planner.
 * Single production pipeline for all services:
 * - Pharmacy First → dedicated locality intelligence narrative
 * - All other services → service variant pack via selectAreaVariants (no BP-family fallback)
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
import { composeApprovedBankLocalityDirectDraft } from "./pharmacyApprovedBankLocalityDirectRender.ts";
import { buildPharmacyFirstLocalNarrative } from "./pharmacyFirstLocalNarrative.ts";
import { usesPharmacyFirstPatientJourneyLocalTemplate } from "./pharmacyLocalPageTypeContracts.ts";
import { getLocalityVariationSessionV1 } from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
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
  ctx?: ContentGenerationContext,
): LocalClusterPageContent {
  const key = resolveTenantProfileSlug(input.slug) || input.slug;
  const profile = ctx?.profile ?? buildPharmacyServicePageProfile(key);
  const pharmacyName = profile.pharmacyName;
  const town = profile.town || "";

  const selected = isApprovedBankRegisteredService(input.serviceId)
    ? selectRegisteredApprovedBank(input.serviceId)
    : null;
  const boundPackMatchesRegistry =
    Boolean(selected?.registered) &&
    Boolean(selected?.hash) &&
    ctx?.approvedBankHash === selected?.hash &&
    ctx?.variantPack?.serviceId === input.serviceId;
  const pack = selected?.registered
    ? boundPackMatchesRegistry
      ? ctx!.variantPack
      : selected.pack
    : ctx?.variantPack ?? loadServiceVariantPack(input.serviceId);
  if (!pack || pack.serviceId !== input.serviceId) {
    throw new Error(
      `No service-specific locality content bank for service "${input.serviceId}". Refusing silent cross-service fallback.`,
    );
  }
  if (!pack.faqs?.length || !pack.intro?.length || !pack.cta?.length) {
    throw new Error(
      `Incomplete service variant pack for "${input.serviceId}" (intro/FAQ/CTA banks required).`,
    );
  }

  const ctxInject = (text: string) =>
    stripAreaPrefixCopy(
      injectServiceContext(text, pharmacyName, input.areaName, town, input.serviceName),
      input.areaName,
    );

  // Shared locality evidence allocation — service banks stay intact; place facts are injected.
  const verified = ctx
    ? bindVerifiedLocalityEvidenceV1({
        ctx,
        areaName: input.areaName,
        areaSlug: input.areaSlug,
        siblingLocalities: (input.siblingLocalities?.length
          ? input.siblingLocalities
          : input.nearbyAreaNames.map((name, i) => ({
              areaName: name,
              areaSlug: input.areaSlugsInCluster[i] || name.toLowerCase(),
            }))
        ).concat(
          input.siblingLocalities?.some((s) => s.areaSlug === input.areaSlug)
            ? []
            : [{ areaName: input.areaName, areaSlug: input.areaSlug, ...input.localityRecord }],
        ),
        localityRecord: input.localityRecord,
      })
    : null;
  const localityEvidence = allocateLocalityEvidenceV1({
    areaName: input.areaName,
    areaSlug: input.areaSlug,
    pharmacyName,
    serviceName: input.serviceName,
    displayPhone: profile.displayPhone || profile.phone,
    pharmacyAddress: profile.fullAddress || profile.customerFacingAddress || "",
    nearbyAreaNames: verified?.nearbyLocalities.map((n) => n.areaName) || input.nearbyAreaNames,
    areaSlugsInCluster: input.areaSlugsInCluster,
    areaDiscovery: ctx?.areaDiscovery,
    verified,
  });

  const selectedSiblings: LocalitySiblingFact[] = siblingFactsFromCampaignContext(ctx);
  const selfArea = selectedSiblings.find((s) => s.areaSlug === input.areaSlug);
  const uniqueInventory = buildLocalityEvidenceInventory({
    areaName: input.areaName,
    areaSlug: input.areaSlug,
    pharmacyName,
    pharmacyAddress: profile.fullAddress || profile.customerFacingAddress || "",
    serviceName: input.serviceName,
    displayPhone: profile.displayPhone || profile.phone,
    verified,
    selectedSiblings: selectedSiblings.length
      ? selectedSiblings
      : [
          {
            areaName: input.areaName,
            areaSlug: input.areaSlug,
            distanceKm: verified?.distanceKm ?? null,
            distanceLabel: verified?.distanceLabel || "",
          },
          ...(verified?.nearbyLocalities || []).map((n) => ({
            areaName: n.areaName,
            areaSlug: n.areaSlug,
            distanceKm: n.distanceKm,
            distanceLabel: "",
          })),
        ],
    areaType: selfArea?.areaType,
    order: selfArea?.order,
  });
  const uniqueNarrative = buildUniqueLocalityNarrative(uniqueInventory);

  const localityContract = buildApprovedBankLocalityPageContract(
    pack,
    input.areaSlug,
    input.areaSlugsInCluster,
  );
  void localityEvidence;

  // Unique evidence-backed locality intro (patient-facing; do not expand "the pharmacy" to the full trading name).
  const heroIntro = uniqueNarrative.heroIntro;

  const whyChecksHeading = ctxInject(localityContract.explanationHeading);
  const whyChecksBody = weaveLocalityOnce(ctxInject(localityContract.explanationBody), input.areaName);
  const whyChecksBullets: string[] = [];

  const verifiedEntity =
    verified?.healthcare.find((e) => e.name?.trim()) ||
    verified?.landmarks.find((e) => e.name?.trim()) ||
    verified?.community.find((e) => e.name?.trim()) ||
    verified?.schools.find((e) => e.name?.trim()) ||
    null;
  const localWeave = verifiedEntity?.name
    ? `${verifiedEntity.name} is a recognised place in ${input.areaName}; it does not change how ${input.serviceName} is arranged.`
    : "";

  const considerFull = weaveLocalityOnce(ctxInject(localityContract.considerBody), input.areaName);
  const considerSentences = considerFull.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const localRelevanceHeading = ctxInject(localityContract.considerHeading);
  const localRelevanceIntro = considerSentences[0] || "";
  const localRelevanceBody = [
    considerSentences.slice(1).join(" "),
    ctxInject(localityContract.scopeBody),
    localWeave,
  ]
    .filter(Boolean)
    .join("\n\n");
  const localRelevanceBullets = [...localityContract.considerBullets, ...localityContract.scopeBullets]
    .map(ctxInject)
    .filter(Boolean)
    .filter((b, i, arr) => arr.indexOf(b) === i)
    .slice(0, 8);

  const processSteps = (localityContract.processSteps.length
    ? localityContract.processSteps.map((step) => ({
        title: ctxInject(step.title),
        body: ctxInject(step.body),
      }))
    : buildPackProcessStepsFromBank(
        pack.howItWorks?.[0],
        pack.treatmentProcess?.[0],
      )
  ).filter((step) => step.title && step.body);
  const howHeading = ctxInject(localityContract.processHeading);
  const howBody = ctxInject(localityContract.processBody);

  const clinicalEnvironmentHeading = ctxInject(localityContract.preparationHeading);
  const clinicalEnvironmentBody = ctxInject(localityContract.preparationBody);
  const preparationBullets = localityContract.preparationBullets.map(ctxInject).filter(Boolean);

  const trustHeading = ctxInject(localityContract.safetyHeading);
  const trustBody = ctxInject(localityContract.safetyBody)
    .replace(/\bsignposts?\b/gi, "advise you to contact")
    .replace(/\breferral if needed\b/gi, "further advice if needed");
  const trustBullets = localityContract.safetyBullets.map(ctxInject).filter(Boolean);

  const faqsRaw = localityContract.faqs.length
    ? localityContract.faqs
    : pickServiceVariantFaqs(pack.faqs, input.serviceId, input.areaSlug, 8, input.areaSlugsInCluster);
  if (!faqsRaw.length) {
    throw new Error(`Service FAQ bank empty after selection for "${input.serviceId}" / ${input.areaSlug}.`);
  }
  const faqs = faqsRaw.map((f, i) => ({
    question: localizeFaqQuestion(
      stripAreaPrefixCopy(f.question, input.areaName),
      input.areaName,
      input.areaSlug,
      i,
      input.serviceId,
    ),
    answer: ctxInject(f.answer)
      .replace(/\bsignposts?\b/gi, "advise you to contact")
      .replace(/\breferral if needed\b/gi, "further advice if needed"),
  }));

  // CTA wording — keep contact process simple; do not inject full pharmacy name repeatedly.
  const ctaPrimary = "Contact the pharmacy";
  const ctaSecondary = "Get directions";
  const ctaPhonePrompt = uniqueNarrative.confirmBody;
  const accessHeading = uniqueNarrative.accessHeading;
  const accessBody = uniqueNarrative.accessBody;

  // Visible process copy only — commercial polish markers must not collapse bank sections.
  const processIntro = howBody;

  return {
    heroIntro,
    localRelevanceHeading,
    localRelevanceIntro,
    localRelevanceBody,
    localRelevanceBullets,
    whyChecksHeading,
    whyChecksBody,
    whyChecksBullets,
    processHeading: howHeading,
    processIntro,
    processSteps,
    accessHeading,
    accessBody,
    clinicalEnvironmentHeading,
    clinicalEnvironmentBody,
    preparationBullets,
    eligibilityHeading: ctxInject(localityContract.scopeHeading),
    eligibilityBody: ctxInject(localityContract.scopeBody),
    eligibilityBullets: localityContract.scopeBullets.map(ctxInject).filter(Boolean),
    trustHeading,
    trustBullets,
    trustBody,
    faqs,
    ctaPrimary,
    ctaSecondary,
    ctaPhonePrompt,
    contentFingerprint: "",
    localIntelligenceUsed: true,
    narrativeType: `service-variant-pack:${input.serviceId}`,
    wordCountEstimate: 0,
    seoTitle: uniqueNarrative.seoTitle,
    metaDescription: uniqueNarrative.metaDescription,
    supportingHeading: howHeading,
    supportingIntro: (howBody.split(/(?<=[.!?])\s+/)[0] || howBody).trim(),
    supportingItems: [
      ...processSteps.map((step) => ({
        title: step.title,
        body: step.body,
        evidence: "approved-bank-process",
      })),
      ...(clinicalEnvironmentBody
        ? [
            {
              title: clinicalEnvironmentHeading || "How to prepare",
              body: [clinicalEnvironmentBody, ...preparationBullets].filter(Boolean).join(" "),
              evidence: "approved-bank-preparation",
            },
          ]
        : []),
    ],
    nearbyLocalityLinks: verified?.nearbyLocalities || [],
    sectionEvidence: verified?.sectionEvidence,
    evidenceLimited: verified?.evidenceLimited,
  };
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

/** Canonical Narrative Planner V1 — cluster page purpose. */
export function composeCommercialClusterNarrativeV1(
  input: LocalClusterContentInput,
  ctx?: ContentGenerationContext,
): LocalClusterPageContent {
  if (usesPharmacyFirstPatientJourneyLocalTemplate(input.serviceId) && ctx) {
    const sessionStrategy = getLocalityVariationSessionV1()?.forceStrategyBySlug.get(input.areaSlug);
    return buildPharmacyFirstLocalNarrative(input, ctx, {
      forceStrategy: sessionStrategy || "patient-journey-led",
    });
  }
  if (isApprovedBankRegisteredService(input.serviceId)) {
    return composeApprovedBankLocalityDirectDraft(input, ctx);
  }

  const pharmacyName =
    ctx?.profile.pharmacyName ||
    buildPharmacyServicePageProfile(resolveTenantProfileSlug(input.slug) || input.slug).pharmacyName;

  // Service-to-locality router: unregistered services still use the shared composer.
  const draft = composeServiceVariantPackClusterDraft(input, ctx);

  return finalizeCommercialClusterPipeline(draft, input, ctx, pharmacyName);
}

/** @deprecated Prefer composeCommercialClusterNarrativeV1 — kept as stable cluster builder alias. */
export function buildLocalClusterPageContent(
  input: LocalClusterContentInput,
  ctx?: ContentGenerationContext,
): LocalClusterPageContent {
  return composeCommercialClusterNarrativeV1(input, ctx);
}

export function contentHasAreaPrefix(text: string, areaName: string): boolean {
  const escaped = areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*${escaped}\\s*:`, "i").test(text.trim());
}
