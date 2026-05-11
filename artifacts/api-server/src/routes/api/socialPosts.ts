/**
 * socialPosts.ts — Visibility Posts / Social Post Generator
 *
 * POST /api/social-posts/generate           — AI-generate platform posts
 * POST /api/social-posts/generate-image     — Ideogram image for a post set
 * GET  /api/social-posts/pages/:slug        — list generated pages for link picker
 * GET  /api/social-posts/:slug              — list saved post sets
 * POST /api/social-posts/:slug/save         — save a post set
 * DELETE /api/social-posts/:slug/:id        — delete a saved post set
 */

import { Router } from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const router = Router();

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");

function getClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
  return new OpenAI({ baseURL, apiKey });
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface PostSet {
  id: string;
  createdAt: string;
  topic: string;
  businessType: string;
  location: string;
  postObjective: string;
  linkUrl: string;
  platforms: string[];
  posts: Record<string, string>;
  imageUrl?: string;
  imagePrompt?: string;
}

interface PostIndex { sets: PostSet[] }

function socialDir(slug: string): string {
  return path.join(OUTPUT_DIR, slug, "social-posts");
}

function loadIndex(slug: string): PostIndex {
  const p = path.join(socialDir(slug), "index.json");
  if (!fs.existsSync(p)) return { sets: [] };
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return { sets: [] }; }
}

function saveIndex(slug: string, idx: PostIndex): void {
  const dir = socialDir(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx, null, 2), "utf8");
}

// ── Platform instructions ─────────────────────────────────────────────────────

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  gbp: `Google Business Profile post:
- 100–150 words
- Local service-focused, direct and practical
- Mention the business type and location naturally
- Clear CTA that drives enquiries or visits
- Include the link at the end naturally`,

  facebook: `Facebook post:
- 80–140 words
- Friendly, conversational, local community tone
- Relatable opening line that grabs attention
- Soft CTA, include the link naturally`,

  instagram: `Instagram caption:
- 40–80 words for the main caption, then a line break
- Visual-first hook on the first line
- 6–10 relevant hashtags on a new line (mix of local, service, and general)
- CTA with the link`,

  linkedin: `LinkedIn post:
- 100–180 words
- Professional, insight-led tone
- B2B or professional positioning
- Short punchy opener, then value/insight, then CTA with link
- No hashtag spam — max 3 relevant hashtags`,

  twitter: `X (Twitter) post:
- Maximum 260 characters including the link
- Hook-led — the first 5 words must demand attention
- Concise and punchy — every word earns its place
- One clear CTA; include the link at the end
- No hashtag overload — max 2 relevant hashtags`,
};

function buildPrompt(body: {
  topic: string;
  businessType: string;
  location: string;
  postObjective: string;
  linkUrl: string;
  platforms: string[];
}): string {
  const { topic, businessType, location, postObjective, linkUrl, platforms } = body;
  const hasLink = linkUrl && linkUrl !== "#" && linkUrl !== "";

  const platformBlocks = platforms
    .map(p => {
      const key = p.toLowerCase();
      const instructions = PLATFORM_INSTRUCTIONS[key] ?? `Post for ${p}: professional, with CTA${hasLink ? " and the link" : ""}.`;
      return `=== ${p.toUpperCase()} ===\n${instructions}`;
    })
    .join("\n\n");

  const linkInstruction = hasLink
    ? `- Link to include: ${linkUrl} — weave naturally into the CTA area, not dumped raw mid-copy`
    : `- No link — informational post only, no URL needed`;

  return `You are a social media copywriter for local service businesses. Write platform-specific social posts.

INPUTS:
- Topic / Keyword: ${topic}
- Business type: ${businessType}
- Location: ${location}
- Post objective: ${postObjective}
${linkInstruction}
- Platforms requested: ${platforms.join(", ")}

PLATFORM REQUIREMENTS:
${platformBlocks}

RULES:
- Each post must be unique — do NOT copy the same text across platforms
- Sound natural and human, never robotic
- Include local relevance where it makes sense
- Avoid exaggerated claims or fake guarantees ("guaranteed results", "#1 in the UK", etc.)
- Every post must include a clear next step / CTA
${hasLink ? "- Include the link once, naturally in the CTA area. Do not repeat it." : "- No links — informational content only"}
- UK English spelling

Respond with ONLY valid JSON in this exact shape (include only the platforms requested):
{
  "gbp":       "...",
  "facebook":  "...",
  "instagram": "...",
  "linkedin":  "...",
  "twitter":   "..."
}

Omit any platform keys that were not requested. No markdown, no explanation outside the JSON.`;
}

