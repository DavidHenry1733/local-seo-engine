/**
 * Tenant slug resolution — no silent pharmaconnect fallback on pharmacy-facing routes.
 */
import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { getPharmacyProfilePath, getPharmacyProjectConfigPath, PHARMACY_WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export const CLIENT_PORTFOLIO_URL = "/api/admin/master";

export function normalizeTenantSlugInput(raw: unknown): string {
  return safePharmacySlug(String(raw ?? "").trim());
}

function slugCandidates(normalized: string): string[] {
  const compact = normalized.replace(/-/g, "");
  return [...new Set([normalized, compact].filter(Boolean))];
}

function storageExists(slug: string): boolean {
  if (fs.existsSync(getPharmacyProfilePath(slug))) return true;
  if (fs.existsSync(getPharmacyProjectConfigPath(slug))) return true;
  if (fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${slug}.json`))) return true;
  if (fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-asset-workflow", `${slug}.json`))) return true;
  return false;
}

/** Resolve slug to canonical on-disk tenant key (handles dhm-digital → dhmdigital). */
export function resolveTenantProfileSlug(raw: unknown): string | null {
  const normalized = normalizeTenantSlugInput(raw);
  if (!normalized || normalized === "pharmacy") return null;
  for (const candidate of slugCandidates(normalized)) {
    if (storageExists(candidate)) return candidate;
  }
  return null;
}

export function requireTenantSlug(req: Request): string | null {
  const fromQuery = req.query.slug ?? req.params.slug;
  return resolveTenantProfileSlug(fromQuery);
}

export function renderMissingTenantSlugHtml(): string {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><title>Select a pharmacy</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 20px;color:#0f172a}
.card{border:1px solid #e2e8f0;border-radius:14px;padding:28px;background:#fff}
.btn{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:9px;font-weight:800;text-decoration:none;background:#005eb8;color:#fff}
.muted{color:#64748b;font-size:14px}</style></head>
<body><div class="card"><h1>Please select a pharmacy from Client Portfolio</h1>
<p class="muted">This page needs a pharmacy slug. Open Client Portfolio and choose your pharmacy to continue.</p>
<a class="btn" href="${CLIENT_PORTFOLIO_URL}">Open Client Portfolio</a>
</div></body></html>`;
}

export function sendMissingTenantSlug(res: Response): void {
  res.status(400);
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(renderMissingTenantSlugHtml());
}

export function tenantSlugOrRespond(req: Request, res: Response): string | null {
  const slug = requireTenantSlug(req);
  if (!slug) {
    sendMissingTenantSlug(res);
    return null;
  }
  return slug;
}
