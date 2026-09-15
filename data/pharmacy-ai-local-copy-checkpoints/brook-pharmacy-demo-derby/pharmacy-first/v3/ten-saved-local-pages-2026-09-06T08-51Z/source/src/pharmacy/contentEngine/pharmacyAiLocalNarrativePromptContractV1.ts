/**
 * Versioned reusable AI local-narrative prompt contract.
 * Generic business + locality input; pharmacy is the first vertical.
 */
import {
  assembleDeterministicHeroHeading,
  assembleDeterministicHeroIntroduction,
  assembleDeterministicLocalIntroduction,
  assembleDeterministicRelationshipToPharmacy,
  buildContentGenerationFieldPlan,
  CONTENT_GENERATION_FIELD_POLICY_ID,
  CONTENT_GENERATION_FIELD_POLICY_VERSION,
  formatStraightLineKm,
  type ContentGenerationEvidenceInput,
} from "./pharmacyContentGenerationFieldPolicyV1.ts";
import type { AiLocalCopyV1, AiLocalCopyV3 } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  UK_LOCAL_PAGE_CONTENT_CONTRACT_ID,
  UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION,
  buildUkLocalPageWriterContractPayload,
  premisesAddressLooksUnverified,
} from "./pharmacyUkLocalPageContentContractV1.ts";

export const AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID = "pharmacy-ai-local-narrative-prompt-v1";
export const AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH =
  "src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
export const AI_LOCAL_NARRATIVE_PROMPT_VERSION = "v1";

export const ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3 =
  "Pharmacy First can help with eligible common conditions.";

export const PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3 = [
  "convenient",
  "efficiently",
  "easy reach",
  "within easy reach",
  "prompt support",
  "avoid delays",
  "avoid unnecessary delays",
  "without unnecessary delay",
  "another option",
  "known for",
  "community resources",
  "support your health locally",
  "established local healthcare",
  "community networks",
  "healthcare networks",
  "a range of support",
  "have access to a range of support",
] as const;

export const PHARMACY_FIRST_LOCAL_NARRATIVE_WRITER_RULE_V3 =
  "Local factual sentences in localContextParagraphs, localContextHeading, localAccessIntroduction, localFaqs and localCtaBridge may use only facts supplied in that area’s validated evidence pack, confirmed pharmacy-profile facts, and approved renderer-owned clinical text. When no supporting fact exists for a field, omit that claim or section. Do not pad a field. Do not add generic claims about neighbourhood boards, established networks, community support, healthcare access, convenience, availability, travel or local relationships. Do not infer that the selected area is part of, sits in, or belongs to premisesLocality, marketTown, or a parent town unless that exact relationship is a verifiedEditorialFact statement. Each local factual sentence must cite the supplied verifiedEditorialFacts.factId in evidenceClaims.editorialFactId for validation. Never print fact IDs, publishers, URLs or provenance in customer-facing fields.";

export const PHARMACY_FIRST_LOCAL_CONTEXT_WRITER_RULE_V3 = PHARMACY_FIRST_LOCAL_NARRATIVE_WRITER_RULE_V3;

export const PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1 = {
  serviceName: "Pharmacy First",
  serviceId: "pharmacy-first",
  conditionSet:
    "sore throat, earache, impetigo, infected insect bites, shingles, sinusitis, and uncomplicated UTI in eligible women",
  suitability:
    "The pharmacist confirms what can be assessed on the day. Eligibility depends on symptoms and NHS pathway criteria, not on the area the patient travels from.",
  process:
    "Call before visiting to check how a consultation is being arranged. The pharmacist reviews symptoms, medicines and red-flag concerns. Outcomes may include treatment where appropriate, self-care advice, safety-netting, or referral.",
  safety:
    "Seek urgent medical care for breathing difficulties, chest pain, severe dehydration, confusion, a non-blanching rash, or any emergency symptoms that make you feel critically unwell.",
  allowedCta: ["Book An Appointment", "Call the pharmacy", "Get directions"],
};

export type BusinessLocalityCopyInputV1 = {
  vertical: string;
  business: {
    name: string;
    telephone: string;
    website: string;
    address: string;
    coordinates: { latitude: number; longitude: number } | null;
    marketTown: string;
  };
  offer: {
    serviceName: string;
    serviceId: string;
    lockedClinicalFacts: typeof PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1;
    allowedCta: string[];
  };
  locality: {
    areaName: string;
    areaSlug: string;
    distanceLabel: string;
    distanceKm: number | null;
    cardinalDirection: string;
    pharmacyIsInArea: boolean;
    neighbouringSelectedAreas: string[];
    evidenceLimitations: string[];
    acceptedEntities: Array<{
      entityId: string;
      name: string;
      category: string;
      address: string;
      coordinates: { latitude: number; longitude: number } | null;
      attributionRelationship: string;
      provider: string;
    }>;
  };
  style: {
    roles: string[];
    tone: string;
  };
  varietyHints?: string[];
};

