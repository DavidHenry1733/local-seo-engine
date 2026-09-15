import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import * as ftp from "basic-ftp";
import type { RolloutBody, RolloutProgressEvent, ProjectConfig } from "./types";

import {
  buildAllSelectedAreaDefs,
  buildClusterConfig,
  writeClusterConfig,
} from "../../../../../src/generator/buildClusterConfigs";
import type { SelectedAreaPageDef } from "../../../../../src/generator/buildClusterConfigs";
import { generateClusterContent } from "../../../../../src/generator/generateClusterContent";
import type { ClusterPageInputs } from "../../../../../src/generator/generateClusterContent";
import { applyWebDesignNarrativePackage } from "../../../../../src/narratives/applyWebDesignNarrativePackage";
import { applyLocalSeoNarrativePackage } from "../../../../../src/narratives/applyLocalSeoNarrativePackage";
import { refineClusterContent } from "../../../../../src/generator/refineContent";
import { renderClusterHtml } from "../../../../../src/generator/renderClusterPage";
import type { RenderProjectConfig } from "../../../../../src/generator/renderClusterPage";
import { sortByTier, writeRolloutLog } from "../../../../../src/generator/rolloutRunner";
import type { RolloutEntry, RolloutLog, RolloutTotals } from "../../../../../src/generator/rolloutTypes";
import type { AreaEngineOutput } from "../../../../../src/area/areaTypes";
import { runPreflight } from "../../../../../src/generator/preflightCheck";
import type { PreflightOptions } from "../../../../../src/generator/preflightCheck";
import { runPostRenderCheck } from "../../../../../src/generator/postRenderCheck";
import { scoreAiReadiness, formatAiReadinessSummary } from "../../../../../src/generator/aiReadinessScore";
import type { AiReadinessResult } from "../../../../../src/generator/aiReadinessScore";
import { optimiseForAiCitation } from "../../../../../src/generator/aiCitationOptimiser";
import type { AiCitationContext } from "../../../../../src/generator/aiCitationOptimiser";
import { rebuildSitemapForClient } from "./searchConsole";
import { selectPageImages, serviceDisplayName, approvedImages, imageFilePath } from "../../../../../src/generator/imageLibrary";
import { normaliseServiceKey } from "./images";
import type { PageImageSelections, ImageLibraryConfig } from "../../../../../src/generator/imageLibrary";
import {
  applyImageSelectionsToHtml,
  findCampaignPaneSlotFile,
  resolveFinalImageSelections,
  buildCampaignPaneImageUrl,
} from "../../../../../src/generator/campaignPaneImages";
import { logger } from "../../lib/logger";
import { loadProviderProfile } from "./providerProfiles";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR = path.join(WORKSPACE_ROOT, "config", "projects");
const INDUSTRY_PROFILES_PATH = path.join(WORKSPACE_ROOT, "config", "industryProfiles.json");

// ── Industry profile loader ───────────────────────────────────────────────────
// Returns the matching profile object from config/industryProfiles.json or
// undefined if the industryType is not set / not found.
function loadIndustryProfile(
  industryType: string | undefined
): Record<string, unknown> | undefined {
  if (!industryType) return undefined;
  try {
    const raw = fs.readFileSync(INDUSTRY_PROFILES_PATH, "utf8");
    const profiles = JSON.parse(raw) as Array<Record<string, unknown>>;
    return profiles.find((p) => p["industryType"] === industryType);
  } catch {
    return undefined;
  }
}

const router = Router();

/**
 * Thrown by runOneArea() when the post-render smoke check fails.
 * Carries the individual failure descriptions so the outer loop can log them
 * on the RolloutEntry without re-running the check.
 */
class SmokeCheckError extends Error {
  smokeCheckFailures: string[];
  constructor(message: string, failures: string[]) {
    super(message);
    this.name = "SmokeCheckError";
    this.smokeCheckFailures = failures;
  }
}

// ── Job-based polling infrastructure ─────────────────────────────────────────
// POST /api/rollout starts a background job and returns { jobId } immediately.
// The client polls GET /api/rollout/status/:jobId every 2 s for updates.
// This avoids the Replit proxy buffering that breaks SSE over POST responses.
const JOB_DIR = "/tmp/seo-rollout-jobs";

interface JobState {
  jobId: string;
  status: "running" | "done" | "error" | "cancelled";
  events: RolloutProgressEvent[];
  log?: unknown;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  cancelledAt?: string;
}

function writeJobState(jobId: string, state: JobState): void {
  if (!fs.existsSync(JOB_DIR)) fs.mkdirSync(JOB_DIR, { recursive: true });
  fs.writeFileSync(path.join(JOB_DIR, `${jobId}.json`), JSON.stringify(state), "utf8");
}

// ── Campaign→industry helpers ──────────────────────────────────────────────────
// Derive an industryType from a campaign service name when the session doesn't
// explicitly carry one (e.g. sessions created before this field was added).

function loadServiceBlueprint(serviceKey: string | undefined): Record<string, unknown> | undefined {
  if (!serviceKey) return undefined;
  const key = serviceKey.toLowerCase().trim().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
  const fp = path.join(WORKSPACE_ROOT, "config", "service-blueprints", `${key}.json`);
  if (!fs.existsSync(fp)) return undefined;
  try { return JSON.parse(fs.readFileSync(fp, "utf8")) as Record<string, unknown>; }
  catch { return undefined; }
}

function deriveIndustryFromService(serviceName: string): string | undefined {
  const svc = serviceName.toLowerCase().trim();
  if (!svc) return undefined;

  // ── Digital services — checked first so they always win ───────────────────
  if (/web[\s-]?des|website[\s-]?des/.test(svc))  return "web-design";
  if (/local[\s-]?seo/.test(svc))                  return "local-seo";
  if (/local[\s_-]?business[\s_-]?visibility/.test(svc)) return "local-business-visibility";
  if (/google[\s-]?business[\s-]?profile/.test(svc)) return "google-business-profile";
  if (/\bgbp\b/.test(svc))                         return "google-business-profile";
  if (/google[\s-]?maps/.test(svc))                 return "google-business-profile";
  if (/\bseo\b/.test(svc))                         return "seo";
  if (/web[\s-]?host/.test(svc))                   return "web-hosting";
  if (/email[\s-]?mark/.test(svc))                 return "email-marketing";
  if (/digital[\s-]?mark/.test(svc))               return "digital-marketing";
  if (/\bppc\b/.test(svc))                         return "ppc";
  if (/social[\s-]?media/.test(svc))               return "social-media-marketing";

  // ── Named trade/household industries ──────────────────────────────────────
  if (/plumb|drain/.test(svc))                     return "plumbing";
  if (/electr/.test(svc))                          return "electrical";
  if (/boiler|heat(?:ing)?|gas[\s-]?eng/.test(svc)) return "heating";
  if (/roof/.test(svc))                            return "roofing";
  if (/landscape|garden/.test(svc))                return "landscaping";

  // ── Generic-trade fallback ─────────────────────────────────────────────────
  // If the name contains none of the digital indicator words, treat it as a
  // generic household trade service. This covers pest control, window cleaning,
  // locksmiths, tree surgeons, carpet cleaners, painters, tilers, joiners, etc.
  // without needing to enumerate every possible trade.
  const isDigitalName = /digital|online|marketing|website|\bweb\b|social|ppc|adwords|\bads\b|content|branding|graphic|e[\s-]?commerce|app[\s-]?dev|mobile[\s-]?app/.test(svc);
  if (!isDigitalName) return "genericTrade";

  return undefined; // Digital-ish name but no specific match — let caller fall back to project default
}

// Given a resolved industryType, return the sensible default buyerType.
function deriveDefaultBuyerType(
  industryType: string
): "household" | "business" | undefined {
  const householdSet = new Set([
    "plumbing","electrical","heating","roofing","landscaping","genericTrade",
  ]);
  const businessSet  = new Set([
    "web-design","local-seo","seo","web-hosting",
    "google-business-profile",
    "email-marketing","digital-marketing","ppc","social-media-marketing",
  ]);
  if (householdSet.has(industryType)) return "household";
  if (businessSet.has(industryType))  return "business";
  return undefined;
}

