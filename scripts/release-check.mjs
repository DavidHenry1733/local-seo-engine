import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import http from "node:http";

const projectSlug = process.argv[2] || "inboxingproweb";
const projectDir = path.join("output", projectSlug);

function run(label, cmd, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

function countLocs(file) {
  if (!fs.existsSync(file)) return 0;
  const xml = fs.readFileSync(file, "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].length;
}

function appHealth() {
  return new Promise((resolve) => {
    const req = http.request("http://127.0.0.1:3000/", { method: "HEAD", timeout: 10000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
    req.end();
  });
}

run("Post-deploy checks", "pnpm", ["post-deploy-check"]);

console.log("\n▶ Sitemap validation");
const sitemapCount = countLocs(path.join(projectDir, "sitemap.xml"));
const registry = JSON.parse(fs.readFileSync(path.join(projectDir, "page-registry.json"), "utf8"));
const registryCount = (registry.pages || []).filter(p => p.status === "live" && p.includedInSitemap !== false).length;

console.log(`Sitemap URLs: ${sitemapCount}`);
console.log(`Registry live URLs: ${registryCount}`);

if (sitemapCount !== registryCount) {
  console.error(`✗ Sitemap/registry mismatch: sitemap=${sitemapCount}, registry=${registryCount}`);
  process.exit(1);
}

console.log("✓ Sitemap matches registry");

console.log("\n▶ App health");
const ok = await appHealth();
if (!ok) {
  console.error("✗ App is not responding on port 3000");
  process.exit(1);
}
console.log("✓ App responding on port 3000");

run("Orphan check", "node", ["scripts/orphan-check.mjs", projectSlug]);
run("Platform status", "node", ["scripts/platform-status.mjs", projectSlug]);

console.log("\n✓ Release check passed");
