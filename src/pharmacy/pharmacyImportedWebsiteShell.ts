/**
 * Approved imported website shell for generated pharmacy pages.
 * Reads the stored design-intelligence manifest only. Does not crawl or invent links.
 */
import { loadWebsiteDesignIntelligence } from "./pharmacyWebsiteDesignCaptureService.ts";

export interface ImportedWebsiteShellLink {
  label: string;
  href: string;
}

export interface ApprovedImportedWebsiteShell {
  source: "design-intelligence-v1";
  navigation: ImportedWebsiteShellLink[];
  footerLinks: ImportedWebsiteShellLink[];
  footerHeading: string;
  cta: ImportedWebsiteShellLink | null;
  logoUrl: string;
  colours: {
    primary: string;
    secondary: string;
    accent: string;
    footerBackground: string;
  };
}

function decodeText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function usableHref(value: string): string {
  const href = value.trim();
  if (!href || href === "#") return "";
  if (/^javascript:/i.test(href)) return "";
  if (/localhost|127\.0\.0\.1/i.test(href)) return "";
  if (/^(https?:|mailto:|tel:|\/)/i.test(href)) return href;
  return "";
}

function colour(manifestColours: Array<{ role?: string; hex?: string }>, role: string): string {
  return String(manifestColours.find((item) => item.role === role)?.hex || "").trim();
}

/** Canonical imported shell for a tenant. Null when no approved shell was captured. */
export function resolveApprovedImportedWebsiteShell(slug: string): ApprovedImportedWebsiteShell | null {
  const key = String(slug || "").trim();
  if (!key) return null;
  const manifest = loadWebsiteDesignIntelligence(key);
  if (!manifest) return null;
  if (manifest.tenant && manifest.tenant !== key) return null;

  const navigation = (manifest.navigation?.tree || [])
    .filter((item) => item.role === "primary-navigation" || item.role === "dropdown-parent")
    .filter((item) => item.visibility !== "hidden")
    .sort((a, b) => a.order - b.order)
    .map((item) => ({ label: decodeText(item.text), href: usableHref(item.href) }))
    .filter((item) => item.label && item.href);

  const footerGroup = (manifest.footer?.groups || []).find((group) => group.links?.length);
  const footerLinks = (footerGroup?.links || [])
    .map((link) => ({ label: decodeText(link.text), href: usableHref(link.href) }))
    .filter((link) => link.label && link.href);
  const ctaLabel = decodeText(manifest.header?.ctaBlock?.labels?.[0] || "");
  const ctaHref = usableHref(manifest.header?.ctaBlock?.hrefs?.[0] || "");
  const cta = ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : null;
  const logoUrl = usableHref(manifest.header?.logoBlock?.logoUrl || "") || usableHref(
    (manifest.images || []).find((image) => image.role === "logo")?.asset || "",
  );

  if (!navigation.length && !footerLinks.length) return null;

  return {
    source: "design-intelligence-v1",
    navigation,
    footerLinks,
    footerHeading: decodeText(footerGroup?.heading || "") || "Footer",
    cta,
    logoUrl,
    colours: {
      primary: colour(manifest.colours || [], "primary"),
      secondary: colour(manifest.colours || [], "secondary"),
      accent: colour(manifest.colours || [], "accent"),
      footerBackground: colour(manifest.colours || [], "footer-background"),
    },
  };
}
