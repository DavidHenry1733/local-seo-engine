#!/usr/bin/env npx tsx
/**
 * Successful Mickleover area-reference collection refreshes that area’s derived
 * local pack from saved evidence. No further provider calls.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  localEvidencePackPath,
  validatePharmacyLocalEvidencePack,
  type PharmacyLocalEvidencePackV3,
} from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import type { EditorialEvidencePackV3 } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import {
  reprocessLocalPageEvidenceRun,
  resetEvidenceCollectionTestHarness,
  setEvidenceCollectionTestHarness,
  type LocalPageEvidenceRun,
} from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const SERVICE = "pharmacy-first";
const AREA = "mickleover";

const PROTECTED = [
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.json",
  "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/allestree.json",
  "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
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

function sha256File(rel: string): string {
  const full = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  return createHash("sha256").update(fs.readFileSync(full)).digest("hex");
}

function copyInto(root: string, rel: string) {
  const from = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  const to = path.join(root, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function forbiddenAdapters() {
  return {
    placesSearch: async () => {
      throw new Error("live Places adapter must not run during saved-evidence pack refresh");
    },
    organicSearch: async () => {
      throw new Error("live DataForSEO adapter must not run during saved-evidence pack refresh");
    },
    fetchPage: async () => {
      throw new Error("live page fetch must not run during saved-evidence pack refresh");
    },
  };
}

async function main() {
  console.log("\n=== Mickleover local pack refresh from saved area-reference evidence (no provider calls) ===\n");
  const before = Object.fromEntries(PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const campaignRun = readJson<{ runId?: string; status?: string }>(
    path.join(PHARMACY_WORKSPACE_ROOT, PROTECTED[0]),
  );
  record(
    "stopped-campaign-run-before",
    campaignRun.runId === "e23b2020-b520-453c-a7a5-45d301316229" && campaignRun.status === "stopped",
    `runId=${campaignRun.runId} status=${campaignRun.status}`,
  );

  const liveRun = readJson<LocalPageEvidenceRun>(
    path.join(
      PHARMACY_WORKSPACE_ROOT,
      "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
    ),
  );
  record(
    "saved-mickleover-collection-ready",
    liveRun.runId === "cf8b4949-1aa6-4d71-a883-bacf410f6603" &&
      liveRun.areaSlug === AREA &&
      liveRun.status === "completed" &&
      liveRun.distanceKm === 3.7 &&
      liveRun.spentUsd === 0.1 &&
      liveRun.paidCallsMade === 5 &&
      liveRun.areaReferencePoint?.source === "places-area-reference" &&
      (liveRun.placesHitsByCall["places-gp-practices"] || []).length === 0,
    `run=${liveRun.runId} km=${liveRun.distanceKm} spent=${liveRun.spentUsd} gps=${(liveRun.placesHitsByCall["places-gp-practices"] || []).length}`,
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mickleover-pack-refresh-"));
  for (const rel of [
    "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
    "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
    "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/mickleover.json",
    "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json",
    "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/allestree.json",
    "data/pharmacy-local-editorial-evidence-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  ]) {
    copyInto(tmp, rel);
  }
  const seededPackPath = localEvidencePackPath(BROOK, AREA, tmp);
  fs.mkdirSync(path.dirname(seededPackPath), { recursive: true });
  fs.writeFileSync(
    seededPackPath,
    `${JSON.stringify(
      {
        version: "v3",
        slug: BROOK,
        area: "Mickleover",
        areaSlug: AREA,
        provider: "googlePlaces",
        generatedAt: "2026-09-05T15:48:09.753Z",
        sourceStatus: "google-places-authorised-collection-zero-gp",
        pharmacyCoordinates: {
          latitude: 52.91678930677714,
          longitude: -1.4825298233725033,
          source: "profile:coordinates",
        },
        healthcare: [],
        community: [],
        landmarks: [],
        transport: [],
        schools: [],
        retail: [],
        rejected: [],
        researchCandidates: [],
        evidenceLimited: true,
        qualitySummary: {
          attributableCount: 0,
          rejectedCount: 0,
          categoriesPresent: [],
          minimumMet: false,
        },
      },
      null,
      2,
    )}\n`,
  );
  const seededPack = readJson<PharmacyLocalEvidencePackV3>(seededPackPath);
  record(
    "tmp-pack-seeded-limited-without-relationship",
    seededPack.areaSlug === AREA &&
      seededPack.evidenceLimited === true &&
      (seededPack.healthcare || []).length === 0 &&
      !seededPack.pharmacyRelationship,
    `limited=${seededPack.evidenceLimited} healthcare=${(seededPack.healthcare || []).length}`,
  );
  const allestreePackBefore = fs.readFileSync(
    path.join(tmp, "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/allestree.json"),
    "utf8",
  );

  setEvidenceCollectionTestHarness({
    storageRoot: tmp,
    persistPacks: true,
    liveProvidersForbidden: true,
    adapters: forbiddenAdapters(),
  });
  try {
    const result = reprocessLocalPageEvidenceRun({ slug: BROOK, serviceId: SERVICE, areaSlug: AREA });
    record("reprocess-ok-without-provider-calls", result.ok === true, result.ok ? `run=${result.run.runId}` : result.error);
    if (!result.ok) return;
    record(
      "preserved-run-calls-and-spend",
      result.run.runId === "cf8b4949-1aa6-4d71-a883-bacf410f6603" &&
        result.run.spentUsd === 0.1 &&
        result.run.paidCallsMade === 5 &&
        result.paidCallsMade === 5 &&
        result.run.distanceKm === 3.7 &&
        result.run.calls.find((row) => row.id === "places-area-reference")?.actualCostUsd === 0.032,
      `spent=${result.run.spentUsd} paid=${result.run.paidCallsMade} km=${result.run.distanceKm}`,
    );

    const pack = readJson<PharmacyLocalEvidencePackV3>(localEvidencePackPath(BROOK, AREA, tmp));
    const relationship = pack.pharmacyRelationship;
    record(
      "refreshed-pack-is-mickleover-only",
      pack.slug === BROOK &&
        pack.area === "Mickleover" &&
        pack.areaSlug === AREA &&
        (pack.healthcare || []).length === 0 &&
        !/allestree|park lane|4\.1/i.test(JSON.stringify(pack)),
      `area=${pack.areaSlug} healthcare=${(pack.healthcare || []).length} source=${pack.sourceStatus}`,
    );
    record(
      "saved-straight-line-relationship-included",
      relationship?.from === "Brook Pharmacy Demo Derby" &&
        relationship?.to === "Mickleover" &&
        relationship?.distanceKm === 3.7 &&
        relationship?.method === "haversine-straight-line" &&
        relationship?.areaReferenceSource === "places-area-reference" &&
        !/travel time|driving|route|convenience|availability/i.test(JSON.stringify(relationship)),
      JSON.stringify(relationship),
    );
    record(
      "readable-relationship-has-no-raw-coordinates-or-ids",
      Boolean(relationship) &&
        !/52\.| -1\.|placeId|ChIJ/i.test(JSON.stringify(relationship)),
      JSON.stringify(relationship),
    );

    const packCheck = validatePharmacyLocalEvidencePack(pack, {
      slug: BROOK,
      areaName: "Mickleover",
      areaSlug: AREA,
    });
    record(
      "existing-validator-passes-after-refresh",
      packCheck.ok === true && pack.evidenceLimited === false && pack.qualitySummary.minimumMet === true,
      packCheck.ok ? `source=${pack.sourceStatus} limited=${pack.evidenceLimited}` : packCheck.detail,
    );

    const editorial = readJson<EditorialEvidencePackV3>(
      path.join(tmp, "data/pharmacy-local-editorial-evidence-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json"),
    );
    const wouldGenerate = packCheck.ok && editorial.sufficiency.status === "READY";
    record(
      "generate-available-only-when-validator-and-editorial-ready",
      wouldGenerate === true &&
        editorial.areaSlug === AREA &&
        editorial.sufficiency.status === "READY" &&
        !/allestree/i.test(JSON.stringify(editorial.facts.map((fact) => fact.factId))),
      `pack=${packCheck.ok} editorial=${editorial.sufficiency.status} generate=${wouldGenerate}`,
    );

    const allestreePackAfter = fs.readFileSync(
      path.join(tmp, "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/allestree.json"),
      "utf8",
    );
    record("allestree-pack-untouched-in-tmp", allestreePackAfter === allestreePackBefore, "allestree pack bytes unchanged");
  } finally {
    resetEvidenceCollectionTestHarness();
  }

  const after = Object.fromEntries(PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const liveChanged = PROTECTED.filter((rel) => before[rel] !== after[rel]);
  record("live-protected-files-unchanged", liveChanged.length === 0, liveChanged.join(", ") || "none");
  const campaignAfter = readJson<{ runId?: string; status?: string }>(
    path.join(PHARMACY_WORKSPACE_ROOT, PROTECTED[0]),
  );
  record(
    "stopped-campaign-run-after",
    campaignAfter.runId === "e23b2020-b520-453c-a7a5-45d301316229" && campaignAfter.status === "stopped",
    `runId=${campaignAfter.runId} status=${campaignAfter.status}`,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
