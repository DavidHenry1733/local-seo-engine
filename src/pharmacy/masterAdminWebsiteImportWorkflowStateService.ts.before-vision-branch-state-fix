/**
 * Canonical Website Import workflow state — single source for stage completion,
 * batch importState, progress labels, evidence, and blocking issues.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  websiteImportStageComplete,
  readWebsiteBranchResolution,
  isBranchSelectionBlocking,
} from "./masterAdminWebsiteBranchSelectionService.ts";
import type { SourceImportState } from "./masterAdminOnboardingBatchService.ts";
import { isNationalMarketScope } from "./masterAdminMarketScopeService.ts";
import {
  isStaleBranchSelectionEvidenceMessage,
  resolveWebsiteIntelligenceReimportState,
} from "./masterAdminWebsiteIntelligenceReimportState.ts";

function canonicalWebsiteImportEvidenceMessage(slug: string, snapshotMessage: string): string {
  const resolution = readWebsiteBranchResolution(slug);
  if (resolution?.status === "branch_selected" && resolution.selectedBranch) {
    const b = resolution.selectedBranch;
    const parts = [b.branchName, b.addressLine1, b.town, b.postcode].filter(Boolean);
    return `Branch confirmed: ${parts.join(", ")}`;
  }
  return snapshotMessage;
}

export interface CanonicalWebsiteImportWorkflowState {
  stageComplete: boolean;
  importState: SourceImportState;
  progressLabel: string;
  latestEvidence: string;
  blockingIssues: string[];
  snapshotStatus: string | null;
}

function websiteImportEvidenceMessage(slug: string): string {
  const data = readSetupProfile(slug);
  const snap = data.websiteImportSnapshot as { message?: string; status?: string } | undefined;
  const fromSnap = String(snap?.message || "").trim();
  if (websiteImportStageComplete(slug)) {
    return canonicalWebsiteImportEvidenceMessage(slug, fromSnap || "Website intelligence imported.");
  }
  if (fromSnap) return fromSnap;
  const debug = data.lastWebsiteImportDebug;
  if (debug && typeof debug === "object" && debug !== null && "message" in debug) {
    return String((debug as { message?: string }).message || "").trim();
  }
  if (typeof debug === "string") return debug.trim();
  return "";
}

export function resolveCanonicalWebsiteImportWorkflowState(slug: string): CanonicalWebsiteImportWorkflowState {
  const data = readSetupProfile(slug);
  const snap = data.websiteImportSnapshot as { message?: string; status?: string; importedAt?: string } | undefined;
  const stageComplete = websiteImportStageComplete(slug);
  const evidence = websiteImportEvidenceMessage(slug);
  const snapshotStatus = snap?.status ? String(snap.status) : null;

  let importState: SourceImportState = "not_started";
  if (!snap?.importedAt && !snap) {
    importState = "not_started";
  } else if (stageComplete) {
    importState = "completed";
  } else {
    importState = "failed";
  }

  const progressLabel = stageComplete ? "Completed" : snap?.importedAt ? "Incomplete" : "Not started";
  const latestEvidence = stageComplete
    ? evidence || "Website intelligence imported."
    : evidence || "Website import incomplete.";

  const blockingIssues = stageComplete
    ? []
    : [latestEvidence.startsWith("Website import") ? latestEvidence : `Website import incomplete. ${latestEvidence}`];

  return {
    stageComplete,
    importState,
    progressLabel,
    latestEvidence,
    blockingIssues,
    snapshotStatus,
  };
}

/** Operational summary evidence when onboarding batch and workflow history disagree. */
export function resolveCanonicalOnboardingOperationalSummary(slug: string): {
  latestEvidence: string;
  blockingIssues: string[];
} {
  const web = resolveCanonicalWebsiteImportWorkflowState(slug);
  if (!web.stageComplete && web.blockingIssues.length) {
    return { latestEvidence: web.latestEvidence, blockingIssues: web.blockingIssues };
  }
  return { latestEvidence: web.latestEvidence, blockingIssues: [] };
}

export function mergeCustomerOperationalSummary(input: {
  slug: string;
  fallbackLatestEvidence: string | null;
  fallbackBlockingIssues: string[];
  customerReady: boolean;
  welcomeDraftAvailable: boolean;
  jobs: unknown[];
}): {
  latestEvidence: string | null;
  blockingIssues: string[];
  customerReady: boolean;
  welcomeDraftAvailable: boolean;
  jobs: unknown[];
} {
  const data = readSetupProfile(input.slug);
  const canon = resolveCanonicalOnboardingOperationalSummary(input.slug);
  const websiteBlocksWorkflow = canon.blockingIssues.length > 0;
  const national = isNationalMarketScope(input.slug, data);
  const branchSelectionActive = isBranchSelectionBlocking(input.slug);
  const fallback = String(input.fallbackLatestEvidence || "").trim();
  const staleBranchFallback =
    isStaleBranchSelectionEvidenceMessage(fallback) && (national || !branchSelectionActive);

  const reimport = resolveWebsiteIntelligenceReimportState(input.slug);

  let latestEvidence = websiteBlocksWorkflow
    ? canon.latestEvidence
    : staleBranchFallback
      ? canon.latestEvidence || null
      : input.fallbackLatestEvidence || canon.latestEvidence || null;

  // Prefer current re-import requirement over historical branch-selection execution evidence.
  if (reimport.required && !branchSelectionActive) {
    latestEvidence = reimport.summary;
  } else if (latestEvidence && isStaleBranchSelectionEvidenceMessage(latestEvidence) && (national || !branchSelectionActive)) {
    latestEvidence = canon.latestEvidence || "Website intelligence imported.";
  }

  const blockingIssues = websiteBlocksWorkflow
    ? [...canon.blockingIssues, ...input.fallbackBlockingIssues.filter((b) => !canon.blockingIssues.includes(b))]
    : input.fallbackBlockingIssues;
  return {
    latestEvidence,
    blockingIssues,
    customerReady: input.customerReady,
    welcomeDraftAvailable: input.welcomeDraftAvailable,
    jobs: input.jobs,
  };
}
