#!/usr/bin/env npx tsx
/**
 * RC1-C02 — Re-prepare and sync complete publish package to managed current (same release v1).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { preparePharmacyPublishOutput } from "../src/pharmacy/pharmacyLivePublishService.ts";
import { PUBLISH_ROOT } from "../src/pharmacy/pharmacyPublishOutputService.ts";
import { readManagedPublishingProfile, hydrateManagedPublishingForPublishing, projectConfigPath } from "../src/pharmacy/masterAdminManagedPublishingService.ts";
import { loadPharmacyDeployConfig } from "../src/pharmacy/pharmacyDeployConfig.ts";

const SLUG = "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";

function sha256(file: string): string {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(file));
  return h.digest("hex").slice(0, 16);
}

async function loadSftp() {
  const mod = await import("ssh2-sftp-client");
  return mod.default;
}

async function uploadTree(client: any, localDir: string, remoteDir: string, skip = new Set(["_publish-index.json"])): Promise<number> {
  let count = 0;
  await client.mkdir(remoteDir, true);
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const localPath = path.join(localDir, entry.name);
    const remotePath = `${remoteDir}/${entry.name}`.replace(/\/+/g, "/");
    if (entry.isDirectory()) count += await uploadTree(client, localPath, remotePath, skip);
    else {
      await client.put(localPath, remotePath);
      count += 1;
    }
  }
  return count;
}

async function main(): Promise<void> {
  const prepared = await preparePharmacyPublishOutput(SLUG, SERVICE);
  const localRoot = path.join(PUBLISH_ROOT, SLUG);
  const visual = path.join(localRoot, SERVICE, "index.html");
  const visualSource = path.join(PUBLISH_ROOT, "..", "pharmacy-visual-experience", SLUG, SERVICE, "index.html");

  const comparison = {
    preparedPages: prepared.pageCount,
    localRoot,
    servicePageSha: fs.existsSync(visual) ? sha256(visual) : null,
    visualSourceSha: fs.existsSync(visualSource) ? sha256(visualSource) : null,
    servicePageMatchesVisual: fs.existsSync(visual) && fs.existsSync(visualSource) ? sha256(visual) === sha256(visualSource) : false,
    assetFiles: fs.existsSync(path.join(localRoot, "assets")) ? fs.readdirSync(path.join(localRoot, "assets"), { recursive: true }).length : 0,
    hasRootIndex: fs.existsSync(path.join(localRoot, "index.html")),
  };

  const profile = readManagedPublishingProfile(SLUG);
  if (!profile) throw new Error("Managed publishing profile missing");
  const restore = hydrateManagedPublishingForPublishing(SLUG, projectConfigPath(SLUG));
  const deploy = loadPharmacyDeployConfig(SLUG);
  const remoteCurrent = profile.paths.currentReleasePointer.replace(/\/+$/, "");

  const SftpClient = await loadSftp();
  const client = new SftpClient();
  try {
    await client.connect({
      host: deploy.host,
      port: deploy.port || 22,
      username: deploy.username,
      password: deploy.password,
      readyTimeout: 20000,
    });
    const uploaded = await uploadTree(client, localRoot, remoteCurrent);
    console.log(JSON.stringify({ comparison, uploaded, remoteCurrent }, null, 2));
  } finally {
    client.end();
    restore();
  }

  const base = profile.managedUrl.replace(/\/+$/, "");
  const checks = [
    ["homepage", `${base}/`],
    ["service", `${base}/${SERVICE}/`],
    ["guide", `${base}/pharmacy-first-guide/`],
    ["blog", `${base}/what-is-pharmacy-first/`],
    ["asset", `${base}/assets/pharmacy-image-library/clinical-nhs-services/pharmacy-first.svg`],
  ];
  const validation: Record<string, unknown> = {};
  for (const [name, url] of checks) {
    const t0 = performance.now();
    const res = await fetch(url, { redirect: "follow" });
    const body = name === "asset" ? "" : await res.text();
    validation[name] = {
      url,
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type"),
      responseMs: Math.round(performance.now() - t0),
      hasHeader: body.includes("site-header") || body.includes("<header"),
      hasFooter: body.includes("site-footer") || body.includes("<footer"),
      hasStyle: body.includes("<style") || res.headers.get("content-type")?.includes("svg"),
    };
  }
  console.log(JSON.stringify({ validation }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
