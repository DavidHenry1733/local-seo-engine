/**
 * Master Admin Canonical Google Business Profile V1 — identity confirmation before import.
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  createMasterAdminJob,
  runMasterAdminJobAsync,
} from "./masterAdminJobService.ts";
import { buildCustomerCanonicalStatuses } from "./masterAdminCanonicalStatusService.ts";
import { resolveGoogleUrlEntityHints, isGoogleProfileInputUrl } from "./growthEngineGoogleProfileUrlResolver.ts";
import { buildSetupGoogleMatchHints } from "./growthEngineGoogleProfileImportDiagnostics.ts";
import {
  fetchEnrichedGoogleImportCandidate,
  isPlausibleGoogleImportCandidate,
  parseGooglePlaceIdFromUrl,
  searchGoogleListingCandidatesDetailed,
  type CustomerSetupGoogleCandidate,
} from "./growthEngineCustomerSetupGoogleMatchService.ts";
import type { GoogleImportSnapshot } from "./pharmacyProfileSchema.ts";

const GOOGLE_IDENTITY_DIR = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "google-identity");
const GOOGLE_INTELLIGENCE_DIR = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "google-intelligence");
const GOOGLE_IMPORT_HISTORY_DIR = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "google-import-history");

export type GoogleConfirmationStatus = "none" | "pending" | "confirmed" | "rejected";

export interface GoogleUrlResolution {
  originalUrl: string;
  resolvedUrl: string;
  placeId: string;
  businessName: string;
  address: string;
  town: string;
  postcode: string;
  phone: string;
  website: string;
  coordinates: { latitude: number | null; longitude: number | null };
}

export interface GoogleConfirmationPreview {
  businessName: string;
  address: string;
  town: string;
  postcode: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number;
  primaryCategory: string;
  googleMapsUrl: string;
  thumbnailUrl: string | null;
  placeId: string;
  confidence: number;
}

export interface GoogleIdentityRecord {
  slug: string;
  updatedAt: string;
  originalUrl: string;
  resolvedUrl: string;
  placeId: string;
  confirmationStatus: GoogleConfirmationStatus;
  verificationStatus: "unverified" | "confirmed" | "imported";
  confirmedAt: string | null;
  confirmedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  urlResolution: GoogleUrlResolution | null;
  preview: GoogleConfirmationPreview | null;
  candidateCount: number;
  confidence: number | null;
}

export interface GoogleIntelligenceRecord {
  slug: string;
  importedAt: string;
  placeId: string;
  businessName: string;
  address: string;
  town: string;
  postcode: string;
  telephone: string;
  website: string;
  openingHours: string[];
  categories: string[];
  attributes: string[];
  photos: Array<{ count: number; thumbnailUrl: string | null }>;
  reviews: { rating: number | null; reviewCount: number };
  rating: number | null;
  reviewCount: number;
  questions: string[];
  services: string[];
  coordinates: { latitude: number | null; longitude: number | null };
  mapsUrl: string;
  appointmentUrl: string | null;
  googleBusinessProfileUrl: string;
  confidence: number | null;
  sourceSnapshotStatus: string;
}

export interface GoogleImportHistoryEntry {
  archivedAt: string;
  reason: string;
  placeId: string;
  snapshot: Record<string, unknown>;
}

export interface GoogleSourceSummary {
  businessName: string;
  googleBusinessProfileUrl: string;
  placeId: string;
  verificationStatus: string;
  googleMapsLink: string;
  primaryCategory: string;
  rating: number | null;
  reviewCount: number;
  lastGoogleImport: string | null;
  importStatus: string;
  confidence: number | null;
  confirmationStatus: GoogleConfirmationStatus;
  confirmationRequired: boolean;
  canEditGoogle: boolean;
  editBlockedReason: string | null;
  googleImported: boolean;
  importedEvidence: Record<string, unknown> | null;
  googleIntelligence: GoogleIntelligenceRecord | null;
  confirmationPreview: GoogleConfirmationPreview | null;
  importHistoryCount: number;
  urlResolution: GoogleUrlResolution | null;
}

export interface GoogleImportGateResult {
  canProceed: boolean;
  confirmationRequired: boolean;
  reason: string | null;
  preview: GoogleConfirmationPreview | null;
}

function identityFile(slug: string): string {
  return path.join(GOOGLE_IDENTITY_DIR, `${safeAdminSlug(slug)}.json`);
}

function intelligenceFile(slug: string): string {
  return path.join(GOOGLE_INTELLIGENCE_DIR, `${safeAdminSlug(slug)}.json`);
}

function historyFile(slug: string): string {
  return path.join(GOOGLE_IMPORT_HISTORY_DIR, `${safeAdminSlug(slug)}.json`);
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeInputUrl(url: string): string {
  const trimmed = str(url);
  if (!trimmed) return "";
  if (/^ChI[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

export function readGoogleIdentityRecord(slug: string): GoogleIdentityRecord | null {
  const file = identityFile(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as GoogleIdentityRecord;
  } catch {
    return null;
  }
}

function writeGoogleIdentityRecord(slug: string, record: GoogleIdentityRecord): GoogleIdentityRecord {
  fs.mkdirSync(GOOGLE_IDENTITY_DIR, { recursive: true });
  const next = { ...record, slug: safeAdminSlug(slug), updatedAt: new Date().toISOString() };
  fs.writeFileSync(identityFile(slug), JSON.stringify(next, null, 2));
  return next;
}

export function readGoogleIntelligenceRecord(slug: string): GoogleIntelligenceRecord | null {
  const file = intelligenceFile(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as GoogleIntelligenceRecord;
  } catch {
    return null;
  }
}

function writeGoogleIntelligenceRecord(slug: string, record: GoogleIntelligenceRecord): GoogleIntelligenceRecord {
  fs.mkdirSync(GOOGLE_INTELLIGENCE_DIR, { recursive: true });
  fs.writeFileSync(intelligenceFile(slug), JSON.stringify(record, null, 2));
  return record;
}

function readImportHistory(slug: string): GoogleImportHistoryEntry[] {
  const file = historyFile(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { entries?: GoogleImportHistoryEntry[] };
    return Array.isArray(doc.entries) ? doc.entries : [];
  } catch {
    return [];
  }
}

function writeImportHistory(slug: string, entries: GoogleImportHistoryEntry[]): void {
  fs.mkdirSync(GOOGLE_IMPORT_HISTORY_DIR, { recursive: true });
  fs.writeFileSync(
    historyFile(slug),
    JSON.stringify({ slug: safeAdminSlug(slug), updatedAt: new Date().toISOString(), entries: entries.slice(0, 20) }, null, 2),
  );
}

export function canEditGoogleBusinessProfile(slug: string): { allowed: boolean; reason: string | null } {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return { allowed: false, reason: "Customer not found" };
  if (ctx.archived) return { allowed: false, reason: "Customer is archived" };
  if (ctx.suspended) return { allowed: false, reason: "Customer is suspended" };
  if (ctx.profileApproved) return { allowed: false, reason: "Business Profile already approved — Google identity locked" };
  return { allowed: true, reason: null };
}

function candidateToPreview(candidate: CustomerSetupGoogleCandidate): GoogleConfirmationPreview {
  return {
    businessName: candidate.businessName,
    address: candidate.address,
    town: "",
    postcode: candidate.postcode,
    phone: candidate.phone,
    website: candidate.website,
    rating: candidate.rating,
    reviewCount: candidate.reviewCount,
    primaryCategory: candidate.primaryCategory,
    googleMapsUrl: candidate.googleMapsUrl,
    thumbnailUrl: null,
    placeId: candidate.placeId,
    confidence: candidate.confidence,
  };
}

function candidateToUrlResolution(
  originalUrl: string,
  resolvedUrl: string,
  candidate: CustomerSetupGoogleCandidate,
  extras?: { latitude?: number | null; longitude?: number | null },
): GoogleUrlResolution {
  return {
    originalUrl,
    resolvedUrl,
    placeId: candidate.placeId,
    businessName: candidate.businessName,
    address: candidate.address,
    town: "",
    postcode: candidate.postcode,
    phone: candidate.phone,
    website: candidate.website,
    coordinates: {
      latitude: extras?.latitude ?? null,
      longitude: extras?.longitude ?? null,
    },
  };
}

async function resolveGoogleCandidateFromUrl(
  slug: string,
  inputUrl: string,
): Promise<{
  originalUrl: string;
  resolvedUrl: string;
  candidate: CustomerSetupGoogleCandidate;
  preview: GoogleConfirmationPreview;
  urlResolution: GoogleUrlResolution;
  candidateCount: number;
  confidence: number;
  candidates: CustomerSetupGoogleCandidate[];
}> {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const originalUrl = normalizeInputUrl(inputUrl);
  if (!originalUrl) throw new Error("Google Business Profile URL is required");

  const isDirectPlaceId = /^ChI[a-zA-Z0-9_-]+$/.test(originalUrl);
  const googleBusinessUrl = isDirectPlaceId
    ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(originalUrl)}`
    : originalUrl;

  if (!isDirectPlaceId && !isGoogleProfileInputUrl(googleBusinessUrl)) {
    throw new Error("Enter a valid Google Maps, Google Business Profile, or Place ID link.");
  }

  const entity = isDirectPlaceId
    ? {
        inputUrl: originalUrl,
        finalUrl: googleBusinessUrl,
        redirected: false,
        placeId: originalUrl,
        kgMid: "",
        searchQueryFromUrl: "",
        entityHintUsed: true,
      }
    : await resolveGoogleUrlEntityHints(googleBusinessUrl);

  const hints = buildSetupGoogleMatchHints(
    safe,
    {
      pharmacyName: data.pharmacyName || "",
      town: data.primaryTown || data.townCity || "",
      postcode: data.postcode || "",
    },
    {
      finalUrl: entity.finalUrl,
      placeId: entity.placeId || parseGooglePlaceIdFromUrl(entity.finalUrl),
      kgMid: entity.kgMid,
      searchQueryFromUrl: entity.searchQueryFromUrl,
    },
  );

  const search = await searchGoogleListingCandidatesDetailed(hints);
  const explicitPlaceId = str(entity.placeId || parseGooglePlaceIdFromUrl(entity.finalUrl));

  let selected: CustomerSetupGoogleCandidate | null = null;
  if (explicitPlaceId) {
    selected =
      search.candidates.find((c) => c.placeId === explicitPlaceId) ||
      ({
        placeId: explicitPlaceId,
        businessName: hints.pharmacyName || "Google listing",
        address: "",
        postcode: hints.postcode,
        phone: "",
        website: "",
        rating: null,
        reviewCount: 0,
        photoCount: 0,
        primaryCategory: "Pharmacy",
        googleMapsUrl: entity.finalUrl,
        confidence: 80,
        distanceKm: null,
        distanceLabel: "",
      } satisfies CustomerSetupGoogleCandidate);
  } else if (search.candidates.length) {
    const plausible = search.candidates.filter((c) => isPlausibleGoogleImportCandidate(c, hints));
    selected = plausible[0] || search.candidates[0];
  }

  if (!selected) {
    throw new Error("No Google Business Profile found for this URL. Try Search Again with a different link.");
  }

  const enriched = await fetchEnrichedGoogleImportCandidate(selected, hints);
  const candidate = enriched.candidate;
  const preview = candidateToPreview(candidate);
  const urlResolution = candidateToUrlResolution(originalUrl, entity.finalUrl, candidate, {
    latitude: enriched.latitude,
    longitude: enriched.longitude,
  });

  return {
    originalUrl,
    resolvedUrl: entity.finalUrl,
    candidate,
    preview,
    urlResolution,
    candidateCount: search.candidates.length,
    confidence: candidate.confidence,
    candidates: search.candidates,
  };
}

export function archiveGoogleImportSnapshot(slug: string, reason: string): GoogleImportHistoryEntry | null {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const snap = data.googleImportSnapshot as Record<string, unknown> | null | undefined;
  if (!snap) return null;

  const entry: GoogleImportHistoryEntry = {
    archivedAt: new Date().toISOString(),
    reason,
    placeId: str(snap.placeId || data.googlePlaceId),
    snapshot: snap,
  };
  const history = readImportHistory(safe);
  history.unshift(entry);
  writeImportHistory(safe, history);
  return entry;
}

export function invalidateGoogleImportEvidence(slug: string, reason: string): void {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  archiveGoogleImportSnapshot(safe, reason);
  writeSetupProfile(safe, {
    ...data,
    googleImportSnapshot: null,
    googleImportedFieldKeys: [],
    lastGoogleImportDebug: {
      at: new Date().toISOString(),
      invalidated: true,
      reason,
    },
  } as typeof data);

  const intelPath = intelligenceFile(safe);
  if (fs.existsSync(intelPath)) {
    try {
      fs.unlinkSync(intelPath);
    } catch {
      /* non-fatal */
    }
  }
}

