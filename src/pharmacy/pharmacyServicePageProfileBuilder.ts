/**
 * Build service page presentation profile from canonical profile data.
 */
import { formatOpeningHoursDisplay } from "./pharmacyProfileHours.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { applyBrandDnaToServicePageProfile } from "./pharmacyBrandDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { sanitizeServicePageProfileFields } from "./pharmacyProfileProductionSafety.ts";
import { isDisplayAddressConfirmed } from "./pharmacyBusinessDisplayResolver.ts";
import {
  assertValidGenerationPharmacyIdentity,
  formatUkDisplayPhone,
  resolveCanonicalPharmacyName,
  type PharmacyServicePageProfile,
} from "./pharmacyServicePageProfileContext.ts";
import {
  resolveCommercialLogoUrl,
  resolveSanitizedOpeningHours,
  sanitizeCustomerFacingAddress,
  sanitizeEmailForDisplay,
  sanitizePhoneForDisplay,
  sanitizeVerifiedOpeningHoursText,
} from "./pharmacyBusinessFieldSanitizer.ts";
import { resolvePublicationPharmacyIdentity } from "./pharmacyServicePagePublicationQuality.ts";

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeFullAddress(addressLine1: string, addressLine2: string, postcode: string): string {
  const parts = [addressLine1, addressLine2].filter(Boolean);
  const joined = parts.join(", ");
  const compactPostcode = postcode.replace(/\s+/g, "").toUpperCase();
  const compactJoined = joined.replace(/\s+/g, "").toUpperCase();
  if (postcode && compactPostcode && !compactJoined.includes(compactPostcode)) {
    parts.push(postcode);
  }
  return parts.join(", ");
}

function normalizeOpeningHoursDisplay(hours: string): string {
  return hours.replace(/\s*\|\s*$/g, "").trim();
}

