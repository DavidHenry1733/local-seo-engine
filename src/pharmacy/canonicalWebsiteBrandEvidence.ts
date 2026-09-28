/**
 * Read-only website brand/design projection.
 * Uses the stored Website Import brand record. Does not crawl, write, or invent values.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { loadWebsiteDesignIntelligence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { loadBrandDnaV1File } from "./pharmacyBrandDnaStore.ts";
import type { DesignIntelligenceManifest } from "./pharmacyDesignIntelligenceHierarchyModel.ts";
import type { BrandDnaV1 } from "./pharmacyBrandDnaTypes.ts";

export type WebsiteBrandAvailability = "IMPORTED" | "NOT FOUND" | "CONFLICT";

export interface WebsiteBrandValue {
  id: string;
  label: string;
  status: WebsiteBrandAvailability;
  value: string;
  sourceUrl: string;
  assetUrl: string;
  method: string;
  confidence: number | null;
  sourceRevision: string;
}

export interface WebsiteBrandEvidence {
  sourceRevision: string;
  capturedAt: string;
  primaryUrl: string;
  method: string;
  logo: WebsiteBrandValue;
  favicon: WebsiteBrandValue;
  primaryColour: WebsiteBrandValue;
  secondaryColour: WebsiteBrandValue;
  accentColour: WebsiteBrandValue;
  palette: WebsiteBrandValue[];
  headingFont: WebsiteBrandValue;
  bodyFont: WebsiteBrandValue;
  headerSummary: WebsiteBrandValue;
  headerNavigation: string[];
  headerCta: WebsiteBrandValue;
  footerSummary: WebsiteBrandValue;
  footerLinks: string[];
  footerContact: string[];
  footerLegal: string[];
  socialLinks: string[];
  imagerySummary: WebsiteBrandValue;
  imagery: Array<{ role: string; url: string; alt: string }>;
  structureSummary: WebsiteBrandValue;
  structure: Array<{ category: string; url: string; title: string }>;
  styleSummary: WebsiteBrandValue;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function normHex(value: string): string {
  return value.trim().toLowerCase();
}

function field(
  id: string,
  label: string,
  value: string,
  meta: { sourceUrl?: string; assetUrl?: string; method?: string; confidence?: number | null; sourceRevision?: string; conflict?: string },
): WebsiteBrandValue {
  const present = Boolean(value);
  return {
    id,
    label,
    status: meta.conflict ? "CONFLICT" : present ? "IMPORTED" : "NOT FOUND",
    value: meta.conflict || value,
    sourceUrl: meta.sourceUrl || "",
    assetUrl: meta.assetUrl || "",
    method: meta.method || "",
    confidence: present || meta.conflict ? meta.confidence ?? null : null,
    sourceRevision: meta.sourceRevision || "",
  };
}

function colourByRole(manifest: DesignIntelligenceManifest | null, role: string): string {
  return str(manifest?.colours?.find((colour) => colour.role === role)?.hex);
}

export function projectCanonicalWebsiteBrandEvidence(slug: string): WebsiteBrandEvidence {
  const profile = readSetupProfile(slug);
  const snap = (profile.websiteImportSnapshot || null) as {
    websiteUrl?: string;
    importedAt?: string;
    socialLinks?: string[];
    footerLinks?: string[];
    intelligence?: {
      identity?: Record<string, unknown>;
      structure?: { pages?: Array<{ url?: string; title?: string; category?: string; path?: string }> };
      designEvidence?: unknown;
    };
  } | null;
  const identity = snap?.intelligence?.identity || {};
  const dna = loadBrandDnaV1File(slug);
  const manifest = loadWebsiteDesignIntelligence(slug);
  const sourceRevision = str(manifest?.sourceRevision || dna?.sourceImportRevision || dna?.websiteIntelligenceRevision);
  const capturedAt = str(manifest?.capturedAt || dna?.frozenAt || snap?.importedAt);
  const primaryUrl = str(manifest?.primaryUrl || dna?.sourceUrl || snap?.websiteUrl);
  const method = manifest ? "design-intelligence-v1" : dna ? "brand-dna-v1" : "website-import-snapshot";
  const meta = { sourceUrl: primaryUrl, method, sourceRevision, confidence: dna?.confidence?.logo ?? null };

  const logoCandidates = [
    str(manifest?.header?.logoBlock?.logoUrl),
    str(manifest?.images?.find((image) => image.role === "logo")?.asset),
    str(dna?.logoUrl),
    str(identity.logoUrl),
  ].filter(Boolean);
  const uniqueLogos = [...new Set(logoCandidates)];
  const logo = field("logo", "Logo", uniqueLogos[0] || "", {
    ...meta,
    assetUrl: uniqueLogos[0] || "",
    confidence: dna?.confidence?.logo ?? (uniqueLogos[0] ? 80 : null),
    conflict: uniqueLogos.length > 1 ? uniqueLogos.join(" | ") : "",
  });

  const faviconCandidates = [str(dna?.faviconUrl), str(identity.faviconUrl)].filter(Boolean);
  const uniqueFavicons = [...new Set(faviconCandidates)];
  const favicon = field("favicon", "Favicon", uniqueFavicons[0] || "", {
    ...meta,
    assetUrl: uniqueFavicons[0] || "",
    confidence: uniqueFavicons[0] ? 70 : null,
    conflict: uniqueFavicons.length > 1 ? uniqueFavicons.join(" | ") : "",
  });

  const colour = (id: string, label: string, dnaValue: string | undefined, role: string, identityValue: unknown) => {
    const fromDna = str(dnaValue);
    const fromManifest = colourByRole(manifest, role);
    const fromIdentity = str(identityValue);
    const chosen = fromDna || fromManifest || fromIdentity;
    const compared = [fromDna, fromManifest, fromIdentity].filter(Boolean).map(normHex);
    const conflict = new Set(compared).size > 1;
    return field(id, label, conflict ? "" : chosen, {
      ...meta,
      method: fromDna ? "brand-dna-v1" : fromManifest ? "design-intelligence-v1" : "website-import-snapshot",
      confidence: dna?.confidence?.colours ?? (chosen ? 80 : null),
      conflict: conflict ? [...new Set(compared)].join(" | ") : "",
    });
  };

  const paletteSource = dna?.colours
    ? Object.entries(dna.colours).filter(([, value]) => str(value))
    : (manifest?.colours || []).map((item) => [item.role, item.hex] as [string, string]);
  const palette = paletteSource.slice(0, 12).map(([role, value], index) =>
    field(`palette-${index}`, role, str(value), { ...meta, method: dna ? "brand-dna-v1" : method, confidence: dna?.confidence?.colours ?? 80 }),
  );

  const heading = str(dna?.typography?.headingFont);
  const body = str(dna?.typography?.bodyFont);
  const nav = (manifest?.navigation?.tree || [])
    .filter((item) => item.role === "primary-navigation" || item.role === "dropdown-parent")
    .map((item) => str(item.text))
    .filter(Boolean);
  const navLabels = nav.length ? nav : (dna?.navigationLinks || []).map((link) => str(link.label)).filter(Boolean);
  const cta = str(manifest?.header?.ctaBlock?.labels?.[0] || dna?.headerCtaText);
  const footerGroups = manifest?.footer?.groups || [];
  const footerLabels = footerGroups.flatMap((group) => group.links.map((link) => str(link.text))).filter(Boolean);
  const footerLinkLabels = footerLabels.length ? footerLabels : (dna?.footerLinks || []).map((link) => str(link.label)).filter(Boolean);
  const legal = footerGroups.filter((group) => group.role === "legal").flatMap((group) => group.links.map((link) => str(link.text))).filter(Boolean);
  const contact = footerGroups.filter((group) => group.role === "contact").flatMap((group) => group.links.map((link) => str(link.text))).filter(Boolean);
  const social = [
    ...(snap?.socialLinks || []).map(str),
    ...footerGroups.filter((group) => group.role === "social").flatMap((group) => group.links.map((link) => str(link.href || link.text))),
  ].filter(Boolean);
  const images = (manifest?.images || []).map((image) => ({
    role: str(image.role),
    url: str(image.asset),
    alt: str(image.alt),
  })).filter((image) => image.url);
  const pages = (snap?.intelligence?.structure?.pages || []).map((page) => ({
    category: str(page.category) || "page",
    url: str(page.url),
    title: str(page.title || page.path),
  })).filter((page) => page.url);
  const styleBits = [
    str((manifest as { summary?: { buttonStyle?: string } } | null)?.summary?.buttonStyle),
    str((manifest as { summary?: { layoutClassification?: string } } | null)?.summary?.layoutClassification),
    str(dna?.layout?.navigationStyle),
    str(dna?.layout?.footerLayout),
  ].filter(Boolean);

  return {
    sourceRevision,
    capturedAt,
    primaryUrl,
    method,
    logo,
    favicon,
    primaryColour: colour("primary-colour", "Primary colour", dna?.colours?.primary, "primary", identity.brandPrimaryColor),
    secondaryColour: colour("secondary-colour", "Secondary colour", dna?.colours?.secondary, "secondary", identity.brandSecondaryColor),
    accentColour: colour("accent-colour", "Accent colour", dna?.colours?.accent, "accent", identity.brandAccentColor),
    palette,
    headingFont: field("heading-font", "Heading font", heading, { ...meta, method: "brand-dna-v1", confidence: dna?.confidence?.fonts ?? null }),
    bodyFont: field("body-font", "Body font", body, { ...meta, method: "brand-dna-v1", confidence: dna?.confidence?.fonts ?? null }),
    headerSummary: field("header", "Header", navLabels.length || logo.value ? [logo.value ? "Logo" : "", navLabels.length ? `${navLabels.length} navigation links` : "", cta ? `CTA ${cta}` : ""].filter(Boolean).join(" · ") : "", meta),
    headerNavigation: navLabels,
    headerCta: field("header-cta", "Header CTA", cta, { ...meta, assetUrl: str(dna?.headerCtaUrl) }),
    footerSummary: field("footer", "Footer", footerLinkLabels.length ? `${footerLinkLabels.length} footer links` : "", meta),
    footerLinks: footerLinkLabels,
    footerContact: contact,
    footerLegal: legal,
    socialLinks: [...new Set(social)],
    imagerySummary: field("imagery", "Imagery", images.length ? `${images.length} discovered asset${images.length === 1 ? "" : "s"}` : "", meta),
    imagery: images,
    structureSummary: field("structure", "Website structure", pages.length ? `${pages.length} crawled pages` : "", { ...meta, method: "website-intelligence-import-v2" }),
    structure: pages,
    styleSummary: field("style", "Visual style", styleBits.join(" · "), meta),
  };
}