export async function addOrUpdateGoogleBusinessProfile(
  slug: string,
  googleBusinessUrl: string,
  operator: string,
  options: { invalidateImport?: boolean } = {},
): Promise<{ identity: GoogleIdentityRecord; preview: GoogleConfirmationPreview }> {
  const safe = safeAdminSlug(slug);
  const gate = canEditGoogleBusinessProfile(safe);
  if (!gate.allowed) throw new Error(gate.reason || "Cannot edit Google Business Profile");

  const resolved = await resolveGoogleCandidateFromUrl(safe, googleBusinessUrl);
  const data = readSetupProfile(safe);

  if (options.invalidateImport && data.googleImportSnapshot) {
    invalidateGoogleImportEvidence(safe, "Google Business Profile URL changed");
  }

  writeSetupProfile(safe, {
    ...readSetupProfile(safe),
    googleBusinessProfileUrl: resolved.originalUrl.startsWith("ChI") ? resolved.resolvedUrl : resolved.originalUrl,
    googlePlaceId: resolved.candidate.placeId,
    googleBusinessRating: resolved.candidate.rating,
    googleBusinessReviewCount: resolved.candidate.reviewCount,
    customerSetupGoogleMatchStatus: "pending",
    customerSetupGoogleCandidates: resolved.candidates || [],
  } as typeof data);

  const identity = writeGoogleIdentityRecord(safe, {
    slug: safe,
    updatedAt: new Date().toISOString(),
    originalUrl: resolved.originalUrl,
    resolvedUrl: resolved.resolvedUrl,
    placeId: resolved.candidate.placeId,
    confirmationStatus: "pending",
    verificationStatus: "unverified",
    confirmedAt: null,
    confirmedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    urlResolution: resolved.urlResolution,
    preview: resolved.preview,
    candidateCount: resolved.candidateCount,
    confidence: resolved.confidence,
  });

  void operator;
  return { identity, preview: resolved.preview };
}

