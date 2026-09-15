/**
 * Google Profile Import diagnostics — CLI and debug (setup Step 1 only).
 */
import type { CustomerSetupGoogleCandidate } from "./pharmacyProfileSchema.ts";
import { hasGooglePlacesApiKey } from "./googlePlacesConnection.ts";
import {
  type GoogleMatchHints,
  buildKgMidSearchQuery,
  parseGooglePlaceIdFromUrl,
  readSetupProfile,
  searchGoogleListingCandidatesDetailed,
  shouldAutoConfirmGoogleMatch,
  GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD,
} from "./growthEngineCustomerSetupGoogleMatchService.ts";
import { resolveGoogleUrlEntityHints } from "./growthEngineGoogleProfileUrlResolver.ts";

export interface GoogleProfileImportDiagnostics {
  slug: string;
  inputUrl: string;
  resolvedUrl: string;
  urlRedirected: boolean;
  placeIdFromUrl: string;
  kgMidDetected: string;
  searchQueryFromUrl: string;
  entityHintUsed: boolean;
  kgMidSearchQuery: string;
  fallbackSearchQueries: string[];
  apiKeyDetected: boolean;
  placeDetailsStatus: string;
  textSearchStatus: string;
  rawKgMidCandidateCount: number;
  rawKgMidCandidates: CustomerSetupGoogleCandidate[];
  filteredOut: Array<{ businessName: string; placeId: string; reason: string }>;
  candidateCount: number;
  candidates: CustomerSetupGoogleCandidate[];
  selectedCandidate: CustomerSetupGoogleCandidate | null;
  possibleMatch: boolean;
  failureReason: string | null;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function buildSetupGoogleMatchHints(
  slug: string,
  form: { pharmacyName?: string; town?: string; postcode?: string },
  entity: {
    finalUrl: string;
    placeId: string;
    kgMid: string;
    searchQueryFromUrl: string;
  },
): GoogleMatchHints {
  const data = readSetupProfile(slug);
  const baseline = data.customerSetupAdminBaseline;
  const websiteSnap = data.websiteImportSnapshot;
  return {
    pharmacyName:
      str(form.pharmacyName) || baseline?.pharmacyName || data.pharmacyName || data.tradingName || "",
    town: str(form.town) || baseline?.town || data.primaryTown || data.townCity || "",
    postcode: (str(form.postcode) || baseline?.postcode || data.postcode || "").toUpperCase(),
    phone: baseline?.phone || data.phone || "",
    website: websiteSnap?.websiteUrl || baseline?.website || data.website || "",
    googlePlaceId: entity.placeId,
    googleBusinessUrl: entity.finalUrl,
    kgMid: entity.kgMid,
    searchQueryFromUrl: entity.searchQueryFromUrl,
  };
}

function buildHintsFromProfile(
  slug: string,
  googleBusinessUrl: string,
  placeId: string,
  kgMid: string,
  searchQueryFromUrl: string,
): GoogleMatchHints {
  return buildSetupGoogleMatchHints(slug, {}, { finalUrl: googleBusinessUrl, placeId, kgMid, searchQueryFromUrl });
}

function buildFallbackSearchQueries(hints: GoogleMatchHints): string[] {
  return [
    [hints.pharmacyName, "pharmacy", hints.postcode].filter(Boolean).join(" "),
    [hints.pharmacyName, hints.town, hints.postcode].filter(Boolean).join(" "),
    hints.phone ? [hints.pharmacyName, hints.phone, hints.town].filter(Boolean).join(" ") : "",
  ].filter(Boolean);
}

async function fetchPlaceDetailsStatus(placeId: string): Promise<string> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return "skipped (no API key)";
  if (!placeId) return "skipped (no place ID)";

