#!/usr/bin/env npx tsx
/**
 * Campaign Builder action routing validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAMPAIGN_BUILDER_ACTION_PATHS,
  campaignBuilderPageUrlForAction,
  matchCampaignBuilderActionPath,
  matchCampaignBuilderActionUrl,
  sanitizeCampaignBuilderLoginNext,
} from "../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { campaignBuilderStepUrl } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { reviewCentreUrl } from "../src/pharmacy/growthEngineReviewCentreService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const SLUG = "pharmacy-delivered-4u-test";
const API_ROUTER = readSrc("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts");
const PAGE_HTML = readSrc("src/pharmacy/growthEngineCampaignBuilderPage.ts");
const EXPLORER_HTML = readSrc("src/pharmacy/growthEngineCampaignExplorerRender.ts");
const REQUIRE_AUTH = readSrc("artifacts/api-server/src/middlewares/requireAuth.ts");
const AUTH = readSrc("artifacts/api-server/src/routes/auth.ts");

function main() {
  console.log("\n=== Campaign Builder Action Routing V1 ===\n");

  console.log("Button audit:");
  const buttons = [
    {
      label: "Build Campaign",
      destination: `/api/growth-engine/campaign-builder?slug=${SLUG}&step=overview&campaign={serviceId}`,
      method: "GET (link)",
      expected: "GET page → overview (no generation)",
      actual: PAGE_HTML.includes("campaignBuilderWizardUrl") ? "GET link" : "unknown",
    },
    {
      label: "Select Campaign",
      destination: `/api/growth-engine/campaign-builder?slug=${SLUG}&step=overview&campaign={serviceId}`,
      method: "GET (link)",
      expected: "GET page → overview (no generation)",
      actual: EXPLORER_HTML.includes("campaignBuilderWizardUrl") ? "GET link" : "unknown",
    },
    {
      label: "Build My Campaign",
      destination: `/api/growth-engine/${SLUG}/campaign-builder/generate`,
      method: "POST (fetch)",
      expected: "POST generate → Review Centre",
      actual: PAGE_HTML.includes("Generate My Campaign") && PAGE_HTML.includes("/campaign-builder/generate") ? "fetch POST" : "unknown",
    },
    {
      label: "Continue (overview)",
      destination: campaignBuilderStepUrl(SLUG, "settings"),
      method: "GET (link)",
      expected: "GET page route settings step",
      actual: PAGE_HTML.includes(`campaignBuilderStepUrl(slug, "settings")`) ? "GET page link" : "unknown",
    },
    {
      label: "Continue (settings)",
      destination: `/api/growth-engine/campaign-builder?slug=${SLUG}&step=approval&campaign={serviceId}`,
      method: "GET (form)",
      expected: "GET page → approval",
      actual: PAGE_HTML.includes('method="get" action="/api/growth-engine/campaign-builder"') ? "GET form" : "unknown",
    },
    {
      label: "Generate (API)",
      destination: `/api/growth-engine/${SLUG}/campaign-builder/generate`,
      method: "POST",
      expected: "POST only — reviewCentreUrl in response",
      actual: API_ROUTER.includes('router.post("/growth-engine/:slug/campaign-builder/generate"') ? "POST route" : "missing",
    },
  ];

  for (const btn of buttons) {
    console.log(`  • ${btn.label}: ${btn.method} → ${btn.destination}`);
    console.log(`    expected: ${btn.expected}`);
    console.log(`    actual:   ${btn.actual}`);
  }
  console.log("");

  record(
    "get-safety-handlers",
    API_ROUTER.includes("CAMPAIGN_BUILDER_ACTION_PATHS") &&
      API_ROUTER.includes("campaignBuilderActionGetRedirect") &&
      API_ROUTER.includes("router.get(`/growth-engine/:slug/campaign-builder/${action}`"),
    "GET action routes redirect to page routes",
  );

  record(
    "post-only-actions",
    CAMPAIGN_BUILDER_ACTION_PATHS.every((action) =>
      API_ROUTER.includes(`router.post("/growth-engine/:slug/campaign-builder/${action}"`),
    ),
    "all action endpoints have POST handlers",
  );

  record(
    "buttons-use-post",
    PAGE_HTML.includes("method: 'POST'") &&
      PAGE_HTML.includes("/campaign-builder/generate") &&
      !PAGE_HTML.includes('method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/select"') &&
      !PAGE_HTML.includes('method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/settings"'),
    "generate fetch POST only · wizard uses GET",
  );

  record(
    "page-nav-get-only",
    PAGE_HTML.includes('href="${esc(wizardUrl(slug, "settings"))}"') &&
      !PAGE_HTML.includes('href="/api/growth-engine/${esc(slug)}/campaign-builder/select"') &&
      !PAGE_HTML.includes('href="/api/growth-engine/${esc(slug)}/campaign-builder/generate"'),
    "Continue uses GET wizard routes not action URLs",
  );

  record(
    "login-next-sanitize",
    AUTH.includes("sanitizeCampaignBuilderLoginNext"),
    "login rewrites action URLs to safe choose page",
  );

  record(
    "no-pending-replay",
    !readSrc("artifacts/api-server/src/routes/growthEngineCampaignBuilderPageRouter.ts").includes("applyPendingCampaignBuilderAction") &&
      !REQUIRE_AUTH.includes("stashPendingCampaignBuilderAction"),
    "pending POST replay disabled (prevents auth loop)",
  );

  const badNext = `/api/growth-engine/${SLUG}/campaign-builder/select`;
  const sanitized = sanitizeCampaignBuilderLoginNext(badNext);
  record(
    "sanitize-select-url",
    sanitized.includes("step=choose") && !sanitized.includes("/select"),
    sanitized,
  );

  const selectMatch = matchCampaignBuilderActionPath(`/growth-engine/${SLUG}/campaign-builder/select`);
  record(
    "match-action-path",
    selectMatch?.action === "select" && selectMatch.slug === SLUG,
    selectMatch ? `${selectMatch.slug}/${selectMatch.action}` : "no match",
  );

  record(
    "match-action-url",
    matchCampaignBuilderActionUrl(badNext)?.action === "select",
    badNext,
  );

  record(
    "generate-review-centre",
    API_ROUTER.includes("reviewCentreUrl(slug, serviceId)"),
    "generate returns Review Centre URL",
  );

  const chooseHtml = renderCampaignBuilderPage(SLUG, "choose");
  const approvalHtml = renderCampaignBuilderPage(SLUG, "approval");
  record("choose-renders", chooseHtml.includes("Build Campaign"), "choose step HTML");
  record("approval-renders", approvalHtml.includes("Generate My Campaign"), "approval step HTML");

  record(
    "no-cannot-get-routes",
    CAMPAIGN_BUILDER_ACTION_PATHS.every((action) => {
      const page = campaignBuilderPageUrlForAction(SLUG, action);
      return page.startsWith("/api/growth-engine/campaign-builder?");
    }),
    "GET safety targets page routes",
  );

  record(
    "review-centre-handoff-url",
    reviewCentreUrl(SLUG, "pharmacy-first").includes("/api/growth-engine/review-centre"),
    reviewCentreUrl(SLUG, "pharmacy-first"),
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}

main();
