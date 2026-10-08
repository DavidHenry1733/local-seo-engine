/**
 * 10–15 mile drive-time catchment attenuation.
 * Metro Ads volume is the measured regional search pool. Financial projections
 * use only the share of patients inside a realistic travel radius.
 */
import {
  CONSULTATION_CONVERSION_DEFAULT,
  FORECAST_MONTHS,
  SERP_CLICK_SHARE_DEFAULT,
  projectFunnelRevenue,
} from "../pharmacy/revenueCalculator.ts";

/** Share of metro demand inside a 10–15 mile patient-draw polygon. */
export const DRIVE_TIME_RADIUS_PCT = 0.2;
export const DRIVE_TIME_RADIUS_MILES = { min: 10, max: 15 } as const;
export const BREAK_EVEN_CONSULTATIONS_PER_MONTH = 1.2;

export type CatchmentFilterInput = {
  metroVolume: number;
  driveTimeRadiusPct?: number;
  serpClickShare?: number;
  consultationConversion?: number;
  serviceLTV?: number;
  avgCpcGbp?: number | null;
  monthlyAdReplacementValueGbp?: number;
};

export type CatchmentFilterResult = {
  metroVolume: number;
  driveTimeRadiusPct: number;
  localCatchmentDemand: number;
  serpClickShare: number;
  consultationConversion: number;
  catchmentClicks: number;
  projectedBookings: number;
  monthlyGrossRevenueGbp: number;
  annualGrossRevenueGbp: number;
  monthlyAdReplacementValueGbp: number;
  annualAdReplacementValueGbp: number;
};

function finite(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function localCatchmentDemand(
  metroVolume: number,
  driveTimeRadiusPct: number = DRIVE_TIME_RADIUS_PCT,
): number {
  const metro = Math.max(0, finite(metroVolume));
  const pct = Number.isFinite(driveTimeRadiusPct)
    ? Math.min(1, Math.max(0, driveTimeRadiusPct))
    : DRIVE_TIME_RADIUS_PCT;
  return Math.round(metro * pct);
}

export function applyCatchmentFilter(input: CatchmentFilterInput): CatchmentFilterResult {
  const metroVolume = Math.max(0, Math.round(finite(input.metroVolume)));
  const driveTimeRadiusPct = Number.isFinite(input.driveTimeRadiusPct)
    ? Math.min(1, Math.max(0, Number(input.driveTimeRadiusPct)))
    : DRIVE_TIME_RADIUS_PCT;
  const catchmentDemand = localCatchmentDemand(metroVolume, driveTimeRadiusPct);
  const funnel = projectFunnelRevenue({
    localDemand: catchmentDemand,
    serviceLTV: input.serviceLTV ?? 0,
    avgCpcGbp: input.avgCpcGbp,
    monthlyAdReplacementValueGbp:
      input.monthlyAdReplacementValueGbp != null
        ? finite(input.monthlyAdReplacementValueGbp) * driveTimeRadiusPct
        : undefined,
    serpClickShare: input.serpClickShare ?? SERP_CLICK_SHARE_DEFAULT,
    consultationConversion: input.consultationConversion ?? CONSULTATION_CONVERSION_DEFAULT,
  });
  return {
    metroVolume,
    driveTimeRadiusPct,
    localCatchmentDemand: catchmentDemand,
    serpClickShare: funnel.serpClickShare,
    consultationConversion: funnel.consultationConversion,
    catchmentClicks: funnel.organicClicksPerMonth,
    projectedBookings: funnel.capturedMonthlyTraffic,
    monthlyGrossRevenueGbp: funnel.monthlyGrossRevenueGbp,
    annualGrossRevenueGbp: funnel.annualGrossRevenueGbp,
    monthlyAdReplacementValueGbp: funnel.monthlyAdReplacementValueGbp,
    annualAdReplacementValueGbp: funnel.annualAdReplacementValueGbp,
  };
}

export function blendCatchmentLtv(annualGrossRevenueGbp: number, projectedBookings: number): number {
  const monthlyBookings = Math.max(0, finite(projectedBookings));
  if (monthlyBookings <= 0) return 0;
  return Math.round((finite(annualGrossRevenueGbp) / FORECAST_MONTHS / monthlyBookings) * 100) / 100;
}
