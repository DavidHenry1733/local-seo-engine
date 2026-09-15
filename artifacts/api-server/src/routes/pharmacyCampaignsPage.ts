/**
 * Pharmacy Campaign Dashboard — main control centre for campaign execution.
 */
import { Router } from "express";
import type { ServiceCatalogEntry } from "../../../../src/pharmacy/pharmacyCampaignService.ts";
import {
  buildPharmacyCampaignControlCentre,
  resolveCampaignOsRoute,
  type PharmacyCampaignControlCentre,
  type PharmacyCampaignDetailView,
  type PharmacyCampaignEnriched,
} from "../../../../src/pharmacy/pharmacyCampaignControlCentreService.ts";
import type { CampaignLaunchQueueEntry } from "../../../../src/pharmacy/pharmacyCampaignLaunchQueueService.ts";
import type { CampaignImageSlotStatus } from "../../../../src/pharmacy/pharmacyCampaignImageStatusService.ts";
import type { CampaignOperatingSystem } from "../../../../src/pharmacy/pharmacyCampaignOperatingSystemService.ts";
import { formatOperatingSystemDate } from "../../../../src/pharmacy/pharmacyCampaignOperatingSystemService.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { PRIMARY_PLATFORM_SERVICE_ID } from "../../../../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { buildPlainCampaignStatus } from "../../../../src/pharmacy/pharmacyCampaignStatusUi.ts";
import { getCampaignStaleStatus } from "../../../../src/pharmacy/pharmacyCampaignStaleService.ts";
import { getCampaignCoverageSummary } from "../../../../src/pharmacy/pharmacyCampaignService.ts";
import type {
  PlatformOperationalWorkflow,
  ImageCentreServiceRow,
  EcosystemExpansionRow,
  PublishingWorkflowService,
  CompetitorGapServiceInsight,
  OpportunityGroup,
  CampaignRecommendation,
} from "../../../../src/pharmacy/pharmacyPlatformOperationalWorkflowService.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../../../../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import { getAuthoritySummaryForCampaign } from "../../../../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function safeSlug(v: string): string {
  return (
    String(v || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

const SHARED_CSS = `
:root{--primary:PLACEHOLDER_PRIMARY}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#003087,var(--primary));color:#fff;padding:24px 28px}
header h1{margin:0;font-size:26px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.toolbar a{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;text-decoration:none;cursor:pointer;background:rgba(255,255,255,.15);color:#fff}
.toolbar .primary{background:#fff;color:var(--primary)}
main{max-width:1180px;margin:24px auto 48px;padding:0 20px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;margin-bottom:16px}
.panel h2{margin:0 0 6px;font-size:18px}
.panel h3{margin:16px 0 8px;font-size:15px}
.panel .lead{margin:0 0 16px;color:#64748b;font-size:13px}
.campaign-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.campaign-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#f8fafc}
.campaign-card-head h3{margin:0 0 4px;font-size:16px}
.campaign-card-steps{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.service-row.has-campaign{opacity:.55}
.stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}
.stat-chip{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:12px}
.stat-chip strong{display:block;font-size:20px;color:var(--primary)}
.steps{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.step-pill{padding:8px 12px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:800}
.step-pill.active{background:var(--primary);color:#fff}
.step-pill.done{background:#dcfce7;color:#166534}
.wizard-step{display:none}
.wizard-step.active{display:block}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-bottom:1px solid #e2e8f0;padding:10px 8px;text-align:left;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.service-row{cursor:pointer}
.service-row:hover{background:#f8fafc}
.service-row.selected{background:#eff6ff}
.badge{display:inline-block;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;text-transform:capitalize}
.badge.ok{background:#dcfce7;color:#166534}
.badge.warn{background:#fef3c7;color:#92400e}
.badge.missing{background:#fee2e2;color:#b91c1c}
.muted{color:#64748b;font-size:12px}
.mono{font-family:ui-monospace,monospace;font-size:11px}
.output-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.output-item{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#fafbfc;font-size:13px}
.output-item.available{border-color:#86efac;background:#f0fdf4}
.output-item .tick{color:#16a34a;font-weight:800}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.summary-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;background:#f8fafc}
.summary-card strong{display:block;font-size:22px;color:var(--primary)}
.wizard-nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.btn,.btn-xs{border:0;border-radius:8px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;display:inline-block}
.btn{background:var(--primary);color:#fff}
.btn.secondary{background:#e2e8f0;color:#0f172a}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-xs{background:#eff6ff;color:#1d4ed8;padding:6px 10px;font-size:11px;margin:2px}
.btn-xs.danger{background:#fee2e2;color:#b91c1c}
.btn-xs.placeholder{background:#f1f5f9;color:#64748b;cursor:default}
select.goal-select{width:100%;max-width:420px;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font-size:14px}
.actions{white-space:nowrap}
.next-action{max-width:220px;font-size:12px;color:#475569}
.stage{display:inline-block;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800;text-transform:capitalize}
.stage.draft{background:#f1f5f9;color:#64748b}
.stage.ready{background:#dbeafe;color:#1d4ed8}
.stage.publishing{background:#fef3c7;color:#92400e}
.stage.published{background:#e0e7ff;color:#4338ca}
.stage.indexing{background:#fce7f3;color:#9d174d}
.stage.visible{background:#dcfce7;color:#166534}
.stage.complete{background:#bbf7d0;color:#14532d}
.exec-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}
.exec-summary-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;font-size:13px}
.exec-summary-card strong{display:block;font-size:18px;color:var(--primary);margin-top:4px}
.progress-bar{height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px}
.progress-fill{height:100%;background:var(--primary);border-radius:999px}
.exec-next{background:#eff6ff;border:1px solid #dbeafe;border-radius:10px;padding:12px 14px;margin-bottom:16px}
.exec-next p{margin:6px 0 0;font-size:13px;color:#1e3a8a}
.exec-tracks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.exec-track{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff;font-size:13px}
.exec-count{font-size:24px;font-weight:900;color:var(--primary);margin:6px 0}
.status-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px}
.status-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff}
.status-card strong{display:block;font-size:16px;margin-top:4px}
.image-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.image-slot{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fafbfc;font-size:12px}
.image-slot.assigned{border-color:#86efac;background:#f0fdf4}
.image-slot.missing{border-color:#fecaca;background:#fef2f2}
.image-thumb{width:100%;height:72px;border-radius:6px;background:#e2e8f0;object-fit:cover;margin-bottom:8px;display:block}
.image-thumb.empty{display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px}
.checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.check-item{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px}
.task-status{font-size:10px;font-weight:800;text-transform:uppercase;padding:2px 6px;border-radius:999px}
.task-status.complete{background:#dcfce7;color:#166534}
.task-status.pending{background:#fef3c7;color:#92400e}
.task-status.in_progress{background:#dbeafe;color:#1d4ed8}
.task-status.blocked{background:#fee2e2;color:#b91c1c}
.detail-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.detail-nav a{padding:8px 12px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:700;text-decoration:none}
.detail-nav a.active{background:var(--primary);color:#fff}
.os-hero{border:2px solid var(--primary);background:linear-gradient(180deg,#f8fafc,#fff)}
.health-ring{display:flex;align-items:center;gap:16px;margin-bottom:16px}
.health-score{font-size:48px;font-weight:900;color:var(--primary);line-height:1}
.health-label{display:inline-block;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:800}
.health-label.excellent{background:#dcfce7;color:#166534}
.health-label.good{background:#dbeafe;color:#1d4ed8}
.health-label.building{background:#fef3c7;color:#92400e}
.health-label.attention{background:#fee2e2;color:#b91c1c}
.readiness-banner{border-radius:10px;padding:12px 14px;margin-bottom:16px;font-weight:700}
.readiness-banner.ready{background:#dcfce7;color:#166534;border:1px solid #86efac}
.readiness-banner.blocked{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}
.readiness-banner.preview{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
.pub-blocked{background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;margin-bottom:14px;color:#991b1b}
.timeline{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.timeline-step{flex:1;min-width:120px;border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff;font-size:11px}
.timeline-step.complete{border-color:#86efac;background:#f0fdf4}
.timeline-step.current{border-color:var(--primary);background:#eff6ff;box-shadow:0 0 0 2px rgba(0,48,135,.12)}
.timeline-step.pending{opacity:.7}
.timeline-step strong{display:block;font-size:12px;margin-bottom:4px}
.inventory-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.inventory-item{border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:12px;background:#fafbfc}
.inventory-item.available{border-color:#86efac;background:#f0fdf4}
.performance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.performance-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff}
.performance-card strong{display:block;font-size:22px;color:var(--primary);margin-top:4px}
.portfolio-secondary{opacity:.95}
.portfolio-secondary summary{cursor:pointer;font-weight:700;padding:4px 0}
.factor-bars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:12px}
.factor-bar{font-size:11px}
.factor-bar .progress-bar{margin-top:4px;height:4px}
tr.archived{opacity:.65}
.workflow-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}
.workflow-strip .stat-chip{text-align:center}
.slot-dots{display:flex;gap:4px;margin-top:4px}
.slot-dot{width:10px;height:10px;border-radius:50%;background:#fecaca}
.slot-dot.assigned{background:#86efac}
.gap-high{color:#b91c1c;font-weight:800}
.gap-medium{color:#92400e;font-weight:800}
.gap-low{color:#166534;font-weight:800}
.opp-group{margin-bottom:14px}
.opp-item{border-left:3px solid #e2e8f0;padding:8px 12px;margin-bottom:8px;background:#fafbfc;border-radius:0 8px 8px 0;font-size:12px}
.opp-item.high{border-left-color:#b91c1c}
.opp-item.medium{border-left-color:#d97706}
.opp-item.low{border-left-color:#64748b}
.pub-pipeline{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.pub-stage{flex:1;min-width:100px;border:1px solid #e2e8f0;border-radius:8px;padding:8px;font-size:11px;background:#fff}
.pub-stage.complete{border-color:#86efac;background:#f0fdf4}
.pub-stage.current{border-color:var(--primary);background:#eff6ff;font-weight:700}
.pub-stage.pending{opacity:.65}
.compact-list{margin:0;padding-left:16px;font-size:11px;color:#64748b}
.compact-list li{margin-bottom:4px}
.stale-campaign-warning{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px 18px;margin-bottom:16px;color:#92400e;font-size:14px;font-weight:600}
.stale-profile-banner{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px 18px;margin:12px 0;color:#92400e}
.plain-status-strip{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.plain-status{font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#64748b}
.plain-status.done{background:#d1fae5;color:#065f46}
.campaign-coverage-banner{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:16px}
@media(max-width:900px){.stat-grid,.output-grid,.summary-grid,.exec-summary,.exec-tracks,.status-strip,.image-grid,.checklist,.inventory-grid,.performance-grid,.factor-bars,.timeline,.workflow-strip{grid-template-columns:1fr}}
`;

function cssBlock(primaryColor: string): string {
  return SHARED_CSS.replace("PLACEHOLDER_PRIMARY", esc(primaryColor)) + platformPlatformNavCss();
}

function readinessBadge(value: string, goodValues: string[]): string {
  const ok = goodValues.includes(value);
  return `<span class="badge ${ok ? "ok" : "warn"}">${esc(value.replace(/_/g, " "))}</span>`;
}

function stageBadgeClass(stage: string): string {
  if (stage === "complete") return "stage complete";
  if (stage === "visible") return "stage visible";
  if (stage === "indexing") return "stage indexing";
  if (stage === "published") return "stage published";
  if (stage === "publishing") return "stage publishing";
  if (stage === "ready") return "stage ready";
  return "stage draft";
}

function taskStatusClass(status: string): string {
  return `task-status ${esc(status.replace(/ /g, "_"))}`;
}

function renderImageSlot(slot: CampaignImageSlotStatus, slug: string, serviceId: string, campaignId?: string): string {
  const cls = slot.status === "assigned" ? "image-slot assigned" : slot.status === "pending" ? "image-slot pending" : "image-slot missing";
  const thumb = slot.previewUrl
    ? `<img class="image-thumb" src="${esc(slot.previewUrl)}" alt="${esc(slot.alt)}" loading="lazy"/>`
    : `<div class="image-thumb empty">${slot.status === "pending" ? "AI pending" : "No preview"}</div>`;
  const libUrl = `/api/pharmacy-image-library/diagnostics?slug=${esc(slug)}&service=${esc(serviceId)}&slot=${esc(slot.slot)}${campaignId ? `&campaignId=${esc(campaignId)}` : ""}`;
  const sourceLabel = slot.sourceType || (slot.assigned ? "library" : "missing");
  return `<div class="${cls}">
  <strong>${esc(slot.label)}</strong>
  <span class="badge ${slot.status === "assigned" ? "ok" : slot.status === "pending" ? "warn" : "missing"}">${esc(slot.status)}</span>
  <span class="muted">${esc(sourceLabel)}</span>
  ${thumb}
  <div class="muted mono">${esc(slot.sourcePath)}</div>
  <div class="muted">${esc(slot.libraryRef)}</div>
  <a class="btn-xs" href="${libUrl}">Change image</a>
</div>`;
}

function renderImageGrid(slots: CampaignImageSlotStatus[], slug: string, serviceId: string, campaignId?: string): string {
  if (!slots.length) return `<p class="muted">No image slots configured.</p>`;
  return `<div class="image-grid">${slots.map((s) => renderImageSlot(s, slug, serviceId, campaignId)).join("")}</div>`;
}

function renderImageSourceBreakdown(campaign: PharmacyCampaignEnriched): string {
  const b = campaign.imageSourceBreakdown;
  if (!b) return "";
  const missing = b.missingSlots.length ? `<span class="muted">Missing: ${b.missingSlots.join(", ")}</span>` : "";
  return `<div class="stat-grid" style="margin-bottom:12px">
  <div class="stat-chip"><strong>${b.library}</strong> library</div>
  <div class="stat-chip"><strong>${b.upload}</strong> upload</div>
  <div class="stat-chip"><strong>${b.ai}</strong> AI</div>
  <div class="stat-chip"><strong>${b.pending}</strong> pending</div>
  <div class="stat-chip"><strong>${b.missing}</strong> missing</div>
</div>${missing}`;
}

function renderAssetChecklist(campaign: PharmacyCampaignEnriched): string {
  return `<div class="checklist">${campaign.assetChecklist
    .map(
      (item) => `<div class="check-item">
  <div><strong>${esc(item.label)}</strong><div class="muted">${esc(item.detail)}</div></div>
  <span class="badge ${item.status === "complete" ? "ok" : item.status === "pending" ? "warn" : "missing"}">${esc(item.status)}</span>
</div>`,
    )
    .join("")}</div>`;
}

function renderPlainStatusStrip(campaign: PharmacyCampaignEnriched): string {
  const items = buildPlainCampaignStatus(campaign);
  return `<div class="plain-status-strip">${items
    .map(
      (item) =>
        `<span class="plain-status ${item.done ? "done" : "pending"}">${item.done ? "✓" : "○"} ${esc(item.label)}</span>`,
    )
    .join("")}</div>`;
}

function renderStaleProfileBanner(campaign: PharmacyCampaignEnriched, slug: string): string {
  const stale = getCampaignStaleStatus(slug, campaign);
  if (!stale.isStale) return "";
  return `<div class="stale-profile-banner" role="alert">
  <strong>Profile updated</strong>
  <p>Campaign requires regeneration to use your latest profile, branding and review details.</p>
  <button type="button" class="btn btn-regenerate" data-slug="${esc(slug)}" data-campaign-id="${esc(campaign.id)}">Regenerate Page</button>
</div>`;
}

function renderStatusStrip(campaign: PharmacyCampaignEnriched, slug: string): string {
  return `${renderStaleProfileBanner(campaign, slug)}${renderPlainStatusStrip(campaign)}`;
}

function renderLaunchQueuePreview(queue: CampaignLaunchQueueEntry | null, slug: string): string {
  if (!queue) {
    return `<section class="panel"><h2>Launch Queue</h2><p class="lead muted">Create a campaign to generate the operational launch checklist.</p></section>`;
  }
  const taskRows = queue.tasks
    .map(
      (t) => `<tr>
  <td><span class="${taskStatusClass(t.status)}">${esc(t.status.replace(/_/g, " "))}</span></td>
  <td>${esc(t.title)}</td>
  <td>${esc(t.category)}</td>
  <td><a class="btn-xs" href="${esc(t.linkedUrl)}">${esc(t.linkedModule)}</a></td>
</tr>`,
    )
    .join("");

  return `<section class="panel" id="launch-queue">
  <h2>Launch Queue</h2>
  <p class="lead">Operational checklist for <strong>${esc(queue.serviceName)}</strong> — ${queue.completeTasks}/${queue.totalTasks} complete.</p>
  <div class="stat-grid">
    <div class="stat-chip"><strong>${queue.totalTasks}</strong> total tasks</div>
    <div class="stat-chip"><strong>${queue.completeTasks}</strong> complete</div>
    <div class="stat-chip"><strong>${queue.blockedTasks}</strong> blocked</div>
    <div class="stat-chip"><strong>${queue.progressPct}%</strong> progress</div>
  </div>
  <div class="exec-next">
    <strong>Next launch task</strong>
    <p>${queue.nextLaunchTask ? esc(queue.nextLaunchTask.title) : "All launch tasks complete"}</p>
  </div>
  <table>
    <thead><tr><th>Status</th><th>Task</th><th>Category</th><th>Module</th></tr></thead>
    <tbody>${taskRows}</tbody>
  </table>
  <p style="margin-top:14px">
    <a class="btn" href="/api/pharmacy-campaign-launch-queue?slug=${esc(slug)}&campaignId=${esc(queue.campaignId)}">Open Full Launch Queue</a>
    <a class="btn secondary" href="/api/pharmacy-campaigns?slug=${esc(slug)}&campaignId=${esc(queue.campaignId)}">Campaign detail</a>
  </p>
</section>`;
}

function healthLabelClass(label: string): string {
  if (label === "Excellent") return "excellent";
  if (label === "Good") return "good";
  if (label === "Building") return "building";
  return "attention";
}

function renderHealthScore(os: CampaignOperatingSystem): string {
  const factors = os.health.factors
    .map(
      (f) => `<div class="factor-bar">
  <span>${esc(f.label)} · ${f.score}%</span>
  <div class="progress-bar"><div class="progress-fill" style="width:${f.score}%"></div></div>
</div>`,
    )
    .join("");
  return `<div class="health-ring">
  <div>
    <div class="health-score">${os.health.score}</div>
    <span class="health-label ${healthLabelClass(os.health.label)}">${esc(os.health.label)}</span>
  </div>
  <div style="flex:1">
    <strong>Campaign Health Score</strong>
    <p class="muted">Composite score from profile, images, ecosystem, publishing, indexing, visibility and launch queue.</p>
    <div class="factor-bars">${factors}</div>
  </div>
</div>`;
}

function renderReadiness(os: CampaignOperatingSystem): string {
  const cls =
    os.readiness.status === "ready_to_launch"
      ? "ready"
      : os.readiness.status === "preview_ready"
        ? "preview"
        : "blocked";
  const blockers =
    os.readiness.blockers.length > 0
      ? `<ul style="margin:8px 0 0;padding-left:18px;font-weight:500">${os.readiness.blockers.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : `<p class="muted" style="margin:8px 0 0">All launch prerequisites met.</p>`;
  const livePublish = `<div class="muted" style="margin-top:8px"><strong>Live publish:</strong> ${esc(os.readiness.livePublishLabel)}</div>`;
  return `<div class="readiness-banner ${cls}">
  <strong>${esc(os.readiness.label)}</strong>
  ${livePublish}
  ${blockers}
</div>`;
}

function renderCampaignAuthorityPanel(campaign: PharmacyCampaignEnriched, slug: string): string {
  return `<div class="authority-panel" style="margin-top:16px;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc">
  <h3 style="margin:0 0 8px">Content Review</h3>
  <p class="muted" style="margin:0 0 10px">Check your page is ready before publishing — every item includes a fix button.</p>
  <a class="btn-xs" href="${esc(campaign.authorityAuditUrl)}">Open Content Review</a>
  <a class="btn-xs" href="/api/pharmacy-enhancement-workspace?slug=${esc(slug)}&service=${esc(campaign.serviceId)}" style="margin-left:8px">Campaign Improvements</a>
</div>`;
}

function renderTimeline(os: CampaignOperatingSystem): string {
  const steps = os.timeline
    .map(
      (step) => `<div class="timeline-step ${esc(step.status)}">
  <strong>${esc(step.label)}</strong>
  <div class="muted">${step.status === "complete" || step.status === "current" ? formatOperatingSystemDate(step.dateAchieved) : "Pending"}</div>
  ${step.nextMilestone ? `<div class="muted">Next: ${esc(step.nextMilestone)}</div>` : ""}
</div>`,
    )
    .join("");
  return `<div class="timeline">${steps}</div>`;
}

function renderAssetInventory(os: CampaignOperatingSystem): string {
  return `<div class="inventory-grid">${os.assetInventory
    .map(
      (item) => `<div class="inventory-item ${item.status}">
  <strong>${esc(item.label)}</strong>
  <div><span class="badge ${item.status === "available" ? "ok" : "missing"}">${esc(item.status)}</span></div>
  <div class="muted">${item.count} · ${esc(item.source)}</div>
</div>`,
    )
    .join("")}</div>`;
}

function renderPerformancePanel(os: CampaignOperatingSystem): string {
  const p = os.performance;
  return `<div class="performance-grid">
  <div class="performance-card"><span class="muted">Published pages</span><strong>${p.publishedPages}</strong><a class="btn-xs" href="${esc(p.links.publishing)}">Publishing</a></div>
  <div class="performance-card"><span class="muted">Indexed pages</span><strong>${p.indexedPages}</strong><a class="btn-xs" href="${esc(p.links.indexing)}">Indexing</a></div>
  <div class="performance-card"><span class="muted">Visibility score</span><strong>${p.visibilityScore}</strong><a class="btn-xs" href="${esc(p.links.visibility)}">Visibility</a></div>
  <div class="performance-card"><span class="muted">Open actions</span><strong>${p.openActions}</strong><a class="btn-xs" href="${esc(p.links.growthActions)}">Growth actions</a></div>
</div>`;
}

function renderSlotDots(slots: ImageCentreServiceRow["slots"]): string {
  return `<div class="slot-dots">${slots
    .map((s) => `<span class="slot-dot ${s.assigned ? "assigned" : ""}" title="${esc(s.label)}"></span>`)
    .join("")}</div>`;
}

function renderWhereYouAre(wf: PlatformOperationalWorkflow): string {
  const w = wf.whereYouAre;
  return `<section class="panel" id="where-you-are">
  <h2>Where you are</h2>
  <p class="lead">${esc(w.headline)}</p>
  <div class="workflow-strip">
    <div class="stat-chip"><span class="muted">Ecosystems</span><strong>${w.ecosystemCount}/${w.totalServices}</strong></div>
    <div class="stat-chip"><span class="muted">Image completion</span><strong>${w.imageCompletionPct}%</strong></div>
    <div class="stat-chip"><span class="muted">Publishing stage</span><strong>${esc(w.publishingStage)}</strong></div>
    <div class="stat-chip"><span class="muted">Open actions</span><strong>${w.openActions}</strong></div>
    <div class="stat-chip"><span class="muted">Top opportunity</span><strong style="font-size:13px">${esc(w.topOpportunity || "—")}</strong></div>
  </div>
</section>`;
}

function renderImageCentre(wf: PlatformOperationalWorkflow, slug: string): string {
  const rows = wf.imageCentre.services
    .map(
      (row) => `<tr>
  <td><strong>${esc(row.serviceName)}</strong><div class="muted mono">${esc(row.serviceId)}</div></td>
  <td>${renderSlotDots(row.slots)}<div class="muted">${row.slots.map((s) => `${s.label[0]}:${s.assigned ? "✓" : "—"}`).join(" ")}</div></td>
  <td>${row.assignedCount}/${row.totalSlots}</td>
  <td><strong>${row.completionPct}%</strong><div class="progress-bar"><div class="progress-fill" style="width:${row.completionPct}%"></div></div></td>
  <td><a class="btn-xs" href="/api/pharmacy-image-library/diagnostics?slug=${esc(slug)}&service=${esc(row.serviceId)}">Assign images</a></td>
</tr>`,
    )
    .join("");
  return `<section class="panel" id="image-centre">
  <h2>Campaign Image Centre</h2>
  <p class="lead">Hero, Support, Trust and Conversion image status across all benchmark services — ${wf.imageCentre.fullyAssignedCount} fully assigned · ${wf.imageCentre.averageCompletionPct}% average completion.</p>
  <table>
    <thead><tr><th>Service</th><th>Slots</th><th>Assigned</th><th>Completion</th><th>Campaign</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function renderEcosystemExpansion(wf: PlatformOperationalWorkflow): string {
  const rows = wf.ecosystemExpansion
    .map(
      (row: EcosystemExpansionRow) => `<tr>
  <td><strong>${esc(row.serviceName)}</strong></td>
  <td><span class="badge ${row.ecosystemAvailability === "available" ? "ok" : "missing"}">${esc(row.ecosystemLabel)}</span> · ${row.ecosystemAssetCount} assets</td>
  <td>${readinessBadge(row.publishedStatus, ["published", "partial"])}</td>
  <td>${readinessBadge(row.indexingStatus, ["indexed", "submitted"])}</td>
  <td>${readinessBadge(row.visibilityStatus, ["visible", "building"])}</td>
  <td><a class="btn-xs" href="${esc(row.previewUrl)}" target="_blank" rel="noopener">Preview</a></td>
</tr>`,
    )
    .join("");
  const available = wf.ecosystemExpansion.filter((e) => e.ecosystemAvailability === "available").length;
  return `<section class="panel" id="ecosystem-expansion">
  <h2>Ecosystem Expansion</h2>
  <p class="lead">${available}/${wf.ecosystemExpansion.length} benchmark services with content ecosystems — published, indexing and visibility from live bridge data.</p>
  <table>
    <thead><tr><th>Service</th><th>Ecosystem</th><th>Published</th><th>Indexing</th><th>Visibility</th><th>Preview</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function renderPublishingPipeline(service: PublishingWorkflowService): string {
  return `<div class="pub-pipeline">${service.stages
    .map(
      (st) => `<div class="pub-stage ${esc(st.status)}">
  <strong>${esc(st.label)}</strong>
  <div class="muted">${st.status === "current" ? "Current" : st.status === "complete" ? "Done" : "Pending"}</div>
</div>`,
    )
    .join("")}</div>`;
}

function renderPublishingWorkflow(wf: PlatformOperationalWorkflow, primaryServiceId?: string): string {
  const primary = wf.publishingWorkflow.find((p) => p.serviceId === primaryServiceId) || wf.publishingWorkflow[0];
  const primaryBlocked = primary?.livePublishBlocked
    ? `<div class="pub-blocked"><strong>Live publish blocked</strong><p style="margin:6px 0 0">Reason: ${esc(primary.livePublishBlockReason || "Authority & AI Readiness has unresolved blockers.")}</p></div>`
    : "";
  const primaryBlock = primary
    ? `<div class="exec-next">
  <strong>${esc(primary.serviceName)} — ${esc(primary.currentStageLabel)}</strong>
  ${primaryBlocked}
  <p><strong>Next:</strong> ${esc(primary.nextAction)}</p>
  <p class="muted"><strong>Expected outcome:</strong> ${esc(primary.expectedOutcome)}</p>
  ${renderPublishingPipeline(primary)}
</div>`
    : "";
  const rows = wf.publishingWorkflow
    .map(
      (row: PublishingWorkflowService) => `<tr${row.serviceId === primary?.serviceId ? ' style="background:#eff6ff"' : ""}>
  <td><strong>${esc(row.serviceName)}</strong>${row.livePublishBlocked ? `<div class="muted" style="color:#991b1b;font-weight:600">Live publish blocked</div>` : ""}</td>
  <td><span class="stage ${row.currentStage === "visible" ? "visible" : row.currentStage === "ready" ? "ready" : "published"}">${esc(row.currentStageLabel)}</span></td>
  <td class="next-action">${esc(row.nextAction)}</td>
  <td class="muted">${esc(row.expectedOutcome)}</td>
</tr>`,
    )
    .join("");
  return `<section class="panel" id="publishing-workflow">
  <h2>Publishing Workflow</h2>
  <p class="lead">Ready → Published → Submitted → Indexed → Visible — current stage, next action and expected outcome per service. Live publish and indexing require Authority &amp; AI Readiness PASS.</p>
  ${primaryBlock}
  <table>
    <thead><tr><th>Service</th><th>Stage</th><th>Next action</th><th>Expected outcome</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}

function renderCompetitorGaps(wf: PlatformOperationalWorkflow): string {
  const cg = wf.competitorGaps;
  const rows = cg.services
    .map(
      (row: CompetitorGapServiceInsight) => `<tr>
  <td><strong>${esc(row.serviceName)}</strong><span class="gap-${esc(row.gapLevel)}"> · ${esc(row.gapLevel)} gap</span></td>
  <td>${row.competitorCoveragePct}% competitor coverage</td>
  <td>${esc(row.whyCompetitorRanks)}</td>
  <td><ul style="margin:0;padding-left:16px;font-size:12px">${row.missingAssets.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></td>
  <td>${esc(row.recommendedAction)}</td>
</tr>`,
    )
    .join("");
  return `<section class="panel" id="competitor-gaps">
  <h2>Competitor Gap Analysis</h2>
  <p class="lead">${esc(cg.serviceGapSummary)}</p>
  <p class="muted">${esc(cg.visibilityGapSummary)}</p>
  <table>
    <thead><tr><th>Service</th><th>Competition</th><th>Why competitor ranks</th><th>Missing assets</th><th>Recommended action</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted">Run competitor intelligence to populate gap analysis.</td></tr>`}</tbody>
  </table>
  <p style="margin-top:12px"><a class="btn secondary" href="${esc(cg.dashboardUrl)}">Full competitor dashboard</a></p>
</section>`;
}

function renderOpportunityGroup(group: OpportunityGroup): string {
  const cls = group.priority.toLowerCase();
  return `<div class="opp-group">
  <h3>${esc(group.priority)} priority (${group.opportunities.length})</h3>
  ${group.opportunities.length ? group.opportunities.map((o) => `<div class="opp-item ${cls}">
  <strong>${esc(o.title)}</strong>
  <div class="muted">${esc(o.category)} · ${esc(o.impact)}</div>
  <div>${esc(o.action)}</div>
  ${o.relatedServices.length ? `<div class="muted mono">${o.relatedServices.map(esc).join(", ")}</div>` : ""}
</div>`).join("") : `<p class="muted">No ${esc(group.priority.toLowerCase())} priority opportunities.</p>`}
</div>`;
}

function renderOpportunityEngine(wf: PlatformOperationalWorkflow): string {
  const opp = wf.opportunities;
  const recRows = opp.campaignRecommendations
    .map(
      (r: CampaignRecommendation) => `<tr>
  <td><strong>${esc(r.serviceName)}</strong></td>
  <td><span class="gap-${r.priority === "High" ? "high" : "medium"}">${esc(r.priority)}</span></td>
  <td>${esc(r.reason)}</td>
  <td>${esc(r.action)}</td>
</tr>`,
    )
    .join("");
  const coverageGaps = opp.serviceCoverageGaps
    .slice(0, 6)
    .map((g) => `<li><strong>${esc(g.serviceName)}</strong> — ${g.competitorCoveragePct}% competitor coverage · <span class="gap-${esc(g.gapLevel)}">${esc(g.gapLevel)}</span></li>`)
    .join("");
  return `<section class="panel" id="opportunity-engine">
  <h2>Opportunity Engine</h2>
  <p class="lead">${opp.total} opportunities — Critical ${opp.critical} · High ${opp.high} · Medium ${opp.medium} · Low ${opp.low}</p>
  <div class="stat-grid">
    <div class="stat-chip"><span class="muted">High / Critical</span><strong>${opp.critical + opp.high}</strong></div>
    <div class="stat-chip"><span class="muted">Medium</span><strong>${opp.medium}</strong></div>
    <div class="stat-chip"><span class="muted">Low</span><strong>${opp.low}</strong></div>
    <div class="stat-chip"><span class="muted">Coverage gaps</span><strong>${opp.serviceCoverageGaps.length}</strong></div>
  </div>
  ${opp.groups.map(renderOpportunityGroup).join("")}
  <h3>Service coverage gaps</h3>
  <ul style="font-size:13px">${coverageGaps || "<li class=\"muted\">No coverage gaps detected.</li>"}</ul>
  <h3>Visibility gaps</h3>
  <ul style="font-size:13px">${opp.visibilityGaps.map((v) => `<li>${esc(v)}</li>`).join("") || "<li class=\"muted\">No visibility gaps recorded.</li>"}</ul>
  <h3>Campaign recommendations</h3>
  <table>
    <thead><tr><th>Service</th><th>Priority</th><th>Reason</th><th>Action</th></tr></thead>
    <tbody>${recRows || `<tr><td colspan="4" class="muted">No campaign recommendations yet.</td></tr>`}</tbody>
  </table>
  <p style="margin-top:12px"><a class="btn secondary" href="${esc(opp.dashboardUrl)}">Growth actions dashboard</a></p>
</section>`;
}

function renderAuthorityReadinessSection(dashboard: PharmacyCampaignControlCentre): string {
  const slug = dashboard.slug;
  const rows = dashboard.campaigns
    .filter((c) => c.status === "active")
    .map((c) => {
      const gateCls = c.authorityPublishGate === "PASS" ? "ok" : c.authorityPublishGate === "PASS_WITH_RECOMMENDATIONS" ? "warn" : "missing";
      const blockers = c.authorityTopBlockers.map((m) => `<li>${esc(m)}</li>`).join("") || "<li class=\"muted\">No major blockers</li>";
      const liveLabel = c.authorityLivePublishReady ? "Ready" : "Not Ready For Live Publish";
      return `<tr>
  <td><strong>${esc(c.serviceName)}</strong><div class="muted mono">${esc(c.serviceId)}</div></td>
  <td><strong>${c.authorityScore}</strong> · ${esc(c.authorityLabel)}</td>
  <td><span class="badge ${gateCls}">${esc(c.authorityPublishGate.replace(/_/g, " "))}</span></td>
  <td>${esc(liveLabel)}<div class="muted" style="font-size:11px;margin-top:4px">${esc(c.authorityLaunchImpact)}</div></td>
  <td><ul class="compact-list">${blockers}</ul></td>
  <td><a class="btn-xs" href="${esc(c.authorityAuditUrl)}">View Full Authority Audit</a></td>
</tr>`;
    })
    .join("");

  const visualRows = VISUAL_EXPERIENCE_BENCHMARK_SERVICES.map((serviceId) => {
    const campaign = dashboard.campaigns.find((c) => c.serviceId === serviceId);
    if (campaign) return "";
    const summary = getAuthoritySummaryForCampaign(slug, serviceId);
    const gateCls = summary.publishGate === "PASS" ? "ok" : summary.publishGate === "PASS_WITH_RECOMMENDATIONS" ? "warn" : "missing";
    const blockers = summary.topBlockers.map((m) => `<li>${esc(m)}</li>`).join("") || "<li class=\"muted\">No major blockers</li>";
    const liveLabel = summary.livePublishReady ? "Ready" : "Not Ready For Live Publish";
    return `<tr>
  <td><strong>${esc(serviceId.replace(/-/g, " "))}</strong><div class="muted mono">${esc(serviceId)}</div></td>
  <td><strong>${summary.overallScore}</strong> · ${esc(summary.label)}</td>
  <td><span class="badge ${gateCls}">${esc(summary.publishGate.replace(/_/g, " "))}</span></td>
  <td>${esc(liveLabel)}<div class="muted" style="font-size:11px;margin-top:4px">${esc(summary.launchImpact)}</div></td>
  <td><ul class="compact-list">${blockers}</ul></td>
  <td><a class="btn-xs" href="${esc(summary.auditUrl)}">View Full Authority Audit</a></td>
</tr>`;
  }).join("");

  return `<section class="panel" id="authority-readiness">
  <h2>Authority &amp; AI Readiness</h2>
  <p class="lead">Publish-readiness audit for E-E-A-T, local authority, information gain and AI citation signals — final gate before live publication.</p>
  <table>
    <thead><tr><th>Service</th><th>Score / Label</th><th>Publish gate</th><th>Launch impact</th><th>Top blockers</th><th>Audit</th></tr></thead>
    <tbody>${rows}${visualRows}</tbody>
  </table>
  <p style="margin-top:14px"><a class="btn" href="/api/pharmacy-authority-readiness?slug=${esc(slug)}">Open full audit dashboard</a></p>
</section>`;
}

function renderAuthorityEnhancementSection(dashboard: PharmacyCampaignControlCentre): string {
  const slug = dashboard.slug;
  const activeCampaigns = dashboard.campaigns.filter((c) => c.status === "active");
  const rows = activeCampaigns
    .map((c) => {
      const topRecs = c.enhancementTopRecommendations
        .slice(0, 3)
        .map((r) => `<li>${esc(r.title)} <span class="muted">· ${esc(r.difficulty)} · ${esc(r.estimatedImpact)}</span></li>`)
        .join("") || "<li class=\"muted\">No recommendations</li>";
      return `<tr>
  <td><strong>${esc(c.serviceName)}</strong></td>
  <td><strong>${c.enhancementCurrentScore}</strong> → ${c.enhancementPotentialScore}</td>
  <td>${c.enhancementTotalRecommendations}</td>
  <td>${c.enhancementEasyWins}</td>
  <td>${c.enhancementHighImpact}</td>
  <td>+${c.enhancementEstimatedImprovement}</td>
  <td><ul class="compact-list">${topRecs}</ul></td>
  <td><a class="btn-xs" href="${esc(c.enhancementUrl)}">View enhancements</a></td>
</tr>`;
    })
    .join("");

  const summary = activeCampaigns.reduce(
    (acc, c) => ({
      current: acc.current + c.enhancementCurrentScore,
      potential: acc.potential + c.enhancementPotentialScore,
      recs: acc.recs + c.enhancementTotalRecommendations,
      easy: acc.easy + c.enhancementEasyWins,
      high: acc.high + c.enhancementHighImpact,
      improvement: acc.improvement + c.enhancementEstimatedImprovement,
    }),
    { current: 0, potential: 0, recs: 0, easy: 0, high: 0, improvement: 0 },
  );
  const n = activeCampaigns.length || 1;

  const top10 = activeCampaigns
    .flatMap((c) => c.enhancementTopRecommendations.map((r) => ({ ...r, serviceName: c.serviceName })))
    .slice(0, 10)
    .map(
      (r) => `<tr>
  <td><strong>${esc(r.title)}</strong><div class="muted">${esc(r.serviceName)}</div></td>
  <td>${esc(r.difficulty)}</td>
  <td>${esc(r.estimatedImpact)}</td>
  <td>+${r.estimatedScoreGain} / +${r.estimatedAiGain} AI / +${r.estimatedVisibilityGain} local</td>
  <td><a class="btn-xs" href="${esc(r.linkedUrl)}">${esc(r.linkedModule)}</a></td>
</tr>`,
    )
    .join("");

  return `<section class="panel" id="authority-enhancement">
  <h2>Authority Enhancement Opportunities</h2>
  <p class="lead">AI Quality Consultant — exactly how to improve authority, E-E-A-T, AI citation and local visibility without modifying content.</p>
  <div class="stat-grid">
    <div class="stat-chip"><span class="muted">Current authority</span><strong>${Math.round(summary.current / n)}</strong></div>
    <div class="stat-chip"><span class="muted">Potential authority</span><strong>${Math.round(summary.potential / n)}</strong></div>
    <div class="stat-chip"><span class="muted">Total recommendations</span><strong>${summary.recs}</strong></div>
    <div class="stat-chip"><span class="muted">Easy wins</span><strong>${summary.easy}</strong></div>
    <div class="stat-chip"><span class="muted">High impact</span><strong>${summary.high}</strong></div>
    <div class="stat-chip"><span class="muted">Est. improvement</span><strong>+${Math.round(summary.improvement / n)}</strong></div>
  </div>
  <table>
    <thead><tr><th>Service</th><th>Current → Potential</th><th>Recs</th><th>Easy wins</th><th>High impact</th><th>Est. gain</th><th>Top 3</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="8" class="muted">No active campaigns.</td></tr>`}</tbody>
  </table>
  <h3 style="margin-top:18px">Top 10 recommendations</h3>
  <table>
    <thead><tr><th>Recommendation</th><th>Difficulty</th><th>Impact</th><th>Estimated gains</th><th>Action</th></tr></thead>
    <tbody>${top10 || `<tr><td colspan="5" class="muted">Run enhancement analysis to populate recommendations.</td></tr>`}</tbody>
  </table>
  <p style="margin-top:14px">
    <a class="btn" href="/api/pharmacy-enhancement-workspace?slug=${esc(slug)}">Review Campaign Improvements</a>
    <a class="btn secondary" href="/api/pharmacy-authority-enhancements?slug=${esc(slug)}" style="margin-left:8px">View analysis</a>
  </p>
</section>`;
}

function renderEnhancementProgressSection(dashboard: PharmacyCampaignControlCentre): string {
  const slug = dashboard.slug;
  const activeCampaigns = dashboard.campaigns.filter((c) => c.status === "active");
  const rows = activeCampaigns
    .map(
      (c) => `<tr>
  <td><strong>${esc(c.serviceName)}</strong></td>
  <td>${c.enhancementProgressCurrent}</td>
  <td>${c.enhancementProgressProjected}</td>
  <td>${c.enhancementProgressPotential}</td>
  <td>${c.enhancementProgressRealCompleted} <span class="muted">/ ${c.enhancementProgressCompleted}</span></td>
  <td>${c.enhancementProgressRemaining}</td>
  <td><span class="badge gate-${esc(c.enhancementProgressPublishGate)}">${esc(c.enhancementProgressPublishGate)}</span></td>
  <td>${c.enhancementNextRealActionLabel ? `<a class="btn-xs" href="${esc(c.enhancementNextRealActionUrl)}">${esc(c.enhancementNextRealActionLabel)}</a>` : "—"}</td>
  <td><a class="btn-xs" href="${esc(c.enhancementWorkspaceUrl)}">Improvements</a></td>
</tr>`,
    )
    .join("");

  const totals = activeCampaigns.reduce(
    (acc, c) => ({
      completed: acc.completed + c.enhancementProgressCompleted,
      realCompleted: acc.realCompleted + c.enhancementProgressRealCompleted,
      remaining: acc.remaining + c.enhancementProgressRemaining,
    }),
    { completed: 0, realCompleted: 0, remaining: 0 },
  );

  const primary = dashboard.primaryCampaign;
  const gateClass = primary?.enhancementProgressPublishGate || "FAIL";

  return `<section class="panel" id="enhancement-progress">
  <h2>Enhancement Progress</h2>
  <p class="lead">Real platform actions verify underlying data before completion. Test mode remains for recommendation types not yet wired.</p>
  <div class="stat-grid">
    <div class="stat-chip"><span class="muted">Current score</span><strong>${primary?.enhancementProgressCurrent ?? "—"}</strong></div>
    <div class="stat-chip"><span class="muted">Projected</span><strong>${primary?.enhancementProgressProjected ?? "—"}</strong></div>
    <div class="stat-chip"><span class="muted">Potential</span><strong>${primary?.enhancementProgressPotential ?? "—"}</strong></div>
    <div class="stat-chip"><span class="muted">Real completed</span><strong>${totals.realCompleted}</strong></div>
    <div class="stat-chip"><span class="muted">Remaining</span><strong>${totals.remaining}</strong></div>
    <div class="stat-chip"><span class="muted">Publish gate</span><strong class="gate-${esc(gateClass)}">${esc(primary?.enhancementProgressPublishGate ?? "—")}</strong></div>
  </div>
  ${primary?.enhancementNextRealActionUrl ? `<p style="margin-top:12px"><strong>Next recommended action:</strong> <a href="${esc(primary.enhancementNextRealActionUrl)}">${esc(primary.enhancementNextRealActionLabel)}</a></p>` : ""}
  <table>
    <thead><tr><th>Service</th><th>Current</th><th>Projected</th><th>Potential</th><th>Real / Total</th><th>Remaining</th><th>Publish gate</th><th>Next action</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="9" class="muted">No active campaigns.</td></tr>`}</tbody>
  </table>
  <p style="margin-top:14px"><a class="btn" href="/api/pharmacy-enhancement-workspace?slug=${esc(slug)}">Continue Improvements</a></p>
</section>`;
}

function renderPlatformOperationalWorkflow(dashboard: PharmacyCampaignControlCentre): string {
  const wf = dashboard.platformWorkflow;
  const slug = dashboard.slug;
  const primaryId = dashboard.primaryCampaign?.serviceId;
  return `${renderWhereYouAre(wf)}
  ${renderAuthorityReadinessSection(dashboard)}
  ${renderAuthorityEnhancementSection(dashboard)}
  ${renderEnhancementProgressSection(dashboard)}
  ${renderImageCentre(wf, slug)}
  ${renderEcosystemExpansion(wf)}
  ${renderPublishingWorkflow(wf, primaryId)}
  ${renderCompetitorGaps(wf)}
  ${renderOpportunityEngine(wf)}`;
}

function renderCampaignOperatingSystemPanel(campaign: PharmacyCampaignEnriched | null, slug: string): string {
  if (!campaign) {
    return `<section class="panel os-hero"><h2>Campaign Operating System</h2><p class="lead muted">Create a campaign to open your single-screen growth command centre.</p></section>`;
  }
  const os = campaign.operatingSystem;
  const ex = campaign.execution;
  return `<section class="panel os-hero" id="campaign-os">
  <h2>${esc(campaign.serviceName)} Campaign</h2>
  <p class="lead"><strong>${esc(campaign.name)}</strong> · ${esc(campaign.campaignGoal)} · <span class="${stageBadgeClass(ex.stage)}">${esc(ex.statusBadge)}</span> · ${ex.progressPct}% complete</p>
  ${renderHealthScore(os)}
  ${renderReadiness(os)}
  ${renderPlainStatusStrip(campaign)}
  ${renderCampaignAuthorityPanel(campaign, slug)}
  <h3>Performance summary</h3>
  ${renderPerformancePanel(os)}
  <h3>Campaign timeline</h3>
  ${renderTimeline(os)}
  <h3>Asset inventory</h3>
  <p class="lead muted">Content assets from master library and ecosystem — available or missing.</p>
  ${renderAssetInventory(os)}
  <div class="exec-next" style="margin-top:16px">
    <strong>Next action</strong>
    <p>${esc(campaign.launchQueue?.nextLaunchTask?.title || ex.nextAction)}</p>
  </div>
  <p style="margin-top:14px">
    <a class="btn" href="${esc(campaign.detailUrl)}">Full campaign detail</a>
    <a class="btn secondary" href="/api/pharmacy-campaign-launch-queue?slug=${esc(slug)}&campaignId=${esc(campaign.id)}">Launch queue</a>
    <button type="button" class="btn secondary btn-regenerate" data-slug="${esc(slug)}" data-campaign-id="${esc(campaign.id)}">Regenerate Page</button>
  </p>
</section>`;
}

function renderPrimaryControlPanel(campaign: PharmacyCampaignEnriched | null, slug: string): string {
  if (!campaign) {
    return `<section class="panel"><h2>Active campaign control</h2><p class="lead muted">Create a campaign to unlock the full control centre — assets, images, launch queue and bridge links.</p></section>`;
  }
  const ex = campaign.execution;
  return `<section class="panel" id="campaign-control">
  <h2>Active campaign control</h2>
  <p class="lead"><strong>${esc(campaign.name)}</strong> — orchestration hub for ${esc(campaign.serviceName)}.</p>
  <div class="exec-summary">
    <div class="exec-summary-card"><span class="muted">Stage</span><strong><span class="${stageBadgeClass(ex.stage)}">${esc(ex.statusBadge)}</span></strong></div>
    <div class="exec-summary-card"><span class="muted">Progress</span><strong>${ex.progressPct}%</strong><div class="progress-bar"><div class="progress-fill" style="width:${ex.progressPct}%"></div></div></div>
    <div class="exec-summary-card"><span class="muted">Images</span><strong>${campaign.imageAssignedCount}/${campaign.imageTotalSlots}</strong></div>
    <div class="exec-summary-card"><span class="muted">Authority</span><strong>${campaign.authorityScore}</strong><div class="muted">${esc(campaign.authorityLabel)} · ${esc(campaign.authorityPublishGate.replace(/_/g, " "))}</div></div>
    <div class="exec-summary-card"><span class="muted">Live publish</span><strong>${campaign.authorityLivePublishReady ? "Ready" : "Blocked"}</strong></div>
    <div class="exec-summary-card"><span class="muted">Launch queue</span><strong>${campaign.launchQueue ? `${campaign.launchQueue.completeTasks}/${campaign.launchQueue.totalTasks}` : "—"}</strong></div>
    <div class="exec-summary-card"><span class="muted">Enhancement</span><strong>${campaign.enhancementProgressCompleted}/${campaign.enhancementProgressCompleted + campaign.enhancementProgressRemaining}</strong><div class="muted">${campaign.enhancementProgressProjected} projected</div></div>
  </div>
  <p style="margin:0 0 12px"><a class="btn-xs" href="${esc(campaign.enhancementWorkspaceUrl)}">Continue Improvements</a></p>
  <div class="exec-next">
    <strong>Next action</strong>
    <p>${esc(campaign.launchQueue?.nextLaunchTask?.title || ex.nextAction)}</p>
  </div>
  ${renderStatusStrip(campaign, slug)}
  <h3>Asset checklist</h3>
  ${renderAssetChecklist(campaign)}
  <h3>Image library (${campaign.imageAssignedCount}/${campaign.imageTotalSlots} assigned)</h3>
  ${renderImageSourceBreakdown(campaign)}
  ${renderImageGrid(campaign.imageSlots, slug, campaign.serviceId, campaign.id)}
  <p style="margin-top:10px"><a class="btn-xs" href="${esc(campaign.imageLibraryUrl)}">Open image library</a></p>
  <p style="margin-top:14px"><a class="btn" href="${esc(campaign.detailUrl)}">Open campaign detail</a></p>
</section>`;
}

function renderServiceRow(service: ServiceCatalogEntry, selected: boolean, hasCampaign = false): string {
  return `<tr class="service-row${selected ? " selected" : ""}${hasCampaign ? " has-campaign" : ""}" data-service-id="${esc(service.serviceId)}">
  <td><input type="radio" name="serviceId" value="${esc(service.serviceId)}" ${selected ? "checked" : ""} ${hasCampaign ? "disabled" : ""} aria-label="${esc(service.serviceName)}"/></td>
  <td><strong>${esc(service.serviceName)}</strong><div class="muted mono">${esc(service.serviceId)}</div>${hasCampaign ? `<div class="muted">Campaign already active</div>` : ""}</td>
  <td>${readinessBadge(service.masterReadiness, ["ready"])}</td>
  <td>${readinessBadge(service.ecosystemAvailability, ["available"])}<div class="muted">${service.ecosystemAssetCount} assets</div></td>
  <td>${readinessBadge(service.publishedStatus, ["published"])}<div class="muted">${service.publishedPageCount} pages</div></td>
  <td>${readinessBadge(service.indexingStatus, ["indexed", "submitted"])}</td>
  <td>${readinessBadge(service.visibilityStatus, ["visible", "building"])}</td>
</tr>`;
}

function renderCampaignRow(campaign: PharmacyCampaignEnriched, slug: string): string {
  const archived = campaign.status === "archived";
  const ex = campaign.execution;
  const lq = campaign.launchQueue;
  return `<tr class="${archived ? "archived" : ""}">
  <td><a href="${esc(campaign.detailUrl)}"><strong>${esc(campaign.name)}</strong></a><div class="muted">${esc(campaign.campaignGoal)}</div></td>
  <td>${esc(campaign.serviceName)}</td>
  <td><span class="${stageBadgeClass(ex.stage)}">${esc(ex.statusBadge)}</span></td>
  <td>${ex.progressPct}%</td>
  <td>${campaign.imageAssignedCount}/${campaign.imageTotalSlots}</td>
  <td>${lq ? `${lq.completeTasks}/${lq.totalTasks}` : "—"}</td>
  <td class="next-action">${esc(lq?.nextLaunchTask?.title || ex.nextAction)}</td>
  <td>${readinessBadge(campaign.publishingStatus, ["published"])}</td>
  <td>${readinessBadge(campaign.indexingStatus, ["indexed", "submitted"])}</td>
  <td>${readinessBadge(campaign.visibilityStatus, ["visible", "building"])}</td>
  <td class="actions">
    <a class="btn-xs" href="${esc(campaign.detailUrl)}">Detail</a>
    <a class="btn-xs" href="${esc(campaign.links.ecosystem)}" target="_blank" rel="noopener">Ecosystem</a>
    <a class="btn-xs" href="${esc(campaign.links.publishedPage)}" target="_blank" rel="noopener">Published</a>
    ${archived ? "" : `<button type="button" class="btn-xs danger btn-archive" data-slug="${esc(slug)}" data-campaign-id="${esc(campaign.id)}">Archive</button>`}
  </td>
</tr>`;
}

function renderStaleCampaignWarning(message?: string): string {
  if (!message) return "";
  return `<div class="stale-campaign-warning" role="status">${esc(message)}</div>`;
}

function renderHeader(slug: string, pharmacyName: string, title: string, subtitle: string, serviceId?: string): string {
  return `<header>
  <h1>${esc(title)}</h1>
  <p>${esc(subtitle)}</p>
  ${renderPharmacyPlatformNavBar({ slug, serviceId: serviceId || PRIMARY_PLATFORM_SERVICE_ID, activeId: "campaign-os" })}
</header>`;
}

function renderIndependentCampaignCard(campaign: PharmacyCampaignEnriched, slug: string): string {
  const s = esc(slug);
  const sid = esc(campaign.serviceId);
  const evidenceUrl = `/api/master-admin-platform?customer=${s}&panel=imported-evidence-review`;
  const generateServiceUrl = `/api/master-admin-platform?customer=${s}&panel=service-page-generation`;
  const reviewUrl = campaign.detailUrl;
  const localPagesUrl = `/api/pharmacy-content-ecosystem-preview/${sid}/?slug=${s}`;
  const publishUrl = `/api/pharmacy-publishing-settings?slug=${s}&service=${sid}`;
  const rankingsUrl = `/api/pharmacy-growth-dashboard?slug=${s}#rankings`;
  const status = campaign.assetCounts.servicePage > 0 || campaign.publishingStatus === "published"
    ? "In progress"
    : "Starts at Service Evidence";
  return `<article class="campaign-card" data-campaign-id="${esc(campaign.id)}" data-service-id="${sid}">
  <div class="campaign-card-head">
    <h3>${esc(campaign.serviceName)}</h3>
    <span class="muted">${esc(status)} · ${esc(campaign.campaignGoal)}</span>
  </div>
  <div class="campaign-card-steps">
    <a class="btn-xs" href="${esc(evidenceUrl)}">Evidence</a>
    <a class="btn-xs" href="${esc(generateServiceUrl)}">Generate Service Page</a>
    <a class="btn-xs" href="${esc(reviewUrl)}">Review</a>
    <a class="btn-xs" href="${esc(localPagesUrl)}" target="_blank" rel="noopener">Generate Local Pages</a>
    <a class="btn-xs" href="${esc(reviewUrl)}">Review</a>
    <a class="btn-xs" href="${esc(publishUrl)}">Publish</a>
    <a class="btn-xs" href="${esc(rankingsUrl)}">Rankings</a>
  </div>
</article>`;
}

export function renderPharmacyCampaignsHtml(
  dashboard: PharmacyCampaignControlCentre,
  options?: { staleFallbackWarning?: string },
): string {
  const slug = dashboard.slug;
  const coverage = getCampaignCoverageSummary(slug);
  const activeServiceIds = new Set(
    dashboard.campaigns.filter((c) => c.status === "active").map((c) => c.serviceId),
  );
  const defaultService =
    coverage.missingServiceIds[0] ||
    dashboard.services.find((s) => !activeServiceIds.has(s.serviceId))?.serviceId ||
    dashboard.services[0]?.serviceId ||
    "pharmacy-first";
  const goalOptions = dashboard.goals.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  const serviceRows = dashboard.services
    .map((s) =>
      renderServiceRow(
        s,
        s.serviceId === defaultService,
        activeServiceIds.has(s.serviceId),
      ),
    )
    .join("");
  const activeCampaigns = dashboard.campaigns.filter((c) => c.status === "active");
  const primary = dashboard.primaryCampaign;
  const osPanel = renderCampaignOperatingSystemPanel(primary, slug);
  const launchQueuePanel = renderLaunchQueuePreview(primary?.launchQueue || null, slug);
  const supportPanel = primary ? renderPrimaryControlPanel(primary, slug) : "";
  const coverageBanner = coverage.allCampaignsCreated
    ? `<div class="campaign-coverage-banner"><strong>All service campaigns created.</strong> <a class="btn-xs" href="#create-campaign">Manage Campaigns</a></div>`
    : `<div class="campaign-coverage-banner"><strong>${coverage.activeCampaignCount} of ${coverage.enabledServiceCount} services have campaigns.</strong> <a class="btn" href="#create-campaign">Create New Campaign</a></div>`;
  const openCreateByDefault = !coverage.allCampaignsCreated;
  const campaignCards = activeCampaigns.map((c) => renderIndependentCampaignCard(c, slug)).join("");
  const os = buildPlatformOperatingSystem(slug);

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Campaign Operating System — ${esc(dashboard.pharmacyName)}</title>
<style>${cssBlock(dashboard.brandPrimaryColor)}</style>
</head>
<body>
${renderHeader(slug, dashboard.pharmacyName, "Campaign Operating System", "Where you are, what exists, what is missing, what to do next — and opportunities you are not capturing.")}
<main>
${renderPlatformWorkflowBar({ slug, nextStepUrl: os.nextStep?.url, dashboardLabel: "Return to Dashboard" })}
  ${coverageBanner}
  ${renderStaleCampaignWarning(options?.staleFallbackWarning)}
  <section class="panel" id="service-campaigns">
    <h2>Service campaigns</h2>
    <p class="lead">Each service is an independent campaign. Business Profile, branding and localities are inherited — only service evidence is reviewed next.</p>
    <div class="campaign-card-grid">${campaignCards || `<p class="muted">No active campaigns yet. Create one below.</p>`}</div>
  </section>
  ${osPanel}
  ${renderPlatformOperationalWorkflow(dashboard)}
  ${launchQueuePanel}
  ${supportPanel}

  <details class="panel portfolio-secondary" id="choose-service">
    <summary>Campaign portfolio (${dashboard.activeCampaigns} active)</summary>
    <p class="lead">Secondary view — switch campaigns or compare progress.</p>
    <div class="stat-grid">
      <div class="stat-chip"><strong>${dashboard.activeCampaigns}</strong> active campaigns</div>
      <div class="stat-chip"><strong>${primary ? esc(primary.operatingSystem.health.label) : "—"}</strong> health</div>
      <div class="stat-chip"><strong>${primary?.operatingSystem.health.score ?? 0}</strong> health score</div>
      <div class="stat-chip"><strong>${primary?.operatingSystem.readiness.label ?? "—"}</strong> readiness</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Campaign</th><th>Service</th><th>Health</th><th>Stage</th><th>Progress</th><th>Readiness</th><th>Actions</th>
        </tr>
      </thead>
      <tbody id="campaign-table-body">${activeCampaigns.length ? activeCampaigns.map((c) => {
        const archived = c.status === "archived";
        const ex = c.execution;
        return `<tr class="${archived ? "archived" : ""}">
  <td><a href="${esc(c.detailUrl)}"><strong>${esc(c.name)}</strong></a></td>
  <td>${esc(c.serviceName)}</td>
  <td>${c.operatingSystem.health.score} · ${esc(c.operatingSystem.health.label)}</td>
  <td><span class="${stageBadgeClass(ex.stage)}">${esc(ex.statusBadge)}</span></td>
  <td>${ex.progressPct}%</td>
  <td>${esc(c.operatingSystem.readiness.label)}</td>
  <td class="actions"><a class="btn-xs" href="${esc(c.detailUrl)}">Open</a></td>
</tr>`;
      }).join("") : `<tr><td colspan="7" class="muted">No active campaigns.</td></tr>`}</tbody>
    </table>
  </details>

  <details class="panel" id="create-campaign"${openCreateByDefault ? " open" : ""}>
    <summary>Create New Campaign</summary>
    <div class="steps" id="step-indicators">
      <span class="step-pill active" data-step="1">1 · Select Service</span>
      <span class="step-pill" data-step="2">2 · Campaign Goal</span>
      <span class="step-pill" data-step="3">3 · Campaign Outputs</span>
      <span class="step-pill" data-step="4">4 · Summary</span>
      <span class="step-pill" data-step="5">5 · Create</span>
    </div>

    <div class="wizard-step active" data-step="1">
      <h3>Select service</h3>
      <table>
        <thead>
          <tr>
            <th></th><th>Service</th><th>Master</th><th>Ecosystem</th><th>Published</th><th>Indexing</th><th>Visibility</th>
          </tr>
        </thead>
        <tbody id="service-table-body">${serviceRows}</tbody>
      </table>
    </div>

    <div class="wizard-step" data-step="2">
      <h3>Campaign goal</h3>
      <p class="muted">Choose the primary growth objective for this service campaign.</p>
      <select class="goal-select" id="campaign-goal" aria-label="Campaign goal">${goalOptions}</select>
    </div>

    <div class="wizard-step" data-step="3">
      <h3>Campaign outputs</h3>
      <p class="muted">Assets PharmaConnect will deliver from the approved master library (existing or planned counts).</p>
      <div class="output-grid" id="outputs-grid"><p class="muted">Select a service to preview outputs.</p></div>
    </div>

    <div class="wizard-step" data-step="4">
      <h3>Campaign summary</h3>
      <div class="summary-grid" id="summary-grid"></div>
      <div class="summary-card" style="margin-top:12px">
        <span class="muted">Target areas</span>
        <label class="check-row" style="margin:8px 0"><input type="radio" name="areaSource" value="profile" checked/> Use profile selected areas (default)</label>
        <label class="check-row"><input type="radio" name="areaSource" value="custom"/> Custom areas for this campaign</label>
        <div id="campaign-areas-preview" class="muted" style="margin-top:8px;font-size:12px"></div>
      </div>
    </div>

    <div class="wizard-step" data-step="5">
      <h3>Create campaign</h3>
      <p class="muted">Creates <code>data/pharmacy-campaigns/${esc(slug)}.json</code> — no new content is generated.</p>
      <div id="create-result" class="summary-card" style="display:none"></div>
    </div>

    <div class="wizard-nav">
      <button type="button" class="btn secondary" id="btn-prev" disabled>Back</button>
      <button type="button" class="btn" id="btn-next">Next</button>
      <button type="button" class="btn" id="btn-create" style="display:none">Create Campaign</button>
    </div>
  </details>
</main>
<script>
(function(){
  var slug = ${JSON.stringify(slug)};
  var currentStep = 1;
  var selectedServiceId = ${JSON.stringify(defaultService)};
  var previewCache = null;

  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function getSelectedServiceId(){
    var checked = document.querySelector('input[name="serviceId"]:checked');
    return checked ? checked.value : selectedServiceId;
  }

  function setStep(step){
    currentStep = step;
    qsa(".wizard-step").forEach(function(el){
      el.classList.toggle("active", Number(el.getAttribute("data-step")) === step);
    });
    qsa(".step-pill").forEach(function(el){
      var n = Number(el.getAttribute("data-step"));
      el.classList.toggle("active", n === step);
      el.classList.toggle("done", n < step);
    });
    qs("#btn-prev").disabled = step === 1;
    qs("#btn-next").style.display = step >= 5 ? "none" : "inline-block";
    qs("#btn-create").style.display = step === 5 ? "inline-block" : "none";
    if (step === 3 || step === 4) loadPreview();
  }

  function renderOutputs(outputs){
    var grid = qs("#outputs-grid");
    if (!outputs || !outputs.length){
      grid.innerHTML = "<p class=\\"muted\\">No outputs available.</p>";
      return;
    }
    grid.innerHTML = outputs.map(function(o){
      var cls = o.available ? "output-item available" : "output-item";
      var tick = o.available ? "✓" : "○";
      return "<div class=\\"" + cls + "\\"><span class=\\"tick\\">" + tick + "</span><div><strong>" + o.label + "</strong><div class=\\"muted\\">" + o.count + " · " + o.source + "</div></div></div>";
    }).join("");
  }

  function renderSummary(summary){
    var grid = qs("#summary-grid");
    if (!summary){
      grid.innerHTML = "<p class=\\"muted\\">Loading summary…</p>";
      return;
    }
    grid.innerHTML = [
      "<div class=\\"summary-card\\"><span class=\\"muted\\">Service</span><strong>" + summary.serviceName + "</strong><div class=\\"muted\\">" + (summary.campaignGoal || "—") + "</div></div>",
      "<div class=\\"summary-card\\"><span class=\\"muted\\">Expected assets</span><strong>" + summary.expectedAssets.total + "</strong></div>",
      "<div class=\\"summary-card\\"><span class=\\"muted\\">Published assets</span><strong>" + summary.publishedAssets + "</strong><div class=\\"muted\\">" + summary.bridgeStatus.publishingStatus + "</div></div>",
      "<div class=\\"summary-card\\"><span class=\\"muted\\">Indexed assets</span><strong>" + summary.indexedAssets + "</strong><div class=\\"muted\\">" + summary.bridgeStatus.indexingStatus + "</div></div>",
      "<div class=\\"summary-card\\"><span class=\\"muted\\">Visibility assets</span><strong>" + summary.visibilityAssets + "</strong><div class=\\"muted\\">" + summary.bridgeStatus.visibilityStatus + "</div></div>",
      "<div class=\\"summary-card\\"><span class=\\"muted\\">Publishing queue</span><strong>" + summary.expectedAssets.publishingQueue + "</strong> pages</div>",
      "<div class=\\"summary-card\\"><span class=\\"muted\\">Target areas</span><strong>" + (summary.profileAreas ? summary.profileAreas.length : 0) + "</strong><div class=\\"muted\\">" + (summary.profileAreas || []).slice(0,5).map(function(a){ return a.areaName; }).join(", ") + "</div></div>"
    ].join("");
    var areaBox = qs("#campaign-areas-preview");
    if (areaBox && summary.profileAreas){
      areaBox.textContent = summary.profileAreas.map(function(a){ return a.areaName; }).join(" · ") || "No profile areas — set them in Profile Dashboard.";
    }
  }

  function loadPreview(){
    var serviceId = getSelectedServiceId();
    var goal = qs("#campaign-goal").value;
    var url = "/api/pharmacy-campaigns/" + slug + "/preview/" + serviceId + (goal ? "?goal=" + encodeURIComponent(goal) : "");
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!data.ok) throw new Error(data.error || "Preview failed");
        previewCache = data.summary;
        if (currentStep === 3) renderOutputs(data.summary.outputs);
        if (currentStep === 4) renderSummary(data.summary);
      })
      .catch(function(err){
        var msg = String(err);
        if (currentStep === 3) qs("#outputs-grid").innerHTML = "<p class=\\"muted\\">" + msg + "</p>";
        if (currentStep === 4) qs("#summary-grid").innerHTML = "<p class=\\"muted\\">" + msg + "</p>";
      });
  }

  qsa(".service-row").forEach(function(row){
    row.addEventListener("click", function(){
      var id = row.getAttribute("data-service-id");
      var radio = row.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      selectedServiceId = id;
      qsa(".service-row").forEach(function(r){ r.classList.toggle("selected", r === row); });
      previewCache = null;
    });
  });

  qs("#campaign-goal").addEventListener("change", function(){ previewCache = null; });
  qs("#btn-prev").addEventListener("click", function(){ if (currentStep > 1) setStep(currentStep - 1); });
  qs("#btn-next").addEventListener("click", function(){ if (currentStep < 5) setStep(currentStep + 1); });

  qs("#btn-create").addEventListener("click", function(){
    var btn = qs("#btn-create");
    btn.disabled = true;
    fetch("/api/pharmacy-campaigns/" + slug + "/create", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: getSelectedServiceId(),
        campaignGoal: qs("#campaign-goal").value,
        areaSource: (document.querySelector('input[name="areaSource"]:checked') || {}).value || "profile",
        campaignAreas: previewCache && previewCache.profileAreas ? previewCache.profileAreas : undefined
      })
    })
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!data.ok) throw new Error(data.error || "Create failed");
        var box = qs("#create-result");
        box.style.display = "block";
        box.innerHTML = "<strong>Campaign created</strong><div class=\\"muted\\">" + data.campaign.name + " · " + data.campaign.assetCounts.total + " assets linked</div>";
        setTimeout(function(){ window.location.reload(); }, 900);
      })
      .catch(function(err){ alert(String(err)); btn.disabled = false; });
  });

  document.addEventListener("click", function(ev){
    var t = ev.target;
    if (t && t.classList && t.classList.contains("btn-archive")){
      var cSlug = t.getAttribute("data-slug");
      var cId = t.getAttribute("data-campaign-id");
      if (!confirm("Archive this campaign?")) return;
      fetch("/api/pharmacy-campaigns/" + cSlug + "/archive/" + cId, { method: "POST", headers: { "Accept": "application/json" } })
        .then(function(r){ return r.json(); })
        .then(function(data){ if (data.ok) window.location.reload(); else alert(data.error || "Archive failed"); })
        .catch(function(err){ alert(String(err)); });
    }
    if (t && t.classList && t.classList.contains("btn-regenerate")){
      var rSlug = t.getAttribute("data-slug");
      var rId = t.getAttribute("data-campaign-id");
      if (!confirm("Regenerate this campaign page using your current profile, branding, images and areas?")) return;
      t.disabled = true;
      fetch("/api/pharmacy-campaigns/" + rSlug + "/regenerate/" + rId, { method: "POST", headers: { "Accept": "application/json" } })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if (!data.ok) throw new Error(data.error || "Regenerate failed");
          window.location.href = data.redirectUrl || window.location.href;
        })
        .catch(function(err){ alert(String(err)); t.disabled = false; });
    }
  });

  setStep(1);
})();
</script>
</body>
</html>`;
}

export function renderPharmacyCampaignDetailHtml(view: PharmacyCampaignDetailView): string {
  const { slug, campaign } = view;
  const ex = campaign.execution;
  const queue = campaign.launchQueue;
  const os = campaign.operatingSystem;
  const pickerOptions = view.campaignPicker
    .map(
      (c) =>
        `<option value="${esc(c.id)}" ${c.id === campaign.id ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");
  const taskRows = (queue?.tasks || [])
    .map(
      (t) => `<tr>
  <td><span class="${taskStatusClass(t.status)}">${esc(t.status.replace(/_/g, " "))}</span></td>
  <td>${esc(t.title)}</td>
  <td>${esc(t.priority)}</td>
  <td><a class="btn-xs" href="${esc(t.linkedUrl)}">${esc(t.linkedModule)}</a></td>
</tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(campaign.name)} — Campaign Detail</title>
<style>${cssBlock(view.brandPrimaryColor)}</style>
</head>
<body>
${renderHeader(slug, view.pharmacyName, "Campaign Operating System", `${campaign.serviceName} — ${campaign.campaignGoal}`, campaign.serviceId)}
<main>
  ${renderStaleCampaignWarning(view.staleFallbackWarning)}
  <section class="panel">
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px">
      <label class="muted">Switch campaign</label>
      <select id="campaign-picker" style="padding:8px 12px;border-radius:8px;border:1px solid #cbd5e1">${pickerOptions}</select>
      <a class="btn secondary" href="/api/pharmacy-campaigns?slug=${esc(slug)}">← Back to operating system</a>
    </div>
    <nav class="detail-nav">
      <a href="#overview" class="active">Overview</a>
      <a href="#health">Health</a>
      <a href="#timeline">Timeline</a>
      <a href="#assets">Assets</a>
      <a href="#images">Images</a>
      <a href="#launch-queue">Launch queue</a>
      <a href="#performance">Performance</a>
      <a href="#actions">Actions</a>
    </nav>
  </section>

  <section class="panel os-hero" id="overview">
    <h2>Overview</h2>
    ${renderHealthScore(os)}
    ${renderReadiness(os)}
    ${renderCampaignAuthorityPanel(campaign, slug)}
    <div class="exec-summary" style="margin-top:16px">
      <div class="exec-summary-card"><span class="muted">Service</span><strong>${esc(campaign.serviceName)}</strong></div>
      <div class="exec-summary-card"><span class="muted">Goal</span><strong>${esc(campaign.campaignGoal)}</strong></div>
      <div class="exec-summary-card"><span class="muted">Stage</span><strong><span class="${stageBadgeClass(ex.stage)}">${esc(ex.statusBadge)}</span></strong></div>
      <div class="exec-summary-card"><span class="muted">Progress</span><strong>${ex.progressPct}%</strong><div class="progress-bar"><div class="progress-fill" style="width:${ex.progressPct}%"></div></div></div>
    </div>
    <div class="exec-next">
      <strong>Next action</strong>
      <p>${esc(queue?.nextLaunchTask?.title || ex.nextAction)}</p>
    </div>
  </section>

  <section class="panel" id="health">
    <h2>Health score</h2>
    ${renderHealthScore(os)}
  </section>

  <section class="panel" id="timeline">
    <h2>Campaign timeline</h2>
    ${renderTimeline(os)}
  </section>

  <section class="panel" id="assets">
    <h2>Asset inventory</h2>
    <p class="lead">${campaign.assetCounts.total} linked assets from master library and ecosystem.</p>
    ${renderAssetInventory(os)}
    <h3 style="margin-top:16px">Operational checklist</h3>
    ${renderAssetChecklist(campaign)}
  </section>

  <section class="panel" id="images">
    <h2>Images</h2>
    <p class="lead">${campaign.imageAssignedCount}/${campaign.imageTotalSlots} slots assigned from pharmacy image library.</p>
    ${renderImageSourceBreakdown(campaign)}
    ${renderImageGrid(campaign.imageSlots, slug, campaign.serviceId, campaign.id)}
    <p style="margin-top:14px"><a class="btn" href="${esc(campaign.imageLibraryUrl)}">Open image library</a></p>
  </section>

  <section class="panel" id="launch-queue">
    <h2>Launch queue</h2>
    <p class="lead">${queue ? `${queue.completeTasks}/${queue.totalTasks} complete · ${queue.progressPct}%` : "No launch queue"}</p>
    ${queue ? `<table><thead><tr><th>Status</th><th>Task</th><th>Priority</th><th>Module</th></tr></thead><tbody>${taskRows}</tbody></table>` : `<p class="muted">Launch queue not generated.</p>`}
    ${queue ? `<p style="margin-top:14px"><a class="btn" href="/api/pharmacy-campaign-launch-queue?slug=${esc(slug)}&campaignId=${esc(campaign.id)}">Manage launch queue</a></p>` : ""}
  </section>

  <section class="panel" id="performance">
    <h2>Performance summary</h2>
    ${renderPerformancePanel(os)}
    <h3 style="margin-top:16px">Publishing</h3>
    <p class="lead">Status: <strong>${esc(campaign.publishingStatus)}</strong> · ${campaign.publishedPages} pages</p>
    <a class="btn-xs" href="${esc(campaign.links.publishedPage)}" target="_blank" rel="noopener">View published page</a>
    <h3 style="margin-top:16px">Indexing</h3>
    <p class="lead">Status: <strong>${esc(campaign.indexingStatus.replace(/_/g, " "))}</strong> · ${campaign.indexedPages} indexed</p>
    <a class="btn-xs" href="${esc(campaign.links.indexing)}">Open indexing bridge</a>
    <h3 style="margin-top:16px">Visibility</h3>
    <p class="lead">Status: <strong>${esc(campaign.visibilityStatus.replace(/_/g, " "))}</strong> · score ${os.performance.visibilityScore}</p>
    <a class="btn-xs" href="${esc(campaign.links.visibility)}">Open visibility bridge</a>
  </section>

  <section class="panel" id="actions">
    <h2>Actions</h2>
    <div class="actions">
      <a class="btn" href="${esc(campaign.links.ecosystem)}" target="_blank" rel="noopener">Content ecosystem</a>
      <a class="btn secondary" href="${esc(campaign.links.publishedPage)}" target="_blank" rel="noopener">Published page</a>
      <a class="btn secondary" href="/api/pharmacy-growth-actions?slug=${esc(slug)}">Growth actions</a>
      ${campaign.status === "active" ? `<button type="button" class="btn secondary danger btn-archive" data-slug="${esc(slug)}" data-campaign-id="${esc(campaign.id)}">Archive campaign</button>` : ""}
    </div>
  </section>
</main>
<script>
(function(){
  var slug = ${JSON.stringify(slug)};
  var picker = document.getElementById("campaign-picker");
  if (picker) {
    picker.addEventListener("change", function(){
      window.location.href = "/api/pharmacy-campaigns?slug=" + encodeURIComponent(slug) + "&campaignId=" + encodeURIComponent(picker.value);
    });
  }
  document.addEventListener("click", function(ev){
    var t = ev.target;
    if (t && t.classList && t.classList.contains("btn-archive")){
      if (!confirm("Archive this campaign?")) return;
      fetch("/api/pharmacy-campaigns/" + slug + "/archive/" + t.getAttribute("data-campaign-id"), { method: "POST", headers: { "Accept": "application/json" } })
        .then(function(r){ return r.json(); })
        .then(function(data){ if (data.ok) window.location.href = "/api/pharmacy-campaigns?slug=" + encodeURIComponent(slug); else alert(data.error || "Archive failed"); })
        .catch(function(err){ alert(String(err)); });
    }
  });
})();
</script>
</body>
</html>`;
}

router.get("/pharmacy-campaigns", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const campaignId = String(req.query.campaignId || "").trim();
  try {
    res.setHeader("Cache-Control", "no-store");
    if (campaignId) {
      const route = resolveCampaignOsRoute(slug, campaignId);
      if (route.mode === "detail" && route.detail) {
        res.type("html").send(renderPharmacyCampaignDetailHtml(route.detail));
        return;
      }
      const dashboard = buildPharmacyCampaignControlCentre(slug);
      res.type("html").send(renderPharmacyCampaignsHtml(dashboard, { staleFallbackWarning: route.staleFallbackWarning }));
      return;
    }
    const dashboard = buildPharmacyCampaignControlCentre(slug);
    res.type("html").send(renderPharmacyCampaignsHtml(dashboard));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Campaign dashboard error: ${esc(String(err))}</pre>`);
  }
});

export default router;
