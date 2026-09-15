/**
 * Location hub page renderer — locked local-hub-v1 contract.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import {
  buildPharmacyServicePageStyleBlock,
  PHARMACY_SERVICE_PAGE_TEMPLATE_ID,
  renderPharmacyServicePageFooter,
  renderPharmacyServicePageHeader,
} from "./pharmacyServicePageDesignSystem.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { applyBrandDnaToServicePageProfile, buildPharmacyThemeWithBrandDna, buildGoogleFontsLink } from "./pharmacyBrandDnaResolver.ts";
import {
  ensureBusinessNameInHeading,
  renderBrandHeroComponent,
  resolvePageComponents,
  resolvePageComponentDna,
} from "./pharmacyBrandDnaComponentRenderers.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyThemeEngine.ts";
import { visualServicePageBodyAttributes } from "./pharmacyVisualServicePageRenderer.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { buildImageRenderContext } from "./pharmacyVisualExperience.ts";
import { renderServicePageImagePanel } from "./pharmacyServicePageImageComponent.ts";
import { renderMediaTextSection } from "./pharmacyMediaFloatFlowComponent.ts";
import { splitSentences } from "./pharmacyServicePageBalance.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { pharmacyLocalPageResponsiveStyleBlock } from "./pharmacyLocalPageResponsiveStyles.ts";
import { LOCAL_HUB_CONTRACT_ID, LOCAL_HUB_V1_CONTRACT } from "./pharmacyLocalPageTypeContracts.ts";
import { buildLocalHubPageContent } from "./pharmacyLocalHubClusterContentEngine.ts";
import {
  buildProfileFinalCtaHtml,
  HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID,
  HOMEPAGE_LOCATION_COMPONENT_ID,
  renderHomepageAreasWeSupportSection,
  renderProfileLocalAccessSectionHtml,
} from "./pharmacyServicePageTrustInjection.ts";
import { resolveLocalFaqSectionHeading } from "./pharmacyLocalFaqHeadingResolver.ts";
import { resolveLocalSectionHeading } from "./pharmacyLocalSectionHeadingResolver.ts";
import {
  resolveLocalPagePublicPath,
  resolveTenantSupportedAreaLinks,
} from "./pharmacyLocalPageUrlResolver.ts";
import {
  preferredServicePageCta,
  servicePageHeroEyebrow,
} from "./pharmacyServicePageIntelligence.ts";
import { localPageTypeTypographyStyleBlock } from "./pharmacyLocalPageTypeTypography.ts";
import { assertLocalPageContractOrThrow } from "./pharmacyLocalPageContractValidation.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hubBreadcrumb(ctx: ContentGenerationContext, hierarchy: LocalLocationHierarchy): string {
  const serviceHref = resolveLocalPagePublicPath({ pageType: "service", localSegment: ctx.serviceId }, ctx.serviceId);
  return `<nav class="local-breadcrumb wrap" aria-label="Breadcrumb" data-template-block="breadcrumbs"><a href="${escAttr(serviceHref)}">${esc(ctx.serviceName)}</a> <span aria-hidden="true">›</span> <span>${esc(ctx.serviceName)} locations near ${esc(hierarchy.primaryLocality)}</span></nav>`;
}

function escAttr(s: string): string {
  return esc(s);
}

function renderSectionHead(title: string, intro = ""): string {
  return `<div class="section-head center">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
}

function bodyToParagraphs(body: string): string[] {
  const trimmed = String(body || "").trim();
  if (!trimmed) return [];
  const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  const sentences = splitSentences(trimmed);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks;
}

function renderHubTrustSection(
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
  content: ReturnType<typeof buildLocalHubPageContent>,
  trustImageHtml: string,
): string {
  const title = ensureBusinessNameInHeading(content.base.trustHeading, profile.pharmacyName);
  const intro = content.base.trustIntro?.trim() || content.base.trustBody.split(/\n\n+/)[0] || "";
  const bullets = content.base.trustBullets?.filter(Boolean) ?? [];
  const standardsHtml = bullets.length
    ? `<ul class="clean trust-standards-list">${bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
    : "";
  return `<section class="about" id="hub-trust" data-template-block="trust-split">
<div class="wrap">
<div class="about-card">
<div class="grid-2 trust-split-row">
<div class="trust-prose">
<span class="tag">Trust and credentials</span>
<h2>${esc(title)}</h2>
${intro ? `<p>${esc(intro)}</p>` : ""}
${standardsHtml}
</div>
<div class="trust-media">
<h3>Why choose this pharmacy</h3>
${trustImageHtml}
</div>
</div>
</div>
</div>
</section>`;
}

function renderHubFaqSection(
  content: ReturnType<typeof buildLocalHubPageContent>,
  ctx: ContentGenerationContext,
  hubName: string,
): string {
  const faqHeading = resolveLocalFaqSectionHeading({
    pageType: "location-hub",
    serviceName: ctx.serviceName,
    localityLabel: hubName,
  });
  const items = content.base.faqs
    .slice(0, 6)
    .map(
      (f) =>
        `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(f.question)}</h3><p class="faq-a">${esc(f.answer)}</p></div>`,
    )
    .join("\n");
  return `<section class="faq" id="faq-section" data-template-block="faq">
<div class="wrap">${renderSectionHead(faqHeading, "")}${items}</div>
</section>`;
}

export function renderLocalHubPageHtml(ctx: ContentGenerationContext, hierarchy: LocalLocationHierarchy): string {
  const key = resolveTenantProfileSlug(ctx.resolvedSlug) || ctx.resolvedSlug;
  const baseProfile = ctx.profile ?? buildPharmacyServicePageProfile(key);
  const brandDna = resolveBrandDnaForRender(key);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const components = resolvePageComponents(theme, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna);
  const content = buildLocalHubPageContent(ctx, hierarchy);
  const hubName = hierarchy.primaryLocality;
  const mainServiceHref = resolveLocalPagePublicPath({ pageType: "service", localSegment: ctx.serviceId }, ctx.serviceId);

  const imageCtx = buildImageRenderContext(key, ctx.serviceId as VisualExperienceServiceId);
  imageCtx.location = hubName;
  const heroImageHtml = renderServicePageImagePanel(imageCtx, "hero", "hero-image-wrap hero-media");
  const supportingImageHtml = renderServicePageImagePanel(imageCtx, "support", "image-panel support-block-media");
  const trustImageHtml = renderServicePageImagePanel(imageCtx, "trust", "image-panel trust-block-media");
  const conversionImageHtml = renderServicePageImagePanel(
    imageCtx,
    "conversion",
    "image-panel conversion-feature-image",
  );

  const ctaLabel =
    profile.headerCtaText && !/call pharmacy/i.test(profile.headerCtaText)
      ? profile.headerCtaText
      : preferredServicePageCta(ctx, profile);
  const ctaHref = profile.bookingUrl || mainServiceHref;

  const hero = renderBrandHeroComponent(components, {
    serviceName: ctx.serviceName,
    profile,
    heroImageHtml,
    eyebrow: servicePageHeroEyebrow(ctx, profile, ctx.serviceName),
    headline: `${ctx.serviceName} locations near ${hubName}`,
    intro: content.base.heroIntro.split(/\n\n+/)[0] || content.base.heroIntro,
    primaryCtaLabel: ctaLabel,
    primaryCtaHref: ctaHref,
    secondaryCtaLabel: `Main ${ctx.serviceName} page`,
    secondaryCtaHref: mainServiceHref,
    componentDna,
  });

  const serviceCoverage = renderMediaTextSection({
    sectionId: "hub-service-coverage",
    sectionClass: "blue-band",
    templateBlock: "service-definition",
    headHtml: renderSectionHead(content.serviceCoverageHeading, content.clusterOverviewIntro),
    paragraphs: bodyToParagraphs(content.serviceCoverageBody),
    mediaHtml: "",
    hasImage: false,
    thresholds: componentDna.splitSection.layoutThresholds,
  });

  const supportedLinks = resolveTenantSupportedAreaLinks(ctx, hierarchy, "public");

  const areasWeSupport = renderHomepageAreasWeSupportSection(ctx.serviceName, supportedLinks, {
    heading: resolveLocalSectionHeading({
      kind: "areas-we-support",
      pageType: "location-hub",
      serviceName: ctx.serviceName,
      localityLabel: hubName,
      primaryLocality: hubName,
    }),
    intro: content.areasIntro,
    town: profile.town || hubName,
  });

  const localRelevance = renderMediaTextSection({
    sectionId: "local-relevance",
    sectionClass: "soft",
    templateBlock: "local-relevance",
    headHtml: renderSectionHead(content.base.localRelevanceHeading, content.base.localRelevanceIntro),
    paragraphs: bodyToParagraphs(content.base.localRelevanceBody),
    lists: content.base.localRelevanceBullets.length ? [content.base.localRelevanceBullets] : undefined,
    mediaHtml: supportingImageHtml,
    hasImage: true,
    thresholds: componentDna.splitSection.layoutThresholds,
  });

  const trust = renderHubTrustSection(profile, content, trustImageHtml);
  const access = renderProfileLocalAccessSectionHtml(ctx.serviceName, profile, ctx, {
    title: `${ctx.serviceName} For Patients In ${profile.town || hubName}`,
    town: profile.town || hubName,
    includeCoverageTags: true,
    localAreaLinks: supportedLinks,
  });
  const faq = renderHubFaqSection(content, ctx, hubName);
  const conversionAndCta = buildProfileFinalCtaHtml(ctx.serviceName, profile, conversionImageHtml, "", "", ctx);

  const main = [
    hero,
    serviceCoverage,
    areasWeSupport,
    localRelevance,
    trust,
    access,
    faq,
    conversionAndCta,
  ].join("\n");

  const title = `${ctx.serviceName} locations near ${hubName} | ${profile.pharmacyName}`;
  const metaDesc = `${profile.pharmacyName} — ${ctx.serviceName} location hub for ${hubName}.`;

  let html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}"/>
<meta name="pharmacy-pipeline-version" content="${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}"/>
<meta name="brand-dna-version" content="${esc(BRAND_DNA_VERSION)}"/>
<meta name="local-page-contract" content="${LOCAL_HUB_CONTRACT_ID}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${buildPharmacyServicePageStyleBlock(theme)}
${localPageTypeTypographyStyleBlock()}
${pharmacyLocalPageResponsiveStyleBlock()}
</head>
<body ${visualServicePageBodyAttributes(ctx.serviceId)} ${componentDnaBodyAttributes(componentDna)} data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-local-page-kind="location-hub" data-local-page-contract="${LOCAL_HUB_CONTRACT_ID}" data-publish-source="local-hub-v1" data-areas-we-support-component="${HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID}" data-location-component="${HOMEPAGE_LOCATION_COMPONENT_ID}">
${renderPharmacyServicePageHeader(profile, theme)}
<main id="main-content">
${hubBreadcrumb(ctx, hierarchy)}
${main}
</main>
${renderPharmacyServicePageFooter(profile, ctx.serviceName, theme)}
</body>
</html>`;

  assertLocalPageContractOrThrow(html, LOCAL_HUB_V1_CONTRACT);
  return html;
}
