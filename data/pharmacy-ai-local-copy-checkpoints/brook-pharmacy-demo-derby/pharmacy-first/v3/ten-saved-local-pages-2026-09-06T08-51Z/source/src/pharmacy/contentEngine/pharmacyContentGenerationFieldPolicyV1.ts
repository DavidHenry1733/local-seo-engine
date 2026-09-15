/**
 * Authoritative content-generation field policy.
 * Consumed by generation-plan construction, prompt construction, provider-response
 * schema, evidence binding, validation alignment, candidate saving and Preview.
 * Tenant-, service- and area-agnostic. No production area-name conditionals.
 */
export const CONTENT_GENERATION_FIELD_POLICY_ID = "pharmacy-content-generation-field-policy-v1";
export const CONTENT_GENERATION_FIELD_POLICY_VERSION = "v1";
export const CONTENT_GENERATION_FIELD_POLICY_PATH =
  "src/pharmacy/contentEngine/pharmacyContentGenerationFieldPolicyV1.ts";

export const FIELD_OWNERSHIP = {
  DETERMINISTIC: "deterministic-profile-or-geographic-fact",
  RENDERER_OWNED: "renderer-owned-approved-content",
  EVIDENCE_BOUND: "evidence-bound-ai-narrative",
  OPTIONAL_EVIDENCE_BOUND: "optional-evidence-bound-narrative",
  PROHIBITED: "prohibited-inference",
} as const;

export type FieldOwnershipClass = (typeof FIELD_OWNERSHIP)[keyof typeof FIELD_OWNERSHIP];
export type ContentPageKind = "service-page" | "local-area-page";
export type EvidenceRichness = "none" | "sparse" | "distance-only" | "normal" | "rich";
export type DeliveryFactState = "unknown" | "confirmed";

export type ContentFieldPolicyEntry = {
  fieldId: string;
  pageKind: ContentPageKind;
  ownership: FieldOwnershipClass;
  customerFacing: boolean;
  openaiRequested: boolean;
  schemaRequired: boolean;
  omitWhenInsufficientEvidence: boolean;
  notes: string;
};

export const PROHIBITED_INFERENCE_TOPICS = [
  "free service",
  "walk-in availability",
  "eligibility",
  "treatment outcomes",
  "medicine supply",
  "travel time",
  "route distance",
  "access convenience",
  "convenience",
  "unverified credentials",
  "unsupported local relationships",
  "parking",
  "opening hours invented",
  "availability invented",
] as const;

