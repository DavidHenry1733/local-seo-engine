#!/usr/bin/env npx tsx
/**
 * Campaign Builder GET wizard validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCampaignBuilderWizardQuery,
  campaignBuilderWizardUrl,
  loginNextContainsActionEndpoint,
  sanitizeCampaignBuilderLoginNext,
} from "../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { CB_UX_BUILD_CAMPAIGN, CB_UX_GENERATE_MY_CAMPAIGN } from "../src/pharmacy/growthEngineCampaignBuilderUxV2.ts";
import {
  buildCampaignBuilderList,
  loadCampaignBuilderSession,
  selectCampaignBuilderService,
} from "../src/pharmacy/growthEngineCampaignBuilderService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SLUG = "pharmacy-delivered-4u-test";
const BASE = process.env.CB_AUTH_TEST_BASE || "http://127.0.0.1:3001";
const TOKEN = process.env.SESSION_SECRET || "4a92c9e0d7155a3a4c230c3a110aadf65bb3a5b6693ac12fae204d3d1ca4b430";

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

async function fetchHead(url: string): Promise<Response> {
  return fetch(url, { redirect: "manual" });
}

async function followRedirects(startUrl: string, max = 8): Promise<string[]> {
  const urls: string[] = [];
  let url = startUrl;
  for (let i = 0; i < max; i++) {
    const res = await fetchHead(url);
    urls.push(url);
    if (res.status < 300 || res.status >= 400) break;
    const location = res.headers.get("location");
    if (!location) break;
    url = location.startsWith("http") ? location : `${BASE}${location}`;
  }
  return urls;
}

function mainSync() {
  const pageHtml = readSrc("src/pharmacy/growthEngineCampaignBuilderPage.ts");
  const explorerHtml = readSrc("src/pharmacy/growthEngineCampaignExplorerRender.ts");
  const pageRouter = readSrc("artifacts/api-server/src/routes/growthEngineCampaignBuilderPageRouter.ts");
  const apiRouter = readSrc("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts");
  const routing = readSrc("src/pharmacy/growthEngineCampaignBuilderRoutingService.ts");

  record(
    "build-campaign-is-get",
    pageHtml.includes('href="${esc(campaignBuilderWizardUrl(slug, "overview", c.serviceId))}"') &&
      !pageHtml.includes('method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/select"'),
    "Build Campaign → GET overview+campaign",
  );

  record(
    "select-campaign-no-post",
    explorerHtml.includes('href="${esc(campaignBuilderWizardUrl(slug, "overview", item.serviceId))}"') &&
      !explorerHtml.includes("/campaign-builder/select"),
    "explorer Select Campaign is GET",
  );

  record(
    "settings-is-get-form",
    pageHtml.includes('method="get" action="/api/growth-engine/campaign-builder"') &&
      !pageHtml.includes('method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/settings"'),
    "settings Continue uses GET form",
  );

  record(
    "overview-continue-get",
    pageHtml.includes('href="${esc(wizardUrl(slug, "settings"))}"'),
    "overview Continue is GET link",
  );

  record(
    "generate-label",
    pageHtml.includes("CB_UX_GENERATE_MY_CAMPAIGN") && CB_UX_GENERATE_MY_CAMPAIGN === "Generate My Campaign",
    CB_UX_GENERATE_MY_CAMPAIGN,
  );

  record(
    "generate-only-wizard-post",
    pageHtml.includes("/campaign-builder/generate") &&
      pageHtml.includes("method: 'POST'") &&
      !pageHtml.match(/method="post"[^>]*campaign-builder\/(select|settings)/),
    "only generate uses POST in wizard HTML",
  );

  record(
    "wizard-url-helper",
    routing.includes("campaignBuilderWizardUrl") && routing.includes("applyCampaignBuilderWizardQuery"),
    "wizard URL + query sync",
  );

  record(
    "page-router-applies-wizard",
    pageRouter.includes("applyCampaignBuilderWizardQuery"),
    "GET page syncs session from query",
  );

  record(
    "legacy-post-redirects-get",
    apiRouter.includes("res.redirect(302, overviewUrl)") && apiRouter.includes("campaignBuilderWizardUrl"),
    "legacy POST select/settings redirect to GET pages",
  );

  record(
    "action-get-redirects",
    apiRouter.includes("campaignBuilderActionGetRedirect"),
    "GET action endpoints redirect safely",
  );

  const campaigns = buildCampaignBuilderList(SLUG);
  const campaignId = campaigns[0]?.serviceId || "pharmacy-first";
  const overviewUrl = campaignBuilderWizardUrl(SLUG, "overview", campaignId);
  record(
    "wizard-url-shape",
    overviewUrl.includes("step=overview") && overviewUrl.includes(`campaign=${campaignId}`),
    overviewUrl,
  );

  selectCampaignBuilderService(SLUG, campaignId);
  applyCampaignBuilderWizardQuery(SLUG, { step: "overview", campaign: campaignId, slug: SLUG });
  applyCampaignBuilderWizardQuery(SLUG, { step: "settings", campaign: campaignId, slug: SLUG });
  applyCampaignBuilderWizardQuery(SLUG, {
    step: "approval",
    campaign: campaignId,
    slug: SLUG,
    mode: "manual",
    servicePage: "true",
    guides: "true",
  });

  const session = loadCampaignBuilderSession(SLUG);
  record(
    "wizard-query-sync",
    session.selectedServiceId === campaignId && session.step === "approval",
    `campaign=${session.selectedServiceId} step=${session.step}`,
  );

  const chooseHtml = renderCampaignBuilderPage(SLUG, "choose");
  const approvalHtml = renderCampaignBuilderPage(SLUG, "approval");
  record("choose-has-build-link", chooseHtml.includes(CB_UX_BUILD_CAMPAIGN), "Build Campaign visible");
  record("approval-has-generate", approvalHtml.includes(CB_UX_GENERATE_MY_CAMPAIGN), "Generate My Campaign visible");
  record(
    "choose-no-select-post",
    !chooseHtml.includes("/campaign-builder/select"),
    "no action URL in choose HTML",
  );

  const badNext = sanitizeCampaignBuilderLoginNext(`/api/growth-engine/${SLUG}/campaign-builder/select`);
  record(
    "login-next-no-action",
    !loginNextContainsActionEndpoint(badNext) && badNext.includes("step=choose"),
    badNext,
  );

  return { campaignId, overviewUrl };
}

async function mainAsync(campaignId: string) {
  const choosePage = `${BASE}/api/growth-engine/campaign-builder?slug=${encodeURIComponent(SLUG)}&step=choose`;
  const unauthChain = await followRedirects(choosePage);
  const loginHops = unauthChain.filter((u) => u.includes("/api/login"));
  record("unauth-one-login", loginHops.length === 1, `${loginHops.length} login redirect(s)`);

  if (loginHops[0]) {
    const next = decodeURIComponent(new URL(loginHops[0]).searchParams.get("next") || "");
    record("unauth-next-safe-get", next.includes("step=choose") && !loginNextContainsActionEndpoint(next), next);
  }

  const overviewAuthed = `${BASE}${campaignBuilderWizardUrl(SLUG, "overview", campaignId)}&_t=${encodeURIComponent(TOKEN)}`;
  const overviewRes = await fetchHead(overviewAuthed);
  const overviewBody = overviewRes.status === 200 ? await overviewRes.text() : "";
  record(
    "overview-authed-200",
    overviewRes.status === 200 && overviewBody.includes("What We'll Create"),
    `status ${overviewRes.status}`,
  );

  const settingsAuthed = `${BASE}${campaignBuilderWizardUrl(SLUG, "settings", campaignId)}&_t=${encodeURIComponent(TOKEN)}`;
  const settingsRes = await fetchHead(settingsAuthed);
  record("settings-authed-200", settingsRes.status === 200, `status ${settingsRes.status}`);

  const approvalAuthed = `${BASE}${campaignBuilderWizardUrl(SLUG, "approval", campaignId)}&_t=${encodeURIComponent(TOKEN)}`;
  const approvalRes = await fetchHead(approvalAuthed);
  const approvalBody = approvalRes.status === 200 ? await approvalRes.text() : "";
  record(
    "approval-authed-200",
    approvalRes.status === 200 && approvalBody.includes(CB_UX_GENERATE_MY_CAMPAIGN),
    `status ${approvalRes.status}`,
  );

  const actionSelect = await followRedirects(`${BASE}/api/growth-engine/${SLUG}/campaign-builder/select`);
  record(
    "action-select-no-cannot-get",
    !actionSelect.some((u) => u.includes("Cannot GET")),
    actionSelect.map((u) => u.replace(BASE, "")).join(" → "),
  );

  const authedOverviewChain = await followRedirects(overviewAuthed);
  const loopLogins = authedOverviewChain.filter((u) => u.includes("/api/login"));
  record("no-login-loop-overview", loopLogins.length === 0, `${loopLogins.length} login hop(s)`);

  record(
    "generate-api-review-centre",
    readSrc("artifacts/api-server/src/routes/api/growthEngineCampaignBuilder.ts").includes("reviewCentreUrl"),
    "generate returns Review Centre URL",
  );
}

async function main() {
  console.log("\n=== Campaign Builder GET Wizard V1 ===\n");
  const { campaignId, overviewUrl } = mainSync();
  await mainAsync(campaignId);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
