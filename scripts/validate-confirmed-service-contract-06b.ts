#!/usr/bin/env npx tsx
/**
 * CONFIRMED-SERVICE-CONTRACT-06B validation (07B: Yorkshire expectation reads stored selectedServices).
 * Stored fixtures / in-memory profiles only — no GI generation, no external APIs.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { resolveEnabledServices } from "../src/pharmacy/growthEngineOpportunityEngine.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];

function record(name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function loadProfileData(slug: string): ReturnType<typeof normalizeProfileData> {
  const file = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function existingEvidenceFiles(): string[] {
  const dirs = [
    path.join(ROOT, "data/pharmacy-competitor-intelligence"),
    path.join(ROOT, "data/growth-engine"),
    path.join(ROOT, "data/national-growth-engine"),
    path.join(ROOT, "data/pharmacy-content-packages"),
    path.join(ROOT, "data/content-packages"),
    path.join(ROOT, "data/pharmacy-profiles"),
  ];
  const files: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  for (const dir of dirs) walk(dir);
  return files.sort();
}

function main(): void {
  const beforeFiles = existingEvidenceFiles();
  const beforeHashes = Object.fromEntries(beforeFiles.map((f) => [f, hashFile(f)]));
  const yorkshireProfilePath = path.join(
    ROOT,
    "data/pharmacy-profiles/yorkshire-pharmacy-and-health-clinic.json",
  );
  const yorkshireBefore = hashFile(yorkshireProfilePath);

  const yorkshire = loadProfileData("yorkshire-pharmacy-and-health-clinic");
  const yorkshireResolved = resolveEnabledServices(yorkshire);
  // Expected Yorkshire result is whatever is currently stored in selectedServices
  // (trim + dedupe via the shared resolver contract) — never a hardcoded former selection.
  const yorkshireDoc = JSON.parse(fs.readFileSync(yorkshireProfilePath, "utf8")) as {
    data?: { selectedServices?: unknown };
  };
  const yorkshireStoredSelected = Array.isArray(yorkshireDoc.data?.selectedServices)
    ? yorkshireDoc.data.selectedServices
    : [];
  const yorkshireExpected = resolveEnabledServices(
    normalizeProfileData({ selectedServices: yorkshireStoredSelected } as never),
  );
  record(
    "Yorkshire resolves exactly to stored selectedServices",
    JSON.stringify(yorkshireResolved) === JSON.stringify(yorkshireExpected),
    `count=${yorkshireResolved.length} resolved=${JSON.stringify(yorkshireResolved)}`,
  );

  const detectedUnselected = normalizeProfileData({
    selectedServices: ["pharmacy-first"],
    detectedWebsiteServices: [
      { serviceId: "blood-pressure-checks", serviceName: "Blood Pressure Checks", confidence: 74 },
      { serviceId: "flu-vaccinations", serviceName: "Flu Vaccination", confidence: 78 },
    ],
    priorityServices: ["travel-vaccinations"],
    serviceDeliveryProfiles: {
      "pharmacy-first": { serviceId: "pharmacy-first" },
      "weight-management": { serviceId: "weight-management" },
    },
  } as never);
  const detectedResolved = resolveEnabledServices(detectedUnselected);
  record(
    "Detected-but-unselected services are excluded",
    JSON.stringify(detectedResolved) === JSON.stringify(["pharmacy-first"]) &&
      !detectedResolved.includes("blood-pressure-checks") &&
      !detectedResolved.includes("flu-vaccinations") &&
      !detectedResolved.includes("travel-vaccinations"),
    JSON.stringify(detectedResolved),
  );

  const deliveryOnly = normalizeProfileData({
    selectedServices: [],
    serviceDeliveryProfiles: {
      "website-1": {},
      "pharmacy-first": { serviceId: "pharmacy-first" },
    },
  } as never);
  record(
    "Delivery-profile-only services are excluded",
    JSON.stringify(resolveEnabledServices(deliveryOnly)) === JSON.stringify([]),
    JSON.stringify(resolveEnabledServices(deliveryOnly)),
  );

  const campaignOnlyShape = normalizeProfileData({
    selectedServices: [],
    // Campaign existence is not a profile field — ensure empty selection stays empty
    // even when delivery/detection residue would previously have leaked.
    detectedWebsiteServices: [{ serviceId: "pharmacy-first", serviceName: "Pharmacy First", confidence: 90 }],
    serviceDeliveryProfiles: { "pharmacy-first": { serviceId: "pharmacy-first" } },
  } as never);
  record(
    "Campaign-only / non-selected residue resolves empty (no Pharmacy First default)",
    JSON.stringify(resolveEnabledServices(campaignOnlyShape)) === JSON.stringify([]),
    JSON.stringify(resolveEnabledServices(campaignOnlyShape)),
  );

  const empty = normalizeProfileData({ selectedServices: [] } as never);
  record(
    "Empty selectedServices resolves []",
    JSON.stringify(resolveEnabledServices(empty)) === JSON.stringify([]),
    JSON.stringify(resolveEnabledServices(empty)),
  );

  const multi = normalizeProfileData({
    selectedServices: ["blood-pressure-checks", "pharmacy-first", "flu-vaccinations", "pharmacy-first", "  ", ""],
  } as never);
  record(
    "Multiple selectedServices remain supported and ordered (deduped)",
    JSON.stringify(resolveEnabledServices(multi)) ===
      JSON.stringify(["blood-pressure-checks", "pharmacy-first", "flu-vaccinations"]),
    JSON.stringify(resolveEnabledServices(multi)),
  );

  const other = loadProfileData("reliable-direct-pharmacy");
  const otherResolved = resolveEnabledServices(other);
  record(
    "Another tenant remains compatible",
    Array.isArray(otherResolved) &&
      otherResolved.every((id) => typeof id === "string" && id.length > 0) &&
      JSON.stringify(otherResolved) === JSON.stringify((other.selectedServices || []).filter(Boolean)),
    JSON.stringify(otherResolved),
  );

  // broom-lane historically had delivery/detection residue with empty selectedServices
  const broom = loadProfileData("broom-lane-pharmacy");
  record(
    "Tenant with delivery/detection residue but empty selectedServices resolves []",
    (broom.selectedServices || []).length === 0 &&
      JSON.stringify(resolveEnabledServices(broom)) === JSON.stringify([]),
    JSON.stringify(resolveEnabledServices(broom)),
  );

  const src = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineOpportunityEngine.ts"), "utf8");
  record(
    "Resolver no longer imports collectServiceIdsFromProfile for GI eligibility",
    !/resolveEnabledServices[\s\S]*collectServiceIdsFromProfile/.test(src) &&
      !src.includes('from "./pharmacyProfileV2Fields.ts"'),
  );
  record(
    "No Yorkshire-specific production logic",
    !/yorkshire-pharmacy-and-health-clinic/i.test(src),
  );

  const yorkshireAfter = hashFile(yorkshireProfilePath);
  record("Yorkshire profile data unchanged", yorkshireBefore === yorkshireAfter);

  const afterFiles = existingEvidenceFiles();
  const afterHashes = Object.fromEntries(afterFiles.map((f) => [f, hashFile(f)]));
  record(
    "No evidence/content artifacts change",
    JSON.stringify(beforeHashes) === JSON.stringify(afterHashes) &&
      beforeFiles.join("|") === afterFiles.join("|"),
  );

  const failed = steps.filter((s) => !s.passed);
  console.log(
    failed.length
      ? `\nCONFIRMED-SERVICE-CONTRACT-06B: FAIL (${failed.length})`
      : "\nCONFIRMED-SERVICE-CONTRACT-06B: PASS",
  );
  process.exit(failed.length ? 1 : 0);
}

main();
