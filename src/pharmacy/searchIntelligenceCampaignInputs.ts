/**
 * Campaign/service-driven Search Intelligence query derivation.
 * Demand and organic seeds come from the supplied service — never a Pharmacy First fallback.
 */
import { buildServiceSearchDemandQueries } from "./serviceSearchDemandQueryBuilder.ts";
import { resolveConsumerDemandLanguage } from "./serviceSearchDemandMetadata.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

const ORGANIC_QUERY_LIMIT = 4;

export type SearchIntelligenceCampaignInput = {
  serviceId: string;
  pharmacyName?: string;
  town?: string;
  postcode?: string;
};

export type SearchIntelligenceCampaignQueries = {
  serviceId: string;
  serviceName: string;
  demandQueries: string[];
  organicQueries: string[];
};

function clean(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = clean(raw);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function resolveCampaignServiceName(serviceId: string): string {
  const id = clean(serviceId);
  const lang = resolveConsumerDemandLanguage(id);
  if (lang?.serviceName) return lang.serviceName;
  return getServicePublishMeta(id)?.serviceName || id;
}

/** Deterministic Search Intelligence inputs for one campaign service. */
export function buildSearchIntelligenceCampaignQueries(
  input: SearchIntelligenceCampaignInput,
): SearchIntelligenceCampaignQueries {
  const serviceId = clean(input.serviceId);
  const serviceName = resolveCampaignServiceName(serviceId);
  const pharmacyName = clean(input.pharmacyName);
  const town = clean(input.town);
  const postcode = clean(input.postcode);

  const demandQueries = serviceId ? buildServiceSearchDemandQueries({ serviceId }) : [];

  const organicRaw: string[] = [];
  if (serviceName) {
    if (town) organicRaw.push(`${serviceName} ${town}`);
    if (postcode) organicRaw.push(`${serviceName} ${postcode}`);
    if (pharmacyName) organicRaw.push(`${pharmacyName} ${serviceName}`);
  }
  if (pharmacyName && town) organicRaw.push(`${pharmacyName} ${town}`);

  return {
    serviceId,
    serviceName,
    demandQueries,
    organicQueries: unique(organicRaw).slice(0, ORGANIC_QUERY_LIMIT),
  };
}
