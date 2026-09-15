/**
 * Admin Client Creation V1 — admin-only pharmacy onboarding (no self-serve).
 * Creates minimal profile JSON; pharmacy completes setup via Growth Engine wizard.
 */
import fs from "node:fs";
import path from "node:path";
import {
  normalizeProfileData,
  PROFILE_SCHEMA_VERSION,
  type PharmacyProfileData,
} from "./pharmacyProfileSchema.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import {
  readMasterAdminRegistry,
  registerMasterAdminClient,
  resolveUniqueSlug,
  safeAdminSlug,
  slugFromPharmacyName,
} from "./pharmacyMasterAdminService.ts";
import { pharmacyProfilesDir } from "./pharmacyWorkspaceProvisionService.ts";
import { isValidationTestClientSlug } from "./adminClientValidationCleanup.ts";

export const ADMIN_CLIENT_STATUS_SETUP_REQUIRED = "setup_required";

export interface AdminClientCreateInput {
  pharmacyName: string;
  referenceName?: string;
  website?: string;
  town?: string;
  postcode?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  googlePlaceId?: string;
  googleBusinessProfileUrl?: string;
  notes?: string;
}

export interface AdminClientListRow {
  slug: string;
  pharmacyName: string;
  website: string;
  town: string;
  postcode: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  statusLabel: string;
  growthDashboardUrl: string;
  profileWizardUrl: string;
}

export interface AdminClientCreateResult {
  slug: string;
  pharmacyName: string;
  profilePath: string;
  redirectUrl: string;
  status: string;
}

const BACKUP_NAME_PATTERN = /\.(before-|backup|brand-v1-backup)/i;

function isBackupProfileFilename(filename: string): boolean {
  return BACKUP_NAME_PATTERN.test(filename);
}

function listProfileSlugsFromDisk(): string[] {
  const dir = pharmacyProfilesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !isBackupProfileFilename(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

function readProfileDoc(slug: string): { slug: string; updatedAt?: string; data?: Record<string, unknown> } | null {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function formatStatusLabel(status: string): string {
  if (status === ADMIN_CLIENT_STATUS_SETUP_REQUIRED) return "Setup required";
  if (status === "onboarding") return "Onboarding";
  if (status === "building") return "Building";
  if (status === "growing") return "Growing";
  if (status === "published") return "Published";
  if (status === "needs_attention") return "Needs attention";
  if (status === "active") return "Active";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveClientStatus(_slug: string, data: PharmacyProfileData): { status: string; statusLabel: string } {
  const status = data.platformClientStatus || "active";
  return { status, statusLabel: formatStatusLabel(status) };
}

export function listAdminClientPharmacies(): AdminClientListRow[] {
  const registry = readMasterAdminRegistry();
  const rows: AdminClientListRow[] = [];

  for (const slug of listProfileSlugsFromDisk()) {
    if (isValidationTestClientSlug(slug)) continue;
    const doc = readProfileDoc(slug);
    if (!doc) continue;
    const data = normalizeProfileData(doc.data || {});
    const entry = registry.clients.find((c) => c.slug === slug);
    const { status, statusLabel } = resolveClientStatus(slug, data);
    const stat = fs.statSync(profilePath(slug));

    rows.push({
      slug,
      pharmacyName: data.pharmacyName || data.tradingName || slug,
      website: data.website || "",
      town: data.primaryTown || data.townCity || "",
      postcode: data.postcode || "",
      createdAt: entry?.createdAt || doc.updatedAt || stat.birthtime.toISOString(),
      updatedAt: doc.updatedAt || entry?.updatedAt || stat.mtime.toISOString(),
      status,
      statusLabel,
      growthDashboardUrl: `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`,
      profileWizardUrl: `/api/pharmacy-profile-wizard?slug=${encodeURIComponent(slug)}`,
    });
  }

  return rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function normalizeWebsite(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

export function previewAdminClientSlug(pharmacyName: string): string {
  return resolveUniqueSlug(slugFromPharmacyName(pharmacyName));
}

export function createAdminPharmacyClient(input: AdminClientCreateInput): AdminClientCreateResult {
  const pharmacyName = String(input.pharmacyName || "").trim();
  const website = normalizeWebsite(input.website || "");
  const town = String(input.town || "").trim();
  const postcode = String(input.postcode || "").trim().toUpperCase();

  if (!pharmacyName) throw new Error("Pharmacy name is required");

  const slug = resolveUniqueSlug(slugFromPharmacyName(pharmacyName));
  if (!slug) throw new Error("Could not generate a valid slug");

  const file = profilePath(slug);
  if (fs.existsSync(file)) {
    throw new Error(`Pharmacy profile already exists for slug "${slug}". Choose a different name or use the existing client.`);
  }

  const now = new Date().toISOString();
  const data = normalizeProfileData({
    pharmacyName,
    tradingName: pharmacyName,
    website,
    primaryTown: town,
    primaryCity: town,
    townCity: town,
    postcode,
    primaryContactName: String(input.contactName || "").trim(),
    businessEmail: String(input.contactEmail || "").trim(),
    email: String(input.contactEmail || "").trim(),
    phone: String(input.phone || "").trim(),
    googlePlaceId: String(input.googlePlaceId || "").trim(),
    googleBusinessProfileUrl: String(input.googleBusinessProfileUrl || "").trim(),
    adminNotes: String(input.notes || "").trim(),
    platformClientStatus: ADMIN_CLIENT_STATUS_SETUP_REQUIRED,
    country: "United Kingdom",
    selectedServices: [],
  });

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        slug,
        updatedAt: now,
        version: PROFILE_SCHEMA_VERSION,
        data,
      },
      null,
      2,
    ),
  );

  registerMasterAdminClient(slug, pharmacyName);

  return {
    slug,
    pharmacyName,
    profilePath: file,
    redirectUrl: `/api/growth-engine/start?slug=${encodeURIComponent(slug)}`,
    status: ADMIN_CLIENT_STATUS_SETUP_REQUIRED,
  };
}

export function adminClientSlugAvailable(slug: string): boolean {
  const safe = safeAdminSlug(slug);
  if (!safe) return false;
  return !fs.existsSync(profilePath(safe));
}