export function buildPharmacyServicePageProfileFromData(
  slug: string,
  data: PharmacyProfileData,
  loaded?: { demoMode?: boolean; trustDataStatus?: string },
): PharmacyServicePageProfile {
  const publicationIdentity = resolvePublicationPharmacyIdentity(data);
  const resolvedPhone = firstNonEmptyString(publicationIdentity.phone, data.phone);
  const resolvedEmail = firstNonEmptyString(data.businessEmail, data.email);
  const resolvedWebsite = firstNonEmptyString(data.website);
  const resolvedLogo = resolveCommercialLogoUrl(data.headerLogoUrl, data.logoUrl, data.footerLogoUrl);
  const resolvedAddressLine1 = firstNonEmptyString(data.addressLine1);
  const resolvedTown = firstNonEmptyString(data.townCity, data.primaryTown);
  const resolvedPostcode = firstNonEmptyString(data.postcode);
  const resolvedOpeningHours = normalizeOpeningHoursDisplay(
    sanitizeVerifiedOpeningHoursText(data.openingHours) ||
      sanitizeVerifiedOpeningHoursText(data.displayOpeningHours) ||
      sanitizeVerifiedOpeningHoursText(formatOpeningHoursDisplay(data)) ||
      "",
  );
  const displayAddress = String(data.displayAddress || "").trim();
  const customerFacingAddress =
    displayAddress && isDisplayAddressConfirmed(data)
      ? displayAddress
      : normalizeFullAddress(resolvedAddressLine1, data.addressLine2 || "", resolvedPostcode);
  const coverageAreas = [...new Set([...(data.rankingAreas || []), ...(data.nearbyAreas || [])])].filter(Boolean);
  const canonicalName = resolveCanonicalPharmacyName(data);
  const pharmacyName = assertValidGenerationPharmacyIdentity(canonicalName.value);

  return (() => {
    const withDna = applyBrandDnaToServicePageProfile(
      sanitizeServicePageProfileFields(
        {
          slug,
          pharmacyName,
          tradingName: pharmacyName,
          logoUrl: resolvedLogo,
          phone: resolvedPhone,
          displayPhone: formatUkDisplayPhone(resolvedPhone),
          email: resolvedEmail,
          website: resolvedWebsite,
          bookingUrl: String(data.bookingUrl || "").trim(),
          primaryCta: data.preferredCta || data.headerCtaText || (data.bookingUrl ? "Book An Appointment" : "Book Consultation"),
          addressLine1: resolvedAddressLine1,
          addressLine2: data.addressLine2 || "",
          town: resolvedTown,
          county: data.county || "",
          postcode: resolvedPostcode,
          fullAddress: normalizeFullAddress(resolvedAddressLine1, data.addressLine2 || "", resolvedPostcode),
          customerFacingAddress,
          displayAddress,
          displayOpeningHours:
            sanitizeVerifiedOpeningHoursText(String(data.displayOpeningHours || "").trim()) || resolvedOpeningHours,
          openingHours: resolvedOpeningHours,
          googleMapsEmbedUrl: data.googleMapsEmbedUrl || "",
          gphcNumber: data.gphcNumber || "",
          gphcPremisesUrl: data.gphcPremisesUrl || "",
          nhsProfileUrl: data.nhsProfileUrl || "",
          superintendentPharmacistName: data.superintendentPharmacistName || data.superintendentName || "",
          companyName: data.companyName || data.pharmacyOwnerName || "",
          coverageAreas: coverageAreas.slice(0, 12),
          coverageRadius: data.coverageRadius || "",
          consultationRoomAvailable: Boolean(data.consultationRoomAvailable),
          nhsServicesAvailable: Boolean(data.nhsServicesAvailable),
          privateServicesAvailable: Boolean(data.privateServicesAvailable),
          independentPharmacy: Boolean(data.independentPharmacy),
          yearsServingCommunity: data.yearsServingCommunity || "",
          brandPrimaryColor: data.brandPrimaryColor || "",
          brandSecondaryColor: data.brandSecondaryColor || "",
          brandCtaColor: data.brandCtaColor || "",
          brandAccentColor: data.brandAccentColor || "",
          brandBackgroundColor: data.brandBackgroundColor || "",
          brandTextColor: data.brandTextColor || "",
          brandMutedTextColor: data.brandMutedTextColor || "",
          brandHeaderBackgroundColor: data.brandHeaderBackgroundColor || "",
          brandHeaderTextColor: data.brandHeaderTextColor || "",
          brandFooterBackgroundColor: data.brandFooterBackgroundColor || "",
          brandFooterTextColor: data.brandFooterTextColor || "",
          brandFooterLinkColor: data.brandFooterLinkColor || "",
          brandFooterAccentColor: data.brandFooterAccentColor || "",
          fontHeading: data.fontHeading || "",
          fontBody: data.fontBody || "",
          buttonRadius: data.buttonRadius || "",
          cardRadius: data.cardRadius || "",
          headerLogoUrl: data.headerLogoUrl || "",
          headerCtaText: data.headerCtaText || "",
          headerCtaUrl: data.headerCtaUrl || "",
          headerNavLinks: [...(data.headerNavLinks || [])],
          footerLogoUrl: data.footerLogoUrl || "",
          footerText: data.footerText || "",
          footerCopyright: data.footerCopyright || "",
          footerCompanyNumber: data.footerCompanyNumber || data.companyRegistrationNumber || "",
          footerPrivacyPolicyUrl: data.footerPrivacyPolicyUrl || "",
          footerCookiePolicyUrl: data.footerCookiePolicyUrl || "",
          footerTermsUrl: data.footerTermsUrl || "",
          footerLinks: [...(data.footerLinks || [])],
          socialFacebook: data.socialFacebook || "",
          socialInstagram: data.socialInstagram || "",
          socialLinkedIn: data.socialLinkedIn || "",
          socialX: data.socialX || "",
          socialYouTube: data.socialYouTube || "",
          reviewerName: data.reviewerName || "",
          reviewerRole: data.reviewerRole || "",
          reviewerQualifications: data.reviewerQualifications || "",
          reviewerProfessionalRegistrations: data.reviewerProfessionalRegistrations || data.reviewerGphcNumber || "",
          reviewerGphcNumber: data.reviewerGphcNumber || "",
          reviewerExperienceYears: data.reviewerExperienceYears || "",
          reviewerBio: data.reviewerBio || "",
          reviewerSpecialisms: [...(data.reviewerSpecialisms || [])].filter(Boolean),
          reviewerSpecialInterests: [...(data.reviewerSpecialInterests || [])].filter(Boolean),
          reviewerClinicalInterests: [...(data.reviewerClinicalInterests || [])].filter(Boolean),
          reviewerPhotoUrl: data.reviewerPhoto || data.reviewerPhotoUrl || "",
          clinicalReviewDate: data.clinicalReviewDate || "",
          nextReviewDate: data.nextReviewDate || "",
          superintendentGphcNumber: data.superintendentGphcNumber || "",
          demoMode: Boolean(loaded?.demoMode || data.demoMode),
          trustDataStatus: String(loaded?.trustDataStatus ?? data.trustDataStatus ?? "").trim(),
        },
        data,
      ),
      resolveBrandDnaForRender(slug),
    );
    const logo = resolveCommercialLogoUrl(withDna.headerLogoUrl, withDna.logoUrl, withDna.footerLogoUrl);
    const hours = resolveSanitizedOpeningHours(withDna, data);
    return {
      ...withDna,
      logoUrl: logo,
      headerLogoUrl: logo,
      footerLogoUrl: logo,
      openingHours: hours,
      displayOpeningHours: hours,
      customerFacingAddress: sanitizeCustomerFacingAddress(withDna, data),
      phone: sanitizePhoneForDisplay(withDna.phone) || withDna.phone,
      email: sanitizeEmailForDisplay(withDna.email) || withDna.email,
    };
  })();
}
