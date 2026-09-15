/**
 * Visual Experience V2 — gold-standard pharmacy page layout.
 * Restructures master-publish sections into premium layout without changing copy.
 */
import * as cheerio from "cheerio";
import type { PharmacyImageRenderContext, PharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";
import { renderPharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";

export type ParsedMasterSection = {
  num: string;
  kicker: string;
  title: string;
  proseHtml: string;
  rawHtml: string;
};

function imageSlotHtml(ctx: PharmacyImageRenderContext, slot: PharmacyImageSlot): string {
  return renderPharmacyImageSlot(slot, ctx);
}

function extractSectionHead($section: cheerio.Cheerio<cheerio.Element>): { kicker: string; title: string } {
  const kicker = $section.find(".section-kicker").first().text().trim();
  const title = $section.find(".section-title").first().text().trim();
  return { kicker, title };
}

function extractProseHtml($section: cheerio.Cheerio<cheerio.Element>): string {
  const card = $section.find(".content-card.master-prose").first();
  if (card.length) return card.html()?.trim() || "";
  return $section.find(".master-prose").first().html()?.trim() || "";
}

export function parseMasterSections($: cheerio.CheerioAPI): Map<string, ParsedMasterSection> {
  const map = new Map<string, ParsedMasterSection>();
  $('section[data-master-section]').each((_, el) => {
    const $s = $(el);
    const num = $s.attr("data-master-section") || "";
    const { kicker, title } = extractSectionHead($s);
    const proseHtml = extractProseHtml($s);
    map.set(num, { num, kicker, title, proseHtml, rawHtml: $.html($s) });
  });
  return map;
}

/** Wrap existing prose blocks into cards without rewriting text. */
export function proseToCardGrid(proseHtml: string): string {
  if (!proseHtml.trim()) return "";
  const $ = cheerio.load(`<div id="vex-root">${proseHtml}</div>`, { decodeEntities: false });
  const cards: string[] = [];
  $("#vex-root")
    .children()
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase() || "";
      const inner = $.html(el);
      if (tag === "p") {
        const html = $(el).html() || "";
        const isCard = /^<strong>/i.test(html.trim());
        cards.push(
          `<div class="vex-v2-card${isCard ? "" : " vex-v2-card--full"}"><div class="master-prose">${inner}</div></div>`,
        );
      } else {
        cards.push(`<div class="vex-v2-card vex-v2-card--full"><div class="master-prose">${inner}</div></div>`);
      }
    });
  return `<div class="vex-v2-grid vex-v2-grid--3">${cards.join("\n")}</div>`;
}

function renderSectionHead(kicker: string, title: string, center = true): string {
  const cls = center ? "vex-v2-section-head vex-v2-section-head--center" : "vex-v2-section-head";
  return `<div class="${cls}">
${kicker ? `<span class="vex-v2-kicker">${kicker}</span>` : ""}
${title ? `<h2 class="vex-v2-title">${title}</h2>` : ""}
</div>`;
}

function renderQuickAnswer(section: ParsedMasterSection | undefined): string {
  if (!section) return "";
  return `<section class="vex-v2-band vex-v2-band--soft-blue" data-vex-block="quick-answer">
<div class="wrap">
${renderSectionHead(section.kicker, section.title)}
<div class="vex-v2-quick-answer">
<div class="master-prose">${section.proseHtml}</div>
</div>
</div>
</section>`;
}

function renderCardSection(
  section: ParsedMasterSection | undefined,
  bandClass: string,
  blockId: string,
): string {
  if (!section) return "";
  return `<section class="vex-v2-band ${bandClass}" data-vex-block="${blockId}">
<div class="wrap">
${renderSectionHead(section.kicker, section.title)}
${proseToCardGrid(section.proseHtml)}
</div>
</section>`;
}

