/**
 * Campaign Builder UX V2 — premium commercial presentation.
 */
import {
  allCampaignBuilderAssetsApproved,
  buildCampaignBuilderAreaOptions,
  buildCampaignBuilderList,
  buildCampaignBuilderReviewItems,
  campaignBuilderPublishUrl,
  campaignBuilderReadyToPublish,
  campaignBuilderStepUrl,
  campaignPackageSelectionRows,
  loadCampaignBuilderSession,
  ensureCampaignBuilderImageDefaults,
  resolveCampaignBuilderAssetSelection,
  resolveCampaignBuilderPackageOutputs,
  type CampaignBuilderStep,
} from "./growthEngineCampaignBuilderService.ts";
import { authoritativeCampaignPackageTotal } from "./growthEngineCampaignModel.ts";
import { buildCampaignBuilderImagePlan } from "./growthEngineCampaignBuilderImagePlanService.ts";
import { buildCampaignGenerationSummary, type CampaignGenerationSummaryAssetRow } from "./growthEngineCampaignBuilderGenerationSummaryService.ts";
import { buildCampaignImageStrategyView } from "./growthEngineCampaignBuilderImageStrategyService.ts";
import type { CampaignBuilderAssetSelection, CampaignBuilderImageSlotPlan, CampaignBuilderImageStrategy } from "./growthEngineCampaignBuilderModel.ts";
import {
  AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL,
  GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL,
  listSelectedOneLocalPageCandidateAreas,
  preflightOneLocalPageCandidate,
  resolveOneLocalPageCandidateArea,
} from "./growthEngineLocalPageCandidateService.ts";
import { planOneLocalPageEvidencePreparation } from "./growthEngineLocalPageEvidencePreparationService.ts";
import { decorateLocalPageEvidencePlan } from "./growthEngineLocalPageEvidenceCollectionService.ts";
import {
  CREATE_REMAINING_LOCAL_PAGES_LABEL,
  RESUME_REMAINING_LOCAL_PAGES_LABEL,
  getRemainingLocalPagesCampaign,
} from "./growthEngineLocalPageCampaignRunService.ts";
import {
  CREATE_TEN_LOCAL_SERVICE_PAGES_LABEL,
  RESUME_TEN_LOCAL_SERVICE_PAGES_LABEL,
  getUkLocalServicePagesCampaign,
} from "./growthEngineLocalPageUkServicePagesCampaignRunService.ts";
import {
  IMPROVE_LOCAL_PAGES_LABEL,
  RESUME_IMPROVE_LOCAL_PAGES_LABEL,
  getLocalPageImprovementCampaign,
} from "./growthEngineLocalPageImprovementRunService.ts";
import {
  RESTORE_LOCAL_PAGE_VARIATION_LABEL,
  RESUME_RESTORE_LOCAL_PAGE_VARIATION_LABEL,
  getLocalPageVariationRestoreCampaign,
} from "./growthEngineLocalPageVariationRestoreRunService.ts";
import { BROOK_DERBY_DEMO_SLUG } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { loadSalesDemoBrookDerbyAreaSelection } from "./pharmacySalesDemoBrookDerbyAreaSelection.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import {
  tenantImageLibraryPanelCss,
} from "./pharmacyTenantImageLibraryPanel.ts";
import {
  CB_UX_BUILD_CAMPAIGN,
  CB_UX_REGENERATE_CAMPAIGN,
  CB_UX_REGENERATE_VERSION_EXPLAIN,
  CB_UX_REGENERATE_CONFIRM_CHECKBOX,
  CB_UX_GENERATE_MY_CAMPAIGN,
  CB_UX_CHOOSE_SUBTITLE,
  CB_UX_CHOOSE_TITLE,
  CB_UX_CHOOSE_SELECTED_SUBTITLE,
  CB_UX_SELECTED_PRIORITY_BANNER,
  CB_UX_RECOMMENDED_BANNER,
  cbUxSelectedPriorityCopy,
  CB_UX_STEP_LABELS,
  cbUxBuildTimeDisplay,
  cbUxDisplayBadge,
  cbUxExistingCardCopy,
  cbUxMarketingAssetCount,
  cbUxMissingCardCopy,
  cbUxRecommendedWhy,
} from "./growthEngineCampaignBuilderUxV2.ts";
import { contentPackageGenerated } from "./pharmacyContentPackageService.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";
import {
  campaignRecommendationIntelligenceStyles,
} from "./growthEngineCampaignRecommendationIntelligenceRender.ts";
import {
  campaignExplorerStyles,
  renderCampaignExplorerPanel,
  renderReturnToRecommendedLink,
} from "./growthEngineCampaignExplorerRender.ts";
import { buildCampaignExplorerCatalog } from "./growthEngineCampaignExplorerService.ts";
import { campaignBuilderWizardUrl } from "./growthEngineCampaignBuilderRoutingService.ts";
import { buildCampaignRegenerationPreview } from "./growthEngineCampaignBuilderRegenerationService.ts";
import { resolveAuthoritativeCampaignPriority } from "./growthEngineGrowthPlanResolver.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

const STEPS: { id: CampaignBuilderStep; label: string; num: number }[] = [
  { id: "choose", label: CB_UX_STEP_LABELS.choose, num: 1 },
  { id: "areas", label: CB_UX_STEP_LABELS.areas, num: 2 },
  { id: "settings", label: CB_UX_STEP_LABELS.settings, num: 3 },
  { id: "images", label: CB_UX_STEP_LABELS.images, num: 4 },
  { id: "overview", label: CB_UX_STEP_LABELS.overview, num: 5 },
  { id: "approval", label: CB_UX_STEP_LABELS.approval, num: 6 },
  { id: "review", label: CB_UX_STEP_LABELS.review, num: 7 },
];

export function campaignBuilderPageCss(): string {
  return `
${tenantImageLibraryPanelCss()}
.cb-shell{max-width:920px;margin:0 auto;padding:32px 20px 80px;overflow-x:hidden;box-sizing:border-box}
.cb-hero{background:${commercialBlueChromeGradientCss()};border-radius:24px;padding:32px 28px;color:#fff;margin-bottom:28px;box-shadow:0 20px 50px rgba(15,23,42,.12)}
.cb-hero h1{margin:0 0 10px;font-size:28px;font-weight:900;letter-spacing:-.02em}
.cb-hero p{margin:0;font-size:15px;color:#dbeafe;line-height:1.65;max-width:640px}
.cb-steps{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}
.cb-step{font-size:11px;font-weight:800;padding:8px 14px;border-radius:999px;background:#fff;color:#64748b;border:1px solid #e2e8f0;text-decoration:none}
.cb-step.active{background:#005eb8;color:#fff;border-color:#005eb8}
.cb-step.done{background:#ecfdf5;color:#166534;border-color:#bbf7d0}
.cb-panel{background:#fff;border:1px solid #e8edf3;border-radius:24px;padding:28px;margin-bottom:24px;box-shadow:0 12px 40px rgba(15,23,42,.05);min-width:0;max-width:100%;box-sizing:border-box}
.cb-panel h2{margin:0 0 8px;font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-.02em}
.cb-lead{margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.65}
.cb-section{margin-top:28px}
.cb-section h3{margin:0 0 14px;font-size:17px;font-weight:800;color:#0f172a}
.cb-premium{border:1px solid #e2e8f0;border-radius:22px;padding:26px;margin-bottom:20px;background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.04)}
.cb-premium.recommended{border-color:#005eb8;background:linear-gradient(180deg,#f8fbff 0%,#fff 100%)}
.cb-premium-banner{font-size:12px;font-weight:800;color:#005eb8;margin-bottom:10px;letter-spacing:.02em}
.cb-premium-stars{color:#f59e0b;font-size:14px;letter-spacing:2px;margin-bottom:8px}
.cb-premium-kicker{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px}
.cb-premium-name{margin:0 0 12px;font-size:26px;font-weight:900;color:#0f172a;letter-spacing:-.02em}
.cb-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;padding:7px 12px;border-radius:999px;margin-bottom:14px}
.cb-badge.grow{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}
.cb-badge.new{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
.cb-copy{margin:0 0 18px;font-size:15px;color:#334155;line-height:1.7}
.cb-includes{margin:0 0 18px;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 16px}
.cb-includes li{font-size:14px;color:#334155}
.cb-includes li:before{content:"✓ ";color:#059669;font-weight:800}
.cb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:18px 0 22px;min-width:0}
.cb-stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;min-width:0;overflow:hidden}
.cb-stat strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:6px}
.cb-stat span{font-size:18px;font-weight:900;color:#0f172a;overflow-wrap:anywhere;word-break:break-word}
.cb-business-stats{grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));align-items:stretch}
.cb-business-stats .cb-stat{min-width:0;overflow:hidden;box-sizing:border-box}
.cb-business-stats .cb-stat strong{font-weight:800;font-size:13px;text-transform:none;letter-spacing:0;color:#0f172a}
.cb-business-stats .cb-stat span,.cb-business-stats .cb-stat a{display:block;max-width:100%;font-size:15px;font-weight:400;line-height:1.5;color:#334155;overflow-wrap:anywhere;word-break:break-word}
.cb-primary-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#005eb8;color:#fff;border:0;border-radius:14px;padding:14px 22px;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 10px 24px rgba(0,94,184,.22)}
.cb-primary-cta:hover{background:#00478a}
.cb-primary-cta:disabled{opacity:.55;cursor:not-allowed}
.cb-regen-confirm{margin-top:18px;padding:18px;border:1px solid #bfdbfe;border-radius:16px;background:#f8fbff}
.cb-regen-confirm[hidden]{display:none!important}
.cb-regen-confirm h4{margin:0 0 10px;font-size:16px;font-weight:800;color:#0f172a}
.cb-regen-dl{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:8px 16px;margin:0 0 16px;font-size:14px}
.cb-regen-dl dt{font-weight:800;color:#64748b}
.cb-regen-dl dd{margin:0;color:#0f172a;overflow-wrap:anywhere}
.cb-primary-cta.ghost{background:#fff;color:#334155;border:1px solid #e2e8f0;box-shadow:none}
.cb-image-source{margin-top:28px;padding-top:8px;border-top:1px solid #e2e8f0}
.cb-image-source h3{margin:0 0 8px;font-size:17px;font-weight:800;color:#0f172a}
.cb-image-source .cb-lead{margin:0 0 14px}
.cb-image-card{background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:10px;font-size:12px;color:#334155}
.cb-image-card.selected{border-color:#005eb8;background:#f8fbff;box-shadow:0 0 0 1px #93c5fd}
.cb-image-card img{width:100%;height:88px;object-fit:cover;border-radius:8px;background:#fff;border:1px solid #e2e8f0}
.cb-image-card label{display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-top:8px;font-weight:700}
.cb-image-meta{margin-top:6px;color:#64748b;word-break:break-word}
.cb-stock-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px;margin-top:14px;align-items:stretch}
.cb-stock-card{display:flex;flex-direction:column;height:100%;min-height:210px;overflow:hidden;box-sizing:border-box}
.cb-stock-card img,.cb-stock-card .cb-stock-preview{width:100%;aspect-ratio:16/9;height:auto;min-height:0;object-fit:cover;border-radius:8px;background:#fff;border:1px solid #e2e8f0}
.cb-stock-card .cb-stock-preview{display:flex;align-items:center;justify-content:center;color:#64748b;border-style:dashed}
.cb-stock-card .cb-image-meta{flex:0 0 auto;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;word-break:normal}
.cb-stock-card label{display:flex;align-items:flex-start;gap:8px;margin-top:auto;padding-top:8px;overflow:hidden;line-height:1.35;font-weight:700}
.cb-stock-card label input{flex:0 0 auto;margin:2px 0 0}
.cb-stock-card .cb-stock-state{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.cb-ai-choice{display:flex;flex-direction:column;gap:10px;margin:12px 0}
.cb-ai-choice label{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:2px solid #e2e8f0;border-radius:12px;background:#f8fafc;cursor:pointer;font-size:14px;color:#334155}
.cb-ai-choice label.selected{border-color:#005eb8;background:#f8fbff}
.cb-totals{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin:22px 0}
.cb-total-card{background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #e2e8f0;border-radius:16px;padding:18px 14px;text-align:center}
.cb-total-card strong{display:block;font-size:28px;font-weight:900;color:#0f172a;line-height:1}
.cb-total-card span{display:block;font-size:12px;color:#64748b;font-weight:700;margin-top:6px}
.cb-total-card .cb-icon{font-size:22px;margin-bottom:8px}
.cb-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:18px}
.cb-setting{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fafbfc;display:flex;gap:12px;align-items:flex-start}
.cb-setting input{margin-top:4px;scale:1.1}
.cb-setting label{font-size:15px;font-weight:700;color:#0f172a;cursor:pointer}
.cb-setting span{display:block;font-size:13px;color:#64748b;font-weight:400;margin-top:4px;line-height:1.5}
.cb-ready{border:2px solid #005eb8;border-radius:24px;padding:32px 28px;background:linear-gradient(180deg,#eff6ff,#fff);text-align:center;margin-top:8px}
.cb-ready h3{margin:0 0 18px;font-size:30px;font-weight:900;color:#0f172a}
.cb-ready-meta{font-size:15px;color:#475569;line-height:1.8;margin:0 0 24px}
.cb-review-item{border:1px solid #e2e8f0;border-radius:18px;padding:20px;margin-bottom:14px;background:#fff}
.cb-review-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}
.cb-review-head h4{margin:0;font-size:17px;font-weight:800}
.cb-quality{font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;background:#dcfce7;color:#166534}
.cb-quality.mid{background:#fef3c7;color:#92400e}
.cb-quality.low{background:#fee2e2;color:#991b1b}
.cb-review-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.cb-banner{background:#ecfdf5;border:1px solid #bbf7d0;border-radius:16px;padding:16px 18px;margin-bottom:18px;font-size:15px;color:#065f46;font-weight:700}
.cb-one-local{border:2px solid #005eb8;border-radius:20px;padding:20px 22px;margin:22px 0 8px;background:linear-gradient(180deg,#f8fbff,#fff);min-width:0;max-width:100%;box-sizing:border-box;overflow-x:auto}
.cb-one-local h3{margin:0 0 10px;font-size:18px;font-weight:900;color:#0f172a}
.cb-one-local .cb-blocker{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:12px 14px;font-size:14px;font-weight:700;line-height:1.55;margin:12px 0}
.cb-one-local table{display:block;width:100%;max-width:100%;overflow-x:auto}
.cb-remaining-lists{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px;margin:12px 0 8px;min-width:0}
.cb-remaining-list{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;min-width:0;overflow:hidden}
.cb-remaining-list strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:8px}
.cb-remaining-list ul{margin:0;padding-left:18px;color:#0f172a;font-size:14px;font-weight:600;line-height:1.7;overflow-wrap:anywhere}
.cb-remaining-note{font-size:12px;font-weight:500;color:#64748b}
.cb-area-row{min-width:0;overflow-wrap:anywhere}
.cb-area-row.is-focused{border-color:#005eb8;background:#f8fbff;box-shadow:0 0 0 1px #93c5fd}
.cb-area-row-actions{margin-top:10px}
.cb-area-focus{display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#005eb8;text-decoration:none;border:1px solid #bfdbfe;background:#fff;border-radius:10px;padding:8px 12px}
.cb-area-focus[aria-current="page"]{background:#005eb8;color:#fff;border-color:#005eb8}
.cb-local-actions{margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
@media(max-width:720px){
  .cb-local-actions{flex-direction:column;align-items:stretch}
  .cb-local-actions .cb-primary-cta{width:100%}
  .cb-area-focus{width:100%}
}
.cb-demo-warning{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:16px;padding:14px 16px;margin:0 0 18px;font-size:14px;line-height:1.6}
.cb-back{display:inline-block;margin-bottom:18px;font-size:13px;font-weight:700;color:#64748b;text-decoration:none}
.cb-back:hover{color:#005eb8}
.cb-empty{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:16px;padding:22px;font-size:14px;color:#64748b;line-height:1.6}
.cb-area-summary{margin:10px 0 0;padding-left:20px;line-height:1.7;color:#0f172a;font-size:14px;font-weight:600}
.cb-area-grade{display:inline-flex;align-items:center;font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px}
.cb-area-grade.high{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}
.cb-area-grade.good{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.cb-area-grade.additional{background:#f8fafc;color:#334155;border:1px solid #e2e8f0}
.cb-area-grade.needed{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
.cb-area-explain{margin:0 0 18px;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;background:#f8fafc}
.cb-area-explain summary{cursor:pointer;font-weight:800;color:#0f172a}
.cb-area-explain p{margin:10px 0 0;font-size:14px;color:#475569;line-height:1.65}
@media(max-width:720px){
  .cb-hero h1{font-size:24px}.cb-premium-name{font-size:22px}
  .cb-stats{grid-template-columns:1fr}
  .cb-panel{padding:18px}
}
${campaignRecommendationIntelligenceStyles()}
${campaignExplorerStyles()}
`;
}

