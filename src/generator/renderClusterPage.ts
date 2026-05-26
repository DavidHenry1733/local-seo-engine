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
import { fileURLToPath } from "node:url";

import { buildBrandCss, type BrandProfile } from "./brandImporter.js";
import {
  selectRelatedServiceCards,
  buildRelatedServicesSectionHtml,
} from "../seo/selectInternalLinks.js";
import type { CustomerProviderProfile } from "./customerProfile.js";
import { isNonDigitalIndustry, schemaTypesForIndustry } from "./customerProfile.js";
import { assignImageRoles, mapToPackIndustry } from "../local-seo/imageRoleAssigner.js";
import type { DeployConfig }      from "./types";
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
}

// ── Private render helpers ────────────────────────────────────────────────────

function buildMoneyPageSection(url?: string, keyword?: string): string {
  if (!url || !keyword) return "";
  return `<section class="money-page-band"><div class="container"><p>Looking for <a href="${url}">${keyword}</a> in your local area? Visit our dedicated service page.</p></div></section>`;
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

function resolveAssignedImage(cluster: ClusterRenderConfig, slot: "hero" | "support" | "trust" | "conversion"): string | null {
  const serviceKey = cluster.serviceKey ?? cluster.imageGroup?.replace(/^assets\//, "") ?? "";
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
  const templatePath = findAssetFile(path.join("templates", "cluster.html"));
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
          const hasPr = effectiveFooterLinks.some((l) => l.label.toLowerCase().includes("privacy"));
          const hasTe = effectiveFooterLinks.some((l) => l.label.toLowerCase().includes("terms"));
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
  const _combinedFaq = [..._faqPrimary, ..._dedupedIntent].slice(0, 6);
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
  const navItemsHtml = renderNavItems(effectiveNavItems ?? defaultNavItems);

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

  const localRelevanceHtml: string = (() => {
    const lr = ai.localRelevanceSection;
    if (!lr?.heading || !lr?.body) return "";
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
    "{{H1}}":                   displayKeyword,
    "{{INTRO}}":                heroIntro,
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
      return buildCTASection(resolved);
    })(),
    "{{MID_PAGE_CTA}}": (() => {
      const resolved = resolveCTA({
        service:       cluster.service,
        location:      cluster.location,
        industryType:  project.industryType,
        config:        project.ctaConfig ?? {},
        primaryCtaUrl: project.primaryCtaUrl,
        phone:         project.phone,
      });
      return buildMidPageCTA(resolved, cluster.service, cluster.location);
    })(),
    "{{MONEY_PAGE_LINK_SECTION}}":      project.isHub ? buildMoneyPageSection(project.moneyPageUrl, project.moneyPageKeyword) : "",
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
    "{{WHATS_INCLUDED}}":            whatsIncludedHtml,
    "{{WHO_ITS_FOR}}":               whoItsForHtml,
    "{{LOCAL_RELEVANCE}}":           localRelevanceHtml,
    "{{COMMON_MISTAKES}}":           commonMistakesHtml,
    // AI citation enhancement sections
    "{{AI_DEFINITION_BLOCKS}}":      aiDefinitionBlocksHtml,
    "{{AI_CITABLE_BLOCKS}}":         aiCitableBlocksHtml,
    "{{BRAND_CSS}}":                 brandCss,
  };

  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }

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

  // ── B2B phrase sanitiser (HTML level) ────────────────────────────────────────
  // Deterministic backstop that runs on the final HTML for all non-digital /
  // household pages. Catches B2B phrases regardless of whether they came from
  // the AI JSON, the template layer, or a re-render from stored page-data.json.
  // These phrases only appear in visible text — never in tag names or attributes
  // — so raw-string replacement is safe.
  const nonDigitalTypes = new Set([
    "web-design","local-seo","seo","web-hosting",
    "email-marketing","digital-marketing","ppc","social-media-marketing",
  ]);
  const isNonDigitalRender = !!(project.industryType && !nonDigitalTypes.has(project.industryType));
  if (isNonDigitalRender || project.buyerType === "household") {
    const htmlRules: [RegExp, string][] = [
      [/\bfor businesses\s+facing\b/gi,                  "for people dealing with"],
      [/\bfor businesses\s+experiencing\b/gi,             "for people experiencing"],
      [/\bfor businesses\s+with\s+urgent\b/gi,            "for people with urgent"],
      [/\bfor businesses\s+that\s+need\b/gi,              "for people who need"],
      [/\bfor businesses\s+needing\b/gi,                  "for people needing"],
      [/\bfor businesses\s+in\b/gi,                       "for homeowners in"],
      [/\bfor businesses\b/gi,                            "for homeowners"],
      [/\bfor companies\b/gi,                             "for homeowners"],
      [/\bfor commercial clients\b/gi,                    "for homeowners and landlords"],
      [/\baffecting local businesses\b/gi,                "affecting local residents"],
      [/\bserving local businesses\b/gi,                  "serving local residents"],
      [/\blocal businesses and\b/gi,                      "local residents and"],
      [/\blocal businesses\b/gi,                          "local residents"],
      [/\bbusinesses facing\b/gi,                         "people dealing with"],
      [/\bbusinesses experiencing\b/gi,                   "people experiencing"],
      [/\bbusinesses with urgent\b/gi,                    "people with urgent"],
      [/\bbusinesses that need\b/gi,                      "people who need"],
      [/\bplumbing services for businesses\b/gi,          "plumbing services for homeowners"],
      [/\bservices for businesses\b/gi,                   "services for homeowners"],
      [/\bsolutions for businesses\b/gi,                  "solutions for homeowners"],
      [/\bsupport your business\b/gi,                     "help you at home"],
      [/\bkeep your business running\b/gi,                "get your home back to normal"],
      [/\byour business\b/gi,                             "your home"],
      [/\bprotect(?:\s+your)?\s+operations\b/gi,          "protect your property"],
      [/\boperational disruption\b/gi,                    "disruption at home"],
      [/\bbusiness continuity\b/gi,                       "keeping your home running"],
      [/\bcommercial risk\b/gi,                           "risk of damage to your home"],
      [/\bcommercial clients\b/gi,                        "homeowners and landlords"],
      [/\bminimis[ez]\s+downtime\s+for businesses\b/gi,   "minimise disruption to your home"],
      [/\bminimis[ez]\s+downtime\b/gi,                    "minimise disruption"],
    ];
    for (const [re, rep] of htmlRules) {
      html = html.replace(re, rep);
    }
  }

  return html;
}
