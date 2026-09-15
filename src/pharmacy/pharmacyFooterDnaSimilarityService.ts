/**
 * Footer DNA fidelity — rendered footer vs persisted Footer DNA expectations.
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import { resolveStrictFooterDnaComposition } from "./pharmacyStrictFooterDnaService.ts";

export const FOOTER_DNA_MIN_SIMILARITY = 95;

export interface FooterDnaSimilarityResult {
  similarity: number;
  pass: boolean;
  checks: Record<string, boolean>;
  expectedColumns: number;
  renderedColumns: number;
}

function parseFooterFromHtml(html: string) {
  const footerMatch = html.match(/<footer[^>]*data-footer-dna="strict"[^>]*>([\s\S]*?)<\/footer>/i)
    || html.match(/<footer[^>]*id="site-footer"[^>]*>([\s\S]*?)<\/footer>/i);
  const footerHtml = footerMatch?.[0] || "";
  const columnCount = Number((footerHtml.match(/data-footer-columns="(\d+)"/i)?.[1] || "0"));
  const renderedColumns = (footerHtml.match(/class="footer-col\b/g) || []).length;
  return {
    footerHtml,
    strict: /data-footer-dna="strict"/.test(footerHtml),
    columnCount,
    renderedColumns,
    hasQuickLinks: /footer-col--links/.test(footerHtml),
    hasHours: /footer-col--hours/.test(footerHtml),
    hasContact: /footer-col--contact/.test(footerHtml),
    hasProfilePhone: /footer-contact-row/.test(footerHtml) && /tel:|phone/i.test(footerHtml),
    hasPlaceholderHours: /Pharmacy Working Hours/.test(footerHtml) && !/footer-hours-row|footer-hours-text/.test(footerHtml),
    bgStyle: footerHtml.match(/style="[^"]*--footer-pattern-url/i)?.[0] || "",
    columnWidths: footerHtml.match(/--footer-column-widths:([^";]+)/i)?.[1]?.trim() || "",
  };
}

export function measureFooterDnaSimilarity(
  slug: string,
  html: string,
  brand: BrandDNA | BrandDnaV1,
  componentDna?: ComponentDna,
): FooterDnaSimilarityResult {
  const composition = resolveStrictFooterDnaComposition(slug, brand, componentDna);
  const parsed = parseFooterFromHtml(html);
  const expectedColumns = composition.columnOrder.filter((key) => {
    if (key === "about") return composition.showLogo || Boolean(composition.description);
    if (key === "quickLinks") return composition.showQuickLinks && composition.quickLinks.length > 0;
    if (key === "openingHours") return composition.showOpeningHours && Boolean(composition.openingHoursHtml);
    if (key === "contact") return composition.showContactBlock && Boolean(composition.contactHtml);
    return false;
  }).length || (composition.showQuickLinks ? 1 : 0) + 1;

  const checks: Record<string, boolean> = {
    strictMode: parsed.strict || composition.useStrictDna,
    columnCountMatch: parsed.renderedColumns === expectedColumns,
    backgroundColourMatch: !composition.backgroundColour || parsed.footerHtml.includes(composition.backgroundColour),
    noInjectedQuickLinks: !parsed.hasQuickLinks || composition.showQuickLinks,
    noInjectedHours: !parsed.hasHours || composition.showOpeningHours,
    noInjectedContact: !parsed.hasContact || composition.showContactBlock,
    noProfileContactInjection: !parsed.hasProfilePhone || !composition.useStrictDna,
    quickLinksWhenEvidence: !composition.showQuickLinks || parsed.hasQuickLinks,
    columnWidthsMatch: !composition.columnWidths || parsed.columnWidths.includes(composition.columnWidths.split(" ")[0]),
    copyrightPresent: /footer-copyright/.test(parsed.footerHtml),
  };

  const weights = Object.keys(checks);
  const earned = weights.filter((k) => checks[k]).length;
  const similarity = Math.round((earned / weights.length) * 100);

  return {
    similarity,
    pass: similarity >= FOOTER_DNA_MIN_SIMILARITY,
    checks,
    expectedColumns,
    renderedColumns: parsed.renderedColumns,
  };
}
