/**
 * Opening hours — structured weekday rows for footer and contact components.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { OPENING_HOUR_DAYS } from "./pharmacyProfileHours.ts";

export interface OpeningHoursRow {
  label: string;
  hours: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeHoursLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

function expandDayRange(start: string, end: string): string[] {
  const startIdx = WEEKDAYS.findIndex((d) => d.toLowerCase() === start.toLowerCase());
  const endIdx = WEEKDAYS.findIndex((d) => d.toLowerCase() === end.toLowerCase());
  if (startIdx < 0 || endIdx < 0) return [];
  if (startIdx <= endIdx) return WEEKDAYS.slice(startIdx, endIdx + 1);
  return [...WEEKDAYS.slice(startIdx), ...WEEKDAYS.slice(0, endIdx + 1)];
}

function setRow(rows: Map<string, string>, day: string, hours: string): void {
  const key = day.toLowerCase();
  if (!WEEKDAYS.some((d) => d.toLowerCase() === key)) return;
  rows.set(key, normalizeHoursLabel(hours));
}

function parseSegment(segment: string, rows: Map<string, string>): void {
  const text = normalizeHoursLabel(segment);
  if (!text) return;

  const rangeMatch = text.match(/^([A-Za-z]+)\s+to\s+([A-Za-z]+)\s*:\s*(.+)$/i);
  if (rangeMatch) {
    for (const day of expandDayRange(rangeMatch[1], rangeMatch[2])) {
      setRow(rows, day, rangeMatch[3]);
    }
    return;
  }

  const multiDayMatch = text.match(/^([A-Za-z]+)\s*&\s*([A-Za-z]+)\s*:\s*(.+)$/i);
  if (multiDayMatch) {
    setRow(rows, multiDayMatch[1], multiDayMatch[3]);
    setRow(rows, multiDayMatch[2], multiDayMatch[3]);
    return;
  }

  const singleMatch = text.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
  if (singleMatch) {
    setRow(rows, singleMatch[1], singleMatch[2]);
  }
}

/** Build weekday rows from profile per-day fields or combined openingHours string. */
export function resolveOpeningHoursRows(profile: PharmacyServicePageProfile): OpeningHoursRow[] {
  const rows = new Map<string, string>();
  const profileRecord = profile as PharmacyServicePageProfile & Record<string, unknown>;

  for (const { key, label } of OPENING_HOUR_DAYS) {
    const value = str(profileRecord[key]);
    if (value) rows.set(label.toLowerCase(), value);
  }

  if (!rows.size) {
    const combined = str(profile.openingHours).replace(/\s*\|\s*$/g, "");
    for (const segment of combined.split("|")) {
      parseSegment(segment, rows);
    }
  }

  return WEEKDAYS.map((label) => ({
    label,
    hours: rows.get(label.toLowerCase()) || "Closed",
  }));
}
