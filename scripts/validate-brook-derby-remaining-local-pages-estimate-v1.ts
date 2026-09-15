#!/usr/bin/env npx tsx
/**
 * Brook Derby campaign-level remaining local-page confirmation estimate.
 * Read-only: does not confirm, collect, generate, grant allowance, publish or start a live run.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { planRemainingLocalPagesCampaign } from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SERVICE = "pharmacy-first";
const ALLESTREE_PROTECTED = [
  "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:allestree.json",
  "data/growth-engine/brook-pharmacy-demo-derby-campaign-builder.json",
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
  return createHash("sha256").update(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel))).digest("hex");
}

function main() {
  console.log("\n=== Brook Derby remaining local-page confirmation estimate (read-only) ===\n");
  const protectedBefore = Object.fromEntries(ALLESTREE_PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const plan = planRemainingLocalPagesCampaign(BROOK_DERBY_DEMO_SLUG, SERVICE);
  const mickleover = plan.remaining.find((row) => row.areaSlug === "mickleover");
  const littleover = plan.remaining.find((row) => row.areaSlug === "littleover");
  const html = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "allestree" });

  record(
    "nine-incomplete-areas",
    plan.remaining.length === 9 && plan.complete.map((row) => row.areaSlug).join(",") === "allestree",
    `complete=${plan.complete.map((row) => row.areaSlug).join(",")} remaining=${plan.remaining.length}`,
  );
  record(
    "blocked-area-still-counts-openai-maximum",
    mickleover?.evidenceReady === true &&
      mickleover?.evidenceBlocked === false &&
      mickleover?.evidenceCollectionRequired === false &&
      mickleover?.maxGenerationCalls === 1 &&
      mickleover?.maxGenerationCostUsd === 2 &&
      mickleover?.maxEvidenceCalls === 0,
    `mickleover ready=${mickleover?.evidenceReady} openai=${mickleover?.maxGenerationCalls} evidenceCost=${mickleover?.maxEvidenceCostUsd}`,
  );
  record(
    "collection-required-area-counts-openai-maximum",
    Boolean(littleover?.evidenceCollectionRequired) &&
      littleover?.evidenceReady === false &&
      littleover?.evidenceBlocked === false &&
      littleover?.maxGenerationCalls === 1,
    `littleover collect=${littleover?.evidenceCollectionRequired} openai=${littleover?.maxGenerationCalls}`,
  );
  record(
    "status-counts",
    plan.evidenceCurrentlyReadyCount === 1 &&
      plan.evidenceRequiringCollectionCount === 8 &&
      plan.generationCurrentlyBlockedCount === 0,
    `ready=${plan.evidenceCurrentlyReadyCount} collect=${plan.evidenceRequiringCollectionCount} blocked=${plan.generationCurrentlyBlockedCount}`,
  );
  record(
    "nine-openai-calls-and-recalculated-total",
    plan.maxGenerationCalls === 9 &&
      plan.maxGenerationCostUsd === 18 &&
      plan.maxEvidenceCalls === 56 &&
      plan.maxEvidenceCostUsd === 0.544 &&
      plan.maxProviderCalls === 65 &&
      plan.maxTotalCostUsd === 18.544 &&
      plan.maxGenerationCostLabel === "$18.00" &&
      plan.maxTotalCostLabel === "$18.544" &&
      plan.maxProviderCallsLabel === "56 evidence calls + 9 OpenAI calls",
    `openai=${plan.maxGenerationCalls} gen=${plan.maxGenerationCostLabel} evidence=${plan.maxEvidenceCostLabel} total=${plan.maxTotalCostLabel} provider=${plan.maxProviderCallsLabel}`,
  );
  record(
    "ui-distinguishes-estimate-states",
    html.includes("Evidence currently ready") &&
      html.includes("Evidence requiring collection") &&
      html.includes("Generation currently blocked") &&
      html.includes("Maximum generation calls if collection succeeds") &&
      html.includes('data-max-generation-calls="9"') &&
      html.includes('data-max-generation-cost-usd="18"') &&
      html.includes('data-max-total-cost-usd="18.544"') &&
      html.includes('data-evidence-currently-ready="true"') &&
      html.includes('data-evidence-requiring-collection="true"') &&
      html.includes("even when its evidence is not READY before collection") &&
      html.includes('id="btnCreateRemainingLocalPages" disabled') &&
      html.includes('id="btnResumeRemainingLocalPages" disabled'),
    "Confirmation panel shows 9 OpenAI calls and the four estimate states; start stays disabled",
  );

  for (const rel of ALLESTREE_PROTECTED) {
    record(`preserve-${path.basename(rel)}`, sha256File(rel) === protectedBefore[rel], rel);
  }

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
