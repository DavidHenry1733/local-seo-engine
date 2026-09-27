/**
 * Read-only canonical campaign lifecycle resolver (CP01).
 * Observes existing stores. Does not approve, publish, generate, or rewrite them.
 * Historical and unscoped records stay labelled and never become current authority.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import {
  CANONICAL_CAMPAIGN_LIFECYCLE_VERSION,
  CANONICAL_LIFECYCLE_REASON,
  type CanonicalApprovalAuthorityName,
  type CanonicalApprovalStamp,
  type CanonicalCampaignLifecycle,
  type CanonicalCampaignLifecycleHealth,
  type CanonicalCampaignPageRevision,
  type CanonicalCandidateEvidenceSet,
  type CanonicalLifecycleEvidenceScope,
  type CanonicalLifecycleHealthCheck,
  type CanonicalLifecycleReasonCode,
  type CanonicalMembershipConflict,
  type CanonicalPublishIndexPage,
  type CanonicalResultsJoinStatus,
  type CanonicalResultsSource,
} from "./canonicalCampaignLifecycleModel.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

const REVIEW_CENTRE_SERVICE_PAGE_KEY = "service-page-candidate";

export interface ResolveCanonicalCampaignLifecycleInput {
  tenantSlug: string;
  campaignId: string;
}

interface CampaignAreaRecord {
  areaSlug?: unknown;
  areaName?: unknown;
  selected?: unknown;
}

interface CampaignRecord {
  id?: unknown;
  serviceId?: unknown;
  status?: unknown;
  publishingStatus?: unknown;
  publishedPages?: unknown;
  campaignAreas?: unknown;
}

export type CanonicalLocalityContentState = "PRESENT" | "MISSING" | "UNRESOLVED";

export interface CanonicalCampaignMembership {
  resolved: boolean;
  tenantSlug: string | null;
  campaignId: string | null;
  serviceId: string | null;
  areaSlugs: string[];
  localityStates: Array<{ areaSlug: string; contentState: CanonicalLocalityContentState }>;
  unattachedAreaSlugs: string[];
  packageAreaSlugs: string[] | null;
  servicePageState: CanonicalLocalityContentState;
  expectedWebsitePages: number;
  conflicts: CanonicalCampaignLifecycle["membership"]["conflicts"];
}

/**
 * Shared membership read for campaign, review, quality, and publishing screens.
 * Package areas and rendered directories stay evidence. They do not become membership.
 */
export function resolveCanonicalCampaignMembership(
  input: ResolveCanonicalCampaignLifecycleInput,
): CanonicalCampaignMembership {
  const lifecycle = resolveCanonicalCampaignLifecycle(input);
  const resolved = lifecycle.identity.scope === "CANONICAL";
  const localityStates = lifecycle.content.localityPages.map((page) => ({
    areaSlug: page.areaSlug || "",
    contentState: localityContentState(page),
  }));
  return {
    resolved,
    tenantSlug: lifecycle.identity.tenantSlug,
    campaignId: lifecycle.identity.campaignId,
    serviceId: lifecycle.identity.serviceId,
    areaSlugs: resolved ? lifecycle.membership.campaignAreaSlugs : [],
    localityStates: resolved ? localityStates : [],
    unattachedAreaSlugs: resolved ? lifecycle.membership.unattachedOutputs : [],
    packageAreaSlugs: resolved ? lifecycle.membership.packageAreaSlugs : null,
    servicePageState: !resolved
      ? "UNRESOLVED"
      : lifecycle.content.servicePage?.observedContentHash
        ? "PRESENT"
        : "MISSING",
    expectedWebsitePages: resolved ? 1 + lifecycle.membership.campaignAreaSlugs.length : 0,
    conflicts: resolved ? lifecycle.membership.conflicts : [],
  };
}

/**
 * Resolve the campaign UUID for a service without using package areas or HTML.
 * A package campaign id is accepted only when that campaign belongs to the service.
 * A missing package campaign id never selects a different campaign's areas.
 */
export function resolveCanonicalCampaignIdForService(
  tenantSlug: string,
  serviceId: string,
  packageCampaignId?: string | null,
): string | null {
  const slug = strictSlug(tenantSlug);
  const service = String(serviceId || "").trim();
  if (!slug || !service) return null;
  const inspected: string[] = [];
  const store = readJson(workspacePath("data/pharmacy-campaigns", `${slug}.json`), inspected);
  const campaigns = (Array.isArray(store?.campaigns) ? store.campaigns : []) as CampaignRecord[];
  const matching = campaigns.filter(
    (campaign) => String(campaign.serviceId || "") === service && String(campaign.status || "active") !== "archived",
  );
  const packageId = String(packageCampaignId || "").trim();
  if (packageId && matching.some((campaign) => String(campaign.id || "") === packageId)) return packageId;
  const active = readActiveCampaignSelection(slug, inspected);
  if (
    active &&
    active.serviceId === service &&
    matching.some((campaign) => String(campaign.id || "") === active.campaignId)
  ) {
    return active.campaignId;
  }
  if (matching.length === 1) return String(matching[0]?.id || "") || null;
  return null;
}

function localityContentState(page: CanonicalCampaignLifecycle["content"]["localityPages"][number]): CanonicalLocalityContentState {
  if (!page.areaSlug || !page.sourcePath) return "UNRESOLVED";
  return page.observedContentHash ? "PRESENT" : "MISSING";
}

function readActiveCampaignSelection(
  slug: string,
  inspected: string[],
): { campaignId: string; serviceId: string } | null {
  const doc = readJson(workspacePath("data/pharmacy-master-admin/active-service-campaign", `${slug}.json`), inspected);
  const campaignId = nonEmptyString(doc?.campaignId);
  const serviceId = nonEmptyString(doc?.serviceId);
  if (!campaignId || !serviceId) return null;
  return { campaignId, serviceId };
}

