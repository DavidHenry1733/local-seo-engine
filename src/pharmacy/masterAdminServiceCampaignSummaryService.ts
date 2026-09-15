/**
 * Master Dashboard ↔ Campaign OS integration — slim per-campaign summaries.
 * Reuses Campaign OS storage/list/execution; does not create a parallel campaign system.
 */
import {
  buildPharmacyCampaignDashboard,
  readPharmacyCampaignStore,
  type PharmacyCampaign,
} from "./pharmacyCampaignService.ts";
import type { PharmacyCampaignWithExecution } from "./pharmacyCampaignExecutionService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import {
  clearActiveServiceCampaignSelection,
  readActiveServiceCampaignSelection,
  writeActiveServiceCampaignSelection,
  type MasterAdminActiveCampaignSelection,
} from "./masterAdminActiveServiceCampaignStore.ts";
import {
  resolveProductOwnerCampaignWorkflowState,
  type ProductOwnerWorkflowAction,
  type ProductOwnerWorkflowState,
} from "./masterAdminProductOwnerWorkflowStateResolver.ts";
import {
  resolveProductOwnerCampaignContentPresentation,
  type LocalityContentStatus,
  type ServiceContentStatus,
} from "./masterAdminProductOwnerCampaignContentPresentation.ts";

export type { MasterAdminActiveCampaignSelection };
export { clearActiveServiceCampaignSelection, readActiveServiceCampaignSelection };

export interface MasterAdminServiceCampaignSummary {
  campaignId: string;
  serviceId: string;
  serviceName: string;
  campaignName: string;
  campaignGoal: string;
  status: string;
  statusLabel: string;
  currentStage: string;
  nextAction: string;
  nextActionPanel: string | null;
  servicePageStatus: string;
  localPageStatus: string;
  publishStatus: string;
  rankingsStatus: string;
  previewUrl: string | null;
  openUrl: string;
  detailUrl: string;
  selected: boolean;
  /** CPR-WORKFLOW-STATE-01 — campaign-state driven Product Owner workflow */
  workflowState: ProductOwnerWorkflowState;
  workflowActions: ProductOwnerWorkflowAction[];
  serviceGenerated: boolean;
  localitiesGenerated: boolean;
  /** CPR-PRODUCT-OWNER-CAMPAIGN-UI-01 — two content levels inside the same campaign */
  content: {
    serviceStatus: ServiceContentStatus;
    serviceRevision: string | null;
    serviceApproved: boolean;
    localityStatus: LocalityContentStatus;
    localityGeneratedCount: number;
    localityApprovedCount: number;
    localityRemainingCount: number;
    publishing: {
      ready: boolean;
      label: "Ready to Publish" | "Not Ready to Publish";
      blockers: string[];
      publishActionVisible: boolean;
    };
  };
}

export function selectActiveServiceCampaign(
  slug: string,
  campaignId: string,
): MasterAdminActiveCampaignSelection | null {
  const safe = safeAdminSlug(slug);
  const store = readPharmacyCampaignStore(safe);
  const campaign = (store?.campaigns || []).find(
    (c) => c.id === campaignId && c.status === "active",
  );
  if (!campaign) return null;
  return writeActiveServiceCampaignSelection(safe, campaign.id, campaign.serviceId);
}

function resolveMasterDashboardCampaignLifecycle(
  slug: string,
  campaign: PharmacyCampaignWithExecution,
): Pick<
  MasterAdminServiceCampaignSummary,
  | "statusLabel"
  | "currentStage"
  | "nextAction"
  | "nextActionPanel"
  | "servicePageStatus"
  | "localPageStatus"
  | "publishStatus"
  | "rankingsStatus"
  | "previewUrl"
  | "workflowState"
  | "workflowActions"
  | "serviceGenerated"
  | "localitiesGenerated"
  | "content"
> {
  const workflow = resolveProductOwnerCampaignWorkflowState({
    slug,
    campaignId: campaign.id,
    serviceId: campaign.serviceId,
  });
  const content = resolveProductOwnerCampaignContentPresentation({
    slug,
    campaignId: campaign.id,
    serviceId: campaign.serviceId,
  });

  // Publish/rankings remain informational only — they must not drive Product Owner actions.
  const publishStatus =
    campaign.publishingStatus === "published"
      ? "Published"
      : campaign.publishingStatus === "partial"
        ? "Partial"
        : "Not published";
  const rankingsStatus =
    campaign.indexingStatus === "indexed"
      ? "Indexed"
      : campaign.indexingStatus === "submitted"
        ? "Submitted"
        : campaign.visiblePages > 0
          ? "Visible"
          : "Not registered";

  return {
    statusLabel: "Active",
    currentStage: workflow.currentStage,
    nextAction: workflow.nextAction,
    nextActionPanel: workflow.nextActionPanel,
    servicePageStatus: workflow.servicePageStatus,
    localPageStatus: workflow.localPageStatus,
    publishStatus,
    rankingsStatus,
    previewUrl: content.servicePreviewUrl || workflow.previewUrl,
    workflowState: workflow.workflowState,
    workflowActions: workflow.actions,
    serviceGenerated: workflow.serviceGenerated,
    localitiesGenerated: workflow.localitiesGenerated,
    content: {
      serviceStatus: content.serviceStatus,
      serviceRevision: content.serviceRevision,
      serviceApproved: content.serviceApproved,
      localityStatus: content.localityStatus,
      localityGeneratedCount: content.localityGeneratedCount,
      localityApprovedCount: content.localityApprovedCount,
      localityRemainingCount: content.localityRemainingCount,
      publishing: content.publishing,
    },
  };
}

function toSummary(
  slug: string,
  campaign: PharmacyCampaignWithExecution,
  selectedCampaignId: string | null,
): MasterAdminServiceCampaignSummary {
  const safe = safeAdminSlug(slug);
  const lifecycle = resolveMasterDashboardCampaignLifecycle(safe, campaign);
  return {
    campaignId: campaign.id,
    serviceId: campaign.serviceId,
    serviceName: campaign.serviceName,
    campaignName: campaign.name,
    campaignGoal: campaign.campaignGoal,
    status: campaign.status,
    ...lifecycle,
    openUrl: `/api/admin/master?customer=${encodeURIComponent(safe)}&campaignId=${encodeURIComponent(campaign.id)}`,
    detailUrl: `/api/pharmacy-campaigns?slug=${encodeURIComponent(safe)}&campaignId=${encodeURIComponent(campaign.id)}`,
    selected: Boolean(selectedCampaignId && selectedCampaignId === campaign.id),
  };
}

/** Active Campaign OS campaigns as Master Dashboard Service Campaigns cards. */
export function buildMasterAdminServiceCampaignSummaries(slug: string): MasterAdminServiceCampaignSummary[] {
  const safe = safeAdminSlug(slug);
  const dashboard = buildPharmacyCampaignDashboard(safe);
  const selection = readActiveServiceCampaignSelection(safe);
  const selectedId = selection?.campaignId || null;
  return dashboard.campaigns
    .filter((c) => c.status === "active")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((c) => toSummary(safe, c, selectedId));
}

export function resolveMasterAdminServiceCampaignSummary(
  slug: string,
  campaignId: string,
): MasterAdminServiceCampaignSummary | null {
  return buildMasterAdminServiceCampaignSummaries(slug).find((c) => c.campaignId === campaignId) || null;
}

export function findActiveCampaignById(slug: string, campaignId: string): PharmacyCampaign | null {
  const store = readPharmacyCampaignStore(safeAdminSlug(slug));
  return (store?.campaigns || []).find((c) => c.id === campaignId && c.status === "active") || null;
}
