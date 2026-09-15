/**
 * Campaign-level remaining local-page run.
 * One explicit tenant-scoped confirmation processes incomplete selected areas
 * sequentially through the existing per-area workflow. Does not invent evidence.
 * Does not publish. One OpenAI call per area. No automatic retry.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  AI_LOCAL_PILOT_V3_MAX_COST_USD,
  loadAiLocalCopyPilotV3,
} from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  generateOneLocalPageCandidate,
  listSelectedOneLocalPageCandidateAreas,
  preflightOneLocalPageCandidate,
} from "./growthEngineLocalPageCandidateService.ts";
import { assessSavedLocalPageGenerationReadiness } from "./contentEngine/pharmacyLocalPageGenerationReadinessV1.ts";
import {
  authoriseLocalPageEvidencePlan,
  decorateLocalPageEvidencePlan,
  getLocalPageEvidenceRun,
  startLocalPageEvidenceCollection,
} from "./growthEngineLocalPageEvidenceCollectionService.ts";
import { planOneLocalPageEvidencePreparation } from "./growthEngineLocalPageEvidencePreparationService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const CREATE_REMAINING_LOCAL_PAGES_LABEL = "Create remaining local pages";
export const RESUME_REMAINING_LOCAL_PAGES_LABEL = "Resume remaining local pages";
export const REMAINING_LOCAL_PAGES_CAMPAIGN_KIND = "remaining-local-pages-campaign-run-v1";
export const REMAINING_LOCAL_PAGES_CAMPAIGN_DIRNAME = "data/pharmacy-local-page-campaign-runs";
export const REMAINING_LOCAL_PAGES_CAMPAIGN_VERSION = "v1";

export type RemainingLocalPagesCampaignStatus =
  | "idle"
  | "authorised"
  | "running"
  | "interrupted"
  | "stopped"
  | "completed";

export type RemainingLocalPagesAreaStatus =
  | "pending"
  | "skipped-complete"
  | "running"
  | "completed"
  | "failed";

export type RemainingLocalPagesStage = "evidence" | "distance" | "generation" | "validation" | "save";

export type RemainingLocalPagesAreaPlan = {
  areaName: string;
  areaSlug: string;
  status: RemainingLocalPagesAreaStatus;
  evidenceReady: boolean;
  evidenceCollectionRequired: boolean;
  evidenceBlocked: boolean;
  evidenceBlocker: string | null;
  maxEvidenceCalls: number;
  maxEvidenceCostUsd: number;
  maxGenerationCalls: number;
  maxGenerationCostUsd: number;
  previewUrl?: string;
  reviewUrl?: string;
};

export type RemainingLocalPagesCampaignPlan = {
  slug: string;
  serviceId: string;
  fingerprint: string;
  complete: RemainingLocalPagesAreaPlan[];
  remaining: RemainingLocalPagesAreaPlan[];
  evidenceCurrentlyReadyCount: number;
  evidenceRequiringCollectionCount: number;
  generationCurrentlyBlockedCount: number;
  maxEvidenceCalls: number;
  maxGenerationCalls: number;
  maxProviderCalls: number;
  maxEvidenceCostUsd: number;
  maxGenerationCostUsd: number;
  maxTotalCostUsd: number;
  maxEvidenceCostLabel: string;
  maxGenerationCostLabel: string;
  maxTotalCostLabel: string;
  maxProviderCallsLabel: string;
};

export type RemainingLocalPagesAreaResult = {
  ok: boolean;
  stage: RemainingLocalPagesStage;
  error?: string;
  previewUrl?: string;
  reviewUrl?: string;
  duplicate?: boolean;
};

export type RemainingLocalPagesAreaState = RemainingLocalPagesAreaPlan & {
  stage: RemainingLocalPagesStage | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type RemainingLocalPagesCampaignRun = {
  kind: typeof REMAINING_LOCAL_PAGES_CAMPAIGN_KIND;
  runId: string;
  slug: string;
  serviceId: string;
  fingerprint: string;
  status: Exclude<RemainingLocalPagesCampaignStatus, "idle">;
  confirmedAt: string;
  authorisedBy: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  currentAreaSlug: string | null;
  currentStage: RemainingLocalPagesStage | null;
  failedAreaSlug: string | null;
  failedStage: RemainingLocalPagesStage | null;
  failedError: string | null;
  skippedComplete: RemainingLocalPagesAreaState[];
  remainingAtStart: RemainingLocalPagesAreaState[];
  areas: RemainingLocalPagesAreaState[];
  maxEvidenceCalls: number;
  maxGenerationCalls: number;
  maxProviderCalls: number;
  maxEvidenceCostUsd: number;
  maxGenerationCostUsd: number;
  maxTotalCostUsd: number;
};

export type RemainingLocalPagesCampaignDeps = {
  listSelectedAreas?: (slug: string) => { areaName: string; areaSlug: string }[];
  hasValidCandidate?: (slug: string, serviceId: string, areaSlug: string) => boolean;
  planEvidence?: (
    slug: string,
    serviceId: string,
    areaSlug: string,
  ) => {
    estimatedCostUsd: number;
    proposedCalls: Array<{ required: boolean; cached: boolean }>;
    collectionRunStatus?: string | null;
    collectionOutcomeSummary?: string | null;
  };
  preflightArea?: (
    slug: string,
    serviceId: string,
    areaSlug: string,
  ) => ReturnType<typeof preflightOneLocalPageCandidate>;
  processArea?: (area: RemainingLocalPagesAreaPlan) => Promise<RemainingLocalPagesAreaResult>;
  runRoot?: string;
};

const inFlight = new Map<string, Promise<RemainingLocalPagesCampaignRun>>();

function money(value: number, digits = 3): string {
  return `$${Number(value || 0).toFixed(digits)}`;
}

function roundUsd(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function flightKey(slug: string, serviceId: string): string {
  return `${slug}:${serviceId}`;
}

export function remainingLocalPagesCampaignRunRoot(explicit?: string): string {
  return (
    explicit ||
    process.env.PHARMACY_LOCAL_PAGE_CAMPAIGN_RUN_ROOT ||
    path.join(PHARMACY_WORKSPACE_ROOT, REMAINING_LOCAL_PAGES_CAMPAIGN_DIRNAME)
  );
}

export function remainingLocalPagesCampaignRunPath(
  slug: string,
  serviceId: string,
  explicitRoot?: string,
): string {
  return path.join(
    remainingLocalPagesCampaignRunRoot(explicitRoot),
    slug,
    serviceId,
    REMAINING_LOCAL_PAGES_CAMPAIGN_VERSION,
    "remaining-local-pages.json",
  );
}

export function hasSavedValidLocalPageCandidate(slug: string, serviceId: string, areaSlug: string): boolean {
  const record = loadAiLocalCopyPilotV3(slug, serviceId, areaSlug);
  if (!record) return false;
  if (record.validationResult && record.validationResult.ok === false) return false;
  return true;
}

function selectedAreas(slug: string, deps?: RemainingLocalPagesCampaignDeps) {
  return deps?.listSelectedAreas ? deps.listSelectedAreas(slug) : listSelectedOneLocalPageCandidateAreas(slug);
}

function candidateIsValid(
  slug: string,
  serviceId: string,
  areaSlug: string,
  deps?: RemainingLocalPagesCampaignDeps,
): boolean {
  return deps?.hasValidCandidate
    ? deps.hasValidCandidate(slug, serviceId, areaSlug)
    : hasSavedValidLocalPageCandidate(slug, serviceId, areaSlug);
}

function evidencePlanFor(
  slug: string,
  serviceId: string,
  areaSlug: string,
  deps?: RemainingLocalPagesCampaignDeps,
) {
  if (deps?.planEvidence) return deps.planEvidence(slug, serviceId, areaSlug);
  return decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, serviceId, areaSlug));
}

function preflightFor(
  slug: string,
  serviceId: string,
  areaSlug: string,
  deps?: RemainingLocalPagesCampaignDeps,
) {
  return deps?.preflightArea
    ? deps.preflightArea(slug, serviceId, areaSlug)
    : preflightOneLocalPageCandidate(slug, serviceId, areaSlug);
}

function fingerprintPlan(slug: string, serviceId: string, remaining: RemainingLocalPagesAreaPlan[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        slug,
        serviceId,
        remaining: remaining.map((row) => row.areaSlug),
      }),
    )
    .digest("hex");
}

function planOneArea(
  slug: string,
  serviceId: string,
  area: { areaName: string; areaSlug: string },
  deps?: RemainingLocalPagesCampaignDeps,
): RemainingLocalPagesAreaPlan {
  const preflight = preflightFor(slug, serviceId, area.areaSlug, deps);
  const complete = candidateIsValid(slug, serviceId, area.areaSlug, deps);
  if (complete) {
    return {
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      status: "skipped-complete",
      evidenceReady: true,
      evidenceCollectionRequired: false,
      evidenceBlocked: false,
      evidenceBlocker: null,
      maxEvidenceCalls: 0,
      maxEvidenceCostUsd: 0,
      maxGenerationCalls: 0,
      maxGenerationCostUsd: 0,
      previewUrl: preflight.previewUrl,
      reviewUrl: preflight.reviewUrl,
    };
  }
  const evidence = evidencePlanFor(slug, serviceId, area.areaSlug, deps);
  const readiness = assessSavedLocalPageGenerationReadiness(slug, serviceId, area.areaName, area.areaSlug);
  const collectionStatus = String(evidence.collectionRunStatus || "");
  const collectionFinished = collectionStatus === "completed" || collectionStatus === "stopped";
  const evidenceReady = readiness.canGenerate;
  const evidenceCollectionRequired = !collectionFinished;
  const evidenceBlocked = collectionFinished && !readiness.canGenerate;
  const requiredUncached = (evidence.proposedCalls || []).filter((row) => row.required && !row.cached);
  const maxEvidenceCalls = evidenceCollectionRequired ? requiredUncached.length : 0;
  const maxEvidenceCostUsd = evidenceCollectionRequired ? roundUsd(evidence.estimatedCostUsd || 0) : 0;
  // Confirmation maximum: every incomplete selected area that could reach generation
  // counts one OpenAI call, including areas whose evidence is not READY before collection.
  const maxGenerationCalls = 1;
  const maxGenerationCostUsd = AI_LOCAL_PILOT_V3_MAX_COST_USD;
  const evidenceBlocker = evidenceBlocked
    ? evidence.collectionOutcomeSummary ||
      readiness.reasons.join("; ") ||
      preflight.blocker ||
      `Saved ${area.areaName} required deterministic facts are missing. Facts are not invented.`
    : null;
  return {
    areaName: area.areaName,
    areaSlug: area.areaSlug,
    status: "pending",
    evidenceReady,
    evidenceCollectionRequired,
    evidenceBlocked,
    evidenceBlocker,
    maxEvidenceCalls,
    maxEvidenceCostUsd,
    maxGenerationCalls,
    maxGenerationCostUsd,
    previewUrl: preflight.previewUrl,
    reviewUrl: preflight.reviewUrl,
  };
}

export function planRemainingLocalPagesCampaign(
  slug: string,
  serviceId: string,
  deps?: RemainingLocalPagesCampaignDeps,
): RemainingLocalPagesCampaignPlan {
  const selected = selectedAreas(slug, deps);
  const planned = selected.map((area) => planOneArea(slug, serviceId, area, deps));
  const complete = planned.filter((row) => row.status === "skipped-complete");
  const remaining = planned.filter((row) => row.status !== "skipped-complete");
  const evidenceCurrentlyReadyCount = remaining.filter((row) => row.evidenceReady).length;
  const evidenceRequiringCollectionCount = remaining.filter((row) => row.evidenceCollectionRequired).length;
  const generationCurrentlyBlockedCount = remaining.filter((row) => row.evidenceBlocked).length;
  const maxEvidenceCalls = remaining.reduce((sum, row) => sum + row.maxEvidenceCalls, 0);
  const maxGenerationCalls = remaining.reduce((sum, row) => sum + row.maxGenerationCalls, 0);
  const maxEvidenceCostUsd = roundUsd(remaining.reduce((sum, row) => sum + row.maxEvidenceCostUsd, 0));
  const maxGenerationCostUsd = roundUsd(remaining.reduce((sum, row) => sum + row.maxGenerationCostUsd, 0), 2);
  const maxProviderCalls = maxEvidenceCalls + maxGenerationCalls;
  const maxTotalCostUsd = roundUsd(maxEvidenceCostUsd + maxGenerationCostUsd);
  return {
    slug,
    serviceId,
    fingerprint: fingerprintPlan(slug, serviceId, remaining),
    complete,
    remaining,
    evidenceCurrentlyReadyCount,
    evidenceRequiringCollectionCount,
    generationCurrentlyBlockedCount,
    maxEvidenceCalls,
    maxGenerationCalls,
    maxProviderCalls,
    maxEvidenceCostUsd,
    maxGenerationCostUsd,
    maxTotalCostUsd,
    maxEvidenceCostLabel: money(maxEvidenceCostUsd),
    maxGenerationCostLabel: money(maxGenerationCostUsd, 2),
    maxTotalCostLabel: money(maxTotalCostUsd),
    maxProviderCallsLabel: `${maxEvidenceCalls} evidence call${maxEvidenceCalls === 1 ? "" : "s"} + ${maxGenerationCalls} OpenAI call${maxGenerationCalls === 1 ? "" : "s"}`,
  };
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function withFileLock<T>(file: string, fn: () => Promise<T> | T): Promise<T> {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const started = Date.now();
  while (true) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
      break;
    } catch {
      if (Date.now() - started > 8000) throw new Error("remaining-local-pages-campaign-lock-timeout");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      fs.unlinkSync(lock);
    } catch {
      /* ignore */
    }
  }
}

