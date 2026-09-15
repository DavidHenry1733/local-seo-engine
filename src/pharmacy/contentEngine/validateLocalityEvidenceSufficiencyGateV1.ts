#!/usr/bin/env npx tsx
/**
 * Isolated validation — locality evidence-sufficiency gate.
 * Does not approve, publish, index, regenerate, or rewrite Yorkshire V9 content.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validateLocalityEvidenceSufficiencyGateV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  LOCALITY_EVIDENCE_SUFFICIENCY_GATE_ID,
  LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS,
  evaluateLocalityEvidenceSufficiencyForArea,
  evaluateLocalityEvidenceSufficiencyForCampaignAreas,
  evaluateLocalityEvidenceSufficiencyGate,
  type LocalityEvidenceSufficiencyInput,
} from "./pharmacyLocalityEvidenceSufficiencyGateV1.ts";
import {
  composeEvidenceLedLocalityPassagesV1,
  isNamedUkCivicCentrePlace,
  isUsefulOrientationName,
} from "./pharmacyEvidenceLedLocalNarrativeV1.ts";
import { evaluateLocalityPatientCopyQualityGate } from "./pharmacyLocalityPatientCopyQualityGateV1.ts";
import { evaluateLocalityHtmlDuplicationGate } from "../pharmacyLocalityPageDuplicationGateV1.ts";
import type { NamedLocalityFact, VerifiedLocalityEvidence } from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE_V9_AREAS = [
  { areaName: "Darfield", areaSlug: "darfield" },
  { areaName: "Wombwell", areaSlug: "wombwell" },
  { areaName: "Worsbrough", areaSlug: "worsbrough" },
  { areaName: "Thurnscoe", areaSlug: "thurnscoe" },
  { areaName: "Grimethorpe", areaSlug: "grimethorpe" },
  { areaName: "Goldthorpe", areaSlug: "goldthorpe" },
  { areaName: "Hoyland", areaSlug: "hoyland" },
  { areaName: "Cudworth", areaSlug: "cudworth" },
  { areaName: "Royston", areaSlug: "royston" },
  { areaName: "Chapeltown", areaSlug: "chapeltown" },
] as const;

const GENERIC_FILLER = [
  "Pharmacy First can help with eligible common conditions without a routine GP appointment first.",
  "This established residential area is well connected and convenient for local residents.",
  "Patients in the locality rely on nearby healthcare facilities and community services.",
  "The neighbourhood offers a range of amenities and excellent access to the wider district.",
].join(" ");

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function named(name: string): NamedLocalityFact {
  return { name, provenance: "test-fixture" };
}

function snapshotProtectedYorkshireFiles(): Map<string, string> {
  const out = new Map<string, string>();
  const roots = [
    path.join(ROOT, "output/pharmacy-ai-local-page-pilots", YORKSHIRE, SERVICE, "v9"),
    path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", YORKSHIRE, SERVICE, "v9"),
    path.join(ROOT, "data/pharmacy-local-relevance-packs", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", YORKSHIRE, SERVICE, "v3"),
    path.join(ROOT, "data/pharmacy-local-page-campaign-runs", YORKSHIRE),
    path.join(ROOT, "data/pharmacy-indexing", `${YORKSHIRE}.json`),
    path.join(ROOT, "data/pharmacy-campaign-launch-queue", `${YORKSHIRE}.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`),
    path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`),
  ];
  const add = (file: string) => {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) out.set(file, hashFile(file));
  };
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    if (fs.statSync(dir).isFile()) {
      add(dir);
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) add(full);
    }
  };
  for (const root of roots) walk(root);
  return out;
}

function copyState(areaSlug: string): { approved: boolean; reviewStatus: string; generatedAt: string } {
  const file = path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", YORKSHIRE, SERVICE, "v9", `${areaSlug}.json`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    approved?: boolean;
    reviewStatus?: string;
    generatedAt?: string;
  };
  return {
    approved: Boolean(raw.approved),
    reviewStatus: String(raw.reviewStatus || ""),
    generatedAt: String(raw.generatedAt || ""),
  };
}

const richInput: LocalityEvidenceSufficiencyInput = {
  areaName: "Darfield",
  areaSlug: "darfield",
  pharmacyAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
  healthcare: [named("Garland House Surgery")],
  landmarks: [named("Darfield Library")],
  community: [named("Darfield History Society")],
  nearbyLocalities: [{ areaName: "Wombwell", geographic: true }],
  distanceKm: 0.2,
  distanceLabel: "less than 1 km",
  editorialFacts: [
    {
      category: "area-identity",
      validationStatus: "accepted",
      permittedCopyRole: "area-introduction",
      normalizedStatement: "Darfield is a village in the Metropolitan Borough of Barnsley.",
    },
  ],
};

const acceptableInput: LocalityEvidenceSufficiencyInput = {
  areaName: "Chapeltown",
  areaSlug: "chapeltown",
  pharmacyAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
  healthcare: [named("Chapeltown Surgery")],
  nearbyLocalities: [{ areaName: "Hoyland", geographic: true }],
  distanceKm: 14.2,
  distanceLabel: "about 14.2 km",
};

const sparseInput: LocalityEvidenceSufficiencyInput = {
  areaName: "Hoyland",
  areaSlug: "hoyland",
  pharmacyAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
  healthcare: [named("Medical Centre"), named("Yellowstone Walk-In Clinic"), named("Walk-In Clinic")],
  transport: [named("Hoyland Road/Stoney Croft")],
  nearbyLocalities: [{ areaName: "Wombwell", geographic: true }],
  distanceKm: 5.9,
  distanceLabel: "about 5.9 km",
  editorialFacts: [
    {
      category: "healthcare",
      validationStatus: "rejected",
      normalizedStatement: "Hoyland has a major hospital serving the wider borough.",
    },
  ],
  renderedCopy: GENERIC_FILLER,
  genericFiller: GENERIC_FILLER,
};

const coastalRichInput: LocalityEvidenceSufficiencyInput = {
  areaName: "Salcombe",
  areaSlug: "salcombe",
  pharmacyAddress: "12 Fore Street, Kingsbridge, Devon, UK",
  healthcare: [named("Salcombe Health Centre")],
  landmarks: [named("Salcombe Library")],
  transport: [named("Kingsbridge Bus Station")],
  nearbyLocalities: [{ areaName: "Kingsbridge", geographic: true }],
  distanceKm: 6.1,
  distanceLabel: "about 6.1 km",
  editorialFacts: [
    {
      category: "area-identity",
      validationStatus: "accepted",
      normalizedStatement: "Salcombe is a coastal town in the South Hams district of Devon.",
    },
  ],
};

const before = snapshotProtectedYorkshireFiles();
const beforeCopy = Object.fromEntries(YORKSHIRE_V9_AREAS.map((area) => [area.areaSlug, copyState(area.areaSlug)]));

const rich = evaluateLocalityEvidenceSufficiencyGate(richInput);
record(
  "rich-locality-passes",
  rich.classification === "rich" && rich.reviewReady && rich.publishable,
  `${rich.classification} reviewReady=${rich.reviewReady} cats=${rich.categoriesPresent.join(",")}`,
);
record(
  "rich-has-named-place-and-relationship",
  rich.categoriesPresent.includes("gp-practice") &&
    rich.categoriesPresent.includes("landmark-community") &&
    rich.categoriesPresent.includes("civic-identity") &&
    rich.categoriesPresent.includes("pharmacy-relationship"),
  rich.categoriesPresent.join(","),
);

const acceptable = evaluateLocalityEvidenceSufficiencyGate(acceptableInput);
record(
  "acceptable-locality-passes",
  acceptable.classification === "acceptable" && acceptable.reviewReady && acceptable.publishable,
  `${acceptable.classification} reviewReady=${acceptable.reviewReady} cats=${acceptable.categoriesPresent.join(",")}`,
);

const sparse = evaluateLocalityEvidenceSufficiencyGate(sparseInput);
record(
  "sparse-locality-fails-review-readiness",
  sparse.classification === "insufficient" && !sparse.reviewReady && !sparse.publishable,
  `${sparse.classification} reviewReady=${sparse.reviewReady} cats=${sparse.categoriesPresent.join(",")} missing=${sparse.missingCategoryLabels.join("; ")}`,
);
record(
  "sparse-identifies-missing-categories",
  sparse.missingCategoryLabels.length > 0 &&
    sparse.missingCategoryLabels.some((label) => /civic identity/i.test(label)) &&
    Boolean(sparse.reviewBlockReason),
  sparse.reviewBlockReason || "no block reason",
);

const filler = evaluateLocalityEvidenceSufficiencyGate({
  ...sparseInput,
  renderedCopy: `${GENERIC_FILLER} ${GENERIC_FILLER} Walderslade Surgery Hoyland Medical Centre Cliffe Park Hoyland Leisure Centre.`,
});
record(
  "generic-filler-cannot-increase-sufficiency",
  filler.classification === sparse.classification &&
    filler.categoriesPresent.join(",") === sparse.categoriesPresent.join(",") &&
    filler.reviewReady === sparse.reviewReady,
  `sparse=${sparse.classification} filler=${filler.classification}`,
);

const uniqueOnce = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Darfield",
  areaSlug: "darfield",
  healthcare: [named("Garland House Surgery")],
  landmarks: [named("Darfield Library")],
  nearbyLocalities: [{ areaName: "Wombwell" }],
  distanceKm: 1,
  distanceLabel: "about 1 km",
});
const duplicated = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Darfield",
  areaSlug: "darfield",
  healthcare: [named("Garland House Surgery"), named("Garland House Surgery"), named("GARLAND HOUSE SURGERY")],
  landmarks: [named("Darfield Library"), named("Darfield Library")],
  nearbyLocalities: [{ areaName: "Wombwell" }, { areaName: "Wombwell" }],
  distanceKm: 1,
  distanceLabel: "about 1 km",
});
record(
  "duplicate-evidence-does-not-inflate-score",
  duplicated.classification === uniqueOnce.classification &&
    duplicated.categoriesPresent.join(",") === uniqueOnce.categoriesPresent.join(",") &&
    duplicated.evidenceItems.filter((item) => item.category === "gp-practice").length === 1,
  `unique=${uniqueOnce.classification}/${uniqueOnce.categoriesPresent.length} dup=${duplicated.classification}/${duplicated.categoriesPresent.length} gpItems=${duplicated.evidenceItems.filter((item) => item.category === "gp-practice").length}`,
);

const namedCivicCentre = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Kingstanding",
  areaSlug: "kingstanding",
  pharmacyAddress: "12 High Street, Erdington, Birmingham B23 6SA, UK",
  community: [named("Kingstanding Civic Centre")],
  nearbyLocalities: [{ areaName: "Erdington", geographic: true }],
  distanceKm: 4.2,
  distanceLabel: "about 4.2 km",
});
record(
  "named-locality-civic-centre-accepted",
  isNamedUkCivicCentrePlace("Kingstanding Civic Centre", "Kingstanding") &&
    isUsefulOrientationName("Kingstanding Civic Centre", "Kingstanding") &&
    namedCivicCentre.categoriesPresent.includes("civic-identity") &&
    namedCivicCentre.evidenceItems.some(
      (item) => item.category === "civic-identity" && /Kingstanding Civic Centre/i.test(item.label),
    ) &&
    namedCivicCentre.classification === "acceptable" &&
    namedCivicCentre.reviewReady &&
    namedCivicCentre.placeIdentityCount === 1,
  `class=${namedCivicCentre.classification} cats=${namedCivicCentre.categoriesPresent.join(",")} items=${namedCivicCentre.evidenceItems.map((item) => `${item.category}:${item.label}`).join(" | ")}`,
);

const duplicatedCivicCentre = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Kingstanding",
  areaSlug: "kingstanding",
  pharmacyAddress: "12 High Street, Erdington, Birmingham B23 6SA, UK",
  community: [named("Kingstanding Civic Centre"), named("Kingstanding Civic Centre")],
  landmarks: [named("KINGSTANDING CIVIC CENTRE")],
  nearbyLocalities: [{ areaName: "Erdington", geographic: true }],
  distanceKm: 4.2,
  distanceLabel: "about 4.2 km",
});
record(
  "duplicate-civic-centre-does-not-inflate-score",
  duplicatedCivicCentre.classification === namedCivicCentre.classification &&
    duplicatedCivicCentre.categoriesPresent.join(",") === namedCivicCentre.categoriesPresent.join(",") &&
    duplicatedCivicCentre.evidenceItems.filter((item) => item.category === "civic-identity").length === 1 &&
    !duplicatedCivicCentre.categoriesPresent.includes("landmark-community"),
  `civicItems=${duplicatedCivicCentre.evidenceItems.filter((item) => item.category === "civic-identity").length} cats=${duplicatedCivicCentre.categoriesPresent.join(",")}`,
);

const genericCivicServices = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Kingstanding",
  areaSlug: "kingstanding",
  pharmacyAddress: "12 High Street, Erdington, Birmingham B23 6SA, UK",
  nearbyLocalities: [{ areaName: "Erdington", geographic: true }],
  distanceKm: 4.2,
  distanceLabel: "about 4.2 km",
  editorialFacts: [
    {
      category: "area-identity",
      permittedCopyRole: "area-introduction",
      validationStatus: "accepted",
      normalizedStatement: "Patients in the locality rely on nearby civic services.",
    },
  ],
  genericFiller: "The area has civic amenities and civic facilities for residents.",
});
record(
  "generic-civic-services-prose-rejected",
  !isNamedUkCivicCentrePlace("civic services", "Kingstanding") &&
    !isUsefulOrientationName("civic services", "Kingstanding") &&
    !genericCivicServices.categoriesPresent.includes("civic-identity") &&
    !genericCivicServices.categoriesPresent.includes("landmark-community") &&
    genericCivicServices.classification === "insufficient",
  `cats=${genericCivicServices.categoriesPresent.join(",")}`,
);

const civicPharmacyBusiness = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Kingstanding",
  areaSlug: "kingstanding",
  pharmacyAddress: "12 High Street, Erdington, Birmingham B23 6SA, UK",
  community: [named("Civic Pharmacy"), named("Kingstanding Civic Centre Pharmacy"), named("Civic Centre Ltd")],
  nearbyLocalities: [{ areaName: "Erdington", geographic: true }],
  distanceKm: 4.2,
  distanceLabel: "about 4.2 km",
});
record(
  "pharmacy-or-business-containing-civic-rejected",
  !isNamedUkCivicCentrePlace("Civic Pharmacy", "Kingstanding") &&
    !isNamedUkCivicCentrePlace("Kingstanding Civic Centre Pharmacy", "Kingstanding") &&
    !isNamedUkCivicCentrePlace("Civic Centre Ltd", "Kingstanding") &&
    !civicPharmacyBusiness.categoriesPresent.includes("civic-identity") &&
    !civicPharmacyBusiness.categoriesPresent.includes("landmark-community") &&
    civicPharmacyBusiness.classification === "insufficient",
  `cats=${civicPharmacyBusiness.categoriesPresent.join(",")}`,
);

const unattributableCivicCentre = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Kingstanding",
  areaSlug: "kingstanding",
  pharmacyAddress: "12 High Street, Erdington, Birmingham B23 6SA, UK",
  community: [named("Civic Centre")],
  editorialFacts: [
    {
      category: "community",
      permittedCopyRole: "neutral-community-context",
      validationStatus: "accepted",
      normalizedStatement: "The civic centre offers local services for residents.",
    },
  ],
  nearbyLocalities: [{ areaName: "Erdington", geographic: true }],
  distanceKm: 4.2,
  distanceLabel: "about 4.2 km",
});
record(
  "unattributable-civic-centre-text-rejected",
  !isNamedUkCivicCentrePlace("Civic Centre", "Kingstanding") &&
    !isUsefulOrientationName("Civic Centre", "Kingstanding") &&
    !unattributableCivicCentre.categoriesPresent.includes("civic-identity") &&
    !unattributableCivicCentre.categoriesPresent.includes("landmark-community") &&
    unattributableCivicCentre.classification === "insufficient",
  `cats=${unattributableCivicCentre.categoriesPresent.join(",")}`,
);

const existingOrientationTypes = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Darfield",
  areaSlug: "darfield",
  pharmacyAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
  landmarks: [named("Darfield Library"), named("Cliffe Park")],
  community: [named("Darfield Community Centre")],
  nearbyLocalities: [{ areaName: "Wombwell", geographic: true }],
  distanceKm: 0.2,
  distanceLabel: "less than 1 km",
});
record(
  "library-community-centre-park-rules-unchanged",
  isUsefulOrientationName("Darfield Library", "Darfield") &&
    isUsefulOrientationName("Darfield Community Centre", "Darfield") &&
    isUsefulOrientationName("Cliffe Park", "Darfield") &&
    !isNamedUkCivicCentrePlace("Darfield Library", "Darfield") &&
    !isNamedUkCivicCentrePlace("Darfield Community Centre", "Darfield") &&
    existingOrientationTypes.categoriesPresent.includes("landmark-community") &&
    !existingOrientationTypes.categoriesPresent.includes("civic-identity") &&
    existingOrientationTypes.evidenceItems.some((item) => /Darfield Library/i.test(item.label)) &&
    existingOrientationTypes.evidenceItems.some((item) => /Darfield Community Centre/i.test(item.label)) &&
    existingOrientationTypes.evidenceItems.some((item) => /Cliffe Park/i.test(item.label)),
  `cats=${existingOrientationTypes.categoriesPresent.join(",")} items=${existingOrientationTypes.evidenceItems.map((item) => item.label).join(" | ")}`,
);

const civicCentrePassages = composeEvidenceLedLocalityPassagesV1({
  verified: {
    areaName: "Kingstanding",
    areaSlug: "kingstanding",
    evidenceLimited: false,
    latitude: null,
    longitude: null,
    coordinateProvenance: "",
    distanceKm: 4.2,
    distanceLabel: "about 4.2 km",
    distanceProvenance: "test-fixture",
    cardinalDirection: "north",
    directionProvenance: "",
    landmarks: [],
    healthcare: [],
    community: [named("Kingstanding Civic Centre")],
    transport: [],
    schools: [],
    retail: [],
    nearbyLocalities: [],
    discoveryReason: "",
    discoveryEvidence: [],
    relationship: "",
    pharmacyAddress: "12 High Street, Erdington, Birmingham B23 6SA, UK",
    sectionEvidence: {},
  } as VerifiedLocalityEvidence,
  pharmacyName: "Example Pharmacy",
  serviceName: "Pharmacy First",
  displayPhone: "0121 000 0000",
  address: "12 High Street, Erdington, Birmingham B23 6SA, UK",
  areaIndex: 0,
});
record(
  "compose-consumes-named-civic-centre",
  civicCentrePassages.mentionedEntities.some((item) => /Kingstanding Civic Centre/i.test(item.name)) &&
    /Kingstanding Civic Centre/i.test(civicCentrePassages.localContextBody),
  `mentioned=${civicCentrePassages.mentionedEntities.map((item) => item.name).join(" | ") || "(none)"}`,
);

const unsupportedHay = JSON.stringify(sparse.evidenceItems).toLowerCase();
record(
  "unsupported-facts-cannot-count-as-evidence",
  !/yellowstone/.test(unsupportedHay) &&
    !/walk-in clinic/.test(unsupportedHay) &&
    !/major hospital/.test(unsupportedHay) &&
    !sparse.categoriesPresent.includes("gp-practice") &&
    !sparse.categoriesPresent.includes("healthcare-facility"),
  `items=${sparse.evidenceItems.map((item) => item.label).join(" | ") || "(none beyond relationship/nearby)"}`,
);

const pharmacyAddressCivic = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Hoyland",
  areaSlug: "hoyland",
  pharmacyAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
  nearbyLocalities: [{ areaName: "Wombwell" }],
  distanceKm: 5.9,
  distanceLabel: "about 5.9 km",
  editorialFacts: [
    {
      category: "area-identity",
      permittedCopyRole: "area-introduction",
      validationStatus: "accepted",
      normalizedStatement:
        "The pharmacy is in Hoyland at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK.",
    },
  ],
});
record(
  "pharmacy-address-does-not-count-as-civic",
  !pharmacyAddressCivic.categoriesPresent.includes("civic-identity") &&
    pharmacyAddressCivic.categoriesPresent.includes("pharmacy-relationship") &&
    !pharmacyAddressCivic.categoriesPresent.includes("transport-access"),
  `cats=${pharmacyAddressCivic.categoriesPresent.join(",")}`,
);

const distanceNotTransport = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Hoyland",
  areaSlug: "hoyland",
  pharmacyAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
  transport: [named("about 5.9 km"), named("91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK")],
  nearbyLocalities: [{ areaName: "Wombwell" }],
  distanceKm: 5.9,
  distanceLabel: "about 5.9 km",
  editorialFacts: [
    {
      category: "access-transport",
      permittedCopyRole: "access-context",
      validationStatus: "accepted",
      normalizedStatement: "The pharmacy is approximately 5.9 km in a straight line from Hoyland.",
    },
  ],
});
record(
  "distance-and-address-do-not-count-as-transport",
  !distanceNotTransport.categoriesPresent.includes("transport-access") &&
    distanceNotTransport.categoriesPresent.includes("pharmacy-relationship") &&
    distanceNotTransport.classification === "insufficient",
  `cats=${distanceNotTransport.categoriesPresent.join(",")}`,
);

const sameNameTwoBuckets = evaluateLocalityEvidenceSufficiencyGate({
  areaName: "Chapeltown",
  areaSlug: "chapeltown",
  healthcare: [named("Chapeltown Surgery")],
  landmarks: [named("Chapeltown Surgery")],
  nearbyLocalities: [{ areaName: "Hoyland" }],
  distanceKm: 9.8,
  distanceLabel: "about 9.8 km",
});
record(
  "one-fact-cannot-inflate-multiple-categories",
  sameNameTwoBuckets.categoriesPresent.includes("gp-practice") &&
    !sameNameTwoBuckets.categoriesPresent.includes("landmark-community") &&
    sameNameTwoBuckets.evidenceItems.filter((item) => /chapeltown surgery/i.test(item.label)).length === 1,
  `cats=${sameNameTwoBuckets.categoriesPresent.join(",")}`,
);

record(
  "thresholds-are-exported-and-generic",
  LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS.minCategoriesForAcceptable === 2 &&
    LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS.minPlaceIdentityForAcceptable === 1 &&
    LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS.minCategoriesForRich === 4 &&
    LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS.minPlaceIdentityForRich === 2,
  JSON.stringify(LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS),
);

const miningVillage = evaluateLocalityEvidenceSufficiencyGate(acceptableInput);
const coastalTown = evaluateLocalityEvidenceSufficiencyGate(coastalRichInput);
record(
  "same-gate-for-different-uk-locality-types",
  miningVillage.gateId === LOCALITY_EVIDENCE_SUFFICIENCY_GATE_ID &&
    coastalTown.gateId === LOCALITY_EVIDENCE_SUFFICIENCY_GATE_ID &&
    miningVillage.classification === "acceptable" &&
    coastalTown.classification === "rich" &&
    miningVillage.reviewReady &&
    coastalTown.reviewReady,
  `suburb=${miningVillage.classification} coastal=${coastalTown.classification}`,
);

const brookAllestree = evaluateLocalityEvidenceSufficiencyForArea({
  slug: BROOK,
  serviceId: SERVICE,
  areaName: "Allestree",
  areaSlug: "allestree",
});
record(
  "same-gate-for-different-pharmacy-tenants",
  brookAllestree.gateId === LOCALITY_EVIDENCE_SUFFICIENCY_GATE_ID &&
    ["rich", "acceptable", "insufficient"].includes(brookAllestree.classification) &&
    Array.isArray(brookAllestree.categoriesPresent) &&
    Array.isArray(brookAllestree.categoriesMissing),
  `brook Allestree=${brookAllestree.classification} cats=${brookAllestree.categoriesPresent.join(",") || "(none)"}`,
);

const uniqueness = evaluateLocalityHtmlDuplicationGate({
  pages: [
    {
      areaSlug: "darfield",
      areaName: "Darfield",
      html: "<main><p>Patients in Darfield can use Pharmacy First. Darfield is about 1 km from the pharmacy.</p><p>Call for directions from Darfield.</p></main>",
    },
    {
      areaSlug: "wombwell",
      areaName: "Wombwell",
      html: "<main><p>Patients in Wombwell can use Pharmacy First. Wombwell is about 3 km from the pharmacy.</p><p>Call for directions from Wombwell.</p></main>",
    },
  ],
  pharmacyName: "Yorkshire Pharmacy & Health Clinic",
});
record("uniqueness-gate-unchanged", uniqueness.ok === false, uniqueness.message);

const unsupportedCopy = evaluateLocalityPatientCopyQualityGate({
  html: "<main><p>Walk-ins welcome in Darfield. Parking is available.</p></main>",
  areaName: "Darfield",
  pharmacyName: "Yorkshire Pharmacy & Health Clinic",
});
record(
  "unsupported-claim-gate-unchanged",
  unsupportedCopy.ok === false &&
    unsupportedCopy.failures.some((row) => row.includes("unsupported-claim") || row.includes("walk-in")),
  unsupportedCopy.failures.join("; "),
);

const reviewSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineReviewCentreService.ts"), "utf8");
const publishSrc = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/pharmacyCurrentRunApprovedCandidatePublishAdapter.ts"),
  "utf8",
);
const uniquenessSrc = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/pharmacyLocalityPageDuplicationGateV1.ts"),
  "utf8",
);
const patientCopySrc = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts"),
  "utf8",
);
const gateSrc = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/contentEngine/pharmacyLocalityEvidenceSufficiencyGateV1.ts"),
  "utf8",
);
const narrativeSrc = fs.readFileSync(
  path.join(ROOT, "src/pharmacy/contentEngine/pharmacyEvidenceLedLocalNarrativeV1.ts"),
  "utf8",
);
record(
  "review-readiness-wires-sufficiency-gate",
  /evaluateLocalityEvidenceSufficiencyForCampaignAreas/.test(reviewSrc) &&
    /sufficiency\?\.reviewReady/.test(reviewSrc) &&
    /assertLocalityEvidenceSufficiencyAllowsApproval/.test(reviewSrc) &&
    /evaluateLocalityEvidenceSufficiencyForCampaignAreas/.test(publishSrc) &&
    /evidence\?\.publishable/.test(publishSrc),
  "Review Centre consumes reviewReady; publishing consumes publishable from the same evaluator",
);
record(
  "single-evaluator-and-shared-bind",
  (gateSrc.match(/export function evaluateLocalityEvidenceSufficiencyGate/g) || []).length === 1 &&
    (gateSrc.match(/bindVerifiedLocalityEvidenceV1/g) || []).length === 2 &&
    !/evaluateLocalityEvidenceSufficiencyGate\(/.test(reviewSrc) &&
    !/evaluateLocalityEvidenceSufficiencyGate\(/.test(publishSrc) &&
    !/bindVerifiedLocalityEvidenceV1/.test(reviewSrc) &&
    !/bindVerifiedLocalityEvidenceV1/.test(publishSrc),
  "Review Centre and publishing call the shared campaign evaluator rather than scoring locally",
);
record(
  "no-yorkshire-specific-rules",
  !/yorkshire|hoyland|darfield|wombwell|grimethorpe|barnsley/i.test(gateSrc),
  "Sufficiency evaluator has no tenant or Yorkshire locality branches",
);
record(
  "civic-centre-rule-is-generic-not-tenant-specific",
  /isNamedUkCivicCentrePlace/.test(gateSrc) &&
    /isNamedUkCivicCentrePlace/.test(narrativeSrc) &&
    !/braunstone|vision-pharmacy|oadby|kingstanding/i.test(gateSrc) &&
    !/braunstone|vision-pharmacy|oadby|kingstanding/i.test(narrativeSrc),
  "Civic Centre recognition is a named UK place-type helper, not a tenant or locality exception",
);
record(
  "uniqueness-and-unsupported-gates-not-modified-by-sufficiency",
  !/evaluateLocalityEvidenceSufficiency/.test(uniquenessSrc) &&
    !/evaluateLocalityEvidenceSufficiency/.test(patientCopySrc),
  "Existing uniqueness and unsupported-claim modules stay independent",
);

console.log("\n--- Exact thresholds ---");
console.log(
  JSON.stringify(
    {
      ...LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS,
      placeIdentityCategories: ["civic-identity", "gp-practice", "healthcare-facility", "landmark-community"],
    },
    null,
    2,
  ),
);

console.log("\n--- Yorkshire V9 locality evidence-sufficiency report (read-only) ---");
const yorkshireResults = evaluateLocalityEvidenceSufficiencyForCampaignAreas({
  slug: YORKSHIRE,
  serviceId: SERVICE,
  areas: YORKSHIRE_V9_AREAS.map((area) => ({ areaName: area.areaName, areaSlug: area.areaSlug })),
});
const reviewReady: string[] = [];
const needsEvidence: string[] = [];
console.log(
  [
    "Locality".padEnd(12),
    "Categories".padEnd(72),
    "Count".padEnd(6),
    "Class".padEnd(14),
    "Review-ready".padEnd(14),
    "If insufficient",
  ].join(" | "),
);
for (const area of YORKSHIRE_V9_AREAS) {
  const result = yorkshireResults.get(area.areaSlug);
  if (!result) {
    record(`yorkshire-${area.areaSlug}-evaluated`, false, "gate returned no result");
    continue;
  }
  const cats = result.categoriesPresent.join(", ") || "(none)";
  const items = result.evidenceItems.map((item) => `${item.category}:${item.label}`).join(" | ");
  const missing = result.reviewReady ? "" : result.missingCategoryLabels.join("; ");
  console.log(
    [
      area.areaName.padEnd(12),
      cats.padEnd(72),
      String(result.categoryCount).padEnd(6),
      result.classification.toUpperCase().padEnd(14),
      (result.reviewReady ? "YES" : "NO").padEnd(14),
      missing,
    ].join(" | "),
  );
  if (items) console.log(`  evidence: ${items}`);
  if (result.reviewReady) reviewReady.push(area.areaName);
  else needsEvidence.push(area.areaName);
  record(
    `yorkshire-${area.areaSlug}-classified`,
    ["rich", "acceptable", "insufficient"].includes(result.classification) &&
      result.categoryCount === result.categoriesPresent.length,
    `${result.classification} count=${result.categoryCount} cats=${cats}`,
  );
}

console.log(`\nWould be review-ready: ${reviewReady.join(", ") || "(none)"}`);
console.log(`Need further evidence collection: ${needsEvidence.join(", ") || "(none)"}`);

const after = snapshotProtectedYorkshireFiles();
const changed = [...before.keys()].filter((file) => before.get(file) !== after.get(file));
const added = [...after.keys()].filter((file) => !before.has(file));
const changedOf = (needle: string) =>
  [...changed, ...added].filter((file) => file.includes(needle)).map((file) => path.relative(ROOT, file));

record(
  "yorkshire-v9-html-unchanged",
  changedOf("output/pharmacy-ai-local-page-pilots").length === 0,
  changedOf("output/pharmacy-ai-local-page-pilots").join(", ") || "V9 HTML unchanged",
);
record(
  "yorkshire-v9-candidate-json-unchanged",
  changedOf("data/pharmacy-ai-local-copy-pilots").length === 0,
  changedOf("data/pharmacy-ai-local-copy-pilots").join(", ") || "V9 candidate JSON unchanged",
);

let copyUnchanged = true;
for (const area of YORKSHIRE_V9_AREAS) {
  const now = copyState(area.areaSlug);
  const prev = beforeCopy[area.areaSlug]!;
  if (now.approved !== prev.approved || now.reviewStatus !== prev.reviewStatus || now.generatedAt !== prev.generatedAt) {
    copyUnchanged = false;
  }
  if (now.approved || now.reviewStatus !== "candidate") copyUnchanged = false;
}
record(
  "approval-state-unchanged",
  copyUnchanged && changedOf(`${YORKSHIRE}-campaign-builder.json`).length === 0 && changedOf(`${YORKSHIRE}-review-centre.json`).length === 0,
  "Copy records remain candidate/unapproved; campaign-builder and review-centre sessions unchanged",
);
record(
  "publishing-state-unchanged",
  changedOf("pharmacy-local-page-campaign-runs").length === 0 && changedOf("pharmacy-campaign-launch-queue").length === 0,
  "Campaign-run and launch-queue publish flags unchanged",
);
record(
  "indexing-state-unchanged",
  changedOf("pharmacy-indexing").length === 0,
  "Indexing records unchanged",
);
record(
  "no-other-protected-writes",
  changed.length === 0 && added.length === 0,
  changed.length || added.length ? `changed=${changed.length} added=${added.length}` : "no protected file writes",
);

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) {
  console.error(failed.map((c) => `FAIL ${c.id}: ${c.detail}`).join("\n"));
  process.exit(1);
}

void PHARMACY_WORKSPACE_ROOT;
