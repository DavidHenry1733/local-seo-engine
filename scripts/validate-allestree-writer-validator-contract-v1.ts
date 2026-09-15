#!/usr/bin/env npx tsx
/**
 * Allestree writer/validator contract: replay both saved attempts and their actual
 * inputs, then fixture supported paraphrases vs unsupported claims.
 * No generation, no paid calls, no budget reset, no publication.
 */
import fs from "node:fs";
import path from "node:path";

import { buildPharmacyAiLocalCopyInputV3, validateAiLocalCopyPilotV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  buildAiLocalNarrativeUserPromptV3,
  type BusinessLocalityCopyInputV3,
  type EditorialFactForPromptV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { inspectOffPremisesAccessCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { groundAiLocalCopyClaimsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import type {
  EditorialEvidencePackV3,
  EditorialFactV3,
  PermittedCopyRole,
} from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
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
const ALLOWED_CLINICAL = "Pharmacy First can help with eligible common conditions.";

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

type SavedAttempt = {
  attemptNumber: number;
  rawResponse: string;
  candidateRecordWritten: boolean;
  estimatedCostUsd?: number;
  sanitizedRequest: { messages: Array<{ role: string; content: string }> };
  validationResult: { ok: boolean; failures: string[] };
};

type SavedUserPrompt = {
  writingBrief?: string;
  fieldNotes?: Record<string, string>;
  localClaimBoundary?: string;
  editorialStandard?: { bannedUnsupportedClaims?: string[] };
  offer?: { clinicalBoundary?: string };
  business?: { name?: string; address?: string; marketTown?: string };
  canonicalPharmacyIdentity?: { name?: string; address?: string };
  locality?: {
    areaName?: string;
    areaSlug?: string;
    distanceKm?: number | null;
    distanceLabel?: string;
    pharmacyIsInArea?: boolean;
  };
  verifiedEditorialFacts?: Array<{
    factId: string;
    category: string;
    statement: string;
    useAs: string;
    doNotInfer?: string;
  }>;
};

function parseFirstJsonObject(text: string): SavedUserPrompt {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("saved user message has no JSON object");
  try {
    return JSON.parse(text.slice(start)) as SavedUserPrompt;
  } catch {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === "\\") escape = true;
        else if (ch === "\"") inString = false;
        continue;
      }
      if (ch === "\"") inString = true;
      else if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as SavedUserPrompt;
      }
    }
    throw new Error("saved user message JSON is truncated");
  }
}

function parseSavedUser(attempt: SavedAttempt): SavedUserPrompt {
  const raw = attempt.sanitizedRequest.messages.find((row) => row.role === "user")?.content || "{}";
  return parseFirstJsonObject(raw);
}

function factsFromSavedUser(user: SavedUserPrompt, live: EditorialFactV3[]): EditorialFactV3[] {
  if (!user.verifiedEditorialFacts?.length) return live;
  return user.verifiedEditorialFacts.map((row) => {
    const existing = live.find((fact) => fact.factId === row.factId);
    return {
      factId: row.factId,
      area: user.locality?.areaName || "Allestree",
      areaSlug: user.locality?.areaSlug || AREA,
      category: (row.category || existing?.category || "community") as EditorialFactV3["category"],
      normalizedStatement: row.statement,
      sourceTitle: existing?.sourceTitle || "",
      sourceUrl: existing?.sourceUrl || "",
      publisher: existing?.publisher || "",
      retrievedAt: existing?.retrievedAt || "",
      sourceClass: existing?.sourceClass || "primary",
      corroboratingSource: existing?.corroboratingSource || null,
      confidence: existing?.confidence || "high",
      usefulnessToPharmacyFirstReader: existing?.usefulnessToPharmacyFirstReader || "",
      permittedCopyRole: (row.useAs || existing?.permittedCopyRole || "area-introduction") as PermittedCopyRole,
      prohibitedInference: row.doNotInfer || existing?.prohibitedInference || "",
      validationStatus: "accepted",
    };
  });
}

