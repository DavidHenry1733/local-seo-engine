/**
 * Sprint 7B — Business Profile Review and Approval service.
 * Orchestration layer only — does not modify import engines or generators.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import {
  buildGoogleSourceSummary,
  readGoogleIntelligenceRecord,
  reconcileConfirmedGoogleImportPersistence,
} from "./masterAdminCanonicalGoogleService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import {
  finishWorkflowExecution,
  recordWorkflowTransition,
  startWorkflowExecution,
} from "./masterAdminWorkflowHistoryService.ts";
import { writeWorkflowAcknowledgement } from "./masterAdminWorkflowAckService.ts";
import { createMasterAdminIssue } from "./masterAdminIssueService.ts";
import type {
  BusinessProfileApprovalSnapshot,
  BusinessProfileReviewField,
  BusinessProfileReviewPayload,
  BusinessProfileReviewStore,
  BusinessProfileReviewSummary,
  CompletenessSection,
  ConflictClassification,
  OperatorDecisionAction,
  ReadinessLabel,
  ReviewFieldCategory,
  ReviewFieldDecision,
} from "./masterAdminBusinessProfileReviewModel.ts";
import {
  FIELD_META,
  buildDisplayStatus,
  buildCommercialActionLabel,
  classifyEvidence,
  fieldApprovalBlockReason,
  formatPostcode,
  isGarbageWebsiteValue,
  isSafeToAutoAccept,
  normText,
  normPhone,
  normPostcode,
  pickTrustedValue,
  resolveReviewTier,
} from "./masterAdminBusinessProfileReviewLogic.ts";
import {
  buildBusinessProfileGoogleSection,
  canApproveBusinessProfileWithGoogleState,
  GOOGLE_IDENTITY_REVIEW_FIELD_IDS,
  googleIdentityUnavailableLabel,
  isGoogleIntelligenceRequiredForBusinessProfile,
  validateBusinessProfileGoogleFieldSave,
} from "./masterAdminBusinessProfileGoogleValidation.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import { websiteImportStageComplete } from "./masterAdminWebsiteBranchSelectionService.ts";
import {
  isGoogleOnboardingResolvedWithoutImport,
  manualBrandConfirmationOffer,
  readManualOnboardingBrandSource,
} from "./masterAdminGoogleLaterBrandEvidence.ts";
import {
  buildServiceReconciliationProposal,
  formatServiceMatchStateLabel,
  resolveDeterministicServiceIdFromName,
  type ServiceReconciliationProposal,
} from "./growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import {
  applyBprFieldApplicability,
  bprApplicabilityReason,
  resolveBprFieldApplicability,
  type BprApplicabilityContext,
} from "./masterAdminBusinessProfileReviewApplicability.ts";
import {
  chosenWeeklyDays,
  resolveBusinessProfileWeeklyHours,
  weeklyDaysToProfilePatch,
  type WeeklyOpeningHoursEvidence,
} from "./masterAdminBusinessProfileOpeningHoursService.ts";

const REVIEW_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/business-profile-review");
const APPROVAL_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/business-profile-approvals");
fs.mkdirSync(REVIEW_DIR, { recursive: true });
fs.mkdirSync(APPROVAL_DIR, { recursive: true });

/** Review-store decision key — not a Business Profile field spec. */
export const SERVICE_RECONCILIATION_CONFIRMATION_FIELD_ID = "serviceReconciliationProposal";

function isServiceReconciliationProposalConfirmed(
  proposal: ServiceReconciliationProposal,
  store: BusinessProfileReviewStore | null,
): boolean {
  if (proposal.downstreamTrusted) return true;
  if (proposal.approvedCanonicalServiceIds?.length) return true;
  const decision = store?.decisions?.[SERVICE_RECONCILIATION_CONFIRMATION_FIELD_ID];
  return Boolean(decision && ["confirm", "auto_accept"].includes(decision.action));
}

function pendingServiceReconciliationConfirmations(
  proposal: ServiceReconciliationProposal,
  store: BusinessProfileReviewStore | null,
): { count: number; labels: string[] } {
  if (!proposal.proposedCanonicalServiceIds.length) return { count: 0, labels: [] };
  if (isServiceReconciliationProposalConfirmed(proposal, store)) return { count: 0, labels: [] };
  const proposed = new Set(proposal.proposedCanonicalServiceIds);
  const labels = proposal.rows
    .filter((r) => r.proposedForCanonical && proposed.has(r.canonicalServiceId))
    .map((r) => `Confirm proposed canonical service: ${r.canonicalServiceName}`);
  return { count: proposal.proposedCanonicalServiceIds.length, labels };
}

/** Single GET/POST approval-readiness authority. Service pending cannot be 0/Ready while POST would 409. */
export function resolveBusinessProfileApprovalAuthority(review: BusinessProfileReviewPayload): {
  remainingConfirmations: number;
  readinessLabel: ReadinessLabel;
  approvalDisabledReason: string | null;
  canApprove: boolean;
} {
  const summary = review.summary;
  const pending = Number(review.serviceReconciliation?.pendingConfirmationCount || 0);
  const remainingConfirmations = Math.max(
    Number(summary?.remainingConfirmations || 0),
    Number(summary?.needsConfirmationCount || 0),
    pending,
  );
  const alreadyApproved = summary?.approvalStatus === "approved";
  let readinessLabel: ReadinessLabel = summary?.readinessLabel || `NEEDS ${Math.max(remainingConfirmations, 1)} CONFIRMATIONS`;
  let approvalDisabledReason = summary?.approvalDisabledReason || null;
  if (remainingConfirmations > 0) {
    if (readinessLabel === "READY TO APPROVE") {
      readinessLabel = `NEEDS ${remainingConfirmations} CONFIRMATIONS`;
    }
    if (!approvalDisabledReason) {
      approvalDisabledReason = `Approve unavailable. Please confirm ${remainingConfirmations} proposed canonical service(s).`;
    }
  }
  const canApprove =
    !alreadyApproved &&
    remainingConfirmations === 0 &&
    pending === 0 &&
    readinessLabel === "READY TO APPROVE" &&
    !(review.missingSources && review.missingSources.length);
  return { remainingConfirmations, readinessLabel, approvalDisabledReason, canApprove };
}

function applyCanonicalApprovalAuthority(review: BusinessProfileReviewPayload): BusinessProfileReviewPayload {
  if (review.loadError) return review;
  const authority = resolveBusinessProfileApprovalAuthority(review);
  review.summary.remainingConfirmations = authority.remainingConfirmations;
  review.summary.needsConfirmationCount = Math.max(
    Number(review.summary.needsConfirmationCount || 0),
    authority.remainingConfirmations,
  );
  review.summary.needsAttention = Math.max(Number(review.summary.needsAttention || 0), authority.remainingConfirmations);
  review.summary.readinessLabel = authority.readinessLabel;
  review.summary.approvalDisabledReason = authority.approvalDisabledReason;
  if (authority.remainingConfirmations > 0 && !(review.summary.blockingFields || []).length) {
    review.summary.blockingFields = review.summary.approvalChecklist?.length
      ? [...review.summary.approvalChecklist]
      : [`Confirm ${authority.remainingConfirmations} proposed canonical service(s) before approval.`];
  }
  return review;
}

interface FieldSpec {
  id: string;
  label: string;
  category: ReviewFieldCategory;
  blocking: boolean;
  regulatory: boolean;
  website: (ctx: EvidenceContext) => string | null;
  google: (ctx: EvidenceContext) => string | null;
  canonical: (ctx: EvidenceContext) => string | null;
  recommend: (ctx: EvidenceContext) => { value: string | null; source: string; confidence: number | null };
}

interface EvidenceContext {
  slug: string;
  profile: ReturnType<typeof readSetupProfile>;
  websiteSnap: Record<string, unknown>;
  googleIntel: ReturnType<typeof readGoogleIntelligenceRecord>;
  websiteSummary: ReturnType<typeof buildWebsiteSourceSummary>;
  googleSummary: ReturnType<typeof buildGoogleSourceSummary>;
}

function reviewPath(slug: string): string {
  return path.join(REVIEW_DIR, `${slug}.json`);
}

function approvalDir(slug: string): string {
  return path.join(APPROVAL_DIR, slug);
}

function latestApprovalPath(slug: string): string {
  return path.join(approvalDir(slug), "latest.json");
}

function approvalSnapshotPath(slug: string, revision: number): string {
  return path.join(approvalDir(slug), `revision-${revision}.json`);
}

function collectMissingSourceEvidence(ctx: EvidenceContext): string[] {
  const missingSources: string[] = [];
  const slug = normText(ctx.slug) || normText((ctx.profile as { slug?: string }).slug);
  const googleState = resolveGoogleProfileOnboardingState(ctx.profile);
  const googleApproval = canApproveBusinessProfileWithGoogleState(googleState, ctx.profile);

  const websiteReady = slug
    ? websiteImportStageComplete(slug) || Boolean(ctx.websiteSummary.websiteImported)
    : Boolean(ctx.websiteSummary.websiteImported);
  const manualBrandSource = slug ? readManualOnboardingBrandSource(slug) : null;
  const websiteSatisfiedByManualBrand =
    Boolean(manualBrandSource) && isGoogleOnboardingResolvedWithoutImport(googleState);
  if (!websiteReady && !websiteSatisfiedByManualBrand) missingSources.push("Website Intelligence");

  if (
    isGoogleIntelligenceRequiredForBusinessProfile(googleState) &&
    !ctx.googleSummary.googleImported &&
    !ctx.googleIntel &&
    !googleApproval.allowed
  ) {
    missingSources.push("Google Intelligence");
  }
  return missingSources;
}

