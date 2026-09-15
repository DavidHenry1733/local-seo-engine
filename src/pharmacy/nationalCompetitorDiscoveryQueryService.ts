/**
 * NC-02 — National Competitor Discovery Query Service V1
 *
 * Builds NATIONAL commercial competitor discovery queries.
 *
 * Physical office locality is deliberately excluded.
 */

import type {
  NationalCompetitorDiscoveryQuery,
} from "./nationalCompetitorDiscoveryModel.ts";

export interface NationalDiscoveryBusinessContext {
  businessName: string;
  marketCountry: string;
  targetCustomerMarket: string;
  services: string[];
}

function clean(value: unknown): string {
  return String(value || "").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function queryId(index: number): string {
  return `national-query-${String(index + 1).padStart(2, "0")}`;
}

export function buildNationalCompetitorDiscoveryQueries(
  context: NationalDiscoveryBusinessContext,
): NationalCompetitorDiscoveryQuery[] {
  const country = clean(context.marketCountry) || "United Kingdom";
  const customerMarket =
    clean(context.targetCustomerMarket) || "UK community pharmacies";

  const services = unique(context.services);

  const raw: Array<{
    query: string;
    serviceIntent: string;
    reason: string;
  }> = [];

  raw.push({
    query: `digital marketing services for pharmacies ${country}`,
    serviceIntent: "pharmacy digital marketing",
    reason:
      "Identify businesses nationally competing for pharmacy digital-growth customers.",
  });

  raw.push({
    query: `pharmacy website design ${country}`,
    serviceIntent: "pharmacy website design",
    reason:
      "Identify national providers competing for pharmacy website-design demand.",
  });

  raw.push({
    query: `SEO services for pharmacies ${country}`,
    serviceIntent: "pharmacy SEO",
    reason:
      "Identify national providers competing for pharmacy search-marketing demand.",
  });

  raw.push({
    query: `pharmacy marketing agency ${country}`,
    serviceIntent: "pharmacy marketing agency",
    reason:
      "Identify specialist agencies targeting pharmacies nationally.",
  });

  for (const service of services) {
    raw.push({
      query: `${service} for pharmacies ${country}`,
      serviceIntent: service,
      reason:
        `Identify national businesses competing for the ${service} pharmacy market.`,
    });
  }

  const seen = new Set<string>();

  return raw
    .filter((row) => {
      const key = row.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row, index) => ({
      id: queryId(index),
      query: row.query,
      marketCountry: country,
      targetCustomerMarket: customerMarket,
      serviceIntent: row.serviceIntent,
      evidenceReason: row.reason,
    }));
}
