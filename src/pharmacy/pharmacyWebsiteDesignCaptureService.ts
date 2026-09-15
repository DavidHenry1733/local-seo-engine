/**
 * Playwright-based full-fidelity website design capture.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  emptyWebsiteDesignEvidence,
  type DesignEvidenceColourToken,
  type DesignEvidenceItem,
  type DesignEvidenceNavigationItem,
  type DesignEvidencePageSample,
  type WebsiteDesignEvidence,
  WEBSITE_DESIGN_EVIDENCE_VERSION,
} from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { PHARMACY_WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import { PAGE_DESIGN_EXTRACT_SCRIPT } from "./pharmacyWebsiteDesignExtractScript.ts";
import { computeDesignIntelligenceCompleteness } from "./pharmacyDesignIntelligenceCompletenessService.ts";
import {
  buildDesignIntelligenceManifest,
  navigationTreeToNestedItems,
  validateDesignIntelligenceManifest,
  type RawHierarchyCapture,
} from "./pharmacyDesignIntelligenceHierarchyBuilder.ts";
import type { DesignIntelligenceManifest } from "./pharmacyDesignIntelligenceHierarchyModel.ts";

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const CAPTURE_MAX_TIMEOUT_MS = 45_000;
const CAPTURE_SETTLE_MS = 800;
const CAPTURE_SELECTOR_WAIT_MS = 4_000;
const CAPTURE_LOGO_WAIT_MS = 2_000;
const CAPTURE_REQUIRED_SELECTORS = ["header", "nav", "footer", "body", "main"];
const CAPTURE_LOGO_SELECTORS = ['header img[src], .logo img[src], img[class*="logo" i], a[class*="logo" i] img[src]'];

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeHex(value: string): string {
  const v = str(value).toLowerCase();
  if (!v) return "";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const rgba = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (rgba) {
    const alpha = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1;
    if (alpha === 0) return "";
    const [r, g, b] = rgba.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0"));
    return `#${r}${g}${b}`;
  }
  return v;
}

export interface DesignCapturePageSpec {
  url: string;
  role: DesignEvidencePageSample["role"];
}

export interface WebsiteDesignCaptureOptions {
  slug: string;
  primaryUrl: string;
  pages?: DesignCapturePageSpec[];
  evidenceRoot?: string;
}

function designEvidenceRoot(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", safePharmacySlug(slug));
}

function resolveSamplePages(primaryUrl: string, extraPages: string[]): DesignCapturePageSpec[] {
  const primary = str(primaryUrl).replace(/\/$/, "");
  let origin = primary;
  try {
    origin = new URL(primary).origin;
  } catch {
    /* keep primary */
  }

  const specs: DesignCapturePageSpec[] = [{ url: primary, role: "branch" }];
  const seen = new Set([primary]);

  const candidates: Array<{ url: string; role: DesignEvidencePageSample["role"] }> = [
    { url: `${origin}/`, role: "homepage" },
    { url: `${origin}/all-services/`, role: "services" },
    { url: `${origin}/contact/`, role: "contact" },
    { url: `${origin}/contact-us/`, role: "contact" },
  ];

  for (const page of extraPages) {
    const u = str(page);
    if (u && !seen.has(u)) candidates.unshift({ url: u, role: "shared" });
  }

  for (const candidate of candidates) {
    const normalized = candidate.url.replace(/\/$/, "");
    if (seen.has(normalized) || seen.has(`${normalized}/`)) continue;
    specs.push({ url: candidate.url, role: candidate.role });
    seen.add(normalized);
    if (specs.length >= 4) break;
  }

  return specs.slice(0, 4);
}

async function launchBrowser() {
  const pw = await import("playwright");
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync("/root/.cache/ms-playwright")) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "/root/.cache/ms-playwright";
  }
  return pw.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

