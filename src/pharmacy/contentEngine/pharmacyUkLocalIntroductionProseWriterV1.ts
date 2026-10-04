/**
 * Dedicated Gemini prose writer for the local hero and introduction.
 * Restored accepted Brook Gemini local-copy call. Returns plain text.
 * One Google Search-grounded Gemini call rewrites heroIntroduction and localIntroduction.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { parseAiLocalCopyV3, type AiLocalCopyV3 } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  keepGeminiLocalIntroductionParagraphs,
  type BusinessLocalityCopyInputV3,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { countUkLocalIntroductionWords } from "./pharmacyUkLocalIntroductionStyleContractV1.ts";

export const UK_LOCAL_INTRODUCTION_PROSE_WRITER_ID = "pharmacy-uk-local-introduction-prose-writer-v1";
export const UK_LOCAL_INTRODUCTION_WRITER_PROVIDER = "gemini" as const;
export const UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE = false;
export const UK_LOCAL_INTRODUCTION_GEMINI_MODEL = "gemini-3.6-flash";
export const UK_LOCAL_INTRODUCTION_GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${UK_LOCAL_INTRODUCTION_GEMINI_MODEL}:generateContent`;
export const UK_LOCAL_INTRODUCTION_GEMINI_GOOGLE_SEARCH_TOOL = { google_search: {} } as const;

const PHARMACY_FIRST_SERVICE_MEANING = [
  "provides SERVICE consultations for eligible people from the selected area.",
  "covers certain common health conditions.",
  "The pharmacist assesses symptoms, relevant medicines and medical history.",
  "The outcome may include advice, suitable treatment or referral to another healthcare professional.",
  "Eligibility and treatment depend on the individual clinical assessment.",
];

function pharmacyFirstMeaningLines(pharmacy: string, service: string): string[] {
  return [
    `- ${pharmacy} provides ${service} consultations for eligible people from the selected area.`,
    `- ${service} covers certain common health conditions.`,
    `- ${PHARMACY_FIRST_SERVICE_MEANING[2]}`,
    `- ${PHARMACY_FIRST_SERVICE_MEANING[3]}`,
    `- ${PHARMACY_FIRST_SERVICE_MEANING[4]}`,
  ];
}

const DOWNSTREAM_SAFETY_NOT_FOR_INTRODUCTION =
  /\b(chest pain|severe headache|sudden vision|neurological symptoms|do not diagnose|does not diagnose|on the spot|long-term management|one reading does not|systolic over diastolic)\b/i;

function introductionSelectableMeaning(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20 && !DOWNSTREAM_SAFETY_NOT_FOR_INTRODUCTION.test(sentence))
    .join(" ");
}

export function approvedServiceMeaningLines(input: {
  business: { name: string };
  offer: {
    serviceId: string;
    serviceName: string;
    lockedClinicalFacts: {
      conditionSet: string;
      suitability: string;
      process: string;
      safety: string;
    };
  };
}): string[] {
  const pharmacy = String(input.business.name || "the confirmed pharmacy").trim() || "the confirmed pharmacy";
  const service = String(input.offer.serviceName || "the service").trim() || "the service";
  if (input.offer.serviceId === "pharmacy-first") {
    return pharmacyFirstMeaningLines(pharmacy, service);
  }
  const locked = input.offer.lockedClinicalFacts;
  const lines = [locked.conditionSet, locked.suitability, locked.process, locked.safety]
    .map((line) => introductionSelectableMeaning(line))
    .filter((line) => line.length > 20)
    .slice(0, 6)
    .map((line) => `- ${line}`);
  return lines.length
    ? lines
    : [`- ${pharmacy} provides ${service} for eligible people from the selected area.`];
}

const SERVICE_DEFINITION_READING_STRUCTURES = [
  "Open with what the service is for, then who a pharmacist can help, then what the consultation covers, then possible outcomes, then that eligibility depends on individual clinical assessment.",
  "Lead with the pharmacist consultation itself, then eligible common conditions in general terms, then advice, treatment or referral outcomes, then the assessment caveat, then how this sits alongside existing NHS care.",
  "Start from everyday health concerns, then explain that a pharmacist can assess symptoms and medicines, then name possible next steps, then rest the clinical-assessment boundary, then close with why this matters for people in this area.",
  "Use a short definition sentence, then a longer consultation sentence, then a compact outcomes sentence, then a safety-net sentence, then a closing sentence that names the area without repeating the opening.",
  "Begin with access to a pharmacist, then the purpose of the assessment, then relevant medical history, then possible advice or treatment, then referral when that is the safer next step.",
  "Frame the service as another NHS route, then describe the private consultation, then what the pharmacist considers, then the range of outcomes, then the individual-assessment limit.",
  "Open with people in this area seeking help for common health concerns, then what Pharmacy First is, then how the consultation works, then outcomes, then the clinical-assessment caveat in a shorter final sentence.",
  "Use mixed sentence lengths: one short definition, one longer process sentence, one medium outcomes sentence, one short caveat, one medium close that does not list conditions.",
  "Explain the service through the patient journey: decide to ask the pharmacy, consultation, review of symptoms and medicines, possible advice or treatment, referral if needed.",
  "Lead with clinical assessment, then eligible common conditions without listing them, then pharmacist judgement, then advice or treatment, then referral as an alternative outcome.",
];

function serviceDefinitionReadingStructure(areaName: string): string {
  const text = String(areaName || "").trim().toLowerCase();
  let hash = 0;
  for (const char of text) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return SERVICE_DEFINITION_READING_STRUCTURES[hash % SERVICE_DEFINITION_READING_STRUCTURES.length] || SERVICE_DEFINITION_READING_STRUCTURES[0];
}

function journeyHeadingStructure(areaName: string): string {
  const area = String(areaName || "the selected area").trim() || "the selected area";
  return `What happens next in ${area}`;
}

export function acceptedUkLocalIntroductionWritingContract(opts: {
  pharmacyName: string;
  serviceName: string;
  areaName?: string;
  country?: string;
  evidenceBlock?: string;
  clinicalMeaningLines?: string[];
  siblingAreaNames?: string[];
}): string {
  const area = String(opts.areaName || "the selected area").trim() || "the selected area";
  const country = String(opts.country || "UK").trim() || "UK";
  const service = String(opts.serviceName || "the pharmacy service").trim() || "the pharmacy service";
  const evidence = String(opts.evidenceBlock || "").trim() || "Verified places:\n- None supplied.";
  const clinical = (opts.clinicalMeaningLines || []).map((line) => String(line || "").trim()).filter(Boolean);
  const clinicalBlock = clinical.length
    ? clinical.join("\n")
    : `- ${service} consultations are available for eligible people from the selected area.`;
  const siblings = (opts.siblingAreaNames || [])
    .map((name) => String(name || "").trim())
    .filter((name) => name && name.toLowerCase() !== area.toLowerCase());
  const structure = serviceDefinitionReadingStructure(area);
  const journeyHeading = journeyHeadingStructure(area);
  return `You are an expert UK healthcare copywriter and local researcher writing content for an independent community pharmacy website.
Create unique page copy for:
LOCATION:
${area}, ${country}
PAGE PURPOSE:
This copy appears on a local ${service} service page. Each selected area must have a hyper-local introduction AND a completely fresh re-phrasing of the core “What ${service} is” section. The “What happens next” journey is a locked three-step clinical pathway. Do not keyword-stuff the area name into step titles or step bodies.

PART 1 — LOCAL INTRODUCTION
Write a full, rich local overview of ${area}. Print the complete neighbourhood account: residential history, named streets, landmarks, housing, and local healthcare environment. Use multiple paragraphs. Do not truncate. Do not stop at a short teaser. There is no upper word cap. If the verified evidence is limited, write only what the facts support. Do not invent facts.
Use only the supplied verified local facts. Do not add a place, statistic, council, population or relationship that is not in those facts.
You do not need to mention every supplied fact.

${evidence}

Where the facts support it, consider ${area}'s location, local health centres, GP practices, NHS services, hospitals and useful geographic or community context.
Use specific local names where they improve the content.
Write naturally for people in ${area}.
The copy should sound like professionally researched website editorial, not an SEO template, not a database of places, and not a directory of names and categories.
Street addresses and postcodes are supporting information. Do not put them in the introduction.
Do not invent a working relationship, partnership, referral arrangement or formal connection between the pharmacy and any GP practice, hospital, NHS organisation or healthcare provider.
Do not claim that the pharmacy works alongside or with another healthcare provider unless that relationship is explicitly present in the verified evidence.
Do not invent patient behaviour, demand, travel or service usage.
Do not say the pharmacy is in ${area} unless the verified premises fact says so.
Do not invent statistics or facts.
Do not invent GP practice names, hospital names or clinician names.
Use each verified place once in the whole introduction. Never repeat a fact to fill both the hero and the local introduction.
Use professional, natural UK English. Keep every sentence under 40 words.
${siblings.length ? `Do not name these other selected campaign areas: ${siblings.join(", ")}.` : "Do not name another selected campaign area."}

PART 2 — WHAT ${service} IS
Write five unique short paragraphs that explain ${service} for people in ${area}.
These paragraphs must stay clinically accurate. Rephrase the approved facts. Do not expand the clinical claim set.
On this pass, completely rewrite the vocabulary, sentence length, and reading structure so this page cannot be mistaken for another selected-area page.
Approved clinical facts only:
${clinicalBlock}

GROUNDING INSTRUCTION FOR THE SERVICE SECTION:
- Vary vocabulary, sentence length, and reading structure on this pass so the page is not a duplicate of any other selected-area page.
- Assigned reading structure: ${structure}
- Do not copy a template cadence, opening clause, or paragraph rhythm from another area.
- Do not invent clinical conditions, age bands, medicines, eligibility rules, GP names, hospitals, partnerships or statistics.
- Do not list a numbered condition set unless those exact conditions appear in the approved facts above.
- Keep meaning aligned with the approved facts. Rephrase; do not add new clinical claims.

PART 3 — WHAT HAPPENS NEXT
The renderer prints a locked three-step journey. Do not invent extra steps. Do not put the area name in any step title or step body. Mention ${area} only in PROCESS_HEADING.
Assigned heading, use exactly: ${journeyHeading}
Use these exact step titles and write clean instructional bodies with no place-name stuffing:
1. Speak with our clinical pharmacy team — consultation prep, what to bring, when symptoms started.
2. Private clinical assessment — symptoms, medical history, and previous checks.
3. Personalised care path & treatments — guidance, NHS treatment where appropriate, or referral.
Do not invent booking systems, wait times, walk-in promises, or extra clinical claims.

Return exactly these labels. Do not return JSON. Do not wrap the answer in curly braces. Do not invent JSON object keys.

HERO INTRODUCTION:
<one opening paragraph about ${area} that names ${service}>

LOCAL INTRODUCTION:
<the full remaining local introduction for ${area}, paragraphs separated by blank lines. Do not truncate.>

SERVICE_PARAGRAPH_1:
<one unique paragraph>

SERVICE_PARAGRAPH_2:
<one unique paragraph>

SERVICE_PARAGRAPH_3:
<one unique paragraph>

SERVICE_PARAGRAPH_4:
<one unique paragraph>

SERVICE_PARAGRAPH_5:
<one unique paragraph>

PROCESS_HEADING:
What happens next in ${area}

PROCESS_STEP_1_TITLE:
Speak with our clinical pharmacy team

PROCESS_STEP_1_BODY:
<clean instructional paragraph. Do not name ${area}.>

PROCESS_STEP_2_TITLE:
Private clinical assessment

PROCESS_STEP_2_BODY:
<clean instructional paragraph. Do not name ${area}.>

PROCESS_STEP_3_TITLE:
Personalised care path & treatments

PROCESS_STEP_3_BODY:
<clean instructional paragraph. Do not name ${area}.>`;
}

export const UK_LOCAL_INTRODUCTION_APPROVED_PROMPT = acceptedUkLocalIntroductionWritingContract({
  pharmacyName: "the confirmed pharmacy",
  serviceName: "Pharmacy First",
});

export type UkLocalIntroductionGeminiRequest = {
  provider: "gemini";
  model: string;
  temperature: number;
  maxOutputTokens: number;
  prompt: string;
};

export type UkLocalIntroductionProseChatRequest = UkLocalIntroductionGeminiRequest;

export type UkLocalIntroductionCorrectionV1 = {
  rejectedCopy: string;
  defects: string[];
};

export type UkLocalIntroductionProseFields = {
  heroIntroduction: string;
  localIntroduction: string;
  serviceDefinitionParagraphs: string[];
  processHeading: string;
  processSteps: Array<{ title: string; body: string }>;
};

/** Stored on attempt logs only. The accepted Gemini call does not request or require this. */
export type GeminiLocalGroundingMetadataV1 = {
  webSearchQueries: string[];
  groundingChunks: Array<{ title: string; uri: string }>;
  groundingSupportCount: number;
};