  const id = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,formattedAddress",
      },
    });
    if (res.ok) return `HTTP ${res.status} OK`;
    const body = await res.text();
    return `HTTP ${res.status} ${body.slice(0, 120)}`;
  } catch (err: unknown) {
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function fetchTextSearchStatus(query: string): Promise<string> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return "skipped (no API key)";
  if (!query.trim()) return "skipped (empty query)";

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.primaryType",
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
    });
    if (res.ok) {
      const data = (await res.json()) as { places?: unknown[] };
      return `HTTP ${res.status} OK (${(data.places || []).length} places)`;
    }
    const body = await res.text();
    return `HTTP ${res.status} ${body.slice(0, 120)}`;
  } catch (err: unknown) {
    return `error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function diagnoseGoogleProfileImport(slug: string, googleUrl: string): Promise<GoogleProfileImportDiagnostics> {
  const inputUrl = str(googleUrl);
  const entity = await resolveGoogleUrlEntityHints(inputUrl);
  const hints = buildHintsFromProfile(slug, entity.finalUrl, entity.placeId, entity.kgMid, entity.searchQueryFromUrl);
  const fallbackSearchQueries = buildFallbackSearchQueries(hints);
  const apiKeyDetected = hasGooglePlacesApiKey();

  const placeDetailsStatus = await fetchPlaceDetailsStatus(entity.placeId);
  const kgMidQuery = entity.kgMid ? buildKgMidSearchQuery(hints) : "";
  const textSearchStatus = await fetchTextSearchStatus(kgMidQuery || fallbackSearchQueries[0] || "");

  const search = inputUrl || hints.pharmacyName ? await searchGoogleListingCandidatesDetailed(hints) : {
    candidates: [],
    rawKgMidCandidates: [],
    kgMidSearchQuery: "",
    filteredOut: [],
  };

  const explicitPlaceId = Boolean(entity.placeId || parseGooglePlaceIdFromUrl(entity.finalUrl));
  const selectedCandidate =
    search.candidates.length &&
    shouldAutoConfirmGoogleMatch(search.candidates, false, explicitPlaceId)
      ? search.candidates[0]
      : null;

  const possibleMatch = search.candidates.length > 0 && !selectedCandidate;
  const failureReason = buildFailureReason({
    candidates: search.candidates,
    apiKeyDetected,
    placeId: entity.placeId,
    placeDetailsStatus,
    possibleMatch,
    kgMid: entity.kgMid,
  });

  return {
    slug,
    inputUrl,
    resolvedUrl: entity.finalUrl,
    urlRedirected: entity.redirected,
    placeIdFromUrl: entity.placeId,
    kgMidDetected: entity.kgMid,
    searchQueryFromUrl: entity.searchQueryFromUrl,
    entityHintUsed: entity.entityHintUsed,
    kgMidSearchQuery: search.kgMidSearchQuery,
    fallbackSearchQueries,
    apiKeyDetected,
    placeDetailsStatus,
    textSearchStatus,
    rawKgMidCandidateCount: search.rawKgMidCandidates.length,
    rawKgMidCandidates: search.rawKgMidCandidates.slice(0, 5),
    filteredOut: search.filteredOut.map((f) => ({
      businessName: f.candidate.businessName,
      placeId: f.candidate.placeId,
      reason: f.reason,
    })),
    candidateCount: search.candidates.length,
    candidates: search.candidates.slice(0, 5),
    selectedCandidate,
    possibleMatch,
    failureReason,
  };
}

function buildFailureReason(args: {
  candidates: CustomerSetupGoogleCandidate[];
  apiKeyDetected: boolean;
  placeId: string;
  placeDetailsStatus: string;
  possibleMatch: boolean;
  kgMid: string;
}): string | null {
  if (args.possibleMatch) return null;
  if (args.candidates.length && args.candidates[0].confidence >= GOOGLE_MATCH_AUTO_CONFIRM_THRESHOLD) {
    return "Multiple similar candidates — manual selection required.";
  }
  if (args.candidates.length) return null;
  if (!args.apiKeyDetected) return "GOOGLE_PLACES_API_KEY is not configured.";
  if (args.placeId && !args.placeDetailsStatus.includes("OK")) {
    return `Place ID ${args.placeId} could not be loaded: ${args.placeDetailsStatus}`;
  }
  if (args.kgMid) return "No plausible listing matched the kgmid/q entity hint.";
  return "No matching pharmacy listings returned from Google Places.";
}

export function formatCandidateLine(c: CustomerSetupGoogleCandidate, index: number): string {
  return [
    `#${index + 1}`,
    c.businessName || "—",
    `| ${c.address || "—"}`,
    `| ${c.postcode || "—"}`,
    `| ${c.phone || "—"}`,
    `| ${c.rating != null ? `${c.rating}/5` : "—"}`,
    `| ${c.reviewCount ?? 0} reviews`,
    `| ${c.placeId || "—"}`,
    `| confidence ${c.confidence}%`,
  ].join(" ");
}

export { scoreGoogleListingCandidate } from "./growthEngineCustomerSetupGoogleMatchService.ts";
