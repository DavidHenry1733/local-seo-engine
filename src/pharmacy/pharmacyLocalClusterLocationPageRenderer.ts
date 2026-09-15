/**
 * Location cluster page renderer — locked local-cluster-v1 contract.
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
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { pharmacyLocalPageResponsiveStyleBlock } from "./pharmacyLocalPageResponsiveStyles.ts";
import { LOCAL_CLUSTER_CONTRACT_ID, LOCAL_CLUSTER_V1_CONTRACT, usesPharmacyFirstPatientJourneyLocalTemplate } from "./pharmacyLocalPageTypeContracts.ts";
import { buildLocalClusterHubPageContent } from "./pharmacyLocalHubClusterContentEngine.ts";
import {
  buildProfileFinalCtaHtml,
  HOMEPAGE_LOCATION_COMPONENT_ID,
  renderProfileLocalAccessSectionHtml,
} from "./pharmacyServicePageTrustInjection.ts";
import { resolveLocalFaqSectionHeading } from "./pharmacyLocalFaqHeadingResolver.ts";
import { resolveLocalSectionHeading } from "./pharmacyLocalSectionHeadingResolver.ts";
import {
  resolveLocalAreaTarget,
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
import { getSessionAiLocalCopy } from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { resolveClusterPageSlug } from "./pharmacyClusterPageUrlResolver.ts";

function usesApprovedBankLocalLayout(serviceId: string): boolean {
  return usesApprovedBankLocalityDirectPath(serviceId) && !usesPharmacyFirstPatientJourneyLocalTemplate(serviceId);
}

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
  const heading = String(title || "").trim();
  const lead = String(intro || "").trim();
  if (!heading && !lead) return "";
  return `<div class="section-head center">${heading ? `<h2>${esc(heading)}</h2>` : ""}${lead ? `<p>${esc(lead)}</p>` : ""}</div>`;
}

function bodyToParagraphs(body: string): string[] {
  const trimmed = String(body || "").trim();
  if (!trimmed) return [];
  const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  // Prefer whitespace-after-terminator splits so distance decimals (4.8 km) stay intact.
  // pharmacyServicePageBalance.splitSentences treats "." inside decimals as boundaries.
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks;
}

function clusterBreadcrumb(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): string {
  const serviceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });
  void hierarchy;
  return `<nav class="local-breadcrumb wrap" aria-label="Breadcrumb" data-template-block="breadcrumbs"><a href="${esc(serviceHref)}">${esc(ctx.serviceName)}</a> <span aria-hidden="true">›</span> <span>${esc(cluster.name)}</span></nav>`;
}

function renderChildAreasSection(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
  intro: string,
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
): string {
  const childAreas = hierarchy.areas.filter((a) => a.parentAreaId === cluster.areaId);
  const supporting = content.base.supportingItems || [];
  const direct = usesApprovedBankLocalLayout(ctx.serviceId);
  const lockedJourney = usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId);
  const cards = lockedJourney
    ? ""
    : childAreas.length && !direct
    ? childAreas
        .map(
          (a) =>
            `<a class="area-card" href="${esc(publicHref(ctx, resolveLocalAreaTarget(a.slug, a.name)))}"><h3>${esc(ctx.serviceName)} in ${esc(a.name)}</h3><p>Guidance for patients living in or travelling from ${esc(a.name)}.</p></a>`,
        )
        .join("\n")
    : supporting
        .map((item) => {
          const list = item.bullets?.length
            ? `<ul class="clean">${item.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
            : "";
          return `<article class="area-card" data-locality-evidence="${esc(item.evidence)}"><h3>${esc(item.title)}</h3>${item.body ? `<p>${esc(item.body)}</p>` : ""}${list}</article>`;
        })
        .join("\n");
  const heading = lockedJourney
    ? content.base.processHeading || `How ${ctx.serviceName} can help`
    : direct
    ? content.base.processHeading || `What happens next`
    : childAreas.length
    ? resolveLocalSectionHeading({
        kind: "child-area-cards",
        pageType: "location-cluster",
        serviceName: ctx.serviceName,
        localityLabel: cluster.name,
      })
    : content.base.supportingHeading ||
      resolveLocalSectionHeading({
        kind: "child-area-cards",
        pageType: "location-cluster",
        serviceName: ctx.serviceName,
        localityLabel: cluster.name,
      });
  const introText = lockedJourney
    ? content.base.processIntro || intro
    : direct
      ? content.base.processIntro || intro
      : intro || content.base.supportingIntro || "";
  const introHtml = lockedJourney
    ? `<p>${esc(introText)}</p>`
    : bodyToParagraphs(introText)
        .map((p) => `<p>${esc(p)}</p>`)
        .join("\n");
  return `<section class="soft" id="child-areas" data-template-block="child-areas" data-locality-evidence="${esc(
    (content.base.sectionEvidence?.supporting || []).join("|"),
  )}">
<div class="wrap">
${renderSectionHead(heading, "")}
${introHtml}
${lockedJourney ? "" : `<div class="areas-grid">${cards || `<article class="area-card"><h3>${esc(cluster.name)}</h3><p>Guidance for patients travelling from ${esc(cluster.name)}.</p></article>`}</div>`}
</div>
</section>`;
}

function renderServiceHubCtaSection(
  ctx: ContentGenerationContext,
  conversionImageHtml: string,
): string {
  return renderApprovedBankServiceHubCtaHtml(ctx.serviceName, ctx.serviceId, conversionImageHtml);
}

function renderClusterLinksSection(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
): string {
  const childAreas = hierarchy.areas.filter((a) => a.parentAreaId === cluster.areaId);
  const rankedFromNearby = content.base.nearbyLocalityLinks?.length
    ? content.base.nearbyLocalityLinks
        .map((n) => hierarchy.clusters.find((c) => c.slug === n.areaSlug || c.name === n.areaName))
        .filter((c): c is NonNullable<typeof c> => Boolean(c) && c.slug !== cluster.slug)
    : [];
  const relatedOnly = usesApprovedBankLocalLayout(ctx.serviceId);
  const lockedJourney = usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId);
  const ranked = relatedOnly
    ? hierarchy.clusters.filter((c) => c.slug !== cluster.slug)
    : rankedFromNearby.length
      ? rankedFromNearby
      : hierarchy.clusters.filter((c) => c.slug !== cluster.slug);
  const serviceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });
  const siblingClusters = hierarchy.clusters.filter((c) => c.slug !== cluster.slug);
  const links = lockedJourney
    ? [
        ...siblingClusters.map(
          (c) =>
            `<li><a href="${esc(publicHref(ctx, resolveLocalClusterTarget(c.slug, c.name)))}">${esc(ctx.serviceName)} in ${esc(c.name)}</a></li>`,
        ),
        `<li><a href="${esc(serviceHref)}">${esc(ctx.serviceName)} overview</a></li>`,
      ].join("\n")
    : relatedOnly
    ? ranked
        .map((c) => `<li><a href="${esc(publicHref(ctx, resolveLocalClusterTarget(c.slug, c.name)))}">${esc(ctx.serviceName)} for patients from ${esc(c.name)}</a></li>`)
        .join("\n")
    : [
        `<li><a href="${esc(serviceHref)}">All ${esc(ctx.serviceName)} locations near ${esc(hierarchy.primaryLocality)}</a></li>`,
        ...childAreas.map(
          (a) =>
            `<li><a href="${esc(publicHref(ctx, resolveLocalAreaTarget(a.slug, a.name)))}">${esc(ctx.serviceName)} in ${esc(a.name)}</a></li>`,
        ),
        ...ranked.slice(0, 4).map((c) => {
          return `<li><a href="${esc(publicHref(ctx, resolveLocalClusterTarget(c.slug, c.name)))}">${esc(ctx.serviceName)} in ${esc(c.name)}</a></li>`;
        }),
        `<li><a href="${esc(serviceHref)}">${esc(ctx.serviceName)} overview</a></li>`,
      ].join("\n");
  const relatedHeading = lockedJourney
    ? `Nearby areas we also help`
    : relatedOnly
    ? `Other ${ctx.serviceName} locality pages`
    : resolveLocalSectionHeading({
        kind: "related-locations",
        pageType: "location-cluster",
        serviceName: ctx.serviceName,
        localityLabel: cluster.name,
      });
  return `<section class="cluster-link-band soft" data-template-block="parent-child-links" data-locality-evidence="${esc(
    (content.base.sectionEvidence?.internalLinks || []).join("|"),
  )}">
<div class="wrap">
${renderSectionHead(relatedHeading, "")}
<ul class="clean">${links}</ul>
</div>
</section>`;
}

/** Split flattened bank safety bullets (short Title-case fragments) into a designed list. */
function splitTrustProseAndBullets(trustBody: string, explicitBullets?: string[]): { prose: string; bullets: string[] } {
  const explicit = (explicitBullets || []).map((b) => String(b || "").trim()).filter(Boolean);
  if (explicit.length) {
    return { prose: String(trustBody || "").trim(), bullets: explicit };
  }
  const raw = String(trustBody || "").trim();
  if (!raw) return { prose: "", bullets: [] };
  const parts = raw.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return { prose: raw, bullets: [] };
  const shortTail: string[] = [];
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const p = parts[i]!.replace(/[.!?]+$/, "").trim();
    const isShortFragment = p.length > 0 && p.length <= 48 && !/,/.test(p) && /^[A-Z]/.test(p);
    if (!isShortFragment) break;
    shortTail.unshift(p);
  }
  if (shortTail.length < 2) return { prose: raw, bullets: [] };
  const prose = parts.slice(0, parts.length - shortTail.length).join(" ").trim();
  return { prose: prose || raw, bullets: shortTail };
}

