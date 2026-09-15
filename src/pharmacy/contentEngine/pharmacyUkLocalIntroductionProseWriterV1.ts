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

export function acceptedUkLocalIntroductionWritingContract(opts: {
  pharmacyName: string;
  serviceName: string;
}): string {
  const pharmacy = String(opts.pharmacyName || "the confirmed pharmacy").trim() || "the confirmed pharmacy";
  const service = String(opts.serviceName || "Pharmacy First").trim() || "Pharmacy First";
  return `Write as an experienced British healthcare copywriter.

Using only the verified information supplied for this selected area, return two clearly separated plain-text fields and nothing else.

HERO INTRODUCTION:
Write 35–55 words introducing ${service} for people in the selected area and naming ${pharmacy} as the provider.

LOCAL INTRODUCTION:
Write 170–230 words in three fluent British-English paragraphs.

Paragraph 1:
Introduce the area, its location and its character using verified facts.

Paragraph 2:
Describe meaningful verified landmarks, green spaces, shopping, community facilities and healthcare references. Select the most useful facts and connect them naturally. Do not list every evidence record.

Paragraph 3:
Move naturally from the area and its local healthcare needs into ${pharmacy}’s ${service} service. Name ${pharmacy} and ${service}, and explain that eligible patients can receive a pharmacist consultation for certain common conditions. Do not reproduce a fixed clinical closing sentence. The transition must feel like part of the article—not a disclaimer pasted onto the end.

You may express only this ${service} meaning:
- ${pharmacy} provides ${service} consultations for eligible people from the selected area.
- ${service} covers certain common health conditions.
- The pharmacist assesses symptoms, relevant medicines and medical history.
- The outcome may include advice, suitable treatment or referral to another healthcare professional.
- Eligibility and treatment depend on the individual clinical assessment.

Do not claim guaranteed treatment, guaranteed medicine supply, walk-in availability, faster care, convenience, immediate or prompt treatment, that a GP appointment is never required, travel time, route distance or easy access, or any unverified pharmacy service or outcome.

Do not write travel time, route distance, kilometres, or that the pharmacy is easy to reach. Do not locate the pharmacy in the premises locality in these fields; that belongs later on the page. Do not invent facts or reuse wording or facts from another area.

Use neutral factual British English. Do not describe an area as pleasant, welcoming, vibrant, thriving, attractive, popular, desirable, close-knit, well-connected, convenient or ‘known for’ something unless that exact character claim is supported by the supplied evidence. Describe verified places, facilities and organisations naturally without inventing an opinion about the area.

Do not use: “orient yourself”; “orientating pharmacy care”; “local orientation”; “familiar points around”; “listed as”; “recorded as”; “named on the provider page”; “recorded healthcare setting”; raw provider labels; or evidence-source language.

Do not repeatedly use the area name. Use natural alternatives such as “the area”, “the neighbourhood”, “local residents” and “the community” where appropriate.

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
  const prompt = [
    acceptedUkLocalIntroductionWritingContract({ pharmacyName, serviceName }),
    "",
    `Selected area: ${area}`,
    `Confirmed pharmacy name: ${pharmacyName}`,
    premisesLocality ? `Confirmed pharmacy premises locality: ${premisesLocality}` : "",
    distanceLabel ? `Saved straight-line distance: ${distanceLabel}` : "",
    "",
    ...bulletBlock("Verified area identity and geographical context:", identity),
    ...bulletBlock("Verified history where available:", history),
    ...bulletBlock("Verified landmarks, parks, shopping, civic and community facilities:", community),
    ...bulletBlock("Verified GP practices or healthcare facilities:", healthcare),
    `Approved ${serviceName} service meaning:`,
    `- ${pharmacyName} provides ${serviceName} consultations for eligible people from the selected area.`,
    `- ${serviceName} covers certain common health conditions.`,
    "- The pharmacist assesses symptoms, relevant medicines and medical history.",
    "- The outcome may include advice, suitable treatment or referral to another healthcare professional.",
    "- Eligibility and treatment depend on the individual clinical assessment.",
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
    "Return the same HERO INTRODUCTION / LOCAL INTRODUCTION layout. Keep verified facts. Discuss the selected area only.",
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
