/**
 * Pharmacy Growth Journey Dashboard V1 — HTML UI route.
 */
import { Router } from "express";
import {
  buildGrowthJourneyDashboard,
  type GrowthJourneyDashboardV1,
  type JourneyStep,
} from "../../../../src/pharmacy/pharmacyGrowthJourneyService.ts";
import {
  readPharmacyGrowthActionPlan,
  refreshPharmacyGrowthActionPlan,
} from "../../../../src/pharmacy/pharmacyGrowthActionPlanService.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { PRIMARY_PLATFORM_SERVICE_ID } from "../../../../src/pharmacy/pharmacyPlatformDashboardService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function statusClass(status: string): string {
  if (status === "complete") return "status complete";
  if (status === "in_progress") return "status progress";
  return "status pending";
}

function renderStep(step: JourneyStep): string {
  return `<div class="roadmap-step ${step.status}">
  <div class="roadmap-num">STEP ${step.step}</div>
  <div class="roadmap-body">
    <div class="roadmap-top"><strong>${esc(step.title)}</strong><span class="${statusClass(step.status)}">${esc(step.status.replace("_", " "))}</span><span class="pct">${step.pct}%</span></div>
    <p>${esc(step.summary)}</p>
    <a class="btn-sm" href="${esc(step.ctaHref)}">${esc(step.ctaLabel)}</a>
  </div>
</div>`;
}

function renderOppList(items: Array<{ title: string; impact: string; priority: string }>, empty: string): string {
  if (!items.length) return `<p class="muted">${esc(empty)}</p>`;
  return `<ul class="opp-list">${items.map((o) => `<li><strong>${esc(o.title)}</strong><span class="pill">${esc(o.priority)}</span><p>${esc(o.impact)}</p></li>`).join("")}</ul>`;
}

