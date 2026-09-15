/**
 * renderClusterPage.ts
 *
 * Shared HTML renderer for cluster pages.
 *
 * Extracts the template-fill logic from deployClusterPage.ts so it can be
 * consumed by the rollout runner without duplicating code.
 * deployClusterPage.ts continues to work unchanged — it implements rendering
 * internally; this module provides the same capability for the rollout runner.
 *
 * Spec ref: Area Engine Integration Spec v1 — Section 7.2 (rollout pipeline)
 */

import fs   from "node:fs";
import path from "node:path";
import {
  buildCampaignPaneImageUrl,
  findCampaignPaneSlotFile,
} from "./campaignPaneImages";
import { fileURLToPath } from "node:url";

import { buildBrandCss, type BrandProfile } from "./brandImporter.js";
import {
  selectRelatedServiceCards,
  buildRelatedServicesSectionHtml,
} from "../seo/selectInternalLinks.js";
import type { CustomerProviderProfile } from "./customerProfile.js";
import { isNonDigitalIndustry, schemaTypesForIndustry } from "./customerProfile.js";
import { assignImageRoles, mapToPackIndustry } from "../local-seo/imageRoleAssigner.js";
import type { DeployConfig, NarrativeEngineConfig }      from "./types";
import type {
  ClusterPageContent,
  ClusterWhatsIncluded,
  ClusterWhoItsFor,
  ClusterCommonMistakes,
} from "./generateClusterContent";
import {
  resolveCTA,
  buildCTASection,
  buildMidPageCTA,
  type CTAConfig,
} from "./ctaBlock.js";
import type { WebDesignNarrativeOverrides } from "../narratives/applyWebDesignNarrativePackage";
import type { LocalSeoNarrativeOverrides } from "../narratives/applyLocalSeoNarrativePackage";

/** Walk up the directory tree from the compiled file to find a workspace asset dir. */
function findAssetFile(subpath: string): string {
  const fromCwd = path.join(process.cwd(), subpath);
  if (fs.existsSync(fromCwd)) return fromCwd;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, subpath);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return fromCwd;
}

// ── Project config shape used by the renderer ─────────────────────────────────
//
// Superset of the base ProjectConfig type — includes the optional fields
// present in real project JSON files (footerCompanyName, logoUrl, etc.)

export interface RenderProjectConfig {
  clientSlug:           string;
  businessName:         string;
  domain:               string;
  phone:                string;
  email:                string;
  primaryCtaText:       string;
  primaryCtaUrl:        string;
  businessAddress:      string;
  mapEmbedUrl?:         string;
  moneyPageUrl?:        string;
  moneyPageKeyword?:    string;
  isHub?:               boolean;
  companyNumber?:       string;
  footerCompanyName?:   string;
  footerCompanyNumber?: string;
  footerStrapline?:     string;
  footerLinks?:         { label: string; href: string }[];
  footerServiceLinks?:  { label: string; href: string }[];
  logoUrl?:             string;
  privacyUrl?:          string;
  termsUrl?:            string;
  navItems?:            { label: string; href: string }[];
  deploy?:              DeployConfig;
  narrativeEngine?:     NarrativeEngineConfig;
  aiCitationOptimisation?: {
    enabled: boolean;
  };
  whiteLabelPoweredBy?:  boolean;
  strapline?:            string;
  description?:          string;
  shortDescription?:     string;
  uspStatements?:        string[];
  trustStatements?:      string[];
  toneNotes?:            string;
  brandStyleVariant?:    string;
  industryType?:         string;
  buyerType?:            "household" | "business" | "landlord-property" | "mixed";
  serviceType?:          string;
  providerType?:         string;
  serviceDeliverables?:  string[];
  campaignCustomerProblems?: string[];
  conversionAction?:     string;
  /** Per-project CTA URL overrides and booking/callback destinations. */
  ctaConfig?:            CTAConfig;
  /**
   * Customer service provider profile for non-digital campaigns.
   * When present and approved, schema (LocalBusiness, Service) uses this
   * business identity instead of the project-level agency identity.
   * When absent/unapproved on a non-digital page, the publish gate fires
   * s.schemaProviderMissing (MAJOR) and blocks publish.
   */
  customerProfile?:      CustomerProviderProfile;
  /** Pool of pages available for internal linking (from ProjectConfig). */
  internalLinks?:        import("./types").InternalLinksConfig;
  /**
   * Cluster area links for hub pages — rendered into the "Areas We Cover"
   * section. These are same-service neighbourhood pages for the hub city.
   * Kept separate from internalLinks (cross-service Related Services cards).
   */
  clusterAreaLinks?:     { href: string; label: string; description?: string }[];
  /** Per-service commercial landing pages (from project JSON). */
  serviceMoneyPages?:   Record<string, string>;
}

// ── Cluster config shape used by the renderer ─────────────────────────────────

export interface ClusterRenderConfig {
  service:            string;
  location:           string;
  primaryKeyword:     string;
  supportingKeywords: string[];
  hubUrl:             string;
  hubAnchor:          string;
  relatedPages?:      string;
  remotePath:         string;
  imageGroup:         string;
  heroImage?:         string;
  /** When set, resolveAssignedImage reads output/{campaignId}/assets/{serviceKey}/ */
  campaignId?:        string;
  serviceKey?:        string;
}

// ── Private render helpers ────────────────────────────────────────────────────

function buildMoneyPageSection(url?: string, keyword?: string): string {
  if (!url || !keyword) return "";
  const cleanKeyword = keyword
    .replace(/\s+(rotherham|sheffield|doncaster|barnsley)$/i, "")
    .trim();
  return `<section class="money-page-band"><div class="container"><p>Looking for <a href="${url}">${cleanKeyword}</a> in your local area? Visit our dedicated service page.</p></div></section>`;
}

function paras(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.trim()}</p>`)
    .join("\n        ");
}

/** Split multi-paragraph text into a lead (first `n` paragraphs) and detail (remainder). */
function splitParas(text: string, leadCount = 1): { lead: string; detail: string } {
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    lead:   paras(parts.slice(0, leadCount).join("\n\n")),
    detail: parts.length > leadCount ? paras(parts.slice(leadCount).join("\n\n")) : "",
  };
}

/**
 * Title-case a keyword phrase for display.
 * Handles common acronyms: SEO, PPC, UK, US.
 */
function titleCase(s: string): string {
  if (!s) return "";
  const alwaysUpper = new Set(["seo", "ppc", "uk", "us", "vat", "ltd"]);
  return s.replace(/\w\S*/g, (w) => {
    const lower = w.toLowerCase();
    if (alwaysUpper.has(lower)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

/**
 * Convert absolute URLs that belong to the project's own domain into
 * root-relative paths so internal links are portable — but ONLY inside
 * <a> elements in the body. <link rel="canonical">, other meta tags, and
 * crucially <nav> links must keep their absolute URLs.
 *
 * Nav links point to the main site (e.g. inboxingproweb.com) and are
 * intentionally external — stripping their domain causes the smoke check
 * to flag them as will-404-on-subdomain relative hrefs.
 *
 * e.g. href="https://local.inboxingproweb.com/web-design-wickersley/"
 *   → href="/web-design-wickersley/"
 */
function normaliseInternalLinks(html: string, domain: string): string {
  if (!domain) return html;
  const base = domain.replace(/\/+$/, "");

  const stripDomain = (part: string): string =>
    part.replace(/<a\b([^>]*)href="(https?:\/\/[^"]+)"/g, (match, before, href) => {
      if (href.startsWith(base)) {
        return `<a${before}href="${href.slice(base.length)}"`;
      }
      return match;
    });

  // Preserve <nav> blocks intact — their links are external/absolute by design.
  // Split around every <nav>…</nav>, normalise only the non-nav segments.
  const parts = html.split(/(<nav\b[^>]*>[\s\S]*?<\/nav>)/i);
  return parts
    .map((part, i) => (i % 2 === 0 ? stripDomain(part) : part))
    .join("");
}

/**
 * Trim text to the last complete sentence within `limit` characters.
 * Prevents meta/schema descriptions from ending mid-sentence.
 */
function trimToSentence(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit);
  // Try last sentence-ending punctuation followed by space (or end of slice)
  const sentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("! "),
    truncated.endsWith(".") || truncated.endsWith("?") || truncated.endsWith("!") ? limit : -1
  );
  if (sentenceEnd > limit * 0.5) {
    // Include the punctuation character itself
    const endPos = truncated.endsWith(".") || truncated.endsWith("?") || truncated.endsWith("!")
      ? limit
      : sentenceEnd + 1;
    return truncated.slice(0, endPos).trim();
  }
  // Fallback: trim to last word boundary and append a period
  const lastSpace = truncated.lastIndexOf(" ");
  const short = lastSpace > limit * 0.5 ? truncated.slice(0, lastSpace) : truncated;
  return short.trim().replace(/[,;:\-–—]+$/, "") + ".";
}

/**
 * Remove empty anchor tags and any vacuous surrounding phrases.
 * Handles: "Learn more at <a href="..."></a>."  →  ""
 *          <a href="..."></a>                    →  ""
 */
function removeEmptyAnchors(html: string): string {
  // Remove "Learn more at <a ...></a>" style phrases (with optional trailing punctuation)
  html = html.replace(/\bLearn more(?: about| at)?\s+<a\b[^>]*>\s*<\/a>[.,]?/gi, "");
  // Remove any remaining empty anchors
  html = html.replace(/<a\b[^>]*>\s*<\/a>/g, "");

  // ── Broken-sentence fragment sanitiser ─────────────────────────────────────
  // Catches "visit ." / "Visit ." / "For more insights, visit ." patterns that
  // arise when an inline link had no anchor text and the empty <a> was removed.
  // Strategy: remove the entire sub-clause rather than leave a dangling fragment.
  // Pattern: optional leading comma/space + "visit" variant + whitespace + full-stop
  html = html.replace(/,?\s*[Ff]or more insights?,?\s+[Vv]isit\s+\.\s*/g, ". ");
  html = html.replace(/,?\s*[Vv]isit\s+(?:our\s+)?(?:dedicated\s+)?(?:service\s+)?page\s+\.\s*/gi, ". ");
  html = html.replace(/\bvisit\s{0,3}\.\s*/gi, "");
  html = html.replace(/\bVisit\s{0,3}\.\s*/g, "");

  // Normalise any double-spaces or ". ." artefacts left behind
  html = html.replace(/\.\s*\.\s*/g, ".");
  html = html.replace(/  +/g, " ");

  return html;
}

/**
 * Build a Google Maps embed URL from business name + full address.
 * Always produces a labelled pin showing the business name, regardless of
 * whether the project config also has mapLatitude/mapLongitude.
 * Priority: explicit mapEmbedUrl in config (only if it does NOT contain raw
 * coordinates pattern) → business name + address query → address-only → OSM.
 */
function buildAddressMapUrl(project: RenderProjectConfig): string {
  const raw = project.mapEmbedUrl ?? "";
  // Only use a hardcoded mapEmbedUrl if it already uses an address-based query
  // (i.e. it does NOT look like lat/lng coordinates like "53.42,-1.35")
  const isCoordinateUrl = /[?&]q=-?\d{1,3}\.\d+,-?\d{1,3}\.\d+/.test(raw);
  if (raw && !isCoordinateUrl) return raw;

  // Prefer business name + full address — shows a named pin
  if (project.businessName && project.businessAddress) {
    const q = encodeURIComponent(`${project.businessName}, ${project.businessAddress}`);
    const zoom = 17;
    return `https://maps.google.com/maps?q=${q}&z=${zoom}&output=embed`;
  }
  if (project.businessAddress) {
    const q = encodeURIComponent(project.businessAddress);
    return `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
  }
  return `https://www.openstreetmap.org/export/embed.html?bbox=-1.3693%2C53.4115%2C-1.3393%2C53.4415&layer=mapnik`;
}

function renderCards(
  items: { href: string; text: string; description?: string }[]
): string {
  return items
    .map((item) => {
      const desc = item.description
        ? `\n          <p>${item.description}</p>`
        : "";
      return (
        `<a class="resource-card" href="${item.href}">\n` +
        `          <h3>${item.text}</h3>${desc}\n        </a>`
      );
    })
    .join("\n        ");
}

function renderNavItems(
  items: { label: string; href: string }[]
): string {
  return items
    .map((n) => `<a href="${n.href}">${n.label}</a>`)
    .join("\n        ");
}

function ensureBlogNavItem(
  items: { label: string; href: string }[] | undefined,
): { label: string; href: string }[] {
  const nav = [...(items ?? [])];
  const hasBlog = nav.some(
    (item) =>
      item.label.trim().toLowerCase() === "blog" ||
      item.href.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "") === "/blog",
  );
  if (!hasBlog) {
    nav.push({ label: "Blog", href: "/blog/" });
  }
  return nav;
}

