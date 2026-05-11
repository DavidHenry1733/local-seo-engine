/**
 * providerProfiles.ts
 *
 * CRUD API for per-campaign customer service provider profiles.
 *
 * Profiles are stored at:
 *   config/projects/<slug>/providers/<serviceKey>.json
 *
 * Routes:
 *   GET    /api/provider-profile/:slug               — list all profiles
 *   GET    /api/provider-profile/:slug/:serviceKey   — get single profile
 *   PUT    /api/provider-profile/:slug/:serviceKey   — create / full update
 *   PATCH  /api/provider-profile/:slug/:serviceKey/approve — toggle approved
 *   DELETE /api/provider-profile/:slug/:serviceKey   — delete
 *
 * loadProviderProfile() is exported for use by publishGate and prePublishQa.
 */

import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CustomerProviderProfile } from "../../../../../src/generator/customerProfile";
import { schemaTypesForIndustry } from "../../../../../src/generator/customerProfile";

const __filename     = fileURLToPath(import.meta.url);
const __dirname      = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ── Path helpers ──────────────────────────────────────────────────────────────

function providerDir(slug: string): string {
  return path.join(PROJECTS_DIR, slug, "providers");
}

function safeKey(serviceKey: string): string {
  return serviceKey.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

function providerFilePath(slug: string, serviceKey: string): string {
  return path.join(providerDir(slug), `${safeKey(serviceKey)}.json`);
}

// ── File I/O ─────────────────────────────────────────────────────────────────

function readProfileRaw(slug: string, serviceKey: string): CustomerProviderProfile | null {
  const p = providerFilePath(slug, serviceKey);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as CustomerProviderProfile; }
  catch { return null; }
}

function writeProfileRaw(slug: string, serviceKey: string, profile: CustomerProviderProfile): void {
  const dir = providerDir(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(providerFilePath(slug, serviceKey), JSON.stringify(profile, null, 2), "utf8");
}

/**
 * Load a customer provider profile by project slug + service key.
 * Returns undefined if not found or malformed — callers should treat
 * undefined as "no approved profile exists".
 */
export function loadProviderProfile(
  slug: string,
  serviceKey: string
): CustomerProviderProfile | undefined {
  return readProfileRaw(slug, serviceKey) ?? undefined;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/provider-profile/:slug — list all profiles for a project
router.get("/provider-profile/:slug", (req, res) => {
  const { slug } = req.params;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const dir = providerDir(slug);
  if (!fs.existsSync(dir)) { res.json({ profiles: [] }); return; }

  const profiles: Array<{ serviceKey: string } & CustomerProviderProfile> = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as CustomerProviderProfile;
      profiles.push({ serviceKey: file.replace(/\.json$/, ""), ...p });
    } catch { /* skip malformed */ }
  }
  res.json({ profiles });
});

// GET /api/provider-profile/:slug/:serviceKey — get single profile
router.get("/provider-profile/:slug/:serviceKey", (req, res) => {
  const { slug, serviceKey } = req.params;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const profile = readProfileRaw(slug, serviceKey);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json({ profile });
});

// PUT /api/provider-profile/:slug/:serviceKey — create or full update
router.put("/provider-profile/:slug/:serviceKey", (req, res) => {
  const { slug, serviceKey } = req.params;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const body = req.body as Partial<CustomerProviderProfile>;
  if (!body.businessName || typeof body.businessName !== "string") {
    res.status(400).json({ error: "businessName is required" }); return;
  }
  if (!body.industry || typeof body.industry !== "string") {
    res.status(400).json({ error: "industry is required" }); return;
  }

  const now      = new Date().toISOString();
  const existing = readProfileRaw(slug, serviceKey);

  const profile: CustomerProviderProfile = {
    businessName: body.businessName.trim(),
    industry:     body.industry.trim(),
    schemaTypes:  (Array.isArray(body.schemaTypes) && body.schemaTypes.length > 0)
                    ? body.schemaTypes
                    : schemaTypesForIndustry(body.industry.trim()),
    phone:        body.phone?.trim() || undefined,
    email:        body.email?.trim() || undefined,
    url:          body.url?.trim()   || undefined,
    address:      body.address       || undefined,
    approved:     typeof body.approved === "boolean" ? body.approved : false,
    createdAt:    existing?.createdAt ?? now,
    updatedAt:    now,
  };

  writeProfileRaw(slug, serviceKey, profile);
  res.json({ profile });
});

// PATCH /api/provider-profile/:slug/:serviceKey/approve — set approved flag
router.patch("/provider-profile/:slug/:serviceKey/approve", (req, res) => {
  const { slug, serviceKey } = req.params;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const profile = readProfileRaw(slug, serviceKey);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const newApproved     = typeof req.body?.approved === "boolean" ? req.body.approved : !profile.approved;
  profile.approved      = newApproved;
  profile.updatedAt     = new Date().toISOString();

  writeProfileRaw(slug, serviceKey, profile);
  res.json({ profile });
});

// DELETE /api/provider-profile/:slug/:serviceKey — remove profile
router.delete("/provider-profile/:slug/:serviceKey", (req, res) => {
  const { slug, serviceKey } = req.params;
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }

  const p = providerFilePath(slug, serviceKey);
  if (!fs.existsSync(p)) { res.status(404).json({ error: "Profile not found" }); return; }
  fs.unlinkSync(p);
  res.json({ ok: true });
});

export default router;
