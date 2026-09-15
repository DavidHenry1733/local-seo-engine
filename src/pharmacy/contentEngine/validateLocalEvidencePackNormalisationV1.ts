#!/usr/bin/env npx tsx
/**
 * Isolated validation — stored evidence-pack normalisation (ticket 90).
 * Does not call Google. Does not regenerate live tenant pages.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validateLocalEvidencePackNormalisationV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  buildEvidencePackFromAttributedEntities,
  emptyEvidencePack,
  loadPharmacyLocalEvidencePack,
  localEvidencePackPath,
  planPharmacyLocalEvidenceRequest,
  preflightPharmacyLocalEvidenceForCampaign,
  validatePharmacyLocalEvidencePack,
  writePharmacyLocalEvidencePack,
  type LocalEvidenceEntity,
  type PharmacyEvidenceCoordinates,
  type PharmacyLocalEvidencePackV3,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  PHARMACY_LOCAL_EVIDENCE_NORMALISATION_FUNCTION,
  normalizeStoredPharmacyLocalEvidencePacks,
} from "./pharmacyLocalEvidencePackNormalisationV1.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const TEST_SLUG = "validation-local-evidence-normalisation-90";
const COORDS: PharmacyEvidenceCoordinates = {
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

function baseEntity(input: Partial<LocalEvidenceEntity> & { name: string; address: string; category: LocalEvidenceEntity["category"] }): LocalEvidenceEntity {
  return {
    types: input.types || [],
    location: input.location || { latitude: 53.52, longitude: -1.39 },
    placeId: input.placeId || `place-${input.name}`,
    source: "googlePlaces",
    provider: "googlePlaces",
    retrievedAt: "2026-08-31T10:12:35.196Z",
    sourceRef: "https://maps.google.com/?cid=fixture",
    confidence: 92,
    relationship: input.relationship || "name-in-address",
    areaName: input.areaName || "Wombwell",
    ...input,
  };
}

const created: string[] = [];
const beforeOutputs = snapshotGeneratedOutputs();
const builderBefore = hashFile(path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`));
const reviewBefore = hashFile(path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`));

try {
  const yorkshirePlan = planPharmacyLocalEvidenceRequest(YORKSHIRE, "pharmacy-first");
  const yorkshireValidated = yorkshirePlan.areas.map((area) => {
    const raw = loadPharmacyLocalEvidencePack(YORKSHIRE, area.areaSlug);
    return validatePharmacyLocalEvidencePack(raw, {
      slug: YORKSHIRE,
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      pharmacyCoordinates: yorkshirePlan.pharmacyCoordinates,
    });
  });
  record(
    "1-every-ten-pack-revalidated",
    yorkshirePlan.areas.length === 10 && yorkshireValidated.length === 10,
    `areas=${yorkshirePlan.areas.length} validated=${yorkshireValidated.length}`,
  );

  writeTestSession(["Wombwell", "Darfield"]);
  created.push(sessionPath(TEST_SLUG));
  const oldSchoolPack = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Wombwell",
    areaSlug: "wombwell",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:12:35.196Z",
    sourceStatus: "google-places-live",
    entities: [
      baseEntity({
        name: "Wombwell Park Street Primary School",
        address: "Park St, Wombwell, Barnsley S73 0HS, UK",
        category: "landmarks",
        types: ["primary_school", "school"],
        placeId: "school-as-landmark",
      }),
    ],
    rejected: [],
  });
  created.push(writePharmacyLocalEvidencePack(oldSchoolPack));
  const beforeOld = validatePharmacyLocalEvidencePack(oldSchoolPack, {
    slug: TEST_SLUG,
    areaName: "Wombwell",
    areaSlug: "wombwell",
    pharmacyCoordinates: COORDS,
  });
  record(
    "2-older-packs-cannot-bypass-corrected-resolver",
    beforeOld.ok === false,
    beforeOld.ok ? "old mis-bucket passed" : beforeOld.detail,
  );

  const schoolResult = normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const afterSchool = loadPharmacyLocalEvidencePack(TEST_SLUG, "wombwell") as PharmacyLocalEvidencePackV3;
  record(
    "3-school-moved-from-landmarks-to-schools",
    afterSchool.landmarks.length === 0
      && afterSchool.schools.some((row) => row.name === "Wombwell Park Street Primary School")
      && afterSchool.schools[0]?.retrievedAt === "2026-08-31T10:12:35.196Z"
      && afterSchool.schools[0]?.placeId === "school-as-landmark",
    `landmarks=${afterSchool.landmarks.length} schools=${afterSchool.schools.map((row) => row.name).join(",")}`,
  );

  writeTestSession(["Wombwell"]);
  const unattributableRetail = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Wombwell",
    areaSlug: "wombwell",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:12:35.196Z",
    sourceStatus: "google-places-live",
    entities: [
      baseEntity({
        name: "Alhambra Shopping Centre",
        address: "Cheapside, Barnsley S70 1SB, UK",
        category: "landmarks",
        types: ["shopping_mall"],
        location: { latitude: 53.553, longitude: -1.482 },
        placeId: "unattributable-retail",
      }),
    ],
    rejected: [],
  });
  writePharmacyLocalEvidencePack(unattributableRetail);
  normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const afterRejectRetail = loadPharmacyLocalEvidencePack(TEST_SLUG, "wombwell") as PharmacyLocalEvidencePackV3;
  record(
    "4-unattributable-retail-rejected-not-moved",
    afterRejectRetail.retail.length === 0
      && afterRejectRetail.landmarks.length === 0
      && afterRejectRetail.rejected.some((row) => row.placeId === "unattributable-retail"),
    `retail=${afterRejectRetail.retail.length} rejected=${afterRejectRetail.rejected.map((row) => row.rejectionReason).join(",")}`,
  );

  const attributableRetail = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Wombwell",
    areaSlug: "wombwell",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:12:35.196Z",
    sourceStatus: "google-places-live",
    entities: [
      baseEntity({
        name: "Stairfoot Retail Park Barnsley",
        address: "Wombwell Ln, Wombwell, Barnsley S73 8EJ, UK",
        category: "landmarks",
        types: ["shopping_mall"],
        placeId: "attributable-retail",
      }),
    ],
    rejected: [],
  });
  writePharmacyLocalEvidencePack(attributableRetail);
  normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const afterKeepRetail = loadPharmacyLocalEvidencePack(TEST_SLUG, "wombwell") as PharmacyLocalEvidencePackV3;
  record(
    "5-attributable-retail-retained-as-retail",
    afterKeepRetail.retail.some((row) => row.placeId === "attributable-retail")
      && afterKeepRetail.landmarks.length === 0,
    `retail=${afterKeepRetail.retail.map((row) => row.name).join(",")} landmarks=${afterKeepRetail.landmarks.length}`,
  );

  const roadOnly = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Royston",
    areaSlug: "royston",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:12:35.196Z",
    sourceStatus: "google-places-live",
    entities: [
      baseEntity({
        name: "Cherry Dale Primary",
        address: "Royston Rd, Cudworth, Barnsley S72 8AA, UK",
        category: "schools",
        types: ["primary_school", "school"],
        areaName: "Royston",
        placeId: "road-only",
      }),
    ],
    rejected: [],
  });
  writeTestSession(["Royston", "Cudworth"]);
  writePharmacyLocalEvidencePack(roadOnly);
  normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const afterRoad = loadPharmacyLocalEvidencePack(TEST_SLUG, "royston") as PharmacyLocalEvidencePackV3;
  record(
    "6-road-name-only-locality-fails",
    afterRoad.schools.length === 0 && afterRoad.rejected.some((row) => row.placeId === "road-only"),
    afterRoad.rejected.find((row) => row.placeId === "road-only")?.rejectionReason || "missing",
  );

  const siblingPack = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Goldthorpe",
    areaSlug: "goldthorpe",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:12:35.196Z",
    sourceStatus: "google-places-live",
    entities: [
      baseEntity({
        name: "Hollygreen Practice",
        address: "12 Holly Bush Dr, Thurnscoe, Rotherham S63 0LT, UK",
        category: "healthcare",
        types: ["medical_clinic", "health"],
        areaName: "Goldthorpe",
        placeId: "sibling-only",
      }),
    ],
    rejected: [],
  });
  writeTestSession(["Goldthorpe", "Thurnscoe"]);
  writePharmacyLocalEvidencePack(siblingPack);
  normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const afterSibling = loadPharmacyLocalEvidencePack(TEST_SLUG, "goldthorpe") as PharmacyLocalEvidencePackV3;
  record(
    "7-sibling-area-entities-fail",
    afterSibling.healthcare.length === 0
      && afterSibling.rejected.some((row) => row.rejectionReason === "attributed-to-sibling-area"),
    afterSibling.rejected.map((row) => row.rejectionReason).join(","),
  );

  const distantPack = buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area: "Royston",
    areaSlug: "royston",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:12:35.196Z",
    sourceStatus: "google-places-live",
    entities: [
      baseEntity({
        name: "Royston Health Centre",
        address: "Melbourn St, Royston SG8 7BS, UK",
        category: "healthcare",
        types: ["doctor", "health"],
        location: { latitude: 52.0487, longitude: -0.0206 },
        areaName: "Royston",
        placeId: "distant-homonym",
      }),
    ],
    rejected: [],
  });
  writeTestSession(["Royston"]);
  writePharmacyLocalEvidencePack(distantPack);
  normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const afterDistant = loadPharmacyLocalEvidencePack(TEST_SLUG, "royston") as PharmacyLocalEvidencePackV3;
  record(
    "8-distant-homonyms-fail",
    afterDistant.healthcare.length === 0 && afterDistant.rejected.some((row) => row.placeId === "distant-homonym"),
    afterDistant.rejected.find((row) => row.placeId === "distant-homonym")?.rejectionReason || "missing",
  );

  record(
    "9-provider-provenance-survives-normalization",
    afterSchool.schools[0]?.provider === "googlePlaces"
      && afterSchool.schools[0]?.retrievedAt === "2026-08-31T10:12:35.196Z"
      && afterSchool.schools[0]?.sourceRef.includes("maps.google.com")
      && afterSchool.schools[0]?.address === "Park St, Wombwell, Barnsley S73 0HS, UK",
    `provider=${afterSchool.schools[0]?.provider} retrievedAt=${afterSchool.schools[0]?.retrievedAt}`,
  );

  writeTestSession(["Wombwell"]);
  writePharmacyLocalEvidencePack(oldSchoolPack);
  const first = normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const firstHash = hashFile(localEvidencePackPath(TEST_SLUG, "wombwell"));
  const second = normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const secondHash = hashFile(localEvidencePackPath(TEST_SLUG, "wombwell"));
  record(
    "10-normalization-is-idempotent",
    first.packsChanged.includes("Wombwell") && second.packsChanged.length === 0 && firstHash === secondHash,
    `firstChanged=${first.packsChanged.join(",")} secondChanged=${second.packsChanged.join(",") || "none"}`,
  );
  record(
    "11-second-normalization-changes-no-files",
    second.filesWritten.length === 0 && second.indexChanged === false,
    `filesWritten=${second.filesWritten.length} indexChanged=${second.indexChanged}`,
  );

  const limited = emptyEvidencePack({
    slug: TEST_SLUG,
    area: "Wombwell",
    areaSlug: "wombwell",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:12:35.196Z",
    sourceStatus: "google-places-live",
    rejected: [{ name: "Distant Homonym Clinic", address: "Hertfordshire", rejectionReason: "distant-homonym" }],
  });
  writePharmacyLocalEvidencePack(limited);
  normalizeStoredPharmacyLocalEvidencePacks(TEST_SLUG);
  const limitedPreflight = preflightPharmacyLocalEvidenceForCampaign(TEST_SLUG, "pharmacy-first");
  record(
    "12-evidence-limited-remains-fail-closed",
    limitedPreflight.ok === false && limitedPreflight.evidenceLimitedAreas.includes("Wombwell"),
    limitedPreflight.customerError || "no customer error",
  );

  const afterOutputs = snapshotGeneratedOutputs();
  const mutatedHtml: string[] = [];
  for (const [file, hash] of beforeOutputs) {
    if (!afterOutputs.has(file) || afterOutputs.get(file) !== hash) mutatedHtml.push(file);
  }
  record(
    "13-no-generated-html-written",
    mutatedHtml.length === 0,
    mutatedHtml.length ? mutatedHtml.slice(0, 5).join(", ") : `${beforeOutputs.size} generated outputs unchanged`,
  );

  const builderAfter = hashFile(path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`));
  const reviewAfter = hashFile(path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`));
  record(
    "14-campaign-and-review-state-unchanged",
    builderBefore === builderAfter && reviewBefore === reviewAfter,
    builderBefore === builderAfter && reviewBefore === reviewAfter ? "campaign builder and review centre hashes unchanged" : "state mutated",
  );

  const src = fs.readFileSync(path.join(ROOT, "src/pharmacy/contentEngine/pharmacyLocalEvidencePackNormalisationV1.ts"), "utf8");
  record(
    "normalizer-makes-no-provider-calls",
    PHARMACY_LOCAL_EVIDENCE_NORMALISATION_FUNCTION === "normalizeStoredPharmacyLocalEvidencePacks"
      && !src.includes("places.googleapis.com")
      && !src.includes("fetch(")
      && !src.includes("GOOGLE_PLACES_API_KEY"),
    PHARMACY_LOCAL_EVIDENCE_NORMALISATION_FUNCTION,
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
