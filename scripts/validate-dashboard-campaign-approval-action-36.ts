#!/usr/bin/env npx tsx
/**
 * DASHBOARD-CAMPAIGN-APPROVAL-ACTION-36
 * No-write fixtures. Does not execute live approval, publish, index, or regenerate.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { buildAuthoritativeCampaignProgramme } from "../src/pharmacy/pharmacyAuthoritativeCampaignProgrammeService.ts";
import {
  commitDashboardCampaignApproval,
  evaluateDashboardCampaignApproval,
  parseDashboardCampaignApproveRequest,
  runDashboardCampaignApproval,
  type DashboardCampaignApprovalWriter,
} from "../src/pharmacy/pharmacyDashboardCampaignApprovalService.ts";
import { loadContentPackage, type ContentPackageManifest } from "../src/pharmacy/pharmacyContentPackageService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const PF = "pharmacy-first";
const BP = "blood-pressure-checks";

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

function snapshotLive(): Record<string, string | null> {
  return {
    pfPackage: shaFile(path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${PF}.json`)),
    bpPackage: shaFile(path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${BP}.json`)),
    fluPackage: shaFile(path.join(ROOT, "data/pharmacy-content-packages", SLUG, "flu-vaccinations.json")),
    travelPackage: shaFile(path.join(ROOT, "data/pharmacy-content-packages", SLUG, "travel-vaccinations.json")),
    pfApproval: shaFile(path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${PF}.json`)),
    bpApproval: shaFile(path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${BP}.json`)),
    rc: shaFile(path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`)),
    pfService: shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, PF, "index.html")),
    pfDarfield: shaFile(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, PF, "local/darfield/index.html"),
    ),
  };
}

function tmpWriter(dir: string): DashboardCampaignApprovalWriter {
  return {
    writePackage(manifest: ContentPackageManifest) {
      const file = path.join(dir, "packages", manifest.slug, `${manifest.serviceId}.json`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
    },
    writeApprovalRecord(filePath, record) {
      const file = path.join(dir, "approvals", path.basename(filePath));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(record, null, 2));
    },
  };
}

function main(): void {
  const before = snapshotLive();
  const html = renderPremiumCustomerDashboardPage(SLUG);
  const programme = buildAuthoritativeCampaignProgramme(SLUG);
  const pfCard = programme.campaigns.find((c) => c.serviceId === PF);

  const approveBtn = Boolean(
    html.includes('data-campaign-approve="1"') &&
      html.includes(`data-tenant="${SLUG}"`) &&
      html.includes(`data-campaign="${PF}"`) &&
      html.includes("/approve-campaign") &&
      html.includes("JSON.stringify({tenantSlug:tenantSlug,campaignId:campaignId})"),
  );
  const noReviewCentreHref =
    Boolean(pfCard?.controls.some((c) => c.action === "approve" && !c.href)) &&
    !html.includes(`>${"Approve"}</a>`);
  record(
    "post-action-wiring",
    approveBtn && noReviewCentreHref && pfCard?.approveApiPath?.includes("/approve-campaign") === true,
    approveBtn && noReviewCentreHref ? "Approve POSTs tenantSlug+campaignId only" : "Approve still a Review Centre link",
  );

  const extraRejected = parseDashboardCampaignApproveRequest(SLUG, {
    tenantSlug: SLUG,
    campaignId: PF,
    intent: "nope",
  });
  const parsedOk = parseDashboardCampaignApproveRequest(SLUG, { tenantSlug: SLUG, campaignId: PF });
  record(
    "post-body-contract",
    extraRejected.ok === false && parsedOk.ok === true,
    extraRejected.ok ? "extra fields accepted" : "only tenantSlug+campaignId accepted",
  );

  const pfEval = evaluateDashboardCampaignApproval(SLUG, PF);
  record(
    "approval-prerequisite-validation",
    pfEval.ok &&
      !pfEval.unmetCondition &&
      pfEval.localityPagePaths.length === 8 &&
      Boolean(pfEval.servicePagePath) &&
      pfEval.registryHash === "46de67243945c2bc572cba35aa9ac0fdd5806fb8813fbf89506bdfabdd517cdb",
    pfEval.ok ? `PF prerequisites pass hash=${pfEval.registryHash}` : pfEval.unmetCondition || "PF evaluation failed",
  );

  const bpEval = evaluateDashboardCampaignApproval(SLUG, BP);
  record(
    "failure-unmet-condition",
    !bpEval.ok && Boolean(bpEval.unmetCondition) && bpEval.reviewCentreRedirect.includes("unmet="),
    bpEval.ok ? "BP unexpectedly passed" : bpEval.unmetCondition || "missing unmet condition",
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-campaign-approval-36-"));
  const applied = commitDashboardCampaignApproval(pfEval, tmpWriter(tmp));
  const tmpPackage = path.join(tmp, "packages", SLUG, `${PF}.json`);
  const tmpApproval = path.join(tmp, "approvals", `${PF}.json`);
  let tmpPkg: ContentPackageManifest | null = null;
  let tmpRec: { status?: string; published?: boolean; indexed?: boolean; lockedBankHash?: string } | null = null;
  if (fs.existsSync(tmpPackage)) tmpPkg = JSON.parse(fs.readFileSync(tmpPackage, "utf8")) as ContentPackageManifest;
  if (fs.existsSync(tmpApproval)) {
    tmpRec = JSON.parse(fs.readFileSync(tmpApproval, "utf8")) as {
      status?: string;
      published?: boolean;
      indexed?: boolean;
      lockedBankHash?: string;
    };
  }
  record(
    "approved-locked-transition",
    applied.ok &&
      applied.applied &&
      tmpPkg?.status === "approved-locked" &&
      tmpPkg?.approvalStatus === "approved-locked" &&
      Boolean(tmpPkg?.approvedAt) &&
      tmpPkg?.campaignLock?.lockedBankHash === pfEval.registryHash &&
      tmpPkg?.campaignLock?.lockedLocalityInventory?.length === 8 &&
      tmpRec?.status === "approved-locked",
    applied.ok ? "tmp lock wrote approved-locked package + record" : applied.unmetCondition || "tmp lock failed",
  );

  const failApply = runDashboardCampaignApproval({ tenantSlug: SLUG, campaignId: BP }, { apply: true });
  const afterFail = snapshotLive();
  record(
    "failure-atomicity",
    !failApply.ok &&
      failApply.applied === false &&
      JSON.stringify(before) === JSON.stringify(afterFail) &&
      !fs.existsSync(path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${PF}.json`)),
    failApply.ok ? "failure applied live state" : "failure made no live state change",
  );

  const noPublish =
    applied.published === false &&
    applied.indexed === false &&
    tmpRec?.published === false &&
    tmpRec?.indexed === false &&
    !fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyDashboardCampaignApprovalService.ts"), "utf8").includes("getPharmacyLivePublishStatus") &&
    !fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyDashboardCampaignApprovalService.ts"), "utf8").includes("indexPages");
  record("no-publish-protection", noPublish, noPublish ? "lock does not publish or index" : "publish/index leakage");

  const nextNow = programme.nextCampaign?.serviceId;
  const pfAlreadyPresent = Boolean(programme.campaigns.find((c) => c.serviceId === PF));
  record(
    "next-campaign-skips-existing-generated",
    nextNow !== PF,
    pfAlreadyPresent
      ? `PF already present; current next=${nextNow || "none"}`
      : `current next=${nextNow || "none"}`,
  );

  const unmetHtml = renderReviewCentrePage(SLUG, PF, { unmetCondition: "All eight locality pages must exist (found 0)" });
  record(
    "failure-returns-to-review-centre",
    unmetHtml.includes("Campaign could not be approved-locked") &&
      unmetHtml.includes("All eight locality pages must exist (found 0)"),
    "Review Centre renders exact unmet condition",
  );

  const successHtml = renderPremiumCustomerDashboardPage(SLUG, { approvedCampaignId: PF });
  record(
    "success-dashboard-message",
    successHtml.includes("Pharmacy First is now approved-locked."),
    "dashboard success message rendered",
  );

  const dry = runDashboardCampaignApproval({ tenantSlug: SLUG, campaignId: PF }, { apply: false });
  const afterDry = snapshotLive();
  record(
    "no-live-approval-executed",
    dry.applied === false && JSON.stringify(before) === JSON.stringify(afterDry),
    "evaluate/apply:false did not write live files",
  );

  const livePkg = loadContentPackage(SLUG, PF);
  record(
    "live-package-unaltered",
    livePkg?.status !== "approved-locked" && livePkg?.approvalStatus !== "approved-locked",
    `live PF status=${livePkg?.status}/${livePkg?.approvalStatus}`,
  );

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
