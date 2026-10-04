/**
 * Location cluster page renderer — locked local-cluster-v1 contract.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalAreaEvidenceRecord, LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import { resolveLocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
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
import { PHARMACY_VISUAL_PIPELINE_VERSION, type PharmacyTheme } from "./pharmacyThemeEngine.ts";
import { visualServicePageBodyAttributes } from "./pharmacyVisualServicePageRenderer.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { buildImageRenderContext } from "./pharmacyVisualExperience.ts";
import { renderServicePageImagePanel } from "./pharmacyServicePageImageComponent.ts";
import { renderLocalityHeroImagePanel } from "./pharmacyLocalityHeroImageResolver.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { pharmacyLocalPageResponsiveStyleBlock } from "./pharmacyLocalPageResponsiveStyles.ts";
import { LOCAL_CLUSTER_CONTRACT_ID, LOCAL_CLUSTER_V1_CONTRACT, usesPharmacyFirstPatientJourneyLocalTemplate } from "./pharmacyLocalPageTypeContracts.ts";
import { buildLocalClusterHubPageContent, canonicalClusterNarrativeRequest } from "./pharmacyLocalHubClusterContentEngine.ts";
import { installSavedLocalIntroductionForRender, readPreparedCanonicalClusterNarrative } from "./pharmacyLocalClusterContentEngine.ts";
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
import {
  aiLocalCopyPilotPath,
  aiLocalCopyRecordPath,
  latestAiLocalCopyPilotVersion,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { resolveClusterPageSlug } from "./pharmacyClusterPageUrlResolver.ts";
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { renderNhsPharmacyFirstConditionGridHtml } from "./pharmacyFirstConditionTracks.ts";
import { bindCurrentRegisteredApprovedBank } from "./pharmacyApprovedBankRunProvenance.ts";
import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import fs from "node:fs";
import path from "node:path";

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

/** Signature yellow-green from the Yorkshire Pharmacy wordmark. */
const PHARMACY_WORDMARK_LIME = "#78B820";
const CORPORATE_ROYAL_BLUE = "#005EB8";

