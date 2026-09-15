/**
 * Versioned reusable AI local-narrative prompt contract.
 * Generic business + locality input; pharmacy is the first vertical.
 */
import type { AiLocalCopyV1 } from "./pharmacyAiLocalCopySchemaV1.ts";

export const AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID = "pharmacy-ai-local-narrative-prompt-v1";
export const AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_PATH =
  "src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
export const AI_LOCAL_NARRATIVE_PROMPT_VERSION = "v1";

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
};

export function buildAiLocalNarrativeSystemPromptV3(vertical = "pharmacy"): string {
  return [
    `You write a coherent local edition of an approved Pharmacy First page for a ${vertical} business.`,
    "You are a human editor using verified facts. Do not narrate evidence records, fact IDs, sources, publishers or provenance.",
    "Write professional, natural British English.",
    "Local information has two purposes: help readers recognise their area, and make this page substantively different from other area pages. It does not have to explain a route to the pharmacy.",
    "Use supplied facts. Omit facts that do not help. Do not invent history, industry, community character, health need, or referral relationships. History only as history when a supplied fact supports it. Do not claim that local character, population, employment or a healthcare setting proves symptoms, demand, or treatment choice.",
    "Never use raw business or provider listing labels. If a doctor-named listing is supplied, use only a customer-appropriate organisation name that is explicitly given. If no customer-appropriate name is given, omit the organisation.",
    "Do not infer routes, journey times, parking, opening hours, accessibility, endorsement, referral, or that the reader uses a named GP. A road, station or healthcare site in the area does not prove a route to the pharmacy or a relationship with the pharmacy.",
    "Do not copy the street address or telephone into these fields. The page template already prints the address and telephone. Name the supplied canonical premises locality once, in the access field, when the pharmacy is not in the selected reader area. Premises locality, primary market and selected reader area are different fields.",
    "If you state kilometres, identify them as an approximate straight-line distance. Do not present them as travel, driving, walking or journey distance, or as a town-centre measurement.",
    "The hero must lead with Pharmacy First and the reader’s need. After that lead, one supplied local detail may be used. Do not open with an evidence fact.",
    "localIntroduction and localContextParagraphs are the locally informed account of the area. Omit localIntroduction, or return an empty string, when no supplied fact helps. Do not write a pathway sentence to fill the field.",
    "relationshipToPharmacy is optional access: if the pharmacy is not in the area, name the supplied premises locality once so the reader knows where consultations take place. A clear, useful factual sentence is acceptable. Do not invent a route or journey.",
    "Write only as much as the supplied facts support. There is no word quota. Never pad. Do not require every field to contain a unique local fact. Do not fill optional fields to satisfy the schema.",
    "Do not restate consultation process, eligibility, escalation, safety-netting or other renderer-owned clinical copy. Omit relationshipToPharmacy, localAccessIntroduction and localFaqs when they would only repeat renderer-owned clinical copy or add nothing useful.",
    "Do not rewrite locked clinical facts, the seven conditions, pathway eligibility, consultation process, or safety wording. Do not broaden clinical claims. Do not claim that Pharmacy First is quick, expert, prompt, or that the reader can skip or avoid a GP wait.",
    "Return only valid JSON matching the schema. No markdown. No HTML.",
  ].join(" ");
}

