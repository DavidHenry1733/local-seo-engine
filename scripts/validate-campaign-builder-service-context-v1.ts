#!/usr/bin/env npx tsx
/**
 * Campaign Builder — service context V1 validation.
 */
import {
  buildFallbackCampaignSections,
  CAMPAIGN_BUILDER_EXISTING_BADGE,
  CAMPAIGN_BUILDER_EXISTING_COPY,
  CAMPAIGN_BUILDER_EXISTING_LABEL,
  CAMPAIGN_BUILDER_MISSING_BADGE,
  collectExistingWebsiteServices,
  collectMissingServiceOpportunities,
  existingServiceCopyIsSafe,
  fallbackClaimsAreSafe,
} from "../src/pharmacy/growthEngineCampaignBuilderFallbackService.ts";
import { buildCampaignBuilderList } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";

const TEST_SLUG = "pharmacy-delivered-4u-test";

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
  console.log("\n=== Campaign Builder Service Context V1 ===\n");

  const sections = buildFallbackCampaignSections(TEST_SLUG);
  const pharmacyFirst = sections.existing.find((c) => c.serviceId === "pharmacy-first");

  record(
    "pharmacy-first-existing-badge",
    pharmacyFirst?.contextBadge === "Grow This Service",
    pharmacyFirst?.contextBadge || "missing",
  );

  record(
    "pharmacy-first-existing-label",
    pharmacyFirst?.contextLabel === CAMPAIGN_BUILDER_EXISTING_LABEL,
    pharmacyFirst?.contextLabel || "missing",
  );

  record(
    "pharmacy-first-strengthen-copy",
    pharmacyFirst?.reason === CAMPAIGN_BUILDER_EXISTING_COPY,
    pharmacyFirst?.reason?.slice(0, 60) || "missing",
  );

  record(
    "detected-not-described-as-missing",
    sections.existing.every((c) => c.serviceContext === "existing") &&
      !sections.existing.some((c) => /missing|not found|not detected/i.test(c.reason)),
    `${sections.existing.length} existing cards`,
  );

  record(
    "existing-not-in-missing-list",
    !sections.missing.some((c) => sections.existing.some((e) => e.serviceId === c.serviceId)),
    sections.missing.length ? sections.missing.map((c) => c.serviceId).join(", ") : "no overlap",
  );

  const html = renderCampaignBuilderPage(TEST_SLUG, "choose");
  record(
    "missing-section-hidden-without-evidence",
    !html.includes("Missing service opportunities"),
    sections.missing.length ? `${sections.missing.length} missing (section shown)` : "hidden",
  );

  record(
    "create-campaign-buttons",
    (html.match(/🚀 Build Campaign/g) || []).length >= 1 &&
      (html.match(/Select Campaign/g) || []).length >= Math.max(1, sections.existing.length - 1),
    `${(html.match(/🚀 Build Campaign/g) || []).length} build · ${(html.match(/Select Campaign/g) || []).length} select`,
  );

  record(
    "no-fake-opportunity-claims",
    sections.existing.every((c) => existingServiceCopyIsSafe(c.reason) && fallbackClaimsAreSafe(c.estimatedOpportunity)) &&
      sections.missing.every((c) => fallbackClaimsAreSafe(c.reason)),
    "copy scan",
  );

  record(
    "missing-badge-when-present",
    sections.missing.every((c) => c.contextBadge === CAMPAIGN_BUILDER_MISSING_BADGE),
    sections.missing.length ? "missing badges ok" : "skipped — no missing cards",
  );

  record(
    "website-detected-source",
    collectExistingWebsiteServices(TEST_SLUG).some((s) => s.serviceId === "pharmacy-first"),
    "pharmacy-first in existing website services",
  );

  record(
    "missing-only-from-evidence",
    collectMissingServiceOpportunities(TEST_SLUG).every((m) =>
      ["profile", "google", "competitor"].includes(m.source),
    ),
    `${collectMissingServiceOpportunities(TEST_SLUG).length} missing opportunities`,
  );

  const all = buildCampaignBuilderList(TEST_SLUG);
  record(
    "fallback-cards-have-context",
    all.filter((c) => c.isFallback).every((c) => c.contextBadge && c.serviceContext),
    `${all.length} cards`,
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main();
