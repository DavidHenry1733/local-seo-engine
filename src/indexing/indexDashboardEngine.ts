import fs from "node:fs";
import path from "node:path";
import type { UrlHealthAudit, UrlHealthRecord } from "./urlHealthAuditEngine";
import type { UrlLifecycleRecord, UrlLifecycleReport } from "./urlLifecycleEngine";

export type DashboardServiceKey = "webDesign" | "localSeo" | "hosting" | "emailMarketing" | "blog" | "other";
export type DashboardStatusGroup = "INDEXED" | "NOT_INDEXED" | "EXCLUDED" | "MALFORMED" | "OPPORTUNITY";

interface RegistryPage {
  url: string;
  slug?: string;
  remotePath?: string;
  label?: string;
  type?: string;
  source?: string;
}

interface RegistryFile {
  projectSlug?: string;
  updatedAt?: string;
  pages?: RegistryPage[];
}

interface DashboardUrlRecord {
  url: string;
  slug?: string;
  label?: string;
  service: DashboardServiceKey;
  serviceLabel: string;
  indexed: boolean;
  excluded: boolean;
  knownToGoogle: boolean;
  crawled: boolean;
  discovered: boolean;
  malformed: boolean;
  duplicate: boolean;
  opportunity: boolean;
  missingLifecycleData: boolean;
  impressions: number;
  clicks: number;
  averagePosition: number | null;
  ctr: number | null;
  statusGroups: DashboardStatusGroup[];
  actionReason: string | null;
}

export interface DashboardServiceBreakdown {
  service: DashboardServiceKey;
  label: string;
  urlCount: number;
  indexedCount: number;
  impressions: number;
  clicks: number;
  averagePosition: number | null;
}

export interface IndexDashboardSummary {
  totalUrls: number;
  indexed: number;
  excluded: number;
  notIndexed: number;
  knownToGoogle: number;
  crawled: number;
  discovered: number;
  malformed: number;
  duplicates: number;
  opportunities: number;
  missingLifecycleData: number;
}

export interface IndexDashboardValidation {
  registryCountMatchesLifecycle: boolean;
  registryCountMatchesHealth: boolean;
  indexedMatchesLifecycle: boolean;
  excludedMatchesLifecycle: boolean;
  malformedMatchesHealth: boolean;
  duplicatesMatchesHealth: boolean;
  opportunitiesMatchesHealth: boolean;
  missingLifecycleMatchesHealth: boolean;
  passed: boolean;
}

export interface IndexDashboard {
  projectSlug: string;
  generatedAt: string;
  outputPath: string;
  sourceFiles: {
    registry: string;
    lifecycle: string;
    health: string;
  };
  summary: IndexDashboardSummary;
  serviceBreakdown: DashboardServiceBreakdown[];
  statusGroups: Record<DashboardStatusGroup, DashboardUrlRecord[]>;
  topOpportunities: DashboardUrlRecord[];
  validation: IndexDashboardValidation;
}

export interface BuildIndexDashboardOptions {
  outputDir?: string;
}

const SERVICE_LABELS: Record<DashboardServiceKey, string> = {
  webDesign: "Web Design",
  localSeo: "Local SEO",
  hosting: "Hosting",
  emailMarketing: "Email Marketing",
  blog: "Blog",
  other: "Other",
};

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function registryPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "page-registry.json");
}

function lifecyclePath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "url-lifecycle.json");
}

function healthPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "url-health-audit.json");
}

function outputPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "index-dashboard.json");
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`Missing dashboard input: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
    return parsed.toString();
  } catch {
    return String(url || "").trim();
  }
}

function serviceFor(page: RegistryPage, lifecycle?: UrlLifecycleRecord): DashboardServiceKey {
  const text = `${page.url} ${page.slug || ""} ${page.remotePath || ""} ${page.label || ""} ${lifecycle?.source || ""}`.toLowerCase();
  if (text.includes("/blog/") || text.includes(" blog") || page.source === "blog-v1") return "blog";
  if (text.includes("web-design") || text.includes("website design") || text.includes("small-business-web-design")) return "webDesign";
  if (text.includes("local-seo") || text.includes("local business visibility") || text.includes("google-business-profile")) return "localSeo";
  if (text.includes("web-hosting") || text.includes("website-hosting") || text.includes("hosting")) return "hosting";
  if (text.includes("email-marketing")) return "emailMarketing";
  return "other";
}

function averagePosition(records: Array<{ averagePosition: number | null; impressions: number }>): number | null {
  const withPosition = records.filter((record) => record.averagePosition !== null && record.impressions > 0);
  if (!withPosition.length) return null;
  const totalImpressions = withPosition.reduce((sum, record) => sum + record.impressions, 0);
  if (!totalImpressions) return null;
  const weighted = withPosition.reduce((sum, record) => sum + (record.averagePosition || 0) * record.impressions, 0);
  return Number((weighted / totalImpressions).toFixed(2));
}

function isOpportunity(health: UrlHealthRecord): boolean {
  return health.classifications.some((classification) =>
    classification === "INDEXED_NO_IMPRESSIONS" ||
    classification === "INDEXED_LOW_IMPRESSIONS" ||
    classification === "HIGH_IMPRESSIONS_LOW_CTR"
  );
}

function discovered(lifecycle: UrlLifecycleRecord): boolean {
  return lifecycle.knownToGoogle && !lifecycle.crawled && !lifecycle.indexed;
}

function statusGroups(lifecycle: UrlLifecycleRecord, health: UrlHealthRecord): DashboardStatusGroup[] {
  const groups: DashboardStatusGroup[] = [];
  if (lifecycle.indexed) groups.push("INDEXED");
  if (!lifecycle.indexed && !lifecycle.excluded) groups.push("NOT_INDEXED");
  if (lifecycle.excluded) groups.push("EXCLUDED");
  if (health.classifications.includes("MALFORMED")) groups.push("MALFORMED");
  if (isOpportunity(health)) groups.push("OPPORTUNITY");
  return groups;
}

function priorityScore(record: DashboardUrlRecord): number {
  if (record.statusGroups.includes("OPPORTUNITY") && record.indexed && record.impressions === 0) return 5000;
  if (record.excluded) return 4000 + record.impressions;
  if (!record.indexed && !record.excluded) return 3000 + record.impressions;
  if (record.statusGroups.includes("OPPORTUNITY")) return 2000 + record.impressions;
  if (record.malformed) return 1000 + record.impressions;
  return 0;
}

function buildUrlRecord(
  page: RegistryPage,
  lifecycle: UrlLifecycleRecord,
  health: UrlHealthRecord,
): DashboardUrlRecord {
  const impressions = lifecycle.impressions || 0;
  const clicks = lifecycle.clicks || 0;
  const service = serviceFor(page, lifecycle);
  const groups = statusGroups(lifecycle, health);
  const ctr = impressions > 0 ? clicks / impressions : null;

  return {
    url: page.url,
    slug: page.slug,
    label: page.label,
    service,
    serviceLabel: SERVICE_LABELS[service],
    indexed: lifecycle.indexed,
    excluded: lifecycle.excluded,
    knownToGoogle: lifecycle.knownToGoogle,
    crawled: lifecycle.crawled,
    discovered: discovered(lifecycle),
    malformed: health.classifications.includes("MALFORMED"),
    duplicate: health.classifications.includes("DUPLICATE"),
    opportunity: isOpportunity(health),
    missingLifecycleData: health.missingLifecycleData,
    impressions,
    clicks,
    averagePosition: lifecycle.averagePosition,
    ctr,
    statusGroups: groups,
    actionReason: health.actionReason === "Healthy" ? null : health.actionReason,
  };
}

function emptyGroups(): Record<DashboardStatusGroup, DashboardUrlRecord[]> {
  return {
    INDEXED: [],
    NOT_INDEXED: [],
    EXCLUDED: [],
    MALFORMED: [],
    OPPORTUNITY: [],
  };
}

function buildServiceBreakdown(records: DashboardUrlRecord[]): DashboardServiceBreakdown[] {
  return (["webDesign", "localSeo", "hosting", "emailMarketing", "blog", "other"] as DashboardServiceKey[]).map((service) => {
    const scoped = records.filter((record) => record.service === service);
    return {
      service,
      label: SERVICE_LABELS[service],
      urlCount: scoped.length,
      indexedCount: scoped.filter((record) => record.indexed).length,
      impressions: scoped.reduce((sum, record) => sum + record.impressions, 0),
      clicks: scoped.reduce((sum, record) => sum + record.clicks, 0),
      averagePosition: averagePosition(scoped),
    };
  });
}

export function buildIndexDashboard(
  projectSlug: string,
  options: BuildIndexDashboardOptions = {},
): IndexDashboard {
  const outputDir = options.outputDir || "output";
  const regPath = registryPath(projectSlug, outputDir);
  const lifePath = lifecyclePath(projectSlug, outputDir);
  const hPath = healthPath(projectSlug, outputDir);
  const registry = readJson<RegistryFile>(regPath);
  const lifecycle = readJson<UrlLifecycleReport>(lifePath);
  const health = readJson<UrlHealthAudit>(hPath);

  const lifecycleByUrl = new Map(lifecycle.records.map((record) => [normaliseUrl(record.url), record]));
  const healthByUrl = new Map(health.records.map((record) => [normaliseUrl(record.url), record]));
  const pages = registry.pages || [];

  const records = pages
    .map((page) => {
      const key = normaliseUrl(page.url);
      const lifecycleRecord = lifecycleByUrl.get(key);
      const healthRecord = healthByUrl.get(key);
      if (!lifecycleRecord || !healthRecord) return null;
      return buildUrlRecord(page, lifecycleRecord, healthRecord);
    })
    .filter((record): record is DashboardUrlRecord => Boolean(record));

  const groups = emptyGroups();
  for (const record of records) {
    for (const group of record.statusGroups) groups[group].push(record);
  }

  for (const group of Object.values(groups)) {
    group.sort((a, b) => priorityScore(b) - priorityScore(a) || b.impressions - a.impressions || a.url.localeCompare(b.url));
  }

  const summary: IndexDashboardSummary = {
    totalUrls: records.length,
    indexed: records.filter((record) => record.indexed).length,
    excluded: records.filter((record) => record.excluded).length,
    notIndexed: records.filter((record) => !record.indexed).length,
    knownToGoogle: records.filter((record) => record.knownToGoogle).length,
    crawled: records.filter((record) => record.crawled).length,
    discovered: records.filter((record) => record.discovered).length,
    malformed: records.filter((record) => record.malformed).length,
    duplicates: records.filter((record) => record.duplicate).length,
    opportunities: records.filter((record) => record.opportunity).length,
    missingLifecycleData: records.filter((record) => record.missingLifecycleData).length,
  };

  const validation: IndexDashboardValidation = {
    registryCountMatchesLifecycle: summary.totalUrls === lifecycle.summary.registryCount,
    registryCountMatchesHealth: summary.totalUrls === health.summary.totalUrls,
    indexedMatchesLifecycle: summary.indexed === lifecycle.summary.indexedCount,
    excludedMatchesLifecycle: summary.excluded === lifecycle.summary.excludedCount,
    malformedMatchesHealth: summary.malformed === health.summary.malformed,
    duplicatesMatchesHealth: summary.duplicates === health.summary.duplicates,
    opportunitiesMatchesHealth: summary.opportunities === health.summary.opportunities,
    missingLifecycleMatchesHealth: summary.missingLifecycleData === health.summary.missingLifecycleData,
    passed: false,
  };
  validation.passed = Object.entries(validation)
    .filter(([key]) => key !== "passed")
    .every(([, value]) => value === true);

  const dashboard: IndexDashboard = {
    projectSlug,
    generatedAt: new Date().toISOString(),
    outputPath: outputPath(projectSlug, outputDir),
    sourceFiles: {
      registry: regPath,
      lifecycle: lifePath,
      health: hPath,
    },
    summary,
    serviceBreakdown: buildServiceBreakdown(records),
    statusGroups: groups,
    topOpportunities: records
      .filter((record) => priorityScore(record) > 0)
      .sort((a, b) => priorityScore(b) - priorityScore(a) || b.impressions - a.impressions || a.url.localeCompare(b.url))
      .slice(0, 20),
    validation,
  };

  fs.writeFileSync(dashboard.outputPath, JSON.stringify(dashboard, null, 2), "utf8");
  return dashboard;
}
