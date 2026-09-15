/**
 * Search Console routes
 *
 * GET  /api/search-console/status         — read local indexing status
 * GET  /api/search-console/check-access   — verify sitemap is publicly reachable
 * POST /api/search-console/submit-sitemap — log submission + return GSC URL
 *
 * NOTE: This system does NOT use the Google Indexing API.
 * That API is reserved exclusively for JobPosting and BroadcastEvent (livestream)
 * pages. Standard service/location pages must be submitted via Search Console → Sitemaps.
 * This system cannot auto-submit to GSC on your behalf — OAuth credentials are not
 * stored here. Use the gscUrl returned by submit-sitemap to open the correct GSC page.
 */

import { Router }  from "express";
import fs          from "node:fs";
import path        from "node:path";
import * as ftp    from "basic-ftp";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT  = path.resolve(__dirname, "../../..");
const OUTPUT_DIR      = path.join(WORKSPACE_ROOT, "output");
const CAMPAIGNS_DIR   = path.join(WORKSPACE_ROOT, "config", "campaigns");

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexingStatus {
  projectSlug:         string;
  sitemapUrl:          string;
  robotsUrl:           string;
  sitemapAccessible?:  boolean;
  sitemapCheckedAt?:   string;
  sitemapSubmittedAt?: string;
  updatedAt:           string;
}

interface ProofLogEntry {
  event:     string;
  data:      Record<string, unknown>;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusPath(projectSlug: string): string {
  return path.join(OUTPUT_DIR, projectSlug, "indexing-status.json");
}

function proofLogPath(projectSlug: string): string {
  return path.join(OUTPUT_DIR, projectSlug, "proof-log.json");
}

function readStatus(projectSlug: string): IndexingStatus | null {
  const p = statusPath(projectSlug);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as IndexingStatus; }
  catch { return null; }
}

function writeStatus(status: IndexingStatus): void {
  fs.mkdirSync(path.dirname(statusPath(status.projectSlug)), { recursive: true });
  fs.writeFileSync(statusPath(status.projectSlug), JSON.stringify(status, null, 2), "utf8");
}

function appendProofLog(projectSlug: string, entry: ProofLogEntry): void {
  const p = proofLogPath(projectSlug);
  let log: ProofLogEntry[] = [];
  if (fs.existsSync(p)) {
    try { log = JSON.parse(fs.readFileSync(p, "utf8")); } catch { /* start fresh */ }
    if (!Array.isArray(log)) log = [];
  }
  log.push(entry);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(log, null, 2), "utf8");
}

// ─── GET /api/search-console/status ──────────────────────────────────────────

router.get("/search-console/status", (req, res) => {
  const { projectSlug } = req.query as Record<string, string>;
  if (!projectSlug) {
    res.status(400).json({ error: "projectSlug is required" });
    return;
  }
  const status = readStatus(projectSlug);
  res.json({ status });
});

// ─── GET /api/search-console/check-access ────────────────────────────────────

router.get("/search-console/check-access", async (req, res) => {
  const { projectSlug, sitemapUrl } = req.query as Record<string, string>;
  if (!sitemapUrl) {
    res.status(400).json({ error: "sitemapUrl is required" });
    return;
  }

  const checkedAt = new Date().toISOString();
  let accessible  = false;
  let error: string | undefined;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    const response   = await fetch(sitemapUrl, {
      method:  "GET",
      signal:  controller.signal,
      headers: { "User-Agent": "InboxingProWeb-SitemapChecker/1.0" },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const text = await response.text();
      accessible = text.includes("<urlset") || text.includes("<?xml");
      if (!accessible) {
        error = `Unexpected response — does not look like a valid sitemap (HTTP ${response.status})`;
      }
    } else {
      error = `HTTP ${response.status} ${response.statusText}`;
    }
  } catch (e: unknown) {
    error = (e as Error).message ?? "Network error";
  }

  // Persist accessible state
  if (projectSlug) {
    const existing = readStatus(projectSlug) ?? {
      projectSlug,
      sitemapUrl,
      robotsUrl: sitemapUrl.replace("sitemap.xml", "robots.txt"),
      updatedAt: checkedAt,
    };
    existing.sitemapAccessible = accessible;
    existing.sitemapCheckedAt  = checkedAt;
    existing.updatedAt         = checkedAt;
    writeStatus(existing);
  }

  res.json({ accessible, sitemapUrl, checkedAt, error });
});

// ─── POST /api/search-console/submit-sitemap ─────────────────────────────────