export function resolveCanonicalCampaignLifecycle(
  input: ResolveCanonicalCampaignLifecycleInput,
): CanonicalCampaignLifecycle {
  const inspected: string[] = [];
  const tenantSlug = strictSlug(input.tenantSlug);
  const campaignId = String(input.campaignId || "").trim();
  const campaignPath = tenantSlug
    ? workspacePath("data/pharmacy-campaigns", `${tenantSlug}.json`)
    : null;
  const store = campaignPath ? readJson(campaignPath, inspected) : null;
  const campaigns = Array.isArray(store?.campaigns) ? (store?.campaigns as CampaignRecord[]) : [];
  const campaign = campaignId ? campaigns.find((item) => String(item?.id || "") === campaignId) || null : null;
  const serviceId = campaign ? nonEmptyString(campaign.serviceId) : null;
  const identityScope: CanonicalLifecycleEvidenceScope = campaign && serviceId ? "CANONICAL" : "UNRESOLVED";

  const membership = resolveMembership(tenantSlug, serviceId, campaign, inspected);
  const content = resolveContent(tenantSlug, campaignId, serviceId, membership.campaignAreaSlugs, inspected);
  const approval = resolveApproval(
    tenantSlug,
    campaignId,
    serviceId,
    membership.campaignAreaSlugs,
    content,
    inspected,
  );
  const publishing = resolvePublishing(tenantSlug, campaign, inspected);
  const contentGeneratedAt = newestTimestamp([
    content.packageGeneratedAt,
    content.servicePage?.generatedAt || null,
  ]);
  const indexing = resolveMeasurementGroup(
    tenantSlug,
    [
      {
        id: "pharmacy-indexing",
        relativePath: tenantSlug ? `data/pharmacy-indexing/${tenantSlug}.json` : null,
        missing: CANONICAL_LIFECYCLE_REASON.indexingStoreMissing,
        unscoped: CANONICAL_LIFECYCLE_REASON.indexingStoreUnscoped,
        stale: CANONICAL_LIFECYCLE_REASON.indexingStoreStale,
      },
      {
        id: "search-console-authority",
        relativePath: tenantSlug ? `data/pharmacy-search-console-authority/${tenantSlug}.json` : null,
        missing: CANONICAL_LIFECYCLE_REASON.searchConsoleAuthorityMissing,
        unscoped: CANONICAL_LIFECYCLE_REASON.indexingStoreUnscoped,
        stale: CANONICAL_LIFECYCLE_REASON.indexingStoreStale,
      },
      {
        id: "index-dashboard",
        relativePath: tenantSlug ? `output/${tenantSlug}/index-dashboard.json` : null,
        missing: CANONICAL_LIFECYCLE_REASON.indexDashboardMissing,
        unscoped: CANONICAL_LIFECYCLE_REASON.indexDashboardUnscoped,
        stale: CANONICAL_LIFECYCLE_REASON.indexDashboardStale,
      },
    ],
    contentGeneratedAt,
    inspected,
  );
  const results = resolveMeasurementGroup(
    tenantSlug,
    [
      {
        id: "gsc-summary",
        relativePath: tenantSlug ? `output/${tenantSlug}/gsc-summary.json` : null,
        missing: CANONICAL_LIFECYCLE_REASON.gscSummaryMissing,
        unscoped: CANONICAL_LIFECYCLE_REASON.gscSummaryUnscoped,
        stale: CANONICAL_LIFECYCLE_REASON.gscSummaryStale,
      },
      {
        id: "rank-tracking",
        relativePath: tenantSlug ? `output/${tenantSlug}/rank-tracking.json` : null,
        missing: CANONICAL_LIFECYCLE_REASON.rankTrackingMissing,
        unscoped: CANONICAL_LIFECYCLE_REASON.rankTrackingUnscoped,
        stale: CANONICAL_LIFECYCLE_REASON.rankTrackingStale,
      },
      {
        id: "visibility",
        relativePath: tenantSlug ? `data/pharmacy-visibility/${tenantSlug}.json` : null,
        missing: CANONICAL_LIFECYCLE_REASON.visibilityMissing,
        unscoped: CANONICAL_LIFECYCLE_REASON.visibilityUnscoped,
        stale: CANONICAL_LIFECYCLE_REASON.visibilityStale,
      },
    ],
    contentGeneratedAt,
    inspected,
  );

  const lifecycle: CanonicalCampaignLifecycle = {
    version: CANONICAL_CAMPAIGN_LIFECYCLE_VERSION,
    identity: {
      tenantSlug,
      campaignId: campaignId || null,
      serviceId,
      campaignStatus: campaign ? nonEmptyString(campaign.status) : null,
      scope: identityScope,
    },
    membership,
    content,
    approval,
    publishing,
    indexing: { sources: indexing },
    results: { sources: results },
    health: emptyHealth(),
    inspectedPaths: uniqueSorted(inspected),
  };
  lifecycle.health = buildHealth(lifecycle);
  return lifecycle;
}

