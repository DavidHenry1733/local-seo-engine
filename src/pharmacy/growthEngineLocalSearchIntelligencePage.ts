/**
 * Local Pharmacy Search Intelligence — customer-facing page.
 * Demand and classified organic evidence only. Does not invent competitors.
 */
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import {
  buildLocalSearchIntelligenceView,
  type LocalSearchIntelligenceView,
} from "./growthEngineLocalSearchIntelligenceService.ts";
import type { ClassifiedOrganicSearchEvidenceRow } from "./organicSearchEvidenceClassification.ts";
import { ORGANIC_SEARCH_EVIDENCE_HEADING } from "./organicSearchEvidenceClassification.ts";
import {
  presentSearchIntelligenceMoney,
  searchIntelligenceMoneyFootnote,
} from "./searchIntelligenceMoney.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function fmt(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
}

function money(value: number | null | undefined, currency: "USD" | "GBP" | null | undefined): string {
  return presentSearchIntelligenceMoney(value, currency).display;
}

function evidenceRows(rows: ClassifiedOrganicSearchEvidenceRow[]): string {
  if (!rows.length) {
    return `<p class="ge-lead">No rows in this evidence section from the stored DataForSEO organic-search run.</p>`;
  }
  const body = rows
    .slice(0, 20)
    .map(
      (row) => `<tr>
<td>${esc(row.classificationLabel)}</td>
<td>${esc(row.domain || "—")}</td>
<td>${fmt(row.position)}</td>
<td>${esc(row.matchedQuery || "—")}</td>
<td>${row.url ? `<a href="${esc(row.url)}" rel="noopener noreferrer">${esc(row.title || row.url)}</a>` : esc(row.title || "—")}</td>
</tr>`,
    )
    .join("");
  return `<div style="overflow:auto"><table class="local-si-table">
<thead><tr><th>Classification</th><th>Domain</th><th>Position</th><th>Query</th><th>Evidence</th></tr></thead>
<tbody>${body}</tbody>
</table></div>`;
}

export function renderLocalSearchIntelligencePage(
  slug: string,
  nav: { prevUrl?: string; nextUrl?: string } = {},
): string {
  const view: LocalSearchIntelligenceView = buildLocalSearchIntelligenceView(slug);
  const framework = buildGrowthEngineFramework(slug);
  const collectUrl = `/api/growth-engine/${encodeURIComponent(slug)}/search-intelligence/collect`;
  const demandStatus = view.demand
    ? `Collected ${view.demand.generatedAt}`
    : "Not collected";
  const organicStatus = view.organic?.generated
    ? `${view.organic.status} · ${view.organic.competitors.length} SERP domains`
    : view.organic?.status
      ? String(view.organic.status)
      : "Not collected";

  const demandBody = view.demandRows.length
    ? `<div style="overflow:auto"><table class="local-si-table">
<thead><tr><th>Query</th><th>Search volume</th><th>Competition</th><th>CPC</th><th>Availability</th></tr></thead>
<tbody>${view.demandRows
        .map(
          (row) => `<tr>
<td>${esc(row.query)}</td>
<td>${fmt(row.searchVolume)}</td>
<td>${esc(row.competition || "—")}</td>
<td>${money(row.cpc, row.cpcCurrency)}</td>
<td>${esc(row.availability)}${row.unavailableReason ? ` — ${esc(row.unavailableReason)}` : ""}</td>
</tr>`,
        )
        .join("")}</tbody>
</table></div>
<p class="ge-meta">${esc(searchIntelligenceMoneyFootnote())}</p>`
    : `<p class="ge-lead">No Keywords Data search-volume rows are stored yet. Collect Search Intelligence to request confirmed-service demand from DataForSEO.</p>`;

  const body = `<div class="ge-panel" data-local-si-section="search-intelligence">
<h2>Search Intelligence</h2>
<p class="ge-lead">Service search demand and organic-search evidence for ${esc(view.pharmacyName || slug)}${view.town ? ` · ${esc(view.town)}` : ""}. This is not National Search Intelligence.</p>
<p class="ge-lead">${esc(view.note)}</p>
<p class="ge-meta">Website: ${view.website ? `<a href="${esc(view.website)}">${esc(view.website)}</a>` : "—"}</p>
<p class="ge-meta">Demand source: ${esc(view.demand?.source || "not collected")} · ${esc(demandStatus)}</p>
<p class="ge-meta">Organic source: ${esc(view.organic?.provider || "not collected")} · ${esc(organicStatus)}</p>
<p style="margin-top:16px" data-local-si-section="explicit-refresh">
<button class="ge-btn ge-btn-primary" type="button" id="localSiCollect">${view.collected ? "Refresh Search Intelligence" : "Collect Search Intelligence"}</button>
<span id="localSiCollectStatus" class="ge-meta" style="margin-left:10px"></span>
</p>
<p class="ge-lead">Collection is explicit. Opening this page does not call DataForSEO.</p>
</div>

<div class="ge-panel" data-local-si-section="keywords">
<h2>Service search demand</h2>
<p class="ge-lead">Google Ads search volume for confirmed selected services. Null values are shown as dashes — they are not converted to zero. Locality is not added to demand queries.</p>
${demandBody}
</div>

<div class="ge-panel" data-local-si-section="organic-evidence">
<h2>${esc(ORGANIC_SEARCH_EVIDENCE_HEADING)}</h2>
<p class="ge-lead">SERP domains are classified against your website and verified Google Places competitor websites. Wider landscape rows are not direct competitors.</p>
<h3>Your pharmacy</h3>
${evidenceRows(view.classified.yourPharmacy)}
<h3>Verified local competitor matches</h3>
${evidenceRows(view.classified.verifiedLocalCompetitorMatches)}
<h3>Wider organic landscape</h3>
${evidenceRows(view.classified.widerOrganicLandscape)}
</div>
<script>
(function(){
  var btn = document.getElementById('localSiCollect');
  var status = document.getElementById('localSiCollectStatus');
  if (!btn) return;
  btn.addEventListener('click', async function(){
    btn.disabled = true;
    status.textContent = 'Collecting search demand and organic evidence…';
    try {
      var res = await fetch(${JSON.stringify(collectUrl)}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ force: ${view.collected ? "true" : "false"} })
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

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Search Intelligence · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthEngineWorkflowCss()}
.local-si-table{width:100%;border-collapse:collapse;font-size:13px;background:#fff}
.local-si-table th,.local-si-table td{border-bottom:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
.local-si-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.local-si-table a{color:#1d4ed8;word-break:break-all}
.ge-meta{font-size:13px;color:#475569}
</style>
</head>
<body data-slug="${esc(slug)}" data-growth-platform="local" data-local-si-page="search-intelligence">
<header style="background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Search Intelligence</h1>
<p>Service demand and classified organic-search evidence for this local pharmacy</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "local-market", { prevUrl: nav.prevUrl, nextUrl: nav.nextUrl, nextLabel: "Continue to Your Website Report →" })}
${body}
</div>
</body></html>`;
}
