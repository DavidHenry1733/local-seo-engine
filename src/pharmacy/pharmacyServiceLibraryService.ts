/**
 * PharmaConnect Growth Engine — Pharmacy Service Library Manager.
 * Master service selection for content blueprint and page generation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPharmacyBusinessIntelligence,
  loadPharmacyLocalIntelligence,
  loadPharmacyProfile,
} from "./pharmacyContentBlueprintService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();

export const CATALOG_PATH = path.join(WORKSPACE_ROOT, "config/pharmacy/service-library.json");
export const STORAGE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-service-library");

export const MAX_AREA_OPTIONS = [5, 8, 10, 12] as const;
export type MaxAreasOption = (typeof MAX_AREA_OPTIONS)[number];

export interface CatalogService {
  id: string;
  serviceName: string;
  description: string;
  enabled: boolean;
}

export interface CatalogCategory {
  id: string;
  label: string;
  description?: string;
  services: CatalogService[];
}

export interface ServiceLibraryCatalog {
  version: string;
  businessType: string;
  categories: CatalogCategory[];
}

export interface PharmacyServiceEntry {
  id: string;
  category: string;
  serviceName: string;
  description: string;
  enabled: boolean;
  selected: boolean;
  recommended: boolean;
}

export interface PharmacyServiceLibrary {
  slug: string;
  updatedAt: string;
  analysedAt?: string;
  maxAreas: MaxAreasOption;
  selectedServices: string[];
  recommendedServices: string[];
  services: PharmacyServiceEntry[];
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function normalizeServiceId(id: string): string {
  return String(id || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function libraryPath(slug: string): string {
  return path.join(STORAGE_DIR, `${slug}.json`);
}

export function loadServiceLibraryCatalog(): ServiceLibraryCatalog {
  const catalog = readJson<ServiceLibraryCatalog>(CATALOG_PATH);
  if (!catalog?.categories?.length) {
    throw new Error("Service library catalog not found at config/pharmacy/service-library.json");
  }
  return catalog;
}

function buildDefaultServices(catalog: ServiceLibraryCatalog): PharmacyServiceEntry[] {
  const out: PharmacyServiceEntry[] = [];
  for (const category of catalog.categories) {
    for (const service of category.services) {
      if (!service.enabled) continue;
      out.push({
        id: normalizeServiceId(service.id),
        category: category.id,
        serviceName: service.serviceName,
        description: service.description,
        enabled: true,
        selected: false,
        recommended: false,
      });
    }
  }
  return out;
}

function syncDerivedFields(doc: PharmacyServiceLibrary): PharmacyServiceLibrary {
  doc.selectedServices = doc.services.filter((s) => s.selected).map((s) => s.id);
  doc.recommendedServices = doc.services.filter((s) => s.recommended).map((s) => s.id);
  if (!MAX_AREA_OPTIONS.includes(doc.maxAreas)) doc.maxAreas = 8;
  return doc;
}

export function loadPharmacyServiceLibrary(slug: string): PharmacyServiceLibrary {
  const catalog = loadServiceLibraryCatalog();
  const existing = readJson<PharmacyServiceLibrary>(libraryPath(slug));

  if (existing?.services?.length) {
    const catalogById = new Map<string, { category: string; service: CatalogService }>();
    for (const category of catalog.categories) {
      for (const service of category.services) {
        catalogById.set(normalizeServiceId(service.id), { category: category.id, service });
      }
    }

    const merged: PharmacyServiceEntry[] = [];
    const seen = new Set<string>();

    for (const entry of existing.services) {
      const id = normalizeServiceId(entry.id);
      const cat = catalogById.get(id);
      if (!cat || !cat.service.enabled) continue;
      seen.add(id);
      merged.push({
        id,
        category: cat.category,
        serviceName: cat.service.serviceName,
        description: cat.service.description,
        enabled: true,
        selected: !!entry.selected,
        recommended: !!entry.recommended,
      });
    }

    for (const [id, cat] of catalogById) {
      if (seen.has(id) || !cat.service.enabled) continue;
      merged.push({
        id,
        category: cat.category,
        serviceName: cat.service.serviceName,
        description: cat.service.description,
        enabled: true,
        selected: false,
        recommended: false,
      });
    }

    return syncDerivedFields({
      slug,
      updatedAt: existing.updatedAt || new Date().toISOString(),
      analysedAt: existing.analysedAt,
      maxAreas: existing.maxAreas || 8,
      selectedServices: [],
      recommendedServices: [],
      services: merged,
    });
  }

  return syncDerivedFields({
    slug,
    updatedAt: new Date().toISOString(),
    maxAreas: 8,
    selectedServices: [],
    recommendedServices: [],
    services: buildDefaultServices(catalog),
  });
}

export function savePharmacyServiceLibrary(doc: PharmacyServiceLibrary): PharmacyServiceLibrary {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const saved = syncDerivedFields({
    ...doc,
    updatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(libraryPath(doc.slug), JSON.stringify(saved, null, 2) + "\n", "utf8");
  return saved;
}

function recommendIds(doc: PharmacyServiceLibrary, ids: string[]): void {
  const normalized = ids.map(normalizeServiceId);
  for (const service of doc.services) {
    service.recommended = normalized.includes(service.id);
  }
}

function selectIds(doc: PharmacyServiceLibrary, ids: string[]): void {
  const normalized = new Set(ids.map(normalizeServiceId));
  for (const service of doc.services) {
    if (normalized.has(service.id)) service.selected = true;
  }
}

function hasCareHomeSignals(profileData: Record<string, unknown>, local: Record<string, unknown>): boolean {
  const careHomes = [
    ...((profileData.careHomesServed as string[]) || []),
    ...((local.localCareHomes as string[]) || []),
  ];
  return careHomes.some((v) => String(v).trim().length > 0);
}

function hasCommuterSignals(local: Record<string, unknown>): boolean {
  const employers = (local.localEmployers as string[]) || [];
  const retail = (local.localRetailCentres as string[]) || [];
  return employers.length >= 3 || retail.length >= 2;
}

function hasElderlySignals(profileData: Record<string, unknown>, local: Record<string, unknown>): boolean {
  const communities = ((local.localCommunityLocations as string[]) || []).join(" ").toLowerCase();
  const residential = ((local.localResidentialAreas as string[]) || []).join(" ").toLowerCase();
  const careHomes = hasCareHomeSignals(profileData, local);
  return (
    careHomes ||
    communities.includes("retirement") ||
    residential.includes("retirement") ||
    ((profileData.targetPatientGroups as string[]) || []).some((g) => /elder|older|65|senior/i.test(g))
  );
}

export function analysePharmacyServices(slug: string): PharmacyServiceLibrary {
  const doc = loadPharmacyServiceLibrary(slug);
  const profile = loadPharmacyProfile(slug);
  const intelligence = loadPharmacyBusinessIntelligence(slug);
  const local = loadPharmacyLocalIntelligence(slug);
  const profileData = profile.data || {};

  for (const service of doc.services) {
    service.recommended = false;
  }

  const recommended = new Set<string>();

  const addRecommend = (...ids: string[]) => {
    for (const id of ids) recommended.add(normalizeServiceId(id));
  };

  if (hasCareHomeSignals(profileData, local as unknown as Record<string, unknown>)) {
    addRecommend("medication-reviews", "prescription-delivery", "care-home-support");
  }

  if (hasCommuterSignals(local as unknown as Record<string, unknown>)) {
    addRecommend("travel-vaccinations", "blood-pressure-checks", "travel-health-consultations");
  }

  if (hasElderlySignals(profileData, local as unknown as Record<string, unknown>)) {
    addRecommend("medication-reviews", "prescription-delivery", "blood-pressure-checks");
  }

  for (const service of intelligence.services?.selectedServices || []) {
    addRecommend(normalizeServiceId(service.id));
  }

  for (const id of (profileData.selectedServices as string[]) || []) {
    addRecommend(normalizeServiceId(id));
  }

  for (const id of (profileData.priorityServices as string[]) || []) {
    addRecommend(normalizeServiceId(id));
  }

  const goal = String(
    intelligence.growthSeo?.primaryGrowthGoal || profileData.primaryGrowthGoal || profileData.primaryGoal || "",
  ).toLowerCase();
  if (goal.includes("travel")) addRecommend("travel-vaccinations", "travel-health-consultations");
  if (goal.includes("weight")) addRecommend("weight-management");
  if (goal.includes("vaccin")) addRecommend("flu-vaccinations", "covid-vaccinations", "travel-vaccinations");
  if (goal.includes("delivery")) addRecommend("prescription-delivery");
  if (goal.includes("care home")) addRecommend("care-home-support", "medication-reviews");

  if (((profileData.deliveryAvailable as unknown[]) || []).length || ((profileData.deliveryAreas as string[]) || []).length) {
    addRecommend("prescription-delivery");
  }

  recommendIds(doc, Array.from(recommended));

  const autoSelect = new Set<string>([
    ...((profileData.selectedServices as string[]) || []).map(normalizeServiceId),
    ...(intelligence.services?.selectedServices || []).map((s) => normalizeServiceId(s.id)),
    ...Array.from(recommended),
  ]);
  for (const service of doc.services) {
    if (autoSelect.has(service.id)) service.selected = true;
  }

  doc.analysedAt = new Date().toISOString();
  return savePharmacyServiceLibrary(doc);
}

export function updatePharmacyServiceLibrary(
  slug: string,
  updates: {
    maxAreas?: number;
    selectedServices?: string[];
    services?: Array<{ id: string; selected?: boolean; recommended?: boolean }>;
  },
): PharmacyServiceLibrary {
  const doc = loadPharmacyServiceLibrary(slug);

  if (typeof updates.maxAreas === "number" && MAX_AREA_OPTIONS.includes(updates.maxAreas as MaxAreasOption)) {
    doc.maxAreas = updates.maxAreas as MaxAreasOption;
  }

  if (updates.selectedServices) {
    const selected = new Set(updates.selectedServices.map(normalizeServiceId));
    for (const service of doc.services) {
      service.selected = selected.has(service.id);
    }
  }

  if (updates.services) {
    const patch = new Map(updates.services.map((s) => [normalizeServiceId(s.id), s]));
    for (const service of doc.services) {
      const change = patch.get(service.id);
      if (!change) continue;
      if (typeof change.selected === "boolean") service.selected = change.selected;
      if (typeof change.recommended === "boolean") service.recommended = change.recommended;
    }
  }

  return savePharmacyServiceLibrary(doc);
}

export function getSelectedServices(slug: string): PharmacyServiceEntry[] {
  const doc = loadPharmacyServiceLibrary(slug);
  return doc.services.filter((s) => s.selected);
}

export function getMaxAreas(slug: string): MaxAreasOption {
  const doc = loadPharmacyServiceLibrary(slug);
  return doc.maxAreas || 8;
}

export function getServiceLibraryStatus(slug: string): {
  hasLibrary: boolean;
  selectedCount: number;
  recommendedCount: number;
  maxAreas: number;
  analysedAt: string | null;
} {
  const exists = fs.existsSync(libraryPath(slug));
  if (!exists) {
    return {
      hasLibrary: false,
      selectedCount: 0,
      recommendedCount: 0,
      maxAreas: 8,
      analysedAt: null,
    };
  }
  const doc = loadPharmacyServiceLibrary(slug);
  return {
    hasLibrary: true,
    selectedCount: doc.selectedServices.length,
    recommendedCount: doc.recommendedServices.length,
    maxAreas: doc.maxAreas,
    analysedAt: doc.analysedAt || null,
  };
}