function wizardUrl(slug: string, step: CampaignBuilderStep, campaignId?: string | null): string {
  const campaign = campaignId ?? loadCampaignBuilderSession(slug).selectedServiceId;
  return campaignBuilderWizardUrl(slug, step, step === "choose" ? null : campaign);
}

function campaignBuilderAreaFocusUrl(slug: string, campaign: string, areaSlug: string): string {
  const params = new URLSearchParams({ slug, step: "areas" });
  if (campaign) params.set("campaign", campaign);
  if (areaSlug) params.set("area", areaSlug);
  return `/api/growth-engine/campaign-builder?${params.toString()}`;
}

function renderStepper(active: CampaignBuilderStep, slug: string, generated: boolean): string {
  const session = loadCampaignBuilderSession(slug);
  const order = STEPS.map((s) => s.id);
  const activeIndex = order.indexOf(active);
  return `<div class="cb-steps">${STEPS.map((s) => {
    const isActive = s.id === active;
    const stepIndex = order.indexOf(s.id);
    const isDone = stepIndex >= 0 && activeIndex > stepIndex;
    const cls = ["cb-step", isActive ? "active" : "", isDone && !isActive ? "done" : ""].filter(Boolean).join(" ");
    const href = s.id === "review" && !generated ? "#" : wizardUrl(slug, s.id);
    return `<a class="${cls}" href="${esc(href)}">${s.num}. ${s.label}</a>`;
  }).join("")}</div>`;
}

function renderIncludesList(items: Array<{ count: number; label: string }>): string {
  if (!items.length) return "";
  return `<ul class="cb-includes">${items
    .map((item) => `<li><strong>${esc(String(item.count))}</strong> ${esc(item.label)}</li>`)
    .join("")}</ul>`;
}

function renderPremiumCard(slug: string, c: ReturnType<typeof buildCampaignBuilderList>[number]): string {
  const isExisting = c.serviceContext === "existing";
  const badgeClass = isExisting ? "grow" : c.serviceContext === "missing" ? "new" : "grow";
  const badge = cbUxDisplayBadge(c);
  const copy = c.customerSelected
    ? cbUxSelectedPriorityCopy(c.serviceName)
    : isExisting
      ? cbUxExistingCardCopy(c.serviceName)
      : c.serviceContext === "missing"
        ? cbUxMissingCardCopy()
        : c.reason;
  const assetCount = cbUxMarketingAssetCount(c);
  const buildTime = cbUxBuildTimeDisplay(assetCount);
  const recommendedBlock = c.customerSelected
    ? `<div class="cb-premium-kicker">${esc(CB_UX_SELECTED_PRIORITY_BANNER)}</div>`
    : c.recommended
      ? `<div class="cb-premium-stars">★★★★★</div>
<div class="cb-premium-banner">${esc(CB_UX_RECOMMENDED_BANNER)}</div>
<p class="cb-copy" style="font-size:14px;margin-top:-6px;margin-bottom:16px">${esc(cbUxRecommendedWhy(c))}</p>`
      : `<div class="cb-premium-kicker">Growth Campaign</div>`;

  return `<div class="cb-premium${c.customerSelected || c.recommended ? " recommended" : ""}"${c.customerSelected || c.recommended ? ' id="recommended"' : ""}>
${recommendedBlock}
<h3 class="cb-premium-name">${esc(c.serviceName)}</h3>
<span class="cb-badge ${badgeClass}">🟢 ${esc(badge)}</span>
<p class="cb-copy">${esc(copy)}</p>
<p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Campaign includes</p>
${renderIncludesList(c.packageItems || [])}
<div class="cb-stats">
<div class="cb-stat"><strong>Estimated output</strong><span>${assetCount} marketing assets</span></div>
<div class="cb-stat"><strong>Estimated build time</strong><span>${esc(buildTime)}</span></div>
</div>
${renderCampaignCardAction(slug, c)}
</div>`;
}

function renderRegenerateConfirmation(slug: string, preview: NonNullable<ReturnType<typeof buildCampaignRegenerationPreview>>): string {
  const assets = preview.assetsToRegenerate.length
    ? preview.assetsToRegenerate.map((item) => `${item.count} ${item.label}`).join("; ")
    : "Campaign package assets";
  const existingVersion = `${preview.existingCampaignName} · campaign version ${preview.existingCampaignVersion}`;
  const localCount = preview.candidateJobs.length;
  return `<div class="cb-regen-confirm" id="cbRegenConfirm" hidden data-cb-generate-campaign="true">
<h4>Confirm new campaign</h4>
<p class="cb-copy">${esc(CB_UX_REGENERATE_VERSION_EXPLAIN)}</p>
<dl class="cb-regen-dl">
<dt>Pharmacy</dt><dd>${esc(preview.pharmacyName)}</dd>
<dt>Service</dt><dd>${esc(preview.serviceName)}</dd>
<dt>Saved campaign</dt><dd>${esc(existingVersion)}</dd>
<dt>Assets to create</dt><dd>${esc(assets)}</dd>
<dt>Local pages</dt><dd>${esc(String(localCount))} from the saved profile</dd>
<dt>New campaign version</dt><dd>${esc(preview.newCandidateVersion)}</dd>
</dl>
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmRegenerateCampaign"/>
<span>${esc(CB_UX_REGENERATE_CONFIRM_CHECKBOX)}</span>
</label>
<p style="margin:0">
<button type="button" class="cb-primary-cta" id="btnConfirmRegenerateCampaign" disabled data-slug="${esc(slug)}" data-service-id="${esc(preview.serviceId)}">${esc(CB_UX_REGENERATE_CAMPAIGN)}</button>
</p>
<div id="cbRegenStatus" style="margin-top:12px;font-size:14px;display:none"></div>
</div>
<script>
(function(){
  var openBtn = document.getElementById('btnOpenRegenerateCampaign');
  var panel = document.getElementById('cbRegenConfirm');
  var box = document.getElementById('confirmRegenerateCampaign');
  var btn = document.getElementById('btnConfirmRegenerateCampaign');
  var status = document.getElementById('cbRegenStatus');
  var submitting = false;
  function sync() {
    if (!btn) return;
    btn.disabled = submitting || !(box && box.checked);
  }
  openBtn && openBtn.addEventListener('click', function(){
    if (panel) panel.hidden = false;
  });
  box && box.addEventListener('change', sync);
  btn && btn.addEventListener('click', async function(){
    if (!btn || btn.disabled || submitting) return;
    submitting = true;
    sync();
    if (status) {
      status.style.display = 'block';
      status.style.color = '#005eb8';
      status.textContent = 'Creating a fresh campaign from the saved profile. Previous runs stay as inactive history.';
    }
    var slug = btn.getAttribute('data-slug');
    var serviceId = btn.getAttribute('data-service-id');
    var handoff = new URLSearchParams(location.search).get('_t');
    var auth = handoff ? '&_t=' + encodeURIComponent(handoff) : '';
    var res = await fetch('/api/growth-engine/' + slug + '/campaign-builder/regenerate-campaign?confirmed=1' + auth, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({
        serviceId: serviceId,
        confirmed: !!(box && box.checked)
      })
    });
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok) {
      submitting = false;
      sync();
      if (status) {
        status.style.display = 'block';
        status.style.color = '#991b1b';
        status.textContent = json.error || 'Confirmation is required. Nothing was created.';
      }
      return;
    }
    if (json.duplicate) {
      if (status) status.textContent = 'This campaign is already running. No extra calls were started.';
    }
    async function poll() {
      var check = await fetch('/api/growth-engine/' + slug + '/campaign-builder/regeneration-run?serviceId=' + encodeURIComponent(serviceId) + auth, {
        credentials: 'same-origin',
        headers: {'Accept':'application/json'}
      });
      var body = await check.json().catch(function(){ return {}; });
      var run = body.run || json.run || {};
      var runStatus = run.status || '';
      if (status) {
        status.style.display = 'block';
        if (runStatus === 'completed') {
          status.style.color = '#059669';
          status.textContent = 'Campaign version ' + (run.candidateVersion || '') + ' is ready. Nothing was published or indexed.';
          submitting = false;
          sync();
          return;
        }
        if (runStatus === 'stopped' || runStatus === 'interrupted') {
          status.style.color = '#991b1b';
          status.textContent = run.failedError || 'Campaign stopped. Previous runs were kept as inactive history.';
          submitting = false;
          sync();
          return;
        }
        status.style.color = '#005eb8';
        status.textContent = 'Creating campaign version ' + (run.candidateVersion || '') + (run.currentAreaSlug ? ' — ' + run.currentAreaSlug : '') + '.';
      }
      setTimeout(poll, 2500);
    }
    poll();
  });
  sync();
})();
</script>`;
}

function renderCampaignCardAction(slug: string, c: ReturnType<typeof buildCampaignBuilderList>[number]): string {
  const preview = buildCampaignRegenerationPreview(slug, c.serviceId, c, {
    requireExistingCampaign: false,
  });
  if (!preview) {
    return `<a class="cb-primary-cta" href="${esc(campaignBuilderWizardUrl(slug, "areas", c.serviceId))}">${esc(CB_UX_BUILD_CAMPAIGN)}</a>`;
  }
  return `<p class="cb-copy">${esc(CB_UX_REGENERATE_VERSION_EXPLAIN)}</p>
<button type="button" class="cb-primary-cta" id="btnOpenRegenerateCampaign">${esc(CB_UX_REGENERATE_CAMPAIGN)}</button>
${renderRegenerateConfirmation(slug, preview)}`;
}

function renderChooseStep(slug: string): string {
  const campaigns = buildCampaignBuilderList(slug);
  if (!campaigns.length) {
    return `<div class="cb-panel">
<h2>${esc(CB_UX_CHOOSE_TITLE)}</h2>
<p class="cb-lead">We need a little more information from your Growth Plan before we can recommend your first campaign.</p>
<div class="cb-empty">Complete your earlier pharmacy reports, then return here to choose your first growth campaign.</div>
<p style="margin-top:20px"><a class="cb-primary-cta" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">Open Your Growth Plan</a></p>
</div>`;
  }

  const featured = campaigns.find((c) => c.customerSelected) || campaigns.find((c) => c.recommended) || campaigns[0];
  const recommendedCard = renderPremiumCard(slug, featured);
  const catalog = buildCampaignExplorerCatalog(slug);
  const explorerPanel = catalog ? renderCampaignExplorerPanel(slug, catalog) : "";
  const subtitle = featured.customerSelected ? CB_UX_CHOOSE_SELECTED_SUBTITLE : CB_UX_CHOOSE_SUBTITLE;

  return `<div class="cb-panel">
<h2>${esc(CB_UX_CHOOSE_TITLE)}</h2>
<p class="cb-lead">${esc(subtitle)}</p>
${recommendedCard}
${explorerPanel}
</div>`;
}

function renderDemoLocationWarning(slug: string): string {
  if (slug !== BROOK_DERBY_DEMO_SLUG) return "";
  const demo = loadSalesDemoBrookDerbyAreaSelection().demoLocation;
  return `<div class="cb-demo-warning" data-demo-address-warning="true">
<strong>${esc(demo.label)}</strong>
<p style="margin:8px 0 0">Map pin: ${esc(demo.mapPinName)}, ${esc(demo.mapAddress)}. Displayed demo-site address 56 West Burton Road, Derby, DA5 4NR was not used as the discovery origin.</p>
</div>`;
}