function listApprovalRevisionNumbers(slug: string): number[] {
  const dir = approvalDir(slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => {
      const m = /^revision-(\d+)\.json$/.exec(name);
      return m ? Number.parseInt(m[1]!, 10) : null;
    })
    .filter((n): n is number => n !== null && Number.isFinite(n))
    .sort((a, b) => a - b);
}

function allocateApprovalRevisionNumber(
  slug: string,
  store: BusinessProfileReviewStore | null,
  latestSnapshot: BusinessProfileApprovalSnapshot | null,
): number {
  const base = latestSnapshot?.profileRevision || store?.profileRevision || 0;
  let revision = base + 1;
  while (fs.existsSync(approvalSnapshotPath(slug, revision))) revision += 1;
  return revision;
}

/** Finish approval persistence when revision JSON exists but latest/store were not updated. */
function recoverIncompleteApprovalPersistence(
  slug: string,
  operator: string,
): BusinessProfileApprovalSnapshot | null {
  const store = readReviewStore(slug);
  const latest = readLatestApprovalSnapshot(slug);
  if (store?.approvalStatus === "approved" && latest?.approvedAt) return latest;

  const revisions = listApprovalRevisionNumbers(slug);
  if (!revisions.length) return null;

  const revision = revisions[revisions.length - 1]!;
  const revisionFile = approvalSnapshotPath(slug, revision);
  try {
    const snapshot = JSON.parse(fs.readFileSync(revisionFile, "utf8")) as BusinessProfileApprovalSnapshot;
    if (!snapshot.approvedAt || !snapshot.profileRevision) return null;

    if (!latest?.approvedAt) {
      writeJsonAtomic(latestApprovalPath(slug), snapshot);
    }

    if (store?.approvalStatus !== "approved") {
      const approvedStore: BusinessProfileReviewStore = {
        version: 1,
        slug,
        updatedAt: snapshot.approvedAt,
        savedAt: store?.savedAt || snapshot.approvedAt,
        savedBy: store?.savedBy || snapshot.approvedBy || operator,
        profileRevision: snapshot.profileRevision,
        approvalStatus: "approved",
        approvedAt: snapshot.approvedAt,
        approvedBy: snapshot.approvedBy || operator,
        decisions: store?.decisions || snapshot.conflictDecisions || {},
        deferredFields: store?.deferredFields || snapshot.deferredFields || [],
        websiteEvidenceVersion: snapshot.websiteEvidenceVersion,
        googleEvidenceVersion: snapshot.googleEvidenceVersion,
      };
      writeReviewStore(approvedStore);
    }

    return snapshot;
  } catch {
    return null;
  }
}

export function readReviewStore(slug: string): BusinessProfileReviewStore | null {
  const file = reviewPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as BusinessProfileReviewStore;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function writeReviewStore(store: BusinessProfileReviewStore): void {
  store.updatedAt = new Date().toISOString();
  writeJsonAtomic(reviewPath(store.slug), store);
}

export function readLatestApprovalSnapshot(slug: string): BusinessProfileApprovalSnapshot | null {
  const file = latestApprovalPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as BusinessProfileApprovalSnapshot;
  } catch {
    return null;
  }
}

export function isBusinessProfileReviewApproved(slug: string): boolean {
  const latest = readLatestApprovalSnapshot(slug);
  return Boolean(latest?.approvedAt);
}

function defaultMeta(fieldId: string) {
  return FIELD_META[fieldId] || { inputType: "text" as const, matchKind: "text" as const, humanConfirmationOnly: false, lowRiskAutoAccept: false };
}

function pickAutoValue(field: Pick<BusinessProfileReviewField, "websiteValue" | "googleValue" | "canonicalValue" | "recommendedValue" | "classification">): string | null {
  if (field.classification === "MATCH") return field.canonicalValue || field.googleValue || field.websiteValue;
  if (field.classification === "GOOGLE_ONLY") return field.googleValue || field.recommendedValue;
  if (field.classification === "WEBSITE_ONLY") return field.websiteValue || field.recommendedValue;
  return field.recommendedValue || field.canonicalValue || field.googleValue || field.websiteValue;
}

function resolveWeeklyHoursForCtx(ctx: EvidenceContext): WeeklyOpeningHoursEvidence {
  const googleSnap = ctx.profile.googleImportSnapshot as { openingHours?: unknown } | null | undefined;
  const intel = ctx.websiteSnap.intelligence as
    | { business?: { openingHours?: unknown } }
    | null
    | undefined;
  return resolveBusinessProfileWeeklyHours({
    googleIntelOpeningHours: ctx.googleIntel?.openingHours,
    googleSnapshotOpeningHours: googleSnap?.openingHours,
    websiteSnapshotOpeningHours: ctx.websiteSnap.openingHours,
    websiteIntelligenceOpeningHours: intel?.business?.openingHours,
    websiteDayHours: {
      openingHoursMonday: ctx.profile.openingHoursMonday,
      openingHoursTuesday: ctx.profile.openingHoursTuesday,
      openingHoursWednesday: ctx.profile.openingHoursWednesday,
      openingHoursThursday: ctx.profile.openingHoursThursday,
      openingHoursFriday: ctx.profile.openingHoursFriday,
      openingHoursSaturday: ctx.profile.openingHoursSaturday,
      openingHoursSunday: ctx.profile.openingHoursSunday,
    },
  });
}

function persistConfirmedWeeklyHours(
  slug: string,
  decisions: Record<string, ReviewFieldDecision>,
): void {
  const decision = decisions.openingHoursSummary;
  if (!decision) return;
  if (!["confirm", "use_google", "use_website", "manual", "auto_accept"].includes(decision.action)) return;
  const ctx = buildEvidenceContext(slug);
  const days = chosenWeeklyDays(resolveWeeklyHoursForCtx(ctx), decision.action, decision.finalValue);
  if (!days.some((row) => row.hours)) return;
  const data = readSetupProfile(slug);
  writeSetupProfile(slug, {
    ...data,
    ...weeklyDaysToProfilePatch(days),
  });
}

function buildEvidenceContext(slug: string): EvidenceContext {
  reconcileConfirmedGoogleImportPersistence(slug);
  const profile = readSetupProfile(slug);
  const websiteSnap = (profile.websiteImportSnapshot || {}) as Record<string, unknown>;
  const googleIntel = readGoogleIntelligenceRecord(slug);
  return {
    slug,
    profile,
    websiteSnap,
    googleIntel,
    websiteSummary: buildWebsiteSourceSummary(slug),
    googleSummary: buildGoogleSourceSummary(slug),
  };
}

function toServiceReconciliationPayload(
  proposal: ServiceReconciliationProposal,
  store: BusinessProfileReviewStore | null,
) {
  const pending = pendingServiceReconciliationConfirmations(proposal, store);
  return {
    websiteSnapshotImportedAt: proposal.websiteSnapshotImportedAt,
    businessClassificationClass: proposal.businessClassificationClass,
    clinicalCatalogueEligible: proposal.clinicalCatalogueEligible,
    proposedCanonicalServiceIds: proposal.proposedCanonicalServiceIds,
    excludedIncompatibleServiceIds: proposal.excludedIncompatibleServiceIds,
    downstreamTrusted: proposal.downstreamTrusted,
    trustedDownstreamServiceIds: proposal.trustedDownstreamServiceIds,
    pendingConfirmationCount: pending.count,
    proposalConfirmed: isServiceReconciliationProposalConfirmed(proposal, store),
    rows: proposal.rows.map((r) => ({
      canonicalServiceId: r.canonicalServiceId,
      canonicalServiceName: r.canonicalServiceName,
      configuredServiceName: r.configuredServiceName,
      websiteDiscoveredLabel: r.websiteDiscoveredLabel,
      websiteSourceUrl: r.websiteSourceUrl,
      matchState: r.matchState,
      matchStateLabel: formatServiceMatchStateLabel(r.matchState),
      proposedForCanonical: r.proposedForCanonical,
      matchReason: r.matchReason,
    })),
  };
}

