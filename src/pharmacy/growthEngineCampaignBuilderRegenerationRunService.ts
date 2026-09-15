/**
 * Campaign Builder new-campaign runner.
 * Starts a fresh campaign from the saved pharmacy profile using the accepted
 * Brook Gemini local-copy generator. Does not read, continue, merge or repair
 * previous runs or candidates. Stopped historical runs stay on disk as inactive
 * history. Gemini is the only local-copy writer. Does not publish or index.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  versionedServicePageCandidateHtmlPath,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import {
  generateOneLocalPageCandidate,
} from "./growthEngineLocalPageCandidateService.ts";
import {
  buildCampaignRegenerationPreview,
  type CampaignRegenerationPreview,
} from "./growthEngineCampaignBuilderRegenerationService.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import {
  buildVisualExperiencePage,
  resolveVisualExperienceHtmlPath,
  sanitiseVisualExperienceServiceId,
} from "./pharmacyVisualExperience.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const CAMPAIGN_REGENERATION_RUN_KIND = "campaign-builder-versioned-regeneration-v1";
export const CAMPAIGN_NEW_CAMPAIGN_GENERATOR = "accepted-brook-gemini-local-pages-v1";
export const CAMPAIGN_REGENERATION_RUN_DIRNAME = "data/pharmacy-local-page-campaign-runs";
export const CAMPAIGN_HISTORICAL_RUN_FILENAME = "versioned-regeneration.json";
export const CAMPAIGN_HISTORICAL_RUNS_INACTIVE =
  "Stopped campaigns are inactive history. Start a new campaign from the saved profile.";

export type CampaignRegenerationRunStatus =
  | "idle"
  | "authorised"
  | "running"
  | "stopped"
  | "completed"
  | "interrupted";

export type CampaignRegenerationJobStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type CampaignRegenerationJob = {
  id: string;
  kind: "service-page" | "local-page";
  areaName: string | null;
  areaSlug: string | null;
  status: CampaignRegenerationJobStatus;
  previewUrl: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type CampaignRegenerationRun = {
  kind: typeof CAMPAIGN_REGENERATION_RUN_KIND;
  generator: typeof CAMPAIGN_NEW_CAMPAIGN_GENERATOR;
  runId: string;
  slug: string;
  serviceId: string;
  candidateVersion: string;
  status: CampaignRegenerationRunStatus;
  authorisedBy: string;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  elapsedMs: number | null;
  published: false;
  indexed: false;
  jobs: CampaignRegenerationJob[];
  failedError: string | null;
  currentAreaSlug: string | null;
  servicePagePreviewUrl: string | null;
  localPreviewUrls: string[];
  supportingAssetTotals: Array<{ count: number; label: string }>;
};

const inFlight = new Map<string, Promise<CampaignRegenerationRun>>();

function flightKey(slug: string, serviceId: string): string {
  return `${slug}:${serviceId}:new-campaign`;
}

export function campaignRegenerationRunPath(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    CAMPAIGN_REGENERATION_RUN_DIRNAME,
    slug,
    serviceId,
    CAMPAIGN_HISTORICAL_RUN_FILENAME,
  );
}

function campaignRunDir(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, CAMPAIGN_REGENERATION_RUN_DIRNAME, slug, serviceId);
}

function currentCampaignPointerPath(slug: string, serviceId: string): string {
  return path.join(campaignRunDir(slug, serviceId), "current.json");
}

export function campaignRunFilePath(slug: string, serviceId: string, runId: string): string {
  return path.join(campaignRunDir(slug, serviceId), "campaigns", `${runId}.json`);
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function saveRun(run: CampaignRegenerationRun): void {
  run.updatedAt = new Date().toISOString();
  if (run.startedAt) {
    const end = Date.parse(run.completedAt || run.updatedAt);
    const start = Date.parse(run.startedAt);
    if (Number.isFinite(end) && Number.isFinite(start)) run.elapsedMs = Math.max(0, end - start);
  }
  const file = campaignRunFilePath(run.slug, run.serviceId, run.runId);
  if (file.endsWith(`/${CAMPAIGN_HISTORICAL_RUN_FILENAME}`)) {
    throw new Error("refusing to overwrite a historical campaign run");
  }
  writeJson(file, run);
  writeJson(currentCampaignPointerPath(run.slug, run.serviceId), {
    kind: CAMPAIGN_NEW_CAMPAIGN_GENERATOR,
    runId: run.runId,
    slug: run.slug,
    serviceId: run.serviceId,
    updatedAt: run.updatedAt,
  });
}

export function loadCampaignRegenerationRun(slug: string, serviceId: string): CampaignRegenerationRun | null {
  const pointer = readJson<{ runId?: string; kind?: string }>(currentCampaignPointerPath(slug, serviceId));
  const runId = String(pointer?.runId || "").trim();
  if (!runId) return null;
  if (String(pointer?.kind || "").trim() !== CAMPAIGN_NEW_CAMPAIGN_GENERATOR) {
    return null;
  }
  const run = readJson<CampaignRegenerationRun>(campaignRunFilePath(slug, serviceId, runId));
  if (!run || run.generator !== CAMPAIGN_NEW_CAMPAIGN_GENERATOR) return null;
  return run;
}

function localPreviewUrl(slug: string, serviceId: string, areaSlug: string): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(serviceId)}&asset=${encodeURIComponent(AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET)}&area=${encodeURIComponent(areaSlug)}`;
}

function servicePreviewUrl(slug: string, serviceId: string): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(serviceId)}&asset=service-page`;
}

function supportingAssetTotals(slug: string, serviceId: string, preview: CampaignRegenerationPreview) {
  const pkg = loadContentPackage(slug, serviceId);
  if (pkg?.assets?.length) {
    return pkg.assets
      .filter((asset) => asset.included || asset.required)
      .map((asset) => ({ count: Number(asset.count || 0), label: String(asset.title || asset.type) }))
      .filter((row) => row.count > 0);
  }
  return preview.assetsToRegenerate;
}

function newRun(preview: CampaignRegenerationPreview, authorisedBy: string): CampaignRegenerationRun {
  const now = new Date().toISOString();
  const jobs: CampaignRegenerationJob[] = [
    {
      id: "service-page",
      kind: "service-page",
      areaName: null,
      areaSlug: null,
      status: "pending",
      previewUrl: servicePreviewUrl(preview.slug, preview.serviceId),
      error: null,
      startedAt: null,
      completedAt: null,
    },
    ...preview.candidateJobs.map((job) => ({
      id: `local:${job.areaSlug}`,
      kind: "local-page" as const,
      areaName: job.areaName,
      areaSlug: job.areaSlug,
      status: "pending" as const,
      previewUrl: localPreviewUrl(preview.slug, preview.serviceId, job.areaSlug),
      error: null,
      startedAt: null,
      completedAt: null,
    })),
  ];
  return {
    kind: CAMPAIGN_REGENERATION_RUN_KIND,
    generator: CAMPAIGN_NEW_CAMPAIGN_GENERATOR,
    runId: randomUUID(),
    slug: preview.slug,
    serviceId: preview.serviceId,
    candidateVersion: preview.newCandidateVersion,
    status: "authorised",
    authorisedBy,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    elapsedMs: null,
    published: false,
    indexed: false,
    jobs,
    failedError: null,
    currentAreaSlug: null,
    servicePagePreviewUrl: servicePreviewUrl(preview.slug, preview.serviceId),
    localPreviewUrls: jobs.filter((job) => job.kind === "local-page").map((job) => job.previewUrl || "").filter(Boolean),
    supportingAssetTotals: supportingAssetTotals(preview.slug, preview.serviceId, preview),
  };
}

function assembleServicePageCandidate(slug: string, serviceId: string, version: string): { ok: true; path: string } | { ok: false; error: string } {
  const visualId = sanitiseVisualExperienceServiceId(serviceId);
  if (!visualId) return { ok: false, error: "Current service-content assembly is not available for this service." };
  const livePath = resolveVisualExperienceHtmlPath(visualId, slug);
  const snapshot = livePath && fs.existsSync(livePath) ? fs.readFileSync(livePath, "utf8") : null;
  try {
    const built = buildVisualExperiencePage(slug, visualId);
    const dest = versionedServicePageCandidateHtmlPath(slug, serviceId, version);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(built.outputPath, dest);
    return { ok: true, path: dest };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (snapshot != null && livePath) {
      fs.writeFileSync(livePath, snapshot, "utf8");
    }
  }
}

async function processRun(run: CampaignRegenerationRun): Promise<CampaignRegenerationRun> {
  run.status = "running";
  saveRun(run);
  for (const job of run.jobs) {
    if (job.status === "completed" || job.status === "skipped" || job.status === "failed") continue;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    run.currentAreaSlug = job.areaSlug;
    saveRun(run);
    if (job.kind === "service-page") {
      const assembled = assembleServicePageCandidate(run.slug, run.serviceId, run.candidateVersion);
      if (!assembled.ok) {
        job.status = "failed";
        job.error = assembled.error;
        job.completedAt = new Date().toISOString();
        run.status = "stopped";
        run.failedError = assembled.error;
        run.completedAt = job.completedAt;
        saveRun(run);
        return run;
      }
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.previewUrl = servicePreviewUrl(run.slug, run.serviceId);
      saveRun(run);
      continue;
    }
    const areaSlug = String(job.areaSlug || "");
    const areaName = String(job.areaName || areaSlug);
    const generated = await generateOneLocalPageCandidate({
      slug: run.slug,
      serviceId: run.serviceId,
      areaSlug,
      areaName,
      previousFingerprints: [],
      candidateVersion: run.candidateVersion,
      allowAuthorisedCampaignAreas: true,
      maxAttempts: 1,
    });
    if (!generated.ok) {
      job.status = "failed";
      job.error = generated.error;
      job.completedAt = new Date().toISOString();
      run.status = "stopped";
      run.failedError = generated.error;
      run.completedAt = job.completedAt;
      saveRun(run);
      return run;
    }
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.previewUrl = generated.previewUrl;
    saveRun(run);
  }
  const failed = run.jobs.find((job) => job.status === "failed");
  run.status = failed ? "stopped" : "completed";
  run.failedError = failed?.error || null;
  run.completedAt = new Date().toISOString();
  run.currentAreaSlug = failed?.areaSlug || null;
  run.servicePagePreviewUrl = servicePreviewUrl(run.slug, run.serviceId);
  run.localPreviewUrls = run.jobs
    .filter((job) => job.kind === "local-page")
    .map((job) => job.previewUrl || "")
    .filter(Boolean);
  saveRun(run);
  return run;
}

function startRunWork(
  slug: string,
  serviceId: string,
  run: CampaignRegenerationRun,
): Promise<CampaignRegenerationRun> {
  const key = flightKey(slug, serviceId);
  let resolveFlight = (_finished: CampaignRegenerationRun) => undefined;
  const flight = new Promise<CampaignRegenerationRun>((resolve) => {
    resolveFlight = resolve;
  });
  inFlight.set(key, flight);
  const work = processRun(run)
    .then((finished) => {
      resolveFlight(finished);
      return finished;
    })
    .catch((error) => {
      const latest = loadCampaignRegenerationRun(slug, serviceId) || run;
      latest.status = "interrupted";
      latest.failedError = error instanceof Error ? error.message : String(error);
      latest.completedAt = new Date().toISOString();
      saveRun(latest);
      resolveFlight(latest);
      return latest;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  return work;
}

export function getCampaignRegenerationRun(
  slug: string,
  serviceId: string,
): { preview: CampaignRegenerationPreview | null; run: CampaignRegenerationRun | null } {
  return {
    preview: buildCampaignRegenerationPreview(slug, serviceId),
    run: loadCampaignRegenerationRun(slug, serviceId),
  };
}

export async function executeCampaignBuilderVersionedRegeneration(opts: {
  slug: string;
  serviceId: string;
  confirmed: boolean;
  authorisedBy?: string;
  processInline?: boolean;
}): Promise<
  | { ok: true; duplicate: boolean; generated: boolean; published: false; indexed: false; preview: CampaignRegenerationPreview; run: CampaignRegenerationRun }
  | { ok: false; generated: false; published: false; indexed: false; error: string; status: number; preview?: CampaignRegenerationPreview | null; run?: CampaignRegenerationRun | null }
> {
  const preview = buildCampaignRegenerationPreview(opts.slug, opts.serviceId, null, {
    requireExistingCampaign: false,
  });
  void CAMPAIGN_HISTORICAL_RUNS_INACTIVE;
  if (!preview) {
    return {
      ok: false,
      generated: false,
      published: false,
      indexed: false,
      status: 400,
      error: "No saved pharmacy profile or selected service was found for this campaign.",
    };
  }
  if (opts.confirmed !== true) {
    return {
      ok: false,
      generated: false,
      published: false,
      indexed: false,
      status: 400,
      error: "Confirmation is required. Nothing was created.",
      preview,
    };
  }
  if (!preview.candidateJobs.length) {
    return {
      ok: false,
      generated: false,
      published: false,
      indexed: false,
      status: 409,
      error: "Select the campaign’s local areas before generating.",
      preview,
    };
  }

  const key = flightKey(opts.slug, opts.serviceId);
  const active = inFlight.get(key);
  if (active) {
    return {
      ok: true,
      duplicate: true,
      generated: false,
      published: false,
      indexed: false,
      preview,
      run: await active,
    };
  }

  const run = newRun(preview, String(opts.authorisedBy || "authenticated-session"));
  saveRun(run);
  const work = startRunWork(opts.slug, opts.serviceId, run);
  if (opts.processInline === false) {
    work.catch(() => undefined);
    return {
      ok: true,
      duplicate: false,
      generated: true,
      published: false,
      indexed: false,
      preview,
      run,
    };
  }
  const finished = await work;
  return {
    ok: true,
    duplicate: false,
    generated: finished.status === "completed",
    published: false,
    indexed: false,
    preview,
    run: finished,
  };
}
