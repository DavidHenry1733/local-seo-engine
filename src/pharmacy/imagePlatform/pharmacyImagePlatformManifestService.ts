/**
 * Metadata I/O, revision hashing, manifest generation.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  IMAGE_PLATFORM_ASSET_ROOT,
  IMAGE_PLATFORM_ROLES,
  assetMetaPathAbs,
  imagePlatformAssetRootAbs,
  libraryManifestAbs,
  platformRevisionAbs,
  rolePlatformRootAbs,
  type ImagePlatformRole,
} from "./pharmacyImagePlatformPaths.ts";
import type {
  ImagePlatformAssetMetadata,
  ImagePlatformLibraryManifest,
  ImagePlatformRevisionDoc,
} from "./pharmacyImagePlatformTypes.ts";
import { isApprovedPlatformContentClass } from "./pharmacyImagePlatformTypes.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export function readAssetMetadata(serviceId: string, role: ImagePlatformRole, assetId: string): ImagePlatformAssetMetadata | null {
  const p = assetMetaPathAbs(serviceId, role, assetId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ImagePlatformAssetMetadata;
}

export function writeAssetMetadata(meta: ImagePlatformAssetMetadata): void {
  const p = assetMetaPathAbs(meta.serviceId, meta.role, meta.assetId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(meta, null, 2));
}

export function listAssetMetaFiles(serviceId: string, role: ImagePlatformRole): string[] {
  const dir = rolePlatformRootAbs(serviceId, role);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".meta.json"))
    .map((f) => f.replace(/\.meta\.json$/, ""));
}

export function computeFileRevision(absPath: string): string {
  if (!fs.existsSync(absPath)) return "missing";
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex").slice(0, 16);
}

export function computeAssetRevision(meta: ImagePlatformAssetMetadata): string {
  const abs = path.join(PHARMACY_WORKSPACE_ROOT, meta.relativePath.replace(/^\/+/, ""));
  return computeFileRevision(abs);
}

export function scanAllPlatformAssets(): ImagePlatformAssetMetadata[] {
  const servicesDir = path.join(imagePlatformAssetRootAbs(), "services");
  if (!fs.existsSync(servicesDir)) return [];
  const out: ImagePlatformAssetMetadata[] = [];
  for (const serviceId of fs.readdirSync(servicesDir)) {
    if (!fs.statSync(path.join(servicesDir, serviceId)).isDirectory()) continue;
    for (const role of IMAGE_PLATFORM_ROLES) {
      for (const assetId of listAssetMetaFiles(serviceId, role)) {
        const meta = readAssetMetadata(serviceId, role, assetId);
        if (meta) out.push(meta);
      }
    }
  }
  return out.sort((a, b) =>
    `${a.serviceId}:${a.role}:${a.assetId}`.localeCompare(`${b.serviceId}:${b.role}:${b.assetId}`),
  );
}

export function computePlatformRevision(assets: ImagePlatformAssetMetadata[]): string {
  const payload = assets
    .map((a) => `${a.serviceId}|${a.role}|${a.assetId}|${a.revision}|${a.approval.status}|${a.contentClass}`)
    .join("\n");
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function generateLibraryManifest(): ImagePlatformLibraryManifest {
  const assets = scanAllPlatformAssets();
  const approved = assets.filter(
    (a) => a.approval.status === "approved" && isApprovedPlatformContentClass(a.contentClass),
  );
  const platformRevision = computePlatformRevision(assets);
  const services: ImagePlatformLibraryManifest["services"] = {};

  for (const a of approved) {
    if (!services[a.serviceId]) {
      services[a.serviceId] = { serviceId: a.serviceId, roles: {} };
    }
    if (!services[a.serviceId].roles[a.role]) {
      services[a.serviceId].roles[a.role] = { approvedAssetIds: [] };
    }
    services[a.serviceId].roles[a.role].approvedAssetIds.push(a.assetId);
  }

  for (const sid of Object.keys(services)) {
    for (const role of Object.keys(services[sid].roles)) {
      services[sid].roles[role].approvedAssetIds.sort();
    }
  }

  const manifest: ImagePlatformLibraryManifest = {
    schemaVersion: "1.0",
    platformRevision,
    generatedAt: new Date().toISOString(),
    assetRoot: IMAGE_PLATFORM_ASSET_ROOT,
    services,
  };

  fs.mkdirSync(imagePlatformAssetRootAbs(), { recursive: true });
  fs.writeFileSync(libraryManifestAbs(), JSON.stringify(manifest, null, 2));

  const prev = fs.existsSync(platformRevisionAbs())
    ? (JSON.parse(fs.readFileSync(platformRevisionAbs(), "utf8")) as ImagePlatformRevisionDoc).platformRevision
    : undefined;

  const revisionDoc: ImagePlatformRevisionDoc = {
    schemaVersion: "1.0",
    platformRevision,
    previousRevision: prev !== platformRevision ? prev : undefined,
    updatedAt: new Date().toISOString(),
    assetCount: assets.length,
    approvedAssetCount: approved.length,
  };
  fs.writeFileSync(platformRevisionAbs(), JSON.stringify(revisionDoc, null, 2));

  return manifest;
}

export function loadPlatformRevision(): string {
  if (fs.existsSync(platformRevisionAbs())) {
    return (JSON.parse(fs.readFileSync(platformRevisionAbs(), "utf8")) as ImagePlatformRevisionDoc).platformRevision;
  }
  return generateLibraryManifest().platformRevision;
}