function normaliseCampaignValue(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function normaliseAreaName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

interface RequestedRolloutContext {
  hasContext: boolean;
  service: string;
  city: string;
  areas: Set<string>;
}

function inferRequestedRolloutContext(rawDefs: unknown): RequestedRolloutContext {
  const defs = Array.isArray(rawDefs) ? defsFromUnknown(rawDefs) : [];
  const services = new Set<string>();
  const cities = new Set<string>();
  const areas = new Set<string>();

  for (const def of defs) {
    const signals = def.signals as Record<string, unknown> | undefined;
    const service = String(def.service ?? signals?.serviceName ?? "");
    const city = String(def.city ?? signals?.city ?? "");
    const area = String(def.area ?? signals?.area ?? "");

    if (service) services.add(normaliseCampaignValue(service));
    if (city) cities.add(normaliseAreaName(city));
    if (area) areas.add(normaliseAreaName(area));
  }

  return {
    hasContext: defs.length > 0 && (services.size > 0 || cities.size > 0 || areas.size > 0),
    service: services.size === 1 ? [...services][0] : "",
    city: cities.size === 1 ? [...cities][0] : "",
    areas,
  };
}

function defsFromUnknown(rawDefs: unknown): Array<Record<string, unknown>> {
  return Array.isArray(rawDefs)
    ? rawDefs.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

function sessionMatchesRequestedContext(
  session: Record<string, unknown>,
  requested: RequestedRolloutContext,
): boolean {
  if (!requested.hasContext) return true;

  const campaign = session.campaign as { cityName?: string; serviceName?: string; serviceKey?: string } | undefined;
  const sessionService = normaliseCampaignValue(campaign?.serviceKey) || normaliseCampaignValue(campaign?.serviceName);
  const sessionCity = normaliseAreaName(campaign?.cityName);
  const sessionDefs = (session.selectedAreaDefs as Array<Record<string, unknown>> | undefined) ?? [];
  const sessionAreas = new Set(
    sessionDefs
      .map((def) => normaliseAreaName(String(def.area ?? "")))
      .filter(Boolean),
  );

  if (requested.service && sessionService !== requested.service) return false;
  if (requested.city && sessionCity !== requested.city) return false;
  if (requested.areas.size > 0 && sessionAreas.size > 0) {
    for (const area of requested.areas) {
      if (!sessionAreas.has(area)) return false;
    }
  }

  return true;
}

function findMatchingCampaignSession(
  clientDir: string,
  requested: RequestedRolloutContext,
): string | null {
  if (!requested.hasContext) return null;

  const sessionsDir = path.join(clientDir, "sessions");
  if (!fs.existsSync(sessionsDir)) return null;

  const candidates = fs
    .readdirSync(sessionsDir)
    .filter((file) => file.endsWith(".json") && !file.endsWith("-area-defs.json"))
    .map((file) => path.join(sessionsDir, file));

  for (const candidate of candidates) {
    try {
      const session = JSON.parse(fs.readFileSync(candidate, "utf8")) as Record<string, unknown>;
      if (sessionMatchesRequestedContext(session, requested)) return candidate;
    } catch {
      // Ignore malformed campaign session files.
    }
  }

  return null;
}

function readJobState(jobId: string): JobState | null {
  const f = path.join(JOB_DIR, `${jobId}.json`);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")) as JobState; } catch { return null; }
}

function appendJobEvent(jobId: string, event: RolloutProgressEvent): void {
  const state = readJobState(jobId);
  if (!state) return;
  state.events.push(event);
  writeJobState(jobId, state);
}

async function runRolloutJob(
  jobId: string,
  params: {
    clientSlug: string;
    project: ProjectConfig;
    defs: SelectedAreaPageDef[];
    opts: { includeSecondary: boolean; dryRun: boolean; deferTertiary: boolean; concurrency?: number };
    sessionCampaignId: string;
    sessionCampaign: { cityName?: string; serviceName?: string; serviceKey?: string; moneyPageUrl?: string; focusKeyword?: string; industryType?: string; buyerType?: string } | undefined;
    sessionHubId: string;
  }
): Promise<void> {
  const { clientSlug, project, defs, opts, sessionCampaignId, sessionCampaign, sessionHubId } = params;
  const { includeSecondary, dryRun, deferTertiary } = opts;
  const concurrencyN = Math.min(Math.max(opts.concurrency ?? 1, 1), 3);
  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  // Campaign-level industryType/buyerType take priority over the project-level values.
  // This enables multi-industry projects (e.g. a web-design agency project that also
  // runs trade service campaigns). The derivation fallback handles legacy sessions that
  // predate the explicit industryType field.
  const _campIndustry   = sessionCampaign?.industryType  ?? deriveIndustryFromService(sessionCampaign?.serviceName ?? "");
  const _campBuyerType  = sessionCampaign?.buyerType     ?? (_campIndustry ? deriveDefaultBuyerType(_campIndustry) : undefined);
  // Load the customer provider profile for non-digital campaigns so schema
  // uses the actual service provider's details instead of the agency identity.
  const _campProviderProfile = loadProviderProfile(clientSlug, sessionCampaign?.serviceKey ?? "");
  const renderConfig: RenderProjectConfig = {
    ...toRenderConfig(project),
    ...(_campIndustry        ? { industryType:    _campIndustry }                                          : {}),
    ...(_campBuyerType       ? { buyerType:       _campBuyerType as RenderProjectConfig["buyerType"] }     : {}),
    ...(_campProviderProfile ? { customerProfile: _campProviderProfile }                                   : {}),
  };

  const sorted = sortByTier(defs);

  // Compute the correct campaign-level hub URL from session metadata.
  // Cluster defs saved by older wizard runs pointed at the site root — fix
  // them here so every rollout (new or re-run) uses the right URL.
  const _domain = project.domain.replace(/\/+$/, "");
  const normaliseCity = (value: string | undefined): string =>
    (value ?? "").trim().toLowerCase();
  const slugValue = (value: string | undefined): string =>
    (value ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/-+$/, "");
  const serviceSlugFrom = (serviceName: string | undefined, cityName?: string): string => {
    const rawLc = (serviceName ?? "web design").trim().toLowerCase();
    const cityLc = (cityName ?? "").trim().toLowerCase();
    const bare = cityLc && rawLc.endsWith(cityLc)
      ? rawLc.slice(0, rawLc.length - cityLc.length).trim()
      : rawLc;
    return slugValue(bare);
  };
  const serviceKeyFromSlug = (serviceSlug: string): string =>
    serviceSlug.replace(/-/g, "_").replace(/^web_hosting$/, "website_hosting");
  const cityForDef = (def: SelectedAreaPageDef): string =>
    def.city || ((def.signals as unknown as Record<string, unknown> | undefined)?.city as string | undefined) || sessionCampaign?.cityName || "";
  const hubUrlForDef = (def: SelectedAreaPageDef): string => {
    const citySlug = slugValue(cityForDef(def));
    const serviceSlug = serviceSlugFrom(def.service ?? sessionCampaign?.serviceName, cityForDef(def));
    return citySlug ? `${_domain}/${serviceSlug}-${citySlug}/` : `${_domain}/`;
  };
  const hubAnchorForDef = (def: SelectedAreaPageDef): string =>
    `${def.service ?? sessionCampaign?.serviceName ?? "Web Design"} ${cityForDef(def)}`.trim();

  // Always recompute relatedPages with full domain URLs so the AI receives
  // proper absolute hrefs. Saved session values (relative/preview paths) are
  // intentionally overridden here — stale paths cause wrong links in output.
  const clusterSiblings = sorted.filter((d) => d.tier !== "hub");

  // ── "Areas We Cover" links ────────────────────────────────────────────────
  // Same-service sibling pages are scoped by each page's own city. This prevents
  // mixed-city rollout batches from leaking Rotherham links into Sheffield pages.
  const clusterAreaLinksForDef = (def: SelectedAreaPageDef) =>
    clusterSiblings
      .filter((d) =>
        d.area &&
        d.remotePath &&
        d.area !== def.area &&
        normaliseCity(cityForDef(d)) === normaliseCity(cityForDef(def)),
      )
      .map((d) => ({
        href:  `${_domain}${d.remotePath}`,
        label: `${def.service ?? sessionCampaign?.serviceName ?? "Web Design"} ${d.area}`,
      }));

  // ── "Related Services" internalLinks ──────────────────────────────────────
  // Scan all campaign sessions for this client to find hub pages in the same
  // city — these become the cross-service "Related Services" cards. Filtering is
  // done per def below, not against the campaign city, to avoid wrong-city links.
  const CORE_RS_KEYS = new Set(["web_design", "local_seo", "website_hosting", "email_marketing"]);
  const _allCrossServiceLinks: import("../../../../../src/generator/types").InternalLinkConfig[] = [];
  try {
    const _sessDir = path.join(OUTPUT_DIR, clientSlug, "sessions");
    if (fs.existsSync(_sessDir)) {
      for (const sf of fs.readdirSync(_sessDir).filter((f) => f.endsWith(".json"))) {
        try {
          const sfData = JSON.parse(fs.readFileSync(path.join(_sessDir, sf), "utf8")) as Record<string, unknown>;
          const sfCamp = sfData.campaign as { cityName?: string; serviceName?: string } | undefined;
          if (!sfCamp?.cityName || !sfCamp?.serviceName) continue;
          const cityLc   = normaliseCity(sfCamp.cityName);
          const svcSlug  = serviceSlugFrom(sfCamp.serviceName, sfCamp.cityName);
          const citySlug = slugValue(cityLc);
          const hubPath  = `/${svcSlug}-${citySlug}/`;
          const hubUrl   = `${_domain}${hubPath}`;
          const svcKey   = serviceKeyFromSlug(svcSlug);
          if (!CORE_RS_KEYS.has(svcKey)) continue;
          if (!_allCrossServiceLinks.some((l) => l.href === hubUrl)) {
            _allCrossServiceLinks.push({ href: hubUrl, service: svcKey, location: sfCamp.cityName, tier: "hub" });
          }
        } catch { /* skip malformed sessions */ }
      }
    }
  } catch { /* non-fatal */ }
  const internalLinksForDef = (def: SelectedAreaPageDef) => {
    const defCity = normaliseCity(cityForDef(def));
    const defServiceSlug = serviceSlugFrom(def.service ?? sessionCampaign?.serviceName, cityForDef(def));
    const defServiceKey = serviceKeyFromSlug(defServiceSlug);
    const links = _allCrossServiceLinks.filter((link) =>
      normaliseCity(link.location) === defCity &&
      link.service !== defServiceKey,
    );
    return links.length > 0 ? { links } : undefined;
  };
  const sortedWithRelated = sorted.map((def) => {
    const svcLower = (def.service ?? sessionCampaign?.serviceName ?? "web design").toLowerCase();
    const sameCitySiblings = clusterSiblings.filter((d) =>
      normaliseCity(cityForDef(d)) === normaliseCity(cityForDef(def)),
    );
    if (def.tier === "hub") {
      // Hub page: relatedPages = ALL cluster pages with full domain URLs.
      // The AI prompt and post-processing both rely on these being absolute.
      const hubRelatedPages = sameCitySiblings
        .map((d) => `${svcLower} ${d.area ?? ""} (${_domain}${d.remotePath ?? ""})`)
        .join(", ");
      // hubUrl/hubAnchor for a hub page = the campaign money page (e.g. inboxingproweb.com/hosting).
      // This gives the hub page's inline body link a meaningful destination — the main service page —
      // rather than the bare site root which produces a meaningless href="/".
      // Auto-derive from project.serviceMoneyPages[serviceKey] when session has no moneyPageUrl set.
      const _sessionSvcKey = ((sessionCampaign as any)?.serviceKey ?? "")
        .toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
      const _svcMoneyPages = (project as any).serviceMoneyPages as Record<string, string> | undefined;
      const _derivedMoneyUrl = _svcMoneyPages?.[_sessionSvcKey] ?? "";
      const hubSiteUrl    = sessionCampaign?.moneyPageUrl || _derivedMoneyUrl || (project as any).moneyPageUrl || `${_domain}/`;
      const hubSiteAnchor = def.hubAnchor || hubAnchorForDef(def) || svcLower;
      return { ...def, relatedPages: hubRelatedPages, hubUrl: hubSiteUrl, hubAnchor: hubSiteAnchor };
    }
    // Cluster page: always recompute sibling list with full domain URLs
    // and correct the hub URL / anchor that older session data may have wrong.
    const siblings = sameCitySiblings.filter((d) => d.area !== def.area);
    const relatedPages = siblings
      .map((d) => `${svcLower} ${d.area ?? ""} (${_domain}${d.remotePath ?? ""})`)
      .join(", ");
    return { ...def, relatedPages, hubUrl: hubUrlForDef(def), hubAnchor: hubAnchorForDef(def) };
  });

  const toProcess: SelectedAreaPageDef[] = [];
  const deferred:  SelectedAreaPageDef[] = [];

  for (const def of sortedWithRelated) {
    if (def.tier === "tertiary" && deferTertiary) {
      deferred.push(def);
    } else if (def.tier === "secondary" && !includeSecondary) {
      deferred.push(def);
    } else {
      toProcess.push(def);
    }
  }

  const runId     = randomUUID();
  const startedAt = new Date().toISOString();
  const entries: RolloutEntry[] = [];

  // Emit deferred events immediately
  const deferredAt = new Date().toISOString();
  for (const def of deferred) {
    appendJobEvent(jobId, { type: "progress", area: def.area, tier: def.tier, step: "deferred", status: "deferred", durationMs: 0 });
    entries.push({ area: def.area, city: def.city, tier: def.tier, status: "deferred", attempts: 0, configPath: def.configPath, outputPath: "", liveUrl: "", durationMs: 0, startedAt: deferredAt, finishedAt: deferredAt });
  }

  // Upload project images to FTP once before page generation (if deploy enabled).
  // Uses image-meta.json as the single source of truth for which file belongs to
  // which slot and which service subdir — exactly the same logic as findSlotFile()
  // inside runOneArea so the uploaded path always matches the page's <img> src.
  if (!dryRun && project.deploy?.enabled) {
    const projectAssetsDir = path.join(OUTPUT_DIR, clientSlug, "assets");
    const imageSlots = ["hero", "support", "trust", "conversion"] as const;
    // Read meta to know exactly where each slot file lives
    const _ftpMetaPath = path.join(projectAssetsDir, "image-meta.json");
    const _ftpMeta: Record<string, Record<string, unknown>> = fs.existsSync(_ftpMetaPath)
      ? JSON.parse(fs.readFileSync(_ftpMetaPath, "utf8")) as Record<string, Record<string, unknown>>
      : {};
    // Resolve per-slot: { localPath, ext, remoteSubDir }
    type FtpSlot = { localPath: string; ext: string; remoteSubDir: string } | null;
    const _resolveFtpSlot = (slot: string): FtpSlot => {
      const m = _ftpMeta[slot];
      if (m) {
        const svcKey = (m.serviceKey as string | undefined) ?? "";
        const dir = svcKey ? path.join(projectAssetsDir, svcKey) : projectAssetsDir;
        const found = _findSlotFile(dir, slot);
        if (found) return { ...found, remoteSubDir: svcKey };
      }
      // Fallback: scan service subdirs then root (legacy assets without meta entry)
      if (fs.existsSync(projectAssetsDir)) {
        for (const d of fs.readdirSync(projectAssetsDir)) {
          if (d.includes(".")) continue;
          try { if (!fs.statSync(path.join(projectAssetsDir, d)).isDirectory()) continue; } catch { continue; }
          const found = _findSlotFile(path.join(projectAssetsDir, d), slot);
          if (found) return { ...found, remoteSubDir: d };
        }
      }
      const found = _findSlotFile(projectAssetsDir, slot);
      return found ? { ...found, remoteSubDir: "" } : null;
    };
    const ftpSlots = imageSlots.map((s) => ({ slot: s, resolved: _resolveFtpSlot(s) })).filter((x) => x.resolved !== null);
    if (ftpSlots.length > 0) {
      const ftpUser     = project.deploy.username || process.env.DEPLOY_USERNAME;
      const ftpPassword = project.deploy.password || process.env.DEPLOY_PASSWORD;
      if (ftpUser && ftpPassword) {
        const { host, port } = project.deploy;
        const imgFtp = new ftp.Client(30000);
        try {
          await imgFtp.access({ host, port: port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });
          const remoteAssetsBase = [(project.deploy.remoteRoot ?? "").replace(/\/+$/, ""), "assets", clientSlug].join("/").replace(/\/+/g, "/");
          for (const { slot, resolved } of ftpSlots) {
            if (!resolved) continue;
            const remoteDir = resolved.remoteSubDir
              ? `${remoteAssetsBase}/${resolved.remoteSubDir}`
              : remoteAssetsBase;
            try {
              await imgFtp.ensureDir(remoteDir);
              await imgFtp.uploadFrom(resolved.localPath, `${remoteDir}/${slot}${resolved.ext}`);
              logger.info(`[FTP cluster] uploaded ${slot}${resolved.ext} → ${remoteDir}/`);
            } catch (slotErr) {
              logger.error(`[FTP cluster] failed to upload ${slot}${resolved.ext}: ${slotErr instanceof Error ? slotErr.message : String(slotErr)}`);
            }
          }
          // Always upload root-level assets to root FTP path so fallback URLs
          // (used by campaigns whose service key doesn't match the meta) resolve on live server.
          for (const slot of imageSlots) {
            const rootFile = _findSlotFile(projectAssetsDir, slot);
            if (!rootFile) continue;
            try {
              await imgFtp.uploadFrom(rootFile.localPath, `${remoteAssetsBase}/${slot}${rootFile.ext}`);
              logger.info(`[FTP cluster] uploaded root ${slot}${rootFile.ext} → ${remoteAssetsBase}/`);
            } catch (slotErr) {
              logger.error(`[FTP cluster] failed to upload root ${slot}${rootFile.ext}: ${slotErr instanceof Error ? slotErr.message : String(slotErr)}`);
            }
          }
        } catch (connErr) {
          logger.error(`[FTP cluster] connection failed: ${connErr instanceof Error ? connErr.message : String(connErr)}`);
        } finally { imgFtp.close(); }
      }
    }

    // Push Image Library assets to FTP once per rollout so live pages can resolve them
    const libConfig = (project as any).imageLibrary as ImageLibraryConfig | undefined;
    if (libConfig?.enabled) {
      const ftpUser     = project.deploy.username || process.env.DEPLOY_USERNAME;
      const ftpPassword = project.deploy.password || process.env.DEPLOY_PASSWORD;
      if (ftpUser && ftpPassword) {
        const { host, port } = project.deploy;
        const remoteRoot = (project.deploy.remoteRoot ?? "").replace(/\/+$/, "");
        const libFtp = new ftp.Client(60000);
        try {
          await libFtp.access({ host, port: port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });
          for (const img of approvedImages()) {
            const localPath = imageFilePath(img);
            if (!fs.existsSync(localPath)) continue;
            const remoteDir = [remoteRoot, "assets", "image-library", img.service, img.slot]
              .join("/").replace(/\/+/g, "/");
            try {
              await libFtp.ensureDir(remoteDir);
              await libFtp.uploadFrom(localPath, img.filename);
            } catch { /* non-fatal per image */ }
          }
        } catch { /* non-fatal — live site falls back to static images */ } finally { libFtp.close(); }
      }
    }
  }

  // Process areas in parallel batches (concurrencyN areas at a time)
  const processOneDef = async (def: SelectedAreaPageDef): Promise<void> => {
    // Derive moneyPageUrl from project.serviceMoneyPages if session has none
    const _svcKey2 = ((sessionCampaign as any)?.serviceKey ?? "")
      .toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
    const _svcPages2 = (project as any).serviceMoneyPages as Record<string, string> | undefined;
    const _derivedMoney2 = _svcPages2?.[_svcKey2] ?? "";
    const _resolvedMoneyUrl = sessionCampaign?.moneyPageUrl || _derivedMoney2 || renderConfig.moneyPageUrl;

    const _defInternalLinksConfig = internalLinksForDef(def);
    const _defClusterAreaLinks = clusterAreaLinksForDef(def);
    const effectiveRenderConfig = def.tier === "hub"
      ? {
          ...renderConfig,
          isHub:            true,
          moneyPageUrl:     _resolvedMoneyUrl,
          moneyPageKeyword: sessionCampaign?.focusKeyword     || renderConfig.moneyPageKeyword,
          ...(_defInternalLinksConfig ? { internalLinks: _defInternalLinksConfig } : {}),
          ...(_defClusterAreaLinks.length ? { clusterAreaLinks: _defClusterAreaLinks } : {}),
        }
      : {
          ...renderConfig,
          // Pass Related Services (cross-service hubs) and Areas We Cover (sibling
          // cluster pages) so cluster pages render both link sections correctly.
          ...(_defInternalLinksConfig ? { internalLinks: _defInternalLinksConfig } : {}),
          ...(_defClusterAreaLinks.length ? { clusterAreaLinks: _defClusterAreaLinks } : {}),
        };

    const t0 = Date.now();
    let attempts = 0;
    let result: OneAreaResult | null = null;
    let lastError: Error | null = null;
    let smokeCheckPassed    = true;
    let smokeCheckFailures: string[] | undefined;

    for (let attempt = 1; attempt <= 2; attempt++) {
      attempts = attempt;
      try {
        // Enrich def.service from session if missing — older defs stored area/tier but not service
        const _defForRender: typeof def = (def.service)
          ? def
          : { ...def, service: (sessionCampaign as any)?.serviceName ?? def.service };
        result = await runOneArea(_defForRender, effectiveRenderConfig, dryRun, (sessionCampaign as any)?.serviceKey, sessionCampaignId);
        lastError = null;
        smokeCheckPassed   = result.smokeCheckPassed;
        smokeCheckFailures = result.smokeCheckFailures;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof SmokeCheckError) {
          smokeCheckPassed   = false;
          smokeCheckFailures = err.smokeCheckFailures;
          break;
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const durationMs = Date.now() - t0;
    const finishedAt = new Date().toISOString();
    const status     = result ? "success" : "failed";

    // Write cluster page-data.json (+ optional Image Library substitution)
    if (result && !dryRun) {
      // 5-lib. Image Library substitution — runs after runOneArea so library images
      // take priority over project-level slot images (step 5a inside runOneArea).
      const libConfig = (project as any).imageLibrary as ImageLibraryConfig | undefined;
      let libSelections: PageImageSelections | undefined;

      // Resolve effective service — older area defs may lack def.service, fall back to campaign
      const effectiveService = def.service ?? sessionCampaign?.serviceName ?? "";

      if (libConfig?.enabled && effectiveService && result.outputPath && fs.existsSync(result.outputPath)) {
        const pageSlug  = def.remotePath.replace(/\//g, "").trim() || def.area;
        const isLive    = !!(project.deploy?.enabled && project.domain);
        const domain    = (project.domain ?? "").replace(/\/+$/, "");
        const manualOverride = ((sessionCampaign as any)?.imageOverrides ?? {})[pageSlug] as
          { hero?: string; support?: string; trust?: string; conversion?: string } | undefined;

        try {
          const selections = resolveFinalImageSelections({
            campaignId:          sessionCampaignId || undefined,
            serviceKey:          (sessionCampaign as any)?.serviceKey ?? effectiveService,
            serviceName:         effectiveService,
            pageSlug,
            location:            def.area,
            domain,
            isLive,
            libConfig,
            manualOverride,
            campaignSlotsFilled: result.campaignSlotsFilled,
            outputDir:           OUTPUT_DIR,
          });

          const _libHero       = selections.hero;
          const _libSupport    = selections.support;
          const _libTrust      = selections.trust;
          const _libConversion = selections.conversion;

          if (_libHero || _libSupport || _libTrust || _libConversion) {
            let html = fs.readFileSync(result.outputPath, "utf8");
            html = applyImageSelectionsToHtml(html, {
              hero:       _libHero,
              support:    _libSupport,
              trust:      _libTrust,
              conversion: _libConversion,
            });
            // Sync selections to only reflect what was actually applied
            selections.hero       = _libHero       ?? null;
            selections.support    = _libSupport    ?? null;
            selections.trust      = _libTrust      ?? null;
            selections.conversion = _libConversion ?? null;

            fs.writeFileSync(result.outputPath, html, "utf8");
            libSelections = selections;

            // Re-upload the substituted HTML to FTP so the live page has library images
            if (project.deploy?.enabled) {
              const ftpUser     = project.deploy.username || process.env.DEPLOY_USERNAME;
              const ftpPassword = project.deploy.password || process.env.DEPLOY_PASSWORD;
              if (ftpUser && ftpPassword) {
                const { host, port } = project.deploy;
                const remoteRoot = (project.deploy.remoteRoot ?? "").replace(/\/+$/, "");
                const remoteDest = [remoteRoot, def.remotePath, "index.html"]
                  .join("/").replace(/\/+/g, "/");
                const reFtp = new ftp.Client(30000);
                try {
                  await reFtp.access({ host, port: port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });
                  const remoteDir = remoteDest.slice(0, remoteDest.lastIndexOf("/")) || "/";
                  await reFtp.ensureDir(remoteDir);
                  await reFtp.uploadFrom(result.outputPath, remoteDest);
                } catch { /* non-fatal */ } finally { reFtp.close(); }
              }
            }
          }
        } catch { /* non-fatal — fall back to existing images */ }
      }

      // Write page-data.json
      try {
        const areaSlug    = def.remotePath.replace(/\//g, "").trim() || "cluster";
        const clusterDir  = path.join(OUTPUT_DIR, clientSlug, areaSlug);
        const pageDataOut = path.join(clusterDir, "page-data.json");
        if (fs.existsSync(clusterDir)) {
          const imageField = libSelections
            ? {
                hero:       libSelections.hero       ? { libraryId: libSelections.hero.libraryId,       src: libSelections.hero.src,       alt: libSelections.hero.alt       } : null,
                support:    libSelections.support    ? { libraryId: libSelections.support.libraryId,    src: libSelections.support.src,    alt: libSelections.support.alt    } : null,
                trust:      libSelections.trust      ? { libraryId: libSelections.trust.libraryId,      src: libSelections.trust.src,      alt: libSelections.trust.alt      } : null,
                conversion: libSelections.conversion ? { libraryId: libSelections.conversion.libraryId, src: libSelections.conversion.src, alt: libSelections.conversion.alt } : null,
              }
            : undefined;

          fs.writeFileSync(pageDataOut, JSON.stringify({
            pageType:        "cluster",
            isHubPage:       def.tier === "hub",
            parentHubPageId: sessionHubId || undefined,
            campaignId:      sessionCampaignId || undefined,
            service:         def.service ?? sessionCampaign?.serviceName ?? "",
            location:        def.area,
            targetKeyword:   def.primaryKeyword,
            remotePath:      def.remotePath,
            liveUrl:         result.liveUrl,
            tier:            def.tier,
            status:          "generated",
            createdAt:       finishedAt,
            aiReadiness:     result.aiReadiness,
            ...(imageField ? { images: imageField } : {}),
          }, null, 2), "utf8");
        }
      } catch (_) { /* non-fatal */ }
    }

    const aiScore = result?.aiReadiness;
    const aiSummaryLine = aiScore
      ? ` | AI: ${aiScore.score}/100 (${aiScore.status})${aiScore.publishBlocked ? " — BLOCKED" : ""}`
      : "";
    const ftpNote = result?.ftpError ? ` ⚠ FTP: ${result.ftpError}` : "";
    appendJobEvent(jobId, {
      type:      "progress",
      area:      def.area,
      tier:      def.tier,
      step:      dryRun ? "dry-run: config verified" : result ? `generated${result.ftpError ? " (FTP failed)" : " and deployed"}${aiSummaryLine}${ftpNote}` : `failed: ${lastError?.message ?? "unknown error"}`,
      status:    result?.ftpError ? "warning" as typeof status : status,
      durationMs,
      message:   lastError?.message ?? result?.ftpError,
    });

    entries.push({
      area:               def.area,
      city:               def.city,
      tier:               def.tier,
      status,
      attempts,
      configPath:         def.configPath,
      outputPath:         result?.outputPath ?? "",
      liveUrl:            result?.liveUrl    ?? "",
      durationMs,
      errorMessage:       lastError?.message,
      smokeCheckPassed,
      smokeCheckFailures,
      startedAt:          new Date(t0).toISOString(),
      finishedAt,
    });
  };

  for (let i = 0; i < toProcess.length; i += concurrencyN) {
    // Check for cancellation before each batch
    const currentState = readJobState(jobId);
    if (currentState?.status === "cancelled") {
      appendJobEvent(jobId, { type: "complete", status: "cancelled" } as RolloutProgressEvent);
      return;
    }
    const batch = toProcess.slice(i, i + concurrencyN);
    await Promise.all(batch.map(processOneDef));
  }

  // Build rollout log
  const totals: RolloutTotals = {
    attempted: toProcess.length,
    succeeded: entries.filter((e) => e.status === "success").length,
    failed:    entries.filter((e) => e.status === "failed").length,
    deferred:  deferred.length,
  };
  const log: RolloutLog = {
    runId,
    service:    defs[0]?.service ?? "",
    city:       defs[0]?.city    ?? "",
    project:    clientSlug,
    startedAt,
    finishedAt: new Date().toISOString(),
    totals,
    entries,
    deferred:   deferred.map((d) => d.area),
  };

  if (!fs.existsSync(clientDir)) fs.mkdirSync(clientDir, { recursive: true });
  writeRolloutLog(log, clientSlug);

  if (deferred.length > 0 && deferTertiary) {
    fs.writeFileSync(
      path.join(clientDir, "deferred-areas.json"),
      JSON.stringify(deferred.map((d) => ({ area: d.area, tier: d.tier, reason: "deferred" })), null, 2)
    );
  }

  // Rebuild sitemap after successful generation
  const successCount = entries.filter((e) => e.status === "success").length;
  if (!dryRun && successCount > 0) {
    appendJobEvent(jobId, { type: "progress", area: "sitemap", tier: "hub", step: "rebuilding sitemap…", status: "success", durationMs: 0 });
    try {
      const sitemapResult = await rebuildSitemapForClient(clientSlug);
      if (sitemapResult.success) {
        const uploaded = sitemapResult.ftpUploaded.length > 0 ? ` (uploaded: ${sitemapResult.ftpUploaded.join(", ")})` : "";
        appendJobEvent(jobId, { type: "progress", area: "sitemap", tier: "hub", step: `sitemap rebuilt — ${sitemapResult.totalPages} pages${uploaded}`, status: sitemapResult.ftpError ? "failed" : "success", durationMs: 0, message: sitemapResult.ftpError });
      } else {
        appendJobEvent(jobId, { type: "progress", area: "sitemap", tier: "hub", step: `sitemap rebuild failed: ${sitemapResult.error}`, status: "failed", durationMs: 0 });
      }
    } catch (sitemapErr) {
      appendJobEvent(jobId, { type: "progress", area: "sitemap", tier: "hub", step: `sitemap rebuild error: ${String(sitemapErr)}`, status: "failed", durationMs: 0 });
    }
  }

  // Count total pages on disk for this campaign (includes deferred areas from prior runs)
  const onDiskCount = sortedWithRelated.filter((d) => {
    const slug = (d.remotePath ?? "").replace(/\//g, "");
    return slug && fs.existsSync(path.join(clientDir, slug, "index.html"));
  }).length;
  totals.totalOnDisk = onDiskCount;

  // Auto-update campaign registry to deployed/stage8 when rollout succeeds
  if (!dryRun && sessionCampaignId && totals.succeeded > 0) {
    try {
      const campaignsFile = path.join(PROJECTS_DIR, "..", "campaigns", `${clientSlug}.json`);
      if (fs.existsSync(campaignsFile)) {
        const campaigns = JSON.parse(fs.readFileSync(campaignsFile, "utf8")) as Array<Record<string, unknown>>;
        const idx = campaigns.findIndex((c) => c.id === sessionCampaignId);
        if (idx !== -1) {
          campaigns[idx] = {
            ...campaigns[idx],
            status:         "deployed",
            currentStage:   8,
            pagesGenerated: onDiskCount,
            pagesDeployed:  onDiskCount,
            updatedAt:      new Date().toISOString(),
          };
          fs.writeFileSync(campaignsFile, JSON.stringify(campaigns, null, 2), "utf8");
        }
      }
    } catch { /* non-fatal — registry update failure must not abort rollout */ }
  }

  // Rebuild selected-area-defs.json from all sessions so keyword tracking
  // always has a fresh, complete list of deployed pages to check.
  if (!dryRun && totals.succeeded > 0) {
    try {
      const { rebuildAreaDefsFromSessions } = await import("../../../../../src/tracking/keywordTrackingEngine");
      rebuildAreaDefsFromSessions(clientSlug, OUTPUT_DIR);
    } catch { /* non-fatal — tracking rebuild must not abort rollout */ }
  }

  // Mark complete
  appendJobEvent(jobId, { type: "done", log });
  const finalState = readJobState(jobId);
  if (finalState) {
    finalState.status     = "done";
    finalState.log        = log;
    finalState.finishedAt = new Date().toISOString();
    writeJobState(jobId, finalState);
  }
}

function loadProject(slug: string): ProjectConfig | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ProjectConfig;
  } catch {
    return null;
  }
}

function buildMapEmbedUrl(project: ProjectConfig): string {
  const p = project as any;
  const zoom = p.mapZoom || 17;
  // 1. Custom embed URL supplied directly — highest priority
  if (p.mapEmbedUrl) return p.mapEmbedUrl;
  // 2. Business name + address query — shows a labeled pin with the business name
  //    iwloc=B opens the info window on the business so the name/address appear on the pin
  if (project.businessName && project.businessAddress) {
    const query = encodeURIComponent(`${project.businessName}, ${project.businessAddress}`);
    return `https://maps.google.com/maps?q=${query}&z=${zoom}&t=m&ie=UTF8&iwloc=B&output=embed`;
  }
  // 3. Address-only fallback
  if (project.businessAddress) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(project.businessAddress)}&z=${zoom}&t=m&ie=UTF8&iwloc=B&output=embed`;
  }
  // 4. Last resort: OpenStreetMap
  return `https://www.openstreetmap.org/export/embed.html?bbox=-1.3693%2C53.4115%2C-1.3393%2C53.4415&layer=mapnik`;
}

function toRenderConfig(project: ProjectConfig): RenderProjectConfig {
  return {
    clientSlug:           project.clientSlug,
    businessName:         project.businessName,
    domain:               project.domain,
    phone:                project.phone,
    email:                project.email,
    primaryCtaText:       project.primaryCtaText,
    primaryCtaUrl:        project.primaryCtaUrl,
    businessAddress:      project.businessAddress,
    mapEmbedUrl:          buildMapEmbedUrl(project),
    moneyPageUrl:         (project as any).moneyPageUrl,
    moneyPageKeyword:     (project as any).moneyPageKeyword,
    footerCompanyName:    project.footerCompanyName,
    footerCompanyNumber:  project.footerCompanyNumber ?? (project as any).companyNumber,
    footerStrapline:      project.footerStrapline,
    footerLinks:          project.footerLinks,
    footerServiceLinks:   project.footerServiceLinks,
    logoUrl:              project.logoUrl,
    privacyUrl:           project.privacyUrl,
    termsUrl:             project.termsUrl,
    navItems:               project.navItems,
    deploy:                 project.deploy,
    narrativeEngine:        project.narrativeEngine,
    aiCitationOptimisation: project.aiCitationOptimisation,
    whiteLabelPoweredBy:  project.whiteLabelPoweredBy,
    strapline:            project.strapline,
    description:          project.description,
    shortDescription:     project.shortDescription,
    uspStatements:        project.uspStatements,
    trustStatements:      project.trustStatements,
    toneNotes:            project.toneNotes,
    brandStyleVariant:    project.brandStyleVariant,
    industryType:             project.industryType,
    buyerType:                project.buyerType,
    serviceType:              project.serviceType,
    providerType:             project.providerType,
    serviceDeliverables:      project.serviceDeliverables,
    campaignCustomerProblems: project.campaignCustomerProblems,
    conversionAction:         project.conversionAction,
  };
}

/**
 * Run the full generation + deploy pipeline for one area.
 * Returns a partial RolloutEntry on success or throws on unrecoverable failure.
 */
interface OneAreaResult {
  outputPath:          string;
  liveUrl:             string;
  smokeCheckPassed:    boolean;
  smokeCheckFailures?: string[];
  aiReadiness?:        AiReadinessResult;
  ftpError?:           string;
  /** Slots filled from the campaign-specific assets dir (hero/support/conversion).
   *  processOneDef uses this to protect campaign images from library overwrite. */
  campaignSlotsFilled: string[];
}

async function runOneArea(
  def:                SelectedAreaPageDef,
  project:            RenderProjectConfig,
  dryRun:             boolean,
  campaignServiceKey?: string,
  sessionCampaignId?: string,
): Promise<OneAreaResult> {
  // 1. Write cluster config
  // Derive configPath if not set (e.g., defs loaded from session files lack it)
  if (!def.configPath) {
    const svcSlug  = (def.service ?? "web-design").toLowerCase().replace(/\s+/g, "-");
    const areaSlug = (def.area ?? "area").toLowerCase().replace(/\s+/g, "-");
    def = {
      ...def,
      configPath: `config/clusters/${project.clientSlug}-${svcSlug}-${areaSlug}.json`,
    };
  }
  const clusterConfig = buildClusterConfig(def);
  writeClusterConfig(def, clusterConfig);

  const areaSlug = (def.remotePath ?? "").replace(/\//g, "").trim() || (def.area ?? "").toLowerCase().replace(/\s+/g, "-") || "cluster";
  const outDir   = path.join(OUTPUT_DIR, project.clientSlug, areaSlug);
  const outFile  = path.join(outDir, "index.html");
  const liveUrl  = project.deploy?.enabled
    ? `${project.domain.replace(/\/+$/, "")}${def.remotePath}`
    : `/preview/${project.clientSlug}/${areaSlug}/`;

  if (dryRun) {
    return { outputPath: outFile, liveUrl, smokeCheckPassed: true, campaignSlotsFilled: [] };
  }

  // 2. Build AI inputs
  const industryProfile = loadIndustryProfile(project.industryType);
  if (project.industryType) {
    const profileLabel = industryProfile
      ? `${industryProfile["displayName"] ?? project.industryType}`
      : `${project.industryType} (profile not found)`;
    const resolvedBuyerType =
      project.buyerType ??
      (industryProfile?.["buyerTypeDefault"] as string | undefined) ??
      "not set";
    logger.info(
      { industryType: project.industryType, buyerType: resolvedBuyerType, area: def.area },
      `Industry profile: ${profileLabel} | buyerType: ${resolvedBuyerType}${!project.buyerType ? " (from profile default)" : ""}`
    );
  }

  // Resolve effective buyerType: project config takes priority; if not set,
  // fall back to the industry profile's buyerTypeDefault (e.g. landscaping → household).
  // This ensures non-digital industries never silently default to business framing.
  const effectiveBuyerType: ClusterPageInputs["buyerType"] =
    project.buyerType ??
    (industryProfile?.["buyerTypeDefault"] as ClusterPageInputs["buyerType"] | undefined);

  const inputs: ClusterPageInputs = {
    brandName:          project.businessName,
    legalName:          project.businessName ?? project.footerCompanyName,
    serviceName:        def.service,
    location:           def.area,
    primaryKeyword:     def.primaryKeyword,
    supportingKeywords: def.supportingKeywords,
    ctaText:            project.primaryCtaText,
    ctaUrl:             project.primaryCtaUrl,
    hubUrl:             def.hubUrl,
    hubAnchor:          def.hubAnchor,
    relatedPages:       def.relatedPages,
    businessAddress:    project.businessAddress,
    areaSignals:        def.signals,
    shortDescription:   project.shortDescription,
    uspStatements:      project.uspStatements,
    trustStatements:    project.trustStatements,
    toneNotes:          project.toneNotes,
    brandStyleVariant:  project.brandStyleVariant,
    industryProfile,
    industryType:             project.industryType,
    buyerType:                effectiveBuyerType,
    serviceType:              project.serviceType,
    providerType:             project.providerType,
    serviceDeliverables:      project.serviceDeliverables,
    campaignCustomerProblems: project.campaignCustomerProblems,
    conversionAction:         project.conversionAction,
  };

  // 3. Generate AI content
  const rawAi = await generateClusterContent(inputs);

  // 4. Refine readability (non-fatal)
  let ai = applyWebDesignNarrativePackage({
    content: rawAi,
    area: def.area,
    city: def.city,
    serviceName: def.service,
    narrativeEngine: project.narrativeEngine,
  });
  ai = applyLocalSeoNarrativePackage({
    content: ai,
    area: def.area,
    city: def.city,
    serviceName: def.service,
    narrativeEngine: project.narrativeEngine,
  });
  try {
    // TEMP TEST: refinement disabled for hub route
    ai = ai;
  } catch {
    // continue with unrefined content
  }

  // 4a. Post-process relatedResources: fix any placeholder hrefs the AI may have
  //     left in place (e.g. "FIRST_EXACT_URL_FROM_RELATED_PAGES").
  //     Build a list of real sibling URLs from the relatedPages input string.
  if (ai.relatedResources?.length) {
    // Parse "label (url)" entries from the relatedPages string
    const parsedSiblings: string[] = [];
    if (inputs.relatedPages) {
      const re = /\(([^)]+)\)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(inputs.relatedPages)) !== null) {
        if (m[1] && m[1].startsWith("http")) parsedSiblings.push(m[1]);
      }
    }

    const isPlaceholder = (href: string | undefined | null): boolean =>
      !href ||
      href === "undefined" ||
      href === "null" ||
      href === "," ||
      href.startsWith(",") ||
      href.includes("exact-url-from-related-pages") ||
      href.includes("FIRST_EXACT_URL") ||
      href.includes("SECOND_EXACT_URL") ||
      href.includes("REPLACE_WITH") ||
      href.includes("FILL_FROM") ||
      (!href.startsWith("http") && !href.startsWith("/"));

    let sibIdx = 0;
    ai = {
      ...ai,
      relatedResources: ai.relatedResources.map((card) => {
        if (!isPlaceholder(card.href)) return card;
        // First try a parsed sibling URL; fall back to hub URL
        const replacement = parsedSiblings[sibIdx] ?? inputs.hubUrl;
        if (parsedSiblings[sibIdx]) sibIdx++;
        return { ...card, href: replacement };
      }),
    };
  }

  // 4b. For hub pages, replace the AI's limited 3-card relatedResources with
  //     a full list of every cluster page — parsed from the (now full-URL)
  //     relatedPages string built in sortedWithRelated.
  if (def.tier === "hub" && inputs.relatedPages) {
    const re = /([^,(]+?)\s*\((https?:\/\/[^)]+)\)/g;
    const allClusterCards: { href: string; text: string; description: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(inputs.relatedPages)) !== null) {
      const text = m[1].trim();
      const href = m[2].trim();
      if (href && text) {
        // Capitalise the label and generate a short description from it
        const labelCap = text.replace(/\w\S*/g, (w) => {
          const up = new Set(["seo","ppc","uk","us"]);
          return up.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1);
        });
        const description = `Local ${labelCap} service page covering costs, process, and results for businesses in the area.`;
        allClusterCards.push({ href, text: labelCap, description });
      }
    }
    if (allClusterCards.length > 0) {
      ai = { ...ai, relatedResources: allClusterCards };
    }
  }

  // 5. Render HTML and write to disk
  const clusterForRender = {
    ...clusterConfig,
    ...(sessionCampaignId
      ? {
          campaignId: sessionCampaignId,
          serviceKey: campaignServiceKey ?? clusterConfig.imageGroup?.replace(/^assets\//, "") ?? "",
        }
      : {}),
  };
  let html = renderClusterHtml({ project, cluster: clusterForRender, ai });

  // 5-resource-card-guard. For CLUSTER pages: ensure every <a class="resource-card">
  // points to a URL that belongs to the current campaign's cluster (hub or sibling).
  // The AI sometimes picks areas from other campaigns — scrub them here.
  if (def.tier !== "hub" && inputs.relatedPages) {
    const validClusterUrls = new Set<string>();
    // Hub URL (absolute live domain URL)
    if (inputs.hubUrl) validClusterUrls.add(inputs.hubUrl.replace(/\/$/, "") + "/");
    // All sibling cluster URLs from relatedPages string
    const clusterRe = /\(([^)]+)\)/g;
    let cm: RegExpExecArray | null;
    while ((cm = clusterRe.exec(inputs.relatedPages)) !== null) {
      if (cm[1]?.startsWith("http")) validClusterUrls.add(cm[1].replace(/\/$/, "") + "/");
    }
    // Build rotating pool of valid sibling URLs (excluding hub)
    const siblingPool = [...validClusterUrls].filter((u) => u !== inputs.hubUrl?.replace(/\/$/, "") + "/");
    let sibIdx2 = 0;
    html = html.replace(
      /<a class="resource-card" href="([^"]*)">/g,
      (_match, href) => {
        const norm = href.replace(/\/$/, "") + "/";
        if (validClusterUrls.has(norm)) return _match; // already valid
        // Replace with next sibling URL, cycling through pool, fall back to hub
        const replacement = siblingPool[sibIdx2 % Math.max(siblingPool.length, 1)] ?? inputs.hubUrl ?? href;
        sibIdx2++;
        return `<a class="resource-card" href="${replacement}">`;
      }
    );
  }

  // 5-safety. Scrub any broken hrefs that the AI may have injected into body HTML
  //   — href=","  (AI emitted comma-list where a single URL was expected)
  //   — href="undefined" (JS undefined coerced to string)
  // Replace with hub URL or sibling URLs parsed from inputs.relatedPages.
  html = String(html ?? "");
  if (html.includes('href=","') || html.includes("href=','") || html.includes('href="undefined"') || html.includes("href='undefined'")) {
    const safeHubUrl = inputs.hubUrl ?? project.moneyPageUrl ?? "/";
    const siblingPool: string[] = [];
    if (inputs.relatedPages) {
      const rg = /\(([^)]+)\)/g;
      let rm: RegExpExecArray | null;
      while ((rm = rg.exec(inputs.relatedPages)) !== null) {
        if (rm[1] && rm[1].startsWith("http")) siblingPool.push(rm[1]);
      }
    }
    let sibPool = [...siblingPool];
    // Fix href="," (inline body anchors) → hub URL
    html = html.split('href=","').join(`href="${safeHubUrl}"`);
    html = html.split("href=','").join(`href="${safeHubUrl}"`);
    // Fix href="undefined" → rotate through sibling pool, fall back to hub
    while (html.includes('href="undefined"') || html.includes("href='undefined'")) {
      const replacement = sibPool.shift() ?? safeHubUrl;
      html = html.replace('href="undefined"', `href="${replacement}"`);
      html = html.replace("href='undefined'", `href="${replacement}"`);
    }
  }

  // 5a. Substitute campaign images into the rendered HTML.
  //
  // SOURCE OF TRUTH: image-meta.json at output/{slug}/assets/image-meta.json
  // This is the SAME file the wizard's /api/images/serve endpoint reads, so
  // whatever the user sees as "saved and ready" in the wizard is exactly what
  // gets used here — no fuzzy guessing, no stale subdirectory overrides.
  //
  // Resolution per slot:
  //   1. Read meta[slot].serviceKey → look in assets/{serviceKey}/{slot}.ext
  //   2. No serviceKey in meta      → look in assets/{slot}.ext  (root)
  //   3. Meta lookup found nothing  → fuzzy-scan service subdirs (legacy fallback)
  //   4. Still nothing              → skip this slot
  //
  // Per-slot result carries { ext, svcDir } so the URL builder can construct
  // the exact live path for each slot independently.
  const projectAssetsDir = path.join(OUTPUT_DIR, project.clientSlug, "assets");
  const IMAGE_EXTS       = ["jpg", "webp", "png"] as const;

  // Read image-meta.json — authoritative slot → location mapping
  const _metaFilePath = path.join(projectAssetsDir, "image-meta.json");
  const _imgMeta: Record<string, Record<string, unknown>> = fs.existsSync(_metaFilePath)
    ? JSON.parse(fs.readFileSync(_metaFilePath, "utf8")) as Record<string, Record<string, unknown>>
    : {};

  // Helper: normalise a key for fuzzy comparison
  const _kNorm = (s: string) => (s ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");

  // Service identifiers for this campaign (used only in legacy fuzzy fallback)
  // Normalize campaignServiceKey so alias variants like "small-business-web-design"
  // resolve to the canonical form "web-design" written by the assign-to-slot endpoint.
  const _normCampaignSvcKey = campaignServiceKey ? normaliseServiceKey(campaignServiceKey) : undefined;
  const _svcIds = [_normCampaignSvcKey, def.service].map(_kNorm).filter(Boolean);
  const _svcKeyMatches = (key: string) => {
    if (!key) return _svcIds.length === 0;                    // empty key = root assets, always OK
    const kn = _kNorm(key);
    return _svcIds.length === 0 ||
      _svcIds.some((id) => kn === id || id.startsWith(kn) || kn.startsWith(id));
  };

  // Build legacy fuzzy-scan result once (only used if meta lookup fails)
  const _allSvcDirs = fs.existsSync(projectAssetsDir)
    ? fs.readdirSync(projectAssetsDir).filter((d) => {
        if (d.includes(".")) return false;
        try { return fs.statSync(path.join(projectAssetsDir, d)).isDirectory(); } catch { return false; }
      })
    : [];
  let _legacyFuzzyDir: string | null = null;
  let _legacyBestScore = 0;
  for (const dirName of _allSvcDirs) {
    const dn = _kNorm(dirName);
    let score = 0;
    for (const id of _svcIds) {
      if (!id || !dn) continue;
      if (dn === id)                                    score = Math.max(score, 100);
      else if (id.startsWith(dn) || dn.startsWith(id)) score = Math.max(score, 80);
      else if (id.includes(dn)   || dn.includes(id))   score = Math.max(score, 50);
    }
    if (score > _legacyBestScore) { _legacyBestScore = score; _legacyFuzzyDir = dirName; }
  }

  // Per-slot result: { ext, svcDir (null = root), fromMeta: true only when the
  // meta service-key matched the current campaign — used to gate image library.
  type SlotResult = { ext: string; svcDir: string | null; fromMeta: boolean; fromCampaignPane?: boolean } | null;

  function findCampaignPaneSlot(slot: string): SlotResult {
    if (!sessionCampaignId) return null;
    const paneFile = findCampaignPaneSlotFile(
      sessionCampaignId,
      _normCampaignSvcKey ?? def.service ?? "",
      slot as "hero" | "support" | "trust" | "conversion",
      OUTPUT_DIR,
    );
    if (!paneFile) return null;
    return { ext: paneFile.ext, svcDir: paneFile.serviceKey, fromMeta: true, fromCampaignPane: true };
  }

  function findSlotFile(slot: string): SlotResult {
    const paneSlot = findCampaignPaneSlot(slot);
    if (paneSlot) return paneSlot;

    const m = _imgMeta[slot];
    if (m !== undefined) {
      // meta entry exists — use serviceKey to locate file
      const metaKey = (m.serviceKey as string | undefined) ?? "";
      if (_svcKeyMatches(metaKey)) {
        const dir = metaKey ? path.join(projectAssetsDir, metaKey) : projectAssetsDir;
        for (const ext of IMAGE_EXTS) {
          if (fs.existsSync(path.join(dir, `${slot}.${ext}`))) {
            return { ext, svcDir: metaKey || null, fromMeta: true };
          }
        }
      }
    }
    // Legacy fallback: fuzzy-scan service subdirs (assets created before meta tracked serviceKey)
    if (_legacyFuzzyDir && _legacyBestScore >= 50) {
      for (const ext of IMAGE_EXTS) {
        if (fs.existsSync(path.join(projectAssetsDir, _legacyFuzzyDir, `${slot}.${ext}`))) {
          const _metaEntry  = _imgMeta[slot] ?? _imgMeta[`${_legacyFuzzyDir}:${slot}`];
          const _metaSvcKey = (_metaEntry as Record<string, unknown>)?.serviceKey as string | undefined;
          const _fromMeta   = _metaEntry !== undefined &&
            (!_metaSvcKey || _kNorm(_metaSvcKey) === _kNorm(_legacyFuzzyDir));
          return { ext, svcDir: _legacyFuzzyDir, fromMeta: _fromMeta };
        }
      }
    }
    // Root project assets (project-wide fallback, no service subdir)
    for (const ext of IMAGE_EXTS) {
      if (fs.existsSync(path.join(projectAssetsDir, `${slot}.${ext}`))) {
        return { ext, svcDir: null, fromMeta: false };
      }
    }
    return null;
  }

  const slotExts = {
    hero:       findSlotFile("hero"),
    support:    findSlotFile("support"),
    trust:      findSlotFile("trust"),
    conversion: findSlotFile("conversion"),
  };
  // Only slots resolved via a MATCHING meta service-key are "campaign filled".
  // Root-level fallback files (fromMeta: false) must NOT block the image library
  // from substituting correct service-specific images on non-matching campaigns.
  const campaignSlotsFilled: string[] = (["hero", "support", "trust", "conversion"] as const)
    .filter((s) => slotExts[s]?.fromMeta === true);

  const hasProjectImages = Object.values(slotExts).some(Boolean);
  if (hasProjectImages) {
    const domain = (project.domain ?? "").replace(/\/+$/, "");
    const useLivePath = !!(project.deploy?.enabled && domain);
    const projectImgBase = useLivePath
      ? `${domain}/assets/${project.clientSlug}`
      : `/api/images/serve/${project.clientSlug}`;

    // Build per-slot image URL using the exact directory resolved by findSlotFile.
    // svcDir = null  → image is in the root assets dir
    // svcDir = "foo" → image is in assets/foo/
    const _slotUrl = (slot: string, res: SlotResult): string | null => {
      if (!res) return null;
      if (sessionCampaignId && res.fromCampaignPane) {
        return buildCampaignPaneImageUrl(
          sessionCampaignId,
          res.svcDir ?? _normCampaignSvcKey ?? def.service ?? "",
          slot as "hero" | "support" | "trust" | "conversion",
          res.ext,
          domain,
          !!domain,
        );
      }
      if (useLivePath) {
        const base = res.svcDir
          ? `${domain}/assets/${project.clientSlug}/${res.svcDir}`
          : projectImgBase;
        return `${base}/${slot}.${res.ext}`;
      }
      // Preview mode: always route through the serve endpoint (it reads meta & serves the file)
      return `${projectImgBase}/${slot}`;
    };

    /** Replace src on the <img> inside a named wrapper div.
     *  Matches by wrapper class rather than src content so the replacement
     *  is immune to whatever fallback path renderClusterPage produced. */
    function _replaceSlotSrcByWrapper(h: string, wrapperClass: string, newSrc: string): string {
      return h.replace(
        new RegExp(`(<div\\b[^>]*class="[^"]*\\b${wrapperClass}\\b[^"]*"[^>]*>[\\s\\S]*?<img\\b[^>]*)src="[^"]*"`, "i"),
        `$1src="${newSrc}"`,
      );
    }
    if (slotExts.hero) {
      const heroSrc = _slotUrl("hero", slotExts.hero)!;
      html = _replaceSlotSrcByWrapper(html, "hero-media", heroSrc);
      // Also handle API serve-endpoint URLs (preview mode)
      html = html.replace(/<img([^>]*)src="\/api\/images\/serve\/[^/]+\/hero"/g, `<img$1src="${heroSrc}"`);
    }
    if (slotExts.support) {
      const supportSrc = _slotUrl("support", slotExts.support)!;
      html = _replaceSlotSrcByWrapper(html, "support-block-media", supportSrc);
      html = html.replace(/<img([^>]*)src="\/api\/images\/serve\/[^/]+\/support"/g, `<img$1src="${supportSrc}"`);
    }
    if (slotExts.trust) {
      const trustSrc = _slotUrl("trust", slotExts.trust)!;
      html = _replaceSlotSrcByWrapper(html, "trust-block-media", trustSrc);
      html = html.replace(/<img([^>]*)src="\/api\/images\/serve\/[^/]+\/trust"/g, `<img$1src="${trustSrc}"`);
    }
    if (slotExts.conversion) {
      const convSrc = _slotUrl("conversion", slotExts.conversion)!;
      html = _replaceSlotSrcByWrapper(html, "conversion-feature-image", convSrc);
      html = html.replace(/<img([^>]*)src="\/api\/images\/serve\/[^/]+\/conversion"/g, `<img$1src="${convSrc}"`);
    }

    // 5a-post. Resolve any unsubstituted {{Service}} / {{Location}} tokens left in
    // alt attributes (can occur when altText was stored as a template string before
    // assignment-time substitution was in place).
    const _svcDisplay  = (def.service ?? "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const _locDisplay  = (def.area ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
    html = html.replace(/\{\{[Ss]ervice\}\}/g, _svcDisplay);
    html = html.replace(/\{\{[Ll]ocation\}\}/g, _locDisplay);
  }

  // 5b. AI Citation Optimisation (optional post-render step)
  // Disabled by default; enable via project config: aiCitationOptimisation: { enabled: true }
  if (project.aiCitationOptimisation?.enabled === true) {
    console.log(`  [aiCitation] ${def.area}: AI Citation Optimisation: running`);
    const citationContext: AiCitationContext = {
      clientSlug:   project.clientSlug,
      campaignId:   areaSlug,
      service:      def.service ?? "",
      location:     def.area ?? "",
      businessName: project.businessName,
      hubSlug:      def.tier === "hub"
        ? areaSlug
        : (def.hubUrl ?? "").replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, ""),
      moneyPageUrl: project.moneyPageUrl ?? "",
      canonicalUrl: liveUrl,
      pageType:     def.tier === "hub" ? "hub" : "cluster",
    };
    html = await optimiseForAiCitation(html, citationContext);
  } else {
    console.log(`  [aiCitation] ${def.area}: AI Citation Optimisation: skipped`);
  }

  // GBP drift guard — block household/property copy before writing/publishing
  const _gbpServiceCheck = [
    def.service,
    def.serviceKey,
    project.industryType,
    project.serviceKey,
    project.serviceName,
    clusterConfig.service,
    clusterConfig.industryType
  ].filter(Boolean).join(" ").toLowerCase();

  if (_gbpServiceCheck.includes("google-business-profile") || _gbpServiceCheck.includes("google business profile")) {
    const badTerms = [
      "homeowners",
      "landlords",
      "tenants",
      "rental",
      "property owners",
      "property details",
      "home repairs",
      "lettings",
      "your home",
      "domestic household"
    ];
    const lowerHtml = html.toLowerCase();
    const found = badTerms.filter(t => lowerHtml.includes(t));
    if (found.length > 0) {
      throw new Error("Google Business Profile content drift detected: household/property language found: " + found.join(", "));
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");

  // 6. Post-render smoke check — must pass before FTP upload is attempted
  const smokeReport = runPostRenderCheck(html, outFile, {
    companyName: project.businessName,
    email:       project.email,
  });
  if (!smokeReport.passed) {
    const failures = smokeReport.checks
      .filter((c) => !c.passed)
      .map((c) => `${c.id}: ${c.detail ?? "failed"}`);
    throw new SmokeCheckError(
      `Post-render smoke check failed (${failures.length} issue(s)): ${failures.join("; ")}`,
      failures
    );
  }

  // 7a. Normalise HTML before deployment:
  //   (i)  Strip any /preview/{clientSlug}/ links — these leak in when pages
  //        were generated in non-deploy mode and later re-deployed.
  //   (ii) Replace /api/images/serve/{clientSlug}/{slot} paths with the correct
  //        absolute live-domain URLs — these leak in when pages were generated
  //        before FTP deploy was enabled. Runs only when deploy is enabled so
  //        the live asset URL is known.
  try {
    let normalised = fs.readFileSync(outFile, "utf8");
    let changed = false;

    // (i) strip /preview/{slug}/ prefix from all hrefs
    const previewPrefix = `/preview/${project.clientSlug}/`;
    if (normalised.includes(previewPrefix)) {
      normalised = normalised.split(previewPrefix).join("/");
      changed = true;
    }

    // (ii) replace API image-serve paths with absolute live-domain URLs
    if (project.deploy?.enabled && project.domain) {
      const domain  = project.domain.replace(/\/+$/, "");
      const apiBase = `/api/images/serve/${project.clientSlug}`;
      const liveBase = `${domain}/assets/${project.clientSlug}`;
      const projectAssetsDir = path.join(OUTPUT_DIR, project.clientSlug, "assets");
      for (const slot of ["hero", "support", "trust", "conversion"] as const) {
        const apiPath = `${apiBase}/${slot}`;
        const svcKey = project.serviceKey ?? "";

        const candidateFiles = [
          path.join(projectAssetsDir, `${slot}.webp`),
          path.join(projectAssetsDir, `${slot}.jpg`),
          path.join(projectAssetsDir, `${slot}.jpeg`),
          path.join(projectAssetsDir, `${slot}.png`),

          ...(svcKey ? [
            path.join(projectAssetsDir, svcKey, `${slot}.webp`),
            path.join(projectAssetsDir, svcKey, `${slot}.jpg`),
            path.join(projectAssetsDir, svcKey, `${slot}.jpeg`),
            path.join(projectAssetsDir, svcKey, `${slot}.png`)
          ] : [])
        ];

        const found = candidateFiles.find((f) => fs.existsSync(f));

        if (normalised.includes(apiPath) && found) {
          const ext = path.extname(found);
          const isServiceSpecific = svcKey && found.includes(path.join(projectAssetsDir, svcKey));
          const svcPrefix = isServiceSpecific ? `/${svcKey}` : "";
          const livePath = `${liveBase}${svcPrefix}/${slot}${ext}`;

          normalised = normalised
            .split(`"${apiPath}"`).join(`"${livePath}"`)
            .split(`'${apiPath}'`).join(`'${livePath}'`);

          changed = true;
        }
      }
    }

    if (changed) fs.writeFileSync(outFile, normalised, "utf8");
  } catch (_) { /* non-fatal */ }

  // 7b. AI Readiness Score — always computed, blocks FTP if publishBlocked
  const finalHtml  = fs.readFileSync(outFile, "utf8");
  const aiReadiness = scoreAiReadiness(finalHtml);
  console.log(`  [aiReadiness] ${def.area}: ${formatAiReadinessSummary(aiReadiness)}`);

  if (false && aiReadiness.publishBlocked && project.deploy?.enabled) {
    const reason = aiReadiness.blockingIssues.length > 0
      ? `blocking issue(s): ${aiReadiness.blockingIssues.slice(0, 2).join("; ")}`
      : `score ${aiReadiness.score}/100 (${aiReadiness.status})`;
    throw new Error(`AI readiness check blocked deployment for "${def.area}" — ${reason}`);
  }

  // 7c. FTP upload (skipped when deploy is disabled or AI readiness blocks publish)
  if (project.deploy?.enabled) {
    const user     = project.deploy.username || process.env.DEPLOY_USERNAME;
    const password = project.deploy.password || process.env.DEPLOY_PASSWORD;
    if (!user || !password) {
      throw new Error("Missing FTP credentials: add username/password in the project config (Stage 1) or set DEPLOY_USERNAME and DEPLOY_PASSWORD environment variables.");
    }

    const { host, port, remoteRoot } = project.deploy;
    const remoteDest = [remoteRoot, def.remotePath, "index.html"]
      .join("/")
      .replace(/\/+/g, "/");

    const client = new ftp.Client(30000);
    let ftpError: string | undefined;
    try {
      await client.access({ host, port: port ?? 21, user, password, secure: true, secureOptions: { rejectUnauthorized: false } });
      // Ensure the remote directory exists before uploading (FTP 553 if missing)
      const remoteDir = remoteDest.slice(0, remoteDest.lastIndexOf("/")) || "/";
      await client.ensureDir(remoteDir);
      try {
        await client.uploadFrom(outFile, remoteDest);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Is a directory")) {
          const fallbackDest = remoteDest.replace(/\/?$/, "/index.html");
          console.warn(`  [ftp] remoteDest was a directory, retrying upload to ${fallbackDest}`);
          await client.uploadFrom(outFile, fallbackDest);
        } else {
          throw e;
        }
      }
    } catch (err) {
      ftpError = String(err instanceof Error ? err.message : err);
      console.log(`  [ftp] Upload failed for "${def.area}" (non-fatal): ${ftpError}`);
    } finally {
      client.close();
    }
    if (ftpError) {
      return { outputPath: outFile, liveUrl, smokeCheckPassed: true, aiReadiness, ftpError, campaignSlotsFilled };
    }
  }

  // ── Post-process: rewrite dead domain / root-relative links → preview paths ─
  // Hub links are excluded (via hubSlug) so they stay as canonical root-relative
  // paths (e.g. /local-seo-rotherham/) — never /preview/… paths.
  if (!project.deploy?.enabled) {
    try {
      const html = fs.readFileSync(outFile, "utf8");
      // Derive hub slug from the def's hubUrl: strip scheme+host and slashes.
      let hubSlug: string | undefined;
      if (def.hubUrl) {
        const hubPath = def.hubUrl.replace(/^https?:\/\/[^/]+/, "");
        hubSlug = hubPath.replace(/\//g, "").trim() || undefined;
      }
      const patched = rewritePreviewLinks(html, project.clientSlug, hubSlug);
      if (patched !== html) fs.writeFileSync(outFile, patched, "utf8");
    } catch (_) { /* non-fatal */ }
  }

  return { outputPath: outFile, liveUrl, smokeCheckPassed: true, aiReadiness, campaignSlotsFilled };
}

// ── Link-rewriting helper ─────────────────────────────────────────────────────
// Rewrites href values that point to local.{domain} or root-relative paths
// so they work correctly under the /preview/{clientSlug}/ proxy route.
// Hub page slugs are excluded — their links must remain as canonical root-relative
// paths (e.g. /local-seo-rotherham/) so they resolve correctly on the live site.
function rewritePreviewLinks(html: string, clientSlug: string, hubSlug?: string): string {
  const outRoot    = path.join(OUTPUT_DIR, clientSlug);
  const previewBase = `/preview/${clientSlug}`;

  // Collect slugs that actually exist on disk; skip the hub page slug so that
  // cluster→hub links stay as canonical root-relative paths, never /preview/… paths.
  let localSlugs: string[] = [];
  try {
    localSlugs = fs.readdirSync(outRoot).filter((d) => {
      try {
        if (d === hubSlug) return false; // hub links must stay canonical
        return fs.statSync(path.join(outRoot, d)).isDirectory() &&
               d !== "assets" && d !== "sessions";
      } catch { return false; }
    });
  } catch { return html; }

  const protectedContextualLinks: string[] = [];
  let result = html.replace(
    /<a\b(?=[^>]*\bcontextual-link\b)[^>]*>[\s\S]*?<\/a>/g,
    (match) => {
      const token = `__CONTEXTUAL_LINK_${protectedContextualLinks.length}__`;
      protectedContextualLinks.push(match);
      return token;
    },
  );

  for (const slug of localSlugs) {
    // Domain-absolute: href="https://local.example.com/{slug}/"
    result = result
      .split(`href="https://local.inboxingproweb.com/${slug}/"`)
      .join(`href="${previewBase}/${slug}/"`);

    // Root-relative: href="/{slug}/"
    result = result
      .split(`href="/${slug}/"`)
      .join(`href="${previewBase}/${slug}/"`);
  }

  // Root home-page link (https://local.…/) — leave as-is; it represents
  // the real client website root, not a local preview page.

  protectedContextualLinks.forEach((link, index) => {
    result = result.replace(`__CONTEXTUAL_LINK_${index}__`, link);
  });

  return result;
}

router.post("/rollout", async (req, res) => {
  const body = req.body as RolloutBody;
  const { clientSlug, options } = body;
  const bodyCampaignId = body.campaignId ?? "";

  if (!clientSlug) {
    res.status(400).json({ error: "clientSlug is required" });
    return;
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(clientSlug)) {
    res.status(400).json({ error: "Invalid clientSlug" });
    return;
  }
  if (bodyCampaignId && !/^[a-z0-9][a-z0-9_-]*$/.test(bodyCampaignId)) {
    res.status(400).json({ error: "Invalid campaignId" });
    return;
  }

  const clientDir  = path.join(OUTPUT_DIR, clientSlug);

  const requestedContext = inferRequestedRolloutContext(body.selectedAreaDefs);

  // Prefer per-campaign session when campaignId is provided — avoids stale cross-campaign data.
  const perCampaignFile = bodyCampaignId
    ? path.join(clientDir, "sessions", `${bodyCampaignId}.json`)
    : null;
  if (perCampaignFile && !fs.existsSync(perCampaignFile)) {
    res.status(404).json({ error: `No session found for campaignId "${bodyCampaignId}".` });
    return;
  }

  const resolvedCampaignFile = !bodyCampaignId
    ? findMatchingCampaignSession(clientDir, requestedContext)
    : null;
  const rootSessionFile = path.join(clientDir, "session.json");
  const sessionFile = perCampaignFile
    ? perCampaignFile
    : resolvedCampaignFile ?? rootSessionFile;

  if (!fs.existsSync(sessionFile)) {
    res.status(404).json({ error: `No session found for ${clientSlug}. Complete previous stages first.` });
    return;
  }

  let session: Record<string, unknown>;
  try {
    session = JSON.parse(fs.readFileSync(sessionFile, "utf8")) as Record<string, unknown>;
  } catch {
    res.status(500).json({ error: "Failed to read session" });
    return;
  }

  if (!bodyCampaignId && !resolvedCampaignFile && !sessionMatchesRequestedContext(session, requestedContext)) {
    const campaign = session.campaign as { cityName?: string; serviceName?: string; serviceKey?: string } | undefined;
    res.status(400).json({
      error: "Campaign context mismatch. /api/rollout was called without campaignId, and session.json does not match the requested rollout service/city/areas.",
      requested: {
        service: requestedContext.service || null,
        city: requestedContext.city || null,
        areas: [...requestedContext.areas],
      },
      session: {
        serviceName: campaign?.serviceName ?? null,
        serviceKey: campaign?.serviceKey ?? null,
        cityName: campaign?.cityName ?? null,
      },
      fix: "Pass the correct campaignId or refresh the campaign session before running rollout.",
    });
    return;
  }

  if (!bodyCampaignId && !resolvedCampaignFile && sessionFile === rootSessionFile) {
    const rootCampaignId = session.campaignId as string | undefined;
    const canonicalSessionFile = rootCampaignId
      ? path.join(clientDir, "sessions", `${rootCampaignId}.json`)
      : "";

    if (canonicalSessionFile && fs.existsSync(canonicalSessionFile)) {
      try {
        const canonicalSession = JSON.parse(fs.readFileSync(canonicalSessionFile, "utf8")) as Record<string, unknown>;
        const rootCampaign = session.campaign as { cityName?: string; serviceName?: string; serviceKey?: string } | undefined;
        const canonicalCampaign = canonicalSession.campaign as { cityName?: string; serviceName?: string; serviceKey?: string } | undefined;
        const rootService = normaliseCampaignValue(rootCampaign?.serviceKey) || normaliseCampaignValue(rootCampaign?.serviceName);
        const canonicalService = normaliseCampaignValue(canonicalCampaign?.serviceKey) || normaliseCampaignValue(canonicalCampaign?.serviceName);
        const rootCity = normaliseAreaName(rootCampaign?.cityName);
        const canonicalCity = normaliseAreaName(canonicalCampaign?.cityName);

        if (rootService !== canonicalService || rootCity !== canonicalCity) {
          res.status(400).json({
            error: "Campaign context mismatch. /api/rollout was called without campaignId, and session.json has stale campaign metadata.",
            sessionCampaignId: rootCampaignId,
            session: {
              serviceName: rootCampaign?.serviceName ?? null,
              serviceKey: rootCampaign?.serviceKey ?? null,
              cityName: rootCampaign?.cityName ?? null,
            },
            expectedFromCampaignSession: {
              serviceName: canonicalCampaign?.serviceName ?? null,
              serviceKey: canonicalCampaign?.serviceKey ?? null,
              cityName: canonicalCampaign?.cityName ?? null,
            },
            fix: "Pass the correct campaignId or refresh session.json before running rollout.",
          });
          return;
        }
      } catch {
        res.status(400).json({
          error: "Campaign context mismatch. /api/rollout was called without campaignId, and the campaign session referenced by session.json could not be read.",
          sessionCampaignId: rootCampaignId,
          fix: "Pass the correct campaignId or refresh session.json before running rollout.",
        });
        return;
      }
    }
  }

  // Extract campaign metadata — body.campaignId takes precedence over session value
  const sessionCampaignId = bodyCampaignId || path.basename(resolvedCampaignFile ?? "", ".json") || (session.campaignId as string | undefined) || "";
  const sessionCampaign   = session.campaign as { cityName?: string; serviceName?: string; serviceKey?: string; moneyPageUrl?: string; focusKeyword?: string; industryType?: string; buyerType?: string } | undefined;
  const sessionHubDef     = ((session.selectedAreaDefs as Array<Record<string, unknown>> | undefined) ?? [])
    .find((d) => d.tier === "hub");
  const sessionHubId      = (sessionHubDef?.hubId as string | undefined) ?? (sessionCampaignId ? `hub-${sessionCampaignId}` : "");

  // Load project config
  const project = loadProject(clientSlug);
  if (!project) {
    res.status(400).json({ error: `Project config not found for ${clientSlug}. Complete Stage 1 first.` });
    return;
  }

  // Load area defs — priority:
  //   (1) body-provided defs from client in-memory state
  //   (2) session.selectedAreaDefs from the per-campaign session file
  //   (3) per-campaign area defs file on disk
  //   (4) root selected-area-defs.json ONLY when no campaignId (prevents cross-campaign bleed)
  let defs: SelectedAreaPageDef[] = [];

  if (Array.isArray(body.selectedAreaDefs) && body.selectedAreaDefs.length > 0) {
    // (1) Client sent area defs directly — most authoritative
    defs = body.selectedAreaDefs as SelectedAreaPageDef[];
  } else if (Array.isArray(session.selectedAreaDefs) && (session.selectedAreaDefs as unknown[]).length > 0) {
    // (2) Per-campaign session already has the right area defs — use them directly
    defs = session.selectedAreaDefs as SelectedAreaPageDef[];
  } else {
    // (3) Try per-campaign area defs file, then root file only if no campaignId is specified
    const perCampaignDefsFile = bodyCampaignId
      ? path.join(clientDir, "sessions", `${bodyCampaignId}-area-defs.json`)
      : null;
    const rootDefsFile = path.join(clientDir, "selected-area-defs.json");

    // Never fall back to root file when a campaignId is specified — that prevents cross-campaign bleed
    const defsFile = (perCampaignDefsFile && fs.existsSync(perCampaignDefsFile))
      ? perCampaignDefsFile
      : (!bodyCampaignId && fs.existsSync(rootDefsFile) ? rootDefsFile : null);

    if (defsFile) {
      try {
        defs = JSON.parse(fs.readFileSync(defsFile, "utf8")) as SelectedAreaPageDef[];
      } catch {
        defs = [];
      }
    }
  }

  // Fallback: rebuild from session's engineOutput + selectedAreaDefs
  if (defs.length === 0) {
    const engineOutput = session.engineOutput as AreaEngineOutput | undefined;
    const selectedDefs = session.selectedAreaDefs as Array<{ area: string }> | undefined;

    if (!engineOutput || !selectedDefs?.length) {
      res.status(400).json({ error: "No selected area defs found in session. Complete Stage 4 first." });
      return;
    }

    const campaign = session.campaign as
      | { serviceName?: string }
      | undefined;

    const projectDomain = project.domain;
    try {
      defs = buildAllSelectedAreaDefs(
        selectedDefs.map((d) => d.area),
        engineOutput,
        projectDomain,
        clientSlug
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: `Failed to rebuild area defs: ${msg}` });
      return;
    }
  }

  if (!defs.length) {
    res.status(400).json({ error: "No area defs available. Complete Stage 4 first." });
    return;
  }

  // ── Enrich defs with missing top-level fields required by preflight ──────────
  // Older sessions may store `city` and `service` only inside `signals`, or
  // hub defs may have no `signals` at all.  Back-fill from available sources so
  // the preflight `def_fields` check always passes without forcing users to redo
  // Stage 4.
  const fallbackCity    = sessionCampaign?.cityName    ?? "";
  const fallbackService = sessionCampaign?.serviceName ?? "web design";
  defs = defs.map((def) => {
    const enriched = { ...def } as Record<string, unknown> & SelectedAreaPageDef;

    // Top-level city / service — derive from signals or session campaign
    if (!enriched.city) {
      enriched.city = ((enriched.signals as unknown as Record<string, unknown> | undefined)?.city as string | undefined)
        ?? fallbackCity;
    }
    if (!enriched.service) {
      enriched.service = ((enriched.signals as unknown as Record<string, unknown> | undefined)?.serviceName as string | undefined)
        ?? fallbackService;
    }

    // Hub defs often lack a signals object entirely — build a minimal one
    if (!enriched.signals) {
      enriched.signals = {
        area:           enriched.area  ?? "",
        city:           enriched.city  ?? fallbackCity,
        postcode:       "",
        character:      "",
        knownFor:       "",
        affluence:      "community" as const,
        businessType:   "",
        localContext:   "",
        demandNote:     "",
        competitionNote: "",
        competitorAngle: "",
        messagingRegister: "",
        landmarks:      [],
        nearbyAreas:    [],
      };
    }

    return enriched as SelectedAreaPageDef;
  });

  // ── Preflight checks ────────────────────────────────────────────────────────
  // Run before SSE headers are committed so we can still return a plain JSON 400.
  const preflightOpts: PreflightOptions = {
    clientSlug,
    projectConfigPath: path.join(PROJECTS_DIR, `${clientSlug}.json`),
    defs,
    outputDir: clientDir,
    deployEnabled: project.deploy?.enabled ?? false,
    deployHost:    project.deploy?.host,
  };
  const preflight = runPreflight(preflightOpts);
  if (!preflight.passed) {
    res.status(400).json({
      error:     "Preflight checks failed. Cannot start rollout.",
      preflight,
    });
    return;
  }

  // Start a background job and return its ID immediately.
  // The client polls GET /api/rollout/status/:jobId every 2 s for progress.
  const jobId = randomUUID();
  writeJobState(jobId, { jobId, status: "running", events: [], startedAt: new Date().toISOString() });
  res.json({ jobId });

  // Fire background job — do not await so the response is already sent
  void (async () => {
    try {
      await runRolloutJob(jobId, {
        clientSlug,
        project,
        defs,
        opts: {
          includeSecondary: options?.includeSecondary ?? false,
          dryRun:           options?.dryRun           ?? false,
          deferTertiary:    options?.deferTertiary     ?? true,
          concurrency:      options?.concurrency       ?? 1,
        },
        sessionCampaignId,
        sessionCampaign,
        sessionHubId,
      });
    } catch (err) {
      const s = readJobState(jobId);
      if (s) {
        s.status     = "error";
        s.error      = String(err);
        s.finishedAt = new Date().toISOString();
        s.events.push({ type: "error", message: String(err) });
        writeJobState(jobId, s);
      }
    }
  })();
});

// ── Job status polling endpoint ──────────────────────────────────────────────
router.get("/rollout/status/:jobId", (req, res) => {
  const job = readJobState(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

router.post("/rollout/cancel/:jobId", (req, res) => {
  const job = readJobState(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "running") {
    res.json({ ok: true, message: `Job already in status: ${job.status}` });
    return;
  }
  job.status = "cancelled";
  job.cancelledAt = new Date().toISOString();
  writeJobState(req.params.jobId, job);
  res.json({ ok: true, message: "Job cancellation requested" });
});



// ── Re-upload: push existing HTML files to FTP without regenerating ────────────
router.post("/reupload", async (req, res) => {
  const { clientSlug, areaDir: singleAreaDir } = req.body as { clientSlug?: string; areaDir?: string };
  if (!clientSlug) { res.status(400).json({ error: "clientSlug is required" }); return; }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(clientSlug)) { res.status(400).json({ error: "Invalid clientSlug" }); return; }
  if (singleAreaDir && !/^[a-z0-9][a-z0-9_-]*$/.test(singleAreaDir)) { res.status(400).json({ error: "Invalid areaDir" }); return; }

  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  if (!fs.existsSync(clientDir)) { res.status(404).json({ error: "No output found for client" }); return; }

  const project = loadProject(clientSlug);
  if (!project?.deploy?.enabled) { res.status(400).json({ error: "FTP deploy not configured for this project" }); return; }

  const { host, port, remoteRoot } = project.deploy;
  const user     = project.deploy.username || process.env.DEPLOY_USERNAME;
  const password = project.deploy.password || process.env.DEPLOY_PASSWORD;
  if (!user || !password) { res.status(400).json({ error: "Missing FTP credentials" }); return; }

  // Find area dirs — single page if areaDir specified, otherwise all pages
  const areaDirs = singleAreaDir
    ? (fs.existsSync(path.join(clientDir, singleAreaDir, "index.html")) ? [singleAreaDir] : [])
    : fs.readdirSync(clientDir).filter((f) => {
        const full = path.join(clientDir, f);
        return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "index.html"));
      });

  const results: { area: string; status: string; error?: string }[] = [];

  for (const areaDir of areaDirs) {
    const outFile    = path.join(clientDir, areaDir, "index.html");
    const remotePath = `/${areaDir}/`;
    const remoteDest = [remoteRoot, remotePath, "index.html"].join("/").replace(/\/+/g, "/");
    const remoteDir  = remoteDest.slice(0, remoteDest.lastIndexOf("/")) || "/";

    const client = new ftp.Client(30000);
    try {
      await client.access({ host, port: port ?? 21, user, password, secure: true, secureOptions: { rejectUnauthorized: false } });
      await client.ensureDir(remoteDir);
      await client.uploadFrom(outFile, remoteDest);
      results.push({ area: areaDir, status: "success" });
    } catch (err) {
      results.push({ area: areaDir, status: "failed", error: String(err) });
    } finally {
      client.close();
    }
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed    = results.filter((r) => r.status === "failed").length;
  res.json({ succeeded, failed, results });
});

// ── Rerun: regenerate + re-deploy a single page ────────────────────────────────
// ── helpers shared with validate route ─────────────────────────────────────

function _toSlug(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function _stripSlugPrefixes(slug: string): string {
  return slug
    .replace(/^web-design-/, "")
    .replace(/^local-seo-/, "")
    .replace(/^affordable-web-design-/, "affordable-");
}

/** Build a minimal SelectedAreaPageDef from an existing HTML file when no session def is available. */
function _buildSyntheticDef(
  areaDir:   string,
  htmlPath:  string,
  project:   Record<string, unknown>
): SelectedAreaPageDef | undefined {
  if (!fs.existsSync(htmlPath)) return undefined;
  try {
    const html = fs.readFileSync(htmlPath, "utf8");

    // Extract h1 text (primary keyword)
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match ? h1Match[1].trim() : "";

    // Extract canonical URL → gives us the remotePath
    const canonMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const remotePath = canonMatch ? canonMatch[1] : `/${areaDir}/`;

    // Extract hub URL from first internal hub-looking link
    const hubMatch = html.match(/href="(\/[a-z0-9-]+-(?:rotherham|sheffield|barnsley|doncaster)[^"]*\/)"/i)
                  || html.match(/href="(\/web-design-[a-z-]+\/)".*hub/i);
    const hubUrl   = (project.domain as string ?? "").replace(/\/+$/, "") + (hubMatch ? hubMatch[1] : "/");

    // Derive area name: strip service prefix (web-design-, local-seo-, affordable-web-design-)
    const areaName = areaDir
      .replace(/^web-design-/, "")
      .replace(/^local-seo-/, "")
      .replace(/^affordable-web-design-/, "affordable-")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Derive service from areaDir prefix
    const service = areaDir.startsWith("local-seo-")
      ? "local seo"
      : areaDir.startsWith("affordable-")
        ? "affordable web design"
        : "web design";

    const primaryKeyword = h1 || `${service} ${areaName}`;
    const city = (project.city as string) ?? areaName;

    return {
      area: areaName,
      city,
      service,
      tier: "cluster",
      primaryKeyword,
      supportingKeywords: [
        `${areaName} ${service}`,
        `affordable ${service} ${areaName}`,
        `professional ${service} ${areaName}`,
        `${service} near ${areaName}`,
      ],
      hubUrl,
      hubAnchor: `${service} ${city}`,
      relatedPages: "",
      remotePath,
      configPath: `config/clusters/${areaDir}.json`,
      signals: {
        area: areaName,
        city,
        serviceName: service,
        primaryKeyword,
        businessType: "local businesses",
        localContext: `${areaName} local area.`,
        demandNote: `Demand for ${service} in ${areaName}.`,
        competitionNote: `Competitive ${service} market near ${areaName}.`,
        competitorAngle: "Outperform with speed and local expertise.",
        messagingRegister: "direct, results-focused",
        landmarks: [],
        nearbyAreas: [],
      },
    } as unknown as SelectedAreaPageDef;
  } catch {
    return undefined;
  }
}

/** Find the local file for an image slot, checking .webp, .jpg, .png extensions in that order. */

async function uploadCampaignAssetsForRollout(args: {
  project: any;
  campaignId: string;
  serviceKey: string;
}) {
  const { project, campaignId, serviceKey } = args;
  if (!project?.deploy?.enabled || !campaignId || !serviceKey) return;

  const deploy = project.deploy;
  const host = deploy.host;
  const port = deploy.port ?? 21;
  const user = deploy.username || process.env.DEPLOY_USERNAME;
  const password = deploy.password || process.env.DEPLOY_PASSWORD;
  const remoteRoot = (deploy.remoteRoot ?? "").replace(/\/+$/, "");

  if (!host || !user || !password) return;

  const localDir = path.join(OUTPUT_DIR, campaignId, "assets", serviceKey);
  if (!fs.existsSync(localDir)) return;

  const remoteDir = [remoteRoot, "assets", campaignId, serviceKey].join("/").replace(/\/+/g, "/");
  const slots = ["hero", "support", "trust", "conversion"];

  const client = new ftp.Client(30000);
  try {
    await client.access({ host, port, user, password, secure: true, secureOptions: { rejectUnauthorized: false } });
    await client.ensureDir(remoteDir);

    for (const slot of slots) {
      const found = _findSlotFile(localDir, slot);
      if (found) {
        await client.uploadFrom(found.localPath, `${remoteDir}/${slot}${found.ext}`);
      }
    }

    logger.info(`[campaign assets] uploaded ${campaignId}/${serviceKey} → ${remoteDir}`);
  } catch (err) {
    logger.warn({ err }, `[campaign assets] upload failed for ${campaignId}/${serviceKey}`);
  } finally {
    client.close();
  }
}


function _findSlotFile(assetsDir: string, slot: string): { localPath: string; ext: string } | null {
  for (const ext of [".webp", ".jpg", ".png"]) {
    const localPath = path.join(assetsDir, `${slot}${ext}`);
    if (fs.existsSync(localPath)) return { localPath, ext };
  }
  return null;
}

// ── Push project assets to FTP without regenerating pages ────────────────────
// POST /api/images/push-assets/:slug
router.post("/images/push-assets/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }

  const project = loadProject(slug);
  if (!project?.deploy?.enabled) {
    res.status(400).json({ error: "FTP deploy not configured for this project" });
    return;
  }

  const { host, port, remoteRoot } = project.deploy;
  const user     = project.deploy.username || process.env.DEPLOY_USERNAME;
  const password = project.deploy.password || process.env.DEPLOY_PASSWORD;
  if (!user || !password) {
    res.status(400).json({ error: "Missing FTP credentials" });
    return;
  }

  const campaignId = typeof req.query.campaignId === "string" && req.query.campaignId
    ? req.query.campaignId
    : "";

  const serviceKey = typeof req.query.serviceKey === "string" && req.query.serviceKey
    ? normaliseServiceKey(req.query.serviceKey)
    : "";

  const assetSourceId = campaignId || slug;
  const projectAssetsDir = campaignId
    ? path.join(OUTPUT_DIR, campaignId, "assets")
    : path.join(OUTPUT_DIR, slug, "assets");

  const imageSlots = ["hero", "support", "trust", "conversion"] as const;
  const remoteAssetsDir = [(remoteRoot ?? "").replace(/\/+$/, ""), "assets", assetSourceId].join("/").replace(/\/+/g, "/");

  const results: { slot: string; file: string; status: string; error?: string; remote?: string }[] = [];
  const client = new ftp.Client(30000);

  try {
    await client.access({ host, port: port ?? 21, user, password, secure: true, secureOptions: { rejectUnauthorized: false } });

    const serviceDirs = serviceKey
      ? [serviceKey]
      : fs.existsSync(projectAssetsDir)
        ? fs.readdirSync(projectAssetsDir).filter((d) => {
            try { return fs.statSync(path.join(projectAssetsDir, d)).isDirectory(); } catch { return false; }
          })
        : [];

    if (serviceDirs.length > 0) {
      for (const svcDir of serviceDirs) {
        const localSvcDir = path.join(projectAssetsDir, svcDir);
        const remoteSvcDir = `${remoteAssetsDir}/${svcDir}`.replace(/\/+/g, "/");
        await client.ensureDir(remoteSvcDir);

        for (const slot of imageSlots) {
          const found = _findSlotFile(localSvcDir, slot);
          if (!found) {
            results.push({ slot, file: "—", status: `skipped ${svcDir} (not found locally)` });
            continue;
          }
          try {
            const remoteFile = `${remoteSvcDir}/${slot}${found.ext}`;
            await client.uploadFrom(found.localPath, remoteFile);
            results.push({ slot, file: `${slot}${found.ext}`, status: "uploaded", remote: remoteFile });
          } catch (err) {
            results.push({ slot, file: `${slot}${found.ext}`, status: "failed", error: String(err) });
          }
        }
      }
    } else {
      await client.ensureDir(remoteAssetsDir);

      for (const slot of imageSlots) {
        const found = _findSlotFile(projectAssetsDir, slot);
        if (!found) {
          results.push({ slot, file: "—", status: "skipped (not found locally)" });
          continue;
        }
        try {
          const remoteFile = `${remoteAssetsDir}/${slot}${found.ext}`;
          await client.uploadFrom(found.localPath, remoteFile);
          results.push({ slot, file: `${slot}${found.ext}`, status: "uploaded", remote: remoteFile });
        } catch (err) {
          results.push({ slot, file: `${slot}${found.ext}`, status: "failed", error: String(err) });
        }
      }
    }
  } catch (err) {
    res.status(500).json({ error: `FTP connection failed: ${String(err)}`, results });
    return;
  } finally {
    client.close();
  }

  const uploaded = results.filter(r => r.status === "uploaded").length;
  const failed   = results.filter(r => r.status === "failed").length;
  res.json({ uploaded, failed, results, remoteAssetsDir });
});

function _loadAllDefs(clientDir: string): SelectedAreaPageDef[] {
  const all: SelectedAreaPageDef[] = [];

  // 1. selected-area-defs.json
  const fullDefsFile = path.join(clientDir, "selected-area-defs.json");
  if (fs.existsSync(fullDefsFile)) {
    try {
      all.push(...(JSON.parse(fs.readFileSync(fullDefsFile, "utf8")) as SelectedAreaPageDef[]));
    } catch { /* skip */ }
  }

  // 2. All campaign session files (sessions/*.json)
  const sessionsDir = path.join(clientDir, "sessions");
  if (fs.existsSync(sessionsDir)) {
    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const s = JSON.parse(
          fs.readFileSync(path.join(sessionsDir, file), "utf8")
        ) as Record<string, unknown>;
        const defs = (s.selectedAreaDefs ?? []) as SelectedAreaPageDef[];
        all.push(...defs);
      } catch { /* skip */ }
    }
  }

  return all;
}

