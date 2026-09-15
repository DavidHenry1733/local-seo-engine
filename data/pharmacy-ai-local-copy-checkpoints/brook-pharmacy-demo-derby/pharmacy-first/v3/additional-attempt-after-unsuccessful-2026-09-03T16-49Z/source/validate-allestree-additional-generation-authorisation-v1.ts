#!/usr/bin/env npx tsx
/**
 * User-authorised additional generation attempts.
 * Fixture budget copies only. Does not authorise the live Allestree file,
 * generate copy, collect evidence, or make paid calls.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3,
  ADDITIONAL_GENERATION_ATTEMPT_EVENT,
  authoriseOneAdditionalGenerationAttemptV3,
  loadAuthorizedTaskBudgetV3,
  remainingAuthorizedProviderCallsV3,
  type AuthorizedTaskBudgetV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const AREA = "allestree";
const TASK_ID = `${BROOK}:${SERVICE}:v3:one-local-page:${AREA}`;
const LIVE_CONSUMED = 3;
const LIVE_MAX_CALLS = 3;
const LIVE_COST_USD = 0.045778;
const LIVE_ADDITIONAL_EVENTS = 1;
const LIVE_BUDGET = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-ai-local-generation-budget",
  BROOK,
  SERVICE,
  "v3",
  `${TASK_ID}.json`,
);

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

function readBudget(file: string): AuthorizedTaskBudgetV3 {
  return JSON.parse(fs.readFileSync(file, "utf8")) as AuthorizedTaskBudgetV3;
}

function copyLiveBudget(root: string): string {
  const dest = path.join(root, BROOK, SERVICE, "v3", `${TASK_ID}.json`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(LIVE_BUDGET, dest);
  return dest;
}

function spendMatches(
  budget: AuthorizedTaskBudgetV3,
  consumed = LIVE_CONSUMED,
  costUsd = LIVE_COST_USD,
): boolean {
  return budget.consumed === consumed && Math.abs(budget.estimatedCostUsd - costUsd) < 0.000001;
}

function simulateUnsuccessfulConsumedAttempt(file: string): AuthorizedTaskBudgetV3 {
  const budget = readBudget(file);
  budget.consumed += 1;
  budget.reserved = 0;
  budget.events.push({
    at: new Date().toISOString(),
    kind: "consumed",
    reservationId: "fixture-unsuccessful-consume",
    detail: "cost=0",
  });
  fs.writeFileSync(file, `${JSON.stringify(budget, null, 2)}\n`);
  return budget;
}

async function main() {
  console.log("\n=== Additional generation authorisation (fixtures, no live write) ===\n");

  const liveBefore = fs.readFileSync(LIVE_BUDGET, "utf8");
  const liveBudget = JSON.parse(liveBefore) as AuthorizedTaskBudgetV3;
  record(
    "live-budget-preserved-before-fixtures",
    liveBudget.consumed === LIVE_CONSUMED &&
      liveBudget.maxProviderCalls === LIVE_MAX_CALLS &&
      Math.abs(liveBudget.estimatedCostUsd - LIVE_COST_USD) < 0.000001 &&
      additionalEvents(liveBudget) === LIVE_ADDITIONAL_EVENTS,
    `consumed=${liveBudget.consumed}/${liveBudget.maxProviderCalls} cost=${liveBudget.estimatedCostUsd} additional=${additionalEvents(liveBudget)}`,
  );
  record(
    "generate-has-no-automatic-retry",
    ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS === 1 && ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3 === 1,
    `maxAttempts=${ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS} callsPerConfirmation=${ADDITIONAL_GENERATION_ATTEMPT_CALLS_PER_CONFIRMATION_V3}`,
  );

  const noConfirmRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-noconfirm-"));
  const noConfirmFile = copyLiveBudget(noConfirmRoot);
  const noConfirm = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: false,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: noConfirmRoot,
  });
  const noConfirmBudget = readBudget(noConfirmFile);
  record(
    "authorise-requires-explicit-confirm",
    noConfirm.ok === false &&
      noConfirm.status === 403 &&
      noConfirmBudget.maxProviderCalls === LIVE_MAX_CALLS &&
      spendMatches(noConfirmBudget) &&
      additionalEvents(noConfirmBudget) === LIVE_ADDITIONAL_EVENTS,
    noConfirm.ok ? "unexpected ok" : `${noConfirm.status} calls=${noConfirmBudget.maxProviderCalls}`,
  );

  const successRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-success-"));
  const successFile = copyLiveBudget(successRoot);
  const first = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: successRoot,
  });
  const afterFirst = first.ok ? first.budget : readBudget(successFile);
  record(
    "authorise-adds-one-call-and-preserves-spend",
    first.ok === true &&
      first.duplicate === false &&
      afterFirst.maxProviderCalls === LIVE_MAX_CALLS + 1 &&
      spendMatches(afterFirst) &&
      remainingAuthorizedProviderCallsV3(afterFirst) === 1 &&
      additionalEvents(afterFirst) === LIVE_ADDITIONAL_EVENTS + 1 &&
      Math.abs(first.ok ? first.additionalAttemptMaxCostUsd - (2 - LIVE_COST_USD) : 0) < 0.000001,
    first.ok
      ? `calls=${afterFirst.maxProviderCalls} remaining=${remainingAuthorizedProviderCallsV3(afterFirst)} maxCost=${first.additionalAttemptMaxCostUsd}`
      : first.error,
  );

  const duplicate = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: successRoot,
  });
  const afterDuplicate = loadAuthorizedTaskBudgetV3(successFile);
  record(
    "duplicate-submission-does-not-add-allowance",
    duplicate.ok === true &&
      duplicate.duplicate === true &&
      Boolean(afterDuplicate) &&
      afterDuplicate?.maxProviderCalls === LIVE_MAX_CALLS + 1 &&
      additionalEvents(afterDuplicate as AuthorizedTaskBudgetV3) === LIVE_ADDITIONAL_EVENTS + 1 &&
      spendMatches(afterDuplicate as AuthorizedTaskBudgetV3),
    duplicate.ok
      ? `duplicate=${duplicate.duplicate} calls=${afterDuplicate?.maxProviderCalls}`
      : duplicate.error,
  );

  const reload = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: successRoot,
  });
  record(
    "reload-does-not-grant-duplicate-allowance",
    reload.ok === true &&
      reload.duplicate === true &&
      readBudget(successFile).maxProviderCalls === LIVE_MAX_CALLS + 1,
    reload.ok ? `duplicate=${reload.duplicate}` : reload.error,
  );

  const afterUnsuccessful = simulateUnsuccessfulConsumedAttempt(successFile);
  record(
    "fixture-unsuccessful-consume-exhausts-that-confirmation",
    afterUnsuccessful.consumed === LIVE_CONSUMED + 1 &&
      remainingAuthorizedProviderCallsV3(afterUnsuccessful) === 0 &&
      spendMatches(afterUnsuccessful, LIVE_CONSUMED + 1, LIVE_COST_USD),
    `consumed=${afterUnsuccessful.consumed}/${afterUnsuccessful.maxProviderCalls} remaining=${remainingAuthorizedProviderCallsV3(afterUnsuccessful)}`,
  );

  const second = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: successRoot,
  });
  const afterSecond = second.ok ? second.budget : readBudget(successFile);
  record(
    "successive-explicit-authorise-after-unsuccessful",
    second.ok === true &&
      second.duplicate === false &&
      afterSecond.maxProviderCalls === LIVE_MAX_CALLS + 2 &&
      remainingAuthorizedProviderCallsV3(afterSecond) === 1 &&
      additionalEvents(afterSecond) === LIVE_ADDITIONAL_EVENTS + 2 &&
      spendMatches(afterSecond, LIVE_CONSUMED + 1, LIVE_COST_USD),
    second.ok
      ? `calls=${afterSecond.maxProviderCalls} remaining=${remainingAuthorizedProviderCallsV3(afterSecond)} additional=${additionalEvents(afterSecond)}`
      : second.error,
  );

  const secondDuplicate = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: successRoot,
  });
  record(
    "duplicate-of-second-confirmation-does-not-add-allowance",
    secondDuplicate.ok === true &&
      secondDuplicate.duplicate === true &&
      readBudget(successFile).maxProviderCalls === LIVE_MAX_CALLS + 2 &&
      additionalEvents(readBudget(successFile)) === LIVE_ADDITIONAL_EVENTS + 2,
    secondDuplicate.ok
      ? `duplicate=${secondDuplicate.duplicate} calls=${readBudget(successFile).maxProviderCalls}`
      : secondDuplicate.error,
  );

  const remainingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-remaining-"));
  const remainingFile = copyLiveBudget(remainingRoot);
  const remainingBudget = readBudget(remainingFile);
  remainingBudget.consumed = 1;
  remainingBudget.maxProviderCalls = 2;
  remainingBudget.events = remainingBudget.events.filter((row) => row.kind !== ADDITIONAL_GENERATION_ATTEMPT_EVENT);
  fs.writeFileSync(remainingFile, `${JSON.stringify(remainingBudget, null, 2)}\n`);
  const notExhausted = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: remainingRoot,
  });
  record(
    "authorise-rejected-while-calls-remain",
    notExhausted.ok === false &&
      notExhausted.status === 409 &&
      readBudget(remainingFile).maxProviderCalls === 2,
    notExhausted.ok ? "unexpected ok" : `${notExhausted.status} ${notExhausted.error}`,
  );

  const capRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-cap-"));
  const capFile = copyLiveBudget(capRoot);
  const capBudget = readBudget(capFile);
  capBudget.estimatedCostUsd = capBudget.maxCostUsd;
  fs.writeFileSync(capFile, `${JSON.stringify(capBudget, null, 2)}\n`);
  const capExhausted = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: capRoot,
  });
  const afterCap = readBudget(capFile);
  record(
    "authorise-rejected-when-dollar-cap-exhausted",
    capExhausted.ok === false &&
      capExhausted.status === 409 &&
      /cost cap is exhausted/i.test(capExhausted.error) &&
      afterCap.maxProviderCalls === LIVE_MAX_CALLS &&
      afterCap.consumed === LIVE_CONSUMED &&
      additionalEvents(afterCap) === LIVE_ADDITIONAL_EVENTS,
    capExhausted.ok ? "unexpected ok" : `${capExhausted.status} ${capExhausted.error}`,
  );

  const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-missing-"));
  fs.mkdirSync(missingRoot, { recursive: true });
  const missing = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-user",
    authenticatedSlug: BROOK,
    budgetDir: missingRoot,
  });
  record(
    "authorise-rejected-without-budget",
    missing.ok === false && missing.status === 409,
    missing.ok ? "unexpected ok" : `${missing.status} ${missing.error}`,
  );

  const crossAuthRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-cross-auth-"));
  const crossAuthFile = copyLiveBudget(crossAuthRoot);
  const crossAuth = authoriseOneAdditionalGenerationAttemptV3({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: AREA,
    confirmAuthorise: true,
    authorisedBy: "fixture-yorkshire",
    authenticatedSlug: YORKSHIRE,
    budgetDir: crossAuthRoot,
  });
  record(
    "cross-tenant-authenticated-slug-rejected",
    crossAuth.ok === false &&
      crossAuth.status === 403 &&
      readBudget(crossAuthFile).maxProviderCalls === LIVE_MAX_CALLS &&
      spendMatches(readBudget(crossAuthFile)) &&
      additionalEvents(readBudget(crossAuthFile)) === LIVE_ADDITIONAL_EVENTS,
    crossAuth.ok ? "unexpected ok" : `${crossAuth.status} ${crossAuth.error}`,
  );

  const crossArea = authoriseOneAdditionalGenerationAttemptV3({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaSlug: "wombwell",
    confirmAuthorise: true,
    authorisedBy: "fixture-yorkshire",
    authenticatedSlug: YORKSHIRE,
    budgetDir: fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-cross-area-")),
  });
  record(
    "cross-tenant-non-candidate-rejected",
    crossArea.ok === false && crossArea.status === 403,
    crossArea.ok ? "unexpected ok" : `${crossArea.status} ${crossArea.error}`,
  );

  const liveAfter = fs.readFileSync(LIVE_BUDGET, "utf8");
  const liveAfterBudget = JSON.parse(liveAfter) as AuthorizedTaskBudgetV3;
  record(
    "fixture-authorise-did-not-rewrite-live-budget",
    liveAfter === liveBefore &&
      liveAfterBudget.maxProviderCalls === LIVE_MAX_CALLS &&
      spendMatches(liveAfterBudget) &&
      additionalEvents(liveAfterBudget) === LIVE_ADDITIONAL_EVENTS,
    `consumed=${liveAfterBudget.consumed}/${liveAfterBudget.maxProviderCalls} cost=${liveAfterBudget.estimatedCostUsd} additional=${additionalEvents(liveAfterBudget)}`,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

function additionalEvents(budget: AuthorizedTaskBudgetV3): number {
  return (budget.events || []).filter((row) => row.kind === ADDITIONAL_GENERATION_ATTEMPT_EVENT).length;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
