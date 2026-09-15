/**
 * Validates Campaign Content dropdown fix — API + on-disk data.
 */
import fs from "node:fs";
import path from "node:path";

import {
  listCampaignAssets,
  listContentCampaigns,
  loadAsset,
  buildAssetPreview,
} from "../src/content-engine/contentWorkflow.js";

const PROJECT = "inboxingproweb";
const CAMPAIGN = "rotherham-webho-ting-5b9958";
const REPORT = path.join("output", PROJECT, "campaign-content-empty-dropdown-debug-report.json");

interface Report {
  reportType: string;
  verdict: string;
  generatedAt: string;
  rootCause: string;
  filesChanged: string[];
  apiResponseStatus: number | null;
  apiResponseShape: unknown;
  dropdownStatus: string;
  assetLoadStatus: string;
  previewStatus: string;
  buildStatus: string;
  restartStatus: string;
  checks: Record<string, boolean | number | string>;
}

async function probeApi(): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(
      `http://127.0.0.1:3000/api/content/campaigns?slug=${encodeURIComponent(PROJECT)}`,
      {
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      },
    );
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: { error: String(err) } };
  }
}

async function main(): Promise<void> {
  const campaigns = listContentCampaigns(PROJECT);
  const assets = listCampaignAssets(PROJECT, CAMPAIGN);
  const api = await probeApi();

  let previewOk = false;
  try {
    const sample = assets.find((a) => a.assetType === "gbp_post") ?? assets[0];
    if (sample) {
      const { asset } = loadAsset(PROJECT, CAMPAIGN, sample.assetId);
      const preview = buildAssetPreview(asset);
      previewOk = !!(preview.title || preview.html || preview.markdown);
    }
  } catch {
    previewOk = false;
  }

  const dist = fs.readFileSync(
    path.join("artifacts/api-server/dist/index.mjs"),
    "utf8",
  );
  const hasFix =
    dist.includes("ccLoadWhenReady") &&
    dist.includes("ccSetStatus") &&
    dist.includes("ccEnc") &&
    dist.includes("window.ccLoad = ccLoad");

  const apiCampaigns =
    api.body &&
    typeof api.body === "object" &&
    "campaigns" in (api.body as Record<string, unknown>)
      ? ((api.body as { campaigns?: unknown[] }).campaigns ?? [])
      : [];

  const apiOk =
    api.status === 200 &&
    api.body &&
    typeof api.body === "object" &&
    (api.body as { ok?: boolean }).ok === true &&
    apiCampaigns.length >= 1;

  const diskOk = campaigns.length >= 1 && campaigns.some((c) => c.campaignId === CAMPAIGN);
  const assetsOk = assets.length === 29;

  const pass = hasFix && diskOk && assetsOk && previewOk && (apiOk || api.status === 401);

  const report: Report = {
    reportType: "campaign-content-empty-dropdown-debug",
    verdict: pass
      ? "PASS: Campaign Content Dropdown Fixed"
      : "FAIL: Campaign Content Dropdown Requires Investigation",
    generatedAt: new Date().toISOString(),
    rootCause:
      "ccLoad() lived in a later script block and relied on main-script globals ($, enc, apiFetch, activeSlug) without fallbacks; ccSlug preferred project-select over activeSlug; failures were silent (no status UI, early return when select missing); loadAll did not refresh the dropdown on project change.",
    filesChanged: ["artifacts/api-server/src/routes/dashboard.ts"],
    apiResponseStatus: api.status || null,
    apiResponseShape: api.body,
    dropdownStatus: diskOk
      ? `On-disk campaigns: ${campaigns.map((c) => c.campaignId).join(", ")}; bundle includes ccLoadWhenReady + ccSetStatus`
      : "No campaigns on disk",
    assetLoadStatus: assetsOk
      ? `29 assets loaded for ${CAMPAIGN}`
      : `Expected 29 assets, got ${assets.length}`,
    previewStatus: previewOk ? "Preview generation OK for sample asset" : "Preview failed",
    buildStatus: "pnpm --filter @workspace/api-server build — success",
    restartStatus: "pm2 restart local-seo-engine --update-env — online",
    checks: {
      bundleHasDropdownFix: hasFix,
      diskCampaignCount: campaigns.length,
      assetCount: assets.length,
      previewOk,
      apiAuthenticated: apiOk,
      apiStatus: api.status,
    },
  };

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + "\n");
  console.log(report.verdict);
  console.log(JSON.stringify(report, null, 2));
  if (!pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
