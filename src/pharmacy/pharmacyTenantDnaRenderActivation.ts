/**
 * Tenant DNA renderer activation — template selection, spacing sanity, fallback audit.
 */
import fs from "node:fs";
import type { BrandDNA } from "./pharmacyBrandDnaTypes.ts";
import type { BrandDnaTypographyRole } from "./pharmacyBrandDnaSemanticTypes.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { resolveComponentDnaForRender } from "./pharmacyComponentDnaResolver.ts";
import { getPharmacyComponentDnaPath } from "./masterAdminComponentDnaPersistenceService.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { tryLoadDesignIntelligence } from "./pharmacyDesignIntelligenceResolver.ts";
import { fontStack } from "./pharmacyBrandDnaRenderTokens.ts";
import { isPharmaconnectDesignSystemV1Locked } from "./pharmacyDesignSystemV1.ts";

export const TENANT_DNA_TEMPLATE_ID = "tenant-dna-v1";
export const LOCKDOWN_TEMPLATE_ID = "lockdown-v1";
export const TENANT_DNA_RENDERER_REVISION = "tenant-dna-activation-rc1-r1-v1";

const HEADING_FALLBACK = "system-ui, -apple-system, Segoe UI, sans-serif";
const BODY_FALLBACK = "system-ui, -apple-system, Segoe UI, sans-serif";

export interface RenderFallbackRecord {
  component: string;
  reason: string;
  forbidden: boolean;
}

const activeFallbacks: RenderFallbackRecord[] = [];

export function resetRenderFallbacks(): void {
  activeFallbacks.length = 0;
}

export function recordRenderFallback(component: string, reason: string, forbidden = true): void {
  activeFallbacks.push({ component, reason, forbidden });
}

export function getRenderFallbacks(): RenderFallbackRecord[] {
  return [...activeFallbacks];
}

export function hasPersistedTenantComponentDna(slug: string): boolean {
  const file = getPharmacyComponentDnaPath(slug);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { header?: unknown; footer?: unknown; variants?: unknown };
    return Boolean(raw.header && raw.footer && raw.variants);
  } catch {
    return false;
  }
}

export function hasActivatedTenantDesignDna(slug: string): boolean {
  if (isPharmaconnectDesignSystemV1Locked()) return false;
  const brand = resolveBrandDnaForRender(slug);
  const imported = Boolean(brand.provenance?.websiteImport || brand.provenance?.customerOverrides);
  return imported && hasPersistedTenantComponentDna(slug);
}

export function resolveServicePageTemplateId(slug: string): string {
  if (isPharmaconnectDesignSystemV1Locked()) return LOCKDOWN_TEMPLATE_ID;
  return hasActivatedTenantDesignDna(slug) ? TENANT_DNA_TEMPLATE_ID : LOCKDOWN_TEMPLATE_ID;
}

function parsePx(value: string): number {
  const n = parseFloat(String(value || "").replace(/px$/, ""));
  return Number.isFinite(n) ? n : 0;
}

export function resolveEffectiveSectionSpacing(slug: string, brand: BrandDNA): string {
  const raw = String(brand.spacing?.sectionY || brand.surfaces?.sectionPadding || "").trim();
  const px = parsePx(raw);
  if (!hasActivatedTenantDesignDna(slug)) return raw || "84px";
  if (px >= 24) return raw;

  const evidence = loadWebsiteDesignEvidence(slug);
  const fromEvidence = String(evidence?.layout?.sectionPaddingY || "").trim();
  if (parsePx(fromEvidence) >= 24) return fromEvidence;

  const componentDna = resolveComponentDnaForRender(slug, brand);
  const fromHero = String(componentDna.hero.paddingY || "").trim();
  if (parsePx(fromHero) >= 10) return fromHero;

  const fromSplit = String(componentDna.splitSection.paddingY || "").trim();
  if (parsePx(fromSplit) >= 24) return fromSplit;

  return "72px";
}

function roleFont(role?: BrandDnaTypographyRole, fallbackFamily?: string): string {
  if (!role?.fontFamily) return fontStack(fallbackFamily || "", BODY_FALLBACK);
  return fontStack(role.fontFamily, fallbackFamily ? fontStack(fallbackFamily, BODY_FALLBACK) : BODY_FALLBACK);
}

