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
  resolvePageComponents,
  resolvePageComponentDna,
} from "./pharmacyBrandDnaComponentRenderers.ts";
import {
  CLINICAL_PATIENT_TEMPLATE_ATTR,
  clinicalPatientTemplateHeadAssets,
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
  return `<div class="clinical-section-head mb-8">${heading ? `<h2 class="text-[#1E293B] font-semibold">${esc(heading)}</h2>` : ""}${lead ? `<p class="text-slate-600 leading-relaxed mt-2">${esc(lead)}</p>` : ""}</div>`;
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

/** Visual wrapper for Gemini `localIntroduction` — sits under the hero, not inside the hospitals directory. */
function renderLocalIntroductionWrapper(body: string, evidence: string[] = []): string {
  const paragraphs = bodyToParagraphs(body);
  if (!paragraphs.length) return "";
  const evidenceAttr = evidence.length ? ` data-locality-evidence="${esc(evidence.join("|"))}"` : "";
  return `<section id="cluster-local-introduction" class="local-introduction py-10 bg-white" data-template-block="local-introduction" data-content-field="localIntroduction"${evidenceAttr}>
<div class="wrap px-6">
<div class="local-introduction-wrapper clinical-callout bg-slate-50 rounded-2xl border-l-4 border-[#10B981] p-8 shadow-sm">
${paragraphs.map((p) => `<p class="text-slate-600 leading-relaxed">${esc(p)}</p>`).join("\n")}
</div>
</div>
</section>`;
}

function clusterBreadcrumb(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): string {
  const serviceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });
  void hierarchy;
  return `<nav class="local-breadcrumb wrap px-6 py-4 text-sm text-slate-500" aria-label="Breadcrumb" data-template-block="breadcrumbs"><a class="text-[#10B981] font-semibold" href="${esc(serviceHref)}">${esc(ctx.serviceName)}</a> <span aria-hidden="true">›</span> <span class="text-[#1E293B]">${esc(cluster.name)}</span></nav>`;
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
            `<a class="area-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6" href="${esc(publicHref(ctx, resolveLocalAreaTarget(a.slug, a.name)))}"><h3 class="text-[#1E293B] font-semibold">${esc(ctx.serviceName)} in ${esc(a.name)}</h3><p class="text-slate-600">${esc(`Guidance for patients living in or travelling from ${a.name}.`)}</p></a>`,
        )
        .join("\n")
    : supporting
        .map((item) => {
          const list = item.bullets?.length
            ? `<ul class="clean">${item.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
            : "";
          return `<article class="area-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6" data-locality-evidence="${esc(item.evidence)}"><h3 class="text-[#1E293B] font-semibold">${esc(item.title)}</h3>${item.body ? `<p class="text-slate-600">${esc(item.body)}</p>` : ""}${list}</article>`;
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
  const hasMarkers = /%%[A-Z_]+%%/.test(introText);
  const steps = (content.base.processSteps || []).filter((step) =>
    Boolean(String(step.title || "").trim() || String(step.body || "").trim() || (step.bullets || []).length),
  );
  const fallbackSteps =
    steps.length > 0
      ? steps
      : supporting
          .filter((item) => item.title || item.body)
          .map((item) => ({ title: item.title, body: item.body, bullets: item.bullets }))
          .concat(
            steps.length || supporting.length || hasMarkers
              ? []
              : bodyToParagraphs(introText).map((paragraph, index) => ({
                  title: `Step ${index + 1}`,
                  body: paragraph,
                })),
          );
  const introHtml =
    hasMarkers && fallbackSteps.length
      ? ""
      : hasMarkers || (!fallbackSteps.length && introText.trim())
        ? lockedJourney
          ? `<p class="text-slate-600 leading-relaxed">${esc(introText)}</p>`
          : bodyToParagraphs(introText)
              .map((p) => `<p class="text-slate-600 leading-relaxed">${esc(p)}</p>`)
              .join("\n")
        : "";
  const extraHtml =
    lockedJourney || !(childAreas.length && !direct)
      ? ""
      : `<div class="areas-grid grid grid-cols-1 md:grid-cols-2 gap-6">${cards}</div>`;
  const timelineItems = fallbackSteps
    .map((step) => ({
      title: String(step.title || "").trim(),
      body: String(step.body || "").trim(),
      bullets: (step.bullets || []).map((b) => String(b || "").trim()).filter(Boolean),
    }))
    .filter((step) => step.title || step.body || step.bullets.length);
  const timeline = timelineItems.length
    ? `<ol class="clinical-timeline mt-6" data-clinical-timeline="true">
${timelineItems
  .map((step, index) => {
    const body = step.body ? `<p class="text-slate-600 leading-relaxed">${esc(step.body)}</p>` : "";
    const list = step.bullets.length
      ? `<ul class="clean mt-2">${step.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : "";
    return `<li class="clinical-timeline-item flex items-start gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
<span class="clinical-step-badge inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#10B981] text-white font-semibold" aria-hidden="true">${index + 1}</span>
<div class="clinical-timeline-body">
${step.title ? `<h3 class="text-[#1E293B] font-semibold">${esc(step.title)}</h3>` : ""}
${body}
${list}
</div>
</li>`;
  })
  .join("\n")}
</ol>`
    : "";
  return `<section class="soft py-10 bg-white" id="child-areas" data-template-block="child-areas" data-locality-evidence="${esc(
    (content.base.sectionEvidence?.supporting || []).join("|"),
  )}">
<div class="wrap px-6">
${renderSectionHead(heading, "")}
${introHtml}
${hasMarkers && fallbackSteps.length ? `<div hidden data-strategy-markers="true">${esc(introText)}</div>` : ""}
${timeline}
${extraHtml}
</div>
</section>`;
}

function renderServiceHubCtaSection(
  ctx: ContentGenerationContext,
  conversionImageHtml: string,
): string {
  return renderApprovedBankServiceHubCtaHtml(ctx.serviceName, ctx.serviceId, conversionImageHtml);
}

/**
 * Visible Local Patient Copy V1 next step.
 * ctaPhonePrompt is the synthesised nextStep. The shared service-hub CTA is not this copy.
 */
function renderVisibleLocalPatientNextStep(nextStep: string): string {
  const text = String(nextStep || "").trim();
  if (!text) return "";
  return `<section data-template-block="local-next-step" id="local-next-step" class="py-8 bg-white">
<div class="wrap px-6">
<p class="locality-cta-context bg-slate-50 border-l-4 border-[#10B981] rounded-2xl p-6 text-slate-600" data-locality-cta>${esc(text)}</p>
</div>
</section>`;
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
  return `<section class="cluster-link-band soft py-10 bg-white" data-template-block="parent-child-links" data-locality-evidence="${esc(
    (content.base.sectionEvidence?.internalLinks || []).join("|"),
  )}">
<div class="wrap px-6">
${renderSectionHead(relatedHeading, "")}
<ul class="clean grid grid-cols-1 md:grid-cols-2 gap-3">${links}</ul>
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
    ? `<ul class="trust-safety-list mt-4">${bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";
  const tag = registered ? "" : `<span class="tag text-[#10B981] font-semibold uppercase tracking-wide text-sm">Service experience</span>\n`;
  const proseHtml = registered
    ? bodyToParagraphs(proseText).map((p) => `<p class="text-slate-600 leading-relaxed">${esc(p)}</p>`).join("\n")
    : proseText
      ? `<p class="text-slate-600 leading-relaxed">${esc(proseText)}</p>`
      : "";
  return `<section class="about py-10 bg-white" id="cluster-trust" data-template-block="trust-split">
<div class="wrap px-6">
<div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center trust-split-row">
<div class="trust-prose">
${tag}<h2 class="text-[#1E293B] font-semibold">${esc(title)}</h2>
${proseHtml}
${listHtml}
</div>
<div class="trust-media rounded-2xl overflow-hidden shadow-sm">${trustImageHtml}</div>
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
        `<div class="cluster-faq-item faq-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6"><h3 class="faq-q text-[#1E293B] font-semibold">${esc(f.question)}</h3><p class="faq-a text-slate-600 leading-relaxed">${esc(f.answer)}</p></div>`,
    )
    .join("\n");
  if (!items) return "";
  return `<section class="faq py-10 bg-white" id="faq-section" data-template-block="faq">
<div class="wrap px-6">${renderSectionHead(faqHeading, "")}<div class="grid grid-cols-1 md:grid-cols-2 gap-6">${items}</div></div>
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
  imageCtx.pageSlug = resolveClusterPageSlug(cluster.slug) || cluster.slug;
  const heroImageHtml = renderLocalityHeroImagePanel({
    tenantSlug: key,
    serviceId: ctx.serviceId,
    areaSlug: resolveClusterPageSlug(cluster.slug) || cluster.slug,
    areaName: cluster.name,
    imageCtx,
  }).html;
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
  const hero = `<section class="hero bg-white py-12 md:py-16" id="hero-section" data-template-block="hero" data-component-variant="${esc(components.heroVariant || "clinical-split")}">
<div class="wrap grid grid-cols-1 md:grid-cols-2 gap-10 items-center hero-grid hero-grid--split-left px-6">
<div class="hero-copy">
<div class="eyebrow text-[#10B981] font-semibold tracking-wide uppercase text-sm">${esc(servicePageHeroEyebrow(ctx, renderProfile, ctx.serviceName))}</div>
<h1 class="text-[#1E293B]">${esc(
    geminiHeroHeading
      ? geminiHeroHeading
      : lockedJourney
        ? `${ctx.serviceName} — ${cluster.name}`
        : `${ctx.serviceName} for patients from ${cluster.name}`,
  )}</h1>
<p class="text-slate-600 text-lg leading-relaxed">${esc(content.base.heroIntro.split(/\n\n+/)[0] || content.base.heroIntro)}</p>
<div class="btns flex flex-wrap gap-3">
<a class="btn bg-[#10B981] text-white rounded-full shadow-xl" href="${esc(primaryCtaHref)}">${esc(ctaLabel)}</a>
${
  directionsUrl
    ? `<a class="btn secondary bg-white text-[#1E293B] rounded-full px-6" href="${esc(directionsUrl)}">${esc(
        usesApprovedBankLocalLayout(ctx.serviceId) ? content.base.ctaSecondary || "Get directions" : "Get directions",
      )}</a>`
    : ""
}
</div>
</div>
<div class="hero-media">
<div class="clinical-hero-frame rounded-2xl overflow-hidden shadow-xl ring-1">${heroImageHtml}</div>
</div>
</div>
</section>`;

  const registered = usesApprovedBankLocalLayout(ctx.serviceId);
  const localIntroduction = renderLocalIntroductionWrapper(
    content.base.localRelevanceBody,
    content.base.sectionEvidence?.["local-introduction"] || [],
  );
  const hasDirectoryCopy =
    Boolean(String(content.relevanceHeading || "").trim()) ||
    Boolean(String(content.base.localRelevanceIntro || "").trim()) ||
    content.base.localRelevanceBullets.length > 0;
  const overviewBullets = registered ? content.base.whyChecksBullets || [] : [];
  const serviceCards: Array<{ title: string; body: string }> = [];
  if (String(content.clusterContextIntro || "").trim()) {
    serviceCards.push({ title: "", body: String(content.clusterContextIntro).trim() });
  }
  for (const paragraph of bodyToParagraphs(content.clusterContextBody)) {
    if (paragraph.trim()) serviceCards.push({ title: "", body: paragraph.trim() });
  }
  for (const bullet of overviewBullets) {
    if (String(bullet || "").trim()) serviceCards.push({ title: "", body: String(bullet).trim() });
  }
  const clusterContext =
    !String(content.clusterContextHeading || "").trim() && !serviceCards.length
      ? ""
      : `<section id="cluster-context" class="py-10 bg-white" data-template-block="service-definition">
<div class="wrap px-6">
${renderSectionHead(String(content.clusterContextHeading || "").trim(), "")}
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
${serviceCards
  .map(
    (card, index) => `<article class="clinical-service-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
<h3 class="text-[#10B981] text-sm font-semibold uppercase tracking-wide">Point ${index + 1}</h3>
<p class="text-slate-600 leading-relaxed">${esc(card.body)}</p>
</article>`,
  )
  .join("\n")}
</div>
</div>
</section>`;
  const childAreas = renderChildAreasSection(ctx, hierarchy, cluster, content.childAreasIntro, content);
  const hospitalsHeading =
    String(content.relevanceHeading || "").trim() || `Hospitals and GP practices in ${cluster.name}`;
  const relevance = hasDirectoryCopy
    ? `<section class="blue-band py-10 bg-slate-50" id="cluster-relevance" data-template-block="local-relevance">
<div class="wrap px-6">
${renderSectionHead(hospitalsHeading, content.base.localRelevanceIntro)}
<div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
<div class="rounded-2xl overflow-hidden shadow-sm">${supportingImageHtml}</div>
${
  lockedJourney || !content.base.localRelevanceBullets.length
    ? ""
    : `<ul class="clean bg-white rounded-2xl border border-slate-200 shadow-sm p-6">${content.base.localRelevanceBullets.map((b) => `<li class="text-slate-600">${esc(b)}</li>`).join("")}</ul>`
}
</div>
</div>
</section>`
    : `<section class="blue-band py-10 bg-slate-50" id="cluster-relevance" data-template-block="local-relevance">
<div class="wrap px-6">${renderSectionHead(hospitalsHeading, "")}<div class="rounded-2xl overflow-hidden shadow-sm">${supportingImageHtml}</div></div>
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
  const localNextStep = lockedJourney ? "" : renderVisibleLocalPatientNextStep(content.base.ctaPhonePrompt);
  const closing = registered
    ? renderServiceHubCtaSection(ctx, conversionImageHtml)
    : `${buildProfileFinalCtaHtml(ctx.serviceName, renderProfile, conversionImageHtml, "", "", ctx)}`;
  // Approved visual stack: hero + localIntroduction, What [Service] is, What happens next,
  // then remaining blocks, with Hospitals and GP practices last. Arrangement copy is unchanged.
  const main = [
    hero,
    localIntroduction,
    clusterContext,
    childAreas,
    localNextStep,
    preparation,
    trust,
    access,
    links,
    faq,
    closing,
    relevance,
  ].join("\n");

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
${clinicalPatientTemplateHeadAssets()}
</head>
<body ${visualServicePageBodyAttributes(ctx.serviceId)} ${componentDnaBodyAttributes(componentDna)} class="bg-white" ${CLINICAL_PATIENT_TEMPLATE_ATTR} data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-local-page-kind="location-cluster" data-local-page-contract="${LOCAL_CLUSTER_CONTRACT_ID}" data-publish-source="local-cluster-v1" data-local-cluster="${esc(cluster.slug)}" data-local-section-arrangement="" data-location-component="${HOMEPAGE_LOCATION_COMPONENT_ID}"${registered ? ` data-approved-bank-locality-contract="approved-bank-locality-page-v1"` : ""}>
${renderPharmacyServicePageHeader(renderProfile, theme)}
<main id="main-content" class="bg-white">
${clusterBreadcrumb(ctx, hierarchy, cluster)}
${main}
</main>
${renderPharmacyServicePageFooter(renderProfile, ctx.serviceName, theme)}
</body>
</html>`;

  assertLocalPageContractOrThrow(html, LOCAL_CLUSTER_V1_CONTRACT);
  return html;
}