export function buildAiLocalNarrativeSystemPromptV1(vertical = "pharmacy"): string {
  return [
    `You write structured JSON local-page copy for a ${vertical} business.`,
    "Write professional British English for patients or customers. Be concise and useful.",
    "Vary wording naturally. Do not synonym-stuff. Do not pad for length or uniqueness.",
    "Local entities are optional. Mention an entity only when it gives useful orientation or healthcare context.",
    "Do not force schools, retailers or landmarks into the copy.",
    "Do not say or imply that the reader uses, is registered at, or attends a named GP practice or medical organisation.",
    "Do not assume GP waiting times, routines, demographics, parking, journey times, opening hours or availability unless those facts are supplied.",
    "Do not imply a named organisation works with, refers to, or is affiliated with the business.",
    "Do not explain why a place was mentioned. Do not write defensive disclaimers about affiliation, evidence or recommendations.",
    "Do not use internal terminology (evidence packs, attribution, provenance, uniqueness, databases).",
    "Do not invent facts. Do not rewrite locked clinical facts. Do not output HTML.",
    "Never copy field notes, task instructions, schema examples or prohibitions into the copy.",
    "Default to omitting local organisations. Do not mention GP practices, libraries, schools or landmarks unless one fact uniquely helps the reader find the pharmacy, for example that it stands next door.",
    "Never say people in the area often visit or use the pharmacy. You may say they can use the pharmacy at the supplied address.",
    "Never mention GP waiting. Never claim same-day availability. State verified distance in kilometres only, without calling the journey short or easy.",
    "Do not copy prompt instructions into the output. Never write 'in-area premises', 'supplied address', or 'travelling from the area to the supplied address'.",
    "Return only valid JSON matching the required schema. evidenceClaims items must be {field, sentence, entityId?} — never {claim}. No markdown.",
  ].join(" ");
}

export function buildAiLocalNarrativeUserPromptV1(input: BusinessLocalityCopyInputV1): string {
  const locked = input.offer.lockedClinicalFacts;
  const body = {
    task: "Write isolated local-page copy for one selected area. Do not write shared clinical sections.",
    schemaFields: [
      "area",
      "heroHeading",
      "heroIntroduction",
      "localIntroduction",
      "localContextHeading",
      "localContextParagraphs",
      "relationshipToPharmacy",
      "localAccessIntroduction",
      "localFaqs",
      "localCtaBridge",
      "evidenceClaims",
      "evidenceEntityIdsUsed",
    ],
    fieldNotes: {
      area: "Must equal the selected area name exactly.",
      heroHeading: "Short patient-facing heading. Do not invent a different service name.",
      heroIntroduction:
        "Two short sentences. Relevance of the service for people in this area, then how to get in touch.",
      localIntroduction:
        "One or two sentences placing the area relative to the pharmacy using only supplied distance/address facts.",
      localContextHeading: "Natural section heading for local context. Not 'Evidence' or 'Local landmarks'.",
      localContextParagraphs:
        "1–2 short paragraphs about using Pharmacy First from this area. Do not inventory medical centres, libraries, schools or landmarks. Do not mention GP waiting.",
      relationshipToPharmacy: input.locality.pharmacyIsInArea
        ? "Write one or two finished patient-facing sentences stating that the pharmacy is in this area. Use the supplied name and address. Do not write the words in-area premises or supplied address."
        : "Write one or two finished patient-facing sentences stating that people in this area go to the pharmacy at the given address. Include the area name and full address. Do not write the words supplied address or in-area premises.",
      localAccessIntroduction:
        "How to contact before visiting. Do not repeat the same call-before-visiting sentence already used in the hero.",
      localFaqs:
        "3–5 useful questions for this area (distance, calling ahead, what happens if not suitable). Answers must stay grounded.",
      localCtaBridge: "One sentence bridging to Book An Appointment / Call. Do not invent availability.",
      evidenceClaims:
        'Array of objects with ONLY these keys: "field" (schema field name), "sentence" (exact sentence), optional "entityId" from acceptedEntities. Example: [{"field":"localIntroduction","sentence":"The pharmacy is at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK."}]. Do not use a "claim" key. Empty array is allowed.',
      evidenceEntityIdsUsed:
        "Array of acceptedEntities.entityId strings that you actually named in the copy. Empty array if you named none.",
    },
    business: input.business,
    offer: {
      serviceName: input.offer.serviceName,
      serviceId: input.offer.serviceId,
      allowedCta: input.offer.allowedCta,
      lockedClinicalFacts: locked,
      clinicalBoundary:
        "Locked clinical facts are for your awareness only. Do not rewrite them and do not list the condition set. The renderer will print approved condition, process and safety copy. You may mention that Pharmacy First can help with eligible common conditions.",
    },
    locality: input.locality,
    style: input.style,
    varietyHints: [
      `This is ${input.locality.areaName}. Write a distinct opening. Do not reuse another area's first sentence.`,
      ...(input.varietyHints || []).slice(0, 3),
    ],
    prohibitions: [
      "rejected evidence",
      "other areas' evidence",
      "invented organisations",
      "schools or retailers unless they uniquely help the reader find or choose the service — usually omit them",
      "recorded school context / landmark list / map of local buildings",
      "GP waiting times, busy GP lists, or waiting for a routine GP appointment",
      "people in this area often visit",
      "your local GP surgery such as [name]",
      "same-day availability unless supplied",
      "repeating the same call-before-visiting sentence",
    ],
  };
  return JSON.stringify(body, null, 2);
}

