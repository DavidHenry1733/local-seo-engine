/**
 * Pharmacy Service Hub Preview Renderer V1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPharmacyProfile,
  loadPharmacyContentBlueprint,
} from "./pharmacyContentBlueprintService.ts";
import {
  applySectionBand,
  componentStyles,
  esc,
  inferCtaVariant,
  pickHeroVariant,
  renderCtaBlock,
  renderDefaultContentCard,
  renderFaqAccordion,
  renderHeroWithPills,
  renderMythVsFactComponent,
  renderPreviewFooter,
  renderPreviewSiteHeader,
  renderPreviewTopTrustBar,
  renderSectionComponent,
  renderSectionHeader,
  renderTrustMetrics,
  sectionRhythmClass,
  publishBodyText,
  truncateDisplayText,
  type HeroInput,
} from "./pharmacyComponentLibrary.ts";
import {
  assembleBodyBlocksWithMapModule,
  pharmacyMapModuleStyles,
  renderPharmacyMapModuleForSlug,
} from "./pharmacyMapModule.ts";
import {
  enhanceTrustSchemaForSlug,
  injectTrustLayerAfterMap,
  pharmacyTrustLayerStyles,
  renderPharmacyTrustLayerForSlug,
} from "./pharmacyTrustLayer.ts";
import { PUBLISHED_SITE_BASE } from "./pharmacyPublishedPagePolish.ts";
import { publishHeroIntro } from "./pharmacySafeText.ts";
import { alignPageFaqsForPublish, syncSchemaFaqs } from "./pharmacyFaqAlignment.ts";
import { usesHubPublishFramework } from "./pharmacyHubFramework.ts";
import { loadGeneratedServicePage } from "./pharmacyServicePageGenerator.ts";
import type { GeneratedServiceHub } from "./pharmacyServiceHubGenerator.ts";
import { serviceHubPageSlug } from "./pharmacyServiceHubGenerator.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const HUB_PREVIEW_ROOT = path.join(WORKSPACE_ROOT, "output/pharmacy-hub-preview-v1");

export interface HubPreviewContext {
  slug: string;
  pharmacyName: string;
  town: string;
  phone: string;
  gphcNumber: string;
  yearsServingCommunity: string;
  deliveryAvailable: string[];
  nhsServicesLabel: string;
  baseUrl: string;
}

export interface HubPreviewIndexEntry {
  serviceId: string;
  serviceName: string;
  pageSlug: string;
  previewPath: string;
  wordCount: number;
  coverageAreaCount: number;
  generatedAt: string;
}

function resolveBaseUrl(slug: string): string {
  const profile = loadPharmacyProfile(slug);
  const website = String(profile.data?.website || "").trim();
  if (website) return website.replace(/\/$/, "");
  return PUBLISHED_SITE_BASE;
}

export function buildHubPreviewContext(slug: string): HubPreviewContext {
  const profile = loadPharmacyProfile(slug);
  const data = profile.data || {};
  const blueprint = loadPharmacyContentBlueprint(slug);
  const deliveryRaw = data.deliveryAvailable;
  const deliveryAvailable = Array.isArray(deliveryRaw)
    ? deliveryRaw.map(String)
    : deliveryRaw
      ? [String(deliveryRaw)]
      : [];

  return {
    slug,
    pharmacyName: String(data.pharmacyName || data.tradingName || blueprint?.pharmacyName || "Your Pharmacy").trim(),
    town: String(data.townCity || blueprint?.primaryLocation || "your area"),
    phone: String(data.phone || ""),
    gphcNumber: String(data.gphcNumber || ""),
    yearsServingCommunity: String(data.yearsServingCommunity || ""),
    deliveryAvailable,
    nhsServicesLabel: "Community pharmacy services",
    baseUrl: resolveBaseUrl(slug),
  };
}

function pageUrl(baseUrl: string, pageSlug: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${pageSlug}/`;
}

export function renderHubCoverageAreasSection(
  hub: GeneratedServiceHub,
  ctx: HubPreviewContext,
  publishMode = false,
): string {
  const cards = hub.coverageAreas
    .map(
      (a) =>
        `<a class="nearby-area-card" href="${esc(pageUrl(ctx.baseUrl, a.pageSlug))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${esc(a.title)}</span></a>`,
    )
    .join("\n");

  const gridClass =
    hub.coverageAreas.length <= 2
      ? "nearby-area-grid nearby-area-grid--2"
      : "nearby-area-grid nearby-area-grid--4";

  const section = hub.sections.find((s) => s.type === "coverageAreas");
  return `<section class="section-block" data-section-type="coverageAreas">
  <div class="wrap">
    ${renderSectionHeader("Coverage areas", section?.heading || `Local ${hub.serviceName} Pages`, section?.body ? (publishMode ? publishBodyText(section.body) : truncateDisplayText(section.body, 260)) : undefined)}
    <div class="${gridClass}">${cards}</div>
  </div>
</section>`;
}

export function renderHubRelatedServicesSection(
  hub: GeneratedServiceHub,
  ctx: HubPreviewContext,
  publishMode = false,
): string {
  if (!hub.relatedHubs.length) return "";
  const cards = hub.relatedHubs
    .map(
      (h) =>
        `<a class="related-card" href="${esc(pageUrl(ctx.baseUrl, h.pageSlug))}">${esc(h.title)}</a>`,
    )
    .join("\n");

  const gridClass =
    hub.relatedHubs.length <= 2
      ? "related-grid related-grid--2"
      : hub.relatedHubs.length === 4
        ? "related-grid related-grid--4"
        : "related-grid related-grid--6";

  const section = hub.sections.find((s) => s.type === "relatedServices");
  return `<section class="section-block" data-component="related-services">
  <div class="wrap">
    ${renderSectionHeader("Related hubs", section?.heading || "Other Pharmacy Service Hubs", section?.body ? (publishMode ? publishBodyText(section.body) : truncateDisplayText(section.body, 220)) : undefined)}
    <div class="${gridClass}">${cards}</div>
  </div>
</section>`;
}

export function renderServiceHubBackLink(
  serviceId: string,
  serviceName: string,
  slug: string,
  previewMode = true,
  baseUrl?: string,
): string {
  const hubSlug = serviceHubPageSlug(serviceId);
  const href = previewMode
    ? `/pharmacy-hub-preview-v1/${slug}/${serviceId}/`
    : pageUrl(baseUrl || PUBLISHED_SITE_BASE, hubSlug);
  return `<p class="hub-back-link"><a class="contextual-link contextual-link--hub" href="${esc(href)}">← ${esc(serviceName)} Hub</a></p>`;
}

function renderHubSection(
  hub: GeneratedServiceHub,
  section: GeneratedServiceHub["sections"][number],
  ctx: HubPreviewContext,
  publishMode = false,
): string {
  if (section.type === "coverageAreas" || section.type === "relatedServices") return "";
  if (section.type === "mythVsFact") {
    return renderMythVsFactComponent(
      {
        type: section.type,
        heading: section.heading,
        body: section.body,
        bullets: section.bullets || [],
      },
      hub.serviceId,
      publishMode,
    );
  }
  if (section.type === "conversionNextStep" || section.type === "conversionReassurance") {
    return renderSectionComponent(
      {
        type: section.type,
        heading: section.heading,
        body: section.body,
        bullets: section.bullets || [],
      },
      {
        serviceId: hub.serviceId,
        serviceName: hub.serviceName,
        slug: ctx.slug,
        town: ctx.town,
        localAreas: hub.coverageAreas.map((a) => a.area),
        pharmacyName: ctx.pharmacyName,
        phone: ctx.phone,
        businessEmail: hub.cta.businessEmail,
        bookingUrl: hub.cta.bookingUrl,
        publishMode,
      },
    );
  }
  return renderDefaultContentCard(
    {
      type: section.type,
      heading: section.heading,
      body: section.body,
      bullets: section.bullets || [],
    },
    "",
    publishMode,
    {
      serviceName: hub.serviceName,
      serviceId: hub.serviceId,
      pharmacyName: ctx.pharmacyName,
      town: ctx.town,
      sectionType: section.type,
      goldStandard: publishMode && usesHubPublishFramework(hub.serviceId),
    },
  );
}

function renderPublishedHubFooter(input: {
  pharmacyName: string;
  town: string;
  phone: string;
  gphcNumber: string;
}): string {
  const phoneHtml = input.phone
    ? `<p><a href="tel:${esc(input.phone.replace(/\s/g, ""))}">${esc(input.phone)}</a></p>`
    : "";
  const gphcHtml = input.gphcNumber ? `<p>GPhC Reg. ${esc(input.gphcNumber)}</p>` : "";
  return `<footer class="preview-footer">
<div class="preview-footer-inner">
<div>
<h3>${esc(input.pharmacyName)}</h3>
<p>Your local community pharmacy in ${esc(input.town)}.</p>
</div>
<div>
<h3>Contact</h3>
${phoneHtml}
${gphcHtml}
<p><a href="#contact">Speak to the pharmacy team</a></p>
</div>
</div>
</footer>`;
}

function buildHubSectionsHtml(hub: GeneratedServiceHub, ctx: HubPreviewContext, publishMode: boolean): string {
  const bodySections = hub.sections.filter(
    (s) => !["coverageAreas", "relatedServices"].includes(s.type),
  );
  const mapHtml = renderPharmacyMapModuleForSlug(ctx.slug);
  const trustHtml = renderPharmacyTrustLayerForSlug(ctx.slug);
  const hubFaqs = publishMode && usesHubPublishFramework(hub.serviceId)
    ? hub.faqs
    : publishMode
      ? alignPageFaqsForPublish(
          hub.faqs,
          {
            serviceId: hub.serviceId,
            serviceName: hub.serviceName,
            pharmacyName: ctx.pharmacyName,
            town: ctx.town,
          },
          loadGeneratedServicePage(ctx.slug, hub.serviceId)?.faqs,
        )
      : hub.faqs;

  return injectTrustLayerAfterMap(
    [
      ...assembleBodyBlocksWithMapModule(bodySections, (s) => renderHubSection(hub, s, ctx, publishMode), mapHtml),
      renderHubCoverageAreasSection(hub, ctx, publishMode),
    ],
    trustHtml,
  ).concat([
    renderFaqAccordion(hubFaqs, "Frequently Asked Questions", publishMode),
    renderHubRelatedServicesSection(hub, ctx, publishMode),
  ])
    .filter(Boolean)
    .map((html, i) => applySectionBand(html, sectionRhythmClass(i)))
    .join("\n");
}

function buildHubCtaHtml(hub: GeneratedServiceHub, ctx: HubPreviewContext, publishMode: boolean) {
  const heroCtaLabels = publishMode
    ? [hub.cta.primary, hub.cta.secondary].map((v) => String(v || "").trim()).filter(Boolean)
    : [];
  const uniqueHero = heroCtaLabels.filter((v, i) => heroCtaLabels.indexOf(v) === i);
  const nextStep = hub.sections.find((s) => s.type === "conversionNextStep");

  return renderCtaBlock({
    heading: nextStep?.heading || hub.cta.bookingPrompt || `Contact ${ctx.pharmacyName} — ${hub.serviceName}`,
    body: nextStep?.body || hub.cta.phonePrompt || `Visit ${ctx.pharmacyName} in ${ctx.town} for ${hub.serviceName.toLowerCase()}.`,
    primary: hub.cta.primary,
    secondary: hub.cta.secondary,
    variant: inferCtaVariant(hub.cta.primary),
    phone: ctx.phone,
    email: hub.cta.businessEmail,
    bookingUrl: hub.cta.bookingUrl,
    anchor: "contact",
    publishMode,
    heroCtaLabels: publishMode ? uniqueHero : undefined,
  });
}

export function renderPublishedServiceHubPage(
  hub: GeneratedServiceHub,
  ctx: HubPreviewContext,
  canonicalUrl: string,
): string {
  const heroInput: HeroInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    h1: hub.h1,
    intro: publishHeroIntro(hub.intro),
    primaryCta: hub.cta.primary,
    secondaryCta: hub.cta.secondary,
    variant: pickHeroVariant(hub.serviceId),
    serviceName: hub.serviceName,
    serviceId: hub.serviceId,
    phone: ctx.phone,
    pills: ["Service hub", ctx.town, ...hub.coverageAreas.map((a) => a.area)],
    publishMode: true,
  };

  const chromeInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    phone: ctx.phone,
    gphcNumber: ctx.gphcNumber,
    serviceName: `${hub.serviceName} Hub`,
    homeUrl: `${ctx.baseUrl.replace(/\/$/, "")}/`,
  };

  const sectionsHtml = buildHubSectionsHtml(hub, ctx, true);
  const ctaHtml = buildHubCtaHtml(hub, ctx, true);
  const publishedFaqs = alignPageFaqsForPublish(
    hub.faqs,
    {
      serviceId: hub.serviceId,
      serviceName: hub.serviceName,
      pharmacyName: ctx.pharmacyName,
      town: ctx.town,
    },
    loadGeneratedServicePage(ctx.slug, hub.serviceId)?.faqs,
  );
  const schemaJson = JSON.stringify(enhanceTrustSchemaForSlug(ctx.slug, syncSchemaFaqs(hub.schema, publishedFaqs))).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(hub.metaTitle)}</title>
<meta name="description" content="${esc(hub.metaDescription)}"/>
<link rel="canonical" href="${esc(canonicalUrl)}"/>
<script type="application/ld+json">${schemaJson}</script>
${componentStyles()}
${pharmacyMapModuleStyles()}
${pharmacyTrustLayerStyles()}
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
${renderPublishedHubFooter(chromeInput)}
</body>
</html>`;
}

export function renderServiceHubPreview(hub: GeneratedServiceHub, ctx: HubPreviewContext): string {
  const heroInput: HeroInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    h1: hub.h1,
    intro: truncateDisplayText(hub.intro, 300),
    primaryCta: hub.cta.primary,
    secondaryCta: hub.cta.secondary,
    variant: pickHeroVariant(hub.serviceId),
    serviceName: hub.serviceName,
    serviceId: hub.serviceId,
    phone: ctx.phone,
    pills: ["Service hub", ctx.town, ...hub.coverageAreas.map((a) => a.area)],
  };

  const chromeInput = {
    pharmacyName: ctx.pharmacyName,
    town: ctx.town,
    phone: ctx.phone,
    gphcNumber: ctx.gphcNumber,
    serviceName: `${hub.serviceName} Hub`,
  };

  const sectionsHtml = buildHubSectionsHtml(hub, ctx, false);
  const ctaHtml = buildHubCtaHtml(hub, ctx, false);

  const previewUrl = `/pharmacy-hub-preview-v1/${ctx.slug}/${hub.serviceId}/`;
  const schemaJson = JSON.stringify(enhanceTrustSchemaForSlug(ctx.slug, hub.schema)).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(hub.metaTitle)}</title>
<meta name="description" content="${esc(hub.metaDescription)}"/>
<meta name="robots" content="noindex, nofollow"/>
<script type="application/ld+json">${schemaJson}</script>
${componentStyles()}
${pharmacyMapModuleStyles()}
${pharmacyTrustLayerStyles()}
<style>
.preview-banner { background:#fef3c7; border-bottom:1px solid #fcd34d; padding:10px 16px; font-size:.85rem; color:#92400e; }
.preview-banner strong { color:#78350f; }
.hub-back-link { margin: 0 0 16px; font-size: .95rem; }
.hub-back-link a { font-weight: 600; color: var(--nhs-blue); text-decoration: none; }
.hub-back-link a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="preview-banner"><strong>Hub preview</strong> — ${esc(hub.pageSlug)} · ${esc(previewUrl)}</div>
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

export function hubPreviewPath(slug: string, serviceId: string): string {
  return path.join(HUB_PREVIEW_ROOT, slug, serviceId, "index.html");
}

export function generateServiceHubPreviews(
  slug: string,
  hubs: GeneratedServiceHub[],
): { pages: HubPreviewIndexEntry[]; previewRoot: string } {
  const ctx = buildHubPreviewContext(slug);
  const pages: HubPreviewIndexEntry[] = [];

  for (const hub of hubs) {
    const outPath = hubPreviewPath(slug, hub.serviceId);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, renderServiceHubPreview(hub, ctx), "utf8");
    pages.push({
      serviceId: hub.serviceId,
      serviceName: hub.serviceName,
      pageSlug: hub.pageSlug,
      previewPath: path.relative(WORKSPACE_ROOT, outPath),
      wordCount: hub.qualitySignals.wordCount,
      coverageAreaCount: hub.qualitySignals.coverageAreaCount,
      generatedAt: hub.generatedAt,
    });
  }

  return { pages, previewRoot: path.join(HUB_PREVIEW_ROOT, slug) };
}
