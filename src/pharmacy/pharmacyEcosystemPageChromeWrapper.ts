/**
 * Wrap existing ecosystem long-form HTML with canonical Brand DNA + Component DNA site chrome.
 */
import * as cheerio from "cheerio";
import {
  buildPharmacyServicePageStyleBlock,
  renderPharmacyServicePageFooter,
  renderPharmacyServicePageHeader,
} from "./pharmacyServicePageDesignSystem.ts";
import { applyBrandDnaToServicePageProfile, buildGoogleFontsLink, buildPharmacyThemeWithBrandDna } from "./pharmacyBrandDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { resolvePageComponentDna } from "./pharmacyBrandDnaComponentRenderers.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyVisualServicePageRenderer.ts";
import { CANONICAL_RENDER_VERSION } from "./pharmacyCanonicalFinalRenderConfig.ts";
import { resolveServicePageTemplateId } from "./pharmacyTenantDnaRenderActivation.ts";
import { resolvePharmacyImageWithAssignments } from "./pharmacyImageAssignmentResolver.ts";
import type { PharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";
import { renderResolvedImageSlotHtml } from "./pharmacyImageSlotRenderHelpers.ts";

function escAttr(s: string): string {
  return esc(s);
}

function renderEcosystemSlotImage(
  slug: string,
  pageSlug: string,
  serviceId: string,
  slot: PharmacyImageSlot,
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
  serviceName: string,
): string {
  const resolved = resolvePharmacyImageWithAssignments(slug, slot, {
    slug,
    pageSlug,
    templateFamilyKey: "clinical-nhs-services",
    serviceKey: serviceId,
    serviceName,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    previewBasePath: "/assets",
    visualDemoMode: true,
    previewMode: false,
    campaignId: serviceId,
  });
  if (!resolved.assetExists || !resolved.assetPath || resolved.source === "website-import") return "";
  const panelClass = slot === "hero" ? "hero-image-wrap eco-hero-media" : "image-panel eco-editorial-media";
  const figureClass = slot === "hero" ? `eco-image-slot eco-image-slot--${slot}` : undefined;
  return renderResolvedImageSlotHtml(resolved, slot, panelClass, { figureClass });
}

function injectEcosystemContentImages(
  bodyHtml: string,
  slug: string,
  pageSlug: string,
  serviceId: string,
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
  serviceName: string,
): string {
  const $ = cheerio.load(`<div id="eco-root">${bodyHtml}</div>`, null, false);
  const supportImage = renderEcosystemSlotImage(slug, pageSlug, serviceId, "support", profile, serviceName);
  const ctaImage = renderEcosystemSlotImage(slug, pageSlug, serviceId, "conversion", profile, serviceName);

  const prose = $("#eco-root .eco-prose").first();
  if (prose.length && supportImage) {
    const firstH2 = prose.find("h2").first();
    if (firstH2.length) firstH2.before(supportImage);
    else prose.prepend(supportImage);
  }

  const cta = $("#eco-root .eco-cta").first();
  if (cta.length && ctaImage) {
    cta.prepend(ctaImage);
  }

  return $("#eco-root").html() || bodyHtml;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractPageBody(html: string): { title: string; body: string; schema: string } {
  const $ = cheerio.load(html);
  const title =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "Pharmacy page";
  const schema = $("script[type='application/ld+json']")
    .toArray()
    .map((el) => $.html(el))
    .join("\n");
  const body =
    $("main").first().html()?.trim() ||
    $("article").first().html()?.trim() ||
    $("body").html()?.trim() ||
    html;
  return { title, body, schema };
}

export function wrapEcosystemPageWithSiteChrome(input: {
  slug: string;
  serviceId: string;
  sourceHtml: string;
  pageSlug: string;
}): string {
  const { slug, serviceId, sourceHtml, pageSlug } = input;
  const brandDna = resolveBrandDnaForRender(slug);
  const baseProfile = buildPharmacyServicePageProfile(slug);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna, slug);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || serviceId;
  const extracted = extractPageBody(sourceHtml);
  const header = renderPharmacyServicePageHeader(profile, theme);
  const footer = renderPharmacyServicePageFooter(profile, serviceName, theme);
  const styleBlock = buildPharmacyServicePageStyleBlock(theme);
  const heroImage = renderEcosystemSlotImage(slug, pageSlug, serviceId, "hero", baseProfile, serviceName);
  const bodyWithImages = injectEcosystemContentImages(extracted.body, slug, pageSlug, serviceId, baseProfile, serviceName);

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="index, follow"/>
<title>${esc(extracted.title)}</title>
<meta name="pharmacy-pipeline-version" content="${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}"/>
<meta name="canonical-render-version" content="${esc(CANONICAL_RENDER_VERSION)}"/>
<meta name="final-render-page" content="${esc(pageSlug)}"/>
${extracted.schema}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${styleBlock}
<style>
body[data-publish-source="canonical-ecosystem-page"] main{padding-top:var(--component-section-padding,72px);padding-bottom:var(--component-section-padding,72px)}
body[data-publish-source="canonical-ecosystem-page"] main .wrap{max-width:var(--component-content-max-width,1120px);margin:0 auto;padding:0 20px}
body[data-publish-source="canonical-ecosystem-page"] main h1{color:var(--brand-heading);font-family:var(--font-heading)}
body[data-publish-source="canonical-ecosystem-page"] main p{color:var(--brand-muted);line-height:1.7;font-size:17px}
.eco-image-slot{margin:0 0 28px}
.eco-cta .eco-image-slot,.eco-cta .image-panel{margin:0 0 16px}
.image-panel:has(img),.hero-image-wrap:has(img){background:transparent}
</style>
</head>
<body data-publish-source="canonical-ecosystem-page" data-pharmacy-template="${resolveServicePageTemplateId(slug)}" data-final-render-page="${esc(pageSlug)}" ${componentDnaBodyAttributes(componentDna)}>
${header}
<main id="main-content">
${heroImage}
${bodyWithImages}
</main>
${footer}
</body>
</html>`;
}