export const AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V2 = "pharmacy-ai-local-narrative-prompt-v2";
export const AI_LOCAL_NARRATIVE_PROMPT_VERSION_V2 = "v2";

export const AI_EVIDENCE_SELECTION_CLASSES_V2 = [
  "useful-healthcare-context",
  "useful-access-orientation",
  "useful-community-orientation",
  "irrelevant-to-patient-decision",
  "unsafe-or-ambiguous",
] as const;

export type AiEvidenceSelectionClassV2 = (typeof AI_EVIDENCE_SELECTION_CLASSES_V2)[number];

export function usefulLocalEvidenceEntitiesV2(
  input: BusinessLocalityCopyInputV1,
): BusinessLocalityCopyInputV1["locality"]["acceptedEntities"] {
  const area = input.locality.areaName.trim().toLowerCase();
  return input.locality.acceptedEntities.filter((entity) => {
    if (entity.category === "schools" || entity.category === "retail") return false;
    if (entity.name.trim().toLowerCase() === area) return false;
    return true;
  });
}

export function classifyEvidenceRichnessV2(
  input: BusinessLocalityCopyInputV1,
): "sparse" | "medium" | "rich" {
  const n = usefulLocalEvidenceEntitiesV2(input).length;
  if (n <= 1) return "sparse";
  if (n <= 5) return "medium";
  return "rich";
}

export function minimumUsefulEntitiesRequiredV2(input: BusinessLocalityCopyInputV1): number {
  const richness = classifyEvidenceRichnessV2(input);
  if (richness === "rich") return 2;
  if (richness === "medium") return 1;
  return 0;
}

export function buildAiLocalNarrativeSystemPromptV2(vertical = "pharmacy"): string {
  return [
    `You write a useful local edition of an approved Pharmacy First page for a ${vertical} business.`,
    "You are not inserting place names for coverage. You are answering a patient who lives in, or is deciding from, this one area.",
    "Write professional British English. Produce one coherent editorial narrative.",
    "The local writing must answer: why this page is relevant to someone in this particular area; where the pharmacy is in relation to the area; which verified local facts genuinely help the reader understand that relationship; what the reader should do if Pharmacy First may be suitable; when the reader should use another healthcare route.",
    "Do not produce interchangeable paragraphs with a different area name swapped in.",
    "Classify every supplied evidence entity before writing copy. Return evidenceSelection covering every entity, then the copy fields.",
    "Do not force every entity into the page. Do not omit every meaningful entity merely because safety wording is difficult.",
    "Healthcare entities may describe the verified local healthcare landscape. They must not imply partnership, referral, endorsement, that the reader uses that practice, or waiting times.",
    "Stations and transport locations may give neutral area or access orientation. They must not create routes, journey times, timetable claims or accessibility claims.",
    "Community facilities or landmarks may be used only when they help orient the reader naturally. Do not produce an entity list. Do not turn a park or mill into directions.",
    "Schools and retailers should normally be omitted. Classify them irrelevant-to-patient-decision unless they uniquely help the reader find the pharmacy (next door, opposite, same street).",
    "For sparse evidence, write concise factual locality copy. Do not pad.",
    "For medium or rich evidence, you must use enough useful entities in the copy. evidenceEntityIdsUsed must not be empty.",
    "Vary paragraph purpose. Introduction, local context, access passage and FAQs must each do a different job.",
    "State the pharmacy address at most once in the whole page. State the telephone at most once. Give call-ahead guidance at most once.",
    "Do not repeat the area name in every sentence.",
    "Do not use convenient, efficiently, easy reach, within easy reach, prompt support, avoid delays, avoid unnecessary delays, or empty claims such as support your health locally, unless an objective supplied fact supports them (it usually will not).",
    "Do not open with Residents can access or Residents of [area] can use.",
    "Do not explain evidence, attribution, provenance or non-affiliation. Do not mention evidence packs.",
    "Do not invent routines, demographics, parking, opening hours, journey times or availability.",
    "Do not rewrite locked clinical facts or list the NHS condition set. The renderer prints approved clinical copy.",
    "Never copy field notes, task instructions or schema examples into the copy.",
    "Do not write that the reader can decide if the service is right or suitable. The pharmacist confirms what can be assessed.",
    "Do not say the reader does not need to travel, or that the pharmacy supports access to NHS care, unless that exact wording is a supplied fact.",
    "Return only valid JSON. No markdown. evidenceClaims items must be {field, sentence, entityId?}.",
  ].join(" ");
}

