/**
 * CPR-WORKFLOW-STATE-01 — Product Owner workflow state resolver.
 * Campaign state only → workflow state → displayed actions.
 * Does not use legacy publish/preview/generation tenant flags.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import {
  isServicePageGeneratedForIdentity,
  readServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";

export type ProductOwnerWorkflowState =
  | "SERVICE_NOT_GENERATED"
  | "SERVICE_GENERATED"
  | "LOCALITIES_GENERATED";

export type ProductOwnerWorkflowActionId =
  | "generate_service_page"
  | "open_service_preview"
  | "regenerate_service_page"
  | "generate_locality_pages"
  | "review_locality_pages"
  | "regenerate_individual_page"
  | "regenerate_all_locality_pages";

export interface ProductOwnerWorkflowAction {
  id: ProductOwnerWorkflowActionId;
  label: string;
}

export interface ProductOwnerCampaignWorkflowResolution {
  workflowState: ProductOwnerWorkflowState;
  actions: ProductOwnerWorkflowAction[];
  currentStage: string;
  nextAction: string;
  nextActionPanel: string | null;
  servicePageStatus: string;
  localPageStatus: string;
  previewUrl: string | null;
  serviceGenerated: boolean;
  localitiesGenerated: boolean;
}

const ACTIONS_BY_STATE: Record<ProductOwnerWorkflowState, ProductOwnerWorkflowAction[]> = {
  SERVICE_NOT_GENERATED: [{ id: "generate_service_page", label: "Generate Service Page" }],
  SERVICE_GENERATED: [
    { id: "open_service_preview", label: "Open Service Preview" },
    { id: "regenerate_service_page", label: "Regenerate Service Page" },
    { id: "generate_locality_pages", label: "Generate Locality Pages" },
  ],
  // Cumulative: keep service review/regenerate actions after locality generation.
  LOCALITIES_GENERATED: [
    { id: "open_service_preview", label: "Open Service Preview" },
    { id: "regenerate_service_page", label: "Regenerate Service Page" },
    { id: "review_locality_pages", label: "Review Locality Pages" },
    { id: "regenerate_individual_page", label: "Regenerate Individual Page" },
    { id: "regenerate_all_locality_pages", label: "Regenerate All Locality Pages" },
  ],
};

function campaignHasLocalityPages(slug: string, serviceId: string): boolean {
  const localDir = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeAdminSlug(slug),
    serviceId,
    "local",
  );
  if (!fs.existsSync(localDir)) return false;
  try {
    return fs
      .readdirSync(localDir)
      .filter((name) => name !== "locations" && name !== "revisions")
      .some((name) => fs.existsSync(path.join(localDir, name, "index.html")));
  } catch {
    return false;
  }
}

function resolveCampaignPreviewUrl(
  slug: string,
  serviceId: string,
  campaignId: string,
  serviceGenerated: boolean,
): string | null {
  if (!serviceGenerated) return null;
  const record = readServicePageGenerationRecord(slug, serviceId, campaignId);
  if (record?.previewUrl) return record.previewUrl;
  return `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(safeAdminSlug(slug))}`;
}

/**
 * Resolve Product Owner workflow from campaign identity + campaign artefacts only.
 */
export function resolveProductOwnerCampaignWorkflowState(input: {
  slug: string;
  campaignId: string;
  serviceId: string;
}): ProductOwnerCampaignWorkflowResolution {
  const slug = safeAdminSlug(input.slug);
  const serviceId = String(input.serviceId || "").trim();
  const campaignId = String(input.campaignId || "").trim();

  const serviceGenerated = isServicePageGeneratedForIdentity(slug, serviceId, campaignId);
  const localitiesGenerated = serviceGenerated && campaignHasLocalityPages(slug, serviceId);

  const workflowState: ProductOwnerWorkflowState = !serviceGenerated
    ? "SERVICE_NOT_GENERATED"
    : localitiesGenerated
      ? "LOCALITIES_GENERATED"
      : "SERVICE_GENERATED";

  const actions = ACTIONS_BY_STATE[workflowState];
  const previewUrl = resolveCampaignPreviewUrl(slug, serviceId, campaignId, serviceGenerated);

  if (workflowState === "SERVICE_NOT_GENERATED") {
    return {
      workflowState,
      actions,
      currentStage: "Service Page Generation",
      nextAction: "Generate Service Page",
      nextActionPanel: "service-page-generation",
      servicePageStatus: "Not generated",
      localPageStatus: "Not generated",
      previewUrl: null,
      serviceGenerated: false,
      localitiesGenerated: false,
    };
  }

  if (workflowState === "SERVICE_GENERATED") {
    return {
      workflowState,
      actions,
      currentStage: "Service Page Generated",
      nextAction: "Generate Locality Pages",
      nextActionPanel: "campaign-locality-selection",
      servicePageStatus: "Service page generated",
      localPageStatus: "Not generated",
      previewUrl,
      serviceGenerated: true,
      localitiesGenerated: false,
    };
  }

  return {
    workflowState,
    actions,
    currentStage: "Locality Review",
    nextAction: "Review Locality Pages",
    nextActionPanel: "cluster-page-review",
    servicePageStatus: "Service page generated",
    localPageStatus: "Local pages generated",
    previewUrl,
    serviceGenerated: true,
    localitiesGenerated: true,
  };
}
