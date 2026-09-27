#!/usr/bin/env npx tsx
/**
 * HOTFIX-02 — tenant service authority.
 * Create, edit-onboarding, and Business Profile Review use the real routes.
 * Acceptance and historical tenants are read-only.
 */
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { readSetupProfile, writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { listMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";
import { listLockedCommercialServicesWithGenerationReadiness } from "../src/pharmacy/masterAdminServiceGenerationReadinessService.ts";
import { removeMasterAdminRegistryEntry } from "../src/pharmacy/pharmacyMasterAdminService.ts";
import type { PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const require = createRequire(path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/package.json"));
const express = require("express") as typeof import("express");
const platformRouter = (await import("../artifacts/api-server/src/routes/api/masterAdminPlatform.ts")).default;

const ACCEPTANCE = "pharmaconnect-e2e-test-pharmacy-2";
const HISTORICAL = [
  "brook-pharmacy",
  "yorkshire-pharmacy-and-health-clinic",
  "leeds-pharmacy",
  "vision-pharmacy",
  "banner-cross-pharmacy",
];
const REGISTRY = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/registry.json");
const USERS = path.join(PHARMACY_WORKSPACE_ROOT, "config/users.json");
const META = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/client-meta.json");
const PAGE = path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
const INHERITED = "hotfix02-inherited-default";
const failures: string[] = [];
const createdSlugs: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
}

function shaFile(file: string): string {
  if (!fs.existsSync(file)) return "ABSENT";
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function slugHash(slug: string): string {
  const listed = execSync(`find data config -path '*${slug}*' -type f 2>/dev/null | sort`, {
    cwd: PHARMACY_WORKSPACE_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hash = crypto.createHash("sha256");
  for (const rel of listed) hash.update(rel).update(shaFile(path.join(PHARMACY_WORKSPACE_ROOT, rel)));
  return `${listed.length}:${hash.digest("hex")}`;
}

function removeSlugFiles(slug: string): void {
  const listed = execSync(`find data config -path '*${slug}*' 2>/dev/null | sort`, {
    cwd: PHARMACY_WORKSPACE_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const rel of listed) {
    if (rel.endsWith("registry.json") || rel.endsWith("users.json") || rel.endsWith("client-meta.json") || rel.endsWith("audit-log.json")) {
      continue;
    }
    fs.rmSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), { recursive: true, force: true });
  }
}

type ReviewRow = {
  canonicalServiceId?: string;
  matchState?: string;
  matchStateLabel?: string;
  proposedForCanonical?: boolean;
  configuredServiceName?: string | null;
};

function configuredIds(review: { serviceReconciliation?: { rows?: ReviewRow[] } }): string[] {
  return (review.serviceReconciliation?.rows || [])
    .filter((row) => row.matchState === "CONFIGURED_NOT_CONFIRMED" || row.matchState === "CONFIRMED_MATCH")
    .map((row) => String(row.canonicalServiceId || ""));
}

async function waitForJobs(slug: string): Promise<void> {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const active = listMasterAdminJobs({ slug, limit: 20 }).filter((job) =>
      ["queued", "claimed", "running"].includes(job.status),
    );
    if (!active.length) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function baseIntake(name: string, serviceId: string) {
  return {
    pharmacyName: name,
    website: "http://127.0.0.1:9/",
    contactEmail: "hotfix02@example.test",
    phone: "0141 000 0002",
    postcode: "PA1 2BS",
    addressLine1: "10 High Street",
    addressLine2: "",
    townOrCity: "Paisley",
    county: "Renfrewshire",
    country: "United Kingdom",
    primaryServiceId: serviceId,
    googleBusinessProfileUrl: "",
    googlePlaceId: "",
    googleProfileState: "deferred",
    marketScope: "local_regional",
    primaryMarket: "",
  };
}

async function main(): Promise<void> {
  console.log("\n=== HOTFIX-02 tenant service authority ===\n");
  const registryBefore = fs.readFileSync(REGISTRY);
  const usersBefore = fs.existsSync(USERS) ? fs.readFileSync(USERS) : null;
  const metaBefore = fs.existsSync(META) ? fs.readFileSync(META) : null;
  const acceptanceBefore = slugHash(ACCEPTANCE);
  const historicalBefore = Object.fromEntries(HISTORICAL.map((slug) => [slug, shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`))]));
  const acceptanceProfileBefore = shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${ACCEPTANCE}.json`));
  const acceptanceCampaignBefore = shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${ACCEPTANCE}.json`));
  const acceptanceProjectBefore = shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", `${ACCEPTANCE}.json`));
  const acceptanceBatchBefore = shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/onboarding-batches", `${ACCEPTANCE}.json`));

  const app = express();
  app.use(express.json());
  app.use("/api", platformRouter);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const token = process.env.SESSION_SECRET || "dev-fallback-secret-change-in-prod";

  async function call(method: string, urlPath: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const response = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
      method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-internal-token": token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await response.json()) as Record<string, unknown>;
    return { status: response.status, json };
  }

  try {
    const page = fs.readFileSync(PAGE, "utf8");
    const createSelect = page.slice(page.indexOf('id="createPrimaryService"'), page.indexOf('id="createPrimaryService"') + 220);
    const intakeSelect = page.slice(page.indexOf('id="intakePrimaryService"'), page.indexOf('id="intakePrimaryService"') + 280);
    assert(createSelect.includes('value="">Select a service…'), "Create New Pharmacy starts with no service selected");
    assert(intakeSelect.includes("renderLockedServiceOptions()") || intakeSelect.includes("blood-pressure-checks") || page.includes('id="intakePrimaryService"><option value="">Select a service…</option>${renderLockedServiceOptions()}'), "Edit Onboarding Setup lists the available catalogue");
    assert(!page.includes("intakePrimaryService.value=i.primaryServiceId||'pharmacy-first'"), "edit form does not fall back to Pharmacy First");
    assert(page.includes("intakePrimaryService').value=i.primaryServiceId||''"), "edit form renders the persisted primary service");

    const catalogue = listLockedCommercialServicesWithGenerationReadiness();
    const other = catalogue.find((service) => service.generationReady && service.serviceId !== "pharmacy-first" && service.serviceId !== "blood-pressure-checks");
    assert(Boolean(other), "catalogue still offers a service other than Pharmacy First and Blood Pressure Checks");
    const otherId = other?.serviceId || "travel-vaccinations";

    const rejected = await call("POST", "/api/master-admin-platform/customers", baseIntake("Hotfix02 No Service Pharmacy", ""));
    assert(rejected.status === 400 && String(rejected.json.error || "").includes("Primary service is required"), `create rejects a missing primary service (${rejected.status} ${rejected.json.error})`);
    assert(
      !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles")) ||
        !execSync("find data/pharmacy-profiles -name '*.json' -print", { cwd: PHARMACY_WORKSPACE_ROOT, encoding: "utf8" }).includes("Hotfix02 No Service"),
      "rejected create did not write a pharmacy profile",
    );

    const createdB = await call("POST", "/api/master-admin-platform/customers", baseIntake("Hotfix02 Blood Pressure Pharmacy", "blood-pressure-checks"));
    const slugB = String(createdB.json.slug || "");
    if (slugB) createdSlugs.push(slugB);
    assert(createdB.status === 200 && slugB.startsWith("hotfix02-blood-pressure"), `create with Blood Pressure Checks (${createdB.status} ${slugB} ${createdB.json.error || ""})`);
    await waitForJobs(slugB);
    const intakeB = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(slugB)}/onboarding-intake`);
    const intakeBody = (intakeB.json.intake || {}) as Record<string, unknown>;
    assert(intakeBody.primaryServiceId === "blood-pressure-checks", `edit onboarding shows Blood Pressure Checks (${intakeBody.primaryServiceId})`);
    const savedB = await call("POST", `/api/master-admin-platform/customers/${encodeURIComponent(slugB)}/onboarding-intake`, {
      ...baseIntake("Hotfix02 Blood Pressure Pharmacy", "blood-pressure-checks"),
      pharmacyName: intakeBody.pharmacyName,
    });
    assert(savedB.status === 200, `edit onboarding save (${savedB.status} ${savedB.json.error || ""})`);
    const profileB = readSetupProfile(slugB);
    assert(
      JSON.stringify(profileB.selectedServices) === JSON.stringify(["blood-pressure-checks"]),
      `configured selectedServices is only Blood Pressure Checks (${profileB.selectedServices})`,
    );
    assert(
      !(profileB.priorityServices || []).includes("pharmacy-first"),
      `priority is not Pharmacy First (${profileB.priorityServices})`,
    );
    const reviewB = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(slugB)}/business-profile-review`);
    const reviewBBody = (reviewB.json.review || {}) as {
      serviceReconciliation?: { rows?: ReviewRow[] };
      fields?: Array<{ id?: string; applicability?: string; requiresAction?: boolean }>;
    };
    const configuredB = configuredIds(reviewBBody);
    assert(JSON.stringify(configuredB) === JSON.stringify(["blood-pressure-checks"]), `Business Profile Review configured services (${configuredB})`);
    const pfField = (reviewBBody.fields || []).find((field) => field.id === "pharmacyFirstAvailability");
    assert(pfField?.applicability === "not_applicable" && pfField.requiresAction === false, `Pharmacy First availability is not required (${pfField?.applicability})`);
    const campaignB = JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${slugB}.json`), "utf8")) as {
      campaigns?: Array<{ serviceId?: string }>;
    };
    assert(
      (campaignB.campaigns || []).every((campaign) => campaign.serviceId === "blood-pressure-checks"),
      `placeholder campaign uses the explicit service (${(campaignB.campaigns || []).map((c) => c.serviceId)})`,
    );
    assert(catalogue.some((service) => service.serviceId === "pharmacy-first"), "global catalogue still lists Pharmacy First as available");

    const createdC = await call("POST", "/api/master-admin-platform/customers", baseIntake("Hotfix02 Other Service Pharmacy", otherId));
    const slugC = String(createdC.json.slug || "");
    if (slugC) createdSlugs.push(slugC);
    assert(createdC.status === 200, `create with ${otherId} (${createdC.status} ${createdC.json.error || ""})`);
    await waitForJobs(slugC);
    const intakeC = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(slugC)}/onboarding-intake`);
    assert((intakeC.json.intake as { primaryServiceId?: string })?.primaryServiceId === otherId, `edit onboarding shows ${otherId}`);
    const reviewC = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(slugC)}/business-profile-review`);
    const configuredC = configuredIds((reviewC.json.review || {}) as { serviceReconciliation?: { rows?: ReviewRow[] } });
    assert(JSON.stringify(configuredC) === JSON.stringify([otherId]), `only ${otherId} is configured (${configuredC})`);

    const createdD = await call("POST", "/api/master-admin-platform/customers", baseIntake("Hotfix02 Discovered Service Pharmacy", "blood-pressure-checks"));
    const slugD = String(createdD.json.slug || "");
    if (slugD) createdSlugs.push(slugD);
    assert(createdD.status === 200, `discovery tenant created (${createdD.status} ${createdD.json.error || ""})`);
    await waitForJobs(slugD);
    const existingD = readSetupProfile(slugD);
    writeSetupProfile(slugD, {
      ...existingD,
      selectedServices: ["blood-pressure-checks"],
      websiteImportSnapshot: {
        status: "completed",
        importedAt: "2026-09-27T12:00:00.000Z",
        message: "Fixture website evidence",
        websiteUrl: "http://127.0.0.1:9/",
        logoUrl: "",
        brandPrimaryColor: "",
        brandSecondaryColor: "",
        brandAccentColor: "",
        brandBackgroundColor: "",
        brandTextColor: "",
        phone: "",
        email: "",
        address: "",
        town: "",
        postcode: "",
        socialLinks: [],
        footerLinks: [],
        servicesDetected: [],
        customerVisibleServices: [
          {
            serviceId: "flu-vaccinations",
            serviceName: "Flu Vaccinations",
            sourceUrl: "http://127.0.0.1:9/flu",
            matchedSnippet: "Flu vaccinations",
            detectionMethod: "page-text",
            confidence: 0.9,
          },
        ],
        description: "",
        openingHours: "",
        intelligence: null,
        regulatoryEvidence: [],
      },
    } as PharmacyProfileData);
    const reviewD = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(slugD)}/business-profile-review`);
    const rowsD = ((reviewD.json.review || {}) as { serviceReconciliation?: { rows?: ReviewRow[] } }).serviceReconciliation?.rows || [];
    const bpc = rowsD.find((row) => row.canonicalServiceId === "blood-pressure-checks");
    const flu = rowsD.find((row) => row.canonicalServiceId === "flu-vaccinations");
    assert(bpc?.matchState === "CONFIGURED_NOT_CONFIRMED" || bpc?.matchState === "CONFIRMED_MATCH", `configured service stays configured (${bpc?.matchState})`);
    assert(flu?.matchState === "NEWLY_DISCOVERED" && flu.proposedForCanonical === true, `discovered service stays proposed (${flu?.matchState} proposed=${flu?.proposedForCanonical})`);
    assert(flu?.matchState !== "CONFIGURED_NOT_CONFIRMED", "discovered service is not labeled configured");

    const createdE1 = await call("POST", "/api/master-admin-platform/customers", baseIntake("Hotfix02 Isolation Alpha Pharmacy", "blood-pressure-checks"));
    const createdE2 = await call("POST", "/api/master-admin-platform/customers", baseIntake("Hotfix02 Isolation Beta Pharmacy", otherId));
    const slugE1 = String(createdE1.json.slug || "");
    const slugE2 = String(createdE2.json.slug || "");
    if (slugE1) createdSlugs.push(slugE1);
    if (slugE2) createdSlugs.push(slugE2);
    await waitForJobs(slugE1);
    await waitForJobs(slugE2);
    const reviewE1 = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(slugE1)}/business-profile-review`);
    const reviewE2 = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(slugE2)}/business-profile-review`);
    const idsE1 = configuredIds((reviewE1.json.review || {}) as { serviceReconciliation?: { rows?: ReviewRow[] } });
    const idsE2 = configuredIds((reviewE2.json.review || {}) as { serviceReconciliation?: { rows?: ReviewRow[] } });
    assert(JSON.stringify(idsE1) === JSON.stringify(["blood-pressure-checks"]), `tenant A isolation (${idsE1})`);
    assert(JSON.stringify(idsE2) === JSON.stringify([otherId]), `tenant B isolation (${idsE2})`);

    writeSetupProfile(INHERITED, {
      pharmacyName: "Hotfix02 Inherited Default",
      website: "http://127.0.0.1:9/",
      addressLine1: "10 High Street",
      primaryTown: "Paisley",
      townCity: "Paisley",
      postcode: "PA1 2BS",
      country: "United Kingdom",
      marketScope: "local_regional",
      selectedServices: ["blood-pressure-checks"],
      priorityServices: ["pharmacy-first"],
      googleProfileOnboardingState: "deferred",
      websiteImportSnapshot: {
        status: "not_found",
        importedAt: "2026-09-27T11:57:14.763Z",
        message: "Website import incomplete.",
        websiteUrl: "http://127.0.0.1:9/",
        logoUrl: "",
        brandPrimaryColor: "",
        brandSecondaryColor: "",
        brandAccentColor: "",
        brandBackgroundColor: "",
        brandTextColor: "",
        phone: "",
        email: "",
        address: "",
        town: "",
        postcode: "",
        socialLinks: [],
        footerLinks: [],
        servicesDetected: [],
        customerVisibleServices: [],
        description: "",
        openingHours: "",
        intelligence: null,
        regulatoryEvidence: [],
      },
    } as PharmacyProfileData);
    const reviewInherited = await call("GET", `/api/master-admin-platform/customers/${encodeURIComponent(INHERITED)}/business-profile-review`);
    const inheritedIds = configuredIds((reviewInherited.json.review || {}) as { serviceReconciliation?: { rows?: ReviewRow[] } });
    assert(JSON.stringify(inheritedIds) === JSON.stringify(["blood-pressure-checks"]), `inherited Pharmacy First priority is not configured (${inheritedIds})`);
    const inheritedRows = ((reviewInherited.json.review || {}) as { serviceReconciliation?: { rows?: ReviewRow[] } }).serviceReconciliation?.rows || [];
    assert(!inheritedRows.some((row) => row.canonicalServiceId === "pharmacy-first"), "failed website import does not invent Pharmacy First");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const slug of createdSlugs) {
      try {
        removeMasterAdminRegistryEntry(slug);
      } catch {
        /* registry restore below */
      }
      removeSlugFiles(slug);
    }
    removeSlugFiles(INHERITED);
    fs.writeFileSync(REGISTRY, registryBefore);
    if (usersBefore) fs.writeFileSync(USERS, usersBefore);
    if (metaBefore) fs.writeFileSync(META, metaBefore);
  }

  assert(slugHash(ACCEPTANCE) === acceptanceBefore, "acceptance tenant files unchanged");
  assert(shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${ACCEPTANCE}.json`)) === acceptanceProfileBefore, "acceptance profile bytes unchanged");
  assert(shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${ACCEPTANCE}.json`)) === acceptanceCampaignBefore, "acceptance campaign bytes unchanged");
  assert(shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "config/projects", `${ACCEPTANCE}.json`)) === acceptanceProjectBefore, "acceptance project config bytes unchanged");
  assert(shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/onboarding-batches", `${ACCEPTANCE}.json`)) === acceptanceBatchBefore, "acceptance onboarding batch bytes unchanged");
  for (const slug of HISTORICAL) {
    assert(
      shaFile(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`)) === historicalBefore[slug],
      `${slug} profile unchanged`,
    );
  }

  console.log(`\n${failures.length ? "FAIL" : "PASS"} — ${failures.length ? failures.length + " failed" : "all checks passed"}\n`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
