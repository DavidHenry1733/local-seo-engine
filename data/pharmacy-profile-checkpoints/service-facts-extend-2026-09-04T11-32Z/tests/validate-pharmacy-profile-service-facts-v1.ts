#!/usr/bin/env npx tsx
/**
 * Services profile facts — persistence, legacy defaults, tenant isolation.
 * Does not generate content, publish, or edit accepted pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeProfileData,
  normalizeProfileDoc,
  type PharmacyProfileData,
} from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  defaultProfileServiceDelivery,
  mergeServiceDeliveryProfileMaps,
  normalizeProfileServiceFee,
  normalizeServiceDeliveryProfile,
  PROFILE_V2_FIELDS_VERSION,
} from "../src/pharmacy/pharmacyProfileV2Fields.ts";
import { renderWizardStepServices } from "../src/pharmacy/pharmacyProfileWizardSections.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILES_DIR = path.join(ROOT, "data/pharmacy-profiles");

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

function loadSlug(slug: string): PharmacyProfileData {
  const file = path.join(PROFILES_DIR, `${slug}.json`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

function fixtureFacts(serviceId: string) {
  return {
    ...defaultProfileServiceDelivery(serviceId, "Blood Pressure Checks"),
    fundingModel: "private" as const,
    ukNation: "england" as const,
    physicalBranchOffered: true,
    physicalBranchName: "High Street branch",
    physicalBranchConfirmed: true,
    deliveryMode: "both" as const,
    prescribingSupplyStatus: "pgd" as const,
    prescribingSupplyConfirmed: true,
    consultationFee: { kind: "fixed" as const, amount: "£25", notes: "" },
    treatmentFee: { kind: "included" as const, amount: "", notes: "" },
    followUpFee: { kind: "from" as const, amount: "£10", notes: "" },
    depositStatus: "required" as const,
    depositAmount: "£20",
    depositTerms: "Taken at booking",
    cancellationTerms: "24 hours notice",
    clinicalReviewerName: "Jane Pharmacist",
    clinicalReviewerRole: "Superintendent pharmacist",
    clinicalReviewerStatus: "confirmed" as const,
  };
}

function main() {
  console.log("\n=== Pharmacy profile service facts ===\n");

  record("v2-fields-version", PROFILE_V2_FIELDS_VERSION === 2, `v${PROFILE_V2_FIELDS_VERSION}`);

  const unknownFee = normalizeProfileServiceFee(undefined);
  record("fee-default-unknown", unknownFee.kind === "unknown" && !unknownFee.amount, unknownFee.kind);
  record(
    "fee-available-never-becomes-free",
    normalizeProfileServiceFee({ kind: "available" }).kind === "unknown",
    normalizeProfileServiceFee({ kind: "available" }).kind,
  );
  record(
    "fee-true-never-becomes-free",
    normalizeProfileServiceFee({ kind: "true" }).kind === "unknown",
    normalizeProfileServiceFee({ kind: "true" }).kind,
  );

  const legacy = normalizeServiceDeliveryProfile("pharmacy-first", {
    serviceId: "pharmacy-first",
    serviceName: "Pharmacy First",
    fundingModel: "nhs",
    pricing: "Free NHS service",
  });
  record(
    "funding-both-maps-to-mixed",
    normalizeServiceDeliveryProfile("x", { fundingModel: "both" }).fundingModel === "mixed",
    normalizeServiceDeliveryProfile("x", { fundingModel: "both" }).fundingModel,
  );
  record("legacy-keeps-funding", legacy.fundingModel === "nhs", legacy.fundingModel);
  record("legacy-keeps-pricing-notes", legacy.pricing === "Free NHS service", legacy.pricing);
  record("legacy-fee-not-inferred-free", legacy.consultationFee.kind === "unknown", legacy.consultationFee.kind);
  record("legacy-delivery-unknown", legacy.deliveryMode === "unknown", legacy.deliveryMode);
  record("legacy-nation-unknown", legacy.ukNation === "unknown", legacy.ukNation);
  record("legacy-branch-not-available", legacy.physicalBranchOffered === null, String(legacy.physicalBranchOffered));
  record("legacy-prescribing-not-available", legacy.prescribingSupplyStatus === "unknown" && legacy.prescribingSupplyConfirmed === false, legacy.prescribingSupplyStatus);
  record("legacy-reviewer-unconfirmed", legacy.clinicalReviewerStatus === "unknown" && !legacy.clinicalReviewerName, legacy.clinicalReviewerStatus);

  const saved = normalizeProfileData({
    pharmacyName: "Fixture Pharmacy A",
    selectedServices: ["blood-pressure-checks", "travel-vaccinations"],
    serviceDeliveryProfiles: {
      "blood-pressure-checks": fixtureFacts("blood-pressure-checks"),
    },
  });
  const reopened = normalizeProfileData(saved as unknown as Record<string, unknown>);
  const bp = reopened.serviceDeliveryProfiles["blood-pressure-checks"];
  record("save-reopen-selected-services", reopened.selectedServices.join(",") === "blood-pressure-checks,travel-vaccinations", reopened.selectedServices.join(","));
  record("save-reopen-funding", bp?.fundingModel === "private", bp?.fundingModel || "missing");
  record("save-reopen-nation", bp?.ukNation === "england", bp?.ukNation || "missing");
  record("save-reopen-branch", bp?.physicalBranchName === "High Street branch" && bp.physicalBranchConfirmed === true, bp?.physicalBranchName || "missing");
  record("save-reopen-delivery", bp?.deliveryMode === "both", bp?.deliveryMode || "missing");
  record("save-reopen-prescribing", bp?.prescribingSupplyStatus === "pgd" && bp.prescribingSupplyConfirmed === true, bp?.prescribingSupplyStatus || "missing");
  record("save-reopen-consultation-fee", bp?.consultationFee.kind === "fixed" && bp.consultationFee.amount === "£25", `${bp?.consultationFee.kind}:${bp?.consultationFee.amount}`);
  record("save-reopen-deposit", bp?.depositStatus === "required" && bp.depositAmount === "£20", bp?.depositAmount || "missing");
  record("save-reopen-reviewer", bp?.clinicalReviewerName === "Jane Pharmacist" && bp.clinicalReviewerStatus === "confirmed", `${bp?.clinicalReviewerName}:${bp?.clinicalReviewerStatus}`);
  record("save-reopen-untouched-service", Boolean(reopened.serviceDeliveryProfiles["travel-vaccinations"]), "travel-vaccinations retained");
  record(
    "untouched-service-stays-unknown",
    reopened.serviceDeliveryProfiles["travel-vaccinations"]?.consultationFee.kind === "unknown",
    reopened.serviceDeliveryProfiles["travel-vaccinations"]?.consultationFee.kind || "missing",
  );

  const tenantA = loadSlug("dhmdigital");
  const tenantB = loadSlug("pharmaconnect");
  record("legacy-dhmdigital-loads", Boolean(tenantA.pharmacyName), tenantA.pharmacyName);
  record("legacy-pharmaconnect-loads", Boolean(tenantB.pharmacyName), tenantB.pharmacyName);
  record(
    "tenant-isolation-names",
    tenantA.pharmacyName !== tenantB.pharmacyName,
    `${tenantA.pharmacyName} vs ${tenantB.pharmacyName}`,
  );
  record(
    "tenant-isolation-selected-services",
    JSON.stringify(tenantA.selectedServices) !== JSON.stringify(tenantB.selectedServices) || tenantA.selectedServices.length > 0,
    `A=${tenantA.selectedServices.length} B=${tenantB.selectedServices.length}`,
  );

  const isolatedA = normalizeProfileData({
    ...tenantA,
    serviceDeliveryProfiles: {
      ...(tenantA.serviceDeliveryProfiles || {}),
      "blood-pressure-checks": fixtureFacts("blood-pressure-checks"),
    },
  });
  const isolatedB = normalizeProfileData(tenantB as unknown as Record<string, unknown>);
  record(
    "tenant-isolation-facts-not-leaked",
    isolatedB.serviceDeliveryProfiles["blood-pressure-checks"]?.clinicalReviewerName !== "Jane Pharmacist",
    isolatedB.serviceDeliveryProfiles["blood-pressure-checks"]?.clinicalReviewerName || "absent",
  );
  record(
    "tenant-a-facts-kept",
    isolatedA.serviceDeliveryProfiles["blood-pressure-checks"]?.clinicalReviewerName === "Jane Pharmacist",
    isolatedA.serviceDeliveryProfiles["blood-pressure-checks"]?.clinicalReviewerName || "missing",
  );
  record(
    "tenant-a-selections-preserved",
    isolatedA.selectedServices.join(",") === tenantA.selectedServices.join(","),
    isolatedA.selectedServices.join(","),
  );

  const html = renderWizardStepServices(tenantA, "dhmdigital");
  record("form-has-funding", /Funding/.test(html) && html.includes('value="unknown"'), "funding select");
  record("form-has-nation", html.includes("UK nation") && html.includes("northern-ireland"), "UK nation");
  record("form-has-delivery", html.includes("How the service is delivered") && html.includes("in-person"), "delivery");
  record("form-has-prescribing", html.includes("Prescribing / supply"), "prescribing");
  record("form-has-fees", html.includes("Consultation fee") && html.includes("Treatment fee") && html.includes("Follow-up fee"), "three fee rows");
  record("form-unknown-first-fee", /Consultation fee[\s\S]*?<option value="unknown" selected>Unknown/.test(html), "unknown selected");
  record("form-deposit", html.includes(">Deposit<"), "deposit");
  record("form-reviewer", html.includes("Named clinical reviewer") && html.includes("not a regulatory approval"), "reviewer + no approval claim");
  record("form-no-brook-invention", !/Brook Pharmacy/i.test(html), "no Brook details");
  record("form-imported-suggestion-copy", html.includes("Imported names are suggestions until confirmed"), "suggestion copy");
  record("form-no-regulatory-approval", !/regulatory approval granted|GPhC approved|MHRA approved/i.test(html), "no approval claim");

  const mergedMaps = mergeServiceDeliveryProfileMaps(
    {
      "blood-pressure-checks": { pricing: "Free NHS service", consultationFee: { kind: "unknown", amount: "", notes: "keep" } },
      "travel-vaccinations": { fundingModel: "private", pricing: "Ask in branch" },
    },
    {
      "blood-pressure-checks": { ukNation: "england", consultationFee: { kind: "fixed", amount: "£25" } },
    },
  );
  const mergedBp = mergedMaps["blood-pressure-checks"] as { pricing?: string; ukNation?: string; consultationFee?: { kind?: string; notes?: string } };
  const mergedTv = mergedMaps["travel-vaccinations"] as { pricing?: string };
  record("merge-keeps-sibling-service", mergedTv?.pricing === "Ask in branch", mergedTv?.pricing || "missing");
  record("merge-keeps-legacy-pricing-notes", mergedBp?.pricing === "Free NHS service", mergedBp?.pricing || "missing");
  record("merge-overlays-new-facts", mergedBp?.ukNation === "england", mergedBp?.ukNation || "missing");
  record("merge-keeps-fee-notes", mergedBp?.consultationFee?.notes === "keep" && mergedBp?.consultationFee?.kind === "fixed", `${mergedBp?.consultationFee?.kind}:${mergedBp?.consultationFee?.notes}`);

  const mergeNormalized = normalizeProfileData({
    selectedServices: ["blood-pressure-checks", "travel-vaccinations"],
    serviceDeliveryProfiles: mergedMaps,
  });
  record(
    "merge-then-normalize-unknown-not-free",
    mergeNormalized.serviceDeliveryProfiles["travel-vaccinations"]?.consultationFee.kind === "unknown",
    mergeNormalized.serviceDeliveryProfiles["travel-vaccinations"]?.consultationFee.kind || "missing",
  );

  const page = renderProfileWizardHtml("dhmdigital", tenantA, { initialStep: 4 });
  record("wizard-page-services-step", page.includes("data-wizard-step=\"4\"") && page.includes("Enabled services"), "step 4");
  record("wizard-page-no-brook", !/Brook Pharmacy/i.test(page), "wizard page isolation");
  record("wizard-page-unknown-not-free-copy", page.includes("Unknown is never treated as free") || page.includes("never treated as free or available"), "unknown copy");
  record("wizard-page-legacy-link", page.includes("legacy=1"), "legacy form link");

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
