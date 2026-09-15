#!/usr/bin/env npx tsx
/**
 * External indexing submission pre-flight.
 * Dry-run / mocks only. Does not submit URLs or sitemaps to Google.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTechnicalSeoAudit } from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import {
  applySuccessfulSitemapSubmitToPages,
  buildExternalIndexingPreflight,
  evaluateRegisteredUrlForSubmission,
  GSC_OAUTH_SCOPE_CURRENT,
  GSC_SITEMAPS_API_METHOD,
  GSC_SITEMAPS_HTTP,
  GSC_URL_INSPECTION_API,
  GOOGLE_INDEXING_API_URL,
  planPharmacyExternalIndexingSubmission,
  readManagedPublicationSitemap,
  readPharmacySearchConsoleConnection,
  resetExternalIndexingTelemetry,
  resolvePharmacySearchConsoleProperty,
  runPharmacyExternalIndexingSubmission,
  withAuditPageOverride,
  externalIndexingTelemetry,
} from "../src/pharmacy/pharmacyExternalIndexingSubmissionService.ts";
import {
  readIndexingWorkflowState,
  readPharmacyRegistry,
  type PharmacyRegistryPage,
} from "../src/pharmacy/pharmacyIndexingBridgeService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VISION_SLUG = "vision-pharmacy";
const VISION_SERVICE = "pharmacy-first";
const VISION_HOST = "vision-pharmacy.sites.pharmaconnect.uk";
const EXPECTED = [
  `https://${VISION_HOST}/pharmacy-first/`,
  `https://${VISION_HOST}/local-oadby/`,
  `https://${VISION_HOST}/local-wigston/`,
  `https://${VISION_HOST}/local-leicester/`,
  `https://${VISION_HOST}/local-hamilton/`,
  `https://${VISION_HOST}/local-braunstone/`,
  `https://${VISION_HOST}/local-blaby/`,
  `https://${VISION_HOST}/local-thurmaston/`,
  `https://${VISION_HOST}/local-birstall/`,
].sort();

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function snapshotRegistry(): string {
  return fs.readFileSync(path.join(ROOT, "data/pharmacy-registry/vision-pharmacy.json"), "utf8");
}

function snapshotSummary(): string {
  return fs.readFileSync(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json"), "utf8");
}

async function main() {
  const beforeRegistry = snapshotRegistry();
  const beforeSummary = snapshotSummary();
  resetExternalIndexingTelemetry();
  delete process.env.PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED;

  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    fetched.push(String(url));
    if (/googleapis\.com|searchconsole|indexing\.googleapis|webmasters/i.test(String(url))) {
      throw new Error(`blocked external Google request: ${url}`);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const audit = loadTechnicalSeoAudit(VISION_SLUG, VISION_SERVICE);
    if (!audit) throw new Error("Vision Technical SEO artefact missing");
    const registry = readPharmacyRegistry(VISION_SLUG);
    if (!registry) throw new Error("Vision registry missing");
    const sitemap = readManagedPublicationSitemap(VISION_SLUG);
    const connection = readPharmacySearchConsoleConnection();
    const property = resolvePharmacySearchConsoleProperty(VISION_SLUG, VISION_SERVICE);

    const preflight = await planPharmacyExternalIndexingSubmission({
      slug: VISION_SLUG,
      serviceId: VISION_SERVICE,
      fetchLive: false,
    });

    record(
      "submission-consumes-registered-eligible-only",
      preflight.candidateCount === 9 &&
        preflight.candidates.every((url) => registry.pages.some((page) => page.canonicalUrl === url)) &&
        !preflight.candidates.includes(`https://${VISION_HOST}/`),
      `candidates=${preflight.candidateCount}`,
    );
    record(
      "vision-submission-set-exactly-9",
      JSON.stringify(preflight.candidates) === JSON.stringify(EXPECTED),
      preflight.candidates.join(" | "),
    );
    record(
      "homepage-redirect-excluded",
      !preflight.candidates.includes(`https://${VISION_HOST}/`) &&
        !sitemap.urls.includes(`https://${VISION_HOST}/`),
      `sitemapCount=${sitemap.urls.length}`,
    );

    const stalePage: PharmacyRegistryPage = {
      ...registry.pages[0]!,
      serviceId: "blood-pressure-checks",
      url: `https://${VISION_HOST}/blood-pressure-checks/`,
      canonicalUrl: `https://${VISION_HOST}/blood-pressure-checks/`,
      publishPath: "/blood-pressure-checks/",
      slug: "blood-pressure-checks",
    };
    record(
      "stale-services-excluded",
      evaluateRegisteredUrlForSubmission(stalePage, audit, { slug: VISION_SLUG, serviceId: VISION_SERVICE }).reason ===
        "stale_service",
      "stale_service",
    );

    const otherTenant: PharmacyRegistryPage = {
      ...registry.pages[0]!,
      url: "https://other-pharmacy.sites.pharmaconnect.uk/pharmacy-first/",
      canonicalUrl: "https://other-pharmacy.sites.pharmaconnect.uk/pharmacy-first/",
    };
    record(
      "cross-tenant-excluded",
      evaluateRegisteredUrlForSubmission(otherTenant, audit, { slug: VISION_SLUG, serviceId: VISION_SERVICE }).reason ===
        "cross_tenant",
      "cross_tenant",
    );

    const otherService: PharmacyRegistryPage = {
      ...registry.pages[0]!,
      serviceId: "travel-vaccinations",
      url: `https://${VISION_HOST}/travel-vaccinations/`,
      canonicalUrl: `https://${VISION_HOST}/travel-vaccinations/`,
      publishPath: "/travel-vaccinations/",
    };
    const mixed = buildExternalIndexingPreflight({
      slug: VISION_SLUG,
      serviceId: VISION_SERVICE,
      registryPages: [...registry.pages, otherService],
      audit,
      sitemapUrls: sitemap.urls,
      sitemapUrl: sitemap.url,
    });
    record(
      "cross-service-excluded",
      !mixed.candidates.includes(`https://${VISION_HOST}/travel-vaccinations/`) && mixed.candidateCount === 9,
      `candidates=${mixed.candidateCount}`,
    );

    const customerPage: PharmacyRegistryPage = {
      ...registry.pages[0]!,
      url: "https://www.visionpharmacy.com/pharmacy-first/",
      canonicalUrl: "https://www.visionpharmacy.com/pharmacy-first/",
    };
    record(
      "www-visionpharmacy-excluded",
      evaluateRegisteredUrlForSubmission(customerPage, audit, {
        slug: VISION_SLUG,
        serviceId: VISION_SERVICE,
        profileWebsite: "https://www.visionpharmacy.com/",
      }).reason === "customer_website",
      "customer_website",
    );

    const placeholderPage: PharmacyRegistryPage = {
      ...registry.pages[0]!,
      url: "https://example.local/pharmacy-first/",
      canonicalUrl: "https://example.local/pharmacy-first/",
    };
    record(
      "example-local-excluded",
      evaluateRegisteredUrlForSubmission(placeholderPage, audit, { slug: VISION_SLUG, serviceId: VISION_SERVICE })
        .reason === "placeholder_host",
      "placeholder_host",
    );

    const serviceUrl = `https://${VISION_HOST}/pharmacy-first/`;
    const servicePage = registry.pages.find((page) => page.canonicalUrl === serviceUrl)!;
    const noindexAudit = withAuditPageOverride(audit, serviceUrl, {
      eligible: false,
      robots: "noindex, follow",
      intendedIndexable: true,
    });
    const noindexDecision = evaluateRegisteredUrlForSubmission(servicePage, noindexAudit, {
      slug: VISION_SLUG,
      serviceId: VISION_SERVICE,
    });
    record("newly-noindexed-fails-closed", noindexDecision.accepted === false && noindexDecision.reason === "noindex", noindexDecision.reason || "accepted");

    const blockerAudit = withAuditPageOverride(audit, serviceUrl, {
      eligible: false,
      blockers: [{ severity: "BLOCKER", code: "canonical_mismatch", message: "blocker" }],
    });
    const blockerDecision = evaluateRegisteredUrlForSubmission(servicePage, blockerAudit, {
      slug: VISION_SLUG,
      serviceId: VISION_SERVICE,
    });
    record(
      "newly-broken-technical-seo-fails-closed",
      blockerDecision.accepted === false && blockerDecision.reason === "technical_seo_blocker",
      blockerDecision.reason || "accepted",
    );

    const mismatchPage: PharmacyRegistryPage = {
      ...servicePage,
      url: `https://${VISION_HOST}/pharmacy-first/stale/`,
      canonicalUrl: `https://${VISION_HOST}/pharmacy-first/stale/`,
      publishPath: "/pharmacy-first/",
    };
    record(
      "canonical-inconsistency-fails-closed",
      evaluateRegisteredUrlForSubmission(mismatchPage, audit, { slug: VISION_SLUG, serviceId: VISION_SERVICE }).reason ===
        "canonical_mismatch",
      "canonical_mismatch",
    );

    const downAudit = withAuditPageOverride(audit, serviceUrl, { httpStatus: 503, eligible: true });
    record(
      "unavailable-url-fails-closed",
      evaluateRegisteredUrlForSubmission(servicePage, downAudit, { slug: VISION_SLUG, serviceId: VISION_SERVICE })
        .reason === "unavailable",
      "unavailable",
    );

    const already: PharmacyRegistryPage = { ...servicePage, indexingStatus: "submitted", submittedAt: "2026-01-01T00:00:00.000Z" };
    record(
      "duplicate-submission-idempotent",
      evaluateRegisteredUrlForSubmission(already, audit, { slug: VISION_SLUG, serviceId: VISION_SERVICE }).reason ===
        "already_submitted",
      "already_submitted",
    );

    const failedApply = applySuccessfulSitemapSubmitToPages(registry.pages, EXPECTED, new Date().toISOString(), false);
    record(
      "failed-external-cannot-record-success",
      failedApply.every((page) => page.indexingStatus === "ready_to_submit" && page.submittedAt === null),
      `statuses=${[...new Set(failedApply.map((page) => page.indexingStatus))].join(",")}`,
    );

    let mockCalls = 0;
    const failResult = await runPharmacyExternalIndexingSubmission({
      slug: VISION_SLUG,
      serviceId: VISION_SERVICE,
      mode: "live",
      confirmExternal: true,
      fetchLive: false,
      persist: false,
      googleClient: {
        async submitSitemap() {
          mockCalls += 1;
          throw new Error("simulated Search Console sitemap submit failure");
        },
      },
    });
    record(
      "partial-external-failure-preserves-truthful-state",
      failResult.submittedCount === 0 &&
        failResult.persisted === false &&
        failResult.ok === false &&
        mockCalls === 1 &&
        snapshotRegistry() === beforeRegistry,
      `submitted=${failResult.submittedCount} persisted=${failResult.persisted} mockCalls=${mockCalls}`,
    );

    record(
      "indexed-requires-external-evidence",
      preflight.indexedEvidence === "search_console_url_inspection_only" &&
        preflight.urlInspectionApi === GSC_URL_INSPECTION_API &&
        readIndexingWorkflowState(VISION_SLUG, VISION_SERVICE).indexedCount === 0,
      preflight.indexedEvidence,
    );

    const dryRun = await runPharmacyExternalIndexingSubmission({
      slug: VISION_SLUG,
      serviceId: VISION_SERVICE,
      mode: "dry-run",
      confirmExternal: false,
      fetchLive: false,
    });
    record(
      "submit-remains-separate-from-register",
      dryRun.mode === "dry-run" && dryRun.submittedCount === 0 && dryRun.confirmExternal === false,
      `mode=${dryRun.mode} submitted=${dryRun.submittedCount}`,
    );
    record(
      "dry-run-zero-google-requests",
      dryRun.googleRequests === 0 &&
        externalIndexingTelemetry.indexingApiCalls === 0 &&
        !fetched.some((url) => /googleapis\.com|searchconsole|indexing\.googleapis/i.test(url)),
      `googleRequests=${dryRun.googleRequests} fetchedGoogle=${fetched.filter((url) => /googleapis|searchconsole/i.test(url)).length}`,
    );
    record(
      "managed-domain-property-is-tenant-safe",
      property.property === `https://${VISION_HOST}/` &&
        property.tenantSafe === true &&
        property.rejectedProjectDomain?.includes("www.visionpharmacy.com") === true &&
        property.rejectedPlatformWideDomainProperty === "sc-domain:sites.pharmaconnect.uk",
      property.property,
    );
    record(
      "profile-website-cannot-override-managed-property",
      property.rejectedCustomerWebsite?.includes("www.visionpharmacy.com") === true &&
        !property.property.includes("www.visionpharmacy.com"),
      `rejected=${property.rejectedCustomerWebsite}`,
    );

    record(
      "mechanism-is-gsc-sitemap-submit-not-indexing-api",
      preflight.mechanism === GSC_SITEMAPS_API_METHOD &&
        preflight.googleApi === GSC_SITEMAPS_HTTP &&
        preflight.indexingApiForbidden === GOOGLE_INDEXING_API_URL &&
        preflight.mechanismAppropriateForOrdinaryPages === true,
      preflight.mechanism,
    );
    record(
      "search-console-connection-readonly",
      connection.canSubmitSitemaps === false &&
        connection.reconnectRequired === true &&
        connection.requestedScope === "https://www.googleapis.com/auth/webmasters",
      `${connection.authMethod} ${connection.permissionStatus} connected=${connection.connected} scope=${connection.oauthScope}`,
    );
    record(
      "sitemap-matches-nine-managed-urls",
      sitemap.urls.slice().sort().join("|") === EXPECTED.join("|") && preflight.sitemapMatchesCandidates,
      `count=${sitemap.urls.length}`,
    );
    record("live-submit-not-allowed-yet", preflight.liveSubmitAllowed === false, preflight.liveSubmitBlockedReasons.join(","));

    const workflow = readIndexingWorkflowState(VISION_SLUG, VISION_SERVICE);
    record(
      "counts-preserved",
      workflow.registeredCount === 9 &&
        workflow.submittedCount === 0 &&
        workflow.indexedCount === 0 &&
        workflow.notIndexedCount === 0 &&
        snapshotRegistry() === beforeRegistry &&
        snapshotSummary() === beforeSummary,
      `registered=${workflow.registeredCount} submitted=${workflow.submittedCount} indexed=${workflow.indexedCount} notIndexed=${workflow.notIndexedCount}`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const failed = checks.filter((item) => !item.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((item) => item.pass).length}/${checks.length} external indexing pre-flight checks`);
  if (failed.length) {
    for (const item of failed) console.error(`  - ${item.id}: ${item.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
