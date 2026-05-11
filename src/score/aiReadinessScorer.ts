/**
 * aiReadinessScorer.ts
 *
 * Unified AI Search Readiness Score framework.
 * Combines the existing QA validator and content scorer into one
 * master score with 8 weighted subscores totalling 100.
 *
 * This is an internal quality and AI-readiness evaluation system.
 * It is NOT a Google ranking predictor or AI citation guarantee.
 *
 * Score bands:
 *   90–100  Excellent – Highly structured and AI-ready
 *   75–89   Strong    – Suitable for publication
 *   60–74   Needs refinement
 *   <60     High risk of low-quality or generic output
 */

import * as cheerio from "cheerio";
import type { ContentScoreReport } from "./contentScoreTypes";
import type { QaReport } from "../validate/qaTypes";

// ── Public types ──────────────────────────────────────────────────────────────

export type AiReadinessStatus = "excellent" | "strong" | "moderate" | "weak";

export interface AiReadinessSubscore {
  key:         string;
  label:       string;
  score:       number;
  maxScore:    number;
  pct:         number;  // 0-100 for progress bars
  status:      AiReadinessStatus;
  suggestions: string[];
}

export interface AiReadinessReport {
  masterScore:       number;               // 0–100
  label:             string;               // band label
  status:            AiReadinessStatus;
  subscores:         AiReadinessSubscore[];
  strengths:         string[];
  suggestions:       string[];
  duplicateWarnings: string[];
}

export interface AiReadinessScorerInput {
  html:          string;
  location:      string;
  serviceName:   string;
  contentReport: ContentScoreReport;
  qaReport:      QaReport;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.min(Math.max(v, min), max);
}

function pct(score: number, max: number): number {
  return max === 0 ? 0 : Math.round((score / max) * 100);
}

function statusFromPct(p: number): AiReadinessStatus {
  if (p >= 88) return "excellent";
  if (p >= 70) return "strong";
  if (p >= 50) return "moderate";
  return "weak";
}

function countBody(body: string, terms: string[]): number {
  return terms.filter(t => body.includes(t.toLowerCase())).length;
}

// ── 1. AI Structure & Extraction (0–20) ──────────────────────────────────────

function scoreAiStructure(
  contentReport: ContentScoreReport,
  qaReport: QaReport,
  $: cheerio.CheerioAPI
): AiReadinessSubscore {
  const MAX = 20;

  // Base: existing aiReadiness category score maps directly (already 0–20)
  const aiCat = contentReport.categories.find(c => c.key === "aiReadiness");
  let score = aiCat?.score ?? 0;

  // Bonus checks from QA validator: AI summary section passes
  const aiChecks = qaReport.checks.filter(c => c.key.startsWith("ai."));
  const aiPasses = aiChecks.filter(c => c.status === "pass").length;
  const aiTotal  = aiChecks.length;

  // If QA summary checks all pass, confirm full score; partial fails reduce slightly
  if (aiTotal > 0) {
    const ratio = aiPasses / aiTotal;
    if (ratio < 0.6 && score > 14) score = 14;  // cap if structural issues
  }

  // FAQ quality bonus (up to 2 extra pts already in aiReadiness, just confirm)
  const faqQs = $(`#faq-section .faq-q, #faq-section h3`).length;
  if (faqQs >= 5 && score < MAX) score = Math.min(score + 1, MAX);

  score = clamp(score, 0, MAX);
  const p = pct(score, MAX);

  const suggestions: string[] = [];
  if (p < 80) suggestions.push("Ensure the Quick Answer block has a clear question heading, 2-sentence direct answer, and 4+ specific bullet points.");
  if (faqQs < 3)  suggestions.push("Add at least 3 FAQ questions in H3 format inside the FAQ section.");
  if (p < 60)  suggestions.push("Rebuild AI summary block — it is missing or incomplete, which will harm AI search extraction.");

  return { key: "aiStructure", label: "AI Structure & Extraction", score, maxScore: MAX, pct: p, status: statusFromPct(p), suggestions };
}

// ── 2. Local Relevance (0–15) ─────────────────────────────────────────────────

