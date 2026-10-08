import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, authUrl } from "@/lib/api";

export type OpportunityForecastPayload = {
  ok?: boolean;
  error?: string;
  pharmacyName?: string;
  locationName?: string;
  capturedAt?: string;
  cached?: boolean;
  summary?: {
    totalMonthlySearchDemand?: number;
    annualAdReplacementValueGbp?: number;
    projectedMonthlyRevenueGbp?: number;
    projectedAnnualRevenueIncreaseGbp?: number;
    captureRate?: number;
    serpClickShare?: number;
    consultationConversion?: number;
  };
  services?: Array<{
    serviceId: string;
    label: string;
    opportunity?: {
      monthlySearchDemand?: number;
      averageCpcGbp?: number | null;
      monthlyAdReplacementValueGbp?: number;
      keywords?: Array<{
        keyword: string;
        searchVolume: number | null;
        cpcGbp: number | null;
        competition: string | null;
      }>;
    };
    projection?: {
      annualGrossRevenueGbp?: number;
      monthlyGrossRevenueGbp?: number;
      capturedMonthlyTraffic?: number;
      organicClicksPerMonth?: number;
      unitEconomics?: { revenuePerCaptureGbp?: number };
    };
  }>;
};

const SERP_SHARE_DEFAULT = 5;
const CONVERSION_DEFAULT = 1.5;
const WEIGHT_LOSS_LTV = 720;
const TRAVEL_LTV = 120;
const PHARMACY_FIRST_LTV = 25;

function gbp(value?: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: digits,
  }).format(value);
}

