/**
 * Review Centre V2 — customer-facing HTML page.
 */
import { growthEngineWorkflowCss } from "./growthEngineWorkflowNav.ts";
import type { ReviewCentreAsset, ReviewCentreView } from "./growthEngineReviewCentreModel.ts";
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
.rc-hero{border:2px solid #005eb8;border-radius:20px;padding:24px 26px;background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);margin-bottom:22px;box-shadow:0 10px 30px rgba(15,23,42,.06)}
.rc-hero-label{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#005eb8;margin-bottom:10px}
.rc-hero-name{font-size:26px;font-weight:900;margin:0 0 10px;color:#0f172a;line-height:1.2}
.rc-hero-meta{font-size:14px;color:#475569;margin:0;line-height:1.6}
.rc-stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:18px 0 0}
.rc-stat{background:#fff;border:1px solid #dbeafe;border-radius:14px;padding:14px;text-align:center}
.rc-stat strong{display:block;font-size:28px;font-weight:900;color:#005eb8;line-height:1}
.rc-stat span{display:block;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-top:6px;letter-spacing:.04em}
.rc-next-action{border-left:4px solid #005eb8;background:#eff6ff;padding:16px 18px;border-radius:0 14px 14px 0;margin-bottom:22px}
.rc-unmet{border-left:4px solid #b91c1c;background:#fef2f2;padding:16px 18px;border-radius:0 14px 14px 0;margin-bottom:22px}
.rc-unmet h2{margin:0 0 6px;font-size:17px;font-weight:900;color:#991b1b}
.rc-unmet p{margin:0;font-size:14px;color:#7f1d1d;line-height:1.6}
.rc-next-action h2{margin:0 0 6px;font-size:17px;font-weight:900;color:#0f172a}
.rc-next-action p{margin:0;font-size:14px;color:#475569;line-height:1.6}
.rc-group{margin-bottom:24px}
.rc-group-head{margin:0 0 12px;font-size:16px;font-weight:900;color:#0f172a;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.rc-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.rc-card{border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.04)}
.rc-card.approved{border-color:#bbf7d0;background:#f0fdf4}
.rc-card.needs-improvement{border-color:#fed7aa;background:#fffbeb}
.rc-card-title{font-size:16px;font-weight:900;margin:0 0 6px;color:#0f172a}
.rc-card-summary{font-size:13px;color:#475569;line-height:1.5;margin:0 0 12px}
.rc-card-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:12px}
.rc-type{color:#64748b;font-weight:700}
.rc-status{font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:999px}
.rc-status.ready{background:#dbeafe;color:#1e40af}
.rc-status.approved{background:#bbf7d0;color:#065f46}
.rc-status.needs-improvement{background:#fef3c7;color:#92400e}
.rc-improve-msg{font-size:13px;color:#92400e;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin-bottom:12px;line-height:1.5}
.rc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.rc-btn{display:inline-flex;align-items:center;padding:9px 14px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff;cursor:pointer}
.rc-btn-primary{background:#005eb8;border-color:#005eb8;color:#fff}
.rc-btn-ghost{background:#f1f5f9}
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
.rc-optional .rc-group-head{color:#64748b;border-bottom-color:#e2e8f0}
.rc-optional-note{font-size:13px;color:#64748b;margin:0 0 14px;line-height:1.55}
.rc-card.optional-deferred{border-color:#e2e8f0;background:#f8fafc;box-shadow:none}
.rc-status.optional-deferred{background:#e2e8f0;color:#475569}
.rc-item-list{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-direction:column;gap:8px}
.rc-item-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px}
.rc-item-list a{font-weight:800;font-size:12px}
.rc-pending{border-left:4px solid #b45309;background:#fffbeb;padding:16px 18px;border-radius:0 14px 14px 0;margin-bottom:22px}
.rc-pending h2{margin:0 0 6px;font-size:17px;font-weight:900;color:#92400e}
.rc-pending p{margin:0;font-size:14px;color:#78350f;line-height:1.6}
.rc-group-pending{font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin:0 0 12px;line-height:1.5}
.rc-empty{font-size:14px;color:#64748b;padding:20px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;line-height:1.6}`;
}

function statusClass(status: ReviewCentreAsset["status"]): string {
  return status.replace(/_/g, "-");
}

function renderAssetCard(_slug: string, _campaignId: string, asset: ReviewCentreAsset): string {
  const countSuffix = asset.count > 1 ? ` (${asset.count})` : "";
  const cardClass = asset.optionalDeferred ? "optional-deferred" : statusClass(asset.status);
  const statusClassName = asset.optionalDeferred ? "optional-deferred" : statusClass(asset.status);
  const generatedItems = (asset.items || []).filter((item) => item.generated);
  const itemList = generatedItems.length
    ? `<ul class="rc-item-list">${generatedItems
        .map(
          (item) =>
            `<li><span>${esc(item.title)}</span>${
              item.previewUrl
                ? `<a class="rc-btn rc-btn-ghost" href="${esc(item.previewUrl)}" target="_blank" rel="noopener">Preview</a>`
                : ""
            }</li>`,
        )
        .join("")}</ul>`
    : "";
  const preview = asset.previewUrl
    ? `<a class="rc-btn rc-btn-ghost" href="${esc(asset.previewUrl)}" target="_blank" rel="noopener">Preview</a>`
    : "";
  let actions = preview;
  if (!asset.optionalDeferred && !asset.candidateOnly) {
    actions +=
      asset.status === "approved"
        ? `<span class="rc-btn rc-btn-ghost disabled">Approved</span>`
        : `<button type="button" class="rc-btn rc-btn-primary rc-btn-approve" data-asset-key="${esc(asset.key)}">Approve</button>`;
    actions += `<button type="button" class="rc-btn rc-btn-ghost rc-btn-improve" data-asset-key="${esc(asset.key)}">Improve</button>`;
  }
  return `<article class="rc-card ${cardClass}" data-asset-key="${esc(asset.key)}" data-required="${asset.required ? "true" : "false"}" data-candidate-only="${asset.candidateOnly ? "true" : "false"}"${asset.key === SERVICE_PAGE_DEMO_REFERENCE_KEY ? ' data-demo-reference="unpublished-service-page"' : ""}>
<h3 class="rc-card-title">${esc(asset.title)}${countSuffix}</h3>
<p class="rc-card-summary">${esc(asset.summary)}</p>
<div class="rc-card-meta">
<span class="rc-type">${esc(asset.typeLabel)}</span>
<span class="rc-status ${statusClassName}">${esc(asset.statusLabel)}</span>
</div>
${itemList}
${asset.improveMessage ? `<p class="rc-improve-msg">${esc(asset.improveMessage)}</p>` : ""}
${asset.validationLabel ? `<p class="rc-card-summary" data-validation-status="${esc(asset.validationLabel)}"><strong>Validation:</strong> ${esc(asset.validationLabel)}</p>` : ""}
${asset.copyExcerpt ? `<p class="rc-card-summary" data-copy-excerpt="true"><strong>Copy:</strong> ${esc(asset.copyExcerpt)}</p>` : ""}
${asset.sourceFindings?.length ? `<ul class="rc-item-list" data-source-findings="true">${asset.sourceFindings.map((finding) => `<li><span>${esc(finding)}</span></li>`).join("")}</ul>` : ""}
<div class="rc-actions">
${actions}
</div>
</article>`;
}

function renderGroups(view: ReviewCentreView): string {
  if (!view.groups.length && !view.optionalGroups.length) {
    return `<div class="rc-empty">Your campaign content will appear here once your campaign has been built.</div>`;
  }
  const pendingHtml = view.pendingGeneration.length
    ? `<div class="rc-pending" data-pending-generation="true">
<h2>Still need to be created</h2>
<p>${esc(
        view.pendingGeneration
          .map((item) =>
            item.names.length ? `${item.typeLabel}: ${item.names.join(", ")}` : item.typeLabel,
          )
          .join(". "),
      )}.</p>
</div>`
    : "";
  const requiredHtml = view.groups
    .map(
      (group) => `<section class="rc-group" data-group="${esc(group.id)}" data-required="true"${group.id === "images" ? ' data-image-group-separate="true"' : ""}>
<h2 class="rc-group-head">${esc(group.label)}</h2>
${group.pendingNote ? `<p class="rc-group-pending">${esc(group.pendingNote)}</p>` : ""}
<div class="rc-cards">${group.assets.map((a) => renderAssetCard(view.slug, view.campaignId, a)).join("")}</div>
</section>`,
    )
    .join("");
  const optionalHtml = view.optionalGroups.length
    ? `<section class="rc-optional" data-optional-deferred="true">
<h2 class="rc-group-head">Optional — deferred</h2>
<p class="rc-optional-note">These supporting assets remain stored with their existing status. They are not part of required campaign approval and are not published or approved by campaign lock.</p>
${view.optionalGroups
  .map(
    (group) => `<section class="rc-group" data-group="${esc(group.id)}" data-required="false">
<h2 class="rc-group-head">${esc(group.label)}</h2>
<div class="rc-cards">${group.assets.map((a) => renderAssetCard(view.slug, view.campaignId, a)).join("")}</div>
</section>`,
  )
  .join("")}
</section>`
    : "";
  return `${pendingHtml}${requiredHtml}${optionalHtml}`;
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
<body><main class="ge-shell"><div class="ge-panel"><h2>Review Centre</h2><p class="ge-lead">Choose a campaign to review your content.</p></div></main></body></html>`);
  }

  const approveUrl = `/api/growth-engine/${esc(slug)}/review-centre/approve`;
  const improveUrl = `/api/growth-engine/${esc(slug)}/review-centre/improve`;
  const pageUrl = `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(view.campaignId)}`;
  const sourceDebug = buildReviewCentreSourceDebug(slug, view.campaignId);

  return withCommercialBlueUiBaseline(`<!DOCTYPE html>
<!-- review-source tenant=${esc(sourceDebug.slug)} campaign=${esc(sourceDebug.campaignId)} -->
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Review Centre — ${esc(view.campaignName)}</title>
<style>${reviewCentrePageCss()}</style></head>
<body>
<main class="ge-shell">
<div class="ge-header-band">
<h1>Review Centre</h1>
<p>Review your campaign content before anything goes live.</p>
</div>

<div class="rc-hero">
<div class="rc-hero-label">Your campaign</div>
<h2 class="rc-hero-name">${esc(view.campaignName)}</h2>
<p class="rc-hero-meta">${view.requiredGroupCount} required groups for campaign approval.</p>
<p class="rc-hero-meta" data-content-asset-selected="${view.packageContentSelected}" data-content-asset-generated="${view.packageContentGenerated}">${view.packageContentGenerated} of ${view.packageContentSelected} campaign content items are ready for review. Images are reviewed separately.</p>
<div class="rc-stat-row">
<div class="rc-stat"><strong>${view.readyCount}</strong><span>To review</span></div>
<div class="rc-stat"><strong>${view.approvedCount}</strong><span>Approved</span></div>
<div class="rc-stat"><strong>${view.needsImprovementCount}</strong><span>Needs improvement</span></div>
</div>
</div>

<div class="rc-next-action">
<h2>${esc(view.nextAction.title)}</h2>
<p>${esc(view.nextAction.detail)}</p>
${view.regenerateImprovementsVisible ? `<div class="rc-regen-wrap"><button type="button" class="rc-btn rc-regen-btn" id="rcRegenerateImprovements" data-api="${esc(view.regenerateImprovementsApiPath)}" data-tenant="${esc(view.slug)}" data-intent="${esc(view.regenerateImprovementsIntent)}">Regenerate Improvements</button></div>` : ""}
</div>

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
