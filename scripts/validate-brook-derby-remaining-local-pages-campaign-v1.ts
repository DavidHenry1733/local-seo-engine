#!/usr/bin/env npx tsx
/**
 * Brook Derby campaign-level remaining local-page run.
 * Fixture tests only: does not collect evidence, generate, grant allowance, publish, or start a live Brook run.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import {
  CREATE_REMAINING_LOCAL_PAGES_LABEL,
  clearRemainingLocalPagesCampaignRuntimeForTests,
  confirmRemainingLocalPagesCampaign,
  planRemainingLocalPagesCampaign,
  remainingLocalPagesCampaignRunPath,
  type RemainingLocalPagesAreaPlan,
  type RemainingLocalPagesCampaignDeps,
} from "../src/pharmacy/growthEngineLocalPageCampaignRunService.ts";
import { BROOK_DERBY_DEMO_SLUG, isOneLocalPageCandidateArea } from "../src/pharmacy/contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const ALLESTREE_HTML =
  "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html";
const ALLESTREE_COPY = "data/pharmacy-ai-local-copy-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/allestree.json";
const ALLESTREE_SESSION = "data/growth-engine/brook-pharmacy-demo-derby-campaign-builder.json";
const ALLESTREE_BUDGET =
  "data/pharmacy-ai-local-generation-budget/brook-pharmacy-demo-derby/pharmacy-first/v3/brook-pharmacy-demo-derby:pharmacy-first:v3:one-local-page:allestree.json";
const ALLESTREE_PROTECTED = [ALLESTREE_HTML, ALLESTREE_COPY, ALLESTREE_BUDGET, ALLESTREE_SESSION];

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

const AREAS = [
  { areaName: "Allestree", areaSlug: "allestree" },
  { areaName: "Mickleover", areaSlug: "mickleover" },
  { areaName: "Littleover", areaSlug: "littleover" },
];

function fixtureDeps(opts: {
  runRoot: string;
  processed: string[];
  failAt?: string;
  failStage?: "evidence" | "distance" | "generation" | "validation";
  failError?: string;
  delayMs?: number;
}): RemainingLocalPagesCampaignDeps {
  return {
    runRoot: opts.runRoot,
    listSelectedAreas: () => AREAS,
    hasValidCandidate: (_slug, _service, areaSlug) => areaSlug === "allestree",
    planEvidence: (_slug, _service, areaSlug) => ({
      estimatedCostUsd: 0.068,
      proposedCalls: [
        { required: true, cached: false },
        { required: true, cached: false },
        { required: true, cached: false },
        { required: true, cached: false },
      ],
      collectionRunStatus: areaSlug === "mickleover" ? "completed" : null,
      collectionOutcomeSummary:
        areaSlug === "mickleover" ? "EVIDENCE LIMITED: no verified pharmacy relationship or access fact." : null,
    }),
    preflightArea: (_slug, _service, areaSlug) =>
      ({
        localEvidence: { status: areaSlug === "allestree" ? "ready" : "missing" },
        editorialEvidence: { status: areaSlug === "allestree" ? "ready" : areaSlug === "mickleover" ? "EVIDENCE LIMITED" : "missing" },
        previewUrl: `/preview/${areaSlug}`,
        reviewUrl: "/review",
        blocker: areaSlug === "allestree" ? null : `Saved ${areaSlug} evidence is missing.`,
      }) as never,
    processArea: async (area: RemainingLocalPagesAreaPlan) => {
      opts.processed.push(area.areaSlug);
      if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      if (opts.failAt && area.areaSlug === opts.failAt) {
        return {
          ok: false,
          stage: opts.failStage || "generation",
          error: opts.failError || "fixture generation failed",
        };
      }
      return { ok: true, stage: "save", previewUrl: `/preview/${area.areaSlug}`, reviewUrl: "/review" };
    },
  };
}

async function main() {
  console.log("\n=== Brook Derby campaign-level remaining local pages (no live run) ===\n");
  const protectedBefore = Object.fromEntries(ALLESTREE_PROTECTED.map((rel) => [rel, sha256File(rel)]));
  const liveRunPath = remainingLocalPagesCampaignRunPath(BROOK_DERBY_DEMO_SLUG, SERVICE);
  const liveRunExisted = fs.existsSync(liveRunPath);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "remaining-local-pages-"));

  try {
    const session = loadCampaignBuilderSession(BROOK_DERBY_DEMO_SLUG);
    record(
      "selections-unchanged",
      session.selectedServiceId === SERVICE && (session.targetAreaNames || []).length === 10,
      `campaign=${session.selectedServiceId} count=${(session.targetAreaNames || []).length}`,
    );

    const plan = planRemainingLocalPagesCampaign(BROOK_DERBY_DEMO_SLUG, SERVICE);
    record(
      "skip-allestree-complete",
      plan.complete.some((row) => row.areaSlug === "allestree") &&
        !plan.remaining.some((row) => row.areaSlug === "allestree"),
      `complete=${plan.complete.map((row) => row.areaSlug).join(",")} remaining=${plan.remaining.length}`,
    );
    record(
      "remaining-are-the-other-nine",
      plan.remaining.length === 9 &&
        plan.remaining[0]?.areaSlug === "mickleover" &&
        plan.remaining.map((row) => row.areaSlug).includes("littleover") &&
        plan.remaining.map((row) => row.areaSlug).includes("borrowash"),
      plan.remaining.map((row) => row.areaSlug).join(","),
    );

    const mickleover = plan.remaining.find((row) => row.areaSlug === "mickleover");
    const littleover = plan.remaining.find((row) => row.areaSlug === "littleover");
    record(
      "mickleover-currently-ready-still-in-openai-max",
      mickleover?.evidenceReady === true &&
        mickleover?.evidenceBlocked === false &&
        mickleover?.evidenceCollectionRequired === false &&
        mickleover?.maxEvidenceCalls === 0 &&
        mickleover?.maxGenerationCalls === 1 &&
        mickleover?.maxGenerationCostUsd === 2,
      `ready=${mickleover?.evidenceReady} evidenceCalls=${mickleover?.maxEvidenceCalls} openai=${mickleover?.maxGenerationCalls}`,
    );
    record(
      "littleover-evidence-requiring-collection-counts-openai-max",
      Boolean(littleover?.evidenceCollectionRequired) &&
        littleover?.evidenceReady === false &&
        littleover?.maxGenerationCalls === 1,
      `collectionRequired=${littleover?.evidenceCollectionRequired} openai=${littleover?.maxGenerationCalls}`,
    );
    const expectedEvidenceCalls = plan.remaining.reduce((sum, row) => sum + row.maxEvidenceCalls, 0);
    const expectedGenerationCalls = plan.remaining.reduce((sum, row) => sum + row.maxGenerationCalls, 0);
    const expectedEvidenceCost = plan.remaining.reduce((sum, row) => sum + row.maxEvidenceCostUsd, 0);
    const expectedGenerationCost = plan.remaining.reduce((sum, row) => sum + row.maxGenerationCostUsd, 0);
    record(
      "accurate-maximum-cost-display",
      plan.maxEvidenceCalls === expectedEvidenceCalls &&
        plan.maxGenerationCalls === expectedGenerationCalls &&
        plan.maxProviderCalls === expectedEvidenceCalls + expectedGenerationCalls &&
        Math.abs(plan.maxEvidenceCostUsd - expectedEvidenceCost) < 0.0001 &&
        Math.abs(plan.maxGenerationCostUsd - expectedGenerationCost) < 0.0001 &&
        Math.abs(plan.maxTotalCostUsd - (plan.maxEvidenceCostUsd + plan.maxGenerationCostUsd)) < 0.0001 &&
        plan.remaining.length === 9 &&
        plan.maxGenerationCalls === 9 &&
        plan.maxGenerationCostUsd === 18 &&
        plan.evidenceCurrentlyReadyCount === 1 &&
        plan.evidenceRequiringCollectionCount === 8 &&
        plan.generationCurrentlyBlockedCount === 0,
      `evidenceCalls=${plan.maxEvidenceCalls} openai=${plan.maxGenerationCalls} evidence=${plan.maxEvidenceCostLabel} gen=${plan.maxGenerationCostLabel} total=${plan.maxTotalCostLabel} ready=${plan.evidenceCurrentlyReadyCount} collect=${plan.evidenceRequiringCollectionCount} blocked=${plan.generationCurrentlyBlockedCount}`,
    );

    const html = renderCampaignBuilderPage(BROOK_DERBY_DEMO_SLUG, "areas", { area: "allestree" });
    record(
      "ui-campaign-action-present",
      html.includes(`id="btnCreateRemainingLocalPages"`) &&
        html.includes(CREATE_REMAINING_LOCAL_PAGES_LABEL) &&
        html.includes(`id="confirmCreateRemainingLocalPages"`) &&
        html.includes('data-remaining-local-pages="true"') &&
        html.includes('id="btnResumeRemainingLocalPages" disabled') &&
        html.includes("Resume remaining local pages"),
      "Campaign Builder areas step shows Create remaining and stopped-state Resume",
    );
    record(
      "ui-confirmation-disabled-until-checkbox",
      html.includes('id="btnCreateRemainingLocalPages" disabled') &&
        html.includes("I confirm this campaign-level run for this authenticated pharmacy"),
      "Start stays disabled until explicit confirmation",
    );
    record(
      "ui-lists-complete-and-remaining",
      html.includes('data-complete-area="allestree"') &&
        html.includes('data-remaining-area="mickleover"') &&
        html.includes('data-remaining-area="littleover"') &&
        html.includes(`data-remaining-count="9"`) &&
        html.includes(`data-complete-count="1"`),
      "Confirmation panel lists Allestree complete and the nine remaining areas",
    );
    record(
      "ui-shows-maximum-cost",
      html.includes(`data-max-total-cost-usd="${plan.maxTotalCostUsd}"`) &&
        html.includes(plan.maxTotalCostLabel) &&
        html.includes(plan.maxProviderCallsLabel) &&
        html.includes(`data-max-generation-calls="${plan.maxGenerationCalls}"`) &&
        html.includes('data-evidence-currently-ready="true"') &&
        html.includes("Evidence currently ready") &&
        html.includes("Evidence requiring collection") &&
        html.includes("Generation currently blocked") &&
        html.includes("Maximum generation calls if collection succeeds") &&
        html.includes("even when its evidence is not READY before collection"),
      `max total ${plan.maxTotalCostLabel}; ${plan.maxProviderCallsLabel}`,
    );

    const yorkshireHtml = renderCampaignBuilderPage(YORKSHIRE, "areas");
    record(
      "tenant-isolation-ui",
      !yorkshireHtml.includes('data-complete-area="allestree"') &&
        !yorkshireHtml.includes('data-remaining-area="mickleover"') &&
        !yorkshireHtml.includes("brook-pharmacy-demo-derby"),
      "Yorkshire Campaign Builder does not show Brook remaining areas",
    );
    const yorkshirePlan = planRemainingLocalPagesCampaign(YORKSHIRE, SERVICE);
    record(
      "tenant-isolation-plan",
      !yorkshirePlan.remaining.some((row) => row.areaSlug === "allestree" || row.areaSlug === "mickleover") &&
        !yorkshirePlan.complete.some((row) => row.areaSlug === "allestree"),
      `yorkshire remaining=${yorkshirePlan.remaining.map((row) => row.areaSlug).join(",") || "none"}`,
    );

    const noConfirm = await confirmRemainingLocalPagesCampaign({
      slug: BROOK_DERBY_DEMO_SLUG,
      serviceId: SERVICE,
      confirmAuthorise: false,
      authenticatedSlug: BROOK_DERBY_DEMO_SLUG,
    });
    record(
      "confirmation-required",
      noConfirm.ok === false &&
        noConfirm.status === 403 &&
        fs.existsSync(liveRunPath) === liveRunExisted,
      noConfirm.ok ? "started" : noConfirm.error,
    );
    const crossTenant = await confirmRemainingLocalPagesCampaign({
      slug: BROOK_DERBY_DEMO_SLUG,
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: YORKSHIRE,
    });
    record(
      "tenant-isolation-confirm",
      crossTenant.ok === false &&
        crossTenant.status === 403 &&
        fs.existsSync(liveRunPath) === liveRunExisted,
      crossTenant.ok ? "started" : crossTenant.error,
    );

    clearRemainingLocalPagesCampaignRuntimeForTests();
    const sequentialProcessed: string[] = [];
    const sequential = await confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-fixture",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-fixture",
      processInline: true,
      deps: fixtureDeps({
        runRoot: path.join(tmp, "sequential"),
        processed: sequentialProcessed,
        failAt: "littleover",
        failStage: "generation",
        failError: "fixture OpenAI refused",
      }),
    });
    record(
      "sequential-processing",
      sequential.ok === true &&
        sequentialProcessed.join(",") === "mickleover,littleover" &&
        sequential.run.areas.filter((row) => row.status === "completed").map((row) => row.areaSlug).join(",") ===
          "mickleover",
      `processed=${sequentialProcessed.join(",")}`,
    );
    record(
      "completed-area-skipping",
      sequential.ok === true &&
        sequential.run.areas.find((row) => row.areaSlug === "allestree")?.status === "skipped-complete" &&
        !sequentialProcessed.includes("allestree"),
      "Allestree was not processed",
    );
    record(
      "stop-on-failure",
      sequential.ok === true &&
        sequential.run.status === "stopped" &&
        sequential.run.failedAreaSlug === "littleover" &&
        sequential.run.failedStage === "generation" &&
        sequential.run.failedError === "fixture OpenAI refused" &&
        sequential.run.areas.find((row) => row.areaSlug === "mickleover")?.status === "completed",
      `status=${sequential.ok ? sequential.run.status : "err"} failed=${sequential.ok ? sequential.run.failedStage : sequential.error}`,
    );

    clearRemainingLocalPagesCampaignRuntimeForTests();
    const duplicateProcessed: string[] = [];
    const dupDeps = fixtureDeps({
      runRoot: path.join(tmp, "duplicate"),
      processed: duplicateProcessed,
      delayMs: 40,
    });
    const first = confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-duplicate",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-duplicate",
      processInline: true,
      deps: dupDeps,
    });
    const second = confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-duplicate",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-duplicate",
      processInline: true,
      deps: dupDeps,
    });
    const [dupA, dupB] = await Promise.all([first, second]);
    record(
      "duplicate-submission-reload-safety",
      dupA.ok === true &&
        dupB.ok === true &&
        dupA.run.runId === dupB.run.runId &&
        (dupA.duplicate === true || dupB.duplicate === true) &&
        duplicateProcessed.join(",") === "mickleover,littleover" &&
        dupA.run.status === "completed" &&
        dupB.run.status === "completed",
      `runId match=${dupA.ok && dupB.ok && dupA.run.runId === dupB.run.runId} processed=${duplicateProcessed.join(",")} dup=${dupA.ok && dupA.duplicate}/${dupB.ok && dupB.duplicate}`,
    );

    clearRemainingLocalPagesCampaignRuntimeForTests();
    const resumeRoot = path.join(tmp, "resume");
    const resumeProcessed: string[] = [];
    const seed = await confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-resume",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume",
      processInline: true,
      deps: fixtureDeps({
        runRoot: resumeRoot,
        processed: [],
        failAt: "littleover",
        failStage: "evidence",
        failError: "interrupted-seed",
      }),
    });
    if (seed.ok) {
      const seededPath = remainingLocalPagesCampaignRunPath("campaign-run-resume", SERVICE, resumeRoot);
      const seeded = JSON.parse(fs.readFileSync(seededPath, "utf8")) as {
        status: string;
        failedAreaSlug: string | null;
        failedStage: string | null;
        failedError: string | null;
        completedAt: string | null;
        areas: Array<{ areaSlug: string; status: string; error: string | null; stage: string | null }>;
      };
      seeded.status = "interrupted";
      seeded.failedAreaSlug = null;
      seeded.failedStage = null;
      seeded.failedError = null;
      seeded.completedAt = null;
      for (const area of seeded.areas) {
        if (area.areaSlug === "littleover") {
          area.status = "pending";
          area.error = null;
          area.stage = null;
        }
      }
      fs.writeFileSync(seededPath, `${JSON.stringify(seeded, null, 2)}\n`);
    }
    clearRemainingLocalPagesCampaignRuntimeForTests();
    const resumed = await confirmRemainingLocalPagesCampaign({
      slug: "campaign-run-resume",
      serviceId: SERVICE,
      confirmAuthorise: true,
      authenticatedSlug: "campaign-run-resume",
      processInline: true,
      deps: fixtureDeps({
        runRoot: resumeRoot,
        processed: resumeProcessed,
      }),
    });
    record(
      "resume-same-durable-run",
      seed.ok === true &&
        resumed.ok === true &&
        resumed.duplicate === true &&
        resumed.run.runId === seed.run.runId &&
        resumeProcessed.join(",") === "littleover" &&
        resumed.run.areas.find((row) => row.areaSlug === "mickleover")?.status === "completed" &&
        resumed.run.status === "completed",
      `sameRun=${seed.ok && resumed.ok && seed.run.runId === resumed.run.runId} processed=${resumeProcessed.join(",")}`,
    );

    record(
      "live-brook-run-not-started",
      fs.existsSync(liveRunPath) === liveRunExisted,
      liveRunExisted ? "pre-existing run file left untouched" : "no live Brook campaign run file was written",
    );
    record(
      "one-local-page-path-unchanged",
      isOneLocalPageCandidateArea(BROOK_DERBY_DEMO_SLUG, "mickleover") &&
        !isOneLocalPageCandidateArea(YORKSHIRE, "wombwell"),
      "selected Brook areas stay on the one-local-page path",
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    clearRemainingLocalPagesCampaignRuntimeForTests();
  }

  for (const rel of ALLESTREE_PROTECTED) {
    record(`preserve-${path.basename(rel)}`, sha256File(rel) === protectedBefore[rel], rel);
  }

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
