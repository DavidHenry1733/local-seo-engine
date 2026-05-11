/**
 * prePublishChecker.ts
 *
 * Pre-publish SEO and AI readiness checker.
 * Runs three independently-scored check groups:
 *   Google Ready — technical SEO hygiene
 *   AI Ready     — structure and content for AI/answer engine visibility
 *   Structure    — content quality and conversion integrity
 *
 * Does NOT modify any page generation, sitemap, image deployment, or
 * internal-link logic — pure read-only analysis of rendered HTML.
 *
 * Severity levels:
 *   "pass"     — no issue
 *   "review"   — warning; minor issue; capped at 89 if >2 present
 *   "major"    — major issue; capped at 84; status max = REVIEW
 *   "fail"     — critical; capped at 64; status = FAIL
 */

import * as cheerio from "cheerio";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckLevel = "pass" | "review" | "major" | "fail";
export type CheckCategory = "google" | "ai" | "structure";

export interface PPCheck {
  key:      string;
  level:    CheckLevel;
  message:  string;
  category: CheckCategory;
}

export interface PPReport {
  googleScore:    number;
  aiScore:        number;
  structureScore: number;
  overallScore:   number;
  rawScore:       number;
  capReason:      string;
  status:         "pass" | "review" | "fail";
  wordCount:      number;
  brokenLinks:    number;
  imageIssues:    number;
  schemaIssues:   number;
  criticalCount:  number;
  majorCount:     number;
  warningCount:   number;
  checks:         PPCheck[];
  recommendedFixes: string[];
}

export interface PPInput {
  html:                 string;
  pageSlug:             string;
  expectedCanonicalUrl: string;
  pageType:             "hub" | "cluster";
  primaryKeyword:       string;
  location:             string;
  serviceName:          string;
  imageMode:            string;
  sitemapUrls:          string[];
  /** industryType from the project config — used for industry-aware validation. */
  industryType?:        string;
  /** buyerType from the project config — used for audience-aware validation. */
  buyerType?:           "household" | "business" | "landlord-property" | "mixed";
  /** The project's primary domain — used to flag money-page-band linking to wrong domain. */
  businessDomain?:      string;
  /**
   * Service sub-type from the project config (e.g. "emergency-plumbing").
   * When the value starts with "emergency", the checker verifies that CTAs
   * are call-focused rather than form/quote-request based.
   */
  serviceType?:         string;
  /**
   * The project owner's business name (e.g. "DHM Digital").
   * Used to detect when the agency's own name appears as the service provider
   * in schema on non-digital campaign pages.
   */
  projectBusinessName?: string;
  /**
   * Minimal customer provider profile snapshot — passed from the publish gate
   * and pre-publish QA so the checker can verify an approved profile exists
   * for non-digital campaigns.
   */
  customerProfile?: {
    businessName: string;
    industry:     string;
    approved:     boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function p(key: string, msg: string, cat: CheckCategory): PPCheck {
  return { key, level: "pass",   message: msg, category: cat };
}
function r(key: string, msg: string, cat: CheckCategory): PPCheck {
  return { key, level: "review", message: msg, category: cat };
}
function m(key: string, msg: string, cat: CheckCategory): PPCheck {
  return { key, level: "major",  message: msg, category: cat };
}
function f(key: string, msg: string, cat: CheckCategory): PPCheck {
  return { key, level: "fail",   message: msg, category: cat };
}

function getSchemaTypes(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  const types: string[] = [];
  if (typeof obj["@type"] === "string") {
    types.push(obj["@type"]);
  } else if (Array.isArray(obj["@type"])) {
    types.push(...(obj["@type"] as string[]).filter((t) => typeof t === "string"));
  }
  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"] as unknown[]) {
      types.push(...getSchemaTypes(item));
    }
  }
  return types;
}

// ── A. Google Ready Checks ─────────────────────────────────────────────────

