#!/usr/bin/env npx tsx
/**
 * COMMERCIAL-PRODUCT-DASHBOARD-44
 * Read-only validation of the customer dashboard product map.
 * Does not regenerate, publish, index, or mutate profile/campaign state.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import {
  buildPremiumCustomerDashboardView,
  COMMERCIAL_FEATURE_STATUSES,
  CORE_LOCKED_CAMPAIGN_IDS,
  HERO_SUPPORTING_TEXT,
} from "../src/pharmacy/growthEnginePremiumCustomerDashboard.ts";
import {
  COMMERCIAL_BLUE_UI_BASELINE_ID,
  usesCommercialBlueBaseline,
} from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import { isLockedCampaignApprovedForStaging } from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";
import { getPharmacyLivePublishStatus } from "../src/pharmacy/pharmacyLivePublishService.ts";
import { buildAuthoritativeCampaignProgramme } from "../src/pharmacy/pharmacyAuthoritativeCampaignProgrammeService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FLU_BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";
const CAMPAIGNS = CORE_LOCKED_CAMPAIGN_IDS;

const FEATURES: Array<{ title: string; benefit: string }> = [
  {
    title: "Pharmacy Profile & Website Import",
    benefit: "Import and confirm your pharmacy identity, services and contact details.",
  },
  {
    title: "Brand Review",
    benefit: "Confirm the logo, colours and fonts used on generated pages.",
  },
  {
    title: "Local Market Intelligence",
    benefit: "Compare your pharmacy with nearby competitors and identify visibility gaps.",
  },
  {
    title: "Website Intelligence",
    benefit: "Review existing pages, content coverage and website opportunities.",
  },
  {
    title: "Growth Plan",
    benefit: "See the recommended service campaigns and priority actions.",
  },
  {
    title: "Image Library",
    benefit: "Upload or approve photographs for automatic campaign placement.",
  },
  {
    title: "Campaign Generation",
    benefit: "Create service and locality pages from approved content banks.",
  },
  {
    title: "Review Centre",
    benefit: "Preview, improve and approve generated campaign content.",
  },
  {
    title: "Managed Publishing",
    benefit: "Publish approved campaigns to a controlled managed destination.",
  },
  {
    title: "Indexing",
    benefit: "Manage sitemap and search-engine submission after production approval.",
  },
  {
    title: "Search Visibility & Rank Tracking",
    benefit: "Monitor indexed pages, keyword visibility and ranking movement.",
  },
  {
    title: "Recommended Improvements",
    benefit: "See the next evidence-based actions for continued growth.",
  },
];

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function htmlHas(html: string, text: string): boolean {
  return html.includes(text) || html.includes(text.replace(/&/g, "&amp;"));
}

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
    profile: shaFile(path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`)),
    reviewCentre: shaFile(path.join(ROOT, "data/growth-engine", `${SLUG}-review-centre.json`)),
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
    out[`package:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${campaign}.json`),
    );
  }
  return out;
}

function main(): void {
  const before = snapshotIntegrity();
  const view = buildPremiumCustomerDashboardView(SLUG);
  const html = renderPremiumCustomerDashboardPage(SLUG);
  const programme = buildAuthoritativeCampaignProgramme(SLUG);
  const live = getPharmacyLivePublishStatus(SLUG);
  const fluStaging = isLockedCampaignApprovedForStaging(SLUG, "flu-vaccinations");

  record(
    "commercial-hero",
    htmlHas(html, "Welcome back, Yorkshire Pharmacy & Health Clinic") &&
      html.includes(HERO_SUPPORTING_TEXT) &&
      html.includes("4 approved campaigns") &&
      html.includes("36 approved core pages") &&
      html.includes("8 local areas per campaign") &&
      html.includes("Controlled staging ready") &&
      html.includes("View your programme") &&
      html.includes("Continue next action") &&
      !html.includes("Setup progress") &&
      !html.includes("43%") &&
      !html.includes("Confirm pharmacy details") &&
      (html.match(/Welcome back/g) || []).length === 1,
    "compact Yorkshire hero, no stale setup copy",
  );

  const featureCards = html.match(/class="pcd-feature"/g) || [];
  const missingFeatures = FEATURES.filter((f) => !htmlHas(html, f.title) || !htmlHas(html, f.benefit));
  record(
    "twelve-feature-journey",
    featureCards.length === 12 && missingFeatures.length === 0 && view.featureJourney.length === 12,
    missingFeatures.length ? missingFeatures.map((f) => f.title).join(",") : "12 ordered feature cards",
  );

  const allowed = new Set<string>(COMMERCIAL_FEATURE_STATUSES);
  const badStatus = view.featureJourney.filter((f) => !allowed.has(f.status));
  const brand = view.featureJourney.find((f) => f.id === "brand-review");
  const images = view.featureJourney.find((f) => f.id === "image-library");
  const campaigns = view.featureJourney.find((f) => f.id === "campaign-generation");
  const review = view.featureJourney.find((f) => f.id === "review-centre");
  const publishing = view.featureJourney.find((f) => f.id === "managed-publishing");
  const indexing = view.featureJourney.find((f) => f.id === "indexing");
  const visibility = view.featureJourney.find((f) => f.id === "search-visibility");
  record(
    "authoritative-status-mapping",
    badStatus.length === 0 &&
      brand?.status === "Complete" &&
      images?.status === "Complete" &&
      campaigns?.status === "Complete" &&
      review?.status === "Approved" &&
      publishing?.status === "Staging ready" &&
      indexing?.status === "Not tested" &&
      visibility?.status === "Not tested" &&
      publishing?.status !== "Complete" &&
      !html.includes("customer-domain") &&
      !html.includes("Setup progress") &&
      !html.includes("43%"),
    `brand=${brand?.status} images=${images?.status} campaigns=${campaigns?.status} review=${review?.status} publishing=${publishing?.status} indexing=${indexing?.status} visibility=${visibility?.status}`,
  );

  const indexingCard = html.match(/data-feature-id="indexing"[\s\S]*?<\/article>/);
  const indexingDisabled = Boolean(
    indexingCard &&
      indexingCard[0].includes('data-feature-enabled="false"') &&
      indexingCard[0].includes("disabled") &&
      !indexingCard[0].includes('href="'),
  );
  const unsafeRoutes = [
    "/api/master-admin",
    "pharmacy-growth-dashboard",
    "/api/pharmacy-image-library/diagnostics",
    "Campaign OS",
    "Founder Partner",
    "Master Admin",
  ].filter((term) => html.includes(term));
  const expectedRoutes = [
    `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(SLUG)}`,
    `/api/growth-engine/local-market?slug=${encodeURIComponent(SLUG)}`,
    `/api/growth-engine/website-intelligence?slug=${encodeURIComponent(SLUG)}`,
    `/api/growth-engine/growth-plan?slug=${encodeURIComponent(SLUG)}`,
    `/api/pharmacy-image-library?slug=${encodeURIComponent(SLUG)}`,
    `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(SLUG)}`,
    `/api/growth-engine/review-centre?slug=${encodeURIComponent(SLUG)}`,
    `/api/pharmacy-publishing-settings?slug=${encodeURIComponent(SLUG)}`,
    `/api/growth-engine/search-intelligence?slug=${encodeURIComponent(SLUG)}`,
    `/api/pharmacy-growth-actions?slug=${encodeURIComponent(SLUG)}`,
  ];
  const missingRoutes = expectedRoutes.filter((route) => !html.includes(route));
  record(
    "route-action-integrity",
    indexingDisabled &&
      unsafeRoutes.length === 0 &&
      missingRoutes.length === 0 &&
      view.featureJourney.every((f) => (f.actionEnabled ? Boolean(f.href && f.href.startsWith("/api/")) : !f.href)),
    indexingDisabled && missingRoutes.length === 0
      ? "customer routes only; indexing safely disabled"
      : `unsafe=${unsafeRoutes.join(",") || "none"} missing=${missingRoutes.join(",") || "none"} indexingDisabled=${indexingDisabled}`,
  );

  record(
    "next-action-accuracy",
    view.nextActionTitle === "Prepare production publishing" &&
      !view.nextActionCtaHref.includes("confirm-pharmacy") &&
      !html.includes("Confirm pharmacy details") &&
      view.optionalRecommendation?.includes("Optional pharmacy profile") === true &&
      view.secondaryCtaHref === view.nextActionCtaHref,
    `${view.nextActionTitle} → ${view.nextActionCtaHref}`,
  );

  record(
    "responsive-screenshot-layout",
    html.includes("grid-template-columns:repeat(3,minmax(0,1fr))") &&
      /@media\(max-width:720px\)/.test(html) &&
      /@media\(max-width:960px\)/.test(html) &&
      html.includes("pcd-features") &&
      html.includes("pcd-hero-metrics") &&
      !html.includes("max-width:360px") &&
      !html.includes("pcd-progress"),
    "compact hero, 3-column desktop, single-column mobile",
  );

  const core = programme.campaigns.filter((c) => (CAMPAIGNS as readonly string[]).includes(c.serviceId));
  const approvedPages = core.reduce((sum, c) => sum + Number(c.corePageCount || 0), 0);
  record(
    "campaign-staging-integrity",
    core.every((c) => c.approvedLocked) &&
      approvedPages === 36 &&
      fluStaging === true &&
      !live.lastPublishedAt &&
      live.pagesPublished === 0 &&
      !html.includes("Approved bank hash") &&
      !html.toLowerCase().includes("master admin"),
    `approved=${core.filter((c) => c.approvedLocked).length} pages=${approvedPages} fluStaging=${fluStaging} published=${live.lastPublishedAt || "no"}`,
  );

  record(
    "blue-ui-integrity",
    usesCommercialBlueBaseline(html) &&
      html.includes(COMMERCIAL_BLUE_UI_BASELINE_ID) &&
      html.toLowerCase().includes("#005eb8") &&
      !/data-internal-admin-theme=["']black["']/.test(html),
    COMMERCIAL_BLUE_UI_BASELINE_ID,
  );

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  record(
    "no-state-mutation",
    mutated.length === 0 && Boolean(before.fluBankFile),
    mutated.length ? `mutated=${mutated.join(",")}` : "profile, campaigns, approvals and staging unchanged",
  );

  const failed = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failed.length) {
    console.error(`FAIL ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS commercial-product-dashboard-44");
}

main();
