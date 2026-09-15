import fs from "node:fs";
import path from "node:path";

export type SeoOpportunityPriority = "Critical" | "High" | "Medium" | "Low";
export type SeoOpportunityCategory = "Indexing" | "Ranking" | "Traffic" | "Technical" | "Content";

export interface SeoOpportunity {
  url: string;
  issue: string;
  evidence: Record<string, unknown>;
  priority: SeoOpportunityPriority;
  recommendedAction: string;
  category: SeoOpportunityCategory;
  evidenceStrength: number;
  priorityScore: number;
}

export interface SeoOpportunitySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byCategory: Record<SeoOpportunityCategory, number>;
}

export interface SeoOpportunityValidation {
  outputExists: boolean;
  requiredFieldsPresent: boolean;
  summaryCountsReconcile: boolean;
  topOpportunitiesSorted: boolean;
  duplicateUrlIssuePairs: string[];
  passed: boolean;
}

export interface SeoOpportunitiesReport {
  projectSlug: string;
  generatedAt: string;
  outputPath: string;
  sourceFiles: {
    indexDashboard: string;
    rankTracking: string;
    healthAudit: string;
    lifecycle: string;
    registry: string;
    gscSummary: string;
  };
  summary: SeoOpportunitySummary;
  topOpportunities: SeoOpportunity[];
  opportunities: SeoOpportunity[];
  validation: SeoOpportunityValidation;
}

export interface BuildSeoOpportunitiesOptions {
  outputDir?: string;
}

interface RegistryPage {
  url: string;
  slug?: string;
  remotePath?: string;
  label?: string;
  type?: string;
  status?: string;
  includedInSitemap?: boolean;
  priority?: number;
  source?: string;
}

interface RegistryFile {
  pages?: RegistryPage[];
}

interface LifecycleRecord {
  url: string;
  slug?: string;
  type?: string;
  source?: string;
  deployed?: boolean;
  submitted?: boolean;
  knownToGoogle: boolean;
  crawled: boolean;
  indexed: boolean;
  excluded: boolean;
  lifecycleStatus: string;
  coverageState: string | null;
  lastCheckedTime: string | null;
  impressions: number | null;
  clicks: number | null;
  averagePosition: number | null;
  issues?: string[];
}

interface LifecycleReport {
  summary?: Record<string, unknown>;
  records?: LifecycleRecord[];
}

interface HealthRecord {
  url: string;
  slug?: string;
  type?: string;
  source?: string;
  classifications: string[];
  primaryClassification: string;
  severity: string;
  malformedReasons: string[];
  duplicateReasons: string[];
  orphan: boolean;
  missingLifecycleData: boolean;
  indexed: boolean;
  excluded: boolean;
  impressions: number | null;
  clicks: number | null;
  averagePosition: number | null;
  ctr: number | null;
  actionReason: string;
}

interface HealthAudit {
  records?: HealthRecord[];
}

interface RankRecord {
  keyword: string;
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
  previousAveragePosition: number | null;
  positionChange: number | null;
  direction: string;
  lastUpdated: string;
}

interface RankTrackingReport {
  records?: RankRecord[];
}

interface IndexDashboardReport {
  summary?: Record<string, unknown>;
}

interface GscSummary {
  pagesWithImpressions?: number | null;
  pagesWithClicks?: number | null;
}

const PRIORITY_SCORE: Record<SeoOpportunityPriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const EMPTY_CATEGORY_COUNTS: Record<SeoOpportunityCategory, number> = {
  Indexing: 0,
  Ranking: 0,
  Traffic: 0,
  Technical: 0,
  Content: 0,
};

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function artifactPath(projectSlug: string, outputDir: string, fileName: string): string {
  return path.join(projectDir(projectSlug, outputDir), fileName);
}