type RawCapture = {
  url: string;
  title: string;
  header: Record<string, string> | null;
  footer: Record<string, string> | null;
  footerBackgroundColor?: string;
  topBar: Record<string, string> | null;
  logo: { src: string; width: number; height: number; selector: string; displayWidth?: number; displayHeight?: number } | null;
  navLinks: Array<{ label: string; href: string; level: number; isDropdown: boolean }>;
  buttons: Array<Record<string, string> | null>;
  typography: Record<string, Record<string, string> | null>;
  hero: Record<string, string> | null;
  container: Record<string, string> | null;
  sections: Array<Record<string, string>>;
  cards: Array<Record<string, string>>;
  images: Array<{ url: string; role: string; width: number; height: number; alt: string }>;
  map: { src: string; selector: string; height?: number } | null;
  footerColumnCount: number;
  footerColumns: Array<Record<string, string>>;
  copyrightText?: string;
  footerHeadingFontSize?: string;
  hoursText: string;
  cssVars?: Record<string, string>;
  fontLinks?: string[];
  components?: Array<{ type: string; selector: string; styles: Record<string, string>; childCount: number; children: unknown[] }>;
  layoutMeta?: Record<string, unknown>;
  responsive?: { desktop: { width: number; height: number }; breakpoints: Record<string, string> };
  footerSocialLinks?: Array<{ label: string; href: string }>;
  footerLegalLinks?: Array<{ label: string; href: string }>;
  footerQuickLinks?: Array<{ label: string; href: string }>;
  footerContactText?: string;
  topBarText?: string;
  navigationTree?: RawHierarchyCapture["navigationTree"];
  headerHierarchy?: RawHierarchyCapture["headerHierarchy"];
  footerLayers?: RawHierarchyCapture["footerLayers"];
  colourRoles?: RawHierarchyCapture["colourRoles"];
  imageIntelligence?: RawHierarchyCapture["imageIntelligence"];
};

async function extractPageDesign(page: import("playwright").Page): Promise<RawCapture> {
  return page.evaluate(PAGE_DESIGN_EXTRACT_SCRIPT) as Promise<RawCapture>;
}

async function waitForAnySelector(
  page: import("playwright").Page,
  selectors: string[],
  timeoutMs: number,
): Promise<string | null> {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeoutMs, state: "attached" });
      return selector;
    } catch {
      /* try next selector */
    }
  }
  return null;
}

async function navigateWithBoundedCapture(
  page: import("playwright").Page,
  url: string,
): Promise<{ ok: boolean; error?: string; selectorMatched?: string | null }> {
  let navigationError = "";
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: CAPTURE_MAX_TIMEOUT_MS });
  } catch (err) {
    navigationError = err instanceof Error ? err.message : String(err);
    try {
      await page.goto(url, { waitUntil: "load", timeout: 15_000 });
      navigationError = "";
    } catch (fallbackErr) {
      return {
        ok: false,
        error: fallbackErr instanceof Error ? fallbackErr.message : navigationError || String(fallbackErr),
      };
    }
  }

  await page.waitForTimeout(CAPTURE_SETTLE_MS);
  const selectorMatched = await waitForAnySelector(page, CAPTURE_REQUIRED_SELECTORS, CAPTURE_SELECTOR_WAIT_MS);
  await waitForAnySelector(page, CAPTURE_LOGO_SELECTORS, CAPTURE_LOGO_WAIT_MS);
  return { ok: true, selectorMatched };
}

function persistDesignCaptureArtifacts(
  root: string,
  evidence: WebsiteDesignEvidence,
  designIntelligence?: DesignIntelligenceManifest | Record<string, unknown>,
): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "design-evidence.json"), JSON.stringify(evidence, null, 2));
  const intelligencePayload =
    designIntelligence ||
    ({
      version: "design-intelligence-v1",
      slug: evidence.sourceRevision,
      sourceUrl: evidence.primaryUrl,
      capturedAt: evidence.capturedAt,
      status: evidence.pagesSampled.length ? "partial" : "capture-failed",
      fallbackReason: evidence.warnings.join("; ") || "design-capture-incomplete",
    } satisfies Record<string, unknown>);
  fs.writeFileSync(path.join(root, "design-intelligence.json"), JSON.stringify(intelligencePayload, null, 2));
}

export function designEvidenceHasUsableContent(evidence: WebsiteDesignEvidence | null | undefined): boolean {
  if (!evidence) return false;
  return Boolean(
    evidence.pagesSampled.length ||
      str(evidence.header.logoUrl) ||
      evidence.colourSystem.primary.length ||
      str(evidence.typography.heading.fontFamily) ||
      str(evidence.typography.body.fontFamily) ||
      evidence.navigation.items.length ||
      evidence.buttons.length ||
      evidence.header.navItems.length,
  );
}