export function confirmGoogleBusinessProfileIdentity(
  slug: string,
  operator: string,
): { identity: GoogleIdentityRecord; preview: GoogleConfirmationPreview } {
  const safe = safeAdminSlug(slug);
  const identity = readGoogleIdentityRecord(safe);
  if (!identity?.preview) throw new Error("No Google Business Profile candidate to confirm");
  if (identity.confirmationStatus !== "pending") {
    throw new Error("Google Business Profile is not awaiting confirmation");
  }

  const data = readSetupProfile(safe);
  writeSetupProfile(safe, {
    ...data,
    googleBusinessProfileUrl: identity.originalUrl.startsWith("ChI") ? identity.resolvedUrl : identity.originalUrl,
    googlePlaceId: identity.placeId,
    googleBusinessRating: identity.preview.rating,
    googleBusinessReviewCount: identity.preview.reviewCount,
    customerSetupGoogleMatchStatus: "pending",
  } as typeof data);

  const confirmed = writeGoogleIdentityRecord(safe, {
    ...identity,
    confirmationStatus: "confirmed",
    verificationStatus: "confirmed",
    confirmedAt: new Date().toISOString(),
    confirmedBy: operator,
    rejectedAt: null,
    rejectedBy: null,
  });

  return { identity: confirmed, preview: confirmed.preview! };
}

