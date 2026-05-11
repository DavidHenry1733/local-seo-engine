/**
 * qaValidator.ts
 *
 * Validates a rendered local SEO page (hub or cluster) against a full
 * suite of QA rules covering structure, AI summary ordering, keyword
 * placement, internal links, trust signals, map embed, and resource cards.
 *
 * Usage:
 *   import { validatePage } from "./qaValidator";
 *   const report = validatePage(input);
 */

import * as cheerio from "cheerio";
import type { QaCheck, QaReport, QaStatus, QaValidatorInput } from "./qaTypes";

// ── Check builder helpers ─────────────────────────────────────────────────────

function makeCheck(
  key: string,
  status: QaStatus,
  message: string,
  sectionId?: string
): QaCheck {
  return sectionId ? { key, status, message, sectionId } : { key, status, message };
}

function pass(key: string, message: string, sectionId?: string): QaCheck {
  return makeCheck(key, "pass", message, sectionId);
}

function warn(key: string, message: string, sectionId?: string): QaCheck {
  return makeCheck(key, "warning", message, sectionId);
}

function fail(key: string, message: string, sectionId?: string): QaCheck {
  return makeCheck(key, "fail", message, sectionId);
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function bodyText($: cheerio.CheerioAPI): string {
  return $("body").text().toLowerCase();
}

function hasText($: cheerio.CheerioAPI, text: string): boolean {
  return bodyText($).includes(text.toLowerCase());
}

function hasHref($: cheerio.CheerioAPI, url: string): boolean {
  if (!url) return false;
  const strip = (u: string) => decodeURIComponent(u).replace(/\/+$/, "").toLowerCase().trim();
  const target = strip(url);
  return $("a[href]").toArray().some((el) => {
    const href = strip((el as { attribs?: Record<string, string> }).attribs?.href ?? "");
    return href.length > 0 && (href === target || href.includes(target));
  });
}

// ── A. STRUCTURE CHECKS ───────────────────────────────────────────────────────

const HUB_SECTION_IDS = [
  "site-header",
  "hero-section",
  "ai-summary-section",
  "split-section-one",
  "split-section-two",
  "about-section",
  "competition-section",
  "no-website-section",
  "related-services-section",
  "areas-we-cover-section",
  "enquiry-section",
  "map-section",
  "faq-section",
  "cta-section",
  "trust-strip",
  "site-footer",
] as const;

const CLUSTER_SECTION_IDS = [
  "site-header",
  "hero-section",
  "ai-summary-section",
  "split-section-one",
  "split-section-two",
  "about-section",
  "related-services-section",
  "areas-we-cover-section",
  "map-section",
  "faq-section",
  "cta-section",
  "trust-strip",
  "site-footer",
] as const;

function checkStructure($: cheerio.CheerioAPI, pageType: "hub" | "cluster"): QaCheck[] {
  const ids = pageType === "hub" ? HUB_SECTION_IDS : CLUSTER_SECTION_IDS;
  return ids.map((id) =>
    $(`#${id}`).length > 0
      ? pass(`structure.${id}`, `#${id} found`, id)
      : fail(`structure.${id}`, `#${id} not found in rendered HTML`, id)
  );
}

// ── B. AI SUMMARY CHECKS ──────────────────────────────────────────────────────

function checkAiSummary($: cheerio.CheerioAPI): QaCheck[] {
  const checks: QaCheck[] = [];
  const sectionId = "ai-summary-section";
  const $section  = $(`#${sectionId}`);

  if ($section.length === 0) {
    return [fail("ai.missing", "ai-summary-section not found — cannot validate AI summary", sectionId)];
  }

  // Drill into the inner container if one exists
  const $inner = $section.find(".container").length
    ? $section.find(".container")
    : $section;

  // Collect ordered content nodes (tag names only, skip text/comment nodes)
  const orderedTags = $inner
    .children()
    .toArray()
    .map((el) => (el as { tagName?: string }).tagName?.toLowerCase() ?? "")
    .filter(Boolean);

  const h2Idx   = orderedTags.indexOf("h2");
  const ulIdx   = orderedTags.lastIndexOf("ul");
  const pIdx    = orderedTags.indexOf("p");

  // 1. Question heading (H2) is first meaningful element
  checks.push(
    h2Idx !== -1 && h2Idx === orderedTags.findIndex((t) => t !== "")
      ? pass("ai.questionFirst", "Question heading (H2) is the first element in ai-summary", sectionId)
      : fail("ai.questionFirst", "Question heading (H2) is missing or not first in ai-summary", sectionId)
  );

  // 2. Quick Answer label present and after H2
  const hasLabel = $section.find(".quick-answer-label").length > 0;
  const labelIdx = orderedTags.indexOf("p"); // label is first <p>
  checks.push(
    hasLabel && labelIdx > h2Idx
      ? pass("ai.quickAnswerLabel", '"Quick Answer" label present and after the question', sectionId)
      : fail("ai.quickAnswerLabel", '"Quick Answer" label missing or in wrong position', sectionId)
  );

  // 3. Answer paragraph (second <p>) appears after the label
  const pCount     = orderedTags.filter((t) => t === "p").length;
  const answerIdx  = orderedTags.indexOf("p", labelIdx + 1);
  checks.push(
    pCount >= 2 && answerIdx > labelIdx
      ? pass("ai.answerParagraph", "Answer paragraph present after Quick Answer label", sectionId)
      : fail("ai.answerParagraph", "Answer paragraph missing or not after Quick Answer label", sectionId)
  );

  // 4. Bullet list present and appears after the answer paragraph
  const bulletCount = $section.find("ul li").length;
  checks.push(
    ulIdx !== -1 && ulIdx > pIdx
      ? bulletCount >= 2
        ? pass("ai.bulletList", `Bullet list present after answer (${bulletCount} items)`, sectionId)
        : warn("ai.bulletList", `Bullet list present but only ${bulletCount} item(s) — expected ≥ 2`, sectionId)
      : fail("ai.bulletList", "Bullet list missing or appears before the answer paragraph", sectionId)
  );

  // 5. Overall order: H2 → label/p → ul
  const correctOrder = h2Idx !== -1 && ulIdx !== -1 && pIdx !== -1
    && h2Idx < pIdx && pIdx < ulIdx;

  checks.push(
    correctOrder
      ? pass("ai.order", "ai-summary element order is correct (question → label → answer → bullets)", sectionId)
      : fail("ai.order", "ai-summary element order is wrong — expected: question → Quick Answer → answer → bullets", sectionId)
  );

  return checks;
}

// ── C. KEYWORD CHECKS ─────────────────────────────────────────────────────────

function checkKeywords($: cheerio.CheerioAPI, input: QaValidatorInput): QaCheck[] {
  const checks: QaCheck[] = [];
  const kw = input.primaryKeyword.toLowerCase();
  const bt = bodyText($);

  // 1. Primary keyword in H1
  const h1Text = $("h1").first().text().toLowerCase();
  checks.push(
    h1Text.includes(kw)
      ? pass("keywords.primaryInH1", `Primary keyword found in H1`)
      : fail("keywords.primaryInH1", `Primary keyword "${input.primaryKeyword}" not found in H1`)
  );

  // 2. Primary keyword in hero intro paragraph
  const introText = $("#hero-section .intro").first().text().toLowerCase();
  checks.push(
    introText.includes(kw)
      ? pass("keywords.primaryInHeroIntro", "Primary keyword found in hero intro paragraph", "hero-section")
      : warn("keywords.primaryInHeroIntro", "Primary keyword not found in hero intro paragraph", "hero-section")
  );

  // 3. Primary keyword in AI answer paragraph (inside ai-summary-section)
  const aiText = $("#ai-summary-section").text().toLowerCase();
  checks.push(
    aiText.includes(kw)
      ? pass("keywords.primaryInAiAnswer", "Primary keyword found in AI summary section", "ai-summary-section")
      : fail("keywords.primaryInAiAnswer", "Primary keyword not found in AI summary section", "ai-summary-section")
  );

  // 4. Primary keyword in at least one later section H2 (outside hero + ai-summary)
  const laterH2Match = $("h2").toArray().some((el) => {
    const $el = $(el);
    return (
      $el.closest("#hero-section").length === 0 &&
      $el.closest("#ai-summary-section").length === 0 &&
      $el.text().toLowerCase().includes(kw)
    );
  });
  checks.push(
    laterH2Match
      ? pass("keywords.primaryInLaterHeading", "Primary keyword found in a later section heading")
      : warn("keywords.primaryInLaterHeading", "Primary keyword not found in any later section H2")
  );

  // 5. Supporting keywords — at least 2 must appear in body
  if (input.supportingKeywords.length === 0) {
    checks.push(warn("keywords.supporting", "No supporting keywords configured — add them for a complete keyword check"));
  } else {
    const found = input.supportingKeywords.filter((sk) => bt.includes(sk.toLowerCase()));
    if (found.length >= 2) {
      checks.push(pass("keywords.supporting", `${found.length} of ${input.supportingKeywords.length} supporting keywords found`));
    } else if (found.length === 1) {
      checks.push(warn("keywords.supporting", `Only 1 supporting keyword found — at least 2 expected`));
    } else {
      // Treat as a warning rather than a hard fail — AI-generated content often
      // uses natural paraphrases rather than exact configured keyword phrases,
      // so a complete absence of exact matches should not block a page's
      // readiness status.
      checks.push(warn("keywords.supporting", "No configured supporting keyword phrases detected — content may use natural variants; review for keyword coverage"));
    }
  }

  return checks;
}

// ── D. INTERNAL LINK CHECKS ───────────────────────────────────────────────────

function checkInternalLinks($: cheerio.CheerioAPI, input: QaValidatorInput): QaCheck[] {
  const checks: QaCheck[] = [];

  // Hub page link — the hub page itself doesn't need to link back to itself
  if (input.pageType === "hub") {
    checks.push(pass("links.hub", "Hub page — self-link check not applicable"));
  } else {
    checks.push(
      hasHref($, input.hubPageUrl)
        ? pass("links.hub", `Link to hub page (${input.hubPageUrl}) found`)
        : fail("links.hub", `No link found matching hub URL: ${input.hubPageUrl}`)
    );
  }

  // Related cluster page link
  const hasCluster = input.relatedClusterUrls.some((url) => hasHref($, url));
  checks.push(
    input.relatedClusterUrls.length === 0
      ? warn("links.cluster", "No relatedClusterUrls configured to validate")
      : hasCluster
        ? pass("links.cluster", "Link to a related cluster page found")
        : fail("links.cluster", "No link found matching any relatedClusterUrls")
  );

  // Supporting page link
  const hasSupporting = input.supportingPageUrls.some((url) => hasHref($, url));
  checks.push(
    input.supportingPageUrls.length === 0
      ? warn("links.supporting", "No supportingPageUrls configured to validate")
      : hasSupporting
        ? pass("links.supporting", "Link to a supporting page found")
        : fail("links.supporting", "No link found matching any supportingPageUrls")
  );

  return checks;
}

// ── E. TRUST / COMPLIANCE CHECKS ─────────────────────────────────────────────

function checkTrust($: cheerio.CheerioAPI, input: QaValidatorInput): QaCheck[] {
  const checks: QaCheck[] = [];

  const textCheck = (key: string, label: string, value: string): QaCheck =>
    hasText($, value)
      ? pass(key, `${label} found in page`)
      : fail(key, `${label} not found in page`);

  checks.push(textCheck("trust.brandName", `Brand name "${input.brandName}"`, input.brandName));
  checks.push(textCheck("trust.legalName", `Legal name "${input.legalName}"`, input.legalName));

  // Company number — only check when a value is actually saved
  if (input.companyNumber) {
    checks.push(textCheck("trust.companyNumber", `Company number "${input.companyNumber}"`, input.companyNumber));
  } else {
    checks.push(warn("trust.companyNumber", "No company number configured — skipping check"));
  }

  checks.push(textCheck("trust.email", `Email "${input.email}"`, input.email));

  // Address — every line must appear
  const missing = input.addressLines.filter((line) => !hasText($, line));
  if (missing.length === 0) {
    checks.push(pass("trust.address", `All ${input.addressLines.length} address lines found`));
  } else if (missing.length < input.addressLines.length) {
    checks.push(warn("trust.address", `Partial address — missing: ${missing.join(", ")}`));
  } else {
    checks.push(fail("trust.address", "No address lines found in page"));
  }

  // Derive effective privacy & terms URLs.
  // If footerLinks are configured, use any "Privacy"/"Terms" labeled entry as the
  // source of truth (since those are what actually gets rendered to the page).
  // Fall back to the standalone privacyUrl / termsUrl fields when no matching
  // footerLinks entry is found.
  const fl = input.footerLinks ?? [];
  const privacyFooterLink = fl.find((l) => l.label.toLowerCase().includes("privacy"));
  const termsFooterLink   = fl.find((l) =>
    l.label.toLowerCase().includes("terms") ||
    l.label.toLowerCase().includes("legal")
  );

  const effectivePrivacyUrl = privacyFooterLink?.href ?? input.privacyUrl;
  const effectiveTermsUrl   = termsFooterLink?.href   ?? input.termsUrl;

  // Privacy URL — skip when nothing is configured
  if (effectivePrivacyUrl) {
    checks.push(
      hasHref($, effectivePrivacyUrl)
        ? pass("trust.privacyUrl", `Privacy URL link (${effectivePrivacyUrl}) found`)
        : fail("trust.privacyUrl", `No link found for privacy URL: ${effectivePrivacyUrl}`)
    );
  } else {
    checks.push(warn("trust.privacyUrl", "No privacy URL configured — skipping check"));
  }

  // Terms URL — skip when nothing is configured
  if (effectiveTermsUrl) {
    checks.push(
      hasHref($, effectiveTermsUrl)
        ? pass("trust.termsUrl", `Terms URL link (${effectiveTermsUrl}) found`)
        : fail("trust.termsUrl", `No link found for terms URL: ${effectiveTermsUrl}`)
    );
  } else {
    checks.push(warn("trust.termsUrl", "No terms URL configured — skipping check"));
  }

  return checks;
}

// ── F. MAP CHECKS ─────────────────────────────────────────────────────────────

function checkMap($: cheerio.CheerioAPI, input: QaValidatorInput): QaCheck[] {
  const checks: QaCheck[] = [];
  const sectionId = "map-section";
  const $section  = $(`#${sectionId}`);

  if ($section.length === 0) {
    return [fail("map.section", "#map-section not found", sectionId)];
  }
  checks.push(pass("map.section", "#map-section found", sectionId));

  const $iframe = $section.find("iframe");
  if ($iframe.length === 0) {
    checks.push(fail("map.iframe", "No <iframe> inside #map-section", sectionId));
    return checks;
  }
  checks.push(pass("map.iframe", "Map iframe found inside #map-section", sectionId));

  const src        = $iframe.attr("src") ?? "";
  const srcDecoded = decodeURIComponent(src).toLowerCase();
  const hasMapsUrl = srcDecoded.includes("maps.google.com") || srcDecoded.includes("google.com/maps") || srcDecoded.includes("openstreetmap.org");

  // Check src contains "maps" or part of the encoded address
  const firstWord  = (input.addressLines[0] ?? "").split(/[\s,]+/)[0].toLowerCase();
  const hasAddress = firstWord.length > 0 && srcDecoded.includes(firstWord);

  checks.push(
    hasMapsUrl || hasAddress
      ? pass("map.embedSrc", "iframe src contains Google Maps URL or encoded address", sectionId)
      : fail("map.embedSrc", `iframe src does not point to Google Maps (src: ${src.slice(0, 60)})`, sectionId)
  );

  return checks;
}

// ── G. RESOURCES / INTERNAL LINKS SECTION CHECKS ─────────────────────────────

function checkResources($: cheerio.CheerioAPI, pageType: "hub" | "cluster"): QaCheck[] {
  const checks: QaCheck[] = [];

  // Template renders areas-we-cover-section (resource-card-grid) for geographic cluster links
  const sectionId = "areas-we-cover-section";
  const $section  = $(`#${sectionId}`);

  if ($section.length === 0) {
    return [fail("resources.section", `#${sectionId} not found`, sectionId)];
  }
  checks.push(pass("resources.section", `#${sectionId} found`, sectionId));

  const $grid  = $section.find(".resource-card-grid");
  const $cards = $section.find(".resource-card");

  if ($grid.length === 0) {
    checks.push(warn("resources.grid", "No .resource-card-grid found — check card layout", sectionId));
  } else {
    checks.push(pass("resources.grid", ".resource-card-grid present", sectionId));
  }

  if ($cards.length >= 2) {
    checks.push(pass("resources.cards", `${$cards.length} resource cards found — card structure confirmed`, sectionId));
  } else if ($cards.length === 1) {
    checks.push(warn("resources.cards", "Only 1 resource card — at least 2 expected", sectionId));
  } else {
    // Fallback: check for any block-level links as a plain-link warning
    const $blockLinks = $section.find("a").filter((_, el) =>
      $(el).find("h3, h4, strong, p").length > 0
    );
    if ($blockLinks.length >= 2) {
      checks.push(warn("resources.cards", "No .resource-card elements found — only generic block links detected", sectionId));
    } else {
      checks.push(fail("resources.cards", "No resource cards or block links found in resources section", sectionId));
    }
  }

  // Card structure — cards should contain a heading
  const cardsWithH3 = $section.find(".resource-card h3").length;
  checks.push(
    cardsWithH3 >= 1
      ? pass("resources.cardHeadings", `Cards contain H3 headings (${cardsWithH3} found)`, sectionId)
      : warn("resources.cardHeadings", "Resource cards are missing H3 headings", sectionId)
  );

  return checks;
}

// ── SCORING ───────────────────────────────────────────────────────────────────

function calculateScore(checks: QaCheck[]): number {
  if (checks.length === 0) return 0;
  const earned = checks.reduce((sum, c) => {
    if (c.status === "pass")    return sum + 1;
    if (c.status === "warning") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((earned / checks.length) * 100);
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function validatePage(input: QaValidatorInput): QaReport {
  const $ = cheerio.load(input.html);

  const checks: QaCheck[] = [
    ...checkStructure($, input.pageType),
    ...checkAiSummary($),
    ...checkKeywords($, input),
    ...checkInternalLinks($, input),
    ...checkTrust($, input),
    ...checkMap($, input),
    ...checkResources($, input.pageType),
  ];

  const score  = calculateScore(checks);
  const passed = checks.every((c) => c.status !== "fail");

  return { passed, score, pageType: input.pageType, checks };
}
