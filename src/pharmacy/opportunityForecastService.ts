/**
 * Tenant-level search-opportunity + clinical revenue forecast.
 * Caches live DataForSEO keyword metrics on customer.opportunityData.
 */
import { findPharmacyCustomer, persistCustomerOpportunityData } from "./dashboardCustomerStore.ts";
import {
  CLINICAL_UNIT_ECONOMICS,
  CONSULTATION_CONVERSION_DEFAULT,
  SEARCH_CAPTURE_RATE,
  SERP_CLICK_SHARE_DEFAULT,
  projectServiceRevenue,
  type ServiceRevenueProjection,
} from "./clinicalRevenueForecastModel.ts";
import {
  fetchServiceSearchOpportunity,
  readOpportunityCache,
  writeOpportunityCache,
  SERVICE_OPPORTUNITY_KEYWORD_TEMPLATES,
  type ServiceSearchOpportunity,
  type TenantOpportunityCache,
} from "./serviceSearchOpportunityService.ts";
import { catalogServiceIds } from "./servicesCatalog.ts";
import { getTenantConfig, resolveRegisteredTenantSlug } from "./tenantsConfig.ts";

export type OpportunityForecastSummary = {
  totalMonthlySearchDemand: number;
  annualAdReplacementValueGbp: number;
  projectedMonthlyRevenueGbp: number;
  projectedAnnualRevenueIncreaseGbp: number;
  captureRate: number;
  serpClickShare: number;
  consultationConversion: number;
};

export type TenantOpportunityForecast = {
  ok: true;
  slug: string;
  previewSlug: string;
  pharmacyName: string;
  locationName: string;
  capturedAt: string;
  cached: boolean;
  provider: string;
  summary: OpportunityForecastSummary;
  services: Array<{
    serviceId: string;
    label: string;
    opportunity: ServiceSearchOpportunity;
    projection: ServiceRevenueProjection;
  }>;
};

function roundGbp(value: number): number {
  return Math.round(value * 100) / 100;
}

function tenantServices(slug: string): string[] {
  const catalog = catalogServiceIds().filter((id) => id in SERVICE_OPPORTUNITY_KEYWORD_TEMPLATES);
  if (catalog.length) return catalog;
  const tenant = getTenantConfig(slug);
  const fromTenant = tenant?.enabledServices?.length ? [...tenant.enabledServices] : [];
  const customer = findPharmacyCustomer(slug);
  const fromCustomer = customer?.activeServiceChannels || [];
  const ids = (fromTenant.length ? fromTenant : fromCustomer).filter(
    (id) => id in SERVICE_OPPORTUNITY_KEYWORD_TEMPLATES,
  );
  return [...new Set(ids.length ? ids : Object.keys(SERVICE_OPPORTUNITY_KEYWORD_TEMPLATES))];
}

