#!/usr/bin/env npx tsx
/**
 * Allestree first-generation failure: localContextParagraphs[0] ungrounded-clause.
 * Replays the saved response against the locked clinical reference and validator.
 * Does not generate copy or make paid calls.
 */
import fs from "node:fs";
import path from "node:path";

import { buildPharmacyAiLocalCopyInputV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  buildAiLocalNarrativeUserPromptV3,
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { groundAiLocalCopyClaimsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import { validateAiLocalCopyPilotV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { preflightOneLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "brook-pharmacy-demo-derby";
const SERVICE = "pharmacy-first";
const AREA = "allestree";
const ATTEMPT_1 =
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree/2026-09-03T12-50-51-028Z-attempt-1.json";
const ATTEMPT_2 =
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree/2026-09-03T12-50-56-358Z-attempt-2.json";
const BUDGET =
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:allestree.json";
const CANDIDATE = "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json";
const DELAY_CLAUSE = "helping Allestree residents access the care they need without unnecessary delay.";
const ALLOWED_CLINICAL = "Pharmacy First can help with eligible common conditions.";
const ANOTHER_OPTION = "Pharmacy First can help with eligible common conditions, offering another option for advice and treatment.";
const ANOTHER_NHS_OPTION =
  "Pharmacy First can help with eligible common conditions, offering another NHS option for assessment and advice.";

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

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8")) as T;
}

function main() {
  console.log("\n=== Allestree first-generation ungrounded-clause (no generation, no paid calls) ===\n");

  const attempt1 = readJson<{
    attemptNumber: number;
    rawResponse: string;
    parsedCopy: { localContextParagraphs: string[] };
    validationResult: { ok: boolean; failures: string[] };
    candidateRecordWritten: boolean;
    sanitizedRequest: { messages: Array<{ role: string; content: string }> };
  }>(ATTEMPT_1);
  const attempt1HashBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_1), "utf8");
  const attempt2HashBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_2), "utf8");
  const budgetBefore = readJson<{ consumed: number; estimatedCostUsd: number; maxProviderCalls: number }>(BUDGET);

  const userMsg = JSON.parse(attempt1.sanitizedRequest.messages.find((row) => row.role === "user")?.content || "{}") as {
    offer?: { lockedClinicalFacts?: typeof PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1; clinicalBoundary?: string };
  };
  const sentLocked = userMsg.offer?.lockedClinicalFacts;
  record(
    "saved-attempt-1-preserved",
    attempt1.attemptNumber === 1 &&
      attempt1.candidateRecordWritten === false &&
      attempt1.parsedCopy.localContextParagraphs[0]?.includes(DELAY_CLAUSE),
    `attempt=${attempt1.attemptNumber} candidateWritten=${attempt1.candidateRecordWritten}`,
  );
  record(
    "actual-clinical-reference-is-locked-facts",
    JSON.stringify(sentLocked) === JSON.stringify(PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1) &&
      /You may say Pharmacy First can help with eligible common conditions/.test(userMsg.offer?.clinicalBoundary || "") &&
      !/without unnecessary delay/i.test(JSON.stringify(sentLocked)) &&
      !/another (NHS )?option/i.test(JSON.stringify(sentLocked)),
    `suitability=${sentLocked?.suitability?.slice(0, 80)}`,
  );
  record(
    "original-validator-rejected-delay-clause-as-ungrounded",
    attempt1.validationResult.ok === false &&
      attempt1.validationResult.failures.some(
        (row) =>
          /localContextParagraphs\[0]/.test(row) &&
          /ungrounded-clause/.test(row) &&
          row.includes(DELAY_CLAUSE),
      ),
    attempt1.validationResult.failures.filter((row) => /ungrounded-clause/.test(row)).join(" | ") || "none",
  );
  record(
    "delay-clause-is-unsupported-not-in-locked-reference",
    !/delay|waiting|another option|access the care they need/i.test(
      `${sentLocked?.suitability} ${sentLocked?.process} ${sentLocked?.safety}`,
    ),
    "locked process/suitability/safety do not support delay or access-the-care claims",
  );

  const editorial = loadEditorialEvidencePack(SLUG, SERVICE, AREA);
  record("editorial-pack-preserved-ready", editorial?.sufficiency.status === "READY", editorial?.sufficiency.status || "missing");
  if (!editorial) {
    process.exitCode = 1;
    return;
  }
  const input = buildPharmacyAiLocalCopyInputV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Allestree",
    areaSlug: AREA,
    editorial,
  });
  const parsed = parseAiLocalCopyV3(attempt1.rawResponse);
  record("saved-response-parses-unchanged", parsed.ok === true, parsed.ok ? "parsed" : parsed.failures.join(" | "));
  if (!parsed.ok) {
    process.exitCode = 1;
    return;
  }
  record(
    "replay-does-not-edit-saved-copy",
    parsed.copy.localContextParagraphs[0] === attempt1.parsedCopy.localContextParagraphs[0],
    parsed.copy.localContextParagraphs[0].slice(0, 120),
  );

  const grounded = groundAiLocalCopyClaimsV3(parsed.copy, input, editorial.facts);
  const validated = validateAiLocalCopyPilotV3(parsed.copy, input, editorial.facts);
  const delayFails = [...grounded.failures, ...validated.failures].filter(
    (row) => /localContextParagraphs\[0]/.test(row) && /without unnecessary delay/.test(row),
  );
  record(
    "replay-delay-clause-is-clinical-broadening-not-a-pass",
    validated.ok === false &&
      delayFails.some((row) => /clinical-broadening/.test(row)) &&
      !delayFails.some((row) => /ungrounded-clause/.test(row)) &&
      !grounded.claims.some(
        (claim) => /without unnecessary delay/.test(claim.exactSentence) && claim.validationResult === "pass",
      ),
    delayFails.join(" | ") || "no delay finding",
  );
  record(
    "saved-first-response-cannot-pass-unchanged",
    validated.ok === false,
    `ok=${validated.ok} failures=${validated.failures.length}`,
  );

  const allowedCopy = {
    ...parsed.copy,
    heroIntroduction: ALLOWED_CLINICAL,
    localIntroduction: "Allestree is a neighbourhood ward in Derby.",
    localContextParagraphs: [ALLOWED_CLINICAL],
    relationshipToPharmacy: "Consultations take place at Brook Pharmacy Demo Derby in Derby.",
  };
  const allowedGrounded = groundAiLocalCopyClaimsV3(allowedCopy, input, editorial.facts);
  const allowedClaim = allowedGrounded.claims.find((claim) => claim.exactSentence === ALLOWED_CLINICAL);
  record(
    "allowed-locked-phrase-still-grounds",
    allowedClaim?.validationResult === "pass" ||
      !allowedGrounded.failures.some((row) => row.includes(ALLOWED_CLINICAL) && /ungrounded-clause|clinical-broadening/.test(row)),
    allowedClaim ? `${allowedClaim.validationResult} ${allowedClaim.supportingCanonicalFieldOrEntity}` : allowedGrounded.failures.join(" | "),
  );

  const wombwellFacts = editorial.facts;
  const anotherOptionCopy = { ...allowedCopy, localContextParagraphs: [ANOTHER_OPTION] };
  const anotherNhsCopy = { ...allowedCopy, localContextParagraphs: [ANOTHER_NHS_OPTION] };
  const anotherOptionOut = groundAiLocalCopyClaimsV3(anotherOptionCopy, input, wombwellFacts);
  const anotherNhsOut = groundAiLocalCopyClaimsV3(anotherNhsCopy, input, wombwellFacts);
  record(
    "another-option-broadening-still-fails",
    anotherOptionOut.failures.some((row) => /clinical-broadening/.test(row) && /another option/.test(row)),
    anotherOptionOut.failures.filter((row) => /clinical-broadening/.test(row)).join(" | ") || "none",
  );
  record(
    "another-nhs-option-uses-same-broadening-rule",
    anotherNhsOut.failures.some((row) => /clinical-broadening/.test(row) && /another NHS option/.test(row)) &&
      !anotherNhsOut.failures.some((row) => /ungrounded-clause/.test(row) && /another NHS option/.test(row)),
    anotherNhsOut.failures.filter((row) => /another NHS option/.test(row)).join(" | ") || "none",
  );

  const prompt = buildAiLocalNarrativeUserPromptV3(input);
  record(
    "writer-clinical-boundary-matches-locked-reference",
    /Waiting, delay, and alternative-to-GP claims are not in the locked clinical facts/.test(prompt) &&
      /You may say Pharmacy First can help with eligible common conditions/.test(prompt) &&
      JSON.stringify(input.offer.lockedClinicalFacts) === JSON.stringify(PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1),
    "v3 writer now receives the same delay/alternative-to-GP boundary the validator enforces",
  );

  const attempt1After = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_1), "utf8");
  const attempt2After = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_2), "utf8");
  const budgetAfter = readJson<{ consumed: number; estimatedCostUsd: number; maxProviderCalls: number }>(BUDGET);
  record(
    "attempts-costs-and-candidate-untouched",
    attempt1After === attempt1HashBefore &&
      attempt2After === attempt2HashBefore &&
      !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE)) &&
      budgetAfter.consumed === 2 &&
      budgetAfter.maxProviderCalls === 2 &&
      Math.abs(budgetAfter.estimatedCostUsd - 0.029486) < 0.000001 &&
      budgetAfter.consumed === budgetBefore.consumed,
    `consumed=${budgetAfter.consumed}/${budgetAfter.maxProviderCalls} cost=${budgetAfter.estimatedCostUsd} candidate=${fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE))}`,
  );

  const preflight = preflightOneLocalPageCandidate(SLUG, SERVICE, "Allestree");
  const areasHtml = renderCampaignBuilderPage(SLUG, "areas");
  const review = buildReviewCentreView(SLUG, SERVICE);
  record(
    "served-ui-has-no-candidate-and-does-not-hide-generate",
    preflight.existingCandidate === false &&
      review?.hasLocalPageCandidate === false &&
      /Generate one local-page candidate/.test(areasHtml) &&
      /id="btnGenerateOneLocalPage"/.test(areasHtml),
    `existingCandidate=${preflight.existingCandidate} candidate=${review?.hasLocalPageCandidate} canGenerate=${preflight.canGenerate}`,
  );
  record(
    "durable-generation-budget-already-consumed",
    budgetAfter.consumed >= budgetAfter.maxProviderCalls,
    "A further Generate click would hit the existing 2-call durable limit until more calls are authorised",
  );

  const failed = checks.filter((row) => !row.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  if (failed) process.exitCode = 1;
}

main();
