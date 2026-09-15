/**
 * Growth Engine — Live Integration Proof V1 service.
 * Probes real external integrations; never presents simulated data as live.
 */
import fs from "node:fs";
import path from "node:path";
import * as ftp from "basic-ftp";
import { analyzeWebsiteForPharmacy } from "./pharmacyWebsiteAnalysisService.ts";
import { readTrackingReport } from "../indexing/indexTrackingEngine.ts";
import {
  discoverLocalMarketCompetitors,
  fetchYourPharmacyFromGoogle,
  loadCompetitorSnapshot,
} from "./growthEngineLocalMarketService.ts";
import {
  INTEGRATION_META,
  LIVE_INTEGRATION_PROOF_VERSION,
  type IntegrationStatusLabel,
  type LiveIntegrationCheck,
  type LiveIntegrationId,
  type LiveIntegrationProofReport,
  type LiveIntegrationResult,
} from "./growthEngineLiveIntegrationModel.ts";
import { getPharmacyIndexingBridgeStatus } from "./pharmacyIndexingBridgeService.ts";
import { getPharmacyPublishOutputStatus } from "./pharmacyPublishOutputService.ts";
import { loadPharmacyDeployConfig } from "./pharmacyDeployConfig.ts";
import { getPharmacyLivePublishStatus, safeFtpConnectionTest } from "./pharmacyLivePublishService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { PUBLISH_ROOT } from "./pharmacyPublishOutputService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";

const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");
const GROWTH_ENGINE_DIR = path.join(WORKSPACE_ROOT, "data/growth-engine");
const GSC_TOKENS_FILE = "/tmp/.gsc-oauth-tokens.json";
const GSC_DISCONNECTED_FILE = "/tmp/.gsc-oauth-disconnected";

function loadOAuthTokens(): { refresh_token: string } | null {
  if (fs.existsSync(GSC_DISCONNECTED_FILE)) return null;
  if (fs.existsSync(GSC_TOKENS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(GSC_TOKENS_FILE, "utf8"));
    } catch {
      /* fall through */
    }
  }
  const envToken = (process.env.GSC_OAUTH_REFRESH_TOKEN ?? "").trim();
  if (envToken) return { refresh_token: envToken };
  return null;
}

export interface LiveProofOptions {
  runLive?: Partial<Record<LiveIntegrationId, boolean>>;
  ftpSafeWrite?: boolean;
}

function proofPath(slug: string): string {
  return path.join(GROWTH_ENGINE_DIR, `${slug}-live-integration-proof.json`);
}

function loadProfile(slug: string) {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function loadProjectDeploy(slug: string) {
  const d = loadPharmacyDeployConfig(slug);
  return {
    enabled: d.enabled,
    host: d.host,
    port: d.port,
    remoteRoot: d.remoteRoot,
    username: d.username,
    password: d.password,
    domain: d.domain,
  };
}

function resolveStatus(checks: LiveIntegrationCheck[], hasLive: boolean): IntegrationStatusLabel {
  if (!checks.length) return "not_connected";
  const errors = checks.filter((c) => !c.ok && (c.id.includes("error") || c.label.toLowerCase().includes("error")));
  if (errors.length) return "error";

  const liveChecks = checks.filter((c) => c.liveData);
  const livePassed = liveChecks.filter((c) => c.ok).length;
  if (liveChecks.length > 0 && livePassed === liveChecks.length) return "connected";
  if (livePassed >= 2) return "limited";
  if (livePassed >= 1 || (hasLive && checks.some((c) => c.ok))) return "limited";

  const credentialOnly = checks.every((c) => !c.liveData);
  if (credentialOnly && checks.every((c) => c.ok)) return "limited";

  return checks.some((c) => c.ok) ? "limited" : "not_connected";
}

function buildResult(
  id: LiveIntegrationId,
  checks: LiveIntegrationCheck[],
  testResult: string,
  nextAction?: string,
  artifactPath?: string,
): LiveIntegrationResult {
  const meta = INTEGRATION_META[id];
  const hasLive = checks.some((c) => c.ok && c.liveData);
  const status = resolveStatus(checks, hasLive);
  const overallReady = status === "connected" || status === "ready";
  return {
    id,
    name: meta.name,
    status: overallReady ? "ready" : status,
    lastCheckedAt: new Date().toISOString(),
    testResult,
    unlocks: meta.unlocks,
    nextAction: nextAction || (overallReady ? "No action required — integration is ready" : meta.nextActionDisconnected),
    checks,
    artifactPath,
  };
}

export function hasLiveGscIndexingData(slug: string): boolean {
  const report = readTrackingReport(slug, OUTPUT_DIR);
  return Boolean(report?.records?.length);
}

export function hasLiveRankTrackingData(slug: string): boolean {
  const file = path.join(OUTPUT_DIR, slug, "rank-tracking.json");
  if (!fs.existsSync(file)) return false;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { summary?: { keywordsCount?: number }; source?: string };
    return (doc.summary?.keywordsCount || 0) > 0;
  } catch {
    return false;
  }
}

