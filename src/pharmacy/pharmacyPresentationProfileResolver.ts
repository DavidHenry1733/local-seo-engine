/**
 * Single canonical presentation profile resolver — all renderers read confirmed business facts here.
 */
import fs from "node:fs";
import path from "node:path";
import { loadPharmacyProfile, profilePath } from "./pharmacyContentBlueprintService.ts";
import type { GrowthProfileDoc } from "./pharmacyContentBlueprintService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  buildPharmacyServicePageProfileFromData,
} from "./pharmacyServicePageProfileBuilder.ts";

export interface PharmacyPresentationProfile {
  slug: string;
  resolvedSlug: string;
  profilePath: string;
  profileRevision: number;
  updatedAt: string;
  presentationRenderedAt: string;
  data: PharmacyProfileData;
  confirmations: Record<string, string>;
  servicePageProfile: PharmacyServicePageProfile;
}

interface ProfileDocCacheEntry {
  mtimeMs: number;
  revision: number;
  doc: GrowthProfileDoc;
}

const profileDocCache = new Map<string, ProfileDocCacheEntry>();

function resolveSlug(slug: string): string {
  return resolveTenantProfileSlug(slug) || slug;
}

function readProfileRevision(doc: GrowthProfileDoc): number {
  const revision = (doc as GrowthProfileDoc & { presentationRevision?: number }).presentationRevision;
  return typeof revision === "number" && Number.isFinite(revision) ? revision : 0;
}

export function invalidatePharmacyPresentationProfileCache(slug?: string): void {
  if (slug) {
    profileDocCache.delete(resolveSlug(slug));
    return;
  }
  profileDocCache.clear();
}

export function loadCurrentPharmacyProfileDocument(slug: string): GrowthProfileDoc {
  const resolvedSlug = resolveSlug(slug);
  const filePath = profilePath(resolvedSlug);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Pharmacy Profile not found for "${slug}". Complete Profile setup first.`);
  }
  const stat = fs.statSync(filePath);
  const revision = (() => {
    try {
      const peek = JSON.parse(fs.readFileSync(filePath, "utf8")) as GrowthProfileDoc;
      return readProfileRevision(peek);
    } catch {
      return 0;
    }
  })();
  const cached = profileDocCache.get(resolvedSlug);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.revision === revision) {
    return cached.doc;
  }
  const doc = loadPharmacyProfile(resolvedSlug);
  profileDocCache.set(resolvedSlug, { mtimeMs: stat.mtimeMs, revision, doc });
  return doc;
}

export function resolveCurrentPharmacyPresentationProfile(slug: string): PharmacyPresentationProfile {
  const resolvedSlug = resolveSlug(slug);
  const doc = loadCurrentPharmacyProfileDocument(resolvedSlug);
  const data = normalizeProfileData(doc.data || {});
  const servicePageProfile = buildPharmacyServicePageProfileFromData(resolvedSlug, data, doc);
  return {
    slug,
    resolvedSlug,
    profilePath: profilePath(resolvedSlug),
    profileRevision: readProfileRevision(doc),
    updatedAt: String(doc.updatedAt || ""),
    presentationRenderedAt: String(
      (doc as GrowthProfileDoc & { presentationRenderedAt?: string }).presentationRenderedAt || "",
    ),
    data,
    confirmations: { ...(data.profileFieldConfirmations || {}) },
    servicePageProfile,
  };
}

export function markPharmacyPresentationRendered(slug: string, renderedAt: string): void {
  const resolvedSlug = resolveSlug(slug);
  const filePath = profilePath(resolvedSlug);
  if (!fs.existsSync(filePath)) return;
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  doc.presentationRenderedAt = renderedAt;
  doc.updatedAt = renderedAt;
  fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  invalidatePharmacyPresentationProfileCache(resolvedSlug);
}

export function bumpPharmacyPresentationRevision(slug: string): number {
  const resolvedSlug = resolveSlug(slug);
  const filePath = profilePath(resolvedSlug);
  const doc = fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, "utf8")) as GrowthProfileDoc & { presentationRevision?: number })
    : ({ slug: resolvedSlug, data: {} } as GrowthProfileDoc & { presentationRevision?: number });
  const nextRevision = readProfileRevision(doc) + 1;
  (doc as GrowthProfileDoc & { presentationRevision?: number }).presentationRevision = nextRevision;
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  invalidatePharmacyPresentationProfileCache(resolvedSlug);
  return nextRevision;
}
