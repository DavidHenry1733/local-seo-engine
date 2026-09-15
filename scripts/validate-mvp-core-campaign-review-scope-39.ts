#!/usr/bin/env npx tsx
/**
 * MVP-CORE-CAMPAIGN-REVIEW-SCOPE-39
 * No-write fixtures. Does not approve, publish, index, regenerate, or commit.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isCampaignReviewAssetRequired,
  loadContentPackage,
  resolveCampaignReviewScope,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  REVIEW_CENTRE_OPTIONAL_DEFERRED_LABEL,
} from "../src/pharmacy/growthEngineReviewCentreModel.ts";
import {
  buildReviewCentreView,
  evaluateRequiredReviewScope,
} from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { evaluateDashboardCampaignApproval } from "../src/pharmacy/pharmacyDashboardCampaignApprovalService.ts";
import { loadCampaignBuilderSession } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const BP = "blood-pressure-checks";
const PF = "pharmacy-first";
const FLU = "flu-vaccinations";
const TRAVEL = "travel-vaccinations";

const FILES_TO_HASH = [
  path.join(ROOT, "data/growth-engine", `${SLUG}-campaign-builder.json`),
  path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${BP}.json`),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${PF}.json`),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${FLU}.json`),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${TRAVEL}.json`),
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "packs/gbp-posts.json"),
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "packs/social-posts.json"),
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "packs/email-sequence.json"),
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, BP, "index.html"),
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, PF, "index.html"),
  path.join(ROOT, "data/pharmacy-approved-service-banks/registry.json"),
  path.join(
    ROOT,
    "data/pharmacy-approved-service-banks/banks",
    BP,
    "523230c01178b219e9ac0ff84cfa7bfa8737029c6610f8f58e19c489792c859c.json",
  ),
];

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

function main(): void {
  const hashesBefore = new Map(FILES_TO_HASH.map((file) => [file, shaFile(file)]));
  const builderBefore = JSON.stringify(loadCampaignBuilderSession(SLUG).approvedAssets);
  const pkgBefore = loadContentPackage(SLUG, BP);

  const scope = resolveCampaignReviewScope(SLUG, BP);
  record(
    "authoritative-mvp-scope",
    scope === "mvp-core-pages" &&
      isCampaignReviewAssetRequired(scope, "service-page") &&
      isCampaignReviewAssetRequired(scope, "local-area-pages") &&
      isCampaignReviewAssetRequired(scope, "images") &&
      !isCampaignReviewAssetRequired(scope, "gbp") &&
      !isCampaignReviewAssetRequired(scope, "social") &&
      !isCampaignReviewAssetRequired(scope, "email") &&
      !isCampaignReviewAssetRequired(scope, "blog"),
    `scope=${scope}`,
  );

  const view = buildReviewCentreView(SLUG, BP);
  const requiredKeys = (view?.groups || []).flatMap((group) => group.assets.map((asset) => asset.key)).sort();
  const optionalKeys = (view?.optionalGroups || []).flatMap((group) => group.assets.map((asset) => asset.key)).sort();
  record(
    "required-core-totals",
    Boolean(view) &&
      view?.campaignScope === "mvp-core-pages" &&
      view?.requiredGroupCount === 3 &&
      view?.approvedCount === 3 &&
      view?.readyCount === 0 &&
      view?.needsImprovementCount === 0 &&
      view?.totalAssets === 3 &&
      requiredKeys.join(",") === "images,local-area-pages,service-page",
    view
      ? `required=${view.requiredGroupCount} approved=${view.approvedCount} ready=${view.readyCount} ni=${view.needsImprovementCount} keys=${requiredKeys.join("|")}`
      : "missing view",
  );

  const gbp = pkgBefore?.assets.find((asset) => asset.type === "gbp");
  const social = pkgBefore?.assets.find((asset) => asset.type === "social");
  const email = pkgBefore?.assets.find((asset) => asset.type === "email");
  const html = renderReviewCentrePage(SLUG, BP);
  record(
    "optional-assets-preserved-non-blocking",
    Boolean(gbp?.included && (gbp.count || 0) > 0) &&
      Boolean(social?.included && (social.count || 0) > 0) &&
      Boolean(email?.included && (email.count || 0) > 0) &&
      optionalKeys.includes("email") &&
      optionalKeys.includes("gbp") &&
      optionalKeys.includes("social") &&
      requiredKeys.join(",") === "images,local-area-pages,service-page" &&
      (view?.optionalGroups || []).every((group) => group.optionalDeferred && !group.required) &&
      html.includes(REVIEW_CENTRE_OPTIONAL_DEFERRED_LABEL) &&
      html.includes('data-optional-deferred="true"') &&
      !/rc-btn-approve" data-asset-key="gbp"/.test(html) &&
      !/rc-btn-approve" data-asset-key="social"/.test(html) &&
      !/rc-btn-approve" data-asset-key="email"/.test(html),
    `optional=${optionalKeys.join("|")} gbp=${gbp?.count || 0} social=${social?.count || 0} email=${email?.count || 0}`,
  );

  const incomplete = evaluateRequiredReviewScope({
    required: [
      { key: "service-page", status: "ready" },
      { key: "local-area-pages", status: "approved" },
      { key: "images", status: "approved" },
    ],
    optional: [
      { key: "gbp", status: "ready" },
      { key: "social", status: "ready" },
      { key: "email", status: "ready" },
    ],
  });
  record(
    "incomplete-core-blocking",
    incomplete.requiredGroupCount === 3 &&
      incomplete.approvedCount === 2 &&
      incomplete.readyCount === 1 &&
      incomplete.campaignLockReady === false &&
      incomplete.optionalCounted === false,
    `approved=${incomplete.approvedCount} ready=${incomplete.readyCount} lock=${incomplete.campaignLockReady}`,
  );

  const complete = evaluateRequiredReviewScope({
    required: [
      { key: "service-page", status: "approved" },
      { key: "local-area-pages", status: "approved" },
      { key: "images", status: "approved" },
    ],
    optional: [
      { key: "gbp", status: "ready" },
      { key: "social", status: "ready" },
      { key: "email", status: "ready" },
    ],
  });
  const groupBlockGone =
    view?.campaignLockReady === true &&
    evaluateDashboardCampaignApproval(SLUG, BP).unmetCondition !== "Not every Review Centre group is approved" &&
    evaluateDashboardCampaignApproval(SLUG, BP).unmetCondition !== "Not every required Review Centre group is approved";
  record(
    "campaign-lock-readiness",
    complete.campaignLockReady === true &&
      complete.optionalCounted === false &&
      view?.campaignLockReady === true &&
      view?.allApproved === true &&
      groupBlockGone,
    `viewLock=${view?.campaignLockReady} fixtureLock=${complete.campaignLockReady} unmet=${evaluateDashboardCampaignApproval(SLUG, BP).unmetCondition || "none"}`,
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mvp-core-review-scope-39-"));
  const snapshotOptional = {
    gbp: shaFile(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "packs/gbp-posts.json")),
    social: shaFile(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "packs/social-posts.json")),
    email: shaFile(path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, BP, "packs/email-sequence.json")),
    builder: builderBefore,
    gbpStatus: gbp?.status,
    socialStatus: social?.status,
    emailStatus: email?.status,
  };
  fs.writeFileSync(path.join(tmp, "probe.json"), JSON.stringify({ ok: true, published: false, indexed: false }), "utf8");
  record(
    "no-implicit-approval-publish",
    snapshotOptional.gbpStatus === gbp?.status &&
      snapshotOptional.socialStatus === social?.status &&
      snapshotOptional.emailStatus === email?.status &&
      JSON.stringify(loadCampaignBuilderSession(SLUG).approvedAssets) === builderBefore &&
      !Object.keys(loadCampaignBuilderSession(SLUG).approvedAssets).includes("gbp") &&
      !Object.keys(loadCampaignBuilderSession(SLUG).approvedAssets).includes("social") &&
      !Object.keys(loadCampaignBuilderSession(SLUG).approvedAssets).includes("email") &&
      loadContentPackage(SLUG, BP)?.status !== "approved-locked" &&
      html.includes("Optional — deferred"),
    "optional statuses unchanged; gbp/social/email not in approvedAssets; no live lock",
  );

  const hashesAfter = new Map(FILES_TO_HASH.map((file) => [file, shaFile(file)]));
  const mutated = FILES_TO_HASH.filter((file) => hashesBefore.get(file) !== hashesAfter.get(file)).map((file) =>
    path.relative(ROOT, file),
  );
  record(
    "no-write-live-state",
    mutated.length === 0,
    mutated.length ? `mutated=${mutated.join(",")}` : "packages, banks, optional assets, Flu/Travel/PF unchanged",
  );

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.filter((check) => check.pass).length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