export function buildAiLocalNarrativeUserPromptV2(input: BusinessLocalityCopyInputV1): string {
  const locked = input.offer.lockedClinicalFacts;
  const richness = classifyEvidenceRichnessV2(input);
  const minUseful = minimumUsefulEntitiesRequiredV2(input);
  const useful = usefulLocalEvidenceEntitiesV2(input);
  const body = {
    task: "Write an isolated local edition of the approved Pharmacy First page for this one area. Classify evidence first, then write copy. Do not write shared clinical sections.",
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION_V2,
    outputOrder: [
      "evidenceSelection",
      "area",
      "heroHeading",
      "heroIntroduction",
      "localIntroduction",
      "localContextHeading",
      "localContextParagraphs",
      "relationshipToPharmacy",
      "localAccessIntroduction",
      "localFaqs",
      "localCtaBridge",
      "evidenceClaims",
      "evidenceEntityIdsUsed",
    ],
    evidenceSelectionRules: {
      required: true,
      coverEverySuppliedEntity: true,
      classifications: AI_EVIDENCE_SELECTION_CLASSES_V2,
      evidenceRichness: richness,
      usefulEntityCount: useful.length,
      minimumUsefulEntitiesToNameInCopy: minUseful,
      notes: [
        "Classify each entity before writing copy.",
        "Each evidenceSelection row MUST include entityId, name, classification, useInCopy, and reason.",
        "Example row: {\"entityId\":\"healthcare:wombwell-medical-centre\",\"name\":\"Wombwell Medical Centre\",\"category\":\"healthcare\",\"classification\":\"useful-healthcare-context\",\"useInCopy\":true,\"reason\":\"Names the local healthcare landscape without implying the reader uses that practice.\"}",
        "useInCopy true only when the entity will actually be named and will help a patient decision or orientation.",
        "Schools and retailers: usually classification irrelevant-to-patient-decision and useInCopy false.",
        "A transport stop whose name equals the area name is usually irrelevant-to-patient-decision.",
        "Unsafe-or-ambiguous if using the name would imply affiliation, the reader’s GP, waiting times, a route, or a timetable.",
      ],
    },
    fieldNotes: {
      area: "Must equal the selected area name exactly.",
      heroHeading: "Short patient-facing heading naming Pharmacy First and this area. Do not invent a different service.",
      heroIntroduction:
        "Two short sentences. First: why this page is relevant to someone in this particular area (in-area pharmacy vs nearby area). Second: the decision the reader can take, without dumping the full address or phone if later fields will carry them. Do not start with Residents can access.",
      localIntroduction:
        "Where the pharmacy is in relation to this area, using the supplied distance and, if needed, one address mention. This is the only place the full address should appear unless a later field would otherwise be empty of location fact.",
      localContextHeading: "A heading for this area’s situation. Not Evidence, Landmarks or Local healthcare list.",
      localContextParagraphs:
        "1–2 paragraphs that use selected useful evidence to help the reader understand the local relationship. Healthcare names describe landscape only. Do not inventory. Do not imply affiliation. For sparse evidence, keep this short and factual.",
      relationshipToPharmacy: input.locality.pharmacyIsInArea
        ? "One finished sentence stating that the pharmacy is in this area. If the address was already given, do not repeat the street and postcode."
        : "One finished sentence stating how people in this area reach this pharmacy. Do not repeat the full address if localIntroduction already gave it. Do not invent a route or travel time.",
      localAccessIntroduction:
        "What the reader should do if Pharmacy First may be suitable. Call-ahead may appear here OR in one FAQ, never both, and never in the hero as well.",
      localFaqs:
        "3–5 questions with distinct jobs: location/distance; when another healthcare route is better; what the consultation involves or what to bring. Do not add a call-ahead FAQ if localAccessIntroduction already gave that guidance.",
      localCtaBridge: "One non-claim sentence bridging to Book An Appointment or Call. No availability, convenience or delay claims.",
      evidenceClaims:
        'Array of {field, sentence, entityId?}. Include a row for every named evidence entity. Example: [{"field":"localContextParagraphs","sentence":"Wombwell also has Wombwell Medical Centre on George Street.","entityId":"healthcare:wombwell-medical-centre"}].',
      evidenceEntityIdsUsed:
        "entityId strings actually named in the copy. Medium/rich evidence must not return an empty array.",
    },
    editorialStandard: {
      oneCoherentNarrative: true,
      varyParagraphPurpose: true,
      addressAtMostOnce: true,
      telephoneAtMostOnce: true,
      callAheadAtMostOnce: true,
      bannedUnsupportedClaims: [
        "convenient",
        "efficiently",
        "easy reach",
        "within easy reach",
        "prompt support",
        "avoid delays",
        "avoid unnecessary delays",
        "support your health locally",
      ],
      bannedOpenings: ["Residents can access", "Residents of [area] can use"],
    },
    business: input.business,
    offer: {
      serviceName: input.offer.serviceName,
      serviceId: input.offer.serviceId,
      allowedCta: input.offer.allowedCta,
      lockedClinicalFacts: locked,
      clinicalBoundary:
        "Locked clinical facts are for awareness only. Do not rewrite them and do not list the condition set. You may say Pharmacy First can help with eligible common conditions. When another route is needed: urgent symptoms in the locked safety facts, or the pharmacist advising referral.",
    },
    locality: {
      areaName: input.locality.areaName,
      areaSlug: input.locality.areaSlug,
      distanceLabel: input.locality.distanceLabel,
      distanceKm: input.locality.distanceKm,
      cardinalDirection: input.locality.cardinalDirection,
      pharmacyIsInArea: input.locality.pharmacyIsInArea,
      evidenceLimitations: input.locality.evidenceLimitations,
      acceptedEntities: input.locality.acceptedEntities.map((entity) => ({
        entityId: entity.entityId,
        name: entity.name,
        category: entity.category,
        address: entity.address,
        attributionRelationship: entity.attributionRelationship,
      })),
    },
    style: input.style,
    varietyHints: [
      `This page is for ${input.locality.areaName} only. Write facts that would be wrong if copied to a different area.`,
      input.locality.pharmacyIsInArea
        ? "The pharmacy premises are in this area. Lead with that physical fact."
        : `The pharmacy is not in ${input.locality.areaName}. Use the verified distance. Do not call the journey easy or short.`,
      ...(input.varietyHints || []).slice(0, 2),
    ],
  };
  return JSON.stringify(body, null, 2);
}