export function rejectGoogleBusinessProfileIdentity(slug: string, operator: string): GoogleIdentityRecord {
  const safe = safeAdminSlug(slug);
  const identity = readGoogleIdentityRecord(safe);
  if (!identity) throw new Error("No Google Business Profile identity on record");

  const data = readSetupProfile(safe);
  writeSetupProfile(safe, {
    ...data,
    customerSetupGoogleMatchStatus: "rejected",
  } as typeof data);

  return writeGoogleIdentityRecord(safe, {
    ...identity,
    confirmationStatus: "rejected",
    verificationStatus: "unverified",
    rejectedAt: new Date().toISOString(),
    rejectedBy: operator,
    confirmedAt: null,
    confirmedBy: null,
  });
}

export async function searchGoogleBusinessProfileAgain(
  slug: string,
  googleBusinessUrl: string | undefined,
  operator: string,
): Promise<{ identity: GoogleIdentityRecord; preview: GoogleConfirmationPreview }> {
  const safe = safeAdminSlug(slug);
  const existing = readGoogleIdentityRecord(safe);
  const data = readSetupProfile(safe);
  const url = str(googleBusinessUrl || existing?.originalUrl || data.googleBusinessProfileUrl);
  if (!url) throw new Error("Google Business Profile URL is required to search again");
  return addOrUpdateGoogleBusinessProfile(safe, url, operator, { invalidateImport: false });
}

