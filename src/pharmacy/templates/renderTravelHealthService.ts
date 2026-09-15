import {
  renderPharmacyFamilyHub,
  renderPharmacyFamilyCluster,
  type FamilyRendererContext,
} from "./pharmacyTemplateCore.ts";

export type TravelHealthRenderContext = FamilyRendererContext;

export function renderTravelHealthHubPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyHub(ctx);
}

export function renderTravelHealthClusterPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyCluster(ctx);
}
