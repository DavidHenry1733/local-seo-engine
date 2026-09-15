/**
 * NI-03B — Customer-facing National Search Intelligence page.
 * Read-only render. Collection is an explicit POST.
 */
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import {
  readNationalSearchIntelligence,
} from "./nationalSearchIntelligenceV1Service.ts";
import type { NationalSearchIntelligenceSnapshot } from "./nationalSearchIntelligenceV1Model.ts";
import { PARTIAL_COLLECTION_CUSTOMER_MESSAGE } from "./nationalSearchIntelligenceV1Model.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function fmt(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
}

function money(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "—";
}

function authorityLabel(snapshot: NationalSearchIntelligenceSnapshot): string {
  if (snapshot.status === "not_collected") return "Not collected";
  if (snapshot.status === "error") return "Collection error";
  if (snapshot.authority === "FIXTURE_ONLY") return "Fixture / non-live";
  if (snapshot.authority === "RECOVERED_EVIDENCE") return "Recovered evidence";
  if (snapshot.provenance.evidenceSource === "DATAFORSEO_LIVE") return "Live DataForSEO";
  if (snapshot.provenance.evidenceSource === "DATAFORSEO_PERSISTED") return "Persisted DataForSEO";
  if (snapshot.provenance.evidenceSource === "FALLBACK") return "Fallback";
  return snapshot.provenance.evidenceSource;
}

function statusLabel(snapshot: NationalSearchIntelligenceSnapshot): string {
  if (snapshot.status === "collected") return "Intelligence collected";
  if (snapshot.status === "partial") return "Intelligence collected with incomplete search-engine results";
  if (snapshot.status === "empty") return "Collected — no ranking keywords or search competitors returned";
  if (snapshot.status === "error") return "Collection failed";
  if (snapshot.status === "collecting") return "Collecting";
  return "Intelligence not collected";
}