function checkGoogleReady($: cheerio.CheerioAPI, input: PPInput): PPCheck[] {
  const checks: PPCheck[] = [];

  // 1. Title tag
  const titleText = $("title").text().trim();
  if (!titleText) {
    checks.push(f("g.title", "Missing <title> tag", "google"));
  } else if (titleText.length < 20) {
    checks.push(r("g.title", `Title too short (${titleText.length} chars): "${titleText}"`, "google"));
  } else {
    checks.push(p("g.title", `Title found (${titleText.length} chars): "${titleText.slice(0, 60)}${titleText.length > 60 ? "…" : ""}"`, "google"));
  }

  // 2. Meta description
  const metaDesc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!metaDesc) {
    checks.push(f("g.metaDesc", "Missing meta description", "google"));
  } else if (metaDesc.length < 50) {
    checks.push(r("g.metaDesc", `Meta description too short (${metaDesc.length} chars — aim for 120–160)`, "google"));
  } else if (metaDesc.length > 165) {
    checks.push(r("g.metaDesc", `Meta description too long (${metaDesc.length} chars — Google trims at ~160)`, "google"));
  } else {
    checks.push(p("g.metaDesc", `Meta description looks good (${metaDesc.length} chars)`, "google"));
  }

  // 3. Canonical tag
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() ?? "";
  if (!canonical) {
    checks.push(f("g.canonical", "Missing canonical tag", "google"));
  } else if (input.pageSlug && !canonical.includes(input.pageSlug)) {
    checks.push(r("g.canonical", `Canonical "${canonical}" may not match expected slug "/${input.pageSlug}/"`, "google"));
  } else {
    checks.push(p("g.canonical", `Canonical tag found: ${canonical}`, "google"));
  }

  // 4. H1 — must exist, exactly one
  const h1s = $("h1");
  if (h1s.length === 0) {
    checks.push(f("g.h1", "No H1 found — every page must have exactly one H1", "google"));
  } else if (h1s.length > 1) {
    checks.push(r("g.h1", `${h1s.length} H1 elements found — use only one per page`, "google"));
  } else {
    checks.push(p("g.h1", `H1 found: "${h1s.first().text().trim().slice(0, 60)}"`, "google"));
  }

  // 5. No /preview/ links
  const previewLinks = $("a[href]").toArray().filter((el) => {
    const href = (el as { attribs?: Record<string, string> }).attribs?.href ?? "";
    return href.includes("/preview/");
  });
  if (previewLinks.length > 0) {
    checks.push(f("g.previewLinks", `${previewLinks.length} /preview/ link(s) found — must be removed before deployment`, "google"));
  } else {
    checks.push(p("g.previewLinks", "No /preview/ links found", "google"));
  }

  // 6. No placeholder tokens {{...}}
  const rawHtml = $.html();
  const tokenMatches = rawHtml.match(/\{\{[^}]{1,60}\}\}/g) ?? [];
  if (tokenMatches.length > 0) {
    const sample = tokenMatches.slice(0, 3).join(", ");
    checks.push(f("g.placeholders", `${tokenMatches.length} unfilled placeholder(s): ${sample}`, "google"));
  } else {
    checks.push(p("g.placeholders", "No unfilled placeholder tokens found", "google"));
  }

  // 7. No noindex
  const robotsMeta = $('meta[name="robots"]').attr("content")?.toLowerCase() ?? "";
  if (robotsMeta.includes("noindex")) {
    checks.push(f("g.noindex", "noindex meta tag present — page will NOT be indexed by Google", "google"));
  } else {
    checks.push(p("g.noindex", "No noindex meta tag", "google"));
  }

  // 8. JSON-LD schema — WebPage/Service/LocalBusiness
  const schemaScripts = $('script[type="application/ld+json"]');
  if (schemaScripts.length === 0) {
    checks.push(f("g.schema", "No JSON-LD schema blocks found — add WebPage + Service schema", "google"));
  } else {
    const allTypes: string[] = [];
    schemaScripts.each((_, el) => {
      try {
        allTypes.push(...getSchemaTypes(JSON.parse($(el).html() ?? "{}")));
      } catch { /* invalid JSON-LD */ }
    });
    const hasEntitySchema = allTypes.some((t) =>
      ["WebPage", "Service", "LocalBusiness", "Organization", "ProfessionalService"].includes(t)
    );
    const hasFaqSchema = allTypes.some((t) => t.includes("FAQ"));
    if (!hasEntitySchema) {
      checks.push(f("g.schema", `Schema blocks present but no WebPage/Service/LocalBusiness type found (types: ${allTypes.join(", ") || "unknown"})`, "google"));
    } else {
      checks.push(p("g.schema", `Schema valid — types found: ${allTypes.join(", ")}`, "google"));
    }
    if (!hasFaqSchema) {
      // FAQ schema is a warning for Google (not critical — rich results only for gov/health sites)
      checks.push(r("g.schemaFaq", "No FAQPage schema — FAQPage schema can help structure FAQ content, but Google FAQ rich results are limited mainly to authoritative government and health websites. For this system, FAQ schema is recommended for AI/content clarity, not guaranteed rich results.", "google"));
    } else {
      checks.push(p("g.schemaFaq", "FAQPage schema found — improves content structure for AI and search engines", "google"));
    }
  }

  // 9. Images present when required
  if (input.imageMode && input.imageMode !== "skip") {
    const allImgSrcs = $("img").toArray().map((el) =>
      ((el as { attribs?: Record<string, string> }).attribs?.src ?? "").toLowerCase()
    ).filter(Boolean);
    const hasHeroImg  = allImgSrcs.some((s) => s.includes("hero") || s.includes("assets"));
    const hasAnyImg   = allImgSrcs.length > 0;
    if (!hasAnyImg) {
      checks.push(f("g.images", `No images found on page — image mode is "${input.imageMode}"`, "google"));
    } else if (!hasHeroImg) {
      checks.push(r("g.images", `${allImgSrcs.length} image(s) found but no hero/assets image detected`, "google"));
    } else {
      checks.push(p("g.images", `${allImgSrcs.length} image(s) found including hero asset`, "google"));
    }
  }

  // 9b. Phone format in LocalBusiness schema
  schemaScripts.each((_, el) => {
    try {
      const checkSchemaPhone = (obj: Record<string, unknown>): void => {
        if (obj["@type"] === "LocalBusiness" && obj["telephone"]) {
          const phone = String(obj["telephone"]);
          if (phone && !/^[\d\s+\-().]{7,}$/.test(phone)) {
            checks.push(r("g.schemaPhone", `Suspicious telephone value in LocalBusiness schema: "${phone}" — verify before deployment`, "google"));
          }
        }
        if (Array.isArray(obj["@graph"])) {
          for (const item of obj["@graph"] as unknown[]) {
            if (item && typeof item === "object") checkSchemaPhone(item as Record<string, unknown>);
          }
        }
      };
      const schema = JSON.parse($(el).html() ?? "{}") as Record<string, unknown>;
      checkSchemaPhone(schema);
    } catch { /* invalid JSON-LD — schema check already handled above */ }
  });

  // 10. Canonical vs sitemap
  if (input.sitemapUrls.length > 0 && canonical) {
    const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
    const inSitemap = input.sitemapUrls.some((u) => norm(u) === norm(canonical));
    if (!inSitemap) {
      checks.push(r("g.sitemapMatch", `Canonical URL not found in sitemap — verify sitemap is up to date`, "google"));
    } else {
      checks.push(p("g.sitemapMatch", "Canonical URL found in sitemap", "google"));
    }
  }

  return checks;
}