function renderLocalPageImprovementCampaignPanel(slug: string, campaign: string): string {
  if (!campaign) return "";
  if (!listSelectedOneLocalPageCandidateAreas(slug).length) return "";
  const { plan, run } = getLocalPageImprovementCampaign(slug, campaign);
  const areaRows = plan.areas
    .map((row) => {
      const extra = row.additionalProviderCalls
        ? `${row.additionalProviderCalls} additional provider call${row.additionalProviderCalls === 1 ? "" : "s"} (max ${esc(row.maxEvidenceCostUsd.toFixed(3))})`
        : "no additional paid evidence calls";
      return `<li data-improvement-area="${esc(row.areaSlug)}" data-evidence-already-saved="${row.evidenceAlreadySaved ? "true" : "false"}" data-evidence-fact-count="${row.evidenceFactCount}" data-additional-provider-calls="${row.additionalProviderCalls}">${esc(row.areaName)} — evidence already saved: ${row.evidenceFactCount} fact${row.evidenceFactCount === 1 ? "" : "s"}, spent $${row.evidenceSpentUsd.toFixed(3)}. Proposed: ${esc(extra)}.</li>`;
    })
    .join("");
  const runStatus = run?.status || "idle";
  const failed =
    run?.status === "stopped" && run.failedError
      ? `<p class="cb-blocker" id="improveLocalPagesFailure">Stopped at ${esc(run.failedAreaSlug || "")} during ${esc(run.failedStage || "")}: ${esc(run.failedError)}</p>`
      : "";
  const canConfirm = runStatus !== "running" && runStatus !== "completed" && runStatus !== "stopped" && !plan.exceedsHardMaximum;
  const canResume = runStatus === "stopped";
  const ceilingNote = plan.exceedsHardMaximum
    ? `<p class="cb-blocker" id="improveLocalPagesCeiling">Platform estimate ${esc(plan.maxTotalCostLabel)} exceeds the hard maximum of $${plan.hardMaximumUsd.toFixed(3)}. The improvement run was not started.</p>`
    : "";
  return `<div class="cb-one-local" id="improveLocalPagesPanel" data-improve-local-pages="true" data-area-count="${plan.areas.length}" data-evidence-already-saved-count="${plan.evidenceAlreadySavedCount}" data-additional-provider-calls="${plan.additionalProviderCalls}" data-max-evidence-calls="${plan.maxEvidenceCalls}" data-max-generation-calls="${plan.maxGenerationCalls}" data-max-provider-calls="${plan.maxProviderCalls}" data-max-evidence-cost-usd="${plan.maxEvidenceCostUsd}" data-max-generation-cost-usd="${plan.maxGenerationCostUsd}" data-max-total-cost-usd="${plan.maxTotalCostUsd}" data-hard-maximum-usd="${plan.hardMaximumUsd}" data-exceeds-hard-maximum="${plan.exceedsHardMaximum ? "true" : "false"}" data-run-status="${esc(runStatus)}" data-run-id="${esc(run?.runId || "")}" data-can-resume="${canResume ? "true" : "false"}">
<h3>${esc(IMPROVE_LOCAL_PAGES_LABEL)}</h3>
<p class="cb-lead">One campaign-level action improves all ten selected local pages together. Saved V1 candidates stay on disk as the rejected baseline. Evidence already saved is reused. Additional Places and DataForSEO calls run only where unused. Distance is confirmed from saved endpoints. One OpenAI call per area writes a versioned V2 candidate through the existing writer, validators and Review Centre. Clinical content, credentials, notices and disclaimers stay renderer-owned. No automatic retry. The first genuine failure stops the run and keeps earlier V2 successes.</p>
${ceilingNote}
<div class="cb-remaining-lists">
<div class="cb-remaining-list" data-improvement-areas="true"><strong>All ten areas</strong><ul>${areaRows || "<li>None selected.</li>"}</ul></div>
</div>
<div class="cb-stats">
<div class="cb-stat"><strong>Evidence already saved</strong><span data-evidence-already-saved-label="true">${plan.evidenceAlreadySavedCount} of ${plan.areas.length} areas</span></div>
<div class="cb-stat"><strong>Proposed additional provider calls</strong><span data-additional-provider-calls-label="true">${plan.additionalProviderCalls}</span></div>
<div class="cb-stat"><strong>Maximum evidence calls</strong><span data-max-evidence-calls-label="true">${plan.maxEvidenceCalls}</span></div>
<div class="cb-stat"><strong>Maximum OpenAI calls</strong><span data-max-generation-calls-label="true">${plan.maxGenerationCalls}</span></div>
<div class="cb-stat"><strong>Maximum total cost</strong><span data-max-total-cost-label="true">${esc(plan.maxTotalCostLabel)}</span></div>
<div class="cb-stat"><strong>Hard maximum</strong><span>$${plan.hardMaximumUsd.toFixed(3)}</span></div>
</div>
${failed}
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmImproveLocalPages" ${canConfirm ? "" : "disabled"}/>
<span>I confirm this campaign-level improvement run for this authenticated pharmacy. It authorises all ten selected areas, reuses saved evidence, permits the additional provider calls shown, and allows ten OpenAI calls. Maximum total cost ${esc(plan.maxTotalCostLabel)}. Clinical content stays renderer-owned and clinically draft. Nothing is published.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnImproveLocalPages" disabled>${esc(IMPROVE_LOCAL_PAGES_LABEL)}</button>
</p>
${
  canResume
    ? `<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmResumeImproveLocalPages"/>
<span>I confirm resuming this same campaign-level improvement run. Earlier V2 successes are kept. One OpenAI call per remaining area. No automatic retry.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnResumeImproveLocalPages" disabled>${esc(RESUME_IMPROVE_LOCAL_PAGES_LABEL)}</button>
</p>`
    : ""
}
<div id="improveLocalPagesStatus" style="margin-top:12px;font-size:14px;${run ? "" : "display:none"}">${
    run
      ? esc(
          run.status === "stopped"
            ? `Stopped at ${run.failedAreaSlug || "an area"} during ${run.failedStage || "processing"}: ${run.failedError || ""}`
            : `Improvement run ${run.status}${run.currentAreaSlug ? ` — ${run.currentAreaSlug}` : ""}.`,
        )
      : ""
  }</div>
<script>
(function(){
  function withAuthToken(href) {
    if (!href) return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
  }
  var box = document.getElementById('confirmImproveLocalPages');
  var btn = document.getElementById('btnImproveLocalPages');
  var resumeBox = document.getElementById('confirmResumeImproveLocalPages');
  var resumeBtn = document.getElementById('btnResumeImproveLocalPages');
  var status = document.getElementById('improveLocalPagesStatus');
  var panel = document.getElementById('improveLocalPagesPanel');
  var submitting = false;
  var canConfirm = ${canConfirm ? "true" : "false"};
  var canResume = ${canResume ? "true" : "false"};
  var resumeRunId = ${JSON.stringify(run?.runId || "")};
  function showStatus(msg, ok) {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = msg;
    status.style.color = ok === true ? '#059669' : ok === false ? '#991b1b' : '#0f172a';
  }
  function syncButton() {
    if (!btn) return;
    btn.disabled = !canConfirm || submitting || !(box && box.checked);
  }
  function syncResume() {
    if (!resumeBtn) return;
    resumeBtn.disabled = !canResume || submitting || !(resumeBox && resumeBox.checked);
  }
  if (box) box.addEventListener('change', syncButton);
  if (resumeBox) resumeBox.addEventListener('change', syncResume);
  syncButton();
  syncResume();
  async function postImprove(body) {
    return fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/improve-local-pages'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
  }
  async function handleStartResponse(res, startedLabel) {
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok) {
      submitting = false;
      if (box && canConfirm) box.disabled = false;
      if (resumeBox && canResume) resumeBox.disabled = false;
      syncButton();
      syncResume();
      showStatus(json.error || 'The improvement run could not start.', false);
      return;
    }
    showStatus(json.duplicate ? 'This campaign-level improvement run is already in progress or complete. No extra calls were started.' : startedLabel, json.duplicate ? undefined : true);
    if (json.run && json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      if (panel) panel.setAttribute('data-run-status', 'stopped');
      submitting = false;
      syncButton();
      syncResume();
      return;
    }
    poll();
  }
  if (btn) btn.onclick = async function(){
    if (submitting || !box || !box.checked) return;
    submitting = true;
    btn.disabled = true;
    if (box) box.disabled = true;
    if (resumeBtn) resumeBtn.disabled = true;
    showStatus('Starting the campaign-level local-page improvement run…');
    var res = await postImprove({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true, slug: ${JSON.stringify(slug)} });
    await handleStartResponse(res, 'Improvement run confirmed. All ten areas will process sequentially.');
  };
  if (resumeBtn) resumeBtn.onclick = async function(){
    if (submitting || !resumeBox || !resumeBox.checked) return;
    submitting = true;
    resumeBtn.disabled = true;
    if (resumeBox) resumeBox.disabled = true;
    if (btn) btn.disabled = true;
    showStatus('Resuming the campaign-level local-page improvement run…');
    var res = await postImprove({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true, resume: true, runId: resumeRunId, slug: ${JSON.stringify(slug)} });
    await handleStartResponse(res, 'Same improvement run resumed. Earlier V2 successes are kept.');
  };
  async function poll() {
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/improve-local-pages?campaign=${encodeURIComponent(campaign)}'), { credentials: 'same-origin' });
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok || !json.run) return;
    if (panel) panel.setAttribute('data-run-status', json.run.status || '');
    if (json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      return;
    }
    if (json.run.status === 'completed') {
      showStatus('Local-page improvements are complete. Open Preview or Review Centre.', true);
      return;
    }
    showStatus('Improvement run ' + json.run.status + (json.run.currentAreaSlug ? ' — ' + json.run.currentAreaSlug : '') + (json.run.currentStage ? ' (' + json.run.currentStage + ')' : '') + '.');
    setTimeout(poll, 2000);
  }
  if (${JSON.stringify(runStatus)} === 'running' || ${JSON.stringify(runStatus)} === 'authorised' || ${JSON.stringify(runStatus)} === 'interrupted') poll();
})();
</script>
</div>`;
}

function renderLocalPageVariationRestoreCampaignPanel(slug: string, campaign: string): string {
  if (!campaign) return "";
  if (!listSelectedOneLocalPageCandidateAreas(slug).length) return "";
  const { plan, run } = getLocalPageVariationRestoreCampaign(slug, campaign);
  const areaRows = plan.areas
    .map((row) => `<li data-variation-area="${esc(row.areaSlug)}">${esc(row.areaName)} — evidence already saved: ${row.evidenceFactCount} fact${row.evidenceFactCount === 1 ? "" : "s"}. One OpenAI call. Strategy-owned headings, consultation, FAQs and CTA.</li>`)
    .join("");
  const runStatus = run?.status || "idle";
  const failed =
    run?.status === "stopped" && run.failedError
      ? `<p class="cb-blocker" id="restoreLocalPageVariationFailure">Stopped at ${esc(run.failedAreaSlug || "")} during ${esc(run.failedStage || "")}: ${esc(run.failedError)}</p>`
      : "";
  const canConfirm = runStatus !== "running" && runStatus !== "completed" && runStatus !== "stopped" && !plan.exceedsHardMaximum;
  const canResume = runStatus === "stopped";
  const ceilingNote = plan.exceedsHardMaximum
    ? `<p class="cb-blocker" id="restoreLocalPageVariationCeiling">Platform estimate ${esc(plan.maxTotalCostLabel)} exceeds the hard maximum of $${plan.hardMaximumUsd.toFixed(3)}. The variation restoration was not started.</p>`
    : "";
  return `<div class="cb-one-local" id="restoreLocalPageVariationPanel" data-restore-local-page-variation="true" data-area-count="${plan.areas.length}" data-max-generation-calls="${plan.maxGenerationCalls}" data-max-total-cost-usd="${plan.maxTotalCostUsd}" data-hard-maximum-usd="${plan.hardMaximumUsd}" data-exceeds-hard-maximum="${plan.exceedsHardMaximum ? "true" : "false"}" data-run-status="${esc(runStatus)}" data-run-id="${esc(run?.runId || "")}" data-can-resume="${canResume ? "true" : "false"}">
<h3>${esc(RESTORE_LOCAL_PAGE_VARIATION_LABEL)}</h3>
<p class="cb-lead">One campaign-level action restores the existing locality-page strategy variants and regenerates all ten selected local pages. Saved V1 and V2 candidates stay on disk. Evidence already saved is reused. One OpenAI call per area writes a new versioned candidate. Clinical content, credentials, notices and disclaimers stay renderer-owned. No automatic retry. The first genuine failure stops the run and keeps earlier successes.</p>
${ceilingNote}
<div class="cb-remaining-lists">
<div class="cb-remaining-list" data-variation-areas="true"><strong>All ten areas</strong><ul>${areaRows || "<li>None selected.</li>"}</ul></div>
</div>
<div class="cb-stats">
<div class="cb-stat"><strong>Maximum OpenAI calls</strong><span data-variation-max-generation-calls-label="true">${plan.maxGenerationCalls}</span></div>
<div class="cb-stat"><strong>Maximum total cost</strong><span data-variation-max-total-cost-label="true">${esc(plan.maxTotalCostLabel)}</span></div>
<div class="cb-stat"><strong>Hard maximum</strong><span>$${plan.hardMaximumUsd.toFixed(3)}</span></div>
</div>
${failed}
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmRestoreLocalPageVariation" ${canConfirm ? "" : "disabled"}/>
<span>I confirm this campaign-level variation restoration for this authenticated pharmacy. It snapshots current V2 candidates, reuses saved evidence, and allows ten OpenAI calls. Maximum total cost ${esc(plan.maxTotalCostLabel)}. Clinical content stays renderer-owned and clinically draft. Nothing is published.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnRestoreLocalPageVariation" disabled>${esc(RESTORE_LOCAL_PAGE_VARIATION_LABEL)}</button>
</p>
${
  canResume
    ? `<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmResumeRestoreLocalPageVariation"/>
<span>I confirm resuming this same campaign-level variation restoration. Earlier successes are kept. One OpenAI call per remaining area. No automatic retry.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnResumeRestoreLocalPageVariation" disabled>${esc(RESUME_RESTORE_LOCAL_PAGE_VARIATION_LABEL)}</button>
</p>`
    : ""
}
<div id="restoreLocalPageVariationStatus" style="margin-top:12px;font-size:14px;${run ? "" : "display:none"}">${
    run
      ? esc(
          run.status === "stopped"
            ? `Stopped at ${run.failedAreaSlug || "an area"} during ${run.failedStage || "processing"}: ${run.failedError || ""}`
            : `Variation restoration ${run.status}${run.currentAreaSlug ? ` — ${run.currentAreaSlug}` : ""}.`,
        )
      : ""
  }</div>
<script>
(function(){
  function withAuthToken(href) {
    if (!href) return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
  }
  var box = document.getElementById('confirmRestoreLocalPageVariation');
  var btn = document.getElementById('btnRestoreLocalPageVariation');
  var resumeBox = document.getElementById('confirmResumeRestoreLocalPageVariation');
  var resumeBtn = document.getElementById('btnResumeRestoreLocalPageVariation');
  var status = document.getElementById('restoreLocalPageVariationStatus');
  var panel = document.getElementById('restoreLocalPageVariationPanel');
  var submitting = false;
  var canConfirm = ${canConfirm ? "true" : "false"};
  var canResume = ${canResume ? "true" : "false"};
  var resumeRunId = ${JSON.stringify(run?.runId || "")};
  function showStatus(msg, ok) {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = msg;
    status.style.color = ok === true ? '#059669' : ok === false ? '#991b1b' : '#0f172a';
  }
  function syncButton() {
    if (!btn) return;
    btn.disabled = !canConfirm || submitting || !(box && box.checked);
  }
  function syncResume() {
    if (!resumeBtn) return;
    resumeBtn.disabled = !canResume || submitting || !(resumeBox && resumeBox.checked);
  }
  if (box) box.addEventListener('change', syncButton);
  if (resumeBox) resumeBox.addEventListener('change', syncResume);
  syncButton();
  syncResume();
  async function postRestore(body) {
    return fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/restore-local-page-variation'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
  }
  async function handleStartResponse(res, startedLabel) {
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok) {
      submitting = false;
      if (box && canConfirm) box.disabled = false;
      if (resumeBox && canResume) resumeBox.disabled = false;
      syncButton();
      syncResume();
      showStatus(json.error || 'The variation restoration could not start.', false);
      return;
    }
    showStatus(json.duplicate ? 'This campaign-level variation restoration is already in progress or complete. No extra calls were started.' : startedLabel, json.duplicate ? undefined : true);
    if (json.run && json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      if (panel) panel.setAttribute('data-run-status', 'stopped');
      submitting = false;
      syncButton();
      syncResume();
      return;
    }
    poll();
  }
  if (btn) btn.onclick = async function(){
    if (!canConfirm || submitting || !(box && box.checked)) return;
    submitting = true;
    box.disabled = true;
    btn.disabled = true;
    showStatus('Starting variation restoration…');
    try {
      var res = await postRestore({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true });
      await handleStartResponse(res, 'Variation restoration started. All ten selected areas process sequentially.');
    } catch (err) {
      submitting = false;
      box.disabled = false;
      syncButton();
      showStatus(err.message || 'The variation restoration could not start.', false);
    }
  };
  if (resumeBtn) resumeBtn.onclick = async function(){
    if (!canResume || submitting || !(resumeBox && resumeBox.checked)) return;
    submitting = true;
    resumeBox.disabled = true;
    resumeBtn.disabled = true;
    showStatus('Resuming variation restoration…');
    try {
      var res = await postRestore({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true, resume: true, runId: resumeRunId });
      await handleStartResponse(res, 'Same variation restoration resumed from the saved area and stage.');
    } catch (err) {
      submitting = false;
      resumeBox.disabled = false;
      syncResume();
      showStatus(err.message || 'The variation restoration could not resume.', false);
    }
  };
  async function poll() {
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/restore-local-page-variation?campaign=${encodeURIComponent(campaign)}'), { credentials: 'same-origin' });
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok || !json.run) {
      setTimeout(poll, 2500);
      return;
    }
    if (panel) panel.setAttribute('data-run-status', json.run.status || '');
    if (json.run.status === 'completed') {
      showStatus('Variation restoration completed. Open Review Centre to compare the regenerated Previews.', true);
      submitting = false;
      return;
    }
    if (json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      submitting = false;
      return;
    }
    showStatus('Variation restoration ' + json.run.status + (json.run.currentAreaSlug ? ' — ' + json.run.currentAreaSlug : '') + (json.run.currentStage ? ' (' + json.run.currentStage + ')' : '') + '.');
    setTimeout(poll, 2000);
  }
  if (${JSON.stringify(runStatus)} === 'running' || ${JSON.stringify(runStatus)} === 'authorised' || ${JSON.stringify(runStatus)} === 'interrupted') poll();
})();
</script>
</div>`;
}