router.post("/search-console/submit-sitemap", async (req, res) => {
  const { projectSlug, sitemapUrl, campaignId } = req.body as {
    projectSlug: string;
    sitemapUrl:  string;
    campaignId?: string;
  };

  if (!projectSlug || !sitemapUrl) {
    res.status(400).json({ error: "projectSlug and sitemapUrl are required" });
    return;
  }

  const submittedAt = new Date().toISOString();

  // Derive robots.txt URL from sitemapUrl
  const robotsUrl = sitemapUrl.replace(/\/sitemap\.xml$/, "/robots.txt");

  // Build the GSC Sitemaps page URL for this property
  let gscUrl: string;
  try {
    const origin = new URL(sitemapUrl).origin;
    const propertyId = encodeURIComponent(origin + "/");
    gscUrl = `https://search.google.com/search-console/sitemaps?resource_id=${propertyId}`;
  } catch {
    gscUrl = "https://search.google.com/search-console/sitemaps";
  }

  // Persist indexing status
  const existing = readStatus(projectSlug) ?? {
    projectSlug,
    sitemapUrl,
    robotsUrl,
    updatedAt: submittedAt,
  };
  existing.sitemapSubmittedAt = submittedAt;
  existing.sitemapUrl         = sitemapUrl;
  existing.robotsUrl          = robotsUrl;
  existing.updatedAt          = submittedAt;
  writeStatus(existing);

  // If a specific campaign was submitted, mark it as deployed in campaigns config
  if (campaignId) {
    try {
      const campaignFile = path.join(CAMPAIGNS_DIR, `${projectSlug}.json`);
      if (fs.existsSync(campaignFile)) {
        const campaigns = JSON.parse(fs.readFileSync(campaignFile, "utf8")) as Array<Record<string, unknown>>;
        const campaign = campaigns.find((c) => c.id === campaignId);
        if (campaign) {
          campaign.status = "deployed";
          campaign.updatedAt = submittedAt;
          fs.writeFileSync(campaignFile, JSON.stringify(campaigns, null, 2));
        }
      }
    } catch { /* non-fatal */ }
  }

  // Append to proof-log
  appendProofLog(projectSlug, {
    event: "sitemap_submission_logged",
    data:  { sitemapUrl, robotsUrl, gscUrl, submittedAt, campaignId: campaignId ?? null },
    timestamp: submittedAt,
  });

  res.json({
    success:     true,
    sitemapUrl,
    robotsUrl,
    gscUrl,
    submittedAt,
    message:     "Submission logged. Open gscUrl to complete submission in Search Console.",
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sitemap Registry  —  cross-project master list
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG_DIR      = path.join(WORKSPACE_ROOT, "config");
const REGISTRY_FILE   = path.join(CONFIG_DIR, "sitemap-registry.json");

interface SitemapEntry {
  id:              string;
  projectName:     string;
  sitemapUrl:      string;
  addedAt:         string;
  lastSubmittedAt?: string;
  notes?:          string;
}

function readRegistry(): SitemapEntry[] {
  if (!fs.existsSync(REGISTRY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8")); }
  catch { return []; }
}

function writeRegistry(entries: SitemapEntry[]): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2), "utf8");
}

function gscSitemapsUrl(sitemapUrl: string): string {
  try {
    const origin     = new URL(sitemapUrl).origin;
    const propertyId = encodeURIComponent(origin + "/");
    return `https://search.google.com/search-console/sitemaps?resource_id=${propertyId}`;
  } catch {
    return "https://search.google.com/search-console/sitemaps";
  }
}

/** Auto-seed registry from existing project indexing-status.json files. */
function seedFromProjects(entries: SitemapEntry[]): SitemapEntry[] {
  if (!fs.existsSync(OUTPUT_DIR)) return entries;
  const existing = new Set(entries.map((e) => e.sitemapUrl));
  let changed = false;

  for (const slug of fs.readdirSync(OUTPUT_DIR)) {
    const statusFile = path.join(OUTPUT_DIR, slug, "indexing-status.json");
    if (!fs.existsSync(statusFile)) continue;
    try {
      const status = JSON.parse(fs.readFileSync(statusFile, "utf8")) as IndexingStatus;
      if (!status.sitemapUrl || existing.has(status.sitemapUrl)) continue;

      entries.push({
        id:              `auto-${Date.now()}-${slug}`,
        projectName:     slug,
        sitemapUrl:      status.sitemapUrl,
        addedAt:         status.updatedAt ?? new Date().toISOString(),
        lastSubmittedAt: status.sitemapSubmittedAt,
      });
      existing.add(status.sitemapUrl);
      changed = true;
    } catch { /* skip */ }
  }

  if (changed) writeRegistry(entries);
  return entries;
}

// ── GET /api/sitemap-registry ─────────────────────────────────────────────

router.get("/sitemap-registry", (_req, res) => {
  const entries = seedFromProjects(readRegistry());
  res.json({ entries });
});

// ── POST /api/sitemap-registry ────────────────────────────────────────────

router.post("/sitemap-registry", (req, res) => {
  const { projectName, sitemapUrl, notes } = req.body as {
    projectName?: string;
    sitemapUrl?:  string;
    notes?:       string;
  };

  if (!projectName || !sitemapUrl) {
    res.status(400).json({ error: "projectName and sitemapUrl are required" });
    return;
  }

  const entries = readRegistry();
  if (entries.find((e) => e.sitemapUrl === sitemapUrl)) {
    res.status(409).json({ error: "A sitemap with this URL already exists" });
    return;
  }

  const entry: SitemapEntry = {
    id:          `sm-${Date.now()}`,
    projectName: projectName.trim(),
    sitemapUrl:  sitemapUrl.trim(),
    addedAt:     new Date().toISOString(),
    notes:       notes?.trim() || undefined,
  };

  entries.push(entry);
  writeRegistry(entries);
  res.json({ success: true, entry });
});

// ── DELETE /api/sitemap-registry/:id ─────────────────────────────────────

router.delete("/sitemap-registry/:id", (req, res) => {
  const { id } = req.params;
  const entries = readRegistry();
  const idx     = entries.findIndex((e) => e.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  entries.splice(idx, 1);
  writeRegistry(entries);
  res.json({ success: true });
});

// ── POST /api/sitemap-registry/:id/submit ─────────────────────────────────

router.post("/sitemap-registry/:id/submit", (req, res) => {
  const { id }  = req.params;
  const entries = readRegistry();
  const entry   = entries.find((e) => e.id === id);
  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  entry.lastSubmittedAt = new Date().toISOString();
  writeRegistry(entries);

  res.json({
    success:     true,
    sitemapUrl:  entry.sitemapUrl,
    gscUrl:      gscSitemapsUrl(entry.sitemapUrl),
    submittedAt: entry.lastSubmittedAt,
  });
});

// ── POST /api/sitemap/rebuild ─────────────────────────────────────────────
// Regenerates per-campaign sitemaps + project-wide sitemap index for a project.
// Writes files to disk (output/{slug}/sitemap-{campaignId}.xml, sitemap.xml,
// sitemap-index.xml, robots.txt) and returns all URLs.

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildUrlsetXml(locs: { loc: string; priority: number }[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls  = locs.map(({ loc, priority }) =>
    `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildSitemapIndexXml(sitemapLocs: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const items = sitemapLocs.map(loc =>
    `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

// ── Exported shared rebuild logic ─────────────────────────────────────────────
// Called by the manual rebuild route AND automatically after each rollout.

export interface SitemapRebuildResult {
  success:        boolean;
  projectSitemap: string;
  indexSitemap:   string;
  campaignSitemaps: { campaignId: string; label: string; url: string }[];
  totalPages:     number;
  ftpUploaded:    string[];
  ftpConfigured?: boolean;
  downloadUrl?:   string;
  ftpError?:      string;
  error?:         string;
}

// ── Page index: scan output dir for page-data.json files ──────────────────
// Returns a map of campaignId → list of page info objects found on disk.
// This is the authoritative source for what pages exist — hub pages included.
interface PageInfo {
  remotePath: string;
  pageType:   string;
  isHubPage:  boolean;
  tier:       string;
  campaignId: string;
}

function buildPageIndex(clientDir: string): Map<string, PageInfo[]> {
  const index = new Map<string, PageInfo[]>();
  let entries: string[];
  try { entries = fs.readdirSync(clientDir); } catch { return index; }

  for (const entry of entries) {
    const pdPath = path.join(clientDir, entry, "page-data.json");
    if (!fs.existsSync(pdPath)) continue;
    try {
      const pd = JSON.parse(fs.readFileSync(pdPath, "utf8")) as Record<string, unknown>;
      const cid = (pd.campaignId as string | undefined) ?? "";
      if (!cid) continue;
      const remotePath = (pd.remotePath as string | undefined) ?? `/${entry}/`;
      const pageType   = (pd.pageType   as string | undefined) ?? "cluster";
      const isHubPage  = !!(pd.isHubPage || pd.hubTag === "hub" || pageType === "hub");
      const tier       = (pd.tier as string | undefined) ?? (isHubPage ? "hub" : "priority");
      const info: PageInfo = { remotePath, pageType, isHubPage, tier, campaignId: cid };
      if (!index.has(cid)) index.set(cid, []);
      index.get(cid)!.push(info);
    } catch { /* skip unreadable */ }
  }
  return index;
}

export async function rebuildSitemapForClient(clientSlug: string): Promise<SitemapRebuildResult> {
  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  if (!fs.existsSync(clientDir)) {
    return { success: false, projectSitemap: "", indexSitemap: "", campaignSitemaps: [], totalPages: 0, ftpUploaded: [], error: `No output found for client: ${clientSlug}` };
  }

  const projectPath = path.join(WORKSPACE_ROOT, "config", "projects", `${clientSlug}.json`);
  let domain = "";
  let deployConfig: { enabled?: boolean; host?: string; port?: number; remoteRoot?: string; username?: string; password?: string } = {};
  try {
    const p = JSON.parse(fs.readFileSync(projectPath, "utf8")) as { domain?: string; deploy?: typeof deployConfig };
    domain = (p.domain ?? "").replace(/\/+$/, "");
    deployConfig = p.deploy ?? {};
  } catch { /* fallthrough */ }

  if (!domain) {
    return { success: false, projectSitemap: "", indexSitemap: "", campaignSitemaps: [], totalPages: 0, ftpUploaded: [], error: "Project domain not configured" };
  }

  if (!/^https?:\/\//i.test(domain)) {
    domain = `https://${domain}`;
  } else {
    domain = domain.replace(/^http:\/\//i, "https://");
  }

  // ── Build page index from page-data.json files (includes hub pages) ───────
  const pageIndex = buildPageIndex(clientDir);

  // ── Set of all generated page URLs (dirs with index.html) ─────────────────
  const generated = new Set(
    fs.readdirSync(clientDir)
      .filter((f) => fs.existsSync(path.join(clientDir, f, "index.html")))
      .map((f) => `${domain}/${f}/`)
  );

  // ── Step 1: per-campaign sitemaps ────────────────────────────────────────
  const sessionsDir = path.join(clientDir, "sessions");

  type CampaignEntry = { campaignId: string; label: string; url: string; pageCount: number; groupKey: string; mtime: number };
  const allCandidates: CampaignEntry[] = [];

  if (fs.existsSync(sessionsDir)) {
    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      if (file.startsWith("_")) continue; // skip archived/stale sessions
      const campaignId = file.replace(/\.json$/, "");
      try {
        const session = JSON.parse(
          fs.readFileSync(path.join(sessionsDir, file), "utf8")
        ) as Record<string, unknown>;

        // Build locs from selectedAreaDefs
        const defs = (session.selectedAreaDefs ?? []) as Array<{ remotePath?: string; tier?: string }>;
        const locMap = new Map<string, number>(); // loc → priority

        for (const d of defs) {
          const remote = d.remotePath ?? "";
          if (!remote || remote === "/") continue;
          const loc = `${domain}${remote.startsWith("/") ? remote : "/" + remote}`;
          const priority = d.tier === "hub" ? 1.0 : d.tier === "priority" ? 0.9 : 0.8;
          locMap.set(loc, Math.max(priority, locMap.get(loc) ?? 0));
        }

        // ALSO add pages discovered via page-data.json for this campaign.
        // This ensures hub pages (generated separately) are always included.
        const indexedPages = pageIndex.get(campaignId) ?? [];
        for (const p of indexedPages) {
          const remote = p.remotePath;
          if (!remote || remote === "/") continue;
          const loc = `${domain}${remote.startsWith("/") ? remote : "/" + remote}`;
          const priority = p.isHubPage ? 1.0 : p.tier === "priority" ? 0.9 : 0.8;
          locMap.set(loc, Math.max(priority, locMap.get(loc) ?? 0));
        }

        if (!locMap.size) continue;

        // Filter: only include URLs that actually exist on disk
        const filteredLocs = Array.from(locMap.entries())
          .map(([loc, priority]) => ({ loc, priority }))
          .filter(({ loc }) => generated.has(loc.endsWith("/") ? loc : loc + "/"))
          .sort((a, b) => b.priority - a.priority || a.loc.localeCompare(b.loc));

        if (!filteredLocs.length) continue;

        const campaignXml  = buildUrlsetXml(filteredLocs);
        const campaignFile = `sitemap-${campaignId}.xml`;
        fs.writeFileSync(path.join(clientDir, campaignFile), campaignXml, "utf8");

        const c = session.campaign as { cityName?: string; serviceName?: string } | undefined;
        const sn = (session.serviceName as string | undefined) ?? c?.serviceName ?? "";
        const cn = (session.city       as string | undefined) ?? c?.cityName    ?? "";
        const label    = [cn, sn].filter(Boolean).join(" ") || campaignId;
        const groupKey = label.toLowerCase().replace(/\s+/g, "-") || campaignId;
        const mtime    = fs.statSync(path.join(sessionsDir, file)).mtimeMs;

        allCandidates.push({ campaignId, label, url: `${domain}/${campaignFile}`, pageCount: filteredLocs.length, groupKey, mtime });
      } catch { /* skip corrupt session */ }
    }
  }

  // De-duplicate per city+service group: keep campaign with most pages (ties → most recent)
  const bestByGroup = new Map<string, CampaignEntry>();
  for (const entry of allCandidates) {
    const existing = bestByGroup.get(entry.groupKey);
    if (!existing || entry.pageCount > existing.pageCount ||
        (entry.pageCount === existing.pageCount && entry.mtime > existing.mtime)) {
      bestByGroup.set(entry.groupKey, entry);
    }
  }
  const campaignSitemaps = Array.from(bestByGroup.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ campaignId, label, url }) => ({ campaignId, label, url }));

  // ── Step 2: master project sitemap ──────────────────────────────────────
  // Priority map: derive from both page-data.json files AND sessions
  const remotePriorityMap = new Map<string, number>();

  // From page-data.json (most accurate — knows hub vs cluster)
  for (const pages of pageIndex.values()) {
    for (const p of pages) {
      const loc = `${domain}${p.remotePath.startsWith("/") ? p.remotePath : "/" + p.remotePath}`;
      const priority = p.isHubPage ? 1.0 : p.tier === "priority" ? 0.9 : 0.8;
      if (!remotePriorityMap.has(loc) || priority > (remotePriorityMap.get(loc) ?? 0)) {
        remotePriorityMap.set(loc, priority);
      }
    }
  }

  // Also pick up from sessions (for pages without page-data.json)
  if (fs.existsSync(sessionsDir)) {
    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const session = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), "utf8")) as Record<string, unknown>;
        const defs = (session.selectedAreaDefs ?? []) as Array<{ remotePath?: string; tier?: string }>;
        for (const d of defs) {
          if (!d.remotePath) continue;
          const loc = `${domain}${d.remotePath.startsWith("/") ? d.remotePath : "/" + d.remotePath}`;
          const p   = d.tier === "hub" ? 1.0 : d.tier === "priority" ? 0.9 : 0.8;
          if (!remotePriorityMap.has(loc) || p > (remotePriorityMap.get(loc) ?? 0)) {
            remotePriorityMap.set(loc, p);
          }
        }
      } catch { /* skip */ }
    }
  }

  // ── Primary source: persistent page registry ───────────────────────
  const registryFile = path.join(clientDir, "page-registry.json");

  if (fs.existsSync(registryFile)) {
    try {
      const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
      const pages = Array.isArray(registry.pages) ? registry.pages : [];

      for (const page of pages) {
        if (!page || page.status === "archived") continue;
        if (page.includedInSitemap === false) continue;
        if (!page.url) continue;

        const priority =
          typeof page.priority === "number"
            ? page.priority
            : page.type === "hub"
              ? 1.0
              : page.type === "supporting"
                ? 0.6
              : 0.8;

        if (
          !remotePriorityMap.has(page.url) ||
          priority > (remotePriorityMap.get(page.url) ?? 0)
        ) {
          remotePriorityMap.set(page.url, priority);
        }
      }
    } catch (err) {
      console.error("Failed to load page-registry.json:", err);
    }
  }

  // Build master sitemap from merged registry + discovery sources.
  const finalMasterLocs = Array.from(remotePriorityMap.entries())
    .map(([loc, priority]) => ({ loc, priority }))
    .sort((a, b) => b.priority - a.priority || a.loc.localeCompare(b.loc));

  fs.writeFileSync(path.join(clientDir, "sitemap.xml"), buildUrlsetXml(finalMasterLocs), "utf8");

  // ── Step 3: sitemap-index.xml ────────────────────────────────────────────
  let indexUrl = `${domain}/sitemap.xml`;
  if (campaignSitemaps.length > 0) {
    const allSitemapUrls = [`${domain}/sitemap.xml`, ...campaignSitemaps.map((c) => c.url)];
    fs.writeFileSync(path.join(clientDir, "sitemap-index.xml"), buildSitemapIndexXml(allSitemapUrls), "utf8");
    indexUrl = `${domain}/sitemap-index.xml`;
  }

  // ── Step 4: robots.txt ──────────────────────────────────────────────────
  fs.writeFileSync(path.join(clientDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${indexUrl}\n`, "utf8");

  // ── Step 5: registry ────────────────────────────────────────────────────
  const allRegistryUrls = [
    { label: `${clientSlug} (all pages)`, url: `${domain}/sitemap.xml` },
    ...(campaignSitemaps.length > 0 ? [{ label: `${clientSlug} (sitemap index)`, url: indexUrl }] : []),
    ...campaignSitemaps.map((c) => ({ label: `${clientSlug} — ${c.label}`, url: c.url })),
  ];
  const registry = readRegistry();
  for (const { label, url } of allRegistryUrls) {
    if (!registry.find((e) => e.sitemapUrl === url)) {
      registry.push({ id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, projectName: label, sitemapUrl: url, addedAt: new Date().toISOString() });
    }
  }
  writeRegistry(registry);

  // ── Step 6: FTP upload ───────────────────────────────────────────────────
  const ftpUploaded: string[] = [];
  let   ftpError: string | undefined;
  const ftpConfigured = !!(deployConfig.enabled && deployConfig.host);

  if (ftpConfigured) {
    const ftpUser     = deployConfig.username || process.env.DEPLOY_USERNAME;
    const ftpPassword = deployConfig.password || process.env.DEPLOY_PASSWORD;
    const remoteRoot  = (deployConfig.remoteRoot ?? "/").replace(/\/+$/, "") || "/";

    if (ftpUser && ftpPassword) {
      const filesToUpload: { local: string; remote: string }[] = [
        { local: path.join(clientDir, "sitemap.xml"),       remote: `${remoteRoot}/sitemap.xml` },
        { local: path.join(clientDir, "robots.txt"),        remote: `${remoteRoot}/robots.txt` },
        ...(campaignSitemaps.length > 0
          ? [{ local: path.join(clientDir, "sitemap-index.xml"), remote: `${remoteRoot}/sitemap-index.xml` }]
          : []),
        ...campaignSitemaps.map((c) => ({
          local:  path.join(clientDir, `sitemap-${c.campaignId}.xml`),
          remote: `${remoteRoot}/sitemap-${c.campaignId}.xml`,
        })),
      ];

      const client = new ftp.Client(30000);
      try {
        await client.access({ host: deployConfig.host, port: deployConfig.port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });
        for (const { local, remote } of filesToUpload) {
          if (fs.existsSync(local)) {
            await client.uploadFrom(local, remote);
            ftpUploaded.push(path.basename(remote));
          }
        }
      } catch (err) {
        ftpError = String(err instanceof Error ? err.message : err);
      } finally {
        client.close();
      }
    } else {
      ftpError = "FTP credentials missing — set DEPLOY_USERNAME / DEPLOY_PASSWORD env vars or enter them in Stage 1";
    }
  }

  return {
    success:         true,
    projectSitemap:  `${domain}/sitemap.xml`,
    indexSitemap:    indexUrl,
    campaignSitemaps,
    totalPages:      finalMasterLocs.length,
    ftpUploaded,
    ftpError,
    ftpConfigured,
    downloadUrl:     `/api/sitemap/download/${clientSlug}`,
  };
}

router.post("/sitemap/rebuild", async (req, res) => {
  const { clientSlug } = req.body as { clientSlug?: string };
  if (!clientSlug) {
    res.status(400).json({ error: "clientSlug is required" });
    return;
  }
  const result = await rebuildSitemapForClient(clientSlug);
  if (result.error) {
    res.status(result.totalPages === 0 && result.error.includes("No output") ? 404 : 400).json({ error: result.error });
    return;
  }
  res.json(result);
});

// ── Sitemap status ────────────────────────────────────────────────────────────
router.get("/sitemap/status/:slug", (req, res) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.json({ generated: false, totalUrls: 0, files: [] });
    return;
  }

  const xmlFiles = fs.readdirSync(clientDir).filter(
    (f) => (f.endsWith(".xml") && f.includes("sitemap")) || f === "robots.txt"
  );
  if (xmlFiles.length === 0) {
    res.json({ generated: false, totalUrls: 0, files: [] });
    return;
  }

  // Count URLs in the master sitemap
  let totalUrls = 0;
  const masterPath = path.join(clientDir, "sitemap.xml");
  if (fs.existsSync(masterPath)) {
    const content = fs.readFileSync(masterPath, "utf8");
    totalUrls = (content.match(/<loc>/g) ?? []).length;
  }

  // Last built = newest mtime among xml files
  let lastBuilt: string | undefined;
  for (const f of xmlFiles) {
    try {
      const mt = fs.statSync(path.join(clientDir, f)).mtime.toISOString();
      if (!lastBuilt || mt > lastBuilt) lastBuilt = mt;
    } catch { /* skip */ }
  }

  // Per-campaign breakdown using page index
  const pageIndex = buildPageIndex(clientDir);
  const campaignsFile = path.join(WORKSPACE_ROOT, "config", "campaigns", `${slug}.json`);
  let campaignConfigs: Array<{ id: string; serviceName?: string; city?: string; cityName?: string }> = [];
  try {
    if (fs.existsSync(campaignsFile)) {
      campaignConfigs = JSON.parse(fs.readFileSync(campaignsFile, "utf8"));
    }
  } catch { /* skip */ }

  const campaigns = Array.from(pageIndex.entries()).map(([campaignId, pages]) => {
    const hubPage = pages.find((p) => p.isHubPage);
    const clusterPages = pages.filter((p) => !p.isHubPage);
    const cfg = campaignConfigs.find((c) => c.id === campaignId);
    const sn = cfg?.serviceName ?? "";
    const cn = cfg?.city ?? cfg?.cityName ?? "";
    const label = [cn, sn].filter(Boolean).join(" ") || campaignId;
    const sitemapFile = `sitemap-${campaignId}.xml`;
    const sitemapPath = path.join(clientDir, sitemapFile);
    let urlCount = 0;
    if (fs.existsSync(sitemapPath)) {
      try { urlCount = (fs.readFileSync(sitemapPath, "utf8").match(/<loc>/g) ?? []).length; } catch { /* skip */ }
    }
    return {
      campaignId,
      label,
      hubIncluded:   !!hubPage,
      hubPath:       hubPage?.remotePath ?? null,
      clusterCount:  clusterPages.length,
      totalPages:    pages.length,
      urlCount,
      sitemapFile:   fs.existsSync(sitemapPath) ? sitemapFile : null,
      hostedSitemapPath: fs.existsSync(sitemapPath) ? `/api/sitemaps/${slug}/${sitemapFile}` : null,
    };
  });

  res.json({
    generated: true,
    totalUrls,
    lastBuilt,
    files: xmlFiles,
    campaigns,
    hostedPaths: {
      sitemap:      `/api/sitemaps/${slug}/sitemap.xml`,
      sitemapIndex: xmlFiles.includes("sitemap-index.xml") ? `/api/sitemaps/${slug}/sitemap-index.xml` : null,
      robots:       xmlFiles.includes("robots.txt") ? `/api/sitemaps/${slug}/robots.txt` : null,
    },
  });
});

// ── Sitemap ZIP download ─────────────────────────────────────────────────────
router.get("/sitemap/download/:slug", (req, res) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: "No output found for this project" });
    return;
  }
  const sitemapFiles = fs.readdirSync(clientDir).filter(
    (f) => (f.endsWith(".xml") && f.includes("sitemap")) || f === "robots.txt"
  );
  if (sitemapFiles.length === 0) {
    res.status(404).json({ error: "No sitemap files found — rebuild first" });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const archiver = require("archiver") as typeof import("archiver");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}-sitemaps.zip"`);

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("error", (err) => { console.error("ZIP error:", err); res.end(); });
  archive.pipe(res);

  for (const file of sitemapFiles) {
    const fullPath = path.join(clientDir, file);
    if (fs.existsSync(fullPath)) archive.file(fullPath, { name: file });
  }
  archive.finalize();
});