function hexChannels(hex: string): { r: number; g: number; b: number } | null {
  const m = String(hex || "")
    .trim()
    .replace("#", "")
    .match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function isYellowGreenAccent(hex: string): boolean {
  const c = hexChannels(hex);
  if (!c) return false;
  return c.g > c.r + 20 && c.g > c.b + 20;
}

function clusterBrandTokens(theme: PharmacyTheme): { royal: string; accent: string; text: string } {
  const royal = String(theme.primaryColor || CORPORATE_ROYAL_BLUE).trim() || CORPORATE_ROYAL_BLUE;
  const storedAccent = String(theme.accentColor || "").trim();
  const accent = isYellowGreenAccent(storedAccent) ? storedAccent : PHARMACY_WORDMARK_LIME;
  return {
    royal,
    accent,
    text: String(theme.mutedTextColor || "#334155").trim() || "#334155",
  };
}

function clusterBrandCanvasLockCss(brand: { royal: string; accent: string; text: string }): string {
  const royal = esc(brand.royal);
  const accent = esc(brand.accent);
  const text = esc(brand.text);
  return `<style data-clinical-canvas-lock="v1">
body.bg-white.text-slate-800.font-sans.min-h-screen{background:#ffffff !important;color:${text} !important;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif !important;min-height:100vh;}
.cluster-heading{color:${royal} !important;}
.cluster-cta{background:${royal} !important;color:#ffffff !important;border:0 !important;}
.cluster-accent-text{color:${accent} !important;}
.cluster-accent-bg{background:${accent} !important;color:#ffffff !important;}
.cluster-accent-border{border-color:${accent} !important;}
#hero-section{background:#ffffff !important;padding:3rem 0 !important;border:0 !important;}
#hero-section [data-hero-split="50-50"]{display:flex;flex-direction:column;gap:2.5rem;align-items:stretch;}
@media (min-width:768px){
  #hero-section [data-hero-split="50-50"]{flex-direction:row;align-items:center;}
  #hero-section [data-hero-split="50-50"] > *{width:50%;flex:0 0 50%;}
}
#hero-section h1{color:${royal} !important;font-size:clamp(2.25rem,4vw,3rem) !important;letter-spacing:-.03em !important;font-weight:650 !important;}
#hero-section a.cluster-cta{background:${royal} !important;color:#ffffff !important;border:0 !important;box-shadow:0 12px 28px rgba(0,94,184,.22);}
#hero-section .rounded-2xl.shadow-md{border-radius:1rem;box-shadow:0 8px 24px rgba(15,23,42,.08);border:1px solid #f1f5f9;overflow:hidden;}
#hero-section .rounded-2xl.shadow-md img,#hero-section .rounded-2xl.shadow-md .hero-image-wrap,#hero-section .rounded-2xl.shadow-md .image-panel{width:100%;height:100%;border-radius:1rem;overflow:hidden;}
#hero-section table{display:contents;}
#hero-section .hero-hook{font-weight:500;color:${text};font-size:1.125rem;line-height:1.7;margin:1.25rem 0 0;}
#cluster-context{background:#F8FAFC !important;}
#cluster-context article{background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(15,23,42,.06);border-radius:.75rem;padding:1.5rem;transition:box-shadow .2s ease;}
#cluster-context article:hover{box-shadow:0 8px 24px rgba(15,23,42,.08);}
#cluster-context article h3{color:${royal} !important;}
#cluster-local-introduction .local-context-callout,#cluster-context .local-context-callout{background:#F8FAFC;border:1px solid #e8eef5;border-left:4px solid ${accent};box-shadow:0 10px 32px rgba(15,23,42,.05);border-radius:1.5rem;padding:2.75rem 2.5rem;margin:0;max-width:none;width:100%;overflow:visible;}
#cluster-local-introduction .local-context-callout p,#cluster-context .local-context-callout p{margin:0 0 1.35rem;font-weight:450;color:${text};font-size:1.125rem;line-height:1.85;max-height:none;-webkit-line-clamp:unset;overflow:visible;}
#cluster-local-introduction .local-context-callout p:last-child,#cluster-context .local-context-callout p:last-child{margin-bottom:0;}
#nearby-help-footer .nearby-help-row{margin:0;}
#nearby-help-footer .nearby-help-label{margin:0 0 .65rem;font-weight:650;color:${royal};font-size:.95rem;}
#nearby-help-footer .nearby-help-tags{display:flex;flex-wrap:wrap;gap:.5rem;}
#nearby-help-footer .nearby-help-tag{display:inline-flex;align-items:center;padding:.4rem .85rem;border-radius:999px;border:1px solid #dbe7f4;background:#ffffff;color:${royal};font-size:.875rem;font-weight:600;text-decoration:none;box-shadow:0 1px 2px rgba(15,23,42,.04);}
#nearby-help-footer .nearby-help-tag:hover{border-color:${royal};background:#f8fbff;}
#conditions-grid{background:#F8FAFC;padding:3.5rem 0;}
#conditions-grid .conditions-authority-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:14px;margin-top:1.5rem;}
#conditions-grid .condition-track-card{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:22px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:1rem;box-shadow:0 1px 2px rgba(15,23,42,.06);}
#conditions-grid .condition-track-icon{width:2.5rem;height:2.5rem;color:${royal};display:flex;align-items:center;justify-content:center;}
#conditions-grid .condition-track-icon svg{width:1.75rem;height:1.75rem;}
#conditions-grid .condition-track-card h3{margin:0;font-size:.95rem;line-height:1.35;color:${royal};font-weight:650;}
@media (max-width:1100px){#conditions-grid .conditions-authority-grid{grid-template-columns:repeat(4,minmax(0,1fr));}}
@media (max-width:720px){#conditions-grid .conditions-authority-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
#cluster-trust .trust-split-row{display:grid;grid-template-columns:1fr;gap:2.5rem;align-items:center;}
@media (min-width:768px){#cluster-trust .trust-split-row{grid-template-columns:1fr 1fr;}}
#cluster-trust .trust-media{margin:0;}
#cluster-trust .trust-media img,#cluster-trust .trust-media .image-panel{width:100%;height:100%;min-height:22rem;object-fit:cover;border-radius:1rem;display:block;}
#child-areas .clinical-timeline{list-style:none;margin:2rem 0 0;padding:0;display:flex;flex-direction:column;gap:0;}
#child-areas .clinical-timeline-item{display:flex;align-items:stretch;gap:1.25rem;margin:0;}
#child-areas .clinical-timeline-rail{display:flex;flex-direction:column;align-items:center;flex:0 0 2.5rem;width:2.5rem;}
#child-areas .clinical-step-badge{position:relative;z-index:1;flex:0 0 2.5rem;background:${accent} !important;color:#ffffff !important;}
#child-areas .clinical-timeline-path{display:block;width:2px;flex:1 1 auto;min-height:1.5rem;background:${accent};opacity:.35;margin:8px 0 0;}
#child-areas .clinical-timeline-body{flex:1 1 auto;margin-bottom:1.25rem;}
</style>`;
}

function publicHref(ctx: ContentGenerationContext, target: Parameters<typeof resolveLocalPagePublicPath>[0]): string {
  return resolveLocalPagePublicPath(target, ctx.serviceId);
}

function renderSectionHead(title: string, intro = ""): string {
  const heading = String(title || "").trim();
  const lead = String(intro || "").trim();
  if (!heading && !lead) return "";
  return `<div class="clinical-section-head mb-8">${heading ? `<h2 class="cluster-heading font-semibold">${esc(heading)}</h2>` : ""}${lead ? `<p class="text-slate-600 leading-relaxed mt-2">${esc(lead)}</p>` : ""}</div>`;
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

function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function heroHookParagraph(heroIntroduction: string): string {
  return bodyToParagraphs(heroIntroduction)[0] || compactText(heroIntroduction);
}

function localContextParagraphs(localIntroduction: string, heroIntroduction: string, extraParagraphs: string[] = []): string[] {
  const heroHook = compactText(heroHookParagraph(heroIntroduction));
  const raw = String(localIntroduction || "").trim();
  const fromPayload = raw
    ? raw.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)
    : [];
  const extras = extraParagraphs.map((row) => String(row || "").trim()).filter(Boolean);
  const seen = new Set<string>();
  const paras: string[] = [];
  for (const paragraph of [...fromPayload, ...extras]) {
    const key = compactText(paragraph);
    if (!key || key === heroHook || seen.has(key)) continue;
    seen.add(key);
    paras.push(paragraph);
  }
  if (!paras.length && raw && compactText(raw) !== heroHook) paras.push(raw);
  return paras;
}

function nearbyCatchmentAreaTags(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): Array<{ name: string; href: string }> {
  const currentKey = slugifyArea(cluster.name) || resolveClusterPageSlug(cluster.slug);
  const seen = new Set<string>([currentKey]);
  const rows: Array<{ name: string; href: string }> = [];
  const push = (name: string, slugHint = "") => {
    const trimmed = String(name || "").trim();
    const key = slugifyArea(trimmed) || resolveClusterPageSlug(slugHint || trimmed);
    if (!trimmed || !key || seen.has(key)) return;
    seen.add(key);
    rows.push({
      name: trimmed,
      href: publicHref(ctx, resolveLocalClusterTarget(key, trimmed)),
    });
  };
  for (const row of [...(hierarchy.clusters || []), ...(hierarchy.generationAreas || [])]) {
    if (row.slug === cluster.slug || slugifyArea(row.name) === currentKey) continue;
    push(row.name, row.slug);
  }
  for (const area of ctx.selectedAreas || []) push(area.areaName, area.areaSlug);
  for (const name of ctx.coverageAreas || []) push(name);
  for (const name of ctx.rawProfile?.rankingAreas || []) push(name);
  return rows.slice(0, 9);
}

function renderNearbyHelpTagRow(areas: Array<{ name: string; href: string }>): string {
  if (!areas.length) return "";
  return `<div class="nearby-help-row">
<p class="nearby-help-label">Nearby areas we also help:</p>
<div class="nearby-help-tags">${areas
    .map((area) => `<a class="nearby-help-tag" href="${esc(area.href)}">${esc(area.name)}</a>`)
    .join("")}</div>
</div>`;
}

function renderLocalContextCallout(paragraphs: string[], evidenceAttr: string): string {
  if (!paragraphs.length) return "";
  return `<section id="cluster-local-introduction" class="py-10 bg-white" data-template-block="local-introduction" data-content-field="localIntroduction"${evidenceAttr}>
<div class="max-w-6xl mx-auto px-6">
<div class="local-context-callout w-full">
${paragraphs
  .map((p) => `<p class="text-slate-700 text-lg leading-relaxed">${esc(p)}</p>`)
  .join("\n")}
</div>
</div>
</section>`;
}

function renderHubAuthorityConditions(): string {
  return renderNhsPharmacyFirstConditionGridHtml()
    .replace('<div class="wrap">', '<div class="max-w-6xl mx-auto px-6">')
    .replace("<h2>", '<h2 class="cluster-heading font-semibold">');
}

const CLINICAL_JOURNEY_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Speak with our clinical pharmacy team",
    body: "Ask about a Pharmacy First consultation and how to prepare. Bring a list of current medicines and note when symptoms started.",
  },
  {
    title: "Private clinical assessment",
    body: "The pharmacist discusses your symptoms, medical history, and any previous checks in a private consultation.",
  },
  {
    title: "Personalised care path & treatments",
    body: "You receive clear guidance. Where clinically appropriate this may include advice, NHS treatment, or referral to another healthcare professional.",
  },
];