export const AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3 = "pharmacy-ai-local-narrative-prompt-v3";
export const AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3 = "v3";

export function buildAiLocalNarrativeWritingBriefV3(areaName = "the selected area"): string {
  const whyHeading =
    areaName === "the selected area"
      ? "Why {area} patients start with the pharmacist"
      : `Why ${areaName} patients start with the pharmacist`;
  return [
    `Write a professional, locally informed Pharmacy First page for readers in ${areaName}.`,
    "Follow the supplied section roles and tone.",
    "Leave renderer-owned approved clinical content in the template; do not paraphrase it into AI fields.",
    "Write local content only. Clinical eligibility stays with the renderer and is not included in this prompt.",
    "Write connected local passages, not isolated sentences or a list of places.",
    "Select two or three useful sourced details when they exist; do not force a minimum when evidence is insufficient.",
    "Do not force every supplied fact into the page.",
    "Do not write heroIntroduction or relationshipToPharmacy. Those two fields are deterministic and assembled from confirmed structured values. OpenAI must not compose or paraphrase them.",
    "Do not write localIntroduction. That field is deterministic renderer-owned locality content assembled from the verified selected-area identity, confirmed pharmacy identity, confirmed premises locality and the saved straight-line relationship. OpenAI must not invent it. An omitted optional narrative field is not the local account.",
    `The locked clinical allowance used by the renderer in the hero is: ${ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3}`,
    PHARMACY_FIRST_LOCAL_NARRATIVE_WRITER_RULE_V3,
    `Do not force a local-context paragraph under ‘${whyHeading}’ if no remaining supported fact belongs there.`,
    "Make the transition to the service natural without inventing patient habits, health demand, GP waiting times, delay, alternative-to-GP claims, or referral relationships.",
    "Do not locate the pharmacy at the premises locality in local-context fields. The renderer fills location-and-access from confirmed pharmacy name, premises locality, selected area and saved straight-line distance.",
    "Do not infer that the selected area is part of premisesLocality, marketTown, or a parent town unless a verifiedEditorialFact statement says so.",
    "Do not invent local character, resident value, or empty community labels.",
    "Do not invent travel, parking, opening-hours, availability or treatment promises.",
    "Do not claim the author lives locally.",
    "Choose natural wording from the verified facts. Do not invent the page’s requirements.",
  ].join(" ");
}

export type EditorialFactForPromptV3 = {
  factId: string;
  category: string;
  normalizedStatement: string;
  permittedCopyRole: string;
  prohibitedInference: string;
  sourceClass: string;
  publisher: string;
};

export type BusinessLocalityCopyInputV3 = BusinessLocalityCopyInputV1 & {
  editorialFacts: EditorialFactForPromptV3[];
  editorialSufficiency: "READY" | "EVIDENCE LIMITED";
  distanceBasis?: {
    method: "approximate-straight-line";
    distanceKm: number | null;
    areaReferencePoint: { latitude: number; longitude: number; source: string } | null;
    pharmacyCoordinates: { latitude: number; longitude: number; source: string } | null;
  };
};

