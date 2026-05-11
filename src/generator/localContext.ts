/**
 * localContext.ts
 *
 * Local Context Injection System
 *
 * Builds a LocalAreaContext from AreaContentSignals and generates a
 * section-specific prompt block that instructs the AI to weave local
 * signals naturally into page content — without keyword-stuffing,
 * template repetition or forced area mentions.
 *
 * Rules enforced via the prompt:
 *   - 3–4 local context references maximum per page
 *   - Nearby areas rotated — never repeat the same pair across mentions
 *   - "In {area}" phrasing limited to at most twice across the whole page
 *   - Example phrases provided per section; model must rephrase, not copy
 *   - Graceful fallback when nearbyAreas data is unavailable
 */

import type { AreaContentSignals, AffluenceTier } from "../area/areaTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LocalAreaContext {
  /** Area name exactly as used in page titles */
  area: string;
  /** 2–4 nearby/neighbouring area names — empty array when unavailable */
  nearbyAreas: string[];
  /** Dominant business types present in this area */
  businessTypes: string;
  /** General character and feel of the area */
  environment: string;
  /** How local customers typically search for and choose this type of service */
  customerBehaviour: string;
}

// ── Customer behaviour derivation ─────────────────────────────────────────────

/**
 * Derives a realistic local customer behaviour description from the area's
 * affluence tier and competition level.
 *
 * Used to populate the Behaviour Insight section of the prompt block so
 * the model can frame audiences around how they actually make decisions
 * in this specific area — not generic buyer persona copy.
 */
function deriveCustomerBehaviour(
  affluence: AffluenceTier,
  competitionNote: string,
): string {
  const isHighComp = /competitive market|high competition/i.test(competitionNote);
  const isLowComp  = /few established competitors|relatively few/i.test(competitionNote);

  if (affluence === "premium" && isHighComp) {
    return (
      "research multiple providers carefully before committing, " +
      "prioritise reputation and proven results, and are willing to pay a " +
      "premium for quality and reliability — generic claims rarely land"
    );
  }
  if (affluence === "premium") {
    return (
      "seek out established, reputable providers — credentials, case studies " +
      "and visible expertise carry more weight than price alone"
    );
  }
  if (affluence === "professional" && isHighComp) {
    return (
      "compare options online before reaching out, look for clear evidence of " +
      "expertise and demonstrable outcomes, and expect professional communication from the outset"
    );
  }
  if (affluence === "professional") {
    return (
      "look for reliable, credentialed providers with a demonstrable track record — " +
      "clear process explanations and professional communication are key decision factors"
    );
  }
  if (affluence === "mixed" && isHighComp) {
    return (
      "weigh quality against value carefully, check local reviews and examples of past " +
      "work, and typically contact two or three providers before making a final decision"
    );
  }
  if (affluence === "mixed") {
    return (
      "balance price and quality when choosing a provider — transparent pricing and honest " +
      "explanations of process and timelines build trust quickly in this market"
    );
  }
  if (affluence === "community" && isLowComp) {
    return (
      "rely heavily on local word-of-mouth and personal recommendations, and strongly " +
      "prefer businesses they can identify as genuinely rooted in the local community"
    );
  }
  // community + medium or high competition
  return (
    "favour providers with strong local ties and visible community presence — " +
    "referrals and local reviews carry significantly more weight than brand awareness"
  );
}

// ── Context builder ───────────────────────────────────────────────────────────

/**
 * Builds a LocalAreaContext from AreaContentSignals.
 *
 * All fields include safe fallbacks so generation never fails when data
 * is partially populated (e.g. simple config/areas/*.json format where
 * nearbyAreas and character may be absent).
 */
export function buildLocalAreaContext(
  signals: AreaContentSignals,
): LocalAreaContext {
  return {
    area:             signals.area,
    nearbyAreas:      (signals.nearbyAreas ?? []).slice(0, 4),
    businessTypes:    signals.businessType || "local businesses",
    environment:      signals.character    || signals.localContext || "a local community",
    customerBehaviour: deriveCustomerBehaviour(
      signals.affluence,
      signals.competitionNote ?? "",
    ),
  };
}

// ── Prompt block builder ──────────────────────────────────────────────────────

