/**
 * Accepted Brook Gemini local-copy validation.
 * Word counts, two-or-three-paragraph local introduction, pharmacy/service naming,
 * leakage and banned-phrase checks. Does not require Gemini grounding metadata.
 */
import fs from "node:fs";
import path from "node:path";

import type { AiLocalCopyV3 } from "./pharmacyAiLocalCopySchemaV1.ts";
import type { BusinessLocalityCopyInputV3 } from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import type { GeminiLocalGroundingMetadataV1 } from "./pharmacyUkLocalIntroductionProseWriterV1.ts";
import {
  countUkLocalIntroductionWords,
  UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS,
  UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS,
  UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE,
} from "./pharmacyUkLocalIntroductionStyleContractV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

const BANNED_LEGACY_PHRASES =
  /\b(orient yourself|orientating pharmacy care|local orientation|familiar points around|recorded healthcare setting|listed as|recorded as|named on the provider page|evidence pack|editorial fact|fact id)\b/i;

/** Place, source, or evidence catalogue uses of “recorded as”. Clinical measurement wording is not this. */
const EVIDENCE_PLACE_RECORDED_AS =
  /\brecorded\s+as\s+(?:a|an|the\s+)?(?:verified\s+)?(?:healthcare|community|local|landmark|transport|school|retail|evidence|location|place|setting|facility)\b/i;

const SOURCE_RECORDS_PLACE =
  /\bsource\s+records?\s+(?:this\s+)?(?:location|place)\s+as\b/i;

const CLINICAL_MEASUREMENT_RECORDED_AS =
  /\b(?:systolic|diastolic|mmhg|millimetres?|blood pressure|reading)\b/i;

const SOURCE_LISTING =
  /\b(according to (?:google|wikipedia|the council)|source:|citation|grounding chunk|search result id|places id|dataforseo)\b/i;

const EVIDENCE_ID = /\b(?:ed|fact|ent|loc|editorial)-[a-z0-9-]{4,}\b/i;

const UNSUPPORTED_CLAIMS =
  /\b(guaranteed(?:ly)?|walk-?in(?:s)?|same[- ]day (?:treatment|medicine)|faster care|convenient|immediate(?:ly)? available|prompt treatment|never (?:need|requires?) a gp|easy to reach|easily accessible|travel time|minutes away|open (?:now|late)|always available)\b/i;

