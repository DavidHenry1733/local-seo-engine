import fs from "node:fs";
import path from "node:path";
import type { UrlHealthAudit, UrlHealthRecord } from "./urlHealthAuditEngine";

export type RegistryCleanupClassification =
  | "INDEXABLE_PAGE"
  | "NON_INDEXABLE_ASSET"
  | "MALFORMED_URL"
  | "DUPLICATE_URL"
  | "LEGACY_URL"
  | "BLOG_URL"
  | "HUB_URL"
  | "CLUSTER_URL";

export type RegistryCleanupRecommendation =
  | "KEEP"
  | "REMOVE_FROM_REGISTRY"
  | "MANUAL_REVIEW"
  | "SAFE_AUTO_FIX";

interface RegistryPage {
  url: string;
  slug?: string;
  remotePath?: string;
  campaignId?: string;
  label?: string;
  type?: string;
  status?: string;
  includedInSitemap?: boolean;
  priority?: number;
  lastSeenAt?: string;
  lastDeployedAt?: string;
  source?: string;
}

interface RegistryFile {
  projectSlug?: string;
  updatedAt?: string;
  pages?: RegistryPage[];
}

export interface RegistryCleanupRecord {
  url: string;
  slug?: string;
  remotePath?: string;
  type?: string;
  source?: string;
  status?: string;
  includedInSitemap?: boolean;
  classifications: RegistryCleanupClassification[];
  recommendation: RegistryCleanupRecommendation;
  reasons: string[];
  canonicalTarget: string | null;
  duplicateCanonicalTarget: boolean;
  signals: {
    isApiUrl: boolean;
    isImageAsset: boolean;
    isMalformed: boolean;
    hasDoubleSlash: boolean;
    hasNewlineCorruption: boolean;
    hasEmbeddedProtocol: boolean;
    isBlogUrl: boolean;
    isHubUrl: boolean;
    isClusterUrl: boolean;
    isLegacyUrl: boolean;
  };
}

export interface RegistryCleanupSummary {
  totalRegistryUrls: number;
  indexablePages: number;
  nonIndexableAssets: number;
  malformedUrls: number;
  duplicateUrls: number;
  legacyUrls: number;
  blogUrls: number;
  hubUrls: number;
  clusterUrls: number;
  safeAutoFixCandidates: number;
  manualReviewCandidates: number;
  urlsToRemoveFromRegistry: number;
  urlsToKeep: number;
}

export interface RegistryCleanupAudit {
  projectSlug: string;
  generatedAt: string;
  sourceFiles: {
    registry: string;
    urlHealthAudit: string;
  };
  outputPath: string;
  summary: RegistryCleanupSummary;
  safeAutoFixCandidates: RegistryCleanupRecord[];
  manualReviewCandidates: RegistryCleanupRecord[];
  urlsToRemoveFromRegistry: RegistryCleanupRecord[];
  urlsToKeep: RegistryCleanupRecord[];
  records: RegistryCleanupRecord[];
}

export interface BuildRegistryCleanupAuditOptions {
  outputDir?: string;
}

function projectDir(projectSlug: string, outputDir: string): string {
  return path.join(outputDir, projectSlug);
}

function registryPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "page-registry.json");
}

function healthPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "url-health-audit.json");
}

