import fs from "node:fs";
import path from "node:path";

const projectSlug = process.argv[2] || "inboxingproweb";
const projectDir = path.join("output", projectSlug);

function load(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

const registry = load(path.join(projectDir, "page-registry.json"));
const health   = load(path.join(projectDir, "registry-health.json"));
const orphan   = load(path.join(projectDir, "orphan-check.json"));

const livePages = (registry.pages || []).filter(p => p.status === "live").length;

const status = {
  checkedAt: new Date().toISOString(),

  livePages,

  liveOk: health.liveOk || 0,
  failedPages: health.failedCount || 0,

  sitemapUrls: orphan.sitemapCount || 0,
  registryUrls: orphan.registryCount || 0,

  missingFromSitemap: (orphan.missingFromSitemap || []).length,
  missingFromRegistry: (orphan.missingFromRegistry || []).length,

  healthy:
    (health.failedCount || 0) === 0 &&
    (orphan.missingFromSitemap || []).length === 0 &&
    (orphan.missingFromRegistry || []).length === 0
};

const out = path.join(projectDir, "platform-status.json");

fs.writeFileSync(out, JSON.stringify(status, null, 2));

console.log("✓ platform status generated");
console.log(JSON.stringify(status, null, 2));
