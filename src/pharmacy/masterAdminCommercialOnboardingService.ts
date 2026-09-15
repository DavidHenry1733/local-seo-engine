/**
 * Master Admin Commercial Onboarding V1 — browser-driven new pharmacy creation.
 */
import fs from "node:fs";
import path from "node:path";
import {
  normalizeProfileData,
  PROFILE_SCHEMA_VERSION,
} from "./pharmacyProfileSchema.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import {
  readMasterAdminRegistry,
  registerMasterAdminClient,
  resolveUniqueSlug,
  slugFromPharmacyName,
} from "./pharmacyMasterAdminService.ts";
import { finalizePharmacyWorkspaceProvisioning } from "./pharmacyWorkspaceProvisionService.ts";
import { getPharmacyProjectConfigPath } from "./pharmacyWorkspacePaths.ts";
import { createPharmacyCampaign } from "./pharmacyCampaignService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { recordWorkflowTransition } from "./masterAdminWorkflowHistoryService.ts";
import { createCustomerAccount, getCustomerAccountSummary, prepareWelcomeCredentialsDraft } from "./masterAdminAccountService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { randomBytes } from "node:crypto";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";

export const DEFAULT_COMMERCIAL_SERVICE_ID = "pharmacy-first";

const META_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "client-meta.json");

interface ClientMetaSlice {
  slug: string;
  suspended: boolean;
  accountManager: string;
  passwordResetToken?: string;
  passwordResetTokenCreatedAt?: string;
}

function readMetaStore(): Record<string, ClientMetaSlice & Record<string, unknown>> {
  if (!fs.existsSync(META_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(META_PATH, "utf8")) as Record<string, ClientMetaSlice & Record<string, unknown>>;
  } catch {
    return {};
  }
}

function writeMetaSlice(meta: ClientMetaSlice): void {
  const store = readMetaStore();
  store[meta.slug] = { ...store[meta.slug], ...meta };
  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, JSON.stringify(store, null, 2));
}

function getMetaSlice(slug: string): ClientMetaSlice {
  const safe = safeAdminSlug(slug);
  return readMetaStore()[safe] || { slug: safe, suspended: false, accountManager: "Unassigned" };
}

export interface CommercialPharmacyCreateInput {
  pharmacyName: string;
  website: string;
  contactEmail: string;
  phone?: string;
  accountManager?: string;
  notes?: string;
  googleBusinessProfileUrl?: string;
  googlePlaceId?: string;
  postcode?: string;
  supportContactName?: string;
  supportContactEmail?: string;
}

export interface CommercialPharmacyCreateResult {
  slug: string;
  pharmacyName: string;
  profilePath: string;
  redirectUrl: string;
  status: string;
  username: string;
  temporaryPassword: string;
  customerRecordUrl: string;
}

function normalizeWebsite(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeProjectConfigStub(
  slug: string,
  input: CommercialPharmacyCreateInput,
): string {
  const file = getPharmacyProjectConfigPath(slug);
  ensureDir(path.dirname(file));
  const domain = normalizeWebsite(input.website).replace(/\/$/, "") || `https://${slug}.pharmaconnect.uk`;
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        clientSlug: slug,
        businessName: input.pharmacyName,
        domain,
        phone: input.phone || "",
        email: input.contactEmail,
        branding: { primaryColor: "#005EB8", accentColor: "#1CA9C9" },
        services: [DEFAULT_COMMERCIAL_SERVICE_ID],
        locations: [],
      },
      null,
      2,
    ),
  );
  return file;
}

function seedPlaceholderCampaign(slug: string): void {
  try {
    createPharmacyCampaign(slug, {
      serviceId: DEFAULT_COMMERCIAL_SERVICE_ID,
      campaignGoal: "Pharmacy Growth",
    });
  } catch {
    /* campaign store may already exist from provisioning */
  }
}

export function validateCommercialCreateInput(input: CommercialPharmacyCreateInput): void {
  const pharmacyName = String(input.pharmacyName || "").trim();
  const website = normalizeWebsite(input.website || "");
  const email = String(input.contactEmail || "").trim();
  if (!pharmacyName) throw new Error("Business name is required");
  if (!website) throw new Error("Website URL is required");
  if (!email || !email.includes("@")) throw new Error("Primary email is required");
}

