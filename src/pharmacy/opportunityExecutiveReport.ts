/**
 * Print-ready executive opportunity report HTML for pharmacy-owner pitches.
 */
import {
  competitorLandscapeRows,
  type TenantCompetitorRadar,
} from "./localCompetitorSerpRadarService.ts";
import type { TenantOpportunityForecast } from "./opportunityForecastService.ts";
import type { TenantPortfolioOpportunity } from "./portfolioOpportunityService.ts";
import {
  CONSULTATION_CONVERSION_DEFAULT,
  CONSULTATION_CONVERSION_SLIDER_MAX,
  CONSULTATION_CONVERSION_SLIDER_MIN,
  ORGANIC_CLICK_SHARE_INDUSTRY,
  SERP_CLICK_SHARE_DEFAULT,
  SERP_CLICK_SHARE_SLIDER_MAX,
  SERP_CLICK_SHARE_SLIDER_MIN,
  parsePercentOrRate,
} from "./revenueCalculator.ts";
import {
  BREAK_EVEN_CONSULTATIONS_PER_MONTH,
  DRIVE_TIME_RADIUS_MILES,
  DRIVE_TIME_RADIUS_PCT,
  applyCatchmentFilter,
  localCatchmentDemand,
} from "../services/catchmentFilter.ts";
import {
  territoryReportSummary,
  type EligibleContractorPool,
  type TerritoryCluster,
} from "../services/territoryClusterService.ts";

export type ExecutiveReportScenario = {
  serpClickShare: number;
  consultationConversion: number;
  captureRate: number;
  driveTimeRadiusPct: number;
  travelPackageGbp: number;
  weightRetentionMonths: number;
  weightMonthlyFeeGbp: number;
  pharmacyFirstGbp: number;
};

export type ExecutiveReportBrandContext = {
  website?: string;
  gphcNumber?: string;
  registeredCompanyName?: string;
  companyNumber?: string;
  primaryDirectorName?: string;
};

export const DEFAULT_REPORT_SCENARIO: ExecutiveReportScenario = {
  serpClickShare: SERP_CLICK_SHARE_DEFAULT,
  consultationConversion: CONSULTATION_CONVERSION_DEFAULT,
  captureRate: SERP_CLICK_SHARE_DEFAULT * CONSULTATION_CONVERSION_DEFAULT,
  driveTimeRadiusPct: DRIVE_TIME_RADIUS_PCT,
  travelPackageGbp: 120,
  weightRetentionMonths: 4,
  weightMonthlyFeeGbp: 180,
  pharmacyFirstGbp: 25,
};

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  if (value == null) return "";
  return String(value).trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseExecutiveReportScenario(query: Record<string, unknown> = {}): ExecutiveReportScenario {
  const serpClickShare = parsePercentOrRate(
    firstQueryValue(query.serpShare ?? query.serpClickShare ?? query.clickShare),
    SERP_CLICK_SHARE_DEFAULT,
    SERP_CLICK_SHARE_SLIDER_MIN,
    SERP_CLICK_SHARE_SLIDER_MAX,
  );
  const consultationConversion = parsePercentOrRate(
    firstQueryValue(query.conversion ?? query.bookingRate ?? query.consultationConversion),
    CONSULTATION_CONVERSION_DEFAULT,
    CONSULTATION_CONVERSION_SLIDER_MIN,
    CONSULTATION_CONVERSION_SLIDER_MAX,
  );
  const travelRaw = Number(
    firstQueryValue(query.travelPackage ?? query.travelFee ?? query.travelPackageGbp),
  );
  const retentionRaw = Number(
    firstQueryValue(query.weightRetention ?? query.retention ?? query.weightRetentionMonths),
  );
  const catchmentRaw = Number(
    firstQueryValue(query.catchmentPct ?? query.driveTimeRadiusPct ?? query.radiusPct),
  );
  return {
    ...DEFAULT_REPORT_SCENARIO,
    serpClickShare,
    consultationConversion,
    captureRate: serpClickShare * consultationConversion,
    driveTimeRadiusPct: Number.isFinite(catchmentRaw) && catchmentRaw > 0
      ? clamp(catchmentRaw > 1 ? catchmentRaw / 100 : catchmentRaw, 0.05, 1)
      : DEFAULT_REPORT_SCENARIO.driveTimeRadiusPct,
    travelPackageGbp:
      Number.isFinite(travelRaw) && travelRaw > 0
        ? clamp(travelRaw, 90, 180)
        : DEFAULT_REPORT_SCENARIO.travelPackageGbp,
    weightRetentionMonths:
      Number.isFinite(retentionRaw) && retentionRaw > 0
        ? clamp(Math.round(retentionRaw), 3, 6)
        : DEFAULT_REPORT_SCENARIO.weightRetentionMonths,
  };
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function num(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

function pct(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}

function gbpPlus(value: number): string {
  const formatted = gbp(value);
  return formatted.startsWith("£") ? `+${formatted}` : formatted;
}

function approx(value: number): string {
  return `~${num(Math.round(value))}`;
}

export function hostnameFromWebsite(website?: string): string {
  const raw = String(website || "").trim();
  if (!raw) return "";
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || host === "localhost" || /\.pharmacy\.local$/i.test(host)) return "";
    return host;
  } catch {
    return "";
  }
}

