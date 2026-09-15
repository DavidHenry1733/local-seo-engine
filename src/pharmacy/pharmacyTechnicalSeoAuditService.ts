/**
 * Live/published Technical SEO audit. Inspects FINAL HTML. Does not repair, publish, or index.
 */
import fs from "node:fs";
import path from "node:path";
import {
  TECHNICAL_SEO_CONTRACT_VERSION,
  TECHNICAL_SEO_MANDATORY_RULES,
  TECHNICAL_SEO_PAGE_TYPES,
} from "./pharmacyTechnicalSeoContract.ts";
import {
  evaluateTechnicalSeoIndexGate,
  type TechnicalSeoIndexGateResult,
} from "./pharmacyTechnicalSeoIndexGate.ts";
import { resolveAuthoritativePublicationCanonical } from "./pharmacyPublicationCanonicalAuthority.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";

export interface PublishedTechnicalSeoPageSource {
  pageType: string;
  publicPath: string;
  pageUrl: string;
  relativePath: string;
  expectedLocality?: string | null;
}

export interface TechnicalSeoCampaignAudit {
  version: typeof TECHNICAL_SEO_CONTRACT_VERSION;
  slug: string;
  serviceId: string;
  auditedAt: string;
  liveHtmlAuthoritative: true;
  publicationBase: string;
  totalPublishedUrls: number;
  intendedIndexableUrls: number;
  intentionallyNonIndexableUrls: number;
  tenthPageIdentity: string | null;
  eligibleCount: number;
  blockedCount: number;
  pages: TechnicalSeoIndexGateResult[];
  sitemapUrls: string[];
  mandatoryRules: typeof TECHNICAL_SEO_MANDATORY_RULES;
  registeredPageTypes: typeof TECHNICAL_SEO_PAGE_TYPES;
}

function safeSlug(slug: string): string {
  return (
    String(slug || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmacy"
  );
}

function liveRootCandidates(slug: string): string[] {
  const s = safeSlug(slug);
  return [
    `/var/www/pharmaconnect-sites/${s}/current`,
    path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/output/pharmacy-publish", s),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", s),
  ];
}

function resolvePublishRoot(slug: string): string {
  for (const dir of liveRootCandidates(slug)) {
    if (fs.existsSync(path.join(dir, "_publish-index.json")) || fs.existsSync(path.join(dir, "sitemap.xml"))) {
      return dir;
    }
  }
  return liveRootCandidates(slug)[0]!;
}

function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => String(match[1] || "").trim()).filter(Boolean);
}

function localityFromSlug(pageSlug: string): string | null {
  const raw = pageSlug.replace(/^local-/, "").replace(/-/g, " ").trim();
  if (!raw) return null;
  return raw.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function classifyPublishPage(page: {
  pageSlug?: string;
  pageType?: string;
  url?: string;
  relativePath?: string;
}): PublishedTechnicalSeoPageSource {
  const pageSlug = String(page.pageSlug || "").trim();
  const relativePath = String(page.relativePath || (pageSlug ? `${pageSlug}/index.html` : "index.html"));
  let publicPath = "/";
  if (relativePath === "index.html" || pageSlug === "" || pageSlug === "index") publicPath = "/";
  else publicPath = `/${pageSlug || relativePath.replace(/\/index\.html$/i, "")}/`;
  const isHome = publicPath === "/" || page.pageType === "homepage";
  return {
    pageType: isHome ? "homepage" : String(page.pageType || "service"),
    publicPath,
    pageUrl: String(page.url || ""),
    relativePath,
    expectedLocality: /local-|location-area|service-area/i.test(`${pageSlug} ${page.pageType}`)
      ? localityFromSlug(pageSlug)
      : null,
  };
}

function loadPublishedPages(root: string, slug: string, serviceId: string): PublishedTechnicalSeoPageSource[] {
  const indexFile = path.join(root, "_publish-index.json");
  const manifestFile = path.join(root, "FinalRenderManifest.json");
  if (fs.existsSync(indexFile)) {
    const index = JSON.parse(fs.readFileSync(indexFile, "utf8")) as {
      pages?: Array<{ pageSlug?: string; pageType?: string; url?: string; outputPath?: string }>;
    };
    return (index.pages || []).map((page) =>
      classifyPublishPage({
        pageSlug: page.pageSlug,
        pageType: page.pageType,
        url: page.url,
        relativePath: String(page.outputPath || "").split(`${slug}/`).pop() || "",
      }),
    );
  }
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as {
      pages?: Array<{ pageSlug?: string; pageType?: string; relativePath?: string }>;
      managedWebsiteBase?: string;
    };
    const base = String(manifest.managedWebsiteBase || "").replace(/\/$/, "");
    return (manifest.pages || []).map((page) => {
      const source = classifyPublishPage(page);
      source.pageUrl = `${base}${source.publicPath}`;
      return source;
    });
  }
  const fallback: PublishedTechnicalSeoPageSource[] = [
    { pageType: "service", publicPath: `/${serviceId}/`, pageUrl: "", relativePath: `${serviceId}/index.html` },
  ];
  return fallback;
}

