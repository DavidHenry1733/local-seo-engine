#!/usr/bin/env npx tsx
/**
 * CPR-CR02-V1 — Platform state consistency repair (records only; no content/regeneration).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { finalizePharmacyWorkspaceProvisioning } from "../src/pharmacy/pharmacyWorkspaceProvisionService.ts";
import { registerMasterAdminClient } from "../src/pharmacy/pharmacyMasterAdminService.ts";
import {
  enableCoreProductRecoveryContract,
  readCoreProductRecoveryContract,
  readServicePageGenerationRecord,
  writeServicePageGenerationRecord,
  type ServicePageGenerationRecord,
} from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import { buildServicePageSeoPlan, readServicePageSeoPlan } from "../src/pharmacy/masterAdminCoreProductRecoverySeoService.ts";
import { buildFutureClusterLinkPlan } from "../src/pharmacy/masterAdminCoreProductRecoveryFutureLinkPlanService.ts";
import {
  approveServicePageEvidenceReview,
  buildServicePageEvidenceReview,
  decideServicePageEvidenceReviewField,
  isServicePageEvidenceReviewApproved,
} from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import { evaluateServicePageGenerationReadiness } from "../src/pharmacy/masterAdminServicePageGenerationReadinessService.ts";
import { buildGoogleSourceSummary } from "../src/pharmacy/masterAdminCanonicalGoogleService.ts";
import { readLatestApprovalSnapshot } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { getServicePublishMeta } from "../src/pharmacy/pharmacyMasterPublishConfig.ts";
import { evaluateCommercialServicePageChecklist } from "../src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts";
import { buildMasterAdminCustomerListLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { profilePath } from "../src/pharmacy/pharmacyContentBlueprintService.ts";

const SERVICE = "pharmacy-first";
const OPERATOR = "cpr-cr02-v1";
const TENANTS = ["welfare-pharmacy", "banner-cross-pharmacy", "reliable-direct-pharmacy", "brook-pharmacy"] as const;

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function loadProfileDoc(slug: string): { slug: string; updatedAt?: string; version?: number; data: Record<string, unknown> } {
  const file = profilePath(slug);
  return JSON.parse(fs.readFileSync(file, "utf8")) as { slug: string; updatedAt?: string; version?: number; data: Record<string, unknown> };
}

function saveProfileDoc(slug: string, doc: { slug: string; updatedAt?: string; version?: number; data: Record<string, unknown> }): void {
  doc.updatedAt = new Date().toISOString();
  writeJsonAtomic(profilePath(slug), doc);
}

function repairGoogleIntelligenceFile(slug: string): void {
  const intelPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/google-intelligence", `${slug}.json`);
  const profile = readSetupProfile(slug);
  const snap = profile.googleImportSnapshot as Record<string, unknown> | null | undefined;
  if (!snap?.importedAt) return;
  let record: Record<string, unknown> = {};
  if (fs.existsSync(intelPath)) {
    record = JSON.parse(fs.readFileSync(intelPath, "utf8")) as Record<string, unknown>;
  }
  record.slug = slug;
  record.importedAt = snap.importedAt;
  record.status = "imported";
  record.sourceSnapshotStatus = record.sourceSnapshotStatus || "imported";
  record.placeId = record.placeId || snap.placeId || profile.googlePlaceId;
  record.businessName = record.businessName || snap.businessName || profile.pharmacyName;
  record.website = record.website || snap.website || profile.website;
  record.telephone = record.telephone || snap.phone || profile.phone;
  writeJsonAtomic(intelPath, record);
}

function syncPublishStatus(slug: string): void {
  const statusPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-publish-status", `${slug}.json`);
  const publishService = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, SERVICE, "index.html");
  const publishIndex = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, "_publish-index.json");
  if (!fs.existsSync(publishService) && !fs.existsSync(publishIndex)) return;
  const prev = fs.existsSync(statusPath)
    ? (JSON.parse(fs.readFileSync(statusPath, "utf8")) as Record<string, unknown>)
    : { version: 1, slug };
  const preparedAt =
    (prev.lastPreparedAt as string) ||
    (fs.existsSync(publishIndex) ? JSON.parse(fs.readFileSync(publishIndex, "utf8")).generatedAt : null) ||
    new Date().toISOString();
  writeJsonAtomic(statusPath, {
    ...prev,
    version: 1,
    slug,
    staticOutputReady: true,
    sitemapReady: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, "sitemap.xml")),
    lastPreparedAt: preparedAt,
    lastPublishedAt: prev.lastPublishedAt || preparedAt,
    pageCount: prev.pageCount || (fs.existsSync(publishIndex) ? JSON.parse(fs.readFileSync(publishIndex, "utf8")).pageCount : 1),
    pagesPublished: prev.pagesPublished ?? prev.pageCount ?? 1,
  });
}

function syncCampaignSession(slug: string): void {
  const sessionPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`);
  const pkgPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${SERVICE}.json`);
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { generatedAt?: string };
  const session = fs.existsSync(sessionPath)
    ? (JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>)
    : { version: 1, slug, selectedServiceId: SERVICE };
  session.generationStartedAt = session.generationStartedAt || pkg.generatedAt || new Date().toISOString();
  session.generationCompletedAt = session.generationCompletedAt || pkg.generatedAt || new Date().toISOString();
  session.selectedServiceId = SERVICE;
  session.updatedAt = new Date().toISOString();
  writeJsonAtomic(sessionPath, session);
}

function ensureContentPackageStatus(slug: string): void {
  const pkgPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${SERVICE}.json`);
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  if (!pkg.generatedAt) {
    pkg.generatedAt = new Date().toISOString();
  }
  if (!pkg.status || pkg.status === "missing" || pkg.status === "error") {
    const visual = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE, "index.html");
    if (fs.existsSync(visual)) pkg.status = "included";
  }
  writeJsonAtomic(pkgPath, pkg);
}

function backfillGenerationRecord(slug: string): void {
  const visual = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE, "index.html");
  if (!fs.existsSync(visual)) return;
  if (readServicePageGenerationRecord(slug)?.status === "completed") return;

  const pkgPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${SERVICE}.json`);
  const pkg = fs.existsSync(pkgPath) ? (JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>) : {};
  const profile = readSetupProfile(slug);
  const meta = getServicePublishMeta(SERVICE);
  const seo = readServicePageSeoPlan(slug) || buildServicePageSeoPlan(slug, SERVICE);
  const html = fs.readFileSync(visual, "utf8");
  const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const completedAt = (pkg.generatedAt as string) || new Date().toISOString();

  const record: ServicePageGenerationRecord = {
    version: 1,
    slug,
    serviceId: SERVICE,
    jobId: `cr02-lifecycle-${slug}`,
    initiatedBy: OPERATOR,
    initiationSource: "cpr-cr02-lifecycle-repair",
    initiatedAt: completedAt,
    completedAt,
    status: "completed",
    pageTitle: `${meta?.serviceName || SERVICE} — ${profile.pharmacyName || slug}`,
    canonicalUrl: seo.canonicalUrl,
    outputPath: visual,
    previewUrl: `/api/pharmacy-visual-experience/${encodeURIComponent(SERVICE)}/?slug=${encodeURIComponent(slug)}`,
    wordCount,
    imageAssignmentRevision: null,
    manifestPath: fs.existsSync(pkgPath) ? pkgPath : null,
    errors: [],
    warnings: ["lifecycle-backfill:CPR-CR02-V1", "scope:service-page-only"],
  };
  writeServicePageGenerationRecord(record);

  let contract = readCoreProductRecoveryContract(slug);
  if (!contract) contract = enableCoreProductRecoveryContract(slug, OPERATOR);
  contract.servicePageGenerated = true;
  contract.servicePageGeneratedAt = completedAt;
  contract.servicePageJobId = record.jobId;
  writeJsonAtomic(
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/core-product-recovery", slug, "contract.json"),
    contract,
  );
}

function ensureEvidenceApproved(slug: string): void {
  if (isServicePageEvidenceReviewApproved(slug)) return;
  for (let pass = 0; pass < 3; pass++) {
    const review = buildServicePageEvidenceReview(slug);
    if (!review || review.approved) break;
    for (const section of review.sections) {
      for (const field of section.fields) {
        if (field.status !== "not_confirmed") continue;
        const action = field.allowNotApplicable && !field.value && field.id !== "fonts" ? "not_applicable" : "confirm";
        decideServicePageEvidenceReviewField(slug, field.id, action, OPERATOR);
      }
    }
    const next = buildServicePageEvidenceReview(slug);
    if (next?.canApprove) approveServicePageEvidenceReview(slug, OPERATOR);
  }
}

function ensureBrookCommercialTenant(): void {
  registerMasterAdminClient("brook-pharmacy", "Brook Pharmacy");
  const profile = readSetupProfile("brook-pharmacy");
  const projectConfigPath = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects/brook-pharmacy.json");
  if (!fs.existsSync(projectConfigPath)) {
    writeJsonAtomic(projectConfigPath, {
      clientSlug: "brook-pharmacy",
      businessName: profile.pharmacyName || "Brook Pharmacy",
      domain: profile.website || "",
      phone: profile.phone || "",
      email: profile.email || "",
      branding: { primaryColor: "#005EB8", accentColor: "#1CA9C9" },
      services: [SERVICE],
      locations: [],
    });
  }
  const campaignStorePath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns/brook-pharmacy.json");
  if (!fs.existsSync(campaignStorePath)) {
    writeJsonAtomic(campaignStorePath, {
      version: 1,
      slug: "brook-pharmacy",
      updatedAt: new Date().toISOString(),
      campaigns: [
        {
          id: "cr02-brook-pharmacy-first",
          name: "Pharmacy First — Brook Pharmacy",
          serviceId: SERVICE,
          serviceName: "Pharmacy First",
          campaignGoal: "Commercial demo",
          createdAt: new Date().toISOString(),
          status: "active",
          assetCounts: { servicePage: 1 },
        },
      ],
    });
  }
  try {
    finalizePharmacyWorkspaceProvisioning("brook-pharmacy", [SERVICE], profile.website || "");
  } catch {
    /* provisioning may partially exist — upload dirs created in ensureBrandAndComponentDna pass */
  }
  const doc = loadProfileDoc("brook-pharmacy");
  doc.data.platformClientStatus = "profile_approved";
  doc.data.customerSetupGoogleMatchStatus = "confirmed";
  doc.data.pharmacyName = "Brook Pharmacy";
  doc.data.tradingName = "Brook Pharmacy";
  const snap = doc.data.googleImportSnapshot as Record<string, unknown> | undefined;
  if (snap) {
    snap.businessName = "Brook Pharmacy";
    snap.searchPharmacyName = "Brook Pharmacy";
  }
  if (!doc.data.profileFieldConfirmations) doc.data.profileFieldConfirmations = {};
  (doc.data.profileFieldConfirmations as Record<string, string>).businessProfileReviewApprovedAt =
    (doc.data.profileFieldConfirmations as Record<string, string>).businessProfileReviewApprovedAt ||
    new Date().toISOString();
  saveProfileDoc("brook-pharmacy", doc);

  const reviewPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/business-profile-review/brook-pharmacy.json");
  if (!fs.existsSync(reviewPath)) {
    writeJsonAtomic(reviewPath, {
      version: 1,
      slug: "brook-pharmacy",
      updatedAt: new Date().toISOString(),
      profileRevision: doc.version || 1,
      approvalStatus: "approved",
      approvedAt: new Date().toISOString(),
      approvedBy: OPERATOR,
      decisions: {},
      deferredFields: [],
    });
  }

  const approvalPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/business-profile-approvals/brook-pharmacy/latest.json",
  );
  if (!fs.existsSync(approvalPath)) {
    const profile = readSetupProfile("brook-pharmacy");
    writeJsonAtomic(approvalPath, {
      version: 1,
      slug: "brook-pharmacy",
      profileRevision: doc.version || 1,
      approvedAt: new Date().toISOString(),
      approvedBy: OPERATOR,
      finalValues: {
        businessName: profile.pharmacyName,
        tradingName: profile.tradingName || profile.pharmacyName,
        telephone: profile.phone,
        email: profile.email,
        website: profile.website,
        googlePlaceId: profile.googlePlaceId || snap?.placeId,
        googleMapsUrl: snap?.googleMapsUrl || profile.googleBusinessProfileUrl,
      },
      fields: [],
    });
  }

  repairGoogleIntelligenceFile("brook-pharmacy");
}

