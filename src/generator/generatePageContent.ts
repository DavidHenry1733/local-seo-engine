/**
 * generatePageContent.ts
 *
 * Two generation systems in one file:
 *
 * 1. LEGACY — generatePageContent(PageInputs) → GeneratedPageContent
 *    Used by deployTemplatePage.ts and refineContent.ts for the original
 *    InboxingProWeb hub-page format.
 *
 * 2. KEYWORD-FIRST — generateKeywordPageContent(PageContentInputs) → KeywordPageContent
 *    New system: takes any primary keyword ("Emergency Plumber Sheffield"),
 *    extracts service + location + intent, and generates all page sections
 *    driven by that keyword. Used by the /api/generate routes.
 *
 * Requires env vars:
 *   AI_INTEGRATIONS_OPENAI_BASE_URL
 *   AI_INTEGRATIONS_OPENAI_API_KEY
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageInputs {
  brandName:          string;
  legalName:          string;
  serviceName:        string;
  location:           string;
  primaryKeyword:     string;
  supportingKeywords: string[];
  ctaText:            string;
  ctaUrl:             string;
  hubUrl:             string;
  hubAnchor:          string;
  clusterPages:       { href: string; label: string }[];
  businessAddress:    string;
}

export interface ProcessStep {
  title:       string;
  description: string;
}

export interface InternalLink {
  href:        string;
  text:        string;
  description?: string;
}

export interface FaqItem {
  question: string;
  answer:   string;
}

export interface GeneratedPageContent {
  aiSummaryIntro:    string;
  aiSummaryBullets:  string[];
  split1:            { heading: string; body: string };
  split2:            { heading: string; body: string };
  definition:        { heading: string; body: string };
  process:           { heading: string; steps: ProcessStep[] };
  image3:            { heading: string; body: string };
  localRelevance:    { heading: string; body: string };
  internalLinks:     InternalLink[];
  faq:               FaqItem[];
  cta:               { heading: string; body: string };
  trustStrip:        string;
}

// ── OpenAI client ─────────────────────────────────────────────────────────────

function getClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "Missing AI integration env vars. Run setupReplitAIIntegrations first."
    );
  }
  return new OpenAI({ baseURL, apiKey });
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(inputs: PageInputs): string {
  const promptPath = path.join(process.cwd(), "prompts", "master-page-prompt.txt");
  let prompt = fs.readFileSync(promptPath, "utf8");

  const clusterPagesStr = inputs.clusterPages
    .map((p) => `${p.href} — ${p.label}`)
    .join(", ");

  const substitutions: Record<string, string> = {
    "{{BRAND_NAME}}":          inputs.brandName,
    "{{LEGAL_NAME}}":          inputs.legalName,
    "{{SERVICE_NAME}}":        inputs.serviceName,
    "{{LOCATION}}":            inputs.location,
    "{{PRIMARY_KEYWORD}}":     inputs.primaryKeyword,
    "{{SUPPORTING_KEYWORDS}}": inputs.supportingKeywords.join(", "),
    "{{CTA_TEXT}}":            inputs.ctaText,
    "{{CTA_URL}}":             inputs.ctaUrl,
    "{{HUB_URL}}":             inputs.hubUrl,
    "{{HUB_ANCHOR}}":          inputs.hubAnchor,
    "{{CLUSTER_PAGES}}":       clusterPagesStr,
    "{{BUSINESS_ADDRESS}}":    inputs.businessAddress,
  };

  for (const [token, value] of Object.entries(substitutions)) {
    prompt = prompt.split(token).join(value);
  }

  return prompt;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generatePageContent(
  inputs: PageInputs
): Promise<GeneratedPageContent> {
  const client = getClient();
  const prompt = buildPrompt(inputs);

  console.log(`  Generating AI content for: ${inputs.primaryKeyword}…`);

  const response = await client.chat.completions.create({
    model:                "gpt-5.1",
    max_completion_tokens: 4096,
    messages: [
      {
        role:    "system",
        content: "You are a professional local SEO copywriter. Return only valid JSON. No markdown, no code fences, no explanation.",
      },
      {
        role:    "user",
        content: prompt,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let parsed: GeneratedPageContent;
  try {
    parsed = JSON.parse(raw) as GeneratedPageContent;
  } catch {
    console.error("AI response was not valid JSON:");
    console.error(raw.slice(0, 400));
    throw new Error("AI content generation failed — invalid JSON response.");
  }

  console.log("  AI content generated successfully.");
  return parsed;
}

// ══════════════════════════════════════════════════════════════════════════════
// KEYWORD-FIRST GENERATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// ── Keyword-first types ────────────────────────────────────────────────────────

export interface KeywordPageInputs {
  keyword:       string;
  templateId?:   string;
  nearbyAreas?:  string[];
  businessProfile?: {
    name:     string;
    phone:    string;
    email?:   string;
    address?: string;
  };
}

export interface KeywordPageContent {
  keyword:  string;
  service:  string;
  location: string;
  intent:   string;
  meta: {
    title:       string;
    description: string;
    h1:          string;
  };
  hero: {
    headline:     string;
    intro:        string;
    trustBullets: string[];
  };
  emergencyReassurance: {
    heading: string;
    body:    string;
  };
  whatWeHelp: {
    heading: string;
    body:    string;
  };
  localCoverage: {
    heading: string;
    body:    string;
  };
  beforeArrival: {
    heading: string;
    intro:   string;
    steps:   string[];
  };
  pricing: {
    heading: string;
    body:    string;
  };
  whyChooseUs: {
    heading: string;
    points:  string[];
  };
  process: {
    heading: string;
    steps:   { step: number; title: string; description: string }[];
  };
  faq:  { question: string; answer: string }[];
  cta:  { heading: string; body: string };
  // Optional enrichment fields — supplied by some AI prompts but not required
  aiAnswerBlock?: {
    question?:    string;
    quickAnswer?: string;
    keyPoints?:   string[];
  };
  intentClusters?: Record<string, { question?: string; answer?: string }>;
  entityBlock?:    Record<string, string>;
}

// ── Keyword parser ─────────────────────────────────────────────────────────────

const INTENT_SIGNALS: Record<string, string> = {
  emergency:  "urgent",
  urgent:     "urgent",
  "24/7":     "urgent",
  fast:       "urgent",
  immediate:  "urgent",
  affordable: "standard",
  cheap:      "standard",
  local:      "standard",
  specialist: "premium",
  expert:     "premium",
  premium:    "premium",
  certified:  "premium",
};

// Known two-word UK location starters — checked against the second-to-last word
const TWO_WORD_LOCATIONS = new Set([
  "south", "north", "east", "west", "new", "old", "great", "little",
  "upper", "lower", "long", "high", "market", "bishop", "kings", "queens",
  "saint", "st", "royal", "great", "castle",
]);

export function parseKeyword(keyword: string): {
  service:  string;
  location: string;
  intent:   string;
} {
  const words = keyword.trim().split(/\s+/);

  // Default: last 1 word = location, rest = service.
  // Exception: last 2 words = location when the second-to-last is a known
  // multi-word location prefix ("South Yorkshire", "West London", etc.).
  let locationWords = 1;
  if (words.length >= 3) {
    const secondLast = (words[words.length - 2] ?? "").toLowerCase();
    if (TWO_WORD_LOCATIONS.has(secondLast)) locationWords = 2;
  }

  const location = words.slice(words.length - locationWords).join(" ");
  const service  = words.slice(0, words.length - locationWords).join(" ") || keyword.trim();

  const kwLower = keyword.toLowerCase();
  let intent = "standard";
  for (const [signal, intentValue] of Object.entries(INTENT_SIGNALS)) {
    if (kwLower.includes(signal)) { intent = intentValue; break; }
  }

  return { service, location, intent };
}

// ── Prompt file resolver ───────────────────────────────────────────────────────

function findPromptFile(filename: string): string {
  const fromCwd = path.join(process.cwd(), "prompts", filename);
  if (fs.existsSync(fromCwd)) return fromCwd;

  let dir: string;
  try {
    dir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return fromCwd;
  }
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "prompts", filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return fromCwd;
}

// ── Keyword-first content generator ───────────────────────────────────────────

export async function generateKeywordPageContent(
  inputs: KeywordPageInputs
): Promise<KeywordPageContent> {
  const { keyword } = inputs;
  const { service, location, intent } = parseKeyword(keyword);

  const nearbyAreas     = inputs.nearbyAreas ?? [];
  const bizName         = inputs.businessProfile?.name  ?? "{{BUSINESS_NAME}}";
  const bizPhone        = inputs.businessProfile?.phone ?? "{{BUSINESS_PHONE}}";
  const nearbyAreasStr  = nearbyAreas.length > 0 ? nearbyAreas.join(", ") : `areas surrounding ${location}`;
  const nearbyAreasJSON = JSON.stringify(nearbyAreas.length > 0 ? nearbyAreas : [`${location} area`]);

  const promptPath = findPromptFile("service-location-page-prompt.txt");
  let prompt = fs.readFileSync(promptPath, "utf8");

  const tokens: Record<string, string> = {
    "{{PRIMARY_KEYWORD}}":   keyword,
    "{{SERVICE}}":           service,
    "{{LOCATION}}":          location,
    "{{INTENT}}":            intent,
    "{{NEARBY_AREAS}}":      nearbyAreasStr,
    "{{NEARBY_AREAS_JSON}}": nearbyAreasJSON,
    "{{BUSINESS_NAME}}":     bizName,
    "{{BUSINESS_PHONE}}":    bizPhone,
  };
  for (const [tok, val] of Object.entries(tokens)) {
    prompt = prompt.split(tok).join(val);
  }

  console.log(`  Generating keyword-first content for: "${keyword}" [${service} | ${location} | ${intent}]…`);

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
  }
  const client = new OpenAI({ baseURL, apiKey });

  const response = await client.chat.completions.create({
    model:       "gpt-4.1",
    temperature: 0.65,
    messages: [
      {
        role:    "system",
        content: "You are a local SEO copywriter. Produce structured JSON content for keyword-driven local service landing pages. Every section must be focused on the primary keyword. Return only valid JSON — no markdown, no explanation.",
      },
      { role: "user", content: prompt },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsed: Omit<KeywordPageContent, "keyword" | "service" | "location" | "intent">;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`AI response is not valid JSON:\n${raw.slice(0, 400)}`);
    parsed = JSON.parse(match[0]);
  }

  console.log(`  Keyword-first content generated: "${keyword}"`);

  return {
    keyword, service, location, intent,
    meta:                 parsed.meta                 ?? { title: keyword, description: "", h1: `${service} in ${location}` },
    hero:                 parsed.hero                 ?? { headline: `${service} in ${location}`, intro: "", trustBullets: [] },
    emergencyReassurance: parsed.emergencyReassurance ?? { heading: `Need a ${service} in ${location}?`, body: "" },
    whatWeHelp:           parsed.whatWeHelp           ?? { heading: `What our ${service} in ${location} can fix`, body: "" },
    localCoverage:        parsed.localCoverage        ?? { heading: `${service} coverage in ${location}`, body: "" },
    beforeArrival:        parsed.beforeArrival        ?? { heading: "What to do before the plumber arrives", intro: "", steps: [] },
    pricing:              parsed.pricing              ?? { heading: `${service} costs in ${location}`, body: "" },
    whyChooseUs:          parsed.whyChooseUs          ?? { heading: `Why choose us for ${service} in ${location}?`, points: [] },
    process:              parsed.process              ?? { heading: "How to book", steps: [] },
    faq:                  parsed.faq                  ?? [],
    cta:                  parsed.cta                  ?? { heading: `Need a ${service} in ${location}?`, body: "" },
  };
}
