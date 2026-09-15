/**
 * Sprint 8A / Defect 047 — Pre-generation validation gate (readiness only; no generation).
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { getCustomerAccountDetail } from "./masterAdminAccountService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { buildGoogleSourceSummary, readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import {
  isBusinessProfileReviewApproved,
  readLatestApprovalSnapshot,
  readReviewStore,
} from "./masterAdminBusinessProfileReviewService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import {
  getAllRequiredPharmacyWorkspacePaths,
  getPharmacyImageAssignmentsPath,
  getPharmacyBrandDnaPath,
  safePharmacySlug,
} from "./pharmacyWorkspacePaths.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  getPharmacyComponentDnaPath,
  hasCanonicalComponentDna,
} from "./masterAdminComponentDnaPersistenceService.ts";
import { hasConfirmedLocalAreas } from "./masterAdminGenerationSetupService.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import { resolveGoogleGenerationReadiness } from "./masterAdminGoogleGenerationReadinessService.ts";

export type PreGenerationCheckSeverity = "blocker" | "warning" | "info" | "opportunity";

export interface PreGenerationDependencyCheck {
  id: string;
  group: string;
  label: string;
  severity: PreGenerationCheckSeverity;
  passed: boolean;
  evidence: string;
}

export interface PreGenerationValidationResult {
  slug: string;
  readiness: "READY TO GENERATE" | "BLOCKED";
  dependenciesChecked: number;
  passCount: number;
  /** @deprecated use blockers */
  missingDependencies: string[];
  blockers: string[];
  warnings: string[];
  opportunities: string[];
  warningCount: number;
  checks: PreGenerationDependencyCheck[];
  validatedAt: string;
}

const BLOCKER_IDS = new Set([
  "canonical_website",
  "website_intelligence",
  "profile_approved",
  "growth_intelligence",
  "input_component_dna",
  "input_brand_dna",
  "workspace_exists",
  "output_visualExperienceDir",
  "output_contentEcosystemDir",
  "output_publishDir",
  "output_uploadDir",
  "input_local_areas",
  "google_profile_decision",
  "google_import_required",
  "google_identifier_required",
]);

const WARNING_IDS = new Set([
  "customer_status_active",
  "customer_never_logged_in",
  "input_competitors",
  "input_images",
  "welcome_email_not_sent",
  "rank_history_empty",
  "search_console_not_connected",
]);

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return text(value) !== "";
}

function hasAssignedImages(slug: string): boolean {
  const file = getPharmacyImageAssignmentsPath(slug);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      assignments?: Record<string, unknown>;
      uploads?: unknown[];
    };
    const assignmentCount = Object.keys(raw.assignments || {}).length;
    const uploadCount = Array.isArray(raw.uploads) ? raw.uploads.length : 0;
    return assignmentCount > 0 || uploadCount > 0;
  } catch {
    return false;
  }
}

function hasLocalAreas(profile: ReturnType<typeof readSetupProfile>): boolean {
  return hasConfirmedLocalAreas(profile);
}

function hasCompetitorIntelligence(slug: string): boolean {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-growth-journey", `${safePharmacySlug(slug)}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      competitor?: { competitorCount?: number; topCompetitors?: unknown[] };
    };
    const count = raw.competitor?.competitorCount ?? 0;
    const top = raw.competitor?.topCompetitors || [];
    return count > 0 || top.length > 0;
  } catch {
    return false;
  }
}

function hasComponentDna(slug: string): boolean {
  return hasCanonicalComponentDna(slug);
}

function hasBrandDna(slug: string): boolean {
  const file = getPharmacyBrandDnaPath(slug);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    return Object.keys(raw).length > 0;
  } catch {
    return false;
  }
}