// ── Image prompt builder ──────────────────────────────────────────────────────

const TRADE_NEGATIVE =
  "office, desk, laptop, suit, meeting room, call centre, digital screens, generic people posing, " +
  "corporate environment, text overlays, logos, watermarks, cartoon, illustration, vector art, " +
  "web design, digital marketing, agency, computer, whiteboard, staged studio backdrop";

const DIGITAL_NEGATIVE =
  "photorealistic, photograph, real people, stock photo, low quality, blurry, text in image, " +
  "watermark, logo, random bright background colours, childish illustration style";

function buildSocialImagePrompt(input: {
  businessType: string;
  topic: string;
  location: string;
  postObjective: string;
}): { prompt: string; negativePrompt: string; stylePreset: string } {
  const bt  = input.businessType.toLowerCase();
  const top = input.topic.toLowerCase();

  // Detect trade industries
  const isTrade =
    bt.includes("plumb") || bt.includes("electr") || bt.includes("roof") ||
    bt.includes("heat") || bt.includes("boiler") || bt.includes("hvac") ||
    bt.includes("landscap") || bt.includes("garden") || bt.includes("drain") ||
    bt.includes("paint") || bt.includes("builder") || bt.includes("construct") ||
    bt.includes("carpet") || bt.includes("clean") || bt.includes("pest") ||
    bt.includes("window") || bt.includes("glaz");

  if (isTrade) {
    const prompt =
      `A professional ${input.businessType} in ${input.location} working on ${input.topic}. ` +
      `The tradesperson is shown in their working environment, wearing appropriate workwear, ` +
      `focused on their task. Natural lighting, realistic residential or commercial setting. ` +
      `High-quality, realistic, documentary-style photography. Wide shot showing real-world context. ` +
      `Social media post image format, 16:9 landscape.`;
    return { prompt, negativePrompt: TRADE_NEGATIVE, stylePreset: "EDITORIAL" };
  }

  // Digital / professional services
  const isWebDigital = bt.includes("web") || bt.includes("seo") || bt.includes("digit") || bt.includes("market");
  if (isWebDigital) {
    const prompt =
      `Professional flat vector illustration for a ${input.businessType} business in ${input.location}. ` +
      `Topic: ${input.topic}. Objective: ${input.postObjective}. ` +
      `Clean modern illustration style, brand colours #005EB8 #1CA9C9 #003A6D, white background. ` +
      `No text, no watermarks, no photorealistic style. Social media ready, 16:9 landscape.`;
    return { prompt, negativePrompt: DIGITAL_NEGATIVE, stylePreset: "FLAT_VECTOR" };
  }

  // Food / restaurant / hospitality
  const isFood = bt.includes("restaur") || bt.includes("cafe") || bt.includes("food") ||
    bt.includes("caterer") || bt.includes("baker") || bt.includes("bar") || bt.includes("pub");
  if (isFood) {
    const prompt =
      `High-quality food photography style image for a ${input.businessType} in ${input.location}. ` +
      `Theme: ${input.topic}. ` +
      `Warm, appetising, inviting atmosphere. Natural lighting, styled presentation. ` +
      `Social media ready, 16:9 landscape format, realistic and appealing.`;
    return { prompt, negativePrompt: TRADE_NEGATIVE, stylePreset: "EDITORIAL" };
  }

  // Generic local service business
  const prompt =
    `Professional social media image for a ${input.businessType} in ${input.location}. ` +
    `Topic: ${input.topic}. Objective: ${input.postObjective}. ` +
    `Modern, clean, local business visual style. Real-world setting, professional and approachable. ` +
    `16:9 landscape, high-quality, natural lighting.`;

  const isMostlyDigital = top.includes("seo") || top.includes("website") || top.includes("marketing") || top.includes("online");
  return {
    prompt,
    negativePrompt: isMostlyDigital ? DIGITAL_NEGATIVE : TRADE_NEGATIVE,
    stylePreset: "EDITORIAL",
  };
}

// ── POST /api/social-posts/generate ──────────────────────────────────────────

router.post("/social-posts/generate", async (req, res) => {
  const {
    topic        = "",
    businessType = "",
    location     = "",
    postObjective= "",
    linkUrl      = "",
    platforms    = [] as string[],
  } = req.body ?? {};

  if (!topic || !businessType || !location || !platforms.length) {
    res.status(400).json({ error: "topic, businessType, location and at least one platform are required" });
    return;
  }

  const link = linkUrl?.trim() || "";

  try {
    const client = getClient();
    const prompt = buildPrompt({ topic, businessType, location, postObjective, linkUrl: link, platforms });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const posts = JSON.parse(jsonStr) as Record<string, string>;

    res.json({ posts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `AI generation failed: ${msg}` });
  }
});