// ── B. AI Ready Checks ────────────────────────────────────────────────────────

function checkAiReady($: cheerio.CheerioAPI, input: PPInput): PPCheck[] {
  const checks: PPCheck[] = [];
  const bodyText = $("body").text().toLowerCase();
  const h1Text   = $("h1").first().text().toLowerCase();
  const actualH1 = $("h1").first().text().trim();

  // 1. Primary keyword must be fully present in H1 — MAJOR for local SEO landing pages
  const kwParts   = input.primaryKeyword.toLowerCase().split(/\s+/);
  const hasAllKw  = kwParts.every((w) => h1Text.includes(w));
  const hasLoc    = input.location ? h1Text.includes(input.location.toLowerCase()) : true;
  if (!hasAllKw) {
    const suggestedH1 = input.primaryKeyword
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    checks.push(m(
      "ai.h1Keyword",
      `Primary keyword "${input.primaryKeyword}" not fully present in H1. Current H1: "${actualH1}". Suggested H1: "${suggestedH1}"`,
      "ai"
    ));
  } else if (!hasLoc && input.location) {
    checks.push(r("ai.h1Location", `Location "${input.location}" not found in H1 — include for local SEO clarity`, "ai"));
  } else {
    checks.push(p("ai.h1Clarity", "Service + location both present in H1", "ai"));
  }

  // 2. Quick answer / summary section near top
  const hasAiSection   = $(`#ai-summary-section`).length > 0;
  const hasQuickAnswer = bodyText.includes("quick answer");
  if (!hasAiSection) {
    checks.push(f("ai.quickAnswer", "Quick answer / AI summary section (#ai-summary-section) not found", "ai"));
  } else if (!hasQuickAnswer) {
    checks.push(r("ai.quickAnswer", "AI summary section found but 'Quick Answer' label missing", "ai"));
  } else {
    checks.push(p("ai.quickAnswer", "Quick answer section found near top", "ai"));
  }

  // 3. Logical H2/H3 heading structure
  const h2Count = $("h2").length;
  const h3Count = $("h3").length;
  if (h2Count < 2) {
    checks.push(r("ai.headingStructure", `Only ${h2Count} H2(s) — aim for 3+ to establish a clear topic structure`, "ai"));
  } else {
    checks.push(p("ai.headingStructure", `${h2Count} H2s and ${h3Count} H3s provide logical hierarchy`, "ai"));
  }

  // 4. FAQ section present
  const hasFaqSection = $(`#faq-section`).length > 0 || $("[class*=faq]").length > 0
    || bodyText.includes("frequently asked") || bodyText.includes("common question");
  if (!hasFaqSection) {
    checks.push(r("ai.faqSection", "No FAQ section found — FAQs significantly improve AI readiness", "ai"));
  } else {
    checks.push(p("ai.faqSection", "FAQ section found", "ai"));
  }

  // 5. FAQPage schema — affects AI Ready more than Google Ready
  //    Severity depends on whether a visible FAQ section exists
  const hasFaqSchema = $('script[type="application/ld+json"]').toArray().some((el) => {
    try {
      const types = getSchemaTypes(JSON.parse($(el).html() ?? "{}"));
      return types.some((t) => t.includes("FAQ"));
    } catch { return false; }
  });
  if (!hasFaqSchema) {
    if (hasFaqSection) {
      // FAQ section exists but no schema — this is a clear gap worth warning about
      checks.push(r(
        "ai.faqSchema",
        "FAQ section found but no FAQPage schema — FAQPage schema can help structure FAQ content for AI extraction. Note: Google FAQ rich results are limited mainly to authoritative government and health sites, but the schema helps AI engines understand your Q&A content.",
        "ai"
      ));
    } else {
      // No FAQ section and no schema — lower priority
      checks.push(r(
        "ai.faqSchema",
        "No FAQPage schema detected. Consider adding a FAQ section with FAQPage schema to improve AI readiness — Google FAQ rich results are limited mainly to government and health sites, but structured FAQ content benefits AI/answer engine visibility.",
        "ai"
      ));
    }
  } else {
    checks.push(p("ai.faqSchema", "FAQPage schema present — improves AI extraction and content clarity", "ai"));
  }

  // 6. Local relevance — location name frequency
  if (input.location) {
    const locLower    = input.location.toLowerCase();
    const locCount    = (bodyText.match(new RegExp(locLower, "g")) ?? []).length;
    if (locCount < 3) {
      checks.push(r("ai.localRelevance", `Location "${input.location}" appears only ${locCount} time(s) — aim for 5+ mentions`, "ai"));
    } else {
      checks.push(p("ai.localRelevance", `Location "${input.location}" mentioned ${locCount} times`, "ai"));
    }
  }

  // 7. Concise answer-style paragraphs
  const paragraphs  = $("main p, .container p, section p").toArray()
    .map((el) => $(el).text().trim())
    .filter((t) => t.length > 40);
  const longParas   = paragraphs.filter((t) => t.split(/\s+/).length > 120);
  if (paragraphs.length > 0 && longParas.length > paragraphs.length * 0.4) {
    checks.push(r("ai.paragraphLength", `${longParas.length}/${paragraphs.length} paragraphs exceed 120 words — break up for better AI scanning`, "ai"));
  } else {
    checks.push(p("ai.paragraphLength", "Paragraph lengths are concise and scan-friendly", "ai"));
  }

  // 8. Business/entity clarity — brand visible near top
  const heroText = ($(`#hero-section`).text() + $(".hero").text()).toLowerCase();
  if (heroText.length < 50) {
    checks.push(r("ai.entityClarity", "Hero section missing or very thin — entity/brand context may be weak for AI", "ai"));
  } else {
    checks.push(p("ai.entityClarity", "Business entity context established in hero section", "ai"));
  }

  return checks;
}