export function assessGoogleImportReadiness(slug: string): GoogleImportGateResult {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const identity = readGoogleIdentityRecord(safe);

  if (data.googleImportSnapshot) {
    return { canProceed: true, confirmationRequired: false, reason: null, preview: identity?.preview || null };
  }

  if (!identity && !data.googleBusinessProfileUrl) {
    return {
      canProceed: false,
      confirmationRequired: false,
      reason: "Add a Google Business Profile URL before continuing.",
      preview: null,
    };
  }

  if (identity?.confirmationStatus === "pending") {
    return {
      canProceed: false,
      confirmationRequired: true,
      reason: "Confirm the Google Business Profile identity before Google Import.",
      preview: identity.preview,
    };
  }

  if (identity?.confirmationStatus === "rejected") {
    return {
      canProceed: false,
      confirmationRequired: false,
      reason: "Google Business Profile was rejected — add or search for a new listing.",
      preview: null,
    };
  }

  if (identity?.confirmationStatus !== "confirmed") {
    return {
      canProceed: false,
      confirmationRequired: false,
      reason: "Resolve and confirm the Google Business Profile before Google Import.",
      preview: identity?.preview || null,
    };
  }

  return { canProceed: true, confirmationRequired: false, reason: null, preview: identity.preview };
}

export function assertGoogleImportAllowed(slug: string): void {
  const gate = assessGoogleImportReadiness(slug);
  if (!gate.canProceed) {
    throw new Error(gate.reason || "Google Business Profile confirmation required");
  }
  const identity = readGoogleIdentityRecord(slug);
  const data = readSetupProfile(slug);
  if (!data.googleImportSnapshot && identity?.confirmationStatus !== "confirmed") {
    throw new Error("Google Business Profile must be confirmed before import");
  }
}

