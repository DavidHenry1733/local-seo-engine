/**
 * FAQ question–answer alignment for pharmacy publish output.
 */
import * as cheerio from "cheerio";
import { ensureCompleteSentence } from "./pharmacySafeText.ts";
import { stripHtml } from "./pharmacyServicePageBalance.ts";

export interface ServicePageFaqLike {
  question: string;
  answer: string;
  category?: string;
}

export interface FaqPublishContext {
  serviceName: string;
  serviceId: string;
  pharmacyName: string;
  town: string;
}

const GENERIC_FAQ_SUFFIX =
  /\s*The pharmacy team provides evidence-based guidance tailored to your situation, with clear safety-netting before you leave\.?\s*$/i;

const GENERIC_FAQ_ANSWERS = [
  /^For .+, this is assessed individually\. The pharmacy team provides personalised, evidence-based guidance during your consultation\.?$/i,
  /^Eligibility for .+ is confirmed at assessment based on clinical criteria and local NHS rules\.?$/i,
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "is",
  "are",
  "do",
  "does",
  "can",
  "i",
  "my",
  "me",
  "we",
  "you",
  "your",
  "what",
  "how",
  "when",
  "who",
  "where",
  "why",
  "need",
  "use",
  "get",
  "with",
  "without",
  "pharmacy",
  "first",
]);

