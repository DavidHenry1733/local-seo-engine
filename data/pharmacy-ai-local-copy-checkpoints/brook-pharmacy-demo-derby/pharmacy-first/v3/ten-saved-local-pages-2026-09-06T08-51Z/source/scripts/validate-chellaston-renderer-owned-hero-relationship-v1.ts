#!/usr/bin/env npx tsx
/**
 * Provider-free Chellaston preflight: renderer-owned heroIntroduction and
 * relationshipToPharmacy from structured values. No OpenAI, no Resume.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
  applyRendererOwnedLocalCopyFieldsV3,
  buildAiLocalNarrativeUserPromptV3,
  buildRendererOwnedHeroIntroductionV3,
  buildRendererOwnedRelationshipToPharmacyV3,
  overlayFromCopy,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import {
  clauseStatesSuppliedApproximateStraightLineDistanceV3,
  groundAiLocalCopyClaimsV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import {
  inspectOffPremisesAccessCopyV3,
  evaluateAiLocalCopyQualityV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { assertLocalNarrativeEvidenceBindingsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEvidenceBindingV3.ts";
import {
  buildPharmacyAiLocalCopyInputV3,
  validateAiLocalCopyPilotV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import type { EditorialEvidencePackV3, EditorialFactV3 } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { hasSavedValidLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";

const SERVICE = "pharmacy-first";
const AREA = "chellaston";
const LAST_ATTEMPT =
  "data/pharmacy-ai-local-copy-attempt-logs/brook-pharmacy-demo-derby/pharmacy-first/v3/chellaston/2026-09-06T05-55-55-049Z-attempt-1.json";
const GROUNDING = "src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
const QUALITY = "src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
const LIVE_RUN =
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json";
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

function acceptedFacts(editorial: EditorialEvidencePackV3): EditorialFactV3[] {
  return editorial.facts.filter((fact) => fact.validationStatus === "accepted");
}

async function main() {
  console.log("\n=== Chellaston renderer-owned hero/relationship preflight (no provider) ===\n");

  const attemptBefore = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, LAST_ATTEMPT), "utf8");
  const groundingBefore = sha256Rel(GROUNDING);
  const qualityBefore = sha256Rel(QUALITY);
  const runBefore = sha256Rel(LIVE_RUN);
  const candidateBefore = Object.fromEntries(
    Object.entries(CANDIDATES).map(([area, rel]) => [area, sha256Rel(rel)]),
  ) as Record<keyof typeof CANDIDATES, string>;

  const editorial = loadEditorialEvidencePack(BROOK_DERBY_DEMO_SLUG, SERVICE, AREA) as EditorialEvidencePackV3 | null;
  if (!editorial) {
    record("chellaston-editorial-ready", false, "missing");
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

  const attempt = JSON.parse(attemptBefore) as { rawResponse: string; parsedCopy: AiLocalCopyV3 };
  const parsedFailed = parseAiLocalCopyV3(attempt.rawResponse);
  record("last-failed-attempt-still-parses", parsedFailed.ok === true, parsedFailed.ok ? LAST_ATTEMPT : parsedFailed.failures.join(" | "));
  if (!parsedFailed.ok) {
    process.exitCode = 1;
    return;
  }

  const failedAccess = inspectOffPremisesAccessCopyV3(parsedFailed.copy, input);
  record(
    "failed-attempt-still-fails-area-in-hero",
    failedAccess.failures.some((row) => /area-in-hero/.test(row) && row.includes("Pharmacy First can help with eligible common conditions.")),
    failedAccess.failures.find((row) => /area-in-hero/.test(row)) || "missing area-in-hero",
  );
  record(
    "failed-attempt-still-fails-premises-locality",
    failedAccess.failures.some((row) => /premises-locality/.test(row)),
    failedAccess.failures.find((row) => /premises-locality/.test(row)) || "missing premises-locality",
  );

  const overlay = applyRendererOwnedLocalCopyFieldsV3(parsedFailed.copy, input);
  const hero = buildRendererOwnedHeroIntroductionV3("Chellaston");
  const relationship = buildRendererOwnedRelationshipToPharmacyV3(input);
  record(
    "renderer-overwrites-model-hero-and-relationship",
    overlay.heroIntroduction === hero &&
      overlay.relationshipToPharmacy === relationship &&
      overlay.heroIntroduction !== parsedFailed.copy.heroIntroduction &&
      overlay.relationshipToPharmacy !== parsedFailed.copy.relationshipToPharmacy &&
      overlay.heroIntroduction.includes(ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3.replace(/\.$/, "")) &&
      overlay.heroIntroduction.includes("Chellaston"),
    overlay.heroIntroduction,
  );
  record(
    "relationship-uses-confirmed-structured-values",
    /Consultations take place at Brook Pharmacy Demo Derby in Derby/.test(overlay.relationshipToPharmacy) &&
      /approximately 5\.8 km in a straight line from Chellaston/.test(overlay.relationshipToPharmacy) &&
      !/travel|route|convenient|available|minutes/i.test(overlay.relationshipToPharmacy),
    overlay.relationshipToPharmacy,
  );

  const access = inspectOffPremisesAccessCopyV3(overlay, input);
  record(
    "hero-passes-area-in-hero",
    !access.failures.some((row) => /area-in-hero/.test(row)),
    access.failures.filter((row) => /area-in-hero/.test(row)).join(" | ") || "area-in-hero clear",
  );
  record(
    "relationship-passes-premises-locality",
    !access.failures.some((row) => /premises-locality/.test(row)),
    access.failures.filter((row) => /premises-locality/.test(row)).join(" | ") || "premises-locality clear",
  );

  const distanceSentence =
    overlay.relationshipToPharmacy
      .split(/(?<=[.!?])\s+/)
      .find((part) => /5\.8 km/.test(part)) || "";
  record(
    "straight-line-5-8km-remains-supported",
    Boolean(distanceSentence) &&
      clauseStatesSuppliedApproximateStraightLineDistanceV3(distanceSentence, input) === true &&
      input.locality.distanceKm === 5.8,
    distanceSentence || "missing distance sentence",
  );

  const grounded = groundAiLocalCopyClaimsV3(overlay, input, facts);
  record(
    "no-unsupported-local-claims",
    !grounded.failures.some((row) => /ungrounded-clause|unsupported-character|empty-local-claim/.test(row)),
    grounded.failures.join(" | ") || "no unsupported local claims",
  );

  const quality = evaluateAiLocalCopyQualityV3(overlay, input);
  const bindings = assertLocalNarrativeEvidenceBindingsV3(overlay, { areaName: "Chellaston" }, facts);
  const validated = validateAiLocalCopyPilotV3(overlay, input, facts);
  record(
    "full-candidate-validation-passes",
    validated.ok === true &&
      quality.ok === true &&
      bindings.ok === true &&
      Boolean(gpFact) &&
      overlay.localContextParagraphs[0] === gpFact?.normalizedStatement,
    validated.ok ? "ok" : [...validated.failures, ...validated.reviews, ...bindings.failures].join(" | "),
  );

  const customer = overlayFromCopy(overlay);
  const customerText = JSON.stringify(customer);
  record(
    "customer-facing-output-has-no-evidence-ids",
    !customerText.includes("chellaston:healthcare:") &&
      !customerText.includes("chellaston:community:") &&
      !customerText.includes("chellaston:pharmacy-relationship:") &&
      !customerText.includes("editorialFactId") &&
      !customerText.includes("factId") &&
      !("evidenceClaims" in customer),
    "overlay omits identifiers",
  );

  const omittedModel = parseAiLocalCopyV3({
    area: "Chellaston",
    heroHeading: "Pharmacy First in Chellaston",
    localContextParagraphs: gpFact ? [gpFact.normalizedStatement] : [],
    localFaqs: [],
    evidenceClaims: gpFact
      ? [
          {
            field: "localContextParagraphs",
            sentence: gpFact.normalizedStatement,
            editorialFactId: gpFact.factId,
          },
        ]
      : [],
    editorialFactIdsUsed: gpFact ? [gpFact.factId] : [],
  });
  const omittedOverlay = omittedModel.ok ? applyRendererOwnedLocalCopyFieldsV3(omittedModel.copy, input) : null;
  record(
    "model-may-omit-renderer-owned-fields",
    omittedModel.ok === true &&
      omittedOverlay != null &&
      omittedOverlay.heroIntroduction === hero &&
      omittedOverlay.relationshipToPharmacy === relationship &&
      validateAiLocalCopyPilotV3(omittedOverlay, input, facts).ok === true,
    omittedModel.ok ? "omitted then filled" : omittedModel.failures.join(" | "),
  );

  const livePrompt = buildAiLocalNarrativeUserPromptV3(input);
  const liveUser = JSON.parse(livePrompt) as {
    schemaFields?: string[];
    fieldNotes?: Record<string, string>;
    rendererOwnedFields?: Record<string, string>;
    deterministicFields?: Record<string, string>;
  };
  record(
    "prompt-does-not-ask-openai-to-compose-those-fields",
    liveUser.schemaFields?.includes("heroIntroduction") !== true &&
      liveUser.schemaFields?.includes("relationshipToPharmacy") !== true &&
      liveUser.schemaFields?.includes("localIntroduction") !== true &&
      liveUser.schemaFields?.includes("area") !== true &&
      liveUser.schemaFields?.includes("heroHeading") !== true &&
      /OpenAI must omit this field/i.test(liveUser.deterministicFields?.heroIntroduction || "") &&
      /OpenAI must omit this field/i.test(liveUser.deterministicFields?.relationshipToPharmacy || "") &&
      /OpenAI must omit this field/i.test(liveUser.deterministicFields?.localIntroduction || ""),
    "heroIntroduction and relationshipToPharmacy are renderer-owned in the prompt",
  );

  record(
    "validator-files-unchanged",
    groundingBefore === sha256Rel(GROUNDING) &&
      qualityBefore === sha256Rel(QUALITY) &&
      /area-in-hero/.test(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, QUALITY), "utf8")) &&
      /premises-locality/.test(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, QUALITY), "utf8")),
    "area-in-hero and premises-locality rules not weakened",
  );
  record(
    "existing-candidates-and-attempt-unchanged",
    sha256Rel(CANDIDATES.allestree) === candidateBefore.allestree &&
      sha256Rel(CANDIDATES.mickleover) === candidateBefore.mickleover &&
      sha256Rel(CANDIDATES.littleover) === candidateBefore.littleover &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "mickleover") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "littleover") &&
      hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, AREA) === true &&
      fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CHELLASTON_CANDIDATE)) &&
      (JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, CHELLASTON_CANDIDATE), "utf8")) as { generatedAt?: string }).generatedAt ===
        "2026-09-06T06:16:09.662Z" &&
      fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, LAST_ATTEMPT), "utf8") === attemptBefore &&
      sha256Rel(LIVE_RUN) === runBefore,
    "Allestree, Mickleover and Littleover unchanged; saved Chellaston candidate and rejected attempt preserved",
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
