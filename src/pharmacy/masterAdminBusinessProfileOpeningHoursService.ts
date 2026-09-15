/**
 * Map imported Google / website opening hours onto the canonical Mon–Sun table.
 * Does not call Google Places. Reads already-imported evidence only.
 */
import {
  syncOpeningHoursSummary,
  type OpeningHourDayKey,
} from "./pharmacyProfileHours.ts";
import { normOpeningHours, normText } from "./masterAdminBusinessProfileReviewLogic.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type WeekdayLabel = (typeof WEEKDAY_LABELS)[number];
export type WeekdayId = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface WeeklyOpeningHoursDay {
  day: WeekdayLabel;
  hours: string;
}

export type WeeklyHoursSource = "google" | "website" | "conflict" | "none";

export interface WeeklyOpeningHoursEvidence {
  source: WeeklyHoursSource;
  sourceBadge: string;
  days: WeeklyOpeningHoursDay[];
  googleDays: WeeklyOpeningHoursDay[] | null;
  websiteDays: WeeklyOpeningHoursDay[] | null;
  googleSummary: string | null;
  websiteSummary: string | null;
  recommendedSummary: string | null;
  googleReliable: boolean;
  websiteReliable: boolean;
}

const WEEKDAY_IDS: WeekdayId[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_ALIAS: Record<string, WeekdayId> = {
  monday: "monday",
  mon: "monday",
  tuesday: "tuesday",
  tue: "tuesday",
  tues: "tuesday",
  wednesday: "wednesday",
  wed: "wednesday",
  thursday: "thursday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  friday: "friday",
  fri: "friday",
  saturday: "saturday",
  sat: "saturday",
  sunday: "sunday",
  sun: "sunday",
};

const DAY_LABEL: Record<WeekdayId, WeekdayLabel> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const PROFILE_DAY_KEY: Record<WeekdayId, OpeningHourDayKey> = {
  monday: "openingHoursMonday",
  tuesday: "openingHoursTuesday",
  wednesday: "openingHoursWednesday",
  thursday: "openingHoursThursday",
  friday: "openingHoursFriday",
  saturday: "openingHoursSaturday",
  sunday: "openingHoursSunday",
};

const DAY_TOKEN_RE = "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun";

function emptyWeek(): Record<WeekdayId, string> {
  return {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  };
}

function closedToken(raw: string): boolean {
  return /^(closed|closed all day|closed today)$/i.test(normText(raw).replace(/\.$/, ""));
}

function normalizePeriodText(raw: string): string {
  const text = normText(raw).replace(/\u2013|\u2014|–|—/g, "–");
  if (!text) return "";
  if (closedToken(text)) return "Closed";
  return text.replace(/\s*–\s*/g, " – ");
}

function appendPeriod(existing: string, next: string): string {
  const period = normalizePeriodText(next);
  if (!period) return existing;
  if (!existing) return period;
  if (existing === "Closed") return period;
  if (period === "Closed") return existing;
  if (existing.split("; ").includes(period)) return existing;
  return `${existing}; ${period}`;
}

function weekFromLines(lines: string[]): Record<WeekdayId, string> {
  const week = emptyWeek();
  const blob = lines.map((line) => String(line || "").trim()).filter(Boolean).join("\n");
  if (!blob) return week;
  const pattern = new RegExp(`\\b(${DAY_TOKEN_RE})\\b\\s*[:\\-]\\s*([^\\n]+)`, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(blob))) {
    const day = DAY_ALIAS[String(match[1] || "").toLowerCase()];
    if (!day) continue;
    let rest = String(match[2] || "");
    const nextDay = new RegExp(`\\s*,\\s*(?:${DAY_TOKEN_RE})\\b`, "i").exec(rest);
    if (nextDay?.index != null) rest = rest.slice(0, nextDay.index);
    rest = rest.replace(/\s*;\s*$/, "").trim();
    for (const part of rest.split(/\s*;\s*|\s*,\s*(?=\d)/).map((p) => p.trim()).filter(Boolean)) {
      week[day] = appendPeriod(week[day], part);
    }
  }
  return week;
}

