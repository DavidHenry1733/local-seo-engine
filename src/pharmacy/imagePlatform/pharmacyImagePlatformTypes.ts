/**
 * PharmaConnect Image Platform V1 — types aligned to JSON schemas.
 */
import type { ImagePlatformApprovalStatus, ImagePlatformRole } from "./pharmacyImagePlatformPaths.ts";

export type ImagePlatformContentClass =
  | "approved_photograph"
  | "approved_editorial_illustration"
  | "approved_tenant_generated"
  | "approved_operator_selected"
  | "placeholder"
  | "decorative"
  | "pending_review";

export interface ImagePlatformLicensing {
  holder: string;
  licenseType:
    | "pharmaconnect_owned"
    | "client_owned"
    | "stock_licensed"
    | "editorial_licensed"
    | "pending_clearance";
  rights: string;
  expiry?: string;
  attribution?: string;
  territory?: string;
}

export interface ImagePlatformAccessibility {
  decorative: boolean;
  altTextTemplate: string;
  longDescription?: string;
  focusPriority?: "high" | "low" | "none";
}

export interface ImagePlatformAssetMetadata {
  schemaVersion: "1.0";
  assetId: string;
  serviceId: string;
  role: ImagePlatformRole;
  version: number;
  revision: string;
  relativePath: string;
  mimeType: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  orientation: "landscape" | "portrait" | "square" | "unknown";
  aspectRatio: string;
  licensing: ImagePlatformLicensing;
  accessibility: ImagePlatformAccessibility;
  contentClass: ImagePlatformContentClass;
  approval: {
    status: ImagePlatformApprovalStatus;
    approvedBy?: string;
    approvedAt?: string;
    rejectedReason?: string;
    operatorNotes?: string;
  };
  subject?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ImagePlatformServiceCatalog {
  schemaVersion: "1.0";
  serviceId: string;
  serviceName: string;
  roles: Record<
    ImagePlatformRole,
    {
      minApprovedAssets: number;
      minWidth: number;
      minHeight: number;
      preferredOrientation: "landscape" | "portrait" | "square" | "any";
      preferredAspectRatio?: string;
      subjectHint: string;
    }
  >;
}

export interface ImagePlatformSelectionRule {
  mode: "deterministic_approved_rank";
  rankKey: string;
  minContentClass: Array<
    | "approved_photograph"
    | "approved_editorial_illustration"
    | "approved_tenant_generated"
    | "approved_operator_selected"
  >;
}

export interface ImagePlatformAssignmentContract {
  schemaVersion: "1.0";
  platformRevision: string;
  serviceId: string;
  pageType: "homepage" | "service" | "guide" | "blog" | "cluster" | "other";
  pageSlug: string;
  slot: ImagePlatformRole;
  selectionRule: ImagePlatformSelectionRule;
  assetRef: {
    assetId: string;
    revision: string;
    relativePath: string;
  };
  assignedAt?: string;
  assignmentReason?: string;
}

export interface ImagePlatformLibraryManifest {
  schemaVersion: "1.0";
  platformRevision: string;
  generatedAt: string;
  assetRoot: "assets/pharmacy-image-platform";
  services: Record<
    string,
    {
      serviceId: string;
      roles: Record<
        string,
        {
          approvedAssetIds: string[];
        }
      >;
    }
  >;
}

export interface ImagePlatformRevisionDoc {
  schemaVersion: "1.0";
  platformRevision: string;
  previousRevision?: string;
  updatedAt: string;
  assetCount: number;
  approvedAssetCount: number;
}

export const APPROVED_CONTENT_CLASSES: ImagePlatformContentClass[] = [
  "approved_photograph",
  "approved_editorial_illustration",
  "approved_tenant_generated",
  "approved_operator_selected",
];

export function isApprovedPlatformContentClass(c: ImagePlatformContentClass): boolean {
  return (APPROVED_CONTENT_CLASSES as string[]).includes(c);
}
