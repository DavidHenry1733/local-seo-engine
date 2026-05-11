/**
 * refineContent.ts
 *
 * Second-pass readability editor that runs after AI content generation.
 *
 * Accepts the raw AI content object (hub or cluster), extracts all
 * prose fields, sends them as a single batch to the AI with strict
 * readability rules, then merges the refined text back into the
 * original content structure.
 *
 * Does NOT change:
 *   - headings or h2/h3 text
 *   - keywords or their placement
 *   - URLs or anchor text
 *   - section structure or JSON shape
 *   - meaning or factual claims
 */

import OpenAI from "openai";
import type { GeneratedPageContent } from "./generatePageContent";
import type { ClusterPageContent }   from "./generateClusterContent";

// ── Readability rules sent to the editor model ────────────────────────────────

const READABILITY_RULES = `
READABILITY EDITING RULES — apply to every prose field:

SENTENCES
- Keep most sentences under 20 words.
- Split long, multi-clause sentences into two shorter ones.
- Prefer simple, direct phrasing over formal or complex constructions.
- Use active voice. Avoid passive constructions.

PARAGRAPHS
- Limit each paragraph to 2–4 sentences.
- Separate paragraphs with a blank line (\\n\\n).
- Each paragraph should communicate one clear idea.
- Avoid dense unbroken blocks of text.

REPETITION
- Remove repeated phrases or ideas — each point stated once only.
- Do not restate the same message in different wording.
- Ensure each paragraph adds something new.

CLARITY
- Remove vague or generic filler phrases.
- Every sentence must add value.
- Be concise. Cut words that do not earn their place.

COMMERCIAL LANGUAGE
- Keep references to enquiries, leads, revenue, and business growth.
- Use each commercial term at most twice per field.
- Make commercial language concise and impactful, not repetitive.

CONSTRAINTS — MUST NOT CHANGE:
- Do NOT change headings, subheadings, or any text that is a heading.
- Do NOT change URLs, href values, or anchor text.
- Do NOT remove primary keywords or move them from their position.
- Do NOT alter factual claims, named services, or location names.
- Do NOT add new ideas, sections, or content.
- Return the same JSON structure with improved prose values only.
`.trim();

// ── OpenAI client (uses Replit AI Integrations env vars) ─────────────────────

function getClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("Missing AI integration env vars: AI_INTEGRATIONS_OPENAI_BASE_URL / AI_INTEGRATIONS_OPENAI_API_KEY");
  }
  return new OpenAI({ baseURL, apiKey });
}

// ── Core batch refiner ────────────────────────────────────────────────────────

/**
 * Sends a flat key→prose map to the editor model and returns a refined map.
 * Falls back to the original values if the API response is not valid JSON.
 */
async function refineProse(
  proseMap: Record<string, string>
): Promise<Record<string, string>> {
  const client = getClient();

  const systemPrompt = [
    "You are a professional web content editor specialising in readability.",
    "You will receive a JSON object where every value is a prose text block.",
    "Improve each value according to the readability rules below.",
    "Return ONLY valid JSON with the same keys. No markdown. No code fences. No explanation.",
    "",
    READABILITY_RULES,
  ].join("\n");

  const userPrompt = `Refine the following content for readability. Return the same JSON keys:\n\n${
    JSON.stringify(proseMap, null, 2)
  }`;

  console.log(`  Refining ${Object.keys(proseMap).length} prose fields for readability…`);

  let raw = "";
  try {
    const response = await client.chat.completions.create({
      model:      "gpt-4.1-mini",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    });
    raw = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.warn("  Readability refinement API call failed — using original content.", err);
    return proseMap;
  }

  // Strip accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  let refined: Record<string, string>;
  try {
    refined = JSON.parse(cleaned) as Record<string, string>;
  } catch {
    // Try extracting a JSON object from anywhere in the response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        refined = JSON.parse(match[0]) as Record<string, string>;
      } catch {
        console.warn("  Could not parse refinement response — using original content.");
        return proseMap;
      }
    } else {
      console.warn("  No JSON found in refinement response — using original content.");
      return proseMap;
    }
  }

  // Merge: use original value for any key the model dropped
  for (const [key, original] of Object.entries(proseMap)) {
    if (!refined[key] || typeof refined[key] !== "string") {
      refined[key] = original;
    }
  }

  console.log("  Readability refinement complete.");
  return refined;
}