function renderUkLocalServicePagesCampaignPanel(slug: string, campaign: string): string {
  if (!campaign) return "";
  if (!listSelectedOneLocalPageCandidateAreas(slug).length) return "";
  const { plan, run } = getUkLocalServicePagesCampaign(slug, campaign);
  const areaRows = plan.areas
    .map((row) => {
      const readiness = row.evidenceReady
        ? "Evidence currently ready"
        : row.evidenceCollectionRequired
          ? "Evidence requiring collection"
          : "Generation currently blocked";
      return `<li data-uk-local-area="${esc(row.areaSlug)}" data-evidence-ready="${row.evidenceReady ? "true" : "false"}">${esc(row.areaName)} — ${esc(readiness)}</li>`;
    })
    .join("");
  const runStatus = run?.status || "idle";
  const failed =
    run?.status === "stopped" && run.failedError
      ? `<p class="cb-blocker" id="ukLocalServicePagesFailure">Stopped at ${esc(run.failedAreaSlug || "")} during ${esc(run.failedStage || "")}: ${esc(run.failedError)}</p>`
      : "";
  const canConfirm = plan.areas.length > 0 && runStatus !== "running" && runStatus !== "authorised";
  const canResume = runStatus === "stopped";
  return `<div class="cb-one-local" id="ukLocalServicePagesPanel" data-uk-local-service-pages="true" data-area-count="${plan.areas.length}" data-service-name="${esc(plan.serviceName)}" data-primary-town="${esc(plan.primaryTown)}" data-destination-tenant="${esc(plan.destinationTenant)}" data-evidence-currently-ready-count="${plan.evidenceCurrentlyReadyCount}" data-run-status="${esc(runStatus)}" data-run-id="${esc(run?.runId || "")}">
<h3>${esc(CREATE_TEN_LOCAL_SERVICE_PAGES_LABEL)}</h3>
<p class="cb-lead">One campaign-level action creates the ten selected local service pages together. Do not operate each area control manually. Selected areas run sequentially through evidence collection when required, isolated evidence briefs, local introductions, assembly, validation and save, then Preview / Review Centre. Successful candidates are kept if a later area fails. Clinical content, credentials, governance and disclaimers stay renderer-owned. Pages remain unpublished until accepted in Review Centre.</p>
<div class="cb-stats">
<div class="cb-stat"><strong>Selected service</strong><span data-uk-local-service="true">${esc(plan.serviceName)}</span></div>
<div class="cb-stat"><strong>Primary town/city</strong><span data-uk-local-town="true">${esc(plan.primaryTown || "Not recorded")}</span></div>
<div class="cb-stat"><strong>Destination tenant</strong><span data-uk-local-tenant="true">${esc(plan.destinationTenant)}</span></div>
<div class="cb-stat"><strong>Evidence currently ready</strong><span data-uk-local-evidence-ready="true">${plan.evidenceCurrentlyReadyCount} of ${plan.areas.length}</span></div>
</div>
<div class="cb-remaining-list" data-uk-local-areas="true"><strong>Ten proposed areas</strong><ul>${areaRows || "<li>Select ten local areas first.</li>"}</ul></div>
${failed}
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmCreateTenLocalServicePages" ${canConfirm ? "" : "disabled"}/>
<span>I confirm this campaign-level run for this authenticated pharmacy. It will create ten local service pages for ${esc(plan.serviceName)} around ${esc(plan.primaryTown || "the selected town")} on ${esc(plan.destinationTenant)}. Clinical content stays renderer-owned and unpublished.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnCreateTenLocalServicePages" disabled>${esc(CREATE_TEN_LOCAL_SERVICE_PAGES_LABEL)}</button>
</p>
${
  canResume
    ? `<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmResumeTenLocalServicePages"/>
<span>I confirm resuming this campaign-level run. Successful candidates already saved will be kept. The first remaining area continues from its current saved evidence.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnResumeTenLocalServicePages" disabled>${esc(RESUME_TEN_LOCAL_SERVICE_PAGES_LABEL)}</button>
</p>`
    : ""
}
<div id="ukLocalServicePagesStatus" style="margin-top:12px;font-size:14px;${run ? "" : "display:none"}">${
    run
      ? esc(
          run.status === "stopped"
            ? `Stopped at ${run.failedAreaSlug || "an area"} during ${run.failedStage || "processing"}: ${run.failedError || ""}`
            : `Campaign run ${run.status}${run.currentAreaSlug ? ` — ${run.currentAreaSlug}` : ""}.`,
        )
      : ""
  }</div>
<script>
(function(){
  function withAuthToken(href) {
    if (!href) return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
  }
  var box = document.getElementById('confirmCreateTenLocalServicePages');
  var btn = document.getElementById('btnCreateTenLocalServicePages');
  var resumeBox = document.getElementById('confirmResumeTenLocalServicePages');
  var resumeBtn = document.getElementById('btnResumeTenLocalServicePages');
  var status = document.getElementById('ukLocalServicePagesStatus');
  var panel = document.getElementById('ukLocalServicePagesPanel');
  var submitting = false;
  var canConfirm = ${canConfirm ? "true" : "false"};
  var canResume = ${canResume ? "true" : "false"};
  var resumeRunId = ${JSON.stringify(run?.runId || "")};
  function showStatus(msg, ok) {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = msg;
    status.style.color = ok === true ? '#059669' : ok === false ? '#991b1b' : '#0f172a';
  }
  function syncButton() {
    if (!btn) return;
    btn.disabled = !canConfirm || submitting || !(box && box.checked);
  }
  function syncResume() {
    if (!resumeBtn) return;
    resumeBtn.disabled = !canResume || submitting || !(resumeBox && resumeBox.checked);
  }
  if (box) box.addEventListener('change', syncButton);
  if (resumeBox) resumeBox.addEventListener('change', syncResume);
  syncButton();
  syncResume();
  async function postRun(body) {
    return fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/uk-local-service-pages'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
  }
  async function handleStartResponse(res, startedLabel) {
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok) {
      submitting = false;
      if (box && canConfirm) box.disabled = false;
      if (resumeBox && canResume) resumeBox.disabled = false;
      syncButton();
      syncResume();
      showStatus(json.error || 'The campaign-level run could not start.', false);
      return;
    }
    showStatus(json.duplicate ? 'This campaign-level run is already in progress. No extra calls were started.' : startedLabel, json.duplicate ? undefined : true);
    if (json.run && json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      if (panel) panel.setAttribute('data-run-status', 'stopped');
      submitting = false;
      syncButton();
      syncResume();
      return;
    }
    poll();
  }
  if (btn) btn.onclick = async function(){
    if (submitting || !box || !box.checked) return;
    submitting = true;
    btn.disabled = true;
    if (box) box.disabled = true;
    if (resumeBtn) resumeBtn.disabled = true;
    showStatus('Starting the ten local service pages…');
    var res = await postRun({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true, slug: ${JSON.stringify(slug)} });
    await handleStartResponse(res, 'Campaign-level run confirmed. The ten selected areas will process sequentially.');
  };
  if (resumeBtn) resumeBtn.onclick = async function(){
    if (submitting || !resumeBox || !resumeBox.checked) return;
    submitting = true;
    resumeBtn.disabled = true;
    if (resumeBox) resumeBox.disabled = true;
    if (btn) btn.disabled = true;
    showStatus('Resuming the ten local service pages…');
    var res = await postRun({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true, resume: true, runId: resumeRunId, slug: ${JSON.stringify(slug)} });
    await handleStartResponse(res, 'Same campaign-level run resumed. Remaining areas will process sequentially.');
  };
  async function poll() {
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/uk-local-service-pages?campaign=${encodeURIComponent(campaign)}'), { credentials: 'same-origin' });
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok || !json.run) return;
    if (panel) panel.setAttribute('data-run-status', json.run.status || '');
    if (json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      return;
    }
    if (json.run.status === 'completed') {
      showStatus('Ten local service pages are complete. Open Preview or Review Centre to review the new candidates.', true);
      return;
    }
    showStatus('Campaign run ' + json.run.status + (json.run.currentAreaSlug ? ' — ' + json.run.currentAreaSlug : '') + (json.run.currentStage ? ' (' + json.run.currentStage + ')' : '') + '.');
    setTimeout(poll, 2000);
  }
  if (${JSON.stringify(runStatus)} === 'running' || ${JSON.stringify(runStatus)} === 'authorised' || ${JSON.stringify(runStatus)} === 'interrupted') poll();
})();
</script>
</div>`;
}

function renderRemainingLocalPagesCampaignPanel(slug: string, campaign: string): string {
  if (!campaign) return "";
  if (!listSelectedOneLocalPageCandidateAreas(slug).length) return "";
  const { plan, run } = getRemainingLocalPagesCampaign(slug, campaign);
  const remainingRows = plan.remaining
    .map((row) => {
      const note = row.evidenceReady
        ? `<div class="cb-remaining-note">Evidence currently ready. Maximum generation calls if collection succeeds: 1.</div>`
        : row.evidenceCollectionRequired
          ? `<div class="cb-remaining-note">Evidence requiring collection. Maximum generation calls if collection succeeds: 1.</div>`
          : `<div class="cb-remaining-note">Generation currently blocked. Maximum generation calls if collection succeeds: 1.</div>`;
      return `<li data-remaining-area="${esc(row.areaSlug)}" data-evidence-currently-ready="${row.evidenceReady ? "true" : "false"}" data-evidence-requiring-collection="${row.evidenceCollectionRequired ? "true" : "false"}" data-generation-currently-blocked="${row.evidenceBlocked ? "true" : "false"}" data-max-generation-if-collection-succeeds="${row.maxGenerationCalls}">${esc(row.areaName)}${note}</li>`;
    })
    .join("");
  const completeRows = plan.complete
    .map((row) => `<li data-complete-area="${esc(row.areaSlug)}">${esc(row.areaName)} — saved valid candidate</li>`)
    .join("");
  const runStatus = run?.status || "idle";
  const failed =
    run?.status === "stopped" && run.failedError
      ? `<p class="cb-blocker" id="remainingLocalPagesFailure">Stopped at ${esc(run.failedAreaSlug || "")} during ${esc(run.failedStage || "")}: ${esc(run.failedError)}</p>`
      : "";
  const canConfirm = plan.remaining.length > 0 && runStatus !== "running" && runStatus !== "completed" && runStatus !== "stopped";
  const canResume = plan.remaining.length > 0 && runStatus === "stopped";
  return `<div class="cb-one-local" id="remainingLocalPagesPanel" data-remaining-local-pages="true" data-remaining-count="${plan.remaining.length}" data-complete-count="${plan.complete.length}" data-evidence-currently-ready-count="${plan.evidenceCurrentlyReadyCount}" data-evidence-requiring-collection-count="${plan.evidenceRequiringCollectionCount}" data-generation-currently-blocked-count="${plan.generationCurrentlyBlockedCount}" data-max-evidence-calls="${plan.maxEvidenceCalls}" data-max-generation-calls="${plan.maxGenerationCalls}" data-max-provider-calls="${plan.maxProviderCalls}" data-max-evidence-cost-usd="${plan.maxEvidenceCostUsd}" data-max-generation-cost-usd="${plan.maxGenerationCostUsd}" data-max-total-cost-usd="${plan.maxTotalCostUsd}" data-run-status="${esc(runStatus)}" data-run-id="${esc(run?.runId || "")}" data-can-resume="${canResume ? "true" : "false"}">
<h3>${esc(CREATE_REMAINING_LOCAL_PAGES_LABEL)}</h3>
<p class="cb-lead">One campaign-level action creates the remaining selected local pages together. Do not operate each area control manually. Incomplete selected areas run sequentially through evidence collection when required, distance calculation, generation, validation, save, then Preview / Review Centre. Saved valid candidates, including Allestree, are skipped. Evidence, distance, attempts, costs, prompts, responses and candidates stay isolated per area. One OpenAI call per area. No automatic retry. Unknown evidence blocks that area. Clinical content and service notices remain renderer-owned and clinically draft. The maximum includes one OpenAI call for every incomplete selected area that could reach generation during this run, even when its evidence is not READY before collection.</p>
${
  canResume
    ? `<p class="cb-lead">This campaign-level run stopped. Resume remaining local pages continues the same run after one explicit confirmation. Incomplete selected areas are re-evaluated from their current saved evidence. Saved READY evidence is not collected again. Saved valid candidates are skipped. One OpenAI call per area. No automatic retry. The first genuine failure stops the run and keeps earlier successful candidates.</p>`
    : ""
}
<div class="cb-remaining-lists">
<div class="cb-remaining-list" data-remaining-areas="true"><strong>Will run</strong><ul>${remainingRows || "<li>None — every selected local page already has a saved valid candidate.</li>"}</ul></div>
<div class="cb-remaining-list" data-complete-areas="true"><strong>Already complete</strong><ul>${completeRows || "<li>None yet.</li>"}</ul></div>
</div>
<div class="cb-stats">
<div class="cb-stat"><strong>Evidence currently ready</strong><span data-evidence-currently-ready-label="true">${plan.evidenceCurrentlyReadyCount}</span></div>
<div class="cb-stat"><strong>Evidence requiring collection</strong><span data-evidence-requiring-collection-label="true">${plan.evidenceRequiringCollectionCount}</span></div>
<div class="cb-stat"><strong>Generation currently blocked</strong><span data-generation-currently-blocked-label="true">${plan.generationCurrentlyBlockedCount}</span></div>
<div class="cb-stat"><strong>Maximum generation calls if collection succeeds</strong><span data-max-generation-if-collection-succeeds-label="true">${plan.maxGenerationCalls}</span></div>
<div class="cb-stat"><strong>Maximum evidence calls</strong><span data-max-evidence-calls-label="true">${plan.maxEvidenceCalls}</span></div>
<div class="cb-stat"><strong>Maximum OpenAI calls</strong><span data-max-generation-calls-label="true">${plan.maxGenerationCalls}</span></div>
<div class="cb-stat"><strong>Maximum provider calls</strong><span data-max-provider-calls-label="true">${esc(plan.maxProviderCallsLabel)}</span></div>
<div class="cb-stat"><strong>Maximum evidence cost</strong><span data-max-evidence-cost-label="true">${esc(plan.maxEvidenceCostLabel)}</span></div>
<div class="cb-stat"><strong>Maximum generation cost</strong><span data-max-generation-cost-label="true">${esc(plan.maxGenerationCostLabel)}</span></div>
<div class="cb-stat"><strong>Maximum total cost</strong><span data-max-total-cost-label="true">${esc(plan.maxTotalCostLabel)}</span></div>
</div>
${failed}
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmCreateRemainingLocalPages" ${canConfirm ? "" : "disabled"}/>
<span>I confirm this campaign-level run for this authenticated pharmacy. It authorises remaining selected local pages only. Saved valid candidates are skipped. Unknown evidence blocks that area. Clinical content stays renderer-owned and clinically draft.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnCreateRemainingLocalPages" disabled>${esc(CREATE_REMAINING_LOCAL_PAGES_LABEL)}</button>
</p>
${
  canResume
    ? `<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmResumeRemainingLocalPages"/>
<span>I confirm resuming this campaign-level remaining local-page run for this authenticated pharmacy. It continues the same run from the first incomplete selected area. Saved valid candidates are skipped. Saved READY evidence is reused and not collected again. One OpenAI call per area. No automatic retry.</span>
</label>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnResumeRemainingLocalPages" disabled>${esc(RESUME_REMAINING_LOCAL_PAGES_LABEL)}</button>
</p>`
    : ""
}
<div id="remainingLocalPagesStatus" style="margin-top:12px;font-size:14px;${run ? "" : "display:none"}">${
    run
      ? esc(
          run.status === "stopped"
            ? `Stopped at ${run.failedAreaSlug || "an area"} during ${run.failedStage || "processing"}: ${run.failedError || ""}`
            : `Campaign run ${run.status}${run.currentAreaSlug ? ` — ${run.currentAreaSlug}` : ""}.`,
        )
      : ""
  }</div>
<script>
(function(){
  function withAuthToken(href) {
    if (!href) return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
  }
  var box = document.getElementById('confirmCreateRemainingLocalPages');
  var btn = document.getElementById('btnCreateRemainingLocalPages');
  var resumeBox = document.getElementById('confirmResumeRemainingLocalPages');
  var resumeBtn = document.getElementById('btnResumeRemainingLocalPages');
  var status = document.getElementById('remainingLocalPagesStatus');
  var panel = document.getElementById('remainingLocalPagesPanel');
  var submitting = false;
  var canConfirm = ${canConfirm ? "true" : "false"};
  var canResume = ${canResume ? "true" : "false"};
  var resumeRunId = ${JSON.stringify(run?.runId || "")};
  function showStatus(msg, ok) {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = msg;
    status.style.color = ok === true ? '#059669' : ok === false ? '#991b1b' : '#0f172a';
  }
  function syncButton() {
    if (!btn) return;
    btn.disabled = !canConfirm || submitting || !(box && box.checked);
  }
  function syncResume() {
    if (!resumeBtn) return;
    resumeBtn.disabled = !canResume || submitting || !(resumeBox && resumeBox.checked);
  }
  if (box) box.addEventListener('change', syncButton);
  if (resumeBox) resumeBox.addEventListener('change', syncResume);
  syncButton();
  syncResume();
  async function postRemaining(body) {
    return fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/remaining-local-pages'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
  }
  async function handleStartResponse(res, startedLabel) {
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok) {
      submitting = false;
      if (box && canConfirm) box.disabled = false;
      if (resumeBox && canResume) resumeBox.disabled = false;
      syncButton();
      syncResume();
      showStatus(json.error || 'The campaign-level run could not start.', false);
      return;
    }
    showStatus(json.duplicate ? 'This campaign-level run is already in progress or complete. No extra calls were started.' : startedLabel, json.duplicate ? undefined : true);
    if (json.run && json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      if (panel) panel.setAttribute('data-run-status', 'stopped');
      submitting = false;
      syncButton();
      syncResume();
      return;
    }
    poll();
  }
  if (btn) btn.onclick = async function(){
    if (submitting || !box || !box.checked) return;
    submitting = true;
    btn.disabled = true;
    if (box) box.disabled = true;
    if (resumeBtn) resumeBtn.disabled = true;
    showStatus('Starting the campaign-level remaining local-page run…');
    var res = await postRemaining({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true, slug: ${JSON.stringify(slug)} });
    await handleStartResponse(res, 'Campaign-level run confirmed. Incomplete selected areas will process sequentially.');
  };
  if (resumeBtn) resumeBtn.onclick = async function(){
    if (submitting || !resumeBox || !resumeBox.checked) return;
    submitting = true;
    resumeBtn.disabled = true;
    if (resumeBox) resumeBox.disabled = true;
    if (btn) btn.disabled = true;
    showStatus('Resuming the campaign-level remaining local-page run…');
    var res = await postRemaining({ campaign: ${JSON.stringify(campaign)}, confirmAuthorise: true, resume: true, runId: resumeRunId, slug: ${JSON.stringify(slug)} });
    await handleStartResponse(res, 'Same campaign-level run resumed. Incomplete selected areas will process sequentially from current saved evidence.');
  };
  async function poll() {
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/remaining-local-pages?campaign=${encodeURIComponent(campaign)}'), { credentials: 'same-origin' });
    var json = await res.json().catch(function(){ return {}; });
    if (!json.ok || !json.run) return;
    if (panel) panel.setAttribute('data-run-status', json.run.status || '');
    if (json.run.status === 'stopped') {
      showStatus('Stopped at ' + (json.run.failedAreaSlug || 'an area') + ' during ' + (json.run.failedStage || 'processing') + ': ' + (json.run.failedError || ''), false);
      return;
    }
    if (json.run.status === 'completed') {
      showStatus('Remaining selected local pages are complete. Open Preview or Review Centre from each area panel.', true);
      return;
    }
    showStatus('Campaign run ' + json.run.status + (json.run.currentAreaSlug ? ' — ' + json.run.currentAreaSlug : '') + (json.run.currentStage ? ' (' + json.run.currentStage + ')' : '') + '.');
    setTimeout(poll, 2000);
  }
  if (${JSON.stringify(runStatus)} === 'running' || ${JSON.stringify(runStatus)} === 'authorised' || ${JSON.stringify(runStatus)} === 'interrupted') poll();
})();
</script>
</div>`;
}

