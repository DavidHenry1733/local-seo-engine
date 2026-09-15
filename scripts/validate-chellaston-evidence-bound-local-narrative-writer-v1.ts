#!/usr/bin/env npx tsx
/**
 * Evidence-bound local-narrative writer: every optional local field is
 * omissible, every local factual sentence must cite a supplied fact ID
 * internally, and both saved Chellaston failures stay rejected. Fixture only.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
  PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3,
  PHARMACY_FIRST_LOCAL_NARRATIVE_WRITER_RULE_V3,
  buildAiLocalNarrativeUserPromptV3,
  overlayFromCopy,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { groundAiLocalCopyClaimsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import { assertLocalNarrativeEvidenceBindingsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEvidenceBindingV3.ts";
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
import { ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import { hasSavedValidLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SERVICE = "pharmacy-first";
const AREA = "chellaston";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const REJECTED_NETWORKS =
  "With established local healthcare and community networks, Chellaston residents have access to a range of support.";
const REJECTED_PARENT_TOWN =
  "Chellaston is part of Derby and has its own Neighbourhood Board, which brings together local councillors, residents, and representatives from community organisations and public services.";
const ATTEMPTS = [
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston/2026-09-05T19-41-32-991Z-attempt-1.json",
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston/2026-09-06T05-39-37-542Z-attempt-1.json",
] as const;
const GROUNDING = "src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
const LIVE_RUN =
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json";
const CANDIDATES = {
  allestree: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  mickleover: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  littleover: "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/littleover.json",
} as const;
const CHELLASTON_CANDIDATE =
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston.json";
const LOCAL_FIELDS = [
  "localIntroduction",
  "localContextParagraphs[0]",
  "localAccessIntroduction",
  "localFaqs[0].answer",
  "localCtaBridge",
] as const;

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

function acceptedFacts(editorial: EditorialEvidencePackV3): EditorialFactV3[] {
  return editorial.facts.filter((fact) => fact.validationStatus === "accepted");
}

function baseCopy(overrides: Partial<AiLocalCopyV3> = {}): AiLocalCopyV3 {
  return {
    area: "Chellaston",
    heroHeading: "Pharmacy First in Chellaston",
    heroIntroduction: `${ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3.replace(/\.$/, "")} for people in Chellaston.`,
    localIntroduction: "",
    localContextHeading: "",
    localContextParagraphs: [],
    relationshipToPharmacy:
      "Consultations take place at Brook Pharmacy Demo Derby in Derby. Brook Pharmacy Demo Derby is approximately 5.8 km in a straight line from Chellaston.",
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [
      {
        field: "relationshipToPharmacy",
        sentence: "Brook Pharmacy Demo Derby is approximately 5.8 km in a straight line from Chellaston.",
        editorialFactId: "chellaston:pharmacy-relationship:distance",
      },
    ],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: ["chellaston:pharmacy-relationship:distance"],
    ...overrides,
  };
}

function placeSentence(copy: AiLocalCopyV3, field: (typeof LOCAL_FIELDS)[number], sentence: string): AiLocalCopyV3 {
  const next = { ...copy, localFaqs: [...copy.localFaqs], localContextParagraphs: [...copy.localContextParagraphs] };
  if (field === "localIntroduction") next.localIntroduction = sentence;
  if (field === "localContextParagraphs[0]") next.localContextParagraphs = [sentence];
  if (field === "localAccessIntroduction") next.localAccessIntroduction = sentence;
  if (field === "localFaqs[0].answer") {
    next.localFaqs = [{ question: "What is nearby in Chellaston?", answer: sentence }];
  }
  if (field === "localCtaBridge") next.localCtaBridge = sentence;
  return next;
}

async function main() {
  console.log("\n=== Chellaston evidence-bound local-narrative writer (fixtures, no generation) ===\n");

  const attemptBodies = ATTEMPTS.map((rel) => fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8"));
  const groundingBefore = sha256Rel(GROUNDING);
  const runBefore = sha256Rel(LIVE_RUN);
  const candidateBefore = Object.fromEntries(
    Object.entries(CANDIDATES).map(([area, rel]) => [area, sha256Rel(rel)]),
  ) as Record<keyof typeof CANDIDATES, string>;

  record(
    "both-failed-chellaston-attempts-preserved-unwritten",
    attemptBodies.length === 2 &&
      fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CHELLASTON_CANDIDATE)) &&
      attemptBodies[0].includes(REJECTED_NETWORKS) &&
      attemptBodies[1].includes(REJECTED_PARENT_TOWN) &&
      attemptBodies.every((body) => JSON.parse(body).candidateRecordWritten === false),
    "both failed attempt logs unchanged on disk; locked Chellaston candidate remains",
  );

  const editorial = loadEditorialEvidencePack(BROOK_DERBY_DEMO_SLUG, SERVICE, AREA) as EditorialEvidencePackV3 | null;
  record(
    "chellaston-ready-evidence-unchanged",
    editorial?.sufficiency.status === "READY" &&
      acceptedFacts(editorial).some((fact) => fact.normalizedStatement.includes("Neighbourhood Board")) &&
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
  const gpFact = facts.find((fact) => /Chellaston Medical Centre/.test(fact.normalizedStatement));
  const boardFact = facts.find((fact) => /Neighbourhood Board/.test(fact.normalizedStatement));
  const distanceFact = facts.find((fact) => fact.factId.endsWith(":pharmacy-relationship:distance"));

  for (const [index, rel] of ATTEMPTS.entries()) {
    const attempt = JSON.parse(attemptBodies[index]) as { rawResponse: string; parsedCopy: AiLocalCopyV3 };
    const parsed = parseAiLocalCopyV3(attempt.rawResponse);
    record(`attempt-${index + 1}-still-parses`, parsed.ok === true, parsed.ok ? rel : parsed.failures.join(" | "));
    if (!parsed.ok) continue;
    const grounded = groundAiLocalCopyClaimsV3(parsed.copy, input, facts);
    const rejected = index === 0 ? REJECTED_NETWORKS : REJECTED_PARENT_TOWN;
    record(
      `attempt-${index + 1}-ungrounded-clause-still-authoritative`,
      grounded.ok === false &&
        grounded.failures.some((row) => /ungrounded-clause|empty-local-claim/.test(row) && row.includes(rejected)),
      grounded.failures.find((row) => /ungrounded-clause/.test(row)) || grounded.failures[0] || "none",
    );
  }

  let rejectedFieldFailures = 0;
  for (const sentence of [REJECTED_NETWORKS, REJECTED_PARENT_TOWN]) {
    for (const field of LOCAL_FIELDS) {
      const copy = placeSentence(baseCopy(), field, sentence);
      const grounded = groundAiLocalCopyClaimsV3(copy, input, facts);
      const hit = grounded.failures.some((row) => /ungrounded-clause|empty-local-claim/.test(row) && row.includes(sentence.slice(0, 48)));
      if (hit) rejectedFieldFailures += 1;
      record(
        `rejected-in-${field}-${sentence === REJECTED_NETWORKS ? "networks" : "parent-town"}`,
        hit,
        hit ? "ungrounded-clause" : grounded.failures.join(" | ") || "not rejected",
      );
    }
  }
  record(
    "both-rejected-sentences-fail-in-every-local-narrative-field",
    rejectedFieldFailures === LOCAL_FIELDS.length * 2,
    `${rejectedFieldFailures}/${LOCAL_FIELDS.length * 2}`,
  );

  const omitted = parseAiLocalCopyV3(baseCopy());
  const omittedGround = omitted.ok ? groundAiLocalCopyClaimsV3(omitted.copy, input, facts) : { ok: false, failures: omitted.failures };
  const omittedBindings = omitted.ok
    ? assertLocalNarrativeEvidenceBindingsV3(omitted.copy, { areaName: "Chellaston" }, facts)
    : { ok: false, failures: omitted.failures };
  record(
    "optional-local-narrative-fields-omissible-when-empty",
    omitted.ok === true &&
      omitted.copy.localIntroduction === "" &&
      omitted.copy.localContextHeading === "" &&
      omitted.copy.localContextParagraphs.length === 0 &&
      omitted.copy.localAccessIntroduction === "" &&
      omitted.copy.localFaqs.length === 0 &&
      omitted.copy.localCtaBridge === "" &&
      !omittedGround.failures.some((row) => /ungrounded-clause/.test(row)) &&
      omittedBindings.ok === true,
    omitted.ok
      ? `groundedFailures=${omittedGround.failures.length} bindings=${omittedBindings.failures.length}`
      : omitted.failures.join(" | "),
  );

  const overlay = overlayFromCopy(omitted.ok ? omitted.copy : baseCopy());
  record(
    "internal-fact-ids-are-not-customer-facing",
    !("evidenceClaims" in overlay) &&
      !("editorialFactIdsUsed" in overlay) &&
      !JSON.stringify(overlay).includes("chellaston:community:") &&
      !JSON.stringify(overlay).includes("editorialFactId"),
    "overlay omits identifiers",
  );

  const supported = baseCopy({
    localIntroduction: boardFact?.normalizedStatement || "",
    localContextParagraphs: gpFact ? [gpFact.normalizedStatement] : [],
    evidenceClaims: [
      {
        field: "localIntroduction",
        sentence: boardFact?.normalizedStatement || "",
        editorialFactId: boardFact?.factId,
      },
      {
        field: "localContextParagraphs",
        sentence: gpFact?.normalizedStatement || "",
        editorialFactId: gpFact?.factId,
      },
      {
        field: "relationshipToPharmacy",
        sentence: "Brook Pharmacy Demo Derby is approximately 5.8 km in a straight line from Chellaston.",
        editorialFactId: distanceFact?.factId,
      },
    ],
    editorialFactIdsUsed: [boardFact?.factId, gpFact?.factId, distanceFact?.factId].filter(
      (id): id is string => Boolean(id),
    ),
  });
  const supportedValidate = validateAiLocalCopyPilotV3(supported, input, facts);
  const supportedBindings = assertLocalNarrativeEvidenceBindingsV3(supported, { areaName: "Chellaston" }, facts);
  record(
    "supported-facts-with-internal-ids-remain-permitted",
    Boolean(boardFact) &&
      Boolean(gpFact) &&
      supportedBindings.ok === true &&
      !supportedValidate.failures.some((row) => /ungrounded-clause/.test(row)) &&
      !supportedValidate.failures.some((row) => /missing-editorial-fact-id/.test(row)),
    supportedValidate.failures.join(" | ") || supportedBindings.failures.join(" | ") || "supported",
  );

  const leaked = baseCopy({
    localIntroduction: `${boardFact?.normalizedStatement || ""} (${boardFact?.factId})`,
  });
  const leakedBindings = assertLocalNarrativeEvidenceBindingsV3(leaked, { areaName: "Chellaston" }, facts);
  record(
    "customer-facing-fact-id-is-rejected",
    leakedBindings.failures.some((row) => /customer-facing-fact-id/.test(row)),
    leakedBindings.failures[0] || "not rejected",
  );

  const uncited = baseCopy({ localContextParagraphs: [boardFact?.normalizedStatement || ""] });
  const uncitedBindings = assertLocalNarrativeEvidenceBindingsV3(uncited, { areaName: "Chellaston" }, facts);
  record(
    "local-factual-sentence-requires-internal-fact-id",
    uncitedBindings.failures.some((row) => /missing-editorial-fact-id/.test(row) && row.includes("localContextParagraphs")),
    uncitedBindings.failures[0] || "not rejected",
  );

  if (boardFact) {
    for (const field of LOCAL_FIELDS) {
      const copy = placeSentence(
        baseCopy({
          evidenceClaims: [
            ...baseCopy().evidenceClaims,
            { field: field.replace(/\[.*$/, ""), sentence: boardFact.normalizedStatement, editorialFactId: boardFact.factId },
          ],
          editorialFactIdsUsed: [boardFact.factId, "chellaston:pharmacy-relationship:distance"],
        }),
        field,
        boardFact.normalizedStatement,
      );
      const grounded = groundAiLocalCopyClaimsV3(copy, input, facts);
      const bindings = assertLocalNarrativeEvidenceBindingsV3(copy, { areaName: "Chellaston" }, facts);
      record(
        `supported-board-fact-in-${field}`,
        !grounded.failures.some((row) => /ungrounded-clause/.test(row) && row.includes("Neighbourhood Board")) &&
          bindings.ok === true,
        grounded.failures.filter((row) => /ungrounded-clause/.test(row)).join(" | ") ||
          bindings.failures.join(" | ") ||
          "supported",
      );
    }
  }

  const livePrompt = buildAiLocalNarrativeUserPromptV3(input);
  const liveUser = JSON.parse(livePrompt) as {
    locality?: { areaSlug?: string };
    verifiedEditorialFacts?: Array<{ factId: string }>;
    fieldNotes?: Record<string, string>;
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
    "area-and-tenant-isolation-no-allestree-leakage",
    liveUser.locality?.areaSlug === AREA &&
      liveUser.verifiedEditorialFacts?.every((row) => row.factId.startsWith("chellaston:")) === true &&
      !livePrompt.includes("Allestree") &&
      !livePrompt.includes("Mickleover") &&
      !livePrompt.includes("Littleover") &&
      !livePrompt.includes("Park Lane Surgery") &&
      !yorkshirePrompt.includes("Chellaston") &&
      !yorkshirePrompt.includes("brook-pharmacy-demo-derby"),
    `facts=${(liveUser.verifiedEditorialFacts || []).map((row) => row.factId).join(",")}`,
  );

  const writerPayload = buildUkLocalPageWriterContractPayload({
    areaName: "Chellaston",
    addressVerified: !premisesAddressLooksUnverified(input.business.address),
  });
  const role = String((writerPayload.roles as Record<string, string> | undefined)?.["recognisable-local-context"] || "");
  record(
    "writer-requires-omission-and-internal-fact-ids-on-every-local-field",
    livePrompt.includes(PHARMACY_FIRST_LOCAL_NARRATIVE_WRITER_RULE_V3) &&
      /150 to 250 words of fluent British English/i.test(liveUser.fieldNotes?.localIntroduction || "") &&
      /omit that claim or section|Empty array or omitted field is required|Return an empty array/i.test(liveUser.fieldNotes?.localContextParagraphs || "") &&
      /editorialFactId/i.test(liveUser.fieldNotes?.evidenceClaims || "") &&
      /Do not infer parent-town membership/i.test(liveUser.localClaimBoundary || "") &&
      (liveUser.editorialStandard?.bannedUnsupportedClaims || []).includes("healthcare networks") &&
      liveUser.editorialStandard?.bannedUnsupportedClaims?.length === PHARMACY_FIRST_BANNED_UNSUPPORTED_LOCAL_CLAIMS_V3.length &&
      /Evidence-bound local introduction in localIntroduction/i.test(role) &&
      !/A sourced fact that the selected area sits in a parent town may still name that town/i.test(livePrompt),
    "optional fields omit instead of padding; parent-town inference is not licensed",
  );

  const groundingSource = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, GROUNDING), "utf8");
  record(
    "ungrounded-clause-validator-file-unchanged",
    groundingBefore === sha256Rel(GROUNDING) &&
      /rule: "ungrounded-clause"/.test(groundingSource) &&
      !/chellaston/i.test(groundingSource) &&
      !/is part of Derby/i.test(groundingSource),
    GROUNDING,
  );

  record(
    "existing-successful-candidates-and-costs-unchanged",
    sha256Rel(CANDIDATES.allestree) === candidateBefore.allestree &&
      sha256Rel(CANDIDATES.mickleover) === candidateBefore.mickleover &&
      sha256Rel(CANDIDATES.littleover) === candidateBefore.littleover &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "mickleover") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "littleover") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, AREA) === true &&
      ONE_LOCAL_PAGE_GENERATE_MAX_ATTEMPTS === 1,
    "Allestree, Mickleover and Littleover preserved; locked Chellaston candidate remains",
  );

  record(
    "attempt-logs-and-stopped-run-unchanged",
    ATTEMPTS.every(
      (rel, index) => fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel), "utf8") === attemptBodies[index],
    ) && sha256Rel(LIVE_RUN) === runBefore,
    LIVE_RUN,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
