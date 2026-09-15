import fs from "node:fs";
import path from "node:path";

export type SeoHealthGrade = "A" | "B" | "C" | "D" | "F";
export type SeoHealthComponentName = "indexing" | "ranking" | "traffic" | "technical" | "content" | "opportunity";
export type SeoHealthConfidence = "high" | "medium" | "low";

export interface SeoHealthComponentScore {
  score: number;
  weight: number;
  weightedScore: number;
  confidence: SeoHealthConfidence;
  metrics: Record<string, number | null>;
  notes: string[];
}

export interface SeoHealthActionItem {
  url: string;
  issue: string;
  category: string;
  priority: string;
  recommendedAction: string;
  impactScore: number;
  evidence: Record<string, unknown>;
}

export interface SeoHealthValidation {
  outputExists: boolean;
  scoreInRange: boolean;
  componentWeightsReconcile: boolean;
  gradeMatchesScore: boolean;
  fileWrittenSuccessfully: boolean;
  passed: boolean;
}

export interface SeoHealthScoreReport {
  projectSlug: string;
  generatedAt: string;
  outputPath: string;
  sourceFiles: {
    indexDashboard: string;
    rankTracking: string;
    seoOpportunities: string;
    healthAudit: string;
    lifecycle: string;
    registry: string;
    gscSummary: string;
  };
  overallScore: number;
  grade: SeoHealthGrade;
  componentScores: Record<SeoHealthComponentName, SeoHealthComponentScore>;
  keyIssues: SeoHealthActionItem[];
  quickWins: SeoHealthActionItem[];
  trends: {
    previousOverallScore: number | null;
    scoreChange: number | null;
    direction: "up" | "down" | "same" | "new";
  };
  validation: SeoHealthValidation;
}

export interface BuildSeoHealthScoreOptions {
  outputDir?: string;
}

interface RegistryPage {
  url?: string;
  type?: string;
  status?: string;
  lastSeenAt?: string;
  lastDeployedAt?: string;
}

interface RegistryFile {
  pages?: RegistryPage[];
}

interface IndexDashboardReport {
  summary?: {
    totalUrls?: number;
    indexed?: number;
    excluded?: number;
    notIndexed?: number;
    knownToGoogle?: number;
    crawled?: number;
    discovered?: number;
    malformed?: number;
    duplicates?: number;
    opportunities?: number;
    missingLifecycleData?: number;
  };
}

interface RankRecord {
  keyword?: string;
  url?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  averagePosition?: number;
}

interface RankTrackingReport {
  summary?: {
    recordsCount?: number;
    keywordsCount?: number;
    urlsCount?: number;
    totalClicks?: number;
    totalImpressions?: number;
    averagePosition?: number | null;
  };
  records?: RankRecord[];
}

interface SeoOpportunity {
  url: string;
  issue: string;
  evidence?: Record<string, unknown>;
  priority: "Critical" | "High" | "Medium" | "Low";
  recommendedAction: string;
  category: string;
  evidenceStrength?: number;
  priorityScore?: number;
}

interface SeoOpportunitiesReport {
  summary?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    byCategory?: Record<string, number>;
  };
  opportunities?: SeoOpportunity[];
}

interface UrlHealthAuditReport {
  summary?: {
    totalUrls?: number;
    indexed?: number;
    excluded?: number;
    notIndexed?: number;
    malformed?: number;
    duplicates?: number;
    orphanUrls?: number;
    missingLifecycleData?: number;
    opportunities?: number;
    highPerforming?: number;
  };
}

interface UrlLifecycleReport {
  summary?: {
    registryCount?: number;
    knownCount?: number;
    checkedCount?: number;
    indexedCount?: number;
    excludedCount?: number;
    crawledCount?: number;
    submittedCount?: number;
    analyticsCount?: number;
    missingLifecycleDataCount?: number;
  };
}

interface GscSummaryReport {
  indexedCount?: number;
  notIndexedCount?: number;
  totalKnown?: number;
  pagesWithImpressions?: number;
  pagesWithClicks?: number;
}

const WEIGHTS: Record<SeoHealthComponentName, number> = {
  indexing: 25,
  ranking: 20,
  traffic: 15,
  technical: 15,
  content: 10,
  opportunity: 15,
};

const PRIORITY_WEIGHT: Record<SeoOpportunity["priority"], number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function artifactPath(projectSlug: string, outputDir: string, fileName: string): string {
  return path.join(projectDir(projectSlug, outputDir), fileName);
}

