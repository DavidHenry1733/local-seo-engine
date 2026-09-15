#!/usr/bin/env npx tsx
/**
 * Indexing registry authority — current publication + Technical SEO eligibility.
 * Internally registers Vision Pharmacy First eligible URLs only.
 * Does not submit to Google, Search Console, or any external indexing API.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ManagedPublishingProfile } from "../src/pharmacy/masterAdminManagedPublishingModel.ts";
import { BENCHMARK_MASTER_SERVICE_IDS } from "../src/pharmacy/pharmacyMasterPublishConfig.ts";
import {
  canonicalUrlForIndexing,
  resolveAuthoritativePublicationCanonical,
} from "../src/pharmacy/pharmacyPublicationCanonicalAuthority.ts";
import { auditPublishedTechnicalSeo, loadTechnicalSeoAudit } from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import { buildGrowthJourneyDashboard } from "../src/pharmacy/pharmacyGrowthJourneyService.ts";
import {
  evaluateIndexingRegistrationCandidate,
  indexingBridgeTelemetry,
  readIndexingWorkflowState,
  readPharmacyRegistry,
  registerPharmacyPages,
  requestExternalIndexingSubmission,
  resetIndexingBridgeTelemetry,
  selectIndexingRegisterablePages,
  type IndexingCandidateInspection,
} from "../src/pharmacy/pharmacyIndexingBridgeService.ts";
import { readActiveServiceCampaignSelection } from "../src/pharmacy/masterAdminActiveServiceCampaignStore.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VISION_SLUG = "vision-pharmacy";
const VISION_SERVICE = "pharmacy-first";
const VISION_HOST = "vision-pharmacy.sites.pharmaconnect.uk";
const VISION_MANAGED = `https://${VISION_HOST}/`;
const CUSTOMER_SITE = "https://www.visionpharmacy.com/";
const LIVE_ROOT = `/var/www/pharmaconnect-sites/${VISION_SLUG}/current`;

const EXPECTED_URLS = [
  `https://${VISION_HOST}/pharmacy-first/`,
  `https://${VISION_HOST}/local-oadby/`,
  `https://${VISION_HOST}/local-wigston/`,
  `https://${VISION_HOST}/local-leicester/`,
  `https://${VISION_HOST}/local-hamilton/`,
  `https://${VISION_HOST}/local-braunstone/`,
  `https://${VISION_HOST}/local-blaby/`,
  `https://${VISION_HOST}/local-thurmaston/`,
  `https://${VISION_HOST}/local-birstall/`,
];

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function shaFile(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listLiveHtmlFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.html?$/i.test(entry.name)) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

function fixtureProfile(slug: string, overrides: Partial<ManagedPublishingProfile> = {}): ManagedPublishingProfile {
  const managedHostname = `${slug}.sites.pharmaconnect.uk`;
  const managedUrl = `https://${managedHostname}/`;
  return {
    version: 1,
    slug,
    tenantPublishDirectory: `/tmp/${slug}`,
    managedHostname,
    managedUrl,
    customerSubdomain: null,
    customerRootDomain: "customer-pharmacy.example",
    customerRootDomainConfirmed: false,
    customerRootDomainEvidenceSource: null,
    customerRootDomainEvidenceUrl: "https://www.customer-pharmacy.example",
    subdomainLabel: "local",
    canonicalEcosystemHostname: null,
    canonicalEcosystemBaseUrl: null,
    internalFallbackUrl: managedUrl,
    canonicalUrlStatus: "pending_domain_confirmation",
    liveVerificationStatus: null,
    requiredCnameHost: "local",
    requiredCnameTarget: managedHostname,
    requiredCnameTtl: "Automatic/default",
    dnsStatus: "not_configured",
    dnsLastCheckedAt: null,
    dnsVerificationEvidence: null,
    sslStatus: "managed_preview_active",
    sslExpiry: null,
    sslRenewalStatus: null,
    sslLastCheckedAt: null,
    sslIssuer: null,
    sslIssuedAt: null,
    publishedVersion: 1,
    publishStatus: "live",
    liveUrl: managedUrl,
    currentRelease: "v1",
    previousRelease: null,
    paths: {
      tenantPublishDirectory: `/tmp/${slug}`,
      releaseDirectory: `/tmp/${slug}/releases`,
      currentReleasePointer: `/tmp/${slug}/current`,
      previousReleasePointer: `/tmp/${slug}/previous`,
      manifestPath: `/tmp/${slug}/current/manifest.json`,
      registryPath: `/tmp/${slug}/current/registry.json`,
      sitemapPath: `/tmp/${slug}/current/sitemap.xml`,
      assetPath: `/tmp/${slug}/current/assets`,
      imagePath: `/tmp/${slug}/current/images`,
      logPath: `/tmp/${slug}/logs`,
    },
    storage: {
      currentReleaseSizeBytes: 0,
      totalRetainedReleaseSizeBytes: 0,
      assetSizeBytes: 0,
      imageSizeBytes: 0,
      releaseCount: 1,
      lastCleanupAt: null,
      retentionPolicy: 3,
    },
    publishingReadiness: "READY TO PUBLISH",
    legacyExternalProfileRef: null,
    migratedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function eligiblePage(overrides: Partial<IndexingCandidateInspection> = {}): IndexingCandidateInspection {
  return {
    slug: VISION_SLUG,
    tenantSlug: VISION_SLUG,
    serviceId: VISION_SERVICE,
    pageType: "service",
    publicPath: "/pharmacy-first/",
    pageUrl: `https://${VISION_HOST}/pharmacy-first/`,
    canonical: `https://${VISION_HOST}/pharmacy-first/`,
    authoritativeCanonical: `https://${VISION_HOST}/pharmacy-first/`,
    intendedIndexable: true,
    eligible: true,
    robots: "index, follow",
    blockers: [],
    published: true,
    ...overrides,
  };
}

function mtime(file: string): number | null {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;
}

async function main() {
  const liveHtml = listLiveHtmlFiles(LIVE_ROOT);
  const liveHashes = new Map(liveHtml.map((file) => [file, shaFile(file)]));
  const liveSitemap = path.join(LIVE_ROOT, "sitemap.xml");
  const outputSitemap = path.join(ROOT, "output/pharmacy-publish", VISION_SLUG, "sitemap.xml");
  const liveSitemapMtime = mtime(liveSitemap);
  const outputSitemapMtime = mtime(outputSitemap);
  const robotsFile = path.join(LIVE_ROOT, "robots.txt");
  const robotsHash = fs.existsSync(robotsFile) ? shaFile(robotsFile) : "";

  const selection = readActiveServiceCampaignSelection(VISION_SLUG);
  record(
    "authoritative-campaign-service",
    selection?.serviceId === VISION_SERVICE && Boolean(selection?.campaignId),
    `service=${selection?.serviceId} campaign=${selection?.campaignId || "none"}`,
  );

  const priorAudit = loadTechnicalSeoAudit(VISION_SLUG, VISION_SERVICE);
  record(
    "current-authoritative-managed-publication-supplies-candidates",
    Boolean(priorAudit && priorAudit.publicationBase.includes(VISION_HOST) && priorAudit.eligibleCount === 9),
    `base=${priorAudit?.publicationBase || "none"} eligible=${priorAudit?.eligibleCount ?? 0}`,
  );

  const preview = priorAudit
    ? selectIndexingRegisterablePages(priorAudit, { slug: VISION_SLUG, serviceId: VISION_SERVICE })
    : [];
  record(
    "vision-registerable-count-is-9",
    preview.length === 9,
    `registerable=${preview.length}`,
  );

  const ctx = { slug: VISION_SLUG, serviceId: VISION_SERVICE, profileWebsite: CUSTOMER_SITE };

  const serviceDecision = evaluateIndexingRegistrationCandidate(eligiblePage(), ctx);
  record(
    "eligible-service-page-can-register",
    serviceDecision.accepted && serviceDecision.canonicalUrl === `https://${VISION_HOST}/pharmacy-first/`,
    serviceDecision.canonicalUrl || serviceDecision.reason || "none",
  );

  const localityDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      pageType: "locality",
      publicPath: "/local-oadby/",
      pageUrl: `https://${VISION_HOST}/local-oadby/`,
      canonical: `https://${VISION_HOST}/local-oadby/`,
      authoritativeCanonical: `https://${VISION_HOST}/local-oadby/`,
    }),
    ctx,
  );
  record(
    "eligible-locality-page-can-register",
    localityDecision.accepted && localityDecision.canonicalUrl === `https://${VISION_HOST}/local-oadby/`,
    localityDecision.canonicalUrl || localityDecision.reason || "none",
  );

  const homepageDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      pageType: "homepage",
      publicPath: "/",
      pageUrl: VISION_MANAGED,
      canonical: `https://${VISION_HOST}/pharmacy-first/`,
      intendedIndexable: false,
      eligible: false,
    }),
    ctx,
  );
  record(
    "homepage-redirect-cannot-register",
    homepageDecision.accepted === false && homepageDecision.reason === "homepage_redirect",
    homepageDecision.reason || "accepted",
  );

  const noindexDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      eligible: false,
      robots: "noindex, follow",
    }),
    ctx,
  );
  record(
    "noindex-page-cannot-register",
    noindexDecision.accepted === false && noindexDecision.reason === "noindex",
    noindexDecision.reason || "accepted",
  );

  const blockerDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      eligible: false,
      blockers: [{ code: "canonical_mismatch", message: "Technical SEO blocker" }],
    }),
    ctx,
  );
  record(
    "technical-seo-blocker-prevents-registration",
    blockerDecision.accepted === false && blockerDecision.reason === "technical_seo_blocker",
    blockerDecision.reason || "accepted",
  );

  const unpublishedDecision = evaluateIndexingRegistrationCandidate(eligiblePage({ published: false }), ctx);
  record(
    "unpublished-page-cannot-register",
    unpublishedDecision.accepted === false && unpublishedDecision.reason === "unpublished",
    unpublishedDecision.reason || "accepted",
  );

  const staleDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      serviceId: "blood-pressure-checks",
      publicPath: "/blood-pressure-checks/",
      pageUrl: `https://${VISION_HOST}/blood-pressure-checks/`,
      canonical: `https://${VISION_HOST}/blood-pressure-checks/`,
    }),
    ctx,
  );
  record(
    "stale-service-cannot-register-for-current-campaign",
    staleDecision.accepted === false && staleDecision.reason === "stale_service",
    staleDecision.reason || "accepted",
  );

  const catalogueExtras = BENCHMARK_MASTER_SERVICE_IDS.filter((id) => id !== VISION_SERVICE);
  const catalogueDecisions = catalogueExtras.map((id) =>
    evaluateIndexingRegistrationCandidate(
      eligiblePage({
        serviceId: id,
        publicPath: `/${id}/`,
        pageUrl: `https://${VISION_HOST}/${id}/`,
        canonical: `https://${VISION_HOST}/${id}/`,
      }),
      ctx,
    ),
  );
  record(
    "catalogue-membership-alone-cannot-create-candidates",
    catalogueDecisions.every((item) => item.accepted === false) && preview.every((item) => !catalogueExtras.some((id) => item.canonicalUrl.includes(`/${id}/`))),
    `rejected=${catalogueDecisions.filter((item) => !item.accepted).length}/${catalogueExtras.length}`,
  );

  const profileOverrideDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      pageUrl: `${CUSTOMER_SITE}pharmacy-first/`,
      canonical: `${CUSTOMER_SITE}pharmacy-first/`,
      authoritativeCanonical: `${CUSTOMER_SITE}pharmacy-first/`,
    }),
    ctx,
  );
  record(
    "profile-website-cannot-override-managed-publication",
    profileOverrideDecision.accepted === true &&
      profileOverrideDecision.canonicalUrl === `https://${VISION_HOST}/pharmacy-first/` &&
      !profileOverrideDecision.canonicalUrl.includes("www.visionpharmacy.com"),
    profileOverrideDecision.canonicalUrl || profileOverrideDecision.reason || "none",
  );

  const verifiedHost = "local.customer-pharmacy.example";
  const verifiedSlug = "fixture-alpha";
  const verifiedService = "travel-vaccinations";
  const verifiedProfile = fixtureProfile(verifiedSlug, {
    customerRootDomainConfirmed: true,
    customerRootDomain: "customer-pharmacy.example",
    canonicalEcosystemHostname: verifiedHost,
    canonicalEcosystemBaseUrl: `https://${verifiedHost}/`,
    canonicalUrlStatus: "active",
    dnsStatus: "verified",
    sslStatus: "active",
  });
  const verifiedCanonical = resolveAuthoritativePublicationCanonical({
    slug: verifiedSlug,
    serviceId: verifiedService,
    publicPath: `/${verifiedService}/`,
    profileWebsite: "https://www.customer-pharmacy.example/",
    managedProfile: verifiedProfile,
  });
  const verifiedIndexed = canonicalUrlForIndexing({
    slug: verifiedSlug,
    serviceId: verifiedService,
    publicPath: `/${verifiedService}/`,
    profileWebsite: "https://www.customer-pharmacy.example/",
    managedProfile: verifiedProfile,
  });
  const verifiedDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      slug: verifiedSlug,
      tenantSlug: verifiedSlug,
      serviceId: verifiedService,
      publicPath: `/${verifiedService}/`,
      pageUrl: `https://${verifiedHost}/${verifiedService}/`,
      canonical: `https://${verifiedHost}/${verifiedService}/`,
      authoritativeCanonical: `https://${verifiedHost}/${verifiedService}/`,
    }),
    {
      slug: verifiedSlug,
      serviceId: verifiedService,
      profileWebsite: "https://www.customer-pharmacy.example/",
      managedProfile: verifiedProfile,
    },
  );
  record(
    "verified-customer-production-uses-verified-canonical",
    verifiedCanonical.source === "verified_customer_domain_publication" &&
      verifiedIndexed === `https://${verifiedHost}/${verifiedService}/` &&
      verifiedDecision.accepted &&
      verifiedDecision.canonicalUrl === `https://${verifiedHost}/${verifiedService}/`,
    `${verifiedCanonical.source} ${verifiedDecision.canonicalUrl}`,
  );

  const crossTenantDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({ slug: "other-pharmacy", tenantSlug: "other-pharmacy" }),
    ctx,
  );
  record(
    "cross-tenant-isolation",
    crossTenantDecision.accepted === false && crossTenantDecision.reason === "cross_tenant",
    crossTenantDecision.reason || "accepted",
  );

  const crossServiceDecision = evaluateIndexingRegistrationCandidate(
    eligiblePage({
      serviceId: "travel-vaccinations",
      publicPath: "/travel-vaccinations/",
      pageUrl: `https://${VISION_HOST}/travel-vaccinations/`,
    }),
    ctx,
  );
  record(
    "cross-service-isolation",
    crossServiceDecision.accepted === false && !preview.some((item) => item.canonicalUrl.includes("/travel-vaccinations/")),
    crossServiceDecision.reason || "accepted",
  );

  resetIndexingBridgeTelemetry();
  const originalFetch = globalThis.fetch;
  const fetchedUrls: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    fetchedUrls.push(String(url));
    if (/googleapis\.com|searchconsole|indexing\.googleapis|webmasters/i.test(String(url))) {
      throw new Error(`blocked external indexing request: ${url}`);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  let first: Awaited<ReturnType<typeof registerPharmacyPages>> | null = null;
  let second: Awaited<ReturnType<typeof registerPharmacyPages>> | null = null;
  try {
    first = await registerPharmacyPages(VISION_SLUG, { serviceId: VISION_SERVICE, fetchLive: true });
    second = await registerPharmacyPages(VISION_SLUG, { serviceId: VISION_SERVICE, fetchLive: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const registeredUrls = (first?.pages || []).map((page) => page.canonicalUrl).sort();
  const expectedSorted = [...EXPECTED_URLS].sort();
  record(
    "internal-registration-does-not-trigger-external-submission",
    first?.externalIndexingRequested === false &&
      indexingBridgeTelemetry.externalIndexingRequests === 0 &&
      indexingBridgeTelemetry.submitCalls === 0 &&
      !fetchedUrls.some((url) => /googleapis\.com|searchconsole|indexing\.googleapis|webmasters/i.test(url)),
    `registerCalls=${indexingBridgeTelemetry.registerCalls} submitCalls=${indexingBridgeTelemetry.submitCalls} external=${indexingBridgeTelemetry.externalIndexingRequests} fetched=${fetchedUrls.length}`,
  );

  let externalHookThrew = false;
  try {
    requestExternalIndexingSubmission("https://vision-pharmacy.sites.pharmaconnect.uk/pharmacy-first/");
  } catch {
    externalHookThrew = true;
  }
  record(
    "external-submission-remains-separate-explicit-action",
    externalHookThrew === true && indexingBridgeTelemetry.submitCalls === 0 && first?.externalIndexingRequested === false,
    `hookThrew=${externalHookThrew} submitCalls=${indexingBridgeTelemetry.submitCalls}`,
  );

  record(
    "duplicate-registration-is-idempotent",
    Boolean(first && second) &&
      first!.registered === 9 &&
      second!.registered === 9 &&
      second!.pages.every((page) => page.indexingStatus === "ready_to_submit" && page.submittedAt === null) &&
      JSON.stringify(second!.pages.map((page) => page.canonicalUrl).sort()) === JSON.stringify(registeredUrls),
    `first=${first?.registered ?? 0} second=${second?.registered ?? 0}`,
  );

  record(
    "current-vision-registerable-count-exactly-9",
    first?.registered === 9 && first.workflow.registerableCount === 9 && first.workflow.registeredCount === 9,
    `registered=${first?.registered ?? 0} registerable=${first?.workflow.registerableCount ?? 0}`,
  );

  record(
    "all-9-vision-registry-urls-use-managed-host",
    registeredUrls.length === 9 && registeredUrls.every((url) => url.startsWith(`https://${VISION_HOST}/`)),
    registeredUrls.join(" | "),
  );

  const registry = readPharmacyRegistry(VISION_SLUG);
  const visionUrls = (registry?.pages || [])
    .filter((page) => page.serviceId === VISION_SERVICE)
    .map((page) => `${page.canonicalUrl} ${page.url}`);
  record(
    "zero-vision-registry-urls-use-customer-or-placeholder-hosts",
    visionUrls.length === 9 &&
      !visionUrls.some((url) => /www\.visionpharmacy\.com|example\.local|localhost|127\.0\.0\.1/i.test(url)),
    `pages=${visionUrls.length}`,
  );

  record(
    "homepage-redirect-excluded-from-registry",
    !registeredUrls.includes(VISION_MANAGED) &&
      !(first?.pages || []).some((page) => page.pageType === "homepage" || page.publishPath === "/"),
    `urls=${registeredUrls.length}`,
  );

  record(
    "stale-services-excluded-from-current-registry",
    !(registry?.pages || []).some((page) => page.serviceId !== VISION_SERVICE && page.serviceId !== ""),
    `services=${[...new Set((registry?.pages || []).map((page) => page.serviceId))].join(",")}`,
  );

  const postAudit = await auditPublishedTechnicalSeo({ slug: VISION_SLUG, serviceId: VISION_SERVICE, fetchLive: true });
  record(
    "technical-seo-remains-9-eligible-0-blocked",
    postAudit.eligibleCount === 9 && postAudit.blockedCount === 0 && postAudit.totalPublishedUrls === 10,
    `published=${postAudit.totalPublishedUrls} eligible=${postAudit.eligibleCount} blocked=${postAudit.blockedCount}`,
  );

  const liveHtmlAfter = listLiveHtmlFiles(LIVE_ROOT);
  const htmlUnchanged =
    liveHtmlAfter.length === liveHtml.length && liveHtmlAfter.every((file) => liveHashes.get(file) === shaFile(file));
  record("live-html-unchanged", htmlUnchanged, `files=${liveHtmlAfter.length}`);
  record("published-file-count-still-10", liveHtmlAfter.length === 10 || postAudit.totalPublishedUrls === 10, `html=${liveHtmlAfter.length}`);
  record(
    "robots-unchanged",
    !robotsFile || shaFile(robotsFile) === robotsHash,
    robotsFile,
  );
  record(
    "sitemaps-not-rewritten-by-register",
    mtime(liveSitemap) === liveSitemapMtime && mtime(outputSitemap) === outputSitemapMtime,
    `live=${String(mtime(liveSitemap))} output=${String(mtime(outputSitemap))}`,
  );
  record(
    "expected-urls-match-exactly",
    JSON.stringify(registeredUrls) === JSON.stringify(expectedSorted),
    registeredUrls.join("\n"),
  );

  const journey = buildGrowthJourneyDashboard(VISION_SLUG);
  const workflow = readIndexingWorkflowState(VISION_SLUG, VISION_SERVICE);
  record(
    "growth-journey-indexing-state",
    journey.indexing.publishedPages === 10 &&
      journey.indexing.indexEligiblePages === 9 &&
      journey.indexing.registeredPages === 9 &&
      journey.indexing.submittedUrls === 0 &&
      journey.indexing.indexedUrls === 0 &&
      journey.indexing.notIndexedUrls === 0 &&
      journey.indexing.serviceId === VISION_SERVICE &&
      journey.roadmap.find((step) => step.id === "indexing")?.pct === 50,
    `published=${journey.indexing.publishedPages} eligible=${journey.indexing.indexEligiblePages} registered=${journey.indexing.registeredPages} submitted=${journey.indexing.submittedUrls} indexed=${journey.indexing.indexedUrls} notIndexed=${journey.indexing.notIndexedUrls} stepPct=${journey.roadmap.find((step) => step.id === "indexing")?.pct}`,
  );
  record(
    "indexing-ui-does-not-surface-240-as-candidates",
    journey.indexing.registerablePages === 9 &&
      journey.indexing.registeredPages === 9 &&
      !journey.indexing.registerableUrls.some((url) => url.includes("www.visionpharmacy.com")),
    `registerable=${journey.indexing.registerablePages} publishingReady=${journey.publishing.pagesReady}`,
  );
  record(
    "workflow-matches-registry",
    workflow.registeredCount === 9 &&
      workflow.submittedCount === 0 &&
      workflow.indexedCount === 0 &&
      workflow.homepageExcluded === true,
    `registered=${workflow.registeredCount} homepageExcluded=${workflow.homepageExcluded}`,
  );

  const failed = checks.filter((item) => !item.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((item) => item.pass).length}/${checks.length} indexing registry authority checks`);
  if (failed.length) {
    for (const item of failed) console.error(`  - ${item.id}: ${item.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
