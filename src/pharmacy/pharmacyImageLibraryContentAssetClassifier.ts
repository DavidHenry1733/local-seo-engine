/**
 * RC1-IMG2 — Classify PharmaConnect image-library files for content-slot eligibility.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export type ContentAssetClassification =
  | "approved_photograph"
  | "approved_editorial_illustration"
  | "placeholder"
  | "decorative"
  | "category_marker"
  | "generic_shape"
  | "transparent_fallback"
  | "unknown";

const PLACEHOLDER_MARKERS = [
  /visual experience demo asset/i,
  /demo asset/i,
  /placeholder/i,
  /fallback/i,
  /generic/i,
  /template/i,
  /brook pharmacy/i,
];

export function classifyLibraryAssetFile(relativePath: string): ContentAssetClassification {
  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  const full = path.join(PHARMACY_WORKSPACE_ROOT, normalized);
  if (!fs.existsSync(full)) return "unknown";

  const ext = path.extname(full).toLowerCase();
  const base = path.basename(full).toLowerCase();

  if (/placeholder|fallback|generic|default|template/.test(base)) {
    return "placeholder";
  }

  if (ext === ".webp" || ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
    const stat = fs.statSync(full);
    if (stat.size < 20_000) return "placeholder";
    return "approved_photograph";
  }

  if (ext === ".svg") {
    const text = fs.readFileSync(full, "utf8");
    if (PLACEHOLDER_MARKERS.some((re) => re.test(text))) {
      return "decorative";
    }
    if (/<linearGradient|<circle[^>]+r=/.test(text) && !/<image\s/i.test(text)) {
      return "generic_shape";
    }
    return "category_marker";
  }

  return "unknown";
}

export function isApprovedContentImage(classification: ContentAssetClassification): boolean {
  return classification === "approved_photograph" || classification === "approved_editorial_illustration";
}

export function placeholderReason(classification: ContentAssetClassification, relativePath: string): string {
  switch (classification) {
    case "decorative":
      return "decorative SVG gradient panel with geometric shapes (demo asset marker)";
    case "generic_shape":
      return "zero-content geometric SVG without photographic or editorial artwork";
    case "category_marker":
      return "library category marker SVG, not usable page content";
    case "placeholder":
      return "placeholder or sub-threshold raster";
    case "transparent_fallback":
      return "transparent fallback asset";
    default:
      return `not approved for content (${classification}): ${relativePath}`;
  }
}

export function auditImageLibraryRoot(): {
  libraryRoot: string;
  totalAssets: number;
  rasterAssets: number;
  svgAssets: number;
  approvedPhotographs: number;
  decorativeAssets: number;
  pharmacyFirstRealImages: string[];
  files: Array<{ path: string; classification: ContentAssetClassification; bytes: number }>;
} {
  const libraryRoot = path.join(PHARMACY_WORKSPACE_ROOT, "assets/pharmacy-image-library");
  const files: Array<{ path: string; classification: ContentAssetClassification; bytes: number }> = [];
  if (!fs.existsSync(libraryRoot)) {
    return {
      libraryRoot,
      totalAssets: 0,
      rasterAssets: 0,
      svgAssets: 0,
      approvedPhotographs: 0,
      decorativeAssets: 0,
      pharmacyFirstRealImages: [],
      files,
    };
  }

  for (const abs of walkFiles(libraryRoot)) {
    const rel = path.relative(PHARMACY_WORKSPACE_ROOT, abs).replace(/\\/g, "/");
    const classification = classifyLibraryAssetFile(rel);
    files.push({ path: rel, classification, bytes: fs.statSync(abs).size });
  }

  return {
    libraryRoot,
    totalAssets: files.length,
    rasterAssets: files.filter((f) => /\.(webp|jpe?g|png)$/i.test(f.path)).length,
    svgAssets: files.filter((f) => f.path.endsWith(".svg")).length,
    approvedPhotographs: files.filter((f) => f.classification === "approved_photograph").length,
    decorativeAssets: files.filter((f) =>
      ["decorative", "generic_shape", "category_marker", "placeholder"].includes(f.classification),
    ).length,
    pharmacyFirstRealImages: files
      .filter(
        (f) =>
          f.path.includes("pharmacy-first") &&
          isApprovedContentImage(f.classification),
      )
      .map((f) => f.path),
    files,
  };
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}