const REDUNDANT_SAFETY_LINES = [
  "not for every illness",
  "persistent or worsening symptoms",
  "pregnancy and very young children",
  "problems already under gp review",
];

function isRedundantSafetyLine(value: string): boolean {
  return REDUNDANT_SAFETY_LINES.includes(
    String(value || "")
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase(),
  );
}

type SavedProcessStep = { title: string; body: string; bullets?: string[] };

function emptySavedCopy(): {
  heroIntroduction: string;
  localIntroduction: string;
  serviceDefinitionParagraphs: string[];
  processHeading: string;
  processSteps: SavedProcessStep[];
} {
  return {
    heroIntroduction: "",
    localIntroduction: "",
    serviceDefinitionParagraphs: [],
    processHeading: "",
    processSteps: [],
  };
}

function readProcessSteps(value: unknown): SavedProcessStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        title: String(item.title || "").trim(),
        body: String(item.body || "").trim(),
        bullets: Array.isArray(item.bullets)
          ? item.bullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
          : [],
      };
    })
    .filter((step) => step.title || step.body || (step.bullets || []).length);
}

function readSavedCopyFields(file: string): {
  heroIntroduction: string;
  localIntroduction: string;
  serviceDefinitionParagraphs: string[];
  processHeading: string;
  processSteps: SavedProcessStep[];
} {
  try {
    if (!fs.existsSync(file)) return emptySavedCopy();
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      outputCopy?: {
        heroIntroduction?: string;
        localIntroduction?: string;
        serviceDefinitionParagraphs?: string[];
        processHeading?: string;
        processSteps?: SavedProcessStep[];
      };
      heroIntroduction?: string;
      localIntroduction?: string;
      serviceDefinitionParagraphs?: string[];
      processHeading?: string;
      processSteps?: SavedProcessStep[];
    };
    const copy = raw.outputCopy || raw;
    const serviceDefinitionParagraphs = Array.isArray(copy.serviceDefinitionParagraphs)
      ? copy.serviceDefinitionParagraphs.map((row) => compactText(row)).filter(Boolean).slice(0, 5)
      : [];
    return {
      heroIntroduction: compactText(copy.heroIntroduction),
      localIntroduction: String(copy.localIntroduction || "").trim(),
      serviceDefinitionParagraphs,
      processHeading: String(copy.processHeading || "").trim(),
      processSteps: readProcessSteps(copy.processSteps),
    };
  } catch {
    return emptySavedCopy();
  }
}

