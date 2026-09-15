/**
 * Growth Engine Framework V1 — unified 7-step workflow navigation.
 */
import type { GrowthEngineFramework, GrowthEngineStepId } from "./growthEngineFrameworkService.ts";
import {
  CUSTOMER_REPORT_STEP_IDS,
  GROWTH_ENGINE_STEPS,
  isCustomerVisibleInStepper,
} from "./growthEngineFrameworkService.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function growthEngineWorkflowCss(): string {
  return `${commercialBlueUiBaselineCss()}
.ge-shell{max-width:1040px;margin:0 auto;padding:24px 20px 80px}
.ge-header-band{background:${commercialBlueChromeGradientCss()};color:#fff;padding:20px 24px;border-radius:16px;margin-bottom:20px}
.ge-header-band h1{margin:0 0 6px;font-size:24px}
.ge-header-band p{margin:0;color:#dbeafe;font-size:14px}
.ge-progress{margin:16px 0}
.ge-progress-bar{height:10px;background:rgba(255,255,255,.2);border-radius:999px;overflow:hidden}
.ge-progress-fill{height:100%;background:linear-gradient(90deg,#34d399,#059669);transition:width .3s}
.ge-progress-meta{display:flex;justify-content:space-between;font-size:12px;color:#cbd5e1;margin-top:8px;font-weight:700}
.ge-stepper{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:20px 0}
.ge-step{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff;text-decoration:none;color:inherit;display:block;transition:border-color .2s,box-shadow .2s}
.ge-step:hover{border-color:#93c5fd;box-shadow:0 4px 12px rgba(15,23,42,.06)}
.ge-step.active{border-color:#005eb8;background:#eff6ff}
.ge-step.complete{border-color:#bbf7d0;background:#f0fdf4}
.ge-step-num{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase}
.ge-step-title{font-size:13px;font-weight:800;color:#0f172a;margin:4px 0 2px}
.ge-step-status{font-size:11px;color:#64748b}
.ge-step-pct{font-size:11px;font-weight:800;color:#005eb8;margin-top:4px}
.ge-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px 24px;margin-bottom:18px;box-shadow:0 6px 20px rgba(15,23,42,.04)}
.ge-panel h2{margin:0 0 8px;font-size:18px}
.ge-lead{color:#64748b;font-size:14px;margin:0 0 16px;line-height:1.6}
.ge-nav-bar{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;margin:20px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px}
.ge-btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff;cursor:pointer}
.ge-btn-primary{background:#005eb8;border-color:#005eb8;color:#fff}
.ge-btn-ghost{background:#f1f5f9}
.ge-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ge-grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.ge-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fafbfc}
.ge-card h3{margin:0 0 6px;font-size:14px}
.ge-card .ge-placeholder{font-size:11px;font-weight:800;text-transform:uppercase;color:#94a3b8;background:#f1f5f9;padding:3px 8px;border-radius:999px;display:inline-block;margin-bottom:8px}
.ge-competitor{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff}
.ge-competitor-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}
.ge-competitor-name{font-size:16px;font-weight:800;margin:0}
.ge-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:#64748b;margin:8px 0}
.ge-pill{font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;background:#eff6ff;color:#1e40af}
.ge-import-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;font-size:13px}
.ge-import-badge{font-size:10px;font-weight:800;text-transform:uppercase;padding:2px 8px;border-radius:999px}
.ge-import-badge.imported{background:#bbf7d0;color:#065f46}
.ge-import-badge.confirmed{background:#dbeafe;color:#1e40af}
.ge-import-badge.missing{background:#fecaca;color:#991b1b}
.ge-import-badge.review{background:#fef3c7;color:#92400e}
.ge-dash-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.ge-dash-nav a{padding:8px 14px;border-radius:999px;border:1px solid #e2e8f0;font-size:12px;font-weight:700;text-decoration:none;color:#334155;background:#fff}
.ge-dash-nav a.active{background:#005eb8;color:#fff;border-color:#005eb8}
@media(max-width:720px){.ge-grid-2{grid-template-columns:1fr}}`;
}

