#!/usr/bin/env npx tsx
/**
 * DASHBOARD-REPORT-SUMMARY-AUTHORITY-44A
 * Read-only: lower report cards must use live Local Market, website inventory, and campaign programme records.
 * Does not regenerate, publish, index, or mutate profile/campaign/report state.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { buildPremiumCustomerDashboardView } from "../src/pharmacy/growthEnginePremiumCustomerDashboard.ts";
import {
  COMMERCIAL_BLUE_UI_BASELINE_ID,
  usesCommercialBlueBaseline,
} from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import { buildLocalMarketReportView } from "../src/pharmacy/growthEngineLocalMarketReportView.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { resolveWebsiteIntelligenceSnapshot } from "../src/pharmacy/growthEngineWebsiteIntelligenceService.ts";
import { buildAuthoritativeCampaignProgramme } from "../src/pharmacy/pharmacyAuthoritativeCampaignProgrammeService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FLU_BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";
const CAMPAIGNS = [
  "flu-vaccinations",
  "travel-vaccinations",
  "pharmacy-first",
  "blood-pressure-checks",
] as const;

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
    profile: shaFile(path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`)),
    competitors: shaFile(path.join(ROOT, "data/growth-engine", `${SLUG}-competitors.json`)),
    reviewCentre: shaFile(path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`)),
    stagingCurrent: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "current")),
    stagingReleases: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "releases")),
  };
  for (const campaign of CAMPAIGNS) {
    out[`approval:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${campaign}.json`),
    );
    out[`package:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${campaign}.json`),
    );
    out[`service:${campaign}`] = shaFile(
      path.join(ROOT, "output/pharmacy-visual-experience", SLUG, campaign, "index.html"),
    );
  }
  return out;
}

function reportCard(html: string, id: string): string {
  const match = html.match(new RegExp(`data-report-id="${id}"[\\s\\S]*?</article>`));
  return match?.[0] || "";
}

function main(): void {
  const before = snapshotIntegrity();
  const view = buildPremiumCustomerDashboardView(SLUG);
  const html = renderPremiumCustomerDashboardPage(SLUG);
  const programme = buildAuthoritativeCampaignProgramme(SLUG);
  const local = buildLocalMarketReportView(loadCompetitorSnapshot(SLUG));
  const website = resolveWebsiteIntelligenceSnapshot(SLUG);
  const localCard = reportCard(html, "local-market");
  const websiteCard = reportCard(html, "website");
  const planCard = reportCard(html, "growth-plan");
  const localPreview = view.reportPreviews.find((r) => r.id === "local-market");
  const websitePreview = view.reportPreviews.find((r) => r.id === "website");
  const planPreview = view.reportPreviews.find((r) => r.id === "growth-plan");
  const pages = String(website?.analysis?.inventory?.totalPages || 0);
  const opportunity = String(website?.analysis?.opportunities?.[0]?.headline || "");

  record(
    "local-market-summary-authority",
    local.live === true &&
      localPreview?.stat1Value === "Live comparison" &&
      localPreview?.stat2Value === String(local.overview.pharmacies) &&
      localPreview?.insight === local.insights[0] &&
      localCard.includes("Comparison status") &&
      localCard.includes(String(local.overview.pharmacies)) &&
      !localCard.includes("Ready to run"),
    `live=${local.live} pharmacies=${local.overview.pharmacies} insight=${local.insights[0] || "none"}`,
  );

  record(
    "website-report-summary-authority",
    Number(pages) > 0 &&
      websitePreview?.stat1Value === pages &&
      websitePreview?.stat2Value === "Inventory recorded" &&
      websitePreview?.insight === opportunity &&
      websiteCard.includes(pages) &&
      websiteCard.includes("Inventory recorded") &&
      websiteCard.includes(opportunity) &&
      !websiteCard.includes("Ready to run"),
    `pages=${pages} status=${websitePreview?.stat2Value} opportunity=${opportunity}`,
  );

  const core = programme.campaigns.filter((c) => (CAMPAIGNS as readonly string[]).includes(c.serviceId));
  const pageCount = core.reduce((sum, c) => sum + Number(c.corePageCount || 0), 0);
  record(
    "growth-plan-summary-authority",
    programme.nextCampaign === null &&
      planPreview?.stat1Label === "Approved campaigns" &&
      planPreview?.stat1Value === "4" &&
      planPreview?.stat2Label === "Approved core pages" &&
      planPreview?.stat2Value === "36" &&
      planPreview?.insight === "Core campaigns approved" &&
      planPreview?.extraValue === "Prepare production publishing" &&
      pageCount === 36 &&
      core.every((c) => c.approvedLocked) &&
      planCard.includes("Approved campaigns") &&
      planCard.includes("36") &&
      planCard.includes("Core campaigns approved") &&
      planCard.includes("Prepare production publishing") &&
      !planCard.includes("Recommended campaign") &&
      !planCard.includes("Ready to run"),
    `next=${programme.nextCampaign?.serviceName || "none"} pages=${pageCount}`,
  );

  record(
    "stale-malaria-recommendation-removed",
    !html.toLowerCase().includes("malaria") &&
      !html.includes("Malaria Prevention") &&
      planPreview?.stat1Value !== "Malaria Prevention",
    "no Malaria Prevention on dashboard",
  );

  record(
    "hero-feature-campaign-integrity",
    html.includes("Welcome back, Yorkshire Pharmacy") &&
      html.includes("4 approved campaigns") &&
      html.includes("36 approved core pages") &&
      html.includes("Controlled staging ready") &&
      (html.match(/class="pcd-feature"/g) || []).length === 12 &&
      view.featureJourney.find((f) => f.id === "campaign-generation")?.status === "Complete" &&
      view.featureJourney.find((f) => f.id === "review-centre")?.status === "Approved" &&
      view.featureJourney.find((f) => f.id === "managed-publishing")?.status === "Staging ready" &&
      (html.match(/class="pcd-campaign"/g) || []).length === 4 &&
      core.every((c) => c.approvedLocked) &&
      html.includes("Your PharmaConnect programme"),
    "hero, twelve features and four approved-locked campaign cards unchanged",
  );

  record(
    "blue-ui-integrity",
    usesCommercialBlueBaseline(html) && html.includes(COMMERCIAL_BLUE_UI_BASELINE_ID),
    COMMERCIAL_BLUE_UI_BASELINE_ID,
  );

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "no-state-mutation",
    mutated.length === 0,
    mutated.length ? `mutated=${mutated.join(",")}` : "profile, campaigns, reports and staging unchanged",
  );

  const failed = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failed.length) {
    console.error(`FAIL ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS dashboard-report-summary-authority-44a");
}

main();
