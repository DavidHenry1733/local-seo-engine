/**
 * CPR-RESET-04 — multi-location website branch resolution contract.
 */

export type WebsiteBranchResolutionStatus =
  | "none"
  | "branch_selection_required"
  | "branch_selected"
  | "none_of_these_branches";

export type GoogleBranchMatchStatus = "pending" | "matched" | "mismatch" | "none";

export interface WebsiteBranchEvidenceSource {
  sourceUrl: string;
  detectionMethod: string;
}

export interface DetectedWebsiteBranch {
  branchId: string;
  branchName: string;
  parentBrandName: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  phone: string;
  email: string;
  branchUrl: string;
  logoUrl: string;
  openingHours: string;
  services: string[];
  googlePlaceId: string | null;
  googleBusinessName: string | null;
  googleAddress: string | null;
  googleMatchConfidence: number | null;
  evidenceSources: WebsiteBranchEvidenceSource[];
  detectionSignals: string[];
}

export interface WebsiteParentBrand {
  tradingName: string;
  parentWebsite: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
}

export interface WebsiteBranchResolution {
  status: WebsiteBranchResolutionStatus;
  detectedAt: string;
  selectedAt: string | null;
  selectedBy: string | null;
  parentBrand: WebsiteParentBrand;
  detectedBranches: DetectedWebsiteBranch[];
  selectedBranchId: string | null;
  selectedBranch: DetectedWebsiteBranch | null;
  rawImportPreserved: boolean;
  googleBranchMatchStatus: GoogleBranchMatchStatus;
  googleBranchMatchNotes: string[];
}

export interface WebsiteBranchSelectionPayload {
  resolution: WebsiteBranchResolution;
  requiresSelection: boolean;
  detectedBranchCount: number;
  selectedBranchId: string | null;
  googleBranchMatchStatus: GoogleBranchMatchStatus;
  googleBranchMatchNotes: string[];
}
