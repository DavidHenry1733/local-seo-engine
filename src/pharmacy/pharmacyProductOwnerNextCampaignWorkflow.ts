/**
 * Product Owner next-campaign workflow.
 * Operator input: tenant slug + intent only.
 * Independently selects the next approved registered-service campaign and
 * calls the existing generation path (campaign builder select, freeze context,
 * mvp-core-pages package, locality hierarchy). Does not accept serviceId,
 * areas, content, or bank fields from the caller.
 */
import { selectCampaignBuilderService } from "./growthEngineCampaignBuilderService.ts";
import {
  buildCustomerCampaignGenerationContext,
  freezeCustomerCampaignGenerationContext,
} from "./contentEngine/customerCampaignGenerationContext.ts";
import { generateContentPackage } from "./pharmacyContentPackageService.ts";
import type { CurrentRunCampaignInventory } from "./pharmacyCurrentRunCampaignHandoff.ts";
import {
  selectNextApprovedRegisteredCampaign,
  type AuthoritativeNextCampaign,
} from "./pharmacyAuthoritativeCampaignProgrammeService.ts";
import {
  GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE,
  GENERATE_NEXT_OVERWRITE_REFUSED,
  refuseGenerateNextOverwriteIfCampaignExists,
} from "./pharmacyGenerateNextCampaignAuthority.ts";
import {
  isRegenerateImprovementsIntent,
  rejectProductOwnerManualFields,
  runProductOwnerRegenerateImprovementsWorkflow,
} from "./pharmacyProductOwnerRegenerateImprovementsWorkflow.ts";

export const PRODUCT_OWNER_NEXT_CAMPAIGN_DEFAULT_INTENT =
  "generate the next approved registered-service campaign";

export interface ProductOwnerNextCampaignInput {
  tenantSlug: string;
  intent: string;
}

export interface ProductOwnerNextCampaignResult {
  ok: boolean;
  error?: string;
  productOwnerInput: ProductOwnerNextCampaignInput;
  selected?: AuthoritativeNextCampaign | null;
  serviceId?: string;
  localCount?: number;
  reviewUrl?: string;
  runId?: string;
  currentRunInventory?: CurrentRunCampaignInventory;
}

function rejectManualFields(body: Record<string, unknown>): string | null {
  return rejectProductOwnerManualFields(body);
}

export async function runProductOwnerNextCampaignWorkflow(
  input: ProductOwnerNextCampaignInput,
  extraBody: Record<string, unknown> = {},
): Promise<ProductOwnerNextCampaignResult> {
  const tenantSlug = String(input.tenantSlug || "").trim();
  const intent = String(input.intent || "").trim();
  const productOwnerInput = { tenantSlug, intent };

  if (!tenantSlug) {
    return { ok: false, error: "tenantSlug is required", productOwnerInput };
  }
  if (!intent) {
    return { ok: false, error: "intent is required", productOwnerInput };
  }

  const manual = rejectManualFields(extraBody);
  if (manual) {
    return { ok: false, error: manual, productOwnerInput };
  }

  if (isRegenerateImprovementsIntent(intent)) {
    return runProductOwnerRegenerateImprovementsWorkflow({ tenantSlug, intent }, extraBody);
  }

  const selected = selectNextApprovedRegisteredCampaign(tenantSlug);
  if (!selected) {
    return {
      ok: false,
      error: GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE,
      productOwnerInput,
      selected,
    };
  }

  const overwriteGuard = refuseGenerateNextOverwriteIfCampaignExists(tenantSlug, selected.serviceId);
  if (!overwriteGuard.ok) {
    return {
      ok: false,
      error: overwriteGuard.error || GENERATE_NEXT_OVERWRITE_REFUSED,
      productOwnerInput,
      selected,
      serviceId: selected.serviceId,
    };
  }

  if (selected.serviceId === "flu-vaccinations" || selected.serviceId === "travel-vaccinations") {
    return {
      ok: false,
      error: "Refusing to regenerate Flu or Travel from Generate Next Campaign",
      productOwnerInput,
      selected,
    };
  }

  const serviceId = selected.serviceId;
  selectCampaignBuilderService(tenantSlug, serviceId);
  const customerContext = buildCustomerCampaignGenerationContext(tenantSlug, serviceId);
  freezeCustomerCampaignGenerationContext(customerContext);
  const pkg = await generateContentPackage(tenantSlug, serviceId, {
    customerContext,
    scope: "mvp-core-pages",
    protectExistingCampaign: true,
  });
  if (!pkg.ok) {
    return {
      ok: false,
      error: pkg.error || "Content package generation failed",
      productOwnerInput,
      selected,
      serviceId,
      currentRunInventory: pkg.currentRunInventory,
      runId: pkg.currentRunInventory?.runId,
    };
  }

  const inventory = pkg.currentRunInventory;
  return {
    ok: true,
    productOwnerInput,
    selected,
    serviceId,
    localCount: inventory?.localityPagePaths.length || 0,
    runId: inventory?.runId,
    currentRunInventory: inventory,
    reviewUrl: `/api/growth-engine/review-centre?slug=${encodeURIComponent(tenantSlug)}&campaign=${encodeURIComponent(serviceId)}`,
  };
}
