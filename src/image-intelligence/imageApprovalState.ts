/**
 * Image approval state persistence — output/universal-image-intelligence/image-approval-state.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ImageApprovalStatus =
  | "awaiting-upload"
  | "uploaded"
  | "quality-review"
  | "compliance-review"
  | "approved"
  | "rejected"
  | "live-ready";

export interface ImageApprovalStateRecord {
  industry: string;
  pack: string;
  imageKey: string;
  slot: string;
  uploadPath: string;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
  status: ImageApprovalStatus;
  approvalStatus: ImageApprovalStatus;
  qualityScore?: number | null;
  reviewNotes?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  testOnly?: boolean;
  dryRun?: boolean;
}

export interface ImageApprovalStateFile {
  schemaVersion: string;
  phase: string;
  updatedAt: string;
  images: Record<string, ImageApprovalStateRecord>;
}

function resolveWorkspaceRoot(): string {
  const candidates = [path.resolve(__dirname, "../.."), path.resolve(__dirname, "../../.."), process.cwd()];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output/universal-image-intelligence/image-intelligence.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const APPROVAL_STATE_PATH = path.join(
  WORKSPACE_ROOT,
  "output/universal-image-intelligence/image-approval-state.json",
);

const VALID_STATUSES = new Set<ImageApprovalStatus>([
  "awaiting-upload",
  "uploaded",
  "quality-review",
  "compliance-review",
  "approved",
  "rejected",
  "live-ready",
]);

const TRANSITIONS: Record<ImageApprovalStatus, ImageApprovalStatus[]> = {
  "awaiting-upload": ["uploaded"],
  uploaded: ["quality-review", "compliance-review", "approved", "rejected", "awaiting-upload"],
  "quality-review": ["compliance-review", "approved", "rejected", "awaiting-upload"],
  "compliance-review": ["approved", "rejected", "awaiting-upload"],
  approved: ["live-ready", "rejected", "awaiting-upload"],
  rejected: ["awaiting-upload", "uploaded"],
  "live-ready": ["awaiting-upload", "approved"],
};

export function recordKey(industry: string, pack: string, imageKey: string): string {
  return `${industry}:${pack}:${imageKey}`;
}

export function resolveIndustryUploadPath(industry: string, pack: string, imageKey: string): string {
  const root =
    industry === "pharmacy" ? "assets/pharmacy-image-library" : `assets/${industry}-image-library`;
  return `${root}/${pack}/${imageKey}.webp`;
}

function emptyState(): ImageApprovalStateFile {
  return {
    schemaVersion: "1.0",
    phase: "image-upload-approval-workflow",
    updatedAt: new Date().toISOString(),
    images: {},
  };
}

export function loadApprovalState(): ImageApprovalStateFile {
  if (!fs.existsSync(APPROVAL_STATE_PATH)) return emptyState();
  return JSON.parse(fs.readFileSync(APPROVAL_STATE_PATH, "utf8")) as ImageApprovalStateFile;
}

export function saveApprovalState(state: ImageApprovalStateFile): void {
  state.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(APPROVAL_STATE_PATH), { recursive: true });
  fs.writeFileSync(APPROVAL_STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

export function getApprovalRecord(
  industry: string,
  pack: string,
  imageKey: string,
): ImageApprovalStateRecord | undefined {
  return loadApprovalState().images[recordKey(industry, pack, imageKey)];
}

export function listApprovalRecords(industry?: string): ImageApprovalStateRecord[] {
  const records = Object.values(loadApprovalState().images);
  return industry ? records.filter((r) => r.industry === industry) : records;
}

export function canTransitionStatus(from: ImageApprovalStatus, to: ImageApprovalStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function upsertApprovalRecord(
  input: Partial<ImageApprovalStateRecord> & {
    industry: string;
    pack: string;
    imageKey: string;
    slot: string;
  },
): ImageApprovalStateRecord {
  const state = loadApprovalState();
  const key = recordKey(input.industry, input.pack, input.imageKey);
  const existing = state.images[key];
  const uploadPath = input.uploadPath ?? resolveIndustryUploadPath(input.industry, input.pack, input.imageKey);
  const status = input.status ?? existing?.status ?? "awaiting-upload";

  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid approval status: ${status}`);
  }

  const record: ImageApprovalStateRecord = {
    industry: input.industry,
    pack: input.pack,
    imageKey: input.imageKey,
    slot: input.slot,
    uploadPath,
    uploadedAt: input.uploadedAt !== undefined ? input.uploadedAt : existing?.uploadedAt ?? null,
    uploadedBy: input.uploadedBy !== undefined ? input.uploadedBy : existing?.uploadedBy ?? null,
    status,
    approvalStatus: input.approvalStatus ?? status,
    qualityScore: input.qualityScore !== undefined ? input.qualityScore : existing?.qualityScore ?? null,
    reviewNotes: input.reviewNotes !== undefined ? input.reviewNotes : existing?.reviewNotes ?? null,
    approvedAt: input.approvedAt !== undefined ? input.approvedAt : existing?.approvedAt ?? null,
    approvedBy: input.approvedBy !== undefined ? input.approvedBy : existing?.approvedBy ?? null,
    testOnly: input.testOnly ?? existing?.testOnly,
    dryRun: input.dryRun ?? existing?.dryRun,
  };

  if (status === "approved" || status === "live-ready") {
    record.approvedAt = record.approvedAt ?? new Date().toISOString();
  }

  state.images[key] = record;
  saveApprovalState(state);
  return record;
}

export function transitionApprovalStatus(
  input: {
    industry: string;
    pack: string;
    imageKey: string;
    slot: string;
    toStatus: ImageApprovalStatus;
    uploadedBy?: string;
    approvedBy?: string;
    reviewNotes?: string;
    qualityScore?: number;
    dryRun?: boolean;
    testOnly?: boolean;
  },
  opts?: { force?: boolean },
): ImageApprovalStateRecord {
  const existing = getApprovalRecord(input.industry, input.pack, input.imageKey);
  const fromStatus = existing?.status ?? "awaiting-upload";

  if (!opts?.force && !canTransitionStatus(fromStatus, input.toStatus)) {
    throw new Error(`Invalid transition: ${fromStatus} → ${input.toStatus}`);
  }

  const now = new Date().toISOString();
  return upsertApprovalRecord({
    industry: input.industry,
    pack: input.pack,
    imageKey: input.imageKey,
    slot: input.slot,
    uploadPath: existing?.uploadPath,
    status: input.toStatus,
    approvalStatus: input.toStatus,
    uploadedAt:
      input.toStatus === "uploaded" || input.toStatus === "quality-review"
        ? existing?.uploadedAt ?? now
        : existing?.uploadedAt ?? null,
    uploadedBy: input.uploadedBy ?? existing?.uploadedBy ?? null,
    approvedAt:
      input.toStatus === "approved" || input.toStatus === "live-ready"
        ? now
        : input.toStatus === "awaiting-upload"
          ? null
          : existing?.approvedAt ?? null,
    approvedBy: input.approvedBy ?? existing?.approvedBy ?? null,
    reviewNotes: input.reviewNotes ?? existing?.reviewNotes ?? null,
    qualityScore: input.qualityScore ?? existing?.qualityScore ?? null,
    dryRun: input.dryRun ?? existing?.dryRun,
    testOnly: input.testOnly ?? existing?.testOnly,
  });
}

export function removeApprovalRecord(industry: string, pack: string, imageKey: string): boolean {
  const state = loadApprovalState();
  const key = recordKey(industry, pack, imageKey);
  if (!state.images[key]) return false;
  delete state.images[key];
  saveApprovalState(state);
  return true;
}

export function applyDashboardAction(input: {
  industry: string;
  pack: string;
  imageKey: string;
  slot: string;
  action: "mark-uploaded" | "approve" | "reject" | "reset";
  actor?: string;
  reviewNotes?: string;
}): ImageApprovalStateRecord {
  switch (input.action) {
    case "mark-uploaded":
      return transitionApprovalStatus(
        {
          ...input,
          toStatus: "uploaded",
          uploadedBy: input.actor,
          reviewNotes: input.reviewNotes,
        },
        { force: getApprovalRecord(input.industry, input.pack, input.imageKey) === undefined },
      );
    case "approve":
      return transitionApprovalStatus(
        { ...input, toStatus: "approved", approvedBy: input.actor, reviewNotes: input.reviewNotes },
        { force: true },
      );
    case "reject":
      return transitionApprovalStatus(
        { ...input, toStatus: "rejected", reviewNotes: input.reviewNotes },
        { force: true },
      );
    case "reset":
      return upsertApprovalRecord({
        industry: input.industry,
        pack: input.pack,
        imageKey: input.imageKey,
        slot: input.slot,
        status: "awaiting-upload",
        approvalStatus: "awaiting-upload",
        uploadedAt: null,
        uploadedBy: null,
        approvedAt: null,
        approvedBy: null,
        reviewNotes: input.reviewNotes ?? null,
        qualityScore: null,
      });
    default:
      throw new Error(`Unknown action: ${input.action}`);
  }
}

export function fileExistsAtUploadPath(uploadPath: string): boolean {
  return fs.existsSync(path.join(WORKSPACE_ROOT, uploadPath));
}

export function isApprovedForCampaign(record?: ImageApprovalStateRecord): boolean {
  if (!record) return false;
  return record.status === "approved" || record.status === "live-ready";
}

export function isRejected(record?: ImageApprovalStateRecord): boolean {
  return record?.status === "rejected";
}

export function isPreviewOnly(record?: ImageApprovalStateRecord, uploadPath?: string): boolean {
  if (!record || isRejected(record) || isApprovedForCampaign(record)) return false;
  const pathToCheck = uploadPath ?? record.uploadPath;
  if (!fileExistsAtUploadPath(pathToCheck)) return false;
  return ["uploaded", "quality-review", "compliance-review"].includes(record.status);
}

export function resolveDisplayForRecord(
  record: ImageApprovalStateRecord | undefined,
  uploadPath: string,
  previewMode = true,
): "approved" | "preview-only" | "placeholder" | "rejected" {
  if (record && isRejected(record)) return "rejected";
  const exists = fileExistsAtUploadPath(uploadPath);
  if (record && isApprovedForCampaign(record) && exists) return "approved";
  if (previewMode && ((record && isPreviewOnly(record, uploadPath)) || (!record && exists))) {
    return "preview-only";
  }
  return "placeholder";
}

export type SlotCoverageStatus = "missing" | "uploaded" | "approved" | "fallback" | "rejected";

export function slotStatusFromRecord(
  record: ImageApprovalStateRecord | undefined,
  uploadPath: string,
): SlotCoverageStatus {
  if (record && isRejected(record)) return "rejected";
  const exists = fileExistsAtUploadPath(uploadPath);
  if (record && isApprovedForCampaign(record) && exists) return "approved";
  if (exists && record && ["uploaded", "quality-review", "compliance-review"].includes(record.status)) {
    return "uploaded";
  }
  if (exists && !record) return "uploaded";
  return "missing";
}
