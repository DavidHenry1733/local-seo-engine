/**
 * Full local hub and cluster pages — locked page-type contracts (not area-page renderer).
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalAreaEvidenceRecord, LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import { renderLocalHubPageHtml } from "./pharmacyLocalHubPageRenderer.ts";
import { renderLocalClusterLocationPageHtml } from "./pharmacyLocalClusterLocationPageRenderer.ts";
import { renderLocalAreaPageHtml } from "./pharmacyLocalAreaPageRenderer.ts";

/** Location hub — local-hub-v1 contract. */
export function renderLocalLocationHubFullPage(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
): string {
  return renderLocalHubPageHtml(ctx, hierarchy);
}

/** Location cluster — local-cluster-v1 contract (Local Content Engine V1). */
export function renderLocalLocationClusterFullPage(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): string {
  return renderLocalClusterLocationPageHtml(ctx, hierarchy, cluster);
}

/** Location area — local-area-v1 contract. */
export function renderLocalLocationAreaFullPage(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  area: LocalAreaEvidenceRecord,
): string {
  return renderLocalAreaPageHtml(ctx, hierarchy, area);
}