function verifiedEvidenceBlock(input: BusinessLocalityCopyInputV3, area: string): string {
  const lines: string[] = [];
  if (input.locality.pharmacyIsInArea) {
    lines.push(
      "Verified premises:",
      `- Pharmacy: ${String(input.business.name || "").trim()}`,
      `- Address: ${String(input.business.address || "").trim()}`,
      "- Source: pharmacy profile",
      "The address section already names this pharmacy and address. Do not write the pharmacy name in the introduction.",
      "",
    );
  } else {
    lines.push(`Verified premises: none. Do not say the pharmacy is in ${area}.`, "");
  }
  const facts = (input.editorialFacts || []).filter((fact) => fact.category !== "excluded" && fact.normalizedStatement);
  lines.push(`Verified place count: ${facts.length}. Write less when this count is small.`);
  lines.push("Verified places:");
  if (!facts.length) lines.push("- None supplied.");
  for (const fact of facts) {
    lines.push(`- Category: ${fact.category}`);
    lines.push(`  Supported statement: ${fact.normalizedStatement}`);
    if (fact.sourceUrl) lines.push(`  Source URL: ${fact.sourceUrl}`);
  }
  const excluded = (input.excludedLocalEvidence || []).map((row) => String(row || "").trim()).filter(Boolean);
  lines.push("", "Uncertainties — excluded, do not use:");
  lines.push(excluded.length ? excluded.map((row) => `- ${row}`).join("\n") : "- None supplied.");
  return lines.join("\n");
}