// ── Sitemap validation ────────────────────────────────────────────────────────
// GET /api/sitemap/validate/:slug — regression check: bare slugs, hub, dupes, domain
router.get("/sitemap/validate/:slug", (req, res) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) { res.status(404).json({ error: "No output" }); return; }

  const projectPath = path.join(WORKSPACE_ROOT, "config", "projects", `${slug}.json`);
  let domain = "";
  try {
    const p = JSON.parse(fs.readFileSync(projectPath, "utf8")) as { domain?: string };
    domain = (p.domain ?? "").replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(domain)) domain = `https://${domain}`;
  } catch { /* skip */ }

  const masterPath = path.join(clientDir, "sitemap.xml");
  if (!fs.existsSync(masterPath)) { res.json({ pass: false, error: "No sitemap.xml — rebuild first" }); return; }

  const masterXml = fs.readFileSync(masterPath, "utf8");
  const masterUrls = (masterXml.match(/<loc>([^<]+)<\/loc>/g) ?? [])
    .map((l) => l.replace(/<\/?loc>/g, ""));

  const serviceSlugRe = /^https?:\/\/[^/]+\/([a-z0-9-]+-[a-z0-9-]+)\//;
  const bareUrls = masterUrls.filter((u) => {
    const slug = u.replace(/^https?:\/\/[^/]+\//, "").replace(/\/$/, "");
    // Bare: single word or hyphenated name without a service prefix segment
    return !/^(web-design|local-seo|affordable-web-design|seo|plumbing|roofing|electrician)/.test(slug);
  });
  const wrongDomain = domain ? masterUrls.filter((u) => !u.startsWith(domain)) : [];
  const dupes = masterUrls.filter((u, i) => masterUrls.indexOf(u) !== i);

  const sessionsDir = path.join(clientDir, "sessions");
  type CampaignCheck = { campaignId: string; label: string; hubIncluded: boolean; urlCount: number; pass: boolean };
  const campaignChecks: CampaignCheck[] = [];

  if (fs.existsSync(sessionsDir)) {
    const campaignsConfig = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "config", "campaigns", `${slug}.json`), "utf8")) as Array<{ id: string; serviceName?: string; city?: string }>; }
      catch { return [] as Array<{ id: string; serviceName?: string; city?: string }>; }
    })();
    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      const campaignId = file.replace(/\.json$/, "");
      const smPath = path.join(clientDir, `sitemap-${campaignId}.xml`);
      if (!fs.existsSync(smPath)) continue;
      const smXml = fs.readFileSync(smPath, "utf8");
      const smUrls = (smXml.match(/<loc>([^<]+)<\/loc>/g) ?? []).map((l) => l.replace(/<\/?loc>/g, ""));
      const cfg = campaignsConfig.find((c) => c.id === campaignId);
      const label = cfg ? `${cfg.city ?? ""} ${cfg.serviceName ?? ""}`.trim() : campaignId;
      // Hub check: look for a page-data.json with isHubPage in this campaign
      const pageIdx = buildPageIndex(clientDir);
      const pages = pageIdx.get(campaignId) ?? [];
      const hubIncluded = pages.some((p) => p.isHubPage);
      campaignChecks.push({ campaignId, label, hubIncluded, urlCount: smUrls.length, pass: hubIncluded && smUrls.length > 0 });
    }
  }

  const allPass = bareUrls.length === 0 && wrongDomain.length === 0 && dupes.length === 0 &&
    campaignChecks.every((c) => c.pass);

  res.json({
    pass: allPass,
    master: {
      totalUrls: masterUrls.length,
      bareSlugCount: bareUrls.length,
      bareSlugExamples: bareUrls.slice(0, 5),
      wrongDomainCount: wrongDomain.length,
      duplicateCount: dupes.length,
    },
    campaigns: campaignChecks,
  });
});

