/**
 * gateInvariantChecker.ts
 *
 * Additional critical invariant checks for the Final Publish Gate.
 * These complement prePublishChecker.ts with stricter category-level
 * invariants that must never pass when broken.
 *
 * Severity:
 *   "critical" — FAIL_BLOCKED (same as prePublishChecker "fail")
 *   "major"    — REVIEW_REQUIRED (capped at 84)
 *   "warning"  — REVIEW_REQUIRED if >5 (capped at 89)
 */

import * as cheerio from "cheerio";

// ── Types ──────────────────────────────────────────────────────────────────────

export type GateSeverity = "critical" | "major" | "warning";

export interface GateInvariantIssue {
  severity:            GateSeverity;
  category:            string;
  checkKey:            string;
  pageSlug:            string;
  evidence:            string;
  expected:            string;
  actual:              string;
  suggestedFix:        string;
  autoRepairAvailable: boolean;
}

export interface PageImageData {
  libraryId?: string;
  src?:       string;
  alt?:       string;
}

export interface GateInvariantInput {
  html:            string;
  pageSlug:        string;
  pageType:        "hub" | "cluster";
  serviceName:     string;   // e.g. "Web Design"
  serviceKey:      string;   // e.g. "web_design"
  location:        string;   // target city, e.g. "Barnsley"
  businessCity:    string;   // actual business city, e.g. "Rotherham"
  canonicalUrl:    string;   // expected canonical
  moneyPageUrl:    string;   // expected money-page href (or empty string)
  // Optional image library fields — populated when imageLibrary.enabled
  pageImages?:     Record<string, PageImageData>;   // slot → selection
  imageLibraryEnabled?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSchemaBlocks($: cheerio.CheerioAPI): Array<{ raw: string; parsed: unknown; valid: boolean }> {
  return $('script[type="application/ld+json"]').toArray().map((el) => {
    const raw = ($(el).html() ?? "").trim();
    try {
      return { raw, parsed: JSON.parse(raw), valid: true };
    } catch {
      return { raw, parsed: null, valid: false };
    }
  });
}

function flatSchemaTypes(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  const o = obj as Record<string, unknown>;
  const types: string[] = [];
  if (typeof o["@type"] === "string") types.push(o["@type"]);
  else if (Array.isArray(o["@type"])) types.push(...(o["@type"] as string[]).filter(t => typeof t === "string"));
  if (Array.isArray(o["@graph"])) {
    for (const item of o["@graph"] as unknown[]) types.push(...flatSchemaTypes(item));
  }
  return types;
}

function flatSchemaObjects(obj: unknown): Array<Record<string, unknown>> {
  if (!obj || typeof obj !== "object") return [];
  const o = obj as Record<string, unknown>;
  const result: Array<Record<string, unknown>> = [o];
  if (Array.isArray(o["@graph"])) {
    for (const item of o["@graph"] as unknown[]) result.push(...flatSchemaObjects(item));
  }
  return result;
}

function getAddressLocality(obj: Record<string, unknown>): string {
  const addr = obj["address"];
  if (!addr || typeof addr !== "object") return "";
  return ((addr as Record<string, unknown>)["addressLocality"] as string) ?? "";
}

function getServiceArea(obj: Record<string, unknown>): string {
  const sa = obj["areaServed"] ?? obj["serviceArea"];
  if (typeof sa === "string") return sa;
  if (Array.isArray(sa)) return (sa as string[]).join(", ");
  if (sa && typeof sa === "object") {
    return ((sa as Record<string, unknown>)["name"] as string) ?? "";
  }
  return "";
}

// Service name alias map for wrong-service detection in image alt text
const SERVICE_ALIASES: Record<string, string[]> = {
  web_design:  ["web design", "website design", "web designer"],
  web_hosting: ["web hosting", "website hosting", "uk hosting"],
  local_seo:   ["local seo", "seo services", "search engine"],
};

function getServiceTermsFor(serviceKey: string): string[] {
  return SERVICE_ALIASES[serviceKey] ?? [];
}

function otherServiceTerms(serviceKey: string): string[] {
  const others: string[] = [];
  for (const [k, terms] of Object.entries(SERVICE_ALIASES)) {
    if (k !== serviceKey) others.push(...terms);
  }
  return others;
}

// ── E. Content completeness invariants ────────────────────────────────────────

function checkContentInvariants(
  $: cheerio.CheerioAPI,
  input: GateInvariantInput
): GateInvariantIssue[] {
  const issues: GateInvariantIssue[] = [];
  const rawHtml = $.html();
  const bodyText = $("body").text();

  // E1. "visit ." broken sentence fragments
  const visitDotPatterns = [
    /[Vv]isit\s+\./g,
    /[Ff]or more (?:information|insights),?\s+visit\s+\./g,
    /[Ss]ee\s+\./g,
    /[Ll]earn more at\s+\./g,
  ];
  const visitDotMatches: string[] = [];
  for (const pat of visitDotPatterns) {
    const m = bodyText.match(pat) ?? [];
    visitDotMatches.push(...m);
  }
  if (visitDotMatches.length > 0) {
    const sample = visitDotMatches.slice(0, 3).join(", ");
    issues.push({
      severity: "critical",
      category: "E. Content Completeness",
      checkKey: "e.visitDot",
      pageSlug: input.pageSlug,
      evidence: `Broken sentence fragment: "${sample}"`,
      expected: "Complete sentence with a valid URL or no mention",
      actual: `Fragment(s): ${visitDotMatches.length} found`,
      suggestedFix: 'Remove or complete the "visit ." sentence — likely a missing link or unresolved template token',
      autoRepairAvailable: true,
    });
  }

  // E2. Unresolved {{ }} placeholder tokens (supplement prePublishChecker)
  const tokensInBody = bodyText.match(/\{\{[^}]{1,60}\}\}/g) ?? [];
  if (tokensInBody.length > 0) {
    const sample = tokensInBody.slice(0, 3).join(", ");
    issues.push({
      severity: "critical",
      category: "E. Content Completeness",
      checkKey: "e.placeholderToken",
      pageSlug: input.pageSlug,
      evidence: `Unfilled template tokens: ${sample}`,
      expected: "No {{ }} tokens in rendered page",
      actual: `${tokensInBody.length} token(s) found`,
      suggestedFix: "Regenerate this page — template variables were not replaced",
      autoRepairAvailable: false,
    });
  }

