#!/usr/bin/env npx tsx
/**
 * User-authorised one additional generation attempt.
 * Fixture budget copies only. Does not authorise the live Allestree file,
 * generate copy, collect evidence, or make paid calls.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
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

function spendUnchanged(budget: AuthorizedTaskBudgetV3): boolean {
  return budget.consumed === 2 && Math.abs(budget.estimatedCostUsd - 0.029486) < 0.000001;
}

async function main() {
  console.log("\n=== Additional generation authorisation (fixtures, no live write) ===\n");

  const liveBefore = fs.readFileSync(LIVE_BUDGET, "utf8");
  const liveBudget = JSON.parse(liveBefore) as AuthorizedTaskBudgetV3;
  record(
    "live-budget-preserved-before-fixtures",
    liveBudget.consumed === 2 &&
      liveBudget.maxProviderCalls === 2 &&
      Math.abs(liveBudget.estimatedCostUsd - 0.029486) < 0.000001 &&
      additionalEvents(liveBudget) === 0,
    `consumed=${liveBudget.consumed}/${liveBudget.maxProviderCalls} cost=${liveBudget.estimatedCostUsd}`,
  );
  record(
    "generate-has-no-automatic-retry",
    ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS === 1,
    `maxAttempts=${ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS}`,
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
      noConfirmBudget.maxProviderCalls === 2 &&
      spendUnchanged(noConfirmBudget),
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
      afterFirst.maxProviderCalls === 3 &&
      spendUnchanged(afterFirst) &&
      remainingAuthorizedProviderCallsV3(afterFirst) === 1 &&
      additionalEvents(afterFirst) === 1 &&
      Math.abs(first.ok ? first.additionalAttemptMaxCostUsd - 1.970514 : 0) < 0.000001,
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
      afterDuplicate?.maxProviderCalls === 3 &&
      additionalEvents(afterDuplicate as AuthorizedTaskBudgetV3) === 1 &&
      spendUnchanged(afterDuplicate as AuthorizedTaskBudgetV3),
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
      readBudget(successFile).maxProviderCalls === 3,
    reload.ok ? `duplicate=${reload.duplicate}` : reload.error,
  );

  const remainingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-auth-remaining-"));
  const remainingFile = copyLiveBudget(remainingRoot);
  const remainingBudget = readBudget(remainingFile);
  remainingBudget.consumed = 1;
  remainingBudget.maxProviderCalls = 2;
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
      readBudget(crossAuthFile).maxProviderCalls === 2 &&
      spendUnchanged(readBudget(crossAuthFile)),
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
      liveAfterBudget.maxProviderCalls === 2 &&
      spendUnchanged(liveAfterBudget) &&
      additionalEvents(liveAfterBudget) === 0,
    `consumed=${liveAfterBudget.consumed}/${liveAfterBudget.maxProviderCalls} cost=${liveAfterBudget.estimatedCostUsd}`,
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
