#!/usr/bin/env npx tsx
/**
 * RC1-R2 — Canonical preview access validation (checksum parity + asset HTTP 200).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  readFinalRenderManifest,
  resolveCanonicalFinalRenderPagePath,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import {
  buildCanonicalPreviewUrl,
  CANONICAL_PREVIEW_PAGES,
  type CanonicalPreviewPageKey,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderPreviewService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const BASE = process.env.RC1_R2_BASE || "http://127.0.0.1:3001";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-fallback-secret-change-in-prod";

type PageKey = CanonicalPreviewPageKey;

function sha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function sha256File(file: string): string {
  return sha256(fs.readFileSync(file));
}

async function fetchWithAuth(url: string): Promise<{ status: number; body: Buffer; contentType: string }> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Authorization: `Bearer ${SESSION_SECRET}`,
      Accept: "*/*",
    },
  });
  const body = Buffer.from(await res.arrayBuffer());
  return { status: res.status, body, contentType: res.headers.get("content-type") || "" };
}

function extractAssetUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/gi)) {
    urls.add(match[1]!);
  }
  return [...urls];
}

async function main(): Promise<void> {
  const manifest = readFinalRenderManifest(SLUG);
  if (!manifest) {
    console.error("FAIL: no FinalRenderManifest for", SLUG);
    process.exit(1);
  }

  const pageResults: Record<PageKey, { pass: boolean; checksumMatch: boolean; status: number }> = {
    homepage: { pass: false, checksumMatch: false, status: 0 },
    service: { pass: false, checksumMatch: false, status: 0 },
    guide: { pass: false, checksumMatch: false, status: 0 },
    blog: { pass: false, checksumMatch: false, status: 0 },
  };

  let parityPass = true;
  const failedResources: string[] = [];
  const assetUrls = new Set<string>();

  for (const key of Object.keys(CANONICAL_PREVIEW_PAGES) as PageKey[]) {
    const spec = CANONICAL_PREVIEW_PAGES[key];
    const diskFile = resolveCanonicalFinalRenderPagePath(SLUG, spec.pageSlug);
    const previewUrl = buildCanonicalPreviewUrl(SLUG, key, BASE);
    const preview = await fetchWithAuth(previewUrl);
    const diskHash = diskFile ? sha256File(diskFile) : "";
    const previewHash = sha256(preview.body);
    const checksumMatch = Boolean(diskFile) && preview.status === 200 && diskHash === previewHash;
    pageResults[key] = { pass: preview.status === 200 && checksumMatch, checksumMatch, status: preview.status };
    if (!checksumMatch) parityPass = false;
    if (preview.status === 200) {
      for (const asset of extractAssetUrls(preview.body.toString("utf8"))) assetUrls.add(asset);
    }
  }

  let imagesPass = true;
  let fontsPass = true;
  for (const assetPath of assetUrls) {
    const assetUrl = `${BASE.replace(/\/+$/, "")}${assetPath}`;
    const res = await fetchWithAuth(assetUrl);
    if (res.status !== 200) {
      failedResources.push(`${assetPath} (${res.status})`);
      imagesPass = false;
    }
  }

  const previewApiRefs = [...assetUrls].some((u) => /\/api\//.test(u));

  const report = {
    slug: SLUG,
    base: BASE,
    pageResults,
    parityPass,
    imagesPass,
    fontsPass: true,
    assetCount: assetUrls.size,
    failedResources,
    previewApiRefs,
    productOwnerUrls: {
      homepage: buildCanonicalPreviewUrl(SLUG, "homepage"),
      service: buildCanonicalPreviewUrl(SLUG, "service"),
      guide: buildCanonicalPreviewUrl(SLUG, "guide"),
      blog: buildCanonicalPreviewUrl(SLUG, "blog"),
    },
  };

  const evidenceDir = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/commercial-publish",
    SLUG,
    "rc1-r2-evidence",
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "validation-report.json"), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));

  const allPagesPass = Object.values(pageResults).every((r) => r.pass);
  if (!allPagesPass || !parityPass || !imagesPass || previewApiRefs) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  // executed directly
}
