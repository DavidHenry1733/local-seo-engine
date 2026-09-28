/**
 * Unified onboarding batch — automated Website + Google source import orchestration.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { recordWorkflowTransition } from "./masterAdminWorkflowHistoryService.ts";
import { listMasterAdminJobs, getMasterAdminJob, completeMasterAdminJobIdempotently } from "./masterAdminJobService.ts";
import {
  computeGoogleSourceRevision,
  computeWebsiteSourceRevision,
  isGoogleImportCompleteForRevision,
  isWebsiteImportCompleteForRevision,
  normalizeCanonicalWebsite,
  queueSourceImportJob,
} from "./masterAdminSourceJobGuardService.ts";
import {
  addOrUpdateGoogleBusinessProfile,
  confirmGoogleBusinessProfileIdentity,
  readGoogleIdentityRecord,
  readGoogleIntelligenceRecord,
} from "./masterAdminCanonicalGoogleService.ts";
import { GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD } from "./growthEngineCustomerSetupGoogleMatchService.ts";
import {
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
  type GoogleProfileOnboardingState,
} from "./masterAdminGoogleProfileOnboardingService.ts";
import { resolveCanonicalWebsiteImportWorkflowState } from "./masterAdminWebsiteImportWorkflowStateService.ts";
import type { CommercialPharmacyCreateInput } from "./masterAdminCommercialOnboardingService.ts";

const BATCH_DIR = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "onboarding-batches");

export type SourceImportState = "not_started" | "queued" | "running" | "completed" | "failed" | "skipped";
export type BatchOverallState =
  | "waiting"
  | "running"
  | "needs_confirmation"
  | "partially_complete"
  | "complete"
  | "failed";

export interface OnboardingSourceSide {
  canonicalUrl?: string;
  originalUrl?: string;
  placeId?: string;
  sourceRevision: string;
  confirmationState: "none" | "pending" | "confirmed" | "rejected";
  importState: SourceImportState;
  lastSuccessfulImport: string | null;
  jobId: string | null;
  progressLabel: string;
  error: string | null;
}

export interface OnboardingBatchRecord {
  batchId: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  overallState: BatchOverallState;
  blockingAction: string | null;
  latestEvidence: string;
  website: OnboardingSourceSide;
  google: OnboardingSourceSide;
}

export interface UnifiedIntakeInput extends CommercialPharmacyCreateInput {
  googleBusinessProfileUrl?: string;
  googlePlaceId?: string;
  postcode?: string;
  supportContactName?: string;
  supportContactEmail?: string;
}

function batchFile(slug: string): string {
  return path.join(BATCH_DIR, `${safeAdminSlug(slug)}.json`);
}

export function readOnboardingBatch(slug: string): OnboardingBatchRecord | null {
  const file = batchFile(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as OnboardingBatchRecord;
  } catch {
    return null;
  }
}

function writeOnboardingBatch(record: OnboardingBatchRecord): OnboardingBatchRecord {
  fs.mkdirSync(BATCH_DIR, { recursive: true });
  const next = { ...record, updatedAt: new Date().toISOString() };
  fs.writeFileSync(batchFile(record.slug), JSON.stringify(next, null, 2));
  return next;
}

function emptySide(): OnboardingSourceSide {
  return {
    sourceRevision: "",
    confirmationState: "none",
    importState: "not_started",
    lastSuccessfulImport: null,
    jobId: null,
    progressLabel: "Not started",
    error: null,
  };
}

export function buildOnboardingSourcesSummary(slug: string): {
  batch: OnboardingBatchRecord | null;
  website: OnboardingSourceSide;
  google: OnboardingSourceSide;
  overallState: BatchOverallState;
  blockingAction: string | null;
  latestEvidence: string;
} {
  refreshOnboardingBatchStatus(slug);
  const batch = readOnboardingBatch(slug);
  if (batch) {
    return {
      batch,
      website: batch.website,
      google: batch.google,
      overallState: batch.overallState,
      blockingAction: batch.blockingAction,
      latestEvidence: batch.latestEvidence,
    };
  }

  const data = readSetupProfile(slug);
  const identity = readGoogleIdentityRecord(slug);
  const websiteUrl = normalizeCanonicalWebsite(String(data.website || ""));
  const websiteRevision = websiteUrl ? computeWebsiteSourceRevision(websiteUrl) : "";
  const googleRevision = computeGoogleSourceRevision(
    String(identity?.placeId || data.googlePlaceId || ""),
    String(identity?.originalUrl || data.googleBusinessProfileUrl || ""),
  );

  const webCanon = resolveCanonicalWebsiteImportWorkflowState(slug);
  return {
    batch: null,
    website: {
      ...emptySide(),
      canonicalUrl: websiteUrl,
      sourceRevision: websiteRevision,
      confirmationState: websiteUrl ? "confirmed" : "none",
      importState: webCanon.importState,
      lastSuccessfulImport: webCanon.stageComplete
        ? (data.websiteImportSnapshot as { importedAt?: string } | null)?.importedAt || null
        : null,
      progressLabel: webCanon.progressLabel,
      error: webCanon.stageComplete ? null : webCanon.latestEvidence,
    },
    google: {
      ...emptySide(),
      originalUrl: identity?.originalUrl || data.googleBusinessProfileUrl || "",
      placeId: identity?.placeId || data.googlePlaceId || "",
      sourceRevision: googleRevision,
      confirmationState: identity?.confirmationStatus || "none",
      importState: isGoogleImportCompleteForRevision(slug, googleRevision, identity?.placeId || data.googlePlaceId || "")
        ? "completed"
        : "not_started",
      lastSuccessfulImport: readGoogleIntelligenceRecord(slug)?.importedAt || null,
      progressLabel: readGoogleIntelligenceRecord(slug) ? "Completed" : "Not started",
    },
    overallState: "waiting",
    blockingAction: null,
    latestEvidence: "",
  };
}

function deriveOverallState(batch: OnboardingBatchRecord): BatchOverallState {
  if (batch.google.confirmationState === "pending") return "needs_confirmation";
  const web = batch.website.importState;
  const goog = batch.google.importState;
  if (web === "failed") {
    if (goog === "completed" || goog === "skipped") return "partially_complete";
    return "failed";
  }
  if (web === "completed" && (goog === "completed" || goog === "skipped")) return "complete";
  const states = [web, goog];
  if (states.every((s) => s === "completed" || s === "skipped")) return "complete";
  if (states.some((s) => s === "failed")) {
    if (states.some((s) => s === "completed" || s === "skipped")) return "partially_complete";
    return "failed";
  }
  if (states.some((s) => s === "running" || s === "queued")) return "running";
  return "waiting";
}

export function refreshOnboardingBatchStatus(slug: string): OnboardingBatchRecord | null {
  const safe = safeAdminSlug(slug);
  let batch = readOnboardingBatch(safe);
  if (!batch) return null;

  const jobs = listMasterAdminJobs({ slug: safe, limit: 20 });
  const data = readSetupProfile(safe);

  const syncSide = (side: OnboardingSourceSide, action: string): OnboardingSourceSide => {
    const job = side.jobId ? getMasterAdminJob(side.jobId) : jobs.find((j) => j.action === action && (j.status === "queued" || j.status === "running"));
    let importState = side.importState;
    let progressLabel = side.progressLabel;
    let error = side.error;
    let lastSuccessfulImport = side.lastSuccessfulImport;

    if (action === "import_website" && isWebsiteImportCompleteForRevision(safe, side.sourceRevision)) {
      importState = "completed";
      progressLabel = "Completed";
      lastSuccessfulImport = (data.websiteImportSnapshot as { importedAt?: string } | null)?.importedAt || lastSuccessfulImport;
    } else if (action === "import_google" && isGoogleImportCompleteForRevision(safe, side.sourceRevision, side.placeId || "")) {
      importState = "completed";
      progressLabel = "Completed";
      lastSuccessfulImport = readGoogleIntelligenceRecord(safe)?.importedAt || lastSuccessfulImport;
    } else if (job) {
      if (job.status === "queued") {
        importState = "queued";
        progressLabel = job.progressLabel || "Queued";
      } else if (job.status === "running") {
        importState = "running";
        progressLabel = job.progressLabel || "Running";
      } else if (job.status === "completed") {
        if (action === "import_website") {
          const canon = resolveCanonicalWebsiteImportWorkflowState(safe);
          importState = canon.importState;
          progressLabel = canon.progressLabel;
          error = canon.stageComplete ? null : canon.latestEvidence;
          if (canon.stageComplete) {
            lastSuccessfulImport = job.completedAt || lastSuccessfulImport;
          }
        } else if (action === "import_google" && isGoogleImportCompleteForRevision(safe, side.sourceRevision, side.placeId || "")) {
          importState = "completed";
          progressLabel = "Completed";
          lastSuccessfulImport = job.completedAt || lastSuccessfulImport;
        } else {
          importState = "failed";
          progressLabel = "Failed";
          error = job.error || "Import failed";
        }
      } else if (job.status === "failed") {
        importState = "failed";
        progressLabel = "Failed";
        error = job.error || "Import failed";
      }
    }

    return { ...side, importState, progressLabel, error, lastSuccessfulImport, jobId: job?.id || side.jobId };
  };

  batch = {
    ...batch,
    website: syncSide(batch.website, "import_website"),
    google: syncSide(batch.google, "import_google"),
  };

  const webCanon = resolveCanonicalWebsiteImportWorkflowState(safe);
  batch.website = {
    ...batch.website,
    importState: webCanon.importState,
    progressLabel: webCanon.progressLabel,
    error: webCanon.stageComplete ? null : webCanon.latestEvidence,
  };

  batch.overallState = deriveOverallState(batch);
  batch.blockingAction =
    batch.google.confirmationState === "pending"
      ? "Confirm Google Business Profile"
      : batch.overallState === "partially_complete"
        ? "Retry failed source"
        : batch.overallState === "running"
          ? "Automated source import in progress"
          : null;
  batch.latestEvidence = webCanon.stageComplete
    ? [batch.website.progressLabel, batch.google.progressLabel].filter(Boolean).join(" · ")
    : webCanon.latestEvidence;
  return writeOnboardingBatch(batch);
}

export async function validateUnifiedIntakeSources(input: UnifiedIntakeInput): Promise<{
  websiteUrl: string;
  googleUrl: string;
  googlePlaceId: string;
  autoConfirmGoogle: boolean;
  googlePreview: { businessName: string; placeId: string; confidence: number } | null;
}> {
  const websiteUrl = normalizeCanonicalWebsite(input.website);
  if (!websiteUrl || !websiteUrl.includes(".")) throw new Error("Enter a valid canonical branch website URL");

  let googleUrl = String(input.googleBusinessProfileUrl || input.googlePlaceId || "").trim();
  let googlePlaceId = String(input.googlePlaceId || "").trim();
  let autoConfirmGoogle = false;
  let googlePreview: { businessName: string; placeId: string; confidence: number } | null = null;

  if (googleUrl || googlePlaceId) {
    if (/^ChI[a-zA-Z0-9_-]+$/.test(googleUrl)) {
      googlePlaceId = googleUrl;
      googleUrl = googlePlaceId;
    }
  }

  return { websiteUrl, googleUrl, googlePlaceId, autoConfirmGoogle, googlePreview };
}

export function createOnboardingBatch(
  slug: string,
  intake: UnifiedIntakeInput,
  operator: string,
): OnboardingBatchRecord {
  const safe = safeAdminSlug(slug);
  const websiteUrl = normalizeCanonicalWebsite(intake.website);
  const websiteRevision = computeWebsiteSourceRevision(websiteUrl);
  const googleUrl = String(intake.googleBusinessProfileUrl || intake.googlePlaceId || "").trim();
  const googlePlaceId = String(intake.googlePlaceId || "").trim();
  const googleRevision = computeGoogleSourceRevision(googlePlaceId, googleUrl);

  const batch: OnboardingBatchRecord = {
    batchId: randomUUID(),
    slug: safe,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    overallState: "waiting",
    blockingAction: null,
    latestEvidence: "Onboarding batch created",
    website: {
      ...emptySide(),
      canonicalUrl: websiteUrl,
      sourceRevision: websiteRevision,
      confirmationState: "confirmed",
      importState: isWebsiteImportCompleteForRevision(safe, websiteRevision) ? "completed" : "not_started",
      progressLabel: isWebsiteImportCompleteForRevision(safe, websiteRevision) ? "Completed" : "Waiting",
    },
    google: {
      ...emptySide(),
      originalUrl: googleUrl,
      placeId: googlePlaceId,
      sourceRevision: googleRevision,
      confirmationState: googleUrl || googlePlaceId ? "none" : "none",
      importState: googleRevision && isGoogleImportCompleteForRevision(safe, googleRevision, googlePlaceId) ? "completed" : "not_started",
      progressLabel: "Waiting",
    },
  };

  writeOnboardingBatch(batch);
  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "create_onboarding_batch",
    status: "success",
    evidence: `Onboarding batch ${batch.batchId} created`,
  });
  return batch;
}

export async function prepareGoogleSourceForBatch(
  slug: string,
  intake: UnifiedIntakeInput,
  operator: string,
): Promise<{ autoConfirmed: boolean; needsConfirmation: boolean }> {
  const googleInput = String(intake.googleBusinessProfileUrl || intake.googlePlaceId || "").trim();
  if (!googleInput) return { autoConfirmed: false, needsConfirmation: false };

  const { identity, preview } = await addOrUpdateGoogleBusinessProfile(slug, googleInput, operator, {
    invalidateImport: false,
  });

  const batch = readOnboardingBatch(slug);
  if (batch) {
    batch.google.originalUrl = identity.originalUrl;
    batch.google.placeId = identity.placeId;
    batch.google.sourceRevision = computeGoogleSourceRevision(identity.placeId, identity.originalUrl);
    batch.google.confirmationState = identity.confirmationStatus;
    writeOnboardingBatch(batch);
  }

  const data = readSetupProfile(slug);
  const hintsMatch =
    preview.confidence >= GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD ||
    Boolean(intake.googlePlaceId) ||
    (intake.postcode && preview.postcode && preview.postcode.replace(/\s/g, "") === String(intake.postcode).replace(/\s/g, "").toUpperCase()) ||
    (intake.phone && preview.phone && preview.phone.replace(/\D/g, "").includes(String(intake.phone).replace(/\D/g, "").slice(-7)));

  if (hintsMatch) {
    confirmGoogleBusinessProfileIdentity(slug, operator);
    if (batch) {
      batch.google.confirmationState = "confirmed";
      writeOnboardingBatch(batch);
    }
    return { autoConfirmed: true, needsConfirmation: false };
  }

  if (batch) {
    batch.google.confirmationState = "pending";
    batch.overallState = "needs_confirmation";
    batch.blockingAction = "Confirm Google Business Profile";
    writeOnboardingBatch(batch);
  }

  return { autoConfirmed: false, needsConfirmation: true };
}

export function startOnboardingBatchImports(slug: string, operator: string): {
  website: ReturnType<typeof queueSourceImportJob>;
  google: ReturnType<typeof queueSourceImportJob> | null;
} {
  const safe = safeAdminSlug(slug);
  refreshOnboardingBatchStatus(safe);
  let batch = readOnboardingBatch(safe);
  if (!batch) throw new Error("Onboarding batch not found");

  const data = readSetupProfile(safe);
  const identity = readGoogleIdentityRecord(safe);

  let websiteResult = { job: null, skipped: true, reason: "No website URL", idempotencyKey: "" } as ReturnType<
    typeof queueSourceImportJob
  >;
  if (batch.website.canonicalUrl && batch.website.confirmationState === "confirmed") {
    websiteResult = queueSourceImportJob({
      slug: safe,
      action: "import_website",
      user: operator,
      workflowStage: "website_import",
      sourceRevision: batch.website.sourceRevision,
      body: { websiteUrl: batch.website.canonicalUrl },
    });
    batch.website.jobId = websiteResult.job?.id || batch.website.jobId;
    batch.website.importState = websiteResult.skipped ? "skipped" : websiteResult.job ? "queued" : batch.website.importState;
    if (websiteResult.skipped) batch.website.importState = "completed";
    batch.website.progressLabel = websiteResult.reason;
  }

  let googleResult: ReturnType<typeof queueSourceImportJob> | null = null;
  const googleState = resolveGoogleProfileOnboardingState(data);
  if (!shouldRunGoogleImport(googleState)) {
    batch.google.importState = "skipped";
    batch.google.progressLabel =
      googleState === "no_profile" ? "Skipped — no Google profile" : "Skipped — deferred";
    if (googleState === "no_profile") batch.google.confirmationState = "confirmed";
  } else if (batch.google.confirmationState === "confirmed" && (batch.google.placeId || identity?.placeId || data.googlePlaceId)) {
    googleResult = queueSourceImportJob({
      slug: safe,
      action: "import_google",
      user: operator,
      workflowStage: "google_import",
      sourceRevision: batch.google.sourceRevision,
      body: {
        googleBusinessUrl: batch.google.originalUrl || identity?.resolvedUrl || data.googleBusinessProfileUrl || "",
        placeId: batch.google.placeId || identity?.placeId || data.googlePlaceId || "",
        pharmacyName: data.pharmacyName || "",
        town: data.primaryTown || "",
        postcode: data.postcode || intakePostcode(data),
      },
    });
    batch.google.jobId = googleResult.job?.id || batch.google.jobId;
    batch.google.importState = googleResult.skipped ? "completed" : googleResult.job ? "queued" : batch.google.importState;
    batch.google.progressLabel = googleResult.reason;
  }

  batch.overallState = deriveOverallState(batch);
  writeOnboardingBatch(batch);

  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "start_onboarding_batch",
    status: "success",
    evidence: `Website: ${websiteResult.reason}; Google: ${googleResult?.reason || "not queued"}`,
  });

  return { website: websiteResult, google: googleResult };
}

function intakePostcode(data: ReturnType<typeof readSetupProfile>): string {
  return data.postcode || "";
}

export async function resumeOnboardingBatchAfterGoogleConfirm(slug: string, operator: string): Promise<void> {
  const batch = readOnboardingBatch(slug);
  if (!batch) return;
  batch.google.confirmationState = "confirmed";
  writeOnboardingBatch(batch);
  startOnboardingBatchImports(slug, operator);
}

export function retryFailedOnboardingSource(slug: string, source: "website" | "google", operator: string): void {
  const batch = readOnboardingBatch(slug);
  if (!batch) throw new Error("Onboarding batch not found");
  if (source === "website") {
    batch.website.importState = "not_started";
    batch.website.error = null;
  } else {
    batch.google.importState = "not_started";
    batch.google.error = null;
  }
  writeOnboardingBatch(batch);
  startOnboardingBatchImports(slug, operator);
  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "retry_onboarding_source",
    status: "success",
    evidence: `Retry ${source} import`,
  });
}

export function reconcileExistingTenantOnboardingBatch(slug: string, operator: string): OnboardingBatchRecord {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const identity = readGoogleIdentityRecord(safe);
  const websiteUrl = normalizeCanonicalWebsite(String(data.website || ""));
  const websiteRevision = computeWebsiteSourceRevision(websiteUrl);
  const googleRevision = computeGoogleSourceRevision(
    String(identity?.placeId || data.googlePlaceId || ""),
    String(identity?.originalUrl || data.googleBusinessProfileUrl || ""),
  );

  const websiteComplete = isWebsiteImportCompleteForRevision(safe, websiteRevision);
  const googleComplete = isGoogleImportCompleteForRevision(
    safe,
    googleRevision,
    String(identity?.placeId || data.googlePlaceId || ""),
  );

  const queuedGoogle = listMasterAdminJobs({ slug: safe, limit: 10 }).find(
    (j) => j.action === "import_google" && j.status === "queued",
  );
  if (queuedGoogle && googleComplete) {
    completeMasterAdminJobIdempotently(
      queuedGoogle.id,
      "Google Intelligence already populated for confirmed Place ID — completed idempotently",
      { ok: true, idempotent: true, placeId: identity?.placeId || data.googlePlaceId },
    );
  }

  const batch: OnboardingBatchRecord = {
    batchId: readOnboardingBatch(safe)?.batchId || randomUUID(),
    slug: safe,
    createdAt: readOnboardingBatch(safe)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    overallState: websiteComplete && googleComplete ? "complete" : "partially_complete",
    blockingAction: null,
    latestEvidence: "Reconciled from existing tenant evidence",
    website: {
      ...emptySide(),
      canonicalUrl: websiteUrl,
      sourceRevision: websiteRevision,
      confirmationState: "confirmed",
      importState: websiteComplete ? "completed" : "failed",
      lastSuccessfulImport: (data.websiteImportSnapshot as { importedAt?: string } | null)?.importedAt || null,
      progressLabel: websiteComplete ? "Completed" : "Incomplete",
    },
    google: {
      ...emptySide(),
      originalUrl: identity?.originalUrl || data.googleBusinessProfileUrl || "",
      placeId: identity?.placeId || data.googlePlaceId || "",
      sourceRevision: googleRevision,
      confirmationState: identity?.confirmationStatus === "confirmed" ? "confirmed" : "none",
      importState: googleComplete ? "completed" : queuedGoogle ? "queued" : "not_started",
      lastSuccessfulImport: readGoogleIntelligenceRecord(safe)?.importedAt || null,
      jobId: queuedGoogle?.id || null,
      progressLabel: googleComplete ? "Completed" : queuedGoogle ? "Queued (idempotent check applied)" : "Not started",
    },
  };

  batch.overallState = deriveOverallState(batch);
  writeOnboardingBatch(batch);

  if (websiteComplete && googleComplete) {
    recordWorkflowTransition({
      slug: safe,
      fromStage: "google_import",
      toStage: "business_profile_intelligence",
      operator,
      reason: "Source import batch complete — reconciled",
      evidence: batch.latestEvidence,
    });
  }

  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "reconcile_onboarding_batch",
    status: "success",
    evidence: `Batch ${batch.overallState} — website ${batch.website.importState}, google ${batch.google.importState}`,
  });

  return batch;
}

export function previewFutureCustomerIntake(input: UnifiedIntakeInput): {
  wouldQueueWebsite: boolean;
  wouldQueueGoogle: boolean;
  websiteRevision: string;
  googleRevision: string;
} {
  const websiteUrl = normalizeCanonicalWebsite(input.website);
  const googleUrl = String(input.googleBusinessProfileUrl || input.googlePlaceId || "").trim();
  const googlePlaceId = String(input.googlePlaceId || "").trim();
  return {
    wouldQueueWebsite: Boolean(websiteUrl),
    wouldQueueGoogle: Boolean(googleUrl || googlePlaceId),
    websiteRevision: computeWebsiteSourceRevision(websiteUrl),
    googleRevision: computeGoogleSourceRevision(googlePlaceId, googleUrl),
  };
}

export function persistUnifiedIntakeFields(slug: string, input: UnifiedIntakeInput): void {
  const data = readSetupProfile(slug);
  writeSetupProfile(slug, {
    ...data,
    website: normalizeCanonicalWebsite(input.website),
    postcode: String(input.postcode || data.postcode || "").trim().toUpperCase() || data.postcode,
    phone: String(input.phone || data.phone || "").trim() || data.phone,
    adminNotes: [data.adminNotes, input.notes].filter(Boolean).join("\n"),
  } as typeof data);
}

export function syncOnboardingBatchGooglePolicy(slug: string, state: GoogleProfileOnboardingState): void {
  let batch = readOnboardingBatch(slug);
  if (!batch || shouldRunGoogleImport(state)) return;
  batch = {
    ...batch,
    google: {
      ...batch.google,
      importState: "skipped",
      progressLabel: state === "no_profile" ? "Skipped — no Google profile" : "Skipped — deferred",
      confirmationState: state === "no_profile" ? "confirmed" : batch.google.confirmationState,
    },
  };
  batch.overallState = deriveOverallState(batch);
  batch.latestEvidence = `${batch.website.progressLabel} · ${batch.google.progressLabel}`;
  writeOnboardingBatch(batch);
}
