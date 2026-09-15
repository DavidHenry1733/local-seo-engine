/**
 * Pharmacy opening hours — per-day fields with page display formatting.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

export const OPENING_HOUR_DAYS = [
  { key: "openingHoursMonday", label: "Monday" },
  { key: "openingHoursTuesday", label: "Tuesday" },
  { key: "openingHoursWednesday", label: "Wednesday" },
  { key: "openingHoursThursday", label: "Thursday" },
  { key: "openingHoursFriday", label: "Friday" },
  { key: "openingHoursSaturday", label: "Saturday" },
  { key: "openingHoursSunday", label: "Sunday" },
] as const;

export type OpeningHourDayKey = (typeof OPENING_HOUR_DAYS)[number]["key"];

export function getDayHours(data: Partial<PharmacyProfileData>, key: OpeningHourDayKey): string {
  return String(data[key] ?? "").trim();
}

/** Build summary string from per-day fields for legacy openingHours consumers. */
export function syncOpeningHoursSummary(data: Partial<PharmacyProfileData>): string {
  const parts = OPENING_HOUR_DAYS.map(({ key, label }) => {
    const value = getDayHours(data, key);
    return value ? `${label}: ${value}` : "";
  }).filter(Boolean);

  if (parts.length) return parts.join("; ");
  return String(data.openingHours ?? "").trim();
}

/** Format hours exactly as shown on service pages. */
export function formatOpeningHoursDisplay(data: Partial<PharmacyProfileData>): string {
  const dayLines = OPENING_HOUR_DAYS.map(({ key, label }) => {
    const value = getDayHours(data, key);
    return value ? `${label}: ${value}` : "";
  }).filter(Boolean);

  if (dayLines.length) return dayLines.join(" · ");
  return String(data.openingHours ?? "").trim();
}

export function hasOpeningHours(data: Partial<PharmacyProfileData>): boolean {
  return OPENING_HOUR_DAYS.some(({ key }) => Boolean(getDayHours(data, key))) || Boolean(String(data.openingHours ?? "").trim());
}
