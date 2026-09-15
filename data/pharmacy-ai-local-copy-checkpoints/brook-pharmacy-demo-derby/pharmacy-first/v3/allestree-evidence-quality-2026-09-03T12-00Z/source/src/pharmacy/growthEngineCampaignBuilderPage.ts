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
  GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL,
  preflightOneLocalPageCandidate,
  resolveOneLocalPageCandidateArea,
} from "./growthEngineLocalPageCandidateService.ts";
import { saveOneLocalPageEvidencePreparationPlan } from "./growthEngineLocalPageEvidencePreparationService.ts";
import { decorateLocalPageEvidencePlan } from "./growthEngineLocalPageEvidenceCollectionService.ts";
import { BROOK_DERBY_DEMO_SLUG } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { loadSalesDemoBrookDerbyAreaSelection } from "./pharmacySalesDemoBrookDerbyAreaSelection.ts";
import {
  tenantImageLibraryPanelCss,
} from "./pharmacyTenantImageLibraryPanel.ts";
import {
  CB_UX_BUILD_CAMPAIGN,
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
.cb-shell{max-width:920px;margin:0 auto;padding:32px 20px 80px}
.cb-hero{background:${commercialBlueChromeGradientCss()};border-radius:24px;padding:32px 28px;color:#fff;margin-bottom:28px;box-shadow:0 20px 50px rgba(15,23,42,.12)}
.cb-hero h1{margin:0 0 10px;font-size:28px;font-weight:900;letter-spacing:-.02em}
.cb-hero p{margin:0;font-size:15px;color:#dbeafe;line-height:1.65;max-width:640px}
.cb-steps{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}
.cb-step{font-size:11px;font-weight:800;padding:8px 14px;border-radius:999px;background:#fff;color:#64748b;border:1px solid #e2e8f0;text-decoration:none}
.cb-step.active{background:#005eb8;color:#fff;border-color:#005eb8}
.cb-step.done{background:#ecfdf5;color:#166534;border-color:#bbf7d0}
.cb-panel{background:#fff;border:1px solid #e8edf3;border-radius:24px;padding:28px;margin-bottom:24px;box-shadow:0 12px 40px rgba(15,23,42,.05)}
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
.cb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:18px 0 22px}
.cb-stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px}
.cb-stat strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:6px}
.cb-stat span{font-size:18px;font-weight:900;color:#0f172a}
.cb-business-stats{grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));align-items:stretch}
.cb-business-stats .cb-stat{min-width:0;overflow:hidden;box-sizing:border-box}
.cb-business-stats .cb-stat strong{font-weight:800;font-size:13px;text-transform:none;letter-spacing:0;color:#0f172a}
.cb-business-stats .cb-stat span,.cb-business-stats .cb-stat a{display:block;max-width:100%;font-size:15px;font-weight:400;line-height:1.5;color:#334155;overflow-wrap:anywhere;word-break:break-word}
.cb-primary-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#005eb8;color:#fff;border:0;border-radius:14px;padding:14px 22px;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none;box-shadow:0 10px 24px rgba(0,94,184,.22)}
.cb-primary-cta:hover{background:#00478a}
.cb-primary-cta:disabled{opacity:.55;cursor:not-allowed}
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
.cb-one-local{border:2px solid #005eb8;border-radius:20px;padding:20px 22px;margin:22px 0 8px;background:linear-gradient(180deg,#f8fbff,#fff)}
.cb-one-local h3{margin:0 0 10px;font-size:18px;font-weight:900;color:#0f172a}
.cb-one-local .cb-blocker{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:12px 14px;font-size:14px;font-weight:700;line-height:1.55;margin:12px 0}
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
@media(max-width:720px){.cb-hero h1{font-size:24px}.cb-premium-name{font-size:22px}}
${campaignRecommendationIntelligenceStyles()}
${campaignExplorerStyles()}
`;
}

function wizardUrl(slug: string, step: CampaignBuilderStep, campaignId?: string | null): string {
  const campaign = campaignId ?? loadCampaignBuilderSession(slug).selectedServiceId;
  return campaignBuilderWizardUrl(slug, step, step === "choose" ? null : campaign);
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
<a class="cb-primary-cta" href="${esc(campaignBuilderWizardUrl(slug, "areas", c.serviceId))}">${esc(CB_UX_BUILD_CAMPAIGN)}</a>
</div>`;
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

function renderOneLocalPageCandidatePanel(slug: string, campaign: string): string {
  if (!campaign) return "";
  const resolved = resolveOneLocalPageCandidateArea(slug);
  if (!resolved) return "";
  const preflight = preflightOneLocalPageCandidate(slug, campaign, resolved.areaSlug);
  const evidencePlan = decorateLocalPageEvidencePlan(
    saveOneLocalPageEvidencePreparationPlan({
      slug,
      serviceId: campaign,
      areaSlug: resolved.areaSlug,
      confirm: false,
    }).plan,
  );
  const paid = preflight.paidCallsRequired
    .filter((row) => row.required)
    .map((row) => `<li>${esc(row.reason)}</li>`)
    .join("");
  const missingRows = evidencePlan.missing
    .map((row) => `<li data-evidence-gap="${esc(row.id)}"><strong>${esc(row.layer)}</strong> — ${esc(row.detail)}</li>`)
    .join("");
  const executedCalls = evidencePlan.executedCalls || [];
  const showingExecutedCalls = executedCalls.length > 0;
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
  return `<div class="cb-one-local" data-one-local-page="${esc(resolved.areaSlug)}" data-can-generate="${preflight.canGenerate ? "true" : "false"}">
<h3>One local page — ${esc(preflight.areaName)}</h3>
<p class="cb-lead">Select ${esc(preflight.areaName)} above, then create one unpublished local page for review. This does not build the full campaign or the other selected areas.</p>
<div class="cb-stats">
<div class="cb-stat"><strong>Campaign scope</strong><span>${esc(preflight.campaignScope)}</span></div>
<div class="cb-stat"><strong>Estimated cost</strong><span>${esc(preflight.estimatedCostLabel)}</span></div>
<div class="cb-stat"><strong>Local evidence</strong><span>${esc(preflight.localEvidence.status)}</span></div>
<div class="cb-stat"><strong>Editorial evidence</strong><span>${esc(preflight.editorialEvidence.status)}</span></div>
</div>
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
<p style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
<button type="button" class="cb-primary-cta" id="btnGenerateOneLocalPage" ${preflight.canGenerate ? "" : "disabled"}>${esc(GENERATE_ONE_LOCAL_PAGE_CANDIDATE_LABEL)}</button>
<a class="cb-primary-cta ghost" id="oneLocalPreviewLink" href="${esc(preflight.previewUrl)}">Open unpublished Preview</a>
<a class="cb-primary-cta ghost" id="oneLocalReviewLink" href="${esc(preflight.reviewUrl)}">Open Review Centre</a>
</p>
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
  if (!btn) return;
  btn.onclick = async function(){
    btn.disabled = true;
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
      btn.disabled = ${preflight.canGenerate ? "false" : "true"};
    }
  };
})();
</script>`;
}

function renderAreasStep(slug: string): string {
  const session = loadCampaignBuilderSession(slug);
  const areaState = buildCampaignBuilderAreaOptions(slug, session);
  const { candidates, configuredLocalPages, outputs } = areaState;
  const campaign = session.selectedServiceId || "";
  const firstLocal = resolveOneLocalPageCandidateArea(slug);
  const selectedCount = candidates.filter((c) => c.selected).length;
  const canSave = selectedCount === configuredLocalPages && configuredLocalPages > 0;
  const areaRows = candidates.length
    ? candidates
        .map((c) => {
          const grade = String(c.grade || "More evidence needed");
          const gradeClass =
            grade === "High priority"
              ? "high"
              : grade === "Good opportunity"
                ? "good"
                : grade === "Additional area"
                  ? "additional"
                  : "needed";
          return `<label class="cb-setting cb-area-row" data-area="${esc(c.area)}" style="display:block;border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:10px">
<div style="display:flex;gap:10px;align-items:flex-start">
<input type="checkbox" class="area-candidate-check" name="targetAreas" value="${esc(c.area)}" ${c.selected ? "checked" : ""}/>
<div style="flex:1">
<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px">
<strong>${esc(c.area)}</strong>
${firstLocal && c.area === firstLocal.areaName ? `<span class="cb-area-grade high">First local page</span>` : ""}
<span class="cb-area-grade ${gradeClass}">${esc(grade)}</span>
</div>
${c.distanceLabel ? `<p style="margin:0;font-size:13px;color:#64748b">${esc(c.distanceLabel)}</p>` : ""}
</div>
</div>
</label>`;
        })
        .join("")
    : `<p class="cb-empty">No stored areas were found in Your Pharmacy. Add local areas there before building this campaign.</p>`;

  const configJson = JSON.stringify({
    requiredCount: configuredLocalPages,
    outputs,
  }).replace(/</g, "\\u003c");

  return `<div class="cb-panel">
<h2>Recommended target areas</h2>
<p class="cb-lead">PharmaConnect has prioritised ten nearby areas using your confirmed pharmacy and local-market evidence. You can change the selection before continuing.</p>
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
${renderOneLocalPageCandidatePanel(slug, campaign)}
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
  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = 'Generating your campaign…';
  status.style.color = '#005eb8';
  var res = await fetch('/api/growth-engine/${esc(slug)}/campaign-builder/generate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ campaign: ${JSON.stringify(campaign)} })
  });
  var json = await res.json();
  if (json.ok) {
    status.textContent = 'Your campaign is ready. Opening review…';
    status.style.color = '#059669';
    setTimeout(function(){ location.href = json.reviewUrl || '${esc(wizardUrl(slug, "review"))}'; }, 800);
  } else {
    status.textContent = json.error || 'We could not generate your campaign. Please try again.';
    status.style.color = '#991b1b';
    btn.disabled = false;
  }
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

export function renderCampaignBuilderPage(slug: string, step: CampaignBuilderStep): string {
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
      body = renderAreasStep(slug);
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
