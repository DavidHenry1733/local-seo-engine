/**
 * Per-service publishing settings — canonical, noindex, structured data (placeholder flag).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { resolveAuthoritativePublicationCanonical } from "./pharmacyPublicationCanonicalAuthority.ts";

export interface ServicePublishingSettings {
  serviceId: string;
  canonicalUrl: string;
  noindex: boolean;
  structuredDataEnabled: boolean;
  updatedAt: string;
}

export interface PharmacyPublishingSettingsDoc {
  version: 1;
  slug: string;
  updatedAt: string;
  services: ServicePublishingSettings[];
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function settingsPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-publishing-settings", `${safeSlug(slug)}.json`);
}

export function loadPharmacyPublishingSettings(slug: string): PharmacyPublishingSettingsDoc {
  const file = settingsPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    return { version: 1, slug: safeSlug(slug), updatedAt: new Date().toISOString(), services: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PharmacyPublishingSettingsDoc;
  } catch {
    return { version: 1, slug: safeSlug(slug), updatedAt: new Date().toISOString(), services: [] };
  }
}

export function getServicePublishingSettings(slug: string, serviceId: string): ServicePublishingSettings | null {
  const doc = loadPharmacyPublishingSettings(slug);
  const stored = doc.services.find((s) => s.serviceId === serviceId) || null;
  if (!stored) return null;
  const resolved = resolveAuthoritativePublicationCanonical({
    slug,
    serviceId,
    storedCanonicalUrl: stored.canonicalUrl,
  });
  return { ...stored, canonicalUrl: resolved.canonicalUrl };
}

export function saveServicePublishingSettings(
  slug: string,
  serviceId: string,
  input: { canonicalUrl?: string; noindex?: boolean; structuredDataEnabled?: boolean },
): ServicePublishingSettings {
  const s = safeSlug(slug);
  const doc = loadPharmacyPublishingSettings(s);
  const now = new Date().toISOString();
  const existing = doc.services.find((svc) => svc.serviceId === serviceId);
  const resolved = resolveAuthoritativePublicationCanonical({
    slug: s,
    serviceId,
    storedCanonicalUrl: String(input.canonicalUrl ?? existing?.canonicalUrl ?? "").trim(),
  });
  const next: ServicePublishingSettings = {
    serviceId,
    canonicalUrl: resolved.canonicalUrl,
    noindex: input.noindex ?? existing?.noindex ?? true,
    structuredDataEnabled: input.structuredDataEnabled ?? existing?.structuredDataEnabled ?? false,
    updatedAt: now,
  };
  const services = doc.services.filter((svc) => svc.serviceId !== serviceId);
  services.push(next);
  const updated: PharmacyPublishingSettingsDoc = { version: 1, slug: s, updatedAt: now, services };
  fs.writeFileSync(settingsPath(s), JSON.stringify(updated, null, 2));
  return next;
}

export function publishingSettingsFilePath(slug: string): string {
  return settingsPath(slug);
}
