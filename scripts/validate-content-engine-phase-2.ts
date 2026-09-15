/**
 * Phase 2 workflow validation — exercises workflow layer without modifying generator.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  approveAsset,
  buildAssetPreview,
  listContentCampaigns,
  loadAsset,
  publishAsset,
  reviewAsset,
  saveAsset,
} from "../src/content-engine/contentWorkflow";

const PROJECT = "inboxingproweb";
const CAMPAIGN = "rotherham-webho-ting-5b9958";
const TEST_ASSET = "asset-gbp-004";

function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function restoreAsset(fromPath: string, toPath: string): void {
  fs.copyFileSync(fromPath, toPath);
}

interface Report {
  reportType: string;
  verdict: string;
  generatedAt: string;
  projectSlug: string;
  campaignId: string;
  checks: Record<string, { passed: boolean; detail: string }>;
  apiRoutes: string[];
  dashboardComponents: string[];
  registrySha256: string;
  sitemapSha256: string;
  generatorSha256: string;
  buildStatus?: { passed: boolean; exitCode: number };
}

function main(): Report {
  const root = path.join(process.cwd(), "output", PROJECT, "campaign-content", CAMPAIGN);
  const assetFile = path.join(root, "assets", `${TEST_ASSET}.json`);
  const manifestFile = path.join(root, "campaignContent.json");
  const backup = path.join(root, "assets", `${TEST_ASSET}.phase2-backup.json`);

  const registryPath = path.join(process.cwd(), "output", PROJECT, "page-registry.json");
  const sitemapPath = path.join(process.cwd(), "output", PROJECT, "sitemap.xml");
  const generatorPath = path.join(process.cwd(), "src/content-engine/generateCampaignContentAssets.ts");

  const registryBefore = hashFile(registryPath);
  const sitemapBefore = hashFile(sitemapPath);
  const generatorBefore = hashFile(generatorPath);

  fs.copyFileSync(assetFile, backup);
  const checks: Report["checks"] = {};

  try {
    const campaigns = listContentCampaigns(PROJECT);
    checks.listCampaigns = {
      passed: campaigns.some((c) => c.campaignId === CAMPAIGN),
      detail: `${campaigns.length} campaign(s)`,
    };

    const before = loadAsset(PROJECT, CAMPAIGN, TEST_ASSET);
    checks.previewLoads = {
      passed: buildAssetPreview(before.asset).previewKind === "social",
      detail: buildAssetPreview(before.asset).previewKind,
    };

    const reviewed = reviewAsset(PROJECT, CAMPAIGN, TEST_ASSET);
    checks.reviewTransition = {
      passed: reviewed.status === "reviewed",
      detail: reviewed.status,
    };

    const saved = saveAsset(PROJECT, CAMPAIGN, TEST_ASSET, {
      payload: { postText: `${(before.asset.payload.postText as string) ?? ""} [phase2-test]` },
      editedBy: "phase2-validator",
    });
    checks.saveWorks = {
      passed: (saved.revision ?? 0) >= 1 && saved.status === "reviewed",
      detail: `rev ${saved.revision}, status ${saved.status}`,
    };

    const histDir = path.join(root, "history");
    const histFiles = fs.existsSync(histDir)
      ? fs.readdirSync(histDir).filter((f) => f.startsWith(TEST_ASSET))
      : [];
    checks.revisionHistory = {
      passed: histFiles.length > 0,
      detail: `${histFiles.length} history file(s) for ${TEST_ASSET}`,
    };

    const approved = approveAsset(PROJECT, CAMPAIGN, TEST_ASSET);
    checks.approveTransition = {
      passed: approved.status === "approved",
      detail: approved.status,
    };

    const published = publishAsset(PROJECT, CAMPAIGN, TEST_ASSET);
    checks.publishTransition = {
      passed: published.asset.status === "published" && published.exportPaths.length > 0,
      detail: `status ${published.asset.status}, exports: ${published.exportPaths.join(", ")}`,
    };

    const exportJson = path.join(root, published.exportPaths[0] ?? "");
    checks.exportCreated = {
      passed: fs.existsSync(exportJson),
      detail: exportJson,
    };

    checks.manifestUpdated = {
      passed: fs.existsSync(manifestFile),
      detail: manifestFile,
    };
  } finally {
    restoreAsset(backup, assetFile);
    fs.unlinkSync(backup);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const assets = manifest.assetIndex.map((id: string) =>
      JSON.parse(fs.readFileSync(path.join(root, "assets", `${id}.json`), "utf8")),
    );
    const byStatus = { draft: 0, generated: 0, reviewed: 0, approved: 0, published: 0, rejected: 0 };
    for (const a of assets) byStatus[a.status as keyof typeof byStatus]++;
    manifest.summary.byStatus = byStatus;
    manifest.updatedAt = new Date().toISOString();
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
    const exportDir = path.join(root, "exports/gbp");
    if (fs.existsSync(exportDir)) {
      for (const f of fs.readdirSync(exportDir).filter((x) => x.includes(TEST_ASSET))) {
        fs.unlinkSync(path.join(exportDir, f));
      }
    }
  }

  checks.generatorUnchanged = {
    passed: hashFile(generatorPath) === generatorBefore,
    detail: "sha256 match",
  };
  checks.registryUnchanged = {
    passed: hashFile(registryPath) === registryBefore,
    detail: `${JSON.parse(fs.readFileSync(registryPath, "utf8")).pages?.length ?? "?"} URLs`,
  };
  checks.sitemapUnchanged = {
    passed: hashFile(sitemapPath) === sitemapBefore,
    detail: `${(fs.readFileSync(sitemapPath, "utf8").match(/<loc>/g) ?? []).length} URLs`,
  };

  const rolloutPath = path.join(process.cwd(), "artifacts/api-server/src/routes/api/rollout.ts");
  checks.deploymentLogicUntouched = {
    passed: !fs.readFileSync(rolloutPath, "utf8").includes("contentWorkflow"),
    detail: "rollout.ts has no content workflow imports",
  };

  const passed = Object.values(checks).every((c) => c.passed);

  return {
    reportType: "content-engine-phase-2-workflow",
    verdict: passed
      ? "PASS: Content Engine Phase 2 Workflow Complete"
      : "FAIL: Content Engine Workflow Requires Investigation",
    generatedAt: new Date().toISOString(),
    projectSlug: PROJECT,
    campaignId: CAMPAIGN,
    checks,
    apiRoutes: [
      "GET /api/content/campaigns",
      "GET /api/content/:campaignId",
      "GET /api/content/:campaignId/:assetId",
      "POST /api/content/:campaignId/:assetId/review",
      "POST /api/content/:campaignId/:assetId/approve",
      "POST /api/content/:campaignId/:assetId/reject",
      "POST /api/content/:campaignId/:assetId/publish",
      "POST /api/content/:campaignId/:assetId/save",
    ],
    dashboardComponents: [
      "tab-campaign-content",
      "panel-campaign-content",
      "ccLoad / ccRenderTable / ccOpenAsset / ccAction / ccSaveEdit",
    ],
    registrySha256: registryBefore,
    sitemapSha256: sitemapBefore,
    generatorSha256: generatorBefore,
  };
}

const report = main();
const outPath = path.join(process.cwd(), "output/inboxingproweb/content-engine-phase-2-workflow-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(report.verdict);
console.log(`Report: ${outPath}`);
if (!report.checks || Object.values(report.checks).some((c) => !c.passed)) {
  console.log(JSON.stringify(report.checks, null, 2));
  process.exitCode = 1;
}