function toAreaState(
  area: RemainingLocalPagesAreaPlan,
  extras?: Partial<RemainingLocalPagesAreaState>,
): RemainingLocalPagesAreaState {
  return {
    ...area,
    stage: extras?.stage ?? null,
    error: extras?.error ?? null,
    startedAt: extras?.startedAt ?? null,
    completedAt: extras?.completedAt ?? null,
    status: extras?.status ?? area.status,
  };
}

function newRunFromPlan(
  plan: RemainingLocalPagesCampaignPlan,
  authorisedBy: string,
): RemainingLocalPagesCampaignRun {
  const skippedComplete = plan.complete.map((row) => toAreaState(row, { status: "skipped-complete" }));
  const remainingAtStart = plan.remaining.map((row) => toAreaState(row, { status: "pending" }));
  return {
    kind: REMAINING_LOCAL_PAGES_CAMPAIGN_KIND,
    runId: randomUUID(),
    slug: plan.slug,
    serviceId: plan.serviceId,
    fingerprint: plan.fingerprint,
    status: remainingAtStart.length ? "authorised" : "completed",
    confirmedAt: new Date().toISOString(),
    authorisedBy,
    startedAt: null,
    updatedAt: new Date().toISOString(),
    completedAt: remainingAtStart.length ? null : new Date().toISOString(),
    currentAreaSlug: null,
    currentStage: null,
    failedAreaSlug: null,
    failedStage: null,
    failedError: null,
    skippedComplete,
    remainingAtStart,
    areas: [...skippedComplete, ...remainingAtStart],
    maxEvidenceCalls: plan.maxEvidenceCalls,
    maxGenerationCalls: plan.maxGenerationCalls,
    maxProviderCalls: plan.maxProviderCalls,
    maxEvidenceCostUsd: plan.maxEvidenceCostUsd,
    maxGenerationCostUsd: plan.maxGenerationCostUsd,
    maxTotalCostUsd: plan.maxTotalCostUsd,
  };
}

