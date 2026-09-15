/**
 * Pharmacy Publish Output V1 — final static HTML (no preview chrome).
 */
import {
  applySectionBand,
  componentStyles,
  esc,
  inferCtaVariant,
  pickHeroVariant,
  renderCtaBlock,
  renderFaqAccordion,
  renderCoverageAreaGrid,
  renderHeroWithPills,
  renderPreviewFooter,
  renderPreviewSiteHeader,
  renderPreviewTopTrustBar,
  renderSectionComponent,
  renderSectionHeader,
  renderTrustMetrics,
  sectionRhythmClass,
  truncateDisplayText,
  type HeroInput,
} from "./pharmacyComponentLibrary.ts";
import type { GeneratedServiceAreaPage } from "./pharmacyServiceAreaPageGenerator.ts";
import type { GeneratedServicePage } from "./pharmacyServicePageGenerator.ts";

export interface PublishChromeContext {
  slug: string;
  pharmacyName: string;
  town: string;
  phone: string;
  gphcNumber: string;
  yearsServingCommunity: string;
  deliveryAvailable: string[];
  nhsServicesLabel: string;
  localAreas: string[];
}

export interface PublishRenderOptions {
  canonicalUrl: string;
  relatedUrlForService?: (serviceId: string) => string;
  relatedUrlForPageSlug?: (pageSlug: string) => string;
}

function renderSchemaBlock(schema: Record<string, unknown> | undefined): string {
  if (!schema || !Object.keys(schema).length) return "";
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function renderPublishedRelatedServices(
  services: Array<{ serviceId: string; serviceName: string }>,
  urlForService: (serviceId: string) => string,
): string {
  if (!services.length) return "";
  const cards = services
    .map(
      (s) =>
        `<a class="related-card" href="${esc(urlForService(s.serviceId))}">${esc(s.serviceName)}</a>`,
    )
    .join("\n");

  return `<section class="section-block" data-component="related-services">
  <div class="wrap">
    ${renderSectionHeader("More services", "Related Pharmacy Services", "Explore other pharmacy services available at your local branch.")}
    <div class="related-grid related-grid--4">${cards}</div>
  </div>
</section>`;
}

function renderPublishedAreaRelatedServices(
  page: GeneratedServiceAreaPage,
  urlForPageSlug: (pageSlug: string) => string,
): string {
  if (!page.relatedServices?.length) return "";
  const cards = page.relatedServices
    .map(
      (s) =>
        `<a class="related-card" href="${esc(urlForPageSlug(s.pageSlug))}">${esc(s.serviceName)} <span class="muted">· ${esc(page.area)}</span></a>`,
    )
    .join("\n");

  return `<section class="section-block" data-component="related-services">
  <div class="wrap">
    ${renderSectionHeader("More services", `Related services in ${esc(page.area)}`, `Other pharmacy services for patients in ${esc(page.area)}.`)}
    <div class="related-grid related-grid--4">${cards}</div>
  </div>
</section>`;
}

function publishHead(page: { metaTitle: string; metaDescription: string }, canonicalUrl: string, schema?: Record<string, unknown>): string {
  return `<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(page.metaTitle)}</title>
<meta name="description" content="${esc(page.metaDescription)}"/>
<link rel="canonical" href="${esc(canonicalUrl)}"/>
${renderSchemaBlock(schema)}
${componentStyles()}`;
}

export function renderPublishedServicePage(
  page: GeneratedServicePage,
  ctx: PublishChromeContext & { relatedServices: Array<{ serviceId: string; serviceName: string }> },
  options: PublishRenderOptions,
): string {
  const skipTypes = new Set(["hero", "cta", "faqs", "relatedServices"]);
  const bodySections = page.sections.filter((s) => !skipTypes.has(s.type));

  const heroSection = page.sections.find((s) => s.type === "hero");
  const heroInput: HeroInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    h1: page.h1,
    intro: truncateDisplayText(page.intro, 280),
    primaryCta: page.cta.primary,
    secondaryCta: page.cta.secondary,
    variant: pickHeroVariant(page.serviceId),
    serviceName: page.serviceName,
    serviceId: page.serviceId,
    localAreas: ctx.localAreas,
    phone: ctx.phone,
    pills: heroSection?.bullets || [],
  };

  const chromeInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    phone: ctx.phone,
    gphcNumber: ctx.gphcNumber,
    serviceName: page.serviceName,
  };

  const sectionCtx = {
    serviceId: page.serviceId,
    serviceName: page.serviceName,
    slug: ctx.slug,
    town: ctx.town,
    localAreas: ctx.localAreas,
    pharmacyName: ctx.pharmacyName,
  };

  const hasCoverageSection = bodySections.some((s) => s.type === "localRelevance" || s.type === "localExpansion");
  const urlForService = options.relatedUrlForService || ((id: string) => `${options.canonicalUrl.replace(/\/$/, "")}/${id}/`.replace(/([^:]\/)\/+/g, "$1"));

  const coverageHtml = hasCoverageSection
    ? ""
    : renderCoverageAreaGrid({
        heading: "Local Pharmacy Access",
        body: ctx.localAreas.length
          ? `${ctx.pharmacyName} provides ${page.serviceName.toLowerCase()} for patients in ${ctx.town}, including ${ctx.localAreas.slice(0, 3).join(", ")}.`
          : `${ctx.pharmacyName} provides ${page.serviceName.toLowerCase()} for patients in ${ctx.town} and surrounding areas.`,
        town: ctx.town,
        localAreas: ctx.localAreas,
        pharmacyName: ctx.pharmacyName,
      });

  const faqHtml = renderFaqAccordion(page.faqs);
  const relatedHtml = renderPublishedRelatedServices(ctx.relatedServices, urlForService);

  const sectionsHtml = [
    ...bodySections.map((s) => renderSectionComponent(s, sectionCtx)),
    coverageHtml,
    faqHtml,
    relatedHtml,
  ]
    .filter(Boolean)
    .map((html, i) => applySectionBand(html, sectionRhythmClass(i)))
    .join("\n");

  const ctaSection = page.sections.find((s) => s.type === "cta");
  const ctaHtml = renderCtaBlock({
    heading: ctaSection?.heading || page.cta.bookingPrompt || `Contact ${ctx.pharmacyName}`,
    body:
      ctaSection?.body ||
      page.cta.phonePrompt ||
      `Visit ${ctx.pharmacyName} in ${ctx.town} for ${page.serviceName.toLowerCase()}.`,
    primary: page.cta.primary,
    secondary: page.cta.secondary,
    variant: inferCtaVariant(page.cta.primary),
    phone: ctx.phone,
    anchor: "contact",
  });

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
${publishHead(page, options.canonicalUrl, page.schema)}
</head>
<body>
${renderPreviewTopTrustBar(chromeInput)}
${renderPreviewSiteHeader(chromeInput)}
${renderHeroWithPills(heroInput, heroInput.pills || [])}
${renderTrustMetrics({
  yearsServingCommunity: ctx.yearsServingCommunity,
  nhsServicesLabel: ctx.nhsServicesLabel,
  gphcNumber: ctx.gphcNumber,
  deliveryAvailable: ctx.deliveryAvailable,
  town: ctx.town,
})}
<main>
  ${sectionsHtml}
