/**
 * Canonical navigation extraction — separates customer chrome from service inventory.
 */
import type { BrandProfile } from "../generator/brandImporter.ts";
import type { WebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { BrandDnaFooterBlock, BrandDnaNavigationBlock, BrandDnaNavCta } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { NavLink } from "../generator/brandImporter.ts";
import {
  isServiceInventoryNavLabel,
  isValidConfirmedNavUrl,
  sanitizeConfirmedNavItems,
} from "./pharmacyBrandDnaConfirmedNavigation.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

const CUSTOMER_NAV_LABELS = ["home", "about us", "about", "services", "all services", "faqs", "faq", "contact us", "contact"];

function isCustomerNavLabel(label: string): boolean {
  const normalized = str(label).toLowerCase();
  if (CUSTOMER_NAV_LABELS.includes(normalized)) return true;
  return normalized === "services" || /^about\b/i.test(normalized) || /^all services\b/i.test(normalized);
}

function isLegalNavLabel(label: string): boolean {
  return /privacy|cookie|terms|legal|gdpr/i.test(str(label));
}

function isCtaLabel(label: string): boolean {
  return /book an appointment|book appointment|nominate/i.test(str(label));
}

function isTelephoneCtaLabel(label: string, href: string): boolean {
  if (/^tel:/i.test(href)) return true;
  return /^(call|phone)\b/i.test(str(label)) && /^tel:/i.test(href);
}

function findPageUrl(intelligence: WebsiteIntelligenceImportV2 | null, pattern: RegExp): string {
  const pages = intelligence?.structure?.pages || [];
  for (const page of pages) {
    const title = str(page.title);
    const path = str(page.path);
    if (pattern.test(title) || pattern.test(path)) return str(page.url);
  }
  return "";
}

function resolveCta(
  labelPattern: RegExp,
  fallbackLabel: string,
  navLinks: NavLink[],
  intelligence: WebsiteIntelligenceImportV2 | null,
  pathPattern: RegExp,
): BrandDnaNavCta | undefined {
  const fromNav = navLinks.find((l) => labelPattern.test(str(l.label)) && isValidConfirmedNavUrl(str(l.href)));
  if (fromNav) return { label: str(fromNav.label), href: str(fromNav.href) };
  const url = findPageUrl(intelligence, pathPattern);
  if (url && isValidConfirmedNavUrl(url)) return { label: fallbackLabel, href: url };
  return undefined;
}

function resolveTelephoneCta(navLinks: NavLink[]): BrandDnaNavCta | undefined {
  const fromNav = navLinks.find((l) => isTelephoneCtaLabel(str(l.label), str(l.href)));
  if (fromNav) return { label: str(fromNav.label), href: str(fromNav.href) };
  return undefined;
}

function extractLegalItemsFromIntelligence(
  intelligence: WebsiteIntelligenceImportV2 | null,
): NavLink[] {
  const specs = [
    { label: "Terms & Conditions", pattern: /terms-and-conditions|\/terms\b/i },
    { label: "GDPR", pattern: /\/gdpr\b/i },
    { label: "Privacy Policy", pattern: /privacy-policy|\/privacy\b/i },
  ];
  const out: NavLink[] = [];
  for (const spec of specs) {
    const url = findPageUrl(intelligence, spec.pattern);
    if (url && isValidConfirmedNavUrl(url)) out.push({ label: spec.label, href: url });
  }
  return sanitizeConfirmedNavItems(out);
}

function buildHeaderConfirmedItems(allNav: NavLink[], footerRaw: NavLink[]): NavLink[] {
  const detectedServiceInventory = allNav.filter((l) => isServiceInventoryNavLabel(str(l.label)));
  const customerCandidates = allNav.filter((l) => isCustomerNavLabel(str(l.label)) && !isCtaLabel(str(l.label)));
  const footerCustomer = footerRaw.filter((l) => !isLegalNavLabel(str(l.label)));

  let confirmedItems = sanitizeConfirmedNavItems([
    ...footerCustomer,
    ...customerCandidates.filter((c) => !footerCustomer.some((f) => f.label.toLowerCase() === c.label.toLowerCase())),
  ]);

  if (!confirmedItems.some((l) => l.label.toLowerCase() === "services")) {
    const servicesHref =
      allNav.find((l) => str(l.label).toLowerCase() === "services" && isValidConfirmedNavUrl(str(l.href)))?.href ||
      allNav.find((l) => str(l.label).toLowerCase() === "all services" && isValidConfirmedNavUrl(str(l.href)))?.href ||
      allNav.find((l) => /essential-service/i.test(str(l.href)) && isValidConfirmedNavUrl(str(l.href)))?.href;
    if (servicesHref) {
      const homeIdx = confirmedItems.findIndex((l) => l.label.toLowerCase() === "home");
      const insertAt = homeIdx >= 0 ? homeIdx + 1 : confirmedItems.length;
      confirmedItems = sanitizeConfirmedNavItems([
        ...confirmedItems.slice(0, insertAt),
        { label: "Services", href: servicesHref },
        ...confirmedItems.slice(insertAt),
      ]);
    }
  }

  return confirmedItems.filter((l) => !isServiceInventoryNavLabel(str(l.label))).slice(0, 8);
}

export interface ExtractedNavigation {
  confirmedItems: NavLink[];
  detectedServiceInventory: NavLink[];
  navigation: BrandDnaNavigationBlock;
  footer: BrandDnaFooterBlock;
}

export function extractCanonicalNavigation(
  brand: Partial<BrandProfile>,
  intelligence: WebsiteIntelligenceImportV2 | null,
): ExtractedNavigation {
  const allNav = (brand.navigationLinks || []).filter((l) => str(l.label) && str(l.href));
  const footerRaw = (brand.footerLinks || []).filter((l) => str(l.label) && str(l.href));

  const detectedServiceInventory = allNav.filter((l) => isServiceInventoryNavLabel(str(l.label)));
  const headerConfirmedItems = buildHeaderConfirmedItems(allNav, footerRaw);

  const footerConfirmedItems = sanitizeConfirmedNavItems(
    footerRaw.filter((l) => !isLegalNavLabel(str(l.label))),
  );

  const primaryCta = resolveCta(/book an appointment|book appointment/i, "Book An Appointment", allNav, intelligence, /book-appointment|book appointment/i);
  const secondaryCta = resolveCta(/nominate/i, "Nominate Our Pharmacy", allNav, intelligence, /nominate/i);
  const telephoneCta = resolveTelephoneCta(allNav);

  let legalItems = sanitizeConfirmedNavItems(footerRaw.filter((l) => isLegalNavLabel(str(l.label))));
  if (!legalItems.length) {
    legalItems = extractLegalItemsFromIntelligence(intelligence);
  }

  return {
    confirmedItems: headerConfirmedItems,
    detectedServiceInventory,
    navigation: {
      confirmedItems: headerConfirmedItems,
      primaryCta,
      secondaryCta,
      telephoneCta,
    },
    footer: {
      confirmedItems: footerConfirmedItems.length ? footerConfirmedItems : sanitizeConfirmedNavItems(footerRaw),
      legalItems,
      showLogo: true,
      columnCount: footerRaw.length >= 4 ? 4 : 3,
    },
  };
}