const LOCAL_AREA_FIELDS: ContentFieldPolicyEntry[] = [
  {
    fieldId: "area",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Canonical selected-area name. Platform copies it. OpenAI must not compose or alter it.",
  },
  {
    fieldId: "heroHeading",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Platform assembles service name with the canonical selected-area name.",
  },
  {
    fieldId: "heroIntroduction",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Platform combines the approved service introductory sentence with the canonical selected-area name. Omit any unavailable value. OpenAI must not compose or paraphrase it.",
  },
  {
    fieldId: "relationshipToPharmacy",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Platform uses confirmed pharmacy name, confirmed premises locality, selected-area name, saved approximate distance and straight-line method. Omit any unavailable value. Never infer travel time, route, access, convenience or availability.",
  },
  {
    fieldId: "localIntroduction",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Deterministic renderer-owned locality account. Platform assembles it from the verified selected-area identity, confirmed pharmacy identity, confirmed premises locality and the saved straight-line relationship. OpenAI must not compose or paraphrase it. Optional editorial details belong in other evidence-bound fields and may be omitted.",
  },
  {
    fieldId: "localContextHeading",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
    customerFacing: true,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Optional heading. Omit if the template heading is enough.",
  },
  {
    fieldId: "localContextParagraphs",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
    customerFacing: true,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Optional evidence-bound local narrative. Empty array when no remaining supported fact exists.",
  },
  {
    fieldId: "localAccessIntroduction",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
    customerFacing: true,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Optional. Include only a useful local access fact not already printed by the platform.",
  },
  {
    fieldId: "localFaqs",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
    customerFacing: true,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Optional supported local questions. Omit or return [] when nothing useful remains.",
  },
  {
    fieldId: "localCtaBridge",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
    customerFacing: true,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Optional genuine non-claim bridge. Omit when the template already has those actions.",
  },
  {
    fieldId: "evidenceClaims",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.EVIDENCE_BOUND,
    customerFacing: false,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Internal bindings for AI factual sentences. Never print identifiers in customer-facing fields. Do not invent claims for deterministic or renderer-owned fields.",
  },
  {
    fieldId: "evidenceEntityIdsUsed",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.EVIDENCE_BOUND,
    customerFacing: false,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Internal Places entity IDs actually named. Usually empty.",
  },
  {
    fieldId: "editorialFactIdsUsed",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.EVIDENCE_BOUND,
    customerFacing: false,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Internal fact IDs actually used. Do not print in customer-facing fields.",
  },
  {
    fieldId: "clinicalSections",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Approved clinical wording, eligibility, process, safety and condition list. OpenAI must not generate or paraphrase them.",
  },
  {
    fieldId: "serviceNoticesAndDisclaimers",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Service notices, safety guidance and disclaimers stay with the renderer.",
  },
  {
    fieldId: "credentialsAndGovernance",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Credentials, clinical approval and governance copy are renderer-owned and exact-version bound.",
  },
  {
    fieldId: "schemaMarkup",
    pageKind: "local-area-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: false,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "JSON-LD/schema state is renderer-owned. When unpublished or schema is disabled, it is not live publication.",
  },
];

const SERVICE_PAGE_FIELDS: ContentFieldPolicyEntry[] = [
  {
    fieldId: "pharmacyName",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Confirmed pharmacy name from the tenant profile.",
  },
  {
    fieldId: "premisesLocality",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Confirmed premises locality derived from the canonical address.",
  },
  {
    fieldId: "serviceIdentity",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Confirmed service name and selected campaign. OpenAI must not rename the service.",
  },
  {
    fieldId: "confirmedDeliveryFacts",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.DETERMINISTIC,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Print only confirmed delivery facts. Unknown delivery facts are omitted, never inferred.",
  },
  {
    fieldId: "approvedServiceBankCopy",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Approved service-bank clinical and pathway copy. OpenAI must not generate or paraphrase it.",
  },
  {
    fieldId: "clinicalSections",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Clinical wording, eligibility, process, safety and condition list.",
  },
  {
    fieldId: "serviceNoticesAndDisclaimers",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Service notices, safety guidance and disclaimers.",
  },
  {
    fieldId: "credentialsAndGovernance",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: true,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "Credentials and exact-version clinical approval. Invalidated versions must not remain presented as approved.",
  },
  {
    fieldId: "schemaMarkup",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.RENDERER_OWNED,
    customerFacing: false,
    openaiRequested: false,
    schemaRequired: false,
    omitWhenInsufficientEvidence: false,
    notes: "JSON-LD/schema state. Disabled or unpublished schema is not live publication.",
  },
  {
    fieldId: "optionalLocalNarrative",
    pageKind: "service-page",
    ownership: FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
    customerFacing: true,
    openaiRequested: true,
    schemaRequired: false,
    omitWhenInsufficientEvidence: true,
    notes: "Optional evidence-bound local narrative on a service page. Omit when evidence is insufficient.",
  },
];

export const CONTENT_GENERATION_FIELD_CATALOG: readonly ContentFieldPolicyEntry[] = [
  ...LOCAL_AREA_FIELDS,
  ...SERVICE_PAGE_FIELDS,
];

