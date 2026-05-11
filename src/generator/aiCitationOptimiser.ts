/**
 * aiCitationOptimiser.ts
 *
 * Step 2 — Real post-render AI citation optimisation pass.
 * Controlled behind project config: aiCitationOptimisation: { enabled: true }
 *
 * When enabled:
 *   1. Sends the rendered HTML + context to gpt-4.1
 *   2. Receives full optimised HTML back
 *   3. Runs a suite of safety checks — falls back to original if any fail
 *
 * When disabled (default):
 *   Returns the original HTML unchanged.
 */

import OpenAI from "openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiCitationContext {
  clientSlug:   string;
  campaignId:   string;
  service:      string;
  location:     string;
  businessName: string;
  hubSlug:      string;
  moneyPageUrl: string;
  canonicalUrl: string;
  pageType:     "hub" | "cluster";
}

// ── OpenAI client (uses same Replit AI Integrations env vars as the generator) ─

function getClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY"
    );
  }
  return new OpenAI({ baseURL, apiKey });
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildOptimiserPrompt(ctx: AiCitationContext): string {
  return `You are an advanced AI SEO optimisation engine.

You will receive a complete rendered HTML page.

Your task is to make the page more extractable and citable by AI search engines such as Google AI Overviews, ChatGPT and Perplexity.

CONTEXT:
- Business name: ${ctx.businessName}
- Service: ${ctx.service}
- Location: ${ctx.location}
- Page type: ${ctx.pageType}
- Canonical URL: ${ctx.canonicalUrl}

CRITICAL RULES:
- Return the full HTML only.
- Do not explain your changes.
- Do not remove any sections.
- Do not rename any IDs or classes.
- Do not change image URLs.
- Do not change schema JSON-LD.
- Do not change header or footer.
- Do not change canonical URL.
- Do not change href values.
- Do not add placeholder text.
- Do not break valid HTML.

You may only make these changes:

A. AI Summary Enhancement
Inside section id="ai-summary-section":
- Keep the existing H2.
- Keep the Quick Answer label.
- Ensure the answer is clean, direct and readable.
- Add one definition paragraph after the first answer paragraph:

<p><strong>Definition:</strong> [Service] in [Location] is the process of creating high-performing, conversion-focused websites that generate enquiries from local customers.</p>

Adapt [Service] and [Location] using the supplied context.

B. AI Citable Blocks
Inside section class="ai-citable-section":
- For each answer paragraph inside .ai-citable-block:
  - add data-ai-citable="true"
  - rewrite the paragraph to 40–70 words
  - make it direct, factual, and standalone
  - include service and location naturally where relevant

C. Entity Reinforcement
Add 2–3 natural sentences across existing body sections using this pattern:
"${ctx.businessName} provides ${ctx.service} in ${ctx.location}, helping local businesses improve visibility and generate enquiries."

Do not overuse the exact same sentence.
Insert only into existing paragraph sections, not schema, footer, header, or navigation.

D. Image SEO
For every img tag:
- keep src unchanged
- ensure alt includes service and location naturally
- add loading="lazy" if missing
- add decoding="async" if missing

E. Clean-up
- Remove duplicated full paragraphs if created by the optimiser
- Ensure HTML remains valid
- Return full HTML only`;
}

// ── Safety checks ──────────────────────────────────────────────────────────────

interface SafetyCheckResult {
  passed:  boolean;
  reasons: string[];
}

function extractCanonical(html: string): string {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
         ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return m ? m[1] : "";
}

function extractImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    srcs.push(m[1]);
  }
  return srcs;
}

function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

function countLdJson(html: string): number {
  return (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) ?? []).length;
}

function runSafetyChecks(
  originalHtml: string,
  optimisedHtml: string,
): SafetyCheckResult {
  const reasons: string[] = [];

  // 1. Not empty
  if (!optimisedHtml || optimisedHtml.trim().length === 0) {
    reasons.push("optimised HTML is empty");
  }

  // 2. Contains basic HTML structure
  if (!/<html[\s>]/i.test(optimisedHtml) && !/<body[\s>]/i.test(optimisedHtml)) {
    reasons.push("optimised HTML contains neither <html> nor <body>");
  }

  // 3. Required section IDs
  for (const id of ["hero-section", "ai-summary-section", "site-footer"]) {
    if (!optimisedHtml.includes(`id="${id}"`)) {
      reasons.push(`missing required section id="${id}"`);
    }
  }

  // 4. Canonical unchanged
  const origCanonical = extractCanonical(originalHtml);
  const newCanonical  = extractCanonical(optimisedHtml);
  if (origCanonical && origCanonical !== newCanonical) {
    reasons.push(`canonical changed: "${origCanonical}" → "${newCanonical}"`);
  }

  // 5. ld+json block count unchanged
  const origLd = countLdJson(originalHtml);
  const newLd  = countLdJson(optimisedHtml);
  if (origLd !== newLd) {
    reasons.push(`ld+json block count changed: ${origLd} → ${newLd}`);
  }

  // 6. Image srcs unchanged (all original srcs must still be present)
  const origSrcs = extractImageSrcs(originalHtml);
  const newSrcs  = new Set(extractImageSrcs(optimisedHtml));
  for (const src of origSrcs) {
    if (!newSrcs.has(src)) {
      reasons.push(`image src removed or changed: "${src}"`);
    }
  }

  // 7. Href values unchanged
  const origHrefs = extractHrefs(originalHtml);
  const newHrefsSet = new Set(extractHrefs(optimisedHtml));
  for (const href of origHrefs) {
    if (!newHrefsSet.has(href)) {
      reasons.push(`href removed or changed: "${href}"`);
    }
  }

  // 8. No placeholder tokens
  if (/\{\{[^}]*\}\}/.test(optimisedHtml)) {
    reasons.push("optimised HTML contains unreplaced placeholder tokens {{ }}");
  }

  return { passed: reasons.length === 0, reasons };
}

// ── Strip markdown fences the model may have added ────────────────────────────

function stripFences(text: string): string {
  return text
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function optimiseForAiCitation(
  html: string,
  context: AiCitationContext,
): Promise<string> {
  console.log(`  [aiCitation] ${context.location}: calling AI optimiser…`);

  const client = getClient();
  const systemPrompt = buildOptimiserPrompt(context);

  let rawResponse: string;
  try {
    const response = await client.chat.completions.create({
      model:       "gpt-4.1",
      temperature: 0.3,
      max_tokens:  32000,
      messages: [
        {
          role:    "system",
          content: systemPrompt,
        },
        {
          role:    "user",
          content: `Here is the rendered HTML page to optimise:\n\n${html}`,
        },
      ],
    });

    rawResponse = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.log(
      `  [aiCitation] ${context.location}: AI call failed — falling back to original. Reason: ${String(err)}`
    );
    return html;
  }

  if (!rawResponse.trim()) {
    console.log(
      `  [aiCitation] ${context.location}: AI returned empty response — falling back to original`
    );
    return html;
  }

  const optimisedHtml = stripFences(rawResponse);

  const check = runSafetyChecks(html, optimisedHtml);
  if (!check.passed) {
    console.log(
      `  [aiCitation] ${context.location}: safety checks failed — falling back to original. Reasons:\n` +
      check.reasons.map(r => `    - ${r}`).join("\n")
    );
    return html;
  }

  console.log(`  [aiCitation] ${context.location}: optimisation complete — safety checks passed`);
  return optimisedHtml;
}
