/**
 * Publication canonical authority — canonical URL follows the actual publish destination.
 * A Business Profile / customer website URL cannot become canonical unless that host is
 * the verified, authoritative production publication target.
 * Does not publish, index, or modify customer DNS/domains.
 */
import fs from "node:fs";
import path from "node:path";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import { resolveActivePublishBaseUrl } from "./customerEcosystemUrlService.ts";
import type { ManagedPublishingProfile } from "./masterAdminManagedPublishingModel.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export type PublicationCanonicalSource =
  | "managed_publication"
  | "verified_customer_domain_publication";

export interface AuthoritativePublicationCanonicalInput {
  slug: string;
  serviceId: string;
  publicPath?: string | null;
  storedCanonicalUrl?: string | null;
  profileWebsite?: string | null;
  managedProfile?: ManagedPublishingProfile | null;
}

export interface AuthoritativePublicationCanonical {
  canonicalUrl: string;
  publicationDestination: string;
  source: PublicationCanonicalSource;
  managedPublicUrl: string;
  verifiedCustomerPublicationUrl: string | null;
  rejectedStoredCanonical: string | null;
  profileWebsiteRejected: boolean;
  stalePageUrls: string[];
}

function str(value: unknown): string {
  return String(value || "").trim();
}

function safeSlug(slug: string): string {
  return (
    str(slug)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmacy"
  );
}

function normalizePublicPath(raw: string, serviceId: string): string {
  const fallback = `/${str(serviceId).replace(/^\/+|\/+$/g, "") || "service"}/`;
  const value = str(raw) || fallback;
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  const trimmed = withSlash.replace(/index\.html$/i, "");
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function joinPublicationUrl(baseUrl: string, publicPath: string): string {
  const base = str(baseUrl).replace(/\/$/, "");
  const pathPart = normalizePublicPath(publicPath, "service");
  return `${base}${pathPart}`.replace(/([^:]\/)\/+/g, "$1");
}

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function managedSitesHost(slug: string): string {
  return `${safeSlug(slug)}.sites.pharmaconnect.uk`;
}

function readProfileWebsite(slug: string): string | null {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${safeSlug(slug)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: { website?: string }; website?: string };
    return str(doc.data?.website || doc.website) || null;
  } catch {
    return null;
  }
}

function isManagedPublicationHost(host: string, slug: string): boolean {
  const expected = managedSitesHost(slug);
  return host === expected || host.endsWith(".sites.pharmaconnect.uk");
}

function expandUrlVariants(url: string): string[] {
  const value = str(url).replace(/\/$/, "");
  if (!value) return [];
  const withSlash = `${value}/`;
  const out = new Set([value, withSlash]);
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    const host = parsed.hostname.toLowerCase();
    const bare = host.replace(/^www\./, "");
    const alts = host.startsWith("www.") ? [bare, host] : [bare, `www.${bare}`];
    for (const alt of alts) {
      parsed.hostname = alt;
      const href = parsed.toString().replace(/\/$/, "");
      out.add(href);
      out.add(`${href}/`);
    }
  } catch {
    /* ignore */
  }
  return [...out];
}

export function isVerifiedCustomerDomainPublication(profile: ManagedPublishingProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.customerRootDomainConfirmed === true &&
    profile.dnsStatus === "verified" &&
    profile.sslStatus === "active" &&
    Boolean(str(profile.canonicalEcosystemHostname) || str(profile.canonicalEcosystemBaseUrl))
  );
}