export type ContentGenerationEvidenceInput = {
  editorialFactCount: number;
  hasDistanceKm: boolean;
  hasNonDistanceEditorialFact: boolean;
  deliveryFacts: DeliveryFactState;
  schemaDisabled?: boolean;
  unpublished?: boolean;
  clinicalApprovalVersion?: string | null;
  clinicalApprovalInvalidated?: boolean;
};

export type ContentGenerationFieldPlan = {
  policyId: string;
  policyVersion: string;
  pageKind: ContentPageKind;
  evidenceRichness: EvidenceRichness;
  openaiSchemaFields: string[];
  openaiRequiredFields: string[];
  deterministicFields: string[];
  rendererOwnedFields: string[];
  optionalEvidenceBoundFields: string[];
  omittedOptionalFields: string[];
  prohibitedInferences: readonly string[];
  schemaMarkupLive: boolean;
  clinicalCopyLive: boolean;
  mayRequestOpenAI: boolean;
};

function fieldsFor(pageKind: ContentPageKind): ContentFieldPolicyEntry[] {
  return CONTENT_GENERATION_FIELD_CATALOG.filter((row) => row.pageKind === pageKind);
}

export function classifyContentField(pageKind: ContentPageKind, fieldId: string): FieldOwnershipClass | null {
  return fieldsFor(pageKind).find((row) => row.fieldId === fieldId)?.ownership || null;
}

export function classifyEvidenceRichness(input: ContentGenerationEvidenceInput): EvidenceRichness {
  if (input.editorialFactCount <= 0 && !input.hasDistanceKm) return "none";
  if (input.hasDistanceKm && !input.hasNonDistanceEditorialFact) return "distance-only";
  if (input.editorialFactCount <= 1) return "sparse";
  if (input.editorialFactCount <= 3) return "normal";
  return "rich";
}

export function schemaMarkupIsLivePublication(input: Pick<ContentGenerationEvidenceInput, "schemaDisabled" | "unpublished">): boolean {
  return !input.schemaDisabled && !input.unpublished;
}

export function clinicalCopyIsLiveApproved(input: Pick<ContentGenerationEvidenceInput, "clinicalApprovalVersion" | "clinicalApprovalInvalidated">): boolean {
  if (input.clinicalApprovalInvalidated) return false;
  return Boolean(String(input.clinicalApprovalVersion || "").trim());
}

export function buildContentGenerationFieldPlan(
  pageKind: ContentPageKind,
  evidence: ContentGenerationEvidenceInput,
): ContentGenerationFieldPlan {
  const richness = classifyEvidenceRichness(evidence);
  const rows = fieldsFor(pageKind);
  const omitOptional = richness === "none" || richness === "distance-only";
  const openaiSchemaFields = rows
    .filter((row) => row.openaiRequested && !(omitOptional && row.omitWhenInsufficientEvidence))
    .map((row) => row.fieldId);
  const openaiRequiredFields = openaiSchemaFields.filter((fieldId) => {
    const row = rows.find((entry) => entry.fieldId === fieldId);
    return Boolean(row?.schemaRequired);
  });
  const omittedOptionalFields = rows
    .filter((row) => row.omitWhenInsufficientEvidence && omitOptional)
    .map((row) => row.fieldId);
  const hasAiWork = openaiSchemaFields.some((fieldId) => {
    const row = rows.find((entry) => entry.fieldId === fieldId);
    return Boolean(row?.customerFacing);
  });
  return {
    policyId: CONTENT_GENERATION_FIELD_POLICY_ID,
    policyVersion: CONTENT_GENERATION_FIELD_POLICY_VERSION,
    pageKind,
    evidenceRichness: richness,
    openaiSchemaFields,
    openaiRequiredFields,
    deterministicFields: rows.filter((row) => row.ownership === FIELD_OWNERSHIP.DETERMINISTIC).map((row) => row.fieldId),
    rendererOwnedFields: rows.filter((row) => row.ownership === FIELD_OWNERSHIP.RENDERER_OWNED).map((row) => row.fieldId),
    optionalEvidenceBoundFields: rows
      .filter((row) => row.ownership === FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND)
      .map((row) => row.fieldId),
    omittedOptionalFields,
    prohibitedInferences: PROHIBITED_INFERENCE_TOPICS,
    schemaMarkupLive: schemaMarkupIsLivePublication(evidence),
    clinicalCopyLive: clinicalCopyIsLiveApproved(evidence),
    mayRequestOpenAI: richness !== "none" && richness !== "distance-only" && hasAiWork,
  };
}

