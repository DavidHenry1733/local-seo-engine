/**
 * RC1-IMG1 — Shared image slot HTML with dimensions and loading policy.
 */
import fs from "node:fs";
import path from "node:path";
import type { PharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";
import type { ResolvedPharmacyImage } from "./templates/pharmacyImageLibrary.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { isAssetBlockedForVisualSlot } from "./pharmacyBusinessFieldSanitizer.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function publicAssetHref(assetPath: string): string {
  const normalized = assetPath.replace(/^\/+/, "");
  return normalized.startsWith("assets/") ? `/${normalized}`.replace(/\/+/g, "/") : `/${normalized}`.replace(/\/+/g, "/");
}

export function readImageDimensions(assetPath: string): { width: number; height: number } | null {
  const full = path.isAbsolute(assetPath)
    ? assetPath
    : path.join(PHARMACY_WORKSPACE_ROOT, assetPath.replace(/^\/+/, ""));
  if (!fs.existsSync(full)) return null;
  try {
    const buf = fs.readFileSync(full);
    if (buf.length < 24) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) return { width, height };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset < buf.length) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        const len = buf.readUInt16BE(offset + 2);
        if (marker >= 0xc0 && marker <= 0xcf && len > 7) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          if (width > 0 && height > 0) return { width, height };
        }
        offset += 2 + len;
      }
    }
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      if (buf.toString("ascii", 12, 16) === "VP8 ") {
        const width = buf.readUInt16LE(26) & 0x3fff;
        const height = buf.readUInt16LE(28) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function renderResolvedImageSlotHtml(
  resolved: ResolvedPharmacyImage,
  slot: PharmacyImageSlot,
  panelClass: string,
  options?: { figureClass?: string; extraAttrs?: string },
): string {
  if (!resolved.assetExists || !resolved.assetPath) {
    return `<div class="${panelClass}" data-image-slot="${esc(slot)}" data-image-missing="true"></div>`;
  }
  if (isAssetBlockedForVisualSlot(slot, resolved.assetPath, resolved.assetPath)) {
    // Never show placeholder copy — caller must re-resolve via shared platform.
    return `<div class="${panelClass}" data-image-slot="${esc(slot)}" data-image-missing="true" aria-hidden="true"></div>`;
  }
  const href = publicAssetHref(resolved.assetPath);
  const platformAssetId =
    resolved.source === "image-platform"
      ? (resolved.libraryRef || "").replace(/^image-platform\//, "") || resolved.imageKey
      : "";
  const source =
    resolved.source === "image-platform"
      ? "pharmacy-image-platform"
      : resolved.source === "library" || resolved.source === "assignment"
        ? "pharmacy-image-library"
        : resolved.source || "pharmacy-image-library";
  const loadingMode = slot === "hero" ? "eager" : "lazy";
  const fetchPriority = slot === "hero" ? ' fetchpriority="high"' : "";
  const dims = readImageDimensions(resolved.assetPath);
  const dimAttrs = dims ? ` width="${dims.width}" height="${dims.height}"` : "";
  const figureOpen = options?.figureClass
    ? `<figure class="${esc(options.figureClass)}">`
    : "";
  const figureClose = options?.figureClass ? "</figure>" : "";
  const platformAttrs =
    resolved.source === "image-platform" && platformAssetId
      ? ` data-platform-asset-id="${esc(platformAssetId)}"`
      : "";
  return `${figureOpen}<div class="${panelClass}" data-image-slot="${esc(slot)}" data-image-source="${esc(source)}" data-library-ref="${esc(resolved.libraryRef)}"${platformAttrs}${options?.extraAttrs ? ` ${options.extraAttrs}` : ""}>
<img src="${esc(href)}" alt="${esc(resolved.alt)}" loading="${loadingMode}" decoding="async"${fetchPriority}${dimAttrs} data-image-slot="${esc(slot)}" data-image-source="${esc(source)}" style="object-fit:cover"${platformAttrs}/>
</div>${figureClose}`;
}
