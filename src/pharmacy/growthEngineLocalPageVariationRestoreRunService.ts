/**
 * Campaign-level V3 full-page variation restore and regeneration run.
 * Snapshots live V2 candidates, then regenerates all selected areas through the
 * existing Campaign Builder writer, validators, assembler and Review Centre.
 * Restored locality-page strategies own section presentation. One OpenAI call per
 * area. No automatic retry. Does not publish or touch rejected V1 snapshots.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { loadAiLocalCopyPilotV3 } from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  distinctVerifiedLocalReferencesFromCopy,
  MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2,
} from "./contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { loadEditorialEvidencePack } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import {
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import {
  executeLocalPageImprovementAreaWorkflow,
  LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD,
  planLocalPageImprovementCampaign,
  type LocalPageImprovementAreaPlan,
  type LocalPageImprovementAreaState,
  type LocalPageImprovementCampaignPlan,
  type LocalPageImprovementCampaignRun,
  type LocalPageImprovementDeps,
  type LocalPageImprovementStage,
  type LocalPageImprovementStatus,
} from "./growthEngineLocalPageImprovementRunService.ts";
import { assemblePharmacyAiLocalPagePilotsV3 } from "./pharmacyAiLocalPagePilotAssemblerV3.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const RESTORE_LOCAL_PAGE_VARIATION_LABEL = "Regenerate local pages";
export const RESUME_RESTORE_LOCAL_PAGE_VARIATION_LABEL = "Resume variation regeneration";
export const LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_KIND = "local-page-variation-restore-campaign-run-v3";
export const LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_DIRNAME = "data/pharmacy-local-page-campaign-runs";
export const LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_VERSION = "v3";
export const LOCAL_PAGE_VARIATION_RESTORE_HARD_MAX_TOTAL_USD = LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD;
export const PRESERVED_V2_COPY_DIRNAME = "data/pharmacy-ai-local-copy-preserved-v2";
export const PRESERVED_V2_HTML_DIRNAME = "output/pharmacy-ai-local-page-preserved-v2";

export type LocalPageVariationRestoreCampaignRun = Omit<LocalPageImprovementCampaignRun, "kind" | "v1SnapshotDir"> & {
  kind: typeof LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_KIND;
  v2SnapshotDir: string;
  recoveredImplementation: "pharmacyLocalityPageStrategyV1+pharmacyFirstLocalNarrative";
};

const inFlight = new Map<string, Promise<LocalPageVariationRestoreCampaignRun>>();

function flightKey(slug: string, serviceId: string): string {
  return `${slug}:${serviceId}:local-page-variation-restore-v3`;
}

export function localPageVariationRestoreCampaignRunPath(slug: string, serviceId: string, runRoot?: string): string {
  return path.join(
    runRoot || PHARMACY_WORKSPACE_ROOT,
    LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_DIRNAME,
    slug,
    serviceId,
    LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_VERSION,
    "local-page-variation-restore.json",
  );
}

export function preservedV2CopyPath(slug: string, serviceId: string, areaSlug: string, snapshotRoot?: string): string {
  return path.join(snapshotRoot || PHARMACY_WORKSPACE_ROOT, PRESERVED_V2_COPY_DIRNAME, slug, serviceId, `${areaSlug}.json`);
}

export function preservedV2HtmlPath(slug: string, serviceId: string, areaSlug: string, snapshotRoot?: string): string {
  return path.join(
    snapshotRoot || PHARMACY_WORKSPACE_ROOT,
    PRESERVED_V2_HTML_DIRNAME,
    slug,
    serviceId,
    "v3",
    "local",
    areaSlug,
    "index.html",
  );
}

function sha256File(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function copyFileIfMissing(from: string, to: string): void {
  if (!fs.existsSync(from) || fs.existsSync(to)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

export function snapshotPreservedV2LocalPages(
  slug: string,
  serviceId: string,
  areas: Array<{ areaSlug: string }>,
  snapshotRoot?: string,
): { copyHashes: Record<string, string | null>; htmlHashes: Record<string, string | null> } {
  const copyHashes: Record<string, string | null> = {};
  const htmlHashes: Record<string, string | null> = {};
  for (const area of areas) {
    const liveCopy = aiLocalCopyPilotPath(slug, serviceId, area.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
    const liveHtml = aiLocalPagePilotHtmlPath(slug, serviceId, area.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
    const snapCopy = preservedV2CopyPath(slug, serviceId, area.areaSlug, snapshotRoot);
    const snapHtml = preservedV2HtmlPath(slug, serviceId, area.areaSlug, snapshotRoot);
    copyFileIfMissing(liveCopy, snapCopy);
    copyFileIfMissing(liveHtml, snapHtml);
    copyHashes[area.areaSlug] = sha256File(snapCopy);
    htmlHashes[area.areaSlug] = sha256File(snapHtml);
  }
  return { copyHashes, htmlHashes };
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
      if (Date.now() - started > 8000) throw new Error("local-page-variation-restore-campaign-lock-timeout");
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

function fingerprintPlan(slug: string, serviceId: string, areas: LocalPageImprovementAreaPlan[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        slug,
        serviceId,
        kind: LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_KIND,
        areas: areas.map((row) => row.areaSlug),
      }),
    )
    .digest("hex");
}

export function planLocalPageVariationRestoreCampaign(
  slug: string,
  serviceId: string,
  deps?: LocalPageImprovementDeps,
): LocalPageImprovementCampaignPlan {
  const base = planLocalPageImprovementCampaign(slug, serviceId, deps);
  return {
    ...base,
    fingerprint: fingerprintPlan(slug, serviceId, base.areas),
    hardMaximumUsd: LOCAL_PAGE_VARIATION_RESTORE_HARD_MAX_TOTAL_USD,
    exceedsHardMaximum: base.maxTotalCostUsd > LOCAL_PAGE_VARIATION_RESTORE_HARD_MAX_TOTAL_USD,
  };
}

function loadRun(slug: string, serviceId: string, deps?: LocalPageImprovementDeps): LocalPageVariationRestoreCampaignRun | null {
  const file = localPageVariationRestoreCampaignRunPath(slug, serviceId, deps?.runRoot);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as LocalPageVariationRestoreCampaignRun;
    if (parsed?.kind !== LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_KIND) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadLocalPageVariationRestoreCampaignRun(
  slug: string,
  serviceId: string,
  deps?: LocalPageImprovementDeps,
): LocalPageVariationRestoreCampaignRun | null {
  return loadRun(slug, serviceId, deps);
}

function saveRun(run: LocalPageVariationRestoreCampaignRun, deps?: LocalPageImprovementDeps): void {
  run.updatedAt = new Date().toISOString();
  writeJson(localPageVariationRestoreCampaignRunPath(run.slug, run.serviceId, deps?.runRoot), run);
}

function toAreaState(area: LocalPageImprovementAreaPlan): LocalPageImprovementAreaState {
  return {
    ...area,
    stage: null,
    error: null,
    startedAt: null,
    completedAt: null,
  };
}

function newRunFromPlan(
  plan: LocalPageImprovementCampaignPlan,
  authorisedBy: string,
  snapshotRoot?: string,
): LocalPageVariationRestoreCampaignRun {
  return {
    kind: LOCAL_PAGE_VARIATION_RESTORE_CAMPAIGN_KIND,
    runId: randomUUID(),
    slug: plan.slug,
    serviceId: plan.serviceId,
    fingerprint: plan.fingerprint,
    status: plan.areas.length ? "authorised" : "completed",
    confirmedAt: new Date().toISOString(),
    authorisedBy,
    startedAt: null,
    updatedAt: new Date().toISOString(),
    completedAt: plan.areas.length ? null : new Date().toISOString(),
    currentAreaSlug: null,
    currentStage: null,
    failedAreaSlug: null,
    failedStage: null,
    failedError: null,
    v2SnapshotDir: path.join(
      snapshotRoot || PHARMACY_WORKSPACE_ROOT,
      PRESERVED_V2_COPY_DIRNAME,
      plan.slug,
      plan.serviceId,
    ),
    recoveredImplementation: "pharmacyLocalityPageStrategyV1+pharmacyFirstLocalNarrative",
    areas: plan.areas.map((row) => toAreaState(row)),
    maxEvidenceCalls: plan.maxEvidenceCalls,
    maxGenerationCalls: plan.maxGenerationCalls,
    maxProviderCalls: plan.maxProviderCalls,
    maxEvidenceCostUsd: plan.maxEvidenceCostUsd,
    maxGenerationCostUsd: plan.maxGenerationCostUsd,
    maxTotalCostUsd: plan.maxTotalCostUsd,
  };
}

export function getLocalPageVariationRestoreCampaign(
  slug: string,
  serviceId: string,
  deps?: LocalPageImprovementDeps,
): { plan: LocalPageImprovementCampaignPlan; run: LocalPageVariationRestoreCampaignRun | null } {
  return {
    plan: planLocalPageVariationRestoreCampaign(slug, serviceId, deps),
    run: loadRun(slug, serviceId, deps),
  };
}

function updateArea(
  run: LocalPageVariationRestoreCampaignRun,
  areaSlug: string,
  patch: Partial<LocalPageImprovementAreaState>,
): LocalPageImprovementAreaState {
  const index = run.areas.findIndex((row) => row.areaSlug === areaSlug);
  if (index < 0) throw new Error(`unknown variation-restore area ${areaSlug}`);
  run.areas[index] = { ...run.areas[index], ...patch };
  return run.areas[index];
}

function nextPendingArea(run: LocalPageVariationRestoreCampaignRun): LocalPageImprovementAreaState | null {
  return run.areas.find((row) => row.status === "running") || run.areas.find((row) => row.status === "pending") || null;
}

async function processRun(
  run: LocalPageVariationRestoreCampaignRun,
  deps?: LocalPageImprovementDeps,
): Promise<LocalPageVariationRestoreCampaignRun> {
  snapshotPreservedV2LocalPages(run.slug, run.serviceId, run.areas, deps?.snapshotRoot);
  const processArea =
    deps?.processArea ||
    ((area: LocalPageImprovementAreaPlan) =>
      executeLocalPageImprovementAreaWorkflow(
        run.slug,
        run.serviceId,
        area,
        deps,
        run.areas.filter((row) => row.status === "completed").map((row) => row.areaSlug),
      ));
  run.status = "running";
  run.startedAt = run.startedAt || new Date().toISOString();
  saveRun(run, deps);

  while (true) {
    const current = nextPendingArea(run);
    if (!current) {
      const assemble =
        deps?.assembleAll ||
        ((slug: string, serviceId: string, areaSlugs: string[]) =>
          assemblePharmacyAiLocalPagePilotsV3(slug, serviceId, areaSlugs));
      assemble(
        run.slug,
        run.serviceId,
        run.areas.map((row) => row.areaSlug),
      );
      run.status = "completed";
      run.currentAreaSlug = null;
      run.currentStage = null;
      run.completedAt = new Date().toISOString();
      saveRun(run, deps);
      return run;
    }
    updateArea(run, current.areaSlug, {
      status: "running",
      stage: "evidence",
      error: null,
      startedAt: current.startedAt || new Date().toISOString(),
    });
    run.currentAreaSlug = current.areaSlug;
    run.currentStage = "evidence";
    saveRun(run, deps);

    const result = await processArea(current);
    if (!result.ok) {
      updateArea(run, current.areaSlug, {
        status: "failed",
        stage: result.stage,
        error: result.error || "Variation restore stopped.",
        completedAt: new Date().toISOString(),
      });
      run.status = "stopped";
      run.failedAreaSlug = current.areaSlug;
      run.failedStage = result.stage;
      run.failedError = result.error || "Variation restore stopped.";
      run.currentAreaSlug = current.areaSlug;
      run.currentStage = result.stage;
      saveRun(run, deps);
      return run;
    }
    const record = loadAiLocalCopyPilotV3(run.slug, run.serviceId, current.areaSlug);
    const editorial = loadEditorialEvidencePack(run.slug, run.serviceId, current.areaSlug);
    const localReferences =
      result.localReferences ||
      (record?.outputCopy
        ? distinctVerifiedLocalReferencesFromCopy(record.outputCopy, editorial?.facts || [])
        : []);
    if (localReferences.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2 && !result.localReferences) {
      updateArea(run, current.areaSlug, {
        status: "failed",
        stage: "validation",
        error: `fewer than ${MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2} distinct verified local references`,
        completedAt: new Date().toISOString(),
      });
      run.status = "stopped";
      run.failedAreaSlug = current.areaSlug;
      run.failedStage = "validation";
      run.failedError = `fewer than ${MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2} distinct verified local references`;
      saveRun(run, deps);
      return run;
    }
    updateArea(run, current.areaSlug, {
      status: "completed",
      stage: "save",
      error: null,
      completedAt: new Date().toISOString(),
      previewUrl: result.previewUrl || current.previewUrl,
      reviewUrl: result.reviewUrl || current.reviewUrl,
      localReferences,
    });
    saveRun(run, deps);
  }
}

export async function confirmLocalPageVariationRestoreCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  deps?: LocalPageImprovementDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: LocalPageImprovementCampaignPlan; run: LocalPageVariationRestoreCampaignRun }
  | { ok: false; error: string; status: number; plan?: LocalPageImprovementCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. No variation restoration was started.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Variation restoration runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planLocalPageVariationRestoreCampaign(opts.slug, opts.serviceId, opts.deps);
  if (plan.slug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Variation restoration runs are scoped to the authenticated pharmacy.",
      plan,
    };
  }
  if (plan.exceedsHardMaximum) {
    return {
      ok: false,
      status: 409,
      error: `Platform estimate ${plan.maxTotalCostLabel} exceeds the hard maximum of $${LOCAL_PAGE_VARIATION_RESTORE_HARD_MAX_TOTAL_USD.toFixed(3)}. The variation restoration was not started.`,
      plan,
    };
  }
  const file = localPageVariationRestoreCampaignRunPath(opts.slug, opts.serviceId, opts.deps?.runRoot);
  const key = flightKey(opts.slug, opts.serviceId);

  type ConfirmLockResult = {
    run: LocalPageVariationRestoreCampaignRun;
    duplicate: boolean;
    start: boolean;
    active?: Promise<LocalPageVariationRestoreCampaignRun>;
    resolveFlight?: (run: LocalPageVariationRestoreCampaignRun) => void;
  };
  const started = await withFileLock(file, async (): Promise<ConfirmLockResult> => {
    const existing = loadRun(opts.slug, opts.serviceId, opts.deps);
    const active = inFlight.get(key);
    if (active) {
      return {
        run: existing || newRunFromPlan(plan, String(opts.authorisedBy || "authenticated-session"), opts.deps?.snapshotRoot),
        duplicate: true,
        start: false,
        active,
      };
    }
    if (
      existing &&
      (existing.fingerprint === plan.fingerprint ||
        existing.status === "running" ||
        existing.status === "interrupted" ||
        existing.status === "authorised")
    ) {
      if (existing.status === "completed" || existing.status === "stopped") {
        return { run: existing, duplicate: true, start: false };
      }
      existing.status = "running";
      saveRun(existing, opts.deps);
      let resolveFlight = (_run: LocalPageVariationRestoreCampaignRun) => undefined;
      const flight = new Promise<LocalPageVariationRestoreCampaignRun>((resolve) => {
        resolveFlight = resolve;
      });
      inFlight.set(key, flight);
      return { run: existing, duplicate: true, start: true, resolveFlight };
    }
    const run = newRunFromPlan(plan, String(opts.authorisedBy || "authenticated-session"), opts.deps?.snapshotRoot);
    saveRun(run, opts.deps);
    if (run.status === "completed") {
      return { run, duplicate: false, start: false };
    }
    let resolveFlight = (_run: LocalPageVariationRestoreCampaignRun) => undefined;
    const flight = new Promise<LocalPageVariationRestoreCampaignRun>((resolve) => {
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
      const latest = loadRun(opts.slug, opts.serviceId, opts.deps);
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

export async function resumeLocalPageVariationRestoreCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  runId?: string;
  deps?: LocalPageImprovementDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: LocalPageImprovementCampaignPlan; run: LocalPageVariationRestoreCampaignRun }
  | { ok: false; error: string; status: number; plan?: LocalPageImprovementCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. The stopped variation restoration was not resumed.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Variation restoration runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planLocalPageVariationRestoreCampaign(opts.slug, opts.serviceId, opts.deps);
  if (plan.exceedsHardMaximum) {
    return {
      ok: false,
      status: 409,
      error: `Platform estimate ${plan.maxTotalCostLabel} exceeds the hard maximum of $${LOCAL_PAGE_VARIATION_RESTORE_HARD_MAX_TOTAL_USD.toFixed(3)}. The variation restoration was not resumed.`,
      plan,
    };
  }
  const existing = loadRun(opts.slug, opts.serviceId, opts.deps);
  if (!existing || existing.status !== "stopped") {
    return { ok: false, status: 409, error: "There is no stopped variation restoration run to resume.", plan };
  }
  if (opts.runId && existing.runId !== opts.runId) {
    return { ok: false, status: 409, error: "The stopped variation restoration no longer matches this confirmation.", plan };
  }
  existing.status = "authorised";
  existing.failedAreaSlug = null;
  existing.failedStage = null;
  existing.failedError = null;
  existing.completedAt = null;
  existing.areas = existing.areas.map((area) =>
    area.status === "failed"
      ? { ...area, status: "pending", stage: null, error: null, startedAt: null, completedAt: null }
      : area,
  );
  saveRun(existing, opts.deps);
  return confirmLocalPageVariationRestoreCampaign({
    slug: opts.slug,
    serviceId: opts.serviceId,
    confirmAuthorise: true,
    authenticatedSlug: opts.authenticatedSlug,
    authorisedBy: opts.authorisedBy,
    processInline: opts.processInline,
    deps: opts.deps,
  });
}

export type { LocalPageImprovementCampaignPlan, LocalPageImprovementStage, LocalPageImprovementStatus };
