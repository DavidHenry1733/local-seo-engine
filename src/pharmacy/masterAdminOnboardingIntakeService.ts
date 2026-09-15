/**
 * First-screen commercial onboarding intake — validation and persistence.
 */
import type { CommercialPharmacyCreateInput } from "./masterAdminCommercialOnboardingService.ts";
import { DEFAULT_COMMERCIAL_SERVICE_ID } from "./masterAdminCommercialOnboardingService.ts";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { persistPrimaryLocality } from "./masterAdminPrimaryLocalityService.ts";
import {
  normalizeGoogleProfileStateInput,
  resolveGoogleProfileOnboardingState,
  shouldRunGoogleImport,
  type GoogleProfileOnboardingState,
} from "./masterAdminGoogleProfileOnboardingService.ts";
import { saveGenerationSetupLocalAreas } from "./masterAdminGenerationSetupService.ts";
import { syncOnboardingBatchGooglePolicy } from "./masterAdminOnboardingBatchService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { resolveOnboardingAddressLine1 } from "./masterAdminOnboardingAddressResolver.ts";
import {
  getOnboardingAreaDiscoveryState,
  maybeRefreshOnboardingAreaDiscovery,
} from "./masterAdminOnboardingAreaDiscoveryService.ts";
import type { ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import {
  clearLocalityCampaignStrategyFields,
  MARKET_SCOPE_NATIONAL,
  normalizeMarketScope,
  resolveMarketScope,
  resolvePrimaryMarket,
  type MarketScope,
} from "./masterAdminMarketScopeService.ts";

export interface OnboardingIntakeAreaInput {
  areaName: string;
  selected?: boolean;
  areaType?: string;
  source?: string;
}

export interface OnboardingIntakeInput extends CommercialPharmacyCreateInput {
  addressLine1?: string;
  addressLine2?: string;
  townOrCity?: string;
  county?: string;
  country?: string;
  primaryServiceId?: string;
  googleProfileState?: GoogleProfileOnboardingState | string;
  marketScope?: MarketScope | string;
  primaryMarket?: string;
  areas?: OnboardingIntakeAreaInput[];
}

export interface OnboardingIntakeValidation {
  ok: boolean;
  errors: string[];
}

export function validateOnboardingIntake(input: OnboardingIntakeInput): OnboardingIntakeValidation {
  const errors: string[] = [];
  if (!String(input.pharmacyName || "").trim()) errors.push("Business name is required");
  if (!String(input.website || "").trim()) errors.push("Website URL is required");
  if (!String(input.contactEmail || "").includes("@")) errors.push("Primary email is required");
  if (!String(input.addressLine1 || "").trim()) errors.push("Address line 1 is required");
  const resolvedScope = normalizeMarketScope(input.marketScope);
  if (!resolvedScope) errors.push("Choose a Market Scope: Local / Regional or National");
  const isNational = resolvedScope === MARKET_SCOPE_NATIONAL;
  if (!isNational && !String(input.townOrCity || "").trim()) errors.push("Town or City is required");
  if (!String(input.postcode || "").trim()) errors.push("Postcode is required");
  if (!String(input.country || "").trim()) errors.push("Country is required");
  const service = String(input.primaryServiceId || DEFAULT_COMMERCIAL_SERVICE_ID).trim();
  if (!service) errors.push("Primary service is required");

  const googleUrl = String(input.googleBusinessProfileUrl || "").trim();
  const placeId = String(input.googlePlaceId || "").trim();
  const state = normalizeGoogleProfileStateInput(input.googleProfileState, Boolean(googleUrl || placeId));
  if (state === "unknown") {
    errors.push("Choose a Google Business Profile option: connect a profile, confirm no profile, or defer");
  }
  if ((state === "configured" || state === "selected") && !googleUrl && !placeId) {
    errors.push("Google Business Profile URL or Place ID is required when connecting Google");
  }
  return { ok: errors.length === 0, errors };
}

export function validateStoredOnboardingIntake(
  data: import("./pharmacyProfileSchema.ts").PharmacyProfileData,
  slug?: string,
): OnboardingIntakeValidation {
  const googleState = resolveGoogleProfileOnboardingState(data);
  const marketScope = slug
    ? resolveMarketScope(slug, data)
    : normalizeMarketScope(data.marketScope) || undefined;
  return validateOnboardingIntake({
    pharmacyName: data.pharmacyName,
    website: data.website,
    contactEmail: data.businessEmail || data.email,
    phone: data.phone,
    postcode: data.postcode,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    townOrCity: data.primaryTown || data.townCity,
    county: data.county,
    country: data.country,
    primaryServiceId: data.selectedServices?.[0],
    googleBusinessProfileUrl: data.googleBusinessProfileUrl,
    googlePlaceId: data.googlePlaceId,
    googleProfileState: googleState,
    marketScope,
    primaryMarket: data.primaryMarket,
  });
}

function syncPendingOnboardingOpportunities(googleState: GoogleProfileOnboardingState) {
  if (googleState === "no_profile") {
    return [
      {
        id: "create-or-claim-gbp",
        title: "Create or claim a Google Business Profile",
        status: "open",
        detail: "No Google profile was confirmed during onboarding.",
      },
    ];
  }
  if (googleState === "deferred") {
    return [
      {
        id: "connect-gbp-later",
        title: "Connect Google Business Profile",
        status: "optional",
        detail: "Google setup was deferred — you can connect or search for a profile later.",
      },
    ];
  }
  return [];
}

export function persistOnboardingIntake(
  slug: string,
  input: OnboardingIntakeInput,
  operator: string,
  options?: { skipValidation?: boolean },
): { googleState: GoogleProfileOnboardingState } {
  const validation = validateOnboardingIntake(input);
  if (!options?.skipValidation && !validation.ok) {
    throw new Error(validation.errors.join("; "));
  }

  const safe = safeAdminSlug(slug);
  const googleUrl = String(input.googleBusinessProfileUrl || "").trim();
  const placeId = String(input.googlePlaceId || "").trim();
  const googleState = normalizeGoogleProfileStateInput(input.googleProfileState, Boolean(googleUrl || placeId));
  const resolvedScope =
    normalizeMarketScope(input.marketScope) ||
    resolveMarketScope(safe, { marketScope: String(input.marketScope || "") });
  const isNational = resolvedScope === MARKET_SCOPE_NATIONAL;
  const town = String(input.townOrCity || "").trim();
  const now = new Date().toISOString();
  const serviceId = String(input.primaryServiceId || DEFAULT_COMMERCIAL_SERVICE_ID).trim();
  const country = String(input.country || "United Kingdom").trim() || "United Kingdom";
  const primaryMarket = isNational
    ? String(input.primaryMarket || "").trim() || resolvePrimaryMarket(safe, {
        marketScope: resolvedScope,
        country,
        primaryMarket: String(input.primaryMarket || ""),
      })
    : String(input.primaryMarket || "").trim();

  if (town) {
    persistPrimaryLocality(safe, {
      townOrCity: town,
      postcode: input.postcode,
      source: "onboarding-intake",
      confirmedByOperator: true,
    });
  }

  const data = readSetupProfile(safe);
  const resolvedAddress = resolveOnboardingAddressLine1(data);
  const nextAddressLine1 = String(input.addressLine1 || "").trim() || resolvedAddress.value;
  const localityClear = isNational ? clearLocalityCampaignStrategyFields(data) : {};
  writeSetupProfile(safe, {
    ...data,
    ...localityClear,
    addressLine1: nextAddressLine1,
    addressLine2: String(input.addressLine2 || data.addressLine2 || "").trim(),
    county: String(input.county || data.county || "").trim(),
    country,
    postcode: String(input.postcode || data.postcode || "").trim().toUpperCase(),
    phone: String(input.phone || data.phone || "").trim(),
    marketScope: resolvedScope,
    primaryMarket: isNational ? primaryMarket || "United Kingdom" : primaryMarket,
    googleBusinessProfileUrl: shouldRunGoogleImport(googleState) ? googleUrl : "",
    googlePlaceId: shouldRunGoogleImport(googleState) ? placeId : "",
    googleProfileOnboardingState: googleState,
    onboardingIntakeCompletedAt: now,
    selectedServices: [serviceId],
    pendingOnboardingOpportunities: syncPendingOnboardingOpportunities(googleState),
  });

  if (!isNational) {
    if (Array.isArray(input.areas) && input.areas.length) {
      const areas = input.areas.filter((a) => String(a.areaName || "").trim());
      saveGenerationSetupLocalAreas(safe, {
        primaryTown: town,
        areas: areas.map((a) => ({ areaName: a.areaName.trim(), selected: a.selected !== false })),
        manualAreas: areas.filter((a) => a.source === "operator").map((a) => a.areaName.trim()),
      });
    } else if (town) {
      maybeRefreshOnboardingAreaDiscovery(safe, {
        town,
        postcode: input.postcode,
        addressLine1: nextAddressLine1,
      });
    }
  }

  syncOnboardingBatchGooglePolicy(safe, googleState);

  recordMasterAdminAudit({
    user: operator,
    slug: safe,
    action: "save_onboarding_intake",
    status: "success",
    evidence: `MarketScope=${resolvedScope}; PrimaryMarket=${isNational ? primaryMarket || "United Kingdom" : town || "—"}; Google state=${googleState}; address=${nextAddressLine1 ? "set" : "missing"}`,
  });

  return { googleState };
}

export function buildOnboardingIntakeForProfile(
  slug: string,
): OnboardingIntakeInput & {
  googleState: GoogleProfileOnboardingState;
  addressLine1Source: string;
  areaDiscovery: ReturnType<typeof getOnboardingAreaDiscoveryState>;
  marketScopeLabel: string;
  localityStrategyActive: boolean;
} {
  const data = readSetupProfile(slug);
  const googleState = resolveGoogleProfileOnboardingState(data);
  const resolvedAddress = resolveOnboardingAddressLine1(data);
  const marketScope = resolveMarketScope(slug, data);
  const primaryMarket = resolvePrimaryMarket(slug, data);
  const areaDiscovery = getOnboardingAreaDiscoveryState(slug);
  const areas = areaDiscovery.areas.map((a) => ({
    areaName: a.areaName,
    selected: a.selected,
    areaType: a.type,
    source: a.source,
  }));
  return {
    pharmacyName: data.pharmacyName,
    website: data.website,
    contactEmail: data.businessEmail || data.email,
    phone: data.phone,
    postcode: data.postcode,
    addressLine1: resolvedAddress.value || data.addressLine1,
    addressLine1Source: resolvedAddress.source,
    addressLine2: data.addressLine2,
    townOrCity: data.primaryTown || data.townCity,
    county: data.county,
    country: data.country,
    primaryServiceId: data.selectedServices?.[0] || DEFAULT_COMMERCIAL_SERVICE_ID,
    googleBusinessProfileUrl: data.googleBusinessProfileUrl,
    googlePlaceId: data.googlePlaceId,
    googleProfileState: googleState,
    marketScope,
    primaryMarket,
    marketScopeLabel: marketScope === MARKET_SCOPE_NATIONAL ? "NATIONAL" : "LOCAL / REGIONAL",
    localityStrategyActive: marketScope !== MARKET_SCOPE_NATIONAL,
    areas,
    googleState,
    areaDiscovery,
  };
}

/** Workflow decision after website import — used by validation and orchestration. */
export function resolvePostWebsiteImportNextStage(googleState: GoogleProfileOnboardingState): "google_import" | "business_profile_intelligence" {
  if (shouldRunGoogleImport(googleState)) return "google_import";
  return "business_profile_intelligence";
}
