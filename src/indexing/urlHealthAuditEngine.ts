import fs from "node:fs";
import path from "node:path";
import type { UrlLifecycleRecord, UrlLifecycleReport } from "./urlLifecycleEngine";

export type UrlHealthClassification =
  | "VALID"
  | "MALFORMED"
  | "DUPLICATE"
  | "INDEXED"
  | "NOT_INDEXED"
  | "EXCLUDED"
  | "INDEXED_NO_IMPRESSIONS"
  | "INDEXED_LOW_IMPRESSIONS"
  | "HIGH_IMPRESSIONS_LOW_CTR"
  | "HIGH_PERFORMING";

export interface UrlHealthRecord {
  url: string;
  slug?: string;
  type?: string;
  source?: string;
  classifications: UrlHealthClassification[];
  primaryClassification: UrlHealthClassification;
  severity: "action" | "opportunity" | "valid";
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

export interface UrlHealthSummary {
  totalUrls: number;
  indexed: number;
  excluded: number;
  notIndexed: number;
  malformed: number;
  duplicates: number;
  orphanUrls: number;
  missingLifecycleData: number;
  opportunities: number;
  highPerforming: number;
}

export interface UrlHealthAudit {
  projectSlug: string;
  generatedAt: string;
  sourceFile: string;
  outputPath: string;
  thresholds: {
    lowImpressionsMax: number;
    highImpressionsMin: number;
    lowCtrMax: number;
    highCtrMin: number;
    highPerformingClicksMin: number;
  };
  summary: UrlHealthSummary;
  topActionUrls: UrlHealthRecord[];
  records: UrlHealthRecord[];
}

export interface BuildUrlHealthAuditOptions {
  outputDir?: string;
}

const LOW_IMPRESSIONS_MAX = 49;
const HIGH_IMPRESSIONS_MIN = 100;
const LOW_CTR_MAX = 0.01;
const HIGH_CTR_MIN = 0.03;
const HIGH_PERFORMING_CLICKS_MIN = 10;

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function lifecyclePath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "url-lifecycle.json");
}

function outputPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "url-health-audit.json");
}

function readLifecycle(projectSlug: string, outputDir: string): UrlLifecycleReport {
  const p = lifecyclePath(projectSlug, outputDir);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing url-lifecycle.json for ${projectSlug}. Run the lifecycle layer first.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as UrlLifecycleReport;
}

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return String(url || "").trim();
  }
}

