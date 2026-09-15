/**
 * brandImporter.ts
 *
 * Safe website fetcher that extracts brand signals from a client's existing
 * website and saves them as a brand-profile.json for use during page generation.
 *
 * Security rules:
 * - Only fetches public HTML/CSS. No JS execution, no form submission.
 * - Strict timeout (10 s) and response-size limits.
 * - Max 3 CSS file fetches, max 200 KB each.
 * - Follows up to 5 redirects.
 * - Never stores credentials or cookies.
 */

import http   from "node:http";
import https  from "node:https";
import { URL } from "node:url";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavLink {
  label: string;
  href:  string;
}

export interface ToneOfVoice {
  style:       string;
  samplePhrases: string[];
  formality:   "casual" | "professional" | "premium" | "friendly";
  notes:       string;
}

export interface BrandProfile {
  sourceUrl:         string;
  fetchedAt:         string;
  businessName:      string;
  logoUrl:           string;
  faviconUrl:        string;
  primaryColour:     string;
  secondaryColour:   string;
  accentColour:      string;
  backgroundColour:  string;
  headingColour:     string;
  bodyTextColour:    string;
  buttonColour:      string;
  buttonTextColour:  string;
  headingFont:       string;
  bodyFont:          string;
  navigationLinks:   NavLink[];
  footerLinks:       NavLink[];
  toneOfVoice:       ToneOfVoice;
  contact: {
    phone:   string;
    email:   string;
    address: string;
  };
  confidence: {
    logo:    number;
    colours: number;
    fonts:   number;
    contact: number;
  };
  warnings: string[];
  approved: boolean;
  /** Primary call-to-action label detected on the source site. */
  ctaText?: string;
  /** Primary call-to-action URL detected on the source site. */
  ctaUrl?: string;
  headerBackgroundColour?: string;
  headerTextColour?: string;
  footerBackgroundColour?: string;
  footerTextColour?: string;
  footerLinkColour?: string;
  footerAccentColour?: string;
}

// ── Safe HTTP fetch ───────────────────────────────────────────────────────────

interface FetchResult {
  body:        string;
  finalUrl:    string;
  contentType: string;
  status:      number;
}