function renderProseSection(
  section: ParsedMasterSection | undefined,
  bandClass: string,
  blockId: string,
): string {
  if (!section) return "";
  return `<section class="vex-v2-band ${bandClass}" data-vex-block="${blockId}">
<div class="wrap">
${renderSectionHead(section.kicker, section.title)}
<div class="vex-v2-prose-panel master-prose">${section.proseHtml}</div>
</div>
</section>`;
}

function renderSplitSection(
  section: ParsedMasterSection | undefined,
  bandClass: string,
  blockId: string,
  imageHtml: string,
  reverse = false,
): string {
  if (!section) return "";
  const rev = reverse ? " vex-v2-split--reverse" : "";
  return `<section class="vex-v2-band ${bandClass}" data-vex-block="${blockId}">
<div class="wrap">
${renderSectionHead(section.kicker, section.title)}
<div class="vex-v2-split${rev}">
<div class="vex-v2-split-copy">
<div class="vex-v2-prose-panel master-prose">${section.proseHtml}</div>
</div>
<div class="vex-v2-split-media">${imageHtml}</div>
</div>
</div>
</section>`;
}

function renderSafetyPanel(section: ParsedMasterSection | undefined): string {
  if (!section) return "";
  return `<section class="vex-v2-band vex-v2-band--safety" data-vex-block="safety-panel">
<div class="wrap">
${renderSectionHead(section.kicker, section.title)}
<div class="vex-v2-safety-panel">
<div class="master-prose">${section.proseHtml}</div>
</div>
</div>
</section>`;
}

function renderFaqSection($: cheerio.CheerioAPI): string {
  const faq = $('section[data-component="faq-accordion"]').first();
  if (!faq.length) return "";
  const head = extractSectionHead(faq);
  const accordion = faq.find(".faq-accordion").first().html() || "";
  return `<section class="vex-v2-band vex-v2-band--white" data-vex-block="faq" id="service-faq">
<div class="wrap">
${renderSectionHead(head.kicker, head.title || "Frequently Asked Questions")}
<div class="vex-v2-faq faq-accordion">${accordion}</div>
</div>
</section>`;
}

function renderTrustSection($: cheerio.CheerioAPI, ctx: PharmacyImageRenderContext): string {
  const trust = $('[data-component="pharmacy-trust-layer"]').first();
  if (!trust.length) return "";
  const trustHtml = $.html(trust);
  return `<section class="vex-v2-band vex-v2-band--soft-green" data-vex-block="trust-credentials">
<div class="wrap">
<div class="vex-v2-split vex-v2-split--trust">
<div class="vex-v2-split-copy">${trustHtml}</div>
<div class="vex-v2-split-media vex-v2-trust-media">${imageSlotHtml(ctx, "trust")}</div>
</div>
</div>
</section>`;
}

function renderLocalSection($: cheerio.CheerioAPI): string {
  const local = $('section[data-component="master-local-relevance"], section[data-section-type="localRelevance"]').first();
  if (!local.length) return $.html(local);
  const head = extractSectionHead(local);
  const prose = extractProseHtml(local) || local.find(".coverage-panel, .content-card").html() || local.find(".wrap").html() || "";
  return `<section class="vex-v2-band vex-v2-band--local" data-vex-block="local-access">
<div class="wrap">
${renderSectionHead(head.kicker, head.title || "Local access")}
<div class="vex-v2-local-panel">${prose}</div>
</div>
</section>`;
}

function renderFinalCta($: cheerio.CheerioAPI, ctx: PharmacyImageRenderContext): string {
  const cta = $('section[data-component="cta-block"]').first();
  if (!cta.length) return "";
  const ctaInner = cta.find(".cta-block").first().html() || cta.find(".wrap").html() || "";
  return `<section class="vex-v2-band vex-v2-band--final" data-vex-block="final-cta" id="contact">
<div class="wrap">
<div class="vex-v2-final-grid">
<div class="vex-v2-final-copy">
<div class="cta-block cta-block--book">${ctaInner}</div>
</div>
<div class="vex-v2-final-media">${imageSlotHtml(ctx, "conversion")}</div>
</div>
</div>
</section>`;
}