export function resolveAuthoritativePublicationCanonical(
  input: AuthoritativePublicationCanonicalInput,
): AuthoritativePublicationCanonical {
  const slug = safeSlug(input.slug);
  const serviceId = str(input.serviceId);
  const meta = getServicePublishMeta(serviceId);
  const publicPath = normalizePublicPath(input.publicPath || meta?.urlPath || `/${serviceId}/`, serviceId);
  const profile = input.managedProfile === undefined ? readManagedPublishingProfile(slug) : input.managedProfile;
  const active = resolveActivePublishBaseUrl(profile, slug);
  const managedBase = str(profile?.managedUrl || `https://${managedSitesHost(slug)}/`).replace(/\/$/, "");
  const managedPublicUrl = joinPublicationUrl(managedBase, publicPath);

  const verified = isVerifiedCustomerDomainPublication(profile) && active.mode === "customer_canonical";
  const verifiedBase = verified ? active.baseUrl.replace(/\/$/, "") : null;
  const verifiedCustomerPublicationUrl = verifiedBase ? joinPublicationUrl(verifiedBase, publicPath) : null;

  const source: PublicationCanonicalSource = verified
    ? "verified_customer_domain_publication"
    : "managed_publication";
  const publicationDestination = verifiedCustomerPublicationUrl || managedPublicUrl;
  const canonicalUrl = publicationDestination;

  const stored = str(input.storedCanonicalUrl);
  const storedHost = hostOf(stored);
  const destHost = hostOf(canonicalUrl);
  const storedAgrees = Boolean(stored) && hostOf(stored) === destHost && stored.replace(/\/$/, "") === canonicalUrl.replace(/\/$/, "");
  const rejectedStoredCanonical =
    stored && !storedAgrees && (storedHost !== destHost || !isManagedPublicationHost(storedHost, slug))
      ? stored
      : null;

  const profileWebsite =
    input.profileWebsite === undefined ? readProfileWebsite(slug) || "" : str(input.profileWebsite);
  const profileHost = hostOf(profileWebsite);
  const profileWebsiteRejected = Boolean(
    profileHost && profileHost !== destHost && !isManagedPublicationHost(profileHost, slug),
  );

  const stalePageUrls = [
    ...expandUrlVariants(stored),
    ...expandUrlVariants(profileWebsite ? joinPublicationUrl(profileWebsite, publicPath) : ""),
  ].filter((url) => hostOf(url) && hostOf(url) !== destHost);

  return {
    canonicalUrl,
    publicationDestination,
    source,
    managedPublicUrl,
    verifiedCustomerPublicationUrl,
    rejectedStoredCanonical,
    profileWebsiteRejected,
    stalePageUrls,
  };
}

const PAGE_ENTITY_TYPES = /^(WebPage|Service|FAQPage|Article|ItemList)$/i;
const BUSINESS_ENTITY_TYPES = /Pharmacy|MedicalBusiness|LocalBusiness|MedicalClinic|Organization/i;
const STRUCTURED_DATA_URL_KEYS = new Set([
  "url",
  "@id",
  "item",
  "mainEntityOfPage",
  "isPartOf",
]);

export function isPlaceholderPublicationHost(host: string): boolean {
  const value = str(host).toLowerCase().replace(/^www\./, "");
  return (
    value === "example.local" ||
    value === "example.com" ||
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0"
  );
}

function originOf(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

function withTrailingSlash(url: string): string {
  const value = str(url);
  if (!value) return value;
  return value.endsWith("/") ? value : `${value}/`;
}

function splitUrlFragment(url: string): { base: string; fragment: string } {
  const hash = url.indexOf("#");
  if (hash < 0) return { base: url, fragment: "" };
  return { base: url.slice(0, hash), fragment: url.slice(hash) };
}

function looksLikeHttpUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(str(value)) || /^https?:\/\//i.test(str(value));
}

interface StructuredDataUrlContext {
  pageCanonical: string;
  serviceCanonical: string;
  businessIdentityUrl: string;
  publicationOrigin: string;
  slug: string;
  serviceId: string;
}

type StructuredDataUrlRole = "unknown" | "page" | "service" | "business";

