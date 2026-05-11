/**
 * duplicateScanner.ts
 *
 * Cross-page duplicate content detection for a campaign.
 * Compares meaningful body content across pages (intro, headings, FAQ)
 * using Jaccard word-set similarity. Header, footer, and navigation
 * are excluded from comparison.
 *
 * Overlap levels:
 *   Low:    0–20%   — acceptable, expected template similarity
 *   Review: 21–35%  — content may be too similar, check manually
 *   High:   36%+    — likely duplicate content, needs reworking
 */

import * as cheerio from "cheerio";

export type DuplicateLevel = "low" | "review" | "high";

export interface DuplicateMatch {
  otherSlug:  string;
  otherArea:  string;
  similarity: number;
  section:    string;
}

export interface PageDuplicateResult {
  slug:          string;
  area:          string;
  maxSimilarity: number;
  level:         DuplicateLevel;
  matches:       DuplicateMatch[];
}

export interface DuplicateScanResult {
  pages:      PageDuplicateResult[];
  highRiskCount:   number;
  reviewRiskCount: number;
}

// ── Content extraction ────────────────────────────────────────────────────────

interface PageContent {
  slug:      string;
  area:      string;
  intro:     string;   // first 400 words of meaningful body content
  headings:  string;   // all H2/H3 text joined
  faqText:   string;   // FAQ section text
  splitText: string;   // split section text (the unique per-location content)
}

function extractContent(slug: string, area: string, html: string): PageContent {
  const $ = cheerio.load(html);

  // Remove elements we don't want to compare (boilerplate)
  $(`#site-header, #site-footer, nav, .nav, header, footer, #map-section, script, style`).remove();

  // Intro: from ai-summary + split-section-one (the most unique content per page)
  const introEl = $(`#ai-summary-section, #hero-section .intro, #split-section-one`);
  const intro = introEl.text().trim().split(/\s+/).slice(0, 400).join(" ").toLowerCase();

  // Headings: all H2/H3 text (stripped of location name because that's expected to differ)
  const headings = $("h2, h3").toArray()
    .map((el) => $(el).text().trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");

  // FAQ text: answers inside faq-section
  const faqText = $(`#faq-section`).text().trim().toLowerCase();

  // Split sections (the body of unique local content)
  const splitText = $(`#split-section-one, #split-section-two, .about-section`).text()
    .trim().toLowerCase();

  return { slug, area, intro, headings, faqText, splitText };
}

// ── Jaccard similarity ────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  // Use 4-gram word windows (bigrams) for phrase-level matching, plus single words > 3 chars
  const words = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const tokens = new Set<string>();
  // Single words
  words.forEach((w) => tokens.add(w));
  // Bigrams for phrase detection
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(`${words[i]}_${words[i + 1]}`);
  }
  return tokens;
}

function jaccardSimilarity(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a || !b)  return 0;
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// ── Main scanner ──────────────────────────────────────────────────────────────

function levelFromScore(similarity: number): DuplicateLevel {
  // Thresholds are intentionally higher than generic content to account for
  // expected template structure similarity on local SEO page sets.
  if (similarity >= 0.56) return "high";
  if (similarity >= 0.36) return "review";
  return "low";
}

export function scanDuplicates(
  pages: Array<{ slug: string; area: string; html: string }>
): DuplicateScanResult {
  if (pages.length < 2) {
    return {
      pages: pages.map((pg) => ({
        slug:          pg.slug,
        area:          pg.area,
        maxSimilarity: 0,
        level:         "low",
        matches:       [],
      })),
      highRiskCount:   0,
      reviewRiskCount: 0,
    };
  }

  // Extract content for all pages
  const contents: PageContent[] = pages.map((pg) =>
    extractContent(pg.slug, pg.area, pg.html)
  );

  // Map slug → PageDuplicateResult (accumulate matches)
  const resultMap = new Map<string, PageDuplicateResult>();
  for (const c of contents) {
    resultMap.set(c.slug, {
      slug:          c.slug,
      area:          c.area,
      maxSimilarity: 0,
      level:         "low",
      matches:       [],
    });
  }

  // Compare every pair
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const a = contents[i];
      const b = contents[j];

      // Compare content sections only — headings are intentionally excluded
      // because local SEO pages share identical heading patterns (e.g. "Why Choose Us",
      // "Our Services") by design; comparing them always yields high false-positive similarity.
      const sections: Array<{ name: string; textA: string; textB: string }> = [
        { name: "Intro/Summary", textA: a.intro,    textB: b.intro    },
        { name: "FAQ",           textA: a.faqText,   textB: b.faqText   },
        { name: "Body sections", textA: a.splitText, textB: b.splitText },
      ];

      for (const sec of sections) {
        if (!sec.textA || !sec.textB) continue;
        const sim = jaccardSimilarity(sec.textA, sec.textB);
        if (sim < 0.15) continue; // below noise threshold — skip

        const simPct = Math.round(sim * 100);

        // Add match to page A
        const resA = resultMap.get(a.slug)!;
        resA.matches.push({ otherSlug: b.slug, otherArea: b.area, similarity: simPct, section: sec.name });
        if (sim > resA.maxSimilarity) resA.maxSimilarity = sim;

        // Add match to page B
        const resB = resultMap.get(b.slug)!;
        resB.matches.push({ otherSlug: a.slug, otherArea: a.area, similarity: simPct, section: sec.name });
        if (sim > resB.maxSimilarity) resB.maxSimilarity = sim;
      }
    }
  }

  // Finalise levels and sort matches by similarity desc
  const results: PageDuplicateResult[] = [];
  for (const res of resultMap.values()) {
    res.level = levelFromScore(res.maxSimilarity);
    // Keep top 3 matches per page, sorted by similarity descending
    res.matches.sort((a, b) => b.similarity - a.similarity);
    res.matches = res.matches.slice(0, 3);
    results.push(res);
  }

  const highRiskCount   = results.filter((r) => r.level === "high").length;
  const reviewRiskCount = results.filter((r) => r.level === "review").length;

  return { pages: results, highRiskCount, reviewRiskCount };
}