// ── POST /api/social-posts/generate-image ────────────────────────────────────

router.post("/social-posts/generate-image", async (req, res) => {
  const { topic = "", businessType = "", location = "", postObjective = "" } = req.body ?? {};

  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Image generation not configured (IDEOGRAM_API_KEY missing)" });
    return;
  }

  if (!topic || !businessType || !location) {
    res.status(400).json({ error: "topic, businessType and location are required" });
    return;
  }

  const { prompt, negativePrompt, stylePreset } = buildSocialImagePrompt({
    businessType, topic, location, postObjective,
  });

  try {
    const requestBody: Record<string, unknown> = {
      prompt,
      rendering_speed: "TURBO",
      aspect_ratio: "16x9",
    };
    if (stylePreset) requestBody.style_preset = stylePreset;
    if (negativePrompt) requestBody.negative_prompt = negativePrompt;

    const ideogramRes = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
      method: "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!ideogramRes.ok) {
      const text = await ideogramRes.text();
      throw new Error(`Ideogram API error: ${ideogramRes.status} — ${text}`);
    }

    const result = await ideogramRes.json() as { data?: Array<{ url?: string }> };
    const imageUrl = result.data?.[0]?.url;
    if (!imageUrl) throw new Error("Ideogram returned no image URL");

    res.json({ imageUrl, prompt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Image generation failed: ${msg}` });
  }
});

// ── GET /api/social-posts/pages/:slug ────────────────────────────────────────

router.get("/social-posts/pages/:slug", (req, res) => {
  const { slug } = req.params;
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) { res.json({ pages: [] }); return; }

  const pages: { label: string; url: string }[] = [];
  try {
    const entries = fs.readdirSync(clientDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const htmlPath = path.join(clientDir, e.name, "index.html");
      if (!fs.existsSync(htmlPath)) continue;
      if (e.name === "social-posts" || e.name === "distribution" || e.name === "sessions") continue;
      if (e.name.includes("http:") || e.name.includes("https:")) continue;

      const dataPath = path.join(clientDir, e.name, "page-data.json");
      let label = e.name.replace(/-/g, " ");
      let url = "";
      if (fs.existsSync(dataPath)) {
        try {
          const pd = JSON.parse(fs.readFileSync(dataPath, "utf8"));
          if (pd.canonicalUrl) url = pd.canonicalUrl;
          if (pd.primaryKeyword) label = pd.primaryKeyword;
          else if (pd.area && pd.serviceName) label = `${pd.serviceName} – ${pd.area}`;
        } catch { /* use folder name */ }
      }
      if (!url) url = `/${e.name}/`;
      pages.push({ label, url });
    }
    pages.sort((a, b) => a.label.localeCompare(b.label));
  } catch { /* return empty */ }

  res.json({ pages });
});

// ── GET /api/social-posts/:slug ───────────────────────────────────────────────

router.get("/social-posts/:slug", (req, res) => {
  const { slug } = req.params;
  res.json(loadIndex(slug));
});

// ── POST /api/social-posts/:slug/save ────────────────────────────────────────

router.post("/social-posts/:slug/save", (req, res) => {
  const { slug } = req.params;
  const { topic, businessType, location, postObjective, linkUrl, platforms, posts, imageUrl, imagePrompt } = req.body ?? {};

  if (!posts || !topic) { res.status(400).json({ error: "posts and topic are required" }); return; }

  const idx = loadIndex(slug);
  const set: PostSet = {
    id: `sp-${Date.now()}`,
    createdAt: new Date().toISOString(),
    topic, businessType, location, postObjective, linkUrl, platforms, posts,
    ...(imageUrl ? { imageUrl } : {}),
    ...(imagePrompt ? { imagePrompt } : {}),
  };
  idx.sets.unshift(set);
  if (idx.sets.length > 100) idx.sets = idx.sets.slice(0, 100);
  saveIndex(slug, idx);
  res.json({ ok: true, id: set.id });
});

// ── DELETE /api/social-posts/:slug/:id ───────────────────────────────────────

router.delete("/social-posts/:slug/:id", (req, res) => {
  const { slug, id } = req.params;
  const idx = loadIndex(slug);
  idx.sets = idx.sets.filter(s => s.id !== id);
  saveIndex(slug, idx);
  res.json({ ok: true });
});

export default router;
