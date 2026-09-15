#!/usr/bin/env npx tsx
/**
 * Live Search Console connection/scope/property verification only.
 * Does not submit sitemaps or URLs.
 */
import {
  GSC_OAUTH_SCOPE_WRITE,
  buildSearchConsoleAuthUrl,
  loadOAuthTokenRecord,
} from "../artifacts/api-server/src/routes/api/gscAuth.ts";
import {
  isPharmacyGscSitemapSubmitEnabled,
  readManagedPublicationSitemap,
  resolvePharmacySearchConsoleProperty,
} from "../src/pharmacy/pharmacyExternalIndexingSubmissionService.ts";
import { loadTechnicalSeoAudit } from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import { readIndexingWorkflowState } from "../src/pharmacy/pharmacyIndexingBridgeService.ts";
import {
  resetSearchConsoleAuthorityTelemetry,
  searchConsoleAuthorityTelemetry,
  verifyPharmacySearchConsoleWriteAuthority,
} from "../src/pharmacy/pharmacySearchConsoleWriteAuthorityService.ts";

async function main() {
  const originalFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = String(init?.method || "GET").toUpperCase();
    fetched.push(`${method} ${url}`);
    if (/sitemaps/i.test(url) || /urlNotifications/i.test(url) || /indexing\.googleapis/i.test(url) || /urlInspection/i.test(url)) {
      throw new Error(`refused forbidden Google call ${method} ${url}`);
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    resetSearchConsoleAuthorityTelemetry();
    const property = resolvePharmacySearchConsoleProperty("vision-pharmacy", "pharmacy-first");
    const before = loadOAuthTokenRecord();
    const result = await verifyPharmacySearchConsoleWriteAuthority({
      slug: "vision-pharmacy",
      requestedProperty: property.property,
      customerWebsite: property.rejectedCustomerWebsite,
      liveGoogle: true,
      persist: true,
    });
    const after = loadOAuthTokenRecord();
    const workflow = readIndexingWorkflowState("vision-pharmacy", "pharmacy-first");
    const audit = loadTechnicalSeoAudit("vision-pharmacy", "pharmacy-first");
    const sitemap = readManagedPublicationSitemap("vision-pharmacy");
    const authUrl = buildSearchConsoleAuthUrl({ slug: "vision-pharmacy" });
    console.log(JSON.stringify({
      connected: result.connected,
      requestedScope: result.requestedScope,
      grantedScope: result.grantedScope,
      grantedScopeProvenByGoogle: result.grantedScopeProvenByGoogle,
      writeAuthorized: result.writeAuthorized,
      reconnectRequired: result.reconnectRequired,
      permissionStatus: result.permissionStatus,
      canSubmitSitemaps: result.canSubmitSitemaps,
      propertyVerified: result.propertyVerified,
      requestedProperty: result.property.requestedProperty,
      matchedProperty: result.property.matchedProperty,
      permissionLevel: result.property.permissionLevel,
      missingExactUrlPrefix: result.property.missingExactUrlPrefix,
      relevantProperties: result.property.relevantProperties,
      rejectedCustomerWebsite: result.property.rejectedCustomerWebsite,
      rejectedPlatformWideDomainProperty: result.property.rejectedPlatformWideDomainProperty,
      rejectedCrossTenant: result.property.rejectedCrossTenant,
      setupHint: result.property.setupHint,
      liveGoogleCalls: result.liveGoogleCalls,
      error: result.error || null,
      killSwitch: isPharmacyGscSitemapSubmitEnabled(),
      authUrlHasWrite: authUrl.includes(encodeURIComponent(GSC_OAUTH_SCOPE_WRITE)),
      authUrlHasReadonly: authUrl.includes("webmasters.readonly"),
      promptConsent: authUrl.includes("prompt=consent"),
      beforeHadGrantedScope: Boolean(before?.granted_scope),
      afterGrantedScope: after?.granted_scope || null,
      afterSource: after?.granted_scope_source || null,
      fetched,
      telemetry: searchConsoleAuthorityTelemetry,
      registered: workflow.registeredCount,
      submitted: workflow.submittedCount,
      indexed: workflow.indexedCount,
      notIndexed: workflow.notIndexedCount,
      seoEligible: audit?.eligibleCount,
      seoBlocked: audit?.blockedCount,
      sitemapCount: sitemap.urls.length,
    }, null, 2));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
