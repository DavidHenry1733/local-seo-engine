/**
 * Founder Partner Dashboard V1 — full campaign workflow checklist.
 * Surfaces every step for customer testing; marks operational gaps clearly.
 */
import fs from "node:fs";
import { buildGrowthEngineFramework, growthEngineContentPackageUrl } from "./growthEngineFrameworkService.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import {
  contentPackageApproved,
  contentPackageGenerated,
  contentPackageReviewed,
} from "./pharmacyContentPackageService.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { loadPharmacyDeployConfig } from "./pharmacyDeployConfig.ts";
import { buildGrowthJourneyView } from "./growthEngineCycleManagerService.ts";

export type FounderPartnerStepStatus = "complete" | "ready" | "pending" | "gap";

export interface FounderPartnerWorkflowStep {
  id: string;
  label: string;
  detail: string;
  status: FounderPartnerStepStatus;
  action: "navigate" | "api" | "none";
  href?: string;
  apiPath?: string;
  apiMethod?: "POST";
  apiBody?: Record<string, unknown>;
  confirmMessage?: string;
  gapNote?: string;
}

export interface FounderPartnerWorkflow {
  slug: string;
  serviceId: string;
  serviceName: string;
  steps: FounderPartnerWorkflowStep[];
  nextStepId: string | null;
  operationalGaps: string[];
}

const GSC_TOKENS_FILE = "/tmp/.gsc-oauth-tokens.json";
const GSC_DISCONNECTED_FILE = "/tmp/.gsc-oauth-disconnected";

function isGscOAuthConnected(): boolean {
  if (fs.existsSync(GSC_DISCONNECTED_FILE)) return false;
  if (fs.existsSync(GSC_TOKENS_FILE)) return true;
  return Boolean((process.env.GSC_OAUTH_REFRESH_TOKEN ?? "").trim());
}

