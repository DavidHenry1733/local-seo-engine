/**
 * LEGACY — quarantined by CPR-PLATFORM-RECOVERY-02.
 * Production service pages use buildVisualServicePageMainHtml / Layout V3.
 */
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import type { PharmacyImageRenderContext } from "./templates/pharmacyImageLibrary.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { buildVisualServicePageMainHtml } from "./pharmacyVisualServicePageRenderer.ts";
import { validatePharmacyServicePageHtml } from "./pharmacyVisualExperienceLayoutV3.ts";

/** @deprecated Use buildVisualServicePageMainHtml — Content Engine V1. */
export function buildPharmacyFirstRecoveryMainHtml(
  sourceHtml: string,
  ctx: PharmacyImageRenderContext,
  profile: PharmacyServicePageProfile,
): string {
  assertLegacyContentEngineAllowed("pharmacyFirstPageRecovery", "buildPharmacyFirstRecoveryMainHtml");
  return buildVisualServicePageMainHtml(sourceHtml, ctx, profile);
}

const FORBIDDEN = [
  "Trust 1",
  "Trust 2",
  "Trust 3",
  "Trust 4",
  "Trust point 1",
  "Trust point 2",
  "Trust point 3",
  "Overview 1",
  "Overview 2",
  "Overview 3",
  "Safety 1",
  "Safety 2",
  "undefined",
  "null",
  ">Placeholder<",
];

/** @deprecated Use validatePharmacyServicePageHtml — unified consolidated pipeline. */
export function validatePharmacyFirstRecoveryHtml(html: string): {
  pass: boolean;
  checks: Record<string, boolean>;
  failures: string[];
} {
  const layout = validatePharmacyServicePageHtml(html);
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch?.[1] ?? html;
  const checks: Record<string, boolean> = {
    ...layout.checks,
    noForbiddenLabels: !FORBIDDEN.some((f) => body.includes(f)),
  };
  const failures = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return { pass: failures.length === 0, checks, failures };
}

export function tracePharmacyFirstProfile(profile: PharmacyServicePageProfile): Record<string, string> {
  return {
    pharmacyName: `${profile.pharmacyName} ← data/pharmacy-profiles/pharmaconnect.json → data.pharmacyName`,
    phone: `${profile.phone} ← data.pharmacy-profiles/pharmaconnect.json → data.phone`,
    address: `${profile.fullAddress} ← addressLine1 + addressLine2 + postcode`,
    ctaText: `${profile.primaryCta} ← data.preferredCta (fallback: Book Consultation)`,
    ctaLink: `${profile.bookingUrl || "#contact"} ← data.bookingUrl or #contact anchor`,
    gphcNumber: profile.demoMode
      ? `${profile.gphcNumber} (demo) ← data.gphcNumber + demoMode:true`
      : `${profile.gphcNumber} ← data.gphcNumber`,
    superintendent: `${profile.superintendentPharmacistName} ← data.superintendentPharmacistName`,
    consultationRoom: profile.consultationRoomAvailable ? "Available ← data.consultationRoomAvailable" : "Not set",
    nhsServices: profile.nhsServicesAvailable ? "Available ← data.nhsServicesAvailable" : "Not set",
    coverageAreas: profile.coverageAreas.join(", ") + " ← rankingAreas + nearbyAreas",
    town: `${profile.town} ← data.townCity`,
    email: `${profile.email} ← data.businessEmail`,
    gphcPremisesUrl: profile.gphcPremisesUrl || "(not set)",
    nhsProfileUrl: profile.nhsProfileUrl || "(not set)",
    openingHours: `${profile.openingHours || "(fallback from master or phone)"} ← data.openingHours`,
    googleMapsEmbedUrl: profile.googleMapsEmbedUrl
      ? `${profile.googleMapsEmbedUrl} ← data.googleMapsEmbedUrl`
      : `Generated ← resolveGoogleMapsEmbedUrl() from address fields`,
  };
}
