#!/usr/bin/env npx tsx
/**
 * Managed publication canonical authority.
 * Generic fixtures plus Vision read/overlay verification.
 * Does not regenerate campaign content, click Publish, submit indexing, or touch customer DNS/domains.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ManagedPublishingProfile } from "../src/pharmacy/masterAdminManagedPublishingModel.ts";
import {
  applyAuthoritativeCanonicalToHtml,
  applyAuthoritativeCanonicalToHtmlTree,
  canonicalUrlForIndexing,
  resolveAuthoritativePublicationCanonical,
} from "../src/pharmacy/pharmacyPublicationCanonicalAuthority.ts";
import { getServicePublishingSettings, saveServicePublishingSettings } from "../src/pharmacy/pharmacyPublishingSettingsService.ts";
import { getServiceAuthorityAudit } from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { rewritePublishHtmlForStaticHosting } from "../src/pharmacy/pharmacyPublishPackageAssembler.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VISION_SLUG = "vision-pharmacy";
const VISION_SERVICE = "pharmacy-first";
const VISION_MANAGED =
  "https://vision-pharmacy.sites.pharmaconnect.uk/pharmacy-first/";
const VISION_PROFILE_SITE = "https://www.visionpharmacy.com/pharmacy-first/";

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function fixtureProfile(
  slug: string,
  overrides: Partial<ManagedPublishingProfile> = {},
): ManagedPublishingProfile {
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

function extractCanonical(html: string): string | null {
  const match = String(html || "").match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
  if (!match) return null;
  const href = match[0].match(/\bhref=["']([^"']+)["']/i);
  return href?.[1] || null;
}

function main() {
  console.log("\n=== Managed publication canonical authority ===\n");

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/growth-engine/vision-pharmacy-campaign-generation-context-pharmacy-first.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/growth-engine/vision-pharmacy-review-centre.json",
    "data/pharmacy-enhancement-workspace/vision-pharmacy.json",
    "data/pharmacy-authority-enhancements/vision-pharmacy.json",
    "data/pharmacy-master-admin/active-service-campaign/vision-pharmacy.json",
    "data/pharmacy-authority-readiness/vision-pharmacy.json",
    "output/pharmacy-visual-experience/vision-pharmacy/pharmacy-first/index.html",
    "data/pharmacy-indexing/vision-pharmacy.json",
    "data/pharmacy-registry/vision-pharmacy.json",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));

  const storedSettingsBefore = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-publishing-settings/vision-pharmacy.json"), "utf8"),
  ) as { services?: Array<{ serviceId?: string; canonicalUrl?: string }> };
  const storedCanonicalBefore =
    storedSettingsBefore.services?.find((svc) => svc.serviceId === VISION_SERVICE)?.canonicalUrl || "";

  const managedTenant = "fixture-alpha";
  const otherTenant = "fixture-beta";
  const serviceA = "travel-vaccinations";
  const serviceB = "blood-pressure-checks";
  const profileSite = "https://www.customer-pharmacy.example";
  const storedCustomerPage = "https://www.customer-pharmacy.example/travel-vaccinations/";

  const managedResolved = resolveAuthoritativePublicationCanonical({
    slug: managedTenant,
    serviceId: serviceA,
    storedCanonicalUrl: storedCustomerPage,
    profileWebsite: profileSite,
    managedProfile: fixtureProfile(managedTenant),
  });
  record(
    "managed-publication-uses-managed-public-url",
    managedResolved.source === "managed_publication" &&
      managedResolved.canonicalUrl === "https://fixture-alpha.sites.pharmaconnect.uk/travel-vaccinations/" &&
      managedResolved.canonicalUrl === managedResolved.publicationDestination &&
      managedResolved.canonicalUrl === managedResolved.managedPublicUrl,
    `${managedResolved.source} ${managedResolved.canonicalUrl}`,
  );

  const verifiedHost = "local.customer-pharmacy.example";
  const verifiedResolved = resolveAuthoritativePublicationCanonical({
    slug: managedTenant,
    serviceId: serviceA,
    storedCanonicalUrl: storedCustomerPage,
    profileWebsite: profileSite,
    managedProfile: fixtureProfile(managedTenant, {
      customerRootDomainConfirmed: true,
      customerRootDomain: "customer-pharmacy.example",
      canonicalEcosystemHostname: verifiedHost,
      canonicalEcosystemBaseUrl: `https://${verifiedHost}/`,
      canonicalUrlStatus: "active",
      dnsStatus: "verified",
      sslStatus: "active",
    }),
  });
  record(
    "verified-customer-domain-may-be-canonical",
    verifiedResolved.source === "verified_customer_domain_publication" &&
      verifiedResolved.canonicalUrl === `https://${verifiedHost}/travel-vaccinations/` &&
      verifiedResolved.canonicalUrl !== storedCustomerPage &&
      verifiedResolved.canonicalUrl !== managedResolved.managedPublicUrl,
    `${verifiedResolved.source} ${verifiedResolved.canonicalUrl}`,
  );

  record(
    "profile-website-cannot-override-managed",
    managedResolved.profileWebsiteRejected === true &&
      managedResolved.rejectedStoredCanonical === storedCustomerPage &&
      managedResolved.canonicalUrl !== storedCustomerPage &&
      !managedResolved.canonicalUrl.includes("www.customer-pharmacy.example"),
    `rejectedStored=${managedResolved.rejectedStoredCanonical}`,
  );

  record(
    "canonical-cannot-silently-disagree-with-destination",
    managedResolved.canonicalUrl === managedResolved.publicationDestination &&
      verifiedResolved.canonicalUrl === verifiedResolved.publicationDestination &&
      managedResolved.canonicalUrl !== storedCustomerPage &&
      verifiedResolved.canonicalUrl !== storedCustomerPage,
    "resolver canonical equals publication destination; stored customer URL cannot win",
  );

  const indexedManaged = canonicalUrlForIndexing({
    slug: managedTenant,
    serviceId: serviceA,
    storedCanonicalUrl: storedCustomerPage,
    profileWebsite: profileSite,
    managedProfile: fixtureProfile(managedTenant),
  });
  const indexedVerified = canonicalUrlForIndexing({
    slug: managedTenant,
    serviceId: serviceA,
    storedCanonicalUrl: storedCustomerPage,
    profileWebsite: profileSite,
    managedProfile: fixtureProfile(managedTenant, {
      customerRootDomainConfirmed: true,
      customerRootDomain: "customer-pharmacy.example",
      canonicalEcosystemHostname: verifiedHost,
      canonicalEcosystemBaseUrl: `https://${verifiedHost}/`,
      canonicalUrlStatus: "active",
      dnsStatus: "verified",
      sslStatus: "active",
    }),
  });
  record(
    "indexing-consumes-same-authoritative-canonical",
    indexedManaged === managedResolved.canonicalUrl && indexedVerified === verifiedResolved.canonicalUrl,
    `managed=${indexedManaged} verified=${indexedVerified}`,
  );

  const otherTenantResolved = resolveAuthoritativePublicationCanonical({
    slug: otherTenant,
    serviceId: serviceA,
    storedCanonicalUrl: managedResolved.canonicalUrl,
    profileWebsite: profileSite,
    managedProfile: fixtureProfile(otherTenant),
  });
  const otherServiceResolved = resolveAuthoritativePublicationCanonical({
    slug: managedTenant,
    serviceId: serviceB,
    storedCanonicalUrl: storedCustomerPage,
    profileWebsite: profileSite,
    managedProfile: fixtureProfile(managedTenant),
  });
  record(
    "tenant-service-isolation",
    otherTenantResolved.canonicalUrl === "https://fixture-beta.sites.pharmaconnect.uk/travel-vaccinations/" &&
      otherTenantResolved.canonicalUrl !== managedResolved.canonicalUrl &&
      otherServiceResolved.canonicalUrl === "https://fixture-alpha.sites.pharmaconnect.uk/blood-pressure-checks/" &&
      otherServiceResolved.canonicalUrl !== managedResolved.canonicalUrl,
    `alpha=${managedResolved.canonicalUrl} beta=${otherTenantResolved.canonicalUrl} bp=${otherServiceResolved.canonicalUrl}`,
  );

  const sampleHtml = `<!DOCTYPE html><html><head><title>Service</title></head><body>
<script type="application/ld+json">{"url":"${storedCustomerPage}","item":"${storedCustomerPage}"}</script>
<a href="${profileSite}/">Customer website</a>
</body></html>`;
  const overlaid = applyAuthoritativeCanonicalToHtml(
    sampleHtml,
    managedResolved.canonicalUrl,
    managedResolved.stalePageUrls,
  );
  record(
    "html-overlay-rewrites-page-canonical-only",
    extractCanonical(overlaid) === managedResolved.canonicalUrl &&
      overlaid.includes(`"url":"${managedResolved.canonicalUrl}"`) &&
      overlaid.includes(`"item":"${managedResolved.canonicalUrl}"`) &&
      overlaid.includes(`href="${profileSite}/"`) &&
      !overlaid.includes(`"url":"${storedCustomerPage}"`),
    "canonical+JSON-LD page urls updated; customer homepage link preserved",
  );

  const rewritten = rewritePublishHtmlForStaticHosting(
    "<html><head></head><body>ok</body></html>",
    managedTenant,
    serviceA,
    "/travel-vaccinations/",
  );
  record(
    "prepare-rewrite-inserts-authoritative-canonical",
    extractCanonical(rewritten) === "https://fixture-alpha.sites.pharmaconnect.uk/travel-vaccinations/",
    extractCanonical(rewritten) || "missing",
  );

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "canonical-authority-"));
  fs.mkdirSync(path.join(tmpRoot, serviceA), { recursive: true });
  fs.writeFileSync(
    path.join(tmpRoot, serviceA, "index.html"),
    `<html><head></head><body><a href="${profileSite}/">site</a></body></html>`,
    "utf8",
  );
  const tree = applyAuthoritativeCanonicalToHtmlTree(tmpRoot, managedTenant, serviceA);
  const treeHtml = fs.readFileSync(path.join(tmpRoot, serviceA, "index.html"), "utf8");
  record(
    "tree-overlay-is-path-aware",
    tree.filesUpdated === 1 &&
      extractCanonical(treeHtml) === "https://fixture-alpha.sites.pharmaconnect.uk/travel-vaccinations/",
    `updated=${tree.filesUpdated} canonical=${extractCanonical(treeHtml)}`,
  );
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  const visionResolved = resolveAuthoritativePublicationCanonical({
    slug: VISION_SLUG,
    serviceId: VISION_SERVICE,
    storedCanonicalUrl: storedCanonicalBefore || VISION_PROFILE_SITE,
  });
  record(
    "vision-authoritative-destination-is-managed",
    visionResolved.source === "managed_publication" &&
      visionResolved.canonicalUrl === VISION_MANAGED &&
      visionResolved.publicationDestination === VISION_MANAGED,
    `${visionResolved.source} ${visionResolved.canonicalUrl}`,
  );

  saveServicePublishingSettings(VISION_SLUG, VISION_SERVICE, {
    canonicalUrl: storedCanonicalBefore || VISION_PROFILE_SITE,
  });
  const persisted = getServicePublishingSettings(VISION_SLUG, VISION_SERVICE);
  record(
    "vision-settings-overlay-rejects-profile-website",
    persisted?.canonicalUrl === VISION_MANAGED && persisted.canonicalUrl !== VISION_PROFILE_SITE,
    persisted?.canonicalUrl || "missing",
  );

  const liveRoot = "/var/www/pharmaconnect-sites/vision-pharmacy/current";
  const preparedRoot = path.join(ROOT, "artifacts/output/pharmacy-publish/vision-pharmacy");
  const liveOverlay = applyAuthoritativeCanonicalToHtmlTree(liveRoot, VISION_SLUG, VISION_SERVICE);
  const preparedOverlay = applyAuthoritativeCanonicalToHtmlTree(preparedRoot, VISION_SLUG, VISION_SERVICE);
  record(
    "bounded-overlay-applied",
    liveOverlay.filesScanned >= 10 && preparedOverlay.filesScanned >= 10,
    `live=${liveOverlay.filesUpdated}/${liveOverlay.filesScanned} prepared=${preparedOverlay.filesUpdated}/${preparedOverlay.filesScanned}`,
  );

  const liveHtml = fs.readFileSync(path.join(liveRoot, "pharmacy-first/index.html"), "utf8");
  const preparedHtml = fs.readFileSync(path.join(preparedRoot, "pharmacy-first/index.html"), "utf8");
  record(
    "vision-live-html-canonical",
    extractCanonical(liveHtml) === VISION_MANAGED &&
      liveHtml.includes(`"url":"${VISION_MANAGED}"`) &&
      liveHtml.includes(`href="https://www.visionpharmacy.com"`) &&
      !liveHtml.includes(`"url":"${VISION_PROFILE_SITE}"`),
    extractCanonical(liveHtml) || "missing",
  );
  record(
    "vision-prepared-html-canonical",
    extractCanonical(preparedHtml) === VISION_MANAGED &&
      preparedHtml.includes(`href="https://www.visionpharmacy.com"`),
    extractCanonical(preparedHtml) || "missing",
  );

  const settingsPageSrc = fs.readFileSync(
    path.join(ROOT, "artifacts/api-server/src/routes/pharmacyPublishingSettingsPage.ts"),
    "utf8",
  );
  record(
    "publishing-settings-page-uses-resolver-not-profile-website",
    settingsPageSrc.includes("resolveAuthoritativePublicationCanonical") &&
      settingsPageSrc.includes("canonicalAuthority.canonicalUrl") &&
      !settingsPageSrc.includes("settings?.canonicalUrl || pageProfile.website"),
    "Publishing Settings page binds Canonical URL from publication authority",
  );

  const audit = getServiceAuthorityAudit(VISION_SLUG, VISION_SERVICE);
  const canonicalEvidence = audit?.evidence?.technicalPublishReadiness?.find((item) => item.signal === "Canonical");
  const storedAudit = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-authority-readiness/vision-pharmacy.json"), "utf8"),
  ) as { services?: Array<{ serviceId?: string; overallScore?: number; publishGate?: string }> };
  const storedPf = storedAudit.services?.find((svc) => svc.serviceId === VISION_SERVICE);
  record(
    "vision-audit-consumes-authoritative-canonical-without-rescore",
    audit?.overallScore === 74 &&
      audit?.publishGate === "PASS_WITH_RECOMMENDATIONS" &&
      storedPf?.overallScore === 74 &&
      storedPf?.publishGate === "PASS_WITH_RECOMMENDATIONS" &&
      canonicalEvidence?.detail === VISION_MANAGED,
    `score=${audit?.overallScore} gate=${audit?.publishGate} canonical=${canonicalEvidence?.detail}`,
  );

  const indexing = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json"), "utf8")) as {
    submitted?: number;
    pages?: unknown[];
  };
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-registry/vision-pharmacy.json"), "utf8")) as {
    pages?: unknown[];
  };
  record(
    "nothing-submitted-for-indexing",
    (indexing.submitted || 0) === 0 && (registry.pages || []).length === 0,
    `submitted=${indexing.submitted || 0} registryPages=${(registry.pages || []).length}`,
  );

  const areas = explicitConfirmedLocalityNames(readSetupProfile(VISION_SLUG).selectedAreas);
  record("vision-areas-unchanged", areas.length === 8, `areas=${areas.length}`);

  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const changed = hashed.filter((rel) => before[rel] !== after[rel]);
  record(
    "vision-protected-hashes-unchanged",
    changed.length === 0,
    changed.length === 0 ? "protected Vision files unchanged" : changed.join(", "),
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks`);
  console.log(`canonical before=${storedCanonicalBefore}`);
  console.log(`canonical after=${persisted?.canonicalUrl}`);
  if (failed.length) process.exit(1);
}

main();
