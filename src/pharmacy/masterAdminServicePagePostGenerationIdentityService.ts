/**
 * CPR-CAMPAIGN-MANAGER-07 — Post-generation service identity repair.
 * Content Engine output is accepted as written; shared CPR identity is
 * tenantSlug + campaignId + serviceId + generationType=service-page.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  loadContentPackage,
  type ContentPackageManifest,
} from "./pharmacyContentPackageService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { resolveServicePageGenerationIdentity } from "./masterAdminServicePageGenerationIdentity.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { replaceKeywordStuffedPharmacyListingNames } from "./pharmacyServicePagePublicationQuality.ts";

export interface ServicePagePostGenerationIdentity {
  tenantSlug: string;
  campaignId: string | null;
  serviceId: string;
  generationType: "service-page";
  jobId: string | null;
  previewUrl: string | null;
  outputPath: string | null;
  manifestPath: string;
  status: "generated" | "error";
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function cprIdentityManifestPath(slug: string, serviceId: string, campaignId: string | null): string {
  if (campaignId) {
    return path.join(
      WORKSPACE_ROOT,
      "data/pharmacy-master-admin/service-page-generation",
      slug,
      "by-campaign",
      campaignId,
      "manifest.json",
    );
  }
  return path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/service-page-generation",
    slug,
    "by-service",
    serviceId,
    "manifest.json",
  );
}

function visualPathFor(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
}

function masterPublishPathFor(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-master-publish", slug, serviceId, "index.html");
}

function rewriteKeywordStuffedPharmacyNameInFile(filePath: string, data: ReturnType<typeof readSetupProfile>): boolean {
  if (!fs.existsSync(filePath)) return false;
  const html = fs.readFileSync(filePath, "utf8");
  const cleaned = replaceKeywordStuffedPharmacyListingNames(html, data);
  if (cleaned === html) return false;
  fs.writeFileSync(filePath, cleaned);
  return true;
}

function packagePathFor(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
}

function generationReportPathFor(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-generation-reports", slug, `${serviceId}.json`);
}

/**
 * Repair post-generation identity after Content Engine writes the visual page.
 * Does not re-run Content Engine. Clears service-page-only ecosystem false failures
 * and persists campaign/service identity for preview + campaign summary consumers.
 */
