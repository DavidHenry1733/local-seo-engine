/**
 * linkAudit.ts
 *
 * GET  /api/link-audit/:slug        — run audit and return report
 * POST /api/link-audit/:slug/repair — fix violations in-place and re-upload
 */

import { Router }         from "express";
import fs                 from "node:fs";
import path               from "node:path";
import { fileURLToPath }  from "node:url";
import * as ftp           from "basic-ftp";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────

type IssueType =
  | "ROOT_LINK"
  | "BARE_SLUG"
  | "CROSS_CAMPAIGN"
  | "WRONG_HUB"
  | "HUB_WRONG_CLUSTER"
  | "MISSING_MONEY_PAGE"
  | "MISSING_MONEY_PAGE_LINK"
  | "WRONG_MONEY_PAGE_HREF"
  | "CLUSTER_HAS_MONEY_BAND";

interface LinkIssue {
  page:     string;   // relative path like "web-design-barnsley/index.html"
  type:     IssueType;
  found:    string;   // what was found
  expected: string;   // what it should be
}

interface AuditStats {
  campaigns:            number;
  pagesChecked:         number;
  rootLinks:            number;
  wrongHub:             number;
  crossCampaign:        number;
  bareSlug:             number;
  nonExistent:          number;
  missingMoneyPage:     number;
  wrongMoneyPageHref:   number;
  missingMoneyPageLink: number;
  clusterHasMoneyBand:  number;
}

interface AuditReport {
  runAt:   string;
  slug:    string;
  stats:   AuditStats;
  issues:  LinkIssue[];
}

interface CampaignDef {
  hubSlug:       string;        // e.g. "web-design-barnsley"
  clusterSlugs:  Set<string>;   // e.g. {"web-design-hoyland", ...}
  moneyPageUrl:  string;
  servicePrefix: string;        // e.g. "web-design"
  serviceName:   string;        // e.g. "Web Design" (for copy)
  cityName:      string;        // e.g. "Barnsley" (for copy)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function remoteToDirName(remotePath: string): string {
  // "/web-design-barnsley/" → "web-design-barnsley"
  return remotePath.replace(/^\/+|\/+$/g, "");
}

/** Extract all href values from an HTML string */
function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const re = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

/**
 * Extract hrefs from resource-card anchor tags only.
 * These are the structured navigation links that must never point to "/" — 
 * body text hrefs to "/" are legitimate company homepage links and are ignored.
 */
function extractResourceCardHrefs(html: string): string[] {
  const hrefs: string[] = [];
  // Match <a class="resource-card..." href="..."> or <a href="..." class="resource-card...">
  const re = /<a\b[^>]*class=["'][^"']*resource-card[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>|<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*resource-card[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[1] ?? m[2]);
  }
  return hrefs;
}

/**
 * Check if HTML contains an actual money-page band *element*
 * (not just a CSS rule that references the class).
 * Uses findMoneyBandElementStart so CSS definitions are not false-positives.
 */
function hasMoneypageBand(html: string): boolean {
  return findMoneyBandElementStart(html) !== -1;
}

/**
 * Find the byte-offset of the actual money-page-band HTML element
 * (not the CSS rule). Looks for class="money-page-band" or class='money-page-band'
 * inside a tag opening context, ignoring the CSS definition.
 */
function findMoneyBandElementStart(html: string): number {
  // Match  class="money-page-band"  or  class='money-page-band'
  // inside an actual opening tag (after < or whitespace)
  const re = /class=["']money-page-band["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    // Walk back to find the opening '<'
    let i = m.index;
    while (i >= 0 && html[i] !== "<") i--;
    if (i >= 0) return i;   // found opening tag
  }
  return -1;
}

/** Check if the money-page band contains an anchor link */
function hasMoneypageBandLink(html: string): boolean {
  const bandStart = findMoneyBandElementStart(html);
  if (bandStart === -1) return false;
  // Grab enough content to cover the band element
  const snippet = html.slice(bandStart, bandStart + 1000);
  return /<a\b[^>]*href=["'][^"']+["']/i.test(snippet);
}

