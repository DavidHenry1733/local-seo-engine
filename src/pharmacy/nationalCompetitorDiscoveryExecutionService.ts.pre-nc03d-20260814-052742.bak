/**
 * NC-03C — National Competitor Discovery Execution V1
 *
 * REAL NATIONAL competitor discovery:
 *
 * National query builder
 * -> DataForSEO Google UK organic SERPs
 * -> domain deduplication
 * -> website evidence
 * -> NC-02 qualification
 * -> national evidence persistence
 *
 * This service must never use the Local Growth Engine.
 */

import {
  buildNationalCompetitorDiscoveryQueries,
} from "./nationalCompetitorDiscoveryQueryService.ts";

import {
  qualifyNationalCompetitor,
} from "./nationalCompetitorQualificationService.ts";

import {
  searchNationalGoogleOrganic,
} from "./dataForSeoNationalSearchAdapter.ts";

import {
  emptyNationalCompetitorDiscoveryResult,
  type NationalCompetitorDiscoveryCandidate,
  type NationalCompetitorDiscoveryQuery,
  type NationalCompetitorDiscoveryResult,
} from "./nationalCompetitorDiscoveryModel.ts";

import {
  writeNationalCompetitorDiscovery,
} from "./nationalCompetitorDiscoveryStorageService.ts";

import {
  isNationalGrowthPlatform,
} from "./growthPlatformResolverService.ts";

export interface RunNationalCompetitorDiscoveryInput {
  slug: string;
  businessName: string;
  marketCountry: string;
  targetCustomerMarket: string;
  services: string[];
  ownDomains: string[];
}

interface RawCandidate {
  domain: string;
  url: string;
  title: string;
  description: string;
  bestPosition: number;
  sourceQueries: string[];
}

const EXCLUDED_DOMAIN_PATTERNS = [
  /(^|\.)pharmaconnect\.uk$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)yell\.com$/i,
  /(^|\.)bark\.com$/i,
  /(^|\.)clutch\.co$/i,
  /(^|\.)designrush\.com$/i,
  /(^|\.)sortlist\./i,
  /(^|\.)freeindex\.co\.uk$/i,
  /(^|\.)nhs\.uk$/i,
  /(^|\.)gov\.uk$/i,
];