export function renderGrowthJourneyDashboardHtml(d: GrowthJourneyDashboardV1): string {
  const p = d.profile;
  const logo = p.logoUrl
    ? `<img src="${esc(p.logoUrl)}" alt="" class="profile-logo">`
    : `<div class="profile-logo-fallback">${esc((p.pharmacyName || "P").charAt(0))}</div>`;

  const factorRows = d.growthScore.factors
    .map(
      (f) => `<div class="factor-row"><div><strong>${esc(f.label)}</strong><div class="muted">${esc(f.note)}</div><div class="bar"><div class="bar-fill" style="width:${Math.min(100, f.score)}%;background:${esc(p.brandPrimaryColor)}"></div></div></div><div class="factor-score">${f.score}</div></div>`,
    )
    .join("");

  const actionRows = d.growthActions.topActions
    .map(
      (a, i) => `<li class="action-item"><span class="rank">${i + 1}</span><div><strong>${esc(a.title)}</strong><p>${esc(a.impact)}</p><span class="muted">${esc(a.category)} · ${esc(a.priority)} priority · ${esc(a.effort)} effort · ${esc(a.status.replace("_", " "))}</span></div><a class="btn-sm" href="${esc(a.linkedUrl)}" style="align-self:center;white-space:nowrap">Open →</a></li>`,
    )
    .join("");

  const competitorRows = d.competitor.topCompetitors
    .map(
      (c) => `<tr><td>${esc(c.name)}</td><td>${c.rating ?? "—"}</td><td>${c.reviews ?? "—"}</td><td>${c.distanceKm != null ? `${c.distanceKm} km` : "—"}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Growth Journey — ${esc(p.pharmacyName)}</title>
<style>
:root{--primary:${esc(p.brandPrimaryColor)};--secondary:${esc(p.brandSecondaryColor)};--cta:${esc(p.brandCtaColor)}}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,var(--secondary),var(--primary));color:#fff;padding:24px 28px 28px}
header h1{margin:0;font-size:26px;font-weight:800}
header .sub{margin:8px 0 0;color:#dbeafe;font-size:15px}
.profile-strip{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:16px}
.profile-logo,.profile-logo-fallback{width:52px;height:52px;border-radius:12px;background:#fff;object-fit:contain}
.profile-logo-fallback{display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--primary);font-size:22px}
.profile-meta{font-size:14px;color:#e2e8f0}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.toolbar a,.toolbar button{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;text-decoration:none;cursor:pointer;background:rgba(255,255,255,.15);color:#fff}
.toolbar .primary{background:#fff;color:var(--primary)}
main{max-width:1240px;margin:-18px auto 48px;padding:0 20px}
.hero{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px 28px;margin-bottom:18px;box-shadow:0 4px 24px rgba(15,23,42,.06)}
.hero-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:24px;align-items:center}
.score-ring{text-align:center;padding:18px;border-radius:14px;background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #e2e8f0}
.score-num{font-size:58px;font-weight:900;color:var(--primary);line-height:1}
.score-target{font-size:13px;color:#64748b;margin-top:6px}
.next-box{margin-top:14px;padding:14px 16px;border-radius:12px;background:#eff6ff;border:1px solid #dbeafe;font-size:14px}
.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:16px}
.card h2{margin:0 0 6px;font-size:18px;font-weight:800}
.card .lead{margin:0 0 14px;color:#64748b;font-size:14px}
.muted{color:#64748b;font-size:13px}
.metric{font-size:30px;font-weight:900;color:var(--primary);line-height:1.1}
.roadmap-step{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f1f5f9}
.roadmap-step:last-child{border-bottom:0}
.roadmap-num{font-weight:900;color:var(--primary);min-width:72px;font-size:12px;padding-top:2px}
.roadmap-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:6px}
.status{font-size:11px;font-weight:800;text-transform:uppercase;padding:4px 8px;border-radius:999px}
.status.complete{background:#dcfce7;color:#166534}
.status.progress{background:#dbeafe;color:#1d4ed8}
.status.pending{background:#f1f5f9;color:#64748b}
.pct{font-weight:800;color:var(--primary);font-size:13px}
.btn-sm,.btn{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px;border:0}
.btn.alt{background:#475569}
.factor-row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.factor-row:last-child{border-bottom:0}
.factor-score{font-weight:800;color:var(--primary);min-width:36px;text-align:right}
.bar{height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:6px}
.bar-fill{height:100%;border-radius:999px}
table.simple{width:100%;border-collapse:collapse;font-size:13px}
table.simple th,table.simple td{border-bottom:1px solid #f1f5f9;padding:8px 6px;text-align:left}
.opp-list{list-style:none;margin:0;padding:0}
.opp-list li{padding:10px 0;border-bottom:1px solid #f1f5f9}
.opp-list p{margin:4px 0 0;font-size:13px;color:#475569}
.pill{display:inline-block;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800;margin-left:6px}
.action-item{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;list-style:none}
.rank{width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;font-size:13px}
.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.stat-chip{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:12px}
.stat-chip strong{display:block;font-size:18px;color:var(--primary)}
.quick-links{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.quick-links a{display:block;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:var(--primary);font-weight:700;font-size:13px;text-align:center}
.quick-links a:hover{background:#eff6ff;border-color:#bfdbfe}
@media(max-width:980px){.hero-grid,.grid-2,.grid-3,.stat-grid,.quick-links{grid-template-columns:1fr}}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>Growth Journey</h1>
  <p class="sub">Where you are now, what to do next, and the impact of each action.</p>
  <div class="profile-strip">
    ${logo}
    <div><strong style="font-size:18px">${esc(p.pharmacyName)}</strong><div class="profile-meta">${esc(p.town)} · ${esc(p.phone)} · ${esc(p.address)}</div></div>
  </div>
  <div class="toolbar"></div>
  ${renderPharmacyPlatformNavBar({ slug: d.slug, serviceId: PRIMARY_PLATFORM_SERVICE_ID, activeId: "growth-dashboard" })}
</header>
<main>
  <section class="hero">
    <div class="hero-grid">
      <div>
        <h2 style="margin:0 0 8px;font-size:22px">Growth Score</h2>
        <p class="muted" style="margin:0">Based on profile completeness, competitor analysis, content assets, published pages, indexing, visibility and trust signals.</p>
        <div class="next-box"><strong>Next improvement:</strong> ${esc(d.growthScore.nextImprovement)}</div>
        <div style="margin-top:16px">${factorRows}</div>
      </div>
      <div class="score-ring">
        <div class="score-num">${d.growthScore.score}</div>
        <div class="score-target">Current score · Target ${d.growthScore.targetScore}</div>
        <div class="muted" style="margin-top:8px">${esc(d.growthScore.band)} band</div>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Platform Quick Links</h2>
    <p class="lead">Jump to any stage of the PharmaConnect growth workflow.</p>
    <div class="quick-links">
      <a href="/api/pharmacy-profile-dashboard?slug=${esc(d.slug)}">Profile Dashboard</a>
      <a href="/api/pharmacy-competitor-dashboard?slug=${esc(d.slug)}">Competitor Dashboard</a>
      <a href="/api/pharmacy-campaigns?slug=${esc(d.slug)}">Campaign Dashboard</a>
      <a href="/api/pharmacy-content-ecosystem-preview/pharmacy-first/" target="_blank" rel="noopener">Content Ecosystem</a>
      <a href="/api/pharmacy-visual-experience/pharmacy-first/" target="_blank" rel="noopener">Pharmacy First Page</a>
      <a href="/api/pharmacy-growth-dashboard?slug=${esc(d.slug)}#indexing">Indexing</a>
      <a href="/api/pharmacy-growth-dashboard?slug=${esc(d.slug)}#visibility">Visibility</a>
      <a href="/api/pharmacy-growth-actions?slug=${esc(d.slug)}">Growth Actions</a>
    </div>
  </section>

  <section class="card">
    <h2>Progress Roadmap</h2>
    <p class="lead">Eight guided steps from profile setup to growth monitoring.</p>
    ${d.roadmap.map(renderStep).join("")}
  </section>

  <div class="grid-2">
    <section class="card">
      <h2>Competitor Intelligence</h2>
      <p class="lead">${esc(d.competitor.visibilityGapSummary)}</p>
      <div class="stat-grid" style="margin-bottom:12px">
        <div class="stat-chip"><strong>${d.competitor.competitorCount}</strong> competitors</div>
        <div class="stat-chip"><strong>${d.competitor.opportunitiesFound}</strong> opportunities</div>
        <div class="stat-chip"><strong>${esc(d.competitor.positionLabel)}</strong> position</div>
      </div>
      ${competitorRows ? `<table class="simple"><thead><tr><th>Pharmacy</th><th>Rating</th><th>Reviews</th><th>Distance</th></tr></thead><tbody>${competitorRows}</tbody></table>` : `<p class="muted">Run competitor intelligence to populate this section.</p>`}
      <p style="margin-top:14px"><a class="btn" href="${esc(d.competitor.ctaHref)}">View Competitor Report</a></p>
    </section>

    <section class="card">
      <h2>Opportunity Discovery</h2>
      <div class="grid-3">
        <div><h3 style="font-size:15px;margin:0 0 8px">Quick Wins</h3>${renderOppList(d.opportunities.quickWins, "Run competitor analysis for quick wins.")}</div>
        <div><h3 style="font-size:15px;margin:0 0 8px">Medium Wins</h3>${renderOppList(d.opportunities.mediumWins, "No medium-priority opportunities yet.")}</div>
        <div><h3 style="font-size:15px;margin:0 0 8px">Strategic Wins</h3>${renderOppList(d.opportunities.strategicWins, "No strategic opportunities yet.")}</div>
      </div>
    </section>
  </div>

  <section class="card">
    <h2>Content Assets</h2>
    <div class="stat-grid">
      <div class="stat-chip"><strong>${d.content.servicePages.published}</strong> service pages published<span class="muted" style="display:block">${d.content.servicePages.draft} draft · ${d.content.servicePages.total} total</span></div>
      <div class="stat-chip"><strong>${d.content.blogContent.total}</strong> blog / guide pages</div>
      <div class="stat-chip"><strong>${d.content.faqAssets}</strong> FAQ assets</div>
      <div class="stat-chip"><strong>${d.content.gbpAssets}</strong> GBP asset packs</div>
      <div class="stat-chip"><strong>${d.content.emailAssets}</strong> email asset packs</div>
      <div class="stat-chip"><strong>${d.content.contentEcosystems}</strong> content ecosystems</div>
      <div class="stat-chip"><strong>${d.content.visualExperiencePages}</strong> visual experience pages</div>
    </div>
  </section>

  <div class="grid-2">
    <section class="card">
      <h2>Publishing</h2>
      <div class="stat-grid">
        <div class="stat-chip"><strong>${d.publishing.pagesPublished}</strong> published</div>
        <div class="stat-chip"><strong>${d.publishing.pagesReady}</strong> ready</div>
        <div class="stat-chip"><strong>${d.publishing.pagesPending}</strong> pending</div>
        <div class="stat-chip"><strong>${d.publishing.registryCount}</strong> registry</div>
      </div>
    </section>
    <section class="card" id="indexing">
      <h2>Indexing</h2>
      <p class="lead">${d.indexing.connected ? esc(d.indexing.visibilityTrend) : `Internal registry for the current ${esc(d.indexing.serviceId || "campaign")} publication. Registration does not submit URLs to Google.`}</p>
      <p class="muted">Current service: <strong>${esc(d.indexing.serviceId || "—")}</strong>${d.indexing.homepageExcluded ? " · homepage redirect excluded" : ""}</p>
      <div class="stat-grid">
        <div class="stat-chip"><strong>${d.indexing.publishedPages}</strong> published</div>
        <div class="stat-chip"><strong>${d.indexing.indexEligiblePages}</strong> index eligible</div>
        <div class="stat-chip"><strong>${d.indexing.registeredPages}</strong> registered</div>
        <div class="stat-chip"><strong>${d.indexing.submittedUrls}</strong> submitted</div>
        <div class="stat-chip"><strong>${d.indexing.indexedUrls}</strong> indexed</div>
        <div class="stat-chip"><strong>${d.indexing.notIndexedUrls}</strong> not indexed</div>
      </div>
      ${d.indexing.registerableUrls.length ? `<div style="margin-top:12px"><strong>Registerable URLs (${d.indexing.registerablePages})</strong><ul class="opp-list">${d.indexing.registerableUrls.map((u) => `<li><p>${esc(u)}</p></li>`).join("")}</ul></div>` : ""}
      ${d.indexing.registeredUrls.length ? `<div style="margin-top:12px"><strong>Registered URLs (${d.indexing.registeredPages})</strong><ul class="opp-list">${d.indexing.registeredUrls.map((u) => `<li><p>${esc(u)}</p></li>`).join("")}</ul></div>` : ""}
      ${d.indexing.sitemapUrl ? `<p class="muted" style="margin-top:12px">Publication sitemap: <a href="${esc(d.indexing.sitemapUrl)}" target="_blank" rel="noopener">${esc(d.indexing.sitemapUrl)}</a></p>` : ""}
      ${d.indexing.lastUpdated ? `<p class="muted">Registry updated: ${esc(d.indexing.lastUpdated)}</p>` : ""}
      <p class="muted">External action uses Google Search Console sitemap submit (<code>webmasters.sitemaps.submit</code>), not the Google Indexing API. Submit Ready Pages runs a pre-flight unless an explicit live confirmation is given.</p>
      <div class="stat-grid" style="margin-top:12px">
        <div class="stat-chip"><strong>${esc(d.indexing.searchConsole.connectedLabel)}</strong> Search Console</div>
        <div class="stat-chip"><strong>${esc(d.indexing.searchConsole.submissionPermissionLabel)}</strong> Submission permission</div>
        <div class="stat-chip"><strong>${esc(d.indexing.searchConsole.managedPropertyLabel)}</strong> Managed property</div>
        <div class="stat-chip"><strong>${esc(d.indexing.searchConsole.externalSubmissionLabel)}</strong> External submission</div>
      </div>
      <p class="muted" style="margin-top:10px">Requested property: <code>${esc(d.indexing.searchConsole.requestedProperty)}</code></p>
      <p class="muted">${esc(d.indexing.searchConsole.setupHint)}</p>
      ${d.indexing.searchConsole.googleError ? `<p class="muted" style="color:#b91c1c">Google verification note: ${esc(d.indexing.searchConsole.googleError)}</p>` : ""}
      <p class="muted">Live sitemap submit kill switch: ${d.indexing.searchConsole.liveSubmitKillSwitchEnabled ? "Enabled" : "Disabled"}</p>
      <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
        ${d.indexing.searchConsole.reconnectRequired ? `<a class="btn" id="btn-gsc-reconnect" href="${esc(d.indexing.searchConsole.reconnectUrl)}">Reconnect Search Console for write permission</a>` : ""}
        <button type="button" class="btn alt" id="btn-verify-gsc-authority" data-slug="${esc(d.slug)}" data-service="${esc(d.indexing.serviceId)}">Verify Search Console property</button>
        <button type="button" class="btn" id="btn-register-indexing" data-slug="${esc(d.slug)}" data-service="${esc(d.indexing.serviceId)}">${d.indexing.registeredPages ? "Re-register Eligible Pages" : "Register Pages"}</button>
        <button type="button" class="btn alt" id="btn-submit-indexing" data-slug="${esc(d.slug)}" data-service="${esc(d.indexing.serviceId)}">Submit Ready Pages</button>
        <button type="button" class="btn alt" id="btn-refresh-indexing" data-slug="${esc(d.slug)}" data-service="${esc(d.indexing.serviceId)}">Refresh Indexing Status</button>
      </div>
      <p class="muted" id="indexing-action-msg" style="margin-top:10px;display:none"></p>
    </section>
  </div>

  <section class="card" id="visibility">
    <h2>Visibility Tracking</h2>
    <p class="lead">${d.visibility.connected ? esc(d.visibility.competitorGap) : "Refresh visibility tracking after pages are indexed."}</p>
    <div class="stat-grid">
      <div class="stat-chip"><strong>${d.visibility.trackedServices}</strong> tracked services</div>
      <div class="stat-chip"><strong>${d.visibility.indexedServices}</strong> indexed services</div>
      <div class="stat-chip"><strong>${d.visibility.visibleServices}</strong> visible services</div>
      <div class="stat-chip"><strong>${d.visibility.estimatedVisibilityScore}</strong> visibility score</div>
    </div>
    <div class="grid-3" style="margin-top:14px">
      <div><strong>Tracked keywords</strong><div class="metric">${d.visibility.trackedKeywords}</div></div>
      <div><strong>Organic visibility</strong><p class="muted">${esc(d.visibility.organicVisibilitySummary)}</p></div>
      <div><strong>Competitor comparison</strong><p class="muted">${esc(d.visibility.competitorComparison)}</p></div>
    </div>
    ${d.visibility.topKeywordOpportunities.length ? `<div style="margin-top:14px"><strong>Top keyword opportunities</strong><ul class="opp-list">${d.visibility.topKeywordOpportunities.map((o) => `<li><strong>${esc(o.keyword)}</strong><span class="pill">${esc(o.serviceId)}</span><p>${esc(o.opportunity)}</p></li>`).join("")}</ul></div>` : ""}
    ${d.visibility.recommendedActions.length ? `<div style="margin-top:14px"><strong>Recommended actions</strong><ol style="margin:8px 0 0;padding-left:20px">${d.visibility.recommendedActions.map((a) => `<li style="margin-bottom:6px">${esc(a)}</li>`).join("")}</ol></div>` : ""}
    ${d.visibility.lastCheckedAt ? `<p class="muted" style="margin-top:12px">Last refresh: ${esc(d.visibility.lastCheckedAt)}</p>` : ""}
    <div style="margin-top:14px">
      <button type="button" class="btn" id="btn-refresh-visibility" data-slug="${esc(d.slug)}">Refresh Visibility Status</button>
    </div>
    <p class="muted" id="visibility-action-msg" style="margin-top:10px;display:none"></p>
  </section>

  <section class="card" id="growth-actions">
    <h2>Growth Actions</h2>
    <p class="lead">Top priority actions ranked by impact, urgency and effort — your exact next steps to improve visibility.</p>
    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat-chip"><strong>${d.growthActions.totalActions}</strong> total actions</div>
      <div class="stat-chip"><strong>${d.growthActions.pendingActions}</strong> pending</div>
      <div class="stat-chip"><strong>${d.growthActions.inProgressActions}</strong> in progress</div>
      <div class="stat-chip"><strong>${d.growthActions.completeActions}</strong> complete</div>
    </div>
    <ol style="margin:0;padding:0">${actionRows || `<li class="muted" style="list-style:none">Refresh the action plan to generate prioritised next steps.</li>`}</ol>
    <p style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
      <a class="btn" href="${esc(d.growthActions.planUrl)}">View Full Action Plan</a>
      <button type="button" class="btn alt" id="btn-refresh-actions" data-slug="${esc(d.slug)}">Refresh Action Plan</button>
    </p>
    ${d.growthActions.lastUpdated ? `<p class="muted">Last updated: ${esc(d.growthActions.lastUpdated)}</p>` : ""}
  </section>

  <p class="muted" style="text-align:center;font-size:12px">Generated ${esc(d.generatedAt)} · PharmaConnect Growth Journey V1</p>
</main>
<script>
(function(){
  var msg = document.getElementById("indexing-action-msg");
  function showMsg(text, ok) {
    if (!msg) return;
    msg.style.display = "block";
    msg.textContent = text;
    msg.style.color = ok ? "#166534" : "#b91c1c";
  }
  function bind(btnId, path, extraHeaders) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", function(){
      var slug = btn.getAttribute("data-slug") || "pharmaconnect";
      var service = btn.getAttribute("data-service") || "";
      btn.disabled = true;
      showMsg("Working…", true);
      var headers = { "Accept": "application/json", "Content-Type": "application/json" };
      fetch("/api/pharmacy-indexing/" + slug + path, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ serviceId: service })
      })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if (data.ok) {
            showMsg("Done — reloading dashboard…", true);
            setTimeout(function(){ window.location.reload(); }, 600);
          } else {
            showMsg(data.error || "Request failed", false);
            btn.disabled = false;
          }
        })
        .catch(function(err){
          showMsg(String(err), false);
          btn.disabled = false;
        });
    });
  }
  bind("btn-register-indexing", "/register");
  bind("btn-refresh-indexing", "/refresh");

  var reconnect = document.getElementById("btn-gsc-reconnect");
  if (reconnect) {
    var handoff = new URLSearchParams(location.search).get("_t");
    if (handoff) {
      var href = reconnect.getAttribute("href") || "/api/gsc/auth/start";
      reconnect.setAttribute("href", href + (href.indexOf("?") >= 0 ? "&" : "?") + "_t=" + encodeURIComponent(handoff));
    }
  }
  var verifyBtn = document.getElementById("btn-verify-gsc-authority");
  if (verifyBtn) {
    verifyBtn.addEventListener("click", function(){
      var slug = verifyBtn.getAttribute("data-slug") || "pharmaconnect";
      var service = verifyBtn.getAttribute("data-service") || "";
      verifyBtn.disabled = true;
      showMsg("Verifying Search Console scope and property inventory (no sitemap submit)…", true);
      fetch("/api/pharmacy-indexing/" + slug + "/search-console-authority", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service, liveGoogle: true })
      })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if (data.ok) {
            showMsg("Search Console: " + (data.authority && data.authority.connectedLabel) + " · Permission: " + (data.authority && data.authority.submissionPermissionLabel) + " · Property: " + (data.authority && data.authority.managedPropertyLabel) + " · External submission: " + (data.authority && data.authority.externalSubmissionLabel) + ". Sitemap not submitted.", true);
            var next = new URL(window.location.href);
            next.searchParams.delete("gsc_connected");
            next.searchParams.delete("gsc_error");
            setTimeout(function(){ window.location.replace(next.toString()); }, 800);
          } else {
            showMsg(data.error || "Verification failed", false);
            verifyBtn.disabled = false;
          }
        })
        .catch(function(err){
          showMsg(String(err), false);
          verifyBtn.disabled = false;
        });
    });
  }
  if (new URLSearchParams(location.search).get("gsc_connected") === "1" && verifyBtn) {
    verifyBtn.click();
  }

  var submitBtn = document.getElementById("btn-submit-indexing");
  if (submitBtn) {
    submitBtn.addEventListener("click", function(){
      var slug = submitBtn.getAttribute("data-slug") || "pharmaconnect";
      var service = submitBtn.getAttribute("data-service") || "";
      submitBtn.disabled = true;
      showMsg("Running Search Console sitemap pre-flight (no Google submission)…", true);
      fetch("/api/pharmacy-indexing/" + slug + "/submit", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service, mode: "dry-run", confirmExternal: false })
      })
        .then(function(r){ return r.json(); })
        .then(function(data){
          var count = data.preflight && data.preflight.candidateCount != null ? data.preflight.candidateCount : 0;
          var property = data.preflight && data.preflight.searchConsole ? data.preflight.searchConsole.property : "";
          var blocked = data.preflight && data.preflight.liveSubmitBlockedReasons ? data.preflight.liveSubmitBlockedReasons.join(", ") : "";
          if (data.ok) {
            showMsg("Pre-flight only — " + count + " authorised URLs, 0 submitted, 0 Google requests. Property " + property + (blocked ? ". Live submit blocked: " + blocked : "."), true);
          } else {
            showMsg(data.error || "Pre-flight failed", false);
          }
          submitBtn.disabled = false;
        })
        .catch(function(err){
          showMsg(String(err), false);
          submitBtn.disabled = false;
        });
    });
  }

  var actionsBtn = document.getElementById("btn-refresh-actions");
  if (actionsBtn) {
    actionsBtn.addEventListener("click", function(){
      var slug = actionsBtn.getAttribute("data-slug") || "pharmaconnect";
      actionsBtn.disabled = true;
      fetch("/api/pharmacy-growth-actions/" + slug + "/refresh", { method: "POST", headers: { "Accept": "application/json" } })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if (data.ok) window.location.reload();
          else { alert(data.error || "Refresh failed"); actionsBtn.disabled = false; }
        })
        .catch(function(err){ alert(String(err)); actionsBtn.disabled = false; });
    });
  }

  var visMsg = document.getElementById("visibility-action-msg");
  var visBtn = document.getElementById("btn-refresh-visibility");
  if (visBtn) {
    visBtn.addEventListener("click", function(){
      var slug = visBtn.getAttribute("data-slug") || "pharmaconnect";
      visBtn.disabled = true;
      if (visMsg) { visMsg.style.display = "block"; visMsg.textContent = "Refreshing visibility…"; visMsg.style.color = "#166534"; }
      fetch("/api/pharmacy-visibility/" + slug + "/refresh", { method: "POST", headers: { "Accept": "application/json" } })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if (data.ok) {
            if (visMsg) { visMsg.textContent = "Done — reloading dashboard…"; }
            setTimeout(function(){ window.location.reload(); }, 600);
          } else {
            if (visMsg) { visMsg.textContent = data.error || "Request failed"; visMsg.style.color = "#b91c1c"; }
            visBtn.disabled = false;
          }
        })
        .catch(function(err){
          if (visMsg) { visMsg.textContent = String(err); visMsg.style.color = "#b91c1c"; }
          visBtn.disabled = false;
        });
    });
  }
})();
</script>
</body>
</html>`;
}

router.get("/pharmacy-growth-dashboard", (req, res) => {
  const slug = safeSlug(String(req.query.slug || "pharmaconnect"));
  try {
    if (!readPharmacyGrowthActionPlan(slug)) {
      refreshPharmacyGrowthActionPlan(slug);
    }
    const dash = buildGrowthJourneyDashboard(slug);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderGrowthJourneyDashboardHtml(dash));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Growth Journey error: ${esc(String(err))}</pre>`);
  }
});

export default router;