/** Extract the href from the anchor inside the money-page band */
function extractMoneyPageBandHref(html: string): string {
  const bandStart = findMoneyBandElementStart(html);
  if (bandStart === -1) return "";
  const snippet = html.slice(bandStart, bandStart + 1000);
  const m = snippet.match(/<a\b[^>]*href=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

/** Build the canonical money-page band HTML for a hub page */
function buildMoneyPageBand(
  moneyPageUrl: string,
  serviceName: string,
  cityName: string,
): string {
  const svc  = serviceName || moneyPageUrl.replace(/\/$/, "").split("/").pop()?.replace(/-/g, " ") || "our service";
  const city = cityName || "your area";
  return (
    `\n<section class="money-page-band">` +
    `\n  <div class="container">` +
    `\n    <p>Looking for <strong>${svc} in ${city}</strong> tailored to local businesses?` +
    ` Visit our <a href="${moneyPageUrl}">dedicated service page</a>.</p>` +
    `\n  </div>` +
    `\n</section>`
  );
}

// ── Campaign map builder ───────────────────────────────────────────────────

/**
 * Reads all session files and builds a canonical campaign map.
 * When the same cluster appears in multiple campaign sessions (stale data),
 * we use the cluster's own HTML as the ground truth — whichever hub the
 * cluster page actually links to is its real hub.
 */
export function buildCampaignMap(
  clientDir: string,
  _slug: string
): Map<string, CampaignDef> {
  const sessionsDir = path.join(clientDir, "sessions");

  // Step 1: gather all candidate hub → cluster mappings from sessions.
  // Also track moneyPageUrl, servicePrefix, serviceName, cityName per hub.
  interface HubCandidate {
    hubSlug:       string;
    clusterSlugs:  Set<string>;
    moneyPageUrl:  string;
    servicePrefix: string;
    serviceName:   string;
    cityName:      string;
  }
  const candidates = new Map<string, HubCandidate>();

  if (fs.existsSync(sessionsDir)) {
    for (const file of fs.readdirSync(sessionsDir)) {
      if (!file.endsWith(".json")) continue;
      let session: Record<string, unknown>;
      try {
        session = JSON.parse(
          fs.readFileSync(path.join(sessionsDir, file), "utf8")
        ) as Record<string, unknown>;
      } catch { continue; }

      const defs = (
        session.selectedAreaDefs as Array<Record<string, unknown>> | undefined
      ) ?? [];
      if (!defs.length) continue;

      const campaign     = (session.campaign ?? {}) as Record<string, unknown>;
      const moneyPageUrl = (campaign.moneyPageUrl as string) || "";
      const serviceName  = (campaign.serviceName  as string) || "";
      const cityName     = (campaign.cityName     as string) || "";

      let hubSlug      = "";
      const clusterSet = new Set<string>();
      let servicePrefix = "";

      for (const def of defs) {
        const tier       = (def.tier as string) || "";
        const remotePath = (def.remotePath as string) || "";
        if (!remotePath) continue;
        const dirName = remoteToDirName(remotePath);
        if (tier === "hub") {
          hubSlug       = dirName;
          const parts   = dirName.split("-");
          servicePrefix = parts.slice(0, -1).join("-");
        } else {
          clusterSet.add(dirName);
        }
      }

      // For sessions without a hub-tier def (hubless rollouts), infer the hub
      // slug from the campaign city + service key.
      if (!hubSlug) {
        const camObj   = (session.campaign ?? {}) as Record<string, unknown>;
        const cityName = ((camObj.cityName ?? camObj.city ?? "") as string)
          .toLowerCase().replace(/\s+/g, "-");
        const svcKey   = ((camObj.serviceKey ?? "") as string)
          .toLowerCase().replace(/[\s_]+/g, "-");
        if (cityName && svcKey) {
          const inferred = `${svcKey}-${cityName}`;
          // Only use if the directory actually exists
          if (fs.existsSync(path.join(clientDir, inferred))) {
            hubSlug       = inferred;
            const parts   = inferred.split("-");
            servicePrefix = parts.slice(0, -1).join("-");
          }
        }
      }

      if (!hubSlug) continue;

      const existing = candidates.get(hubSlug);
      if (existing) {
        for (const s of clusterSet) existing.clusterSlugs.add(s);
        // Update service/city names if we have them and they were missing
        if (!existing.serviceName && serviceName) existing.serviceName = serviceName;
        if (!existing.cityName    && cityName)    existing.cityName    = cityName;
        if (!existing.moneyPageUrl && moneyPageUrl) existing.moneyPageUrl = moneyPageUrl;
      } else {
        candidates.set(hubSlug, {
          hubSlug, clusterSlugs: clusterSet, moneyPageUrl, servicePrefix,
          serviceName, cityName,
        });
      }
    }
  }

  // Step 2: find clusters claimed by more than one hub (ambiguous assignments).
  // Build clusterSlug → Set<hubSlug> map.
  const clusterCandidates = new Map<string, Set<string>>();
  for (const [hubSlug, cand] of candidates) {
    for (const clusterSlug of cand.clusterSlugs) {
      const set = clusterCandidates.get(clusterSlug) ?? new Set<string>();
      set.add(hubSlug);
      clusterCandidates.set(clusterSlug, set);
    }
  }

  // Step 3: resolve ambiguous clusters by reading the cluster HTML and seeing
  // which hub it actually links to.
  const resolvedClusterHub = new Map<string, string>(); // clusterSlug → canonical hubSlug

  for (const [clusterSlug, hubSet] of clusterCandidates) {
    if (hubSet.size === 1) {
      // Unambiguous
      resolvedClusterHub.set(clusterSlug, [...hubSet][0]);
      continue;
    }
    // Ambiguous — read the cluster HTML
    const htmlPath = path.join(clientDir, clusterSlug, "index.html");
    if (!fs.existsSync(htmlPath)) {
      // Fallback: pick the hub that most recently claimed it (arbitrary but deterministic)
      resolvedClusterHub.set(clusterSlug, [...hubSet].sort()[0]);
      continue;
    }
    const html  = fs.readFileSync(htmlPath, "utf8");
    const hrefs = extractHrefs(html);
    let resolved = "";
    for (const href of hrefs) {
      const clean = href.replace(/^\/|\/$/g, "");
      if (hubSet.has(clean)) { resolved = clean; break; }
    }
    resolvedClusterHub.set(
      clusterSlug,
      resolved || [...hubSet].sort()[0],  // fallback if no hub link found
    );
  }

  // Step 4: build final campaign map with only canonically-assigned clusters.
  const campaignMap = new Map<string, CampaignDef>();
  for (const [hubSlug, cand] of candidates) {
    const resolvedClusters = new Set<string>();
    for (const cs of cand.clusterSlugs) {
      if (resolvedClusterHub.get(cs) === hubSlug) {
        resolvedClusters.add(cs);
      }
    }
    // Derive city name from hubSlug if not available from session data
    const inferredCity = cand.cityName ||
      (hubSlug.split("-").pop() ?? "").replace(/^./, c => c.toUpperCase());

    campaignMap.set(hubSlug, {
      hubSlug,
      clusterSlugs:  resolvedClusters,
      moneyPageUrl:  cand.moneyPageUrl,
      servicePrefix: cand.servicePrefix,
      serviceName:   cand.serviceName,
      cityName:      inferredCity,
    });
  }

  return campaignMap;
}

// ── Core audit engine ──────────────────────────────────────────────────────

export type { AuditReport, LinkIssue, CampaignDef, AuditStats };

export function runAudit(slug: string): AuditReport {
  const clientDir = path.join(OUTPUT_DIR, slug);
  const campaignMap = buildCampaignMap(clientDir, slug);

  // Build reverse lookup: clusterSlug → hubSlug
  const clusterToHub = new Map<string, string>();
  for (const [hubSlug, def] of campaignMap) {
    for (const cluster of def.clusterSlugs) {
      clusterToHub.set(cluster, hubSlug);
    }
  }

  // All known page slugs (hub + clusters)
  const allKnownSlugs = new Set<string>();
  for (const [hubSlug, def] of campaignMap) {
    allKnownSlugs.add(hubSlug);
    for (const c of def.clusterSlugs) allKnownSlugs.add(c);
  }

  const issues: LinkIssue[] = [];
  let pagesChecked = 0;

  // Iterate over every campaign
  for (const [hubSlug, def] of campaignMap) {
    // ── Check hub page ──────────────────────────────────────────────────
    const hubDir  = path.join(clientDir, hubSlug);
    const hubHtml = path.join(hubDir, "index.html");
    if (fs.existsSync(hubHtml)) {
      pagesChecked++;
      const html = fs.readFileSync(hubHtml, "utf8");
      const pageRel = `${hubSlug}/index.html`;

      // Money-page band checks (only when moneyPageUrl is configured)
      if (def.moneyPageUrl) {
        if (!hasMoneypageBand(html)) {
          // Band is entirely absent
          issues.push({
            page:     pageRel,
            type:     "MISSING_MONEY_PAGE",
            found:    "(no money-page-band section)",
            expected: `<section class="money-page-band"> linking to ${def.moneyPageUrl}`,
          });
        } else if (!hasMoneypageBandLink(html)) {
          // Band exists but has no anchor link inside it
          issues.push({
            page:     pageRel,
            type:     "MISSING_MONEY_PAGE_LINK",
            found:    "money-page-band present but contains no <a> link",
            expected: `<a href="${def.moneyPageUrl}"> inside money-page-band`,
          });
        } else {
          // Band exists with a link — check the href is correct
          const bandHref = extractMoneyPageBandHref(html);
          if (bandHref !== def.moneyPageUrl) {
            issues.push({
              page:     pageRel,
              type:     "WRONG_MONEY_PAGE_HREF",
              found:    bandHref || "(empty href)",
              expected: def.moneyPageUrl,
            });
          }
        }
      }

      // ROOT_LINK on hub: check resource-card hrefs for "/" (same as cluster check)
      const hubCardHrefs = extractResourceCardHrefs(html);
      for (const href of hubCardHrefs) {
        if (href === "/" || href.replace(/^\/|\/$/g, "") === "") {
          issues.push({
            page:     pageRel,
            type:     "ROOT_LINK",
            found:    href,
            expected: `/${hubSlug}/`,
          });
        }
      }

      // BARE_SLUG on hub: resource-card links that are missing the service prefix
      // e.g. /royston/ when it should be /web-design-royston/
      for (const href of hubCardHrefs) {
        const clean = href.replace(/^\/|\/$/g, "");
        if (!clean || href === "/") continue;
        if (href.startsWith("http") || href.startsWith("#") || href.includes(".")) continue;
        const expectedWithPrefix = `${def.servicePrefix}-${clean}`;
        if (
          !clean.startsWith(def.servicePrefix + "-") &&
          def.clusterSlugs.has(expectedWithPrefix)
        ) {
          issues.push({
            page:     pageRel,
            type:     "BARE_SLUG",
            found:    href,
            expected: `/${expectedWithPrefix}/`,
          });
        }
      }

      // Check all hrefs for wrong-cluster and cross-campaign links
      const hrefs = extractHrefs(html);
      for (const href of hrefs) {
        // Strip trailing slash, leading slash → dirName
        const clean = href.replace(/^\/|\/$/g, "");
        if (!clean) continue;

        // Skip external links, anchors, mailto, assets
        if (href.startsWith("http") || href.startsWith("#") ||
            href.startsWith("mailto") || href.includes(".")) continue;

        // ROOT_LINK and BARE_SLUG on hub already handled above via resource-card check
        if (def.clusterSlugs.has(clean)) continue; // correct cluster
        if (clean === hubSlug) continue; // self-link is fine

        // Is it a known cluster from another campaign?
        const belongsTo = clusterToHub.get(clean);
        if (belongsTo && belongsTo !== hubSlug) {
          issues.push({
            page:     pageRel,
            type:     "HUB_WRONG_CLUSTER",
            found:    `/${clean}/`,
            expected: `cluster should belong to /${hubSlug}/`,
          });
        }
      }
    }

    // ── Check each cluster page ─────────────────────────────────────────
    for (const clusterSlug of def.clusterSlugs) {
      const clusterDir  = path.join(clientDir, clusterSlug);
      const clusterHtml = path.join(clusterDir, "index.html");
      if (!fs.existsSync(clusterHtml)) continue;

      pagesChecked++;
      const html    = fs.readFileSync(clusterHtml, "utf8");
      const pageRel = `${clusterSlug}/index.html`;

      // Cluster pages must NOT have a money-page-band (hub-only element)
      if (hasMoneypageBand(html)) {
        issues.push({
          page:     pageRel,
          type:     "CLUSTER_HAS_MONEY_BAND",
          found:    "money-page-band present on cluster page",
          expected: "no money-page-band on cluster pages",
        });
      }

      // ROOT_LINK: only check resource-card hrefs — body text "/" links are
      // legitimate company homepage references and must not be flagged.
      const cardHrefs = extractResourceCardHrefs(html);
      for (const href of cardHrefs) {
        if (href === "/" || href.replace(/^\/|\/$/g, "") === "") {
          issues.push({
            page:     pageRel,
            type:     "ROOT_LINK",
            found:    href,
            expected: `/${hubSlug}/`,
          });
        }
      }

      // All other structural checks use all internal hrefs.
      const hrefs = extractHrefs(html);

      for (const href of hrefs) {
        // Skip external, anchors, mailto, assets
        if (href.startsWith("http") || href.startsWith("#") ||
            href.startsWith("mailto") || href.includes(".")) continue;

        const clean = href.replace(/^\/|\/$/g, "");

        // Skip root "/" — already handled above via resource-card check
        if (href === "/" || clean === "") continue;

        // BARE_SLUG: a slug without the service prefix that looks like a city name
        // e.g. "/hoyland/" when it should be "/web-design-hoyland/"
        // Heuristic: it's a known city within a cluster slug of this campaign,
        // with the service prefix stripped
        const expectedWithPrefix = `${def.servicePrefix}-${clean}`;
        if (
          !clean.startsWith(def.servicePrefix + "-") &&
          def.clusterSlugs.has(expectedWithPrefix)
        ) {
          issues.push({
            page:     pageRel,
            type:     "BARE_SLUG",
            found:    href,
            expected: `/${expectedWithPrefix}/`,
          });
          continue;
        }

        // WRONG_HUB: cluster links to a hub that is NOT its own hub
        if (campaignMap.has(clean) && clean !== hubSlug) {
          // It's a hub, but the wrong one
          const isXCampaign = !def.clusterSlugs.has(clean) &&
                              !def.servicePrefix.split("-").every(part =>
                                clean.startsWith(part));
          if (isXCampaign) {
            issues.push({
              page:     pageRel,
              type:     "CROSS_CAMPAIGN",
              found:    `/${clean}/`,
              expected: `/${hubSlug}/`,
            });
          } else {
            issues.push({
              page:     pageRel,
              type:     "WRONG_HUB",
              found:    `/${clean}/`,
              expected: `/${hubSlug}/`,
            });
          }
          continue;
        }

        // CROSS_CAMPAIGN: cluster links to a cluster from another campaign
        const targetHub = clusterToHub.get(clean);
        if (targetHub && targetHub !== hubSlug) {
          issues.push({
            page:     pageRel,
            type:     "CROSS_CAMPAIGN",
            found:    `/${clean}/`,
            expected: `cluster of /${hubSlug}/`,
          });
        }
      }
    }
  }

  const stats: AuditStats = {
    campaigns:            campaignMap.size,
    pagesChecked,
    rootLinks:            issues.filter(i => i.type === "ROOT_LINK").length,
    wrongHub:             issues.filter(i => i.type === "WRONG_HUB").length,
    crossCampaign:        issues.filter(i => i.type === "CROSS_CAMPAIGN").length,
    bareSlug:             issues.filter(i => i.type === "BARE_SLUG").length,
    nonExistent:          issues.filter(i => i.type === "NONEXISTENT" as IssueType).length,
    missingMoneyPage:     issues.filter(i => i.type === "MISSING_MONEY_PAGE").length,
    wrongMoneyPageHref:   issues.filter(i => i.type === "WRONG_MONEY_PAGE_HREF").length,
    missingMoneyPageLink: issues.filter(i => i.type === "MISSING_MONEY_PAGE_LINK").length,
    clusterHasMoneyBand:  issues.filter(i => i.type === "CLUSTER_HAS_MONEY_BAND").length,
  };

  return { runAt: new Date().toISOString(), slug, stats, issues };
}

// ── FTP helpers (reused from rollout pattern) ──────────────────────────────

interface FtpCreds {
  host: string;
  user: string;
  password: string;
}

function getFtpCreds(clientDir: string, slug: string): FtpCreds | null {
  const projectFile = path.join(
    WORKSPACE_ROOT, "config", "projects", `${slug}.json`
  );
  if (!fs.existsSync(projectFile)) return null;
  const proj   = JSON.parse(fs.readFileSync(projectFile, "utf8")) as Record<string, unknown>;
  // FTP credentials may live in `deploy` (primary) or legacy `ftp` block
  const deploy = (proj.deploy ?? {}) as Record<string, unknown>;
  const ftpBlk = (proj.ftp   ?? {}) as Record<string, unknown>;
  const host     = ((deploy.host     ?? ftpBlk.host     ?? "") as string);
  const user     = (process.env.DEPLOY_USERNAME ?? deploy.username ?? ftpBlk.username ?? "") as string;
  const password = (process.env.DEPLOY_PASSWORD ?? deploy.password ?? ftpBlk.password ?? "") as string;
  if (!host || !user || !password) return null;
  return { host, user, password };
}

async function ftpUploadFile(
  client: ftp.Client,
  localPath: string,
  remotePath: string
): Promise<void> {
  const remoteDir = path.posix.dirname(remotePath);
  await client.ensureDir(remoteDir);
  await client.uploadFrom(localPath, remotePath);
}

function getRemotePath(
  slug: string,
  clientDir: string,
  localHtmlPath: string,
  projectFile: string
): string | null {
  // Derive remote path: localHtmlPath relative to clientDir, then map
  // e.g. output/rotherham-proof/web-design-barnsley/index.html
  //   → /web-design-barnsley/index.html (relative to FTP root)
  if (!fs.existsSync(projectFile)) return null;
  const proj    = JSON.parse(fs.readFileSync(projectFile, "utf8")) as Record<string, unknown>;
  const deploy  = (proj.deploy ?? {}) as Record<string, unknown>;
  const ftpBlk  = (proj.ftp   ?? {}) as Record<string, unknown>;
  const remoteRoot = ((deploy.remoteRoot ?? ftpBlk.remoteRoot ?? "/") as string).replace(/\/?$/, "/");
  const relToOutput = path.relative(clientDir, localHtmlPath).replace(/\\/g, "/");
  return remoteRoot + relToOutput;
}

/** Human-readable note for money-page HTTP status codes */
function moneyPageStatusNote(status: number): string {
  if (status >= 200 && status < 400) return "";
  const notes: Record<number, string> = {
    403: "Forbidden — server is blocking automated requests; page may be accessible in a browser",
    404: "Not Found — the money page URL does not exist",
    405: "Method Not Allowed — server rejected HEAD; consider using GET",
    429: "Too Many Requests — rate limited",
    500: "Internal Server Error — server-side issue",
    503: "Service Unavailable — server is temporarily down or overloaded",
    508: "Insufficient Resource (LiteSpeed) — hosting plan has hit a CPU/memory/connection limit; this is a server-side resource issue, not a broken link. The page may load in a browser when server load is lower.",
  };
  return notes[status] ?? `HTTP ${status} — unexpected server response`;
}

// ── Route: GET /api/link-audit/:slug ──────────────────────────────────────

router.get("/link-audit/:slug", (req, res) => {
  const { slug } = req.params;
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: `Project '${slug}' not found` });
    return;
  }
  try {
    const report = runAudit(slug);
    res.json(report);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── Route: POST /api/link-audit/:slug/repair ──────────────────────────────

router.post("/link-audit/:slug/repair", async (req, res) => {
  const { slug } = req.params;
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: `Project '${slug}' not found` });
    return;
  }

  const projectFile = path.join(PROJECTS_DIR, `${slug}.json`);

  // Run audit first
  let report: AuditReport;
  try {
    report = runAudit(slug);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Audit failed: ${msg}` });
    return;
  }

  if (report.issues.length === 0) {
    res.json({ pagesFixed: 0, pagesUploaded: 0, message: "No issues to repair." });
    return;
  }

  // Group issues by page
  const pageIssues = new Map<string, LinkIssue[]>();
  for (const iss of report.issues) {
    const arr = pageIssues.get(iss.page) ?? [];
    arr.push(iss);
    pageIssues.set(iss.page, arr);
  }

  const fixedPages: string[] = [];
  const campaignMap = buildCampaignMap(clientDir, slug);

  for (const [pageRel, issues] of pageIssues) {
    const localHtmlPath = path.join(clientDir, pageRel);
    if (!fs.existsSync(localHtmlPath)) continue;

    let html = fs.readFileSync(localHtmlPath, "utf8");
    let changed = false;

    for (const iss of issues) {
      if (iss.type === "ROOT_LINK") {
        // Only fix resource-card root links — body text "/" links are intentional
        // company homepage references and must be left untouched.
        const expected = iss.expected; // e.g. "/local-seo-barnsley/"
        // Replace href="/" only when it appears inside a resource-card <a> tag.
        const before = html;
        html = html.replace(
          /(<a\b[^>]*class=["'][^"']*resource-card[^"']*["'][^>]*)\bhref=["']\/["']([^>]*>)/gi,
          `$1href="${expected}"$2`,
        );
        html = html.replace(
          /(<a\b[^>]*)\bhref=["']\/["']([^>]*class=["'][^"']*resource-card[^"']*["'][^>]*>)/gi,
          `$1href="${expected}"$2`,
        );
        if (html !== before) changed = true;
      } else if (iss.type === "BARE_SLUG") {
        // Replace bare slug href with prefixed href
        const found    = iss.found;    // e.g. "/hoyland/"
        const expected = iss.expected; // e.g. "/web-design-hoyland/"
        const re = new RegExp(`href=["']${found.replace(/\//g, "\\/")}["']`, "g");
        const newVal = `href="${expected}"`;
        if (re.test(html)) {
          html = html.replace(re, newVal);
          changed = true;
        }
      } else if (iss.type === "WRONG_HUB" || iss.type === "CROSS_CAMPAIGN") {
        const found    = iss.found;    // e.g. "/web-design-mexborough/"
        const expected = iss.expected; // e.g. "/web-design-doncaster/"
        // Only replace if expected looks like a hub slug (not a description)
        if (expected.startsWith("/") && expected.endsWith("/")) {
          const re = new RegExp(`href=["']${found.replace(/\//g, "\\/")}["']`, "g");
          const newVal = `href="${expected}"`;
          if (re.test(html)) {
            html = html.replace(re, newVal);
            changed = true;
          }
        }
      } else if (iss.type === "HUB_WRONG_CLUSTER") {
        // Remove the bad link — replace href with "#" as safe fallback
        const found = iss.found;
        const re = new RegExp(`href=["']${found.replace(/\//g, "\\/")}["']`, "g");
        if (re.test(html)) {
          html = html.replace(re, 'href="#"');
          changed = true;
        }
      } else if (iss.type === "MISSING_MONEY_PAGE") {
        // Insert the band after the hero section, or before </main> as fallback
        const pageParts = pageRel.split("/");
        const hubSlug   = pageParts[0];
        const def       = campaignMap.get(hubSlug);
        if (def?.moneyPageUrl) {
          const band = buildMoneyPageBand(def.moneyPageUrl, def.serviceName, def.cityName);
          // Insert after </section> that follows id="hero-section"
          const heroTagIdx = html.search(/id=["']hero-section["']/);
          if (heroTagIdx !== -1) {
            const closeIdx = html.indexOf("</section>", heroTagIdx);
            if (closeIdx !== -1) {
              const at = closeIdx + "</section>".length;
              html = html.slice(0, at) + band + html.slice(at);
              changed = true;
            }
          }
          // Fallback: insert before </main>
          if (!changed && html.includes("</main>")) {
            html = html.replace("</main>", `${band}\n</main>`);
            changed = true;
          }
        }
      } else if (iss.type === "MISSING_MONEY_PAGE_LINK") {
        // Band exists but has no <a> — rewrite paragraph inside the band
        const pageParts = pageRel.split("/");
        const hubSlug   = pageParts[0];
        const def       = campaignMap.get(hubSlug);
        if (def?.moneyPageUrl) {
          // Replace the band's paragraph with one that includes the link
          const band = buildMoneyPageBand(def.moneyPageUrl, def.serviceName, def.cityName);
          const before = html;
          // Replace the entire money-page-band section (section or div variant)
          html = html
            .replace(/<section[^>]*class=["'][^"']*money-page-band[^"']*["'][^>]*>[\s\S]*?<\/section>/i, band)
            .replace(/<div[^>]*class=["'][^"']*money-page-band[^"']*["'][^>]*>[\s\S]*?<\/div>/i, band);
          if (html !== before) changed = true;
        }
      } else if (iss.type === "WRONG_MONEY_PAGE_HREF") {
        // Fix the href inside the money-page band
        if (iss.expected && iss.found) {
          const escFound    = iss.found.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re          = new RegExp(`(<a[^>]*href=["'])${escFound}(["'][^>]*>)`, "gi");
          const before      = html;
          html = html.replace(re, `$1${iss.expected}$2`);
          if (html !== before) changed = true;
        }
      } else if (iss.type === "CLUSTER_HAS_MONEY_BAND") {
        // Remove the money-page-band from cluster pages
        const before = html;
        html = html
          .replace(/<section[^>]*class=["'][^"']*money-page-band[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, "")
          .replace(/<div[^>]*class=["'][^"']*money-page-band[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");
        if (html !== before) changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(localHtmlPath, html, "utf8");
      fixedPages.push(pageRel);
    }
  }

  // Re-upload fixed pages via FTP
  let pagesUploaded = 0;
  const creds = getFtpCreds(clientDir, slug);
  if (creds && fixedPages.length > 0) {
    const client = new ftp.Client();
    client.ftp.verbose = false;
    try {
      await client.access({
        host:     creds.host,
        user:     creds.user,
        password: creds.password,
        secure:   true,
        secureOptions: { rejectUnauthorized: false },
      });
      for (const pageRel of fixedPages) {
        const localPath  = path.join(clientDir, pageRel);
        const remotePath = getRemotePath(slug, clientDir, localPath, projectFile);
        if (!remotePath) continue;
        try {
          await ftpUploadFile(client, localPath, remotePath);
          pagesUploaded++;
        } catch {
          // Continue uploading others even if one fails
        }
      }
    } catch {
      // FTP connection failure — report pages fixed but 0 uploaded
    } finally {
      client.close();
    }
  }

  res.json({
    pagesFixed:    fixedPages.length,
    pagesUploaded,
    fixedPages,
  });
});

// ── Route: GET /api/link-audit/:slug/money-page-live ──────────────────────
// Fetches each live hub page and checks money-page band presence, href
// correctness, and whether the money page URL itself returns HTTP 200.

interface LiveMoneyPageResult {
  hubSlug:             string;
  hubLiveUrl:          string;
  moneyPageUrl:        string;
  liveStatus:          "ok" | "missing_band" | "missing_link" | "wrong_href" | "fetch_error";
  foundHref:           string;
  moneyPageHttpStatus: number | null;  // HTTP status of money page URL itself
  moneyPageStatusOk:   boolean;        // true if 200–399
  moneyPageStatusNote: string;         // human-readable note for non-200 statuses
  error?:              string;
}

router.get("/link-audit/:slug/money-page-live", async (req, res) => {
  const { slug } = req.params;
  const clientDir = path.join(OUTPUT_DIR, slug);
  if (!fs.existsSync(clientDir)) {
    res.status(404).json({ error: `Project '${slug}' not found` });
    return;
  }

  // Load domain from project config
  const projectFile = path.join(PROJECTS_DIR, `${slug}.json`);
  let domain = "";
  if (fs.existsSync(projectFile)) {
    try {
      const proj = JSON.parse(fs.readFileSync(projectFile, "utf8")) as Record<string, unknown>;
      domain = ((proj.domain as string) ?? "").replace(/\/+$/, "");
    } catch { /* ignore */ }
  }

  const campaignMap = buildCampaignMap(clientDir, slug);
  const results: LiveMoneyPageResult[] = [];
  const TIMEOUT_MS = 8000;

  for (const [hubSlug, def] of campaignMap) {
    if (!def.moneyPageUrl) continue;  // only audit hubs that have a configured money page

    const hubLiveUrl = domain
      ? `${domain}/${hubSlug}/`
      : `https://${hubSlug}/`;  // fallback (shouldn't normally be used)

    const result: LiveMoneyPageResult = {
      hubSlug,
      hubLiveUrl,
      moneyPageUrl:        def.moneyPageUrl,
      liveStatus:          "ok",
      foundHref:           "",
      moneyPageHttpStatus: null,
      moneyPageStatusOk:   false,
      moneyPageStatusNote: "",
    };

    // 1. Fetch live hub page HTML
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let hubHtml = "";
      try {
        const resp = await fetch(hubLiveUrl, {
          signal:  controller.signal,
          headers: { "User-Agent": "InboxingProWeb-LinkAudit/1.0" },
        });
        hubHtml = await resp.text();
      } finally {
        clearTimeout(timer);
      }

      if (!hasMoneypageBand(hubHtml)) {
        result.liveStatus = "missing_band";
      } else if (!hasMoneypageBandLink(hubHtml)) {
        result.liveStatus = "missing_link";
      } else {
        const liveHref = extractMoneyPageBandHref(hubHtml);
        result.foundHref = liveHref;
        if (liveHref !== def.moneyPageUrl) {
          result.liveStatus = "wrong_href";
        }
      }
    } catch (err: unknown) {
      result.liveStatus = "fetch_error";
      result.error      = String(err);
    }

    // 2. Check money page URL via HEAD (fallback to GET if HEAD is blocked)
    if (def.moneyPageUrl.startsWith("http")) {
      try {
        const doFetch = async (method: "HEAD" | "GET"): Promise<number> => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
          try {
            const resp = await fetch(def.moneyPageUrl, {
              method,
              signal:  controller.signal,
              headers: { "User-Agent": "Mozilla/5.0 (compatible; InboxingProWeb-LinkAudit/1.0)" },
            });
            return resp.status;
          } finally {
            clearTimeout(timer);
          }
        };

        let status = await doFetch("HEAD");
        // 405 = HEAD not allowed by server — retry with GET
        if (status === 405) status = await doFetch("GET");

        result.moneyPageHttpStatus = status;
        result.moneyPageStatusOk   = status >= 200 && status < 400;
        result.moneyPageStatusNote = moneyPageStatusNote(status);
      } catch {
        result.moneyPageHttpStatus = null;
        result.moneyPageStatusOk   = false;
        result.moneyPageStatusNote = "Request timed out or network error";
      }
    }

    results.push(result);
  }

  const summary = {
    checkedAt:         new Date().toISOString(),
    slug,
    hubsChecked:       results.length,
    passCount:         results.filter(r => r.liveStatus === "ok").length,
    failCount:         results.filter(r => r.liveStatus !== "ok").length,
    moneyPageDownCount: results.filter(r => !r.moneyPageStatusOk).length,
    results,
  };

  res.json(summary);
});

export default router;
