/**
 * PharmaConnect Master Admin Platform V1 — internal agency portal for managing pharmacy clients.
 * Provisions slug-scoped workspaces; does not modify content generation engines.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  normalizeProfileData,
  normalizeProfileDoc,
  PROFILE_SCHEMA_VERSION,
  type PharmacyProfileData,
  type ProfileAreaEntry,
} from "./pharmacyProfileSchema.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { mapBrandProfileToPharmacyData } from "./pharmacyBrandProfileMapper.ts";
import {
  analyzeWebsiteForPharmacy,
  mergeWebsiteAnalysisIntoProfile,
} from "./pharmacyWebsiteAnalysisService.ts";
import type { BrandProfile } from "../generator/brandImporter.ts";
import { discoverPharmacyAreas } from "./pharmacyAreaDiscoveryService.ts";
import { buildPharmacyPlatformDashboard } from "./pharmacyPlatformDashboardService.ts";
import { buildCustomerExperienceView, type GrowthPlanTier } from "./pharmacyCustomerExperienceService.ts";
import {
  BENCHMARK_MASTER_SERVICE_IDS,
  getServicePublishMeta,
} from "./pharmacyMasterPublishConfig.ts";
import { listWizardServicesForTenant } from "./growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import {
  createPharmacyCampaign,
  readPharmacyCampaignStore,
  writePharmacyCampaignStore,
  type PharmacyCampaignStore,
} from "./pharmacyCampaignService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import {
  ensureDir,
  finalizePharmacyWorkspaceProvisioning,
  getPharmacyProjectConfigPath,
  isPharmacyWorkspaceReady,
  pharmacyProfilesDir,
  rollbackPharmacyWorkspace,
  WorkspaceProvisioningError,
  type ProvisioningVerificationResult,
} from "./pharmacyWorkspaceProvisionService.ts";
import {
  getPharmacyBrandProfilePath,
  getPharmacyProjectBrandDir,
} from "./pharmacyWorkspacePaths.ts";
import {
  filterValidSelectedServices,
  resolveSelectedServiceLabels,
} from "./pharmacyMasterAdminWizard.ts";

export type ClientStage =
  | "onboarding"
  | "building"
  | "growing"
  | "published"
  | "needs_attention";

export type MasterAdminStageFilter = ClientStage | "all";

export interface MasterAdminRegistryEntry {
  slug: string;
  pharmacyName: string;
  growthPlanTier: GrowthPlanTier;
  isDemo: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  createdBy?: string;
}

export interface MasterAdminRegistry {
  version: 1;
  updatedAt: string;
  clients: MasterAdminRegistryEntry[];
}

export interface CreatePharmacyWizardInput {
  pharmacyName: string;
  website?: string;
  contactEmail: string;
  telephone: string;
  growthPlanTier: GrowthPlanTier;
  primaryTown: string;
  coverageRadius?: string;
  selectedAreas?: ProfileAreaEntry[];
  selectedServices: string[];
  isDemo?: boolean;
  slug?: string;
}

export interface MasterAdminClientCard {
  slug: string;
  pharmacyName: string;
  logoUrl: string;
  town: string;
  growthPlanTier: GrowthPlanTier;
  growthPlanLabel: string;
  stage: ClientStage;
  stageLabel: string;
  overallProgressPct: number;
  outstandingTaskCount: number;
  lastActivityAt: string;
  isDemo: boolean;
  archived: boolean;
  growthProgrammeUrl: string;
}

export interface MasterAdminPortfolioSummary {
  totalClients: number;
  activeClients: number;
  onboarding: number;
  building: number;
  growing: number;
  published: number;
  needsAttention: number;
}

export interface CreatePharmacyResult {
  slug: string;
  pharmacyName: string;
  growthProgrammeUrl: string;
  websiteAnalysed: boolean;
  brandImported: boolean;
  areasDiscovered: number;
  placeholderCampaigns: number;
  profilePath: string;
  warnings: string[];
  verified: boolean;
  provisioningReport?: ProvisioningVerificationResult;
}

export { WorkspaceProvisioningError };
const REGISTRY_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "registry.json");

const STAGE_LABELS: Record<ClientStage, string> = {
  onboarding: "Onboarding",
  building: "Building",
  growing: "Growing",
  published: "Published",
  needs_attention: "Needs Attention",
};

const TIER_LABELS: Record<GrowthPlanTier, string> = {
  starter: "Starter",
  professional: "Professional",
  complete: "Complete",
};

export function safeAdminSlug(v: string): string {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugFromPharmacyName(name: string): string {
  return safeAdminSlug(name) || "pharmacy";
}

export function resolveUniqueSlug(base: string, excludeArchived = true): string {
  const registry = readMasterAdminRegistry();
  const existingSlugs = new Set([
    ...registry.clients.filter((c) => !excludeArchived || !c.archived).map((c) => c.slug),
    ...listProfileSlugs(),
  ]);
  let candidate = safeAdminSlug(base);
  if (!candidate) candidate = "pharmacy";
  if (!existingSlugs.has(candidate)) return candidate;
  let n = 2;
  while (existingSlugs.has(`${candidate}-${n}`)) n += 1;
  return `${candidate}-${n}`;
}

function listProfileSlugs(): string[] {
  const dir = pharmacyProfilesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

function readProfileFile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as {
    slug?: string;
    updatedAt?: string;
    data?: Record<string, unknown>;
  };
}

function writeProfileFile(slug: string, data: Partial<PharmacyProfileData>): string {
  const file = profilePath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = readProfileFile(slug);
  const profile = {
    slug,
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data: normalizeProfileData({ ...(existing?.data || {}), ...data }),
  };
  fs.writeFileSync(file, JSON.stringify(profile, null, 2));
  return file;
}

function saveBrandProfile(slug: string, brand: BrandProfile): string {
  const dir = getPharmacyProjectBrandDir(slug);
  ensureDir(dir);
  const file = getPharmacyBrandProfilePath(slug);
  fs.writeFileSync(file, JSON.stringify({ ...brand, approved: true }, null, 2));
  return file;
}

export function readMasterAdminRegistry(): MasterAdminRegistry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return { version: 1, updatedAt: new Date().toISOString(), clients: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")) as MasterAdminRegistry;
    return {
      version: 1,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      clients: Array.isArray(raw.clients) ? raw.clients : [],
    };
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), clients: [] };
  }
}

function writeMasterAdminRegistry(registry: MasterAdminRegistry): string {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  return REGISTRY_PATH;
}

function upsertRegistryEntry(entry: MasterAdminRegistryEntry): void {
  const registry = readMasterAdminRegistry();
  const idx = registry.clients.findIndex((c) => c.slug === entry.slug);
  if (idx >= 0) registry.clients[idx] = { ...registry.clients[idx]!, ...entry, updatedAt: new Date().toISOString() };
  else registry.clients.push(entry);
  writeMasterAdminRegistry(registry);
}

/** Admin Client Creation V1 — register a new client without full workspace provisioning. */
export function registerMasterAdminClient(slug: string, pharmacyName: string): void {
  const now = new Date().toISOString();
  upsertRegistryEntry({
    slug,
    pharmacyName,
    growthPlanTier: "starter",
    isDemo: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
}

export function removeMasterAdminRegistryEntry(slug: string): boolean {
  const s = safeAdminSlug(slug);
  const registry = readMasterAdminRegistry();
  const before = registry.clients.length;
  registry.clients = registry.clients.filter((c) => c.slug !== s);
  if (registry.clients.length === before) return false;
  writeMasterAdminRegistry(registry);
  return true;
}

function ensureRegistryFromProfiles(): void {
  const registry = readMasterAdminRegistry();
  const known = new Set(registry.clients.map((c) => c.slug));
  for (const slug of listProfileSlugs()) {
    if (known.has(slug)) continue;
    if (!isPharmacyWorkspaceReady(slug)) continue;
    const raw = readProfileFile(slug);
    const data = normalizeProfileData(raw?.data || {});
    registry.clients.push({
      slug,
      pharmacyName: data.pharmacyName || slug,
      growthPlanTier: "starter",
      isDemo: slug.includes("demo") || slug.includes("test"),
      archived: false,
      createdAt: raw?.updatedAt || new Date().toISOString(),
      updatedAt: raw?.updatedAt || new Date().toISOString(),
    });
  }
  writeMasterAdminRegistry(registry);
}

export function deriveClientStage(
  slug: string,
  dashboard = buildPharmacyPlatformDashboard(slug),
): ClientStage {
  if (dashboard.staleCampaigns.length > 0 || dashboard.blockers.length > 0) {
    return "needs_attention";
  }
  const os = dashboard.operatingSystem;
  if (os.mode === "GROWTH") return "published";
  const campaign = dashboard.currentCampaign;
  if (campaign?.publishingStatus === "published" && os.overallCompletionPct >= 60) {
    return "growing";
  }
  if (dashboard.campaignCoverage.activeCampaignCount > 0 || os.overallCompletionPct >= 25) {
    return "building";
  }
  return "onboarding";
}

export function buildMasterAdminClientCard(slug: string): MasterAdminClientCard | null {
  const raw = readProfileFile(slug);
  if (!raw) return null;

  const registry = readMasterAdminRegistry();
  const entry = registry.clients.find((c) => c.slug === slug);
  if (entry?.archived) return null;

  try {
    const profile = normalizeProfileDoc(slug, raw);
    const dashboard = buildPharmacyPlatformDashboard(slug);
    const cx = buildCustomerExperienceView(dashboard);
    const tier = entry?.growthPlanTier || cx.growthPlanTier;
    const stage = deriveClientStage(slug, dashboard);

    return {
      slug,
      pharmacyName: profile.data.pharmacyName || slug,
      logoUrl: profile.data.logoUrl || "",
      town: profile.data.primaryTown || profile.data.townCity || "",
      growthPlanTier: tier,
      growthPlanLabel: TIER_LABELS[tier],
      stage,
      stageLabel: STAGE_LABELS[stage],
      overallProgressPct: dashboard.operatingSystem.overallCompletionPct,
      outstandingTaskCount: cx.outstandingTasks.length,
      lastActivityAt: raw.updatedAt || entry?.updatedAt || new Date().toISOString(),
      isDemo: entry?.isDemo ?? false,
      archived: false,
      growthProgrammeUrl: `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`,
    };
  } catch {
    const data = normalizeProfileData(raw.data || {});
    return {
      slug,
      pharmacyName: data.pharmacyName || slug,
      logoUrl: data.logoUrl || "",
      town: data.primaryTown || data.townCity || "",
      growthPlanTier: entry?.growthPlanTier || "starter",
      growthPlanLabel: TIER_LABELS[entry?.growthPlanTier || "starter"],
      stage: "onboarding",
      stageLabel: STAGE_LABELS.onboarding,
      overallProgressPct: 0,
      outstandingTaskCount: 0,
      lastActivityAt: raw.updatedAt || entry?.updatedAt || new Date().toISOString(),
      isDemo: entry?.isDemo ?? false,
      archived: false,
      growthProgrammeUrl: `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`,
    };
  }
}

export function buildMasterAdminPortfolio(options?: {
  stage?: MasterAdminStageFilter;
  search?: string;
  includeArchived?: boolean;
}): { summary: MasterAdminPortfolioSummary; clients: MasterAdminClientCard[] } {
  ensureRegistryFromProfiles();
  const registry = readMasterAdminRegistry();
  const search = String(options?.search || "")
    .trim()
    .toLowerCase();
  const stageFilter = options?.stage || "all";
  const includeArchived = options?.includeArchived === true;

  const clients: MasterAdminClientCard[] = [];
  for (const entry of registry.clients) {
    if (entry.archived && !includeArchived) continue;
    if (!entry.archived && !isPharmacyWorkspaceReady(entry.slug)) continue;
    if (!readProfileFile(entry.slug) && !includeArchived) continue;
    const card = buildMasterAdminClientCard(entry.slug);
    if (!card && !entry.archived) {
      continue;
    }
    const resolved =
      card ||
      ({
        slug: entry.slug,
        pharmacyName: entry.pharmacyName,
        logoUrl: "",
        town: "",
        growthPlanTier: entry.growthPlanTier,
        growthPlanLabel: TIER_LABELS[entry.growthPlanTier],
        stage: "onboarding" as ClientStage,
        stageLabel: STAGE_LABELS.onboarding,
        overallProgressPct: 0,
        outstandingTaskCount: 0,
        lastActivityAt: entry.updatedAt,
        isDemo: entry.isDemo,
        archived: entry.archived,
        growthProgrammeUrl: `/api/pharmacy-dashboard?slug=${encodeURIComponent(entry.slug)}`,
      } satisfies MasterAdminClientCard);

    if (stageFilter !== "all" && resolved.stage !== stageFilter) continue;
    if (
      search &&
      !resolved.pharmacyName.toLowerCase().includes(search) &&
      !resolved.slug.includes(search) &&
      !resolved.town.toLowerCase().includes(search)
    ) {
      continue;
    }
    clients.push(resolved);
  }

  clients.sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );

  const active = clients.filter((c) => !c.archived);
  const summary: MasterAdminPortfolioSummary = {
    totalClients: active.length,
    activeClients: active.length,
    onboarding: active.filter((c) => c.stage === "onboarding").length,
    building: active.filter((c) => c.stage === "building").length,
    growing: active.filter((c) => c.stage === "growing").length,
    published: active.filter((c) => c.stage === "published").length,
    needsAttention: active.filter((c) => c.stage === "needs_attention").length,
  };

  return { summary, clients };
}

export function discoverAreasForWizard(town: string, limit = 10): ProfileAreaEntry[] {
  const result = discoverPharmacyAreas({ town, limit });
  return result.areas;
}

export function getAvailableServicesForWizard(slug?: string): { serviceId: string; serviceName: string }[] {
  if (slug) {
    try {
      const tenantServices = listWizardServicesForTenant(String(slug));
      if (tenantServices.length) return tenantServices;
    } catch {
      // Fall through to clinical benchmark catalogue for genuine pharmacy tenants / load failures.
    }
  }
  return BENCHMARK_MASTER_SERVICE_IDS.map((id) => {
    const meta = getServicePublishMeta(id);
    return { serviceId: id, serviceName: meta?.serviceName || id };
  });
}

function writeProjectStub(slug: string, input: CreatePharmacyWizardInput): string {
  const file = getPharmacyProjectConfigPath(slug);
  ensureDir(path.dirname(file));
  const domain = input.website?.startsWith("http") ? input.website.replace(/\/$/, "") : `https://${slug}.pharmacy.local`;
  const project = {
    clientSlug: slug,
    businessName: input.pharmacyName,
    domain,
    phone: input.telephone,
    email: input.contactEmail,
    branding: { primaryColor: "#005EB8", accentColor: "#1CA9C9" },
    services: input.selectedServices,
    locations: input.primaryTown ? [{ name: input.primaryTown }] : [],
  };
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
  return file;
}

function createPlaceholderCampaigns(slug: string, serviceIds: string[]): number {
  const valid = serviceIds.filter((id) =>
    BENCHMARK_MASTER_SERVICE_IDS.includes(id as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number]),
  );
  if (!valid.length) return 0;

  const existing = readPharmacyCampaignStore(slug);
  const activeServiceIds = new Set(
    (existing?.campaigns || []).filter((c) => c.status === "active").map((c) => c.serviceId),
  );

  let created = 0;
  for (const serviceId of valid) {
    if (activeServiceIds.has(serviceId)) continue;
    try {
      createPharmacyCampaign(slug, {
        serviceId,
        campaignGoal: "Increase Visibility",
      });
      activeServiceIds.add(serviceId);
      created += 1;
    } catch {
      const meta = getServicePublishMeta(serviceId);
      const store = readPharmacyCampaignStore(slug);
      const campaigns = [...(store?.campaigns || [])];
      campaigns.push({
        id: randomUUID(),
        name: `${meta?.serviceName || serviceId} — Increase Visibility`,
        serviceId,
        serviceName: meta?.serviceName || serviceId,
        campaignGoal: "Increase Visibility",
        createdAt: new Date().toISOString(),
        status: "active",
        assetCounts: {
          pages: 0,
          images: 0,
          areas: 0,
          gbpPosts: 0,
          emailSequence: 0,
          videoScript: 0,
          publishingQueue: 0,
          indexingQueue: 0,
          total: 0,
        },
        publishingStatus: "pending",
        indexingStatus: "not_registered",
        visibilityStatus: "unknown",
        publishedPages: 0,
        indexedPages: 0,
        visiblePages: 0,
        links: {
          ecosystem: `/api/pharmacy-content-ecosystem?slug=${slug}&service=${serviceId}`,
          publishedPage: `/api/pharmacy-master-preview?slug=${slug}&service=${serviceId}`,
          indexing: `/api/pharmacy-growth-dashboard?slug=${slug}#indexing`,
          visibility: `/api/pharmacy-growth-dashboard?slug=${slug}#visibility`,
        },
        areaSource: "profile",
        campaignAreas: [],
      });
      writePharmacyCampaignStore({
        version: 1,
        slug,
        updatedAt: new Date().toISOString(),
        campaigns,
      });
      activeServiceIds.add(serviceId);
      created += 1;
    }
  }

  return created || activeServiceIds.size;
}

