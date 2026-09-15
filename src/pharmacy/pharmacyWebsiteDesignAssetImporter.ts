/**
 * Import visual assets from Website Design Evidence into tenant workspace storage.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DesignEvidenceAsset, WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { PHARMACY_WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

const BLOCKED_PATTERNS = [
  /doubleclick\.net/i,
  /facebook\.com\/tr/i,
  /google-analytics/i,
  /googletagmanager/i,
  /pixel/i,
  /tracking/i,
  /adservice/i,
  /banner-ad/i,
];

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function assetRoot(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "assets/website-import", safePharmacySlug(slug));
}

function classifyAsset(url: string, role: string): DesignEvidenceAsset["classification"] {
  const lower = url.toLowerCase();
  if (/favicon|icon-32|cropped.*32x32/.test(lower)) return "favicon";
  if (/logo/.test(lower) || role === "header") return "logo";
  if (role === "hero" || /hero|banner/.test(lower)) return "hero";
  if (/social|facebook|instagram|twitter|linkedin/.test(lower)) return "social";
  if (/icon|svg/.test(lower)) return "icon";
  if (role === "background") return "background";
  if (/service|clinic|vaccine|pharmacy/.test(lower)) return "service";
  return "other";
}

function shouldSkip(url: string): string | null {
  if (!url || url.startsWith("data:")) return "data-url";
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(url)) return "tracking-or-ad";
  }
  return null;
}

async function downloadAsset(url: string): Promise<{ buf: Buffer; mimeType: string } | null> {
  try {
    const secure = url.replace(/^http:\/\//i, "https://");
    const res = await fetch(secure, { redirect: "follow" });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "application/octet-stream";
    if (!/^image\//i.test(mimeType) && !/svg/i.test(mimeType)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null;
    return { buf, mimeType };
  } catch {
    return null;
  }
}

export interface ImportDesignAssetsResult {
  slug: string;
  assetsDiscovered: number;
  assetsImported: number;
  brokenAssets: number;
  assets: DesignEvidenceAsset[];
  assetRoot: string;
}

export async function importDesignEvidenceAssets(
  slug: string,
  evidence: WebsiteDesignEvidence,
): Promise<ImportDesignAssetsResult> {
  const root = assetRoot(slug);
  fs.mkdirSync(root, { recursive: true });

  const candidates = new Map<string, { url: string; role: string; sourcePage: string }>();

  if (evidence.header.logoUrl) {
    candidates.set(evidence.header.logoUrl, { url: evidence.header.logoUrl, role: "header", sourcePage: evidence.primaryUrl });
  }
  for (const img of evidence.imagery) {
    if (!candidates.has(img.url)) candidates.set(img.url, { url: img.url, role: img.role, sourcePage: evidence.primaryUrl });
  }

  const assets: DesignEvidenceAsset[] = [];
  let imported = 0;
  let broken = 0;

  for (const candidate of candidates.values()) {
    const skipReason = shouldSkip(candidate.url);
    const classification = classifyAsset(candidate.url, candidate.role);
    if (skipReason) {
      assets.push({
        originalUrl: candidate.url,
        sourcePage: candidate.sourcePage,
        mimeType: "",
        width: null,
        height: null,
        checksum: "",
        localPath: "",
        usageLocations: [candidate.role],
        classification,
        importStatus: "skipped",
        skipReason,
      });
      continue;
    }

    const downloaded = await downloadAsset(candidate.url);
    if (!downloaded) {
      broken += 1;
      assets.push({
        originalUrl: candidate.url,
        sourcePage: candidate.sourcePage,
        mimeType: "",
        width: null,
        height: null,
        checksum: "",
        localPath: "",
        usageLocations: [candidate.role],
        classification,
        importStatus: "failed",
        skipReason: "download-failed",
      });
      continue;
    }

    const ext = downloaded.mimeType.includes("svg")
      ? ".svg"
      : downloaded.mimeType.includes("png")
        ? ".png"
        : downloaded.mimeType.includes("webp")
          ? ".webp"
          : ".jpg";
    const checksum = sha256(downloaded.buf);
    const fileName = `${classification}-${checksum.slice(0, 12)}${ext}`;
    const localPath = path.join("assets/website-import", safePharmacySlug(slug), fileName);
    const fullPath = path.join(PHARMACY_WORKSPACE_ROOT, localPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, downloaded.buf);
    imported += 1;

    assets.push({
      originalUrl: candidate.url,
      sourcePage: candidate.sourcePage,
      mimeType: downloaded.mimeType,
      width: null,
      height: null,
      checksum,
      localPath,
      usageLocations: [candidate.role],
      classification,
      importStatus: "imported",
    });
  }

  const manifestPath = path.join(root, "asset-manifest.json");
  const previousRevision = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { assets?: DesignEvidenceAsset[]; importRevision?: string }
    : null;
  const mergedByChecksum = new Map<string, DesignEvidenceAsset>();
  for (const prev of previousRevision?.assets || []) {
    if (prev.checksum) mergedByChecksum.set(prev.checksum, prev);
  }
  for (const asset of assets) {
    if (asset.checksum && mergedByChecksum.has(asset.checksum)) {
      const kept = mergedByChecksum.get(asset.checksum)!;
      asset.localPath = kept.localPath || asset.localPath;
      asset.importStatus = kept.importStatus === "imported" ? "imported" : asset.importStatus;
    }
    mergedByChecksum.set(asset.checksum || asset.originalUrl, asset);
  }
  const mergedAssets = [...mergedByChecksum.values()];
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        slug,
        assets: mergedAssets,
        importedAt: new Date().toISOString(),
        importRevision: sha256(`${mergedAssets.length}:${mergedAssets.filter((a) => a.importStatus === "imported").length}`).slice(0, 16),
        previousImportPreserved: Boolean(previousRevision),
      },
      null,
      2,
    ),
  );

  return {
    slug,
    assetsDiscovered: candidates.size,
    assetsImported: mergedAssets.filter((a) => a.importStatus === "imported").length,
    brokenAssets: broken,
    assets: mergedAssets,
    assetRoot: root,
  };
}

export function loadImportedDesignAssets(slug: string): DesignEvidenceAsset[] {
  const manifest = path.join(assetRoot(slug), "asset-manifest.json");
  if (!fs.existsSync(manifest)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(manifest, "utf8")) as { assets?: DesignEvidenceAsset[] };
    return raw.assets || [];
  } catch {
    return [];
  }
}

export function resolveImportedAssetPath(slug: string, classification: DesignEvidenceAsset["classification"]): string | null {
  const assets = loadImportedDesignAssets(slug).filter((a) => a.importStatus === "imported" && a.classification === classification);
  return assets[0]?.localPath || null;
}
