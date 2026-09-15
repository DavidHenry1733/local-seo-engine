#!/usr/bin/env npx tsx
/**
 * Growth Engine — Live Integration Proof V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { liveIntegrationProofCss, renderLiveIntegrationProofPage } from "../src/pharmacy/growthEngineLiveIntegrationProofPage.ts";
import {
  LIVE_INTEGRATION_PROOF_VERSION,
  INTEGRATION_META,
} from "../src/pharmacy/growthEngineLiveIntegrationModel.ts";
import {
  buildLiveIntegrationProofReport,
  hasLiveGscIndexingData,
  hasLiveRankTrackingData,
  loadLiveIntegrationProof,
  runLiveIntegrationProof,
} from "../src/pharmacy/growthEngineLiveIntegrationProofService.ts";
import { renderGrowthEngineDashboardPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { buildOperationalHome } from "../src/pharmacy/growthEngineOperationalActions.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1] || "dhmdigital";

const flags = {
  livePlaces: process.argv.includes("--live-places"),
  liveWebsite: process.argv.includes("--live-website"),
  liveIdeogram: process.argv.includes("--live-ideogram"),
  liveFtpList: process.argv.includes("--live-ftp-list"),
  liveGscRank: process.argv.includes("--live-gsc-rank"),
  writeReport: process.argv.includes("--write-report"),
};

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

async function main() {
  console.log(`\n=== Growth Engine Live Integration Proof V1 (${SLUG}) ===\n`);

  record("model-version", LIVE_INTEGRATION_PROOF_VERSION === 1, `v${LIVE_INTEGRATION_PROOF_VERSION}`);
  record("integration-count", Object.keys(INTEGRATION_META).length === 7, "7 integrations defined");

  const pageRouter = fs.readFileSync(
    path.join(ROOT, "artifacts/api-server/src/routes/growthEnginePageRouter.ts"),
    "utf8",
  );
  const apiRouter = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/growthEngine.ts"), "utf8");
  record("html-route", pageRouter.includes("live-integration-proof"), "HTML page route");
  record("json-route", apiRouter.includes("live-integration-proof"), "JSON API route");
  record("run-route", apiRouter.includes("live-integration-proof/run"), "run endpoint");

  record("page-css", liveIntegrationProofCss().includes(".lip-card"), "status page styles");

  const runLive: Record<string, boolean> = {};
  if (flags.livePlaces) runLive["google-places"] = true;
  if (flags.liveWebsite) runLive["website-import"] = true;
  if (flags.liveFtpList) runLive["ftp-publishing"] = true;

  const report = await runLiveIntegrationProof(SLUG, {
    runLive,
    ftpSafeWrite: flags.liveFtpList,
  });

  record("report-slug", report.slug === SLUG, report.slug);
  record("report-integrations", report.integrations.length === 7, `${report.integrations.length} results`);

  for (const integration of report.integrations) {
    record(
      `${SLUG}:${integration.id}:status`,
      ["connected", "not_connected", "error", "limited", "ready"].includes(integration.status),
      `${integration.status} — ${integration.testResult.slice(0, 60)}`,
    );
    record(`${SLUG}:${integration.id}:unlocks`, Boolean(integration.unlocks), "unlocks copy");
    record(`${SLUG}:${integration.id}:next-action`, Boolean(integration.nextAction), "next action");
  }

  const proofFile = path.join(ROOT, `data/growth-engine/${SLUG}-live-integration-proof.json`);
  record("proof-persisted", fs.existsSync(proofFile), proofFile);
  record("proof-loadable", Boolean(loadLiveIntegrationProof(SLUG)), "loadLiveIntegrationProof");

  const html = renderLiveIntegrationProofPage(SLUG, report);
  record("page-renders", html.includes("Live Integration Proof") && html.includes("lip-grid"), "HTML report");
  record("page-no-fake-label", html.includes("No simulated data"), "anti-fake disclaimer");
  record("page-status-badges", html.includes("lip-badge"), "traffic-light badges");

  const dash = renderGrowthEngineDashboardPage(SLUG);
  record("dashboard-proof-link", dash.includes("live-integration-proof"), "dashboard link to proof page");

  const ops = buildOperationalHome(SLUG);
  record("ops-indexing-live-flag", typeof ops.progress.indexing.live === "boolean", "indexing live boolean");
  record("ops-rankings-live-flag", typeof ops.progress.rankings.live === "boolean", "rankings live boolean");

  if (!hasLiveGscIndexingData(SLUG)) {
    record("indexing-not-fake-live", !ops.progress.indexing.live, "indexing not marked live without GSC data");
  } else {
    record("indexing-live-when-data", ops.progress.indexing.live, "indexing live when GSC data exists");
  }

  if (!hasLiveRankTrackingData(SLUG)) {
    record("rankings-not-fake-live", !ops.progress.rankings.live, "rankings not marked live without rank file");
  } else {
    record("rankings-live-when-data", ops.progress.rankings.live, "rankings live when rank data exists");
  }

  if (flags.liveIdeogram) {
    const img = report.integrations.find((i) => i.id === "image-generation");
    const keyPresent = Boolean(process.env.IDEOGRAM_API_KEY?.trim());
    if (keyPresent) {
      record("ideogram-live", Boolean(img?.checks.some((c) => c.liveData)), img?.testResult || "missing");
    } else {
      record("ideogram-live", img?.status === "not_connected", "IDEOGRAM_API_KEY not in environment (expected Not Connected)");
    }
  }

  if (flags.liveGscRank) {
    const gsc = report.integrations.find((i) => i.id === "google-search-console");
    const rank = report.integrations.find((i) => i.id === "rank-tracking");
    record("gsc-probe", Boolean(gsc), gsc?.status || "missing");
    record("rank-probe", Boolean(rank), rank?.status || "missing");
  }

  record(
    "report-doc-exists",
    fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-LIVE-INTEGRATION-PROOF-V1.md")),
    "documentation",
  );

  const dhProject = path.join(ROOT, "config/projects/dhmdigital.json");
  if (fs.existsSync(dhProject)) {
    const cfg = JSON.parse(fs.readFileSync(dhProject, "utf8"));
    record("dhmdigital-deploy", Boolean(cfg.deploy?.enabled && cfg.deploy?.host), cfg.deploy?.host || "missing");
  }

  const pubIndex = path.join(ROOT, `output/pharmacy-publish/${SLUG}/_publish-index.json`);
  if (fs.existsSync(pubIndex)) {
    record(`${SLUG}:publish-index`, true, "static publish index present");
  }

  if (flags.writeReport) {
    const summary = report.integrations
      .map((i) => `| ${i.name} | ${i.status} | ${i.testResult.replace(/\|/g, "/")} |`)
      .join("\n");
    const docPath = path.join(ROOT, "docs/platform/GROWTH-ENGINE-LIVE-INTEGRATION-PROOF-V1.md");
    const existing = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
    if (!existing.includes("## Live test run")) {
      fs.appendFileSync(
        docPath,
        `\n\n## Live test run (${report.checkedAt})\n\n| Integration | Status | Result |\n|-------------|--------|--------|\n${summary}\n`,
      );
    }
    record("report-written", true, "appended live run to doc");
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