export async function createCommercialPharmacyCustomer(
  input: CommercialPharmacyCreateInput,
  operator: string,
): Promise<CommercialPharmacyCreateResult> {
  const intake = input as import("./masterAdminOnboardingIntakeService.ts").OnboardingIntakeInput;
  const { validateOnboardingIntake, persistOnboardingIntake } = await import("./masterAdminOnboardingIntakeService.ts");
  const validation = validateOnboardingIntake(intake);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  validateCommercialCreateInput(input);

  const pharmacyName = String(input.pharmacyName).trim();
  const website = normalizeWebsite(input.website);
  const email = String(input.contactEmail).trim();
  const phone = String(input.phone || "").trim();
  const accountManager = String(input.accountManager || "").trim() || "Unassigned";
  const notes = String(input.notes || "").trim();
  const postcode = String(input.postcode || "").trim().toUpperCase();
  const googleBusinessProfileUrl = String(input.googleBusinessProfileUrl || input.googlePlaceId || "").trim();

  const slug = resolveUniqueSlug(slugFromPharmacyName(pharmacyName));
  if (!slug) throw new Error("Could not generate a valid customer ID");

  const file = profilePath(slug);
  if (fs.existsSync(file)) {
    throw new Error(`Customer already exists for slug "${slug}"`);
  }

  const registry = readMasterAdminRegistry();
  if (registry.clients.some((c) => c.slug === slug && !c.archived)) {
    throw new Error(`Customer registry entry already exists: ${slug}`);
  }

  const now = new Date().toISOString();
  const data = normalizeProfileData({
    pharmacyName,
    tradingName: pharmacyName,
    website,
    businessEmail: email,
    email,
    phone,
    postcode,
    adminNotes: notes,
    platformClientStatus: "setup_required",
    country: "United Kingdom",
    selectedServices: [DEFAULT_COMMERCIAL_SERVICE_ID],
  });

  ensureDir(path.dirname(file));
  fs.writeFileSync(
    file,
    JSON.stringify({ slug, updatedAt: now, version: PROFILE_SCHEMA_VERSION, data }, null, 2),
  );

  registerMasterAdminClient(slug, pharmacyName);

  writeProjectConfigStub(slug, { ...input, pharmacyName, website, contactEmail: email, phone });
  seedPlaceholderCampaign(slug);
  finalizePharmacyWorkspaceProvisioning(slug, [DEFAULT_COMMERCIAL_SERVICE_ID], website);

  const meta = getMetaSlice(slug);
  meta.accountManager = accountManager;
  writeMetaSlice(meta);

  recordWorkflowTransition({
    slug,
    fromStage: "create_customer",
    toStage: "website_import",
    operator,
    reason: "Commercial customer created",
    evidence: `Profile, workspace, and ${DEFAULT_COMMERCIAL_SERVICE_ID} campaign provisioned`,
  });

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "create_customer",
    status: "success",
    evidence: `Commercial customer ${pharmacyName} (${slug}) created with workspace provisioning`,
    meta: { website, email, accountManager },
  });

  const account = await createCustomerAccount(slug, operator);
  prepareWelcomeCredentialsDraft(slug, operator);

  const {
    createOnboardingBatch,
    prepareGoogleSourceForBatch,
    startOnboardingBatchImports,
    persistUnifiedIntakeFields,
  } = await import("./masterAdminOnboardingBatchService.ts");
  const { shouldRunGoogleImport, normalizeGoogleProfileStateInput } = await import(
    "./masterAdminGoogleProfileOnboardingService.ts",
  );

  persistUnifiedIntakeFields(slug, input);
  createOnboardingBatch(slug, input, operator);
  persistOnboardingIntake(slug, intake, operator);

  const googleState = normalizeGoogleProfileStateInput(
    intake.googleProfileState,
    Boolean(googleBusinessProfileUrl),
  );
  if (shouldRunGoogleImport(googleState) && googleBusinessProfileUrl) {
    try {
      await prepareGoogleSourceForBatch(slug, input, operator);
    } catch (err) {
      recordMasterAdminAudit({
        user: operator,
        slug,
        action: "prepare_google_source_for_batch",
        status: "warning",
        evidence: `Google source prep failed — website import will still queue: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  startOnboardingBatchImports(slug, operator);

  const { enableCoreProductRecoveryContract } = await import("./masterAdminCoreProductRecoveryService.ts");
  enableCoreProductRecoveryContract(slug, operator);

  return {
    slug,
    pharmacyName,
    profilePath: file,
    redirectUrl: `/api/admin/master?customer=${encodeURIComponent(slug)}`,
    customerRecordUrl: `/api/master-admin-platform/customers/${encodeURIComponent(slug)}`,
    status: "setup_required",
    username: account.username,
    temporaryPassword: account.temporaryPassword,
  };
}

export function generatePasswordResetToken(slug: string): string {
  const meta = getMetaSlice(slug);
  const token = randomBytes(24).toString("base64url");
  meta.passwordResetToken = token;
  meta.passwordResetTokenCreatedAt = new Date().toISOString();
  writeMetaSlice(meta);
  return token;
}

export async function finalizeCommercialOnboardingCompletion(
  slug: string,
  operator: string,
): Promise<{ username: string; welcomeDraft: string; passwordResetToken: string }> {
  let accountSummary = getCustomerAccountSummary(slug);
  if (!accountSummary.hasAccount) {
    const account = await createCustomerAccount(slug, operator);
    accountSummary = { ...getCustomerAccountSummary(slug), username: account.username, hasAccount: true };
  }
  const username = accountSummary.username || `${safeAdminSlug(slug)}@pharmaconnect.uk`;

  const passwordResetToken = generatePasswordResetToken(slug);
  const { draft } = prepareWelcomeCredentialsDraft(slug, operator);

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "onboarding_complete",
    status: "success",
    evidence: "Customer Ready — account verified, welcome draft prepared, reset token issued",
    meta: { username, passwordResetTokenIssued: true },
  });

  return { username, welcomeDraft: draft, passwordResetToken };
}

export function isSprint7AValidationSlug(slug: string): boolean {
  return slug.startsWith("sprint-7a-commercial-onboarding");
}
