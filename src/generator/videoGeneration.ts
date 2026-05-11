/**
 * videoGeneration.ts
 *
 * Generates a complete video production pack for an SEO page.
 * Returns three video variants: youtube_short, youtube_standard, social_clip.
 * No video API is called — output is for use with text-to-video tools only.
 */

import OpenAI from "openai";

// ── Context ───────────────────────────────────────────────────────────────────

export interface VideoContext {
  clientSlug:      string;
  campaignId:      string;
  pageSlug:        string;
  pageTitle:       string;
  primaryKeyword:  string;
  service:         string;
  location:        string;
  businessName:    string;
  pageUrl:         string;
  moneyPageUrl?:   string;
  aiSummary?:      string;
  keyBenefits?:    string[];
  targetAudience?: string;
  nearbyAreas?:    string[];
  approvedClaims?: string[];
  imageUrl?:       string;
  brandColours?:   string;
  logoUrl?:        string;
  toneOfVoice?:    string;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface VideoScene {
  sceneNumber:    number;
  timestamp:      string;
  narration:      string;
  onScreenText:   string;
  visualPrompt:   string;
  brollSuggestion: string;
}

export interface VideoVariant {
  videoType:       "youtube_short" | "youtube_standard" | "social_clip";
  title:           string;
  hook:            string;
  script:          string;
  sceneBreakdown:  VideoScene[];
  captions:        string[];
  voiceoverStyle:  string;
  visualStyle:     string;
  brollSuggestions: string[];
  thumbnailPrompt: string;
  youtube: {
    title:        string;
    description:  string;
    tags:         string[];
    chapters:     Array<{ timestamp: string; title: string }>;
    pinnedComment: string;
  };
  social: {
    facebookCaption: string;
    linkedinCaption: string;
    shortCaption:    string;
  };
  cta:    string;
  status: "draft";
}

export interface VideoPackOutput {
  youtube_short:    VideoVariant;
  youtube_standard: VideoVariant;
  social_clip:      VideoVariant;
}

// ── OpenAI client ─────────────────────────────────────────────────────────────

function makeClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
  }
  return new OpenAI({ baseURL, apiKey });
}

// ── Generator ─────────────────────────────────────────────────────────────────

