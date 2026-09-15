/**
 * Review & Trust content pack — confirmed profile evidence only.
 * Does not invent reviewer names, credentials, reviews, guarantees or clinical claims.
 */
import fs from "node:fs";
import path from "node:path";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import type { CampaignRunStamp } from "./pharmacyCurrentRunCampaignHandoff.ts";

export const REVIEW_TRUST_PACK_FILENAME = "review-trust.json";
export const REVIEW_TRUST_PACK_ASSET_ID = "review-trust";

export type ReviewTrustEvidenceStatus = "confirmed" | "unavailable";

export type ReviewTrustPack = {
  version: 1;
  type: "review-trust";
  slug: string;
  serviceId: string;
  serviceName: string;
  generatedAt: string;
  pharmacy: {
    name: string;
    tradingName: string | null;
    addressLine1: string | null;
    town: string | null;
    county: string | null;
    postcode: string | null;
    fullAddress: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    openingHours: string | null;
  };
  regulatory: {
    gphcNumber: string | null;
    gphcPremisesUrl: string | null;
    nhsProfileUrl: string | null;
    superintendentPharmacistName: string | null;
  };
  reviewer: {
    name: string;
    role: string | null;
    qualifications: string | null;
    gphcNumber: string | null;
    bio: string | null;
  } | null;
  service: {
    serviceId: string;
    serviceName: string;
    confirmedOnProfile: boolean;
    fundingModel: string | null;
  };
  brandAndCta: {
    primaryColor: string | null;
    headerCtaText: string | null;
    headerCtaUrl: string | null;
    primaryCta: string | null;
  };
  trustSignals: Array<{ id: string; label: string; value: string; status: ReviewTrustEvidenceStatus }>;
  importedTrustEvidence: Array<{ kind: string; value: string; sourceUrl: string | null }>;
  evidenceStatus: {
    pharmacyIdentity: ReviewTrustEvidenceStatus;
    reviewer: ReviewTrustEvidenceStatus;
    gphc: ReviewTrustEvidenceStatus;
    superintendent: ReviewTrustEvidenceStatus;
  };
  generationStamp: {
    tenantSlug: string;
    campaignId: string;
    generatedAt: string;
    sourceContext: "customer-imported-profile";
    runId?: string;
  };
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function orNull(value: unknown): string | null {
  const v = clean(value);
  return v || null;
}

function tenantKey(slug: string): string {
  return resolveTenantProfileSlug(slug) || slug;
}

export function reviewTrustPackPath(slug: string, serviceId: string): string {
  const key = tenantKey(slug);
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    key,
    serviceId,
    "packs",
    REVIEW_TRUST_PACK_FILENAME,
  );
}

export function reviewTrustPackExists(slug: string, serviceId: string): boolean {
  return fs.existsSync(reviewTrustPackPath(slug, serviceId));
}

