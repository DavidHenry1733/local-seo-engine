/**
 * Generic commercial service evidence from tenant website pages (nav, service pages, headings).
 * Does not write to the canonical Product Owner service library.
 *
 * Only genuine SERVICE pages are admitted. Pricing, offers, articles, landings, and utilities
 * are excluded here and handled by sibling commercial intelligence extractors.
 */
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import type { WebsiteImportEvidence } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import { extractCommercialCtasFromHtml } from "./growthEngineWebsiteBusinessIntelligenceEvidence.ts";

export interface WebsiteCommercialServiceEvidence {
  serviceId: string;
  serviceName: string;
  sourceUrl: string;
  pageTitle: string;
  h1: string;
  description: string;
  ctaEvidence: string;
  valueProposition: string;
  detectionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function humanizePath(path: string): string {
  const leaf = path.split("/").filter(Boolean).pop() || path;
  return leaf
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
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

function extractMetaDescription(html: string): string {
  return decodeEntities(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
      || "",
  );
}

function looksLikeMarketingSlogan(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length > 72) return true;
  if (/^(be the |protect your |built for |affordable |how a |why |see where )/i.test(t)) return true;
  if (/\b(first choice|patient loyalty|real pharmacies|solutions for)\b/i.test(t) && !/\b(website design|local seo|hosting|email)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Prefer a stable service label from title/path over a marketing H1 slogan.
 */
export function resolveCommercialServiceLabel(page: Pick<WebsitePageInventoryItem, "path" | "title" | "h1">): string {
  const titlePrimary = decodeEntities(str(page.title).split(/\s*[|\-–—]\s*/)[0] || "");
  const pathLabel = humanizePath(page.path || "");
  const h1 = decodeEntities(str(page.h1));

  const pathLooksCommercial =
    /(website design|web design|local seo|email marketing|email communication|website hosting|web hosting|digital marketing)/i.test(
      pathLabel,
    );

  if (titlePrimary && !looksLikeMarketingSlogan(titlePrimary) && titlePrimary.length >= 4) {
    // Prefer title when it names the service category.
    if (/(website design|local seo|hosting|email|marketing|seo)/i.test(titlePrimary) || pathLooksCommercial) {
      return titlePrimary;
    }
  }
  if (pathLooksCommercial) return pathLabel;
  if (h1 && !looksLikeMarketingSlogan(h1)) return h1;
  if (titlePrimary) return titlePrimary;
  if (pathLabel) return pathLabel;
  return h1;
}

function isEligibleServicePage(page: WebsitePageInventoryItem): boolean {
  if (page.isContentPage === false) return false;
  if (page.path === "/" || page.path === "") return false;
  // Genuine dedicated service pages only — never pricing/offer/blog/landing/utility.
  if (page.category !== "service-page") return false;
  const p = (page.path || "").toLowerCase();
  if (/\/\d{4}\/\d{2}\//.test(p)) return false;
  if (/(hero-\d+|form|thank-you|import-test|-landing|founder-partner|prices|pricing|packages)/i.test(p)) {
    return false;
  }
  return true;
}

/**
 * Build commercial service evidence from analysed dedicated service pages only.
 */
export function buildCommercialServiceEvidenceFromPages(
  pages: WebsitePageInventoryItem[],
  pageHtmlByUrl: Record<string, string>,
): WebsiteCommercialServiceEvidence[] {
  const out: WebsiteCommercialServiceEvidence[] = [];
  const seen = new Set<string>();

  const candidates = pages.filter(isEligibleServicePage);

  for (const page of candidates) {
    const html = pageHtmlByUrl[page.url] || "";
    const name = resolveCommercialServiceLabel(page);
    if (!name || name.length < 3) continue;

    const id = `website:${slugify(name)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const description = extractMetaDescription(html);
    const ctas = extractCommercialCtasFromHtml(html, page.url);
    const cta = ctas[0]?.ctaText || "";
    const valueProposition = extractValueProposition(html);
    const confidence = 84;

    out.push({
      serviceId: id,
      serviceName: name,
      sourceUrl: page.url,
      pageTitle: decodeEntities(page.title || ""),
      h1: decodeEntities(page.h1 || ""),
      description,
      ctaEvidence: cta,
      valueProposition,
      detectionMethod: page.discoverySource ? `service-page:${page.discoverySource}` : "service-page",
      confidence,
      evidence: {
        sourceUrl: page.url,
        confidence,
        detectionMethod: "commercial-service-page",
        detectedAt: nowIso(),
      },
    });
  }

  return out.slice(0, 24);
}

function extractValueProposition(html: string): string {
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (h2 && h2.length >= 12 && h2.length <= 160) return decodeEntities(h2);
  const lead = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
    ?.replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return lead && lead.length <= 220 ? decodeEntities(lead) : "";
}