function forecastFromOpportunities(input: {
  slug: string;
  previewSlug: string;
  pharmacyName: string;
  locationName: string;
  opportunities: ServiceSearchOpportunity[];
  cached: boolean;
}): TenantOpportunityForecast {
  const services = input.opportunities
    .map((opportunity) => {
      const projection = projectServiceRevenue({
        serviceId: opportunity.serviceSlug,
        monthlySearchDemand: opportunity.monthlySearchDemand,
        monthlyAdReplacementValueGbp: opportunity.monthlyAdReplacementValueGbp,
        averageCpcGbp: opportunity.averageCpcGbp,
      });
      if (!projection) return null;
      return {
        serviceId: opportunity.serviceSlug,
        label: CLINICAL_UNIT_ECONOMICS[opportunity.serviceSlug]?.label || opportunity.serviceSlug,
        opportunity,
        projection,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const totalMonthlySearchDemand = services.reduce(
    (sum, row) => sum + row.projection.monthlySearchDemand,
    0,
  );
  const projectedMonthlyRevenueGbp = roundGbp(
    services.reduce((sum, row) => sum + row.projection.monthlyGrossRevenueGbp, 0),
  );
  const projectedAnnualRevenueIncreaseGbp = roundGbp(
    services.reduce((sum, row) => sum + row.projection.annualGrossRevenueGbp, 0),
  );
  const annualAdReplacementValueGbp = roundGbp(
    services.reduce((sum, row) => sum + row.projection.annualAdReplacementValueGbp, 0),
  );

  return {
    ok: true,
    slug: input.slug,
    previewSlug: input.previewSlug,
    pharmacyName: input.pharmacyName,
    locationName: input.locationName,
    capturedAt: services.map((row) => row.opportunity.capturedAt).sort().slice(-1)[0] || new Date().toISOString(),
    cached: input.cached,
    provider: "dataforseo-google-ads-search-volume",
    summary: {
      totalMonthlySearchDemand,
      annualAdReplacementValueGbp,
      projectedMonthlyRevenueGbp,
      projectedAnnualRevenueIncreaseGbp,
      captureRate: SEARCH_CAPTURE_RATE,
      serpClickShare: SERP_CLICK_SHARE_DEFAULT,
      consultationConversion: CONSULTATION_CONVERSION_DEFAULT,
    },
    services,
  };
}

export function loadCachedOpportunityForecast(
  slug: string,
  locationName?: string,
): TenantOpportunityForecast | null {
  const customer = findPharmacyCustomer(slug);
  if (!customer) return null;
  const cache = (customer.opportunityData as TenantOpportunityCache | undefined) || readOpportunityCache(customer.slug);
  if (!cache?.services) return null;
  const location = locationName || cache.locationName || customer.townCity;
  const serviceIds = tenantServices(customer.slug);
  const opportunities = serviceIds
    .map((id) => cache.services[id])
    .filter((row): row is ServiceSearchOpportunity => Boolean(row));
  if (opportunities.length !== serviceIds.length) return null;
  if (location && cache.locationName && cache.locationName.toLowerCase() !== location.toLowerCase()) {
    return null;
  }
  return forecastFromOpportunities({
    slug: customer.slug,
    previewSlug: slug,
    pharmacyName: customer.pharmacyName,
    locationName: cache.locationName,
    opportunities,
    cached: true,
  });
}

export async function buildTenantOpportunityForecast(
  rawSlug: string,
  options: { force?: boolean; locationName?: string } = {},
): Promise<TenantOpportunityForecast> {
  const resolved = resolveRegisteredTenantSlug(rawSlug) || rawSlug;
  const customer = findPharmacyCustomer(resolved);
  if (!customer) throw new Error(`Pharmacy not found: ${rawSlug}`);
  const locationName = options.locationName || customer.townCity || "United Kingdom";
  if (!options.force) {
    const cached = loadCachedOpportunityForecast(customer.slug, locationName);
    if (cached) {
      persistOpportunityOnCustomer(customer.slug, cached);
      return cached;
    }
  }
  const opportunities: ServiceSearchOpportunity[] = [];
  for (const serviceId of tenantServices(customer.slug)) {
    opportunities.push(
      await fetchServiceSearchOpportunity(serviceId, locationName, {
        force: options.force,
        slug: customer.slug,
      }),
    );
  }
  const forecast = forecastFromOpportunities({
    slug: customer.slug,
    previewSlug: rawSlug,
    pharmacyName: customer.pharmacyName,
    locationName,
    opportunities,
    cached: opportunities.every((row) => row.cached),
  });
  persistOpportunityOnCustomer(customer.slug, forecast);
  return forecast;
}

function persistOpportunityOnCustomer(slug: string, forecast: TenantOpportunityForecast): void {
  const cache = readOpportunityCache(slug);
  if (!cache) return;
  cache.capturedAt = forecast.capturedAt;
  cache.forecast = {
    ...forecast.summary,
    capturedAt: forecast.capturedAt,
  };
  writeOpportunityCache(cache);
  persistCustomerOpportunityData(slug, cache);
}