function scoreLocalRelevance(
  $: cheerio.CheerioAPI,
  location: string
): AiReadinessSubscore {
  const MAX  = 15;
  const body = $("body").text().toLowerCase();
  const loc  = location.toLowerCase();

  // a. Location name frequency (up to 4 pts)
  const locCount = (body.match(new RegExp(loc.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "g")) ?? []).length;
  const locScore = locCount >= 8 ? 4 : locCount >= 4 ? 3 : locCount >= 2 ? 2 : locCount >= 1 ? 1 : 0;

  // b. Nearby area / surrounding references (up to 3 pts)
  const NEARBY_SIGNALS = [
    "nearby", "surrounding", "neighbouring", "close to", "local area",
    "areas we cover", "areas we serve", "serving", "across", "throughout",
  ];
  const nearbyScore = Math.min(countBody(body, NEARBY_SIGNALS), 3);

  // c. Local context language (up to 4 pts)
  const LOCAL_CONTEXT = [
    "local", "community", "residents", "homeowners", "businesses in",
    "based in", "high street", "town centre", "village", "local businesses",
    "local customers", "local company", "in the area",
  ];
  const contextHits = countBody(body, LOCAL_CONTEXT);
  const contextScore = contextHits >= 5 ? 4 : contextHits >= 3 ? 3 : contextHits >= 1 ? 2 : 0;

  // d. Local behaviour / realistic signals (up to 4 pts)
  const BEHAVIOUR_SIGNALS = [
    "search online", "google", "looking for", "searching for",
    "can't find", "not visible", "local search", "google maps",
    "near me", "found online", "local reviews",
  ];
  const behaviourHits = countBody(body, BEHAVIOUR_SIGNALS);
  const behaviourScore = behaviourHits >= 3 ? 4 : behaviourHits >= 2 ? 3 : behaviourHits >= 1 ? 2 : 0;

  const score = clamp(locScore + nearbyScore + contextScore + behaviourScore, 0, MAX);
  const p = pct(score, MAX);

  const suggestions: string[] = [];
  if (locScore < 2) suggestions.push(`Mention ${location} more frequently throughout the page body — aim for 4–8 natural references.`);
  if (nearbyScore < 2) suggestions.push("Reference nearby towns or surrounding areas — this strengthens local relevance signals.");
  if (contextScore < 3) suggestions.push("Add more local context: mention the community, local businesses, or area-specific language.");
  if (behaviourScore < 2) suggestions.push("Include local search behaviour language (e.g. 'local businesses searching online', 'found on Google Maps').");

  return { key: "localRelevance", label: "Local Relevance", score, maxScore: MAX, pct: p, status: statusFromPct(p), suggestions };
}

// ── 3. Service Relevance (0–15) ───────────────────────────────────────────────

