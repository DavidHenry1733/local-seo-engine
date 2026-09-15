#!/usr/bin/env npx tsx
/**
 * Same-run Resume remaining local pages for a stopped campaign-level run.
 * Fixture tests only: does not collect, generate, publish, or resume the live Brook run.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  CREATE_REMAINING_LOCAL_PAGES_LABEL,
  RESUME_REMAINING_LOCAL_PAGES_LABEL,
  applyCurrentPlanToStoppedCampaignRun,
  clearRemainingLocalPagesCampaignRuntimeForTests,
  confirmRemainingLocalPagesCampaign,
  executeRemainingLocalPageAreaWorkflow,
  getRemainingLocalPagesCampaign,
  hasSavedValidLocalPageCandidate,
  planRemainingLocalPagesCampaign,
  remainingLocalPagesCampaignRunPath,
  resumeRemainingLocalPagesCampaign,
  type RemainingLocalPagesAreaPlan,
  type RemainingLocalPagesCampaignDeps,
  type RemainingLocalPagesCampaignRun,
} from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import { BROOK_DERBY_DEMO_SLUG } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const LIVE_RUN_ID = "e23b2020-b520-453c-a7a5-45d301316229";
const LIVE_RUN = "data/pharmacy-local-page-campaign-runs/brook-pharmacy-demo-derby/pharmacy-first/v1/remaining-local-pages.json";
const ALLESTREE_COPY = "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json";

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
  return createHash("sha256").update(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, rel))).digest("hex");
}

const AREAS = [
  { areaName: "Allestree", areaSlug: "allestree" },
  { areaName: "Mickleover", areaSlug: "mickleover" },
  { areaName: "Littleover", areaSlug: "littleover" },
];

function readyDeps(opts: {
  runRoot: string;
  processed: string[];
  collectionInvoked: string[];
  failAt?: string;
  failStage?: "evidence" | "distance" | "generation" | "validation";
  failError?: string;
  delayMs?: number;
}): RemainingLocalPagesCampaignDeps {
  return {
    runRoot: opts.runRoot,
    listSelectedAreas: () => AREAS,
    hasValidCandidate: (_slug, _service, areaSlug) => areaSlug === "allestree",
    planEvidence: (_slug, _service, areaSlug) =>
      areaSlug === "mickleover"
        ? {
            estimatedCostUsd: 0.1,
            proposedCalls: [{ required: true, cached: true }],
            collectionRunStatus: "completed",
            collectionOutcomeSummary: "Collection finished. Evidence is READY. Spend $0.100.",
          }
        : {
            estimatedCostUsd: 0.068,
            proposedCalls: [
              { required: true, cached: false },
              { required: true, cached: false },
              { required: true, cached: false },
              { required: true, cached: false },
            ],
            collectionRunStatus: null,
            collectionOutcomeSummary: null,
          },
    preflightArea: (_slug, _service, areaSlug) =>
      ({
        localEvidence: { status: areaSlug === "littleover" ? "missing" : "ready" },
        editorialEvidence: { status: areaSlug === "littleover" ? "missing" : "ready" },
        previewUrl: `/preview/${areaSlug}`,
        reviewUrl: "/review",
        blocker: areaSlug === "littleover" ? "Saved Littleover evidence is missing." : null,
        distanceStatus: areaSlug === "mickleover" ? "recorded" : "missing",
        distanceKm: areaSlug === "mickleover" ? 3.7 : null,
      }) as never,
    processArea: async (area: RemainingLocalPagesAreaPlan) => {
      if (area.evidenceCollectionRequired) opts.collectionInvoked.push(area.areaSlug);
      opts.processed.push(area.areaSlug);
      if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      if (opts.failAt && area.areaSlug === opts.failAt) {
        return { ok: false, stage: opts.failStage || "generation", error: opts.failError || "fixture failed" };
      }
      return { ok: true, stage: "save", previewUrl: `/preview/${area.areaSlug}`, reviewUrl: "/review" };
    },
  };
}

function blockedDeps(opts: { runRoot: string; processed: string[] }): RemainingLocalPagesCampaignDeps {
  return {
    runRoot: opts.runRoot,
    listSelectedAreas: () => AREAS,
    hasValidCandidate: (_slug, _service, areaSlug) => areaSlug === "allestree",
    planEvidence: () => ({
      estimatedCostUsd: 0.068,
      proposedCalls: [{ required: true, cached: true }],
      collectionRunStatus: "completed",
      collectionOutcomeSummary: "Collection finished. Evidence is LIMITED: no verified pharmacy relationship or access fact. Spend $0.068.",
    }),
    preflightArea: (_slug, _service, areaSlug) =>
      ({
        localEvidence: { status: areaSlug === "allestree" ? "ready" : "evidence-limited" },
        editorialEvidence: { status: areaSlug === "allestree" ? "ready" : "EVIDENCE LIMITED" },
        previewUrl: `/preview/${areaSlug}`,
        reviewUrl: "/review",
        blocker: areaSlug === "allestree" ? null : "Saved evidence is missing.",
      }) as never,
    processArea: async (area: RemainingLocalPagesAreaPlan) => {
      opts.processed.push(area.areaSlug);
      return {
        ok: false,
        stage: "evidence",
        error: "Collection finished. Evidence is LIMITED: no verified pharmacy relationship or access fact. Spend $0.068.",
      };
    },
  };
}

async function main() {
  console.log("\n=== Brook Derby remaining local pages Resume (fixtures, no live resume) ===\n");
  const liveBefore = sha256File(LIVE_RUN);
  const allestreeBefore = sha256File(ALLESTREE_COPY);
  const liveRun = JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, LIVE_RUN), "utf8")) as RemainingLocalPagesCampaignRun;
  record(
    "live-stopped-run-identity",
    liveRun.runId === LIVE_RUN_ID &&
      liveRun.status === "stopped" &&
      liveRun.failedAreaSlug === "mickleover" &&
      liveRun.failedStage === "evidence" &&
      liveRun.areas.find((row) => row.areaSlug === "allestree")?.status === "skipped-complete",
    `runId=${liveRun.runId} status=${liveRun.status} failed=${liveRun.failedAreaSlug}/${liveRun.failedStage}`,
  );

  const livePlan = planRemainingLocalPagesCampaign(BROOK_DERBY_DEMO_SLUG, SERVICE);
  const mickleover = livePlan.remaining.find((row) => row.areaSlug === "mickleover");
  record(
    "live-mickleover-ready-recalculated-remaining-max",
    mickleover?.evidenceReady === true &&
      mickleover?.evidenceCollectionRequired === false &&
      mickleover?.evidenceBlocked === false &&
      mickleover?.maxGenerationCalls === 1 &&
      livePlan.evidenceCurrentlyReadyCount === 1 &&
      livePlan.evidenceRequiringCollectionCount === 8 &&
      livePlan.generationCurrentlyBlockedCount === 0 &&
      livePlan.maxGenerationCalls === 9 &&
      livePlan.maxGenerationCostUsd === 18 &&
      livePlan.maxEvidenceCalls === 56 &&
      livePlan.maxEvidenceCostUsd === 0.544 &&
      livePlan.maxTotalCostUsd === 18.544,
    `ready=${livePlan.evidenceCurrentlyReadyCount} collect=${livePlan.evidenceRequiringCollectionCount} blocked=${livePlan.generationCurrentlyBlockedCount} openai=${livePlan.maxGenerationCalls} total=${livePlan.maxTotalCostLabel}`,
  );

  const html = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "mickleover" });
  record(
    "ui-resume-present-disabled-until-confirmation",
    html.includes(RESUME_REMAINING_LOCAL_PAGES_LABEL) &&
      html.includes('id="btnResumeRemainingLocalPages" disabled') &&
      html.includes('id="confirmResumeRemainingLocalPages"') &&
      !html.includes('id="confirmResumeRemainingLocalPages" checked') &&
      html.includes('data-can-resume="true"') &&
      html.includes(`data-run-id="${LIVE_RUN_ID}"`) &&
      html.includes('id="btnCreateRemainingLocalPages" disabled') &&
      html.includes('id="confirmCreateRemainingLocalPages" disabled') &&
      html.includes(CREATE_REMAINING_LOCAL_PAGES_LABEL) &&
      html.includes(`data-max-total-cost-usd="${livePlan.maxTotalCostUsd}"`) &&
      html.includes('data-evidence-currently-ready="true"') &&
      /Stopped at mickleover during evidence/i.test(html),
    "Resume is present, disabled until confirmation; Create remaining stays disabled",
  );
  const yorkshireHtml = renderCampaignBuilderPage(YORKSHIRE, "areas");
  record(
    "tenant-isolation-ui",
    !yorkshireHtml.includes(LIVE_RUN_ID) &&
      !yorkshireHtml.includes('data-remaining-area="mickleover"') &&
      !yorkshireHtml.includes("brook-pharmacy-demo-derby"),
    "Yorkshire UI does not show the Brook stopped run",
  );
  const otherCampaign = getRemainingLocalPagesCampaign(BROOK_DERBY_DEMO_SLUG, "travel-clinic");
  record(
    "campaign-isolation-plan",
    otherCampaign.run == null &&
      otherCampaign.plan.serviceId === "travel-clinic" &&
      !otherCampaign.plan.complete.some((row) => row.areaSlug === "allestree"),
    `otherCampaignRun=${otherCampaign.run?.runId || "none"} complete=${otherCampaign.plan.complete.map((row) => row.areaSlug).join(",") || "none"}`,
  );

  const allestreeSkip = await executeRemainingLocalPageAreaWorkflow(BROOK_DERBY_DEMO_SLUG, SERVICE, {
    areaName: "Allestree",
    areaSlug: "allestree",
    status: "skipped-complete",
    evidenceReady: true,
    evidenceCollectionRequired: false,
    evidenceBlocked: false,
    evidenceBlocker: null,
    maxEvidenceCalls: 0,
    maxEvidenceCostUsd: 0,
    maxGenerationCalls: 0,
    maxGenerationCostUsd: 0,
  });
  record(
    "legacy-allestree-compatibility",
    hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree") === true &&
      allestreeSkip.ok === true &&
      allestreeSkip.duplicate === true &&
      allestreeSkip.stage === "save" &&
      livePlan.complete.some((row) => row.areaSlug === "allestree") &&
      !livePlan.remaining.some((row) => row.areaSlug === "allestree"),
    `valid=${hasSavedValidLocalPageCandidate(BROOK_DERBY_DEMO_SLUG, SERVICE, "allestree")} skip=${allestreeSkip.ok && allestreeSkip.duplicate} stage=${allestreeSkip.stage}`,
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "remaining-local-pages-resume-"));
  try {
    const seedRoot = path.join(tmp, "seed");
    const seedProcessed: string[] = [];
    clearRemainingLocalPagesCampaignRuntimeForTests();
    const seed = await confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-ready",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume-ready",
      processInline: true,
      deps: blockedDeps({ runRoot: seedRoot, processed: seedProcessed }),
    });
    record(
      "seed-stopped-at-mickleover-evidence",
      seed.ok === true &&
        seed.run.status === "stopped" &&
        seed.run.failedAreaSlug === "mickleover" &&
        seed.run.failedStage === "evidence" &&
        seed.run.areas.find((row) => row.areaSlug === "allestree")?.status === "skipped-complete" &&
        seed.run.areas.find((row) => row.areaSlug === "littleover")?.status === "pending",
      seed.ok ? `run=${seed.run.runId} failed=${seed.run.failedAreaSlug}/${seed.run.failedStage}` : seed.error,
    );
    if (!seed.ok) return;

    const noConfirm = await resumeRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-ready",
      serviceId: SERVICE,
      confirmAuthorise: false,
      authenticatedSlug: "campaign-run-resume-ready",
      runId: seed.run.runId,
      deps: readyDeps({ runRoot: seedRoot, processed: [], collectionInvoked: [] }),
    });
    record(
      "resume-confirmation-required",
      noConfirm.ok === false && noConfirm.status === 403,
      noConfirm.ok ? "resumed" : noConfirm.error,
    );

    const crossTenant = await resumeRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-ready",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: YORKSHIRE,
      runId: seed.run.runId,
      deps: readyDeps({ runRoot: seedRoot, processed: [], collectionInvoked: [] }),
    });
    record(
      "tenant-isolation-resume",
      crossTenant.ok === false && crossTenant.status === 403,
      crossTenant.ok ? "resumed" : crossTenant.error,
    );

    const wrongRun = await resumeRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-ready",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume-ready",
      runId: "00000000-0000-4000-8000-000000000000",
      deps: readyDeps({ runRoot: seedRoot, processed: [], collectionInvoked: [] }),
    });
    record(
      "resume-rejects-mismatched-run-id",
      wrongRun.ok === false && wrongRun.status === 409,
      wrongRun.ok ? "resumed" : wrongRun.error,
    );

    const seedRunFile = remainingLocalPagesCampaignRunPath("campaign-run-resume-ready", SERVICE, seedRoot);
    const seedHashBeforeOther = createHash("sha256").update(fs.readFileSync(seedRunFile)).digest("hex");
    const wrongCampaign = await resumeRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-ready",
      serviceId: "travel-clinic",
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume-ready",
      runId: seed.run.runId,
      deps: readyDeps({ runRoot: seedRoot, processed: [], collectionInvoked: [] }),
    });
    record(
      "campaign-isolation-resume",
      wrongCampaign.ok === false &&
        wrongCampaign.status === 409 &&
        createHash("sha256").update(fs.readFileSync(seedRunFile)).digest("hex") === seedHashBeforeOther &&
        (JSON.parse(fs.readFileSync(seedRunFile, "utf8")) as RemainingLocalPagesCampaignRun).status === "stopped" &&
        (JSON.parse(fs.readFileSync(seedRunFile, "utf8")) as RemainingLocalPagesCampaignRun).runId === seed.run.runId,
      wrongCampaign.ok ? "resumed other campaign" : wrongCampaign.error,
    );

    clearRemainingLocalPagesCampaignRuntimeForTests();
    const processed: string[] = [];
    const collectionInvoked: string[] = [];
    const resumed = await resumeRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-ready",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume-ready",
      processInline: true,
      runId: seed.run.runId,
      deps: readyDeps({
        runRoot: seedRoot,
        processed,
        collectionInvoked,
        failAt: "littleover",
        failStage: "generation",
        failError: "fixture OpenAI refused",
      }),
    });
    record(
      "same-run-resume",
      resumed.ok === true &&
        resumed.duplicate === false &&
        resumed.run.runId === seed.run.runId &&
        resumed.run.runId !== LIVE_RUN_ID,
      resumed.ok ? `run=${resumed.run.runId}` : resumed.error,
    );
    record(
      "readiness-re-evaluation-skips-collection",
      resumed.ok === true &&
        processed[0] === "mickleover" &&
        !collectionInvoked.includes("mickleover") &&
        resumed.run.areas.find((row) => row.areaSlug === "mickleover")?.evidenceReady === true &&
        resumed.run.areas.find((row) => row.areaSlug === "mickleover")?.evidenceCollectionRequired === false,
      `processed=${processed.join(",")} collection=${collectionInvoked.join(",") || "none"}`,
    );
    record(
      "completed-call-skipping-allestree",
      resumed.ok === true &&
        !processed.includes("allestree") &&
        resumed.run.areas.find((row) => row.areaSlug === "allestree")?.status === "skipped-complete",
      "Allestree stayed skipped-complete",
    );
    record(
      "sequential-continuation-from-mickleover",
      resumed.ok === true && processed.join(",") === "mickleover,littleover",
      `processed=${processed.join(",")}`,
    );
    record(
      "stop-on-failure-preserves-successful-candidate",
      resumed.ok === true &&
        resumed.run.status === "stopped" &&
        resumed.run.failedAreaSlug === "littleover" &&
        resumed.run.failedStage === "generation" &&
        resumed.run.failedError === "fixture OpenAI refused" &&
        resumed.run.areas.find((row) => row.areaSlug === "mickleover")?.status === "completed" &&
        resumed.run.areas.find((row) => row.areaSlug === "allestree")?.status === "skipped-complete",
      resumed.ok
        ? `status=${resumed.run.status} failed=${resumed.run.failedAreaSlug}/${resumed.run.failedStage}`
        : resumed.error,
    );
    record(
      "accurate-remaining-maximum-cost-on-resume",
      resumed.ok === true &&
        resumed.plan.maxGenerationCalls === 2 &&
        resumed.plan.maxGenerationCostUsd === 4 &&
        resumed.plan.maxEvidenceCalls === 4 &&
        resumed.plan.maxEvidenceCostUsd === 0.068 &&
        resumed.plan.maxTotalCostUsd === 4.068 &&
        resumed.run.maxGenerationCalls === 2 &&
        resumed.run.maxEvidenceCalls === 4 &&
        resumed.run.maxTotalCostUsd === 4.068 &&
        resumed.plan.evidenceCurrentlyReadyCount === 1,
      resumed.ok
        ? `openai=${resumed.run.maxGenerationCalls} evidence=${resumed.run.maxEvidenceCalls} total=${resumed.run.maxTotalCostUsd}`
        : resumed.error,
    );

    const skipRoot = path.join(tmp, "skip-completed");
    const firstProcessed: string[] = [];
    clearRemainingLocalPagesCampaignRuntimeForTests();
    const first = await confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-skip",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume-skip",
      processInline: true,
      deps: readyDeps({
        runRoot: skipRoot,
        processed: firstProcessed,
        collectionInvoked: [],
        failAt: "littleover",
        failStage: "generation",
        failError: "later area failed",
      }),
    });
    const laterProcessed: string[] = [];
    const laterCollection: string[] = [];
    clearRemainingLocalPagesCampaignRuntimeForTests();
    const later = first.ok
      ? await resumeRemainingLocalPagesCampaign({
          slug: "campaign-run-resume-skip",
          serviceId: SERVICE,
          confirmAuthorise: true,
          authenticatedSlug: "campaign-run-resume-skip",
          processInline: true,
          runId: first.run.runId,
          deps: readyDeps({
            runRoot: skipRoot,
            processed: laterProcessed,
            collectionInvoked: laterCollection,
            failAt: "littleover",
            failStage: "generation",
            failError: "later area failed again",
          }),
        })
      : first;
    record(
      "completed-area-not-reprocessed-on-resume",
      first.ok === true &&
        later.ok === true &&
        later.run.runId === first.run.runId &&
        firstProcessed.join(",") === "mickleover,littleover" &&
        laterProcessed.join(",") === "littleover" &&
        !laterCollection.includes("mickleover") &&
        later.run.areas.find((row) => row.areaSlug === "mickleover")?.status === "completed",
      `first=${firstProcessed.join(",")} later=${later.ok ? laterProcessed.join(",") : later.error}`,
    );

    const dupRoot = path.join(tmp, "duplicate");
    const seedDupProcessed: string[] = [];
    clearRemainingLocalPagesCampaignRuntimeForTests();
    const seedDup = await confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-dup",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume-dup",
      processInline: true,
      deps: blockedDeps({ runRoot: dupRoot, processed: seedDupProcessed }),
    });
    clearRemainingLocalPagesCampaignRuntimeForTests();
    const dupProcessed: string[] = [];
    const dupCollection: string[] = [];
    const dupDeps = readyDeps({
      runRoot: dupRoot,
      processed: dupProcessed,
      collectionInvoked: dupCollection,
      delayMs: 40,
    });
    const firstDup = seedDup.ok
      ? resumeRemainingLocalPagesCampaign({
          slug: "campaign-run-resume-dup",
          serviceId: SERVICE,
          confirmAuthorise: true,
          authenticatedSlug: "campaign-run-resume-dup",
          processInline: true,
          runId: seedDup.run.runId,
          deps: dupDeps,
        })
      : Promise.resolve(seedDup);
    const secondDup = seedDup.ok
      ? resumeRemainingLocalPagesCampaign({
          slug: "campaign-run-resume-dup",
          serviceId: SERVICE,
          confirmAuthorise: true,
          authenticatedSlug: "campaign-run-resume-dup",
          processInline: true,
          runId: seedDup.run.runId,
          deps: dupDeps,
        })
      : Promise.resolve(seedDup);
    const [dupA, dupB] = await Promise.all([firstDup, secondDup]);
    record(
      "reload-double-click-reuses-same-execution",
      seedDup.ok === true &&
        dupA.ok === true &&
        dupB.ok === true &&
        dupA.run.runId === seedDup.run.runId &&
        dupB.run.runId === seedDup.run.runId &&
        (dupA.duplicate === true || dupB.duplicate === true) &&
        dupProcessed.join(",") === "mickleover,littleover" &&
        dupA.run.status === "completed" &&
        dupB.run.status === "completed",
      `same=${dupA.ok && dupB.ok && dupA.run.runId === dupB.run.runId} processed=${dupProcessed.join(",")} dup=${dupA.ok && dupA.duplicate}/${dupB.ok && dupB.duplicate}`,
    );

    const missing = await resumeRemainingLocalPagesCampaign({
      slug: "campaign-run-resume-missing",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume-missing",
      deps: readyDeps({ runRoot: path.join(tmp, "missing"), processed: [], collectionInvoked: [] }),
    });
    record(
      "resume-does-not-create-a-new-run",
      missing.ok === false && missing.status === 409,
      missing.ok ? `created ${missing.run.runId}` : missing.error,
    );

    const prepared = applyCurrentPlanToStoppedCampaignRun(
      JSON.parse(JSON.stringify(liveRun)) as RemainingLocalPagesCampaignRun,
      livePlan,
    );
    record(
      "live-run-prepare-keeps-id-and-allestree",
      prepared.runId === LIVE_RUN_ID &&
        prepared.areas.find((row) => row.areaSlug === "allestree")?.status === "skipped-complete" &&
        prepared.areas.find((row) => row.areaSlug === "mickleover")?.status === "pending" &&
        prepared.areas.find((row) => row.areaSlug === "mickleover")?.evidenceReady === true &&
        prepared.maxGenerationCalls === 9 &&
        prepared.maxTotalCostUsd === 18.544,
      `mickleover=${prepared.areas.find((row) => row.areaSlug === "mickleover")?.status} openai=${prepared.maxGenerationCalls}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    clearRemainingLocalPagesCampaignRuntimeForTests();
  }

  record("live-brook-run-not-resumed", sha256File(LIVE_RUN) === liveBefore, LIVE_RUN);
  record("allestree-candidate-unchanged", sha256File(ALLESTREE_COPY) === allestreeBefore, ALLESTREE_COPY);

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
