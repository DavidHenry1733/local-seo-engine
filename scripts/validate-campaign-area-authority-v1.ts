#!/usr/bin/env npx tsx
/**
 * Generic campaign locality-scope authority.
 * Case A: explicit selected:true wins over a larger discovered/recommended pool.
 * Case B: no explicit selection keeps benchmark/ranking proposal.
 * Fixtures only for A/B. Vision checks are read-only and do not generate or write.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { estimateCampaignOutputs } from "../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import type { ProfileAreaEntry } from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  explicitConfirmedLocalityNames,
  rankStoredCampaignTargetAreas,
  resolveRecommendedCampaignTargetAreaCount,
} from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { resolveAuthoritativeCampaignTargetAreas } from "../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { resolveCampaignBuilderTargetAreas } from "../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS } from "../src/pharmacy/growthEngineCampaignModel.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function named(areaName: string, selected: boolean, order: number): ProfileAreaEntry {
  return { areaName, selected, order } as ProfileAreaEntry;
}

function main() {
  console.log("\n=== Campaign locality-scope authority ===\n");

  const discovered = [
    "Northfield",
    "Southgate",
    "Westbrook",
    "Eastleigh",
    "Highfield",
    "Parkside",
    "Milltown",
    "Riverside",
    "Oakridge",
    "Fairview",
    "Stonebridge",
    "Mapleton",
  ];
  const selectedEight = discovered.slice(0, 8);
  const unselected = discovered.slice(8);

  const caseAAreas = discovered.map((areaName, index) => named(areaName, index < 8, index + 1));
  const caseAProfile = normalizeProfileData({
    pharmacyName: "Authority Case A Pharmacy",
    selectedAreas: caseAAreas,
    rankingAreas: selectedEight,
  });
  const caseAOutputs = estimateCampaignOutputs(caseAProfile);
  const caseAConfirmed = explicitConfirmedLocalityNames(caseAProfile.selectedAreas);
  const caseARanked = rankStoredCampaignTargetAreas("__authority-case-a__", caseAProfile.selectedAreas || [], selectedEight);
  const caseARecommended = caseARanked.filter((row) => row.recommended).map((row) => row.area);
  const caseAResolved = resolveAuthoritativeCampaignTargetAreas({
    selectedAreas: caseAProfile.selectedAreas,
    primaryTown: "Northfield",
    session: { targetAreaMode: "selected", targetAreaNames: selectedEight },
    ranked: caseARanked,
  });
  const caseAUnauthorisedEmptySession = resolveAuthoritativeCampaignTargetAreas({
    selectedAreas: caseAProfile.selectedAreas,
    primaryTown: "Northfield",
    session: { targetAreaMode: "selected", targetAreaNames: [] },
    ranked: caseARanked,
  });

  record(
    "case-a-cluster-count",
    caseAOutputs.clusterPages === selectedEight.length,
    `clusterPages=${caseAOutputs.clusterPages} expected=${selectedEight.length}`,
  );
  record(
    "case-a-confirmed-set",
    caseAConfirmed.join("|") === selectedEight.join("|"),
    caseAConfirmed.join(", "),
  );
  record(
    "case-a-generation-set",
    caseAResolved.areas.join("|") === selectedEight.join("|") && caseAResolved.areas.length === 8,
    `${caseAResolved.areas.length}: ${caseAResolved.areas.join(", ")}`,
  );
  record(
    "case-a-ignores-ranked-padding",
    caseAUnauthorisedEmptySession.areas.join("|") === selectedEight.join("|") &&
      !unselected.some((name) => caseAUnauthorisedEmptySession.areas.includes(name)),
    `empty-session generation=${caseAUnauthorisedEmptySession.areas.join(", ")}`,
  );
  record(
    "case-a-recommended-excludes-unselected",
    caseARecommended.join("|") === selectedEight.join("|") &&
      !unselected.some((name) => caseARecommended.includes(name)),
    `recommended=${caseARecommended.join(", ")}`,
  );
  record(
    "case-a-does-not-expand-to-benchmark",
    caseAOutputs.clusterPages !== BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.recommendedTargetAreas &&
      caseAResolved.areas.length < discovered.length,
    `count=${caseAResolved.areas.length} named=${discovered.length} benchmark=${BENCHMARK_ECOSYSTEM_OUTPUT_DEFAULTS.recommendedTargetAreas}`,
  );

  const caseBAreas = discovered.map((areaName, index) => named(areaName, false, index + 1));
  const caseBProfile = normalizeProfileData({
    pharmacyName: "Authority Case B Pharmacy",
    selectedAreas: caseBAreas,
    rankingAreas: [],
  });
  const caseBOutputs = estimateCampaignOutputs(caseBProfile);
  const caseBConfirmed = explicitConfirmedLocalityNames(caseBProfile.selectedAreas);
  const caseBRanked = rankStoredCampaignTargetAreas("__authority-case-b__", caseBProfile.selectedAreas || [], []);
  const caseBRecommended = caseBRanked.filter((row) => row.recommended).map((row) => row.area);
  const expectedBenchmark = resolveRecommendedCampaignTargetAreaCount(discovered.length);
  const caseBResolved = resolveAuthoritativeCampaignTargetAreas({
    selectedAreas: caseBProfile.selectedAreas,
    primaryTown: "Northfield",
    session: { targetAreaMode: "selected", targetAreaNames: [] },
    ranked: caseBRanked,
  });

  record("case-b-no-explicit-selection", caseBConfirmed.length === 0, `confirmed=${caseBConfirmed.length}`);
  record(
    "case-b-benchmark-cluster-count",
    caseBOutputs.clusterPages === expectedBenchmark && expectedBenchmark === 10,
    `clusterPages=${caseBOutputs.clusterPages} expected=${expectedBenchmark}`,
  );
  record(
    "case-b-ranking-proposal-available",
    caseBRecommended.length === expectedBenchmark && caseBResolved.areas.join("|") === caseBRecommended.join("|"),
    `proposed=${caseBResolved.areas.length}: ${caseBResolved.areas.join(", ")}`,
  );
  record(
    "case-b-proposal-from-named-pool",
    caseBResolved.areas.every((name) => discovered.includes(name)) && caseBResolved.areas.length === 10,
    "ranked recommendation remains available before selection",
  );

  const engineFiles = [
    "src/pharmacy/growthEngineCampaignRecommendationEngine.ts",
    "src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts",
    "src/pharmacy/contentEngine/customerCampaignGenerationContext.ts",
    "src/pharmacy/growthEngineCampaignBuilderService.ts",
  ];
  const hardcoded = engineFiles.some((rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    return /vision-pharmacy|Glenfield|Kibworth/.test(src);
  });
  record("generic-no-vision-hardcode", !hardcoded, hardcoded ? "tenant names found in engine files" : "no Vision hardcoding");

  const visionFile = path.join(ROOT, "data/pharmacy-profiles", "vision-pharmacy.json");
  if (fs.existsSync(visionFile)) {
    const visionDoc = JSON.parse(fs.readFileSync(visionFile, "utf8"));
    const visionProfile = normalizeProfileData(visionDoc.data || {});
    const visionConfirmed = explicitConfirmedLocalityNames(visionProfile.selectedAreas);
    const visionOutputs = estimateCampaignOutputs(visionProfile);
    const session = loadCampaignBuilderSession("vision-pharmacy");
    const visionResolved = resolveCampaignBuilderTargetAreas("vision-pharmacy", session);
    const byName = new Map(
      (visionProfile.selectedAreas || []).map((row) => [String(row.areaName || "").toLowerCase(), row.selected === true]),
    );
    record(
      "vision-growth-plan-count",
      visionOutputs.clusterPages === visionConfirmed.length && visionConfirmed.length === 8,
      `clusterPages=${visionOutputs.clusterPages} confirmed=${visionConfirmed.length}`,
    );
    record(
      "vision-generation-set",
      visionResolved.areas.join("|") === visionConfirmed.join("|") && visionResolved.areas.length === 8,
      `${visionResolved.areas.length}: ${visionResolved.areas.join(", ")}`,
    );
    record(
      "vision-glenfield-unselected",
      byName.get("glenfield") === false && !visionResolved.areas.some((name) => name.toLowerCase() === "glenfield"),
      `glenfield selected=${String(byName.get("glenfield"))}`,
    );
    record(
      "vision-kibworth-unselected",
      byName.get("kibworth") === false && !visionResolved.areas.some((name) => name.toLowerCase() === "kibworth"),
      `kibworth selected=${String(byName.get("kibworth"))}`,
    );
    record(
      "vision-cannot-expand-to-ten",
      visionResolved.areas.length === 8 && visionOutputs.clusterPages === 8,
      `generation=${visionResolved.areas.length} plan=${visionOutputs.clusterPages}`,
    );
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks\n`);
  if (failed.length) process.exit(1);
}

main();
