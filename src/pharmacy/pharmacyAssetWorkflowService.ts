/**
 * Asset-first workflow state — brand confirmation, content review, asset approval.
 * UI/workflow layer only; no content generation changes.
 */
import fs from "node:fs";
import path from "node:path";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { resolveVisualExperienceHtmlPath } from "./pharmacyVisualExperience.ts";
import { loadMasterStockImages } from "./pharmacyMasterStockImageService.ts";
import { loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import type { PharmacyCampaignEnriched } from "./pharmacyCampaignControlCentreService.ts";
import {
  detectForeignPharmacyIdentities,
  foreignIdentityDetail,
  htmlMatchesRequestedTenantIdentity,
} from "./pharmacyTenantIdentityIsolation.ts";

export interface ServiceAssetWorkflowState {
  brandImagesConfirmedAt: string | null;
  contentReviewedAt: string | null;
  assetApprovedAt: string | null;
}

export interface AssetWorkflowStore {
  version: 1;
  slug: string;
  updatedAt: string;
  services: Record<string, ServiceAssetWorkflowState>;
}

function tenantKey(slug: string): string {
  return resolveTenantProfileSlug(slug) || String(slug || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function storePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-asset-workflow", `${tenantKey(slug)}.json`);
}

function defaultServiceState(): ServiceAssetWorkflowState {
  return {
    brandImagesConfirmedAt: null,
    contentReviewedAt: null,
    assetApprovedAt: null,
  };
}

export function loadAssetWorkflowStore(slug: string): AssetWorkflowStore {
  const s = tenantKey(slug);
  const file = storePath(s);
  if (!fs.existsSync(file)) {
    return { version: 1, slug: s, updatedAt: new Date().toISOString(), services: {} };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as AssetWorkflowStore;
    return {
      version: 1,
      slug: s,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      services: raw.services || {},
    };
  } catch {
    return { version: 1, slug: s, updatedAt: new Date().toISOString(), services: {} };
  }
}

function saveAssetWorkflowStore(store: AssetWorkflowStore): void {
  const file = storePath(store.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

export function getServiceAssetWorkflow(slug: string, serviceId: string): ServiceAssetWorkflowState {
  const store = loadAssetWorkflowStore(slug);
  return store.services[serviceId] || defaultServiceState();
}

function touchService(slug: string, serviceId: string): AssetWorkflowStore {
  const store = loadAssetWorkflowStore(slug);
  if (!store.services[serviceId]) store.services[serviceId] = defaultServiceState();
  return store;
}

export function confirmBrandAndImages(slug: string, serviceId: string): ServiceAssetWorkflowState {
  const store = touchService(slug, serviceId);
  store.services[serviceId].brandImagesConfirmedAt = new Date().toISOString();
  saveAssetWorkflowStore(store);
  return store.services[serviceId];
}

export function markContentReviewed(slug: string, serviceId: string): ServiceAssetWorkflowState {
  const store = touchService(slug, serviceId);
  store.services[serviceId].contentReviewedAt = new Date().toISOString();
  saveAssetWorkflowStore(store);
  return store.services[serviceId];
}

export function approveServiceAsset(slug: string, serviceId: string): ServiceAssetWorkflowState {
  const store = touchService(slug, serviceId);
  store.services[serviceId].assetApprovedAt = new Date().toISOString();
  if (!store.services[serviceId].contentReviewedAt) {
    store.services[serviceId].contentReviewedAt = store.services[serviceId].assetApprovedAt;
  }
  saveAssetWorkflowStore(store);
  return store.services[serviceId];
}

export function visualAssetExists(slug: string, serviceId: string): boolean {
  const key = tenantKey(slug);
  const file = resolveVisualExperienceHtmlPath(serviceId, key);
  return Boolean(file && fs.existsSync(file));
}

export function validateVisualPageTenant(
  slug: string,
  serviceId: string,
  expectedPharmacyName: string,
): { ok: boolean; path: string | null; reason?: string; detail?: string } {
  const key = tenantKey(slug);
  const file = resolveVisualExperienceHtmlPath(serviceId, key);
  if (!file || !fs.existsSync(file)) {
    return { ok: false, path: null, reason: "missing" };
  }
  if (key === "pharmaconnect") {
    return { ok: true, path: file };
  }
  const html = fs.readFileSync(file, "utf8").slice(0, 120_000);
  const name = String(expectedPharmacyName || "").trim();
  const foreign = detectForeignPharmacyIdentities(html, name);
  if (foreign.length) {
    return { ok: false, path: file, reason: "wrong_tenant", detail: foreignIdentityDetail(foreign) };
  }
  if (name && !htmlMatchesRequestedTenantIdentity(html, name)) {
    return { ok: false, path: file, reason: "pharmacy_name_mismatch" };
  }
  return { ok: true, path: file };
}

function hasBrandBasics(profile: PharmacyProfileData): boolean {
  return Boolean(
    profile.logoUrl ||
      profile.brandPrimaryColor ||
      profile.websiteAnalysisAt ||
      profile.website,
  );
}

function hasImageReadiness(slug: string, serviceId: string, campaign: PharmacyCampaignEnriched | null): boolean {
  if ((campaign?.imageAssignedCount ?? 0) >= 1) return true;
  const master = loadMasterStockImages(slug);
  if (master.images.length > 0) return true;
  const doc = loadImageAssignments(slug);
  return Object.keys(doc.assignments).some((k) => k.startsWith(`${serviceId}:`));
}

export function isBrandImagesReady(
  slug: string,
  serviceId: string,
  profile: PharmacyProfileData,
  campaign: PharmacyCampaignEnriched | null,
): boolean {
  const wf = getServiceAssetWorkflow(slug, serviceId);
  if (wf.brandImagesConfirmedAt) return true;
  return hasBrandBasics(profile) && hasImageReadiness(slug, serviceId, campaign);
}

export function isServiceAreaComplete(
  profile: PharmacyProfileData,
  campaign: PharmacyCampaignEnriched | null,
): boolean {
  if (campaign) return true;
  const hasAreas =
    (profile.selectedAreas || []).some((a) => a.selected !== false) ||
    (profile.rankingAreas || []).length > 0;
  const hasService = (profile.selectedServices || []).length > 0;
  return hasAreas && hasService;
}

export function hasAnyApprovedAsset(slug: string): boolean {
  const store = loadAssetWorkflowStore(slug);
  return Object.values(store.services).some((s) => Boolean(s.assetApprovedAt));
}
