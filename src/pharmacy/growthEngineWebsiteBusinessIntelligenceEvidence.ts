/**
 * Shared website Business Intelligence evidence extractors (audience, pricing, offers, CTA, trust, social).
 * Evidence-only — never auto-approves into Product Owner canonical profile fields.
 */
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import type { WebsiteImportEvidence } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";

export interface WebsiteAudienceEvidence {
  value: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  matchedSnippet: string;
  evidence: WebsiteImportEvidence;
}

export interface WebsitePricingEvidence {
  kind: "price" | "package" | "discount" | "qualifier";
  value: string;
  label: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  matchedSnippet: string;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteOfferEvidence {
  offerId: string;
  offerName: string;
  offerType: "programme" | "offer" | "free_audit" | "discount" | "other";
  description: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteCtaEvidence {
  ctaText: string;
  sourceUrl: string;
  associatedPageTitle: string;
  associatedCategory: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteTrustEvidence {
  kind: "about_description" | "founder" | "experience" | "credential" | "testimonial" | "case_study" | "guarantee" | "proof_point" | "trust_statement";
  value: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteSocialProfileEvidence {
  platform: "facebook" | "instagram" | "linkedin" | "x" | "youtube" | "other";
  url: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function evidence(sourceUrl: string, confidence: number, method: string): WebsiteImportEvidence {
  return { sourceUrl, confidence, detectionMethod: method, detectedAt: nowIso() };
}

function extractMetaDescription(html: string): string {
  return decodeEntities(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
      || "",
  );
}

const AUDIENCE_PATTERNS: Array<{ re: RegExp; value: string; confidence: number }> = [
  { re: /\b(?:for|helping|serving|built for|designed for|we work with)\s+(?:uk\s+)?(?:independent\s+)?community pharmacies\b/i, value: "UK community pharmacies", confidence: 88 },
  { re: /\b(?:for|helping|serving|built for|designed for|we work with)\s+independent pharmacies\b/i, value: "independent pharmacies", confidence: 86 },
  { re: /\b(?:for|helping|serving|built for|designed for|we work with)\s+uk pharmacies\b/i, value: "UK pharmacies", confidence: 84 },
  { re: /\b(?:for|helping|serving|built for|designed for|we work with)\s+pharmacy owners\b/i, value: "pharmacy owners", confidence: 84 },
  { re: /\b(?:for|helping|serving|built for|designed for|we work with)\s+pharmacy (?:teams|businesses)\b/i, value: "pharmacy businesses", confidence: 80 },
  { re: /\bdigital services for (?:uk\s+)?(?:community\s+)?pharmacies\b/i, value: "community pharmacies", confidence: 82 },
  { re: /\bhelp(?:ing)?\s+(?:uk\s+)?community pharmacies\b/i, value: "UK community pharmacies", confidence: 86 },
];

export function extractAudienceEvidenceFromText(
  text: string,
  sourceUrl: string,
  method = "positioning-language",
): WebsiteAudienceEvidence[] {
  const out: WebsiteAudienceEvidence[] = [];
  const seen = new Set<string>();
  const blob = decodeEntities(text);
  if (!blob) return out;
  for (const pattern of AUDIENCE_PATTERNS) {
    const m = blob.match(pattern.re);
    if (!m) continue;
    const key = pattern.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      value: pattern.value,
      sourceUrl,
      extractionMethod: method,
      confidence: pattern.confidence,
      matchedSnippet: m[0].slice(0, 160),
      evidence: evidence(sourceUrl, pattern.confidence, method),
    });
  }
  return out;
}

export function buildAudienceEvidenceFromPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
  homepageMetaDescription = "",
  homepageUrl = "",
): WebsiteAudienceEvidence[] {
  const out: WebsiteAudienceEvidence[] = [];
  const seen = new Set<string>();
  const add = (rows: WebsiteAudienceEvidence[]) => {
    for (const row of rows) {
      const key = row.value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  };

  if (homepageMetaDescription && homepageUrl) {
    add(extractAudienceEvidenceFromText(homepageMetaDescription, homepageUrl, "homepage-meta-description"));
  }

  const priority = pages.filter((p) =>
    p.category === "homepage" || p.category === "about" || p.category === "service-page" || p.category === "offer",
  );
  for (const page of priority.slice(0, 16)) {
    const html = pageHtmlByUrl[page.url] || "";
    const meta = extractMetaDescription(html);
    if (meta) add(extractAudienceEvidenceFromText(meta, page.url, "page-meta-description"));
    // Prefer explicit positioning language in early body copy only.
    const body = stripHtml(html).slice(0, 1800);
    add(extractAudienceEvidenceFromText(body, page.url, "page-body-positioning"));
    if (page.title) add(extractAudienceEvidenceFromText(page.title, page.url, "page-title"));
    if (page.h1) add(extractAudienceEvidenceFromText(page.h1, page.url, "page-h1"));
  }

  // Stored inventory-only recovery (no HTML): use title/h1/meta already present on pages when HTML map empty.
  if (!Object.keys(pageHtmlByUrl).length) {
    for (const page of pages.slice(0, 28)) {
      add(extractAudienceEvidenceFromText([page.title, page.h1].filter(Boolean).join(" — "), page.url, "page-inventory-text"));
    }
  }

  return out.slice(0, 12);
}

const PRICE_RE = /(?:from\s+)?£\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*\/\s*(?:year|yr|month|mo|week|wk|day))?/i;
const DISCOUNT_RE = /\b(\d{1,2}%\s*(?:off|discount)|free\s+audit|complimentary\s+audit)\b/i;

export function extractPricingEvidenceFromHtml(html: string, sourceUrl: string): WebsitePricingEvidence[] {
  const out: WebsitePricingEvidence[] = [];
  const text = stripHtml(html);
  if (!text) return out;

  // Extract prices and discounts independently (avoid overlapping window consumption).
  for (const m of text.matchAll(new RegExp(PRICE_RE.source, "gi"))) {
    const price = m[0];
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 40), idx + price.length + 40);
    if (!/£|from|package|plan|hosting|website|month|year|price|pricing/i.test(window)) continue;
    out.push({
      kind: "price",
      value: price.replace(/\s+/g, " ").trim(),
      label: "price",
      sourceUrl,
      extractionMethod: "commercial-price-context",
      confidence: 78,
      matchedSnippet: window.replace(/\s+/g, " ").trim().slice(0, 160),
      evidence: evidence(sourceUrl, 78, "commercial-price-context"),
    });
  }
  for (const m of text.matchAll(new RegExp(DISCOUNT_RE.source, "gi"))) {
    const discount = m[0];
    const idx = m.index ?? 0;
    const window = text.slice(Math.max(0, idx - 40), idx + discount.length + 40);
    out.push({
      kind: "discount",
      value: discount.replace(/\s+/g, " ").trim(),
      label: /free|complimentary/i.test(discount) ? "free_offer" : "discount",
      sourceUrl,
      extractionMethod: "commercial-discount-context",
      confidence: 76,
      matchedSnippet: window.replace(/\s+/g, " ").trim().slice(0, 160),
      evidence: evidence(sourceUrl, 76, "commercial-discount-context"),
    });
  }