function outputPath(projectSlug: string, outputDir: string): string {
  return path.join(projectDir(projectSlug, outputDir), "registry-cleanup-audit.json");
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) throw new Error(`Required cleanup audit input missing: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    if (!/\.[a-z0-9]{2,5}$/i.test(parsed.pathname) && !parsed.pathname.endsWith("/")) {
      parsed.pathname += "/";
    }
    return parsed.toString();
  } catch {
    return String(url || "").trim();
  }
}

function pathName(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function embeddedProtocolTarget(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/https?:([^/].*)$/i);
    if (!match?.[1]) return null;
    const hostPrefix = new RegExp(`^${parsed.hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/*`, "i");
    const cleaned = match[1].replace(/^\/+/, "").replace(hostPrefix, "");
    return `${parsed.protocol}//${parsed.hostname}/${cleaned}`.replace(/([^:])\/{2,}/g, "$1/");
  } catch {
    return null;
  }
}

function repairedCanonicalTarget(url: string): string | null {
  const embedded = embeddedProtocolTarget(url);
  if (embedded) return normaliseUrl(embedded);

  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname;
    pathname = pathname.replace(/\/+n\/n.*$/i, "/");
    pathname = pathname.replace(/\/{2,}/g, "/");
    pathname = pathname.replace(/\.\//g, "/").replace(/\.$/, "");
    if (pathname !== parsed.pathname) {
      parsed.pathname = pathname.endsWith("/") ? pathname : `${pathname}/`;
      return normaliseUrl(parsed.toString());
    }
  } catch {
    return null;
  }

  return null;
}

function isImageAsset(page: RegistryPage): boolean {
  const combined = `${page.url} ${page.slug || ""} ${page.remotePath || ""}`.toLowerCase();
  return /\.(avif|gif|jpe?g|png|svg|webp)(\/|$)/i.test(combined);
}

function isApiUrl(page: RegistryPage): boolean {
  return pathName(page.url).startsWith("/api/") || String(page.remotePath || "").startsWith("/api/");
}

function isBlogUrl(page: RegistryPage): boolean {
  return pathName(page.url).startsWith("/blog/") || String(page.slug || "").startsWith("blog/");
}

function isHubUrl(page: RegistryPage): boolean {
  return page.type === "hub" || page.priority === 1;
}

function isClusterUrl(page: RegistryPage): boolean {
  if (isBlogUrl(page) || isHubUrl(page) || isApiUrl(page) || isImageAsset(page)) return false;
  return page.type === "area" || page.type === "unknown";
}

function isLegacyUrl(page: RegistryPage): boolean {
  const p = pathName(page.url);
  return (
    p.includes("/email-marketing/") ||
    p.includes("/local-seo/") ||
    p.includes("/web-design/") ||
    p.includes("/website-hosting/")
  );
}

function hasDoubleSlash(url: string): boolean {
  return /\/{2,}/.test(pathName(url));
}

function hasNewlineCorruption(page: RegistryPage): boolean {
  const combined = `${page.url} ${page.slug || ""} ${page.remotePath || ""}`;
  return /\/n\/n/i.test(combined) || /\\n/i.test(combined);
}

function hasEmbeddedProtocol(page: RegistryPage): boolean {
  const combined = `${page.url} ${page.slug || ""} ${page.remotePath || ""}`;
  return /https?:[^/]/i.test(pathName(page.url)) || /https?:/i.test(page.slug || "") || /https?:/i.test(page.remotePath || "") || /https?:[^/]/i.test(combined);
}

function healthByUrl(health: UrlHealthAudit): Map<string, UrlHealthRecord> {
  const map = new Map<string, UrlHealthRecord>();
  for (const record of health.records) map.set(normaliseUrl(record.url), record);
  return map;
}

function canonicalCounts(pages: RegistryPage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const key = repairedCanonicalTarget(page.url) || normaliseUrl(page.url);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function classifyPage(
  page: RegistryPage,
  healthRecord: UrlHealthRecord | undefined,
  canonicalTargetCounts: Map<string, number>,
): RegistryCleanupRecord {
  const classifications: RegistryCleanupClassification[] = [];
  const reasons: string[] = [];

  const signals = {
    isApiUrl: isApiUrl(page),
    isImageAsset: isImageAsset(page),
    isMalformed: Boolean(healthRecord?.classifications.includes("MALFORMED")),
    hasDoubleSlash: hasDoubleSlash(page.url),
    hasNewlineCorruption: hasNewlineCorruption(page),
    hasEmbeddedProtocol: hasEmbeddedProtocol(page),
    isBlogUrl: isBlogUrl(page),
    isHubUrl: isHubUrl(page),
    isClusterUrl: isClusterUrl(page),
    isLegacyUrl: isLegacyUrl(page),
  };

  if (signals.isApiUrl || signals.isImageAsset) {
    classifications.push("NON_INDEXABLE_ASSET");
    reasons.push(signals.isApiUrl ? "api_url" : "image_asset_url");
  }
  if (signals.isMalformed || signals.hasDoubleSlash || signals.hasNewlineCorruption || signals.hasEmbeddedProtocol) {
    classifications.push("MALFORMED_URL");
    if (signals.hasDoubleSlash) reasons.push("double_slash_url");
    if (signals.hasNewlineCorruption) reasons.push("newline_corruption");
    if (signals.hasEmbeddedProtocol) reasons.push("embedded_protocol_corruption");
    for (const reason of healthRecord?.malformedReasons || []) reasons.push(reason);
  }
  if (signals.isLegacyUrl) classifications.push("LEGACY_URL");
  if (signals.isBlogUrl) classifications.push("BLOG_URL");
  if (signals.isHubUrl) classifications.push("HUB_URL");
  if (signals.isClusterUrl) classifications.push("CLUSTER_URL");

  const canonicalTarget = repairedCanonicalTarget(page.url);
  const canonicalKey = canonicalTarget || normaliseUrl(page.url);
  const duplicateCanonicalTarget = (canonicalTargetCounts.get(canonicalKey) || 0) > 1;
  if (duplicateCanonicalTarget || healthRecord?.classifications.includes("DUPLICATE")) {
    classifications.push("DUPLICATE_URL");
    reasons.push("duplicate_canonical_target");
  }

  if (!classifications.includes("NON_INDEXABLE_ASSET") && !classifications.includes("MALFORMED_URL")) {
    classifications.unshift("INDEXABLE_PAGE");
  }

  const recommendation = recommendationFor(classifications, signals, canonicalTarget);

  return {
    url: page.url,
    slug: page.slug,
    remotePath: page.remotePath,
    type: page.type,
    source: page.source,
    status: page.status,
    includedInSitemap: page.includedInSitemap,
    classifications: [...new Set(classifications)],
    recommendation,
    reasons: [...new Set(reasons)],
    canonicalTarget,
    duplicateCanonicalTarget,
    signals,
  };
}

function recommendationFor(
  classifications: RegistryCleanupClassification[],
  signals: RegistryCleanupRecord["signals"],
  canonicalTarget: string | null,
): RegistryCleanupRecommendation {
  if (classifications.includes("NON_INDEXABLE_ASSET")) return "REMOVE_FROM_REGISTRY";
  if (classifications.includes("DUPLICATE_URL")) return "MANUAL_REVIEW";
  if (classifications.includes("MALFORMED_URL")) {
    if (canonicalTarget && (signals.hasEmbeddedProtocol || signals.hasDoubleSlash || signals.hasNewlineCorruption)) {
      return "SAFE_AUTO_FIX";
    }
    return "MANUAL_REVIEW";
  }
  if (classifications.includes("LEGACY_URL")) return "MANUAL_REVIEW";
  return "KEEP";
}

export function buildRegistryCleanupAudit(
  projectSlug: string,
  options: BuildRegistryCleanupAuditOptions = {},
): RegistryCleanupAudit {
  const outputDir = options.outputDir || "output";
  const registryFile = registryPath(projectSlug, outputDir);
  const healthFile = healthPath(projectSlug, outputDir);
  const registry = readJson<RegistryFile>(registryFile);
  const health = readJson<UrlHealthAudit>(healthFile);
  const pages = registry.pages || [];
  const healthMap = healthByUrl(health);
  const canonicalTargetCounts = canonicalCounts(pages);
  const records = pages.map((page) =>
    classifyPage(page, healthMap.get(normaliseUrl(page.url)), canonicalTargetCounts),
  );

  const audit: RegistryCleanupAudit = {
    projectSlug,
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      registry: registryFile,
      urlHealthAudit: healthFile,
    },
    outputPath: outputPath(projectSlug, outputDir),
    summary: {
      totalRegistryUrls: records.length,
      indexablePages: records.filter((record) => record.classifications.includes("INDEXABLE_PAGE")).length,
      nonIndexableAssets: records.filter((record) => record.classifications.includes("NON_INDEXABLE_ASSET")).length,
      malformedUrls: records.filter((record) => record.classifications.includes("MALFORMED_URL")).length,
      duplicateUrls: records.filter((record) => record.classifications.includes("DUPLICATE_URL")).length,
      legacyUrls: records.filter((record) => record.classifications.includes("LEGACY_URL")).length,
      blogUrls: records.filter((record) => record.classifications.includes("BLOG_URL")).length,
      hubUrls: records.filter((record) => record.classifications.includes("HUB_URL")).length,
      clusterUrls: records.filter((record) => record.classifications.includes("CLUSTER_URL")).length,
      safeAutoFixCandidates: records.filter((record) => record.recommendation === "SAFE_AUTO_FIX").length,
      manualReviewCandidates: records.filter((record) => record.recommendation === "MANUAL_REVIEW").length,
      urlsToRemoveFromRegistry: records.filter((record) => record.recommendation === "REMOVE_FROM_REGISTRY").length,
      urlsToKeep: records.filter((record) => record.recommendation === "KEEP").length,
    },
    safeAutoFixCandidates: records.filter((record) => record.recommendation === "SAFE_AUTO_FIX"),
    manualReviewCandidates: records.filter((record) => record.recommendation === "MANUAL_REVIEW"),
    urlsToRemoveFromRegistry: records.filter((record) => record.recommendation === "REMOVE_FROM_REGISTRY"),
    urlsToKeep: records.filter((record) => record.recommendation === "KEEP"),
    records,
  };

  fs.writeFileSync(audit.outputPath, JSON.stringify(audit, null, 2), "utf8");
  return audit;
}