export function buildAiLocalNarrativeUserPromptV3(input: BusinessLocalityCopyInputV3): string {
  const locked = input.offer.lockedClinicalFacts;
  const facts = input.editorialFacts.filter((fact) => fact.sourceClass === "primary" || fact.sourceClass === "secondary");
  const body = {
    task: "Write an isolated local edition of the approved Pharmacy First page for this one area. Write coherent copy, not an evidence dump. Do not write shared clinical sections. Do not restate renderer-owned consultation, eligibility, escalation or FAQ copy.",
    promptContractVersion: AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
    promptContractId: AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
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
      "editorialFactIdsUsed",
    ],
    fieldNotes: {
      area: "Must equal the selected area name exactly.",
      heroHeading: "Short patient-facing heading naming Pharmacy First and this area.",
      heroIntroduction:
        "Service-led introduction. Lead with Pharmacy First and what the reader in this area may need. Name the area. After that lead, one supplied local detail may be used. Do not dump the address or phone.",
      localIntroduction:
        "Locally informed account of the area using supplied facts. This field does not have to explain a route to the pharmacy. If no supplied fact helps, omit this field or return an empty string. Do not write a pathway sentence to fill it.",
      localContextHeading: "Optional heading for this area’s situation. Omit if the template heading is enough.",
      localContextParagraphs:
        "Required. Continue the locally informed account and transition to Pharmacy First only where that is supported. Do not claim local character proves symptoms or demand. If the pharmacy is not in the area, do not use this field only to restate the premises locality — that belongs once in relationshipToPharmacy. Do not copy the street address. If kilometres are used, identify them as an approximate straight-line distance.",
      relationshipToPharmacy:
        "Optional access. If the pharmacy is not in the area, name the supplied premisesLocality once so the reader knows where consultations take place. Do not restate consultation or eligibility copy. Omit or return an empty string when it adds nothing.",
      localAccessIntroduction:
        "Optional. Include only if it adds a useful local access fact not already printed by the renderer. Omit or return an empty string when it adds nothing.",
      localFaqs:
        "Optional. Zero or more useful, supported local questions not already answered by the page. No minimum. Omit the field or return [] when nothing useful remains.",
      localCtaBridge: "Optional genuine non-claim sentence bridging to Book An Appointment or Call. Omit when the template already has those actions.",
      evidenceClaims: "Array of {field, sentence, entityId?}. Include editorialFactId in entityId when a fact was used.",
      evidenceEntityIdsUsed: "Optional Places entity IDs actually named. Usually empty.",
      editorialFactIdsUsed: "factId strings for editorial facts actually used. Omit facts you did not use.",
    },
    editorialStandard: {
      oneCoherentNarrative: true,
      factsOnlyIfTheyImproveMeaning: true,
      addressAtMostOnce: true,
      telephoneAtMostOnce: true,
      distanceAtMostOnce: true,
      callAheadAtMostOnce: true,
      kilometresInAtMostOneSentence: true,
    },
    business: {
      name: input.business.name,
      address: input.business.address,
      premisesLocality: premisesLocalityFromCanonicalAddress(input.business.address),
      marketTown: input.business.marketTown,
      note: "address is the full canonical pharmacy address. premisesLocality is derived from that address and is where the premises are. marketTown is the primary market. locality.areaName / selectedReaderArea is the selected reader area. These three place names are distinct. The page template already prints the street address and telephone; do not copy the street address, postcode or telephone into the copy. Repeated street-address text is an output-validation failure. Name premisesLocality when the pharmacy is not in the selected reader area. Do not invent a centre-of-area distance.",
    },
    offer: {
      serviceName: input.offer.serviceName,
      serviceId: input.offer.serviceId,
      allowedCta: input.offer.allowedCta,
      lockedClinicalFacts: locked,
      clinicalBoundary:
        "Locked clinical facts are for awareness only. Do not rewrite them and do not list the condition set. You may say Pharmacy First can help with eligible common conditions.",
    },
    locality: {
      areaName: input.locality.areaName,
      selectedReaderArea: input.locality.areaName,
      areaSlug: input.locality.areaSlug,
      distanceLabel: input.locality.distanceLabel,
      distanceKm: input.locality.distanceKm,
      pharmacyIsInArea: input.locality.pharmacyIsInArea,
      distanceMeasurement:
        "straight-line between the pharmacy’s saved Google coordinates and the area’s saved Google geocode point; not travel distance; not a town-centre measurement unless a supplied fact says so",
    },
    verifiedEditorialFacts: facts.map((fact) => ({
      factId: fact.factId,
      category: fact.category,
      statement: fact.normalizedStatement,
      useAs: fact.permittedCopyRole,
      doNotInfer:
        fact.category === "pharmacy-relationship"
          ? `${fact.prohibitedInference} Do not force this figure into the copy. If used, identify it as an approximate straight-line distance, not travel, driving, walking or journey distance, and not a town-centre measurement.`
          : fact.prohibitedInference,
    })),
    style: input.style,
    varietyHints: [
      `This page is for ${input.locality.areaName} only. Name the area. Lead with Pharmacy First, then write a recognisable local account using supplied facts. Local context does not have to explain a route. Omit optional fields when they add nothing useful.`,
      input.locality.pharmacyIsInArea
        ? "The pharmacy premises are in this area. Do not make that the only local sentence."
        : `The pharmacy is not in ${input.locality.areaName}. Name the supplied premisesLocality once in relationshipToPharmacy. Do not copy the street address. If you state kilometres, identify them as an approximate straight-line distance. Do not invent a road, connection or journey.`,
      ...(input.varietyHints || []),
    ],
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
