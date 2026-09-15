/**
 * Sprint 8B — Commercial Quality Review (validates existing generated output only).
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  finishWorkflowExecution,
  getLastRecordedWorkflowStage,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import {
  loadContentPackage,
  markContentPackageReviewed,
} from "./pharmacyContentPackageService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { loadGenerationReport } from "./pharmacyGenerationIntegrityService.ts";
import { loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import type {
  CommercialQualityApprovalSnapshot,
  CommercialQualityCheck,
  CommercialQualityCheckStatus,
  CommercialQualityContentTotals,
  CommercialQualityLocationBreakdown,
  CommercialQualityPreviewLink,
  CommercialQualityReviewPayload,
  CommercialQualityReviewSummary,
} from "./masterAdminCommercialQualityReviewModel.ts";
import { readAuthorisedEcosystemGenerationRecord } from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  buildCanonicalLocalPagePreviewUrl,
} from "./pharmacyCanonicalFinalRenderPreviewService.ts";
import { readFinalRenderManifest } from "./pharmacyCanonicalFinalRenderService.ts";
import { buildProductOwnerQualityAudit } from "./masterAdminProductOwnerQualityAuditService.ts";
import { buildQualityReviewPageInspectionWorkspace } from "./masterAdminQualityReviewPageInspectionService.ts";
import { readCanonicalImageInventory } from "./pharmacyCanonicalImageInventoryService.ts";
import { runImageParityGate } from "./pharmacyImageParityGateService.ts";
import { readCanonicalEcosystemGenerationPlan } from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { evaluatePharmacyFirstHealth } from "./imagePlatform/pharmacyImagePlatformPharmacyFirstHealth.ts";

const REVIEW_VERSION = "commercial-quality-review-v1";
const APPROVAL_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-quality-review");

function manifestPath(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", key, `${serviceId}.json`);
}

function approvalDir(slug: string): string {
  return path.join(APPROVAL_DIR, slug);
}

function latestApprovalPath(slug: string): string {
  return path.join(approvalDir(slug), "latest.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function readLatestCommercialQualityApproval(slug: string): CommercialQualityApprovalSnapshot | null {
  const file = latestApprovalPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as CommercialQualityApprovalSnapshot;
  } catch {
    return null;
  }
}

function ecosystemRoot(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
}

function visualPagePath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
}

function listHtmlPages(slug: string, serviceId: string): string[] {
  const paths: string[] = [];
  const visual = visualPagePath(slug, serviceId);
  if (fs.existsSync(visual)) paths.push(visual);
  const pagesDir = path.join(ecosystemRoot(slug, serviceId), "pages");
  if (fs.existsSync(pagesDir)) {
    for (const entry of fs.readdirSync(pagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const html = path.join(pagesDir, entry.name, "index.html");
      if (fs.existsSync(html)) paths.push(html);
    }
  }
  const localDir = path.join(ecosystemRoot(slug, serviceId), "local");
  if (fs.existsSync(localDir)) {
    for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const html = path.join(localDir, entry.name, "index.html");
      if (fs.existsSync(html)) paths.push(html);
    }
  }
  return paths;
}

function readEcosystemIndex(slug: string, serviceId: string): {
  assets: Array<{ id?: string; type?: string; urlPath?: string; outputPath?: string }>;
  localClusterPagesGenerated?: number;
} | null {
  const file = path.join(ecosystemRoot(slug, serviceId), "_ecosystem-index.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function countSchemas(htmlPaths: string[]): number {
  let count = 0;
  for (const file of htmlPaths) {
    try {
      const html = fs.readFileSync(file, "utf8");
      if (/application\/ld\+json/i.test(html)) count += 1;
    } catch {
      /* skip */
    }
  }
  return count;
}