export async function generateVideoPack(
  ctx: VideoContext,
): Promise<VideoPackOutput> {
  const client = makeClient();

  const nearby   = ctx.nearbyAreas?.length   ? ctx.nearbyAreas.slice(0, 6).join(", ")  : "";
  const benefits = ctx.keyBenefits?.length   ? ctx.keyBenefits.join("; ")               : "";
  const claims   = ctx.approvedClaims?.length ? ctx.approvedClaims.join("; ")            : "";

  const contextBlock = [
    `Page Title: ${ctx.pageTitle}`,
    `Primary Keyword: ${ctx.primaryKeyword}`,
    `Service: ${ctx.service}`,
    `Location: ${ctx.location}`,
    `Business Name: ${ctx.businessName}`,
    `Page URL: ${ctx.pageUrl}`,
    ctx.moneyPageUrl    ? `Money Page URL: ${ctx.moneyPageUrl}`         : null,
    ctx.aiSummary       ? `Page Summary: ${ctx.aiSummary}`              : null,
    benefits            ? `Key Benefits: ${benefits}`                   : null,
    ctx.targetAudience  ? `Target Audience: ${ctx.targetAudience}`      : null,
    nearby              ? `Nearby Areas Served: ${nearby}`              : null,
    claims              ? `Approved Claims: ${claims}`                  : null,
    ctx.brandColours    ? `Brand Colours: ${ctx.brandColours}`          : null,
    ctx.toneOfVoice     ? `Tone of Voice: ${ctx.toneOfVoice}`           : null,
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are a video production specialist creating complete video packs for ${ctx.businessName}, a local ${ctx.service} business in ${ctx.location}, UK.

STRICT RULES — follow all or output will be rejected:
1. Do NOT claim guaranteed rankings, income, or positions unless stated in Approved Claims.
2. Do NOT invent statistics or third-party endorsements.
3. Do NOT use superlatives like "best", "number one", "top-rated" unless in Approved Claims.
4. Each video variant MUST have a completely different angle and hook — no copy-paste.
5. Scripts must be localised: mention ${ctx.location} naturally in every variant.
6. Voiceover style: British English, warm, professional, conversational. No hype.
7. Visual style: professional local business. Clean, modern. No cartoon or gimmick.
8. Every script must follow: Hook → Problem → Insight → Solution → CTA.
9. Return ONLY valid JSON matching the exact schema. No markdown, no code fences.`;

  const sceneSchema = `[{"sceneNumber":1,"timestamp":"0:00","narration":"spoken narration for this scene","onScreenText":"short on-screen overlay text (max 8 words)","visualPrompt":"detailed visual direction for the scene","brollSuggestion":"specific b-roll footage suggestion"}]`;

  const variantSchema = (
    videoType: string,
    durationNote: string,
    sceneCount: string,
  ) => `{
  "videoType": "${videoType}",
  "title": "Video title under 70 characters",
  "hook": "Opening hook line — single punchy sentence that stops the scroll",
  "script": "Full spoken script for ${durationNote}. Structure: Hook (opens immediately), Problem, Insight, Solution with 2-3 key points, CTA. Natural spoken language only — no stage directions.",
  "sceneBreakdown": ${sceneSchema} (${sceneCount} for this duration),
  "captions": ["max 8 words per caption", "direct and punchy", "5 to 8 caption lines"],
  "voiceoverStyle": "British English, warm, professional, confident, local business adviser tone — no hype",
  "visualStyle": "professional local business: clean modern visuals, website mockups, local area references, laptop/mobile previews, subtle brand colours",
  "brollSuggestions": ["6 specific b-roll suggestions: local high street, people browsing on mobile, small business owner at laptop, modern website layout, Google map visual, contact form visual"],
  "thumbnailPrompt": "Detailed AI image prompt for a YouTube thumbnail: bold readable text, ${ctx.service} + ${ctx.location}, professional website/local business visual, brand colours if available, no tiny text",
  "youtube": {
    "title": "Under 70 characters, include primary keyword naturally",
    "description": "150-300 words. Include ${ctx.pageUrl}. Include ${ctx.businessName}. Include ${ctx.service} + ${ctx.location}. Strong CTA. Naturally SEO-optimised. No keyword stuffing.",
    "tags": ["8 to 12 YouTube tags covering service, location, business type, nearby areas"],
    "chapters": [{"timestamp":"0:00","title":"Intro"},{"timestamp":"0:15","title":"The Problem"},{"timestamp":"0:35","title":"The Solution"},{"timestamp":"1:00","title":"Take Action"}],
    "pinnedComment": "Short CTA with ${ctx.pageUrl}"
  },
  "social": {
    "facebookCaption": "Short Facebook caption for sharing this video. 40-80 words. Friendly, local. Include page URL.",
    "linkedinCaption": "Short LinkedIn caption for sharing this video. 40-80 words. Professional tone. Include page URL.",
    "shortCaption": "Ultra-short caption for Stories/Reels. Under 20 words."
  },
  "cta": "The spoken call-to-action line used at the end of the video",
  "status": "draft"
}`;

  const userPrompt = `Generate a complete video production pack for this SEO page:

${contextBlock}

Return a JSON object with exactly three keys: youtube_short, youtube_standard, social_clip.

youtube_short — 30-45 seconds, vertical format, punchy hook, for Shorts/TikTok/Reels:
${variantSchema("youtube_short", "30-45 seconds", "3-4 scenes")}

youtube_standard — 60-90 seconds, main YouTube upload, more explanation:
${variantSchema("youtube_standard", "60-90 seconds", "5-7 scenes")}

social_clip — 20-30 seconds, fast benefit-led, for Facebook/LinkedIn:
${variantSchema("social_clip", "20-30 seconds", "3-4 scenes")}

Each variant MUST have a different hook, different angle, and different opening. Do not copy any section between variants. Localise ${ctx.location} and ${ctx.service} throughout every script.`;

  const response = await client.chat.completions.create({
    model:           "gpt-4.1",
    max_tokens:      6000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt   },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as VideoPackOutput;
}
