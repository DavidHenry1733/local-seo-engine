#!/usr/bin/env npx tsx
/**
 * PharmaConnect Workspace Provisioning Path Fix V2 — canonical path validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  buildMasterAdminPortfolio,
  createPharmacyWorkspace,
  deleteDemoPharmacyClient,
  readMasterAdminRegistry,
  WorkspaceProvisioningError,
} from "../src/pharmacy/pharmacyMasterAdminService.ts";
import {
  auditPharmacyWorkspace,
  getAllRequiredPharmacyWorkspacePaths,
  isPharmacyWorkspaceReady,
  pharmacyProfileFilePath,
  REQUIRED_WORKSPACE_DIRS,
  REQUIRED_WORKSPACE_FILES,
  rollbackPharmacyWorkspace,
  tracePharmacyWorkspacePaths,
  verifyPharmacyWorkspaceReady,
} from "../src/pharmacy/pharmacyWorkspaceProvisionService.ts";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { buildPharmacyCampaignControlCentre } from "../src/pharmacy/pharmacyCampaignControlCentreService.ts";
import { buildAuthorityReadinessDashboard } from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { loadPharmacyProfile } from "../src/pharmacy/pharmacyContentBlueprintService.ts";
import { readPharmacyCampaignStore } from "../src/pharmacy/pharmacyCampaignService.ts";
import { loadPharmacyAuthorityReadiness } from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { loadPharmacyPublishingSettings } from "../src/pharmacy/pharmacyPublishingSettingsService.ts";
import { loadImageAssignments } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { renderPharmacyPlatformDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyPlatformDashboardPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEMO_SLUG = "self-provision-demo-v2";
const TIERS = ["starter", "professional", "complete"] as const;

interface Check {
  id: string;
  pass: boolean;
  detail: string;
  category: string;
}

const checks: Check[] = [];
const issues: string[] = [];

function record(id: string, pass: boolean, detail: string, category = "general") {
  checks.push({ id, pass, detail, category });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
  if (!pass) issues.push(`${id}: ${detail}`);
}

function hashFile(rel: string): string {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return "";
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function cleanup(slug: string) {
  try {
    deleteDemoPharmacyClient(slug);
  } catch {
    rollbackPharmacyWorkspace(slug);
  }
}

console.log("\nPharmaConnect Self-Provisioning Path Fix V2\n");
console.log(`Canonical workspace root: ${PHARMACY_WORKSPACE_ROOT}\n`);

const pharmaconnectHashBefore = hashFile("data/pharmacy-profiles/pharmaconnect.json");

for (const slug of [DEMO_SLUG, `${DEMO_SLUG}-starter`, `${DEMO_SLUG}-professional`, `${DEMO_SLUG}-complete`, `${DEMO_SLUG}-partial`, `${DEMO_SLUG}-no-profile`, `${DEMO_SLUG}-rollback-test`]) {
  cleanup(slug);
}

let createResult: Awaited<ReturnType<typeof createPharmacyWorkspace>> | null = null;
try {
  createResult = await createPharmacyWorkspace({
    slug: DEMO_SLUG,
    pharmacyName: "Self Provision Demo Pharmacy V2",
    contactEmail: "demo@selfprovision.pharmacy",
    telephone: "0113 496 0345",
    growthPlanTier: "professional",
    primaryTown: "Leeds",
    coverageRadius: "5 miles",
    selectedServices: ["pharmacy-first", "blood-pressure-checks"],
    isDemo: true,
  });
  record("1-new-pharmacy-created", createResult.verified === true, `${createResult.pharmacyName} verified=${createResult.verified}`, "create");
} catch (err) {
  record("1-new-pharmacy-created", false, String(err), "create");
}

if (createResult?.verified) {
  const trace = tracePharmacyWorkspacePaths(DEMO_SLUG);
  record(
    "2-canonical-root",
    trace.workspaceRoot === PHARMACY_WORKSPACE_ROOT,
    trace.workspaceRoot,
    "paths",
  );
  record(
    "3-all-files-on-canonical-root",
    trace.files.every((f) => f.expectedPath.startsWith(PHARMACY_WORKSPACE_ROOT) && f.exists),
    trace.files.filter((f) => !f.exists).map((f) => f.expectedPath).join(", ") || `${trace.files.length} files`,
    "paths",
  );

  const verification = verifyPharmacyWorkspaceReady(DEMO_SLUG);
  const hasPlaceholder = verification.checks.some((c) => (c.reason || c.resource).includes("{slug}"));
  record("4-no-slug-placeholders-in-errors", !hasPlaceholder, hasPlaceholder ? "Found {slug} in error text" : "Resolved slug paths only", "verify");
  record("5-post-provision-verification", verification.ready, `${verification.checks.filter((c) => c.pass).length}/${verification.checks.length} checks`, "verify");

  try {
    loadPharmacyProfile(DEMO_SLUG);
    record("6-profile-loader", fs.existsSync(pharmacyProfileFilePath(DEMO_SLUG)), pharmacyProfileFilePath(DEMO_SLUG), "loaders");
  } catch (err) {
    record("6-profile-loader", false, String(err), "loaders");
  }

  const paths = getAllRequiredPharmacyWorkspacePaths(DEMO_SLUG);
  record("7-project-config-file", fs.existsSync(paths.projectConfig), paths.projectConfig, "loaders");
  record("8-campaign-store-loader", (readPharmacyCampaignStore(DEMO_SLUG)?.campaigns.length || 0) >= 1, paths.campaignStore, "loaders");
  record("9-launch-queue-file", fs.existsSync(paths.launchQueue), paths.launchQueue, "loaders");
  record("10-growth-actions-file", fs.existsSync(paths.growthActions), paths.growthActions, "loaders");
  record("11-publishing-loader", loadPharmacyPublishingSettings(DEMO_SLUG).services.length >= 1, paths.publishingSettings, "loaders");
  record("12-visibility-file", fs.existsSync(paths.visibility), paths.visibility, "loaders");
  record("13-growth-journey-file", fs.existsSync(paths.growthJourney), paths.growthJourney, "loaders");

  const audit = auditPharmacyWorkspace(DEMO_SLUG);
  record("14-required-files", audit.missingFiles.length === 0, audit.missingFiles.join(", ") || `${REQUIRED_WORKSPACE_FILES.length} files`, "verify");
  record("15-required-dirs", audit.missingDirs.length === 0, audit.missingDirs.join(", ") || `${REQUIRED_WORKSPACE_DIRS.length} dirs`, "verify");

  record(
    "16-not-under-artifacts",
    !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/data/pharmacy-profiles", `${DEMO_SLUG}.json`)),
    "Profile not wrongly written under artifacts/",
    "paths",
  );

  const registry = readMasterAdminRegistry();
  record("17-registry-after-verify", registry.clients.some((c) => c.slug === DEMO_SLUG && !c.archived), "Registered after verification", "verify");
  record("18-portfolio-lists-verified", buildMasterAdminPortfolio({ search: DEMO_SLUG }).clients.some((c) => c.slug === DEMO_SLUG), "In portfolio", "portfolio");

  try {
    const dashboard = buildPharmacyPlatformDashboard(DEMO_SLUG);
    const html = renderPharmacyPlatformDashboardHtml(dashboard);
    record("19-growth-programme-route", html.includes("Welcome to PharmaConnect"), "Dashboard HTML renders", "routes");
  } catch (err) {
    record("19-growth-programme-route", false, String(err), "routes");
  }

  try {
    const centre = buildPharmacyCampaignControlCentre(DEMO_SLUG);
    record("20-campaign-os", centre.campaigns.length >= 1, `${centre.campaigns.length} campaigns`, "routes");
  } catch (err) {
    record("20-campaign-os", false, String(err), "routes");
  }

  try {
    const auth = buildAuthorityReadinessDashboard(DEMO_SLUG);
    record("21-content-review", (auth.doc?.services?.length || 0) >= 1, `${auth.doc?.services?.length || 0} services`, "routes");
  } catch (err) {
    record("21-content-review", false, String(err), "routes");
  }

  record("22-authority-loader", Boolean(loadPharmacyAuthorityReadiness(DEMO_SLUG)?.services?.length), "Authority via loader", "loaders");
  record("23-image-store", Boolean(loadImageAssignments(DEMO_SLUG)), paths.imageAssignments, "loaders");
} else {
  for (const id of Array.from({ length: 23 }, (_, i) => String(i + 2))) {
    record(`${id}-skipped`, false, "skipped — create failed", "verify");
  }
}

for (const tier of TIERS) {
  const slug = `${DEMO_SLUG}-${tier}`;
  cleanup(slug);
  try {
    const result = await createPharmacyWorkspace({
      slug,
      pharmacyName: `Tier Test ${tier}`,
      contactEmail: "tier@test.pharmacy",
      telephone: "0113 111 2222",
      growthPlanTier: tier,
      primaryTown: "Leeds",
      selectedServices: ["pharmacy-first"],
      isDemo: true,
    });
    record(`24-tier-${tier}`, result.verified && isPharmacyWorkspaceReady(slug), `${tier} tier`, "tiers");
    cleanup(slug);
  } catch (err) {
    record(`24-tier-${tier}`, false, String(err), "tiers");
    cleanup(slug);
  }
}

cleanup(DEMO_SLUG);
try {
  const recreated = await createPharmacyWorkspace({
    slug: DEMO_SLUG,
    pharmacyName: "Self Provision Demo Pharmacy V2",
    contactEmail: "demo@selfprovision.pharmacy",
    telephone: "0113 496 0345",
    growthPlanTier: "starter",
    primaryTown: "Leeds",
    selectedServices: ["pharmacy-first"],
    isDemo: true,
  });
  record("25-delete-recreate-slug", recreated.verified === true, "Recreate after cleanup", "lifecycle");
  cleanup(DEMO_SLUG);
} catch (err) {
  record("25-delete-recreate-slug", false, String(err), "lifecycle");
  cleanup(DEMO_SLUG);
}

const partialSlug = `${DEMO_SLUG}-partial`;
rollbackPharmacyWorkspace(partialSlug);
fs.mkdirSync(path.dirname(pharmacyProfileFilePath(partialSlug)), { recursive: true });
fs.writeFileSync(pharmacyProfileFilePath(partialSlug), JSON.stringify({ slug: partialSlug, version: 1, data: { pharmacyName: "Partial" } }, null, 2));
record("26-partial-not-in-portfolio", !buildMasterAdminPortfolio({ search: partialSlug }).clients.some((c) => c.slug === partialSlug), "Excluded", "rollback");
rollbackPharmacyWorkspace(partialSlug);

const failSlug = `${DEMO_SLUG}-rollback-test`;
rollbackPharmacyWorkspace(failSlug);
try {
  await createPharmacyWorkspace({
    slug: failSlug,
    pharmacyName: "",
    contactEmail: "bad@test.pharmacy",
    telephone: "0113",
    growthPlanTier: "starter",
    primaryTown: "Leeds",
    selectedServices: ["pharmacy-first"],
    isDemo: true,
  });
  record("27-provision-interrupted-rollback", false, "Expected failure", "rollback");
} catch (err) {
  const profileExists = fs.existsSync(pharmacyProfileFilePath(failSlug));
  const inRegistry = readMasterAdminRegistry().clients.some((c) => c.slug === failSlug);
  const errText = err instanceof WorkspaceProvisioningError ? JSON.stringify(err.report.checks) : String(err);
  record(
    "27-provision-interrupted-rollback",
    !profileExists && !inRegistry && !errText.includes("{slug}"),
    `profileExists=${profileExists} inRegistry=${inRegistry}`,
    "rollback",
  );
}
rollbackPharmacyWorkspace(failSlug);

record(
  "28-regression-pharmaconnect",
  hashFile("data/pharmacy-profiles/pharmaconnect.json") === pharmaconnectHashBefore && pharmaconnectHashBefore.length > 0,
  "pharmaconnect unchanged",
  "regression",
);

try {
  buildPharmacyPlatformDashboard("pharmaconnect");
  record("29-regression-existing-dashboard", true, "pharmaconnect loads", "regression");
} catch (err) {
  record("29-regression-existing-dashboard", false, String(err), "regression");
}

const passCount = checks.filter((c) => c.pass).length;
const score = Math.round((passCount / checks.length) * 100);
const allPass = checks.every((c) => c.pass);

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-self-provisioning-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  JSON.stringify({ pass: allPass, selfProvisioningScore: score, workspaceRoot: PHARMACY_WORKSPACE_ROOT, checks, issuesDiscovered: issues, generatedAt: new Date().toISOString() }, null, 2),
  "utf8",
);

console.log(`\nSelf-provisioning score: ${score}% (${passCount}/${checks.length})`);
console.log(`Report: ${reportPath}`);
console.log(allPass ? "\n✅ SELF-PROVISIONING V2 PASS\n" : "\n❌ SELF-PROVISIONING VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
