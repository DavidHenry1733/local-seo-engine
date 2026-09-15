#!/usr/bin/env npx tsx
/**
 * Allestree evidence-quality regression from the saved UI collection run.
 * Reprocesses stored Places, SERP and page bodies only. No live paid calls.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  attributeEntityToArea,
  loadPharmacyLocalEvidencePack,
  localEvidencePackPath,
} from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  extractEditorialFactDrafts,
  hostFromUrl,
} from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { resolveGeographicEvidenceContext } from "../src/pharmacy/contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import {
  reprocessLocalPageEvidenceRun,
  resetEvidenceCollectionTestHarness,
  setEvidenceCollectionTestHarness,
  type LocalPageEvidenceRun,
} from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import { planPharmacyLocalEvidenceRequest } from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const SERVICE = "pharmacy-first";
const AREA = "allestree";
const LIVE_RUN = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-local-page-evidence-runs",
  BROOK,
  SERVICE,
  "v1",
  "allestree.json",
);
const LIVE_PACK = localEvidencePackPath(BROOK, AREA);
const LIVE_PACK_BACKUP = LIVE_PACK.replace(/\.json$/, ".before-evidence-quality-fix.json");

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

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function copyTree(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

async function main() {
  console.log("\n=== Allestree evidence quality from saved run (no paid calls) ===\n");

  if (!fs.existsSync(LIVE_RUN)) {
    record("saved-run-present", false, LIVE_RUN);
    process.exitCode = 1;
    return;
  }

  const liveRun = readJson<LocalPageEvidenceRun>(LIVE_RUN);
  const beforePack = fs.existsSync(LIVE_PACK_BACKUP)
    ? readJson<{ healthcare?: unknown[]; rejected?: Array<{ name?: string; rejectionReason?: string }> }>(LIVE_PACK_BACKUP)
    : fs.existsSync(LIVE_PACK)
      ? readJson<{ healthcare?: unknown[]; rejected?: Array<{ name?: string; rejectionReason?: string }> }>(LIVE_PACK)
      : { healthcare: [], rejected: [] };

  record(
    "saved-run-identity",
    liveRun.runId === "c7a7c587-22f0-474a-a59a-745a5bbe34a3" &&
      liveRun.spentUsd === 0.068 &&
      liveRun.paidCallsMade === 4,
    `runId=${liveRun.runId} spent=${liveRun.spentUsd} paid=${liveRun.paidCallsMade}`,
  );

  const parkFarmRejected = (beforePack.rejected || []).find((row) => row.name === "Park Farm Medical Centre");
  record(
    "before-pack-park-farm-incompatible-postcode",
    parkFarmRejected?.rejectionReason === "incompatible-postcode",
    parkFarmRejected ? String(parkFarmRejected.rejectionReason) : "Park Farm Medical Centre not in rejected list",
  );
  record(
    "before-pack-zero-healthcare",
    (beforePack.healthcare || []).length === 0,
    `healthcare=${(beforePack.healthcare || []).length}`,
  );

  const gpHits = liveRun.placesHitsByCall["places-gp-practices"] || [];
  record(
    "saved-places-returned-allestree-gps",
    gpHits.some((hit) => hit.name === "Park Farm Medical Centre" && /Allestree/i.test(String(hit.address || ""))) &&
      gpHits.some((hit) => hit.name === "Park Lane Surgery") &&
      gpHits.length >= 5,
    gpHits.map((hit) => hit.name).join(" | "),
  );

  const request = planPharmacyLocalEvidenceRequest(BROOK, SERVICE);
  const geo = resolveGeographicEvidenceContext({
    slug: BROOK,
    areaName: "Allestree",
    areaSlug: AREA,
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });
  record(
    "pharmacy-postcode-not-trusted-for-demo-listing",
    geo.pharmacyPostcodeVerified === false && /^DA5\b/i.test(geo.pharmacyPostcode || ""),
    `verified=${geo.pharmacyPostcodeVerified} postcode=${geo.pharmacyPostcode}`,
  );

  const parkFarmHit = gpHits.find((hit) => hit.name === "Park Farm Medical Centre");
  const parkFarmNow = parkFarmHit
    ? attributeEntityToArea(
        {
          name: parkFarmHit.name,
          address: parkFarmHit.address,
          types: parkFarmHit.types,
          location: parkFarmHit.location,
          placeId: parkFarmHit.placeId,
          locality: parkFarmHit.locality || parkFarmHit.address,
          addressComponents: parkFarmHit.addressComponents,
        },
        geo,
      )
    : { ok: false as const, rejectionReason: "missing-hit" };
  record(
    "after-attribution-park-farm-accepted",
    parkFarmNow.ok === true,
    parkFarmNow.ok ? parkFarmNow.relationship : parkFarmNow.rejectionReason,
  );

  const council = liveRun.pagesByCall["page-body-locality"];
  const identityDrafts = extractEditorialFactDrafts({
    areaName: "Allestree",
    title: council?.title || "",
    text: council?.textSample || "",
    sourceClass: "primary",
    publisher: "derby.gov.uk",
    host: hostFromUrl(council?.url || "https://www.derby.gov.uk/"),
  });
  record(
    "council-title-yields-area-identity",
    identityDrafts.some(
      (row) =>
        row.category === "area-identity" &&
        /Allestree is a neighbourhood ward in Derby/i.test(row.normalizedStatement),
    ),
    identityDrafts.map((row) => `${row.category}:${row.normalizedStatement}`).join(" | ") || "no drafts",
  );
  record(
    "council-body-yields-supported-community-facts",
    identityDrafts.some((row) => /Neighbourhood Board of local councillors/i.test(row.normalizedStatement)) &&
      identityDrafts.some((row) => /Allestree Park is named/i.test(row.normalizedStatement)),
    identityDrafts.filter((row) => row.category === "community").map((row) => row.normalizedStatement).join(" | ") || "no community drafts",
  );

  const nhs = liveRun.pagesByCall["page-body-gp-official"];
  const healthcareDrafts = extractEditorialFactDrafts({
    areaName: "Allestree",
    title: nhs?.title || "",
    text: nhs?.textSample || "",
    sourceClass: "primary",
    publisher: "NHS",
    host: hostFromUrl(nhs?.url || "https://www.nhs.uk/"),
  });
  record(
    "nhs-body-already-named-park-lane",
    healthcareDrafts.some((row) => /Park Lane Surgery/i.test(row.normalizedStatement)),
    healthcareDrafts.map((row) => row.normalizedStatement).join(" | ") || "no NHS drafts",
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "allestree-evidence-quality-"));
  const runDest = path.join(tmp, "data/pharmacy-local-page-evidence-runs", BROOK, SERVICE, "v1", "allestree.json");
  const budgetSrc = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-budget",
    BROOK,
    SERVICE,
    "v1",
    "allestree.json",
  );
  copyTree(LIVE_RUN, runDest);
  if (fs.existsSync(budgetSrc)) {
    copyTree(
      budgetSrc,
      path.join(tmp, "data/pharmacy-local-page-evidence-budget", BROOK, SERVICE, "v1", "allestree.json"),
    );
  }

  setEvidenceCollectionTestHarness({
    storageRoot: tmp,
    persistPacks: false,
    liveProvidersForbidden: true,
    adapters: {
      placesSearch: async () => {
        throw new Error("live Places adapter must not run during saved-run reprocess");
      },
      organicSearch: async () => {
        throw new Error("live DataForSEO adapter must not run during saved-run reprocess");
      },
      fetchPage: async () => {
        throw new Error("live page fetch must not run during saved-run reprocess");
      },
    },
  });
  try {
    const result = reprocessLocalPageEvidenceRun({ slug: BROOK, serviceId: SERVICE, areaSlug: AREA });
    record("reprocess-ok", result.ok === true, result.ok ? `gps=${result.run.verifiedGpPracticeCount}` : result.error);
    if (!result.ok) return;
    record(
      "reprocess-preserves-spend-and-run",
      result.run.runId === liveRun.runId &&
        result.run.spentUsd === 0.068 &&
        result.run.paidCallsMade === 4 &&
        result.paidCallsMade === 4,
      `runId=${result.run.runId} spent=${result.run.spentUsd} paid=${result.run.paidCallsMade}`,
    );
    record(
      "reprocess-verified-gps",
      result.run.verifiedGpPracticeCount === 1,
      `verifiedGpPracticeCount=${result.run.verifiedGpPracticeCount} findings=${(result.run.findings || []).join(" | ")}`,
    );
    record(
      "reprocess-identity-present",
      (result.run.findings || []).every((row) => !/no attributable identity fact/i.test(row)) &&
        Boolean(result.run.outcomeSummary),
      result.run.outcomeSummary || (result.run.findings || []).join(" | "),
    );
    record(
      "reprocess-sufficiency",
      result.run.editorialSufficiency === "READY" || result.run.editorialSufficiency === "EVIDENCE LIMITED",
      String(result.run.editorialSufficiency),
    );
    record(
      "reprocess-did-not-need-fresh-retrieval",
      result.run.pagesByCall["page-body-gp-official"]?.url === liveRun.pagesByCall["page-body-gp-official"]?.url &&
        result.run.pagesByCall["page-body-locality"]?.url === liveRun.pagesByCall["page-body-locality"]?.url,
      `gp=${result.run.pagesByCall["page-body-gp-official"]?.url} locality=${result.run.pagesByCall["page-body-locality"]?.url}`,
    );
  } finally {
    resetEvidenceCollectionTestHarness();
  }

  const liveRunAfterTest = readJson<LocalPageEvidenceRun>(LIVE_RUN);
  record(
    "live-run-untouched-by-tmp-reprocess",
    liveRunAfterTest.spentUsd === liveRun.spentUsd &&
      liveRunAfterTest.paidCallsMade === liveRun.paidCallsMade &&
      liveRunAfterTest.runId === liveRun.runId,
    `spent=${liveRunAfterTest.spentUsd} paid=${liveRunAfterTest.paidCallsMade}`,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
