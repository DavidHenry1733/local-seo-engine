/**
 * Generic Brand DNA footer profile — structured evidence, no copied HTML.
 */
import type { NavLink } from "../generator/brandImporter.ts";
import type { BrandDnaFooterEvidence, BrandDnaFooterProfile } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { isValidConfirmedNavUrl } from "./pharmacyBrandDnaConfirmedNavigation.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function resolveBrandDnaFooterProfile(brand: BrandDNA | BrandDnaV1): BrandDnaFooterProfile {
  const evidence = brand.footerEvidence;
  const footerBlock = brand.footer;
  const semantic = brand.semanticColours;
  const importedFooter = Boolean(brand.provenance?.websiteImport && evidence);

  return {
    variant: brand.components?.footerVariant,
    background: evidence?.background || semantic?.footerBackground || brand.colours.footerBackground,
    backgroundPattern: evidence?.backgroundPattern,
    bottomBarBackground:
      evidence?.bottomBarBackground || semantic?.footerBottomBarBackground || brand.colours.footerBackground,
    textColour: evidence?.textColour || semantic?.footerText || brand.colours.footerText,
    headingColour: evidence?.headingColour || semantic?.footerText || brand.colours.footerText,
    linkColour: evidence?.linkColour || semantic?.footerLink || brand.colours.footerLink,
    logo: footerBlock?.showLogo ?? evidence?.showLogo ?? true,
    description: evidence?.description,
    badges: evidence?.badges || [],
    badgeAssets: evidence?.badgeAssets || [],
    socialLinks: sanitizeFooterLinks(evidence?.socialLinks || []),
    confirmedItems: sanitizeFooterLinks(footerBlock?.confirmedItems || []),
    legalItems: sanitizeFooterLinks(footerBlock?.legalItems || []),
    openingHoursLayout: evidence?.openingHoursLayout || "table",
    contactLayout: evidence?.contactLayout || "column",
    regulatoryRows: evidence?.regulatoryRows || [],
    copyrightText: evidence?.copyrightText,
    attributionText: evidence?.attributionText,
    backToTop: evidence?.backToTop ?? false,
    columnCount: footerBlock?.columnCount || evidence?.columnCount || 4,
    columnOrder: evidence?.columnOrder || ["about", "quickLinks", "openingHours", "contact"],
    columnWidths: evidence?.columnWidths || "2.2fr 1fr 1.15fr 1.5fr",
    backgroundTreatment: evidence?.backgroundPattern
      ? "pattern-imported"
      : evidence?.backgroundTreatment || "pattern-generic",
    hasOpeningHours: importedFooter ? evidence?.hasOpeningHours === true : (evidence?.hasOpeningHours ?? true),
    hasContactBlock: importedFooter ? evidence?.hasContactBlock === true : (evidence?.hasContactBlock ?? true),
    hasQuickLinks: importedFooter ? evidence?.hasQuickLinks === true : (evidence?.hasQuickLinks ?? true),
    hasSocialLinks: importedFooter ? evidence?.hasSocialLinks === true : (evidence?.hasSocialLinks ?? false),
    hasRegulatoryRow: evidence?.hasRegulatoryRow ?? false,
    hasCopyrightRow: evidence?.hasCopyrightRow ?? true,
    hasLegalLinks: evidence?.hasLegalLinks ?? false,
  };
}

function sanitizeFooterLinks(items: NavLink[]): NavLink[] {
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const item of items) {
    const label = str(item.label);
    const href = str(item.href);
    if (!label || !isValidConfirmedNavUrl(href)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
  }
  return out;
}

export function footerEvidenceFromProfile(profile: BrandDnaFooterProfile): BrandDnaFooterEvidence {
  return {
    background: profile.background || "#0f172a",
    bottomBarBackground: profile.bottomBarBackground || profile.background || "#0f172a",
    headingColour: profile.headingColour || "#ffffff",
    textColour: profile.textColour || "#ffffff",
    linkColour: profile.linkColour || "#ffffff",
    columnCount: profile.columnCount || 4,
    showLogo: profile.logo ?? true,
    hasDescriptionBlock: Boolean(profile.description),
    hasQuickLinks: profile.hasQuickLinks ?? true,
    hasOpeningHours: profile.hasOpeningHours ?? true,
    hasContactBlock: profile.hasContactBlock ?? true,
    hasSocialLinks: (profile.socialLinks?.length || 0) > 0,
    hasRegulatoryRow: profile.hasRegulatoryRow ?? false,
    hasCopyrightRow: profile.hasCopyrightRow ?? true,
    hasLegalLinks: (profile.legalItems?.length || 0) > 0,
    backgroundPattern: profile.backgroundPattern,
    description: profile.description,
    badges: profile.badges,
    badgeAssets: profile.badgeAssets,
    socialLinks: profile.socialLinks,
    openingHoursLayout: profile.openingHoursLayout,
    contactLayout: profile.contactLayout,
    regulatoryRows: profile.regulatoryRows,
    copyrightText: profile.copyrightText,
    attributionText: profile.attributionText,
    backToTop: profile.backToTop,
    columnOrder: profile.columnOrder,
  };
}
