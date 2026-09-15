/**
 * RC1-C13 — Classify imported navigation by source role for site chrome rendering.
 * Reads persisted design evidence only; does not mutate import records.
 */
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import type { NavLink } from "../generator/brandImporter.ts";
import {
  buildSiteChromeNavigationFromDesignIntelligence,
  tryLoadDesignIntelligence,
  type DesignIntelligenceNavTreeItem,
} from "./pharmacyDesignIntelligenceResolver.ts";
import { hasActivatedTenantDesignDna, recordRenderFallback } from "./pharmacyTenantDnaRenderActivation.ts";

export type NavigationLinkRole =
  | "primary-navigation"
  | "dropdown-child"
  | "utility-navigation"
  | "cta"
  | "footer-company-link"
  | "footer-legal-link"
  | "social-link"
  | "branch-service-link";

export interface ClassifiedNavLink extends NavLink {
  role: NavigationLinkRole;
}

export interface SiteChromeNavigationModel {
  primaryNavigation: ClassifiedNavLink[];
  dropdownChildren: ClassifiedNavLink[];
  dropdownParent: ClassifiedNavLink | null;
  utilityNavigation: ClassifiedNavLink[];
  footerCompanyLinks: ClassifiedNavLink[];
  footerLegalLinks: ClassifiedNavLink[];
  socialLinks: ClassifiedNavLink[];
  unclassified: ClassifiedNavLink[];
  headerRowCount: number;
  orderedPrimaryTree?: DesignIntelligenceNavTreeItem[];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function isValidUrl(url: string): boolean {
  const normalized = str(url);
  if (!normalized || normalized === "#") return false;
  if (/^javascript:/i.test(normalized)) return false;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return false;
  return true;
}

function normLabel(label: string): string {
  return str(label).toLowerCase().replace(/\s+/g, " ");
}

function dedupeLinks(items: NavLink[]): NavLink[] {
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const item of items) {
    const label = str(item.label);
    const href = str(item.href);
    if (!label || !isValidUrl(href)) continue;
    const key = `${normLabel(label)}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
  }
  return out;
}

const DROPDOWN_PARENT_LABELS = new Set(["all services", "services"]);

function isDropdownParent(label: string): boolean {
  return DROPDOWN_PARENT_LABELS.has(normLabel(label));
}

function parseFooterSocialFromContact(content: string): NavLink[] {
  const social: NavLink[] = [];
  const lower = content.toLowerCase();
  if (!/social media/i.test(content)) return social;
  const platforms: Array<[RegExp, string, string]> = [
    [/facebook/i, "Facebook", "https://www.facebook.com/"],
    [/twitter/i, "Twitter", "https://twitter.com/"],
    [/youtube/i, "Youtube", "https://www.youtube.com/"],
    [/instagram/i, "Instagram", "https://www.instagram.com/"],
    [/linkedin/i, "LinkedIn", "https://www.linkedin.com/"],
  ];
  for (const [pattern, label, href] of platforms) {
    if (pattern.test(lower)) social.push({ label, href });
  }
  return social;
}

export function classifySiteChromeNavigation(evidence: WebsiteDesignEvidence | null): SiteChromeNavigationModel {
  const empty: SiteChromeNavigationModel = {
    primaryNavigation: [],
    dropdownChildren: [],
    dropdownParent: null,
    utilityNavigation: [],
    footerCompanyLinks: [],
    footerLegalLinks: [],
    socialLinks: [],
    unclassified: [],
    headerRowCount: 1,
  };
  if (!evidence) return empty;

  const navItems = evidence.navigation?.items || [];
  const headerItems = evidence.header?.navItems?.length ? evidence.header.navItems : navItems;
  const footerQuick = evidence.footer?.quickLinks || [];
  const footerLegal = evidence.footer?.legalLinks || [];
  const footerSocial = evidence.footer?.socialLinks || [];

  const primary: ClassifiedNavLink[] = [];
  const dropdownChildren: ClassifiedNavLink[] = [];
  let dropdownParent: ClassifiedNavLink | null = null;
  const utilityFromFooter: ClassifiedNavLink[] = [];

  for (const item of headerItems) {
    const label = str(item.label);
    const href = str(item.href);
    if (!label || !isValidUrl(href)) continue;

    if (isDropdownParent(label)) {
      dropdownParent = { label, href, role: "primary-navigation" };
      continue;
    }

    if (item.isDropdown) {
      dropdownChildren.push({ label, href, role: "dropdown-child" });
      continue;
    }

    primary.push({ label, href, role: "primary-navigation" });
  }

  const utilityLabels = new Set(["store locator", "contact us", "contact"]);
  for (const item of footerQuick) {
    const label = str(item.label);
    const href = str(item.href);
    if (!label || !isValidUrl(href)) continue;
    if (utilityLabels.has(normLabel(label))) {
      utilityFromFooter.push({ label, href, role: "primary-navigation" });
    }
  }

  const orderedPrimary: ClassifiedNavLink[] = [...primary];
  for (const item of utilityFromFooter) {
    if (!orderedPrimary.some((p) => normLabel(p.label) === normLabel(item.label))) {
      orderedPrimary.push(item);
    }
  }

  const footerCompanyLinks: ClassifiedNavLink[] = dedupeLinks(footerQuick).map((l) => ({
    ...l,
    role: "footer-company-link" as const,
  }));

  const footerLegalLinks: ClassifiedNavLink[] = dedupeLinks(footerLegal).map((l) => ({
    ...l,
    role: "footer-legal-link" as const,
  }));

  let socialLinks: ClassifiedNavLink[] = dedupeLinks(footerSocial).map((l) => ({
    ...l,
    role: "social-link" as const,
  }));
  if (!socialLinks.length) {
    const contactContent = (evidence.contactBlocks || []).map((b) => str(b.content)).join(" ");
    socialLinks = parseFooterSocialFromContact(contactContent).map((l) => ({
      ...l,
      role: "social-link" as const,
    }));
  }

  const classifiedKeys = new Set<string>();
  for (const group of [primary, dropdownChildren, dropdownParent ? [dropdownParent] : [], footerCompanyLinks, footerLegalLinks, socialLinks]) {
    for (const item of group) classifiedKeys.add(`${normLabel(item.label)}|${item.href}`);
  }

  const unclassified: ClassifiedNavLink[] = [];
  for (const item of dedupeLinks(evidence.navigation?.items?.map((i) => ({ label: i.label, href: i.href })) || [])) {
    const key = `${normLabel(item.label)}|${item.href}`;
    if (!classifiedKeys.has(key)) {
      unclassified.push({ ...item, role: "branch-service-link" });
    }
  }

  return {
    primaryNavigation: dedupeLinks(orderedPrimary).map((l) => ({ ...l, role: "primary-navigation" as const })),
    dropdownChildren: dedupeLinks(dropdownChildren).map((l) => ({ ...l, role: "dropdown-child" as const })),
    dropdownParent,
    utilityNavigation: [],
    footerCompanyLinks,
    footerLegalLinks,
    socialLinks,
    unclassified,
    headerRowCount: evidence.header?.rowCount || 1,
  };
}

export function resolveSiteChromeNavigation(slug: string): SiteChromeNavigationModel {
  if (hasActivatedTenantDesignDna(slug)) {
    const manifest = tryLoadDesignIntelligence(slug);
    if (manifest) return buildSiteChromeNavigationFromDesignIntelligence(manifest);
    recordRenderFallback("navigation", "flat-design-evidence-fallback-forbidden", true);
  }
  return classifySiteChromeNavigation(loadWebsiteDesignEvidence(slug));
}

export function primaryNavigationLabels(model: SiteChromeNavigationModel): string[] {
  const labels = model.primaryNavigation.map((l) => l.label);
  if (model.dropdownParent && !labels.some((l) => normLabel(l) === normLabel(model.dropdownParent!.label))) {
    labels.push(model.dropdownParent.label);
  }
  return labels;
}