export function loadRemainingLocalPagesCampaignRun(
  slug: string,
  serviceId: string,
  deps?: RemainingLocalPagesCampaignDeps,
): RemainingLocalPagesCampaignRun | null {
  return readJson<RemainingLocalPagesCampaignRun>(remainingLocalPagesCampaignRunPath(slug, serviceId, deps?.runRoot));
}

function saveRun(run: RemainingLocalPagesCampaignRun, deps?: RemainingLocalPagesCampaignDeps): void {
  run.updatedAt = new Date().toISOString();
  writeJson(remainingLocalPagesCampaignRunPath(run.slug, run.serviceId, deps?.runRoot), run);
}

export function getRemainingLocalPagesCampaign(
  slug: string,
  serviceId: string,
  deps?: RemainingLocalPagesCampaignDeps,
): { plan: RemainingLocalPagesCampaignPlan; run: RemainingLocalPagesCampaignRun | null } {
  return {
    plan: planRemainingLocalPagesCampaign(slug, serviceId, deps),
    run: loadRemainingLocalPagesCampaignRun(slug, serviceId, deps),
  };
}

function updateArea(
  run: RemainingLocalPagesCampaignRun,
  areaSlug: string,
  patch: Partial<RemainingLocalPagesAreaState>,
): RemainingLocalPagesAreaState {
  const index = run.areas.findIndex((row) => row.areaSlug === areaSlug);
  if (index < 0) {
    const created = toAreaState(
      {
        areaName: areaSlug,
        areaSlug,
        status: "pending",
        evidenceReady: false,
        evidenceCollectionRequired: false,
        evidenceBlocked: false,
        evidenceBlocker: null,
        maxEvidenceCalls: 0,
        maxEvidenceCostUsd: 0,
        maxGenerationCalls: 0,
        maxGenerationCostUsd: 0,
      },
      patch,
    );
    run.areas.push(created);
    return created;
  }
  run.areas[index] = { ...run.areas[index], ...patch };
  return run.areas[index];
}