const FIELD_SPECS: FieldSpec[] = [
  {
    id: "businessName",
    label: "Business name",
    category: "identity",
    blocking: true,
    regulatory: true,
    website: (c) => {
      const intel = c.websiteSnap.intelligence as Record<string, unknown> | undefined;
      const business = intel?.business as Record<string, unknown> | undefined;
      const name = business?.businessName as Record<string, unknown> | undefined;
      const selected = normText(name?.selected);
      if (selected && !/service input field/i.test(selected)) return selected;
      return normText(c.profile.pharmacyName) || null;
    },
    google: (c) => normText(c.googleIntel?.businessName) || null,
    canonical: (c) => normText(c.profile.pharmacyName) || null,
    recommend: (c) => {
      const google = normText(c.googleIntel?.businessName);
      const canonical = normText(c.profile.pharmacyName);
      if (canonical && google && google.toLowerCase().includes(canonical.toLowerCase())) {
        return { value: canonical, source: "Canonical profile matches Google branch name", confidence: 88 };
      }
      if (canonical) return { value: canonical, source: "Existing canonical pharmacy name", confidence: 80 };
      if (google) return { value: google, source: "Google confirmed listing", confidence: 75 };
      return { value: null, source: "No reliable name evidence", confidence: null };
    },
  },
  {
    id: "tradingName",
    label: "Trading name",
    category: "identity",
    blocking: false,
    regulatory: false,
    website: (c) => normText(c.profile.tradingName) || normText(c.profile.pharmacyName) || null,
    google: (c) => normText(c.googleIntel?.businessName) || null,
    canonical: (c) => normText(c.profile.tradingName) || null,
    recommend: (c) => ({
      value: normText(c.profile.tradingName) || normText(c.profile.pharmacyName) || null,
      source: "Canonical trading name",
      confidence: 70,
    }),
  },
  {
    id: "gphcNumber",
    label: "GPhC premises number",
    category: "identity",
    blocking: false,
    regulatory: true,
    website: () => null,
    google: () => null,
    canonical: (c) => normText(c.profile.gphcNumber) || null,
    recommend: () => ({ value: null, source: "GPhC must be confirmed manually — never promote scraped evidence", confidence: null }),
  },
  {
    id: "address",
    label: "Full address",
    category: "contact",
    blocking: true,
    regulatory: true,
    website: (c) => normText(c.websiteSnap.address) || null,
    google: (c) => normText(c.googleIntel?.address) || null,
    canonical: (c) => {
      const parts = [c.profile.addressLine1, c.profile.addressLine2, c.profile.townCity, c.profile.postcode].map(normText).filter(Boolean);
      return parts.length ? parts.join(", ") : normText(c.profile.displayAddress) || null;
    },
    recommend: (c) => {
      const google = normText(c.googleIntel?.address);
      const postcode = normPostcode(c.googleIntel?.postcode || c.profile.postcode);
      if (google && postcode && google.toUpperCase().includes(postcode.replace(/\s/g, ""))) {
        return { value: google, source: "Google address with matching postcode and Place ID", confidence: 90 };
      }
      if (google) return { value: google, source: "Google confirmed branch address", confidence: 82 };
      return { value: null, source: "Address requires operator confirmation", confidence: null };
    },
  },
  {
    id: "postcode",
    label: "Postcode",
    category: "contact",
    blocking: true,
    regulatory: true,
    website: (c) => normText(c.websiteSnap.postcode) || null,
    google: (c) => normText(c.googleIntel?.postcode) || null,
    canonical: (c) => normText(c.profile.postcode) || null,
    recommend: (c) => {
      const google = normPostcode(c.googleIntel?.postcode);
      if (google) return { value: google.replace(/(.{3})(.{3})/, "$1 $2").trim(), source: "Google Place ID postcode", confidence: 92 };
      return { value: null, source: "Postcode requires confirmation", confidence: null };
    },
  },
  {
    id: "telephone",
    label: "Telephone",
    category: "contact",
    blocking: true,
    regulatory: false,
    website: (c) => normText(c.websiteSnap.phone) || null,
    google: (c) => normText(c.googleIntel?.telephone) || null,
    canonical: (c) => normText(c.profile.phone) || null,
    recommend: (c) => {
      const google = normText(c.googleIntel?.telephone);
      const canonical = normText(c.profile.phone);
      if (google && canonical && normPhone(google) === normPhone(canonical)) {
        return { value: google, source: "Website and Google telephone match", confidence: 95 };
      }
      if (google) return { value: google, source: "Google listing telephone — confirm if different from website", confidence: 78 };
      if (canonical) return { value: canonical, source: "Canonical profile telephone", confidence: 70 };
      return { value: null, source: "Telephone requires confirmation", confidence: null };
    },
  },
  {
    id: "email",
    label: "Primary customer email",
    category: "contact",
    blocking: true,
    regulatory: false,
    website: (c) => normText(c.websiteSnap.email) || null,
    google: () => null,
    canonical: (c) => normText(c.profile.businessEmail || c.profile.email) || null,
    recommend: (c) => {
      const email = normText(c.profile.businessEmail || c.profile.email || c.websiteSnap.email);
      return { value: email || null, source: "NHS / branch email from website or profile", confidence: email ? 85 : null };
    },
  },
  {
    id: "website",
    label: "Canonical website",
    category: "contact",
    blocking: true,
    regulatory: false,
    website: (c) => normText(c.websiteSummary.canonicalWebsite || c.websiteSnap.websiteUrl) || null,
    google: (c) => normText(c.googleIntel?.website) || null,
    canonical: (c) => normText(c.profile.website) || null,
    recommend: (c) => ({
      value: normText(c.websiteSummary.canonicalWebsite || c.profile.website) || null,
      source: "Confirmed canonical branch URL",
      confidence: 95,
    }),
  },
  {
    id: "googlePlaceId",
    label: "Confirmed Google Place ID",
    category: "google_identity",
    blocking: true,
    regulatory: true,
    website: () => null,
    google: (c) => normText(c.googleIntel?.placeId) || null,
    canonical: (c) => normText(c.profile.googlePlaceId) || null,
    recommend: (c) => ({
      value: normText(c.googleSummary.placeId || c.googleIntel?.placeId) || null,
      source: "Confirmed Google Business Profile identity",
      confidence: 98,
    }),
  },
  {
    id: "googleMapsUrl",
    label: "Google Maps URL",
    category: "google_identity",
    blocking: false,
    regulatory: false,
    website: () => null,
    google: (c) => normText(c.googleIntel?.mapsUrl) || null,
    canonical: (c) => normText(c.profile.googleBusinessProfileUrl) || null,
    recommend: (c) => ({
      value: normText(c.googleIntel?.mapsUrl || c.profile.googleBusinessProfileUrl) || null,
      source: "Confirmed Google Maps listing URL",
      confidence: 90,
    }),
  },
  {
    id: "primaryCategory",
    label: "Primary category",
    category: "google_identity",
    blocking: false,
    regulatory: false,
    website: () => null,
    google: (c) => (c.googleIntel?.categories || [])[0] || null,
    canonical: () => null,
    recommend: (c) => ({
      value: (c.googleIntel?.categories || [])[0] || "pharmacy",
      source: "Google primary category",
      confidence: 85,
    }),
  },
  {
    id: "openingHoursSummary",
    label: "Opening hours (full week)",
    category: "opening_hours",
    blocking: true,
    regulatory: false,
    website: (c) => resolveWeeklyHoursForCtx(c).websiteSummary,
    google: (c) => resolveWeeklyHoursForCtx(c).googleSummary,
    canonical: (c) => normText(c.profile.openingHours || c.profile.displayOpeningHours) || null,
    recommend: (c) => {
      const weekly = resolveWeeklyHoursForCtx(c);
      if (weekly.source === "conflict") {
        return {
          value: weekly.recommendedSummary,
          source: "Google and website hours differ — confirm which schedule to use",
          confidence: 70,
        };
      }
      if (weekly.source === "google") {
        return { value: weekly.googleSummary, source: "Imported from Google", confidence: 88 };
      }
      if (weekly.source === "website") {
        return { value: weekly.websiteSummary, source: "Imported from website", confidence: 80 };
      }
      return { value: null, source: "Opening hours require operator review", confidence: null };
    },
  },
  {
    id: "pharmacyFirstAvailability",
    label: "Pharmacy First availability",
    category: "services",
    blocking: true,
    regulatory: true,
    website: (c) => {
      const proposal = buildServiceReconciliationProposal(c.slug);
      if (!proposal.clinicalCatalogueEligible) {
        return "Not applicable for this business classification";
      }
      const services = (c.websiteSnap.customerVisibleServices as Array<{ serviceId?: string; serviceName?: string }>) || [];
      const pf = services.find((s) => String(s.serviceId || "").includes("pharmacy-first"));
      return pf ? "Offered (branch-specific evidence pending review)" : null;
    },
    google: () => null,
    canonical: (c) => {
      const proposal = buildServiceReconciliationProposal(c.slug);
      if (!proposal.clinicalCatalogueEligible) return "Excluded — incompatible with commercial classification";
      return (c.profile.selectedServices || []).includes("pharmacy-first") ? "Selected for generation" : null;
    },
    recommend: (c) => {
      const proposal = buildServiceReconciliationProposal(c.slug);
      if (!proposal.clinicalCatalogueEligible) {
        return {
          value: "Not applicable",
          source: "Clinical Pharmacy First is incompatible with current business classification / configured commercial services",
          confidence: 95,
        };
      }
      const selected = (c.profile.selectedServices || []).includes("pharmacy-first");
      if (!selected) return { value: "Not selected", source: "No Pharmacy First in selected services", confidence: 90 };
      return { value: "Requires branch-specific confirmation", source: "Pharmacy First selected — confirm branch offers service", confidence: 60 };
    },
  },
  {
    id: "consultationRoom",
    label: "Consultation room available",
    category: "trust_access",
    blocking: true,
    regulatory: true,
    website: () => null,
    google: () => null,
    canonical: (c) => (c.profile.consultationRoomAvailable ? "Yes" : c.profile.consultationRoomAvailable === false ? "No" : null),
    recommend: () => ({ value: null, source: "Consultation room claim requires operator confirmation", confidence: null }),
  },
  {
    id: "appointmentMethod",
    label: "Appointment / walk-in method",
    category: "trust_access",
    blocking: true,
    regulatory: false,
    website: () => null,
    google: (c) => (c.googleIntel?.appointmentUrl ? "Online appointment URL available" : "Walk-in / call assumed from listing"),
    canonical: (c) => normText(c.profile.bookingMethod) || null,
    recommend: (c) => ({
      value: normText(c.profile.bookingMethod) || "Walk-in and telephone enquiries",
      source: "Default pharmacy access method until booking URL confirmed",
      confidence: 55,
    }),
  },
  {
    id: "primaryCtaDestination",
    label: "Primary CTA destination",
    category: "brand_website",
    blocking: true,
    regulatory: false,
    website: (c) => normText(c.profile.headerCtaUrl) || normText(c.profile.bookingUrl) || null,
    google: (c) => normText(c.googleIntel?.appointmentUrl) || null,
    canonical: (c) => normText(c.profile.headerCtaUrl || c.profile.bookingUrl || c.profile.phone) || null,
    recommend: (c) => ({
      value: normText(c.profile.phone ? `tel:${c.profile.phone.replace(/\s/g, "")}` : c.profile.headerCtaUrl) || null,
      source: "Telephone CTA preferred for branch enquiries unless booking URL confirmed",
      confidence: 72,
    }),
  },
  {
    id: "logo",
    label: "Logo",
    category: "brand_website",
    blocking: false,
    regulatory: false,
    website: (c) => normText(c.websiteSnap.logoUrl) || null,
    google: () => null,
    canonical: (c) => normText(c.profile.logoUrl || c.profile.headerLogoUrl) || null,
    recommend: (c) => ({
      value: normText(c.websiteSnap.logoUrl || c.profile.logoUrl) || null,
      source: "Website imported logo asset",
      confidence: 80,
    }),
  },
  {
    id: "brandPrimaryColor",
    label: "Brand primary colour",
    category: "brand_website",
    blocking: false,
    regulatory: false,
    website: (c) => normText(c.websiteSnap.brandPrimaryColor) || null,
    google: () => null,
    canonical: (c) => normText(c.profile.brandPrimaryColor) || null,
    recommend: (c) => ({
      value: normText(c.websiteSnap.brandPrimaryColor || c.profile.brandPrimaryColor) || null,
      source: "Website brand import",
      confidence: 85,
    }),
  },
  {
    id: "privateServices",
    label: "Private services offered",
    category: "services",
    blocking: false,
    regulatory: false,
    website: () => null,
    google: () => null,
    canonical: (c) => normText((c.profile as Record<string, unknown>).privateServices as string) || null,
    recommend: () => ({ value: null, source: "Confirm branch private services", confidence: null }),
  },
  {
    id: "languagesSpoken",
    label: "Languages spoken",
    category: "trust_access",
    blocking: false,
    regulatory: false,
    website: () => null,
    google: () => null,
    canonical: (c) => normText((c.profile as Record<string, unknown>).languagesSpoken as string) || null,
    recommend: () => ({ value: null, source: "Confirm languages spoken at branch", confidence: null }),
  },
  {
    id: "parkingAvailable",
    label: "Parking available",
    category: "trust_access",
    blocking: false,
    regulatory: false,
    website: () => null,
    google: () => null,
    canonical: (c) => normText((c.profile as Record<string, unknown>).parkingAvailable as string) || null,
    recommend: () => ({ value: null, source: "Confirm parking availability", confidence: null }),
  },
  {
    id: "accessibilityFeatures",
    label: "Accessibility features",
    category: "trust_access",
    blocking: false,
    regulatory: false,
    website: () => null,
    google: () => null,
    canonical: (c) => normText((c.profile as Record<string, unknown>).accessibilityFeatures as string) || null,
    recommend: () => ({ value: null, source: "Confirm accessibility features", confidence: null }),
  },
  {
    id: "deliveryService",
    label: "Delivery service",
    category: "services",
    blocking: false,
    regulatory: false,
    website: () => null,
    google: () => null,
    canonical: (c) => normText((c.profile as Record<string, unknown>).deliveryService as string) || null,
    recommend: () => ({ value: null, source: "Confirm delivery service availability", confidence: null }),
  },
];