function renderOneLocalPageCandidatePanel(slug: string, campaign: string, focusedAreaSlug?: string): string {
  if (!campaign) return "";
  const resolved = resolveOneLocalPageCandidateArea(slug, focusedAreaSlug);
  if (!resolved) return "";
  const preflight = preflightOneLocalPageCandidate(slug, campaign, resolved.areaSlug);
  const evidencePlan = decorateLocalPageEvidencePlan(
    planOneLocalPageEvidencePreparation(slug, campaign, resolved.areaSlug),
  );
  const paid = preflight.paidCallsRequired
    .filter((row) => row.required)
    .map((row) => `<li>${esc(row.reason)}</li>`)
    .join("");
  const missingRows = evidencePlan.missing
    .map((row) => `<li data-evidence-gap="${esc(row.id)}"><strong>${esc(row.layer)}</strong> — ${esc(row.detail)}</li>`)
    .join("");
  const executedCalls = evidencePlan.executedCalls || [];
  const followUp = evidencePlan.areaReferenceFollowUpRequired === true;
  const showingExecutedCalls = executedCalls.length > 0 && !followUp;
  const callRows = showingExecutedCalls
    ? executedCalls
        .map(
          (row) => `<tr data-executed-call="${esc(row.id)}">
<td>${esc(row.provider)}</td>
<td>${esc(row.kind)}</td>
<td>${esc(row.detail || row.purpose || row.id)}${row.query ? `<div style="font-size:12px;color:#64748b;margin-top:4px">${esc(row.query)}</div>` : ""}</td>
<td>${row.actualCostUsd == null ? "—" : `$${Number(row.actualCostUsd).toFixed(3)}`}</td>
<td>${esc(row.status)}</td>
</tr>`,
        )
        .join("")
    : evidencePlan.proposedCalls
        .map(
          (row) => `<tr data-proposed-call="${esc(row.id)}">
<td>${esc(row.provider)}</td>
<td>${esc(row.kind)}</td>
<td>${esc(row.purpose)}${row.query ? `<div style="font-size:12px;color:#64748b;margin-top:4px">${esc(row.query)}</div>` : ""}</td>
<td>$${row.estimatedCostUsd.toFixed(3)}</td>
<td>${row.cached ? "reuse cache" : "proposed"}${row.required ? " · required" : " · optional"}</td>
</tr>`,
        )
        .join("");
  const collectionFooter = evidencePlan.collectionRunStatus
    ? `${evidencePlan.collectionRunStatus} · $${(evidencePlan.collectionSpentUsd || 0).toFixed(3)} spent${evidencePlan.editorialSufficiency ? ` · ${evidencePlan.editorialSufficiency}` : ""}`
    : "not executed";
  const collectionOutcome =
    evidencePlan.collectionOutcomeSummary ||
    (evidencePlan.collectionRunStatus
      ? `Collection ${evidencePlan.collectionRunStatus}. Evidence spend $${(evidencePlan.collectionSpentUsd || 0).toFixed(3)} of cap $${(evidencePlan.evidenceSpendingCapUsd || 0).toFixed(3)}.`
      : "");
  return `<div class="cb-one-local" data-one-local-page="${esc(resolved.areaSlug)}" data-can-generate="${preflight.canGenerate ? "true" : "false"}" data-generation-remaining-calls="${esc(String(preflight.generationAllowance.remainingCalls))}" data-can-authorise-additional="${preflight.generationAllowance.canAuthoriseAdditionalAttempt ? "true" : "false"}" data-saved-candidate="${preflight.existingCandidate ? "true" : "false"}" data-budget-present="${preflight.generationAllowance.budgetPresent ? "true" : "false"}" data-distance-status="${esc(preflight.distanceStatus)}">
<h3>One local page — ${esc(preflight.areaName)}</h3>
<p class="cb-lead">Select ${esc(preflight.areaName)} above, then create one unpublished local page for review. This panel applies only to ${esc(preflight.areaName)}. Switching the focused area does not change your Target Areas selection. This does not build the full campaign or the other selected areas.</p>
<div class="cb-stats">
<div class="cb-stat"><strong>Campaign scope</strong><span>${esc(preflight.campaignScope)}</span></div>
<div class="cb-stat"><strong>Estimated cost</strong><span>${esc(preflight.estimatedCostLabel)}</span></div>
<div class="cb-stat"><strong>OpenAI allowance</strong><span data-generation-allowance="true">${esc(preflight.generationAllowance.allowanceLabel)}</span></div>
<div class="cb-stat"><strong>Local evidence</strong><span data-local-evidence-status="true">${esc(preflight.localEvidence.status)}</span></div>
<div class="cb-stat"><strong>Editorial evidence</strong><span data-editorial-evidence-status="true">${esc(preflight.editorialEvidence.status)}</span></div>
<div class="cb-stat" data-distance="true" data-distance-method="${esc(preflight.distanceMethod)}" data-distance-from="${esc(preflight.distanceFrom)}" data-distance-to="${esc(preflight.distanceTo)}"><strong>Pharmacy-to-area distance</strong><span>${esc(preflight.distanceLabel)}</span></div>
<div class="cb-stat" data-candidate-status="true"><strong>Saved candidate</strong><span>${preflight.existingCandidate ? "Unpublished candidate saved" : "No saved candidate for this area"}</span></div>
</div>
${preflight.distanceDetail ? `<p class="cb-lead" data-distance-detail="true">${esc(preflight.distanceDetail)}</p>` : ""}
${
  followUp && (evidencePlan.collectionSpentUsd || 0) > 0
    ? `<p class="cb-lead" data-evidence-spend-preserved="true">Previous ${esc(preflight.areaName)} evidence spend $${Number(evidencePlan.collectionSpentUsd || 0).toFixed(3)} is preserved. This plan only requests the missing ${esc(preflight.areaName)} area reference.</p>`
    : ""
}
${preflight.blocker ? `<p class="cb-blocker" id="oneLocalBlocker">${esc(preflight.blocker)}</p>` : ""}
${paid ? `<ul class="cb-area-summary" data-paid-calls="true">${paid}</ul>` : ""}
<div class="cb-one-local" id="evidencePreparationPanel" data-evidence-prep="true" style="border-style:dashed;margin:16px 0 0">
<h3>Evidence preparation — ${esc(evidencePlan.areaName)}</h3>
<p class="cb-lead">Caches are checked first. Places names alone are not descriptive local evidence. Review the plan, enter an evidence-only spending cap, then authorise that exact plan. The OpenAI generation budget is separate and is not charged here.</p>
<p data-content-contract="${esc(evidencePlan.contentContractId)}">Content contract ${esc(evidencePlan.contentContractId)} ${esc(evidencePlan.contentContractVersion)} — targeted GP, locality and distance research. Schools, landmarks, retail and transport are not searched unless a content role requires them.</p>
<p><strong>Missing evidence</strong></p>
<ul class="cb-area-summary" data-missing-evidence="true">${missingRows || "<li>No missing evidence layers.</li>"}</ul>
<p><strong>Cache reuse</strong></p>
<ul class="cb-area-summary">
<li>Local Places pack: ${evidencePlan.cacheReuse.localPackPresent ? "file present" : "none"} — ${esc(evidencePlan.cacheReuse.localPackDetail)}</li>
<li>Editorial pack: ${evidencePlan.cacheReuse.editorialPackPresent ? "file present" : "none"} — ${esc(evidencePlan.cacheReuse.editorialDetail)}</li>
<li>Places entities in cache: ${evidencePlan.cacheReuse.placesEntityCount}. ${esc(evidencePlan.placesNamesAreNotDescriptiveEvidence)}</li>
</ul>
<p><strong>${showingExecutedCalls ? "Executed calls" : "Proposed calls"}</strong> — ${esc(evidencePlan.estimatedCostLabel)}</p>
${
  evidencePlan.collectionOutcomeSummary
    ? `<p data-evidence-outcome="true"><strong>Collection outcome</strong> — ${esc(evidencePlan.collectionOutcomeSummary)}</p>`
    : ""
}
<table class="cb-area-summary" data-proposed-calls="true"${showingExecutedCalls ? ' data-executed-calls="true"' : ""} style="width:100%;border-collapse:collapse;font-size:13px">
<thead><tr><th align="left">Provider</th><th align="left">Call</th><th align="left">Purpose</th><th align="left">${showingExecutedCalls ? "Actual cost" : "Est. cost"}</th><th align="left">Status</th></tr></thead>
<tbody>${callRows || `<tr><td colspan="5">No paid evidence calls required.</td></tr>`}</tbody>
<tfoot><tr><td colspan="3"><strong>Evidence preparation total</strong></td><td><strong>$${showingExecutedCalls ? (evidencePlan.collectionSpentUsd || 0).toFixed(3) : evidencePlan.estimatedCostUsd.toFixed(3)}</strong></td><td data-evidence-total-status="true">${esc(collectionFooter)}</td></tr></tfoot>
</table>
<p class="cb-blocker" id="evidencePrepBlocker">${esc(evidencePlan.paidCollectionBlockedReason || evidencePlan.remainingBlocker || "")}</p>
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmEvidencePrep"/>
<span>I have reviewed the providers, proposed calls and estimated cost. This does not authorise paid collection.</span>
</label>
<label class="cb-setting" style="display:flex;flex-direction:column;gap:6px;margin:12px 0" data-evidence-spend-cap="true">
<span><strong>Evidence-only spending cap (USD)</strong> — separate from the later AI generation budget of up to $2.00.</span>
<input type="number" id="evidenceSpendCapUsd" min="0.01" step="0.01" inputmode="decimal" placeholder="e.g. 0.10" value="${evidencePlan.evidenceSpendingCapUsd != null ? esc(String(evidencePlan.evidenceSpendingCapUsd)) : ""}" style="max-width:160px;padding:8px 10px"/>
</label>
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmAuthoriseEvidence"/>
<span>I authorise this exact evidence plan and the evidence-only cap entered above. This does not authorise AI generation.</span>
</label>
<p style="margin-top:8px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
<button type="button" class="cb-primary-cta" id="btnSaveEvidencePlan">Save preparation plan</button>
<button type="button" class="cb-primary-cta ghost" id="btnAuthoriseEvidencePlan">Authorise this plan</button>
<button type="button" class="cb-primary-cta ghost" id="btnStartPaidEvidence"${evidencePlan.startPaidCollectionEnabled ? "" : " disabled"}>Start paid collection</button>
</p>
<div id="evidencePrepStatus" style="margin-top:12px;font-size:14px;display:none"></div>
<div id="evidenceCollectProgress" data-evidence-progress="true"${collectionOutcome ? ' data-evidence-outcome="true"' : ""} style="margin-top:8px;font-size:13px;${collectionOutcome ? "" : "display:none"}">${
    collectionOutcome ? esc(collectionOutcome) : ""
  }</div>
</div>
<p class="cb-local-actions">
<button type="button" class="cb-primary-cta" id="btnGenerateOneLocalPage" ${preflight.canGenerate ? "" : "disabled"}>${esc(GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL)}</button>
<a class="cb-primary-cta ghost" id="oneLocalPreviewLink" href="${esc(preflight.previewUrl)}">${preflight.existingCandidate ? "Open unpublished Preview" : "Preview (no saved candidate)"}</a>
<a class="cb-primary-cta ghost" id="oneLocalReviewLink" href="${esc(preflight.reviewUrl)}">Open Review Centre</a>
</p>
<p data-generation-remaining-copy="true" style="margin-top:8px;font-size:13px;color:#475569">${esc(preflight.generationAllowance.allowanceLabel)}. Generate makes one OpenAI call with no automatic retry.</p>
${
  preflight.generationAllowance.canAuthoriseAdditionalAttempt
    ? `<div class="cb-one-local" id="additionalGenerationAuthorisePanel" data-additional-generation-authorise="true" style="border-style:dashed;margin:16px 0 0">
<p><strong>${esc(AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL)}</strong></p>
<p data-additional-attempt-max-cost="true">Maximum cost: ${esc(preflight.generationAllowance.additionalAttemptMaxCostLabel)}. Previous spend is preserved.</p>
<label class="cb-setting" style="display:flex;gap:10px;align-items:flex-start;margin:12px 0">
<input type="checkbox" id="confirmAuthoriseAdditionalGeneration"/>
<span>I authorise one additional OpenAI call for this page. Previous spend is not reset. There is no automatic retry.</span>
</label>
<p style="margin-top:8px"><button type="button" class="cb-primary-cta" id="btnAuthoriseAdditionalGeneration">${esc(AUTHORISE_ONE_ADDITIONAL_ATTEMPT_LABEL)}</button></p>
</div>`
    : ""
}
<div id="oneLocalStatus" style="margin-top:12px;font-size:14px;display:none"></div>
</div>
<script>
(function(){
  function withAuthToken(href) {
    if (!href) return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
  }
  var preview = document.getElementById('oneLocalPreviewLink');
  var review = document.getElementById('oneLocalReviewLink');
  if (preview) preview.href = withAuthToken(preview.getAttribute('href') || '');
  if (review) review.href = withAuthToken(review.getAttribute('href') || '');
  var saveBtn = document.getElementById('btnSaveEvidencePlan');
  var prepStatus = document.getElementById('evidencePrepStatus');
  var progress = document.getElementById('evidenceCollectProgress');
  var startBtn = document.getElementById('btnStartPaidEvidence');
  var authoriseBtn = document.getElementById('btnAuthoriseEvidencePlan');
  var evidenceFingerprint = ${JSON.stringify(evidencePlan.planFingerprint || "")};
  function showPrep(msg, ok) {
    if (!prepStatus) return;
    prepStatus.style.display = 'block';
    prepStatus.textContent = msg;
    prepStatus.style.color = ok === true ? '#059669' : ok === false ? '#991b1b' : '#0f172a';
  }
  function showProgress(msg) {
    if (!progress) return;
    progress.style.display = 'block';
    progress.textContent = msg;
    progress.setAttribute('data-evidence-outcome', 'true');
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function updateEvidenceTable(run) {
    var table = document.querySelector('[data-proposed-calls="true"]');
    if (!table || !run || !run.calls || !run.calls.length) return;
    table.setAttribute('data-executed-calls', 'true');
    var tbody = table.querySelector('tbody');
    var statusCell = table.querySelector('[data-evidence-total-status="true"]');
    var totalCost = table.querySelector('tfoot td:nth-child(2)');
    if (tbody) {
      tbody.innerHTML = run.calls.map(function(row) {
        var cost = row.actualCostUsd == null ? '—' : '$' + Number(row.actualCostUsd).toFixed(3);
        var q = row.query ? '<div style="font-size:12px;color:#64748b;margin-top:4px">' + escapeHtml(row.query) + '</div>' : '';
        return '<tr data-executed-call="' + escapeHtml(row.id) + '"><td>' + escapeHtml(row.provider) + '</td><td>' + escapeHtml(row.kind) + '</td><td>' + escapeHtml(row.detail || row.id) + q + '</td><td>' + cost + '</td><td>' + escapeHtml(row.status) + '</td></tr>';
      }).join('');
    }
    if (totalCost) totalCost.innerHTML = '<strong>$' + Number(run.spentUsd || 0).toFixed(3) + '</strong>';
    if (statusCell) {
      statusCell.textContent = (run.status || 'completed') + ' · $' + Number(run.spentUsd || 0).toFixed(3) + ' spent' + (run.editorialSufficiency ? ' · ' + run.editorialSufficiency : '');
    }
  }
  if (saveBtn) saveBtn.onclick = async function(){
    saveBtn.disabled = true;
    if (prepStatus) { prepStatus.style.display = 'block'; prepStatus.textContent = 'Saving preparation plan without paid calls…'; prepStatus.style.color = '#005eb8'; }
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/local-page-evidence-plan'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ campaign: ${JSON.stringify(campaign)}, area: ${JSON.stringify(resolved.areaSlug)}, confirm: true, execute: false })
    });
    var json = await res.json();
    if (json.ok) {
      if (prepStatus) { prepStatus.textContent = json.detail || 'Preparation plan saved. No paid calls were made.'; prepStatus.style.color = '#059669'; }
      if (json.plan && json.plan.planFingerprint) evidenceFingerprint = json.plan.planFingerprint;
    } else {
      if (prepStatus) { prepStatus.textContent = json.error || 'The preparation plan could not be saved.'; prepStatus.style.color = '#991b1b'; }
      saveBtn.disabled = false;
    }
  };
  if (authoriseBtn) authoriseBtn.onclick = async function(){
    var reviewed = document.getElementById('confirmEvidencePrep');
    var authorise = document.getElementById('confirmAuthoriseEvidence');
    var capEl = document.getElementById('evidenceSpendCapUsd');
    if (!reviewed || !reviewed.checked) { showPrep('Review the providers, proposed calls and pricing uncertainty first.', false); return; }
    if (!authorise || !authorise.checked) { showPrep('Tick the authorisation box for this exact plan. The review checkbox does not authorise spend.', false); return; }
    var cap = capEl ? Number(capEl.value) : NaN;
    if (!isFinite(cap) || cap <= 0) { showPrep('Enter a positive evidence-only spending cap. This is separate from AI generation.', false); return; }
    authoriseBtn.disabled = true;
    showPrep('Recording authorisation for this exact plan…', true);
    if (prepStatus) prepStatus.style.color = '#005eb8';
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/local-page-evidence-authorise'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ campaign: ${JSON.stringify(campaign)}, area: ${JSON.stringify(resolved.areaSlug)}, spendingCapUsd: cap, confirmAuthorise: true, planFingerprint: evidenceFingerprint })
    });
    var json = await res.json();
    if (json.ok) {
      showPrep(json.detail || 'This exact plan is authorised. Start paid collection when ready. AI generation is not authorised.', true);
      if (startBtn) startBtn.disabled = false;
      if (json.plan && json.plan.planFingerprint) evidenceFingerprint = json.plan.planFingerprint;
    } else {
      showPrep(json.error || 'Authorisation was not recorded.', false);
      authoriseBtn.disabled = false;
    }
  };
  async function pollEvidenceRun() {
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/local-page-evidence-run?campaign=' + encodeURIComponent(${JSON.stringify(campaign)}) + '&area=' + encodeURIComponent(${JSON.stringify(resolved.areaSlug)})), {
      credentials: 'same-origin'
    });
    var json = await res.json();
    if (!json.ok || !json.run) return json;
    var run = json.run;
    var outcome = run.outcomeSummary || (run.findings || []).join(' ') || ('Collection ' + run.status + '. Evidence spend $' + (run.spentUsd || 0).toFixed(3) + '.');
    showProgress(outcome);
    updateEvidenceTable(run);
    if (run.status === 'running' || run.status === 'interrupted') {
      setTimeout(pollEvidenceRun, 1200);
    }
    return json;
  }
  if (startBtn) startBtn.onclick = async function(){
    if (startBtn.disabled) return;
    startBtn.disabled = true;
    showPrep('Starting authorised evidence collection…', true);
    if (prepStatus) prepStatus.style.color = '#005eb8';
    showProgress('Collection starting…');
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/local-page-evidence-collect'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ campaign: ${JSON.stringify(campaign)}, area: ${JSON.stringify(resolved.areaSlug)} })
    });
    var json = await res.json();
    if (json.ok && json.run) {
      var outcome = json.run.outcomeSummary || json.detail || (json.run.findings || []).join(' ');
      if (!outcome) {
        outcome = json.run.status === 'completed'
          ? ('Collection finished. Spend $' + (json.run.spentUsd || 0).toFixed(3) + '.')
          : ('Collection ' + json.run.status + '.');
      }
      showPrep(outcome, json.run.editorialSufficiency === 'READY' ? true : json.run.status === 'completed' ? null : true);
      showProgress(outcome);
      updateEvidenceTable(json.run);
      if (json.run.status === 'running' || json.run.status === 'interrupted') pollEvidenceRun();
    } else {
      showPrep(json.error || 'Collection could not start.', false);
      startBtn.disabled = ${evidencePlan.startPaidCollectionEnabled ? "false" : "true"};
    }
  };
  var btn = document.getElementById('btnGenerateOneLocalPage');
  var status = document.getElementById('oneLocalStatus');
  var extraBtn = document.getElementById('btnAuthoriseAdditionalGeneration');
  function showLocal(msg, ok) {
    if (!status) return;
    status.style.display = 'block';
    status.textContent = msg;
    status.style.color = ok === true ? '#059669' : ok === false ? '#991b1b' : '#005eb8';
  }
  if (extraBtn) extraBtn.onclick = async function(){
    if (extraBtn.disabled) return;
    var confirmExtra = document.getElementById('confirmAuthoriseAdditionalGeneration');
    if (!confirmExtra || !confirmExtra.checked) {
      showLocal('Tick the confirmation box to authorise one additional OpenAI call. No allowance was added.', false);
      return;
    }
    extraBtn.disabled = true;
    showLocal('Recording one additional authorised OpenAI attempt…', null);
    var res = await fetch(withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/authorise-additional-generation-attempt'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ campaign: ${JSON.stringify(campaign)}, area: ${JSON.stringify(resolved.areaSlug)}, confirmAuthorise: true })
    });
    var json = await res.json();
    if (json.ok) {
      showLocal(json.detail || 'One additional OpenAI attempt is authorised. Previous spend is preserved.', true);
      extraBtn.disabled = true;
      if (btn) btn.disabled = false;
      var panel = document.querySelector('[data-one-local-page="${esc(resolved.areaSlug)}"]');
      if (panel) {
        panel.setAttribute('data-can-generate', 'true');
        panel.setAttribute('data-can-authorise-additional', 'false');
        if (json.remainingCalls != null) panel.setAttribute('data-generation-remaining-calls', String(json.remainingCalls));
      }
    } else {
      showLocal(json.error || 'Additional authorisation was not recorded.', false);
      extraBtn.disabled = false;
    }
  };
  if (!btn) return;
  var submitting = false;
  btn.onclick = async function(){
    if (submitting || btn.disabled) return;
    submitting = true;
    btn.disabled = true;
    btn.setAttribute('data-submitting', 'true');
    if (status) { status.style.display = 'block'; status.textContent = 'Checking saved evidence…'; status.style.color = '#005eb8'; }
    var url = withAuthToken('/api/growth-engine/${esc(slug)}/campaign-builder/generate-local-page-candidate');
    var res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ campaign: ${JSON.stringify(campaign)}, area: ${JSON.stringify(resolved.areaSlug)} })
    });
    var json = await res.json();
    if (json.ok) {
      if (status) { status.textContent = 'Opening review…'; status.style.color = '#059669'; }
      setTimeout(function(){
        location.href = withAuthToken(json.reviewUrl || ${JSON.stringify(`/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(campaign)}`)});
      }, 600);
    } else {
      if (status) { status.textContent = json.error || 'This local page cannot be created yet.'; status.style.color = '#991b1b'; }
      submitting = false;
      btn.removeAttribute('data-submitting');
      btn.disabled = ${preflight.canGenerate ? "false" : "true"};
    }
  };
})();
</script>`;
}

