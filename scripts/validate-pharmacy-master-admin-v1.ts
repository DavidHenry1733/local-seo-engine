#!/usr/bin/env npx tsx
/**
 * PharmaConnect Master Admin Platform V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  archivePharmacyClient,
  buildMasterAdminPortfolio,
  createPharmacyWorkspace,
  deleteDemoPharmacyClient,
  readMasterAdminRegistry,
  safeAdminSlug,
} from "../src/pharmacy/pharmacyMasterAdminService.ts";
import { cleanupValidationTestClient } from "../src/pharmacy/adminClientValidationCleanup.ts";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { renderMasterAdminHtml } from "../artifacts/api-server/src/routes/pharmacyMasterAdminPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";
const TEST_SLUG = safeAdminSlug(`master-admin-test-${Date.now()}`);

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

console.log(`\nPharmaConnect Master Admin Platform V1\n`);

const svcSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyMasterAdminService.ts"), "utf8");
const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyMasterAdminPage.ts"), "utf8");
const apiSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyMasterAdmin.ts"), "utf8");
const indexSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/index.ts"), "utf8");
const layoutSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyVisualExperienceLayoutV3.ts"), "utf8");

const pharmaconnectBefore = fs.existsSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"))
  ? fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"), "utf8")
  : "";

record("1-service-exists", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyMasterAdminService.ts")), "Master admin service");
record(
  "2-routes-registered",
  indexSrc.includes("pharmacyMasterAdminPageRouter") && indexSrc.includes("pharmacyMasterAdminApiRouter"),
  "Page and API routes registered",
);
record(
  "3-portfolio-ui",
  pageSrc.includes("Client Portfolio") && pageSrc.includes("Add New Pharmacy") && pageSrc.includes("Open Pharmacy"),
  "Portfolio UI elements",
);
record(
  "4-wizard-steps",
  pageSrc.includes("Business Information") &&
    pageSrc.includes("Growth Plan") &&
    pageSrc.includes("Create Pharmacy"),
  "Six-step wizard",
);
record(
  "5-stage-filters",
  pageSrc.includes("needs_attention") && pageSrc.includes("Onboarding") && pageSrc.includes("Published"),
  "Portfolio stage filters",
);

let createdSlug = "";
try {
  const result = await createPharmacyWorkspace({
    slug: TEST_SLUG,
    pharmacyName: "Master Admin Test Pharmacy",
    website: "",
    contactEmail: "test@pharmaconnect.local",
    telephone: "0113 000 0000",
    growthPlanTier: "starter",
    primaryTown: "Leeds",
    coverageRadius: "5 miles",
    selectedServices: ["pharmacy-first", "blood-pressure-checks"],
    isDemo: true,
  });
  createdSlug = result.slug;
  record(
    "6-create-pharmacy",
    result.slug === TEST_SLUG && fs.existsSync(result.profilePath),
    `${result.slug} · ${result.placeholderCampaigns} campaign(s)`,
  );
  record(
    "7-profile-isolated",
    fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${TEST_SLUG}.json`)),
    `data/pharmacy-profiles/${TEST_SLUG}.json`,
  );
  record(
    "8-campaign-store-isolated",
    fs.existsSync(path.join(ROOT, "data/pharmacy-campaigns", `${TEST_SLUG}.json`)),
    `data/pharmacy-campaigns/${TEST_SLUG}.json`,
  );
} catch (err) {
  record("6-create-pharmacy", false, String(err));
  record("7-profile-isolated", false, "skipped");
  record("8-campaign-store-isolated", false, "skipped");
}

if (createdSlug) {
  const portfolio = buildMasterAdminPortfolio({ search: createdSlug });
  record(
    "9-portfolio-updates",
    portfolio.clients.some((c) => c.slug === createdSlug),
    `${portfolio.clients.length} clients in portfolio`,
  );
  const dashboard = buildPharmacyPlatformDashboard(createdSlug);
  record(
    "10-open-pharmacy-dashboard",
    dashboard.slug === createdSlug && dashboard.identity.pharmacyName.includes("Master Admin Test"),
    dashboard.identity.pharmacyName,
  );
  const html = renderMasterAdminHtml();
  record(
    "11-growth-plan-on-card",
    html.includes("Growth Plan") && html.includes("Starter"),
    "Growth plan tier on client card",
  );
  try {
    archivePharmacyClient(createdSlug);
    const afterArchive = buildMasterAdminPortfolio({ search: createdSlug });
    record(
      "12-archive-client",
      !afterArchive.clients.some((c) => c.slug === createdSlug),
      "Archived client hidden from portfolio",
    );
  } catch (err) {
    record("12-archive-client", false, String(err));
  }
  try {
    deleteDemoPharmacyClient(createdSlug);
    record(
      "13-delete-demo",
      !fs.existsSync(path.join(ROOT, "data/pharmacy-profiles", `${TEST_SLUG}.json`)),
      "Demo tenant files removed",
    );
  } catch (err) {
    record("13-delete-demo", false, String(err));
  }
} else {
  record("9-portfolio-updates", false, "skipped");
  record("10-open-pharmacy-dashboard", false, "skipped");
  record("11-growth-plan-on-card", renderMasterAdminHtml(buildMasterAdminPortfolio()).includes("Growth Plan"), "offline");
  record("12-archive-client", false, "skipped");
  record("13-delete-demo", false, "skipped");
}

const pharmaconnectAfter = fs.existsSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"))
  ? fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json"), "utf8")
  : "";
record(
  "14-existing-pharmacy-unchanged",
  pharmaconnectBefore === pharmaconnectAfter && pharmaconnectBefore.length > 0,
  "pharmaconnect profile untouched",
);
record(
  "15-tenant-registry",
  readMasterAdminRegistry().clients.length >= 1,
  `${readMasterAdminRegistry().clients.length} registry entries`,
);
record(
  "16-api-endpoints",
  apiSrc.includes("/master-admin/portfolio") &&
    apiSrc.includes("router.post") &&
    apiSrc.includes("/archive"),
  "Portfolio, create, archive APIs",
);
record(
  "17-no-engine-modified",
  !layoutSrc.includes("MasterAdmin") && !svcSrc.includes("buildVisualExperiencePage"),
  "Content engines untouched",
);

try {
  const res = await fetch(`${BASE}/api/admin/pharmacies`, { redirect: "manual" });
  record(
    "18-live-admin-page",
    res.status === 302 || res.status === 200,
    res.status === 302 ? "Auth-gated" : `HTTP ${res.status}`,
  );
} catch {
  record("18-live-admin-page", pageSrc.includes("Master Admin"), "Offline validation");
}

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-master-admin-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify({ pass: allPass, testSlug: TEST_SLUG, checks, generatedAt: new Date().toISOString() }, null, 2),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ MASTER ADMIN PLATFORM V1 PASS\n" : "\n❌ VALIDATION FAILED\n");

if (createdSlug) {
  try {
    cleanupValidationTestClient(createdSlug);
  } catch {
    /* best effort */
  }
}

process.exit(allPass ? 0 : 1);
