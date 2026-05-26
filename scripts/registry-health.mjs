import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";

const projectSlug = process.argv[2] || "inboxingproweb";
const projectDir = path.join("output", projectSlug);
const registryPath = path.join(projectDir, "page-registry.json");
const reportPath = path.join(projectDir, "registry-health.json");

function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return fallback;
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.request(url, { method: "HEAD", timeout: 15000 }, (res) => {
      resolve({
        url,
        status: res.statusCode || 0,
        ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 400,
      });
      res.resume();
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ url, status: 0, ok: false, error: "timeout" });
    });

    req.on("error", (err) => {
      resolve({ url, status: 0, ok: false, error: err.message });
    });

    req.end();
  });
}

const registry = loadJson(registryPath, { pages: [] });
const pages = (registry.pages || []).filter(p =>
  p.status === "live" &&
  p.includedInSitemap !== false &&
  p.url
);

const results = [];

for (const page of pages) {
  const check = await checkUrl(page.url);
  results.push({
    ...page,
    liveStatus: check.status,
    liveOk: check.ok,
    liveError: check.error || null,
    checkedAt: new Date().toISOString(),
  });
}

const liveOk = results.filter(r => r.liveOk).length;
const failed = results.filter(r => !r.liveOk);

const report = {
  projectSlug,
  runAt: new Date().toISOString(),
  totalTracked: results.length,
  liveOk,
  failedCount: failed.length,
  failed,
  results,
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log(`✓ registry health complete`);
console.log(`Tracked: ${report.totalTracked}`);
console.log(`Live OK: ${report.liveOk}`);
console.log(`Failed: ${report.failedCount}`);

if (failed.length) {
  console.log("Failed URLs:");
  for (const f of failed) console.log(`${f.liveStatus} ${f.url}`);
}