function renderAreasStep(slug: string, focusedAreaSlug?: string): string {
  const session = loadCampaignBuilderSession(slug);
  const areaState = buildCampaignBuilderAreaOptions(slug, session);
  const { candidates, configuredLocalPages, outputs } = areaState;
  const campaign = session.selectedServiceId || "";
  const firstLocal = resolveOneLocalPageCandidateArea(slug);
  const focused = resolveOneLocalPageCandidateArea(slug, focusedAreaSlug);
  const selectedLocalAreas = listSelectedOneLocalPageCandidateAreas(slug);
  const selectedCount = candidates.filter((c) => c.selected).length;
  const canSave = selectedCount === configuredLocalPages && configuredLocalPages > 0;
  const areaRows = candidates.length
    ? candidates
        .map((c) => {
          const areaSlug = slugifyArea(c.area);
          const grade = String(c.grade || "More evidence needed");
          const gradeClass =
            grade === "High priority"
              ? "high"
              : grade === "Good opportunity"
                ? "good"
                : grade === "Additional area"
                  ? "additional"
                  : "needed";
          const rowPreflight = campaign && areaSlug ? preflightOneLocalPageCandidate(slug, campaign, areaSlug) : null;
          const isFocused = Boolean(focused && focused.areaSlug === areaSlug);
          const isSelectedLocal = selectedLocalAreas.some((row) => row.areaSlug === areaSlug);
          const distanceText = rowPreflight?.distanceLabel || c.distanceLabel || "Distance unavailable";
          const candidateLabel = rowPreflight?.existingCandidate ? "Saved candidate" : "No saved candidate";
          const evidenceLabel = rowPreflight
            ? `Local ${rowPreflight.localEvidence.status} · Editorial ${rowPreflight.editorialEvidence.status}`
            : "";
          return `<div class="cb-setting cb-area-row${isFocused ? " is-focused" : ""}" data-area="${esc(c.area)}" data-area-slug="${esc(areaSlug)}" data-focused="${isFocused ? "true" : "false"}" data-saved-candidate="${rowPreflight?.existingCandidate ? "true" : "false"}" style="display:block;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:10px">
<div style="display:flex;gap:10px;align-items:flex-start">
<label style="display:flex;gap:10px;align-items:flex-start;flex:1;cursor:pointer">
<input type="checkbox" class="area-candidate-check" name="targetAreas" value="${esc(c.area)}" ${c.selected ? "checked" : ""}/>
<div style="flex:1">
<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px">
<strong>${esc(c.area)}</strong>
${firstLocal && c.area === firstLocal.areaName ? `<span class="cb-area-grade high">First local page</span>` : ""}
${isFocused ? `<span class="cb-area-grade high">Working on this area</span>` : ""}
${rowPreflight?.existingCandidate ? `<span class="cb-area-grade high">Saved candidate</span>` : ""}
<span class="cb-area-grade ${gradeClass}">${esc(grade)}</span>
</div>
<p style="margin:0;font-size:13px;color:#64748b" data-row-distance="true">${esc(distanceText)}</p>
${evidenceLabel ? `<p style="margin:6px 0 0;font-size:13px;color:#475569" data-row-evidence="true">${esc(evidenceLabel)}</p>` : ""}
<p style="margin:6px 0 0;font-size:13px;color:#475569" data-row-candidate="true">${esc(candidateLabel)}</p>
</div>
</label>
</div>
${
  isSelectedLocal
    ? `<p class="cb-area-row-actions"><a class="cb-area-focus" data-focus-area="${esc(areaSlug)}" href="${esc(campaignBuilderAreaFocusUrl(slug, campaign, areaSlug))}"${isFocused ? ' aria-current="page"' : ""}>${isFocused ? `Showing ${esc(c.area)} workflow` : `Work on ${esc(c.area)}`}</a></p>`
    : ""
}
</div>`;
        })
        .join("")
    : `<p class="cb-empty">No stored areas were found in Your Pharmacy. Add local areas there before building this campaign.</p>`;

  const configJson = JSON.stringify({
    requiredCount: configuredLocalPages,
    outputs,
  }).replace(/</g, "\\u003c");

  return `<div class="cb-panel" data-focused-area="${esc(focused?.areaSlug || "")}" data-one-local-areas="${esc(selectedLocalAreas.map((row) => row.areaSlug).join(","))}">
<h2>Recommended target areas</h2>
<p class="cb-lead">PharmaConnect has prioritised ten nearby areas using your confirmed pharmacy and local-market evidence. You can change the selection before continuing. Use Work on this area to open that area’s evidence, distance, allowance and Generate controls without changing the selection.</p>
${renderDemoLocationWarning(slug)}
<div class="cb-banner" id="areaSelectionStatus">${selectedCount} of ${configuredLocalPages} recommended areas selected</div>
<div class="cb-stats" id="areaPackagePreview">
<div class="cb-stat"><strong>Local area pages</strong><span id="areaLocalPageCount">${selectedCount}</span></div>
<div class="cb-stat"><strong>Total campaign assets</strong><span id="areaPackageTotal">${authoritativeCampaignPackageTotal({ ...outputs, clusterPages: selectedCount })}</span></div>
</div>
<details class="cb-area-explain">
<summary>How areas are prioritised</summary>
<p>Priority considers whether an area is already a confirmed pharmacy target, how close it is to your pharmacy where a distance has been recorded, and any local-market competitor or healthcare evidence that can be linked to that area. Areas without enough recorded evidence are still available to select, but they are not given an opportunity grade based on proximity alone.</p>
</details>
<form method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/areas" id="areaSelectionForm">
<input type="hidden" name="campaign" value="${esc(campaign)}"/>
<input type="hidden" name="targetAreaMode" value="selected"/>
<p class="cb-lead" id="customAreaCount">${selectedCount} of ${configuredLocalPages} recommended areas selected</p>
<div id="areaCandidateList">${areaRows}</div>
<p style="margin-top:24px"><button type="submit" class="cb-primary-cta" id="btnSaveAreas" ${canSave ? "" : "disabled"}>Save &amp; Continue →</button></p>
</form>
${renderUkLocalServicePagesCampaignPanel(slug, campaign)}
${renderLocalPageImprovementCampaignPanel(slug, campaign)}
${renderLocalPageVariationRestoreCampaignPanel(slug, campaign)}
${renderRemainingLocalPagesCampaignPanel(slug, campaign)}
${renderOneLocalPageCandidatePanel(slug, campaign, focused?.areaSlug)}
</div>
<script>
(function(){
  var config = ${configJson};
  var form = document.getElementById('areaSelectionForm');
  var status = document.getElementById('areaSelectionStatus');
  var countEl = document.getElementById('customAreaCount');
  var saveBtn = document.getElementById('btnSaveAreas');
  var localCountEl = document.getElementById('areaLocalPageCount');
  var totalEl = document.getElementById('areaPackageTotal');
  function withAuthToken(href) {
    if (!href) return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
  }
  document.querySelectorAll('[data-focus-area]').forEach(function(link){
    var href = link.getAttribute('href') || '';
    link.setAttribute('href', withAuthToken(href));
  });
  function packageTotal(clusterPages) {
    var o = config.outputs || {};
    return (Number(o.servicePage)||0) + clusterPages + (Number(o.patientGuides)||0) + (Number(o.blogs)||0) + (Number(o.faqs)||0) + (Number(o.gbpPosts)||0) + (Number(o.socialPosts)||0) + (Number(o.emails)||0) + (Number(o.videos)||0) + (Number(o.landingPages)||0);
  }
  function selectedAreas() {
    return Array.prototype.map.call(document.querySelectorAll('.area-candidate-check:checked'), function(el){ return el.value; });
  }
  function sync() {
    var areas = selectedAreas();
    var localPages = areas.length;
    var canSave = localPages === config.requiredCount;
    var countText = localPages + ' of ' + config.requiredCount + ' recommended areas selected';
    if (status) status.textContent = canSave ? countText : 'Select exactly ' + config.requiredCount + ' areas to continue.';
    if (countEl) countEl.textContent = countText;
    if (localCountEl) localCountEl.textContent = String(localPages);
    if (totalEl) totalEl.textContent = String(packageTotal(localPages));
    if (saveBtn) saveBtn.disabled = !canSave;
  }
  document.querySelectorAll('.area-candidate-check').forEach(function(el){
    el.addEventListener('change', function(){
      if (selectedAreas().length > config.requiredCount) {
        el.checked = false;
      }
      sync();
    });
  });
  form && form.addEventListener('submit', function(ev){
    if (saveBtn && saveBtn.disabled) ev.preventDefault();
  });
  sync();
})();
</script>`;
}