function resolveMembership(
  tenantSlug: string | null,
  serviceId: string | null,
  campaign: CampaignRecord | null,
  inspected: string[],
): CanonicalCampaignLifecycle["membership"] {
  const conflicts: CanonicalMembershipConflict[] = [];
  const areas = Array.isArray(campaign?.campaignAreas) ? (campaign?.campaignAreas as CampaignAreaRecord[]) : [];
  const campaignAreaSlugs: string[] = [];
  let missingSlug = false;
  for (const area of areas) {
    if (area?.selected === false) continue;
    const slug = nonEmptyString(area?.areaSlug);
    if (!slug) {
      missingSlug = true;
      continue;
    }
    campaignAreaSlugs.push(slug);
  }
  const canonical = uniqueSorted(campaignAreaSlugs);
  if (missingSlug) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.membershipAreaSlugMissing,
      detail: "A selected campaign area has no areaSlug. It was not added to canonical membership.",
    });
  }

  const packageDoc = tenantSlug && serviceId ? readPackage(tenantSlug, serviceId, inspected) : null;
  const packageAreaSlugs = packageDoc?.areaSlugs ?? null;
  if (packageDoc?.areaScope === "UNRESOLVED") {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.packageAreaSetUnresolved,
      detail: "The content package does not contain a selectedAreas array.",
    });
  } else if (packageAreaSlugs && !sameSet(packageAreaSlugs, canonical)) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.packageAreaSetDiffers,
      detail: `Package locality slugs differ from campaign membership (${packageAreaSlugs.length} package, ${canonical.length} campaign).`,
    });
  }

  const rendered = tenantSlug && serviceId ? listRenderedLocalities(tenantSlug, serviceId, inspected) : [];
  const renderedScope: CanonicalLifecycleEvidenceScope = "UNSCOPED";
  if (rendered.length || canonical.length) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.renderedOutputUnscoped,
      detail: "Rendered locality directories are stored by tenant and service, not by campaign id.",
    });
  }
  const unattachedOutputs = rendered.filter((slug) => !canonical.includes(slug));
  const missingOutputs = canonical.filter((slug) => !rendered.includes(slug));
  if (unattachedOutputs.length) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.unattachedRenderedOutput,
      detail: `Rendered outputs are not in campaign membership: ${unattachedOutputs.join(", ")}`,
    });
  }
  if (missingOutputs.length) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.missingRenderedOutput,
      detail: `Campaign localities have no rendered index: ${missingOutputs.join(", ")}`,
    });
  }
  if (rendered.length && !sameSet(rendered, canonical)) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.renderedAreaSetDiffers,
      detail: `Rendered locality slugs differ from campaign membership (${rendered.length} rendered, ${canonical.length} campaign).`,
    });
  }

  const candidateSets = tenantSlug && serviceId ? listCandidateSets(tenantSlug, serviceId, inspected) : [];
  const comparableCandidates = candidateSets.filter((set) => set.scope !== "HISTORICAL");
  if (comparableCandidates.length > 1) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.candidateRevisionUnresolved,
      detail: "More than one candidate locality set exists. None was selected as current.",
    });
  } else if (comparableCandidates.length === 1 && !sameSet(comparableCandidates[0]!.areaSlugs, canonical)) {
    conflicts.push({
      code: CANONICAL_LIFECYCLE_REASON.candidateAreaSetDiffers,
      detail: `Candidate locality slugs differ from campaign membership (${comparableCandidates[0]!.areaSlugs.length} candidate, ${canonical.length} campaign).`,
    });
  }

  const blocking = new Set<CanonicalLifecycleReasonCode>([
    CANONICAL_LIFECYCLE_REASON.packageAreaSetDiffers,
    CANONICAL_LIFECYCLE_REASON.renderedAreaSetDiffers,
    CANONICAL_LIFECYCLE_REASON.candidateAreaSetDiffers,
    CANONICAL_LIFECYCLE_REASON.unattachedRenderedOutput,
    CANONICAL_LIFECYCLE_REASON.missingRenderedOutput,
    CANONICAL_LIFECYCLE_REASON.membershipAreaSlugMissing,
    CANONICAL_LIFECYCLE_REASON.packageAreaSetUnresolved,
    CANONICAL_LIFECYCLE_REASON.candidateRevisionUnresolved,
  ]);
  const membershipAgreement = Boolean(campaign) && conflicts.every((conflict) => !blocking.has(conflict.code));

  return {
    campaignAreaSlugs: canonical,
    packageAreaSlugs,
    renderedAreaSlugs: rendered,
    renderedScope,
    candidateSets,
    membershipAgreement,
    unattachedOutputs,
    missingOutputs,
    conflicts,
  };
}

function resolveContent(
  tenantSlug: string | null,
  campaignId: string,
  serviceId: string | null,
  campaignAreaSlugs: string[],
  inspected: string[],
): CanonicalCampaignLifecycle["content"] {
  const packageDoc = tenantSlug && serviceId ? readPackage(tenantSlug, serviceId, inspected) : null;
  const servicePath =
    tenantSlug && serviceId
      ? workspacePath("output/pharmacy-visual-experience", tenantSlug, serviceId, "index.html")
      : null;
  const servicePage = servicePath ? observePage("service", serviceId, null, servicePath, null, inspected) : null;
  const localityPages = campaignAreaSlugs.map((areaSlug) => {
    const file =
      tenantSlug && serviceId
        ? workspacePath("output/pharmacy-content-ecosystem", tenantSlug, serviceId, "local", areaSlug, "index.html")
        : null;
    return observePage("locality", serviceId, areaSlug, file, null, inspected);
  });
  const runDir =
    tenantSlug && serviceId
      ? workspacePath("data/pharmacy-local-page-campaign-runs", tenantSlug, serviceId)
      : null;
  const currentPath = runDir ? path.join(runDir, "current.json") : null;
  const currentRaw = currentPath ? readJson(currentPath, inspected) : null;
  const legacyRunPaths = runDir ? listLegacyRunFiles(runDir, inspected) : [];
  const packageCampaignId = packageDoc?.campaignId ?? null;
  const packageCampaignScope: CanonicalLifecycleEvidenceScope = !packageDoc?.present
    ? "UNRESOLVED"
    : packageCampaignId
      ? packageCampaignId === campaignId
        ? "CANONICAL"
        : "UNSCOPED"
      : "UNRESOLVED";

  return {
    servicePage,
    localityPages,
    supportingPages: [],
    packagePath: packageDoc?.path ?? null,
    packagePresent: Boolean(packageDoc?.present),
    packageCampaignId,
    packageCampaignScope,
    packageGeneratedAt: packageDoc?.generatedAt ?? null,
    currentRun: {
      present: Boolean(currentRaw),
      path: currentPath || "",
      scope: "UNRESOLVED",
      kind: nonEmptyString(currentRaw?.kind),
      runId: nonEmptyString(currentRaw?.runId),
      candidateVersion: nonEmptyString(currentRaw?.candidateVersion),
      published: typeof currentRaw?.published === "boolean" ? currentRaw.published : null,
      indexed: typeof currentRaw?.indexed === "boolean" ? currentRaw.indexed : null,
    },
    legacyRunPaths,
    revisionStatus: "unresolved",
  };
}