export function isVisibilityUsingLiveRanks(slug: string): boolean {
  if (!hasLiveRankTrackingData(slug)) return false;
  const visibility = readPharmacyVisibilityReport(slug);
  if (!visibility) return false;
  return visibility.services.some((s) => s.estimatedPosition != null && s.impressions > 0);
}

async function probeIdeogram(): Promise<LiveIntegrationResult> {
  const checks: LiveIntegrationCheck[] = [];
  const key = process.env.IDEOGRAM_API_KEY?.trim();

  checks.push({
    id: "credential",
    ok: Boolean(key),
    label: "API key configured",
    detail: key ? "IDEOGRAM_API_KEY is set" : "IDEOGRAM_API_KEY not set",
    liveData: false,
  });

  if (!key) {
    return buildResult("image-generation", checks, "Not Connected — no Ideogram API key");
  }

  try {
    const testRes = await fetch("https://api.ideogram.ai/describe", {
      method: "POST",
      headers: { "Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: "https://ideogram.ai/api/images/direct/abc" }),
    });
    const authOk = testRes.status !== 401;
    checks.push({
      id: "api-auth",
      ok: authOk,
      label: authOk ? "API authentication" : "API authentication error",
      detail: authOk ? `Ideogram API responded (${testRes.status})` : "API key rejected (401)",
      liveData: authOk,
    });
    return buildResult(
      "image-generation",
      checks,
      authOk ? "Connected — Ideogram API key accepted" : "Error — API key rejected",
      authOk ? undefined : "Check IDEOGRAM_API_KEY is valid",
    );
  } catch (err) {
    checks.push({
      id: "api-error",
      ok: false,
      label: "API connection error",
      detail: err instanceof Error ? err.message : String(err),
      liveData: false,
    });
    return buildResult("image-generation", checks, "Error — could not reach Ideogram API");
  }
}

async function probeGooglePlaces(slug: string, runLive: boolean): Promise<LiveIntegrationResult> {
  const checks: LiveIntegrationCheck[] = [];
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();

  checks.push({
    id: "credential",
    ok: Boolean(key),
    label: "API key configured",
    detail: key ? "GOOGLE_PLACES_API_KEY is set" : "GOOGLE_PLACES_API_KEY not set",
    liveData: false,
  });

  if (!key) {
    return buildResult("google-places", checks, "Not Connected — no Google Places API key");
  }

  const snapshot = loadCompetitorSnapshot(slug);
  if (snapshot?.analysis?.dataSource === "google-places-live") {
    checks.push({
      id: "snapshot",
      ok: true,
      label: "Local snapshot saved",
      detail: `${snapshot.competitors.length} competitors · ${snapshot.healthcare?.providers?.length || 0} healthcare providers`,
      liveData: true,
    });
  }

  if (runLive) {
    try {
      const yours = await fetchYourPharmacyFromGoogle(slug);
      checks.push({
        id: "pharmacy-lookup",
        ok: Boolean(yours?.placeId && yours.source === "google-places"),
        label: "Pharmacy lookup",
        detail: yours?.businessName
          ? `${yours.businessName} · ${yours.rating}★ · ${yours.reviewCount} reviews · ${yours.photoCount} photos`
          : "Could not resolve pharmacy from Google Places",
        liveData: Boolean(yours?.source === "google-places"),
      });

      const discovered = await discoverLocalMarketCompetitors(slug);
      const live = discovered.analysis?.dataSource === "google-places-live";
      checks.push({
        id: "competitor-discovery",
        ok: live && discovered.competitors.length >= 5,
        label: "Competitor discovery",
        detail: live
          ? `${discovered.competitors.length} pharmacies · ${discovered.healthcare?.providers?.length || 0} healthcare providers`
          : `Discovery returned ${discovered.competitors.length} results (source: ${discovered.source})`,
        liveData: live,
      });

      const artifact = path.join(GROWTH_ENGINE_DIR, `${slug}-competitors.json`);
      return buildResult(
        "google-places",
        checks,
        live ? `Connected — live Google Places data for ${slug}` : "Limited — Places API key set but discovery incomplete",
        live ? undefined : "Run Discover from Local Healthcare Intelligence with a complete profile",
        artifact,
      );
    } catch (err) {
      checks.push({
        id: "live-error",
        ok: false,
        label: "Live test error",
        detail: err instanceof Error ? err.message : String(err),
        liveData: false,
      });
      return buildResult("google-places", checks, "Error — live Places test failed");
    }
  }

  if (snapshot?.analysis?.dataSource === "google-places-live") {
    return buildResult(
      "google-places",
      checks,
      "Ready — cached live snapshot available",
      undefined,
      path.join(GROWTH_ENGINE_DIR, `${slug}-competitors.json`),
    );
  }

  return buildResult(
    "google-places",
    checks,
    "Limited — API key present; run live test to confirm discovery",
    "Run integration proof with live Places test or discover from Local Healthcare Intelligence",
  );
}

async function probeWebsiteImport(slug: string, runLive: boolean): Promise<LiveIntegrationResult> {
  const profile = loadProfile(slug);
  const website = String(profile.website || "").trim();
  const checks: LiveIntegrationCheck[] = [];

  checks.push({
    id: "website-url",
    ok: Boolean(website),
    label: "Website URL on profile",
    detail: website || "No website URL on Business Profile",
    liveData: false,
  });

  if (!website) {
    return buildResult("website-import", checks, "Not Connected — no website URL on profile");
  }

  if (!runLive) {
    const imported = (profile.websiteImportedFieldKeys || []).length;
    checks.push({
      id: "prior-import",
      ok: imported > 0,
      label: "Prior import fields",
      detail: imported ? `${imported} fields previously imported` : "No prior website import recorded on profile",
      liveData: imported > 0,
    });
    return buildResult(
      "website-import",
      checks,
      imported ? "Limited — prior import on profile; run live fetch to re-verify" : "Limited — URL present; run live fetch test",
      "Run live integration proof with website fetch enabled",
    );
  }

  try {
    const analysis = await analyzeWebsiteForPharmacy(website, profile);
    const brand = analysis.brand;
    const nameOk = Boolean(brand.businessName);
    const logoOk = Boolean(brand.logoUrl);
    const colourOk = Boolean(brand.primaryColour);
    const headerOk = Boolean(brand.headerBackgroundColour || brand.headerTextColour);
    const footerOk = Boolean(brand.footerLinks?.length || brand.footerBackgroundColour);
    const contactOk = Boolean(brand.contact.phone || brand.contact.email);
    const servicesOk = analysis.detectedServices.length > 0;
    const descOk = Boolean(analysis.profilePatch.businessDescription);
    const hoursOk = Boolean(
      analysis.profilePatch.openingHours ||
        analysis.profilePatch.openingHoursMonday ||
        analysis.profilePatch.openingHoursTuesday,
    );

    checks.push(
      {
        id: "fetch",
        ok: true,
        label: "Website fetch",
        detail: `Fetched ${website} (${brand.warnings.length} warnings)`,
        liveData: true,
      },
      {
        id: "business-name",
        ok: nameOk,
        label: "Business name extracted",
        detail: brand.businessName || "Not detected",
        liveData: nameOk,
      },
      {
        id: "logo",
        ok: logoOk,
        label: "Logo detected",
        detail: logoOk ? brand.logoUrl : "Not detected",
        liveData: logoOk,
      },
      {
        id: "colours",
        ok: colourOk,
        label: "Brand colours extracted",
        detail: colourOk ? `Primary ${brand.primaryColour}` : "Not detected",
        liveData: colourOk,
      },
      {
        id: "header-footer",
        ok: headerOk || footerOk,
        label: "Header/footer styling",
        detail: headerOk ? `Header ${brand.headerBackgroundColour || "detected"}` : footerOk ? `${brand.footerLinks.length} footer links` : "Limited detection",
        liveData: headerOk || footerOk,
      },
      {
        id: "contact",
        ok: contactOk,
        label: "Contact details",
        detail: [brand.contact.phone, brand.contact.email].filter(Boolean).join(" · ") || "Not detected",
        liveData: contactOk,
      },
      {
        id: "footer-links",
        ok: (brand.footerLinks?.length || 0) > 0,
        label: "Footer links",
        detail: `${brand.footerLinks?.length || 0} links detected`,
        liveData: (brand.footerLinks?.length || 0) > 0,
      },
      {
        id: "services",
        ok: servicesOk,
        label: "Services detected",
        detail: servicesOk
          ? analysis.detectedServices.map((s) => s.serviceName).slice(0, 5).join(", ")
          : "No pharmacy services detected in HTML",
        liveData: servicesOk,
      },
      {
        id: "description",
        ok: descOk,
        label: "Business description",
        detail: descOk
          ? `${String(analysis.profilePatch.businessDescription).slice(0, 80)}…`
          : "Not extracted from meta/schema",
        liveData: descOk,
      },
      {
        id: "opening-hours",
        ok: hoursOk,
        label: "Opening hours",
        detail: hoursOk
          ? String(analysis.profilePatch.openingHours || "Per-day hours extracted")
          : "Not available on website",
        liveData: hoursOk,
      },
    );

    const okCount = checks.filter((c) => c.ok && c.liveData).length;
    return buildResult(
      "website-import",
      checks,
      okCount >= 3 ? `Connected — website import fetch succeeded (${okCount} live signals)` : "Limited — fetch worked but few brand signals detected",
    );
  } catch (err) {
    checks.push({
      id: "fetch-error",
      ok: false,
      label: "Website fetch error",
      detail: err instanceof Error ? err.message : String(err),
      liveData: false,
    });
    return buildResult("website-import", checks, "Error — website fetch failed");
  }
}

function probeStaticPublishing(slug: string): LiveIntegrationResult {
  const checks: LiveIntegrationCheck[] = [];
  const live = getPharmacyLivePublishStatus(slug);
  const output = getPharmacyPublishOutputStatus(slug);
  const indexing = getPharmacyIndexingBridgeStatus(slug);
  const sitemapFile = path.join(OUTPUT_DIR, "pharmacy-publish", slug, "sitemap.xml");
  const sitemapExists = fs.existsSync(sitemapFile) || indexing.sitemapExists;

  checks.push(
    {
      id: "static-output",
      ok: Boolean(output?.pageCount),
      label: "Static HTML output",
      detail: output?.pageCount ? `${output.pageCount} pages in publish output` : "No publish output — run Prepare publish",
      liveData: Boolean(output?.pageCount),
    },
    {
      id: "sitemap",
      ok: sitemapExists,
      label: "Sitemap generated",
      detail: sitemapExists ? (fs.existsSync(sitemapFile) ? sitemapFile : indexing.sitemapPath) : "Sitemap not generated",
      liveData: sitemapExists,
    },
    {
      id: "publish-prepared",
      ok: live.staticOutputReady,
      label: "Publish manifest",
      detail: live.lastPreparedAt ? `Prepared ${live.lastPreparedAt.slice(0, 10)} · ${live.pageCount} pages` : "Not prepared yet",
      liveData: live.staticOutputReady,
    },
    {
      id: "last-published",
      ok: Boolean(live.lastPublishedAt),
      label: "Last live publish",
      detail: live.lastPublishedAt
        ? `${live.lastPublishedAt.slice(0, 10)} · ${live.pagesPublished} pages${live.lastPublishedUrl ? ` · ${live.lastPublishedUrl}` : ""}`
        : "Not published live yet",
      liveData: Boolean(live.lastPublishedAt),
    },
  );

  const ready = output.pageCount > 0 && sitemapExists;
  return buildResult(
    "static-publishing",
    checks,
    ready ? "Ready — static publishing output prepared" : "Not Connected — prepare publish output from generated content",
    ready ? undefined : "Run Prepare publish from Publishing Settings",
    output.hasPublishOutput ? path.join(PUBLISH_ROOT, slug, "_publish-index.json") : undefined,
  );
}

async function probeFtp(slug: string, runLive: boolean, safeWrite: boolean): Promise<LiveIntegrationResult> {
  const deploy = loadProjectDeploy(slug);
  const live = getPharmacyLivePublishStatus(slug);
  const checks: LiveIntegrationCheck[] = [];

  checks.push(
    {
      id: "deploy-config",
      ok: Boolean(deploy.enabled),
      label: "FTP host configured",
      detail: deploy.enabled ? `${deploy.host}:${deploy.port || 21}` : "No deploy.host in project config",
      liveData: false,
    },
    {
      id: "credentials",
      ok: Boolean(deploy.username && deploy.password),
      label: "FTP credentials",
      detail: deploy.username && deploy.password ? "Username and password available" : "Set DEPLOY_USERNAME and DEPLOY_PASSWORD",
      liveData: false,
    },
  );

  if (!deploy.enabled || !deploy.username || !deploy.password) {
    return buildResult("ftp-publishing", checks, "Not Connected — FTP not configured");
  }

  if (!runLive) {
    return buildResult(
      "ftp-publishing",
      checks,
      live.lastFtpTestOk ? "Ready — FTP test passed previously" : "Limited — credentials present; run live FTP test to confirm connection",
      live.lastFtpTestOk ? undefined : "Run integration proof with live FTP test",
    );
  }

  if (safeWrite) {
    const test = await safeFtpConnectionTest(slug);
    checks.push({
      id: "connection",
      ok: test.ok,
      label: "FTP connection",
      detail: test.detail,
      liveData: test.ok,
    });
    if (test.verified) {
      checks.push({
        id: "safe-write",
        ok: true,
        label: "Safe write/read/delete test",
        detail: "Test file written, verified, and removed",
        liveData: true,
      });
    }
    return buildResult(
      "ftp-publishing",
      checks,
      test.ok ? "Connected — FTP connection verified" : "Error — FTP connection failed",
    );
  }

  const client = new ftp.Client(15000);
  try {
    await client.access({
      host: deploy.host!,
      port: deploy.port ?? 21,
      user: deploy.username,
      password: deploy.password,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    });
    const remoteRoot = (deploy.remoteRoot ?? "/").replace(/\/+$/, "") || "/";
    const listing = await client.list(remoteRoot);
    checks.push({
      id: "connection",
      ok: true,
      label: "FTP connection",
      detail: `Connected to ${deploy.host} — ${listing.length} items in ${remoteRoot || "/"}`,
      liveData: true,
    });
    return buildResult("ftp-publishing", checks, "Connected — FTP connection verified");
  } catch (err) {
    checks.push({
      id: "connection-error",
      ok: false,
      label: "FTP connection error",
      detail: err instanceof Error ? err.message : String(err),
      liveData: false,
    });
    return buildResult("ftp-publishing", checks, "Error — FTP connection failed");
  } finally {
    client.close();
  }
}

function probeGsc(slug: string): LiveIntegrationResult {
  const checks: LiveIntegrationCheck[] = [];
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const oauthId = process.env.GSC_OAUTH_CLIENT_ID?.trim();
  const oauthSecret = process.env.GSC_OAUTH_CLIENT_SECRET?.trim();
  const tokens = loadOAuthTokens();
  const tracking = readTrackingReport(slug, OUTPUT_DIR);

  checks.push(
    {
      id: "service-account",
      ok: Boolean(saJson && saJson.startsWith("{")),
      label: "Service account JSON",
      detail: saJson ? "GOOGLE_SERVICE_ACCOUNT_JSON configured" : "Not configured",
      liveData: false,
    },
    {
      id: "oauth-client",
      ok: Boolean(oauthId && oauthSecret && oauthSecret !== "PASTE_SECRET_HERE"),
      label: "OAuth client",
      detail: oauthId ? "GSC OAuth client configured" : "GSC_OAUTH_CLIENT_ID not set",
      liveData: false,
    },
    {
      id: "oauth-connected",
      ok: Boolean(tokens?.refresh_token),
      label: "OAuth connected",
      detail: tokens?.refresh_token ? "Refresh token available" : "Not connected — complete GSC OAuth flow",
      liveData: false,
    },
    {
      id: "index-tracking",
      ok: Boolean(tracking?.records?.length),
      label: "Index tracking data",
      detail: tracking?.records?.length
        ? `${tracking.records.length} URLs with live inspection data`
        : "No index-tracking.json — refresh will use estimated status",
      liveData: Boolean(tracking?.records?.length),
    },
  );

  const hasLiveIndexing = Boolean(tracking?.records?.length);
  const hasAuth = Boolean(tokens?.refresh_token || (saJson && saJson.startsWith("{")));
  if (!hasAuth) {
    return buildResult(
      "google-search-console",
      checks,
      "Not Connected — Search Console not authenticated",
      "Connect GSC OAuth at /api/gsc/auth/start or set service account JSON",
    );
  }

  if (tracking?.records?.length) {
    const indexed = tracking.records.filter((r) => r.status === "indexed").length;
    return buildResult(
      "google-search-console",
      checks,
      `Connected — ${tracking.records.length} URLs tracked (${indexed} indexed)`,
      undefined,
      path.join(OUTPUT_DIR, slug, "index-tracking.json"),
    );
  }

  return buildResult(
    "google-search-console",
    checks,
    "Limited — credentials present but no live index tracking file yet",
    "Run index tracking refresh after pages are registered",
  );
}

function probeRankTracking(slug: string): LiveIntegrationResult {
  const checks: LiveIntegrationCheck[] = [];
  const rankFile = path.join(OUTPUT_DIR, slug, "rank-tracking.json");
  const exists = fs.existsSync(rankFile);
  let keywords = 0;
  let generatedAt = "";
  let live = false;

  if (exists) {
    try {
      const doc = JSON.parse(fs.readFileSync(rankFile, "utf8")) as {
        generatedAt?: string;
        summary?: { keywordsCount?: number; totalImpressions?: number };
      };
      keywords = doc.summary?.keywordsCount || 0;
      generatedAt = doc.generatedAt || "";
      live = keywords > 0;
    } catch {
      /* ignore */
    }
  }

  checks.push(
    {
      id: "rank-file",
      ok: exists,
      label: "Rank tracking file",
      detail: exists ? rankFile : "rank-tracking.json not found",
      liveData: false,
    },
    {
      id: "keywords",
      ok: live,
      label: "Keywords tracked",
      detail: live ? `${keywords} keywords${generatedAt ? ` · built ${generatedAt.slice(0, 10)}` : ""}` : "No live keyword data",
      liveData: live,
    },
  );

  const visibility = readPharmacyVisibilityReport(slug);
  if (visibility) {
    const simNote = !live && visibility.estimatedVisibilityScore > 0;
    checks.push({
      id: "visibility-report",
      ok: live || visibility.trackedPages === 0,
      label: "Visibility report",
      detail: live
        ? `${visibility.trackedKeywords} keywords · score ${visibility.estimatedVisibilityScore}`
        : simNote
          ? "Visibility report exists but uses estimated data — not live ranks"
          : `${visibility.trackedPages} pages tracked`,
      liveData: live,
    });
  }

  if (live) {
    return buildResult("rank-tracking", checks, `Connected — ${keywords} keywords in rank tracking`, undefined, rankFile);
  }

  return buildResult(
    "rank-tracking",
    checks,
    exists ? "Limited — rank file exists but no keyword data" : "Not Connected — build rank tracking from Search Console",
    "Run: npx tsx scripts/build-rank-tracking.ts " + slug,
  );
}

export async function runLiveIntegrationProof(
  slug: string,
  options: LiveProofOptions = {},
): Promise<LiveIntegrationProofReport> {
  const run = options.runLive || {};

  const integrations: LiveIntegrationResult[] = [
    await probeGooglePlaces(slug, run["google-places"] === true),
    await probeWebsiteImport(slug, run["website-import"] === true),
    await probeIdeogram(),
    probeStaticPublishing(slug),
    await probeFtp(slug, run["ftp-publishing"] === true, options.ftpSafeWrite === true),
    probeGsc(slug),
    probeRankTracking(slug),
  ];

  const connectedCount = integrations.filter((i) => i.status === "ready" || i.status === "connected").length;
  const report: LiveIntegrationProofReport = {
    version: LIVE_INTEGRATION_PROOF_VERSION,
    slug,
    checkedAt: new Date().toISOString(),
    overallReady: connectedCount >= 4,
    connectedCount,
    integrations,
  };

  fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
  fs.writeFileSync(proofPath(slug), JSON.stringify(report, null, 2));
  return report;
}

export function loadLiveIntegrationProof(slug: string): LiveIntegrationProofReport | null {
  const file = proofPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as LiveIntegrationProofReport;
  } catch {
    return null;
  }
}

export async function buildLiveIntegrationProofReport(
  slug: string,
  options?: LiveProofOptions,
): Promise<LiveIntegrationProofReport> {
  const cached = loadLiveIntegrationProof(slug);
  if (cached && !options?.runLive) return cached;
  return runLiveIntegrationProof(slug, options);
}