function scoreServiceRelevance(
  $: cheerio.CheerioAPI,
  serviceName: string
): AiReadinessSubscore {
  const MAX  = 15;
  const body = $("body").text().toLowerCase();
  const svc  = serviceName.toLowerCase();

  // a. Service name frequency (up to 3 pts)
  const svcWords  = svc.split(/\s+/).filter(w => w.length > 3);
  const svcCounts = svcWords.map(w =>
    (body.match(new RegExp(w.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), "g")) ?? []).length
  );
  const avgCount  = svcCounts.length > 0 ? svcCounts.reduce((a, b) => a + b, 0) / svcCounts.length : 0;
  const svcScore  = avgCount >= 6 ? 3 : avgCount >= 3 ? 2 : avgCount >= 1 ? 1 : 0;

  // b. Service-specific terminology — build dynamic signal list
  const SERVICE_SIGNALS: Record<string, string[]> = {
    "web design":       ["website", "design", "responsive", "mobile-friendly", "user experience", "landing page", "wordpress", "branding", "ux", "custom site"],
    "web hosting":      ["hosting", "server", "uptime", "bandwidth", "ssl", "domain", "cpanel", "managed", "cloud", "99.9%"],
    "local seo":        ["rankings", "google maps", "local search", "citations", "gmb", "google business", "backlinks", "on-page", "search visibility", "rank"],
    "email marketing":  ["campaign", "segmentation", "subject line", "open rate", "subscribers", "automation", "newsletter", "click-through", "list building", "drip"],
    "seo":              ["rankings", "search engine", "keywords", "backlinks", "on-page", "technical seo", "serp", "organic traffic", "domain authority"],
    "social media":     ["instagram", "facebook", "linkedin", "engagement", "followers", "content calendar", "posts", "reach", "social strategy"],
    "paid ads":         ["ppc", "google ads", "click-through", "cost per click", "conversion", "ad spend", "roas", "campaign", "remarketing"],
    "accountant":       ["tax", "self-assessment", "vat", "bookkeeping", "payroll", "hmrc", "accounts", "corporation tax", "financial"],
    "plumber":          ["plumbing", "boiler", "leak", "drain", "pipes", "installation", "emergency", "heating", "bathroom"],
    "electrician":      ["electrical", "wiring", "circuit", "fuse", "installation", "rewire", "testing", "pat", "certificate"],
  };

  // Find best-matching service key
  let termSignals: string[] = [];
  for (const [key, signals] of Object.entries(SERVICE_SIGNALS)) {
    if (svc.includes(key) || key.includes(svc)) {
      termSignals = signals;
      break;
    }
  }
  // Generic fallback: just use common service language
  if (termSignals.length === 0) {
    termSignals = ["our service", "we provide", "we offer", "specialist", "professional", "deliver", "solution", "package", "bespoke"];
  }

  const termHits  = countBody(body, termSignals);
  const termScore = termHits >= 6 ? 6 : termHits >= 4 ? 5 : termHits >= 2 ? 3 : termHits >= 1 ? 1 : 0;

  // c. Service-specific CTA relevance (up to 3 pts)
  const ctaText = $(".cta-section, #enquiry-section, #cta-section").text().toLowerCase();
  const CTA_SERVICE_MATCH = svcWords.some(w => ctaText.includes(w));
  const ctaScore = CTA_SERVICE_MATCH ? 3 : ctaText.length > 50 ? 1 : 0;

  // d. Business pain points relevant to service (up to 3 pts)
  const PAIN_SIGNALS = [
    "struggle", "problem", "challenge", "without", "losing", "miss out",
    "not visible", "can't", "falling behind", "costly", "risk",
  ];
  const painHits  = countBody(body, PAIN_SIGNALS);
  const painScore = painHits >= 3 ? 3 : painHits >= 1 ? 2 : 0;

  const score = clamp(svcScore + termScore + ctaScore + painScore, 0, MAX);
  const p = pct(score, MAX);

  const suggestions: string[] = [];
  if (svcScore < 2)   suggestions.push(`Mention "${serviceName}" more explicitly throughout the body — aim for 5+ natural references.`);
  if (termScore < 3)  suggestions.push(`Use more ${serviceName}-specific terminology — avoid generic language that could apply to any service.`);
  if (ctaScore < 2)   suggestions.push("Ensure the CTA section references the specific service clearly, not just generic enquiry language.");
  if (painScore < 2)  suggestions.push("Add relevant pain points or challenges that your target customer faces — this improves service relevance.");

  return { key: "serviceRelevance", label: "Service Relevance", score, maxScore: MAX, pct: p, status: statusFromPct(p), suggestions };
}

// ── 4. Human Readability (0–10) ───────────────────────────────────────────────

function scoreHumanReadability(contentReport: ContentScoreReport): AiReadinessSubscore {
  const MAX    = 10;
  const rdCat  = contentReport.categories.find(c => c.key === "readability");
  const score  = clamp(rdCat?.score ?? 0, 0, MAX);
  const p      = pct(score, MAX);

  const suggestions: string[] = [];
  if (p < 70) suggestions.push("Reduce average sentence length to under 20 words — shorter sentences improve readability.");
  if (p < 50) suggestions.push("Break long paragraphs into 2–3 sentence chunks and add more bullet lists for scannability.");
  if (p < 40) suggestions.push("Add a heading (H2/H3) at least every 120–150 words to help readers navigate the page.");

  return { key: "humanReadability", label: "Human Readability", score, maxScore: MAX, pct: p, status: statusFromPct(p), suggestions };
}

// ── 5. Internal Structure & Linking (0–10) ────────────────────────────────────

