/**
 * Resolve service-page FAQ entries from existing generated content — no copy regeneration.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { getContentEcosystemDir, resolvePharmacyWorkspaceRoot } from "./pharmacyWorkspacePaths.ts";
import { servicePageFaqEntries } from "./pharmacyServicePageIntelligence.ts";
import { resolveApprovedServiceBank, type ServiceVariantPack } from "./pharmacyServiceVariantLibrary.ts";
import { withApprovedBankServicePageContract } from "./pharmacyApprovedBankCorePageContract.ts";

export interface ResolvedFaqEntry {
  question: string;
  answer: string;
}

function dedupeFaqs(entries: ResolvedFaqEntry[], limit = 10): ResolvedFaqEntry[] {
  const seen = new Set<string>();
  const out: ResolvedFaqEntry[] = [];
  for (const entry of entries) {
    const q = entry.question.trim();
    const a = entry.answer.trim();
    if (!q || !a) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ question: q, answer: a });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Project locked approved-bank FAQs into the page model.
 * A blank question or answer is not visible. A repeated question keeps the first.
 * There is no numeric cap.
 */
export function projectLockedApprovedBankServicePageFaqs(pack: ServiceVariantPack): ResolvedFaqEntry[] {
  const faqs = withApprovedBankServicePageContract(pack).servicePage.faqs;
  const seen = new Set<string>();
  const out: ResolvedFaqEntry[] = [];
  for (const faq of faqs) {
    const question = String(faq.question || "").trim();
    const answer = String(faq.answer || "").trim();
    if (!question || !answer) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ question, answer });
  }
  return out;
}

export function extractFaqsFromHtml(html: string): ResolvedFaqEntry[] {
  const $ = cheerio.load(html);
  const items: ResolvedFaqEntry[] = [];

  $("details.faq-item, .faq-item").each((_, el) => {
    const q = $(el).find(".faq-q").first().text().trim();
    const a = $(el).find(".faq-answer, .faq-a").first().text().trim();
    if (q && a) items.push({ question: q, answer: a });
  });

  $("#faq-section .cluster-faq-item, #faq-section .faq-card").each((_, el) => {
    const q = $(el).find(".faq-q").first().text().trim();
    const a = $(el).find(".faq-a, .faq-answer").first().text().trim();
    if (q && a) items.push({ question: q, answer: a });
  });

  $('section[data-component="faq-accordion"] .faq-item').each((_, el) => {
    const q = $(el).find(".faq-q").first().text().trim();
    const a = $(el).find(".faq-answer, .faq-a").first().text().trim();
    if (q && a) items.push({ question: q, answer: a });
  });

  return dedupeFaqs(items, 10);
}

const LOCKDOWN_PHARMACY_FIRST_FAQ_REFERENCE =
  "output/pharmacy-visual-experience/leeds-pharmacy/pharmacy-first/index.html";

/** Reusable lockdown-v1 Pharmacy First FAQs from the confirmed Leeds reference page. */
export function lockdownPharmacyFirstFaqsFromReference(): ResolvedFaqEntry[] {
  const file = path.join(resolvePharmacyWorkspaceRoot(), LOCKDOWN_PHARMACY_FIRST_FAQ_REFERENCE);
  if (!fs.existsSync(file)) return [];
  return extractFaqsFromHtml(fs.readFileSync(file, "utf8"));
}

function ecosystemFaqPagePath(slug: string, serviceId: string): string | null {
  const candidates = [
    path.join(getContentEcosystemDir(slug, serviceId), "pages", `${serviceId}-faqs`, "index.html"),
    path.join(getContentEcosystemDir(slug, serviceId), "pages", "pharmacy-first-faqs", "index.html"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

export function resolveServicePageFaqContent(
  contentContext: ContentGenerationContext | undefined,
  slug: string,
  serviceId: string,
  sourceHtml?: string,
): ResolvedFaqEntry[] {
  // Approved-bank core pages: locked contract FAQs only.
  if (contentContext?.variantPack && resolveApprovedServiceBank(serviceId)) {
    return projectLockedApprovedBankServicePageFaqs(contentContext.variantPack);
  }

  const merged: ResolvedFaqEntry[] = [];

  if (sourceHtml) {
    merged.push(...extractFaqsFromHtml(sourceHtml));
  }

  for (const faq of contentContext?.masterLibrary.faqs || []) {
    if (faq.question && faq.answer) {
      merged.push({ question: faq.question, answer: faq.answer });
    }
  }

  for (const faq of contentContext?.variantPack?.faqs || []) {
    if (faq.question && faq.answer) {
      merged.push({ question: faq.question, answer: faq.answer });
    }
  }

  const faqPage = ecosystemFaqPagePath(slug, serviceId);
  if (faqPage) {
    merged.push(...extractFaqsFromHtml(fs.readFileSync(faqPage, "utf8")));
  }

  if (contentContext) {
    merged.push(...servicePageFaqEntries(contentContext));
  }

  return dedupeFaqs(merged, 10);
}
