import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const CAMPAIGNS_DIR  = path.join(WORKSPACE_ROOT, "config", "campaigns");
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");

export interface Campaign {
  id: string;
  projectSlug: string;
  city: string;
  citySlug: string;
  serviceName: string;
  serviceKey: string;
  status: "new" | "in_progress" | "generated" | "deployed";
  currentStage: number;
  createdAt: string;
  updatedAt: string;
  areasSelected: number;
  pagesGenerated: number;
  pagesDeployed: number;
  // Campaign-level industry override — overrides project-level industryType for all
  // pages in this campaign, enabling multi-industry projects (e.g. a web-design agency
  // project that also runs trade service campaigns for clients).
  industryType?: string;
  buyerType?:    "household" | "business" | "landlord-property" | "mixed";
  // Optional fields enriched from session at read-time
  moneyPageUrl?:  string;
  focusKeyword?:  string;
  hubGenerated?:  boolean;
}

/** Read money page fields and hub status from the session file for a campaign (non-fatal). */
function readSessionMoneyPage(slug: string, campaignId: string): { moneyPageUrl: string; focusKeyword: string; hubGenerated: boolean } {
  try {
    const sessionPath = path.join(OUTPUT_DIR, slug, "sessions", `${campaignId}.json`);
    if (!fs.existsSync(sessionPath)) return { moneyPageUrl: "", focusKeyword: "", hubGenerated: false };
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
    const camp = session.campaign as Record<string, string> | undefined;
    // Hub is generated if a hub-tier def exists in selectedAreaDefs
    const defs = (session.selectedAreaDefs ?? []) as Array<{ tier?: string }>;
    const hubGenerated = defs.some((d) => d.tier === "hub");
    return {
      moneyPageUrl: camp?.moneyPageUrl ?? "",
      focusKeyword: camp?.focusKeyword ?? "",
      hubGenerated,
    };
  } catch {
    return { moneyPageUrl: "", focusKeyword: "", hubGenerated: false };
  }
}

function campaignFile(slug: string): string {
  return path.join(CAMPAIGNS_DIR, `${slug}.json`);
}

function readCampaigns(slug: string): Campaign[] {
  const file = campaignFile(slug);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as Campaign[]; }
  catch { return []; }
}

function writeCampaigns(slug: string, campaigns: Campaign[]): void {
  if (!fs.existsSync(CAMPAIGNS_DIR)) fs.mkdirSync(CAMPAIGNS_DIR, { recursive: true });
  fs.writeFileSync(campaignFile(slug), JSON.stringify(campaigns, null, 2));
}

const router = Router();

// GET /api/campaigns/:slug — list all campaigns for a project
router.get("/campaigns/:slug", (req, res) => {
  const { slug } = req.params;
  const campaigns = readCampaigns(slug).map((c) => ({
    ...c,
    ...readSessionMoneyPage(slug, c.id),
  }));
  res.json({ campaigns });
});

// POST /api/campaigns/:slug — create a new campaign
router.post("/campaigns/:slug", (req, res) => {
  const { slug } = req.params;
  const { city, citySlug, serviceName, serviceKey, industryType, buyerType } = req.body as {
    city: string; citySlug: string; serviceName: string; serviceKey: string;
    industryType?: string; buyerType?: "household" | "business" | "landlord-property" | "mixed";
  };

  if (!city || !citySlug || !serviceName || !serviceKey) {
    res.status(400).json({ error: "city, citySlug, serviceName and serviceKey are required" });
    return;
  }

  const now = new Date().toISOString();
  // Normalize both slugs to lowercase with underscores (no spaces/special chars) so the ID is safe as a filename and URL param.
  // Strip leading/trailing hyphens/underscores so the ID always starts with [a-z0-9] (prevents validator rejection).
  const safeCity = citySlug.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '').replace(/^[-_]+|[-_]+$/g, '');
  const safeSvc  = serviceKey.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '').replace(/^[-_]+|[-_]+$/g, '');
  const cityPart = safeCity || "city";
  const svcPart  = safeSvc  || "svc";
  const id = `${cityPart}-${svcPart}-${randomBytes(3).toString("hex")}`;
  const campaign: Campaign = {
    id,
    projectSlug: slug,
    city,
    citySlug,
    serviceName,
    serviceKey,
    status: "new",
    currentStage: 2,
    createdAt: now,
    updatedAt: now,
    areasSelected: 0,
    pagesGenerated: 0,
    pagesDeployed: 0,
    ...(industryType ? { industryType } : {}),
    ...(buyerType    ? { buyerType }    : {}),
  };

  const campaigns = readCampaigns(slug);

  // Prevent duplicate: block same city + service combination.
  // Normalise both serviceKey AND serviceName to catch legacy campaigns where
  // serviceKey was stored inconsistently (e.g. 'webho-ting', 'Local SEO', 'web design').
  const canonicalize = (s: string) =>
    s.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  const normalizedCity    = city.trim().toLowerCase();
  const normalizedSvcKey  = canonicalize(serviceKey);
  const normalizedSvcName = canonicalize(serviceName);
  const duplicate = campaigns.find((c) => {
    if (c.city.trim().toLowerCase() !== normalizedCity) return false;
    return (
      canonicalize(c.serviceKey  ?? "") === normalizedSvcKey ||
      canonicalize(c.serviceName ?? "") === normalizedSvcName
    );
  });
  if (duplicate) {
    res.status(409).json({
      error: `A campaign for "${city} — ${serviceName}" already exists (id: ${duplicate.id}). Delete or resume the existing campaign instead.`,
      existingId: duplicate.id,
    });
    return;
  }

  // Store the canonical serviceKey going forward so future duplicate checks are reliable
  campaign.serviceKey = canonicalize(serviceKey) || canonicalize(serviceName) || svcPart;

  campaigns.unshift(campaign);
  writeCampaigns(slug, campaigns);

  res.status(201).json({ campaign });
});

