#!/usr/bin/env npx tsx
/**
 * Campaign Builder — recommendation fallback V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFallbackCampaignBuilderList,
  buildFallbackCampaignSections,
  CAMPAIGN_BUILDER_EXISTING_COPY,
  CAMPAIGN_BUILDER_EXISTING_LABEL,
  collectExistingWebsiteServices,
  fallbackClaimsAreSafe,
} from "../src/pharmacy/growthEngineCampaignBuilderFallbackService.ts";
import { buildCampaignBuilderList } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { buildGrowthPlanIntelligence } from "../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TEST_SLUG = "pharmacy-delivered-4u-test";
const GROWTH_PLAN_SLUG = "dhmdigital";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function main() {
  console.log("\n=== Campaign Builder Recommendation Fallback V1 ===\n");

  const testList = buildCampaignBuilderList(TEST_SLUG);
  record(
    "test-slug-has-campaigns",
    testList.length >= 1,
    `${TEST_SLUG}: ${testList.length} campaign(s)`,
  );

  record(
    "pharmacy-first-detected",
    testList.some((c) => c.serviceId === "pharmacy-first"),
    testList.find((c) => c.serviceId === "pharmacy-first")?.serviceName || "missing",
  );

  const chooseHtml = renderCampaignBuilderPage(TEST_SLUG, "choose");
  record(
    "create-campaign-button",
    chooseHtml.includes("🚀 Build Campaign") && (chooseHtml.match(/🚀 Build Campaign/g) || []).length >= 1,
    `${(chooseHtml.match(/🚀 Build Campaign/g) || []).length} button(s)`,
  );

  record(
    "fallback-reason-copy",
    testList.every((c) => (c.isFallback && c.serviceContext === "existing" ? c.reason === CAMPAIGN_BUILDER_EXISTING_COPY : true)),
    CAMPAIGN_BUILDER_EXISTING_COPY.slice(0, 50) + "…",
  );

  record(
    "no-fake-revenue-demand",
    fallbackClaimsAreSafe(CAMPAIGN_BUILDER_EXISTING_COPY) &&
      fallbackClaimsAreSafe(CAMPAIGN_BUILDER_EXISTING_LABEL) &&
      testList.filter((c) => c.isFallback).every((c) => fallbackClaimsAreSafe(c.estimatedOpportunity)),
    "fallback copy only",
  );

  const growthPlan = buildGrowthPlanIntelligence(GROWTH_PLAN_SLUG);
  const growthList = buildCampaignBuilderList(GROWTH_PLAN_SLUG);
  record(
    "growth-plan-priority",
    Boolean(growthPlan.primaryCampaign) &&
      growthList[0]?.serviceId === growthPlan.primaryCampaign?.serviceId &&
      !growthList[0]?.isFallback,
    growthList[0] ? `${growthList[0].serviceName} (growth plan)` : "missing",
  );

  const detected = collectExistingWebsiteServices(TEST_SLUG);
  const sections = buildFallbackCampaignSections(TEST_SLUG);
  record(
    "detected-service-sources",
    detected.some((d) => d.serviceId === "pharmacy-first") &&
      detected.some((d) => d.serviceId === "blood-pressure-checks"),
    `${detected.length} detected services`,
  );

  const fallbackOnly = buildFallbackCampaignBuilderList(TEST_SLUG);
  record(
    "preferred-fallback-order",
    fallbackOnly[0]?.serviceId === "pharmacy-first" &&
      fallbackOnly.some((c) => c.serviceId === "repeat-prescriptions"),
    fallbackOnly.map((c) => c.serviceId).join(", "),
  );

  record(
    "choose-page-not-blocked",
    !chooseHtml.includes("Complete Your Growth Plan first"),
    "no empty-state blocker",
  );

  record(
    "existing-context-badges",
    sections.existing.every((c) => c.contextBadge === "Grow This Service"),
    `${sections.existing.length} grow badges`,
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main();
