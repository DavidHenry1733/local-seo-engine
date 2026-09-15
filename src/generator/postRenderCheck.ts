/**
 * postRenderCheck.ts
 *
 * Post-render smoke check for cluster page HTML.
 *
 * Call runPostRenderCheck() immediately after the HTML file has been written to
 * disk but before any FTP upload. All checks are synchronous, pure
 * string/regex operations — no network, no DOM parsing, no external deps.
 *
 * If any check fails the rollout pipeline should:
 *   1. Log the failures
 *   2. Mark the area as failed
 *   3. Skip the FTP upload for that area
 */

import fs from "node:fs";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PostRenderCheckItem {
  /** Machine-readable identifier, e.g. "no_template_tokens" */
  id: string;
  /** Whether this individual check passed */
  passed: boolean;
  /** Optional detail — describes what was found or missing */
  detail?: string;
}

export interface PostRenderReport {
  /** True only when every check passed */
  passed: boolean;
  /** Ordered list of individual check results */
  checks: PostRenderCheckItem[];
}

export interface PostRenderCheckOptions {
  /**
   * Business/company name to look for in the rendered footer.
   * If omitted, has_footer_content check is skipped.
   */
  companyName?: string;
  /**
   * Email address to look for in the rendered footer (fallback when companyName absent).
   * If omitted together with companyName, has_footer_content check is skipped.
   */
  email?: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function item(
  id:     string,
  passed: boolean,
  detail?: string
): PostRenderCheckItem {
  return { id, passed, detail };
}

/** Check both quoted variants: id="x" and id='x' */
function hasSectionId(html: string, id: string): boolean {
  return html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
}

/** Match a class token inside a class attribute (supports multi-class values). */
function hasClassMarker(html: string, className: string): boolean {
  const re = new RegExp(`class=(["'])[^"']*\\b${className}\\b[^"']*\\1`);
  return re.test(html);
}

function hasRelatedServicesMarker(html: string): boolean {
  return (
    hasSectionId(html, "related-services-section") ||
    hasClassMarker(html, "related-services")
  );
}

function hasAreasWeCoverMarker(html: string): boolean {
  return (
    hasSectionId(html, "areas-we-cover-section") ||
    hasClassMarker(html, "areas-we-cover")
  );
}

type SmokeTemplateProfile = "cluster" | "web-hosting" | "email-marketing";

function detectSmokeTemplateProfile(html: string): SmokeTemplateProfile {
  if (hasSectionId(html, "hosting-features")) return "web-hosting";
  if (
    hasSectionId(html, "email-why-works") ||
    hasSectionId(html, "email-retention") ||
    hasSectionId(html, "email-review-cta")
  ) {
    return "email-marketing";
  }
  return "cluster";
}

// ── Required section IDs ───────────────────────────────────────────────────────

const CLUSTER_REQUIRED_SECTION_IDS: readonly string[] = [
  "hero-section",
  "ai-summary-section",
  "split-section-one",
  "split-section-two",
  "about-section",
  "faq-section",
  "cta-section",
  "trust-strip",
  "site-footer",
] as const;

const WEB_HOSTING_REQUIRED_SECTION_IDS: readonly string[] = [
  "hero-section",
  "hosting-features",
  "whats-included",
  "hosting-security",
  "hosting-comparison",
  "hosting-migration",
  "hosting-review-cta",
  "faq-section",
  "site-footer",
] as const;

const EMAIL_MARKETING_REQUIRED_SECTION_IDS: readonly string[] = [
  "hero-section",
  "email-why-works",
  "email-retention",
  "email-automation",
  "email-deliverability",
  "email-reporting",
  "email-review-cta",
  "faq-section",
  "site-footer",
] as const;

function requiredSectionsForProfile(profile: SmokeTemplateProfile): readonly string[] {
  switch (profile) {
    case "web-hosting":
      return WEB_HOSTING_REQUIRED_SECTION_IDS;
    case "email-marketing":
      return EMAIL_MARKETING_REQUIRED_SECTION_IDS;
    default:
      return CLUSTER_REQUIRED_SECTION_IDS;
  }
}

function missingRequiredSections(html: string, profile: SmokeTemplateProfile): string[] {
  const missing = requiredSectionsForProfile(profile).filter(
    (id) => !hasSectionId(html, id)
  );

  if (profile === "web-hosting" || profile === "email-marketing") {
    if (!hasRelatedServicesMarker(html)) missing.push("related-services");
    if (!hasAreasWeCoverMarker(html)) missing.push("areas-we-cover");
  }

  return missing;
}

// ── Token patterns that must not survive template rendering ───────────────────

const UNREPLACED_TOKEN_RE = /\{\{[^}]+\}\}|%%[^%]+%%/g;

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Run all post-render smoke checks against the given HTML string and file path.
 *
 * @param html     - The fully-rendered HTML string (same content already written)
 * @param filePath - Absolute path where the HTML was written — used for file_written check
 * @param opts     - Optional config values used by content-specific checks
 */
