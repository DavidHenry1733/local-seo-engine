#!/usr/bin/env npx tsx
/**
 * CP02 canonical campaign membership.
 * Readers must use campaign.campaignAreas[].areaSlug and must not rewrite operational state.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { resolveCampaignPublishingContentApproval } from "../src/pharmacy/masterAdminCampaignPublishingApprovalResolver.ts";
import { resolveProductOwnerCampaignContentPresentation } from "../src/pharmacy/masterAdminProductOwnerCampaignContentPresentation.ts";
import {
  resolveCanonicalCampaignIdForService,
  resolveCanonicalCampaignMembership,
} from "../src/pharmacy/canonicalCampaignLifecycleResolver.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const TENANTS = {
  brook: {
    slug: "brook-pharmacy-demo-derby",
    campaignId: "caf83fc0-9b8a-40a9-85f9-f79b99b094c5",
    serviceId: "pharmacy-first",
  },
  yorkshire: {
    slug: "yorkshire-pharmacy-and-health-clinic",
    campaignId: "f0792269-9f9e-4221-b851-495db93cf6a6",
    serviceId: "pharmacy-first",
  },
  leeds: {
    slug: "leeds-pharmacy",
    campaignId: "71b30b61-ef4e-4f60-911c-b0f0b1424ee8",
    serviceId: "pharmacy-first",
  },
  vision: {
    slug: "vision-pharmacy",
    campaignId: "c6b16251-291c-4879-b143-ced92de37312",
    serviceId: "pharmacy-first",
  },
  banner: {
    slug: "banner-cross-pharmacy",
    campaignId: "bdc9d7d1-f757-4812-99c1-44b6e03ea789",
    serviceId: "pharmacy-first",
  },
} as const;

const FIXTURE_SLUG = "cp02-membership-fixture-tenant";
const FIXTURE_CAMPAIGN = "11111111-2222-4333-8444-555555555555";
const FIXTURE_SERVICE = "blood-pressure-checks";
const FIXTURE_AREAS = ["north-ward", "south-ward"];

const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

function hashTree(slug: string): string {
  const roots = [
    `data/pharmacy-campaigns/${slug}.json`,
    `data/pharmacy-content-packages/${slug}`,
    `data/pharmacy-local-page-campaign-runs/${slug}`,
    `data/pharmacy-ai-local-copy-pilots/${slug}`,
    `data/pharmacy-ai-local-copy-candidates/${slug}`,
    `data/pharmacy-ai-local-copy-checkpoints/${slug}`,
    `data/pharmacy-ai-local-copy-decisions/${slug}`,
    `data/pharmacy-master-admin/service-page-review/${slug}`,
    `data/pharmacy-master-admin/cluster-page-review/${slug}`,
    `data/growth-engine/${slug}-campaign-builder.json`,
    `output/pharmacy-content-ecosystem/${slug}`,
    `output/pharmacy-visual-experience/${slug}`,
    `output/pharmacy-publish/${slug}/_publish-index.json`,
    `output/pharmacy-publish/${slug}/sitemap.xml`,
    `data/pharmacy-indexing/${slug}.json`,
    `data/pharmacy-visibility/${slug}.json`,
    `data/pharmacy-search-console-authority/${slug}.json`,
    `output/${slug}/gsc-summary.json`,
    `output/${slug}/rank-tracking.json`,
    `output/${slug}/index-dashboard.json`,
  ];
  const files: string[] = [];
  for (const relative of roots) {
    const full = path.join(PHARMACY_WORKSPACE_ROOT, relative);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isFile()) files.push(full);
    else collect(full, files);
  }
  files.sort();
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(path.relative(PHARMACY_WORKSPACE_ROOT, file));
    hash.update("\0");
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function collect(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

function same(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function run(): void {
  const slugs = Object.values(TENANTS).map((tenant) => tenant.slug);
  const before = Object.fromEntries(slugs.map((slug) => [slug, hashTree(slug)]));
  const summary: Record<string, unknown> = {};

  const brook = resolveCanonicalCampaignMembership({
    tenantSlug: TENANTS.brook.slug,
    campaignId: TENANTS.brook.campaignId,
  });
  const brookReview = buildCommercialQualityReview(TENANTS.brook.slug);
  const brookPresentation = resolveProductOwnerCampaignContentPresentation({
    slug: TENANTS.brook.slug,
    campaignId: TENANTS.brook.campaignId,
    serviceId: TENANTS.brook.serviceId,
  });
  const brookPublishing = resolveCampaignPublishingContentApproval(TENANTS.brook.slug, {
    campaignId: TENANTS.brook.campaignId,
    serviceId: TENANTS.brook.serviceId,
  });
  assert(brook.areaSlugs.length === 10, `Brook canonical ${brook.areaSlugs.length}`);
  assert(brook.localityStates.every((area) => area.contentState === "PRESENT"), "Brook canonical locality is missing");
  assert(brook.unattachedAreaSlugs.length === 0, "Brook rendered output fell outside membership");
  assert(brook.packageAreaSlugs?.length === 0, "Brook package areas were rewritten into membership");
  assert(brook.expectedWebsitePages === 11, `Brook page total ${brook.expectedWebsitePages}`);
  assert(brookReview.contentTotals.websitePages === 11, `Brook QR website ${brookReview.contentTotals.websitePages}`);
  assert(brookReview.contentTotals.servicePages === 1, `Brook QR service ${brookReview.contentTotals.servicePages}`);
  assert(brookReview.contentTotals.locationPages === 10, `Brook QR location ${brookReview.contentTotals.locationPages}`);
  assert(brookPresentation.localityGeneratedCount === 10, `Brook denominator ${brookPresentation.localityGeneratedCount}`);
  assert(brookPresentation.localityApprovedCount === 0, `Brook approvals changed to ${brookPresentation.localityApprovedCount}`);
  assert(brookPublishing.localityExpectedCount === 10, `Brook publishing denominator ${brookPublishing.localityExpectedCount}`);
  assert(brookPublishing.localityApprovedCount === 0, "Brook publishing approval count changed");
  assert(brookPublishing.approved === false, "Brook publishing became ready");
  assert(brookReview.summary.publishingReadiness === "Blocked", "Brook Quality Review publishing opened");
  summary.brook = {
    canonical: brook.areaSlugs.length,
    present: brook.localityStates.filter((area) => area.contentState === "PRESENT").length,
    package: brook.packageAreaSlugs?.length ?? null,
    qr: brookReview.contentTotals,
    denominator: `${brookPresentation.localityApprovedCount}/${brookPresentation.localityGeneratedCount}`,
    publishingBlocked: brookPublishing.approved === false,
  };

  const yorkshire = resolveCanonicalCampaignMembership({
    tenantSlug: TENANTS.yorkshire.slug,
    campaignId: TENANTS.yorkshire.campaignId,
  });
  const yorkshirePresentation = resolveProductOwnerCampaignContentPresentation({
    slug: TENANTS.yorkshire.slug,
    campaignId: TENANTS.yorkshire.campaignId,
    serviceId: TENANTS.yorkshire.serviceId,
  });
  assert(yorkshire.areaSlugs.length === 8, `Yorkshire canonical ${yorkshire.areaSlugs.length}`);
  assert(!yorkshire.areaSlugs.includes("chapeltown") && !yorkshire.areaSlugs.includes("royston"), "Yorkshire extra areas joined membership");
  assert(yorkshire.unattachedAreaSlugs.includes("chapeltown") && yorkshire.unattachedAreaSlugs.includes("royston"), "Yorkshire extra outputs were hidden");
  assert(yorkshirePresentation.localityGeneratedCount === 8, `Yorkshire denominator ${yorkshirePresentation.localityGeneratedCount}`);
  assert((yorkshire.packageAreaSlugs?.length || 0) === 10, "Yorkshire package evidence disappeared");
  summary.yorkshire = {
    canonical: yorkshire.areaSlugs.length,
    package: yorkshire.packageAreaSlugs?.length ?? null,
    unattached: yorkshire.unattachedAreaSlugs,
    denominator: `${yorkshirePresentation.localityApprovedCount}/${yorkshirePresentation.localityGeneratedCount}`,
    publishingReady: yorkshirePresentation.publishing.ready,
  };

  const leeds = resolveCanonicalCampaignMembership({
    tenantSlug: TENANTS.leeds.slug,
    campaignId: TENANTS.leeds.campaignId,
  });
  const leedsPresentation = resolveProductOwnerCampaignContentPresentation({
    slug: TENANTS.leeds.slug,
    campaignId: TENANTS.leeds.campaignId,
    serviceId: TENANTS.leeds.serviceId,
  });
  assert(leeds.areaSlugs.length === 0, `Leeds canonical ${leeds.areaSlugs.length}`);
  assert(leeds.unattachedAreaSlugs.some((area) => area.startsWith("cluster-")), "Leeds cluster output became canonical");
  assert(leeds.areaSlugs.every((area) => !area.startsWith("cluster-")), "Leeds membership contains a cluster slug");
  assert((leeds.packageAreaSlugs?.length || 0) === 8, "Leeds package evidence disappeared");
  assert(leedsPresentation.localityGeneratedCount === 0, `Leeds denominator followed rendered folders ${leedsPresentation.localityGeneratedCount}`);
  summary.leeds = {
    canonical: leeds.areaSlugs.length,
    package: leeds.packageAreaSlugs?.length ?? null,
    unattached: leeds.unattachedAreaSlugs.length,
    denominator: leedsPresentation.localityGeneratedCount,
  };

  const vision = resolveCanonicalCampaignMembership({
    tenantSlug: TENANTS.vision.slug,
    campaignId: TENANTS.vision.campaignId,
  });
  const visionPresentation = resolveProductOwnerCampaignContentPresentation({
    slug: TENANTS.vision.slug,
    campaignId: TENANTS.vision.campaignId,
    serviceId: TENANTS.vision.serviceId,
  });
  assert(vision.areaSlugs.length === 8, `Vision canonical ${vision.areaSlugs.length}`);
  assert(vision.areaSlugs.includes("leicester"), "Vision dropped Leicester");
  assert(vision.localityStates.find((area) => area.areaSlug === "leicester")?.contentState === "MISSING", "Vision Leicester was marked present");
  assert(visionPresentation.localityGeneratedCount === 8, `Vision denominator shrank to ${visionPresentation.localityGeneratedCount}`);
  assert((vision.packageAreaSlugs?.length || 0) === 1, "Vision package evidence disappeared");
  summary.vision = {
    canonical: vision.areaSlugs.length,
    missing: vision.localityStates.filter((area) => area.contentState === "MISSING").map((area) => area.areaSlug),
    package: vision.packageAreaSlugs?.length ?? null,
    denominator: visionPresentation.localityGeneratedCount,
  };

  const banner = resolveCanonicalCampaignMembership({
    tenantSlug: TENANTS.banner.slug,
    campaignId: TENANTS.banner.campaignId,
  });
  const bannerPublishing = resolveCampaignPublishingContentApproval(TENANTS.banner.slug, {
    campaignId: TENANTS.banner.campaignId,
    serviceId: TENANTS.banner.serviceId,
  });
  const publishIndex = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-publish", TENANTS.banner.slug, "_publish-index.json");
  assert(banner.areaSlugs.length === 0, `Banner canonical ${banner.areaSlugs.length}`);
  assert(banner.unattachedAreaSlugs.length > 0, "Banner rendered pages were absorbed into membership");
  assert(fs.existsSync(publishIndex), "Banner publish index disappeared");
  assert(bannerPublishing.localityExpectedCount === 0, "Banner publishing denominator followed the publish index");
  assert(bannerPublishing.approved === false, "Banner publishing mismatch was cleared");
  summary.banner = {
    canonical: banner.areaSlugs.length,
    unattached: banner.unattachedAreaSlugs.length,
    publishingExpected: bannerPublishing.localityExpectedCount,
    publishingApproved: bannerPublishing.approved,
    blockers: bannerPublishing.blockers,
  };

  const fixtureDir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns");
  const fixtureFile = path.join(fixtureDir, `${FIXTURE_SLUG}.json`);
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    fixtureFile,
    JSON.stringify({
      version: 1,
      slug: FIXTURE_SLUG,
      updatedAt: "2026-09-27T00:00:00.000Z",
      campaigns: [
        {
          id: FIXTURE_CAMPAIGN,
          name: "Fixture",
          serviceId: FIXTURE_SERVICE,
          serviceName: "Blood pressure checks",
          status: "active",
          campaignAreas: FIXTURE_AREAS.map((areaSlug, index) => ({
            areaName: areaSlug,
            areaSlug,
            selected: true,
            source: "cp02-fixture",
            priority: index + 1,
          })),
        },
      ],
    }, null, 2),
  );
  try {
    const fixtureMembership = resolveCanonicalCampaignMembership({
      tenantSlug: FIXTURE_SLUG,
      campaignId: FIXTURE_CAMPAIGN,
    });
    const fixturePresentation = resolveProductOwnerCampaignContentPresentation({
      slug: FIXTURE_SLUG,
      campaignId: FIXTURE_CAMPAIGN,
      serviceId: FIXTURE_SERVICE,
    });
    const fixturePublishing = resolveCampaignPublishingContentApproval(FIXTURE_SLUG, {
      campaignId: FIXTURE_CAMPAIGN,
      serviceId: FIXTURE_SERVICE,
    });
    const resolvedId = resolveCanonicalCampaignIdForService(FIXTURE_SLUG, FIXTURE_SERVICE, null);
    assert(resolvedId === FIXTURE_CAMPAIGN, `Fixture campaign id ${resolvedId}`);
    assert(same(fixtureMembership.areaSlugs, FIXTURE_AREAS), `Fixture membership ${fixtureMembership.areaSlugs.join(",")}`);
    assert(fixtureMembership.localityStates.every((area) => area.contentState === "MISSING"), "Fixture invented rendered pages");
    assert(fixturePresentation.localityGeneratedCount === FIXTURE_AREAS.length, "Fixture presentation used another locality source");
    assert(fixturePresentation.localityApprovedCount === 0, "Fixture presentation invented approvals");
    assert(fixturePublishing.localityExpectedCount === FIXTURE_AREAS.length, "Fixture publishing used another locality source");
    assert(fixturePublishing.approved === false, "Fixture publishing became ready without content");
    assert(
      fixturePublishing.blockers.some((blocker) => blocker.startsWith("Missing canonical locality pages:")),
      "Fixture missing localities were dropped",
    );
    summary.fixture = {
      membership: fixtureMembership.areaSlugs,
      presentation: fixturePresentation.localityGeneratedCount,
      publishing: fixturePublishing.localityExpectedCount,
      same: same(fixtureMembership.areaSlugs, FIXTURE_AREAS),
    };
  } finally {
    if (fs.existsSync(fixtureFile)) fs.unlinkSync(fixtureFile);
  }
  assert(!fs.existsSync(fixtureFile), "Fixture campaign file was left behind");

  const after = Object.fromEntries(slugs.map((slug) => [slug, hashTree(slug)]));
  const writeProtection = slugs.map((slug) => ({
    slug,
    before: before[slug],
    after: after[slug],
    unchanged: before[slug] === after[slug],
  }));
  for (const row of writeProtection) assert(row.unchanged, `${row.slug} operational state changed`);
  summary.writeProtection = writeProtection;
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("PASS cp02 membership, 0 failures");
}

run();
