/**
 * Operator approval workflow (file-backed queue).
 */
import fs from "node:fs";
import path from "node:path";
import {
  approvalQueueAbs,
  roleBucketAbs,
  type ImagePlatformRole,
} from "./pharmacyImagePlatformPaths.ts";
import {
  readAssetMetadata,
  writeAssetMetadata,
  computeAssetRevision,
} from "./pharmacyImagePlatformManifestService.ts";
import type { ImagePlatformAssetMetadata, ImagePlatformContentClass } from "./pharmacyImagePlatformTypes.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export interface ApprovalQueueEntry {
  serviceId: string;
  role: ImagePlatformRole;
  assetId: string;
  submittedAt: string;
  submittedBy?: string;
}

export interface ApprovalQueueDoc {
  schemaVersion: "1.0";
  updatedAt: string;
  pending: ApprovalQueueEntry[];
}

function loadQueue(): ApprovalQueueDoc {
  const p = approvalQueueAbs();
  if (!fs.existsSync(p)) {
    return { schemaVersion: "1.0", updatedAt: new Date().toISOString(), pending: [] };
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as ApprovalQueueDoc;
}

function saveQueue(doc: ApprovalQueueDoc): void {
  fs.mkdirSync(path.dirname(approvalQueueAbs()), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(approvalQueueAbs(), JSON.stringify(doc, null, 2));
}

function moveBinaryToBucket(meta: ImagePlatformAssetMetadata, bucket: string): ImagePlatformAssetMetadata {
  const rel = meta.relativePath.replace(/^\/+/, "");
  const filename = path.basename(rel);
  const destRel = `assets/pharmacy-image-platform/services/${meta.serviceId}/roles/${meta.role}/${bucket}/${filename}`;
  const srcAbs = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  const destAbs = path.join(PHARMACY_WORKSPACE_ROOT, destRel);
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  if (fs.existsSync(srcAbs) && srcAbs !== destAbs) {
    fs.renameSync(srcAbs, destAbs);
  }
  return { ...meta, relativePath: destRel, revision: computeAssetRevision({ ...meta, relativePath: destRel }) };
}

export function submitAssetForOperatorReview(
  serviceId: string,
  role: ImagePlatformRole,
  assetId: string,
  submittedBy?: string,
): ImagePlatformAssetMetadata | null {
  const meta = readAssetMetadata(serviceId, role, assetId);
  if (!meta) return null;
  const updated = moveBinaryToBucket(
    {
      ...meta,
      approval: { ...meta.approval, status: "pending" },
      contentClass: "pending_review",
      updatedAt: new Date().toISOString(),
    },
    "pending",
  );
  writeAssetMetadata(updated);
  const q = loadQueue();
  if (!q.pending.some((e) => e.serviceId === serviceId && e.role === role && e.assetId === assetId)) {
    q.pending.push({ serviceId, role, assetId, submittedAt: new Date().toISOString(), submittedBy });
  }
  saveQueue(q);
  return updated;
}

export function approvePlatformAsset(
  serviceId: string,
  role: ImagePlatformRole,
  assetId: string,
  operatorId: string,
  contentClass: ImagePlatformContentClass,
): ImagePlatformAssetMetadata | null {
  const meta = readAssetMetadata(serviceId, role, assetId);
  if (!meta) return null;
  const updated = moveBinaryToBucket(
    {
      ...meta,
      contentClass,
      approval: {
        status: "approved",
        approvedBy: operatorId,
        approvedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    },
    "approved",
  );
  writeAssetMetadata(updated);
  const q = loadQueue();
  q.pending = q.pending.filter((e) => !(e.serviceId === serviceId && e.role === role && e.assetId === assetId));
  saveQueue(q);
  return updated;
}

export function rejectPlatformAsset(
  serviceId: string,
  role: ImagePlatformRole,
  assetId: string,
  operatorId: string,
  reason: string,
): ImagePlatformAssetMetadata | null {
  const meta = readAssetMetadata(serviceId, role, assetId);
  if (!meta) return null;
  const updated = moveBinaryToBucket(
    {
      ...meta,
      contentClass: "decorative",
      approval: {
        status: "rejected",
        approvedBy: operatorId,
        approvedAt: new Date().toISOString(),
        rejectedReason: reason,
      },
      updatedAt: new Date().toISOString(),
    },
    "rejected",
  );
  writeAssetMetadata(updated);
  const q = loadQueue();
  q.pending = q.pending.filter((e) => !(e.serviceId === serviceId && e.role === role && e.assetId === assetId));
  saveQueue(q);
  return updated;
}

export function listPendingApprovals(): ApprovalQueueEntry[] {
  return loadQueue().pending;
}
