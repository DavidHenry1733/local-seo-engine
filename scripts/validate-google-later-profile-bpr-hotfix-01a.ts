#!/usr/bin/env npx tsx
/**
 * HOTFIX-01A — PROFILE → Open Business Profile Review uses the lite customer
 * payload, not the full review builder. Deferred Google must be on that payload.
 */
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { readSetupProfile, writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildMasterAdminCustomerRecordLite } from "../src/pharmacy/masterAdminCustomerRecordLiteService.ts";
import { buildBusinessProfileReview } from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import {
  registerMasterAdminClient,
  removeMasterAdminRegistryEntry,
} from "../src/pharmacy/pharmacyMasterAdminService.ts";
import type { PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const FIXTURE = "hotfix01a-profile-bpr-fixture";
const ACCEPTANCE = "pharmaconnect-e2e-test-pharmacy-2";
const REGISTRY = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/registry.json");
const PAGE = path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
const failures: string[] = [];

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

/** Same decision as the PROFILE button's openBusinessProfileReview gate. */
function profileButtonOpensReview(customer: {
  workflow?: { currentStage?: string } | null;
  businessProfileReview?: { summary?: { googleProfileState?: string } } | null;
}): boolean {
  const stage = customer.workflow?.currentStage;
  const atReview = ["business_profile_intelligence", "resolve_import_conflicts", "approve_business_profile"].includes(
    String(stage || ""),
  );
  if (atReview) return true;
  const state = customer.businessProfileReview?.summary?.googleProfileState;
  return state === "deferred" || state === "no_profile";
}

function removeFixture(): void {
  const listed = execSync(`find data config -path '*${FIXTURE}*' 2>/dev/null | sort`, {
    cwd: PHARMACY_WORKSPACE_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const rel of listed) {
    if (rel.endsWith("registry.json")) continue;
    fs.rmSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), { recursive: true, force: true });
  }
}

function main(): void {
  console.log("\n=== HOTFIX-01A PROFILE Open Business Profile Review ===\n");
  const registryBefore = fs.readFileSync(REGISTRY);
  const acceptanceBefore = slugHash(ACCEPTANCE);
  try {
    writeSetupProfile(FIXTURE, {
      pharmacyName: "Hotfix 01A Profile Pharmacy",
      website: "https://example-pharmacy.test/",
      addressLine1: "1 Example Street",
      primaryTown: "Paisley",
      townCity: "Paisley",
      postcode: "PA1 1AA",
      country: "United Kingdom",
      phone: "0141 000 0000",
      businessEmail: "hotfix-01a@example.test",
      marketScope: "local",
      selectedServices: ["blood-pressure-checks"],
      googleProfileOnboardingState: "deferred",
      googleBusinessProfileUrl: "",
      googlePlaceId: "",
      googleImportSnapshot: null,
      websiteImportSnapshot: {
        status: "not_found",
        importedAt: "2026-09-27T11:57:14.763Z",
        message: "Website import incomplete.",
        websiteUrl: "https://example-pharmacy.test/",
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
    registerMasterAdminClient(FIXTURE, "Hotfix 01A Profile Pharmacy");

    const page = fs.readFileSync(PAGE, "utf8");
    const profileSection = page.slice(page.indexOf('id="udSection-profile"'), page.indexOf('id="udSection-import"'));
    assert(
      profileSection.includes('id="openBprBtn"') && profileSection.includes('onclick="openBusinessProfileReview()"'),
      "PROFILE button calls openBusinessProfileReview",
    );
    assert(
      page.includes("c.businessProfileReview.summary.googleProfileState"),
      "open gate reads googleProfileState from the loaded customer",
    );

    const customer = buildMasterAdminCustomerRecordLite(FIXTURE);
    assert(Boolean(customer), "GET /customers/:slug lite record exists");
    const stage = customer?.workflow?.currentStage || customer?.currentStage;
    assert(
      !["business_profile_intelligence", "resolve_import_conflicts", "approve_business_profile"].includes(String(stage)),
      `workflow is still before Business Profile Review (${stage})`,
    );
    const pre01ACustomer = customer
      ? {
          ...customer,
          businessProfileReview: {
            ...customer.businessProfileReview,
            summary: {
              approvalStatus: customer.businessProfileReview?.summary?.approvalStatus,
              pharmacyName: customer.businessProfileReview?.summary?.pharmacyName,
              readinessLabel: customer.businessProfileReview?.summary?.readinessLabel,
            },
          },
        }
      : null;
    assert(pre01ACustomer ? profileButtonOpensReview(pre01ACustomer) === false : false, "pre-01A lite payload still blocks the PROFILE button");
    assert(
      customer?.businessProfileReview?.summary?.googleProfileState === "deferred",
      `lite payload carries deferred Google (${customer?.businessProfileReview?.summary?.googleProfileState})`,
    );
    assert(customer ? profileButtonOpensReview(customer) === true : false, "PROFILE button opens Business Profile Review");

    const review = buildBusinessProfileReview(FIXTURE);
    assert(!review.loadError, "Business Profile Review renders");
    assert(
      !(review.missingSources || []).includes("Google Intelligence"),
      "no Google Import prerequisite error",
    );
    assert(review.summary.googleProfileState === "deferred", "Google remains deferred");
    assert(review.manualBrandConfirmation?.available === true, "manual brand-source confirmation action is visible");

    const stored = readSetupProfile(FIXTURE);
    assert(stored.googleProfileOnboardingState === "deferred", "stored Google policy remains deferred");
    assert(!stored.googleImportSnapshot, "no Google connection was created");
    assert(stored.websiteImportSnapshot?.status === "not_found", "website import failure remains unchanged");
  } finally {
    removeMasterAdminRegistryEntry(FIXTURE);
    removeFixture();
    fs.writeFileSync(REGISTRY, registryBefore);
  }

  assert(slugHash(ACCEPTANCE) === acceptanceBefore, "acceptance tenant files unchanged");
  assert(!fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${FIXTURE}.json`)), "fixture removed");

  console.log(`\n${failures.length ? "FAIL" : "PASS"} — ${failures.length ? failures.length + " failed" : "all checks passed"}\n`);
  if (failures.length) process.exit(1);
}

main();