  // E3. Bracket-style [placeholder] text
  const bracketPlaceholders = bodyText.match(/\[(?:placeholder|insert|TODO|TBD|CONTENT)[^\]]{0,60}\]/gi) ?? [];
  if (bracketPlaceholders.length > 0) {
    issues.push({
      severity: "critical",
      category: "E. Content Completeness",
      checkKey: "e.bracketPlaceholder",
      pageSlug: input.pageSlug,
      evidence: bracketPlaceholders.slice(0, 3).join(", "),
      expected: "No [placeholder] text in body",
      actual: `${bracketPlaceholders.length} bracket placeholder(s)`,
      suggestedFix: "Replace all [placeholder] text with real content",
      autoRepairAvailable: false,
    });
  }

  // E4. Empty anchor tags (href="" or no href — in body content, not header/footer)
  const emptyHrefAnchors = $("main a, .container a, section a").toArray().filter((el) => {
    const href = ((el as { attribs?: Record<string, string> }).attribs?.href ?? "").trim();
    return href === "" || href === "#";
  });
  if (emptyHrefAnchors.length > 0) {
    const sample = emptyHrefAnchors.slice(0, 3).map((el) => $(el).text().trim().slice(0, 40)).join(", ");
    issues.push({
      severity: "critical",
      category: "E. Content Completeness",
      checkKey: "e.emptyAnchor",
      pageSlug: input.pageSlug,
      evidence: `${emptyHrefAnchors.length} anchor(s) with href="" or href="#" in body content: "${sample}"`,
      expected: "All body anchors must have a valid, non-empty href",
      actual: `${emptyHrefAnchors.length} empty/hash href(s)`,
      suggestedFix: "Fix or remove empty anchor tags — these are dead links",
      autoRepairAvailable: true,
    });
  }

  // E5. Duplicate full paragraphs (exact text, >40 words)
  const paragraphTexts = $("p").toArray()
    .map((el) => $(el).text().trim())
    .filter((t) => t.split(/\s+/).length > 40);
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const t of paragraphTexts) {
    const key = t.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) dupes.add(key);
    else seen.add(key);
  }
  if (dupes.size > 0) {
    issues.push({
      severity: "critical",
      category: "E. Content Completeness",
      checkKey: "e.duplicateParagraph",
      pageSlug: input.pageSlug,
      evidence: `${dupes.size} duplicated paragraph(s) of 40+ words found`,
      expected: "All paragraphs unique",
      actual: `${dupes.size} duplicate paragraph(s)`,
      suggestedFix: "Remove or rewrite duplicate paragraphs",
      autoRepairAvailable: false,
    });
  }

  // E6. AI summary multi-paragraph inside single <p>
  const aiSummarySection = $("#ai-summary-section");
  if (aiSummarySection.length > 0) {
    const aiPs = aiSummarySection.find("p").toArray();
    for (const el of aiPs) {
      const text = $(el).html() ?? "";
      if (text.includes("<br>") || text.includes("<br/>") || text.includes("<br />")) {
        const lineCount = (text.match(/<br\s*\/?>/gi) ?? []).length;
        if (lineCount >= 2) {
          issues.push({
            severity: "critical",
            category: "E. Content Completeness",
            checkKey: "e.aiSummaryMultiPara",
            pageSlug: input.pageSlug,
            evidence: `AI summary <p> contains ${lineCount + 1} paragraphs joined with <br> instead of separate <p> tags`,
            expected: "Each paragraph in its own <p> element",
            actual: `Single <p> with ${lineCount} <br> breaks`,
            suggestedFix: "Split AI summary into separate <p> elements — remove <br> line breaks",
            autoRepairAvailable: true,
          });
          break;
        }
      }
    }
  }

  return issues;
}