function renderClusterTrustSection(
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
  trustImageHtml: string,
  registered: boolean,
): string {
  const title = content.base.trustHeading || "When to seek further medical help";
  const intro = content.base.trustIntro?.trim() || "";
  const { prose, bullets } = splitTrustProseAndBullets(
    intro ? "" : content.base.trustBody,
    content.base.trustBullets,
  );
  const proseText = registered
    ? content.base.trustBody
    : intro || prose || content.base.trustBody.split(/\n\n+/)[0] || "";
  const listHtml = bullets.length
    ? `<ul class="trust-safety-list">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";
  const tag = registered ? "" : `<span class="tag">Service experience</span>\n`;
  const proseHtml = registered
    ? bodyToParagraphs(proseText).map((p) => `<p>${esc(p)}</p>`).join("\n")
    : proseText
      ? `<p>${esc(proseText)}</p>`
      : "";
  return `<section class="about" id="cluster-trust" data-template-block="trust-split">
<div class="wrap">
<div class="grid-2 trust-split-row">
<div class="trust-prose">
${tag}<h2>${esc(title)}</h2>
${proseHtml}
${listHtml}
</div>
<div class="trust-media">${trustImageHtml}</div>
</div>
</div>
</section>`;
}

function renderClusterFaqSection(
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
  ctx: ContentGenerationContext,
  clusterName: string,
): string {
  const faqHeading = usesApprovedBankLocalLayout(ctx.serviceId)
    ? `Common ${ctx.serviceName} questions`
    : resolveLocalFaqSectionHeading({
        pageType: "location-cluster",
        serviceName: ctx.serviceName,
        localityLabel: clusterName,
      });
  const items = content.base.faqs
    .slice(0, 6)
    .filter((f) => String(f.question || "").trim() && String(f.answer || "").trim())
    .map(
      (f) =>
        `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(f.question)}</h3><p class="faq-a">${esc(f.answer)}</p></div>`,
    )
    .join("\n");
  if (!items) return "";
  return `<section class="faq" id="faq-section" data-template-block="faq">