function count(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function catalogLtv(serviceId: string, revenuePerCaptureGbp?: number): number {
  if (revenuePerCaptureGbp != null && Number.isFinite(revenuePerCaptureGbp)) return revenuePerCaptureGbp;
  if (serviceId === "weight-loss") return WEIGHT_LOSS_LTV;
  if (serviceId === "travel-vaccinations") return TRAVEL_LTV;
  if (serviceId === "pharmacy-first") return PHARMACY_FIRST_LTV;
  return 0;
}

function projectLive(forecast: OpportunityForecastPayload, serpSharePct: number, conversionPct: number) {
  const serp = serpSharePct / 100;
  const conversion = conversionPct / 100;
  const rows = (forecast.services || []).map((service) => {
    const demand = service.opportunity?.monthlySearchDemand || 0;
    const ltv = catalogLtv(service.serviceId, service.projection?.unitEconomics?.revenuePerCaptureGbp);
    const organicClicks = demand * serp;
    const bookings = organicClicks * conversion;
    const monthly = bookings * ltv;
    return {
      id: service.serviceId,
      label: service.label,
      demand,
      organicClicks,
      bookings,
      monthly,
      annual: monthly * 12,
    };
  });
  return {
    rows,
    monthly: rows.reduce((sum, row) => sum + row.monthly, 0),
    annual: rows.reduce((sum, row) => sum + row.annual, 0),
    bookings: rows.reduce((sum, row) => sum + row.bookings, 0),
  };
}

function HeadlineStat({
  label,
  value,
  period,
  subtitle,
}: {
  label: string;
  value: string;
  period?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <span className="text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</span>
        {period ? <span className="text-sm font-semibold text-slate-400">{period}</span> : null}
      </div>
      {subtitle ? <p className="mt-2 text-xs leading-relaxed text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function PatientJourney({
  locationName,
  demand,
  clicks,
  bookings,
  monthly,
  annual,
  sharePct,
  conversionPct,
}: {
  locationName: string;
  demand: number;
  clicks: number;
  bookings: number;
  monthly: number;
  annual: number;
  sharePct: number;
  conversionPct: number;
}) {
  const stages = [
    {
      step: "Stage 1",
      title: "Local demand",
      figure: count(demand),
      copy: `${locationName} residents searching each month for the clinical services you already provide.`,
    },
    {
      step: "Stage 2",
      title: "Local catchment clicks",
      figure: `~${count(Math.round(clicks))}`,
      copy: `local patients visit your dedicated neighbourhood pages (${sharePct}% local market share).`,
    },
    {
      step: "Stage 3",
      title: "Booked appointments",
      figure: `~${count(Math.round(bookings))}`,
      copy: `new private patient consultations booked per month (${conversionPct.toFixed(1)}% booking rate).`,
    },
    {
      step: "Stage 4",
      title: "Clinical revenue",
      figure: `${gbp(monthly)} / month`,
      copy: `${gbp(annual)} a year, based on typical UK clinical fees such as a £120 travel vaccine course.`,
    },
  ];
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold text-slate-100">How local patients become bookings</h4>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => (
          <article key={stage.step} className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">{stage.step}</div>
            <h5 className="mt-1 text-sm font-semibold text-white">{stage.title}</h5>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{stage.figure}</div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{stage.copy}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function WhyCatchmentsBeatAds({ locationName, pageCount }: { locationName: string; pageCount: number }) {
  const pages =
    pageCount > 0
      ? `your ${count(pageCount)} ${locationName} catchment pages continue generating patient bookings year-round`
      : `your dedicated ${locationName} catchment pages continue generating patient bookings year-round`;
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold text-slate-100">Why local catchments beat paid ads</h4>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">88% patient preference</div>
          <h5 className="mt-1 text-sm font-semibold text-white">Patients choose trusted local pharmacies</h5>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            88% of patients bypass sponsored ads to choose trusted local pharmacies on Google Maps and organic listings.
          </p>
        </article>
        <article className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300">Permanent digital asset</div>
          <h5 className="mt-1 text-sm font-semibold text-white">Pages keep working after you stop paying</h5>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Unlike Google Ads, which stop the moment you stop paying, {pages}.
          </p>
        </article>
      </div>
    </div>
  );
}

function ForecastCalculator({
  forecast,
  serpSharePct,
  conversionPct,
  onSerpSharePct,
  onConversionPct,
}: {
  forecast: OpportunityForecastPayload;
  serpSharePct: number;
  conversionPct: number;
  onSerpSharePct: (value: number) => void;
  onConversionPct: (value: number) => void;
}) {
  const adjusted = useMemo(
    () => projectLive(forecast, serpSharePct, conversionPct),
    [forecast, serpSharePct, conversionPct],
  );

  return (
    <div className="mt-5 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4">
      <h4 className="text-sm font-semibold text-indigo-100">Adjust the patient journey</h4>
      <p className="mt-1 text-xs text-slate-500">
        See how a larger local share or a higher booking rate changes the income your neighbourhood pages can generate.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Local market share
          <input
            type="range"
            min={3}
            max={25}
            step={1}
            value={serpSharePct}
            onChange={(event) => onSerpSharePct(Number(event.target.value))}
            className="mt-2 w-full accent-blue-500"
          />
          <span className="mt-1 block text-sm font-semibold text-slate-100">{serpSharePct}%</span>
        </label>
        <label className="block text-xs text-slate-400">
          Patient booking rate
          <input
            type="range"
            min={1}
            max={8}
            step={0.1}
            value={conversionPct}
            onChange={(event) => onConversionPct(Number(event.target.value))}
            className="mt-2 w-full accent-blue-500"
          />
          <span className="mt-1 block text-sm font-semibold text-slate-100">{conversionPct.toFixed(1)}%</span>
        </label>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">New income / month</div>
          <div className="mt-1 text-2xl font-semibold text-white">{gbp(adjusted.monthly)}</div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">New income / year</div>
          <div className="mt-1 text-2xl font-semibold text-white">{gbp(adjusted.annual)}</div>
        </div>
      </div>
    </div>
  );
}

export function RevenueOpportunityPanel({
  slug,
  variant,
  rankingAreas = [],
  marketSharePct,
  bookingRatePct,
  onMarketSharePct,
  onBookingRatePct,
}: {
  slug: string;
  variant: "overview" | "intelligence";
  rankingAreas?: string[];
  marketSharePct?: number;
  bookingRatePct?: number;
  onMarketSharePct?: (value: number) => void;
  onBookingRatePct?: (value: number) => void;
}) {
  const [forecast, setForecast] = useState<OpportunityForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalShare, setInternalShare] = useState(SERP_SHARE_DEFAULT);
  const [internalConversion, setInternalConversion] = useState(CONVERSION_DEFAULT);
  const serpSharePct = marketSharePct ?? internalShare;
  const conversionPct = bookingRatePct ?? internalConversion;
  const setSerpSharePct = onMarketSharePct || setInternalShare;
  const setConversionPct = onBookingRatePct || setInternalConversion;

  async function loadForecast(force = false) {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const query = force ? "?force=1" : "";
      const data = await apiFetch<OpportunityForecastPayload>(
        `/api/growth-engine/${encodeURIComponent(slug)}/opportunity-forecast${query}`,
      );
      if (data?.ok === false) throw new Error(data.error || "Opportunity forecast failed");
      setForecast(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadForecast(false);
  }, [slug]);

  const live = useMemo(
    () => (forecast ? projectLive(forecast, serpSharePct, conversionPct) : null),
    [forecast, serpSharePct, conversionPct],
  );
  const summary = forecast?.summary;
  const locationName = forecast?.locationName || "your area";
  const displayRevenue = live?.annual ?? summary?.projectedAnnualRevenueIncreaseGbp;
  const clicks = live?.rows.reduce((sum, row) => sum + row.organicClicks, 0) || 0;
  const bookings = live?.bookings || 0;
  const monthlyBookings = Math.round(bookings);
  const annualBookings = Math.round(bookings * 12);
  const pageCount = rankingAreas.length * (forecast?.services?.length || 0);
  const reportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (variant === "intelligence") {
      params.set("serpShare", String(serpSharePct));
      params.set("conversion", String(conversionPct));
    }
    const query = params.toString();
    return authUrl(
      `/api/growth-engine/${encodeURIComponent(slug)}/executive-report${query ? `?${query}` : ""}`,
    );
  }, [slug, variant, serpSharePct, conversionPct]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">What this could mean for your branch</h3>
          <p className="mt-1 text-xs text-slate-500">
            Local patients already searching near {locationName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={reportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white no-underline hover:bg-blue-500"
          >
            Export Executive Report
          </a>
          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => void loadForecast(true)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh demand"}
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}
      {loading && !forecast ? (
        <p className="text-sm text-slate-400">Loading local patient demand…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[1280px]:grid-cols-3">
            <HeadlineStat
              label="Local patients searching"
              value={count(summary?.totalMonthlySearchDemand)}
              period="/ month"
              subtitle={`${locationName} residents searching for private clinical services.`}
            />
            <HeadlineStat
              label="Projected clinic bookings"
              value={`~${count(monthlyBookings)} patients`}
              period="/ month"
              subtitle={`~${count(annualBookings)} / year. Consultations and treatments walking into your clinic at current settings.`}
            />
            <HeadlineStat
              label="Projected clinical revenue"
              value={displayRevenue != null && Number.isFinite(displayRevenue) ? `+${gbp(displayRevenue)}` : "—"}
              period="/ year"
              subtitle={`${gbp(live?.monthly)} / month. Estimated gross clinical turnover generated directly by your catchment pages.`}
            />
          </div>
          {variant === "intelligence" && forecast ? (
            <>
              <PatientJourney
                locationName={locationName}
                demand={summary?.totalMonthlySearchDemand || 0}
                clicks={clicks}
                bookings={bookings}
                monthly={live?.monthly || 0}
                annual={live?.annual || 0}
                sharePct={serpSharePct}
                conversionPct={conversionPct}
              />
              <WhyCatchmentsBeatAds locationName={locationName} pageCount={pageCount} />
              <ForecastCalculator
                forecast={forecast}
                serpSharePct={serpSharePct}
                conversionPct={conversionPct}
                onSerpSharePct={setSerpSharePct}
                onConversionPct={setConversionPct}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
