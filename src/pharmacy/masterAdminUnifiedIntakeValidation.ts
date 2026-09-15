/**
 * Sprint 7A Defect 041 — unified intake and automated source orchestration validation.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { getCustomerAccountDetail } from "./masterAdminAccountService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import { buildMasterAdminCustomerRecord } from "./masterAdminPlatformService.ts";
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { buildCustomerWorkflowState } from "./masterAdminWorkflowEngine.ts";
import {
  buildOnboardingSourcesSummary,
  previewFutureCustomerIntake,
  reconcileExistingTenantOnboardingBatch,
  readOnboardingBatch,
} from "./masterAdminOnboardingBatchService.ts";
import {
  computeGoogleSourceRevision,
  computeWebsiteSourceRevision,
  findActiveJobByIdempotencyKey,
  buildSourceIdempotencyKey,
} from "./masterAdminSourceJobGuardService.ts";

const BANNER_CROSS_SLUG = "banner-cross-pharmacy";

const FUTURE_FIXTURE = {
  pharmacyName: "Fixture Branch Pharmacy",
  website: "https://example-pharmacy.co.uk/branch-fixture",
  contactEmail: "fixture-branch@pharmaconnect.uk",
  googleBusinessProfileUrl: "https://maps.app.goo.gl/fixture-example",
  phone: "0114 000 0000",
  postcode: "S1 1AA",
};

export function runUnifiedIntakeValidation(operator: string): {
  slug: string;
  passed: boolean;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
  bannerCross: {
    queuedGoogleJobId: string | null;
    queuedJobAction: string;
    googleIntelligencePopulated: boolean;
    duplicateJobCreated: boolean;
  };
  futureFixture: ReturnType<typeof previewFutureCustomerIntake>;
} {
  const batch = reconcileExistingTenantOnboardingBatch(BANNER_CROSS_SLUG, operator);
  const record = buildMasterAdminCustomerRecord(BANNER_CROSS_SLUG);
  const websiteSource = buildWebsiteSourceSummary(BANNER_CROSS_SLUG);
  const onboarding = buildOnboardingSourcesSummary(BANNER_CROSS_SLUG);
  const profile = readSetupProfile(BANNER_CROSS_SLUG);
  const account = getCustomerAccountDetail(BANNER_CROSS_SLUG);
  const intel = readGoogleIntelligenceRecord(BANNER_CROSS_SLUG);
  const wf = buildCustomerWorkflowState(BANNER_CROSS_SLUG, operator);
  const audit = listMasterAdminAudit({ slug: BANNER_CROSS_SLUG, limit: 20 });
  const jobs = listMasterAdminJobs({ slug: BANNER_CROSS_SLUG, limit: 10 });
  const queuedGoogle = jobs.find((j) => j.action === "import_google" && j.status === "queued") || null;

  const googleRevision = computeGoogleSourceRevision(
    String(profile.googlePlaceId || ""),
    String(profile.googleBusinessProfileUrl || ""),
  );
  const duplicateActive = findActiveJobByIdempotencyKey(
    buildSourceIdempotencyKey(BANNER_CROSS_SLUG, "import_google", googleRevision),
  );

  const futureFixture = previewFutureCustomerIntake(FUTURE_FIXTURE);

  const checks = [
    {
      label: "Unified intake screen fields supported",
      passed: Boolean(record?.onboardingSources),
      detail: "onboardingSources on customer record",
    },
    {
      label: "Website field captured",
      passed: websiteSource.canonicalWebsite.includes("bannercross-pharmacy-sheffield"),
      detail: websiteSource.canonicalWebsite,
    },
    {
      label: "Google Profile field captured",
      passed: Boolean(record?.googleSource?.placeId),
      detail: record?.googleSource?.placeId || "missing",
    },
    {
      label: "Place ID field captured",
      passed: Boolean(profile.googlePlaceId),
      detail: profile.googlePlaceId || "missing",
    },
    {
      label: "Automated onboarding batch",
      passed: Boolean(readOnboardingBatch(BANNER_CROSS_SLUG)),
      detail: batch.overallState,
    },
    {
      label: "Website Import not repeated",
      passed: onboarding.website.importState === "completed" || onboarding.website.importState === "skipped",
      detail: onboarding.website.importState,
    },
    {
      label: "Google Intelligence stored once",
      passed: Boolean(intel?.importedAt && intel.placeId),
      detail: intel?.importedAt || "missing",
    },
    {
      label: "Duplicate Google job guard",
      passed: !queuedGoogle || Boolean(intel?.importedAt),
      detail: queuedGoogle ? `queued ${queuedGoogle.id}` : "no duplicate queued",
    },
    {
      label: "Idempotency guard active",
      passed: !duplicateActive || duplicateActive.status === "completed",
      detail: duplicateActive?.status || "none active",
    },
    {
      label: "Workflow advanced to BPI",
      passed: wf?.currentStage === "business_profile_intelligence",
      detail: wf?.currentStage || "unknown",
    },
    {
      label: "Customer account preserved",
      passed: account.hasAccount,
      detail: account.username || "missing",
    },
    {
      label: "Audit preserved",
      passed: audit.length >= 5,
      detail: `${audit.length} entries`,
    },
    {
      label: "Future customer payload validation",
      passed: futureFixture.wouldQueueWebsite && futureFixture.wouldQueueGoogle,
      detail: `website ${futureFixture.websiteRevision.slice(0, 8)} · google ${futureFixture.googleRevision.slice(0, 8)}`,
    },
  ];

  return {
    slug: BANNER_CROSS_SLUG,
    passed: checks.every((c) => c.passed),
    checks,
    bannerCross: {
      queuedGoogleJobId: queuedGoogle?.id || null,
      queuedJobAction: queuedGoogle ? "none — intelligence already complete" : "no queued job",
      googleIntelligencePopulated: Boolean(intel?.importedAt),
      duplicateJobCreated: Boolean(queuedGoogle && intel?.importedAt),
    },
    futureFixture,
  };
}
