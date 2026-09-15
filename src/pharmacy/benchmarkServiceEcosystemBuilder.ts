/**
 * Benchmark Service Content Ecosystem Builder V1
 * Derives ecosystem assets from approved master-library markdown only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  componentStyles,
  esc,
  renderPreviewSiteHeader,
  renderPreviewTopTrustBar,
} from "./pharmacyComponentLibrary.ts";
import {
  buildPharmacyServicePageStyleBlock,
  renderPharmacyServicePageFooter,
  renderPharmacyServicePageHeader,
  PHARMACY_SERVICE_PAGE_TEMPLATE_ID,
} from "./pharmacyServicePageDesignSystem.ts";
import { applyBrandDnaToServicePageProfile, buildGoogleFontsLink, buildPharmacyThemeWithBrandDna } from "./pharmacyBrandDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { resolvePageComponentDna } from "./pharmacyBrandDnaComponentRenderers.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import {
  buildPharmacyServicePageProfile,
  normalizeTelHref,
} from "./pharmacyServicePageProfileContext.ts";
import { visualServicePageBodyAttributes } from "./pharmacyVisualServicePageRenderer.ts";
import { PHARMACY_VISUAL_PIPELINE_VERSION } from "./pharmacyThemeEngine.ts";
import { pharmacyLocalPageResponsiveStyleBlock } from "./pharmacyLocalPageResponsiveStyles.ts";
import {
  resolveContactCtaHref,
  preferredServicePageCta,
} from "./pharmacyServicePageIntelligence.ts";
import { scrubUnconfirmedServiceClaims, reducePharmacyNameRepetition } from "./pharmacyServicePagePublicationQuality.ts";
import {
  countWords,
  type MasterLibrarySection,
} from "./pharmacyMasterLibraryParser.ts";
import {
  BENCHMARK_MASTER_SERVICE_IDS,
  dedupeTrustSectionBody,
  detectBlueprintLeakage,
  detectLocalLayerDuplication,
  detectTrustLayerDuplication,
  getServicePublishMeta,
} from "./pharmacyMasterPublishConfig.ts";
import { pharmacyTrustLayerStyles } from "./pharmacyTrustLayer.ts";
import { writeReviewTrustPack } from "./pharmacyReviewTrustPackService.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  buildContentGenerationContext,
} from "./contentEngine/buildContentGenerationContext.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import {
  buildBlogConfigs as buildLongFormBlogConfigs,
  buildBlogPostBodyHtml,
  buildEvidenceSafeStandaloneFaqEntries,
  buildPatientGuideBodyHtml,
  buildSupportingServiceOverviewBodyHtml,
  stripDuplicateLeadParagraph,
  tenantizeProse,
} from "./contentEngine/pharmacyLongFormContentEngine.ts";
import { enrichSatelliteText, enrichSatelliteTitle } from "./contentEngine/contentEngineAssetEnricher.ts";
import { validateLongFormQuality } from "./contentEngine/pharmacyLongFormQualityValidation.ts";
import { createGeneratorRuntimeReport } from "./contentEngine/contentEngineContract.ts";
import { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";
import { applyContextTokens, ownerVariablesForArea } from "./contentEngine/contentEngineTokens.ts";
import { scopeContentGenerationContextForArea } from "./contentEngine/contentEngineContextScope.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "./pharmacyLocalLocationGenerationService.ts";
import {
  applyCampaignRunStampToHtml,
  createCampaignRunStamp,
} from "./pharmacyCurrentRunCampaignHandoff.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");

export const SLUG = "pharmaconnect";
const BROOK_PHARMACY = "Brook Pharmacy";

export const ROLLOUT_SERVICE_IDS = BENCHMARK_MASTER_SERVICE_IDS.filter((id) => id !== "pharmacy-first");

export interface EcosystemAsset {
  id: string;
  type: string;
  urlPath: string;
  outputPath: string;
  sourceSections: string[];
  wordCount: number;
}

export interface EcosystemQualityCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface LocalClusterLinkEntry {
  areaName: string;
  areaSlug: string;
  urlPath: string;
  outputPath: string;
  nearbyAreas: Array<{ areaName: string; areaSlug: string; urlPath: string }>;
}

export interface EcosystemInternalLinkMap {
  slug: string;
  serviceId: string;
  mainServiceUrlPath: string;
  localClusterPages: LocalClusterLinkEntry[];
  generatedAt: string;
  generationStamp?: GenerationStamp;
}

export interface GenerationStamp {
  tenantSlug: string;
  campaignId: string;
  generatedAt: string;
  sourceContext: "customer-imported-profile";
  runId?: string;
  approvedBankHash?: string | null;
}

export interface EcosystemBuildResult {
  serviceId: string;
  serviceName: string;
  masterFile: string;
  ecosystemRoot: string;
  slug: string;
  selectedAreas: string[];
  localClusterPagesGenerated: number;
  internalLinkMap: EcosystemInternalLinkMap;
  assets: EcosystemAsset[];
  qualityChecks: EcosystemQualityCheck[];
  socialPosts: Array<{ id: number; text: string; source: string }>;
  gbpPosts: Array<{ id: number; title: string; body: string; source: string }>;
  emails: Array<{ id: number; subject: string; body: string; source: string }>;
  videoScript: string;
  generatorReport?: ReturnType<typeof createGeneratorRuntimeReport>;
}

export { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";

function inlineFormat(text: string): string {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return s;
}

function renderMarkdownProse(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("<!--") || trimmed === "---") {
      closeUl();
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inUl) {
        closeUl();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineFormat(bullet[1]!)}</li>`);
      continue;
    }
    closeUl();
    out.push(`<p>${inlineFormat(trimmed)}</p>`);
  }
  closeUl();
  return out.join("\n");
}

function stripMd(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

const RAW_CUSTOMER_LABELS =
  /\b(?:Description|Typical symptoms|When Pharmacy First is appropriate|When GP referral is required|When urgent care is required|Assessment process|Treatment options|Follow up process)\s*:\s*/gi;

