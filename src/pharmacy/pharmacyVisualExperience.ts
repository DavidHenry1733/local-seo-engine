/**
 * PharmaConnect permanent service page presentation layer.
 * Single consolidated pipeline for all visual service pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import {
  buildPharmacyServicePageStyleBlock,
  PHARMACY_SERVICE_PAGE_TEMPLATE_ID,
  renderPharmacyServicePageFooter,
  renderPharmacyServicePageHeader,
} from "./pharmacyServicePageDesignSystem.ts";
import { resolvePharmacyImageWithAssignments } from "./pharmacyImageAssignmentResolver.ts";
import {
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
} from "./templates/pharmacyImageLibrary.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveCurrentPharmacyPresentationProfile } from "./pharmacyPresentationProfileResolver.ts";
import { mergeLivePresentationFactsIntoContext } from "./pharmacyPresentationContextMerge.ts";
import { buildPharmacyThemeWithBrandDna, buildGoogleFontsLink } from "./pharmacyBrandDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { BRAND_DNA_VERSION } from "./pharmacyBrandDnaTypes.ts";
import {
  buildVisualServicePageMainHtml,
  PHARMACY_VISUAL_PIPELINE_VERSION,
  visualServicePageBodyAttributes,
} from "./pharmacyVisualServicePageRenderer.ts";
import { resolvePageComponentDna } from "./pharmacyBrandDnaComponentRenderers.ts";
import { applyBrandDnaToServicePageProfile } from "./pharmacyBrandDnaResolver.ts";
import { applyPremisesIdentityForServicePageRender } from "./pharmacyServicePageTrustInjection.ts";
import { componentDnaBodyAttributes } from "./pharmacyComponentDnaResolver.ts";
import {
  isPharmaconnectDesignSystemV1Locked,
  PHARMACONNECT_DESIGN_SYSTEM_V1_ID,
  PHARMACONNECT_DESIGN_SYSTEM_V1_REVISION,
  validatePharmaconnectDesignSystemV1Page,
} from "./pharmacyDesignSystemV1.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import {
  reducePharmacyNameRepetition,
  replaceKeywordStuffedPharmacyListingNames,
  scrubUnconfirmedServiceClaims,
} from "./pharmacyServicePagePublicationQuality.ts";
import { validateCustomerFacingServicePageHtml, readEvidenceReviewApprovedForPublicationQuality } from "./pharmacyServicePagePublicationQualityGate.ts";
import { buildPublicationQualityApprovedEvidence } from "./masterAdminCoreProductRecoveryEvidenceService.ts";
import { applyLockedPharmacyFirstServicePageStructure } from "./pharmacyPharmacyFirstLocalPagePreviewOverlay.ts";
import {
  ensureProfessionalReviewPanelHtml,
  renderProfessionalReviewPanelHtml,
} from "./pharmacyProfessionalReviewPanel.ts";
import { polishCommercialServicePublicHtml } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import { validatePharmacyServicePageHtml } from "./pharmacyVisualExperienceLayoutV3.ts";
import { getServicePublishingSettings } from "./pharmacyPublishingSettingsService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { isApprovedBankRegisteredService } from "./pharmacyServiceVariantLibrary.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import {
  validateServiceBodyContent,
  type GenerationReport,
} from "./pharmacyGenerationIntegrityService.ts";
import { syncSchemaFaqs, type ServicePageFaqLike } from "./pharmacyFaqAlignment.ts";
import { resolveServicePageFaqContent } from "./pharmacyFaqContentResolver.ts";
import { enhanceTrustSchemaForSlug } from "./pharmacyTrustLayer.ts";
import { readServicePageSeoPlan } from "./masterAdminCoreProductRecoverySeoService.ts";
import {
  enrichVisualServicePageSchemaDocument,
  parseFirstJsonLdScript,
  serializeJsonLdScript,
} from "./pharmacyVisualExperienceSchemaEnrichment.ts";
import { deliverApprovedCorePageJsonLd } from "./pharmacyApprovedCorePageJsonLdDelivery.ts";
import {
  MASTER_PUBLISH_SOURCE_ROOT,
  VISUAL_EXPERIENCE_ROOT,
  VISUAL_EXPERIENCE_BENCHMARK_SERVICES,
  VISUAL_EXPERIENCE_SERVICE_CONFIG,
  type VisualExperienceServiceId,
} from "./pharmacyVisualExperienceConfig.ts";

export type { VisualExperienceServiceId };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output/pharmacy-master-publish"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();

export interface VisualExperienceImageSlotReport {
  slot: PharmacyImageSlot;
  imageKey: string;
  imagePack: string;
  libraryRef: string;
  assetPath: string;
  assetExists: boolean;
  alt: string;
  source?: string;
}

export interface VisualExperienceBuildResult {
  serviceId: VisualExperienceServiceId;
  serviceName: string;
  sourcePath: string;
  outputPath: string;
  previewUrl: string;
  imageSlots: VisualExperienceImageSlotReport[];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderVisualGenerationStamp(
  slug: string,
  serviceId: string,
  presentationRevision = 0,
  profileUpdatedAt = "",
): string {
  const generatedAt = new Date().toISOString();
  return [
    `<meta name="tenantSlug" content="${esc(slug)}"/>`,
    `<meta name="campaignId" content="${esc(serviceId)}"/>`,
    `<meta name="generatedAt" content="${esc(generatedAt)}"/>`,
    `<meta name="presentationProfileRevision" content="${esc(String(presentationRevision))}"/>`,
    `<meta name="presentationProfileUpdatedAt" content="${esc(profileUpdatedAt)}"/>`,
    `<meta name="sourceContext" content="customer-imported-profile"/>`,
    `<!-- tenantSlug: ${esc(slug)}; campaignId: ${esc(serviceId)}; generatedAt: ${esc(generatedAt)}; presentationProfileRevision: ${esc(String(presentationRevision))}; presentationProfileUpdatedAt: ${esc(profileUpdatedAt)}; sourceContext: customer-imported-profile -->`,
  ].join("\n");
}

export function buildImageRenderContext(
  slug: string,
  serviceId: VisualExperienceServiceId,
  pageSlug?: string,
): PharmacyImageRenderContext {
  const config = VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId];
  const profile = resolveCurrentPharmacyPresentationProfile(slug).servicePageProfile;
  return {
    templateFamilyKey: config.templateFamilyKey,
    serviceKey: serviceId,
    serviceName: config.serviceName,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    slug,
    pageSlug: pageSlug || serviceId,
    previewBasePath: "/assets",
    visualDemoMode: Boolean(profile.demoMode),
    previewMode: false,
    campaignId: serviceId,
  };
}

function extractRenderedServicePageFaqs(mainHtml: string): ServicePageFaqLike[] {
  const faqs: ServicePageFaqLike[] = [];
  const pattern = /class="faq-q">([^<]+)<\/h3><p class="faq-a">([^<]+)<\/p>/g;
  for (const match of mainHtml.matchAll(pattern)) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim();
    if (question && answer) faqs.push({ question, answer });
  }
  return faqs;
}

function syncSchemaScriptsWithRenderedFaqs(schemaScripts: string, faqs: ServicePageFaqLike[]): string {
  if (!schemaScripts || !faqs.length) return schemaScripts;
  return schemaScripts.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    (_full, jsonBody: string) => {
      try {
        const parsed = JSON.parse(jsonBody) as Record<string, unknown>;
        const synced = syncSchemaFaqs(parsed, faqs);
        if (!synced) return _full;
        return `<script type="application/ld+json">${JSON.stringify(synced).replace(/</g, "\\u003c")}</script>`;
      } catch {
        return _full;
      }
    },
  );
}

export interface VisualServicePageRenderInput {
  slug: string;
  serviceId: VisualExperienceServiceId;
  pageSlug?: string;
  contentContextOverride?: ContentGenerationContext;
}

/** Single-pass visual service page renderer — same architecture as local cluster pages. */
export function renderVisualServicePageHtml(input: VisualServicePageRenderInput): string {
  const { slug, serviceId, pageSlug, contentContextOverride } = input;
  const sourcePath = resolveMasterPublishSourcePath(slug, serviceId);
  if (!sourcePath) {
    throw new Error(
      `We could not render this service page because the selected service content is missing (${slug}/${serviceId}).`,
    );
  }
  const sourceHtml = fs.readFileSync(sourcePath, "utf8");
  const bodyCheck = validateServiceBodyContent(sourceHtml, serviceId);
  if (!bodyCheck.ok) {
    throw new Error(
      `Service content validation failed: ${bodyCheck.foreignServiceContentDetected.join(", ") || bodyCheck.errors.join(", ")}`,
    );
  }
  return transformMasterPublishToVisualExperience(sourceHtml, slug, serviceId, pageSlug, contentContextOverride);
}

