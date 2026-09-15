#!/usr/bin/env npx tsx
/**
 * Chellaston generation failure: block unsupported local-context claims in the
 * reusable Pharmacy First writer and prove the existing pre-save validator
 * still rejects the saved response. Fixture only: no generation, no Resume.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
  PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3,
  PHARMACY_FIRST_LOCAL_CONTEXT_WRITER_RULE_V3,
  buildAiLocalNarrativeUserPromptV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { groundAiLocalCopyClaimsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import {
  buildPharmacyAiLocalCopyInputV3,
  validateAiLocalCopyPilotV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import type { EditorialEvidencePackV3, EditorialFactV3 } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import {
  buildUkLocalPageWriterContractPayload,
  premisesAddressLooksUnverified,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import {
  hasSavedValidLocalPageCandidate,
  loadRemainingLocalPagesCampaignRun,
  resumeRemainingLocalPagesCampaign,
} from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SERVICE = "pharmacy-first";
const AREA = "chellaston";
const LIVE_RUN_ID = "e23b2020-b520-453c-a7a5-45d301316229";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const REJECTED =
  "With established local healthcare and community networks, Chellaston residents have access to a range of support.";
const ATTEMPT =
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston/2026-09-05T19-41-32-991Z-attempt-1.json";
const LIVE_RUN =
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json";
const GROUNDING = "src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
const CANDIDATES = {
  allestree: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  mickleover: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  littleover: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/littleover.json",
} as const;
const CHELLASTON_CANDIDATE =
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston.json";

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

function sha256Rel(rel: string): string {
  return createHash("sha256").update(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel))).digest("hex");
}

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8")) as T;
}

function acceptedFacts(editorial: EditorialEvidencePackV3): EditorialFactV3[] {
  return editorial.facts.filter((fact) => fact.validationStatus === "accepted");
}

async function main() {
  console.log("\n=== Chellaston unsupported local-context writer (fixtures, no generation) ===\n");

  const attemptBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT), "utf8");
  const runBefore = sha256Rel(LIVE_RUN);
  const groundingBefore = sha256Rel(GROUNDING);
  const candidateBefore = Object.fromEntries(
    Object.entries(CANDIDATES).map(([area, rel]) => [area, sha256Rel(rel)]),
  ) as Record<keyof typeof CANDIDATES, string>;

  const attempt = JSON.parse(attemptBefore) as {
    areaSlug: string;
    attemptNumber: number;
    candidateRecordWritten: boolean;
    rawResponse: string;
    parsedCopy: AiLocalCopyV3;
    validationResult: { ok: boolean; failures: string[] };
  };
  record(
    "saved-chellaston-response-preserved-unwritten",
    attempt.areaSlug === AREA &&
      attempt.attemptNumber === 1 &&
      attempt.candidateRecordWritten === false &&
      attempt.parsedCopy.localContextParagraphs[0]?.includes(REJECTED) &&
      !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CHELLASTON_CANDIDATE)),
    `written=${attempt.candidateRecordWritten} candidateFile=${fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CHELLASTON_CANDIDATE))}`,
  );

  const editorial = loadEditorialEvidencePack(BROOK_DERBY_DEMO_SLUG, SERVICE, AREA) as EditorialEvidencePackV3 | null;
  record(
    "chellaston-editorial-pack-ready-unchanged",
    editorial?.sufficiency.status === "READY" &&
      acceptedFacts(editorial).some((fact) => fact.normalizedStatement.includes("Chellaston Medical Centre")),
    editorial?.sufficiency.status || "missing",
  );
  if (!editorial) {
    process.exitCode = 1;
    return;
  }

  const input = buildPharmacyAiLocalCopyInputV3({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    areaName: "Chellaston",
    areaSlug: AREA,
    editorial,
  });
  const facts = acceptedFacts(editorial);
  const parsedRejected = parseAiLocalCopyV3(attempt.rawResponse);
  record("rejected-response-still-parses", parsedRejected.ok === true, parsedRejected.ok ? "parsed" : parsedRejected.failures.join(" | "));
  if (!parsedRejected.ok) {
    process.exitCode = 1;
    return;
  }

  const replayGround = groundAiLocalCopyClaimsV3(parsedRejected.copy, input, facts);
  const replayValidate = validateAiLocalCopyPilotV3(parsedRejected.copy, input, facts);
  const ungrounded = [...replayGround.failures, ...replayValidate.failures].filter(
    (row) => /ungrounded-clause/.test(row) && row.includes(REJECTED),
  );
  record(
    "unsupported-sentence-is-prohibited",
    replayValidate.ok === false &&
      ungrounded.length >= 1 &&
      attempt.validationResult.failures.some((row) => /ungrounded-clause/.test(row) && row.includes(REJECTED)),
    ungrounded[0] || replayValidate.failures[0] || "none",
  );

  const omittedSource = {
    ...parsedRejected.copy,
    localContextParagraphs: [] as string[],
  };
  const omittedParsed = parseAiLocalCopyV3(omittedSource);
  const omittedValidate = omittedParsed.ok
    ? validateAiLocalCopyPilotV3(omittedParsed.copy, input, facts)
    : { ok: false, failures: omittedParsed.failures, reviews: [] as string[] };
  record(
    "unsupported-local-context-content-is-omitted",
    omittedParsed.ok === true &&
      omittedParsed.copy.localContextParagraphs.length === 0 &&
      !omittedValidate.failures.some((row) => row.includes(REJECTED) || /ungrounded-clause/.test(row)),
    omittedParsed.ok
      ? `paragraphs=${omittedParsed.copy.localContextParagraphs.length} failures=${omittedValidate.failures.length}`
      : omittedParsed.failures.join(" | "),
  );

  const gpFact = facts.find((fact) => /Chellaston Medical Centre/.test(fact.normalizedStatement));
  const boardFact = facts.find((fact) => /Neighbourhood Board/.test(fact.normalizedStatement));
  const supportedCopy: AiLocalCopyV3 = {
    area: "Chellaston",
    heroHeading: "Pharmacy First in Chellaston",
    heroIntroduction: `${ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3.replace(/\.$/, "")} for people in Chellaston.`,
    localIntroduction: boardFact?.normalizedStatement || "",
    localContextHeading: "",
    localContextParagraphs: gpFact ? [gpFact.normalizedStatement] : [ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3],
    relationshipToPharmacy:
      "Consultations take place at Brook Pharmacy Demo Derby in Derby. Brook Pharmacy Demo Derby is approximately 5.8 km in a straight line from Chellaston.",
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: [boardFact?.factId, gpFact?.factId, "chellaston:pharmacy-relationship:distance"].filter(
      (id): id is string => Boolean(id),
    ),
  };
  const supportedValidate = validateAiLocalCopyPilotV3(supportedCopy, input, facts);
  record(
    "supported-evidence-backed-local-facts-remain-permitted",
    Boolean(gpFact) &&
      Boolean(boardFact) &&
      !supportedValidate.failures.some((row) => /ungrounded-clause/.test(row) && row.includes("Chellaston Medical Centre")) &&
      !supportedValidate.failures.some((row) => /ungrounded-clause/.test(row) && /Neighbourhood Board/.test(row)) &&
      !supportedValidate.failures.some((row) => row.includes(REJECTED)),
    supportedValidate.failures.filter((row) => /ungrounded-clause/.test(row)).join(" | ") || "no ungrounded-clause on supported facts",
  );

  const livePrompt = buildAiLocalNarrativeUserPromptV3(input);
  const liveUser = JSON.parse(livePrompt) as {
    locality?: { areaName?: string; areaSlug?: string };
    verifiedEditorialFacts?: Array<{ factId: string; statement: string }>;
    fieldNotes?: { localContextParagraphs?: string };
    localClaimBoundary?: string;
    editorialStandard?: { bannedUnsupportedClaims?: string[] };
    writingBrief?: string;
    contentContract?: { roles?: Record<string, string> };
  };
  const yorkshireEditorial = loadEditorialEvidencePack(YORKSHIRE, SERVICE, "wombwell") as EditorialEvidencePackV3 | null;
  const yorkshirePrompt = yorkshireEditorial
    ? buildAiLocalNarrativeUserPromptV3(
        buildPharmacyAiLocalCopyInputV3({
          slug: YORKSHIRE,
          serviceId: SERVICE,
          areaName: "Wombwell",
          areaSlug: "wombwell",
          editorial: yorkshireEditorial,
        }),
      )
    : "";
  record(
    "area-and-tenant-isolation",
    liveUser.locality?.areaSlug === AREA &&
      liveUser.verifiedEditorialFacts?.every((row) => row.factId.startsWith("chellaston:")) === true &&
      !livePrompt.includes("Allestree") &&
      !livePrompt.includes("Mickleover") &&
      !livePrompt.includes("Littleover") &&
      !livePrompt.includes("Park Lane Surgery") &&
      !yorkshirePrompt.includes("Chellaston") &&
      !yorkshirePrompt.includes(LIVE_RUN_ID) &&
      !yorkshirePrompt.includes("brook-pharmacy-demo-derby"),
    `facts=${(liveUser.verifiedEditorialFacts || []).map((row) => row.factId).join(",")}`,
  );

  const writerPayload = buildUkLocalPageWriterContractPayload({
    areaName: "Chellaston",
    addressVerified: !premisesAddressLooksUnverified(input.business.address),
  });
  const role = String((writerPayload.roles as Record<string, string> | undefined)?.["recognisable-local-context"] || "");
  record(
    "reusable-writer-omits-unsupported-local-context",
    livePrompt.includes(PHARMACY_FIRST_LOCAL_CONTEXT_WRITER_RULE_V3) &&
      /omit that claim or section/i.test(liveUser.fieldNotes?.localContextParagraphs || "") &&
      /established networks, community support, healthcare access/i.test(liveUser.localClaimBoundary || "") &&
      (liveUser.editorialStandard?.bannedUnsupportedClaims || []).includes("established local healthcare") &&
      (liveUser.editorialStandard?.bannedUnsupportedClaims || []).includes("community networks") &&
      liveUser.editorialStandard?.bannedUnsupportedClaims?.length === PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3.length &&
      /omit that claim or section/i.test(role) &&
      /validated evidence pack/i.test(role),
    "writer contract requires omission instead of generic local-context filler",
  );

  const groundingSource = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, GROUNDING), "utf8");
  record(
    "validator-remains-unchanged-and-authoritative",
    groundingBefore === sha256Rel(GROUNDING) &&
      /rule: "ungrounded-clause"/.test(groundingSource) &&
      !/chellaston/i.test(groundingSource) &&
      !/established local healthcare and community networks/i.test(groundingSource) &&
      ungrounded[0]?.includes("no supplied fact, canonical field or approved clinical text covers this clause") === true,
    "ungrounded-clause still authoritative; no Chellaston special-case",
  );

  record(
    "existing-successful-candidates-unchanged",
    sha256Rel(CANDIDATES.allestree) === candidateBefore.allestree &&
      sha256Rel(CANDIDATES.mickleover) === candidateBefore.mickleover &&
      sha256Rel(CANDIDATES.littleover) === candidateBefore.littleover &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "mickleover") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "littleover") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, AREA) === false,
    "Allestree, Mickleover and Littleover candidates unchanged; Chellaston has none",
  );

  const liveRun = loadRemainingLocalPagesCampaignRun(BROOK_DERBY_DEMO_SLUG, SERVICE);
  const noConfirm = await resumeRemainingLocalPagesCampaign({
    slug: BROOK_DERBY_DEMO_SLUG,
    serviceId: SERVICE,
    confirmAuthorise: false,
    authenticatedSlug: BROOK_DERBY_DEMO_SLUG,
    runId: LIVE_RUN_ID,
  });
  record(
    "duplicate-reload-safety-remains-intact",
    liveRun?.runId === LIVE_RUN_ID &&
      liveRun?.status === "stopped" &&
      liveRun.failedAreaSlug === AREA &&
      liveRun.failedStage === "generation" &&
      ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS === 1 &&
      noConfirm.ok === false &&
      noConfirm.status === 403 &&
      sha256Rel(LIVE_RUN) === runBefore,
    `run=${liveRun?.runId} status=${liveRun?.status} maxAttempts=${ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS}`,
  );

  const html = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: AREA });
  record(
    "ui-stopped-chellaston-failure-and-ready-evidence",
    html.includes(`data-run-id="${LIVE_RUN_ID}"`) &&
      html.includes('data-run-status="stopped"') &&
      /Stopped at chellaston during generation/i.test(html) &&
      (/Stopped at chellaston during generation/i.test(html) &&
        (/ungrounded-clause/.test(html) || html.includes(REJECTED))) &&
      /Evidence is READY/i.test(html) &&
      html.includes("Resume remaining local pages") &&
      html.includes('id="btnResumeRemainingLocalPages" disabled') &&
      !html.includes('id="confirmResumeRemainingLocalPages" checked') &&
      html.includes("Generate one local-page candidate"),
    "Campaign Builder shows the stopped Chellaston failure and READY evidence",
  );

  record("chellaston-attempt-log-unchanged", fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT), "utf8") === attemptBefore, ATTEMPT);
  record("live-brook-run-still-stopped", sha256Rel(LIVE_RUN) === runBefore, LIVE_RUN);
  record("grounding-validator-file-unchanged", sha256Rel(GROUNDING) === groundingBefore, GROUNDING);

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
