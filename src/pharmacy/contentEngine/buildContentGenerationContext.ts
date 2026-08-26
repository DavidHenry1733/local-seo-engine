/**
 * ContentGenerationContext builder — the ONLY module allowed to load profile, brand, service, images, and tenant data.
 */
import fs from "node:fs";
import path from "node:path";

import { loadImageAssignments } from "../pharmacyImageOperatingSystem.ts";
import {
  injectOwnerVariables,
  loadMasterLibraryFile,
  parseMasterLibraryMarkdown,
  type MasterOwnerVariables,
} from "../pharmacyMasterLibraryParser.ts";
import { getServicePublishMeta } from "../pharmacyMasterPublishConfig.ts";
import { mapResolveInputFromProfile, resolvePharmacyMapEmbed } from "../pharmacyMapResolver.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION, type PharmacyProfileData } from "../pharmacyProfileSchema.ts";
import { assertValidGenerationPharmacyIdentity } from "../pharmacyServicePageProfileContext.ts";
import { resolveCurrentPharmacyPresentationProfile } from "../pharmacyPresentationProfileResolver.ts";
import { loadServiceVariantPack } from "../pharmacyServiceVariantLibrary.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import { resolveTenantProfileSlug } from "../pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import { getEcosystemRoot } from "./contentEnginePaths.ts";
import {
  CONTENT_ENGINE_CONTRACT_VERSION,
  type ContentGenerationContext,
  type ContentGenerationContextBuildOptions,
} from "./contentGenerationContextTypes.ts";
import { validateContentGenerationContext } from "./contentEngineContract.ts";
import { buildBusinessProfileIntelligenceFromProfile } from "../businessProfileIntelligence/buildBusinessProfileIntelligence.ts";
import {
  loadAreaDiscoverySnapshot,
  loadFrozenCampaignSelectedAreas,
  loadLocalMarketSnapshot,
  type LocalMarketSnapshot,
} from "../pharmacyLocalMarketSnapshot.ts";
import {
  hierarchyToContentGenerationAreas,
  resolveLocalLocationHierarchy,
} from "../pharmacyLocalAreaResolver.ts";
import {
  localityPackToHealthcareProviders,
  resolveLocalityIntelligencePack,
} from "./pharmacyLocalityIntelligencePackV1.ts";

function enrichLocalMarketWithLocalityPacks(
  snapshot: LocalMarketSnapshot | null,
  slug: string,
  areaNames: string[],
  pharmacyAddress: string,
): LocalMarketSnapshot | null {
  const packs = areaNames.map((areaName) =>
    resolveLocalityIntelligencePack({ areaName, nearbyAreaNames: areaNames, pharmacyAddress }),
  );
  const synthesized = packs.flatMap((pack) => localityPackToHealthcareProviders(pack));
  if (!synthesized.length) return snapshot;
  if (!snapshot) {
    return {
      slug,
      generatedAt: new Date().toISOString(),
      yourPharmacy: null,
      healthcareProviders: synthesized,
      nearbyPharmacies: [],
    };
  }
  if (snapshot.healthcareProviders.length >= 3) return snapshot;
  const seen = new Set(snapshot.healthcareProviders.map((p) => p.businessName.toLowerCase()));
  const merged = [...snapshot.healthcareProviders];
  for (const provider of synthesized) {
    const key = provider.businessName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(provider);
  }
  return { ...snapshot, healthcareProviders: merged };
}

function workspaceRoot(): string {
  return PHARMACY_WORKSPACE_ROOT;
}

function stripMd(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").trim();
}

function buildOwnerVariables(
  serviceId: string,
  raw: PharmacyProfileData,
  localArea: string,
): MasterOwnerVariables {
  const serviceMeta = getServicePublishMeta(serviceId)!;
  const phone = String(raw.phone || "").trim();
  const town = localArea || String(raw.primaryTown || raw.townCity || "").trim();
  return {
    phone: phone || "the pharmacy team",
    opening_hours: String(raw.openingHours || raw.opening_hours || "Monday to Friday 9am–6pm, Saturday 9am–1pm"),
    booking_link: String(raw.bookingUrl || "").trim() || (phone ? `Call ${phone} to book` : "Contact the pharmacy to book"),
    consultation_room: "private consultation room",
    nhs_medication_review: "",
    private_review_fee: "",
    town,
    ...serviceMeta.ownerVariableDefaults({ phone, data: { ...raw, town } as Record<string, unknown> }),
  };
}