function nextPendingArea(run: RemainingLocalPagesCampaignRun): RemainingLocalPagesAreaState | null {
  return run.areas.find((row) => row.status === "running") || run.areas.find((row) => row.status === "pending") || null;
}

function copyPlanMaxima(run: RemainingLocalPagesCampaignRun, plan: RemainingLocalPagesCampaignPlan): void {
  run.fingerprint = plan.fingerprint;
  run.maxEvidenceCalls = plan.maxEvidenceCalls;
  run.maxGenerationCalls = plan.maxGenerationCalls;
  run.maxProviderCalls = plan.maxProviderCalls;
  run.maxEvidenceCostUsd = plan.maxEvidenceCostUsd;
  run.maxGenerationCostUsd = plan.maxGenerationCostUsd;
  run.maxTotalCostUsd = plan.maxTotalCostUsd;
}

export function applyCurrentPlanToStoppedCampaignRun(
  run: RemainingLocalPagesCampaignRun,
  plan: RemainingLocalPagesCampaignPlan,
): RemainingLocalPagesCampaignRun {
  const liveBySlug = new Map([...plan.complete, ...plan.remaining].map((row) => [row.areaSlug, row]));
  copyPlanMaxima(run, plan);
  run.status = "authorised";
  run.failedAreaSlug = null;
  run.failedStage = null;
  run.failedError = null;
  run.completedAt = null;
  run.currentAreaSlug = null;
  run.currentStage = null;
  run.areas = run.areas.map((area) => {
    if (area.status === "skipped-complete" || area.status === "completed") return area;
    const live = liveBySlug.get(area.areaSlug);
    if (!live) {
      return {
        ...area,
        status: "pending",
        stage: null,
        error: null,
        startedAt: null,
        completedAt: null,
      };
    }
    return toAreaState(live, {
      status: "pending",
      stage: null,
      error: null,
      startedAt: null,
      completedAt: null,
    });
  });
  return run;
}

