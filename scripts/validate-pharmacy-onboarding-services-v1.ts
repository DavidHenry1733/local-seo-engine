#!/usr/bin/env npx tsx
/**
 * PharmaConnect Onboarding Wizard — Step 4 services selection fix validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  createPharmacyWorkspace,
  deleteDemoPharmacyClient,
  previewWizardSummary,
  buildMasterAdminPortfolio,
} from "../src/pharmacy/pharmacyMasterAdminService.ts";
import {
  BENCHMARK_MASTER_SERVICE_IDS,
} from "../src/pharmacy/pharmacyMasterPublishConfig.ts";
import {
  emptyWizardState,
  mergeSelectedServicesFromDom,
  parseWizardSession,
  serializeWizardSession,
  simulateStepFourToFiveTransition,
  validateWizardStep,
  WIZARD_SESSION_STORAGE_KEY,
} from "../src/pharmacy/pharmacyMasterAdminWizard.ts";
import { readPharmacyCampaignStore } from "../src/pharmacy/pharmacyCampaignService.ts";
import { renderMasterAdminHtml } from "../artifacts/api-server/src/routes/pharmacyMasterAdminPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function hashFile(rel: string): string {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return "";
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

console.log("\nPharmaConnect Onboarding Services Fix V1\n");

const pageSrc = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/pharmacyMasterAdminPage.ts"),
  "utf8",
);
const html = renderMasterAdminHtml(buildMasterAdminPortfolio());

record(
  "1-checkbox-name-attr",
  pageSrc.includes('name="w-services"') && html.includes("w-services"),
  "Step 4 checkboxes use name=w-services",
);
record(
  "2-dom-guard-collect",
  pageSrc.includes("serviceInputs.length") && pageSrc.includes("querySelectorAll('input[name=\"w-services\"]')"),
  "Services collected only when checkbox DOM exists",
);
record(
  "3-no-hardcoded-defaults",
  !pageSrc.includes("selectedServices:['pharmacy-first'") && pageSrc.includes("selectedServices:[]"),
  "Wizard starts with empty selectedServices",
);
record(
  "4-review-no-collect-on-render",
  pageSrc.includes("if(!wizardData.selectedServices.length)") &&
    !pageSrc.includes("} else if(wizardStep===5){\n    body.innerHTML=`\\`<div class=\\\"review-box\\\" id=\\\"review-box\\\">Preparing summary…</div>\\`;\n    collectWizardData();"),
  "Step 5 does not wipe services via collectWizardData",
);
record(
  "5-session-storage-key",
  pageSrc.includes("saveWizardState") &&
    pageSrc.includes("loadWizardState") &&
    html.includes(WIZARD_SESSION_STORAGE_KEY),
  "Wizard persists to sessionStorage",
);

const afterStepFour = simulateStepFourToFiveTransition(emptyWizardState(), [
  "pharmacy-first",
  "blood-pressure-checks",
  "travel-vaccinations",
]);
record(
  "6-step4-to-step5-persist",
  afterStepFour.selectedServices.length === 3,
  afterStepFour.selectedServices.join(", "),
);

const backNav = mergeSelectedServicesFromDom(
  { ...emptyWizardState(), selectedServices: ["pharmacy-first"] },
  [],
  false,
);
record(
  "7-back-next-preserve",
  backNav.selectedServices.length === 1 && backNav.selectedServices[0] === "pharmacy-first",
  "Selections preserved without checkbox DOM",
);

const session = parseWizardSession(
  serializeWizardSession(4, {
    ...emptyWizardState(),
    pharmacyName: "Reload Test",
    selectedServices: ["emergency-contraception"],
  }),
);
record(
  "8-reload-restore",
  session?.wizardStep === 4 && session.wizardData.selectedServices[0] === "emergency-contraception",
  "Session round-trip restores services",
);

const previewThree = previewWizardSummary({
  pharmacyName: "Preview Test",
  contactEmail: "a@b.c",
  telephone: "011",
  growthPlanTier: "starter",
  primaryTown: "Leeds",
  selectedServices: ["pharmacy-first", "blood-pressure-checks", "travel-vaccinations"],
});
record(
  "9-review-preview-three",
  previewThree.serviceCount === 3 && previewThree.selectedServiceLabels.length === 3,
  previewThree.selectedServiceLabels.join(", "),
);

const previewAll = previewWizardSummary({
  pharmacyName: "All Services",
  contactEmail: "a@b.c",
  telephone: "011",
  growthPlanTier: "complete",
  primaryTown: "Leeds",
  selectedServices: [...BENCHMARK_MASTER_SERVICE_IDS],
});
record(
  "10-preview-all-services",
  previewAll.serviceCount === BENCHMARK_MASTER_SERVICE_IDS.length,
  `${previewAll.serviceCount} services`,
);

record(
  "11-step4-validation",
  validateWizardStep(4, emptyWizardState()) === "Select at least one service",
  "Validation rejects empty selection",
);

async function provision(suffix: string, services: string[]) {
  const slug = `onboarding-svc-test-${suffix}`;
  try {
    deleteDemoPharmacyClient(slug);
  } catch {}
  return createPharmacyWorkspace({
    slug,
    pharmacyName: `Onboarding Test ${suffix}`,
    contactEmail: "onboarding@test.local",
    telephone: "0113 496 0100",
    growthPlanTier: "starter",
    primaryTown: "Leeds",
    selectedServices: services,
    isDemo: true,
  });
}

try {
  const one = await provision("one", ["pharmacy-first"]);
  const storeOne = readPharmacyCampaignStore(one.slug);
  const activeOne = storeOne?.campaigns.filter((c) => c.status === "active") || [];
  record(
    "12-create-one-service",
    activeOne.length === 1 && activeOne[0]?.serviceId === "pharmacy-first",
    `${activeOne.length} campaign · ${activeOne[0]?.serviceId}`,
  );
  deleteDemoPharmacyClient(one.slug);
} catch (err) {
  record("12-create-one-service", false, String(err));
}

try {
  const three = await provision("three", [
    "pharmacy-first",
    "blood-pressure-checks",
    "travel-vaccinations",
  ]);
  const storeThree = readPharmacyCampaignStore(three.slug);
  const ids = (storeThree?.campaigns.filter((c) => c.status === "active") || []).map((c) => c.serviceId);
  record(
    "13-create-three-services",
    ids.length === 3 &&
      ids.includes("pharmacy-first") &&
      ids.includes("blood-pressure-checks") &&
      ids.includes("travel-vaccinations"),
    ids.join(", "),
  );
  deleteDemoPharmacyClient(three.slug);
} catch (err) {
  record("13-create-three-services", false, String(err));
}

try {
  const all = await provision("all", [...BENCHMARK_MASTER_SERVICE_IDS]);
  const storeAll = readPharmacyCampaignStore(all.slug);
  const activeAll = storeAll?.campaigns.filter((c) => c.status === "active") || [];
  record(
    "14-create-all-services",
    activeAll.length === BENCHMARK_MASTER_SERVICE_IDS.length,
    `${activeAll.length}/${BENCHMARK_MASTER_SERVICE_IDS.length} campaigns`,
  );
  deleteDemoPharmacyClient(all.slug);
} catch (err) {
  record("14-create-all-services", false, String(err));
}

const pharmaconnectHashBefore = hashFile("data/pharmacy-profiles/pharmaconnect.json");
try {
  await provision("regression-check", ["pharmacy-first"]);
  deleteDemoPharmacyClient("onboarding-svc-test-regression-check");
} catch {}
const pharmaconnectHashAfter = hashFile("data/pharmacy-profiles/pharmaconnect.json");
record(
  "15-no-regression",
  pharmaconnectHashBefore === pharmaconnectHashAfter && pharmaconnectHashBefore.length > 0,
  "pharmaconnect profile unchanged",
);

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-onboarding-services-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  reportPath,
  JSON.stringify({ pass: allPass, checks, generatedAt: new Date().toISOString() }, null, 2),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ ONBOARDING SERVICES FIX V1 PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