export function buildGoogleIntelligenceFromSnapshot(
  slug: string,
  snapshot: GoogleImportSnapshot,
  identity: GoogleIdentityRecord | null,
): GoogleIntelligenceRecord {
  return {
    slug: safeAdminSlug(slug),
    importedAt: snapshot.importedAt || new Date().toISOString(),
    placeId: snapshot.placeId,
    businessName: snapshot.businessName,
    address: snapshot.address,
    town: snapshot.town,
    postcode: snapshot.postcode,
    telephone: snapshot.phone,
    website: snapshot.website,
    openingHours: snapshot.openingHours || [],
    categories: snapshot.categories || [],
    attributes: [],
    photos: [{ count: snapshot.photoCount || 0, thumbnailUrl: identity?.preview?.thumbnailUrl || null }],
    reviews: { rating: snapshot.rating, reviewCount: snapshot.reviewCount },
    rating: snapshot.rating,
    reviewCount: snapshot.reviewCount,
    questions: [],
    services: snapshot.categories || [],
    coordinates: { latitude: snapshot.latitude, longitude: snapshot.longitude },
    mapsUrl: snapshot.googleMapsUrl,
    appointmentUrl: null,
    googleBusinessProfileUrl: snapshot.googleBusinessUrl || identity?.originalUrl || "",
    confidence: identity?.confidence ?? null,
    sourceSnapshotStatus: snapshot.status,
  };
}

/** Promote confirmed Place ID imports stuck in needs_review and write intelligence JSON. */
export function reconcileConfirmedGoogleImportPersistence(slug: string): GoogleIntelligenceRecord | null {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const identity = readGoogleIdentityRecord(safe);
  const snap = data.googleImportSnapshot as GoogleImportSnapshot | null | undefined;

  if (snap?.status === "imported" && str(snap.placeId)) {
    return persistGoogleIntelligenceFromImport(safe);
  }

  if (identity?.confirmationStatus !== "confirmed") return null;

  const placeId = str(identity.placeId) || str(data.googlePlaceId);
  if (!placeId) return null;

  const preview = identity.preview;
  const promoted: GoogleImportSnapshot = {
    ...(snap || emptyGoogleSnapshotForReconcile()),
    status: "imported",
    importedAt: snap?.importedAt || new Date().toISOString(),
    message: snap?.message || "Google Profile imported from confirmed listing.",
    placeId,
    businessName: str(preview?.businessName) || str(snap?.businessName) || str(data.pharmacyName),
    address: str(preview?.address) || str(snap?.address),
    phone: str(preview?.phone) || str(snap?.phone),
    website: str(preview?.website) || str(snap?.website),
    postcode: str(preview?.postcode) || str(snap?.postcode),
    googleMapsUrl: str(preview?.googleMapsUrl) || str(snap?.googleMapsUrl),
    googleBusinessUrl: identity.originalUrl || str(snap?.googleBusinessUrl) || str(data.googleBusinessProfileUrl),
    rating: preview?.rating ?? snap?.rating ?? null,
    reviewCount: preview?.reviewCount ?? snap?.reviewCount ?? 0,
    categories: preview?.primaryCategory ? [preview.primaryCategory] : snap?.categories || [],
    searchPharmacyName: str(snap?.searchPharmacyName) || str(data.pharmacyName),
    searchTown: str(snap?.searchTown) || str(data.primaryTown),
    searchPostcode: str(snap?.searchPostcode) || str(data.postcode),
    candidates: [],
  };

  writeSetupProfile(safe, {
    ...readSetupProfile(safe),
    googleImportSnapshot: promoted,
    googlePlaceId: placeId,
    googleBusinessProfileUrl: promoted.googleBusinessUrl || data.googleBusinessProfileUrl,
    customerSetupGoogleMatchStatus: "confirmed",
  } as typeof data);

  if (identity) {
    writeGoogleIdentityRecord(safe, {
      ...identity,
      verificationStatus: "imported",
    });
  }

  const record = buildGoogleIntelligenceFromSnapshot(safe, promoted, identity);
  return writeGoogleIntelligenceRecord(safe, record);
}

