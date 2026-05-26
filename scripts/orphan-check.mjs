import fs from "node:fs";
import path from "node:path";

const projectSlug = process.argv[2] || "inboxingproweb";
const projectDir = path.join("output", projectSlug);

const registryPath = path.join(projectDir, "page-registry.json");
const sitemapPath = path.join(projectDir, "sitemap.xml");

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function sitemapUrls(file) {
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

const registry = loadJson(registryPath, { pages: [] });

const registryUrls = new Set(
  (registry.pages || [])
    .filter(p => p.status === "live")
    .map(p => p.url)
);

const sitemapSet = new Set(sitemapUrls(sitemapPath));

const missingFromSitemap = [...registryUrls].filter(u => !sitemapSet.has(u));
const missingFromRegistry = [...sitemapSet].filter(u => !registryUrls.has(u));

const report = {
  checkedAt: new Date().toISOString(),
  registryCount: registryUrls.size,
  sitemapCount: sitemapSet.size,
  missingFromSitemap,
  missingFromRegistry,
};

const reportPath = path.join(projectDir, "orphan-check.json");

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log("✓ orphan check complete");
console.log(`Registry URLs: ${registryUrls.size}`);
console.log(`Sitemap URLs: ${sitemapSet.size}`);
console.log(`Missing from sitemap: ${missingFromSitemap.length}`);
console.log(`Missing from registry: ${missingFromRegistry.length}`);

if (missingFromSitemap.length) {
  console.log("\\nMissing from sitemap:");
  missingFromSitemap.forEach(u => console.log(u));
}

if (missingFromRegistry.length) {
  console.log("\\nMissing from registry:");
  missingFromRegistry.forEach(u => console.log(u));
}