export function resolvePublishedBusinessIdentityUrl(
  input: AuthoritativePublicationCanonicalInput,
  resolved: AuthoritativePublicationCanonical = resolveAuthoritativePublicationCanonical(input),
): string {
  const website =
    input.profileWebsite === undefined ? readProfileWebsite(input.slug) || "" : str(input.profileWebsite);
  const websiteHost = hostOf(website);
  if (
    website &&
    websiteHost &&
    !isPlaceholderPublicationHost(websiteHost) &&
    !isCrossTenantManagedHost(websiteHost, input.slug)
  ) {
    return withTrailingSlash(website.includes("://") ? website : `https://${website}`);
  }
  const origin = originOf(resolved.canonicalUrl) || `https://${managedSitesHost(input.slug)}`;
  return withTrailingSlash(origin);
}

function isCrossTenantManagedHost(host: string, slug: string): boolean {
  const value = str(host).toLowerCase().replace(/^www\./, "");
  return value.endsWith(".sites.pharmaconnect.uk") && value !== managedSitesHost(slug);
}

function isPageShapedPath(pathname: string, serviceId: string): boolean {
  const pathName = str(pathname).replace(/\/+$/, "") || "/";
  const servicePath = `/${str(serviceId).replace(/^\/+|\/+$/g, "")}`;
  if (pathName === servicePath) return true;
  if (pathName.startsWith(`${servicePath}/local/`)) return true;
  if (/^\/local-[^/]+$/.test(pathName)) return true;
  return false;
}

function withFragment(target: string, fragment: string): string {
  const trimmed = withTrailingSlash(target);
  if (!fragment) return trimmed;
  return `${trimmed.replace(/\/$/, "")}${fragment.startsWith("#") ? fragment : `#${fragment}`}`;
}

function mapPlaceholderOrGeneratorUrl(url: string, ctx: StructuredDataUrlContext, role: StructuredDataUrlRole): string {
  const { base, fragment } = splitUrlFragment(url);
  const withFrag = (target: string) => withFragment(target, fragment);

  if (role === "page") return withFrag(ctx.pageCanonical);
  if (role === "service") return withFrag(ctx.serviceCanonical);
  if (role === "business") {
    try {
      const parsed = new URL(base.includes("://") ? base : `https://${base}`);
      if (isPageShapedPath(parsed.pathname, ctx.serviceId) || isPlaceholderPublicationHost(parsed.hostname)) {
        return withFrag(ctx.businessIdentityUrl);
      }
      if (isCrossTenantManagedHost(parsed.hostname, ctx.slug)) return withFrag(ctx.businessIdentityUrl);
      return withTrailingSlash(base) === withTrailingSlash(ctx.businessIdentityUrl)
        ? withFrag(ctx.businessIdentityUrl)
        : looksLikeHttpUrl(base) && !isPlaceholderPublicationHost(parsed.hostname)
          ? withTrailingSlash(base)
          : withFrag(ctx.businessIdentityUrl);
    } catch {
      return withFrag(ctx.businessIdentityUrl);
    }
  }

  try {
    const parsed = new URL(base.includes("://") ? base : `https://${base}`);
    const host = parsed.hostname;
    const pathName = parsed.pathname.replace(/\/+$/, "") || "/";
    const placeholder = isPlaceholderPublicationHost(host);
    const generatorLocal = pathName.match(new RegExp(`^/${ctx.serviceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/local/([^/]+)$`, "i"));
    const publishedLocal = pathName.match(/^\/local-([^/]+)$/i);
    const locality = generatorLocal?.[1] || publishedLocal?.[1] || "";
    if (locality) return withFrag(joinPublicationUrl(ctx.publicationOrigin, `/local-${locality}/`));
    if (pathName === `/${ctx.serviceId}` || pathName === `/${ctx.serviceId}/`) return withFrag(ctx.serviceCanonical);
    if (pathName === "/") return withFrag(ctx.businessIdentityUrl);
    if (placeholder) return withFrag(joinPublicationUrl(ctx.publicationOrigin, `${pathName}/`));
    return url;
  } catch {
    return role === "page" ? withFrag(ctx.pageCanonical) : url;
  }
}