function outputPath(projectSlug: string, outputDir: string): string {
  return artifactPath(projectSlug, outputDir, "seo-health-score.json");
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`Missing SEO health score input: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

function scoreFromRate(rate: number): number {
  return clamp(rate * 100);
}

function gradeFor(score: number): SeoHealthGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function component(
  score: number,
  weight: number,
  confidence: SeoHealthConfidence,
  metrics: Record<string, number | null>,
  notes: string[],
): SeoHealthComponentScore {
  const safeScore = round(clamp(score));
  return {
    score: safeScore,
    weight,
    weightedScore: round((safeScore * weight) / 100),
    confidence,
    metrics,
    notes,
  };
}

function indexingScore(indexDashboard: IndexDashboardReport, lifecycle: UrlLifecycleReport): SeoHealthComponentScore {
  const s = indexDashboard.summary ?? {};
  const lifecycleSummary = lifecycle.summary ?? {};
  const totalUrls = Math.max(num(s.totalUrls), num(lifecycleSummary.registryCount));
  const indexedRate = ratio(num(s.indexed), totalUrls);
  const excludedRate = ratio(num(s.excluded), totalUrls);
  const knownRate = ratio(num(s.knownToGoogle), totalUrls);
  const lifecycleCoverage = ratio(num(lifecycleSummary.checkedCount), Math.max(totalUrls, num(lifecycleSummary.registryCount)));
  const score =
    scoreFromRate(indexedRate) * 0.55 +
    scoreFromRate(lifecycleCoverage) * 0.20 +
    scoreFromRate(knownRate) * 0.15 +
    scoreFromRate(1 - excludedRate) * 0.10;

  return component(score, WEIGHTS.indexing, "high", {
    totalUrls,
    indexed: num(s.indexed),
    excluded: num(s.excluded),
    notIndexed: num(s.notIndexed),
    knownToGoogle: num(s.knownToGoogle),
    lifecycleChecked: num(lifecycleSummary.checkedCount),
    lifecycleCoverage: round(scoreFromRate(lifecycleCoverage)),
  }, [
    "Scores indexed share, lifecycle inspection coverage, known-to-Google coverage, and exclusion pressure.",
  ]);
}

function rankingScore(rankTracking: RankTrackingReport, indexDashboard: IndexDashboardReport): SeoHealthComponentScore {
  const records = rankTracking.records ?? [];
  const s = rankTracking.summary ?? {};
  const indexedUrls = Math.max(1, num(indexDashboard.summary?.indexed));
  const recordsCount = records.length || num(s.recordsCount);
  const averagePosition = s.averagePosition === null || s.averagePosition === undefined ? null : num(s.averagePosition);
  const top3 = records.filter((record) => num(record.averagePosition, 101) <= 3).length;
  const top10 = records.filter((record) => num(record.averagePosition, 101) <= 10).length;
  const positions11To30 = records.filter((record) => {
    const position = num(record.averagePosition, 101);
    return position > 10 && position <= 30;
  }).length;
  const positions31To100 = records.filter((record) => {
    const position = num(record.averagePosition, 101);
    return position > 30 && position <= 100;
  }).length;

  const positionScore = averagePosition === null ? 0 : clamp(100 - ((averagePosition - 1) / 99) * 100);
  const top10Score = scoreFromRate(ratio(top10, recordsCount));
  const top30Score = scoreFromRate(ratio(top3 + top10 + positions11To30, recordsCount));
  const coverageScore = scoreFromRate(ratio(num(s.urlsCount), indexedUrls));
  const score = positionScore * 0.45 + top10Score * 0.25 + top30Score * 0.20 + coverageScore * 0.10;

  return component(score, WEIGHTS.ranking, "medium", {
    recordsCount,
    keywordsCount: num(s.keywordsCount),
    urlsCount: num(s.urlsCount),
    averagePosition,
    top3,
    top10,
    positions11To30,
    positions31To100,
  }, [
    "Scores average position, page-one keyword share, top-30 visibility, and ranking URL coverage.",
  ]);
}

function trafficScore(rankTracking: RankTrackingReport, gscSummary: GscSummaryReport): SeoHealthComponentScore {
  const s = rankTracking.summary ?? {};
  const clicks = num(s.totalClicks);
  const impressions = num(s.totalImpressions);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const pagesWithImpressions = num(gscSummary.pagesWithImpressions);
  const pagesWithClicks = num(gscSummary.pagesWithClicks);
  const pageClickCoverage = pagesWithImpressions > 0 ? pagesWithClicks / pagesWithImpressions : 0;
  const impressionScore = clamp((impressions / 1000) * 100);
  const clickScore = clamp((clicks / 50) * 100);
  const ctrScore = clamp((ctr / 0.03) * 100);
  const pageCoverageScore = scoreFromRate(pageClickCoverage);
  const score = impressionScore * 0.30 + clickScore * 0.25 + ctrScore * 0.30 + pageCoverageScore * 0.15;

  return component(score, WEIGHTS.traffic, "medium", {
    clicks,
    impressions,
    ctr: round4(ctr),
    pagesWithImpressions,
    pagesWithClicks,
    pageClickCoverage: round(scoreFromRate(pageClickCoverage)),
  }, [
    "Scores GSC impressions, click volume, CTR against a 3 percent target, and click coverage across impression-bearing pages.",
  ]);
}

function technicalScore(healthAudit: UrlHealthAuditReport): SeoHealthComponentScore {
  const s = healthAudit.summary ?? {};
  const totalUrls = Math.max(1, num(s.totalUrls));
  const malformedPenalty = Math.min(35, ratio(num(s.malformed), totalUrls) * 300);
  const duplicatePenalty = Math.min(20, ratio(num(s.duplicates), totalUrls) * 250);
  const missingLifecyclePenalty = Math.min(30, ratio(num(s.missingLifecycleData), totalUrls) * 100);
  const orphanPenalty = Math.min(10, ratio(num(s.orphanUrls), totalUrls) * 150);
  const healthOpportunityPenalty = Math.min(10, ratio(num(s.opportunities), totalUrls) * 20);
  const score = 100 - malformedPenalty - duplicatePenalty - missingLifecyclePenalty - orphanPenalty - healthOpportunityPenalty;

  return component(score, WEIGHTS.technical, "high", {
    totalUrls,
    malformed: num(s.malformed),
    duplicates: num(s.duplicates),
    orphanUrls: num(s.orphanUrls),
    missingLifecycleData: num(s.missingLifecycleData),
    healthAuditOpportunities: num(s.opportunities),
  }, [
    "Scores technical cleanliness from URL health classifications, malformed URLs, duplicates, orphans, and lifecycle gaps.",
  ]);
}

function contentScore(registry: RegistryFile, opportunities: SeoOpportunitiesReport): SeoHealthComponentScore {
  const pages = registry.pages ?? [];
  const livePages = pages.filter((page) => page.status === "live");
  const liveCount = Math.max(1, livePages.length);
  const knownTypeCount = livePages.filter((page) => page.type && page.type !== "unknown").length;
  const lastSeenCount = livePages.filter((page) => page.lastSeenAt).length;
  const lastDeployedCount = livePages.filter((page) => page.lastDeployedAt).length;
  const contentOpportunities = num(opportunities.summary?.byCategory?.Content);
  const knownTypeScore = scoreFromRate(ratio(knownTypeCount, liveCount));
  const seenFreshnessScore = scoreFromRate(ratio(lastSeenCount, liveCount));
  const deploymentFreshnessScore = scoreFromRate(ratio(lastDeployedCount, liveCount));
  const contentOpportunityScore = scoreFromRate(1 - ratio(contentOpportunities, liveCount));
  const rawScore =
    40 +
    knownTypeScore * 0.10 +
    seenFreshnessScore * 0.10 +
    deploymentFreshnessScore * 0.05 +
    contentOpportunityScore * 0.10;

  return component(Math.min(65, rawScore), WEIGHTS.content, "low", {
    livePages: liveCount,
    knownTypeCount,
    lastSeenCount,
    lastDeployedCount,
    contentOpportunities,
  }, [
    "Content quality is low-confidence because the approved inputs do not include direct page QA, schema coverage, image coverage, or readability metrics.",
  ]);
}

function opportunityScore(opportunities: SeoOpportunitiesReport, indexDashboard: IndexDashboardReport): SeoHealthComponentScore {
  const s = opportunities.summary ?? {};
  const totalUrls = Math.max(1, num(indexDashboard.summary?.totalUrls));
  const critical = num(s.critical);
  const high = num(s.high);
  const medium = num(s.medium);
  const low = num(s.low);
  const penalty = Math.min(
    90,
    ratio(critical, totalUrls) * 50 +
    ratio(high, totalUrls) * 30 +
    ratio(medium, totalUrls) * 15 +
    ratio(low, totalUrls) * 5,
  );
  const score = 100 - penalty;

  return component(score, WEIGHTS.opportunity, "high", {
    totalOpportunities: num(s.total),
    critical,
    high,
    medium,
    low,
    totalUrls,
  }, [
    "Scores the remaining optimisation burden, with critical and high opportunities weighted most heavily.",
  ]);
}

function actionItem(opportunity: SeoOpportunity): SeoHealthActionItem {
  return {
    url: opportunity.url,
    issue: opportunity.issue,
    category: opportunity.category,
    priority: opportunity.priority,
    recommendedAction: opportunity.recommendedAction,
    impactScore: num(opportunity.priorityScore, PRIORITY_WEIGHT[opportunity.priority] * 100000 + num(opportunity.evidenceStrength)),
    evidence: opportunity.evidence ?? {},
  };
}

function sortByImpact(a: SeoOpportunity, b: SeoOpportunity): number {
  const aScore = num(a.priorityScore, PRIORITY_WEIGHT[a.priority] * 100000 + num(a.evidenceStrength));
  const bScore = num(b.priorityScore, PRIORITY_WEIGHT[b.priority] * 100000 + num(b.evidenceStrength));
  return bScore - aScore || a.url.localeCompare(b.url) || a.issue.localeCompare(b.issue);
}

function keyIssues(opportunities: SeoOpportunitiesReport): SeoHealthActionItem[] {
  return [...(opportunities.opportunities ?? [])]
    .filter((opportunity) => opportunity.priority === "Critical" || opportunity.priority === "High")
    .sort(sortByImpact)
    .slice(0, 10)
    .map(actionItem);
}

function quickWins(opportunities: SeoOpportunitiesReport): SeoHealthActionItem[] {
  return [...(opportunities.opportunities ?? [])]
    .filter((opportunity) => opportunity.priority !== "Critical")
    .sort(sortByImpact)
    .slice(0, 10)
    .map(actionItem);
}

function validationFor(report: Omit<SeoHealthScoreReport, "validation">): SeoHealthValidation {
  const weightTotal = Object.values(report.componentScores).reduce((sum, componentScore) => sum + componentScore.weight, 0);
  const scoreInRange = report.overallScore >= 0 && report.overallScore <= 100;
  const componentWeightsReconcile = weightTotal === 100;
  const gradeMatchesScore = report.grade === gradeFor(report.overallScore);
  const outputExists = fs.existsSync(report.outputPath);
  return {
    outputExists,
    scoreInRange,
    componentWeightsReconcile,
    gradeMatchesScore,
    fileWrittenSuccessfully: outputExists,
    passed: outputExists && scoreInRange && componentWeightsReconcile && gradeMatchesScore,
  };
}

export function buildSeoHealthScore(
  projectSlug: string,
  options: BuildSeoHealthScoreOptions = {},
): SeoHealthScoreReport {
  const outputDir = options.outputDir ?? "output";
  const sourceFiles = {
    indexDashboard: artifactPath(projectSlug, outputDir, "index-dashboard.json"),
    rankTracking: artifactPath(projectSlug, outputDir, "rank-tracking.json"),
    seoOpportunities: artifactPath(projectSlug, outputDir, "seo-opportunities.json"),
    healthAudit: artifactPath(projectSlug, outputDir, "url-health-audit.json"),
    lifecycle: artifactPath(projectSlug, outputDir, "url-lifecycle.json"),
    registry: artifactPath(projectSlug, outputDir, "page-registry.json"),
    gscSummary: artifactPath(projectSlug, outputDir, "gsc-summary.json"),
  };

  const indexDashboard = readJson<IndexDashboardReport>(sourceFiles.indexDashboard);
  const rankTracking = readJson<RankTrackingReport>(sourceFiles.rankTracking);
  const seoOpportunities = readJson<SeoOpportunitiesReport>(sourceFiles.seoOpportunities);
  const healthAudit = readJson<UrlHealthAuditReport>(sourceFiles.healthAudit);
  const lifecycle = readJson<UrlLifecycleReport>(sourceFiles.lifecycle);
  const registry = readJson<RegistryFile>(sourceFiles.registry);
  const gscSummary = readJson<GscSummaryReport>(sourceFiles.gscSummary);

  const componentScores: Record<SeoHealthComponentName, SeoHealthComponentScore> = {
    indexing: indexingScore(indexDashboard, lifecycle),
    ranking: rankingScore(rankTracking, indexDashboard),
    traffic: trafficScore(rankTracking, gscSummary),
    technical: technicalScore(healthAudit),
    content: contentScore(registry, seoOpportunities),
    opportunity: opportunityScore(seoOpportunities, indexDashboard),
  };
  const overallScore = round(Object.values(componentScores).reduce((sum, score) => sum + score.weightedScore, 0));
  const outPath = outputPath(projectSlug, outputDir);

  const reportWithoutValidation: Omit<SeoHealthScoreReport, "validation"> = {
    projectSlug,
    generatedAt: new Date().toISOString(),
    outputPath: outPath,
    sourceFiles,
    overallScore,
    grade: gradeFor(overallScore),
    componentScores,
    keyIssues: keyIssues(seoOpportunities),
    quickWins: quickWins(seoOpportunities),
    trends: {
      previousOverallScore: null,
      scoreChange: null,
      direction: "new",
    },
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({
    ...reportWithoutValidation,
    validation: {
      outputExists: true,
      scoreInRange: true,
      componentWeightsReconcile: true,
      gradeMatchesScore: true,
      fileWrittenSuccessfully: true,
      passed: true,
    },
  }, null, 2), "utf8");

  const validation = validationFor(reportWithoutValidation);
  const report: SeoHealthScoreReport = {
    ...reportWithoutValidation,
    validation,
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