export function buildReviewTrustPack(slug: string, serviceId: string, stamp?: CampaignRunStamp): ReviewTrustPack {
  const key = tenantKey(slug);
  const profileDoc = loadPharmacyProfile(key);
  const raw = profileDoc.data as Record<string, unknown>;
  const page = buildPharmacyServicePageProfile(key);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || serviceId.replace(/-/g, " ");
  const generatedAt = stamp?.generatedAt || new Date().toISOString();

  const selectedServices = Array.isArray(raw.selectedServices)
    ? (raw.selectedServices as unknown[]).map((s) => clean(s))
    : [];
  const delivery = (raw.serviceDeliveryProfiles as Record<string, { fundingModel?: string }> | undefined)?.[
    serviceId
  ];
  const fundingModel = orNull(delivery?.fundingModel);

  const reviewerName = orNull(page.reviewerName);
  const reviewer = reviewerName
    ? {
        name: reviewerName,
        role: orNull(page.reviewerRole),
        qualifications: orNull(page.reviewerQualifications),
        gphcNumber: orNull(page.reviewerGphcNumber),
        bio: orNull(page.reviewerBio),
      }
    : null;

  const gphcNumber = orNull(page.gphcNumber);
  const superintendent = orNull(page.superintendentPharmacistName);
  const pharmacyName = clean(page.pharmacyName) || clean(raw.pharmacyName) || clean(raw.tradingName);

  const trustSignals: ReviewTrustPack["trustSignals"] = [];
  if (pharmacyName) {
    trustSignals.push({
      id: "pharmacy-name",
      label: "Pharmacy name",
      value: pharmacyName,
      status: "confirmed",
    });
  }
  if (page.customerFacingAddress || page.fullAddress || page.addressLine1) {
    trustSignals.push({
      id: "address",
      label: "Address",
      value: page.customerFacingAddress || page.fullAddress || page.addressLine1,
      status: "confirmed",
    });
  }
  if (page.phone) {
    trustSignals.push({
      id: "phone",
      label: "Phone",
      value: page.displayPhone || page.phone,
      status: "confirmed",
    });
  }
  if (page.email) {
    trustSignals.push({
      id: "email",
      label: "Email",
      value: page.email,
      status: "confirmed",
    });
  }
  if (page.website) {
    trustSignals.push({
      id: "website",
      label: "Website",
      value: page.website,
      status: "confirmed",
    });
  }
  const openingHoursRaw = orNull(raw.openingHours);
  if (openingHoursRaw && !/contact the pharmacy to confirm/i.test(openingHoursRaw)) {
    trustSignals.push({
      id: "opening-hours",
      label: "Opening hours",
      value: openingHoursRaw,
      status: "confirmed",
    });
  }
  if (gphcNumber) {
    trustSignals.push({
      id: "gphc",
      label: "GPhC premises number",
      value: gphcNumber,
      status: "confirmed",
    });
  }
  if (superintendent) {
    trustSignals.push({
      id: "superintendent",
      label: "Superintendent pharmacist",
      value: superintendent,
      status: "confirmed",
    });
  }
  if (reviewer) {
    trustSignals.push({
      id: "reviewer",
      label: "Clinical reviewer",
      value: [reviewer.name, reviewer.role].filter(Boolean).join(" — "),
      status: "confirmed",
    });
  }
  if (raw.consultationRoomAvailable === true) {
    trustSignals.push({
      id: "consultation-room",
      label: "Consultation room",
      value: "Confirmed available on pharmacy profile",
      status: "confirmed",
    });
  }

  const importedTrustEvidence: ReviewTrustPack["importedTrustEvidence"] = [];
  const snap = raw.websiteImportSnapshot as
    | {
        intelligence?: {
          trustEvidence?: Array<{ kind?: string; value?: string; sourceUrl?: string }>;
        };
      }
    | undefined;
  for (const item of snap?.intelligence?.trustEvidence || []) {
    const value = clean(item.value);
    if (!value) continue;
    importedTrustEvidence.push({
      kind: clean(item.kind) || "trust",
      value,
      sourceUrl: orNull(item.sourceUrl),
    });
  }

  return {
    version: 1,
    type: "review-trust",
    slug: key,
    serviceId,
    serviceName,
    generatedAt,
    pharmacy: {
      name: pharmacyName,
      tradingName: orNull(page.tradingName),
      addressLine1: orNull(page.addressLine1),
      town: orNull(page.town),
      county: orNull(page.county),
      postcode: orNull(page.postcode),
      fullAddress: orNull(page.customerFacingAddress || page.fullAddress),
      phone: orNull(page.displayPhone || page.phone),
      email: orNull(page.email),
      website: orNull(page.website),
      openingHours: openingHoursRaw && !/contact the pharmacy to confirm/i.test(openingHoursRaw) ? openingHoursRaw : null,
    },
    regulatory: {
      gphcNumber,
      gphcPremisesUrl: orNull(page.gphcPremisesUrl),
      nhsProfileUrl: orNull(page.nhsProfileUrl),
      superintendentPharmacistName: superintendent,
    },
    reviewer,
    service: {
      serviceId,
      serviceName,
      confirmedOnProfile: selectedServices.includes(serviceId),
      fundingModel: fundingModel === "unknown" ? null : fundingModel,
    },
    brandAndCta: {
      primaryColor: orNull(page.brandPrimaryColor),
      headerCtaText: orNull(page.headerCtaText),
      headerCtaUrl: orNull(page.headerCtaUrl),
      primaryCta: orNull(page.primaryCta),
    },
    trustSignals,
    importedTrustEvidence,
    evidenceStatus: {
      pharmacyIdentity: pharmacyName ? "confirmed" : "unavailable",
      reviewer: reviewer ? "confirmed" : "unavailable",
      gphc: gphcNumber ? "confirmed" : "unavailable",
      superintendent: superintendent ? "confirmed" : "unavailable",
    },
    generationStamp: {
      tenantSlug: key,
      campaignId: serviceId,
      generatedAt,
      sourceContext: "customer-imported-profile" as const,
      ...(stamp?.runId ? { runId: stamp.runId } : {}),
    },
  };
}

function upsertEcosystemIndexAsset(slug: string, serviceId: string, outputPath: string): void {
  const key = tenantKey(slug);
  const indexPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    key,
    serviceId,
    "_ecosystem-index.json",
  );
  if (!fs.existsSync(indexPath)) return;
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
      assets?: Array<{ id: string; type: string; urlPath: string; outputPath: string; sourceSections: string[]; wordCount: number }>;
    };
    const assets = Array.isArray(index.assets) ? [...index.assets] : [];
    const next = {
      id: REVIEW_TRUST_PACK_ASSET_ID,
      type: "Review & Trust pack",
      urlPath: "(pack)",
      outputPath,
      sourceSections: ["profile", "confirmed trust evidence"],
      wordCount: 0,
    };
    const idx = assets.findIndex((a) => a.id === REVIEW_TRUST_PACK_ASSET_ID);
    if (idx >= 0) assets[idx] = next;
    else assets.push(next);
    fs.writeFileSync(indexPath, JSON.stringify({ ...index, assets }, null, 2), "utf8");
  } catch {
    /* index update is best-effort; pack file is authoritative for package inclusion */
  }
}

export function writeReviewTrustPack(
  slug: string,
  serviceId: string,
  stamp?: CampaignRunStamp,
): { ok: boolean; path: string; pack: ReviewTrustPack; error?: string } {
  const pack = buildReviewTrustPack(slug, serviceId, stamp);
  if (!pack.pharmacy.name) {
    return {
      ok: false,
      path: reviewTrustPackPath(slug, serviceId),
      pack,
      error: "Pharmacy identity unavailable — cannot generate Review & Trust pack",
    };
  }
  const outPath = reviewTrustPackPath(slug, serviceId);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(pack, null, 2), "utf8");
  upsertEcosystemIndexAsset(slug, serviceId, outPath);
  return { ok: true, path: outPath, pack };
}

export function loadReviewTrustPack(slug: string, serviceId: string): ReviewTrustPack | null {
  const file = reviewTrustPackPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ReviewTrustPack;
  } catch {
    return null;
  }
}