export function buildAiLocalNarrativeSystemPromptV3(vertical = "pharmacy", areaName = "the selected area"): string {
  return [
    `You write structured JSON passages for an existing Pharmacy First local template for a ${vertical} business. Do not write new HTML.`,
    buildAiLocalNarrativeWritingBriefV3(areaName),
    "Do not print fact IDs, sources, publishers or provenance in customer-facing fields. Cite supplied fact IDs only in evidenceClaims.editorialFactId and editorialFactIdsUsed.",
    "Do not write heroIntroduction or relationshipToPharmacy. Do not write localIntroduction. Do not write area or heroHeading. Do not write clinical eligibility, suitability, process, safety, geographic access, or the condition list. Deterministic and renderer-owned fields are not OpenAI fields.",
    "Do not copy another town's facts.",
    "Return only valid JSON matching the schema. No markdown. No HTML.",
  ].join(" ");
}

export function fieldPlanForLocalNarrativeInputV3(input: BusinessLocalityCopyInputV3) {
  const facts = input.editorialFacts.filter((fact) => fact.sourceClass === "primary" || fact.sourceClass === "secondary");
  const evidence: ContentGenerationEvidenceInput = {
    editorialFactCount: facts.length,
    hasDistanceKm: input.locality.distanceKm != null && Number.isFinite(input.locality.distanceKm),
    hasNonDistanceEditorialFact: facts.some((fact) => fact.category !== "pharmacy-relationship"),
    deliveryFacts: "unknown",
    unpublished: true,
    schemaDisabled: false,
    clinicalApprovalVersion: null,
    clinicalApprovalInvalidated: false,
  };
  return buildContentGenerationFieldPlan("local-area-page", evidence);
}