// ── Hub refiner ───────────────────────────────────────────────────────────────

/**
 * Runs a readability pass on all prose fields in a hub GeneratedPageContent.
 * Headings, URLs, and the content JSON structure are preserved.
 */
export async function refineHubContent(
  content: GeneratedPageContent
): Promise<GeneratedPageContent> {
  const proseMap: Record<string, string> = {
    aiSummaryIntro:    content.aiSummaryIntro,
    split1Body:        content.split1.body,
    split2Body:        content.split2.body,
    definitionBody:    content.definition.body,
    image3Body:        content.image3?.body ?? "",
    localRelevanceBody: content.localRelevance.body,
    ctaBody:           content.cta.body,
    trustStrip:        content.trustStrip,
  };

  // Bullets: indexed by position
  content.aiSummaryBullets.forEach((b, i) => { proseMap[`bullet_${i}`] = b; });

  // Process step descriptions
  content.process.steps.forEach((s, i) => { proseMap[`processDesc_${i}`] = s.description; });

  // FAQ answers
  content.faq.forEach((item, i) => { proseMap[`faqAnswer_${i}`] = item.answer; });

  const refined = await refineProse(proseMap);

  return {
    ...content,
    aiSummaryIntro:  refined.aiSummaryIntro,
    aiSummaryBullets: content.aiSummaryBullets.map((_, i) => refined[`bullet_${i}`] ?? content.aiSummaryBullets[i]!),
    split1:          { ...content.split1,       body: refined.split1Body },
    split2:          { ...content.split2,       body: refined.split2Body },
    definition:      { ...content.definition,   body: refined.definitionBody },
    image3:          { ...content.image3,       body: refined.image3Body },
    localRelevance:  { ...content.localRelevance, body: refined.localRelevanceBody },
    process: {
      ...content.process,
      steps: content.process.steps.map((step, i) => ({
        ...step,
        description: refined[`processDesc_${i}`] ?? step.description,
      })),
    },
    faq: content.faq.map((item, i) => ({
      ...item,
      answer: refined[`faqAnswer_${i}`] ?? item.answer,
    })),
    cta:        { ...content.cta,       body: refined.ctaBody },
    trustStrip: refined.trustStrip,
  };
}

// ── Cluster refiner ───────────────────────────────────────────────────────────

/**
 * Runs a readability pass on all prose fields in a cluster ClusterPageContent.
 * Headings, URLs, resource card links, and JSON structure are preserved.
 */
export async function refineClusterContent(
  content: ClusterPageContent
): Promise<ClusterPageContent> {
  const proseMap: Record<string, string> = {
    aiSummaryIntro: content.aiSummaryIntro,
    split1Body:     content.split1.body,
    split2Body:     content.split2.body,
    ctaBody:        content.cta.body,
    trustStrip:     content.trustStrip,
  };

  content.aiSummaryBullets.forEach((b, i) => { proseMap[`bullet_${i}`] = b; });
  content.faq.forEach((item, i)            => { proseMap[`faqAnswer_${i}`] = item.answer; });

  // Related resource descriptions (short — only refine if substantive)
  content.relatedResources.forEach((r, i) => {
    if (r.description && r.description.length > 20) {
      proseMap[`resourceDesc_${i}`] = r.description;
    }
  });

  const refined = await refineProse(proseMap);

  return {
    ...content,
    aiSummaryIntro:  refined.aiSummaryIntro,
    aiSummaryBullets: content.aiSummaryBullets.map((_, i) => refined[`bullet_${i}`] ?? content.aiSummaryBullets[i]!),
    split1:          { ...content.split1, body: refined.split1Body },
    split2:          { ...content.split2, body: refined.split2Body },
    faq: content.faq.map((item, i) => ({
      ...item,
      answer: refined[`faqAnswer_${i}`] ?? item.answer,
    })),
    relatedResources: content.relatedResources.map((r, i) => ({
      ...r,
      description: refined[`resourceDesc_${i}`] ?? r.description,
    })),
    cta:        { ...content.cta, body: refined.ctaBody },
    trustStrip: refined.trustStrip,
  };
}
