/**
 * Canonical locality selection for Local Coverage Save Areas and locality-page generation.
 * Store: pharmacy profile `selectedAreas`. Campaign freeze / campaignAreas are projections
 * of that same store for the active campaign revision — not a second selection source.
 */
import fs from "node:fs";
import path from "node:path";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  readPharmacyCampaignStore,
  writePharmacyCampaignStore,
  type CampaignAreaEntry,
  type PharmacyCampaign,
} from "./pharmacyCampaignService.ts";
import type { PharmacyProfileData, ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { loadCampaignBuilderSession, saveCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";

export const CANONICAL_LOCALITY_SELECTION_FIELD = "profile.selectedAreas";

export interface CanonicalSavedLocalityArea {
  areaId: string;
  areaName: string;
  areaSlug: string;
  selected: boolean;
  source: string;
  priority: number;
  order: number;
  areaType?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  distanceLabel?: string;
  distanceMethod?: string;
  distanceProvenance?: Record<string, unknown>;
}

function safeSlug(slug: string): string {
  return resolveTenantProfileSlug(slug) || slug;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function asCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toSavedLocalityAreaId(areaName: string): string {
  return slugifyArea(text(areaName));
}

function freezeFilePath(slug: string, serviceId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "data/growth-engine",
    `${safeSlug(slug)}-campaign-generation-context-${serviceId}.json`,
  );
}

export function campaignLocalityFreezePath(slug: string, serviceId: string): string {
  return freezeFilePath(slug, serviceId);
}

function readFrozenSelectedAreas(slug: string, serviceId: string): CanonicalSavedLocalityArea[] {
  const file = freezeFilePath(slug, serviceId);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      generationContext?: { selectedAreas?: Array<Record<string, unknown>> };
    };
    return (raw.generationContext?.selectedAreas || [])
      .map((entry, index) =>
        profileEntryToCanonical(
          {
            areaName: text(entry.areaName),
            areaId: text(entry.areaId) || text(entry.areaSlug),
            areaType: text(entry.areaType) || undefined,
            selected: entry.selected !== false,
            source: text(entry.source) || "frozen-campaign",
            priority: typeof entry.priority === "number" ? entry.priority : index + 1,
            order: typeof entry.order === "number" ? entry.order : index + 1,
            latitude: asCoord(entry.latitude ?? entry.lat),
            longitude: asCoord(entry.longitude ?? entry.lng),
            distanceKm: asCoord(entry.distanceKm),
            distanceLabel: text(entry.distanceLabel) || undefined,
            distanceMethod: text(entry.distanceMethod) || undefined,
            distanceProvenance:
              entry.distanceProvenance && typeof entry.distanceProvenance === "object"
                ? (entry.distanceProvenance as Record<string, unknown>)
                : undefined,
          },
          index,
        ),
      )
      .filter((entry): entry is CanonicalSavedLocalityArea => Boolean(entry && entry.selected));
  } catch {
    return [];
  }
}

function resolveActiveCampaign(slug: string, campaignId?: string | null): PharmacyCampaign | undefined {
  const store = readPharmacyCampaignStore(slug);
  if (!store?.campaigns?.length) return undefined;
  const requestedId = text(campaignId);
  const active = readActiveServiceCampaignSelection(slug);
  return (
    store.campaigns.find((c) => c.id === requestedId) ||
    store.campaigns.find((c) => c.id === active?.campaignId) ||
    store.campaigns.find((c) => c.status === "active") ||
    store.campaigns[0]
  );
}

export function profileEntryToCanonical(entry: ProfileAreaEntry, index: number): CanonicalSavedLocalityArea | null {
  const areaName = text(entry.areaName);
  if (!areaName) return null;
  const rec = entry as ProfileAreaEntry & {
    lat?: number | null;
    lng?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    distanceKm?: number | null;
    distanceLabel?: string;
    distanceMethod?: string;
    distanceProvenance?: Record<string, unknown>;
  };
  const areaSlug = text(entry.areaId) || toSavedLocalityAreaId(areaName);
  return {
    areaId: areaSlug,
    areaName,
    areaSlug,
    selected: entry.selected !== false,
    source: text(entry.source) || "generation-setup",
    priority: entry.priority || index + 1,
    order: entry.order || index + 1,
    areaType: entry.areaType,
    latitude: asCoord(rec.latitude ?? rec.lat),
    longitude: asCoord(rec.longitude ?? rec.lng),
    distanceKm: rec.distanceKm == null ? null : asCoord(rec.distanceKm),
    distanceLabel: rec.distanceLabel,
    distanceMethod: rec.distanceMethod,
    distanceProvenance: rec.distanceProvenance,
  };
}

