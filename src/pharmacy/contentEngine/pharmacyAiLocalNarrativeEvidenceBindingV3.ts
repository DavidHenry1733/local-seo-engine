/**
 * Internal evidence-identifier bindings for generated local narrative.
 * Customer-facing fields must stay free of fact IDs. The ungrounded-clause
 * validator remains authoritative for whether a clause is actually covered.
 */
import { flattenAiLocalCopyText, type AiLocalCopyV1, type AiEvidenceClaimHintV1 } from "./pharmacyAiLocalCopySchemaV1.ts";
import { clauseCoveredByFactV3, formatWritingContractFindingV3, isNeutralConnectiveWordingV3, splitIndependentClausesV3, splitSentences } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3, isRendererOwnedPharmacyFirstIntroductionSentence, isApprovedPharmacyFirstServiceMeaningSentence } from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { classifyContentField, CONTENT_GENERATION_FIELD_CATALOG, FIELD_OWNERSHIP } from "./pharmacyContentGenerationFieldPolicyV1.ts";
import type { EditorialFactV3 } from "./pharmacyLocalEditorialEvidenceContractV3.ts";

export const LOCAL_NARRATIVE_BINDING_FIELDS_V3 = CONTENT_GENERATION_FIELD_CATALOG
  .filter(
    (row) =>
      row.pageKind === "local-area-page" && row.ownership === FIELD_OWNERSHIP.OPTIONAL_EVIDENCE_BOUND,
  )
  .map((row) => row.fieldId);

function customerFacingFields(copy: AiLocalCopyV1): Array<{ field: string; text: string }> {
  return [
    { field: "heroHeading", text: copy.heroHeading },
    { field: "heroIntroduction", text: copy.heroIntroduction },
    { field: "localIntroduction", text: copy.localIntroduction },
    { field: "localContextHeading", text: copy.localContextHeading },
    ...copy.localContextParagraphs.map((text, i) => ({ field: `localContextParagraphs[${i}]`, text })),
    { field: "relationshipToPharmacy", text: copy.relationshipToPharmacy },
    { field: "localAccessIntroduction", text: copy.localAccessIntroduction },
    ...copy.localFaqs.flatMap((faq, i) => [
      { field: `localFaqs[${i}].question`, text: faq.question },
      { field: `localFaqs[${i}].answer`, text: faq.answer },
    ]),
    { field: "localCtaBridge", text: copy.localCtaBridge },
  ];
}

function localFactualBindingFields(copy: AiLocalCopyV1): Array<{ field: string; text: string }> {
  return [
    { field: "localIntroduction", text: copy.localIntroduction },
    { field: "localContextHeading", text: copy.localContextHeading },
    ...copy.localContextParagraphs.map((text, i) => ({ field: `localContextParagraphs[${i}]`, text })),
    { field: "localAccessIntroduction", text: copy.localAccessIntroduction },
    ...copy.localFaqs.flatMap((faq, i) => [
      { field: `localFaqs[${i}].question`, text: faq.question },
      { field: `localFaqs[${i}].answer`, text: faq.answer },
    ]),
    { field: "localCtaBridge", text: copy.localCtaBridge },
    { field: "relationshipToPharmacy", text: copy.relationshipToPharmacy },
  ];
}

function normalizeSentence(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function claimEditorialFactId(claim: AiEvidenceClaimHintV1): string {
  const explicit = String(claim.editorialFactId || "").trim();
  if (explicit) return explicit;
  const entity = String(claim.entityId || "").trim();
  if (/^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/i.test(entity)) return entity;
  return "";
}

function isLockedClinicalOnlySentence(sentence: string, areaName: string): boolean {
  const allowed = [
    ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
    "Pharmacy First",
    "eligible common conditions",
    areaName,
  ]
    .join(" ")
    .toLowerCase();
  const leftover = normalizeSentence(sentence)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !allowed.includes(token));
  return leftover.length === 0;
}

function isNonClaimHeadingOrCta(field: string, sentence: string): boolean {
  if (field === "localContextHeading" && sentence.split(/\s+/).length <= 8) return true;
  if (field === "localCtaBridge" && /book|call|appointment/i.test(sentence) && sentence.split(/\s+/).length <= 18) {
    return true;
  }
  return false;
}

function isServiceConnectionSentence(sentence: string, areaName: string): boolean {
  if (!/pharmacy first/i.test(sentence)) return false;
  if (/\b(Medical Centre|Health Centre|Surgery|Practice|Library|Country Park|Memorial Hall|War Memorial)\b/i.test(sentence)) {
    return false;
  }
  const leftover = normalizeSentence(sentence)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .filter((token) => {
      if (token === "pharmacy" || token === "first") return false;
      if (areaName.toLowerCase().split(/\s+/).includes(token)) return false;
      return !/\b(people|person|readers|residents|living|who|this|that|from|with|for|the|and|can|use|using|selected|service|page|area|around|in|available|support|help|need|when|they|these|local|facilities|community|features|mind|eligible|common|conditions)\b/.test(
        token,
      );
    });
  return leftover.length <= 8;
}

