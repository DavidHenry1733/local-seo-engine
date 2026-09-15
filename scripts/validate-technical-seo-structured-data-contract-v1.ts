#!/usr/bin/env npx tsx
/**
 * Technical SEO + Structured Data Contract V1.
 * Generic fixtures plus live Vision publication audit.
 * Does not regenerate content, change approvals/profile, republish, or submit indexing.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ManagedPublishingProfile } from "../src/pharmacy/masterAdminManagedPublishingModel.ts";
import {
  getTechnicalSeoContract,
  isRegisteredTechnicalSeoPageType,
  TECHNICAL_SEO_PAGE_TYPES,
} from "../src/pharmacy/pharmacyTechnicalSeoContract.ts";
import { evaluateTechnicalSeoIndexGate } from "../src/pharmacy/pharmacyTechnicalSeoIndexGate.ts";
import {
  assertNoTechnicalSeoIndexBlockers,
  auditPublishedTechnicalSeo,
  technicalSeoAuditPath,
} from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
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

function pageHtml(opts: {
  title?: string;
  description?: string;
  canonical: string;
  robots?: string;
  h1?: string;
  jsonLd?: string;
  extraHead?: string;
  extraBody?: string;
}): string {
  const json =
    opts.jsonLd === undefined
      ? `<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","url":"${opts.canonical}"}</script>`
      : opts.jsonLd
        ? `<script type="application/ld+json">${opts.jsonLd}</script>`
        : "";
  return `<!DOCTYPE html><html lang="en-GB"><head>
<title>${opts.title ?? "Travel Vaccinations | Fixture Pharmacy"}</title>
${opts.description === null ? "" : `<meta name="description" content="${opts.description ?? "Travel vaccinations at Fixture Pharmacy in the local area."}"/>`}
<link rel="canonical" href="${opts.canonical}"/>
<meta name="robots" content="${opts.robots ?? "index, follow"}"/>
${opts.extraHead || ""}
</head><body>
${opts.h1 === null ? "" : `<h1>${opts.h1 ?? "Travel Vaccinations at Fixture Pharmacy"}</h1>`}
${json}
${opts.extraBody ?? `<img src="/hero.webp" alt="Private consultation room"/><a href="/travel-vaccinations/">Service</a>`}
</body></html>`;
}

async function main() {
  console.log("\n=== Technical SEO + Structured Data Contract V1 ===\n");

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/growth-engine/vision-pharmacy-campaign-generation-context-pharmacy-first.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/growth-engine/vision-pharmacy-review-centre.json",
    "data/pharmacy-indexing/vision-pharmacy.json",
    "data/pharmacy-registry/vision-pharmacy.json",
    "output/pharmacy-visual-experience/vision-pharmacy/pharmacy-first/index.html",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));

  const slug = "fixture-alpha";
  const serviceId = "travel-vaccinations";
  const managed = `https://${slug}.sites.pharmaconnect.uk/travel-vaccinations/`;
  const locality = `https://${slug}.sites.pharmaconnect.uk/local-oadby/`;
  const profile = fixtureProfile(slug);

  const validService = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: managed }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record("valid-service-index-eligible", validService.eligible === true && validService.blockers.length === 0, `eligible=${validService.eligible} blockers=${validService.blockers.map((b) => b.code).join(",") || "none"}`);

  const validLocality = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "locality",
    publicPath: "/local-oadby/",
    html: pageHtml({
      title: "Travel Vaccinations in Oadby | Fixture Pharmacy",
      description: "Travel vaccinations for patients in Oadby.",
      canonical: locality,
      h1: "Travel Vaccinations in Oadby",
      jsonLd: `{"@context":"https://schema.org","@type":"WebPage","url":"${locality}"}`,
      extraBody: `<img src="/hero.webp" alt="Consultation room"/><a href="/travel-vaccinations/">Travel Vaccinations</a>`,
    }),
    pageUrl: locality,
    httpStatus: 200,
    sitemapUrls: [managed, locality],
    expectedLocality: "Oadby",
    managedProfile: profile,
    servicePublicPath: "/travel-vaccinations/",
  });
  record("valid-locality-index-eligible", validLocality.eligible === true, `eligible=${validLocality.eligible} blockers=${validLocality.blockers.map((b) => b.code).join(",") || "none"}`);

  const missingTitle = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: managed, title: "" }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record("missing-title-blocked", missingTitle.eligible === false && missingTitle.blockers.some((b) => b.code === "missing_title"), missingTitle.blockers.map((b) => b.code).join(","));

  const missingH1 = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: managed, h1: null as unknown as string }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record("missing-h1-blocked", missingH1.eligible === false && missingH1.blockers.some((b) => b.code === "missing_h1"), missingH1.blockers.map((b) => b.code).join(","));

  const noindex = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: managed, robots: "noindex, nofollow" }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record("accidental-noindex-blocked", noindex.eligible === false && noindex.blockers.some((b) => b.code === "accidental_noindex"), noindex.blockers.map((b) => b.code).join(","));

  const wrongCanonical = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: "https://www.customer-pharmacy.example/travel-vaccinations/" }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    profileWebsite: "https://www.customer-pharmacy.example/",
    managedProfile: profile,
  });
  record(
    "wrong-canonical-blocked",
    wrongCanonical.eligible === false && wrongCanonical.blockers.some((b) => b.code === "canonical_publication_disagreement"),
    wrongCanonical.blockers.map((b) => b.code).join(","),
  );

  const crossTenant = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: "https://fixture-beta.sites.pharmaconnect.uk/travel-vaccinations/" }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record(
    "cross-tenant-canonical-blocked",
    crossTenant.eligible === false && crossTenant.blockers.some((b) => b.code === "cross_tenant_canonical"),
    crossTenant.blockers.map((b) => b.code).join(","),
  );

  const invalidJson = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: managed, jsonLd: "{not-json" }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record("invalid-json-ld-blocked", invalidJson.eligible === false && invalidJson.blockers.some((b) => b.code === "invalid_json_ld"), invalidJson.blockers.map((b) => b.code).join(","));

  const schemaDisagree = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({
      canonical: managed,
      jsonLd: `{"@context":"https://schema.org","@type":"WebPage","url":"https://www.customer-pharmacy.example/travel-vaccinations/"}`,
    }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record(
    "schema-canonical-disagreement-blocked",
    schemaDisagree.eligible === false && schemaDisagree.blockers.some((b) => b.code === "schema_canonical_disagreement"),
    schemaDisagree.blockers.map((b) => b.code).join(","),
  );

  const sitemapDisagree = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: managed }),
    pageUrl: "https://fixture-alpha.sites.pharmaconnect.uk/wrong-path/",
    httpStatus: 200,
    sitemapUrls: ["https://fixture-alpha.sites.pharmaconnect.uk/wrong-path/"],
    managedProfile: profile,
  });
  record(
    "sitemap-canonical-disagreement-blocked",
    sitemapDisagree.eligible === false &&
      (sitemapDisagree.blockers.some((b) => b.code === "sitemap_canonical_disagreement") ||
        sitemapDisagree.blockers.some((b) => b.code === "sitemap_missing_indexable_url")),
    sitemapDisagree.blockers.map((b) => b.code).join(","),
  );

  const missingAlt = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: managed, extraBody: `<img src="/hero.webp"/><a href="/travel-vaccinations/">Service</a>` }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record(
    "meaningful-image-missing-alt-classified",
    missingAlt.blockers.some((b) => b.code === "image_missing_alt") && missingAlt.eligible === false,
    missingAlt.blockers.map((b) => b.code).join(","),
  );

  const decorative = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({
      canonical: managed,
      extraBody: `<img src="/spacer.png" alt=""/><img src="/hero.webp" alt="Consultation room"/><a href="/travel-vaccinations/">Service</a>`,
    }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record(
    "decorative-empty-alt-valid",
    decorative.eligible === true && decorative.informational.some((b) => b.code === "decorative_empty_alt"),
    `eligible=${decorative.eligible} info=${decorative.informational.map((b) => b.code).join(",")}`,
  );

  const duplicateCanonical = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "locality",
    publicPath: "/local-oadby/",
    html: pageHtml({
      title: "Travel Vaccinations in Oadby | Fixture Pharmacy",
      description: "Travel vaccinations for patients in Oadby.",
      canonical: locality,
      h1: "Travel Vaccinations in Oadby",
      jsonLd: `{"@context":"https://schema.org","@type":"WebPage","url":"${locality}"}`,
      extraBody: `<img src="/hero.webp" alt="Consultation room"/><a href="/travel-vaccinations/">Travel Vaccinations</a>`,
    }),
    pageUrl: locality,
    httpStatus: 200,
    sitemapUrls: [locality],
    expectedLocality: "Oadby",
    campaignCanonicals: [locality, locality],
    managedProfile: profile,
    servicePublicPath: "/travel-vaccinations/",
  });
  record(
    "duplicate-locality-canonical-blocked",
    duplicateCanonical.eligible === false && duplicateCanonical.blockers.some((b) => b.code === "duplicate_canonical"),
    duplicateCanonical.blockers.map((b) => b.code).join(","),
  );

  const wrongLocality = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "locality",
    publicPath: "/local-oadby/",
    html: pageHtml({
      title: "Travel Vaccinations in Wigston | Fixture Pharmacy",
      description: "Travel vaccinations for patients in Wigston.",
      canonical: locality,
      h1: "Travel Vaccinations in Wigston",
      jsonLd: `{"@context":"https://schema.org","@type":"WebPage","url":"${locality}"}`,
      extraBody: `<img src="/hero.webp" alt="Consultation room"/><a href="/travel-vaccinations/">Travel Vaccinations</a>`,
    }),
    pageUrl: locality,
    httpStatus: 200,
    sitemapUrls: [locality],
    expectedLocality: "Oadby",
    managedProfile: profile,
    servicePublicPath: "/travel-vaccinations/",
  });
  record(
    "wrong-locality-metadata-blocked",
    wrongLocality.eligible === false && wrongLocality.blockers.some((b) => b.code.startsWith("wrong_locality")),
    wrongLocality.blockers.map((b) => b.code).join(","),
  );

  const homepage = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "homepage",
    publicPath: "/",
    html: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/travel-vaccinations/"/><link rel="canonical" href="${managed}"/><title>Redirecting…</title></head><body><a href="/travel-vaccinations/">Continue</a></body></html>`,
    pageUrl: `https://${slug}.sites.pharmaconnect.uk/`,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record(
    "non-indexable-published-page-not-eligible",
    homepage.intendedIndexable === false && homepage.eligible === false,
    `intended=${homepage.intendedIndexable} eligible=${homepage.eligible}`,
  );

  const optionalRec = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({
      canonical: managed,
      title: "Travel Vaccinations at Fixture Pharmacy for local patients looking for travel health advice",
    }),
    pageUrl: managed,
    httpStatus: 200,
    sitemapUrls: [managed],
    managedProfile: profile,
  });
  record(
    "optional-recommendation-does-not-block",
    optionalRec.eligible === true && optionalRec.recommendations.length > 0,
    `eligible=${optionalRec.eligible} recs=${optionalRec.recommendations.map((b) => b.code).join(",")}`,
  );

  const unregistered = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "experimental-widget",
    publicPath: "/experimental-widget/",
    html: pageHtml({ canonical: `https://${slug}.sites.pharmaconnect.uk/experimental-widget/` }),
    pageUrl: `https://${slug}.sites.pharmaconnect.uk/experimental-widget/`,
    httpStatus: 200,
    intendedIndexable: true,
    managedProfile: profile,
  });
  record(
    "unregistered-page-type-fails-closed",
    unregistered.registered === false && unregistered.eligible === false && unregistered.blockers.some((b) => b.code === "unregistered_page_type"),
    unregistered.blockers.map((b) => b.code).join(","),
  );

  record(
    "profile-website-cannot-override-managed",
    wrongCanonical.blockers.some((b) => b.code === "profile_website_cannot_override_managed"),
    wrongCanonical.blockers.map((b) => b.code).join(","),
  );

  const verifiedHost = "local.customer-pharmacy.example";
  const verifiedUrl = `https://${verifiedHost}/travel-vaccinations/`;
  const verified = evaluateTechnicalSeoIndexGate({
    slug,
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({
      canonical: verifiedUrl,
      jsonLd: `{"@context":"https://schema.org","@type":"WebPage","url":"${verifiedUrl}"}`,
    }),
    pageUrl: verifiedUrl,
    httpStatus: 200,
    sitemapUrls: [verifiedUrl],
    profileWebsite: "https://www.customer-pharmacy.example/",
    managedProfile: fixtureProfile(slug, {
      customerRootDomainConfirmed: true,
      canonicalEcosystemHostname: verifiedHost,
      canonicalEcosystemBaseUrl: `https://${verifiedHost}/`,
      canonicalUrlStatus: "active",
      dnsStatus: "verified",
      sslStatus: "active",
    }),
  });
  record("verified-production-canonical-eligible", verified.eligible === true, `canonical=${verified.authoritativeCanonical} eligible=${verified.eligible}`);

  const otherTenant = evaluateTechnicalSeoIndexGate({
    slug: "fixture-beta",
    serviceId,
    pageType: "service",
    publicPath: "/travel-vaccinations/",
    html: pageHtml({ canonical: "https://fixture-beta.sites.pharmaconnect.uk/travel-vaccinations/" }),
    pageUrl: "https://fixture-beta.sites.pharmaconnect.uk/travel-vaccinations/",
    httpStatus: 200,
    sitemapUrls: ["https://fixture-beta.sites.pharmaconnect.uk/travel-vaccinations/"],
    managedProfile: fixtureProfile("fixture-beta"),
  });
  record(
    "tenant-service-isolation",
    otherTenant.eligible === true &&
      otherTenant.authoritativeCanonical !== validService.authoritativeCanonical &&
      getTechnicalSeoContract("blood-pressure-checks") === null &&
      isRegisteredTechnicalSeoPageType("service") &&
      TECHNICAL_SEO_PAGE_TYPES.includes("locality"),
    `alpha=${validService.authoritativeCanonical} beta=${otherTenant.authoritativeCanonical}`,
  );

  const vision = await auditPublishedTechnicalSeo({ slug: "vision-pharmacy", serviceId: "pharmacy-first", fetchLive: true });
  const artefact = technicalSeoAuditPath("vision-pharmacy", "pharmacy-first");
  record(
    "vision-live-inventory",
    vision.totalPublishedUrls === 10 &&
      vision.intendedIndexableUrls === 9 &&
      vision.intentionallyNonIndexableUrls === 1 &&
      Boolean(vision.tenthPageIdentity?.includes("homepage")),
    `published=${vision.totalPublishedUrls} indexable=${vision.intendedIndexableUrls} non=${vision.intentionallyNonIndexableUrls} tenth=${vision.tenthPageIdentity}`,
  );
  record(
    "vision-live-html-audited",
    vision.liveHtmlAuthoritative === true &&
      vision.pages.every((page) => page.httpStatus === 200) &&
      fs.existsSync(artefact),
    `artefact=${path.relative(ROOT, artefact)} eligible=${vision.eligibleCount} blocked=${vision.blockedCount}`,
  );
  let gateThrew = false;
  try {
    assertNoTechnicalSeoIndexBlockers(vision);
  } catch {
    gateThrew = true;
  }
  record(
    "vision-index-gate-fail-closed-without-submit",
    vision.blockedCount > 0 ? gateThrew : !gateThrew,
    `blocked=${vision.blockedCount} threw=${gateThrew}`,
  );

  const indexing = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json"), "utf8")) as { submitted?: number };
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-registry/vision-pharmacy.json"), "utf8")) as { pages?: unknown[] };
  record("nothing-submitted-for-indexing", (indexing.submitted || 0) === 0 && (registry.pages || []).length === 0, `submitted=${indexing.submitted || 0}`);

  const areas = explicitConfirmedLocalityNames(readSetupProfile("vision-pharmacy").selectedAreas);
  record("vision-areas-unchanged", areas.length === 8, `areas=${areas.length}`);

  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const changed = hashed.filter((rel) => before[rel] !== after[rel]);
  record("vision-protected-hashes-unchanged", changed.length === 0, changed.length ? changed.join(", ") : "protected Vision files unchanged");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