function _findDef(
  areaDir: string,
  defs: SelectedAreaPageDef[]
): SelectedAreaPageDef | undefined {
  const exact = defs.find((d) => d.remotePath === `/${areaDir}/`);
  if (exact) return exact;

  const areaSlug = _toSlug(areaDir);
  const byArea = defs.find((d) => d.area && _toSlug(d.area) === areaSlug);
  if (byArea) return byArea;

  const stripped = _stripSlugPrefixes(areaSlug);
  return defs.find((d) => d.area && _toSlug(d.area) === stripped);
}

/**
 * Search all campaign session files for the one that contains a def matching
 * the given areaDir.  Returns the session campaign metadata and all its defs so
 * rerun-page can rebuild the same effective config as the original rollout.
 */
function _findSessionForAreaDir(
  clientDir: string,
  areaDir: string
): {
  campaignId?: string;
  campaign: { cityName?: string; serviceName?: string; serviceKey?: string; moneyPageUrl?: string; focusKeyword?: string; industryType?: string; buyerType?: string } | undefined;
  selectedAreaDefs: SelectedAreaPageDef[];
} | undefined {
  const sessionsDir = path.join(clientDir, "sessions");
  if (!fs.existsSync(sessionsDir)) return undefined;

  // Sort by modification time descending so the most-recently updated session
  // wins when multiple campaigns contain the same page.
  const files = fs.readdirSync(sessionsDir)
    .filter((f) => !f.startsWith("_") && f.endsWith(".json"))
    .map((f) => ({ f, mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ f }) => f);

  for (const file of files) {
    try {
      const s = JSON.parse(
        fs.readFileSync(path.join(sessionsDir, file), "utf8")
      ) as Record<string, unknown>;
      const defs = (s.selectedAreaDefs ?? []) as SelectedAreaPageDef[];
      const found = defs.find(
        (d) =>
          d.remotePath === `/${areaDir}/` ||
          _toSlug(d.area ?? "") === _toSlug(areaDir) ||
          _toSlug(d.area ?? "") === _stripSlugPrefixes(_toSlug(areaDir))
      );
      if (found) {
        return {
          campaignId: file.replace(/\.json$/, ""),
          campaign: s.campaign as { cityName?: string; serviceName?: string; serviceKey?: string; moneyPageUrl?: string; focusKeyword?: string; industryType?: string; buyerType?: string } | undefined,
          selectedAreaDefs: defs,
        };
      }
    } catch { /* skip malformed */ }
  }
  return undefined;
}

