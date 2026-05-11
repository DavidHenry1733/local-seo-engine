// ── Image Role Assigner ───────────────────────────────────────────────────────
// Assigns uploaded image-pack images to fixed page roles at generation time.
// Each business type has a flat image library (up to 8 images).
// At page generation, 4 roles are randomly filled from that library.
//
// Roles:
//   heroImage         → split hero section (top of page)
//   earlySupportImage → first supporting image (early in body)
//   trustImage        → trust / credibility / about section
//   conversionImage   → final CTA / conversion section
//
// Override precedence (highest wins):
//   user-uploaded role override > AI-generated image > random pack image

import fs   from "node:fs";
import path from "node:path";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImageRole = "heroImage" | "earlySupportImage" | "trustImage" | "conversionImage";

export interface ImageRoles {
  heroImage:         string;
  earlySupportImage: string;
  trustImage:        string;
  conversionImage:   string;
}

export interface ImageRoleOverrides {
  heroImage?:         string;
  earlySupportImage?: string;
  trustImage?:        string;
  conversionImage?:   string;
}

// All 4 roles in page order
export const ALL_ROLES: ImageRole[] = [
  "heroImage",
  "earlySupportImage",
  "trustImage",
  "conversionImage",
];

// ── Industry mapping ──────────────────────────────────────────────────────────
// Maps project.industryType / businessType variants → image pack folder name.
// Pack folders live at assets/image-packs/{packIndustry}/{slot}.jpg

const INDUSTRY_TO_PACK: Record<string, string> = {
  // Plumber — matches project industryType AND free-text service names
  plumber:                  "plumber",
  plumbing:                 "plumber",
  "emergency-plumber":      "plumber",
  emergencyplumber:         "plumber",
  "emergency plumber":      "plumber",
  "emergency-plumbing":     "plumber",
  "emergency plumbing":     "plumber",
  "plumber-local":          "plumber",
  "local plumber":          "plumber",
  "local-plumber":          "plumber",
  "drainage":               "plumber",
  "drain":                  "plumber",

  // Electrician
  electrician:              "electrician",
  electrical:               "electrician",
  "electrical-contractor":  "electrician",
  "electrician-local":      "electrician",
  "local electrician":      "electrician",
  "emergency electrician":  "electrician",

  // Hairdresser
  hairdresser:              "hairdresser",
  "hair-salon":             "hairdresser",
  "hair salon":             "hairdresser",
  "hair-stylist":           "hairdresser",
  "hair stylist":           "hairdresser",
  barber:                   "hairdresser",
  "barber shop":            "hairdresser",

  // Accountant
  accountant:               "accountant",
  accounting:               "accountant",
  bookkeeper:               "accountant",
  bookkeeping:              "accountant",
  "chartered-accountant":   "accountant",
  "chartered accountant":   "accountant",

  // Restaurant
  restaurant:               "restaurant",
  cafe:                     "restaurant",
  "coffee-shop":            "restaurant",
  "coffee shop":            "restaurant",
  takeaway:                 "restaurant",
  "food-and-drink":         "restaurant",
  "food and drink":         "restaurant",

  // General Builder
  "general-builder":        "general-builder",
  "general builder":        "general-builder",
  builder:                  "general-builder",
  builders:                 "general-builder",
  construction:             "general-builder",
  "general-building":       "general-builder",
  "general building":       "general-builder",
  renovation:               "general-builder",
  renovations:              "general-builder",
  "building-contractor":    "general-builder",
  "building contractor":    "general-builder",
};

/** Map any industryType/businessType string to an image pack folder name, or null if unmapped. */
export function mapToPackIndustry(industryType: string | undefined): string | null {
  if (!industryType) return null;
  const key = industryType.toLowerCase().trim().replace(/_/g, "-");
  return INDUSTRY_TO_PACK[key] ?? null;
}

// ── Pack manifest ─────────────────────────────────────────────────────────────