// ─── Page deployment ──────────────────────────────────────────────────────────

const PAGE_SKIP_DIRS = new Set(["assets", "sessions", "uploads"]);
const PAGE_SKIP_FILES = new Set([
  "sitemap.xml", "sitemap-index.xml", "robots.txt", "proof-log.json",
  "index-tracking.json", "indexing-status.json", "keyword-tracking.json",
  "selected-area-defs.json", "selected-areas.json", "deferred-areas.json",
  "session.json",
]);

function scanLocalPages(clientDir: string): Array<{ slug: string; htmlPath: string }> {
  if (!fs.existsSync(clientDir)) return [];
  return fs.readdirSync(clientDir).filter((entry) => {
    if (PAGE_SKIP_DIRS.has(entry) || PAGE_SKIP_FILES.has(entry)) return false;
    if (entry.startsWith("sitemap-")) return false;
    const full = path.join(clientDir, entry);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "index.html"));
  }).map((slug) => ({ slug, htmlPath: path.join(clientDir, slug, "index.html") }));
}

/** Patch image src in HTML: replace API serve paths with live absolute domain URLs.
 *  Images are namespaced per client project to prevent cross-project filename collisions.
 *  Handles two source patterns that can appear in generated HTML:
 *  1. /api/images/serve/{slug}/{slot}            — set by rollout when deploy was not enabled
 *  2. /assets/{slot}.jpg                          — root-relative path from templates
 *  3. {domain}/assets/{slot}.jpg (old, un-namespaced) — previously deployed pages
 *  Replaces with: {domain}/assets/{clientSlug}/{slot}.jpg
 */