function resolveApproval(
  tenantSlug: string | null,
  campaignId: string,
  serviceId: string | null,
  campaignAreaSlugs: string[],
  content: CanonicalCampaignLifecycle["content"],
  inspected: string[],
): CanonicalCampaignLifecycle["approval"] {
  const decisionPath =
    tenantSlug && campaignId
      ? workspacePath("data/pharmacy-master-admin/service-page-review", tenantSlug, "by-campaign", campaignId, "decision.json")
      : null;
  const decision = decisionPath ? readJson(decisionPath, inspected) : null;
  const decisionCampaignOk = !decision || String(decision.campaignId || "") === campaignId;
  const decisionServiceOk = !decision || !serviceId || String(decision.serviceId || "") === serviceId;
  const servicePage: CanonicalApprovalStamp | null = decision
    ? {
        status: nonEmptyString(decision.decision),
        source: "data/pharmacy-master-admin/service-page-review",
        scope: decisionCampaignOk && decisionServiceOk ? "CANONICAL" : "UNSCOPED",
        approvedAt: nonEmptyString(decision.decidedAt),
        revisionId: nonEmptyString(decision.generationRevision),
        revisionStatus: "unresolved",
        areaSlugs: [],
      }
    : null;

  const unscopedPath = tenantSlug
    ? workspacePath("data/pharmacy-master-admin/service-page-review", tenantSlug, "decision.json")
    : null;
  const unscopedRaw = unscopedPath ? readJson(unscopedPath, inspected) : null;
  const unscopedServicePage: CanonicalApprovalStamp | null = unscopedRaw
    ? {
        status: nonEmptyString(unscopedRaw.decision),
        source: "data/pharmacy-master-admin/service-page-review/decision.json",
        scope: "UNSCOPED",
        approvedAt: nonEmptyString(unscopedRaw.decidedAt),
        revisionId: nonEmptyString(unscopedRaw.generationRevision),
        revisionStatus: "unresolved",
        areaSlugs: [],
      }
    : null;

  const builderPath = tenantSlug ? workspacePath("data/growth-engine", `${tenantSlug}-campaign-builder.json`) : null;
  const builder = builderPath ? readJson(builderPath, inspected) : null;
  const approvedAssets =
    builder?.approvedAssets && typeof builder.approvedAssets === "object"
      ? (builder.approvedAssets as Record<string, unknown>)
      : null;
  const reviewSlugs = uniqueSorted(
    Object.entries(approvedAssets || {})
      .filter(([, value]) => approvalValuePresent(value))
      .map(([key]) => areaSlugFromAssetKey(key))
      .filter((slug): slug is string => Boolean(slug)),
  );
  const reviewServiceApproved = Boolean(
    approvedAssets && approvalValuePresent(approvedAssets[REVIEW_CENTRE_SERVICE_PAGE_KEY]),
  );
  const reviewCentre: CanonicalApprovalStamp | null = approvedAssets
    ? {
        status: reviewSlugs.length || reviewServiceApproved ? "approved" : "empty",
        source: "data/growth-engine campaign-builder approvedAssets",
        scope: "UNSCOPED",
        approvedAt: null,
        revisionId: null,
        revisionStatus: "unresolved",
        areaSlugs: reviewSlugs,
      }
    : null;

  const localityPath =
    tenantSlug && campaignId
      ? workspacePath(
          "data/pharmacy-master-admin/cluster-page-review",
          tenantSlug,
          "by-campaign",
          campaignId,
          "localities.json",
        )
      : null;
  const localityRaw = localityPath ? readJson(localityPath, inspected) : null;
  const localityCampaignOk = !localityRaw || String(localityRaw.campaignId || "") === campaignId;
  const localityDecisions = localityRaw?.decisions && typeof localityRaw.decisions === "object"
    ? (localityRaw.decisions as Record<string, { decision?: unknown; decidedAt?: unknown }>)
    : null;
  const localityApproved = uniqueSorted(
    Object.entries(localityDecisions || {})
      .filter(([, value]) => String(value?.decision || "") === "approved")
      .map(([slug]) => slug),
  );
  const localityStamp: CanonicalApprovalStamp | null = localityRaw
    ? {
        status: localityApproved.length ? "approved" : "present",
        source: "data/pharmacy-master-admin/cluster-page-review",
        scope: localityCampaignOk ? "CANONICAL" : "UNSCOPED",
        approvedAt: nonEmptyString(localityRaw.updatedAt),
        revisionId: null,
        revisionStatus: "unresolved",
        areaSlugs: localityApproved,
      }
    : null;

  const generationPath =
    tenantSlug && campaignId
      ? workspacePath(
          "data/pharmacy-master-admin/service-page-generation",
          tenantSlug,
          "by-campaign",
          campaignId,
          "latest.json",
        )
      : null;
  const generation = generationPath ? readJson(generationPath, inspected) : null;
  const generationRevision = nonEmptyString(generation?.imageAssignmentRevision);
  const decisionRevision = servicePage?.revisionId || null;
  let imageAssignmentStamp: CanonicalCampaignLifecycle["approval"]["imageAssignmentStamp"] = "absent";
  if (generationRevision && decisionRevision) {
    imageAssignmentStamp = generationRevision === decisionRevision ? "matched" : "mismatched";
  }

  const historical = tenantSlug && serviceId ? listHistoricalEvidence(tenantSlug, serviceId, inspected) : [];
  const localityAuthority = chooseLocalityAuthority(reviewSlugs, localityStamp);
  const serviceCompeting = serviceAuthorities(servicePage, unscopedServicePage, reviewServiceApproved);
  const competing = uniqueAuthorities([
    ...serviceCompeting.competing,
    ...localityAuthority.competing,
  ]);
  const approvalAmbiguity = serviceCompeting.ambiguous || localityAuthority.ambiguous;
  const currentApprovalAuthority: CanonicalApprovalAuthorityName = approvalAmbiguity
    ? "AMBIGUOUS"
    : serviceCompeting.authority !== "NONE"
      ? serviceCompeting.authority
      : localityAuthority.authority;

  const formalLocalityApprovals =
    localityAuthority.authority === "MASTER_ADMIN_LOCALITY_DECISIONS" ? localityApproved : [];

  return {
    currentApprovalAuthority,
    competingApprovalAuthorities: competing,
    approvalRevisionMatch: "unresolved",
    approvalAmbiguity,
    servicePage,
    unscopedServicePage,
    reviewCentre,
    localityDecisions: localityStamp,
    localityApprovedCount: localityAuthority.ambiguous ? 0 : formalLocalityApprovals.length,
    localityExpectedCount: campaignAreaSlugs.length,
    imageAssignmentStamp,
    historical,
  };
}

