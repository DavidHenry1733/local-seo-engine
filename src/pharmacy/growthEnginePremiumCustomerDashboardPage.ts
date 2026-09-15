/**
 * Premium Customer Dashboard — commercial product journey presentation.
 */
import {
  buildPremiumCustomerDashboardView,
  type CommercialFeatureCard,
  type PremiumCustomerDashboardView,
  type PremiumReportPreview,
} from "./growthEnginePremiumCustomerDashboard.ts";
import {
  campaignApproveControlScript,
  renderCampaignApproveControl,
} from "./growthEngineCampaignApproveControl.ts";
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function statusClass(status: string): string {
  return String(status || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function premiumCustomerDashboardCss(): string {
  return `${commercialBlueUiBaselineCss()}
.pcd-shell{max-width:1120px;margin:0 auto;padding:20px 20px 56px}
.pcd-header{background:${commercialBlueChromeGradientCss()};border-radius:16px;padding:20px 24px;color:#fff;margin-bottom:18px;box-shadow:0 10px 28px rgba(0,94,184,.16)}
.pcd-welcome h1{margin:0 0 6px;font-size:24px;font-weight:900;letter-spacing:-.02em;line-height:1.25}
.pcd-welcome p{margin:0;font-size:14px;color:#dbeafe;line-height:1.45;max-width:720px}
.pcd-hero-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0 14px}
.pcd-metric{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:10px 12px}
.pcd-metric strong{display:block;font-size:13px;font-weight:800;line-height:1.35;color:#fff}
.pcd-hero-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.pcd-cta-main{display:inline-flex;align-items:center;justify-content:center;padding:11px 18px;border-radius:10px;background:#fff;color:#005eb8;font-weight:900;font-size:14px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.12)}
.pcd-cta-main:hover{transform:translateY(-1px)}
.pcd-cta-secondary{display:inline-flex;align-items:center;justify-content:center;padding:11px 18px;border-radius:10px;background:transparent;color:#fff;font-weight:800;font-size:14px;text-decoration:none;border:1px solid rgba(255,255,255,.55)}
.pcd-section{margin-bottom:24px}
.pcd-section-head{margin-bottom:14px}
.pcd-section-head h2{margin:0 0 4px;font-size:20px;font-weight:900;color:#0f172a}
.pcd-section-head p{margin:0;font-size:14px;color:#64748b}
.pcd-task{background:#fff;border:1px solid #bfdbfe;border-radius:14px;padding:16px 18px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.pcd-task-text strong{display:block;font-size:16px;font-weight:900;color:#0f172a;margin-bottom:4px}
.pcd-task-text span{font-size:14px;color:#475569}
.pcd-task-badge{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#0369a1;background:#dbeafe;padding:4px 10px;border-radius:999px;margin-bottom:8px;display:inline-block}
.pcd-optional{margin:8px 0 0;font-size:12px;color:#64748b}
.pcd-features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:stretch}
.pcd-feature{display:flex;flex-direction:column;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 4px 16px rgba(15,23,42,.04);min-height:100%}
.pcd-feature-num{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.pcd-feature h3{margin:0 0 8px;font-size:16px;font-weight:800;color:#0f172a;line-height:1.3}
.pcd-feature p{margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.45}
.pcd-badge{display:inline-flex;align-self:flex-start;font-size:10px;font-weight:800;padding:4px 10px;border-radius:999px;letter-spacing:.03em;margin-bottom:12px}
.pcd-badge.ready,.pcd-badge.in-progress{background:#dbeafe;color:#1e40af}
.pcd-badge.complete,.pcd-badge.approved{background:#dcfce7;color:#166534}
.pcd-badge.staging-ready{background:#e0f2fe;color:#075985}
.pcd-badge.not-configured,.pcd-badge.not-tested{background:#f1f5f9;color:#475569}
.pcd-badge.action-required,.pcd-badge.needs-confirmation{background:#fef3c7;color:#92400e}
.pcd-feature-action{margin-top:auto}
.pcd-btn-step{display:inline-flex;padding:9px 14px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #005eb8;background:#005eb8;color:#fff}
.pcd-btn-disabled{background:#e2e8f0;border-color:#cbd5e1;color:#64748b;cursor:not-allowed}
.pcd-reports{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.pcd-report{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;box-shadow:0 6px 20px rgba(15,23,42,.05);display:flex;flex-direction:column;gap:12px}
.pcd-report h3{margin:0;font-size:16px;font-weight:900;color:#0f172a}
.pcd-report-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pcd-report-stat{background:#f8fafc;border-radius:10px;padding:10px 12px}
.pcd-report-stat span{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:.04em;margin-bottom:4px}
.pcd-report-stat strong{display:block;font-size:14px;font-weight:800;color:#0f172a;line-height:1.3}
.pcd-report-insight{border-top:1px solid #f1f5f9;padding-top:10px}
.pcd-report-insight span{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-bottom:6px}
.pcd-report-insight p{margin:0;font-size:13px;color:#475569;line-height:1.5}
.pcd-report-link{font-size:13px;font-weight:800;color:#005eb8;text-decoration:none;margin-top:auto}
.pcd-campaigns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.pcd-campaign{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;box-shadow:0 6px 20px rgba(15,23,42,.05)}
.pcd-campaign h3{margin:0 0 8px;font-size:17px;font-weight:900}
.pcd-campaign-status{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:4px 10px;border-radius:999px;background:#dcfce7;color:#166534;margin-bottom:10px}
.pcd-campaign-status.pending{background:#fef3c7;color:#92400e}
.pcd-campaign dl{margin:0 0 12px;display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13px}
.pcd-campaign dt{color:#64748b;font-weight:700}
.pcd-campaign dd{margin:0;color:#0f172a;font-weight:700}
.pcd-campaign-actions{display:flex;flex-wrap:wrap;gap:8px}
.pcd-campaign-actions a,.pcd-campaign-actions button,.pcd-btn-generate{display:inline-flex;padding:10px 14px;border-radius:10px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #005eb8;background:#005eb8;color:#fff;cursor:pointer}
.pcd-campaign-actions a.secondary,.pcd-campaign-actions button.secondary{background:#fff;color:#005eb8}
.pcd-approve-msg{background:#ecfdf5;border:1px solid #bbf7d0;color:#065f46;border-radius:12px;padding:12px 16px;margin:0 0 16px;font-size:14px;font-weight:700}
.pcd-next{border-color:#93c5fd;background:linear-gradient(180deg,#eff6ff,#fff)}
.pcd-generate-msg{margin:10px 0 0;font-size:13px;color:#64748b}
.pcd-footer{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8}
@media(max-width:960px){
.pcd-hero-metrics{grid-template-columns:1fr 1fr}
.pcd-features,.pcd-reports,.pcd-campaigns{grid-template-columns:1fr}
}
@media(max-width:720px){
.pcd-header{padding:16px}
.pcd-welcome h1{font-size:22px}
.pcd-hero-metrics{grid-template-columns:1fr}
.pcd-hero-actions{flex-direction:column;align-items:stretch}
.pcd-cta-main,.pcd-cta-secondary{width:100%;text-align:center}
}
`;
}

function renderFeatureCard(card: CommercialFeatureCard): string {
  const cls = statusClass(card.status);
  const action = card.actionEnabled
    ? `<a class="pcd-btn-step" href="${esc(card.href)}">${esc(card.actionLabel)}</a>`
    : `<button type="button" class="pcd-btn-step pcd-btn-disabled" disabled aria-disabled="true">${esc(card.actionLabel)}</button>`;
  return `<article class="pcd-feature" data-feature-id="${esc(card.id)}" data-feature-status="${esc(card.status)}" data-feature-enabled="${card.actionEnabled ? "true" : "false"}" data-feature-href="${esc(card.href)}">
<div class="pcd-feature-num">Step ${card.number}</div>
<h3>${esc(card.title)}</h3>
<p>${esc(card.benefit)}</p>
<span class="pcd-badge ${esc(cls)}">${esc(card.status)}</span>
<div class="pcd-feature-action">${action}</div>
</article>`;
}

function renderCampaignCard(
  card: PremiumCustomerDashboardView["campaignProgramme"]["campaigns"][number],
  slug: string,
): string {
  const pending = card.pendingProductOwnerReview ? " pending" : "";
  const actions = card.controls
    .map((c, i) => {
      if (c.action === "approve") {
        return renderCampaignApproveControl({
          tenantSlug: slug,
          campaignId: card.serviceId,
          apiPath: card.approveApiPath,
          className: i === 0 ? "" : "secondary",
        });
      }
      return `<a class="${i === 0 ? "" : "secondary"}" href="${esc(c.href || "#")}">${esc(c.label)}</a>`;
    })
    .join("");
  return `<article class="pcd-campaign" data-service-id="${esc(card.serviceId)}" data-campaign-status="${esc(card.status)}">
<h3>${esc(card.serviceName)}</h3>
<span class="pcd-campaign-status${pending}">${esc(card.statusLabel)}</span>
<dl>
<dt>Core pages</dt><dd>${card.servicePageCount} service page + ${card.localityPageCount} locality pages</dd>
</dl>
<div class="pcd-campaign-actions">${actions}</div>
</article>`;
}

function renderCampaignProgramme(view: PremiumCustomerDashboardView): string {
  const programme = view.campaignProgramme;
  const next = programme.nextCampaign;
  const nextHtml = next
    ? `<article class="pcd-campaign pcd-next" data-next-campaign="${esc(next.serviceId)}">
<h3>Next campaign: ${esc(next.serviceName)}</h3>
<span class="pcd-campaign-status pending">${esc(next.statusLabel)}</span>
<dl>
<dt>Selection</dt><dd>${esc(next.reason)}</dd>
</dl>
<button type="button" class="pcd-btn-generate" id="pcdGenerateNext" data-api="${esc(programme.generateNextApiPath)}" data-tenant="${esc(programme.slug)}" data-intent="${esc(programme.generateNextIntent)}">Generate Next Campaign</button>
<p class="pcd-generate-msg" id="pcdGenerateNextMsg">Uses your approved campaign settings only.</p>
</article>`
    : programme.exhausted
      ? `<article class="pcd-campaign"><h3>Campaign queue</h3><p class="pcd-generate-msg">${esc(programme.exhaustedMessage || "No next approved registered-service campaign is available")}</p></article>`
      : "";
  return `<section class="pcd-section" aria-label="Campaign programme">
<div class="pcd-section-head">
<h2>Campaign programme</h2>
<p>Live status from approved campaigns, Review Centre, and generated core-page inventory.</p>
</div>
<div class="pcd-campaigns">${programme.campaigns.map((card) => renderCampaignCard(card, view.slug)).join("")}${nextHtml}</div>
</section>
${campaignApproveControlScript()}
<script>
(function(){
  const btn=document.getElementById('pcdGenerateNext');
  if(!btn)return;
  btn.addEventListener('click', async function(){
    const msg=document.getElementById('pcdGenerateNextMsg');
    const api=btn.getAttribute('data-api');
    const tenantSlug=btn.getAttribute('data-tenant');
    const intent=btn.getAttribute('data-intent');
    if(!api||!tenantSlug||!intent)return;
    btn.disabled=true;
    if(msg)msg.textContent='Starting campaign generation…';
    try{
      const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:tenantSlug,intent:intent})});
      const json=await res.json();
      if(!json.ok) throw new Error(json.error||'Generation failed');
      location.reload();
    }catch(e){
      btn.disabled=false;
      if(msg)msg.textContent=e.message||String(e);
    }
  });
})();
</script>`;
}

function renderReportCard(report: PremiumReportPreview): string {
  const extra = report.extraLabel && report.extraValue
    ? `<div class="pcd-report-insight">
<span>${esc(report.extraLabel)}</span>
<p>${esc(report.extraValue)}</p>
</div>`
    : "";
  return `<article class="pcd-report" data-report-id="${esc(report.id)}">
<h3>${esc(report.title)}</h3>
<div class="pcd-report-stats">
<div class="pcd-report-stat"><span>${esc(report.stat1Label)}</span><strong>${esc(report.stat1Value)}</strong></div>
<div class="pcd-report-stat"><span>${esc(report.stat2Label)}</span><strong>${esc(report.stat2Value)}</strong></div>
</div>
<div class="pcd-report-insight">
<span>${esc(report.insightLabel)}</span>
<p>${esc(report.insight)}</p>
</div>
${extra}
<a class="pcd-report-link" href="${esc(report.href)}">Open report →</a>
</article>`;
}

function renderBody(view: PremiumCustomerDashboardView, approvedCampaignId?: string): string {
  const approvedCard = approvedCampaignId
    ? view.campaignProgramme.campaigns.find((c) => c.serviceId === approvedCampaignId)
    : null;
  const successHtml =
    approvedCampaignId && approvedCard
      ? `<p class="pcd-approve-msg" role="status">${esc(approvedCard.serviceName)} is now approved-locked.</p>`
      : approvedCampaignId
        ? `<p class="pcd-approve-msg" role="status">Campaign is now approved-locked.</p>`
        : "";
  const optional = view.optionalRecommendation
    ? `<p class="pcd-optional">${esc(view.optionalRecommendation)}</p>`
    : "";
  return `<div class="pcd-shell">
<section class="pcd-header" aria-label="Welcome">
<div class="pcd-welcome">
<h1>Welcome back, ${esc(view.pharmacyName)}</h1>
<p>${esc(view.heroSupportingText)}</p>
</div>
<div class="pcd-hero-metrics" aria-label="Programme summary">
${view.heroMetrics.map((m) => `<div class="pcd-metric"><strong>${esc(m.value)}</strong></div>`).join("")}
</div>
<div class="pcd-hero-actions">
<a class="pcd-cta-main" href="${esc(view.primaryCtaHref)}">${esc(view.primaryCtaLabel)}</a>
<a class="pcd-cta-secondary" href="${esc(view.secondaryCtaHref)}">${esc(view.secondaryCtaLabel)}</a>
</div>
</section>

${successHtml}
<section class="pcd-task" aria-label="Next action">
<div class="pcd-task-text">
<span class="pcd-task-badge">Next action</span>
<strong>${esc(view.nextActionTitle)}</strong>
<span>${esc(view.nextActionDetail)}</span>
${optional}
</div>
<a class="pcd-cta-main" href="${esc(view.nextActionCtaHref)}">${esc(view.nextActionCtaLabel)}</a>
</section>

<section class="pcd-section" id="programme-journey" aria-label="Complete feature journey">
<div class="pcd-section-head">
<h2>Your PharmaConnect programme</h2>
<p>Every customer-facing feature, with live status and a direct action.</p>
</div>
<div class="pcd-features">${view.featureJourney.map(renderFeatureCard).join("")}</div>
</section>

${renderCampaignProgramme(view)}

<section class="pcd-section" aria-label="Report previews">
<div class="pcd-section-head">
<h2>Your reports at a glance</h2>
<p>Key insights from your local market, website, and growth plan.</p>
</div>
<div class="pcd-reports">${view.reportPreviews.map(renderReportCard).join("")}</div>
</section>

<footer class="pcd-footer">PharmaConnect · Guided pharmacy growth</footer>
</div>`;
}

export function renderPremiumCustomerDashboardPage(
  slug: string,
  options: { approvedCampaignId?: string } = {},
): string {
  const view = buildPremiumCustomerDashboardView(slug);

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Dashboard · ${esc(view.pharmacyName)}</title>
<style>
*{box-sizing:border-box}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:linear-gradient(180deg,#f0f7ff 0%,#f0f4f8 40%);color:#0f172a;line-height:1.5;min-height:100vh}
${premiumCustomerDashboardCss()}
</style>
</head>
<body data-slug="${esc(slug)}" data-dashboard="premium-customer-v1" data-commercial-dashboard="44">
<header style="background:${commercialBlueChromeGradientCss()};color:#fff;padding:14px 24px">
<p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.85">PharmaConnect</p>
<h1 style="margin:4px 0 0;font-size:16px;font-weight:800">Your Pharmacy Growth Programme</h1>
</header>
${renderBody(view, options.approvedCampaignId)}
<script>
(function(){
  function withAuthToken(href) {
    if (!href || href.charAt(0) === '#') return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    try {
      var url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return href;
      if (!url.searchParams.get('_t')) url.searchParams.set('_t', token);
      return url.pathname + url.search + url.hash;
    } catch (err) {
      return href;
    }
  }
  document.querySelectorAll('a[href^="/api/"]').forEach(function(link) {
    link.setAttribute('href', withAuthToken(link.getAttribute('href') || ''));
  });
})();
</script>
</body></html>`);
}
