/**
 * Growth Engine — Live Integration Proof V1 model.
 */

export const LIVE_INTEGRATION_PROOF_VERSION = 1;

export type IntegrationStatusLabel = "connected" | "not_connected" | "error" | "limited" | "ready";

export type LiveIntegrationId =
  | "google-places"
  | "website-import"
  | "image-generation"
  | "static-publishing"
  | "ftp-publishing"
  | "google-search-console"
  | "rank-tracking";

export interface LiveIntegrationCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
  liveData: boolean;
}

export interface LiveIntegrationResult {
  id: LiveIntegrationId;
  name: string;
  status: IntegrationStatusLabel;
  lastCheckedAt: string;
  testResult: string;
  unlocks: string;
  nextAction: string;
  checks: LiveIntegrationCheck[];
  artifactPath?: string;
}

export interface LiveIntegrationProofReport {
  version: number;
  slug: string;
  checkedAt: string;
  overallReady: boolean;
  connectedCount: number;
  integrations: LiveIntegrationResult[];
}

export const INTEGRATION_META: Record<
  LiveIntegrationId,
  { name: string; unlocks: string; nextActionDisconnected: string }
> = {
  "google-places": {
    name: "Google Places API",
    unlocks: "Local Healthcare Intelligence, competitor discovery, and pharmacy lookup",
    nextActionDisconnected: "Set GOOGLE_PLACES_API_KEY and run discovery from Local Healthcare Intelligence",
  },
  "website-import": {
    name: "Website Import",
    unlocks: "Business Profile brand import, colours, logo, services, and opening hours",
    nextActionDisconnected: "Add a website URL to your Business Profile and run website import",
  },
  "image-generation": {
    name: "Image Generation (Ideogram)",
    unlocks: "AI images for service pages and campaign assets",
    nextActionDisconnected: "Set IDEOGRAM_API_KEY in environment or project settings",
  },
  "static-publishing": {
    name: "Static Publishing",
    unlocks: "Local HTML output, sitemap, and page tracker for indexing",
    nextActionDisconnected: "Create content and run publish build from publishing settings",
  },
  "ftp-publishing": {
    name: "FTP / Live Publishing",
    unlocks: "Upload published pages and sitemap to your live website",
    nextActionDisconnected: "Configure deploy host and DEPLOY_USERNAME / DEPLOY_PASSWORD",
  },
  "google-search-console": {
    name: "Google Search Console",
    unlocks: "Live indexing status, URL submission, and search performance",
    nextActionDisconnected: "Connect GSC OAuth or set GOOGLE_SERVICE_ACCOUNT_JSON",
  },
  "rank-tracking": {
    name: "Rank Tracking",
    unlocks: "Keyword positions, movement, and visibility in Growth Dashboard",
    nextActionDisconnected: "Connect GSC OAuth and build rank tracking data layer",
  },
};
