/**
 * aiReadinessScore.ts
 *
 * Post-generation AI Readiness Scoring System.
 * Scores a generated page HTML from 0–100 across 6 categories.
 * Pages with blocking issues are prevented from deployment.
 *
 * Categories:
 *   1. AI Answer Quality       — 20 pts
 *   2. Intent Coverage         — 20 pts
 *   3. Commercial Strength     — 20 pts
 *   4. Content Depth           — 15 pts
 *   5. SEO & Keyword Usage     — 15 pts
 *   6. UX & Readability        — 10 pts
 *
 * Status thresholds:
 *   90–100 = Elite  (publish ready)
 *   75–89  = Good   (publish allowed)
 *   60–74  = Weak   (review required — publish allowed with warning)
 *   0–59   = Fail   (blocked from publish)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiReadinessStatus = "elite" | "good" | "weak" | "fail";

export interface CategoryScore {
  name:      string;
  maxPoints: number;
  scored:    number;
  details:   string[];
}

export interface AiReadinessResult {
  score:            number;
  status:           AiReadinessStatus;
  publishBlocked:   boolean;
  breakdown:        CategoryScore[];
  blockingIssues:   string[];
  warnings:         string[];
  recommendedFixes: string[];
  wordCount:        number;
  generatedAt:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractSection(html: string, className: string): string | null {
  const idx = html.indexOf(`class="${className}"`);
  if (idx === -1) return null;
  // Walk forward to find the enclosing </section> or </aside> or </div>
  const sectionStart = html.lastIndexOf("<", idx);
  const closing = html.indexOf("</section>", sectionStart);
  if (closing === -1) return null;
  return html.slice(sectionStart, closing + "</section>".length);
}

// ── Main Scorer ───────────────────────────────────────────────────────────────

export function scoreAiReadiness(html: string): AiReadinessResult {
  const blockingIssues: string[] = [];
  const warnings:        string[] = [];
  const recommendedFixes: string[] = [];

  const bodyText  = stripHtml(html);
  const totalWords = wordCount(bodyText);

  // ──────────────────────────────────────────────────────────────────────────
  // BLOCKING ISSUE CHECKS
  // Pages with any blocking issue have publishBlocked=true regardless of score.
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Empty anchor tags
  if (/<a\b[^>]*>\s*<\/a>/i.test(html)) {
    blockingIssues.push("Empty anchor tag — broken link present in page content.");
  }

  // 2. Unresolved template placeholders
  const placeholders = [...new Set(html.match(/\{\{[A-Z_]{2,}\}\}/g) ?? [])];
  if (placeholders.length > 0) {
    blockingIssues.push(`Unresolved template tokens: ${placeholders.slice(0, 4).join(", ")}`);
  }

  // 3. Missing AI summary section
  const aiSummaryCount = (html.match(/id="ai-summary-section"/g) ?? []).length;
  if (aiSummaryCount === 0) {
    blockingIssues.push("AI summary section is missing (id=\"ai-summary-section\" not found).");
  }

  // 4. Duplicate AI answer sections
  if (aiSummaryCount > 1) {
    blockingIssues.push(`Duplicate AI summary sections: ${aiSummaryCount} instances of id="ai-summary-section".`);
  }

  // 5. Relative canonical
  const canonicalMatch = html.match(/<link\s[^>]*rel="canonical"[^>]*href="([^"]+)"/);
  if (!canonicalMatch) {
    blockingIssues.push("Canonical URL tag is missing entirely.");
  } else if (!canonicalMatch[1].startsWith("https://")) {
    blockingIssues.push(`Canonical URL is relative: "${canonicalMatch[1]}" — must be an absolute HTTPS URL.`);
  }

  // 6. Truncated or missing meta description
  const metaDescMatch = html.match(/<meta\s[^>]*name="description"[^>]*content="([^"]+)"/);
  if (!metaDescMatch) {
    blockingIssues.push("Meta description tag is missing.");
  } else {
    const desc = metaDescMatch[1];
    if (!/[.?!]$/.test(desc)) {
      blockingIssues.push(`Meta description is truncated — ends with "…${desc.slice(-40)}" (must end with sentence-ending punctuation).`);
    }
  }

  // 7. Page under 800 words
  if (totalWords < 800) {
    blockingIssues.push(`Page is too thin: only ${totalWords} words — minimum is 800 words.`);
  }

  // 8. Broken images (empty src)
  if (/<img\b[^>]*\bsrc\s*=\s*""\s*[^>]*>/i.test(html)) {
    blockingIssues.push("Broken image found: <img> tag has an empty src attribute.");
  }

  // 9. Broken internal links (empty href or bare "#")
  const emptyHrefCount = (html.match(/<a\b[^>]*\bhref\s*=\s*""\s*[^>]*>/gi) ?? []).length;
  const hashHrefCount  = (html.match(/<a\b[^>]*\bhref\s*=\s*"#"\s*[^>]*>/gi) ?? []).length;
  const brokenLinks = emptyHrefCount + hashHrefCount;
  if (brokenLinks > 0) {
    blockingIssues.push(`${brokenLinks} internal link(s) with empty or "#" href — fix before publishing.`);
  }

  // 10. Broken sentence — comma immediately before closing </p>
  if (/,\s*<\/p>/i.test(html)) {
    blockingIssues.push("Broken sentence detected: at least one paragraph ends with a trailing comma.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: AI Answer Quality — 20 pts
  // ──────────────────────────────────────────────────────────────────────────
  const cat1: CategoryScore = { name: "AI Answer Quality", maxPoints: 20, scored: 0, details: [] };

  // AI summary section present — 5 pts
  if (aiSummaryCount === 1) {
    cat1.scored += 5;
    cat1.details.push("AI summary section present (+5)");
  } else {
    cat1.details.push("AI summary section missing (0)");
    recommendedFixes.push("Ensure the AI summary section has id=\"ai-summary-section\".");
  }

  // AI summary word count — 5 pts
  const aiSection = extractSection(html, "cluster-ai-summary") ?? html.match(/id="ai-summary-section"[\s\S]*?<\/section>/)?.[0] ?? "";
  const aiWords = wordCount(stripHtml(aiSection));
  if (aiWords >= 80) {
    cat1.scored += 5;
    cat1.details.push(`AI summary intro ≥80 words (${aiWords} words) (+5)`);
  } else if (aiWords >= 50) {
    cat1.scored += 2;
    cat1.details.push(`AI summary intro short (${aiWords} words, target ≥80) (+2)`);
    warnings.push(`AI summary intro is only ${aiWords} words — expand to 80+ words for better AI extraction.`);
  } else {
    cat1.details.push(`AI summary intro very short (${aiWords} words) (0)`);
    warnings.push("AI summary intro is very thin — it must be at least 80 words covering 5 key angles.");
  }

  // AI summary bullets — 3 pts
  const bulletCount = (html.match(/class="cluster-ai-bullet"/g) ?? []).length;
  if (bulletCount >= 3) {
    cat1.scored += 3;
    cat1.details.push(`AI summary bullets: ${bulletCount} present (+3)`);
  } else if (bulletCount > 0) {
    cat1.scored += 1;
    cat1.details.push(`Only ${bulletCount} AI bullet(s) found — target is 3–4 (+1)`);
    warnings.push(`AI summary has only ${bulletCount} bullet(s) — add at least 3 concrete benefit bullets.`);
  } else {
    cat1.details.push("No AI summary bullets found (0)");
    warnings.push("AI summary is missing benefit bullets — add 3–4 concrete outcome bullets.");
  }

  // Intent clusters section present — 4 pts
  const intentSectionPresent = html.includes('class="cluster-intent-clusters"');
  if (intentSectionPresent) {
    cat1.scored += 4;
    cat1.details.push("Intent clusters section present (+4)");
  } else {
    cat1.details.push("Intent clusters section missing (0)");
    recommendedFixes.push("Add the intent clusters section with Q&A blocks for pricing, process, local, and comparison questions.");
  }

  // Intent clusters have ≥ 4 items — 3 pts
  const intentItemCount = (html.match(/class="cluster-intent-item"/g) ?? []).length;
  if (intentItemCount >= 4) {
    cat1.scored += 3;
    cat1.details.push(`Intent clusters: ${intentItemCount} questions present (+3)`);
  } else if (intentItemCount >= 2) {
    cat1.scored += 1;
    cat1.details.push(`Intent clusters: only ${intentItemCount} questions (target ≥4) (+1)`);
    warnings.push(`Intent clusters has only ${intentItemCount} Q&A blocks — add the missing questions.`);
  } else {
    cat1.details.push(`Intent clusters: ${intentItemCount} question(s) — too few (0)`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: Intent Coverage — 20 pts
  // ──────────────────────────────────────────────────────────────────────────
  const cat2: CategoryScore = { name: "Intent Coverage", maxPoints: 20, scored: 0, details: [] };

  // 4 intent items present — 8 pts
  if (intentItemCount >= 4) {
    cat2.scored += 8;
    cat2.details.push("All 4 intent questions present (+8)");
  } else if (intentItemCount >= 2) {
    cat2.scored += 4;
    cat2.details.push(`${intentItemCount}/4 intent questions present (+4)`);
    recommendedFixes.push(`Add ${4 - intentItemCount} more intent Q&A block(s): pricing, process, local advantage, comparison.`);
  } else if (intentItemCount === 1) {
    cat2.scored += 2;
    cat2.details.push("Only 1 intent question present (+2)");
  } else {
    cat2.details.push("No intent questions found (0)");
  }

  // Average answer length — 12 pts
  // Measure word counts from cluster-intent-answer divs
  const intentAnswerMatches = [...html.matchAll(/class="cluster-intent-answer"([\s\S]*?)(?=<div class="cluster-intent-item"|<\/div>\s*<\/div>\s*<\/section>)/g)];
  const intentAnswerWords = intentAnswerMatches.map(m => wordCount(stripHtml(m[0])));

  // Fall back to cluster-intent-item p tags if answer div not found
  const legacyAnswerMatches = intentAnswerWords.length === 0
    ? [...html.matchAll(/class="cluster-intent-item"[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map(m => wordCount(stripHtml(m[1] ?? "")))
    : intentAnswerWords;

  if (legacyAnswerMatches.length > 0) {
    const avgWords = legacyAnswerMatches.reduce((a, b) => a + b, 0) / legacyAnswerMatches.length;
    const shortCount = legacyAnswerMatches.filter(w => w < 100).length;
    if (avgWords >= 100 && shortCount === 0) {
      cat2.scored += 12;
      cat2.details.push(`All intent answers ≥100 words (avg ${Math.round(avgWords)} words) (+12)`);
    } else if (avgWords >= 100 && shortCount <= 1) {
      cat2.scored += 8;
      cat2.details.push(`Intent answers mostly meet target (avg ${Math.round(avgWords)} words) (+8)`);
      if (shortCount > 0) warnings.push(`${shortCount} intent answer(s) are under 100 words — expand each to 100–180 words.`);
    } else if (avgWords >= 80) {
      cat2.scored += 4;
      cat2.details.push(`Intent answers average ${Math.round(avgWords)} words (target ≥100) (+4)`);
      warnings.push(`${shortCount} intent answer(s) under 100 words — all should be 100–180 words for AI extraction.`);
    } else {
      cat2.scored += 2;
      cat2.details.push(`Intent answers too short (avg ${Math.round(avgWords)} words) (+2)`);
      recommendedFixes.push("Expand all intent cluster answers to at least 100 words — each must be standalone and AI-extractable.");
    }
  } else {
    cat2.details.push("Could not measure intent answer word counts (0)");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: Commercial Strength — 20 pts
  // ──────────────────────────────────────────────────────────────────────────
  const cat3: CategoryScore = { name: "Commercial Strength", maxPoints: 20, scored: 0, details: [] };

  // H1 present and non-empty — 3 pts
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text  = h1Match ? stripHtml(h1Match[1]).trim() : "";
  if (h1Text.length > 5) {
    cat3.scored += 3;
    cat3.details.push(`H1 present: "${h1Text.slice(0, 60)}" (+3)`);
  } else {
    cat3.details.push("H1 missing or empty (0)");
    recommendedFixes.push("Add a keyword-rich H1 in the hero section.");
  }

  // CTA button — 4 pts
  const ctaPresent = /<a\b[^>]*\bclass="[^"]*\bbtn\b[^"]*"[^>]*>/i.test(html);
  if (ctaPresent) {
    cat3.scored += 4;
    cat3.details.push("CTA button (class=btn) present (+4)");
  } else {
    cat3.details.push("CTA button not found (0)");
    recommendedFixes.push("Add a primary CTA button with class=\"btn\" to drive enquiries.");
  }

  // Enquiry section — 4 pts
  if (html.includes('id="enquiry-section"')) {
    cat3.scored += 4;
    cat3.details.push("Enquiry section present (+4)");
  } else {
    cat3.details.push("Enquiry section missing (0)");
    recommendedFixes.push("Add an enquiry section explaining how the service generates leads and conversions.");
  }

  // No-website consequences — 3 pts
  if (html.includes('id="no-website-section"') || html.includes('class="no-website-section"')) {
    cat3.scored += 3;
    cat3.details.push("No-website consequences section present (+3)");
  } else {
    cat3.details.push("No-website section missing (0)");
    warnings.push("Missing no-website consequences section — add urgency messaging about the cost of inaction.");
  }

  // Competition section — 3 pts
  if (html.includes('id="competition-section"') || html.includes('class="competition-section"')) {
    cat3.scored += 3;
    cat3.details.push("Competition section present (+3)");
  } else {
    cat3.details.push("Competition section missing (0)");
    warnings.push("Missing competition section — add local competitor context and opportunity gap messaging.");
  }

  // FAQ with questions — 3 pts
  const faqItemCount = (html.match(/class="[^"]*cluster-faq-item[^"]*"|<details\b/gi) ?? []).length;
  const faqHeadingPresent = /id="faq-section"|FAQ|Frequently Asked/i.test(html);
  if (faqHeadingPresent && faqItemCount >= 3) {
    cat3.scored += 3;
    cat3.details.push(`FAQ section with ${faqItemCount} questions present (+3)`);
  } else if (faqHeadingPresent && faqItemCount >= 1) {
    cat3.scored += 1;
    cat3.details.push(`FAQ section present but only ${faqItemCount} question(s) (+1)`);
    warnings.push("FAQ section has fewer than 3 questions — add pricing, timeline, results, and local advantage Q&As.");
  } else {
    cat3.details.push("FAQ section not found (0)");
    recommendedFixes.push("Add a FAQ section with at least 4 questions matching search intent (cost, timeline, results, local).");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 4: Content Depth & Uniqueness — 15 pts
  // ──────────────────────────────────────────────────────────────────────────
  const cat4: CategoryScore = { name: "Content Depth & Uniqueness", maxPoints: 15, scored: 0, details: [] };

  // What's Included — 4 pts
  const includedCardCount = (html.match(/class="included-card"/g) ?? []).length;
  if (includedCardCount >= 4) {
    cat4.scored += 4;
    cat4.details.push(`What's Included: ${includedCardCount} deliverable cards (+4)`);
  } else if (includedCardCount >= 2) {
    cat4.scored += 2;
    cat4.details.push(`What's Included: only ${includedCardCount} cards (target ≥4) (+2)`);
    warnings.push("What's Included section needs at least 4 deliverable cards.");
  } else if (includedCardCount === 1) {
    cat4.scored += 1;
    cat4.details.push("What's Included: 1 card only (+1)");
  } else {
    cat4.details.push("What's Included section missing (0)");
    recommendedFixes.push("Add a What's Included section with 5–6 service deliverable cards.");
  }

  // Who It's For — 4 pts
  const audienceCardCount = (html.match(/class="audience-card"/g) ?? []).length;
  if (audienceCardCount >= 4) {
    cat4.scored += 4;
    cat4.details.push(`Who It's For: ${audienceCardCount} audience cards (+4)`);
  } else if (audienceCardCount >= 2) {
    cat4.scored += 2;
    cat4.details.push(`Who It's For: only ${audienceCardCount} cards (target ≥4) (+2)`);
    warnings.push("Who It's For needs at least 4 business type cards.");
  } else if (audienceCardCount === 1) {
    cat4.scored += 1;
    cat4.details.push("Who It's For: 1 card only (+1)");
  } else {
    cat4.details.push("Who It's For section missing (0)");
    recommendedFixes.push("Add a Who It's For section with 4–5 relevant local business types.");
  }

  // Local Relevance section — 4 pts
  const localRelSection = extractSection(html, "local-relevance-section");
  if (localRelSection) {
    const lrWords = wordCount(stripHtml(localRelSection));
    if (lrWords >= 120) {
      cat4.scored += 4;
      cat4.details.push(`Local Relevance section: ${lrWords} words (+4)`);
    } else if (lrWords >= 60) {
      cat4.scored += 2;
      cat4.details.push(`Local Relevance section: only ${lrWords} words (target ≥100) (+2)`);
      warnings.push(`Local Relevance section is only ${lrWords} words — expand to 120+ words with area-specific detail.`);
    } else {
      cat4.scored += 1;
      cat4.details.push(`Local Relevance section: very short (${lrWords} words) (+1)`);
    }
  } else {
    cat4.details.push("Local Relevance section missing (0)");
    recommendedFixes.push("Add a Local Relevance section referencing the local economy, search behaviour, and nearby areas.");
  }

  // Common Mistakes section — 3 pts
  const mistakeItemCount = (html.match(/class="mistake-item"/g) ?? []).length;
  if (mistakeItemCount >= 4) {
    cat4.scored += 3;
    cat4.details.push(`Common Mistakes: ${mistakeItemCount} items (+3)`);
  } else if (mistakeItemCount >= 2) {
    cat4.scored += 2;
    cat4.details.push(`Common Mistakes: ${mistakeItemCount} items (target ≥4) (+2)`);
    warnings.push("Common Mistakes section should have at least 4–5 items.");
  } else if (mistakeItemCount === 1) {
    cat4.scored += 1;
    cat4.details.push("Common Mistakes: 1 item only (+1)");
  } else {
    cat4.details.push("Common Mistakes section missing (0)");
    warnings.push("Add a Common Mistakes section — helps commercial credibility and AI relevance.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 5: SEO & Keyword Usage — 15 pts
  // ──────────────────────────────────────────────────────────────────────────
  const cat5: CategoryScore = { name: "SEO & Keyword Usage", maxPoints: 15, scored: 0, details: [] };

  // Meta description — 6 pts total
  if (metaDescMatch) {
    const desc = metaDescMatch[1];
    cat5.scored += 2;
    cat5.details.push("Meta description present (+2)");
    if (desc.length >= 90 && desc.length <= 165) {
      cat5.scored += 2;
      cat5.details.push(`Meta description length: ${desc.length} chars (target 90–160) (+2)`);
    } else if (desc.length >= 70) {
      cat5.scored += 1;
      cat5.details.push(`Meta description length: ${desc.length} chars (target 140–160) (+1)`);
      warnings.push(`Meta description is ${desc.length} chars — aim for 140–160 chars for maximum snippet visibility.`);
    } else {
      cat5.details.push(`Meta description too short: ${desc.length} chars (0)`);
      warnings.push("Meta description is very short — aim for 140–160 characters including keyword and benefit.");
    }
    if (/[.?!]$/.test(desc)) {
      cat5.scored += 2;
      cat5.details.push("Meta description ends with complete sentence (+2)");
    } else {
      cat5.details.push("Meta description does not end with full stop (0)");
    }
  } else {
    cat5.details.push("Meta description missing (0/6)");
  }

  // Canonical URL — 3 pts
  if (canonicalMatch?.[1]?.startsWith("https://")) {
    cat5.scored += 3;
    cat5.details.push("Canonical URL is absolute HTTPS (+3)");
  } else if (canonicalMatch) {
    cat5.details.push("Canonical URL is relative (0)");
  } else {
    cat5.details.push("Canonical URL missing (0)");
  }

  // Schema types — 6 pts total
  const schemaScripts = html.match(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? [];
  const schemaTypes = schemaScripts.map((s) => {
    const m = s.match(/"@type"\s*:\s*"([^"]+)"/);
    return m?.[1] ?? "unknown";
  });

  if (schemaTypes.some(t => t === "WebPage")) {
    cat5.scored += 2;
    cat5.details.push("WebPage schema present (+2)");
  } else {
    cat5.details.push("WebPage schema missing (0)");
    warnings.push("WebPage schema missing — add structured data for better visibility in AI and search.");
  }

  if (schemaTypes.some(t => t === "FAQPage")) {
    cat5.scored += 2;
    cat5.details.push("FAQPage schema present (+2)");
  } else {
    cat5.details.push("FAQPage schema missing (0)");
    warnings.push("FAQPage schema missing — add FAQ structured data to improve AI answer extraction.");
  }

  if (schemaTypes.some(t => t === "LocalBusiness" || t === "ProfessionalService")) {
    cat5.scored += 2;
    cat5.details.push("LocalBusiness / ProfessionalService schema present (+2)");
  } else {
    cat5.details.push("LocalBusiness schema missing (0)");
    warnings.push("LocalBusiness schema missing — add it to strengthen local SEO signals.");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY 6: UX & Readability — 10 pts
  // ──────────────────────────────────────────────────────────────────────────
  const cat6: CategoryScore = { name: "UX & Readability", maxPoints: 10, scored: 0, details: [] };

  // Related resource cards — 3 pts
  const resourceCardCount = (html.match(/class="resource-card"/g) ?? []).length;
  if (resourceCardCount >= 2) {
    cat6.scored += 3;
    cat6.details.push(`Related resources: ${resourceCardCount} cards (+3)`);
  } else if (resourceCardCount === 1) {
    cat6.scored += 1;
    cat6.details.push("Only 1 resource card (+1)");
    warnings.push("Add at least 2–3 related resource cards for internal linking depth.");
  } else {
    cat6.details.push("No related resource cards (0)");
    recommendedFixes.push("Add 2–3 related resource cards linking to nearby area pages.");
  }

  // H2 heading count — 2 pts
  const h2Count = (html.match(/<h2\b[^>]*>/gi) ?? []).length;
  if (h2Count >= 6) {
    cat6.scored += 2;
    cat6.details.push(`${h2Count} H2 headings (+2)`);
  } else if (h2Count >= 4) {
    cat6.scored += 1;
    cat6.details.push(`${h2Count} H2 headings (target ≥6) (+1)`);
  } else {
    cat6.details.push(`Only ${h2Count} H2 headings (0)`);
    warnings.push("Add more H2 headings to improve section structure and readability.");
  }

  // Total word count — 3 pts
  if (totalWords >= 3000) {
    cat6.scored += 3;
    cat6.details.push(`Total word count: ${totalWords} words (+3)`);
  } else if (totalWords >= 2000) {
    cat6.scored += 2;
    cat6.details.push(`Total word count: ${totalWords} words (target ≥3000) (+2)`);
    warnings.push(`Page has ${totalWords} words — aim for 3000+ for maximum content depth.`);
  } else if (totalWords >= 1200) {
    cat6.scored += 1;
    cat6.details.push(`Total word count: ${totalWords} words (target ≥2000) (+1)`);
    warnings.push(`Page has only ${totalWords} words — expand content to reach 2000+ words.`);
  } else {
    cat6.details.push(`Total word count: ${totalWords} — too low (0)`);
    recommendedFixes.push(`Page has only ${totalWords} words — add more content sections to reach 2000+.`);
  }

  // H3 heading count — 2 pts
  const h3Count = (html.match(/<h3\b[^>]*>/gi) ?? []).length;
  if (h3Count >= 6) {
    cat6.scored += 2;
    cat6.details.push(`${h3Count} H3 headings (+2)`);
  } else if (h3Count >= 3) {
    cat6.scored += 1;
    cat6.details.push(`${h3Count} H3 headings (target ≥6) (+1)`);
  } else {
    cat6.details.push(`Only ${h3Count} H3 headings (0)`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TOTALS
  // ──────────────────────────────────────────────────────────────────────────
  const breakdown = [cat1, cat2, cat3, cat4, cat5, cat6];
  const rawScore  = breakdown.reduce((sum, c) => sum + c.scored, 0);

  // Blocking issues cap the score at 59 (always "fail") regardless of content quality
  const score = blockingIssues.length > 0 ? Math.min(rawScore, 59) : rawScore;

  let status: AiReadinessStatus;
  if (score >= 90)      status = "elite";
  else if (score >= 75) status = "good";
  else if (score >= 60) status = "weak";
  else                  status = "fail";

  // Publish is blocked if there are blocking issues OR score is below 60
  const publishBlocked = blockingIssues.length > 0 || score < 60;

  return {
    score,
    status,
    publishBlocked,
    breakdown,
    blockingIssues,
    warnings,
    recommendedFixes,
    wordCount: totalWords,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Returns a concise human-readable summary line.
 * e.g. "AI Readiness: 83/100 — Good ✓ | 0 blocking | 2 warnings"
 */
export function formatAiReadinessSummary(result: AiReadinessResult): string {
  const statusLabel: Record<AiReadinessStatus, string> = {
    elite: "Elite — publish ready",
    good:  "Good — publish allowed",
    weak:  "Weak — review required",
    fail:  "FAIL — publish blocked",
  };
  const blocked = result.publishBlocked ? " | PUBLISH BLOCKED" : "";
  return `AI Readiness: ${result.score}/100 — ${statusLabel[result.status]} | ${result.blockingIssues.length} blocking | ${result.warnings.length} warning(s)${blocked}`;
}
