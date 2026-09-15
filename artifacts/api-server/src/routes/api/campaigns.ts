import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
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
  const campaigns = readCampaigns(slug).map((c) => {
    const session = readSessionMoneyPage(slug, c.id);

    return {
      ...c,
      moneyPageUrl: session.moneyPageUrl || c.moneyPageUrl || "",
      focusKeyword: session.focusKeyword || c.focusKeyword || "",
      hubGenerated: session.hubGenerated || false,
    };
  });
  res.json({ campaigns });
});

// POST /api/campaigns/:slug — create a new campaign
router.post("/campaigns/:slug", (req, res) => {
  const { slug } = req.params;
  const { city, citySlug, serviceName, serviceKey, industryType, buyerType, focusKeyword } = req.body as {
    city: string; citySlug: string; serviceName: string; serviceKey: string; focusKeyword?: string;
    industryType?: string; buyerType?: "household" | "business" | "landlord-property" | "mixed";
  };

  if (!city || !citySlug || !serviceName || !serviceKey) {
    res.status(400).json({ error: "city, citySlug, serviceName and serviceKey are required" });
    return;
  }

  const now = new Date().toISOString();

  const safeCity = citySlug.toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[-_]+|[-_]+$/g, "");

  const rawSvc = String(serviceKey || serviceName || "").toLowerCase();

  let safeSvc = rawSvc
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const svcCompact = safeSvc.replace(/[^a-z0-9]/g, "");

  if (
    safeSvc.includes("webde-ign") ||
    safeSvc.includes("web-design") ||
    svcCompact.includes("webdesign") ||
    svcCompact.includes("webdeign") ||
    (svcCompact.includes("web") && svcCompact.includes("design"))
  ) {
    safeSvc = "web-design";
  } else if (
    safeSvc.includes("web-hosting") ||
    svcCompact.includes("webhosting") ||
    svcCompact.includes("webhoting") ||
    (svcCompact.includes("web") && (svcCompact.includes("hosting") || svcCompact.includes("hoting")))
  ) {
    safeSvc = "web-hosting";
  } else if (
    safeSvc.includes("local-seo") ||
    svcCompact.includes("localseo") ||
    svcCompact.includes("seo")
  ) {
    safeSvc = "local-seo";
  } else if (
    safeSvc.includes("email-marketing") ||
    svcCompact.includes("emailmarketing") ||
    svcCompact.includes("email")
  ) {
    safeSvc = "email-marketing";
  }

  const canonicalize = (v: string) =>
    String(v || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  const campaigns = readCampaigns(slug);

  // New architecture: duplicate campaigns are blocked by focus keyword/slug only.
  // This allows intent variants for the same core service and town.
  const effectiveFocusKeyword = String(focusKeyword || `${serviceName} ${city}`).trim();
  const normalizedFocusKeyword = canonicalize(effectiveFocusKeyword);
  const proposedSlug = canonicalize(effectiveFocusKeyword.replace(/_/g, "-"));

  const duplicate = campaigns.find((c) => {
    const existingKwRaw = String(c.focusKeyword || `${c.serviceName} ${c.city}`).trim();
    const existingKw = canonicalize(existingKwRaw);
    const existingSlug = canonicalize(existingKwRaw.replace(/_/g, "-"));

    return existingKw === normalizedFocusKeyword || existingSlug === proposedSlug;
  });

  if (duplicate) {
    res.status(409).json({
      error: `A campaign for "${effectiveFocusKeyword}" already exists (id: ${duplicate.id}). Delete or resume the existing campaign instead.`,
      existingId: duplicate.id,
    });
    return;
  }

  const cityPart = safeCity || "city";
  const svcPart = safeSvc || "svc";
  const id = `${cityPart}-${svcPart}-${randomBytes(3).toString("hex")}`;

  const campaign: Campaign = {
    id,
    projectSlug: slug,
    city,
    citySlug,
    serviceName,
    serviceKey: safeSvc,
    focusKeyword: effectiveFocusKeyword,
    status: "new",
    currentStage: 2,
    createdAt: now,
    updatedAt: now,
    areasSelected: 0,
    pagesGenerated: 0,
    pagesDeployed: 0,
    ...(industryType ? { industryType } : {}),
    ...(buyerType ? { buyerType } : {}),
  };

  campaigns.push(campaign);
  writeCampaigns(slug, campaigns);

  res.status(201).json({ campaign });
});