function serviceLabel(serviceId: string): string {
  return serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function step(partial: FounderPartnerWorkflowStep): FounderPartnerWorkflowStep {
  return partial;
}

export function buildFounderPartnerWorkflow(slug: string, serviceIdOverride?: string): FounderPartnerWorkflow {
  const framework = buildGrowthEngineFramework(slug);
  const journey = buildGrowthJourneyView(slug);
  const serviceId =
    serviceIdOverride ||
    journey.currentCycle?.serviceId ||
    framework.plan.primaryServiceId ||
    "blood-pressure-checks";
  const serviceName = journey.currentCycle?.recommendedService || serviceLabel(serviceId);

  const competitors = loadCompetitorSnapshot(slug);
  const website = loadWebsiteIntelligenceSnapshot(slug);
  const generated = contentPackageGenerated(slug, serviceId);
  const reviewed = contentPackageReviewed(slug, serviceId);
  const approved = contentPackageApproved(slug, serviceId);
  const livePub = getPharmacyLivePublishStatus(slug);
  const deploy = loadPharmacyDeployConfig(slug);
  const indexing = readPharmacyIndexingSummary(slug);
  const gscConnected = isGscOAuthConnected();
  const ftpReady = deploy.configured && deploy.credentialsPresent;

  const bizStep = framework.steps.find((s) => s.id === "business-intelligence");
  const localStep = framework.steps.find((s) => s.id === "local-market");
  const webStep = framework.steps.find((s) => s.id === "website-intelligence");
  const planStep = framework.steps.find((s) => s.id === "growth-plan");

  const ftpGapNote = !ftpReady
    ? "FTP not configured — set deploy config and DEPLOY_USERNAME / DEPLOY_PASSWORD"
    : undefined;

  const steps: FounderPartnerWorkflowStep[] = [
    step({
      id: "business-profile",
      label: "Your Pharmacy",
      detail: bizStep?.summary || "Confirm imported profile data",
      status: bizStep?.status === "complete" ? "complete" : "ready",
      action: "navigate",
      href: `/api/growth-engine/business-intelligence?slug=${encodeURIComponent(slug)}`,
    }),
    step({
      id: "local-intelligence",
      label: "Your Local Market",
      detail: localStep?.summary || "See how you compare to nearby pharmacies",
      status: localStep?.status === "complete" ? "complete" : competitors?.competitors.length ? "ready" : "pending",
      action: "navigate",
      href: `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`,
    }),
    step({
      id: "website-intelligence",
      label: "Your Website Report",
      detail: webStep?.summary || "Inventory what your website contains",
      status: webStep?.status === "complete" ? "complete" : website?.analysis ? "ready" : "pending",
      action: "navigate",
      href: `/api/growth-engine/website-intelligence?slug=${encodeURIComponent(slug)}`,
    }),
    step({
      id: "growth-plan",
      label: "Your Growth Plan",
      detail: planStep?.summary || `Review recommended campaign for ${serviceName}`,
      status: planStep?.status === "complete" ? "complete" : "ready",
      action: "navigate",
      href: `/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}`,
    }),
    step({
      id: "generate-campaign",
      label: "Generate Campaign",
      detail: generated ? "Content package created" : `Create content for ${serviceName}`,
      status: generated ? "complete" : "ready",
      action: "navigate",
      href: growthEngineContentPackageUrl(slug, serviceId),
    }),
    step({
      id: "review-assets",
      label: "Review Assets",
      detail: reviewed ? "Content reviewed" : "Review pages and campaign assets",
      status: reviewed ? "complete" : generated ? "ready" : "pending",
      action: "navigate",
      href: `/api/pharmacy-asset-review?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`,
    }),
    step({
      id: "approve-content",
      label: "Approve Content",
      detail: approved ? "Approved for launch" : "Sign off content before publishing",
      status: approved ? "complete" : reviewed ? "ready" : "pending",
      action: "navigate",
      href: `/api/pharmacy-asset-review?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`,
    }),
    step({
      id: "prepare-publish",
      label: "Prepare Publish Output",
      detail: livePub.staticOutputReady
        ? `${livePub.pageCount} pages prepared`
        : "Build static HTML and sitemap from your content",
      status: livePub.staticOutputReady ? "complete" : approved ? "ready" : "pending",
      action: approved && !livePub.staticOutputReady ? "api" : "none",
      apiPath: `/api/pharmacy-publishing/${encodeURIComponent(slug)}/prepare`,
      apiMethod: "POST",
      apiBody: { serviceId },
    }),
    step({
      id: "ftp-test",
      label: "Test FTP Connection",
      detail: livePub.lastFtpTestOk
        ? `Verified ${livePub.lastFtpTestAt?.slice(0, 10) || ""}`
        : "Safe connection test before live publish",
      status: livePub.lastFtpTestOk
        ? "complete"
        : !ftpReady && livePub.staticOutputReady
          ? "gap"
          : livePub.staticOutputReady
            ? "ready"
            : "pending",
      action: livePub.staticOutputReady && !livePub.lastFtpTestOk && ftpReady ? "api" : "none",
      apiPath: `/api/pharmacy-publishing/${encodeURIComponent(slug)}/ftp-test`,
      apiMethod: "POST",
      gapNote: ftpGapNote,
    }),
    step({
      id: "publish-live",
      label: "Publish to Live Website",
      detail: livePub.lastPublishedAt
        ? `Published ${livePub.lastPublishedAt.slice(0, 10)}${livePub.lastPublishedUrl ? ` · ${livePub.lastPublishedUrl}` : ""}`
        : "Upload prepared pages to your website (requires confirmation)",
      status: livePub.lastPublishedAt
        ? "complete"
        : !ftpReady && livePub.staticOutputReady
          ? "gap"
          : livePub.staticOutputReady
            ? "ready"
            : "pending",
      action: livePub.staticOutputReady && !livePub.lastPublishedAt && ftpReady ? "api" : "none",
      apiPath: `/api/pharmacy-publishing/${encodeURIComponent(slug)}/publish`,
      apiMethod: "POST",
      apiBody: { serviceId, confirm: true },
      confirmMessage: "Publish prepared content to your live website now?",
      gapNote: !ftpReady ? "Publishing connection not ready — complete FTP configuration first" : undefined,
    }),
    step({
      id: "register-indexing",
      label: "Register Pages for Indexing",
      detail: indexing?.totalRegistered
        ? `${indexing.totalRegistered} pages registered`
        : "Add published pages to your indexing tracker",
      status: (indexing?.totalRegistered || 0) > 0 ? "complete" : livePub.lastPublishedAt ? "ready" : "pending",
      action: livePub.lastPublishedAt && !indexing?.totalRegistered ? "api" : "none",
      apiPath: `/api/pharmacy-indexing/${encodeURIComponent(slug)}/register`,
      apiMethod: "POST",
    }),
    step({
      id: "gsc-submit",
      label: "Submit to Search Console",
      detail: gscConnected
        ? indexing?.readyToSubmit
          ? `${indexing.readyToSubmit} pages ready to submit`
          : indexing?.submitted
            ? `${indexing.submitted} submitted`
            : "Submit when pages are registered"
        : "Search Console OAuth not connected",
      status: (indexing?.submitted || 0) > 0
        ? "complete"
        : !gscConnected
          ? "gap"
          : (indexing?.readyToSubmit || 0) > 0
            ? "ready"
            : "pending",
      action: gscConnected && (indexing?.readyToSubmit || 0) > 0 ? "api" : "none",
      apiPath: `/api/pharmacy-indexing/${encodeURIComponent(slug)}/submit`,
      apiMethod: "POST",
      gapNote: !gscConnected
        ? "Operational gap — connect Google Search Console OAuth before live URL submission"
        : undefined,
    }),
  ];

  const operationalGaps = steps.filter((s) => s.status === "gap").map((s) => s.gapNote || s.label);
  const next = steps.find((s) => s.status === "ready" || s.status === "pending");

  return {
    slug,
    serviceId,
    serviceName,
    steps,
    nextStepId: next?.id || null,
    operationalGaps,
  };
}
