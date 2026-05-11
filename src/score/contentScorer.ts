/**
 * contentScorer.ts
 *
 * Content quality and ranking potential scorer for local SEO pages.
 * Second analysis layer after the structural QA validator — this proves
 * content is strong enough to rank, not just built correctly.
 *
 * Usage:
 *   import { scoreContent } from "./contentScorer";
 *   const report = scoreContent(input);
 */

import * as cheerio from "cheerio";
import type {
  CategoryScore,
  CategoryStatus,
  ContentScoreInput,
  ContentScoreReport,
} from "./contentScoreTypes";

// ── Utility helpers ───────────────────────────────────────────────────────────

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function countMatches(body: string, signals: string[]): number {
  return signals.filter((s) => body.includes(s)).length;
}

/** Build a CategoryScore from raw earned points. */
function makeCategory(
  key: string,
  earned: number,
  maxScore: number,
  messages: Record<CategoryStatus, string>
): CategoryScore {
  const clamped    = Math.min(Math.max(earned, 0), maxScore);
  const percentage = Math.round((clamped / maxScore) * 100);
  const status: CategoryStatus =
    percentage >= 85 ? "excellent" :
    percentage >= 65 ? "good"      :
    percentage >= 45 ? "moderate"  : "weak";
  return { key, score: clamped, maxScore, percentage, status, message: messages[status] };
}

// ── Section text extractor ────────────────────────────────────────────────────

function sectionText($: cheerio.CheerioAPI, id: string): string {
  return cleanText($(`#${id}`).text());
}

function allBodyText($: cheerio.CheerioAPI): string {
  return cleanText($("body").text()).toLowerCase();
}

// ── A. UNIQUENESS — max 15 ────────────────────────────────────────────────────

function scoreUniqueness($: cheerio.CheerioAPI, pageType: "hub" | "cluster"): CategoryScore {
  const MAX = 15;

  const sectionIds = pageType === "hub"
    ? ["split-section-one", "split-section-two", "about-section",
       "definition-section", "process-section", "local-relevance-section",
       "internal-links-section", "faq-section", "ai-summary-section"]
    : ["split-section-one", "split-section-two", "about-section",
       "areas-we-cover-section", "faq-section", "ai-summary-section"];

  const sectionTexts = sectionIds
    .map((id) => sectionText($, id).toLowerCase())
    .filter((t) => t.length > 60);

  // Extract 3-grams from text
  const ngrams = (text: string): Set<string> => {
    const w = text.split(/\s+/);
    const out = new Set<string>();
    for (let i = 0; i <= w.length - 3; i++) {
      const gram = `${w[i]} ${w[i + 1]} ${w[i + 2]}`;
      // Ignore grams that are mostly stop words
      if (!/^(the|a|an|is|are|of|in|and|to|for|this|that|it|we|you|our|your)\s/.test(gram)) {
        out.add(gram);
      }
    }
    return out;
  };

  // Count how many sections each 3-gram appears in
  const gramSectionCount: Record<string, number> = {};
  for (const text of sectionTexts) {
    const grams = ngrams(text);
    for (const g of grams) {
      gramSectionCount[g] = (gramSectionCount[g] ?? 0) + 1;
    }
  }

  const crossSectionRepeats = Object.values(gramSectionCount).filter((c) => c >= 3).length;

  const earned =
    crossSectionRepeats === 0 ? 15 :
    crossSectionRepeats <= 2  ? 12 :
    crossSectionRepeats <= 5  ? 9  :
    crossSectionRepeats <= 10 ? 5  : 2;

  return makeCategory("uniqueness", earned, MAX, {
    excellent: "Excellent content uniqueness — each section delivers distinct, original messaging.",
    good:      "Good content uniqueness with minimal phrase overlap across sections.",
    moderate:  "Some repeated phrasing detected across sections — consider diversifying the messaging.",
    weak:      "Significant phrase repetition across sections — content feels templated and may harm rankings.",
  });
}

// ── B. INTENT COVERAGE — max 20 ───────────────────────────────────────────────

