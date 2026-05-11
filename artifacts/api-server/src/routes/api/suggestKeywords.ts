/**
 * suggestKeywords.ts — POST /api/suggest-keywords
 *
 * Body: { service, location, area, primaryKeyword, existingKeywords? }
 * Returns: { suggestions: string[] }
 *
 * Generates 8 supporting keyword suggestions for a local SEO page using AI.
 * Used by the stage 4 keyword review panel in the Setup Wizard.
 */

import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
  }
  return new OpenAI({ baseURL, apiKey });
}

router.post("/suggest-keywords", async (req, res) => {
  try {
    const {
      service          = "",
      location         = "",
      area             = "",
      primaryKeyword   = "",
      existingKeywords = [] as string[],
    } = req.body ?? {};

    if (!service || !primaryKeyword) {
      res.status(400).json({ error: "service and primaryKeyword are required" });
      return;
    }

    const targetArea = area || location;
    const existing   = (existingKeywords as string[]).join(", ") || "none";

    const prompt = `You are a local SEO specialist. Generate 8 supporting keyword suggestions for a local service page.

INPUTS:
- Service: ${service}
- Parent city: ${location}
- Target sub-area: ${targetArea}
- Primary keyword (H1, already set): ${primaryKeyword}
- Supporting keywords already in use: ${existing}

RULES:
- Each suggestion must be a realistic search phrase someone in ${targetArea} would type into Google.
- Include "${targetArea}" in at least 5 of the 8 suggestions.
- Mix intent types: informational ("how to fix..."), transactional ("${service} cost ${targetArea}"), navigational ("best ${service} ${targetArea}"), emergency ("urgent ${service} ${targetArea}").
- UK English spelling throughout (favour, recognise, licence, centre, etc.)
- 2–5 words per keyword.
- Do NOT exactly repeat the primary keyword: "${primaryKeyword}"
- Do NOT include any of the already-in-use keywords listed above.
- Do NOT wrap keywords in quotes.
- Return ONLY a JSON array of 8 strings. No markdown, no explanation, no other text.

Example format: ["${service} cost ${targetArea}", "local ${service} ${targetArea}", ...]`;

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a local SEO keyword specialist. Return ONLY valid JSON arrays. No markdown, no explanation." },
        { role: "user", content: prompt },
      ],
      temperature: 0.75,
      max_tokens: 300,
    });

    const raw = (completion.choices[0]?.message?.content ?? "").trim();

    let suggestions: string[] = [];
    try {
      const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
      const parsed  = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .map(s => s.trim().replace(/^["']|["']$/g, ""));
      }
    } catch {
      // Fallback: extract quoted strings from response
      const matches = raw.match(/"([^"]{3,60})"/g);
      if (matches) suggestions = matches.map(m => m.slice(1, -1));
    }

    // Filter out exact duplicates of primary keyword and existing keywords
    const existingSet = new Set([
      primaryKeyword.toLowerCase(),
      ...(existingKeywords as string[]).map((k: string) => k.toLowerCase()),
    ]);
    suggestions = suggestions
      .filter(s => !existingSet.has(s.toLowerCase()))
      .slice(0, 8);

    res.json({ suggestions });
  } catch (err: any) {
    console.error("suggest-keywords error:", err.message);
    res.status(500).json({ error: err.message || "Keyword suggestion failed" });
  }
});

export default router;
