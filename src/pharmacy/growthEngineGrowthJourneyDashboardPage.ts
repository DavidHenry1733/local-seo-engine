/**
 * Growth Engine — Growth Journey Dashboard V1 (Step 7).
 * Growth Timeline centrepiece — ongoing pharmacy growth programme.
 */
import {
  buildGrowthEngineFramework,
  growthEngineContentPackageUrl,
  growthEngineLegacyDashboardUrl,
} from "./growthEngineFrameworkService.ts";
import { buildGrowthJourneyView } from "./growthEngineCycleManagerService.ts";
import type { GrowthCycle, GrowthCycleLaunchPlan, GrowthJourneyView } from "./growthEngineCycleModel.ts";
import { GROWTH_CYCLE_STAGE_LABELS } from "./growthEngineCycleModel.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { buildOperationalHome, type OperationalHome, type OperationalTask } from "./growthEngineOperationalActions.ts";
import {
  buildFounderPartnerWorkflow,
  type FounderPartnerWorkflow,
  type FounderPartnerWorkflowStep,
} from "./growthEngineFounderPartnerWorkflow.ts";
import {
  commercialBlueChromeGradientCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function growthJourneyDashboardCss(): string {
  return `${growthEngineWorkflowCss()}
.gj-consultant{background:${commercialBlueChromeGradientCss()};border-radius:16px;padding:24px;color:#fff;margin-bottom:18px}
.gj-consultant h2{margin:0 0 10px;font-size:20px;color:#fff}
.gj-consultant p{margin:0;font-size:15px;line-height:1.6;color:#dbeafe}
.gj-timeline{border-left:3px solid #cbd5e1;margin:20px 0 20px 12px;padding-left:20px}
.gj-timeline-item{position:relative;margin-bottom:18px;padding-bottom:4px}
.gj-timeline-item::before{content:"";position:absolute;left:-29px;top:4px;width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid #94a3b8}
.gj-timeline-item.complete::before{border-color:#22c55e;background:#dcfce7}
.gj-timeline-item.active::before{border-color:#005eb8;background:#dbeafe;box-shadow:0 0 0 4px rgba(0,94,184,.15)}
.gj-timeline-item.recommended::before{border-color:#f59e0b;background:#fef3c7}
.gj-timeline-label{font-size:11px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:.04em}
.gj-timeline-title{font-size:16px;font-weight:900;color:#0f172a;margin:2px 0}
.gj-timeline-meta{font-size:13px;color:#64748b}
.gj-divider{border:none;border-top:2px dashed #cbd5e1;margin:16px 0}
.gj-cycle-card{border:2px solid #005eb8;border-radius:16px;padding:20px;background:linear-gradient(180deg,#eff6ff,#fff);margin-bottom:16px}
.gj-cycle-name{font-size:22px;font-weight:900;margin:0 0 8px}
.gj-progress{height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:12px 0}
.gj-progress-fill{height:100%;background:${commercialBlueChromeGradientCss()}}
.gj-stages{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.gj-stage{font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#f1f5f9;color:#64748b}
.gj-stage.current{background:#dbeafe;color:#1e40af}
.gj-stage.done{background:#dcfce7;color:#166534}
.gj-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px}
.gj-stat{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;text-align:center}
.gj-stat strong{display:block;font-size:22px;font-weight:900;color:#0f172a}
.gj-stat span{font-size:11px;color:#64748b;font-weight:700}
.gj-launch{border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#fafbfc;margin-top:14px}
.gj-launch h4{margin:0 0 8px;font-size:14px}
.gj-launch ul{margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:1.6}
.gj-next{border:1px solid #bbf7d0;border-radius:12px;padding:16px;background:#f0fdf4;margin-top:14px}
.gj-memory{font-size:12px;color:#64748b;margin-top:8px}
.gj-section-note{font-size:13px;color:#64748b;margin:0 0 14px}
.gj-empty{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:16px;font-size:13px;color:#64748b}
.gj-ops{border:2px solid #005eb8;border-radius:16px;padding:22px;background:#fff;margin-bottom:18px}
.gj-ops h2{margin:0 0 12px;font-size:20px}
.gj-ops-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:14px 0}
.gj-ops-meta div{font-size:13px;color:#475569}
.gj-ops-meta strong{display:block;font-size:12px;text-transform:uppercase;color:#64748b;margin-bottom:4px}
.gj-task{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fafbfc}
.gj-task strong{font-size:14px;display:block}
.gj-task span{font-size:12px;color:#64748b}
.gj-data-note{font-size:11px;color:#94a3b8;margin-top:6px}
.gj-rec-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.fp-panel{border:2px solid #0f766e;border-radius:16px;padding:22px;background:linear-gradient(180deg,#f0fdf4,#fff);margin-bottom:18px}
.fp-panel h2{margin:0 0 6px;font-size:20px}
.fp-lead{font-size:13px;color:#64748b;margin:0 0 14px}
.fp-steps{display:flex;flex-direction:column;gap:8px}
.fp-step{border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fff}
.fp-step.complete{border-color:#bbf7d0;background:#f0fdf4}
.fp-step.ready{border-color:#93c5fd;background:#eff6ff}
.fp-step.gap{border-color:#fed7aa;background:#fff7ed}
.fp-step-label{font-size:14px;font-weight:800;display:block}
.fp-step-detail{font-size:12px;color:#64748b;display:block;margin-top:2px}
.fp-badge{font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;text-transform:uppercase;white-space:nowrap}
.fp-badge.complete{background:#dcfce7;color:#166534}
.fp-badge.ready{background:#dbeafe;color:#1e40af}
.fp-badge.pending{background:#f1f5f9;color:#64748b}
.fp-badge.gap{background:#ffedd5;color:#9a3412}
.fp-gap-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;margin-top:12px;font-size:13px;color:#9a3412}`;
}

function renderFounderPartnerWorkflowPanel(workflow: FounderPartnerWorkflow): string {
  const stepHtml = (s: FounderPartnerWorkflowStep) => {
    let action = "";
    if (s.status === "complete") {
      action = `<span class="fp-badge complete">Done</span>`;
    } else if (s.status === "gap") {
      action = `<span class="fp-badge gap">Gap</span>`;
    } else if (s.action === "api" && s.apiPath) {
      action = `<button type="button" class="ge-btn ge-btn-primary gj-api-action" data-path="${esc(s.apiPath)}" data-method="${esc(s.apiMethod || "POST")}"${s.apiBody ? ` data-body="${esc(JSON.stringify(s.apiBody))}"` : ""}${s.confirmMessage ? ` data-confirm="${esc(s.confirmMessage)}"` : ""}>Run →</button>`;
    } else if (s.action === "navigate" && s.href) {
      action = `<a class="ge-btn ${s.status === "ready" ? "ge-btn-primary" : "ge-btn-ghost"}" href="${esc(s.href)}">Open →</a>`;
    } else {
      action = `<span class="fp-badge ${esc(s.status)}">${esc(s.status === "ready" ? "Ready" : "Pending")}</span>`;
    }
    const gap = s.gapNote ? `<span class="fp-step-detail" style="color:#9a3412">${esc(s.gapNote)}</span>` : "";
    return `<div class="fp-step ${esc(s.status)}">
<div><span class="fp-step-label">${esc(s.label)}</span><span class="fp-step-detail">${esc(s.detail)}</span>${gap}</div>
${action}
</div>`;
  };

  const gaps =
    workflow.operationalGaps.length > 0
      ? `<div class="fp-gap-box"><strong>Operational gaps</strong><ul style="margin:8px 0 0;padding-left:18px">${workflow.operationalGaps.map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div>`
      : "";

  return `<div class="fp-panel">
<h2>Founder Partner Campaign Workflow</h2>
<p class="fp-lead">${esc(workflow.serviceName)} — complete your first campaign from this dashboard. No terminal or JSON editing required.</p>
<div class="fp-steps">${workflow.steps.map(stepHtml).join("")}</div>
${gaps}
</div>`;
}

function renderWorkflowApiScript(): string {
  return `<script>
(function(){
  const status = document.getElementById('gjActionStatus');
  document.querySelectorAll('.gj-api-action').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const path = btn.getAttribute('data-path');
      if (!path) return;
      const confirmMsg = btn.getAttribute('data-confirm');
      if (confirmMsg && !window.confirm(confirmMsg)) return;
      btn.setAttribute('disabled','true');
      if (status) status.textContent = 'Working…';
      try {
        const bodyRaw = btn.getAttribute('data-body');
        const res = await fetch(path, {
          method: btn.getAttribute('data-method') || 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: bodyRaw || '{}',
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Request failed');
        if (status) status.textContent = 'Done — refreshing…';
        setTimeout(()=>location.reload(), 600);
      } catch(e) {
        if (status) status.textContent = e.message;
        btn.removeAttribute('disabled');
      }
    });
  });
})();
</script>`;
}

function renderOperationalHome(ops: OperationalHome, slug: string, workflow: FounderPartnerWorkflow): string {
  const taskHtml = (t: OperationalTask) => {
    if (t.action === "api" && t.apiPath) {
      const bodyAttr = t.apiBody ? ` data-body="${esc(JSON.stringify(t.apiBody))}"` : "";
      const confirmAttr = t.confirmMessage ? ` data-confirm="${esc(t.confirmMessage)}"` : "";
      return `<div class="gj-task">
<div><strong>${esc(t.label)}</strong><span>${esc(t.detail)}</span></div>
<button type="button" class="ge-btn ge-btn-primary gj-api-action" data-path="${esc(t.apiPath)}" data-method="${esc(t.apiMethod || "POST")}"${bodyAttr}${confirmAttr}>Run →</button>
</div>`;
    }
    if (t.href) {
      return `<div class="gj-task">
<div><strong>${esc(t.label)}</strong><span>${esc(t.detail)}</span></div>
<a class="ge-btn ${t.priority === "primary" ? "ge-btn-primary" : "ge-btn-ghost"}" href="${esc(t.href)}">Open →</a>
</div>`;
    }
    return `<div class="gj-task"><div><strong>${esc(t.label)}</strong><span>${esc(t.detail)}</span></div></div>`;
  };

  const indexingNote = ops.progress.indexing.live
    ? "From your search indexing tracker"
    : "Register published pages to begin tracking";
  const rankingsNote = ops.progress.rankings.live
    ? "From your search visibility tracking"
    : "Available after pages are published and indexed";

  return `<div class="gj-ops">
<h2>${esc(ops.headline)}</h2>
<div class="gj-ops-meta">
<div><strong>Current stage</strong>${esc(ops.currentStageLabel)}</div>
<div><strong>Next milestone</strong>${esc(ops.nextMilestone)}</div>
<div><strong>Recommended action</strong>${esc(ops.recommendedAction)}</div>
</div>
<p style="margin:0 0 12px"><a class="ge-btn ge-btn-ghost" href="/api/growth-engine/live-integration-proof?slug=${encodeURIComponent(slug)}" style="font-size:12px">Live Integration Proof →</a></p>
<h3 style="font-size:14px;margin:16px 0 8px">Today's tasks</h3>
${ops.todaysTasks.map(taskHtml).join("") || `<div class="gj-empty">No tasks right now — review your timeline below.</div>`}
<div class="gj-grid" style="margin-top:16px">
<div class="gj-stat"><strong>${ops.progress.indexing.indexed}</strong><span>Pages indexed</span><div class="gj-data-note">${esc(indexingNote)}</div></div>
<div class="gj-stat"><strong>${ops.progress.indexing.readyToSubmit}</strong><span>Ready to submit</span></div>
<div class="gj-stat"><strong>${ops.progress.rankings.visiblePages}</strong><span>Visible in search</span><div class="gj-data-note">${esc(rankingsNote)}</div></div>
<div class="gj-stat"><strong>${esc(ops.progress.rankings.visibilityStatus)}</strong><span>Visibility status</span></div>
</div>
<p style="font-size:13px;color:#64748b;margin-top:12px"><strong>Latest progress:</strong> ${esc(ops.progress.latestNote)}</p>
<p id="gjActionStatus" style="font-size:12px;color:#64748b;margin:0"></p>
</div>
${renderFounderPartnerWorkflowPanel(workflow)}
${renderWorkflowApiScript()}`;
}

function renderTimeline(journey: GrowthJourneyView): string {
  const foundation = journey.timeline.foundationSteps
    .map(
      (s) => `<div class="gj-timeline-item ${s.complete ? "complete" : ""}">
<div class="gj-timeline-label">Foundation</div>
<div class="gj-timeline-title">${esc(s.label)}</div>
<div class="gj-timeline-meta">${s.complete ? "✓ Complete" : "In progress"}</div>
</div>`,
    )
    .join("");

  const cycles = journey.timeline.cycles
    .map((c) => {
      const cls =
        c.status === "completed" ? "complete" : c.status === "in_progress" ? "active" : "recommended";
      return `<hr class="gj-divider"/>
<div class="gj-timeline-item ${cls}">
<div class="gj-timeline-label">Growth Cycle ${c.cycleNumber}</div>
<div class="gj-timeline-title">${esc(c.serviceName)}</div>
<div class="gj-timeline-meta">${esc(c.label)} · ${esc(GROWTH_CYCLE_STAGE_LABELS[c.currentStage] || c.currentStage)}</div>
</div>`;
    })
    .join("");

  const next =
    journey.nextRecommendation && !journey.currentCycle
      ? `<hr class="gj-divider"/>
<div class="gj-timeline-item recommended">
<div class="gj-timeline-label">Growth Cycle ${journey.timeline.cycles.length + 1}</div>
<div class="gj-timeline-title">${esc(journey.nextRecommendation.serviceName)}</div>
<div class="gj-timeline-meta">Recommended</div>
</div>`
      : "";

  return `<div class="ge-panel">
<h2>Growth Timeline</h2>
<p class="gj-section-note">Your ongoing growth programme — foundation intelligence, then continuous Growth Cycles.</p>
<div class="gj-timeline">${foundation}${cycles}${next}</div>
</div>`;
}

function renderStagePills(cycle: GrowthCycle): string {
  const currentIdx = cycle.stageHistory.findIndex((h) => h.stage === cycle.currentStage);
  return cycle.stageHistory
    .map((h, i) => {
      const cls = h.stage === cycle.currentStage ? "current" : i < currentIdx ? "done" : "";
      return `<span class="gj-stage ${cls}">${esc(GROWTH_CYCLE_STAGE_LABELS[h.stage] || h.stage)}</span>`;
    })
    .join("");
}

function renderCurrentCycle(journey: GrowthJourneyView): string {
  const cycle = journey.currentCycle;
  if (!cycle) {
    return `<div class="ge-panel">
<h2>Current Growth Cycle</h2>
<div class="gj-empty">No active Growth Cycle. Complete the foundation workflow or accept the next recommendation below.</div>
</div>`;
  }

  return `<div class="ge-panel">
<h2>Current Growth Cycle</h2>
<div class="gj-cycle-card">
<h3 class="gj-cycle-name">Cycle ${cycle.cycleNumber}: ${esc(cycle.recommendedService)}</h3>
<p style="margin:0 0 8px;font-size:14px;color:#334155">${esc(cycle.reasonRecommended)}</p>
<div class="gj-progress"><div class="gj-progress-fill" style="width:${journey.currentProgressPct}%"></div></div>
<p style="font-size:12px;color:#64748b;margin:0">${journey.currentProgressPct}% complete · ${esc(GROWTH_CYCLE_STAGE_LABELS[cycle.currentStage])}${journey.currentLaunchWeek ? ` · Launch week ${journey.currentLaunchWeek}` : ""}</p>
<div class="gj-stages">${renderStagePills(cycle)}</div>
<div class="gj-grid">
<div class="gj-stat"><strong>${cycle.generatedAssets.generated}</strong><span>Generated assets</span></div>
<div class="gj-stat"><strong>${cycle.publishedAssets.published}</strong><span>Published</span></div>
<div class="gj-stat"><strong>${cycle.indexedAssets.indexed}</strong><span>Indexed</span></div>
<div class="gj-stat"><strong>${cycle.reviewSummary.qualityApproved ? "✓" : "○"}</strong><span>Launch approved</span></div>
</div>
<p style="margin-top:14px"><a class="ge-btn ge-btn-primary" href="${esc(growthEngineContentPackageUrl(journey.slug, cycle.serviceId))}">Open content package →</a></p>
</div>
</div>`;
}

function renderCompletedCycles(journey: GrowthJourneyView): string {
  if (!journey.completedCycles.length) {
    return `<div class="ge-panel">
<h2>Completed Growth Cycles</h2>
<div class="gj-empty">Completed cycles appear here with lessons learned — your platform memory grows with every cycle.</div>
</div>`;
  }

  return `<div class="ge-panel">
<h2>Completed Growth Cycles</h2>
${journey.completedCycles
  .map(
    (c) => `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;background:#fff">
<strong>Cycle ${c.cycleNumber}: ${esc(c.recommendedService)}</strong>
<p style="margin:6px 0;font-size:13px;color:#64748b">${c.durationDays != null ? `${c.durationDays} days` : "Completed"} · ${c.indexedAssets.indexed} pages indexed</p>
${c.lessonsLearned.length ? `<ul style="margin:0;padding-left:18px;font-size:13px;color:#475569">${c.lessonsLearned.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
</div>`,
  )
  .join("")}
</div>`;
}

function renderLaunchPlan(plan: GrowthCycleLaunchPlan | null): string {
  if (!plan) {
    return `<div class="ge-panel">
<h2>Launch Plan</h2>
<div class="gj-empty">Launch plan is created automatically after generation, quality review, and approval — never before.</div>
</div>`;
  }

  const s = plan.schedule;
  return `<div class="ge-panel">
<h2>Launch Plan — ${esc(plan.serviceName)}</h2>
<p class="gj-section-note">${esc(s.rationale)}</p>
<p style="font-size:13px;font-weight:800;margin:0 0 12px">Recommended duration: ${s.recommendedWeeks} weeks</p>
<div class="gj-launch">
<h4>Publishing schedule</h4>
<ul>${s.publishing.map((m) => `<li><strong>Week ${m.week}:</strong> ${esc(m.title)} — ${esc(m.tasks.join("; "))}</li>`).join("")}</ul>
</div>
<div class="gj-grid" style="margin-top:12px">
<div class="gj-launch"><h4>Search Console</h4><ul>${s.searchConsolePlan.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
<div class="gj-launch"><h4>GBP schedule</h4><ul>${s.gbpSchedule.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
<div class="gj-launch"><h4>Social schedule</h4><ul>${s.socialSchedule.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
<div class="gj-launch"><h4>Progress reviews</h4><ul>${s.progressReviews.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
</div>
</div>`;
}

function renderNextRecommendation(journey: GrowthJourneyView): string {
  const next = journey.nextRecommendation;
  if (!next) {
    return `<div class="ge-panel">
<h2>Recommended Next Growth Cycle</h2>
<div class="gj-empty">No next recommendation available yet — complete current cycle or foundation steps.</div>
</div>`;
  }

  return `<div class="ge-panel">
<h2>Recommended Next Growth Cycle</h2>
<div class="gj-next">
<strong style="font-size:18px">${esc(next.serviceName)}</strong>
<p style="margin:8px 0;font-size:14px;color:#334155">${esc(next.reason)}</p>
<p style="margin:0;font-size:13px;color:#64748b">${esc(next.evidenceSummary)}</p>
${next.considersPreviousCycles ? `<p style="margin:8px 0 0;font-size:12px;color:#166534">✓ Recommendation considers your previous Growth Cycles</p>` : ""}
<div class="gj-rec-actions">
<a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${esc(journey.slug)}">Open Your Growth Plan →</a>
<button type="button" class="ge-btn ge-btn-ghost gj-decision" data-decision="accepted" data-service="${esc(next.serviceId)}">Accept recommendation</button>
<button type="button" class="ge-btn ge-btn-ghost gj-decision" data-decision="postponed" data-service="${esc(next.serviceId)}">Postpone</button>
</div>
</div>
<p style="margin-top:12px;font-size:14px"><strong>Expected business outcome:</strong> ${esc(journey.expectedBusinessOutcome)}</p>
<script>
(function(){
  const SLUG = ${JSON.stringify(journey.slug)};
  document.querySelectorAll('.gj-decision').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const serviceId = btn.getAttribute('data-service');
      const decision = btn.getAttribute('data-decision');
      if (!serviceId || !decision) return;
      try {
        const res = await fetch('/api/growth-engine/'+SLUG+'/cycle-recommendation/decision', {
          method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ serviceId, decision, detail: decision+' via dashboard' })
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error||'Failed');
        location.reload();
      } catch(e) { alert(e.message); }
    });
  });
})();
</script>
</div>`;
}

function renderTrackingPanels(slug: string): string {
  const indexing = readPharmacyIndexingSummary(slug);
  const visibility = readPharmacyVisibilityReport(slug);

  const indexingHtml = indexing
    ? `<div class="gj-grid">