export function canonicalToProfileEntry(area: CanonicalSavedLocalityArea, index: number): ProfileAreaEntry {
  return {
    areaName: area.areaName,
    areaId: area.areaId || toSavedLocalityAreaId(area.areaName),
    areaType: area.areaType,
    priority: area.priority || index + 1,
    order: area.order || index + 1,
    selected: area.selected !== false,
    source: area.source || "generation-setup",
    latitude: area.latitude ?? null,
    longitude: area.longitude ?? null,
    distanceKm: area.distanceKm ?? null,
    distanceLabel: area.distanceLabel,
    distanceMethod: area.distanceMethod,
    distanceProvenance: area.distanceProvenance,
  };
}

export function readCanonicalSavedLocalityAreasFromProfile(
  profile: Pick<PharmacyProfileData, "selectedAreas">,
): CanonicalSavedLocalityArea[] {
  return (profile.selectedAreas || [])
    .map((entry, index) => profileEntryToCanonical(entry, index))
    .filter((entry): entry is CanonicalSavedLocalityArea => Boolean(entry && entry.selected));
}

export function readCanonicalSavedLocalityAreas(slug: string): CanonicalSavedLocalityArea[] {
  return readCanonicalSavedLocalityAreasFromProfile(readSetupProfile(safeSlug(slug)));
}

function liftLegacySelectionIntoCanonical(slug: string, campaignId?: string | null): CanonicalSavedLocalityArea[] {
  const s = safeSlug(slug);
  const profile = readSetupProfile(s);
  const existing = readCanonicalSavedLocalityAreasFromProfile(profile);
  if (existing.length) return existing;
  // Operator saved a Local Coverage list with every area deselected — do not revive campaign/freeze copies.
  if ((profile.selectedAreas || []).length) return [];

  const campaign = resolveActiveCampaign(s, campaignId);
  const fromCampaign = (campaign?.campaignAreas || [])
    .map((area, index) =>
      profileEntryToCanonical(
        {
          areaName: area.areaName,
          areaId: area.areaId || area.areaSlug,
          areaType: undefined,
          selected: area.selected !== false,
          source: area.source || "campaign.campaignAreas",
          priority: area.priority || index + 1,
          order: index + 1,
          latitude: area.latitude ?? null,
          longitude: area.longitude ?? null,
          distanceKm: area.distanceKm ?? null,
          distanceLabel: area.distanceLabel,
          distanceMethod: area.distanceMethod,
        },
        index,
      ),
    )
    .filter((entry): entry is CanonicalSavedLocalityArea => Boolean(entry && entry.selected));
  const lifted =
    fromCampaign.length > 0
      ? fromCampaign
      : campaign?.serviceId
        ? readFrozenSelectedAreas(s, campaign.serviceId)
        : [];
  if (!lifted.length) return [];

  profile.selectedAreas = lifted.map((area, index) => canonicalToProfileEntry(area, index));
  writeSetupProfile(s, profile);
  return readCanonicalSavedLocalityAreas(s);
}

function toCampaignArea(area: CanonicalSavedLocalityArea): CampaignAreaEntry {
  return {
    areaName: area.areaName,
    selected: true,
    source: area.source || CANONICAL_LOCALITY_SELECTION_FIELD,
    priority: area.priority,
    areaId: area.areaId,
    areaSlug: area.areaSlug,
    latitude: area.latitude ?? null,
    longitude: area.longitude ?? null,
    distanceKm: area.distanceKm ?? null,
    distanceLabel: area.distanceLabel || "",
    distanceMethod: area.distanceMethod || "",
    distanceProvenance: area.distanceProvenance,
  };
}