export async function executeRemainingLocalPageAreaWorkflow(
  slug: string,
  serviceId: string,
  area: RemainingLocalPagesAreaPlan,
): Promise<RemainingLocalPagesAreaResult> {
  if (hasSavedValidLocalPageCandidate(slug, serviceId, area.areaSlug)) {
    const preflight = preflightOneLocalPageCandidate(slug, serviceId, area.areaSlug);
    return { ok: true, stage: "save", previewUrl: preflight.previewUrl, reviewUrl: preflight.reviewUrl, duplicate: true };
  }

  const existingRun = getLocalPageEvidenceRun(slug, serviceId, area.areaSlug);
  const collectionFinished = existingRun?.status === "completed" || existingRun?.status === "stopped";
  if (!collectionFinished) {
    const plan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, serviceId, area.areaSlug));
    const cap = Math.max(roundUsd((plan.estimatedCostUsd || 0) + 0.001), 0.01);
    const authorised = authoriseLocalPageEvidencePlan({
      slug,
      serviceId,
      areaSlug: area.areaSlug,
      spendingCapUsd: cap,
      confirmAuthorise: true,
      planFingerprint: plan.planFingerprint,
      authorisedBy: "campaign-remaining-local-pages",
    });
    if (!authorised.ok) {
      return { ok: false, stage: "evidence", error: authorised.error };
    }
    const collected = await startLocalPageEvidenceCollection({
      slug,
      serviceId,
      areaSlug: area.areaSlug,
      allowLiveProviders: true,
    });
    if (!collected.ok) {
      return { ok: false, stage: "evidence", error: collected.error };
    }
  }

  const readiness = assessSavedLocalPageGenerationReadiness(slug, serviceId, area.areaName, area.areaSlug);
  if (!readiness.canGenerate) {
    const run = getLocalPageEvidenceRun(slug, serviceId, area.areaSlug);
    const areaCall = (run?.calls || []).find((row) => row.id === "places-area-reference");
    const hits = run?.placesHitsByCall?.["places-area-reference"] || [];
    const providerDetail = areaCall
      ? `Saved Places area-reference result: query=${areaCall.query || ""} hits=${hits.length} detail=${areaCall.detail || ""} names=${hits.map((hit) => hit.name || "").join(" | ") || "none"}.`
      : "No saved Places area-reference call is stored.";
    return {
      ok: false,
      stage: readiness.blockReasons.some((row) => /area-reference|area-identity/.test(row)) ? "evidence" : "distance",
      error: `${readiness.reasons.join("; ")} ${providerDetail}`.trim(),
    };
  }

  const preflight = preflightOneLocalPageCandidate(slug, serviceId, area.areaSlug);
  if (preflight.distanceStatus !== "recorded" || preflight.distanceKm == null) {
    return {
      ok: false,
      stage: "distance",
      error: preflight.distanceDetail || `Distance for ${area.areaName} is unavailable.`,
    };
  }

  const generated = await generateOneLocalPageCandidate({
    slug,
    serviceId,
    areaSlug: area.areaSlug,
  });
  if (!generated.ok) {
    return { ok: false, stage: "generation", error: generated.error };
  }

  const record = loadAiLocalCopyPilotV3(slug, serviceId, area.areaSlug);
  if (!record || record.validationResult?.ok === false) {
    return {
      ok: false,
      stage: "validation",
      error: record?.validationResult?.failures?.join("; ") || `${area.areaName} candidate did not pass validation.`,
    };
  }
  return {
    ok: true,
    stage: "save",
    previewUrl: generated.previewUrl,
    reviewUrl: generated.reviewUrl,
  };
}

