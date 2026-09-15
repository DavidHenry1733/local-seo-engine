/**
 * imageLibrary.ts
 *
 * Core Image Library module for the local SEO page generator.
 * Handles manifest loading, image selection (random/deterministic),
 * alt-text generation, and service normalisation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// ── Path resolution ───────────────────────────────────────────────────────────
// Works in both the bundled API server (dist/index.mjs → __dirname = dist/) and
// unbundled ts-node (src/generator/ → __dirname = src/generator/).
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Walk up until we find the assets/image-library directory
function findWorkspaceRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "assets", "image-library"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // fallback: 3 levels up from __dirname (works for bundled dist/)
  return path.resolve(__dirname, "../../..");
}

const WORKSPACE_ROOT  = findWorkspaceRoot();
const IMAGE_LIB_DIR   = path.join(WORKSPACE_ROOT, "assets", "image-library");
export const MANIFEST_PATH = path.join(IMAGE_LIB_DIR, "image-library.json");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LibraryImage {
  id:          string;
  service:     string;      // hyphen-form: "web-hosting", "web-design", "local-seo"
  slot:        string;      // "hero" | "support" | "conversion"
  filename:    string;
  description: string;
  altTemplate: string;      // "{{Service}} {{Location}} — ..."
  tags:        string[];
  approved:    boolean;
  addedAt?:    string;
}

export interface ImageManifest {
  images: LibraryImage[];
}

export interface ImageSelection {
  libraryId: string;
  src:       string;   // URL used in HTML
  alt:       string;   // rendered alt text
  filename:  string;
}

export interface ImageLibraryConfig {
  enabled:       boolean;
  mode:          "random" | "deterministic";
  allowFallback: boolean;
}

// ── Service normalisation ─────────────────────────────────────────────────────

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "web-hosting":             "Web Hosting",
  "web-design":              "Web Design",
  "local-seo":               "Local SEO",
  "google-business-profile": "Google Business Profile",
  "email-marketing":         "Email Marketing",
  "local-business-visibility": "Local Business Visibility",
};

/** Convert underscore, space, or camel service key to hyphen-form used in library paths. */
export function normaliseServiceKey(key: string): string {
  return key.trim().replace(/[\s_]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
}

/** Get human-readable display name for a service key (either form). */
export function serviceDisplayName(key: string): string {
  const norm = normaliseServiceKey(key);
  return SERVICE_DISPLAY_NAMES[norm] ?? norm.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const KNOWN_SERVICES = Object.keys(SERVICE_DISPLAY_NAMES);
export const KNOWN_SLOTS    = ["hero", "support", "trust", "conversion"] as const;

// ── Manifest I/O ─────────────────────────────────────────────────────────────

export function loadManifest(): ImageManifest {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return { images: [] };
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ImageManifest;
  } catch {
    return { images: [] };
  }
}

export function saveManifest(manifest: ImageManifest): void {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

/** Return only approved images from manifest. */
export function approvedImages(): LibraryImage[] {
  return (loadManifest().images ?? []).filter((img) => img.approved);
}

// ── Image file path ───────────────────────────────────────────────────────────

export function imageFilePath(img: Pick<LibraryImage, "service" | "slot" | "filename">): string {
  return path.join(IMAGE_LIB_DIR, img.service, img.slot, img.filename);
}

// ── Alt text rendering ────────────────────────────────────────────────────────

export function renderAlt(template: string, serviceName: string, location: string): string {
  return template
    .replace(/\{\{Service\}\}/g, serviceName)
    .replace(/\{\{Location\}\}/g, location)
    .replace(/\{\{service\}\}/g, serviceName)
    .replace(/\{\{location\}\}/g, location);
}

// ── Deterministic selection ───────────────────────────────────────────────────

function deterministicIndex(pageSlug: string, slot: string, len: number): number {
  const hash = createHash("sha256").update(`${pageSlug}:${slot}`).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % len;
}

// ── Core selection ────────────────────────────────────────────────────────────

export interface SelectImageOptions {
  service:      string;          // normalised hyphen-form
  slot:         string;
  pageSlug:     string;
  location:     string;
  serviceName:  string;          // display name
  domain:       string;
  isLive:       boolean;
  mode:         "random" | "deterministic";
  allowFallback: boolean;
  usedIds?:     Set<string>;
  allImages?:   LibraryImage[];  // pass to avoid re-loading manifest per slot
}

/** Select a single approved image for a slot, returning null if library is empty. */
export function selectImage(opts: SelectImageOptions): ImageSelection | null {
  const images = opts.allImages ?? approvedImages();

  // Primary pool: matching service + slot
  let pool = images.filter((img) => img.service === opts.service && img.slot === opts.slot);

  // Secondary pool: same service, any slot (all uploads now default to "hero" slot,
  // so this ensures hero images are reused for support/conversion positions too)
  if (pool.length === 0) {
    pool = images.filter((img) => img.service === opts.service);
  }

  // Cross-service fallback is intentionally disabled: a roofing page should never
  // receive web-design or plumbing images just because no roofing images exist
  // in the library.  Campaign images (step 5a) fill the gap instead.

  if (pool.length === 0) return null;

  // Prefer images not already used on this page
  const unused     = pool.filter((img) => !opts.usedIds?.has(img.id));
  const candidates = unused.length > 0 ? unused : pool;

  let selected: LibraryImage;
  if (opts.mode === "deterministic") {
    selected = candidates[deterministicIndex(opts.pageSlug, opts.slot, candidates.length)];
  } else {
    selected = candidates[Math.floor(Math.random() * candidates.length)];
  }

  const src = buildSrc(selected, opts.domain, opts.isLive);
  const alt = renderAlt(selected.altTemplate, opts.serviceName, opts.location);

  return { libraryId: selected.id, src, alt, filename: selected.filename };
}

function buildSrc(img: LibraryImage, domain: string, isLive: boolean): string {
  if (isLive) {
    const base = domain.replace(/\/+$/, "");
    return `${base}/assets/image-library/${img.service}/${img.slot}/${img.filename}`;
  }
  return `/api/images/library-serve/${img.service}/${img.slot}/${img.filename}`;
}

// ── Per-page image selection ──────────────────────────────────────────────────

export interface ManualOverride {
  hero?:       string;   // library image ID
  support?:    string;
  trust?:      string;
  conversion?: string;
}

export interface PageImageSelections {
  hero:       ImageSelection | null;
  support:    ImageSelection | null;
  trust:      ImageSelection | null;
  conversion: ImageSelection | null;
}

export function selectPageImages(opts: {
  service:        string;   // raw key e.g. "web_hosting"
  pageSlug:       string;
  location:       string;
  serviceName?:   string;   // auto-derived if omitted
  domain:         string;
  isLive:         boolean;
  config:         ImageLibraryConfig;
  manualOverride?: ManualOverride;
}): PageImageSelections {
  const normService  = normaliseServiceKey(opts.service);
  const displayName  = opts.serviceName ?? serviceDisplayName(opts.service);
  const allImages    = approvedImages();
  const usedIds      = new Set<string>();

  const baseOpts: Omit<SelectImageOptions, "slot"> = {
    service:       normService,
    pageSlug:      opts.pageSlug,
    location:      opts.location,
    serviceName:   displayName,
    domain:        opts.domain,
    isLive:        opts.isLive,
    mode:          opts.config.mode,
    allowFallback: opts.config.allowFallback,
    allImages,
    usedIds,
  };

  function resolveSlot(slot: "hero" | "support" | "trust" | "conversion"): ImageSelection | null {
    const overrideId = opts.manualOverride?.[slot];
    if (overrideId) {
      const img = allImages.find((i) => i.id === overrideId && i.approved);
      if (img) {
        const src = buildSrc(img, opts.domain, opts.isLive);
        const alt = renderAlt(img.altTemplate, displayName, opts.location);
        usedIds.add(img.id);
        return { libraryId: img.id, src, alt, filename: img.filename };
      }
    }
    const sel = selectImage({ ...baseOpts, slot });
    if (sel) usedIds.add(sel.libraryId);
    return sel;
  }

  return {
    hero:       resolveSlot("hero"),
    support:    resolveSlot("support"),
    trust:      resolveSlot("trust"),
    conversion: resolveSlot("conversion"),
  };
}

// ── Usage map ─────────────────────────────────────────────────────────────────

/** Scan a project's output directory and return a map of libraryId → page slugs. */
export function buildUsageMap(projectOutputDir: string): Record<string, string[]> {
  const usage: Record<string, string[]> = {};
  if (!fs.existsSync(projectOutputDir)) return usage;

  for (const entry of fs.readdirSync(projectOutputDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pdPath = path.join(projectOutputDir, entry.name, "page-data.json");
    if (!fs.existsSync(pdPath)) continue;
    try {
      const pd = JSON.parse(fs.readFileSync(pdPath, "utf8")) as {
        images?: Record<string, { libraryId?: string }>;
      };
      for (const slot of ["hero", "support", "trust", "conversion"] as const) {
        const libId = pd.images?.[slot]?.libraryId;
        if (!libId) continue;
        if (!usage[libId]) usage[libId] = [];
        if (!usage[libId].includes(entry.name)) usage[libId].push(entry.name);
      }
    } catch { /* ignore corrupt page-data */ }
  }

  return usage;
}

// ── Validation helpers ────────────────────────────────────────────────────────

export interface ImageLibraryIssue {
  pageSlug:    string;
  slot:        string;
  severity:    "critical" | "major";
  checkKey:    string;
  evidence:    string;
  suggestedFix: string;
}

/**
 * Validate page-level image selections against the library rules.
 * Called from the publish gate for each page.
 */
export function validatePageImages(opts: {
  pageSlug:     string;
  serviceKey:   string;   // raw key e.g. "web_hosting"
  location:     string;
  pageImages:   Record<string, { libraryId?: string; src?: string; alt?: string }>;
  config:       ImageLibraryConfig;
  allImages:    LibraryImage[];
}): ImageLibraryIssue[] {
  const issues: ImageLibraryIssue[] = [];
  const normService  = normaliseServiceKey(opts.serviceKey);
  const displayName  = serviceDisplayName(opts.serviceKey);
  const manifest     = opts.allImages;

  const usedIds: string[] = [];

  for (const slot of KNOWN_SLOTS) {
    const pageImg = opts.pageImages[slot];

    // Check slot is assigned
    if (!pageImg?.libraryId) {
      issues.push({
        pageSlug:    opts.pageSlug,
        slot,
        severity:    "critical",
        checkKey:    "img.lib.missing",
        evidence:    `No library image assigned for slot "${slot}"`,
        suggestedFix: `Generate or assign a ${displayName} ${slot} image before publishing`,
      });
      continue;
    }

    const libImg = manifest.find((img) => img.id === pageImg.libraryId);

    // Check image exists in manifest
    if (!libImg) {
      issues.push({
        pageSlug:    opts.pageSlug,
        slot,
        severity:    "critical",
        checkKey:    "img.lib.notFound",
        evidence:    `Library image "${pageImg.libraryId}" not found in manifest`,
        suggestedFix: "Re-run the rollout to reassign images from the current library",
      });
      continue;
    }

    // Check image is approved
    if (!libImg.approved) {
      issues.push({
        pageSlug:    opts.pageSlug,
        slot,
        severity:    "major",
        checkKey:    "img.lib.unapproved",
        evidence:    `Image "${libImg.id}" is not approved`,
        suggestedFix: "Approve the image in the Image Library before publishing",
      });
    }

    // Cross-service check
    if (libImg.service !== normService && !opts.config.allowFallback) {
      issues.push({
        pageSlug:    opts.pageSlug,
        slot,
        severity:    "critical",
        checkKey:    "img.lib.wrongService",
        evidence:    `${slot} image "${libImg.id}" belongs to service "${libImg.service}" but page service is "${normService}"`,
        suggestedFix: `Use a "${normService}" image for this slot or enable allowFallback`,
      });
    }

    // Alt text checks
    const alt = (pageImg.alt ?? "").toLowerCase();
    const serviceTerms = displayName.toLowerCase().split(" ");
    const serviceInAlt = serviceTerms.every((t) => alt.includes(t));
    if (!serviceInAlt) {
      issues.push({
        pageSlug:    opts.pageSlug,
        slot,
        severity:    "major",
        checkKey:    "img.lib.altMissingService",
        evidence:    `${slot} alt "${pageImg.alt}" does not mention service "${displayName}"`,
        suggestedFix: "Regenerate alt text using the library altTemplate",
      });
    }

    if (!alt.includes(opts.location.toLowerCase())) {
      issues.push({
        pageSlug:    opts.pageSlug,
        slot,
        severity:    "major",
        checkKey:    "img.lib.altMissingLocation",
        evidence:    `${slot} alt "${pageImg.alt}" does not mention location "${opts.location}"`,
        suggestedFix: "Regenerate alt text using the library altTemplate with the correct location",
      });
    }

    // Duplicate image across slots on same page
    if (usedIds.includes(pageImg.libraryId)) {
      issues.push({
        pageSlug:    opts.pageSlug,
        slot,
        severity:    "major",
        checkKey:    "img.lib.duplicate",
        evidence:    `Image "${pageImg.libraryId}" is used in multiple slots on this page`,
        suggestedFix: "Add more images to the library so each slot can use a unique image",
      });
    } else {
      usedIds.push(pageImg.libraryId);
    }
  }

  return issues;
}
