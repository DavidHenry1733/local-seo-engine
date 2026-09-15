#!/usr/bin/env npx tsx
/**
 * CURRENT-RUN-CAMPAIGN-OUTPUT-HANDOFF-33A
 * No-write fixtures: does not touch live tenant output, Flu, Travel, BP, or approved banks.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyCampaignRunStampToHtml,
  applyCampaignRunStampToJson,
  applyCurrentRunHandoffOrKeepCampaignState,
  buildCurrentRunInventory,
  collectCurrentRunSourceFiles,
  createCampaignRunStamp,
  existingOutputsMustNotSkipFreshGeneration,
  fileHasRequiredGenerationStamp,
  fileMatchesCurrentRunStamp,
  isHistoricalOutputPath,
  listCurrentRunInventoryFiles,
  verifyCurrentRunInventory,
  type CampaignRunStamp,
} from "../src/pharmacy/pharmacyCurrentRunCampaignHandoff.ts";

const AREAS = [
  "darfield",
  "wombwell",
  "thurnscoe",
  "grimethorpe",
  "goldthorpe",
  "worsbrough",
  "hoyland",
  "cudworth",
];

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function stampedHtml(stamp: CampaignRunStamp, body: string): string {
  return applyCampaignRunStampToHtml(
    `<!DOCTYPE html><html><head><title>${body}</title></head><body><p>${body}</p></body></html>`,
    stamp,
  );
}

function unstampedHtml(body: string): string {
  return `<!DOCTYPE html><html><head><title>${body}</title></head><body><p>${body}</p></body></html>`;
}

function main(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "current-run-handoff-33a-"));
  const stamp = createCampaignRunStamp("fixture-tenant", "pharmacy-first", "2026-08-27T12:00:00.000Z");
  const localDir = path.join(root, "local");
  const servicePath = path.join(root, "service", "index.html");
  const trustPath = path.join(root, "packs", "review-trust.json");
  const historicalPaths: string[] = [];

  fs.mkdirSync(path.dirname(servicePath), { recursive: true });
  fs.writeFileSync(servicePath, stampedHtml(stamp, "current-run service page"), "utf8");

  for (const area of AREAS) {
    const current = path.join(localDir, area, "index.html");
    const revision = path.join(localDir, area, "revisions", "2026-08-21T09-33-22-000Z", "index.html");
    fs.mkdirSync(path.dirname(current), { recursive: true });
    fs.mkdirSync(path.dirname(revision), { recursive: true });
    fs.writeFileSync(current, stampedHtml(stamp, `current-run ${area}`), "utf8");
    fs.writeFileSync(revision, unstampedHtml(`historical ${area}`), "utf8");
    historicalPaths.push(revision);
  }

  const quarantine = path.join(localDir, "quarantine", "index.html");
  const previousOutput = path.join(root, "previous-output", "index.html");
  fs.mkdirSync(path.dirname(quarantine), { recursive: true });
  fs.mkdirSync(path.dirname(previousOutput), { recursive: true });
  fs.writeFileSync(quarantine, unstampedHtml("quarantine"), "utf8");
  fs.writeFileSync(previousOutput, unstampedHtml("previous-output"), "utf8");
  historicalPaths.push(quarantine, previousOutput);

  fs.mkdirSync(path.dirname(trustPath), { recursive: true });
  fs.writeFileSync(
    trustPath,
    applyCampaignRunStampToJson(JSON.stringify({ type: "review-trust", notes: "current-run review record" }), stamp),
    "utf8",
  );

  const localityPagePaths = AREAS.map((area) => path.join(localDir, area, "index.html"));
  const inventory = buildCurrentRunInventory({
    stamp,
    servicePagePath: servicePath,
    localityPagePaths,
    reviewRecordPaths: [trustPath],
  });

  const collected = collectCurrentRunSourceFiles(localDir);
  const collectedHistorical = collected.filter((file) => isHistoricalOutputPath(file));
  const reviewFiles = listCurrentRunInventoryFiles(inventory);
  const historicalInReview = reviewFiles.filter((file) => isHistoricalOutputPath(file) || historicalPaths.includes(file));

  record(
    "current-run-handoff",
    verifyCurrentRunInventory(inventory, { expectedLocalityCount: 8 }).ok &&
      reviewFiles.length === 10 &&
      historicalInReview.length === 0,
    `${reviewFiles.length} current-run files (1 service + 8 localities + 1 review); historical in review=${historicalInReview.length}`,
  );

  record(
    "historical-revisions-excluded",
    collected.length === 8 &&
      collectedHistorical.length === 0 &&
      historicalPaths.every((file) => isHistoricalOutputPath(file)) &&
      !fileHasRequiredGenerationStamp(fs.readFileSync(historicalPaths[0]!, "utf8"), stamp.tenantSlug, stamp.campaignId),
    `walked ${collected.length} current locality files; skipped ${historicalPaths.length} historical paths`,
  );

  const alreadyStamped = fs.readFileSync(servicePath, "utf8");
  const freshStamp = createCampaignRunStamp(stamp.tenantSlug, stamp.campaignId, "2026-08-27T13:00:00.000Z");
  const restamped = applyCampaignRunStampToHtml(alreadyStamped, freshStamp);
  record(
    "fresh-generation-not-skipped",
    existingOutputsMustNotSkipFreshGeneration([...historicalPaths, ...localityPagePaths, servicePath]) === false &&
      fileMatchesCurrentRunStamp(restamped, freshStamp) &&
      !restamped.includes(stamp.runId),
    "existing historical/current outputs do not skip a fresh run stamp",
  );

  const previousState = { status: "generated", generationError: null as string | null, run: "before" };
  const proposedState = { status: "error", generationError: "stamp fail", run: "after" };
  const badInventory = buildCurrentRunInventory({
    stamp,
    servicePagePath: historicalPaths[0]!,
    localityPagePaths,
    reviewRecordPaths: [trustPath],
  });
  const failed = applyCurrentRunHandoffOrKeepCampaignState({
    previousCampaignState: previousState,
    proposedCampaignState: proposedState,
    inventory: badInventory,
    expectedLocalityCount: 8,
  });
  const unstampedCurrent = path.join(root, "unstamped-service.html");
  fs.writeFileSync(unstampedCurrent, unstampedHtml("missing stamp"), "utf8");
  const missingStampInventory = buildCurrentRunInventory({
    stamp,
    servicePagePath: unstampedCurrent,
    localityPagePaths,
    reviewRecordPaths: [trustPath],
  });
  const missingStampTx = applyCurrentRunHandoffOrKeepCampaignState({
    previousCampaignState: previousState,
    proposedCampaignState: proposedState,
    inventory: missingStampInventory,
    expectedLocalityCount: 8,
  });
  record(
    "failure-atomicity",
    failed.ok === false &&
      failed.campaignState === previousState &&
      failed.campaignState.status === "generated" &&
      missingStampTx.ok === false &&
      missingStampTx.campaignState.status === "generated" &&
      !fileHasRequiredGenerationStamp(fs.readFileSync(unstampedCurrent, "utf8"), stamp.tenantSlug, stamp.campaignId),
    "stamp/handoff failure keeps previous campaign state; unstamped current-run file still fails validation",
  );

  fs.rmSync(root, { recursive: true, force: true });

  const failedChecks = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failedChecks.length}/${checks.length} passed`);
  if (failedChecks.length) process.exit(1);
}

main();