function enrichReviewField(
  spec: FieldSpec,
  ctx: EvidenceContext,
  store: BusinessProfileReviewStore | null,
  overrides: Partial<Pick<BusinessProfileReviewField, "websiteValue" | "googleValue" | "canonicalValue" | "recommendedValue" | "evidenceSource" | "confidence">> = {},
): BusinessProfileReviewField {
  const meta = defaultMeta(spec.id);
  const googleProfileState = resolveGoogleProfileOnboardingState(ctx.profile);
  const websiteValue = overrides.websiteValue !== undefined ? overrides.websiteValue : spec.website(ctx);
  const googleValue = overrides.googleValue !== undefined ? overrides.googleValue : spec.google(ctx);
  const canonicalValue = overrides.canonicalValue !== undefined ? overrides.canonicalValue : spec.canonical(ctx);
  const rec = spec.recommend(ctx);
  const recommendedValue = overrides.recommendedValue !== undefined ? overrides.recommendedValue : rec.value;
  const evidenceSource = overrides.evidenceSource || rec.source;
  const confidence = overrides.confidence !== undefined ? overrides.confidence : rec.confidence;
  const { classification, normalisationApplied } = classifyEvidence(
    spec.id,
    websiteValue,
    googleValue,
    canonicalValue,
    meta,
  );
  const deferred = store?.deferredFields.includes(spec.id) || false;
  const decision = store?.decisions[spec.id] || null;
  let autoResolved =
    Boolean(normalisationApplied) ||
    classification === "MATCH" ||
    (isSafeToAutoAccept(spec.id, classification, meta, Boolean(decision)) && !decision);
  const tierResult = resolveReviewTier({
    fieldId: spec.id,
    classification,
    meta,
    autoResolved,
    websiteValue,
    googleValue,
    canonicalValue,
    decision,
    blocking: spec.blocking,
    googleProfileState,
  });
  autoResolved = tierResult.autoResolved;
  const requiresAction = tierResult.requiresAction;
  const reviewTier = tierResult.tier;
  const requiresHumanConfirmation = reviewTier === "needs_confirmation";
  const base = {
    id: spec.id,
    label: spec.label,
    category: spec.category,
    blocking: spec.blocking,
    regulatory: spec.regulatory,
    inputType: meta.inputType,
    websiteValue,
    googleValue,
    canonicalValue,
    recommendedValue,
    evidenceSource,
    confidence,
    freshness: ctx.googleIntel?.importedAt || normText(ctx.websiteSnap.importedAt) || null,
    classification,
    normalisationApplied,
    autoResolved,
    requiresAction,
    requiresHumanConfirmation,
    decision,
    deferred,
    reviewTier,
  };
  const finalValue =
    resolveFinalValue(spec, base, decision) ||
    (reviewTier === "verified" || reviewTier === "recommended"
      ? pickTrustedValue(spec.id, websiteValue, googleValue, canonicalValue, recommendedValue)
      : null) ||
    (GOOGLE_IDENTITY_REVIEW_FIELD_IDS.has(spec.id) &&
    !isGoogleIntelligenceRequiredForBusinessProfile(googleProfileState)
      ? googleIdentityUnavailableLabel(googleProfileState)
      : null);
  const displayStatus = buildDisplayStatus(classification, requiresAction, autoResolved, spec.id, reviewTier);
  const approvalBlockReason = fieldApprovalBlockReason({
    id: spec.id,
    label: spec.label,
    blocking: spec.blocking,
    requiresAction,
    classification,
  });
  const commercialActionLabel =
    requiresAction && (reviewTier === "needs_confirmation" || reviewTier === "missing")
      ? buildCommercialActionLabel({ id: spec.id, label: spec.label, classification, approvalBlockReason })
      : null;
  return { ...base, displayStatus, finalValue, approvalBlockReason, commercialActionLabel };
}

function buildDayFields(ctx: EvidenceContext, store: BusinessProfileReviewStore | null): BusinessProfileReviewField[] {
  const weekly = resolveWeeklyHoursForCtx(ctx);
  const googleHours = Object.fromEntries((weekly.googleDays || []).map((row) => [row.day.toLowerCase(), row.hours]));
  const websiteHours = Object.fromEntries((weekly.websiteDays || []).map((row) => [row.day.toLowerCase(), row.hours]));
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const daySpec = (day: string): FieldSpec => ({
    id: `openingHours_${day}`,
    label: day.charAt(0).toUpperCase() + day.slice(1),
    category: "opening_hours",
    blocking: true,
    regulatory: false,
    website: () => websiteHours[day] || null,
    google: () => googleHours[day] || null,
    canonical: (c) => {
      const label = day.charAt(0).toUpperCase() + day.slice(1);
      return normText(c.profile[`openingHours${label}` as keyof typeof c.profile]) || null;
    },
    recommend: () => {
      const preferred = googleHours[day] || websiteHours[day] || null;
      if (preferred) {
        return {
          value: preferred,
          source: googleHours[day] ? "Imported from Google" : "Imported from website",
          confidence: googleHours[day] ? 88 : 80,
        };
      }
      return { value: null, source: "Missing day hours", confidence: null };
    },
  });
  return days.map((day) => enrichReviewField(daySpec(day), ctx, store));
}

function resolveDecisionFinalValue(
  field: Pick<BusinessProfileReviewField, "websiteValue" | "googleValue" | "canonicalValue" | "recommendedValue">,
  decision: ReviewFieldDecision | null,
): string | null {
  if (!decision) return null;
  const manual = normText(decision.finalValue);
  switch (decision.action) {
    case "use_website":
      return normText(field.websiteValue) || manual || null;
    case "use_google":
      return normText(field.googleValue) || manual || null;
    case "keep_canonical":
      return normText(field.canonicalValue) || manual || null;
    case "manual":
    case "confirm":
      return manual || null;
    case "unavailable":
      return "Unavailable";
    case "reject":
      return manual || "Rejected";
    case "defer":
      return normText(field.canonicalValue) || normText(field.recommendedValue) || null;
    case "auto_accept":
      return (
        normText(field.recommendedValue) ||
        normText(field.canonicalValue) ||
        normText(field.googleValue) ||
        normText(field.websiteValue) ||
        manual ||
        null
      );
    default:
      return manual || null;
  }
}

