/**
 * “recorded as” must stay banned for evidence listings and allowed for
 * approved clinical measurement wording.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { evaluateAcceptedGeminiLocalCopyV1 } = require("../src/pharmacy/contentEngine/pharmacyGroundedGeminiLocalCopyValidationV1.ts");

const approved =
  "A pharmacy blood pressure check measures your reading, explains it in plain language, and helps you understand sensible next steps. Blood pressure is recorded as systolic over diastolic (mmHg).";

function words(count: number, label: string): string {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(`${label}${i}`);
  return out.join(" ");
}

function copyWith(sentence: string) {
  const hero = `Northbridge Pharmacy provides Blood Pressure Checks for people in Alderton who want a plain language explanation of a reading. ${words(18, "hero")}`;
  const local = [
    `${sentence} ${words(40, "locala")}`,
    `People in Alderton can speak to Northbridge Pharmacy about Blood Pressure Checks before a routine review. ${words(40, "localb")}`,
    `The check stays at the pharmacy and the result is explained in ordinary words. ${words(40, "localc")}`,
  ].join("\n\n");
  return {
    copy: {
      heroIntroduction: hero,
      localIntroduction: local,
      area: "Alderton",
      editorialFactIdsUsed: [],
    },
    input: {
      tenantSlug: "northbridge-pharmacy",
      business: { name: "Northbridge Pharmacy", telephone: "", website: "", address: "", coordinates: null, marketTown: "" },
      offer: {
        serviceName: "Blood Pressure Checks",
        serviceId: "blood-pressure-checks",
        lockedClinicalFacts: {
          serviceName: "Blood Pressure Checks",
          serviceId: "blood-pressure-checks",
          conditionSet: approved,
          suitability: "Individual assessment confirms whether a pharmacy check is appropriate.",
          process: "A routine check covers measurement and a plain-language discussion.",
          safety: "One reading does not diagnose hypertension.",
          allowedCta: ["Contact the pharmacy"],
        },
        allowedCta: ["Contact the pharmacy"],
      },
      locality: {
        areaName: "Alderton",
        areaSlug: "alderton",
        distanceLabel: "",
        distanceKm: null,
        cardinalDirection: "",
        pharmacyIsInArea: false,
        neighbouringSelectedAreas: [],
        evidenceLimitations: [],
        acceptedEntities: [],
      },
    },
  };
}

function listingFailures(sentence: string): string[] {
  const built = copyWith(sentence);
  const result = evaluateAcceptedGeminiLocalCopyV1({
    copy: built.copy,
    input: built.input,
    grounding: null,
    expectedSlug: "northbridge-pharmacy",
    expectedServiceId: "blood-pressure-checks",
    expectedAreaName: "Alderton",
  });
  return result.failures.filter(
    (failure: string) =>
      failure === "evidence IDs or source-listing language" || failure === "banned legacy phrase present",
  );
}

const steps: Array<{ name: string; passed: boolean; detail?: string }> = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const clinical = "Blood pressure is recorded as systolic over diastolic (mmHg).";
check("clinical recorded-as passes", listingFailures(clinical).length === 0, listingFailures(clinical).join("; "));
check(
  "clinical measurement wording passes",
  listingFailures("A reading is recorded as systolic and diastolic in mmHg.").length === 0,
);
check(
  "approved service recorded-as passes",
  listingFailures(approved).length === 0,
  listingFailures(approved).join("; "),
);

const mustFail = [
  "Anchor Mill Medical Practice is recorded as a healthcare location.",
  "William Wallace Monument is recorded as a landmark.",
  "This place is recorded as verified evidence.",
  "The source records this location as healthcare evidence.",
  "The pack cites fact-ab12cd for this place.",
  "The library is listed as a community facility.",
  "See the evidence pack for this place.",
];
for (const sentence of mustFail) {
  const failures = listingFailures(sentence);
  check(`rejects ${sentence}`, failures.length > 0, failures.join("; ") || "no listing failure");
}

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
if (failed.length) process.exit(1);