  // Package-like headings on pricing pages.
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, " ")),
  );
  for (const heading of headings.slice(0, 8)) {
    if (/\b(package|plan|tier|starter|growth|pro|essential|premium)\b/i.test(heading) && heading.length <= 80) {
      out.push({
        kind: "package",
        value: heading,
        label: "package_name",
        sourceUrl,
        extractionMethod: "pricing-heading",
        confidence: 72,
        matchedSnippet: heading,
        evidence: evidence(sourceUrl, 72, "pricing-heading"),
      });
    }
  }

  return dedupePricing(out).slice(0, 20);
}

function dedupePricing(rows: WebsitePricingEvidence[]): WebsitePricingEvidence[] {
  const seen = new Set<string>();
  const out: WebsitePricingEvidence[] = [];
  for (const row of rows) {
    const key = `${row.kind}|${row.value.toLowerCase()}|${row.sourceUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function buildPricingEvidenceFromPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
): WebsitePricingEvidence[] {
  const out: WebsitePricingEvidence[] = [];
  const pricingPages = pages.filter((p) => p.category === "pricing" || /price|pricing|package/i.test(p.path + " " + p.title));
  for (const page of pricingPages.slice(0, 6)) {
    const html = pageHtmlByUrl[page.url] || "";
    if (html) {
      out.push(...extractPricingEvidenceFromHtml(html, page.url));
    } else {
      // Inventory-only: persist page-level commercial pricing signal without inventing amounts.
      const label = decodeEntities(str(page.h1) || str(page.title).split(/\s*[|\-–—]\s*/)[0] || "Pricing");
      out.push({
        kind: "package",
        value: label,
        label: "pricing_page",
        sourceUrl: page.url,
        extractionMethod: "pricing-page-inventory",
        confidence: 60,
        matchedSnippet: label,
        evidence: evidence(page.url, 60, "pricing-page-inventory"),
      });
    }
  }
  return dedupePricing(out).slice(0, 24);
}

export function buildOfferEvidenceFromPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
): WebsiteOfferEvidence[] {
  const out: WebsiteOfferEvidence[] = [];
  const seen = new Set<string>();
  const offerPages = pages.filter(
    (p) =>
      p.category === "offer"
      || /founder[-_]?partner|partner[-_]?programme|special[-_]?offer|seo-audit/i.test(p.path)
      || /\b(founder partner|partner programme|free audit)\b/i.test(p.title + " " + (p.h1 || "")),
  );

  for (const page of offerPages.slice(0, 8)) {
    if (page.category === "utility") continue;
    const html = pageHtmlByUrl[page.url] || "";
    const name = decodeEntities(str(page.h1) || str(page.title).split(/\s*[|\-–—]\s*/)[0] || humanizePath(page.path));
    const id = `offer:${slugify(name)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const description = extractMetaDescription(html) || decodeEntities(str(page.title));
    const offerType: WebsiteOfferEvidence["offerType"] = /founder|partner programme|partner program/i.test(name + page.path)
      ? "programme"
      : /free audit|seo audit/i.test(name + page.path + page.title)
        ? "free_audit"
        : "offer";
    out.push({
      offerId: id,
      offerName: name,
      offerType,
      description: description.slice(0, 320),
      sourceUrl: page.url,
      extractionMethod: page.category === "offer" ? "offer-page" : "commercial-offer-signal",
      confidence: page.category === "offer" ? 82 : 70,
      evidence: evidence(page.url, page.category === "offer" ? 82 : 70, "commercial-offer-page"),
    });
  }
  return out.slice(0, 12);
}

function humanizePath(path: string): string {
  const leaf = path.split("/").filter(Boolean).pop() || path;
  return leaf.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

const CTA_PATTERNS: Array<{ re: RegExp; confidence: number }> = [
  { re: /\brequest (?:a )?(?:free )?audit\b/i, confidence: 88 },
  { re: /\bbook (?:a )?(?:free )?(?:consultation|call|demo)\b/i, confidence: 86 },
  { re: /\bget started\b/i, confidence: 80 },
  { re: /\bjoin (?:the )?founder partner\b/i, confidence: 84 },
  { re: /\brequest information\b/i, confidence: 80 },
  { re: /\bget (?:a )?quote\b/i, confidence: 84 },
  { re: /\bcontact us\b/i, confidence: 72 },
  { re: /\bstart (?:your )?growth\b/i, confidence: 78 },
  { re: /\bfind out more\b/i, confidence: 68 },
  { re: /\blearn more\b/i, confidence: 65 },
];

const NAV_ONLY_LABELS = /^(home|about|about us|blog|faq|faqs|services|privacy|terms|cookies?|login|sign in)$/i;

export function extractCommercialCtasFromHtml(html: string, sourceUrl: string): WebsiteCtaEvidence[] {
  const out: WebsiteCtaEvidence[] = [];
  const seen = new Set<string>();

  // Prefer anchor/button texts over raw body matches.
  const clickable = [...html.matchAll(/<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)].map((m) =>
    decodeEntities(m[1].replace(/<[^>]+>/g, " ")),
  );
  for (const label of clickable) {
    if (!label || label.length > 60 || NAV_ONLY_LABELS.test(label)) continue;
    for (const pattern of CTA_PATTERNS) {
      const m = label.match(pattern.re);
      if (!m) continue;
      const text = m[0];
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ctaText: text,
        sourceUrl,
        associatedPageTitle: "",
        associatedCategory: "",
        extractionMethod: "clickable-cta",
        confidence: pattern.confidence,
        evidence: evidence(sourceUrl, pattern.confidence, "clickable-cta"),
      });
    }
  }

  if (!out.length) {
    const text = stripHtml(html);
    for (const pattern of CTA_PATTERNS) {
      const m = text.match(pattern.re);
      if (!m) continue;
      out.push({
        ctaText: m[0],
        sourceUrl,
        associatedPageTitle: "",
        associatedCategory: "",
        extractionMethod: "body-cta",
        confidence: Math.max(55, pattern.confidence - 10),
        evidence: evidence(sourceUrl, Math.max(55, pattern.confidence - 10), "body-cta"),
      });
      break;
    }
  }

  return out.slice(0, 8);
}

export function buildCtaEvidenceFromPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
): WebsiteCtaEvidence[] {
  const out: WebsiteCtaEvidence[] = [];
  const seen = new Set<string>();
  const targets = pages.filter((p) =>
    ["homepage", "service-page", "pricing", "offer", "landing", "contact", "about"].includes(p.category),
  );
  for (const page of targets.slice(0, 20)) {
    const html = pageHtmlByUrl[page.url] || "";
    if (!html) continue;
    for (const row of extractCommercialCtasFromHtml(html, page.url)) {
      const key = `${row.ctaText.toLowerCase()}|${page.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...row,
        associatedPageTitle: decodeEntities(page.title || ""),
        associatedCategory: page.category,
      });
    }
  }
  return out.slice(0, 24);
}

export function buildTrustEvidenceFromPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
): WebsiteTrustEvidence[] {
  const out: WebsiteTrustEvidence[] = [];
  const aboutPages = pages.filter((p) => p.category === "about" || /about/i.test(p.path));
  for (const page of aboutPages.slice(0, 4)) {
    const html = pageHtmlByUrl[page.url] || "";
    const meta = extractMetaDescription(html);
    const title = decodeEntities(str(page.title));
    const h1 = decodeEntities(str(page.h1));
    if (meta) {
      out.push({
        kind: "about_description",
        value: meta.slice(0, 400),
        sourceUrl: page.url,
        extractionMethod: "about-meta-description",
        confidence: 80,
        evidence: evidence(page.url, 80, "about-meta-description"),
      });
    } else if (title || h1) {
      out.push({
        kind: "about_description",
        value: (title || h1).slice(0, 400),
        sourceUrl: page.url,
        extractionMethod: "about-page-inventory",
        confidence: 62,
        evidence: evidence(page.url, 62, "about-page-inventory"),
      });
    }

    if (!html) continue;
    const text = stripHtml(html);
    const founder = text.match(
      /\b(?:[Ff]ounded by|[Ff]ounder|[Cc]o-?founder)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/,
    );
    if (founder) {
      out.push({
        kind: "founder",
        value: founder[0].slice(0, 120),
        sourceUrl: page.url,
        extractionMethod: "about-founder-text",
        confidence: 74,
        evidence: evidence(page.url, 74, "about-founder-text"),
      });
    }
    const years = text.match(/\b(?:over|more than)?\s*\d{1,2}\+?\s+years?\b(?:\s+(?:of\s+)?(?:experience|in (?:the )?pharmacy))?/i);
    if (years) {
      out.push({
        kind: "experience",
        value: years[0].replace(/\s+/g, " ").trim(),
        sourceUrl: page.url,
        extractionMethod: "about-experience-text",
        confidence: 72,
        evidence: evidence(page.url, 72, "about-experience-text"),
      });
    }
    const guarantee = text.match(/\b(?:guaranteed?|money[- ]back|risk[- ]free)\b[^.!?]{0,80}/i);
    if (guarantee) {
      out.push({
        kind: "guarantee",
        value: guarantee[0].replace(/\s+/g, " ").trim().slice(0, 160),
        sourceUrl: page.url,
        extractionMethod: "about-guarantee-text",
        confidence: 68,
        evidence: evidence(page.url, 68, "about-guarantee-text"),
      });
    }
    const testimonial = html.match(/<(?:blockquote|div)[^>]*(?:testimonial|review)[^>]*>([\s\S]*?)<\/(?:blockquote|div)>/i);
    if (testimonial) {
      const value = stripHtml(testimonial[1]).slice(0, 220);
      if (value.length > 24) {
        out.push({
          kind: "testimonial",
          value,
          sourceUrl: page.url,
          extractionMethod: "about-testimonial-block",
          confidence: 70,
          evidence: evidence(page.url, 70, "about-testimonial-block"),
        });
      }
    }
  }

  // Case studies from inventory classification.
  for (const page of pages.filter((p) => /case-stud/i.test(p.path + p.title)).slice(0, 4)) {
    out.push({
      kind: "case_study",
      value: decodeEntities(str(page.title) || str(page.h1) || page.path),
      sourceUrl: page.url,
      extractionMethod: "case-study-page",
      confidence: 70,
      evidence: evidence(page.url, 70, "case-study-page"),
    });
  }

  return out.slice(0, 20);
}

function platformFromUrl(url: string): WebsiteSocialProfileEvidence["platform"] | null {
  const u = url.toLowerCase();
  if (/facebook\.com\//.test(u)) return "facebook";
  if (/instagram\.com\//.test(u)) return "instagram";
  if (/linkedin\.com\//.test(u)) return "linkedin";
  if (/(?:twitter|x)\.com\//.test(u)) return "x";
  if (/youtube\.com\/|youtu\.be\//.test(u)) return "youtube";
  return null;
}

export function isRejectedSocialUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (!/^https?:\/\//i.test(u)) return true;
  // Generic platform homepages / share / login / intent links.
  if (/\/sharer\.php|\/share\b|intent\/tweet|\/login|\/signup|\/oauth|\/shareArticle/i.test(u)) return true;
  if (/facebook\.com\/?(sharer|dialog|plugins)?\/?(\?|$)/i.test(u)) return true;
  if (/instagram\.com\/?(\?|$)/i.test(u)) return true;
  if (/linkedin\.com\/?(company)?\/?(\?|$)/i.test(u) && !/linkedin\.com\/company\/[a-z0-9-]+/i.test(u) && !/linkedin\.com\/in\//i.test(u)) {
    return true;
  }
  if (/(?:twitter|x)\.com\/?(home)?\/?(\?|$)/i.test(u)) return true;
  if (/youtube\.com\/?(watch|results|feed)?\/?(\?|$)/i.test(u) && !/youtube\.com\/(@|channel\/|c\/|user\/)/i.test(u)) {
    return true;
  }
  return false;
}

export function extractSocialProfileEvidenceFromHtml(html: string, sourceUrl: string): WebsiteSocialProfileEvidence[] {
  const out: WebsiteSocialProfileEvidence[] = [];
  const seen = new Set<string>();
  const hrefs = [...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]);
  for (const href of hrefs) {
    const platform = platformFromUrl(href);
    if (!platform) continue;
    if (isRejectedSocialUrl(href)) continue;
    const key = href.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      platform,
      url: href,
      sourceUrl,
      extractionMethod: "external-social-link",
      confidence: 82,
      evidence: evidence(sourceUrl, 82, "external-social-link"),
    });
  }
  return out.slice(0, 12);
}

export function buildSocialProfileEvidenceFromPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
  homepageHtml = "",
  homepageUrl = "",
): WebsiteSocialProfileEvidence[] {
  const out: WebsiteSocialProfileEvidence[] = [];
  const seen = new Set<string>();
  const add = (rows: WebsiteSocialProfileEvidence[]) => {
    for (const row of rows) {
      const key = row.url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  };
  if (homepageHtml && homepageUrl) add(extractSocialProfileEvidenceFromHtml(homepageHtml, homepageUrl));
  for (const page of pages.filter((p) => p.category === "contact" || p.category === "about").slice(0, 4)) {
    const html = pageHtmlByUrl[page.url];
    if (html) add(extractSocialProfileEvidenceFromHtml(html, page.url));
  }
  return out.slice(0, 12);
}

/** Visible emails from HTML (mailto + domain-aligned text). */
export function extractEmailCandidatesFromHtml(
  html: string,
  sourceUrl: string,
  host: string,
): Array<{ value: string; confidence: number; sourceUrl: string; detectionMethod: string }> {
  const out: Array<{ value: string; confidence: number; sourceUrl: string; detectionMethod: string }> = [];
  const seen = new Set<string>();
  const hostCore = host.replace(/^www\./, "").toLowerCase();
  const push = (value: string, confidence: number, method: string) => {
    const email = value.trim().toLowerCase();
    if (!email || seen.has(email)) return;
    if (/wordpress|wix\.com|shopify|hosting|sentry\.io|w3\.org|schema\.org/i.test(email)) return;
    seen.add(email);
    out.push({ value: email, confidence, sourceUrl, detectionMethod: method });
  };

  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) {
    push(m[1], 88, "mailto-link");
  }
  for (const m of stripHtml(html).matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    const email = m[0].toLowerCase();
    const conf = email.includes(hostCore) ? 80 : 62;
    // Prefer business-domain emails; still keep others if not provider noise.
    push(email, conf, "visible-email-text");
  }
  return out.slice(0, 8);
}