/**
 * Generates the LOCAL CONTEXT INJECTION prompt block appended to the master
 * generation prompt when area signals are available.
 *
 * Gives the model:
 *   1. Structured local data (area, neighbours, businesses, environment, behaviour)
 *   2. Section-specific guidance mapping each data point to the right content section
 *   3. Varied example phrases per section (model must rephrase, not copy verbatim)
 *   4. Mandatory variation and quality rules
 *   5. Fallback instruction when nearbyAreas is unavailable
 */
export function buildLocalContextPromptBlock(ctx: LocalAreaContext): string {
  const { area, nearbyAreas, businessTypes, environment, customerBehaviour } = ctx;

  const hasNearby = nearbyAreas.length >= 2;
  const nearbyStr = hasNearby ? nearbyAreas.join(", ") : "not available";

  // Build varied nearby-area example phrases — use different area pairs each time
  // so the AI has concrete models to rephrase from
  const nearbyExamples = hasNearby
    ? [
        `"Whether you're based in ${area} or a nearby area like ${nearbyAreas[0]}${nearbyAreas[1] ? ` or ${nearbyAreas[1]}` : ""}…"`,
        nearbyAreas[2]
          ? `"Serving ${area}, ${nearbyAreas[0]} and ${nearbyAreas[2]} and the wider area…"`
          : `"Serving ${area} and the surrounding communities…"`,
        nearbyAreas[1] && nearbyAreas[2]
          ? `"Covering ${area}, ${nearbyAreas[1]} and ${nearbyAreas[2]}…"`
          : `"Businesses across ${area} and nearby areas…"`,
      ].map(ex => `    • ${ex}`).join("\n")
    : `    • Reference ${area} naturally — do not fabricate neighbouring areas`;

  const fallbackNote = !hasNearby
    ? `\n  NOTE: No nearby areas are available for ${area}. Use natural local phrasing that references ${area} only — do not invent or guess neighbouring locations.`
    : "";

  return (
    `\n\nLOCAL CONTEXT INJECTION — weave into content naturally (3–4 uses maximum across the whole page):\n\n` +
    `Data:\n` +
    `  Area              : ${area}\n` +
    `  Nearby areas      : ${nearbyStr}\n` +
    `  Business types    : ${businessTypes}\n` +
    `  Area environment  : ${environment}\n` +
    `  Customer behaviour: ${customerBehaviour}\n` +
    `${fallbackNote}\n` +
    `\nSection-by-section guidance:\n\n` +

    `1. heroIntro / aiSummaryIntro (Introduction)\n` +
    `   Mention nearby areas once, woven naturally into the opening:\n` +
    `${nearbyExamples}\n` +
    `   Use only 2 nearby areas per mention — never list all of them at once.\n\n` +

    `2. competitionSection / localRelevanceSection (Local Context Block)\n` +
    `   Ground local competition in the specific business types present in the area:\n` +
    `    • "Businesses across ${area} — from ${businessTypes} — are competing for the same local customers…"\n` +
    `    • "From ${businessTypes} to professional services, standing out in ${area} takes more than a basic presence…"\n\n` +

    `3. split1 / whoItsFor / commonMistakes (Behaviour Insight)\n` +
    `   Frame the problem or audience through how local customers actually decide:\n` +
    `    • "In ${area}, customers ${customerBehaviour}…"\n` +
    `    • "Most people looking for this in ${area} will ${customerBehaviour} before committing…"\n\n` +

    `4. split2 / enquirySection (Environment and Problem Framing)\n` +
    `   Use the area environment to ground the challenge in local reality:\n` +
    `    • "In an area like ${area} — ${environment} — the need for this service is not abstract…"\n` +
    `    • "Many in ${area} face this challenge precisely because ${environment}…"\n\n` +

    `Mandatory variation rules:\n` +
    `  - Use "In ${area}" phrasing AT MOST twice across the entire page output\n` +
    `  - When referencing nearby areas, choose DIFFERENT area pairs for each mention — never repeat the same two\n` +
    `  - The example phrases above are starting points — rephrase them naturally, do not copy verbatim\n` +
    `  - Every local reference must read as if written by someone who knows ${area} well\n` +
    `  - Do NOT insert area mentions where they interrupt the natural flow of a sentence\n` +
    `  - If a section does not benefit from a local reference, omit it — quality over coverage`
  );
}
