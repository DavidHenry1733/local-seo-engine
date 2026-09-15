/**
 * v2 editorial review: evidence selection, sentence purpose, repetition, generic substitution.
 */
import type { AiLocalCopyV1, AiLocalCopyV2, AiSentencePurposeRowV2 } from "./pharmacyAiLocalCopySchemaV1.ts";
import { flattenAiLocalCopyText } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  acceptedEntityId,
  splitSentences,
  type AiLocalClaimMapRowV1,
} from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import {
  minimumUsefulEntitiesRequiredV2,
  usefulLocalEvidenceEntitiesV2,
  type BusinessLocalityCopyInputV1,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";

const CALL_AHEAD =
  /\b(call(?:ing)? ahead|call before|phone (?:the pharmacy )?(?:before|ahead)|before (?:coming in|attending|visiting|travelling|setting out))\b/i;

export type AiRepetitionAnalysisV2 = {
  addressMentions: number;
  telephoneMentions: number;
  callAheadMentions: number;
  areaNameMentions: number;
  failures: string[];
};

function streetFromAddress(address: string): string {
  return String(address || "").split(",")[0]?.replace(/^\d+\s+/, "").trim() || "";
}

export function analyseRepetitionV2(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): AiRepetitionAnalysisV2 {
  const hay = flattenAiLocalCopyText(copy);
  const sentences = splitSentences(hay);
  const street = streetFromAddress(input.business.address);
  const addressMentions = street
    ? sentences.filter((s) => s.toLowerCase().includes(street.toLowerCase())).length
    : 0;
  const telephoneMentions = input.business.telephone
    ? sentences.filter((s) => s.includes(input.business.telephone)).length
    : 0;
  const callAheadMentions = sentences.filter((s) => CALL_AHEAD.test(s)).length;
  const areaNameMentions = sentences.filter((s) =>
    s.toLowerCase().includes(input.locality.areaName.toLowerCase()),
  ).length;
  const failures: string[] = [];
  if (addressMentions >= 2) failures.push("repeated address guidance");
  if (telephoneMentions >= 2) failures.push("repeated contact guidance");
  if (callAheadMentions >= 2) failures.push("repeated call-ahead guidance");
  return { addressMentions, telephoneMentions, callAheadMentions, areaNameMentions, failures };
}

export function analyseRepetitionV3(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): AiRepetitionAnalysisV2 {
  const ai = analyseRepetitionV2(copy, input);
  const hay = flattenAiLocalCopyText(copy);
  const sentences = splitSentences(hay);
  const street = streetFromAddress(input.business.address);
  const aiAddress = street
    ? sentences.filter((s) => s.toLowerCase().includes(street.toLowerCase())).length
    : 0;
  const aiTelephone = input.business.telephone
    ? sentences.filter((s) => s.includes(input.business.telephone)).length
    : 0;
  const addressMentions = (street ? 1 : 0) + aiAddress;
  const telephoneMentions = (input.business.telephone ? 1 : 0) + aiTelephone;
  const failures = [...ai.failures];
  if (addressMentions >= 2 && !failures.includes("repeated address guidance")) {
    failures.push("repeated address guidance");
  }
  if (telephoneMentions >= 2 && !failures.includes("repeated contact guidance")) {
    failures.push("repeated contact guidance");
  }
  return {
    addressMentions,
    telephoneMentions,
    callAheadMentions: ai.callAheadMentions,
    areaNameMentions: ai.areaNameMentions,
    failures,
  };
}

function purposeForField(field: string, sentence: string, support: string): { purpose: string; readerValue: string } {
  if (field === "heroHeading") {
    return { purpose: "identify the local edition", readerValue: "tells the reader which area and service this page is for" };
  }
  if (field === "heroIntroduction") {
    return {
      purpose: "why this page is relevant",
      readerValue: "explains why someone in this area should read this Pharmacy First page",
    };
  }
  if (field === "localIntroduction") {
    return {
      purpose: "where the pharmacy is in relation to the area",
      readerValue: "gives the verified location relationship",
    };
  }
  if (field === "localContextHeading") {
    return { purpose: "section orientation", readerValue: "signals the local-context passage" };
  }
  if (field.startsWith("localContextParagraphs")) {
    return {
      purpose: "verified local facts that help the reader",
      readerValue: support.startsWith("healthcare:") || support.includes("healthcare")
        ? "describes the local healthcare landscape without implying affiliation"
        : "orients the reader using a verified local fact",
    };
  }
  if (field === "relationshipToPharmacy") {
    return {
      purpose: "relationship between the area and the pharmacy",
      readerValue: "states whether the pharmacy is in the area or how the area relates to the premises",
    };
  }
  if (field === "localAccessIntroduction") {
    return {
      purpose: "what the reader should do if Pharmacy First may be suitable",
      readerValue: "gives the next practical step",
    };
  }
  if (/\.question$/.test(field)) {
    return { purpose: "local FAQ question", readerValue: "lets the reader find a specific local or pathway answer" };
  }
  if (/\.answer$/.test(field)) {
    if (/urgent|another|not suitable|referral/i.test(sentence)) {
      return {
        purpose: "when to use another healthcare route",
        readerValue: "tells the reader what happens if Pharmacy First is not the right route",
      };
    }
    if (/\bkm\b|how far|from /i.test(sentence)) {
      return { purpose: "distance or location answer", readerValue: "repeats only the verified distance or in-area fact" };
    }
    return { purpose: "pathway or preparation answer", readerValue: "helps the reader prepare or understand the consultation" };
  }
  if (field === "localCtaBridge") {
    return { purpose: "non-claim CTA", readerValue: "bridges to the approved call-to-action without extra claims" };
  }
  return { purpose: "local copy", readerValue: "supports the local edition" };
}

export function classifySentencePurposesV2(
  copy: AiLocalCopyV1,
  claims: AiLocalClaimMapRowV1[],
): AiSentencePurposeRowV2[] {
  return claims.map((row) => {
    const { purpose, readerValue } = purposeForField(row.generatedField, row.exactSentence, row.supportingCanonicalFieldOrEntity);
    return {
      field: row.generatedField,
      sentence: row.exactSentence,
      purpose,
      supportingSource: row.supportingCanonicalFieldOrEntity || row.providerSource || "",
      readerValue,
    };
  });
}

export function validateEvidenceSelectionV2(
  copy: AiLocalCopyV2,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const accepted = input.locality.acceptedEntities;
  const acceptedIds = new Set(accepted.map(acceptedEntityId));
  const hay = flattenAiLocalCopyText(copy);

  if (!copy.evidenceSelection?.length) {
    return { ok: false, failures: ["evidence selection is missing"] };
  }
  const selectedIds = new Set(copy.evidenceSelection.map((row) => row.entityId));
  for (const entity of accepted) {
    const id = acceptedEntityId(entity);
    if (!selectedIds.has(id) && !copy.evidenceSelection.some((row) => row.name.toLowerCase() === entity.name.toLowerCase())) {
      failures.push(`evidence selection omitted entity ${id}`);
    }
  }
  for (const row of copy.evidenceSelection) {
    if (row.entityId && !acceptedIds.has(row.entityId)) {
      failures.push(`evidence selection unknown id ${row.entityId}`);
    }
    const named = hay.toLowerCase().includes(row.name.toLowerCase());
    if (row.useInCopy && !named && row.name.trim().toLowerCase() !== input.locality.areaName.trim().toLowerCase()) {
      failures.push(`evidence selection useInCopy true but ${row.name} is not named in copy`);
    }
    const areaEqualsEntity = row.name.trim().toLowerCase() === input.locality.areaName.trim().toLowerCase();
    if (!row.useInCopy && named && !areaEqualsEntity && row.classification !== "useful-healthcare-context" && row.classification !== "useful-access-orientation" && row.classification !== "useful-community-orientation") {
      failures.push(`entity ${row.name} appears in copy after being marked not for use`);
    }
    if (
      (row.category === "schools" || row.category === "retail" || /school|academy|retail/i.test(row.category)) &&
      row.useInCopy
    ) {
      failures.push(`school/retail must not be forced: ${row.name}`);
    }
  }

  const useful = usefulLocalEvidenceEntitiesV2(input);
  const min = minimumUsefulEntitiesRequiredV2(input);
  const namedUseful = useful.filter((entity) => hay.toLowerCase().includes(entity.name.toLowerCase()));
  const usedIds = new Set(copy.evidenceEntityIdsUsed);
  if (min > 0 && namedUseful.length < min) {
    failures.push(`medium/rich evidence cannot pass with fewer than ${min} useful entities named`);
  }
  if (min > 0 && copy.evidenceEntityIdsUsed.length === 0) {
    failures.push("medium/rich pilots cannot pass with evidenceEntityIdsUsed: []");
  }
  for (const entity of namedUseful) {
    const id = acceptedEntityId(entity);
    if (!usedIds.has(id)) failures.push(`named entity ${entity.name} missing from evidenceEntityIdsUsed`);
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function looksLikeGenericAreaSubstitutionV2(copy: AiLocalCopyV1): boolean {
  const intro = copy.heroIntroduction.trim();
  if (/^\s*residents (?:of|in) .{2,40} can (?:access|use)/i.test(intro)) return true;
  if (/^\s*people in .{2,40} can use /i.test(intro)) return true;
  const context = copy.localContextParagraphs.join(" ");
  if (/offers a convenient way for .+ residents/i.test(context)) return true;
  return false;
}