function rewriteStructuredDataUrl(value: string, ctx: StructuredDataUrlContext, role: StructuredDataUrlRole): string {
  const raw = str(value);
  if (!raw || raw === "https://schema.org" || raw.startsWith("https://schema.org/")) return raw;
  if (!looksLikeHttpUrl(raw) && !raw.startsWith("/")) return raw;
  if (!looksLikeHttpUrl(raw)) {
    if (role === "page") return withTrailingSlash(ctx.pageCanonical);
    if (role === "service") return withTrailingSlash(ctx.serviceCanonical);
    if (role === "business") return withTrailingSlash(ctx.businessIdentityUrl);
    return raw;
  }
  const host = hostOf(raw);
  if (!host) return raw;
  if (role === "page" || role === "service" || role === "business") {
    return mapPlaceholderOrGeneratorUrl(raw, ctx, role);
  }
  if (isPlaceholderPublicationHost(host) || isCrossTenantManagedHost(host, ctx.slug)) {
    return mapPlaceholderOrGeneratorUrl(raw, ctx, "unknown");
  }
  return raw;
}

function objectTypes(node: Record<string, unknown>): string[] {
  const type = node["@type"];
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((item): item is string => typeof item === "string");
  return [];
}

function rewriteBreadcrumbList(node: Record<string, unknown>, ctx: StructuredDataUrlContext): Record<string, unknown> {
  const items = Array.isArray(node.itemListElement) ? [...node.itemListElement] : [];
  const rewritten = items.map((item, index) => {
    if (!item || typeof item !== "object") return rewriteJsonLdNode(item, ctx, "unknown");
    const role: StructuredDataUrlRole =
      index === 0 ? "business" : index === items.length - 1 ? "page" : "service";
    return rewriteJsonLdNode(item, ctx, role);
  });
  return {
    ...node,
    itemListElement: rewritten,
  };
}

function rewriteJsonLdNode(value: unknown, ctx: StructuredDataUrlContext, role: StructuredDataUrlRole): unknown {
  if (typeof value === "string") return rewriteStructuredDataUrl(value, ctx, role);
  if (Array.isArray(value)) return value.map((item) => rewriteJsonLdNode(item, ctx, role));
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  const types = objectTypes(node);
  if (types.some((type) => /^BreadcrumbList$/i.test(type))) return rewriteBreadcrumbList(node, ctx);
  const nextRole: StructuredDataUrlRole = types.some((type) => BUSINESS_ENTITY_TYPES.test(type))
    ? "business"
    : types.some((type) => PAGE_ENTITY_TYPES.test(type))
      ? "page"
      : role;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node)) {
    if (key === "@context") {
      out[key] = child;
      continue;
    }
    if (key === "provider" || key === "parentOrganization" || key === "brand") {
      out[key] = rewriteJsonLdNode(child, ctx, "business");
      continue;
    }
    if (STRUCTURED_DATA_URL_KEYS.has(key)) {
      out[key] = rewriteJsonLdNode(child, ctx, nextRole);
      continue;
    }
    out[key] = rewriteJsonLdNode(child, ctx, nextRole);
  }
  return out;
}

