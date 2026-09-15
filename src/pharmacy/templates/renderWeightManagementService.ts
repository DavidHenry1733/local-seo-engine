import {
  renderPharmacyFamilyHub,
  renderPharmacyFamilyCluster,
  type FamilyRendererContext,
} from "./pharmacyTemplateCore.ts";

export type WeightManagementRenderContext = FamilyRendererContext;

export function renderWeightManagementHubPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyHub(ctx);
}

export function renderWeightManagementClusterPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyCluster(ctx);
}