function patchImageSrcs(html: string, clientSlug: string, domain: string): string {
  const domainClean = domain.replace(/\/+$/, "");
  const base = `${domainClean}/assets/${clientSlug}`;
  for (const slot of ["hero", "support", "trust", "conversion"]) {
    const liveUrl = `${base}/${slot}.jpg`;
    // Pattern 1: root-relative API serve route
    const apiPattern = `/api/images/serve/${clientSlug}/${slot}`;
    html = html.split(`${apiPattern}"`).join(`${liveUrl}"`);
    html = html.split(`${apiPattern}'`).join(`${liveUrl}'`);
    html = html.split(`${apiPattern} `).join(`${liveUrl} `);
    // Pattern 2: root-relative /assets/{slot}.jpg template default
    html = html.split(`"/assets/${slot}.jpg"`).join(`"${liveUrl}"`);
    html = html.split(`'/assets/${slot}.jpg'`).join(`'${liveUrl}'`);
    // Pattern 3: old un-namespaced absolute URL (migration — previous deploys used /assets/{slot}.jpg)
    const oldAbsolute = `${domainClean}/assets/${slot}.jpg`;
    html = html.split(`"${oldAbsolute}"`).join(`"${liveUrl}"`);
    html = html.split(`'${oldAbsolute}'`).join(`'${liveUrl}'`);
  }
  return html;
}