function scoreInternalStructure(qaReport: QaReport): AiReadinessSubscore {
  const MAX = 10;

  // Combine structure, link and resource checks from the QA report
  const structureChecks = qaReport.checks.filter(c =>
    c.key.startsWith("structure.") || c.key.startsWith("links.") || c.key.startsWith("resources.")
  );

  if (structureChecks.length === 0) {
    return { key: "internalStructure", label: "Internal Structure & Linking", score: 5, maxScore: MAX, pct: 50, status: "moderate", suggestions: ["Run full validation to assess structural completeness."] };
  }

  const passes  = structureChecks.filter(c => c.status === "pass").length;
  const warns   = structureChecks.filter(c => c.status === "warning").length;
  const total   = structureChecks.length;
  const earned  = passes + warns * 0.5;
  const score   = clamp(Math.round((earned / total) * MAX), 0, MAX);
  const p       = pct(score, MAX);

  const suggestions: string[] = [];
  const fails = structureChecks.filter(c => c.status === "fail");
  if (fails.length > 0) {
    const firstFew = fails.slice(0, 2).map(f => f.message);
    firstFew.forEach(msg => suggestions.push(msg));
  }
  if (p < 70) suggestions.push("Ensure Related Services and Areas We Cover sections are present with working links.");
  if (p < 50) suggestions.push("Check all required section IDs are rendered — missing sections indicate a template issue.");

  return { key: "internalStructure", label: "Internal Structure & Linking", score, maxScore: MAX, pct: p, status: statusFromPct(p), suggestions };
}

// ── 6. Conversion Quality (0–10) ──────────────────────────────────────────────

function scoreConversionQuality(contentReport: ContentScoreReport): AiReadinessSubscore {
  const MAX   = 10;
  const ciCat = contentReport.categories.find(c => c.key === "commercialIntent");
  const icCat = contentReport.categories.find(c => c.key === "intentCoverage");

  // commercialIntent is 0–20, intentCoverage trust portion ~4pts — combine and scale to 10
  const ciScore  = ciCat?.score ?? 0;  // 0–20
  const icScore  = icCat?.score ?? 0;  // 0–20
  const combined = ciScore + (icScore * 0.25); // weight commercialIntent heavier
  const score    = clamp(Math.round((combined / 25) * MAX), 0, MAX);
  const p        = pct(score, MAX);

  const suggestions: string[] = [];
  if (p < 80) suggestions.push("Add 2–3 stronger CTA phrases (e.g. 'Request a free quote', 'Speak to our team today').");
  if (p < 65) suggestions.push("Include more outcome-driven language: revenue, leads, enquiries, new clients, business growth.");
  if (p < 50) suggestions.push("Reframe section content around business results — every section should have a commercial reason to act.");

  return { key: "conversionQuality", label: "Conversion Quality", score, maxScore: MAX, pct: p, status: statusFromPct(p), suggestions };
}

// ── 7. Google SEO Fundamentals (0–10) ─────────────────────────────────────────

function scoreGoogleSeo($: cheerio.CheerioAPI, contentReport: ContentScoreReport): AiReadinessSubscore {
  const MAX = 10;
  let score = 0;

  // a. Meta title (2 pts)
  const metaTitle = $("title").text().trim();
  if (metaTitle.length >= 20) score += 2;
  else if (metaTitle.length > 0) score += 1;

  // b. Meta description (2 pts)
  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  if (metaDesc.length >= 80) score += 2;
  else if (metaDesc.length > 0) score += 1;

  // c. H1 present (1 pt)
  if ($("h1").length > 0) score += 1;

  // d. Schema / JSON-LD (2 pts)
  const hasSchema = $('script[type="application/ld+json"]').length > 0;
  if (hasSchema) score += 2;
  else if ($('[itemtype]').length > 0) score += 1; // microdata fallback

  // e. Image alt tags (1 pt)
  const images = $("img").toArray();
  const imagesWithAlt = images.filter(el => {
    const alt = $(el).attr("alt");
    return alt && alt.trim().length > 2;
  }).length;
  if (images.length > 0 && imagesWithAlt / images.length >= 0.8) score += 1;
  else if (images.length === 0) score += 1; // no images → not a penalty

  // f. Canonical URL (1 pt)
  const canonical = $('link[rel="canonical"]').attr("href") ?? "";
  if (canonical.length > 0) score += 1;

  // Adjust with keyword usage quality
  const kwCat = contentReport.categories.find(c => c.key === "keywordUsage");
  if (kwCat && kwCat.percentage >= 80) score = Math.min(score + 1, MAX);

  score = clamp(score, 0, MAX);
  const p = pct(score, MAX);

  const suggestions: string[] = [];
  if (metaTitle.length < 20)   suggestions.push("Add or improve the meta title — it should be 50–60 characters and include the primary keyword.");
  if (metaDesc.length < 80)    suggestions.push("Add a meta description of 130–160 characters that summarises the page and includes the primary keyword.");
  if (!hasSchema)              suggestions.push("Add JSON-LD schema markup (LocalBusiness or Service type) to improve Google rich result eligibility.");
  if (images.length > 0 && imagesWithAlt < images.length) suggestions.push("Add descriptive alt text to all images — include the location and service where natural.");
  if (!canonical)              suggestions.push("Add a canonical URL tag to prevent duplicate content indexing issues.");

  return { key: "googleSeo", label: "Google SEO Fundamentals", score, maxScore: MAX, pct: p, status: statusFromPct(p), suggestions };
}

