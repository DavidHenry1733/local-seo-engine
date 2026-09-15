#!/usr/bin/env npx tsx
/**
 * Growth Engine — Live Publishing Connection V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPharmacyDeployConfig } from "../src/pharmacy/pharmacyDeployConfig.ts";
import {
  deployPharmacyPublishOutput,
  getPharmacyLivePublishStatus,
  preparePharmacyPublishOutput,
  resolvePreparePublishContext,
} from "../src/pharmacy/pharmacyLivePublishService.ts";
import { getPharmacyPublishOutputStatus } from "../src/pharmacy/pharmacyPublishOutputService.ts";
import { runLiveIntegrationProof } from "../src/pharmacy/growthEngineLiveIntegrationProofService.ts";
import {
  getContentEcosystemIndexPath,
  PHARMACY_WORKSPACE_ROOT,
  resolveContentEcosystemIndexPath,
} from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "dhmdigital";
const SERVICE = "blood-pressure-checks";

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
  console.log("\n=== Growth Engine Live Publishing Connection V1 ===\n");

  const project = JSON.parse(fs.readFileSync(path.join(ROOT, "config/projects/dhmdigital.json"), "utf8"));
  record("dhmdigital-deploy-config", Boolean(project.deploy?.enabled && project.deploy?.host), project.deploy?.host || "missing");
  record("dhmdigital-domain", project.domain === "https://dhmdigital.net", project.domain);

  const deploy = loadPharmacyDeployConfig(SLUG);
  record("deploy-resolver", deploy.configured, deploy.host);

  const pubApi = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyPublishing.ts"), "utf8");
  record("prepare-route", pubApi.includes("/prepare"), "POST prepare");
  record("ftp-test-route", pubApi.includes("/ftp-test"), "POST ftp-test");
  record("publish-route", pubApi.includes("/publish"), "POST publish explicit");
  record("publish-requires-confirm", pubApi.includes("confirm"), "confirm gate");

  const settingsPage = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/pharmacyPublishingSettingsPage.ts"), "utf8");
  record("settings-live-panel", settingsPage.includes("Live publishing"), "dashboard panel");
  record("settings-no-auto", settingsPage.includes("never runs automatically"), "no auto publish copy");

  const canonicalEco = getContentEcosystemIndexPath(SLUG, SERVICE);
  record("ecosystem-canonical-path", fs.existsSync(canonicalEco), canonicalEco);

  const resolvedEco = resolveContentEcosystemIndexPath(SLUG, SERVICE);
  record("ecosystem-lookup", Boolean(resolvedEco && fs.existsSync(resolvedEco)), resolvedEco || "missing");

  const ctx = resolvePreparePublishContext(SLUG, SERVICE);
  record("prepare-context", ctx.slug === SLUG && ctx.serviceId === SERVICE, `${ctx.slug}/${ctx.serviceId}`);

  const prevRoot = process.env.WORKSPACE_ROOT;
  process.env.WORKSPACE_ROOT = "/tmp/nonexistent-pharmacy-workspace";
  try {
    const wrongRootResolved = resolveContentEcosystemIndexPath(SLUG, SERVICE);
    record(
      "ecosystem-lookup-wrong-env-root",
      Boolean(wrongRootResolved && fs.existsSync(wrongRootResolved)),
      wrongRootResolved || "missing",
    );
  } finally {
    if (prevRoot === undefined) delete process.env.WORKSPACE_ROOT;
    else process.env.WORKSPACE_ROOT = prevRoot;
  }

  record("workspace-root-marker", PHARMACY_WORKSPACE_ROOT.includes("pharmaconnect-growth-engine"), PHARMACY_WORKSPACE_ROOT);

  const prepared = preparePharmacyPublishOutput(SLUG, SERVICE);
  record("prepare-output", prepared.pageCount > 0, `${prepared.pageCount} pages`);

  const indexFile = path.join(ROOT, "output/pharmacy-publish/dhmdigital/_publish-index.json");
  record("publish-index", fs.existsSync(indexFile), indexFile);

  const sitemapFile = path.join(ROOT, "output/pharmacy-publish/dhmdigital/sitemap.xml");
  record("sitemap-generated", fs.existsSync(sitemapFile), sitemapFile);

  const output = getPharmacyPublishOutputStatus(SLUG);
  record("static-output-detected", output.pageCount > 0, `${output.pageCount} pages`);

  const bpcHtml = path.join(ROOT, "output/pharmacy-publish/dhmdigital/blood-pressure-checks/index.html");
  record("bpc-index-page", fs.existsSync(bpcHtml), "service page");

  const status = getPharmacyLivePublishStatus(SLUG);
  record("publish-status-written", Boolean(status.lastPreparedAt), status.lastPreparedAt || "missing");
  record("status-file", fs.existsSync(path.join(ROOT, "data/pharmacy-publish-status/dhmdigital.json")), "persisted");

  try {
    await deployPharmacyPublishOutput(SLUG, { confirm: false });
    record("no-publish-without-confirm", false, "should have thrown");
  } catch {
    record("no-publish-without-confirm", true, "blocked without confirm");
  }

  const proof = await runLiveIntegrationProof(SLUG);
  const staticPub = proof.integrations.find((i) => i.id === "static-publishing");
  const ftpPub = proof.integrations.find((i) => i.id === "ftp-publishing");
  record("proof-static-ready", staticPub?.status === "ready" || staticPub?.status === "connected", staticPub?.status || "missing");
  record("proof-ftp-configured", ftpPub?.status !== "not_connected", ftpPub?.status || "missing");

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