function scoreIntentCoverage(
  $: cheerio.CheerioAPI,
  input: ContentScoreInput
): CategoryScore {
  const MAX  = 20;
  const body = allBodyText($);

  const WHY_SIGNALS = [
    "fall behind", "miss out", "losing", "risk", "costly", "without a website",
    "without a", "competitors", "competition", "struggling", "problem",
    "challenge", "not visible", "invisible", "can't find you",
    "can't be found", "falling behind", "missed", "lose potential",
  ];
  const WHAT_SIGNALS = [
    "includes", "we deliver", "we build", "we create", "we design",
    "we provide", "our service", "we offer", "you receive", "you get",
    "features", "delivers", "produces", "covers", "package",
  ];
  const OUTCOME_SIGNALS = [
    "enquiries", "leads", "revenue", "growth", "results", "conversions",
    "customers", "clients", "bookings", "sales", "new business",
    "more calls", "more enquiries", "generate", "attract", "win",
  ];
  const TRUST_SIGNALS = [
    "years experience", "years of experience", "experienced", "professional",
    "experts", "specialists", "trusted", "established", "proven",
    "track record", "uk-based", "based in", "registered",
  ];

  const whyHits     = countMatches(body, WHY_SIGNALS);
  const whatHits    = countMatches(body, WHAT_SIGNALS);
  const outcomeHits = countMatches(body, OUTCOME_SIGNALS);
  const localHit    = body.includes(input.location.toLowerCase()) ? 1 : 0;
  const trustHits   = countMatches(body, TRUST_SIGNALS);

  const whyScore     = whyHits >= 2     ? 4 : whyHits === 1     ? 2 : 0;
  const whatScore    = whatHits >= 2    ? 4 : whatHits === 1    ? 2 : 0;
  const outcomeScore = outcomeHits >= 3 ? 4 : outcomeHits >= 1  ? 2 : 0;
  const localScore   = localHit         ? 4                     : 0;
  const trustScore   = trustHits >= 2   ? 4 : trustHits === 1   ? 2 : 0;

  const earned = whyScore + whatScore + outcomeScore + localScore + trustScore;

  return makeCategory("intentCoverage", earned, MAX, {
    excellent: "Outstanding intent coverage — why, what, outcomes, local context, and trust signals all present.",
    good:      "Good intent coverage with most key themes addressed across the page.",
    moderate:  "Partial intent coverage — some key themes (why/what/outcomes/local/trust) are missing or underdeveloped.",
    weak:      "Weak intent coverage — content lacks clear problem framing, outcomes, or local relevance.",
  });
}

// ── C. COMMERCIAL INTENT — max 20 ─────────────────────────────────────────────

function scoreCommercialIntent($: cheerio.CheerioAPI): CategoryScore {
  const MAX  = 20;
  const body = allBodyText($);

  const CTA_PHRASES = [
    "contact us", "get in touch", "enquire today", "enquire now",
    "request a quote", "book a call", "speak to us", "call us today",
    "get started", "start today", "free consultation", "let's talk",
    "send us a message", "drop us a message",
  ];
  const BUSINESS_GROWTH_PHRASES = [
    "grow your business", "business growth", "generate enquiries",
    "more customers", "new clients", "attract customers",
    "increase revenue", "online presence", "return on investment",
    "more enquiries", "drive traffic", "more leads",
  ];
  const ENQUIRY_WORDS = [
    "enquiries", "enquire", "contact", "reach out",
    "message us", "phone us", "email us",
  ];
  const ACTION_VERBS = [
    "get", "start", "find out", "discover", "see how", "learn how",
    "take the next step", "take action", "don't wait",
  ];

  const ctaHits      = countMatches(body, CTA_PHRASES);
  const growthHits   = countMatches(body, BUSINESS_GROWTH_PHRASES);
  const enquiryHits  = countMatches(body, ENQUIRY_WORDS);
  const actionHits   = countMatches(body, ACTION_VERBS);
  const ctaButtons   = $(".btn, .btn-white").length;

  const ctaScore     = ctaHits >= 2       ? 5 : ctaHits >= 1     ? 3 : 0;
  const growthScore  = growthHits >= 3    ? 5 : growthHits >= 1  ? 2 : 0;
  const enquiryScore = enquiryHits >= 3   ? 5 : enquiryHits >= 1 ? 2 : 0;
  const actionScore  = (actionHits >= 2 || ctaButtons >= 2) ? 5 :
                       (actionHits >= 1 || ctaButtons >= 1) ? 2 : 0;

  const earned = ctaScore + growthScore + enquiryScore + actionScore;

  return makeCategory("commercialIntent", earned, MAX, {
    excellent: "Strong commercial positioning — page clearly drives enquiries and business outcomes.",
    good:      "Good commercial intent with clear calls to action and business language.",
    moderate:  "Moderate commercial intent — content could be more direct about outcomes and enquiries.",
    weak:      "Weak commercial positioning — content is too generic or informational; add stronger CTAs and outcome language.",
  });
}

