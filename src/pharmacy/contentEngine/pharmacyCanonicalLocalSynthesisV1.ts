/**
 * Narrow adapter onto the existing Gemini local-introduction writer.
 * It does not define a second writer, prompt, or evidence contract.
 * composeCommercialClusterNarrativeV1 is the only production caller.
 */
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import {
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
  type BusinessLocalityCopyInputV3,
  type EditorialFactForPromptV3,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { validateAiLocalCopyPilotV3 } from "./pharmacyAiLocalNarrativeEngineV3.ts";
import { loadLocalEvidencePackForGeneration } from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  assessLocalityEvidenceSufficiency,
  buildLocalityIntelligenceV1,
  selectLocalityIntelligenceForSynthesis,
  type LocalityIntelligenceFactV1,
} from "./pharmacyLocalityIntelligenceV1.ts";
import { stripIdentityTokens } from "./pharmacyLocalPageCandidateUniquenessV1.ts";
import { bindVerifiedLocalityEvidenceV1 } from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import {
  copyFromLocalIntroductionProse,
  requestUkLocalIntroductionProseV1,
  type UkLocalIntroductionCorrectionV1,
} from "./pharmacyUkLocalIntroductionProseWriterV1.ts";
import {
  shouldAttemptAcceptedGeminiCopyCorrection,
} from "./pharmacyGroundedGeminiLocalCopyValidationV1.ts";
import { getLocalityVariationSessionV1, setSessionAiLocalCopy } from "./pharmacyLocalityVariationSessionV1.ts";

export type CanonicalLocalSynthesisInputV1 = {
  slug: string;
  serviceId: string;
  serviceName: string;
  areaName: string;
  areaSlug: string;
  nearbyAreaNames: string[];
  areaSlugsInCluster: string[];
  siblingLocalities?: Array<{
    areaName: string;
    areaSlug: string;
    distanceLabel?: string;
    relationship?: string;
    evidence?: string[];
    source?: string;
  }>;
  localityRecord?: {
    distanceLabel?: string;
    relationship?: string;
    evidence?: string[];
    source?: string;
  };
};

export const CANONICAL_LOCAL_SYNTHESIS_ID = "requestUkLocalIntroductionProseV1" as const;

const EVIDENCE_SYSTEM_LANGUAGE =
  /\b(verified healthcare location|verified community location|verified local place|verified transport location|verified evidence|evidence sufficiency|this page does not estimate|provided at the pharmacy, not at|\bprovenance\b)\b/i;

const UNSUPPORTED_DISTANCE =
  /\b(\d+(?:\.\d+)?\s*km\b|kilometres?|minutes away|journey time|driving route|straight[- ]line)\b/i;

export type CanonicalGroundedLocalCopyV1 = {
  synthesis: typeof CANONICAL_LOCAL_SYNTHESIS_ID;
  heroIntroduction: string;
  localIntroduction: string;
  nextStep: string;
  sufficiency: "sufficient" | "limited";
  provenance: LocalityIntelligenceFactV1[];
  fingerprint: string;
};

