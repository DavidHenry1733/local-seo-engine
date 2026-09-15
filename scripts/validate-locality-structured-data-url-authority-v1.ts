#!/usr/bin/env npx tsx
/**
 * Locality structured-data URL authority — published JSON-LD page/entity URLs
 * follow publication canonical authority. Preview may keep placeholder hosts.
 * Does not regenerate content, fix /locations/, alter robots/canonicals/titles, or submit indexing.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ManagedPublishingProfile } from "../src/pharmacy/masterAdminManagedPublishingModel.ts";
import {
  applyAuthoritativeCanonicalToHtmlTree,
  applyAuthoritativeStructuredDataUrlsToHtml,
  resolveAuthoritativePublicationCanonical,
  resolvePublishedBusinessIdentityUrl,
} from "../src/pharmacy/pharmacyPublicationCanonicalAuthority.ts";
import { rewritePublishHtmlForStaticHosting } from "../src/pharmacy/pharmacyPublishPackageAssembler.ts";
import {
  inspectTechnicalSeoHtml,
  jsonLdPageEntityUrls,
} from "../src/pharmacy/pharmacyTechnicalSeoHtmlInspector.ts";
import {
  assertNoTechnicalSeoIndexBlockers,
  auditPublishedTechnicalSeo,
} from "../src/pharmacy/pharmacyTechnicalSeoAuditService.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE_ROOT = "/var/www/pharmaconnect-sites/vision-pharmacy/current";
const PREPARED_ROOT = path.join(ROOT, "artifacts/output/pharmacy-publish/vision-pharmacy");
const CANDIDATE_ROOT = path.join(ROOT, "output/pharmacy-local-page-candidates/vision-pharmacy/pharmacy-first/local");
const LOCALITIES = [
  "oadby",
  "wigston",
  "leicester",
  "hamilton",
  "braunstone",
  "blaby",
  "thurmaston",
  "birstall",
];

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(rel: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
}

function robotsOf(html: string): string {
  const tag = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i)?.[0] || "";
  return tag.match(/\bcontent=["']([^"']+)["']/i)?.[1] || "";
}

function titleOf(html: string): string {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
}

function metaOf(html: string): string {
  return html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || "";
}

function h1Of(html: string): string {
  return (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();
}

function canonicalOf(html: string): string {
  return html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0]?.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
}

function parseJsonLd(html: string): unknown {
  const raw = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  return raw ? JSON.parse(raw) : null;
}

function collectHttpUrls(node: unknown, into: string[] = []): string[] {
  if (typeof node === "string") {
    if (/^https?:\/\//i.test(node)) into.push(node);
    return into;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectHttpUrls(item, into);
    return into;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) collectHttpUrls(value, into);
  }
  return into;
}

function graphNodes(doc: unknown): Record<string, unknown>[] {
  if (!doc || typeof doc !== "object") return [];
  const record = doc as Record<string, unknown>;
  if (Array.isArray(record["@graph"])) {
    return record["@graph"].filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  return [record];
}

function nodeType(node: Record<string, unknown>): string {
  return String(node["@type"] || "");
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
      retentionPolicy: 3,
      lastCleanupAt: null,
    },
    publishingReadiness: "READY TO PUBLISH",
    legacyExternalProfileRef: null,
    migratedAt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function previewLocalityHtml(area: string, serviceId = "travel-vaccinations"): string {
  const generator = `https://example.local/${serviceId}/local/${area}/`;
  return `<!DOCTYPE html><html><head>
<meta name="robots" content="noindex, nofollow"/>
<title>Travel Vaccinations in ${area[0]!.toUpperCase()}${area.slice(1)} | Fixture Pharmacy</title>
<meta name="description" content="Travel vaccinations for patients in ${area}."/>
<link rel="canonical" href="https://fixture-alpha.sites.pharmaconnect.uk/local-${area}/"/>
</head><body>
<h1>Travel Vaccinations in ${area[0]!.toUpperCase()}${area.slice(1)}</h1>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Fixture Pharmacy", item: "https://example.local/" },
          { "@type": "ListItem", position: 2, name: "Travel Vaccinations", item: generator },
          { "@type": "ListItem", position: 3, name: area, item: generator },
        ],
      },
      {
        "@type": "Service",
        name: `Travel Vaccinations ${area}`,
        url: generator,
        provider: { "@type": "MedicalBusiness", name: "Fixture Pharmacy", url: "https://example.local/" },
      },
      {
        "@type": "WebPage",
        "@id": `${generator}#webpage`,
        name: `Travel Vaccinations ${area}`,
        url: generator,
      },
    ],
  })}</script>
<nav><a href="/locations/">Locations</a></nav>
<footer><a href="https://www.customer-pharmacy.example/">Customer website</a></footer>
</body></html>`;
}

async function main() {
  console.log("\n=== Locality structured-data URL authority ===\n");

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/growth-engine/vision-pharmacy-review-centre.json",
    "data/pharmacy-indexing/vision-pharmacy.json",
    "data/pharmacy-registry/vision-pharmacy.json",
    "output/pharmacy-visual-experience/vision-pharmacy/pharmacy-first/index.html",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const sitemapBefore = fs.existsSync(path.join(LIVE_ROOT, "sitemap.xml"))
    ? crypto.createHash("sha256").update(fs.readFileSync(path.join(LIVE_ROOT, "sitemap.xml"))).digest("hex")
    : "";

  const schemaBefore: Record<string, { count: number; webpage: string; types: string[] }> = {};
  for (const area of LOCALITIES) {
    const html = fs.readFileSync(path.join(LIVE_ROOT, `local-${area}`, "index.html"), "utf8");
    const doc = parseJsonLd(html);
    schemaBefore[area] = {
      count: (html.match(/example\.local/g) || []).length,
      webpage: graphNodes(doc).find((node) => nodeType(node) === "WebPage")?.url as string || "",
      types: graphNodes(doc).map(nodeType),
    };
  }

  const tenant = "fixture-alpha";
  const serviceA = "travel-vaccinations";
  const serviceB = "blood-pressure-checks";
  const profileSite = "https://www.customer-pharmacy.example/";
  const pageCanonical = "https://fixture-alpha.sites.pharmaconnect.uk/local-oadby/";
  const serviceCanonical = "https://fixture-alpha.sites.pharmaconnect.uk/travel-vaccinations/";
  const managedProfile = fixtureProfile(tenant);

  const rewritten = applyAuthoritativeStructuredDataUrlsToHtml(previewLocalityHtml("oadby"), {
    slug: tenant,
    serviceId: serviceA,
    publicPath: "/local-oadby/",
    profileWebsite: profileSite,
    managedProfile,
  });
  const rewrittenDoc = parseJsonLd(rewritten);
  const rewrittenNodes = graphNodes(rewrittenDoc);
  const webPage = rewrittenNodes.find((node) => nodeType(node) === "WebPage");
  const serviceNode = rewrittenNodes.find((node) => nodeType(node) === "Service");
  const crumbs = ((rewrittenNodes.find((node) => nodeType(node) === "BreadcrumbList")?.itemListElement || []) as Array<Record<string, unknown>>);
  const business = (serviceNode?.provider as Record<string, unknown> | undefined)?.url;
  const inspected = inspectTechnicalSeoHtml(rewritten);
  const entityUrls = jsonLdPageEntityUrls(inspected);

  record(
    "authoritative-managed-locality-jsonld-uses-managed-canonical",
    webPage?.url === pageCanonical && serviceNode?.url === pageCanonical && entityUrls.every((url) => url === pageCanonical),
    `webpage=${webPage?.url}`,
  );
  record(
    "no-placeholder-host-survives-authoritative-publication",
    !rewritten.includes("example.local") && !rewritten.includes("example.com") && collectHttpUrls(rewrittenDoc).every((url) => !/example\.local|localhost|127\.0\.0\.1/i.test(url)),
    `urls=${collectHttpUrls(rewrittenDoc).join(" | ")}`,
  );
  record(
    "preview-candidate-html-remains-non-production",
    previewLocalityHtml("oadby").includes("https://example.local/travel-vaccinations/local/oadby/") &&
      fs.readFileSync(path.join(CANDIDATE_ROOT, "oadby", "index.html"), "utf8").includes("https://example.local/"),
    "preview/candidate keep example.local",
  );
  record("webpage-url-agrees-with-canonical", webPage?.url === canonicalOf(rewritten) && canonicalOf(rewritten) === pageCanonical, `${webPage?.url} vs ${canonicalOf(rewritten)}`);
  record(
    "service-page-identity-agrees-where-appropriate",
    serviceNode?.url === pageCanonical && crumbs[1]?.item === serviceCanonical,
    `service.url=${serviceNode?.url} breadcrumb2=${crumbs[1]?.item}`,
  );
  record(
    "breadcrumb-page-items-use-authoritative-urls",
    crumbs[0]?.item === profileSite && crumbs[1]?.item === serviceCanonical && crumbs[2]?.item === pageCanonical,
    `crumbs=${crumbs.map((item) => item.item).join(" → ")}`,
  );
  record(
    "schema-id-for-published-page-uses-publication-identity",
    String(webPage?.["@id"] || "").startsWith(pageCanonical.replace(/\/$/, "")),
    `id=${webPage?.["@id"]}`,
  );
  record(
    "legitimate-business-website-not-rewritten",
    business === profileSite && rewritten.includes('href="https://www.customer-pharmacy.example/"'),
    `business=${business}`,
  );

  const verifiedHost = "local.customer-pharmacy.example";
  const verifiedProfile = fixtureProfile(tenant, {
    customerRootDomainConfirmed: true,
    canonicalEcosystemHostname: verifiedHost,
    canonicalEcosystemBaseUrl: `https://${verifiedHost}/`,
    canonicalUrlStatus: "active",
    dnsStatus: "verified",
    sslStatus: "active",
  });
  const verifiedCanonical = resolveAuthoritativePublicationCanonical({
    slug: tenant,
    serviceId: serviceA,
    publicPath: "/local-oadby/",
    profileWebsite: profileSite,
    managedProfile: verifiedProfile,
  }).canonicalUrl;
  const verifiedHtml = applyAuthoritativeStructuredDataUrlsToHtml(previewLocalityHtml("oadby"), {
    slug: tenant,
    serviceId: serviceA,
    publicPath: "/local-oadby/",
    profileWebsite: profileSite,
    managedProfile: verifiedProfile,
  });
  const verifiedPage = graphNodes(parseJsonLd(verifiedHtml)).find((node) => nodeType(node) === "WebPage");
  record(
    "verified-production-domain-uses-verified-canonical",
    verifiedCanonical === `https://${verifiedHost}/local-oadby/` && verifiedPage?.url === verifiedCanonical,
    `${verifiedPage?.url}`,
  );

  const profileOverride = applyAuthoritativeStructuredDataUrlsToHtml(previewLocalityHtml("oadby"), {
    slug: tenant,
    serviceId: serviceA,
    publicPath: "/local-oadby/",
    profileWebsite: profileSite,
    managedProfile,
    storedCanonicalUrl: "https://www.customer-pharmacy.example/travel-vaccinations/local/oadby/",
  });
  const overridePage = graphNodes(parseJsonLd(profileOverride)).find((node) => nodeType(node) === "WebPage");
  record(
    "profile-website-cannot-override-managed-page-identity",
    overridePage?.url === pageCanonical && !String(overridePage?.url || "").includes("www.customer-pharmacy.example"),
    `${overridePage?.url}`,
  );

  const wigstonHtml = applyAuthoritativeStructuredDataUrlsToHtml(previewLocalityHtml("oadby"), {
    slug: tenant,
    serviceId: serviceA,
    publicPath: "/local-wigston/",
    profileWebsite: profileSite,
    managedProfile,
  });
  const wigstonPageUrl = graphNodes(parseJsonLd(wigstonHtml)).find((node) => nodeType(node) === "WebPage")?.url;
  const wigstonJsonUrls = collectHttpUrls(parseJsonLd(wigstonHtml));
  record(
    "locality-a-cannot-receive-locality-b-url",
    wigstonPageUrl === "https://fixture-alpha.sites.pharmaconnect.uk/local-wigston/" &&
      wigstonJsonUrls.every((url) => !url.includes("/local-oadby/")),
    String(wigstonPageUrl),
  );

  const betaHtml = applyAuthoritativeStructuredDataUrlsToHtml(previewLocalityHtml("oadby"), {
    slug: "fixture-beta",
    serviceId: serviceA,
    publicPath: "/local-oadby/",
    profileWebsite: profileSite,
    managedProfile: fixtureProfile("fixture-beta"),
  });
  const betaPageUrl = graphNodes(parseJsonLd(betaHtml)).find((node) => nodeType(node) === "WebPage")?.url;
  const betaJsonUrls = collectHttpUrls(parseJsonLd(betaHtml));
  record(
    "tenant-a-cannot-receive-tenant-b-url",
    String(betaPageUrl || "").includes("fixture-beta.sites.pharmaconnect.uk") &&
      betaJsonUrls.every((url) => !url.includes("fixture-alpha.sites.pharmaconnect.uk")),
    String(betaPageUrl),
  );

  const otherServiceHtml = applyAuthoritativeStructuredDataUrlsToHtml(previewLocalityHtml("oadby", serviceB), {
    slug: tenant,
    serviceId: serviceB,
    publicPath: "/local-oadby/",
    profileWebsite: profileSite,
    managedProfile,
  });
  const otherCrumbs = (graphNodes(parseJsonLd(otherServiceHtml)).find((node) => nodeType(node) === "BreadcrumbList")?.itemListElement || []) as Array<Record<string, unknown>>;
  record(
    "service-a-cannot-receive-service-b-url",
    otherCrumbs[1]?.item === `https://fixture-alpha.sites.pharmaconnect.uk/${serviceB}/` &&
      !String(otherCrumbs[1]?.item || "").includes(serviceA),
    `breadcrumb2=${otherCrumbs[1]?.item}`,
  );

  const publishRewritten = rewritePublishHtmlForStaticHosting(previewLocalityHtml("oadby"), tenant, serviceA, "/local-oadby/");
  record(
    "publish-rewrite-uses-same-canonical-authority",
      graphNodes(parseJsonLd(publishRewritten)).find((node) => nodeType(node) === "WebPage")?.url ===
      resolveAuthoritativePublicationCanonical({ slug: tenant, serviceId: serviceA, publicPath: "/local-oadby/", managedProfile, profileWebsite: null }).canonicalUrl &&
      !publishRewritten.includes('href="/locations/"'),
    "rewrite + locations not leaked",
  );

  const businessIdentity = resolvePublishedBusinessIdentityUrl({
    slug: tenant,
    serviceId: serviceA,
    publicPath: "/local-oadby/",
    profileWebsite: profileSite,
    managedProfile,
  });
  record("business-identity-resolver-keeps-customer-website", businessIdentity === profileSite, businessIdentity);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "schema-url-authority-"));
  fs.mkdirSync(path.join(tmp, "local-oadby"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "local-wigston"), { recursive: true });
  fs.mkdirSync(path.join(tmp, serviceA), { recursive: true });
  fs.writeFileSync(path.join(tmp, "local-oadby", "index.html"), previewLocalityHtml("oadby"), "utf8");
  fs.writeFileSync(path.join(tmp, "local-wigston", "index.html"), previewLocalityHtml("wigston"), "utf8");
  fs.writeFileSync(
    path.join(tmp, serviceA, "index.html"),
    `<html><head><link rel="canonical" href="${serviceCanonical}"/><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", url: "https://example.local/travel-vaccinations/" },
        { "@type": "MedicalBusiness", url: profileSite },
      ],
    })}</script></head><body><a href="/locations/">Locations</a></body></html>`,
    "utf8",
  );
  applyAuthoritativeCanonicalToHtmlTree(tmp, tenant, serviceA);
  const oadbyTree = fs.readFileSync(path.join(tmp, "local-oadby", "index.html"), "utf8");
  const wigstonTree = fs.readFileSync(path.join(tmp, "local-wigston", "index.html"), "utf8");
  const serviceTree = fs.readFileSync(path.join(tmp, serviceA, "index.html"), "utf8");
  record(
    "tree-overlay-isolates-locality-and-service-urls",
    graphNodes(parseJsonLd(oadbyTree)).find((node) => nodeType(node) === "WebPage")?.url === pageCanonical &&
      graphNodes(parseJsonLd(wigstonTree)).find((node) => nodeType(node) === "WebPage")?.url ===
        "https://fixture-alpha.sites.pharmaconnect.uk/local-wigston/" &&
      graphNodes(parseJsonLd(serviceTree)).find((node) => nodeType(node) === "WebPage")?.url === serviceCanonical &&
      graphNodes(parseJsonLd(serviceTree)).find((node) => nodeType(node) === "MedicalBusiness")?.url === profileSite,
    "oadby/wigston/service isolated",
  );
  fs.rmSync(tmp, { recursive: true, force: true });

  const liveOverlay = applyAuthoritativeCanonicalToHtmlTree(LIVE_ROOT, "vision-pharmacy", "pharmacy-first");
  const preparedOverlay = applyAuthoritativeCanonicalToHtmlTree(PREPARED_ROOT, "vision-pharmacy", "pharmacy-first");
  record(
    "bounded-live-schema-overlay",
    liveOverlay.filesScanned >= 9 && preparedOverlay.filesScanned >= 9,
    `live=${liveOverlay.filesUpdated}/${liveOverlay.filesScanned} prepared=${preparedOverlay.filesUpdated}/${preparedOverlay.filesScanned}`,
  );

  let robotsPass = true;
  let titlesMetaH1Unchanged = true;
  let exampleAfter = 0;
  let schemaAgree = true;
  let jsonLdParse = true;
  const afterUrls: string[] = [];
  const typesFound = new Set<string>();
  for (const area of LOCALITIES) {
    const html = fs.readFileSync(path.join(LIVE_ROOT, `local-${area}`, "index.html"), "utf8");
    const expectedTitle = `Pharmacy First in ${area[0]!.toUpperCase()}${area.slice(1)} | Vision Pharmacy`;
    if (robotsOf(html) !== "index, follow") robotsPass = false;
    if (titleOf(html) !== expectedTitle) titlesMetaH1Unchanged = false;
    if (!metaOf(html).toLowerCase().includes(area)) titlesMetaH1Unchanged = false;
    if (!h1Of(html).toLowerCase().includes(area)) titlesMetaH1Unchanged = false;
    exampleAfter += (html.match(/example\.local/g) || []).length;
    const canonical = canonicalOf(html);
    if (canonical !== `https://vision-pharmacy.sites.pharmaconnect.uk/local-${area}/`) schemaAgree = false;
    try {
      const doc = parseJsonLd(html);
      for (const node of graphNodes(doc)) typesFound.add(nodeType(node));
      const webpageUrl = graphNodes(doc).find((node) => nodeType(node) === "WebPage")?.url;
      const serviceUrl = graphNodes(doc).find((node) => nodeType(node) === "Service")?.url;
      const providerUrl = (graphNodes(doc).find((node) => nodeType(node) === "Service")?.provider as Record<string, unknown> | undefined)?.url;
      afterUrls.push(`${area}:${webpageUrl}`);
      if (webpageUrl !== canonical || serviceUrl !== canonical) schemaAgree = false;
      if (providerUrl !== "https://www.visionpharmacy.com/") schemaAgree = false;
      if (collectHttpUrls(doc).some((url) => /example\.local/i.test(url))) schemaAgree = false;
    } catch {
      jsonLdParse = false;
    }
  }
  record("vision-eight-robots-remain-index-follow", robotsPass, "index, follow");
  record("vision-titles-meta-h1-unchanged", titlesMetaH1Unchanged, "titles/meta/H1 intact");
  record(
    "vision-example-local-cleared",
    exampleAfter === 0 &&
      LOCALITIES.every((area) => !schemaBefore[area]!.webpage.includes("example.local") || schemaBefore[area]!.count > 0),
    `before=${LOCALITIES.map((area) => schemaBefore[area]!.count).reduce((a, b) => a + b, 0)} after=${exampleAfter}`,
  );
  record("vision-jsonld-parse", jsonLdParse, jsonLdParse ? "all 8 parse" : "parse failed");
  record("vision-schema-canonical-agreement", schemaAgree, afterUrls.join(" | "));

  const sitemapAfter = crypto.createHash("sha256").update(fs.readFileSync(path.join(LIVE_ROOT, "sitemap.xml"))).digest("hex");
  record("sitemap-unchanged", sitemapBefore === sitemapAfter, sitemapBefore === sitemapAfter ? "sitemap hash unchanged" : "sitemap changed");

  const audit = await auditPublishedTechnicalSeo({ slug: "vision-pharmacy", serviceId: "pharmacy-first", fetchLive: true });
  const localityPages = audit.pages.filter((page) => page.pageType === "locality");
  const remaining = [...new Set(localityPages.flatMap((page) => page.blockers.map((item) => item.code)))];
  record(
    "vision-index-counts",
    audit.intendedIndexableUrls === 9 && audit.eligibleCount + audit.blockedCount === 9,
    `intended=${audit.intendedIndexableUrls} eligible=${audit.eligibleCount} blocked=${audit.blockedCount}`,
  );
  record(
    "schema-placeholder-not-reintroduced",
    !remaining.includes("schema_placeholder_url") &&
      !remaining.includes("accidental_noindex") &&
      localityPages.every((page) => page.httpStatus === 200),
    `codes=${remaining.join(",") || "none"}`,
  );

  let gateThrew = false;
  try {
    assertNoTechnicalSeoIndexBlockers(audit);
  } catch {
    gateThrew = true;
  }
  record("indexing-gate-matches-blockers", gateThrew === audit.blockedCount > 0, `threw=${gateThrew} blocked=${audit.blockedCount}`);

  const indexing = JSON.parse(fs.readFileSync(path.join(ROOT, "data/pharmacy-indexing/vision-pharmacy.json"), "utf8")) as { submitted?: number };
  record("nothing-submitted-for-indexing", (indexing.submitted || 0) === 0, `submitted=${indexing.submitted || 0}`);
  const areas = explicitConfirmedLocalityNames(readSetupProfile("vision-pharmacy").selectedAreas);
  record("vision-areas-unchanged", areas.length === 8, `areas=${areas.length}`);
  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const changed = hashed.filter((rel) => before[rel] !== after[rel]);
  record("vision-protected-hashes-unchanged", changed.length === 0, changed.length ? changed.join(", ") : "protected Vision files unchanged");

  console.log("\nschema URL before → after");
  for (const area of LOCALITIES) {
    const html = fs.readFileSync(path.join(LIVE_ROOT, `local-${area}`, "index.html"), "utf8");
    const webpage = graphNodes(parseJsonLd(html)).find((node) => nodeType(node) === "WebPage")?.url;
    console.log(`  ${area}: ${schemaBefore[area]!.webpage} → ${webpage}`);
  }
  console.log(`structured-data types: ${[...typesFound].join(", ")}`);

  const failed = checks.filter((item) => !item.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((item) => item.pass).length}/${checks.length} checks`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
