/**
 * Image Platform metadata schema V1.1 — production population fields.
 */
import type { ImagePlatformRole } from "./pharmacyImagePlatformPaths.ts";
import type { ImagePlatformContentClass } from "./pharmacyImagePlatformTypes.ts";

export const IMAGE_PLATFORM_SCHEMA_V11 = "1.1" as const;

export type ImagePlatformPageType = "homepage" | "service" | "guide" | "blog";

export interface ImagePlatformResponsiveVariant {
  suffix: string;
  relativePath: string;
  width: number;
  height: number;
  mimeType: string;
  fileSizeBytes: number;
}

export interface ImagePlatformAssetMetadataV11 {
  schemaVersion: "1.1";
  assetId: string;
  serviceId: string;
  role: ImagePlatformRole;
  pageTypes: ImagePlatformPageType[];
  editorialUse?: "guide" | "blog" | null;
  classification: ImagePlatformContentClass;
  approvalStatus: "pending" | "approved" | "rejected" | "archived";
  sourceType: "ai_generated" | "operator_upload" | "licensed_stock" | "migrated_library";
  licenceType:
    | "pharmaconnect_owned"
    | "client_owned"
    | "stock_licensed"
    | "editorial_licensed"
    | "pending_clearance";
  licenceReference: string;
  filePath: string;
  masterPath: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  perceptualHash: string;
  width: number;
  height: number;
  aspectRatio: string;
  orientation: "landscape" | "portrait" | "square";
  visualStyle: "documentary_photography" | "editorial_photography";
  subject: string;
  patientContext: string;
  pharmacyContext: string;
  demographicRepresentation: string;
  accessibilityDescription: string;
  defaultAltText: string;
  safeForCropping: boolean;
  focalPoint: { x: number; y: number };
  responsiveVariants: ImagePlatformResponsiveVariant[];
  generatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  version: number;
  revision: string;
  licensing: {
    holder: string;
    licenseType:
      | "pharmaconnect_owned"
      | "client_owned"
      | "stock_licensed"
      | "editorial_licensed"
      | "pending_clearance";
    rights: string;
    territory?: string;
  };
  rejectedReason?: string;
}

export interface PharmacyFirstServiceManifest {
  schemaVersion: "1.1";
  serviceId: "pharmacy-first";
  serviceRevision: string;
  generatedAt: string;
  totalAssets: number;
  approvedAssets: number;
  pendingAssets: number;
  rejectedAssets: number;
  assetsByRole: Record<string, number>;
  assetsByOrientation: Record<string, number>;
  assetsByClassification: Record<string, number>;
  guideEditorialAssets: number;
  blogEditorialAssets: number;
  roleCoverage: Record<string, { required: number; approved: number; complete: boolean }>;
  variantCoverage: { assetsWithVariants: number; totalVariants: number };
  metadataCompleteness: number;
  licenceCompleteness: number;
  accessibilityCompleteness: number;
  duplicateCount: number;
  healthStatus: "READY" | "WARNING" | "BLOCKED";
}