// ── C. Structure Checks ───────────────────────────────────────────────────────

function checkStructure($: cheerio.CheerioAPI, input: PPInput): { checks: PPCheck[]; wordCount: number } {
  const checks: PPCheck[]  = [];
  const bodyText           = $("body").text();
  const words              = bodyText.trim().split(/\s+/).filter(Boolean);
  const wordCount          = words.length;
  const bodyLower          = bodyText.toLowerCase();

  // 1. Thin content
  if (wordCount < 500) {
    checks.push(f("s.thinContent", `Very thin content: ${wordCount} words — minimum is 700`, "structure"));
  } else if (wordCount < 700) {
    checks.push(r("s.thinContent", `Content is lean: ${wordCount} words — aim for 700+`, "structure"));
  } else {
    checks.push(p("s.wordCount", `${wordCount} words — good content volume`, "structure"));
  }

  // 2. CTA present
  const hasCta =
    $(`#cta-section, #enquiry-section, .cta-section`).length > 0 ||
    $("a, button").toArray().some((el) => {
      const t = $(el).text().toLowerCase();
      return (
        t.includes("get a quote") ||
        t.includes("contact us") ||
        t.includes("enquire") ||
        t.includes("book") ||
        t.includes("free quote") ||
        t.includes("get in touch") ||
        t.includes("request")
      );
    });
  if (!hasCta) {
    checks.push(f("s.cta", "No call-to-action (CTA) found — every landing page needs one", "structure"));
  } else {
    checks.push(p("s.cta", "CTA element found on page", "structure"));
  }

  // 3. Local coverage section (map + location reference)
  const hasMapSection  = $(`#map-section`).length > 0 || $("iframe[src*=maps]").length > 0;
  const hasLocationRef = input.location
    ? bodyLower.includes(input.location.toLowerCase())
    : true;
  if (!hasMapSection && !hasLocationRef) {
    checks.push(r("s.localCoverage", "No local coverage detected — add map section and location references", "structure"));
  } else if (!hasMapSection) {
    checks.push(r("s.localCoverage", "No map embed found — adds trust and local coverage for readers", "structure"));
  } else {
    checks.push(p("s.localCoverage", "Local coverage section (map + location content) present", "structure"));
  }

  // 4. Keyword stuffing (density > 5%)
  if (input.primaryKeyword && wordCount > 0) {
    const kwLower     = input.primaryKeyword.toLowerCase();
    const kwWordCount = kwLower.split(/\s+/).length;
    const occurrences = (bodyLower.match(new RegExp(kwLower, "g")) ?? []).length;
    const density     = (occurrences * kwWordCount) / wordCount;
    if (density > 0.06) {
      checks.push(r("s.kwStuffing", `"${input.primaryKeyword}" appears ${occurrences}× (${(density * 100).toFixed(1)}% density) — this may look over-optimised`, "structure"));
    } else {
      checks.push(p("s.kwDensity", `Keyword density looks natural: ${occurrences} mentions (${(density * 100).toFixed(1)}%)`, "structure"));
    }
  }

  // 5. Images with missing alt text
  const imgElements  = $("img").toArray();
  const noAltImgs    = imgElements.filter((el) => {
    const alt = ((el as { attribs?: Record<string, string> }).attribs?.alt ?? "").trim();
    return !alt;
  });
  if (noAltImgs.length > 0) {
    checks.push(r("s.altText", `${noAltImgs.length} image(s) missing alt text — required for accessibility and image SEO`, "structure"));
  } else if (imgElements.length > 0) {
    checks.push(p("s.altText", `All ${imgElements.length} image(s) have alt text`, "structure"));
  }

  // 6. Money-page-band domain check
  // If a .money-page-band link exists, its href must share the same root domain as the project.
  // The money page typically lives on the main brand domain (e.g. brand.com) while SEO pages
  // live on a subdomain (e.g. local.brand.com) — both are valid as long as root domains match.
  const moneyBandLink = $(".money-page-band a[href]").first();
  if (moneyBandLink.length > 0) {
    const moneyHref = moneyBandLink.attr("href") ?? "";
    if (!moneyHref || moneyHref === "/" || moneyHref === "#") {
      checks.push(m("s.moneyPageBand", `Money-page band link is empty or points to root ("/") — set a valid moneyPageUrl or remove the band`, "structure"));
    } else if (input.businessDomain) {
      try {
        const hrefHost   = new URL(moneyHref.startsWith("http") ? moneyHref : `https://placeholder.com${moneyHref}`).hostname;
        const domainHost = new URL(input.businessDomain).hostname;
        /** Strip subdomains — keep last 2 parts (or 3 for two-part TLDs like .co.uk). */
        const rootOf = (h: string): string => {
          const p = h.split(".");
          return p.length >= 3 && p[p.length - 2].length <= 3 ? p.slice(-3).join(".") : p.slice(-2).join(".");
        };
        if (hrefHost && hrefHost !== "placeholder.com" && rootOf(hrefHost) !== rootOf(domainHost)) {
          checks.push(m("s.moneyPageBand", `Money-page band links to "${hrefHost}" but project domain is "${domainHost}" — fix moneyPageUrl or remove the band`, "structure"));
        }
      } catch { /* URL parse failure — skip domain check */ }
    }
  }

  // 7. Buyer-type semantic check (household pages must not use commercial-only language)
  if (input.buyerType === "household") {
    const commercialTerms = [
      "commercial roi",
      "client engagement",
      "business footfall",
      "footfall",
      "b2b enquiries",
      "commercial premises",
      "hospitality venue",
      "business growth through digital",
      "generate enquiries",
      "more enquiries from",
    ];
    const found = commercialTerms.filter((t) => bodyLower.includes(t));
    if (found.length > 0) {
      checks.push(r("s.buyerTypeMismatch", `Household page contains commercial/digital-agency language: "${found.join('", "')}" — review copy for homeowner audience accuracy`, "structure"));
    } else {
      checks.push(p("s.buyerType", "No commercial-only language found on household page", "structure"));
    }
  }

  // 8. Non-digital industry: digital content check (MAJOR)
  // Real-world service pages (landscaping, plumbing, roofing, electrical, clinics etc.)
  // must not contain web-design or digital-marketing language — it signals the AI
  // generated content for the wrong industry and the page must be reviewed/regenerated.
  const digitalIndustryTypes = new Set([
    "web-design", "local-seo", "seo", "web-hosting",
    "email-marketing", "digital-marketing", "ppc", "social-media-marketing",
  ]);
  const isNonDigital = input.industryType && !digitalIndustryTypes.has(input.industryType);
  if (isNonDigital) {
    // Phrases that have no place on a real-world trade/service page
    const digitalLeakTerms = [
      "web design",
      "google rankings",
      "local seo",
      "online visibility",
      "digital marketing",
      "enquiries from your website",
      "website enquiries",
      "conversion-focused website",
      "lead generation website",
      "business growth through digital",
      "map pack",
      "search engine optimisation",
      "search engine optimization",
      "organic traffic",
      "page speed",
      // Extended ban list per spec
      "ai search",
      "ai overview",
      "conversion rate",
      "lead generation",
      "client acquisition",
      "search traffic",
      "mobile responsive",
      "digital presence",
      "marketing strategy",
      "business enquiries",
    ];
    const digitalLeakFound = digitalLeakTerms.filter((t) => bodyLower.includes(t));
    if (digitalLeakFound.length > 0) {
      checks.push(m(
        "s.nonDigitalDigitalContent",
        `Non-digital service page (${input.industryType}) contains digital/web-agency language: "${digitalLeakFound.join('", "')}" — this page reads as marketing-agency copy, not a real-world service page. Regenerate with correct industry/buyer-type settings.`,
        "structure"
      ));
    } else {
      checks.push(p("s.nonDigitalContent", "No digital/web-agency language detected on non-digital service page", "structure"));
    }
  }

  // 9. Non-digital industry mistake language check (website/SEO in Common Mistakes)
  // Trade/home-service pages must not describe website or SEO problems as trade service mistakes.
  if (isNonDigital) {
    const digitalMistakeTerms = [
      "slow page load",
      "slow page speed",
      "poor mobile layout",
      "missing seo",
      "weak seo",
      "no google visibility",
      "low google ranking",
      "website speed",
      "website traffic",
      "google ranking",
      "website mistake",
      "no website",
      "poor website",
    ];
    const digitalMistakesFound = digitalMistakeTerms.filter((t) => bodyLower.includes(t));
    if (digitalMistakesFound.length > 0) {
      checks.push(r("s.industryMistakeMismatch", `Non-digital service page (${input.industryType}) contains website/SEO language in mistake descriptions: "${digitalMistakesFound.join('", "')}" — Common Mistakes must describe trade-service mistakes, not website problems`, "structure"));
    }
  }

  // 10. Provider profile mismatch check (REVIEW)
  // If the page trust strip or body content suggests the business is a digital/marketing
  // agency but the campaign industryType is a real-world trade service, flag for review.
  // This catches the case where DHM Digital or InboxingProWeb is configured as the
  // provider but the campaign is for a plumber, landscaper, etc.
  if (isNonDigital) {
    const agencyPhrases = [
      "provides web design",
      "provides seo",
      "provides digital marketing",
      "provides marketing services",
      "digital agency",
      "marketing agency",
      "seo agency",
      "web design agency",
      "helps businesses rank",
      "helps businesses get",
      "grow your online",
    ];
    const agencyFound = agencyPhrases.filter((t) => bodyLower.includes(t));
    if (agencyFound.length > 0) {
      checks.push(r(
        "s.providerProfileMismatch",
        `Non-digital service page (${input.industryType}) appears to describe a digital/marketing agency as the provider: "${agencyFound.join('", "')}" — check that the project's business profile matches the campaign industry before publishing.`,
        "structure"
      ));
    }
  }

  // 11. Emergency service CTA check (REVIEW)
  // When serviceType indicates an emergency/urgent service, CTAs should be call-focused
  // ("Call Now", "Call an Emergency Plumber") — not form/quote-request based.
  if (input.serviceType?.toLowerCase().startsWith("emergency")) {
    const ctaText = $("a, button").text().toLowerCase();
    const hasCallCta = ctaText.includes("call") || ctaText.includes("phone") || ctaText.includes("ring");
    const hasBusinessQuoteCta = ctaText.includes("quote for your business") || ctaText.includes("request a quote for your");
    if (!hasCallCta) {
      checks.push(r(
        "s.emergencyCtaMissing",
        `Emergency service page (serviceType: ${input.serviceType}) has no call-focused CTA — emergency pages should include "Call Now", "Call an Emergency [Trade]" or similar phone-action CTA alongside any form-based options.`,
        "structure"
      ));
    } else {
      checks.push(p("s.emergencyCtaPresent", `Emergency service page has a call-focused CTA as required for ${input.serviceType}`, "structure"));
    }
    if (hasBusinessQuoteCta) {
      checks.push(r(
        "s.emergencyCtaBusiness",
        `Emergency service page (serviceType: ${input.serviceType}) contains a business-oriented CTA ("quote for your business") — emergency pages should speak to homeowners/householders, not businesses seeking quotes.`,
        "structure"
      ));
    }
  }

  // 12. B2B framing check — automatic failure triggers (MAJOR)
  // The spec ("CRITICAL GENERATION LAW") defines phrases that constitute automatic
  // failure when they appear on non-digital or household pages. These indicate the
  // AI has written for a business audience instead of homeowners/individuals.
  if (isNonDigital || input.buyerType === "household") {
    const b2bFailurePhrases = [
      "for businesses",
      "for companies",
      "for commercial clients",
      "businesses facing",
      "businesses with urgent",
      "businesses that need",
      "support your business",
      "keep your business running",
      "protect operations",
      "minimise downtime for businesses",
      "minimize downtime for businesses",
      "operational disruption",
      "business continuity",
      "commercial risk",
    ];
    const b2bFound = b2bFailurePhrases.filter((t) => bodyLower.includes(t));
    if (b2bFound.length > 0) {
      checks.push(m(
        "s.b2bFramingFailure",
        `Non-digital/household service page contains B2B audience framing: "${b2bFound.join('", "')}" — this page reads as written for businesses, not homeowners. Regenerate: every section must speak to a homeowner, tenant or landlord with a problem at home, not a business.`,
        "structure"
      ));
    } else {
      checks.push(p("s.audienceB2BClean", "No B2B framing phrases detected on household/non-digital service page", "structure"));
    }
  }

  // 13. Schema digital content check
  // JSON-LD schema on non-digital pages must not contain digital/marketing
  // language in description or name fields — it signals the schema was
  // copied from a digital campaign or the schema generator wasn't told the
  // real industry.
  if (isNonDigital) {
    const schemaScripts = $('script[type="application/ld+json"]');
    const schemaTexts: string[] = [];
    schemaScripts.each((_, el) => {
      const raw = $(el).html() ?? "";
      schemaTexts.push(raw.toLowerCase());
    });
    const combinedSchema = schemaTexts.join(" ");
    if (combinedSchema.length > 0) {
      const schemaDigitalTerms = [
        "web design",
        "digital solution",
        "local seo",
        "online visibility",
        "conversion",
        "seo service",
        "search engine",
        "digital marketing",
        "website design",
        "online marketing",
        "lead generation",
        "digital agency",
      ];
      const schemaFound = schemaDigitalTerms.filter((t) => combinedSchema.includes(t));
      if (schemaFound.length > 0) {
        checks.push(r(
          "s.schemaDigitalContent",
          `Schema (JSON-LD) on non-digital service page (${input.industryType}) contains digital/marketing language: "${schemaFound.join('", "')}" — update schema description and name to describe the real trade service.`,
          "structure"
        ));
      } else {
        checks.push(p("s.schemaContent", `Schema description does not contain digital/marketing language for ${input.industryType} page`, "structure"));
      }
    }
  }

  // 13. "businesses" word frequency check (household pages)
  // Household-audience pages should speak to homeowners/individuals.
  // If "businesses" appears more than twice, the page likely drifted into
  // B2B framing (digital-agency copy often targets businesses).
  if (input.buyerType === "household") {
    const businessMatches = (bodyLower.match(/\bBusinesses\b/gi) ?? []).length;
    if (businessMatches > 2) {
      checks.push(r(
        "s.businessesFrequency",
        `Household page contains "businesses" ${businessMatches} times — household audience pages should speak to homeowners/individuals, not businesses. Review and revise copy.`,
        "structure"
      ));
    } else {
      checks.push(p("s.audienceFocus", `"businesses" word count (${businessMatches}) is within acceptable limit for household page`, "structure"));
    }
  }

  // ── Provider / schema identity checks (non-digital campaigns only) ────────────
  //
  // These checks fire when the page's industryType is a non-digital trade
  // service (plumbing, electrical, heating, roofing, landscaping, genericTrade).
  // The goal: prevent a digital-agency identity (e.g. "DHM Digital") from
  // appearing as the service provider in structured data on trade pages.

  if (isNonDigital) {
    // Collect all JSON-LD blocks (we may have already done this above; redo
    // scoped here so these checks are self-contained and readable).
    const allSchemaEls: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      allSchemaEls.push(($(el).html() ?? "").trim());
    });

    // ── 14. s.schemaProviderMissing ─────────────────────────────────────────
    // An approved customer provider profile is REQUIRED before a non-digital
    // campaign page can publish.  Without it the schema will use the project
    // agency's identity, which is wrong for trade-service pages.
    if (!input.customerProfile?.approved) {
      checks.push(m(
        "s.schemaProviderMissing",
        `Non-digital campaign page (${input.industryType ?? "trade"}) has no approved customer service provider profile. ` +
        `Schema is currently using the project agency's details. ` +
        `Create and approve a provider profile for this service to fix the schema, or this page cannot be published. ` +
        `API: PUT /api/provider-profile/<slug>/<serviceKey> then PATCH /approve.`,
        "structure"
      ));
    } else {
      checks.push(p(
        "s.schemaProviderPresent",
        `Approved customer provider profile ("${input.customerProfile.businessName}") found for ${input.industryType} page`,
        "structure"
      ));
    }

    // ── 15. s.schemaProviderDigital ─────────────────────────────────────────
    // If the project-level agency name appears as the provider in a
    // LocalBusiness or Service schema block on a trade page, that is a hard
    // publish blocker.  The agency is not a plumber / electrician / roofer.
    if (input.projectBusinessName && allSchemaEls.length > 0) {
      const agencyLower = input.projectBusinessName.toLowerCase();
      let agencyFound   = false;
      for (const raw of allSchemaEls) {
        if (!raw.toLowerCase().includes(agencyLower)) continue;
        try {
          const parsed   = JSON.parse(raw) as Record<string, unknown>;
          const types    = getSchemaTypes(parsed);
          const isBizType = types.some((t) =>
            ["LocalBusiness","Service","Plumber","Electrician","HVACBusiness",
             "RoofingContractor","LandscapingBusiness"].includes(t)
          );
          if (isBizType) { agencyFound = true; break; }
        } catch { /* malformed JSON-LD — ignore */ }
      }
      if (agencyFound) {
        checks.push(m(
          "s.schemaProviderDigital",
          `Schema provider is "${input.projectBusinessName}" (digital agency) on a ${input.industryType ?? "trade"} page. ` +
          `The schema must reference the actual service provider, not the managing agency. ` +
          `Create an approved provider profile or regenerate the page with the correct industryType.`,
          "structure"
        ));
      } else {
        checks.push(p(
          "s.schemaProviderNotDigital",
          `Schema provider does not reference the project agency on this ${input.industryType ?? "trade"} page`,
          "structure"
        ));
      }
    }

    // ── 16. s.schemaBreadcrumbDomain ────────────────────────────────────────
    // Breadcrumb Home (position 1) must point to the same domain as the page
    // itself (expectedCanonicalUrl).  Pointing to a digital-agency domain
    // (e.g. inboxingproweb.com) from a trade-service page is misleading.
    if (allSchemaEls.length > 0 && input.expectedCanonicalUrl) {
      try {
        const pageHost = new URL(input.expectedCanonicalUrl).hostname;
        for (const raw of allSchemaEls) {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            if (!getSchemaTypes(parsed).includes("BreadcrumbList")) continue;
            const items  = (parsed["itemListElement"] as Array<Record<string, unknown>>) ?? [];
            const home   = items.find((it) => Number(it["position"]) === 1);
            const homeItem = home?.["item"] as string | undefined;
            if (!homeItem) break;
            try {
              const homeHost = new URL(homeItem).hostname;
              if (homeHost !== pageHost) {
                checks.push(r(
                  "s.schemaBreadcrumbDomain",
                  `Breadcrumb Home links to "${homeItem}" (${homeHost}) but the page is on "${pageHost}". ` +
                  `Home breadcrumb should point to the customer's own domain, not the project agency domain.`,
                  "structure"
                ));
              } else {
                checks.push(p(
                  "s.schemaBreadcrumbDomainOk",
                  `Breadcrumb Home domain matches page domain (${pageHost})`,
                  "structure"
                ));
              }
            } catch { /* URL parse fail — skip */ }
            break; // only check the first BreadcrumbList
          } catch { /* malformed JSON-LD */ }
        }
      } catch { /* expectedCanonicalUrl not parseable */ }
    }

    // ── 17. s.schemaPhoneFormat ─────────────────────────────────────────────
    // Stricter than the existing g.schemaPhone check (which only requires a
    // 7-char alphanumeric match).  Trade-service pages must have a real
    // callable phone number with at least 10 digits.  Malformed values like
    // "059) 0 0 60" (only 7 digits) must not pass.
    for (const raw of allSchemaEls) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const types  = getSchemaTypes(parsed);
        const isBizType = types.some((t) =>
          ["LocalBusiness","Plumber","Electrician","HVACBusiness",
           "RoofingContractor","LandscapingBusiness"].includes(t)
        );
        if (!isBizType) continue;
        const phone = parsed["telephone"] as string | undefined;
        if (!phone || typeof phone !== "string") continue;
        const digitCount  = phone.replace(/\D/g, "").length;
        const validFormat = /^[\+0][\d][\d\s\-().]{8,}$/.test(phone.trim());
        if (digitCount < 10 || !validFormat) {
          checks.push(r(
            "s.schemaPhoneFormat",
            `LocalBusiness schema telephone "${phone}" is not a valid phone number ` +
            `(${digitCount} digits found; at least 10 required in standard format). ` +
            `Update the customer provider profile with the correct phone number.`,
            "structure"
          ));
        } else {
          checks.push(p(
            "s.schemaPhoneFormatOk",
            `LocalBusiness telephone "${phone}" has a valid digit count (${digitCount})`,
            "structure"
          ));
        }
        break; // check first matching block only
      } catch { /* malformed JSON-LD */ }
    }
  }

  return { checks, wordCount };
}