export async function createPharmacyWorkspace(
  input: CreatePharmacyWizardInput,
): Promise<CreatePharmacyResult> {
  const warnings: string[] = [];
  const pharmacyName = String(input.pharmacyName || "").trim();
  if (!pharmacyName) throw new Error("Pharmacy name is required");
  if (!String(input.contactEmail || "").trim()) throw new Error("Contact email is required");
  if (!String(input.telephone || "").trim()) throw new Error("Telephone is required");
  if (!String(input.primaryTown || "").trim()) throw new Error("Primary town is required");

  const selectedServices = filterValidSelectedServices(input.selectedServices || []);
  if (!selectedServices.length) throw new Error("Select at least one service");

  const slug = input.slug
    ? safeAdminSlug(input.slug)
    : resolveUniqueSlug(slugFromPharmacyName(pharmacyName));
  if (!slug) throw new Error("Could not derive a valid slug");

  const registry = readMasterAdminRegistry();
  if (registry.clients.some((c) => c.slug === slug && !c.archived)) {
    throw new Error(`Pharmacy workspace already exists: ${slug}`);
  }

  let selectedAreas = input.selectedAreas || [];
  if (!selectedAreas.length && input.primaryTown) {
    try {
      selectedAreas = discoverAreasForWizard(input.primaryTown, 10);
    } catch (err) {
      warnings.push(`Area discovery skipped: ${String(err)}`);
    }
  }

  try {
    const writtenProfilePath = writeProfileFile(slug, {
      pharmacyName,
      tradingName: pharmacyName,
      businessEmail: input.contactEmail,
      email: input.contactEmail,
      phone: input.telephone,
      website: input.website || "",
      primaryTown: input.primaryTown,
      primaryCity: input.primaryTown,
      townCity: input.primaryTown,
      coverageRadius: input.coverageRadius || "5 miles",
      selectedServices,
      selectedAreas,
      country: "United Kingdom",
    });

    writeProjectStub(slug, { ...input, selectedServices });

    let websiteAnalysed = false;
    let brandImported = false;
    if (input.website?.trim()) {
      try {
        const existing = normalizeProfileData(readProfileFile(slug)?.data || {});
        const analysis = await analyzeWebsiteForPharmacy(input.website.trim(), existing);
        saveBrandProfile(slug, { ...analysis.brand, approved: true });
        websiteAnalysed = true;

        const patch = mapBrandProfileToPharmacyData(analysis.brand, existing);
        const { merged } = mergeWebsiteAnalysisIntoProfile(
          { ...patch, ...analysis.profilePatch },
          existing,
          false,
        );
        writeProfileFile(slug, merged);
        brandImported = true;
      } catch (err) {
        warnings.push(`Website analysis skipped: ${String(err)}`);
      }
    }

    const placeholderCampaigns = createPlaceholderCampaigns(slug, selectedServices);

    const provision = finalizePharmacyWorkspaceProvisioning(slug, selectedServices, input.website);

    const now = new Date().toISOString();
    upsertRegistryEntry({
      slug,
      pharmacyName,
      growthPlanTier: input.growthPlanTier || "starter",
      isDemo: input.isDemo === true,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });

    return {
      slug,
      pharmacyName,
      growthProgrammeUrl: `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`,
      websiteAnalysed,
      brandImported,
      areasDiscovered: selectedAreas.length,
      placeholderCampaigns,
      profilePath: writtenProfilePath,
      warnings,
      verified: true,
      provisioningReport: provision.verification,
    };
  } catch (err) {
    rollbackPharmacyWorkspace(slug);
    removeMasterAdminRegistryEntry(slug);
    if (err instanceof WorkspaceProvisioningError) throw err;
    throw new WorkspaceProvisioningError("Workspace provisioning failed.", {
      slug,
      phase: "create-pharmacy-workspace",
      ready: false,
      checks: [],
      diagnostics: [String(err)],
    });
  }
}

