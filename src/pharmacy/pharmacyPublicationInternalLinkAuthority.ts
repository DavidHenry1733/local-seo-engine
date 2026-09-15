/**
 * Publication internal-link authority — authoritative HTML may only keep hrefs
 * that resolve to real published destinations (or legitimate external identity).
 * Does not invent /locations/ pages or redirects.
 */
import fs from "node:fs";
import path from "node:path";
import { canonicalPageSlugForLocalUrlPath } from "./pharmacyLocalLocationGenerationService.ts";
import { publicPathFromPublishedRelativePath } from "./pharmacyPublicationCanonicalAuthority.ts";

export interface PublicationInternalLinkInput {
  slug: string;
  serviceId: string;
  publicPath?: string | null;
  publishedPublicPaths?: Iterable<string> | null;
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

function withSlash(value: string): string {
  const raw = str(value);
  if (!raw) return "/";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

function hostOf(url: string): string {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isPlaceholderHost(host: string): boolean {
  const value = host.replace(/^www\./, "");
  return (
    value === "example.local" ||
    value === "example.com" ||
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0"
  );
}

function managedHost(slug: string): string {
  return `${safeSlug(slug)}.sites.pharmaconnect.uk`;
}

export function isLocationHubPublicPath(pathname: string): boolean {
  const value = withSlash(pathname).toLowerCase();
  return (
    value === "/locations/" ||
    value === "/local/locations/" ||
    value === "/local/hub/" ||
    value === "/local-hub/"
  );
}

export function collectPublishedPublicPaths(rootDir: string, serviceId: string): Set<string> {
  const published = new Set<string>([`/${str(serviceId).replace(/^\/+|\/+$/g, "")}/`]);
  if (!rootDir || !fs.existsSync(rootDir)) return published;
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
      if (!/^index\.html?$/i.test(entry.name)) continue;
      const rel = path.relative(rootDir, full).replace(/\\/g, "/");
      published.add(publicPathFromPublishedRelativePath(rel, serviceId));
    }
  }
  return published;
}

function pathnameOf(href: string): string {
  const raw = str(href);
  if (!raw) return "";
  if (raw.startsWith("#") || /^(mailto|tel|javascript):/i.test(raw)) return "";
  try {
    if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
      const parsed = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
      return parsed.pathname || "/";
    }
  } catch {
    return "";
  }
  return raw.split("?")[0]?.split("#")[0] || raw;
}

function mapGeneratorPathToPublicationPath(pathname: string, serviceId: string): string {
  const value = withSlash(pathname);
  if (isLocationHubPublicPath(value)) return `/${str(serviceId).replace(/^\/+|\/+$/g, "")}/`;
  const serviceLocal = value.match(new RegExp(`^/${str(serviceId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/local/([^/]+)/$`, "i"));
  if (serviceLocal?.[1]) return `/${canonicalPageSlugForLocalUrlPath(`/local/${serviceLocal[1]}/`)}/`;
  if (/^\/local\/[^/]+\/$/.test(value) && !isLocationHubPublicPath(value)) {
    return `/${canonicalPageSlugForLocalUrlPath(value)}/`;
  }
  return value;
}

function isKeepExternalHref(href: string, slug: string): boolean {
  const host = hostOf(href);
  if (!host) return true;
  if (isPlaceholderHost(host)) return false;
  if (host.endsWith(".sites.pharmaconnect.uk") && host !== managedHost(slug)) return false;
  return true;
}

function isAssetOrFragment(pathname: string, href: string): boolean {
  if (str(href).startsWith("#")) return true;
  if (/^(mailto|tel):/i.test(href)) return true;
  const value = withSlash(pathname);
  return value.startsWith("/assets/") || value.startsWith("/images/");
}

function locationHubPublished(published: Set<string>): boolean {
  return [...published].some((item) => isLocationHubPublicPath(item));
}

