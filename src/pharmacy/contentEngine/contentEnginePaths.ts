/**
 * Content engine output path helpers — no profile loading.
 */
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export function getEcosystemRoot(serviceId: string, slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
}

export function getVisualExperienceRoot(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId);
}

export function getMasterPublishRoot(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-master-publish", slug, serviceId);
}