function approvedClinicalText(input: BusinessLocalityCopyInputV3): string {
  const locked = input.offer?.lockedClinicalFacts;
  return [locked?.conditionSet, locked?.suitability, locked?.process, locked?.safety]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isClinicalRecordedAs(sentence: string, approved: string): boolean {
  if (!/\brecorded\s+as\b/i.test(sentence)) return false;
  if (EVIDENCE_PLACE_RECORDED_AS.test(sentence) || SOURCE_RECORDS_PLACE.test(sentence)) return false;
  if (CLINICAL_MEASUREMENT_RECORDED_AS.test(sentence)) return true;
  const compact = sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return compact.length >= 24 && approved.includes(compact);
}

/**
 * Evidence-catalogue “recorded as” stays visible to the listing bans.
 * Approved or clinical measurement wording does not.
 */
export function phraseScanTextForListingRules(text: string, input: BusinessLocalityCopyInputV3): string {
  const approved = approvedClinicalText(input);
  return splitSentences(text)
    .map((sentence) => {
      if (!isClinicalRecordedAs(sentence, approved)) return sentence;
      return sentence.replace(/\brecorded\s+as\b/gi, "expressed as");
    })
    .join(" ");
}

function splitSentences(text: string): string[] {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function paragraphs(text: string): string[] {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function otherPharmacyNames(currentName: string): string[] {
  const dir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles");
  if (!fs.existsSync(dir)) return [];
  const current = currentName.trim().toLowerCase();
  const names: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as {
        data?: { pharmacyName?: string };
      };
      const name = String(doc.data?.pharmacyName || "").trim();
      if (name && name.toLowerCase() !== current) names.push(name);
    } catch {
      /* ignore */
    }
  }
  return names;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function groundingMetadataExists(meta: GeminiLocalGroundingMetadataV1 | null | undefined): boolean {
  if (!meta) return false;
  return (
    (meta.webSearchQueries || []).length > 0 ||
    (meta.groundingChunks || []).length > 0 ||
    Number(meta.groundingSupportCount || 0) > 0
  );
}

export function evaluateAcceptedGeminiLocalCopyV1(opts: {
  copy: AiLocalCopyV3;
  input: BusinessLocalityCopyInputV3;
  grounding: GeminiLocalGroundingMetadataV1 | null;
  expectedSlug: string;
  expectedServiceId: string;
  expectedAreaName: string;
}): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const copy = opts.copy;
  const input = opts.input;
  const hay = `${copy.heroIntroduction}\n${copy.localIntroduction}`;
  const pharmacy = String(input.business.name || "").trim();
  const service = String(input.offer.serviceName || "").trim();
  const area = String(input.locality.areaName || "").trim();

  if (String(input.tenantSlug || "").trim() !== opts.expectedSlug) {
    failures.push(`incorrect tenant: expected ${opts.expectedSlug}`);
  }
  if (String(input.offer.serviceId || "").trim() !== opts.expectedServiceId) {
    failures.push(`incorrect campaign: expected ${opts.expectedServiceId}`);
  }
  if (area.toLowerCase() !== String(opts.expectedAreaName || "").trim().toLowerCase()) {
    failures.push(`incorrect selected area: expected ${opts.expectedAreaName}`);
  }
  if (String(copy.area || "").trim().toLowerCase() !== area.toLowerCase()) {
    failures.push(`copy area does not match selected area ${area}`);
  }

  const pharmacyRe = pharmacy ? new RegExp(escapeRe(pharmacy), "i") : /(?!)/;
  const serviceRe = service ? new RegExp(escapeRe(service), "i") : /(?!)/;
  if (!pharmacyRe.test(hay)) failures.push(`copy must name ${pharmacy || "the confirmed pharmacy"}`);
  if (!serviceRe.test(hay)) failures.push(`copy must name ${service || "the selected service"}`);

  const heroWords = countUkLocalIntroductionWords(copy.heroIntroduction);
  if (heroWords < UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS || heroWords > UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS) {
    failures.push(
      `hero length ${heroWords} words; required ${UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS}–${UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS}`,
    );
  }
  const localParas = paragraphs(copy.localIntroduction);
  const introWords = countUkLocalIntroductionWords(copy.localIntroduction);
  if (localParas.length < 2 || localParas.length > 3) {
    failures.push(`local introduction must be two or three paragraphs (found ${localParas.length})`);
  }
  if (introWords < 100 || introWords > 180) {
    failures.push(`introduction length ${introWords} words; required 100–180`);
  }

  const sentences = splitSentences(hay);
  let scanned = hay;
  for (const entity of input.locality.acceptedEntities || []) {
    const name = String(entity.name || "").trim();
    if (name.length < 3) continue;
    scanned = scanned.replace(new RegExp(escapeRe(name), "gi"), " ");
  }
  const seen = new Set<string>();
  for (const sentence of sentences) {
    const key = sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length < 20) continue;
    if (seen.has(key)) {
      failures.push(`repeated sentence: ${sentence}`);
      break;
    }
    seen.add(key);
  }

  for (const sibling of input.locality.neighbouringSelectedAreas || []) {
    if (!sibling || sibling.toLowerCase() === area.toLowerCase()) continue;
    if (new RegExp(`\\b${escapeRe(sibling)}\\b`, "i").test(hay)) {
      failures.push(`another-area leakage: ${sibling}`);
    }
  }
  for (const other of otherPharmacyNames(pharmacy)) {
    if (other.length < 8) continue;
    if (new RegExp(`\\b${escapeRe(other)}\\b`, "i").test(hay)) {
      failures.push(`another-tenant leakage: ${other}`);
    }
  }

  const phraseScanned = phraseScanTextForListingRules(scanned, input);
  if (
    UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE.test(phraseScanned) ||
    SOURCE_LISTING.test(phraseScanned) ||
    EVIDENCE_ID.test(phraseScanned) ||
    SOURCE_RECORDS_PLACE.test(scanned) ||
    EVIDENCE_PLACE_RECORDED_AS.test(phraseScanned)
  ) {
    failures.push("evidence IDs or source-listing language");
  }
  if (UNSUPPORTED_CLAIMS.test(scanned)) {
    failures.push("unsupported promotional, access, availability or clinical claim");
  }
  if (BANNED_LEGACY_PHRASES.test(phraseScanned)) {
    failures.push("banned legacy phrase present");
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

const CORRECTABLE_ACCEPTED_GEMINI_COPY_DEFECT =
  /^(?:another-area leakage:|hero length |local introduction must be exactly three paragraphs|local introduction must be two or three paragraphs|introduction length |repeated sentence:|banned legacy phrase present$|evidence IDs or source-listing language$|unsupported promotional, access, availability or clinical claim$|local-narrative similarity |copy must name |local introduction prose could not be parsed$)/i;

export function isCorrectableAcceptedGeminiCopyDefect(failure: string): boolean {
  return CORRECTABLE_ACCEPTED_GEMINI_COPY_DEFECT.test(String(failure || "").trim());
}

/** True only when every failure is copy structure, duplication, banned wording or another-area leakage. */
export function isCorrectableAcceptedGeminiCopyFailure(failures: string[]): boolean {
  const unique = [...new Set((failures || []).map((row) => String(row || "").trim()).filter(Boolean))];
  return unique.length > 0 && unique.every(isCorrectableAcceptedGeminiCopyDefect);
}

export function shouldAttemptAcceptedGeminiCopyCorrection(opts: {
  failures: string[];
  uncertain?: boolean;
  providerError?: boolean;
}): boolean {
  if (opts.uncertain || opts.providerError) return false;
  return isCorrectableAcceptedGeminiCopyFailure(opts.failures);
}

export function canPersistAcceptedGeminiLocalCopy(opts: { ok: boolean; copy: unknown }): boolean {
  return opts.ok === true && opts.copy != null;
}

/** Inactive alias. The grounding-metadata gate is not part of accepted validation. */
export function evaluateGroundedGeminiLocalCopyV1(
  opts: Parameters<typeof evaluateAcceptedGeminiLocalCopyV1>[0],
): ReturnType<typeof evaluateAcceptedGeminiLocalCopyV1> {
  return evaluateAcceptedGeminiLocalCopyV1(opts);
}