function resolvePublishing(
  tenantSlug: string | null,
  campaign: CampaignRecord | null,
  inspected: string[],
): CanonicalCampaignLifecycle["publishing"] {
  const publishIndexPath = tenantSlug ? workspacePath("output/pharmacy-publish", tenantSlug, "_publish-index.json") : "";
  const publishIndex = publishIndexPath ? readJson(publishIndexPath, inspected) : null;
  const pages = Array.isArray(publishIndex?.pages) ? publishIndex.pages as Array<Record<string, unknown>> : [];
  const mapped: CanonicalPublishIndexPage[] = pages.map((page) => {
    const campaignStamp = nonEmptyString(page.campaignId);
    const contentHash = nonEmptyString(page.contentHash) || nonEmptyString(page.revision) || nonEmptyString(page.revisionId);
    return {
      pageType: nonEmptyString(page.pageType),
      serviceId: nonEmptyString(page.serviceId),
      areaSlug: nonEmptyString(page.areaSlug),
      campaignId: campaignStamp,
      contentHash,
      revisionId: nonEmptyString(page.revisionId) || nonEmptyString(page.revision),
      canonicalUrl: nonEmptyString(page.url) || nonEmptyString(page.canonicalUrl),
      scope: campaignStamp && contentHash ? "CANONICAL" : "UNSCOPED",
    };
  });
  const sitemapPath = tenantSlug ? workspacePath("output/pharmacy-publish", tenantSlug, "sitemap.xml") : "";
  const sitemapPresent = sitemapPath ? fileExists(sitemapPath, inspected) : false;
  return {
    publishingStatus: campaign ? nonEmptyString(campaign.publishingStatus) : null,
    publishedPages: campaign && Number.isFinite(Number(campaign.publishedPages)) ? Number(campaign.publishedPages) : null,
    publishIndexPresent: Boolean(publishIndex),
    publishIndexPath,
    pages: mapped,
    sitemapPresent,
    sitemapPath,
    sitemapScope: sitemapPresent ? "UNSCOPED" : null,
  };
}

