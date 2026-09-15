/**
 * Customer Setup Import Split V1 — isolated Google + Website snapshots (Step 1/2 only).
 */
import fs from "node:fs";
import path from "node:path";
import {
  normalizeProfileData,
  PROFILE_SCHEMA_VERSION,
  type CustomerSetupAdminBaseline,
  type CustomerSetupFieldSource,
  type CustomerSetupGoogleCandidate,
  type GoogleImportSnapshot,
  type PharmacyProfileData,
  type SetupImportDebugRecord,
  type SetupImportSnapshotStatus,
  type WebsiteImportSnapshot,
} from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { buildWebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Service.ts";
import { applyWebsiteImportDesignPipeline } from "./pharmacyWebsiteImportDesignPipeline.ts";
import {
  buildCustomerVisibleWebsiteServices,
  type CustomerVisibleWebsiteService,
} from "./growthEngineWebsiteImportCustomerVisibleServices.ts";
import type { BrandProfile } from "../generator/brandImporter.ts";
import { extractBrandDnaFromWebsiteImport, validateBrandDnaColours } from "./pharmacyBrandDnaExtractor.ts";
import { invalidatePharmacyPresentationProfileCache } from "./pharmacyPresentationProfileResolver.ts";
import { extractWebsiteRegulatoryEvidence } from "./pharmacyWebsiteRegulatoryEvidence.ts";
import { fetchWebsiteHtml } from "./growthEngineWebsiteCrawler.ts";
import { freezeBrandDna } from "./pharmacyBrandDnaStore.ts";
import {
  detectNationalChainWebsite,
  extractPostcodeFromAddress,
  fetchEnrichedGoogleImportCandidate,
  isPlausibleGoogleImportCandidate,
  parseGooglePlaceIdFromUrl,
  searchGoogleListingCandidatesDetailed,
  shouldAutoConfirmGoogleMatch,
  shouldDirectImportFromGoogleUrl,
} from "./growthEngineCustomerSetupGoogleMatchService.ts";
import { isGoogleProfileInputUrl, resolveGoogleUrlEntityHints } from "./growthEngineGoogleProfileUrlResolver.ts";
import { buildSetupGoogleMatchHints } from "./growthEngineGoogleProfileImportDiagnostics.ts";
import { readGoogleIdentityRecord } from "./masterAdminCanonicalGoogleService.ts";
import {
  PHARMACY_DELIVERED_TEST_BASELINE,
  PHARMACY_DELIVERED_TEST_SLUG,
} from "./growthEngineCustomerSetupTestTenants.ts";

const PROFILE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles");
const BRAND_PROFILE_DIR = path.join(WORKSPACE_ROOT, "config", "projects");

export interface SetupGoogleImportInput {
  googleBusinessUrl?: string;
  pharmacyName?: string;
  town?: string;
  postcode?: string;
  placeId?: string;
}

export interface SetupWebsiteImportInput {
  websiteUrl: string;
}

export interface SetupImportResult {
  ok: boolean;
  slug: string;
  message: string;
  status: SetupImportSnapshotStatus;
}

export interface SetupDraftValues {
  pharmacyName: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  town: string;
  postcode: string;
  sources: Record<string, CustomerSetupFieldSource>;
}

export interface SetupResetResult {
  ok: boolean;
  slug: string;
  message: string;
}

function writeSnapshotOnly(
  slug: string,
  patch: Pick<
    PharmacyProfileData,
    "googleImportSnapshot" | "websiteImportSnapshot" | "lastGoogleImportDebug" | "lastWebsiteImportDebug"
  >,
): void {
  const existing = readSetupProfile(slug);
  writeSetupProfile(
    slug,
    normalizeProfileData({
      ...existing,
      ...patch,
      platformClientStatus: existing.platformClientStatus || "setup_required",
      country: existing.country || "United Kingdom",
    }),
  );
}

/** Merge imported Google Place ID into canonical profile — snapshot remains historical evidence. */
function canonicalGooglePlaceIdPatchFromImport(
  existing: PharmacyProfileData,
  snapshot: GoogleImportSnapshot,
): Partial<PharmacyProfileData> {
  const placeId = String(snapshot.placeId || "").trim();
  if (snapshot.status !== "imported" || !placeId) return {};

  const fieldSources: Record<string, CustomerSetupFieldSource> = {
    ...(existing.customerSetupFieldSources || {}),
    googlePlaceId: "google",
  };
  const googleImportedFieldKeys = [
    ...new Set([
      ...(existing.googleImportedFieldKeys || []),
      "googlePlaceId",
      "googleBusinessProfileUrl",
      "googleBusinessRating",
      "googleBusinessReviewCount",
    ]),
  ];

  return {
    googlePlaceId: placeId,
    googleBusinessProfileUrl: snapshot.googleMapsUrl || existing.googleBusinessProfileUrl,
    googleBusinessRating: snapshot.rating,
    googleBusinessReviewCount: snapshot.reviewCount,
    customerSetupFieldSources: fieldSources,
    googleImportedFieldKeys,
  };
}

function writeGoogleImportResult(slug: string, snapshot: GoogleImportSnapshot, debug: SetupImportDebugRecord): void {
  const existing = readSetupProfile(slug);
  writeSetupProfile(
    slug,
    normalizeProfileData({
      ...existing,
      ...canonicalGooglePlaceIdPatchFromImport(existing, snapshot),
      googleImportSnapshot: snapshot,
      lastGoogleImportDebug: debug,
      platformClientStatus: existing.platformClientStatus || "setup_required",
      country: existing.country || "United Kingdom",
    }),
  );
}

export function buildAdminBaseline(data: PharmacyProfileData): CustomerSetupAdminBaseline {
  return {
    pharmacyName: data.pharmacyName || data.tradingName || "",
    website: data.website || "",
    town: data.primaryTown || data.townCity || "",
    postcode: data.postcode || "",
    phone: data.phone || "",
    email: data.businessEmail || data.email || "",
    adminNotes: data.adminNotes || "",
    platformClientStatus: data.platformClientStatus || "setup_required",
    capturedAt: new Date().toISOString(),
  };
}

export function seedCustomerSetupAdminBaseline(
  slug: string,
  baseline: Partial<CustomerSetupAdminBaseline>,
): CustomerSetupAdminBaseline {
  const existing = readSetupProfile(slug);
  const merged = normalizeProfileData({
    ...existing,
    customerSetupAdminBaseline: {
      ...buildAdminBaseline(existing),
      ...baseline,
      capturedAt: baseline.capturedAt || new Date().toISOString(),
    },
  });
  writeSetupProfile(slug, merged);
  return merged.customerSetupAdminBaseline!;
}

export function resetSetupImports(slug: string): SetupResetResult {
  const existing = readSetupProfile(slug);
  const baseline = existing.customerSetupAdminBaseline;

  if (!baseline?.pharmacyName) {
    throw new Error("No admin baseline found. Re-create the client or contact support before resetting imports.");
  }

  const cleaned = normalizeProfileData({
    ...existing,
    pharmacyName: baseline.pharmacyName,
    tradingName: baseline.pharmacyName,
    website: baseline.website,
    primaryTown: baseline.town,
    primaryCity: baseline.town,
    townCity: baseline.town,
    postcode: baseline.postcode,
    phone: baseline.phone,
    businessEmail: baseline.email,
    email: baseline.email,
    adminNotes: baseline.adminNotes,
    platformClientStatus: baseline.platformClientStatus || existing.platformClientStatus || "setup_required",
    addressLine1: "",
    addressLine2: "",
    googlePlaceId: "",
    googleBusinessProfileUrl: "",
    googleMapsEmbedUrl: "",
    googleBusinessRating: null,
    googleBusinessReviewCount: 0,
    latitude: "",
    longitude: "",
    logoUrl: "",
    faviconUrl: "",
    headerLogoUrl: "",
    footerLogoUrl: "",
    brandPrimaryColor: "",
    brandSecondaryColor: "",
    brandAccentColor: "",
    brandBackgroundColor: "",
    brandTextColor: "",
    brandCtaColor: "",
    businessDescription: "",
    websiteAnalysisAt: "",
    websiteAnalysisSourceUrl: "",
    detectedWebsiteServices: [],
    footerLinks: [],
    socialFacebook: "",
    socialLinkedIn: "",
    socialX: "",
    socialInstagram: "",
    socialYoutube: "",
    headerCtaUrl: "",
    openingHours: "",
    openingHoursMonday: "",
    openingHoursTuesday: "",
    openingHoursWednesday: "",
    openingHoursThursday: "",
    openingHoursFriday: "",
    openingHoursSaturday: "",
    openingHoursSunday: "",
    websiteImportedFieldKeys: [],
    googleImportedFieldKeys: [],
    profileFieldConfirmations: {},
    customerSetupFieldSources: {},
    customerSetupGoogleMatchStatus: "none",
    customerSetupGoogleCandidates: [],
    customerSetupGoogleListing: null,
    customerSetupNationalWebsiteDetected: false,
    googleImportSnapshot: null,
    websiteImportSnapshot: null,
    lastGoogleImportDebug: null,
    lastWebsiteImportDebug: null,
    customerSetupAdminBaseline: baseline,
  });

  writeSetupProfile(slug, cleaned);
  clearBrandProfile(slug);
  return { ok: true, slug, message: "Imported data cleared. Admin-entered details preserved." };
}

export function readAdminBaselineFields(data: PharmacyProfileData): SetupDraftValues {
  const baseline = data.customerSetupAdminBaseline;
  if (!baseline) {
    return { pharmacyName: "", website: "", phone: "", email: "", address: "", town: "", postcode: "", sources: {} };
  }
  return {
    pharmacyName: baseline.pharmacyName,
    website: baseline.website,
    phone: baseline.phone,
    email: baseline.email,
    address: "",
    town: baseline.town,
    postcode: baseline.postcode,
    sources: {
      pharmacyName: "manual",
      website: "manual",
      phone: baseline.phone ? "manual" : "",
      email: baseline.email ? "manual" : "",
      town: "manual",
      postcode: "manual",
    },
  };
}

function profileFile(slug: string): string {
  return path.join(PROFILE_DIR, `${slug}.json`);
}

/** Workspace-relative path for debug metadata — avoids false tenant-isolation hits on server home dirs. */
function profilePathForDebug(slug: string): string {
  return path.posix.join("data", "pharmacy-profiles", `${slug}.json`);
}

export function readSetupProfile(slug: string): PharmacyProfileData {
  const file = profileFile(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

export function writeSetupProfile(
  slug: string,
  data: PharmacyProfileData,
  options?: { bumpPresentationRevision?: boolean },
): void {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const file = profileFile(slug);
  const existing = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf8")) as {
        presentationRevision?: number;
        presentationRenderedAt?: string;
      })
    : null;
  const now = new Date().toISOString();
  const nextRevision =
    options?.bumpPresentationRevision === false
      ? Number(existing?.presentationRevision || 0)
      : Number(existing?.presentationRevision || 0) + 1;
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        slug,
        updatedAt: now,
        version: PROFILE_SCHEMA_VERSION,
        presentationRevision: nextRevision,
        presentationRenderedAt: existing?.presentationRenderedAt || "",
        data: normalizeProfileData(data),
      },
      null,
      2,
    ),
  );
  invalidatePharmacyPresentationProfileCache(slug);
}

