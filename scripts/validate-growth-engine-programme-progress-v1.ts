#!/usr/bin/env npx tsx
/**
 * Growth Engine programme progress / next-step lifecycle.
 * Fixtures plus read-only Vision. Does not generate, write profile, publish, or index.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGrowthEngineFramework,
  growthPlanStepIsComplete,
  resolveGrowthPlanContinueCta,
  type GrowthEngineFramework,
  type GrowthEngineStepState,
} from "../src/pharmacy/growthEngineFrameworkService.ts";
import { renderGrowthPlanPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { buildGrowthPlanRecommendation } from "../src/pharmacy/growthEngineFrameworkService.ts";
import { computePharmacyProgrammeCompletionPct, computeWizardQualityScore } from "../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { computeRequiredProfileCompleteness } from "../src/pharmacy/pharmacyProfileFieldClassification.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { explicitConfirmedLocalityNames } from "../src/pharmacy/growthEngineCampaignTargetAreaRankingService.ts";

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

function step(id: GrowthEngineStepState["id"], status: GrowthEngineStepState["status"], title: string): GrowthEngineStepState {
  return {
    id,
    step: 1,
    title,
    subtitle: "",
    status,
    completionPct: status === "complete" ? 100 : status === "in_progress" ? 50 : 0,
    summary: "",
    url: `/api/growth-engine/${id}`,
  };
}

function frameworkWith(steps: GrowthEngineStepState[]): GrowthEngineFramework {
  return {
    version: 1,
    slug: "fixture",
    generatedAt: "",
    overallCompletionPct: 0,
    currentStep: steps.find((s) => s.status !== "complete")?.id || "dashboard",
    nextStep: steps.find((s) => s.status !== "complete") || null,
    steps,
    importSummary: { imported: 0, confirmed: 0, missing: 0 },
    plan: {
      suggestedCampaign: "Service A",
      suggestedEcosystem: "",
      estimatedPages: 1,
      estimatedPublishingDays: "",
      expectedIndexingTimeline: "",
      expectedReviewPeriod: "",
      primaryServiceId: "service-a",
      primaryServiceName: "Service A",
      areaCount: 1,
    },
  };
}

function main() {
  console.log("\n=== Programme lifecycle progress / next-step CTA ===\n");

  record(
    "ungenerated-continue-create-content",
    resolveGrowthPlanContinueCta(
      frameworkWith([
        step("growth-plan", "in_progress", "Your Growth Plan"),
        step("generate", "not_started", "Create Content"),
        step("dashboard", "not_started", "Your Dashboard"),
      ]),
    ).nextLabel === "Continue to Create Content →",
    "content not generated → Create Content CTA",
  );

  const generatedCta = resolveGrowthPlanContinueCta(
    frameworkWith([
      step("business-intelligence", "in_progress", "Your Pharmacy"),
      step("growth-plan", "complete", "Your Growth Plan"),
      step("generate", "complete", "Create Content"),
      step("dashboard", "complete", "Your Dashboard"),
    ]),
  );
  record(
    "generated-no-create-content-cta",
    generatedCta.nextLabel !== "Continue to Create Content →" && !String(generatedCta.nextUrl || "").includes("campaign-builder"),
    `label=${generatedCta.nextLabel || "none"}`,
  );

  record(
    "generated-dashboard-complete-uses-outstanding-stage",
    generatedCta.nextLabel === "Continue to Your Pharmacy →" && Boolean(generatedCta.nextUrl?.includes("business-intelligence")),
    `next=${generatedCta.nextLabel}`,
  );

  record(
    "generated-plan-not-stuck-at-50",
    growthPlanStepIsComplete({ planAcknowledged: false, evidenceBackedPlanExists: true, campaignGenerated: true }) === true,
    "plan exists + generated → Growth Plan complete",
  );
  record(
    "ungenerated-plan-not-complete-without-ack",
    growthPlanStepIsComplete({ planAcknowledged: false, evidenceBackedPlanExists: true, campaignGenerated: false }) === false,
    "plan exists but not generated stays incomplete until ack/generation",
  );

  const hashed = [
    "data/pharmacy-profiles/vision-pharmacy.json",
    "data/pharmacy-content-packages/vision-pharmacy/pharmacy-first.json",
    "data/growth-engine/vision-pharmacy-campaign-builder.json",
    "data/pharmacy-campaigns/vision-pharmacy.json",
    "data/growth-engine/vision-pharmacy-workflow.json",
  ];
  const before = Object.fromEntries(hashed.map((rel) => [rel, sha(rel)]));

  const vision = buildGrowthEngineFramework("vision-pharmacy");
  const gp = vision.steps.find((s) => s.id === "growth-plan");
  const generate = vision.steps.find((s) => s.id === "generate");
  const dashboard = vision.steps.find((s) => s.id === "dashboard");
  const pharmacy = vision.steps.find((s) => s.id === "business-intelligence");
  const html = renderGrowthPlanPage("vision-pharmacy", buildGrowthPlanRecommendation("vision-pharmacy"));
  const cta = resolveGrowthPlanContinueCta(vision);
  const profile = readSetupProfile("vision-pharmacy");
  const required = computeRequiredProfileCompleteness(profile);
  const wizard = computeWizardQualityScore(profile);
  const programmePct = computePharmacyProgrammeCompletionPct(profile);
  const areas = explicitConfirmedLocalityNames(profile.selectedAreas);

  record("vision-growth-plan-complete", gp?.status === "complete" && gp.completionPct === 100, `status=${gp?.status} pct=${gp?.completionPct}`);
  record("vision-create-content-complete", generate?.status === "complete" && generate.completionPct === 100, `pct=${generate?.completionPct}`);
  record("vision-no-create-content-cta", !html.includes("Continue to Create Content"), html.includes("Continue to Create Content") ? "Create Content CTA still shown" : cta.nextLabel || "none");
  record("vision-cta-not-dashboard-or-generate", !/Create Content|Your Dashboard/.test(cta.nextLabel || ""), `cta=${cta.nextLabel}`);
  record("vision-areas-unchanged", areas.length === 8, `areas=${areas.length}`);

  console.log("\nYour Pharmacy completeness (not fixed in this task)");
  console.log(`  programmePct=${programmePct} required=${required.score} wizard=${wizard.overallScore}`);
  console.log(`  missingRequired=${required.missingRequired.join(" | ") || "none"}`);
  console.log(`  requiredQualityIncomplete=${wizard.requiredQualityIncomplete.join(" | ") || "none"}`);
  console.log(`  optionalQualityIncomplete=${wizard.optionalQualityIncomplete.join(" | ") || "none"}`);
  console.log(`  framework Your Pharmacy=${pharmacy?.completionPct}% ${pharmacy?.status}`);
  console.log(`  overall=${vision.overallCompletionPct}% nextCta=${cta.nextLabel}`);

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