function clusterAreaLookupSlugs(cluster: LocalAreaEvidenceRecord): string[] {
  const resolved = resolveClusterPageSlug(cluster.slug);
  const fromName = slugifyArea(cluster.name);
  const lastSeg = String(cluster.slug || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop() || "";
  const lastNorm = resolveClusterPageSlug(lastSeg);
  return [...new Set([fromName, lastNorm, lastSeg, resolved].filter(Boolean))];
}

function loadLiveHeroAndLocalIntroduction(
  ctx: ContentGenerationContext,
  cluster: LocalAreaEvidenceRecord,
  content?: { base?: { heroIntro?: string; localRelevanceBody?: string } },
): {
  heroIntroduction: string;
  localIntroduction: string;
  serviceDefinitionParagraphs: string[];
  processHeading: string;
  processSteps: SavedProcessStep[];
  extraLocalParagraphs: string[];
} {
  const overlay =
    clusterAreaLookupSlugs(cluster)
      .map((slug) => getSessionAiLocalCopy(slug))
      .find((row) => row && (row.heroIntroduction || row.localIntroduction || row.serviceDefinitionParagraphs?.length)) || null;
  let fromPilot = emptySavedCopy();
  let fromCandidate = emptySavedCopy();
  for (const areaSlug of clusterAreaLookupSlugs(cluster)) {
    const version = latestAiLocalCopyPilotVersion(ctx.resolvedSlug, ctx.serviceId, areaSlug);
    if (!fromPilot.heroIntroduction && !fromPilot.localIntroduction && !fromPilot.serviceDefinitionParagraphs.length) {
      fromPilot = readSavedCopyFields(aiLocalCopyPilotPath(ctx.resolvedSlug, ctx.serviceId, areaSlug, version));
    }
    if (!fromCandidate.heroIntroduction && !fromCandidate.localIntroduction && !fromCandidate.serviceDefinitionParagraphs.length) {
      fromCandidate = readSavedCopyFields(aiLocalCopyRecordPath(ctx.resolvedSlug, ctx.serviceId, areaSlug));
    }
  }
  const heroIntroduction =
    compactText(overlay?.heroIntroduction) ||
    fromPilot.heroIntroduction ||
    fromCandidate.heroIntroduction ||
    compactText(content?.base?.heroIntro?.split(/\n\n+/)[0] || content?.base?.heroIntro);
  const localIntroduction =
    String(overlay?.localIntroduction || "").trim() ||
    fromPilot.localIntroduction ||
    fromCandidate.localIntroduction ||
    String(content?.base?.localRelevanceBody || "").trim();
  const processHeading =
    String(overlay?.processHeading || "").trim() || fromPilot.processHeading || fromCandidate.processHeading;
  const processSteps = overlay?.processSteps?.length
    ? overlay.processSteps
    : fromPilot.processSteps.length
      ? fromPilot.processSteps
      : fromCandidate.processSteps;
  const serviceDefinitionParagraphs = (
    overlay?.serviceDefinitionParagraphs?.length
      ? overlay.serviceDefinitionParagraphs
      : fromPilot.serviceDefinitionParagraphs.length
        ? fromPilot.serviceDefinitionParagraphs
        : fromCandidate.serviceDefinitionParagraphs
  )
    .map((row) => compactText(row))
    .filter(Boolean)
    .slice(0, 5);
  const extraLocalParagraphs = [
    ...(overlay?.localContextParagraphs || []),
  ]
    .map((row) => String(row || "").trim())
    .filter(Boolean);
  return { heroIntroduction, localIntroduction, serviceDefinitionParagraphs, processHeading, processSteps, extraLocalParagraphs };
}

function buildServiceDefinitionCards(
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
  uniqueParagraphs: string[] = [],
): Array<{ title: string; body: string }> {
  const unique = uniqueParagraphs.map((row) => compactText(row)).filter(Boolean).slice(0, 5);
  if (unique.length) {
    return unique.map((body) => ({ title: "", body }));
  }
  const cards: Array<{ title: string; body: string }> = [];
  const push = (title: string, body: string) => {
    const text = compactText(body);
    if (!text || cards.some((card) => card.body === text)) return;
    cards.push({ title: compactText(title), body: text });
  };
  push("", content.clusterContextIntro);
  for (const paragraph of bodyToParagraphs(content.clusterContextBody)) push("", paragraph);
  for (const bullet of content.base.whyChecksBullets || []) push("", bullet);
  if (cards.length < 5) {
    for (const paragraph of bodyToParagraphs(content.base.whyChecksBody || "")) push("", paragraph);
  }
  if (cards.length < 5) {
    const leftovers = [content.clusterContextBody, content.base.whyChecksBody || ""]
      .join(" ")
      .split(/(?<=[.!?])\s+/)
      .map((row) => compactText(row))
      .filter((row) => row.length > 40);
    for (const sentence of leftovers) {
      push("", sentence);
      if (cards.length >= 5) break;
    }
  }
  return cards.slice(0, 5);
}

function clusterBreadcrumb(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): string {
  const serviceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });
  void hierarchy;
  return `<nav class="local-breadcrumb max-w-6xl mx-auto px-6 py-4 text-sm text-slate-500" aria-label="Breadcrumb" data-template-block="breadcrumbs"><a class="cluster-heading font-semibold" href="${esc(serviceHref)}">${esc(ctx.serviceName)}</a> <span aria-hidden="true">›</span> <span class="cluster-heading">${esc(cluster.name)}</span></nav>`;
}

