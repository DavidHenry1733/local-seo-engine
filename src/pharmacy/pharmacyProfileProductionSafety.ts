/**
 * Pharmacy Profile Production Safety V1 — production-safe customer-facing display values.
 * Prevents demo, mock, placeholder and agency test data appearing on customer screens.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

function demonstrationCredentialsBlockSchema(data: Partial<PharmacyProfileData>): boolean {
  const creds = data.displayCredentials;
  if (!creds) return false;
  return creds.kind === "demonstration" || creds.verificationStatus === "unverified";
}

export const PRODUCTION_FALLBACKS = {
  gphc: "GPhC Registration Details Available",
  gphcShort: "GPhC Registered Pharmacy",
  superintendent: "Superintendent Pharmacist Information Available",
  manager: "Pharmacy Manager Information Available",
  nhsProfile: "NHS Profile Link Available",
  email: "Contact Email Available",
  phone: "Contact Phone Available",
  address: "Pharmacy Address Available",
  mapDirections: "Directions available on request",
} as const;

const UNTRUSTED_VALUE_RE =
  /\b(demo|mock|placeholder|sample|test data|example gphc|for testing|not verified)\b/i;

const UNTRUSTED_EMAIL_RE =
  /@inboxingproweb\.com$|\.demo@|@example\.|@test\./i;

export const KNOWN_DEMO_GPHC_NUMBERS = new Set(["9012345", "1234567", "0000000"]);

export interface ProductionProfileContext {
  demoMode: boolean;
  trustDataStatus: string;
}

export function productionContextFromProfile(
  data: Partial<PharmacyProfileData> & { demoMode?: boolean; trustDataStatus?: string },
  doc?: { demoMode?: boolean; trustDataStatus?: string },
): ProductionProfileContext {
  return {
    demoMode: Boolean(doc?.demoMode ?? data.demoMode),
    trustDataStatus: String(doc?.trustDataStatus ?? data.trustDataStatus ?? "").trim(),
  };
}

export function requiresProductionSafeDisplay(ctx: ProductionProfileContext): boolean {
  return ctx.demoMode || ctx.trustDataStatus === "mock" || ctx.trustDataStatus === "demo";
}

export function isUntrustedDisplayValue(value: unknown): boolean {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (UNTRUSTED_VALUE_RE.test(v)) return true;
  if (UNTRUSTED_EMAIL_RE.test(v)) return true;
  return false;
}

export function isUntrustedGphcNumber(value: unknown, ctx?: ProductionProfileContext): boolean {
  const v = String(value ?? "").trim();
  if (!v) return false;
  if (KNOWN_DEMO_GPHC_NUMBERS.has(v.replace(/\D/g, ""))) return true;
  if (ctx && requiresProductionSafeDisplay(ctx)) return true;
  return isUntrustedDisplayValue(v);
}

export function resolveProductionGphcDisplay(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): { display: string; verified: boolean; raw: string } {
  const context = ctx ?? productionContextFromProfile(data);
  const raw = String(data.gphcNumber ?? "").trim();
  if (!raw || isUntrustedGphcNumber(raw, context)) {
    return { display: PRODUCTION_FALLBACKS.gphc, verified: false, raw };
  }
  return { display: `GPhC registration number: ${raw}`, verified: true, raw };
}

export function resolveProductionSuperintendentDisplay(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): { display: string; verified: boolean; raw: string } {
  const context = ctx ?? productionContextFromProfile(data);
  const raw = String(data.superintendentPharmacistName || data.superintendentName || "").trim();
  if (!raw || requiresProductionSafeDisplay(context) || isUntrustedDisplayValue(raw)) {
    return { display: PRODUCTION_FALLBACKS.superintendent, verified: false, raw };
  }
  return { display: raw, verified: true, raw };
}

export function resolveProductionContactNameDisplay(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): { display: string; verified: boolean; raw: string } {
  const context = ctx ?? productionContextFromProfile(data);
  const raw = String(data.primaryContactName ?? "").trim();
  if (!raw || requiresProductionSafeDisplay(context) || isUntrustedDisplayValue(raw)) {
    return { display: PRODUCTION_FALLBACKS.manager, verified: false, raw };
  }
  return { display: raw, verified: true, raw };
}

export function resolveProductionEmailDisplay(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): { display: string; verified: boolean; raw: string; href: string | null } {
  const context = ctx ?? productionContextFromProfile(data);
  const raw = String(data.businessEmail || data.email || "").trim();
  if (!raw || requiresProductionSafeDisplay(context) || isUntrustedDisplayValue(raw) || UNTRUSTED_EMAIL_RE.test(raw)) {
    return { display: PRODUCTION_FALLBACKS.email, verified: false, raw, href: null };
  }
  return { display: raw, verified: true, raw, href: `mailto:${raw}` };
}

export function resolveProductionPhoneDisplay(
  data: Partial<PharmacyProfileData>,
): { display: string; verified: boolean; raw: string; href: string | null } {
  const raw = String(data.phone ?? "").trim();
  if (!raw) {
    return { display: PRODUCTION_FALLBACKS.phone, verified: false, raw, href: null };
  }
  return { display: raw, verified: true, raw, href: `tel:${raw.replace(/\s/g, "")}` };
}

export function resolveProductionNhsProfileUrl(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): { url: string | null; label: string; verified: boolean } {
  const context = ctx ?? productionContextFromProfile(data);
  const raw = String(data.nhsProfileUrl ?? "").trim();
  const genericNhsSearch = /service-search\/pharmacy\/find-a-pharmacy/i.test(raw);
  if (!raw || data.nhsProfileUrlMarkedMissing || genericNhsSearch || requiresProductionSafeDisplay(context)) {
    return { url: null, label: PRODUCTION_FALLBACKS.nhsProfile, verified: false };
  }
  return { url: raw, label: "NHS pharmacy profile", verified: true };
}

export function resolveProductionGphcPremisesUrl(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): string | null {
  const context = ctx ?? productionContextFromProfile(data);
  const raw = String(data.gphcPremisesUrl ?? "").trim();
  const genericRegister = /\/registers\/pharmacy\/?$/i.test(raw);
  if (!raw || genericRegister || requiresProductionSafeDisplay(context)) return null;
  return raw;
}

export function buildProductionTrustSignals(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): string[] {
  const context = ctx ?? productionContextFromProfile(data);
  const gphc = resolveProductionGphcDisplay(data, context);
  const signals: string[] = [];

  if (gphc.verified) signals.push(gphc.display);
  else signals.push(PRODUCTION_FALLBACKS.gphcShort);

  if (data.nhsServicesAvailable) signals.push("NHS pharmacy services");
  if (data.consultationRoomAvailable) signals.push("Private consultation room");
  if (data.privateServicesAvailable) signals.push("Private pharmacy services");

  const accreditations = (data.accreditations || [])
    .map((a) => String(a).trim())
    .filter((a) => a && !isUntrustedDisplayValue(a))
    .slice(0, 3);
  signals.push(...accreditations);

  return [...new Set(signals)].slice(0, 6);
}

export function sanitizeServicePageProfileFields<
  T extends {
    gphcNumber: string;
    superintendentPharmacistName: string;
    email: string;
    demoMode: boolean;
  },
>(profile: T, data: Partial<PharmacyProfileData>): T {
  const ctx = productionContextFromProfile(data, { demoMode: profile.demoMode });
  const gphc = resolveProductionGphcDisplay(data, ctx);
  const superintendent = resolveProductionSuperintendentDisplay(data, ctx);
  const email = resolveProductionEmailDisplay(data, ctx);

  return {
    ...profile,
    gphcNumber: gphc.verified ? gphc.raw : "",
    superintendentPharmacistName: superintendent.verified ? superintendent.raw : "",
    email: email.verified ? email.raw : "",
    demoMode: false,
  };
}

export function schemaSafeGphcIdentifier(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): string | null {
  if (demonstrationCredentialsBlockSchema(data)) return null;
  const gphc = resolveProductionGphcDisplay(data, ctx);
  return gphc.verified ? gphc.raw : null;
}

export function schemaSafeSuperintendentName(
  data: Partial<PharmacyProfileData>,
  ctx?: ProductionProfileContext,
): string | null {
  if (demonstrationCredentialsBlockSchema(data)) return null;
  const superintendent = resolveProductionSuperintendentDisplay(data, ctx);
  return superintendent.verified ? superintendent.raw : null;
}

export function stripDemoSchemaExtensions(schema: Record<string, unknown>): Record<string, unknown> {
  const out = { ...schema };
  delete out["x-demo-pharmacy"];
  delete out["x-trust-data-status"];
  return out;
}

export const CUSTOMER_FACING_FORBIDDEN_TERMS = [
  "Demo GPhC",
  "Demo Superintendent",
  "Demo Manager",
  "Demo pharmacy profile",
  "mock data",
  "DEMO DATA",
  "for testing",
  "demo profile",
  "Map integration placeholder",
  "Demo Quick Links",
] as const;