export function buildUkLocalIntroductionProseChatRequest(
  input: BusinessLocalityCopyInputV3,
): UkLocalIntroductionGeminiRequest {
  const area = String(input.locality.areaName || "").trim();
  const pharmacyName = String(input.business.name || "").trim();
  const serviceName = String(input.offer.serviceName || "Pharmacy First").trim() || "Pharmacy First";
  const country = String(input.pageCountry || "").trim() || "UK";
  const prompt = acceptedUkLocalIntroductionWritingContract({
    pharmacyName,
    serviceName,
    areaName: area,
    country,
    evidenceBlock: verifiedEvidenceBlock(input, area),
    clinicalMeaningLines: approvedServiceMeaningLines(input),
    siblingAreaNames: input.locality.neighbouringSelectedAreas,
  });
  return {
    provider: "gemini",
    model: UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
    temperature: 0.4,
    maxOutputTokens: 8192,
    prompt,
  };
}

export function buildUkLocalIntroductionCorrectionChatRequest(
  input: BusinessLocalityCopyInputV3,
  correction: UkLocalIntroductionCorrectionV1,
): UkLocalIntroductionGeminiRequest {
  const base = buildUkLocalIntroductionProseChatRequest(input);
  const area = String(input.locality.areaName || "").trim();
  const siblings = (input.locality.neighbouringSelectedAreas || [])
    .map((name) => String(name || "").trim())
    .filter((name) => name && name.toLowerCase() !== area.toLowerCase());
  const defects = [...new Set((correction.defects || []).map((row) => String(row || "").trim()).filter(Boolean))];
  const rejected = String(correction.rejectedCopy || "").trim();
  const prompt = [
    base.prompt,
    "",
    "CORRECTION — rewrite this rejected copy once for the selected area only.",
    `Selected area: ${area}`,
    siblings.length
      ? `Do not name these other selected campaign areas: ${siblings.join(", ")}.`
      : "Do not name another selected campaign area.",
    "Exact validator defects:",
    ...defects.map((defect) => `- ${defect}`),
    "",
    "Rejected copy:",
    rejected,
    "",
    "Return the same HERO INTRODUCTION / LOCAL INTRODUCTION / SERVICE_PARAGRAPH_1 to SERVICE_PARAGRAPH_5 / PROCESS_HEADING / PROCESS_STEP labels.",
    "Do not return JSON and do not invent JSON object keys.",
    "Write the full local introduction. Do not truncate it.",
    "Write natural local editorial. Do not turn the introduction into a list of place names and categories.",
    "Rephrase the approved clinical facts in SERVICE_PARAGRAPH_1 to SERVICE_PARAGRAPH_5 with a distinct vocabulary and sentence rhythm. Do not invent clinical claims.",
    "Rewrite PROCESS_HEADING as exactly “What happens next in {area}”. Use the three locked step titles. Do not put the area name in step titles or bodies.",
    "Do not repeat a fact, do not write street addresses or postcodes, and do not invent behaviour or a healthcare partnership.",
  ].join("\n");
  return {
    ...base,
    prompt,
  };
}

