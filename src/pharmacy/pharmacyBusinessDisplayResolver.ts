/**
 * Canonical business facts vs confirmed customer-facing display presentation.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import type { PharmacyProfileData, WebsiteImportSnapshot } from "./pharmacyProfileSchema.ts";
import { resolveSanitizedOpeningHours } from "./pharmacyBusinessFieldSanitizer.ts";

export interface BusinessDetailConflict {
  field: string;
  label: string;
  canonicalValue: string;
  importedValue: string;
  source: string;
  confidence: number;
  difference: string;
  recommendedAction: "keep-canonical" | "use-imported" | "edit-manually";
  material: boolean;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeCompare(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "").trim();
}

export function resolveImportedDisplayAddress(snap: WebsiteImportSnapshot | null | undefined): string {
  const candidate = snap?.intelligence?.business.addressCandidates?.[0];
  if (!candidate) return str(snap?.address);

  const snippet = str(candidate.matchedSnippet);
  const locationMatch = snippet.match(/Our Location\s*\|\s*([^|]+(?:United Kingdom|UK)[^|]*)/i);
  if (locationMatch?.[1]) return locationMatch[1].trim();

  const parts = [
    candidate.addressLine1,
    candidate.town,
    candidate.county,
    candidate.postcode,
    "United Kingdom",
  ].filter(Boolean);
  return parts.join(", ");
}

export function isDisplayAddressConfirmed(data: Partial<PharmacyProfileData>): boolean {
  return Boolean(str(data.displayAddress) && data.profileFieldConfirmations?.displayAddress);
}

export function resolveCustomerFacingAddress(
  profile: PharmacyServicePageProfile,
  data?: Partial<PharmacyProfileData>,
): string {
  const display = str(data?.displayAddress);
  if (display && isDisplayAddressConfirmed(data || {})) return display;
  return profile.fullAddress;
}

export function resolveCustomerFacingOpeningHours(
  profile: PharmacyServicePageProfile,
  data?: Partial<PharmacyProfileData>,
): string {
  return resolveSanitizedOpeningHours(profile, data);
}

export function detectAddressMaterialConflict(
  canonicalDisplay: string,
  importedDisplay: string,
): { material: boolean; difference: string } {
  const canonical = normalizeCompare(canonicalDisplay);
  const imported = normalizeCompare(importedDisplay);
  if (!canonical || !imported) return { material: false, difference: "" };
  if (canonical === imported) return { material: false, difference: "Exact match" };

  const diffs: string[] = [];
  if (!canonical.includes(imported.slice(0, 12)) && !imported.includes(canonical.slice(0, 12))) {
    diffs.push("street number or name differs");
  }
  if (/south yorkshire/i.test(imported) && !/south yorkshire/i.test(canonical)) {
    diffs.push("county omitted in canonical display");
  }
  if (/united kingdom/i.test(imported) && /\buk\b/i.test(canonical) && !/united kingdom/i.test(canonical)) {
    diffs.push("country shortened");
  }
  if (/broom lane/i.test(imported) && /broom ln/i.test(canonical)) {
    diffs.push("street abbreviation differs");
  }
  if (/70a/i.test(imported) && !/70a/i.test(canonical)) {
    diffs.push("street number suffix differs");
  }

  return {
    material: diffs.length > 0 || canonical !== imported,
    difference: diffs.length ? diffs.join("; ") : "Formatting differs",
  };
}

export function buildBusinessDetailConflicts(
  data: PharmacyProfileData,
  websiteSnap: WebsiteImportSnapshot | null | undefined,
): BusinessDetailConflict[] {
  const conflicts: BusinessDetailConflict[] = [];
  const importedAddress = resolveImportedDisplayAddress(websiteSnap);
  const canonicalAddress = [data.addressLine1, data.addressLine2, data.townCity, data.county, data.postcode, data.country]
    .filter(Boolean)
    .join(", ");

  if (importedAddress && !isDisplayAddressConfirmed(data)) {
    const { material, difference } = detectAddressMaterialConflict(canonicalAddress, importedAddress);
    if (material) {
      conflicts.push({
        field: "displayAddress",
        label: "Address presentation",
        canonicalValue: canonicalAddress || str(data.addressLine1),
        importedValue: importedAddress,
        source: websiteSnap?.intelligence?.business.addressCandidates?.[0]?.sourceUrl || websiteSnap?.websiteUrl || "",
        confidence: websiteSnap?.intelligence?.business.addressCandidates?.[0]?.confidence || 0,
        difference,
        recommendedAction: "use-imported",
        material: true,
      });
    }
  }

  const gphcCandidate = (websiteSnap?.regulatoryEvidence || []).find((item) => item.type === "gphc-premises");
  if (gphcCandidate && gphcCandidate.verificationStatus === "customer-confirmation-required") {
    conflicts.push({
      field: "gphcNumber",
      label: "GPhC registration number",
      canonicalValue: str(data.gphcNumber) || "—",
      importedValue: gphcCandidate.detectedValue,
      source: gphcCandidate.sourceUrl,
      confidence: gphcCandidate.confidence ?? 0,
      difference: str(data.gphcNumber) ? "Canonical differs from imported candidate" : "Imported candidate awaiting confirmation",
      recommendedAction: "use-imported",
      material: true,
    });
  }

  return conflicts;
}
