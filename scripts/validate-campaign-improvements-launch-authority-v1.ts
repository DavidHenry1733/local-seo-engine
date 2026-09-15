#!/usr/bin/env npx tsx
/**
 * Campaign Improvements — Required Before Launch uses publication/readiness gate authority.
 * Fixtures plus read-only Vision analysis. Does not mark complete, defer, generate, publish, or change profile.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  campaignImprovementsWorkflowNext,
  improvementIsRequiredBeforeLaunch,
  publicationAllowsLaunch,
  type CampaignImprovementsLaunchAuthority,
} from "../src/pharmacy/pharmacyCampaignImprovementsLaunchAuthority.ts";
import { groupCampaignImprovements } from "../src/pharmacy/pharmacyEnhancementWorkspaceUi.ts";
import { buildEnhancementWorkspaceView, type EnhancementWorkspaceTask } from "../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { renderEnhancementWorkspaceHtml } from "../artifacts/api-server/src/routes/pharmacyEnhancementWorkspacePage.ts";
import { getServiceAuthorityAudit } from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
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

function task(partial: Partial<EnhancementWorkspaceTask> & Pick<EnhancementWorkspaceTask, "id" | "signalId" | "title">): EnhancementWorkspaceTask {
  return {
    category: "technicalQuality",
    reason: "",
    evidence: [],
    difficulty: "Medium",
    estimatedImpact: "Medium",
    estimatedScoreGain: 5,
    estimatedAiGain: 0,
    estimatedVisibilityGain: 0,
    linkedModule: "Authority",
    linkedUrl: "/",
    nextAction: "",
    serviceId: "service-a",
    serviceName: "Service A",
    workspaceTaskId: `ws-${partial.id}`,
    status: "ready",
    completedAt: null,
    completedBy: null,
    beforeScore: null,
    afterScore: null,
    notes: null,
    testMode: true,
    primaryAction: { label: "Open", url: "/" },
    estimatedAuthorityGain: 5,
    ...partial,
  };
}

function failNoindex(): CampaignImprovementsLaunchAuthority {
  return {
    publishGate: "FAIL",
    overallScore: 40,
    label: "Not Ready",
    criticalIssues: ["Page marked noindex — remove before live publish"],
    missingSignals: ["Named pharmacist / reviewer"],
    livePublishReady: false,
  };
}

function passWithRecommendations(): CampaignImprovementsLaunchAuthority {
  return {
    publishGate: "PASS_WITH_RECOMMENDATIONS",
    overallScore: 74,
    label: "Needs Enhancement",
    criticalIssues: [],
    missingSignals: ["Named pharmacist / reviewer", "Review frequency stated"],
    livePublishReady: true,
  };
}

function main() {
  console.log("\n=== Campaign Improvements launch authority ===\n");

  const noindexTask = task({
    id: "rec-noindex",
    signalId: "tq-no-noindex",
    title: "Remove noindex",
    reason: "noindex blocks visibility",
  });
  const reviewerTask = task({
    id: "rec-named",
    signalId: "he-named-accountability",
    title: "Named accountability",
    estimatedScoreGain: 50,
    estimatedImpact: "High",
  });
  const scoreOnlyTask = task({
    id: "rec-score",
    signalId: "he-languages-spoken",
    title: "Languages spoken",
    difficulty: "Easy",
    estimatedScoreGain: 40,
  });

  const failAuth = failNoindex();
  const recAuth = passWithRecommendations();

  record(
    "genuine-fail-is-required",
    improvementIsRequiredBeforeLaunch(noindexTask, failAuth) === true &&
      groupCampaignImprovements([noindexTask, reviewerTask], failAuth).requiredBeforeLaunch.map((t) => t.id).join() === "rec-noindex",
    "FAIL noindex → Required Before Launch",
  );

  record(
    "pass-with-recommendations-is-not-blocker",
    improvementIsRequiredBeforeLaunch(reviewerTask, recAuth) === false &&
      groupCampaignImprovements([reviewerTask, scoreOnlyTask], recAuth).requiredBeforeLaunch.length === 0,
    "PASS_WITH_RECOMMENDATIONS reviewer item is a recommendation",
  );

  record(
    "score-gain-alone-is-not-mandatory",
    improvementIsRequiredBeforeLaunch(scoreOnlyTask, recAuth) === false &&
      improvementIsRequiredBeforeLaunch(reviewerTask, recAuth) === false,
    "authority-score improvements stay optional when the gate already allows publish",
  );

  record(
    "rtp-unavailable-when-blocked",
    publicationAllowsLaunch("FAIL") === false &&
      !campaignImprovementsWorkflowNext({
        livePublishReady: false,
        slug: "fixture",
        serviceId: "service-a",
      }).nextStepLabel.includes("Ready To Publish"),
    "Ready To Publish CTA withheld when gate is FAIL",
  );

  record(
    "rtp-available-when-zero-blockers",
    publicationAllowsLaunch("PASS_WITH_RECOMMENDATIONS") === true &&
      campaignImprovementsWorkflowNext({
        livePublishReady: true,
        slug: "fixture",
        serviceId: "service-a",
      }).nextStepLabel === "Continue to Ready To Publish",
    "Ready To Publish CTA valid when there are zero genuine blockers",
  );

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/pharmacy-enhancement-workspace/vision-pharmacy.json",
    "data/pharmacy-authority-readiness/vision-pharmacy.json",
    "data/pharmacy-authority-enhancements/vision-pharmacy.json",
    "data/pharmacy-master-admin/active-service-campaign/vision-pharmacy.json",
    "output/pharmacy-visual-experience/vision-pharmacy/pharmacy-first/index.html",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  const storeBefore = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-enhancement-workspace/vision-pharmacy.json"), "utf8"),
  ) as { tasks?: unknown[] };

  const view = buildEnhancementWorkspaceView("vision-pharmacy", { serviceId: "pharmacy-first" });
  const html = renderEnhancementWorkspaceHtml(view);
  const groups = groupCampaignImprovements(
    [...view.board.ready, ...view.board.inProgress, ...view.board.completed, ...view.board.deferred],
    view.launchAuthority,
  );
  const audit = getServiceAuthorityAudit("vision-pharmacy", "pharmacy-first");
  const areas = explicitConfirmedLocalityNames(readSetupProfile("vision-pharmacy").selectedAreas);
  const previousFive = [
    { id: "he-named-accountability", label: "Named accountability" },
    { id: "he-reviewer-schema", label: "Reviewer schema opportunity" },
    { id: "ct-review-schedule", label: "Review schedule" },
    { id: "he-patient-trust-wording", label: "Patient trust wording" },
    { id: "he-review-frequency", label: "Review frequency stated" },
  ];

  function bucketFor(signalId: string): string {
    if (groups.requiredBeforeLaunch.some((t) => t.signalId === signalId)) return "Required Before Launch";
    if (groups.quickWins.some((t) => t.signalId === signalId)) return "Quick Wins";
    if (groups.highImpact.some((t) => t.signalId === signalId)) return "High Impact";
    if (groups.future.some((t) => t.signalId === signalId)) return "Future Improvements";
    if (groups.completed.some((t) => t.signalId === signalId)) return "Completed";
    if (groups.deferred.some((t) => t.signalId === signalId)) return "Deferred";
    return "missing";
  }

  record(
    "required-count-agrees-with-gate",
    view.launchAuthority.publishGate === "PASS_WITH_RECOMMENDATIONS" &&
      view.launchAuthority.livePublishReady === true &&
      groups.requiredBeforeLaunch.length === 0 &&
      (audit?.criticalIssues.length || 0) === 0,
    `gate=${view.launchAuthority.publishGate} required=${groups.requiredBeforeLaunch.length} score=${view.launchAuthority.overallScore}`,
  );

  record(
    "vision-previous-five-not-required",
    previousFive.every((item) => bucketFor(item.id) !== "Required Before Launch" && bucketFor(item.id) !== "missing"),
    previousFive.map((item) => `${item.label}→${bucketFor(item.id)}`).join(" | "),
  );

  record(
    "vision-rtp-offered",
    html.includes("Continue to Ready To Publish") &&
      html.includes('data-live-publish-ready="true"') &&
      html.includes('data-publish-gate="PASS_WITH_RECOMMENDATIONS"') &&
      html.includes("No launch blockers remain"),
    "Continue to Ready To Publish available with zero genuine blockers",
  );

  const blockedView = {
    ...view,
    launchAuthority: {
      ...failAuth,
      overallScore: view.launchAuthority.overallScore,
      label: view.launchAuthority.label,
    },
  };
  const blockedHtml = renderEnhancementWorkspaceHtml(blockedView);
  record(
    "blocked-html-withholds-rtp",
    !blockedHtml.includes("Continue to Ready To Publish") && blockedHtml.includes("Resolve launch blockers"),
    "FAIL gate does not offer Continue to Ready To Publish",
  );

  record("vision-areas-unchanged", areas.length === 8, `areas=${areas.length}`);
  record(
    "vision-no-complete-or-defer",
    view.board.completed.length === 0 &&
      view.board.deferred.length === 0 &&
      (storeBefore.tasks || []).length === 0,
    `completed=${view.board.completed.length} deferred=${view.board.deferred.length}`,
  );

  console.log("\nVision Pharmacy First launch authority");
  console.log(`  gate=${view.launchAuthority.publishGate} score=${view.launchAuthority.overallScore} livePublishReady=${view.launchAuthority.livePublishReady}`);
  console.log(`  required=${groups.requiredBeforeLaunch.length} quickWins=${groups.quickWins.length} highImpact=${groups.highImpact.length} remaining=${view.summary.recommendationsRemaining}`);
  for (const item of previousFive) {
    console.log(`  previous-required ${item.label} → ${bucketFor(item.id)}`);
  }

  const after = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));
  record(
    "vision-hashes-unchanged",
    hashed.every((rel) => before[rel] === after[rel]),
    hashed.every((rel) => before[rel] === after[rel]) ? "no Vision writes" : "HASH CHANGED",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.filter((c) => c.pass).length}/${checks.length} checks\n`);
  if (failed.length) process.exit(1);
}

main();