// ── F. Schema invariants ───────────────────────────────────────────────────────

function checkSchemaInvariants(
  $: cheerio.CheerioAPI,
  input: GateInvariantInput
): GateInvariantIssue[] {
  const issues: GateInvariantIssue[] = [];
  const blocks = getSchemaBlocks($);

  // F1. Invalid JSON-LD
  const invalidBlocks = blocks.filter((b) => !b.valid);
  if (invalidBlocks.length > 0) {
    issues.push({
      severity: "critical",
      category: "F. Schema",
      checkKey: "f.invalidJsonLd",
      pageSlug: input.pageSlug,
      evidence: `${invalidBlocks.length} JSON-LD script block(s) contain invalid JSON`,
      expected: "All JSON-LD blocks must be valid JSON",
      actual: `${invalidBlocks.length} invalid block(s) — Google will ignore them`,
      suggestedFix: "Validate and fix all JSON-LD script blocks",
      autoRepairAvailable: false,
    });
  }

  const validBlocks = blocks.filter((b) => b.valid);
  const allTypes: string[] = [];
  const allObjects: Array<Record<string, unknown>> = [];
  for (const b of validBlocks) {
    const types = flatSchemaTypes(b.parsed);
    const objs  = flatSchemaObjects(b.parsed);
    allTypes.push(...types);
    allObjects.push(...objs);
  }

  // F2. LocalBusiness schema missing
  const hasLocalBusiness = allTypes.some((t) =>
    ["LocalBusiness", "ProfessionalService", "Organization"].includes(t)
  );
  if (!hasLocalBusiness) {
    issues.push({
      severity: "critical",
      category: "F. Schema",
      checkKey: "f.localBusinessMissing",
      pageSlug: input.pageSlug,
      evidence: `Schema types found: ${allTypes.join(", ") || "none"}`,
      expected: "LocalBusiness or ProfessionalService schema",
      actual: "Missing",
      suggestedFix: "Add LocalBusiness JSON-LD schema with full business address",
      autoRepairAvailable: false,
    });
  }

  // F3. LocalBusiness addressLocality = target city (not actual business city)
  if (hasLocalBusiness && input.businessCity && input.location) {
    const lbObjs = allObjects.filter((o) => {
      const t = o["@type"];
      if (typeof t === "string") return ["LocalBusiness", "ProfessionalService"].includes(t);
      if (Array.isArray(t)) return (t as string[]).some(s => ["LocalBusiness", "ProfessionalService"].includes(s));
      return false;
    });
    for (const lb of lbObjs) {
      const locality = getAddressLocality(lb).toLowerCase().trim();
      const targetCity = input.location.toLowerCase().trim();
      const businessCity = input.businessCity.toLowerCase().trim();
      if (locality && locality === targetCity && businessCity && targetCity !== businessCity) {
        issues.push({
          severity: "critical",
          category: "F. Schema",
          checkKey: "f.localBusinessAddressLocality",
          pageSlug: input.pageSlug,
          evidence: `LocalBusiness addressLocality is "${locality}" (target city, not business city)`,
          expected: `addressLocality should be "${input.businessCity}" (actual business address city)`,
          actual: locality,
          suggestedFix: `Change LocalBusiness addressLocality from "${input.location}" to "${input.businessCity}"`,
          autoRepairAvailable: false,
        });
        break;
      }
    }
  }

  // F4. BreadcrumbList schema missing → major
  const hasBreadcrumb = allTypes.some((t) => t === "BreadcrumbList");
  if (!hasBreadcrumb) {
    issues.push({
      severity: "major",
      category: "F. Schema",
      checkKey: "f.breadcrumbMissing",
      pageSlug: input.pageSlug,
      evidence: `BreadcrumbList not found in schema. Types: ${allTypes.join(", ") || "none"}`,
      expected: "BreadcrumbList schema for navigation context",
      actual: "Missing",
      suggestedFix: "Add BreadcrumbList JSON-LD schema",
      autoRepairAvailable: false,
    });
  }

  // F5. FAQ schema missing when visible FAQ section exists → critical
  const visibleFaqSection = $("#faq-section").length > 0 || $("[class*=faq]").length > 0;
  const hasFaqSchema = allTypes.some((t) => t.includes("FAQ"));
  if (visibleFaqSection && !hasFaqSchema) {
    issues.push({
      severity: "critical",
      category: "F. Schema",
      checkKey: "f.faqSchemaMissing",
      pageSlug: input.pageSlug,
      evidence: "Visible FAQ section found but FAQPage JSON-LD schema is missing",
      expected: "FAQPage schema matching the visible FAQ questions",
      actual: "Missing FAQPage schema",
      suggestedFix: "Add FAQPage JSON-LD schema that matches the visible FAQ questions",
      autoRepairAvailable: false,
    });
  }

  // F6. Visible FAQs but visible FAQ headings are 0 and schema says FAQs → mismatch
  if (!visibleFaqSection && hasFaqSchema) {
    issues.push({
      severity: "major",
      category: "F. Schema",
      checkKey: "f.faqSchemaNoVisibleFaq",
      pageSlug: input.pageSlug,
      evidence: "FAQPage schema present but no visible FAQ section found on page",
      expected: "FAQPage schema should match visible FAQ content",
      actual: "FAQPage schema without visible FAQs",
      suggestedFix: "Add a visible FAQ section or remove the FAQPage schema",
      autoRepairAvailable: false,
    });
  }

  // F7. WebPage URL in schema does not match canonical
  if (input.canonicalUrl) {
    const webPageObjs = allObjects.filter((o) => {
      const t = o["@type"];
      return typeof t === "string"
        ? ["WebPage", "Service"].includes(t)
        : Array.isArray(t) && (t as string[]).some(s => ["WebPage", "Service"].includes(s));
    });
    for (const wp of webPageObjs) {
      const schemaUrl = (wp["url"] as string ?? "").replace(/\/+$/, "");
      const canonical  = input.canonicalUrl.replace(/\/+$/, "");
      if (schemaUrl && canonical && schemaUrl !== canonical) {
        issues.push({
          severity: "major",
          category: "F. Schema",
          checkKey: "f.webPageUrlMismatch",
          pageSlug: input.pageSlug,
          evidence: `Schema URL "${schemaUrl}" does not match canonical "${canonical}"`,
          expected: canonical,
          actual: schemaUrl,
          suggestedFix: "Update the WebPage/Service schema URL to match the canonical URL",
          autoRepairAvailable: false,
        });
        break;
      }
    }
  }

  return issues;
}