function outputPath(projectSlug: string, outputDir: string): string {
  return artifactPath(projectSlug, outputDir, "seo-opportunities.json");
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`Missing SEO opportunity input: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    parsed.hash = "";
    parsed.search = "";
    if (parsed.pathname.endsWith("/") && parsed.pathname.length > 1) parsed.pathname = parsed.pathname.slice(0, -1);
    return parsed.href;
  } catch {
    return String(url || "").trim();
  }
}

function ctr(clicks: number | null | undefined, impressions: number | null | undefined): number | null {
  if (clicks === null || clicks === undefined || impressions === null || impressions === undefined) return null;
  if (impressions <= 0) return 0;
  return clicks / impressions;
}

function isImportantLivePage(page?: RegistryPage): boolean {
  if (!page) return false;
  if (page.status !== "live") return false;
  if (page.includedInSitemap === false) return false;
  if ((page.priority ?? 0) >= 0.8) return true;
  return page.type === "area" || page.type === "hub" || page.type === "money" || page.source === "registry-sync";
}

function isHighPriorityLivePage(page?: RegistryPage): boolean {
  return Boolean(page && page.status === "live" && page.includedInSitemap !== false && (page.priority ?? 0) >= 0.8);
}

function isSupportingPage(page?: RegistryPage): boolean {
  return page?.type === "supporting" || page?.source === "blog-v1" || normaliseUrl(page?.url || "").includes("/blog/");
}

function addOpportunity(
  map: Map<string, SeoOpportunity>,
  opportunity: Omit<SeoOpportunity, "priorityScore">,
): void {
  const key = `${normaliseUrl(opportunity.url)}::${opportunity.issue}`;
  const candidate: SeoOpportunity = {
    ...opportunity,
    priorityScore: PRIORITY_SCORE[opportunity.priority] * 100000 + opportunity.evidenceStrength,
  };
  const existing = map.get(key);
  if (!existing || candidate.priorityScore > existing.priorityScore) {
    map.set(key, candidate);
  }
}

function topRankKeywords(records: RankRecord[], limit = 5): Array<Record<string, unknown>> {
  return records
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks || a.averagePosition - b.averagePosition)
    .slice(0, limit)
    .map((record) => ({
      keyword: record.keyword,
      impressions: record.impressions,
      clicks: record.clicks,
      ctr: record.ctr,
      averagePosition: record.averagePosition,
    }));
}

function summaryFor(opportunities: SeoOpportunity[]): SeoOpportunitySummary {
  const byCategory = { ...EMPTY_CATEGORY_COUNTS };
  for (const opportunity of opportunities) byCategory[opportunity.category] += 1;
  return {
    total: opportunities.length,
    critical: opportunities.filter((item) => item.priority === "Critical").length,
    high: opportunities.filter((item) => item.priority === "High").length,
    medium: opportunities.filter((item) => item.priority === "Medium").length,
    low: opportunities.filter((item) => item.priority === "Low").length,
    byCategory,
  };
}

function hasRequiredFields(opportunity: SeoOpportunity): boolean {
  return Boolean(
    opportunity.url &&
    opportunity.issue &&
    opportunity.evidence &&
    opportunity.priority &&
    opportunity.recommendedAction &&
    opportunity.category
  );
}

function duplicatePairs(opportunities: SeoOpportunity[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const opportunity of opportunities) {
    const key = `${normaliseUrl(opportunity.url)}::${opportunity.issue}`;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates].sort();
}

function sortedCorrectly(opportunities: SeoOpportunity[]): boolean {
  for (let i = 1; i < opportunities.length; i += 1) {
    const prev = opportunities[i - 1];
    const current = opportunities[i];
    if (prev.priorityScore < current.priorityScore) return false;
    if (prev.priorityScore === current.priorityScore && prev.url.localeCompare(current.url) > 0) return false;
  }
  return true;
}

function validationFor(report: Omit<SeoOpportunitiesReport, "validation">): SeoOpportunityValidation {
  const summary = report.summary;
  const opportunities = report.opportunities;
  const requiredFieldsPresent = opportunities.every(hasRequiredFields);
  const summaryCountsReconcile =
    summary.total === opportunities.length &&
    summary.critical + summary.high + summary.medium + summary.low === summary.total &&
    Object.values(summary.byCategory).reduce((sum, count) => sum + count, 0) === summary.total;
  const topOpportunitiesSorted = sortedCorrectly(report.topOpportunities);
  const duplicateUrlIssuePairs = duplicatePairs(opportunities);
  return {
    outputExists: fs.existsSync(report.outputPath),
    requiredFieldsPresent,
    summaryCountsReconcile,
    topOpportunitiesSorted,
    duplicateUrlIssuePairs,
    passed: false,
  };
}

export function buildSeoOpportunities(
  projectSlug: string,
  options: BuildSeoOpportunitiesOptions = {},
): SeoOpportunitiesReport {
  const outputDir = options.outputDir ?? "output";
  const sourceFiles = {
    indexDashboard: artifactPath(projectSlug, outputDir, "index-dashboard.json"),
    rankTracking: artifactPath(projectSlug, outputDir, "rank-tracking.json"),
    healthAudit: artifactPath(projectSlug, outputDir, "url-health-audit.json"),
    lifecycle: artifactPath(projectSlug, outputDir, "url-lifecycle.json"),
    registry: artifactPath(projectSlug, outputDir, "page-registry.json"),
    gscSummary: artifactPath(projectSlug, outputDir, "gsc-summary.json"),
  };

  readJson<IndexDashboardReport>(sourceFiles.indexDashboard);
  const rankTracking = readJson<RankTrackingReport>(sourceFiles.rankTracking);
  const healthAudit = readJson<HealthAudit>(sourceFiles.healthAudit);
  const lifecycle = readJson<LifecycleReport>(sourceFiles.lifecycle);
  const registry = readJson<RegistryFile>(sourceFiles.registry);
  const gscSummary = readJson<GscSummary>(sourceFiles.gscSummary);

  const pagesByUrl = new Map((registry.pages ?? []).map((page) => [normaliseUrl(page.url), page]));
  const healthByUrl = new Map((healthAudit.records ?? []).map((record) => [normaliseUrl(record.url), record]));
  const rankByUrl = new Map<string, RankRecord[]>();
  for (const record of rankTracking.records ?? []) {
    const key = normaliseUrl(record.url);
    rankByUrl.set(key, [...(rankByUrl.get(key) ?? []), record]);
  }

  const opportunities = new Map<string, SeoOpportunity>();

  for (const health of healthAudit.records ?? []) {
    const url = normaliseUrl(health.url);
    const page = pagesByUrl.get(url);
    const impressions = health.impressions ?? 0;
    if (health.classifications.includes("MALFORMED") && impressions > 0) {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Malformed URL receiving impressions",
        evidence: {
          malformedReasons: health.malformedReasons,
          impressions: health.impressions,
          clicks: health.clicks,
          averagePosition: health.averagePosition,
          actionReason: health.actionReason,
        },
        priority: "Critical",
        recommendedAction: "Repair the malformed URL and consolidate signals into the canonical live URL before further optimisation.",
        category: "Technical",
        evidenceStrength: 9000 + impressions,
      });
    }

    if (health.excluded && isImportantLivePage(page)) {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Important live URL excluded from index",
        evidence: {
          classification: health.primaryClassification,
          actionReason: health.actionReason,
          impressions: health.impressions,
          sitemapIncluded: page?.includedInSitemap,
          registryPriority: page?.priority,
        },
        priority: "Critical",
        recommendedAction: "Review the GSC exclusion reason, canonical/indexability state, and sitemap entry for this important URL.",
        category: "Indexing",
        evidenceStrength: 8500 + impressions,
      });
    }

    if (!health.indexed && !health.excluded && isImportantLivePage(page) && !health.missingLifecycleData) {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Important live URL not indexed",
        evidence: {
          classification: health.primaryClassification,
          actionReason: health.actionReason,
          impressions: health.impressions,
          sitemapIncluded: page?.includedInSitemap,
          registryPriority: page?.priority,
        },
        priority: "Critical",
        recommendedAction: "Inspect the URL in GSC, confirm crawlability and canonical alignment, then request indexing after fixes.",
        category: "Indexing",
        evidenceStrength: 8000 + impressions,
      });
    }

    if (health.missingLifecycleData && isHighPriorityLivePage(page)) {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Missing lifecycle data on high-priority live page",
        evidence: {
          actionReason: health.actionReason,
          sitemapIncluded: page?.includedInSitemap,
          registryPriority: page?.priority,
          source: page?.source,
        },
        priority: "Critical",
        recommendedAction: "Refresh URL inspection lifecycle data so indexing status and next actions are reliable.",
        category: "Indexing",
        evidenceStrength: 7000 + (page?.priority ?? 0) * 100,
      });
    }

    if (!health.indexed && page?.includedInSitemap !== false && page?.status === "live") {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Live sitemap URL is not indexed",
        evidence: {
          classification: health.primaryClassification,
          actionReason: health.actionReason,
          lifecycleMissing: health.missingLifecycleData,
          sitemapIncluded: page.includedInSitemap,
          registryPriority: page.priority,
        },
        priority: "High",
        recommendedAction: "Prioritise GSC inspection and indexability checks for this sitemap URL.",
        category: "Indexing",
        evidenceStrength: 5000 + impressions,
      });
    }

    if (health.indexed && (health.impressions === 0 || health.impressions === null)) {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Indexed page has no impressions",
        evidence: {
          indexed: health.indexed,
          impressions: health.impressions,
          clicks: health.clicks,
          averagePosition: health.averagePosition,
          pageType: page?.type,
        },
        priority: "Medium",
        recommendedAction: "Improve query targeting, page title/meta relevance, and contextual internal links to help the indexed page earn impressions.",
        category: "Traffic",
        evidenceStrength: 2500 + (page?.priority ?? 0) * 100,
      });
    }

    if (health.indexed && health.impressions !== null && health.impressions > 0 && (health.ctr ?? ctr(health.clicks, health.impressions) ?? 0) <= 0.01) {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Indexed page has impressions and low CTR",
        evidence: {
          impressions: health.impressions,
          clicks: health.clicks,
          ctr: health.ctr,
          averagePosition: health.averagePosition,
        },
        priority: "High",
        recommendedAction: "Rewrite title/meta for search intent, strengthen above-the-fold promise, and align the page with the queries earning impressions.",
        category: "Traffic",
        evidenceStrength: 5500 + health.impressions,
      });
    }

    if (page?.status === "live" && (health.impressions === null || health.clicks === null)) {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Missing GSC analytics for live page",
        evidence: {
          impressions: health.impressions,
          clicks: health.clicks,
          lifecycleMissing: health.missingLifecycleData,
          pageType: page.type,
          source: page.source,
        },
        priority: "Medium",
        recommendedAction: "Refresh Search Analytics coverage and monitor whether this live page begins earning impressions.",
        category: "Traffic",
        evidenceStrength: 2000 + (page.priority ?? 0) * 100,
      });
    }

    if (isSupportingPage(page) && (health.impressions === null || health.impressions === 0) && page?.status === "live") {
      addOpportunity(opportunities, {
        url: health.url,
        issue: "Supporting page has no traffic yet",
        evidence: {
          pageType: page.type,
          source: page.source,
          impressions: health.impressions,
          clicks: health.clicks,
        },
        priority: "Low",
        recommendedAction: "Monitor the supporting page and add contextual internal links from relevant service pages if it remains inactive.",
        category: "Content",
        evidenceStrength: 1000 + (page.priority ?? 0) * 100,
      });
    }
  }

  for (const [url, records] of rankByUrl) {
    const page = pagesByUrl.get(url);
    const nearPageOne = records.filter((record) => record.averagePosition >= 8 && record.averagePosition <= 30 && record.impressions > 0 && record.clicks <= 1);
    if (nearPageOne.length) {
      const impressions = nearPageOne.reduce((sum, record) => sum + record.impressions, 0);
      addOpportunity(opportunities, {
        url,
        issue: "Near page-one rankings with low clicks",
        evidence: {
          keywords: topRankKeywords(nearPageOne),
          totalImpressions: impressions,
          totalClicks: nearPageOne.reduce((sum, record) => sum + record.clicks, 0),
        },
        priority: "High",
        recommendedAction: "Prioritise title/meta improvements, intent matching, and internal links for the near page-one queries.",
        category: "Ranking",
        evidenceStrength: 6000 + impressions,
      });
    }

    const midRankings = records.filter((record) => record.averagePosition > 30 && record.averagePosition <= 100 && record.impressions > 0);
    if (midRankings.length) {
      const impressions = midRankings.reduce((sum, record) => sum + record.impressions, 0);
      addOpportunity(opportunities, {
        url,
        issue: "Ranking positions 31-100 with impressions",
        evidence: {
          keywords: topRankKeywords(midRankings),
          totalImpressions: impressions,
          pageType: page?.type,
        },
        priority: "Medium",
        recommendedAction: "Strengthen topical relevance and authority for these queries before chasing CTR changes.",
        category: "Ranking",
        evidenceStrength: 3000 + impressions,
      });
    }

    const newLowData = records.filter((record) => record.direction === "new" && record.impressions > 0 && record.impressions < 10);
    if (newLowData.length) {
      addOpportunity(opportunities, {
        url,
        issue: "New keywords with low data",
        evidence: {
          keywords: topRankKeywords(newLowData),
          totalImpressions: newLowData.reduce((sum, record) => sum + record.impressions, 0),
          dateRangeRows: records.length,
        },
        priority: "Low",
        recommendedAction: "Monitor these new query/page matches until there is enough data for a stronger optimisation decision.",
        category: "Ranking",
        evidenceStrength: 1200 + newLowData.reduce((sum, record) => sum + record.impressions, 0),
      });
    }
  }

  for (const lifecycleRecord of lifecycle.records ?? []) {
    const url = normaliseUrl(lifecycleRecord.url);
    const page = pagesByUrl.get(url);
    if (!lifecycleRecord.indexed && page?.status === "live" && page.includedInSitemap !== false) {
      addOpportunity(opportunities, {
        url: lifecycleRecord.url,
        issue: "Live URL requires indexing follow-up",
        evidence: {
          lifecycleStatus: lifecycleRecord.lifecycleStatus,
          coverageState: lifecycleRecord.coverageState,
          lastCheckedTime: lifecycleRecord.lastCheckedTime,
          knownToGoogle: lifecycleRecord.knownToGoogle,
        },
        priority: "High",
        recommendedAction: "Use GSC inspection evidence to decide whether this page needs technical fixes, recrawl, or indexing request.",
        category: "Indexing",
        evidenceStrength: 4500 + (lifecycleRecord.impressions ?? 0),
      });
    }
  }

  const gscPagesWithImpressions = gscSummary.pagesWithImpressions ?? 0;
  const gscPagesWithClicks = gscSummary.pagesWithClicks ?? 0;
  if (gscPagesWithImpressions > 0 && gscPagesWithClicks === 0) {
    addOpportunity(opportunities, {
      url: "sitewide",
      issue: "Site has impressions but no GSC click coverage",
      evidence: {
        pagesWithImpressions: gscPagesWithImpressions,
        pagesWithClicks: gscPagesWithClicks,
      },
      priority: "Medium",
      recommendedAction: "Review sitewide title/meta patterns and compare query intent against page snippets.",
      category: "Traffic",
      evidenceStrength: 2000 + gscPagesWithImpressions,
    });
  }

  const sorted = [...opportunities.values()]
    .sort((a, b) => b.priorityScore - a.priorityScore || a.url.localeCompare(b.url) || a.issue.localeCompare(b.issue));
  const summary = summaryFor(sorted);
  const outPath = outputPath(projectSlug, outputDir);

  const reportWithoutValidation: Omit<SeoOpportunitiesReport, "validation"> = {
    projectSlug,
    generatedAt: new Date().toISOString(),
    outputPath: outPath,
    sourceFiles,
    summary,
    topOpportunities: sorted.slice(0, 20),
    opportunities: sorted,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ ...reportWithoutValidation, validation: {
    outputExists: true,
    requiredFieldsPresent: true,
    summaryCountsReconcile: true,
    topOpportunitiesSorted: true,
    duplicateUrlIssuePairs: [],
    passed: true,
  } }, null, 2), "utf8");

  const validation = validationFor(reportWithoutValidation);
  validation.outputExists = fs.existsSync(outPath);
  validation.passed = validation.outputExists &&
    validation.requiredFieldsPresent &&
    validation.summaryCountsReconcile &&
    validation.topOpportunitiesSorted &&
    validation.duplicateUrlIssuePairs.length === 0;

  const report: SeoOpportunitiesReport = {
    ...reportWithoutValidation,
    validation,
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
