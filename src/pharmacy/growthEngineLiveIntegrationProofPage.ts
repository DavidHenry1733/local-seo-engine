/**
 * Growth Engine — Live Integration Proof V1 status page.
 */
import type { IntegrationStatusLabel, LiveIntegrationProofReport, LiveIntegrationResult } from "./growthEngineLiveIntegrationModel.ts";
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import {
  commercialBlueChromeGradientCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

const STATUS_LABELS: Record<IntegrationStatusLabel, string> = {
  connected: "Connected",
  not_connected: "Not Connected",
  error: "Error",
  limited: "Limited",
  ready: "Ready",
};

export function liveIntegrationProofCss(): string {
  return `${growthEngineWorkflowCss()}
.lip-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
.lip-summary-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff;text-align:center}
.lip-summary-card strong{display:block;font-size:28px;font-weight:900;color:#0f172a}
.lip-summary-card span{font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase}
.lip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.lip-card{border:2px solid #e2e8f0;border-radius:14px;padding:18px;background:#fff}
.lip-card.status-ready,.lip-card.status-connected{border-color:#22c55e;background:linear-gradient(180deg,#f0fdf4,#fff)}
.lip-card.status-limited{border-color:#f59e0b;background:linear-gradient(180deg,#fffbeb,#fff)}
.lip-card.status-not_connected{border-color:#cbd5e1;background:#f8fafc}
.lip-card.status-error{border-color:#ef4444;background:linear-gradient(180deg,#fef2f2,#fff)}
.lip-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
.lip-card-head h3{margin:0;font-size:16px;font-weight:900}
.lip-badge{font-size:10px;font-weight:900;padding:4px 10px;border-radius:999px;text-transform:uppercase;white-space:nowrap}
.lip-badge.ready,.lip-badge.connected{background:#dcfce7;color:#166534}
.lip-badge.limited{background:#fef3c7;color:#92400e}
.lip-badge.not_connected{background:#f1f5f9;color:#64748b}
.lip-badge.error{background:#fee2e2;color:#991b1b}
.lip-result{font-size:13px;color:#334155;margin:0 0 10px;line-height:1.5}
.lip-meta{font-size:11px;color:#94a3b8;margin-bottom:10px}
.lip-unlocks{font-size:12px;color:#475569;margin:0 0 10px;line-height:1.5}
.lip-unlocks strong{color:#334155}
.lip-action{font-size:12px;color:#005eb8;font-weight:700;margin:0 0 12px;line-height:1.5}
.lip-checks{margin:0;padding:0;list-style:none;font-size:12px}
.lip-checks li{padding:6px 0;border-top:1px solid #f1f5f9;display:flex;gap:8px;align-items:flex-start}
.lip-check-ok{color:#16a34a;font-weight:900;flex-shrink:0}
.lip-check-fail{color:#dc2626;font-weight:900;flex-shrink:0}
.lip-check-detail{color:#64748b;font-size:11px;display:block;margin-top:2px}
.lip-live-tag{font-size:9px;font-weight:800;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:999px;margin-left:6px}
.lip-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
.lip-note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;font-size:13px;color:#1e40af;margin-bottom:18px}
.lip-overall{border:2px solid #005eb8;border-radius:14px;padding:18px;background:linear-gradient(135deg,#eff6ff,#fff);margin-bottom:18px}
.lip-overall h2{margin:0 0 6px;font-size:18px}
.lip-overall p{margin:0;font-size:14px;color:#475569;line-height:1.6}`;
}

function renderIntegrationCard(integration: LiveIntegrationResult): string {
  const statusClass = integration.status.replace("_", "-");
  const checks = integration.checks
    .map((c) => {
      const icon = c.ok ? "✓" : "✗";
      const iconClass = c.ok ? "lip-check-ok" : "lip-check-fail";
      const liveTag = c.liveData ? `<span class="lip-live-tag">LIVE</span>` : "";
      return `<li><span class="${iconClass}">${icon}</span><div><strong>${esc(c.label)}</strong>${liveTag}<span class="lip-check-detail">${esc(c.detail)}</span></div></li>`;
    })
    .join("");

  return `<article class="lip-card status-${esc(integration.status)}">
<div class="lip-card-head">
<h3>${esc(integration.name)}</h3>
<span class="lip-badge ${esc(integration.status)}">${esc(STATUS_LABELS[integration.status] || integration.status)}</span>
</div>
<p class="lip-result">${esc(integration.testResult)}</p>
<p class="lip-meta">Last checked: ${esc(integration.lastCheckedAt.replace("T", " ").slice(0, 19))} UTC</p>
<p class="lip-unlocks"><strong>Unlocks:</strong> ${esc(integration.unlocks)}</p>
<p class="lip-action"><strong>Next action:</strong> ${esc(integration.nextAction)}</p>
<ul class="lip-checks">${checks}</ul>
${integration.artifactPath ? `<p class="lip-meta">Artifact: ${esc(integration.artifactPath)}</p>` : ""}
</article>`;
}

function countByStatus(report: LiveIntegrationProofReport, status: IntegrationStatusLabel): number {
  return report.integrations.filter((i) => i.status === status).length;
}

export function renderLiveIntegrationProofPage(slug: string, report: LiveIntegrationProofReport): string {
  const framework = buildGrowthEngineFramework(slug);
  const readyCount = countByStatus(report, "ready") + countByStatus(report, "connected");
  const limitedCount = countByStatus(report, "limited");
  const errorCount = countByStatus(report, "error");
  const notConnectedCount = countByStatus(report, "not_connected");

  const body = `<div class="lip-overall">
<h2>Live Integration Proof Report</h2>
<p>${report.overallReady ? "Core integrations are ready for end-to-end Growth Cycle testing." : "Some integrations need credentials or live tests before full end-to-end testing."} Checked ${esc(report.checkedAt.replace("T", " ").slice(0, 19))} UTC. No simulated data is shown as live on this page.</p>
</div>
<div class="lip-note">Run live tests to verify external connections. Credential-only checks show Limited until a live probe succeeds.</div>
<div class="lip-actions">
<button type="button" class="ge-btn ge-btn-primary" id="lipRunAll">Run all live tests</button>
<button type="button" class="ge-btn ge-btn-ghost" id="lipRefresh">Refresh status</button>
<a class="ge-btn ge-btn-ghost" href="/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}">← Growth Dashboard</a>
</div>
<p id="lipStatus" style="font-size:13px;color:#64748b;min-height:20px"></p>
<div class="lip-summary">
<div class="lip-summary-card"><strong>${readyCount}</strong><span>Ready / Connected</span></div>
<div class="lip-summary-card"><strong>${limitedCount}</strong><span>Limited</span></div>
<div class="lip-summary-card"><strong>${notConnectedCount}</strong><span>Not Connected</span></div>
<div class="lip-summary-card"><strong>${errorCount}</strong><span>Error</span></div>
</div>
<div class="lip-grid">${report.integrations.map(renderIntegrationCard).join("")}</div>
<script>
(function(){
  const slug = ${JSON.stringify(slug)};
  const status = document.getElementById('lipStatus');
  async function runLive(all) {
    if (status) status.textContent = 'Running live integration tests…';
    const params = new URLSearchParams({ live: all ? 'all' : '1' });
    try {
      const res = await fetch('/api/growth-engine/' + encodeURIComponent(slug) + '/live-integration-proof/run?' + params, {
        method: 'POST',
        headers: { Accept: 'application/json' }
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      } else if (status) {
        status.textContent = data.error || 'Test run failed';
      }
    } catch (e) {
      if (status) status.textContent = String(e);
    }
  }
  document.getElementById('lipRunAll')?.addEventListener('click', () => runLive(true));
  document.getElementById('lipRefresh')?.addEventListener('click', () => runLive(false));
})();
</script>`;

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Live Integration Proof · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${liveIntegrationProofCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:${commercialBlueChromeGradientCss()};color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Live Integration Proof</h1>
<p>Real external system status for ${esc(slug)} — credentials, connection tests, and what each integration unlocks.</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "dashboard", {
  prevUrl: `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`,
  nextLabel: "Growth Dashboard →",
})}
${body}
</div>
</body></html>`);
}