function renderSummaryList(items: string[], emptyLabel = "None"): string {
  if (!items.length) return `<p class="cb-lead">${esc(emptyLabel)}</p>`;
  return `<ul style="margin:0;padding-left:20px;line-height:1.7">${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

const ESTIMATED_OUTPUT_ICONS: Partial<Record<keyof CampaignBuilderAssetSelection, string>> = {
  servicePage: "📄",
  landingPages: "📍",
  guides: "📘",
  faqs: "❓",
  blogs: "✍️",
  gbp: "📣",
  social: "📱",
  emails: "✉️",
  videos: "🎬",
  landingPage: "🏠",
};

function renderEstimatedOutputCards(assets: CampaignGenerationSummaryAssetRow[]): string {
  const rows = assets.filter((asset) => asset.selected && asset.key !== "images");
  const cards = rows
    .map((row) => {
      const icon = ESTIMATED_OUTPUT_ICONS[row.key] || "";
      return `<div class="cb-total-card">${icon ? `<div class="cb-icon">${icon}</div>` : ""}<strong>${esc(String(row.count))}</strong><span>${esc(row.label)}</span></div>`;
    })
    .join("");
  return `<div class="cb-totals">${cards}</div>`;
}

function renderOverviewStep(slug: string): string {
  const session = ensureCampaignBuilderImageDefaults(slug);
  const summary = buildCampaignGenerationSummary(slug, session);
  const campaign = session.selectedServiceId || "";
  if (!summary) {
    return `<div class="cb-panel"><p class="cb-lead">Select a campaign to see what we will prepare for you.</p><a class="cb-back" href="${esc(wizardUrl(slug, "choose"))}">← Back</a></div>`;
  }

  const assetChecklist = summary.assets
    .map(
      (asset) =>
        `<li style="margin-bottom:6px">${asset.selected ? "✓" : "○"} <strong>${esc(asset.label)}</strong>${asset.selected && asset.count ? ` <span style="color:#64748b">(${asset.count})</span>` : ""}</li>`,
    )
    .join("");

  const targetAreaList = summary.targetAreas;
  const localPageLabel = summary.targetAreaCount === 1 ? "local area page" : "local area pages";

  const imageDeferred = summary.deferredImageSlots.length > 0 ? summary.deferredImageSlots : [];
  const readyCount = summary.readyPhotoCount;
  const readyLabel = `${readyCount} approved ${readyCount === 1 ? "photo" : "photos"} ready`;
  const imageSupport: string[] = [];
  if (summary.selectedStockCount > 0) {
    imageSupport.push(
      `${summary.selectedStockCount} selected approved stock ${summary.selectedStockCount === 1 ? "photograph" : "photographs"}`,
    );
  }
  if (summary.approvedUploadCount > 0) {
    imageSupport.push(
      `${summary.approvedUploadCount} approved pharmacy-uploaded ${summary.approvedUploadCount === 1 ? "photograph" : "photographs"}`,
    );
  }
  if (summary.pendingUploadCount > 0) {
    imageSupport.push(
      `${summary.pendingUploadCount} pending pharmacy ${summary.pendingUploadCount === 1 ? "upload" : "uploads"} awaiting review`,
    );
  }
  imageSupport.push(
    summary.requestAiImages
      ? "AI images requested for later generation and review"
      : "AI images not requested",
  );
  const imageSupportHtml = renderSummaryList(imageSupport);

  const websiteMissing =
    summary.websiteMissingOpportunities.length > 0
      ? summary.websiteMissingOpportunities
      : ["No missing content opportunities identified"];

  const localOpportunities =
    summary.localOpportunitySummary.length > 0
      ? summary.localOpportunitySummary
      : ["Local market analysis not yet available"];

  return `<div class="cb-panel">
<h2>Generation Summary</h2>
<p class="cb-lead">Review exactly what will be generated for your pharmacy before you continue. Nothing has been built yet.</p>

<div class="cb-section">
<h3>Business</h3>
<div class="cb-stats cb-business-stats">
<div class="cb-stat"><strong>Pharmacy name</strong><span>${esc(summary.pharmacyName)}</span></div>
<div class="cb-stat"><strong>Website</strong><span>${summary.website !== "Not set" ? `<a href="${esc(summary.website)}" target="_blank" rel="noopener">${esc(summary.website)}</a>` : esc(summary.website)}</span></div>
<div class="cb-stat"><strong>Campaign</strong><span>${esc(summary.campaignName)}</span></div>
</div>
</div>

<div class="cb-section">
<h3>Campaign</h3>
<p style="margin:0 0 6px;font-size:18px;font-weight:900;color:#0f172a">${esc(summary.campaignName)}</p>
<p class="cb-lead">${esc(summary.campaignDescription)}</p>
</div>

<div class="cb-section">
<h3>Target Areas</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Local area pages</strong><span>${summary.targetAreaCount} ${esc(localPageLabel)}</span></div>
</div>
${renderSummaryList(targetAreaList, "No target areas selected")}
</div>

<div class="cb-section">
<h3>Assets</h3>
<p class="cb-lead">Marketing content included in this campaign:</p>
<ul style="margin:0;padding-left:20px;line-height:1.7">${assetChecklist}</ul>
</div>

<div class="cb-section">
<h3>Images</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Images</strong><span>${esc(readyLabel)}</span></div>
</div>
${imageSupportHtml}
<p class="cb-lead">The engine places suitable images on service and locality pages. You do not assign hero, support, trust, conversion or locality slots.</p>
${imageDeferred.length ? `<p style="margin:12px 0 4px;font-weight:700">Notes</p>${renderSummaryList(imageDeferred)}` : ""}
</div>

<div class="cb-section">
<h3>Website Intelligence Summary</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Pages found</strong><span>${summary.websitePagesFound ?? "Not analysed"}</span></div>
<div class="cb-stat"><strong>Services detected</strong><span>${summary.websiteServicesDetected ?? "Not analysed"}</span></div>
</div>
<p style="margin:12px 0 4px;font-weight:700">Missing opportunities</p>
${renderSummaryList(websiteMissing, "None identified")}
</div>

<div class="cb-section">
<h3>Local Market Summary</h3>
<div class="cb-stats">
<div class="cb-stat"><strong>Competitors analysed</strong><span>${summary.competitorsAnalysed ?? "Not analysed"}</span></div>
<div class="cb-stat"><strong>Healthcare network</strong><span>${esc(summary.healthcareNetworkSummary || "Not analysed")}</span></div>
</div>
${summary.healthcareNetworkSupportingCopy ? `<p class="cb-lead">${esc(summary.healthcareNetworkSupportingCopy)}</p>` : ""}
${summary.healthcareNetworkBreakdown.length ? renderSummaryList(summary.healthcareNetworkBreakdown) : ""}
<p style="margin:12px 0 4px;font-weight:700">Local opportunity summary</p>
${renderSummaryList(localOpportunities)}
</div>

<div class="cb-section">
<h3>Estimated Output</h3>
${renderEstimatedOutputCards(summary.assets)}
<div class="cb-stats" style="margin-top:16px">
<div class="cb-stat"><strong>Total assets</strong><span>${summary.estimated.totalAssets}</span></div>
<div class="cb-stat"><strong>Estimated build time</strong><span>${esc(summary.estimated.buildTime)}</span></div>
</div>
</div>

<div class="cb-banner" style="margin-top:24px;background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a">
<p style="margin:0 0 8px;font-weight:700">Before you generate</p>
<p style="margin:0">Nothing will be published automatically.</p>
<p style="margin:8px 0 0">Everything will open in the Review Centre for approval before publishing.</p>
</div>

<p style="margin-top:24px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
<a class="cb-primary-cta ghost" href="${esc(wizardUrl(slug, "images"))}">← Back</a>
<button type="button" class="cb-primary-cta" id="btnGenerate">${esc(CB_UX_GENERATE_MY_CAMPAIGN)}</button>
</p>
<div id="genStatus" style="margin-top:14px;font-size:14px;display:none"></div>
</div>
<script>
document.getElementById('btnGenerate') && (document.getElementById('btnGenerate').onclick = async function(){
  var btn = document.getElementById('btnGenerate');
  var status = document.getElementById('genStatus');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = 'Creating a fresh campaign from the saved profile. Previous runs stay as inactive history.';
  status.style.color = '#005eb8';
  var handoff = new URLSearchParams(location.search).get('_t');
  var auth = handoff ? '&_t=' + encodeURIComponent(handoff) : '';
  var campaign = ${JSON.stringify(campaign)};
  var res = await fetch('/api/growth-engine/${esc(slug)}/campaign-builder/generate?confirmed=1' + auth, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({ campaign: campaign, serviceId: campaign, confirmed: true })
  });
  var json = await res.json().catch(function(){ return {}; });
  if (!json.ok) {
    status.textContent = json.error || 'We could not generate your campaign. Please try again.';
    status.style.color = '#991b1b';
    btn.disabled = false;
    return;
  }
  if (json.duplicate) {
    status.textContent = 'This campaign is already running. No extra calls were started.';
  }
  async function poll() {
    var check = await fetch('/api/growth-engine/${esc(slug)}/campaign-builder/regeneration-run?serviceId=' + encodeURIComponent(campaign) + auth, {
      credentials: 'same-origin',
      headers: {'Accept':'application/json'}
    });
    var body = await check.json().catch(function(){ return {}; });
    var run = body.run || json.run || {};
    var runStatus = run.status || '';
    if (runStatus === 'completed') {
      status.style.color = '#059669';
      status.textContent = 'Campaign version ' + (run.candidateVersion || '') + ' is ready. Nothing was published or indexed.';
      setTimeout(function(){ location.href = '${esc(wizardUrl(slug, "review"))}'; }, 800);
      return;
    }
    if (runStatus === 'stopped' || runStatus === 'interrupted') {
      status.style.color = '#991b1b';
      status.textContent = run.failedError || 'Campaign stopped. Previous runs were kept as inactive history.';
      btn.disabled = false;
      return;
    }
    status.style.color = '#005eb8';
    status.textContent = 'Creating campaign version ' + (run.candidateVersion || '') + (run.currentAreaSlug ? ' — ' + run.currentAreaSlug : '') + '.';
    setTimeout(poll, 2500);
  }
  poll();
});
</script>`;
}

function renderSettingOption(
  key: keyof CampaignBuilderAssetSelection,
  label: string,
  count: number,
  checked: boolean,
): string {
  return `<div class="cb-setting">
<input type="checkbox" id="${esc(key)}" name="${esc(key)}" value="true" data-count="${esc(String(count))}" ${checked ? "checked" : ""}/>
<label for="${esc(key)}"><strong>${esc(String(count))} ${esc(label)}</strong></label>
</div>`;
}

function renderSettingsStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const outputs = resolveCampaignBuilderPackageOutputs(slug);
  const selection = resolveCampaignBuilderAssetSelection(session);
  const rows = outputs ? campaignPackageSelectionRows(outputs, selection) : [];
  const selectedTotal = rows.filter((row) => row.selected).reduce((sum, row) => sum + row.count, 0);
  const campaign = session.selectedServiceId || "";
  const cards = rows
    .map((row) => renderSettingOption(row.key, row.label, row.count, row.selected))
    .join("");

  return `<div class="cb-panel">
<h2>Select Assets</h2>
<p class="cb-lead">This is the same campaign package as Your Growth Plan. Deselect anything you do not want included. Quantities stay with each asset type if you select it again.</p>
<div class="cb-banner" id="assetSelectionTotal">${selectedTotal} campaign assets selected</div>
<form method="get" action="/api/growth-engine/campaign-builder" id="assetSelectionForm">
<input type="hidden" name="slug" value="${esc(slug)}"/>
<input type="hidden" name="step" value="images"/>
<input type="hidden" name="campaign" value="${esc(campaign)}"/>
<input type="hidden" name="mode" value="manual"/>
<div class="cb-settings-grid" id="assetGrid">
${cards || `<p class="cb-empty">Select a campaign before choosing assets.</p>`}
</div>
<p style="margin-top:24px"><button type="submit" class="cb-primary-cta">Continue →</button></p>
</form>
</div>
<script>
(function(){
  var form = document.getElementById('assetSelectionForm');
  var totalEl = document.getElementById('assetSelectionTotal');
  function sync() {
    var total = 0;
    document.querySelectorAll('#assetGrid input[type="checkbox"]').forEach(function(el){
      if (el.checked) total += Number(el.getAttribute('data-count') || 0);
    });
    if (totalEl) totalEl.textContent = total + ' campaign assets selected';
  }
  form && form.querySelectorAll('input[type="checkbox"]').forEach(function(el){
    el.addEventListener('change', sync);
  });
  sync();
})();
</script>`;
}

function imageStrategyLabel(strategy: CampaignBuilderImageStrategy): string {
  switch (strategy) {
    case "existing":
      return "Use Existing Images";
    case "upload":
      return "Upload Pharmacy Images";
    case "ai":
      return "Generate Campaign Images with AI";
    default:
      return "Mixed strategy (existing, uploads and AI)";
  }
}

function renderImagePlanTable(slug: string, plan: NonNullable<ReturnType<typeof buildCampaignBuilderImagePlan>>): string {
  const rows = plan.slots
    .map((slot) => {
      const thumb = slot.previewUrl
        ? `<img src="${esc(slot.previewUrl)}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0"/>`
        : `<span style="font-size:12px;color:#94a3b8">—</span>`;
      const status =
        slot.approvalState === "deferred"
          ? "Deferred until publishing"
          : slot.approvalState === "approved"
            ? "Approved"
            : slot.approvalState === "pending"
              ? "Pending approval"
              : "Missing";
      return `<tr>
<td>${thumb}</td>
<td><strong>${esc(slot.label)}</strong></td>
<td>${esc(slot.sourceType)}</td>
<td>${esc(slot.tenantStatus)}</td>
<td>${esc(status)}</td>
</tr>`;
    })
    .join("");
  const missing = plan.slots.filter((s) => s.approvalState === "missing").length;
  return `<div class="cb-section" style="margin-top:24px">
<h3>Campaign image plan</h3>
<p class="cb-lead">Strategy: ${esc(imageStrategyLabel(plan.strategy))} · Local pages: ${plan.localImageMode === "shared" ? "One shared image" : "Area-specific"}${missing ? ` · ${missing} slot(s) still missing` : ""}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<thead><tr style="text-align:left;border-bottom:1px solid #e2e8f0">
<th style="padding:8px 6px">Preview</th><th style="padding:8px 6px">Slot</th><th style="padding:8px 6px">Source</th><th style="padding:8px 6px">Tenant</th><th style="padding:8px 6px">Status</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin-top:12px"><a class="cb-back" href="${esc(wizardUrl(slug, "images"))}">← Edit image plan</a></p>
</div>`;
}

function renderImageSlotCard(slot: CampaignBuilderImageSlotPlan): string {
  const thumb = slot.previewUrl
    ? `<img src="${esc(slot.previewUrl)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0"/>`
    : `<div style="height:120px;border-radius:12px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:13px">${slot.approvalState === "deferred" ? "Deferred until publishing" : "No image assigned"}</div>`;
  const statusCls =
    slot.approvalState === "approved"
      ? "grow"
      : slot.approvalState === "pending"
        ? "new"
        : slot.approvalState === "deferred"
          ? "new"
          : "new";
  return `<article class="cb-premium" data-slot="${esc(slot.slot)}" style="padding:18px">