function resolveFinalValue(
  spec: FieldSpec,
  field: Omit<BusinessProfileReviewField, "finalValue">,
  decision: ReviewFieldDecision | null,
): string | null {
  if (decision) {
    const fromDecision = resolveDecisionFinalValue(field, decision);
    if (fromDecision) return fromDecision;
  }
  if (field.reviewTier === "verified" || field.reviewTier === "recommended") {
    return pickTrustedValue(field.id, field.websiteValue, field.googleValue, field.canonicalValue, field.recommendedValue);
  }
  return field.recommendedValue || field.canonicalValue;
}

function mergeCanonicalProfileFromImports(slug: string, fields: BusinessProfileReviewField[]): boolean {
  if (isBusinessProfileReviewApproved(slug)) return false;
  const ctx = buildEvidenceContext(slug);
  if (!ctx.websiteSummary.websiteImported || !ctx.googleSummary.googleImported) return false;

  const data = readSetupProfile(slug);
  let changed = false;
  const apply = (key: string, value: string | null, writer: (v: string) => void) => {
    if (!value) return;
    writer(value);
    changed = true;
  };

  for (const field of fields) {
    if (field.id === "openingHoursSummary" || field.id.startsWith("openingHours_")) {
      if (!field.decision) continue;
    }
    if (field.reviewTier !== "verified" && field.reviewTier !== "recommended") continue;
    const value = normText(field.finalValue);
    if (!value) continue;
    switch (field.id) {
      case "businessName":
        apply(field.id, value, (v) => { data.pharmacyName = v; });
        break;
      case "tradingName":
        apply(field.id, value, (v) => { data.tradingName = v; });
        break;
      case "telephone":
        apply(field.id, value, (v) => { data.phone = v; });
        break;
      case "email":
        apply(field.id, value, (v) => { data.businessEmail = v; data.email = v; });
        break;
      case "website":
        apply(field.id, value, (v) => { data.website = v; });
        break;
      case "googlePlaceId":
        apply(field.id, value, (v) => { data.googlePlaceId = v; });
        break;
      case "googleMapsUrl":
        apply(field.id, value, (v) => { data.googleBusinessProfileUrl = v; });
        break;
      case "postcode":
        apply(field.id, value, (v) => { data.postcode = v; });
        break;
      case "address":
        apply(field.id, value, (v) => {
          data.displayAddress = v;
          data.addressLine1 = v.split(",")[0]?.trim() || v;
        });
        break;
      case "openingHoursSummary":
        apply(field.id, value, (v) => { data.openingHours = v; data.displayOpeningHours = v; });
        break;
      case "logo":
        apply(field.id, value, (v) => { data.logoUrl = v; data.headerLogoUrl = v; });
        break;
      case "brandPrimaryColor":
        apply(field.id, value, (v) => { data.brandPrimaryColor = v; });
        break;
      default:
        if (field.id.startsWith("openingHours_")) {
          const day = field.id.replace("openingHours_", "");
          const label = day.charAt(0).toUpperCase() + day.slice(1);
          (data as Record<string, unknown>)[`openingHours${label}`] = value;
          changed = true;
        }
        break;
    }
  }

  if (changed) {
    data.platformClientStatus = data.platformClientStatus || "profile_review";
    (data.profileFieldConfirmations as Record<string, unknown> | undefined) ??= {};
    (data.profileFieldConfirmations as Record<string, unknown>).canonicalMergeAt = new Date().toISOString();
    writeSetupProfile(slug, data);
  }
  return changed;
}

function buildApplicabilityContext(
  ctx: EvidenceContext,
  proposal: ServiceReconciliationProposal,
): BprApplicabilityContext {
  const websiteDiscoveredServiceIds = [
    ...new Set(
      proposal.websiteDiscoveredServices
        .map((row) => {
          const raw = String(row.serviceId || "").trim().toLowerCase().replace(/_/g, "-");
          return raw || resolveDeterministicServiceIdFromName(row.serviceName) || "";
        })
        .filter(Boolean),
    ),
  ];
  return {
    clinicalCatalogueEligible: proposal.clinicalCatalogueEligible,
    businessClassificationClass: proposal.businessClassificationClass,
    clinicalServiceDetectionEnabled: proposal.clinicalServiceDetectionEnabled,
    marketScope: ctx.profile.marketScope || null,
    explicitServiceIds: proposal.configuredServices.map((row) => row.serviceId),
    websiteDiscoveredServiceIds,
  };
}

function stampFieldApplicability(
  field: BusinessProfileReviewField,
  applicabilityCtx: BprApplicabilityContext,
): BusinessProfileReviewField {
  const override = resolveBprFieldApplicability(field.id, applicabilityCtx);
  if (override) {
    return applyBprFieldApplicability(
      field,
      override,
      bprApplicabilityReason(field.id, override, applicabilityCtx),
    );
  }
  field.applicability = field.blocking ? "required" : "optional";
  return field;
}

function buildFields(ctx: EvidenceContext, store: BusinessProfileReviewStore | null): BusinessProfileReviewField[] {
  const proposal = buildServiceReconciliationProposal(ctx.slug);
  const applicabilityCtx = buildApplicabilityContext(ctx, proposal);
  const weekly = resolveWeeklyHoursForCtx(ctx);
  const fields = FIELD_SPECS.map((spec) => {
    const field = stampFieldApplicability(enrichReviewField(spec, ctx, store), applicabilityCtx);
    if (field.id === "openingHoursSummary") field.weeklyHours = weekly;
    return field;
  });
  const dayFields = buildDayFields(ctx, store).map((field) => stampFieldApplicability(field, applicabilityCtx));
  return [...fields, ...dayFields];
}

function blockingFieldsList(fields: BusinessProfileReviewField[]): string[] {
  return fields
    .filter(
      (f) =>
        f.applicability !== "not_applicable" &&
        f.applicability !== "optional" &&
        !f.deferred &&
        f.requiresAction &&
        (f.reviewTier === "needs_confirmation" || f.reviewTier === "missing"),
    )
    .map((f) => f.commercialActionLabel || f.approvalBlockReason || `Confirm ${f.label.toLowerCase()}.`);
}

function buildReadiness(
  fields: BusinessProfileReviewField[],
  profile: ReturnType<typeof readSetupProfile>,
  missingSources: string[] = [],
  servicePending: { count: number; labels: string[] } = { count: 0, labels: [] },
): {
  readinessLabel: ReadinessLabel;
  readinessDetail: string;
  approvalDisabledReason: string | null;
} {
  if (missingSources.length) {
    const detail = `Missing source evidence: ${missingSources.join(", ")}`;
    return {
      readinessLabel: "NEEDS 1 CONFIRMATIONS",
      readinessDetail: detail,
      approvalDisabledReason: detail,
    };
  }
  const actionFields = fields.filter(
    (f) =>
      f.applicability !== "not_applicable" &&
      f.applicability !== "optional" &&
      !f.deferred &&
      f.requiresAction &&
      (f.reviewTier === "needs_confirmation" || f.reviewTier === "missing"),
  );
  const googleApproval = canApproveBusinessProfileWithGoogleState(
    resolveGoogleProfileOnboardingState(profile),
    profile,
  );
  if (!actionFields.length && !servicePending.count && googleApproval.allowed) {
    return {
      readinessLabel: "READY TO APPROVE",
      readinessDetail: "All blocking items resolved.",
      approvalDisabledReason: null,
    };
  }
  const missing = actionFields.filter((f) => f.reviewTier === "missing");
  const reasons = actionFields.map((f) => f.commercialActionLabel || f.approvalBlockReason).filter(Boolean) as string[];
  if (servicePending.labels.length) reasons.push(...servicePending.labels);
  if (!googleApproval.allowed && googleApproval.reason) reasons.unshift(googleApproval.reason);
  if (missing.length) {
    return {
      readinessLabel: `MISSING ${missing.length} REQUIRED FIELDS`,
      readinessDetail: missing.map((f) => f.label).join(", "),
      approvalDisabledReason: reasons[0] || null,
    };
  }
  const confirmationCount = actionFields.length + servicePending.count;
  if (confirmationCount) {
    return {
      readinessLabel: `NEEDS ${confirmationCount} CONFIRMATIONS`,
      readinessDetail: [
        ...actionFields.map((f) => f.commercialActionLabel || f.label),
        ...servicePending.labels,
      ].join(", "),
      approvalDisabledReason: reasons.length
        ? `Approve unavailable. Please confirm: ${reasons.slice(0, 3).join("; ")}`
        : `Approve unavailable. Please confirm ${servicePending.count} proposed canonical service(s).`,
    };
  }
  return {
    readinessLabel: "NEEDS 1 CONFIRMATIONS",
    readinessDetail: googleApproval.reason || "Google profile decision required",
    approvalDisabledReason: googleApproval.reason,
  };
}