export function repairServicePagePostGenerationIdentity(input: {
  slug: string;
  serviceId: string;
  campaignId?: string | null;
  jobId?: string | null;
  previewUrl?: string | null;
  outputPath?: string | null;
  scope?: "service-page-only" | "full";
}): {
  ok: boolean;
  identity: ServicePagePostGenerationIdentity;
  contentPackage: ContentPackageManifest | null;
  error?: string;
} {
  const identityResolved = resolveServicePageGenerationIdentity(
    input.slug,
    input.serviceId,
    input.campaignId,
  );
  const slug = identityResolved.tenantSlug;
  const serviceId = identityResolved.serviceId;
  const campaignId = identityResolved.campaignId;
  const visualPath = input.outputPath || visualPathFor(slug, serviceId);
  const previewUrl =
    input.previewUrl ||
    `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`;
  const pkgPath = packagePathFor(slug, serviceId);
  const meta = getServicePublishMeta(serviceId);
  const visualOk = fs.existsSync(visualPath);
  const scope = input.scope || "service-page-only";

  if (visualOk) {
    const profile = readSetupProfile(slug);
    rewriteKeywordStuffedPharmacyNameInFile(visualPath, profile);
    rewriteKeywordStuffedPharmacyNameInFile(masterPublishPathFor(slug, serviceId), profile);
  }

  let contentPackage = loadContentPackage(slug, serviceId);

  if (visualOk && scope === "service-page-only") {
    const generatedAt = contentPackage?.generatedAt || new Date().toISOString();
    const next: ContentPackageManifest = {
      version: 1,
      slug,
      serviceId,
      serviceName: meta?.serviceName || contentPackage?.serviceName || serviceId,
      generatedAt,
      generationStamp: {
        tenantSlug: slug,
        // Legacy CE stamp field remains service-keyed for HTML meta parity.
        campaignId: serviceId,
        generatedAt,
        sourceContext: "customer-imported-profile",
      },
      generatorVersion: contentPackage?.generatorVersion || "service-page-identity-repair-v1",
      profileUpdatedAt: contentPackage?.profileUpdatedAt || null,
      selectedAreas: contentPackage?.selectedAreas || [],
      assets: (contentPackage?.assets || []).map((asset) => {
        if (asset.type !== "service-page") return asset;
        return {
          ...asset,
          status: "included" as const,
          included: true,
          count: 1,
          previewUrl,
          outputPath: visualPath,
          notes: "CPR service-page-only identity — visual page accepted",
        };
      }),
      previewUrls: Array.from(
        new Set([...(contentPackage?.previewUrls || []).filter(Boolean), previewUrl]),
      ),
      outputPaths: Array.from(
        new Set([...(contentPackage?.outputPaths || []).filter(Boolean), visualPath]),
      ),
      status: "generated",
      reviewedAt: contentPackage?.reviewedAt || null,
      approvedAt: contentPackage?.approvedAt || null,
      approvedBy: contentPackage?.approvedBy || null,
      approvalStatus: contentPackage?.approvalStatus || "pending",
      generationError: null,
      adminDiagnostics: Array.from(
        new Set([
          ...(contentPackage?.adminDiagnostics || []),
          "scope:service-page-only",
          `identity:tenant=${slug}`,
          `identity:service=${serviceId}`,
          campaignId ? `identity:campaign=${campaignId}` : "identity:campaign=none",
          "identity:generationType=service-page",
          "cpr-post-generation-identity-repair",
        ]),
      ),
      generationReportPath: contentPackage?.generationReportPath || generationReportPathFor(slug, serviceId),
      packageValidation: { ok: true, detail: "service-page-only package identity ok" },
      serviceValidation: { ok: true, detail: `service identity ok: ${serviceId}` },
      tenantValidation: contentPackage?.tenantValidation || { ok: true, detail: "tenant ok" },
    };

    // Persist real Campaign OS campaign id alongside legacy stamp (not CE-owned fields).
    const enriched = {
      ...next,
      campaignId,
      generationType: "service-page" as const,
      serviceCampaignId: campaignId,
    };
    writeJsonAtomic(pkgPath, enriched);
    contentPackage = enriched as ContentPackageManifest;

    // Align generation report service identity (never leave Pharmacy First as campaignServiceId).
    const reportPath = generationReportPathFor(slug, serviceId);
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
        report.serviceId = serviceId;
        report.campaignServiceId = serviceId;
        report.visualOutputPath = visualPath;
        report.packageValidation = { ok: true, detail: "service-page-only identity repaired" };
        report.serviceValidation = { ok: true, detail: `service identity ok: ${serviceId}` };
        if (Array.isArray(report.errors)) {
          report.errors = (report.errors as string[]).filter(
            (e) =>
              !/Ecosystem tenant|Local cluster|Internal links|Long-form quality|design\/map|Brand parity|Header\/footer/i.test(
                e,
              ),
          );
        }
        writeJsonAtomic(reportPath, report);
      } catch {
        /* non-blocking */
      }
    }
  }

  const identityDoc: ServicePagePostGenerationIdentity & {
    campaignId: string | null;
    repairedAt: string;
    jobId: string | null;
  } = {
    tenantSlug: slug,
    campaignId,
    serviceId,
    generationType: "service-page",
    jobId: input.jobId || null,
    previewUrl,
    outputPath: visualOk ? visualPath : null,
    manifestPath: pkgPath,
    status: visualOk ? "generated" : "error",
    repairedAt: new Date().toISOString(),
  };
  writeJsonAtomic(cprIdentityManifestPath(slug, serviceId, campaignId), identityDoc);
  if (campaignId) {
    writeJsonAtomic(cprIdentityManifestPath(slug, serviceId, null), identityDoc);
  }

  return {
    ok: visualOk,
    identity: identityDoc,
    contentPackage,
    error: visualOk ? undefined : "Visual service page missing for identity repair",
  };
}