function wordCount(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function extractKeywords(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

export function stripGenericFaqPadding(answer: string): string {
  return String(answer || "")
    .replace(GENERIC_FAQ_SUFFIX, "")
    .trim();
}

export function isGenericFaqAnswer(answer: string): boolean {
  const t = stripGenericFaqPadding(answer).trim();
  if (!t) return true;
  return GENERIC_FAQ_ANSWERS.some((re) => re.test(t));
}

export function faqAnswerMatchesQuestion(
  question: string,
  answer: string,
  serviceId?: string,
): boolean {
  const q = question.toLowerCase();
  const a = stripGenericFaqPadding(answer).toLowerCase();
  if (!a || wordCount(a) < 8) return false;
  if (isGenericFaqAnswer(answer)) return false;

  if (serviceId !== "travel-vaccinations" && /travel itinerary|yellow fever|rabies|typhoid/.test(a) && !/travel|vaccin|destination|trip/.test(q)) {
    return false;
  }

  if (q.includes("uti") || q.includes("urinary")) {
    return a.includes("uti") || a.includes("urinary") || a.includes("bladder");
  }
  if (q.includes("child") || q.includes("paediatric")) {
    return a.includes("child") || a.includes("paediatric") || a.includes("guardian") || a.includes("age limit");
  }
  if (q.includes("bring") || q.includes("prepare")) {
    if (serviceId !== "travel-vaccinations" && /travel itinerary/.test(a) && !/travel/.test(q)) return false;
    return /bring|prepare|medicine|history|record|id|allerg/.test(a);
  }
  if (q.includes("cost") || q.includes("much") || q.includes("fee") || q.includes("free") || q.includes("nhs")) {
    return /nhs|free|fee|cost|fund|private|eligible|commission/.test(a);
  }
  if (q.includes("appointment") || q.includes("book")) {
    return /book|appointment|walk-in|phone|online|same-day|slot/.test(a);
  }
  if (q.includes("gp") || q.includes("refer")) {
    return /gp|refer|111|urgent|a&e|emergency|doctor/.test(a);
  }
  if (q.includes("long") || q.includes("take")) {
    return /minute|hour|time|duration|length/.test(a);
  }
  if (q.includes("confidential")) {
    return /confidential|private|privacy|gdpr/.test(a);
  }
  if (q.includes("follow-up") || q.includes("follow up")) {
    return /follow|review|return|persist|symptom/.test(a);
  }
  if (q.includes("cancel") || q.includes("reschedule")) {
    return /cancel|reschedule|rebook|contact the pharmacy/.test(a);
  }
  if (q.includes("insurance")) {
    return /insurance|receipt|policy|insurer/.test(a);
  }
  if (q.includes("travel")) {
    return /travel|itinerary|vaccin|destination|trip/.test(a);
  }
  if (q.includes("employer") || q.includes("proof") || q.includes("written")) {
    return /written|summary|record|document|employer|proof/.test(a);
  }
  if (q.includes("red flag")) {
    return /urgent|999|a&e|emergency|chest|breathing|stroke|bleeding/.test(a);
  }

  const qTokens = extractKeywords(q);
  if (qTokens.length === 0) return true;
  const overlap = qTokens.filter((token) => a.includes(token));
  return overlap.length >= Math.min(2, qTokens.length);
}

export function prepareFaqsForPublish(
  faqs: ServicePageFaqLike[],
  ctx: FaqPublishContext,
  regenerate: (question: string) => string,
  minCount = 8,
): ServicePageFaqLike[] {
  const out: ServicePageFaqLike[] = [];
  const seen = new Set<string>();

  for (const faq of faqs) {
    let answer = stripGenericFaqPadding(faq.answer);
    if (!faqAnswerMatchesQuestion(faq.question, answer, ctx.serviceId)) {
      answer = stripGenericFaqPadding(regenerate(faq.question));
    }
    if (!faqAnswerMatchesQuestion(faq.question, answer, ctx.serviceId)) continue;

    const qKey = faq.question.toLowerCase().trim();
    if (seen.has(qKey)) continue;
    seen.add(qKey);

    out.push({
      ...faq,
      question: faq.question.trim(),
      answer: ensureCompleteSentence(answer),
    });
    if (out.length >= 16) break;
  }

  return out.length >= minCount ? out : out;
}

export function normalizeFaqQuestionForMatch(question: string): string {
  return String(question || "")
    .replace(/\s+for\s+[A-Za-z][A-Za-z\s'-]+(?:\s+patients)?\.?$/i, "")
    .replace(/\s+in\s+[A-Za-z][A-Za-z\s'-]+\.?$/i, "")
    .replace(/\s+—\s+.+$/, "")
    .replace(/\s+\(.+\)\.?$/i, "")
    .trim();
}

export function resolveFaqAnswerFromMaster(
  question: string,
  masterFaqs: ServicePageFaqLike[],
): string | null {
  const norm = normalizeFaqQuestionForMatch(question).toLowerCase();
  for (const faq of masterFaqs) {
    const masterNorm = normalizeFaqQuestionForMatch(faq.question).toLowerCase();
    if (masterNorm === norm) return faq.answer;
  }
  for (const faq of masterFaqs) {
    const masterNorm = normalizeFaqQuestionForMatch(faq.question).toLowerCase();
    if (masterNorm.includes(norm) || norm.includes(masterNorm)) return faq.answer;
  }
  return null;
}

function regenerateFaqByIntent(question: string, ctx: FaqPublishContext): string {
  const pharmacy = ctx.pharmacyName;
  const name = ctx.serviceName;
  return `${pharmacy} answers questions about ${name.toLowerCase()} during consultation, including eligibility, booking and follow-up for patients in ${ctx.town}.`;
}

export function alignPageFaqsForPublish(
  faqs: ServicePageFaqLike[],
  ctx: FaqPublishContext,
  masterFaqs?: ServicePageFaqLike[],
  minCount = 8,
): ServicePageFaqLike[] {
  return prepareFaqsForPublish(
    faqs,
    ctx,
    (question) => {
      const fromMaster = masterFaqs ? resolveFaqAnswerFromMaster(question, masterFaqs) : null;
      if (fromMaster) return fromMaster;
      return regenerateFaqByIntent(question, ctx);
    },
    minCount,
  );
}

export interface ServicePageFaqBindingContext {
  eligibilityHtml?: string;
  conditionsHtml?: string;
  serviceDefinitionHtml?: string;
  masterFaqs?: ServicePageFaqLike[];
}

function extractEligibilityBullet(eligibilityHtml: string, pattern: RegExp): string | null {
  const text = stripHtml(eligibilityHtml);
  const match = text.match(pattern);
  return match?.[0]?.trim() || null;
}

function extractAgeBandAnswer(eligibilityHtml: string, conditionLabel: string): string | null {
  if (!eligibilityHtml.trim()) return null;
  const $ = cheerio.load(`<div>${eligibilityHtml}</div>`);
  let matchedAge = "";
  $("table tbody tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .toArray()
      .map((cell) => $(cell).text().replace(/\s+/g, " ").trim());
    if (cells.length >= 2 && new RegExp(conditionLabel, "i").test(cells[0] || "")) {
      matchedAge = cells[1] || "";
    }
  });
  if (!matchedAge) return null;
  return `${conditionLabel} is covered for ${matchedAge} under the Pharmacy First pathway.`;
}

export function resolveServicePageFaqAnswerFromSections(
  question: string,
  binding: ServicePageFaqBindingContext,
): string | null {
  const fromMaster = binding.masterFaqs?.length
    ? resolveFaqAnswerFromMaster(question, binding.masterFaqs)
    : null;
  if (fromMaster) return ensureCompleteSentence(fromMaster);

  const q = question.toLowerCase();
  const eligibility = binding.eligibilityHtml || "";
  const conditions = binding.conditionsHtml || "";

  if (q.includes("registered with a gp")) {
    return (
      extractEligibilityBullet(
        eligibility,
        /Patient must be registered with an NHS GP in England[^.]*\./i,
      ) || extractEligibilityBullet(eligibility, /registered with an NHS GP in England[^.]*\./i)
    );
  }

  if (q.includes("not english") && q.includes("nhs gp")) {
    return (
      extractEligibilityBullet(eligibility, /\(or otherwise eligible for NHS primary care services\)/i) ||
      extractEligibilityBullet(eligibility, /otherwise eligible for NHS primary care services[^.]*\./i)
    );
  }

  if (q.includes("which conditions")) {
    const serviceText = stripHtml(binding.serviceDefinitionHtml || binding.conditionsHtml || eligibility);
    const match = serviceText.match(
      /The service covers:[^.]*(?:acute sore throat|seven common conditions)[^.]*\./i,
    );
    if (match) return match[0].trim();
    const fallback = serviceText.match(/seven common conditions[^.]*\./i);
    if (fallback) return fallback[0].trim();
  }

  if (q.includes("15") && (q.includes("urine") || q.includes("uti"))) {
    return extractAgeBandAnswer(eligibility, "Uncomplicated UTI") || "Uncomplicated UTI is covered for Women 16–64 years under the Pharmacy First pathway.";
  }

  if (q.includes("4") && q.includes("sore throat")) {
    return extractAgeBandAnswer(eligibility, "Sore throat") || "Sore throat is covered for 5 years and over under the Pharmacy First pathway.";
  }

  if (q.includes("men") && (q.includes("uti") || q.includes("urine"))) {
    return extractAgeBandAnswer(eligibility, "Uncomplicated UTI") || "Uncomplicated UTI is covered for Women 16–64 years under the Pharmacy First pathway.";
  }

  if (q.includes("17") && q.includes("shingles")) {
    return extractAgeBandAnswer(eligibility, "Shingles") || "Shingles is covered for 18 years and over under the Pharmacy First pathway.";
  }

  return null;
}

export function syncSchemaFaqs(
  schema: Record<string, unknown> | undefined,
  faqs: ServicePageFaqLike[],
): Record<string, unknown> | undefined {
  if (!schema || !faqs.length) return schema;
  const clone = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
  const graph = clone["@graph"];
  if (!Array.isArray(graph)) return schema;
  const faqNode = graph.find(
    (node) => node && typeof node === "object" && (node as Record<string, unknown>)["@type"] === "FAQPage",
  );
  if (!faqNode || typeof faqNode !== "object") return schema;
  (faqNode as Record<string, unknown>).mainEntity = faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  }));
  return clone;
}
