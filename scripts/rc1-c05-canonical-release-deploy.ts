#!/usr/bin/env npx tsx
/**
 * RC1-C05 — Deploy validated canonical render to managed live release (copy only).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  readFinalRenderManifest,
  resolveCanonicalFinalRenderRoot,
  validateCanonicalPublishChecksumParity,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PUBLISH_ROOT } from "../src/pharmacy/pharmacyPublishOutputService.ts";
import { readManagedPublishingProfile } from "../src/pharmacy/masterAdminManagedPublishingService.ts";
import { recordMasterAdminAudit } from "../src/pharmacy/masterAdminAuditService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const MANAGED_BASE = process.env.RC1_MANAGED_BASE || "https://banner-cross-pharmacy.sites.pharmaconnect.uk";
const EVIDENCE_DIR = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  SLUG,
  "rc1-c05-evidence",
);

type PageKey = "homepage" | "service" | "guide" | "blog";

const PAGE_FILES: Record<PageKey, string> = {
  homepage: "index.html",
  service: "pharmacy-first/index.html",
  guide: "pharmacy-first-guide/index.html",
  blog: "what-is-pharmacy-first/index.html",
};

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function sha256Content(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function copyTree(src: string, dest: string, skip = new Set(["_publish-index.json"])): number {
  let copied = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copied += copyTree(from, to, skip);
    } else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}

function fileChecksums(root: string): Record<PageKey, { path: string; sha256: string; bytes: number; mtime: string } | null> {
  const out = {} as Record<PageKey, { path: string; sha256: string; bytes: number; mtime: string } | null>;
  for (const [key, rel] of Object.entries(PAGE_FILES) as Array<[PageKey, string]>) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) {
      out[key] = null;
      continue;
    }
    const stat = fs.statSync(file);
    out[key] = {
      path: file,
      sha256: sha256File(file),
      bytes: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  }
  return out;
}

async function fetchPage(url: string): Promise<{ status: number; body: string; ms: number }> {
  const t0 = performance.now();
  const res = await fetch(url, { redirect: "follow" });
  const body = await res.text();
  return { status: res.status, body, ms: Math.round(performance.now() - t0) };
}

async function main(): Promise<void> {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const canonicalRoot = resolveCanonicalFinalRenderRoot(SLUG);
  const publishRoot = path.join(PUBLISH_ROOT, SLUG);
  const profile = readManagedPublishingProfile(SLUG);
  if (!profile) throw new Error("Managed publishing profile missing");

  const currentDir = profile.paths.currentReleasePointer;
  const releaseDir = path.join(profile.paths.releaseDirectory, profile.currentRelease || "v1");
  const manifest = readFinalRenderManifest(SLUG);
  if (!manifest) throw new Error("Canonical render manifest missing");

  const publishChecksum = validateCanonicalPublishChecksumParity(SLUG, publishRoot, manifest);
  if (!publishChecksum.ok) {
    throw new Error(`Publish package not aligned with canonical render: ${publishChecksum.mismatches.join("; ")}`);
  }

  const preCanonical = fileChecksums(canonicalRoot);
  const preManaged = fileChecksums(currentDir);
  const stale = Object.keys(PAGE_FILES).some((k) => {
    const key = k as PageKey;
    return preCanonical[key]?.sha256 !== preManaged[key]?.sha256;
  });

  const deployStartedAt = new Date().toISOString();
  const filesCopiedToCurrent = copyTree(publishRoot, currentDir);
  fs.mkdirSync(releaseDir, { recursive: true });
  const filesCopiedToRelease = copyTree(publishRoot, releaseDir);

  const postManaged = fileChecksums(currentDir);
  const checksumParity = Object.keys(PAGE_FILES).every((k) => {
    const key = k as PageKey;
    return preCanonical[key]?.sha256 === postManaged[key]?.sha256;
  });

  profile.updatedAt = deployStartedAt;
  const profilePath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/managed-publishing", `${SLUG}.json`);
  fs.writeFileSync(profilePath, JSON.stringify({ ...profile, updatedAt: deployStartedAt }, null, 2));

  recordMasterAdminAudit({
    user: "rc1-c05-canonical-release-deploy",
    slug: SLUG,
    action: "deploy_canonical_render_to_managed_current",
    status: checksumParity ? "success" : "warning",
    evidence: `Copied ${filesCopiedToCurrent} file(s) to ${currentDir}; release ${profile.currentRelease || "v1"} updated in place`,
  });

  const liveChecks: Record<string, unknown> = {};
  const urls: Record<string, string> = {
    homepage: `${MANAGED_BASE}/`,
    service: `${MANAGED_BASE}/${SERVICE}/`,
    guide: `${MANAGED_BASE}/pharmacy-first-guide/`,
    blog: `${MANAGED_BASE}/what-is-pharmacy-first/`,
  };

  for (const [key, url] of Object.entries(urls)) {
    const pageKey = key as PageKey;
    const canonicalHash = preCanonical[pageKey]?.sha256 || "";
    try {
      const { status, body, ms } = await fetchPage(url);
      const liveHash = sha256Content(body);
      liveChecks[key] = {
        url,
        status,
        responseMs: ms,
        liveSha256: liveHash,
        canonicalSha256: canonicalHash,
        matchesCanonical: liveHash === canonicalHash,
        hasHeader: /site-header|data-component="brand-header"/i.test(body),
        hasFooter: /site-footer|data-component="brand-footer"/i.test(body),
        hasLogo: /assets\/brands\/|logo\.png|PHH-LOGO/i.test(body),
        noMetaRefresh: !/<meta http-equiv="refresh"/i.test(body),
        faqCount: (body.match(/cluster-faq-item|faq-item|accordion-item/gi) || []).length,
        hasMap: /google\.com\/maps|<iframe[^>]+map/i.test(body),
        hasSchema: /application\/ld\+json/i.test(body),
        noPlaceholder: !/Image will be added before publishing|\[placeholder\]/i.test(body),
      };
    } catch (err) {
      liveChecks[key] = { url, error: String(err) };
    }
  }

  const liveParity = Object.values(liveChecks).every(
    (c) => (c as { matchesCanonical?: boolean }).matchesCanonical === true,
  );

  const report = {
    defect: "RC1-C05",
    slug: SLUG,
    generatedAt: new Date().toISOString(),
    rootCause: "Managed live site served stale pre-canonical release (305-byte meta-refresh homepage). Canonical render and publish package were validated in RC1-C04 but not deployed.",
    releaseUpdated: profile.currentRelease || "v1",
    newReleaseCreated: false,
    staleConfirmed: stale,
    preDeploy: { canonical: preCanonical, managed: preManaged },
    postDeploy: { managed: postManaged },
    filesCopiedToCurrent,
    filesCopiedToRelease,
    canonicalChecksum: preCanonical.homepage?.sha256,
    managedChecksum: postManaged.homepage?.sha256,
    checksumParity: checksumParity && liveParity ? "PASS" : checksumParity ? "PASS_ON_DISK_FAIL_LIVE" : "FAIL",
    liveChecks,
    urlsTested: urls,
    status: checksumParity && liveParity ? "READY FOR PRODUCT OWNER TEST" : "BLOCKED",
  };

  const outFile = path.join(EVIDENCE_DIR, `deploy-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === "READY FOR PRODUCT OWNER TEST" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