function emptyGoogleSnapshotForReconcile(): GoogleImportSnapshot {
  return {
    status: "not_found",
    importedAt: "",
    message: "",
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

export function persistGoogleIntelligenceFromImport(slug: string): GoogleIntelligenceRecord | null {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const snapshot = data.googleImportSnapshot;
  if (!snapshot || snapshot.status !== "imported") return null;

  const identity = readGoogleIdentityRecord(safe);
  const record = buildGoogleIntelligenceFromSnapshot(safe, snapshot, identity);

  if (identity) {
    writeGoogleIdentityRecord(safe, {
      ...identity,
      verificationStatus: "imported",
    });
  }

  writeSetupProfile(safe, {
    ...data,
    customerSetupGoogleMatchStatus: "confirmed",
    googlePlaceId: snapshot.placeId || data.googlePlaceId,
    googleBusinessProfileUrl: snapshot.googleMapsUrl || data.googleBusinessProfileUrl,
  } as typeof data);

  return writeGoogleIntelligenceRecord(safe, record);
}

export function buildGoogleSourceSummary(slug: string): GoogleSourceSummary {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const identity = readGoogleIdentityRecord(safe);
  const intelligence = readGoogleIntelligenceRecord(safe);
  const snap = data.googleImportSnapshot as GoogleImportSnapshot | null | undefined;
  const gate = canEditGoogleBusinessProfile(safe);
  const canonical = buildCustomerCanonicalStatuses(safe).find((c) => c.key === "google_import");
  const importGate = assessGoogleImportReadiness(safe);

  const preview = identity?.preview || null;
  const businessName = intelligence?.businessName || snap?.businessName || preview?.businessName || data.pharmacyName || "";

  return {
    businessName,
    googleBusinessProfileUrl: identity?.originalUrl || data.googleBusinessProfileUrl || "",
    placeId: identity?.placeId || data.googlePlaceId || snap?.placeId || "",
    verificationStatus: identity?.verificationStatus || (snap ? "imported" : "unverified"),
    googleMapsLink: snap?.googleMapsUrl || preview?.googleMapsUrl || identity?.resolvedUrl || "",
    primaryCategory: preview?.primaryCategory || snap?.categories?.[0] || intelligence?.categories?.[0] || "",
    rating: snap?.rating ?? preview?.rating ?? data.googleBusinessRating ?? intelligence?.rating ?? null,
    reviewCount: snap?.reviewCount ?? preview?.reviewCount ?? data.googleBusinessReviewCount ?? intelligence?.reviewCount ?? 0,
    lastGoogleImport: snap?.importedAt || intelligence?.importedAt || null,
    importStatus: canonical?.state || (snap ? "IMPORTED" : identity?.confirmationStatus === "confirmed" ? "CONFIRMED" : "NOT CONFIGURED"),
    confidence: identity?.confidence ?? intelligence?.confidence ?? null,
    confirmationStatus: identity?.confirmationStatus || "none",
    confirmationRequired: importGate.confirmationRequired,
    canEditGoogle: gate.allowed,
    editBlockedReason: gate.reason,
    googleImported: Boolean(snap?.importedAt && snap.status === "imported"),
    importedEvidence: snap ? (snap as unknown as Record<string, unknown>) : null,
    googleIntelligence: intelligence,
    confirmationPreview: preview,
    importHistoryCount: readImportHistory(safe).length,
    urlResolution: identity?.urlResolution || null,
  };
}

export function queueRerunGoogleImport(slug: string, operator: string): { jobId: string; placeId: string } {
  const safe = safeAdminSlug(slug);
  const gate = canEditGoogleBusinessProfile(safe);
  if (!gate.allowed) throw new Error(gate.reason || "Cannot re-run Google import");

  assertGoogleImportAllowed(safe);

  const data = readSetupProfile(safe);
  if (data.googleImportSnapshot) {
    archiveGoogleImportSnapshot(safe, "Re-run Google Import — previous snapshot archived");
    const refreshed = readSetupProfile(safe);
    writeSetupProfile(safe, {
      ...refreshed,
      googleImportSnapshot: null,
      googleImportedFieldKeys: [],
    } as typeof refreshed);
  }

  const identity = readGoogleIdentityRecord(safe);
  const job = createMasterAdminJob({
    slug: safe,
    action: "import_google",
    user: operator,
    workflowStage: "google_import",
  });

  runMasterAdminJobAsync(
    job.id,
    {
      googleBusinessUrl: identity?.resolvedUrl || identity?.originalUrl || data.googleBusinessProfileUrl || "",
      pharmacyName: data.pharmacyName || "",
      town: data.primaryTown || "",
      postcode: data.postcode || "",
    },
    { workflowStage: "google_import" },
  );

  void operator;
  return { jobId: job.id, placeId: identity?.placeId || data.googlePlaceId || "" };
}

/** CPR-RESET-01 — search Google listings without auto-confirming; persists candidate list for PO selection. */
export async function searchGoogleCandidatesForCustomer(
  slug: string,
  googleBusinessUrl: string | undefined,
  operator: string,
): Promise<{ candidates: CustomerSetupGoogleCandidate[]; selectedPreview: GoogleConfirmationPreview | null }> {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const url = str(googleBusinessUrl || data.googleBusinessProfileUrl);
  if (!url) throw new Error("Enter a Google Maps URL or search query to find listings");

  const resolved = await resolveGoogleCandidateFromUrl(safe, url);
  writeSetupProfile(safe, {
    ...readSetupProfile(safe),
    customerSetupGoogleCandidates: resolved.candidates,
  } as typeof data);

  void operator;
  return {
    candidates: resolved.candidates,
    selectedPreview: resolved.preview,
  };
}

/** CPR-RESET-01 — Product Owner selects a candidate from the search results list. */
export async function selectGoogleCandidateByPlaceId(
  slug: string,
  placeId: string,
  operator: string,
): Promise<{ identity: GoogleIdentityRecord; preview: GoogleConfirmationPreview }> {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const candidates = data.customerSetupGoogleCandidates || [];
  const match = candidates.find((c) => c.placeId === placeId);
  if (!match) throw new Error("Selected Place ID was not found in the current search results — search again");

  const hints = buildSetupGoogleMatchHints(safe, {
    pharmacyName: data.pharmacyName || "",
    town: data.primaryTown || data.townCity || "",
    postcode: data.postcode || "",
  });
  const enriched = await fetchEnrichedGoogleImportCandidate(match, hints);
  const candidate = enriched.candidate;
  const preview = candidateToPreview(candidate);
  const urlResolution = candidateToUrlResolution(match.googleMapsUrl, match.googleMapsUrl, candidate, {
    latitude: enriched.latitude,
    longitude: enriched.longitude,
  });

  writeSetupProfile(safe, {
    ...readSetupProfile(safe),
    googleBusinessProfileUrl: match.googleMapsUrl,
    googlePlaceId: candidate.placeId,
    googleBusinessRating: candidate.rating,
    googleBusinessReviewCount: candidate.reviewCount,
    customerSetupGoogleMatchStatus: "pending",
  } as typeof data);

  const identity = writeGoogleIdentityRecord(safe, {
    slug: safe,
    updatedAt: new Date().toISOString(),
    originalUrl: match.googleMapsUrl,
    resolvedUrl: match.googleMapsUrl,
    placeId: candidate.placeId,
    confirmationStatus: "pending",
    verificationStatus: "unverified",
    confirmedAt: null,
    confirmedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    urlResolution,
    preview,
    candidateCount: candidates.length,
    confidence: candidate.confidence,
  });

  void operator;
  return { identity, preview };
}