function duplicateIndexes(records: UrlLifecycleRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = normaliseUrl(record.url).toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function hasDoubleSlashPath(parsed: URL): boolean {
  return /\/{2,}/.test(parsed.pathname);
}

function malformedReasons(record: UrlLifecycleRecord): string[] {
  const reasons: string[] = [];
  const url = String(record.url || "");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return ["invalid_url"];
  }

  if (!/^https?:$/.test(parsed.protocol)) reasons.push("invalid_protocol");
  if (!parsed.hostname) reasons.push("missing_hostname");
  if (hasDoubleSlashPath(parsed)) reasons.push("double_slash_path");
  if (/%5c/i.test(url) || url.includes("\\")) reasons.push("backslash_in_url");
  if (/\s/.test(url)) reasons.push("whitespace_in_url");
  if (/\/https?:/i.test(parsed.pathname) || /https?:[^/]/i.test(parsed.pathname)) reasons.push("embedded_protocol_in_path");
  if (/\/n\/n/i.test(parsed.pathname)) reasons.push("escaped_newline_fragment");
  if (/\.\//.test(parsed.pathname) || parsed.pathname.endsWith("./")) reasons.push("dot_segment");
  if (/[<>{}|"^`]/.test(url)) reasons.push("invalid_character");
  if (record.slug && /https?:|\/\/|\\|\s|\/n\/n|[<>{}|"^`]/i.test(record.slug)) reasons.push("malformed_slug");
  if (record.remotePath && /https?:|\\|\s|\/n\/n|[<>{}|"^`]/i.test(record.remotePath)) reasons.push("malformed_remote_path");

  return [...new Set(reasons)];
}

function ctr(record: UrlLifecycleRecord): number | null {
  if (record.impressions === null || record.clicks === null) return null;
  if (record.impressions <= 0) return 0;
  return record.clicks / record.impressions;
}

function isMissingLifecycleData(record: UrlLifecycleRecord): boolean {
  return !record.lastCheckedTime || record.issues.includes("missing_gsc_inspection");
}

function isOrphan(record: UrlLifecycleRecord): boolean {
  return !record.sourceFiles.includes("registry") || !record.generated || !record.submitted;
}

function classify(
  record: UrlLifecycleRecord,
  duplicateCounts: Map<string, number>,
): UrlHealthRecord {
  const reasons = malformedReasons(record);
  const duplicateReasons: string[] = [];
  const normalized = normaliseUrl(record.url).toLowerCase();
  if ((duplicateCounts.get(normalized) || 0) > 1) duplicateReasons.push("duplicate_normalized_url");

  const recordCtr = ctr(record);
  const classifications: UrlHealthClassification[] = [];
  const missingLifecycleData = isMissingLifecycleData(record);
  const orphan = isOrphan(record);

  if (reasons.length) classifications.push("MALFORMED");
  if (duplicateReasons.length) classifications.push("DUPLICATE");
  if (record.indexed) classifications.push("INDEXED");
  if (record.excluded) classifications.push("EXCLUDED");
  if (!record.indexed && !record.excluded) classifications.push("NOT_INDEXED");

  if (record.indexed && record.impressions === 0) classifications.push("INDEXED_NO_IMPRESSIONS");
  if (
    record.indexed &&
    record.impressions !== null &&
    record.impressions > 0 &&
    record.impressions <= LOW_IMPRESSIONS_MAX
  ) classifications.push("INDEXED_LOW_IMPRESSIONS");
  if (
    record.impressions !== null &&
    record.impressions >= HIGH_IMPRESSIONS_MIN &&
    recordCtr !== null &&
    recordCtr <= LOW_CTR_MAX
  ) classifications.push("HIGH_IMPRESSIONS_LOW_CTR");
  if (
    record.indexed &&
    record.impressions !== null &&
    record.impressions >= HIGH_IMPRESSIONS_MIN &&
    recordCtr !== null &&
    recordCtr >= HIGH_CTR_MIN &&
    (record.clicks || 0) >= HIGH_PERFORMING_CLICKS_MIN
  ) classifications.push("HIGH_PERFORMING");

  const needsAction = reasons.length || duplicateReasons.length || orphan || missingLifecycleData || record.excluded || (!record.indexed && record.lastCheckedTime);
  const hasOpportunity = classifications.some((item) =>
    item === "INDEXED_NO_IMPRESSIONS" ||
    item === "INDEXED_LOW_IMPRESSIONS" ||
    item === "HIGH_IMPRESSIONS_LOW_CTR"
  );

  if (!needsAction && !hasOpportunity && !classifications.includes("HIGH_PERFORMING")) {
    classifications.push("VALID");
  }

  const primaryClassification = classifications[0] || "VALID";
  const severity = needsAction ? "action" : hasOpportunity ? "opportunity" : "valid";

  return {
    url: record.url,
    slug: record.slug,
    type: record.type,
    source: record.source,
    classifications: [...new Set(classifications)],
    primaryClassification,
    severity,
    malformedReasons: reasons,
    duplicateReasons,
    orphan,
    missingLifecycleData,
    indexed: record.indexed,
    excluded: record.excluded,
    impressions: record.impressions,
    clicks: record.clicks,
    averagePosition: record.averagePosition,
    ctr: recordCtr,
    actionReason: actionReason(record, reasons, duplicateReasons, orphan, missingLifecycleData, hasOpportunity),
  };
}

function actionReason(
  record: UrlLifecycleRecord,
  malformed: string[],
  duplicateReasons: string[],
  orphan: boolean,
  missingLifecycleData: boolean,
  hasOpportunity: boolean,
): string {
  if (malformed.length) return `Malformed URL: ${malformed.join(", ")}`;
  if (duplicateReasons.length) return `Duplicate URL: ${duplicateReasons.join(", ")}`;
  if (orphan) return "Orphan or not fully connected to registry/submission lifecycle";
  if (missingLifecycleData) return "Missing GSC lifecycle inspection data";
  if (record.excluded) return record.coverageState ? `Excluded: ${record.coverageState}` : "Excluded from index";
  if (!record.indexed && record.lastCheckedTime) return record.coverageState ? `Not indexed: ${record.coverageState}` : "Not indexed";
  if (hasOpportunity && record.impressions === 0) return "Indexed but has no impressions";
  if (hasOpportunity && record.impressions !== null && record.impressions <= LOW_IMPRESSIONS_MAX) return "Indexed but has low impressions";
  if (hasOpportunity) return "High impressions but low CTR";
  return "Healthy";
}

function priorityScore(record: UrlHealthRecord): number {
  let score = 0;
  if (record.malformedReasons.length) score += 1000;
  if (record.duplicateReasons.length) score += 800;
  if (record.orphan) score += 700;
  if (record.missingLifecycleData) score += 500;
  if (record.excluded) score += 450;
  if (record.classifications.includes("NOT_INDEXED")) score += 350;
  if (record.classifications.includes("HIGH_IMPRESSIONS_LOW_CTR")) score += 300 + (record.impressions || 0);
  if (record.classifications.includes("INDEXED_NO_IMPRESSIONS")) score += 180;
  if (record.classifications.includes("INDEXED_LOW_IMPRESSIONS")) score += 150;
  return score;
}

function isOpportunity(record: UrlHealthRecord): boolean {
  return record.classifications.some((item) =>
    item === "INDEXED_NO_IMPRESSIONS" ||
    item === "INDEXED_LOW_IMPRESSIONS" ||
    item === "HIGH_IMPRESSIONS_LOW_CTR"
  );
}

export function buildUrlHealthAudit(
  projectSlug: string,
  options: BuildUrlHealthAuditOptions = {},
): UrlHealthAudit {
  const outputDir = options.outputDir ?? "output";
  const sourceFile = lifecyclePath(projectSlug, outputDir);
  const lifecycle = readLifecycle(projectSlug, outputDir);
  const duplicates = duplicateIndexes(lifecycle.records);
  const records = lifecycle.records.map((record) => classify(record, duplicates));
  const out = outputPath(projectSlug, outputDir);

  const summary: UrlHealthSummary = {
    totalUrls: records.length,
    indexed: records.filter((record) => record.indexed).length,
    excluded: records.filter((record) => record.excluded).length,
    notIndexed: records.filter((record) => !record.indexed).length,
    malformed: records.filter((record) => record.classifications.includes("MALFORMED")).length,
    duplicates: records.filter((record) => record.classifications.includes("DUPLICATE")).length,
    orphanUrls: records.filter((record) => record.orphan).length,
    missingLifecycleData: records.filter((record) => record.missingLifecycleData).length,
    opportunities: records.filter(isOpportunity).length,
    highPerforming: records.filter((record) => record.classifications.includes("HIGH_PERFORMING")).length,
  };

  const topActionUrls = records
    .filter((record) => priorityScore(record) > 0)
    .sort((a, b) => priorityScore(b) - priorityScore(a) || a.url.localeCompare(b.url))
    .slice(0, 20);

  const audit: UrlHealthAudit = {
    projectSlug,
    generatedAt: new Date().toISOString(),
    sourceFile,
    outputPath: out,
    thresholds: {
      lowImpressionsMax: LOW_IMPRESSIONS_MAX,
      highImpressionsMin: HIGH_IMPRESSIONS_MIN,
      lowCtrMax: LOW_CTR_MAX,
      highCtrMin: HIGH_CTR_MIN,
      highPerformingClicksMin: HIGH_PERFORMING_CLICKS_MIN,
    },
    summary,
    topActionUrls,
    records,
  };

  fs.writeFileSync(out, JSON.stringify(audit, null, 2), "utf8");
  return audit;
}
