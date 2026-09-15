/**
 * Local Market Report — branch/location requirement for multi-branch pharmacy profiles.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

export const LOCAL_MARKET_BRANCH_REQUIRED_MESSAGE =
  "Select a branch/location to run Local Market Report.";

function parseCoord(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** True when profile has enough branch context for Google Places competitor discovery. */
export function profileHasBranchLocation(
  data: Pick<
    PharmacyProfileData,
    "latitude" | "longitude" | "postcode" | "addressLine1" | "townCity" | "primaryTown"
  >,
): boolean {
  const lat = parseCoord(data.latitude);
  const lng = parseCoord(data.longitude);
  if (lat != null && lng != null) return true;
  const hasPostcode = String(data.postcode || "").trim().length >= 5;
  const hasAddress = String(data.addressLine1 || "").trim().length > 0;
  const hasTown = String(data.townCity || data.primaryTown || "").trim().length > 0;
  return hasPostcode && hasAddress && hasTown;
}

export function branchLocationRequiredError() {
  return {
    code: "branch-location-required" as const,
    message: LOCAL_MARKET_BRANCH_REQUIRED_MESSAGE,
  };
}

export function missingLocalMarketFields(
  data: Pick<
    PharmacyProfileData,
    "latitude" | "longitude" | "postcode" | "addressLine1" | "townCity" | "googlePlaceId"
  >,
): string[] {
  const missing: string[] = [];
  if (!parseCoord(data.latitude) || !parseCoord(data.longitude)) missing.push("Branch latitude & longitude");
  if (!String(data.postcode || "").trim()) missing.push("Branch postcode");
  if (!String(data.addressLine1 || "").trim()) missing.push("Branch street address");
  if (!String(data.townCity || "").trim()) missing.push("Branch town/city");
  if (!String(data.googlePlaceId || "").trim()) missing.push("Google Place ID (optional but recommended)");
  return missing;
}
