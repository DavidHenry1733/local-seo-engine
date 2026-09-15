/**
 * Campaign-level V2 local-page improvement run.
 * Reuses the existing Campaign Builder evidence, writer, validators and Review Centre.
 * Snapshots rejected V1 candidates, then enriches and regenerates all selected areas.
 * One OpenAI call per area. No automatic retry. Does not publish.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  loadAiLocalCopyPilotV3,
} from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import {
  distinctVerifiedLocalReferenceLabelsFromFacts,
  distinctVerifiedLocalReferencesFromCopy,
  localContextNarrativeFingerprint,
  MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2,
  stripRendererOwnedPharmacyFirstSentences,
} from "./contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import {
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { loadEditorialEvidencePack } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { stripIdentityTokens } from "./contentEngine/pharmacyLocalPageCandidateUniquenessV1.ts";
import { assessSavedLocalPageGenerationReadiness } from "./contentEngine/pharmacyLocalPageGenerationReadinessV1.ts";
import {
  generateOneLocalPageCandidate,
  listSelectedOneLocalPageCandidateAreas,
  preflightOneLocalPageCandidate,
} from "./growthEngineLocalPageCandidateService.ts";
import {
  authoriseLocalPageEvidencePlan,
  decorateLocalPageEvidencePlan,
  getLocalPageEvidenceRun,
  loadEvidenceBudget,
  reprocessLocalPageEvidenceRun,
  startLocalPageEvidenceCollection,
  uncachedPaidEvidenceFollowUpRequired,
} from "./growthEngineLocalPageEvidenceCollectionService.ts";
import { planOneLocalPageEvidencePreparation } from "./growthEngineLocalPageEvidencePreparationService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const IMPROVE_LOCAL_PAGES_LABEL = "Improve local pages";
export const RESUME_IMPROVE_LOCAL_PAGES_LABEL = "Resume local-page improvements";
export const LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_KIND = "local-page-improvement-campaign-run-v2";
export const LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_DIRNAME = "data/pharmacy-local-page-campaign-runs";
export const LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_VERSION = "v2";
export const LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD = 18.544;
export const LOCAL_PAGE_IMPROVEMENT_OPENAI_CALL_COST_USD = 0.5;
export const REJECTED_V1_COPY_DIRNAME = "data/pharmacy-ai-local-copy-rejected-v1";
export const REJECTED_V1_HTML_DIRNAME = "output/pharmacy-ai-local-page-rejected-v1";

export type LocalPageImprovementStatus = "idle" | "authorised" | "running" | "interrupted" | "stopped" | "completed";
export type LocalPageImprovementAreaStatus = "pending" | "running" | "completed" | "failed";
export type LocalPageImprovementStage = "snapshot" | "evidence" | "distance" | "generation" | "validation" | "save";

export type LocalPageImprovementAreaPlan = {
  areaName: string;
  areaSlug: string;
  status: LocalPageImprovementAreaStatus;
  evidenceAlreadySaved: boolean;
  evidenceFactCount: number;
  evidenceSpentUsd: number;
  additionalProviderCalls: number;
  additionalEvidenceCostUsd: number;
  maxEvidenceCalls: number;
  maxEvidenceCostUsd: number;
  maxGenerationCalls: number;
  maxGenerationCostUsd: number;
  previewUrl?: string;
  reviewUrl?: string;
};

export type LocalPageImprovementCampaignPlan = {
  slug: string;
  serviceId: string;
  fingerprint: string;
  areas: LocalPageImprovementAreaPlan[];
  evidenceAlreadySavedCount: number;
  additionalProviderCalls: number;
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
  exceedsHardMaximum: boolean;
  hardMaximumUsd: number;
};

export type LocalPageImprovementAreaState = LocalPageImprovementAreaPlan & {
  stage: LocalPageImprovementStage | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  localReferences?: string[];
};

export type LocalPageImprovementCampaignRun = {
  kind: typeof LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_KIND;
  runId: string;
  slug: string;
  serviceId: string;
  fingerprint: string;
  status: LocalPageImprovementStatus;
  confirmedAt: string;
  authorisedBy: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  currentAreaSlug: string | null;
  currentStage: LocalPageImprovementStage | null;
  failedAreaSlug: string | null;
  failedStage: LocalPageImprovementStage | null;
  failedError: string | null;
  v1SnapshotDir: string;
  areas: LocalPageImprovementAreaState[];
  maxEvidenceCalls: number;
  maxGenerationCalls: number;
  maxProviderCalls: number;
  maxEvidenceCostUsd: number;
  maxGenerationCostUsd: number;
  maxTotalCostUsd: number;
};

export type LocalPageImprovementDeps = {
  runRoot?: string;
  snapshotRoot?: string;
  listSelectedAreas?: (slug: string) => Array<{ areaName: string; areaSlug: string }>;
  processArea?: (area: LocalPageImprovementAreaPlan) => Promise<{
    ok: boolean;
    stage: LocalPageImprovementStage;
    error?: string;
    previewUrl?: string;
    reviewUrl?: string;
    localReferences?: string[];
  }>;
  assembleAll?: (slug: string, serviceId: string, areaSlugs: string[]) => void;
};

const inFlight = new Map<string, Promise<LocalPageImprovementCampaignRun>>();

function roundUsd(value: number, digits = 3): number {
  return Number(Number(value || 0).toFixed(digits));
}

function money(value: number, digits = 3): string {
  return `$${roundUsd(value, digits).toFixed(digits)}`;
}

function flightKey(slug: string, serviceId: string): string {
  return `${slug}:${serviceId}:local-page-improvement-v2`;
}

export function localPageImprovementCampaignRunPath(slug: string, serviceId: string, runRoot?: string): string {
  return path.join(
    runRoot || PHARMACY_WORKSPACE_ROOT,
    LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_DIRNAME,
    slug,
    serviceId,
    LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_VERSION,
    "local-page-improvement.json",
  );
}

export function rejectedV1CopyPath(slug: string, serviceId: string, areaSlug: string, snapshotRoot?: string): string {
  return path.join(snapshotRoot || PHARMACY_WORKSPACE_ROOT, REJECTED_V1_COPY_DIRNAME, slug, serviceId, `${areaSlug}.json`);
}

export function rejectedV1HtmlPath(slug: string, serviceId: string, areaSlug: string, snapshotRoot?: string): string {
  return path.join(
    snapshotRoot || PHARMACY_WORKSPACE_ROOT,
    REJECTED_V1_HTML_DIRNAME,
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

export function snapshotRejectedV1LocalPages(
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
    const snapCopy = rejectedV1CopyPath(slug, serviceId, area.areaSlug, snapshotRoot);
    const snapHtml = rejectedV1HtmlPath(slug, serviceId, area.areaSlug, snapshotRoot);
    copyFileIfMissing(liveCopy, snapCopy);
    copyFileIfMissing(liveHtml, snapHtml);
    copyHashes[area.areaSlug] = sha256File(snapCopy);
    htmlHashes[area.areaSlug] = sha256File(snapHtml);
  }
  return { copyHashes, htmlHashes };
}

function fingerprintPlan(slug: string, serviceId: string, areas: LocalPageImprovementAreaPlan[]): string {
  return createHash("sha256")
    .update(JSON.stringify({ slug, serviceId, kind: LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_KIND, areas: areas.map((row) => row.areaSlug) }))
    .digest("hex");
}

export function countDistinctVerifiedLocalEvidence(slug: string, serviceId: string, areaSlug: string): string[] {
  const editorial = loadEditorialEvidencePack(slug, serviceId, areaSlug);
  return distinctVerifiedLocalReferenceLabelsFromFacts(editorial?.facts || []);
}

function planOneArea(slug: string, serviceId: string, area: { areaName: string; areaSlug: string }): LocalPageImprovementAreaPlan {
  const preflight = preflightOneLocalPageCandidate(slug, serviceId, area.areaSlug);
  const evidence = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, serviceId, area.areaSlug));
  const additional = (evidence.proposedCalls || []).filter(
    (row) => !row.cached && Number(row.estimatedCostUsd || 0) > 0,
  );
  const factCount = Number(evidence.cacheReuse?.editorialFactCount || 0);
  const spent = Number(evidence.collectionSpentUsd || 0);
  return {
    areaName: area.areaName,
    areaSlug: area.areaSlug,
    status: "pending",
    evidenceAlreadySaved: Boolean(evidence.cacheReuse?.editorialReady || evidence.cacheReuse?.localPackReady),
    evidenceFactCount: factCount,
    evidenceSpentUsd: roundUsd(spent),
    additionalProviderCalls: additional.length,
    additionalEvidenceCostUsd: roundUsd(additional.reduce((sum, row) => sum + Number(row.estimatedCostUsd || 0), 0)),
    maxEvidenceCalls: additional.length,
    maxEvidenceCostUsd: roundUsd(additional.reduce((sum, row) => sum + Number(row.estimatedCostUsd || 0), 0)),
    maxGenerationCalls: 1,
    maxGenerationCostUsd: LOCAL_PAGE_IMPROVEMENT_OPENAI_CALL_COST_USD,
    previewUrl: preflight.previewUrl,
    reviewUrl: preflight.reviewUrl,
  };
}

export function planLocalPageImprovementCampaign(
  slug: string,
  serviceId: string,
  deps?: LocalPageImprovementDeps,
): LocalPageImprovementCampaignPlan {
  const selected = deps?.listSelectedAreas ? deps.listSelectedAreas(slug) : listSelectedOneLocalPageCandidateAreas(slug);
  const areas = selected.map((area) => planOneArea(slug, serviceId, area));
  const maxEvidenceCalls = areas.reduce((sum, row) => sum + row.maxEvidenceCalls, 0);
  const maxGenerationCalls = areas.reduce((sum, row) => sum + row.maxGenerationCalls, 0);
  const maxEvidenceCostUsd = roundUsd(areas.reduce((sum, row) => sum + row.maxEvidenceCostUsd, 0));
  const maxGenerationCostUsd = roundUsd(areas.reduce((sum, row) => sum + row.maxGenerationCostUsd, 0), 3);
  const maxTotalCostUsd = roundUsd(maxEvidenceCostUsd + maxGenerationCostUsd);
  return {
    slug,
    serviceId,
    fingerprint: fingerprintPlan(slug, serviceId, areas),
    areas,
    evidenceAlreadySavedCount: areas.filter((row) => row.evidenceAlreadySaved).length,
    additionalProviderCalls: areas.reduce((sum, row) => sum + row.additionalProviderCalls, 0),
    maxEvidenceCalls,
    maxGenerationCalls,
    maxProviderCalls: maxEvidenceCalls + maxGenerationCalls,
    maxEvidenceCostUsd,
    maxGenerationCostUsd,
    maxTotalCostUsd,
    maxEvidenceCostLabel: money(maxEvidenceCostUsd),
    maxGenerationCostLabel: money(maxGenerationCostUsd),
    maxTotalCostLabel: money(maxTotalCostUsd),
    maxProviderCallsLabel: `${maxEvidenceCalls} evidence call${maxEvidenceCalls === 1 ? "" : "s"} + ${maxGenerationCalls} OpenAI call${maxGenerationCalls === 1 ? "" : "s"}`,
    exceedsHardMaximum: maxTotalCostUsd > LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD,
    hardMaximumUsd: LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD,
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
      if (Date.now() - started > 8000) throw new Error("local-page-improvement-campaign-lock-timeout");
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
  area: LocalPageImprovementAreaPlan,
  extras?: Partial<LocalPageImprovementAreaState>,
): LocalPageImprovementAreaState {
  return {
    ...area,
    stage: null,
    error: null,
    startedAt: null,
    completedAt: null,
    ...extras,
  };
}

function newRunFromPlan(plan: LocalPageImprovementCampaignPlan, authorisedBy: string, snapshotRoot?: string): LocalPageImprovementCampaignRun {
  return {
    kind: LOCAL_PAGE_IMPROVEMENT_CAMPAIGN_KIND,
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
    v1SnapshotDir: path.join(snapshotRoot || PHARMACY_WORKSPACE_ROOT, REJECTED_V1_COPY_DIRNAME, plan.slug, plan.serviceId),
    areas: plan.areas.map((row) => toAreaState(row)),
    maxEvidenceCalls: plan.maxEvidenceCalls,
    maxGenerationCalls: plan.maxGenerationCalls,
    maxProviderCalls: plan.maxProviderCalls,
    maxEvidenceCostUsd: plan.maxEvidenceCostUsd,
    maxGenerationCostUsd: plan.maxGenerationCostUsd,
    maxTotalCostUsd: plan.maxTotalCostUsd,
  };
}

export function loadLocalPageImprovementCampaignRun(
  slug: string,
  serviceId: string,
  deps?: LocalPageImprovementDeps,
): LocalPageImprovementCampaignRun | null {
  return readJson<LocalPageImprovementCampaignRun>(localPageImprovementCampaignRunPath(slug, serviceId, deps?.runRoot));
}

function saveRun(run: LocalPageImprovementCampaignRun, deps?: LocalPageImprovementDeps): void {
  run.updatedAt = new Date().toISOString();
  writeJson(localPageImprovementCampaignRunPath(run.slug, run.serviceId, deps?.runRoot), run);
}

export function getLocalPageImprovementCampaign(
  slug: string,
  serviceId: string,
  deps?: LocalPageImprovementDeps,
): { plan: LocalPageImprovementCampaignPlan; run: LocalPageImprovementCampaignRun | null } {
  return {
    plan: planLocalPageImprovementCampaign(slug, serviceId, deps),
    run: loadLocalPageImprovementCampaignRun(slug, serviceId, deps),
  };
}

function updateArea(
  run: LocalPageImprovementCampaignRun,
  areaSlug: string,
  patch: Partial<LocalPageImprovementAreaState>,
): LocalPageImprovementAreaState {
  const index = run.areas.findIndex((row) => row.areaSlug === areaSlug);
  if (index < 0) throw new Error(`unknown improvement area ${areaSlug}`);
  run.areas[index] = { ...run.areas[index], ...patch };
  return run.areas[index];
}

function nextPendingArea(run: LocalPageImprovementCampaignRun): LocalPageImprovementAreaState | null {
  return run.areas.find((row) => row.status === "running") || run.areas.find((row) => row.status === "pending") || null;
}

function siblingImprovedFingerprints(
  slug: string,
  serviceId: string,
  currentAreaSlug: string,
  completedSlugs: string[],
): string[] {
  const fingerprints: string[] = [];
  for (const area of listSelectedOneLocalPageCandidateAreas(slug)) {
    if (area.areaSlug === currentAreaSlug) continue;
    if (!completedSlugs.includes(area.areaSlug)) continue;
    const record = loadAiLocalCopyPilotV3(slug, serviceId, area.areaSlug);
    if (!record?.outputCopy) continue;
    fingerprints.push(
      stripIdentityTokens(
        stripRendererOwnedPharmacyFirstSentences(localContextNarrativeFingerprint(record.outputCopy)),
        {
          pharmacyName: "",
          areaName: record.areaName || area.areaName,
        },
      ),
    );
  }
  return fingerprints;
}

export async function executeLocalPageImprovementAreaWorkflow(
  slug: string,
  serviceId: string,
  area: LocalPageImprovementAreaPlan,
  deps?: LocalPageImprovementDeps,
  completedSlugs: string[] = [],
): Promise<{
  ok: boolean;
  stage: LocalPageImprovementStage;
  error?: string;
  previewUrl?: string;
  reviewUrl?: string;
  localReferences?: string[];
}> {
  snapshotRejectedV1LocalPages(slug, serviceId, [area], deps?.snapshotRoot);

  const evidencePlan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, serviceId, area.areaSlug));
  const additionalPaid = (evidencePlan.proposedCalls || []).filter(
    (row) => !row.cached && Number(row.estimatedCostUsd || 0) > 0,
  );
  const followUp = uncachedPaidEvidenceFollowUpRequired(getLocalPageEvidenceRun(slug, serviceId, area.areaSlug), evidencePlan);
  const namedBefore = countDistinctVerifiedLocalEvidence(slug, serviceId, area.areaSlug);
  const needsNamedLocalReferences = namedBefore.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2;
  if (additionalPaid.length || followUp || needsNamedLocalReferences) {
    if (needsNamedLocalReferences && getLocalPageEvidenceRun(slug, serviceId, area.areaSlug)) {
      const reprocessed = reprocessLocalPageEvidenceRun({ slug, serviceId, areaSlug: area.areaSlug });
      if (!reprocessed.ok) {
        return { ok: false, stage: "evidence", error: reprocessed.error };
      }
    }
    const namedAfterReprocess = countDistinctVerifiedLocalEvidence(slug, serviceId, area.areaSlug);
    const collectPlan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, serviceId, area.areaSlug));
    const collectPaid = (collectPlan.proposedCalls || []).filter(
      (row) => !row.cached && Number(row.estimatedCostUsd || 0) > 0,
    );
    const collectFollowUp = uncachedPaidEvidenceFollowUpRequired(
      getLocalPageEvidenceRun(slug, serviceId, area.areaSlug),
      collectPlan,
    );
    if (
      namedAfterReprocess.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2 &&
      (collectPaid.length || collectFollowUp || additionalPaid.length || followUp)
    ) {
      const budget = loadEvidenceBudget(slug, serviceId, area.areaSlug);
      const spent = Number(budget?.spentUsd || collectPlan.collectionSpentUsd || evidencePlan.collectionSpentUsd || 0);
      const additionalCost = collectPaid.reduce((sum, row) => sum + Number(row.estimatedCostUsd || 0), 0);
      const cap = Math.max(roundUsd(spent + additionalCost + 0.002), 0.01);
      const authorised = authoriseLocalPageEvidencePlan({
        slug,
        serviceId,
        areaSlug: area.areaSlug,
        spendingCapUsd: cap,
        confirmAuthorise: true,
        planFingerprint: collectPlan.planFingerprint,
        authorisedBy: "campaign-local-page-improvement",
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
      if (collected.run.status === "stopped" && namedAfterReprocess.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2) {
        const retried = reprocessLocalPageEvidenceRun({ slug, serviceId, areaSlug: area.areaSlug });
        if (!retried.ok) {
          return { ok: false, stage: "evidence", error: collected.run.stopReason || retried.error };
        }
      } else if (collected.run.status === "stopped") {
        return { ok: false, stage: "evidence", error: collected.run.stopReason || "Evidence collection stopped." };
      }
    }
  }

  const available = countDistinctVerifiedLocalEvidence(slug, serviceId, area.areaSlug);
  if (available.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2) {
    return {
      ok: false,
      stage: "evidence",
      error: `${area.areaName} has ${available.length} distinct verified local references after enrichment; at least ${MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2} are required. Facts were not invented.`,
    };
  }

  const readiness = assessSavedLocalPageGenerationReadiness(slug, serviceId, area.areaName, area.areaSlug);
  if (!readiness.canGenerate) {
    return {
      ok: false,
      stage: readiness.blockReasons.some((row) => /area-reference|area-identity/.test(row)) ? "evidence" : "distance",
      error: readiness.reasons.join("; ") || `${area.areaName} required deterministic facts are missing.`,
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
    previousFingerprints: siblingImprovedFingerprints(slug, serviceId, area.areaSlug, completedSlugs),
    requireImprovedLocalQuality: true,
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
  const editorial = loadEditorialEvidencePack(slug, serviceId, area.areaSlug);
  const localReferences = distinctVerifiedLocalReferencesFromCopy(record.outputCopy, editorial?.facts || []);
  if (localReferences.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2) {
    return {
      ok: false,
      stage: "validation",
      error: `fewer than ${MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2} distinct verified local references (${localReferences.join("; ") || "none"})`,
    };
  }
  return {
    ok: true,
    stage: "save",
    previewUrl: generated.previewUrl,
    reviewUrl: generated.reviewUrl,
    localReferences,
  };
}

async function processRun(
  run: LocalPageImprovementCampaignRun,
  deps?: LocalPageImprovementDeps,
): Promise<LocalPageImprovementCampaignRun> {
  snapshotRejectedV1LocalPages(run.slug, run.serviceId, run.areas, deps?.snapshotRoot);
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
        error: result.error || "Improvement stopped.",
        completedAt: new Date().toISOString(),
      });
      run.status = "stopped";
      run.failedAreaSlug = current.areaSlug;
      run.failedStage = result.stage;
      run.failedError = result.error || "Improvement stopped.";
      run.currentAreaSlug = current.areaSlug;
      run.currentStage = result.stage;
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
      localReferences: result.localReferences || [],
    });
    saveRun(run, deps);
  }
}

export async function confirmLocalPageImprovementCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  deps?: LocalPageImprovementDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: LocalPageImprovementCampaignPlan; run: LocalPageImprovementCampaignRun }
  | { ok: false; error: string; status: number; plan?: LocalPageImprovementCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. No local-page improvements were started.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Local-page improvement runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planLocalPageImprovementCampaign(opts.slug, opts.serviceId, opts.deps);
  if (plan.slug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Local-page improvement runs are scoped to the authenticated pharmacy.",
      plan,
    };
  }
  if (plan.exceedsHardMaximum) {
    return {
      ok: false,
      status: 409,
      error: `Platform estimate ${plan.maxTotalCostLabel} exceeds the hard maximum of $${LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD.toFixed(3)}. The improvement run was not started.`,
      plan,
    };
  }
  const file = localPageImprovementCampaignRunPath(opts.slug, opts.serviceId, opts.deps?.runRoot);
  const key = flightKey(opts.slug, opts.serviceId);

  type ConfirmLockResult = {
    run: LocalPageImprovementCampaignRun;
    duplicate: boolean;
    start: boolean;
    active?: Promise<LocalPageImprovementCampaignRun>;
    resolveFlight?: (run: LocalPageImprovementCampaignRun) => void;
  };
  const started = await withFileLock(file, async (): Promise<ConfirmLockResult> => {
    const existing = loadLocalPageImprovementCampaignRun(opts.slug, opts.serviceId, opts.deps);
    const active = inFlight.get(key);
    if (active) {
      return {
        run: existing || newRunFromPlan(plan, String(opts.authorisedBy || "authenticated-session"), opts.deps?.snapshotRoot),
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
      let resolveFlight = (_run: LocalPageImprovementCampaignRun) => undefined;
      const flight = new Promise<LocalPageImprovementCampaignRun>((resolve) => {
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
    let resolveFlight = (_run: LocalPageImprovementCampaignRun) => undefined;
    const flight = new Promise<LocalPageImprovementCampaignRun>((resolve) => {
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
      const latest = loadLocalPageImprovementCampaignRun(opts.slug, opts.serviceId, opts.deps);
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

export async function resumeLocalPageImprovementCampaign(opts: {
  slug: string;
  serviceId: string;
  confirmAuthorise: boolean;
  authenticatedSlug?: string;
  authorisedBy?: string;
  processInline?: boolean;
  runId?: string;
  deps?: LocalPageImprovementDeps;
}): Promise<
  | { ok: true; duplicate: boolean; plan: LocalPageImprovementCampaignPlan; run: LocalPageImprovementCampaignRun }
  | { ok: false; error: string; status: number; plan?: LocalPageImprovementCampaignPlan }
> {
  if (opts.confirmAuthorise !== true) {
    return {
      ok: false,
      status: 403,
      error: "Explicit campaign-level confirmation is required. The stopped improvement run was not resumed.",
    };
  }
  if (opts.authenticatedSlug && opts.authenticatedSlug !== opts.slug) {
    return {
      ok: false,
      status: 403,
      error: "Tenant mismatch. Local-page improvement runs are scoped to the authenticated pharmacy.",
    };
  }
  const plan = planLocalPageImprovementCampaign(opts.slug, opts.serviceId, opts.deps);
  if (plan.exceedsHardMaximum) {
    return {
      ok: false,
      status: 409,
      error: `Platform estimate ${plan.maxTotalCostLabel} exceeds the hard maximum of $${LOCAL_PAGE_IMPROVEMENT_HARD_MAX_TOTAL_USD.toFixed(3)}. The improvement run was not resumed.`,
      plan,
    };
  }
  const existing = loadLocalPageImprovementCampaignRun(opts.slug, opts.serviceId, opts.deps);
  if (!existing || existing.status !== "stopped") {
    return { ok: false, status: 409, error: "There is no stopped local-page improvement run to resume.", plan };
  }
  if (opts.runId && existing.runId !== opts.runId) {
    return { ok: false, status: 409, error: "The stopped improvement run no longer matches this confirmation.", plan };
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
  return confirmLocalPageImprovementCampaign({
    slug: opts.slug,
    serviceId: opts.serviceId,
    confirmAuthorise: true,
    authenticatedSlug: opts.authenticatedSlug,
    authorisedBy: opts.authorisedBy,
    processInline: opts.processInline,
    deps: opts.deps,
  });
}
