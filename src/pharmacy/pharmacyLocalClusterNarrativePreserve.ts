/**
 * Preserve existing local-page narrative when re-rendering visual shell only.
 */
import * as cheerio from "cheerio";
import type { LocalClusterPageContent } from "./pharmacyLocalClusterContentEngine.ts";

function textOf($: cheerio.CheerioAPI, selector: string): string {
  const el = $(selector).first();
  return el.text().replace(/\s+/g, " ").trim();
}

function bullets($: cheerio.CheerioAPI, root: cheerio.Cheerio<cheerio.Element>): string[] {
  return root
    .find("ul.clean li")
    .map((_, li) => $(li).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
}

export function extractLocalClusterPageContentFromHtml(html: string): LocalClusterPageContent {
  const $ = cheerio.load(html, { decodeEntities: false });
  const processSection = $('[data-template-block="process"]');
  const processSteps = processSection
    .find(".process-grid .card")
    .map((_, card) => ({
      title: $(card).find("h3").first().text().replace(/\s+/g, " ").trim(),
      body: $(card).find(".card-body").first().text().replace(/\s+/g, " ").trim(),
    }))
    .get()
    .filter((s) => s.title || s.body);

  const faqs = $("#faq-section .cluster-faq-item, #faq-section .faq-card")
    .map((_, item) => ({
      question: $(item).find(".faq-q, h3").first().text().replace(/\s+/g, " ").trim(),
      answer: $(item).find(".faq-a, p").last().text().replace(/\s+/g, " ").trim(),
    }))
    .get()
    .filter((f) => f.question);

  const fingerprint = String($("body").attr("data-content-fingerprint") || "").trim();
  const wordCount = Number($("body").attr("data-local-word-count") || "0") || 0;

  return {
    heroIntro: textOf($, "#hero-section .hero-grid > div > p"),
    localRelevanceHeading: textOf($, '[data-template-block="local-relevance"] .section-head h2'),
    localRelevanceIntro: textOf($, '[data-template-block="local-relevance"] .section-head p'),
    localRelevanceBody: textOf($, '[data-template-block="local-relevance"] .definition-split-copy > p'),
    localRelevanceBullets: bullets($, $('[data-template-block="local-relevance"] .definition-split-copy')),
    whyChecksHeading: textOf($, '[data-template-block="service-definition"] .section-head h2'),
    whyChecksBody: textOf($, '[data-template-block="service-definition"] .section-head p'),
    whyChecksBullets: bullets($, $('[data-template-block="service-definition"]')),
    processHeading: textOf($, '[data-template-block="process"] .section-head h2'),
    processIntro: textOf($, '[data-template-block="process"] .section-head p'),
    processSteps,
    accessHeading: textOf($, '[data-template-block="local-area-access"] .section-head h2'),
    accessBody: textOf($, '[data-template-block="local-area-access"] .section-head p'),
    clinicalEnvironmentHeading: "",
    clinicalEnvironmentBody: textOf($, '[data-template-block="local-area-access"] > .wrap > p'),
    trustHeading: textOf($, '[data-template-block="safety"] h2'),
    trustIntro:
      textOf($, '[data-template-block="safety"] .section-head p') ||
      textOf($, '[data-template-block="safety"] .section-opening-copy > p:first-child') ||
      textOf($, '[data-template-block="safety"] .section-copy > p:first-child') ||
      textOf($, '[data-template-block="safety"] .trust-prose p'),
    trustBullets: bullets($, $('[data-template-block="safety"] .section-opening-copy, [data-template-block="safety"] .section-copy, [data-template-block="safety"] .trust-prose')),
    trustClosing:
      textOf($, '[data-template-block="safety"] .section-opening-copy > p:last-child') ||
      textOf($, '[data-template-block="safety"] .section-copy > p:last-child'),
    trustBody:
      textOf($, '[data-template-block="safety"] .trust-prose p') ||
      [
        textOf($, '[data-template-block="safety"] .section-head p'),
        textOf($, '[data-template-block="safety"] .section-opening-copy'),
        textOf($, '[data-template-block="safety"] .section-copy'),
      ]
        .filter(Boolean)
        .join(" "),
    faqs,
    ctaPrimary: textOf($, "#hero-section .btns .btn").replace(/^Call\s+/i, "").trim() || "Call Pharmacy",
    ctaSecondary: textOf($, "#hero-section .btns .btn.secondary"),
    ctaPhonePrompt: textOf($, ".hero-phone"),
    contentFingerprint: fingerprint || "preserved-local-narrative",
    localIntelligenceUsed: true,
    narrativeType: "preserved",
    wordCountEstimate: wordCount,
  };
}
