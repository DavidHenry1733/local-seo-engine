#!/usr/bin/env npx tsx
/**
 * CP01 canonical campaign lifecycle resolver.
 * Read-only regression against the five audited pharmacy campaigns.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CANONICAL_LIFECYCLE_REASON } from "../src/pharmacy/canonicalCampaignLifecycleModel.ts";
import { resolveCanonicalCampaignLifecycle } from "../src/pharmacy/canonicalCampaignLifecycleResolver.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const BROOK_CAMPAIGN = "caf83fc0-9b8a-40a9-85f9-f79b99b094c5";
const SERVICE = "pharmacy-first";
const TENANTS = [
  BROOK,
  "yorkshire-pharmacy-and-health-clinic",
  "leeds-pharmacy",
  "vision-pharmacy",
  "banner-cross-pharmacy",
] as const;

const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

function readStore(slug: string): { campaigns?: Array<Record<string, unknown>> } {
  return JSON.parse(fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-campaigns", `${slug}.json`), "utf8"));
}

function pharmacyFirstCampaignId(slug: string): string {
  const matches = (readStore(slug).campaigns || []).filter(
    (campaign) => campaign.serviceId === SERVICE && campaign.status !== "archived",
  );
  if (matches.length !== 1) {
    throw new Error(`${slug} has ${matches.length} ${SERVICE} campaigns`);
  }
  return String(matches[0]?.id || "");
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
    `data/growth-engine/${slug}-review-centre.json`,
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
    const stat = fs.statSync(full);
    if (stat.isFile()) files.push(full);
    else collectFiles(full, files);
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

function collectFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

function reasonCodes(slugSource: string): void {
  const forbidden = ["brook-pharmacy", "derby", "allestree", "pharmacy-first", "caf83fc0", "leicester"];
  for (const token of forbidden) {
    assert(!slugSource.toLowerCase().includes(token), `Resolver source contains tenant-specific token ${token}`);
  }
}

function same(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function run(): void {
  const resolverSource = fs.readFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/canonicalCampaignLifecycleResolver.ts"),
    "utf8",
  );
  const modelSource = fs.readFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/canonicalCampaignLifecycleModel.ts"),
    "utf8",
  );
  reasonCodes(resolverSource + modelSource);
  assert(!resolverSource.includes("writeFile"), "Resolver contains a write");
  assert(!resolverSource.includes("mkdir"), "Resolver contains a directory create");
  assert(!resolverSource.includes("unlink"), "Resolver contains a delete");

  const before = Object.fromEntries(TENANTS.map((slug) => [slug, hashTree(slug)]));

  const unknown = resolveCanonicalCampaignLifecycle({ tenantSlug: BROOK, campaignId: "missing-campaign-id" });
  assert(unknown.health.identity.status === "FAIL", "Missing campaign did not fail identity");
  assert(unknown.identity.serviceId === null, "Missing campaign invented a service");
  assert(unknown.membership.campaignAreaSlugs.length === 0, "Missing campaign invented locality membership");
  assert(unknown.membership.membershipAgreement === false, "Missing campaign reported membership agreement");

  const blank = resolveCanonicalCampaignLifecycle({ tenantSlug: "", campaignId: BROOK_CAMPAIGN });
  assert(blank.identity.tenantSlug === null, "Blank tenant was coerced to a slug");
  assert(blank.health.identity.status === "FAIL", "Blank tenant did not fail identity");

  const brook = resolveCanonicalCampaignLifecycle({ tenantSlug: BROOK, campaignId: BROOK_CAMPAIGN });
  assert(brook.identity.serviceId === SERVICE, `Brook service ${brook.identity.serviceId}`);
  assert(brook.identity.campaignStatus === "active", `Brook status ${brook.identity.campaignStatus}`);
  assert(brook.membership.campaignAreaSlugs.length === 10, `Brook campaign membership ${brook.membership.campaignAreaSlugs.length}`);
  assert(brook.membership.packageAreaSlugs?.length === 0, `Brook package membership ${brook.membership.packageAreaSlugs?.length}`);
  assert(brook.membership.renderedAreaSlugs.length === 10, `Brook rendered outputs ${brook.membership.renderedAreaSlugs.length}`);
  assert(brook.membership.membershipAgreement === false, "Brook membership disagreement was hidden");
  assert(
    brook.membership.conflicts.some((conflict) => conflict.code === CANONICAL_LIFECYCLE_REASON.packageAreaSetDiffers),
    "Brook package disagreement was not exposed",
  );
  assert(same(brook.membership.renderedAreaSlugs, brook.membership.campaignAreaSlugs), "Brook rendered set was not the campaign set");
  assert(brook.approval.servicePage?.status === "approved", "Brook service-page approval was not visible");
  assert(brook.approval.servicePage?.scope === "CANONICAL", "Brook service-page approval was not campaign-scoped");
  assert(brook.approval.localityApprovedCount === 0, `Brook locality approvals changed to ${brook.approval.localityApprovedCount}`);
  assert(brook.approval.localityExpectedCount === 10, `Brook expected localities ${brook.approval.localityExpectedCount}`);
  assert(brook.approval.historical.every((item) => item.scope === "HISTORICAL"), "Brook historical evidence was promoted");
  assert(brook.approval.historical.length > 0, "Brook historical checkpoints were dropped");
  assert(brook.publishing.publishIndexPresent === false, "Brook publish index appeared");
  assert(brook.publishing.publishingStatus === "pending", `Brook publishing status ${brook.publishing.publishingStatus}`);
  assert(brook.content.revisionStatus === "unresolved", "Brook content revision was guessed");
  assert(brook.approval.approvalRevisionMatch === "unresolved", "Brook approval revision was guessed");

  const yorkshireId = pharmacyFirstCampaignId("yorkshire-pharmacy-and-health-clinic");
  const yorkshire = resolveCanonicalCampaignLifecycle({
    tenantSlug: "yorkshire-pharmacy-and-health-clinic",
    campaignId: yorkshireId,
  });
  const yorkshireReview = yorkshire.approval.reviewCentre?.areaSlugs || [];
  assert(yorkshire.membership.membershipAgreement === false, "Yorkshire disagreement was reconciled");
  assert(yorkshireReview.length > 0, "Yorkshire Review Centre locality evidence was hidden");
  assert(!same(yorkshireReview, yorkshire.membership.campaignAreaSlugs), "Yorkshire Review Centre set was rewritten to campaign membership");
  assert(
    yorkshire.membership.conflicts.some((conflict) => conflict.code === CANONICAL_LIFECYCLE_REASON.packageAreaSetDiffers),
    "Yorkshire package disagreement was hidden",
  );
  assert(yorkshire.approval.approvalAmbiguity === true, "Yorkshire approval ambiguity was collapsed");
  assert(yorkshire.content.currentRun.present === true, "Yorkshire current-run pointer was dropped");
  assert(yorkshire.content.currentRun.scope === "UNRESOLVED", "Yorkshire current run became approval authority");

  const leedsId = pharmacyFirstCampaignId("leeds-pharmacy");
  const leeds = resolveCanonicalCampaignLifecycle({ tenantSlug: "leeds-pharmacy", campaignId: leedsId });
  assert(leeds.membership.membershipAgreement === false, "Leeds disagreement was reconciled");
  assert(leeds.membership.renderedAreaSlugs.some((slug) => slug.startsWith("cluster-")), "Leeds cluster directories were omitted");
  assert(leeds.membership.unattachedOutputs.some((slug) => slug.startsWith("cluster-")), "Leeds cluster directories became canonical");
  assert(leeds.membership.campaignAreaSlugs.every((slug) => !slug.startsWith("cluster-")), "Leeds canonical membership includes a cluster directory");
  assert(
    (leeds.membership.packageAreaSlugs?.length || 0) !== leeds.membership.campaignAreaSlugs.length,
    "Leeds package set matched an empty or rewritten campaign set",
  );

  const visionId = pharmacyFirstCampaignId("vision-pharmacy");
  const vision = resolveCanonicalCampaignLifecycle({ tenantSlug: "vision-pharmacy", campaignId: visionId });
  assert(vision.membership.campaignAreaSlugs.includes("leicester"), "Vision campaign membership lost Leicester");
  assert(!vision.membership.renderedAreaSlugs.includes("leicester"), "Vision rendered set gained Leicester");
  assert(vision.membership.missingOutputs.includes("leicester"), "Vision Leicester gap was hidden");
  assert(vision.membership.membershipAgreement === false, "Vision disagreement was reconciled");

  const bannerId = pharmacyFirstCampaignId("banner-cross-pharmacy");
  const banner = resolveCanonicalCampaignLifecycle({ tenantSlug: "banner-cross-pharmacy", campaignId: bannerId });
  assert(banner.publishing.publishIndexPresent === true, "Banner Cross publish index was not visible");
  assert(banner.publishing.pages.length > 0, "Banner Cross publish index has no pages");
  assert(banner.publishing.pages.every((page) => page.scope === "UNSCOPED"), "Banner Cross publish pages were treated as campaign-scoped");
  assert(banner.publishing.pages.every((page) => page.campaignId === null), "Banner Cross publish pages gained a campaign id");
  assert(banner.publishing.pages.every((page) => page.contentHash === null), "Banner Cross publish pages gained a content hash");
  assert(
    banner.health.publishing.reasons.includes(CANONICAL_LIFECYCLE_REASON.campaignPublishStatusMismatch),
    "Banner Cross publish status mismatch was hidden",
  );
  assert(
    banner.health.publishing.reasons.includes(CANONICAL_LIFECYCLE_REASON.publishIndexMissingCampaignId),
    "Banner Cross missing campaign id was hidden",
  );
  assert(
    banner.health.publishing.reasons.includes(CANONICAL_LIFECYCLE_REASON.publishIndexMissingContentHash),
    "Banner Cross missing content hash was hidden",
  );

  const again = resolveCanonicalCampaignLifecycle({ tenantSlug: BROOK, campaignId: BROOK_CAMPAIGN });
  assert(JSON.stringify(again) === JSON.stringify(brook), "Resolver was not deterministic");

  const after = Object.fromEntries(TENANTS.map((slug) => [slug, hashTree(slug)]));
  for (const slug of TENANTS) {
    assert(before[slug] === after[slug], `${slug} operational state changed`);
  }

  const summary = {
    brook: compact(brook),
    yorkshire: compact(yorkshire),
    leeds: compact(leeds),
    vision: compact(vision),
    banner: compact(banner),
    writeProtection: TENANTS.map((slug) => ({ slug, before: before[slug], after: after[slug], unchanged: before[slug] === after[slug] })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`PASS ${TENANTS.length} tenants, 0 failures`);
}

function compact(lifecycle: ReturnType<typeof resolveCanonicalCampaignLifecycle>) {
  return {
    campaignId: lifecycle.identity.campaignId,
    serviceId: lifecycle.identity.serviceId,
    status: lifecycle.identity.campaignStatus,
    campaignAreas: lifecycle.membership.campaignAreaSlugs.length,
    packageAreas: lifecycle.membership.packageAreaSlugs?.length ?? null,
    renderedAreas: lifecycle.membership.renderedAreaSlugs.length,
    unattached: lifecycle.membership.unattachedOutputs,
    missing: lifecycle.membership.missingOutputs,
    agreement: lifecycle.membership.membershipAgreement,
    conflicts: lifecycle.membership.conflicts.map((conflict) => conflict.code),
    approvalAuthority: lifecycle.approval.currentApprovalAuthority,
    approvalAmbiguity: lifecycle.approval.approvalAmbiguity,
    serviceApproval: lifecycle.approval.servicePage?.status || null,
    reviewCentreAreas: lifecycle.approval.reviewCentre?.areaSlugs.length ?? null,
    localityApproved: lifecycle.approval.localityApprovedCount,
    localityExpected: lifecycle.approval.localityExpectedCount,
    publishIndex: lifecycle.publishing.publishIndexPresent,
    publishPages: lifecycle.publishing.pages.length,
    publishingStatus: lifecycle.publishing.publishingStatus,
    publishedPages: lifecycle.publishing.publishedPages,
    health: Object.fromEntries(
      (["identity", "membership", "content", "approval", "publishing", "indexing", "results"] as const).map((key) => [
        key,
        lifecycle.health[key],
      ]),
    ),
  };
}

run();