function isSearchConsoleConnected(slug: string): boolean {
  const indexingPath = path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${safePharmacySlug(slug)}.json`);
  if (fs.existsSync(indexingPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(indexingPath, "utf8")) as { gscConnected?: boolean; connected?: boolean };
      if (raw.gscConnected || raw.connected) return true;
    } catch {
      /* fall through */
    }
  }
  const gscTokens = "/tmp/.gsc-oauth-tokens.json";
  const gscDisconnected = "/tmp/.gsc-oauth-disconnected";
  return fs.existsSync(gscTokens) && !fs.existsSync(gscDisconnected);
}

function hasRankHistory(slug: string): boolean {
  const visibilityPath = path.join(WORKSPACE_ROOT, "data/pharmacy-visibility", `${safePharmacySlug(slug)}.json`);
  if (!fs.existsSync(visibilityPath)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(visibilityPath, "utf8")) as {
      rankHistory?: unknown[];
      history?: unknown[];
      snapshots?: unknown[];
    };
    return (raw.rankHistory?.length || 0) > 0 || (raw.history?.length || 0) > 0 || (raw.snapshots?.length || 0) > 0;
  } catch {
    return false;
  }
}

function welcomeEmailSent(account: ReturnType<typeof getCustomerAccountDetail>): boolean {
  if (!account.hasAccount) return false;
  if (account.accountStatus === "active" && account.lastLoginAt) return true;
  return Boolean(account.welcomeEmailDraft);
}

export function runPreGenerationValidation(slug: string): PreGenerationValidationResult {
  const safe = safePharmacySlug(slug);
  const checks: PreGenerationDependencyCheck[] = [];

  const profile = readSetupProfile(safe);
  const account = getCustomerAccountDetail(safe);
  const website = buildWebsiteSourceSummary(safe);
  const google = buildGoogleSourceSummary(safe);
  const googleIntel = readGoogleIntelligenceRecord(safe);
  const ctx = loadMasterAdminCustomerContext(safe);
  const snapshot = readLatestApprovalSnapshot(safe);
  const store = readReviewStore(safe);
  const workspace = getAllRequiredPharmacyWorkspacePaths(safe);

  const add = (
    id: string,
    group: string,
    label: string,
    passed: boolean,
    evidence: string,
    severity: PreGenerationCheckSeverity = BLOCKER_IDS.has(id) ? "blocker" : WARNING_IDS.has(id) ? "warning" : "info",
  ) => {
    checks.push({ id, group, label, severity, passed, evidence });
  };

  add(
    "canonical_website",
    "Website",
    "Canonical website exists",
    present(profile.website),
    profile.website || "missing",
  );
  add(
    "website_intelligence",
    "Website",
    "Website Intelligence imported",
    Boolean(website.importedEvidence?.importedAt || website.websiteImported),
    String(website.importedEvidence?.importedAt || website.importState || "not imported"),
  );

  const googleState = resolveGoogleProfileOnboardingState(profile);
  const googleReadiness = resolveGoogleGenerationReadiness({
    profile,
    hasGoogleImport: Boolean(googleIntel?.importedAt || google.googleImported),
    googleImportStatus: googleIntel?.importedAt ? "Imported" : google.importState || "Not connected",
  });

  add(
    "google_profile_state",
    "Google",
    "Google Business Profile state",
    googleReadiness.generationAllowed || googleState === "no_profile" || googleState === "deferred",
    googleState,
    "info",
  );
  add(
    "google_intelligence",
    "Google",
    "Google Intelligence imported",
    !googleReadiness.importRequired || Boolean(googleIntel?.importedAt || google.googleImported),
    String(googleIntel?.importedAt || google.importState || "not imported"),
    googleReadiness.importRequired ? "blocker" : "info",
  );
  if (googleReadiness.blockers.includes("Google Business Profile decision required")) {
    add("google_profile_decision", "Google", "Google Business Profile decision", false, googleState, "blocker");
  }
  if (googleReadiness.blockers.includes("Google Import missing")) {
    add("google_import_required", "Google", "Google Import required", false, google.importState || "not imported", "blocker");
  }
  if (
    googleReadiness.blockers.some((b) =>
      /Place ID required|URL or Place ID required|Selected Google Place ID/.test(b),
    )
  ) {
    add(
      "google_identifier_required",
      "Google",
      "Google identifier required",
      false,
      profile.googlePlaceId || google.placeId || profile.googleBusinessProfileUrl || "missing",
      "blocker",
    );
  }
  add(
    "google_confirmed",
    "Google",
    "Google Business Profile confirmed",
    google.confirmationStatus === "confirmed" || googleState === "no_profile" || googleState === "deferred",
    google.confirmationStatus || googleState,
    "info",
  );
  add(
    "google_place_id",
    "Google",
    "Place ID stored",
    !googleReadiness.identifierRequired || present(profile.googlePlaceId) || present(google.placeId),
    profile.googlePlaceId || google.placeId || "not required",
    "info",
  );
  for (const warning of googleReadiness.warnings) {
    add(`google_warning_${warning}`, "Google", warning, false, googleState, "warning");
  }
  for (const opportunity of googleReadiness.opportunities) {
    add(`google_opportunity_${opportunity}`, "Google", opportunity, false, googleState, "opportunity");
  }

  add(
    "profile_approved",
    "Business Profile",
    "Canonical Business Profile approved",
    isBusinessProfileReviewApproved(safe),
    store?.approvalStatus || "draft",
  );
  add(
    "approval_snapshot",
    "Business Profile",
    "Approval snapshot exists",
    Boolean(snapshot?.approvedAt),
    snapshot?.approvedAt || "missing",
    "info",
  );
  add(
    "profile_revision",
    "Business Profile",
    "Profile revision exists",
    (snapshot?.profileRevision ?? store?.profileRevision ?? 0) > 0,
    String(snapshot?.profileRevision ?? store?.profileRevision ?? 0),
    "info",
  );

  add(
    "growth_intelligence",
    "Growth",
    "Growth Intelligence complete",
    Boolean(ctx?.growthIntelligenceAcknowledged),
    ctx?.growthIntelligenceAcknowledged ? "acknowledged" : "not acknowledged",
  );

  add(
    "input_local_areas",
    "Generation Inputs",
    "Local areas",
    hasLocalAreas(profile),
    (profile.selectedAreas || []).filter((a) => a.selected !== false).map((a) => a.areaName).join(", ")
      || profile.primaryTown
      || profile.townCity
      || "missing",
  );
  add(
    "input_component_dna",
    "Generation Inputs",
    "Component DNA",
    hasComponentDna(safe),
    hasComponentDna(safe) ? getPharmacyComponentDnaPath(safe) : "missing",
  );
  add(
    "input_brand_dna",
    "Generation Inputs",
    "Brand DNA",
    hasBrandDna(safe),
    hasBrandDna(safe) ? getPharmacyBrandDnaPath(safe) : "missing",
  );

  add(
    "workspace_exists",
    "Workspace",
    "Workspace exists",
    fs.existsSync(workspace.workspaceRoot),
    workspace.workspaceRoot,
  );
  for (const key of ["visualExperienceDir", "contentEcosystemDir", "publishDir", "uploadDir"] as const) {
    add(
      `output_${key}`,
      "Workspace",
      `Output folder exists (${key})`,
      fs.existsSync(workspace[key]),
      workspace[key],
    );
  }

  add(
    "customer_status_active",
    "Customer",
    "Customer pending first login",
    account.accountStatus === "active",
    account.accountStatus,
  );
  add(
    "customer_never_logged_in",
    "Customer",
    "Customer has never logged in",
    Boolean(account.lastLoginAt),
    account.lastLoginAt || "never",
  );
  add(
    "input_competitors",
    "Generation Inputs",
    "Competitor Intelligence missing",
    hasCompetitorIntelligence(safe),
    hasCompetitorIntelligence(safe) ? "competitor intelligence present" : "no competitor analysis",
  );
  add(
    "input_images",
    "Generation Inputs",
    "Custom Images missing",
    hasAssignedImages(safe),
    hasAssignedImages(safe) ? "image assignments present" : "no image assignments",
  );
  add(
    "welcome_email_not_sent",
    "Customer",
    "Welcome email not sent",
    welcomeEmailSent(account),
    welcomeEmailSent(account) ? "welcome credentials prepared or customer active" : "welcome email not sent",
  );
  add(
    "rank_history_empty",
    "Growth",
    "Rank history empty",
    hasRankHistory(safe),
    hasRankHistory(safe) ? "rank history present" : "empty",
  );
  add(
    "search_console_not_connected",
    "Growth",
    "Search Console not connected",
    isSearchConsoleConnected(safe),
    isSearchConsoleConnected(safe) ? "connected" : "not connected",
  );

  const BLOCKER_LABELS: Record<string, string> = {
    canonical_website: "Canonical Website missing",
    website_intelligence: "Website Import missing",
    google_import_required: "Google Import missing",
    google_identifier_required: "Google Business Profile identifier missing",
    google_profile_decision: "Google Business Profile decision required",
    profile_approved: "Canonical Business Profile not approved",
    growth_intelligence: "Growth Intelligence missing",
    input_component_dna: "Component DNA missing",
    input_brand_dna: "Brand DNA missing",
    workspace_exists: "Workspace missing",
    output_visualExperienceDir: "Output folders missing",
    output_contentEcosystemDir: "Output folders missing",
    output_publishDir: "Output folders missing",
    output_uploadDir: "Output folders missing",
    input_local_areas: "Local Areas missing",
  };

  const WARNING_LABELS: Record<string, string> = {
    customer_status_active: "Customer pending first login",
    customer_never_logged_in: "Customer has never logged in",
    input_competitors: "Competitor Intelligence missing",
    input_images: "Custom Images missing",
    welcome_email_not_sent: "Welcome email not sent",
    rank_history_empty: "Rank history empty",
    search_console_not_connected: "Search Console not connected",
  };

  const blockers = [
    ...new Set([
      ...googleReadiness.blockers,
      ...checks
        .filter((c) => c.severity === "blocker" && !c.passed)
        .map((c) => BLOCKER_LABELS[c.id] || c.label),
    ]),
  ];
  const warnings = [
    ...new Set([
      ...googleReadiness.warnings,
      ...checks
        .filter((c) => c.severity === "warning" && !c.passed)
        .map((c) => WARNING_LABELS[c.id] || c.label),
    ]),
  ];
  const opportunities = [...new Set(googleReadiness.opportunities)];

  return {
    slug: safe,
    readiness: blockers.length ? "BLOCKED" : "READY TO GENERATE",
    dependenciesChecked: checks.length,
    passCount: checks.filter((c) => c.passed).length,
    missingDependencies: blockers,
    blockers,
    warnings,
    opportunities,
    warningCount: warnings.length,
    checks,
    validatedAt: new Date().toISOString(),
  };
}