function seoPagesValid(htmlPaths: string[]): { ok: boolean; invalid: string[] } {
  const invalid: string[] = [];
  for (const file of htmlPaths) {
    try {
      const html = fs.readFileSync(file, "utf8");
      const $ = cheerio.load(html);
      const title = $("title").first().text().trim();
      const desc = $('meta[name="description"]').attr("content")?.trim() || "";
      if (!title || !desc) invalid.push(path.basename(path.dirname(file)));
    } catch {
      invalid.push(path.basename(path.dirname(file)));
    }
  }
  return { ok: invalid.length === 0, invalid };
}

function countInternalLinks(slug: string, serviceId: string): number {
  const mapFile = path.join(ecosystemRoot(slug, serviceId), "_internal-link-map.json");
  if (!fs.existsSync(mapFile)) return 0;
  try {
    const map = JSON.parse(fs.readFileSync(mapFile, "utf8")) as {
      localClusterPages?: unknown[];
      mainServiceUrlPath?: string;
    };
    return (map.localClusterPages?.length || 0) + (map.mainServiceUrlPath ? 1 : 0);
  } catch {
    return 0;
  }
}

function sitemapUrlCount(slug: string): number {
  const publishSitemap = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, "sitemap.xml");
  if (fs.existsSync(publishSitemap)) {
    const xml = fs.readFileSync(publishSitemap, "utf8");
    return (xml.match(/<loc>/g) || []).length;
  }
  const prepDir = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug);
  if (fs.existsSync(prepDir)) {
    let urls = 0;
    for (const root of [prepDir]) {
      for (const file of fs.readdirSync(root, { recursive: true })) {
        if (typeof file === "string" && file.endsWith("index.html")) urls += 1;
      }
    }
    return urls;
  }
  return 0;
}

function hasCustomImages(slug: string, serviceId: string): boolean {
  const assignments = loadImageAssignments(slug);
  return Object.values(assignments.assignments || {}).some(
    (a) => a.serviceId === serviceId && a.sourceType && a.sourceType !== "library",
  );
}

function hasSearchConsole(slug: string): boolean {
  const indexFile = path.join(WORKSPACE_ROOT, "output", slug, "indexing-bridge.json");
  if (!fs.existsSync(indexFile)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(indexFile, "utf8")) as { sitemapUrl?: string; submitted?: number };
    return Boolean(raw.sitemapUrl) || (raw.submitted || 0) > 0;
  } catch {
    return false;
  }
}

function hasAnalytics(slug: string): boolean {
  const profileFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(profileFile)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(profileFile, "utf8")) as {
      websiteImportSnapshot?: { analyticsDetected?: unknown[] };
    };
    return (raw.websiteImportSnapshot?.analyticsDetected?.length || 0) > 0;
  } catch {
    return false;
  }
}

function hasCompetitorIntelligence(slug: string): boolean {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-growth-journey", `${slug}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      competitor?: { competitorCount?: number; topCompetitors?: unknown[] };
    };
    return (raw.competitor?.competitorCount || 0) > 0 || (raw.competitor?.topCompetitors?.length || 0) > 0;
  } catch {
    return false;
  }
}

function check(
  id: string,
  label: string,
  status: CommercialQualityCheckStatus,
  detail: string,
): CommercialQualityCheck {
  return { id, label, status, detail };
}

function buildImagePlatformWorkspace(slug: string, serviceId: string) {
  const plan = readCanonicalEcosystemGenerationPlan(slug);
  const parity = runImageParityGate(slug, serviceId, plan);
  const inventory = readCanonicalImageInventory(slug) || parity.inventory;
  const health = evaluatePharmacyFirstHealth();
  const byPage = new Map<string, { pageType: string; roles: string[]; assets: string[] }>();
  for (const row of inventory.pageSlotAssignments) {
    const existing = byPage.get(row.pageSlug) || { pageType: row.pageType, roles: [], assets: [] };
    existing.roles.push(row.slot);
    if (row.approvedAssetId) existing.assets.push(row.approvedAssetId);
    byPage.set(row.pageSlug, existing);
  }
  return {
    platformStatus: health.healthStatus,
    uniqueApprovedAssets: inventory.uniqueApprovedAssets.length,
    pageSlotAssignments: inventory.counts.pageSlotAssignments,
    assignmentsComplete: parity.ok,
    missingAssignments: parity.missingAssignments,
    placeholderFallbacks: parity.staleSvgContentFallbacks,
    brokenAssets: parity.brokenAssets,
    crossTenantAssets: parity.crossTenantAssets,
    pagesUsingProductionPhotography: inventory.counts.assigned,
    imageCompletenessStatus: parity.imageCompletenessStatus,
    perPage: [...byPage.entries()].map(([pageSlug, v]) => ({
      pageSlug,
      pageType: v.pageType,
      requiredRoles: v.roles,
      assignedAssets: v.assets,
      imageStatus: v.assets.length >= v.roles.length ? "assigned" : "incomplete",
    })),
  };
}