// ── 8. Duplicate Risk & Variation (0–10) ──────────────────────────────────────

function scoreDuplicateRisk(
  $: cheerio.CheerioAPI,
  contentReport: ContentScoreReport
): AiReadinessSubscore {
  const MAX = 10;

  // Base: map existing uniqueness score (0–15) to (0–10)
  const uniqCat  = contentReport.categories.find(c => c.key === "uniqueness");
  let score      = uniqCat ? Math.round((uniqCat.score / 15) * 10) : 5;

  const warnings: string[] = [];

  // Per-page pattern checks: repeated openings, repeated CTA wording, repetitive phrasing
  const sections = [
    "#ai-summary-section",
    "#split-section-one",
    "#split-section-two",
    "#about-section",
    "#faq-section",
  ];

  // Extract first sentence of each section and check for high word overlap
  const firstSentences = sections.map(id => {
    const text = $(`${id}`).text().trim();
    return text.split(/[.!?]/)[0]?.toLowerCase().trim() ?? "";
  }).filter(s => s.length > 20);

  // Check for repeated CTA phrases across multiple sections
  const CTA_TEMPLATES = [
    "get in touch", "contact us today", "enquire now", "speak to us", "call us today",
    "reach out", "message us",
  ];
  const allText = $("body").text().toLowerCase();
  const ctaRepetitions = CTA_TEMPLATES.filter(cta => {
    const matches = allText.match(new RegExp(cta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? [];
    return matches.length >= 3;
  });

  if (ctaRepetitions.length >= 2) {
    score = Math.max(score - 2, 0);
    warnings.push(`Repeated CTA wording detected: "${ctaRepetitions[0]}" and "${ctaRepetitions[1]}" appear 3+ times each.`);
  } else if (ctaRepetitions.length === 1) {
    score = Math.max(score - 1, 0);
    warnings.push(`Repeated CTA wording: "${ctaRepetitions[0]}" appears 3+ times — vary the call-to-action language.`);
  }

  // Check for identical opening words across sections (semantic pattern repetition)
  const openingWords = firstSentences.map(s => s.split(/\s+/).slice(0, 4).join(" "));
  const uniqueOpenings = new Set(openingWords);
  if (openingWords.length >= 3 && uniqueOpenings.size < openingWords.length * 0.6) {
    score = Math.max(score - 1, 0);
    warnings.push("Multiple sections start with similar phrasing — vary section openings for better content differentiation.");
  }

  // Check for repeated 5-gram patterns (beyond expected template similarity)
  const bodyWords = allText.replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 3);
  const fiveGrams: Record<string, number> = {};
  for (let i = 0; i < bodyWords.length - 4; i++) {
    const gram = bodyWords.slice(i, i + 5).join(" ");
    fiveGrams[gram] = (fiveGrams[gram] ?? 0) + 1;
  }
  const highRepeatGrams = Object.values(fiveGrams).filter(count => count >= 3).length;
  if (highRepeatGrams >= 10) {
    score = Math.max(score - 2, 0);
    warnings.push("High phrase repetition detected — significant repeated sentence patterns across the page.");
  } else if (highRepeatGrams >= 5) {
    score = Math.max(score - 1, 0);
    warnings.push("Some repeated phrasing patterns detected — review section body content for repeated templates.");
  }

  score = clamp(score, 0, MAX);
  const p = pct(score, MAX);

  const suggestions: string[] = [];
  if (p < 80) suggestions.push("Vary CTA language across sections — avoid using the same phrase more than twice.");
  if (p < 65) suggestions.push("Review each section opening line — avoid starting multiple sections with the same words or structure.");
  if (p < 50) suggestions.push("Significant repetition risk — regenerate with explicit variety instructions to reduce templated phrasing.");

  return {
    key: "duplicateRisk",
    label: "Duplicate Risk & Variation",
    score,
    maxScore: MAX,
    pct: p,
    status: statusFromPct(p),
    suggestions,
    // expose warnings for the caller
    ...(warnings.length > 0 ? { _warnings: warnings } : {}),
  } as AiReadinessSubscore & { _warnings?: string[] };
}

// ── Score band label ──────────────────────────────────────────────────────────

function bandLabel(score: number): { label: string; status: AiReadinessStatus } {
  if (score >= 90) return { label: "Excellent",         status: "excellent" };
  if (score >= 75) return { label: "Strong",            status: "strong"    };
  if (score >= 60) return { label: "Needs refinement",  status: "moderate"  };
  return                  { label: "High risk",         status: "weak"      };
}

// ── Narrative: strengths & suggestions ───────────────────────────────────────

function buildNarrative(subscores: AiReadinessSubscore[]): {
  strengths:   string[];
  suggestions: string[];
} {
  const strengths:   string[] = [];
  const suggestions: string[] = [];

  const STRENGTH_LABELS: Record<string, string> = {
    aiStructure:       "strong AI summary structure and extractable answer blocks",
    localRelevance:    "strong local context with area-specific language and references",
    serviceRelevance:  "clear service-specific content and relevant terminology",
    humanReadability:  "excellent readability with well-structured, scannable copy",
    internalStructure: "complete internal structure with working section links",
    conversionQuality: "strong conversion focus with clear CTAs and outcome language",
    googleSeo:         "solid technical SEO fundamentals (meta, schema, headings)",
    duplicateRisk:     "low duplication risk with strong variation across sections",
  };

  const IMPROVEMENT_LABELS: Record<string, string> = {
    aiStructure:       "improve AI summary block structure and FAQ quality",
    localRelevance:    "add more local context, area references and behavioural signals",
    serviceRelevance:  "increase service-specific terminology and relevant pain points",
    humanReadability:  "improve readability — shorten sentences and break up paragraphs",
    internalStructure: "fix missing sections or broken internal links",
    conversionQuality: "strengthen CTA language and add outcome-focused copy",
    googleSeo:         "add or improve meta title, meta description, and schema markup",
    duplicateRisk:     "reduce repeated phrasing and vary CTA and section openings",
  };

  for (const sub of subscores) {
    if (sub.status === "excellent" || sub.status === "strong") {
      const label = STRENGTH_LABELS[sub.key];
      if (label) strengths.push(label);
    } else if (sub.status === "moderate" || sub.status === "weak") {
      const label = IMPROVEMENT_LABELS[sub.key];
      if (label) suggestions.push(label);
    }
  }

  return { strengths, suggestions };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function scoreAiReadiness(input: AiReadinessScorerInput): AiReadinessReport {
  const { html, location, serviceName, contentReport, qaReport } = input;
  const $ = cheerio.load(html);

  const sub1 = scoreAiStructure(contentReport, qaReport, $);
  const sub2 = scoreLocalRelevance($, location);
  const sub3 = scoreServiceRelevance($, serviceName);
  const sub4 = scoreHumanReadability(contentReport);
  const sub5 = scoreInternalStructure(qaReport);
  const sub6 = scoreConversionQuality(contentReport);
  const sub7 = scoreGoogleSeo($, contentReport);
  const sub8 = scoreDuplicateRisk($, contentReport);

  const subscores: AiReadinessSubscore[] = [sub1, sub2, sub3, sub4, sub5, sub6, sub7, sub8];

  const masterScore = clamp(
    subscores.reduce((sum, s) => sum + s.score, 0),
    0,
    100
  );

  const { label, status } = bandLabel(masterScore);
  const { strengths, suggestions } = buildNarrative(subscores);

  // Collect duplicate warnings from sub8 (extended type)
  const dupSub = sub8 as AiReadinessSubscore & { _warnings?: string[] };
  const duplicateWarnings = dupSub._warnings ?? [];

  return { masterScore, label, status, subscores, strengths, suggestions, duplicateWarnings };
}
