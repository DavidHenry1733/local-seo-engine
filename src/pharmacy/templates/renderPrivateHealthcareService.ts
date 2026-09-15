import {
  renderPharmacyFamilyHub,
  renderPharmacyFamilyCluster,
  type FamilyRendererContext,
} from "./pharmacyTemplateCore.ts";

export type PrivateHealthcareRenderContext = FamilyRendererContext;

export function renderPrivateHealthcareHubPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyHub(ctx);
}

export function renderPrivateHealthcareClusterPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyCluster(ctx);
}