// GET /api/campaigns/:slug/:campaignId/detail — full session detail for the campaign panel
router.get("/campaigns/:slug/:campaignId/detail", (req, res) => {
  const { slug, campaignId } = req.params;
  const sessionPath = path.join(OUTPUT_DIR, slug, "sessions", `${campaignId}.json`);
  if (!fs.existsSync(sessionPath)) {
    const campaigns = readCampaigns(slug);
    const campaign = campaigns.find((c) => c.id === campaignId);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const projectPath = path.join(WORKSPACE_ROOT, "config", "projects", `${slug}.json`);
    let domain = "";
    try {
      domain = (JSON.parse(fs.readFileSync(projectPath, "utf8")) as { domain?: string }).domain?.replace(/\/+$/, "") ?? "";
    } catch { /* ok */ }

    const serviceSlug = (campaign.serviceKey || campaign.serviceName || "")
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const citySlug = (campaign.city || campaign.citySlug || "")
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const hubPath = `/${serviceSlug}-${citySlug}/`;

    res.json({
      campaignId,
      city: campaign.city,
      serviceName: campaign.serviceName,
      serviceKey: campaign.serviceKey,
      moneyPageUrl: "",
      focusKeyword: `${campaign.serviceName} ${campaign.city}`,
      stage: campaign.currentStage ?? 8,
      areasCount: campaign.areasSelected ?? 0,
      areas: [],
      hubGenerated: (campaign.pagesGenerated ?? 0) > 0,
      hubPath,
      domain,
      sitemapUrl: domain ? `${domain}/sitemap-${campaignId}.xml` : "",
      legacyFallback: true
    });
    return;
  }
  // Read project domain for sitemap URL
  const projectPath = path.join(WORKSPACE_ROOT, "config", "projects", `${slug}.json`);
  let domain = "";
  try { domain = (JSON.parse(fs.readFileSync(projectPath, "utf8")) as { domain?: string }).domain?.replace(/\/+$/, "") ?? ""; } catch { /* ok */ }

  try {
    const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
    const camp = session.campaign as Record<string, unknown> | undefined;

    // Canonical campaign config is the source of truth for service identity.
    // Session files may contain semantic/keyword labels or legacy malformed service keys.
    const campaigns = readCampaigns(slug);
    const campaign = campaigns.find((c) => c.id === campaignId);

    const canonicalServiceKey = campaign?.serviceKey || camp?.serviceKey || "";
    const canonicalServiceName = campaign?.serviceName || camp?.serviceName || "";

    const defs = (session.selectedAreaDefs ?? []) as Array<{ tier?: string; area?: string; remotePath?: string }>;
    const clusterDefs = defs.filter((d) => d.tier !== "hub");
    const hubDef = defs.find((d) => d.tier === "hub");
    const sitemapUrl = domain ? `${domain}/sitemap-${campaignId}.xml` : "";
    res.json({
      campaignId,
      city:         camp?.cityName    ?? "",
      serviceName:  canonicalServiceName,
      serviceKey:   canonicalServiceKey,
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

  const sessionPath = path.join(OUTPUT_DIR, slug, "sessions", `${campaignId}.json`);
  if (fs.existsSync(sessionPath)) {
    try { fs.unlinkSync(sessionPath); } catch { /* non-fatal */ }
  }

  res.json({ deleted: true });
});

export default router;