<div class="wrap">${renderSectionHead(faqHeading, "")}${items}</div>
</section>`;
}

export function renderLocalClusterLocationPageHtml(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): string {
  const key = resolveTenantProfileSlug(ctx.resolvedSlug) || ctx.resolvedSlug;
  const baseProfile = ctx.profile ?? buildPharmacyServicePageProfile(key);
  const brandDna = resolveBrandDnaForRender(key);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const components = resolvePageComponents(theme, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna);
  const content = buildLocalClusterHubPageContent(ctx, hierarchy, cluster);
  const supportedLinks = resolveTenantSupportedAreaLinks(ctx, hierarchy, "public");
  const mainServiceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });

  const imageCtx = buildImageRenderContext(key, ctx.serviceId as VisualExperienceServiceId);
  imageCtx.location = cluster.name;
  const heroImageHtml = renderServicePageImagePanel(imageCtx, "hero", "hero-image-wrap hero-media");
  const supportingImageHtml = renderServicePageImagePanel(imageCtx, "support", "image-panel support-block-media");
  const trustImageHtml = renderServicePageImagePanel(imageCtx, "trust", "image-panel trust-block-media");
  const conversionImageHtml = renderServicePageImagePanel(
    imageCtx,
    "conversion",
    "image-panel conversion-feature-image",
  );

  const lockedJourney = usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId);
  const completePremisesAddress = String(profile.displayAddress || "").trim();
  const renderProfile =
    lockedJourney && completePremisesAddress
      ? { ...profile, customerFacingAddress: completePremisesAddress, displayAddress: completePremisesAddress }
      : profile;
  const ctaLabel = lockedJourney
    ? preferredServicePageCta(ctx, renderProfile)
    : usesApprovedBankLocalLayout(ctx.serviceId)
      ? content.base.ctaPrimary || "Contact the pharmacy"
      : preferredServicePageCta(ctx, renderProfile);
  const primaryCtaHref = lockedJourney
    ? mainServiceHref
    : resolveContactCtaHref(renderProfile, ctaLabel) || mainServiceHref;
  const directionsDestination =
    renderProfile.displayAddress ||
    renderProfile.customerFacingAddress ||
    renderProfile.fullAddress ||
    (renderProfile.googlePlaceId ? `place_id:${renderProfile.googlePlaceId}` : "") ||
    [renderProfile.addressLine1, renderProfile.town, renderProfile.postcode].filter(Boolean).join(", ");
  const directionsUrl = directionsDestination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsDestination)}`
    : "";

  const overlayCopy = getSessionAiLocalCopy(resolveClusterPageSlug(cluster.slug));
  const geminiHeroHeading =
    overlayCopy && String(overlayCopy.heroIntroduction || "").trim()
      ? `${ctx.serviceName} in ${cluster.name}`
      : "";
  const hero = renderBrandHeroComponent(components, {
    serviceName: ctx.serviceName,
    profile: renderProfile,
    heroImageHtml,
    eyebrow: servicePageHeroEyebrow(ctx, renderProfile, ctx.serviceName),
    headline: geminiHeroHeading
      ? geminiHeroHeading
      : lockedJourney
        ? `${ctx.serviceName} — ${cluster.name}`
        : `${ctx.serviceName} for patients from ${cluster.name}`,
    intro: content.base.heroIntro.split(/\n\n+/)[0] || content.base.heroIntro,
    primaryCtaLabel: ctaLabel,
    primaryCtaHref,
    secondaryCtaLabel: directionsUrl
      ? usesApprovedBankLocalLayout(ctx.serviceId)
        ? content.base.ctaSecondary || "Get directions"
        : "Get directions"
      : undefined,
    secondaryCtaHref: directionsUrl || undefined,
    componentDna,
  });

  const hasLocalRelevanceCopy =
    Boolean(String(content.relevanceHeading || "").trim()) ||
    Boolean(String(content.base.localRelevanceIntro || "").trim()) ||
    Boolean(String(content.base.localRelevanceBody || "").trim()) ||
    content.base.localRelevanceBullets.length > 0;

  const registered = usesApprovedBankLocalLayout(ctx.serviceId);
  const overviewBullets = registered && content.base.whyChecksBullets.length
    ? `<ul class="clean">${content.base.whyChecksBullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";
  const contextHead = renderSectionHead(content.clusterContextHeading, content.clusterContextIntro);
  const contextParas = bodyToParagraphs(content.clusterContextBody)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("\n");
  const contextInner = [contextHead, contextParas, overviewBullets].filter(Boolean).join("\n");
  const clusterContext = contextInner
    ? `<section id="cluster-context" data-template-block="service-definition">