function computeCompleteness(fields: BusinessProfileReviewField[]): CompletenessSection[] {
  const sections: Array<{ id: string; label: string; categories: ReviewFieldCategory[] }> = [
    { id: "identity", label: "Identity completeness", categories: ["identity"] },
    { id: "contact", label: "Contact completeness", categories: ["contact"] },
    { id: "opening_hours", label: "Opening-hours completeness", categories: ["opening_hours"] },
    { id: "services", label: "Service completeness", categories: ["services"] },
    { id: "trust", label: "Trust completeness", categories: ["trust_access"] },
    { id: "brand", label: "Brand completeness", categories: ["brand_website"] },
    { id: "regulatory", label: "Regulatory completeness", categories: ["identity", "services", "trust_access"] },
  ];
  return sections.map((section) => {
    const sectionFields = fields.filter(
      (f) =>
        section.categories.includes(f.category) &&
        f.applicability !== "not_applicable" &&
        f.applicability !== "optional" &&
        (f.blocking || f.regulatory),
    );
    const missing = sectionFields.filter((f) => !f.deferred && !normText(f.finalValue)).map((f) => f.label);
    return { id: section.id, label: section.label, complete: missing.length === 0, missingFields: missing };
  });
}

function buildSummary(
  ctx: EvidenceContext,
  fields: BusinessProfileReviewField[],
  store: BusinessProfileReviewStore | null,
  canonicalProfileMerged = false,
): BusinessProfileReviewSummary {
  const proposal = buildServiceReconciliationProposal(ctx.slug);
  const servicePending = pendingServiceReconciliationConfirmations(proposal, store);
  const blocking = [...blockingFieldsList(fields), ...servicePending.labels];
  const missingSources = collectMissingSourceEvidence(ctx);
  const readiness = buildReadiness(fields, ctx.profile, missingSources, servicePending);
  const googleSection = buildBusinessProfileGoogleSection(ctx.profile, {
    googleBusinessName: ctx.googleSummary.businessName || ctx.googleIntel?.businessName || null,
    googleImportStatus: ctx.googleSummary.googleImported
      ? "Complete"
      : ctx.googleSummary.importStatus === "failed"
        ? "Failed"
        : isGoogleIntelligenceRequiredForBusinessProfile(resolveGoogleProfileOnboardingState(ctx.profile))
          ? "Missing"
          : "Not connected",
  });
  const warnings = fields
    .filter((f) => !f.blocking && f.requiresAction)
    .map((f) => `${f.label}: ${f.displayStatus}`);
  const latest = readLatestApprovalSnapshot(ctx.profile.slug || "");
  const attentionFields = fields.filter(
    (f) =>
      f.applicability !== "not_applicable" &&
      f.applicability !== "optional" &&
      f.requiresAction &&
      (f.reviewTier === "needs_confirmation" || f.reviewTier === "missing"),
  );
  const approvalChecklist = [
    ...attentionFields
      .map((f) => f.commercialActionLabel || f.approvalBlockReason || `Confirm ${f.label.toLowerCase()}`)
      .filter(Boolean) as string[],
    ...servicePending.labels,
  ];
  const verifiedCount = fields.filter((f) => f.reviewTier === "verified" && f.applicability !== "not_applicable").length;
  const recommendedCount = fields.filter((f) => f.reviewTier === "recommended" && f.applicability !== "not_applicable").length;
  const fieldNeedsConfirmationCount = fields.filter(
    (f) => f.applicability !== "not_applicable" && f.applicability !== "optional" && f.reviewTier === "needs_confirmation" && f.requiresAction,
  ).length;
  const needsConfirmationCount = fieldNeedsConfirmationCount + servicePending.count;
  const remainingConfirmations = needsConfirmationCount;
  const missingInformationCount = fields.filter(
    (f) => f.applicability !== "not_applicable" && f.applicability !== "optional" && f.reviewTier === "missing" && f.requiresAction,
  ).length;
  return {
    pharmacyName: normText(ctx.profile.pharmacyName) || "—",
    canonicalWebsite: ctx.websiteSummary.canonicalWebsite || normText(ctx.profile.website) || null,
    googleBusinessProfile: ctx.googleSummary.businessName || ctx.googleIntel?.businessName || null,
    googlePlaceId: ctx.googleSummary.placeId || ctx.googleIntel?.placeId || null,
    websiteImportStatus: ctx.websiteSummary.websiteStatus === "IMPORTED"
      ? "Complete"
      : ctx.websiteSummary.websiteStatus === "PARTIAL"
        ? "Partial"
        : ctx.websiteSummary.websiteStatus === "FAILED"
          ? "Failed"
          : "Missing",
    googleImportStatus: googleSection.importStatus,
    fieldsChecked: fields.length,
    matches: fields.filter((f) => f.classification === "MATCH" || (f.autoResolved && !f.requiresAction)).length,
    confirmationsRequired: fields.filter((f) => f.requiresHumanConfirmation && f.requiresAction).length + servicePending.count,
    conflicts: fields.filter((f) => f.classification === "CONFLICT" && f.requiresAction).length,
    missingBlocking: fields.filter((f) => f.classification === "MISSING" && f.blocking && f.requiresAction).length,
    autoResolved: fields.filter((f) => f.autoResolved).length,
    overallCompleteness: computeCompleteness(fields),
    readinessLabel: readiness.readinessLabel,
    readinessDetail: readiness.readinessDetail,
    approvalDisabledReason: readiness.approvalDisabledReason,
    blockingFields: blocking,
    nonBlockingWarnings: warnings,
    approvalStatus: latest?.approvedAt ? "approved" : store?.approvalStatus || "draft",
    profileRevision: latest?.profileRevision || store?.profileRevision || 0,
    approvedAt: latest?.approvedAt || store?.approvedAt || null,
    approvedBy: latest?.approvedBy || store?.approvedBy || null,
    automaticallyVerified: verifiedCount,
    needsAttention: needsConfirmationCount + missingInformationCount,
    criticalIssues: 0,
    estimatedReviewMinutes: Math.max(1, Math.min(2, Math.ceil((fieldNeedsConfirmationCount + missingInformationCount) * 0.35))),
    approvalChecklist,
    verifiedCount,
    recommendedCount,
    needsConfirmationCount,
    missingInformationCount,
    remainingConfirmations,
    canonicalProfileMerged,
    googleProfileState: googleSection.state,
    googleSectionStatus: googleSection.statusLabel,
    googleSectionDetail: googleSection.statusDetail,
    googleGrowthOpportunity: googleSection.growthOpportunity,
    googleConnectLaterAvailable: googleSection.connectLaterAvailable,
  };
}

export function buildBusinessProfileReview(slug: string): BusinessProfileReviewPayload {
  try {
    let ctx = buildEvidenceContext(slug);
    const store = readReviewStore(slug);
    let fields = buildFields(ctx, store);
    const merged = mergeCanonicalProfileFromImports(slug, fields);
    if (merged) {
      ctx = buildEvidenceContext(slug);
      fields = buildFields(ctx, store);
    }
    const missingSources = collectMissingSourceEvidence(ctx);
    const summary = buildSummary(ctx, fields, store, merged);
    const needsConfirmation = fields.filter(
      (f) => f.applicability !== "not_applicable" && f.reviewTier === "needs_confirmation" && f.requiresAction,
    );
    const missingInformation = fields.filter(
      (f) => f.applicability !== "not_applicable" && f.reviewTier === "missing" && f.requiresAction,
    );
    const recommendedValues = fields.filter(
      (f) => f.applicability !== "not_applicable" && f.reviewTier === "recommended",
    );
    const verifiedFields = fields.filter((f) => f.reviewTier === "verified" && f.applicability !== "not_applicable");
    const optionalFields = fields.filter(
      (f) => f.applicability === "optional" && (f.reviewTier === "recommended" || f.reviewTier === "missing" || !normText(f.finalValue)),
    );
    const notApplicableFields = fields.filter((f) => f.applicability === "not_applicable");
    const categories = [
      { id: "identity" as const, label: "Identity", fieldCount: fields.filter((f) => f.category === "identity").length },
      { id: "contact" as const, label: "Contact", fieldCount: fields.filter((f) => f.category === "contact").length },
      { id: "opening_hours" as const, label: "Opening Hours", fieldCount: fields.filter((f) => f.category === "opening_hours").length },
      { id: "google_identity" as const, label: "Google Identity", fieldCount: fields.filter((f) => f.category === "google_identity").length },
      { id: "services" as const, label: "Services", fieldCount: fields.filter((f) => f.category === "services").length },
      { id: "trust_access" as const, label: "Trust & Access", fieldCount: fields.filter((f) => f.category === "trust_access").length },
      { id: "brand_website" as const, label: "Brand & Website", fieldCount: fields.filter((f) => f.category === "brand_website").length },
    ];
    const serviceReconciliation = toServiceReconciliationPayload(buildServiceReconciliationProposal(slug), store);
    const review = applyCanonicalApprovalAuthority({
      summary,
      fields,
      actionRequired: needsConfirmation,
      reviewedAutomatically: verifiedFields,
      needsConfirmation,
      missingInformation,
      recommendedValues,
      verifiedFields,
      optionalFields,
      notApplicableFields,
      categories,
      store,
      loadError: null,
      missingSources,
      serviceReconciliation,
    });
    review.manualBrandConfirmation = manualBrandConfirmationOffer(slug);
    return review;
  } catch (err) {
    return {
      summary: {
        pharmacyName: slug,
        canonicalWebsite: null,
        googleBusinessProfile: null,
        googlePlaceId: null,
        websiteImportStatus: "Error",
        googleImportStatus: "Error",
        fieldsChecked: 0,
        matches: 0,
        confirmationsRequired: 0,
        conflicts: 0,
        missingBlocking: 0,
        autoResolved: 0,
        overallCompleteness: [],
        readinessLabel: "MISSING 1 REQUIRED FIELDS",
        readinessDetail: "Review data failed to load",
        approvalDisabledReason: "Review data failed to load",
        blockingFields: ["Review data failed to load"],
        nonBlockingWarnings: [],
        approvalStatus: "draft",
        profileRevision: 0,
        approvedAt: null,
        approvedBy: null,
        automaticallyVerified: 0,
        needsAttention: 0,
        criticalIssues: 0,
        estimatedReviewMinutes: 0,
        approvalChecklist: [],
        verifiedCount: 0,
        recommendedCount: 0,
        needsConfirmationCount: 0,
        missingInformationCount: 0,
        remainingConfirmations: 0,
        canonicalProfileMerged: false,
      },
      fields: [],
      actionRequired: [],
      reviewedAutomatically: [],
      needsConfirmation: [],
      missingInformation: [],
      recommendedValues: [],
      verifiedFields: [],
      categories: [],
      store: null,
      loadError: err instanceof Error ? err.message : String(err),
      serviceReconciliation: null,
      missingSources,
    };
  }
}