// ── G. Map invariants ─────────────────────────────────────────────────────────

const RAW_COORD_PATTERN = /[?&]q=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/;
const GOOGLE_MAPS_SRC   = /maps\.google\.|google\.com\/maps|maps\.app\.goo/;

function checkMapInvariants(
  $: cheerio.CheerioAPI,
  input: GateInvariantInput
): GateInvariantIssue[] {
  const issues: GateInvariantIssue[] = [];

  const mapSection  = $("#map-section");
  const hasMapSection = mapSection.length > 0;

  // G1. Map section missing → critical
  if (!hasMapSection) {
    issues.push({
      severity: "critical",
      category: "G. Map",
      checkKey: "g.mapSectionMissing",
      pageSlug: input.pageSlug,
      evidence: "No #map-section element found in rendered HTML",
      expected: "#map-section with an iframe embed",
      actual: "Missing",
      suggestedFix: "Add a #map-section with a Google Maps iframe using the full business name and address",
      autoRepairAvailable: false,
    });
    return issues; // no point checking further
  }

  // G2. Map iframe missing → critical
  const mapIframes = mapSection.find("iframe").add($("iframe[src*=maps]")).add($("iframe[title*=map]"));
  if (mapIframes.length === 0) {
    issues.push({
      severity: "critical",
      category: "G. Map",
      checkKey: "g.mapIframeMissing",
      pageSlug: input.pageSlug,
      evidence: "#map-section found but contains no <iframe> element",
      expected: "Google Maps iframe inside #map-section",
      actual: "No iframe",
      suggestedFix: "Add a Google Maps iframe with business name + full address as the query",
      autoRepairAvailable: false,
    });
    return issues;
  }

  // G3. Map src uses raw lat/lon coordinates → critical
  const mapSrcs = mapIframes.toArray().map((el) =>
    ((el as { attribs?: Record<string, string> }).attribs?.src ?? "")
  ).filter(Boolean);

  for (const src of mapSrcs) {
    if (RAW_COORD_PATTERN.test(src)) {
      issues.push({
        severity: "critical",
        category: "G. Map",
        checkKey: "g.mapRawCoordinates",
        pageSlug: input.pageSlug,
        evidence: `Map iframe src uses raw lat/lon coordinates: ${src.slice(0, 100)}`,
        expected: "Map query should use business name + full business address",
        actual: "Raw coordinates",
        suggestedFix: `Replace raw coordinates with: ?q=${encodeURIComponent(input.serviceName + " " + input.location)}`,
        autoRepairAvailable: false,
      });
    }
  }

  // G4. Map uses target location as the business address
  // Heuristic: if iframe src contains target city but NOT business city
  if (input.businessCity && input.location && input.businessCity.toLowerCase() !== input.location.toLowerCase()) {
    for (const src of mapSrcs) {
      const srcLower = src.toLowerCase();
      const hasTargetCity   = srcLower.includes(input.location.toLowerCase());
      const hasBusinessCity = srcLower.includes(input.businessCity.toLowerCase());
      if (hasTargetCity && !hasBusinessCity && GOOGLE_MAPS_SRC.test(src)) {
        issues.push({
          severity: "major",
          category: "G. Map",
          checkKey: "g.mapWrongCity",
          pageSlug: input.pageSlug,
          evidence: `Map src mentions "${input.location}" but not the actual business city "${input.businessCity}"`,
          expected: `Map query should include business city "${input.businessCity}" as part of the full address`,
          actual: `Map uses "${input.location}" (target city, not business city)`,
          suggestedFix: `Update map query to use full business address including "${input.businessCity}"`,
          autoRepairAvailable: false,
        });
        break;
      }
    }
  }

  // G5. iframe title missing → major
  for (const el of mapIframes.toArray()) {
    const title = ((el as { attribs?: Record<string, string> }).attribs?.title ?? "").trim();
    if (!title) {
      issues.push({
        severity: "major",
        category: "G. Map",
        checkKey: "g.mapIframeTitleMissing",
        pageSlug: input.pageSlug,
        evidence: "Google Maps iframe has no title attribute",
        expected: "title attribute with business name and location",
        actual: "No title",
        suggestedFix: `Add title="${input.serviceName} location in ${input.location}" to the map iframe`,
        autoRepairAvailable: false,
      });
      break;
    }
  }

  return issues;
}

