/**
 * Review Centre V2 — customer-facing HTML page.
 * Uses the platform dashboard design system (fonts, colours, spacing, cards, buttons).
 */
import { growthEngineWorkflowCss } from "./growthEngineWorkflowNav.ts";
import { premiumCustomerDashboardCss } from "./growthEnginePremiumCustomerDashboardPage.ts";
import type { ReviewCentreAsset, ReviewCentreGroup, ReviewCentreView } from "./growthEngineReviewCentreModel.ts";
import { buildReviewCentreView, SERVICE_PAGE_DEMO_REFERENCE_KEY } from "./growthEngineReviewCentreService.ts";
import { buildReviewCentreSourceDebug } from "./pharmacyContentPackageService.ts";
import {
  publishToStagingControlScript,
  renderPublishToStagingControl,
} from "./pharmacyLockedCampaignStagingPublishControl.ts";
import {
  commercialBlueChromeGradientCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function reviewCentrePageCss(): string {
  return `${growthEngineWorkflowCss()}
${premiumCustomerDashboardCss()}
html,body{overflow-x:hidden}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:linear-gradient(180deg,#f0f7ff 0%,#f0f4f8 40%);color:#0f172a;line-height:1.5;min-height:100vh}
.rc-chrome{background:${commercialBlueChromeGradientCss()};color:#fff;padding:14px 24px}
.rc-chrome p{margin:0;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.85}
.rc-chrome h1{margin:4px 0 0;font-size:16px;font-weight:800}
.rc-hero{background:#fff;border:1px solid #bfdbfe;border-radius:14px;padding:20px 24px;margin-bottom:18px;box-shadow:0 4px 16px rgba(15,23,42,.04)}
.rc-hero-label{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#0369a1;background:#dbeafe;padding:4px 10px;border-radius:999px;display:inline-block;margin-bottom:10px}
.rc-hero-name{font-size:24px;font-weight:900;margin:0 0 8px;color:#0f172a;letter-spacing:-.02em;line-height:1.25}
.rc-hero-meta{font-size:14px;color:#475569;margin:0 0 8px;line-height:1.6}
.rc-count-list{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.rc-count-list li{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;min-width:0}
.rc-count-list span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:4px}
.rc-count-list strong{display:block;font-size:14px;font-weight:800;color:#0f172a;line-height:1.35;overflow-wrap:anywhere}
.rc-stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:18px 0 0}
.rc-stat{background:#f8fafc;border:1px solid #dbeafe;border-radius:14px;padding:14px;text-align:center}
.rc-stat strong{display:block;font-size:28px;font-weight:900;color:#005eb8;line-height:1}
.rc-stat span{display:block;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-top:6px;letter-spacing:.04em}
.rc-next-action{background:#fff;border:1px solid #bfdbfe;border-radius:14px;padding:16px 18px;margin-bottom:20px}
.rc-unmet{border-left:4px solid #b91c1c;background:#fef2f2;padding:16px 18px;border-radius:0 14px 14px 0;margin-bottom:22px}
.rc-unmet h2{margin:0 0 6px;font-size:17px;font-weight:900;color:#991b1b}
.rc-unmet p{margin:0;font-size:14px;color:#7f1d1d;line-height:1.6}
.rc-next-action h2{margin:0 0 6px;font-size:16px;font-weight:900;color:#0f172a}
.rc-next-action p{margin:0;font-size:14px;color:#475569;line-height:1.6}
.rc-group{margin-bottom:24px;min-width:0}
.rc-group-head{margin:0 0 4px;font-size:20px;font-weight:900;color:#0f172a}
.rc-group-note{margin:0 0 14px;font-size:14px;color:#64748b;line-height:1.5}
.rc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.rc-card{display:flex;flex-direction:column;border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.04);min-width:0}
.rc-card.approved{border-color:#bbf7d0;background:#f0fdf4}
.rc-card.needs-improvement{border-color:#fed7aa;background:#fffbeb}
.rc-card-title{font-size:16px;font-weight:800;margin:0 0 8px;color:#0f172a;line-height:1.3;overflow-wrap:anywhere}
.rc-card-summary{font-size:13px;color:#64748b;line-height:1.45;margin:0 0 12px;overflow-wrap:anywhere}
.rc-card-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:12px}
.rc-type{color:#64748b;font-weight:700}
.rc-status{font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:999px;letter-spacing:.03em}
.rc-status.ready{background:#dbeafe;color:#1e40af}
.rc-status.approved{background:#dcfce7;color:#166534}
.rc-status.needs-improvement{background:#fef3c7;color:#92400e}
.rc-improve-msg{font-size:13px;color:#92400e;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin-bottom:12px;line-height:1.5}
.rc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}
.rc-btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 14px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff;cursor:pointer}
.rc-btn-primary,.rc-card .pcd-btn-step{background:#005eb8;border-color:#005eb8;color:#fff}
.rc-btn-ghost{background:#fff;color:#005eb8;border-color:#005eb8}
.rc-btn:disabled,.rc-btn.disabled{opacity:.55;cursor:not-allowed;pointer-events:none}
.rc-regen-wrap{margin-top:14px}
.rc-regen-btn{background:#005eb8;border-color:#005eb8;color:#fff}
.rc-publish-bar{margin-top:28px;padding:22px 24px;background:${commercialBlueChromeGradientCss()};border-radius:16px;color:#fff;text-align:center}
.rc-publish-bar h3{margin:0 0 8px;font-size:18px}
.rc-publish-bar p{margin:0 0 16px;color:#dbeafe;font-size:14px;line-height:1.55}
.rc-publish-bar .rc-btn-primary{background:#fff;color:#005eb8;border-color:#fff}
.rc-publish-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.rc-btn-staging{background:#99f6e4;border-color:#99f6e4;color:#134e4a}
.rc-publish-bar .rc-btn-staging{background:#99f6e4;color:#134e4a;border-color:#99f6e4}
.rc-optional{margin-top:28px;padding:18px 20px;border:1px dashed #cbd5e1;border-radius:16px;background:#f8fafc}
.rc-optional .rc-group-head{color:#64748b}
.rc-optional-note{font-size:13px;color:#64748b;margin:0 0 14px;line-height:1.55}
.rc-card.optional-deferred{border-color:#e2e8f0;background:#f8fafc;box-shadow:none}
.rc-status.optional-deferred{background:#e2e8f0;color:#475569}
.rc-item-list{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-direction:column;gap:8px}
.rc-item-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-width:0}
.rc-item-list span{overflow-wrap:anywhere}
.rc-item-list a{font-weight:800;font-size:12px;flex-shrink:0}
.rc-pending{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;margin:8px 0 22px}
.rc-pending h2{margin:0 0 6px;font-size:20px;font-weight:900;color:#0f172a}
.rc-pending p{margin:0;font-size:14px;color:#475569;line-height:1.6}
.rc-group-pending{font-size:13px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:0 0 12px;line-height:1.5}
.rc-empty{font-size:14px;color:#64748b;padding:20px;background:#fff;border:1px dashed #cbd5e1;border-radius:14px;line-height:1.6}
.rc-sources{margin:0 0 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;min-width:0}
.rc-sources summary{cursor:pointer;font-size:13px;font-weight:800;color:#0f172a;padding:10px 12px;list-style:none}
.rc-sources summary::-webkit-details-marker{display:none}
.rc-sources summary:after{content:"Show";float:right;font-size:12px;font-weight:800;color:#005eb8}
.rc-sources[open] summary:after{content:"Hide"}
.rc-sources-body{padding:0 12px 12px;border-top:1px solid #e2e8f0}
.rc-sources-body p,.rc-sources-body li{font-size:13px;color:#475569;line-height:1.55;overflow-wrap:anywhere}
.rc-sources-body ul{margin:8px 0 0;padding-left:18px}
@media(max-width:960px){
.rc-count-list,.rc-cards{grid-template-columns:1fr}
.rc-chrome{padding:14px 16px}
}
@media(max-width:720px){
.pcd-shell{padding:16px 16px 56px}
.rc-hero{padding:16px}
.rc-hero-name{font-size:22px}
.rc-actions{flex-direction:column;align-items:stretch}
.rc-btn,.rc-card .pcd-btn-step{width:100%;text-align:center}
.rc-item-list li{flex-direction:column;align-items:stretch}
.rc-item-list a{width:100%;text-align:center}
}`;
}

function statusClass(status: ReviewCentreAsset["status"]): string {
  return status.replace(/_/g, "-");
}

function isDemoReference(asset: ReviewCentreAsset): boolean {
  return asset.key === SERVICE_PAGE_DEMO_REFERENCE_KEY;
}

function hasTechnicalIdLeak(text: string): boolean {
  return /(?:^|\s)[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+/.test(text);
}

function renderSources(asset: ReviewCentreAsset): string {
  const findings = (asset.sourceFindings || []).filter((finding) => finding && !hasTechnicalIdLeak(finding));
  const excerpt = asset.copyExcerpt && !hasTechnicalIdLeak(asset.copyExcerpt) ? asset.copyExcerpt : "";
  const checkLabel = asset.validationLabel && !hasTechnicalIdLeak(asset.validationLabel) ? asset.validationLabel : "";
  if (!findings.length && !excerpt && !checkLabel) return "";
  const excerptHtml = excerpt ? `<p><strong>Saved copy</strong> ${esc(excerpt)}</p>` : "";
  const checkHtml = checkLabel ? `<p><strong>Checks</strong> ${esc(checkLabel)}</p>` : "";
  const findingsHtml = findings.length
    ? `<ul data-source-findings="true">${findings.map((finding) => `<li>${esc(finding)}</li>`).join("")}</ul>`
    : "";
  return `<details class="rc-sources">
<summary>Sources and checks</summary>
<div class="rc-sources-body">
${excerptHtml}
${checkHtml}
${findingsHtml}
</div>
</details>`;
}

function renderAssetCard(_slug: string, _campaignId: string, asset: ReviewCentreAsset): string {
  const countSuffix = asset.count > 1 ? ` (${asset.count})` : "";
  const cardClass = asset.optionalDeferred ? "optional-deferred" : statusClass(asset.status);
  const statusClassName = asset.optionalDeferred ? "optional-deferred" : statusClass(asset.status);
  const generatedItems = (asset.items || []).filter((item) => item.generated);
  const showItemPreviews = !asset.candidateOnly;
  const itemList = generatedItems.length
    ? `<ul class="rc-item-list">${generatedItems
        .map(
          (item) =>
            `<li><span>${esc(item.title)}</span>${
              showItemPreviews && item.previewUrl
                ? `<a class="rc-btn rc-btn-ghost" href="${esc(item.previewUrl)}" target="_blank" rel="noopener">Preview</a>`
                : ""
            }</li>`,
        )
        .join("")}</ul>`
    : "";
  const preview = asset.previewUrl
    ? `<a class="rc-btn rc-btn-primary pcd-btn-step" href="${esc(asset.previewUrl)}" target="_blank" rel="noopener">Preview</a>`
    : "";
  let actions = preview;
  if (!asset.optionalDeferred && !asset.candidateOnly) {
    actions +=
      asset.status === "approved"
        ? `<span class="rc-btn rc-btn-ghost disabled">Approved</span>`
        : `<button type="button" class="rc-btn rc-btn-ghost rc-btn-approve" data-asset-key="${esc(asset.key)}">Approve</button>`;
    actions += `<button type="button" class="rc-btn rc-btn-ghost rc-btn-improve" data-asset-key="${esc(asset.key)}">Improve</button>`;
  }
  return `<article class="rc-card pcd-feature ${cardClass}" data-asset-key="${esc(asset.key)}" data-required="${asset.required ? "true" : "false"}" data-candidate-only="${asset.candidateOnly ? "true" : "false"}"${isDemoReference(asset) ? ' data-demo-reference="unpublished-service-page"' : ""}>
<h3 class="rc-card-title">${esc(asset.title)}${countSuffix}</h3>
<p class="rc-card-summary">${esc(asset.summary)}</p>
<div class="rc-card-meta">
<span class="rc-type">${esc(asset.typeLabel)}</span>
<span class="rc-status ${statusClassName}">${esc(asset.statusLabel)}</span>
</div>
${itemList}
${asset.improveMessage ? `<p class="rc-improve-msg">${esc(asset.improveMessage)}</p>` : ""}
${renderSources(asset)}
<div class="rc-actions">
${actions}
</div>
</article>`;
}

function renderGroupSection(
  view: ReviewCentreView,
  group: { id: string; label: string; pendingNote?: string | null; assets: ReviewCentreAsset[] },
  options: { required: boolean; note?: string },
): string {
  if (!group.assets.length) return "";
  return `<section class="rc-group pcd-section" data-group="${esc(group.id)}" data-required="${options.required ? "true" : "false"}"${group.id === "images" ? ' data-image-group-separate="true"' : ""}>
<div class="pcd-section-head">
<h2 class="rc-group-head">${esc(group.label)}</h2>
${options.note ? `<p class="rc-group-note">${esc(options.note)}</p>` : ""}
</div>
${group.pendingNote ? `<p class="rc-group-pending">${esc(group.pendingNote)}</p>` : ""}
<div class="rc-cards">${group.assets.map((a) => renderAssetCard(view.slug, view.campaignId, a)).join("")}</div>
</section>`;
}

function partitionReviewGroups(groups: ReviewCentreGroup[]): {
  campaign: ReviewCentreGroup[];
  localCandidates: ReviewCentreGroup[];
  demoReferences: ReviewCentreGroup[];
} {
  const campaign: ReviewCentreGroup[] = [];
  const localCandidates: ReviewCentreGroup[] = [];
  const demoReferences: ReviewCentreGroup[] = [];
  for (const group of groups) {
    const demoAssets = group.assets.filter(isDemoReference);
    const localAssets = group.assets.filter((asset) => asset.candidateOnly && !isDemoReference(asset));
    const campaignAssets = group.assets.filter((asset) => !asset.candidateOnly);
    if (campaignAssets.length) campaign.push({ ...group, assets: campaignAssets });
    if (localAssets.length) localCandidates.push({ ...group, assets: localAssets });
    if (demoAssets.length) {
      demoReferences.push({
        ...group,
        id: "service-page",
        label: "Demo references",
        assets: demoAssets,
      });
    }
  }
  return { campaign, localCandidates, demoReferences };
}

function plannedContentCopy(view: ReviewCentreView): string {
  const parts = view.pendingGeneration.map((item) =>
    item.names.length && item.typeLabel !== item.names[0]
      ? `${item.typeLabel}: ${item.names.join(", ")}`
      : item.typeLabel,
  );
  if (!parts.length) return "";
  return `These campaign items are planned and have not been generated: ${parts.join("; ")}. They are not ready for review.`;
}

function renderGroups(view: ReviewCentreView): string {
  if (!view.groups.length && !view.optionalGroups.length) {
    return `<div class="rc-empty">Your campaign content will appear here once your campaign has been built.</div>`;
  }
  const { campaign, localCandidates, demoReferences } = partitionReviewGroups(view.groups);
  const localHtml = localCandidates
    .map((group) =>
      renderGroupSection(view, { ...group, label: "Local Pages" }, {
        required: false,
        note: "Reviewable local page candidates. These are not generated campaign pages.",
      }),
    )
    .join("");
  const demoHtml = demoReferences
    .map((group) =>
      renderGroupSection(view, group, {
        required: false,
        note: "Unpublished Service Page reference. This is not a generated Brook campaign asset.",
      }),
    )
    .join("");
  const campaignHtml = campaign
    .map((group) => renderGroupSection(view, group, { required: true }))
    .join("");
  const pendingHtml = view.pendingGeneration.length
    ? `<div class="rc-pending" data-pending-generation="true">
<h2>Planned campaign content</h2>
<p>${esc(plannedContentCopy(view))}</p>
</div>`
    : "";
  const optionalHtml = view.optionalGroups.length
    ? `<section class="rc-optional" data-optional-deferred="true">
<h2 class="rc-group-head">Optional — deferred</h2>
<p class="rc-optional-note">These supporting assets remain stored with their existing status. They are not part of required campaign approval and are not published or approved by campaign lock.</p>
${view.optionalGroups
  .map((group) => renderGroupSection(view, group, { required: false }))
  .join("")}
</section>`
    : "";
  return `${localHtml}${demoHtml}${campaignHtml}${pendingHtml}${optionalHtml}`;
}

function renderCountSummary(view: ReviewCentreView): string {
  const campaignValue = view.generated
    ? `${view.packageContentGenerated} generated for review`
    : view.packageContentSelected
      ? `None generated yet (${view.packageContentSelected} planned)`
      : "None generated yet";
  const localValue =
    view.localCandidateCount === 1
      ? "1 reviewable candidate"
      : `${view.localCandidateCount} reviewable candidates`;
  const demoValue =
    view.demoReferenceCount === 1
      ? "1 unpublished reference"
      : `${view.demoReferenceCount} unpublished references`;
  return `<ul class="rc-count-list" data-count-split="true" data-content-asset-selected="${view.packageContentSelected}" data-content-asset-generated="${view.packageContentGenerated}" data-campaign-asset-count="${view.campaignAssetCount}" data-local-candidate-count="${view.localCandidateCount}" data-demo-reference-count="${view.demoReferenceCount}">
<li data-count="campaign-assets"><span>Campaign pages</span><strong>${esc(campaignValue)}</strong></li>
<li data-count="local-candidates"><span>Local pages to review</span><strong>${esc(localValue)}</strong></li>
<li data-count="demo-references"><span>Demo references</span><strong>${esc(demoValue)}</strong></li>
</ul>`;
}

function renderStatusCopy(view: ReviewCentreView): string {
  if (view.generated) {
    return `${view.packageContentGenerated} of ${view.packageContentSelected} campaign content items are ready for review. Images are reviewed separately.`;
  }
  if (view.packageContentSelected > 0) {
    return "Campaign pages have not been generated yet. Planned Campaign Builder items are listed below and are not ready for review.";
  }
  return "No campaign pages have been generated yet.";
}

function renderPublishBar(view: ReviewCentreView): string {
  const lockedDetail = view.canPublish
    ? "Required campaign pages are approved. Optional supporting assets stay deferred."
    : "Publish stays locked until every required section is approved.";
  const stagingButton = renderPublishToStagingControl({
    tenantSlug: view.slug,
    campaignId: view.campaignId,
    apiPath: view.stagingPublishApiPath,
    enabled: view.canPublishToStaging,
    className: "rc-btn rc-btn-staging",
  });
  return `<div class="rc-publish-bar">
<h3>${view.canPublish ? "Ready to go live" : "Publish is locked"}</h3>
<p>${esc(lockedDetail)}</p>
<div class="rc-publish-actions">
${stagingButton}
${view.canPublish
  ? `<a class="rc-btn rc-btn-primary" href="${esc(view.publishUrl)}">Publish campaign</a>`
  : `<span class="rc-btn rc-btn-primary disabled">Publish campaign</span>`}
</div>
</div>`;
}

export function renderReviewCentrePage(
  slug: string,
  campaignParam: string | null | undefined,
  options: { unmetCondition?: string } = {},
): string {
  const view = buildReviewCentreView(slug, campaignParam);
  if (!view) {
    return withCommercialBlueUiBaseline(`<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><title>Review Centre</title>
<style>${reviewCentrePageCss()}</style></head>
<body><main class="pcd-shell"><div class="pcd-header"><div class="pcd-welcome"><h1>Review Centre</h1><p>Choose a campaign to review your content.</p></div></div></main></body></html>`);
  }

  const approveUrl = `/api/growth-engine/${esc(slug)}/review-centre/approve`;
  const improveUrl = `/api/growth-engine/${esc(slug)}/review-centre/improve`;
  const pageUrl = `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(view.campaignId)}`;
  const sourceDebug = buildReviewCentreSourceDebug(slug, view.campaignId);
  const showApprovalStats = view.generated && (view.readyCount > 0 || view.approvedCount > 0 || view.needsImprovementCount > 0);

  return withCommercialBlueUiBaseline(`<!DOCTYPE html>
<!-- review-source tenant=${esc(sourceDebug.slug)} campaign=${esc(sourceDebug.campaignId)} -->
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Review Centre — ${esc(view.campaignName)}</title>
<style>${reviewCentrePageCss()}</style></head>
<body>
<header class="rc-chrome">
<p>PharmaConnect</p>
<h1>Your Pharmacy Growth Programme</h1>
</header>
<main class="pcd-shell">
<section class="pcd-header" aria-label="Review Centre">
<div class="pcd-welcome">
<h1>Review Centre</h1>
<p>Review your campaign content before anything goes live.</p>
</div>
</section>

<section class="rc-hero" aria-label="Campaign status">
<div class="rc-hero-label">Your campaign</div>
<h2 class="rc-hero-name">${esc(view.campaignName)}</h2>
<p class="rc-hero-meta">${esc(renderStatusCopy(view))}</p>
${renderCountSummary(view)}
${showApprovalStats ? `<div class="rc-stat-row">
<div class="rc-stat"><strong>${view.readyCount}</strong><span>To review</span></div>
<div class="rc-stat"><strong>${view.approvedCount}</strong><span>Approved</span></div>
<div class="rc-stat"><strong>${view.needsImprovementCount}</strong><span>Needs improvement</span></div>
</div>` : ""}
</section>

<section class="rc-next-action pcd-task" aria-label="Next action">
<div class="pcd-task-text">
<span class="pcd-task-badge">Next action</span>
<h2>${esc(view.nextAction.title)}</h2>
<p>${esc(view.nextAction.detail)}</p>
</div>
${view.regenerateImprovementsVisible ? `<div class="rc-regen-wrap"><button type="button" class="rc-btn rc-regen-btn" id="rcRegenerateImprovements" data-api="${esc(view.regenerateImprovementsApiPath)}" data-tenant="${esc(view.slug)}" data-intent="${esc(view.regenerateImprovementsIntent)}">Regenerate Improvements</button></div>` : ""}
</section>

${options.unmetCondition ? `<div class="rc-unmet" role="alert"><h2>Campaign could not be approved-locked</h2><p>${esc(options.unmetCondition)}</p></div>` : ""}

${view.generated || view.hasLocalPageCandidate || view.groups.length ? renderGroups(view) : `<div class="rc-empty">Your campaign content will appear here once your campaign has been built. <a href="/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=approval">Build your campaign</a></div>`}

${view.generated ? renderPublishBar(view) : ""}

<div id="rcStatus" style="display:none;margin-top:16px;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700"></div>
</main>
<script>
var SLUG = ${JSON.stringify(slug)};
var CAMPAIGN = ${JSON.stringify(view.campaignId)};
var PAGE_URL = ${JSON.stringify(pageUrl)};
function withAuthToken(href) {
  if (!href) return href;
  var token = new URLSearchParams(window.location.search).get('_t');
  if (!token) return href;
  try {
    var url = new URL(href, window.location.origin);
    if (!url.searchParams.get('_t')) url.searchParams.set('_t', token);
    return url.pathname + url.search + url.hash;
  } catch (err) {
    return href;
  }
}
document.querySelectorAll('.rc-actions a[href], .rc-item-list a[href]').forEach(function(link) {
  link.setAttribute('href', withAuthToken(link.getAttribute('href') || ''));
});
function showStatus(msg, ok) {
  var el = document.getElementById('rcStatus');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
  el.style.background = ok ? '#ecfdf5' : '#fef2f2';
  el.style.color = ok ? '#065f46' : '#991b1b';
}
async function postAction(url, assetKey) {
  var res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ campaignId: CAMPAIGN, assetKey: assetKey })
  });
  return res.json();
}
document.querySelectorAll('.rc-btn-approve').forEach(function(btn) {
  btn.onclick = async function() {
    btn.disabled = true;
    var json = await postAction(${JSON.stringify(approveUrl)}, btn.getAttribute('data-asset-key'));
    if (json.ok) {
      showStatus('Section approved.', true);
      setTimeout(function(){ location.href = PAGE_URL; }, 500);
    } else {
      showStatus(json.error || 'Could not approve this section.', false);
      btn.disabled = false;
    }
  };
});
document.querySelectorAll('.rc-btn-improve').forEach(function(btn) {
  btn.onclick = async function() {
    btn.disabled = true;
    var json = await postAction(${JSON.stringify(improveUrl)}, btn.getAttribute('data-asset-key'));
    if (json.ok) {
      showStatus(json.message || "We'll improve this before publishing.", true);
      setTimeout(function(){ location.href = PAGE_URL; }, 700);
    } else {
      showStatus(json.error || 'Could not save your feedback.', false);
      btn.disabled = false;
    }
  };
});
(function(){
  var regen = document.getElementById('rcRegenerateImprovements');
  if (!regen) return;
  regen.onclick = async function() {
    regen.disabled = true;
    showStatus('Regenerating flagged locality pages…', true);
    try {
      var res = await fetch(regen.getAttribute('data-api'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          tenantSlug: regen.getAttribute('data-tenant'),
          intent: regen.getAttribute('data-intent')
        })
      });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not regenerate improvements.');
      var count = json.localCount || 0;
      showStatus('New run ready for review: ' + count + ' locality pages.', true);
      setTimeout(function(){ location.href = PAGE_URL; }, 900);
    } catch (err) {
      showStatus(err.message || 'Could not regenerate improvements.', false);
      regen.disabled = false;
    }
  };
})();
${publishToStagingControlScript()}
</script>
</body></html>`);
}