function buildHealth(lifecycle: CanonicalCampaignLifecycle): CanonicalCampaignLifecycleHealth {
  const identityReasons: CanonicalLifecycleReasonCode[] = [];
  if (!lifecycle.identity.tenantSlug || !lifecycle.identity.campaignId || !lifecycle.identity.serviceId) {
    identityReasons.push(
      lifecycle.identity.tenantSlug && lifecycle.identity.campaignId
        ? CANONICAL_LIFECYCLE_REASON.campaignNotFound
        : CANONICAL_LIFECYCLE_REASON.identityUnresolved,
    );
  }

  const membershipReasons = uniqueCodes(lifecycle.membership.conflicts.map((conflict) => conflict.code));
  const contentReasons: CanonicalLifecycleReasonCode[] = [];
  if (lifecycle.identity.serviceId && !lifecycle.content.packagePresent) {
    contentReasons.push(CANONICAL_LIFECYCLE_REASON.packageMissing);
  }
  if (lifecycle.content.packagePresent && !lifecycle.content.packageCampaignId) {
    contentReasons.push(CANONICAL_LIFECYCLE_REASON.packageCampaignIdMissing);
  }
  if (
    lifecycle.content.packageCampaignId &&
    lifecycle.identity.campaignId &&
    lifecycle.content.packageCampaignId !== lifecycle.identity.campaignId
  ) {
    contentReasons.push(CANONICAL_LIFECYCLE_REASON.packageCampaignIdMismatch);
  }
  if (!lifecycle.content.servicePage?.observedContentHash) {
    contentReasons.push(CANONICAL_LIFECYCLE_REASON.servicePageOutputMissing);
  }
  if (lifecycle.content.revisionStatus !== "resolved") {
    contentReasons.push(CANONICAL_LIFECYCLE_REASON.contentRevisionUnresolved);
  }

  const approvalReasons: CanonicalLifecycleReasonCode[] = [];
  if (lifecycle.approval.approvalAmbiguity) {
    approvalReasons.push(CANONICAL_LIFECYCLE_REASON.multipleApprovalAuthorities);
  }
  if (lifecycle.approval.localityDecisions && lifecycle.approval.localityDecisions.scope !== "CANONICAL") {
    approvalReasons.push(CANONICAL_LIFECYCLE_REASON.approvalStoreCampaignMismatch);
  }
  if (lifecycle.approval.unscopedServicePage?.status === "approved") {
    approvalReasons.push(CANONICAL_LIFECYCLE_REASON.servicePageApprovalUnscoped);
  }
  if (lifecycle.approval.servicePage && lifecycle.approval.servicePage.scope !== "CANONICAL") {
    approvalReasons.push(CANONICAL_LIFECYCLE_REASON.servicePageDecisionServiceMismatch);
  }
  if (lifecycle.approval.approvalRevisionMatch !== "matched") {
    approvalReasons.push(CANONICAL_LIFECYCLE_REASON.approvalRevisionUnresolved);
  }
  if (
    lifecycle.membership.campaignAreaSlugs.length > 0 &&
    lifecycle.approval.localityApprovedCount < lifecycle.approval.localityExpectedCount
  ) {
    approvalReasons.push(CANONICAL_LIFECYCLE_REASON.localityApprovalAbsent);
  }

  const publishingReasons: CanonicalLifecycleReasonCode[] = [];
  const indexPages = lifecycle.publishing.pages;
  if (lifecycle.publishing.publishIndexPresent) {
    if (indexPages.some((page) => !page.campaignId)) {
      publishingReasons.push(CANONICAL_LIFECYCLE_REASON.publishIndexMissingCampaignId);
    }
    if (indexPages.some((page) => !page.contentHash)) {
      publishingReasons.push(CANONICAL_LIFECYCLE_REASON.publishIndexMissingContentHash);
    }
    if (indexPages.some((page) => !page.serviceId)) {
      publishingReasons.push(CANONICAL_LIFECYCLE_REASON.publishIndexMissingServiceId);
    }
    const status = lifecycle.publishing.publishingStatus;
    const publishedCount = lifecycle.publishing.publishedPages;
    const indexCount = indexPages.length;
    if ((status === "pending" || status === "unknown" || publishedCount === 0) && indexCount > 0) {
      publishingReasons.push(CANONICAL_LIFECYCLE_REASON.campaignPublishStatusMismatch);
    }
    if (status === "published" && indexCount === 0) {
      publishingReasons.push(CANONICAL_LIFECYCLE_REASON.campaignPublishStatusMismatch);
    }
  }
  if (lifecycle.publishing.sitemapPresent) {
    publishingReasons.push(CANONICAL_LIFECYCLE_REASON.sitemapNotCampaignScoped);
  }

  return {
    identity: check(identityReasons, new Set([
      CANONICAL_LIFECYCLE_REASON.campaignNotFound,
      CANONICAL_LIFECYCLE_REASON.identityUnresolved,
    ]), new Set()),
    membership: check(membershipReasons, new Set([
      CANONICAL_LIFECYCLE_REASON.packageAreaSetDiffers,
      CANONICAL_LIFECYCLE_REASON.renderedAreaSetDiffers,
      CANONICAL_LIFECYCLE_REASON.candidateAreaSetDiffers,
      CANONICAL_LIFECYCLE_REASON.unattachedRenderedOutput,
      CANONICAL_LIFECYCLE_REASON.missingRenderedOutput,
      CANONICAL_LIFECYCLE_REASON.membershipAreaSlugMissing,
      CANONICAL_LIFECYCLE_REASON.packageAreaSetUnresolved,
    ]), new Set([
      CANONICAL_LIFECYCLE_REASON.renderedOutputUnscoped,
      CANONICAL_LIFECYCLE_REASON.candidateRevisionUnresolved,
    ])),
    content: check(contentReasons, new Set([
      CANONICAL_LIFECYCLE_REASON.packageMissing,
      CANONICAL_LIFECYCLE_REASON.packageCampaignIdMismatch,
      CANONICAL_LIFECYCLE_REASON.servicePageOutputMissing,
    ]), new Set([
      CANONICAL_LIFECYCLE_REASON.packageCampaignIdMissing,
      CANONICAL_LIFECYCLE_REASON.contentRevisionUnresolved,
    ])),
    approval: check(approvalReasons, new Set([
      CANONICAL_LIFECYCLE_REASON.multipleApprovalAuthorities,
      CANONICAL_LIFECYCLE_REASON.approvalStoreCampaignMismatch,
      CANONICAL_LIFECYCLE_REASON.servicePageApprovalUnscoped,
      CANONICAL_LIFECYCLE_REASON.servicePageDecisionServiceMismatch,
    ]), new Set([
      CANONICAL_LIFECYCLE_REASON.approvalRevisionUnresolved,
      CANONICAL_LIFECYCLE_REASON.localityApprovalAbsent,
    ])),
    publishing: check(publishingReasons, new Set([
      CANONICAL_LIFECYCLE_REASON.publishIndexMissingCampaignId,
      CANONICAL_LIFECYCLE_REASON.publishIndexMissingContentHash,
      CANONICAL_LIFECYCLE_REASON.publishIndexMissingServiceId,
      CANONICAL_LIFECYCLE_REASON.campaignPublishStatusMismatch,
    ]), new Set([
      CANONICAL_LIFECYCLE_REASON.sitemapNotCampaignScoped,
    ])),
    indexing: rollupSources(lifecycle.indexing.sources),
    results: rollupSources(lifecycle.results.sources),
  };
}

function chooseLocalityAuthority(
  reviewSlugs: string[],
  localityStamp: CanonicalApprovalStamp | null,
): { authority: CanonicalApprovalAuthorityName; competing: CanonicalApprovalAuthorityName[]; ambiguous: boolean } {
  const reviewHas = reviewSlugs.length > 0;
  const adminHas = Boolean(localityStamp && localityStamp.areaSlugs.length > 0 && localityStamp.scope === "CANONICAL");
  if (reviewHas && adminHas) {
    return {
      authority: "AMBIGUOUS",
      competing: ["REVIEW_CENTRE_APPROVED_ASSETS", "MASTER_ADMIN_LOCALITY_DECISIONS"],
      ambiguous: true,
    };
  }
  if (reviewHas) {
    return { authority: "NONE", competing: ["REVIEW_CENTRE_APPROVED_ASSETS"], ambiguous: true };
  }
  if (adminHas) return { authority: "MASTER_ADMIN_LOCALITY_DECISIONS", competing: [], ambiguous: false };
  return { authority: "NONE", competing: [], ambiguous: false };
}

function serviceAuthorities(
  servicePage: CanonicalApprovalStamp | null,
  unscoped: CanonicalApprovalStamp | null,
  reviewServiceApproved: boolean,
): { authority: CanonicalApprovalAuthorityName; competing: CanonicalApprovalAuthorityName[]; ambiguous: boolean } {
  const campaignApproved = servicePage?.status === "approved" && servicePage.scope === "CANONICAL";
  const names: CanonicalApprovalAuthorityName[] = [];
  if (campaignApproved) names.push("CAMPAIGN_SERVICE_PAGE_DECISION");
  if (reviewServiceApproved) names.push("REVIEW_CENTRE_APPROVED_ASSETS");
  if (unscoped?.status === "approved") names.push("CAMPAIGN_SERVICE_PAGE_DECISION");
  const distinct = uniqueAuthorities(names);
  if ((campaignApproved && reviewServiceApproved) || unscoped?.status === "approved") {
    return { authority: "AMBIGUOUS", competing: distinct, ambiguous: true };
  }
  if (campaignApproved) return { authority: "CAMPAIGN_SERVICE_PAGE_DECISION", competing: [], ambiguous: false };
  if (reviewServiceApproved) return { authority: "REVIEW_CENTRE_APPROVED_ASSETS", competing: [], ambiguous: false };
  return { authority: "NONE", competing: [], ambiguous: false };
}

