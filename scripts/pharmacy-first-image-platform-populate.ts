#!/usr/bin/env npx tsx
/**
 * Pharmacy First Image Platform V1.1 — production asset population.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { runPharmacyFirstPopulation } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformPharmacyFirstPopulation.ts";
import {
  finalizePharmacyFirstManifests,
  evaluatePharmacyFirstHealth,
  computeImageVarietyScore,
} from "../src/pharmacy/imagePlatform/pharmacyImagePlatformPharmacyFirstHealth.ts";
import { listPharmacyFirstMetadataV11 } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformPharmacyFirstPopulation.ts";

function loadEnvFileQuiet(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function resolveApiKey(): string {
  loadEnvFileQuiet(path.join(PHARMACY_WORKSPACE_ROOT, ".env"));
  if (process.env.IDEOGRAM_API_KEY) return process.env.IDEOGRAM_API_KEY;
  try {
    const requireCjs = createRequire(import.meta.url);
    const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
      apps?: Array<{ env?: { IDEOGRAM_API_KEY?: string } }>;
    };
    return eco.apps?.[0]?.env?.IDEOGRAM_API_KEY || "";
  } catch {
    return "";
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apiKey = resolveApiKey();
  if (!apiKey && !dryRun) {
    console.error("IDEOGRAM_API_KEY required for population");
    process.exit(1);
  }

  const evidenceDir = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-image-platform/reports/pharmacy-first-v11",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });

  const population = dryRun
    ? { created: 0, approved: 0, pending: 0, rejected: 0, exactDuplicatesRejected: [], nearDuplicatesRejected: [], lowQualityRejected: [], errors: ["dry-run"] }
    : await runPharmacyFirstPopulation(apiKey, "image-platform-v1.1-operator");

  const { serviceManifest, globalRevisionBefore, globalRevisionAfter } = await finalizePharmacyFirstManifests();
  const approved = listPharmacyFirstMetadataV11().filter((a) => a.approvalStatus === "approved");

  const summary = {
    population,
    serviceManifest,
    globalRevisionBefore,
    globalRevisionAfter,
    varietyScore: computeImageVarietyScore(),
    reviewUrl: "https://app.pharmaconnect.uk/api/pharmacy-image-platform/review/pharmacy-first",
    health: evaluatePharmacyFirstHealth(),
    approvedCount: approved.length,
  };

  fs.writeFileSync(path.join(evidenceDir, "population-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  if (serviceManifest.healthStatus !== "READY") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