interface PackEntry {
  id:           string;
  industryType: string;
  slot:         string;
  path:         string;
  approved:     boolean;
}

function readPackManifest(workspaceRoot: string): PackEntry[] {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(workspaceRoot, "config", "imagePacks.json"), "utf8")
    ) as { images: PackEntry[] };
    return raw.images ?? [];
  } catch { return []; }
}

// ── Image resolution ──────────────────────────────────────────────────────────

/**
 * Returns static asset URLs for all uploaded images for a given pack industry.
 * Only includes entries where the physical file exists on disk.
 */
export function getUploadedPackImages(packIndustry: string, workspaceRoot: string): string[] {
  const entries = readPackManifest(workspaceRoot).filter(
    e => e.industryType === packIndustry &&
         fs.existsSync(path.join(workspaceRoot, e.path))
  );
  // Return as static asset URLs (served by express static middleware)
  return entries.map(e => `/assets/image-packs/${e.industryType}/${e.slot}.jpg`);
}

/** Returns all pack entries (with upload status) for a given pack industry. */
export function getPackEntries(packIndustry: string, workspaceRoot: string): Array<PackEntry & { hasFile: boolean; url: string }> {
  return readPackManifest(workspaceRoot)
    .filter(e => e.industryType === packIndustry)
    .map(e => ({
      ...e,
      hasFile: fs.existsSync(path.join(workspaceRoot, e.path)),
      url: `/assets/image-packs/${e.industryType}/${e.slot}.jpg`,
    }));
}

// ── Role assignment ───────────────────────────────────────────────────────────

/** Fisher-Yates in-place shuffle — returns new array, never mutates input. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assign uploaded pack images to the 4 fixed page roles.
 *
 * Rules:
 *  - Select randomly from the business type's library.
 *  - Never reuse the same image twice unless the library has fewer than 4 images.
 *  - Overrides (user-uploaded or AI-generated) replace the random pick for that role.
 *  - Returns empty strings for all roles if no pack images are uploaded (caller
 *    should fall back to legacy file-based image resolution).
 */
export function assignImageRoles(
  industryType:  string | undefined,
  workspaceRoot: string,
  overrides:     ImageRoleOverrides = {},
): ImageRoles {
  const empty: ImageRoles = {
    heroImage: "", earlySupportImage: "", trustImage: "", conversionImage: "",
  };

  const packIndustry = mapToPackIndustry(industryType ?? "");
  if (!packIndustry) return applyOverrides(empty, overrides);

  const pool = getUploadedPackImages(packIndustry, workspaceRoot);
  if (pool.length === 0) return applyOverrides(empty, overrides);

  // Shuffle and assign — wrap around only if fewer than 4 images
  const shuffled = shuffle(pool);
  const result: ImageRoles = {
    heroImage:         shuffled[0 % shuffled.length],
    earlySupportImage: shuffled[1 % shuffled.length],
    trustImage:        shuffled[2 % shuffled.length],
    conversionImage:   shuffled[3 % shuffled.length],
  };

  return applyOverrides(result, overrides);
}

function applyOverrides(roles: ImageRoles, overrides: ImageRoleOverrides): ImageRoles {
  const result = { ...roles };
  for (const role of ALL_ROLES) {
    const ov = overrides[role];
    if (ov && ov.trim()) result[role] = ov.trim();
  }
  return result;
}

// ── Role labels (for UI) ──────────────────────────────────────────────────────

export const ROLE_LABELS: Record<ImageRole, { label: string; desc: string; icon: string }> = {
  heroImage:         { label: "Hero",          desc: "Split hero — top of page",             icon: "🖼" },
  earlySupportImage: { label: "Early Support", desc: "First body image — early in content",  icon: "📸" },
  trustImage:        { label: "Trust",         desc: "Near credibility / about section",     icon: "🤝" },
  conversionImage:   { label: "Conversion",    desc: "Near final CTA / conversion section",  icon: "🎯" },
};