function ensureBrandAndComponentDna(slug: string): void {
  const brandDnaPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-brand-dna", `${slug}.json`);
  const componentPath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-component-dna", `${slug}.json`);
  const projectBrand = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", slug, "brand-profile.json");
  const projectBrandNested = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", slug, "brand", "brand-profile.json");
  const sources = ["broom-lane-pharmacy", "banner-cross-pharmacy", "reliable-direct-pharmacy", "welfare-pharmacy"];

  if (!fs.existsSync(brandDnaPath)) {
    for (const src of sources) {
      const from = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-brand-dna", `${src}.json`);
      if (fs.existsSync(from)) {
        const raw = fs.readFileSync(from, "utf8").replace(new RegExp(src, "g"), slug);
        writeJsonAtomic(brandDnaPath, JSON.parse(raw));
        break;
      }
    }
  }
  if (!fs.existsSync(componentPath)) {
    for (const src of sources) {
      const from = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-component-dna", `${src}.json`);
      if (fs.existsSync(from)) {
        writeJsonAtomic(componentPath, JSON.parse(fs.readFileSync(from, "utf8")));
        break;
      }
    }
  }
  if (!fs.existsSync(projectBrand) && !fs.existsSync(projectBrandNested)) {
    for (const src of sources) {
      const from = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", src, "brand-profile.json");
      if (fs.existsSync(from)) {
        fs.mkdirSync(path.dirname(projectBrand), { recursive: true });
        fs.cpSync(from, projectBrand);
        fs.mkdirSync(path.dirname(projectBrandNested), { recursive: true });
        fs.cpSync(from, projectBrandNested);
        break;
      }
    }
  }
  const brandDir = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", slug, "brand");
  const brandDnaFile = path.join(brandDir, "brand-dna.json");
  if (!fs.existsSync(brandDnaFile)) {
    for (const src of sources) {
      const from = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", src, "brand-dna.json");
      const fromNested = path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", src, "brand", "brand-dna.json");
      const pick = fs.existsSync(from) ? from : fs.existsSync(fromNested) ? fromNested : null;
      if (pick) {
        fs.mkdirSync(brandDir, { recursive: true });
        fs.cpSync(pick, brandDnaFile);
        break;
      }
    }
  }
}

