/**
 * NT-E2E-25 — Product Owner Quality Audit (read-only review of generated RC1 pages).
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { readFinalRenderManifest } from "./pharmacyCanonicalFinalRenderService.ts";
import { buildCanonicalLocalPagePreviewUrl } from "./pharmacyCanonicalFinalRenderPreviewService.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { countLegacyClusterReferencesInHtml } from "./pharmacyClusterPageUrlResolver.ts";
import type {
  ProductOwnerAuditCategory,
  ProductOwnerAuditVerdict,
  ProductOwnerPageAuditResult,
  ProductOwnerPageCategoryScore,
  ProductOwnerQualityAuditPayload,
  ProductOwnerQualityIssue,
} from "./masterAdminProductOwnerQualityAuditModel.ts";

export const PRODUCT_OWNER_QUALITY_AUDIT_VERSION = "product-owner-quality-audit-v1";
const AUDIT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/product-owner-quality-audit");

const FORBIDDEN_TENANTS = ["pharmaconnect", "banner-cross-pharmacy", "example pharmacy"];
const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /\[insert/i,
  /\bTBC\b/,
  /your pharmacy name/i,
  /placeholder copy/i,
  /coming soon/i,
];
const UNSAFE_CLINICAL = [/guaranteed cure/i, /100% effective/i, /\bmiracle\b/i, /instant relief guaranteed/i];
const CORRUPT_HOURS = /monospace,monospace;font-size:1em/;

const PAGE_LABELS: Record<string, string> = {
  index: "Homepage",
  "pharmacy-first": "Service Hub",
  "pharmacy-first-guide": "Guide",
  "pharmacy-first-faqs": "FAQ",
  "what-is-pharmacy-first": "Blog — What Is Pharmacy First",
  "who-should-consider-pharmacy-first": "Blog — Who Should Consider",
  "pharmacy-first-what-you-need-to-know": "Supporting Page",
  "pharmacy-first-content-ecosystem": "Content Ecosystem Hub",
  "local-cluster-ecclesall": "Cluster — Ecclesall",
  "local-cluster-fulwood": "Cluster — Fulwood",
  "local-cluster-sheffield-city-centre": "Cluster — Sheffield City Centre",
  "local-cluster-broomhill": "Cluster — Broomhill",
  "local-cluster-kelham-island": "Cluster — Kelham Island",
  "local-cluster-dore": "Cluster — Dore",
  "local-cluster-hillsborough": "Cluster — Hillsborough",
  "local-cluster-crookes": "Cluster — Crookes",
};

function auditDir(slug: string): string {
  return path.join(AUDIT_DIR, slug);
}

function latestAuditPath(slug: string): string {
  return path.join(auditDir(slug), "latest.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function verdictFromScore(score: number): ProductOwnerAuditVerdict {
  if (score >= 85) return "PASS";
  if (score >= 65) return "WARNING";
  return "FAIL";
}

function penalty(base: number, amount: number): number {
  return Math.max(0, base - amount);
}

function clusterLocalityFromSlug(pageSlug: string): string {
  return pageSlug.replace(/^local-cluster-/, "").replace(/-/g, " ");
}

function pageLabel(pageSlug: string, pageType: string): string {
  return PAGE_LABELS[pageSlug] || `${pageType}:${pageSlug}`;
}

function auditPageCategories(input: {
  html: string;
  text: string;
  pageSlug: string;
  pageType: string;
  tenantName: string;
  town: string;
  phone: string;
  issues: ProductOwnerQualityIssue[];
}): ProductOwnerPageCategoryScore[] {
  const { html, text, pageSlug, pageType, tenantName, town, phone, issues } = input;
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const desc = $('meta[name="description"]').attr("content")?.trim() || "";
  const schemaCount = $('script[type="application/ld+json"]').length;
  const telLinks = $('a[href^="tel:"]').length;
  const phoneInText = phone && text.replace(/\D/g, "").includes(phone.replace(/\D/g, "").slice(-10));
  const ctaCount = $("a.btn, a.nav-cta, .money-page-band a, a[href^='tel:']").length;
  const internalLinks = $("a[href^='/']").length;
  const brandImg = $("img[src*='brands/'], .brand img").length > 0;
  const hasBrandCss = /--brand-primary|data-pharmacy-template/.test(html);

  const categories: ProductOwnerPageCategoryScore[] = [];

  let brandScore = 100;
  let brandEvidence = "Tenant branding present";
  if (FORBIDDEN_TENANTS.some((t) => html.toLowerCase().includes(t))) {
    brandScore = 0;
    brandEvidence = "Wrong tenant reference detected";
    issues.push({
      severity: "critical",
      code: "wrong-tenant",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "brand",
      message: "Wrong tenant content detected",
      evidence: FORBIDDEN_TENANTS.find((t) => html.toLowerCase().includes(t)) || "foreign tenant",
      recommendedFix: "Replace foreign tenant references with Reliable Direct Pharmacy content",
    });
  } else if (!text.toLowerCase().includes(tenantName.toLowerCase().replace(/\s+/g, " "))) {
    brandScore = penalty(brandScore, 25);
    brandEvidence = "Tenant name weak or absent in body";
    issues.push({
      severity: "major",
      code: "weak-tenant-branding",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "brand",
      message: "Tenant name not prominent in page body",
      evidence: `Expected "${tenantName}" in visible copy`,
      recommendedFix: "Strengthen pharmacy name in hero or intro copy",
    });
  }
  if (!brandImg) brandScore = penalty(brandScore, 15);
  if (!hasBrandCss) brandScore = penalty(brandScore, 10);
  categories.push({
    category: "brand",
    score: brandScore,
    verdict: verdictFromScore(brandScore),
    evidence: brandEvidence,
  });

  let commercialScore = 100;
  let commercialEvidence = "Commercial CTAs present";
  if (ctaCount < 1) {
    commercialScore = 20;
    commercialEvidence = "No visible CTA";
    issues.push({
      severity: "critical",
      code: "broken-cta",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "commercial",
      message: "No call-to-action found",
      evidence: "Zero CTA buttons or booking links",
      recommendedFix: "Add book/call CTA above the fold and in conversion band",
    });
  } else if (telLinks === 0 && !phoneInText && /service|cluster|homepage/.test(pageType)) {
    commercialScore = penalty(commercialScore, 20);
    commercialEvidence = "Phone visible but not linked as tel: CTA";
    issues.push({
      severity: "minor",
      code: "phone-not-clickable",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "commercial",
      message: "Phone number not wired as tel: link",
      evidence: "Display-only phone without href=\"tel:\"",
      recommendedFix: "Wrap displayed phone numbers in tel: links",
    });
  }
  if (!/book|appointment|call|0114/i.test(text) && /service|cluster|homepage/.test(pageType)) {
    commercialScore = penalty(commercialScore, 15);
    issues.push({
      severity: "major",
      code: "weak-commercial-messaging",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "commercial",
      message: "Weak booking or contact messaging",
      evidence: "No clear book/call instruction in body",
      recommendedFix: "Add explicit booking instruction tied to Pharmacy First",
    });
  }
  categories.push({
    category: "commercial",
    score: commercialScore,
    verdict: verdictFromScore(commercialScore),
    evidence: commercialEvidence,
  });

  let clinicalScore = 100;
  let clinicalEvidence = "No unsafe clinical claims detected";
  for (const pattern of UNSAFE_CLINICAL) {
    if (pattern.test(text)) {
      clinicalScore = 0;
      clinicalEvidence = "Unsafe clinical claim detected";
      issues.push({
        severity: "critical",
        code: "unsafe-clinical",
        pageSlug,
        pageLabel: pageLabel(pageSlug, pageType),
        category: "clinical",
        message: "Unsafe clinical wording",
        evidence: pattern.source,
        recommendedFix: "Remove absolute cure/guarantee language; use NHS-appropriate pharmacist assessment wording",
      });
      break;
    }
  }
  if (/pharmacy first|nhs/i.test(text)) clinicalScore = Math.min(100, clinicalScore + 0);
  categories.push({
    category: "clinical",
    score: clinicalScore,
    verdict: verdictFromScore(clinicalScore),
    evidence: clinicalEvidence,
  });

  let seoScore = 100;
  let seoEvidence = "Core SEO metadata present";
  if (!title) {
    seoScore = penalty(seoScore, 40);
    seoEvidence = "Missing title";
    issues.push({
      severity: "major",
      code: "missing-title",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "seo",
      message: "Missing page title",
      evidence: "<title> empty",
      recommendedFix: "Add unique title with service, area and pharmacy name",
    });
  }
  if (!desc) {
    seoScore = penalty(seoScore, 25);
    seoEvidence = seoEvidence === "Core SEO metadata present" ? "Missing meta description" : `${seoEvidence}; missing meta description`;
    issues.push({
      severity: "major",
      code: "missing-meta-description",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "seo",
      message: "Missing meta description",
      evidence: 'meta[name="description"] absent',
      recommendedFix: "Add unique meta description for this page type",
    });
  }
  if (schemaCount === 0 && /service|cluster|homepage|guide|faq|blog|support/.test(pageType)) {
    seoScore = penalty(seoScore, 20);
    issues.push({
      severity: "major",
      code: "missing-schema",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "seo",
      message: "Missing structured data",
      evidence: "No application/ld+json block",
      recommendedFix: "Add WebPage or FAQ schema appropriate to page type",
    });
  }
  categories.push({
    category: "seo",
    score: seoScore,
    verdict: verdictFromScore(seoScore),
    evidence: seoEvidence,
  });

  let localScore = 100;
  let localEvidence = "Localisation not required for this page type";
  if (/cluster|service|homepage|hub/.test(pageType)) {
    localEvidence = "Town and locality signals present";
    if (!text.includes(town)) {
      localScore = penalty(localScore, 40);
      localEvidence = `Town "${town}" absent`;
      issues.push({
        severity: "critical",
        code: "wrong-town",
        pageSlug,
        pageLabel: pageLabel(pageSlug, pageType),
        category: "localisation",
        message: "Wrong or missing town",
        evidence: `Expected town "${town}" in visible copy`,
        recommendedFix: "Reference Sheffield consistently in local copy",
      });
    }
    if (pageType === "location-cluster") {
      const locality = clusterLocalityFromSlug(pageSlug);
      const localityToken = locality.split(" ")[0].toLowerCase();
      const h1 = $("h1").first().text().toLowerCase();
      if (!h1.includes(localityToken) && !text.toLowerCase().includes(localityToken)) {
        localScore = penalty(localScore, 35);
        issues.push({
          severity: "critical",
          code: "wrong-locality",
          pageSlug,
          pageLabel: pageLabel(pageSlug, pageType),
          category: "localisation",
          message: "Cluster page missing target locality",
          evidence: `Expected "${locality}" in H1 or body`,
          recommendedFix: "Ensure cluster H1 and intro reference the approved area name",
        });
      }
    }
  }
  categories.push({
    category: "localisation",
    score: localScore,
    verdict: verdictFromScore(localScore),
    evidence: localEvidence,
  });

  let uxScore = 100;
  let uxEvidence = "Navigation and internal links adequate";
  if (internalLinks < 2 && /cluster|service|homepage|faq|hub/.test(pageType)) {
    uxScore = penalty(uxScore, 30);
    uxEvidence = "Sparse internal navigation";
    issues.push({
      severity: "major",
      code: "missing-internal-links",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "ux",
      message: "Missing internal links",
      evidence: `${internalLinks} internal href(s) found`,
      recommendedFix: "Link to service hub, related clusters and contact sections",
    });
  }
  const h2s = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const dupH2 = h2s.filter((h, i) => h2s.indexOf(h) !== i);
  if (dupH2.length) {
    uxScore = penalty(uxScore, 10);
    issues.push({
      severity: "minor",
      code: "duplicate-section-headings",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "ux",
      message: "Duplicate section headings on page",
      evidence: dupH2.join(", "),
      recommendedFix: "Differentiate repeated section headings for scanability",
    });
  }
  categories.push({
    category: "ux",
    score: uxScore,
    verdict: verdictFromScore(uxScore),
    evidence: uxEvidence,
  });

  let technicalScore = 100;
  let technicalEvidence = "Page structure valid";
  if (CORRUPT_HOURS.test(html)) {
    technicalScore = penalty(technicalScore, 35);
    technicalEvidence = "Corrupt opening hours value rendered";
    issues.push({
      severity: "critical",
      code: "corrupt-opening-hours",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "technical",
      message: "Corrupt opening hours displayed to patients",
      evidence: "Footer/local access shows imported CSS garbage instead of hours",
      recommendedFix: "Repair opening hours in business profile before approval",
    });
  }
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) {
      technicalScore = penalty(technicalScore, 40);
      issues.push({
        severity: "critical",
        code: "placeholder-text",
        pageSlug,
        pageLabel: pageLabel(pageSlug, pageType),
        category: "technical",
        message: "Placeholder text visible",
        evidence: pattern.source,
        recommendedFix: "Replace placeholder copy with approved tenant content",
      });
      break;
    }
  }
  if (countLegacyClusterReferencesInHtml(html) > 0) {
    technicalScore = penalty(technicalScore, 50);
    issues.push({
      severity: "critical",
      code: "legacy-cluster-links",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "technical",
      message: "Legacy cluster-cluster links present",
      evidence: "cluster-cluster- found in HTML",
      recommendedFix: "Rewrite internal cluster links to /local/cluster-{area}/",
    });
  }
  const libraryImages = $("img[src*='pharmacy-image-library']").length;
  const totalImages = $("img[src]").length;
  if (libraryImages === totalImages && totalImages > 0 && /service|cluster|homepage/.test(pageType)) {
    technicalScore = penalty(technicalScore, 8);
    issues.push({
      severity: "minor",
      code: "library-images-only",
      pageSlug,
      pageLabel: pageLabel(pageSlug, pageType),
      category: "technical",
      message: "Page uses library images only",
      evidence: `${libraryImages}/${totalImages} images from library`,
      recommendedFix: "Assign tenant-specific photography where available",
    });
  }
  categories.push({
    category: "technical",
    score: technicalScore,
    verdict: verdictFromScore(technicalScore),
    evidence: technicalEvidence,
  });

  return categories;
}

function detectCrossPageIssues(pages: ProductOwnerPageAuditResult[], issues: ProductOwnerQualityIssue[]): void {
  const clusterIntros = pages
    .filter((p) => p.pageType === "location-cluster")
    .map((p) => {
      const file = p.outputPath;
      if (!fs.existsSync(file)) return null;
      const $ = cheerio.load(fs.readFileSync(file, "utf8"));
      return {
        slug: p.pageSlug,
        intro: $(".local-intro-lead").first().text().trim(),
      };
    })
    .filter(Boolean) as Array<{ slug: string; intro: string }>;

  const introCounts = new Map<string, string[]>();
  for (const row of clusterIntros) {
    if (!row.intro) continue;
    const list = introCounts.get(row.intro) || [];
    list.push(row.slug);
    introCounts.set(row.intro, list);
  }
  for (const [intro, slugs] of introCounts) {
    if (slugs.length >= 3) {
      for (const slug of slugs) {
        issues.push({
          severity: "major",
          code: "duplicate-cluster-copy",
          pageSlug: slug,
          pageLabel: pageLabel(slug, "location-cluster"),
          category: "ux",
          message: "Duplicate cluster intro copy across multiple areas",
          evidence: `Shared intro across ${slugs.length} cluster pages`,
          recommendedFix: "Differentiate locality-specific intro copy per approved cluster area",
        });
      }
      break;
    }
  }
}

export function readLatestProductOwnerQualityAudit(slug: string): ProductOwnerQualityAuditPayload | null {
  const file = latestAuditPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ProductOwnerQualityAuditPayload;
  } catch {
    return null;
  }
}

export function buildProductOwnerQualityAudit(slug: string): ProductOwnerQualityAuditPayload | null {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return null;

  const key = resolveTenantProfileSlug(slug) || slug;
  const serviceId = ctx.serviceId;
  const profile = loadPharmacyProfile(slug);
  const tenantName = String(profile?.pharmacyName || profile?.tradingName || "Reliable Direct Pharmacy");
  const town = String(profile?.townCity || profile?.primaryTown || "Sheffield");
  const phone = String(profile?.phone || "");

  const manifest = readFinalRenderManifest(key);
  const renderRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", key);
  const pages = (manifest?.pages || []).filter(
    (p) => p.pageType && p.pageSlug && String(p.relativePath || "").endsWith(".html") && !String(p.relativePath).includes("assets/"),
  );

  const allIssues: ProductOwnerQualityIssue[] = [];
  const auditedPages: ProductOwnerPageAuditResult[] = [];

  for (const page of pages) {
    const outputPath = path.join(renderRoot, page.relativePath);
    const label = pageLabel(page.pageSlug, page.pageType);
    if (!fs.existsSync(outputPath)) {
      allIssues.push({
        severity: "critical",
        code: "missing-page",
        pageSlug: page.pageSlug,
        pageLabel: label,
        category: "technical",
        message: "Generated page file missing",
        evidence: outputPath,
        recommendedFix: "Regenerate or restore final render output for this canonical page",
      });
      auditedPages.push({
        pageLabel: label,
        pageSlug: page.pageSlug,
        pageType: page.pageType,
        outputPath,
        previewUrl: buildCanonicalLocalPagePreviewUrl(key, page.pageSlug),
        overallVerdict: "FAIL",
        overallScore: 0,
        categories: [],
        findings: ["Page file missing"],
      });
      continue;
    }

    const html = fs.readFileSync(outputPath, "utf8");
    const text = cheerio.load(html)("body").text().replace(/\s+/g, " ").trim();
    const pageIssues: ProductOwnerQualityIssue[] = [];
    const categories = auditPageCategories({
      html,
      text,
      pageSlug: page.pageSlug,
      pageType: page.pageType,
      tenantName,
      town,
      phone,
      issues: pageIssues,
    });
    allIssues.push(...pageIssues);

    const overallScore = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);
    const overallVerdict = verdictFromScore(overallScore);
    auditedPages.push({
      pageLabel: label,
      pageSlug: page.pageSlug,
      pageType: page.pageType,
      outputPath,
      previewUrl: buildCanonicalLocalPagePreviewUrl(key, page.pageSlug),
      overallVerdict,
      overallScore,
      categories,
      findings: pageIssues.map((i) => `[${i.severity}] ${i.message}`),
    });
  }

  detectCrossPageIssues(auditedPages, allIssues);

  const categoryKeys: ProductOwnerAuditCategory[] = [
    "brand",
    "commercial",
    "clinical",
    "seo",
    "localisation",
    "ux",
    "technical",
  ];
  const categoryScores = Object.fromEntries(
    categoryKeys.map((category) => {
      const scores = auditedPages.flatMap((p) => p.categories.filter((c) => c.category === category).map((c) => c.score));
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return [category, avg];
    }),
  ) as Record<ProductOwnerAuditCategory, number>;

  const overallQualityScore = auditedPages.length
    ? Math.round(auditedPages.reduce((sum, p) => sum + p.overallScore, 0) / auditedPages.length)
    : 0;

  const criticalIssues = allIssues.filter((i) => i.severity === "critical");
  const majorIssues = allIssues.filter((i) => i.severity === "major");
  const minorImprovements = allIssues.filter((i) => i.severity === "minor");
  const recommendedFixes = [...new Set(allIssues.map((i) => i.recommendedFix))];

  const payload: ProductOwnerQualityAuditPayload = {
    version: 1,
    slug: key,
    serviceId,
    auditedAt: new Date().toISOString(),
    pagesAudited: auditedPages.length,
    overallQualityScore,
    categoryScores,
    criticalIssueCount: criticalIssues.length,
    majorIssueCount: majorIssues.length,
    minorIssueCount: minorImprovements.length,
    criticalIssues,
    majorIssues,
    minorImprovements,
    recommendedFixes,
    pages: auditedPages,
    readyForQualityReviewApproval: criticalIssues.length === 0,
    status: auditedPages.length >= 16 ? "READY FOR PRODUCT OWNER PAGE REVIEW" : "BLOCKED",
  };

  writeJsonAtomic(latestAuditPath(key), payload);
  return payload;
}
