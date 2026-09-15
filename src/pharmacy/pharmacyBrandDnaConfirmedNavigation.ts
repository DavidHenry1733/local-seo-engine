/**
 * Confirmed customer-facing navigation — header/footer source guard.
 * Never derives links from service catalogues or detected website services.
 */
import type { BrandDNA, BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";
import type { NavLink } from "../generator/brandImporter.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function isValidConfirmedNavUrl(url: string): boolean {
  const normalized = str(url);
  if (!normalized || normalized === "#") return false;
  if (/^javascript:/i.test(normalized)) return false;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return false;
  return true;
}

/** Primary nav labels that indicate service inventory rather than customer chrome. */
const SERVICE_INVENTORY_LABELS = new Set(
  [
    "nhs essential services",
    "dispensing medicines",
    "repeat dispensing",
    "dispensing appliances",
    "discharge medicines service",
    "public health",
    "nominate our pharmacy",
    "private services",
    "pharmacy first",
  ].map((s) => s.toLowerCase()),
);

export function isServiceInventoryNavLabel(label: string): boolean {
  const normalized = str(label).toLowerCase();
  if (SERVICE_INVENTORY_LABELS.has(normalized)) return true;
  return /^(dispensing|repeat|discharge|public health|nominate|nhs essential)/i.test(normalized);
}

export function sanitizeConfirmedNavItems(items: NavLink[]): NavLink[] {
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const item of items) {
    const label = str(item.label);
    const href = str(item.href);
    if (!label || !isValidConfirmedNavUrl(href)) continue;
    if (isServiceInventoryNavLabel(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
  }
  return out;
}

/** Resolve confirmed customer navigation from Brand DNA storage only. */
export function resolveConfirmedNavigationItems(brand: BrandDNA | BrandDnaV1): NavLink[] {
  const engineNav = "navigation" in brand && brand.navigation && "confirmedItems" in brand.navigation
    ? brand.navigation.confirmedItems
    : undefined;
  const confirmed = brand.navigation?.confirmedItems?.length
    ? brand.navigation.confirmedItems
    : engineNav?.length
      ? engineNav
      : inferConfirmedItemsFromFooter(brand);

  const sanitized = sanitizeConfirmedNavItems(confirmed);
  if (sanitized.length) return sanitized;

  // Never fall back to generic profile nav when website-import navigationLinks exist.
  return sanitizeConfirmedNavItems(brand.navigationLinks || []);
}

/** When confirmedItems absent, derive from footer links + Services hub if present in import. */
function inferConfirmedItemsFromFooter(brand: BrandDNA | BrandDnaV1): NavLink[] {
  const footer = sanitizeConfirmedNavItems(brand.footerLinks || []);
  if (footer.length >= 4) {
    const hasServices = footer.some((l) => l.label.toLowerCase() === "services");
    if (hasServices) return footer;
    const servicesHref = (brand.navigationLinks || []).find(
      (l) => str(l.label).toLowerCase() === "services" && isValidConfirmedNavUrl(str(l.href)),
    )?.href;
    if (servicesHref) {
      return sanitizeConfirmedNavItems([
        ...footer.slice(0, 2),
        { label: "Services", href: servicesHref },
        ...footer.slice(2),
      ]);
    }
    return footer;
  }
  return sanitizeConfirmedNavItems(brand.footerLinks || []);
}

export function confirmedNavToProfileLinks(items: NavLink[]) {
  return items.map((link, i) => ({
    label: str(link.label),
    url: str(link.href),
    order: i + 1,
    visible: true,
  }));
}

/** Footer quick links — separate from header navigation evidence. */
export function resolveFooterConfirmedItems(brand: BrandDNA | BrandDnaV1): NavLink[] {
  const fromFooterBlock =
    "footer" in brand && brand.footer && "confirmedItems" in brand.footer
      ? brand.footer.confirmedItems
      : undefined;
  if (fromFooterBlock?.length) return sanitizeConfirmedNavItems(fromFooterBlock);
  return sanitizeConfirmedNavItems(brand.footerLinks || []);
}

export function resolveProminentTelephoneCta(brand: BrandDNA | BrandDnaV1): boolean {
  const telephoneCta = brand.navigation?.telephoneCta;
  if (!telephoneCta) return false;
  const href = str(telephoneCta.href);
  const label = str(telephoneCta.label);
  return Boolean(label && (href.startsWith("tel:") || isValidConfirmedNavUrl(href)));
}
