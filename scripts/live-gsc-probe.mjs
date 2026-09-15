import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const eco = require("../ecosystem.config.cjs");
const pm2Env = eco.apps?.[0]?.env ?? {};
for (const [key, value] of Object.entries(pm2Env)) {
  if (key.startsWith("GSC_") && value) process.env[key] = String(value);
}

const { fetchAccessToken, detectAuthMethod, runIndexTracking } = await import(
  "../src/indexing/indexTrackingEngine.ts"
);

const projectSlug = process.argv[2] || "inboxingproweb";
const mode = process.argv[3] || "probe";

const outDir = path.join(process.cwd(), "output", projectSlug);

async function probe() {
  const out = { generatedAt: new Date().toISOString(), authMethod: detectAuthMethod() };
  const token = await fetchAccessToken();
  out.tokenObtained = !!token;
  if (!token) {
    fs.writeFileSync(path.join(outDir, ".live-gsc-access-probe.json"), JSON.stringify(out, null, 2));
    throw new Error("Failed to obtain GSC access token");
  }

  const listRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listBody = await listRes.json().catch(() => ({}));
  out.sitesListStatus = listRes.status;
  out.accessibleSiteCount = Array.isArray(listBody.siteEntry) ? listBody.siteEntry.length : 0;
  out.accessibleSites = (listBody.siteEntry || []).map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));

  const testUrl = "https://local.inboxingproweb.com/";
  out.propertyProbes = [];
  for (const siteUrl of [
    "https://local.inboxingproweb.com/",
    "sc-domain:local.inboxingproweb.com",
    "sc-domain:inboxingproweb.com",
    "https://inboxingproweb.com/",
  ]) {
    const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: testUrl, siteUrl }),
    });
    out.propertyProbes.push({ siteUrl, status: res.status, ok: res.ok });
  }

  fs.writeFileSync(path.join(outDir, ".live-gsc-access-probe.json"), JSON.stringify(out, null, 2));
  return out;
}

async function refresh() {
  const limit = Number(process.env.GSC_INDEX_LIMIT || "200");
  const report = await runIndexTracking(projectSlug, {
    outputDir: "output",
    limit,
    delayMs: 400,
    concurrency: 5,
  });
  return report;
}

if (mode === "probe") {
  const out = await probe();
  console.log("PROBE_OK", out.sitesListStatus, out.accessibleSiteCount, out.tokenObtained);
} else if (mode === "refresh") {
  await probe();
  const report = await refresh();
  console.log("REFRESH_OK", report.runAt, report.totalChecked, report.indexedCount, report.notIndexedCount, report.unknownCount);
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
