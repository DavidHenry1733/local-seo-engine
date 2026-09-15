/**
 * NT-E2E-31 — Replace stale library SVG image references with production assignments in existing HTML.
 */
import * as cheerio from "cheerio";
import { resolvePharmacyImageWithAssignments } from "./pharmacyImageAssignmentResolver.ts";
import { publicAssetHref } from "./pharmacyImageSlotRenderHelpers.ts";
import type { PharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

function normalizeSlot(slot: string): PharmacyImageSlot | null {
  if (slot === "supporting") return "support";
  if (["hero", "support", "trust", "conversion"].includes(slot)) return slot as PharmacyImageSlot;
  return null;
}

export function applyProductionImageAssignmentsToHtml(
  html: string,
  slug: string,
  pageSlug: string,
  serviceId: string,
): string {
  const $ = cheerio.load(html);
  const profile = buildPharmacyServicePageProfile(slug);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || serviceId;

  $("[data-image-slot]").each((_, el) => {
    const slotRaw = $(el).attr("data-image-slot") || "";
    const slot = normalizeSlot(slotRaw);
    if (!slot) return;

    const resolved = resolvePharmacyImageWithAssignments(slug, slot, {
      slug,
      pageSlug,
      templateFamilyKey: "clinical-nhs-services",
      serviceKey: serviceId,
      serviceName,
      pharmacyName: profile.pharmacyName,
      location: profile.town,
      previewBasePath: "/assets",
      visualDemoMode: true,
      previewMode: false,
      campaignId: serviceId,
    });

    if (!resolved.assetExists || !resolved.assetPath || resolved.source !== "image-platform") return;

    const href = publicAssetHref(resolved.assetPath);
    const platformAssetId = (resolved.libraryRef || "").replace(/^image-platform\//, "") || resolved.imageKey;
    $(el).attr("data-image-source", "pharmacy-image-platform");
    if (platformAssetId) $(el).attr("data-platform-asset-id", platformAssetId);

    const img = $(el).is("img") ? $(el) : $(el).find("img").first();
    if (img.length) {
      img.attr("src", href);
      img.attr("alt", resolved.alt);
      img.attr("data-image-source", "pharmacy-image-platform");
      if (platformAssetId) img.attr("data-platform-asset-id", platformAssetId);
    }
  });

  return $.html();
}
