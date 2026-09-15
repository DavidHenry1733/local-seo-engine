#!/usr/bin/env npx tsx
/**
 * User-authorised one-local-page evidence collection.
 * Fixture adapters only. No live Places, DataForSEO, OpenAI or generation.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  authoriseLocalPageEvidencePlan,
  decorateLocalPageEvidencePlan,
  INTERRUPTED_COLLECTION_FIXTURE,
  resetEvidenceCollectionTestHarness,
  setEvidenceCollectionTestHarness,
  startLocalPageEvidenceCollection,
  type EvidenceCollectionAdapters,
  type EvidencePlacesHit,
} from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import {
  EVIDENCE_PREP_PAID_AUTHORISED,
  planOneLocalPageEvidencePreparation,
} from "../src/pharmacy/growthEngineLocalPageEvidencePreparationService.ts";
import { PLACES_TEXT_SEARCH_PRO_LIST_USD } from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";

const BROOK = "brook-pharmacy-demo-derby";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

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

const GP_HIT: EvidencePlacesHit = {
  name: "Park Farm Medical Centre",
  address: "Park Farm Centre, Allestree, Derby, Derbyshire",
  types: ["doctor", "health", "point_of_interest"],
  location: { latitude: 52.9171, longitude: -1.4827 },
  placeId: "fixture-park-farm-gp",
  locality: "Allestree",
  sourceRef: "https://maps.google.com/?cid=fixture-gp",
};

const AREA_HIT: EvidencePlacesHit = {
  name: "Allestree",
  address: "Allestree, Derby, UK",
  types: ["neighborhood", "locality"],
  location: { latitude: 52.9548, longitude: -1.5482 },
  placeId: "fixture-allestree-ref",
  locality: "Allestree",
};

const GP_PAGE = {
  url: "https://www.nhs.uk/services/gp-surgery/park-farm-medical-centre/Y02612",
  title: "Park Farm Medical Centre",
  description: "NHS GP surgery in Allestree, Derby.",
};

const LOCALITY_PAGE = {
  url: "https://www.derby.gov.uk/council-and-democracy/ward-profiles/allestree/",
  title: "Allestree ward — Derby City Council",
  description: "Official locality information for Allestree.",
};

const GP_BODY = `Park Farm Medical Centre provides NHS general practice services.
Patients in Allestree can register at Park Farm Medical Centre.
The surgery is in Allestree near Park Farm. This page is an official NHS listing.`;

const LOCALITY_BODY = `Allestree is a suburb of Derby in the East Midlands.
Allestree Library is on Park Farm Centre and offers council information.
Derby City Council publishes this official ward information for Allestree residents.`;

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "evidence-collection-"));
}

function counts() {
  return { places: 0, organic: 0, pages: 0 };
}

function adapters(opts: {
  gpHits?: EvidencePlacesHit[];
  areaHits?: EvidencePlacesHit[];
  organicCost?: number | null;
  emptyGpSearch?: boolean;
  interruptAfter?: string;
  callLog: { places: number; organic: number; pages: number };
}): EvidenceCollectionAdapters {
  return {
    placesSearch: async (query) => {
      opts.callLog.places += 1;
      if (/locality/i.test(query) && !/GP|surgery|medical/i.test(query)) {
        return { hits: opts.areaHits || [AREA_HIT], costUsd: PLACES_TEXT_SEARCH_PRO_LIST_USD };
      }
      return { hits: opts.gpHits ?? [GP_HIT], costUsd: PLACES_TEXT_SEARCH_PRO_LIST_USD };
    },
    organicSearch: async (query) => {
      opts.callLog.organic += 1;
      const gp = /GP|NHS|surgery/i.test(query);
      return {
        query,
        capturedAt: new Date().toISOString(),
        costUsd: opts.organicCost === undefined ? 0.002 : opts.organicCost,
        uncertain: opts.organicCost === null,
        results: gp ? (opts.emptyGpSearch ? [] : [GP_PAGE]) : [LOCALITY_PAGE],
      };
    },
    fetchPage: async (url) => {
      opts.callLog.pages += 1;
      const gp = url.includes("nhs.uk");
      return {
        url,
        title: gp ? GP_PAGE.title : LOCALITY_PAGE.title,
        status: 200,
        textSample: gp ? GP_BODY : LOCALITY_BODY,
        retrievedAt: new Date().toISOString(),
      };
    },
    afterCall: async (callId) => {
      if (opts.interruptAfter && callId === opts.interruptAfter) {
        throw new Error(INTERRUPTED_COLLECTION_FIXTURE);
      }
    },
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

async function main() {
  console.log("\n=== Authorised evidence collection (fixtures, no live APIs) ===\n");
  record("blanket-execution-flag-stays-off", EVIDENCE_PREP_PAID_AUTHORISED === false, `flag=${EVIDENCE_PREP_PAID_AUTHORISED}`);
  const livePackPath = path.join(
    process.cwd(),
    "data/pharmacy-local-relevance-packs/brook-pharmacy-demo-derby/allestree.json",
  );
  const livePackBefore = fs.existsSync(livePackPath) ? fs.readFileSync(livePackPath, "utf8") : "";

  const isolatedRoot = tmpRoot();
  await withHarness(isolatedRoot, adapters({ callLog: counts() }), async () => {
    const plan = planOneLocalPageEvidencePreparation(BROOK, SERVICE, "Allestree");
    const decorated = decorateLocalPageEvidencePlan(plan);
    record(
      "start-disabled-without-authorisation",
      decorated.paidCollectionAuthorised === false && decorated.startPaidCollectionEnabled === false,
      `authorised=${decorated.paidCollectionAuthorised} start=${decorated.startPaidCollectionEnabled}`,
    );
  });

  const noConfirm = authoriseLocalPageEvidencePlan({
    slug: BROOK,
    serviceId: SERVICE,
    areaSlug: "allestree",
    spendingCapUsd: 1,
    confirmAuthorise: false,
  });
  record("authorise-requires-explicit-confirm", noConfirm.ok === false && noConfirm.status === 403, noConfirm.ok ? "ok" : noConfirm.error);

  const successRoot = tmpRoot();
  const successLog = counts();
  await withHarness(successRoot, adapters({ callLog: successLog }), async () => {
    const auth = authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "allestree",
      spendingCapUsd: 1,
      confirmAuthorise: true,
    });
    record("authorise-success", auth.ok === true && auth.ok && auth.authorisation.budgetKind === "evidence-only", auth.ok ? `cap=${auth.authorisation.spendingCapUsd}` : auth.error);
    if (!auth.ok) return;
    record("authorise-enables-start", decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(BROOK, SERVICE, "Allestree")).startPaidCollectionEnabled === true, "server authorisation matches fingerprint");
    const first = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "allestree" });
    record(
      "collect-success",
      first.ok === true && first.ok && first.run.status === "completed" && first.run.paidCallsMade >= 3 && first.run.verifiedGpPracticeCount >= 1,
      first.ok ? `status=${first.run.status} paid=${first.run.paidCallsMade} gps=${first.run.verifiedGpPracticeCount} spent=${first.run.spentUsd}` : first.error,
    );
    record(
      "collect-saves-bodies-and-distance",
      first.ok === true &&
        Boolean(first.run.pagesByCall["page-body-locality"]?.textSample) &&
        first.run.distanceKm != null &&
        first.run.spentUsd > 0 &&
        first.run.spentUsd <= 1,
      first.ok ? `pages=${Object.keys(first.run.pagesByCall).join(",")} km=${first.run.distanceKm}` : first.error,
    );
    const placesBeforeDuplicate = successLog.places;
    const second = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "allestree" });
    record(
      "duplicate-submission-does-not-recall",
      second.ok === true && second.duplicate === true && successLog.places === placesBeforeDuplicate && second.run.runId === first.run.runId,
      second.ok ? `duplicate=${second.duplicate} places=${successLog.places}` : second.error,
    );
  });

  const budgetRoot = tmpRoot();
  const budgetLog = counts();
  await withHarness(budgetRoot, adapters({ callLog: budgetLog }), async () => {
    const auth = authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "allestree",
      spendingCapUsd: 0.01,
      confirmAuthorise: true,
    });
    if (!auth.ok) {
      record("insufficient-budget-authorise", false, auth.error);
      return;
    }
    const result = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "allestree" });
    record(
      "insufficient-budget-stops-before-paid-call",
      result.ok === true &&
        result.run.status === "stopped" &&
        result.run.paidCallsMade === 0 &&
        budgetLog.places === 0 &&
        budgetLog.organic === 0 &&
        /0\.032/.test(result.run.stopReason || "") &&
        /0\.010/.test(result.run.stopReason || ""),
      result.ok ? `status=${result.run.status} paid=${result.run.paidCallsMade} places=${budgetLog.places} ${result.run.stopReason}` : result.error,
    );
  });

  const interruptRoot = tmpRoot();
  const interruptLog = counts();
  await withHarness(
    interruptRoot,
    adapters({ callLog: interruptLog, interruptAfter: "places-gp-practices" }),
    async () => {
      authoriseLocalPageEvidencePlan({
        slug: BROOK,
        serviceId: SERVICE,
        areaSlug: "allestree",
        spendingCapUsd: 1,
        confirmAuthorise: true,
      });
      const interrupted = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "allestree" });
      record(
        "interrupted-collection-persists",
        interrupted.ok === true && interrupted.run.status === "interrupted" && interrupted.run.paidCallsMade === 1 && interruptLog.places === 1,
        interrupted.ok ? `status=${interrupted.run.status} paid=${interrupted.run.paidCallsMade}` : interrupted.error,
      );
    },
  );
  const resumeLog = counts();
  await withHarness(interruptRoot, adapters({ callLog: resumeLog }), async () => {
    const resumed = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "allestree" });
    const gpCall = resumed.ok ? resumed.run.calls.find((row) => row.id === "places-gp-practices") : null;
    record(
      "resume-does-not-repeat-consumed-call",
      resumed.ok === true &&
        resumed.run.status === "completed" &&
        gpCall?.status === "consumed" &&
        resumeLog.places === 1 &&
        resumed.run.paidCallsMade >= 3,
      resumed.ok ? `status=${resumed.run.status} resumePlaces=${resumeLog.places} paid=${resumed.run.paidCallsMade}` : resumed.error,
    );
  });

  const zeroRoot = tmpRoot();
  const zeroLog = counts();
  await withHarness(zeroRoot, adapters({ callLog: zeroLog, gpHits: [], emptyGpSearch: true }), async () => {
    authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "allestree",
      spendingCapUsd: 1,
      confirmAuthorise: true,
    });
    const result = await startLocalPageEvidenceCollection({ slug: BROOK, serviceId: SERVICE, areaSlug: "allestree" });
    record(
      "zero-verified-gp-is-valid-outcome",
      result.ok === true &&
        result.run.status === "completed" &&
        result.run.verifiedGpPracticeCount === 0 &&
        result.run.editorialSufficiency === "READY" &&
        /zero verified GP/i.test(result.run.findings.join(" ")) &&
        result.run.distanceKm != null,
      result.ok
        ? `gps=${result.run.verifiedGpPracticeCount} sufficiency=${result.run.editorialSufficiency} km=${result.run.distanceKm}`
        : result.error,
    );
  });

  const crossRoot = tmpRoot();
  await withHarness(crossRoot, adapters({ callLog: counts() }), async () => {
    authoriseLocalPageEvidencePlan({
      slug: BROOK,
      serviceId: SERVICE,
      areaSlug: "allestree",
      spendingCapUsd: 1,
      confirmAuthorise: true,
    });
    const yorkshire = await startLocalPageEvidenceCollection({
      slug: YORKSHIRE,
      serviceId: SERVICE,
      areaSlug: "wombwell",
    });
    record(
      "cross-tenant-collection-denied",
      yorkshire.ok === false && yorkshire.status === 403,
      yorkshire.ok ? "unexpected ok" : `${yorkshire.status} ${yorkshire.error}`,
    );
  });

  const livePackAfter = fs.existsSync(livePackPath) ? fs.readFileSync(livePackPath, "utf8") : "";
  record(
    "fixture-collection-did-not-rewrite-live-allestree-pack",
    livePackAfter === livePackBefore,
    livePackPath,
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