function cleanDomain(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function isExcludedDomain(
  domain: string,
  ownDomains: string[],
): boolean {
  const d = cleanDomain(domain);

  if (!d) return true;

  if (
    ownDomains
      .map(cleanDomain)
      .filter(Boolean)
      .includes(d)
  ) {
    return true;
  }

  return EXCLUDED_DOMAIN_PATTERNS.some((pattern) =>
    pattern.test(d),
  );
}

function homepageForDomain(domain: string): string {
  return `https://${cleanDomain(domain)}`;
}

function businessNameFromTitle(
  title: string,
  domain: string,
): string {
  const cleaned = String(title || "")
    .split(/\s+[|\-–—]\s+/)[0]
    .trim();

  if (
    cleaned &&
    cleaned.length >= 2 &&
    cleaned.length <= 100
  ) {
    return cleaned;
  }

  return cleanDomain(domain)
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function runNationalCompetitorDiscovery(
  input: RunNationalCompetitorDiscoveryInput,
): Promise<NationalCompetitorDiscoveryResult> {

  if (!isNationalGrowthPlatform(input.slug)) {
    throw new Error(
      `National Competitor Discovery is not applicable to ${input.slug}`,
    );
  }

  const result =
    emptyNationalCompetitorDiscoveryResult(
      input.slug,
      input.marketCountry,
      input.targetCustomerMarket,
    );

  result.status = "running";

  const queries: NationalCompetitorDiscoveryQuery[] =
    buildNationalCompetitorDiscoveryQueries({
      businessName: input.businessName,
      marketCountry: input.marketCountry,
      targetCustomerMarket:
        input.targetCustomerMarket,
      services: input.services,
    });

  result.queries = queries;

  const byDomain = new Map<string, RawCandidate>();

  for (const query of queries) {

    console.log(`SEARCH: ${query.query}`);

    const serp = await searchNationalGoogleOrganic({
      query: query.query,
      marketCountry: query.marketCountry,
      languageCode: "en",
      depth: 10,
    });

    console.log(
      `  organic=${serp.organicResultCount} cost=${serp.cost ?? "n/a"}`,
    );

    for (const row of serp.results) {

      const domain = cleanDomain(row.domain);

      if (
        !domain ||
        isExcludedDomain(domain, input.ownDomains)
      ) {
        continue;
      }

      const previous = byDomain.get(domain);

      if (!previous) {

        byDomain.set(domain, {
          domain,
          url: row.url,
          title: row.title,
          description: row.description,
          bestPosition: row.position || 999,
          sourceQueries: [query.query],
        });

      } else {

        if (
          row.position > 0 &&
          row.position < previous.bestPosition
        ) {
          previous.bestPosition = row.position;
          previous.url = row.url;
          previous.title =
            row.title || previous.title;
          previous.description =
            row.description || previous.description;
        }

        if (
          !previous.sourceQueries.includes(query.query)
        ) {
          previous.sourceQueries.push(query.query);
        }
      }
    }
  }

  const rawCandidates = [...byDomain.values()]
    .sort(
      (a, b) =>
        a.bestPosition - b.bestPosition,
    )
    .slice(0, 40);

  console.log(
    `UNIQUE CANDIDATE DOMAINS: ${rawCandidates.length}`,
  );

  const mapped: NationalCompetitorDiscoveryCandidate[] = [];

  for (const raw of rawCandidates) {

    const evidenceText = [
      raw.title,
      raw.description,
      raw.sourceQueries.join(" "),
    ]
      .filter(Boolean)
      .join(" ");

    const qualification =
      qualifyNationalCompetitor({
        candidateName:
          businessNameFromTitle(
            raw.title,
            raw.domain,
          ),

        domain: raw.domain,

        websiteText: evidenceText,

        targetCustomerMarket:
          input.targetCustomerMarket,

        targetServices:
          input.services,

        ownDomains:
          input.ownDomains,
      });

    const candidate: NationalCompetitorDiscoveryCandidate = {
      id:
        `national-${cleanDomain(raw.domain)
          .replace(/[^a-z0-9]+/g, "-")}`,

      name:
        businessNameFromTitle(
          raw.title,
          raw.domain,
        ),

      domain:
        cleanDomain(raw.domain),

      websiteUrl:
        homepageForDomain(raw.domain),

      marketCountry:
        input.marketCountry,

      targetCustomerMarket:
        input.targetCustomerMarket,

      source:
        "search-engine",

      sourceQuery:
        raw.sourceQueries[0] || null,

      qualification:
        qualification.qualification,

      qualificationReasons:
        qualification.qualificationReasons,

      rejectionReasons:
        qualification.rejectionReasons,

      serviceEvidence:
        qualification.matchedServices.map(
          (service) => ({
            service,
            evidenceUrl: raw.url,
            evidenceText:
              `Service overlap detected from live Google UK search evidence for ${raw.domain}.`,
            confidence:
              Math.min(
                100,
                qualification.score,
              ),
          }),
        ),

      title:
        raw.title || null,

      description:
        raw.description || null,

      evidenceUrls:
        [
          raw.url,
          homepageForDomain(raw.domain),
        ].filter(
          (value, index, arr) =>
            Boolean(value) &&
            arr.indexOf(value) === index,
        ),

      capturedAt:
        new Date().toISOString(),
    };

    mapped.push(candidate);
  }

  result.candidates = mapped;

  result.qualifiedCompetitors =
    mapped.filter(
      (candidate) =>
        candidate.qualification === "qualified",
    );

  result.rejectedCandidates =
    mapped.filter(
      (candidate) =>
        candidate.qualification === "rejected",
    );

  result.generatedAt =
    new Date().toISOString();

  if (
    result.qualifiedCompetitors.length >= 3
  ) {

    result.status = "complete";

  } else {

    result.status =
      "insufficient-evidence";

    result.errors.push(
      `Only ${result.qualifiedCompetitors.length} qualified national competitors were supported by current live evidence.`,
    );
  }

  writeNationalCompetitorDiscovery(result);

  console.log(
    `QUALIFIED COMPETITORS: ${result.qualifiedCompetitors.length}`,
  );

  for (
    const competitor
    of result.qualifiedCompetitors
  ) {
    console.log(
      `  QUALIFIED: ${competitor.name} | ${competitor.domain}`,
    );
  }

  return result;
}