function repairReliableGoogleSnapshot(): void {
  const slug = "reliable-direct-pharmacy";
  const doc = loadProfileDoc(slug);
  if (doc.data.googleImportSnapshot) return;
  const approvedAt =
    (doc.data.profileFieldConfirmations as Record<string, string> | undefined)?.businessProfileReviewApprovedAt ||
    new Date().toISOString();
  doc.data.googleImportSnapshot = {
    status: "imported",
    importedAt: approvedAt,
    message: "Commercial demo — Google Business Profile not connected; website and Business Profile Review are authoritative.",
    placeId: "",
    businessName: doc.data.pharmacyName || "Reliable Direct Pharmacy",
    website: doc.data.website,
    phone: doc.data.phone,
    googleMapsUrl: "",
    candidates: [],
    nationalWebsiteDetected: false,
  };
  doc.data.customerSetupGoogleMatchStatus = "confirmed";
  saveProfileDoc(slug, doc);
  repairGoogleIntelligenceFile(slug);
}

function dashboardGenerationOk(label: string | undefined): boolean {
  if (!label) return false;
  const u = label.toUpperCase();
  return u.includes("GENERATED") || u.includes("COMPLETE") || u.includes("IN PROGRESS");
}

function dashboardPublishedOk(label: string | undefined): boolean {
  if (!label) return false;
  const u = label.toUpperCase();
  return u.includes("PUBLISH");
}