export function assertLocalNarrativeEvidenceBindingsV3(
  copy: AiLocalCopyV1,
  opts: { areaName: string },
  editorialFacts: EditorialFactV3[],
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const knownIds = new Set(
    editorialFacts.filter((fact) => fact.validationStatus === "accepted").map((fact) => fact.factId),
  );
  const customerHay = flattenAiLocalCopyText(copy);
  for (const factId of knownIds) {
    for (const { field, text } of customerFacingFields(copy)) {
      if (String(text || "").includes(factId)) {
        failures.push(
          formatWritingContractFindingV3({
            field,
            sentence: String(text || ""),
            rule: "customer-facing-fact-id",
            defect: "supplied evidence identifiers must stay internal and must not appear in customer-facing copy",
          }),
        );
      }
    }
  }
  if (/\bfactId\b/i.test(customerHay) || /\beditorialFactId\b/i.test(customerHay)) {
    failures.push(
      formatWritingContractFindingV3({
        field: "page",
        sentence: customerHay.slice(0, 180),
        rule: "customer-facing-fact-id",
        defect: "fact identifiers leaked into customer-facing copy",
      }),
    );
  }

  const claims = copy.evidenceClaims || [];
  for (const { field, text } of localFactualBindingFields(copy)) {
    const parts = splitSentences(text);
    if (!parts.length && String(text || "").trim()) parts.push(String(text).trim());
    for (const sentence of parts) {
      if (!sentence) continue;
      if (isLockedClinicalOnlySentence(sentence, opts.areaName)) continue;
      if (isRendererOwnedPharmacyFirstIntroductionSentence(sentence)) continue;
      if (isApprovedPharmacyFirstServiceMeaningSentence(sentence)) continue;
      if (isNeutralConnectiveWordingV3(sentence, opts.areaName)) continue;
      if (field === "localIntroduction" && isServiceConnectionSentence(sentence, opts.areaName)) continue;
      if (/\?\s*$/.test(sentence)) continue;
      if (isNonClaimHeadingOrCta(field, sentence) && !/\b\d+(?:\.\d+)?\s*km\b/i.test(sentence)) continue;
      const ownership = classifyContentField("local-area-page", field.replace(/\[.*$/, "").replace(/\..*$/, ""));
      if (ownership === FIELD_OWNERSHIP.DETERMINISTIC) {
        continue;
      }
      const matched = claims.find((claim) => {
        const claimSentence = normalizeSentence(claim.sentence);
        const factId = claimEditorialFactId(claim);
        const fieldOk =
          !claim.field ||
          claim.field === field ||
          field.startsWith(`${claim.field}[`) ||
          field.startsWith(`${claim.field}.`);
        return fieldOk && claimSentence === normalizeSentence(sentence) && knownIds.has(factId);
      });
      if (!matched) {
        failures.push(
          formatWritingContractFindingV3({
            field,
            sentence,
            rule: "missing-editorial-fact-id",
            defect: "local factual sentence has no internal evidenceClaims.editorialFactId from this area’s supplied facts",
          }),
        );
      }
    }
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function supportingEditorialFactsForSentenceV3(
  sentence: string,
  editorialFacts: EditorialFactV3[],
): EditorialFactV3[] {
  const accepted = editorialFacts.filter((fact) => fact.validationStatus === "accepted");
  const clauses = splitIndependentClausesV3(sentence);
  const parts = [sentence, ...(clauses.length > 1 ? clauses : [])];
  const matched = new Map<string, EditorialFactV3>();
  for (const part of parts) {
    const clause = normalizeSentence(part);
    if (!clause) continue;
    for (const fact of accepted) {
      const row = clauseCoveredByFactV3(clause, fact);
      if (!row.covered || row.extraAssertion) continue;
      matched.set(fact.factId, fact);
    }
  }
  return [...matched.values()];
}

export function attachLocalIntroductionEvidenceClaimsV3(
  copy: AiLocalCopyV1,
  opts: { areaName: string },
  editorialFacts: EditorialFactV3[],
): AiLocalCopyV1 {
  const accepted = editorialFacts.filter((fact) => fact.validationStatus === "accepted");
  const claims = [...(copy.evidenceClaims || [])];
  const used = [...((copy as { editorialFactIdsUsed?: string[] }).editorialFactIdsUsed || [])];
  const parts = splitSentences(copy.localIntroduction);
  if (!parts.length && String(copy.localIntroduction || "").trim()) parts.push(String(copy.localIntroduction).trim());
  for (const sentence of parts) {
    if (!sentence) continue;
    if (isServiceConnectionSentence(sentence, opts.areaName)) continue;
    if (isLockedClinicalOnlySentence(sentence, opts.areaName)) continue;
    if (isRendererOwnedPharmacyFirstIntroductionSentence(sentence)) continue;
    if (isApprovedPharmacyFirstServiceMeaningSentence(sentence)) continue;
    if (isNeutralConnectiveWordingV3(sentence, opts.areaName)) continue;
    const already = new Set(
      claims
        .filter((claim) => normalizeSentence(claim.sentence) === normalizeSentence(sentence))
        .map((claim) => claimEditorialFactId(claim))
        .filter(Boolean),
    );
    const matches = supportingEditorialFactsForSentenceV3(sentence, accepted);
    for (const match of matches) {
      if (already.has(match.factId)) continue;
      claims.push({
        field: "localIntroduction",
        sentence,
        editorialFactId: match.factId,
      });
      already.add(match.factId);
      if (!used.includes(match.factId)) used.push(match.factId);
    }
  }
  return { ...copy, evidenceClaims: claims, editorialFactIdsUsed: used };
}
