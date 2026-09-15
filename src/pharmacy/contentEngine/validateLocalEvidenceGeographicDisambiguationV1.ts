#!/usr/bin/env npx tsx
/**
 * Isolated validation — geographic and category attribution (ticket 89).
 * Does not call Google. Does not regenerate live tenant pages.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validateLocalEvidenceGeographicDisambiguationV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  attributeEntityToArea,
  buildEvidencePackFromAttributedEntities,
  classifyRequestedEvidenceCategory,
  emptyEvidencePack,
  localEvidencePackPath,
  planPharmacyLocalEvidenceRequest,
  preflightPharmacyLocalEvidenceForCampaign,
  validatePharmacyLocalEvidencePack,
  writePharmacyLocalEvidencePack,
  type PharmacyEvidenceCoordinates,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  buildDisambiguatedEvidenceQuery,
  resolveGeographicEvidenceContext,
  type GeographicEvidenceContext,
} from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const TEST_SLUG = "validation-local-evidence-geo-89";
const UNAFFECTED = ["darfield", "wombwell", "worsbrough", "thurnscoe", "grimethorpe", "hoyland", "cudworth"];
const PHARMACY_COORDS: PharmacyEvidenceCoordinates = {
  latitude: 53.53215660000001,
  longitude: -1.3813046,
  source: "test-fixture",
};

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function snapshotGeneratedOutputs(): Map<string, string> {
  const out = new Map<string, string>();
  const roots = [
    path.join(ROOT, "output/pharmacy-content-ecosystem", YORKSHIRE),
    path.join(ROOT, "output/pharmacy-visual-experience", YORKSHIRE),
  ];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.set(full, hashFile(full));
    }
  };
  for (const root of roots) walk(root);
  return out;
}

function sessionPath(slug: string): string {
  return path.join(ROOT, "data/growth-engine", `${slug}-campaign-builder.json`);
}

function writeTestSession(areas: string[]): void {
  fs.mkdirSync(path.dirname(sessionPath(TEST_SLUG)), { recursive: true });
  fs.writeFileSync(
    sessionPath(TEST_SLUG),
    JSON.stringify(
      {
        version: 1,
        slug: TEST_SLUG,
        selectedServiceId: "pharmacy-first",
        targetAreaMode: "selected",
        targetAreaNames: areas,
        discoveredAreaCandidates: [],
        areaDiscoveryStatus: "idle",
      },
      null,
      2,
    ),
  );
}

function geoCtx(areaName: string, extras: Partial<GeographicEvidenceContext> = {}): GeographicEvidenceContext {
  const siblings = ["Darfield", "Wombwell", "Thurnscoe", "Grimethorpe", "Goldthorpe", "Hoyland", "Cudworth", "Royston", "Chapeltown"];
  return {
    areaName,
    areaSlug: areaName.toLowerCase(),
    siblingAreaNames: extras.siblingAreaNames || siblings,
    areaCentroid: extras.areaCentroid ?? null,
    pharmacyCoordinates: extras.pharmacyCoordinates || PHARMACY_COORDS,
    parentTown: extras.parentTown ?? "Barnsley",
    county: extras.county ?? "South Yorkshire",
    country: extras.country ?? "United Kingdom",
    countryCode: extras.countryCode ?? "GB",
    pharmacyPostcode: extras.pharmacyPostcode ?? "S73 9LR",
    pharmacyPostcodeArea: extras.pharmacyPostcodeArea ?? "S",
    pharmacyPostcodeDistrict: extras.pharmacyPostcodeDistrict ?? "S73",
    pharmacyPostcodeVerified: extras.pharmacyPostcodeVerified ?? true,
    maxDistanceFromPharmacyKm: extras.maxDistanceFromPharmacyKm ?? 16,
    queryPlaceLabel: extras.queryPlaceLabel ?? `${areaName}, Barnsley, South Yorkshire, UK`,
  };
}

const created: string[] = [];
const beforeOutputs = snapshotGeneratedOutputs();
const unaffectedBefore = new Map(
  UNAFFECTED.map((areaSlug) => {
    const file = localEvidencePackPath(YORKSHIRE, areaSlug);
    return [file, fs.existsSync(file) ? hashFile(file) : "missing"] as const;
  }),
);

try {
  const herts = attributeEntityToArea(
    {
      name: "Royston Health Centre",
      address: "Melbourn St, Royston SG8 7BS, UK",
      types: ["medical_clinic", "doctor", "health"],
      location: { latitude: 52.0487, longitude: -0.0206 },
    },
    geoCtx("Royston"),
  );
  record(
    "1-royston-hertfordshire-rejected",
    herts.ok === false,
    herts.ok ? "accepted" : herts.rejectionReason,
  );

  const georgia = attributeEntityToArea(
    {
      name: "Victoria Bryant State Park",
      address: "1105 Bryant Park Rd, Royston, GA 30662, USA",
      types: ["park", "tourist_attraction"],
      location: { latitude: 34.302, longitude: -83.109 },
    },
    geoCtx("Royston"),
  );
  record(
    "2-royston-georgia-rejected",
    georgia.ok === false,
    georgia.ok ? "accepted" : georgia.rejectionReason,
  );

  const barnsleyRoyston = attributeEntityToArea(
    {
      name: "Royston Health Centre",
      address: "Midland Road, Royston, Barnsley S71 4QW, UK",
      types: ["doctor", "health"],
      location: { latitude: 53.598, longitude: -1.45 },
    },
    geoCtx("Royston"),
  );
  record(
    "3-royston-barnsley-accepted",
    barnsleyRoyston.ok === true,
    barnsleyRoyston.ok ? barnsleyRoyston.relationship : barnsleyRoyston.rejectionReason,
  );

  const leeds = attributeEntityToArea(
    {
      name: "Chapeltown Health Centre",
      address: "Spencer Place, Chapeltown, Leeds LS7 4BB, UK",
      types: ["medical_clinic", "health"],
      location: { latitude: 53.8114, longitude: -1.53 },
    },
    geoCtx("Chapeltown"),
  );
  record(
    "4-leeds-ls7-rejected-for-chapeltown",
    leeds.ok === false,
    leeds.ok ? "accepted" : leeds.rejectionReason,
  );

  const sheffield = attributeEntityToArea(
    {
      name: "Chapeltown Surgery",
      address: "Chapeltown, Sheffield S35 2PT, UK",
      types: ["doctor", "health"],
      location: { latitude: 53.462, longitude: -1.47 },
    },
    geoCtx("Chapeltown"),
  );
  record(
    "5-sheffield-s35-accepted-for-chapeltown",
    sheffield.ok === true,
    sheffield.ok ? sheffield.relationship : sheffield.rejectionReason,
  );

  const thurnscoeOnly = attributeEntityToArea(
    {
      name: "Hollygreen Practice",
      address: "12 Holly Bush Dr, Thurnscoe, Rotherham S63 0LT, UK",
      types: ["medical_clinic", "health"],
      location: { latitude: 53.545, longitude: -1.309 },
    },
    geoCtx("Goldthorpe"),
  );
  record(
    "6-thurnscoe-only-rejected-for-goldthorpe",
    thurnscoeOnly.ok === false && thurnscoeOnly.rejectionReason === "attributed-to-sibling-area",
    thurnscoeOnly.ok ? "accepted" : thurnscoeOnly.rejectionReason,
  );

  const goldthorpeOk = attributeEntityToArea(
    {
      name: "The Goldthorpe Medical Centre",
      address: "Goldthorpe Grn, Goldthorpe, Rotherham S63 9EH, UK",
      types: ["doctor", "health"],
      location: { latitude: 53.528, longitude: -1.31 },
    },
    geoCtx("Goldthorpe"),
  );
  record(
    "7-goldthorpe-address-accepted",
    goldthorpeOk.ok === true,
    goldthorpeOk.ok ? goldthorpeOk.relationship : goldthorpeOk.rejectionReason,
  );

  const roystonRoadInCudworth = attributeEntityToArea(
    {
      name: "Cherry Dale Primary",
      address: "Royston Rd, Cudworth, Barnsley S72 8AA, UK",
      types: ["primary_school", "school"],
      location: { latitude: 53.5835, longitude: -1.4146 },
    },
    geoCtx("Royston"),
  );
  record(
    "road-name-is-not-locality-attribution",
    roystonRoadInCudworth.ok === false,
    roystonRoadInCudworth.ok ? "accepted" : roystonRoadInCudworth.rejectionReason,
  );

  const numberedRoystonRoad = attributeEntityToArea(
    {
      name: "Royston View Point",
      address: "149 Royston Rd, Cudworth, Barnsley S72 8BW, UK",
      types: ["park"],
      location: { latitude: 53.58, longitude: -1.42 },
    },
    geoCtx("Royston"),
  );
  record(
    "numbered-road-in-sibling-locality-rejected",
    numberedRoystonRoad.ok === false,
    numberedRoystonRoad.ok ? "accepted" : numberedRoystonRoad.rejectionReason,
  );

  const schoolAsLandmark = classifyRequestedEvidenceCategory(
    "landmarks",
    ["primary_school", "school", "educational_institution"],
    "Wombwell Park Street Primary School",
  );
  record(
    "8-school-not-classified-as-landmark",
    schoolAsLandmark.ok === false && schoolAsLandmark.actualCategory === "schools",
    schoolAsLandmark.ok ? "classified as landmark" : schoolAsLandmark.rejectionReason,
  );

  const wrongCountry = attributeEntityToArea(
    {
      name: "Royston Clinic",
      address: "Royston, GA 30662, USA",
      location: { latitude: 34.287, longitude: -83.11 },
    },
    geoCtx("Royston"),
  );
  const wrongRegion = attributeEntityToArea(
    {
      name: "Royston Library",
      address: "Royston, Hertfordshire SG8 7BS, UK",
      location: { latitude: 52.0487, longitude: -0.0206 },
    },
    geoCtx("Royston"),
  );
  const wrongPostcode = attributeEntityToArea(
    {
      name: "Royston Station",
      address: "Royston SG8 7AL, UK",
      location: { latitude: 52.053, longitude: -0.026 },
    },
    geoCtx("Royston"),
  );
  const distant = attributeEntityToArea(
    {
      name: "Royston Recreation Ground",
      address: "Royston, Barnsley S71 4AA, UK",
      location: { latitude: 52.05, longitude: -0.02 },
    },
    geoCtx("Royston"),
  );
  record(
    "9-wrong-country-region-postcode-and-distant-coords-fail",
    wrongCountry.ok === false
      && wrongRegion.ok === false
      && wrongPostcode.ok === false
      && distant.ok === false,
    `country=${wrongCountry.ok ? "accepted" : wrongCountry.rejectionReason}; region=${wrongRegion.ok ? "accepted" : wrongRegion.rejectionReason}; postcode=${wrongPostcode.ok ? "accepted" : wrongPostcode.rejectionReason}; distant=${distant.ok ? "accepted" : distant.rejectionReason}`,
  );

  const nameOnly = attributeEntityToArea(
    { name: "Royston Health Centre" },
    geoCtx("Royston"),
  );
  record(
    "10-area-name-alone-does-not-attribute",
    nameOnly.ok === false,
    nameOnly.ok ? "accepted" : nameOnly.rejectionReason,
  );

  writeTestSession(["Omega Hamlet", "Sigma Hamlet"]);
  created.push(sessionPath(TEST_SLUG));
  const missing = preflightPharmacyLocalEvidenceForCampaign(TEST_SLUG, "pharmacy-first");
  record(
    "11-missing-pack-uses-isolated-fixture",
    missing.ok === false
      && missing.missingAreas.includes("Omega Hamlet")
      && missing.missingAreas.includes("Sigma Hamlet")
      && !missing.missingAreas.includes("Darfield"),
    missing.customerError || "no customer error",
  );

  const limited = emptyEvidencePack({
    slug: TEST_SLUG,
    area: "Omega Hamlet",
    areaSlug: "omega-hamlet",
    pharmacyCoordinates: PHARMACY_COORDS,
    generatedAt: "2026-08-31T10:00:00.000Z",
    sourceStatus: "google-places-live",
    rejected: [{ name: "Distant Homonym Clinic", address: "Hertfordshire", rejectionReason: "distant-homonym" }],
  });
  created.push(writePharmacyLocalEvidencePack(limited));
  const limitedPreflight = preflightPharmacyLocalEvidenceForCampaign(TEST_SLUG, "pharmacy-first");
  record(
    "12-evidence-limited-remains-fail-closed",
    limitedPreflight.ok === false && limitedPreflight.evidenceLimitedAreas.includes("Omega Hamlet"),
    limitedPreflight.customerError || "no customer error",
  );

  const unaffectedChanged = [...unaffectedBefore.entries()].filter(([file, hash]) => {
    if (!fs.existsSync(file)) return hash !== "missing";
    return hashFile(file) !== hash;
  });
  record(
    "13-no-unaffected-pack-changed",
    unaffectedChanged.length === 0,
    unaffectedChanged.length ? unaffectedChanged.map(([file]) => file).join(", ") : `${UNAFFECTED.length} unaffected packs unchanged`,
  );

  const afterOutputs = snapshotGeneratedOutputs();
  const mutatedHtml: string[] = [];
  for (const [file, hash] of beforeOutputs) {
    if (!afterOutputs.has(file) || afterOutputs.get(file) !== hash) mutatedHtml.push(file);
  }
  for (const file of afterOutputs.keys()) {
    if (!beforeOutputs.has(file)) mutatedHtml.push(file);
  }
  record(
    "14-no-generated-html-written",
    mutatedHtml.length === 0,
    mutatedHtml.length ? mutatedHtml.slice(0, 5).join(", ") : `${beforeOutputs.size} generated outputs unchanged`,
  );

  const query = buildDisambiguatedEvidenceQuery("GP surgeries medical centres", geoCtx("Royston"));
  record(
    "query-includes-geographic-context",
    /Royston/i.test(query) && /Barnsley/i.test(query) && /South Yorkshire/i.test(query) && /UK/i.test(query),
    query,
  );

  const yorkshirePlan = planPharmacyLocalEvidenceRequest(YORKSHIRE, "pharmacy-first");
  const resolved = resolveGeographicEvidenceContext({
    slug: YORKSHIRE,
    areaName: "Royston",
    siblingAreaNames: yorkshirePlan.areas.map((a) => a.areaName),
    pharmacyCoordinates: yorkshirePlan.pharmacyCoordinates,
  });
  record(
    "resolved-context-is-from-stored-records",
    /Barnsley/i.test(resolved.parentTown)
      && /South Yorkshire/i.test(resolved.county)
      && resolved.countryCode === "GB"
      && resolved.pharmacyPostcodeArea === "S"
      && /Royston, South Yorkshire/i.test(resolved.queryPlaceLabel)
      && !/Royston, Barnsley, South Yorkshire/i.test(resolved.queryPlaceLabel),
    resolved.queryPlaceLabel,
  );

  const invalidRoyston = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Royston",
    areaSlug: "royston",
    pharmacyCoordinates: PHARMACY_COORDS,
    generatedAt: "2026-08-31T10:00:00.000Z",
    sourceStatus: "google-places-live",
    entities: [
      {
        name: "Royston Health Centre",
        address: "Melbourn St, Royston SG8 7BS, UK",
        category: "healthcare",
        types: ["doctor", "health"],
        location: { latitude: 52.0487, longitude: -0.0206 },
        placeId: "fixture-herts-royston",
        source: "googlePlaces",
        provider: "googlePlaces",
        retrievedAt: "2026-08-31T10:00:00.000Z",
        sourceRef: "fixture",
        confidence: 92,
        relationship: "name-in-address",
        areaName: "Royston",
      },
    ],
    rejected: [],
  });
  const invalidChapeltown = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Chapeltown",
    areaSlug: "chapeltown",
    pharmacyCoordinates: PHARMACY_COORDS,
    generatedAt: "2026-08-31T10:00:00.000Z",
    sourceStatus: "google-places-live",
    entities: [
      {
        name: "Chapeltown Health Centre",
        address: "Spencer Place, Chapeltown, Leeds LS7 4BB, UK",
        category: "healthcare",
        types: ["doctor", "health"],
        location: { latitude: 53.8114, longitude: -1.53 },
        placeId: "fixture-leeds-chapeltown",
        source: "googlePlaces",
        provider: "googlePlaces",
        retrievedAt: "2026-08-31T10:00:00.000Z",
        sourceRef: "fixture",
        confidence: 92,
        relationship: "name-in-address",
        areaName: "Chapeltown",
      },
    ],
    rejected: [],
  });
  const invalidGoldthorpe = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Goldthorpe",
    areaSlug: "goldthorpe",
    pharmacyCoordinates: PHARMACY_COORDS,
    generatedAt: "2026-08-31T10:00:00.000Z",
    sourceStatus: "google-places-live",
    entities: [
      {
        name: "Hollygreen Practice (Thurnscoe)",
        address: "12 Holly Bush Dr, Thurnscoe, Rotherham S63 0LT, UK",
        category: "healthcare",
        types: ["doctor", "health"],
        location: { latitude: 53.545, longitude: -1.309 },
        placeId: "fixture-thurnscoe-only",
        source: "googlePlaces",
        provider: "googlePlaces",
        retrievedAt: "2026-08-31T10:00:00.000Z",
        sourceRef: "fixture",
        confidence: 92,
        relationship: "name-in-address",
        areaName: "Goldthorpe",
      },
    ],
    rejected: [],
  });
  writeTestSession(["Royston", "Chapeltown", "Goldthorpe", "Thurnscoe"]);
  created.push(writePharmacyLocalEvidencePack(invalidRoyston));
  created.push(writePharmacyLocalEvidencePack(invalidChapeltown));
  created.push(writePharmacyLocalEvidencePack(invalidGoldthorpe));
  const fixtureGeo = {
    pharmacyCoordinates: PHARMACY_COORDS,
  };
  const liveRoyston = validatePharmacyLocalEvidencePack(invalidRoyston, {
    slug: TEST_SLUG,
    areaName: "Royston",
    areaSlug: "royston",
    ...fixtureGeo,
  });
  const liveChapeltown = validatePharmacyLocalEvidencePack(invalidChapeltown, {
    slug: TEST_SLUG,
    areaName: "Chapeltown",
    areaSlug: "chapeltown",
    ...fixtureGeo,
  });
  const liveGoldthorpe = validatePharmacyLocalEvidencePack(invalidGoldthorpe, {
    slug: TEST_SLUG,
    areaName: "Goldthorpe",
    areaSlug: "goldthorpe",
    ...fixtureGeo,
  });
  record(
    "existing-invalid-packs-fail-before-rediscovery",
    liveRoyston.ok === false && liveChapeltown.ok === false && liveGoldthorpe.ok === false,
    `royston=${liveRoyston.ok ? "ready" : liveRoyston.detail}; chapeltown=${liveChapeltown.ok ? "ready" : liveChapeltown.detail}; goldthorpe=${liveGoldthorpe.ok ? "ready" : liveGoldthorpe.detail}`,
  );
} finally {
  for (const file of created) {
    try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
  }
  fs.rmSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-local-relevance-packs", TEST_SLUG), { recursive: true, force: true });
  fs.rmSync(sessionPath(TEST_SLUG), { force: true });
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed.`);
if (failed.length) {
  console.error(failed.map((c) => `FAIL ${c.id}: ${c.detail}`).join("\n"));
  process.exit(1);
}