function resolveSelectedAreas(raw: PharmacyProfileData): ContentGenerationContext["selectedAreas"] {
  const fromProfile = (raw.selectedAreas || [])
    .filter((a) => a.selected !== false)
    .map((a) => {
      const areaName = String(a.areaName || "").trim();
      return {
        areaName,
        areaSlug: slugifyArea(areaName),
        selected: true,
        priority: a.priority,
        order: a.order,
      };
    })
    .filter((a) => a.areaName);
  if (fromProfile.length) return fromProfile;
  const primaryTown = String(raw.primaryTown || raw.townCity || "").trim();
  if (!primaryTown) return [];
  return [{ areaName: primaryTown, areaSlug: slugifyArea(primaryTown), selected: true, order: 1 }];
}

export function buildContentGenerationContext(
  slug: string,
  serviceId: string,
  options: ContentGenerationContextBuildOptions = {},
): ContentGenerationContext {
  const resolvedSlug = resolveTenantProfileSlug(slug) || slug;
  const presentation = resolveCurrentPharmacyPresentationProfile(resolvedSlug);
  const raw = presentation.data;
  const profile = presentation.servicePageProfile;
  const serviceMeta = getServicePublishMeta(serviceId);
  if (!serviceMeta) {
    throw new Error(`ContentGenerationContext: unknown service "${serviceId}"`);
  }

  const localLocationHierarchy = resolveLocalLocationHierarchy(resolvedSlug, serviceId, raw);
  const resolvedFromProfile = resolveSelectedAreas(raw);
  const profileSelectedAreas =
    options.selectedAreasOverride?.length
      ? options.selectedAreasOverride
      : (resolvedFromProfile.length
          ? resolvedFromProfile
          : loadFrozenCampaignSelectedAreas(resolvedSlug, serviceId) || []
        ).map((a) => ({
          areaName: a.areaName,
          areaSlug: "areaSlug" in a && a.areaSlug ? a.areaSlug : slugifyArea(a.areaName),
          selected: a.selected !== false,
          priority: "priority" in a ? a.priority : undefined,
          order: "order" in a ? a.order : undefined,
        }));
  const selectedAreas = localLocationHierarchy.ok
    ? hierarchyToContentGenerationAreas(localLocationHierarchy)
    : profileSelectedAreas;
  const primaryTown = String(raw.primaryTown || raw.townCity || profile.town || "").trim();
  const localArea = options.localArea || primaryTown || selectedAreas[0]?.areaName || "";

  if (!profile.pharmacyName?.trim()) {
    throw new Error(`ContentGenerationContext: pharmacyName required for "${resolvedSlug}" — no Brook/pharmaconnect fallbacks allowed`);
  }
  assertValidGenerationPharmacyIdentity(profile.pharmacyName);

  const masterRelativePath = `docs/pharmacy-master-library/${serviceMeta.masterFile}`;
  const masterAbsolutePath = path.join(workspaceRoot(), masterRelativePath);
  if (!fs.existsSync(masterAbsolutePath)) {
    throw new Error(`ContentGenerationContext: master library not found: ${masterAbsolutePath}`);
  }

  const md = loadMasterLibraryFile(masterRelativePath);
  const parsed = parseMasterLibraryMarkdown(md, serviceId, serviceMeta.serviceName);
  const ownerVariables = buildOwnerVariables(serviceId, raw, localArea);
  const faqs = parsed.faqs.map((f) => ({
    question: f.question,
    answer: stripMd(injectOwnerVariables(f.answer, ownerVariables)),
  }));

  const mapResolved = resolvePharmacyMapEmbed(mapResolveInputFromProfile(profile, resolvedSlug));
  const imageDoc = loadImageAssignments(resolvedSlug);
  const assignmentPath = path.join(workspaceRoot(), "data/pharmacy-image-assignments", `${resolvedSlug}.json`);
  const ecosystemRoot = getEcosystemRoot(serviceId, resolvedSlug);
  const masterPublishPath = path.join(workspaceRoot(), "output/pharmacy-master-publish", resolvedSlug, serviceId, "index.html");
  const visualPath = path.join(workspaceRoot(), "output/pharmacy-visual-experience", resolvedSlug, serviceId, "index.html");

  const localClusterPaths: Record<string, string> = {};
  for (const area of selectedAreas) {
    localClusterPaths[area.areaSlug] = path.join(ecosystemRoot, "local", area.areaSlug, "index.html");
  }

  const tokens: Record<string, string> = {
    pharmacy: profile.pharmacyName,
    pharmacy_name: profile.pharmacyName,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    town: localArea,
    area: localArea,
    service: serviceMeta.serviceName,
    service_lower: serviceMeta.serviceName.toLowerCase(),
    booking_link: profile.bookingUrl || ownerVariables.booking_link,
    opening_hours: profile.openingHours || ownerVariables.opening_hours,
    reviewer: profile.reviewerName,
    address: profile.customerFacingAddress || profile.fullAddress,
  };

  const ctx: ContentGenerationContext = {
    contractVersion: CONTENT_ENGINE_CONTRACT_VERSION,
    builtAt: new Date().toISOString(),
    vertical: options.vertical || "pharmacy",
    slug,
    resolvedSlug,
    serviceId,
    serviceName: serviceMeta.serviceName,
    serviceMeta,
    profile,
    rawProfile: raw,
    brand: {
      primaryColor: profile.brandPrimaryColor,
      secondaryColor: profile.brandSecondaryColor,
      ctaColor: profile.brandCtaColor,
      accentColor: profile.brandAccentColor,
      backgroundColor: profile.brandBackgroundColor,
      textColor: profile.brandTextColor,
      mutedTextColor: profile.brandMutedTextColor,
      fontHeading: profile.fontHeading,
      fontBody: profile.fontBody,
      buttonRadius: profile.buttonRadius,
      cardRadius: profile.cardRadius,
      logoUrl: profile.logoUrl,
      headerLogoUrl: profile.headerLogoUrl,
      footerLogoUrl: profile.footerLogoUrl,
    },
    reviewer: {
      name: profile.reviewerName,
      role: profile.reviewerRole,
      qualifications: profile.reviewerQualifications,
      registrations: profile.reviewerProfessionalRegistrations,
      gphcNumber: profile.reviewerGphcNumber,
      experienceYears: profile.reviewerExperienceYears,
      bio: profile.reviewerBio,
      photoUrl: profile.reviewerPhotoUrl,
      clinicalReviewDate: profile.clinicalReviewDate,
      nextReviewDate: profile.nextReviewDate,
    },
    cta: {
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      bookingUrl: profile.bookingUrl,
      primaryCta: profile.primaryCta,
      headerCtaText: profile.headerCtaText,
      headerCtaUrl: profile.headerCtaUrl,
      openingHours: profile.openingHours,
    },
    map: {
      latitude: String(raw.latitude ?? ""),
      longitude: String(raw.longitude ?? ""),
      googleMapsEmbedUrl: profile.googleMapsEmbedUrl,
      fullAddress: profile.fullAddress,
      resolvedEmbedUrl: mapResolved.embedUrl || "",
    },
    selectedAreas,
    primaryTown,
    localArea,
    coverageAreas: profile.coverageAreas,
    masterLibrary: {
      relativePath: masterRelativePath,
      absolutePath: masterAbsolutePath,
      parsed,
      sections: parsed.sections,
      faqs,
      ownerVariables,
    },
    variantPack: loadServiceVariantPack(serviceId),
    links: {
      mainServicePath: serviceMeta.urlPath,
      mainServicePreviewUrl: `/api/pharmacy-visual-experience/${serviceId}/?slug=${resolvedSlug}`,
      visualExperiencePath: visualPath,
      visualExperiencePreviewUrl: `/api/pharmacy-visual-experience/${serviceId}/?slug=${resolvedSlug}`,
      ecosystemRoot,
      masterPublishPath,
      localClusterPaths,
      moneyLinks: [
        { label: profile.primaryCta, url: profile.bookingUrl || `tel:${profile.phone.replace(/\s/g, "")}` },
        { label: `Call ${profile.phone}`, url: `tel:${profile.phone.replace(/\s/g, "")}` },
      ],
    },
    images: {
      assignmentPath: fs.existsSync(assignmentPath) ? assignmentPath : null,
      assignmentsLoaded: Boolean(imageDoc?.assignments && Object.keys(imageDoc.assignments).length > 0),
      slots: ["hero", "support", "trust", "conversion"],
    },
    tokens,
    demoMode: profile.demoMode,
    businessProfileIntelligence: buildBusinessProfileIntelligenceFromProfile(
      resolvedSlug,
      raw,
      presentation.updatedAt || new Date().toISOString(),
      presentation.profileRevision || PROFILE_SCHEMA_VERSION,
    ),
    localMarket: enrichLocalMarketWithLocalityPacks(
      loadLocalMarketSnapshot(resolvedSlug),
      resolvedSlug,
      selectedAreas.map((a) => a.areaName),
      profile.fullAddress,
    ),
    areaDiscovery: loadAreaDiscoverySnapshot(resolvedSlug),
    localLocationHierarchy: localLocationHierarchy.ok ? localLocationHierarchy : null,
  };

  const validation = validateContentGenerationContext(ctx);
  if (!validation.ok) {
    throw new Error(`ContentGenerationContext validation failed: ${validation.errors.join("; ")}`);
  }

  return ctx;
}

export function buildContentGenerationContextForAreas(
  slug: string,
  serviceId: string,
  options?: ContentGenerationContextBuildOptions,
): ContentGenerationContext {
  return buildContentGenerationContext(slug, serviceId, options);
}