export function saveBusinessProfileReview(
  slug: string,
  input: {
    decisions?: Record<string, { action: OperatorDecisionAction; finalValue?: string; note?: string }>;
    deferredFields?: string[];
  },
  operator: string,
): BusinessProfileReviewPayload {
  const review = buildBusinessProfileReview(slug);
  if (review.loadError) throw new Error(review.loadError);

  const existing = readReviewStore(slug);
  const incoming = input.decisions || {};
  if (existing?.approvalStatus === "approved" && !Object.keys(incoming).length) {
    return review;
  }

  const decisions: Record<string, ReviewFieldDecision> = { ...(existing?.decisions || {}) };
  for (const [fieldId, d] of Object.entries(incoming)) {
    decisions[fieldId] = {
      action: d.action,
      finalValue: normText(d.finalValue),
      note: d.note,
      decidedAt: new Date().toISOString(),
      decidedBy: operator,
    };
  }

  const ctx = buildEvidenceContext(slug);
  const store: BusinessProfileReviewStore = {
    version: 1,
    slug,
    updatedAt: new Date().toISOString(),
    savedAt: new Date().toISOString(),
    savedBy: operator,
    profileRevision: existing?.profileRevision || readLatestApprovalSnapshot(slug)?.profileRevision || 0,
    approvalStatus: existing?.approvalStatus === "approved" && !Object.keys(incoming).length ? "approved" : "draft",
    approvedAt: existing?.approvalStatus === "approved" && !Object.keys(incoming).length ? existing.approvedAt : null,
    approvedBy: existing?.approvalStatus === "approved" && !Object.keys(incoming).length ? existing.approvedBy : null,
    decisions,
    deferredFields: input.deferredFields || existing?.deferredFields || [],
    websiteEvidenceVersion: normText(ctx.websiteSnap.importedAt) || null,
    googleEvidenceVersion: ctx.googleIntel?.importedAt || null,
  };
  writeReviewStore(store);
  persistConfirmedWeeklyHours(slug, decisions);

  recordMasterAdminAudit({
    user: operator,
    slug,
    action: "save_business_profile_review",
    status: "success",
    evidence: `Saved ${Object.keys(decisions).length} review decisions`,
    metadata: { decisionCount: Object.keys(decisions).length },
  });

  return buildBusinessProfileReview(slug);
}

export function saveBusinessProfileReviewField(
  slug: string,
  fieldId: string,
  decision: { action: OperatorDecisionAction; finalValue?: string; note?: string },
  operator: string,
): BusinessProfileReviewPayload {
  const profile = readSetupProfile(slug);
  const googleState = resolveGoogleProfileOnboardingState(profile);
  const fieldError = validateBusinessProfileGoogleFieldSave({
    fieldId,
    state: googleState,
    finalValue: normText(decision.finalValue),
  });
  if (fieldError) throw new Error(fieldError);
  return saveBusinessProfileReview(slug, { decisions: { [fieldId]: decision } }, operator);
}

export function acceptAllSafeRecommendations(slug: string, operator: string): BusinessProfileReviewPayload {
  const review = buildBusinessProfileReview(slug);
  if (review.loadError) throw new Error(review.loadError);
  const existing = readReviewStore(slug);
  const decisions: Record<string, { action: OperatorDecisionAction; finalValue?: string }> = {};
  for (const field of review.fields) {
    if (field.id === "openingHoursSummary" || field.id.startsWith("openingHours_")) continue;
    if (existing?.decisions[field.id]) continue;
    if (field.reviewTier !== "verified" && field.reviewTier !== "recommended") continue;
    const meta = defaultMeta(field.id);
    if (isSafeToAutoAccept(field.id, field.classification, meta, false) || field.reviewTier === "verified" || field.reviewTier === "recommended") {
      decisions[field.id] = {
        action: "auto_accept",
        finalValue: pickTrustedValue(field.id, field.websiteValue, field.googleValue, field.canonicalValue, field.recommendedValue) || field.finalValue || "",
      };
    }
  }
  if (!Object.keys(decisions).length) return review;
  return saveBusinessProfileReview(slug, { decisions }, operator);
}

function applyFinalValuesToProfile(slug: string, fields: BusinessProfileReviewField[]): void {
  const data = readSetupProfile(slug);
  const byId = Object.fromEntries(fields.map((f) => [f.id, f.finalValue]));

  if (byId.businessName) data.pharmacyName = byId.businessName;
  if (byId.tradingName) data.tradingName = byId.tradingName;
  if (byId.gphcNumber) data.gphcNumber = byId.gphcNumber;
  if (byId.telephone) data.phone = byId.telephone;
  if (byId.email) {
    data.businessEmail = byId.email;
    data.email = byId.email;
  }
  if (byId.website) data.website = byId.website;
  if (byId.googlePlaceId) data.googlePlaceId = byId.googlePlaceId;
  if (byId.googleMapsUrl) data.googleBusinessProfileUrl = byId.googleMapsUrl;
  if (byId.postcode) data.postcode = byId.postcode;
  if (byId.address) {
    data.displayAddress = byId.address;
    data.addressLine1 = byId.address.split(",")[0]?.trim() || byId.address;
  }
  if (byId.openingHoursSummary) {
    const hoursField = fields.find((f) => f.id === "openingHoursSummary");
    const days = hoursField?.weeklyHours
      ? chosenWeeklyDays(hoursField.weeklyHours, hoursField.decision?.action || "confirm", byId.openingHoursSummary)
      : [];
    if (days.some((row) => row.hours)) {
      Object.assign(data, weeklyDaysToProfilePatch(days));
    } else {
      data.openingHours = byId.openingHoursSummary;
      data.displayOpeningHours = byId.openingHoursSummary;
    }
  }
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
    const key = `openingHours_${day.toLowerCase()}`;
    const profileKey = `openingHours${day}` as keyof typeof data;
    if (byId[key]) (data as Record<string, unknown>)[profileKey as string] = byId[key];
  }
  {
    const proposal = buildServiceReconciliationProposal(slug);
    const services = new Set(Array.isArray(data.selectedServices) ? data.selectedServices : []);
    if (byId.pharmacyFirstAvailability) {
      if (!proposal.clinicalCatalogueEligible || /not applicable/i.test(byId.pharmacyFirstAvailability)) {
        services.delete("pharmacy-first");
      } else if (/^yes/i.test(byId.pharmacyFirstAvailability)) {
        services.add("pharmacy-first");
      } else {
        services.delete("pharmacy-first");
      }
    }
    for (const id of proposal.excludedIncompatibleServiceIds) services.delete(id);
    if (!proposal.clinicalCatalogueEligible) {
      // Commercial / non-dispensing tenants: approve the reconciled proposed set (PO reviewed via BPR panel).
      data.selectedServices = [...proposal.proposedCanonicalServiceIds];
    } else {
      data.selectedServices = [...services];
    }
    data.profileFieldConfirmations = {
      ...(data.profileFieldConfirmations || {}),
      approvedCanonicalServiceIds: !proposal.clinicalCatalogueEligible
        ? proposal.proposedCanonicalServiceIds
        : [...services].filter((id) => !proposal.excludedIncompatibleServiceIds.includes(id)),
      serviceReconciliationReviewedAt: new Date().toISOString(),
    };
  }
  if (byId.consultationRoom) data.consultationRoomAvailable = /^yes/i.test(byId.consultationRoom);
  if (byId.appointmentMethod) data.bookingMethod = normText(byId.appointmentMethod) || byId.appointmentMethod;
  if (byId.primaryCtaDestination) data.headerCtaUrl = normText(byId.primaryCtaDestination) || byId.primaryCtaDestination;
  if (byId.logo) {
    data.logoUrl = byId.logo;
    data.headerLogoUrl = byId.logo;
  }
  if (byId.brandPrimaryColor) data.brandPrimaryColor = byId.brandPrimaryColor;

  data.platformClientStatus = "profile_approved";
  data.profileFieldConfirmations = {
    ...(data.profileFieldConfirmations || {}),
    businessProfileReviewApprovedAt: new Date().toISOString(),
  };
  writeSetupProfile(slug, data);
}