export function archivePharmacyClient(slug: string): MasterAdminRegistryEntry {
  const s = safeAdminSlug(slug);
  const registry = readMasterAdminRegistry();
  const idx = registry.clients.findIndex((c) => c.slug === s);
  if (idx === -1) {
    const raw = readProfileFile(s);
    if (!raw) throw new Error(`Pharmacy not found: ${s}`);
    const entry: MasterAdminRegistryEntry = {
      slug: s,
      pharmacyName: normalizeProfileData(raw.data || {}).pharmacyName || s,
      growthPlanTier: "starter",
      isDemo: s.includes("demo"),
      archived: true,
      createdAt: raw.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
    };
    registry.clients.push(entry);
    writeMasterAdminRegistry(registry);
    return entry;
  }
  registry.clients[idx] = {
    ...registry.clients[idx]!,
    archived: true,
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeMasterAdminRegistry(registry);
  return registry.clients[idx]!;
}

export function restoreArchivedPharmacyClient(slug: string): MasterAdminRegistryEntry {
  const s = safeAdminSlug(slug);
  const registry = readMasterAdminRegistry();
  const idx = registry.clients.findIndex((c) => c.slug === s);
  if (idx === -1) throw new Error(`Pharmacy not found: ${s}`);
  registry.clients[idx] = {
    ...registry.clients[idx]!,
    archived: false,
    archivedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  writeMasterAdminRegistry(registry);
  return registry.clients[idx]!;
}

export function deleteDemoPharmacyClient(slug: string): { deleted: string[] } {
  const s = safeAdminSlug(slug);
  const registry = readMasterAdminRegistry();
  const entry = registry.clients.find((c) => c.slug === s);
  if (!entry?.isDemo && !s.startsWith("master-admin-test") && !s.startsWith("admin-client-test")) {
    throw new Error("Only demo or validation test pharmacies can be deleted");
  }

  const { removed } = rollbackPharmacyWorkspace(s);
  removeMasterAdminRegistryEntry(s);
  return { deleted: removed };
}

export function previewWizardSummary(input: CreatePharmacyWizardInput): {
  slug: string;
  pharmacyName: string;
  growthPlanLabel: string;
  serviceCount: number;
  selectedServices: string[];
  selectedServiceLabels: string[];
  areaCount: number;
  completenessEstimate: number;
} {
  const slug = input.slug
    ? safeAdminSlug(input.slug)
    : resolveUniqueSlug(slugFromPharmacyName(input.pharmacyName || "pharmacy"));
  const selectedServices = filterValidSelectedServices(input.selectedServices || []);
  const data = normalizeProfileData({
    pharmacyName: input.pharmacyName,
    businessEmail: input.contactEmail,
    phone: input.telephone,
    website: input.website,
    primaryTown: input.primaryTown,
    selectedServices,
    selectedAreas: input.selectedAreas,
  });
  return {
    slug,
    pharmacyName: input.pharmacyName,
    growthPlanLabel: TIER_LABELS[input.growthPlanTier || "starter"],
    serviceCount: selectedServices.length,
    selectedServices,
    selectedServiceLabels: resolveSelectedServiceLabels(selectedServices),
    areaCount: input.selectedAreas?.length || 0,
    completenessEstimate: computeProfileCompleteness(data, slug).score,
  };
}
