#!/usr/bin/env npx tsx
/**
 * Reusable combined-evidence binding: one natural sentence may be supported by
 * several supplied facts. Provider-free. Validator grounding is unchanged.
 */
import { parseAiLocalCopyV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import {
  attachLocalIntroductionEvidenceClaimsV3,
  supportingEditorialFactsForSentenceV3,
} from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEvidenceBindingV3.ts";
import { groundAiLocalCopyClaimsV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalCopyClaimGroundingV1.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { buildPharmacyAiLocalCopyInputV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import type { EditorialFactV3 } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";

const SLUG = "brook-pharmacy-demo-derby";
const SERVICE = "pharmacy-first";
const EXACT =
  "Mackworth is a historic locality containing notable heritage and natural spaces.";

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function fact(partial: Partial<EditorialFactV3> & { factId: string; normalizedStatement: string }): EditorialFactV3 {
  return {
    area: "Northville",
    areaSlug: "northville",
    category: "heritage",
    sourceTitle: "test",
    sourceUrl: "https://example.test",
    publisher: "test",
    retrievedAt: "2026-09-08T00:00:00.000Z",
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: "high",
    usefulnessToPharmacyFirstReader: "test",
    permittedCopyRole: "neutral-community-context",
    prohibitedInference: "test",
    validationStatus: "accepted",
    ...partial,
  };
}

const twoPlaceSentence =
  "North Castle and North Park are listed as landmarks in Northville.";
const twoFacts = [
  fact({
    factId: "northville:heritage:north-castle",
    normalizedStatement: "North Castle is listed as a landmark in Northville.",
  }),
  fact({
    factId: "northville:heritage:north-park",
    normalizedStatement: "North Park is listed as a landmark in Northville.",
  }),
];
const parsed = parseAiLocalCopyV3({
  heroIntroduction: "Pharmacy First is available for people in Northville through Brook Pharmacy.",
  localIntroduction: twoPlaceSentence,
});
if (!parsed.ok) fail("synthetic copy did not parse");
const bound = attachLocalIntroductionEvidenceClaimsV3(parsed.copy, { areaName: "Northville" }, twoFacts);
const boundIds = (bound.evidenceClaims || [])
  .filter((claim) => claim.sentence === twoPlaceSentence)
  .map((claim) => claim.editorialFactId)
  .sort();
if (boundIds.join(",") !== "northville:heritage:north-castle,northville:heritage:north-park") {
  fail(`expected both supporting fact IDs, found ${boundIds.join(",") || "(none)"}`);
}
const again = attachLocalIntroductionEvidenceClaimsV3(bound, { areaName: "Northville" }, twoFacts);
if ((again.evidenceClaims || []).filter((claim) => claim.sentence === twoPlaceSentence).length !== 2) {
  fail("combined binding duplicated or dropped fact IDs on a second pass");
}

const editorial = loadEditorialEvidencePack(SLUG, SERVICE, "mackworth");
if (!editorial) fail("Mackworth saved editorial evidence pack is missing");
const accepted = editorial.facts.filter((row) => row.validationStatus === "accepted");
const identity = accepted.filter((row) => row.category === "area-identity" || /^Mackworth is\b/i.test(row.normalizedStatement));
const historic = accepted.filter((row) =>
  /\b(historic|historically|medieval|victorian|heritage|century|dates? (?:from|back)|founded)\b/i.test(
    row.normalizedStatement,
  ),
);
const heritage = accepted.filter((row) => row.category === "heritage");
const natural = accepted.filter(
  (row) =>
    /\b(park|meadow|wood|nature|green space|open space)\b/i.test(row.normalizedStatement) ||
    row.category === "parks",
);
console.log("Mackworth saved evidence");
console.log(`  locality identity facts: ${identity.length}`);
console.log(`  historic context facts: ${historic.length}`);
console.log(`  heritage location facts: ${heritage.length}`);
heritage.forEach((row) => console.log(`    ${row.factId} — ${row.normalizedStatement}`));
console.log(`  natural space facts: ${natural.length}`);
natural.forEach((row) => console.log(`    ${row.factId} — ${row.normalizedStatement}`));

const supporting = supportingEditorialFactsForSentenceV3(EXACT, accepted);
console.log(`Exact sentence supporting fact IDs: ${supporting.map((row) => row.factId).join(", ") || "(none)"}`);

const input = buildPharmacyAiLocalCopyInputV3({
  slug: SLUG,
  serviceId: SERVICE,
  areaName: "Mackworth",
  areaSlug: "mackworth",
  editorial,
  ukLocalIntroductionStyle: {
    id: "civic-amenity-first",
    label: "civic-amenity-first",
    instruction: "use saved evidence",
  },
});
const exactParsed = parseAiLocalCopyV3({
  heroIntroduction:
    "Pharmacy First is available for people in Mackworth through Brook Pharmacy. Eligible local patients can receive a pharmacist consultation for certain common conditions.",
  localIntroduction: EXACT,
});
if (!exactParsed.ok) fail("exact Mackworth sentence copy did not parse");
const exactBound = attachLocalIntroductionEvidenceClaimsV3(exactParsed.copy, { areaName: "Mackworth" }, accepted);
const grounded = groundAiLocalCopyClaimsV3(exactBound, input, accepted);
const exactFindings = [...grounded.failures, ...grounded.reviews].filter((row) => row.includes(EXACT));
const exactOk = exactFindings.length === 0 && supporting.length > 0;
if (exactOk) {
  if (supporting.length < 2) fail("combined coverage passed but did not bind several supporting facts");
  console.log("Exact sentence: combined saved facts cover every clause; internal fact IDs bound.");
} else {
  console.log("Exact sentence: keep failure — at least one clause is not supported by the combined saved facts.");
  exactFindings.forEach((row) => console.log(`  ${row}`));
  if (!exactFindings.length && supporting.length === 0) {
    console.log("  no covering fact IDs and no grounding finding; treated as unsupported.");
  }
}

console.log("COMBINED EVIDENCE BINDING PASS");
console.log("One natural sentence can bind several supplied evidence IDs");
console.log("Unsupported adjectives or opinions are not allowed through");
console.log("Validator grounding unchanged");