function validateApprovalCanonicalFields(review: BusinessProfileReviewPayload): string[] {
  const errors: string[] = [];
  const authority = resolveBusinessProfileApprovalAuthority(review);
  if (!authority.canApprove) {
    errors.push(authority.approvalDisabledReason || `Confirm ${authority.remainingConfirmations} proposed canonical service(s) before approval.`);
  }
  const fieldById = Object.fromEntries(review.fields.map((f) => [f.id, f]));
  const ctaField = fieldById.primaryCtaDestination;
  if (ctaField?.applicability !== "not_applicable" && ctaField?.requiresAction) {
    const cta = normText(ctaField.finalValue);
    if (!cta) {
      errors.push("Primary CTA destination must be confirmed before approval.");
    } else if (!/^(tel:|mailto:|https?:\/\/)/i.test(cta)) {
      errors.push("Primary CTA destination must be a valid URL, telephone link (tel:), or email link (mailto:).");
    }
  } else if (ctaField?.applicability !== "not_applicable") {
    const cta = normText(ctaField?.finalValue);
    if (cta && !/^(tel:|mailto:|https?:\/\/)/i.test(cta)) {
      errors.push("Primary CTA destination must be a valid URL, telephone link (tel:), or email link (mailto:).");
    }
  }
  const appointment = fieldById.appointmentMethod;
  if (appointment?.applicability !== "not_applicable" && appointment?.requiresAction && !normText(appointment.finalValue)) {
    errors.push("Appointment or walk-in method must be confirmed before approval.");
  }
  const consultation = fieldById.consultationRoom;
  if (consultation?.applicability !== "not_applicable" && consultation?.requiresAction && !normText(consultation.finalValue)) {
    errors.push("Consultation room availability must be confirmed before approval.");
  }
  return errors;
}

export function approveBusinessProfileReview(slug: string, operator: string): {
  ok: boolean;
  errors: string[];
  snapshot: BusinessProfileApprovalSnapshot | null;
  review: BusinessProfileReviewPayload;
  alreadyApproved?: boolean;
} {
  reconcileConfirmedGoogleImportPersistence(slug);
  const recovered = recoverIncompleteApprovalPersistence(slug, operator);
  if (recovered) {
    const review = buildBusinessProfileReview(slug);
    return { ok: true, errors: [], snapshot: recovered, review, alreadyApproved: true };
  }

  let review = buildBusinessProfileReview(slug);
  if (review.loadError) {
    createMasterAdminIssue(
      {
        tenantSlug: slug,
        category: "Onboarding",
        severity: "High",
        title: "Business Profile Review failed to load",
        description: review.loadError,
        expectedBehaviour: "Review screen loads Website and Google evidence.",
        actualBehaviour: review.loadError,
        reproductionSteps: "Open Business Profile Review for tenant.",
        affectedPageOrModule: "Business Profile Review",
      },
      operator,
    );
    return { ok: false, errors: [review.loadError], snapshot: null, review };
  }

  const store = readReviewStore(slug);
  const latestSnapshot = readLatestApprovalSnapshot(slug);
  if (store?.approvalStatus === "approved" && latestSnapshot?.approvedAt) {
    return { ok: true, errors: [], snapshot: latestSnapshot, review, alreadyApproved: true };
  }

  if (review.missingSources.length) {
    reconcileConfirmedGoogleImportPersistence(slug);
    review = buildBusinessProfileReview(slug);
  }

  if (review.missingSources.length) {
    const msg = `Missing source evidence: ${review.missingSources.join(", ")}`;
    createMasterAdminIssue(
      {
        tenantSlug: slug,
        category: "Onboarding",
        severity: "High",
        title: "Business Profile Review missing source evidence",
        description: msg,
        expectedBehaviour: "Website intelligence available for review; Google intelligence only when connected.",
        actualBehaviour: msg,
        reproductionSteps: "Open Business Profile Review.",
        affectedPageOrModule: "Business Profile Review",
      },
      operator,
    );
    return { ok: false, errors: [msg], snapshot: null, review };
  }

  const profile = readSetupProfile(slug);
  const googleApproval = canApproveBusinessProfileWithGoogleState(
    resolveGoogleProfileOnboardingState(profile),
    profile,
  );
  if (!googleApproval.allowed && googleApproval.reason) {
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_business_profile_review",
      status: "error",
      evidence: `Approval blocked: ${googleApproval.reason}`,
      errors: [googleApproval.reason],
    });
    return { ok: false, errors: [googleApproval.reason], snapshot: null, review };
  }

  const authority = resolveBusinessProfileApprovalAuthority(review);
  if (!authority.canApprove) {
    const errors = (review.summary.blockingFields && review.summary.blockingFields.length
      ? review.summary.blockingFields
      : [authority.approvalDisabledReason || "Business Profile is not ready to approve."]
    ).filter(Boolean);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_business_profile_review",
      status: "error",
      evidence: `Approval blocked: ${errors.join("; ")}`,
      errors,
    });
    return { ok: false, errors, snapshot: null, review };
  }

  const canonicalErrors = validateApprovalCanonicalFields(review);
  if (canonicalErrors.length) {
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_business_profile_review",
      status: "error",
      evidence: `Approval blocked: ${canonicalErrors.join("; ")}`,
      errors: canonicalErrors,
    });
    return { ok: false, errors: canonicalErrors, snapshot: null, review };
  }

  const ctx = buildEvidenceContext(slug);
  const profileRevision = allocateApprovalRevisionNumber(slug, store, latestSnapshot);
  const approvedAt = new Date().toISOString();

  const snapshot: BusinessProfileApprovalSnapshot = {
    version: 1,
    slug,
    profileRevision,
    approvedAt,
    approvedBy: operator,
    finalValues: Object.fromEntries(review.fields.map((f) => [f.id, normText(f.finalValue)])),
    fields: review.fields,
    websiteEvidenceVersion: normText(ctx.websiteSnap.importedAt) || null,
    googleEvidenceVersion: ctx.googleIntel?.importedAt || null,
    conflictDecisions: store?.decisions || {},
    deferredFields: store?.deferredFields || [],
    warnings: review.summary.nonBlockingWarnings,
    sourceTimestamps: {
      websiteImportedAt: normText(ctx.websiteSnap.importedAt) || null,
      googleImportedAt: ctx.googleIntel?.importedAt || null,
      profileUpdatedAt: fs.existsSync(profilePath(slug))
        ? (JSON.parse(fs.readFileSync(profilePath(slug), "utf8")) as { updatedAt?: string }).updatedAt || null
        : null,
    },
  };

  try {
    fs.mkdirSync(approvalDir(slug), { recursive: true });
    const revisionPath = approvalSnapshotPath(slug, profileRevision);

    applyFinalValuesToProfile(slug, review.fields);

    writeJsonAtomic(revisionPath, snapshot);
    writeJsonAtomic(latestApprovalPath(slug), snapshot);

    const approvedStore: BusinessProfileReviewStore = {
      version: 1,
      slug,
      updatedAt: approvedAt,
      savedAt: store?.savedAt || approvedAt,
      savedBy: store?.savedBy || operator,
      profileRevision,
      approvalStatus: "approved",
      approvedAt,
      approvedBy: operator,
      decisions: store?.decisions || {},
      deferredFields: store?.deferredFields || [],
      websiteEvidenceVersion: snapshot.websiteEvidenceVersion,
      googleEvidenceVersion: snapshot.googleEvidenceVersion,
    };
    writeReviewStore(approvedStore);

    writeWorkflowAcknowledgement(slug, "business-profile-intelligence", operator);

    const stages = [
      { from: "business_profile_intelligence" as const, to: "resolve_import_conflicts" as const, evidence: "Business Profile Review approved" },
      { from: "resolve_import_conflicts" as const, to: "approve_business_profile" as const, evidence: "Import conflicts resolved via review" },
      { from: "approve_business_profile" as const, to: "generate_growth_intelligence" as const, evidence: "Canonical Business Profile approved" },
    ];
    for (const step of stages) {
      startWorkflowExecution({ slug, stageId: step.from, actionId: "approve_business_profile_review", operator });
      finishWorkflowExecution({
        slug,
        stageId: step.from,
        actionId: "approve_business_profile_review",
        operator,
        evidence: step.evidence,
        status: "completed",
      });
      recordWorkflowTransition({
        slug,
        fromStage: step.from,
        toStage: step.to,
        operator,
        reason: "Business Profile Review approved",
        evidence: step.evidence,
      });
    }

    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_business_profile_review",
      status: "success",
      evidence: `Business Profile approved revision ${profileRevision}`,
      metadata: { profileRevision },
    });

    return { ok: true, errors: [], snapshot, review: buildBusinessProfileReview(slug) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordMasterAdminAudit({
      user: operator,
      slug,
      action: "approve_business_profile_review",
      status: "error",
      evidence: `Approval failed: ${message}`,
      errors: [message],
    });
    return { ok: false, errors: [message], snapshot: null, review };
  }
}

export function handleBusinessProfileReviewLoadFailure(slug: string, operator: string, error: string): void {
  createMasterAdminIssue(
    {
      tenantSlug: slug,
      category: "Onboarding",
      severity: "High",
      title: "Business Profile Review data unavailable",
      description: error,
      expectedBehaviour: "Review screen loads imported Website and Google evidence.",
      actualBehaviour: error,
      reproductionSteps: "Navigate to Business Profile Review.",
      affectedPageOrModule: "Business Profile Review",
    },
    operator,
  );
}