// ── D. AI READINESS — max 20 ──────────────────────────────────────────────────

function scoreAiReadiness($: cheerio.CheerioAPI): CategoryScore {
  const MAX = 20;
  let earned = 0;

  // 1. AI summary section structure (up to 8 pts)
  const $aiSection = $("#ai-summary-section");
  if ($aiSection.length > 0) {
    earned += 2; // section exists

    const hasLabel   = $aiSection.find(".quick-answer-label").length > 0;
    const hasBullets = $aiSection.find("ul li").length >= 2;
    const hasH2      = $aiSection.find("h2").length > 0;
    const hasPara    = $aiSection.find("p").length >= 2;

    if (hasLabel)   earned += 2;
    if (hasBullets) earned += 2;
    if (hasH2)      earned += 1;
    if (hasPara)    earned += 1;
  }

  // 2. Heading quality — H2s are descriptive (4+ words) (up to 6 pts)
  const h2s = $("h2").toArray();
  const descriptiveH2s = h2s.filter((el) => words($("body").find(el).text()).length >= 4).length;
  const h2Ratio = h2s.length > 0 ? descriptiveH2s / h2s.length : 0;
  earned += Math.round(h2Ratio * 6);

  // 3. Bullet/list usage across sections (up to 4 pts)
  const totalLiItems = $("body ul li, body ol li").length;
  earned += totalLiItems >= 10 ? 4 : totalLiItems >= 5 ? 2 : totalLiItems >= 1 ? 1 : 0;

  // 4. FAQ section has questions in H3 format (up to 2 pts)
  const faqQuestions = $("#faq-section .faq-q, #faq-section h3").length;
  earned += faqQuestions >= 3 ? 2 : faqQuestions >= 1 ? 1 : 0;

  return makeCategory("aiReadiness", earned, MAX, {
    excellent: "Excellent AI readiness — direct answers, structured bullets, and clear headings for AI extraction.",
    good:      "Good AI readiness with clear structure and well-formed AI summary block.",
    moderate:  "Moderate AI readiness — improve heading specificity or bullet list structure for better AI extraction.",
    weak:      "Poor AI readiness — content lacks direct answers, clear structure, or extractable AI summary.",
  });
}

// ── E. KEYWORD USAGE QUALITY — max 15 ────────────────────────────────────────

function scoreKeywordUsage(
  $: cheerio.CheerioAPI,
  input: ContentScoreInput
): CategoryScore {
  const MAX      = 15;
  const body     = allBodyText($);
  const bodyWords = words($("body").text());
  const kw       = input.primaryKeyword.toLowerCase();
  const kwWords  = words(kw);

  // Primary keyword density
  let kwCount = 0;
  for (let i = 0; i <= bodyWords.length - kwWords.length; i++) {
    if (kwWords.every((w, j) => bodyWords[i + j] === w)) kwCount++;
  }
  const density = bodyWords.length > 0 ? (kwCount / bodyWords.length) * 100 : 0;

  // Ideal density 0.5–3%; reward natural usage; penalise stuffing
  const densityScore =
    density >= 0.5 && density < 3  ? 4 :
    density >= 3   && density < 5  ? 2 :
    density >= 0.1 && density < 0.5 ? 1 : 0;

  // Primary keyword in H1
  const h1HasKw = $("h1").first().text().toLowerCase().includes(kw);
  const h1Score = h1HasKw ? 3 : 0;

  // Primary keyword in at least 2 H2 headings
  const h2sWithKw = $("h2").toArray().filter((el) =>
    $(el).text().toLowerCase().includes(kw)
  ).length;
  const h2Score = h2sWithKw >= 2 ? 3 : h2sWithKw === 1 ? 1 : 0;

  // Supporting keywords — natural distribution (reward breadth not depth)
  const foundSupporting = input.supportingKeywords.filter((sk) =>
    body.includes(sk.toLowerCase())
  ).length;
  const supportingRatio = input.supportingKeywords.length > 0
    ? foundSupporting / input.supportingKeywords.length
    : 0;
  const supportingScore =
    input.supportingKeywords.length === 0  ? 2 : // no keywords to check — neutral
    supportingRatio >= 0.75                ? 5 :
    supportingRatio >= 0.5                 ? 3 :
    supportingRatio >= 0.25                ? 1 : 0;

  const earned = densityScore + h1Score + h2Score + supportingScore;

  return makeCategory("keywordUsage", earned, MAX, {
    excellent: "Excellent keyword usage — natural density, strong heading placement, and good supporting keyword coverage.",
    good:      "Good keyword usage with primary keyword well-placed and supporting terms present.",
    moderate:  "Moderate keyword usage — improve primary keyword density or supporting keyword distribution.",
    weak:      "Weak keyword usage — primary keyword poorly placed or over-stuffed; supporting keywords largely absent.",
  });
}