// ── D. Image invariants ───────────────────────────────────────────────────────

function checkImageInvariants(
  $: cheerio.CheerioAPI,
  input: GateInvariantInput
): GateInvariantIssue[] {
  const issues: GateInvariantIssue[] = [];

  // D1. Wrong-service alt text check (always runs)
  const wrongServiceTerms = otherServiceTerms(input.serviceKey);
  if (wrongServiceTerms.length > 0) {
    const imgsWithAlt = $("img[alt]").toArray().map((el) => ({
      alt: ((el as { attribs?: Record<string, string> }).attribs?.alt ?? "").toLowerCase().trim(),
      src: ((el as { attribs?: Record<string, string> }).attribs?.src ?? ""),
    }));

    for (const img of imgsWithAlt) {
      for (const wrongTerm of wrongServiceTerms) {
        if (img.alt.includes(wrongTerm.toLowerCase())) {
          issues.push({
            severity: "critical",
            category: "D. Images",
            checkKey: "d.wrongServiceAlt",
            pageSlug: input.pageSlug,
            evidence: `Image alt="${img.alt}" mentions "${wrongTerm}" but page service is "${input.serviceName}"`,
            expected: `Alt text should reference "${input.serviceName}", not another service`,
            actual: img.alt,
            suggestedFix: `Change image alt text to reference "${input.serviceName} in ${input.location}"`,
            autoRepairAvailable: false,
          });
          break;
        }
      }
    }
  }

  // D2. Image Library assignment checks (only when library is enabled and pageImages provided)
  if (input.imageLibraryEnabled && input.pageImages) {
    const slots = ["hero", "support", "trust", "conversion"] as const;
    const usedIds: string[] = [];

    for (const slot of slots) {
      const img = input.pageImages[slot];

      // D2a. Missing assignment
      if (!img?.libraryId) {
        issues.push({
          severity: "critical",
          category: "D. Images",
          checkKey: "d.lib.missing",
          pageSlug: input.pageSlug,
          evidence: `No Image Library image assigned for slot "${slot}"`,
          expected: `A library image from service "${input.serviceKey}" assigned to "${slot}"`,
          actual:   "none",
          suggestedFix: `Regenerate this page with the Image Library enabled, or assign a ${slot} image manually`,
          autoRepairAvailable: false,
        });
        continue;
      }

      // D2b. Duplicate image across slots
      if (usedIds.includes(img.libraryId)) {
        issues.push({
          severity: "major",
          category: "D. Images",
          checkKey: "d.lib.duplicate",
          pageSlug: input.pageSlug,
          evidence: `Image "${img.libraryId}" is used in multiple slots on this page`,
          expected: "Each slot should use a unique image",
          actual:   img.libraryId,
          suggestedFix: "Add more images to the library so each slot can use a different image",
          autoRepairAvailable: false,
        });
      } else {
        usedIds.push(img.libraryId);
      }

      // D2c. Alt text must include service name
      if (img.alt) {
        const altLower      = img.alt.toLowerCase();
        const serviceWords  = input.serviceName.toLowerCase().split(/\s+/);
        const serviceInAlt  = serviceWords.every((w) => altLower.includes(w));
        if (!serviceInAlt) {
          issues.push({
            severity: "major",
            category: "D. Images",
            checkKey: "d.lib.altMissingService",
            pageSlug: input.pageSlug,
            evidence: `${slot} image alt "${img.alt}" does not mention service "${input.serviceName}"`,
            expected: `Alt text must include "${input.serviceName}"`,
            actual:   img.alt,
            suggestedFix: "Update the image altTemplate in the library to include {{Service}}",
            autoRepairAvailable: false,
          });
        }

        // D2d. Alt text must include location
        if (!altLower.includes(input.location.toLowerCase())) {
          issues.push({
            severity: "major",
            category: "D. Images",
            checkKey: "d.lib.altMissingLocation",
            pageSlug: input.pageSlug,
            evidence: `${slot} image alt "${img.alt}" does not mention location "${input.location}"`,
            expected: `Alt text must include "${input.location}"`,
            actual:   img.alt,
            suggestedFix: "Ensure the image altTemplate includes {{Location}}",
            autoRepairAvailable: false,
          });
        }
      }
    }
  }

  return issues;
}

// ── Main export ────────────────────────────────────────────────────────────────

export function runGateInvariants(input: GateInvariantInput): GateInvariantIssue[] {
  const $ = cheerio.load(input.html);

  return [
    ...checkContentInvariants($, input),
    ...checkSchemaInvariants($, input),
    ...checkMapInvariants($, input),
    ...checkImageInvariants($, input),
  ];
}