export function openaiMustNotReceiveField(pageKind: ContentPageKind, fieldId: string): boolean {
  const ownership = classifyContentField(pageKind, fieldId);
  return ownership === FIELD_OWNERSHIP.DETERMINISTIC || ownership === FIELD_OWNERSHIP.RENDERER_OWNED;
}

export function localAreaOpenAiParseOptions(): {
  optionalArea: boolean;
  optionalHeroHeading: boolean;
  optionalHeroIntroduction: boolean;
  optionalLocalIntroduction: boolean;
  optionalLocalContextHeading: boolean;
  optionalLocalContextParagraphs: boolean;
  optionalRelationshipToPharmacy: boolean;
  optionalLocalAccessIntroduction: boolean;
  optionalLocalFaqs: boolean;
  optionalLocalCtaBridge: boolean;
} {
  return {
    optionalArea: true,
    optionalHeroHeading: true,
    optionalHeroIntroduction: true,
    optionalLocalIntroduction: true,
    optionalLocalContextHeading: true,
    optionalLocalContextParagraphs: true,
    optionalRelationshipToPharmacy: true,
    optionalLocalAccessIntroduction: true,
    optionalLocalFaqs: true,
    optionalLocalCtaBridge: true,
  };
}

export function formatStraightLineKm(distanceKm: number): string {
  const rounded = Number(Number(distanceKm).toFixed(1));
  if (!Number.isFinite(rounded)) return "";
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function assembleDeterministicHeroHeading(opts: { serviceName: string; areaName: string }): string {
  const service = String(opts.serviceName || "").trim();
  const area = String(opts.areaName || "").trim();
  if (service && area) return `${service} in ${area}`;
  return service || area;
}

export function assembleDeterministicHeroIntroduction(opts: {
  areaName: string;
  lockedIntroductorySentence: string;
}): string {
  const locked = String(opts.lockedIntroductorySentence || "").trim().replace(/\.$/, "");
  const area = String(opts.areaName || "").trim();
  if (!locked) return "";
  if (!area) return `${locked}.`;
  return `${locked} for people in ${area}.`;
}

export function assembleDeterministicLocalIntroduction(opts: {
  pharmacyName: string;
  premisesLocality: string;
  areaName: string;
  distanceKm: number | null;
  pharmacyIsInArea: boolean;
}): string {
  const name = String(opts.pharmacyName || "").trim();
  const premises = String(opts.premisesLocality || "").trim();
  const area = String(opts.areaName || "").trim();
  const kmText =
    opts.distanceKm != null && Number.isFinite(opts.distanceKm) ? formatStraightLineKm(opts.distanceKm) : "";
  if (!area || !name) return "";
  if (!opts.pharmacyIsInArea && (!premises || !kmText)) return "";
  return `Pharmacy First for people in ${area} is provided by ${name}.`;
}

export function assembleDeterministicRelationshipToPharmacy(opts: {
  pharmacyName: string;
  premisesLocality: string;
  areaName: string;
  distanceKm: number | null;
  pharmacyIsInArea: boolean;
}): string {
  const name = String(opts.pharmacyName || "").trim();
  const premises = String(opts.premisesLocality || "").trim();
  const area = String(opts.areaName || "").trim();
  const kmText =
    opts.distanceKm != null && Number.isFinite(opts.distanceKm) ? formatStraightLineKm(opts.distanceKm) : "";
  const parts: string[] = [];
  if (name && premises) parts.push(`Consultations take place at ${name} in ${premises}.`);
  else if (name && area && opts.pharmacyIsInArea) parts.push(`Consultations take place at ${name} in ${area}.`);
  else if (name) parts.push(`Consultations take place at ${name}.`);
  if (name && area && kmText) {
    parts.push(`${name} is approximately ${kmText} km in a straight line from ${area}.`);
  }
  return parts.join(" ");
}

export type LocalPageGenerationBlockReason =
  | "missing-area-identity"
  | "ambiguous-area-identity"
  | "missing-pharmacy-identity"
  | "missing-premises-locality"
  | "missing-area-reference"
  | "ambiguous-area-reference"
  | "missing-straight-line-distance"
  | "contaminated-local-evidence"
  | "unsupported-displayed-claim"
  | "unapproved-clinical-copy";

export type LocalPageGenerationReadiness = {
  canGenerate: boolean;
  reasons: string[];
  blockReasons: LocalPageGenerationBlockReason[];
  omittedOptionalFields: string[];
  evidenceRichness: EvidenceRichness;
  fieldPlan: ContentGenerationFieldPlan;
  areaReferenceStatus: "recorded" | "missing" | "ambiguous";
  optionalFacts: {
    authoritativeLocalWebFacts: boolean;
    verifiedGpPractices: boolean;
    landmarksOrCommunityFacts: boolean;
    blockedAuthoritativePages: boolean;
  };
};

/**
 * Minimum verified deterministic facts for an honest local page.
 * Authoritative web facts, GP practices, landmarks and community facts are optional.
 * Unavailable optional facts are omitted; they do not block generation by themselves.
 */
export function assessLocalPageGenerationReadiness(input: {
  areaName: string;
  selectedAreaConfirmed: boolean;
  areaIdentityAmbiguous: boolean;
  pharmacyName: string;
  premisesLocality: string;
  pharmacyCoordinatesPresent: boolean;
  areaReferenceStatus: "recorded" | "missing" | "ambiguous";
  distanceKm: number | null;
  clinicalCopyApproved: boolean;
  contaminatedLocalEvidence: boolean;
  editorialFactCount: number;
  hasNonDistanceEditorialFact: boolean;
  verifiedGpPracticeCount: number;
  blockedAuthoritativePages: boolean;
}): LocalPageGenerationReadiness {
  const areaName = String(input.areaName || "").trim();
  const pharmacyName = String(input.pharmacyName || "").trim();
  const premisesLocality = String(input.premisesLocality || "").trim();
  const fieldPlan = buildContentGenerationFieldPlan("local-area-page", {
    editorialFactCount: input.editorialFactCount,
    hasDistanceKm: input.distanceKm != null && Number.isFinite(input.distanceKm),
    hasNonDistanceEditorialFact: input.hasNonDistanceEditorialFact,
    deliveryFacts: "unknown",
    unpublished: true,
    schemaDisabled: false,
    clinicalApprovalVersion: input.clinicalCopyApproved ? "renderer-owned" : null,
    clinicalApprovalInvalidated: !input.clinicalCopyApproved,
  });
  const blockReasons: LocalPageGenerationBlockReason[] = [];
  const reasons: string[] = [];
  if (!input.selectedAreaConfirmed || !areaName) {
    blockReasons.push("missing-area-identity");
    reasons.push("Selected-area identity is missing.");
  }
  if (input.areaIdentityAmbiguous) {
    blockReasons.push("ambiguous-area-identity");
    reasons.push("Selected-area identity is ambiguous.");
  }
  if (!pharmacyName) {
    blockReasons.push("missing-pharmacy-identity");
    reasons.push("Confirmed pharmacy identity is missing.");
  }
  if (!premisesLocality) {
    blockReasons.push("missing-premises-locality");
    reasons.push("Confirmed pharmacy premises locality is missing.");
  }
  if (input.areaReferenceStatus === "ambiguous") {
    blockReasons.push("ambiguous-area-reference");
    reasons.push("Area reference is ambiguous, so displayed geography cannot be supported.");
  }
  if (input.areaReferenceStatus === "missing") {
    blockReasons.push("missing-area-reference");
    reasons.push("Provider-verified selected-area reference is missing.");
  }
  if (input.distanceKm == null || !Number.isFinite(input.distanceKm)) {
    blockReasons.push("missing-straight-line-distance");
    reasons.push("Pharmacy-to-area straight-line distance has not been calculated.");
  }
  if (input.contaminatedLocalEvidence) {
    blockReasons.push("contaminated-local-evidence");
    reasons.push("Saved local evidence is geographically incompatible with the selected area.");
  }
  if (input.distanceKm != null && Number.isFinite(input.distanceKm) && input.areaReferenceStatus !== "recorded") {
    blockReasons.push("unsupported-displayed-claim");
    reasons.push("Distance would be displayed without a verified area reference.");
  }
  if (!input.clinicalCopyApproved) {
    blockReasons.push("unapproved-clinical-copy");
    reasons.push("Approved renderer-owned service and clinical content is not available.");
  }
  const optionalReasons: string[] = [];
  if (input.editorialFactCount <= 0) {
    optionalReasons.push("No authoritative local web facts were stored; related narrative is omitted.");
  }
  if (input.verifiedGpPracticeCount <= 0) {
    optionalReasons.push("Zero verified GP practices is a recorded research outcome; GP narrative is omitted.");
  }
  if (input.blockedAuthoritativePages) {
    optionalReasons.push("An authoritative page was blocked or unavailable; related narrative is omitted.");
  }
  return {
    canGenerate: blockReasons.length === 0,
    reasons: blockReasons.length ? reasons : optionalReasons,
    blockReasons,
    omittedOptionalFields: fieldPlan.omittedOptionalFields,
    evidenceRichness: fieldPlan.evidenceRichness,
    fieldPlan,
    areaReferenceStatus: input.areaReferenceStatus,
    optionalFacts: {
      authoritativeLocalWebFacts: input.hasNonDistanceEditorialFact,
      verifiedGpPractices: input.verifiedGpPracticeCount > 0,
      landmarksOrCommunityFacts: input.hasNonDistanceEditorialFact,
      blockedAuthoritativePages: input.blockedAuthoritativePages,
    },
  };
}

export function previewUsesSavedCandidateOverlay(): boolean {
  return true;
}

export function discoverableContentGenerationFieldPolicy(): Record<string, unknown> {
  return {
    policyId: CONTENT_GENERATION_FIELD_POLICY_ID,
    version: CONTENT_GENERATION_FIELD_POLICY_VERSION,
    sourcePath: CONTENT_GENERATION_FIELD_POLICY_PATH,
    ownershipClasses: Object.values(FIELD_OWNERSHIP),
    prohibitedInferences: [...PROHIBITED_INFERENCE_TOPICS],
    fields: CONTENT_GENERATION_FIELD_CATALOG,
    rules: [
      "Writer, schema, readiness gate and validator consume this same field policy.",
      "A field is never required by the response schema when the evidence policy allows omission.",
      "Deterministic and renderer-owned fields are never requested from OpenAI.",
      "Existing validators remain authoritative.",
      "A local page may proceed with selected-area identity, confirmed pharmacy identity and premises locality, a verified area reference and calculated straight-line distance, and approved renderer-owned service and clinical content.",
      "Authoritative local web facts, GP practices, landmarks and community facts are optional evidence-bound narrative inputs. Missing, zero or blocked optional facts are recorded and omitted; they do not block generation by themselves.",
      "Generation stays blocked when area identity is ambiguous, required deterministic facts are missing, or a displayed claim cannot be supported.",
      "Preview of a saved candidate renders the saved overlay; deterministic assembly is generate-path only.",
      "No tenant-, service- or area-name production branches.",
    ],
  };
}