function resolveInternalHref(
  href: string,
  serviceId: string,
  slug: string,
  published: Set<string>,
): { href: string; drop: boolean } {
  const raw = str(href);
  if (!raw || isAssetOrFragment(pathnameOf(raw), raw)) return { href: raw, drop: false };
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    if (!isKeepExternalHref(raw, slug)) return { href: raw, drop: true };
    const host = hostOf(raw);
    if (host === managedHost(slug)) {
      const mapped = mapGeneratorPathToPublicationPath(pathnameOf(raw), serviceId);
      if (isLocationHubPublicPath(pathnameOf(raw)) && !locationHubPublished(published)) {
        return { href: `/${str(serviceId).replace(/^\/+|\/+$/g, "")}/`, drop: false };
      }
      if (published.has(withSlash(mapped)) || withSlash(mapped).startsWith("/local-")) {
        return { href: mapped, drop: false };
      }
    }
    return { href: raw, drop: false };
  }
  if (/^\/api\/pharmacy-(visual-experience|content-ecosystem-preview)\//i.test(raw)) {
    return { href: raw, drop: true };
  }
  const mapped = mapGeneratorPathToPublicationPath(pathnameOf(raw), serviceId);
  if (isLocationHubPublicPath(pathnameOf(raw)) && !locationHubPublished(published)) {
    return { href: `/${str(serviceId).replace(/^\/+|\/+$/g, "")}/`, drop: false };
  }
  if (published.has(withSlash(mapped))) return { href: mapped, drop: false };
  if (withSlash(mapped).startsWith("/local-") && !isLocationHubPublicPath(mapped)) return { href: mapped, drop: false };
  if (withSlash(mapped) === `/${str(serviceId).replace(/^\/+|\/+$/g, "")}/`) return { href: mapped, drop: false };
  if (published.size <= 1) return { href: mapped, drop: false };
  return { href: mapped, drop: true };
}

function attr(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || "";
}

function unwrapAnchorsMatching(html: string, shouldUnwrap: (href: string, inner: string) => boolean): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    const href = attr(`<a ${attrs}>`, "href");
    if (!href || !shouldUnwrap(href, inner)) return full;
    return inner;
  });
}

export function applyAuthoritativeInternalLinksToHtml(
  html: string,
  input: PublicationInternalLinkInput,
): string {
  const source = String(html || "");
  if (!source) return source;
  const serviceId = str(input.serviceId);
  const slug = safeSlug(input.slug);
  const published = new Set(
    [...(input.publishedPublicPaths || [])].map((item) => withSlash(item)).filter(Boolean),
  );
  if (!published.size) published.add(`/${serviceId.replace(/^\/+|\/+$/g, "")}/`);
  let out = source;

  if (!locationHubPublished(published)) {
    out = out.replace(
      /\s*<span aria-hidden="true">›<\/span>\s*<a\b[^>]*href=["'][^"']*(?:\/locations\/?|\/local\/(?:hub|locations)\/?|\/local-hub\/?)[^"']*["'][^>]*>\s*Locations\s*<\/a>/gi,
      "",
    );
  }

  out = unwrapAnchorsMatching(out, (href, inner) => {
    const resolved = resolveInternalHref(href, serviceId, slug, published);
    return resolved.drop && !/locations/i.test(inner);
  });

  out = out.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const href = attr(`<a ${attrs}>`, "href");
    if (!href) return full;
    const resolved = resolveInternalHref(href, serviceId, slug, published);
    if (resolved.drop) return full;
    if (resolved.href === href) return full;
    if (/\bhref\s*=\s*["'][^"']*["']/i.test(attrs)) {
      return `<a${attrs.replace(/\bhref\s*=\s*["'][^"']*["']/i, `href="${resolved.href}"`)}>`;
    }
    return full;
  });

  if (!locationHubPublished(published)) {
    out = unwrapAnchorsMatching(out, (href) => isLocationHubPublicPath(pathnameOf(href)));
  }

  return out;
}

export function applyAuthoritativeInternalLinksToHtmlTree(
  rootDir: string,
  slug: string,
  serviceId: string,
): { filesUpdated: number; filesScanned: number; publishedPublicPaths: string[] } {
  if (!rootDir || !fs.existsSync(rootDir)) {
    return { filesUpdated: 0, filesScanned: 0, publishedPublicPaths: [] };
  }
  const published = collectPublishedPublicPaths(rootDir, serviceId);
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
      const rel = path.relative(rootDir, full).replace(/\\/g, "/");
      const publicPath = publicPathFromPublishedRelativePath(rel, serviceId);
      const original = fs.readFileSync(full, "utf8");
      const next = applyAuthoritativeInternalLinksToHtml(original, {
        slug,
        serviceId,
        publicPath,
        publishedPublicPaths: published,
      });
      if (next !== original) {
        fs.writeFileSync(full, next, "utf8");
        filesUpdated += 1;
      }
    }
  }
  return { filesUpdated, filesScanned, publishedPublicPaths: [...published] };
}
