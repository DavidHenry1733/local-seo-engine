import fs from "node:fs";
import path from "node:path";

type AuditStatus = "PASS" | "WARN" | "FAIL";

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
  knownToGoogle?: boolean;
  crawled?: boolean;
  indexed?: boolean;
  excluded?: boolean;
  lifecycleStatus?: string;
  coverageState?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  averagePosition?: number | null;
  issues?: string[];
}

interface LifecycleReport {
  records?: LifecycleRecord[];
  summary?: Record<string, unknown>;
}

interface HealthRecord {
  url: string;
  slug?: string;
  type?: string;
  source?: string;
  classifications?: string[];
  primaryClassification?: string;
  severity?: string;
  malformedReasons?: string[];
  duplicateReasons?: string[];
  missingLifecycleData?: boolean;
  indexed?: boolean;
  excluded?: boolean;
  impressions?: number | null;
  clicks?: number | null;
  averagePosition?: number | null;
  ctr?: number | null;
  actionReason?: string;
}

interface HealthAudit {
  records?: HealthRecord[];
  summary?: Record<string, unknown>;
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
  records?: RankRecord[];
  summary?: Record<string, unknown>;
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
  opportunities?: SeoOpportunity[];
  topOpportunities?: SeoOpportunity[];
  summary?: Record<string, unknown>;
}

interface SeoHealthScoreReport {
  overallScore?: number;
  grade?: string;
  componentScores?: Record<string, unknown>;
}

interface PageData {
  liveUrl?: string;
  remotePath?: string;
  service?: string;
  tier?: string;
  pageType?: string;
  isHubPage?: boolean;
  status?: string;
  images?: Record<string, unknown>;
  aiReadiness?: {
    score?: number;
    status?: string;
    wordCount?: number;
  };
}

interface PageSignals {
  url: string;
  service: string;
  pageType: string;
  registryStatus: "present" | "missing";
  liveStatus: string;
  deployed: boolean;
  inSitemap: boolean;
  indexed: boolean;
  notIndexed: boolean;
  excluded: boolean;
  impressions: number;
  clicks: number;
  averagePosition: number | null;
  imageStatus: "ok" | "missing" | "partial" | "unknown";
  internalLinkStatus: "ok" | "missing" | "unknown";
  schemaStatus: "ok" | "missing" | "unknown";
  opportunityCount: number;
  malformed: boolean;
  duplicate: boolean;
  missingLifecycleData: boolean;
  nearPageOne: boolean;
  highImpressionsLowClicks: boolean;
  indexedNoImpressions: boolean;
  legacyUrlIssue: boolean;
}

interface AuditGroup {
  pageCount: number;
  liveCount: number;
  deployedCount: number;
  sitemapCount: number;
  registryCount: number;
  indexedCount: number;
  notIndexedCount: number;
  excludedCount: number;
  impressions: number;
  clicks: number;
  averagePosition: number | null;
  imageStatus: Record<string, number>;
  internalLinkStatus: Record<string, number>;
  schemaStatus: Record<string, number>;
  opportunityCount: number;
}

export interface FullPageAuditReport {
  projectSlug: string;
  generatedAt: string;
  outputPath: string;
  sourceFiles: Record<string, string>;
  summary: AuditGroup & {
    registryUrls: number;
    sitemapUrls: number;
    healthScore: number | null;
    healthGrade: string | null;
    malformedUrls: number;
    pagesExcludedFromIndex: number;
    indexedNoImpressions: number;
    nearPageOnePages: number;
    highImpressionsLowClicksPages: number;
    pagesWithNoLifecycleData: number;
    duplicateOrLegacyUrlIssues: number;
  };
  byService: Record<string, AuditGroup>;
  byPageType: Record<string, AuditGroup>;
  topIssues: Array<{
    url: string;
    issue: string;
    category: string;
    severity: string;
    evidence: Record<string, unknown>;
  }>;
  quickWins: Array<{
    url: string;
    issue: string;
    category: string;
    priority: string;
    recommendedAction: string;
    evidence: Record<string, unknown>;
  }>;
  readinessVerdict: {
    status: AuditStatus;
    readyForWiderRollout: boolean;
    reason: string;
  };
  recommendedNextActions: string[];
  pages: PageSignals[];
  validation: {
    outputExists: boolean;
    requiredSectionsPresent: boolean;
    pageCountsReconcile: boolean;
    passed: boolean;
  };
}

export interface BuildFullPageAuditOptions {
  outputDir?: string;
}