function renderChildAreasSection(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
  intro: string,
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
  overlayProcess: { heading: string; steps: SavedProcessStep[] } = { heading: "", steps: [] },
  hubMode = false,
): string {
  void overlayProcess;
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
            `<a class="area-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6" href="${esc(publicHref(ctx, resolveLocalAreaTarget(a.slug, a.name)))}"><h3 class="cluster-heading font-semibold">${esc(ctx.serviceName)} in ${esc(a.name)}</h3><p class="text-slate-600">${esc(`Guidance for patients living in or travelling from ${a.name}.`)}</p></a>`,
        )
        .join("\n")
    : supporting
        .map((item) => {
          const list = item.bullets?.length
            ? `<ul class="clean">${item.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
            : "";
          return `<article class="area-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6" data-locality-evidence="${esc(item.evidence)}"><h3 class="cluster-heading font-semibold">${esc(item.title)}</h3>${item.body ? `<p class="text-slate-600">${esc(item.body)}</p>` : ""}${list}</article>`;
        })
        .join("\n");
  const heading = hubMode ? "What happens next" : `What happens next in ${cluster.name}`;
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
    lockedJourney || (hasMarkers && fallbackSteps.length)
      ? ""
      : hasMarkers || (!fallbackSteps.length && introText.trim())
        ? bodyToParagraphs(introText)
            .map((p) => `<p class="text-slate-600 leading-relaxed">${esc(p)}</p>`)
            .join("\n")
        : "";
  const extraHtml =
    lockedJourney || !(childAreas.length && !direct)
      ? ""
      : `<div class="areas-grid grid grid-cols-1 md:grid-cols-2 gap-6">${cards}</div>`;
  const timelineItems = CLINICAL_JOURNEY_STEPS;
  const timeline = `<ol class="clinical-timeline mt-8" data-clinical-timeline="true">
${timelineItems
  .map((step, index) => {
    const isLast = index === timelineItems.length - 1;
    return `<li class="clinical-timeline-item">
<div class="clinical-timeline-rail" aria-hidden="true">
<span class="clinical-step-badge cluster-accent-bg inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-semibold">${index + 1}</span>
${isLast ? "" : `<span class="clinical-timeline-path"></span>`}
</div>
<div class="clinical-timeline-body bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
<h3 class="cluster-heading font-semibold">${esc(step.title)}</h3>
<p class="text-slate-600 leading-relaxed mt-1">${esc(step.body)}</p>
</div>
</li>`;
  })
  .join("\n")}
</ol>`;
  return `<section class="py-14 bg-white" id="child-areas" data-template-block="child-areas" data-locality-evidence="${esc(
    (content.base.sectionEvidence?.supporting || []).join("|"),
  )}">
<div class="max-w-4xl mx-auto px-6">
${renderSectionHead(heading, "")}
${introHtml}
${hasMarkers && fallbackSteps.length ? `<div hidden data-strategy-markers="true">${esc(introText)}</div>` : ""}
${timeline}
${extraHtml}
</div>
</section>`;
}

function renderClusterClosingCta(
  ctx: ContentGenerationContext,
  profile: ReturnType<typeof buildPharmacyServicePageProfile>,
): string {
  const html = usesApprovedBankLocalLayout(ctx.serviceId)
    ? renderApprovedBankServiceHubCtaHtml(ctx.serviceName, ctx.serviceId, "")
    : buildProfileFinalCtaHtml(ctx.serviceName, profile, "", "", "", ctx);
  return html.replace(/<section class="section-band conversion-image-section"[\s\S]*?<\/section>\s*/i, "");
}

/**
 * Visible Local Patient Copy V1 next step.
 * ctaPhonePrompt is the synthesised nextStep. The shared service-hub CTA is not this copy.
 */
function renderVisibleLocalPatientNextStep(nextStep: string): string {
  const text = String(nextStep || "").trim();
  if (!text) return "";
  return `<section data-template-block="local-next-step" id="local-next-step" class="py-8 bg-white">
<div class="max-w-6xl mx-auto px-6">
<p class="locality-cta-context bg-slate-50 border-l-4 cluster-accent-border rounded-2xl p-6 text-slate-600" data-locality-cta>${esc(text)}</p>
</div>
</section>`;
}

function renderClusterLinksSection(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
  hubMode = false,
): string {
  if (hubMode) return "";
  const childAreas = hierarchy.areas.filter((a) => a.parentAreaId === cluster.areaId);
  const rankedFromNearby = content.base.nearbyLocalityLinks?.length
    ? content.base.nearbyLocalityLinks
        .map((n) => hierarchy.clusters.find((c) => c.slug === n.areaSlug || c.name === n.areaName))
        .filter((c): c is NonNullable<typeof c> => Boolean(c) && c.slug !== cluster.slug)
    : [];
  const relatedOnly = usesApprovedBankLocalLayout(ctx.serviceId);
  const lockedJourney = usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId);
  if (lockedJourney) {
    const tags = renderNearbyHelpTagRow(nearbyCatchmentAreaTags(ctx, hierarchy, cluster));
    if (!tags) {
      return `<section class="py-10 bg-white" id="nearby-help-footer" data-template-block="parent-child-links" hidden></section>`;
    }
    return `<section class="py-10 bg-white" id="nearby-help-footer" data-template-block="parent-child-links" data-locality-evidence="${esc(
      (content.base.sectionEvidence?.internalLinks || []).join("|"),
    )}">
<div class="max-w-6xl mx-auto px-6">
${tags}
</div>
</section>`;
  }
  const ranked = relatedOnly
    ? hierarchy.clusters.filter((c) => c.slug !== cluster.slug)
    : rankedFromNearby.length
      ? rankedFromNearby
      : hierarchy.clusters.filter((c) => c.slug !== cluster.slug);
  const serviceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });
  const links = relatedOnly
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
  const relatedHeading = relatedOnly
    ? `Other ${ctx.serviceName} locality pages`
    : resolveLocalSectionHeading({
        kind: "related-locations",
        pageType: "location-cluster",
        serviceName: ctx.serviceName,
        localityLabel: cluster.name,
      });
  return `<section class="py-10 bg-white" data-template-block="parent-child-links" data-locality-evidence="${esc(
    (content.base.sectionEvidence?.internalLinks || []).join("|"),
  )}">
