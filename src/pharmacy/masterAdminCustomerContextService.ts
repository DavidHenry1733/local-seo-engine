/**
 * Master Admin Customer Context V1 — shared read-only tenant signals for workflow + lite dashboard.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { readMasterAdminRegistry } from "./pharmacyMasterAdminService.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";

const META_PATH = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/client-meta.json");

function readMeta(slug: string): { suspended: boolean; accountManager: string } {
  if (!fs.existsSync(META_PATH)) return { suspended: false, accountManager: "Unassigned" };
  try {
    const store = JSON.parse(fs.readFileSync(META_PATH, "utf8")) as Record<
      string,
      { suspended?: boolean; accountManager?: string }
    >;
    const meta = store[slug];
    return { suspended: meta?.suspended || false, accountManager: meta?.accountManager || "Unassigned" };
  } catch {
    return { suspended: false, accountManager: "Unassigned" };
  }
}

export interface MasterAdminCustomerContext {
  slug: string;
  data: PharmacyProfileData;
  profileUpdatedAt: string;
  registryUpdatedAt: string;
  archived: boolean;
  suspended: boolean;
  accountManager: string;
  pharmacyName: string;
  website: string;
  serviceId: string;
  session: { selectedServiceId: string; generationStartedAt: string | null; generationCompletedAt: string | null };
  live: { lastPublishedAt: string | null; staticOutputReady: boolean };
  indexing: { indexed: number; submitted: number; totalRegistered: number };
  rank: { status: string; keywords: number };
  contentGenerated: boolean;
  contentReviewed: boolean;
  contentApproved: boolean;
  growthIntelligenceAcknowledged: boolean;
  businessProfileIntelligenceAcknowledged: boolean;
  profileApproved: boolean;
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function packagePath(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", key, `${serviceId}.json`);
}

export function loadMasterAdminCustomerContext(slug: string): MasterAdminCustomerContext | null {
  const registry = readMasterAdminRegistry();
  const entry = registry.clients.find((c) => c.slug === slug);
  if (!entry) return null;

  const doc = readJson<{ updatedAt?: string; data?: Record<string, unknown> }>(profilePath(slug));
  if (!doc) return null;

  const meta = readMeta(slug);
  const data = normalizeProfileData(doc.data || {});
  const sessionRaw = readJson<{
    selectedServiceId?: string;
    generationStartedAt?: string | null;
    generationCompletedAt?: string | null;
  }>(path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`));
  const session = {
    selectedServiceId: sessionRaw?.selectedServiceId || "",
    generationStartedAt: sessionRaw?.generationStartedAt || null,
    generationCompletedAt: sessionRaw?.generationCompletedAt || null,
  };
  const activeCampaignServiceId = readActiveServiceCampaignSelection(slug)?.serviceId || "";
  const serviceId =
    activeCampaignServiceId ||
    (data.selectedServices?.length ? String(data.selectedServices[0]) : "") ||
    session.selectedServiceId ||
    "pharmacy-first";

  const liveRaw = readJson<{ lastPublishedAt?: string | null; staticOutputReady?: boolean }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-publish-status", `${slug}.json`),
  );
  const indexRaw = readJson<{ indexed?: number; submitted?: number; totalRegistered?: number }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${slug}.json`),
  );
  const rankFile = path.join(WORKSPACE_ROOT, "output", slug, "rank-tracking.json");
  let rank = { status: "not_started", keywords: 0 };
  if (fs.existsSync(rankFile)) {
    const rankRaw = readJson<{ summary?: { keywordsCount?: number } }>(rankFile);
    const keywords = rankRaw?.summary?.keywordsCount || 0;
    rank = { status: keywords > 0 ? "active" : "limited", keywords };
  }

  const pkg = readJson<{ generatedAt?: string; status?: string; reviewedAt?: string; approvalStatus?: string }>(
    packagePath(slug, serviceId),
  );
  const contentGenerated = Boolean(pkg?.generatedAt && pkg.status !== "missing" && pkg.status !== "error");
  const contentReviewed = Boolean(pkg?.reviewedAt);
  const contentApproved = pkg?.approvalStatus === "approved";

  const workflowDoc = readJson<{ acknowledgements?: Record<string, string> }>(
    path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-workflow.json`),
  );
  const growthIntelligenceAcknowledged = Boolean(workflowDoc?.acknowledgements?.["growth-intelligence"]);
  const businessProfileIntelligenceAcknowledged = Boolean(workflowDoc?.acknowledgements?.["business-profile-intelligence"]);

  const platformStatus = data.platformClientStatus || "";
  const profileApproved =
    platformStatus === "active" ||
    platformStatus === "profile_approved" ||
    Boolean(data.profileFieldConfirmations && Object.keys(data.profileFieldConfirmations).length >= 5);

  return {
    slug,
    data,
    profileUpdatedAt: doc.updatedAt || entry.updatedAt,
    registryUpdatedAt: entry.updatedAt,
    archived: entry.archived,
    suspended: meta.suspended,
    accountManager: meta.accountManager,
    pharmacyName: data.pharmacyName || entry.pharmacyName || slug,
    website: data.website || "",
    serviceId,
    session,
    live: {
      lastPublishedAt: liveRaw?.lastPublishedAt || null,
      staticOutputReady: Boolean(liveRaw?.staticOutputReady),
    },
    indexing: {
      indexed: indexRaw?.indexed || 0,
      submitted: indexRaw?.submitted || 0,
      totalRegistered: indexRaw?.totalRegistered || 0,
    },
    rank,
    contentGenerated,
    contentReviewed,
    contentApproved,
    growthIntelligenceAcknowledged,
    businessProfileIntelligenceAcknowledged,
    profileApproved,
  };
}
