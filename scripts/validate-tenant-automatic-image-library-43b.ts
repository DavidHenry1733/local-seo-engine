#!/usr/bin/env npx tsx
/**
 * TENANT-AUTOMATIC-IMAGE-LIBRARY-43B
 * No-write fixtures. Does not regenerate, republish, or mutate locked campaigns.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  COMMERCIAL_BLUE_UI_BASELINE_ID,
  usesCommercialBlueBaseline,
} from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import {
  packageLockedCampaignStagingRelease,
  resolveLockedCampaignStagingInventory,
} from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";
import {
  addTenantImageFromBuffer,
  countActiveTenantImages,
  emptyTenantImageLibrary,
  isSelectableTenantImage,
  MAX_ACTIVE_TENANT_IMAGES,
  type TenantImageLibrary,
  type TenantImageSourceType,
} from "../src/pharmacy/pharmacyTenantImageLibraryContract.ts";
import {
  buildCampaignRunImageSelectionInventory,
  pageHasDuplicateImageIds,
  resolveReviewCentreImageSelections,
  resolveStagingImageSelections,
  selectAutomaticPageImages,
} from "../src/pharmacy/pharmacyTenantAutomaticImageSelectionService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const CAMPAIGNS = ["flu-vaccinations", "travel-vaccinations", "pharmacy-first", "blood-pressure-checks"] as const;
const LOCALITIES = ["darfield", "wombwell", "thurnscoe", "grimethorpe"];
const FLU_BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function shaFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function shaDir(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(dir, file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex");
}

function snapshotIntegrity(): Record<string, string | null> {
  const out: Record<string, string | null> = {
    fluBankFile: shaFile(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations", `${FLU_BANK}.json`),
    ),
    assignments: shaFile(path.join(ROOT, "data/pharmacy-image-assignments", `${SLUG}.json`)),
    stagingCurrent: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "current")),
    stagingReleases: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "releases")),
  };
  for (const campaign of CAMPAIGNS) {
    out[`approval:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${campaign}.json`),
    );
    out[`service:${campaign}`] = shaFile(
      path.join(ROOT, "output/pharmacy-visual-experience", SLUG, campaign, "index.html"),
    );
    out[`local:${campaign}`] = shaDir(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, campaign));
    out[`bank:${campaign}`] = shaDir(path.join(ROOT, "data/pharmacy-approved-service-banks/banks", campaign));
    out[`package:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${campaign}.json`),
    );
  }
  return out;
}

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhAGP9xwFpwAAAABJRU5ErkJggg==",
  "base64",
);

function uniqueBuf(n: number): Buffer {
  return Buffer.concat([TINY_PNG, Buffer.from([n & 0xff, (n >> 8) & 0xff])]);
}

function addImage(
  library: TenantImageLibrary,
  n: number,
  sourceType: TenantImageSourceType,
  extra?: Partial<Parameters<typeof addTenantImageFromBuffer>[1]>,
) {
  return addTenantImageFromBuffer(library, {
    slug: library.slug,
    sourceType,
    buffer: uniqueBuf(n),
    originalFilename: `img-${n}.png`,
    mimeType: "image/png",
    storedAssetPath: `assets/pharmacy-image-library/core-pharmacy/community-pharmacy.svg`,
    approvalStatus: "approved",
    licenceProvenanceStatus: "verified",
    semanticCategories: ["pharmacy"],
    ...extra,
  });
}

function main(): void {
  const before = snapshotIntegrity();

  const empty = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  record(
    "empty-library-fallback",
    selectAutomaticPageImages({
      tenantSlug: empty.slug,
      serviceId: "flu-vaccinations",
      pageType: "service",
      seed: "seed-empty",
      library: empty,
    }).roles.every((role) => role.fallback && (!role.assetPath || role.assetPath.startsWith("assets/"))),
    "empty library falls back to service library assets",
  );

  const one = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  addImage(one, 1, "customer-upload");
  const onePage = selectAutomaticPageImages({
    tenantSlug: one.slug,
    serviceId: "pharmacy-first",
    pageType: "service",
    seed: "seed-one",
    library: one,
  });
  const four = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  for (let i = 1; i <= 4; i++) addImage(four, i, i === 1 ? "customer-upload" : i === 2 ? "website-import" : i === 3 ? "approved-stock" : "approved-ai");
  const twenty = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  for (let i = 1; i <= 20; i++) addImage(twenty, i, "customer-upload");
  const overflow = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  const overflowResults = [];
  for (let i = 1; i <= 21; i++) overflowResults.push(addImage(overflow, i, "customer-upload"));
  record(
    "twenty-image-library",
    countActiveTenantImages(one) === 1 &&
      countActiveTenantImages(four) === 4 &&
      countActiveTenantImages(twenty) === 20 &&
      countActiveTenantImages(overflow) === MAX_ACTIVE_TENANT_IMAGES &&
      overflowResults[20]?.ok === false &&
      overflow.images.length === 21 &&
      overflow.images.filter((img) => img.active).length === 20,
    `active 1/4/20/21=${countActiveTenantImages(one)}/${countActiveTenantImages(four)}/${countActiveTenantImages(twenty)}/${countActiveTenantImages(overflow)}`,
  );

  const dup = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  const first = addImage(dup, 7, "customer-upload");
  const second = addImage(dup, 7, "customer-upload");
  record(
    "multi-upload-provenance",
    Boolean(first.ok && first.record?.checksum && first.record.sourceType === "customer-upload") &&
      Boolean(second.duplicate && second.record?.imageId === first.record?.imageId) &&
      dup.images.length === 1 &&
      first.record?.licenceProvenanceStatus === "verified",
    `dup=${Boolean(second.duplicate)} count=${dup.images.length} source=${first.record?.sourceType}`,
  );

  const gated = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  addImage(gated, 1, "customer-upload");
  addImage(gated, 2, "website-import", { approvalStatus: "pending", licenceProvenanceStatus: "unverified", active: false } as never);
  addImage(gated, 3, "approved-stock");
  addImage(gated, 4, "approved-ai", { approvalStatus: "pending", licenceProvenanceStatus: "pending", active: false } as never);
  const pendingWebsite = {
    ...gated.images[1],
    sourceType: "website-import" as const,
    approvalStatus: "pending" as const,
    licenceProvenanceStatus: "unverified" as const,
    active: false,
  };
  gated.images[1] = pendingWebsite;
  const pendingAi = {
    ...gated.images[3],
    sourceType: "approved-ai" as const,
    approvalStatus: "pending" as const,
    licenceProvenanceStatus: "pending" as const,
    active: false,
  };
  gated.images[3] = pendingAi;
  const inactive = { ...gated.images[2], active: false };
  gated.images.push({ ...inactive, imageId: "til-inactive", checksum: "inactive", active: false });
  const selected = selectAutomaticPageImages({
    tenantSlug: gated.slug,
    serviceId: "travel-vaccinations",
    pageType: "service",
    seed: "seed-gate",
    library: gated,
  });
  const selectedIds = selected.roles.filter((r) => !r.fallback).map((r) => r.imageId);
  record(
    "source-priority-approval-gating",
    isSelectableTenantImage(gated.images[0]) &&
      !isSelectableTenantImage(pendingWebsite) &&
      !isSelectableTenantImage(pendingAi) &&
      !selectedIds.includes(pendingWebsite.imageId) &&
      !selectedIds.includes(pendingAi.imageId) &&
      !selectedIds.includes("til-inactive") &&
      selected.roles[0].sourceType === "customer-upload",
    `first=${selected.roles[0].sourceType}/${selected.roles[0].imageId}`,
  );

  const mixed = emptyTenantImageLibrary("pc-image-library-fixture-43b");
  addImage(mixed, 11, "customer-upload");
  addImage(mixed, 12, "website-import");
  addImage(mixed, 13, "approved-stock");
  addImage(mixed, 14, "approved-ai");
  const mixedPage = selectAutomaticPageImages({
    tenantSlug: mixed.slug,
    serviceId: "blood-pressure-checks",
    pageType: "service",
    seed: "seed-priority",
    library: mixed,
  });
  const order = mixedPage.roles.filter((r) => !r.fallback).map((r) => r.sourceType);
  record(
    "deterministic-selection",
    JSON.stringify(
      selectAutomaticPageImages({
        tenantSlug: mixed.slug,
        serviceId: "blood-pressure-checks",
        pageType: "service",
        seed: "seed-priority",
        library: mixed,
      }).roles.map((r) => r.imageId),
    ) === JSON.stringify(mixedPage.roles.map((r) => r.imageId)) &&
      order[0] === "customer-upload" &&
      new Set(
        selectAutomaticPageImages({
          tenantSlug: "other-tenant",
          serviceId: "blood-pressure-checks",
          pageType: "service",
          seed: "seed-priority",
          library: mixed,
        }).roles.map((r) => r.imageId),
      ).size >= 1 &&
      CAMPAIGNS.every((campaign) => {
        const page = selectAutomaticPageImages({
          tenantSlug: mixed.slug,
          serviceId: campaign,
          pageType: "service",
          seed: `${campaign}-stable`,
          library: mixed,
        });
        const again = selectAutomaticPageImages({
          tenantSlug: mixed.slug,
          serviceId: campaign,
          pageType: "service",
          seed: `${campaign}-stable`,
          library: mixed,
        });
        return JSON.stringify(page) === JSON.stringify(again);
      }),
    `order=${order.join(">")}`,
  );

  record(
    "duplicate-avoidance",
    !pageHasDuplicateImageIds(mixedPage) && mixedPage.roles.filter((r) => !r.fallback).length === 4,
    `mixedUnique=${new Set(mixedPage.roles.map((r) => r.imageId)).size} oneFallbacks=${onePage.roles.filter((r) => r.fallback).length}`,
  );

  const locA = selectAutomaticPageImages({
    tenantSlug: mixed.slug,
    serviceId: "flu-vaccinations",
    pageType: "locality",
    localitySlug: "darfield",
    seed: "seed-local",
    library: four,
  });
  const locB = selectAutomaticPageImages({
    tenantSlug: mixed.slug,
    serviceId: "flu-vaccinations",
    pageType: "locality",
    localitySlug: "wombwell",
    seed: "seed-local",
    library: four,
  });
  const locIds = LOCALITIES.map(
    (area) =>
      selectAutomaticPageImages({
        tenantSlug: mixed.slug,
        serviceId: "flu-vaccinations",
        pageType: "locality",
        localitySlug: area,
        seed: "seed-local",
        library: four,
      }).roles[0].imageId,
  );
  record(
    "locality-variation",
    new Set(locIds).size > 1,
    `darfield=${locA.roles[0].imageId} wombwell=${locB.roles[0].imageId} unique=${new Set(locIds).size}`,
  );

  const recorded = buildCampaignRunImageSelectionInventory({
    tenantSlug: mixed.slug,
    serviceId: "pharmacy-first",
    runId: "run-43b",
    seed: "seed-run",
    library: four,
    localitySlugs: ["darfield", "wombwell"],
  });
  const grown = emptyTenantImageLibrary(mixed.slug);
  for (let i = 1; i <= 8; i++) addImage(grown, 50 + i, "approved-stock");
  const review = resolveReviewCentreImageSelections(recorded, {
    tenantSlug: mixed.slug,
    serviceId: "pharmacy-first",
    runId: "run-43b",
    seed: "seed-run",
    library: grown,
    localitySlugs: ["darfield", "wombwell"],
  });
  const staging = resolveStagingImageSelections(recorded, {
    tenantSlug: mixed.slug,
    serviceId: "pharmacy-first",
    runId: "run-43b",
    seed: "seed-run",
    library: grown,
    localitySlugs: ["darfield", "wombwell"],
  });
  record(
    "review-staging-provenance",
    JSON.stringify(review.pages) === JSON.stringify(recorded.pages) &&
      JSON.stringify(staging.pages) === JSON.stringify(recorded.pages),
    "Review Centre and staging reuse recorded image IDs rather than reselecting",
  );

  const confirmHtml = renderCustomerSetupConfirmPage(SLUG);
  const cbHtml = renderCampaignBuilderPage(SLUG, "images");
  record(
    "manual-slot-removal",
    confirmHtml.includes('data-image-library="v1"') &&
      confirmHtml.includes("Image Library") &&
      confirmHtml.includes("tenantLibraryFiles") &&
      /hero, support, trust, conversion/i.test(confirmHtml) &&
      !confirmHtml.includes("btn-slot-library") &&
      cbHtml.includes('data-image-library="v1"') &&
      !cbHtml.includes("Required campaign images") &&
      !cbHtml.includes("btn-slot-upload") &&
      !cbHtml.includes("Assign or defer remaining image slots"),
    "setup and campaign builder expose Image Library without slot assignment",
  );

  const reviewCentre = renderReviewCentrePage(SLUG, "flu-vaccinations");
  const dashboard = renderPremiumCustomerDashboardPage(SLUG);
  record(
    "po-blue-ui",
    usesCommercialBlueBaseline(confirmHtml) &&
      usesCommercialBlueBaseline(reviewCentre) &&
      usesCommercialBlueBaseline(dashboard) &&
      reviewCentre.includes(COMMERCIAL_BLUE_UI_BASELINE_ID),
    "Product Owner chrome remains commercial blue",
  );

  for (const campaign of CAMPAIGNS) {
    const inventory = resolveLockedCampaignStagingInventory(SLUG, campaign);
    const packed = packageLockedCampaignStagingRelease(inventory);
    if (!packed.ok) record(`staging-pack-${campaign}`, false, packed.blockers.join("; "));
  }

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "four-campaign-staging-integrity",
    mutated.length === 0 &&
      fs.existsSync(path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations", `${FLU_BANK}.json`)),
    mutated.length ? `mutated=${mutated.join(",")}` : "four locked campaigns, assignments, Flu bank and staging bytes unchanged",
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS tenant-automatic-image-library-43b");
}

main();