function resolveMasterPublishSourcePath(
  slug: string,
  serviceId: VisualExperienceServiceId,
): string | null {
  const tenantMaster = path.join(WORKSPACE_ROOT, MASTER_PUBLISH_SOURCE_ROOT, slug, serviceId, "index.html");
  if (!fs.existsSync(tenantMaster)) return null;
  const existing = fs.readFileSync(tenantMaster, "utf8");
  const check = validateServiceBodyContent(existing, serviceId);
  return check.ok ? tenantMaster : null;
}

export function transformMasterPublishToVisualExperience(
  sourceHtml: string,
  slug: string,
  serviceId: VisualExperienceServiceId,
  pageSlug?: string,
  contentContextOverride?: ContentGenerationContext,
): string {
  const config = VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId];
  const brandDna = resolveBrandDnaForRender(slug);
  const presentation = resolveCurrentPharmacyPresentationProfile(slug);
  const baseProfile = presentation.servicePageProfile;
  const profile = applyPremisesIdentityForServicePageRender(
    applyBrandDnaToServicePageProfile(baseProfile, brandDna),
    sourceHtml,
  );
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const ctx = {
    ...buildImageRenderContext(slug, serviceId, pageSlug),
    pharmacyName: profile.pharmacyName,
    location: profile.town,
  };
  let contentContext: ContentGenerationContext | undefined;
  try {
    contentContext =
      contentContextOverride ||
      mergeLivePresentationFactsIntoContext(buildContentGenerationContext(slug, serviceId), presentation);
  } catch {
    contentContext = contentContextOverride;
  }
  const meta = getServicePublishMeta(serviceId);
  const town = profile.town || "your area";
  const title = `${config.serviceName} ${town} | ${profile.pharmacyName}`;
  // Approved-bank core pages: disconnect master meta/long-form claim wording from SEO description.
  const metaDesc = isApprovedBankRegisteredService(serviceId)
    ? `${profile.pharmacyName} in ${town} — ${config.serviceName}. Call to ask how the service is arranged.`
    : meta?.metaDescription(profile.pharmacyName, town) ||
      `${profile.pharmacyName} in ${town} — ${config.serviceName}.`;

  const mainHtmlRaw = buildVisualServicePageMainHtml(sourceHtml, ctx, profile, contentContext);
  const mainHtml =
    slug !== "pharmaconnect" && profile.pharmacyName
      ? mainHtmlRaw.replace(/Brook Pharmacy/g, profile.pharmacyName)
      : mainHtmlRaw;
  const $meta = cheerio.load(sourceHtml);
  const schemaScriptsRaw = $meta("script[type='application/ld+json']")
    .toArray()
    .map((el) => $meta.html(el))
    .join("\n");
  let schemaScripts = schemaScriptsRaw.replace(/Brook Pharmacy/g, profile.pharmacyName);
  const renderedFaqs = extractRenderedServicePageFaqs(mainHtml);
  const faqsForSchema =
    renderedFaqs.length >= 5
      ? renderedFaqs
      : resolveServicePageFaqContent(contentContext, slug, serviceId, sourceHtml).slice(0, 10);
  schemaScripts = syncSchemaScriptsWithRenderedFaqs(schemaScripts, faqsForSchema);
  const seoPlan = readServicePageSeoPlan(slug, serviceId);
  const urlPath = meta?.urlPath || `/${serviceId}/`;
  const websiteBase = String(profile.website || "").replace(/\/$/, "");
  const seoCanonical = String(seoPlan?.canonicalUrl || "");
  const pageUrl =
    seoCanonical.includes(`/${serviceId}`)
      ? seoCanonical
      : websiteBase
        ? `${websiteBase}${urlPath}`
        : `https://example.local/${slug}${urlPath}`;
  const schemaDoc = parseFirstJsonLdScript(schemaScripts);
  if (schemaDoc) {
    const trustEnhanced = enhanceTrustSchemaForSlug(slug, schemaDoc);
    const enriched = enrichVisualServicePageSchemaDocument(
      trustEnhanced,
      {
        serviceName: config.serviceName,
        pharmacyName: profile.pharmacyName,
        town,
        pageUrl,
        metaDescription: metaDesc,
        website: websiteBase || pageUrl,
        serviceId,
      },
      faqsForSchema,
    );
    schemaScripts = serializeJsonLdScript(enriched);
  }
  const superintendentName = profile.superintendentPharmacistName.trim();
  if (superintendentName && schemaScripts.includes("Demo Superintendent")) {
    schemaScripts = schemaScripts.replace(/Demo Superintendent Pharmacist/g, superintendentName);
  }

  const header = renderPharmacyServicePageHeader(profile, theme);
  const footer = renderPharmacyServicePageFooter(profile, config.serviceName, theme);
  const styleBlock = buildPharmacyServicePageStyleBlock(theme);
  const brandDnaMeta = `<meta name="brand-dna-version" content="${esc(BRAND_DNA_VERSION)}"/>`;
  const publishing = getServicePublishingSettings(slug, serviceId);
  const robotsMeta =
    publishing?.noindex === false
      ? `<meta name="robots" content="index, follow"/>`
      : `<meta name="robots" content="noindex, nofollow"/>`;
  const componentDna = resolvePageComponentDna(theme, brandDna, slug);
  const bodyComponentAttrs = isPharmaconnectDesignSystemV1Locked() ? "" : componentDnaBodyAttributes(componentDna);
  const designSystemMeta = isPharmaconnectDesignSystemV1Locked()
    ? `<meta name="pharmaconnect-design-system" content="${esc(PHARMACONNECT_DESIGN_SYSTEM_V1_ID)}"/>
<meta name="pharmaconnect-design-system-revision" content="${esc(PHARMACONNECT_DESIGN_SYSTEM_V1_REVISION)}"/>`
    : "";

  let html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