async function fetchLive(url: string): Promise<{ status: number; html: string; finalUrl: string }> {
  const res = await fetch(url, { redirect: "manual" });
  const html = await res.text();
  return { status: res.status, html, finalUrl: url };
}

async function checkSameHostLink(
  origin: string,
  href: string,
  cache: Map<string, number>,
): Promise<string | null> {
  if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return null;
  let absolute = href;
  try {
    absolute = new URL(href, origin).toString();
  } catch {
    return null;
  }
  let host = "";
  try {
    host = new URL(absolute).hostname.toLowerCase();
  } catch {
    return null;
  }
  let originHost = "";
  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
  if (host !== originHost) return null;
  const normalized = absolute.replace(/#.*$/, "");
  if (!cache.has(normalized)) {
    try {
      const res = await fetch(normalized, { redirect: "manual" });
      cache.set(normalized, res.status);
    } catch {
      cache.set(normalized, 0);
    }
  }
  const status = cache.get(normalized) || 0;
  if (status === 200 || status === 301 || status === 302 || status === 307 || status === 308) return null;
  return href;
}

export function technicalSeoAuditPath(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-technical-seo-audits",
    `${safeSlug(slug)}-${safeSlug(serviceId)}.json`,
  );
}

export async function auditPublishedTechnicalSeo(input: {
  slug: string;
  serviceId: string;
  fetchLive?: boolean;
}): Promise<TechnicalSeoCampaignAudit> {
  const slug = safeSlug(input.slug);
  const serviceId = String(input.serviceId || "").trim();
  const root = resolvePublishRoot(slug);
  const managed = readManagedPublishingProfile(slug);
  const authority = resolveAuthoritativePublicationCanonical({ slug, serviceId, publicPath: `/${serviceId}/` });
  const publicationBase = authority.managedPublicUrl.replace(new RegExp(`/${serviceId}/?$`), "/");
  const pages = loadPublishedPages(root, slug, serviceId);
  const sitemapFile = path.join(root, "sitemap.xml");
  const sitemapUrls = fs.existsSync(sitemapFile) ? parseSitemap(fs.readFileSync(sitemapFile, "utf8")) : [];
  const profileFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  let profileWebsite: string | null = null;
  if (fs.existsSync(profileFile)) {
    try {
      const doc = JSON.parse(fs.readFileSync(profileFile, "utf8")) as { data?: { website?: string }; website?: string };
      profileWebsite = String(doc.data?.website || doc.website || "").trim() || null;
    } catch {
      profileWebsite = null;
    }
  }

  const linkStatusCache = new Map<string, number>();
  const evaluated: TechnicalSeoIndexGateResult[] = [];
  const origin = publicationBase.replace(/\/$/, "") || `https://${slug}.sites.pharmaconnect.uk`;

  for (const page of pages) {
    const pageUrl = page.pageUrl || `${origin}${page.publicPath}`;
    let html = "";
    let httpStatus: number | null = null;
    if (input.fetchLive !== false) {
      try {
        const live = await fetchLive(pageUrl);
        html = live.html;
        httpStatus = live.status;
      } catch {
        httpStatus = 0;
      }
    }
    if (!html) {
      const disk = path.join(root, page.relativePath);
      if (fs.existsSync(disk)) html = fs.readFileSync(disk, "utf8");
    }
    const preview = evaluateTechnicalSeoIndexGate({
      slug,
      serviceId,
      pageType: page.pageType,
      publicPath: page.publicPath,
      html,
      pageUrl,
      httpStatus,
      sitemapUrls,
      expectedLocality: page.expectedLocality,
      profileWebsite,
      managedProfile: managed,
      servicePublicPath: `/${serviceId}/`,
    });
    const broken: string[] = [];
    if (preview.intendedIndexable) {
      for (const link of preview.inspected.links) {
        const failed = await checkSameHostLink(pageUrl, link.href, linkStatusCache);
        if (failed) broken.push(failed);
      }
    }
    evaluated.push(
      evaluateTechnicalSeoIndexGate({
        slug,
        serviceId,
        pageType: page.pageType,
        publicPath: page.publicPath,
        html,
        pageUrl,
        httpStatus,
        sitemapUrls,
        campaignCanonicals: evaluated
          .filter((item) => item.intendedIndexable)
          .map((item) => item.canonical)
          .concat(preview.intendedIndexable ? preview.canonical : []),
        expectedLocality: page.expectedLocality,
        profileWebsite,
        managedProfile: managed,
        brokenSameHostPaths: [...new Set(broken)],
        servicePublicPath: `/${serviceId}/`,
      }),
    );
  }

  const homepage = evaluated.find((page) => page.pageType === "homepage" || page.publicPath === "/");
  const audit: TechnicalSeoCampaignAudit = {
    version: TECHNICAL_SEO_CONTRACT_VERSION,
    slug,
    serviceId,
    auditedAt: new Date().toISOString(),
    liveHtmlAuthoritative: true,
    publicationBase: origin,
    totalPublishedUrls: evaluated.length,
    intendedIndexableUrls: evaluated.filter((page) => page.intendedIndexable).length,
    intentionallyNonIndexableUrls: evaluated.filter((page) => !page.intendedIndexable).length,
    tenthPageIdentity: homepage
      ? `homepage redirect at ${homepage.pageUrl} → ${homepage.inspected.metaRefreshTarget || homepage.canonical}`
      : null,
    eligibleCount: evaluated.filter((page) => page.eligible).length,
    blockedCount: evaluated.filter((page) => page.intendedIndexable && !page.eligible).length,
    pages: evaluated,
    sitemapUrls,
    mandatoryRules: TECHNICAL_SEO_MANDATORY_RULES,
    registeredPageTypes: TECHNICAL_SEO_PAGE_TYPES,
  };

  const artefact = technicalSeoAuditPath(slug, serviceId);
  fs.mkdirSync(path.dirname(artefact), { recursive: true });
  const serialisable = {
    ...audit,
    pages: audit.pages.map((page) => {
      const { inspected, ...rest } = page;
      return {
        ...rest,
        headingHierarchy: { h1: inspected.h1, h2: inspected.h2, h3: inspected.h3 },
        imageCount: inspected.images.length,
        jsonLdBlockCount: inspected.jsonLd.length,
      };
    }),
  };
  fs.writeFileSync(artefact, JSON.stringify(serialisable, null, 2));
  return audit;
}

export function assertNoTechnicalSeoIndexBlockers(audit: TechnicalSeoCampaignAudit): void {
  if (audit.blockedCount > 0) {
    const reasons = audit.pages
      .filter((page) => page.intendedIndexable && !page.eligible)
      .map((page) => `${page.pageUrl}: ${page.blockers.map((item) => item.code).join(",")}`)
      .join("; ");
    throw new Error(`Technical SEO index gate blocked ${audit.blockedCount} page(s); nothing submitted for indexing. ${reasons}`);
  }
}

export function loadTechnicalSeoAudit(slug: string, serviceId: string): TechnicalSeoCampaignAudit | null {
  const file = technicalSeoAuditPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as TechnicalSeoCampaignAudit;
  } catch {
    return null;
  }
}
