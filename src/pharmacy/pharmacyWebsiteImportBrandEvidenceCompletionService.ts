/**
 * CPR-RESET-06 — Complete remaining Website Import brand evidence from stored tenant sources.
 */
import fs from "node:fs";
import path from "node:path";
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import { DESIGN_INTELLIGENCE_VERSION, type DesignIntelligenceManifest } from "./pharmacyDesignIntelligenceHierarchyModel.ts";
import { loadBrandDnaV1File } from "./pharmacyBrandDnaStore.ts";
import { resolveComponentDna } from "./pharmacyComponentDnaResolver.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { PHARMACY_WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import { loadWebsiteDesignIntelligence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { computeWebsiteImportRevision } from "./pharmacyDesignLineageRevisionService.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function designEvidenceRoot(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", safePharmacySlug(slug));
}

function manifestHasMeaningfulContent(manifest: DesignIntelligenceManifest | null): boolean {
  if (!manifest) return false;
  return Boolean(
    str(manifest.header?.logoBlock?.logoUrl) ||
      manifest.navigation?.tree?.length ||
      manifest.footer?.groups?.length ||
      manifest.colours?.length ||
      str(manifest.header?.navigationBlock?.navPlacement),
  );
}

export function buildDesignIntelligenceFromStoredBrandEvidence(slug: string): DesignIntelligenceManifest | null {
  const brand = loadBrandDnaV1File(slug);
  if (!brand) return null;

  let component: ComponentDna | null = null;
  try {
    component = resolveComponentDna(brand);
  } catch {
    component = null;
  }

  const header = (component?.header || {}) as Record<string, unknown>;
  const footer = (component?.footer || {}) as Record<string, unknown>;
  const cta = (component?.cta || {}) as Record<string, unknown>;
  const navLinks = (brand.navigationLinks || []).filter((l) => str(l.label) && str(l.href));
  const footerLinks = (brand.footerLinks || []).filter((l) => str(l.label) && str(l.href));
  const capturedAt = str(brand.frozenAt || brand.generatedAt) || new Date().toISOString();
  const profile = readSetupProfile(slug);
  const snapIntel = (profile.websiteImportSnapshot as { intelligence?: import("./growthEngineWebsiteIntelligenceImportV2Model.ts").WebsiteIntelligenceImportV2 | null } | null)?.intelligence || null;
  const sourceRevision = str(brand.sourceImportRevision) || computeWebsiteImportRevision(profile, snapIntel);

  const tree = navLinks.slice(0, 12).map((link, index) => ({
    id: `nav-${index + 1}`,
    parentId: null as string | null,
    depth: 0,
    role: "primary-navigation" as const,
    order: index + 1,
    selector: "header nav a",
    href: str(link.href),
    text: str(link.label),
    visibility: "visible" as const,
    breakpointVisibility: { desktop: true, tablet: true, mobile: true },
  }));

  const footerGroups = [
    {
      id: "footer-primary",
      role: "company" as const,
      selector: "footer",
      heading: "Footer",
      links: footerLinks.slice(0, 12).map((link) => ({
        text: str(link.label),
        href: str(link.href),
        selector: "footer a",
      })),
      backgroundColour: str(brand.footerEvidence?.background || brand.colours?.footerBackground),
      textColour: str(brand.footerEvidence?.textColour || brand.colours?.footerText),
    },
  ];

  const colours = [
    brand.colours?.primary,
    brand.colours?.secondary,
    brand.colours?.accent,
    brand.colours?.headerBackground,
    brand.colours?.footerBackground,
  ]
    .filter(Boolean)
    .map((hex, index) => ({
      role: ["primary", "secondary", "accent", "header-background", "footer-background"][index] || "accent",
      selector: ":root",
      computedColour: str(hex),
      hex: str(hex),
      layer: (index >= 3 ? "footer-upper" : "body") as "body",
    }));

  return {
    version: DESIGN_INTELLIGENCE_VERSION,
    tenant: safePharmacySlug(slug),
    sourceRevision,
    capturedAt,
    primaryUrl: str(brand.sourceUrl),
    navigation: {
      tree,
      hierarchyDepth: tree.length ? 1 : 0,
      rootId: tree[0]?.id || "nav-root",
    },
    header: {
      rowCount: brand.layout?.topInfoBar ? 2 : 1,
      announcementBar: brand.layout?.topInfoBar
        ? {
            selector: ".top-header",
            backgroundColour: str(brand.colours?.topBarBackground),
            textColour: str(brand.colours?.topBarText),
            paddingTop: "",
            paddingBottom: "",
            paddingLeft: "",
            paddingRight: "",
            alignment: "center",
            sticky: false,
          }
        : null,
      logoBlock: {
        selector: "header .logo img",
        backgroundColour: str(brand.colours?.headerBackground),
        textColour: str(brand.colours?.headerText),
        paddingTop: "",
        paddingBottom: "",
        paddingLeft: "",
        paddingRight: "",
        alignment: "left",
        sticky: false,
        logoUrl: str(brand.logoUrl),
        logoMaxHeight: str(brand.layout?.logoMaxHeight || header.logoMaxHeight || "48px"),
        logoPosition: str(header.logoPosition || "left"),
      },
      navigationBlock: {
        selector: "header nav",
        backgroundColour: str(brand.colours?.headerBackground),
        textColour: str(brand.colours?.headerText),
        paddingTop: "",
        paddingBottom: "",
        paddingLeft: "",
        paddingRight: "",
        alignment: "end",
        sticky: false,
        navPlacement: str(header.navigationVariant || brand.layout?.navigationStyle || "inline"),
        mobileMenuBehaviour: str(header.mobileHeaderVariant || "stacked"),
      },
      ctaBlock: {
        selector: "header .btn, header .theme-btn",
        backgroundColour: str(brand.colours?.button),
        textColour: str(brand.colours?.buttonText),
        paddingTop: "",
        paddingBottom: "",
        paddingLeft: "",
        paddingRight: "",
        alignment: "right",
        sticky: false,
        labels: [str(brand.headerCtaText)].filter(Boolean),
        hrefs: [str(brand.headerCtaUrl)].filter(Boolean),
      },
      spacing: { paddingY: "", paddingX: "", gap: str(header.navGap || "16px") },
      alignment: { logo: "left", nav: "center", cta: "right" },
      sticky: Boolean(header.sticky),
      responsive: {
        desktopBreakpoint: str(header.desktopBreakpoint || "980px"),
        mobileMenuBehaviour: str(header.mobileHeaderVariant || "stacked"),
      },
    },
    footer: {
      upperLayer: {
        selector: "footer",
        backgroundColour: str(brand.footerEvidence?.background || brand.colours?.footerBackground),
        textColour: str(brand.footerEvidence?.textColour || brand.colours?.footerText),
        linkColour: str(brand.footerEvidence?.linkColour || brand.colours?.footerLink),
        paddingTop: str(footer.sectionPaddingTop || "56px"),
        paddingBottom: str(footer.sectionPaddingBottom || "0"),
      },
      lowerLayer: {
        selector: "footer .footer-bottom",
        backgroundColour: str(brand.footerEvidence?.bottomBarBackground || brand.colours?.footerBackground),
        textColour: str(brand.footerEvidence?.textColour || brand.colours?.footerText),
        linkColour: str(brand.footerEvidence?.linkColour || brand.colours?.footerLink),
        paddingTop: "",
        paddingBottom: str(footer.bottomBarPadding || "18px"),
      },
      groups: footerGroups,
      mobileStackOrder: Array.isArray(footer.stackOrder) ? (footer.stackOrder as string[]) : ["about", "quickLinks", "openingHours", "contact"],
    },
    colours,
    images: brand.logoUrl
      ? [
          {
            id: "logo-primary",
            role: "logo" as const,
            selector: "header .logo img",
            asset: str(brand.logoUrl),
            width: 0,
            height: 0,
            aspectRatio: "",
            alt: str(brand.businessName),
            lazyLoad: false,
            backgroundImage: "",
            visibility: "visible" as const,
          },
        ]
      : [],
    validation: {
      navigationTreeComplete: navLinks.length >= 3,
      headerHierarchyComplete: Boolean(brand.logoUrl && str(header.navigationVariant)),
      footerHierarchyComplete: Boolean(str(footer.variant) || brand.footerEvidence),
      colourRolesComplete: colours.length >= 2,
      imageRolesComplete: Boolean(brand.logoUrl),
      navigationFlatteningRemoved: true,
      footerLayerMergeRemoved: true,
    },
    summary: {
      layoutClassification: str(brand.layout?.headerLayout || brand.layout?.heroLayout || "website-import"),
      headerStyle: str(header.navigationVariant || header.variant),
      footerStyle: str(footer.variant || brand.layout?.footerLayout),
      navigationStyle: str(header.navigationVariant || brand.layout?.navigationStyle),
      typographySystem: [brand.typography?.headingFont, brand.typography?.bodyFont].filter(Boolean).join(" / "),
      buttonStyle: [
        str(cta.buttonFamily),
        str(cta.buttonRadius || cta.headerPrimary?.radius),
        str(cta.headerPrimary?.style),
      ]
        .filter(Boolean)
        .join(" · "),
      colourSystem: [brand.colours?.primary, brand.colours?.secondary, brand.colours?.accent].filter(Boolean).join(", "),
      logoPlacement: str(header.logoPosition || "left"),
      evidenceCompleteness: computeStoredBrandEvidenceCompleteness(brand, component),
      fallbackReason: navLinks.length ? null : "navigation-links-not-extracted-from-html",
    },
  } as DesignIntelligenceManifest & {
    summary?: Record<string, unknown>;
  };
}