export function targetDeploymentHost(slug: string, website?: string): string {
  const host = hostnameFromWebsite(website);
  if (host) {
    if (/^local\./i.test(host)) return host;
    return `local.${host}`;
  }
  const safe = String(slug || "pharmacy")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pharmacy";
  return `local.${safe}.co.uk`;
}

function brandMarkSvg(): string {
  return `<svg class="brand-logo" viewBox="0 0 36 36" width="36" height="36" aria-hidden="true" focusable="false">
  <rect width="36" height="36" rx="9" fill="#005EB8"/>
  <rect x="15" y="8" width="6" height="20" rx="1.5" fill="#fff"/>
  <rect x="8" y="15" width="20" height="6" rx="1.5" fill="#fff"/>
</svg>`;
}

function reportDateStamp(): string {
  return new Date().toLocaleDateString("en-GB", {
    dateStyle: "long",
    timeZone: "Europe/London",
  });
}

export function clinicalGovernanceLabel(gphcNumber?: string): string {
  const digits = String(gphcNumber || "").replace(/[^\d]/g, "");
  if (digits) return `GPhC Regulated Framework (Registration: ${digits})`;
  return "GPhC Regulated Framework";
}

function joinPlainList(items: string[]): string {
  if (!items.length) return "clinical treatments";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function patientSeekingPhrase(services: Array<{ serviceId: string; label: string }>): string {
  const rank: Record<string, number> = {
    "travel-vaccinations": 0,
    "weight-loss": 1,
    "pharmacy-first": 2,
  };
  const phrases = [...services]
    .sort((a, b) => (rank[a.serviceId] ?? 50) - (rank[b.serviceId] ?? 50))
    .map((service) => {
      if (service.serviceId === "travel-vaccinations") return "travel vaccines";
      if (service.serviceId === "weight-loss") return "weight care";
      if (service.serviceId === "pharmacy-first") return "minor ailment treatments";
      if (service.serviceId === "blood-pressure-checks") return "blood pressure checks";
      if (service.serviceId === "flu-vaccination" || service.serviceId === "flu-vaccinations") {
        return "flu vaccinations";
      }
      return service.label.replace(/^NHS\s+/i, "").toLowerCase();
    });
  return joinPlainList(phrases);
}

function catchmentPageCount(forecast: TenantOpportunityForecast, radar?: TenantCompetitorRadar | null): number {
  const areas = radar?.catchments?.length || 0;
  const services = forecast.services.length || 0;
  return areas > 0 && services > 0 ? areas * services : 0;
}

function revenuePerCapture(serviceId: string, scenario: ExecutiveReportScenario): number {
  if (serviceId === "weight-loss") return scenario.weightMonthlyFeeGbp * scenario.weightRetentionMonths;
  if (serviceId === "travel-vaccinations") return scenario.travelPackageGbp;
  if (serviceId === "pharmacy-first") return scenario.pharmacyFirstGbp;
  return 0;
}

export function projectScenario(
  forecast: TenantOpportunityForecast,
  scenario: ExecutiveReportScenario,
): {
  monthlyGbp: number;
  annualGbp: number;
  annualAdReplacementGbp: number;
  rows: Array<{
    id: string;
    label: string;
    demand: number;
    metroDemand: number;
    organicClicks: number;
    captured: number;
    monthly: number;
    annual: number;
    annualAds: number;
  }>;
} {
  const rows = forecast.services.map((service) => {
    const metroDemand = service.opportunity.monthlySearchDemand || 0;
    const ltv = revenuePerCapture(service.serviceId, scenario) || service.projection.unitEconomics.revenuePerCaptureGbp;
    const catchment = applyCatchmentFilter({
      metroVolume: metroDemand,
      driveTimeRadiusPct: scenario.driveTimeRadiusPct,
      serpClickShare: scenario.serpClickShare,
      consultationConversion: scenario.consultationConversion,
      serviceLTV: ltv,
      avgCpcGbp: service.opportunity.averageCpcGbp,
      monthlyAdReplacementValueGbp: service.opportunity.monthlyAdReplacementValueGbp,
    });
    return {
      id: service.serviceId,
      label: service.label,
      demand: catchment.localCatchmentDemand,
      metroDemand,
      organicClicks: catchment.catchmentClicks,
      captured: catchment.projectedBookings,
      monthly: catchment.monthlyGrossRevenueGbp,
      annual: catchment.annualGrossRevenueGbp,
      annualAds: catchment.annualAdReplacementValueGbp,
    };
  });
  const monthlyGbp = rows.reduce((sum, row) => sum + row.monthly, 0);
  const annualGbp = rows.reduce((sum, row) => sum + row.annual, 0);
  const annualAdReplacementGbp = rows.reduce((sum, row) => sum + row.annualAds, 0);
  return { monthlyGbp, annualGbp, annualAdReplacementGbp, rows };
}

function scenarioDiffers(scenario: ExecutiveReportScenario): boolean {
  return (
    scenario.serpClickShare !== DEFAULT_REPORT_SCENARIO.serpClickShare ||
    scenario.consultationConversion !== DEFAULT_REPORT_SCENARIO.consultationConversion ||
    scenario.driveTimeRadiusPct !== DEFAULT_REPORT_SCENARIO.driveTimeRadiusPct ||
    scenario.travelPackageGbp !== DEFAULT_REPORT_SCENARIO.travelPackageGbp ||
    scenario.weightRetentionMonths !== DEFAULT_REPORT_SCENARIO.weightRetentionMonths
  );
}

function patientJourneyHtml(input: {
  locationName: string;
  metroDemand: number;
  catchmentDemand: number;
  clicks: number;
  bookings: number;
  driveTimePct: string;
  marketSharePct: string;
  bookingPct: string;
}): string {
  const miles = `${DRIVE_TIME_RADIUS_MILES.min}–${DRIVE_TIME_RADIUS_MILES.max}`;
  return `<h2>How local patients become bookings</h2>
<p class="note">Funnel applied to the ${miles} mile drive-time catchment, not the full ${esc(input.locationName)} metro search pool.</p>
<div class="journey">
  <article class="stage">
    <div class="step">Stage 1</div>
    <h3>Metro demand</h3>
    <p class="figure">${num(input.metroDemand)}<span> / mo</span></p>
    <p>Total regional search pool for your clinical services in ${esc(input.locationName)}.</p>
  </article>
  <article class="stage">
    <div class="step">Stage 2</div>
    <h3>${miles} mile drive-time catchment</h3>
    <p class="figure">${approx(input.catchmentDemand)}<span> / mo</span></p>
    <p>Filtered to exclude patients outside your realistic travel radius (${input.driveTimePct} of metro demand).</p>
  </article>
  <article class="stage">
    <div class="step">Stage 3</div>
    <h3>Local neighbourhood click share</h3>
    <p class="figure">${approx(input.clicks)}</p>
    <p>${input.marketSharePct} of catchment searchers visit your dedicated neighbourhood pages.</p>
  </article>
  <article class="stage">
    <div class="step">Stage 4</div>
    <h3>Consultation bookings</h3>
    <p class="figure">${approx(input.bookings)}</p>
    <p>${input.bookingPct} booking rate on those local clicks (~${num(Math.round(input.bookings))} patients / mo).</p>
  </article>
</div>`;
}

function whyCatchmentsBeatAdsHtml(locationName: string, pageCount: number): string {
  const organicPct = Math.round(ORGANIC_CLICK_SHARE_INDUSTRY * 100);
  const pages =
    pageCount > 0
      ? `your ${num(pageCount)} ${esc(locationName)} catchment pages continue generating patient bookings year-round`
      : `your dedicated ${esc(locationName)} catchment pages continue generating patient bookings year-round`;
  return `<h2>Why local catchments beat paid ads</h2>
<div class="compare">
  <article class="compare-card preference">
    <div class="step">${organicPct}% patient preference</div>
    <h3>Patients choose trusted local pharmacies</h3>
    <p>${organicPct}% of patients bypass sponsored ads to choose trusted local pharmacies on Google Maps and organic listings.</p>
  </article>
  <article class="compare-card asset">
    <div class="step">Permanent digital asset</div>
    <h3>Pages keep working after you stop paying</h3>
    <p>Unlike Google Ads, which stop the moment you stop paying, ${pages}.</p>
  </article>
</div>`;
}

function competitorSectionHtml(radar?: TenantCompetitorRadar | null): string {
  const landscape = competitorLandscapeRows(radar);
  if (!landscape.length) return "";
  const catchments = radar?.catchments?.length ? radar.catchments.join(", ") : radar?.locationName || "Sheffield";
  const groups = new Map<string, typeof landscape>();
  for (const row of landscape) {
    const key = row.serviceLabel;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  const blocks = [...groups.entries()]
    .map(([label, rows]) => {
      const keyword = rows[0]?.keyword || "";
      const body = rows
        .map(
          (row) => `<tr>
<td>${esc(row.competitor)}</td>
<td class="num">#${esc(row.rankingPosition)}</td>
<td class="num">${row.googleReviews == null ? "—" : num(row.googleReviews)}</td>
<td class="num">${row.starRating == null ? "—" : Number(row.starRating).toFixed(1)}</td>
<td><strong>${esc(row.threatLevel)}</strong> · ${esc(row.displacementOpportunity)}</td>
</tr>`,
        )
        .join("");
      return `<h3 style="font-size:.95rem;margin:18px 0 8px;color:#0f172a">${esc(label)} · “${esc(keyword)}”</h3>
<table>
  <thead><tr><th>Competitor</th><th class="num">Ranking position</th><th class="num">Google reviews</th><th class="num">Star rating</th><th>Threat level / displacement opportunity</th></tr></thead>
  <tbody>${body}</tbody>
</table>`;
    })
    .join("");
  return `<h2>Who patients see today</h2>
<p class="note">${esc(radar?.pharmacyName || "Your pharmacy")} can win these local searches across ${radar?.catchments?.length || 0} neighbourhoods: ${esc(catchments)}.</p>
${blocks}`;
}

function contentGapSectionHtml(radar?: TenantCompetitorRadar | null): string {
  const gap = radar?.contentGap;
  if (!gap?.queries?.length) return "";
  const blocks = gap.queries
    .map((query) => {
      const body = (query.rows || [])
        .map(
          (row) => `<tr>
<td><strong>#${esc(row.rankGroup)}</strong> · ${esc(row.domain)}<br/><span class="muted">${esc(row.url.replace(/^https?:\/\//i, "").replace(/^www\./i, ""))}</span></td>
<td>${esc(row.contentTypeLabel)}</td>
<td>${esc(row.catchmentPagesLabel)}</td>
</tr>`,
        )
        .join("");
      return `<div class="gap-block">
<h3 class="gap-heading">${esc(query.serviceLabel)} · “${esc(query.keyword)}”</h3>
<p class="note">${esc(query.vulnerabilityLine)}</p>
<table class="gap-table">
  <thead><tr><th>Competitor URL &amp; Rank</th><th>Content Type Detected</th><th>Neighborhood Catchment Pages</th></tr></thead>
  <tbody>${body}</tbody>
</table>
</div>`;
    })
    .join("");
  return `<h2>Competitor Vulnerability &amp; Content Gap</h2>
<div class="takeaway">${esc(gap.overall.takeaway)}</div>
${blocks}`;
}

function priorityMatrixHtml(
  portfolio: TenantPortfolioOpportunity | null | undefined,
  forecast: TenantOpportunityForecast,
  scenario: ExecutiveReportScenario,
): string {
  const rows = (portfolio?.services?.length ? portfolio.services : []).map((row) => {
    const catchment = applyCatchmentFilter({
      metroVolume: row.monthlySearchDemand,
      driveTimeRadiusPct: scenario.driveTimeRadiusPct,
      serpClickShare: scenario.serpClickShare,
      consultationConversion: scenario.consultationConversion,
      serviceLTV: row.revenuePerCaptureGbp,
    });
    return {
      label: row.label,
      demand: catchment.localCatchmentDemand,
      visitors: catchment.catchmentClicks,
      bookings: catchment.projectedBookings,
      ltv: row.revenuePerCaptureGbp,
      monthly: catchment.monthlyGrossRevenueGbp,
      annual: catchment.annualGrossRevenueGbp,
      deployed: row.deployed,
    };
  });
  const sourceRows =
    rows.length > 0
      ? rows
      : forecast.services.map((service) => {
          const ltv = service.projection.unitEconomics.revenuePerCaptureGbp;
          const catchment = applyCatchmentFilter({
            metroVolume: service.opportunity.monthlySearchDemand || 0,
            driveTimeRadiusPct: scenario.driveTimeRadiusPct,
            serpClickShare: scenario.serpClickShare,
            consultationConversion: scenario.consultationConversion,
            serviceLTV: ltv,
          });
          return {
            label: service.label,
            demand: catchment.localCatchmentDemand,
            visitors: catchment.catchmentClicks,
            bookings: catchment.projectedBookings,
            ltv,
            monthly: catchment.monthlyGrossRevenueGbp,
            annual: catchment.annualGrossRevenueGbp,
            deployed: true,
          };
        });
  const body = sourceRows
    .map(
      (row) => `<tr>
<td>${esc(row.label)}</td>
<td class="num">${num(row.demand)}</td>
<td class="num">${row.visitors.toFixed(1)}</td>
<td class="num">${row.bookings.toFixed(1)}</td>
<td class="num">${gbp(row.ltv)}</td>
<td class="num">${gbp(row.monthly)}</td>
<td class="num">${gbp(row.annual)}</td>
<td>${row.deployed ? '<span class="badge live">Live</span>' : '<span class="badge deploy">Deploy</span>'}</td>
</tr>`,
    )
    .join("");
  return `<h2>Clinical Service Opportunity &amp; Priority Matrix</h2>
<p class="note">Catchment volumes are ${pct(scenario.driveTimeRadiusPct)} of metro demand (${DRIVE_TIME_RADIUS_MILES.min}–${DRIVE_TIME_RADIUS_MILES.max} mile drive-time). Projections then use a conservative ${pct(scenario.serpClickShare)} catchment click share and ${pct(scenario.consultationConversion, 1)} consultation booking rate.</p>
<table class="matrix">
  <thead><tr>
    <th>Clinical Service</th>
    <th class="num">Catchment searches / mo</th>
    <th class="num">Catchment Visitors / mo</th>
    <th class="num">Booked Patients / mo</th>
    <th class="num">Avg Treatment Value</th>
    <th class="num">Monthly Revenue</th>
    <th class="num">Annual Revenue</th>
    <th>Priority / Action</th>
  </tr></thead>
  <tbody>${body}</tbody>
</table>`;
}

function exclusivityNoticeHtml(
  pool: EligibleContractorPool | null | undefined,
  locked: boolean,
  claimHref: string,
): string {
  if (!pool) return "";
  const rows = pool.contractors
    .map((row) => {
      const target = row.underActiveReview;
      const label = target
        ? `★ ${esc(row.pharmacyName)} (Under Active Review)`
        : `${esc(row.pharmacyName)}${row.outcode ? ` (${esc(row.outcode)})` : ""}`;
      return `<tr class="${target ? "target" : ""}">
<td>${label}</td>
<td>${esc(row.outcode || "—")}</td>
<td>${esc(row.tradingAddress || row.postcode || "—")}</td>
</tr>`;
    })
    .join("");
  return `<section class="exclusivity-card${locked ? " locked" : ""}">
    <span class="exclusivity-pill${locked ? " locked" : ""}">${
      locked
        ? "🔴 Territory reserved"
        : "🟢 OPEN FOR REGISTRATION (1 Exclusive License Allocated)"
    }</span>
    <h2>Territory Allocation &amp; Exclusivity Notice</h2>
    <p>In accordance with our single-contractor policy, this clinical search volume and protected polygon is licensed to only one independent dispensary. Once claimed, all competing pharmacies in this cluster are permanently locked out.</p>
    <table>
      <thead><tr><th>Eligible dispensary</th><th>Outcode</th><th>Trading address</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note" style="margin:12px 0 14px">${num(pool.totalEligibleIndependentsInCluster)} eligible independent contractors in this polygon.</p>
    ${
      locked
        ? ""
        : `<a class="btn" href="${esc(claimHref)}">Claim Exclusive License (£1,000/yr)</a>`
    }
  </section>`;
}

export function renderExecutiveOpportunityReportHtml(
  forecast: TenantOpportunityForecast,
  scenario: ExecutiveReportScenario = DEFAULT_REPORT_SCENARIO,
  radar?: TenantCompetitorRadar | null,
  portfolio?: TenantPortfolioOpportunity | null,
  brand?: ExecutiveReportBrandContext,
  territory?: TerritoryCluster | null,
  contractorPool?: EligibleContractorPool | null,
): string {
  const baseline = projectScenario(forecast, DEFAULT_REPORT_SCENARIO);
  const adjusted = projectScenario(forecast, scenario);
  const modelled = scenarioDiffers(scenario);
  const generated = reportDateStamp();
  const display = modelled ? adjusted : baseline;
  const locationName = forecast.locationName || "your area";
  const metroDemand = forecast.summary.totalMonthlySearchDemand;
  const catchmentDemand = localCatchmentDemand(metroDemand, (modelled ? scenario : DEFAULT_REPORT_SCENARIO).driveTimeRadiusPct);
  const clicks = display.rows.reduce((sum, row) => sum + row.organicClicks, 0);
  const bookings = display.rows.reduce((sum, row) => sum + row.captured, 0);
  const activeScenario = modelled ? scenario : DEFAULT_REPORT_SCENARIO;
  const pageCount = catchmentPageCount(forecast, radar);
  const catchmentCount = radar?.catchments?.length || 0;
  const deploymentHost = targetDeploymentHost(forecast.slug, brand?.website);
  const governance = clinicalGovernanceLabel(brand?.gphcNumber);
  const registeredCompany = String(brand?.registeredCompanyName || "").trim();
  const companyNumber = String(brand?.companyNumber || "").trim();
  const primaryDirector = String(brand?.primaryDirectorName || "").trim();
  const registeredCompanyLabel = registeredCompany
    ? companyNumber
      ? `${registeredCompany} (${companyNumber})`
      : registeredCompany
    : "";
  const licenseLocked = Boolean(
    contractorPool?.contractors.some(
      (row) => row.licenseStatus === "reserved" && !row.underActiveReview,
    ),
  );
  const targetPostcode = contractorPool?.contractors.find((row) => row.underActiveReview)?.postcode || "";
  const claimHref = `/api/growth-engine/${encodeURIComponent(forecast.slug)}/claim-territory?pharmacyName=${encodeURIComponent(forecast.pharmacyName)}&postcode=${encodeURIComponent(targetPostcode)}`;
  const exclusivityHtml = exclusivityNoticeHtml(contractorPool, licenseLocked, claimHref);
  const territorySummary = territoryReportSummary(territory || null, metroDemand);
  const territoryStrip = territorySummary
    ? `<div class="territory-strip">
    <div>
      <span>Primary Outcode &amp; 15-Mile Radial Polygon</span>
      <strong>${esc(territorySummary.polygonLabel)}</strong>
    </div>
    <div>
      <span>ONS Verified Resident Population</span>
      <strong>${esc(territorySummary.onsPopulationLabel)}</strong>
    </div>
    <div>
      <span>15-Mile Clinical Search Demand</span>
      <strong>${territorySummary.clinicalDemand != null ? `${num(territorySummary.clinicalDemand)} / month` : "—"}</strong>
    </div>
  </div>`
    : "";
  const ownerStrip =
    registeredCompanyLabel || primaryDirector
      ? `<div class="owner-strip">
    ${registeredCompanyLabel ? `<div><span>Registered Company</span><strong>${esc(registeredCompanyLabel)}</strong></div>` : ""}
    ${primaryDirector ? `<div><span>Primary Director</span><strong>${esc(primaryDirector)}</strong></div>` : ""}
  </div>`
      : "";
  const keywordRows = forecast.services
    .flatMap((service) =>
      service.opportunity.keywords
        .filter((keyword) => keyword.searchVolume != null && keyword.searchVolume > 0)
        .map(
          (keyword) => `<tr>
<td>${esc(service.label)}</td>
<td>${esc(keyword.keyword)}</td>
<td class="num">${num(keyword.searchVolume || 0)}</td>
</tr>`,
        ),
    )
    .join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>Growth opportunity — ${esc(forecast.pharmacyName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Calibri, "Liberation Sans", Arial, sans-serif; color: #0f172a; background: #eef2f7; }
  .print-bar { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 20px; background: #0f172a; color: #e2e8f0; font-size: .82rem; }
  .print-bar strong { font-weight: 700; letter-spacing: .01em; }
  .print-bar .btn { background: #fff; color: #0f172a; }
  .sheet { max-width: 1120px; margin: 24px auto; background: #fff; padding: 36px 40px 40px; border: 1px solid #e2e8f0; border-radius: 18px; box-shadow: 0 12px 40px rgba(15, 23, 42, .06); }
  .brand-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 2px solid #005EB8; }
  .brand-mark { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand-logo { display: block; flex-shrink: 0; }
  .brand-copy { min-width: 0; }
  .brand-copy strong { display: block; font-size: 1.02rem; letter-spacing: -.01em; color: #0f172a; }
  .brand-copy span { display: block; margin-top: 2px; font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #005EB8; }
  .brand-client { text-align: right; min-width: 0; }
  .matrix { font-size: .82rem; }
  .badge { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: .68rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .badge.live { background: #ecfdf5; color: #047857; }
  .badge.deploy { background: #eff6ff; color: #1d4ed8; }
  h1 { margin: 0; font-size: 1.7rem; color: #005EB8; letter-spacing: -.02em; line-height: 1.15; }
  .kicker { text-transform: uppercase; letter-spacing: .16em; font-size: .68rem; font-weight: 700; color: #64748b; margin: 0 0 6px; }
  .muted { color: #64748b; font-size: .95rem; margin: 0; }
  .meta-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0 8px; padding: 14px 16px; border: 1px solid #dbeafe; border-radius: 12px; background: #f8fbff; }
  .owner-strip, .territory-strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0 0 8px; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
  .territory-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); border-color: #dbeafe; background: #f8fbff; }
  .owner-strip div span, .territory-strip div span { display: block; font-size: .62rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  .owner-strip div strong, .territory-strip div strong { display: block; font-size: .88rem; color: #0f172a; font-weight: 700; word-break: break-word; }
  .meta-strip div span { display: block; font-size: .62rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  .meta-strip div strong { display: block; font-size: .88rem; color: #0f172a; font-weight: 700; word-break: break-word; }
  .lede { margin: 14px 0 0; color: #475569; font-size: .95rem; }
  .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 28px 0; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 16px; padding: 18px 18px 16px; background: #f8fbff; }
  .kpi.revenue { border-color: #86efac; background: #f0fdf4; }
  .kpi span { display: block; font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #475569; }
  .kpi strong { display: block; margin-top: 8px; font-size: 1.55rem; color: #0f172a; letter-spacing: -.02em; }
  .kpi .sub { margin: 8px 0 0; font-size: .78rem; line-height: 1.45; color: #334155; font-weight: 400; text-transform: none; letter-spacing: 0; }
  .journey, .compare { display: grid; gap: 14px; }
  .journey { grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 8px 0 8px; }
  .stage, .compare-card { border-radius: 16px; padding: 16px; min-height: 100%; }
  .stage { border: 1px solid #93c5fd; background: #f8fbff; position: relative; }
  .stage:not(:last-child)::after { content: "→"; position: absolute; right: -11px; top: 46%; color: #1d4ed8; font-size: 1.05rem; font-weight: 700; }
  .stage .step, .compare-card .step { font-size: .65rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #005EB8; }
  .stage h3, .compare-card h3 { margin: 6px 0 8px; font-size: .95rem; color: #0f172a; }
  .stage .figure { margin: 0 0 8px; font-size: 1.45rem; font-weight: 800; color: #0f172a; letter-spacing: -.02em; }
  .stage .figure span { font-size: .85rem; font-weight: 700; color: #334155; }
  .stage p, .compare-card p { margin: 0; font-size: .8rem; line-height: 1.45; color: #334155; }
  .compare { grid-template-columns: 1fr 1fr; margin-top: 8px; }
  .compare-card.preference { border: 1px solid #4ade80; background: #f0fdf4; }
  .compare-card.asset { border: 1px solid #60a5fa; background: #eff6ff; }
  .takeaway { border: 1px solid #16a34a; background: #f0fdf4; border-radius: 14px; padding: 16px 18px; color: #14532d; font-size: .92rem; line-height: 1.55; margin: 8px 0 16px; }
  .exclusivity-card { border: 1px solid #86efac; background: #f0fdf4; border-radius: 16px; padding: 18px 20px; margin: 8px 0 20px; }
  .exclusivity-card.locked { border-color: #fecaca; background: #fff7f7; }
  .exclusivity-card h2 { margin: 10px 0 8px; }
  .exclusivity-card p { margin: 0 0 14px; color: #14532d; font-size: .9rem; line-height: 1.55; }
  .exclusivity-card.locked p { color: #7f1d1d; }
  .exclusivity-card table { background: #fff; border-radius: 10px; overflow: hidden; }
  .exclusivity-card tr.target td { background: #ecfdf5; font-weight: 700; color: #14532d; }
  .exclusivity-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 11px; font-size: .68rem; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .exclusivity-pill.locked { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
  th { font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: #334155; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  h2 { font-size: 1.12rem; color: #0f172a; margin: 32px 0 10px; }
  .gap-heading { font-size: .95rem; margin: 18px 0 8px; color: #0f172a; }
  .btn { display: inline-block; background: #005EB8; color: #fff; text-decoration: none; font-weight: 700; padding: 8px 14px; border-radius: 8px; border: 0; cursor: pointer; font-size: .82rem; }
  .note { font-size: .86rem; color: #334155; line-height: 1.5; }
  footer { margin-top: 32px; font-size: .75rem; color: #475569; }
  @media (max-width: 840px) {
    .kpis, .journey, .compare, .meta-strip, .owner-strip, .territory-strip, .brand-header, .exclusivity-card { grid-template-columns: 1fr; }
    .brand-header, .brand-client { display: block; text-align: left; }
    .sheet { padding: 24px 20px; margin: 12px; }
    .stage:not(:last-child)::after { content: "↓"; right: auto; left: 50%; top: auto; bottom: -14px; transform: translateX(-50%); }
  }
  @media print {
    @page { margin: 12mm 12mm 14mm; }
    body { background: #fff; color: #000; }
    .print-bar { display: none !important; }
    .sheet { margin: 0; border: 0; padding: 0; max-width: none; box-shadow: none; border-radius: 0; }
    .brand-header { border-bottom: 2px solid #000; }
    h1, .brand-copy span, .stage .step, .compare-card .step { color: #000; }
    .kpi, .stage, .compare-card, .takeaway, .meta-strip, .owner-strip, .territory-strip, .exclusivity-card {
      background: #fff !important;
      border: 1px solid #111 !important;
      box-shadow: none !important;
    }
    .kpi, .kpis, .journey, .stage, .compare, .compare-card, .takeaway, .gap-block, .gap-table, .meta-strip, .owner-strip, .territory-strip, .exclusivity-card, .brand-header {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    tr { break-inside: avoid; page-break-inside: avoid; }
    a { color: #000; text-decoration: none; }
    .badge { border: 1px solid #111; color: #000; background: #fff; }
    footer { color: #333; }
  }
</style>
</head>
<body>
<div class="print-bar">
  <strong>PharmaConnect Growth Engine · Executive Opportunity Report</strong>
  <button class="btn" type="button" onclick="window.print()">Print / Save as PDF</button>
</div>
<article class="sheet">
  <header class="brand-header">
    <div class="brand-mark">
      ${brandMarkSvg()}
      <div class="brand-copy">
        <strong>PharmaConnect</strong>
        <span>Growth Engine</span>
      </div>
    </div>
    <div class="brand-client">
      <p class="kicker">Confidential briefing for the pharmacy owner</p>
      <h1>${esc(forecast.pharmacyName)}</h1>
    </div>
  </header>
  <div class="meta-strip">
    <div>
      <span>Target Deployment</span>
      <strong>${esc(deploymentHost)}</strong>
    </div>
    <div>
      <span>Catchment Coverage</span>
      <strong>${esc(locationName)}${territory ? ` · ${esc(territory.anchorOutcode)} 15-mile` : ""} + ${num(catchmentCount)} Priority Localities</strong>
    </div>
    <div>
      <span>Generated On</span>
      <strong>${esc(generated)}</strong>
    </div>
    <div>
      <span>Clinical Governance</span>
      <strong>${esc(governance)}</strong>
    </div>
  </div>
  ${ownerStrip}
  ${territoryStrip}
  <p class="lede">How local patients in ${esc(locationName)} find your clinical services.</p>
  <div class="takeaway">Projections use a ${DRIVE_TIME_RADIUS_MILES.min}–${DRIVE_TIME_RADIUS_MILES.max} mile drive-time catchment (${pct(activeScenario.driveTimeRadiusPct)} of metro demand), then a conservative ${pct(activeScenario.serpClickShare)} catchment click share and ${pct(activeScenario.consultationConversion, 1)} consultation booking rate. Break-even achieved with just ${BREAK_EVEN_CONSULTATIONS_PER_MONTH} consultations/month.</div>

  <div class="kpis">
    <div class="kpi">
      <span>Metro search pool</span>
      <strong>${num(metroDemand)} / month</strong>
      <p class="sub">${esc(locationName)} regional demand. ${DRIVE_TIME_RADIUS_MILES.min}–${DRIVE_TIME_RADIUS_MILES.max} mile catchment: ${num(catchmentDemand)} / mo.</p>
    </div>
    <div class="kpi">
      <span>Projected clinic bookings</span>
      <strong>~${num(Math.round(bookings))} patients / month</strong>
      <p class="sub">~${num(Math.round(bookings * 12))} / year from the drive-time catchment at ${pct(activeScenario.serpClickShare)} × ${pct(activeScenario.consultationConversion, 1)}.</p>
    </div>
    <div class="kpi revenue">
      <span>Projected clinical revenue</span>
      <strong>${gbpPlus(display.annualGbp)} / year</strong>
      <p class="sub">${gbp(display.monthlyGbp)} / month. Break-even achieved with just ${BREAK_EVEN_CONSULTATIONS_PER_MONTH} consultations/month.</p>
    </div>
  </div>

  ${exclusivityHtml}

  ${patientJourneyHtml({
    locationName,
    metroDemand,
    catchmentDemand,
    clicks,
    bookings,
    driveTimePct: pct(activeScenario.driveTimeRadiusPct),
    marketSharePct: pct(activeScenario.serpClickShare),
    bookingPct: pct(activeScenario.consultationConversion, 1),
  })}

  ${whyCatchmentsBeatAdsHtml(locationName, pageCount)}

  ${priorityMatrixHtml(portfolio, forecast, modelled ? scenario : DEFAULT_REPORT_SCENARIO)}

  ${competitorSectionHtml(radar)}

  ${contentGapSectionHtml(radar)}

  ${
    keywordRows
      ? `<h2>What patients are searching for</h2>
<table>
  <thead><tr><th>Service</th><th>What patients type</th><th class="num">Monthly searches</th></tr></thead>
  <tbody>${keywordRows}</tbody>
</table>`
      : ""
  }

  <footer>Confidential. Prepared for the pharmacy owner. Financials apply a ${DRIVE_TIME_RADIUS_MILES.min}–${DRIVE_TIME_RADIUS_MILES.max} mile drive-time filter, then conservative click-share and booking rates. These are estimates of extra clinical income, not a guarantee of bookings.</footer>
</article>
</body>
</html>`;
}