function inputFromSavedUser(user: SavedUserPrompt, live: BusinessLocalityCopyInputV3, facts: EditorialFactV3[]): BusinessLocalityCopyInputV3 {
  const editorialFacts: EditorialFactForPromptV3[] = facts.map((fact) => ({
    factId: fact.factId,
    category: fact.category,
    normalizedStatement: fact.normalizedStatement,
    permittedCopyRole: fact.permittedCopyRole,
    prohibitedInference: fact.prohibitedInference,
    sourceClass: fact.sourceClass,
    publisher: fact.publisher,
  }));
  return {
    ...live,
    business: {
      ...live.business,
      name: user.canonicalPharmacyIdentity?.name || user.business?.name || live.business.name,
      address: user.canonicalPharmacyIdentity?.address || user.business?.address || live.business.address,
      marketTown: user.business?.marketTown || live.business.marketTown,
    },
    locality: {
      ...live.locality,
      distanceKm: user.locality?.distanceKm ?? live.locality.distanceKm,
      distanceLabel: user.locality?.distanceLabel || live.locality.distanceLabel,
      pharmacyIsInArea: user.locality?.pharmacyIsInArea ?? live.locality.pharmacyIsInArea,
    },
    editorialFacts,
  };
}

function baseSupportedCopy(overrides: Partial<AiLocalCopyV3> = {}): AiLocalCopyV3 {
  return {
    area: "Allestree",
    heroHeading: "Pharmacy First in Allestree",
    heroIntroduction: "Pharmacy First can help people in Allestree with eligible common conditions.",
    localIntroduction:
      "Allestree is a neighbourhood ward in Derby. Allestree has a Neighbourhood Board of local councillors, residents and representatives from community organisations and public services.",
    localContextHeading: "",
    localContextParagraphs: [
      "NHS general practice services in Allestree are provided from Park Lane Surgery. Allestree Park is named on the local-authority neighbourhood page, with a Friends of Allestree Park group.",
    ],
    relationshipToPharmacy:
      "Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is approximately 4.1 km in a straight line from Allestree.",
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: [
      "allestree:area-identity:allestree-is-a-neighbourhood-ward-in-derby",
      "allestree:community:allestree-has-a-neighbourhood-board-of-local-cou",
      "allestree:healthcare:nhs-general-practice-services-in-allestree-are-p",
      "allestree:community:allestree-park-is-named-on-the-local-authority-n",
      "allestree:pharmacy-relationship:distance",
    ],
    ...overrides,
  };
}

function genuineDefectsRemain(failures: string[], reviews: string[], attempt: 1 | 2): boolean {
  const hay = [...failures, ...reviews].join("\n");
  if (attempt === 1) {
    return (
      /unsupported-evaluative-claim|unsupported convenience/i.test(hay) &&
      /unsupported-character|empty-local-claim/i.test(hay) &&
      /clinical-broadening/i.test(hay) &&
      /without unnecessary delay/i.test(hay)
    );
  }
  return /clinical-broadening/i.test(hay) && /another NHS option/i.test(hay);
}

