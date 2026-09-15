/**
 * Non-service content image placeholder allocation — safe defaults from Image Library.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolvePharmacyImageForSlot, type ImageMatrixSlot } from "./pharmacyImageOperatingSystem.ts";
import { PRIMARY_PLATFORM_SERVICE_ID } from "./pharmacyPlatformDashboardService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "data/pharmacy-profiles"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

const ROOT = resolveWorkspaceRoot();
const ECOSYSTEM_DIR = path.join(ROOT, "output/pharmacy-content-ecosystem");
const PLACEHOLDER_DIR = path.join(ROOT, "data/pharmacy-content-image-placeholders");

export interface ContentImagePlaceholderMapping {
  serviceId: string;
  assetType: string;
  assetSlug: string;
  slot: string;
  resolvedImage: string;
  altText: string;
  source: "assignment" | "library" | "generic" | "missing";
}

export interface ContentImagePlaceholderDoc {
  version: 1;
  slug: string;
  generatedAt: string;
  mappings: ContentImagePlaceholderMapping[];
}

function safeSlug(v: string): string {
  return (
    String(v || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function normalizeAssetType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("blog")) return "blog-post";
  if (t.includes("patient guide")) return "patient-guide";
  if (t.includes("faq")) return "faq-page";
  if (t.includes("local service")) return "local-page";
  if (t.includes("social")) return "social-preview";
  if (t.includes("gbp")) return "gbp-preview";
  if (t.includes("email")) return "email-header";
  if (t.includes("video") || t.includes("youtube")) return "video-thumbnail";
  if (t.includes("root service")) return "service-page";
  return type.toLowerCase().replace(/\s+/g, "-");
}

function slotForAssetType(assetType: string): ImageMatrixSlot {
  switch (assetType) {
    case "blog-post":
    case "patient-guide":
      return "support";
    case "faq-page":
      return "trust";
    case "local-page":
    case "gbp-preview":
    case "video-thumbnail":
      return "hero";
    case "social-preview":
      return "conversion";
    case "email-header":
      return "support";
    default:
      return "support";
  }
}

function imageUrlFromResolved(resolved: ReturnType<typeof resolvePharmacyImageForSlot>): string {
  if (resolved.assetPath && resolved.assetExists) {
    const rel = resolved.assetPath.replace(ROOT, "").replace(/\\/g, "/");
    if (rel.startsWith("/assets/") || rel.startsWith("/public/")) return rel;
    if (resolved.assetPath.includes("/assets/")) {
      return resolved.assetPath.slice(resolved.assetPath.indexOf("/assets/"));
    }
  }
  if (resolved.libraryRef) return `/assets/pharmacy-images/${resolved.libraryRef}`;
  return "";
}

function resolveGenericFallback(slug: string): ReturnType<typeof resolvePharmacyImageForSlot> {
  const fallbackServices = [PRIMARY_PLATFORM_SERVICE_ID, "pharmacy-first", "travel-vaccinations", "emergency-contraception"];
  for (const svc of fallbackServices) {
    for (const slot of ["hero", "support", "trust", "conversion"] as ImageMatrixSlot[]) {
      const resolved = resolvePharmacyImageForSlot(slug, svc, slot);
      if (resolved.assetExists || resolved.source === "assignment" || resolved.source === "library") {
        return resolved;
      }
    }
  }
  return resolvePharmacyImageForSlot(slug, PRIMARY_PLATFORM_SERVICE_ID, "hero");
}

function resolvePlaceholderImage(
  slug: string,
  serviceId: string,
  slot: ImageMatrixSlot,
): { source: ContentImagePlaceholderMapping["source"]; resolved: ReturnType<typeof resolvePharmacyImageForSlot> } {
  const assigned = resolvePharmacyImageForSlot(slug, serviceId, slot);
  if (assigned.source === "assignment" || assigned.source === "upload" || assigned.source === "ai") {
    return { source: "assignment", resolved: assigned };
  }
  if (assigned.source === "library" && assigned.assetExists) {
    return { source: "library", resolved: assigned };
  }

  const generic = resolveGenericFallback(slug);
  const source: ContentImagePlaceholderMapping["source"] =
    generic.assetExists || generic.source !== "missing" ? "generic" : "missing";
  return { source, resolved: generic };
}

function loadEcosystemIndexes(slug: string): Array<{ serviceId: string; assets: Array<{ id: string; type: string }> }> {
  const dir = path.join(ECOSYSTEM_DIR, safeSlug(slug));
  if (!fs.existsSync(dir)) return [];

  const out: Array<{ serviceId: string; assets: Array<{ id: string; type: string }> }> = [];
  for (const serviceId of fs.readdirSync(dir)) {
    const indexPath = path.join(dir, serviceId, "_ecosystem-index.json");
    if (!fs.existsSync(indexPath)) continue;
    try {
      const doc = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
        serviceId?: string;
        assets?: Array<{ id: string; type: string }>;
      };
      out.push({
        serviceId: doc.serviceId || serviceId,
        assets: doc.assets || [],
      });
    } catch {
      /* skip malformed index */
    }
  }
  return out;
}

export function buildContentImagePlaceholders(slug: string): ContentImagePlaceholderDoc {
  const s = safeSlug(slug);
  const profile = buildPharmacyServicePageProfile(s);
  const mappings: ContentImagePlaceholderMapping[] = [];
  const indexes = loadEcosystemIndexes(s);

  for (const { serviceId, assets } of indexes) {
    for (const asset of assets) {
      const assetType = normalizeAssetType(asset.type);
      if (assetType === "service-page") continue;

      const slot = slotForAssetType(assetType);
      const pick = resolvePlaceholderImage(s, serviceId, slot);
      const url = imageUrlFromResolved(pick.resolved);

      mappings.push({
        serviceId,
        assetType,
        assetSlug: asset.id,
        slot,
        resolvedImage: url,
        altText: `${asset.type} — ${profile.pharmacyName}`,
        source: pick.source,
      });
    }
  }

  return {
    version: 1,
    slug: s,
    generatedAt: new Date().toISOString(),
    mappings,
  };
}

export function saveContentImagePlaceholders(slug: string): string {
  const doc = buildContentImagePlaceholders(slug);
  fs.mkdirSync(PLACEHOLDER_DIR, { recursive: true });
  const file = path.join(PLACEHOLDER_DIR, `${doc.slug}.json`);
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return file;
}

export function loadContentImagePlaceholders(slug: string): ContentImagePlaceholderDoc | null {
  const file = path.join(PLACEHOLDER_DIR, `${safeSlug(slug)}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as ContentImagePlaceholderDoc;
}