<div class="wrap">
${contextInner}
</div>
</section>`
    : "";
  const childAreas = renderChildAreasSection(ctx, hierarchy, cluster, content.childAreasIntro, content);
  const relevance = hasLocalRelevanceCopy
    ? renderMediaTextSection({
        sectionId: "cluster-relevance",
        sectionClass: "blue-band",
        templateBlock: "local-relevance",
        headHtml: renderSectionHead(content.relevanceHeading, content.base.localRelevanceIntro),
        paragraphs: bodyToParagraphs(content.base.localRelevanceBody),
        lists: lockedJourney
          ? undefined
          : content.base.localRelevanceBullets.length
            ? [content.base.localRelevanceBullets]
            : undefined,
        mediaHtml: supportingImageHtml,
        hasImage: true,
        thresholds: componentDna.splitSection.layoutThresholds,
      })
    : `<section class="blue-band" id="cluster-relevance" data-template-block="local-relevance">
<div class="wrap">${supportingImageHtml}</div>
</section>`;
  const preparation = registered
    ? renderApprovedBankLocalityPreparationHtml({
        heading: content.base.clinicalEnvironmentHeading,
        body: content.base.clinicalEnvironmentBody,
        bullets: content.base.preparationBullets,
      })
    : "";
  const trust = renderClusterTrustSection(renderProfile, content, trustImageHtml, registered);
  const access = renderProfileLocalAccessSectionHtml(ctx.serviceName, renderProfile, ctx, {
    title: content.base.accessHeading || `Travelling from ${cluster.name}`,
    town: cluster.name,
    includeCoverageTags: !lockedJourney,
    localAreaLinks: lockedJourney ? [] : supportedLinks,
    intro: content.base.accessBody,
  });
  const links = renderClusterLinksSection(ctx, hierarchy, cluster, content);
  const faq = renderClusterFaqSection(content, ctx, cluster.name);
  const conversionAndCta = registered
    ? renderServiceHubCtaSection(ctx, conversionImageHtml)
    : `${buildProfileFinalCtaHtml(ctx.serviceName, renderProfile, conversionImageHtml, "", "", ctx)}${
        !lockedJourney && content.base.ctaPhonePrompt
          ? `<p class="locality-cta-context wrap" data-locality-cta>${esc(content.base.ctaPhonePrompt)}</p>`
          : ""
      }`;

  const main = registered
    ? [hero, clusterContext, relevance, childAreas, preparation, trust, faq, access, conversionAndCta, links].join("\n")
    : [hero, clusterContext, childAreas, relevance, trust, access, links, faq, conversionAndCta].join("\n");

  const title =
    content.base.seoTitle || `${ctx.serviceName} in ${cluster.name} | ${profile.pharmacyName}`;
  const metaDesc =
    content.base.metaDescription ||
    `${profile.pharmacyName} provides ${ctx.serviceName} for patients in ${cluster.name}.`;

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
<meta name="local-page-contract" content="${LOCAL_CLUSTER_CONTRACT_ID}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${buildPharmacyServicePageStyleBlock(theme)}
${localPageTypeTypographyStyleBlock()}
${pharmacyLocalPageResponsiveStyleBlock()}
</head>
<body ${visualServicePageBodyAttributes(ctx.serviceId)} ${componentDnaBodyAttributes(componentDna)} data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-local-page-kind="location-cluster" data-local-page-contract="${LOCAL_CLUSTER_CONTRACT_ID}" data-publish-source="local-cluster-v1" data-local-cluster="${esc(cluster.slug)}" data-location-component="${HOMEPAGE_LOCATION_COMPONENT_ID}"${registered ? ` data-approved-bank-locality-contract="approved-bank-locality-page-v1"` : ""}>
${renderPharmacyServicePageHeader(renderProfile, theme)}
<main id="main-content">
${clusterBreadcrumb(ctx, hierarchy, cluster)}
${main}
</main>
${renderPharmacyServicePageFooter(renderProfile, ctx.serviceName, theme)}
</body>
</html>`;

  assertLocalPageContractOrThrow(html, LOCAL_CLUSTER_V1_CONTRACT);
  return html;
}
