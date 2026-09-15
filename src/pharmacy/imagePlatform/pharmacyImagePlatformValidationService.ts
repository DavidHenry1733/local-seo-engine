/**
 * Library validation — schema, files, approval, dimensions.
 */
import fs from "node:fs";
import path from "node:path";
import {
  IMAGE_PLATFORM_ROLES,
  imagePlatformSchemasRootAbs,
  rolePlatformRootAbs,
  type ImagePlatformRole,
} from "./pharmacyImagePlatformPaths.ts";
import { listPlatformServiceIds, buildServiceCatalog } from "./pharmacyImagePlatformRequirements.ts";
import {
  listAssetMetaFiles,
  readAssetMetadata,
  scanAllPlatformAssets,
  computeAssetRevision,
} from "./pharmacyImagePlatformManifestService.ts";
import type { ImagePlatformAssetMetadata } from "./pharmacyImagePlatformTypes.ts";
import { isApprovedPlatformContentClass } from "./pharmacyImagePlatformTypes.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export interface ImagePlatformValidationIssue {
  code: string;
  severity: "error" | "warning";
  serviceId?: string;
  role?: ImagePlatformRole;
  assetId?: string;
  message: string;
}

export interface ImagePlatformValidationResult {
  valid: boolean;
  checkedAt: string;
  issueCount: number;
  issues: ImagePlatformValidationIssue[];
}

function push(issues: ImagePlatformValidationIssue[], issue: ImagePlatformValidationIssue): void {
  issues.push(issue);
}

function validateMetadataShape(meta: ImagePlatformAssetMetadata, issues: ImagePlatformValidationIssue[]): void {
  if (meta.schemaVersion !== "1.0") {
    push(issues, {
      code: "schema_version",
      severity: "error",
      serviceId: meta.serviceId,
      role: meta.role,
      assetId: meta.assetId,
      message: "schemaVersion must be 1.0",
    });
  }
  if (!meta.relativePath.startsWith("assets/pharmacy-image-platform/")) {
    push(issues, {
      code: "path_prefix",
      severity: "error",
      serviceId: meta.serviceId,
      role: meta.role,
      assetId: meta.assetId,
      message: "relativePath must live under assets/pharmacy-image-platform/",
    });
  }
  if (!meta.accessibility.decorative && meta.accessibility.altTextTemplate.trim() === "") {
    push(issues, {
      code: "a11y_alt",
      severity: "error",
      assetId: meta.assetId,
      message: "altTextTemplate required even when decorative=false policy applies",
    });
  }
  if (meta.approval.status === "approved" && !isApprovedPlatformContentClass(meta.contentClass)) {
    push(issues, {
      code: "approval_content_class",
      severity: "error",
      serviceId: meta.serviceId,
      role: meta.role,
      assetId: meta.assetId,
      message: `Approved asset must use approved contentClass, got ${meta.contentClass}`,
    });
  }
  if (meta.approval.status === "approved" && !meta.approval.approvedAt) {
    push(issues, {
      code: "approval_timestamp",
      severity: "warning",
      assetId: meta.assetId,
      message: "Approved asset missing approvedAt",
    });
  }
}

function validateFilePresence(meta: ImagePlatformAssetMetadata, issues: ImagePlatformValidationIssue[]): void {
  const abs = path.join(PHARMACY_WORKSPACE_ROOT, meta.relativePath.replace(/^\/+/, ""));
  if (!fs.existsSync(abs)) {
    push(issues, {
      code: "missing_file",
      severity: "error",
      serviceId: meta.serviceId,
      role: meta.role,
      assetId: meta.assetId,
      message: `Binary missing: ${meta.relativePath}`,
    });
    return;
  }
  const rev = computeAssetRevision(meta);
  if (meta.revision !== rev && meta.revision !== "pending") {
    push(issues, {
      code: "revision_drift",
      severity: "warning",
      assetId: meta.assetId,
      message: `Metadata revision ${meta.revision} does not match file hash ${rev}`,
    });
  }
  const stat = fs.statSync(abs);
  if (meta.fileSizeBytes != null && meta.fileSizeBytes !== stat.size) {
    push(issues, {
      code: "size_drift",
      severity: "warning",
      assetId: meta.assetId,
      message: "fileSizeBytes does not match filesystem",
    });
  }
}

function validateRoleMinimums(serviceId: string, issues: ImagePlatformValidationIssue[]): void {
  const catalog = buildServiceCatalog(serviceId);
  for (const role of IMAGE_PLATFORM_ROLES) {
    const req = catalog.roles[role];
    const approved = listAssetMetaFiles(serviceId, role)
      .map((id) => readAssetMetadata(serviceId, role, id))
      .filter(
        (m): m is ImagePlatformAssetMetadata =>
          !!m && m.approval.status === "approved" && isApprovedPlatformContentClass(m.contentClass),
      );
    if (approved.length < req.minApprovedAssets) {
      push(issues, {
        code: "min_approved_assets",
        severity: "error",
        serviceId,
        role,
        message: `Role ${role} requires ${req.minApprovedAssets} approved assets, found ${approved.length}`,
      });
    }
    for (const meta of approved) {
      if (meta.width != null && meta.width < req.minWidth) {
        push(issues, {
          code: "min_width",
          severity: "error",
          serviceId,
          role,
          assetId: meta.assetId,
          message: `Width ${meta.width} below minimum ${req.minWidth}`,
        });
      }
      if (meta.height != null && meta.height < req.minHeight) {
        push(issues, {
          code: "min_height",
          severity: "error",
          serviceId,
          role,
          assetId: meta.assetId,
          message: `Height ${meta.height} below minimum ${req.minHeight}`,
        });
      }
    }
  }
}

export function validateImagePlatformLibrary(): ImagePlatformValidationResult {
  const issues: ImagePlatformValidationIssue[] = [];
  const schemaRoot = imagePlatformSchemasRootAbs();
  for (const f of ["asset-metadata.schema.json", "assignment-contract.schema.json", "library-manifest.schema.json"]) {
    if (!fs.existsSync(path.join(schemaRoot, f))) {
      push(issues, { code: "missing_schema", severity: "error", message: `Missing schema ${f}` });
    }
  }

  const assets = scanAllPlatformAssets();
  for (const meta of assets) {
    validateMetadataShape(meta, issues);
    validateFilePresence(meta, issues);
  }

  for (const serviceId of listPlatformServiceIds()) {
    const svcRoot = path.join(PHARMACY_WORKSPACE_ROOT, "assets/pharmacy-image-platform/services", serviceId);
    if (!fs.existsSync(svcRoot)) {
      push(issues, {
        code: "missing_service_root",
        severity: "warning",
        serviceId,
        message: "Service directory not initialized",
      });
    }
    validateRoleMinimums(serviceId, issues);
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  return {
    valid: errors === 0,
    checkedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };
}
