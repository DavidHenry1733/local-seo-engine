/**
 * Growth Plan lifecycle presentation — distinguishes ungenerated, existing, and exhausted queue states.
 * Does not write tenant records or decide generation.
 */
import { GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE } from "./pharmacyGenerateNextCampaignAuthority.ts";

export type GrowthPlanLifecycleKind =
  | "blocked"
  | "ready-to-generate"
  | "ready-to-generate-next"
  | "existing-exhausted";

export interface GrowthPlanLifecycleInput {
  prerequisitesReady: boolean;
  selectedServiceId?: string | null;
  selectedServiceName?: string | null;
  selectedServiceHasExistingCampaign: boolean;
  nextServiceId?: string | null;
  nextServiceName?: string | null;
  exhausted?: boolean;
  exhaustedMessage?: string | null;
}

export interface GrowthPlanLifecyclePresentation {
  kind: GrowthPlanLifecycleKind;
  readinessStatus: string;
  readinessNote: string;
  showReadyToGenerate: boolean;
  showInitialPlanApproval: boolean;
  showGenerateNext: boolean;
  generateNextServiceName: string | null;
  exhaustedMessage: string | null;
}

export function resolveGrowthPlanLifecyclePresentation(
  input: GrowthPlanLifecycleInput,
): GrowthPlanLifecyclePresentation {
  const nextServiceId = String(input.nextServiceId || "").trim() || null;
  const nextServiceName = String(input.nextServiceName || "").trim() || null;
  const exhaustedMessage = String(input.exhaustedMessage || "").trim() || GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE;

  if (!input.prerequisitesReady) {
    return {
      kind: "blocked",
      readinessStatus: "",
      readinessNote: "",
      showReadyToGenerate: false,
      showInitialPlanApproval: false,
      showGenerateNext: false,
      generateNextServiceName: null,
      exhaustedMessage: null,
    };
  }

  if (input.selectedServiceHasExistingCampaign && !nextServiceId) {
    return {
      kind: "existing-exhausted",
      readinessStatus: "Campaign generated",
      readinessNote:
        "This campaign has already been generated. There is no next eligible service in the tenant campaign queue.",
      showReadyToGenerate: false,
      showInitialPlanApproval: false,
      showGenerateNext: false,
      generateNextServiceName: null,
      exhaustedMessage,
    };
  }

  if (input.selectedServiceHasExistingCampaign && nextServiceId) {
    const nextLabel = nextServiceName || nextServiceId;
    return {
      kind: "ready-to-generate-next",
      readinessStatus: `Ready to generate ${nextLabel}`,
      readinessNote: `The current campaign already exists. Generate Next Campaign will create ${nextLabel}, not regenerate the existing campaign.`,
      showReadyToGenerate: false,
      showInitialPlanApproval: false,
      showGenerateNext: true,
      generateNextServiceName: nextLabel,
      exhaustedMessage: null,
    };
  }

  return {
    kind: "ready-to-generate",
    readinessStatus: "Ready to Generate",
    readinessNote: "All prerequisites are complete — you can generate this campaign.",
    showReadyToGenerate: true,
    showInitialPlanApproval: true,
    showGenerateNext: Boolean(nextServiceId),
    generateNextServiceName: nextServiceName,
    exhaustedMessage: null,
  };
}
