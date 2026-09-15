#!/usr/bin/env npx tsx
/**
 * Mickleover area-reference collection workflow.
 * Fixture adapters only for collection. No live Places, generation, campaign resume, or live writes.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveGeographicEvidenceContext } from "../src/pharmacy/contentEngine/pharmacyLocalEvidenceGeographicAttributionV1.ts";
import {
  PLACES_TEXT_SEARCH_PRO_LIST_USD,
  buildUkLocalPageAreaReferenceProviderRequest,
  buildUkLocalPageAreaReferenceQuery,
} from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import { planPharmacyLocalEvidenceRequest } from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { preflightOneLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import {
  areaReferenceFollowUpRequired,
  authoriseLocalPageEvidencePlan,
  decorateLocalPageEvidencePlan,
  recordedAreaReferencePath,
  resetEvidenceCollectionTestHarness,
  setEvidenceCollectionTestHarness,
  startLocalPageEvidenceCollection,
  type EvidenceCollectionAdapters,
  type EvidencePlacesHit,
} from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import { planOneLocalPageEvidencePreparation } from "../src/pharmacy/growthEngineLocalPageEvidencePreparationService.ts";
import { haversineKm } from "../src/pharmacy/masterAdminLocalCoverageGeoService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const ALLESTREE_POINT = { latitude: 52.952948899999996, longitude: -1.4925673000000002 };
const MICKLEOVER_POINT = { latitude: 52.903412, longitude: -1.552198 };
const BROOK_PHARMACY_POINT = { latitude: 52.91678930677714, longitude: -1.4825298233725033 };

const PROTECTED = [
  "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
  "data/pharmacy-local-editorial-evidence-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/mickleover.json",
  "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/mickleover.json",
  "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json",
  "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.json",
  "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html",
  "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json",
  "data/growth-engine/brook-pharmacy-demo-derby-campaign-builder.json",
];

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

function sha256File(rel: string): string {
  const full = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  return createHash("sha256").update(fs.readFileSync(full)).digest("hex");
}

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mickleover-area-ref-"));
}

function copyInto(root: string, rel: string) {
  const from = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  const to = path.join(root, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

const MICKLEOVER_HIT: EvidencePlacesHit = {
  name: "Mickleover",
  address: "Mickleover, Derby DE3 0XX",
  types: ["sublocality_level_1", "sublocality", "political"],
  location: MICKLEOVER_POINT,
  placeId: "fixture-mickleover-locality",
  locality: "Mickleover, Derby DE3 0XX",
  addressComponents: [
    { longText: "Mickleover", shortText: "Mickleover", types: ["sublocality_level_1", "sublocality", "political"] },
    { longText: "Derby", shortText: "Derby", types: ["postal_town"] },
    { longText: "United Kingdom", shortText: "GB", types: ["country", "political"] },
  ],
};

const ALLESTREE_HIT: EvidencePlacesHit = {
  name: "Allestree",
  address: "Allestree, Derby, UK",
  types: ["neighborhood", "locality"],
  location: ALLESTREE_POINT,
  placeId: "fixture-allestree-ref",
  locality: "Allestree",
};

function adapters(opts: {
  areaHits?: EvidencePlacesHit[];
  callLog: { places: number; queries: string[]; areas: string[]; callIds: string[] };
}): EvidenceCollectionAdapters {
  return {
    placesSearch: async (query, geo, _max, callId) => {
      opts.callLog.places += 1;
      opts.callLog.queries.push(query);
      opts.callLog.areas.push(String(geo.areaName || ""));
      opts.callLog.callIds.push(String(callId || ""));
      if (callId === "places-area-reference" || (/locality/i.test(query) && !/GP|surgery|medical/i.test(query))) {
        return { hits: opts.areaHits || [MICKLEOVER_HIT], costUsd: PLACES_TEXT_SEARCH_PRO_LIST_USD };
      }
      return { hits: [], costUsd: PLACES_TEXT_SEARCH_PRO_LIST_USD };
    },
    organicSearch: async (query) => ({
      query,
      capturedAt: new Date().toISOString(),
      costUsd: 0.002,
      uncertain: false,
      results: [],
    }),
    fetchPage: async (url) => ({
      url,
      title: "unused",
      status: 200,
      textSample: "unused",
      retrievedAt: new Date().toISOString(),
    }),
  };
}

async function withHarness<T>(root: string, adapter: EvidenceCollectionAdapters, fn: () => Promise<T>): Promise<T> {
  const previousTestRoot = process.env.PHARMACY_LOCAL_PAGE_EVIDENCE_TEST_ROOT;
  process.env.PHARMACY_LOCAL_PAGE_EVIDENCE_TEST_ROOT = root;
  setEvidenceCollectionTestHarness({
    liveProvidersForbidden: true,
    persistPacks: false,
    storageRoot: root,
    adapters: adapter,
    allowLiveProviders: false,
  });
  try {
    return await fn();
  } finally {
    if (previousTestRoot === undefined) delete process.env.PHARMACY_LOCAL_PAGE_EVIDENCE_TEST_ROOT;
    else process.env.PHARMACY_LOCAL_PAGE_EVIDENCE_TEST_ROOT = previousTestRoot;
    resetEvidenceCollectionTestHarness();
  }
}

function seedMickleoverCompletedRun(root: string) {
  copyInto(root, "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json");
  copyInto(root, "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json");
  copyInto(root, "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json");
  const runFile = path.join(root, "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json");
  const run = JSON.parse(fs.readFileSync(runFile, "utf8")) as {
    paidCallsMade?: number;
    spentUsd?: number;
    areaReferencePoint?: unknown;
    distanceKm?: number | null;
    calls?: Array<{ id?: string; actualCostUsd?: number | null }>;
    placesHitsByCall?: Record<string, unknown>;
  };
  const areaRefCall = (run.calls || []).find((row) => row.id === "places-area-reference");
  const areaRefCost = Number(areaRefCall?.actualCostUsd || 0);
  run.areaReferencePoint = null;
  run.distanceKm = null;
  run.calls = (run.calls || []).filter((row) => row.id !== "places-area-reference" && row.id !== "distance-haversine");
  if (run.placesHitsByCall) delete run.placesHitsByCall["places-area-reference"];
  run.paidCallsMade = Math.max(0, Number(run.paidCallsMade || 0) - (areaRefCall ? 1 : 0));
  run.spentUsd = Number(((Number(run.spentUsd || 0) - areaRefCost).toFixed(9)));
  fs.writeFileSync(runFile, `${JSON.stringify(run, null, 2)}\n`);
  const budgetFile = path.join(root, "data/pharmacy-local-page-evidence-budget/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json");
  const budget = JSON.parse(fs.readFileSync(budgetFile, "utf8")) as {
    spentUsd?: number;
    events?: Array<{ callId?: string; kind?: string; usd?: number }>;
  };
  const lastAreaRefConsume = [...(budget.events || [])]
    .reverse()
    .find((row) => row.callId === "places-area-reference" && row.kind === "consumed");
  budget.spentUsd = Number(((Number(budget.spentUsd || 0) - Number(lastAreaRefConsume?.usd || areaRefCost)).toFixed(9)));
  fs.writeFileSync(budgetFile, `${JSON.stringify(budget, null, 2)}\n`);
}

async function main() {
  console.log("\n=== Mickleover area-reference collection workflow (fixtures, no live APIs) ===\n");
  const before = Object.fromEntries(PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const liveMickleoverRef = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/mickleover.json",
  );
  const liveMickleoverRefBefore = fs.existsSync(liveMickleoverRef)
    ? createHash("sha256").update(fs.readFileSync(liveMickleoverRef)).digest("hex")
    : "absent";
  record(
    "live-mickleover-area-reference-snapshot-taken",
    true,
    liveMickleoverRefBefore === "absent" ? "absent" : liveMickleoverRefBefore.slice(0, 12),
  );

  const campaignRun = JSON.parse(
    fs.readFileSync(
      path.join(
        PHARMACY_WORKSPACE_ROOT,
        "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json",
      ),
      "utf8",
    ),
  ) as { runId?: string; status?: string };
  record(
    "stopped-campaign-run-unchanged-before",
    campaignRun.runId === "e23b2020-b520-453c-a7a5-45d301316229" && campaignRun.status === "stopped",
    `runId=${campaignRun.runId} status=${campaignRun.status}`,
  );

  const request = planPharmacyLocalEvidenceRequest(BROOK, SERVICE);
  const mickleoverGeo = resolveGeographicEvidenceContext({
    slug: BROOK,
    areaName: "Mickleover",
    areaSlug: "mickleover",
    siblingAreaNames: request.areas.map((row) => row.areaName),
    pharmacyCoordinates: request.pharmacyCoordinates,
  });
  const providerRequest = buildUkLocalPageAreaReferenceProviderRequest(mickleoverGeo);
  const expectedQuery = buildUkLocalPageAreaReferenceQuery(mickleoverGeo);
  record(
    "mickleover-specific-provider-request",
    providerRequest.textQuery === "Mickleover locality, Derbyshire, UK" &&
      providerRequest.textQuery === expectedQuery &&
      providerRequest.areaName === "Mickleover" &&
      providerRequest.areaSlug === "mickleover" &&
      providerRequest.locationBias === null &&
      providerRequest.regionCode === "GB" &&
      !/allestree/i.test(JSON.stringify(providerRequest)) &&
      !/\bDerby\b/i.test(providerRequest.textQuery) &&
      !/Mickleover locality in Mickleover/i.test(providerRequest.textQuery),
    JSON.stringify(providerRequest),
  );

  const livePlan = planOneLocalPageEvidencePreparation(BROOK, SERVICE, "mickleover");
  const liveAreaCall = livePlan.proposedCalls.find((row) => row.id === "places-area-reference");
  record(
    "live-plan-does-not-invent-a-new-area-query",
    (liveAreaCall?.query || expectedQuery) === expectedQuery &&
      !livePlan.proposedCalls.some((row) => /allestree/i.test(row.query || "")),
    `query=${liveAreaCall?.query || expectedQuery} calls=${livePlan.proposedCalls.map((row) => row.id).join(",")}`,
  );

  const liveDecorated = decorateLocalPageEvidencePlan(livePlan);
  record(
    "live-collection-plan-stays-mickleover-scoped",
    !/allestree/i.test(liveDecorated.paidCollectionBlockedReason || "") &&
      (liveDecorated.collectionSpentUsd || 0) >= 0,
    `followUp=${liveDecorated.areaReferenceFollowUpRequired} start=${liveDecorated.startPaidCollectionEnabled} spent=${liveDecorated.collectionSpentUsd} blocked=${liveDecorated.paidCollectionBlockedReason}`,
  );

  const html = renderCampaignBuilderPage(BROOK, "areas", { area: "mickleover" });
  record(
    "campaign-builder-shows-mickleover-distance-method",
    html.includes('data-one-local-page="mickleover"') &&
      html.includes('data-distance-method="haversine-straight-line"') &&
      html.includes('data-distance-to="Mickleover"') &&
      /haversine/i.test(html) &&
      !html.includes("52.952948") &&
      !/travel time|convenience|availability|access time/i.test(html) &&
      !/(?<!not a )driving/i.test(html),
    "mickleover panel",
  );

  const preflight = preflightOneLocalPageCandidate(BROOK, SERVICE, "mickleover");
  record(
    "preflight-keeps-saved-mickleover-candidate",
    preflight.existingCandidate === true &&
      preflight.canGenerate === false &&
      preflight.distanceTo === "Mickleover" &&
      preflight.distanceMethod === "haversine-straight-line" &&
      !/allestree/i.test(preflight.distanceDetail),
    `${preflight.distanceStatus} ${preflight.distanceDetail}`,
  );

  const yorkshirePlan = planOneLocalPageEvidencePreparation(YORKSHIRE, SERVICE, "wombwell");
  record(
    "tenant-isolation-yorkshire-plan-is-not-mickleover",
    yorkshirePlan.slug === YORKSHIRE &&
      !/mickleover/i.test(JSON.stringify(yorkshirePlan.proposedCalls)) &&
      !/allestree/i.test(JSON.stringify(yorkshirePlan.proposedCalls)),
    `slug=${yorkshirePlan.slug} area=${yorkshirePlan.areaSlug}`,
  );

  const successRoot = tmpRoot();
  const successLog = { places: 0, queries: [] as string[], areas: [] as string[], callIds: [] as string[] };
  seedMickleoverCompletedRun(successRoot);
  const allestreeTmpBefore = fs.readFileSync(
    path.join(successRoot, "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json"),
    "utf8",
  );
  await withHarness(successRoot, adapters({ callLog: successLog }), async () => {
    const planned = planOneLocalPageEvidencePreparation(BROOK, SERVICE, "mickleover");
    record(
      "follow-up-plan-uses-mickleover-query",
      planned.proposedCalls.find((row) => row.id === "places-area-reference")?.query === expectedQuery &&
        areaReferenceFollowUpRequired(
          JSON.parse(
            fs.readFileSync(
              path.join(
                successRoot,
                "data/pharmacy-local-page-evidence-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/mickleover.json",
              ),
              "utf8",
            ),
          ),
          planned,
        ) === true,
      planned.proposedCalls.find((row) => row.id === "places-area-reference")?.query || "",
    );
    const auth = authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "mickleover",
      spendingCapUsd: 0.2,
      confirmAuthorise: true,
    });
    record("follow-up-authorise", auth.ok === true, auth.ok ? auth.authorisation.planFingerprint.slice(0, 12) : auth.error);
    if (!auth.ok) return;
    record(
      "follow-up-enables-start",
      decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(BROOK, SERVICE, "mickleover"))
        .startPaidCollectionEnabled === true,
      "authorised follow-up",
    );
    const first = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "mickleover" });
    const savedRefPath = recordedAreaReferencePath(BROOK, "mickleover");
    const savedRef = JSON.parse(
      fs.readFileSync(savedRefPath, "utf8"),
    ) as {
      slug?: string;
      areaSlug?: string;
      latitude?: number;
      longitude?: number;
      source?: string;
    };
    const expectedKm = Number(haversineKm(BROOK_PHARMACY_POINT, MICKLEOVER_POINT).toFixed(1));
    record(
      "verified-area-reference-persisted-on-mickleover-path",
      first.ok === true &&
        first.duplicate === false &&
        first.run.runId === "cf8b4949-1aa6-4d71-a883-bacf410f6603" &&
        savedRef.slug === BROOK &&
        savedRef.areaSlug === "mickleover" &&
        savedRef.source === "places-area-reference" &&
        Math.abs((savedRef.latitude || 0) - MICKLEOVER_POINT.latitude) < 1e-8 &&
        Math.abs((savedRef.longitude || 0) - MICKLEOVER_POINT.longitude) < 1e-8 &&
        Math.abs((savedRef.latitude || 0) - ALLESTREE_POINT.latitude) > 1e-4,
      first.ok
        ? `run=${first.run.runId} ${savedRef.latitude},${savedRef.longitude} path=${recordedAreaReferencePath(BROOK, "mickleover")}`
        : first.error,
    );
    record(
      "mickleover-specific-provider-call",
      successLog.places === 1 &&
        successLog.callIds[0] === "places-area-reference" &&
        successLog.areas[0] === "Mickleover" &&
        successLog.queries[0] === expectedQuery &&
        !successLog.queries.some((row) => /allestree/i.test(row)),
      `places=${successLog.places} query=${successLog.queries.join("|")} area=${successLog.areas.join("|")}`,
    );
    record(
      "area-specific-haversine-distance",
      first.ok === true &&
        first.run.distanceKm === expectedKm &&
        first.run.areaReferencePoint?.source === "places-area-reference" &&
        /haversine/i.test(first.run.calls.find((row) => row.id === "distance-haversine")?.detail || "") &&
        /Mickleover/i.test(first.run.calls.find((row) => row.id === "distance-haversine")?.detail || "") &&
        /Not a driving time/i.test(first.run.calls.find((row) => row.id === "distance-haversine")?.detail || "") &&
        !/convenience|availability/i.test(first.run.calls.find((row) => row.id === "distance-haversine")?.detail || ""),
      first.ok ? `km=${first.run.distanceKm} expected=${expectedKm}` : first.error,
    );
    record(
      "existing-evidence-and-costs-preserved",
      first.ok === true &&
        first.run.paidCallsMade === 5 &&
        Math.abs(first.run.spentUsd - 0.1) < 1e-9 &&
        first.run.calls.find((row) => row.id === "places-gp-practices")?.status === "consumed" &&
        first.run.calls.find((row) => row.id === "dataforseo-official-gp-practices")?.actualCostUsd === 0.002,
      first.ok ? `paid=${first.run.paidCallsMade} spent=${first.run.spentUsd}` : first.error,
    );
    const allestreeTmpAfter = fs.readFileSync(
      path.join(successRoot, "data/pharmacy-local-page-evidence-area-reference/brook-pharmacy-demo-derby/allestree.json"),
      "utf8",
    );
    record("no-allestree-leakage-in-tmp", allestreeTmpAfter === allestreeTmpBefore, "allestree reference unchanged");
    const placesBeforeDuplicate = successLog.places;
    const second = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "mickleover" });
    record(
      "duplicate-submission-does-not-recall",
      second.ok === true &&
        second.duplicate === true &&
        successLog.places === placesBeforeDuplicate &&
        second.run.runId === "cf8b4949-1aa6-4d71-a883-bacf410f6603",
      second.ok ? `duplicate=${second.duplicate} places=${successLog.places}` : second.error,
    );
    const reloaded = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(BROOK, SERVICE, "mickleover"));
    record(
      "reload-keeps-verified-mickleover-reference",
      reloaded.areaReferenceFollowUpRequired !== true &&
        reloaded.distancePlan.areaReferenceStatus === "recorded" &&
        reloaded.distancePlan.distanceKm === expectedKm,
      `followUp=${reloaded.areaReferenceFollowUpRequired} km=${reloaded.distancePlan.distanceKm}`,
    );
  });

  const ambiguousRoot = tmpRoot();
  const ambiguousLog = { places: 0, queries: [] as string[], areas: [] as string[], callIds: [] as string[] };
  seedMickleoverCompletedRun(ambiguousRoot);
  await withHarness(
    ambiguousRoot,
    adapters({
      callLog: ambiguousLog,
      areaHits: [MICKLEOVER_HIT, { ...MICKLEOVER_HIT, placeId: "fixture-mickleover-b", location: { latitude: 52.91, longitude: -1.54 } }],
    }),
    async () => {
      authoriseLocalPageEvidencePlan({
        slug: BROOK,
        serviceId: SERVICE,
        areaSlug: "mickleover",
        spendingCapUsd: 0.2,
        confirmAuthorise: true,
      });
      const result = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "mickleover" });
      record(
        "ambiguous-evidence-remains-blocked",
        result.ok === true &&
          result.run.areaReferencePoint == null &&
          result.run.distanceKm == null &&
          !fs.existsSync(recordedAreaReferencePath(BROOK, "mickleover")),
        result.ok ? `ref=${String(result.run.areaReferencePoint)} km=${result.run.distanceKm}` : result.error,
      );
      const placesBefore = ambiguousLog.places;
      const again = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "mickleover" });
      record(
        "ambiguous-duplicate-does-not-retry",
        again.ok === true && again.duplicate === true && ambiguousLog.places === placesBefore,
        again.ok ? `duplicate=${again.duplicate} places=${ambiguousLog.places}` : again.error,
      );
    },
  );

  const missingRoot = tmpRoot();
  const missingLog = { places: 0, queries: [] as string[], areas: [] as string[], callIds: [] as string[] };
  seedMickleoverCompletedRun(missingRoot);
  await withHarness(missingRoot, adapters({ callLog: missingLog, areaHits: [] }), async () => {
    authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "mickleover",
      spendingCapUsd: 0.2,
      confirmAuthorise: true,
    });
    const result = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "mickleover" });
    record(
      "missing-evidence-remains-blocked",
      result.ok === true &&
        result.run.areaReferencePoint == null &&
        result.run.distanceKm == null &&
        !fs.existsSync(recordedAreaReferencePath(BROOK, "mickleover")),
      result.ok ? `hits-empty km=${result.run.distanceKm}` : result.error,
    );
  });

  const leakRoot = tmpRoot();
  const leakLog = { places: 0, queries: [] as string[], areas: [] as string[], callIds: [] as string[] };
  seedMickleoverCompletedRun(leakRoot);
  await withHarness(leakRoot, adapters({ callLog: leakLog, areaHits: [ALLESTREE_HIT] }), async () => {
    authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "mickleover",
      spendingCapUsd: 0.2,
      confirmAuthorise: true,
    });
    const result = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "mickleover" });
    record(
      "allestree-hit-rejected-for-mickleover",
      result.ok === true &&
        result.run.areaReferencePoint == null &&
        !fs.existsSync(recordedAreaReferencePath(BROOK, "mickleover")),
      result.ok ? `ref=${String(result.run.areaReferencePoint)}` : result.error,
    );
  });

  const tenantRoot = tmpRoot();
  seedMickleoverCompletedRun(tenantRoot);
  await withHarness(tenantRoot, adapters({ callLog: { places: 0, queries: [], areas: [], callIds: [] } }), async () => {
    authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "mickleover",
      spendingCapUsd: 0.2,
      confirmAuthorise: true,
    });
    const yorkshire = await startLocalPageEvidenceCollection({
      slug: YORKSHIRE,
      serviceId: SERVICE,
      areaSlug: "wombwell",
    });
    record(
      "tenant-and-campaign-isolation",
      yorkshire.ok === false && yorkshire.status === 403 && !fs.existsSync(recordedAreaReferencePath(BROOK, "mickleover")),
      yorkshire.ok ? "unexpected ok" : `${yorkshire.status} ${yorkshire.error}`,
    );
    const allestree = await startLocalPageEvidenceCollection({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "allestree",
    });
    record(
      "campaign-area-isolation-allestree-not-authorised-by-mickleover-plan",
      allestree.ok === false,
      allestree.ok ? "unexpected ok" : `${allestree.status} ${allestree.error}`,
    );
  });

  for (const rel of PROTECTED) {
    record(`protected-${path.basename(path.dirname(rel))}-${path.basename(rel)}`, sha256File(rel) === before[rel], rel);
  }
  const liveMickleoverRefAfter = fs.existsSync(liveMickleoverRef)
    ? createHash("sha256").update(fs.readFileSync(liveMickleoverRef)).digest("hex")
    : "absent";
  record(
    "live-mickleover-reference-not-rewritten",
    liveMickleoverRefAfter === liveMickleoverRefBefore,
    liveMickleoverRef,
  );
  const campaignAfter = JSON.parse(
    fs.readFileSync(
      path.join(
        PHARMACY_WORKSPACE_ROOT,
        "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json",
      ),
      "utf8",
    ),
  ) as { runId?: string; status?: string };
  record(
    "stopped-campaign-run-unchanged-after",
    campaignAfter.runId === "e23b2020-b520-453c-a7a5-45d301316229" &&
      campaignAfter.status === "stopped" &&
      sha256File("data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json") ===
        before["data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json"],
    `runId=${campaignAfter.runId} status=${campaignAfter.status}`,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