// ── F. READABILITY — max 10 ───────────────────────────────────────────────────

function scoreReadability($: cheerio.CheerioAPI): CategoryScore {
  const MAX       = 10;
  const bodyEl    = $("body");
  const bodyRaw   = cleanText(bodyEl.text());

  // Strip CSS/script noise by targeting the actual content sections
  const $content  = $("section, article, main, footer");
  const contentTxt = cleanText($content.text());

  const sentenceList = sentences(contentTxt);
  const wordList     = words(contentTxt);
  const paraEls      = $("p").toArray().filter((el) => $(el).text().trim().length > 40);
  const listItems    = $("ul li, ol li").length;
  const h2Count      = $("h2").length;

  // 1. Average sentence length (ideal ≤ 25 words)
  const avgSentenceWords = sentenceList.length > 0
    ? sentenceList.reduce((sum, s) => sum + words(s).length, 0) / sentenceList.length
    : 30;
  const sentenceScore =
    avgSentenceWords <= 18 ? 3 :
    avgSentenceWords <= 25 ? 2 :
    avgSentenceWords <= 32 ? 1 : 0;

  // 2. Paragraph length (ideal ≤ 5 sentences / para)
  const avgParaSentences = paraEls.length > 0
    ? paraEls.reduce((sum, el) => sum + sentences($(el).text()).length, 0) / paraEls.length
    : 5;
  const paraScore =
    avgParaSentences <= 3 ? 3 :
    avgParaSentences <= 5 ? 2 :
    avgParaSentences <= 7 ? 1 : 0;

  // 3. Scannability: ratio of list items to paragraphs (ideal ≥ 0.25)
  const scanRatio = paraEls.length > 0 ? listItems / paraEls.length : 0;
  const scanScore = scanRatio >= 0.5 ? 2 : scanRatio >= 0.25 ? 1 : 0;

  // 4. Heading frequency (≥ 1 H2 per 150 words)
  const wordsPerHeading = h2Count > 0 ? wordList.length / h2Count : Infinity;
  const headingScore = wordsPerHeading <= 100 ? 2 : wordsPerHeading <= 150 ? 1 : 0;

  const earned = sentenceScore + paraScore + scanScore + headingScore;

  return makeCategory("readability", earned, MAX, {
    excellent: "Excellent readability — short sentences, concise paragraphs, and great use of lists and headings.",
    good:      "Good readability with well-structured content that is easy to scan.",
    moderate:  "Moderate readability — reduce paragraph length or add more lists and headings to improve scannability.",
    weak:      "Poor readability — content is dense and hard to scan; break it up with shorter paragraphs and bullet lists.",
  });
}

// ── RATING BAND ───────────────────────────────────────────────────────────────

function ratingBand(score: number): string {
  if (score >= 90) return "High Ranking Potential";
  if (score >= 75) return "Good Ranking Potential";
  if (score >= 60) return "Moderate Ranking Potential";
  return "Weak Ranking Potential";
}

// ── STRENGTHS / ISSUES / RECOMMENDATIONS ─────────────────────────────────────