function main() {
  console.log("\n=== Allestree writer/validator contract (no generation, no paid calls) ===\n");
  console.log("Fixture or replay success is not a successful live generation.\n");

  const attempt1Before = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_1), "utf8");
  const attempt2Before = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_2), "utf8");
  const budgetBefore = readJson<{ consumed: number; estimatedCostUsd: number; maxProviderCalls: number }>(BUDGET);
  const attempt1 = JSON.parse(attempt1Before) as SavedAttempt;
  const attempt2 = JSON.parse(attempt2Before) as SavedAttempt;
  const savedUser1 = parseSavedUser(attempt1);
  const savedUser2 = parseSavedUser(attempt2);

  record(
    "both-saved-attempts-preserved-unwritten",
    attempt1.attemptNumber === 1 &&
      attempt2.attemptNumber === 2 &&
      attempt1.candidateRecordWritten === false &&
      attempt2.candidateRecordWritten === false &&
      /without unnecessary delay/i.test(attempt1.rawResponse) &&
      /another NHS option/i.test(attempt2.rawResponse),
    `attempt1=${attempt1.attemptNumber} attempt2=${attempt2.attemptNumber}`,
  );

  const editorial = loadEditorialEvidencePack(SLUG, SERVICE, AREA) as EditorialEvidencePackV3 | null;
  record("editorial-pack-preserved-ready", editorial?.sufficiency.status === "READY", editorial?.sufficiency.status || "missing");
  if (!editorial) {
    process.exitCode = 1;
    return;
  }
  const liveInput = buildPharmacyAiLocalCopyInputV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Allestree",
    areaSlug: AREA,
    editorial,
  });
  const liveFacts = editorial.facts.filter((fact) => fact.validationStatus === "accepted");
  const livePrompt = buildAiLocalNarrativeUserPromptV3(liveInput);

  record(
    "writer-local-claim-boundary-matches-validator-categories",
    /Local claims must stay inside supplied verifiedEditorialFacts/.test(livePrompt) &&
      /Do not invent local character, resident value/.test(livePrompt) &&
      /Do not add convenience, delay, evaluative, or alternative-to-GP claims/.test(livePrompt) &&
      /Do not locate the pharmacy at that locality in local-context fields/.test(livePrompt) &&
      /Do not infer parent-town membership from premisesLocality, marketTown or geographic metadata/.test(livePrompt) &&
      /Waiting, delay, and alternative-to-GP claims are not in the locked clinical facts/.test(livePrompt) &&
      /You may say Pharmacy First can help with eligible common conditions/.test(livePrompt) &&
      /"convenient"/.test(livePrompt) &&
      /"known for"/.test(livePrompt) &&
      /"another option"/.test(livePrompt),
    "v3 writer now receives the local and clinical boundaries the validator already enforces",
  );
  record(
    "saved-writer-inputs-lacked-those-boundaries",
    !/localClaimBoundary/.test(JSON.stringify(savedUser1)) &&
      !/Waiting, delay, and alternative-to-GP/.test(savedUser1.offer?.clinicalBoundary || "") &&
      /Lead with the service and reader’s needs/.test(savedUser1.writingBrief || "") &&
      /helps recognition/.test(savedUser1.fieldNotes?.localIntroduction || "") &&
      /name the supplied premisesLocality/.test(savedUser1.fieldNotes?.relationshipToPharmacy || "") &&
      /Allestree is a neighbourhood ward in Derby/.test(JSON.stringify(savedUser1.verifiedEditorialFacts)),
    "saved prompts invited reader-need framing and Derby in both geography and access fields",
  );

  const parsed1 = parseAiLocalCopyV3(attempt1.rawResponse);
  const parsed2 = parseAiLocalCopyV3(attempt2.rawResponse);
  record("saved-responses-parse-unchanged", parsed1.ok && parsed2.ok, parsed1.ok && parsed2.ok ? "parsed" : "parse failed");
  if (!parsed1.ok || !parsed2.ok) {
    process.exitCode = 1;
    return;
  }

  const savedFacts1 = factsFromSavedUser(savedUser1, liveFacts);
  const savedInput1 = inputFromSavedUser(savedUser1, liveInput, savedFacts1);
  const savedFacts2 = factsFromSavedUser(savedUser2, liveFacts);
  const savedInput2 = inputFromSavedUser(savedUser2, liveInput, savedFacts2);
  const replaySaved1 = validateAiLocalCopyPilotV3(parsed1.copy, savedInput1, savedFacts1);
  const replaySaved2 = validateAiLocalCopyPilotV3(parsed2.copy, savedInput2, savedFacts2);
  const replayLive1 = validateAiLocalCopyPilotV3(parsed1.copy, liveInput, liveFacts);
  const replayLive2 = validateAiLocalCopyPilotV3(parsed2.copy, liveInput, liveFacts);

  record(
    "attempt-1-rejected-against-its-actual-inputs",
    replaySaved1.ok === false && genuineDefectsRemain(replaySaved1.failures, replaySaved1.reviews, 1),
    `ok=${replaySaved1.ok} failures=${replaySaved1.failures.length} reviews=${replaySaved1.reviews.length}`,
  );
  record(
    "attempt-2-rejected-against-its-actual-inputs",
    replaySaved2.ok === false && genuineDefectsRemain(replaySaved2.failures, replaySaved2.reviews, 2),
    `ok=${replaySaved2.ok} failures=${replaySaved2.failures.length} reviews=${replaySaved2.reviews.length}`,
  );
  record(
    "saved-invalid-copy-still-rejected-on-live-path",
    replayLive1.ok === false &&
      replayLive2.ok === false &&
      genuineDefectsRemain(replayLive1.failures, replayLive1.reviews, 1) &&
      genuineDefectsRemain(replayLive2.failures, replayLive2.reviews, 2),
    `live1=${replayLive1.failures.length}f/${replayLive1.reviews.length}r live2=${replayLive2.failures.length}f/${replayLive2.reviews.length}r`,
  );
  record(
    "attempt-1-ward-in-derby-is-not-the-rejecting-premises-repeat",
    !replayLive1.failures.some((row) => /premises locality repeated/i.test(row)) &&
      /neighbourhood ward within Derby/.test(parsed1.copy.localIntroduction),
    replayLive1.failures.filter((row) => /premises locality/i.test(row)).join(" | ") || "no premises-repeat on ward geography",
  );
  record(
    "attempt-2-ward-in-derby-is-not-the-rejecting-premises-repeat",
    !replayLive2.failures.some((row) => /premises locality repeated/i.test(row)) &&
      /neighbourhood ward in Derby/.test(parsed2.copy.localIntroduction) &&
      /clinical-broadening/.test(replayLive2.failures.join("\n")),
    replayLive2.failures.join(" | "),
  );

  const supported = baseSupportedCopy();
  const supportedOut = validateAiLocalCopyPilotV3(supported, liveInput, liveFacts);
  const supportedPremises = inspectOffPremisesAccessCopyV3(supported, liveInput);
  record(
    "supported-paraphrases-pass",
    supportedOut.ok === true &&
      supportedOut.failures.length === 0 &&
      supportedOut.reviews.length === 0 &&
      !supportedPremises.failures.some((row) => /premises locality repeated/i.test(row)),
    supportedOut.ok
      ? "supported Allestree paraphrases validate"
      : `failures=${supportedOut.failures.join(" | ")} reviews=${supportedOut.reviews.join(" | ")}`,
  );
  record(
    "supported-pass-is-a-fixture-not-a-live-generation",
    supportedOut.ok === true && !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE)),
    "no candidate record exists; Generate was not run",
  );

  const convenience = validateAiLocalCopyPilotV3(
    baseSupportedCopy({ heroIntroduction: "Pharmacy First offers a convenient way for people in Allestree to get advice." }),
    liveInput,
    liveFacts,
  );
  record(
    "unsupported-convenient-still-fails",
    convenience.ok === false &&
      convenience.failures.some((row) => /unsupported-evaluative-claim|unsupported convenience/i.test(row)),
    convenience.failures.filter((row) => /convenient|evaluative/i.test(row)).join(" | ") || convenience.failures[0] || "none",
  );

  const knownFor = validateAiLocalCopyPilotV3(
    baseSupportedCopy({
      localIntroduction: "Allestree is a neighbourhood ward within Derby, known for its active community and local initiatives.",
    }),
    liveInput,
    liveFacts,
  );
  record(
    "unsupported-known-for-still-fails",
    knownFor.ok === false && knownFor.failures.some((row) => /unsupported-character|empty-local-claim|known for/i.test(row)),
    knownFor.failures.filter((row) => /known for|character|empty-local/i.test(row)).join(" | ") || knownFor.failures[0] || "none",
  );

  const communityResources = validateAiLocalCopyPilotV3(
    baseSupportedCopy({
      localContextParagraphs: [
        "Alongside these community resources, NHS general practice services are provided from Park Lane Surgery.",
      ],
    }),
    liveInput,
    liveFacts,
  );
  record(
    "unsupported-community-resources-still-fails",
    communityResources.ok === false && communityResources.failures.some((row) => /empty-local-claim|community resources/i.test(row)),
    communityResources.failures.filter((row) => /community resources|empty-local/i.test(row)).join(" | ") ||
      communityResources.failures[0] ||
      "none",
  );

  const delayCopy = validateAiLocalCopyPilotV3(
    baseSupportedCopy({
      localContextParagraphs: [
        "For many common health concerns, Pharmacy First offers a direct route to professional advice and treatment, helping Allestree residents access the care they need without unnecessary delay.",
      ],
    }),
    liveInput,
    liveFacts,
  );
  const delayHay = delayCopy.failures.join("\n");
  record(
    "unsupported-delay-still-fails-as-clinical-broadening",
    delayCopy.ok === false &&
      /clinical-broadening/.test(delayHay) &&
      /without unnecessary delay/.test(delayHay) &&
      !delayCopy.failures.some((row) => /ungrounded-clause/.test(row) && /without unnecessary delay/.test(row)),
    delayCopy.failures.filter((row) => /delay|clinical-broadening|common health/i.test(row)).join(" | ") || delayHay,
  );

  const anotherOption = groundAiLocalCopyClaimsV3(
    baseSupportedCopy({
      localContextParagraphs: [`${ALLOWED_CLINICAL}, offering another option for advice and treatment.`],
    }),
    liveInput,
    liveFacts,
  );
  const anotherNhs = groundAiLocalCopyClaimsV3(
    baseSupportedCopy({
      localContextParagraphs: [`${ALLOWED_CLINICAL}, offering another NHS option for assessment and advice.`],
    }),
    liveInput,
    liveFacts,
  );
  record(
    "unsupported-another-option-still-fails",
    anotherOption.failures.some((row) => /clinical-broadening/.test(row) && /another option/.test(row)) &&
      anotherNhs.failures.some((row) => /clinical-broadening/.test(row) && /another NHS option/.test(row)),
    `option=${anotherOption.failures.find((row) => /another option/.test(row)) || "none"} nhs=${anotherNhs.failures.find((row) => /another NHS option/.test(row)) || "none"}`,
  );

  const allowedGrounded = groundAiLocalCopyClaimsV3(
    baseSupportedCopy({ localContextParagraphs: [ALLOWED_CLINICAL] }),
    liveInput,
    liveFacts,
  );
  const allowedClaim = allowedGrounded.claims.find((claim) => claim.exactSentence === ALLOWED_CLINICAL);
  record(
    "allowed-locked-phrase-still-grounds",
    allowedClaim?.validationResult === "pass" ||
      !allowedGrounded.failures.some((row) => row.includes(ALLOWED_CLINICAL) && /ungrounded-clause|clinical-broadening/.test(row)),
    allowedClaim ? `${allowedClaim.validationResult} ${allowedClaim.supportingCanonicalFieldOrEntity}` : allowedGrounded.failures.join(" | "),
  );

  const pharmacyLocatedInContext = inspectOffPremisesAccessCopyV3(
    baseSupportedCopy({
      localContextParagraphs: ["Consultations take place at Brook Pharmacy Demo Derby in Derby."],
      relationshipToPharmacy: "Consultations take place at Brook Pharmacy Demo Derby in Derby.",
    }),
    liveInput,
  );
  record(
    "locating-pharmacy-in-both-context-and-access-still-fails",
    pharmacyLocatedInContext.failures.some((row) => /premises locality repeated/i.test(row)),
    pharmacyLocatedInContext.failures.join(" | ") || "none",
  );

  const attempt1After = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_1), "utf8");
  const attempt2After = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_2), "utf8");
  const budgetAfter = readJson<{ consumed: number; estimatedCostUsd: number; maxProviderCalls: number }>(BUDGET);
  record(
    "attempts-costs-outputs-and-candidate-untouched",
    attempt1After === attempt1Before &&
      attempt2After === attempt2Before &&
      !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE)) &&
      budgetAfter.consumed === budgetBefore.consumed &&
      budgetAfter.maxProviderCalls === budgetBefore.maxProviderCalls &&
      budgetAfter.estimatedCostUsd === budgetBefore.estimatedCostUsd,
    `consumed=${budgetAfter.consumed}/${budgetAfter.maxProviderCalls} cost=${budgetAfter.estimatedCostUsd} candidate=${fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE))}`,
  );
  record(
    "no-live-generation-was-run",
    budgetAfter.consumed === budgetBefore.consumed && !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE)),
    `durable ${budgetAfter.consumed}/${budgetAfter.maxProviderCalls} calls remain consumed; this is fixture/replay work only`,
  );

  const failed = checks.filter((row) => !row.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  if (failed) process.exitCode = 1;
}

main();