<div class="max-w-6xl mx-auto px-6">
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
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
  serviceName: string,
  consultationImageHtml: string,
): string {
  const fallbackTitle = `Staying safe with ${serviceName}`;
  const storedTitle = String(content.base.trustHeading || "").trim();
  const title = /pharmacy first/i.test(serviceName)
    ? "When to contact a GP, NHS 111 or emergency services"
    : storedTitle || fallbackTitle;
  const intro = content.base.trustIntro?.trim() || "";
  const { prose } = splitTrustProseAndBullets(intro ? "" : content.base.trustBody, []);
  const proseText = [intro, prose, content.base.trustBody].find((row) => String(row || "").trim()) || "";
  const proseHtml = bodyToParagraphs(proseText)
    .filter((p) => !isRedundantSafetyLine(p))
    .map((p) => `<p class="text-slate-600 leading-relaxed">${esc(p)}</p>`)
    .join("\n");
  return `<section class="py-14 bg-white" id="cluster-trust" data-template-block="trust-split">
<div class="max-w-6xl mx-auto px-6">
<div class="grid grid-cols-1 md:grid-cols-2 gap-10 items-center trust-split-row">
<div class="trust-prose">
<h2 class="cluster-heading font-semibold">${esc(title)}</h2>
${proseHtml}
</div>
<div class="trust-media rounded-2xl overflow-hidden shadow-md border border-slate-100">
${consultationImageHtml}
</div>
</div>
</div>
</section>`;
}

function renderClusterFaqSection(
  content: ReturnType<typeof buildLocalClusterHubPageContent>,
  ctx: ContentGenerationContext,
  clusterName: string,
  areaSlug = "",
): string {
  const faqHeading = usesApprovedBankLocalLayout(ctx.serviceId)
    ? `Common ${ctx.serviceName} questions`
    : resolveLocalFaqSectionHeading({
        pageType: "location-cluster",
        serviceName: ctx.serviceName,
        localityLabel: clusterName,
      });
  const source = content.base.faqs
    .filter((f) => String(f.question || "").trim() && String(f.answer || "").trim())
    .slice(0, 6);
  if (!source.length) return "";
  const rotate = hashSeed(areaSlug || clusterName, "faq-spin") % source.length;
  const items = [...source.slice(rotate), ...source.slice(0, rotate)];
  const layout = ["grid-two", "stack", "featured-first", "grid-alternating"][
    hashSeed(areaSlug || clusterName, "faq-layout") % 4
  ];
  const gridClass =
    layout === "stack" || layout === "featured-first"
      ? "grid grid-cols-1 gap-6 max-w-3xl"
      : "grid grid-cols-1 md:grid-cols-2 gap-6";
  const cards = items
    .map(
      (f) =>
        `<div class="cluster-faq-item faq-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6"><h3 class="faq-q cluster-heading font-semibold">${esc(f.question)}</h3><p class="faq-a text-slate-600 leading-relaxed">${esc(f.answer)}</p></div>`,
    )
    .join("\n");
  return `<section class="faq py-10 bg-white" id="faq-section" data-template-block="faq" data-faq-layout="${esc(layout)}" data-preview-access="unlocked">
<div class="max-w-6xl mx-auto px-6">${renderSectionHead(faqHeading, "")}<div class="${gridClass}">${cards}</div></div>
</section>`;
}

function ensureCanonicalNarrativeForRender(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): void {
  try {
    readPreparedCanonicalClusterNarrative(ctx.serviceId, cluster.slug);
    return;
  } catch {
    /* Saved campaign copy is enough to unlock the renderer. */
  }
  const copy = loadLiveHeroAndLocalIntroduction(ctx, cluster);
  const request = canonicalClusterNarrativeRequest(ctx, hierarchy, cluster);
  installSavedLocalIntroductionForRender(request.input, request.ctx, copy);
}

export type ClusterRenderPageKind = "location-cluster" | "service-hub";

function hubSyntheticCluster(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
): LocalAreaEvidenceRecord {
  return {
    areaId: "service-hub",
    name: hierarchy.primaryLocality || ctx.profile.town || ctx.serviceName,
    slug: "service-hub",
    type: "city-town-hub",
    parentAreaId: null,
    source: "corporate-service-hub",
    evidence: [],
    serviceIds: [ctx.serviceId],
    generationEligible: true,
    generationReason: "corporate-service-hub",
    approved: true,
    order: 0,
    priority: 0,
  };
}

