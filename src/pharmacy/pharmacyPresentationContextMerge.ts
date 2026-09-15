/**
 * Overlay live confirmed business facts onto frozen campaign generation context.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { PharmacyPresentationProfile } from "./pharmacyPresentationProfileResolver.ts";

export function mergeLivePresentationFactsIntoContext(
  ctx: ContentGenerationContext,
  presentation: PharmacyPresentationProfile,
): ContentGenerationContext {
  const profile = presentation.servicePageProfile;
  return {
    ...ctx,
    profile,
    rawProfile: {
      ...presentation.data,
      pharmacyName: profile.pharmacyName,
      tradingName: String(presentation.data.tradingName || "").trim() || profile.pharmacyName,
    },
    cta: {
      ...ctx.cta,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      bookingUrl: profile.bookingUrl,
      primaryCta: profile.primaryCta,
      headerCtaText: profile.headerCtaText,
      headerCtaUrl: profile.headerCtaUrl,
      openingHours: profile.openingHours,
    },
    map: {
      ...ctx.map,
      googleMapsEmbedUrl: profile.googleMapsEmbedUrl,
      fullAddress: profile.fullAddress,
      resolvedEmbedUrl: ctx.map.resolvedEmbedUrl,
    },
    masterLibrary: ctx.masterLibrary,
    selectedAreas: ctx.selectedAreas,
  };
}
