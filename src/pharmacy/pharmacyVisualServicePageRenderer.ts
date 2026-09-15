/**
 * Unified visual service page renderer — single pipeline for all benchmark services.
 */
import type { PharmacyImageRenderContext } from "./templates/pharmacyImageLibrary.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { buildPharmacyServicePageMainHtml } from "./pharmacyVisualExperienceLayoutV3.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyThemeEngine.ts";
import { resolveServicePageTemplateId, hasActivatedTenantDesignDna } from "./pharmacyTenantDnaRenderActivation.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { resolveSiteChromeColourTokens, siteChromeColourCssVariables } from "./pharmacySiteChromeColourService.ts";

export { PHARMACY_VISUAL_PIPELINE_VERSION };

/** One main-html builder for every visual service page (including pharmacy-first). */
export function buildVisualServicePageMainHtml(
  sourceHtml: string,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
): string {
  return buildPharmacyServicePageMainHtml(sourceHtml, ctx, profile, contentContext);
}

export function visualServicePageBodyAttributes(serviceId: string, slug?: string): string {
  const template = slug ? resolveServicePageTemplateId(slug) : "lockdown-v1";
  const attrs = `data-pharmacy-template="${template}" data-pharmacy-service="${serviceId}" data-pipeline-version="${PHARMACY_VISUAL_PIPELINE_VERSION}"`;
  if (slug && hasActivatedTenantDesignDna(slug)) {
    const brand = resolveBrandDnaForRender(slug);
    const tokens = resolveSiteChromeColourTokens(slug, brand);
    return `${attrs} style="${siteChromeColourCssVariables(tokens)}"`;
  }
  return attrs;
}