export function renderGrowthEngineStepper(framework: GrowthEngineFramework, activeId: GrowthEngineStepId): string {
  let reportNum = 0;
  return GROWTH_ENGINE_STEPS.filter((meta) => isCustomerVisibleInStepper(meta.id)).map((meta) => {
    const state = framework.steps.find((s) => s.id === meta.id);
    const isReport = (CUSTOMER_REPORT_STEP_IDS as readonly string[]).includes(meta.id);
    if (isReport) reportNum += 1;
    const stepLabel = isReport ? `Report ${reportNum}` : `Step ${meta.step}`;
    const cls = [
      "ge-step",
      meta.id === activeId ? "active" : "",
      state?.status === "complete" ? "complete" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const statusLabel =
      state?.status === "complete" ? "Complete" : state?.status === "in_progress" ? "In progress" : "Not started";
    return `<a class="${cls}" href="${esc(state?.url || "#")}">
<span class="ge-step-num">${esc(stepLabel)}</span>
<div class="ge-step-title">${esc(state?.title || meta.title)}</div>
<div class="ge-step-status">${esc(statusLabel)}</div>
<div class="ge-step-pct">${state?.completionPct ?? 0}%</div>
</a>`;
  }).join("");
}

function customerProgressLabel(framework: GrowthEngineFramework, activeId: GrowthEngineStepId): string {
  const copy = growthEnginePlatformCopy(framework.slug);
  const reportIdx = CUSTOMER_REPORT_STEP_IDS.indexOf(activeId as (typeof CUSTOMER_REPORT_STEP_IDS)[number]);
  if (reportIdx >= 0) return `Report ${reportIdx + 1} of ${CUSTOMER_REPORT_STEP_IDS.length}`;
  if (activeId === "generate") return copy.generateStepSubtitle;
  if (activeId === "dashboard") return "Track and publish";
  const current = framework.steps.find((s) => s.id === framework.currentStep);
  return current?.title || copy.programmeLabel;
}

export function renderGrowthEngineProgress(framework: GrowthEngineFramework, activeId?: GrowthEngineStepId): string {
  const copy = growthEnginePlatformCopy(framework.slug);
  const reportSteps = framework.steps.filter((s) => (CUSTOMER_REPORT_STEP_IDS as readonly string[]).includes(s.id));
  const reportPct = Math.round(reportSteps.reduce((sum, s) => sum + s.completionPct, 0) / reportSteps.length);
  const progressLabel = activeId ? customerProgressLabel(framework, activeId) : `${reportPct}% of reports complete`;
  return `<div class="ge-progress">
<div class="ge-progress-bar"><div class="ge-progress-fill" style="width:${framework.overallCompletionPct}%"></div></div>
<div class="ge-progress-meta"><span>${esc(copy.programmeLabel)} · ${framework.overallCompletionPct}% complete</span><span>${esc(progressLabel)}</span></div>
</div>`;
}

export function renderGrowthEngineNavBar(
  slug: string,
  framework: GrowthEngineFramework,
  activeId: GrowthEngineStepId,
  options?: { prevUrl?: string; nextUrl?: string; nextLabel?: string },
): string {
  const copy = growthEnginePlatformCopy(slug);
  const prev = options?.prevUrl ? `<a class="ge-btn ge-btn-ghost" href="${esc(options.prevUrl)}">← Previous</a>` : "<span></span>";
  const next = options?.nextUrl
    ? `<a class="ge-btn ge-btn-primary" href="${esc(options.nextUrl)}">${esc(options.nextLabel || "Continue →")}</a>`
    : "";
  return `${renderGrowthEngineProgress(framework, activeId)}
<nav class="ge-stepper" aria-label="${esc(copy.stepperAriaLabel)}">${renderGrowthEngineStepper(framework, activeId)}</nav>
<div class="ge-nav-bar">${prev}${next}</div>`;
}