// ── Background deploy job store ───────────────────────────────────────────────
interface DeployJob {
  status:         "running" | "done" | "error";
  phase:          string;
  total:          number;
  done:           number;
  uploaded:       string[];
  assetsUploaded: string[];
  failed:         Array<{ slug: string; error: string }>;
  error?:         string;
  startedAt:      string;
  finishedAt?:    string;
}
const _deployJobs = new Map<string, DeployJob>();

async function runDeployJob(
  jobId: string,
  deploy: { host: string; port?: number; remoteRoot?: string },
  domain: string,
  clientSlug: string,
  clientDir: string,
): Promise<void> {
  const job = _deployJobs.get(jobId)!;
  const remoteRoot = (deploy.remoteRoot ?? "/").replace(/\/+$/, "") || "/";
  const pages      = scanLocalPages(clientDir);
  job.total  = pages.length;
  job.phase  = "connecting";

  const ftpUser     = process.env["DEPLOY_USERNAME"]!;
  const ftpPassword = process.env["DEPLOY_PASSWORD"]!;
  const client      = new ftp.Client(60000);

  try {
    await client.access({ host: deploy.host, port: deploy.port ?? 21, user: ftpUser, password: ftpPassword, secure: true, secureOptions: { rejectUnauthorized: false } });

    // ── 1. Upload project images ────────────────────────────────────────
    job.phase = "assets";
    const assetsDir = path.join(clientDir, "assets");
    if (fs.existsSync(assetsDir)) {
      const remoteAssetsDir = `${remoteRoot}/assets/${clientSlug}`.replace(/\/+/g, "/");
      await client.ensureDir(remoteAssetsDir);
      for (const imgFile of fs.readdirSync(assetsDir)) {
        if (!/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(imgFile)) continue;
        const localPath  = path.join(assetsDir, imgFile);
        const remotePath = `${remoteAssetsDir}/${imgFile}`;
        try {
          await client.uploadFrom(localPath, remotePath);
          job.assetsUploaded.push(imgFile);
        } catch (err) {
          job.failed.push({ slug: `assets/${imgFile}`, error: String(err instanceof Error ? err.message : err) });
        }
      }
    }

    // ── 2. Upload shared /assets referenced by generated HTML ─────────────
    job.phase = "assets";
    const assetRefs = new Set<string>();

    for (const { htmlPath } of pages) {
      try {
        const html = fs.readFileSync(htmlPath, "utf8");
        const re = /["']\/assets\/([^"']+)["']/g;
        let m: RegExpExecArray | null;

        while ((m = re.exec(html)) !== null) {
          if (m[1]) assetRefs.add(m[1]);
        }
      } catch {
        /* skip unreadable html */
      }
    }

    for (const rel of assetRefs) {
      try {
        const localAsset = path.join(WORKSPACE_ROOT, "assets", rel);

        if (!fs.existsSync(localAsset)) continue;
        if (!fs.statSync(localAsset).isFile()) continue;

        const remoteAsset = `${remoteRoot}/assets/${rel}`.replace(/\/+/g, "/");
        const remoteAssetDir = path.posix.dirname(remoteAsset);

        await client.ensureDir(remoteAssetDir);
        await client.uploadFrom(localAsset, remoteAsset);

        job.assetsUploaded++;
      } catch (err) {
        job.failed.push({
          slug: `asset:${rel}`,
          error: String(err instanceof Error ? err.message : err)
        });
      }
    }

    // ── 2. Upload each page's index.html ──────────────────────────────
    job.phase = "pages";
    for (const { slug, htmlPath } of pages) {
      const remoteDir  = `${remoteRoot}/${slug}`.replace(/\/+/g, "/");
      const remotePath = `${remoteDir}/index.html`;
      try {
        let html = fs.readFileSync(htmlPath, "utf8");
        if (domain) html = patchImageSrcs(html, clientSlug, domain);
        const tmpPath = `${htmlPath}.deploy.tmp`;
        fs.writeFileSync(tmpPath, html, "utf8");
        await client.ensureDir(remoteDir);
        await client.uploadFrom(tmpPath, remotePath);
        fs.unlinkSync(tmpPath);
        job.uploaded.push(slug);
      } catch (err) {
        job.failed.push({ slug, error: String(err instanceof Error ? err.message : err) });
      }
      job.done++;
    }

    job.status     = "done";
    job.phase      = "complete";
    job.finishedAt = new Date().toISOString();
  } catch (err) {
    job.status     = "error";
    job.phase      = "failed";
    job.error      = String(err instanceof Error ? err.message : err);
    job.finishedAt = new Date().toISOString();
  } finally {
    client.close();
    // Evict old completed jobs after 30 min
    setTimeout(() => { _deployJobs.delete(jobId); }, 30 * 60 * 1000);
  }
}