async function processRun(
  run: RemainingLocalPagesCampaignRun,
  deps?: RemainingLocalPagesCampaignDeps,
): Promise<RemainingLocalPagesCampaignRun> {
  const processArea = deps?.processArea || ((area: RemainingLocalPagesAreaPlan) =>
    executeRemainingLocalPageAreaWorkflow(run.slug, run.serviceId, area));
  run.status = "running";
  run.startedAt = run.startedAt || new Date().toISOString();
  saveRun(run, deps);

  while (true) {
    const current = nextPendingArea(run);
    if (!current) {
      run.status = "completed";
      run.currentAreaSlug = null;
      run.currentStage = null;
      run.completedAt = new Date().toISOString();
      saveRun(run, deps);
      return run;
    }
    if (candidateIsValid(run.slug, run.serviceId, current.areaSlug, deps)) {
      updateArea(run, current.areaSlug, {
        status: "skipped-complete",
        stage: "save",
        error: null,
        completedAt: new Date().toISOString(),
      });
      saveRun(run, deps);
      continue;
    }

    updateArea(run, current.areaSlug, {
      status: "running",
      stage: current.evidenceCollectionRequired || current.evidenceBlocked ? "evidence" : "generation",
      startedAt: current.startedAt || new Date().toISOString(),
      error: null,
    });
    run.currentAreaSlug = current.areaSlug;
    run.currentStage = current.evidenceBlocked ? "evidence" : current.evidenceCollectionRequired ? "evidence" : "distance";
    saveRun(run, deps);

    let result: RemainingLocalPagesAreaResult;
    try {
      result = await processArea(current);
    } catch (error) {
      result = {
        ok: false,
        stage: run.currentStage || "generation",
        error: error instanceof Error ? error.message : String(error),
      };
    }

    if (!result.ok) {
      updateArea(run, current.areaSlug, {
        status: "failed",
        stage: result.stage,
        error: result.error || "This area could not be created.",
        completedAt: new Date().toISOString(),
      });
      run.status = "stopped";
      run.currentAreaSlug = current.areaSlug;
      run.currentStage = result.stage;
      run.failedAreaSlug = current.areaSlug;
      run.failedStage = result.stage;
      run.failedError = result.error || "This area could not be created.";
      run.completedAt = new Date().toISOString();
      saveRun(run, deps);
      return run;
    }

    updateArea(run, current.areaSlug, {
      status: "completed",
      stage: "save",
      error: null,
      previewUrl: result.previewUrl || current.previewUrl,
      reviewUrl: result.reviewUrl || current.reviewUrl,
      completedAt: new Date().toISOString(),
    });
    run.currentAreaSlug = null;
    run.currentStage = null;
    saveRun(run, deps);
  }
}

