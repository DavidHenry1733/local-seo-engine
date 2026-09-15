/**
 * Strict structured AI local-copy schema V1.
 * The model returns copy data only — never HTML.
 */
import { localAreaOpenAiParseOptions } from "./pharmacyContentGenerationFieldPolicyV1.ts";

export const AI_LOCAL_COPY_SCHEMA_VERSION = "ai-local-copy-v1";

export const AI_LOCAL_COPY_ALLOWED_FIELDS = [
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
] as const;

export type AiLocalFaqV1 = {
  question: string;
  answer: string;
};

export type AiEvidenceClaimHintV1 = {
  field: string;
  sentence: string;
  entityId?: string;
  editorialFactId?: string;
};

export type AiLocalCopyV1 = {
  area: string;
  heroHeading: string;
  heroIntroduction: string;
  localIntroduction: string;
  localContextHeading: string;
  localContextParagraphs: string[];
  relationshipToPharmacy: string;
  localAccessIntroduction: string;
  localFaqs: AiLocalFaqV1[];
  localCtaBridge: string;
  evidenceClaims: AiEvidenceClaimHintV1[];
  evidenceEntityIdsUsed: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNonEmptyString(value: unknown, field: string, failures: string[]): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) failures.push(`${field} must be a non-empty string`);
  if (text.includes("<") || text.includes(">")) failures.push(`${field} must not contain HTML`);
  return text;
}

function asOptionalString(value: unknown, field: string, failures: string[]): string {
  if (value == null) return "";
  if (typeof value !== "string") {
    failures.push(`${field} must be a string when present`);
    return "";
  }
  const text = value.trim();
  if (text.includes("<") || text.includes(">")) failures.push(`${field} must not contain HTML`);
  return text;
}

export type ParseAiLocalCopyOptsV1 = {
  optionalArea?: boolean;
  optionalHeroHeading?: boolean;
  optionalHeroIntroduction?: boolean;
  optionalLocalIntroduction?: boolean;
  optionalLocalContextHeading?: boolean;
  optionalLocalContextParagraphs?: boolean;
  optionalRelationshipToPharmacy?: boolean;
  optionalLocalAccessIntroduction?: boolean;
  optionalLocalFaqs?: boolean;
  optionalLocalCtaBridge?: boolean;
};

