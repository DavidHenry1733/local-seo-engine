import {
  renderPharmacyFamilyHub,
  renderPharmacyFamilyCluster,
  type FamilyRendererContext,
} from "./pharmacyTemplateCore.ts";

export type VaccinationRenderContext = FamilyRendererContext;

export function renderVaccinationHubPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyHub(ctx);
}

export function renderVaccinationClusterPage(ctx: FamilyRendererContext): string {
  return renderPharmacyFamilyCluster(ctx);
}
