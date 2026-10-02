/**
 * Location area page renderer — locked local-area-v1 contract (same architecture as cluster v1).
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalAreaEvidenceRecord, LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
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
  resolvePageComponents,
  resolvePageComponentDna,
} from "./pharmacyBrandDnaComponentRenderers.ts";
import {
  CLINICAL_PATIENT_TEMPLATE_ATTR,
  clinicalPatientTemplateHeadAssets,
  renderClinicalHero,
  renderClinicalLocalIntroduction,
  renderClinicalProcessTimeline,
  renderClinicalServiceDefinitionSection,
} from "./pharmacyClinicalPatientTemplate.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyThemeEngine.ts";
import { visualServicePageBodyAttributes } from "./pharmacyVisualServicePageRenderer.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { buildImageRenderContext } from "./pharmacyVisualExperience.ts";
import { renderServicePageImagePanel } from "./pharmacyServicePageImageComponent.ts";
import { renderLocalityHeroImagePanel } from "./pharmacyLocalityHeroImageResolver.ts";
import { renderMediaTextSection } from "./pharmacyMediaFloatFlowComponent.ts";
import { splitSentences } from "./pharmacyServicePageBalance.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { pharmacyLocalPageResponsiveStyleBlock } from "./pharmacyLocalPageResponsiveStyles.ts";
import { LOCAL_AREA_CONTRACT_ID, LOCAL_AREA_V1_CONTRACT } from "./pharmacyLocalPageTypeContracts.ts";
import { buildLocalAreaPageContent } from "./pharmacyLocalHubClusterContentEngine.ts";
import {
  buildProfileFinalCtaHtml,
  HOMEPAGE_LOCATION_COMPONENT_ID,
  renderProfileLocalAccessSectionHtml,
} from "./pharmacyServicePageTrustInjection.ts";
import { resolveLocalFaqSectionHeading } from "./pharmacyLocalFaqHeadingResolver.ts";
import {
  resolveLocalClusterTarget,
  resolveLocalPagePublicPath,
  resolveTenantSupportedAreaLinks,
} from "./pharmacyLocalPageUrlResolver.ts";
import {
  preferredServicePageCta,
  resolveContactCtaHref,
  servicePageHeroEyebrow,
} from "./pharmacyServicePageIntelligence.ts";
import { localPageTypeTypographyStyleBlock } from "./pharmacyLocalPageTypeTypography.ts";
import { assertLocalPageContractOrThrow } from "./pharmacyLocalPageContractValidation.ts";
import { usesApprovedBankLocalityDirectPath, renderApprovedBankServiceHubCtaHtml, renderApprovedBankLocalityPreparationHtml } from "./pharmacyApprovedBankLocalityDirectRender.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publicHref(ctx: ContentGenerationContext, target: Parameters<typeof resolveLocalPagePublicPath>[0]): string {
  return resolveLocalPagePublicPath(target, ctx.serviceId);
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

function renderLocalIntroductionWrapper(body: string): string {
  return renderClinicalLocalIntroduction(bodyToParagraphs(body));
}

function areaBreadcrumb(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  area: LocalAreaEvidenceRecord,
  parentCluster: LocalAreaEvidenceRecord,
): string {
  const serviceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });
  const clusterHref = publicHref(ctx, resolveLocalClusterTarget(parentCluster.slug, parentCluster.name));
  void hierarchy;
  return `<nav class="local-breadcrumb wrap" aria-label="Breadcrumb" data-template-block="breadcrumbs"><a href="${esc(serviceHref)}">${esc(ctx.serviceName)}</a> <span aria-hidden="true">›</span> <a href="${esc(clusterHref)}">${esc(parentCluster.name)}</a> <span aria-hidden="true">›</span> <span>${esc(area.name)}</span></nav>`;
}

function renderAreaTrustSection(
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
  content: ReturnType<typeof buildLocalAreaPageContent>,
  trustImageHtml: string,
  registered: boolean,
): string {
  const title = registered
    ? content.base.trustHeading
    : ensureBusinessNameInHeading(content.base.trustHeading, profile.pharmacyName);
  const intro = content.base.trustIntro?.trim() || "";
  const proseHtml = registered
    ? bodyToParagraphs(content.base.trustBody).map((p) => `<p>${esc(p)}</p>`).join("\n")
    : `<p>${esc(intro || content.base.trustBody.split(/\n\n+/)[0] || "")}</p>`;
  const tag = registered ? "" : `<span class="tag">Service experience</span>\n`;
  const bullets = registered && content.base.trustBullets?.length
    ? `<ul class="trust-safety-list">${content.base.trustBullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";
  return `<section class="about" id="cluster-trust" data-template-block="trust-split">
<div class="wrap">
<div class="grid-2 trust-split-row">
<div class="trust-prose">
${tag}<h2>${esc(title)}</h2>
${proseHtml}
${bullets}
</div>
<div class="trust-media">${trustImageHtml}</div>
</div>
</div>
</section>`;
}

function renderAreaFaqSection(
  content: ReturnType<typeof buildLocalAreaPageContent>,
  ctx: ContentGenerationContext,
  areaName: string,
): string {
  const faqHeading = usesApprovedBankLocalityDirectPath(ctx.serviceId)
    ? `Common ${ctx.serviceName} questions`
    : resolveLocalFaqSectionHeading({
        pageType: "location-area",
        serviceName: ctx.serviceName,
        localityLabel: areaName,
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

export function renderLocalAreaPageHtml(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  area: LocalAreaEvidenceRecord,
): string {
  const parentCluster = hierarchy.clusters.find((c) => c.areaId === area.parentAreaId);
  if (!parentCluster) {
    throw new Error(`Local area "${area.name}" has no parent cluster in hierarchy`);
  }

  const key = resolveTenantProfileSlug(ctx.resolvedSlug) || ctx.resolvedSlug;
  const baseProfile = ctx.profile ?? buildPharmacyServicePageProfile(key);
  const brandDna = resolveBrandDnaForRender(key);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const components = resolvePageComponents(theme, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna);
  const content = buildLocalAreaPageContent(ctx, hierarchy, area);
  const supportedLinks = resolveTenantSupportedAreaLinks(ctx, hierarchy, "public");
  const mainServiceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });

  const imageCtx = buildImageRenderContext(key, ctx.serviceId as VisualExperienceServiceId);
  imageCtx.location = area.name;
  imageCtx.pageSlug = area.slug;
  const heroImageHtml = renderLocalityHeroImagePanel({
    tenantSlug: key,
    serviceId: ctx.serviceId,
    areaSlug: area.slug,
    areaName: area.name,
    imageCtx,
  }).html;
  const supportingImageHtml = renderServicePageImagePanel(imageCtx, "support", "image-panel support-block-media");
  const trustImageHtml = renderServicePageImagePanel(imageCtx, "trust", "image-panel trust-block-media");
  const conversionImageHtml = renderServicePageImagePanel(
    imageCtx,
    "conversion",
    "image-panel conversion-feature-image",
  );

  const registered = usesApprovedBankLocalityDirectPath(ctx.serviceId);
  const ctaLabel = registered
    ? content.base.ctaPrimary || "Contact the pharmacy"
    : profile.headerCtaText && !/call pharmacy/i.test(profile.headerCtaText)
      ? profile.headerCtaText
      : preferredServicePageCta(ctx, profile);

  const directionsDestination =
    profile.googlePlaceId
      ? `place_id:${profile.googlePlaceId}`
      : profile.fullAddress ||
        [profile.addressLine1, profile.town, profile.postcode].filter(Boolean).join(", ");
  const directionsUrl = directionsDestination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsDestination)}`
    : "";

  const hero = renderClinicalHero({
    eyebrow: servicePageHeroEyebrow(ctx, profile, ctx.serviceName),
    headline: registered
      ? `${ctx.serviceName} for patients from ${area.name}`
      : `${ctx.serviceName} in ${area.name}`,
    intro: content.base.heroIntro.split(/\n\n+/)[0] || content.base.heroIntro,
    primaryCtaLabel: ctaLabel,
    primaryCtaHref: registered
      ? resolveContactCtaHref(profile, ctaLabel) || mainServiceHref
      : profile.bookingUrl || mainServiceHref,
    secondaryCtaLabel: registered
      ? directionsUrl
        ? content.base.ctaSecondary || "Get directions"
        : undefined
      : `${parentCluster.name} cluster`,
    secondaryCtaHref: registered
      ? directionsUrl || undefined
      : publicHref(ctx, resolveLocalClusterTarget(parentCluster.slug, parentCluster.name)),
    heroImageHtml,
    componentVariant: components.heroVariant,
  });

  const areaOverviewBullets = registered ? content.base.whyChecksBullets || [] : [];
  const localIntroduction = renderLocalIntroductionWrapper(content.base.localRelevanceBody);
  const areaContext = renderClinicalServiceDefinitionSection({
    heading: content.clusterContextHeading,
    paragraphs: bodyToParagraphs(content.clusterContextBody),
    bullets: areaOverviewBullets,
  });

  const hospitalsHeading =
    String(content.relevanceHeading || "").trim() || `Hospitals and GP practices in ${area.name}`;
  const relevance = renderMediaTextSection({
    sectionId: "cluster-relevance",
    sectionClass: "blue-band",
    templateBlock: "local-relevance",
    headHtml: renderSectionHead(hospitalsHeading, content.base.localRelevanceIntro),
    paragraphs: [],
    lists: content.base.localRelevanceBullets.length ? [content.base.localRelevanceBullets] : undefined,
    mediaHtml: supportingImageHtml,
    hasImage: true,
    thresholds: componentDna.splitSection.layoutThresholds,
  });
  const processSteps = (content.base.processSteps || []).filter((step) =>
    Boolean(String(step.title || "").trim() || String(step.body || "").trim()),
  );
  const process = registered
    ? renderClinicalProcessTimeline({
        heading: content.base.processHeading || "What happens next",
        steps: processSteps.length
          ? processSteps
          : (content.base.supportingItems || []).map((item) => ({
              title: item.title,
              body: item.body,
              bullets: item.bullets,
            })),
      })
    : "";
  const preparation = registered
    ? renderApprovedBankLocalityPreparationHtml({
        heading: content.base.clinicalEnvironmentHeading,
        body: content.base.clinicalEnvironmentBody,
        bullets: content.base.preparationBullets,
      })
    : "";
  const trust = renderAreaTrustSection(profile, content, trustImageHtml, registered);
  const access = renderProfileLocalAccessSectionHtml(ctx.serviceName, profile, ctx, {
    title: registered
      ? content.base.accessHeading || `${ctx.serviceName} for patients from ${area.name}`
      : `${ctx.serviceName} For Patients In ${profile.town || hierarchy.primaryLocality}`,
    town: registered ? area.name : profile.town || hierarchy.primaryLocality,
    includeCoverageTags: true,
    localAreaLinks: supportedLinks,
    intro: registered ? content.base.accessBody : undefined,
  });
  const faq = renderAreaFaqSection(content, ctx, area.name);
  const conversionAndCta = registered
    ? renderApprovedBankServiceHubCtaHtml(ctx.serviceName, ctx.serviceId, conversionImageHtml)
    : buildProfileFinalCtaHtml(ctx.serviceName, profile, conversionImageHtml, "", "", ctx);

  const main = registered
    ? [hero, localIntroduction, areaContext, process, preparation, trust, access, faq, conversionAndCta, relevance].join("\n")
    : [hero, localIntroduction, areaContext, process, trust, access, faq, conversionAndCta, relevance].join("\n");

  const title = `${ctx.serviceName} in ${area.name} | ${profile.pharmacyName}`;
  const metaDesc = `${profile.pharmacyName} — ${ctx.serviceName} for patients in ${area.name}.`;

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
<meta name="local-page-contract" content="${LOCAL_AREA_CONTRACT_ID}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${buildPharmacyServicePageStyleBlock(theme)}
${localPageTypeTypographyStyleBlock()}
${pharmacyLocalPageResponsiveStyleBlock()}
${clinicalPatientTemplateHeadAssets()}
</head>
<body ${visualServicePageBodyAttributes(ctx.serviceId)} ${componentDnaBodyAttributes(componentDna)} class="bg-white" ${CLINICAL_PATIENT_TEMPLATE_ATTR} data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-local-page-kind="location-area" data-local-page-contract="${LOCAL_AREA_CONTRACT_ID}" data-publish-source="local-area-v1" data-local-area="${esc(area.slug)}" data-location-component="${HOMEPAGE_LOCATION_COMPONENT_ID}"${usesApprovedBankLocalityDirectPath(ctx.serviceId) ? ` data-approved-bank-locality-contract="approved-bank-locality-page-v1"` : ""}>
${renderPharmacyServicePageHeader(profile, theme)}
<main id="main-content">
${areaBreadcrumb(ctx, hierarchy, area, parentCluster)}
${main}
</main>
${renderPharmacyServicePageFooter(profile, ctx.serviceName, theme)}
</body>
</html>`;

  assertLocalPageContractOrThrow(html, LOCAL_AREA_V1_CONTRACT);
  return html;
}
