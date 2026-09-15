/**
 * Sprint 8C.2 — Per-tenant managed publishing model (no customer credentials).
 */
export type ManagedPublishStatus = "not_published" | "preview_available" | "live";
export type ManagedDnsStatus = "not_configured" | "pending" | "verified" | "conflict";
export type ManagedSslStatus = "managed_preview_active" | "pending" | "active" | "provisioning" | "failed";

export interface ManagedPublishingPaths {
  tenantPublishDirectory: string;
  releaseDirectory: string;
  currentReleasePointer: string;
  previousReleasePointer: string;
  manifestPath: string;
  registryPath: string;
  sitemapPath: string;
  assetPath: string;
  imagePath: string;
  logPath: string;
}

export interface ManagedPublishingRelease {
  releaseId: string;
  version: number;
  directory: string;
  sizeBytes: number;
  publishedAt: string | null;
  publishedBy: string | null;
  verified: boolean;
  current: boolean;
  previous: boolean;
}

export interface ManagedPublishingStorage {
  currentReleaseSizeBytes: number;
  totalRetainedReleaseSizeBytes: number;
  assetSizeBytes: number;
  imageSizeBytes: number;
  releaseCount: number;
  lastCleanupAt: string | null;
  retentionPolicy: number;
}

export interface ManagedPublishingProfile {
  version: 1;
  slug: string;
  tenantPublishDirectory: string;
  managedHostname: string;
  managedUrl: string;
  customerSubdomain: string | null;
  customerRootDomain: string | null;
  customerRootDomainConfirmed: boolean;
  customerRootDomainEvidenceSource: string | null;
  customerRootDomainEvidenceUrl: string | null;
  subdomainLabel: string;
  canonicalEcosystemHostname: string | null;
  canonicalEcosystemBaseUrl: string | null;
  internalFallbackUrl: string;
  canonicalUrlStatus: "pending_domain_confirmation" | "pending_dns" | "pending_ssl" | "active";
  liveVerificationStatus: string | null;
  requiredCnameHost: string | null;
  requiredCnameTarget: string;
  requiredCnameTtl: string;
  dnsStatus: ManagedDnsStatus;
  dnsLastCheckedAt: string | null;
  dnsVerificationEvidence: string | null;
  sslStatus: ManagedSslStatus;
  sslExpiry: string | null;
  sslRenewalStatus: string | null;
  sslLastCheckedAt: string | null;
  sslIssuer: string | null;
  sslIssuedAt: string | null;
  publishedVersion: number;
  publishStatus: ManagedPublishStatus;
  liveUrl: string | null;
  currentRelease: string | null;
  previousRelease: string | null;
  paths: ManagedPublishingPaths;
  storage: ManagedPublishingStorage;
  publishingReadiness:
    | "READY FOR VALIDATION"
    | "READY TO PUBLISH"
    | "READY FOR INTERNAL PUBLISH"
    | "READY FOR CUSTOMER SUBDOMAIN"
    | "BLOCKED"
    | "CONFIGURATION REQUIRED";
  legacyExternalProfileRef: string | null;
  migratedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ManagedPublishingReviewPayload {
  version: 1;
  slug: string;
  profile: ManagedPublishingProfile;
  summary: {
    hostingLabel: string;
    managed: boolean;
    managedUrl: string;
    internalFallbackUrl: string;
    customerRootDomain: string | null;
    subdomainLabel: string;
    canonicalEcosystemUrl: string | null;
    canonicalUrlStatus: string;
    tenantPublishStatus: string;
    currentRelease: string;
    lastPublished: string | null;
    dnsConnectionStatus: string;
    sslStatus: string;
    customerLiveUrl: string | null;
    requiredCname: string | null;
    publishingReadiness: string;
    overallStatus: string;
    domainConfirmationRequired: boolean;
    domainEvidenceSource: string | null;
  };
  dnsInstructions: {
    type: string;
    host: string | null;
    target: string;
    ttl: string;
    fullExpectedHostname: string | null;
  } | null;
  ecosystemUrl: {
    customerRootDomain: string | null;
    subdomainLabel: string;
    canonicalEcosystemHostname: string | null;
    canonicalEcosystemBaseUrl: string | null;
    internalFallbackUrl: string;
    managedCnameTarget: string;
    domainConfirmationRequired: boolean;
    domainEvidenceSource: string | null;
    domainEvidenceUrl: string | null;
    domainConfirmationReason: string | null;
  };
  warnings: string[];
  blockers: string[];
  releases: ManagedPublishingRelease[];
  canVerifyDns: boolean;
  canConfirmDomain: boolean;
  canChangeSubdomainLabel: boolean;
  canAddSubdomain: boolean;
  canRemoveSubdomain: boolean;
  canRollback: boolean;
}

export interface ManagedPublishingDomainConfirmInput {
  customerRootDomain: string;
}

export interface ManagedPublishingSubdomainLabelInput {
  subdomainLabel: string;
}

export interface ManagedPublishingSubdomainInput {
  customerSubdomain: string;
}

export interface ManagedPublishingValidationReport {
  ok: boolean;
  slug: string;
  checks: Array<{ id: string; label: string; status: "PASS" | "FAIL" | "WARNING"; detail: string }>;
  blockers: string[];
}
