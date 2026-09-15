/**
 * Strict Footer DNA consumption — render only persisted footer evidence fields.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import type { BrandDnaFooterProfile } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { resolveBrandDnaFooterProfile } from "./pharmacyBrandDnaFooterModel.ts";
import { hasActivatedTenantDesignDna } from "./pharmacyTenantDnaRenderActivation.ts";
import type { NavLink } from "../generator/brandImporter.ts";
import { resolveSiteChromeNavigation } from "./pharmacySiteChromeNavigationService.ts";
import { resolveSiteChromeColourTokens } from "./pharmacySiteChromeColourService.ts";
import { tryLoadDesignIntelligence } from "./pharmacyDesignIntelligenceResolver.ts";

export interface StrictFooterDnaComposition {
  useStrictDna: boolean;
  columnOrder: string[];
  columnCount: number;
  columnWidths: string;
  copyrightText: string;
  showQuickLinks: boolean;
  quickLinks: NavLink[];
  showOpeningHours: boolean;
  openingHoursHtml: string;
  showContactBlock: boolean;
  contactHtml: string;
  showSocialLinks: boolean;
  socialLinks: NavLink[];
  companyLinks: NavLink[];
  customerCareLinks: NavLink[];
  description: string;
  showLogo: boolean;
  showLegalLinks: boolean;
  legalLinks: NavLink[];
  attributionText: string;
  backToTop: boolean;
  backgroundTreatment: string;
  patternStyle: string;
  patternClass: string;
  backgroundColour: string;
  lowerBackgroundColour: string;
  textColour: string;
  linkColour: string;
  headingColour: string;
  paddingTop: string;
  paddingBottom: string;
  columnGap: string;
  footerCompleteness: number;
  blockRender: boolean;
  blockReasons: string[];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeHex(value: string): string {
  const v = str(value).toLowerCase();
  if (!v) return "";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const rgba = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgba) {
    const [r, g, b] = rgba.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0"));
    return `#${r}${g}${b}`;
  }
  return v;
}

function isValidHoursText(text: string): boolean {
  const t = str(text);
  if (!t || t.length > 1200) return false;
  if (/elementor-element|--display:flex|--border-style/.test(t)) return false;
  return /monday|tuesday|wednesday|thursday|friday|saturday|sunday|\bam\b|\bpm\b|opening hours/i.test(t);
}

function isValidContactText(text: string): boolean {
  const t = str(text);
  if (!t || t.length > 800) return false;
  if (/elementor-element|--display:flex/.test(t)) return false;
  return /(?:@|tel:|phone|call|address|email|\+\d|\d{5})/i.test(t);
}

function isValidNavUrl(url: string): boolean {
  const normalized = str(url);
  if (!normalized || normalized === "#" || /^javascript:/i.test(normalized)) return false;
  return true;
}

function sanitizeLinks(items: NavLink[]): NavLink[] {
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const item of items) {
    const label = str(item.label);
    const href = str(item.href);
    if (!label || !isValidNavUrl(href)) continue;
    const key = `${label.toLowerCase()}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
  }
  return out;
}

function sliceColumnWidths(widths: string, count: number): string {
  const parts = widths.split(/\s+/).filter(Boolean);
  if (parts.length >= count) return parts.slice(0, count).join(" ");
  return widths;
}

export function resolveStrictFooterDnaComposition(
  slug: string,
  brand: BrandDNA | BrandDnaV1,
  componentDna?: ComponentDna,
): StrictFooterDnaComposition {
  const footerProfile = resolveBrandDnaFooterProfile(brand);
  const useStrictDna = hasActivatedTenantDesignDna(slug);
  const designIntelligence = useStrictDna ? tryLoadDesignIntelligence(slug) : null;
  const designEvidence = designIntelligence ? null : loadWebsiteDesignEvidence(slug);
  const evidenceFooter = designEvidence?.footer;

  const hoursFromEvidence =
    !designIntelligence && designEvidence?.openingHours?.rawText && isValidHoursText(designEvidence.openingHours.rawText)
      ? designEvidence.openingHours.rawText
      : "";

  const contactFromEvidence =
    !designIntelligence &&
    (designEvidence?.contactBlocks || [])
      .map((b) => str(b.content))
      .find((c) => isValidContactText(c)) ||
    "";

  const siteChrome = useStrictDna ? resolveSiteChromeNavigation(slug) : null;
  const colourTokens = useStrictDna ? resolveSiteChromeColourTokens(slug, brand) : null;

  const quickLinksFromEvidence = sanitizeLinks(
    siteChrome?.footerCompanyLinks.length
      ? siteChrome.footerCompanyLinks.map((l) => ({ label: l.label, href: l.href }))
      : (evidenceFooter?.quickLinks || []).map((l) => ({ label: l.label, href: l.href })),
  );
  const legalLinksFromEvidence = sanitizeLinks(
    siteChrome?.footerLegalLinks.length
      ? siteChrome.footerLegalLinks.map((l) => ({ label: l.label, href: l.href }))
      : (evidenceFooter?.legalLinks || footerProfile.legalItems || []).map((l) => ({ label: l.label, href: l.href })),
  );
  const socialLinksFromEvidence = sanitizeLinks(
    siteChrome?.socialLinks.length
      ? siteChrome.socialLinks.map((l) => ({ label: l.label, href: l.href }))
      : (evidenceFooter?.socialLinks || footerProfile.socialLinks || []).map((l) => ({ label: l.label, href: l.href })),
  );

  const showQuickLinks = quickLinksFromEvidence.length > 0;
  const showOpeningHours = !designIntelligence && evidenceFooter?.openingHoursPresent === true && Boolean(hoursFromEvidence);
  const showContactBlock = !designIntelligence && evidenceFooter?.contactBlockPresent === true && Boolean(contactFromEvidence);
  const showSocialLinks = socialLinksFromEvidence.length > 0;
  const showLegalLinks = legalLinksFromEvidence.length > 0;

  const columnOrder = designIntelligence
    ? designIntelligence.footer.mobileStackOrder
        .filter((key) => key !== "copyright" && key !== "legal" && key !== "hours" && key !== "contact")
        .filter((key) => {
          if (key === "company") return showQuickLinks;
          if (key === "customerCare") return showLegalLinks;
          if (key === "social") return showSocialLinks;
          return key === "logo";
        })
    : siteChrome
    ? ["about", "company", "customerCare", "social"].filter((key) => {
        if (key === "company") return showQuickLinks;
        if (key === "customerCare") return showLegalLinks;
        if (key === "social") return showSocialLinks;
        return key === "about";
      })
    : (evidenceFooter?.columnOrder || footerProfile.columnOrder || ["about", "quickLinks"]).filter((key) => {
        if (key === "quickLinks") return showQuickLinks;
        if (key === "openingHours") return showOpeningHours;
        if (key === "contact") return showContactBlock;
        if (key === "social") return showSocialLinks;
        if (key === "legal") return showLegalLinks;
        return key === "about";
      });

  const columnCount = Math.max(columnOrder.length, 1);
  const baseWidths = componentDna?.footer?.columnWidths || footerProfile.columnWidths || "2fr 1fr 1fr";
  const columnWidths = sliceColumnWidths(baseWidths, columnCount);

  const backgroundColour =
    normalizeHex(colourTokens?.upperFooterBackground || "") ||
    normalizeHex(designIntelligence?.footer.upperLayer.backgroundColour || "") ||
    normalizeHex(str(evidenceFooter?.backgroundColour)) ||
    normalizeHex(str(footerProfile.background)) ||
    "#000000";
  const lowerBackgroundColour =
    normalizeHex(colourTokens?.lowerFooterBackground || "") ||
    normalizeHex(designIntelligence?.footer.lowerLayer.backgroundColour || "") ||
    backgroundColour;
  const textColour =
    normalizeHex(colourTokens?.footerTextColour || "") ||
    normalizeHex(str(evidenceFooter?.textColour)) ||
    normalizeHex(str(footerProfile.textColour)) ||
    "#ffffff";
  const linkColour =
    normalizeHex(colourTokens?.footerLinkColour || "") ||
    normalizeHex(str(evidenceFooter?.linkColour)) ||
    normalizeHex(str(footerProfile.linkColour)) ||
    textColour;
  const headingColour = normalizeHex(colourTokens?.footerHeadingColour || str(footerProfile.headingColour)) || textColour;

  const usePattern = backgroundColour.toLowerCase() === "#01424a" || footerProfile.backgroundTreatment === "pattern-generic";
  const patternClass = usePattern && backgroundColour !== "#ffffff" ? " site-footer--pattern" : "";
  const patternStyle = "";

  const blockReasons: string[] = [];
  if (useStrictDna && !designIntelligence && !designEvidence) blockReasons.push("design-evidence-missing");
  if (useStrictDna && designIntelligence && !showQuickLinks && !showLegalLinks && !showSocialLinks) {
    blockReasons.push("footer-content-empty");
  }

  return {
    useStrictDna,
    columnOrder,
    columnCount,
    columnWidths,
    copyrightText: str(evidenceFooter?.copyrightText) || str(footerProfile.copyrightText),
    showQuickLinks,
    quickLinks: quickLinksFromEvidence,
    companyLinks: quickLinksFromEvidence,
    customerCareLinks: legalLinksFromEvidence,
    showOpeningHours,
    openingHoursHtml: hoursFromEvidence,
    showContactBlock: false,
    contactHtml: "",
    showSocialLinks,
    socialLinks: socialLinksFromEvidence,
    showLogo: footerProfile.logo !== false,
    showLegalLinks,
    legalLinks: legalLinksFromEvidence,
    description: str(footerProfile.description),
    attributionText: str(footerProfile.attributionText),
    backToTop: componentDna?.footer?.backToTop ?? footerProfile.backToTop ?? false,
    backgroundTreatment: patternClass ? "pattern-generic" : "solid",
    patternClass,
    patternStyle,
    backgroundColour,
    lowerBackgroundColour,
    textColour,
    linkColour,
    headingColour,
    paddingTop: str(designIntelligence?.footer.upperLayer.paddingTop || evidenceFooter?.paddingTop) || "0px",
    paddingBottom: str(designIntelligence?.footer.upperLayer.paddingBottom || evidenceFooter?.paddingBottom) || "0px",
    columnGap: str(evidenceFooter?.columnGap) || str(componentDna?.footer?.columnGap) || "40px",
    footerCompleteness: evidenceFooter?.completeness ?? 0,
    blockRender: blockReasons.length > 0,
    blockReasons,
  };
}

export function shouldUseStrictFooterDna(slug: string): boolean {
  return hasActivatedTenantDesignDna(slug);
}

export function strictFooterOmitsProfileInjection(_profile: PharmacyServicePageProfile, composition: StrictFooterDnaComposition): boolean {
  return composition.useStrictDna;
}