interface MeasurementSpec {
  id: string;
  relativePath: string | null;
  missing: CanonicalLifecycleReasonCode;
  unscoped: CanonicalLifecycleReasonCode;
  stale: CanonicalLifecycleReasonCode;
}

function resolveMeasurementGroup(
  tenantSlug: string | null,
  specs: MeasurementSpec[],
  contentGeneratedAt: string | null,
  inspected: string[],
): CanonicalResultsSource[] {
  if (!tenantSlug) {
    return specs.map((spec) => ({
      id: spec.id,
      path: "",
      present: false,
      resultsJoinStatus: "missing",
      measuredAt: null,
      reasons: [spec.missing],
    }));
  }
  return specs.map((spec) => {
    const file = spec.relativePath ? workspacePath(...spec.relativePath.split("/")) : "";
    const doc = file ? readJson(file, inspected) : null;
    if (!doc) {
      return {
        id: spec.id,
        path: file,
        present: false,
        resultsJoinStatus: "missing" as CanonicalResultsJoinStatus,
        measuredAt: null,
        reasons: [spec.missing],
      };
    }
    const measuredAt = firstTimestamp(doc);
    const joined = hasCampaignPageRevisionJoin(doc);
    const reasons: CanonicalLifecycleReasonCode[] = [];
    let resultsJoinStatus: CanonicalResultsJoinStatus = "joined";
    if (!joined) {
      resultsJoinStatus = "unscoped";
      reasons.push(spec.unscoped);
      if (spec.unscoped !== CANONICAL_LIFECYCLE_REASON.resultsNotCampaignScoped && spec.id !== "search-console-authority") {
        reasons.push(CANONICAL_LIFECYCLE_REASON.resultsNotCampaignScoped);
      }
      reasons.push(CANONICAL_LIFECYCLE_REASON.resultsRevisionUnresolved);
    }
    if (measuredAt && contentGeneratedAt && measuredAt < contentGeneratedAt) {
      resultsJoinStatus = "stale";
      reasons.push(spec.stale);
    }
    return {
      id: spec.id,
      path: file,
      present: true,
      resultsJoinStatus,
      measuredAt,
      reasons: uniqueCodes(reasons),
    };
  });
}

function readPackage(
  tenantSlug: string,
  serviceId: string,
  inspected: string[],
): {
  present: boolean;
  path: string;
  campaignId: string | null;
  generatedAt: string | null;
  areaSlugs: string[] | null;
  areaScope: CanonicalLifecycleEvidenceScope;
} {
  const file = workspacePath("data/pharmacy-content-packages", tenantSlug, `${serviceId}.json`);
  const doc = readJson(file, inspected);
  if (!doc) {
    return { present: false, path: file, campaignId: null, generatedAt: null, areaSlugs: null, areaScope: "UNRESOLVED" };
  }
  const selected = doc.selectedAreas;
  let areaSlugs: string[] | null = null;
  let areaScope: CanonicalLifecycleEvidenceScope = "UNRESOLVED";
  if (Array.isArray(selected)) {
    areaScope = "UNSCOPED";
    areaSlugs = uniqueSorted(selected.map((entry) => areaSlugFromPackageEntry(entry)).filter((slug): slug is string => Boolean(slug)));
  }
  return {
    present: true,
    path: file,
    campaignId: nonEmptyString(doc.campaignId),
    generatedAt: nonEmptyString(doc.generatedAt),
    areaSlugs,
    areaScope,
  };
}

function listRenderedLocalities(tenantSlug: string, serviceId: string, inspected: string[]): string[] {
  const dir = workspacePath("output/pharmacy-content-ecosystem", tenantSlug, serviceId, "local");
  inspected.push(dir);
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir, { withFileTypes: true });
  const slugs = names
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(dir, entry.name, "index.html")))
    .map((entry) => entry.name);
  return uniqueSorted(slugs);
}