function buildColourTokens(raw: RawCapture): WebsiteDesignEvidence["colourSystem"] {
  const collected: DesignEvidenceColourToken[] = [];
  const push = (role: string, value: string, selector: string, prominence: number) => {
    const hex = normalizeHex(value);
    if (!hex || !hex.startsWith("#")) return;
    collected.push({ role, hex, frequency: 1, prominence, source: raw.url, selector, confidence: 85 });
  };

  if (raw.header) {
    push("header-background", raw.header.backgroundColor, raw.header.selector, 90);
    push("header-text", raw.header.color, raw.header.selector, 80);
  }
  if (raw.footer) {
    push("footer-background", raw.footer.backgroundColor, raw.footer.selector, 85);
    push("footer-text", raw.footer.color, raw.footer.selector, 75);
  }
  if (raw.topBar) {
    push("topbar-background", raw.topBar.backgroundColor, raw.topBar.selector, 88);
  }
  for (const btn of raw.buttons || []) {
    if (!btn) continue;
    push("button-background", btn.backgroundColor, btn.selector, 82);
    push("button-text", btn.color, btn.selector, 70);
  }
  for (const [name, value] of Object.entries(raw.cssVars || {})) {
    if (/color|primary|accent|brand|main|theme/i.test(name)) {
      push(`css-var:${name}`, value, ":root", 92);
    }
  }
  for (const link of raw.navLinks || []) {
    void link;
  }
  if (raw.header?.color) push("header-text", raw.header.color, raw.header.selector, 84);

  const byHex = new Map<string, DesignEvidenceColourToken>();
  for (const token of collected) {
    const existing = byHex.get(token.hex);
    if (existing) {
      existing.frequency += 1;
      existing.prominence = Math.max(existing.prominence, token.prominence);
    } else byHex.set(token.hex, { ...token });
  }
  const neutralColours = new Set(["#ffffff", "#fff", "#000000", "#000", "#f5f5f5", "#fafafa"]);
  const ranked = [...byHex.values()]
    .filter((t) => !neutralColours.has(t.hex.toLowerCase()))
    .sort((a, b) => b.prominence - a.prominence || b.frequency - a.frequency);
  const buttonTokens = ranked.filter((t) => t.role.includes("button"));
  const primaryCandidates = ranked.filter((t) => !t.role.includes("text") && !t.role.includes("footer-text"));
  return {
    primary: primaryCandidates.slice(0, 3).length ? primaryCandidates.slice(0, 3) : ranked.slice(0, 3),
    secondary: ranked.slice(3, 6),
    accent: buttonTokens.slice(0, 2).length ? buttonTokens.slice(0, 2) : primaryCandidates.slice(1, 3),
    neutral: ranked.slice(6, 10),
    text: ranked.filter((t) => t.role.includes("text")),
    background: ranked.filter((t) => t.role.includes("background")),
    border: [],
    link: [],
    button: ranked.filter((t) => t.role.includes("button")),
    footer: ranked.filter((t) => t.role.includes("footer")),
    header: ranked.filter((t) => t.role.includes("header") || t.role.includes("topbar")),
  };
}

function item(source: string, selector: string, value: string, role: string, capturedAt: string): DesignEvidenceItem {
  return { source, selector, computedValue: value, confidence: 85, capturedAt, role, property: role };
}

function computeEvidenceCompleteness(values: unknown[]): number {
  if (!values.length) return 0;
  const filled = values.filter((value) => Boolean(str(value))).length;
  return Math.min(100, Math.round((filled / values.length) * 100));
}