export function resolveTenantTypographyRoleCss(slug: string, brand?: BrandDNA): string {
  const resolved = brand || resolveBrandDnaForRender(slug);
  if (!hasActivatedTenantDesignDna(slug) || !resolved.typographyRoles) return "";

  const roles = resolved.typographyRoles;
  const lines: string[] = [];
  if (roles.h1) {
    lines.push(
      `h1{font-family:${roleFont(roles.h1, resolved.typography.headingFont)};font-size:${roles.h1.fontSize || "var(--h1-scale)"};font-weight:${roles.h1.fontWeight || resolved.typography.headingWeight || "700"};line-height:${roles.h1.lineHeight || "1.08"};color:${roles.h1.colour || "var(--brand-heading-primary)"};}`,
    );
  }
  if (roles.h2) {
    lines.push(
      `h2,.section-head h2{font-family:${roleFont(roles.h2, resolved.typography.headingFont)};font-size:${roles.h2.fontSize || "var(--h2-scale)"};font-weight:${roles.h2.fontWeight || resolved.typography.headingWeight || "700"};line-height:${roles.h2.lineHeight || "1.12"};color:${roles.h2.colour || "var(--brand-heading-primary)"};}`,
    );
  }
  if (roles.h3) {
    lines.push(
      `h3,.card h3,.faq .faq-q{font-family:${roleFont(roles.h3, resolved.typography.headingFont)};font-size:${roles.h3.fontSize || "var(--h3-size)"};font-weight:${roles.h3.fontWeight || "700"};line-height:${roles.h3.lineHeight || "1.2"};color:${roles.h3.colour || "var(--brand-heading-primary)"};}`,
    );
  }
  if (roles.body) {
    lines.push(
      `p,body{font-family:${roleFont(roles.body, resolved.typography.bodyFont)};font-size:${roles.body.fontSize || "var(--body-size)"};font-weight:${roles.body.fontWeight || resolved.typography.bodyWeight || "400"};line-height:${roles.body.lineHeight || "1.65"};color:${roles.body.colour || "var(--brand-muted)"};}`,
    );
  }
  if (roles.navigation) {
    lines.push(
      `.nav-links a{font-family:${roleFont(roles.navigation, resolved.typography.bodyFont)};font-size:${roles.navigation.fontSize || "14px"};font-weight:${roles.navigation.fontWeight || "600"};line-height:${roles.navigation.lineHeight || "1.4"};color:${roles.navigation.colour || "var(--header-text,var(--brand-text))"};}`,
    );
  }
  if (roles.button) {
    lines.push(
      `.btn,.nav-cta{font-family:${roleFont(roles.button, resolved.typography.bodyFont)};font-size:${roles.button.fontSize || "18px"};font-weight:${roles.button.fontWeight || "600"};line-height:${roles.button.lineHeight || "1.2"};}`,
    );
  }
  if (roles.footer) {
    lines.push(
      `.site-footer,.site-footer p,.site-footer a,.site-footer h3{font-family:${roleFont(roles.footer, resolved.typography.bodyFont)};font-size:${roles.footer.fontSize || "14px"};font-weight:${roles.footer.fontWeight || "400"};line-height:${roles.footer.lineHeight || "1.6"};}`,
    );
  }
  return lines.join("\n");
}

export function resolveLayoutDnaRevision(slug: string): string {
  const manifest = tryLoadDesignIntelligence(slug);
  if (manifest) return manifest.sourceRevision;
  const evidence = loadWebsiteDesignEvidence(slug);
  return evidence?.sourceRevision || "missing";
}

export function auditRenderedHtmlFallbacks(html: string, slug: string): string[] {
  const flags: string[] = [];
  if (!hasActivatedTenantDesignDna(slug)) return flags;

  if (/<body\b[^>]*data-pharmacy-template="lockdown-v1"/.test(html)) {
    flags.push("forbidden-lockdown-v1-template");
  }
  if (/data-image-missing="true"|review-image-placeholder/.test(html)) {
    flags.push("forbidden-image-placeholder");
  }
  if (/data-image-source="library"/.test(html) && hasActivatedTenantDesignDna(slug)) {
    flags.push("forbidden-library-image-fallback");
  }

  return flags;
}

export function forbiddenRenderFallbackFlags(slug: string, html: string): string[] {
  return [...auditRenderedHtmlFallbacks(html, slug), ...activeFallbacks.filter((f) => f.forbidden).map((f) => f.component)];
}
