#!/usr/bin/env npx tsx
/**
 * LOCALITY-SELECTION-PERSISTENCE-FIX-01
 * Shared Local Coverage save vs locality-generation read path.
 * Fixture-only. Does not mutate Yorkshire or other production tenants.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as setupImportMod from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import * as generationSetupMod from "../src/pharmacy/masterAdminGenerationSetupService.ts";
import * as generationControlMod from "../src/pharmacy/masterAdminProductOwnerGenerationControlService.ts";
import * as campaignStoreMod from "../src/pharmacy/pharmacyCampaignService.ts";
import * as localAreaResolverMod from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import * as activeCampaignMod from "../src/pharmacy/masterAdminActiveServiceCampaignStore.ts";
import * as cprMod from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import type { ServicePageGenerationRecord } from "../src/pharmacy/masterAdminCoreProductRecoveryModel.ts";
import * as jobMod from "../src/pharmacy/masterAdminJobService.ts";
import * as executiveMod from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import * as profileSchemaMod from "../src/pharmacy/pharmacyProfileSchema.ts";

function namedExports<T extends Record<string, unknown>>(mod: T | { default: T }): T {
  if (mod && typeof mod === "object" && "default" in mod) {
    const inner = (mod as { default: T }).default;
    if (inner && typeof inner === "object") return inner;
  }
  return mod as T;
}

const { readSetupProfile, writeSetupProfile } = namedExports(setupImportMod) as {
  readSetupProfile: (slug: string) => import("../src/pharmacy/pharmacyProfileSchema.ts").PharmacyProfileData;
  writeSetupProfile: (slug: string, data: import("../src/pharmacy/pharmacyProfileSchema.ts").PharmacyProfileData) => void;
};
const { saveGenerationSetupLocalAreas, buildLocalAreaRecommendations } = namedExports(generationSetupMod) as {
  saveGenerationSetupLocalAreas: typeof import("../src/pharmacy/masterAdminGenerationSetupService.ts").saveGenerationSetupLocalAreas;
  buildLocalAreaRecommendations: typeof import("../src/pharmacy/masterAdminGenerationSetupService.ts").buildLocalAreaRecommendations;
};
const { queueProductOwnerLocalityGeneration, buildCampaignLocalitySelectionDashboard } = namedExports(
  generationControlMod,
) as {
  queueProductOwnerLocalityGeneration: typeof import("../src/pharmacy/masterAdminProductOwnerGenerationControlService.ts").queueProductOwnerLocalityGeneration;
  buildCampaignLocalitySelectionDashboard: typeof import("../src/pharmacy/masterAdminProductOwnerGenerationControlService.ts").buildCampaignLocalitySelectionDashboard;
};
const { writePharmacyCampaignStore, readPharmacyCampaignStore } = namedExports(campaignStoreMod) as {
  writePharmacyCampaignStore: typeof import("../src/pharmacy/pharmacyCampaignService.ts").writePharmacyCampaignStore;
  readPharmacyCampaignStore: typeof import("../src/pharmacy/pharmacyCampaignService.ts").readPharmacyCampaignStore;
};
const { resolveLocalLocationHierarchy } = namedExports(localAreaResolverMod) as {
  resolveLocalLocationHierarchy: typeof import("../src/pharmacy/pharmacyLocalAreaResolver.ts").resolveLocalLocationHierarchy;
};
const { writeActiveServiceCampaignSelection } = namedExports(activeCampaignMod) as {
  writeActiveServiceCampaignSelection: typeof import("../src/pharmacy/masterAdminActiveServiceCampaignStore.ts").writeActiveServiceCampaignSelection;
};
const { writeServicePageGenerationRecord } = namedExports(cprMod) as {
  writeServicePageGenerationRecord: typeof import("../src/pharmacy/masterAdminCoreProductRecoveryService.ts").writeServicePageGenerationRecord;
};
const { cancelMasterAdminJob, listMasterAdminJobs, createMasterAdminJob, updateMasterAdminJob } = namedExports(jobMod) as {
  cancelMasterAdminJob: typeof import("../src/pharmacy/masterAdminJobService.ts").cancelMasterAdminJob;
  listMasterAdminJobs: typeof import("../src/pharmacy/masterAdminJobService.ts").listMasterAdminJobs;
  createMasterAdminJob: typeof import("../src/pharmacy/masterAdminJobService.ts").createMasterAdminJob;
  updateMasterAdminJob: typeof import("../src/pharmacy/masterAdminJobService.ts").updateMasterAdminJob;
};
const { WORKSPACE_ROOT } = namedExports(executiveMod) as { WORKSPACE_ROOT: string };
const { defaultProfileData, normalizeProfileData } = namedExports(profileSchemaMod) as {
  defaultProfileData: typeof import("../src/pharmacy/pharmacyProfileSchema.ts").defaultProfileData;
  normalizeProfileData: typeof import("../src/pharmacy/pharmacyProfileSchema.ts").normalizeProfileData;
};

const CANONICAL_LOCALITY_SELECTION_FIELD = "profile.selectedAreas";
const INITIATION_SOURCE = "product_owner_dashboard";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "locality-selection-persistence-fixture";
const CAMPAIGN_ID = "cmp-locality-selection-persistence";
const SERVICE_ID = "travel-vaccinations";
const REVISION = "rev-locality-selection-persistence";
const EIGHT = [
  "Worsbrough",
  "Penistone",
  "Royston",
  "Cudworth",
  "Hoyland",
  "Wombwell",
  "Dodworth",
  "Darton",
];

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function rmrf(target: string) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function emptyCampaign() {
  return {
    id: CAMPAIGN_ID,
    name: "Fixture campaign",
    serviceId: SERVICE_ID,
    serviceName: "Travel Vaccinations",
    campaignGoal: "Increase Visibility" as const,
    createdAt: new Date().toISOString(),
    status: "active" as const,
    assetCounts: {
      servicePage: 1,
      localServicePage: 0,
      faqPage: 0,
      patientGuide: 0,
      blogPosts: 0,
      socialPosts: 0,
      gbpPosts: 0,
      emailSequence: 0,
      videoScript: 0,
      publishingQueue: 0,
      indexingQueue: 0,
      total: 1,
    },
    publishingStatus: "pending" as const,
    indexingStatus: "not_registered",
    visibilityStatus: "unknown",
    publishedPages: 0,
    indexedPages: 0,
    visiblePages: 0,
    links: { ecosystem: "", publishedPage: "", indexing: "", visibility: "" },
    areaSource: "profile" as const,
    campaignAreas: [],
  };
}

function seedProfile(selectedNames: string[]) {
  const data = normalizeProfileData({
    ...defaultProfileData(),
    pharmacyName: "Fixture Pharmacy",
    primaryTown: "Barnsley",
    primaryCity: "Barnsley",
    townCity: "Barnsley",
    selectedAreas: selectedNames.map((areaName, index) => ({
      areaName,
      areaId: areaName.toLowerCase(),
      areaType: "neighbourhood",
      priority: index + 1,
      order: index + 1,
      selected: true,
      source: "generation-setup",
      latitude: 53.5 + index * 0.01,
      longitude: -1.48,
      distanceKm: 4 + index,
      distanceLabel: `${4 + index} km`,
      distanceMethod: "fixture",
      distanceProvenance: { source: "fixture", index },
    })),
  });
  writeSetupProfile(SLUG, data);
}

function seedCampaign(areas: Array<{ areaName: string; selected?: boolean }> = []) {
  writePharmacyCampaignStore({
    version: 1,
    slug: SLUG,
    updatedAt: new Date().toISOString(),
    campaigns: [
      {
        ...emptyCampaign(),
        campaignAreas: areas.map((area, index) => ({
          areaName: area.areaName,
          selected: area.selected !== false,
          source: "legacy-campaign",
          priority: index + 1,
        })),
      },
    ],
  });
  writeActiveServiceCampaignSelection(SLUG, CAMPAIGN_ID, SERVICE_ID);
}

function seedGenerationRecord() {
  const record: ServicePageGenerationRecord = {
    version: 1,
    slug: SLUG,
    serviceId: SERVICE_ID,
    campaignId: CAMPAIGN_ID,
    generationType: "service-page",
    jobId: "job-fixture-service-page",
    initiatedBy: "validator",
    initiationSource: "product_owner_dashboard",
    initiatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: "completed",
    pageTitle: "Travel Vaccinations",
    canonicalUrl: null,
    outputPath: null,
    previewUrl: null,
    wordCount: 800,
    imageAssignmentRevision: REVISION,
    manifestPath: null,
    errors: [],
    warnings: [],
  };
  writeServicePageGenerationRecord(record);
}

function seedCampaignApproval() {
  writeJson(
    path.join(
      WORKSPACE_ROOT,
      "data/pharmacy-master-admin/service-page-review",
      SLUG,
      "by-campaign",
      CAMPAIGN_ID,
      "decision.json",
    ),
    {
      version: 1,
      approvalType: "service-page-review",
      slug: SLUG,
      campaignId: CAMPAIGN_ID,
      serviceId: SERVICE_ID,
      generationRevision: REVISION,
      decision: "approved",
      operator: "validator",
      decidedAt: new Date().toISOString(),
    },
  );
}

function cleanup() {
  const jobsPath = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/jobs.json");
  if (fs.existsSync(jobsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jobsPath, "utf8")) as { jobs?: Array<{ id: string; slug?: string }> };
      const jobs = (raw.jobs || []).filter((job) => job.slug !== SLUG);
      fs.writeFileSync(jobsPath, JSON.stringify({ ...raw, jobs }, null, 2));
    } catch {
      /* ignore */
    }
  }
  rmrf(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${SLUG}.json`));
  rmrf(path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${SLUG}.json`));
  rmrf(path.join(WORKSPACE_ROOT, "data/growth-engine", `${SLUG}-campaign-generation-context-${SERVICE_ID}.json`));
  rmrf(path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-generation", SLUG));
  rmrf(path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-review", SLUG));
  rmrf(path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/active-service-campaign", `${SLUG}.json`));
}

function sourceHasYorkshireProductionBranch(): boolean {
  const files = [
    "src/pharmacy/masterAdminSavedLocalitySelectionService.ts",
    "src/pharmacy/masterAdminGenerationSetupService.ts",
    "src/pharmacy/masterAdminProductOwnerGenerationControlService.ts",
    "src/pharmacy/pharmacyLocalAreaResolver.ts",
    "src/pharmacy/contentEngine/buildContentGenerationContext.ts",
  ];
  return files.some((rel) => {
    const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    return /yorkshire-pharmacy-and-health-clinic/.test(text);
  });
}

function readCanonicalFromProfile() {
  return (readSetupProfile(SLUG).selectedAreas || []).filter((area) => area.selected !== false);
}

async function loadSelectionApi() {
  const href = pathToFileURL(
    path.join(ROOT, "src/pharmacy/masterAdminSavedLocalitySelectionService.ts"),
  ).href;
  const mod = (await import(href)) as Record<string, unknown>;
  const api = (
    typeof mod.readCanonicalSavedLocalityAreas === "function" ? mod : mod.default
  ) as {
    projectCanonicalSelectionOntoCampaign: (
      slug: string,
      campaignId?: string | null,
    ) => { ok: boolean; selectedCount: number; campaignId?: string };
  };
  return api;
}

async function main() {
  console.log("\nLOCALITY-SELECTION-PERSISTENCE-FIX-01\n");
  cleanup();
  const selectionApi = await loadSelectionApi();

  try {
    seedCampaign([]);
    const saved = saveGenerationSetupLocalAreas(SLUG, {
      primaryTown: "Barnsley",
      areas: [
        ...EIGHT.map((areaName) => ({ areaName, selected: true })),
        { areaName: "Thurnscoe", selected: false },
      ],
    });
    record(
      "save-eight-areas",
      saved.selectedCount === 8,
      `Save Areas selectedCount=${saved.selectedCount}`,
    );

    const afterSave = readCanonicalFromProfile();
    const persistedFields = afterSave.every(
      (area) =>
        area.areaId &&
        area.areaName &&
        (area.latitude != null || area.distanceKm != null || area.distanceLabel),
    );
    record(
      "canonical-field",
      CANONICAL_LOCALITY_SELECTION_FIELD === "profile.selectedAreas" && afterSave.length === 8,
      `${CANONICAL_LOCALITY_SELECTION_FIELD} holds ${afterSave.length} selected areas`,
    );
    record("persist-ids-coords-distance", persistedFields, "Saved rows keep areaId/name and distance or coordinates");

    const reread = readSetupProfile(SLUG);
    const refreshSelected = (reread.selectedAreas || []).filter((a) => a.selected !== false).map((a) => a.areaName);
    record(
      "persist-after-refresh",
      refreshSelected.length === 8 && EIGHT.every((name) => refreshSelected.includes(name)),
      `Re-read profile selected=${refreshSelected.join(", ")}`,
    );

    const recs = buildLocalAreaRecommendations(SLUG);
    const recSelected = recs.areas.filter((a) => a.selected).map((a) => a.areaName);
    record(
      "ui-refresh-selection",
      recSelected.filter((name) => EIGHT.includes(name)).length === 8,
      `Local Coverage recommendations restore ${recSelected.filter((name) => EIGHT.includes(name)).length} saved ticks`,
    );

    const projected = selectionApi.projectCanonicalSelectionOntoCampaign(SLUG, CAMPAIGN_ID);
    const campaign = readPharmacyCampaignStore(SLUG)?.campaigns.find((c) => c.id === CAMPAIGN_ID);
    record(
      "active-revision-reads-saved",
      projected.selectedCount === 8 && (campaign?.campaignAreas || []).filter((a) => a.selected !== false).length === 8,
      `Campaign revision ${projected.campaignId} campaignAreas=${campaign?.campaignAreas?.length}`,
    );

    const dashboard = buildCampaignLocalitySelectionDashboard(SLUG, CAMPAIGN_ID);
    record(
      "generate-dashboard-sees-eight",
      (dashboard.selectedAreas || []).length === 8,
      `Dashboard selectedAreas=${dashboard.selectedAreas?.length}`,
    );

    const hierarchy = resolveLocalLocationHierarchy(SLUG, SERVICE_ID, readSetupProfile(SLUG));
    record(
      "eight-generation-inputs",
      hierarchy.ok && hierarchy.clusters.length === 8,
      `hierarchy.ok=${hierarchy.ok} clusters=${hierarchy.clusters.length} source=${hierarchy.trace.selectedAreasSource}`,
    );

    const missingPage = queueProductOwnerLocalityGeneration(SLUG, "validator", {
      operatorConfirmed: true,
      initiationSource: INITIATION_SOURCE,
      mode: "generate_all",
      campaignId: CAMPAIGN_ID,
      serviceId: SERVICE_ID,
    });
    record(
      "missing-service-page-blocker",
      missingPage.ok === false && (missingPage.blockers || []).includes("missing_service_page"),
      missingPage.error || "expected missing_service_page",
    );

    seedGenerationRecord();
    const missingApproval = queueProductOwnerLocalityGeneration(SLUG, "validator", {
      operatorConfirmed: true,
      initiationSource: INITIATION_SOURCE,
      mode: "generate_all",
      campaignId: CAMPAIGN_ID,
      serviceId: SERVICE_ID,
    });
    record(
      "missing-approval-blocker",
      missingApproval.ok === false && (missingApproval.blockers || []).includes("missing_service_page_approval"),
      missingApproval.error || "expected missing_service_page_approval",
    );

    seedCampaignApproval();
    writeSetupProfile(SLUG, {
      ...readSetupProfile(SLUG),
      selectedAreas: (readSetupProfile(SLUG).selectedAreas || []).map((area) => ({ ...area, selected: false })),
    });
    const emptySel = queueProductOwnerLocalityGeneration(SLUG, "validator", {
      operatorConfirmed: true,
      initiationSource: INITIATION_SOURCE,
      mode: "generate_all",
      campaignId: CAMPAIGN_ID,
      serviceId: SERVICE_ID,
    });
    record(
      "empty-selection-blocker",
      emptySel.ok === false && (emptySel.blockers || []).includes("missing_saved_locality_areas"),
      emptySel.error || "expected missing_saved_locality_areas",
    );

    seedProfile(EIGHT);
    selectionApi.projectCanonicalSelectionOntoCampaign(SLUG, CAMPAIGN_ID);
    const seededJob = createMasterAdminJob({
      slug: SLUG,
      action: "generate_local_cluster_pages",
      user: "validator",
    });
    updateMasterAdminJob(seededJob.id, {
      serviceId: SERVICE_ID,
      campaignId: CAMPAIGN_ID,
      status: "queued",
      progressLabel: "Queued generate localities",
    });
    const first = queueProductOwnerLocalityGeneration(SLUG, "validator", {
      operatorConfirmed: true,
      initiationSource: INITIATION_SOURCE,
      mode: "generate_all",
      campaignId: CAMPAIGN_ID,
      serviceId: SERVICE_ID,
    });
    const second = queueProductOwnerLocalityGeneration(SLUG, "validator", {
      operatorConfirmed: true,
      initiationSource: INITIATION_SOURCE,
      mode: "generate_all",
      campaignId: CAMPAIGN_ID,
      serviceId: SERVICE_ID,
    });
    const localityJobs = listMasterAdminJobs({ slug: SLUG, limit: 50 }).filter((j) =>
      ["generate_local_cluster_pages", "regenerate_local_cluster_page", "regenerate_all_local_cluster_pages"].includes(
        j.action,
      ),
    );
    record(
      "one-generation-request",
      Boolean(first.ok && first.jobId === seededJob.id && first.selectedCount === 8),
      `jobId=${first.jobId} selectedCount=${first.selectedCount} reused=${first.jobId === seededJob.id} error=${first.error || "none"}`,
    );
    record(
      "no-duplicate-jobs",
      Boolean(second.ok && second.jobId === first.jobId && localityJobs.length === 1),
      `secondJobId=${second.jobId} localityJobs=${localityJobs.length}`,
    );
    if (first.jobId) {
      try {
        cancelMasterAdminJob(first.jobId, "validator");
      } catch {
        /* already running */
      }
    }

    writeSetupProfile(SLUG, {
      ...readSetupProfile(SLUG),
      selectedAreas: [],
    });
    seedCampaign(EIGHT.slice(0, 3).map((areaName) => ({ areaName, selected: true })));
    const lifted = selectionApi.projectCanonicalSelectionOntoCampaign(SLUG, CAMPAIGN_ID);
    const liftedAreas = readCanonicalFromProfile().map((a) => a.areaName);
    record(
      "legacy-campaign-compatible",
      lifted.selectedCount === 3 && liftedAreas.length === 3,
      `Lifted legacy campaignAreas into ${CANONICAL_LOCALITY_SELECTION_FIELD}: ${liftedAreas.join(", ")}`,
    );

    record(
      "no-tenant-specific-production-logic",
      !sourceHasYorkshireProductionBranch(),
      "Shared workflow files have no Yorkshire slug branches",
    );
  } finally {
    cleanup();
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