function clockLabel(hour: unknown, minute: unknown): string {
  const h = Number(hour);
  const m = Number(minute) || 0;
  if (!Number.isFinite(h) || h < 0 || h > 23) return "";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function weekFromPeriods(periods: unknown): Record<WeekdayId, string> {
  const week = emptyWeek();
  if (!Array.isArray(periods)) return week;
  const googleDay: WeekdayId[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let sawPeriod = false;
  for (const row of periods) {
    if (!row || typeof row !== "object") continue;
    const open = (row as { open?: Record<string, unknown> }).open;
    const close = (row as { close?: Record<string, unknown> }).close;
    if (!open) continue;
    const day = googleDay[Number(open.day)] || googleDay[0]!;
    const openLabel = clockLabel(open.hour, open.minute);
    if (!openLabel) continue;
    sawPeriod = true;
    const closeLabel = close ? clockLabel(close.hour, close.minute) : "";
    week[day] = appendPeriod(week[day], closeLabel ? `${openLabel} – ${closeLabel}` : openLabel);
  }
  if (!sawPeriod) return emptyWeek();
  for (const day of WEEKDAY_IDS) {
    if (!week[day]) week[day] = "Closed";
  }
  return week;
}

function populatedCount(week: Record<WeekdayId, string>): number {
  return WEEKDAY_IDS.filter((day) => Boolean(week[day])).length;
}

function isReliableWeek(week: Record<WeekdayId, string>): boolean {
  return populatedCount(week) > 0;
}

function weeksMatch(a: Record<WeekdayId, string>, b: Record<WeekdayId, string>): boolean {
  return WEEKDAY_IDS.every((day) => {
    const left = a[day];
    const right = b[day];
    if (!left && !right) return true;
    if (!left || !right) return closedToken(left || right);
    return normOpeningHours(left) === normOpeningHours(right);
  });
}

function toDays(week: Record<WeekdayId, string>, fillBlank = ""): WeeklyOpeningHoursDay[] {
  return WEEKDAY_IDS.map((id) => ({
    day: DAY_LABEL[id],
    hours: week[id] || fillBlank,
  }));
}

export function formatWeeklyHoursSummary(week: Record<WeekdayId, string> | WeeklyOpeningHoursDay[]): string {
  const days: WeeklyOpeningHoursDay[] = Array.isArray(week)
    ? week
    : toDays(week);
  return days
    .filter((row) => row.hours)
    .map((row) => `${row.day}: ${row.hours}`)
    .join("; ");
}

function asStringList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") return asStringList(item);
      return item != null ? [String(item)] : [];
    }).filter(Boolean);
  }
  if (typeof raw === "string") return [raw];
  if (typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.weekdayDescriptions) || Array.isArray(rec.periods)) return [];
    if (typeof rec.selected === "string") return [rec.selected];
  }
  return [];
}

export function parseImportedWeeklyHours(raw: unknown): Record<WeekdayId, string> {
  if (!raw) return emptyWeek();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const fromDesc = weekFromLines(asStringList(rec.weekdayDescriptions));
    if (isReliableWeek(fromDesc)) return fromDesc;
    const fromPeriods = weekFromPeriods(rec.periods);
    if (isReliableWeek(fromPeriods)) return fromPeriods;
    if (typeof rec.selected === "string") return weekFromLines([rec.selected]);
  }
  const fromLines = weekFromLines(asStringList(raw));
  if (isReliableWeek(fromLines)) return fromLines;
  return emptyWeek();
}

function weekFromProfileDays(days?: Partial<Record<OpeningHourDayKey, string>> | null): Record<WeekdayId, string> {
  const week = emptyWeek();
  if (!days) return week;
  for (const id of WEEKDAY_IDS) {
    week[id] = normalizePeriodText(String(days[PROFILE_DAY_KEY[id]] || ""));
  }
  return week;
}