const EMPTY_STATUSES = { ok: 0, missing: 0, partial: 0, unknown: 0 };

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function artifactPath(projectSlug: string, outputDir: string, fileName: string): string {
  return path.join(projectDir(projectSlug, outputDir), fileName);
}

function outputPath(projectSlug: string, outputDir: string): string {
  return artifactPath(projectSlug, outputDir, "full-page-audit.json");
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`Missing full page audit input: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function safeReadJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function safeReadText(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
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

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function parseSitemapUrls(file: string): Set<string> {
  const xml = safeReadText(file) ?? "";
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => normaliseUrl(match[1]));
  return new Set(urls);
}

function serviceFor(url: string, page?: RegistryPage | PageData | null): string {
  const source = `${url} ${(page as PageData | undefined)?.service ?? ""}`.toLowerCase();
  if (source.includes("/blog/") || source.endsWith("/blog")) return "blog";
  if (source.includes("web-design")) return "webDesign";
  if (source.includes("local-seo")) return "localSeo";
  if (source.includes("web-hosting") || source.includes("website-hosting")) return "webHosting";
  if (source.includes("email-marketing")) return "emailMarketing";
  if (source.includes("google-business-profile")) return "googleBusinessProfile";
  if (source.includes("local-business-visibility")) return "localBusinessVisibility";
  return "other";
}

function pageTypeFor(url: string, service: string, registryPage?: RegistryPage, pageData?: PageData | null): string {
  if (service === "blog") return "Blog Pages";
  const isHub = pageData?.isHubPage || pageData?.tier === "hub" || registryPage?.type === "hub";
  if (service === "webDesign") return isHub ? "Web Design Hub" : "Web Design Clusters";
  if (service === "localSeo") return isHub ? "Local SEO Hub" : "Local SEO Clusters";
  if (registryPage?.type === "supporting") return "Supporting Pages";
  if (registryPage?.type === "unknown") return "Unknown Registry URLs";
  return "Other Service Pages";
}

function htmlPathFor(baseDir: string, page: RegistryPage): string | null {
  const remotePath = page.remotePath || (() => {
    try {
      return new URL(page.url).pathname;
    } catch {
      return "";
    }
  })();
  if (!remotePath || remotePath.includes("://")) return null;
  const clean = remotePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return path.join(baseDir, clean, "index.html");
}

function pageDataPathFor(baseDir: string, page: RegistryPage): string | null {
  const remotePath = page.remotePath || (() => {
    try {
      return new URL(page.url).pathname;
    } catch {
      return "";
    }
  })();
  if (!remotePath || remotePath.includes("://")) return null;
  const clean = remotePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return path.join(baseDir, clean, "page-data.json");
}

function htmlStatus(html: string | null, pageData: PageData | null): Pick<PageSignals, "imageStatus" | "internalLinkStatus" | "schemaStatus"> {
  if (!html) {
    return {
      imageStatus: pageData?.images || (pageData as Record<string, unknown> | null)?.["image"] ? "ok" : "unknown",
      internalLinkStatus: "unknown",
      schemaStatus: "unknown",
    };
  }
  const imageCount = (html.match(/<img\b/gi) ?? []).length;
  const imageAltCount = (html.match(/<img\b[^>]*\salt=/gi) ?? []).length;
  const internalLinks = [...html.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((href) => href.startsWith("/") || href.includes("local.inboxingproweb.com"));
  const schemaCount = (html.match(/application\/ld\+json/gi) ?? []).length;
  return {
    imageStatus: imageCount === 0 ? "missing" : imageAltCount >= imageCount ? "ok" : "partial",
    internalLinkStatus: internalLinks.length > 0 ? "ok" : "missing",
    schemaStatus: schemaCount > 0 ? "ok" : "missing",
  };
}

function rankByUrl(records: RankRecord[]): Map<string, RankRecord[]> {
  const map = new Map<string, RankRecord[]>();
  for (const record of records) {
    if (!record.url) continue;
    const key = normaliseUrl(record.url);
    map.set(key, [...(map.get(key) ?? []), record]);
  }
  return map;
}

function aggregateRank(records: RankRecord[]): { impressions: number; clicks: number; averagePosition: number | null; nearPageOne: boolean; highImpressionsLowClicks: boolean } {
  const impressions = records.reduce((sum, record) => sum + num(record.impressions), 0);
  const clicks = records.reduce((sum, record) => sum + num(record.clicks), 0);
  const weighted = records.reduce((sum, record) => sum + num(record.averagePosition) * num(record.impressions), 0);
  const averagePosition = impressions > 0 ? round(weighted / impressions) : null;
  const nearPageOne = records.some((record) => num(record.averagePosition, 999) >= 8 && num(record.averagePosition, 999) <= 30 && num(record.impressions) > 0);
  const highImpressionsLowClicks = impressions >= 10 && clicks <= 1;
  return { impressions, clicks, averagePosition, nearPageOne, highImpressionsLowClicks };
}

function emptyGroup(): AuditGroup {
  return {
    pageCount: 0,
    liveCount: 0,
    deployedCount: 0,
    sitemapCount: 0,
    registryCount: 0,
    indexedCount: 0,
    notIndexedCount: 0,
    excludedCount: 0,
    impressions: 0,
    clicks: 0,
    averagePosition: null,
    imageStatus: { ...EMPTY_STATUSES },
    internalLinkStatus: { ok: 0, missing: 0, unknown: 0 },
    schemaStatus: { ok: 0, missing: 0, unknown: 0 },
    opportunityCount: 0,
  };
}

function addToGroup(group: AuditGroup, page: PageSignals): void {
  group.pageCount += 1;
  group.liveCount += page.liveStatus === "live" ? 1 : 0;
  group.deployedCount += page.deployed ? 1 : 0;
  group.sitemapCount += page.inSitemap ? 1 : 0;
  group.registryCount += page.registryStatus === "present" ? 1 : 0;
  group.indexedCount += page.indexed ? 1 : 0;
  group.notIndexedCount += page.notIndexed ? 1 : 0;
  group.excludedCount += page.excluded ? 1 : 0;
  group.impressions += page.impressions;
  group.clicks += page.clicks;
  group.imageStatus[page.imageStatus] = (group.imageStatus[page.imageStatus] ?? 0) + 1;
  group.internalLinkStatus[page.internalLinkStatus] = (group.internalLinkStatus[page.internalLinkStatus] ?? 0) + 1;
  group.schemaStatus[page.schemaStatus] = (group.schemaStatus[page.schemaStatus] ?? 0) + 1;
  group.opportunityCount += page.opportunityCount;
}

function finalizeGroup(group: AuditGroup, pages: PageSignals[]): AuditGroup {
  const withPosition = pages.filter((page) => page.averagePosition !== null && page.impressions > 0);
  const impressions = withPosition.reduce((sum, page) => sum + page.impressions, 0);
  const weighted = withPosition.reduce((sum, page) => sum + (page.averagePosition ?? 0) * page.impressions, 0);
  return {
    ...group,
    impressions: round(group.impressions),
    clicks: round(group.clicks),
    averagePosition: impressions > 0 ? round(weighted / impressions) : null,
  };
}

function opportunityImpact(opportunity: SeoOpportunity): number {
  const priority = { Critical: 4, High: 3, Medium: 2, Low: 1 }[opportunity.priority] ?? 0;
  return num(opportunity.priorityScore, priority * 100000 + num(opportunity.evidenceStrength));
}

export function buildFullPageAudit(projectSlug: string, options: BuildFullPageAuditOptions = {}): FullPageAuditReport {
  const outputDir = options.outputDir ?? "output";
  const baseDir = projectDir(projectSlug, outputDir);
  const sourceFiles = {
    registry: artifactPath(projectSlug, outputDir, "page-registry.json"),
    sitemap: artifactPath(projectSlug, outputDir, "sitemap.xml"),
    lifecycle: artifactPath(projectSlug, outputDir, "url-lifecycle.json"),
    healthAudit: artifactPath(projectSlug, outputDir, "url-health-audit.json"),
    rankTracking: artifactPath(projectSlug, outputDir, "rank-tracking.json"),
    seoOpportunities: artifactPath(projectSlug, outputDir, "seo-opportunities.json"),
    seoHealthScore: artifactPath(projectSlug, outputDir, "seo-health-score.json"),
  };

  const registry = readJson<RegistryFile>(sourceFiles.registry);
  const sitemapUrls = parseSitemapUrls(sourceFiles.sitemap);
  const lifecycle = readJson<LifecycleReport>(sourceFiles.lifecycle);
  const healthAudit = readJson<HealthAudit>(sourceFiles.healthAudit);
  const rankTracking = readJson<RankTrackingReport>(sourceFiles.rankTracking);
  const opportunities = readJson<SeoOpportunitiesReport>(sourceFiles.seoOpportunities);
  const healthScore = readJson<SeoHealthScoreReport>(sourceFiles.seoHealthScore);

  const lifecycleByUrl = new Map((lifecycle.records ?? []).map((record) => [normaliseUrl(record.url), record]));
  const healthByUrl = new Map((healthAudit.records ?? []).map((record) => [normaliseUrl(record.url), record]));
  const ranksByUrl = rankByUrl(rankTracking.records ?? []);
  const opportunitiesByUrl = new Map<string, SeoOpportunity[]>();
  for (const opportunity of opportunities.opportunities ?? []) {
    const key = normaliseUrl(opportunity.url);
    opportunitiesByUrl.set(key, [...(opportunitiesByUrl.get(key) ?? []), opportunity]);
  }

  const pages: PageSignals[] = [];
  for (const registryPage of registry.pages ?? []) {
    const url = normaliseUrl(registryPage.url);
    const lifecycleRecord = lifecycleByUrl.get(url);
    const healthRecord = healthByUrl.get(url);
    const rankRecords = ranksByUrl.get(url) ?? [];
    const rank = aggregateRank(rankRecords);
    const pageData = pageDataPathFor(baseDir, registryPage);
    const loadedPageData = pageData ? safeReadJson<PageData>(pageData) : null;
    const htmlPath = htmlPathFor(baseDir, registryPage);
    const html = htmlPath ? safeReadText(htmlPath) : null;
    const htmlSignals = htmlStatus(html, loadedPageData);
    const pageOpportunities = opportunitiesByUrl.get(url) ?? [];
    const service = serviceFor(registryPage.url, loadedPageData ?? registryPage);
    const malformed = Boolean(healthRecord?.classifications?.includes("MALFORMED"));
    const duplicate = Boolean(healthRecord?.classifications?.includes("DUPLICATE") || (healthRecord?.duplicateReasons?.length ?? 0) > 0);
    const indexed = Boolean(lifecycleRecord?.indexed ?? healthRecord?.indexed);
    const excluded = Boolean(lifecycleRecord?.excluded ?? healthRecord?.excluded);
    const missingLifecycleData = Boolean(healthRecord?.missingLifecycleData || lifecycleRecord?.issues?.includes("missing_gsc_inspection"));
    const impressions = rank.impressions || num(lifecycleRecord?.impressions ?? healthRecord?.impressions);
    const clicks = rank.clicks || num(lifecycleRecord?.clicks ?? healthRecord?.clicks);
    const averagePosition = rank.averagePosition ?? lifecycleRecord?.averagePosition ?? healthRecord?.averagePosition ?? null;
    const legacyUrlIssue = /https:|\/n\/|\/\/|\.\/$|--/.test(urlSafePath(registryPage.url));

    pages.push({
      url: registryPage.url,
      service,
      pageType: pageTypeFor(registryPage.url, service, registryPage, loadedPageData),
      registryStatus: "present",
      liveStatus: registryPage.status ?? "unknown",
      deployed: Boolean(html || loadedPageData || lifecycleRecord?.deployed),
      inSitemap: sitemapUrls.has(url) || registryPage.includedInSitemap === true,
      indexed,
      notIndexed: !indexed,
      excluded,
      impressions,
      clicks,
      averagePosition,
      imageStatus: htmlSignals.imageStatus,
      internalLinkStatus: htmlSignals.internalLinkStatus,
      schemaStatus: htmlSignals.schemaStatus,
      opportunityCount: pageOpportunities.length,
      malformed,
      duplicate,
      missingLifecycleData,
      nearPageOne: rank.nearPageOne || (averagePosition !== null && averagePosition >= 8 && averagePosition <= 30 && impressions > 0),
      highImpressionsLowClicks: rank.highImpressionsLowClicks || (impressions >= 10 && clicks <= 1),
      indexedNoImpressions: indexed && impressions === 0,
      legacyUrlIssue,
    });
  }

  const byService = groupBy(pages, (page) => page.service);
  const byPageType = groupBy(pages, (page) => page.pageType);
  const summaryGroup = finalizeGroup(pages.reduce((group, page) => {
    addToGroup(group, page);
    return group;
  }, emptyGroup()), pages);

  const topIssues = [...(opportunities.opportunities ?? [])]
    .filter((opportunity) => opportunity.priority === "Critical" || opportunity.priority === "High")
    .sort((a, b) => opportunityImpact(b) - opportunityImpact(a))
    .slice(0, 20)
    .map((opportunity) => ({
      url: opportunity.url,
      issue: opportunity.issue,
      category: opportunity.category,
      severity: opportunity.priority,
      evidence: opportunity.evidence ?? {},
    }));

  const quickWins = [...(opportunities.opportunities ?? [])]
    .filter((opportunity) => opportunity.priority === "High" || opportunity.priority === "Medium")
    .sort((a, b) => opportunityImpact(b) - opportunityImpact(a))
    .slice(0, 20)
    .map((opportunity) => ({
      url: opportunity.url,
      issue: opportunity.issue,
      category: opportunity.category,
      priority: opportunity.priority,
      recommendedAction: opportunity.recommendedAction,
      evidence: opportunity.evidence ?? {},
    }));

  const malformedUrls = pages.filter((page) => page.malformed).length;
  const pagesExcludedFromIndex = pages.filter((page) => page.excluded).length;
  const pagesWithNoLifecycleData = pages.filter((page) => page.missingLifecycleData).length;
  const health = num(healthScore.overallScore);
  const readyForWiderRollout = health >= 70 && malformedUrls === 0 && pagesExcludedFromIndex < 10 && pagesWithNoLifecycleData < 20;
  const readinessStatus: AuditStatus = readyForWiderRollout ? "PASS" : health >= 50 ? "WARN" : "FAIL";

  const reportWithoutValidation: Omit<FullPageAuditReport, "validation"> = {
    projectSlug,
    generatedAt: new Date().toISOString(),
    outputPath: outputPath(projectSlug, outputDir),
    sourceFiles,
    summary: {
      ...summaryGroup,
      registryUrls: registry.pages?.length ?? 0,
      sitemapUrls: sitemapUrls.size,
      healthScore: healthScore.overallScore ?? null,
      healthGrade: healthScore.grade ?? null,
      malformedUrls,
      pagesExcludedFromIndex,
      indexedNoImpressions: pages.filter((page) => page.indexedNoImpressions).length,
      nearPageOnePages: pages.filter((page) => page.nearPageOne).length,
      highImpressionsLowClicksPages: pages.filter((page) => page.highImpressionsLowClicks).length,
      pagesWithNoLifecycleData,
      duplicateOrLegacyUrlIssues: pages.filter((page) => page.duplicate || page.legacyUrlIssue).length,
    },
    byService,
    byPageType,
    topIssues,
    quickWins,
    readinessVerdict: {
      status: readinessStatus,
      readyForWiderRollout,
      reason: readyForWiderRollout
        ? "Core SEO layers are healthy enough for controlled wider rollout."
        : "Wider rollout should wait until malformed URLs, exclusion volume, lifecycle gaps, and high-priority opportunities are reduced.",
    },
    recommendedNextActions: [
      "Repair malformed and legacy URL patterns before expanding rollout.",
      "Prioritise excluded live URLs and request reinspection after fixes.",
      "Refresh lifecycle data for pages missing GSC inspection coverage.",
      "Improve title/meta and intent alignment on near page-one pages with low clicks.",
      "Use indexed pages with no impressions as the first content and internal-linking review set.",
    ],
    pages,
  };

  fs.mkdirSync(path.dirname(reportWithoutValidation.outputPath), { recursive: true });
  fs.writeFileSync(reportWithoutValidation.outputPath, JSON.stringify({ ...reportWithoutValidation, validation: {
    outputExists: true,
    requiredSectionsPresent: true,
    pageCountsReconcile: true,
    passed: true,
  } }, null, 2), "utf8");

  const validation = {
    outputExists: fs.existsSync(reportWithoutValidation.outputPath),
    requiredSectionsPresent: Boolean(reportWithoutValidation.summary && reportWithoutValidation.byService && reportWithoutValidation.byPageType && reportWithoutValidation.topIssues && reportWithoutValidation.quickWins),
    pageCountsReconcile: reportWithoutValidation.summary.pageCount === reportWithoutValidation.pages.length,
    passed: false,
  };
  validation.passed = validation.outputExists && validation.requiredSectionsPresent && validation.pageCountsReconcile;

  const report: FullPageAuditReport = { ...reportWithoutValidation, validation };
  fs.writeFileSync(report.outputPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}

function groupBy(pages: PageSignals[], keyFor: (page: PageSignals) => string): Record<string, AuditGroup> {
  const groupedPages = new Map<string, PageSignals[]>();
  for (const page of pages) {
    const key = keyFor(page);
    groupedPages.set(key, [...(groupedPages.get(key) ?? []), page]);
  }
  const result: Record<string, AuditGroup> = {};
  for (const [key, groupPages] of groupedPages) {
    const group = emptyGroup();
    for (const page of groupPages) addToGroup(group, page);
    result[key] = finalizeGroup(group, groupPages);
  }
  return result;
}

function urlSafePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