export function buildAiLocalNarrativeUserPromptV3(input: BusinessLocalityCopyInputV3): string {
  const facts = input.editorialFacts.filter((fact) => fact.sourceClass === "primary" || fact.sourceClass === "secondary");
  const writingBrief = buildAiLocalNarrativeWritingBriefV3(input.locality.areaName);
  const addressVerified = !premisesAddressLooksUnverified(input.business.address);
  const fieldPlan = fieldPlanForLocalNarrativeInputV3(input);
  const body = {
    task: "Return structured JSON passages for the existing Pharmacy First local template. Do not write new HTML or shared clinical sections.",
    writingBrief,
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
    promptContractId: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
    fieldPolicyId: CONTENT_GENERATION_FIELD_POLICY_ID,
    fieldPolicyVersion: CONTENT_GENERATION_FIELD_POLICY_VERSION,
    fieldPlan,
    contentContractId: UK_LOCAL_PAGE_CONTENT_CONTRACT_ID,
    contentContractVersion: UK_LOCAL_PAGE_CONTENT_CONTRACT_VERSION,
    contentContract: buildUkLocalPageWriterContractPayload({
      areaName: input.locality.areaName,
      addressVerified,
      distancePlan: {
        method: "haversine-straight-line",
        areaReferenceStatus: input.locality.distanceKm != null ? "recorded" : "missing",
        distanceKm: input.locality.distanceKm,
      },
    }),
    schemaFields: fieldPlan.openaiSchemaFields,
    deterministicFields: Object.fromEntries(
      fieldPlan.deterministicFields.map((fieldId) => [
        fieldId,
        "Deterministic. Platform-assembled from confirmed structured values. OpenAI must omit this field.",
      ]),
    ),
    rendererOwnedFields: Object.fromEntries(
      fieldPlan.rendererOwnedFields.map((fieldId) => [
        fieldId,
        "Renderer-owned approved content. OpenAI must not generate or paraphrase this field.",
      ]),
    ),
    fieldNotes: {
      localIntroduction:
        "Deterministic. Do not write this field. The platform assembles the locally informed account from the verified selected-area identity, confirmed pharmacy identity, confirmed premises locality and the saved straight-line relationship. OpenAI must omit this field.",
      localContextHeading: "Optional heading for this area’s situation. Omit if the template heading is enough.",
      localContextParagraphs:
        `Optional. Continue the locally informed account under ‘Why ${input.locality.areaName} patients start with the pharmacist’ only when a remaining verified editorial fact, confirmed pharmacy-profile fact, or the locked clinical allowance still belongs here. ${PHARMACY_FIRST_LOCAL_NARRATIVE_WRITER_RULE_V3} Write connected prose, not a catalogue of places. Do not force a minimum number of local details when evidence is insufficient. Empty array or omitted field is required when no remaining supported local-context fact exists. Stay inside supplied facts: keep named organisations or groups as stated, with no invented character, resident value, parent-town membership or empty community labels. Do not treat named organisations as local identity or as a reason residents can access the service. Do not invent a second paragraph from the impression of facts already used. Transition to Pharmacy First using the locked clinical allowance only — ${ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3} Do not invent patient habits, health demand, GP waiting times, delay, alternative-to-GP claims or referral relationships. If the pharmacy is not in the area, do not locate it at the premises locality in this field.`,
      localAccessIntroduction:
        "Optional. Include only if it adds a useful local access fact not already printed by the renderer, and cite that fact’s factId internally. Omit or return an empty string when it adds nothing.",
      localFaqs:
        "Optional. Zero or more useful, supported local questions not already answered by the page. Cite a supplied factId internally for any local factual answer. No minimum. Omit the field or return [] when nothing useful remains.",
      localCtaBridge: "Optional genuine non-claim sentence bridging to Book An Appointment or Call. Omit when the template already has those actions.",
      evidenceClaims:
        'Array of {field, sentence, editorialFactId}. Required for every local factual sentence in localContextParagraphs, localAccessIntroduction and localFaqs. editorialFactId must be a supplied verifiedEditorialFacts.factId. Example: [{"field":"localContextParagraphs","sentence":"<exact customer sentence>","editorialFactId":"<supplied factId>"}]. Never put fact IDs in customer-facing fields. Do not invent claims for deterministic heroIntroduction, heroHeading, area, localIntroduction or relationshipToPharmacy.',
      evidenceEntityIdsUsed: "Optional Places entity IDs actually named. Usually empty. Do not put editorial fact IDs here instead of evidenceClaims.editorialFactId.",
      editorialFactIdsUsed: "factId strings for editorial facts actually used. Omit facts you did not use. Do not print these in customer-facing fields.",
    },
    editorialStandard: {
      oneCoherentNarrative: true,
      factsOnlyIfTheyImproveMeaning: true,
      addressAtMostOnce: true,
      telephoneAtMostOnce: true,
      distanceAtMostOnce: true,
      callAheadAtMostOnce: true,
      kilometresInAtMostOneSentence: true,
      bannedUnsupportedClaims: [...PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3],
    },
    localClaimBoundary:
      `${PHARMACY_FIRST_LOCAL_NARRATIVE_WRITER_RULE_V3} Local claims must stay inside supplied verifiedEditorialFacts. Keep named organisations, boards or groups from those statements. Do not invent local character, resident value, community colour, or empty labels. Do not add convenience, delay, evaluative, or alternative-to-GP claims. Write local content only; clinical eligibility stays with the renderer. The platform fills location-and-access from confirmed structured values. Do not write relationshipToPharmacy, premises locality, or distance. Do not infer parent-town membership from premisesLocality, marketTown or geographic metadata.`,
    canonicalPharmacyIdentity: {
      name: input.business.name,
      address: input.business.address,
      addressVerified,
      telephone: input.business.telephone,
      website: input.business.website,
      coordinates: input.business.coordinates,
      premisesLocality: premisesLocalityFromCanonicalAddress(input.business.address),
      marketTown: input.business.marketTown,
    },
    business: {
      name: input.business.name,
      address: input.business.address,
      addressVerified,
      premisesLocality: premisesLocalityFromCanonicalAddress(input.business.address),
      marketTown: input.business.marketTown,
      note: "address is the full canonical pharmacy address. premisesLocality is derived from that address and is where the premises are. marketTown is the primary market. locality.areaName / selectedReaderArea is the selected reader area. These three place names are distinct. The page template already prints the street address and telephone; do not copy the street address, postcode or telephone into the copy. Repeated street-address text is an output-validation failure. Do not write premisesLocality or distance into AI fields; the platform fills location-and-access. Do not write that the selected area is part of premisesLocality or marketTown unless a verifiedEditorialFact statement says so. Do not invent a centre-of-area distance. Do not mark an unverified demonstration postal address as verified.",
    },
    offer: {
      serviceName: input.offer.serviceName,
      serviceId: input.offer.serviceId,
      allowedCta: input.offer.allowedCta,
      allowedClinicalSentenceInAiFields: ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
      clinicalContentOwner: "renderer",
      clinicalBoundary:
        "Clinical eligibility, suitability, process, safety, geographic access and the condition list stay with the renderer. This prompt is for local content only and does not include those statements. You may say Pharmacy First can help with eligible common conditions. Waiting, delay, and alternative-to-GP claims are not in the locked clinical facts.",
    },
    locality: {
      areaName: input.locality.areaName,
      selectedReaderArea: input.locality.areaName,
      areaSlug: input.locality.areaSlug,
      distanceLabel: input.locality.distanceLabel,
      distanceKm: input.locality.distanceKm,
      pharmacyIsInArea: input.locality.pharmacyIsInArea,
      distanceMeasurement:
        "The platform states the approximate straight-line distance once in deterministic relationship copy. OpenAI must not write kilometres, routes, travel time or a town-centre measurement, and must not mention coordinates or a recorded area reference point.",
      distanceBasis: input.distanceBasis || null,
      areaReferencePoint: input.distanceBasis?.areaReferencePoint || null,
      pharmacyCoordinates: input.distanceBasis?.pharmacyCoordinates || input.business.coordinates,
    },
    verifiedEditorialFacts: facts.map((fact) => ({
      factId: fact.factId,
      category: fact.category,
      statement: fact.normalizedStatement,
      useAs: fact.permittedCopyRole,
      doNotInfer:
        fact.category === "pharmacy-relationship"
          ? `${fact.prohibitedInference} The platform uses the saved approximate straight-line distance when assembling relationshipToPharmacy. OpenAI must not write the distance, a route, travel time, or town-centre measurement.`
          : fact.prohibitedInference,
    })),
    style: input.style,
  };
  return JSON.stringify(body, null, 2);
}