export function runPostRenderCheck(
  html:     string,
  filePath: string,
  opts:     PostRenderCheckOptions = {}
): PostRenderReport {
  const checks: PostRenderCheckItem[] = [];

  // ── A. file_written ─────────────────────────────────────────────────────────
  const fileExists = fs.existsSync(filePath);
  checks.push(item(
    "file_written",
    fileExists,
    fileExists
      ? filePath
      : `File not found on disk after write: ${filePath}`
  ));

  // ── B. no_template_tokens ───────────────────────────────────────────────────
  const tokenMatches = html.match(UNREPLACED_TOKEN_RE);
  const noTokens     = !tokenMatches || tokenMatches.length === 0;
  checks.push(item(
    "no_template_tokens",
    noTokens,
    noTokens
      ? "No unreplaced tokens found"
      : `Found ${tokenMatches!.length} unreplaced token(s): ${
          [...new Set(tokenMatches!)].slice(0, 5).join(", ")
        }`
  ));

  // ── C. required_sections_present ───────────────────────────────────────────
  const templateProfile = detectSmokeTemplateProfile(html);
  const missingSections = missingRequiredSections(html, templateProfile);
  const sectionsOk = missingSections.length === 0;
  checks.push(item(
    "required_sections_present",
    sectionsOk,
    sectionsOk
      ? `All required sections present (${templateProfile} template)`
      : `Missing section IDs (${templateProfile} template): ${missingSections.join(", ")}`
  ));

  // ── D. has_title ────────────────────────────────────────────────────────────
  const titleMatch  = html.match(/<title>([^<]*)<\/title>/i);
  const titleText   = titleMatch?.[1]?.trim() ?? "";
  const hasTitle    = titleText.length > 0;
  checks.push(item(
    "has_title",
    hasTitle,
    hasTitle
      ? `<title>${titleText}</title>`
      : "<title> tag missing or empty"
  ));

  // ── E. has_footer_content ───────────────────────────────────────────────────
  const { companyName, email } = opts;
  if (companyName || email) {
    const companyFound = companyName ? html.includes(companyName) : false;
    const emailFound   = email       ? html.includes(email)       : false;
    const footerOk     = companyFound || emailFound;
    const searched     = [companyName, email].filter(Boolean).join(" or ");
    checks.push(item(
      "has_footer_content",
      footerOk,
      footerOk
        ? `Found: ${companyFound ? companyName : email}`
        : `Neither "${searched}" found in rendered HTML`
    ));
  }

  // ── F. basic_html_structure ─────────────────────────────────────────────────
  const hasHtml = html.includes("<html");
  const hasHead = html.includes("<head");
  const hasBody = html.includes("<body");
  const structureOk = hasHtml && hasHead && hasBody;
  checks.push(item(
    "basic_html_structure",
    structureOk,
    structureOk
      ? "<html>, <head>, <body> all present"
      : [
          !hasHtml ? "missing <html>" : "",
          !hasHead ? "missing <head>" : "",
          !hasBody ? "missing <body>" : "",
        ]
          .filter(Boolean)
          .join(", ")
  ));

  // ── G. who_its_for_card_count ────────────────────────────────────────────────
  const audienceCardCount = (html.match(/class="audience-card"/g) ?? []).length;
  const wifSectionPresent = html.includes('aria-label="Who This Is Best For"');
  if (wifSectionPresent) {
    const wifOk = audienceCardCount === 8;
    checks.push(item(
      "who_its_for_card_count",
      wifOk,
      wifOk
        ? `Who It's For: exactly 8 audience cards`
        : `Who It's For: expected 8 cards, found ${audienceCardCount} — REVIEW_REQUIRED`
    ));
  }

  // ── H. local_relevance_has_heading ───────────────────────────────────────────
  const localRelPresent = html.includes("local-relevance-section");
  if (localRelPresent) {
    const lrSectionMatch = html.match(
      /class=(["'])[^"']*\blocal-relevance-section\b[^"']*\1[\s\S]{0,4000}?<\/section>/
    );
    const lrHasHeading = lrSectionMatch
      ? /<h2[^>]*>[\s\S]+?<\/h2>/.test(lrSectionMatch[0])
      : false;
    checks.push(item(
      "local_relevance_has_heading",
      lrHasHeading,
      lrHasHeading
        ? `Local Relevance section has h2 heading (${templateProfile} template)`
        : `Local Relevance section missing h2 heading (${templateProfile} template) — REVIEW_REQUIRED`
    ));
  }

  // ── I. no_relative_nav_links ────────────────────────────────────────────────
  // Nav links must be absolute URLs (https://…) so they resolve correctly when
  // pages are served from a subdomain. Bare paths like /contact/ or /services/
  // will 404 on subdomain deployments (e.g. local.example.com).
  const navBlockMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
  if (navBlockMatch) {
    const navHtml = navBlockMatch[1];
    const navHrefs = [...navHtml.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    const badNavHrefs = navHrefs.filter(
      (h) => h.startsWith("/") && !h.startsWith("//")
    );
    const navLinksOk = badNavHrefs.length === 0;
    checks.push(item(
      "no_relative_nav_links",
      navLinksOk,
      navLinksOk
        ? "All nav links use absolute URLs"
        : `Relative nav hrefs found (will 404 on subdomain): ${badNavHrefs.slice(0, 5).join(", ")}`
    ));
  }

  // ── Build report ─────────────────────────────────────────────────────────────
  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}