function buildNarrative(categories: CategoryScore[]): {
  strengths:       string[];
  issues:          string[];
  recommendations: string[];
} {
  const strengths:       string[] = [];
  const issues:          string[] = [];
  const recommendations: string[] = [];

  for (const cat of categories) {
    switch (cat.key) {
      case "uniqueness":
        if (cat.status === "excellent" || cat.status === "good") {
          strengths.push("Each section delivers distinct messaging — no noticeable phrase repetition across the page.");
        } else if (cat.status === "moderate") {
          issues.push("Some repeated phrasing detected across sections.");
          recommendations.push("Review split-section-one and split-section-two for repeated ideas — keep WHY and WHAT strictly separate.");
        } else {
          issues.push("Significant phrase repetition across multiple sections — content feels repetitive.");
          recommendations.push("Audit each section independently. Split1 should cover problems/risks only; Split2 should cover solutions/deliverables only.");
        }
        break;

      case "intentCoverage":
        if (cat.status === "excellent" || cat.status === "good") {
          strengths.push("Content covers why the service matters, what is delivered, outcomes, local context, and trust signals.");
        } else if (cat.status === "moderate") {
          issues.push("Some intent themes are underdeveloped — the page may not address all buyer questions.");
          recommendations.push("Add outcome language (e.g. 'generate enquiries', 'attract new clients') and ensure local context is woven through the copy.");
        } else {
          issues.push("Intent coverage is weak — major buyer motivations (why/what/outcomes/trust) are missing.");
          recommendations.push("Regenerate content with stronger problem framing, clear deliverables, and specific business outcome language.");
        }
        break;

      case "commercialIntent":
        if (cat.status === "excellent" || cat.status === "good") {
          strengths.push("Content is commercially focused with clear calls to action and business outcome language.");
        } else if (cat.status === "moderate") {
          issues.push("Commercial intent is moderate — the page could push harder toward enquiry-generating language.");
          recommendations.push("Add 2–3 stronger CTA phrases and increase outcome language (revenue, leads, enquiries, clients).");
        } else {
          issues.push("Page lacks commercial focus — reads as informational rather than lead-generating.");
          recommendations.push("Rewrite section headings and body copy to emphasise business results. Every section should have a commercial reason to act.");
        }
        break;

      case "aiReadiness":
        if (cat.status === "excellent" || cat.status === "good") {
          strengths.push("AI summary block is well-structured with direct answers and extractable bullets.");
        } else if (cat.status === "moderate") {
          issues.push("AI summary or heading structure could be improved for better AI search extraction.");
          recommendations.push("Ensure the ai-summary section has a clear question heading, 'Quick Answer' label, concise answer, and 3–4 specific bullet points.");
        } else {
          issues.push("Content is not well-structured for AI search engines — direct answers and clear headings are missing.");
          recommendations.push("Rebuild the ai-summary block with a specific question, direct 2-sentence answer, and 4 bullets covering the key service outcomes.");
        }
        break;

      case "keywordUsage":
        if (cat.status === "excellent" || cat.status === "good") {
          strengths.push("Primary keyword is placed naturally and supporting keywords are distributed well.");
        } else if (cat.status === "moderate") {
          issues.push("Keyword usage is inconsistent — primary keyword may be underused or supporting keywords are sparse.");
          recommendations.push("Ensure the primary keyword appears in H1, at least one H2, and the first 100 words of body content.");
        } else {
          issues.push("Keyword usage is weak — primary keyword is missing from key positions or the content is over-stuffed.");
          recommendations.push("Target a primary keyword density of 1–2.5%. Add supporting keywords naturally across split sections and FAQ answers.");
        }
        break;

      case "readability":
        if (cat.status === "excellent" || cat.status === "good") {
          strengths.push("Content is easy to read and scan with good use of short sentences, lists, and headings.");
        } else if (cat.status === "moderate") {
          issues.push("Readability needs improvement — some paragraphs or sentences are too long.");
          recommendations.push("Keep sentences under 25 words. Break long paragraphs into 2–3 sentence chunks. Use more bullet points.");
        } else {
          issues.push("Content is hard to read — dense paragraphs and long sentences reduce engagement.");
          recommendations.push("Rewrite dense sections with shorter sentences and bullet lists. Aim for 1 heading per 120 words of content.");
        }
        break;
    }
  }

  return { strengths, issues, recommendations };
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function scoreContent(input: ContentScoreInput): ContentScoreReport {
  const $ = cheerio.load(input.html);

  const categories: CategoryScore[] = [
    scoreUniqueness($, input.pageType),
    scoreIntentCoverage($, input),
    scoreCommercialIntent($),
    scoreAiReadiness($),
    scoreKeywordUsage($, input),
    scoreReadability($),
  ];

  const totalEarned   = categories.reduce((sum, c) => sum + c.score, 0);
  const totalPossible = categories.reduce((sum, c) => sum + c.maxScore, 0);
  const overallScore  = Math.round((totalEarned / totalPossible) * 100);
  const rating        = ratingBand(overallScore);
  const passed        = overallScore >= 60;

  const { strengths, issues, recommendations } = buildNarrative(categories);

  return { overallScore, rating, passed, categories, strengths, issues, recommendations };
}