// ── Scoring ────────────────────────────────────────────────────────────────────

/**
 * Score a single category, then apply severity-based caps.
 * Returns per-category raw score (before overall cap) — caps applied per-category.
 */
function scoreCategory(checks: PPCheck[], category: CheckCategory): number {
  const relevant = checks.filter((c) => c.category === category);
  if (relevant.length === 0) return 100;

  // Weighted earn: pass=1, review(warning)=0.5, major=0.25, fail(critical)=0
  const earned = relevant.reduce((sum, c) => {
    if (c.level === "pass")   return sum + 1;
    if (c.level === "review") return sum + 0.5;
    if (c.level === "major")  return sum + 0.25;
    return sum; // fail = 0
  }, 0);

  return Math.round((earned / relevant.length) * 100);
}

/**
 * Apply severity caps to a raw score.
 * Returns { capped, reason }
 */
function applyCap(
  rawScore: number,
  criticalCount: number,
  majorCount: number,
  warningCount: number
): { capped: number; reason: string } {
  if (criticalCount > 0) {
    return {
      capped: Math.min(rawScore, 64),
      reason: `Capped at 64 — ${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} present`,
    };
  }
  if (majorCount > 0) {
    return {
      capped: Math.min(rawScore, 84),
      reason: `Capped at 84 — ${majorCount} major issue${majorCount > 1 ? "s" : ""} present`,
    };
  }
  if (warningCount > 2) {
    return {
      capped: Math.min(rawScore, 89),
      reason: `Capped at 89 — ${warningCount} warnings present (more than 2)`,
    };
  }
  return { capped: rawScore, reason: "" };
}