export function resolveBusinessProfileWeeklyHours(input: {
  googleIntelOpeningHours?: unknown;
  googleSnapshotOpeningHours?: unknown;
  websiteSnapshotOpeningHours?: unknown;
  websiteIntelligenceOpeningHours?: unknown;
  websiteDayHours?: Partial<Record<OpeningHourDayKey, string>> | null;
}): WeeklyOpeningHoursEvidence {
  const googleWeekCandidates = [
    parseImportedWeeklyHours(input.googleSnapshotOpeningHours),
    parseImportedWeeklyHours(input.googleIntelOpeningHours),
  ];
  const googleWeek = googleWeekCandidates.reduce(
    (best, next) => (populatedCount(next) > populatedCount(best) ? next : best),
    emptyWeek(),
  );
  const websiteWeekCandidates = [
    parseImportedWeeklyHours(input.websiteIntelligenceOpeningHours),
    parseImportedWeeklyHours(input.websiteSnapshotOpeningHours),
    weekFromProfileDays(input.websiteDayHours),
  ];
  const websiteWeek = websiteWeekCandidates.reduce(
    (best, next) => (populatedCount(next) > populatedCount(best) ? next : best),
    emptyWeek(),
  );

  const googleReliable = isReliableWeek(googleWeek);
  const websiteReliable = isReliableWeek(websiteWeek);
  const googleDays = googleReliable ? toDays(googleWeek) : null;
  const websiteDays = websiteReliable ? toDays(websiteWeek) : null;
  const googleSummary = googleReliable ? formatWeeklyHoursSummary(googleWeek) : null;
  const websiteSummary = websiteReliable ? formatWeeklyHoursSummary(websiteWeek) : null;

  if (googleReliable && websiteReliable && !weeksMatch(googleWeek, websiteWeek)) {
    return {
      source: "conflict",
      sourceBadge: "Imported from Google",
      days: toDays(googleWeek),
      googleDays,
      websiteDays,
      googleSummary,
      websiteSummary,
      recommendedSummary: googleSummary,
      googleReliable,
      websiteReliable,
    };
  }
  if (googleReliable) {
    return {
      source: "google",
      sourceBadge: "Imported from Google",
      days: toDays(googleWeek),
      googleDays,
      websiteDays,
      googleSummary,
      websiteSummary,
      recommendedSummary: googleSummary,
      googleReliable,
      websiteReliable,
    };
  }
  if (websiteReliable) {
    return {
      source: "website",
      sourceBadge: "Imported from website",
      days: toDays(websiteWeek),
      googleDays,
      websiteDays,
      googleSummary,
      websiteSummary,
      recommendedSummary: websiteSummary,
      googleReliable,
      websiteReliable,
    };
  }
  return {
    source: "none",
    sourceBadge: "",
    days: toDays(emptyWeek()),
    googleDays: null,
    websiteDays: null,
    googleSummary: null,
    websiteSummary: null,
    recommendedSummary: null,
    googleReliable: false,
    websiteReliable: false,
  };
}

export function weeklyDaysToProfilePatch(days: WeeklyOpeningHoursDay[]): Partial<PharmacyProfileData> {
  const patch: Partial<PharmacyProfileData> = {};
  for (const row of days) {
    const id = DAY_ALIAS[row.day.toLowerCase()];
    if (!id) continue;
    (patch as Record<string, string>)[PROFILE_DAY_KEY[id]] = normalizePeriodText(row.hours);
  }
  patch.openingHours = syncOpeningHoursSummary(patch) || formatWeeklyHoursSummary(days);
  patch.displayOpeningHours = patch.openingHours;
  return patch;
}

export function chosenWeeklyDays(
  evidence: WeeklyOpeningHoursEvidence,
  action: string,
  finalValue?: string,
): WeeklyOpeningHoursDay[] {
  if (action === "use_website" && evidence.websiteDays) return evidence.websiteDays;
  if (action === "use_google" && evidence.googleDays) return evidence.googleDays;
  if (action === "manual") {
    const parsed = parseImportedWeeklyHours(finalValue);
    if (isReliableWeek(parsed)) return toDays(parsed);
  }
  if (evidence.days.some((row) => row.hours)) return evidence.days;
  const parsed = parseImportedWeeklyHours(finalValue);
  return toDays(parsed);
}
