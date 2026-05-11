/**
 * brandImport.ts
 *
 * GET  /api/brand-import/:slug           — load saved brand profile
 * POST /api/brand-import/:slug           — run import from URL { url }
 * PUT  /api/brand-import/:slug           — save / update brand profile
 * POST /api/brand-import/:slug/apply     — apply approved profile to project config
 */

import { Router } from "express";
import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importBrandFromUrl, type BrandProfile } from "../../../../../src/generator/brandImporter.js";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function profilePath(slug: string): string {
  return path.join(PROJECTS_DIR, slug, "brand-profile.json");
}

function loadProfile(slug: string): BrandProfile | null {
  const p = profilePath(slug);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as BrandProfile; }
  catch { return null; }
}

function saveProfile(slug: string, profile: BrandProfile): void {
  const dir = path.join(PROJECTS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(profilePath(slug), JSON.stringify(profile, null, 2), "utf8");
}

function loadProjectConfig(slug: string): Record<string, unknown> | null {
  const p = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
}

function saveProjectConfig(slug: string, cfg: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(PROJECTS_DIR, `${slug}.json`),
    JSON.stringify(cfg, null, 2),
    "utf8",
  );
}

// ── GET — load saved profile ───────────────────────────────────────────────────

router.get("/brand-import/:slug", (req, res) => {
  const { slug } = req.params;
  const profile  = loadProfile(slug);
  if (!profile) {
    res.status(404).json({ error: "No brand profile found for this project." });
    return;
  }
  res.json(profile);
});

// ── POST — run import ─────────────────────────────────────────────────────────

router.post("/brand-import/:slug", async (req, res) => {
  const { slug } = req.params;
  const { url }  = req.body as { url?: string };

  if (!url || typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    const profile = await importBrandFromUrl(url.trim());
    saveProfile(slug, profile);
    res.json(profile);
  } catch (e) {
    req.log.error({ err: e }, "brand-import failed");
    res.status(422).json({ error: (e as Error).message });
  }
});

// ── PUT — save edited profile ─────────────────────────────────────────────────

router.put("/brand-import/:slug", (req, res) => {
  const { slug } = req.params;
  const updates  = req.body as Partial<BrandProfile>;

  const existing = loadProfile(slug);
  if (!existing) {
    res.status(404).json({ error: "No brand profile found. Run an import first." });
    return;
  }

  const merged: BrandProfile = { ...existing, ...updates };
  saveProfile(slug, merged);
  res.json(merged);
});

// ── POST /apply — write approved profile into project config ──────────────────

router.post("/brand-import/:slug/apply", (req, res) => {
  const { slug } = req.params;
  const profile  = loadProfile(slug);

  if (!profile) {
    res.status(404).json({ error: "No brand profile found." });
    return;
  }
  if (!profile.approved) {
    res.status(409).json({ error: "Brand profile has not been approved yet." });
    return;
  }

  const cfg = loadProjectConfig(slug);
  if (!cfg) {
    res.status(404).json({ error: `Project config not found for slug: ${slug}` });
    return;
  }

  // Apply: logo, nav items, contact (only if populated)
  if (profile.logoUrl)   cfg.logoUrl = profile.logoUrl;
  if (profile.navigationLinks.length > 0) cfg.navItems = profile.navigationLinks;
  if (profile.contact.phone)   cfg.phone   = profile.contact.phone;
  if (profile.contact.email)   cfg.email   = profile.contact.email;
  if (profile.contact.address) cfg.businessAddress = profile.contact.address;
  if (profile.businessName)    cfg.businessName    = profile.businessName;

  // Store brand theme reference so renderClusterPage can find it
  cfg.brandProfileApplied = true;

  saveProjectConfig(slug, cfg);
  res.json({ ok: true, message: "Brand profile applied to project config." });
});

// ── GET /pages — list generated pages for this project (hub first) ───────────

interface PageSummary {
  slug:     string;
  tier:     string;
  service:  string;
  location: string;
  previewUrl: string;
}

router.get("/brand-import/:slug/pages", (req, res) => {
  const { slug } = req.params;
  const outputDir = path.join(WORKSPACE_ROOT, "output", slug);

  if (!fs.existsSync(outputDir)) {
    res.json({ pages: [] });
    return;
  }

  const pages: PageSummary[] = [];

  try {
    const dirs = fs.readdirSync(outputDir).filter((d) => {
      const full = path.join(outputDir, d);
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "index.html"));
    });

    for (const dir of dirs) {
      const pdPath = path.join(outputDir, dir, "page-data.json");
      let tier = "cluster";
      let service = "";
      let location = "";
      if (fs.existsSync(pdPath)) {
        try {
          const pd = JSON.parse(fs.readFileSync(pdPath, "utf8"));
          tier     = pd.tier     ?? "cluster";
          service  = pd.service  ?? "";
          location = pd.location ?? "";
        } catch { /* skip */ }
      }
      pages.push({ slug: dir, tier, service, location, previewUrl: `/preview/${slug}/${dir}/` });
    }

    // Hub pages first, then alphabetical
    pages.sort((a, b) => {
      if (a.tier === "hub" && b.tier !== "hub") return -1;
      if (a.tier !== "hub" && b.tier === "hub") return  1;
      return a.slug.localeCompare(b.slug);
    });

    res.json({ pages });
  } catch (e) {
    req.log.error({ err: e }, "brand-import/pages failed");
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
