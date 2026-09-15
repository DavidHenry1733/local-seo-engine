/**
 * CPR-11 — Scope-aware Visual Experience preview source resolution.
 * Full ecosystem → Canonical Final Render. Service-page-only → persisted generation output.
 */
import fs from "node:fs";
import path from "node:path";
import {
  tenantHasCanonicalFinalRender,
} from "./pharmacyCanonicalFinalRenderPreviewService.ts";
import {
  resolveCanonicalFinalRenderPagePath,
} from "./pharmacyCanonicalFinalRenderService.ts";
import { readServicePageGenerationRecord } from "./masterAdminCoreProductRecoveryService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { resolveVisualExperienceHtmlPath } from "./pharmacyVisualExperience.ts";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";

export type VisualExperiencePreviewScope = "full-ecosystem" | "service-page-only";

export interface ResolvedVisualExperiencePreview {
  scope: VisualExperiencePreviewScope;
  slug: string;
  serviceId: string;
  campaignId: string | null;
  pageSlug: string;
  htmlPath: string;
  jobId: string | null;
  generationRevision: string | null;
  previewRoute: string;
}

function normalizePageSlug(rawPageSlug: string): string {
  const cleaned = String(rawPageSlug || "").replace(/^\/+|\/+$/g, "");
  return cleaned || "index";
}

function pageSlugMatchesService(pageSlug: string, serviceId: string): boolean {
  const normalized = normalizePageSlug(pageSlug);
  const service = normalizeServiceId(serviceId);
  return normalized === service || normalized === "index";
}

function buildPreviewRoute(slug: string, pageSlug: string): string {
  const qs = `slug=${encodeURIComponent(slug)}`;
  const segment = normalizePageSlug(pageSlug);
  if (segment === "index") {
    return `/api/pharmacy-visual-experience/?${qs}`;
  }
  return `/api/pharmacy-visual-experience/${encodeURIComponent(segment)}/?${qs}`;
}

function resolveServicePageOnlyPreview(
  slug: string,
  pageSlug: string,
): ResolvedVisualExperiencePreview | null {
  const requestedPageSlug = normalizePageSlug(pageSlug);
  const active = readActiveServiceCampaignSelection(slug);
  // Prefer explicit page service id; index uses active campaign service only (no primary-service fallback).
  if (requestedPageSlug === "index" && !active?.serviceId) return null;
  const requestedServiceId = normalizeServiceId(
    requestedPageSlug === "index" ? active!.serviceId : requestedPageSlug,
  );
  const campaignId =
    active?.serviceId === requestedServiceId
      ? active.campaignId
      : null;
  // Generation identity is tenant + campaign + service — never tenant-only latest.json.
  const record = readServicePageGenerationRecord(slug, requestedServiceId, campaignId);
  if (!record || record.status !== "completed") return null;
  if (record.serviceId && normalizeServiceId(record.serviceId) !== requestedServiceId) {
    return null;
  }

  const serviceId = normalizeServiceId(record.serviceId || requestedServiceId);
  const effectivePageSlug =
    requestedPageSlug === "index" ? serviceId : requestedPageSlug;
  if (!pageSlugMatchesService(effectivePageSlug, serviceId)) return null;

  const htmlPath =
    record.outputPath && fs.existsSync(record.outputPath)
      ? record.outputPath
      : resolveVisualExperienceHtmlPath(serviceId as VisualExperienceServiceId, slug);
  if (!htmlPath || !fs.existsSync(htmlPath)) return null;

  return {
    scope: "service-page-only",
    slug,
    serviceId,
    campaignId: record.campaignId || campaignId,
    pageSlug: effectivePageSlug,
    htmlPath,
    jobId: record.jobId || null,
    generationRevision: record.imageAssignmentRevision || null,
    previewRoute: record.previewUrl || buildPreviewRoute(slug, effectivePageSlug),
  };
}

