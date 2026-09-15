#!/usr/bin/env npx tsx
/**
 * Search Console write authority + managed property verification.
 * Mocks Google except where a later live command is run separately.
 * Never submits sitemaps or URLs and never enables the live-submit kill switch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GSC_OAUTH_SCOPE_READONLY, GSC_OAUTH_SCOPE_WRITE } from "../artifacts/api-server/src/routes/api/gscAuth.ts";
import {
  evaluateManagedPropertyAuthority,
  isWriteOauthScope,
  resetSearchConsoleAuthorityTelemetry,
  searchConsoleAuthorityTelemetry,
  verifyPharmacySearchConsoleWriteAuthority,
} from "../src/pharmacy/pharmacySearchConsoleWriteAuthorityService.ts";
import {
  isPharmacyGscSitemapSubmitEnabled,
  resolvePharmacySearchConsoleProperty,
} from "../src/pharmacy/pharmacyExternalIndexingSubmissionService.ts";
import { loadTechnicalSeoAudit } from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import { readIndexingWorkflowState, readPharmacyRegistry } from "../src/pharmacy/pharmacyIndexingBridgeService.ts";
import { readManagedPublicationSitemap } from "../src/pharmacy/pharmacyExternalIndexingSubmissionService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VISION = "vision-pharmacy";
const SERVICE = "pharmacy-first";
const PROPERTY = "https://vision-pharmacy.sites.pharmaconnect.uk/";
const CUSTOMER = "https://www.visionpharmacy.com/";

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function snapshot(file: string): string {
  return fs.readFileSync(file, "utf8");
}

async function main() {
  delete process.env.PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED;
  resetSearchConsoleAuthorityTelemetry();
  const beforeRegistry = snapshot(path.join(ROOT, "data/pharmacy-registry/vision-pharmacy.json"));
  const beforeSummary = snapshot(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json"));
  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    fetched.push(`${init?.method || "GET"} ${url}`);
    if (/googleapis\.com|searchconsole|indexing\.googleapis|webmasters/i.test(String(url))) {
      throw new Error(`blocked unexpected Google request: ${url}`);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const requested = resolvePharmacySearchConsoleProperty(VISION, SERVICE).property;
    record("requested-property-is-tenant-url-prefix", requested === PROPERTY, requested);

    const readonlyAuth = await verifyPharmacySearchConsoleWriteAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      customerWebsite: CUSTOMER,
      liveGoogle: true,
      persist: false,
      tokenRecord: {
        refresh_token: "test-readonly",
        granted_scope: GSC_OAUTH_SCOPE_READONLY,
        granted_scope_source: "google_token_response",
      },
      googleClient: {
        async refreshScope() {
          return { scope: GSC_OAUTH_SCOPE_READONLY };
        },
        async listSites() {
          return [{ siteUrl: PROPERTY, permissionLevel: "siteOwner" }];
        },
      },
    });
    record(
      "readonly-oauth-cannot-submit-sitemap",
      readonlyAuth.writeAuthorized === false &&
        readonlyAuth.canSubmitSitemaps === false &&
        readonlyAuth.reconnectRequired === true &&
        readonlyAuth.externalSubmissionLabel === "Blocked",
      readonlyAuth.permissionStatus,
    );

    const writeAuth = await verifyPharmacySearchConsoleWriteAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      customerWebsite: CUSTOMER,
      liveGoogle: true,
      persist: false,
      tokenRecord: {
        refresh_token: "test-write",
        granted_scope: GSC_OAUTH_SCOPE_WRITE,
        granted_scope_source: "google_token_response",
      },
      googleClient: {
        async refreshScope() {
          return { scope: GSC_OAUTH_SCOPE_WRITE };
        },
        async listSites() {
          return [{ siteUrl: PROPERTY, permissionLevel: "siteOwner" }];
        },
      },
    });
    record(
      "write-oauth-satisfies-submission-scope",
      writeAuth.writeAuthorized === true &&
        writeAuth.canSubmitSitemaps === true &&
        writeAuth.submissionPermissionLabel === "Write authorised",
      writeAuth.permissionStatus,
    );

    const unproven = await verifyPharmacySearchConsoleWriteAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      liveGoogle: false,
      persist: false,
      tokenRecord: { refresh_token: "legacy-readonly-token" },
      grantedScope: GSC_OAUTH_SCOPE_WRITE,
      grantedScopeProvenByGoogle: false,
      sites: [{ siteUrl: PROPERTY, permissionLevel: "siteOwner" }],
    });
    record(
      "existing-readonly-token-not-silently-promoted",
      unproven.writeAuthorized === false &&
        unproven.canSubmitSitemaps === false &&
        unproven.reconnectRequired === true &&
        isWriteOauthScope(unproven.grantedScope) === true,
      `proven=${unproven.grantedScopeProvenByGoogle}`,
    );

    const missing = evaluateManagedPropertyAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      sites: [{ siteUrl: CUSTOMER, permissionLevel: "siteOwner" }],
      customerWebsite: CUSTOMER,
    });
    record(
      "missing-property-blocks-submission",
      missing.propertyVerified === false && missing.missingExactUrlPrefix === true,
      missing.setupHint,
    );

    const restricted = evaluateManagedPropertyAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      sites: [{ siteUrl: PROPERTY, permissionLevel: "siteRestrictedUser" }],
    });
    record(
      "insufficient-property-permission-blocks-submission",
      restricted.propertyVerified === false && restricted.permissionSufficient === false,
      String(restricted.permissionLevel),
    );

    const exact = evaluateManagedPropertyAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      sites: [{ siteUrl: PROPERTY, permissionLevel: "siteFullUser" }],
    });
    record(
      "exact-managed-url-prefix-with-permission-passes",
      exact.propertyVerified === true && exact.matchedProperty === PROPERTY && exact.permissionSufficient === true,
      String(exact.permissionLevel),
    );

    const customer = evaluateManagedPropertyAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      sites: [{ siteUrl: CUSTOMER, permissionLevel: "siteOwner" }],
      customerWebsite: CUSTOMER,
    });
    record(
      "customer-profile-website-cannot-become-managed-property",
      customer.propertyVerified === false && customer.rejectedCustomerWebsite?.includes("www.visionpharmacy.com") === true,
      String(customer.rejectedCustomerWebsite),
    );

    const cross = evaluateManagedPropertyAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      sites: [{ siteUrl: "https://leeds-pharmacy.sites.pharmaconnect.uk/", permissionLevel: "siteOwner" }],
    });
    record(
      "cross-tenant-property-cannot-satisfy-authority",
      cross.propertyVerified === false && cross.rejectedCrossTenant.includes("https://leeds-pharmacy.sites.pharmaconnect.uk/"),
      cross.rejectedCrossTenant.join(","),
    );

    const broad = evaluateManagedPropertyAuthority({
      slug: VISION,
      requestedProperty: PROPERTY,
      sites: [{ siteUrl: "sc-domain:sites.pharmaconnect.uk", permissionLevel: "siteOwner" }],
    });
    record(
      "broad-domain-property-cannot-replace-tenant-property",
      broad.propertyVerified === false &&
        broad.rejectedPlatformWideDomainProperty === "sc-domain:sites.pharmaconnect.uk" &&
        broad.missingExactUrlPrefix === true,
      String(broad.rejectedPlatformWideDomainProperty),
    );

    record(
      "live-submit-kill-switch-disabled",
      isPharmacyGscSitemapSubmitEnabled() === false && writeAuth.liveSubmitKillSwitchEnabled === false,
      String(process.env.PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED || "unset"),
    );
    record(
      "no-sitemap-submission-during-property-verification",
      searchConsoleAuthorityTelemetry.sitemapSubmitCalls === 0 &&
        !fetched.some((url) => /sitemaps/i.test(url)),
      `sitemapSubmitCalls=${searchConsoleAuthorityTelemetry.sitemapSubmitCalls}`,
    );
    record(
      "no-indexing-api-request",
      searchConsoleAuthorityTelemetry.indexingApiCalls === 0 &&
        !fetched.some((url) => /indexing\.googleapis|urlNotifications/i.test(url)),
      `indexingApiCalls=${searchConsoleAuthorityTelemetry.indexingApiCalls}`,
    );

    const workflow = readIndexingWorkflowState(VISION, SERVICE);
    const audit = loadTechnicalSeoAudit(VISION, SERVICE);
    const sitemap = readManagedPublicationSitemap(VISION);
    const registry = readPharmacyRegistry(VISION);
    record("registration-remains-9", workflow.registeredCount === 9 && (registry?.pages.length || 0) === 9, String(workflow.registeredCount));
    record("submitted-remains-0", workflow.submittedCount === 0, String(workflow.submittedCount));
    record("indexed-remains-0", workflow.indexedCount === 0, String(workflow.indexedCount));
    record("not-indexed-remains-0", workflow.notIndexedCount === 0, String(workflow.notIndexedCount));
    record(
      "technical-seo-remains-9-eligible",
      audit?.eligibleCount === 9 && audit?.blockedCount === 0,
      `eligible=${audit?.eligibleCount} blocked=${audit?.blockedCount}`,
    );
    record(
      "sitemap-remains-9-authoritative-managed-urls",
      sitemap.urls.length === 9 && sitemap.urls.every((url) => url.startsWith("https://vision-pharmacy.sites.pharmaconnect.uk/")),
      `count=${sitemap.urls.length}`,
    );
    record(
      "vision-files-unchanged",
      snapshot(path.join(ROOT, "data/pharmacy-registry/vision-pharmacy.json")) === beforeRegistry &&
        snapshot(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json")) === beforeSummary,
      "registry+summary",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const failed = checks.filter((item) => !item.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((item) => item.pass).length}/${checks.length} Search Console write-authority checks`);
  if (failed.length) {
    for (const item of failed) console.error(`  - ${item.id}: ${item.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