// ── POST /api/rerun-page ────────────────────────────────────────────────────

router.post("/rerun-page", async (req, res) => {
  const { clientSlug, areaDir } = req.body as { clientSlug?: string; areaDir?: string };
  if (!clientSlug || !areaDir) {
    res.status(400).json({ error: "clientSlug and areaDir are required" });
    return;
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(clientSlug)) { res.status(400).json({ error: "Invalid clientSlug" }); return; }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(areaDir))    { res.status(400).json({ error: "Invalid areaDir" });    return; }

  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: "No output found for client" });
    return;
  }

  const project = loadProject(clientSlug);
  if (!project) {
    res.status(400).json({ error: "Project config not found" });
    return;
  }

  // Load defs from selected-area-defs.json AND all campaign session files
  const allDefs = _loadAllDefs(clientDir);
  if (allDefs.length === 0) {
    res.status(400).json({ error: "No area defs found — complete Stage 4 first" });
    return;
  }

  // Fuzzy-match areaDir → def
  const def = _findDef(areaDir, allDefs);
  if (!def) {
    res.status(404).json({ error: `No area def found for "${areaDir}"` });
    return;
  }

  // ── Reconstruct campaign context so links are added correctly ──────────────
  // The original rollout enriches each def with hubUrl, relatedPages, and
  // moneyPageUrl from the campaign session.  Without this, rerun-page would
  // generate pages with bare-root links instead of proper campaign URLs.
  const sessionInfo      = _findSessionForAreaDir(clientDir, areaDir);
  const sessionCampaign  = sessionInfo?.campaign;
  const sessionCampaignId = sessionInfo?.campaignId;
  const sessionDefs      = sessionInfo?.selectedAreaDefs ?? allDefs;

  // Campaign-level industryType/buyerType override project-level values
  const _rpCampIndustry  = sessionCampaign?.industryType  ?? deriveIndustryFromService((sessionCampaign as any)?.serviceName ?? "");
  const _rpCampBuyer     = sessionCampaign?.buyerType     ?? (_rpCampIndustry ? deriveDefaultBuyerType(_rpCampIndustry) : undefined);
  const _rpProviderProfile = loadProviderProfile(clientSlug, (sessionCampaign as any)?.serviceKey ?? "");
  const renderConfig: RenderProjectConfig = {
    ...toRenderConfig(project),
    ...(_rpCampIndustry    ? { industryType:    _rpCampIndustry }                                          : {}),
    ...(_rpCampBuyer       ? { buyerType:       _rpCampBuyer as RenderProjectConfig["buyerType"] }         : {}),
    ...(_rpProviderProfile ? { customerProfile: _rpProviderProfile }                                       : {}),
  };
  const _domain          = project.domain.replace(/\/+$/, "");

  // Resolve money page URL (session > project.serviceMoneyPages > project.moneyPageUrl)
  const _svcKey = ((sessionCampaign as any)?.serviceKey ?? "")
    .toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  const _svcMoneyPages = (project as any).serviceMoneyPages as Record<string, string> | undefined;
  const _derivedMoneyUrl = _svcMoneyPages?.[_svcKey] ?? "";
  const resolvedMoneyUrl = sessionCampaign?.moneyPageUrl || _derivedMoneyUrl || renderConfig.moneyPageUrl || `${_domain}/`;

  // Correct hub URL (reconstructed from session city + service, same as rollout)
  const _campaignCity   = (sessionCampaign?.cityName    ?? "").toLowerCase().replace(/\s+/g, "-");
  const _campaignSvc    = (sessionCampaign?.serviceName ?? "web design").toLowerCase().replace(/\s+/g, "-");
  const correctHubUrl   = _campaignCity ? `${_domain}/${_campaignSvc}-${_campaignCity}/` : `${_domain}/`;
  const correctHubAnchor = `${sessionCampaign?.serviceName ?? "Web Design"} ${sessionCampaign?.cityName ?? ""}`.trim();

  // Build enriched def with proper relatedPages, hubUrl, hubAnchor
  const clusterSiblings = sessionDefs.filter((d) => d.tier !== "hub");
  const svcLower        = (def.service ?? sessionCampaign?.serviceName ?? "web design").toLowerCase();

  let enrichedDef: SelectedAreaPageDef;
  if (def.tier === "hub") {
    const hubRelatedPages = clusterSiblings
      .map((d) => `${svcLower} ${d.area ?? ""} (${_domain}${d.remotePath ?? ""})`)
      .join(", ");
    enrichedDef = {
      ...def,
      relatedPages: hubRelatedPages,
      hubUrl:       resolvedMoneyUrl,
      hubAnchor:    def.hubAnchor || correctHubAnchor || svcLower,
    };
  } else {
    const siblings     = clusterSiblings.filter((d) => d.area !== def.area);
    const relatedPages = siblings
      .map((d) => `${svcLower} ${d.area ?? ""} (${_domain}${d.remotePath ?? ""})`)
      .join(", ");
    enrichedDef = {
      ...def,
      relatedPages,
      hubUrl:    correctHubUrl,
      hubAnchor: correctHubAnchor,
    };
  }

  // Effective render config (same pattern as the main rollout's processOneDef)
  const effectiveRenderConfig = def.tier === "hub"
    ? {
        ...renderConfig,
        isHub:            true,
        moneyPageUrl:     resolvedMoneyUrl,
        moneyPageKeyword: sessionCampaign?.focusKeyword || renderConfig.moneyPageKeyword,
      }
    : renderConfig;

  try {
    // Ensure service name is populated — rerun defs may lack it
    const _enrichedDefFinal = (enrichedDef.service)
      ? enrichedDef
      : { ...enrichedDef, service: (sessionCampaign as any)?.serviceName ?? enrichedDef.service };
    const result = await runOneArea(_enrichedDefFinal, effectiveRenderConfig, false, (sessionCampaign as any)?.serviceKey, sessionCampaignId);

    // Image Library substitution — mirrors rollout processOneDef (pane images win via resolveFinalImageSelections).
    if (result.outputPath && fs.existsSync(result.outputPath)) {
      const libConfig = (project as any).imageLibrary as ImageLibraryConfig | undefined;
      const effectiveService = def.service ?? sessionCampaign?.serviceName ?? "";
      if (libConfig?.enabled && effectiveService) {
        try {
          const pageSlug = def.remotePath.replace(/\//g, "").trim() || def.area;
          const isLive = !!(project.domain?.replace(/\/+$/, ""));
          const domain = (project.domain ?? "").replace(/\/+$/, "");
          const manualOverride = ((sessionCampaign as any)?.imageOverrides ?? {})[pageSlug] as
            | { hero?: string; support?: string; trust?: string; conversion?: string }
            | undefined;
          const selections = resolveFinalImageSelections({
            campaignId:          sessionCampaignId || undefined,
            serviceKey:          (sessionCampaign as any)?.serviceKey ?? effectiveService,
            serviceName:         effectiveService,
            pageSlug,
            location:            def.area,
            domain,
            isLive,
            libConfig,
            manualOverride,
            campaignSlotsFilled: result.campaignSlotsFilled,
            outputDir:           OUTPUT_DIR,
          });
          if (selections.hero || selections.support || selections.trust || selections.conversion) {
            let html = fs.readFileSync(result.outputPath, "utf8");
            html = applyImageSelectionsToHtml(html, selections);
            fs.writeFileSync(result.outputPath, html, "utf8");
          }
        } catch { /* non-fatal */ }
      }
    }

    res.json({
      success: true,
      area:             def.area,
      areaDir,
      liveUrl:          result.liveUrl,
      smokeCheckPassed: result.smokeCheckPassed,
    });
  } catch (err) {
    const msg = String(err);
    // AI readiness block is an expected outcome, not a server fault — return 422
    // so the dashboard can show a user-friendly "page blocked" message instead
    // of a generic "server error".
    if (msg.includes("AI readiness check blocked")) {
      res.status(422).json({ error: msg, blocked: true });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// ── Hub page creation ─────────────────────────────────────────────────────────
// POST /api/rollout/hub
// Creates (or re-creates) the city-level hub page for a campaign.
// Derives the hub def from the campaign session data, runs AI + FTP, then
// upserts the hub area into the session's selectedAreaDefs.

router.post("/rollout/hub", async (req, res) => {
  const { clientSlug, campaignId, moneyPageUrl: bodyMoneyUrl, focusKeyword: bodyFocusKeyword } =
    req.body as { clientSlug?: string; campaignId?: string; moneyPageUrl?: string; focusKeyword?: string };
  if (!clientSlug || !campaignId) {
    res.status(400).json({ error: "clientSlug and campaignId are required" });
    return;
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(clientSlug)) { res.status(400).json({ error: "Invalid clientSlug" }); return; }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(campaignId))  { res.status(400).json({ error: "Invalid campaignId" });  return; }

  const project = loadProject(clientSlug);
  if (!project) {
    res.status(404).json({ error: `Project not found: ${clientSlug}` });
    return;
  }

  const sessionPath = path.join(OUTPUT_DIR, clientSlug, "sessions", `${campaignId}.json`);

  let session: Record<string, unknown>;
  if (fs.existsSync(sessionPath)) {
    try {
      session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
    } catch {
      res.status(500).json({ error: "Failed to read campaign session" });
      return;
    }
  } else {
    // Recovery path for older campaigns where the campaign record exists
    // but the generated session file was deleted.
    try {
      const campaignsPath = path.join(WORKSPACE_ROOT, "config", "campaigns", `${clientSlug}.json`);
      const campaigns = fs.existsSync(campaignsPath)
        ? JSON.parse(fs.readFileSync(campaignsPath, "utf8")) as Array<Record<string, unknown>>
        : [];
      const found = campaigns.find((c) => c.id === campaignId);
      if (!found) {
        res.status(404).json({ error: `Campaign session not found: ${campaignId}` });
        return;
      }

      session = {
        campaign: {
          id: found.id,
          projectSlug: found.projectSlug ?? clientSlug,
          cityName: found.city ?? found.cityName ?? "",
          citySlug: found.citySlug ?? "",
          serviceName: found.serviceName ?? "web design",
          serviceKey: found.serviceKey ?? "",
          focusKeyword: found.focusKeyword ?? "",
          moneyPageUrl: found.moneyPageUrl ?? "",
          status: found.status ?? "recovered",
          currentStage: found.currentStage ?? 1,
          createdAt: found.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        selectedAreaDefs: [],
        recoveredFromCampaign: true,
        recoveredAt: new Date().toISOString(),
      };

      fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), "utf8");
      console.log(`[session-recovery] rebuilt missing session for campaign: ${campaignId}`);
    } catch (err) {
      res.status(500).json({ error: `Failed to recover campaign session: ${String((err as Error).message || err)}` });
      return;
    }
  }

  const campaign = session.campaign as {
    cityName?: string; serviceName?: string; serviceKey?: string;
    moneyPageUrl?: string; focusKeyword?: string;
    industryType?: string; buyerType?: string;
  } | undefined;
  const city        = campaign?.cityName    ?? "";
  const serviceName = campaign?.serviceName ?? "web design";
  const rolloutServiceKey = normaliseServiceKey(campaign?.serviceKey || serviceName);

  await uploadCampaignAssetsForRollout({
    project,
    campaignId,
    serviceKey: rolloutServiceKey,
  });

  if (!city) {
    res.status(400).json({ error: "Campaign session missing cityName" });
    return;
  }

  const svc          = serviceName.trim().toLowerCase();
  const citySlug     = city.trim().toLowerCase().replace(/\s+/g, "-");
  const svcSlug      = svc.replace(/\s+/g, "-");
  const remotePath   = `/${svcSlug}-${citySlug}/`;
  const domain       = (project.domain ?? "").replace(/\/+$/, "");
  const hubUrl       = `${domain}${remotePath}`;

  // Build related pages from the existing cluster areas in this campaign
  const areaDefs = (session.selectedAreaDefs ?? []) as Array<{
    area?: string; remotePath?: string; tier?: string;
  }>;
  const clusterDefs  = areaDefs.filter((d) => d.tier !== "hub");
  const relatedPages = clusterDefs
    .map((d) => `${svc} ${d.area ?? ""} (${domain}${d.remotePath ?? ""})`)
    .join(", ");

  // ── Build "Areas We Cover" links from deployed cluster defs ────────────────
  // These are same-service neighbourhood pages for the hub city (e.g. Email
  // Marketing Broomhill, Email Marketing Crookes, …).  Rendered by the
  // {{AREAS_WE_COVER}} token in the template — kept separate from Related Services.
  const clusterAreaLinks = clusterDefs
    .filter((d) => d.area && d.remotePath)
    .map((d) => ({
      href:  d.remotePath as string,
      label: `${serviceName} ${d.area}`,
    }));

  // ── Build "Related Services" internalLinks from all deployed hub pages ──────
  // Scan all campaign sessions for this client to find hub pages in the same
  // city — these become the cross-service "Related Services" cards.
  const hubInternalLinks: import("../../../../../src/generator/types").InternalLinkConfig[] = [];
  try {
    const sessionsDir = path.join(OUTPUT_DIR, clientSlug, "sessions");
    if (fs.existsSync(sessionsDir)) {
      const sessionFiles = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
      for (const sf of sessionFiles) {
        try {
          const sfData = JSON.parse(fs.readFileSync(path.join(sessionsDir, sf), "utf8")) as Record<string, unknown>;
          const sfCamp = sfData.campaign as { cityName?: string; serviceName?: string; serviceKey?: string } | undefined;
          if (!sfCamp?.cityName || !sfCamp?.serviceName) continue;
          // Only include hub pages for the same city
          if (sfCamp.cityName.toLowerCase() !== city.toLowerCase()) continue;
          // Normalise service name: strip trailing city name if present, then slugify.
          // e.g. "Local SEO Barnsley" → "local-seo" (not "local-seo-barnsley")
          const cityLower   = sfCamp.cityName.trim().toLowerCase();
          const rawSvcLower = sfCamp.serviceName.trim().toLowerCase();
          const svcStripped = rawSvcLower.endsWith(cityLower)
            ? rawSvcLower.slice(0, rawSvcLower.length - cityLower.length).trim()
            : rawSvcLower;
          const sfSvcSlug  = svcStripped.replace(/\s+/g, "-").replace(/-+$/, "");
          const sfCitySlug = sfCamp.cityName.trim().toLowerCase().replace(/\s+/g, "-");
          const sfHubPath  = `/${sfSvcSlug}-${sfCitySlug}/`;
          // Exclude the current hub page itself — it must not appear in Related Services
          if (sfHubPath === remotePath) continue;
          const sfHubUrl   = `${domain}${sfHubPath}`;
          // Normalise service key and enforce core-services whitelist
          const sfSvcKey   = sfSvcSlug.replace(/-/g, "_")
            .replace(/^web_hosting$/, "website_hosting");
          const CORE_KEYS  = new Set(["web_design", "local_seo", "website_hosting", "email_marketing"]);
          if (!CORE_KEYS.has(sfSvcKey)) continue;
          hubInternalLinks.push({
            href:     sfHubUrl,
            service:  sfSvcKey,
            location: sfCamp.cityName,
            tier:     "hub",
          });
        } catch { /* skip malformed sessions */ }
      }
    }
  } catch { /* non-fatal — empty pool falls back gracefully */ }

  // Fallback: if same-city core service sessions are missing, still build Related
  // Services from the project money-page map so every hub has useful cross-service links.
  try {
    const currentKey = normaliseServiceKey(campaign?.serviceKey || serviceName)
      .replace(/-/g, "_")
      .replace(/^website_hosting$/, "website_hosting")
      .replace(/^web_hosting$/, "website_hosting");

    const fallbackServices = [
      { key: "web_design",       label: "Web Design",       url: "https://inboxingproweb.com/custom-website-design/" },
      { key: "local_seo",        label: "Local SEO",        url: "https://inboxingproweb.com/local-seo-services/" },
      { key: "website_hosting",  label: "Website Hosting",  url: "https://inboxingproweb.com/uk-website-hosting/" },
      { key: "email_marketing",  label: "Email Marketing",  url: "https://inboxingproweb.com/email-marketing-3/" },
    ];

    const existingKeys = new Set(hubInternalLinks.map((l) => String(l.service || "")));
    for (const svcItem of fallbackServices) {
      if (hubInternalLinks.length >= 3) break;
      if (svcItem.key === currentKey) continue;
      if (existingKeys.has(svcItem.key)) continue;

      hubInternalLinks.push({
        href:     svcItem.url,
        service:  svcItem.key,
        location: city,
        tier:     "hub",
      });
      existingKeys.add(svcItem.key);
    }
  } catch { /* non-fatal fallback */ }

  const hubInternalLinksConfig = hubInternalLinks.length > 0
    ? { links: hubInternalLinks }
    : undefined;

  // Resolve money page values before building hubDef so hubUrl is correct from the start
  const _hubServiceKeyForMoney = String(campaign?.serviceKey || "").toLowerCase().replace(/[_\s]+/g, "-");
  const _hubServiceMoneyPages = (project as any).serviceMoneyPages as Record<string, string> | undefined;
  const _hubDerivedMoneyUrl = _hubServiceKeyForMoney && _hubServiceMoneyPages
    ? _hubServiceMoneyPages[_hubServiceKeyForMoney]
    : "";
  const resolvedMoneyUrl = bodyMoneyUrl || campaign?.moneyPageUrl || _hubDerivedMoneyUrl || "";
  const resolvedFocusKw  = bodyFocusKeyword || campaign?.focusKeyword || "";

  // Build the hub SelectedAreaPageDef
  // hubUrl for a hub page points to the campaign money page (e.g. inboxingproweb.com/wordpress-hosting/)
  // so the AI's inline body link has a meaningful destination rather than a bare href="/".
  const hubDef: SelectedAreaPageDef = {
    area:               city,
    city,
    service:            serviceName,
    tier:               "hub" as const,
    primaryKeyword:     `${svc} ${city}`,
    supportingKeywords: [
      `${city} ${svc}`,
      `affordable ${svc} ${city}`,
      `professional ${svc} ${city}`,
      `local ${svc} ${city}`,
    ],
    hubUrl:       resolvedMoneyUrl || `${domain}/`,
    hubAnchor:    "",
    relatedPages,
    signals: {
      area:               city,
      city,
      postcode:           "",
      character:          `${city} commercial centre`,
      knownFor:           serviceName,
      businessType:       "local businesses",
      keywordModifier:    "local",
      affluence:          "mixed" as const,
      localContext:       `${city} is a major city with a diverse range of local businesses seeking professional ${svc}.`,
      demandNote:         `High demand for ${svc} services across ${city}.`,
      competitionNote:    `Competitive ${svc} market in ${city} with local agencies and national providers.`,
      competitorAngle:    "Outperform local agencies with faster delivery and stronger results focus.",
      messagingRegister:  "direct, commercial, results-focused",
      landmarks:          [],
      nearbyAreas:        clusterDefs.map((d) => d.area ?? "").filter(Boolean),
    },
    remotePath,
    configPath: `config/clusters/${clientSlug}-${svcSlug}-${citySlug}.json`,
  };

  // Persist to session if body provided new values
  if ((bodyMoneyUrl && bodyMoneyUrl !== campaign?.moneyPageUrl) ||
      (bodyFocusKeyword && bodyFocusKeyword !== campaign?.focusKeyword)) {
    try {
      const updatedSession = { ...session };
      (updatedSession as any).campaign = {
        ...(session.campaign as object ?? {}),
        ...(bodyMoneyUrl     ? { moneyPageUrl:  bodyMoneyUrl }     : {}),
        ...(bodyFocusKeyword ? { focusKeyword:  bodyFocusKeyword } : {}),
      };
      fs.writeFileSync(sessionPath, JSON.stringify(updatedSession, null, 2), "utf8");
    } catch { /* non-fatal */ }
  }

  try {
    // Upload project images to FTP before generating the hub page.
    // Uses image-meta.json as the source of truth (same as findSlotFile / the main
    // rollout FTP upload block) so the remote path matches the page's <img> src exactly.
    if (project.deploy?.enabled) {
      const projectAssetsDir = path.join(OUTPUT_DIR, clientSlug, "assets");
      const imageSlots = ["hero", "support", "trust", "conversion"] as const;
      const _hubMetaPath = path.join(projectAssetsDir, "image-meta.json");
      const _hubMeta: Record<string, Record<string, unknown>> = fs.existsSync(_hubMetaPath)
        ? JSON.parse(fs.readFileSync(_hubMetaPath, "utf8")) as Record<string, Record<string, unknown>>
        : {};
      const _resolveHubSlot = (slot: string) => {
        const m = _hubMeta[slot];
        if (m) {
          const svcKey = (m.serviceKey as string | undefined) ?? "";
          const dir = svcKey ? path.join(projectAssetsDir, svcKey) : projectAssetsDir;
          const found = _findSlotFile(dir, slot);
          if (found) return { ...found, remoteSubDir: svcKey };
        }
        const found = _findSlotFile(projectAssetsDir, slot);
        return found ? { ...found, remoteSubDir: "" } : null;
      };
      const hubSlots = imageSlots.map((s) => ({ slot: s, resolved: _resolveHubSlot(s) })).filter((x) => x.resolved !== null);
      if (hubSlots.length > 0) {
        const ftpUser     = project.deploy.username || process.env.DEPLOY_USERNAME;
        const ftpPassword = project.deploy.password || process.env.DEPLOY_PASSWORD;
        if (ftpUser && ftpPassword) {
          const { host, port } = project.deploy;
          const imgFtp = new ftp.Client(30000);
          try {
            await imgFtp.access({ host, port: port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });
            const remoteAssetsBase = [(project.deploy.remoteRoot ?? "").replace(/\/+$/, ""), "assets", clientSlug].join("/").replace(/\/+/g, "/");
            for (const { slot, resolved } of hubSlots) {
              if (!resolved) continue;
              const remoteDir = resolved.remoteSubDir ? `${remoteAssetsBase}/${resolved.remoteSubDir}` : remoteAssetsBase;
              try {
                await imgFtp.ensureDir(remoteDir);
                await imgFtp.uploadFrom(resolved.localPath, `${remoteDir}/${slot}${resolved.ext}`);
                logger.info(`[FTP hub] uploaded ${slot}${resolved.ext} → ${remoteDir}/`);
              } catch (slotErr) {
                logger.error(`[FTP hub] failed to upload ${slot}${resolved.ext}: ${slotErr instanceof Error ? slotErr.message : String(slotErr)}`);
              }
            }
            // Always upload root-level assets to root FTP path so fallback URLs
            // (used by campaigns whose service key doesn't match the meta) resolve on live server.
            for (const slot of imageSlots) {
              const rootFile = _findSlotFile(projectAssetsDir, slot);
              if (!rootFile) continue;
              try {
                await imgFtp.uploadFrom(rootFile.localPath, `${remoteAssetsBase}/${slot}${rootFile.ext}`);
                logger.info(`[FTP hub] uploaded root ${slot}${rootFile.ext} → ${remoteAssetsBase}/`);
              } catch (slotErr) {
                logger.error(`[FTP hub] failed to upload root ${slot}${rootFile.ext}: ${slotErr instanceof Error ? slotErr.message : String(slotErr)}`);
              }
            }
          } catch (connErr) {
            logger.error(`[FTP hub] connection failed: ${connErr instanceof Error ? connErr.message : String(connErr)}`);
          } finally { imgFtp.close(); }
        }
      }
    }

    // Push Image Library assets to FTP so hub page can resolve library image URLs on the live server.
    {
      const _hubLibConfig = (project as any).imageLibrary as ImageLibraryConfig | undefined;
      if (_hubLibConfig?.enabled && project.deploy?.enabled) {
        const ftpUser     = project.deploy.username || process.env.DEPLOY_USERNAME;
        const ftpPassword = project.deploy.password || process.env.DEPLOY_PASSWORD;
        if (ftpUser && ftpPassword) {
          const { host, port } = project.deploy;
          const remoteRoot = (project.deploy.remoteRoot ?? "").replace(/\/+$/, "");
          const libFtp = new ftp.Client(60000);
          try {
            await libFtp.access({ host, port: port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });
            for (const img of approvedImages()) {
              const localPath = imageFilePath(img);
              if (!fs.existsSync(localPath)) continue;
              const remoteDir = [remoteRoot, "assets", "image-library", img.service, img.slot]
                .join("/").replace(/\/+/g, "/");
              try {
                await libFtp.ensureDir(remoteDir);
                await libFtp.uploadFrom(localPath, img.filename);
              } catch { /* non-fatal per image */ }
            }
          } catch { /* non-fatal — live site falls back */ } finally { libFtp.close(); }
        }
      }
    }

    // Build render config — merge project defaults with resolved money page settings.
    // Campaign-level industryType/buyerType override the project-level values.
    const _hubBlueprint = loadServiceBlueprint(campaign?.serviceKey ?? serviceKey);
    const _hubCampIndustry =
      (_hubBlueprint?.industryType as string | undefined) ||
      campaign?.industryType ||
      deriveIndustryFromService(campaign?.serviceName ?? "");
    const _hubCampBuyer =
      (_hubBlueprint?.buyerType as RenderProjectConfig["buyerType"] | undefined) ||
      campaign?.buyerType ||
      (_hubCampIndustry ? deriveDefaultBuyerType(_hubCampIndustry) : undefined);
    const _hubProviderProfile = loadProviderProfile(clientSlug, campaign?.serviceKey ?? "");
    const hubRenderConfig = {
      ...toRenderConfig(project),
      isHub: true,
      ...(resolvedMoneyUrl        ? { moneyPageUrl:       resolvedMoneyUrl }                                  : {}),
      ...(resolvedMoneyUrl        ? { moneyPageKeyword:   (resolvedFocusKw || campaign?.focusKeyword || `${campaign?.serviceName || "Service"} ${campaign?.cityName || ""}`.trim()) } : {}),
      ...(_hubCampIndustry        ? { industryType:      _hubCampIndustry }                                   : {}),
      ...(_hubCampBuyer           ? { buyerType:         _hubCampBuyer as RenderProjectConfig["buyerType"] }  : {}),
      ...(_hubProviderProfile     ? { customerProfile:   _hubProviderProfile }                                : {}),
      // Related Services — cross-service hub pages for the same city
      ...(hubInternalLinksConfig  ? { internalLinks:     hubInternalLinksConfig }                            : {}),
      // Areas We Cover — same-service cluster pages for this campaign
      ...(clusterAreaLinks.length ? { clusterAreaLinks }                                                     : {}),
    };
    const result = await runOneArea(hubDef, hubRenderConfig, false, campaign?.serviceKey, campaignId);


    // V3 visual balance: shorten overlong FAQ answers after render
    try {
      if (result.outputPath && fs.existsSync(result.outputPath)) {
        let html = fs.readFileSync(result.outputPath, "utf8");

        html = html.replace(
          /(<h3>How does InboxingProWeb compare to other web design providers\?<\/h3>\s*<p>)[\s\S]*?(<\/p>)/i,
          `$1InboxingProWeb focuses on commercial outcomes, not just attractive design. We build websites to improve visibility, generate more enquiries and give local businesses a clearer, more professional online presence. With fixed pricing, practical support and local market understanding, the service is designed to be straightforward, transparent and focused on growth.$2`
        );

        fs.writeFileSync(result.outputPath, html, "utf8");
      }
    } catch (e) {
      logger.error(`[v3 faq balance] failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Legacy hub image normaliser — skip when campaign pane assets exist (pane URLs are authoritative).
    const _hubPaneMetaPath = path.join(OUTPUT_DIR, campaignId, "assets", "image-meta.json");
    if (!fs.existsSync(_hubPaneMetaPath)) {
      try {
        const { execFileSync } = await import("node:child_process");

        execFileSync(
          "node",
          [
            "scripts/fix-static-page-images.cjs",
            result.outputPath,
            campaign?.serviceKey ?? "",
          ],
          {
            cwd: process.cwd(),
            stdio: "inherit",
          },
        );

        logger.info(`[hub image normaliser] applied for ${campaign.id} service=${campaign?.serviceKey ?? ""}`);
      } catch (e) {
        logger.error(`[hub image normaliser] failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      logger.info(`[hub image normaliser] skipped — campaign pane assets present for ${campaignId}`);
    }

    // Image Library substitution for hub — mirrors the cluster library step.
    // Runs after runOneArea so library images override root-level fallback images.
    {
      const libConfig = (project as any).imageLibrary as ImageLibraryConfig | undefined;
      const hubEffectiveService = serviceName ?? campaign?.serviceName ?? "";
      const isLive = !!(project.deploy?.enabled && domain);
      const hubPageSlug = remotePath.replace(/\//g, "").trim() || city;
      if (libConfig?.enabled && hubEffectiveService && result.outputPath && fs.existsSync(result.outputPath)) {
        try {
          const manualOverride = ((campaign as any)?.imageOverrides ?? {})[hubPageSlug] as
            { hero?: string; support?: string; trust?: string; conversion?: string } | undefined;
          const selections = resolveFinalImageSelections({
            campaignId:          campaignId,
            serviceKey:          campaign?.serviceKey ?? hubEffectiveService,
            serviceName:         hubEffectiveService,
            pageSlug:            hubPageSlug,
            location:            city,
            domain:              domain.replace(/\/+$/, ""),
            isLive,
            libConfig,
            manualOverride,
            campaignSlotsFilled: result.campaignSlotsFilled,
            outputDir:           OUTPUT_DIR,
          });

          const _libHero       = selections.hero;
          const _libSupport    = selections.support;
          const _libTrust      = selections.trust;
          const _libConversion = selections.conversion;

          if (_libHero || _libSupport || _libTrust || _libConversion) {
            let html = fs.readFileSync(result.outputPath, "utf8");
            html = applyImageSelectionsToHtml(html, {
              hero:       _libHero,
              support:    _libSupport,
              trust:      _libTrust,
              conversion: _libConversion,
            });
            fs.writeFileSync(result.outputPath, html, "utf8");
            logger.info(`[hub lib] substituted images: hero=${!!_libHero} support=${!!_libSupport} trust=${!!_libTrust} conversion=${!!_libConversion}`);
            // Re-upload updated hub HTML to FTP
            if (project.deploy?.enabled) {
              const ftpUser     = project.deploy.username || process.env.DEPLOY_USERNAME;
              const ftpPassword = project.deploy.password || process.env.DEPLOY_PASSWORD;
              if (ftpUser && ftpPassword) {
                const { host, port } = project.deploy;
                const remoteRoot = (project.deploy.remoteRoot ?? "").replace(/\/+$/, "");
                const remoteDest = [remoteRoot, remotePath, "index.html"].join("/").replace(/\/+/g, "/");
                const reFtp = new ftp.Client(30000);
                try {
                  await reFtp.access({ host, port: port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });
                  const remoteDir = remoteDest.slice(0, remoteDest.lastIndexOf("/")) || "/";
                  await reFtp.ensureDir(remoteDir);
                  await reFtp.uploadFrom(result.outputPath, remoteDest);
                } catch { /* non-fatal */ } finally { reFtp.close(); }
              }
            }
          }
        } catch (err) {
          logger.error({ err }, "[hub lib] image substitution failed");
        }
      }
    }

    // Write page-data.json with hub metadata so the engine can identify this as a hub page
    const hubId       = `hub-${campaignId}`;
    const outDir      = path.join(OUTPUT_DIR, clientSlug, remotePath.replace(/\//g, "").trim() || "hub");
    const pageDataPath = path.join(outDir, "page-data.json");
    if (fs.existsSync(outDir)) {
      try {
        fs.writeFileSync(pageDataPath, JSON.stringify({
          pageType:        "hub",
          isHubPage:       true,
          hubTag:          "hub",
          hubId,
          campaignId,
          service:         serviceName,
          primaryLocation: city,
          targetKeyword:   hubDef.primaryKeyword,
          remotePath,
          liveUrl:         `${domain}${remotePath}`,
          status:          "generated",
          createdAt:       new Date().toISOString(),
          aiReadiness:     result.aiReadiness ?? null,
        }, null, 2), "utf8");
      } catch (_) { /* non-fatal */ }
    }

    // Upsert hub def into session's selectedAreaDefs
    const existingDefs = areaDefs as Array<Record<string, unknown>>;
    const hubIdx = existingDefs.findIndex((d) => d.tier === "hub");
    const hubSessionDef = {
      area:               city,
      tier:               "hub",
      score:              100,
      rank:               0,
      postcode:           "",
      primaryKeyword:     hubDef.primaryKeyword,
      supportingKeywords: hubDef.supportingKeywords,
      remotePath,
      configPath:         hubDef.configPath,
      hubId,
      hubUrl:             resolvedMoneyUrl || `${domain}/`,
      hubAnchor:          "",
      relatedPages,
      keywordsCustomised: false,
    };
    if (hubIdx >= 0) {
      existingDefs[hubIdx] = hubSessionDef;
    } else {
      existingDefs.unshift(hubSessionDef);
    }
    session.selectedAreaDefs = existingDefs;
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), "utf8");

    // Auto-rebuild sitemap so the new hub page is immediately included
    let sitemapNote: string | undefined;
    try {
      const sr = await rebuildSitemapForClient(clientSlug);
      sitemapNote = sr.success
        ? `Sitemap rebuilt — ${sr.totalPages} pages${sr.ftpUploaded.length ? ` (${sr.ftpUploaded.join(", ")} uploaded)` : ""}${sr.ftpError ? ` ⚠ FTP: ${sr.ftpError}` : ""}`
        : `Sitemap rebuild failed: ${sr.error}`;
    } catch (sErr) {
      sitemapNote = `Sitemap rebuild error: ${String(sErr)}`;
    }

    const areaSlug   = remotePath.replace(/\//g, "").trim();
    const previewUrl = `/preview/${clientSlug}/${areaSlug}/`;
    const deployEnabled = !!(project.deploy?.enabled);

    res.json({
      success:        true,
      hubUrl,
      liveUrl:        result.liveUrl,
      previewUrl,
      deployEnabled,
      remotePath,
      hubId,
      sitemapNote,
      ftpError:       result.ftpError ?? null,
      aiReadiness:    result.aiReadiness ?? null,
    });
  } catch (err: any) {
    console.error("=== HUB ROLLOUT ERROR START ===");
    console.error(err);
    console.error(err?.stack);
    console.error("=== HUB ROLLOUT ERROR END ===");

    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      stack: err?.stack || null
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// UPGRADE SYSTEM
// GET  /api/upgrade/list/:slug  — list pages below AI readiness threshold
// POST /api/upgrade             — start upgrade job (per page or per campaign)
// ────────────────────────────────────────────────────────────────────────────

router.get("/upgrade/list/:slug", (req, res) => {
  const slug = req.params.slug;
  if (!slug || !/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const threshold = Math.max(0, Math.min(100, parseInt(String(req.query.threshold ?? "90"), 10) || 90));
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: "No output found for client" });
    return;
  }

  interface PageEntry {
    areaDir: string;
    campaignId: string;
    tier: string;
    score: number;
    status: string;
    publishBlocked: boolean;
    blockingIssues: string[];
    breakdown: unknown[];
  }

  const results: PageEntry[] = [];
  let areaDirs: string[] = [];
  try {
    areaDirs = fs.readdirSync(clientDir).filter((f) => {
      try {
        return fs.statSync(path.join(clientDir, f)).isDirectory() &&
               fs.existsSync(path.join(clientDir, f, "index.html"));
      } catch { return false; }
    });
  } catch {
    res.status(500).json({ error: "Failed to read client directory" });
    return;
  }

  // Build areaDir → campaignId lookup from all session files (covers pages missing page-data.json)
  const sessionCampaignMap: Record<string, string> = {};
  const sessionsDir2 = path.join(clientDir, "sessions");
  if (fs.existsSync(sessionsDir2)) {
    for (const sFile of fs.readdirSync(sessionsDir2)) {
      if (!sFile.endsWith(".json")) continue;
      try {
        const s = JSON.parse(fs.readFileSync(path.join(sessionsDir2, sFile), "utf8")) as Record<string, unknown>;
        const cid = (s.campaignId as string | undefined) ?? sFile.replace(".json", "");
        const defs = (s.selectedAreaDefs ?? []) as SelectedAreaPageDef[];
        for (const def of defs) {
          if (def.remotePath) {
            const ad = def.remotePath.replace(/^\/|\/$/g, "");
            if (ad && !sessionCampaignMap[ad]) sessionCampaignMap[ad] = cid;
          }
        }
      } catch { /* skip */ }
    }
  }

  for (const areaDir of areaDirs) {
    const dataPath = path.join(clientDir, areaDir, "page-data.json");
    let air: AiReadinessResult | null = null;
    let campaignId = sessionCampaignMap[areaDir] ?? "unknown";
    let tier = "cluster";

    if (fs.existsSync(dataPath)) {
      try {
        const pd = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Record<string, unknown>;
        air = (pd.aiReadiness as AiReadinessResult | undefined) ?? null;
        campaignId = (pd.campaignId as string | undefined) ?? campaignId;
        tier = (pd.tier as string | undefined) ?? (pd.isHubPage ? "hub" : "cluster");
      } catch { /* ignore */ }
    }

    if (!air) {
      try {
        const html = fs.readFileSync(path.join(clientDir, areaDir, "index.html"), "utf8");
        air = scoreAiReadiness(html);
        if (fs.existsSync(dataPath)) {
          try {
            const pd = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Record<string, unknown>;
            pd.aiReadiness = air;
            fs.writeFileSync(dataPath, JSON.stringify(pd, null, 2), "utf8");
          } catch { /* non-fatal */ }
        }
      } catch { continue; }
    }

    if (air.score < threshold) {
      results.push({
        areaDir, campaignId, tier,
        score: air.score, status: air.status,
        publishBlocked: air.publishBlocked,
        blockingIssues: air.blockingIssues,
        breakdown: air.breakdown,
      });
    }
  }

  const byCampaign: Record<string, PageEntry[]> = {};
  for (const r of results) {
    if (!byCampaign[r.campaignId]) byCampaign[r.campaignId] = [];
    byCampaign[r.campaignId].push(r);
  }

  const campaigns = Object.entries(byCampaign).map(([cid, pages]) => ({
    campaignId: cid,
    pages: pages.sort((a, b) => a.score - b.score),
    lowestScore: Math.min(...pages.map(p => p.score)),
    avgScore: Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length),
  }));
  campaigns.sort((a, b) => a.lowestScore - b.lowestScore);

  res.json({ total: results.length, threshold, campaigns });
});

router.post("/upgrade", (req, res) => {
  const { clientSlug, areas, campaignId: filterCampaign, threshold: rawThreshold } = req.body as {
    clientSlug?: string;
    areas?: string[];
    campaignId?: string;
    threshold?: number;
  };
  if (!clientSlug || !/^[a-z0-9][a-z0-9_-]*$/.test(clientSlug)) {
    res.status(400).json({ error: "clientSlug is required" });
    return;
  }

  const project = loadProject(clientSlug);
  if (!project) {
    res.status(400).json({ error: `Project not found: ${clientSlug}` });
    return;
  }

  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: "No output found for client" });
    return;
  }

  const threshold = Math.max(0, Math.min(100, rawThreshold ?? 90));
  let targetAreas: string[] = [];

  // Build a set of areaDirs that belong to the filtered campaign (via session defs),
  // so pages without page-data.json can still be matched.
  let campaignAreaDirSet: Set<string> | null = null;
  if (filterCampaign) {
    campaignAreaDirSet = new Set<string>();
    const sessionPath = path.join(clientDir, "sessions", `${filterCampaign}.json`);
    if (fs.existsSync(sessionPath)) {
      try {
        const s = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
        const defs = (s.selectedAreaDefs ?? []) as SelectedAreaPageDef[];
        for (const def of defs) {
          if (def.remotePath) {
            // remotePath is like "/web-design-barnsley/" → strip slashes → areaDir
            const areaDir = def.remotePath.replace(/^\/|\/$/g, "");
            if (areaDir) campaignAreaDirSet.add(areaDir);
          }
        }
      } catch { /* ignore */ }
    }
  }

  if (Array.isArray(areas) && areas.length > 0) {
    targetAreas = areas.filter((a) => /^[a-z0-9][a-z0-9_-]*$/.test(a));
  } else {
    try {
      const areaDirs = fs.readdirSync(clientDir).filter((f) => {
        try {
          return fs.statSync(path.join(clientDir, f)).isDirectory() &&
                 fs.existsSync(path.join(clientDir, f, "index.html"));
        } catch { return false; }
      });
      for (const areaDir of areaDirs) {
        const dataPath = path.join(clientDir, areaDir, "page-data.json");
        let score: number | null = null;
        let pageCampaignId: string | undefined;
        if (fs.existsSync(dataPath)) {
          try {
            const pd = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Record<string, unknown>;
            score = (pd.aiReadiness as { score?: number } | null)?.score ?? null;
            pageCampaignId = pd.campaignId as string | undefined;
          } catch { /* ignore */ }
        }
        if (score === null) {
          try {
            score = scoreAiReadiness(fs.readFileSync(path.join(clientDir, areaDir, "index.html"), "utf8")).score;
          } catch { continue; }
        }
        if (filterCampaign) {
          // Match if page-data campaignId matches, OR if the session defs include this areaDir
          const matchesById = pageCampaignId === filterCampaign;
          const matchesByDef = campaignAreaDirSet?.has(areaDir) ?? false;
          if (!matchesById && !matchesByDef) continue;
        }
        if (score < threshold) targetAreas.push(areaDir);
      }
    } catch { /* ignore */ }
  }

  if (targetAreas.length === 0) {
    res.json({ message: "No pages below threshold — nothing to upgrade", jobId: null });
    return;
  }

  const jobId = randomUUID();
  writeJobState(jobId, { jobId, status: "running", events: [], startedAt: new Date().toISOString() });
  res.json({ jobId, totalAreas: targetAreas.length });

  void (async () => {
    try {
      await runUpgradeJob(jobId, { clientSlug, project, targetAreas });
    } catch (err) {
      const s = readJobState(jobId);
      if (s) {
        s.status = "error";
        s.error = String(err);
        s.finishedAt = new Date().toISOString();
        s.events.push({ type: "error", message: String(err) });
        writeJobState(jobId, s);
      }
    }
  })();
});

async function runUpgradeJob(
  jobId: string,
  params: { clientSlug: string; project: ProjectConfig; targetAreas: string[] }
): Promise<void> {
  const { clientSlug, project, targetAreas } = params;
  const clientDir   = path.join(OUTPUT_DIR, clientSlug);
  const renderConfig = toRenderConfig(project);
  const allDefs      = _loadAllDefs(clientDir);

  interface UpgradeResult {
    areaDir:        string;
    area?:          string;
    beforeScore:    number | null;
    afterScore:     number | null;
    afterStatus:    string | null;
    publishBlocked: boolean;
    blockingIssues: string[];
    warnings:       string[];
    success:        boolean;
    error?:         string;
    durationMs:     number;
  }
  const results: UpgradeResult[] = [];
  let successCount = 0;

  for (const areaDir of targetAreas) {
    const t0       = Date.now();
    const dataPath = path.join(clientDir, areaDir, "page-data.json");

    let beforeScore:    number | null  = null;
    let isHub                          = false;
    let pageCampaignId: string | undefined;

    if (fs.existsSync(dataPath)) {
      try {
        const pd = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Record<string, unknown>;
        beforeScore     = (pd.aiReadiness as { score?: number } | null)?.score ?? null;
        isHub           = pd.isHubPage === true || pd.tier === "hub";
        pageCampaignId  = pd.campaignId as string | undefined;
      } catch { /* ignore */ }
    }

    let def: SelectedAreaPageDef | undefined = _findDef(areaDir, allDefs);

    // If the found def is missing essential generation fields (session hub defs
    // often only store area/tier/remotePath but not supportingKeywords/signals),
    // discard it so the hub-reconstruction or synthetic-def fallback can provide
    // a complete def instead.
    if (def && (!def.supportingKeywords?.length || !def.signals)) {
      def = undefined;
    }

    // Reconstruct hub def from session when not found in allDefs
    if (!def && isHub && pageCampaignId) {
      const sessionPath = path.join(clientDir, "sessions", `${pageCampaignId}.json`);
      if (fs.existsSync(sessionPath)) {
        try {
          const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
          const camp    = session.campaign as { cityName?: string; serviceName?: string } | undefined;
          const hubCity = camp?.cityName ?? "";
          const hubSvc  = (camp?.serviceName ?? "web design").trim().toLowerCase();
          const citySlug = hubCity.trim().toLowerCase().replace(/\s+/g, "-");
          const svcSlug  = hubSvc.replace(/\s+/g, "-");
          const domain   = (project.domain ?? "").replace(/\/+$/, "");
          const remotePath = `/${svcSlug}-${citySlug}/`;
          const areaDefs = ((session.selectedAreaDefs ?? []) as Array<{ tier?: string; area?: string; remotePath?: string }>)
            .filter((d) => d.tier !== "hub");
          const relatedPages = areaDefs.map((d) => `${hubSvc} ${d.area ?? ""} (${domain}${d.remotePath ?? ""})`).join(", ");
          def = {
            area: hubCity, city: hubCity, service: camp?.serviceName ?? "web design",
            tier: "hub" as const,
            primaryKeyword: `${hubSvc} ${hubCity}`,
            supportingKeywords: [`${hubCity} ${hubSvc}`, `affordable ${hubSvc} ${hubCity}`, `professional ${hubSvc} ${hubCity}`, `local ${hubSvc} ${hubCity}`],
            hubUrl: `${domain}/`, hubAnchor: "", relatedPages, remotePath,
            configPath: `config/clusters/${clientSlug}-${svcSlug}-${citySlug}.json`,
            signals: {
              area: hubCity, city: hubCity, postcode: "", character: "", knownFor: "",
              affluence: "community" as const,
              businessType: "local businesses",
              localContext: `${hubCity} commercial area.`,
              demandNote: `High demand for ${hubSvc} in ${hubCity}.`,
              competitionNote: `Competitive ${hubSvc} market in ${hubCity}.`,
              competitorAngle: "Outperform with speed and results.",
              messagingRegister: "direct, results-focused",
              landmarks: [], nearbyAreas: areaDefs.map((d) => d.area ?? "").filter(Boolean),
            },
          };
        } catch { /* ignore */ }
      }
    }

    // Last resort: build a synthetic def from the existing HTML file
    if (!def) {
      const htmlPath = path.join(clientDir, areaDir, "index.html");
      def = _buildSyntheticDef(areaDir, htmlPath, project as unknown as Record<string, unknown>);
      if (def) {
        appendJobEvent(jobId, { type: "progress", area: def.area, tier: "cluster", step: `no session def — rebuilding from HTML (was ${beforeScore ?? "??"}⁄100)…`, status: "success", durationMs: 0 });
      }
    }

    if (!def) {
      const durationMs = Date.now() - t0;
      appendJobEvent(jobId, { type: "progress", area: areaDir, tier: isHub ? "hub" : "cluster", step: "skipped — no area def found", status: "failed", durationMs });
      results.push({ areaDir, beforeScore, afterScore: null, afterStatus: null, publishBlocked: false, blockingIssues: [], warnings: [], success: false, error: "No area def found", durationMs });
      continue;
    }

    appendJobEvent(jobId, { type: "progress", area: def.area, tier: def.tier, step: `upgrading (was ${beforeScore ?? "??"}⁄100)…`, status: "success", durationMs: 0 });

    let upgradeServiceKey: string | undefined;
    if (pageCampaignId) {
      const sessionPath = path.join(clientDir, "sessions", `${pageCampaignId}.json`);
      if (fs.existsSync(sessionPath)) {
        try {
          const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
          upgradeServiceKey = (session.campaign as { serviceKey?: string } | undefined)?.serviceKey;
        } catch { /* ignore */ }
      }
    }

    try {
      const effectiveConfig = isHub ? { ...renderConfig, isHub: true } : renderConfig;
      const result = await runOneArea(def, effectiveConfig, false, upgradeServiceKey, pageCampaignId);
      const air    = result.aiReadiness;

      if (fs.existsSync(dataPath)) {
        try {
          const pd = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Record<string, unknown>;
          pd.aiReadiness = air ?? pd.aiReadiness;
          pd.status      = "generated";
          pd.createdAt   = new Date().toISOString();
          fs.writeFileSync(dataPath, JSON.stringify(pd, null, 2), "utf8");
        } catch { /* non-fatal */ }
      }

      const durationMs = Date.now() - t0;
      const afterScore = air?.score ?? null;
      const delta      = afterScore !== null && beforeScore !== null ? afterScore - beforeScore : null;
      const stepMsg    = afterScore !== null
        ? `${beforeScore ?? "??"}→${afterScore}/100 (${air?.status ?? ""})${delta !== null && delta > 0 ? ` +${delta}pts` : delta === 0 ? " no change" : ""}${result.ftpError ? " ⚠FTP" : ""}`
        : "generated (no score)";

      appendJobEvent(jobId, { type: "progress", area: def.area, tier: def.tier, step: stepMsg, status: result.ftpError ? "warning" as const : "success", durationMs, message: result.ftpError });
      successCount++;
      results.push({ areaDir, area: def.area, beforeScore, afterScore, afterStatus: air?.status ?? null, publishBlocked: air?.publishBlocked ?? false, blockingIssues: air?.blockingIssues ?? [], warnings: air?.warnings ?? [], success: true, durationMs });
    } catch (err) {
      const durationMs = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      appendJobEvent(jobId, { type: "progress", area: def.area, tier: def.tier, step: `failed: ${msg.slice(0, 140)}`, status: "failed", durationMs, message: msg });
      results.push({ areaDir, area: def.area, beforeScore, afterScore: null, afterStatus: null, publishBlocked: false, blockingIssues: [], warnings: [], success: false, error: msg, durationMs });
    }
  }

  if (successCount > 0) {
    appendJobEvent(jobId, { type: "progress", area: "sitemap", tier: "hub", step: "rebuilding sitemap…", status: "success", durationMs: 0 });
    try {
      const sr = await rebuildSitemapForClient(clientSlug);
      appendJobEvent(jobId, { type: "progress", area: "sitemap", tier: "hub", step: sr.success ? `sitemap rebuilt — ${sr.totalPages} pages` : `sitemap failed: ${sr.error ?? "unknown"}`, status: sr.success ? "success" : "failed", durationMs: 0 });
    } catch (e) {
      appendJobEvent(jobId, { type: "progress", area: "sitemap", tier: "hub", step: `sitemap error: ${String(e)}`, status: "failed", durationMs: 0 });
    }
  }

  const summary = { total: targetAreas.length, upgraded: successCount, failed: targetAreas.length - successCount, results };
  appendJobEvent(jobId, { type: "done", log: summary });
  const finalState = readJobState(jobId);
  if (finalState) {
    finalState.status     = "done";
    finalState.log        = summary;
    finalState.finishedAt = new Date().toISOString();
    writeJobState(jobId, finalState);
  }
}

// ── Re-render all pages with AI citation blocks ───────────────────────────────
// POST /api/rollout/rerender/:slug
// Re-reads existing index.html for each page, injects AI definition blocks and
// AI citable blocks derived from existing content, and saves the result.
// No OpenAI calls — works from what is already on disk.

router.post("/rerender/:slug", async (req, res) => {
  const clientSlug = req.params.slug;
  if (!clientSlug || !/^[a-z0-9][a-z0-9_-]*$/.test(clientSlug)) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }

  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: "Project output directory not found" });
    return;
  }

  function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function trimWords(text: string, maxWords: number): string {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return words.join(" ");
    const candidate = words.slice(0, maxWords).join(" ");
    // prefer ending at a sentence boundary
    const lastPunct = Math.max(
      candidate.lastIndexOf(". "),
      candidate.lastIndexOf("? "),
      candidate.lastIndexOf("! ")
    );
    return lastPunct > candidate.length * 0.45
      ? candidate.slice(0, lastPunct + 1).trim()
      : candidate.trim() + ".";
  }

  function buildDefinitionBlocks(html: string): string {
    // Definition 1: first 2 sentences of ai-summary-section intro paragraph
    const summaryPara = html.match(/<p class="quick-answer-label">[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/);
    const def1Parts: string[] = [];
    if (summaryPara) {
      const raw = stripTags(summaryPara[1]);
      const sentences = raw.match(/[^.!?]+[.!?]+/g) ?? [];
      const twoSentences = sentences.slice(0, 2).join(" ").trim();
      if (twoSentences.length > 30) def1Parts.push(twoSentences);
    }

    // Definition 2: service entity fact line from cluster-entity-list
    const entityList = html.match(/<ul class="cluster-entity-list">([\s\S]*?)<\/ul>/);
    const def2Parts: string[] = [];
    if (entityList) {
      const entityItems: Record<string, string> = {};
      const liMatches = entityList[1].matchAll(/<li><strong>([^<]+):<\/strong>\s*([^<]+)<\/li>/g);
      for (const m of liMatches) entityItems[m[1].trim().toLowerCase()] = m[2].trim();
      const svc      = entityItems["service"]       ?? "";
      const loc      = entityItems["location"]      ?? "";
      const provider = entityItems["provider"]      ?? "";
      const forWho   = entityItems["for"]           ?? "";
      const covering = entityItems["also covering"] ?? "";
      if (svc && loc && provider) {
        const audience = forWho ? ` for ${forWho.toLowerCase()}` : "";
        const ext      = covering ? ` Coverage extends to ${covering}.` : "";
        def2Parts.push(`${svc} in ${loc} is delivered by ${provider}${audience}.${ext}`);
      }
    }

    const defs = [...def1Parts, ...def2Parts].filter(Boolean);
    if (!defs.length) return "";
    const items = defs.map((d) => `<div class="ai-definition-block">${escHtml(d)}</div>`).join("\n        ");
    return `<div class="ai-definition-wrap" aria-label="Service definitions">
  <div class="wrap">
    <div class="ai-definition-grid">
        ${items}
    </div>
  </div>
</div>`;
  }

  function buildCitableBlocks(html: string): string {
    // Extract up to 3 Q&A pairs from cluster-intent-items
    const intentSection = html.match(/class="cluster-intent-clusters"[\s\S]*?<\/section>/);
    if (!intentSection) return "";

    const blocks: Array<{q: string; a: string}> = [];
    const intentItems = intentSection[0].matchAll(/<div class="cluster-intent-item">\s*<h3>([\s\S]*?)<\/h3>\s*<div class="cluster-intent-answer">([\s\S]*?)<\/div>\s*<\/div>/g);
    for (const m of intentItems) {
      if (blocks.length >= 3) break;
      const q = stripTags(m[1]).trim();
      const a = trimWords(stripTags(m[2]), 65);
      if (q && a) blocks.push({ q, a });
    }
    if (!blocks.length) return "";

    // Extract service + location from h2 in the section for the section heading
    const h2Match = intentSection[0].match(/<h2>([\s\S]*?)<\/h2>/);
    const sectionTitle = h2Match ? stripTags(h2Match[1]) : "Common Questions";

    const cards = blocks.map((b) =>
      `<div class="ai-citable-block">
        <h3>${escHtml(b.q)}</h3>
        <p>${escHtml(b.a)}</p>
      </div>`
    ).join("\n        ");

    return `<section class="ai-citable-section" aria-label="Common Questions Answered">
  <div class="wrap">
    <p class="ai-citable-section-label">Quick answers</p>
    <h2>${escHtml(sectionTitle)}</h2>
    <div class="ai-citable-grid">
        ${cards}
    </div>
  </div>
</section>`;
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const results: Array<{areaDir: string; result: string}> = [];

  const areaDirs = fs.readdirSync(clientDir).filter((d) => {
    const stat = fs.statSync(path.join(clientDir, d));
    return stat.isDirectory() && d !== "assets";
  });

  for (const areaDir of areaDirs) {
    const htmlPath = path.join(clientDir, areaDir, "index.html");
    if (!fs.existsSync(htmlPath)) { skipped++; continue; }

    try {
      let html = fs.readFileSync(htmlPath, "utf8");

      const hasDefBlock    = html.includes('class="ai-definition-block"');
      const hasCitableBlock = html.includes('class="ai-citable-block"');
      const hasIntentSection = html.includes('class="cluster-intent-clusters"') || html.includes('cluster-intent-item');

      // Skip if already fully enhanced
      if (hasCitableBlock && hasDefBlock) {
        skipped++;
        results.push({ areaDir, result: "already-enhanced" });
        continue;
      }

      // Skip if only missing citable blocks but page has no intent section to extract from
      if (hasDefBlock && !hasIntentSection) {
        skipped++;
        results.push({ areaDir, result: "definition-only (no intent section — regenerate to add Q&A blocks)" });
        continue;
      }

      let changed = false;

      // 1. Inject definition blocks after ai-summary-section if not present
      if (!hasDefBlock) {
        const defHtml = buildDefinitionBlocks(html);
        if (defHtml) {
          html = html.replace(
            /(<section[^>]*id="ai-summary-section"[\s\S]*?<\/section>)/,
            `$1\n\n  ${defHtml}`
          );
          changed = true;
        }
      }

      // 2. Inject citable blocks before cta-section if not present
      if (!hasCitableBlock) {
        const citableHtml = buildCitableBlocks(html);
        if (citableHtml) {
          html = html.replace(
            /(<section[^>]*id="cta-section")/,
            `${citableHtml}\n\n  $1`
          );
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(htmlPath, html, "utf8");
        processed++;
        results.push({ areaDir, result: "enhanced" });
      } else {
        skipped++;
        results.push({ areaDir, result: "no-content-extracted" });
      }
    } catch (err) {
      failed++;
      results.push({ areaDir, result: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  res.json({ processed, skipped, failed, total: areaDirs.length, results });
});

export default router;
