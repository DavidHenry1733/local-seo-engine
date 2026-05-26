import fs from "node:fs";
import path from "node:path";

const projectSlug = process.argv[2] || "inboxingproweb";
const outputDir = "output";
const projectDir = path.join(outputDir, projectSlug);
const registryPath = path.join(projectDir, "page-registry.json");
const domain = "https://local.inboxingproweb.com";

function loadJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return fallback;
}

function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function normaliseUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "local.inboxingproweb.com") return null;
    if (u.pathname.includes("/assets/")) return null;
    if (u.pathname.includes("sitemap")) return null;
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function pageType(slug) {
  if (slug === "home") return "hub";
  if (slug.includes("web-design") || slug.includes("email-marketing") || slug.includes("web-hosting") || slug.includes("local-seo")) return "area";
  return "unknown";
}

const existing = loadJson(registryPath, {
  projectSlug,
  updatedAt: new Date().toISOString(),
  pages: []
});

const byUrl = new Map((existing.pages || []).map(p => [p.url, p]));
const found = new Set();

// 1. Output folders
if (fs.existsSync(projectDir)) {
  for (const entry of fs.readdirSync(projectDir)) {
    const full = path.join(projectDir, entry);
    if (fs.existsSync(path.join(full, "index.html"))) {
      found.add(`${domain}/${entry}/`);
    }
  }
}

// 2. Existing sitemap XML files
if (fs.existsSync(projectDir)) {
  for (const file of fs.readdirSync(projectDir)) {
    if (!file.startsWith("sitemap") || !file.endsWith(".xml")) continue;
    const xml = fs.readFileSync(path.join(projectDir, file), "utf8");
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = normaliseUrl(m[1].trim());
      if (url) found.add(url);
    }
  }
}

// 3. Any known URLs in output reports/sessions/crawls
function scanTextFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanTextFiles(full);
      continue;
    }
    if (!/\.(json|html|xml|txt)$/.test(entry)) continue;

    const text = fs.readFileSync(full, "utf8");
    for (const m of text.matchAll(/https:\/\/local\.inboxingproweb\.com\/[^"'<\s)]+/g)) {
      const url = normaliseUrl(m[0]);
      if (url) found.add(url);
    }
  }
}
scanTextFiles(projectDir);

const now = new Date().toISOString();

for (const url of found) {
  const u = new URL(url);
  const remotePath = u.pathname;
  const slug = remotePath.replace(/^\/|\/$/g, "") || "home";
  const old = byUrl.get(url) || {};

  byUrl.set(url, {
    ...old,
    url,
    slug,
    remotePath,
    type: old.type || pageType(slug),
    status: "live",
    includedInSitemap: old.includedInSitemap !== false,
    priority: old.priority || (slug === "home" ? 1.0 : 0.8),
    lastSeenAt: now,
    source: old.source || "registry-sync"
  });
}

const pages = [...byUrl.values()]
  .filter(p => p.status !== "archived")
  .sort((a, b) => a.url.localeCompare(b.url));

saveJson(registryPath, {
  projectSlug,
  updatedAt: now,
  pages
});

console.log(`✓ registry synced: ${pages.length} live/tracked pages`);
