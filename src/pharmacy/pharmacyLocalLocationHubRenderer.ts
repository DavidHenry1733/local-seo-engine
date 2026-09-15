/**
 * Location hub shell pages — Content Engine V1 hub renderer path.
 * Legacy cluster shell renderLocalLocationClusterPage is quarantined.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalAreaEvidenceRecord, LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import { assertLegacyContentEngineAllowed } from "./contentEngine/pharmacyLegacyContentEngineQuarantine.ts";
import {
  buildPharmacyServicePageStyleBlock,
  renderPharmacyServicePageFooter,
  renderPharmacyServicePageHeader,
} from "./pharmacyServicePageDesignSystem.ts";
import { applyBrandDnaToServicePageProfile, buildPharmacyThemeWithBrandDna, buildGoogleFontsLink } from "./pharmacyBrandDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { resolvePageComponents, resolvePageComponentDna } from "./pharmacyBrandDnaComponentRenderers.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyThemeEngine.ts";
import { visualServicePageBodyAttributes } from "./pharmacyVisualServicePageRenderer.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  buildLocalPageFinalCtaHtml,
  LOCAL_SHELL_LAYOUT_CSS,
  nestLocalShellHeroInBodyMain,
} from "./pharmacyLocalPageShellLayout.ts";
import { buildImageRenderContext } from "./pharmacyVisualExperience.ts";
import { renderServicePageImagePanel } from "./pharmacyServicePageImageComponent.ts";
import { pharmacyLocalPageResponsiveStyleBlock } from "./pharmacyLocalPageResponsiveStyles.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function previewServiceUrl(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(key)}`;
}

function previewLocalPath(serviceId: string, slug: string, segment: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return `/api/pharmacy-content-ecosystem-preview/${encodeURIComponent(serviceId)}/local/${encodeURIComponent(segment)}/?slug=${encodeURIComponent(key)}`;
}

function renderBreadcrumb(items: Array<{ label: string; href?: string }>): string {
  const parts = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (isLast || !item.href) return `<span>${esc(item.label)}</span>`;
    return `<a href="${esc(item.href)}">${esc(item.label)}</a>`;
  });
  return `<nav class="local-breadcrumb wrap" aria-label="Breadcrumb">${parts.join(' <span aria-hidden="true">›</span> ')}</nav>`;
}

function baseShell(input: {
  ctx: ContentGenerationContext;
  title: string;
  metaDescription: string;
  bodyMain: string;
  pageKind: "location-hub" | "location-cluster";
  dataSlug: string;
}): string {
  const key = resolveTenantProfileSlug(input.ctx.resolvedSlug) || input.ctx.resolvedSlug;
  const baseProfile = input.ctx.profile;
  const brandDna = resolveBrandDnaForRender(key);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const components = resolvePageComponents(theme, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna);
  const imageCtx = buildImageRenderContext(key, input.ctx.serviceId as VisualExperienceServiceId);
  const heroImageHtml = renderServicePageImagePanel(imageCtx, "hero", "hero-image-wrap hero-media");
  const conversionImageHtml = renderServicePageImagePanel(imageCtx, "conversion", "image-panel conversion-feature-image");

  const header = renderPharmacyServicePageHeader(profile, theme);
  const footer = renderPharmacyServicePageFooter(profile, theme);
  const cta = buildLocalPageFinalCtaHtml(input.ctx.serviceName, profile, conversionImageHtml, input.ctx);

  const bodyWithHero = nestLocalShellHeroInBodyMain(input.bodyMain, heroImageHtml);

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(input.title)}</title>
<meta name="description" content="${esc(input.metaDescription)}"/>
<meta name="pharmacy-pipeline-version" content="${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}"/>
<meta name="brand-dna-version" content="${esc(BRAND_DNA_VERSION)}"/>
<meta name="local-page-kind" content="${esc(input.pageKind)}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(profile)}
${buildPharmacyServicePageStyleBlock(theme, brandDna)}
<style>
.local-breadcrumb{padding:16px 0 0;font-size:14px;color:var(--brand-muted)}
.local-breadcrumb a{color:var(--brand-primary);text-decoration:none;font-weight:600}
.local-hub-grid,.local-cluster-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin:28px 0}
.local-hub-card,.local-cluster-card{border:1px solid var(--line);padding:20px;background:var(--section-background);border-radius:var(--radius,0)}
.local-hub-card h3,.local-cluster-card h3{margin:0 0 8px;color:var(--brand-heading);font-family:var(--font-heading)}
.local-prose p{line-height:1.7;color:var(--brand-muted);max-width:72ch}
${LOCAL_SHELL_LAYOUT_CSS}
</style>
${pharmacyLocalPageResponsiveStyleBlock()}
</head>
<body ${visualServicePageBodyAttributes(input.ctx.serviceId)} ${componentDnaBodyAttributes(componentDna)} data-pharmacy-template="tenant-dna-v1" data-publish-source="local-location-engine" data-local-page-kind="${esc(input.pageKind)}" data-local-page-slug="${esc(input.dataSlug)}">
${header}
<main id="main-content">
${bodyWithHero}
${cta}
</main>
${footer}
</body>
</html>`;
}

export function renderLocalLocationHubPage(ctx: ContentGenerationContext, hierarchy: LocalLocationHierarchy): string {
  const hub = hierarchy.hub!;
  const serviceHref = previewServiceUrl(ctx.resolvedSlug, ctx.serviceId);
  const clusterCards = hierarchy.clusters
    .map(
      (c) =>
        `<a class="local-hub-card" href="${esc(previewLocalPath(ctx.serviceId, ctx.resolvedSlug, c.slug))}"><h3>${esc(ctx.serviceName)} — ${esc(c.name)}</h3><p>District coverage cluster for ${esc(hierarchy.primaryLocality)}.</p></a>`,
    )
    .join("\n");
  const areaCards = hierarchy.areas
    .map(
      (a) =>
        `<a class="local-hub-card" href="${esc(previewLocalPath(ctx.serviceId, ctx.resolvedSlug, a.slug))}"><h3>${esc(ctx.serviceName)} in ${esc(a.name)}</h3><p>Local area page</p></a>`,
    )
    .join("\n");

  const bodyMain = [
    renderBreadcrumb([
      { label: ctx.serviceName, href: serviceHref },
      { label: `${ctx.serviceName} locations` },
    ]),
    `<section class="section-block"><div class="wrap local-prose">
<h1>${esc(ctx.serviceName)} locations near ${esc(hierarchy.primaryLocality)}</h1>
<p>${esc(ctx.profile.pharmacyName)} provides ${esc(ctx.serviceName.toLowerCase())} for patients across ${esc(hierarchy.primaryLocality)} and surrounding neighbourhoods. Choose a district cluster or local area below.</p>
<h2>District clusters</h2>
<div class="local-hub-grid">${clusterCards}</div>
<h2>Local area pages</h2>
<div class="local-hub-grid">${areaCards}</div>
<p><a href="${esc(serviceHref)}">Main ${esc(ctx.serviceName)} service page</a> · <a href="tel:${esc(ctx.profile.phone.replace(/\s/g, ""))}">Call ${esc(ctx.profile.displayPhone || ctx.profile.phone)}</a></p>
</div></section>`,
  ].join("\n");

  return baseShell({
    ctx,
    title: `${ctx.serviceName} local locations | ${ctx.profile.pharmacyName}`,
    metaDescription: `${ctx.profile.pharmacyName} — local ${ctx.serviceName} coverage hub for ${hierarchy.primaryLocality}.`,
    bodyMain,
    pageKind: "location-hub",
    dataSlug: hub.slug,
  });
}

export function renderLocalLocationClusterPage(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): string {
  assertLegacyContentEngineAllowed(
    "pharmacyLocalLocationHubRenderer",
    "renderLocalLocationClusterPage",
  );
  const hub = hierarchy.hub!;
  const serviceHref = previewServiceUrl(ctx.resolvedSlug, ctx.serviceId);
  const hubHref = previewLocalPath(ctx.serviceId, ctx.resolvedSlug, hub.slug);
  const childAreas = hierarchy.areas.filter((a) => a.parentAreaId === cluster.areaId);
  const areaCards = childAreas
    .map(
      (a) =>
        `<a class="local-cluster-card" href="${esc(previewLocalPath(ctx.serviceId, ctx.resolvedSlug, a.slug))}"><h3>${esc(ctx.serviceName)} in ${esc(a.name)}</h3><p>Neighbourhood area page</p></a>`,
    )
    .join("\n");

  const bodyMain = [
    renderBreadcrumb([
      { label: ctx.serviceName, href: serviceHref },
      { label: "Locations", href: hubHref },
      { label: cluster.name },
    ]),
    `<section class="section-block"><div class="wrap local-prose">
<h1>${esc(ctx.serviceName)} — ${esc(cluster.name)} cluster</h1>
<p>Local ${esc(ctx.serviceName.toLowerCase())} coverage for ${esc(cluster.name)} and nearby neighbourhoods served from ${esc(ctx.profile.pharmacyName)} in ${esc(hierarchy.primaryLocality)}.</p>
<div class="local-cluster-grid">${areaCards}</div>
<p><a href="${esc(hubHref)}">← All ${esc(ctx.serviceName)} locations</a> · <a href="${esc(serviceHref)}">Main service page</a> · <a href="tel:${esc(ctx.profile.phone.replace(/\s/g, ""))}">Call ${esc(ctx.profile.displayPhone || ctx.profile.phone)}</a></p>
</div></section>`,
  ].join("\n");

  return baseShell({
    ctx,
    title: `${ctx.serviceName} ${cluster.name} cluster | ${ctx.profile.pharmacyName}`,
    metaDescription: `${ctx.profile.pharmacyName} — ${ctx.serviceName} district cluster for ${cluster.name}.`,
    bodyMain,
    pageKind: "location-cluster",
    dataSlug: cluster.slug,
  });
}