function deriveStatus(checks: PPCheck[]): "pass" | "review" | "fail" {
  const hasCritical = checks.some((c) => c.level === "fail");
  if (hasCritical) return "fail";

  const hasMajor    = checks.some((c) => c.level === "major");
  const hasWarning  = checks.some((c) => c.level === "review");
  if (hasMajor || hasWarning) return "review";

  return "pass";
}

// ── Main export ───────────────────────────────────────────────────────────────

export function runPrePublishCheck(input: PPInput): PPReport {
  const $ = cheerio.load(input.html);

  const googleChecks                      = checkGoogleReady($, input);
  const aiChecks                          = checkAiReady($, input);
  const { checks: structChecks, wordCount } = checkStructure($, input);

  const allChecks = [...googleChecks, ...aiChecks, ...structChecks];

  // Raw per-category scores
  const googleRaw    = scoreCategory(allChecks, "google");
  const aiRaw        = scoreCategory(allChecks, "ai");
  const structRaw    = scoreCategory(allChecks, "structure");
  const overallRaw   = Math.round((googleRaw + aiRaw + structRaw) / 3);

  // Severity counts
  const criticalCount = allChecks.filter((c) => c.level === "fail").length;
  const majorCount    = allChecks.filter((c) => c.level === "major").length;
  const warningCount  = allChecks.filter((c) => c.level === "review").length;

  // Apply global cap based on worst severity across the whole page
  const { capped: overallScore, reason: capReason } = applyCap(
    overallRaw,
    criticalCount,
    majorCount,
    warningCount
  );

  // Apply same cap to per-category scores for consistency
  const { capped: googleScore  } = applyCap(googleRaw,  criticalCount, majorCount, warningCount);
  const { capped: aiScore      } = applyCap(aiRaw,      criticalCount, majorCount, warningCount);
  const { capped: structScore  } = applyCap(structRaw,  criticalCount, majorCount, warningCount);

  const status       = deriveStatus(allChecks);

  const brokenLinks  = 0;
  const imageIssues  = allChecks.filter((c) => c.key.startsWith("g.image") && c.level !== "pass").length;
  const schemaIssues = allChecks.filter((c) => c.key.startsWith("g.schema") && c.level === "fail").length;

  // Top recommended fixes: critical first, then major, then warnings — max 6
  const criticals = allChecks.filter((c) => c.level === "fail").map((c) => `[CRITICAL] ${c.message}`);
  const majors    = allChecks.filter((c) => c.level === "major").map((c) => `[MAJOR] ${c.message}`);
  const warnings  = allChecks.filter((c) => c.level === "review").map((c) => c.message);
  const recommendedFixes = [...criticals, ...majors, ...warnings].slice(0, 6);

  return {
    googleScore,
    aiScore,
    structureScore: structScore,
    overallScore,
    rawScore:       overallRaw,
    capReason,
    status,
    wordCount,
    brokenLinks,
    imageIssues,
    schemaIssues,
    criticalCount,
    majorCount,
    warningCount,
    checks:         allChecks,
    recommendedFixes,
  };
}
