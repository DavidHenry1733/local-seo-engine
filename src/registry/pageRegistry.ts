import fs from "node:fs";
import path from "node:path";

export type PageStatus = "live" | "draft" | "archived" | "error";

export interface PageRegistryEntry {
  url: string;
  slug: string;
  remotePath: string;
  campaignId?: string;
  label?: string;
  type?: "hub" | "area" | "supporting" | "unknown";
  status: PageStatus;
  includedInSitemap: boolean;
  priority: number;
  lastSeenAt: string;
  lastDeployedAt?: string;
  indexed?: boolean;
  lastIndexCheckedAt?: string;
  source?: string;
}

export interface PageRegistry {
  projectSlug: string;
  updatedAt: string;
  pages: PageRegistryEntry[];
}

function registryPath(outputDir: string, projectSlug: string): string {
  return path.join(outputDir, projectSlug, "page-registry.json");
}

export function loadRegistry(projectSlug: string, outputDir = "output"): PageRegistry {
  const p = registryPath(outputDir, projectSlug);

  if (!fs.existsSync(p)) {
    return {
      projectSlug,
      updatedAt: new Date().toISOString(),
      pages: [],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as PageRegistry;
    return {
      projectSlug,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      pages: Array.isArray(parsed.pages) ? parsed.pages : [],
    };
  } catch {
    return {
      projectSlug,
      updatedAt: new Date().toISOString(),
      pages: [],
    };
  }
}

export function saveRegistry(registry: PageRegistry, outputDir = "output"): void {
  const p = registryPath(outputDir, registry.projectSlug);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  registry.updatedAt = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(registry, null, 2), "utf8");
}

function normaliseRemotePath(remotePath: string): string {
  if (!remotePath) return "/";
  let p = remotePath.startsWith("/") ? remotePath : `/${remotePath}`;
  if (!p.endsWith("/")) p += "/";
  return p;
}

function slugFromRemotePath(remotePath: string): string {
  return normaliseRemotePath(remotePath).replace(/^\/|\/$/g, "") || "home";
}

export function upsertPage(
  projectSlug: string,
  entry: Partial<PageRegistryEntry> & { url: string; remotePath: string },
  outputDir = "output",
): PageRegistry {
  const registry = loadRegistry(projectSlug, outputDir);
  const remotePath = normaliseRemotePath(entry.remotePath);
  const slug = entry.slug || slugFromRemotePath(remotePath);
  const now = new Date().toISOString();

  const clean: PageRegistryEntry = {
    url: entry.url,
    slug,
    remotePath,
    campaignId: entry.campaignId,
    label: entry.label,
    type: entry.type || "unknown",
    status: entry.status || "live",
    includedInSitemap: entry.includedInSitemap ?? true,
    priority: entry.priority ?? 0.8,
    lastSeenAt: now,
    lastDeployedAt: entry.lastDeployedAt,
    indexed: entry.indexed,
    lastIndexCheckedAt: entry.lastIndexCheckedAt,
    source: entry.source || "unknown",
  };

  const idx = registry.pages.findIndex(
    p => p.url === clean.url || p.remotePath === clean.remotePath,
  );

  if (idx >= 0) {
    registry.pages[idx] = {
      ...registry.pages[idx],
      ...clean,
      lastSeenAt: now,
    };
  } else {
    registry.pages.push(clean);
  }

  saveRegistry(registry, outputDir);
  return registry;
}

export function markPageArchived(
  projectSlug: string,
  remotePathOrUrl: string,
  outputDir = "output",
): PageRegistry {
  const registry = loadRegistry(projectSlug, outputDir);
  const needle = remotePathOrUrl.trim();

  for (const page of registry.pages) {
    if (page.url === needle || page.remotePath === normaliseRemotePath(needle)) {
      page.status = "archived";
      page.includedInSitemap = false;
      page.lastSeenAt = new Date().toISOString();
    }
  }

  saveRegistry(registry, outputDir);
  return registry;
}

export function getLivePages(projectSlug: string, outputDir = "output"): PageRegistryEntry[] {
  return loadRegistry(projectSlug, outputDir).pages
    .filter(p => p.status === "live" && p.includedInSitemap)
    .sort((a, b) => b.priority - a.priority || a.url.localeCompare(b.url));
}
