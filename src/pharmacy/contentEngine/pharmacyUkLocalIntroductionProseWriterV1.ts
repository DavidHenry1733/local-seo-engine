/**
 * Dedicated Gemini prose writer for the local hero and introduction.
 * Restored accepted Brook Gemini local-copy call. Returns plain text.
 * Does not request page JSON, clinical copy, Google Search tools, or grounding metadata.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { parseAiLocalCopyV3, type AiLocalCopyV3 } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  keepGeminiLocalIntroductionParagraphs,
  premisesLocalityFromCanonicalAddress,
  writerFacingEditorialStatement,
  type BusinessLocalityCopyInputV3,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { formatStraightLineKm } from "./pharmacyContentGenerationFieldPolicyV1.ts";
import { countUkLocalIntroductionWords } from "./pharmacyUkLocalIntroductionStyleContractV1.ts";

export const UK_LOCAL_INTRODUCTION_PROSE_WRITER_ID = "pharmacy-uk-local-introduction-prose-writer-v1";
export const UK_LOCAL_INTRODUCTION_WRITER_PROVIDER = "gemini" as const;
export const UK_LOCAL_INTRODUCTION_OPENAI_WRITER_ACTIVE = false;
export const UK_LOCAL_INTRODUCTION_GEMINI_MODEL = "gemini-3.6-flash";
export const UK_LOCAL_INTRODUCTION_GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${UK_LOCAL_INTRODUCTION_GEMINI_MODEL}:generateContent`;

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
    .map((line) => String(line || "").replace(/\s+/g, " ").trim())
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
  allowedServiceMeaning?: string[];
}): string {
  const pharmacy = String(opts.pharmacyName || "the confirmed pharmacy").trim() || "the confirmed pharmacy";
  const service = String(opts.serviceName || "Pharmacy First").trim() || "Pharmacy First";
  const meaning = opts.allowedServiceMeaning?.length
    ? opts.allowedServiceMeaning.join("\n")
    : pharmacyFirstMeaningLines(pharmacy, service).join("\n");
  const paragraph3 = opts.allowedServiceMeaning?.length
    ? `If a third paragraph is useful, add one next-step point from the approved ${service} meaning. Do not repeat paragraph 2, and do not add conditions, treatments, eligibility or outcomes that are not in that approved service meaning.`
    : `Continue the service explanation for eligible common conditions: pharmacist consultation, advice, suitable treatment or referral where appropriate. Keep the selected area present without keyword-stuffing. The transition must feel like healthcare/service copy — not a disclaimer pasted onto a place article.`;
  return `Write as an experienced British healthcare copywriter for a paying pharmacy client.

Using only the verified information supplied, return two clearly separated plain-text fields and nothing else.

This is a local introduction to the service. It must tell a patient what ${service} is, who it is for, why they might consider it, that ${pharmacy} provides it, and that it is for people in the selected area. Then explain the service in useful plain English.

Local places are optional supporting context. You are never required to mention a GP surgery, clinic, hospital, library, park, school, landmark, community centre, transport stop, or any other place. Zero place mentions is valid and is often the better page. Not mentioning a supplied place is not a failure.

Mention a supplied place only when it materially helps the patient understand one of these:
- how they reach this pharmacy or this service
- a healthcare context that is genuinely about this service, without inventing a referral, partnership, or shared care
- a geographic relationship that is directly useful
Otherwise omit it. Do not mention a place because it was supplied. Do not use different places to make locality pages look different. Locality comes from the area name and from the service being for people there.

HERO INTRODUCTION:
Write 35–55 words introducing ${service} for people in the selected area and naming ${pharmacy} as the provider. Establish immediately what the service is useful for. Do not open with a place, landmark, library, park, or GP practice.

LOCAL INTRODUCTION:
Write 100–180 words in two or three fluent British-English paragraphs. Stop when the service is clear. Do not pad the word count.

Paragraph 1:
Open with ${service} and ${pharmacy} for people in the selected area, and what the service is useful for. Do not open with a place list, a landmark, a library, a park, or a GP practice.

Paragraph 2:
Explain the service in plain English: what happens, what the patient learns, and the limit of the service, using only the approved service meaning. One sentence that a pharmacy check does not diagnose, and one sentence that emergency symptoms need urgent care, is enough. Do not paste every safety sentence.

Paragraph 3, only if it adds something useful:
${paragraph3} Do not add a paragraph that only repeats the warning.

You may express only this ${service} meaning:
${meaning}

Do not invent patient behaviour, demand, or demographics. Do not write “many local residents”, “people often come in”, “whether you are visiting”, “whether you are running errands”, “spending time around”, “taking time out near”, “fits around everyday commitments”, “it is important to note”, “please note”, “a straightforward way”, or “an accessible screening”.

Do not invent a relationship with a GP practice, clinic, library, park, or landmark. Do not write that the pharmacy works alongside another provider, or that patients manage their health alongside a named place.

Do not claim this service reduces the risk of stroke, heart disease, kidney disease, or any other condition unless that exact claim is in the approved service meaning above. A statement that a condition can increase risk is not a statement that this service reduces that risk.

Do not claim guaranteed treatment, guaranteed medicine supply, walk-in availability, faster care, convenience, immediate or prompt treatment, that a GP appointment is never required, travel time, route distance or easy access, or any unverified pharmacy service or outcome.

Do not write travel time, route distance, kilometres, or that the pharmacy is easy to reach. Do not locate the pharmacy in the premises locality in these fields; that belongs later on the page. Do not invent facts or reuse wording or facts from another area.

Use neutral factual British English. Do not describe an area as pleasant, welcoming, vibrant, thriving, attractive, popular, desirable, close-knit, well-connected, convenient, established neighbourhood, or ‘known for’ something unless that exact character claim is supported by the supplied evidence.

Do not use: “orient yourself”; “orientating pharmacy care”; “local orientation”; “familiar points around”; “patients near local landmarks”; “listed as”; “recorded as”; “named on the provider page”; “recorded healthcare setting”; “evidence pack”; “source record”; raw provider labels; or evidence-source language.

Use the selected area name and the pharmacy name naturally. Do not repeat either in every sentence. Do not substitute “local residents” for the area name in order to invent what those residents do.

Return exactly this layout:
HERO INTRODUCTION:
<one paragraph>

LOCAL INTRODUCTION:
<paragraph 1>

<paragraph 2>

<paragraph 3>`;
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

function factsForCategory(
  input: BusinessLocalityCopyInputV3,
  categories: string[],
): string[] {
  const allowed = new Set(categories);
  return (input.editorialFacts || [])
    .filter((fact) => allowed.has(fact.category))
    .map((fact) => writerFacingEditorialStatement(fact.normalizedStatement))
    .filter((statement) => statement.length >= 12);
}

function bulletBlock(title: string, lines: string[]): string[] {
  if (!lines.length) return [];
  return [title, ...lines.map((line) => `- ${line}`), ""];
}

export function buildUkLocalIntroductionProseChatRequest(
  input: BusinessLocalityCopyInputV3,
): UkLocalIntroductionGeminiRequest {
  const area = String(input.locality.areaName || "").trim();
  const pharmacyName = String(input.business.name || "").trim();
  const serviceName = String(input.offer.serviceName || "Pharmacy First").trim() || "Pharmacy First";
  const premisesLocality = premisesLocalityFromCanonicalAddress(input.business.address);
  const distanceKm = input.locality.distanceKm;
  const distanceLabel =
    distanceKm != null && Number.isFinite(distanceKm)
      ? `approximately ${formatStraightLineKm(distanceKm)} km in a straight line`
      : "";
  const identity = factsForCategory(input, ["area-identity"]);
  const history = factsForCategory(input, ["heritage"]);
  const community = factsForCategory(input, ["community"]);
  const healthcare = factsForCategory(input, ["healthcare"]);
  const meaningLines = approvedServiceMeaningLines(input);
  const prompt = [
    acceptedUkLocalIntroductionWritingContract({
      pharmacyName,
      serviceName,
      allowedServiceMeaning: input.offer.serviceId === "pharmacy-first" ? undefined : meaningLines,
    }),
    "",
    `Selected area: ${area}`,
    `Confirmed pharmacy name: ${pharmacyName}`,
    premisesLocality ? `Confirmed pharmacy premises locality: ${premisesLocality}` : "",
    distanceLabel ? `Saved straight-line distance: ${distanceLabel}` : "",
    "",
    ...bulletBlock(
      "Optional local context. Omit every item unless it materially helps access, a genuine service-related healthcare context, or a directly useful geographic relationship. Naming none of these is correct. Do not recite them to prove the page is local:",
      [...healthcare, ...identity, ...community, ...history],
    ),
    `Approved ${serviceName} service meaning:`,
    ...meaningLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
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
    "Return the same HERO INTRODUCTION / LOCAL INTRODUCTION layout. Keep the approved service meaning. Do not add a place, landmark, or organisation to repair the copy. Discuss the selected area only.",
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
    uncertain: !heroIntroduction || !introduction || heroWords < 20 || localWords < 80,
  };
}