<header style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px">
<div><strong>${esc(slot.label)}</strong><p style="margin:6px 0 0;font-size:13px;color:#64748b">${esc(slot.hint)}</p></div>
<span class="cb-badge ${statusCls}">${esc(slot.approvalState)}</span>
</header>
${thumb}
<div style="margin-top:12px;font-size:13px;color:#475569;line-height:1.6">
<div><strong>Source:</strong> ${esc(slot.sourceType)} · <strong>Tenant:</strong> ${esc(slot.tenantStatus)}</div>
${slot.mimeType ? `<div><strong>File type:</strong> ${esc(slot.mimeType)}</div>` : ""}
${slot.dimensions ? `<div><strong>Dimensions:</strong> ${esc(slot.dimensions)}</div>` : ""}
</div>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
<button type="button" class="cb-primary-cta ghost btn-slot-library" data-slot="${esc(slot.slot)}">Browse Library</button>
<button type="button" class="cb-primary-cta ghost btn-slot-upload" data-slot="${esc(slot.slot)}">Upload Own Image</button>
<button type="button" class="cb-primary-cta ghost btn-slot-ai" data-slot="${esc(slot.slot)}">Generate AI Image</button>
<button type="button" class="cb-primary-cta ghost btn-slot-remove" data-slot="${esc(slot.slot)}" ${slot.approvalState === "missing" ? "disabled" : ""}>Remove Assignment</button>
<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;width:100%"><input type="checkbox" class="defer-slot-check" data-slot="${esc(slot.slot)}" ${slot.deferPublishingNote ? "checked" : ""}/> Campaign image will be added before publishing</label>
</div>
<input type="file" class="slot-upload-input" data-slot="${esc(slot.slot)}" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" style="display:none"/>
</article>`;
}

function renderImagesStep(slug: string): string {
  const session = ensureCampaignBuilderImageDefaults(slug);
  const view = buildCampaignImageStrategyView(slug, session);
  const stockCards = view.stock
    .map((img) => {
      const thumb = img.previewUrl
        ? `<img src="${esc(img.previewUrl)}" alt="${esc(img.altText)}"/>`
        : `<div class="cb-stock-preview">No preview</div>`;
      return `<article class="cb-image-card cb-stock-card${img.selected ? " selected" : ""}" data-stock-id="${esc(img.imageId)}">
${thumb}
<div class="cb-image-meta">Approved stock · Verified</div>
<label><input type="checkbox" name="selectedStockImageIds" value="${esc(img.imageId)}" ${img.selected ? "checked" : ""}/> <span class="cb-stock-state">${img.selected ? "Selected for this campaign" : "Not selected"}</span></label>
</article>`;
    })
    .join("");
  const uploadCards = view.uploads
    .map((img) => {
      const thumb = img.previewUrl
        ? `<img src="${esc(img.previewUrl)}" alt=""/>`
        : `<div style="height:88px;border-radius:8px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;color:#64748b">No preview</div>`;
      return `<article class="cb-image-card" data-upload-id="${esc(img.imageId)}">
${thumb}
<strong>${esc(img.filename)}</strong>
<div class="cb-image-meta">${esc(img.sourceLabel)}</div>
<div class="cb-image-meta">${esc(img.reviewStatus)}</div>
</article>`;
    })
    .join("");
  const pendingAiNote =
    view.requestAiImages && view.pendingAi.length
      ? `<p class="cb-lead">Recorded AI requests for this Pharmacy First campaign: ${esc(String(view.pendingAi.length))} pending. They are not generated or approved images.</p>`
      : `<p class="cb-lead">This screen does not generate images. AI requests are recorded for later generation and review.</p>`;
  return `<div class="cb-panel">
<h2>Choose your campaign images</h2>
<p class="cb-lead">Use approved pharmacy stock photography, add your own pharmacy photos, or request campaign-specific AI images. All images must be reviewed before publication.</p>
<section class="cb-image-source" aria-labelledby="stock-photos-heading">
<h3 id="stock-photos-heading">Approved stock photographs</h3>
<p class="cb-lead">Use pre-approved pharmacy photographs from the PharmaConnect image library. The campaign engine will place suitable images automatically.</p>
<div class="css-image-grid cb-stock-grid">${stockCards || `<p class="cb-empty">No approved, verified Pharmacy First photographs are available to select.</p>`}</div>
</section>
<section class="cb-image-source" aria-labelledby="pharmacy-photos-heading">
<h3 id="pharmacy-photos-heading">Your pharmacy photographs</h3>
<p class="cb-lead">Upload photographs of your pharmacy, team, pharmacist, consultation room, signage or local area for use in this campaign.</p>
<div class="css-image-upload">
<label for="tenantLibraryFiles">Upload pharmacy photographs</label>
<input type="file" id="tenantLibraryFiles" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple/>
</div>
<p class="cb-lead" style="margin-top:10px">Uploaded photographs are customer-provided and stay pending review. They are not approved automatically.</p>
<div class="css-image-grid">${uploadCards || `<p class="cb-empty">No pharmacy photographs uploaded for this campaign yet.</p>`}</div>
</section>
<section class="cb-image-source" aria-labelledby="ai-requests-heading">
<h3 id="ai-requests-heading">AI image requests</h3>
<p class="cb-lead">Request campaign-specific images where suitable photography is unavailable. Requests are recorded now and images must be generated and reviewed later.</p>
<div class="cb-ai-choice">
<label class="${view.requestAiImages ? "" : "selected"}"><input type="radio" name="requestAiImages" value="no" ${view.requestAiImages ? "" : "checked"}/> Do not request AI images. This screen does not generate images.</label>
<label class="${view.requestAiImages ? "selected" : ""}"><input type="radio" name="requestAiImages" value="yes" ${view.requestAiImages ? "checked" : ""}/> Request campaign-specific AI images for this Pharmacy First campaign. Requests are recorded only; images are generated and reviewed later.</label>
</div>
${pendingAiNote}
</section>
<p class="cb-lead" style="margin-top:24px">After approval, the campaign engine assigns suitable images to hero, support, trust and locality positions.</p>
<div id="imageStepStatus" class="cb-banner" style="margin-top:18px"></div>
<p style="margin-top:24px;display:flex;flex-wrap:wrap;gap:10px">
<button type="button" class="cb-primary-cta" id="btnConfirmImagePlan">Continue →</button>
</p>
</div>
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var statusEl = document.getElementById('imageStepStatus');
  function setStatus(msg, ok){ if(!statusEl) return; statusEl.textContent = msg; statusEl.style.background = ok ? '#ecfdf5' : '#fff7ed'; statusEl.style.color = ok ? '#065f46' : '#92400e'; }
  function selectedStockIds(){
    return Array.prototype.map.call(document.querySelectorAll('input[name="selectedStockImageIds"]:checked'), function(el){ return el.value; });
  }
  function requestAi(){
    var yes = document.querySelector('input[name="requestAiImages"][value="yes"]');
    return !!(yes && yes.checked);
  }
  function payload(){
    return { selectedStockImageIds: selectedStockIds(), requestAiImages: requestAi() };
  }
  async function persist(){
    var res = await fetch('/api/growth-engine/' + SLUG + '/campaign-builder/images', {
      method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload())
    });
    return res.json();
  }
  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (!t) return;
    if (t.name === 'selectedStockImageIds') {
      var card = t.closest('[data-stock-id]');
      if (card) {
        card.classList.toggle('selected', t.checked);
        var state = card.querySelector('.cb-stock-state');
        if (state) state.textContent = t.checked ? 'Selected for this campaign' : 'Not selected';
      }
      persist();
    }
    if (t.name === 'requestAiImages') {
      document.querySelectorAll('.cb-ai-choice label').forEach(function(lab){ lab.classList.toggle('selected', lab.querySelector('input') && lab.querySelector('input').checked); });
      persist();
    }
  });
  var files = document.getElementById('tenantLibraryFiles');
  if (files) files.addEventListener('change', async function(){
    if (!this.files || !this.files.length) return;
    await persist();
    var data = new FormData();
    for (var i = 0; i < this.files.length; i++) data.append('files', this.files[i]);
    var res = await fetch('/api/pharmacy/image-library/' + encodeURIComponent(SLUG) + '/tenant-library/upload', { method: 'POST', credentials: 'same-origin', body: data });
    var json = await res.json();
    if (!json.ok && !json.library) { setStatus(json.error || 'Upload failed', false); return; }
    window.location.reload();
  });
  document.getElementById('btnConfirmImagePlan')?.addEventListener('click', async function(){
    var res = await fetch('/api/growth-engine/' + SLUG + '/campaign-builder/images/confirm', {
      method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload())
    });
    var json = await res.json();
    if(json.ok){ location.href = json.overviewUrl; return; }
    setStatus(json.error || 'Confirm the image strategy before continuing', false);
  });
})();
</script>`;
}
function renderApprovalStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const serviceId = session.selectedServiceId;
  if (serviceId && contentPackageGenerated(slug, serviceId)) {
    return renderReviewStep(slug);
  }
  return renderOverviewStep(slug);
}

function renderReviewStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const serviceId = session.selectedServiceId;
  const generated = serviceId ? contentPackageGenerated(slug, serviceId) : false;
  const items = buildCampaignBuilderReviewItems(slug);
  const allApproved = allCampaignBuilderAssetsApproved(slug);
  const canPublish = campaignBuilderReadyToPublish(slug);

  if (!generated) {
    return `<div class="cb-panel">
<h2>Review Your Campaign</h2>
<p class="cb-lead">Your campaign content will appear here once your campaign has been built.</p>
<a class="cb-back" href="${esc(wizardUrl(slug, "approval"))}">← Back to Ready To Build</a>
</div>`;
  }

  const grouped = items
    .map(
      (item) => `<div class="cb-review-item${item.approved ? " approved" : ""}">
<div class="cb-review-head">
<h4>${esc(item.title)}${item.count > 1 ? ` (${item.count})` : ""}</h4>
<span class="cb-quality ${item.qualityScore >= 85 ? "" : item.qualityScore >= 70 ? "mid" : "low"}">Quality Score · ${item.qualityScore}%</span>
</div>
<div class="cb-review-actions">
${item.previewUrl ? `<a class="cb-primary-cta ghost" href="${esc(item.previewUrl)}" target="_blank" rel="noopener">Preview</a>` : ""}
${item.approved
  ? `<span class="cb-primary-cta ghost" style="opacity:.7;cursor:default">✓ Approved</span>`
  : `<form method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/approve-asset" style="display:inline">
<input type="hidden" name="assetKey" value="${esc(item.key)}"/>
<button type="submit" class="cb-primary-cta">Approve</button>
</form>`}
<form method="post" action="/api/growth-engine/${esc(slug)}/campaign-builder/regenerate" style="display:inline">
<input type="hidden" name="assetKey" value="${esc(item.key)}"/>
<button type="submit" class="cb-primary-cta ghost">Regenerate</button>
</form>
</div>
</div>`,
    )
    .join("");

  const publishBlock =
    allApproved && canPublish && serviceId
      ? `<p style="margin-top:24px"><a class="cb-primary-cta" href="${esc(campaignBuilderPublishUrl(slug, serviceId))}">Publish Campaign →</a></p>`
      : "";

  return `<div class="cb-panel">
<h2>Review Your Campaign</h2>
<p class="cb-lead">Everything has been generated. Review each asset before publishing.</p>
${allApproved ? `<div class="cb-banner">✓ All content approved — your campaign is ready to publish.</div>` : `<div class="cb-banner" style="background:#fff7ed;border-color:#fed7aa;color:#9a3412">Approve each item to unlock publishing.</div>`}
${grouped || "<p class=\"cb-empty\">No content to review yet.</p>"}
${publishBlock}
</div>`;
}

function stepHero(slug: string, active: CampaignBuilderStep): { title: string; subtitle: string } {
  switch (active) {
    case "areas":
      return {
        title: "Target Areas",
        subtitle: "Choose whole-town coverage or confirmed local areas from your profile and local market.",
      };
    case "settings":
      return {
        title: "Select Assets",
        subtitle: "Choose the marketing content to include in this campaign.",
      };
    case "images":
      return {
        title: "Choose your campaign images",
        subtitle: "Use approved pharmacy stock photography, add your own pharmacy photos, or request campaign-specific AI images. All images must be reviewed before publication.",
      };
    case "overview":
      return {
        title: "Generation Summary",
        subtitle: "Review your full campaign plan, then generate when you are ready. Nothing is published automatically.",
      };
    case "approval":
      return {
        title: "Generation Summary",
        subtitle: "Review your full campaign plan, then generate when you are ready.",
      };
    case "review":
      return {
        title: "Review Centre",
        subtitle: "Everything has been generated. Review each asset before publishing.",
      };
    default:
      return {
        title: CB_UX_CHOOSE_TITLE,
        subtitle: resolveAuthoritativeCampaignPriority(slug) ? CB_UX_CHOOSE_SELECTED_SUBTITLE : CB_UX_CHOOSE_SUBTITLE,
      };
  }
}

export function renderCampaignBuilderPage(
  slug: string,
  step: CampaignBuilderStep,
  options?: { area?: string },
): string {
  if (isNationalGrowthPlatform(slug)) {
    const copy = growthEnginePlatformCopy("national");
    return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>National campaign strategy · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
.cb-shell{max-width:920px;margin:0 auto;padding:32px 20px 80px}
.cb-panel{background:#fff;border:1px solid #e8edf3;border-radius:24px;padding:28px;box-shadow:0 12px 40px rgba(15,23,42,.05)}
.cb-panel h1{margin:0 0 10px;font-size:24px}
.ge-btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff}
.ge-btn-primary{background:#005eb8;border-color:#005eb8;color:#fff}
</style>
</head>
<body data-slug="${esc(slug)}" data-growth-platform="national">
<div class="cb-shell">
<div class="cb-panel">
<h1>National campaign strategy</h1>
<p>${esc(copy.generateStepSubtitle)}</p>
<p>A national recommendation such as pharmacy SEO must not open the NHS / Pharmacy First campaign explorer. National commercial content generation is not yet implemented.</p>
<p style="margin-top:18px"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}">Return to national Growth Plan →</a></p>
</div>
</div>
</body></html>`;
  }
  const session = loadCampaignBuilderSession(slug);
  const activeStep = step || session.step || "choose";
  const serviceId = session.selectedServiceId;
  const generated = serviceId ? contentPackageGenerated(slug, serviceId) : false;
  const hero = stepHero(slug, activeStep);

  let body = "";
  switch (activeStep) {
    case "areas":
      body = renderAreasStep(slug, options?.area);
      break;
    case "settings":
      body = renderSettingsStep(slug);
      break;
    case "images":
      body = renderImagesStep(slug);
      break;
    case "overview":
      body = renderOverviewStep(slug);
      break;
    case "approval":
      body = renderApprovalStep(slug);
      break;
    case "review":
      body = renderReviewStep(slug);
      break;
    default:
      body = renderChooseStep(slug);
  }

  const prevMap: Partial<Record<CampaignBuilderStep, CampaignBuilderStep>> = {
    areas: "choose",
    settings: "areas",
    images: "settings",
    overview: "images",
    approval: "overview",
    review: "overview",
  };
  const prev = prevMap[activeStep];
  const backLink = prev
    ? `<a class="cb-back" href="${esc(wizardUrl(slug, prev))}">← Back</a>`
    : `<a class="cb-back" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">← Your Growth Plan</a>`;

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Campaign Builder · PharmaConnect</title>
<style>
${commercialBlueUiBaselineCss()}
body{font-family:Inter,system-ui,Arial,sans-serif;margin:0;background:#f4f7fb;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${campaignBuilderPageCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:${commercialBlueChromeGradientCss()};color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="cb-shell">
<div class="cb-hero">
<h1>${esc(hero.title)}</h1>
<p>${esc(hero.subtitle)}</p>
</div>
${renderStepper(activeStep, slug, generated)}
${backLink}
${body}
</div>
</body></html>`);
}
