/**
 * Review Centre Preview resolution — maps customer Preview actions to generated outputs.
 * Read-only. Does not approve, publish, generate, or mutate campaign state.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveVisualExperienceHtmlPath } from "./pharmacyVisualExperience.ts";
import {
  discoverGeneratedReviewOutputs,
  getContentPackageReviewSections,
  loadContentPackage,
} from "./pharmacyContentPackageService.ts";
import { currentRunPreviewQuery, resolvePreviewSourceFromPackage } from "./pharmacyApprovedBankRunProvenance.ts";
import { loadCampaignImagePlan } from "./growthEngineCampaignBuilderImagePlanService.ts";
import {
  renderBenchmarkPagePreviewHtml,
  renderCampaignImageReviewPreview,
  renderMissingReviewPreview,
  renderPackPreviewPage,
  renderReviewPreviewChooser,
  resolveBenchmarkPackAsset,
} from "./pharmacyContentEcosystemPreviewRoute.ts";
import {
  CANONICAL_MAIN_PAGE_CANDIDATE_ASSET,
  writeCanonicalMainPageCandidate,
} from "./pharmacyCanonicalMainPageCandidateRenderer.ts";
import {
  CANDIDATE_PREVIEW_BANNER,
  LOCAL_AREA_PAGE_CANDIDATE_ASSET,
  localPageCandidateHtmlPath,
  renderLocalAreaPageCandidateUnavailable,
} from "./contentEngine/pharmacyLocalPageCandidatePaths.ts";
import {
  AI_CANDIDATE_PREVIEW_BANNER,
  AI_LOCAL_AREA_PAGE_CANDIDATE_ASSET,
  AI_LOCAL_AREA_PAGE_PILOT_V2_ASSET,
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  AI_LOCAL_REVISION_COMPARISON_V3_ASSET,
  AI_LOCAL_STRATEGY_VARIANT_V3_ASSET,
  AI_LOCAL_PILOT_V2_AREAS,
  AI_PILOT_V2_PREVIEW_BANNER,
  AI_PILOT_V3_PREVIEW_BANNER,
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalPageCandidateHtmlPath,
  aiLocalPagePilotHtmlPath,
  isAuthorisedAiLocalPilotV3Area,
  renderAiLocalAreaPageCandidateUnavailable,
  renderAiLocalAreaPagePilotUnavailable,
  renderAiLocalAreaPagePilotUnavailableV3,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { renderWombwellRevisionComparisonPreview } from "./pharmacyAiLocalRevisionComparisonPreviewV3.ts";
import { renderStrategyVariantComparisonPreview } from "./pharmacyAiLocalStrategyVariantPreviewV3.ts";
import {
  SALES_DEMO_BROOK_SERVICE_PAGE_ASSET,
  renderBrookSalesDemoServicePreview,
} from "./pharmacySalesDemoBrookServicePreview.ts";
import {
  SERVICE_NOTICE_DRAFT_PREVIEW_ASSET,
  renderServiceNoticeDraftPreview,
} from "./pharmacyServiceNoticePreview.ts";
import {
  SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET,
  renderServicePageMasterTemplatePreview,
} from "./pharmacyServicePageMasterTemplatePreview.ts";

export type ReviewCentrePreviewResult = {
  html: string;
  sourcePath: string | null;
  sourceRoute: string;
  runId: string | null;
  approvedBankHash: string | null;
};

function previewBase(slug: string, campaignId: string, assetKey: string, runId: string | null, bankHash: string | null): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(assetKey)}${currentRunPreviewQuery(runId, bankHash)}`;
}

function packIdForSourcePath(sourcePath: string): string | null {
  const base = path.basename(sourcePath).replace(/\.(json|md)$/i, "");
  if (base === "gbp-posts") return "gbp-pack";
  if (base === "social-posts") return "social-pack";
  if (base === "email-sequence") return "email-sequence";
  if (base === "video-script") return "video-script";
  return null;
}

function missing(
  slug: string,
  campaignId: string,
  title: string,
  provenance: { runId: string | null; approvedBankHash: string | null },
): ReviewCentrePreviewResult {
  return {
    html: renderMissingReviewPreview(slug, campaignId, title),
    sourcePath: null,
    sourceRoute: "review-preview-unavailable",
    runId: provenance.runId,
    approvedBankHash: provenance.approvedBankHash,
  };
}

export function renderReviewCentrePreviewAsset(
  slug: string,
  campaignId: string,
  assetKey: string,
  options: { areaSlug?: string; pageSlug?: string; itemId?: string; slot?: string; revision?: string } = {},
): ReviewCentrePreviewResult {
  const pkg = loadContentPackage(slug, campaignId);
  const provenance = resolvePreviewSourceFromPackage(pkg, assetKey, options.areaSlug);
  const discovery = discoverGeneratedReviewOutputs(slug, campaignId);
  const previewRoot = previewBase(slug, campaignId, assetKey, provenance.runId, provenance.approvedBankHash);

  if (assetKey === CANONICAL_MAIN_PAGE_CANDIDATE_ASSET) {
    const written = writeCanonicalMainPageCandidate(slug, campaignId);
    return {
      html: written.html,
      sourcePath: written.outputPath,
      sourceRoute: "canonical-main-page-candidate",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === LOCAL_AREA_PAGE_CANDIDATE_ASSET) {
    const areaSlug = String(options.areaSlug || "")
      .trim()
      .toLowerCase();
    const unavailable = {
      html: renderLocalAreaPageCandidateUnavailable(areaSlug),
      sourcePath: null as string | null,
      sourceRoute: "review-preview-candidate-unavailable",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
    if (!areaSlug) return unavailable;
    const file = localPageCandidateHtmlPath(slug, campaignId, areaSlug);
    if (!fs.existsSync(file)) return unavailable;
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes(CANDIDATE_PREVIEW_BANNER) || !/noindex,\s*nofollow/i.test(html)) {
      return unavailable;
    }
    return {
      html,
      sourcePath: file,
      sourceRoute: "local-area-page-candidate",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === AI_LOCAL_AREA_PAGE_CANDIDATE_ASSET) {
    const areaSlug = String(options.areaSlug || "")
      .trim()
      .toLowerCase();
    const unavailable = {
      html: renderAiLocalAreaPageCandidateUnavailable(areaSlug),
      sourcePath: null as string | null,
      sourceRoute: "review-preview-ai-candidate-unavailable",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
    if (!areaSlug) return unavailable;
    const file = aiLocalPageCandidateHtmlPath(slug, campaignId, areaSlug);
    if (!fs.existsSync(file)) return unavailable;
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes(AI_CANDIDATE_PREVIEW_BANNER) || !/noindex,\s*nofollow/i.test(html)) {
      return unavailable;
    }
    return {
      html,
      sourcePath: file,
      sourceRoute: "ai-local-area-page-candidate",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === AI_LOCAL_AREA_PAGE_PILOT_V2_ASSET) {
    const areaSlug = String(options.areaSlug || "")
      .trim()
      .toLowerCase();
    const unavailable = {
      html: renderAiLocalAreaPagePilotUnavailable(areaSlug),
      sourcePath: null as string | null,
      sourceRoute: "review-preview-ai-pilot-v2-unavailable",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
    if (!areaSlug || !(AI_LOCAL_PILOT_V2_AREAS as readonly string[]).includes(areaSlug)) return unavailable;
    const file = aiLocalPagePilotHtmlPath(slug, campaignId, areaSlug);
    if (!fs.existsSync(file)) return unavailable;
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes(AI_PILOT_V2_PREVIEW_BANNER) || !/noindex,\s*nofollow/i.test(html)) {
      return unavailable;
    }
    if (/approve|publish/i.test(html) && /data-approval-control/i.test(html)) return unavailable;
    return {
      html,
      sourcePath: file,
      sourceRoute: "ai-local-area-page-pilot-v2",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET) {
    const areaSlug = String(options.areaSlug || "")
      .trim()
      .toLowerCase();
    const unavailable = {
      html: renderAiLocalAreaPagePilotUnavailableV3(areaSlug),
      sourcePath: null as string | null,
      sourceRoute: "review-preview-ai-pilot-v3-unavailable",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
    if (!areaSlug || !isAuthorisedAiLocalPilotV3Area(slug, areaSlug)) return unavailable;
    const file = aiLocalPagePilotHtmlPath(slug, campaignId, areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
    if (!fs.existsSync(file)) return unavailable;
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes(AI_PILOT_V3_PREVIEW_BANNER) || !/noindex,\s*nofollow/i.test(html)) {
      return unavailable;
    }
    if (/approve|publish/i.test(html) && /data-approval-control/i.test(html)) return unavailable;
    return {
      html,
      sourcePath: file,
      sourceRoute: "ai-local-area-page-pilot-v3",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === AI_LOCAL_REVISION_COMPARISON_V3_ASSET) {
    const allowed =
      slug === "yorkshire-pharmacy-and-health-clinic" && campaignId === "pharmacy-first";
    const rendered = renderWombwellRevisionComparisonPreview(allowed ? String(options.revision || "") : "");
    return {
      html: rendered.html,
      sourcePath: rendered.sourcePath,
      sourceRoute: rendered.sourceRoute,
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === AI_LOCAL_STRATEGY_VARIANT_V3_ASSET) {
    const allowed =
      slug === "yorkshire-pharmacy-and-health-clinic" && campaignId === "pharmacy-first";
    const rendered = renderStrategyVariantComparisonPreview(allowed ? String(options.areaSlug || "") : "");
    return {
      html: rendered.html,
      sourcePath: rendered.sourcePath,
      sourceRoute: rendered.sourceRoute,
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === SERVICE_NOTICE_DRAFT_PREVIEW_ASSET) {
    const rendered = renderServiceNoticeDraftPreview(slug, campaignId, { areaSlug: options.areaSlug });
    return {
      html: rendered.html,
      sourcePath: rendered.sourcePath,
      sourceRoute: rendered.sourceRoute,
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === SERVICE_PAGE_MASTER_TEMPLATE_V1_ASSET) {
    const rendered = renderServicePageMasterTemplatePreview(slug, campaignId, { areaSlug: options.areaSlug });
    return {
      html: rendered.html,
      sourcePath: rendered.sourcePath,
      sourceRoute: rendered.sourceRoute,
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === SALES_DEMO_BROOK_SERVICE_PAGE_ASSET) {
    const rendered = renderBrookSalesDemoServicePreview(slug, campaignId);
    return {
      html: rendered.html,
      sourcePath: rendered.sourcePath,
      sourceRoute: rendered.sourceRoute,
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === "service-page") {
    const file = resolveVisualExperienceHtmlPath(campaignId as never, slug);
    if (!file || !fs.existsSync(file)) {
      return missing(slug, campaignId, "Service page", provenance);
    }
    return {
      html: renderBenchmarkPagePreviewHtml(file, campaignId, slug, "service-page"),
      sourcePath: file,
      sourceRoute: "review-wrapper-service-page",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === "local-area-pages") {
    const areaSlug = String(options.areaSlug || "").trim().toLowerCase();
    if (!areaSlug) {
      const items = discovery.localPages
        .filter((page) => page.outputPath)
        .map((page) => ({
          title: page.areaName,
          href: `${previewRoot}&area=${encodeURIComponent(page.areaSlug)}`,
        }));
      return {
        html: renderReviewPreviewChooser(slug, campaignId, "Local area pages", items),
        sourcePath: null,
        sourceRoute: "review-preview-local-chooser",
        runId: provenance.runId,
        approvedBankHash: provenance.approvedBankHash,
      };
    }
    const page = discovery.localPages.find((row) => row.areaSlug === areaSlug);
    if (!page?.outputPath || !fs.existsSync(page.outputPath)) {
      return missing(slug, campaignId, page?.areaName || "Local area page", provenance);
    }
    return {
      html: renderBenchmarkPagePreviewHtml(page.outputPath, campaignId, slug, page.areaSlug),
      sourcePath: page.outputPath,
      sourceRoute: "review-wrapper-generated-locality",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === "blog") {
    const pageSlug = String(options.pageSlug || "").trim();
    if (!pageSlug) {
      const items = discovery.blogPages.map((page) => ({
        title: page.title,
        href: `${previewRoot}&page=${encodeURIComponent(page.id)}`,
      }));
      return {
        html: renderReviewPreviewChooser(slug, campaignId, "Blog articles", items),
        sourcePath: null,
        sourceRoute: "review-preview-blog-chooser",
        runId: provenance.runId,
        approvedBankHash: provenance.approvedBankHash,
      };
    }
    const page = discovery.blogPages.find((row) => row.id === pageSlug);
    if (!page?.outputPath || !fs.existsSync(page.outputPath)) {
      return missing(slug, campaignId, "Blog article", provenance);
    }
    return {
      html: renderBenchmarkPagePreviewHtml(page.outputPath, campaignId, slug, page.id),
      sourcePath: page.outputPath,
      sourceRoute: "review-wrapper-blog-page",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  if (assetKey === "images") {
    const plan = loadCampaignImagePlan(slug, campaignId);
    const slots = (plan?.slots || []).map((slot) => ({
      slot: slot.slot,
      label: slot.label,
      previewUrl: slot.previewUrl,
    }));
    if (!slots.length) {
      return missing(slug, campaignId, "Campaign images", provenance);
    }
    return {
      html: renderCampaignImageReviewPreview(slug, campaignId, slots, options.slot),
      sourcePath: null,
      sourceRoute: "review-preview-campaign-images",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  const section = getContentPackageReviewSections(slug, campaignId).find((sec) => sec.type === assetKey);
  const sourcePath = section?.outputPath || null;
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return missing(slug, campaignId, section?.title || "Campaign content", provenance);
  }

  if (fs.existsSync(sourcePath) && /\.html$/i.test(sourcePath)) {
    return {
      html: renderBenchmarkPagePreviewHtml(sourcePath, campaignId, slug, path.basename(path.dirname(sourcePath))),
      sourcePath,
      sourceRoute: "review-wrapper-page",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  const packId = packIdForSourcePath(sourcePath);
  if (packId) {
    const asset = resolveBenchmarkPackAsset(campaignId, packId, slug);
    const html = asset ? renderPackPreviewPage(asset, campaignId, slug) : null;
    if (!html) {
      return missing(slug, campaignId, section?.title || "Campaign content", provenance);
    }
    return {
      html,
      sourcePath,
      sourceRoute: "review-wrapper-pack",
      runId: provenance.runId,
      approvedBankHash: provenance.approvedBankHash,
    };
  }

  return missing(slug, campaignId, section?.title || "Campaign content", provenance);
}