export function renderLocalClusterLocationPageHtml(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
  options: { pageKind?: ClusterRenderPageKind } = {},
): string {
  const hubMode = options.pageKind === "service-hub";
  ensureCanonicalNarrativeForRender(ctx, hierarchy, cluster);
  const key = resolveTenantProfileSlug(ctx.resolvedSlug) || ctx.resolvedSlug;
  const baseProfile = ctx.profile ?? buildPharmacyServicePageProfile(key);
  const brandDna = resolveBrandDnaForRender(key);
  const profile = applyBrandDnaToServicePageProfile(baseProfile, brandDna);
  const theme = buildPharmacyThemeWithBrandDna(baseProfile, brandDna);
  const brand = clusterBrandTokens(theme);
  const components = resolvePageComponents(theme, brandDna);
  const componentDna = resolvePageComponentDna(theme, brandDna);
  const content = buildLocalClusterHubPageContent(ctx, hierarchy, cluster);
  const supportedLinks = resolveTenantSupportedAreaLinks(ctx, hierarchy, "public");
  const mainServiceHref = publicHref(ctx, { pageType: "service", localSegment: ctx.serviceId });

  const imageCtx = buildImageRenderContext(key, ctx.serviceId as VisualExperienceServiceId);
  imageCtx.location = hubMode ? profile.town || cluster.name : cluster.name;
  imageCtx.pageSlug = hubMode ? ctx.serviceId : resolveClusterPageSlug(cluster.slug) || cluster.slug;
  const heroImageHtml = hubMode
    ? renderServicePageImagePanel(imageCtx, "hero", "hero-image-wrap hero-media")
    : renderLocalityHeroImagePanel({
        tenantSlug: key,
        serviceId: ctx.serviceId,
        areaSlug: resolveClusterPageSlug(cluster.slug) || cluster.slug,
        areaName: cluster.name,
        imageCtx,
      }).html;
  const consultationImageHtml = renderServicePageImagePanel(
    imageCtx,
    "support",
    "image-panel support-block-media",
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
  const primaryCtaHref = hubMode
    ? resolveContactCtaHref(renderProfile, ctaLabel) || "#local-access"
    : lockedJourney
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

  const {
    heroIntroduction,
    localIntroduction,
    serviceDefinitionParagraphs,
    processHeading,
    processSteps,
    extraLocalParagraphs,
  } = loadLiveHeroAndLocalIntroduction(ctx, cluster, content);
  const heroHook = hubMode
    ? heroHookParagraph(content.base.heroIntro || heroIntroduction)
    : heroHookParagraph(heroIntroduction);
  const localCalloutParagraphs = hubMode
    ? []
    : localContextParagraphs(localIntroduction, heroIntroduction, extraLocalParagraphs);
  const heroHeading = hubMode
    ? ctx.serviceName
    : heroIntroduction
      ? `${ctx.serviceName} in ${cluster.name}`
      : lockedJourney
        ? `${ctx.serviceName} — ${cluster.name}`
        : `${ctx.serviceName} for patients from ${cluster.name}`;
  const evidenceAttr = (content.base.sectionEvidence?.["local-introduction"] || []).length
    ? ` data-locality-evidence="${esc((content.base.sectionEvidence?.["local-introduction"] || []).join("|"))}"`
    : "";
  const hero = `<section class="bg-white py-12 md:py-16" id="hero-section" data-template-block="hero" data-component-variant="${esc(components.heroVariant || "clinical-split")}">
<div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:items-center gap-10" data-hero-split="50-50">
<div class="w-full md:w-1/2">
<p class="cluster-accent-text font-semibold tracking-wide uppercase text-sm mb-3">${esc(servicePageHeroEyebrow(ctx, renderProfile, ctx.serviceName))}</p>
<h1 class="text-4xl md:text-5xl font-semibold tracking-tight cluster-heading">${esc(heroHeading)}</h1>
${
  heroHook
    ? `<p class="hero-hook hero-intro font-medium text-slate-700 text-lg leading-relaxed mt-5" data-content-field="heroIntroduction">${esc(heroHook)}</p>`
    : ""
}
<div class="flex flex-wrap gap-3 mt-6">
<a class="cluster-cta inline-flex items-center justify-center rounded-full text-white px-6 py-3 font-semibold shadow-sm" href="${esc(primaryCtaHref)}">${esc(ctaLabel)}</a>
${
  directionsUrl
    ? `<a class="inline-flex items-center justify-center rounded-full bg-white cluster-heading px-6 py-3 font-semibold border border-slate-200" href="${esc(directionsUrl)}">${esc(
        usesApprovedBankLocalLayout(ctx.serviceId) ? content.base.ctaSecondary || "Get directions" : "Get directions",
      )}</a>`
    : ""
}
</div>
</div>
<div class="w-full md:w-1/2">
<div class="rounded-2xl shadow-md border border-slate-100 overflow-hidden">${heroImageHtml}</div>
</div>
</div>
</section>`;

  const registered = usesApprovedBankLocalLayout(ctx.serviceId);
  const serviceCards = buildServiceDefinitionCards(content, hubMode ? [] : serviceDefinitionParagraphs);
  const localOverview = hubMode ? "" : renderLocalContextCallout(localCalloutParagraphs, evidenceAttr);
  const conditionsGrid = hubMode ? renderHubAuthorityConditions() : "";
  const clusterContextGrid =
    !String(content.clusterContextHeading || "").trim() && !serviceCards.length
      ? ""
      : `${renderSectionHead(String(content.clusterContextHeading || `What ${ctx.serviceName} is`).trim(), "")}
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
${serviceCards
  .map(
    (card) => `<article class="bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-xl p-6 transition-all">
<p class="text-slate-600 leading-relaxed">${esc(card.body)}</p>
</article>`,
  )
  .join("\n")}
</div>`;
  const clusterContext = !clusterContextGrid
    ? ""
    : `<section id="cluster-context" class="py-14" style="background:#F8FAFC" data-template-block="service-definition">
<div class="max-w-6xl mx-auto px-6">
${clusterContextGrid}
</div>
</section>`;
  const localIntroductionBand = localOverview;
  const childAreas = renderChildAreasSection(
    ctx,
    hierarchy,
    cluster,
    content.childAreasIntro,
    content,
    {
      heading: processHeading,
      steps: processSteps,
    },
    hubMode,
  );
  const preparation = registered
    ? renderApprovedBankLocalityPreparationHtml({
        heading: content.base.clinicalEnvironmentHeading,
        body: content.base.clinicalEnvironmentBody,
        bullets: content.base.preparationBullets,
      })
    : "";
  const trust = renderClusterTrustSection(content, ctx.serviceName, consultationImageHtml);
  const access = renderProfileLocalAccessSectionHtml(ctx.serviceName, renderProfile, ctx, {
    title: hubMode ? `Visit ${renderProfile.pharmacyName}` : content.base.accessHeading || `Travelling from ${cluster.name}`,
    town: hubMode ? renderProfile.town || cluster.name : cluster.name,
    includeCoverageTags: !lockedJourney && !hubMode,
    localAreaLinks: lockedJourney || hubMode ? [] : supportedLinks,
    intro: content.base.accessBody,
  });
  const links = renderClusterLinksSection(ctx, hierarchy, cluster, content, hubMode);
  const faq = renderClusterFaqSection(
    content,
    ctx,
    hubMode ? renderProfile.town || ctx.serviceName : cluster.name,
    hubMode ? ctx.serviceId : resolveClusterPageSlug(cluster.slug) || cluster.slug,
  );
  const localNextStep = lockedJourney || hubMode ? "" : renderVisibleLocalPatientNextStep(content.base.ctaPhonePrompt);
  const closing = renderClusterClosingCta(ctx, renderProfile);
  const main = hubMode
    ? [hero, conditionsGrid, clusterContext, childAreas, trust, access, faq, closing].join("\n")
    : [
        hero,
        localIntroductionBand,
        clusterContext,
        childAreas,
        trust,
        preparation,
        localNextStep,
        access,
        faq,
        closing,
        links,
      ].join("\n");

  const title = hubMode
    ? `${ctx.serviceName} | ${profile.pharmacyName}`
    : content.base.seoTitle || `${ctx.serviceName} in ${cluster.name} | ${profile.pharmacyName}`;
  const metaDesc = hubMode
    ? `${profile.pharmacyName} provides ${ctx.serviceName} for eligible NHS Pharmacy First conditions.`
    : content.base.metaDescription ||
      `${profile.pharmacyName} provides ${ctx.serviceName} for patients in ${cluster.name}.`;
  const pageKind = hubMode ? "service-hub" : "location-cluster";
  const breadcrumb = hubMode
    ? `<nav class="local-breadcrumb max-w-6xl mx-auto px-6 py-4 text-sm text-slate-500" aria-label="Breadcrumb" data-template-block="breadcrumbs"><span class="cluster-heading">${esc(ctx.serviceName)}</span></nav>`
    : clusterBreadcrumb(ctx, hierarchy, cluster);

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
<meta name="local-page-contract" content="${hubMode ? "service-hub-v1" : LOCAL_CLUSTER_CONTRACT_ID}"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
${buildGoogleFontsLink(theme)}
${buildPharmacyServicePageStyleBlock(theme)}
${localPageTypeTypographyStyleBlock()}
${pharmacyLocalPageResponsiveStyleBlock()}
${clinicalPatientTemplateHeadAssets()}
${clusterBrandCanvasLockCss(brand)}
</head>
<body ${visualServicePageBodyAttributes(ctx.serviceId)} ${componentDnaBodyAttributes(componentDna)} class="bg-white text-slate-800 font-sans min-h-screen" style="--cluster-brand-royal:${esc(brand.royal)};--cluster-brand-accent:${esc(brand.accent)};--cluster-brand-text:${esc(brand.text)};--brand-cta:${esc(brand.royal)};--brand-heading:${esc(brand.royal)};--brand-heading-primary:${esc(brand.royal)};--brand-accent:${esc(brand.accent)};" ${CLINICAL_PATIENT_TEMPLATE_ATTR} data-pharmacy-template="${PHARMACY_SERVICE_PAGE_TEMPLATE_ID}" data-local-page-kind="${pageKind}" data-local-page-contract="${hubMode ? "service-hub-v1" : LOCAL_CLUSTER_CONTRACT_ID}" data-publish-source="${hubMode ? "corporate-service-hub" : "local-cluster-v1"}" data-local-cluster="${esc(cluster.slug)}" data-preview-access="unlocked" data-local-section-arrangement="" data-location-component="${HOMEPAGE_LOCATION_COMPONENT_ID}"${registered ? ` data-approved-bank-locality-contract="approved-bank-locality-page-v1"` : ""}>
${renderPharmacyServicePageHeader(renderProfile, theme)}
<main id="main-content" class="bg-white text-slate-800 font-sans min-h-screen">
${breadcrumb}
${main}
</main>
${renderPharmacyServicePageFooter(renderProfile, ctx.serviceName, theme)}
</body>
</html>`;

  if (!hubMode) assertLocalPageContractOrThrow(html, LOCAL_CLUSTER_V1_CONTRACT);
  return html;
}

export function renderServiceHubPageHtml(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
): string {
  return renderLocalClusterLocationPageHtml(ctx, hierarchy, hubSyntheticCluster(ctx, hierarchy), {
    pageKind: "service-hub",
  });
}

export function renderCorporateServiceHubForTenant(tenantSlug: string, serviceId: string): string {
  const ctx = bindCurrentRegisteredApprovedBank(buildContentGenerationContext(tenantSlug, serviceId));
  const hierarchy = resolveLocalLocationHierarchy(tenantSlug, serviceId, ctx.rawProfile);
  return renderServiceHubPageHtml(ctx, hierarchy);
}

export function writeCorporateServiceHubPage(tenantSlug: string, serviceId: string): string {
  const html = renderCorporateServiceHubForTenant(tenantSlug, serviceId);
  const visualDir = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", tenantSlug, serviceId);
  fs.mkdirSync(visualDir, { recursive: true });
  const visualPath = path.join(visualDir, "index.html");
  fs.writeFileSync(visualPath, html, "utf8");
  const ecosystemDir = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", tenantSlug, serviceId, "service");
  fs.mkdirSync(ecosystemDir, { recursive: true });
  fs.writeFileSync(path.join(ecosystemDir, "index.html"), html, "utf8");
  return visualPath;
}