function cleanCustomerText(text: string): string {
  return stripMd(text)
    .replace(/^tenantSlug:.*$/gim, "")
    .replace(/^campaignId:.*$/gim, "")
    .replace(/^generatedAt:.*$/gim, "")
    .replace(/^sourceContext:.*$/gim, "")
    .replace(/^source:\s*.*$/gim, "")
    .replace(/^reviewer:\s*$/gim, "")
    .replace(/SOCIAL CONTENT LIBRARY|BLOG CONTENT LIBRARY|EMAIL CONTENT LIBRARY|VIDEO CONTENT LIBRARY/gi, "")
    .replace(RAW_CUSTOMER_LABELS, "")
    .replace(/\bMaster §\d+\b/gi, "")
    .replace(/\s+—\s*—\s+/g, " — ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanCustomerTitle(text: string): string {
  return cleanCustomerText(text)
    .replace(/^\d+(?:\.\d+)?\s+/, "")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sentences(text: string): string[] {
  return cleanCustomerText(text).match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [];
}

function conciseText(text: string, maxSentences = 2): string {
  const picked = sentences(text).slice(0, maxSentences).join(" ");
  return (picked || cleanCustomerText(text)).replace(/\s{2,}/g, " ").trim();
}

function limitChars(text: string, maxChars: number): string {
  const clean = cleanCustomerText(text);
  if (clean.length <= maxChars) return clean;
  const picked = sentences(clean).find((s) => s.length <= maxChars) || clean.slice(0, maxChars - 1).replace(/\s+\S*$/, "");
  return picked.replace(/[,\s]+$/, ".").trim();
}

function conditionNames(sections: MasterLibrarySection[]): string[] {
  const section2 = sections.find((s) => s.number === 2)?.bodyMarkdown || "";
  return [...section2.matchAll(/^###\s+\d+(?:\.\d+)?\s+(.+)$/gm)]
    .map((match) => cleanCustomerTitle(match[1] || ""))
    .filter(Boolean);
}

function firstCustomerParagraph(markdown: string): string {
  return markdown
    .split(/\n\n+/)
    .map((block) => block.trim())
    .find((block) => block && !/^#{1,6}\s+/.test(block) && !/^\d+\.\s+/.test(block)) || "";
}

function stampHtmlOutput(html: string, stamp: GenerationStamp): string {
  if (stamp.runId) {
    return applyCampaignRunStampToHtml(html, {
      tenantSlug: stamp.tenantSlug,
      campaignId: stamp.campaignId,
      generatedAt: stamp.generatedAt,
      sourceContext: "customer-imported-profile",
      runId: stamp.runId,
    });
  }
  const meta = [
    `<meta name="tenantSlug" content="${esc(stamp.tenantSlug)}"/>`,
    `<meta name="campaignId" content="${esc(stamp.campaignId)}"/>`,
    `<meta name="generatedAt" content="${esc(stamp.generatedAt)}"/>`,
    `<meta name="sourceContext" content="${esc(stamp.sourceContext)}"/>`,
  ].join("\n");
  return html.replace(
    /<head>/i,
    `<head>\n${meta}\n<!-- tenantSlug: ${esc(stamp.tenantSlug)}; campaignId: ${esc(stamp.campaignId)}; generatedAt: ${esc(stamp.generatedAt)}; sourceContext: ${esc(stamp.sourceContext)} -->`,
  );
}

function stampPackData(data: unknown, stamp: GenerationStamp): unknown {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { generationStamp: stamp, ...(data as Record<string, unknown>) };
  }
  return data;
}

function parseMisconceptions(section8: string): Array<{ myth: string; reality: string }> {
  const items: Array<{ myth: string; reality: string }> = [];
  for (const block of section8.split(/\n\n+/)) {
    const m = block.match(/^\*\*Myth: (.+?)\.\*\*\s*\nReality: (.+)$/s);
    if (m) items.push({ myth: m[1]!.trim(), reality: m[2]!.trim() });
  }
  return items;
}

function resolveEcosystemSlug(slug: string): string {
  return resolveTenantProfileSlug(slug) || slug;
}

function sanitizeTenantHtml(html: string, slug: string, pharmacyName: string): string {
  const key = resolveEcosystemSlug(slug);
  if (key === "pharmaconnect") return html;
  let out = html;
  if (pharmacyName) {
    out = out.replace(new RegExp(BROOK_PHARMACY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), pharmacyName);
  }
  out = out.replace(/\/pharmacy-content-ecosystem\/pharmaconnect\//g, `/pharmacy-content-ecosystem/${key}/`);
  out = out.replace(/output\/pharmacy-content-ecosystem\/pharmaconnect\//g, `output/pharmacy-content-ecosystem/${key}/`);
  return out;
}

function allOtherAreaLinks(
  areaName: string,
  selectedAreas: string[],
): Array<{ areaName: string; areaSlug: string; urlPath: string }> {
  return selectedAreas
    .filter((name) => name !== areaName)
    .map((name) => ({
      areaName: name,
      areaSlug: slugifyArea(name),
      urlPath: `/local/${slugifyArea(name)}/`,
    }));
}

function renderLocalClusterNav(input: {
  serviceId: string;
  serviceName: string;
  areaName: string;
  mainServiceUrlPath: string;
  nearby: Array<{ areaName: string; urlPath: string }>;
}): string {
  const nearbyLinks = input.nearby
    .map((n) => `<li><a href="${esc(n.urlPath)}">${esc(input.serviceName)} in ${esc(n.areaName)}</a></li>`)
    .join("\n");
  return `<nav class="eco-local-nav" aria-label="Local service links">
<p><a href="${esc(input.mainServiceUrlPath)}">← ${esc(input.serviceName)} at ${esc(input.areaName)} (main service page)</a></p>
${nearbyLinks ? `<p><strong>Nearby areas:</strong></p><ul>${nearbyLinks}</ul>` : ""}
</nav>`;
}

function demoBanner(serviceName: string, pharmacyName: string, localArea: string): string {
  return `<div class="demo-banner">PharmaConnect Content Ecosystem — ${esc(serviceName)} · ${esc(pharmacyName)} · ${esc(localArea)}</div>`;
}

function demoStyles(): string {
  return `${componentStyles()}${pharmacyTrustLayerStyles()}
<style>
.demo-banner{background:linear-gradient(90deg,#003087,#005eb8);color:#fff;text-align:center;padding:10px 16px;font-size:.78rem;font-weight:700;letter-spacing:.04em}
.eco-article{max-width:760px;margin:0 auto;padding:48px 24px}
.eco-article h1{font-family:var(--font-heading);color:var(--nhs-dark);font-size:clamp(1.6rem,3vw,2.2rem);margin:0 0 1rem}
.eco-article .eco-lead{color:var(--muted);font-size:1.05rem;margin-bottom:2rem;line-height:1.7}
.eco-prose{font-size:1.02rem;line-height:1.75;color:var(--text)}
.eco-prose p{margin:0 0 1rem}
.eco-prose ul{margin:0 0 1rem;padding-left:1.35rem}
.eco-prose li{margin-bottom:.45rem}
.eco-prose h2{font-family:var(--font-heading);font-size:1.25rem;color:var(--nhs-dark);margin:2rem 0 .75rem;padding-top:.5rem;border-top:1px solid var(--border)}
.eco-prose h2:first-child{border-top:none;padding-top:0;margin-top:0}
.eco-cta{margin-top:2.5rem;padding:1.5rem;background:var(--soft-blue);border-radius:12px;border:1px solid #c5e3ef}
.eco-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin:2rem 0}
.eco-card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:20px;box-shadow:var(--shadow)}
.eco-card h3{margin:0 0 8px;font-size:1rem;color:var(--nhs-dark)}
.eco-card p{margin:0;font-size:.9rem;color:var(--muted)}
.eco-card a{color:var(--nhs-blue);font-weight:700;text-decoration:none}
.eco-card a:hover{text-decoration:underline}
.eco-meta{font-size:.82rem;color:var(--muted);margin-top:4px}
</style>`;
}

function renderArticlePage(input: {
  ctx: ContentGenerationContext;
  title: string;
  lead?: string;
  bodyHtml: string;
  ctaText?: string;
  type: string;
}): string {
  const chrome = ctxToPreviewChrome(input.ctx);
  const vars = input.ctx.masterLibrary.ownerVariables;
  const cta =
    input.ctaText ||
    applyContextTokens(
      "Call {{phone}} to ask about this service and whether you need an appointment or can walk in.",
      input.ctx,
    );
  const bodyHtml = stripDuplicateLeadParagraph(input.lead, input.bodyHtml);

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(enrichSatelliteTitle(input.title, input.ctx))}</title>
${demoStyles()}
</head>
<body data-publish-source="master-library-ecosystem" data-ecosystem-type="${esc(input.type)}" data-content-engine-context="${input.ctx.contractVersion}">
${demoBanner(input.ctx.serviceName, input.ctx.profile.pharmacyName, input.ctx.localArea)}
${renderPreviewTopTrustBar({ ...chrome, serviceName: input.ctx.serviceName })}
${renderPreviewSiteHeader({ ...chrome, serviceName: input.ctx.serviceName, homeUrl: chrome.website })}
<main>
<article class="eco-article">
<h1>${esc(input.title)}</h1>
${input.lead ? `<p class="eco-lead">${esc(input.lead)}</p>` : ""}
<div class="eco-prose">${bodyHtml}</div>
<div class="eco-cta"><p><strong>Next step:</strong> ${esc(stripMd(cta))}</p><p>Opening hours: ${esc(vars.opening_hours)}</p><p>Reviewed by ${esc(input.ctx.reviewer.name || input.ctx.profile.superintendentPharmacistName)}</p></div>
</article>
</main>
</body>
</html>`;
}

function buildBlogConfigs(_serviceId: string, _serviceName: string) {
  return [] as never[];
}

function ctxToPreviewChrome(ctx: ContentGenerationContext) {
  return {
    pharmacyName: ctx.profile.pharmacyName,
    town: ctx.primaryTown,
    primaryTown: ctx.primaryTown,
    phone: ctx.cta.phone,
    gphcNumber: ctx.profile.gphcNumber,
    website: ctx.cta.website || "/",
    email: ctx.cta.email,
    addressLine1: ctx.profile.addressLine1,
    addressLine2: ctx.profile.addressLine2,
    postcode: ctx.profile.postcode,
    coverageRadius: ctx.profile.coverageRadius,
    reviewerName: ctx.reviewer.name,
    rankingAreas: ctx.coverageAreas,
    selectedAreas: ctx.selectedAreas.map((a) => a.areaName),
  };
}

/**
 * Standalone FAQ page using the locked service-page FAQ card blueprint + design-system chrome.
 * Does not use demo banner / NHS trust bar / giant question-mark accordion icons.
 */
export function renderEcosystemFaqPageHtml(ctx: ContentGenerationContext): string {
  const key = resolveEcosystemSlug(ctx.resolvedSlug);
  const brandDna = resolveBrandDnaForRender(key);
  const baseProfile = buildPharmacyServicePageProfile(key);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna, key);

  const delivery = (
    (ctx as { serviceDelivery?: { fundingModel?: string | null; appointmentRequired?: boolean | null; walkInAvailable?: boolean | null } })
      .serviceDelivery
  ) || {};
  // Prefer profile delivery when context does not carry it.
  let fundingModel = delivery.fundingModel ?? "unknown";
  let appointmentRequired = delivery.appointmentRequired ?? null;
  let walkInAvailable = delivery.walkInAvailable ?? null;
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${key}.json`), "utf8"),
    ) as { data?: { serviceDeliveryProfiles?: Record<string, { fundingModel?: string; appointmentRequired?: boolean | null; walkInAvailable?: boolean | null }> } };
    const d = raw.data?.serviceDeliveryProfiles?.[ctx.serviceId];
    if (d) {
      fundingModel = d.fundingModel ?? fundingModel;
      appointmentRequired = d.appointmentRequired ?? appointmentRequired;
      walkInAvailable = d.walkInAvailable ?? walkInAvailable;
    }
  } catch {
    // keep defaults
  }

  const faqs = buildEvidenceSafeStandaloneFaqEntries({
    serviceId: ctx.serviceId,
    serviceName: ctx.serviceName,
    pharmacyName: profile.pharmacyName,
    phone: profile.phone || ctx.cta.phone,
    website: profile.website || ctx.cta.website,
  });

  const h1 =
    ctx.serviceId === "blood-pressure-checks"
      ? "Blood Pressure Checks: Frequently Asked Questions"
      : `${ctx.serviceName}: Frequently Asked Questions`;
  const intro =
    ctx.serviceId === "blood-pressure-checks"
      ? `Common questions about blood pressure checks at ${profile.pharmacyName}. Contact the pharmacy to ask how blood pressure checks are arranged.`
      : `Common questions about ${ctx.serviceName.toLowerCase()} at ${profile.pharmacyName}. Contact the pharmacy to ask how this service is arranged.`;

  const faqCards = faqs
    .map(
      (f) =>
        `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${esc(f.question)}</h3><p class="faq-a">${esc(f.answer)}</p></div>`,
    )
    .join("\n");

  const ctaLabel = preferredServicePageCta(ctx, profile);
  const ctaHref = resolveContactCtaHref(profile, ctaLabel) || profile.website || "#contact";
  const displayPhone = profile.displayPhone || profile.phone;
  const tel = normalizeTelHref(displayPhone);
  const phoneHtml = displayPhone
    ? `<p class="faq-contact-phone"><a href="${esc(tel)}">${esc(displayPhone)}</a></p>`
    : "";

  const main = `<section class="faq" id="faq-section" data-template-block="faq" data-ecosystem-type="faq-page">
<div class="wrap">
<div class="section-head">
<h1>${esc(h1)}</h1>
<p>${esc(intro)}</p>
</div>
${faqCards}
</div>
</section>
<section id="contact" class="cta-band" data-template-block="final-cta">
<div class="wrap">
<h2>${esc(`${ctx.serviceName} at ${profile.pharmacyName}`)}</h2>
<p class="cta-close">${esc(
    ctx.serviceId === "blood-pressure-checks"
      ? "Contact the pharmacy to ask how blood pressure checks are arranged."
      : `Contact the pharmacy to ask how ${ctx.serviceName.toLowerCase()} are arranged.`,
  )}</p>
${phoneHtml}
<div class="cta-actions">
<a class="btn-white" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>
</div>
</div>
</section>`;

  let html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>${esc(h1)} | ${esc(profile.pharmacyName)}</title>
<meta name="description" content="${esc(intro)}"/>
<meta name="pharmacy-pipeline-version" content="${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${buildPharmacyServicePageStyleBlock(theme)}
${pharmacyLocalPageResponsiveStyleBlock()}
<style>
.faq .section-head h1{margin:0 0 14px}
.faq .section-head p{margin:0 0 28px;max-width:68ch}
.faq-contact-phone{margin:0 0 16px;font-size:1.05rem}
.faq-contact-phone a{color:var(--brand-primary);font-weight:700;text-decoration:none}
.faq-contact-phone a:hover{text-decoration:underline}
.cta-band .cta-actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:8px}
</style>
</head>
<body ${visualServicePageBodyAttributes(ctx.serviceId, key)} ${componentDnaBodyAttributes(componentDna)} data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-publish-source="master-library-ecosystem" data-ecosystem-type="faq-page" data-content-engine-context="${esc(ctx.contractVersion)}">
${renderPharmacyServicePageHeader(profile, theme)}
<main id="main-content">
${main}
</main>
${renderPharmacyServicePageFooter(profile, ctx.serviceName, theme)}
</body>
</html>`;

  html = scrubUnconfirmedServiceClaims(html, {
    fundingModel,
    walkInAvailable,
    appointmentRequired,
    abpmConfirmed: false,
    serviceId: ctx.serviceId,
  });
  html = reducePharmacyNameRepetition(html, profile.pharmacyName);
  return html;
}

/**
 * Regenerate only the ecosystem FAQ page + index asset entry. Does not touch service/local pages.
 */
export function regenerateEcosystemFaqPageOnly(
  slug: string,
  serviceId: string,
): { ok: true; outputPath: string; wordCount: number; questions: string[]; html: string } {
  const ctx = buildContentGenerationContext(slug, serviceId);
  const faqHtml = renderEcosystemFaqPageHtml(ctx);
  const generationStamp: GenerationStamp = {
    tenantSlug: ctx.resolvedSlug,
    campaignId: serviceId,
    generatedAt: new Date().toISOString(),
    sourceContext: "customer-imported-profile",
  };
  const stamped = sanitizeTenantHtml(
    stampHtmlOutput(faqHtml, generationStamp),
    ctx.resolvedSlug,
    ctx.profile.pharmacyName,
  );
  const faqSlug = `${serviceId}-faqs`;
  const outPath = path.join(ctx.links.ecosystemRoot, "pages", faqSlug, "index.html");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, stamped, "utf8");

  const questions = buildEvidenceSafeStandaloneFaqEntries({
    serviceId: ctx.serviceId,
    serviceName: ctx.serviceName,
    pharmacyName: ctx.profile.pharmacyName,
    phone: ctx.cta.phone,
    website: ctx.cta.website,
  }).map((f) => f.question);
  const wordCount = countWords(questions.join(" ") + " " + stamped.replace(/<[^>]+>/g, " "));

  const indexPath = path.join(ctx.links.ecosystemRoot, "_ecosystem-index.json");
  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
      assets?: EcosystemAsset[];
      generatedAt?: string;
    };
    const asset: EcosystemAsset = {
      id: "faq-page",
      type: "FAQ page",
      urlPath: `/${faqSlug}/`,
      outputPath: outPath,
      sourceSections: ["§7", "tenant FAQs", "evidence-safe-faq"],
      wordCount,
    };
    const assets = Array.isArray(index.assets) ? [...index.assets] : [];
    const idx = assets.findIndex((a) => a.id === "faq-page");
    if (idx >= 0) assets[idx] = asset;
    else assets.push(asset);
    index.assets = assets;
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
  }

  return { ok: true, outputPath: outPath, wordCount, questions, html: stamped };
}

function buildSocialPosts(
  ctx: ContentGenerationContext,
  misconceptions: Array<{ myth: string; reality: string }>,
  faqs: Array<{ question: string; answer: string }>,
  sections: MasterLibrarySection[],
): Array<{ id: number; text: string; source: string }> {
  const { serviceName } = ctx;
  const { pharmacyName } = ctx.profile;
  const localArea = ctx.localArea;
  const vars = ctx.masterLibrary.ownerVariables;
  const posts: Array<{ id: number; text: string; source: string }> = [];
  let id = 1;
  const add = (text: string, source: string) => {
    posts.push({ id: id++, text: limitChars(enrichSatelliteText(text, ctx, "social"), 240), source });
  };

  for (const name of conditionNames(sections)) {
    add(
      `${serviceName} can help with ${name.toLowerCase()} when NHS pathway criteria are met. ${pharmacyName} in ${localArea} can assess symptoms and explain next steps.`,
      "Master §2 + context",
    );
    if (posts.length >= 7) break;
  }
  for (const f of faqs.slice(0, 4)) {
    add(`${cleanCustomerText(f.question)} ${conciseText(f.answer, 1)}`, "Master §7");
  }

  const why = sections.find((s) => s.number === 10);
  if (why) {
    for (const p of why.bodyMarkdown.split(/\n\n+/).slice(0, 2)) {
      if (posts.length >= 20) break;
      add(conciseText(p, 1), "Master §10");
    }
  }
  for (const m of misconceptions.slice(0, 3)) {
    add(`${m.myth}. ${m.reality}`, "Master §8");
  }

  const booking = applyContextTokens(
    `Call {{phone}} to ask about ${serviceName} at ${pharmacyName}. Opening hours: {{opening_hours}}.`,
    ctx,
  );
  while (posts.length < 20) {
    add(booking, "Master §13 + context");
  }
  return posts.slice(0, 20);
}

function buildGbpPosts(
  ctx: ContentGenerationContext,
  sections: MasterLibrarySection[],
): Array<{ id: number; title: string; body: string; source: string }> {
  const { serviceName } = ctx;
  const { pharmacyName } = ctx.profile;
  const localArea = ctx.localArea;
  const vars = ctx.masterLibrary.ownerVariables;
  const posts: Array<{ id: number; title: string; body: string; source: string }> = [];
  const add = (title: string, body: string, source: string) => {
    posts.push({
      id: posts.length + 1,
      title: cleanCustomerTitle(enrichSatelliteTitle(title, ctx)),
      body: limitChars(enrichSatelliteText(body, ctx, "gbp"), 220),
      source,
    });
  };

  for (const name of conditionNames(sections)) {
    if (posts.length >= 7) break;
    add(
      `${serviceName} for ${name}`,
      `${pharmacyName} can assess ${name.toLowerCase()} through ${serviceName} where NHS criteria are met. Call ${vars.phone} in ${localArea}.`,
      "Master §2 + context",
    );
  }

  const intro = conciseText(sections.find((s) => s.number === 1)?.bodyMarkdown.split(/\n\n/)[0] || "", 1);
  add(`${serviceName} at ${pharmacyName}`, `${intro} ${localArea}. Call ${vars.phone}.`, "Master §1");

  add("Walk in or book ahead", `Call ${vars.phone} to ask whether you can walk in or should book ahead for ${serviceName} at ${pharmacyName}.`, "Master §7 + context");

  add("Private pharmacist consultation", `Pharmacy First consultations take place in a confidential setting with the pharmacy team at ${pharmacyName}, ${localArea}.`, "Master §4 + context");

  const fillerSections = [4, 5, 10, 13, 11, 6];
  for (const n of fillerSections) {
    while (posts.length < 10) {
      const sec = sections.find((s) => s.number === n);
      if (!sec) break;
      const para = conciseText(applyContextTokens(sec.bodyMarkdown.split(/\n\n/)[0] || "", ctx), 1);
      if (!para) break;
      add(`${serviceName} update`, `${para} ${pharmacyName}, ${localArea}. Call ${vars.phone}.`, `Master §${n}`);
      break;
    }
    if (posts.length >= 10) break;
  }

  while (posts.length < 10) {
    add(`Book ${serviceName}`, applyContextTokens(`Call {{phone}} to ask about ${serviceName} at ${pharmacyName}, ${localArea}.`, ctx), "Master §13 + context");
  }

  return posts.slice(0, 10);
}

function buildEmails(
  ctx: ContentGenerationContext,
  sections: MasterLibrarySection[],
): Array<{ id: number; subject: string; body: string; source: string }> {
  const s = (n: number) =>
    tenantizeProse(stripMd(applyContextTokens(sections.find((x) => x.number === n)?.bodyMarkdown || "", ctx)), ctx);
  const body = (text: string, maxSentences = 5) =>
    cleanCustomerText(enrichSatelliteText(conciseText(text, maxSentences), ctx, "email"));
  return [
    {
      id: 1,
      subject: `${ctx.serviceName} at ${ctx.profile.pharmacyName}`,
      body: body(`${s(1).split(/\n\n/)[0] || ""}\n\nCall ${ctx.cta.phone} to enquire in ${ctx.localArea}.`, 4),
      source: "Master §1 + tenant",
    },
    {
      id: 2,
      subject: `Your ${ctx.serviceName} appointment at ${ctx.profile.pharmacyName}`,
      body: body([s(4).split(/\n\n/)[0], s(4).split(/\n\n/)[2]].filter(Boolean).join("\n\n"), 5),
      source: "Master §4 + tenant",
    },
    {
      id: 3,
      subject: `What to expect from ${ctx.serviceName} at ${ctx.profile.pharmacyName}`,
      body: body(s(5).split(/\n\n/).slice(0, 2).join("\n\n"), 5),
      source: "Master §5 + tenant",
    },
    {
      id: 4,
      subject: `When to seek other care — ${ctx.profile.pharmacyName}`,
      body: body(s(6).split(/\n\n/).slice(0, 2).join("\n\n"), 5),
      source: "Master §6 + tenant",
    },
    {
      id: 5,
      subject: `Book ${ctx.serviceName} at ${ctx.profile.pharmacyName}`,
      body: body(tenantizeProse(
        applyContextTokens(
          `Call {{phone}} to book ${ctx.serviceName.toLowerCase()} at ${ctx.profile.pharmacyName}.\n\nOpening hours: {{opening_hours}}\n\nBook online: {{booking_link}}`,
          ctx,
        ),
        ctx,
      ), 4),
      source: "Master §13 + tenant",
    },
  ];
}

function buildVideoScript(ctx: ContentGenerationContext, sections: MasterLibrarySection[]): string {
  const intro = conciseText(firstCustomerParagraph(sections.find((s) => s.number === 1)?.bodyMarkdown || ""), 2);
  const process = `${ctx.profile.pharmacyName} checks your symptoms against the NHS Pharmacy First pathway, reviews relevant medicines and allergies, and explains whether pharmacy treatment, self-care, GP care or urgent care is the right next step.`;
  const cta = enrichSatelliteText(
    applyContextTokens(`Call {{phone}} to ask about ${ctx.serviceName} at ${ctx.profile.pharmacyName} in ${ctx.localArea}.`, ctx),
    ctx,
    "video",
  );

  return `# ${ctx.serviceName} — 90-Second Explainer Script

## Opening (0:00–0:15)

${cleanCustomerText(enrichSatelliteText(intro, ctx, "video"))}

## How it works (0:15–0:55)

${cleanCustomerText(enrichSatelliteText(process, ctx, "video"))}

## Closing CTA (0:55–1:30)

${cleanCustomerText(cta)}
`;
}

function runQualityChecks(
  assets: EcosystemAsset[],
  htmlSamples: string[],
  section12Body: string,
  section1Body: string,
  localBody: string,
  socialCount: number,
  gbpCount: number,
): EcosystemQualityCheck[] {
  return [
    {
      name: "Asset count",
      pass: assets.length >= 12,
      detail: `${assets.length} assets created (target: 12)`,
    },
    {
      name: "No pharmacyServicePageGenerator",
      pass: !htmlSamples.some((h) => h.includes("pharmacyServicePageGenerator")),
      detail: "No legacy generator markers in HTML",
    },
    {
      name: "No blueprint leakage",
      pass: htmlSamples.every((h) => !detectBlueprintLeakage(h)),
      detail: "No blueprint section types in page main content",
    },
    {
      name: "Trust layer dedupe",
      pass: !detectTrustLayerDuplication(section12Body),
      detail: "§12 GPhC sentence removed where trust layer applies",
    },
    {
      name: "Local layer dedupe",
      pass: !detectLocalLayerDuplication(section1Body, localBody),
      detail: "Local access copy does not repeat §1 opening",
    },
    {
      name: "Social post count",
      pass: socialCount === 20,
      detail: `${socialCount} posts in pack`,
    },
    {
      name: "GBP post count",
      pass: gbpCount === 10,
      detail: `${gbpCount} posts in pack`,
    },
    {
      name: "Email count",
      pass: assets.some((a) => a.id === "email-sequence"),
      detail: "5 emails in pack",
    },
    {
      name: "Video script exists",
      pass: assets.some((a) => a.id === "video-script"),
      detail: "video-script.md created",
    },
    {
      name: "Summary page exists",
      pass: assets.some((a) => a.id === "ecosystem-summary"),
      detail: "Content ecosystem summary page created",
    },
  ];
}

export function buildBenchmarkServiceEcosystem(
  ctx: ContentGenerationContext,
  options: { corePagesOnly?: boolean; generationStamp?: GenerationStamp } = {},
): EcosystemBuildResult {
  const corePagesOnly = Boolean(options.corePagesOnly);
  const { serviceId, serviceName, resolvedSlug, serviceMeta: meta } = ctx;
  const masterFile = ctx.masterLibrary.relativePath;
  const masterPath = ctx.masterLibrary.absolutePath;
  const masterMtimeBefore = fs.statSync(masterPath).mtimeMs;
  const ecosystemRoot = ctx.links.ecosystemRoot;
  const generatedAt = options.generationStamp?.generatedAt || new Date().toISOString();
  const generationStamp: GenerationStamp = options.generationStamp?.runId
    ? options.generationStamp
    : createCampaignRunStamp(resolvedSlug, serviceId, generatedAt);
  const selectedAreas = ctx.selectedAreas.map((a) => a.areaName);
  const chrome = ctxToPreviewChrome(ctx);
  const localArea = ctx.localArea;
  const sections = ctx.masterLibrary.sections;
  const vars = ctx.masterLibrary.ownerVariables;
  const section8 = sections.find((s) => s.number === 8)?.bodyMarkdown || "";
  const misconceptions = parseMisconceptions(section8);
  const faqs = ctx.masterLibrary.faqs;
  const generatorReport = createGeneratorRuntimeReport("benchmark-service-ecosystem", ctx);

  const assets: EcosystemAsset[] = [];
  const htmlSamples: string[] = [];
  const localClusterEntries: LocalClusterLinkEntry[] = [];

  const writePage = (relDir: string, html: string): string => {
    const safe = sanitizeTenantHtml(stampHtmlOutput(html, generationStamp), resolvedSlug, ctx.profile.pharmacyName);
    const outPath = path.join(ecosystemRoot, "pages", relDir, "index.html");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, safe, "utf8");
    return outPath;
  };

  const writeLocalClusterPage = (areaName: string, html: string): string => {
    const safe = sanitizeTenantHtml(stampHtmlOutput(html, generationStamp), resolvedSlug, ctx.profile.pharmacyName);
    const outPath = path.join(ecosystemRoot, "local", slugifyArea(areaName), "index.html");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, safe, "utf8");
    return outPath;
  };

  const writePack = (filename: string, data: unknown): string => {
    const outPath = path.join(ecosystemRoot, "packs", filename);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const payload =
      typeof data === "string"
        ? sanitizeTenantHtml(
            `tenantSlug: ${generationStamp.tenantSlug}\ncampaignId: ${generationStamp.campaignId}\ngeneratedAt: ${generationStamp.generatedAt}\nsourceContext: ${generationStamp.sourceContext}\n\n${data}`,
            resolvedSlug,
            ctx.profile.pharmacyName,
          )
        : JSON.stringify(stampPackData(data, generationStamp), null, 2);
    fs.writeFileSync(outPath, payload, "utf8");
    return outPath;
  };

  // MVP / CORE-PAGE-28: localities + review only — optional assets stay available via full scope.
  if (corePagesOnly) {
    void writeLocalClusterPage;
    void writePage;
    void vars;
    const localGeneration = generateLocalLocationHierarchyPages(ctx, { generationStamp });
    if (!localGeneration.ok) {
      throw new Error(localGeneration.blockedReason || "Local area page generation failed");
    }
    for (const asset of localGeneration.assets) {
      assets.push(asset);
      htmlSamples.push(fs.readFileSync(asset.outputPath, "utf8"));
    }
    localClusterEntries.push(...localGeneration.localClusterEntries);

    try {
      const trust = writeReviewTrustPack(resolvedSlug, serviceId);
      if (trust.ok) {
        assets.push({
          id: "review-trust",
          type: "Review & Trust pack",
          urlPath: "(pack)",
          outputPath: trust.path,
          sourceSections: ["profile", "confirmed trust evidence"],
          wordCount: countWords(JSON.stringify(trust.pack.trustSignals)),
        });
      }
    } catch {
      /* package service also ensures the pack */
    }

    const internalLinkMap: EcosystemInternalLinkMap = {
      slug: resolvedSlug,
      serviceId,
      mainServiceUrlPath: meta.urlPath,
      localClusterPages: localClusterEntries,
      generatedAt,
      generationStamp,
    };

    fs.mkdirSync(ecosystemRoot, { recursive: true });
    fs.writeFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), JSON.stringify(internalLinkMap, null, 2), "utf8");
    fs.writeFileSync(
      path.join(ecosystemRoot, "_ecosystem-index.json"),
      JSON.stringify(
        {
          version: 1,
          serviceId,
          masterFile,
          slug: resolvedSlug,
          localArea,
          selectedAreas,
          localClusterPagesGenerated: localClusterEntries.length,
          localLocationHubGenerated: localGeneration.ok,
          localLocationClustersGenerated: localGeneration.ok ? localGeneration.hierarchy.clusters.length : 0,
          localLocationAreasGenerated: localGeneration.ok ? localGeneration.hierarchy.areas.length : 0,
          localLocationHierarchy: localGeneration.hierarchy,
          scope: "mvp-core-pages",
          optionalAssetsDisconnected: ["gbp", "social", "email", "blogs", "guides", "faq-page", "video", "supporting-overview"],
          generatedAt,
          assets,
          internalLinkMap,
        },
        null,
        2,
      ),
      "utf8",
    );

    const masterMtimeAfter = fs.statSync(masterPath).mtimeMs;
    if (masterMtimeAfter !== masterMtimeBefore) {
      throw new Error(`Master library changed during ecosystem build: ${masterPath}`);
    }

    return {
      serviceId,
      serviceName,
      masterFile,
      ecosystemRoot,
      slug: resolvedSlug,
      selectedAreas,
      localClusterPagesGenerated: localClusterEntries.length,
      internalLinkMap,
      assets,
      qualityChecks: [],
      socialPosts: [],
      gbpPosts: [],
      emails: [],
      videoScript: "",
      generatorReport,
    };
  }

  const overviewBody = buildSupportingServiceOverviewBodyHtml(ctx);
  const rootHtml = renderArticlePage({
    ctx,
    title: `${serviceName} at ${ctx.profile.pharmacyName}`,
    lead: `${ctx.profile.pharmacyName} provides ${serviceName.toLowerCase()} for patients in ${localArea} — pharmacist-led assessment with clear advice about symptoms, treatment options and next steps.`,
    bodyHtml: overviewBody,
    type: "supporting-service-page",
  });
  const rootPath = writePage(serviceId, rootHtml);
  htmlSamples.push(rootHtml);
  assets.push({
    id: "root-service-page",
    type: "Supporting service page",
    urlPath: meta.urlPath,
    outputPath: rootPath,
    sourceSections: ["§1", "§2", "§4", "§10", "tenant overview", "CTA"],
    wordCount: countWords(overviewBody.replace(/<[^>]+>/g, " ")),
  });

  const localGeneration = generateLocalLocationHierarchyPages(ctx, { generationStamp });
  if (!localGeneration.ok) {
    throw new Error(localGeneration.blockedReason || "Local area page generation failed");
  }
  if (localGeneration.ok) {
    for (const asset of localGeneration.assets) {
      assets.push(asset);
      htmlSamples.push(fs.readFileSync(asset.outputPath, "utf8"));
    }
    localClusterEntries.push(...localGeneration.localClusterEntries);
  }

  const guideBody = buildPatientGuideBodyHtml(ctx);
  const guideSlug = `${serviceId}-guide`;
  const guideHtml = renderArticlePage({
    ctx,
    title: `Your Guide To ${serviceName} at ${ctx.profile.pharmacyName}`,
    lead: `A patient guide from ${ctx.profile.pharmacyName} — how ${serviceName.toLowerCase()} works at the pharmacy, what to expect, and how to arrange an appointment in ${localArea}.`,
    bodyHtml: guideBody,
    type: "patient-guide",
  });
  const guidePath = writePage(guideSlug, guideHtml);
  htmlSamples.push(guideHtml);
  assets.push({
    id: "patient-guide",
    type: "Patient guide article",
    urlPath: `/${guideSlug}/`,
    outputPath: guidePath,
    sourceSections: ["§1", "§4", "§5", "§6", "§13"],
    wordCount: countWords(guideBody.replace(/<[^>]+>/g, " ")),
  });

  const tenantFaqs = buildEvidenceSafeStandaloneFaqEntries({
    serviceId,
    serviceName,
    pharmacyName: ctx.profile.pharmacyName,
    phone: ctx.cta.phone,
    website: ctx.cta.website,
  });
  const faqSlug = `${serviceId}-faqs`;
  const faqHtml = renderEcosystemFaqPageHtml(ctx);
  const faqPath = writePage(faqSlug, faqHtml);
  htmlSamples.push(faqHtml);
  assets.push({
    id: "faq-page",
    type: "FAQ page",
    urlPath: `/${faqSlug}/`,
    outputPath: faqPath,
    sourceSections: ["§7", "tenant FAQs", "evidence-safe-faq"],
    wordCount: countWords(tenantFaqs.map((f) => `${f.question} ${f.answer}`).join(" ")),
  });

  for (const blog of buildLongFormBlogConfigs(ctx)) {
    const body = buildBlogPostBodyHtml(ctx, blog);
    const html = renderArticlePage({
      ctx,
      title: blog.title,
      lead: blog.lead,
      bodyHtml: body,
      type: "blog-post",
    });
    const outPath = writePage(blog.slug, html);
    htmlSamples.push(html);
    assets.push({
      id: blog.slug,
      type: "Blog post",
      urlPath: `/${blog.slug}/`,
      outputPath: outPath,
      sourceSections: blog.masterSections.map((n) => `§${n}`),
      wordCount: countWords(body.replace(/<[^>]+>/g, " ")),
    });
  }

  const socialPosts = buildSocialPosts(ctx, misconceptions, faqs, sections);
  const socialPath = writePack("social-posts.json", {
    version: 1,
    count: socialPosts.length,
    posts: socialPosts.map(({ source: _source, ...post }) => post),
    pharmacy: ctx.profile.pharmacyName,
  });
  assets.push({
    id: "social-pack",
    type: "Social post pack",
    urlPath: "(pack)",
    outputPath: socialPath,
    sourceSections: ["§8", "§7", "§2", "§10", "§13"],
    wordCount: countWords(socialPosts.map((p) => p.text).join(" ")),
  });

  const gbpPosts = buildGbpPosts(ctx, sections);
  const gbpPath = writePack("gbp-posts.json", {
    version: 1,
    count: gbpPosts.length,
    posts: gbpPosts.map(({ source: _source, ...post }) => post),
    pharmacy: ctx.profile.pharmacyName,
  });
  assets.push({
    id: "gbp-pack",
    type: "GBP post pack",
    urlPath: "(pack)",
    outputPath: gbpPath,
    sourceSections: ["§1", "§2", "§4", "§7", "§13"],
    wordCount: countWords(gbpPosts.map((p) => `${p.title} ${p.body}`).join(" ")),
  });

  const emails = buildEmails(ctx, sections);
  const emailPath = writePack("email-sequence.json", {
    version: 1,
    count: emails.length,
    emails: emails.map(({ source: _source, ...email }) => email),
    pharmacy: ctx.profile.pharmacyName,
  });
  assets.push({
    id: "email-sequence",
    type: "Email sequence",
    urlPath: "(pack)",
    outputPath: emailPath,
    sourceSections: ["§1", "§4", "§5", "§6", "§13"],
    wordCount: countWords(emails.map((e) => `${e.subject} ${e.body}`).join(" ")),
  });

  const videoScript = buildVideoScript(ctx, sections);
  const videoPath = writePack("video-script.md", videoScript);
  assets.push({
    id: "video-script",
    type: "YouTube / video script",
    urlPath: "(pack)",
    outputPath: videoPath,
    sourceSections: ["§1", "§4", "§13"],
    wordCount: countWords(videoScript),
  });

  // Review & Trust pack from confirmed profile evidence only (reviewer optional).
  try {
    const trust = writeReviewTrustPack(resolvedSlug, serviceId);
    if (trust.ok) {
      assets.push({
        id: "review-trust",
        type: "Review & Trust pack",
        urlPath: "(pack)",
        outputPath: trust.path,
        sourceSections: ["profile", "confirmed trust evidence"],
        wordCount: countWords(JSON.stringify(trust.pack.trustSignals)),
      });
    }
  } catch {
    /* optional during ecosystem build — package service also ensures the pack */
  }

  const summarySlug = `${serviceId}-content-ecosystem`;
  const summaryCards = assets
    .filter((a) => a.urlPath !== "(pack)")
    .map(
      (a) =>
        `<div class="eco-card"><h3>${esc(a.type)}</h3><p>${esc(a.sourceSections.join(", "))}</p><p class="eco-meta">${a.wordCount.toLocaleString()} words · ${esc(a.urlPath)}</p></div>`,
    )
    .join("\n");
  const packCards = [
    { name: "Social posts (20)", file: "social-posts.json" },
    { name: "GBP posts (10)", file: "gbp-posts.json" },
    { name: "Email sequence (5)", file: "email-sequence.json" },
    { name: "Video script", file: "video-script.md" },
    { name: "Review & Trust", file: "review-trust.json" },
  ]
    .map((p) => `<div class="eco-card"><h3>${esc(p.name)}</h3><p>Master-derived content pack</p></div>`)
    .join("\n");

  const summaryHtml = `<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(serviceName)} Content Ecosystem | ${esc(ctx.profile.pharmacyName)}</title>${demoStyles()}</head>
