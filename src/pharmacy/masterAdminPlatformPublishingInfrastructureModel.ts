/**
 * Sprint 8C.2 / 8C.3 — Global PharmaConnect publishing infrastructure model.
 */
export type PlatformPublishingMethod = "static_html_ftp" | "static_html_sftp";

/** Locked-campaign staging overlay transport. Does not replace remote SFTP publishing. */
export type LockedCampaignStagingTransport = "static_html_local" | "static_html_sftp";

export type PlatformConnectionStatus =
  | "NOT CONFIGURED"
  | "NOT TESTED"
  | "CONNECTION FAILED"
  | "CONNECTED"
  | "READY";

export type PlatformPublishRootStatus = "NOT VALIDATED" | "VALID" | "INVALID";

export interface PlatformPublishingInfrastructureProfile {
  version: 1;
  infrastructureId: string;
  publishingMethod: PlatformPublishingMethod;
  /** Explicit same-host staging overlay. Remote tenants keep static_html_sftp. */
  lockedCampaignStagingTransport?: LockedCampaignStagingTransport;
  serverHost: string;
  port: number;
  username: string;
  credentialReference: string;
  credentialsConfigured: boolean;
  credentialMasked: string;
  globalPublishRoot: string;
  managedSitesDomain: string;
  platformStatus: PlatformConnectionStatus;
  publishRootStatus: PlatformPublishRootStatus;
  connectionStatus: "Healthy" | "Warning" | "Offline";
  writableStatus: boolean | null;
  lastTestedAt: string | null;
  lastSuccessfulConnectionTestAt: string | null;
  lastSuccessfulConnectionTestBy: string | null;
  lastConnectionTestResponseMs: number | null;
  lastFailureReason: string | null;
  lastSuccessfulPublishAt: string | null;
  profileRevision: number;
  updatedAt: string;
  updatedBy: string | null;
  createdAt: string;
}

export interface PlatformInfrastructureCheck {
  id: string;
  label: string;
  status: "PASS" | "WARNING" | "FAIL";
  detail: string;
}

export interface PlatformInfrastructureReviewPayload {
  version: 1;
  profile: PlatformPublishingInfrastructureProfile;
  summary: {
    platformStatus: PlatformConnectionStatus;
    publishRootStatus: PlatformPublishRootStatus;
    connectionStatus: string;
    publishRootStatusLabel: string;
    lastFailureReason: string | null;
    lastTestedAt: string | null;
    lastSuccessfulTestAt: string | null;
    credentialsConfigured: boolean;
  };
  checks: PlatformInfrastructureCheck[];
  canTestConnection: boolean;
  canValidatePublishRoot: boolean;
}

export interface PlatformInfrastructureSaveInput {
  publishingMethod?: PlatformPublishingMethod;
  serverHost?: string;
  port?: number;
  username?: string;
  password?: string;
  globalPublishRoot?: string;
  managedSitesDomain?: string;
}
