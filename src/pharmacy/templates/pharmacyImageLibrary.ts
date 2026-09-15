/**
 * Pharmacy Image Library — metadata resolution and HTML rendering for preview templates.
 * Uses output/pharmacy-blueprint/pharmacy-image-library.json (no upload required for preview).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getApprovalRecord,
  resolveIndustryUploadPath,
  resolveDisplayForRecord,
} from "../../image-intelligence/imageApprovalState.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type PharmacyImageSlot = "hero" | "support" | "trust" | "conversion";

export interface PharmacyLibraryImage {
  imageKey: string;
  imagePack: string;
  purpose: string;
  recommendedPlacement: string[];
  altTextPattern: string;
  captionPattern: string;
  schemaUsage: string;
  serviceCompatibility: string[];
  fallbackRules: string[];
  assetPath?: string;
}

export interface PharmacyImagePack {
  packKey: string;
  packName: string;
  description: string;
  images: PharmacyLibraryImage[];
}

export interface PharmacyTemplateFamilyImageMapping {
  templateKey: string;
  preferredImagePack: string;
  secondaryImagePack: string;
  fallbackImagePack: string;
  slotResolution: Record<PharmacyImageSlot, string>;
}

export interface PharmacyImageLibrary {
  schemaVersion: string;
  industry: string;
  assetRoot: string;
  standardSlots: PharmacyImageSlot[];
  imagePacks: Record<string, PharmacyImagePack>;
  templateFamilyMappings: Record<string, PharmacyTemplateFamilyImageMapping>;
  slotMappings: Record<PharmacyImageSlot, { description: string; schemaProperty: string }>;
  onboardingProcess: {
    steps: { step: number; name: string; description: string; output: string }[];
  };
  serviceSlotMappings?: Record<
    string,
    {
      templateFamilyKey: string;
      hero: { imagePack: string; imageKey: string };
      support: { imagePack: string; imageKey: string };
      trust: { imagePack: string; imageKey: string };
      conversion: { imagePack: string; imageKey: string };
    }
  >;
}

export interface ResolvedPharmacyImage {
  imageKey: string;
  imagePack: string;
  slot: PharmacyImageSlot;
  alt: string;
  caption: string;
  assetPath: string;
  assetExists: boolean;
  schemaUsage: string;
  libraryRef: string;
  displayMode?: "approved" | "preview-only" | "placeholder" | "rejected";
  approvalStatus?: string;
  source?: "assignment" | "upload" | "ai" | "library" | "image-platform" | "missing";
}

export interface PharmacyImageRenderContext {
  templateFamilyKey: string;
  serviceKey: string;
  serviceName: string;
  pharmacyName: string;
  location: string;
  pageSlug?: string;
  previewBasePath?: string;
  /** Pharmacy tenant slug — enables per-pharmacy assignment resolution */
  slug?: string;
  /** When true (default), uploaded-but-unapproved images render with preview badge */
  previewMode?: boolean;
  /** Visual Experience V1 — treat demo SVG assets as approved for screenshot pages */
  visualDemoMode?: boolean;
  /** Campaign-scoped image assignment key */
  campaignId?: string;
  /** Current campaign run — Review Centre / generation use recorded selections for this run */
  campaignRunId?: string;
}