async function safeFetch(
  url: string,
  maxBytes  = 1_000_000,
  timeoutMs = 10_000,
  depth     = 0,
): Promise<FetchResult> {
  if (depth > 5) throw new Error("Too many redirects");

  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  const lib = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.get(
      url,
      {
        headers: {
          "User-Agent":      "Mozilla/5.0 (compatible; BrandImporter/1.0)",
          "Accept":          "text/html,text/css,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.9",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if ([301, 302, 303, 307, 308].includes(status)) {
          const loc = res.headers.location;
          res.destroy();
          if (!loc) { reject(new Error("Redirect with no Location")); return; }
          const next = loc.startsWith("http") ? loc : new URL(loc, url).href;
          safeFetch(next, maxBytes, timeoutMs, depth + 1).then(resolve, reject);
          return;
        }

        if (status < 200 || status >= 400) {
          res.destroy();
          reject(new Error(`HTTP ${status} for ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) { res.destroy(); reject(new Error("Response too large")); return; }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            body:        Buffer.concat(chunks).toString("utf8"),
            finalUrl:    url,
            contentType: res.headers["content-type"] ?? "",
            status,
          });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    req.on("error", reject);
  });
}

// ── Colour utilities ──────────────────────────────────────────────────────────

function expandHex(raw: string): string {
  const h = raw.replace(/^#/, "").toLowerCase();
  if (h.length === 3) return h.split("").map(c => c + c).join("");
  return h.slice(0, 6);
}

function hexToRgb(raw: string): { r: number; g: number; b: number } | null {
  const h = expandHex(raw);
  if (h.length !== 6 || !/^[0-9a-f]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function isNeutral(raw: string): boolean {
  const rgb = hexToRgb(raw);
  if (!rgb) return true;
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const lightness  = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  return saturation < 0.12 || lightness > 0.93 || lightness < 0.07;
}

function isDark(raw: string): boolean {
  const rgb = hexToRgb(raw);
  if (!rgb) return false;
  const { r, g, b } = rgb;
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function darken(raw: string, amount = 0.2): string {
  const rgb = hexToRgb(raw);
  if (!rgb) return raw;
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)));
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)));
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function normaliseHex(raw: string): string {
  return "#" + expandHex(raw);
}

const HEX_RE = /#([0-9a-fA-F]{3,6})\b/g;

function allHexInText(text: string): string[] {
  const found: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(HEX_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    if (m[1].length === 3 || m[1].length === 6) {
      found.push("#" + m[1].toLowerCase());
    }
  }
  return found;
}

// ── CSS context extraction ────────────────────────────────────────────────────

interface CssContext {
  selector:   string;
  properties: Map<string, string>;
}

function parseCssRules(css: string): CssContext[] {
  const rules: CssContext[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css)) !== null) {
    const selector = m[1].trim().toLowerCase();
    const body     = m[2];
    const props    = new Map<string, string>();
    const propRe   = /([\w-]+)\s*:\s*([^;]+);?/g;
    let pm: RegExpExecArray | null;
    while ((pm = propRe.exec(body)) !== null) {
      props.set(pm[1].trim().toLowerCase(), pm[2].trim());
    }
    rules.push({ selector, properties: props });
  }
  return rules;
}

function firstHexFrom(value: string): string | null {
  const m = value.match(/#([0-9a-fA-F]{3,6})\b/);
  if (!m) return null;
  if (m[1].length !== 3 && m[1].length !== 6) return null;
  return normaliseHex(m[1]);
}

interface ColourHints {
  primaryColour:    string;
  secondaryColour:  string;
  accentColour:     string;
  backgroundColour: string;
  headingColour:    string;
  bodyTextColour:   string;
  buttonColour:     string;
  buttonTextColour: string;
  headerBackgroundColour: string;
  headerTextColour: string;
  footerBackgroundColour: string;
  footerTextColour: string;
  footerLinkColour: string;
  footerAccentColour: string;
  confidence:       number;
}

function extractColours(css: string): ColourHints {
  const FALLBACK: ColourHints = {
    primaryColour:    "#005EB8",
    secondaryColour:  "#003A6D",
    accentColour:     "#1CA9C9",
    backgroundColour: "#ffffff",
    headingColour:    "#003A6D",
    bodyTextColour:   "#334155",
    buttonColour:     "#005EB8",
    buttonTextColour: "#ffffff",
    headerBackgroundColour: "",
    headerTextColour: "",
    footerBackgroundColour: "",
    footerTextColour: "",
    footerLinkColour: "",
    footerAccentColour: "",
    confidence:       0,
  };

  const rules = parseCssRules(css);

  // Collect candidate colours by context
  const headerBg:  string[] = [];
  const headerTextCol: string[] = [];
  const footerBg: string[] = [];
  const footerTextCol: string[] = [];
  const footerLinkCol: string[] = [];
  const footerAccentCol: string[] = [];
  const btnBg:     string[] = [];
  const linkColor: string[] = [];
  const headingColor: string[] = [];
  const bodyColor: string[] = [];
  const accentCandidates: string[] = [];

  for (const rule of rules) {
    const sel = rule.selector;
    const bg  = rule.properties.get("background-color") || rule.properties.get("background") || "";
    const col = rule.properties.get("color") || "";

    const isHeader = /header|\.nav|^nav\b|\.site-header|\.top-bar|\.navbar/.test(sel);
    const isFooter = /footer|\.site-footer|#site-footer/.test(sel);
    const isBtn    = /\.btn\b|button\b|a\.btn|\.button\b|input\[type.*submit\]/.test(sel);
    const isLink   = /^a\b|^a:/.test(sel);
    const isH      = /^h[123]\b|\.heading|\.title/.test(sel);
    const isBody   = /^body\b/.test(sel);
    const isHero   = /\.hero\b|\.banner\b|\.cta\b|\.cta-band/.test(sel);

    const bgHex = firstHexFrom(bg);
    const colHex = firstHexFrom(col);

    if (isHeader && bgHex && !isNeutral(bgHex)) headerBg.push(bgHex);
    if (isHeader && colHex && !isNeutral(colHex)) headerTextCol.push(colHex);
    if (isFooter && bgHex && !isNeutral(bgHex)) footerBg.push(bgHex);
    if (isFooter && colHex) footerTextCol.push(colHex);
    if (isFooter && isLink && colHex && !isNeutral(colHex)) footerLinkCol.push(colHex);
    if (isFooter && /\.tagline|\.footer-note|\.footer-bottom|\.muted/.test(sel) && colHex) footerAccentCol.push(colHex);
    if ((isHero || isHeader) && bgHex && !isNeutral(bgHex)) accentCandidates.push(bgHex);
    if (isBtn && bgHex && !isNeutral(bgHex))    btnBg.push(bgHex);
    if (isLink && colHex && !isNeutral(colHex)) linkColor.push(colHex);
    if (isH && colHex)   headingColor.push(colHex);
    if (isBody && colHex) bodyColor.push(colHex);
  }

  // Also collect from CSS custom properties
  const cssVarRe = /--([\w-]*(?:primary|brand|accent|color|colour|main|hero|button|btn|heading)[\w-]*)\s*:\s*(#[0-9a-fA-F]{3,6})\b/gi;
  const varMap: Map<string, string> = new Map();
  let vm: RegExpExecArray | null;
  while ((vm = cssVarRe.exec(css)) !== null) {
    const name = vm[1].toLowerCase();
    const val  = normaliseHex(vm[2]);
    varMap.set(name, val);
  }

  // Find primary from CSS vars
  let varPrimary: string | null = null;
  let varSecondary: string | null = null;
  let varAccent: string | null = null;
  let varButton: string | null = null;
  let varHeading: string | null = null;

  for (const [name, val] of varMap.entries()) {
    if (!varPrimary  && /primary/.test(name) && !isNeutral(val))  varPrimary = val;
    if (!varSecondary && /secondary/.test(name) && !isNeutral(val)) varSecondary = val;
    if (!varAccent   && /accent/.test(name) && !isNeutral(val))   varAccent = val;
    if (!varButton   && /btn|button/.test(name) && !isNeutral(val)) varButton = val;
    if (!varHeading  && /heading/.test(name)) varHeading = val;
  }

  // Resolve final values
  const primaryColour   = varPrimary   ?? headerBg[0]   ?? linkColor[0] ?? btnBg[0]   ?? FALLBACK.primaryColour;
  const buttonColour    = varButton    ?? btnBg[0]       ?? primaryColour;
  const secondaryColour = varSecondary ?? darken(primaryColour, 0.25);
  const accentColour    = varAccent    ?? accentCandidates.find(c => c !== primaryColour) ?? FALLBACK.accentColour;
  const headingColour   = varHeading   ?? headingColor[0] ?? darken(primaryColour, 0.3);
  const bodyTextColour  = bodyColor[0] ?? FALLBACK.bodyTextColour;
  const buttonTextColour = isDark(buttonColour) ? "#ffffff" : "#1a1a1a";

  // Confidence: higher if we found values from context
  const found = [primaryColour, buttonColour, headingColour].filter(
    c => c !== FALLBACK.primaryColour && c !== FALLBACK.secondaryColour
  ).length;
  const confidence = Math.min(100, found * 30 + (varMap.size > 0 ? 20 : 0));

  return {
    primaryColour,
    secondaryColour,
    accentColour,
    backgroundColour: "#ffffff",
    headingColour,
    bodyTextColour,
    buttonColour,
    buttonTextColour,
    headerBackgroundColour: headerBg[0] ?? "",
    headerTextColour: headerTextCol[0] ?? "",
    footerBackgroundColour: footerBg[0] ?? "",
    footerTextColour: footerTextCol[0] ?? "",
    footerLinkColour: footerLinkCol[0] ?? footerTextCol[0] ?? "",
    footerAccentColour: footerAccentCol[0] ?? "",
    confidence,
  };
}

function countHexFrequency(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of allHexInText(text)) {
    const hex = normaliseHex(raw.startsWith("#") ? raw.slice(1) : raw);
    if (isNeutral(hex)) continue;
    const key = hex.toUpperCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/** Prefer inline HTML palette (Brook / pharmacy sites) over generic theme CSS. */
function augmentColoursFromHtml(html: string, hints: ColourHints): ColourHints {
  const counts = countHexFrequency(html);
  const pick = (hex: string): string | null => {
    const key = hex.toUpperCase();
    return counts.has(key) ? normaliseHex(key.slice(1)) : null;
  };

  const nhsBlue = pick("#005EB8");
  const amber = pick("#F59E0B");
  const teal = pick("#007A7A");
  const charcoal = pick("#1F2933");
  const slate = pick("#5F6C7B");
  const deepBlue = pick("#004A91") ?? pick("#003087");

  if (nhsBlue) {
    hints.primaryColour = nhsBlue;
    hints.secondaryColour = deepBlue ?? darken(nhsBlue, 0.22);
  }
  if (amber) hints.buttonColour = amber;
  else if (nhsBlue && !hints.buttonColour) hints.buttonColour = nhsBlue;
  if (teal) hints.accentColour = teal;
  if (charcoal) hints.headingColour = charcoal;
  if (slate) hints.bodyTextColour = slate;

  const paletteHits = [nhsBlue, amber, teal, charcoal, slate].filter(Boolean).length;
  if (paletteHits >= 2) {
    hints.confidence = Math.min(100, hints.confidence + paletteHits * 12);
  }

  return hints;
}

function extractCtaFromHtml(html: string, baseUrl: string): { text: string; url: string } {
  const ctaPatterns = [
    /order\s+prescription/i,
    /contact\s+the\s+pharmacy/i,
    /book\s+(?:a\s+)?consultation/i,
    /speak\s+to\s+a\s+pharmacist/i,
  ];

  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text.length > 64) continue;
    if (ctaPatterns.some((p) => p.test(text))) {
      const resolved = resolveUrl(m[1].trim(), baseUrl);
      return { text, url: resolved || m[1].trim() };
    }
  }

  return { text: "", url: "" };
}

// ── Font extraction ───────────────────────────────────────────────────────────

function extractFonts(css: string, html: string): { headingFont: string; bodyFont: string; confidence: number } {
  let headingFont = "";
  let bodyFont    = "";

  // Check Google Fonts link tags
  const gfMatch = html.match(/fonts\.googleapis\.com\/css[^"']*family=([^"'&]+)/i);
  if (gfMatch) {
    const families = decodeURIComponent(gfMatch[1])
      .split("|").map(f => f.split(":")[0].replace(/\+/g, " ").trim());
    if (families.length >= 2) { headingFont = families[0]; bodyFont = families[1]; }
    else if (families.length === 1) { bodyFont = families[0]; headingFont = families[0]; }
  }

  // CSS custom properties
  const rules = parseCssRules(css);
  for (const rule of rules) {
    const ff = rule.properties.get("font-family");
    if (!ff) continue;
    const clean = ff.replace(/['"]/g, "").split(",")[0].trim();
    const sel   = rule.selector;
    if (!headingFont && /^h[123]\b|\.heading/.test(sel)) headingFont = clean;
    if (!bodyFont    && /^body\b/.test(sel))              bodyFont    = clean;
  }

  // CSS var patterns
  const hvMatch = css.match(/--(heading|font-heading|h-font|title-font)[\w-]*\s*:\s*['"]?([^;'"]+)/i);
  if (hvMatch && !headingFont) headingFont = hvMatch[2].split(",")[0].replace(/['"]/g, "").trim();
  const bvMatch = css.match(/--(body|font-body|base-font|text-font)[\w-]*\s*:\s*['"]?([^;'"]+)/i);
  if (bvMatch && !bodyFont) bodyFont = bvMatch[2].split(",")[0].replace(/['"]/g, "").trim();

  // Sanitise: only allow safe web/Google font names
  const safeFontRe = /^[a-zA-Z0-9 \-]+$/;
  if (!safeFontRe.test(headingFont)) headingFont = "";
  if (!safeFontRe.test(bodyFont))    bodyFont    = "";

  const confidence = headingFont || bodyFont ? 70 : 0;
  return { headingFont, bodyFont, confidence };
}

// ── Navigation extraction ─────────────────────────────────────────────────────

const SAFE_NAV_LABELS = new Set([
  "home", "about", "about us", "services", "contact", "contact us",
  "blog", "news", "reviews", "testimonials", "gallery", "areas", "areas covered",
  "faq", "faqs", "team", "work", "portfolio", "projects", "resources",
  "case studies", "case study", "pricing", "get a quote", "request a quote",
]);

const BLOCKED_NAV_PATTERNS = /login|sign.?in|sign.?up|register|cart|checkout|basket|admin|dashboard|account|my profile|cookie|tracking/i;

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return "";
  }
}

function extractNavLinks(html: string, baseUrl: string): NavLink[] {
  const links: NavLink[] = [];
  const seen = new Set<string>();

  // Look in <nav> blocks first, then header
  const navBlockRe = /<(?:nav|header)[^>]*>([\s\S]*?)<\/(?:nav|header)>/gi;
  let nb: RegExpExecArray | null;
  const blocks: string[] = [];
  while ((nb = navBlockRe.exec(html)) !== null) blocks.push(nb[1]);
  const searchArea = blocks.length > 0 ? blocks.join(" ") : html.slice(0, 8000);

  const linkRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(searchArea)) !== null) {
    const href  = lm[1].trim();
    const label = lm[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (!label || label.length > 60)  continue;
    if (BLOCKED_NAV_PATTERNS.test(label)) continue;
    if (href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) continue;
    if (seen.has(label.toLowerCase())) continue;

    const labelLow = label.toLowerCase();
    const isSafe   = SAFE_NAV_LABELS.has(labelLow) || links.length < 8;
    if (!isSafe) continue;

    seen.add(labelLow);
    links.push({ label, href: resolved });
    if (links.length >= 8) break;
  }

  return links;
}

// ── Contact extraction ────────────────────────────────────────────────────────

function extractContactInfo(html: string): { phone: string; email: string; address: string; confidence: number } {
  const phoneRe = /(?:tel:|phone:|call us|telephone:?)?\s*(?:\+44\s?|0)[\d\s\-().]{9,14}\d/gi;
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  const phoneMatch = html.match(phoneRe);
  const emailMatch = html.match(emailRe);

  // Schema.org address
  const addrMatch = html.match(/"streetAddress"\s*:\s*"([^"]+)"/i)
    ?? html.match(/<span[^>]*itemprop="streetAddress"[^>]*>([\s\S]*?)<\/span>/i);

  let phone   = phoneMatch?.[0]?.replace(/tel:|phone:|telephone:/gi, "").trim() ?? "";
  const email = emailMatch?.[0] ?? "";
  const address = addrMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

  // Clean phone number (remove excess whitespace)
  phone = phone.replace(/\s+/g, " ").trim().split("\n")[0];

  const found = [phone, email, address].filter(Boolean).length;
  return { phone, email, address, confidence: Math.min(100, found * 33) };
}

// ── Logo detection ────────────────────────────────────────────────────────────

function extractLogoUrl(html: string, baseUrl: string): { url: string; confidence: number } {
  const base = new URL(baseUrl);
  const businessName = base.hostname.replace(/^www\./, "").split(".")[0].toLowerCase();

  // 1. Schema.org logo
  const schemaLogoMatch = html.match(/"logo"\s*:\s*\{\s*"@type"\s*:\s*"ImageObject"\s*,\s*"url"\s*:\s*"([^"]+)"/i)
    ?? html.match(/"logo"\s*:\s*"([^"]+)"/i);
  if (schemaLogoMatch) {
    const resolved = resolveUrl(schemaLogoMatch[1], baseUrl);
    if (resolved) return { url: resolved, confidence: 95 };
  }

  // 2. img alt containing "logo" or business name
  const imgRe = /<img\s[^>]+>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(html)) !== null) {
    const tag = im[0];
    const altMatch = tag.match(/alt=["']([^"']*)/i);
    const srcMatch = tag.match(/src=["']([^"']+)/i);
    if (!srcMatch) continue;
    const alt = (altMatch?.[1] ?? "").toLowerCase();
    if (alt.includes("logo") || alt.includes(businessName)) {
      const resolved = resolveUrl(srcMatch[1], baseUrl);
      if (resolved) return { url: resolved, confidence: 90 };
    }
  }

  // 3. <header> img
  const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
  if (headerMatch) {
    const hSrc = headerMatch[1].match(/src=["']([^"']+)/i);
    if (hSrc) {
      const resolved = resolveUrl(hSrc[1], baseUrl);
      if (resolved) return { url: resolved, confidence: 60 };
    }
  }

  // 4. Open Graph image as last resort
  const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch) {
    const resolved = resolveUrl(ogMatch[1], baseUrl);
    if (resolved) return { url: resolved, confidence: 30 };
  }

  return { url: "", confidence: 0 };
}

// ── Favicon ───────────────────────────────────────────────────────────────────

function extractFaviconUrl(html: string, baseUrl: string): string {
  const m = html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)/i)
    ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["']/i);
  if (m) return resolveUrl(m[1], baseUrl);
  return resolveUrl("/favicon.ico", baseUrl);
}

// ── Business name ─────────────────────────────────────────────────────────────

function extractBusinessName(html: string): string {
  const ogSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  if (ogSite) return ogSite[1].trim();

  const schemaNm = html.match(/"name"\s*:\s*"([^"]{3,80})"/i);
  if (schemaNm) return schemaNm[1].trim();

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const parts = titleMatch[1].split(/[|\-–—]/);
    return (parts[parts.length - 1] ?? parts[0]).trim().slice(0, 80);
  }
  return "";
}

// ── Tone of voice ─────────────────────────────────────────────────────────────

function extractToneOfVoice(html: string): ToneOfVoice {
  // Strip tags, scripts, styles
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const sample = stripped.slice(0, 2000);
  const words  = sample.split(/\s+/).filter(Boolean);

  const exclamations   = (sample.match(/!/g) ?? []).length;
  const contractions   = (sample.match(/\b(it's|we're|you're|don't|can't|won't|isn't|we've|you'll)\b/gi) ?? []).length;
  const weCount        = (sample.match(/\bwe\b|\bour\b/gi) ?? []).length;
  const youCount       = (sample.match(/\byou\b|\byour\b/gi) ?? []).length;
  const avgSentLen     = words.length / Math.max(1, (sample.match(/[.!?]/g) ?? []).length);

  let formality: ToneOfVoice["formality"] = "professional";
  if (exclamations > 3 || contractions > 5)  formality = "friendly";
  if (avgSentLen > 25 && contractions < 3)   formality = "premium";
  if (exclamations > 6)                       formality = "casual";

  const style = formality === "friendly" || formality === "casual"
    ? "warm and approachable"
    : formality === "premium"
    ? "formal and authoritative"
    : "clear and professional";

  const samplePhrases = stripped
    .split(/[.!?]/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 150)
    .slice(0, 3);

  const notes = [
    weCount > youCount  ? "Brand-centric copy (we/our focused)" : "Customer-centric copy (you/your focused)",
    avgSentLen > 20     ? "Longer sentences — formal style"     : "Short sentences — punchy style",
  ].join(". ");

  return { style, samplePhrases, formality, notes };
}

// ── CSS file URL extraction ───────────────────────────────────────────────────

function extractCssUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null && urls.length < 3) {
    const href = m[1].trim();
    // Skip Google Fonts (CSS-only, no colours) and data URIs
    if (href.startsWith("data:"))             continue;
    if (href.includes("fonts.googleapis.com")) continue;
    const resolved = resolveUrl(href, baseUrl);
    if (resolved) urls.push(resolved);
  }
  return urls;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function importBrandFromUrl(url: string): Promise<BrandProfile> {
  const warnings: string[] = [];

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("URL must start with http:// or https://");
    }
  } catch (e) {
    throw new Error(`Invalid URL: ${url} — ${(e as Error).message}`);
  }

  // Fetch homepage
  let htmlResult: FetchResult;
  try {
    htmlResult = await safeFetch(url, 1_500_000, 12_000);
  } catch (e) {
    throw new Error(`Could not fetch ${url}: ${(e as Error).message}`);
  }

  const html    = htmlResult.body;
  const baseUrl = htmlResult.finalUrl;

  // Fetch CSS files
  const cssUrls  = extractCssUrls(html, baseUrl);
  const cssTexts: string[] = [];
  for (const cssUrl of cssUrls.slice(0, 3)) {
    try {
      const r = await safeFetch(cssUrl, 300_000, 8_000);
      cssTexts.push(r.body);
    } catch {
      warnings.push(`Could not fetch CSS: ${cssUrl}`);
    }
  }
  const allCss = cssTexts.join("\n");

  // Inline <style> blocks
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRe.exec(html)) !== null) cssTexts.push(sm[1]);
  const fullCss = cssTexts.join("\n");

  // Extract everything
  const colours     = augmentColoursFromHtml(html, extractColours(fullCss));
  const fonts       = extractFonts(fullCss, html);
  const logo        = extractLogoUrl(html, baseUrl);
  const faviconUrl  = extractFaviconUrl(html, baseUrl);
  const navLinks    = extractNavLinks(html, baseUrl);
  const footerLinks = (() => {
    const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
    return footerMatch ? extractNavLinks(footerMatch[1], baseUrl) : [];
  })();
  const contactInfo = extractContactInfo(html);
  const tone        = extractToneOfVoice(html);
  const businessName = extractBusinessName(html);
  const ctaHints     = extractCtaFromHtml(html, baseUrl);

  if (!logo.url) warnings.push("Logo could not be detected automatically. Please upload manually.");
  if (colours.confidence < 40) warnings.push("Colour confidence is low. Please review extracted colours.");
  if (navLinks.length === 0) warnings.push("No navigation links detected.");

  return {
    sourceUrl:        url,
    fetchedAt:        new Date().toISOString(),
    businessName,
    logoUrl:          logo.url,
    faviconUrl,
    primaryColour:    colours.primaryColour,
    secondaryColour:  colours.secondaryColour,
    accentColour:     colours.accentColour,
    backgroundColour: colours.backgroundColour,
    headingColour:    colours.headingColour,
    bodyTextColour:   colours.bodyTextColour,
    buttonColour:     colours.buttonColour,
    buttonTextColour: colours.buttonTextColour,
    headerBackgroundColour: colours.headerBackgroundColour || undefined,
    headerTextColour: colours.headerTextColour || undefined,
    footerBackgroundColour: colours.footerBackgroundColour || undefined,
    footerTextColour: colours.footerTextColour || undefined,
    footerLinkColour: colours.footerLinkColour || undefined,
    footerAccentColour: colours.footerAccentColour || undefined,
    headingFont:      fonts.headingFont,
    bodyFont:         fonts.bodyFont,
    navigationLinks:  navLinks,
    footerLinks,
    toneOfVoice:      tone,
    contact:          { phone: contactInfo.phone, email: contactInfo.email, address: contactInfo.address },
    confidence: {
      logo:    logo.confidence,
      colours: colours.confidence,
      fonts:   fonts.confidence,
      contact: contactInfo.confidence,
    },
    warnings,
    approved: false,
    ctaText: ctaHints.text,
    ctaUrl:  ctaHints.url,
  };
}

// ── Brand JS runtime swapper (used by preview route for already-built pages) ──
//
// Generates a small inline <script> that, when injected into a served HTML page,
// swaps the header logo src/alt, header nav links, and footer nav links to match
// the approved brand profile — without requiring a page re-generation.

export function buildBrandJs(profile: BrandProfile): string {
  const logoUrl      = profile.logoUrl      ? JSON.stringify(profile.logoUrl)      : "null";
  const businessName = profile.businessName ? JSON.stringify(profile.businessName) : "null";
  const navLinks     = JSON.stringify(
    (profile.navigationLinks ?? []).map(l => ({ label: l.label, href: l.href }))
  );
  const footerLinks  = JSON.stringify(
    (profile.footerLinks ?? []).map(l => ({ label: l.label, href: l.href }))
  );

  return `<script id="brand-runtime">
(function(){
  var logoUrl=${logoUrl},biz=${businessName},nav=${navLinks},foot=${footerLinks};
  function applyBrand(){
    /* Logo */
    if(logoUrl){
      var img=document.querySelector('#site-header img,header img,.site-header img');
      if(img){img.src=logoUrl;if(biz)img.alt=biz;}
    }
    /* Header nav */
    if(nav&&nav.length){
      var n=document.querySelector('#site-header nav,header nav,.site-header nav');
      if(n){n.innerHTML=nav.map(function(l){
        return '<a href="'+l.href+'">'+l.label+'</a>';
      }).join('');}
    }
    /* Footer nav — second child of footer-grid (the "Links" column) */
    if(foot&&foot.length){
      var fg=document.querySelector('.footer-grid');
      if(fg){
        var col=fg.children[1];
        if(col){col.innerHTML='<h4>Links</h4>'+foot.map(function(l){
          return '<p><a href="'+l.href+'">'+l.label+'</a></p>';
        }).join('');}
      }
    }
    /* Business name text node in footer copyright */
    if(biz){
      var fb=document.querySelector('.footer-bottom');
      if(fb){fb.innerHTML=fb.innerHTML.replace(/(©\s*\d{4}\s+)[^–&<]+/,'\$1'+biz+' ');}
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',applyBrand);
  } else {
    applyBrand();
  }
})();
</script>`;
}

// ── Brand CSS generator (used by renderClusterPage) ───────────────────────────

export function buildBrandCss(profile: BrandProfile): string {
  const { primaryColour, secondaryColour, buttonColour, buttonTextColour, headingColour, headingFont, bodyFont } = profile;

  const fontStack = (f: string) => f ? `'${f}', ` : "";
  const bodyFontStack    = `${fontStack(bodyFont)}-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
  const headingFontStack = `${fontStack(headingFont || bodyFont)}-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;

  return `<style id="brand-override">
/* Brand profile: ${profile.businessName || profile.sourceUrl} */
:root {
  --bp-primary: ${primaryColour};
  --bp-secondary: ${secondaryColour};
  --bp-button: ${buttonColour};
  --bp-button-text: ${buttonTextColour};
  --bp-heading: ${headingColour};
}
body { font-family: ${bodyFontStack}; }
h1, h2, h3, h4, h5 { font-family: ${headingFontStack}; color: ${headingColour}; }
a { color: ${primaryColour}; }
a:hover { color: ${secondaryColour}; }
.btn { background: ${buttonColour} !important; color: ${buttonTextColour} !important; border-color: ${buttonColour} !important; }
.btn:hover { background: ${secondaryColour} !important; border-color: ${secondaryColour} !important; }
.btn-white { color: ${primaryColour} !important; }
.btn-white:hover { color: ${secondaryColour} !important; }
.cta-band { background: linear-gradient(135deg, ${secondaryColour} 0%, ${primaryColour} 60%, ${primaryColour} 100%) !important; }
.section-label { color: ${primaryColour} !important; }
.resource-card h3 { color: ${headingColour} !important; }
</style>`;
}