export function writeCanonicalSavedLocalityAreas(
  slug: string,
  areas: Array<Partial<ProfileAreaEntry> & { areaName: string }>,
  campaignId?: string | null,
): { ok: boolean; selectedCount: number; campaignId?: string; serviceId?: string; freezePath?: string } {
  const s = safeSlug(slug);
  const profile = readSetupProfile(s);
  const existingByName = new Map(
    (profile.selectedAreas || []).map((entry) => [text(entry.areaName).toLowerCase(), entry]),
  );
  profile.selectedAreas = areas
    .map((area, index) => {
      const prev = existingByName.get(text(area.areaName).toLowerCase());
      const merged: ProfileAreaEntry = {
        ...prev,
        ...area,
        areaName: text(area.areaName),
        areaId: text(area.areaId) || text(prev?.areaId) || toSavedLocalityAreaId(area.areaName),
        areaType: area.areaType || prev?.areaType,
        priority: area.priority || prev?.priority || index + 1,
        order: area.order || prev?.order || index + 1,
        selected: area.selected !== false,
        source: text(area.source) || text(prev?.source) || "generation-setup",
        latitude: area.latitude ?? prev?.latitude ?? null,
        longitude: area.longitude ?? prev?.longitude ?? null,
        distanceKm: area.distanceKm ?? prev?.distanceKm ?? null,
        distanceLabel: area.distanceLabel || prev?.distanceLabel,
        distanceMethod: area.distanceMethod || prev?.distanceMethod,
        distanceProvenance: area.distanceProvenance || prev?.distanceProvenance,
      };
      return merged;
    })
    .filter((entry) => entry.areaName);
  writeSetupProfile(s, profile);
  return projectCanonicalSelectionOntoCampaign(s, campaignId);
}

export function projectCanonicalSelectionOntoCampaign(
  slug: string,
  campaignId?: string | null,
): { ok: boolean; error?: string; selectedCount: number; campaignId?: string; serviceId?: string; freezePath?: string } {
  const s = safeSlug(slug);
  const selected = liftLegacySelectionIntoCanonical(s, campaignId);
  const store = readPharmacyCampaignStore(s);
  if (!store) {
    return { ok: selected.length > 0, selectedCount: selected.length };
  }

  const campaign = resolveActiveCampaign(s, campaignId);
  if (!campaign) {
    return { ok: selected.length > 0, selectedCount: selected.length };
  }

  const campaignAreas: CampaignAreaEntry[] = selected.map((area) => toCampaignArea(area));
  const idx = store.campaigns.findIndex((c) => c.id === campaign.id);
  if (idx >= 0) {
    store.campaigns[idx] = {
      ...campaign,
      areaSource: "custom",
      campaignAreas,
    };
    store.updatedAt = new Date().toISOString();
    writePharmacyCampaignStore(store);
  }

  const freezePath = freezeFilePath(s, campaign.serviceId);
  const existing = fs.existsSync(freezePath)
    ? (JSON.parse(fs.readFileSync(freezePath, "utf8")) as Record<string, unknown>)
    : {};
  const payload = {
    ...existing,
    version: existing.version || "1.0.0",
    frozenAt: new Date().toISOString(),
    slug: s,
    serviceId: campaign.serviceId,
    campaignId: campaign.id,
    targetAreas: selected.map((a) => a.areaName),
    generationContext: {
      ...((existing.generationContext as Record<string, unknown>) || {}),
      selectedAreas: selected.map((a) => ({
        areaId: a.areaId,
        areaName: a.areaName,
        areaSlug: a.areaSlug,
        selected: true,
        order: a.order,
        priority: a.priority,
        areaType: a.areaType,
        source: a.source,
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
        distanceKm: a.distanceKm ?? null,
        distanceLabel: a.distanceLabel || "",
        distanceMethod: a.distanceMethod || "",
        distanceProvenance: a.distanceProvenance || null,
      })),
    },
    sourceRefs: {
      ...((existing.sourceRefs as Record<string, unknown>) || {}),
      localitySelectionUpdatedAt: new Date().toISOString(),
      localitySelectionSource: CANONICAL_LOCALITY_SELECTION_FIELD,
      localitySelectionCampaignId: campaign.id,
    },
  };
  fs.mkdirSync(path.dirname(freezePath), { recursive: true });
  fs.writeFileSync(freezePath, JSON.stringify(payload, null, 2), "utf8");

  const targetAreaNames = selected.map((area) => area.areaName).filter(Boolean);
  if (targetAreaNames.length) {
    const session = loadCampaignBuilderSession(s);
    saveCampaignBuilderSession({
      ...session,
      selectedServiceId: campaign.serviceId || session.selectedServiceId,
      targetAreaNames,
      targetAreaMode: targetAreaNames.length > 1 ? "selected" : session.targetAreaMode,
    });
  }

  return {
    ok: true,
    selectedCount: selected.length,
    campaignId: campaign.id,
    serviceId: campaign.serviceId,
    freezePath,
  };
}
