/**
 * Campaign-level UK local service-page run.
 * One confirmed action identifies the ten selected areas, saves isolated evidence
 * briefs, writes ten local introductions, assembles unpublished service pages,
 * validates and saves candidates. Does not publish or index.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  AI_LOCAL_PILOT_V3_MAX_COST_USD,
  loadAiLocalCopyPilotV3,
} from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
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
import {
  assignUkLocalIntroductionStructures,
  persistUkLocalIntroductionAssignments,
  UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS,
  UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS,
  UK_LOCAL_INTRODUCTION_GEMINI_MAX_WORDS,
  UK_LOCAL_INTRODUCTION_GEMINI_MIN_WORDS,
  UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE,
  countUkLocalIntroductionWords,
} from "./contentEngine/pharmacyUkLocalIntroductionStyleContractV1.ts";
import {
  assembleUkLocalEvidenceBrief,
  saveUkLocalEvidenceBrief,
} from "./contentEngine/pharmacyUkLocalEvidenceBriefV1.ts";
import { localNarrativeFingerprint } from "./contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { stripIdentityTokens } from "./contentEngine/pharmacyLocalPageCandidateUniquenessV1.ts";
import { stripRendererOwnedLocalHandoverClinicalSentence } from "./contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  resolveCampaignBuilderServiceName,
  resolveStoredCampaignBuilderAreaScope,
} from "./growthEngineCampaignBuilderService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const CREATE_TEN_LOCAL_SERVICE_PAGES_LABEL = "Create ten local service pages";
export const RESUME_TEN_LOCAL_SERVICE_PAGES_LABEL = "Resume ten local service pages";
export const UK_LOCAL_SERVICE_PAGES_CAMPAIGN_KIND = "uk-local-service-pages-campaign-run-v1";
export const UK_LOCAL_SERVICE_PAGES_CAMPAIGN_DIRNAME = "data/pharmacy-local-page-campaign-runs";
export const UK_LOCAL_SERVICE_PAGES_CAMPAIGN_VERSION = "v1";
export const UK_LOCAL_SERVICE_PAGES_CHECKPOINT_DIRNAME = "data/pharmacy-ai-local-copy-checkpoints";

export type UkLocalServicePagesStatus =
  | "idle"
  | "authorised"
  | "running"
  | "interrupted"
  | "stopped"
  | "completed";

export type UkLocalServicePagesAreaStatus = "pending" | "running" | "completed" | "failed";
export type UkLocalServicePagesStage = "evidence" | "brief" | "generation" | "validation" | "save";

export type UkLocalServicePagesAreaPlan = {
  areaName: string;
  areaSlug: string;
  status: UkLocalServicePagesAreaStatus;
  evidenceReady: boolean;
  evidenceCollectionRequired: boolean;
  evidenceBlocked: boolean;
  evidenceBlocker: string | null;
  introductionStructureId: string;
  maxEvidenceCalls: number;
  maxEvidenceCostUsd: number;
  maxGenerationCalls: number;
  maxGenerationCostUsd: number;
  previewUrl?: string;
  reviewUrl?: string;
};

export type UkLocalServicePagesCampaignPlan = {
  slug: string;
  serviceId: string;
  serviceName: string;
  primaryTown: string;
  destinationTenant: string;
  fingerprint: string;
  areas: UkLocalServicePagesAreaPlan[];
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

export type UkLocalServicePagesAreaState = UkLocalServicePagesAreaPlan & {
  stage: UkLocalServicePagesStage | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type UkLocalServicePagesCampaignRun = {
  kind: typeof UK_LOCAL_SERVICE_PAGES_CAMPAIGN_KIND;
  runId: string;
  slug: string;
  serviceId: string;
  fingerprint: string;
  snapshotDir: string | null;
  status: Exclude<UkLocalServicePagesStatus, "idle">;
  confirmedAt: string;
  authorisedBy: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  currentAreaSlug: string | null;
  currentStage: UkLocalServicePagesStage | null;
  failedAreaSlug: string | null;
  failedStage: UkLocalServicePagesStage | null;
  failedError: string | null;
  areas: UkLocalServicePagesAreaState[];
  previousFingerprints: string[];
  maxEvidenceCalls: number;
  maxGenerationCalls: number;
  maxProviderCalls: number;
  maxEvidenceCostUsd: number;
  maxGenerationCostUsd: number;
  maxTotalCostUsd: number;
};

export type UkLocalServicePagesDeps = {
  listSelectedAreas?: (slug: string) => { areaName: string; areaSlug: string }[];
  processArea?: (
    area: UkLocalServicePagesAreaPlan,
    previousFingerprints: string[],
  ) => Promise<{ ok: boolean; stage: UkLocalServicePagesStage; error?: string; previewUrl?: string; reviewUrl?: string }>;
  runRoot?: string;
};

const inFlight = new Map<string, Promise<UkLocalServicePagesCampaignRun>>();

function money(value: number, digits = 3): string {
  return `$${Number(value || 0).toFixed(digits)}`;
}

function roundUsd(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function flightKey(slug: string, serviceId: string): string {
  return `uk-local:${slug}:${serviceId}`;
}

function destinationTenantName(slug: string): string {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return slug;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: Record<string, unknown> };
    const data = normalizeProfileData(doc.data || {});
    return String(data.pharmacyName || data.tradingName || slug).trim() || slug;
  } catch {
    return slug;
  }
}

export function ukLocalServicePagesCampaignRunPath(
  slug: string,
  serviceId: string,
  explicitRoot?: string,
): string {
  return path.join(
    explicitRoot ||
      process.env.PHARMACY_LOCAL_PAGE_CAMPAIGN_RUN_ROOT ||
      path.join(PHARMACY_WORKSPACE_ROOT, UK_LOCAL_SERVICE_PAGES_CAMPAIGN_DIRNAME),
    slug,
    serviceId,
    UK_LOCAL_SERVICE_PAGES_CAMPAIGN_VERSION,
    "uk-local-service-pages.json",
  );
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

async function withFileLock<T>(file: string, fn: () => Promise<T> | T): Promise<T> {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const started = Date.now();
  while (true) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
      break;
    } catch {
      if (Date.now() - started > 8000) throw new Error("uk-local-service-pages-campaign-lock-timeout");
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

function selectedAreas(slug: string, deps?: UkLocalServicePagesDeps) {
  return deps?.listSelectedAreas ? deps.listSelectedAreas(slug) : listSelectedOneLocalPageCandidateAreas(slug);
}

function planOneArea(
  slug: string,
  serviceId: string,
  area: { areaName: string; areaSlug: string },
  introductionStructureId: string,
): UkLocalServicePagesAreaPlan {
  const preflight = preflightOneLocalPageCandidate(slug, serviceId, area.areaSlug);
  const evidence = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, serviceId, area.areaSlug));
  const additional = (evidence.proposedCalls || []).filter((row) => !row.cached && Number(row.estimatedCostUsd || 0) > 0);
  const readiness = assessSavedLocalPageGenerationReadiness(slug, serviceId, area.areaName, area.areaSlug);
  const evidenceReady = readiness.canGenerate;
  const evidenceCollectionRequired = !evidenceReady && additional.length > 0;
  const evidenceBlocked = !evidenceReady && !evidenceCollectionRequired;
  return {
    areaName: area.areaName,
    areaSlug: area.areaSlug,
    status: "pending",
    evidenceReady,
    evidenceCollectionRequired,
    evidenceBlocked,
    evidenceBlocker: evidenceBlocked ? readiness.reasons.join("; ") || "Evidence is not ready." : null,
    introductionStructureId,
    maxEvidenceCalls: additional.length,
    maxEvidenceCostUsd: roundUsd(additional.reduce((sum, row) => sum + Number(row.estimatedCostUsd || 0), 0)),
    maxGenerationCalls: 1,
    maxGenerationCostUsd: AI_LOCAL_PILOT_V3_MAX_COST_USD,
    previewUrl: preflight.previewUrl,
    reviewUrl: preflight.reviewUrl,
  };
}

export function planUkLocalServicePagesCampaign(
  slug: string,
  serviceId: string,
  deps?: UkLocalServicePagesDeps,
): UkLocalServicePagesCampaignPlan {
  const selected = selectedAreas(slug, deps);
  const assigned = assignUkLocalIntroductionStructures({
    slug,
    serviceId,
    areaSlugs: selected.map((row) => row.areaSlug),
  });
  const areas = selected.map((area) =>
    planOneArea(slug, serviceId, area, assigned.get(area.areaSlug)?.id || "civic-identity-first"),
  );
  const maxEvidenceCalls = areas.reduce((sum, row) => sum + row.maxEvidenceCalls, 0);
  const maxGenerationCalls = areas.reduce((sum, row) => sum + row.maxGenerationCalls, 0);
  const maxEvidenceCostUsd = roundUsd(areas.reduce((sum, row) => sum + row.maxEvidenceCostUsd, 0));
  const maxGenerationCostUsd = roundUsd(areas.reduce((sum, row) => sum + row.maxGenerationCostUsd, 0), 3);
  const scope = resolveStoredCampaignBuilderAreaScope(slug);
  return {
    slug,
    serviceId,
    serviceName: resolveCampaignBuilderServiceName(serviceId),
    primaryTown: scope.primaryTown,
    destinationTenant: destinationTenantName(slug),
    fingerprint: createHash("sha256")
      .update(JSON.stringify({ slug, serviceId, kind: UK_LOCAL_SERVICE_PAGES_CAMPAIGN_KIND, areas: areas.map((row) => row.areaSlug) }))
      .digest("hex"),
    areas,
    evidenceCurrentlyReadyCount: areas.filter((row) => row.evidenceReady).length,
    evidenceRequiringCollectionCount: areas.filter((row) => row.evidenceCollectionRequired).length,
    generationCurrentlyBlockedCount: areas.filter((row) => row.evidenceBlocked).length,
    maxEvidenceCalls,
    maxGenerationCalls,
    maxProviderCalls: maxEvidenceCalls + maxGenerationCalls,
    maxEvidenceCostUsd,
    maxGenerationCostUsd,
    maxTotalCostUsd: roundUsd(maxEvidenceCostUsd + maxGenerationCostUsd, 3),
    maxEvidenceCostLabel: money(maxEvidenceCostUsd),
    maxGenerationCostLabel: money(maxGenerationCostUsd),
    maxTotalCostLabel: money(maxEvidenceCostUsd + maxGenerationCostUsd),
    maxProviderCallsLabel: String(maxEvidenceCalls + maxGenerationCalls),
  };
}

function toAreaState(
  area: UkLocalServicePagesAreaPlan,
  extras?: Partial<UkLocalServicePagesAreaState>,
): UkLocalServicePagesAreaState {
  return {
    ...area,
    stage: extras?.stage ?? null,
    error: extras?.error ?? null,
    startedAt: extras?.startedAt ?? null,
    completedAt: extras?.completedAt ?? null,
    status: extras?.status ?? area.status,
  };
}

function newRunFromPlan(plan: UkLocalServicePagesCampaignPlan, authorisedBy: string): UkLocalServicePagesCampaignRun {
  return {
    kind: UK_LOCAL_SERVICE_PAGES_CAMPAIGN_KIND,
    runId: randomUUID(),
    slug: plan.slug,
    serviceId: plan.serviceId,
    fingerprint: plan.fingerprint,
    snapshotDir: null,
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
    areas: plan.areas.map((row) => toAreaState(row, { status: "pending" })),
    previousFingerprints: [],
    maxEvidenceCalls: plan.maxEvidenceCalls,
    maxGenerationCalls: plan.maxGenerationCalls,
    maxProviderCalls: plan.maxProviderCalls,
    maxEvidenceCostUsd: plan.maxEvidenceCostUsd,
    maxGenerationCostUsd: plan.maxGenerationCostUsd,
    maxTotalCostUsd: plan.maxTotalCostUsd,
  };
}

function saveRun(run: UkLocalServicePagesCampaignRun, deps?: UkLocalServicePagesDeps): void {
  run.updatedAt = new Date().toISOString();
  writeJson(ukLocalServicePagesCampaignRunPath(run.slug, run.serviceId, deps?.runRoot), run);
}

export function loadUkLocalServicePagesCampaignRun(
  slug: string,
  serviceId: string,
  deps?: UkLocalServicePagesDeps,
): UkLocalServicePagesCampaignRun | null {
  return readJson<UkLocalServicePagesCampaignRun>(ukLocalServicePagesCampaignRunPath(slug, serviceId, deps?.runRoot));
}

export function getUkLocalServicePagesCampaign(
  slug: string,
  serviceId: string,
  deps?: UkLocalServicePagesDeps,
): { plan: UkLocalServicePagesCampaignPlan; run: UkLocalServicePagesCampaignRun | null } {
  return {
    plan: planUkLocalServicePagesCampaign(slug, serviceId, deps),
    run: loadUkLocalServicePagesCampaignRun(slug, serviceId, deps),
  };
}

export function snapshotLiveLocalServicePages(
  slug: string,
  serviceId: string,
  areas: Array<{ areaSlug: string }>,
  runId: string,
  snapshotRoot?: string,
): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const snapshotDir = path.join(
    snapshotRoot || path.join(PHARMACY_WORKSPACE_ROOT, UK_LOCAL_SERVICE_PAGES_CHECKPOINT_DIRNAME),
    slug,
    serviceId,
    AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
    `uk-local-service-pages-${stamp}-${runId.slice(0, 8)}`,
  );
  for (const area of areas) {
    const liveCopy = aiLocalCopyPilotPath(slug, serviceId, area.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
    const liveHtml = aiLocalPagePilotHtmlPath(slug, serviceId, area.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
    if (fs.existsSync(liveCopy)) {
      const dest = path.join(snapshotDir, "copy", `${area.areaSlug}.json`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(liveCopy, dest);
    }
    if (fs.existsSync(liveHtml)) {
      const dest = path.join(snapshotDir, "html", area.areaSlug, "index.html");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(liveHtml, dest);
    }
  }
  return snapshotDir;
}

function updateArea(
  run: UkLocalServicePagesCampaignRun,
  areaSlug: string,
  patch: Partial<UkLocalServicePagesAreaState>,
): void {
  const index = run.areas.findIndex((row) => row.areaSlug === areaSlug);
  if (index < 0) return;
  run.areas[index] = { ...run.areas[index]!, ...patch };
}

function nextPendingArea(run: UkLocalServicePagesCampaignRun): UkLocalServicePagesAreaState | null {
  return run.areas.find((row) => row.status === "running") || run.areas.find((row) => row.status === "pending") || null;
}

function fingerprintFromSavedCopy(slug: string, serviceId: string, areaSlug: string): string | null {
  const record = loadAiLocalCopyPilotV3(slug, serviceId, areaSlug);
  const copy = record?.outputCopy;
  if (!copy) return null;
  return stripIdentityTokens(copy.localIntroduction || localNarrativeFingerprint(copy), {
    pharmacyName: "",
    areaName: copy.area,
    telephone: "",
    address: "",
    distanceLabel: "",
    siblingAreaNames: [],
  });
}

function savedGeminiLocalIntroductionIsComplete(slug: string, serviceId: string, areaSlug: string): boolean {
  const record = loadAiLocalCopyPilotV3(slug, serviceId, areaSlug);
  if (!record || record.validationResult?.ok === false) return false;
  if (!String(record.model || "").toLowerCase().includes("gemini")) return false;
  const hero = String(record.outputCopy?.heroIntroduction || "");
  const introduction = String(record.outputCopy?.localIntroduction || "");
  const paragraphs = introduction
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const heroWords = countUkLocalIntroductionWords(hero);
  const localWords = countUkLocalIntroductionWords(
    stripRendererOwnedLocalHandoverClinicalSentence(introduction),
  );
  return (
    heroWords >= UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS &&
    heroWords <= UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS &&
    localWords >= UK_LOCAL_INTRODUCTION_GEMINI_MIN_WORDS &&
    localWords <= UK_LOCAL_INTRODUCTION_GEMINI_MAX_WORDS &&
    paragraphs.length === 3 &&
    /pharmacy first/i.test(hero) &&
    /brook pharmacy/i.test(hero) &&
    /pharmacy first/i.test(introduction) &&
    /brook pharmacy/i.test(introduction) &&
    /clinical assessment/i.test(introduction) &&
    !UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE.test(`${hero}\n${introduction}`)
  );
}

export async function executeUkLocalServicePageAreaWorkflow(
  slug: string,
  serviceId: string,
  area: UkLocalServicePagesAreaPlan,
  previousFingerprints: string[] = [],
): Promise<{ ok: boolean; stage: UkLocalServicePagesStage; error?: string; previewUrl?: string; reviewUrl?: string }> {
  if (savedGeminiLocalIntroductionIsComplete(slug, serviceId, area.areaSlug)) {
    const preflight = preflightOneLocalPageCandidate(slug, serviceId, area.areaSlug);
    return {
      ok: true,
      stage: "save",
      previewUrl: preflight.previewUrl,
      reviewUrl: preflight.reviewUrl,
    };
  }
  const existingRun = getLocalPageEvidenceRun(slug, serviceId, area.areaSlug);
  const collectionFinished = existingRun?.status === "completed" || existingRun?.status === "stopped";
  const alreadyReady = assessSavedLocalPageGenerationReadiness(slug, serviceId, area.areaName, area.areaSlug).canGenerate;
  if (!alreadyReady && !collectionFinished) {
    const plan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, serviceId, area.areaSlug));
    const cap = Math.max(roundUsd((plan.estimatedCostUsd || 0) + 0.001), 0.01);
    const authorised = authoriseLocalPageEvidencePlan({
      slug,
      serviceId,
      areaSlug: area.areaSlug,
      spendingCapUsd: cap,
      confirmAuthorise: true,
      planFingerprint: plan.planFingerprint,
      authorisedBy: "campaign-uk-local-service-pages",
    });
    if (!authorised.ok) return { ok: false, stage: "evidence", error: authorised.error };
    const collected = await startLocalPageEvidenceCollection({
      slug,
      serviceId,
      areaSlug: area.areaSlug,
      allowLiveProviders: true,
    });
    if (!collected.ok) return { ok: false, stage: "evidence", error: collected.error };
  }

  const readiness = assessSavedLocalPageGenerationReadiness(slug, serviceId, area.areaName, area.areaSlug);
  if (!readiness.canGenerate) {
    return {
      ok: false,
      stage: "evidence",
      error: readiness.reasons.join("; ") || `${area.areaName} evidence is not sufficient for an honest page.`,
    };
  }

  saveUkLocalEvidenceBrief(
    assembleUkLocalEvidenceBrief({
      slug,
      serviceId,
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      introductionStructureId: area.introductionStructureId as never,
    }),
  );

  const generated = await generateOneLocalPageCandidate({
    slug,
    serviceId,
    areaSlug: area.areaSlug,
    previousFingerprints,
    replaceExistingCandidate: true,
    maxAttempts: 1,
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
  run: UkLocalServicePagesCampaignRun,
  deps?: UkLocalServicePagesDeps,
): Promise<UkLocalServicePagesCampaignRun> {
  const processArea =
    deps?.processArea ||
    ((area: UkLocalServicePagesAreaPlan, previousFingerprints: string[]) =>
      executeUkLocalServicePageAreaWorkflow(run.slug, run.serviceId, area, previousFingerprints));
  persistUkLocalIntroductionAssignments({
    slug: run.slug,
    serviceId: run.serviceId,
    areaSlugs: run.areas.map((row) => row.areaSlug),
  });
  if (!run.snapshotDir) {
    run.snapshotDir = snapshotLiveLocalServicePages(run.slug, run.serviceId, run.areas, run.runId, deps?.runRoot);
  }
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
    updateArea(run, current.areaSlug, {
      status: "running",
      stage: "evidence",
      error: null,
      startedAt: current.startedAt || new Date().toISOString(),
    });
    run.currentAreaSlug = current.areaSlug;
    run.currentStage = "evidence";
    saveRun(run, deps);

    const result = await processArea(current, run.previousFingerprints);
    if (!result.ok) {
      updateArea(run, current.areaSlug, {
        status: "failed",
        stage: result.stage,
        error: result.error || "The local page could not be created.",
        completedAt: new Date().toISOString(),
      });
      run.status = "stopped";
      run.failedAreaSlug = current.areaSlug;
      run.failedStage = result.stage;
      run.failedError = result.error || "The local page could not be created.";
      run.currentAreaSlug = current.areaSlug;
      run.currentStage = result.stage;
      saveRun(run, deps);
      return run;
    }

    const fingerprint = fingerprintFromSavedCopy(run.slug, run.serviceId, current.areaSlug);
    if (fingerprint) run.previousFingerprints.push(fingerprint);
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
  return run;
}

export function clearUkLocalServicePagesCampaignRuntimeForTests(): void {
  inFlight.clear();
}

export async function confirmUkLocalServicePagesCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  deps?: UkLocalServicePagesDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: UkLocalServicePagesCampaignPlan; run: UkLocalServicePagesCampaignRun }
  | { ok: false; error: string; status: number; plan?: UkLocalServicePagesCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. No local service pages were started.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Local service-page runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planUkLocalServicePagesCampaign(opts.slug, opts.serviceId, opts.deps);
  if (!plan.areas.length) {
    return { ok: false, status: 409, error: "Select the campaign’s ten local areas before creating local service pages.", plan };
  }
  const file = ukLocalServicePagesCampaignRunPath(opts.slug, opts.serviceId, opts.deps?.runRoot);
  const key = flightKey(opts.slug, opts.serviceId);

  type ConfirmLockResult = {
    run: UkLocalServicePagesCampaignRun;
    duplicate: boolean;
    start: boolean;
    active?: Promise<UkLocalServicePagesCampaignRun>;
    resolveFlight?: (run: UkLocalServicePagesCampaignRun) => void;
  };
  const started = await withFileLock(file, async (): Promise<ConfirmLockResult> => {
    const existing = loadUkLocalServicePagesCampaignRun(opts.slug, opts.serviceId, opts.deps);
    const active = inFlight.get(key);
    if (active) {
      return {
        run: existing || newRunFromPlan(plan, String(opts.authorisedBy || "authenticated-session")),
        duplicate: true,
        start: false,
        active,
      };
    }
    if (existing && (existing.status === "running" || existing.status === "authorised" || existing.status === "interrupted")) {
      existing.status = "running";
      saveRun(existing, opts.deps);
      let resolveFlight = (_run: UkLocalServicePagesCampaignRun) => undefined;
      const flight = new Promise<UkLocalServicePagesCampaignRun>((resolve) => {
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
    let resolveFlight = (_run: UkLocalServicePagesCampaignRun) => undefined;
    const flight = new Promise<UkLocalServicePagesCampaignRun>((resolve) => {
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
      const latest = loadUkLocalServicePagesCampaignRun(opts.slug, opts.serviceId, opts.deps);
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

export async function resumeUkLocalServicePagesCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  runId?: string;
  deps?: UkLocalServicePagesDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: UkLocalServicePagesCampaignPlan; run: UkLocalServicePagesCampaignRun }
  | { ok: false; error: string; status: number; plan?: UkLocalServicePagesCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. The stopped local service-page run was not resumed.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Local service-page runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planUkLocalServicePagesCampaign(opts.slug, opts.serviceId, opts.deps);
  const existing = loadUkLocalServicePagesCampaignRun(opts.slug, opts.serviceId, opts.deps);
  if (!existing || existing.status !== "stopped") {
    return { ok: false, status: 409, error: "There is no stopped local service-page run to resume.", plan };
  }
  if (opts.runId && existing.runId !== opts.runId) {
    return { ok: false, status: 409, error: "This resume request does not match the saved campaign run.", plan };
  }
  existing.status = "authorised";
  existing.failedAreaSlug = null;
  existing.failedStage = null;
  existing.failedError = null;
  existing.areas = existing.areas.map((area) =>
    area.status === "failed" || area.status === "pending" || area.status === "running"
      ? { ...area, status: "pending", stage: null, error: null }
      : area,
  );
  saveRun(existing, opts.deps);
  const key = flightKey(opts.slug, opts.serviceId);
  if (inFlight.get(key)) {
    return { ok: true, duplicate: true, plan, run: existing };
  }
  let resolveFlight = (_run: UkLocalServicePagesCampaignRun) => undefined;
  const flight = new Promise<UkLocalServicePagesCampaignRun>((resolve) => {
    resolveFlight = resolve;
  });
  inFlight.set(key, flight);
  const work = processRun(existing, opts.deps)
    .then((finished) => {
      resolveFlight(finished);
      return finished;
    })
    .finally(() => inFlight.delete(key));
  if (opts.processInline === false) {
    work.catch(() => undefined);
    return { ok: true, duplicate: false, plan, run: existing };
  }
  return { ok: true, duplicate: false, plan, run: await work };
}
