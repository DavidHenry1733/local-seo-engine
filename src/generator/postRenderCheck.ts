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

// ── Required section IDs ───────────────────────────────────────────────────────

const REQUIRED_SECTION_IDS: readonly string[] = [
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
  const missingSections = REQUIRED_SECTION_IDS.filter(
    (id) => !hasSectionId(html, id)
  );
  const sectionsOk = missingSections.length === 0;
  checks.push(item(
    "required_sections_present",
    sectionsOk,
    sectionsOk
      ? `All ${REQUIRED_SECTION_IDS.length} sections present`
      : `Missing section IDs: ${missingSections.join(", ")}`
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

  // ── H. local_relevance_centred ───────────────────────────────────────────────
  const localRelPresent = html.includes("local-relevance-section");
  if (localRelPresent) {
    // Check the section heading is present and contains location-specific text
    const lrSectionMatch = html.match(
      /class="local-relevance-section"[\s\S]{0,2000}?<\/section>/
    );
    const lrHasHeading = lrSectionMatch
      ? /<h2[^>]*>[\s\S]+?<\/h2>/.test(lrSectionMatch[0])
      : false;
    checks.push(item(
      "local_relevance_has_heading",
      lrHasHeading,
      lrHasHeading
        ? "Local Relevance section has h2 heading"
        : "Local Relevance section missing h2 heading — REVIEW_REQUIRED"
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
