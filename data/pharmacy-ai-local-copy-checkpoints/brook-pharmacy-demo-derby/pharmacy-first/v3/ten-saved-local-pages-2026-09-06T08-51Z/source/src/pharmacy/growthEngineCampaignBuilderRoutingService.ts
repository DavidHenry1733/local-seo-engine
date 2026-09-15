/**
 * Campaign Builder action routing — page vs action URL mapping and auth-safe redirects.
 */
import {
  advanceCampaignBuilderStep,
  campaignBuilderStepUrl,
  loadCampaignBuilderSession,
  parseCampaignBuilderAssetSelection,
  selectCampaignBuilderService,
  updateCampaignBuilderSettings,
} from "./growthEngineCampaignBuilderService.ts";
import {
  DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION,
  type CampaignBuilderAssetSelection,
  type CampaignBuilderStep,
} from "./growthEngineCampaignBuilderModel.ts";

export type CampaignBuilderAction =
  | "select"
  | "settings"
  | "generate"
  | "approve-asset"
  | "regenerate"
  | "advance";

const ACTION_STEP: Record<CampaignBuilderAction, CampaignBuilderStep> = {
  select: "choose",
  settings: "settings",
  generate: "approval",
  "approve-asset": "review",
  regenerate: "review",
  advance: "choose",
};

const WIZARD_STEPS = new Set<CampaignBuilderStep>([
  "choose",
  "areas",
  "settings",
  "images",
  "overview",
  "approval",
  "review",
]);

const ACTION_PATTERN =
  /^\/growth-engine\/([^/]+)\/campaign-builder\/(select|settings|generate|approve-asset|regenerate|advance)$/;

export function matchCampaignBuilderActionPath(path: string): { slug: string; action: CampaignBuilderAction } | null {
  const normalized = path.split("?")[0];
  const match = normalized.match(ACTION_PATTERN);
  if (!match) return null;
  return { slug: match[1], action: match[2] as CampaignBuilderAction };
}

export function matchCampaignBuilderActionUrl(urlOrPath: string): { slug: string; action: CampaignBuilderAction } | null {
  const raw = urlOrPath.split("?")[0];
  const path = raw.startsWith("/api/") ? raw.slice(4) : raw;
  return matchCampaignBuilderActionPath(path);
}

export function isCampaignBuilderActionPath(path: string): boolean {
  return Boolean(matchCampaignBuilderActionPath(path));
}

export function isCampaignBuilderActionUrl(urlOrPath: string): boolean {
  return Boolean(matchCampaignBuilderActionUrl(urlOrPath));
}

export function campaignBuilderPageUrlForAction(
  slug: string,
  action: CampaignBuilderAction,
  extraQuery?: Record<string, string>,
): string {
  const step = ACTION_STEP[action];
  const params = new URLSearchParams({ slug, step, ...extraQuery });
  return `/api/growth-engine/campaign-builder?${params.toString()}`;
}

export function campaignBuilderWizardUrl(
  slug: string,
  step: CampaignBuilderStep,
  campaignId?: string | null,
): string {
  const params = new URLSearchParams({ slug, step });
  if (campaignId) params.set("campaign", campaignId);
  return `/api/growth-engine/campaign-builder?${params.toString()}`;
}

function parseFullSelectionFromQuery(query: Record<string, unknown>): CampaignBuilderAssetSelection {
  const keys = Object.keys(DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION) as (keyof CampaignBuilderAssetSelection)[];
  const out = { ...DEFAULT_CAMPAIGN_BUILDER_ASSET_SELECTION };
  for (const key of keys) {
    out[key] = query[key] === true || query[key] === "true" || query[key] === "on";
  }
  return out;
}

function queryHasAssetSelection(query: Record<string, unknown>): boolean {
  return String(query.mode || "") === "manual";
}

/** Sync session from GET wizard query params before rendering a step. */
export function applyCampaignBuilderWizardQuery(
  slug: string,
  query: Record<string, unknown>,
): CampaignBuilderStep {
  const step = String(query.step || "choose") as CampaignBuilderStep;
  const campaign = String(query.campaign || query.serviceId || query.service || "").trim();

  if (campaign && step !== "choose") {
    const session = loadCampaignBuilderSession(slug);
    if (session.selectedServiceId !== campaign) {
      selectCampaignBuilderService(slug, campaign);
    }
  }

  if (step === "images" && queryHasAssetSelection(query)) {
    updateCampaignBuilderSettings(slug, "manual", parseFullSelectionFromQuery(query));
  } else if (WIZARD_STEPS.has(step)) {
    const session = loadCampaignBuilderSession(slug);
    if (session.step !== step) {
      advanceCampaignBuilderStep(slug, step);
    }
  }

  return WIZARD_STEPS.has(step) ? step : "choose";
}

/** Safe GET page route — never an action endpoint. Used after login. */
export function safeCampaignBuilderLoginDestination(slug: string): string {
  return campaignBuilderStepUrl(slug, "choose");
}

export function preserveAuthHandoffQuery(
  sourceQuery: Record<string, unknown>,
  targetUrl: string,
): string {
  const token = sourceQuery._t;
  if (!token || typeof token !== "string") return targetUrl;
  const [path, qs = ""] = targetUrl.split("?");
  const params = new URLSearchParams(qs);
  params.set("_t", token);
  return `${path}?${params.toString()}`;
}

export function sanitizeCampaignBuilderLoginNext(nextUrl: string): string {
  if (!nextUrl.startsWith("/")) return nextUrl;
  const action = matchCampaignBuilderActionUrl(nextUrl);
  if (action) return safeCampaignBuilderLoginDestination(action.slug);
  return nextUrl.split("#")[0];
}

export function campaignBuilderActionGetRedirect(path: string, query: Record<string, unknown> = {}): string | null {
  const match = matchCampaignBuilderActionPath(path);
  if (!match) return null;
  const campaign = String(query.serviceId || query.campaign || query.service || "");
  if (match.action === "select" && campaign) {
    return campaignBuilderWizardUrl(match.slug, "areas", campaign);
  }
  if (match.action === "settings") {
    return campaignBuilderWizardUrl(match.slug, "settings", campaign || loadCampaignBuilderSession(match.slug).selectedServiceId);
  }
  if (match.action === "generate") {
    return campaignBuilderWizardUrl(match.slug, "approval", campaign || loadCampaignBuilderSession(match.slug).selectedServiceId);
  }
  return safeCampaignBuilderLoginDestination(match.slug);
}

export const CAMPAIGN_BUILDER_ACTION_PATHS = [
  "select",
  "settings",
  "generate",
  "approve-asset",
  "regenerate",
] as const;

export const CAMPAIGN_BUILDER_ACTION_SUFFIXES = [
  "/campaign-builder/select",
  "/campaign-builder/settings",
  "/campaign-builder/generate",
  "/campaign-builder/approve-asset",
  "/campaign-builder/regenerate",
] as const;

export function loginNextContainsActionEndpoint(nextUrl: string): boolean {
  return CAMPAIGN_BUILDER_ACTION_SUFFIXES.some((suffix) => nextUrl.includes(suffix));
}