<div class="gj-stat"><strong>${indexing.indexed}</strong><span>Indexed</span></div>
<div class="gj-stat"><strong>${indexing.readyToSubmit}</strong><span>Ready to submit</span></div>
<div class="gj-stat"><strong>${indexing.notIndexed}</strong><span>Not indexed</span></div>
</div>`
    : `<div class="gj-empty">Indexing data not available yet.</div>`;

  const visibilityHtml = visibility
    ? `<div class="gj-grid">
<div class="gj-stat"><strong>${visibility.visiblePageCount}</strong><span>Visible pages</span></div>
<div class="gj-stat"><strong>${visibility.trackedKeywords}</strong><span>Keywords tracked</span></div>
<div class="gj-stat"><strong>${visibility.estimatedVisibilityScore}</strong><span>Visibility score</span></div>
</div>`
    : `<div class="gj-empty">Visibility data not available yet.</div>`;

  return `<div class="ge-panel">
<h2>Monitoring</h2>
<p class="gj-section-note">Search indexing and visibility from your connected tracking — actions available above in Today's tasks.</p>
<h3 style="font-size:14px;margin:16px 0 8px">Indexing</h3>
${indexingHtml}
${visibility ? `<h3 style="font-size:14px;margin:16px 0 8px">Visibility</h3>${visibilityHtml}` : ""}
<p style="margin-top:14px"><a class="ge-btn ge-btn-ghost" href="${esc(growthEngineLegacyDashboardUrl(slug))}">Open full Growth Dashboard →</a></p>
</div>`;
}

function renderMonthlyLoop(): string {
  return `<div class="ge-panel">
