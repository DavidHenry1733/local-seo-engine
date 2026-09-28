/**
 * Canonical Website Import workflow state — single source for stage completion,
 * batch importState, progress labels, evidence, and blocking issues.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import {
  websiteImportStageComplete,
  readWebsiteBranchResolution,
  isBranchSelectionBlocking,
  isCanonicalWebsiteImportComplete,
  isCanonicalWebsiteImportFailed,
  projectCanonicalBranchResolution,
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

export type WebsiteImportContractState = "not_started" | "imported" | "partial" | "failed";

export interface WebsiteImportContract {
  state: WebsiteImportContractState;
  websiteStatus: "NOT CONFIGURED" | "IMPORTED" | "PARTIAL" | "FAILED";
  /** True only for a completed import. A stored snapshot is not success. */
  websiteImported: boolean;
  downstreamReady: boolean;
}

function snapshotRecord(data: { websiteImportSnapshot?: unknown }): Record<string, unknown> | null {
  const snap = data.websiteImportSnapshot as Record<string, unknown> | null | undefined;
  if (!snap || typeof snap !== "object") return null;
  return snap;
}

function snapshotHasUsableEvidence(snap: Record<string, unknown>, resolutionStatus: string): boolean {
  const status = String(snap.status || "");
  if (status === "needs_review" || status === "branch_selection_required") return true;
  if (resolutionStatus === "branch_selection_required" || resolutionStatus === "none_of_these_branches") return true;
  if (snap.intelligence) return true;
  if (Array.isArray(snap.servicesDetected) && snap.servicesDetected.length > 0) return true;
  const text = [snap.phone, snap.email, snap.address, snap.description].map((v) => String(v || "").trim()).join("");
  return Boolean(text);
}

/**
 * Read-only import contract. Does not reconcile or write the profile.
 * Success matches the existing stage-completion rules. Anything else that
 * merely stored a snapshot is partial or failed, never imported.
 */
export function classifyWebsiteImportContract(
  slug: string,
  data: { websiteImportSnapshot?: unknown; websiteBranchResolution?: { status?: string } | null },
): WebsiteImportContract {
  const snap = snapshotRecord(data);
  if (!snap) {
    return { state: "not_started", websiteStatus: "NOT CONFIGURED", websiteImported: false, downstreamReady: false };
  }
  const projected = data.websiteBranchResolution
    ? projectCanonicalBranchResolution(data.websiteBranchResolution as never)
    : null;
  const resolutionStatus = projected?.status || String(data.websiteBranchResolution?.status || "");
  if (isCanonicalWebsiteImportFailed(data as never)) {
    return { state: "failed", websiteStatus: "FAILED", websiteImported: false, downstreamReady: false };
  }
  if (isCanonicalWebsiteImportComplete(slug, data as never)) {
    return { state: "imported", websiteStatus: "IMPORTED", websiteImported: true, downstreamReady: true };
  }
  if (snapshotHasUsableEvidence(snap, resolutionStatus)) {
    return { state: "partial", websiteStatus: "PARTIAL", websiteImported: false, downstreamReady: false };
  }
  return { state: "failed", websiteStatus: "FAILED", websiteImported: false, downstreamReady: false };
}

export function websiteImportSucceeded(
  slug: string,
  data?: { websiteImportSnapshot?: unknown; websiteBranchResolution?: { status?: string } | null },
): boolean {
  const profile = data || readSetupProfile(slug);
  return classifyWebsiteImportContract(slug, profile).state === "imported";
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

  const branchSelectionRequired = isBranchSelectionBlocking(slug);

  let importState: SourceImportState = "not_started";
  if (!snap?.importedAt && !snap) {
    importState = "not_started";
  } else if (stageComplete) {
    importState = "completed";
  } else if (branchSelectionRequired) {
    importState = "branch_selection_required";
  } else {
    importState = "failed";
  }

  const contract = classifyWebsiteImportContract(slug, readSetupProfile(slug));
  const progressLabel = contract.state === "imported"
    ? "Completed"
    : branchSelectionRequired
      ? "Branch selection required"
      : contract.state === "partial"
        ? "Partial"
        : contract.state === "failed"
          ? "Failed"
          : "Not started";

  const latestEvidence = stageComplete
    ? evidence || "Website intelligence imported."
    : evidence || "Website import incomplete.";

  const blockingIssues = stageComplete
    ? []
    : branchSelectionRequired
      ? [latestEvidence]
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
