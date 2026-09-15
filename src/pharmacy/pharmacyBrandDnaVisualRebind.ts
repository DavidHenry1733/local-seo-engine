/**
 * @deprecated Sprint 5H.5 — HTML rebind pipeline retired.
 * Use renderVisualServicePageHtml() or buildVisualExperiencePage() instead.
 */
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";

export interface RebindBrandDnaResult {
  ok: boolean;
  htmlPath: string;
  brandDnaApplied: boolean;
}

export function rebindVisualExperienceBrandDna(
  _slug: string,
  _serviceId: VisualExperienceServiceId,
): RebindBrandDnaResult {
  throw new Error(
    "rebindVisualExperienceBrandDna is retired. Use renderVisualServicePageHtml() or buildVisualExperiencePage() for single-pass rendering.",
  );
}