function clean(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function editorialCategory(category: string): string {
  if (category === "healthcare") return "healthcare";
  if (category === "landmarks") return "heritage";
  if (category === "transport") return "community";
  return "community";
}

function editorialFacts(areaName: string, facts: LocalityIntelligenceFactV1[]): EditorialFactForPromptV3[] {
  return facts.map((fact, index) => ({
    factId: `local-fact-${index + 1}`,
    category: editorialCategory(fact.category),
    normalizedStatement: fact.address
      ? `${fact.name} is in ${areaName}, at ${fact.address}.`
      : `${fact.name} is in ${areaName}.`,
    permittedCopyRole: "mention only where it helps a patient understand the local setting",
    prohibitedInference: "Do not invent a referral, partnership, demand, distance or journey.",
    sourceClass: "primary",
    publisher: fact.provenance,
  }));
}

function previousFingerprints(input: CanonicalLocalSynthesisInputV1): string[] {
  const session = getLocalityVariationSessionV1();
  if (!session) return [];
  const fingerprints: string[] = [];
  for (const [slug, copy] of session.aiCopyBySlug) {
    if (slug === input.areaSlug) continue;
    const text = clean(`${copy.heroIntroduction}\n${copy.localIntroduction}`);
    if (!text) continue;
    fingerprints.push(
      stripIdentityTokens(text, {
        pharmacyName: "",
        areaName: copy.localContextHeading || slug,
        siblingAreaNames: input.nearbyAreaNames,
      }),
    );
  }
  return fingerprints;
}

function rememberCopy(input: CanonicalLocalSynthesisInputV1, hero: string, local: string): void {
  setSessionAiLocalCopy(input.areaSlug, {
    heroIntroduction: hero,
    localContextHeading: input.areaName,
    localIntroduction: local,
    localContextParagraphs: [],
    relationshipToPharmacy: "",
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
  });
}

function extraGroundingFailures(text: string, facts: LocalityIntelligenceFactV1[]): string[] {
  const failures: string[] = [];
  if (EVIDENCE_SYSTEM_LANGUAGE.test(text)) failures.push("evidence-system terminology");
  if (UNSUPPORTED_DISTANCE.test(text)) failures.push("unsupported distance or journey claim");
  for (const fact of facts) {
    const count = text.match(new RegExp(fact.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"))?.length || 0;
    if (count > 2) failures.push(`entity padding: ${fact.name} appears ${count} times`);
  }
  return failures;
}

function buildCopyInput(
  input: CanonicalLocalSynthesisInputV1,
  ctx: ContentGenerationContext,
  facts: LocalityIntelligenceFactV1[],
  serviceMeaning: { conditionSet: string; suitability: string; process: string; safety: string },
): BusinessLocalityCopyInputV3 {
  const profile = ctx.profile;
  const locked =
    input.serviceId === "pharmacy-first"
      ? PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1
      : {
          ...PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
          serviceName: input.serviceName,
          serviceId: input.serviceId,
          conditionSet: serviceMeaning.conditionSet,
          suitability: serviceMeaning.suitability,
          process: serviceMeaning.process,
          safety: serviceMeaning.safety,
          allowedCta: ["Contact the pharmacy", "Call the pharmacy"],
        };
  return {
    vertical: "pharmacy",
    tenantSlug: ctx.resolvedSlug,
    business: {
      name: profile.pharmacyName,
      telephone: profile.displayPhone || profile.phone || "",
      website: profile.website || "",
      address: profile.fullAddress || profile.customerFacingAddress || "",
      coordinates: null,
      marketTown: profile.town || "",
    },
    offer: {
      serviceName: input.serviceName,
      serviceId: input.serviceId,
      lockedClinicalFacts: locked,
      allowedCta: [...locked.allowedCta],
    },
    locality: {
      areaName: input.areaName,
      areaSlug: input.areaSlug,
      distanceLabel: "",
      distanceKm: null,
      cardinalDirection: "",
      pharmacyIsInArea: false,
      neighbouringSelectedAreas: input.nearbyAreaNames,
      evidenceLimitations: [],
      acceptedEntities: facts.map((fact, index) => ({
        entityId: `local-fact-${index + 1}`,
        name: fact.name,
        category: fact.category,
        address: fact.address,
        coordinates: null,
        attributionRelationship: fact.relationship || "verified-local-place",
        provider: fact.provenance,
      })),
    },
    style: { roles: ["patient"], tone: "neutral factual British English" },
    editorialFacts: editorialFacts(input.areaName, facts),
    editorialSufficiency: "READY",
    ukLocalIntroductionStyle: {
      id: "gemini-local-introduction",
      label: "Gemini local introduction",
      instruction: "Write a natural local introduction to the service. Local places are optional. Zero place mentions is valid. Mention a place only when it materially helps the patient.",
    },
    previousLocalContextFingerprints: previousFingerprints(input),
  };
}

export async function synthesiseCanonicalGroundedLocalCopyV1(opts: {
  input: CanonicalLocalSynthesisInputV1;
  ctx: ContentGenerationContext;
  serviceMeaning: { conditionSet: string; suitability: string; process: string; safety: string };
}): Promise<CanonicalGroundedLocalCopyV1> {
  const key = opts.ctx.resolvedSlug || opts.input.slug;
  const verified = bindVerifiedLocalityEvidenceV1({
    ctx: opts.ctx,
    areaName: opts.input.areaName,
    areaSlug: opts.input.areaSlug,
    siblingLocalities: opts.input.siblingLocalities?.length
      ? opts.input.siblingLocalities
      : opts.input.nearbyAreaNames.map((name, index) => ({
          areaName: name,
          areaSlug: opts.input.areaSlugsInCluster[index] || name.toLowerCase(),
        })),
    localityRecord: opts.input.localityRecord,
  });
  const packLoaded = loadLocalEvidencePackForGeneration(key, opts.input.areaName, opts.input.areaSlug);
  const intelligence = buildLocalityIntelligenceV1({
    areaName: opts.input.areaName,
    areaSlug: opts.input.areaSlug,
    tenantSlug: key,
    pack: packLoaded.ok ? packLoaded.pack : null,
    geographic: {
      distanceLabel: verified.distanceLabel || "",
      distanceProvenance: verified.distanceProvenance || "",
      cardinalDirection: verified.cardinalDirection || "",
      directionProvenance: verified.directionProvenance || "",
      pharmacyAddress: opts.ctx.profile.fullAddress || opts.ctx.profile.customerFacingAddress || "",
      pharmacyAddressProvenance: opts.ctx.profile.fullAddress ? "profile:pharmacy-address" : "",
    },
  });
  const sufficiency = assessLocalityEvidenceSufficiency(intelligence);
  if (sufficiency.classification === "insufficient") {
    throw new Error(
      `Locality evidence is insufficient for ${opts.input.areaName}: ${sufficiency.missing.join("; ")}`,
    );
  }
  const facts = selectLocalityIntelligenceForSynthesis(intelligence);
  const copyInput = buildCopyInput(opts.input, opts.ctx, facts, opts.serviceMeaning);
  const phone = clean(opts.ctx.profile.displayPhone || opts.ctx.profile.phone || "");
  const nextStep = phone
    ? `Contact ${opts.ctx.profile.pharmacyName} on ${phone} to ask how ${opts.input.serviceName} is arranged.`
    : `Contact ${opts.ctx.profile.pharmacyName} to ask how ${opts.input.serviceName} is arranged.`;

  const runOnce = async (correction?: UkLocalIntroductionCorrectionV1) => {
    const gemini = await requestUkLocalIntroductionProseV1(copyInput, correction);
    const parsed = copyFromLocalIntroductionProse(
      opts.input.areaName,
      gemini.introduction,
      gemini.heroIntroduction,
    );
    const hay = `${gemini.heroIntroduction}\n${gemini.introduction}`;
    if (!parsed) {
      return { ok: false as const, failures: ["local introduction prose could not be parsed"], hero: gemini.heroIntroduction, local: gemini.introduction };
    }
    const validated = validateAiLocalCopyPilotV3(
      parsed,
      copyInput,
      [],
      copyInput.previousLocalContextFingerprints || [],
      null,
    );
    const failures = [...validated.failures, ...extraGroundingFailures(hay, facts)];
    return {
      ok: failures.length === 0,
      failures: [...new Set(failures)],
      hero: gemini.heroIntroduction,
      local: gemini.introduction,
    };
  };

  let result = await runOnce();
  if (!result.ok && shouldAttemptAcceptedGeminiCopyCorrection({ failures: result.failures })) {
    result = await runOnce({
      rejectedCopy: `${result.hero}\n\n${result.local}`,
      defects: result.failures,
    });
  }
  if (!result.ok) {
    throw new Error(
      `Grounded local synthesis failed for ${opts.input.areaName}: ${result.failures.slice(0, 8).join("; ")} :: ${clean(`${result.hero} ${result.local}`).slice(0, 500)}`,
    );
  }
  rememberCopy(opts.input, result.hero, result.local);
  const fingerprint = stripIdentityTokens(`${result.hero}\n${result.local}`, {
    pharmacyName: opts.ctx.profile.pharmacyName,
    areaName: opts.input.areaName,
    telephone: phone,
    address: opts.ctx.profile.fullAddress || "",
    siblingAreaNames: opts.input.nearbyAreaNames,
  });
  return {
    synthesis: CANONICAL_LOCAL_SYNTHESIS_ID,
    heroIntroduction: clean(result.hero),
    localIntroduction: clean(result.local),
    nextStep,
    sufficiency: sufficiency.classification,
    provenance: facts,
    fingerprint,
  };
}