export async function captureWebsiteDesignEvidence(options: WebsiteDesignCaptureOptions): Promise<WebsiteDesignEvidence> {
  const slug = safePharmacySlug(options.slug);
  const primaryUrl = str(options.primaryUrl);
  const capturedAt = new Date().toISOString();
  const root = options.evidenceRoot || designEvidenceRoot(slug);
  fs.mkdirSync(root, { recursive: true });

  const evidence = emptyWebsiteDesignEvidence(primaryUrl);
  evidence.capturedAt = capturedAt;
  evidence.sourceRevision = sha256(`${primaryUrl}:${capturedAt}`).slice(0, 16);

  const pageSpecs = resolveSamplePages(primaryUrl, (options.pages || []).map((p) => p.url));
  const captures: Array<{ spec: DesignCapturePageSpec; raw: RawCapture; desktopShot: string; mobileShot: string }> = [];

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    evidence.warnings.push(`Browser launch failed: ${message}`);
    evidence.fallbacks.push({ field: "browser", reason: "launch-failed", fallbackUsed: "none", severity: "critical" });
    persistDesignCaptureArtifacts(root, evidence);
    return evidence;
  }

  try {
    for (const spec of pageSpecs) {
      const page = await browser.newPage();
      try {
        const navigation = await navigateWithBoundedCapture(page, spec.url);
        if (!navigation.ok) {
          evidence.warnings.push(`Page navigation failed for ${spec.url}: ${navigation.error || "unknown"}`);
          evidence.fallbacks.push({
            field: spec.role === "branch" ? "primary-page-navigation" : "secondary-page-navigation",
            reason: navigation.error || "navigation-timeout",
            fallbackUsed: "none",
            severity: spec.role === "branch" ? "critical" : "warning",
          });
          continue;
        }
        if (!navigation.selectorMatched) {
          evidence.warnings.push(`Required DOM selectors not found for ${spec.url}; continuing with partial extraction`);
          evidence.fallbacks.push({
            field: "required-selectors",
            reason: "selector-miss-after-domcontentloaded",
            fallbackUsed: "partial-dom",
            severity: "warning",
          });
        }

        await page.setViewportSize(DESKTOP_VIEWPORT);
        const desktopShot = path.join(root, "screenshots", `${spec.role}-desktop.png`);
        fs.mkdirSync(path.dirname(desktopShot), { recursive: true });
        try {
          await page.screenshot({ path: desktopShot, fullPage: true, timeout: 15_000 });
        } catch (shotErr) {
          evidence.warnings.push(
            `Desktop screenshot failed for ${spec.url}: ${shotErr instanceof Error ? shotErr.message : String(shotErr)}`,
          );
        }

        let raw: RawCapture;
        try {
          raw = await extractPageDesign(page);
        } catch (extractErr) {
          evidence.warnings.push(
            `DOM extraction failed for ${spec.url}: ${extractErr instanceof Error ? extractErr.message : String(extractErr)}`,
          );
          evidence.fallbacks.push({
            field: "dom-extraction",
            reason: "evaluate-failed",
            fallbackUsed: "none",
            severity: spec.role === "branch" ? "critical" : "warning",
          });
          continue;
        }

        await page.setViewportSize(MOBILE_VIEWPORT);
        const mobileShot = path.join(root, "screenshots", `${spec.role}-mobile.png`);
        try {
          await page.screenshot({ path: mobileShot, fullPage: true, timeout: 15_000 });
        } catch (shotErr) {
          evidence.warnings.push(
            `Mobile screenshot failed for ${spec.url}: ${shotErr instanceof Error ? shotErr.message : String(shotErr)}`,
          );
        }
        captures.push({ spec, raw, desktopShot, mobileShot });
      } catch (pageErr) {
        evidence.warnings.push(
          `Page capture failed for ${spec.url}: ${pageErr instanceof Error ? pageErr.message : String(pageErr)}`,
        );
        evidence.fallbacks.push({
          field: spec.role === "branch" ? "primary-page-capture" : "secondary-page-capture",
          reason: pageErr instanceof Error ? pageErr.message : "page-capture-failed",
          fallbackUsed: "none",
          severity: spec.role === "branch" ? "critical" : "warning",
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser?.close();
  }

  if (!captures.length) {
    evidence.warnings.push("No pages captured");
    evidence.fallbacks.push({
      field: "page-capture",
      reason: "all-pages-failed",
      fallbackUsed: "none",
      severity: "critical",
    });
    persistDesignCaptureArtifacts(root, evidence);
    return evidence;
  }

  const branch = captures.find((c) => c.spec.role === "branch")?.raw || captures[0].raw;
  for (const capture of captures) {
    evidence.pagesSampled.push({
      url: capture.spec.url,
      role: capture.spec.role,
      title: capture.raw.title,
      screenshotDesktop: path.relative(PHARMACY_WORKSPACE_ROOT, capture.desktopShot),
      screenshotMobile: path.relative(PHARMACY_WORKSPACE_ROOT, capture.mobileShot),
      viewportDesktop: DESKTOP_VIEWPORT,
      viewportMobile: MOBILE_VIEWPORT,
    });
    evidence.screenshots.push(path.relative(PHARMACY_WORKSPACE_ROOT, capture.desktopShot));
  }

  evidence.colourSystem = buildColourTokens(branch);
  const designIntelligence = buildDesignIntelligenceManifest(
    slug,
    primaryUrl,
    evidence.sourceRevision,
    capturedAt,
    branch as RawHierarchyCapture,
  );
  const navItems = navigationTreeToNestedItems(designIntelligence.navigation.tree);

  evidence.header = {
    rowCount: designIntelligence.header.rowCount,
    hasTopBar: Boolean(designIntelligence.header.announcementBar),
    topBarText: str((branch as { topBarText?: string }).topBarText || ""),
    logoSelector: branch.logo?.selector || designIntelligence.header.logoBlock.selector,
    logoUrl: branch.logo?.src || designIntelligence.header.logoBlock.logoUrl,
    logoMaxHeight: designIntelligence.header.logoBlock.logoMaxHeight || (branch.logo?.displayHeight ? `${Math.round(branch.logo.displayHeight)}px` : ""),
    logoPosition: (designIntelligence.header.logoBlock.logoPosition as "left" | "center" | "right") || "left",
    navPlacement: designIntelligence.header.navigationBlock.navPlacement as "inline" | "below-logo" | "right",
    navItems,
    ctaLabels: designIntelligence.header.ctaBlock.labels,
    ctaHrefs: designIntelligence.header.ctaBlock.hrefs,
    phoneDisplay: "",
    emailDisplay: "",
    backgroundColour: normalizeHex(designIntelligence.header.logoBlock.backgroundColour || branch.header?.backgroundColor || ""),
    textColour: normalizeHex(designIntelligence.header.navigationBlock.textColour || branch.header?.color || ""),
    borderColour: normalizeHex(branch.header?.borderBottom || ""),
    paddingY: designIntelligence.header.spacing.paddingY || branch.header?.paddingTop || "",
    paddingX: designIntelligence.header.spacing.paddingX || branch.header?.paddingLeft || "",
    sticky: designIntelligence.header.sticky,
    desktopBreakpoint: designIntelligence.header.responsive.desktopBreakpoint,
    mobileMenuBehaviour: designIntelligence.header.responsive.mobileMenuBehaviour,
    completeness: computeEvidenceCompleteness([
      branch.header,
      branch.logo?.src,
      branch.header?.backgroundColor,
      branch.header?.color,
      navItems.length,
      branch.topBar,
    ]),
    evidence: [item(branch.url, branch.header?.selector || "header", branch.header?.backgroundColor || "", "header-background", capturedAt)],
  };

  evidence.navigation = {
    items: navItems,
    hierarchyDepth: designIntelligence.navigation.hierarchyDepth,
    completeness: designIntelligence.validation.navigationTreeComplete ? 100 : navItems.length >= 3 ? 75 : 0,
    evidence: designIntelligence.navigation.tree
      .filter((n) => n.role !== "header")
      .map((n) => item(branch.url, n.selector || "nav a", `${n.text}|${n.href}`, n.role, capturedAt)),
  };

  const upperFooterBg = normalizeHex(designIntelligence.footer.upperLayer.backgroundColour);
  const lowerFooterBg = normalizeHex(designIntelligence.footer.lowerLayer.backgroundColour);
  evidence.footer = {
    columnCount: designIntelligence.footer.groups.length || branch.footerColumnCount || 3,
    columnOrder: designIntelligence.footer.mobileStackOrder.length
      ? designIntelligence.footer.mobileStackOrder
      : ["about", "quickLinks", "openingHours", "contact"].slice(0, Math.max(branch.footerColumnCount || 3, 3)),
    logoPlacement: branch.footer ? "brand-column" : "none",
    logoUrl: "",
    backgroundColour: upperFooterBg || normalizeHex(branch.footerBackgroundColor || branch.footer?.backgroundColor || ""),
    textColour: normalizeHex(designIntelligence.footer.upperLayer.textColour || branch.footer?.color || ""),
    linkColour: normalizeHex(designIntelligence.footer.upperLayer.linkColour || branch.footer?.color || ""),
    headingFontSize: branch.footerHeadingFontSize || branch.footerColumns?.[0]?.fontSize || "",
    bodyFontSize: branch.footer?.fontSize || "",
    paddingTop: branch.footer?.paddingTop || "",
    paddingBottom: branch.footer?.paddingBottom || "",
    columnGap: branch.footer?.gap || "",
    socialLinks: (branch.footerSocialLinks || []).map((l: { label: string; href: string }) => ({ label: l.label, href: l.href })),
    legalLinks: (branch.footerLegalLinks || []).map((l: { label: string; href: string }) => ({ label: l.label, href: l.href })),
    quickLinks: (branch.footerQuickLinks || navItems).slice(0, 8).map((l: { label: string; href: string }) => ({ label: l.label, href: l.href })),
    copyrightText: str(branch.copyrightText),
    openingHoursPresent: Boolean(branch.hoursText && /monday|tuesday/i.test(branch.hoursText) && !/elementor-element/.test(branch.hoursText)),
    contactBlockPresent: Boolean(str(branch.footerContactText)),
    mapRelationship: branch.map ? "embedded" : "none",
    mobileStackOrder: ["about", "quickLinks", "openingHours", "contact"],
    completeness: computeEvidenceCompleteness([
      branch.footer,
      branch.footerBackgroundColor || branch.footer?.backgroundColor,
      branch.footer?.color,
      branch.footerColumnCount,
      branch.footerQuickLinks?.length,
      branch.copyrightText,
    ]),
    evidence: [
      item(branch.url, designIntelligence.footer.upperLayer.selector || branch.footer?.selector || "footer#colophon", upperFooterBg, "upper-footer-background", capturedAt),
      item(branch.url, designIntelligence.footer.lowerLayer.selector || "footer-bottom", lowerFooterBg, "lower-footer-background", capturedAt),
    ],
  };

  evidence.typography = {
    body: {
      fontFamily: (branch.typography?.body?.fontFamily || "").split(",")[0]?.replace(/['"]/g, "") || "",
      fallbackStack: branch.typography?.body?.fontFamily || "",
      fontWeight: branch.typography?.body?.fontWeight || "",
      fontStyle: "normal",
      fontSize: branch.typography?.body?.fontSize || "",
      lineHeight: branch.typography?.body?.lineHeight || "",
      letterSpacing: branch.typography?.body?.letterSpacing || "",
      sourceUrl: branch.url,
      loadingMethod: "computed-style",
      substituted: false,
      confidence: branch.typography?.body?.fontFamily ? 90 : 0,
      evidence: [],
    },
    heading: {
      fontFamily: (branch.typography?.h1?.fontFamily || "").split(",")[0]?.replace(/['"]/g, "") || "",
      fallbackStack: branch.typography?.h1?.fontFamily || "",
      fontWeight: branch.typography?.h1?.fontWeight || "",
      fontStyle: "normal",
      fontSize: branch.typography?.h1?.fontSize || "",
      lineHeight: branch.typography?.h1?.lineHeight || "",
      letterSpacing: branch.typography?.h1?.letterSpacing || "",
      sourceUrl: branch.url,
      loadingMethod: "computed-style",
      substituted: false,
      confidence: branch.typography?.h1?.fontFamily ? 88 : 0,
      evidence: [],
    },
    navigation: {
      fontFamily: (branch.typography?.nav?.fontFamily || "").split(",")[0]?.replace(/['"]/g, "") || "",
      fallbackStack: branch.typography?.nav?.fontFamily || "",
      fontWeight: branch.typography?.nav?.fontWeight || "",
      fontStyle: "normal",
      fontSize: branch.typography?.nav?.fontSize || "",
      lineHeight: branch.typography?.nav?.lineHeight || "",
      letterSpacing: branch.typography?.nav?.letterSpacing || "",
      sourceUrl: branch.url,
      loadingMethod: "computed-style",
      substituted: false,
      confidence: branch.typography?.nav?.fontFamily ? 85 : 0,
      evidence: [],
    },
    button: {
      fontFamily: (branch.buttons?.[0]?.fontFamily || "").split(",")[0]?.replace(/['"]/g, "") || "",
      fallbackStack: branch.buttons?.[0]?.fontFamily || "",
      fontWeight: branch.buttons?.[0]?.fontWeight || "",
      fontStyle: "normal",
      fontSize: branch.buttons?.[0]?.fontSize || "",
      lineHeight: branch.buttons?.[0]?.lineHeight || "",
      letterSpacing: branch.buttons?.[0]?.letterSpacing || "",
      sourceUrl: branch.url,
      loadingMethod: "computed-style",
      substituted: false,
      confidence: branch.buttons?.[0]?.fontFamily ? 80 : 0,
      evidence: [],
    },
    footer: {
      fontFamily: (branch.footer?.fontFamily || "").split(",")[0]?.replace(/['"]/g, "") || "",
      fallbackStack: branch.footer?.fontFamily || "",
      fontWeight: branch.footer?.fontWeight || "",
      fontStyle: "normal",
      fontSize: branch.footer?.fontSize || "",
      lineHeight: branch.footer?.lineHeight || "",
      letterSpacing: branch.footer?.letterSpacing || "",
      sourceUrl: branch.url,
      loadingMethod: "computed-style",
      substituted: false,
      confidence: branch.footer?.fontFamily ? 80 : 0,
      evidence: [],
    },
  };

  evidence.buttons = (branch.buttons || []).filter(Boolean).slice(0, 4).map((btn, index) => ({
    role: index === 0 ? ("primary" as const) : ("secondary" as const),
    backgroundColour: normalizeHex(btn!.backgroundColor),
    textColour: normalizeHex(btn!.color),
    borderColour: "",
    borderRadius: btn!.borderRadius,
    paddingX: btn!.paddingLeft,
    paddingY: btn!.paddingTop,
    fontWeight: btn!.fontWeight,
    fontSize: btn!.fontSize,
    hoverBackgroundColour: "",
    selector: btn!.selector,
    confidence: 82,
  }));

  evidence.imagery = (branch.imageIntelligence || branch.images || []).map((img) => ({
    url: "asset" in img ? img.asset : img.url,
    role: img.role,
    aspectRatio: img.aspectRatio || (img.width && img.height ? `${img.width}/${img.height}` : ""),
    width: img.width || 0,
    height: img.height || 0,
  }));

  evidence.map = { present: Boolean(branch.map), embedType: branch.map ? "iframe" : "", selector: branch.map?.selector || "", minHeight: branch.map?.height ? `${branch.map.height}px` : "280px" };
  evidence.openingHours = {
    format: /monday/i.test(branch.hoursText) ? "paragraph" : "unknown",
    selector: "footer|hours",
    rawText: branch.hoursText || "",
  };

  const heroGrid = branch.hero?.gridTemplateColumns || "";
  const heroCols = heroGrid.split(" ").filter(Boolean);
  evidence.cards = (branch.cards || []).slice(0, 8).map((card) => ({
    selector: card.selector || "",
    radius: card.borderRadius || "",
    shadow: card.boxShadow || "",
    padding: card.paddingTop || "",
    gap: card.gap || "",
  }));

  evidence.layout = {
    maxContentWidth:
      (() => {
        const maxW = str(branch.layoutMeta?.containerMaxWidth) || branch.container?.maxWidth || "";
        if (maxW && maxW !== "none") return maxW;
        return str(branch.layoutMeta?.containerWidth) || branch.container?.width || "";
      })(),
    sectionPaddingY: str(branch.layoutMeta?.avgSectionPaddingY) || branch.sections?.[0]?.paddingTop || branch.hero?.paddingTop || "",
    sectionPaddingX: branch.container?.paddingLeft || "",
    gridGap: branch.hero?.gap || branch.container?.gap || "",
    cardRadius: branch.cards?.[0]?.borderRadius || branch.buttons?.[0]?.borderRadius || "",
    cardShadow: str(branch.layoutMeta?.cardShadow) || branch.cards?.[0]?.boxShadow || branch.hero?.boxShadow || "none",
    cardPadding: str(branch.layoutMeta?.cardPadding) || branch.cards?.[0]?.paddingTop || branch.hero?.paddingTop || "0px",
    heroTextRatio: heroCols.length >= 2 ? heroCols[0] : "1fr",
    heroImageRatio: heroCols.length >= 2 ? heroCols[1] : "1fr",
    heroGap: branch.hero?.gap || str(branch.layoutMeta?.heroGap) || "normal",
    heroPaddingY: str(branch.layoutMeta?.heroPaddingY) || branch.hero?.paddingTop || "0px",
    imageAspectRatios: Object.fromEntries(
      (branch.images || []).filter((i) => i.width && i.height).slice(0, 6).map((i) => [i.role, `${i.width}/${i.height}`]),
    ),
    headingScale: {
      h1: branch.typography?.h1?.fontSize || branch.typography?.h2?.fontSize || "",
      h2: branch.typography?.h2?.fontSize || "",
      h3: branch.typography?.h3?.fontSize || "",
      body: branch.typography?.body?.fontSize || "",
    },
    whitespaceDensity: (str(branch.layoutMeta?.whitespaceDensity) as "compact" | "balanced" | "spacious") || "balanced",
    breakpoints: {
      desktop: branch.responsive?.breakpoints?.desktop || `${DESKTOP_VIEWPORT.width}px`,
      tablet: branch.responsive?.breakpoints?.tablet || "768px",
      mobile: branch.responsive?.breakpoints?.mobile || `${MOBILE_VIEWPORT.width}px`,
    },
    completeness: 0,
  };

  const enriched = evidence as WebsiteDesignEvidence & {
    layoutMeta?: Record<string, unknown>;
    typographyDna?: Record<string, unknown>;
    componentModels?: unknown[];
    designIntelligenceCompleteness?: ReturnType<typeof computeDesignIntelligenceCompleteness>;
    designIntelligence?: DesignIntelligenceManifest;
  };
  enriched.designIntelligence = designIntelligence;
  enriched.layoutMeta = branch.layoutMeta || {};
  enriched.typographyDna = {
    h1: branch.typography?.h1,
    h2: branch.typography?.h2,
    h3: branch.typography?.h3,
    h4: branch.typography?.h4,
    h5: branch.typography?.h5,
    h6: branch.typography?.h6,
    body: branch.typography?.body,
    nav: branch.typography?.nav,
    button: branch.typography?.button,
    footer: branch.typography?.footer,
    label: branch.typography?.label,
    fontLinks: branch.fontLinks || [],
  };
  enriched.componentModels = branch.components || [];
  enriched.contactBlocks = str(branch.footerContactText)
    ? [{ type: "contact", selector: "footer", content: str(branch.footerContactText) }]
    : branch.hoursText && /monday|tuesday/i.test(branch.hoursText) && !/elementor-element/.test(branch.hoursText)
      ? [{ type: "opening-hours", selector: "hours", content: branch.hoursText }]
      : [];

  evidence.fallbacks = [];
  if (!branch.logo?.src) {
    evidence.fallbacks.push({ field: "logo", reason: "missing-on-source", fallbackUsed: "none", severity: "critical" });
  }
  if (!branch.typography?.h1?.fontFamily && !branch.typography?.h2?.fontFamily) {
    evidence.fallbacks.push({ field: "typography-heading", reason: "no-h1-h2-computed", fallbackUsed: "body-font", severity: "warning" });
    evidence.typography.heading.substituted = true;
    evidence.typography.heading.substitutionReason = "heading-selector-miss";
  }
  if (!str(enriched.layout.maxContentWidth)) {
    evidence.fallbacks.push({ field: "layout-max-width", reason: "container-not-detected", fallbackUsed: "platform-default", severity: "critical" });
  }

  const completeness = computeDesignIntelligenceCompleteness(enriched);
  enriched.designIntelligenceCompleteness = completeness;
  evidence.header.completeness = completeness.header;
  evidence.footer.completeness = completeness.footer;
  evidence.navigation.completeness = completeness.navigation;
  evidence.layout.completeness = completeness.layout;

  evidence.confidence = {
    overall: completeness.overall,
    logo: branch.logo ? 92 : 0,
    colours: evidence.colourSystem.primary.length ? 90 : 0,
    typography: completeness.typography,
    header: completeness.header,
    footer: completeness.footer,
    navigation: completeness.navigation,
    layout: completeness.layout,
    imagery: completeness.imagery,
  };

  fs.writeFileSync(path.join(root, "design-evidence.json"), JSON.stringify(enriched, null, 2));
  fs.writeFileSync(path.join(root, "design-intelligence.json"), JSON.stringify(designIntelligence, null, 2));
  return enriched;
}

export function getWebsiteDesignIntelligencePath(slug: string): string {
  return path.join(designEvidenceRoot(slug), "design-intelligence.json");
}

export function loadWebsiteDesignIntelligence(slug: string): DesignIntelligenceManifest | null {
  const file = getWebsiteDesignIntelligencePath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as DesignIntelligenceManifest;
  } catch {
    return null;
  }
}

export function validateCapturedDesignIntelligence(slug: string): ReturnType<typeof validateDesignIntelligenceManifest> {
  const manifest = loadWebsiteDesignIntelligence(slug);
  if (!manifest) return { pass: false, failures: ["design-intelligence-missing"] };
  return validateDesignIntelligenceManifest(manifest);
}

export function getWebsiteDesignEvidencePath(slug: string): string {
  return path.join(designEvidenceRoot(slug), "design-evidence.json");
}

export function loadWebsiteDesignEvidence(slug: string): WebsiteDesignEvidence | null {
  const file = getWebsiteDesignEvidencePath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as WebsiteDesignEvidence;
  } catch {
    return null;
  }
}