export function clearRemainingLocalPagesCampaignRuntimeForTests(): void {
  inFlight.clear();
}

export async function confirmRemainingLocalPagesCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  deps?: RemainingLocalPagesCampaignDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: RemainingLocalPagesCampaignPlan; run: RemainingLocalPagesCampaignRun }
  | { ok: false; error: string; status: number; plan?: RemainingLocalPagesCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. No remaining local pages were started.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Remaining local-page runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planRemainingLocalPagesCampaign(opts.slug, opts.serviceId, opts.deps);
  if (plan.slug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Remaining local-page runs are scoped to the authenticated pharmacy.",
      plan,
    };
  }
  const file = remainingLocalPagesCampaignRunPath(opts.slug, opts.serviceId, opts.deps?.runRoot);
  const key = flightKey(opts.slug, opts.serviceId);

  type ConfirmLockResult = {
    run: RemainingLocalPagesCampaignRun;
    duplicate: boolean;
    start: boolean;
    active?: Promise<RemainingLocalPagesCampaignRun>;
    resolveFlight?: (run: RemainingLocalPagesCampaignRun) => void;
  };
  const started = await withFileLock(file, async (): Promise<ConfirmLockResult> => {
    const existing = loadRemainingLocalPagesCampaignRun(opts.slug, opts.serviceId, opts.deps);
    const active = inFlight.get(key);
    if (active) {
      return {
        run: existing || newRunFromPlan(plan, String(opts.authorisedBy || "authenticated-session")),
        duplicate: true,
        start: false,
        active,
      };
    }
    if (existing && (existing.fingerprint === plan.fingerprint || existing.status === "running" || existing.status === "interrupted" || existing.status === "authorised")) {
      if (existing.status === "completed" || existing.status === "stopped") {
        return { run: existing, duplicate: true, start: false };
      }
      existing.status = "running";
      saveRun(existing, opts.deps);
      let resolveFlight = (_run: RemainingLocalPagesCampaignRun) => undefined;
      const flight = new Promise<RemainingLocalPagesCampaignRun>((resolve) => {
        resolveFlight = resolve;
      });
      inFlight.set(key, flight);
      return { run: existing, duplicate: true, start: true, resolveFlight };
    }
    const run = newRunFromPlan(plan, String(opts.authorisedBy || "authenticated-session"));
    saveRun(run, opts.deps);
    if (run.status === "completed") {
      return { run, duplicate: false, start: false };
    }
    let resolveFlight = (_run: RemainingLocalPagesCampaignRun) => undefined;
    const flight = new Promise<RemainingLocalPagesCampaignRun>((resolve) => {
      resolveFlight = resolve;
    });
    inFlight.set(key, flight);
    return { run, duplicate: false, start: true, resolveFlight };
  });

  if (!started.start) {
    if (started.active && opts.processInline !== false) {
      return { ok: true, duplicate: true, plan, run: await started.active };
    }
    return { ok: true, duplicate: started.duplicate, plan, run: started.run };
  }

  const work = processRun(started.run, opts.deps)
    .then((finished) => {
      started.resolveFlight?.(finished);
      return finished;
    })
    .catch((error) => {
      const latest = loadRemainingLocalPagesCampaignRun(opts.slug, opts.serviceId, opts.deps);
      if (latest) {
        latest.status = "interrupted";
        latest.failedError = error instanceof Error ? error.message : String(error);
        saveRun(latest, opts.deps);
        started.resolveFlight?.(latest);
        return latest;
      }
      throw error;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  if (opts.processInline === false) {
    work.catch(() => undefined);
    return { ok: true, duplicate: started.duplicate, plan, run: started.run };
  }
  return { ok: true, duplicate: started.duplicate, plan, run: await work };
}

export async function resumeRemainingLocalPagesCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  runId?: string;
  deps?: RemainingLocalPagesCampaignDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: RemainingLocalPagesCampaignPlan; run: RemainingLocalPagesCampaignRun }
  | { ok: false; error: string; status: number; plan?: RemainingLocalPagesCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. The stopped remaining local-page run was not resumed.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Remaining local-page runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planRemainingLocalPagesCampaign(opts.slug, opts.serviceId, opts.deps);
  if (plan.slug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Remaining local-page runs are scoped to the authenticated pharmacy.",
      plan,
    };
  }
  const file = remainingLocalPagesCampaignRunPath(opts.slug, opts.serviceId, opts.deps?.runRoot);
  const key = flightKey(opts.slug, opts.serviceId);

  type ResumeLockResult = {
    run: RemainingLocalPagesCampaignRun | null;
    duplicate: boolean;
    start: boolean;
    error?: string;
    status?: number;
    active?: Promise<RemainingLocalPagesCampaignRun>;
    resolveFlight?: (run: RemainingLocalPagesCampaignRun) => void;
  };
  const started = await withFileLock(file, async (): Promise<ResumeLockResult> => {
    const existing = loadRemainingLocalPagesCampaignRun(opts.slug, opts.serviceId, opts.deps);
    const active = inFlight.get(key);
    if (active) {
      return {
        run: existing,
        duplicate: true,
        start: false,
        active,
      };
    }
    if (!existing) {
      return {
        run: null,
        duplicate: false,
        start: false,
        status: 409,
        error: "No stopped remaining local-page run exists for this pharmacy. A new run was not created.",
      };
    }
    if (opts.runId && opts.runId !== existing.runId) {
      return {
        run: existing,
        duplicate: false,
        start: false,
        status: 409,
        error: "This resume request does not match the saved remaining local-page run. A new run was not created.",
      };
    }
    if (existing.status === "completed") {
      return {
        run: existing,
        duplicate: true,
        start: false,
        status: 409,
        error: "This campaign-level run is complete. A new remaining local-page run was not created.",
      };
    }
    if (existing.status === "running") {
      return { run: existing, duplicate: true, start: false };
    }
    if (existing.status !== "stopped" && existing.status !== "interrupted") {
      return {
        run: existing,
        duplicate: false,
        start: false,
        status: 409,
        error: "This remaining local-page run cannot be resumed from its current state. A new run was not created.",
      };
    }
    applyCurrentPlanToStoppedCampaignRun(existing, plan);
    saveRun(existing, opts.deps);
    let resolveFlight = (_run: RemainingLocalPagesCampaignRun) => undefined;
    const flight = new Promise<RemainingLocalPagesCampaignRun>((resolve) => {
      resolveFlight = resolve;
    });
    inFlight.set(key, flight);
    return { run: existing, duplicate: false, start: true, resolveFlight };
  });

  if (!started.start) {
    if (started.error) {
      return { ok: false, status: started.status || 409, error: started.error, plan };
    }
    if (started.active && opts.processInline !== false) {
      return { ok: true, duplicate: true, plan, run: await started.active };
    }
    if (!started.run) {
      return {
        ok: false,
        status: 409,
        error: "No stopped remaining local-page run exists for this pharmacy. A new run was not created.",
        plan,
      };
    }
    return { ok: true, duplicate: started.duplicate, plan, run: started.run };
  }

  const work = processRun(started.run!, opts.deps)
    .then((finished) => {
      started.resolveFlight?.(finished);
      return finished;
    })
    .catch((error) => {
      const latest = loadRemainingLocalPagesCampaignRun(opts.slug, opts.serviceId, opts.deps);
      if (latest) {
        latest.status = "interrupted";
        latest.failedError = error instanceof Error ? error.message : String(error);
        saveRun(latest, opts.deps);
        started.resolveFlight?.(latest);
        return latest;
      }
      throw error;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  if (opts.processInline === false) {
    work.catch(() => undefined);
    return { ok: true, duplicate: started.duplicate, plan, run: started.run! };
  }
  return { ok: true, duplicate: started.duplicate, plan, run: await work };
}