export function redactAddressFromStatement(statement: string, address: string): string {
  let out = String(statement || "");
  const full = String(address || "").trim();
  if (full) out = out.replace(full, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").replace(/\s+at\s*\./, ".");
  const street = full.split(",")[0]?.trim() || "";
  if (street && street.length > 6) out = out.replace(street, "").replace(/\s{2,}/g, " ");
  return out.replace(/\s+at\s*$/, "").replace(/\s+,/g, ",").replace(/,\s*\./g, ".").replace(/\s{2,}/g, " ").trim();
}

export function premisesLocalityFromCanonicalAddress(address: string): string {
  const stripped = String(address || "")
    .replace(/,\s*(United Kingdom|UK)\s*$/i, "")
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g, "")
    .replace(/[,\s]+$/g, "");
  const parts = stripped.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : "";
}

export function formatRendererOwnedStraightLineKmV3(distanceKm: number): string {
  return formatStraightLineKm(distanceKm);
}

export function buildRendererOwnedHeroIntroductionV3(areaName: string): string {
  return assembleDeterministicHeroIntroduction({
    areaName,
    lockedIntroductorySentence: ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
  });
}

export function buildRendererOwnedRelationshipToPharmacyV3(input: BusinessLocalityCopyInputV1): string {
  return assembleDeterministicRelationshipToPharmacy({
    pharmacyName: input.business.name,
    premisesLocality: premisesLocalityFromCanonicalAddress(input.business.address),
    areaName: input.locality.areaName,
    distanceKm: input.locality.distanceKm,
    pharmacyIsInArea: input.locality.pharmacyIsInArea,
  });
}

export function buildRendererOwnedLocalIntroductionV3(input: BusinessLocalityCopyInputV1): string {
  return assembleDeterministicLocalIntroduction({
    pharmacyName: input.business.name,
    premisesLocality: premisesLocalityFromCanonicalAddress(input.business.address),
    areaName: input.locality.areaName,
    distanceKm: input.locality.distanceKm,
    pharmacyIsInArea: input.locality.pharmacyIsInArea,
  });
}

export function applyRendererOwnedLocalCopyFieldsV3(
  copy: AiLocalCopyV3,
  input: BusinessLocalityCopyInputV3,
): AiLocalCopyV3 {
  const area = String(input.locality.areaName || "").trim();
  const heroHeading = assembleDeterministicHeroHeading({
    serviceName: input.offer.serviceName,
    areaName: area,
  });
  const heroIntroduction = buildRendererOwnedHeroIntroductionV3(area);
  const localIntroduction = buildRendererOwnedLocalIntroductionV3(input);
  const relationshipToPharmacy = buildRendererOwnedRelationshipToPharmacyV3(input);
  const distanceSentence =
    relationshipToPharmacy
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .find((part) => /\b\d+(?:\.\d+)?\s*km\b/i.test(part) && /straight line/i.test(part)) || "";
  const distanceFact = (input.editorialFacts || []).find(
    (fact) => fact.category === "pharmacy-relationship" && /straight line|distance/i.test(fact.normalizedStatement),
  );
  const evidenceClaims = (copy.evidenceClaims || []).filter(
    (claim) =>
      claim.field !== "heroIntroduction" &&
      claim.field !== "relationshipToPharmacy" &&
      claim.field !== "heroHeading" &&
      claim.field !== "area" &&
      claim.field !== "localIntroduction",
  );
  if (distanceSentence && distanceFact?.factId) {
    evidenceClaims.push({
      field: "relationshipToPharmacy",
      sentence: distanceSentence,
      editorialFactId: distanceFact.factId,
    });
  }
  const editorialFactIdsUsed = [
    ...new Set([...(copy.editorialFactIdsUsed || []), ...(distanceFact?.factId ? [distanceFact.factId] : [])]),
  ];
  return {
    ...copy,
    area: area || copy.area,
    heroHeading: heroHeading || copy.heroHeading,
    heroIntroduction,
    localIntroduction,
    relationshipToPharmacy,
    localContextParagraphs: [...copy.localContextParagraphs],
    localFaqs: copy.localFaqs.map((faq) => ({ ...faq })),
    evidenceClaims,
    evidenceEntityIdsUsed: [...(copy.evidenceEntityIdsUsed || [])],
    editorialFactIdsUsed,
  };
}

export function overlayFromCopy(copy: AiLocalCopyV1) {
  return {
    heroIntroduction: copy.heroIntroduction,
    localContextHeading: copy.localContextHeading,
    localIntroduction: copy.localIntroduction,
    localContextParagraphs: copy.localContextParagraphs,
    relationshipToPharmacy: copy.relationshipToPharmacy,
    localAccessIntroduction: copy.localAccessIntroduction,
    localFaqs: copy.localFaqs,
    localCtaBridge: copy.localCtaBridge,
  };
}