export function parseAiLocalCopyV1(
  raw: unknown,
  opts?: ParseAiLocalCopyOptsV1,
): { ok: true; copy: AiLocalCopyV1 } | { ok: false; failures: string[] } {
  const failures: string[] = [];
  if (typeof raw === "string") {
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      raw = JSON.parse(stripped);
    } catch {
      return { ok: false, failures: ["AI response is not valid JSON"] };
    }
  }
  if (!isPlainObject(raw)) return { ok: false, failures: ["AI response is not a JSON object"] };
  const unknown = Object.keys(raw).filter((key) => !AI_LOCAL_COPY_ALLOWED_FIELDS.includes(key as (typeof AI_LOCAL_COPY_ALLOWED_FIELDS)[number]));
  if (unknown.length) failures.push(`unknown fields: ${unknown.join(", ")}`);

  const copy: AiLocalCopyV1 = {
    area: opts?.optionalArea ? asOptionalString(raw.area, "area", failures) : asNonEmptyString(raw.area, "area", failures),
    heroHeading: opts?.optionalHeroHeading
      ? asOptionalString(raw.heroHeading, "heroHeading", failures)
      : asNonEmptyString(raw.heroHeading, "heroHeading", failures),
    heroIntroduction: opts?.optionalHeroIntroduction
      ? asOptionalString(raw.heroIntroduction, "heroIntroduction", failures)
      : asNonEmptyString(raw.heroIntroduction, "heroIntroduction", failures),
    localIntroduction: opts?.optionalLocalIntroduction
      ? asOptionalString(raw.localIntroduction, "localIntroduction", failures)
      : asNonEmptyString(raw.localIntroduction, "localIntroduction", failures),
    localContextHeading: opts?.optionalLocalContextHeading
      ? asOptionalString(raw.localContextHeading, "localContextHeading", failures)
      : asNonEmptyString(raw.localContextHeading, "localContextHeading", failures),
    localContextParagraphs: [],
    relationshipToPharmacy: opts?.optionalRelationshipToPharmacy
      ? asOptionalString(raw.relationshipToPharmacy, "relationshipToPharmacy", failures)
      : asNonEmptyString(raw.relationshipToPharmacy, "relationshipToPharmacy", failures),
    localAccessIntroduction: opts?.optionalLocalAccessIntroduction
      ? asOptionalString(raw.localAccessIntroduction, "localAccessIntroduction", failures)
      : asNonEmptyString(raw.localAccessIntroduction, "localAccessIntroduction", failures),
    localFaqs: [],
    localCtaBridge: opts?.optionalLocalCtaBridge
      ? asOptionalString(raw.localCtaBridge, "localCtaBridge", failures)
      : asNonEmptyString(raw.localCtaBridge, "localCtaBridge", failures),
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
  };

  if (raw.localContextParagraphs == null && opts?.optionalLocalContextParagraphs) {
    copy.localContextParagraphs = [];
  } else if (!Array.isArray(raw.localContextParagraphs)) {
    failures.push(
      opts?.optionalLocalContextParagraphs
        ? "localContextParagraphs must be an array when present"
        : "localContextParagraphs must be an array of 1–3 strings",
    );
  } else if (opts?.optionalLocalContextParagraphs) {
    if (raw.localContextParagraphs.length > 3) {
      failures.push("localContextParagraphs must be an array of at most 3 strings");
    } else {
      copy.localContextParagraphs = raw.localContextParagraphs.map((para, i) =>
        asNonEmptyString(para, `localContextParagraphs[${i}]`, failures),
      );
    }
  } else if (raw.localContextParagraphs.length < 1 || raw.localContextParagraphs.length > 3) {
    failures.push("localContextParagraphs must be an array of 1–3 strings");
  } else {
    copy.localContextParagraphs = raw.localContextParagraphs.map((para, i) =>
      asNonEmptyString(para, `localContextParagraphs[${i}]`, failures),
    );
  }

  if (raw.localFaqs == null && opts?.optionalLocalFaqs) {
    copy.localFaqs = [];
  } else if (!Array.isArray(raw.localFaqs)) {
    failures.push(opts?.optionalLocalFaqs ? "localFaqs must be an array when present" : "localFaqs must be an array of 3–6 {question, answer} objects");
  } else if (opts?.optionalLocalFaqs) {
    if (raw.localFaqs.length > 6) {
      failures.push("localFaqs must be an array of at most 6 {question, answer} objects");
    } else {
      copy.localFaqs = raw.localFaqs.map((faq, i) => {
        if (!isPlainObject(faq)) {
          failures.push(`localFaqs[${i}] must be an object`);
          return { question: "", answer: "" };
        }
        const extra = Object.keys(faq).filter((key) => !["question", "answer", "q", "a"].includes(key));
        if (extra.length) failures.push(`localFaqs[${i}] unknown fields: ${extra.join(", ")}`);
        return {
          question: asNonEmptyString(faq.question ?? faq.q, `localFaqs[${i}].question`, failures),
          answer: asNonEmptyString(faq.answer ?? faq.a, `localFaqs[${i}].answer`, failures),
        };
      });
    }
  } else if (raw.localFaqs.length < 3 || raw.localFaqs.length > 6) {
    failures.push("localFaqs must be an array of 3–6 {question, answer} objects");
  } else {
    copy.localFaqs = raw.localFaqs.map((faq, i) => {
      if (!isPlainObject(faq)) {
        failures.push(`localFaqs[${i}] must be an object`);
        return { question: "", answer: "" };
      }
      const extra = Object.keys(faq).filter((key) => !["question", "answer", "q", "a"].includes(key));
      if (extra.length) failures.push(`localFaqs[${i}] unknown fields: ${extra.join(", ")}`);
      return {
        question: asNonEmptyString(faq.question ?? faq.q, `localFaqs[${i}].question`, failures),
        answer: asNonEmptyString(faq.answer ?? faq.a, `localFaqs[${i}].answer`, failures),
      };
    });
  }

  if (raw.evidenceClaims == null) {
    copy.evidenceClaims = [];
  } else if (!Array.isArray(raw.evidenceClaims)) {
    failures.push("evidenceClaims must be an array");
  } else {
    copy.evidenceClaims = raw.evidenceClaims
      .map((claim, i) => {
        if (!isPlainObject(claim)) {
          failures.push(`evidenceClaims[${i}] must be an object`);
          return { field: "", sentence: "" };
        }
        const field = String(claim.field || claim.path || claim.name || "").trim();
        const sentence = String(claim.sentence || claim.claim || claim.value || claim.text || "").trim();
        const row: AiEvidenceClaimHintV1 = { field, sentence };
        const entityId = claim.entityId ?? claim.entity ?? claim.id;
        if (entityId != null && String(entityId).trim()) row.entityId = String(entityId).trim();
        const editorialFactId = String(claim.editorialFactId || claim.factId || "").trim();
        if (editorialFactId) {
          row.editorialFactId = editorialFactId;
        } else if (row.entityId && /^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/i.test(row.entityId)) {
          row.editorialFactId = row.entityId;
        }
        return row;
      })
      .filter((row) => row.field && row.sentence);
  }

  if (raw.evidenceEntityIdsUsed == null) {
    copy.evidenceEntityIdsUsed = [];
  } else if (!Array.isArray(raw.evidenceEntityIdsUsed)) {
    failures.push("evidenceEntityIdsUsed must be an array of strings");
  } else {
    copy.evidenceEntityIdsUsed = raw.evidenceEntityIdsUsed
      .map((id) => {
        if (typeof id === "string") return id.trim();
        if (id && typeof id === "object" && "entityId" in (id as object)) {
          return String((id as { entityId?: unknown }).entityId || "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }

  if (failures.length) return { ok: false, failures };
  return { ok: true, copy };
}

export function flattenAiLocalCopyText(copy: AiLocalCopyV1): string {
  return [
    copy.heroHeading,
    copy.heroIntroduction,
    copy.localIntroduction,
    copy.localContextHeading,
    ...copy.localContextParagraphs,
    copy.relationshipToPharmacy,
    copy.localAccessIntroduction,
    ...copy.localFaqs.flatMap((faq) => [faq.question, faq.answer]),
    copy.localCtaBridge,
  ]
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

export const AI_LOCAL_COPY_SCHEMA_VERSION_V2 = "ai-local-copy-v2";

export const AI_LOCAL_COPY_V2_EXTRA_FIELDS = ["evidenceSelection", "sentencePurposes"] as const;

export type AiEvidenceSelectionRowV2 = {
  entityId: string;
  name: string;
  category: string;
  classification:
    | "useful-healthcare-context"
    | "useful-access-orientation"
    | "useful-community-orientation"
    | "irrelevant-to-patient-decision"
    | "unsafe-or-ambiguous";
  useInCopy: boolean;
  reason: string;
};

export type AiSentencePurposeRowV2 = {
  field: string;
  sentence: string;
  purpose: string;
  supportingSource: string;
  readerValue: string;
};

export type AiLocalCopyV2 = AiLocalCopyV1 & {
  evidenceSelection: AiEvidenceSelectionRowV2[];
  sentencePurposes?: AiSentencePurposeRowV2[];
};

const CLASSIFICATIONS = new Set([
  "useful-healthcare-context",
  "useful-access-orientation",
  "useful-community-orientation",
  "irrelevant-to-patient-decision",
  "unsafe-or-ambiguous",
]);

export function parseAiLocalCopyV2(
  raw: unknown,
): { ok: true; copy: AiLocalCopyV2 } | { ok: false; failures: string[] } {
  const failures: string[] = [];
  if (typeof raw === "string") {
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      raw = JSON.parse(stripped);
    } catch {
      return { ok: false, failures: ["AI response is not valid JSON"] };
    }
  }
  if (!isPlainObject(raw)) return { ok: false, failures: ["AI response is not a JSON object"] };

  const allowed = new Set<string>([...AI_LOCAL_COPY_ALLOWED_FIELDS, ...AI_LOCAL_COPY_V2_EXTRA_FIELDS]);
  const unknown = Object.keys(raw).filter((key) => !allowed.has(key));
  if (unknown.length) failures.push(`unknown fields: ${unknown.join(", ")}`);

  if (!Array.isArray(raw.evidenceSelection) || raw.evidenceSelection.length < 1) {
    failures.push("evidenceSelection must be a non-empty array covering every supplied entity");
  }
  const evidenceSelection: AiEvidenceSelectionRowV2[] = [];
  if (Array.isArray(raw.evidenceSelection)) {
    for (let i = 0; i < raw.evidenceSelection.length; i += 1) {
      const row = raw.evidenceSelection[i];
      if (!isPlainObject(row)) {
        failures.push(`evidenceSelection[${i}] must be an object`);
        continue;
      }
      const classification = String(row.classification || "").trim();
      if (!CLASSIFICATIONS.has(classification)) {
        failures.push(`evidenceSelection[${i}] unknown classification: ${classification || "(empty)"}`);
      }
      const entityId = String(row.entityId ?? row.id ?? row.entity ?? "").trim();
      const name = String(row.name ?? row.entityName ?? row.label ?? row.title ?? "").trim();
      const category = String(row.category ?? row.entityCategory ?? "").trim();
      const reason = String(row.reason ?? row.rationale ?? row.why ?? row.notes ?? "classified during evidence selection").trim();
      if (!entityId) failures.push(`evidenceSelection[${i}].entityId must be a non-empty string`);
      const useInCopy = row.useInCopy === true || row.useInCopy === "true" || row.use === true || row.include === true;
      evidenceSelection.push({
        entityId,
        name,
        category,
        classification: (CLASSIFICATIONS.has(classification)
          ? classification
          : "unsafe-or-ambiguous") as AiEvidenceSelectionRowV2["classification"],
        useInCopy,
        reason: reason || "classified during evidence selection",
      });
    }
  }

  const copyFields: Record<string, unknown> = {};
  for (const key of AI_LOCAL_COPY_ALLOWED_FIELDS) {
    if (key in raw) copyFields[key] = raw[key];
  }
  if (typeof copyFields.localContextParagraphs === "string") {
    const text = String(copyFields.localContextParagraphs).trim();
    copyFields.localContextParagraphs = text ? [text] : [];
  }
  const parsed = parseAiLocalCopyV1(copyFields);
  if (!parsed.ok) failures.push(...parsed.failures);

  const sentencePurposes: AiSentencePurposeRowV2[] = [];
  if (raw.sentencePurposes != null) {
    if (!Array.isArray(raw.sentencePurposes)) {
      failures.push("sentencePurposes must be an array when present");
    } else {
      for (const row of raw.sentencePurposes) {
        if (!isPlainObject(row)) continue;
        const field = String(row.field || "").trim();
        const sentence = String(row.sentence || "").trim();
        if (!field || !sentence) continue;
        sentencePurposes.push({
          field,
          sentence,
          purpose: String(row.purpose || "").trim(),
          supportingSource: String(row.supportingSource || row.source || "").trim(),
          readerValue: String(row.readerValue || row.why || "").trim(),
        });
      }
    }
  }

  if (failures.length || !parsed.ok) return { ok: false, failures: [...new Set(failures)] };
  return {
    ok: true,
    copy: {
      ...parsed.copy,
      evidenceSelection,
      ...(sentencePurposes.length ? { sentencePurposes } : {}),
    },
  };
}

export const AI_LOCAL_COPY_SCHEMA_VERSION_V3 = "ai-local-copy-v3";
export const AI_LOCAL_COPY_V3_EXTRA_FIELDS = ["editorialFactIdsUsed", "sentencePurposes", "evidenceSelection"] as const;

export type AiLocalCopyV3 = AiLocalCopyV1 & {
  editorialFactIdsUsed: string[];
  sentencePurposes?: AiSentencePurposeRowV2[];
};

export function parseAiLocalCopyV3(
  raw: unknown,
): { ok: true; copy: AiLocalCopyV3 } | { ok: false; failures: string[] } {
  const failures: string[] = [];
  if (typeof raw === "string") {
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      raw = JSON.parse(stripped);
    } catch {
      return { ok: false, failures: ["AI response is not valid JSON"] };
    }
  }
  if (!isPlainObject(raw)) return { ok: false, failures: ["AI response is not a JSON object"] };

  const allowed = new Set<string>([...AI_LOCAL_COPY_ALLOWED_FIELDS, ...AI_LOCAL_COPY_V3_EXTRA_FIELDS]);
  const unknown = Object.keys(raw).filter((key) => !allowed.has(key));
  if (unknown.length) failures.push(`unknown fields: ${unknown.join(", ")}`);

  const copyFields: Record<string, unknown> = {};
  for (const key of AI_LOCAL_COPY_ALLOWED_FIELDS) {
    if (key in raw) copyFields[key] = raw[key];
  }
  if (typeof copyFields.localContextParagraphs === "string") {
    const text = String(copyFields.localContextParagraphs).trim();
    copyFields.localContextParagraphs = text ? [text] : [];
  }
  const parsed = parseAiLocalCopyV1(copyFields, localAreaOpenAiParseOptions());
  if (!parsed.ok) failures.push(...parsed.failures);

  const editorialFactIdsUsed = Array.isArray(raw.editorialFactIdsUsed)
    ? raw.editorialFactIdsUsed.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  const sentencePurposes: AiSentencePurposeRowV2[] = [];
  if (raw.sentencePurposes != null) {
    if (!Array.isArray(raw.sentencePurposes)) {
      failures.push("sentencePurposes must be an array when present");
    } else {
      for (const row of raw.sentencePurposes) {
        if (!isPlainObject(row)) continue;
        const field = String(row.field || "").trim();
        const sentence = String(row.sentence || "").trim();
        if (!field || !sentence) continue;
        sentencePurposes.push({
          field,
          sentence,
          purpose: String(row.purpose || "").trim(),
          supportingSource: String(row.supportingSource || row.source || "").trim(),
          readerValue: String(row.readerValue || row.why || "").trim(),
        });
      }
    }
  }

  if (failures.length || !parsed.ok) return { ok: false, failures: [...new Set(failures)] };
  return {
    ok: true,
    copy: {
      ...parsed.copy,
      editorialFactIdsUsed,
      ...(sentencePurposes.length ? { sentencePurposes } : {}),
    },
  };
}

export function aiLocalContextRenderPartsV3(copy: Pick<AiLocalCopyV1, "localIntroduction" | "localContextHeading" | "localContextParagraphs">): {
  heading: string;
  bodyParts: string[];
} {
  return {
    heading: String(copy.localContextHeading || "").trim(),
    bodyParts: [copy.localIntroduction, ...copy.localContextParagraphs]
      .map((part) => String(part || "").trim())
      .filter(Boolean),
  };
}

export function hasCurrentGeminiLocalCopyFields(
  copy: { heroIntroduction?: string; localIntroduction?: string } | null | undefined,
): boolean {
  return Boolean(String(copy?.heroIntroduction || "").trim() && String(copy?.localIntroduction || "").trim());
}

export function aiLocalCopyOverlay(copy: AiLocalCopyV1) {
  const current = hasCurrentGeminiLocalCopyFields(copy);
  return {
    heroIntroduction: copy.heroIntroduction,
    localContextHeading: current ? "" : copy.localContextHeading,
    localIntroduction: copy.localIntroduction,
    localContextParagraphs: current ? [] : copy.localContextParagraphs,
    relationshipToPharmacy: copy.relationshipToPharmacy,
    localAccessIntroduction: current ? "" : copy.localAccessIntroduction,
    localFaqs: current ? [] : copy.localFaqs,
    localCtaBridge: current ? "" : copy.localCtaBridge,
  };
}
