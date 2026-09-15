/**
 * Campaign image slot status — reads pharmacy image assignments with library fallback.
 */
import { type PharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";
import {
  buildPageSlotCards,
  getImageSourceBreakdown,
  type ImageSource,
  type ImageSourceBreakdown,
} from "./pharmacyImageOperatingSystem.ts";

const SLOT_LABELS: Record<PharmacyImageSlot, string> = {
  hero: "Hero",
  support: "Support",
  trust: "Trust",
  conversion: "Conversion",
};

export interface CampaignImageSlotStatus {
  slot: PharmacyImageSlot;
  label: string;
  assigned: boolean;
  previewUrl: string | null;
  sourcePath: string;
  libraryRef: string;
  alt: string;
  source: ImageSource;
  sourceType: "library" | "upload" | "ai" | "missing" | null;
  status: "assigned" | "pending" | "missing";
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

export function getCampaignImageSlotStatus(slug: string, serviceId: string, campaignId?: string): CampaignImageSlotStatus[] {
  const s = safeSlug(slug);
  const cards = buildPageSlotCards(s, serviceId, campaignId);

  return cards.map((card) => ({
    slot: card.slot,
    label: SLOT_LABELS[card.slot],
    assigned: card.status === "assigned" || (card.status === "pending" && Boolean(card.aiRequestId)),
    previewUrl: card.previewUrl,
    sourcePath: card.filePath || "",
    libraryRef: card.libraryRef || "",
    alt: card.altText,
    source:
      card.sourceType === "library"
        ? "assignment"
        : card.sourceType === "upload"
          ? "upload"
          : card.sourceType === "ai"
            ? "ai"
            : card.status === "assigned"
              ? "library"
              : "missing",
    sourceType: card.sourceType === "missing" ? null : card.sourceType,
    status: card.status,
  }));
}

export function getCampaignImageSummary(slug: string, serviceId: string, campaignId?: string): {
  assignedCount: number;
  totalSlots: number;
  allAssigned: boolean;
  slots: CampaignImageSlotStatus[];
  sourceBreakdown: ImageSourceBreakdown;
  imageLibraryUrl: string;
  missingSlots: PharmacyImageSlot[];
} {
  const slots = getCampaignImageSlotStatus(slug, serviceId, campaignId);
  const assignedCount = slots.filter((s) => s.status === "assigned").length;
  const sourceBreakdown = getImageSourceBreakdown(slug, serviceId, campaignId);
  const params = new URLSearchParams({ slug, service: serviceId });
  if (campaignId) params.set("campaignId", campaignId);
  return {
    assignedCount,
    totalSlots: slots.length,
    allAssigned: assignedCount === slots.length,
    slots,
    sourceBreakdown,
    imageLibraryUrl: `/api/pharmacy-image-library?${params.toString()}`,
    missingSlots: sourceBreakdown.missingSlots,
  };
}

export type { ImageSourceBreakdown };
