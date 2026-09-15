/**
 * Compare Website Import evidence with canonical Business Profile — no silent overwrite.
 */
import type { BrandProfile } from "../generator/brandImporter.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import type { BrandDnaConflict, BrandDnaNavCta } from "./pharmacyBrandDnaSemanticTypes.ts";
import type { NavLink } from "../generator/brandImporter.ts";
import { isValidConfirmedNavUrl } from "./pharmacyBrandDnaConfirmedNavigation.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normPhone(v: string): string {
  return v.replace(/\D/g, "").slice(-11);
}

function pushConflict(
  out: BrandDnaConflict[],
  field: string,
  businessProfileValue: string,
  websiteEvidenceValue: string,
  requiresCustomerConfirmation = true,
): void {
  if (!businessProfileValue || !websiteEvidenceValue) return;
  if (businessProfileValue === websiteEvidenceValue) return;
  out.push({
    field,
    businessProfileValue,
    websiteEvidenceValue,
    resolution: "business-profile-wins",
    requiresCustomerConfirmation,
  });
}

export function detectBrandDnaConflicts(
  profile: PharmacyProfileData,
  brand: Partial<BrandProfile>,
  confirmedNav: NavLink[],
  primaryCta?: BrandDnaNavCta,
  secondaryCta?: BrandDnaNavCta,
): BrandDnaConflict[] {
  const out: BrandDnaConflict[] = [];
  const brandPhone = str(brand.contact?.phone);
  const profilePhone = str(profile.phone);
  if (brandPhone && profilePhone && normPhone(brandPhone) !== normPhone(profilePhone)) {
    pushConflict(out, "phone", profilePhone, brandPhone);
  }

  const brandAddress = [str(brand.contact?.address), str(brand.contact?.postcode)].filter(Boolean).join(", ");
  const profileAddress = str(profile.fullAddress) || [str(profile.addressLine1), str(profile.postcode)].filter(Boolean).join(", ");
  pushConflict(out, "address", profileAddress, brandAddress);

  pushConflict(out, "pharmacyName", str(profile.pharmacyName), str(brand.businessName), false);

  const brandHours = str(brand.contact?.openingHours);
  const profileHours = str(profile.openingHours);
  pushConflict(out, "openingHours", profileHours, brandHours);

  if (primaryCta?.href && str(profile.headerCtaUrl) && primaryCta.href !== str(profile.headerCtaUrl)) {
    pushConflict(out, "appointmentUrl", str(profile.headerCtaUrl), primaryCta.href);
  }

  for (const link of confirmedNav) {
    if (!isValidConfirmedNavUrl(str(link.href))) {
      out.push({
        field: `navigation.${link.label}`,
        businessProfileValue: "valid-url-required",
        websiteEvidenceValue: str(link.href),
        resolution: "business-profile-wins",
        requiresCustomerConfirmation: true,
      });
    }
  }

  if (secondaryCta?.href) {
    pushConflict(out, "nominationUrl", "", secondaryCta.href, false);
  }

  pushConflict(out, "gphcPremisesNumber", str(profile.gphcNumber), "");

  return out;
}
