#!/usr/bin/env npx tsx
/**
 * Growth Engine — Founder Partner Dashboard Access V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFounderPartnerWorkflow } from "../src/pharmacy/growthEngineFounderPartnerWorkflow.ts";
import { renderGrowthJourneyDashboardPage } from "../src/pharmacy/growthEngineGrowthJourneyDashboardPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "dhmdigital";

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

const WORKFLOW_STEP_LABELS = [
  "Your Pharmacy",
  "Your Local Market",
  "Your Website Report",
  "Your Growth Plan",
  "Generate Campaign",
  "Review Assets",
  "Approve Content",
  "Prepare Publish Output",
  "Test FTP Connection",
  "Publish to Live Website",
  "Register Pages for Indexing",
  "Submit to Search Console",
];

function main() {
  console.log("\n=== Growth Engine Founder Partner Dashboard Access V1 ===\n");

  const workflow = buildFounderPartnerWorkflow(SLUG);
  record("workflow-builder", workflow.steps.length === 12, `${workflow.steps.length} steps`);
  record("workflow-service", Boolean(workflow.serviceId), workflow.serviceId);

  for (const label of WORKFLOW_STEP_LABELS) {
    const step = workflow.steps.find((s) => s.label === label);
    record(`workflow-step:${label}`, Boolean(step), step?.status || "missing");
  }

  const prepare = workflow.steps.find((s) => s.id === "prepare-publish");
  record("prepare-api", prepare?.apiPath?.includes("/prepare") === true, prepare?.apiPath || "missing");
  record("prepare-body", prepare?.apiBody?.serviceId === workflow.serviceId, "serviceId in body");

  const ftp = workflow.steps.find((s) => s.id === "ftp-test");
  record("ftp-api", ftp?.apiPath?.includes("/ftp-test") === true, ftp?.apiPath || "missing");

  const publish = workflow.steps.find((s) => s.id === "publish-live");
  record("publish-api", publish?.apiPath?.includes("/publish") === true, publish?.apiPath || "missing");
  record("publish-confirm", publish?.confirmMessage?.includes("Publish") === true, "confirm gate");

  const gsc = workflow.steps.find((s) => s.id === "gsc-submit");
  record("gsc-gap-label", gsc?.gapNote?.includes("Operational gap") === true || gsc?.status !== "gap", gsc?.status || "missing");

  const dash = renderGrowthJourneyDashboardPage(SLUG);
  record("dashboard-title", dash.includes("Founder Partner Dashboard"), "branding");
  record("dashboard-workflow-panel", dash.includes("Founder Partner Campaign Workflow"), "workflow panel");
  record("dashboard-no-terminal", !dash.toLowerCase().includes("ssh") && !dash.toLowerCase().includes("putty"), "no terminal references");
  record("dashboard-api-script", dash.includes("data-body") && dash.includes("data-confirm"), "API action wiring");
  record("dashboard-prepare-action", prepare?.apiPath?.includes("/prepare") === true, prepare?.apiPath || "workflow config");
  record("dashboard-ftp-action", ftp?.apiPath?.includes("/ftp-test") === true, ftp?.apiPath || "workflow config");
  record("dashboard-publish-action", publish?.apiPath?.includes("/publish") === true && Boolean(publish?.confirmMessage), "workflow config");
  record("dashboard-gaps", dash.includes("Operational gaps") || workflow.operationalGaps.length === 0, "gap visibility");

  for (const label of WORKFLOW_STEP_LABELS) {
    record(`dashboard-html:${label}`, dash.includes(label), label);
  }

  record(
    "report-exists",
    fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-FOUNDER-PARTNER-DASHBOARD-V1.md")),
    "founder partner report",
  );

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