${robotsMeta}
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}"/>
<meta name="pharmacy-pipeline-version" content="${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}"/>
${designSystemMeta}
${brandDnaMeta}
${renderVisualGenerationStamp(slug, serviceId, presentation.profileRevision, presentation.updatedAt)}
${schemaScripts}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${styleBlock}
</head>
<body ${visualServicePageBodyAttributes(serviceId, slug)} ${bodyComponentAttrs}>
${header}
<main id="main-content">
${mainHtml}
</main>
${footer}
</body>
</html>`;

  if (isPharmaconnectDesignSystemV1Locked()) {
    const qa = validatePharmaconnectDesignSystemV1Page(html);
    html = html.replace(
      "<body ",
      `<body data-design-system-qa="${qa.passed ? "pass" : "fail"}" `,
    );
  }

  const profileData = loadPharmacyProfile(slug)?.data as
    | {
        serviceDeliveryProfiles?: Record<
          string,
          { fundingModel?: string; walkInAvailable?: boolean | null; appointmentRequired?: boolean | null }
        >;
        gphcNumber?: string;
      }
    | undefined;
  const delivery = profileData?.serviceDeliveryProfiles?.[serviceId];
  html = scrubUnconfirmedServiceClaims(html, {
    fundingModel: delivery?.fundingModel || "unknown",
    walkInAvailable: delivery?.walkInAvailable ?? null,
    appointmentRequired: delivery?.appointmentRequired ?? null,
    abpmConfirmed: false,
    gphcConfirmed: Boolean(String(profileData?.gphcNumber || "").trim()),
    serviceId,
  });
  html = polishCommercialServicePublicHtml(html, {
    pharmacyName: profile.pharmacyName,
    town: profile.town,
    serviceName: config.serviceName,
    phone: profile.displayPhone || profile.phone,
  });
  html = replaceKeywordStuffedPharmacyListingNames(html, presentation.data);
  html = reducePharmacyNameRepetition(html, profile.pharmacyName);
  if (serviceId === "pharmacy-first") {
    html = applyLockedPharmacyFirstServicePageStructure(html);
    html = ensureProfessionalReviewPanelHtml(html, renderProfessionalReviewPanelHtml(profile));
  }
  html = deliverApprovedCorePageJsonLd(html, { slug, serviceId });

  const tenantEvidence = contentContext?.tenantContext;
  const approvedEvidence =
    tenantEvidence?.approvedEvidence || buildPublicationQualityApprovedEvidence(slug, serviceId);
  const evidenceReviewApproved =
    tenantEvidence?.evidenceReviewApproved === true ||
    readEvidenceReviewApprovedForPublicationQuality(slug, serviceId);
  const publicationQa = validateCustomerFacingServicePageHtml(html, {
    canonicalPharmacyName: profile.pharmacyName,
    evidenceReviewApproved,
    approvedEvidence,
  });
  html = html.replace(
    "<body ",
    `<body data-publication-qa="${publicationQa.ok ? "pass" : "fail"}" data-publication-qa-failures="${publicationQa.failures.map((f) => f.id).join(",")}" `,
  );
  if (!publicationQa.ok) {
    throw new Error(
      `Service page failed publication quality gate: ${publicationQa.failures.map((f) => `${f.id}:${f.detail}`).join("; ")}`,
    );
  }

  return html;
}

export function collectImageSlotReport(
  slug: string,
  serviceId: VisualExperienceServiceId,
): VisualExperienceImageSlotReport[] {
  const ctx = buildImageRenderContext(slug, serviceId);
  const slots: PharmacyImageSlot[] = ["hero", "support", "trust", "conversion"];
  return slots.map((slot) => {
    const resolved = resolvePharmacyImageWithAssignments(slug, slot, ctx);
    return {
      slot,
      imageKey: resolved.imageKey,
      imagePack: resolved.imagePack,
      libraryRef: resolved.libraryRef,
      assetPath: resolved.assetPath,
      assetExists: resolved.assetExists,
      alt: resolved.alt,
      source: resolved.source,
    };
  });
}

export function buildVisualExperiencePage(
  slug: string,
  serviceId: VisualExperienceServiceId,
  options?: {
    selectedServiceId?: string;
    generationReport?: GenerationReport;
    sourcePathOverride?: string;
    pageSlug?: string;
    contentContextOverride?: ContentGenerationContext;
  },
): VisualExperienceBuildResult {
  const selectedServiceId = options?.selectedServiceId || serviceId;
  if (selectedServiceId !== serviceId) {
    throw new Error(`Service source lock mismatch: requested ${selectedServiceId}, building ${serviceId}`);
  }

  const config = VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId];
  const key = slug;
  const html = renderVisualServicePageHtml({
    slug: key,
    serviceId,
    pageSlug: options?.pageSlug,
    contentContextOverride: options?.contentContextOverride,
  });
  const sourcePath =
    options?.sourcePathOverride || resolveMasterPublishSourcePath(key, serviceId) || "";

  const outDir = path.join(WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, key, serviceId);
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, "index.html");
  fs.writeFileSync(outputPath, html, "utf8");

  if (options?.generationReport) {
    options.generationReport.visualOutputPath = outputPath;
    options.generationReport.assetsGenerated.push("visual-service-page");
  }

  return {
    serviceId,
    serviceName: config.serviceName,
    sourcePath,
    outputPath,
    previewUrl: `/api/pharmacy-visual-experience/${serviceId}/`,
    imageSlots: collectImageSlotReport(slug, serviceId),
  };
}

export function buildAllVisualExperiencePages(slug = "pharmaconnect"): VisualExperienceBuildResult[] {
  return VISUAL_EXPERIENCE_BENCHMARK_SERVICES.map((serviceId) => buildVisualExperiencePage(slug, serviceId));
}

export function renderVisualExperienceIndex(
  slug = "pharmaconnect",
  results?: VisualExperienceBuildResult[],
): string {
  const pages = results ?? loadVisualExperienceIndex(slug)?.results ?? [];
  const rows = pages
    .map(
      (r) => `<tr>
