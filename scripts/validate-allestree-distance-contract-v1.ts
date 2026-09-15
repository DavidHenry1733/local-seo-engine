#!/usr/bin/env npx tsx
/**
 * Distance-contract mismatch: equivalent approximate straight-line wording.
 * No generation, no paid calls, no budget reset.
 */
import fs from "node:fs";
import path from "node:path";

import { buildPharmacyAiLocalCopyInputV3, validateAiLocalCopyPilotV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { buildAiLocalNarrativeUserPromptV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { groundAiLocalCopyClaimsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { parseAiLocalCopyV3, type AiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
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

function baseCopy(relationship: string): AiLocalCopyV3 {
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
    relationshipToPharmacy: relationship,
    localAccessIntroduction: "",
    localFaqs: [],
    localCtaBridge: "",
    evidenceClaims: [],
    evidenceEntityIdsUsed: [],
    editorialFactIdsUsed: ["allestree:pharmacy-relationship:distance"],
  };
}

function main() {
  console.log("\n=== Allestree distance contract (no generation, no paid calls) ===\n");

  const attempt1Before = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_1), "utf8");
  const attempt2Before = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_2), "utf8");
  const budgetBefore = readJson<{ consumed: number; estimatedCostUsd: number; maxProviderCalls: number }>(BUDGET);

  const editorial = loadEditorialEvidencePack(SLUG, SERVICE, AREA);
  if (!editorial) {
    record("editorial-pack-present", false, "missing");
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
  const facts = editorial.facts.filter((fact) => fact.validationStatus === "accepted");
  const prompt = buildAiLocalNarrativeUserPromptV3(input);

  record(
    "writer-accepts-equivalent-straight-line-wording",
    /Equivalent wording is acceptable/.test(prompt) &&
      /in a straight line or straight-line/.test(prompt) &&
      /Do not require the exact distanceLabel string/.test(prompt) &&
      /Do not name a different origin/.test(prompt),
    "v3 writer no longer requires the exact distanceLabel phrase",
  );
  record(
    "supplied-distance-is-4-1-straight-line-from-allestree",
    input.locality.distanceKm === 4.1 &&
      /4\.1 km in a straight line from Allestree/.test(facts.find((f) => f.category === "pharmacy-relationship")?.normalizedStatement || ""),
    `distanceKm=${input.locality.distanceKm} label=${input.locality.distanceLabel}`,
  );

  const inAStraightLine = "Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is approximately 4.1 km in a straight line from Allestree.";
  const aroundWording = "Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is around 4.1 km from Allestree in a straight line.";
  const aboutWording = "Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is about 4.1 km away in a straight line from Allestree.";
  const exactLabel = "Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is approximately 4.1 km straight-line from Allestree.";
  const namedPharmacy = "Brook Pharmacy Demo Derby is approximately 4.1 km in a straight line from Allestree.";

  for (const [id, relationship] of [
    ["equivalent-in-a-straight-line-passes", inAStraightLine],
    ["equivalent-around-in-a-straight-line-passes", aroundWording],
    ["equivalent-about-away-in-a-straight-line-passes", aboutWording],
    ["exact-distanceLabel-still-passes", exactLabel],
    ["named-pharmacy-straight-line-passes", `Consultations take place at Brook Pharmacy Demo Derby in Derby. ${namedPharmacy}`],
  ] as const) {
    const out = validateAiLocalCopyPilotV3(baseCopy(relationship), input, facts);
    record(id, out.ok === true && out.failures.length === 0 && out.reviews.length === 0, out.ok ? "pass" : `fail=${out.failures.join(" | ")} rev=${out.reviews.join(" | ")}`);
  }

  const wrongNumber = validateAiLocalCopyPilotV3(
    baseCopy("Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is approximately 9.9 km in a straight line from Allestree."),
    input,
    facts,
  );
  record(
    "wrong-number-still-fails",
    wrongNumber.ok === false && wrongNumber.failures.some((row) => /unsupported-number/.test(row) && /9\.9/.test(row)),
    wrongNumber.failures.find((row) => /9\.9/.test(row)) || wrongNumber.failures[0] || "none",
  );

  const travel = validateAiLocalCopyPilotV3(
    baseCopy("Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is approximately 4.1 km drive from Allestree."),
    input,
    facts,
  );
  record(
    "travel-distance-still-fails",
    travel.ok === false && travel.failures.some((row) => /unsupported-travel-distance|unsupported-inference/.test(row)),
    travel.failures.filter((row) => /travel|drive|inference/.test(row)).join(" | ") || travel.failures[0] || "none",
  );

  const wrongOrigin = groundAiLocalCopyClaimsV3(
    baseCopy("Consultations take place at Brook Pharmacy Demo Derby in Derby. The pharmacy is approximately 4.1 km in a straight line from Mickleover."),
    input,
    facts,
  );
  record(
    "unsupported-endpoint-still-fails",
    wrongOrigin.ok === false &&
      wrongOrigin.failures.some((row) => /Mickleover/.test(row) && /ungrounded-clause|no supplied fact/.test(row)),
    wrongOrigin.failures.find((row) => /Mickleover/.test(row)) || wrongOrigin.failures[0] || "none",
  );

  const whichClause = validateAiLocalCopyPilotV3(
    baseCopy(
      "Consultations take place at Brook Pharmacy Demo Derby in Derby, which is approximately 4.1 km in a straight line from Allestree, measured from the recorded area reference point.",
    ),
    input,
    facts,
  );
  record(
    "which-clause-distance-with-reference-point-still-fails",
    whichClause.ok === false &&
      whichClause.failures.some((row) => /relationshipToPharmacy/.test(row) && /ungrounded-clause/.test(row)),
    whichClause.failures.find((row) => /ungrounded-clause/.test(row)) || whichClause.failures[0] || "none",
  );

  const saved1 = JSON.parse(attempt1Before) as { rawResponse: string };
  const saved2 = JSON.parse(attempt2Before) as { rawResponse: string };
  const parsedSaved1 = parseAiLocalCopyV3(saved1.rawResponse);
  const parsedSaved2 = parseAiLocalCopyV3(saved2.rawResponse);
  record(
    "saved-invalid-copy-still-rejected",
    parsedSaved1.ok &&
      parsedSaved2.ok &&
      /without unnecessary delay/.test(saved1.rawResponse) &&
      /another NHS option/.test(saved2.rawResponse) &&
      parsedSaved1.ok &&
      parsedSaved2.ok &&
      validateAiLocalCopyPilotV3(parsedSaved1.copy, input, facts).ok === false &&
      validateAiLocalCopyPilotV3(parsedSaved2.copy, input, facts).ok === false,
    "delay and another-NHS-option drafts remain rejected; 4.3 km is still a wrong number on the live 4.1 km evidence",
  );

  const attempt1After = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_1), "utf8");
  const attempt2After = fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, ATTEMPT_2), "utf8");
  const budgetAfter = readJson<{ consumed: number; estimatedCostUsd: number; maxProviderCalls: number }>(BUDGET);
  record(
    "attempts-costs-and-candidate-untouched",
    attempt1After === attempt1Before &&
      attempt2After === attempt2Before &&
      !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CANDIDATE)) &&
      budgetAfter.consumed === budgetBefore.consumed &&
      budgetAfter.maxProviderCalls === budgetBefore.maxProviderCalls &&
      Math.abs(budgetAfter.estimatedCostUsd - budgetBefore.estimatedCostUsd) < 0.000001 &&
      budgetAfter.consumed === budgetBefore.consumed,
    `consumed=${budgetAfter.consumed}/${budgetAfter.maxProviderCalls} cost=${budgetAfter.estimatedCostUsd}`,
  );

  const failed = checks.filter((row) => !row.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  if (failed) process.exitCode = 1;
}

main();