<h2>Your Monthly Growth Programme</h2>
<p class="gj-section-note">PharmaConnect becomes more valuable every month as it learns from your Growth Cycles.</p>
<ol style="font-size:14px;color:#334155;line-height:1.8;margin:0;padding-left:20px">
<li><strong>Growth Cycle complete</strong> → Review results</li>
<li><strong>Recommend next Growth Cycle</strong> → Evidence-backed, never "what would you like?"</li>
<li><strong>Generate</strong> → Existing content engine</li>
<li><strong>Launch</strong> → Adaptive structured publishing</li>
<li><strong>Monitor</strong> → Indexing and visibility</li>
<li><strong>Repeat</strong> → Platform memory grows</li>
</ol>
</div>`;
}

export function renderGrowthJourneyDashboardPage(
  slug: string,
  options?: { prevUrl?: string },
): string {
  const framework = buildGrowthEngineFramework(slug);
  const journey = buildGrowthJourneyView(slug);
  const ops = buildOperationalHome(slug, journey);
  const workflow = buildFounderPartnerWorkflow(slug, journey.currentCycle?.serviceId);

  const body = `${renderOperationalHome(ops, slug, workflow)}
<div class="gj-consultant">
<h2>Your Growth Journey</h2>
<p>${esc(journey.consultantMessage)}</p>
<p class="gj-memory" style="margin-top:10px;color:#93c5fd">${journey.memoryEventCount} events in growth memory · ${journey.completedCycles.length} completed cycle${journey.completedCycles.length === 1 ? "" : "s"}</p>
</div>
${renderTimeline(journey)}
${renderCurrentCycle(journey)}
${renderLaunchPlan(journey.launchPlan)}
${renderCompletedCycles(journey)}
${renderNextRecommendation(journey)}
${renderTrackingPanels(slug)}
${renderMonthlyLoop()}
<form method="post" action="/api/growth-engine/${esc(slug)}/acknowledge/dashboard" style="margin-top:8px">
<button type="submit" class="ge-btn ge-btn-ghost">Mark dashboard as visited</button>
</form>`;

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Founder Partner Dashboard · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthJourneyDashboardCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:${commercialBlueChromeGradientCss()};color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Founder Partner Dashboard</h1>
<p>Your operational home for ${esc(slug)} — complete campaigns, publish live, and track progress without developer tools.</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "dashboard", {
  prevUrl: options?.prevUrl,
  nextLabel: "Growth Engine overview →",
})}
${body}
</div>
</body></html>`);
}

export { buildGrowthJourneyView };
