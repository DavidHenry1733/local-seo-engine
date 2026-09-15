/**
 * NT-E2E-26 — Quality Review page inspection workspace.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  resolveCanonicalFinalRenderPagePath,
} from "./pharmacyCanonicalFinalRenderService.ts";
import { readAuthorisedEcosystemGenerationRecord } from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import { readLatestProductOwnerQualityAudit } from "./masterAdminProductOwnerQualityAuditService.ts";
import type {
  QualityReviewPageInspectionProgress,
  QualityReviewPageInspectionRow,
  QualityReviewPageInspectionStore,
  QualityReviewPageInspectionWorkspace,
  QualityReviewPageReviewStatus,
} from "./masterAdminQualityReviewPageInspectionModel.ts";

const INSPECTION_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-quality-review");

const RC1_PAGE_ORDER: Array<{ pageSlug: string; pageType: string; pageName: string }> = [
  { pageSlug: "index", pageType: "homepage", pageName: "Homepage" },
  { pageSlug: "pharmacy-first", pageType: "service-hub", pageName: "Pharmacy First (Service Hub)" },
  { pageSlug: "local-cluster-ecclesall", pageType: "cluster-page", pageName: "Ecclesall" },
  { pageSlug: "local-cluster-fulwood", pageType: "cluster-page", pageName: "Fulwood" },
  { pageSlug: "local-cluster-sheffield-city-centre", pageType: "cluster-page", pageName: "Sheffield City Centre" },
  { pageSlug: "local-cluster-broomhill", pageType: "cluster-page", pageName: "Broomhill" },
  { pageSlug: "local-cluster-kelham-island", pageType: "cluster-page", pageName: "Kelham Island" },
  { pageSlug: "local-cluster-dore", pageType: "cluster-page", pageName: "Dore" },
  { pageSlug: "local-cluster-hillsborough", pageType: "cluster-page", pageName: "Hillsborough" },
  { pageSlug: "local-cluster-crookes", pageType: "cluster-page", pageName: "Crookes" },
  { pageSlug: "pharmacy-first-guide", pageType: "guide", pageName: "Pharmacy First Patient Guide" },
  { pageSlug: "what-is-pharmacy-first", pageType: "blog", pageName: "What Is Pharmacy First" },
  { pageSlug: "who-should-consider-pharmacy-first", pageType: "blog", pageName: "Who Should Consider Pharmacy First" },
  { pageSlug: "pharmacy-first-what-you-need-to-know", pageType: "blog", pageName: "Pharmacy First: What You Need to Know" },
  { pageSlug: "pharmacy-first-faqs", pageType: "faq", pageName: "Pharmacy First FAQs" },
  { pageSlug: "pharmacy-first-content-ecosystem", pageType: "supporting-page", pageName: "Pharmacy First Content Ecosystem" },
];

function inspectionPath(slug: string): string {
  return path.join(INSPECTION_DIR, slug, "page-inspection.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function readQualityReviewPageInspectionStore(slug: string): QualityReviewPageInspectionStore | null {
  const file = inspectionPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as QualityReviewPageInspectionStore;
  } catch {
    return null;
  }
}

function defaultStore(slug: string, jobId: string | null, packageRevision: string | null): QualityReviewPageInspectionStore {
  return {
    version: 1,
    slug,
    authorisedJobId: jobId,
    packageRevision,
    updatedAt: new Date().toISOString(),
    pages: {},
  };
}

function storeScopeKey(auth: { jobId: string | null; packageRevision?: string | null }): string {
  return `${auth.jobId || "none"}::${auth.packageRevision || auth.jobId || "none"}`;
}

function computeProgress(pages: QualityReviewPageInspectionRow[]): QualityReviewPageInspectionProgress {
  const total = pages.length;
  const approved = pages.filter((p) => p.reviewStatus === "approved").length;
  const needsChanges = pages.filter((p) => p.reviewStatus === "needs_changes").length;
  const reviewed = pages.filter((p) => p.reviewStatus !== "not_reviewed").length;
  const progressPercent = total ? Math.round((reviewed / total) * 100) : 0;
  return { total, reviewed, approved, needsChanges, progressPercent };
}

function pageGenerationStatus(slug: string, pageSlug: string): "generated" | "missing" {
  return resolveCanonicalFinalRenderPagePath(slug, pageSlug) ? "generated" : "missing";
}

export function buildQualityReviewPageInspectionWorkspace(slug: string): QualityReviewPageInspectionWorkspace | null {
  const key = resolveTenantProfileSlug(slug) || slug;
  const auth = readAuthorisedEcosystemGenerationRecord(key);
  if (!auth?.jobId) return null;

  let store = readQualityReviewPageInspectionStore(key);
  const scopeKey = storeScopeKey({ jobId: auth.jobId, packageRevision: auth.packageRevision || auth.generationRevision });
  const currentScopeKey = store
    ? storeScopeKey({ jobId: store.authorisedJobId, packageRevision: store.packageRevision })
    : null;
  if (!store || currentScopeKey !== scopeKey) {
    store = defaultStore(key, auth.jobId, auth.packageRevision || auth.generationRevision || null);
  }

  const pages: QualityReviewPageInspectionRow[] = RC1_PAGE_ORDER.map((spec, idx) => {
    const saved = store!.pages[spec.pageSlug];
    return {
      pageId: spec.pageSlug,
      pageSlug: spec.pageSlug,
      pageType: spec.pageType,
      pageName: spec.pageName,
      sortOrder: idx + 1,
      generationStatus: pageGenerationStatus(key, spec.pageSlug),
      reviewStatus: saved?.reviewStatus || "not_reviewed",
      notes: saved?.notes || "",
    };
  });

  const progress = computeProgress(pages);
  const audit = readLatestProductOwnerQualityAudit(key);
  const approvalBlockers: string[] = [];

  if (progress.reviewed < progress.total) {
    approvalBlockers.push(`${progress.total - progress.reviewed} page(s) not yet reviewed`);
  }
  if (progress.needsChanges > 0) {
    approvalBlockers.push(`${progress.needsChanges} page(s) marked Needs Changes`);
  }
  if (audit && audit.criticalIssueCount > 0) {
    approvalBlockers.push(`${audit.criticalIssueCount} critical audit issue(s)`);
  }
  if (audit && audit.majorIssueCount > 0) {
    approvalBlockers.push(`${audit.majorIssueCount} major audit issue(s)`);
  }
  if (pages.some((p) => p.generationStatus === "missing")) {
    approvalBlockers.push("One or more canonical pages missing from final render");
  }

  return {
    version: 1,
    slug: key,
    authorisedJobId: auth.jobId,
    pages,
    progress,
    canApproveQuality: approvalBlockers.length === 0,
    approvalBlockers,
  };
}

export function updateQualityReviewPageInspection(
  slug: string,
  pageSlug: string,
  reviewStatus: QualityReviewPageReviewStatus,
  notes?: string,
): QualityReviewPageInspectionWorkspace | null {
  const key = resolveTenantProfileSlug(slug) || slug;
  const auth = readAuthorisedEcosystemGenerationRecord(key);
  if (!auth?.jobId) return null;

  const allowed = new Set(RC1_PAGE_ORDER.map((p) => p.pageSlug));
  if (!allowed.has(pageSlug)) return null;
  if (!["not_reviewed", "approved", "needs_changes"].includes(reviewStatus)) return null;

  let store = readQualityReviewPageInspectionStore(key);
  const scopeKey = storeScopeKey({ jobId: auth.jobId, packageRevision: auth.packageRevision || auth.generationRevision });
  const currentScopeKey = store
    ? storeScopeKey({ jobId: store.authorisedJobId, packageRevision: store.packageRevision })
    : null;
  if (!store || currentScopeKey !== scopeKey) {
    store = defaultStore(key, auth.jobId, auth.packageRevision || auth.generationRevision || null);
  }

  store.pages[pageSlug] = {
    reviewStatus,
    notes: String(notes ?? store.pages[pageSlug]?.notes ?? "").slice(0, 2000),
    updatedAt: new Date().toISOString(),
  };
  store.updatedAt = new Date().toISOString();
  writeJsonAtomic(inspectionPath(key), store);

  return buildQualityReviewPageInspectionWorkspace(key);
}

export function resolveQualityReviewPagePreviewRedirect(slug: string, pageSlug: string): string | null {
  const key = resolveTenantProfileSlug(slug) || slug;
  const allowed = new Set(RC1_PAGE_ORDER.map((p) => p.pageSlug));
  if (!allowed.has(pageSlug)) return null;
  if (!resolveCanonicalFinalRenderPagePath(key, pageSlug)) return null;

  const qs = `slug=${encodeURIComponent(key)}`;
  if (pageSlug === "index") {
    return `/api/pharmacy-visual-experience/?${qs}`;
  }
  return `/api/pharmacy-visual-experience/${encodeURIComponent(pageSlug)}/?${qs}`;
}

export function qualityReviewPageInspectionApprovalBlockers(slug: string): string[] {
  return buildQualityReviewPageInspectionWorkspace(slug)?.approvalBlockers || [];
}
