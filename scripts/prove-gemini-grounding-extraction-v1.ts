#!/usr/bin/env npx tsx
/**
 * Provider-free proof that Gemini grounding metadata is extracted and stored
 * on an attempt record. Does not call Gemini, OpenAI, Places or DataForSEO.
 */
import fs from "node:fs";
import path from "node:path";

import { persistAiLocalAttemptLogV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { groundingMetadataExists } from "../src/pharmacy/contentEngine/pharmacyGroundedGeminiLocalCopyValidationV1.ts";
import {
  UK_LOCAL_INTRODUCTION_GEMINI_GOOGLE_SEARCH_TOOL,
  UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
  extractGeminiGroundingMetadata,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts";

const ROOT = path.join(import.meta.dirname, "..");
const fixturePath = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-fixtures/gemini-generate-content-grounded-response-v1.json",
);
const proofPath = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-fixtures/gemini-grounding-extraction-proof.json",
);

const payload = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const request = {
  provider: "gemini",
  model: UK_LOCAL_INTRODUCTION_GEMINI_MODEL,
  tools: [UK_LOCAL_INTRODUCTION_GEMINI_GOOGLE_SEARCH_TOOL],
};
const grounding = extractGeminiGroundingMetadata(payload);
const attemptPath = persistAiLocalAttemptLogV3({
  slug: "gemini-grounding-fixture",
  serviceId: "pharmacy-first",
  areaSlug: "fixture-area",
  attemptNumber: 1,
  request,
  rawResponse: "HERO INTRODUCTION:\nPeople in Darfield can use Pharmacy First at Yorkshire Pharmacy & Health Clinic.",
  validationResult: { ok: true, failures: [] },
  copy: null,
  candidateVersion: "fixture",
  grounding,
});
const attempt = JSON.parse(fs.readFileSync(attemptPath, "utf8")) as Record<string, unknown>;
const proof = {
  providerCalled: false,
  requestConfiguration: request,
  extraction: grounding,
  structuralCheckPassed: groundingMetadataExists(grounding),
  savedAttemptPath: path.relative(ROOT, attemptPath),
  savedAttemptFieldNames: Object.keys(attempt),
  geminiGroundingFieldNames:
    attempt.geminiGrounding && typeof attempt.geminiGrounding === "object"
      ? Object.keys(attempt.geminiGrounding as Record<string, unknown>)
      : [],
};
fs.writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
console.log(JSON.stringify(proof, null, 2));
