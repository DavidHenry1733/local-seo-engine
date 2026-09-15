/**
 * Targeted website CSS/HTML evidence fetch for Brand DNA extraction.
 * Fetches stylesheet URLs only — not a full site crawl.
 */
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export interface ParsedCssVariables {
  variables: Record<string, string>;
  sourceUrl: string;
  confidence: number;
  hexCandidates: string[];
}

export interface WebsiteCssEvidence {
  stylesheets: ParsedCssVariables[];
  mergedVariables: Record<string, string>;
  mergedHexCandidates: string[];
  mergedCssText: string;
  confidence: number;
}

export interface WebsiteHtmlIdentityEvidence {
  logoUrl: string;
  logoWidth: string;
  faviconUrl: string;
  sourceUrl: string;
  confidence: number;
  extractionMethod: string;
  hexCandidates: string[];
}

interface LogoCandidate {
  url: string;
  width: string;
  confidence: number;
  method: string;
  selector: string;
}

function sameOriginAsset(sourceUrl: string, assetUrl: string): boolean {
  try {
    const origin = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const assetHost = new URL(assetUrl).hostname.replace(/^www\./, "");
    return assetHost === origin || assetHost.endsWith(`.${origin}`);
  } catch {
    return false;
  }
}

function looksLikeFavicon(url: string): boolean {
  return /favicon|apple-touch-icon|icon-logo|\.ico(?:$|[?#])/i.test(url);
}

function extractLogoCandidates(html: string, sourceUrl: string): LogoCandidate[] {
  const candidates: LogoCandidate[] = [];
  const push = (url: string, width: string, confidence: number, method: string, selector: string) => {
    const resolved = resolveAbsoluteUrl(sourceUrl, url);
    if (!resolved || !/^https?:\/\//i.test(resolved)) return;
    if (!sameOriginAsset(sourceUrl, resolved)) return;
    candidates.push({ url: resolved, width, confidence, method, selector });
  };

  const imgPatterns: Array<{ regex: RegExp; confidence: number; method: string; selector: string }> = [
    { regex: /<img[^>]+class=["'][^"']*(?:custom-logo|site-logo|standard-logo|retina-logo|sticky-logo)[^"']*["'][^>]*>/gi, confidence: 95, method: "img-class-logo", selector: "header img.logo-class" },
    { regex: /<img[^>]+class=["'][^"']*brand-logo[^"']*["'][^>]*>/gi, confidence: 92, method: "img-brand-logo", selector: ".brand-logo img" },
    { regex: /<a[^>]+class=["'][^"']*(?:custom-logo-link|logo)[^"']*["'][^>]*>[\s\S]{0,500}?<img[^>]+>/gi, confidence: 90, method: "logo-link-img", selector: "a.logo img" },
    { regex: /<picture[^>]*>[\s\S]{0,800}?<\/picture>/gi, confidence: 88, method: "picture-source", selector: "picture img" },
    { regex: /<img[^>]+src=["']([^"']+)["'][^>]*>/gi, confidence: 70, method: "img-src", selector: "img" },
  ];

  for (const pattern of imgPatterns) {
    for (const match of html.matchAll(pattern.regex)) {
      const block = match[0];
      const srcset = block.match(/srcset=["']([^"']+)["']/i)?.[1];
      const src = block.match(/src=["']([^"']+)["']/i)?.[1];
      const sourceSrc = block.match(/<source[^>]+srcset=["']([^"'\s,]+)/i)?.[1];
      const chosen = src || sourceSrc || srcset?.split(/\s+/)[0] || "";
      if (!chosen) continue;
      const widthMatch = block.match(/width=["']?(\d+)/i);
      const width = widthMatch?.[1] ? `${widthMatch[1]}px` : "";
      const className = block.match(/class=["']([^"']+)["']/i)?.[1] || "";
      const alt = block.match(/alt=["']([^"']*)["']/i)?.[1] || "";
      let confidence = pattern.confidence;
      if (/logo|brand|site-title/i.test(`${className} ${alt} ${chosen}`)) confidence += 4;
      if (looksLikeFavicon(chosen)) confidence -= 40;
      push(chosen, width, confidence, pattern.method, pattern.selector);
    }
  }

  for (const match of html.matchAll(/background-image:\s*url\(["']?([^"')]+)["']?\)/gi)) {
    const url = match[1];
    if (!/logo|brand|header/i.test(match.input || url)) continue;
    push(url, "", 75, "css-background-image", "header background-image");
  }

  const linkedSvg = html.match(/<a[^>]+class=["'][^"']*logo[^"']*["'][^>]+href=["']([^"']+\.svg)["']/i)?.[1];
  if (linkedSvg) push(linkedSvg, "", 84, "linked-svg", "a.logo svg");

  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (ogImage && /logo|brand|weblogo/i.test(ogImage)) {
    push(ogImage, "", 72, "og-image", "meta[property=og:image]");
  }

  const schemaLogo = html.match(/"logo"\s*:\s*"([^"]+)"/i)?.[1];
  if (schemaLogo) push(schemaLogo, "", 80, "schema-logo", "schema.org logo");

  const byUrl = new Map<string, LogoCandidate>();
  for (const candidate of candidates.sort((a, b) => b.confidence - a.confidence)) {
    if (looksLikeFavicon(candidate.url) && candidates.some((c) => !looksLikeFavicon(c.url))) continue;
    if (!byUrl.has(candidate.url)) byUrl.set(candidate.url, candidate);
  }
  return [...byUrl.values()].sort((a, b) => b.confidence - a.confidence);
}

function chooseBestLogo(candidates: LogoCandidate[], faviconUrl: string): LogoCandidate | null {
  const nonFavicon = candidates.filter((c) => !looksLikeFavicon(c.url));
  if (nonFavicon.length) return nonFavicon[0];
  if (candidates.length && !faviconUrl) return candidates[0];
  return null;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

async function safeFetchText(url: string, maxBytes = 250_000, timeoutMs = 12_000): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const lib = parsed.protocol === "https:" ? https : http;

    return await new Promise((resolve) => {
      const req = lib.get(
        url,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PharmaConnectBrandDna/1.0)",
            Accept: "text/css,text/html,*/*;q=0.8",
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size <= maxBytes) chunks.push(chunk);
          });
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          res.on("error", () => resolve(null));
        },
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

function collectHexCandidates(css: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const hex = `#${match[1]}`;
    const key = hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hex);
  }
  return out;
}

function parseCssVariables(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /--([\w-]+)\s*:\s*([^;!]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    const name = match[1].trim().toLowerCase();
    const value = match[2].trim();
    const hex = value.match(/#([0-9a-fA-F]{3,8})/);
    if (hex) {
      out[name] = `#${hex[1]}`;
      continue;
    }
    if (/^var\(/i.test(value)) continue;
    out[name] = value.replace(/['"]/g, "").trim();
  }
  return out;
}

function resolveAbsoluteUrl(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

const CSS_PATHS = [
  "assets/css/style.css",
  "assets/css/common-style.css",
  "assets/css/pages/home-one.css",
];

export async function fetchWebsiteCssEvidence(sourceUrl: string): Promise<WebsiteCssEvidence> {
  const base = sourceUrl.replace(/\/$/, "");
  const stylesheets: ParsedCssVariables[] = [];
  const mergedVariables: Record<string, string> = {};
  const mergedHexCandidates: string[] = [];
  const cssChunks: string[] = [];

  for (const rel of CSS_PATHS) {
    const sheetUrl = resolveAbsoluteUrl(`${base}/`, rel);
    const css = await safeFetchText(sheetUrl);
    if (!css) continue;
    cssChunks.push(css);
    const variables = parseCssVariables(css);
    const hexCandidates = collectHexCandidates(css);
    const count = Object.keys(variables).length;
    if (!count && !hexCandidates.length) continue;
    stylesheets.push({
      variables,
      sourceUrl: sheetUrl,
      confidence: Math.min(100, 40 + count * 4 + hexCandidates.length),
      hexCandidates,
    });
    Object.assign(mergedVariables, variables);
    for (const hex of hexCandidates) {
      if (!mergedHexCandidates.includes(hex)) mergedHexCandidates.push(hex);
    }
  }

  const confidence = stylesheets.length
    ? Math.min(100, Math.max(...stylesheets.map((s) => s.confidence)))
    : 0;

  return { stylesheets, mergedVariables, mergedHexCandidates, mergedCssText: cssChunks.join("\n"), confidence };
}

export async function fetchWebsiteHtmlIdentityEvidence(sourceUrl: string): Promise<WebsiteHtmlIdentityEvidence | null> {
  const html = await safeFetchText(sourceUrl, 400_000);
  if (!html) return null;

  const faviconMatch =
    html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/href=["']([^"']*favicon[^"']*)["'][^>]+rel=["'][^"']*icon/i);
  const faviconUrl = faviconMatch ? resolveAbsoluteUrl(sourceUrl, faviconMatch[1]) : "";

  const logoCandidates = extractLogoCandidates(html, sourceUrl);
  const chosenLogo = chooseBestLogo(logoCandidates, faviconUrl);

  if (!chosenLogo?.url && !faviconUrl) return null;

  return {
    logoUrl: chosenLogo?.url || "",
    logoWidth: chosenLogo?.width || "",
    faviconUrl,
    sourceUrl,
    confidence: chosenLogo ? chosenLogo.confidence : faviconUrl ? 45 : 0,
    extractionMethod: chosenLogo?.method || "favicon-only",
    hexCandidates: collectHexCandidates(html),
  };
}

export function extractWebsiteHtmlNavigationLinks(sourceUrl: string, html: string): Array<{ label: string; href: string }> {
  const origin = new URL(sourceUrl).origin;
  const links: Array<{ label: string; href: string }> = [];
  const seen = new Set<string>();
  const patterns = [
    /<a[^>]+class=["'][^"']*mega-menu-link[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi,
    /<li[^>]+class=["'][^"']*menu-item[^"']*["'][\s\S]{0,250}?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi,
    /<nav[\s\S]{0,6000}?<\/nav>/gi,
  ];

  for (const pattern of patterns.slice(0, 2)) {
    for (const match of html.matchAll(pattern)) {
      const href = resolveAbsoluteUrl(sourceUrl, str(match[1]));
      const label = str(match[2]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!label || !href.startsWith(origin)) continue;
      if (/cart|account|login|wishlist|javascript:/i.test(href)) continue;
      const key = `${label.toLowerCase()}|${href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ label, href });
      if (links.length >= 12) return links;
    }
  }

  const navBlock = html.match(/<nav[\s\S]{0,8000}?<\/nav>/i)?.[0] || "";
  for (const match of navBlock.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const href = resolveAbsoluteUrl(sourceUrl, str(match[1]));
    const label = str(match[2]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!label || !href.startsWith(origin)) continue;
    if (/cart|account|login|wishlist|javascript:/i.test(href)) continue;
    const key = `${label.toLowerCase()}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ label, href });
    if (links.length >= 12) break;
  }
  return links;
}

export function extractWebsiteHtmlFooterLinks(sourceUrl: string, html: string): Array<{ label: string; href: string }> {
  const origin = new URL(sourceUrl).origin;
  const footerBlock = html.match(/<footer[\s\S]{0,12000}?<\/footer>/i)?.[0] || "";
  if (!footerBlock) return [];
  const links: Array<{ label: string; href: string }> = [];
  const seen = new Set<string>();
  for (const match of footerBlock.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const href = resolveAbsoluteUrl(sourceUrl, str(match[1]));
    const label = str(match[2]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!label || !href.startsWith(origin)) continue;
    const key = `${label.toLowerCase()}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ label, href });
    if (links.length >= 12) break;
  }
  return links;
}

export function cssHex(vars: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = str(vars[name.toLowerCase()]);
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  }
  return "";
}

export function cssFontFamily(vars: Record<string, string>, name: string): string {
  const value = str(vars[name.toLowerCase()]);
  if (!value) return "";
  return value.split(",")[0]?.replace(/['"]/g, "").trim() || "";
}

export function pickAccentHex(primary: string, candidates: string[]): string {
  const primaryKey = primary.toLowerCase();
  const preferred = ["#1682b0", "#4F6BD6", "#1CA9C9"];
  for (const hex of preferred) {
    if (candidates.some((c) => c.toLowerCase() === hex.toLowerCase())) return hex;
  }

  for (const hex of candidates) {
    const key = hex.toLowerCase();
    if (key === primaryKey) continue;
    if (/^#(fff|ffffff|f8f9fa|edf2f6|f1fcf9|e5e5e5|fbfdff)$/i.test(key)) continue;
    if (key.length !== 7) continue;
    const r = parseInt(key.slice(1, 3), 16);
    const g = parseInt(key.slice(3, 5), 16);
    const b = parseInt(key.slice(5, 7), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) continue;
    if (b > 120 && b > r + 15 && b >= g) return hex;
  }
  return "";
}