<td><strong>${esc(r.serviceName)}</strong></td>
<td><code>${esc(r.serviceId)}</code></td>
<td><a href="${esc(r.previewUrl)}">Open page</a></td>
<td><a href="/api/pharmacy-visual-experience/${esc(r.serviceId)}/before/">Before (master publish)</a></td>
<td>${r.imageSlots.filter((s) => s.assetExists).length}/4 assets</td>
</tr>`,
    )
    .join("\n");

  const slotTables = pages
    .map((r) => {
      const slotRows = r.imageSlots
        .map(
          (s) =>
            `<tr><td>${esc(s.slot)}</td><td><code>${esc(s.libraryRef)}</code></td><td>${s.assetExists ? "Assigned" : "Pending"}</td><td>${esc(s.alt)}</td></tr>`,
        )
        .join("\n");
      return `<section><h2>${esc(r.serviceName)}</h2>
<table><thead><tr><th>Slot</th><th>Library ref</th><th>Asset</th><th>Alt</th></tr></thead><tbody>${slotRows}</tbody></table></section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>PharmaConnect Service Page Template — ${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;margin:0;padding:24px;background:#f8fafc;color:#1a3347}
.wrap{max-width:960px;margin:0 auto}
h1{margin:0 0 8px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0 32px}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:14px}
th{background:#f1f5f9}
a{color:var(--brand-primary, #1a5c42)}
section{margin-bottom:24px}
</style>
</head>
<body>
<div class="wrap">
<h1>PharmaConnect Service Page Template — ${esc(PHARMACY_VISUAL_PIPELINE_VERSION)}</h1>
<p>Unified profile-driven pipeline for all pharmacy service pages. Master content unchanged.</p>
<table>
<thead><tr><th>Service</th><th>ID</th><th>Page</th><th>Before</th><th>Assets</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>Image slot mapping</h2>
${slotTables}
</div>
</body>
</html>`;
}

export function sanitiseVisualExperienceServiceId(raw: string): VisualExperienceServiceId | null {
  const clean = path.basename(raw);
  return (VISUAL_EXPERIENCE_BENCHMARK_SERVICES as readonly string[]).includes(clean)
    ? (clean as VisualExperienceServiceId)
    : null;
}

export function sanitiseVisualExperienceSlug(raw: string): string {
  return String(raw || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

export function loadVisualExperienceIndex(
  slug = "pharmaconnect",
): { version: number; generatedAt: string; results: VisualExperienceBuildResult[] } | null {
  const file = path.join(WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, slug, "_visual-experience-index.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as {
    version: number;
    generatedAt: string;
    results: VisualExperienceBuildResult[];
  };
}

export function resolveVisualExperienceHtmlPath(
  serviceId: string,
  slug = "pharmaconnect",
): string | null {
  const safeSlug = sanitiseVisualExperienceSlug(slug);
  const file = path.join(WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, safeSlug, serviceId, "index.html");
  return fs.existsSync(file) ? file : null;
}

/** Build benchmark visual pages when missing (consolidated pipeline). */
export function ensureVisualExperiencePages(slug = "pharmaconnect"): VisualExperienceBuildResult[] {
  const safeSlug = sanitiseVisualExperienceSlug(slug);
  const missing = VISUAL_EXPERIENCE_BENCHMARK_SERVICES.filter(
    (serviceId) => !resolveVisualExperienceHtmlPath(serviceId, safeSlug),
  );
  if (!missing.length) {
    return loadVisualExperienceIndex(safeSlug)?.results ?? [];
  }
  return buildAllVisualExperiencePages(safeSlug);
}

export function validateVisualExperienceHtml(html: string, _serviceId?: string): {
  pass: boolean;
  failures: string[];
  checks?: Record<string, boolean>;
} {
  return validatePharmacyServicePageHtml(html);
}

export function resolveMasterPublishBeforePath(serviceId: string, slug = "pharmaconnect"): string | null {
  const safeSlug = sanitiseVisualExperienceSlug(slug);
  const file = path.join(WORKSPACE_ROOT, MASTER_PUBLISH_SOURCE_ROOT, safeSlug, serviceId, "index.html");
  return fs.existsSync(file) ? file : null;
}

export { PHARMACY_SERVICE_PAGE_TEMPLATE_ID, PHARMACY_VISUAL_PIPELINE_VERSION };
