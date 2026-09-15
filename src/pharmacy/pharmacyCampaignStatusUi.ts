/**
 * Plain-language campaign status labels for Platform Workflow UX V2.
 */
import type { PharmacyCampaignEnriched } from "./pharmacyCampaignControlCentreService.ts";

export interface PlainCampaignStatusItem {
  label: string;
  done: boolean;
}

export function buildPlainCampaignStatus(campaign: PharmacyCampaignEnriched): PlainCampaignStatusItem[] {
  const ex = campaign.execution;
  const indexed = ["indexed", "submitted"].includes(campaign.indexingStatus);
  const visible = campaign.visibilityStatus === "visible" || campaign.visibilityStatus === "building";
  const reviewed =
    campaign.authorityPublishGate === "PASS" || campaign.authorityPublishGate === "PASS_WITH_RECOMMENDATIONS";
  const ready =
    reviewed &&
    campaign.publishingStatus !== "pending" &&
    campaign.authorityLivePublishReady;

  return [
    { label: "Generated", done: ex.progressPct >= 15 || ex.stage !== "draft" },
    { label: "Images Added", done: campaign.imageAssignedCount >= Math.min(4, campaign.imageTotalSlots) },
    { label: "Reviewed", done: reviewed },
    { label: "Ready To Publish", done: ready || campaign.publishingStatus === "published" },
    { label: "Indexed", done: indexed },
    { label: "Ranking", done: visible },
    { label: "Performance", done: ex.stage === "complete" || ex.stage === "visible" },
  ];
}
