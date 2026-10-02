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

export function acceptedUkLocalIntroductionWritingContract(opts: {
  pharmacyName: string;
  serviceName: string;
  areaName?: string;
  country?: string;
  evidenceBlock?: string;
}): string {
  const area = String(opts.areaName || "the selected area").trim() || "the selected area";
  const country = String(opts.country || "UK").trim() || "UK";
  const service = String(opts.serviceName || "the pharmacy service").trim() || "the pharmacy service";
  const evidence = String(opts.evidenceBlock || "").trim() || "Verified places:\n- None supplied.";
  return `You are an expert UK healthcare copywriter and local researcher writing content for an independent community pharmacy website.
Create an engaging local introduction for:
LOCATION:
${area}, ${country}
PAGE PURPOSE:
This introduction will appear on a local ${service} service page for an independent community pharmacy.
IMPORTANT:
The ${service} service content has already been written separately.
Do NOT write the ${service} service content.
Do not explain or rewrite the service.
Your job is to write the LOCAL component of the page.
Write approximately 200–250 words introducing ${area} and its local healthcare environment. If the verified evidence is limited, write less. Do not invent facts to reach a word count.
Use only the supplied verified local facts. You have not been given web search. Do not add a place, statistic, council, population or relationship that is not in those facts.
You do not need to mention every supplied fact.

${evidence}

Where the facts support it, consider ${area}'s location, local health centres, GP practices, NHS services, hospitals and useful geographic or community context.
Use specific local names where they improve the content.
Write naturally for people in ${area}.
The copy should sound like professionally researched website editorial, not an SEO template, not a database of places, and not a directory of names and categories.
Select the information that produces the strongest introduction.
Street addresses and postcodes are supporting information. Do not put them in the introduction.
Do not invent a working relationship, partnership, referral arrangement or formal connection between the pharmacy and any GP practice, hospital, NHS organisation or healthcare provider.
Do not claim that the pharmacy works alongside or with another healthcare provider unless that relationship is explicitly present in the verified evidence.
Do not invent patient behaviour, demand, travel or service usage.
Do not say the pharmacy is in ${area} unless the verified premises fact says so.
Do not invent statistics or facts.
Use each verified place once in the whole introduction. Never repeat a fact to fill both the hero and the local introduction.
Use professional, natural UK English. Keep every sentence under 40 words.
Again:
DO NOT explain ${service}.
The approved ${service} content will follow this local introduction.
Return exactly:
HERO INTRODUCTION:
<opening paragraph about ${area}>

LOCAL INTRODUCTION:
<the rest of the local introduction>`;
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
    "Return the same HERO INTRODUCTION / LOCAL INTRODUCTION layout.",
    "Write natural local editorial. Do not turn the introduction into a list of place names and categories.",
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

export function parseUkLocalIntroductionProse(raw: string): string {
  return parseUkLocalIntroductionProseFields(raw).localIntroduction;
}

export function parseUkLocalIntroductionProseFields(raw: string): UkLocalIntroductionProseFields {
  let text = String(raw || "").trim();
  if (!text) return { heroIntroduction: "", localIntroduction: "" };
  text = text.replace(/^```(?:json|text|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as {
        heroIntroduction?: unknown;
        localIntroduction?: unknown;
        introduction?: unknown;
      };
      const hero = normalizeParagraphs(String(parsed.heroIntroduction || ""));
      const local = normalizeParagraphs(String(parsed.localIntroduction || parsed.introduction || ""));
      if (hero || local) return { heroIntroduction: hero, localIntroduction: local };
    } catch {
      /* keep plain text */
    }
  }
  const hero = labeledSection(text, "HERO INTRODUCTION", "LOCAL INTRODUCTION");
  const local = labeledSection(text, "LOCAL INTRODUCTION");
  if (hero || local) {
    return { heroIntroduction: hero, localIntroduction: local };
  }
  return { heroIntroduction: "", localIntroduction: normalizeParagraphs(text.replace(/^["“]+|["”]+$/g, "")) };
}

export function copyFromLocalIntroductionProse(
  areaName: string,
  introduction: string,
  heroIntroduction = "",
): AiLocalCopyV3 | null {
  const parsed = parseAiLocalCopyV3({
    heroIntroduction,
    localIntroduction: introduction,
  });
  if (!parsed.ok) return null;
  return {
    ...parsed.copy,
    area: areaName,
    heroIntroduction,
    localIntroduction: introduction,
    localContextParagraphs: [],
  };
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
  const heroWords = countUkLocalIntroductionWords(heroIntroduction);
  const localWords = countUkLocalIntroductionWords(introduction);
  return {
    raw,
    introduction,
    heroIntroduction,
    request,
    model: UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    uncertain: !heroIntroduction || !introduction || heroWords < 20 || localWords < 12,
  };
}
