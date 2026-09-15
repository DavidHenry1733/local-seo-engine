import fs from "node:fs";
import { scoreCommercialOpportunityV2, type CommercialIntentV2Type } from "./commercialIntentTaxonomyV2.ts";
import { buildPharmaConnectCommercialKeywordTaxonomy } from "./pharmaConnectCommercialKeywordTaxonomy.ts";
import { scoreRankedKeyword } from "./commercialKeywordScoringService.ts";
import { readMarketOpportunityIntelligenceSnapshot } from "./marketOpportunityIntelligenceService.ts";
import {
  DATAFORSEO_LABS_ENDPOINTS,
  getDomainIntersectionWithCost,
  getDomainRankedKeywordsWithCost,
  getKeywordsForSiteWithCost,
  type DataForSeoRankedKeyword,
} from "./dataForSeoRankedKeywordIntelligenceService.ts";
import { resolveNationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";
import {
  ensureNationalIntelligenceDataDir,
  ensureNationalIntelligenceFixtureDir,
  nationalIntelligenceDataPath,
  nationalIntelligenceFixturePath,
  resolveNationalIntelligenceArtifactPath,
  isNationalIntelligenceFixturePath,
} from "./nationalIntelligenceStorageService.ts";
import {
  authorityFromProvenance,
  buildProvenance,
  evidenceSourceFromSnapshot,
  hasAuthoritativeGapEvidence,
  type NationalEvidenceAuthority,
  type NationalIntelligenceEvidenceProvenance,
} from "./nationalIntelligenceEvidenceProvenance.ts";
import { buildCostLedgerFromEndpoints, type NationalIntelligenceCostLedger } from "./nationalIntelligenceCostLedger.ts";

export const NI02C_ENDPOINTS = DATAFORSEO_LABS_ENDPOINTS;

export const NI02C_LIMITS = {
  directCompetitors: 6,
  rankedKeywordLimit: 250,
  keywordsForSiteCompetitors: 3,
  keywordsForSiteLimit: 100,
  domainGapCompetitors: 3,
  domainGapLimit: 100,
  subjectKeywordLimit: 250,
} as const;

type SourceType =
  | "ranked_keyword"
  | "keywords_for_site"
  | "domain_intersection_gap"
  | "persisted_v1";

type OpportunityType =
  | "MONEY_KEYWORD"
  | "COMMERCIAL_SUPPORT"
  | "AUTHORITY_SUPPORT"
  | "NEGATIVE_IRRELEVANT"
  | "REVIEW";

interface EvidenceRow extends DataForSeoRankedKeyword {
  sourceType: SourceType;
  sourceDomain: string;
  sourceClassification: "direct_competitor" | "adjacent_competitor" | "subject";
}

export interface MarketUniverseCustomerKeyword {
  keyword: string;
  position: number | null;
  rankingUrl: string | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  sources: SourceType[];
}

export interface MarketUniverseCompetitorKeyword {
  domain: string;
  keyword: string;
  position: number | null;
  rankingUrl: string | null;
  searchVolume: number | null;
  sources: SourceType[];
}

export interface MarketUniverseIntersectionRow {
  keyword: string;
  customerPresent: boolean;
  customerPosition: number | null;
  competitorRankers: string[];
  bestCompetitorPosition: number | null;
  directCompetitorCount: number;
  hasDomainIntersectionEvidence: boolean;
  sources: SourceType[];
}

export interface MarketUniverseV2Snapshot {
  version: 2;
  generatedAt: string;
  tenantSlug: string;
  subjectDomain: string;
  market: string;
  country: string;
  liveExecution: boolean;
  classificationAuthority: "commercialIntentTaxonomyV2";
  endpoints: Array<{ endpoint: string; used: boolean; requests: number; tasks: number; cost: number }>;
  costs: { requests: number; tasks: number; totalCost: number };
  costLedger: NationalIntelligenceCostLedger;
  provenance: NationalIntelligenceEvidenceProvenance;
  authority: NationalEvidenceAuthority;
  limits: typeof NI02C_LIMITS;
  customerRankedKeywords: MarketUniverseCustomerKeyword[];
  competitorRankedKeywords: MarketUniverseCompetitorKeyword[];
  intersection: MarketUniverseIntersectionRow[];
  universe: Array<{
    keyword: string;
    type: OpportunityType;
    commercialType: CommercialIntentV2Type;
    marketScope: "CORE" | "ADJACENT" | "BROAD" | "NONE";
    qualification: "QUALIFIED" | "REJECTED" | "REVIEW";
    gapType: "UNTAPPED" | "WEAK_COVERAGE" | "DEFEND_IMPROVE" | "NEW_MARKET" | "AUTHORITY_SUPPORT" | "REVIEW";
    searchVolume: number | null;
    cpc: number | null;
    paidCompetition: number | null;
    keywordDifficulty: number | null;
    intent: string | null;
    directCompetitorsRanking: number;
    bestCompetitorDomain: string | null;
    bestCompetitorPosition: number | null;
    bestRankingUrl: string | null;
    subjectPosition: number | null;
    subjectRankingUrl: string | null;
    score: number;
    /** Derived from commercialKeywordScoringService. Not authoritative on the NATIONAL path. */
    legacyCommercialScore: number;
    priority: "HIGH" | "MEDIUM" | "LOW";
    sources: SourceType[];
    reasons: string[];
  }>;
  topCompetitorPages: Array<{
    domain: string;
    url: string;
    qualifiedKeywordCount: number;
    searchDemand: number;
    bestPosition: number | null;
    strongestKeywords: string[];
  }>;
  summary: {
    raw: number;
    unique: number;
    moneyKeywords: number;
    commercialSupport: number;
    authoritySupport: number;
    rejected: number;
    review: number;
    untapped: number;
    weakCoverage: number;
    defendImprove: number;
    newMarket: number;
    qualifiedCommercialSearchDemand: number;
    supportingSearchDemand: number;
    unknownGapRate: number;
    intentCoverage: number;
    difficultyCoverage: number;
    rankingUrlCoverage: number;
  };
  diagnostics: {
    original81RowsAvailable: boolean;
    primaryLimitation: "DISCOVERY" | "TAXONOMY" | "BOTH";
    notes: string[];
  };
}

function json<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function key(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function prioritise(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function toOpportunityType(type: CommercialIntentV2Type): OpportunityType {
  if (type === "MONEY_KEYWORD") return "MONEY_KEYWORD";
  if (type === "COMMERCIAL_SUPPORT") return "COMMERCIAL_SUPPORT";
  if (type === "AUTHORITY_SUPPORT") return "AUTHORITY_SUPPORT";
  if (type === "AMBIGUOUS_REVIEW") return "REVIEW";
  return "NEGATIVE_IRRELEVANT";
}

function emptyUsage(): MarketUniverseV2Snapshot["endpoints"] {
  return [
    { endpoint: NI02C_ENDPOINTS.rankedKeywords, used: false, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.keywordsForSite, used: false, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.domainIntersection, used: false, requests: 0, tasks: 0, cost: 0 },
  ];
}

function buildFromRows(
  slug: string,
  rows: EvidenceRow[],
  liveExecution: boolean,
  endpointUsage: MarketUniverseV2Snapshot["endpoints"],
  options: { fixture: boolean; recovered: boolean },
): MarketUniverseV2Snapshot {
  const subject = resolveNationalIntelligenceSubject(slug);
  const taxonomy = buildPharmaConnectCommercialKeywordTaxonomy();
  const grouped = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const k = key(row.keyword);
    if (!k) continue;
    grouped.set(k, [...(grouped.get(k) || []), row]);
  }

  const universe = [...grouped.entries()].map(([_, evidence]) => {
    const best = [...evidence].sort((a, b) => (a.position || 999) - (b.position || 999))[0];
    const legacy = scoreRankedKeyword(best, taxonomy);
    const directRankers = evidence.filter((row) => row.sourceClassification === "direct_competitor");
    const subjectRow = evidence.find((row) => row.sourceClassification === "subject") || null;
    const hasGap = evidence.some((row) => row.sourceType === "domain_intersection_gap");
    const volume = Math.max(...evidence.map((row) => row.searchVolume || 0), 0) || null;
    const canonical = scoreCommercialOpportunityV2({
      keyword: best.keyword,
      searchVolume: volume,
      cpc: evidence.find((row) => row.cpc !== null)?.cpc ?? null,
      paidCompetition: evidence.find((row) => row.competition !== null)?.competition ?? null,
      directCompetitorsRanking: directRankers.length,
      bestCompetitorPosition: best.position,
      hasDomainGapEvidence: hasGap,
    });
    const supportType = toOpportunityType(canonical.type);
    const qualification =
      canonical.type === "MONEY_KEYWORD" || canonical.type === "COMMERCIAL_SUPPORT" || canonical.type === "AUTHORITY_SUPPORT"
        ? "QUALIFIED"
        : canonical.type === "AMBIGUOUS_REVIEW"
          ? "REVIEW"
          : "REJECTED";
    const bestCompetitor = evidence.find((row) => row.sourceClassification === "direct_competitor") || best;
    const gapType =
      qualification !== "QUALIFIED" ? "REVIEW" :
      hasGap ? "UNTAPPED" :
      subjectRow && best.position && subjectRow.position && subjectRow.position > best.position + 10 ? "WEAK_COVERAGE" :
      subjectRow ? "DEFEND_IMPROVE" :
      "NEW_MARKET";
    const score = qualification !== "QUALIFIED" ? Math.min(canonical.score, 40) : canonical.score;
    const legacyScore = Math.max(0, legacy.positiveScore - legacy.negativeScore);
    const reasons = [
      ...canonical.reasons,
      `${directRankers.length} verified direct competitor(s) rank.`,
      volume ? `Search volume ${volume}.` : "Search volume not available.",
      best.position ? `Best competitor position ${best.position}.` : "Best competitor position not available.",
      subjectRow ? `Subject position ${subjectRow.position ?? "not available"}.` : "Subject coverage not observed in this evidence set.",
      "Classification authority: commercialIntentTaxonomyV2. Legacy taxonomy score retained as derived field.",
    ];
    return {
      keyword: best.keyword,
      type: supportType,
      commercialType: canonical.type,
      marketScope: canonical.marketScope,
      qualification,
      gapType,
      searchVolume: volume,
      cpc: evidence.find((row) => row.cpc !== null)?.cpc ?? null,
      paidCompetition: evidence.find((row) => row.competition !== null)?.competition ?? null,
      keywordDifficulty: null,
      intent: null,
      directCompetitorsRanking: directRankers.length,
      bestCompetitorDomain: bestCompetitor.sourceDomain,
      bestCompetitorPosition: best.position,
      bestRankingUrl: best.url,
      subjectPosition: subjectRow?.position ?? null,
      subjectRankingUrl: subjectRow?.url ?? null,
      score,
      legacyCommercialScore: legacyScore,
      priority: prioritise(score),
      sources: [...new Set(evidence.map((row) => row.sourceType))],
      reasons,
    };
  }).sort((a, b) => b.score - a.score || (b.searchVolume || 0) - (a.searchVolume || 0));

  const pageMap = new Map<string, MarketUniverseV2Snapshot["topCompetitorPages"][number]>();
  for (const item of universe.filter((row) => row.qualification === "QUALIFIED")) {
    for (const row of grouped.get(key(item.keyword)) || []) {
      if (!row.url || row.sourceClassification === "subject") continue;
      const pageKey = `${row.sourceDomain} ${row.url}`;
      const current = pageMap.get(pageKey) || {
        domain: row.sourceDomain,
        url: row.url,
        qualifiedKeywordCount: 0,
        searchDemand: 0,
        bestPosition: row.position,
        strongestKeywords: [],
      };
      current.qualifiedKeywordCount += 1;
      current.searchDemand += item.searchVolume || 0;
      current.bestPosition = Math.min(current.bestPosition || 999, row.position || 999);
      current.strongestKeywords.push(item.keyword);
      pageMap.set(pageKey, current);
    }
  }

  const customerRankedKeywords: MarketUniverseCustomerKeyword[] = [];
  const competitorRankedKeywords: MarketUniverseCompetitorKeyword[] = [];
  const intersection: MarketUniverseIntersectionRow[] = [];
  for (const [keywordKey, evidence] of grouped.entries()) {
    const subjectRows = evidence.filter((row) => row.sourceClassification === "subject");
    const competitorRows = evidence.filter((row) => row.sourceClassification !== "subject");
    const volume = Math.max(...evidence.map((row) => row.searchVolume || 0), 0) || null;
    for (const row of subjectRows) {
      customerRankedKeywords.push({
        keyword: row.keyword,
        position: row.position,
        rankingUrl: row.url,
        searchVolume: row.searchVolume ?? volume,
        cpc: row.cpc,
        competition: row.competition,
        sources: [...new Set(evidence.map((item) => item.sourceType))],
      });
    }
    for (const row of competitorRows) {
      competitorRankedKeywords.push({
        domain: row.sourceDomain,
        keyword: row.keyword,
        position: row.position,
        rankingUrl: row.url,
        searchVolume: row.searchVolume ?? volume,
        sources: [row.sourceType],
      });
    }
    const displayKeyword = evidence[0]?.keyword || keywordKey;
    intersection.push({
      keyword: displayKeyword,
      customerPresent: subjectRows.length > 0,
      customerPosition: subjectRows[0]?.position ?? null,
      competitorRankers: [...new Set(competitorRows.map((row) => row.sourceDomain))],
      bestCompetitorPosition: competitorRows.sort((a, b) => (a.position || 999) - (b.position || 999))[0]?.position ?? null,
      directCompetitorCount: competitorRows.filter((row) => row.sourceClassification === "direct_competitor").length,
      hasDomainIntersectionEvidence: evidence.some((row) => row.sourceType === "domain_intersection_gap"),
      sources: [...new Set(evidence.map((row) => row.sourceType))],
    });
  }

  const money = universe.filter((row) => row.type === "MONEY_KEYWORD");
  const commercialSupport = universe.filter((row) => row.type === "COMMERCIAL_SUPPORT");
  const authority = universe.filter((row) => row.type === "AUTHORITY_SUPPORT");
  const cost = endpointUsage.reduce((sum, row) => sum + row.cost, 0);
  const requests = endpointUsage.reduce((sum, row) => sum + row.requests, 0);
  const tasks = endpointUsage.reduce((sum, row) => sum + row.tasks, 0);
  const recovered = options.recovered || rows.some((row) => row.sourceType === "persisted_v1");
  const evidenceSource = evidenceSourceFromSnapshot({
    liveExecution,
    fixture: options.fixture,
    recovered,
  });
  const provenance = buildProvenance({
    tenantSlug: subject.slug,
    subjectDomain: subject.subjectDomain,
    evidenceSource,
    sourceSystem: "market-universe-v2",
    sourceEndpoint: liveExecution ? NI02C_ENDPOINTS.rankedKeywords : null,
    sourceSnapshot: resolveNationalIntelligenceArtifactPath(slug, "market-opportunity-intelligence-v2"),
    liveExecution,
    calculated: false,
    confidenceBasis: hasAuthoritativeGapEvidence(universe.flatMap((row) => row.sources))
      ? "domain_intersection_gap"
      : "ranked-keyword-comparison-only",
    costContribution: cost,
  });
  const costLedger = buildCostLedgerFromEndpoints({
    tenantSlug: subject.slug,
    snapshotId: `market-universe-v2:${subject.slug}`,
    liveExecution,
    fixture: options.fixture,
    recovered,
    endpoints: endpointUsage,
    sourceSnapshot: provenance.sourceSnapshot,
  });

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    tenantSlug: subject.slug,
    subjectDomain: subject.subjectDomain,
    market: "UK Community Pharmacy Digital Growth",
    country: subject.country || "United Kingdom",
    liveExecution,
    classificationAuthority: "commercialIntentTaxonomyV2",
    endpoints: endpointUsage,
    costs: { requests, tasks, totalCost: cost },
    costLedger,
    provenance,
    authority: authorityFromProvenance({
      liveExecution,
      fixture: options.fixture,
      recovered,
      hasAuthoritativeGapEvidence: universe.some((row) => hasAuthoritativeGapEvidence(row.sources)),
    }),
    limits: NI02C_LIMITS,
    customerRankedKeywords,
    competitorRankedKeywords,
    intersection,
    universe,
    topCompetitorPages: [...pageMap.values()].sort((a, b) => b.searchDemand - a.searchDemand).slice(0, 25),
    summary: {
      raw: rows.length,
      unique: universe.length,
      moneyKeywords: money.length,
      commercialSupport: commercialSupport.length,
      authoritySupport: authority.length,
      rejected: universe.filter((row) => row.qualification === "REJECTED").length,
      review: universe.filter((row) => row.qualification === "REVIEW").length,
      untapped: universe.filter((row) => row.gapType === "UNTAPPED").length,
      weakCoverage: universe.filter((row) => row.gapType === "WEAK_COVERAGE").length,
      defendImprove: universe.filter((row) => row.gapType === "DEFEND_IMPROVE").length,
      newMarket: universe.filter((row) => row.gapType === "NEW_MARKET").length,
      qualifiedCommercialSearchDemand: money.reduce((sum, row) => sum + (row.searchVolume || 0), 0),
      supportingSearchDemand: commercialSupport.reduce((sum, row) => sum + (row.searchVolume || 0), 0),
      unknownGapRate: universe.length ? universe.filter((row) => row.gapType === "REVIEW").length / universe.length : 0,
      intentCoverage: universe.filter((row) => row.intent).length,
      difficultyCoverage: universe.filter((row) => row.keywordDifficulty !== null).length,
      rankingUrlCoverage: universe.filter((row) => row.bestRankingUrl).length,
    },
    diagnostics: {
      original81RowsAvailable: false,
      primaryLimitation: "DISCOVERY",
      notes: liveExecution
        ? ["Live DataForSEO evidence captured with bounded NI-02C controls."]
        : options.fixture
          ? ["Fixture/recovery evidence only. This is not live DataForSEO execution."]
          : ["Persisted national intelligence snapshot. No DataForSEO call was made to serve this read."],
    },
  };
}

export function buildMarketUniverseV2FromFixture(slug: string): MarketUniverseV2Snapshot {
  const v1 = readMarketOpportunityIntelligenceSnapshot(slug);
  const rows: EvidenceRow[] = [];
  for (const item of v1.keywordOpportunities) {
    for (const competitor of item.competitorsRanking) {
      rows.push({
        keyword: item.keyword,
        position: competitor.position,
        searchVolume: item.searchVolume,
        cpc: item.cpc,
        competition: item.competition,
        url: competitor.rankingUrl,
        sourceType: "persisted_v1",
        sourceDomain: competitor.domain,
        sourceClassification: competitor.classification,
      });
    }
  }
  const file = resolveNationalIntelligenceArtifactPath(slug, "market-opportunity-intelligence-v1");
  return buildFromRows(slug, rows, false, emptyUsage(), {
    fixture: isNationalIntelligenceFixturePath(file),
    recovered: true,
  });
}

export async function buildMarketUniverseV2Live(slug: string): Promise<MarketUniverseV2Snapshot> {
  const subject = resolveNationalIntelligenceSubject(slug);
  if (!subject.eligibleForNationalIntelligence || !subject.subjectDomain) {
    throw new Error(`National intelligence live execution is not eligible for ${slug}`);
  }
  const verifiedFile = resolveNationalIntelligenceArtifactPath(slug, "verified-national-competitors");
  if (!verifiedFile) throw new Error("Verified national competitor snapshot not found");
  const verified = json<any>(verifiedFile);
  const direct = (verified.directCompetitors || []).slice(0, NI02C_LIMITS.directCompetitors);
  const strongest = [...direct].sort((a: any, b: any) => (b.confidenceScore || 0) - (a.confidenceScore || 0)).slice(0, NI02C_LIMITS.keywordsForSiteCompetitors);
  const gapCompetitors = strongest.slice(0, NI02C_LIMITS.domainGapCompetitors);
  const rows: EvidenceRow[] = [];
  const usage = [
    { endpoint: NI02C_ENDPOINTS.rankedKeywords, used: true, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.keywordsForSite, used: true, requests: 0, tasks: 0, cost: 0 },
    { endpoint: NI02C_ENDPOINTS.domainIntersection, used: true, requests: 0, tasks: 0, cost: 0 },
  ];

  async function ranked(domain: string, limit: number, sourceClassification: EvidenceRow["sourceClassification"]) {
    const result = await getDomainRankedKeywordsWithCost({
      domain,
      limit,
      orderBy: ["keyword_data.keyword_info.cpc,desc", "keyword_data.keyword_info.search_volume,desc"],
    });
    usage[0].requests += 1; usage[0].tasks += result.tasks; usage[0].cost += result.cost;
    rows.push(...result.rows.map((row) => ({ ...row, sourceType: "ranked_keyword" as const, sourceClassification })));
  }

  async function keywordsForSite(domain: string, sourceClassification: EvidenceRow["sourceClassification"]) {
    const result = await getKeywordsForSiteWithCost({
      domain,
      limit: NI02C_LIMITS.keywordsForSiteLimit,
      orderBy: ["keyword_info.cpc,desc", "keyword_info.search_volume,desc"],
    });
    usage[1].requests += 1; usage[1].tasks += result.tasks; usage[1].cost += result.cost;
    rows.push(...result.rows.map((row) => ({ ...row, sourceType: "keywords_for_site" as const, sourceClassification })));
  }

  async function domainGap(domain: string) {
    const result = await getDomainIntersectionWithCost({
      competitorDomain: domain,
      subjectDomain: subject.subjectDomain,
      intersections: false,
      limit: NI02C_LIMITS.domainGapLimit,
    });
    usage[2].requests += 1; usage[2].tasks += result.tasks; usage[2].cost += result.cost;
    rows.push(...result.rows.map((row) => ({ ...row, sourceType: "domain_intersection_gap" as const, sourceClassification: "direct_competitor" as const })));
  }

  for (const competitor of direct) await ranked(competitor.domain, NI02C_LIMITS.rankedKeywordLimit, "direct_competitor");
  await ranked(subject.subjectDomain, NI02C_LIMITS.subjectKeywordLimit, "subject");
  for (const competitor of strongest) await keywordsForSite(competitor.domain, "direct_competitor");
  await keywordsForSite(subject.subjectDomain, "subject");
  for (const competitor of gapCompetitors) await domainGap(competitor.domain);

  return buildFromRows(slug, rows, true, usage, { fixture: false, recovered: false });
}

export function writeMarketUniverseV2Fixture(slug: string): MarketUniverseV2Snapshot {
  const snapshot = buildMarketUniverseV2FromFixture(slug);
  ensureNationalIntelligenceDataDir();
  ensureNationalIntelligenceFixtureDir();
  fs.writeFileSync(nationalIntelligenceDataPath(slug, "market-opportunity-intelligence-v2"), JSON.stringify(snapshot, null, 2) + "\n");
  fs.writeFileSync(nationalIntelligenceFixturePath(slug, "market-opportunity-intelligence-v2"), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}

export async function writeMarketUniverseV2Live(slug: string): Promise<MarketUniverseV2Snapshot> {
  const snapshot = await buildMarketUniverseV2Live(slug);
  ensureNationalIntelligenceDataDir();
  fs.writeFileSync(nationalIntelligenceDataPath(slug, "market-opportunity-intelligence-v2"), JSON.stringify(snapshot, null, 2) + "\n");
  return snapshot;
}

export function readMarketUniverseV2Snapshot(slug: string): MarketUniverseV2Snapshot {
  const file = resolveNationalIntelligenceArtifactPath(slug, "market-opportunity-intelligence-v2");
  if (file) {
    const snapshot = json<MarketUniverseV2Snapshot>(file);
    if (!snapshot.subjectDomain) {
      snapshot.subjectDomain = resolveNationalIntelligenceSubject(slug).subjectDomain;
    }
    return snapshot;
  }
  return buildMarketUniverseV2FromFixture(slug);
}