function extractGeminiText(payload: unknown): string {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const first = candidates[0] && typeof candidates[0] === "object" ? (candidates[0] as Record<string, unknown>) : {};
  const content = first.content && typeof first.content === "object" ? (first.content as Record<string, unknown>) : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  return parts
    .filter((part) => part && typeof part === "object" && (part as Record<string, unknown>).thought !== true)
    .map((part) => (part && typeof part === "object" ? String((part as Record<string, unknown>).text || "") : ""))
    .join("\n")
    .trim();
}

function geminiUsage(payload: unknown): { promptTokens: number; completionTokens: number } {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const usage = root.usageMetadata && typeof root.usageMetadata === "object"
    ? (root.usageMetadata as Record<string, unknown>)
    : {};
  return {
    promptTokens: Number(usage.promptTokenCount || 0) || 0,
    completionTokens: Number(usage.candidatesTokenCount || 0) || 0,
  };
}

function normalizeParagraphs(text: string): string {
  return keepGeminiLocalIntroductionParagraphs(text);
}

function labeledSection(raw: string, label: string, nextLabel?: string): string {
  const start = new RegExp(`^${label}\\s*:\\s*`, "im");
  const match = start.exec(raw);
  if (!match || match.index == null) return "";
  let rest = raw.slice(match.index + match[0].length);
  if (nextLabel) {
    const end = new RegExp(`^${nextLabel}\\s*:\\s*`, "im");
    const next = end.exec(rest);
    if (next && next.index != null) rest = rest.slice(0, next.index);
  }
  rest = rest.split(/\n(?:#{1,3} |Research Sources|Facts Excluded|\*\*\*)/)[0] || rest;
  return normalizeParagraphs(rest);
}

function stringCopyField(value: unknown): string {
  if (typeof value === "string") return normalizeParagraphs(value);
  if (Array.isArray(value)) {
    return normalizeParagraphs(
      value
        .map((row) => (typeof row === "string" ? row : ""))
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  return "";
}

function paragraphsFromUnknown(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    return normalizeParagraphs(value)
      .split(/\n\n+/)
      .map((row) => row.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  if (Array.isArray(value)) {
    return value.flatMap((row) => paragraphsFromUnknown(row)).filter(Boolean).slice(0, 5);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .flatMap((row) => paragraphsFromUnknown(row))
      .filter(Boolean)
      .slice(0, 5);
  }
  return [];
}

function parseNumberedServiceParagraphs(raw: string, parsedJson?: Record<string, unknown>): string[] {
  const paras: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const fromJson =
      parsedJson?.[`SERVICE_PARAGRAPH_${i}`] ??
      parsedJson?.[`serviceParagraph${i}`] ??
      parsedJson?.[`service_paragraph_${i}`];
    if (typeof fromJson === "string" && fromJson.trim()) {
      paras.push(normalizeParagraphs(fromJson));
      continue;
    }
    const next = i < 5 ? `SERVICE_PARAGRAPH_${i + 1}` : "PROCESS_HEADING";
    const block = labeledSection(raw, `SERVICE_PARAGRAPH_${i}`, next);
    if (block) paras.push(block);
  }
  return paras.filter(Boolean).slice(0, 5);
}

function parseServiceDefinitionParagraphs(raw: string, parsedJson?: Record<string, unknown>): string[] {
  const numbered = parseNumberedServiceParagraphs(raw, parsedJson);
  if (numbered.length) return numbered;
  const nestedKeys = [
    "serviceDefinitionParagraphs",
    "What Pharmacy First is",
    "WHAT THE SERVICE IS",
    "WHAT PHARMACY FIRST IS",
    "SERVICE DEFINITION",
    "whatPharmacyFirstIs",
  ];
  for (const key of nestedKeys) {
    const extra = paragraphsFromUnknown(parsedJson?.[key]);
    if (extra.length) return extra;
  }
  const block =
    labeledSection(raw, "WHAT THE SERVICE IS") ||
    labeledSection(raw, "SERVICE DEFINITION") ||
    labeledSection(raw, "WHAT PHARMACY FIRST IS");
  if (!block) return [];
  return block
    .split(/\n\n+/)
    .map((row) => normalizeParagraphs(row))
    .filter(Boolean)
    .slice(0, 5);
}

function emptyProcessJourney(): { processHeading: string; processSteps: Array<{ title: string; body: string }> } {
  return { processHeading: "", processSteps: [] };
}

function parseProcessJourney(raw: string, parsedJson?: Record<string, unknown>): {
  processHeading: string;
  processSteps: Array<{ title: string; body: string }>;
} {
  const heading =
    stringCopyField(parsedJson?.processHeading || parsedJson?.PROCESS_HEADING) ||
    labeledSection(raw, "PROCESS_HEADING", "PROCESS_STEP_1_TITLE");
  const steps: Array<{ title: string; body: string }> = [];
  for (let i = 1; i <= 3; i += 1) {
    const titleKey = `PROCESS_STEP_${i}_TITLE`;
    const bodyKey = `PROCESS_STEP_${i}_BODY`;
    const nextTitle = i < 3 ? `PROCESS_STEP_${i + 1}_TITLE` : undefined;
    const title =
      stringCopyField(parsedJson?.[titleKey] || parsedJson?.[titleKey.toLowerCase()]) ||
      labeledSection(raw, titleKey, bodyKey);
    const body =
      stringCopyField(parsedJson?.[bodyKey] || parsedJson?.[bodyKey.toLowerCase()]) ||
      labeledSection(raw, bodyKey, nextTitle);
    if (title || body) steps.push({ title, body });
  }
  if (heading || steps.length) return { processHeading: heading, processSteps: steps };
  return emptyProcessJourney();
}

export function parseUkLocalIntroductionProse(raw: string): string {
  return parseUkLocalIntroductionProseFields(raw).localIntroduction;
}

export function parseUkLocalIntroductionProseFields(raw: string): UkLocalIntroductionProseFields {
  const empty = {
    heroIntroduction: "",
    localIntroduction: "",
    serviceDefinitionParagraphs: [] as string[],
    processHeading: "",
    processSteps: [] as Array<{ title: string; body: string }>,
  };
  let text = String(raw || "").trim();
  if (!text) return empty;
  text = text.replace(/^```(?:json|text|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const hero = stringCopyField(parsed.heroIntroduction || parsed["HERO INTRODUCTION"]);
      const local = stringCopyField(parsed.localIntroduction || parsed.introduction || parsed["LOCAL INTRODUCTION"]);
      const serviceDefinitionParagraphs = parseServiceDefinitionParagraphs(text, parsed);
      const journey = parseProcessJourney(text, parsed);
      if (hero || local || serviceDefinitionParagraphs.length || journey.processHeading || journey.processSteps.length) {
        return { heroIntroduction: hero, localIntroduction: local, serviceDefinitionParagraphs, ...journey };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Validation warning: Gemini JSON keys could not be parsed (${detail}). Falling back to labeled paragraphs.`);
    }
  }
  const serviceLabel = /^SERVICE_PARAGRAPH_1\s*:/im.test(text)
    ? "SERVICE_PARAGRAPH_1"
    : /^WHAT THE SERVICE IS\s*:/im.test(text)
      ? "WHAT THE SERVICE IS"
      : /^SERVICE DEFINITION\s*:/im.test(text)
        ? "SERVICE DEFINITION"
        : /^WHAT PHARMACY FIRST IS\s*:/im.test(text)
          ? "WHAT PHARMACY FIRST IS"
          : "";
  const hero = labeledSection(text, "HERO INTRODUCTION", "LOCAL INTRODUCTION");
  const local = labeledSection(text, "LOCAL INTRODUCTION", serviceLabel || "PROCESS_HEADING");
  const serviceDefinitionParagraphs = parseServiceDefinitionParagraphs(text);
  const journey = parseProcessJourney(text);
  if (hero || local || serviceDefinitionParagraphs.length || journey.processHeading || journey.processSteps.length) {
    return {
      heroIntroduction: hero,
      localIntroduction: local,
      serviceDefinitionParagraphs,
      ...journey,
    };
  }
  return {
    ...empty,
    localIntroduction: normalizeParagraphs(text.replace(/^["“]+|["”]+$/g, "")),
  };
}

export function copyFromLocalIntroductionProse(
  areaName: string,
  introduction: string,
  heroIntroduction = "",
  serviceDefinitionParagraphs: string[] = [],
  processHeading = "",
  processSteps: Array<{ title: string; body: string }> = [],
): AiLocalCopyV3 | null {
  try {
    const parsed = parseAiLocalCopyV3({
      heroIntroduction,
      localIntroduction: introduction,
    });
    if (!parsed.ok) {
      console.warn(
        `⚠️ Validation warning for [${areaName}]: copy parser rejected labeled fields (${parsed.failures.join("; ")}).`,
      );
      return null;
    }
    const uniqueService = serviceDefinitionParagraphs.map((row) => String(row || "").trim()).filter(Boolean).slice(0, 5);
    const uniqueSteps = processSteps
      .map((step) => ({
        title: String(step.title || "").trim(),
        body: String(step.body || "").trim(),
      }))
      .filter((step) => step.title || step.body);
    return {
      ...parsed.copy,
      area: areaName,
      heroIntroduction,
      localIntroduction: introduction,
      localContextParagraphs: [],
      ...(uniqueService.length ? { serviceDefinitionParagraphs: uniqueService } : {}),
      ...(String(processHeading || "").trim() ? { processHeading: String(processHeading).trim() } : {}),
      ...(uniqueSteps.length ? { processSteps: uniqueSteps } : {}),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Validation warning for [${areaName}]: JSON parser keys skipped (${detail}).`);
    return null;
  }
}

function hydrateGeminiEnvIfNeeded(): void {
  if (String(process.env.GEMINI_API_KEY || "").trim()) return;
  const apply = (raw: string) => {
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colon = trimmed.indexOf(":");
      const eq = trimmed.indexOf("=");
      let key = "";
      let value = "";
      if (eq > 0 && (colon < 0 || eq < colon)) {
        key = trimmed.slice(0, eq).trim();
        value = trimmed.slice(eq + 1).trim();
      } else if (colon > 0) {
        key = trimmed.slice(0, colon).trim();
        value = trimmed.slice(colon + 1).trim();
      }
      key = key.replace(/^\d+\s+/, "");
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key === "GEMINI_API_KEY" && value && !process.env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = value;
      }
    }
  };
  const envFile = path.join(process.cwd(), ".env");
  if (fs.existsSync(envFile)) apply(fs.readFileSync(envFile, "utf8"));
  if (String(process.env.GEMINI_API_KEY || "").trim()) return;
  try {
    apply(execSync("pm2 env 1", { encoding: "utf8" }));
  } catch {
    /* ignore */
  }
}

export async function requestUkLocalIntroductionProseV1(
  input: BusinessLocalityCopyInputV3,
  correction?: UkLocalIntroductionCorrectionV1,
): Promise<{
  raw: string;
  introduction: string;
  heroIntroduction: string;
  request: UkLocalIntroductionGeminiRequest;
  model: string;
  promptTokens: number;
  completionTokens: number;
  uncertain: boolean;
  serviceDefinitionParagraphs: string[];
  processHeading: string;
  processSteps: Array<{ title: string; body: string }>;
}> {
  const request = correction
    ? buildUkLocalIntroductionCorrectionChatRequest(input, correction)
    : buildUkLocalIntroductionProseChatRequest(input);
  hydrateGeminiEnvIfNeeded();
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const response = await fetch(UK_LOCAL_INTRODUCTION_GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: request.prompt }] }],
      tools: [UK_LOCAL_INTRODUCTION_GEMINI_GOOGLE_SEARCH_TOOL],
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
      },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object"
        ? String((payload as { error?: { message?: string } }).error?.message || response.status)
        : String(response.status);
    throw new Error(`Gemini introduction request failed: ${detail}`);
  }
  const raw = extractGeminiText(payload);
  const usage = geminiUsage(payload);
  const fields = parseUkLocalIntroductionProseFields(raw);
  const heroIntroduction = fields.heroIntroduction;
  const introduction = fields.localIntroduction;
  const serviceDefinitionParagraphs = fields.serviceDefinitionParagraphs;
  const processHeading = fields.processHeading;
  const processSteps = fields.processSteps;
  const heroWords = countUkLocalIntroductionWords(heroIntroduction);
  const localWords = countUkLocalIntroductionWords(introduction);
  return {
    raw,
    introduction,
    heroIntroduction,
    serviceDefinitionParagraphs,
    processHeading,
    processSteps,
    request,
    model: UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    uncertain:
      !heroIntroduction ||
      !introduction ||
      heroWords < 20 ||
      localWords < 12 ||
      serviceDefinitionParagraphs.length < 3,
  };
}