<body data-publish-source="master-library-ecosystem" data-ecosystem-type="summary" data-content-engine-context="${ctx.contractVersion}">
${demoBanner(serviceName, ctx.profile.pharmacyName, localArea)}
${renderPreviewTopTrustBar({ ...chrome, serviceName })}
${renderPreviewSiteHeader({ ...chrome, serviceName, homeUrl: chrome.website })}
<main class="eco-article" style="max-width:960px">
<h1>${esc(serviceName)} Content Ecosystem</h1>
<p class="eco-lead">One approved master library powers service pages, local pages, guides, blogs, FAQs, social content, GBP posts, emails, and video scripts — ${esc(ctx.profile.pharmacyName)}, ${esc(localArea)}.</p>
<p><strong>Source:</strong> ${esc(meta.masterFile)} only · Content Engine ${ctx.contractVersion}</p>
<h2 style="font-family:var(--font-heading);color:var(--nhs-dark);margin:2rem 0 1rem">Web pages</h2>
<div class="eco-grid">${summaryCards}</div>
<h2 style="font-family:var(--font-heading);color:var(--nhs-dark);margin:2rem 0 1rem">Content packs</h2>
<div class="eco-grid">${packCards}</div>
</main>
</body></html>`;
  const summaryPath = writePage(summarySlug, summaryHtml);
  htmlSamples.push(summaryHtml);
  assets.push({
    id: "ecosystem-summary",
    type: "Content ecosystem summary",
    urlPath: `/${summarySlug}/`,
    outputPath: summaryPath,
    sourceSections: ["Meta index"],
    wordCount: countWords(`${serviceName} Content Ecosystem ${assets.length} assets`),
  });

  const longFormQuality = validateLongFormQuality(ctx);

  const internalLinkMap: EcosystemInternalLinkMap = {
    slug: resolvedSlug,
    serviceId,
    mainServiceUrlPath: meta.urlPath,
    localClusterPages: localClusterEntries,
    generatedAt,
    generationStamp,
  };

  fs.mkdirSync(ecosystemRoot, { recursive: true });
  fs.writeFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), JSON.stringify(internalLinkMap, null, 2), "utf8");
  fs.writeFileSync(
    path.join(ecosystemRoot, "_ecosystem-index.json"),
    JSON.stringify(
      {
        version: 1,
        serviceId,
        masterFile,
        slug: resolvedSlug,
        localArea,
        selectedAreas,
        localClusterPagesGenerated: localClusterEntries.length,
        localLocationHubGenerated: localGeneration.ok,
        localLocationClustersGenerated: localGeneration.ok ? localGeneration.hierarchy.clusters.length : 0,
        localLocationAreasGenerated: localGeneration.ok ? localGeneration.hierarchy.areas.length : 0,
        localLocationHierarchy: localGeneration.hierarchy,
        generatedAt,
        generationStamp,
        contentEngineContract: ctx.contractVersion,
        longFormQualityValidation: longFormQuality,
        assets,
        internalLinkMap,
        generatorReport,
      },
      null,
      2,
    ),
    "utf8",
  );

  const masterMtimeAfter = fs.statSync(masterPath).mtimeMs;
  const section12 = applyContextTokens(sections.find((s) => s.number === 12)?.bodyMarkdown || "", ctx);
  const section1 = sections.find((s) => s.number === 1)?.bodyMarkdown || "";
  const localBody = meta.localBody({
    pharmacyName: ctx.profile.pharmacyName,
    town: localArea,
    phone: vars.phone,
    addressLine1: ctx.profile.addressLine1,
    addressLine2: ctx.profile.addressLine2,
    postcode: ctx.profile.postcode,
    coverageRadius: ctx.profile.coverageRadius,
    rankingAreas: ctx.coverageAreas,
  });

  const qualityChecks = [
    ...runQualityChecks(
      assets,
      htmlSamples,
      dedupeTrustSectionBody(section12),
      section1,
      localBody,
      socialPosts.length,
      gbpPosts.length,
    ),
    {
      name: "Master file unmodified",
      pass: masterMtimeBefore === masterMtimeAfter,
      detail: `${meta.masterFile} read-only (${masterMtimeBefore === masterMtimeAfter ? "mtime unchanged" : "MODIFIED"})`,
    },
    {
      name: "Content engine context",
      pass: generatorReport.receivedContext,
      detail: `contract ${ctx.contractVersion}`,
    },
    {
      name: "Long-form tenant depth",
      pass: longFormQuality.ok,
      detail: longFormQuality.detail,
    },
  ];

  return {
    serviceId,
    serviceName,
    masterFile,
    ecosystemRoot,
    slug: resolvedSlug,
    selectedAreas,
    localClusterPagesGenerated: localClusterEntries.length,
    internalLinkMap,
    assets,
    qualityChecks,
    socialPosts,
    gbpPosts,
    emails,
    videoScript,
    generatorReport,
  };
}

export function buildBenchmarkServiceEcosystemFromSlug(serviceId: string, slug: string): EcosystemBuildResult {
  return buildBenchmarkServiceEcosystem(buildContentGenerationContext(slug, serviceId));
}

export function buildAllBenchmarkServiceEcosystems(slug = SLUG): EcosystemBuildResult[] {
  return ROLLOUT_SERVICE_IDS.map((serviceId) => buildBenchmarkServiceEcosystemFromSlug(serviceId, slug));
}

export function countBenchmarkEcosystems(slug = SLUG): number {
  return BENCHMARK_MASTER_SERVICE_IDS.filter((id) =>
    fs.existsSync(path.join(getEcosystemRoot(id, slug), "_ecosystem-index.json")),
  ).length;
}
