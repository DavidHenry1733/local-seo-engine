import fs from "node:fs";
import path from "node:path";

const projectSlug = "inboxingproweb";
const inputFile = "/tmp/local-page-urls.txt";
const outputDir = "output";
const projectDir = path.join(outputDir, projectSlug);
const registryPath = path.join(projectDir, "page-registry.json");

const now = new Date().toISOString();

const urls = fs.readFileSync(inputFile, "utf8")
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(Boolean);

const pages = urls.map(url => {
  const u = new URL(url);
  const remotePath = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
  const slug = remotePath.replace(/^\/|\/$/g, "") || "home";

  return {
    url,
    slug,
    remotePath,
    type: slug === "home" ? "hub" : "area",
    status: "live",
    includedInSitemap: true,
    priority: slug === "home" ? 1.0 : 0.8,
    lastSeenAt: now,
    source: "seed-from-known-local-urls"
  };
});

fs.writeFileSync(registryPath, JSON.stringify({
  projectSlug,
  updatedAt: now,
  pages
}, null, 2));

console.log(`✓ seeded ${pages.length} page URLs into ${registryPath}`);