function resolveFullEcosystemPreview(
  slug: string,
  pageSlug: string,
): ResolvedVisualExperiencePreview | null {
  if (!tenantHasCanonicalFinalRender(slug)) return null;
  const normalized = normalizePageSlug(pageSlug);
  const htmlPath = resolveCanonicalFinalRenderPagePath(slug, normalized);
  if (!htmlPath) return null;
  const active = readActiveServiceCampaignSelection(slug);
  if (normalized === "index" && !active?.serviceId) return null;
  const serviceId = normalizeServiceId(normalized === "index" ? active!.serviceId : normalized);
  return {
    scope: "full-ecosystem",
    slug,
    serviceId,
    campaignId: active?.serviceId === serviceId ? active.campaignId : null,
    pageSlug: normalized,
    htmlPath,
    jobId: null,
    generationRevision: null,
    previewRoute: buildPreviewRoute(slug, normalized),
  };
}

/** Resolve authenticated preview source by generation scope (generic — all tenants/services). */
export function resolveVisualExperiencePreviewSource(
  rawSlug: unknown,
  rawPageSlug: string,
): ResolvedVisualExperiencePreview | null {
  const slug = resolveTenantProfileSlug(rawSlug);
  if (!slug) return null;
  const pageSlug = normalizePageSlug(rawPageSlug);

  const canonical = resolveFullEcosystemPreview(slug, pageSlug);
  if (canonical) return canonical;

  const serviceOnly = resolveServicePageOnlyPreview(slug, pageSlug);
  if (serviceOnly) return serviceOnly;

  // MVP / CORE-PAGE-28: when a visual service page exists on disk, serve it for PO review
  // even if CPR generation records / canonical final render are absent for this service.
  const requestedServiceId = normalizeServiceId(pageSlug === "index" ? "" : pageSlug);
  if (!requestedServiceId || pageSlug === "index") return null;
  const htmlPath = resolveVisualExperienceHtmlPath(
    requestedServiceId as VisualExperienceServiceId,
    slug,
  );
  if (!htmlPath || !fs.existsSync(htmlPath)) return null;
  return {
    scope: "service-page-only",
    slug,
    serviceId: requestedServiceId,
    campaignId: null,
    pageSlug: requestedServiceId,
    htmlPath,
    jobId: null,
    generationRevision: null,
    previewRoute: buildPreviewRoute(slug, requestedServiceId),
  };
}

function listCompletedServicePagePreviewServices(slug: string): string[] {
  const byServiceDir = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/service-page-generation",
    slug,
    "by-service",
  );
  const services: string[] = ["pharmacy-first"];
  try {
    if (fs.existsSync(byServiceDir)) {
      for (const entry of fs.readdirSync(byServiceDir, { withFileTypes: true })) {
        if (entry.isDirectory() && !services.includes(entry.name)) services.push(entry.name);
      }
    }
  } catch {
    /* ignore */
  }
  return services;
}

/** Tenant slug when any authenticated Visual Experience preview exists for the slug. */
export function resolveVisualExperiencePreviewTenant(rawSlug: unknown): string | null {
  const slug = resolveTenantProfileSlug(rawSlug);
  if (!slug) return null;
  if (tenantHasCanonicalFinalRender(slug)) return slug;
  for (const candidate of listCompletedServicePagePreviewServices(slug)) {
    const record = readServicePageGenerationRecord(slug, candidate);
    if (record?.status !== "completed") continue;
    const serviceId = normalizeServiceId(record.serviceId || candidate);
    const htmlPath =
      record.outputPath && fs.existsSync(record.outputPath)
        ? record.outputPath
        : resolveVisualExperienceHtmlPath(serviceId as VisualExperienceServiceId, slug);
    if (htmlPath && fs.existsSync(htmlPath)) return slug;
  }
  // Disk-backed visual pages (MVP core-page workflow) also unlock the tenant preview scope.
  for (const candidate of ["pharmacy-first", "flu-vaccinations", "blood-pressure-checks", "travel-vaccinations"]) {
    const htmlPath = resolveVisualExperienceHtmlPath(candidate as VisualExperienceServiceId, slug);
    if (htmlPath && fs.existsSync(htmlPath)) return slug;
  }
  return null;
}