export function applyAuthoritativeStructuredDataUrlsToHtml(
  html: string,
  input: AuthoritativePublicationCanonicalInput,
): string {
  const source = String(html || "");
  if (!source || !/<script\b[^>]*type=["']application\/ld\+json["']/i.test(source)) return source;
  const page = resolveAuthoritativePublicationCanonical(input);
  const service = resolveAuthoritativePublicationCanonical({
    ...input,
    publicPath: `/${str(input.serviceId).replace(/^\/+|\/+$/g, "")}/`,
  });
  const ctx: StructuredDataUrlContext = {
    pageCanonical: page.canonicalUrl,
    serviceCanonical: service.canonicalUrl,
    businessIdentityUrl: resolvePublishedBusinessIdentityUrl(input, page),
    publicationOrigin: originOf(page.canonicalUrl) || `https://${managedSitesHost(input.slug)}`,
    slug: safeSlug(input.slug),
    serviceId: str(input.serviceId),
  };
  const jsonLdScriptRe = /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi;
  return source.replace(jsonLdScriptRe, (full, open: string, body: string, close: string) => {
    try {
      const parsed = JSON.parse(String(body).trim()) as unknown;
      const next = rewriteJsonLdNode(parsed, ctx, "unknown");
      if (JSON.stringify(next) === JSON.stringify(parsed)) return full;
      return `${open}${JSON.stringify(next).replace(/</g, "\\u003c")}${close}`;
    } catch {
      return full;
    }
  });
}

export function applyAuthoritativeCanonicalToHtml(
  html: string,
  canonicalUrl: string,
  stalePageUrls: string[] = [],
): string {
  const source = String(html || "");
  if (!source) return source;
  const href = str(canonicalUrl);
  if (!href) return source;
  const tag = `<link rel="canonical" href="${href}"/>`;
  let out = source;
  if (/<link\b[^>]*\brel=["']canonical["'][^>]*>/i.test(out)) {
    out = out.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i, tag);
  } else if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `  ${tag}\n</head>`);
  } else {
    out = `${tag}\n${out}`;
  }

  const uniqueStale = [...new Set(stalePageUrls.map(str).filter(Boolean))];
  for (const stale of uniqueStale) {
    if (!stale || stale.replace(/\/$/, "") === href.replace(/\/$/, "")) continue;
    const escaped = stale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`("(?:url|item)"\\s*:\\s*")${escaped}(")`, "g"), `$1${href}$2`);
  }
  return out;
}

export function canonicalUrlForIndexing(input: AuthoritativePublicationCanonicalInput): string {
  return resolveAuthoritativePublicationCanonical(input).canonicalUrl;
}

export function publicPathFromPublishedRelativePath(relativePath: string, serviceId: string): string {
  const normalised = str(relativePath).replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!normalised || normalised === "index.html") {
    return normalizePublicPath(`/${serviceId}/`, serviceId);
  }
  const dir = path.posix.dirname(normalised);
  if (!dir || dir === ".") return normalizePublicPath(`/${serviceId}/`, serviceId);
  return normalizePublicPath(`/${dir}/`, serviceId);
}

export function applyAuthoritativeCanonicalToHtmlTree(
  rootDir: string,
  slug: string,
  serviceId: string,
): { filesUpdated: number; filesScanned: number } {
  if (!rootDir || !fs.existsSync(rootDir)) return { filesUpdated: 0, filesScanned: 0 };
  let filesUpdated = 0;
  let filesScanned = 0;
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "assets" || entry.name === "images" || entry.name === "revisions") continue;
        stack.push(full);
        continue;
      }
      if (!/\.html?$/i.test(entry.name)) continue;
      if (/^404\.html?$/i.test(entry.name)) continue;
      filesScanned += 1;
      const rel = path.relative(rootDir, full);
      const publicPath = publicPathFromPublishedRelativePath(rel, serviceId);
      const resolved = resolveAuthoritativePublicationCanonical({ slug, serviceId, publicPath });
      const original = fs.readFileSync(full, "utf8");
      const withCanonical = applyAuthoritativeCanonicalToHtml(original, resolved.canonicalUrl, resolved.stalePageUrls);
      const next = applyAuthoritativeStructuredDataUrlsToHtml(withCanonical, { slug, serviceId, publicPath });
      if (next !== original) {
        fs.writeFileSync(full, next, "utf8");
        filesUpdated += 1;
      }
    }
  }
  return { filesUpdated, filesScanned };
}