/** POST /api/pages/deploy — starts a background FTP upload job, returns { jobId } immediately */
router.post("/pages/deploy", async (req, res) => {
  const { clientSlug } = req.body as { clientSlug?: string };
  if (!clientSlug || !/^[a-z0-9_-]+$/.test(clientSlug)) {
    res.status(400).json({ error: "clientSlug required" }); return;
  }

  const clientDir = path.join(OUTPUT_DIR, clientSlug);
  if (!fs.existsSync(clientDir)) { res.status(404).json({ error: "No output for this slug" }); return; }

  const projectPath = path.join(WORKSPACE_ROOT, "config", "projects", `${clientSlug}.json`);
  let project: { deploy?: { enabled?: boolean; host?: string; port?: number; remoteRoot?: string }; domain?: string } = {};
  try { project = JSON.parse(fs.readFileSync(projectPath, "utf8")); } catch { /**/ }

  const deploy = project.deploy;
  if (!deploy?.enabled || !deploy.host) {
    res.status(400).json({ error: "FTP deploy not enabled — set deploy.enabled=true and deploy.host in project config" }); return;
  }
  if (!process.env["DEPLOY_USERNAME"] || !process.env["DEPLOY_PASSWORD"]) {
    res.status(400).json({ error: "FTP credentials missing — set DEPLOY_USERNAME / DEPLOY_PASSWORD env vars" }); return;
  }

  const pages      = scanLocalPages(clientDir);
  const jobId      = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const domain     = (project.domain ?? "").replace(/\/+$/, "");
  const job: DeployJob = {
    status: "running", phase: "connecting",
    total: pages.length, done: 0,
    uploaded: [], assetsUploaded: [], failed: [],
    startedAt: new Date().toISOString(),
  };
  _deployJobs.set(jobId, job);

  // Fire-and-forget — responds before FTP starts so the proxy doesn't time out
  void runDeployJob(jobId, deploy as { host: string; port?: number; remoteRoot?: string }, domain, clientSlug, clientDir);

  res.json({ jobId, status: "started", totalPages: pages.length });
});