// PATCH /api/campaigns/:slug/:campaignId — update campaign metadata
router.patch("/campaigns/:slug/:campaignId", (req, res) => {
  const { slug, campaignId } = req.params;
  const updates = req.body as Partial<Campaign>;

  const campaigns = readCampaigns(slug);
  const idx = campaigns.findIndex((c) => c.id === campaignId);
  if (idx === -1) {
    res.status(404).json({ error: `Campaign not found: ${campaignId}` });
    return;
  }

  campaigns[idx] = {
    ...campaigns[idx],
    ...updates,
    id: campaigns[idx].id,
    projectSlug: slug,
    updatedAt: new Date().toISOString(),
  };

  writeCampaigns(slug, campaigns);
  res.json({ campaign: campaigns[idx] });
});

// GET /api/campaigns/:slug/:campaignId/detail — full session detail for the campaign panel
router.get("/campaigns/:slug/:campaignId/detail", (req, res) => {
  const { slug, campaignId } = req.params;
  const sessionPath = path.join(OUTPUT_DIR, slug, "sessions", `${campaignId}.json`);
  if (!fs.existsSync(sessionPath)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  // Read project domain for sitemap URL
  const projectPath = path.join(WORKSPACE_ROOT, "config", "projects", `${slug}.json`);
  let domain = "";
  try { domain = (JSON.parse(fs.readFileSync(projectPath, "utf8")) as { domain?: string }).domain?.replace(/\/+$/, "") ?? ""; } catch { /* ok */ }

  try {
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
    const camp = session.campaign as Record<string, unknown> | undefined;
    const defs = (session.selectedAreaDefs ?? []) as Array<{ tier?: string; area?: string; remotePath?: string }>;
    const clusterDefs = defs.filter((d) => d.tier !== "hub");
    const hubDef = defs.find((d) => d.tier === "hub");
    const sitemapUrl = domain ? `${domain}/sitemap-${campaignId}.xml` : "";
    res.json({
      campaignId,
      city:         camp?.cityName    ?? "",
      serviceName:  camp?.serviceName ?? "",
      serviceKey:   camp?.serviceKey  ?? "",
      moneyPageUrl: camp?.moneyPageUrl ?? "",
      focusKeyword: camp?.focusKeyword ?? "",
      stage:        session.stage ?? 1,
      areasCount:   clusterDefs.length,
      areas:        clusterDefs.map((d) => ({ area: d.area, remotePath: d.remotePath, tier: d.tier })),
      hubGenerated: !!hubDef,
      hubPath:      hubDef?.remotePath ?? "",
      domain,
      sitemapUrl,
    });
  } catch {
    res.status(500).json({ error: "Failed to read session" });
  }
});

// PATCH /api/campaigns/:slug/:campaignId/settings — update money page URL + focus keyword
router.patch("/campaigns/:slug/:campaignId/settings", (req, res) => {
  const { slug, campaignId } = req.params;
  const { moneyPageUrl, focusKeyword } = req.body as { moneyPageUrl?: string; focusKeyword?: string };
  const sessionPath = path.join(OUTPUT_DIR, slug, "sessions", `${campaignId}.json`);
  if (!fs.existsSync(sessionPath)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  try {
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
    (session as any).campaign = {
      ...((session.campaign as object) ?? {}),
      ...(moneyPageUrl !== undefined ? { moneyPageUrl } : {}),
      ...(focusKeyword !== undefined ? { focusKeyword } : {}),
    };
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), "utf8");
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// DELETE /api/campaigns/:slug/:campaignId
router.delete("/campaigns/:slug/:campaignId", (req, res) => {
  const { slug, campaignId } = req.params;
  const campaigns = readCampaigns(slug);
  const filtered = campaigns.filter((c) => c.id !== campaignId);
  if (filtered.length === campaigns.length) {
    res.status(404).json({ error: `Campaign not found: ${campaignId}` });
    return;
  }
  writeCampaigns(slug, filtered);
  res.json({ deleted: true });
});

export default router;
