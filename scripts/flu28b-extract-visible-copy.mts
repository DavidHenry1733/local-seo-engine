#!/usr/bin/env npx tsx
/**
 * FLU-APPROVED-BANK-COMMERCIAL-CONTENT-28B — extract full visible copy from live HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "flu-vaccinations";
const OUT = "/tmp/flu28b-copy.json";

function visibleFromHtml(htmlPath: string, includeFaqs = true): string {
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = load(html);
  $("script, style, noscript, svg").remove();
  const parts: string[] = [];
  $("main, .page, body").first().find("h1,h2,h3,h4,p,li,.faq-q,.faq-a,.faq-card,.card,.section-head,.hero,.cta,.trust-item,.step-title,.step-body,.cluster-faq-item").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() || "";
    const cls = $(el).attr("class") || "";
    const text = $(el).clone().children().remove().end().text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (cls.includes("faq-q") || tag === "h3" && $(el).closest(".faq-card,.cluster-faq-item").length) {
      parts.push(`Q: ${text}`);
      return;
    }
    if (cls.includes("faq-a")) {
      parts.push(`A: ${text}`);
      return;
    }
    parts.push(text);
  });
  if (parts.length < 5) {
    return $("body").text().replace(/\s+/g, " ").trim();
  }
  return parts.join("\n");
}

function faqsFromHtml(htmlPath: string): Array<{ q: string; a: string }> {
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = load(html);
  const faqs: Array<{ q: string; a: string }> = [];
  $(".faq-card, .cluster-faq-item").each((_, el) => {
    const q = $(el).find(".faq-q,h3").first().text().replace(/\s+/g, " ").trim();
    const a = $(el).find(".faq-a,p").last().text().replace(/\s+/g, " ").trim();
    if (q) faqs.push({ q, a });
  });
  return faqs;
}

const serviceHtml = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, SERVICE, "index.html");
const darfieldHtml = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE, "local/darfield/index.html");
const cudworthHtml = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE, "local/cudworth/index.html");

const result = {
  servicePageVisible: visibleFromHtml(serviceHtml),
  serviceFaqs: faqsFromHtml(serviceHtml),
  darfieldVisible: visibleFromHtml(darfieldHtml),
  darfieldFaqs: faqsFromHtml(darfieldHtml),
  cudworthVisible: visibleFromHtml(cudworthHtml),
  cudworthFaqs: faqsFromHtml(cudworthHtml),
};

fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: true, out: OUT, faqCounts: {
  service: result.serviceFaqs.length,
  darfield: result.darfieldFaqs.length,
  cudworth: result.cudworthFaqs.length,
}}, null, 2));
