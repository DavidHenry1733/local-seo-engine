/**
 * Per-pharmacy master stock image library — bulk upload and auto-fill service slots.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  assignSlotImage,
  IMAGE_MATRIX_SLOTS,
  loadImageAssignments,
  registerUpload,
  type ImageMatrixSlot,
  type PharmacyImageAssignmentsDoc,
} from "./pharmacyImageOperatingSystem.ts";
import { BENCHMARK_MASTER_SERVICE_IDS } from "./pharmacyMasterPublishConfig.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "./pharmacyVisualExperienceConfig.ts";

export type MasterStockImageType =
  | "hero"
  | "support"
  | "trust"
  | "conversion"
  | "blog"
  | "local"
  | "social"
  | "GBP";

export type MasterStockImageSubject =
  | "pharmacist"
  | "consultation"
  | "medicines"
  | "travel"
  | "blood-pressure"
  | "pharmacy-front"
  | "patient-care"
  | "team"
  | "local-area"
  | "general";

export interface MasterStockImageEntry {
  id: string;
  filename: string;
  path: string;
  label: string;
  types: MasterStockImageType[];
  subjects: MasterStockImageSubject[];
  uploadedAt: string;
}

export interface MasterStockImageStore {
  version: 1;
  slug: string;
  updatedAt: string;
  images: MasterStockImageEntry[];
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

export function masterStockStorePath(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-stock-images", `${safeSlug(slug)}.json`);
}

export function masterStockUploadDir(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "assets/pharmacy-uploads", safeSlug(slug), "master-stock");
}

export function loadMasterStockImages(slug: string): MasterStockImageStore {
  const s = safeSlug(slug);
  const file = masterStockStorePath(s);
  if (!fs.existsSync(file)) {
    return { version: 1, slug: s, updatedAt: new Date().toISOString(), images: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as MasterStockImageStore;
    return { version: 1, slug: s, updatedAt: raw.updatedAt || new Date().toISOString(), images: raw.images || [] };
  } catch {
    return { version: 1, slug: s, updatedAt: new Date().toISOString(), images: [] };
  }
}

export function saveMasterStockImages(store: MasterStockImageStore): string {
  const file = masterStockStorePath(store.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
  return file;
}

export function registerMasterStockUpload(
  slug: string,
  input: {
    filename: string;
    absolutePath: string;
    label?: string;
    types?: MasterStockImageType[];
    subjects?: MasterStockImageSubject[];
    mimeType?: string;
  },
): MasterStockImageEntry {
  const s = safeSlug(slug);
  const store = loadMasterStockImages(s);
  const rel = path.relative(PHARMACY_WORKSPACE_ROOT, input.absolutePath).split(path.sep).join("/");
  const slotType = (input.types?.[0] || "support") as ImageMatrixSlot;
  const upload = registerUpload(s, {
    filename: input.filename,
    path: rel,
    category: slotType === "hero" || slotType === "support" || slotType === "trust" || slotType === "conversion" ? slotType : "support",
    mimeType: input.mimeType || "image/jpeg",
    label: input.label || input.filename,
  });
  const entry: MasterStockImageEntry = {
    id: upload.id,
    filename: input.filename,
    path: rel,
    label: input.label || input.filename,
    types: input.types?.length ? input.types : ["support"],
    subjects: input.subjects?.length ? input.subjects : ["general"],
    uploadedAt: new Date().toISOString(),
  };
  store.images.push(entry);
  saveMasterStockImages(store);
  return entry;
}

const SERVICE_SUBJECT_HINTS: Record<string, MasterStockImageSubject[]> = {
  "pharmacy-first": ["pharmacist", "pharmacy-front", "patient-care"],
  "blood-pressure-checks": ["blood-pressure", "consultation", "patient-care"],
  "travel-vaccinations": ["travel", "consultation", "medicines"],
  "prescription-dispensing": ["medicines", "pharmacist"],
  "emergency-contraception": ["consultation", "patient-care"],
  "repeat-prescriptions": ["medicines", "pharmacist"],
  "pharmacy-contraception-service": ["consultation", "patient-care"],
  "new-medicine-service": ["consultation", "medicines"],
};

const SLOT_TYPE_MAP: Record<ImageMatrixSlot, MasterStockImageType> = {
  hero: "hero",
  support: "support",
  trust: "trust",
  conversion: "conversion",
  guide: "support",
  blog: "blog",
  social: "social",
  GBP: "GBP",
};

function scoreMasterStockMatch(
  image: MasterStockImageEntry,
  slot: ImageMatrixSlot,
  serviceId: string,
): number {
  let score = 0;
  const slotType = SLOT_TYPE_MAP[slot] || "support";
  if (image.types.includes(slotType)) score += 3;
  const hints = SERVICE_SUBJECT_HINTS[serviceId] || ["general"];
  for (const h of hints) {
    if (image.subjects.includes(h)) score += 2;
  }
  if (image.subjects.includes("general")) score += 1;
  return score;
}

function pickBestMasterStock(
  images: MasterStockImageEntry[],
  slot: ImageMatrixSlot,
  serviceId: string,
): MasterStockImageEntry | null {
  if (!images.length) return null;
  const ranked = [...images].sort(
    (a, b) => scoreMasterStockMatch(b, slot, serviceId) - scoreMasterStockMatch(a, slot, serviceId),
  );
  return ranked[0] || null;
}

function hasExplicitAssignment(doc: PharmacyImageAssignmentsDoc, serviceId: string, slot: ImageMatrixSlot): boolean {
  const key = `${serviceId}:${slot}`;
  return Boolean(doc.assignments[key]?.libraryRef || doc.assignments[key]?.uploadId || doc.assignments[key]?.aiRequestId);
}

export function autoFillServiceImagesFromMasterStock(
  slug: string,
  options?: { serviceId?: string; overwrite?: boolean; allServices?: boolean },
): { assigned: number; skipped: number; services: string[] } {
  const s = safeSlug(slug);
  const store = loadMasterStockImages(s);
  if (!store.images.length) {
    return { assigned: 0, skipped: 0, services: [] };
  }

  const serviceIds = options?.allServices
    ? [
        ...VISUAL_EXPERIENCE_BENCHMARK_SERVICES.filter((id) =>
          BENCHMARK_MASTER_SERVICE_IDS.includes(id as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number]),
        ),
      ]
    : [options?.serviceId || "pharmacy-first"];

  let assigned = 0;
  let skipped = 0;

  for (const serviceId of serviceIds) {
    for (const slot of ["hero", "support", "trust", "conversion"] as ImageMatrixSlot[]) {
      const doc = loadImageAssignments(s);
      if (!options?.overwrite && hasExplicitAssignment(doc, serviceId, slot)) {
        skipped += 1;
        continue;
      }
      const best = pickBestMasterStock(store.images, slot, serviceId);
      if (!best) {
        skipped += 1;
        continue;
      }
      assignSlotImage(s, serviceId, slot, {
        source: "upload",
        uploadId: best.id,
        label: best.label,
      });
      assigned += 1;
    }
  }

  return { assigned, skipped, services: serviceIds };
}