function renderHero($: cheerio.CheerioAPI, ctx: PharmacyImageRenderContext): string {
  const hero = $("main header.hero-a, main header.hero-b").first();
  if (!hero.length) return "";
  const inner = hero.find(".wrap").first().html() || hero.html() || "";
  const variant = hero.hasClass("hero-b") ? "vex-v2-hero--light" : "vex-v2-hero--dark";
  return `<section class="vex-v2-hero ${variant}" data-vex-block="hero">
<div class="wrap vex-v2-hero-grid">
<div class="vex-v2-hero-copy">${inner}</div>
<div class="vex-v2-hero-media">${imageSlotHtml(ctx, "hero")}</div>
</div>
</section>`;
}

/**
 * Rebuild main content in gold-standard layout order using existing master sections.
 */
export function buildGoldStandardMainHtml(
  sourceHtml: string,
  ctx: PharmacyImageRenderContext,
): string {
  const $ = cheerio.load(sourceHtml);
  const sections = parseMasterSections($);

  const parts = [
    renderHero($, ctx),
    renderQuickAnswer(sections.get("1")),
    renderCardSection(sections.get("2"), "vex-v2-band--white", "service-breakdown"),
    renderCardSection(sections.get("3"), "vex-v2-band--soft-green", "who-helps"),
    renderSplitSection(sections.get("4"), "vex-v2-band--white", "split-support", imageSlotHtml(ctx, "support"), false),
    renderProseSection(sections.get("5"), "vex-v2-band--soft-blue", "split-alt"),
    renderSafetyPanel(sections.get("6")),
    renderFaqSection($),
    renderCardSection(sections.get("9"), "vex-v2-band--soft-blue", "patient-concerns"),
    renderProseSection(sections.get("10"), "vex-v2-band--white", "why-use"),
    renderCardSection(sections.get("11"), "vex-v2-band--soft-green", "why-pharmacy"),
    renderProseSection(sections.get("12"), "vex-v2-band--white", "trust-prose"),
    renderTrustSection($, ctx),
    renderLocalSection($),
    sections.get("13") ? renderProseSection(sections.get("13"), "vex-v2-band--soft-blue", "booking-steps") : "",
    renderFinalCta($, ctx),
  ].filter(Boolean);

  return parts.join("\n");
}

export interface LayoutV2Validation {
  pass: boolean;
  checks: Record<string, boolean>;
  failures: string[];
}

export function validateLayoutV2Html(html: string): LayoutV2Validation {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch?.[1] ?? html;
  const withoutStyle = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  const checks: Record<string, boolean> = {
    heroImage: /data-vex-block="hero"[\s\S]*pharmacy-image--hero|vex-v2-hero-media[\s\S]*pharmacy-image--hero/.test(body),
    splitSections: (body.match(/vex-v2-split/g) || []).length >= 2,
    cardGrid: (body.match(/vex-v2-grid/g) || []).length >= 1,
    faqStyled: /vex-v2-faq|faq-accordion/.test(body),
    ctaStyled: /vex-v2-band--final|data-vex-block="final-cta"/.test(body),
    footerPresent: /site-footer|preview-footer/.test(body),
    noCssLeak: !["--ink:", "--navy:", "--nhs:", "box-sizing:border-box"].some((n) => withoutStyle.includes(n)),
    noBlueprint: ![
      'data-section-type="conversionReassurance"',
      'data-section-type="deepDive"',
      'data-component="conversion-reassurance"',
    ].some((n) => body.includes(n)),
    notParagraphsOnly: (body.match(/vex-v2-card|vex-v2-split|vex-v2-hero/g) || []).length >= 5,
  };

  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  return { pass: failures.length === 0, checks, failures };
}