function buildLocationBreakdown(slug: string): CommercialQualityLocationBreakdown {
  const manifest = readFinalRenderManifest(slug);
  const pages = manifest?.pages || [];
  return {
    hubCount: pages.filter((p) => p.pageType === "location-hub" || p.pageType === "hub").length,
    clusterCount: pages.filter((p) => p.pageType === "location-cluster").length,
    areaPageCount: pages.filter((p) => p.pageType === "location-area").length,
  };
}

function buildQualityReviewPreviewLinks(slug: string, serviceId: string): CommercialQualityPreviewLink[] {
  const manifest = readFinalRenderManifest(slug);
  const pages = manifest?.pages || [];
  const links: CommercialQualityPreviewLink[] = [];
  const seen = new Set<string>();

  const add = (label: string, pageSlug: string, pageType: string) => {
    const key = `${pageType}:${pageSlug}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({
      label,
      pageType,
      url: buildCanonicalLocalPagePreviewUrl(slug, pageSlug),
    });
  };

  if (pages.length) {
    add("Homepage", "index", "homepage");
    const service = pages.find((p) => p.pageType === "service") || pages.find((p) => p.pageSlug === serviceId);
    if (service) add("Primary Service Page", service.pageSlug, "service");
    const hub = pages.find((p) => p.pageType === "location-hub" || p.pageType === "hub");
    if (hub) add("Location Hub", hub.pageSlug, "location-hub");
    const cluster = pages.find((p) => p.pageType === "location-cluster");
    if (cluster) add("Location Cluster", cluster.pageSlug, "location-cluster");
    const area = pages.find((p) => p.pageType === "location-area");
    if (area) add("Area Page", area.pageSlug, "location-area");
    const guide = pages.find((p) => p.pageType === "guide");
    if (guide) add("Guide", guide.pageSlug, "guide");
    const blog = pages.find((p) => p.pageType === "blog");
    if (blog) add("Blog", blog.pageSlug, "blog");
    const faq = pages.find((p) => p.pageType === "faq" || p.pageType === "support");
    if (faq) add("FAQ / Supporting Page", faq.pageSlug, "faq");
    return links;
  }

  add("Homepage", "index", "homepage");
  add("Primary Service Page", serviceId, "service");
  add("Guide", `${serviceId}-guide`, "guide");
  add("Blog", "what-is-pharmacy-first", "blog");
  add("Location Hub", "local-hub", "location-hub");
  return links;
}

function buildContentTotals(slug: string, serviceId: string, index: ReturnType<typeof readEcosystemIndex>): CommercialQualityContentTotals {
  const htmlPaths = listHtmlPages(slug, serviceId);
  const assets = index?.assets || [];
  const blogPosts = assets.filter((a) => /blog post/i.test(a.type || "")).length;
  const patientGuides = assets.filter((a) => /patient guide/i.test(a.type || "")).length;
  const faqPages = assets.filter((a) => /faq/i.test(a.type || "")).length;
  const locationPages = assets.filter((a) => /local/i.test(a.type || "")).length;
  const servicePages = assets.filter((a) => /service page|supporting service/i.test(a.type || "")).length + (fs.existsSync(visualPagePath(slug, serviceId)) ? 1 : 0);
  const assignments = loadImageAssignments(slug);
  const imageCount = Object.values(assignments.assignments || {}).filter((a) => a.serviceId === serviceId).length;

  return {
    websitePages: htmlPaths.length,
    servicePages,
    locationPages,
    blogPosts,
    patientGuides,
    faqPages,
    images: imageCount,
    schemas: countSchemas(htmlPaths),
    internalLinks: countInternalLinks(slug, serviceId),
    sitemap: sitemapUrlCount(slug),
    registry: fs.existsSync(path.join(ecosystemRoot(slug, serviceId), "_ecosystem-index.json")) ? 1 : 0,
    manifest: fs.existsSync(manifestPath(slug, serviceId)) ? 1 : 0,
  };
}

function runCommercialChecks(
  slug: string,
  serviceId: string,
  manifest: NonNullable<ReturnType<typeof loadContentPackage>>,
  report: ReturnType<typeof loadGenerationReport>,
): { checks: CommercialQualityCheck[]; warnings: string[]; blockers: string[] } {
  const checks: CommercialQualityCheck[] = [];
  const warnings: string[] = [];
  const blockers: string[] = [];

  const htmlPaths = listHtmlPages(slug, serviceId);
  const index = readEcosystemIndex(slug, serviceId);
  const manifestPathFile = manifestPath(slug, serviceId);
  const registryPath = path.join(ecosystemRoot(slug, serviceId), "_ecosystem-index.json");
  const visualPath = visualPagePath(slug, serviceId);
  const ecoRoot = ecosystemRoot(slug, serviceId);

  if (manifest.status === "error" || manifest.generationError) {
    checks.push(check("generation-status", "Generation completed", "FAIL", manifest.generationError || "Generation failed"));
    blockers.push("Generation failure");
  } else if (!manifest.generatedAt) {
    checks.push(check("generation-status", "Generation completed", "FAIL", "Content has not been generated"));
    blockers.push("Generation failure");
  } else {
    checks.push(check("generation-status", "Generation completed", "PASS", "Content package generated successfully"));
  }

  if (!fs.existsSync(manifestPathFile)) {
    checks.push(check("manifest", "Manifest valid", "FAIL", "Content package manifest missing"));
    blockers.push("Missing manifest");
  } else {
    checks.push(check("manifest", "Manifest valid", "PASS", "Content package manifest present"));
  }

  if (!fs.existsSync(registryPath)) {
    checks.push(check("registry", "Registry valid", "FAIL", "Ecosystem registry index missing"));
    blockers.push("Missing registry");
  } else {
    checks.push(check("registry", "Registry valid", "PASS", "Ecosystem registry present"));
  }

  const requiredPagesOk = fs.existsSync(visualPath) && htmlPaths.length > 0;
  if (!requiredPagesOk) {
    checks.push(check("required-pages", "Required pages generated", "FAIL", "Service page output missing"));
    blockers.push("Missing pages");
  } else {
    checks.push(check("required-pages", "Required pages generated", "PASS", `${htmlPaths.length} website page(s) on disk`));
  }

  if (!fs.existsSync(ecoRoot)) {
    checks.push(check("output-folders", "Output folders complete", "FAIL", "Ecosystem output folder missing"));
    blockers.push("Broken output");
  } else {
    checks.push(check("output-folders", "Output folders complete", "PASS", "Generated output folders present"));
  }

  const brokenOutputs = (manifest.assets || [])
    .filter((a) => a.required && a.included && a.outputPath && !fs.existsSync(a.outputPath))
    .map((a) => a.title);
  if (brokenOutputs.length) {
    checks.push(check("broken-output", "Required outputs exist", "FAIL", brokenOutputs.join("; ")));
    blockers.push("Broken output");
  } else {
    checks.push(check("broken-output", "Required outputs exist", "PASS", "All required included assets present on disk"));
  }

  const plan = readCanonicalEcosystemGenerationPlan(slug);
  const imageParity = runImageParityGate(slug, serviceId, plan);
  if (!imageParity.ok) {
    checks.push(check("hero-images", "Hero images exist", "FAIL", imageParity.failures[0] || "Production hero image missing"));
    checks.push(check("required-images", "Images exist", "FAIL", `${imageParity.missingAssignments} missing production assignment(s)`));
    blockers.push("Missing required images");
  } else {
    checks.push(check("hero-images", "Hero images exist", "PASS", "Production hero image assigned"));
    checks.push(check("required-images", "Images exist", "PASS", `${imageParity.assignedAssignments} production assignment(s)`));
  }
  checks.push(
    check(
      "image-platform-parity",
      "Image platform parity",
      imageParity.ok ? "PASS" : "FAIL",
      imageParity.ok
        ? `${imageParity.assignedAssignments}/${imageParity.requiredAssignments} slots assigned`
        : imageParity.failures.join("; "),
    ),
  );
  if (!imageParity.ok) blockers.push("Image platform parity failed");

  const schemaCount = countSchemas(htmlPaths);
  const schemaOk = schemaCount > 0 && schemaCount >= Math.min(htmlPaths.length, 1);
  if (!schemaOk) {
    checks.push(check("schema", "Schema valid", "FAIL", "Structured data missing from generated pages"));
    blockers.push("Missing schema");
  } else {
    checks.push(check("schema", "Schema valid", "PASS", `${schemaCount} page(s) include schema markup`));
  }

  const internalOk = report?.internalLinkValidation?.ok !== false;
  if (!internalOk) {
    checks.push(check("internal-links", "Internal links valid", "FAIL", report?.internalLinkValidation?.detail || "Internal link validation failed"));
    blockers.push("Broken internal links");
  } else {
    checks.push(check("internal-links", "Internal links valid", "PASS", report?.internalLinkValidation?.detail || "Internal link map present"));
  }

  const seo = seoPagesValid(htmlPaths);
  checks.push(
    seo.ok
      ? check("seo", "SEO Health", "PASS", "All generated pages include title and meta description")
      : check("seo", "SEO Health", "WARNING", `Missing metadata: ${seo.invalid.join(", ")}`),
  );

  const navLinks = countInternalLinks(slug, serviceId);
  checks.push(
    navLinks > 0
      ? check("navigation", "Navigation", "PASS", `${navLinks} internal navigation link(s) mapped`)
      : check("navigation", "Navigation", "WARNING", "Limited internal navigation detected"),
  );

  const urlPaths = (index?.assets || [])
    .map((a) => a.urlPath)
    .filter((u): u is string => Boolean(u) && u !== "(pack)" && !u.startsWith("("));
  const dupes = urlPaths.filter((u, i) => urlPaths.indexOf(u) !== i);
  checks.push(
    dupes.length
      ? check("duplicate-urls", "No duplicate URLs", "FAIL", dupes.join(", "))
      : check("duplicate-urls", "No duplicate URLs", "PASS", "No duplicate URL paths detected"),
  );
  if (dupes.length) blockers.push("Duplicate URLs detected");

  const slugMismatch = htmlPaths.some((p) => !p.includes(slug));
  checks.push(
    slugMismatch
      ? check("broken-slugs", "No broken slugs", "FAIL", "Output path tenant mismatch detected")
      : check("broken-slugs", "No broken slugs", "PASS", "Generated output paths match tenant"),
  );
  if (slugMismatch) blockers.push("Broken output");

  const templateOk = report?.longFormQualityValidation?.supportingTemplateValidation?.ok !== false;
  checks.push(
    templateOk
      ? check("templates", "No missing templates", "PASS", "Supporting templates validated")
      : check("templates", "No missing templates", "WARNING", report?.longFormQualityValidation?.supportingTemplateValidation?.detail || "Template warnings"),
  );

  if (!hasCustomImages(slug, serviceId)) warnings.push("No custom images");
  if (!hasSearchConsole(slug)) warnings.push("No Search Console");
  if (!hasAnalytics(slug)) warnings.push("No Analytics");
  if (!hasCompetitorIntelligence(slug)) warnings.push("No Competitor Intelligence");

  return { checks, warnings, blockers: [...new Set(blockers)] };
}

function buildSummary(
  manifest: NonNullable<ReturnType<typeof loadContentPackage>>,
  totals: CommercialQualityContentTotals,
  checks: CommercialQualityCheck[],
  blockers: string[],
): CommercialQualityReviewSummary {
  const pagesGenerated = totals.websitePages;
  const internal = checks.find((c) => c.id === "internal-links");
  const schema = checks.find((c) => c.id === "schema");
  const seo = checks.find((c) => c.id === "seo");
  const missingAssets = (manifest.assets || []).filter(
    (a) => a.required && (!a.included || a.status === "missing" || a.status === "error"),
  ).length;
  const passCount = checks.filter((c) => c.status === "PASS").length;
  const contentQualityScore = checks.length ? Math.round((passCount / checks.length) * 100) : 0;
  const navCheck = checks.find((c) => c.id === "internal-links");

  return {
    contentGenerated: Boolean(manifest.generatedAt && manifest.status !== "error"),
    contentGeneratedLabel: manifest.generatedAt ? "Complete" : "Missing",
    pagesGenerated,
    imagesGenerated: totals.images,
    internalLinksLabel: internal?.status === "PASS" ? "Passed" : internal?.status === "WARNING" ? "Review" : "Failed",
    schemaValidationLabel: schema?.status === "PASS" ? "Passed" : schema?.status === "WARNING" ? "Review" : "Failed",
    seoValidationLabel: seo?.status === "PASS" ? "Passed" : seo?.status === "WARNING" ? "Review" : "Failed",
    missingAssets,
    criticalErrors: blockers.length,
    estimatedReviewMinutes: 2,
    overallStatus: blockers.length ? "BLOCKED" : "READY FOR PUBLISHING",
    publishingReadiness: blockers.length ? "Blocked" : "Ready",
    navigationValidationLabel: navCheck?.status === "PASS" ? "Navigation links validated" : navCheck?.detail || "Review navigation",
    contentQualityScore,
  };
}

export function buildCommercialQualityReview(slug: string): CommercialQualityReviewPayload {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) {
    return {
      version: 1,
      slug,
      serviceId: "",
      serviceName: "",
      generatedAt: null,
      generatorVersion: null,
      previewUrl: "",
      summary: {
        contentGenerated: false,
        contentGeneratedLabel: "Missing",
        pagesGenerated: 0,
        imagesGenerated: 0,
        internalLinksLabel: "Failed",
        schemaValidationLabel: "Failed",
        seoValidationLabel: "Failed",
        missingAssets: 0,
        criticalErrors: 1,
        estimatedReviewMinutes: 2,
        overallStatus: "BLOCKED",
        publishingReadiness: "Blocked",
      },
      contentTotals: {
        websitePages: 0,
        servicePages: 0,
        locationPages: 0,
        blogPosts: 0,
        patientGuides: 0,
        faqPages: 0,
        images: 0,
        schemas: 0,
        internalLinks: 0,
        sitemap: 0,
        registry: 0,
        manifest: 0,
      },
      checks: [],
      warnings: [],
      blockers: ["Customer not found"],
      approvalStatus: "pending",
      approvedAt: null,
      approvedBy: null,
      canApprove: false,
      loadError: "Customer not found",
    };
  }

  const serviceId = ctx.serviceId;
  const manifest = loadContentPackage(slug, serviceId);
  if (!manifest?.generatedAt) {
    return {
      version: 1,
      slug,
      serviceId,
      serviceName: manifest?.serviceName || serviceId,
      generatedAt: null,
      generatorVersion: manifest?.generatorVersion || null,
      previewUrl: `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`,
      summary: {
        contentGenerated: false,
        contentGeneratedLabel: "Missing",
        pagesGenerated: 0,
        imagesGenerated: 0,
        internalLinksLabel: "Failed",
        schemaValidationLabel: "Failed",
        seoValidationLabel: "Failed",
        missingAssets: 0,
        criticalErrors: 1,
        estimatedReviewMinutes: 2,
        overallStatus: "BLOCKED",
        publishingReadiness: "Blocked",
      },
      contentTotals: {
        websitePages: 0,
        servicePages: 0,
        locationPages: 0,
        blogPosts: 0,
        patientGuides: 0,
        faqPages: 0,
        images: 0,
        schemas: 0,
        internalLinks: 0,
        sitemap: 0,
        registry: 0,
        manifest: 0,
      },
      checks: [check("generation-status", "Generation completed", "FAIL", "Generate ecosystem first")],
      warnings: [],
      blockers: ["Generation failure"],
      approvalStatus: "pending",
      approvedAt: null,
      approvedBy: null,
      canApprove: false,
      loadError: "Content has not been generated yet",
    };
  }

  const report = loadGenerationReport(slug, serviceId);
  const index = readEcosystemIndex(slug, serviceId);
  const totals = buildContentTotals(slug, serviceId, index);
  const { checks, warnings, blockers } = runCommercialChecks(slug, serviceId, manifest, report);
  const summary = buildSummary(manifest, totals, checks, blockers);
  const latest = readLatestCommercialQualityApproval(slug);
  const approved = Boolean(manifest.reviewedAt || latest?.approvedAt);
  const authorised = readAuthorisedEcosystemGenerationRecord(slug);
  const authorisedComplete = authorised?.status === "completed";
  const productOwnerQualityAudit = authorisedComplete ? buildProductOwnerQualityAudit(slug) : null;
  const pageInspectionWorkspace = authorisedComplete ? buildQualityReviewPageInspectionWorkspace(slug) : null;
  const imagePlatformWorkspace = authorisedComplete ? buildImagePlatformWorkspace(slug, serviceId) : null;
  const inspectionBlockers = pageInspectionWorkspace?.approvalBlockers || [];
  const imageBlockers =
    imagePlatformWorkspace && !imagePlatformWorkspace.assignmentsComplete
      ? [`Image parity failed: ${imagePlatformWorkspace.missingAssignments} missing, ${imagePlatformWorkspace.placeholderFallbacks} SVG fallbacks`]
      : [];

  return {
    version: 1,
    slug,
    serviceId,
    serviceName: manifest.serviceName,
    generatedAt: authorisedComplete ? authorised?.generationRevision || manifest.generatedAt : manifest.generatedAt,
    generatorVersion: manifest.generatorVersion,
    previewUrl: `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`,
    summary,
    contentTotals: totals,
    checks,
    warnings: authorisedComplete
      ? warnings
      : [...warnings, "Historical accidental package is preserved for audit — Quality Review applies to the Product Owner-authorised generation only."],
    blockers: authorisedComplete
      ? [...blockers, ...inspectionBlockers, ...imageBlockers]
      : [...blockers, "Product Owner-authorised ecosystem generation required before Quality Review"],
    approvalStatus: approved ? "approved" : "pending",
    approvedAt: manifest.reviewedAt || latest?.approvedAt || null,
    approvedBy: latest?.approvedBy || null,
    canApprove:
      authorisedComplete &&
      blockers.length === 0 &&
      imageBlockers.length === 0 &&
      authorised?.imageCompletenessStatus === "COMPLETE" &&
      pageInspectionWorkspace?.canApproveQuality === true &&
      !approved,
    authorisedGenerationJobId: authorised?.jobId || null,
    authorisedGenerationRevision: authorised?.generationRevision || null,
    productOwnerAuthorised: authorisedComplete,
    locationBreakdown: buildLocationBreakdown(slug),
    previewLinks: authorisedComplete ? buildQualityReviewPreviewLinks(slug, serviceId) : [],
    productOwnerQualityAudit,
    pageInspectionWorkspace,
    imagePlatformWorkspace,
  };
}

export function buildCommercialQualityQaReport(slug: string): Record<string, unknown> {
  const review = buildCommercialQualityReview(slug);
  return {
    version: REVIEW_VERSION,
    tenant: slug,
    serviceId: review.serviceId,
    generatedAt: review.generatedAt,
    generatorVersion: review.generatorVersion,
    generationSummary: review.summary,
    contentTotals: review.contentTotals,
    validationResults: review.checks,
    warnings: review.warnings,
    blockers: review.blockers,
    pageTotals: {
      websitePages: review.contentTotals.websitePages,
      servicePages: review.contentTotals.servicePages,
      locationPages: review.contentTotals.locationPages,
      blogPosts: review.contentTotals.blogPosts,
      patientGuides: review.contentTotals.patientGuides,
      faqPages: review.contentTotals.faqPages,
    },
    imageTotals: review.contentTotals.images,
    schemaTotals: review.contentTotals.schemas,
    exportedAt: new Date().toISOString(),
  };
}

export function approveCommercialQualityReview(slug: string, operator: string): {
  ok: boolean;
  errors: string[];
  snapshot: CommercialQualityApprovalSnapshot | null;
  review: CommercialQualityReviewPayload;
  alreadyApproved?: boolean;
  workflowStage?: string;
} {
  const review = buildCommercialQualityReview(slug);
  if (review.loadError && !review.generatedAt) {
    return { ok: false, errors: [review.loadError], snapshot: null, review };
  }

  const latest = readLatestCommercialQualityApproval(slug);
  const manifest = loadContentPackage(slug, review.serviceId);
  if (manifest?.reviewedAt && latest?.approvedAt) {
    return {
      ok: true,
      errors: [],
      snapshot: latest,
      review: buildCommercialQualityReview(slug),
      alreadyApproved: true,
      workflowStage: getLastRecordedWorkflowStage(slug),
    };
  }

  if (review.blockers.length) {
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_commercial_quality_review",
      status: "error",
      evidence: `Approval blocked: ${review.blockers.join("; ")}`,
      errors: review.blockers,
    });
    return { ok: false, errors: review.blockers, snapshot: null, review };
  }

  const approvedAt = new Date().toISOString();
  const snapshot: CommercialQualityApprovalSnapshot = {
    version: 1,
    slug,
    serviceId: review.serviceId,
    approvedAt,
    approvedBy: operator,
    generatedAt: review.generatedAt,
    generatorVersion: review.generatorVersion,
    tenant: slug,
    summary: review.summary,
    contentTotals: review.contentTotals,
    checks: review.checks,
    warnings: review.warnings,
    blockers: [],
    validationEvidence: {
      generationReportPath: manifest?.generationReportPath || null,
      manifestPath: manifestPath(slug, review.serviceId),
      registryPath: path.join(ecosystemRoot(slug, review.serviceId), "_ecosystem-index.json"),
      previewUrl: review.previewUrl,
    },
  };

  try {
    markContentPackageReviewed(slug, review.serviceId);
    writeJsonAtomic(latestApprovalPath(slug), snapshot);
    writeJsonAtomic(path.join(approvalDir(slug), `revision-${approvedAt.replace(/[:.]/g, "-")}.json`), snapshot);

    const recorded = getLastRecordedWorkflowStage(slug);
    if (recorded === "quality_review") {
      startWorkflowExecution({
        slug,
        stageId: "quality_review",
        actionId: "approve_commercial_quality_review",
        operator,
      });
      finishWorkflowExecution({
        slug,
        stageId: "quality_review",
        actionId: "approve_commercial_quality_review",
        operator,
        evidence: "Commercial Quality Review approved",
        status: "completed",
      });
      recordWorkflowTransition({
        slug,
        fromStage: "quality_review",
        toStage: "publish",
        operator,
        reason: "Commercial Quality Review approved",
        evidence: `QA snapshot ${approvedAt}`,
      });
    }

    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_commercial_quality_review",
      status: "success",
      evidence: `Commercial Quality Review approved for ${review.serviceName}`,
      metadata: { serviceId: review.serviceId, approvedAt },
    });

    return {
      ok: true,
      errors: [],
      snapshot,
      review: buildCommercialQualityReview(slug),
      workflowStage: getLastRecordedWorkflowStage(slug),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_commercial_quality_review",
      status: "error",
      evidence: message,
      errors: [message],
    });
    return { ok: false, errors: [message], snapshot: null, review };
  }
}
