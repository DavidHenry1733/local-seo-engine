/**
 * RC1-C13 — Role-specific colour tokens from persisted design evidence.
 */
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import { buildSiteChromeColourTokensFromDesignIntelligence, tryLoadDesignIntelligence } from "./pharmacyDesignIntelligenceResolver.ts";
import { hasActivatedTenantDesignDna } from "./pharmacyTenantDnaRenderActivation.ts";

export interface SiteChromeColourRole {
  role: string;
  hex: string;
  selector: string;
  source: string;
}

export interface SiteChromeColourTokens {
  headerBackground: string;
  headerText: string;
  primaryNavigationText: string;
  ctaBackground: string;
  ctaText: string;
  headingText: string;
  bodyText: string;
  linkColour: string;
  borderColour: string;
  upperFooterBackground: string;
  lowerFooterBackground: string;
  footerHeadingColour: string;
  footerTextColour: string;
  footerLinkColour: string;
  socialIconColour: string;
  roles: SiteChromeColourRole[];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeHex(value: string): string {
  const v = str(value).toLowerCase();
  if (!v) return "";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const rgba = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (rgba) {
    const alpha = rgba[4] !== undefined ? Number(rgba[4]) : 1;
    if (alpha === 0) return "transparent";
    const [r, g, b] = rgba.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0"));
    return `#${r}${g}${b}`;
  }
  return v;
}

function pickRoleColour(
  evidence: WebsiteDesignEvidence | null,
  roleNames: string[],
  fallback: string,
): SiteChromeColourRole {
  if (!evidence) {
    return { role: roleNames[0] || "unknown", hex: fallback, selector: "", source: "fallback" };
  }

  const pools = [
    ...(evidence.colourSystem?.header || []),
    ...(evidence.colourSystem?.text || []),
    ...(evidence.colourSystem?.footer || []),
    ...(evidence.colourSystem?.button || []),
    ...(evidence.colourSystem?.background || []),
    ...(evidence.colourSystem?.link || []),
    ...(evidence.colourSystem?.border || []),
    ...(evidence.header?.evidence || []),
    ...(evidence.footer?.evidence || []),
  ];

  for (const roleName of roleNames) {
    const match = pools.find((t) => {
      const role = str("role" in t ? t.role : "");
      return role.toLowerCase() === roleName.toLowerCase();
    });
    if (match) {
      const hex = normalizeHex(str("hex" in match ? match.hex : "computedValue" in match ? match.computedValue : ""));
      if (hex && hex !== "transparent") {
        return {
          role: roleName,
          hex,
          selector: str("selector" in match ? match.selector : ""),
          source: str("source" in match ? match.source : evidence.primaryUrl),
        };
      }
    }
  }

  return { role: roleNames[0] || "unknown", hex: fallback, selector: "", source: "fallback" };
}

export function resolveSiteChromeColourTokens(
  slug: string,
  brand?: BrandDNA | BrandDnaV1 | null,
): SiteChromeColourTokens {
  if (hasActivatedTenantDesignDna(slug)) {
    const manifest = tryLoadDesignIntelligence(slug);
    if (manifest) return buildSiteChromeColourTokensFromDesignIntelligence(manifest);
  }

  const evidence = loadWebsiteDesignEvidence(slug);
  const semantic = brand && "semanticColours" in brand ? brand.semanticColours : undefined;
  const legacy = brand && "colours" in brand ? brand.colours : undefined;

  const headerBg = pickRoleColour(evidence, ["header-background", "main-header"], normalizeHex(str(semantic?.headerBackground || legacy?.headerBackground || "#ffffff")));
  const headerText = pickRoleColour(evidence, ["header-text", "navigation-text"], normalizeHex(str(semantic?.headerText || legacy?.headerText || "#333333")));
  const navText = pickRoleColour(evidence, ["navigation-text", "header-text"], headerText.hex);
  const ctaBg = pickRoleColour(
    evidence,
    ["button-background", "cta-background", "primary-button-background"],
    normalizeHex(str(legacy?.button || legacy?.primary || semantic?.ctaBackground || brand?.colours?.primary || "#005EB8")),
  );
  const ctaText = pickRoleColour(evidence, ["button-text", "primary-button-text"], "#ffffff");
  const heading = pickRoleColour(evidence, ["heading-text", "h1-text"], normalizeHex(str(semantic?.headingPrimary || "#327c86")));
  const body = pickRoleColour(evidence, ["body-text"], normalizeHex(str(semantic?.bodyText || legacy?.text || "#333333")));
  const link = pickRoleColour(evidence, ["link-colour", "footer-link"], normalizeHex(str(semantic?.footerLink || body.hex)));
  const border = pickRoleColour(evidence, ["border-colour"], normalizeHex(str(semantic?.border || "#e5e7eb")));

  const footerUpperFallback = normalizeHex(str(semantic?.footerBackground || legacy?.footerBackground || "#000000"));
  const footerLowerFallback = normalizeHex(str(semantic?.footerBottomBarBackground || footerUpperFallback));
  const upperFooter = pickRoleColour(evidence, ["upper-footer-background", "footer-background", "footer-upper-background"], footerUpperFallback);
  const lowerFooter = pickRoleColour(evidence, ["lower-footer-background", "footer-bottom-background", "copyright-background"], footerLowerFallback);

  if (upperFooter.hex === "#ffffff" && footerUpperFallback !== "#ffffff") {
    upperFooter.hex = footerUpperFallback;
    upperFooter.source = "brand-semantic";
  }
  if (lowerFooter.hex === upperFooter.hex || lowerFooter.hex === "#ffffff") {
    lowerFooter.hex = footerLowerFallback || upperFooter.hex;
    lowerFooter.source = "brand-semantic";
  }

  const footerHeading = pickRoleColour(evidence, ["footer-heading", "footer-heading-colour"], normalizeHex(str(semantic?.footerText || "#ffffff")));
  const footerText = pickRoleColour(evidence, ["footer-text", "footer-text-colour"], footerHeading.hex);
  const footerLink = pickRoleColour(evidence, ["footer-link", "footer-link-colour"], normalizeHex(str(semantic?.footerLink || footerText.hex)));
  const socialIcon = pickRoleColour(evidence, ["social-icon", "social-icon-colour"], footerText.hex);

  const roles = [headerBg, headerText, navText, ctaBg, ctaText, heading, body, link, border, upperFooter, lowerFooter, footerHeading, footerText, footerLink, socialIcon];

  return {
    headerBackground: headerBg.hex,
    headerText: headerText.hex,
    primaryNavigationText: navText.hex,
    ctaBackground: ctaBg.hex,
    ctaText: ctaText.hex,
    headingText: heading.hex,
    bodyText: body.hex,
    linkColour: link.hex,
    borderColour: border.hex,
    upperFooterBackground: upperFooter.hex,
    lowerFooterBackground: lowerFooter.hex,
    footerHeadingColour: footerHeading.hex,
    footerTextColour: footerText.hex,
    footerLinkColour: footerLink.hex,
    socialIconColour: socialIcon.hex,
    roles,
  };
}

export function siteChromeColourCssVariables(tokens: SiteChromeColourTokens): string {
  return `--header-bg:${tokens.headerBackground};--header-text:${tokens.primaryNavigationText};--brand-nav-text:${tokens.primaryNavigationText};--brand-cta:${tokens.ctaBackground};--brand-action-text:${tokens.ctaText};--brand-footer-bg:${tokens.upperFooterBackground};--brand-footer-bottom-bg:${tokens.lowerFooterBackground};--brand-footer-text:${tokens.footerTextColour};--brand-footer-link:${tokens.footerLinkColour};--brand-footer-accent:${tokens.socialIconColour};`;
}