function resolveWorkspaceRoot(): string {
  const candidates = [
    path.resolve(__dirname, "../../.."),
    path.resolve(__dirname, "../../../.."),
    process.cwd(),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output/pharmacy-blueprint/pharmacy-image-library.json"))) return root;
  }
  return path.resolve(__dirname, "../../..");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();
const LIBRARY_PATH = path.join(WORKSPACE_ROOT, "output/pharmacy-blueprint/pharmacy-image-library.json");
const ASSET_ROOT = path.join(WORKSPACE_ROOT, "assets/pharmacy-image-library");

let cachedLibrary: PharmacyImageLibrary | null = null;

export function loadPharmacyImageLibrary(): PharmacyImageLibrary {
  if (cachedLibrary) return cachedLibrary;
  if (!fs.existsSync(LIBRARY_PATH)) {
    throw new Error(`Pharmacy image library not found: ${LIBRARY_PATH}`);
  }
  cachedLibrary = JSON.parse(fs.readFileSync(LIBRARY_PATH, "utf8")) as PharmacyImageLibrary;
  return cachedLibrary;
}

function safeContextToken(value: string | undefined, fallback: string): string {
  const trimmed = String(value || "").trim();
  return trimmed && trimmed !== "undefined" ? trimmed : fallback;
}

export function sanitizePharmacyImageAltText(
  alt: string,
  ctx: Partial<PharmacyImageRenderContext>,
  slot?: string,
): string {
  const serviceName = safeContextToken(ctx.serviceName, "Pharmacy service");
  const pharmacyName = safeContextToken(ctx.pharmacyName, "local pharmacy");
  const location = safeContextToken(ctx.location, "local area");
  const slotLabel = safeContextToken(slot, "image");

  let result = alt
    .replace(/\{serviceName\}/g, serviceName)
    .replace(/\{service\}/g, serviceName)
    .replace(/\{pharmacyName\}/g, pharmacyName)
    .replace(/\{location\}/g, location)
    .replace(/\{serviceKey\}/g, safeContextToken(ctx.serviceKey, "service"));

  if (/\bundefined\b/i.test(result) || !result.trim()) {
    result = `${serviceName} ${slotLabel} at ${pharmacyName} in ${location}`;
  }

  return result.replace(/\s+/g, " ").trim();
}

function applyPattern(pattern: string, ctx: PharmacyImageRenderContext, slot?: string): string {
  return sanitizePharmacyImageAltText(pattern, ctx, slot);
}

function findImage(pack: PharmacyImagePack | undefined, imageKey: string): PharmacyLibraryImage | undefined {
  return pack?.images.find((img) => img.imageKey === imageKey);
}

function findImageAnywhere(library: PharmacyImageLibrary, imageKey: string): PharmacyLibraryImage | undefined {
  for (const pack of Object.values(library.imagePacks)) {
    const img = findImage(pack, imageKey);
    if (img) return img;
  }
  return undefined;
}

function assetExists(relativePath: string): boolean {
  const full = path.join(WORKSPACE_ROOT, relativePath);
  if (fs.existsSync(full)) return true;
  const base = relativePath.replace(/\.(webp|jpg|jpeg|png|svg)$/i, "");
  for (const ext of [".webp", ".svg", ".jpg", ".jpeg", ".png"]) {
    if (fs.existsSync(path.join(WORKSPACE_ROOT, base + ext))) return true;
  }
  return false;
}

function resolveAssetPath(relativePath: string): string {
  const full = path.join(WORKSPACE_ROOT, relativePath);
  if (fs.existsSync(full)) return relativePath;
  const base = relativePath.replace(/\.(webp|jpg|jpeg|png|svg)$/i, "");
  for (const ext of [".webp", ".svg", ".jpg", ".jpeg", ".png"]) {
    const candidate = base + ext;
    if (fs.existsSync(path.join(WORKSPACE_ROOT, candidate))) return candidate;
  }
  return relativePath;
}

/** Resolve library asset path to an on-disk file (webp → svg fallback). */
export function resolveLibraryAssetPath(relativePath: string): string {
  return resolveAssetPath(relativePath);
}

function resolveImageKey(
  library: PharmacyImageLibrary,
  mapping: PharmacyTemplateFamilyImageMapping,
  slot: PharmacyImageSlot,
  serviceKey: string,
): { imageKey: string; imagePack: string } {
  const primaryKey = mapping.slotResolution[slot];
  const packs = [mapping.preferredImagePack, mapping.secondaryImagePack, mapping.fallbackImagePack];

  for (const packKey of packs) {
    const pack = library.imagePacks[packKey];
    const img = findImage(pack, primaryKey);
    if (img && (img.serviceCompatibility.includes("*") || img.serviceCompatibility.includes(serviceKey))) {
      return { imageKey: img.imageKey, imagePack: packKey };
    }
  }

  const primary = findImageAnywhere(library, primaryKey);
  if (primary) return { imageKey: primary.imageKey, imagePack: primary.imagePack };

  for (const rule of primary?.fallbackRules ?? []) {
    const fb = findImageAnywhere(library, rule);
    if (fb) return { imageKey: fb.imageKey, imagePack: fb.imagePack };
  }

  const core = library.imagePacks["core-pharmacy"];
  const slotImg = findImage(core, slot);
  if (slotImg) return { imageKey: slotImg.imageKey, imagePack: "core-pharmacy" };

  return { imageKey: primaryKey, imagePack: mapping.preferredImagePack };
}

export function resolvePharmacySlotImage(
  slot: PharmacyImageSlot,
  ctx: PharmacyImageRenderContext,
): ResolvedPharmacyImage {
  const library = loadPharmacyImageLibrary();
  const serviceMapping = library.serviceSlotMappings?.[ctx.serviceKey];
  let imageKey: string;
  let imagePack: string;
  let mapping = library.templateFamilyMappings[ctx.templateFamilyKey];

  if (serviceMapping?.[slot]) {
    imageKey = serviceMapping[slot].imageKey;
    imagePack = serviceMapping[slot].imagePack;
    mapping = mapping ?? library.templateFamilyMappings[serviceMapping.templateFamilyKey];
  } else {
    if (!mapping) {
      throw new Error(`No image mapping for template family: ${ctx.templateFamilyKey}`);
    }
    ({ imageKey, imagePack } = resolveImageKey(library, mapping, slot, ctx.serviceKey));
  }

  const pack = library.imagePacks[imagePack];
  const meta = findImage(pack, imageKey) ?? findImageAnywhere(library, imageKey)!;

  const uploadPath = resolveAssetPath(resolveIndustryUploadPath("pharmacy", imagePack, imageKey));
  const assetPath = uploadPath;
  const record = getApprovalRecord("pharmacy", imagePack, imageKey);
  const previewMode = ctx.previewMode !== false;
  const visualDemo = ctx.visualDemoMode === true;
  let displayMode = resolveDisplayForRecord(record, uploadPath, previewMode);
  if (visualDemo && assetExists(uploadPath)) {
    displayMode = "approved";
  }
  const exists = displayMode === "approved" || displayMode === "preview-only";

  return {
    imageKey,
    imagePack,
    slot,
    alt: applyPattern(meta.altTextPattern, ctx, slot),
    caption: applyPattern(meta.captionPattern, ctx, slot),
    assetPath,
    assetExists: exists,
    schemaUsage: meta.schemaUsage,
    libraryRef: `${imagePack}/${imageKey}`,
    displayMode,
    approvalStatus: record?.status ?? (visualDemo && exists ? "demo-visual" : "awaiting-upload"),
  };
}

export function resolvePharmacyPageImages(ctx: PharmacyImageRenderContext): Record<PharmacyImageSlot, ResolvedPharmacyImage> {
  const slots: PharmacyImageSlot[] = ["hero", "support", "trust", "conversion"];
  return Object.fromEntries(slots.map((s) => [s, resolvePharmacySlotImage(s, ctx)])) as Record<
    PharmacyImageSlot,
    ResolvedPharmacyImage
  >;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPharmacyImageFigure(resolved: ResolvedPharmacyImage, ctx: PharmacyImageRenderContext): string {
  const base = ctx.previewBasePath ?? "/assets";
  const href = resolved.assetPath.startsWith("assets/")
    ? `/${resolved.assetPath}`.replace(/\/+/g, "/")
    : `${base}/${resolved.assetPath}`.replace(/\/+/g, "/").replace(/^\.\.\/+/, "../");

  if (resolved.assetExists && (resolved.displayMode === "approved" || resolved.displayMode === "preview-only")) {
    const approvedClass =
      resolved.displayMode === "approved" ? "pharmacy-image--approved" : "pharmacy-image--preview-only";
    const badge =
      resolved.displayMode === "preview-only"
        ? `<span class="pharmacy-image-preview-badge">Preview only — pending approval</span>`
        : "";
    return `<figure class="pharmacy-image pharmacy-image--${esc(resolved.slot)} ${approvedClass}" data-image-key="${esc(resolved.imageKey)}" data-image-pack="${esc(resolved.imagePack)}" data-library-ref="${esc(resolved.libraryRef)}" data-approval-status="${esc(resolved.approvalStatus ?? "approved")}">
<img src="${esc(href)}" alt="${esc(resolved.alt)}" loading="${resolved.slot === "hero" ? "eager" : "lazy"}" width="800" height="600" />
${badge}
<figcaption>${esc(resolved.caption)}</figcaption>
</figure>`;
  }

  if (ctx.visualDemoMode) {
    return `<figure class="pharmacy-image pharmacy-image--${esc(resolved.slot)} pharmacy-image--demo-placeholder" data-image-key="${esc(resolved.imageKey)}" data-image-pack="${esc(resolved.imagePack)}" data-library-ref="${esc(resolved.libraryRef)}">
<div class="vex-image-placeholder vex-image-placeholder--${esc(resolved.slot)}" role="img" aria-label="${esc(resolved.alt)}">
<span class="vex-image-placeholder-label">${esc(resolved.caption)}</span>
</div>
<figcaption>${esc(resolved.caption)}</figcaption>
</figure>`;
  }

  return `<figure class="pharmacy-image pharmacy-image--${esc(resolved.slot)} pharmacy-image--library-ref" data-image-key="${esc(resolved.imageKey)}" data-image-pack="${esc(resolved.imagePack)}" data-library-ref="${esc(resolved.libraryRef)}" aria-label="${esc(resolved.alt)}">
<div class="image-slot image-slot--${esc(resolved.slot)}">
<div>
<strong>${esc(resolved.alt)}</strong>
<span>Image library: ${esc(resolved.libraryRef)} · ${esc(resolved.approvalStatus === "rejected" ? "Rejected — awaiting replacement" : "Awaiting upload")}</span>
<small class="image-slot-meta">${esc(resolved.schemaUsage)}</small>
</div>
</div>
<figcaption>${esc(resolved.caption)}</figcaption>
</figure>`;
}

export function renderPharmacyImageSlot(
  slot: PharmacyImageSlot,
  ctx: PharmacyImageRenderContext,
  _label?: string,
): string {
  const resolved = resolvePharmacySlotImage(slot, ctx);
  return renderPharmacyImageFigure(resolved, ctx);
}

export function pharmacyImageLibraryStyles(): string {
  return `.pharmacy-image{margin:0;position:relative}.pharmacy-image img{width:100%;height:auto;border-radius:24px;object-fit:cover;max-height:420px;border:1px solid #d9e8f2;box-shadow:0 12px 32px rgba(26,58,82,.08)}
.pharmacy-image figcaption{font-size:13px;color:#5a7186;margin-top:10px;text-align:center}
.pharmacy-image--library-ref .image-slot-meta{display:block;margin-top:8px;font-size:11px;color:#7a95ab;font-style:italic}
.pharmacy-image-preview-badge{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;border:1px solid #fcd34d}
.vex-image-placeholder{min-height:280px;border-radius:24px;display:flex;align-items:flex-end;padding:24px;background:linear-gradient(145deg,#e8f4fd 0%,#f0fdf8 55%,#fff 100%);border:1px solid #c5dff0;box-shadow:0 12px 32px rgba(26,58,82,.08)}
.vex-image-placeholder--hero{min-height:340px;background:linear-gradient(160deg,#005eb8 0%,#007f3b 100%)}
.vex-image-placeholder--support{background:linear-gradient(145deg,#f4f9fd,#ecfdf5)}
.vex-image-placeholder--trust{background:linear-gradient(145deg,#ecfdf5,#f4f9fd)}
.vex-image-placeholder--conversion{background:linear-gradient(145deg,#e8f4fd,#dbeafe)}
.vex-image-placeholder--hero .vex-image-placeholder-label{color:#fff;font-weight:700}
.vex-image-placeholder-label{font-size:14px;font-weight:600;color:#1a3347}`;
}
