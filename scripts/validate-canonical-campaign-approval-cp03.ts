#!/usr/bin/env npx tsx
/**
 * CP03 canonical approval authority.
 * Fixture writes stay on an isolated tenant. Historical pharmacies are read-only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import {
  CANONICAL_PAGE_REVISION_INPUTS,
  hashPublishablePageBytes,
  resolveCanonicalPageContentRevision,
} from "../src/pharmacy/canonicalCampaignContentRevision.ts";
import {
  canonicalApprovalStorePath,
  recordCanonicalCampaignPageDecision,
  resolveCanonicalCampaignApproval,
  resolveCanonicalPageApproval,
  resolveReviewCentreCampaignPage,
} from "../src/pharmacy/canonicalCampaignApprovalService.ts";
import { resolveCampaignPublishingContentApproval } from "../src/pharmacy/masterAdminCampaignPublishingApprovalResolver.ts";
import { resolveProductOwnerCampaignContentPresentation } from "../src/pharmacy/masterAdminProductOwnerCampaignContentPresentation.ts";
import { approveReviewCentreAsset } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { decideLocalityPageReview } from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import { SERVICE_PAGE_CANDIDATE_KEY } from "../src/pharmacy/growthEngineReviewCentreService.ts";

const FIXTURE = "cp03-approval-fixture-tenant";
const CAMPAIGN = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SERVICE = "blood-pressure-checks";
const AREAS = ["north-ward", "south-ward"] as const;

const HISTORICAL = [
  { slug: "brook-pharmacy-demo-derby", campaignId: "caf83fc0-9b8a-40a9-85f9-f79b99b094c5", localities: 10 },
  { slug: "yorkshire-pharmacy-and-health-clinic", campaignId: "f0792269-9f9e-4221-b851-495db93cf6a6", localities: 8 },
  { slug: "leeds-pharmacy", campaignId: "71b30b61-ef4e-4f60-911c-b0f0b1424ee8", localities: 0 },
  { slug: "vision-pharmacy", campaignId: "c6b16251-291c-4879-b143-ced92de37312", localities: 8 },
  { slug: "banner-cross-pharmacy", campaignId: "bdc9d7d1-f757-4812-99c1-44b6e03ea789", localities: 0 },
] as const;

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
    `data/pharmacy-master-admin/canonical-campaign-approval/${slug}`,
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

function pagePath(kind: "service" | "locality", area?: string): string {
  if (kind === "service") {
    return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", FIXTURE, SERVICE, "index.html");
  }
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", FIXTURE, SERVICE, "local", area || "", "index.html");
}

function writePage(kind: "service" | "locality", body: string, area?: string): void {
  const file = pagePath(kind, area);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function readersAgree(area: typeof AREAS[number] | null, expected: string): void {
  const page = resolveCanonicalPageApproval({
    tenantSlug: FIXTURE,
    campaignId: CAMPAIGN,
    serviceId: SERVICE,
    pageType: area ? "locality" : "service",
    areaSlug: area,
  });
  const publishing = resolveCampaignPublishingContentApproval(FIXTURE, { campaignId: CAMPAIGN, serviceId: SERVICE });
  const presentation = resolveProductOwnerCampaignContentPresentation({
    slug: FIXTURE,
    campaignId: CAMPAIGN,
    serviceId: SERVICE,
  });
  const reviewAsset = area ? `ai-local-area-page-pilot-v3:${area}` : SERVICE_PAGE_CANDIDATE_KEY;
  const reviewPage = resolveReviewCentreCampaignPage({
    tenantSlug: FIXTURE,
    campaignOrServiceId: SERVICE,
    assetKey: reviewAsset,
  });
  const review = reviewPage
    ? resolveCanonicalPageApproval({
        tenantSlug: FIXTURE,
        campaignId: reviewPage.campaignId,
        serviceId: reviewPage.serviceId,
        pageType: reviewPage.pageType,
        areaSlug: reviewPage.areaSlug,
      })
    : null;
  assert(page.decision === expected, `${area || "service"} canonical ${page.decision} != ${expected}`);
  assert(review?.decision === expected, `${area || "service"} review centre ${review?.decision} != ${expected}`);
  if (!area) {
    assert(publishing.servicePageApproved === (expected === "APPROVED"), `publishing service ${publishing.servicePageApproved}`);
    assert(presentation.serviceApproved === (expected === "APPROVED"), `campaign card service ${presentation.serviceApproved}`);
  }
}

function cleanup(): void {
  const paths = [
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-campaign-approval", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/cluster-page-review", FIXTURE),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/growth-engine", `${FIXTURE}-campaign-builder.json`),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/growth-engine", `${FIXTURE}-review-centre.json`),
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${FIXTURE}.json`),
  ];
  for (const target of paths) {
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function run(): void {
  const before = Object.fromEntries(HISTORICAL.map((tenant) => [tenant.slug, hashTree(tenant.slug)]));
  assert(CANONICAL_PAGE_REVISION_INPUTS.length === 2, "revision inputs were not reported");
  const same = hashPublishablePageBytes(Buffer.from("alpha"));
  assert(same === hashPublishablePageBytes(Buffer.from("alpha")), "revision is not deterministic");
  assert(same !== hashPublishablePageBytes(Buffer.from("beta")), "revision ignored a content change");

  cleanup();
  fs.mkdirSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns"), { recursive: true });
  fs.writeFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`),
    JSON.stringify({
      version: 1,
      slug: FIXTURE,
      campaigns: [{
        id: CAMPAIGN,
        name: "Fixture",
        serviceId: SERVICE,
        serviceName: "Blood pressure checks",
        status: "active",
        campaignAreas: AREAS.map((areaSlug, index) => ({
          areaName: areaSlug,
          areaSlug,
          selected: true,
          source: "cp03-fixture",
          priority: index + 1,
        })),
      }],
    }, null, 2),
  );
  fs.writeFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${FIXTURE}.json`),
    JSON.stringify({ slug: FIXTURE, data: { pharmacyName: "Fixture Pharmacy", tradingName: "Fixture Pharmacy" } }, null, 2),
  );
  writePage("service", "<html><title>Service revision A</title><p>Service body alpha.</p></html>");
  writePage("locality", "<html><title>North A</title><p>North ward body alpha is unique.</p></html>", "north-ward");
  writePage("locality", "<html><title>South A</title><p>South ward body alpha is different.</p></html>", "south-ward");

  try {
    const initial = resolveCanonicalCampaignApproval({ tenantSlug: FIXTURE, campaignId: CAMPAIGN });
    assert(initial.service?.decision === "PENDING", `new service started ${initial.service?.decision}`);
    assert(initial.localities.every((page) => page.decision === "PENDING"), "new localities did not start unapproved");
    const blocked = resolveCampaignPublishingContentApproval(FIXTURE, { campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(blocked.approved === false, "new campaign publishing was ready before approval");

    approveReviewCentreAsset(FIXTURE, CAMPAIGN, SERVICE_PAGE_CANDIDATE_KEY);
    approveReviewCentreAsset(FIXTURE, SERVICE, "ai-local-area-page-pilot-v3:north-ward");
    readersAgree(null, "APPROVED");
    readersAgree("north-ward", "APPROVED");
    readersAgree("south-ward", "PENDING");
    const mid = resolveCampaignPublishingContentApproval(FIXTURE, { campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(mid.approved === false, "publishing became ready before every locality was approved");

    decideLocalityPageReview(FIXTURE, "south-ward", "approved", "cp03-fixture", {
      campaignId: CAMPAIGN,
      serviceId: SERVICE,
    });
    const south = resolveCanonicalPageApproval({
      tenantSlug: FIXTURE,
      campaignId: CAMPAIGN,
      serviceId: SERVICE,
      pageType: "locality",
      areaSlug: "south-ward",
    });
    assert(south.decision === "APPROVED" && south.source === "master-admin", `master admin write ${south.decision}/${south.source}`);
    readersAgree("south-ward", "APPROVED");
    const presentation = resolveProductOwnerCampaignContentPresentation({
      slug: FIXTURE,
      campaignId: CAMPAIGN,
      serviceId: SERVICE,
    });
    const ready = resolveCampaignPublishingContentApproval(FIXTURE, { campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(presentation.localityApprovedCount === 2, `campaign card approvals ${presentation.localityApprovedCount}`);
    assert(presentation.serviceApproved === true, "campaign card service approval diverged");
    assert(ready.approved === true, `publishing stayed blocked: ${ready.blockers.join(" | ")}`);
    assert(ready.localityApprovedCount === 2 && ready.localityExpectedCount === 2, "publishing denominator diverged");

    const revisionA = resolveCanonicalPageContentRevision({
      tenantSlug: FIXTURE,
      serviceId: SERVICE,
      pageType: "locality",
      areaSlug: "south-ward",
    }).contentRevision;
    writePage("locality", "<html><title>South B</title><p>South ward body beta replaced the approved copy.</p></html>", "south-ward");
    const revisionB = resolveCanonicalPageContentRevision({
      tenantSlug: FIXTURE,
      serviceId: SERVICE,
      pageType: "locality",
      areaSlug: "south-ward",
    }).contentRevision;
    assert(revisionA && revisionB && revisionA !== revisionB, "content change did not create a new revision");
    const stale = resolveCanonicalPageApproval({
      tenantSlug: FIXTURE,
      campaignId: CAMPAIGN,
      serviceId: SERVICE,
      pageType: "locality",
      areaSlug: "south-ward",
    });
    assert(stale.decision === "STALE", `changed locality stayed ${stale.decision}`);
    const store = JSON.parse(fs.readFileSync(canonicalApprovalStorePath(FIXTURE, CAMPAIGN), "utf8")) as {
      decisions: Array<{ contentRevision: string; areaSlug: string | null }>;
    };
    assert(store.decisions.some((decision) => decision.contentRevision === revisionA), "revision A approval was deleted");
    readersAgree("north-ward", "APPROVED");
    readersAgree(null, "APPROVED");
    const blockedAgain = resolveCampaignPublishingContentApproval(FIXTURE, { campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(blockedAgain.approved === false, "publishing stayed ready after the content change");
    assert(
      blockedAgain.blockers.some((blocker) => /stale/i.test(blocker)),
      `stale approval did not block publishing: ${blockedAgain.blockers.join(" | ")}`,
    );

    approveReviewCentreAsset(FIXTURE, CAMPAIGN, "ai-local-area-page-pilot-v3:south-ward");
    readersAgree("south-ward", "APPROVED");
    const readyAgain = resolveCampaignPublishingContentApproval(FIXTURE, { campaignId: CAMPAIGN, serviceId: SERVICE });
    assert(readyAgain.approved === true, `publishing did not recover: ${readyAgain.blockers.join(" | ")}`);
    const preserved = JSON.parse(fs.readFileSync(canonicalApprovalStorePath(FIXTURE, CAMPAIGN), "utf8")) as {
      decisions: Array<{ contentRevision: string }>;
    };
    assert(preserved.decisions.some((decision) => decision.contentRevision === revisionA), "revision A history was overwritten");

    const direct = recordCanonicalCampaignPageDecision({
      tenantSlug: FIXTURE,
      campaignId: CAMPAIGN,
      serviceId: SERVICE,
      pageType: "service",
      decision: "approved",
      source: "master-admin",
    });
    assert(direct.decision === "APPROVED" && direct.source === "master-admin", "master admin service write diverged");
  } finally {
    cleanup();
  }
  assert(!fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${FIXTURE}.json`)), "fixture campaign remained");

  const historical: Record<string, unknown> = {};
  for (const tenant of HISTORICAL) {
    const approval = resolveCanonicalCampaignApproval({ tenantSlug: tenant.slug, campaignId: tenant.campaignId });
    assert(approval.localities.length === tenant.localities, `${tenant.slug} denominator ${approval.localities.length}`);
    assert(approval.localities.every((page) => page.decision !== "APPROVED"), `${tenant.slug} locality approval was fabricated`);
    assert(approval.ready === false, `${tenant.slug} publishing became ready`);
    historical[tenant.slug] = {
      localities: approval.localities.length,
      approvedLocalities: approval.localities.filter((page) => page.decision === "APPROVED").length,
      service: approval.service?.decision || null,
      ready: approval.ready,
      unattached: approval.evidence.filter((item) => item.code === "UNATTACHED_APPROVAL").map((item) => item.detail),
      legacy: approval.evidence.some((item) => item.code === "LEGACY_APPROVAL_REVISION_UNRESOLVED"),
    };
  }
  const yorkshire = historical["yorkshire-pharmacy-and-health-clinic"] as { unattached: string[] };
  assert(
    yorkshire.unattached.some((detail) => detail.includes("chapeltown")) &&
      yorkshire.unattached.some((detail) => detail.includes("royston")),
    "Yorkshire extra approvals were absorbed",
  );
  const vision = resolveCanonicalCampaignApproval({
    tenantSlug: "vision-pharmacy",
    campaignId: "c6b16251-291c-4879-b143-ced92de37312",
  });
  const leicester = vision.localities.find((page) => page.areaSlug === "leicester");
  assert(leicester?.contentRevision === null && leicester.decision !== "APPROVED", "Vision Leicester became currently approved");

  const after = Object.fromEntries(HISTORICAL.map((tenant) => [tenant.slug, hashTree(tenant.slug)]));
  const writeProtection = HISTORICAL.map((tenant) => ({
    slug: tenant.slug,
    before: before[tenant.slug],
    after: after[tenant.slug],
    unchanged: before[tenant.slug] === after[tenant.slug],
  }));
  for (const row of writeProtection) assert(row.unchanged, `${row.slug} operational state changed`);
  console.log(JSON.stringify({ historical, writeProtection }, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("PASS cp03 approval, 0 failures");
}

run();
