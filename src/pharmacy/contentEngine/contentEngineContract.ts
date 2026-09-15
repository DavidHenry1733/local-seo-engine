/**
 * Content Engine Contract V1 — validation rules for ContentGenerationContext.
 */
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import { findUnresolvedTokens } from "./contentEngineTokens.ts";
import { isRequestedTenantIdentity } from "../pharmacyTenantIdentityIsolation.ts";
import { confirmedTenantIdentityCandidates } from "../pharmacyServicePagePublicationQuality.ts";

export const CONTENT_ENGINE_REQUIRED_FIELDS = [
  "slug",
  "resolvedSlug",
  "serviceId",
  "serviceName",
  "profile.pharmacyName",
  "profile.phone",
  "cta.phone",
  "masterLibrary.sections",
  "selectedAreas",
  "localArea",
  "tokens.pharmacy",
] as const;

export const CONTENT_ENGINE_OPTIONAL_FIELDS = [
  "profile.bookingUrl",
  "reviewer.photoUrl",
  "map.resolvedEmbedUrl",
  "variantPack",
  "images.assignmentPath",
  "links.moneyLinks",
] as const;

export interface ContentEngineContractValidation {
  ok: boolean;
  contractVersion: string;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  presentOptional: string[];
}

function getPath(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function validateContentGenerationContext(ctx: ContentGenerationContext): ContentEngineContractValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const presentOptional: string[] = [];

  for (const field of CONTENT_ENGINE_REQUIRED_FIELDS) {
    const val = getPath(ctx as unknown as Record<string, unknown>, field);
    if (val === undefined || val === null || val === "") {
      missingRequired.push(field);
      errors.push(`missing required field: ${field}`);
    }
  }

  for (const field of CONTENT_ENGINE_OPTIONAL_FIELDS) {
    const val = getPath(ctx as unknown as Record<string, unknown>, field);
    if (val !== undefined && val !== null && val !== "") presentOptional.push(field);
  }

  // Own confirmed identity is never foreign. Catalog names are bleed only when this
  // tenant's confirmed Google/branch/parent-brand/profile identity is a different pharmacy.
  if (/brook pharmacy/i.test(ctx.profile.pharmacyName)) {
    const confirmed = confirmedTenantIdentityCandidates(ctx.rawProfile || {});
    const ownsIdentity = confirmed.some((name) => isRequestedTenantIdentity("Brook Pharmacy", name));
    if (!ownsIdentity) {
      errors.push("Brook Pharmacy name bleed detected on non-pharmaconnect tenant");
    }
  }

  if (!ctx.selectedAreas.length) {
    warnings.push("no selected areas — local cluster generation may be limited");
  }

  if (!ctx.map.resolvedEmbedUrl && !ctx.profile.fullAddress) {
    warnings.push("map embed and address both missing");
  }

  const tokenSample = Object.values(ctx.tokens).join(" ");
  const unresolved = findUnresolvedTokens(tokenSample);
  if (unresolved.length) {
    warnings.push(`unresolved tokens in context sample: ${unresolved.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    contractVersion: ctx.contractVersion,
    errors,
    warnings,
    missingRequired,
    presentOptional,
  };
}

export interface GeneratorRuntimeReport {
  generatorId: string;
  receivedContext: boolean;
  contextVersion: string | null;
  slug: string | null;
  serviceId: string | null;
  missingFields: string[];
  unusedFields: string[];
  tokensReplaced: string[];
  tokensUnresolved: string[];
  tenantValidation: { ok: boolean; detail: string };
  serviceValidation: { ok: boolean; detail: string };
  brandValidation: { ok: boolean; detail: string };
  linksValidation: { ok: boolean; detail: string };
  imageValidation: { ok: boolean; detail: string };
}

export function createGeneratorRuntimeReport(
  generatorId: string,
  ctx: ContentGenerationContext,
): GeneratorRuntimeReport {
  return {
    generatorId,
    receivedContext: true,
    contextVersion: ctx.contractVersion,
    slug: ctx.resolvedSlug,
    serviceId: ctx.serviceId,
    missingFields: [],
    unusedFields: [],
    tokensReplaced: [],
    tokensUnresolved: [],
    tenantValidation: {
      ok: Boolean(ctx.profile.pharmacyName && ctx.resolvedSlug),
      detail: ctx.profile.pharmacyName ? "tenant ok" : "missing pharmacy name",
    },
    serviceValidation: {
      ok: Boolean(ctx.serviceId && ctx.masterLibrary.sections.length),
      detail: `${ctx.serviceId}: ${ctx.masterLibrary.sections.length} sections`,
    },
    brandValidation: {
      ok: Boolean(ctx.brand.primaryColor && ctx.brand.fontHeading),
      detail: ctx.brand.primaryColor ? "brand present" : "brand incomplete",
    },
    linksValidation: {
      ok: Boolean(ctx.links.mainServicePreviewUrl),
      detail: ctx.links.mainServicePreviewUrl,
    },
    imageValidation: {
      ok: ctx.images.assignmentsLoaded,
      detail: ctx.images.assignmentsLoaded ? "assignments loaded" : "no image assignments",
    },
  };
}