function resolveAssignedImage(cluster: ClusterRenderConfig, slot: "hero" | "support" | "trust" | "conversion"): string | null {
  const serviceKey = cluster.serviceKey ?? cluster.imageGroup?.replace(/^assets\//, "") ?? "";

  if (cluster.campaignId) {
    const paneFile = findCampaignPaneSlotFile(cluster.campaignId, serviceKey, slot);
    if (paneFile) {
      return buildCampaignPaneImageUrl(
        cluster.campaignId,
        paneFile.serviceKey,
        slot,
        paneFile.ext,
        "",
        false,
      ).replace(/^\/+/, "/");
    }
  }

  const candidates = [
    path.join(process.cwd(), "output", "inboxingproweb", "assets", serviceKey, `${slot}.webp`),
    path.join(process.cwd(), "output", "inboxingproweb", "assets", serviceKey, `${slot}.jpg`),
    path.join(process.cwd(), "output", "inboxingproweb", "assets", serviceKey, `${slot}.jpeg`),
    path.join(process.cwd(), "output", "inboxingproweb", "assets", serviceKey, `${slot}.png`),
    path.join(process.cwd(), "output", "inboxingproweb", "assets", `${slot}.webp`),
    path.join(process.cwd(), "output", "inboxingproweb", "assets", `${slot}.jpg`),
    path.join(process.cwd(), "output", "inboxingproweb", "assets", `${slot}.jpeg`),
    path.join(process.cwd(), "output", "inboxingproweb", "assets", `${slot}.png`)
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) return null;

  const marker = `${path.sep}output${path.sep}inboxingproweb${path.sep}`;
  const idx = found.indexOf(marker);
  const rel = idx >= 0 ? found.slice(idx + marker.length) : found;
  return `/${rel.replace(/\\/g, "/")}`;
}

function resolveHeroImage(cluster: ClusterRenderConfig): string {
  const assigned = resolveAssignedImage(cluster, "hero");
  if (assigned) return assigned;

  if (cluster.heroImage) {
    return `/${cluster.imageGroup}/${cluster.heroImage}`;
  }
  const candidates = [
    path.join(cluster.imageGroup, "hero-v1.png"),
    path.join(cluster.imageGroup, "hero-v1.jpg"),
    path.join(cluster.imageGroup, "hero.png"),
    path.join(cluster.imageGroup, "hero.jpg"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found
    ? `/${found.replace(/\\/g, "/")}`
    : `/${cluster.imageGroup}/hero-v1.png`;
}

/** Resolve mid-page full-width image — conversion/results context.
 *  Only considers conversion-named files so the path always contains the word
 *  "conversion" — this is required for the slot-replacement regex in runOneArea
 *  to reliably identify and rewrite this img's src to the live domain URL. */
function resolveMidPageImage(cluster: ClusterRenderConfig): string {
  const assigned = resolveAssignedImage(cluster, "conversion");
  if (assigned) return assigned;

  const candidates = [
    path.join(cluster.imageGroup, "conversion-v1.png"),
    path.join(cluster.imageGroup, "conversion-v1.jpg"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found
    ? `/${found.replace(/\\/g, "/")}`
    : `/${cluster.imageGroup}/conversion-v1.png`;
}

function hasValidConversionImage(cluster: ClusterRenderConfig): boolean {
  if (resolveAssignedImage(cluster, "conversion")) return true;

  const group = (cluster.imageGroup ?? "").replace(/^\/+/, "");
  if (!group) return false;

  const candidates = [
    path.join(process.cwd(), group, "conversion-v1.png"),
    path.join(process.cwd(), group, "conversion-v1.jpg"),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

/** Remove visible conversion placeholders when no conversion asset exists. */
function suppressEmptyConversionImage(html: string): string {
  return html
    .replace(
      /<div\b[^>]*class="[^"]*\bconversion-feature-image\b[^"]*\bv3-placeholder\b[^"]*"[^>]*>[\s\S]*?<\/div>\s*/gi,
      "",
    )
    .replace(
      /<section class="section-band conversion-image-section"[\s\S]*?<\/section>\s*/gi,
      (section) => (/<img\b/i.test(section) ? section : ""),
    );
}

function normaliseServiceKey(value: string | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveServiceTemplateKey(cluster: ClusterRenderConfig): string | null {
  const imageGroupKey = normaliseServiceKey(cluster.imageGroup?.replace(/^assets\//, ""));
  if (imageGroupKey === "web-hosting" || imageGroupKey === "website-hosting") {
    return "web-hosting";
  }
  if (imageGroupKey === "email-marketing") {
    return "email-marketing";
  }
  const serviceKey = normaliseServiceKey(cluster.service);
  if (serviceKey === "web-hosting" || serviceKey === "website-hosting") {
    return "web-hosting";
  }
  if (serviceKey.includes("web-hosting") || serviceKey.includes("website-hosting")) {
    return "web-hosting";
  }
  if (serviceKey === "email-marketing" || serviceKey.includes("email-marketing")) {
    return "email-marketing";
  }
  return null;
}

function resolveClusterTemplatePath(cluster: ClusterRenderConfig): string {
  const serviceTemplate = resolveServiceTemplateKey(cluster);
  if (serviceTemplate === "web-hosting") {
    const hostingPath = findAssetFile(path.join("templates", "services", "web-hosting.html"));
    if (fs.existsSync(hostingPath)) return hostingPath;
  }
  if (serviceTemplate === "email-marketing") {
    const emailPath = findAssetFile(path.join("templates", "services", "email-marketing.html"));
    if (fs.existsSync(emailPath)) return emailPath;
  }
  return findAssetFile(path.join("templates", "cluster.html"));
}

// ── Contextual body anchor link injection (hub / cluster narrative sections) ───

type ContextualLinkKind = "hub" | "cluster" | "related-service" | "money-page";

type ContextualLinkCandidate = {
  href: string;
  label: string;
  kind: ContextualLinkKind;
};

const ROTHERHAM_BOROUGH_AREAS = new Set([
  "aston", "bramley", "dinnington", "kiveton park", "maltby", "parkgate",
  "rawmarsh", "swallownest", "thurcroft", "wickersley",
]);

const RELATED_SERVICE_KEYS: Record<string, string[]> = {
  website_hosting: ["email_marketing", "local_seo", "web_design"],
  email_marketing: ["website_hosting", "local_seo", "web_design"],
  local_seo:       ["website_hosting", "email_marketing", "web_design"],
  web_design:      ["website_hosting", "email_marketing", "local_seo"],
};

const RELATED_SERVICE_ANCHORS: Record<string, string[]> = {
  website_hosting: ["UK website hosting", "managed WordPress hosting", "website hosting services"],
  email_marketing: ["email and SMS marketing", "customer retention campaigns", "automated follow-up campaigns"],
  local_seo:       ["local SEO services", "Google Business Profile optimisation"],
  web_design:      ["professional website design", "web design services"],
};

const OUR_SERVICES_MONEY_URL = "https://inboxingproweb.com/our-services/";

function escHtmlLite(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function normaliseServiceKeyInternal(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/^web_hosting$/, "website_hosting");
}

function normaliseContextualHref(value: string): string {
  const noDomain = value.replace(/^https?:\/\/[^/]+/, "");
  const previewPath = noDomain.match(/^\/preview\/[^/]+(\/.+)$/);
  const href = previewPath?.[1] ?? noDomain ?? value;
  return href.replace(/\/+$/, "") || href;
}

function serviceDisplayLower(serviceKey: string): string {
  const map: Record<string, string> = {
    website_hosting: "website hosting",
    email_marketing: "email marketing",
    local_seo:       "local SEO",
    web_design:      "web design",
  };
  return map[serviceKey] ?? serviceKey.replace(/_/g, " ");
}

function moneyPageKeyForService(serviceKey: string): string | null {
  if (serviceKey === "website_hosting") return "web-hosting";
  if (serviceKey === "email_marketing") return "email-marketing";
  if (serviceKey === "local_seo")       return "local-seo";
  if (serviceKey === "web_design")      return "web-design";
  return null;
}

function parentCityFromCluster(cluster: ClusterRenderConfig): string {
  const hubAnchor = (cluster.hubAnchor ?? "").trim();
  const serviceWords = titleCase(cluster.service ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const cityFromAnchor = hubAnchor
    .split(/\s+/)
    .filter((word) => !serviceWords.includes(word.toLowerCase()))
    .join(" ")
    .trim();
  if (cityFromAnchor) return cityFromAnchor;

  const hubSlug = (cluster.hubUrl ?? "")
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/|\/$/g, "");
  const serviceSlug = (cluster.service ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return hubSlug.replace(new RegExp(`^${serviceSlug}-`, "i"), "").replace(/-/g, " ").trim();
}

function isRotherhamBoroughCluster(link: { location?: string; href?: string }, hubCity: string): boolean {
  if (hubCity.toLowerCase() !== "rotherham") return true;
  const loc = (link.location ?? "").trim().toLowerCase();
  if (loc && ROTHERHAM_BOROUGH_AREAS.has(loc)) return true;
  const slug = (link.href ?? "").match(/\/(?:web-hosting|email-marketing|local-seo|web-design)-([^/]+)\//)?.[1] ?? "";
  return ROTHERHAM_BOROUGH_AREAS.has(slug.replace(/-/g, " "));
}

function deriveHubLink(cluster: ClusterRenderConfig): { href: string; label: string } | null {
  if (cluster.hubUrl && cluster.hubAnchor) {
    return { href: cluster.hubUrl, label: titleCase(cluster.hubAnchor) };
  }
  const template = resolveServiceTemplateKey(cluster);
  if (!template) return null;
  const parentCity = parentCityFromCluster(cluster);
  const citySlug = parentCity.toLowerCase().replace(/\s+/g, "-");
  const href = `/${template}-${citySlug}/`;
  const svcKey = normaliseServiceKeyInternal(cluster.service ?? "");
  return {
    href,
    label: `${serviceDisplayLower(svcKey)} in ${parentCity}`,
  };
}

function getContextualInjectionSectionIds(template: "web-hosting" | "email-marketing"): string[] {
  if (template === "web-hosting") {
    return ["hosting-features", "hosting-problems", "hosting-security", "hosting-comparison", "hosting-migration"];
  }
  return ["email-why-works", "email-retention", "email-automation", "email-deliverability", "email-reporting"];
}

function buildContextualLinkCandidates(
  project: RenderProjectConfig,
  cluster: ClusterRenderConfig,
): ContextualLinkCandidate[] {
  const candidates: ContextualLinkCandidate[] = [];
  const seenTargets = new Set<string>();
  const seenLabels = new Set<string>();

  const addCandidate = (candidate: ContextualLinkCandidate) => {
    const href = normaliseContextualHref(candidate.href);
    const labelKey = candidate.label.trim().toLowerCase();
    if (!href || seenTargets.has(href) || seenLabels.has(labelKey)) return;
    seenTargets.add(href);
    seenLabels.add(labelKey);
    candidates.push({
      ...candidate,
      href: href.startsWith("http") ? candidate.href.replace(/\/+$/, "") + "/" : `${href}/`,
    });
  };

  const currentService = normaliseServiceKeyInternal(cluster.service ?? "");
  const currentPath = normaliseContextualHref(cluster.remotePath ?? "");
  const hubCity = project.isHub ? (cluster.location ?? "Rotherham") : parentCityFromCluster(cluster);
  const hubCityLc = hubCity.toLowerCase();
  const allLinks = project.internalLinks?.links ?? [];
  const moneyPages = project.serviceMoneyPages ?? {};

  const siblingClusters = (excludeSelf = true) =>
    allLinks
      .filter((link) =>
        normaliseServiceKeyInternal(link.service ?? "") === currentService &&
        link.tier === "area" &&
        isRotherhamBoroughCluster(link, hubCity) &&
        (!excludeSelf || normaliseContextualHref(link.href) !== currentPath),
      )
      .sort((a, b) => String(a.location ?? "").localeCompare(String(b.location ?? "")));

  const relatedServiceHubs = (): ContextualLinkCandidate[] => {
    const slugMap: Record<string, string> = {
      website_hosting: "web-hosting",
      email_marketing: "email-marketing",
      local_seo:       "local-seo",
      web_design:      "web-design",
    };
    const out: ContextualLinkCandidate[] = [];
    for (const relSvc of RELATED_SERVICE_KEYS[currentService] ?? []) {
      const hubLink = allLinks.find((link) =>
        link.tier === "hub" &&
        normaliseServiceKeyInternal(link.service ?? "") === relSvc &&
        (link.location ?? "").trim().toLowerCase() === hubCityLc,
      );
      const relSlug = slugMap[relSvc];
      const href = hubLink?.href
        ?? (relSlug ? `/${relSlug}-${hubCityLc.replace(/\s+/g, "-")}/` : "");
      if (!href) continue;
      const anchors = RELATED_SERVICE_ANCHORS[relSvc] ?? [];
      out.push({
        href,
        label: anchors[0] ?? `${serviceDisplayLower(relSvc)} in ${hubCity}`,
        kind: "related-service",
      });
    }
    return out;
  };

  const moneyPageCandidates = (): ContextualLinkCandidate[] => {
    const out: ContextualLinkCandidate[] = [];
    const ownKey = moneyPageKeyForService(currentService);
    if (ownKey && moneyPages[ownKey]) {
      const anchors = RELATED_SERVICE_ANCHORS[currentService] ?? [`${serviceDisplayLower(currentService)} services`];
      out.push({ href: moneyPages[ownKey], label: anchors[0], kind: "money-page" });
    }
    for (const relSvc of RELATED_SERVICE_KEYS[currentService] ?? []) {
      const mpKey = moneyPageKeyForService(relSvc);
      if (!mpKey || !moneyPages[mpKey]) continue;
      const anchors = RELATED_SERVICE_ANCHORS[relSvc] ?? [];
      if (anchors.length > 1) {
        out.push({ href: moneyPages[mpKey], label: anchors[1], kind: "money-page" });
      }
    }
    out.push({ href: OUR_SERVICES_MONEY_URL, label: "our digital services", kind: "money-page" });
    return out;
  };

  const interleaveGroups = (...groups: ContextualLinkCandidate[][]): ContextualLinkCandidate[] => {
    const order: ContextualLinkCandidate[] = [];
    const idx = groups.map(() => 0);
    let progressed = true;
    while (progressed && order.length < 12) {
      progressed = false;
      for (let g = 0; g < groups.length; g++) {
        if (idx[g] < groups[g].length) {
          order.push(groups[g][idx[g]!]!);
          idx[g]! += 1;
          progressed = true;
        }
      }
    }
    return order;
  };

  if (project.isHub) {
    const clusterLinks = (project.clusterAreaLinks ?? []).length
      ? project.clusterAreaLinks!
      : siblingClusters(false).map((link) => ({
          href: link.href,
          label: `${cluster.service ?? ""} ${link.location ?? ""}`.trim(),
        }));

    const clusterCandidates = clusterLinks.slice(0, 4).map((area) => {
      const location = (area.label ?? "")
        .replace(new RegExp(`^${(cluster.service ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "")
        .trim() || area.label;
      return {
        href: area.href,
        label: `${serviceDisplayLower(currentService)} in ${location}`,
        kind: "cluster" as const,
      };
    });

    for (const candidate of interleaveGroups(clusterCandidates, relatedServiceHubs(), moneyPageCandidates())) {
      addCandidate(candidate);
    }
  } else {
    const hubCandidates: ContextualLinkCandidate[] = [];
    const hub = deriveHubLink(cluster);
    if (hub) {
      hubCandidates.push({
        href: hub.href,
        label: `${serviceDisplayLower(currentService)} in ${hubCity}`,
        kind: "hub",
      });
    }

    const clusterCandidates = siblingClusters(true).slice(0, 4).map((sib) => ({
      href: sib.href,
      label: `${serviceDisplayLower(currentService)} in ${sib.location ?? ""}`.trim(),
      kind: "cluster" as const,
    }));

    for (const candidate of interleaveGroups(
      hubCandidates,
      clusterCandidates,
      relatedServiceHubs(),
      moneyPageCandidates(),
    )) {
      addCandidate(candidate);
    }
  }

  return candidates;
}

function buildContextualLinkSentence(candidate: ContextualLinkCandidate): string {
  const href = candidate.href.replace(/^https?:\/\/[^/]+/, "") || candidate.href;
  const hrefOut = href.startsWith("http") ? href : (href.endsWith("/") ? href : `${href}/`);
  const anchor = `<a class="contextual-link contextual-link--${candidate.kind}" href="${escHtmlLite(hrefOut)}">${escHtmlLite(candidate.label)}</a>`;
  switch (candidate.kind) {
    case "hub":
      return ` For the wider town overview, see ${anchor}.`;
    case "cluster":
      return ` Nearby areas such as ${anchor} share the same priorities.`;
    case "related-service":
      return ` Many businesses also explore ${anchor} alongside this work.`;
    case "money-page":
      return ` You can review ${anchor} for full commercial detail.`;
    default:
      return ` Learn more via ${anchor}.`;
  }
}

export function applyContextualBodyLinks(
  inputHtml: string,
  project: RenderProjectConfig,
  cluster: ClusterRenderConfig,
): string {
  const template = resolveServiceTemplateKey(cluster);
  const candidates = buildContextualLinkCandidates(project, cluster);
  if (!candidates.length) return inputHtml;

  const sectionIds = template === "web-hosting" || template === "email-marketing"
    ? getContextualInjectionSectionIds(template)
    : [];

  const legacySectionPatterns = sectionIds.length === 0
    ? [
        /<section class="blue-band" id="ai-summary-section">[\s\S]*?<\/section>/,
        /<section id="split-section-one">[\s\S]*?<\/section>/,
        /<section class="impact" id="split-section-two">[\s\S]*?<\/section>/,
        /<section class="soft">[\s\S]*?<\/section>/,
      ]
    : [];

  const MAX_LINKS_PER_SECTION = 3;
  const MAX_LINKS_PER_PAGE = 10;
  const usedAnchorsPage = new Set<string>();
  let pageLinks = 0;
  let candidateIndex = 0;
  let output = inputHtml;

  const takeNextCandidate = (usedSectionUrls: Set<string>): ContextualLinkCandidate | null => {
    while (candidateIndex < candidates.length) {
      const candidate = candidates[candidateIndex++];
      const urlKey = normaliseContextualHref(candidate.href);
      const anchorKey = candidate.label.trim().toLowerCase();
      if (usedSectionUrls.has(urlKey) || usedAnchorsPage.has(anchorKey)) continue;
      usedSectionUrls.add(urlKey);
      usedAnchorsPage.add(anchorKey);
      return candidate;
    }
    return null;
  };

  const injectIntoSectionHead = (sectionHtml: string, usedSectionUrls: Set<string>): string => {
    let sectionLinks = 0;
    return sectionHtml.replace(
      /(<div class="section-head[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/i,
      (_match, open: string, inner: string, close: string) => {
        const updatedInner = inner.replace(/<p>([\s\S]*?)<\/p>/gi, (pFull: string, body: string) => {
          if (sectionLinks >= MAX_LINKS_PER_SECTION || pageLinks >= MAX_LINKS_PER_PAGE) return pFull;
          if (/<a\b/i.test(body) || /contextual-link/.test(body)) return pFull;
          const candidate = takeNextCandidate(usedSectionUrls);
          if (!candidate) return pFull;
          sectionLinks += 1;
          pageLinks += 1;
          return `<p>${body}${buildContextualLinkSentence(candidate)}</p>`;
        });
        return open + updatedInner + close;
      },
    );
  };

  if (sectionIds.length > 0) {
    for (const sectionId of sectionIds) {
      if (pageLinks >= MAX_LINKS_PER_PAGE || candidateIndex >= candidates.length) break;
      const sectionRe = new RegExp(`<section[^>]*id="${sectionId}"[^>]*>[\\s\\S]*?<\\/section>`, "i");
      output = output.replace(sectionRe, (sectionHtml) => {
        if (pageLinks >= MAX_LINKS_PER_PAGE || candidateIndex >= candidates.length) return sectionHtml;
        return injectIntoSectionHead(sectionHtml, new Set<string>());
      });
    }
  } else {
    for (const pattern of legacySectionPatterns) {
      if (pageLinks >= MAX_LINKS_PER_PAGE || candidateIndex >= candidates.length) break;
      output = output.replace(pattern, (sectionHtml) => {
        if (pageLinks >= MAX_LINKS_PER_PAGE || candidateIndex >= candidates.length) return sectionHtml;
        if (/contextual-link/.test(sectionHtml)) return sectionHtml;
        const usedSectionUrls = new Set<string>();
        return injectIntoSectionHead(sectionHtml, usedSectionUrls);
      });
    }
  }

  return output.replace(
    /(<a class="contextual-link[^"]*" href=")\/preview\/[^/]+\/([^"]+")/g,
    "$1/$2",
  );
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1].trim() : trimmed.slice(0, 140).trim();
}

function buildHostingReviewCta(args: {
  location: string;
  ctaUrl: string;
  phone?: string;
  esc: (s: string) => string;
}): string {
  const { location, ctaUrl, phone, esc } = args;
  const checks = [
    "Website speed and server response",
    "SSL certificate status",
    "Security and malware protection",
    "Backup coverage and recovery",
    "Uptime and reliability",
    "WordPress health and updates",
  ];
  const checkHtml = checks
    .map((item) => `<div class="hosting-review-item">${esc(item)}</div>`)
    .join("\n      ");
  const phoneBtn = phone
    ? `<a class="btn secondary" href="tel:${phone.replace(/\s/g, "")}">Call ${esc(phone)}</a>`
    : "";
  return `<section class="hosting-review-cta" id="hosting-review-cta">
  <div class="wrap">
    <span class="eyebrow" style="background:rgba(53,197,255,.15);color:#bcecff;">Free hosting review</span>
    <h2>Free Website Hosting Review for ${esc(location)} Businesses</h2>
    <p>Find out whether your current hosting is helping or hurting visibility, security and enquiries. We review the essentials that matter for local business websites.</p>
    <div class="hosting-review-grid">${checkHtml}</div>
    <div class="btns">
      <a class="btn btn-lg" href="${esc(ctaUrl)}">Request Your Free Hosting Review</a>
      ${phoneBtn}
    </div>
  </div>
</section>`;
}

function buildHostingTemplateTokens(args: {
  ai: ClusterPageContent;
  cluster: ClusterRenderConfig;
  displayService: string;
  businessName: string;
  ctaUrl: string;
  phone?: string;
  esc: (s: string) => string;
  paras: (text: string) => string;
}): Record<string, string> {
  const { ai, cluster, displayService, businessName, ctaUrl, phone, esc, paras } = args;
  const loc = cluster.location;

  const trustStrip = `<section class="proof-band" aria-label="Hosting trust signals">
  <div class="wrap proof-row">
    <div><strong>UK Hosting</strong><span>Premium server infrastructure</span></div>
    <div><strong>99.9%</strong><span>Uptime monitoring</span></div>
    <div><strong>LiteSpeed</strong><span>Performance technology</span></div>
    <div><strong>Since 2013</strong><span>Trusted local support</span></div>
  </div>
</section>`;

  const featureItems = [
    { title: "Fast page loading", icon: "⚡", fallback: "Speed-focused hosting helps local visitors stay on your site instead of bouncing to a competitor." },
    { title: "Security and SSL", icon: "🔒", fallback: "SSL and active protection help browsers, customers and search engines trust your website." },
    { title: "Responsive support", icon: "🛟", fallback: "When hosting issues affect enquiries, you need a team you can actually reach." },
  ];
  const bulletFallbacks = ai.aiSummaryBullets ?? [];
  const featureCards = featureItems.map((item, index) => {
    const body = firstSentence(bulletFallbacks[index] ?? item.fallback);
    return `<div class="card compact"><div class="icon">${item.icon}</div><h3>${esc(item.title)}</h3><p>${esc(body)}</p></div>`;
  }).join("\n      ");
  const featuresRow = `<div class="grid-3">${featureCards}</div>`;

  const problemParagraphs = (ai.split1?.body ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 6);
  const problemCards = (problemParagraphs.length ? problemParagraphs : [
    "Slow hosting reduces search visibility and frustrates visitors before they enquire.",
    "Weak security and missing SSL undermine trust with local customers.",
    "Unreliable uptime creates missed enquiries when the site is unavailable.",
    "No backups leave businesses exposed to data loss and costly recovery.",
    "Cheap shared hosting creates noisy-neighbour slowdowns at peak times.",
    "Poor support delays fixes when the website goes offline.",
  ]).map((problem, index) => {
    const title = firstSentence(problem).replace(/\.$/, "") || `Hosting issue ${index + 1}`;
    return `<div class="card compact"><div class="icon">${String(index + 1).padStart(2, "0")}</div><h3>${esc(title)}</h3><p>${esc(firstSentence(problem))}</p></div>`;
  }).join("\n      ");
  const problemsSection = `<div class="section-head compact">
      <span class="tag">Hosting problems</span>
      <h2>${esc(ai.split1?.heading || `Hosting Problems We Solve for ${loc} Businesses`)}</h2>
      <p>Poor hosting creates downtime, security risk and slow performance.</p>
    </div>
    <div class="grid-3">${problemCards}</div>`;

  const performanceHeading = ai.split2?.heading || `Performance and Uptime for ${displayService} in ${loc}`;
  const metricItems = [
    { value: "99.9%", label: "Uptime target", detail: "Reliable availability for local business websites" },
    { value: "LiteSpeed", label: "Web server tech", detail: "Faster response times under real traffic" },
    { value: "SSD", label: "Storage", detail: "Quicker file access and smoother page loads" },
    { value: "UK", label: "Server location", detail: "Lower latency for UK visitors and local search" },
    { value: "Daily", label: "Backups", detail: "Recovery options when updates or issues occur" },
    { value: "WP", label: "WordPress ready", detail: "Optimised performance for WordPress business sites" },
  ];
  const metricCards = metricItems.map((m) =>
    `<div class="metric-card"><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span><p>${esc(m.detail)}</p></div>`
  ).join("\n      ");
  const performanceSection = `<div class="section-head compact">
      <span class="tag">Performance</span>
      <h2>${esc(performanceHeading)}</h2>
    </div>
    <div class="metric-grid">${metricCards}</div>`;
  const performanceSupport = ai.split2?.body
    ? `<div class="card compact"><h3>Built for business visibility</h3>${paras(firstSentence(ai.split2.body))}</div>`
    : `<div class="card compact"><h3>Built for business visibility</h3><p>Fast UK hosting helps ${esc(loc)} businesses stay online, load quickly and support local search performance.</p></div>`;

  const securityFeatures = [
    { title: "Free SSL Certificates", detail: "HTTPS protection for browsers, customers and search engines." },
    { title: "Malware Protection", detail: "Monitoring helps reduce the risk of infected files affecting your site." },
    { title: "Imunify360 Security", detail: "Advanced server-level protection against common hosting threats." },
    { title: "Firewall Protection", detail: "Blocks malicious traffic before it reaches your website." },
    { title: "Account Isolation", detail: "Separates accounts to reduce cross-site contamination risk." },
    { title: "Daily Security Monitoring", detail: "Ongoing checks so issues are spotted before they become outages." },
  ];
  const securityCards = securityFeatures.map((item, index) =>
    `<div class="card compact"><div class="icon">${String(index + 1).padStart(2, "0")}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const securitySection = `<div class="section-head center compact">
      <span class="tag">Security</span>
      <h2>Security, SSL and Malware Protection</h2>
      <p>Managed hosting should protect your website by default — not treat security as an optional extra.</p>
    </div>
    <div class="grid-6">${securityCards}</div>`;

  const backupCards = [
    { title: "Daily automated backups", detail: "Regular copies reduce the impact of failed updates or accidental changes." },
    { title: "Fast recovery options", detail: "Restore files or databases without rebuilding the site from scratch." },
    { title: "Business continuity", detail: "Less downtime when something goes wrong behind the scenes." },
  ];
  const backupsHeading = ai.noWebsiteSection?.heading || `Backups and Recovery for ${loc} Websites`;
  const backupsCardsHtml = backupCards.map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const backupsSection = `<div class="section-head compact">
      <span class="tag">Backups</span>
      <h2>${esc(backupsHeading)}</h2>
      <p>${esc(firstSentence(ai.noWebsiteSection?.body ?? "Automated backups and a clear recovery process reduce the business impact of data loss, failed updates or server issues."))}</p>
    </div>
    <div class="grid-3">${backupsCardsHtml}</div>`;

  const comparisonSection = `<div class="section-head center compact">
      <span class="tag">Compare hosting</span>
      <h2>Professional Hosting vs Budget Hosting</h2>
      <p>Cheaper hosting often looks fine until speed, security or downtime starts costing enquiries.</p>
    </div>
    <div class="compare">
      <div class="compare-box">
        <span class="tag">Budget hosting</span>
        <h3>Cheap shared hosting</h3>
        <ul class="clean">
          <li>Slower page loads under traffic</li>
          <li>Basic or missing security layers</li>
          <li>Limited or manual backups</li>
          <li>Slow ticket-based support</li>
          <li>More downtime risk</li>
          <li>Minimal maintenance oversight</li>
        </ul>
      </div>
      <div class="compare-box dark">
        <span class="tag">Managed hosting</span>
        <h3>Professional UK hosting</h3>
        <ul class="clean">
          <li>Faster server response and page speed</li>
          <li>SSL, firewall and malware protection</li>
          <li>Daily backups and recovery support</li>
          <li>Local, reachable hosting support</li>
          <li>99.9% uptime monitoring focus</li>
          <li>Ongoing maintenance and updates</li>
        </ul>
      </div>
    </div>`;

  const migrationCards = [
    { title: "Free migration", detail: "We handle the move from your current host wherever possible." },
    { title: "Minimal downtime", detail: "Planned switching reduces disruption to enquiries and visibility." },
    { title: "Handled by experts", detail: "DNS, files and launch checks managed by our hosting team." },
    { title: "No technical knowledge required", detail: "Plain-English guidance for business owners who want it done properly." },
  ].map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const migrationSection = `<div class="section-head center compact">
      <span class="tag">Migration</span>
      <h2>Free Website Migration With Minimal Downtime</h2>
      <p>Switching hosts does not have to be stressful. We manage the move so ${esc(loc)} businesses can upgrade hosting without technical headaches.</p>
    </div>
    <div class="grid-4">${migrationCards}</div>`;

  const ukTrustCards = [
    { title: "UK-based support", detail: "Speak to a real team instead of waiting in a distant ticket queue." },
    { title: "Local business focus", detail: `Hosting advice shaped around ${loc} businesses and South Yorkshire support needs.` },
    { title: "Clear communication", detail: "Plain-English updates when something needs attention or action." },
  ].map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const ukTrustSection = `<span class="tag">Local support</span>
      <h2>Local Support and UK Hosting You Can Reach</h2>
      <p>${esc(businessName)} provides UK-based hosting support for businesses in ${esc(loc)}.</p>
      <div class="grid-3" style="margin-top:18px">${ukTrustCards}</div>`;

  const hostingCta = buildHostingReviewCta({ location: loc, ctaUrl, phone, esc });

  return {
    "{{HOSTING_TRUST_STRIP}}": trustStrip,
    "{{HOSTING_FEATURES_ROW}}": featuresRow,
    "{{HOSTING_PROBLEMS_SECTION}}": problemsSection,
    "{{HOSTING_PERFORMANCE_SECTION}}": performanceSection,
    "{{HOSTING_PERFORMANCE_SUPPORT}}": performanceSupport,
    "{{HOSTING_SECURITY_SECTION}}": securitySection,
    "{{HOSTING_BACKUPS_SECTION}}": backupsSection,
    "{{HOSTING_COMPARISON_SECTION}}": comparisonSection,
    "{{HOSTING_MIGRATION_SECTION}}": migrationSection,
    "{{HOSTING_UK_TRUST_SECTION}}": ukTrustSection,
    "{{HOSTING_CTA_SECTION}}": hostingCta,
  };
}

function buildEmailMarketingReviewCta(args: {
  location: string;
  ctaUrl: string;
  phone?: string;
  esc: (s: string) => string;
}): string {
  const { location, ctaUrl, phone, esc } = args;
  const checks = [
    "List health and growth potential",
    "Campaign design and messaging",
    "Automation and follow-up sequences",
    "Deliverability and inbox placement",
    "Open, click and conversion reporting",
    "GDPR compliance and consent setup",
  ];
  const checkHtml = checks
    .map((item) => `<div class="email-review-item">${esc(item)}</div>`)
    .join("\n      ");
  const phoneBtn = phone
    ? `<a class="btn secondary" href="tel:${phone.replace(/\s/g, "")}">Call ${esc(phone)}</a>`
    : "";
  return `<section class="email-review-cta" id="email-review-cta">
  <div class="wrap">
    <span class="eyebrow" style="background:rgba(53,197,255,.15);color:#bcecff;">Free campaign review</span>
    <h2>Free Email Marketing Review for ${esc(location)} Businesses</h2>
    <p>Find out whether your current email marketing is driving repeat sales or leaving revenue on the table. We review the essentials that matter for local business growth.</p>
    <div class="email-review-grid">${checkHtml}</div>
    <div class="btns">
      <a class="btn btn-lg" href="${esc(ctaUrl)}">Request Your Free Email Marketing Review</a>
      ${phoneBtn}
    </div>
  </div>
</section>`;
}

function buildEmailMarketingTemplateTokens(args: {
  ai: ClusterPageContent;
  cluster: ClusterRenderConfig;
  displayService: string;
  businessName: string;
  ctaUrl: string;
  phone?: string;
  esc: (s: string) => string;
  paras: (text: string) => string;
}): Record<string, string> {
  const { ai, cluster, displayService, businessName, ctaUrl, phone, esc, paras } = args;
  const loc = cluster.location;

  const trustStrip = `<section class="proof-band" aria-label="Email marketing trust signals">
  <div class="wrap proof-row">
    <div><strong>Retention</strong><span>Repeat customer campaigns</span></div>
    <div><strong>Automation</strong><span>Follow-up sequences</span></div>
    <div><strong>GDPR</strong><span>Consent-aware messaging</span></div>
    <div><strong>Since 2013</strong><span>Trusted local support</span></div>
  </div>
</section>`;

  const whyItems = [
    { title: "Direct customer contact", icon: "📧", fallback: "Email reaches customers who already know your business — ideal for repeat orders and follow-up sales." },
    { title: "Measurable results", icon: "📊", fallback: "Track opens, clicks and conversions so you know which campaigns generate real revenue." },
    { title: "Cost-effective growth", icon: "📈", fallback: "Professional campaigns help local businesses stay visible without relying only on paid ads." },
  ];
  const bulletFallbacks = ai.aiSummaryBullets ?? [];
  const whyCards = whyItems.map((item, index) => {
    const body = firstSentence(bulletFallbacks[index] ?? item.fallback);
    return `<div class="card compact"><div class="icon">${item.icon}</div><h3>${esc(item.title)}</h3><p>${esc(body)}</p></div>`;
  }).join("\n      ");
  const whyWorksSection = `<div class="section-head center compact">
      <span class="tag">Why email works</span>
      <h2>Why Email Marketing Still Works for ${esc(loc)} Businesses</h2>
      <p>Email remains one of the most effective ways to drive repeat business, promotions and follow-up sales.</p>
    </div>
    <div class="grid-3">${whyCards}</div>`;

  const retentionParagraphs = (ai.split1?.body ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 6);
  const retentionCards = (retentionParagraphs.length ? retentionParagraphs : [
    "Repeat customers are often your most profitable — email keeps them coming back.",
    "Promotions and offers reach people who already trust your business.",
    "Follow-up sequences turn enquiries into booked jobs and repeat orders.",
    "Consistent communication builds loyalty between purchases or visits.",
    "Local businesses lose revenue when customers forget about them between jobs.",
    "Professional campaigns turn your contact list into a reliable sales channel.",
  ]).map((point, index) => {
    const title = firstSentence(point).replace(/\.$/, "") || `Retention benefit ${index + 1}`;
    return `<div class="card compact"><div class="icon">${String(index + 1).padStart(2, "0")}</div><h3>${esc(title)}</h3><p>${esc(firstSentence(point))}</p></div>`;
  }).join("\n      ");
  const retentionSection = `<div class="section-head compact">
      <span class="tag">Retention</span>
      <h2>${esc(ai.split1?.heading || `Customer Retention and Repeat Business in ${loc}`)}</h2>
      <p>Email marketing helps ${esc(loc)} businesses stay in front of existing customers and drive repeat orders.</p>
    </div>
    <div class="grid-3">${retentionCards}</div>`;

  const cm = ai.commonMistakes as ClusterCommonMistakes | undefined;
  const mistakeItems = cm?.items?.slice(0, 6) ?? [];
  const problemCards = (mistakeItems.length ? mistakeItems.map((item) => ({
    title: item.mistake ?? "",
    detail: item.impact ?? "",
  })) : [
    { title: "No follow-up after enquiries", detail: "Leads go cold when businesses fail to nurture contacts after the first interaction." },
    { title: "Irregular or generic campaigns", detail: "Sporadic emails with weak messaging fail to build trust or drive repeat sales." },
    { title: "Poor list hygiene", detail: "Outdated lists reduce deliverability and waste campaign effort." },
    { title: "No automation", detail: "Manual sending misses timely follow-ups that convert interest into bookings." },
    { title: "Weak subject lines and design", detail: "Campaigns that look unprofessional get ignored or marked as spam." },
    { title: "No reporting or testing", detail: "Without analytics, businesses cannot improve what is not measured." },
  ]).map((item, index) =>
    `<div class="card compact"><div class="icon">${String(index + 1).padStart(2, "0")}</div><h3>${esc(item.title)}</h3><p>${esc(firstSentence(item.detail))}</p></div>`
  ).join("\n      ");
  const problemsSection = `<div class="section-head compact">
      <span class="tag">Marketing problems</span>
      <h2>Common Marketing Problems We Solve for ${esc(loc)} Businesses</h2>
      <p>Poor email strategy costs repeat sales, wastes lists and weakens customer retention.</p>
    </div>
    <div class="grid-3">${problemCards}</div>`;

  const campaignHeading = ai.split2?.heading || `Campaign Creation and Design for ${displayService} in ${loc}`;
  const campaignCards = [
    { title: "Professional email design", detail: "On-brand templates that look credible on mobile and desktop." },
    { title: "Promotional campaigns", detail: "Seasonal offers, announcements and sales pushes sent to the right audience." },
    { title: "Newsletter content", detail: "Regular updates that keep your business front of mind with local customers." },
    { title: "Clear calls to action", detail: "Every campaign structured to drive enquiries, bookings or repeat orders." },
  ].map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const campaignSection = `<div class="section-head compact">
      <span class="tag">Campaigns</span>
      <h2>${esc(campaignHeading)}</h2>
    </div>
    <div class="grid-4">${campaignCards}</div>`;
  const campaignSupport = ai.split2?.body
    ? `<div class="card compact"><h3>Designed to convert</h3>${paras(firstSentence(ai.split2.body))}</div>`
    : `<div class="card compact"><h3>Designed to convert</h3><p>Professional email campaigns help ${esc(loc)} businesses promote services, drive repeat orders and stay visible between customer visits.</p></div>`;

  const automationCards = [
    { title: "Welcome sequences", detail: "Introduce new subscribers and set expectations from the first contact." },
    { title: "Follow-up after enquiries", detail: "Automated reminders that turn interest into booked work." },
    { title: "Re-engagement campaigns", detail: "Win back inactive customers before they switch to a competitor." },
    { title: "Post-purchase follow-ups", detail: "Encourage reviews, referrals and repeat orders after a job or sale." },
  ].map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const automationSection = `<div class="section-head center compact">
      <span class="tag">Automation</span>
      <h2>Automation and Follow-Up Sequences</h2>
      <p>Set up campaigns that run in the background — so follow-ups happen even when you are busy on jobs.</p>
    </div>
    <div class="grid-4">${automationCards}</div>`;

  const listGrowthCards = [
    { title: "Website sign-up forms", detail: "Capture enquiries and newsletter subscribers from your site." },
    { title: "Lead magnets and offers", detail: "Incentives that encourage local customers to join your list." },
    { title: "CRM and list integration", detail: "Keep contacts organised so campaigns reach the right people." },
  ].map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const listGrowthSection = `<div class="section-head compact">
      <span class="tag">List growth</span>
      <h2>${esc(ai.noWebsiteSection?.heading || `List Growth and Data Capture for ${loc} Businesses`)}</h2>
      <p>${esc(firstSentence(ai.noWebsiteSection?.body ?? "Growing a quality email list gives local businesses a direct channel for promotions, updates and repeat sales."))}</p>
    </div>
    <div class="grid-3">${listGrowthCards}</div>`;

  const deliverabilityFeatures = [
    { title: "Inbox placement focus", detail: "Campaign setup designed to reach the primary inbox, not spam folders." },
    { title: "Sender reputation", detail: "Proper authentication and sending practices protect deliverability." },
    { title: "List cleaning", detail: "Remove inactive or invalid addresses that harm campaign performance." },
    { title: "GDPR-aware consent", detail: "Permission-based messaging that respects UK data protection rules." },
    { title: "Spam testing", detail: "Checks before send to reduce the risk of filters blocking your campaigns." },
    { title: "Bounce management", detail: "Handle undeliverable addresses so lists stay healthy over time." },
  ];
  const deliverabilityCards = deliverabilityFeatures.map((item, index) =>
    `<div class="card compact"><div class="icon">${String(index + 1).padStart(2, "0")}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const deliverabilitySection = `<div class="section-head center compact">
      <span class="tag">Deliverability</span>
      <h2>Deliverability and Inbox Placement</h2>
      <p>Great email marketing only works if messages actually reach customers — not their spam folder.</p>
    </div>
    <div class="grid-6">${deliverabilityCards}</div>`;

  const reportingMetrics = [
    { value: "Opens", label: "Engagement", detail: "See which subject lines and sends get attention" },
    { value: "Clicks", label: "Interest", detail: "Track which offers and links drive action" },
    { value: "Conv.", label: "Results", detail: "Measure enquiries, bookings and repeat orders" },
    { value: "List", label: "Growth", detail: "Monitor subscriber growth and list health" },
    { value: "A/B", label: "Testing", detail: "Improve campaigns with structured testing" },
    { value: "ROI", label: "Reporting", detail: "Understand return from email vs other channels" },
  ];
  const reportingCards = reportingMetrics.map((m) =>
    `<div class="metric-card"><strong>${esc(m.value)}</strong><span>${esc(m.label)}</span><p>${esc(m.detail)}</p></div>`
  ).join("\n      ");
  const reportingSection = `<div class="section-head compact">
      <span class="tag">Reporting</span>
      <h2>Reporting and Analytics</h2>
      <p>Clear reporting helps ${esc(loc)} businesses understand what is working and where to improve.</p>
    </div>
    <div class="metric-grid">${reportingCards}</div>`;

  const smsCards = [
    { title: "Email campaigns", detail: "Professional newsletters, promotions and nurture sequences for your list." },
    { title: "SMS where relevant", detail: "Timely text reminders and offers for businesses that benefit from instant contact." },
    { title: "Integrated approach", detail: "Combine email and SMS for stronger follow-up without overwhelming customers." },
  ].map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const smsSection = `<div class="section-head center compact">
      <span class="tag">Email + SMS</span>
      <h2>Email and SMS Campaign Support</h2>
      <p>${esc(businessName)} supports local businesses with professional email campaigns — and SMS where it adds value for timely follow-up.</p>
    </div>
    <div class="grid-3">${smsCards}</div>`;

  const successCards = [
    { title: "Local business focus", detail: `Campaigns shaped around ${loc} customers and South Yorkshire buying patterns.` },
    { title: "Repeat sales growth", detail: "Turn existing contacts into loyal customers who buy again and refer others." },
    { title: "Plain-English support", detail: "Strategy and reporting explained clearly — not buried in marketing jargon." },
  ].map((item, index) =>
    `<div class="card compact"><div class="icon">${index + 1}</div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div>`
  ).join("\n      ");
  const successIntro = firstSentence(
    ai.enquirySection?.body
    ?? ai.competitionSection?.body
    ?? `${businessName} helps ${loc} businesses use email marketing to drive repeat orders, stronger retention and measurable campaign results.`,
  );
  const localSuccessSection = `<span class="tag">Local results</span>
      <h2>Local Business Success With Email Marketing</h2>
      <p>${esc(successIntro)}</p>
      <div class="grid-3" style="margin-top:18px">${successCards}</div>`;

  const emailCta = buildEmailMarketingReviewCta({ location: loc, ctaUrl, phone, esc });

  return {
    "{{EMAIL_TRUST_STRIP}}": trustStrip,
    "{{EMAIL_WHY_WORKS_SECTION}}": whyWorksSection,
    "{{EMAIL_RETENTION_SECTION}}": retentionSection,
    "{{EMAIL_PROBLEMS_SECTION}}": problemsSection,
    "{{EMAIL_CAMPAIGN_SECTION}}": campaignSection,
    "{{EMAIL_CAMPAIGN_SUPPORT}}": campaignSupport,
    "{{EMAIL_AUTOMATION_SECTION}}": automationSection,
    "{{EMAIL_LIST_GROWTH_SECTION}}": listGrowthSection,
    "{{EMAIL_DELIVERABILITY_SECTION}}": deliverabilitySection,
    "{{EMAIL_REPORTING_SECTION}}": reportingSection,
    "{{EMAIL_SMS_SECTION}}": smsSection,
    "{{EMAIL_LOCAL_SUCCESS_SECTION}}": localSuccessSection,
    "{{EMAIL_CTA_SECTION}}": emailCta,
  };
}

/** Resolve half-width split section image — trust/professional context. */
function resolveSplitImage(cluster: ClusterRenderConfig): string {
  const assigned = resolveAssignedImage(cluster, "trust") || resolveAssignedImage(cluster, "support");
  if (assigned) return assigned;

  const candidates = [
    path.join(cluster.imageGroup, "trust-v1.png"),
    path.join(cluster.imageGroup, "trust-v1.jpg"),
    path.join(cluster.imageGroup, "support-v1.png"),
    path.join(cluster.imageGroup, "support-v1.jpg"),
    path.join(cluster.imageGroup, "conversion-v1.png"),
    path.join(cluster.imageGroup, "hero-v1.png"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  return found
    ? `/${found.replace(/\\/g, "/")}`
    : `/${cluster.imageGroup}/trust-v1.png`;
}

// ── Render input ──────────────────────────────────────────────────────────────

export interface ClusterRenderInputs {
  project: RenderProjectConfig;
  cluster: ClusterRenderConfig;
  ai:      ClusterPageContent;
}

// ── Main render function ──────────────────────────────────────────────────────

/**
 * Loads the cluster.html template, fills all token placeholders from the
 * supplied project config, cluster config, and AI-generated content, and
 * returns the complete HTML string.
 *
 * Throws if the template file is missing.
 */
export function renderClusterHtml({ project, cluster, ai }: ClusterRenderInputs): string {
  const templatePath = resolveClusterTemplatePath(cluster);
  const isHostingTemplate = /web-hosting\.html$/i.test(templatePath);
  const isEmailMarketingTemplate = /email-marketing\.html$/i.test(templatePath);
  const isServiceTemplate = isHostingTemplate || isEmailMarketingTemplate;
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Cluster template not found at ${templatePath}`);
  }
  let html = fs.readFileSync(templatePath, "utf8");

  // ── Brand profile — load approved profile if one exists for this project ───
  const brandProfilePath = findAssetFile(
    path.join("config", "projects", project.clientSlug, "brand-profile.json"),
  );
  let brandCss = "";
  // These start from the project config and are overridden by the approved brand profile
  let effectiveLogoUrl      = project.logoUrl ?? "";
  let effectiveBusinessName = project.businessName;
  let effectiveNavItems     = project.navItems as { label: string; href: string }[] | undefined;
  let effectiveFooterLinks  = project.footerLinks as { label: string; href: string }[] | undefined;

  if (fs.existsSync(brandProfilePath)) {
    try {
      const bp = JSON.parse(fs.readFileSync(brandProfilePath, "utf8")) as BrandProfile;
      if (bp.approved) {
        brandCss = buildBrandCss(bp);
        if (bp.logoUrl)                                           effectiveLogoUrl      = bp.logoUrl;
        if (bp.businessName)                                      effectiveBusinessName = bp.businessName;
        if (bp.navigationLinks && bp.navigationLinks.length > 0) effectiveNavItems     = bp.navigationLinks;
        if (bp.footerLinks     && bp.footerLinks.length > 0) {
          effectiveFooterLinks  = bp.footerLinks;
          // Brand-profile footerLinks may not include privacy/terms links.
          // Always ensure they are present so QA trust checks pass.
          const hasPr = effectiveFooterLinks.some((l) => String(l.label ?? "").toLowerCase().includes("privacy"));
const hasTe = effectiveFooterLinks.some((l) => String(l.label ?? "").toLowerCase().includes("terms"));
          const inject: { label: string; href: string }[] = [];
          if (!hasPr && project.privacyUrl) inject.push({ label: "Privacy Policy",   href: project.privacyUrl });
          if (!hasTe && project.termsUrl)   inject.push({ label: "Terms of Service", href: project.termsUrl });
          if (inject.length > 0) effectiveFooterLinks = [...inject, ...effectiveFooterLinks];
        }
      }
    } catch {
      // malformed profile — skip silently
    }
  }

  // ── Display keyword (title-cased for all visible text) ────────────────────
  const displayKeyword = titleCase(cluster.primaryKeyword);
  const displayService = titleCase(cluster.service);

  // ── Meta / schema description — computed early so schemas can reference it ──
  // Kept in one place to guarantee meta tag and WebPage schema always match.
  const aiSummaryText: string =
    (ai.aiSummaryIntro ?? "").trim() ||
    `${displayKeyword} from ${project.businessName} — professional ${displayService} built to generate real enquiries for local businesses.`;
  const metaDescription = trimToSentence(aiSummaryText, 160);
  const narrativeOverrides = (ai as ClusterPageContent & {
    narrativeOverrides?: WebDesignNarrativeOverrides;
  }).narrativeOverrides;
  const localSeoNarrativeOverrides = (ai as ClusterPageContent & {
    localSeoNarrativeOverrides?: LocalSeoNarrativeOverrides;
  }).localSeoNarrativeOverrides;

  // ── Render helpers ───────────────────────────────────────────────────────────
  const aiBullets = ai.aiSummaryBullets.map((b) => `<li class="cluster-ai-bullet">${b}</li>`).join("\n        ");

  // ── Build combined FAQ ────────────────────────────────────────────────────────
  // Merge ai.faq (primary, up to 4) with intent cluster Q&As (deduplicated by
  // question similarity) to produce a single comprehensive FAQ list (up to 6).
  // This eliminates the need for separate INTENT_CLUSTERS and AI_CITABLE_BLOCKS
  // sections — all Q&A content lives in one place.
  const _faqPrimary = (ai.faq ?? []).slice(0, 4);
  const _intentQAs: { question: string; answer: string }[] = (() => {
    const ic = ai.intentClusters;
    if (!ic) return [];
    return [
      ic.pricingQuestion,
      ic.processQuestion,
      ic.localQuestion,
      ic.comparisonQuestion,
    ]
      .filter((x): x is NonNullable<typeof x> => !!x?.question && !!x?.answer)
      .map((x) => ({ question: x.question ?? "", answer: x.answer ?? "" }));
  })();
  // Deduplicate: skip intent Q&As whose question overlaps with primary FAQs
  const _primaryWords = new Set(
    _faqPrimary.flatMap((f) =>
      f.question.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 4)
    )
  );
  const _dedupedIntent = _intentQAs
    .filter((q) => {
      const words = q.question.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter((w) => w.length > 4);
      const overlap = words.filter((w) => _primaryWords.has(w)).length;
      return overlap < 2; // allow if fewer than 2 key-word overlaps
    })
    .slice(0, 2); // add up to 2 intent Q&As to reach 6 total
  const _combinedFaq = narrativeOverrides || localSeoNarrativeOverrides
    ? _faqPrimary
    : [..._faqPrimary, ..._dedupedIntent].slice(0, 6);
  const faqHtml = _combinedFaq
    .map(
      (item) =>
        `<div class="cluster-faq-item faq-card">\n` +
        `          <h3 class="faq-q">${item.question}</h3>\n` +
        `          <p class="faq-a">${item.answer}</p>\n` +
        `        </div>`
    )
    .join("\n        ");

  // "Related Resources" is permanently suppressed on all pages.
  // {{INTERNAL_LINK_SECTION}} (Related Services) and {{AREAS_WE_COVER}} are the
  // only two link sections — they own both purposes.  The AI's relatedResources
  // cards are intentionally discarded here so the AI prompt can still receive
  // sibling context without that context bleeding into rendered output.
  const relatedResourcesHtml = "";

  // Default nav uses the project domain as base so links are always absolute.
  // Bare relative paths (e.g. "/services/") break on subdomain deployments
  // like local.example.com where those paths don't exist.
  const _domBase = (project.domain ?? "").replace(/\/+$/, "");
  const defaultNavItems: { label: string; href: string }[] = [
    { label: "Home",     href: _domBase ? `${_domBase}/`          : "/" },
    { label: "Services", href: _domBase ? `${_domBase}/services/` : "/services/" },
    { label: "About",    href: _domBase ? `${_domBase}/about/`    : "/about/" },
    { label: "Contact",  href: project.primaryCtaUrl },
  ];
  const navItemsHtml = renderNavItems(ensureBlogNavItem(effectiveNavItems ?? defaultNavItems));

  const footerAddress = project.businessAddress.replace(/, /g, "<br>");
  const footerCompany = project.footerCompanyName  ?? project.businessName;
  const footerNumber  = project.footerCompanyNumber ?? project.companyNumber ?? "";
  const footerYear    = String(new Date().getFullYear());

  // Footer links — brand profile overrides project config; fallback to privacy/terms/contact
  const footerLinksHtml = (effectiveFooterLinks && effectiveFooterLinks.length > 0)
    ? effectiveFooterLinks.map((l) => `<p><a href="${l.href}">${l.label}</a></p>`).join("\n          ")
    : [
        `<p><a href="${project.privacyUrl ?? "/privacy-policy/"}">Privacy Policy</a></p>`,
        `<p><a href="${project.termsUrl ?? "/terms/"}">Terms of Service</a></p>`,
        `<p><a href="${project.primaryCtaUrl}">Contact</a></p>`,
      ].join("\n          ");

  // Footer service links — use project footerServiceLinks if set, otherwise empty (no broken relative links)
  const footerServiceLinksHtml = (project.footerServiceLinks && project.footerServiceLinks.length > 0)
    ? project.footerServiceLinks.map((l) => `<p><a href="${l.href}">${l.label}</a></p>`).join("\n          ")
    : "";

  // Footer about text — use footerStrapline, then strapline, then generic fallback
  const footerAboutText = project.footerStrapline
    ?? project.strapline
    ?? `Professional digital services helping local businesses build a strong online presence and generate real enquiries.`;

  // ── Role-based image assignment ───────────────────────────────────────────────
  // Pull from the uploaded image-pack library for this project's industry type.
  // For agency projects (industryType = "web-design"), project.industryType won't
  // match any pack — so we fall back to the campaign service name (e.g. "emergency
  // plumber") which does map to the plumber pack. This ensures that even when the
  // parent project is a web-design agency, campaign pages get the correct trade images.
  const _effectiveIndustry = mapToPackIndustry(project.industryType)
    ? project.industryType
    : (cluster.service ?? "");
  const _packRoles = assignImageRoles(_effectiveIndustry, process.cwd());
  const heroImage       = resolveHeroImage(cluster)    || _packRoles.heroImage;
  const trustImage      = resolveAssignedImage(cluster, "trust") || resolveSplitImage(cluster) || _packRoles.trustImage;
  const supportImage    = resolveAssignedImage(cluster, "support") || resolveSplitImage(cluster) || _packRoles.earlySupportImage;
  const conversionImage = resolveMidPageImage(cluster) || _packRoles.conversionImage;
  const pageUrl       = `${project.domain.replace(/\/+$/, "")}${cluster.remotePath}`;
  const _domainBase   = project.domain.replace(/\/+$/, "");
  const ogImage       = heroImage.startsWith("http")
    ? heroImage
    : `${_domainBase}${heroImage.startsWith("/") ? "" : "/"}${heroImage}`;

  // ── Determine effective schema provider ───────────────────────────────────────
  // For non-digital campaigns (plumbing, electrical, roofing, etc.) the schema
  // must use the ACTUAL service provider's identity — not the project-level
  // agency (e.g. DHM Digital). If an approved CustomerProviderProfile is
  // attached to the render config, use it; otherwise fall back to the project
  // fields so the page still renders — the publish gate will flag the mismatch
  // with s.schemaProviderMissing (MAJOR) and block publish.
  const _isNonDigital   = isNonDigitalIndustry(project.industryType);
  const _cp             = (_isNonDigital && project.customerProfile?.approved)
    ? project.customerProfile
    : null;

  const _providerName   = _cp?.businessName ?? project.businessName;
  const _providerUrl    = (_cp?.url ?? project.domain).replace(/\/+$/, "");
  const _providerPhone  = _cp?.phone  ?? project.phone  ?? "";
  const _providerEmail  = _cp?.email  ?? project.email  ?? "";

  // Schema @type — use specific type (Plumber, Electrician, etc.) for trade pages
  const _schemaTypes    = schemaTypesForIndustry(project.industryType);
  const _schemaTypeVal  = _schemaTypes.length === 1 ? _schemaTypes[0] : _schemaTypes;

  // Breadcrumb Home: point to the customer's own site when a profile is set,
  // otherwise use the project domain.
  const _breadcrumbHome = `${_providerUrl}/`;

  // ── Schema: WebPage ───────────────────────────────────────────────────────────
  // description uses the same trimmed-to-complete-sentence value as the meta tag
  const schemaWebpage = JSON.stringify({
    "@context":    "https://schema.org",
    "@type":       "WebPage",
    "name":        displayKeyword,
    "url":         pageUrl,
    "description": metaDescription,
  });

  // ── Schema: Service ───────────────────────────────────────────────────────────
  const schemaService = JSON.stringify({
    "@context":    "https://schema.org",
    "@type":       "Service",
    "name":        displayKeyword,
    "serviceType": cluster.service ?? displayService,
    "areaServed":  { "@type": "Place", "name": cluster.location },
    "provider":    { "@type": "Organization", "name": _providerName, "url": _providerUrl },
  });

  // ── Schema: LocalBusiness ─────────────────────────────────────────────────────
  // When a customer provider profile is approved, use its structured address.
  // Otherwise extract locality from the raw businessAddress string.
  function extractLocality(address: string): string {
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(parts[parts.length - 1])) {
      parts.pop();
    }
    return parts[parts.length - 1] || address;
  }

  const _lbAddress = _cp?.address
    ? {
        "@type":          "PostalAddress",
        ...(_cp.address.streetAddress
          ? { "streetAddress": _cp.address.streetAddress }
          : {}),
        "addressLocality": _cp.address.addressLocality,
        "addressRegion":   _cp.address.addressRegion  ?? "South Yorkshire",
        "addressCountry":  _cp.address.addressCountry ?? "GB",
      }
    : {
        "@type":           "PostalAddress",
        "streetAddress":   project.businessAddress,
        "addressLocality": extractLocality(project.businessAddress),
        "addressRegion":   "South Yorkshire",
        "addressCountry":  "GB",
      };

  const _lbBase: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type":    _schemaTypeVal,
    "name":     _providerName,
    "url":      _providerUrl,
    "address":  _lbAddress,
  };
  if (_providerPhone) _lbBase["telephone"] = _providerPhone;
  if (_providerEmail) _lbBase["email"]     = _providerEmail;

  const schemaLocalBusiness = JSON.stringify(_lbBase);

  // ── Schema: BreadcrumbList ────────────────────────────────────────────────────
  const schemaBreadcrumb = JSON.stringify({
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home",         "item": _breadcrumbHome },
      { "@type": "ListItem", "position": 2, "name": displayService, "item": cluster.hubUrl },
      { "@type": "ListItem", "position": 3, "name": displayKeyword, "item": pageUrl },
    ],
  });

  // ── Schema: FAQPage (only when FAQ exists) ────────────────────────────────────
  const schemaFaq = ai.faq?.length
    ? JSON.stringify({
        "@context":   "https://schema.org",
        "@type":      "FAQPage",
        "mainEntity": ai.faq.slice(0, 4).map((item) => ({
          "@type": "Question",
          "name":  item.question,
          "acceptedAnswer": { "@type": "Answer", "text": item.answer },
        })),
      })
    : "";

  const metaTitle = `${displayKeyword} | ${project.businessName}`;

  // ── Fallback-guarded values ───────────────────────────────────────────────────
  // heroIntro: persuasive/commercial copy for hero section (new AI field)
  // aiSummaryIntro: factual/extractable copy for AI summary + meta description
  const heroIntro: string =
    (ai.heroIntro ?? "").trim() ||
    (ai.aiSummaryIntro ?? "").trim() ||
    `${project.businessName} provides professional ${displayService} in ${cluster.location} — built to generate real enquiries for local businesses.`;
  const effectiveHeroHeading = narrativeOverrides?.heroHeading ?? localSeoNarrativeOverrides?.heroHeading ?? displayKeyword;
  const effectiveHeroIntro = narrativeOverrides?.heroIntro ?? localSeoNarrativeOverrides?.heroIntro ?? heroIntro;

  const aboutHeading: string = project.businessName;

  // ── Section fallbacks (optional AI fields) ────────────────────────────────────
  const enquiryHeading = ai.enquirySection?.heading
    ?? `How ${displayService} generates real enquiries for ${cluster.location} businesses`;

  const enquiryBody = ai.enquirySection?.body
    ?? `${displayService} works around the clock to generate enquiries for your business. Contact forms, click-to-call buttons, and clear calls-to-action reduce friction and make it easy for potential customers to reach you.\n\nTrust signals — including your local address, company registration details, client testimonials, and professional presentation — increase visitor confidence and conversion rates.\n\nFast response and strong local visibility keep you front-of-mind. Mobile users — often the most ready to act — can find and contact you without friction.`;

  const competitionHeading = ai.competitionSection?.heading
    ?? `Local competition in ${cluster.location}: who is winning online and why`;

  const competitionBody = ai.competitionSection?.body
    ?? `Businesses across ${cluster.location} and surrounding areas are investing in ${displayService} to capture local search traffic. Trades, professional services, and retail businesses that appear at the top of results for their service area are winning a disproportionate share of enquiries.\n\nThe opportunity gap is significant. Many local businesses still rely on word of mouth or outdated listings, leaving them invisible to the majority of potential customers who search online first.\n\nBusinesses that move early build authority, accumulate reviews, and establish visibility that takes competitors considerable time and investment to match.`;

  const noWebsiteHeading = ai.noWebsiteSection?.heading
    ?? `What happens to ${cluster.location} businesses without ${displayService}`;

  const noWebsiteBody = ai.noWebsiteSection?.body
    ?? `Most people searching for ${displayService} in ${cluster.location} will click one of the top results and never look further. A business without a visible ${displayService} presence is simply not in the conversation.\n\nFirst impressions matter enormously. Visitors form a credibility judgement within seconds. A weak or absent online presence actively pushes potential customers away before they read a single word about your service.\n\nDelaying compounds the problem. Competitors gain more visibility, more reviews, and more trust every month. The gap widens and the cost of catching up increases. Acting now is always more cost-effective than acting later.`;

  // ── New section renderers ─────────────────────────────────────────────────────

  function esc(s: string): string {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  const aiAnswerBlockHtml: string = (() => {
    const ab = ai.aiAnswerBlock;
    if (!ab) return "";
    const points = (ab.keyPoints ?? [])
      .map((p) => `<li>${esc(p)}</li>`)
      .join("\n          ");
    return `<section class="cluster-ai-answer-block" aria-label="Quick Answer">
  <div class="wrap">
    <p class="cluster-section-label">Quick Answer</p>
    <h2>${esc(ab.question ?? `What does ${displayKeyword} include?`)}</h2>
    <div class="cluster-ai-answer-box">
      <p class="cluster-ai-quick-answer">${esc(ab.quickAnswer ?? "")}</p>
      ${points ? `<ul class="cluster-ai-key-points">${points}</ul>` : ""}
    </div>
  </div>
</section>`;
  })();

  // intentClustersHtml: suppressed — Q&As are merged into the single FAQ section above.
  const intentClustersHtml: string = "";

  const whatsIncludedHtml: string = (() => {
    const wi = ai.whatsIncluded as ClusterWhatsIncluded | undefined;
    if (!wi?.items?.length) return "";
    const cards = wi.items.map((item) =>
      `<div class="included-card">
        <h3>${esc(item.title ?? "")}</h3>
        <p>${esc(item.description ?? "")}</p>
      </div>`
    ).join("\n        ");
    return `<section class="whats-included-section" aria-label="What's Included">
  <div class="wrap">
    <p class="cluster-section-label">Service breakdown</p>
    <h2>What's Included with ${esc(displayService)} in ${esc(cluster.location)}</h2>
    <div class="whats-included-grid">${cards}</div>
  </div>
</section>`;
  })();

  const hostingWhatsIncludedHtml: string = (() => {
    const wi = ai.whatsIncluded as ClusterWhatsIncluded | undefined;
    if (!wi?.items?.length) return "";
    const cards = wi.items.map((item) =>
      `<div class="card compact"><h3>${esc(item.title ?? "")}</h3><p>${esc(item.description ?? "")}</p></div>`
    ).join("\n        ");
    return `<section id="whats-included" class="soft whats-included-section" aria-label="What's Included">
  <div class="wrap">
    <div class="section-head compact">
      <span class="tag">Hosting package</span>
      <h2>What's Included With ${esc(displayService)} in ${esc(cluster.location)}</h2>
      <p>Each part of the hosting service is designed to keep your website fast, secure and supported.</p>
    </div>
    <div class="grid-3">${cards}</div>
  </div>
</section>`;
  })();

  const emailMarketingWhatsIncludedHtml: string = (() => {
    const wi = ai.whatsIncluded as ClusterWhatsIncluded | undefined;
    if (!wi?.items?.length) return "";
    const cards = wi.items.map((item) =>
      `<div class="card compact"><h3>${esc(item.title ?? "")}</h3><p>${esc(item.description ?? "")}</p></div>`
    ).join("\n        ");
    return `<section id="whats-included" class="soft whats-included-section" aria-label="What's Included">
  <div class="wrap">
    <div class="section-head compact">
      <span class="tag">Email package</span>
      <h2>What's Included With ${esc(displayService)} in ${esc(cluster.location)}</h2>
      <p>Each part of the service is designed to grow your list, improve retention and drive repeat sales.</p>
    </div>
    <div class="grid-3">${cards}</div>
  </div>
</section>`;
  })();

  const whoItsForHtml: string = (() => {
    const wif = ai.whoItsFor as ClusterWhoItsFor | undefined;
    if (!wif?.groups?.length) return "";

    // Pad to exactly 8 audience cards — adapt label+description to service/location
    const TARGET_CARDS = 8;
    const fallbackGroups: { label: string; description: string }[] = [
      {
        label: "Tradespeople",
        description: `Tradespeople in ${cluster.location} rely on a steady flow of local enquiries. ${displayService} helps them appear where customers are already searching for their skills.`,
      },
      {
        label: "Local Clinics",
        description: `Health and wellness clinics in ${cluster.location} need to build trust fast. ${displayService} ensures they are found by local patients at the right moment.`,
      },
      {
        label: "Service Businesses",
        description: `Service-based businesses in ${cluster.location} compete on visibility and reputation. ${displayService} puts them in front of the right customers.`,
      },
      {
        label: "Consultants",
        description: `Independent consultants in ${cluster.location} benefit from a professional presence that converts browsers into booked appointments.`,
      },
      {
        label: "Small Retailers",
        description: `Retailers in ${cluster.location} need foot traffic and online orders. ${displayService} drives both by improving local visibility and credibility.`,
      },
      {
        label: "Hospitality Businesses",
        description: `Restaurants, cafés and hotels in ${cluster.location} live and die by local search. ${displayService} keeps them front of mind when customers are ready to book.`,
      },
      {
        label: "Professional Firms",
        description: `Accountants, solicitors and estate agents in ${cluster.location} depend on trust. ${displayService} builds the credibility that converts local enquiries into clients.`,
      },
      {
        label: "Startups and New Businesses",
        description: `New businesses in ${cluster.location} need to establish visibility quickly. ${displayService} gives them the competitive foundation to grow from day one.`,
      },
    ];

    const groups = [...wif.groups];
    let fallbackIdx = 0;
    while (groups.length < TARGET_CARDS) {
      // pick a fallback not already represented by label
      const existing = new Set(groups.map((g) => g.label.toLowerCase()));
      while (
        fallbackIdx < fallbackGroups.length &&
        existing.has(fallbackGroups[fallbackIdx].label.toLowerCase())
      ) {
        fallbackIdx++;
      }
      if (fallbackIdx >= fallbackGroups.length) break;
      groups.push(fallbackGroups[fallbackIdx]);
      fallbackIdx++;
    }

    const intro = wif.intro
      ? `<p class="who-its-for-intro">${esc(wif.intro)}</p>`
      : "";
    const cards = groups.map((g) =>
      `<div class="audience-card">
        <h3>${esc(g.label ?? "")}</h3>
        <p>${esc(g.description ?? "")}</p>
      </div>`
    ).join("\n        ");
    return `<section class="who-its-for-section" aria-label="Who This Is Best For">
  <div class="wrap">
    <p class="cluster-section-label">Best suited for</p>
    <h2>Who ${esc(displayService)} in ${esc(cluster.location)} Is Best For</h2>
    ${intro}
    <div class="who-its-for-grid">${cards}</div>
  </div>
</section>`;
  })();

  const hostingWhoItsForHtml: string = (() => {
    const wif = ai.whoItsFor as ClusterWhoItsFor | undefined;
    if (!wif?.groups?.length) return "";
    const cards = wif.groups.slice(0, 6).map((g) =>
      `<div class="card compact"><h3>${esc(g.label ?? "")}</h3><p>${esc(firstSentence(g.description ?? ""))}</p></div>`
    ).join("\n        ");
    const intro = wif.intro ? `<p>${esc(firstSentence(wif.intro))}</p>` : "";
    return `<section id="hosting-audience" class="who-its-for-section" aria-label="Who Hosting Is Best For">
  <div class="wrap">
    <div class="section-head compact">
      <span class="tag">Best for</span>
      <h2>Who ${esc(displayService)} in ${esc(cluster.location)} Is Best For</h2>
      ${intro}
    </div>
    <div class="grid-3">${cards}</div>
  </div>
</section>`;
  })();

  const emailMarketingWhoItsForHtml: string = (() => {
    const wif = ai.whoItsFor as ClusterWhoItsFor | undefined;
    if (!wif?.groups?.length) return "";
    const cards = wif.groups.slice(0, 6).map((g) =>
      `<div class="card compact"><h3>${esc(g.label ?? "")}</h3><p>${esc(firstSentence(g.description ?? ""))}</p></div>`
    ).join("\n        ");
    const intro = wif.intro ? `<p>${esc(firstSentence(wif.intro))}</p>` : "";
    return `<section id="email-audience" class="who-its-for-section" aria-label="Who Email Marketing Is Best For">
  <div class="wrap">
    <div class="section-head compact">
      <span class="tag">Best for</span>
      <h2>Who ${esc(displayService)} in ${esc(cluster.location)} Is Best For</h2>
      ${intro}
    </div>
    <div class="grid-3">${cards}</div>
  </div>
</section>`;
  })();

  const localRelevanceHtml: string = (() => {
    const lr = ai.localRelevanceSection;
    if (!lr?.heading || !lr?.body) return "";
    if (isServiceTemplate) {
      const points = lr.body
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 3);
      const cards = (points.length ? points : [firstSentence(lr.body)]).map((point, index) =>
        `<div class="card compact"><div class="icon">${index + 1}</div><p>${esc(firstSentence(point))}</p></div>`
      ).join("\n        ");
      return `<section class="local-relevance-section soft" aria-label="Local Relevance">
  <div class="wrap">
    <div class="section-head compact">
      <span class="tag">Why ${esc(cluster.location)}</span>
      <h2>${esc(lr.heading)}</h2>
    </div>
    <div class="grid-3">${cards}</div>
  </div>
</section>`;
    }
    return `<section class="local-relevance-section" aria-label="Local Relevance">
  <div class="wrap">
    <p class="cluster-section-label">Why ${esc(cluster.location)}</p>
    <h2>${esc(lr.heading)}</h2>
    ${paras(lr.body)}
  </div>
</section>`;
  })();

  const commonMistakesHtml: string = (() => {
    const cm = ai.commonMistakes as ClusterCommonMistakes | undefined;
    if (!cm?.items?.length) return "";
    const items = cm.items.map((item) =>
      `<div class="mistake-item">
        <h3>${esc(item.mistake ?? "")}</h3>
        <p>${esc(item.impact ?? "")}</p>
      </div>`
    ).join("\n        ");
    return `<section class="common-mistakes-section" aria-label="Common Mistakes to Avoid">
  <div class="wrap">
    <p class="cluster-section-label">Pitfalls to avoid</p>
    <h2>Common ${esc(displayService)} Mistakes That Cost ${esc(cluster.location)} Businesses</h2>
    <div class="mistakes-grid">${items}</div>
  </div>
</section>`;
  })();

  const narrativeProblemsSectionHtml: string = (() => {
    if (!narrativeOverrides) return "";
    const problems = (ai.split2?.body ?? "")
      .split(/\n{2,}/)
      .map((problem) => problem.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    if (!problems.length) return "";

    const cards = problems.map((problem, index) =>
      `<div class="card"><div class="icon">${String(index + 1).padStart(2, "0")}</div><h3>${esc(problem)}</h3><p>This issue can weaken trust, reduce clarity and make visitors less likely to take the next step.</p></div>`
    ).join("\n      ");

    return `<section id="split-section-one">
  <div class="wrap">
    <div class="section-head">
      <h2>${esc(ai.split2.heading)}</h2>
      <p>These are the narrative issues most likely to hold back ${esc(cluster.location)} businesses when their website does not reflect their value clearly.</p>
    </div>
    <div class="grid-3">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const narrativeWhyInvestSectionHtml: string = (() => {
    if (!narrativeOverrides) return "";
    const problems = (ai.split2?.body ?? "")
      .split(/\n{2,}/)
      .map((problem) => problem.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const outcomes = (ai.enquirySection?.body ?? "")
      .split(/\n{2,}/)
      .map((outcome) => outcome.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    const problemItems = problems.map((problem) => `<li>${esc(problem)}</li>`).join("\n          ");
    const outcomeItems = outcomes.map((outcome) => `<li>${esc(outcome)}</li>`).join("\n          ");

    return `<section class="blue-band" id="ai-summary-section">
  <div class="wrap">
    <div class="section-head center">
      <h2>${esc(ai.split1.heading)}</h2>
      ${paras(ai.split1.body)}
    </div>
    <div class="compare">
      <div class="compare-box">
        <span class="tag">What gets in the way</span>
        <h3>Current website friction</h3>
        <ul class="clean">
          ${problemItems}
        </ul>
      </div>
      <div class="compare-box dark">
        <span class="tag">What the page should create</span>
        <h3>Narrative-led outcomes</h3>
        <ul class="clean">
          ${outcomeItems}
        </ul>
      </div>
    </div>
  </div>
</section>`;
  })();

  const narrativeOutcomesSectionHtml: string = (() => {
    if (!narrativeOverrides) return "";
    const outcomes = (ai.enquirySection?.body ?? "")
      .split(/\n{2,}/)
      .map((outcome) => outcome.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 4);

    if (!outcomes.length) return "";

    const labels = ["Immediate", "Conversion", "Positioning", "Long term"];
    const cards = outcomes.map((outcome, index) =>
      `<div class="card"><span class="tag">${labels[index] ?? "Outcome"}</span><h3>${esc(outcome)}</h3><p>This is the result the page should make easier for the right visitor to understand and act on.</p></div>`
    ).join("\n      ");

    return `<section class="soft">
  <div class="wrap">
    <div class="section-head center">
      <h2>${esc(ai.enquirySection?.heading ?? `Expected Outcomes from Better Web Design in ${cluster.location}`)}</h2>
      <p>${esc(narrativeOverrides.ctaBody ?? "The page should connect the right visitor with a clear reason to take action.")}</p>
    </div>
    <div class="timeline">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const narrativeMistakesSectionHtml: string = (() => {
    if (!narrativeOverrides) return "";
    const mistakes = (ai.commonMistakes?.items ?? []).slice(0, 6);
    if (!mistakes.length) return "";

    const cards = mistakes.map((item) =>
      `<div class="card"><h3>${esc(item.mistake ?? "")}</h3><p>${esc(item.impact ?? "")}</p></div>`
    ).join("\n      ");

    return `<section>
  <div class="wrap">
    <div class="section-head">
      <h2>Common ${esc(displayService)} Mistakes That Weaken ${esc(cluster.location)} Pages</h2>
      <p>These mistakes dilute the narrative focus and make it harder for visitors to understand why they should choose the business.</p>
    </div>
    <div class="grid-3">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const narrativeDoNothingSectionHtml: string = (() => {
    if (!narrativeOverrides) return "";
    const key = narrativeOverrides.narrativeKey ?? "";
    const painPoints = (narrativeOverrides.painPoints ?? []).slice(0, 4);
    const riskCardsByKey: Record<string, string[]> = {
      authority: [
        "Loss of authority",
        "Premium customers choose competitors",
        "Reduced perceived value",
        "Weaker market leadership",
      ],
      growth: [
        "Slower growth",
        "Fewer enquiries",
        "Weaker marketing performance",
        "Competitors gain attention",
      ],
      conversion: [
        "Wasted traffic",
        "Lower conversion rates",
        "Lost revenue opportunities",
        "More friction in the journey",
      ],
      trust: [
        "Unanswered credibility questions",
        "Prospects hesitate",
        "Weaker reassurance",
        "Higher perceived risk",
      ],
      competition: [
        "Competitors look easier to choose",
        "Lost local enquiries",
        "Weaker comparison signals",
        "Reduced local visibility",
      ],
    };
    const riskContextByKey: Record<string, string> = {
      authority: "For authority-led pages, the risk is loss of perceived expertise, brand strength and premium positioning.",
      growth: "For growth-led pages, the risk is slower enquiry generation and weaker returns from existing marketing activity.",
      trust: "For trust-led pages, the risk is that cautious prospects do not see enough expertise, reassurance or proof to make contact.",
      competition: "For competition-led pages, the risk is that local customers compare options quickly and choose a clearer, more visible competitor.",
      conversion: "For conversion-led pages, the risk is wasted traffic, lower enquiry quality and missed revenue from visitors who were already interested.",
    };
    const riskCards = riskCardsByKey[key] ?? [
      "Missed opportunities",
      "Weaker trust",
      "Reduced visibility",
      "Competitors gain ground",
    ];
    const cards = riskCards.map((risk, index) =>
      `<div class="card"><h3>${esc(risk)}</h3><p>${esc(painPoints[index] ?? narrativeOverrides.doNothing ?? noWebsiteBody)}</p></div>`
    ).join("\n      ");

    return `<section class="impact" id="split-section-two">
  <div class="wrap grid-2">
    <div>
      <span class="tag">The cost of delay</span>
      <h2>What Happens If You Do Nothing?</h2>
      <p>${esc(narrativeOverrides.doNothing ?? noWebsiteBody)}</p>
      <p>${esc(riskContextByKey[key] ?? "The risk is not just having an outdated website. It is letting the wrong perception shape whether visitors take the next step.")}</p>
    </div>
    <div class="grid-2">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const narrativeWhoItsForSectionHtml: string = (() => {
    if (!narrativeOverrides) return "";
    const profile = narrativeOverrides.profile ?? "";
    const cardsByProfile: Record<string, { title: string; body: string }[]> = {
      premium_brand: [
        {
          title: "Specialist Firms",
          body: "Businesses whose expertise needs to be understood before price is discussed.",
        },
        {
          title: "Premium Service Providers",
          body: "Providers that want their website to reflect quality, care and higher-value work.",
        },
        {
          title: "Reputation-Led Businesses",
          body: "Teams that rely on trust, proof and brand perception to win the right enquiries.",
        },
      ],
      growth_business: [
        {
          title: "Growth-Focused Businesses",
          body: "Businesses ready for their website to support the next stage of enquiry growth.",
        },
        {
          title: "Service Businesses",
          body: "Local providers that need clearer messaging, stronger service pages and better calls to action.",
        },
        {
          title: "Enquiry-Driven Companies",
          body: "Companies that judge website performance by calls, forms, bookings and qualified leads.",
        },
      ],
      established_company: [
        {
          title: "Established Businesses",
          body: "Companies whose current website no longer reflects their maturity, credibility or standards.",
        },
        {
          title: "Businesses With Existing Traffic",
          body: "Teams already attracting visitors but not converting enough of them into useful enquiries.",
        },
        {
          title: "Conversion-Focused Companies",
          body: "Businesses improving the journey from interest to action across key service pages.",
        },
      ],
      professional_services: [
        {
          title: "Accountants",
          body: "Firms that need to explain expertise, process and reassurance before a prospect books a consultation.",
        },
        {
          title: "Solicitors",
          body: "Practices where qualifications, discretion, testimonials and risk reduction shape the first enquiry.",
        },
        {
          title: "Consultants",
          body: "Advisory businesses that need to make specialist knowledge clear, credible and easy to act on.",
        },
        {
          title: "Financial Advisers",
          body: "Professional advisers whose website must build confidence around trust, credentials and long-term decisions.",
        },
      ],
      local_trades: [
        {
          title: "Plumbers",
          body: "Local providers competing on speed, reliability, reviews and clear quote routes when customers compare options.",
        },
        {
          title: "Electricians",
          body: "Trade businesses that need visible proof, accreditations and service-area clarity to win local enquiries.",
        },
        {
          title: "Builders",
          body: "Project-led trades where customers compare workmanship, credibility and evidence before requesting a quote.",
        },
        {
          title: "Roofers",
          body: "High-trust local services that need reviews, guarantees, real work examples and easy contact paths.",
        },
      ],
    };
    const cards = (cardsByProfile[profile] ?? cardsByProfile.growth_business)
      .map((item) => `<div class="card"><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></div>`)
      .join("\n      ");

    return `<section>
  <div class="wrap">
    <div class="section-head">
      <h2>Who ${esc(effectiveHeroHeading)} Is Best For</h2>
      <p>${esc(narrativeOverrides.audience ?? "This service is best suited to businesses that need clearer positioning and stronger enquiry paths.")}</p>
    </div>
    <div class="grid-3">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const narrativePreFaqSectionHtml: string = (() => {
    if (!narrativeOverrides) return "";
    const painPoints = (narrativeOverrides.painPoints ?? [])
      .map((painPoint) => painPoint.trim())
      .filter(Boolean);
    const questions = (narrativeOverrides.faqs ?? [])
      .slice(1, 5)
      .map((question) => question.trim())
      .filter(Boolean);
    if (!questions.length) return "";

    const concernIntroByKey: Record<string, string> = {
      authority: "This question is about whether the website is supporting the brand perception needed to win higher-value work.",
      growth: "This question is about whether the website is helping marketing activity turn into real enquiries.",
      trust: "This question is about whether the website gives cautious prospects enough confidence, proof and reassurance.",
      competition: "This question is about whether the website helps local customers choose this business over nearby competitors.",
      conversion: "This question is about whether the website journey is turning existing attention into useful commercial action.",
    };
    const cards = questions.slice(0, 4).map((question, index) =>
      `<div class="card question"><h3>${esc(question)}</h3><p>${esc(painPoints[index] ?? concernIntroByKey[narrativeOverrides.narrativeKey ?? ""] ?? "This is one of the key questions to resolve before deciding whether the website is doing enough for the business.")}</p></div>`
    ).join("\n      ");

    return `<section class="blue-band">
  <div class="wrap">
    <div class="section-head center">
      <h2>Questions Business Owners Ask Before Investing</h2>
      <p>These questions reflect the decision-making concerns behind this ${esc(narrativeOverrides.narrativeKey ?? "web design")} narrative.</p>
    </div>
    <div class="grid-3">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const localSeoProblemsSectionHtml: string = (() => {
    if (!localSeoNarrativeOverrides) return "";
    const problems = (ai.split2?.body ?? "")
      .split(/\n{2,}/)
      .map((problem) => problem.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (!problems.length) return "";

    const cards = problems.map((problem, index) =>
      `<div class="card"><div class="icon">${String(index + 1).padStart(2, "0")}</div><h3>${esc(problem)}</h3><p>This issue can weaken local search relevance, trust signals and the path from search result to customer action.</p></div>`
    ).join("\n      ");

    return `<section id="split-section-one">
  <div class="wrap">
    <div class="section-head">
      <h2>${esc(ai.split2.heading)}</h2>
      <p>These are the Local SEO issues most likely to hold back ${esc(cluster.location)} businesses while preserving the existing local context and area-specific relevance signals.</p>
    </div>
    <div class="grid-3">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const localSeoWhyInvestSectionHtml: string = (() => {
    if (!localSeoNarrativeOverrides) return "";
    const problems = (ai.split2?.body ?? "")
      .split(/\n{2,}/)
      .map((problem) => problem.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const outcomes = (ai.enquirySection?.body ?? "")
      .split(/\n{2,}/)
      .map((outcome) => outcome.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    const problemItems = problems.map((problem) => `<li>${esc(problem)}</li>`).join("\n          ");
    const outcomeItems = outcomes.map((outcome) => `<li>${esc(outcome)}</li>`).join("\n          ");

    return `<section class="blue-band" id="ai-summary-section">
  <div class="wrap">
    <div class="section-head center">
      <h2>${esc(ai.split1.heading)}</h2>
      ${paras(ai.split1.body)}
    </div>
    <div class="compare">
      <div class="compare-box">
        <span class="tag">What gets in the way</span>
        <h3>Local search friction</h3>
        <ul class="clean">
          ${problemItems}
        </ul>
      </div>
      <div class="compare-box dark">
        <span class="tag">What Local SEO should create</span>
        <h3>${esc(localSeoNarrativeOverrides.narrativeKey ?? "Local SEO")} outcomes</h3>
        <ul class="clean">
          ${outcomeItems}
        </ul>
      </div>
    </div>
  </div>
</section>`;
  })();

  const localSeoDoNothingSectionHtml: string = (() => {
    if (!localSeoNarrativeOverrides) return "";
    const key = localSeoNarrativeOverrides.narrativeKey ?? "";
    const trustDrivers = (localSeoNarrativeOverrides.trustDrivers ?? []).slice(0, 4);
    const riskCardsByKey: Record<string, string[]> = {
      visibility: [
        "Missed discovery moments",
        "Weaker map visibility",
        "Unclear service-area relevance",
        "Competitors found first",
      ],
      growth: [
        "Pipeline stays inconsistent",
        "High-value demand is missed",
        "Acquisition relies on paid channels",
        "Growth areas stay unsupported",
      ],
      authority: [
        "Credibility is harder to prove",
        "Reviews carry less influence",
        "Expertise is less visible",
        "Cautious customers hesitate",
      ],
      competition: [
        "Competitors look safer to choose",
        "Review gaps become clearer",
        "Comparison moments are lost",
        "Category leadership weakens",
      ],
      conversion: [
        "Ready visitors do not act",
        "Calls and forms underperform",
        "Friction stays unresolved",
        "Enquiry quality is limited",
      ],
    };
    const contextByKey: Record<string, string> = {
      visibility: "The risk is remaining absent from the local discovery moments where nearby customers first look.",
      growth: "The risk is slower customer acquisition and a weaker local pipeline while demand continues moving elsewhere.",
      authority: "The risk is being visible but not trusted enough by customers who need reassurance before making contact.",
      competition: "The risk is losing customer choice moments to providers with clearer proof, reviews and comparison signals.",
      conversion: "The risk is wasting local traffic that already reaches the business but does not turn into useful action.",
    };
    const cards = (riskCardsByKey[key] ?? riskCardsByKey.visibility).map((risk, index) =>
      `<div class="card"><h3>${esc(risk)}</h3><p>${esc(trustDrivers[index] ?? localSeoNarrativeOverrides.doNothing ?? noWebsiteBody)}</p></div>`
    ).join("\n      ");

    return `<section class="impact" id="split-section-two">
  <div class="wrap grid-2">
    <div>
      <span class="tag">The cost of delay</span>
      <h2>What Happens If You Do Nothing?</h2>
      <p>${esc(localSeoNarrativeOverrides.doNothing ?? noWebsiteBody)}</p>
      <p>${esc(contextByKey[key] ?? "The risk is letting weak local search signals shape whether nearby customers find, trust and contact the business.")}</p>
    </div>
    <div class="grid-2">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const localSeoOutcomesSectionHtml: string = (() => {
    if (!localSeoNarrativeOverrides) return "";
    const outcomes = (ai.enquirySection?.body ?? "")
      .split(/\n{2,}/)
      .map((outcome) => outcome.replace(/\.$/, "").trim())
      .filter(Boolean)
      .slice(0, 4);
    if (!outcomes.length) return "";

    const labels = ["Visibility", "Trust", "Demand", "Action"];
    const cards = outcomes.map((outcome, index) =>
      `<div class="card"><span class="tag">${labels[index] ?? "Outcome"}</span><h3>${esc(outcome)}</h3><p>This is the result the Local SEO page should make easier for the right local searcher to understand and act on.</p></div>`
    ).join("\n      ");

    return `<section class="soft">
  <div class="wrap">
    <div class="section-head center">
      <h2>${esc(ai.enquirySection?.heading ?? `Expected Outcomes from Local SEO in ${cluster.location}`)}</h2>
      <p>${esc(localSeoNarrativeOverrides.ctaBody ?? "Local SEO should connect local search demand with a clearer reason to contact the business.")}</p>
    </div>
    <div class="timeline">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const localSeoMistakesSectionHtml: string = (() => {
    if (!localSeoNarrativeOverrides) return "";
    const mistakes = (ai.commonMistakes?.items ?? []).slice(0, 6);
    if (!mistakes.length) return "";

    const cards = mistakes.map((item) =>
      `<div class="card"><h3>${esc(item.mistake ?? "")}</h3><p>${esc(item.impact ?? "")}</p></div>`
    ).join("\n      ");

    return `<section>
  <div class="wrap">
    <div class="section-head">
      <h2>Common Local SEO Mistakes That Weaken ${esc(cluster.location)} Pages</h2>
      <p>These mistakes dilute local search relevance, trust signals and the route from discovery to customer action.</p>
    </div>
    <div class="grid-3">
      ${cards}
    </div>
  </div>
</section>`;
  })();

  const entityBlockHtml: string = (() => {
    const eb = ai.entityBlock;
    if (!eb) return "";
    return `<aside class="cluster-entity-block" aria-label="About this service">
  <div class="wrap">
    <p class="cluster-entity-label">About this ${esc(displayService)} service</p>
    <ul class="cluster-entity-list">
      ${eb.service         ? `<li><strong>Service:</strong> ${esc(titleCase(eb.service))}</li>` : ""}
      ${eb.location        ? `<li><strong>Location:</strong> ${esc(eb.location)}</li>` : ""}
      ${eb.provider        ? `<li><strong>Provider:</strong> ${esc(eb.provider)}</li>` : ""}
      ${eb.primaryKeyword  ? `<li><strong>Topic:</strong> ${esc(titleCase(eb.primaryKeyword))}</li>` : ""}
      ${eb.targetAudience  ? `<li><strong>For:</strong> ${esc(eb.targetAudience)}</li>` : ""}
      ${eb.nearbyAreas     ? `<li><strong>Also covering:</strong> ${esc(eb.nearbyAreas)}</li>` : ""}
    </ul>
  </div>
</aside>`;
  })();

  // ── AI Definition Blocks ───────────────────────────────────────────────────
  // Computed from existing aiSummaryIntro (first 2 sentences) + entityBlock.
  // Purpose: short, citable definitions optimised for AI extraction.
  const aiDefinitionBlocksHtml: string = (() => {
    const defs: string[] = [];

    // Definition 1: first 2 sentences of aiSummaryIntro
    const intro = (ai.aiSummaryIntro ?? "").trim();
    if (intro) {
      // Split on sentence-ending punctuation followed by a space or end
      const sentenceMatches = intro.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
      const firstTwo = sentenceMatches.slice(0, 2).join("").trim();
      if (firstTwo.length > 30) defs.push(firstTwo);
    }

    // Definition 2: entity block fact sentence (service + location + provider + audience)
    const eb = ai.entityBlock;
    if (eb?.service && eb?.location && eb?.provider) {
      const audience = eb.targetAudience ? ` for ${eb.targetAudience.toLowerCase()}` : "";
      const nearby   = eb.nearbyAreas    ? ` Coverage extends to ${eb.nearbyAreas}.` : "";
      const def2 = `${titleCase(eb.service)} in ${eb.location} is delivered by ${eb.provider}${audience}.${nearby}`;
      defs.push(def2);
    }

    if (!defs.length) return "";
    const items = defs.map((d) => `<div class="ai-definition-block">${esc(d)}</div>`).join("\n        ");
    return `<div class="ai-definition-wrap" aria-label="Service definitions">
  <div class="wrap">
    <div class="ai-definition-grid">
        ${items}
    </div>
  </div>
</div>`;
  })();

  // ── AI Citable Blocks — suppressed ────────────────────────────────────────
  // Previously rendered a second "Common Questions" section after the FAQ.
  // Suppressed to avoid duplication — Q&A content is consolidated into the
  // single FAQ section (see faqHtml above).
  const aiCitableBlocksHtml: string = "";

  // ── Token replacements ───────────────────────────────────────────────────────
  const replacements: Record<string, string> = {
    "{{META_TITLE}}":           metaTitle,
    "{{META_DESCRIPTION}}":     metaDescription,
    "{{CANONICAL_URL}}":        pageUrl,
    "{{SCHEMA_WEBPAGE}}":       schemaWebpage,
    "{{SCHEMA_SERVICE}}":       schemaService,
    "{{SCHEMA_LOCAL_BUSINESS}}": schemaLocalBusiness,
    "{{SCHEMA_BREADCRUMB}}":    schemaBreadcrumb,
    "{{SCHEMA_FAQ}}":           schemaFaq
                                  ? `<script type="application/ld+json">${schemaFaq}</script>`
                                  : "",
    "{{LOGO_URL}}":             effectiveLogoUrl,
    "{{BUSINESS_NAME}}":        effectiveBusinessName,
    "{{ABOUT_HEADING}}":        aboutHeading,
    "{{NAV_ITEMS}}":            navItemsHtml,
    "{{H1}}":                   effectiveHeroHeading,
    "{{INTRO}}":                effectiveHeroIntro,
    "{{CTA_URL}}":              project.primaryCtaUrl,
    "{{CTA_TEXT}}":             project.primaryCtaText,
    "{{OG_IMAGE}}":          ogImage,
    "{{HERO_IMAGE}}":        heroImage,
    "{{TRUST_IMAGE}}":       trustImage,
    "{{SUPPORT_IMAGE}}":     supportImage,
    "{{CONVERSION_IMAGE}}":  conversionImage,
    "{{AI_SUMMARY_HEADING}}":           `What is ${displayService} in ${cluster.location}?`,
    "{{AI_SUMMARY_INTRO}}":             paras(aiSummaryText),
    "{{AI_SUMMARY_BULLETS}}":           aiBullets,
    "{{SECTION_1_HEADING}}":            ai.split1.heading,
    "{{SECTION_1_BODY}}":               paras(ai.split1.body),
    "{{SECTION_2_HEADING}}":            ai.split2.heading,
    "{{SECTION_2_BODY}}":               paras(ai.split2.body),
    "{{ENQUIRY_SECTION_HEADING}}":      enquiryHeading,
    "{{ENQUIRY_SECTION_BODY}}":         paras(enquiryBody),
    "{{ENQUIRY_SECTION_LEAD}}":         splitParas(enquiryBody, 1).lead,
    "{{ENQUIRY_SECTION_DETAIL}}":       splitParas(enquiryBody, 1).detail,
    "{{COMPETITION_SECTION_HEADING}}":  competitionHeading,
    "{{COMPETITION_SECTION_BODY}}":     paras(competitionBody),
    "{{NO_WEBSITE_SECTION_HEADING}}":   noWebsiteHeading,
    "{{NO_WEBSITE_SECTION_BODY}}":      paras(noWebsiteBody),
    "{{FOOTER_COMPANY_NAME}}":          footerCompany,
    "{{RELATED_RESOURCES}}":            relatedResourcesHtml,
    "{{FAQ_ITEMS}}":                    faqHtml,
    "{{CTA_SECTION}}": (() => {
      const resolved = resolveCTA({
        service:       cluster.service,
        location:      cluster.location,
        industryType:  project.industryType,
        config:        project.ctaConfig ?? {},
        primaryCtaUrl: project.primaryCtaUrl,
        phone:         project.phone,
      });
      return buildCTASection({
        ...resolved,
        copy: {
          ...resolved.copy,
          heading:     narrativeOverrides?.ctaHeading     ?? localSeoNarrativeOverrides?.ctaHeading ?? resolved.copy.heading,
          body:        narrativeOverrides?.ctaBody        ?? localSeoNarrativeOverrides?.ctaBody    ?? resolved.copy.body,
          primaryText: narrativeOverrides?.ctaPrimaryText ?? resolved.copy.primaryText,
        },
      });
    })(),
    "{{MID_PAGE_CTA}}": "",
    "{{MONEY_PAGE_LINK_SECTION}}":      project.isHub ? buildMoneyPageSection(project.moneyPageUrl, project.moneyPageKeyword) : "",
    "{{PARENT_HUB_LINK}}":              "",
    "{{INTERNAL_LINK_SECTION}}": (() => {
      if (!project.internalLinks) return "";
      const tier = project.isHub ? "hub" : "area";
      // Hub pages show max 3 — the other services for the same area (current
      // service is excluded at the pool-build stage in rollout.ts).
      // Cluster area pages keep the default 4-card layout (different context).
      const max = project.isHub ? 3 : 4;
      const cards = selectRelatedServiceCards(
        project.internalLinks,
        {
          service:    cluster.service ?? "",
          location:   cluster.location,
          tier,
          remotePath: cluster.remotePath,
        },
        max,
      );
      return buildRelatedServicesSectionHtml(cards, cluster.location);
    })(),
    "{{AREAS_WE_COVER}}": (() => {
      const selfNorm = (cluster.remotePath ?? "").replace(/\/+$/, "");
      const areas = (project.clusterAreaLinks ?? []).filter((a) => {
        // Strip the domain prefix before comparing so absolute and relative hrefs both match
        const hrefPath = a.href.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "");
        return hrefPath !== selfNorm;
      });
      if (!areas.length) return "";
      const svc = cluster.service ?? "this service";
      const loc  = cluster.location;
      const intro = `We also provide ${svc.toLowerCase()} support across nearby ${loc} areas, helping local businesses create better campaigns and generate more enquiries.`;
      const cardHtml = areas.map((a) => {
        const desc = a.description ? `<p>${a.description}</p>` : "";
        return `<a class="resource-card" href="${a.href}">\n          <h3>${a.label}</h3>${desc}\n        </a>`;
      }).join("\n        ");
      return `
  <section id="areas-we-cover-section" class="section-band">
    <div class="wrap">
      <h2>${svc} Areas We Cover</h2>
      <p class="related-services-intro">${intro}</p>
      <div class="resource-card-grid">
        ${cardHtml}
      </div>
    </div>
  </section>`;
    })(),
    "{{MAP_EMBED_URL}}":                buildAddressMapUrl(project),
    "{{MAP_IFRAME_TITLE}}":             `${project.businessName} — ${project.businessAddress}`,
    "{{TRUST_STRIP}}":                  ai.trustStrip,
    "{{FOOTER_ADDRESS}}":            footerAddress,
    "{{FOOTER_PHONE}}":              project.phone
                                       ? `<p><a href="tel:${project.phone.replace(/\s/g, "")}">${project.phone}</a></p>`
                                       : "",
    "{{FOOTER_EMAIL}}":              project.email,
    "{{FOOTER_COMPANY_NUMBER}}":     footerNumber,
    "{{FOOTER_YEAR}}":               footerYear,
    "{{PRIVACY_URL}}":               project.privacyUrl  ?? "/privacy-policy/",
    "{{TERMS_URL}}":                 project.termsUrl    ?? "/terms/",
    "{{FOOTER_LINKS_HTML}}":         footerLinksHtml,
    "{{FOOTER_SERVICE_LINKS_HTML}}": footerServiceLinksHtml,
    "{{FOOTER_ABOUT_TEXT}}":         footerAboutText,
    "{{ABOUT_BODY_1}}":              project.strapline
                                       ?? project.description
                                       ?? `${project.businessName} is a professional digital agency helping local businesses build a strong online presence.`,
    "{{ABOUT_BODY_2}}":              project.shortDescription
                                       ?? `Every solution we deliver is designed to perform, generate enquiries, and support long-term business growth.`,
    "{{WHITE_LABEL_FOOTER_LINE}}":   project.whiteLabelPoweredBy === true
                                       ? " &ndash; Powered by InboxingProWeb"
                                       : "",
    // Fix #5: cluster-ai-answer-block is suppressed — ai-summary-section is the
    // sole AI answer block. Render this token as empty to prevent duplicate blocks.
    "{{AI_ANSWER_BLOCK}}":           "",
    "{{INTENT_CLUSTERS}}":           intentClustersHtml,
    "{{ENTITY_BLOCK}}":              entityBlockHtml,
    // New content-depth sections
    "{{WHATS_INCLUDED}}":            isHostingTemplate
                                         ? hostingWhatsIncludedHtml
                                         : isEmailMarketingTemplate
                                           ? emailMarketingWhatsIncludedHtml
                                           : whatsIncludedHtml,
    "{{WHO_ITS_FOR}}":               isHostingTemplate
                                         ? hostingWhoItsForHtml
                                         : isEmailMarketingTemplate
                                           ? emailMarketingWhoItsForHtml
                                           : whoItsForHtml,
    "{{LOCAL_RELEVANCE}}":           localRelevanceHtml,
    "{{COMMON_MISTAKES}}":           commonMistakesHtml,
    // AI citation enhancement sections
    "{{AI_DEFINITION_BLOCKS}}":      aiDefinitionBlocksHtml,
    "{{AI_CITABLE_BLOCKS}}":         aiCitableBlocksHtml,
    "{{BRAND_CSS}}":                 brandCss,
  };

  if (isHostingTemplate) {
    Object.assign(
      replacements,
      buildHostingTemplateTokens({
        ai,
        cluster,
        displayService,
        businessName: effectiveBusinessName,
        ctaUrl: project.primaryCtaUrl,
        phone: project.phone,
        esc,
        paras,
      }),
    );
  }

  if (isEmailMarketingTemplate) {
    Object.assign(
      replacements,
      buildEmailMarketingTemplateTokens({
        ai,
        cluster,
        displayService,
        businessName: effectiveBusinessName,
        ctaUrl: project.primaryCtaUrl,
        phone: project.phone,
        esc,
        paras,
      }),
    );
  }

  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }

  const parentHubLinkHtml: string = (() => {
    if (project.isHub || !cluster.hubUrl || !cluster.hubAnchor) return "";
    const hubHref = cluster.hubUrl.replace(/^https?:\/\/[^/]+/, "") || cluster.hubUrl;
    return `<section class="section-band parent-hub-link-section" aria-label="Parent service hub">
  <div class="wrap">
    <p class="cluster-section-label">Service hub</p>
    <p>Explore the main <a href="${esc(hubHref)}">${esc(titleCase(cluster.hubAnchor))}</a> page for the full service overview and related local pages.</p>
  </div>
</section>`;
  })();

  if (parentHubLinkHtml) {
    html = html.replace(
      /(<\/section>\s*)(?=<section class="blue-band" id="ai-summary-section">)/,
      `$1\n${parentHubLinkHtml}\n\n`,
    );
  }

  if (narrativeWhyInvestSectionHtml) {
    html = html.replace(
      /<section class="blue-band" id="ai-summary-section">[\s\S]*?<\/section>\s*(?=<section id="split-section-one">)/,
      `${narrativeWhyInvestSectionHtml}\n\n`,
    );
  }

  if (narrativeProblemsSectionHtml) {
    html = html.replace(
      /<section id="split-section-one">[\s\S]*?<\/section>\s*(?=<section class="impact" id="split-section-two">)/,
      `${narrativeProblemsSectionHtml}\n\n`,
    );
  }

  if (narrativeDoNothingSectionHtml) {
    html = html.replace(
      /<section class="impact" id="split-section-two">[\s\S]*?<\/section>\s*(?=<section class="soft">)/,
      `${narrativeDoNothingSectionHtml}\n\n`,
    );
  }

  if (narrativeOutcomesSectionHtml) {
    html = html.replace(
      /<section class="soft">\s*<div class="wrap">\s*<div class="section-head center">\s*<h2>Outcomes A Better Website Should Support<\/h2>[\s\S]*?<\/section>\s*(?=<section id="included">)/,
      `${narrativeOutcomesSectionHtml}\n\n`,
    );
  }

  if (narrativeMistakesSectionHtml) {
    html = html.replace(
      /<section>\s*<div class="wrap">\s*<div class="section-head">\s*<h2>Common Web Design Mistakes That Cost Businesses Enquiries<\/h2>[\s\S]*?<\/section>\s*(?=<section class="blue-band">)/,
      `${narrativeMistakesSectionHtml}\n\n`,
    );
  }

  if (narrativeWhoItsForSectionHtml) {
    html = html.replace(
      /<section>\s*<div class="wrap">\s*<div class="section-head">\s*<h2>Who [\s\S]*? Is Best For<\/h2>[\s\S]*?<\/section>\s*(?=<section class="about" id="about-section">)/,
      `${narrativeWhoItsForSectionHtml}\n\n`,
    );
  }

  if (narrativePreFaqSectionHtml) {
    html = html.replace(
      /<section class="blue-band">\s*<div class="wrap">\s*<div class="section-head center">\s*<h2>Questions Business Owners Ask Before Investing<\/h2>[\s\S]*?<\/section>\s*(?=<section class="faq" id="faq-section">)/,
      `${narrativePreFaqSectionHtml}\n\n`,
    );
  }

  if (localSeoWhyInvestSectionHtml) {
    html = html.replace(
      /<section class="blue-band" id="ai-summary-section">[\s\S]*?<\/section>\s*(?=<section id="split-section-one">)/,
      `${localSeoWhyInvestSectionHtml}\n\n`,
    );
  }

  if (localSeoProblemsSectionHtml) {
    html = html.replace(
      /<section id="split-section-one">[\s\S]*?<\/section>\s*(?=<section class="impact" id="split-section-two">)/,
      `${localSeoProblemsSectionHtml}\n\n`,
    );
  }

  if (localSeoDoNothingSectionHtml) {
    html = html.replace(
      /<section class="impact" id="split-section-two">[\s\S]*?<\/section>\s*(?=<section class="soft">)/,
      `${localSeoDoNothingSectionHtml}\n\n`,
    );
  }

  if (localSeoOutcomesSectionHtml) {
    html = html.replace(
      /<section class="soft">\s*<div class="wrap">\s*<div class="section-head center">\s*<h2>Outcomes A Better Website Should Support<\/h2>[\s\S]*?<\/section>\s*(?=<section id="included">)/,
      `${localSeoOutcomesSectionHtml}\n\n`,
    );
  }

  if (localSeoMistakesSectionHtml) {
    html = html.replace(
      /<section>\s*<div class="wrap">\s*<div class="section-head">\s*<h2>Common Web Design Mistakes That Cost Businesses Enquiries<\/h2>[\s\S]*?<\/section>\s*(?=<section class="blue-band">)/,
      `${localSeoMistakesSectionHtml}\n\n`,
    );
  }

  if (narrativeOverrides || localSeoNarrativeOverrides) {
    html = html.replace(
      /<section class="final">[\s\S]*?<\/section>\s*(?=<section id="cta-section")/,
      "",
    );

    if (!/conversion-feature-image/.test(html) && hasValidConversionImage(cluster)) {
      const conversionImageHtml = `<section class="section-band conversion-image-section" aria-label="Conversion support image">
  <div class="wrap">
    <div class="image-panel conversion-feature-image">
      <img src="${esc(conversionImage)}" alt="${esc(effectiveHeroHeading)}" loading="lazy" decoding="async">
    </div>
  </div>
</section>`;
      html = html.replace(
        /(?=<section id="cta-section")/,
        `${conversionImageHtml}\n\n`,
      );
    }
  }

  if (!hasValidConversionImage(cluster)) {
    html = suppressEmptyConversionImage(html);
  }

  html = applyContextualBodyLinks(html, project, cluster);

  // ── Normalise internal links → root-relative (a-tags only) ───────────────────
  // Converts href="https://domain.com/slug/" → href="/slug/" for <a> tags only.
  // <link rel="canonical"> keeps its absolute URL.
  html = normaliseInternalLinks(html, project.domain);

  // ── Remove empty anchor tags ─────────────────────────────────────────────────
  // AI content sometimes produces <a href="..."></a> or "Learn more at <a></a>."
  html = removeEmptyAnchors(html);

  // ── Fix bare-root in-prose links ─────────────────────────────────────────────
  // AI falls back to href="/" when relatedPages context was missing. Replace with
  // the campaign hub path so the link remains useful instead of pointing to root.
  // normaliseInternalLinks already ran, so hubUrl may still be absolute here —
  // strip the domain to get the path we want to use as a replacement.
  const _rawHubHref = (cluster.hubUrl ?? "").replace(/^https?:\/\/[^/]+/, "") || "/";
  if (_rawHubHref !== "/") {
    html = html.replace(/(<a\b[^>]*)\bhref="\/"/g, `$1href="${_rawHubHref}"`);
  }

  // ── Output guard: validate and block on critical failures ────────────────────
  const outputIssues: string[] = [];

  // 1. Meta description must end with sentence-ending punctuation
  const metaMatch = html.match(/<meta name="description" content="([^"]+)"/);
  if (metaMatch) {
    const desc = metaMatch[1];
    if (!/[.?!]$/.test(desc)) outputIssues.push(`meta-desc-incomplete: ends with "${desc.slice(-30)}"`);
  }

  // 2. Canonical must be absolute
  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (canonicalMatch && !canonicalMatch[1].startsWith("https://")) {
    outputIssues.push(`canonical-relative: "${canonicalMatch[1]}"`);
  }

  // 3. No empty anchor tags
  if (/<a\b[^>]*>\s*<\/a>/.test(html)) outputIssues.push("empty-anchor-remains");

  // 4. No duplicate AI answer blocks
  const answerBlockCount = (html.match(/class="cluster-ai-answer-block"/g) ?? []).length;
  if (answerBlockCount > 0) outputIssues.push(`duplicate-ai-answer-block: ${answerBlockCount}`);

  // 5. No unfilled template tokens
  const leftoverTokens = html.match(/\{\{[A-Z_]+\}\}/g) ?? [];
  if (leftoverTokens.length > 0) outputIssues.push(`unfilled-tokens: ${leftoverTokens.slice(0, 3).join(", ")}`);

  // 6. No sentences that end mid-clause (comma at paragraph end before close tag)
  // Auto-fix first: strip the errant comma so the sentence ends cleanly.
  // Case A: comma immediately before a closing block tag (,</p>, ,</li>, ,</td> etc.)
  html = html.replace(/,(\s*)<\/(p|li|td|th|dd|dt|h[1-6])>/gi, "$1</$2>");
  // Case B: comma before explicit sentence-ending punctuation
  html = html.replace(/,(\s{0,3})(\.(?!\w)|\?|!)/g, "$2");
  const bodyText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // Use (?!\w) lookahead so CSS class selectors like ".wrap,.container" don't false-fire.
  if (/,\s{0,3}(\.(?!\w)|\?|!|$)/.test(bodyText)) outputIssues.push("broken-sentence: comma before sentence end detected");

  // 7. aiSummaryIntro word count
  const aiIntroWordCount = (aiSummaryText ?? "").split(/\s+/).filter(Boolean).length;
  if (aiIntroWordCount < 50) {
    outputIssues.push(`ai-summary-intro-too-short: ${aiIntroWordCount} words (min 50)`);
  }

  // 8. No bare-root in-prose links remaining after auto-fix
  // href="/" means the AI linked to the domain root — auto-fix should have rewritten these.
  // If any remain the hubUrl itself was "/" (hub URL not set), which is a data problem.
  const rootLinks = (html.match(/<a\b[^>]*href="\/"/g) ?? []);
  if (rootLinks.length > 0) {
    outputIssues.push(`root-href-links: ${rootLinks.length} link(s) still pointing to href="/"`);
  }

  // 9. No duplicate resource card hrefs
  const resourceHrefs = (html.match(/class="resource-card"[^>]*href="([^"]+)"/g) ?? [])
    .map((m) => m.match(/href="([^"]+)"/)?.[1] ?? "");
  const resourceHrefSet = new Set(resourceHrefs);
  if (resourceHrefs.length !== resourceHrefSet.size) {
    const dupes = resourceHrefs.filter((h, i) => resourceHrefs.indexOf(h) !== i);
    outputIssues.push(`duplicate-resource-cards: ${dupes.join(", ")}`);
  }

  // 10. Resource cards must not self-link (href = this page's remotePath)
  const selfPath = (cluster.remotePath ?? "").replace(/\/+$/, "") || null;
  if (selfPath) {
    const selfLinks = resourceHrefs.filter((h) => h.replace(/\/+$/, "") === selfPath);
    if (selfLinks.length > 0) {
      outputIssues.push(`self-link-resource-card: card links to own page (${selfPath})`);
    }
  }

  if (outputIssues.length > 0) {
    // Warn in logs — auto-fixes above have already done their best on the fixable ones
    console.warn(`[renderClusterPage] output guard warnings for ${cluster.remotePath}:`, outputIssues);
  }

  // Hard-block only on the most critical issues that would produce invalid HTML/SEO.
  // self-link-resource-card is auto-fixed at the {{AREAS_WE_COVER}} rendering stage
  // so it should never appear here; if it somehow does, treat as warning not hard-fail.
  const hardFails = outputIssues.filter(i =>
    i.startsWith("unfilled-tokens") ||
    i.startsWith("duplicate-ai-answer-block") ||
    i.startsWith("canonical-relative") ||
    i.startsWith("duplicate-resource-cards")
  );
    if (hardFails.length > 0) {
    throw new Error(
      `[renderClusterPage] hard output guard failure for ${cluster.remotePath}: ${hardFails.join("; ")}`
    );
  }

  return html;
}