function computeStoredBrandEvidenceCompleteness(brand: BrandDnaV1, component: ComponentDna | null): number {
  const checks = [
    Boolean(str(brand.logoUrl)),
    Boolean(brand.colours?.primary),
    Boolean(brand.typography?.headingFont || brand.typography?.bodyFont),
    Boolean(component?.header?.navigationVariant || brand.layout?.navigationStyle),
    Boolean(component?.footer?.variant || brand.layout?.footerLayout),
    Boolean(component?.cta?.variant || brand.colours?.button),
    Boolean(brand.navigationLinks?.length || brand.headerCtaUrl),
    Boolean(brand.footerEvidence || brand.footerLinks?.length),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

export function buildDesignIntelligenceSummary(manifest: DesignIntelligenceManifest | null): string | null {
  const summary = (manifest as { summary?: Record<string, unknown> } | null)?.summary;
  if (!summary) return null;
  const parts = [
    summary.layoutClassification ? `Layout: ${summary.layoutClassification}` : null,
    summary.headerStyle ? `Header: ${summary.headerStyle}` : null,
    summary.footerStyle ? `Footer: ${summary.footerStyle}` : null,
    summary.navigationStyle ? `Navigation: ${summary.navigationStyle}` : null,
    summary.typographySystem ? `Typography: ${summary.typographySystem}` : null,
    summary.buttonStyle ? `Buttons: ${summary.buttonStyle}` : null,
    summary.colourSystem ? `Colours: ${summary.colourSystem}` : null,
    summary.logoPlacement ? `Logo placement: ${summary.logoPlacement}` : null,
    summary.evidenceCompleteness != null ? `Completeness: ${summary.evidenceCompleteness}%` : null,
    summary.fallbackReason ? `Fallback: ${summary.fallbackReason}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function ensureDesignIntelligenceFromStoredEvidence(slug: string): DesignIntelligenceManifest | null {
  const safe = safePharmacySlug(slug);
  const existing = loadWebsiteDesignIntelligence(safe);
  if (manifestHasMeaningfulContent(existing)) return existing;

  const manifest = buildDesignIntelligenceFromStoredBrandEvidence(safe);
  if (!manifest || !buildDesignIntelligenceSummary(manifest)) return null;

  const root = designEvidenceRoot(safe);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "design-intelligence.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function syncImportedBrandFieldsToProfile(slug: string): boolean {
  const safe = safePharmacySlug(slug);
  const profile = readSetupProfile(safe);
  const brand = loadBrandDnaV1File(safe);
  const snap = profile.websiteImportSnapshot as { logoUrl?: string; intelligence?: { identity?: { logoUrl?: string; faviconUrl?: string } } } | null;
  const logoCandidate = str(profile.logoUrl) || str(brand?.logoUrl) || str(snap?.logoUrl) || str(snap?.intelligence?.identity?.logoUrl);
  const faviconCandidate = str((profile as { faviconUrl?: string }).faviconUrl) || str(brand?.faviconUrl) || str(snap?.intelligence?.identity?.faviconUrl);

  if (!logoCandidate && !faviconCandidate) return false;
  if (str(profile.logoUrl) === logoCandidate && str((profile as { faviconUrl?: string }).faviconUrl) === faviconCandidate) {
    return false;
  }

  writeSetupProfile(safe, {
    ...profile,
    logoUrl: str(profile.logoUrl) || logoCandidate,
    faviconUrl: str((profile as { faviconUrl?: string }).faviconUrl) || faviconCandidate,
  } as typeof profile);
  return true;
}

export function completeWebsiteImportBrandEvidence(slug: string): {
  designIntelligencePersisted: boolean;
  profileSynced: boolean;
} {
  const manifest = ensureDesignIntelligenceFromStoredEvidence(slug);
  const profileSynced = syncImportedBrandFieldsToProfile(slug);
  return {
    designIntelligencePersisted: Boolean(manifest),
    profileSynced,
  };
}
