#!/usr/bin/env npx tsx
/**
 * Isolated validation — local evidence pipeline and fail-closed gates (ticket 87).
 * Does not call Google, does not regenerate live tenant pages.
 *
 * Run: npx tsx src/pharmacy/contentEngine/validateLocalEvidencePipelineAndFailClosedGateV1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  LOCAL_EVIDENCE_PACK_SCHEMA_VERSION,
  LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD,
  PHARMACY_LOCAL_EVIDENCE_DISCOVERY_FUNCTION,
  assignEntitiesToExclusiveAreas,
  attributeEntityToArea,
  buildEvidencePackFromAttributedEntities,
  emptyEvidencePack,
  localEvidenceNotReadyCustomerError,
  planPharmacyLocalEvidenceRequest,
  preflightPharmacyLocalEvidenceForCampaign,
  resolveAuthoritativeCampaignTargetAreas,
  writePharmacyLocalEvidencePack,
  type PharmacyEvidenceCoordinates,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { composeCommercialClusterNarrativeV1 } from "../pharmacyLocalClusterContentEngine.ts";
import { evaluateLocalityHtmlDuplicationGate } from "../pharmacyLocalityPageDuplicationGateV1.ts";
import { generateLocalLocationHierarchyPages } from "../pharmacyLocalLocationGenerationService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const TEST_SLUG = "validation-local-evidence-pipeline-87";
const PHARMACY = "Validation Community Pharmacy";
const COORDS: PharmacyEvidenceCoordinates = {
  latitude: 53.531914,
  longitude: -1.381959,
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

function packFor(area: string, extras: { gp: string; landmark: string }) {
  const areaSlug = slugifyArea(area);
  return buildEvidencePackFromAttributedEntities({
    slug: TEST_SLUG,
    area,
    areaSlug,
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:00:00.000Z",
    sourceStatus: "google-places-live",
    entities: [
      {
        name: extras.gp,
        address: `High Street, ${area}`,
        category: "healthcare",
        types: ["doctor"],
        location: { latitude: 53.54, longitude: -1.38 },
        placeId: `place-${areaSlug}-gp`,
        source: "googlePlaces",
        provider: "googlePlaces",
        retrievedAt: "2026-08-31T10:00:00.000Z",
        sourceRef: `https://maps.google.com/?cid=${areaSlug}`,
        confidence: 92,
        relationship: "name-in-address",
        areaName: area,
      },
      {
        name: extras.landmark,
        address: extras.landmark + `, ${area}`,
        category: "landmarks",
        types: ["park"],
        location: { latitude: 53.541, longitude: -1.381 },
        placeId: `place-${areaSlug}-park`,
        source: "googlePlaces",
        provider: "googlePlaces",
        retrievedAt: "2026-08-31T10:00:00.000Z",
        sourceRef: `https://maps.google.com/?cid=${areaSlug}-park`,
        confidence: 84,
        relationship: "name-in-entity",
        areaName: area,
      },
    ],
    rejected: [],
  });
}

function mockCtx(areas: string[]): ContentGenerationContext {
  const selected = areas.map((areaName, i) => ({
    areaName,
    areaSlug: slugifyArea(areaName),
    selected: true,
    order: i + 1,
  }));
  return {
    resolvedSlug: TEST_SLUG,
    slug: TEST_SLUG,
    serviceId: "pharmacy-first",
    serviceName: "Pharmacy First",
    profile: {
      pharmacyName: PHARMACY,
      displayPhone: "01226 210477",
      phone: "01226 210477",
      fullAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
      customerFacingAddress: "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
      town: "Barnsley",
    },
    rawProfile: {
      latitude: String(COORDS.latitude),
      longitude: String(COORDS.longitude),
      selectedAreas: selected.map((a, i) => ({
        areaName: a.areaName,
        selected: true,
        order: i + 1,
        latitude: 53.54,
        longitude: -1.38,
        distanceMethod: "haversine",
        distanceKm: 2 + i,
        distanceLabel: `about ${2 + i} km`,
        distanceProvenance: { calculationMethod: "haversine", distanceSource: "google-coordinates" },
      })),
    },
    selectedAreas: selected,
    localMarket: {
      slug: TEST_SLUG,
      generatedAt: "2026-08-31T10:00:00.000Z",
      yourPharmacy: {
        placeId: "test-pharmacy",
        businessName: PHARMACY,
        latitude: COORDS.latitude,
        longitude: COORDS.longitude,
        address: "91 Snape Hill Rd, Darfield",
        phone: "01226 210477",
        website: "",
      },
      healthcareProviders: [],
      nearbyPharmacies: [],
    },
    map: { latitude: String(COORDS.latitude), longitude: String(COORDS.longitude) },
    links: {
      ecosystemRoot: path.join("/tmp", TEST_SLUG, "pharmacy-first"),
    },
  } as unknown as ContentGenerationContext;
}

function narrativeInput(areaName: string, sibling: string) {
  return {
    slug: TEST_SLUG,
    serviceId: "pharmacy-first",
    serviceName: "Pharmacy First",
    areaName,
    areaSlug: slugifyArea(areaName),
    nearbyAreaNames: [sibling],
    areaSlugsInCluster: [slugifyArea(areaName), slugifyArea(sibling)],
    siblingLocalities: [
      { areaName, areaSlug: slugifyArea(areaName) },
      { areaName: sibling, areaSlug: slugifyArea(sibling) },
    ],
  };
}

function pageHtml(areaName: string, body: string, extra = ""): string {
  const slug = slugifyArea(areaName);
  return `<!DOCTYPE html><html lang="en-GB"><head><title>Pharmacy First in ${areaName} | ${PHARMACY}</title>
<meta name="description" content="Pharmacy First for ${areaName}."/></head>
<body><header>Shared header</header>
<main>
<section data-template-block="hero"><h1>Pharmacy First — ${areaName}</h1><p>${body}</p></section>
<section data-template-block="local-relevance"><h2>Conditions</h2><p>Shared clinical pathway copy.</p></section>
<section data-template-block="local" id="local-access"><h2>Travelling</h2><p class="local-intro-lead">${extra || body}</p></section>
<section data-template-block="parent-child-links"><a href="/local/${slug}/">Pharmacy First in ${areaName}</a></section>
<section data-template-block="faq"><h3>FAQ</h3><p>Shared clinical FAQ.</p></section>
<section data-template-block="final-cta"><p>Call the pharmacy.</p></section>
</main><footer>Shared footer</footer></body></html>`;
}

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const before = snapshotGeneratedOutputs();
const created: string[] = [];

try {
  const yorkshireAreas = resolveAuthoritativeCampaignTargetAreas(YORKSHIRE);
  record(
    "1-campaign-builder-areas-are-pack-input",
    yorkshireAreas.length === 10 && yorkshireAreas.includes("Thurnscoe") && yorkshireAreas.includes("Chapeltown"),
    `saved targetAreaNames=${yorkshireAreas.join(", ")}`,
  );

  const blueprint = path.join(ROOT, "data/pharmacy-content-blueprints", `${YORKSHIRE}.json`);
  const plan = planPharmacyLocalEvidenceRequest(YORKSHIRE, "pharmacy-first");
  record(
    "2-missing-blueprint-does-not-block-planning",
    !fs.existsSync(blueprint) && plan.blueprintRequired === false && plan.areas.length === 10,
    `blueprintExists=${fs.existsSync(blueprint)} areas=${plan.areas.length}`,
  );

  writeTestSession(["Gamma Hamlet", "Delta Hamlet"]);
  created.push(sessionPath(TEST_SLUG));
  const missingPreflight = preflightPharmacyLocalEvidenceForCampaign(TEST_SLUG, "pharmacy-first");
  record(
    "3-missing-pack-fails-before-generation",
    missingPreflight.ok === false
      && missingPreflight.missingAreas.includes("Gamma Hamlet")
      && missingPreflight.missingAreas.includes("Delta Hamlet")
      && Boolean(missingPreflight.customerError),
    missingPreflight.customerError || "no customer error",
  );

  writeTestSession(["Alpha Village", "Beta Village"]);
  created.push(sessionPath(TEST_SLUG));
  const limited = emptyEvidencePack({
    slug: TEST_SLUG,
    area: "Alpha Village",
    areaSlug: "alpha-village",
    pharmacyCoordinates: COORDS,
    generatedAt: "2026-08-31T10:00:00.000Z",
    sourceStatus: "google-places-live",
    rejected: [{ name: "Barnsley Hospital", address: "Barnsley", rejectionReason: "unattributable-to-requested-area" }],
  });
  const limitedPath = writePharmacyLocalEvidencePack(limited);
  created.push(limitedPath);
  const limitedPreflight = preflightPharmacyLocalEvidenceForCampaign(TEST_SLUG, "pharmacy-first");
  record(
    "4-evidence-limited-pack-fails-before-generation",
    limitedPreflight.ok === false && limitedPreflight.evidenceLimitedAreas.includes("Alpha Village"),
    limitedPreflight.customerError || "no customer error",
  );

  const unattributable = attributeEntityToArea(
    { name: "Barnsley Hospital", address: "Gawber Road, Barnsley", location: { latitude: 53.553, longitude: -1.48 } },
    {
      areaName: "Thurnscoe",
      areaSlug: "thurnscoe",
      siblingAreaNames: ["Darfield", "Thurnscoe"],
      pharmacyCoordinates: COORDS,
    },
  );
  record(
    "5-unattributable-entity-rejected",
    unattributable.ok === false && unattributable.rejectionReason !== "weak-name",
    unattributable.ok ? "accepted" : unattributable.rejectionReason,
  );

  const shared = { name: "Barnsley Interchange", address: "Barnsley town centre", placeId: "shared-1" };
  const assigned = assignEntitiesToExclusiveAreas(
    [shared],
    [
      { areaName: "Darfield", areaSlug: "darfield", siblingAreaNames: ["Wombwell", "Darfield"] },
      { areaName: "Wombwell", areaSlug: "wombwell", siblingAreaNames: ["Darfield", "Wombwell"] },
    ],
  );
  const darfieldHas = (assigned.get("darfield") || []).length;
  const wombwellHas = (assigned.get("wombwell") || []).length;
  record(
    "6-entity-not-assigned-to-every-area",
    darfieldHas + wombwellHas <= 1,
    `darfield=${darfieldHas} wombwell=${wombwellHas}`,
  );

  const thurnscoePack = packFor("Thurnscoe", { gp: "Thurnscoe Medical Centre", landmark: "Thurnscoe Rec" });
  const grimePack = packFor("Grimethorpe", { gp: "Grimethorpe Surgery", landmark: "Grimethorpe Colliery Monument" });
  created.push(writePharmacyLocalEvidencePack(thurnscoePack));
  created.push(writePharmacyLocalEvidencePack(grimePack));
  writeTestSession(["Thurnscoe", "Grimethorpe"]);

  const ctx = mockCtx(["Thurnscoe", "Grimethorpe"]);
  const thurnscoeContent = composeCommercialClusterNarrativeV1(narrativeInput("Thurnscoe", "Grimethorpe"), ctx);
  const grimethorpeContent = composeCommercialClusterNarrativeV1(narrativeInput("Grimethorpe", "Thurnscoe"), ctx);
  const thurnscoeText = `${thurnscoeContent.heroIntro} ${thurnscoeContent.whyChecksBody} ${thurnscoeContent.accessBody}`;
  const grimethorpeText = `${grimethorpeContent.heroIntro} ${grimethorpeContent.whyChecksBody} ${grimethorpeContent.accessBody}`;
  record(
    "7-verified-healthcare-reaches-narrative",
    /Thurnscoe Medical Centre/i.test(thurnscoeText) && /Grimethorpe Surgery/i.test(grimethorpeText),
    `thurnscoeHasGp=${/Thurnscoe Medical Centre/i.test(thurnscoeText)} grimethorpeHasGp=${/Grimethorpe Surgery/i.test(grimethorpeText)}`,
  );
  record(
    "8-verified-landmark-reaches-narrative",
    /Thurnscoe Rec/i.test(thurnscoeText) && /Grimethorpe Colliery Monument/i.test(grimethorpeText),
    `thurnscoeHasLandmark=${/Thurnscoe Rec/i.test(thurnscoeText)} grimethorpeHasLandmark=${/Grimethorpe Colliery Monument/i.test(grimethorpeText)}`,
  );
  record(
    "9-missing-roads-do-not-erase-other-evidence",
    /Thurnscoe Medical Centre/i.test(thurnscoeText) && !/Otley Road/i.test(thurnscoeText),
    "healthcare present without invented roads",
  );

  const genSrc = readSrc("src/pharmacy/pharmacyLocalLocationGenerationService.ts");
  record(
    "10-pharmacy-first-runs-evidence-and-duplication-gates",
    /preflightPharmacyLocalEvidenceForCampaign/.test(genSrc)
      && /evaluateLocalityHtmlDuplicationGate/.test(genSrc)
      && /evaluateLocalityPatientCopyQualityGate/.test(genSrc)
      && !/Skipped for Pharmacy First locked Headingley template/.test(genSrc)
      && !genSrc.includes("if (!usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId)) {\n    for (const cluster"),
    "generation service applies preflight, patient-copy and duplication gates without a Pharmacy First skip",
  );

  const cloneA = pageHtml("Darfield", "Patients in Darfield can use Pharmacy First. Darfield is about 1 km from the pharmacy.", "Call for directions from Darfield.");
  const cloneB = pageHtml("Wombwell", "Patients in Wombwell can use Pharmacy First. Wombwell is about 3 km from the pharmacy.", "Call for directions from Wombwell.");
  const cloneGate = evaluateLocalityHtmlDuplicationGate({
    pages: [
      { areaSlug: "darfield", areaName: "Darfield", html: cloneA },
      { areaSlug: "wombwell", areaName: "Wombwell", html: cloneB },
    ],
    pharmacyName: PHARMACY,
  });
  record(
    "11-name-distance-link-only-pages-fail-uniqueness",
    cloneGate.ok === false,
    cloneGate.message,
  );

  const distinctGate = evaluateLocalityHtmlDuplicationGate({
    pages: [
      {
        areaSlug: "thurnscoe",
        areaName: "Thurnscoe",
        html: pageHtml(
          "Thurnscoe",
          "Named local healthcare recorded for Thurnscoe includes Thurnscoe Medical Centre. Local orientation for Thurnscoe includes Thurnscoe Rec.",
          "Thurnscoe Medical Centre is a recorded healthcare setting for Thurnscoe.",
        ),
      },
      {
        areaSlug: "grimethorpe",
        areaName: "Grimethorpe",
        html: pageHtml(
          "Grimethorpe",
          "Named local healthcare recorded for Grimethorpe includes Grimethorpe Surgery. Local orientation for Grimethorpe includes Grimethorpe Colliery Monument.",
          "Grimethorpe Surgery is a recorded healthcare setting for Grimethorpe.",
        ),
      },
    ],
    pharmacyName: PHARMACY,
  });
  record(
    "12-distinct-evidence-pages-pass",
    distinctGate.ok === true,
    distinctGate.message,
  );

  const ecoRoot = path.join("/tmp", TEST_SLUG, "fail-closed-html");
  fs.rmSync(ecoRoot, { recursive: true, force: true });
  writeTestSession(["Alpha Village", "Beta Village"]);
  const failCtx = mockCtx(["Alpha Village", "Beta Village"]);
  failCtx.links = { ...(failCtx.links || {}), ecosystemRoot: ecoRoot } as ContentGenerationContext["links"];
  const reviewBefore = path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-review-centre.json`);
  const reviewHashBefore = fs.existsSync(reviewBefore) ? hashFile(reviewBefore) : "missing";
  const builderBefore = hashFile(path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`));
  const failed = generateLocalLocationHierarchyPages(failCtx);
  const wroteHtml = fs.existsSync(ecoRoot) && fs.readdirSync(ecoRoot).length > 0;
  const reviewHashAfter = fs.existsSync(reviewBefore) ? hashFile(reviewBefore) : "missing";
  const builderAfter = hashFile(path.join(ROOT, "data/growth-engine", `${YORKSHIRE}-campaign-builder.json`));
  record(
    "13-failure-writes-no-html-and-no-completion-records",
    failed.ok === false && !wroteHtml && reviewHashBefore === reviewHashAfter && builderBefore === builderAfter,
    `ok=${failed.ok} wroteHtml=${wroteHtml} error=${failed.blockedReason || ""}`,
  );

  const previewSrc = [
    "src/pharmacy/growthEngineReviewCentrePreviewService.ts",
    "src/pharmacy/growthEngineReviewCentreService.ts",
    "src/pharmacy/growthEngineReviewCentrePage.ts",
    "artifacts/api-server/src/routes/api/growthEngineReviewCentre.ts",
  ].map(readSrc).join("\n");
  record(
    "14-preview-and-review-never-trigger-discovery",
    !previewSrc.includes("runPharmacyLocalEvidenceDiscovery")
      && !previewSrc.includes("generatePharmacyLocalRelevancePacks")
      && PHARMACY_LOCAL_EVIDENCE_DISCOVERY_FUNCTION === "runPharmacyLocalEvidenceDiscovery",
    "Review Centre and Preview sources do not call the explicit discovery function",
  );

  const after = snapshotGeneratedOutputs();
  const mutated: string[] = [];
  for (const [file, hash] of before) {
    if (!after.has(file) || after.get(file) !== hash) mutated.push(file);
  }
  for (const file of after.keys()) {
    if (!before.has(file)) mutated.push(file);
  }
  record(
    "15-existing-generated-outputs-unchanged",
    mutated.length === 0,
    mutated.length ? mutated.slice(0, 5).join(", ") : `${before.size} output files unchanged`,
  );

  record(
    "schema-version-v3",
    LOCAL_EVIDENCE_PACK_SCHEMA_VERSION === "v3" && LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD === 0.85,
    `schema=${LOCAL_EVIDENCE_PACK_SCHEMA_VERSION} bodyThreshold=${LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD}`,
  );
  record(
    "controlled-error-copy",
    /Thurnscoe, Grimethorpe/.test(localEvidenceNotReadyCustomerError(["Thurnscoe", "Grimethorpe"])),
    localEvidenceNotReadyCustomerError(["Thurnscoe", "Grimethorpe"]),
  );
} finally {
  for (const file of created) {
    try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
  }
  const testPackDir = path.join(ROOT, "data/pharmacy-local-relevance-packs", TEST_SLUG);
  fs.rmSync(testPackDir, { recursive: true, force: true });
  fs.rmSync(sessionPath(TEST_SLUG), { force: true });
  fs.rmSync(path.join("/tmp", TEST_SLUG), { recursive: true, force: true });
}

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed. Threshold documented: identity-stripped body ${LOCALITY_IDENTITY_STRIPPED_BODY_THRESHOLD} (sectional near-duplicate remains 0.92).`);
if (failed.length) {
  console.error(failed.map((c) => `FAIL ${c.id}: ${c.detail}`).join("\n"));
  process.exit(1);
}
