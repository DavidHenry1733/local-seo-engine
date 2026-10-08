/**
 * Transparent SERP click-share revenue funnel.
 * Demand is measured DataForSEO volume. Click-share and booking conversion
 * are conservative baselines — never a hidden flat capture rate.
 */
export const FORECAST_MONTHS = 12;

/** Conservative local catchment click share (was 15% industry top-3). */
export const SERP_CLICK_SHARE_DEFAULT = 0.05;
export const SERP_CLICK_SHARE_SLIDER_MIN = 0.03;
export const SERP_CLICK_SHARE_SLIDER_MAX = 0.25;

/** Conservative visitor-to-clinical-booking conversion (was 3.5%). */
export const CONSULTATION_CONVERSION_DEFAULT = 0.015;
export const CONSULTATION_CONVERSION_SLIDER_MIN = 0.01;
export const CONSULTATION_CONVERSION_SLIDER_MAX = 0.08;

/** Industry split of Google clicks: organic vs paid. */
export const ORGANIC_CLICK_SHARE_INDUSTRY = 0.88;
export const PAID_CLICK_SHARE_INDUSTRY = 0.12;

export type RevenueFunnelRates = {
  serpClickShare: number;
  consultationConversion: number;
};

export const DEFAULT_FUNNEL_RATES: RevenueFunnelRates = {
  serpClickShare: SERP_CLICK_SHARE_DEFAULT,
  consultationConversion: CONSULTATION_CONVERSION_DEFAULT,
};

export type FunnelProjection = {
  localDemand: number;
  serpClickShare: number;
  consultationConversion: number;
  effectiveCaptureRate: number;
  organicClicksPerMonth: number;
  capturedMonthlyTraffic: number;
  serviceLTV: number;
  avgCpcGbp: number | null;
  monthlyGrossRevenueGbp: number;
  annualGrossRevenueGbp: number;
  monthlyAdReplacementValueGbp: number;
  annualAdReplacementValueGbp: number;
};

function finite(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundGbp(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampRate(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function parsePercentOrRate(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  const rate = n > 1 ? n / 100 : n;
  return clampRate(rate, min, max);
}

export function effectiveCaptureRate(
  serpClickShare = SERP_CLICK_SHARE_DEFAULT,
  consultationConversion = CONSULTATION_CONVERSION_DEFAULT,
): number {
  return clampRate(serpClickShare, SERP_CLICK_SHARE_SLIDER_MIN, SERP_CLICK_SHARE_SLIDER_MAX)
    * clampRate(consultationConversion, CONSULTATION_CONVERSION_SLIDER_MIN, CONSULTATION_CONVERSION_SLIDER_MAX);
}

/**
 * grossAnnualRevenue = localDemand × serpClickShare × consultationConversion × serviceLTV × 12
 * adReplacementValue = localDemand × serpClickShare × avgCPC × 12
 */
export function projectFunnelRevenue(input: {
  localDemand: number;
  serviceLTV: number;
  avgCpcGbp?: number | null;
  monthlyAdReplacementValueGbp?: number;
  serpClickShare?: number;
  consultationConversion?: number;
}): FunnelProjection {
  const localDemand = Math.max(0, finite(input.localDemand));
  const serviceLTV = Math.max(0, finite(input.serviceLTV));
  const serpClickShare = clampRate(
    input.serpClickShare ?? SERP_CLICK_SHARE_DEFAULT,
    SERP_CLICK_SHARE_SLIDER_MIN,
    SERP_CLICK_SHARE_SLIDER_MAX,
  );
  const consultationConversion = clampRate(
    input.consultationConversion ?? CONSULTATION_CONVERSION_DEFAULT,
    CONSULTATION_CONVERSION_SLIDER_MIN,
    CONSULTATION_CONVERSION_SLIDER_MAX,
  );
  const organicClicksPerMonth = localDemand * serpClickShare;
  const capturedMonthlyTraffic = organicClicksPerMonth * consultationConversion;
  const monthlyGrossRevenueGbp = roundGbp(capturedMonthlyTraffic * serviceLTV);
  const avgFromAds =
    localDemand > 0 && Number.isFinite(input.monthlyAdReplacementValueGbp)
      ? Math.max(0, Number(input.monthlyAdReplacementValueGbp)) / localDemand
      : 0;
  const avgCpcGbp =
    input.avgCpcGbp != null && Number.isFinite(input.avgCpcGbp) ? Math.max(0, input.avgCpcGbp) : avgFromAds || null;
  const monthlyAdReplacementValueGbp = roundGbp(organicClicksPerMonth * (avgCpcGbp ?? 0));
  return {
    localDemand,
    serpClickShare,
    consultationConversion,
    effectiveCaptureRate: serpClickShare * consultationConversion,
    organicClicksPerMonth,
    capturedMonthlyTraffic,
    serviceLTV,
    avgCpcGbp,
    monthlyGrossRevenueGbp,
    annualGrossRevenueGbp: roundGbp(monthlyGrossRevenueGbp * FORECAST_MONTHS),
    monthlyAdReplacementValueGbp,
    annualAdReplacementValueGbp: roundGbp(monthlyAdReplacementValueGbp * FORECAST_MONTHS),
  };
}