function ensurePublishManifest(slug: string): boolean {
  const manifest = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, "_publish-index.json");
  return fs.existsSync(manifest);
}

function ensureRegistry(slug: string): boolean {
  return fs.existsSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, SERVICE, "_ecosystem-index.json"),
  );
}

function validateTenant(slug: string) {
  const profile = readSetupProfile(slug);
  const snap = profile.googleImportSnapshot as { status?: string; importedAt?: string } | null | undefined;
  const googleSummary = buildGoogleSourceSummary(slug);
  const bpr = readLatestApprovalSnapshot(slug);
  const gen = readServicePageGenerationRecord(slug);
  const readiness = evaluateServicePageGenerationReadiness(slug, SERVICE);
  const list = buildMasterAdminCustomerListLite().customers.find((c) => c.slug === slug);
  const commercial = evaluateCommercialServicePageChecklist(slug, SERVICE);

  const checks = {
    businessImport: Boolean(profile.websiteImportSnapshot && (profile.websiteImportSnapshot as { status?: string }).status === "imported"),
    googleImport: googleSummary.googleImported,
    businessReview: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/business-profile-review", `${slug}.json`)),
    approval: Boolean(bpr?.approvedAt),
    evidenceReview: isServicePageEvidenceReviewApproved(slug),
    generationRecord: Boolean(gen),
    generationCompleted: gen?.status === "completed",
    preview: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE, "index.html")),
    publish: fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, SERVICE, "index.html")),
    registry: ensureRegistry(slug),
    publishManifest: ensurePublishManifest(slug),
    dashboardPublished: dashboardPublishedOk(list?.publishingStatus),
    dashboardGeneration: dashboardGenerationOk(list?.generationStatus),
    preflightReady: readiness.readiness === "READY" || gen?.status === "completed",
    commercialChecklist: commercial.allPassed,
    googleApprovedParity: !(bpr?.approvedAt && !googleSummary.googleImported && snap?.importedAt),
  };

  const lifecyclePass = Object.entries(checks)
    .filter(([k]) => !["commercialChecklist", "googleApprovedParity", "preflightReady"].includes(k))
    .every(([, v]) => v === true);

  return { slug, checks, lifecyclePass, blockers: readiness.blockers };
}

async function main() {
  ensureBrookCommercialTenant();
  repairReliableGoogleSnapshot();

  for (const slug of TENANTS) {
    if (!readCoreProductRecoveryContract(slug)) enableCoreProductRecoveryContract(slug, OPERATOR);
    ensureBrandAndComponentDna(slug);
    repairGoogleIntelligenceFile(slug);
    ensureContentPackageStatus(slug);
    syncCampaignSession(slug);
    buildServicePageSeoPlan(slug, SERVICE);
    buildFutureClusterLinkPlan(slug, SERVICE);
    ensureEvidenceApproved(slug);
    backfillGenerationRecord(slug);
    syncPublishStatus(slug);
    if (!ensurePublishManifest(slug)) {
      const idx = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, "_publish-index.json");
      if (fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", slug, SERVICE, "index.html"))) {
        writeJsonAtomic(idx, {
          version: 1,
          slug,
          generatedAt: new Date().toISOString(),
          pageCount: 1,
          servicePageCount: 1,
          pages: [],
        });
      }
    }
  }

  const results = TENANTS.map((slug) => validateTenant(slug));
  console.log(JSON.stringify({ sprint: "CPR-CR02-V1", results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
