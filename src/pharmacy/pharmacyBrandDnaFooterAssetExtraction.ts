/**
 * Footer trust / identity asset extraction from imported website HTML.
 */
import * as cheerio from "cheerio";
import type { BrandDnaFooterBadgeAsset } from "./pharmacyBrandDnaSemanticTypes.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function resolveAssetUrl(src: string, baseUrl: string): string {
  const normalized = str(src);
  if (!normalized) return "";
  try {
    return new URL(normalized, baseUrl).href;
  } catch {
    return normalized;
  }
}

function badgeIdFromUrl(url: string, label: string): string {
  const file = url.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") || label;
  return file.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "footer-badge";
}

function inferBadgeLabel(alt: string, src: string): string {
  const fromAlt = str(alt);
  if (fromAlt && !/^logo$/i.test(fromAlt)) return fromAlt;
  if (/nhs/i.test(src)) return "NHS Services";
  if (/gphc/i.test(src)) return "GPhC Registered";
  return "Trust badge";
}

function isPharmacyTrustAsset(src: string, alt: string, className: string): boolean {
  const haystack = `${src} ${alt} ${className}`.toLowerCase();
  return /nhs|gphc|cqc|trust|accredit|badge|compliance|registered/.test(haystack);
}

export function extractFooterTrustBadgeAssets(
  footerHtml: string,
  sourceUrl: string,
  tenantSlug: string,
  importedAt = new Date().toISOString(),
): BrandDnaFooterBadgeAsset[] {
  if (!footerHtml.trim()) return [];
  const $ = cheerio.load(footerHtml);
  const out: BrandDnaFooterBadgeAsset[] = [];
  const seen = new Set<string>();

  $("img").each((_, el) => {
    const src = str($(el).attr("src"));
    if (!src || /logo|brand-logo|favicon/i.test(src)) return;
    const alt = str($(el).attr("alt"));
    const className = str($(el).attr("class"));
    const parentClass = str($(el).parent().attr("class"));
    if (!isPharmacyTrustAsset(src, alt, `${className} ${parentClass}`)) return;

    const sourcePath = resolveAssetUrl(src, sourceUrl);
    if (!sourcePath || seen.has(sourcePath)) return;
    seen.add(sourcePath);

    const label = inferBadgeLabel(alt, src);
    out.push({
      id: badgeIdFromUrl(sourcePath, label),
      label,
      sourceUrl: sourcePath,
      altText: alt || label,
      width: Number($(el).attr("width")) || undefined,
      height: Number($(el).attr("height")) || undefined,
      sourcePage: sourceUrl,
      sourceSelector: className ? `img.${className.split(/\s+/)[0]}` : "footer img",
      confidence: /nhs/i.test(`${src} ${alt}`) ? 94 : 82,
      importedAt,
      tenantSlug,
      usageStatus: "approved",
    });
  });

  return out.sort((a, b) => {
    const rank = (item: BrandDnaFooterBadgeAsset) => (/nhs/i.test(item.label) ? 0 : /gphc/i.test(item.label) ? 1 : 2);
    return rank(a) - rank(b);
  });
}