export function renderNationalSearchIntelligencePage(
  slug: string,
  nav: { prevUrl?: string; nextUrl?: string } = {},
): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  if (!isNationalGrowthPlatform(slug)) {
    const body = `<div class="ge-panel" data-ni03b-section="local-blocked">
<h2>National Search Intelligence</h2>
<p class="ge-lead">This customer is on the Local Pharmacy Growth Engine. Organic search competitor discovery for the national digital-growth market is not used here.</p>
<p><a class="ge-btn ge-btn-primary" href="/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}">Open Your Local Market →</a></p>
</div>`;
    return page(slug, copy.marketStepTitle, copy.marketStepSubtitle, body, nav, "local");
  }

  const snapshot = readNationalSearchIntelligence(slug);
  const collected = snapshot.status === "collected" || snapshot.status === "empty" || snapshot.status === "partial";
  const sourceLabel = authorityLabel(snapshot);
  const keywords = snapshot.customerKeywords.slice(0, 25);
  const competitors = snapshot.organicCompetitors.slice(0, 12);
  const collectUrl = `/api/growth-engine/${encodeURIComponent(slug)}/search-intelligence/collect`;

  const cards = collected
    ? `<div class="ge-grid-3" data-ni03b-section="summary-cards">
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Ranking keywords</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.rankingKeywordCount}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Top 10 rankings</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.top10Count}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Top 20 rankings</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.top20Count}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Ranking pages</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.rankingPageCount}</p></div>
<div class="ge-card"><span class="ge-placeholder">Calculated</span><h3>Available search demand</h3><p style="font-size:28px;font-weight:900;margin:0">${fmt(snapshot.summary.availableSearchDemand)}</p></div>
<div class="ge-card"><span class="ge-placeholder">Evidence</span><h3>Search competitors</h3><p style="font-size:28px;font-weight:900;margin:0">${snapshot.summary.organicCompetitorCount}</p></div>
</div>`
    : `<p class="ge-lead" data-ni03b-section="empty-metrics">No collection has been performed yet. Metrics will appear from persisted DataForSEO evidence only.</p>`;

  const keywordRows = keywords.length
    ? keywords.map((row) => `<tr>
<td>${esc(row.keyword)}</td>
<td>${fmt(row.position)}</td>
<td>${fmt(row.searchVolume)}</td>
<td>${row.cpc == null ? "—" : row.cpc.toFixed(2)}</td>
<td>${row.competition == null ? "—" : row.competition.toFixed(2)}</td>
<td>${row.rankingUrl ? `<a href="${esc(row.rankingUrl)}" rel="noreferrer">${esc(row.rankingUrl)}</a>` : "—"}</td>
<td>${esc(row.evidenceSource)}</td>
</tr>`).join("")
    : `<tr><td colspan="7">${snapshot.status === "not_collected" ? "No ranking keywords collected yet." : "No ranking keywords were returned."}</td></tr>`;

  const competitorCards = competitors.length
    ? competitors.map((row) => `<article class="ge-competitor" data-ni03b-competitor="${esc(row.domain)}">
<div class="ge-competitor-head">
<div>
<p class="ge-competitor-name">${esc(row.name)}</p>
<p class="ge-meta">${esc(row.domain)} · ${esc(row.classification.replace(/_/g, " "))} · ${esc(row.qualification)}</p>
</div>
<span class="ge-pill">${esc(row.evidenceStatus.replace(/_/g, " "))}</span>
</div>
<p style="font-size:13px;color:#334155;margin:0 0 8px">${esc(row.whyIdentified[0] || "Identified from organic Google search results.")}</p>
<p class="ge-meta">Overlap/signals: ${esc(row.sourceQueries.join(" · ") || "Organic SERP")}</p>
<p class="ge-meta">Evidence status: ${esc(row.evidenceSource)} · Verified: no · Best SERP position: ${fmt(row.bestSerpPosition)}</p>
</article>`).join("")
    : `<p class="ge-lead">${snapshot.status === "not_collected" ? "No organic search competitors collected yet." : "No organic search competitors were identified from the bounded collection."}</p>`;

  const body = `<div class="ge-panel" data-ni03b-section="search-intelligence">
<h2>Search Intelligence</h2>
<p class="ge-lead">What Google already knows about this national digital-growth business — organic rankings and search competitors, not nearby pharmacies.</p>
<div class="ge-grid-2" data-ni03b-section="collection-meta">
<div class="ge-card"><h3>Business</h3><p>${esc(snapshot.businessName)}</p></div>
<div class="ge-card"><h3>Domain</h3><p data-ni03b-domain="${esc(snapshot.subjectDomain)}">${esc(snapshot.subjectDomain || "Not configured")}</p></div>
<div class="ge-card"><h3>Market</h3><p data-ni03b-market="${esc(snapshot.primaryMarket)}">${esc(snapshot.primaryMarket)}</p></div>
<div class="ge-card"><h3>Status</h3><p data-ni03b-status="${esc(snapshot.status)}">${esc(statusLabel(snapshot))}</p></div>
<div class="ge-card"><h3>Last collected</h3><p data-ni03b-captured="${esc(snapshot.capturedAt)}">${snapshot.status === "not_collected" ? "Not collected" : esc(snapshot.capturedAt)}</p></div>
<div class="ge-card" data-ni03b-section="provenance"><h3>Source / provenance</h3><p>${esc(sourceLabel)}</p><p class="ge-meta">${esc(snapshot.provenance.evidenceSource)} · ${esc(snapshot.authority)}</p></div>
<div class="ge-card" data-ni03b-section="cost"><h3>Collection cost</h3><p>DataForSEO ${money(snapshot.costs.totalCost)}</p><p class="ge-meta">${snapshot.costs.requests} request(s) · ${snapshot.costs.tasks} task(s)</p></div>
</div>
${snapshot.status === "partial" ? `<p class="ge-lead" style="color:#b45309" data-ni03b-section="partial">${esc(PARTIAL_COLLECTION_CUSTOMER_MESSAGE)}</p>` : snapshot.lastError && snapshot.status !== "partial" ? `<p class="ge-lead" style="color:#b45309" data-ni03b-section="error">${esc(snapshot.lastError)}</p>` : ""}
<p style="margin-top:16px" data-ni03b-section="explicit-refresh">
<button class="ge-btn ge-btn-primary" type="button" id="ni03bCollect">${collected ? "Refresh Search Intelligence" : "Collect Search Intelligence"}</button>
<span id="ni03bCollectStatus" class="ge-meta" style="margin-left:10px"></span>
</p>
<p class="ge-lead">Collection is explicit. Opening this page does not call DataForSEO.</p>
</div>

<div class="ge-panel" data-ni03b-section="keywords">
<h2>Your organic search visibility</h2>
<p class="ge-lead">Keywords this domain currently ranks for in Google, from DataForSEO Labs ranked keywords. Null values are shown as dashes — they are not converted to zero.</p>
${cards}
<div style="overflow:auto;margin-top:16px">
<table class="ni03b-table">
<thead><tr><th>Keyword</th><th>Position</th><th>Search volume</th><th>CPC</th><th>Competition</th><th>Ranking page</th><th>Evidence</th></tr></thead>
<tbody>${keywordRows}</tbody>
</table>
</div>
</div>

<div class="ge-panel" data-ni03b-section="competitors">
<h2>Your organic competitors</h2>
<p class="ge-lead">These are websites competing with you in organic Google search results. They are not selected based on physical proximity.</p>
${competitorCards}
</div>

<div class="ge-panel" data-ni03b-section="next-stage">
<h2>What happens next</h2>
<p class="ge-lead">${esc(snapshot.nextStage.detail)}</p>
</div>
<script>
(function(){
  var btn = document.getElementById('ni03bCollect');
  var status = document.getElementById('ni03bCollectStatus');
  if (!btn) return;
  btn.addEventListener('click', async function(){
    btn.disabled = true;
    status.textContent = 'Collecting bounded search intelligence…';
    try {
      var collectUrl = ${JSON.stringify(collectUrl)};
      var token = new URLSearchParams(window.location.search).get('_t');
      if (token) collectUrl += (collectUrl.indexOf('?') >= 0 ? '&' : '?') + '_t=' + encodeURIComponent(token);
      var res = await fetch(collectUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ force: ${collected ? "true" : "false"} })
      });
      var payload = await res.json();
      if (!res.ok || payload.ok === false) {
        status.textContent = payload.error || 'Collection failed';
        btn.disabled = false;
        return;
      }
      window.location.reload();
    } catch (err) {
      status.textContent = String(err);
      btn.disabled = false;
    }
  });
})();
</script>`;

  return page(slug, "Search Intelligence", "Organic rankings and search competitors for this national digital-growth business", body, nav, "national");
}

function page(
  slug: string,
  title: string,
  subtitle: string,
  body: string,
  nav: { prevUrl?: string; nextUrl?: string },
  platform: "national" | "local",
): string {
  const framework = buildGrowthEngineFramework(slug);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthEngineWorkflowCss()}
.ni03b-table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
.ni03b-table th,.ni03b-table td{border-bottom:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
.ni03b-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.ni03b-table a{color:#1d4ed8;word-break:break-all}
</style>
</head>
<body data-slug="${esc(slug)}" data-growth-platform="${platform}" data-ni03b-page="search-intelligence">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>${esc(title)}</h1>
<p>${esc(subtitle)}</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "local-market", { prevUrl: nav.prevUrl, nextUrl: nav.nextUrl, nextLabel: "Continue to Growth Plan →" })}
${body}
</div>
</body></html>`;
}
