#!/usr/bin/env npx tsx
/**
 * Latest Allestree UI attempt: improvised geographic eligibility in heroIntroduction.
 * Replays the saved prompt, locked clinical reference and validator.
 * Does not generate copy, collect evidence, authorise spend or reset counters.
 */
import fs from "node:fs";
import path from "node:path";

import { buildPharmacyAiLocalCopyInputV3, validateAiLocalCopyPilotV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
  AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3,
  AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3,
  buildAiLocalNarrativeUserPromptV3,
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
  type BusinessLocalityCopyInputV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "brook-pharmacy-demo-derby";
const SERVICE = "pharmacy-first";
const AREA = "allestree";
const LATEST =
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree/2026-09-03T16-22-00-196Z-attempt-1.json";
const FIRST =
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree/2026-09-03T12-50-51-028Z-attempt-1.json";
const SECOND =
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree/2026-09-03T12-50-56-358Z-attempt-2.json";
const BUDGET =
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:allestree.json";
const CANDIDATE = "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json";
const IMPROVISED = "available regardless of where you live";
const LOCKED_GEO = "not on the area the patient travels from";

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
  console.log("\n=== Latest Allestree attempt: clinical eligibility paraphrase (no generation) ===\n");

  const latestBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, LATEST), "utf8");
  const firstBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, FIRST), "utf8");
  const secondBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, SECOND), "utf8");
  const budgetBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, BUDGET), "utf8");

  const attempt = JSON.parse(latestBefore) as {
    attemptNumber: number;
    promptContractId: string;
    promptContractVersion: string;
    candidateRecordWritten: boolean;
    rawResponse: string;
    parsedCopy: { heroIntroduction: string; localContextParagraphs: string[] };
    validationResult: { ok: boolean; failures: string[] };
    sanitizedRequest: { messages: Array<{ role: string; content: string }> };
  };
  const userMsg = JSON.parse(attempt.sanitizedRequest.messages.find((row) => row.role === "user")?.content || "{}") as {
    promptContractId?: string;
    promptContractVersion?: string;
    writingBrief?: string;
    localClaimBoundary?: string;
    fieldNotes?: { heroIntroduction?: string };
    editorialStandard?: { bannedUnsupportedClaims?: string[] };
    canonicalPharmacyIdentity?: { name?: string };
    offer?: {
      lockedClinicalFacts?: typeof PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1;
      clinicalBoundary?: string;
      allowedClinicalSentenceInAiFields?: string;
    };
  };
  const systemMsg = attempt.sanitizedRequest.messages.find((row) => row.role === "system")?.content || "";
  const userBlob = JSON.stringify(userMsg);
  const sentLocked = userMsg.offer?.lockedClinicalFacts;

  record(
    "latest-attempt-used-corrected-deployed-v3-contract",
    attempt.promptContractId === AI_LOCAL_NARRATIVE_PROMPT_CONTRACT_ID_V3 &&
      attempt.promptContractVersion === AI_LOCAL_NARRATIVE_PROMPT_VERSION_V3 &&
      userMsg.promptContractId === "pharmacy-ai-local-narrative-prompt-v3" &&
      userMsg.promptContractVersion === "v3" &&
      /using the locked clinical allowance/.test(userMsg.writingBrief || "") &&
      Boolean(userMsg.localClaimBoundary) &&
      (userMsg.editorialStandard?.bannedUnsupportedClaims || []).includes("community resources") &&
      userMsg.canonicalPharmacyIdentity?.name === "Brook Pharmacy Demo Derby" &&
      /You may say Pharmacy First can help with eligible common conditions/.test(userMsg.offer?.clinicalBoundary || "") &&
      JSON.stringify(sentLocked) === JSON.stringify(PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1),
    `contract=${attempt.promptContractId}@${attempt.promptContractVersion} pharmacy=${userMsg.canonicalPharmacyIdentity?.name}`,
  );

  record(
    "improvised-phrase-is-not-in-prompt-template-or-examples",
    !new RegExp(IMPROVISED, "i").test(systemMsg) &&
      !new RegExp(IMPROVISED, "i").test(userBlob) &&
      !/regardless of where you live/i.test(systemMsg) &&
      !/regardless of where you live/i.test(userBlob),
    "exact hero wording is absent from the saved system and user prompt",
  );
  record(
    "phrase-is-model-paraphrase-of-locked-suitability",
    /not on the area the patient travels from/.test(sentLocked?.suitability || "") &&
      sentLocked?.suitability === PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.suitability &&
      attempt.parsedCopy.heroIntroduction.includes(IMPROVISED) &&
      /suitability confirmed by the pharmacist according to NHS criteria/i.test(attempt.parsedCopy.heroIntroduction),
    `locked=${sentLocked?.suitability}`,
  );

  const failures = attempt.validationResult.failures || [];
  record(
    "all-hard-failures-reviewed-together",
    attempt.validationResult.ok === false &&
      failures.some((row) => /heroIntroduction/.test(row) && /ungrounded-clause/.test(row) && row.includes(IMPROVISED)) &&
      failures.some((row) => /localContextParagraphs/.test(row) && /empty-local-claim/.test(row) && /community resources/.test(row)) &&
      failures.some((row) => /localContextParagraphs/.test(row) && /identity wording/.test(row)) &&
      failures.some((row) => /residents can access/.test(row)) &&
      failures.some((row) => /pharmacist determining suitability based on symptoms and NHS pathway criteria/.test(row)),
    failures.join(" || "),
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
  }) as BusinessLocalityCopyInputV3;
  const facts = editorial.facts.filter((fact) => fact.validationStatus === "accepted");
  const parsed = parseAiLocalCopyV3(attempt.rawResponse);
  record("saved-response-still-parses", parsed.ok === true, parsed.ok ? "parsed" : parsed.failures.join(" | "));
  if (!parsed.ok) {
    process.exitCode = 1;
    return;
  }
  const replay = validateAiLocalCopyPilotV3(parsed.copy, input, facts);
  record(
    "replay-still-rejects-without-whitelisting-the-sentence",
    replay.ok === false &&
      replay.failures.some((row) => /ungrounded-clause/.test(row) && row.includes(IMPROVISED)) &&
      !replay.failures.every((row) => /ungrounded-clause/.test(row) && row.includes(IMPROVISED) && replay.ok),
    replay.failures.filter((row) => /heroIntroduction|localContextParagraphs/.test(row)).join(" | ") || "none",
  );
  record(
    "saved-output-is-not-usable-without-alteration",
    attempt.candidateRecordWritten === false &&
      !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE)) &&
      replay.ok === false,
    `candidateWritten=${attempt.candidateRecordWritten} candidateFile=${fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE))}`,
  );

  const livePrompt = buildAiLocalNarrativeUserPromptV3(input);
  const liveOffer = JSON.parse(livePrompt) as {
    offer: { lockedClinicalFacts?: unknown; clinicalContentOwner?: string; allowedClinicalSentenceInAiFields?: string };
    editorialStandard?: { bannedUnsupportedClaims?: string[] };
    localClaimBoundary?: string;
    fieldNotes?: { localContextParagraphs?: string; localIntroduction?: string };
    writingBrief?: string;
  };
  const banned = liveOffer.editorialStandard?.bannedUnsupportedClaims || [];
  record(
    "assembled-prompt-has-no-conflicting-clinical-instructions",
    livePrompt.includes(ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3) &&
      liveOffer.offer.clinicalContentOwner === "renderer" &&
      liveOffer.offer.allowedClinicalSentenceInAiFields === ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3 &&
      liveOffer.offer.lockedClinicalFacts == null &&
      !livePrompt.includes(LOCKED_GEO) &&
      !/Eligibility depends on symptoms and NHS pathway criteria/.test(livePrompt) &&
      !/"conditionSet"/.test(livePrompt) &&
      /Write local content only/.test(livePrompt) &&
      /Clinical eligibility stays with the renderer/.test(livePrompt) &&
      !/Do not write that the service is available regardless of where the reader lives/.test(livePrompt),
    "eligibility wording is omitted from the writer prompt; AI is instructed to write local content only",
  );
  record(
    "existing-local-instructions-cover-latest-empty-community-failures",
    banned.includes("community resources") &&
      banned.includes("known for") &&
      banned.includes("established local healthcare") &&
      banned.includes("community networks") &&
      /empty community labels/.test(livePrompt) &&
      /Do not invent local character, resident value/.test(livePrompt) &&
      /Keep named organisations/.test(liveOffer.localClaimBoundary || "") &&
      /Keep the named organisations/.test(liveOffer.fieldNotes?.localIntroduction || "") &&
      /no invented character, resident value or empty community labels/.test(liveOffer.fieldNotes?.localContextParagraphs || "") &&
      /Do not invent patient habits/.test(liveOffer.fieldNotes?.localContextParagraphs || "") &&
      banned.length === 16 &&
      !banned.includes("regardless of where you live") &&
      !banned.includes("local identity"),
    `banned=${banned.join("|")}`,
  );

  record(
    "attempts-and-costs-untouched",
    fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, LATEST), "utf8") === latestBefore &&
      fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, FIRST), "utf8") === firstBefore &&
      fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, SECOND), "utf8") === secondBefore &&
      fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, BUDGET), "utf8") === budgetBefore,
    "saved attempts and generation budget unchanged",
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