/** Recompute customerVisibleServices from stored intelligence (no full re-import). */
export async function backfillCustomerVisibleServicesForSlug(slug: string): Promise<CustomerVisibleWebsiteService[]> {
  const existing = readSetupProfile(slug);
  const snap = existing.websiteImportSnapshot;
  const intel = snap?.intelligence;
  if (!snap || !intel) return [];

  const customerVisibleServices = await buildCustomerVisibleWebsiteServices({
    serviceRows: intel.services,
    pages: intel.structure.pages,
    homepageUrl: intel.identity.resolvedUrl || snap.websiteUrl,
  });

  writeSetupProfile(slug, {
    ...existing,
    websiteImportSnapshot: {
      ...snap,
      customerVisibleServices,
    },
  });

  return customerVisibleServices;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeWebsite(url: string): string {
  const trimmed = str(url);
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function emptyGoogleSnapshot(): GoogleImportSnapshot {
  return {
    status: "not_found",
    importedAt: "",
    message: "No Google Business Profile found. You can continue with website import only.",
    googleBusinessUrl: "",
    searchPharmacyName: "",
    searchTown: "",
    searchPostcode: "",
    placeId: "",
    businessName: "",
    address: "",
    town: "",
    postcode: "",
    phone: "",
    website: "",
    rating: null,
    reviewCount: 0,
    photoCount: 0,
    categories: [],
    openingHours: [],
    googleMapsUrl: "",
    latitude: null,
    longitude: null,
    candidates: [],
    nationalWebsiteDetected: false,
  };
}

function emptyWebsiteSnapshot(): WebsiteImportSnapshot {
  return {
    status: "not_found",
    importedAt: "",
    message: "Website import incomplete. You can continue with Google Profile only.",
    websiteUrl: "",
    logoUrl: "",
    brandPrimaryColor: "",
    brandSecondaryColor: "",
    brandAccentColor: "",
    brandBackgroundColor: "",
    brandTextColor: "",
    phone: "",
    email: "",
    address: "",
    town: "",
    postcode: "",
    socialLinks: [],
    footerLinks: [],
    servicesDetected: [],
    customerVisibleServices: [],
    description: "",
    openingHours: "",
    intelligence: null,
  };
}

function candidateToSnapshotFields(
  candidate: CustomerSetupGoogleCandidate,
  search: { googleBusinessUrl: string; pharmacyName: string; town: string; postcode: string },
  extras?: { openingHours?: string[]; latitude?: number | null; longitude?: number | null },
): GoogleImportSnapshot {
  return {
    status: "imported",
    importedAt: new Date().toISOString(),
    message: "",
    googleBusinessUrl: search.googleBusinessUrl,
    searchPharmacyName: search.pharmacyName,
    searchTown: search.town,
    searchPostcode: search.postcode,
    placeId: candidate.placeId,
    businessName: candidate.businessName,
    address: candidate.address,
    town: search.town,
    postcode: candidate.postcode || search.postcode,
    phone: candidate.phone,
    website: candidate.website,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    photoCount: candidate.photoCount,
    categories: candidate.primaryCategory ? [candidate.primaryCategory] : [],
    openingHours: extras?.openingHours || [],
    googleMapsUrl: candidate.googleMapsUrl,
    latitude: extras?.latitude ?? null,
    longitude: extras?.longitude ?? null,
    candidates: [],
    nationalWebsiteDetected: false,
  };
}

function saveBrandProfile(slug: string, brand: BrandProfile): void {
  const dir = path.join(BRAND_PROFILE_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "brand-profile.json"), JSON.stringify({ ...brand, approved: true }, null, 2));
  const extracted = extractBrandDnaFromWebsiteImport(slug);
  if (extracted) {
    freezeBrandDna(slug, validateBrandDnaColours({ ...extracted, frozenAt: new Date().toISOString() }));
  }
}

function clearBrandProfile(slug: string): void {
  const file = path.join(BRAND_PROFILE_DIR, slug, "brand-profile.json");
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

export async function runSetupGoogleImport(slug: string, input: SetupGoogleImportInput): Promise<SetupImportResult> {
  const googleBusinessUrl = str(input.googleBusinessUrl);
  const pharmacyName = str(input.pharmacyName);
  const town = str(input.town);
  const postcode = str(input.postcode).toUpperCase();

  const existing = readSetupProfile(slug);
  const baseline = existing.customerSetupAdminBaseline;
  const effectiveName = pharmacyName || baseline?.pharmacyName || "";
  const effectiveTown = town || baseline?.town || "";
  const effectivePostcode = postcode || baseline?.postcode || "";

  if (!googleBusinessUrl && !(effectiveName && effectiveTown && effectivePostcode)) {
    throw new Error("Add a Google Maps link, or enter pharmacy name, town and postcode.");
  }

  let resolvedGoogleBusinessUrl = googleBusinessUrl;
  let placeIdFromUrl = parseGooglePlaceIdFromUrl(googleBusinessUrl);
  let kgMid = "";
  let searchQueryFromUrl = "";
  if (googleBusinessUrl) {
    const entity = await resolveGoogleUrlEntityHints(googleBusinessUrl);
    resolvedGoogleBusinessUrl = entity.finalUrl;
    placeIdFromUrl = entity.placeId || placeIdFromUrl;
    kgMid = entity.kgMid;
    searchQueryFromUrl = entity.searchQueryFromUrl;
  }

  const hints = buildSetupGoogleMatchHints(
    slug,
    { pharmacyName, town, postcode },
    {
      finalUrl: resolvedGoogleBusinessUrl,
      placeId: placeIdFromUrl,
      kgMid,
      searchQueryFromUrl,
    },
  );

  const search = await searchGoogleListingCandidatesDetailed(hints);
  const candidates = search.candidates;

  const identity = readGoogleIdentityRecord(slug);
  const confirmedPlaceId = str(input.placeId) || str(identity?.placeId) || str(existing.googlePlaceId);

  const websiteSnapshot = existing.websiteImportSnapshot;
  const nationalWebsiteDetected = websiteSnapshot?.websiteUrl
    ? detectNationalChainWebsite(websiteSnapshot.websiteUrl)
    : false;

  const searchMeta = {
    googleBusinessUrl: resolvedGoogleBusinessUrl,
    pharmacyName: hints.pharmacyName,
    town: hints.town,
    postcode: hints.postcode,
  };

  const explicitPlaceId = Boolean(placeIdFromUrl || parseGooglePlaceIdFromUrl(resolvedGoogleBusinessUrl));
  const userSuppliedGoogleUrl = isGoogleProfileInputUrl(googleBusinessUrl);

  let selectedCandidate: CustomerSetupGoogleCandidate | null = null;
  let directUrlImport = false;

  if (candidates.length) {
    if (confirmedPlaceId) {
      selectedCandidate =
        candidates.find((c) => c.placeId === confirmedPlaceId) ||
        (identity?.preview?.placeId === confirmedPlaceId && identity.preview
          ? ({
              placeId: confirmedPlaceId,
              businessName: identity.preview.businessName,
              address: identity.preview.address,
              postcode: identity.preview.postcode,
              phone: identity.preview.phone,
              website: identity.preview.website,
              rating: identity.preview.rating,
              reviewCount: identity.preview.reviewCount,
              photoCount: 0,
              primaryCategory: identity.preview.primaryCategory,
              googleMapsUrl: identity.preview.googleMapsUrl,
              confidence: identity.preview.confidence,
              distanceKm: null,
              distanceLabel: "",
            } satisfies CustomerSetupGoogleCandidate)
          : null);
      if (selectedCandidate) directUrlImport = true;
    }
    if (!selectedCandidate && userSuppliedGoogleUrl && shouldDirectImportFromGoogleUrl(candidates, hints, nationalWebsiteDetected)) {
      const plausible = candidates.filter((c) => isPlausibleGoogleImportCandidate(c, hints));
      selectedCandidate = plausible[0] || candidates[0];
      directUrlImport = true;
    } else if (shouldAutoConfirmGoogleMatch(candidates, nationalWebsiteDetected, explicitPlaceId)) {
      selectedCandidate = candidates[0];
    }
  }

  let snapshot: GoogleImportSnapshot;

  if (!candidates.length) {
    snapshot = {
      ...emptyGoogleSnapshot(),
      importedAt: new Date().toISOString(),
      googleBusinessUrl: resolvedGoogleBusinessUrl,
      searchPharmacyName: hints.pharmacyName,
      searchTown: hints.town,
      searchPostcode: hints.postcode,
      nationalWebsiteDetected,
    };
  } else if (selectedCandidate) {
    const enriched = await fetchEnrichedGoogleImportCandidate(selectedCandidate, hints);
    snapshot = {
      ...candidateToSnapshotFields(enriched.candidate, searchMeta, {
        openingHours: enriched.openingHours,
        latitude: enriched.latitude,
        longitude: enriched.longitude,
      }),
      message: directUrlImport ? "Google Profile imported." : "",
      nationalWebsiteDetected,
    };
  } else {
    snapshot = {
      ...emptyGoogleSnapshot(),
      status: "needs_review",
      importedAt: new Date().toISOString(),
      message: "Possible Google listings found — please select the correct one on the review page.",
      googleBusinessUrl: resolvedGoogleBusinessUrl,
      searchPharmacyName: hints.pharmacyName,
      searchTown: hints.town,
      searchPostcode: hints.postcode,
      candidates,
      nationalWebsiteDetected,
    };
  }

  const profilePath = profilePathForDebug(slug);
  const debug: SetupImportDebugRecord = {
    at: new Date().toISOString(),
    receivedUrl: googleBusinessUrl,
    resolvedUrl: resolvedGoogleBusinessUrl,
    kgMid,
    qParameter: searchQueryFromUrl,
    candidateCount: candidates.length,
    selectedPlaceId: selectedCandidate?.placeId || candidates[0]?.placeId || "",
    possibleMatch: candidates.length > 0 && !selectedCandidate && !directUrlImport,
    snapshotStatus: snapshot.status,
    snapshotWritten: true,
    profilePath,
    message: snapshot.message || "",
  };

  console.log(`[setup-google-import] slug=${slug} ${JSON.stringify(debug)}`);

  writeGoogleImportResult(slug, snapshot, debug);

  return {
    ok: true,
    slug,
    message:
      snapshot.message ||
      (snapshot.status === "imported"
        ? directUrlImport
          ? "Google Profile imported."
          : "Google Profile imported."
        : "Google import finished."),
    status: snapshot.status,
  };
}

export async function runSetupWebsiteImport(slug: string, input: SetupWebsiteImportInput): Promise<SetupImportResult> {
  const websiteUrl = normalizeWebsite(input.websiteUrl);
  if (!websiteUrl) throw new Error("Website URL is required");

  const existing = readSetupProfile(slug);
  let snapshot: WebsiteImportSnapshot;

  try {
    const baseline = existing.customerSetupAdminBaseline;
    const v2 = await buildWebsiteIntelligenceImportV2(websiteUrl, baseline, { slug });
    saveBrandProfile(slug, { ...v2.brand, approved: true });

    snapshot = {
      status: v2.hasData ? "imported" : "needs_review",
      importedAt: new Date().toISOString(),
      message: v2.hasData ? "Website Intelligence imported." : "Website import incomplete. You can continue with Google Profile only.",
      websiteUrl,
      logoUrl: v2.legacy.logoUrl,
      brandPrimaryColor: v2.legacy.brandPrimaryColor,
      brandSecondaryColor: v2.legacy.brandSecondaryColor,
      brandAccentColor: v2.legacy.brandAccentColor,
      brandBackgroundColor: v2.legacy.brandBackgroundColor,
      brandTextColor: v2.legacy.brandTextColor,
      phone: v2.legacy.phone,
      email: v2.legacy.email,
      address: v2.legacy.address,
      town: v2.legacy.town,
      postcode: v2.legacy.postcode,
      socialLinks: v2.legacy.socialLinks,
      footerLinks: v2.legacy.footerLinks,
      servicesDetected: v2.legacy.servicesDetected,
      customerVisibleServices: v2.legacy.customerVisibleServices,
      description: v2.legacy.description,
      openingHours: v2.legacy.openingHours,
      intelligence: v2.intelligence,
    };
    try {
      const homepageHtml = await fetchWebsiteHtml(websiteUrl);
      snapshot.regulatoryEvidence = extractWebsiteRegulatoryEvidence(
        homepageHtml,
        websiteUrl,
        snapshot.importedAt,
      );

      const { applyBranchDetectionToImport } = await import("./masterAdminWebsiteBranchSelectionService.ts");
      const branchResult = applyBranchDetectionToImport(slug, snapshot, homepageHtml);
      snapshot = branchResult.snapshot;
      writeSetupProfile(slug, {
        ...readSetupProfile(slug),
        websiteBranchResolution: branchResult.resolution,
      });
    } catch {
      snapshot.regulatoryEvidence = [];
    }

    writeSnapshotOnly(slug, {
      websiteImportSnapshot: snapshot,
      lastWebsiteImportDebug: {
        at: new Date().toISOString(),
        receivedUrl: websiteUrl,
        resolvedUrl: websiteUrl,
        kgMid: "",
        qParameter: "",
        candidateCount: 0,
        selectedPlaceId: "",
        possibleMatch: false,
        snapshotStatus: snapshot.status,
        snapshotWritten: true,
        profilePath: profilePathForDebug(slug),
        message: snapshot.message || "",
      },
    });

    await applyWebsiteImportDesignPipeline(slug, snapshot.intelligence);
  } catch (err) {
    snapshot = {
      ...emptyWebsiteSnapshot(),
      importedAt: new Date().toISOString(),
      websiteUrl,
      message: `Website import incomplete. ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  writeSnapshotOnly(slug, {
    websiteImportSnapshot: snapshot,
    lastWebsiteImportDebug: {
      at: new Date().toISOString(),
      receivedUrl: websiteUrl,
      resolvedUrl: websiteUrl,
      kgMid: "",
      qParameter: "",
      candidateCount: 0,
      selectedPlaceId: "",
      possibleMatch: false,
      snapshotStatus: snapshot.status,
      snapshotWritten: true,
      profilePath: profilePathForDebug(slug),
      message: snapshot.message || "",
    },
  });

  console.log(
    `[setup-website-import] slug=${slug} url=${websiteUrl} status=${snapshot.status} written=${profileFile(slug)}`,
  );

  return {
    ok: true,
    slug,
    message: snapshot.message || (snapshot.status === "imported" ? "Website imported." : "Website import finished."),
    status: snapshot.status,
  };
}

export function selectGoogleImportCandidate(slug: string, placeId: string): SetupImportResult {
  const existing = readSetupProfile(slug);
  const snap = existing.googleImportSnapshot;
  if (!snap) throw new Error("No Google import to update.");

  const candidate = (snap.candidates || []).find((c) => c.placeId === placeId);
  if (!candidate) throw new Error("Listing not found.");

  const updated = candidateToSnapshotFields(candidate, {
    googleBusinessUrl: snap.googleBusinessUrl,
    pharmacyName: snap.searchPharmacyName,
    town: snap.searchTown,
    postcode: snap.searchPostcode,
  });

  const selectedSnapshot = { ...updated, nationalWebsiteDetected: snap.nationalWebsiteDetected };
  writeGoogleImportResult(slug, selectedSnapshot, {
    at: new Date().toISOString(),
    receivedUrl: snap.googleBusinessUrl,
    resolvedUrl: snap.googleBusinessUrl,
    kgMid: "",
    qParameter: "",
    candidateCount: snap.candidates?.length || 0,
    selectedPlaceId: placeId,
    possibleMatch: false,
    snapshotStatus: "imported",
    snapshotWritten: true,
    profilePath: profilePathForDebug(slug),
    message: "Google listing selected.",
  });

  return { ok: true, slug, message: "Google listing selected.", status: "imported" };
}

export function buildGoogleDraftValues(data: PharmacyProfileData): SetupDraftValues {
  const snap = data.googleImportSnapshot;
  const sources: Record<string, CustomerSetupFieldSource> = {};
  if (!snap?.importedAt || snap.status !== "imported") {
    return { pharmacyName: "", website: "", phone: "", email: "", address: "", town: "", postcode: "", sources };
  }

  const assign = (key: string, value: string) => {
    if (value) sources[key] = "google";
  };

  assign("pharmacyName", snap.businessName);
  assign("website", snap.website);
  assign("phone", snap.phone);
  assign("address", snap.address);
  assign("town", snap.town || snap.searchTown);
  assign("postcode", snap.postcode || snap.searchPostcode);

  return {
    pharmacyName: snap.businessName,
    website: snap.website,
    phone: snap.phone,
    email: "",
    address: snap.address,
    town: snap.town || snap.searchTown,
    postcode: snap.postcode || snap.searchPostcode,
    sources,
  };
}

export function buildWebsiteDraftValues(data: PharmacyProfileData): SetupDraftValues {
  const snap = data.websiteImportSnapshot;
  const sources: Record<string, CustomerSetupFieldSource> = {};
  if (!snap?.importedAt || snap.status === "not_found") {
    return { pharmacyName: "", website: "", phone: "", email: "", address: "", town: "", postcode: "", sources };
  }

  const businessName = snap.intelligence?.business.businessName.selected || "";
  const assign = (key: string, value: string) => {
    if (value) sources[key] = "website";
  };

  assign("pharmacyName", businessName);
  assign("website", snap.websiteUrl);
  assign("phone", snap.phone);
  assign("email", snap.email);
  assign("address", snap.address);
  assign("town", snap.town);
  assign("postcode", snap.postcode);

  return {
    pharmacyName: businessName,
    website: snap.websiteUrl,
    phone: snap.phone,
    email: snap.email,
    address: snap.address,
    town: snap.town,
    postcode: snap.postcode,
    sources,
  };
}

export function customerSetupConfirmUrl(slug: string): string {
  return `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(slug)}`;
}

export function customerSetupStartUrl(slug: string): string {
  return `/api/growth-engine/start?slug=${encodeURIComponent(slug)}`;
}

export function loadCustomerSetupStartDefaults(slug: string): {
  googleBusinessUrl: string;
  pharmacyName: string;
  town: string;
  postcode: string;
  websiteUrl: string;
  googleImportStatus: string;
  websiteImportStatus: string;
} {
  const data = readSetupProfile(slug);
  const g = data.googleImportSnapshot;
  const w = data.websiteImportSnapshot;
  const baseline = data.customerSetupAdminBaseline;
  return {
    googleBusinessUrl: g?.googleBusinessUrl || "",
    pharmacyName: g?.searchPharmacyName || baseline?.pharmacyName || "",
    town: g?.searchTown || baseline?.town || "",
    postcode: g?.searchPostcode || baseline?.postcode || "",
    websiteUrl: w?.websiteUrl || baseline?.website || "",
    googleImportStatus: g?.importedAt ? g.status : "not_found",
    websiteImportStatus: w?.importedAt ? w.status : "not_found",
  };
}

export function provisionPharmacyDelivered4uTestTenant(): { slug: string; profilePath: string } {
  const slug = PHARMACY_DELIVERED_TEST_SLUG;
  const capturedAt = new Date().toISOString();
  const baseline: CustomerSetupAdminBaseline = {
    pharmacyName: PHARMACY_DELIVERED_TEST_BASELINE.pharmacyName,
    website: PHARMACY_DELIVERED_TEST_BASELINE.website,
    town: PHARMACY_DELIVERED_TEST_BASELINE.town,
    postcode: PHARMACY_DELIVERED_TEST_BASELINE.postcode,
    phone: "",
    email: "",
    adminNotes: "",
    platformClientStatus: "setup_required",
    capturedAt,
  };

  const data = normalizeProfileData({
    pharmacyName: baseline.pharmacyName,
    tradingName: baseline.pharmacyName,
    website: baseline.website,
    primaryTown: baseline.town,
    primaryCity: baseline.town,
    townCity: baseline.town,
    postcode: baseline.postcode,
    phone: "",
    businessEmail: "",
    email: "",
    businessDescription: "",
    platformClientStatus: "setup_required",
    country: "United Kingdom",
    customerSetupAdminBaseline: baseline,
    googleImportSnapshot: null,
    websiteImportSnapshot: null,
    lastGoogleImportDebug: null,
    lastWebsiteImportDebug: null,
    websiteImportedFieldKeys: [],
    googleImportedFieldKeys: [],
    profileFieldConfirmations: {},
    customerSetupFieldSources: {},
    customerSetupGoogleMatchStatus: "none",
    customerSetupGoogleCandidates: [],
    customerSetupGoogleListing: null,
    customerSetupNationalWebsiteDetected: false,
    googlePlaceId: "",
    googleBusinessProfileUrl: "",
    logoUrl: "",
    websiteAnalysisAt: "",
    websiteAnalysisSourceUrl: "",
    detectedWebsiteServices: [],
    footerLinks: [],
    headerNavLinks: [],
  });

  writeSetupProfile(slug, data);
  clearBrandProfile(slug);
  return { slug, profilePath: profileFile(slug) };
}

/** @deprecated Combined import removed — use runSetupGoogleImport / runSetupWebsiteImport. */
export async function runCustomerSetupStart(
  slug: string,
  input: { pharmacyName?: string; website?: string; town?: string; postcode?: string; googleBusinessUrl?: string; phone?: string },
): Promise<{ ok: boolean; slug: string; redirectUrl: string }> {
  if (input.website) await runSetupWebsiteImport(slug, { websiteUrl: input.website });
  if (input.googleBusinessUrl || (input.pharmacyName && input.town && input.postcode)) {
    await runSetupGoogleImport(slug, {
      googleBusinessUrl: input.googleBusinessUrl,
      pharmacyName: input.pharmacyName,
      town: input.town,
      postcode: input.postcode,
    });
  }
  return { ok: true, slug, redirectUrl: customerSetupConfirmUrl(slug) };
}

export { extractPostcodeFromAddress };
