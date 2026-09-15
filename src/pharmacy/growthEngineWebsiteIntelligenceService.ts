/**
 * Growth Engine — Website Intelligence V1 service (crawl, analyse, persist).
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { GROWTH_ENGINE_DIR } from "./growthEngineLocalMarketService.ts";
import { crawlWebsite, extractTechnicalSignals } from "./growthEngineWebsiteCrawler.ts";
import { buildWebsiteIntelligenceAnalysis } from "./growthEngineWebsiteIntelligenceAnalysis.ts";
import {
  emptyWebsiteSnapshot,
  normalizeWebsiteSnapshot,
  WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
  type GrowthEngineWebsiteIntelligenceSnapshot,
} from "./growthEngineWebsiteIntelligenceModel.ts";
import { websiteImportSnapshotToGrowthEngineSnapshot } from "./growthEngineWebsiteIntelligenceImportV2Service.ts";

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  if (!fs.existsSync(profilePath(slug))) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(profilePath(slug), "utf8"));
  return normalizeProfileData(doc.data || {});
}

export function websiteIntelligenceSnapshotPath(slug: string): string {
  return path.join(GROWTH_ENGINE_DIR, `${slug}-website-intelligence.json`);
}

export function writeWebsiteIntelligenceSnapshot(snapshot: GrowthEngineWebsiteIntelligenceSnapshot): string {
  fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
  const file = websiteIntelligenceSnapshotPath(snapshot.slug);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  return file;
}

export function loadWebsiteIntelligenceSnapshot(slug: string): GrowthEngineWebsiteIntelligenceSnapshot | null {
  const file = websiteIntelligenceSnapshotPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return normalizeWebsiteSnapshot(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return null;
  }
}

/** Prefer persisted snapshot; fall back to imported website intelligence on the canonical profile. */
export function resolveWebsiteIntelligenceSnapshot(slug: string): GrowthEngineWebsiteIntelligenceSnapshot | null {
  const persisted = loadWebsiteIntelligenceSnapshot(slug);
  if (persisted?.analysis?.pages?.length) return persisted;

  const profile = loadProfile(slug);
  const importSnap = profile.websiteImportSnapshot;
  if (!importSnap?.importedAt || importSnap.status === "not_found") return persisted;

  const bridged = websiteImportSnapshotToGrowthEngineSnapshot(slug, importSnap, profile);
  return bridged || persisted;
}

function normalizeWebsiteUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
}

export async function analyseWebsiteIntelligence(slug: string): Promise<GrowthEngineWebsiteIntelligenceSnapshot> {
  const profile = loadProfile(slug);
  const websiteUrl = normalizeWebsiteUrl(profile.website || "");

  if (!websiteUrl) {
    const empty = { ...emptyWebsiteSnapshot(slug), source: "no-website" as const };
    writeWebsiteIntelligenceSnapshot(empty);
    return empty;
  }

  const navSeeds = (profile.headerNavLinks || []).map((l) => l.url).filter(Boolean);

  const crawl = await crawlWebsite(websiteUrl, navSeeds);
  if (!crawl.pages.length) {
    const failed = {
      version: WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
      slug,
      generatedAt: new Date().toISOString(),
      source: "fetch-failed" as const,
      websiteUrl,
      analysis: null,
    };
    writeWebsiteIntelligenceSnapshot(failed);
    return failed;
  }

  const technical = extractTechnicalSignals(
    crawl.homepageHtml,
    websiteUrl,
    crawl.sitemapUrls.length > 0,
    crawl.robotsDetected,
  );

  const analysis = buildWebsiteIntelligenceAnalysis({
    websiteUrl,
    pages: crawl.pages,
    technical,
    profile,
  });

  const snapshot: GrowthEngineWebsiteIntelligenceSnapshot = {
    version: WEBSITE_INTELLIGENCE_SNAPSHOT_VERSION,
    slug,
    generatedAt: new Date().toISOString(),
    source: "website-live",
    websiteUrl,
    analysis,
  };

  writeWebsiteIntelligenceSnapshot(snapshot);
  return snapshot;
}

export function refreshWebsiteIntelligenceAnalysis(
  snapshot: GrowthEngineWebsiteIntelligenceSnapshot,
): GrowthEngineWebsiteIntelligenceSnapshot {
  if (!snapshot.analysis?.pages?.length) return snapshot;
  const profile = loadProfile(snapshot.slug);
  const analysis = buildWebsiteIntelligenceAnalysis({
    websiteUrl: snapshot.websiteUrl,
    pages: snapshot.analysis.pages,
    technical: snapshot.analysis.technical,
    profile,
  });
  return { ...snapshot, analysis };
}