/** GET /api/pages/deploy/status/:jobId — poll progress of a background deploy job */
router.get("/pages/deploy/status/:jobId", (req, res) => {
  const job = _deployJobs.get(req.params["jobId"] ?? "");
  if (!job) { res.status(404).json({ error: "Job not found or expired" }); return; }
  res.json({
    status:         job.status,
    phase:          job.phase,
    total:          job.total,
    done:           job.done,
    uploadedCount:  job.uploaded.length,
    assetsUploaded: job.assetsUploaded,
    failedCount:    job.failed.length,
    failed:         job.failed,
    error:          job.error,
    startedAt:      job.startedAt,
    finishedAt:     job.finishedAt,
  });
});

/** GET /api/assets/legacy-check?clientSlug=...
 *  Checks for old un-namespaced generic image files on the live server that may have been
 *  left behind from a previous deploy.  Reports existence and whether any live page still
 *  references them.  NEVER deletes anything automatically.
 */
router.get("/assets/legacy-check", async (req, res) => {
  const { clientSlug } = req.query as { clientSlug?: string };
  if (!clientSlug || !/^[a-z0-9_-]+$/.test(clientSlug)) {
    res.status(400).json({ error: "clientSlug query param required" });
    return;
  }

  const projectPath = path.join(WORKSPACE_ROOT, "config", "projects", `${clientSlug}.json`);
  if (!fs.existsSync(projectPath)) { res.status(404).json({ error: "Project not found" }); return; }

  let project: { domain?: string } = {};
  try { project = JSON.parse(fs.readFileSync(projectPath, "utf8")); } catch { /**/ }

  const domain = (project.domain ?? "").replace(/\/+$/, "");
  if (!domain) { res.status(400).json({ error: "Project has no domain configured" }); return; }

  const LEGACY_SLOTS = ["hero", "support", "trust", "conversion"] as const;
  const TIMEOUT_MS = 8000;

  // ── Step 1: probe each old generic file for existence on the live server ──
  const existence: Record<string, boolean> = {};
  await Promise.all(
    LEGACY_SLOTS.map(async (slot) => {
      const url = `${domain}/assets/${slot}.jpg`;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        const r = await fetch(url, { method: "HEAD", signal: ctrl.signal });
        clearTimeout(timer);
        existence[slot] = r.status === 200;
      } catch {
        existence[slot] = false;
      }
    })
  );

  const existingSlots = LEGACY_SLOTS.filter((s) => existence[s]);

  // ── Step 2: if any legacy files exist, scan live pages for references ──────
  const referencedBy: Record<string, string[]> = Object.fromEntries(LEGACY_SLOTS.map((s) => [s, []]));

  if (existingSlots.length > 0) {
    // Fetch the sitemap to get all live page URLs
    const sitemapUrl = `${domain}/sitemap.xml`;
    let pageUrls: string[] = [];
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const r = await fetch(sitemapUrl, { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const xml = await r.text();
        pageUrls = (xml.match(/<loc>([^<]+)<\/loc>/g) ?? []).map((l) => l.replace(/<\/?loc>/g, ""));
      }
    } catch { /* sitemap not available — no page scan */ }

    // Scan each live page's HTML for old generic paths
    await Promise.all(
      pageUrls.map(async (pageUrl) => {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
          const r = await fetch(pageUrl, { signal: ctrl.signal });
          clearTimeout(timer);
          if (!r.ok) return;
          const html = await r.text();
          for (const slot of existingSlots) {
            const oldAbs = `${domain}/assets/${slot}.jpg`;
            const oldRel = `/assets/${slot}.jpg`;
            if (html.includes(oldAbs) || html.includes(oldRel)) {
              referencedBy[slot].push(pageUrl);
            }
          }
        } catch { /* skip unreachable page */ }
      })
    );
  }

  const report = LEGACY_SLOTS.map((slot) => ({
    file: `/assets/${slot}.jpg`,
    fullUrl: `${domain}/assets/${slot}.jpg`,
    exists: existence[slot],
    referenced: referencedBy[slot].length > 0,
    referencedByPages: referencedBy[slot],
  }));

  const anyExist = report.some((r) => r.exists);
  const anyReferenced = report.some((r) => r.referenced);
  const safeToRemove = report.filter((r) => r.exists && !r.referenced);

  res.json({
    clientSlug,
    domain,
    report,
    summary: {
      anyExist,
      anyReferenced,
      safeToRemoveCount: safeToRemove.length,
      safeToRemove: safeToRemove.map((r) => r.file),
    },
    note: "No files are deleted automatically. Review this report and remove files manually if desired.",
  });
});

router.get("/pages/status/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || !/^[a-z0-9_-]+$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const clientDir = path.join(OUTPUT_DIR, slug);
  const sitemapPath = path.join(clientDir, "sitemap.xml");
  if (!fs.existsSync(sitemapPath)) { res.status(404).json({ error: "No sitemap.xml — rebuild first" }); return; }

  const xml = fs.readFileSync(sitemapPath, "utf8");
  const urls = (xml.match(/<loc>([^<]+)<\/loc>/g) ?? []).map((l) => l.replace(/<\/?loc>/g, ""));

  const localPages = scanLocalPages(clientDir);
  const localSlugs = new Set(localPages.map((p) => p.slug));

  const results: Array<{ url: string; status: number | null; local: boolean }> = [];
  for (const url of urls) {
    const pageSlug = url.replace(/^https?:\/\/[^/]+\//, "").replace(/\/+$/, "");
    const hasLocal = localSlugs.has(pageSlug);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
      clearTimeout(timer);
      results.push({ url, status: r.status, local: hasLocal });
    } catch {
      results.push({ url, status: null, local: hasLocal });
    }
  }

  const live200 = results.filter((r) => r.status === 200).length;
  const live404 = results.filter((r) => r.status !== 200).length;

  res.json({
    totalUrls: urls.length,
    live200,
    live404,
    allLive: live404 === 0,
    results,
  });
});

export default router;
