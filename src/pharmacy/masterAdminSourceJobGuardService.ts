/**
 * Source import idempotency — one active job per tenant + action + source revision.
 */
import { createHash } from "node:crypto";
import {
  completeMasterAdminJobIdempotently,
  createMasterAdminJob,
  getMasterAdminJob,
  listMasterAdminJobs,
  runMasterAdminJobAsync,
  type MasterAdminJob,
} from "./masterAdminJobService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { websiteImportStageComplete } from "./masterAdminWebsiteBranchSelectionService.ts";
import { readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";

export function normalizeCanonicalWebsite(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  return withProto.replace(/\/$/, "");
}

export function computeWebsiteSourceRevision(url: string): string {
  return createHash("sha256").update(normalizeCanonicalWebsite(url)).digest("hex").slice(0, 16);
}

export function computeGoogleSourceRevision(placeId: string, url: string): string {
  const key = String(placeId || url || "").trim();
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function buildSourceIdempotencyKey(slug: string, action: string, revision: string): string {
  return `${safeAdminSlug(slug)}:${action}:${revision}`;
}

export function isWebsiteImportCompleteForRevision(slug: string, revision: string): boolean {
  const data = readSetupProfile(slug);
  const snap = data.websiteImportSnapshot;
  if (!snap?.importedAt) return false;
  const url = normalizeCanonicalWebsite(String(snap.websiteUrl || data.website || ""));
  if (!url) return false;
  return computeWebsiteSourceRevision(url) === revision && websiteImportStageComplete(slug);
}

export function isGoogleImportCompleteForRevision(slug: string, revision: string, placeId: string): boolean {
  const data = readSetupProfile(slug);
  const snap = data.googleImportSnapshot;
  const resolvedPlaceId = String(placeId || data.googlePlaceId || snap?.placeId || "");
  if (snap?.status === "imported" && snap.importedAt) {
    const snapRevision = computeGoogleSourceRevision(String(snap.placeId || ""), String(snap.googleBusinessUrl || ""));
    if (snapRevision === revision) return true;
    if (resolvedPlaceId && String(snap.placeId) === resolvedPlaceId) return true;
  }
  const intel = readGoogleIntelligenceRecord(slug);
  if (intel?.importedAt && resolvedPlaceId && intel.placeId === resolvedPlaceId) {
    return computeGoogleSourceRevision(intel.placeId, intel.googleBusinessProfileUrl || "") === revision || true;
  }
  return false;
}

export function findJobByIdempotencyKey(key: string): MasterAdminJob | null {
  return (
    listMasterAdminJobs({ limit: 100 }).find(
      (j) => (j as MasterAdminJob & { idempotencyKey?: string }).idempotencyKey === key,
    ) || null
  );
}

export function findActiveJobByIdempotencyKey(key: string): MasterAdminJob | null {
  const job = findJobByIdempotencyKey(key);
  if (!job) return null;
  if (job.status === "queued" || job.status === "running") return job;
  return null;
}

export interface QueueSourceImportResult {
  job: MasterAdminJob | null;
  skipped: boolean;
  reason: string;
  idempotencyKey: string;
}

export function queueSourceImportJob(input: {
  slug: string;
  action: "import_website" | "import_google";
  user: string;
  workflowStage: string;
  sourceRevision: string;
  body?: Record<string, unknown>;
}): QueueSourceImportResult {
  const safe = safeAdminSlug(input.slug);
  const idempotencyKey = buildSourceIdempotencyKey(safe, input.action, input.sourceRevision);

  if (input.action === "import_website" && isWebsiteImportCompleteForRevision(safe, input.sourceRevision)) {
    return { job: null, skipped: true, reason: "Website import already complete for canonical URL", idempotencyKey };
  }

  if (input.action === "import_google") {
    const placeId = String(input.body?.placeId || readSetupProfile(safe).googlePlaceId || "");
    if (isGoogleImportCompleteForRevision(safe, input.sourceRevision, placeId)) {
      return { job: null, skipped: true, reason: "Google import already complete for Place ID", idempotencyKey };
    }
  }

  const active = findActiveJobByIdempotencyKey(idempotencyKey);
  if (active) {
    return { job: active, skipped: false, reason: "Existing active job for this source revision", idempotencyKey };
  }

  const job = createMasterAdminJob({
    slug: safe,
    action: input.action,
    user: input.user,
    workflowStage: input.workflowStage,
    idempotencyKey,
    sourceRevision: input.sourceRevision,
  });

  runMasterAdminJobAsync(job.id, input.body || {}, { workflowStage: input.workflowStage });
  return { job: getMasterAdminJob(job.id), skipped: false, reason: "Queued", idempotencyKey };
}

export { completeMasterAdminJobIdempotently };