function listCandidateSets(tenantSlug: string, serviceId: string, inspected: string[]): CanonicalCandidateEvidenceSet[] {
  const sets: CanonicalCandidateEvidenceSet[] = [];
  const recordsDir = workspacePath("data/pharmacy-ai-local-copy-candidates", tenantSlug, serviceId);
  const recordSlugs = listJsonAreaSlugs(recordsDir, inspected);
  if (recordSlugs) {
    sets.push({ sourcePath: recordsDir, scope: "UNRESOLVED", areaSlugs: recordSlugs });
  }
  const pilotRoot = workspacePath("data/pharmacy-ai-local-copy-pilots", tenantSlug, serviceId);
  inspected.push(pilotRoot);
  if (fs.existsSync(pilotRoot)) {
    const versions = fs
      .readdirSync(pilotRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    for (const version of versions) {
      const dir = path.join(pilotRoot, version);
      const slugs = listJsonAreaSlugs(dir, inspected);
      if (slugs) sets.push({ sourcePath: dir, scope: "UNRESOLVED", areaSlugs: slugs });
    }
  }
  return sets;
}

function listHistoricalEvidence(
  tenantSlug: string,
  serviceId: string,
  inspected: string[],
): CanonicalCampaignLifecycle["approval"]["historical"] {
  const roots = [
    workspacePath("data/pharmacy-ai-local-copy-checkpoints", tenantSlug, serviceId),
    workspacePath("data/pharmacy-ai-local-copy-decisions", tenantSlug, serviceId),
  ];
  const found: CanonicalCampaignLifecycle["approval"]["historical"] = [];
  for (const root of roots) {
    inspected.push(root);
    if (!fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        found.push({ path: full, scope: "HISTORICAL", explicitNonApproval: null });
        continue;
      }
      if (!entry.name.endsWith(".json")) continue;
      const doc = readJson(full, inspected);
      const explicitNonApproval =
        doc && (doc.campaignApproval === false || doc.publication === false || doc.clinicalApproval === false)
          ? true
          : doc && (doc.campaignApproval === true || doc.publication === true)
            ? false
            : null;
      found.push({ path: full, scope: "HISTORICAL", explicitNonApproval });
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function listLegacyRunFiles(runDir: string, inspected: string[]): string[] {
  inspected.push(runDir);
  if (!fs.existsSync(runDir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(runDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^v\d+$/.test(entry.name)) continue;
    const versionDir = path.join(runDir, entry.name);
    for (const name of fs.readdirSync(versionDir)) {
      if (name.endsWith(".json")) found.push(path.join(versionDir, name));
    }
  }
  return found.sort();
}

function observePage(
  pageType: CanonicalCampaignPageRevision["pageType"],
  serviceId: string | null,
  areaSlug: string | null,
  file: string | null,
  generatedAt: string | null,
  inspected: string[],
): CanonicalCampaignPageRevision {
  const exists = file ? fileExists(file, inspected) : false;
  return {
    pageType,
    serviceId,
    areaSlug,
    sourcePath: file,
    observedContentHash: exists && file ? hashFile(file) : null,
    revisionId: null,
    revisionStatus: "unresolved",
    generatedAt,
    scope: exists ? "UNSCOPED" : "UNRESOLVED",
  };
}

function hasCampaignPageRevisionJoin(doc: Record<string, unknown>): boolean {
  const blob = JSON.stringify(doc);
  return blob.includes("\"campaignId\"") && blob.includes("\"contentHash\"") && blob.includes("\"canonicalUrl\"");
}

function firstTimestamp(doc: Record<string, unknown>): string | null {
  for (const key of ["lastCheckedAt", "lastUpdated", "updatedAt", "generatedAt", "measuredAt"]) {
    const value = nonEmptyString(doc[key]);
    if (value) return value;
  }
  return null;
}

function newestTimestamp(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) || null;
}

function areaSlugFromPackageEntry(entry: unknown): string | null {
  if (typeof entry === "string") return slugifyArea(entry) || null;
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  return nonEmptyString(record.areaSlug) || (nonEmptyString(record.areaName) ? slugifyArea(String(record.areaName)) : null);
}

function areaSlugFromAssetKey(key: string): string | null {
  const split = key.lastIndexOf(":");
  if (split <= 0 || split === key.length - 1) return null;
  return key.slice(split + 1);
}

function approvalValuePresent(value: unknown): boolean {
  if (value === true) return true;
  return typeof value === "string" && value.trim().length > 0;
}

function listJsonAreaSlugs(dir: string, inspected: string[]): string[] | null {
  inspected.push(dir);
  if (!fs.existsSync(dir)) return null;
  const slugs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/, ""));
  return uniqueSorted(slugs);
}

function rollupSources(sources: CanonicalResultsSource[]): CanonicalLifecycleHealthCheck {
  const reasons = uniqueCodes(sources.flatMap((source) => source.reasons));
  const fail = new Set<CanonicalLifecycleReasonCode>([
    CANONICAL_LIFECYCLE_REASON.indexingStoreUnscoped,
    CANONICAL_LIFECYCLE_REASON.indexingStoreStale,
    CANONICAL_LIFECYCLE_REASON.indexDashboardUnscoped,
    CANONICAL_LIFECYCLE_REASON.indexDashboardStale,
    CANONICAL_LIFECYCLE_REASON.resultsNotCampaignScoped,
    CANONICAL_LIFECYCLE_REASON.resultsRevisionUnresolved,
    CANONICAL_LIFECYCLE_REASON.gscSummaryUnscoped,
    CANONICAL_LIFECYCLE_REASON.gscSummaryStale,
    CANONICAL_LIFECYCLE_REASON.rankTrackingUnscoped,
    CANONICAL_LIFECYCLE_REASON.rankTrackingStale,
    CANONICAL_LIFECYCLE_REASON.visibilityUnscoped,
    CANONICAL_LIFECYCLE_REASON.visibilityStale,
  ]);
  const warn = new Set<CanonicalLifecycleReasonCode>([
    CANONICAL_LIFECYCLE_REASON.indexingStoreMissing,
    CANONICAL_LIFECYCLE_REASON.searchConsoleAuthorityMissing,
    CANONICAL_LIFECYCLE_REASON.indexDashboardMissing,
    CANONICAL_LIFECYCLE_REASON.gscSummaryMissing,
    CANONICAL_LIFECYCLE_REASON.rankTrackingMissing,
    CANONICAL_LIFECYCLE_REASON.visibilityMissing,
  ]);
  return check(reasons, fail, warn);
}

function check(
  reasons: CanonicalLifecycleReasonCode[],
  fail: Set<CanonicalLifecycleReasonCode>,
  warn: Set<CanonicalLifecycleReasonCode>,
): CanonicalLifecycleHealthCheck {
  const unique = uniqueCodes(reasons);
  if (unique.some((code) => fail.has(code))) return { status: "FAIL", reasons: unique };
  if (unique.some((code) => warn.has(code))) return { status: "WARN", reasons: unique };
  return { status: "PASS", reasons: [] };
}

function emptyHealth(): CanonicalCampaignLifecycleHealth {
  const pass: CanonicalLifecycleHealthCheck = { status: "PASS", reasons: [] };
  return {
    identity: pass,
    membership: pass,
    content: pass,
    approval: pass,
    publishing: pass,
    indexing: pass,
    results: pass,
  };
}

function readJson(file: string, inspected: string[]): Record<string, unknown> | null {
  inspected.push(file);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function fileExists(file: string, inspected: string[]): boolean {
  inspected.push(file);
  return fs.existsSync(file);
}

function hashFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function workspacePath(...parts: string[]): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, ...parts);
}

function strictSlug(value: string): string | null {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

function nonEmptyString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function uniqueCodes(values: CanonicalLifecycleReasonCode[]): CanonicalLifecycleReasonCode[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function uniqueAuthorities(values: CanonicalApprovalAuthorityName[]): CanonicalApprovalAuthorityName[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