</main>
${ctaHtml}
${renderPreviewFooter(chromeInput)}
</body>
</html>`;
}

export function renderPublishedAreaPage(
  page: GeneratedServiceAreaPage,
  ctx: PublishChromeContext & { area: string },
  options: PublishRenderOptions,
): string {
  const skipTypes = new Set(["cta", "faqs", "relatedServices"]);
  const bodySections = page.sections.filter((s) => !skipTypes.has(s.type));

  const heroInput: HeroInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    h1: page.h1,
    intro: truncateDisplayText(page.intro, 280),
    primaryCta: page.cta.primary,
    secondaryCta: page.cta.secondary,
    variant: pickHeroVariant(page.serviceId),
    serviceName: page.serviceName,
    serviceId: page.serviceId,
    localAreas: ctx.localAreas,
    phone: ctx.phone,
    pills: [`${page.area} patients`, ctx.town, page.serviceName],
  };

  const chromeInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    phone: ctx.phone,
    gphcNumber: ctx.gphcNumber,
    serviceName: `${page.serviceName} — ${page.area}`,
  };

  const sectionCtx = {
    serviceId: page.serviceId,
    serviceName: page.serviceName,
    slug: ctx.slug,
    town: ctx.town,
    localAreas: ctx.localAreas,
    pharmacyName: ctx.pharmacyName,
  };

  const hasCoverage = bodySections.some((s) =>
    ["localRelevance", "nearbyAreas", "localServiceIntro", "localContext", "whyThisArea"].includes(s.type),
  );

  const urlForPageSlug =
    options.relatedUrlForPageSlug ||
    ((slug: string) => {
      const base = options.canonicalUrl.replace(/\/[^/]+\/?$/, "");
      return `${base}/${slug}/`;
    });

  const coverageHtml = hasCoverage
    ? ""
    : renderCoverageAreaGrid({
        heading: `Local access from ${page.area}`,
        body: `${ctx.pharmacyName} provides ${page.serviceName.toLowerCase()} for patients in ${page.area} and ${ctx.town}.`,
        town: ctx.town,
        localAreas: ctx.localAreas,
        pharmacyName: ctx.pharmacyName,
      });

  const sectionsHtml = [
    ...bodySections.map((s) => renderSectionComponent(s, sectionCtx)),
    coverageHtml,
    renderFaqAccordion(page.faqs),
    renderPublishedAreaRelatedServices(page, urlForPageSlug),
  ]
    .filter(Boolean)
    .map((html, i) => applySectionBand(html, sectionRhythmClass(i)))
    .join("\n");

  const ctaHtml = renderCtaBlock({
    heading: `Contact ${ctx.pharmacyName} — ${page.area}`,
    body: page.cta.phonePrompt || page.cta.bookingPrompt,
    primary: page.cta.primary,
    secondary: page.cta.secondary,
    variant: inferCtaVariant(page.cta.primary),
    phone: ctx.phone,
    anchor: "contact",
  });

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
${publishHead(page, options.canonicalUrl, page.schema)}
</head>
<body>
${renderPreviewTopTrustBar(chromeInput)}
${renderPreviewSiteHeader(chromeInput)}
${renderHeroWithPills(heroInput, heroInput.pills || [])}
${renderTrustMetrics({
  yearsServingCommunity: ctx.yearsServingCommunity,
  nhsServicesLabel: ctx.nhsServicesLabel,
  gphcNumber: ctx.gphcNumber,
  deliveryAvailable: ctx.deliveryAvailable,
  town: ctx.town,
})}
<main>
  ${sectionsHtml}
</main>
${ctaHtml}
${renderPreviewFooter(chromeInput)}
</body>
</html>`;
}
