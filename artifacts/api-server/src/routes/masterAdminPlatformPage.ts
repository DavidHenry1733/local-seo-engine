/**
 * Master Admin Platform V1 — instant shell; data loaded asynchronously via API.
 */
import { Router } from "express";
import { listLockedCommercialServicesWithGenerationReadiness } from "../../../../src/pharmacy/masterAdminServiceGenerationReadinessService.ts";
import { requireAdmin } from "../middlewares/requireAuth.js";

const router = Router();

function renderLockedServiceOptions(): string {
  return listLockedCommercialServicesWithGenerationReadiness()
    .map((s) => {
      if (s.generationReady) {
        return `<option value="${s.serviceId}">${s.serviceName} — Ready</option>`;
      }
      const missing = s.missingComponents.join("; ");
      return `<option value="" disabled data-service-id="${s.serviceId}">${s.serviceName} — Setup Required — ${missing}</option>`;
    })
    .join("");
}

export function renderMasterAdminPlatformShell(): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Master Admin · PharmaConnect</title>
<style>
/* pharmaconnect-internal-admin-theme-black */
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b1220;color:#e2e8f0;min-height:100vh}
.topbar{background:linear-gradient(90deg,#0f172a,#1e293b);padding:0 24px;display:flex;align-items:center;height:58px;gap:14px;border-bottom:1px solid #334155}
.topbar-logo{font-size:1.05rem;font-weight:800;color:#fff}
.admin-pill{background:#f59e0b;color:#0f172a;font-size:.65rem;font-weight:900;text-transform:uppercase;padding:4px 10px;border-radius:999px}
.topbar-sub{color:#94a3b8;font-size:.82rem;margin-left:4px}
.topbar-nav{margin-left:auto;display:flex;gap:8px;align-items:center}
.topbar-nav a,.topbar-nav button{color:#cbd5e1;background:transparent;border:1px solid #475569;border-radius:8px;padding:6px 12px;font-size:.78rem;font-weight:600;cursor:pointer;text-decoration:none}
.topbar-nav a:hover,.topbar-nav button:hover{background:#1e293b;color:#fff}
.load-ms{font-size:.68rem;color:#64748b;margin-left:8px}
.layout{display:grid;grid-template-columns:1fr 320px;gap:18px;max-width:1600px;margin:20px auto;padding:0 18px 40px}
.main-col{min-width:0}
.side-col{display:flex;flex-direction:column;gap:16px}
.panel{background:#111827;border:1px solid #334155;border-radius:14px;padding:16px 18px}
.panel h2{font-size:.95rem;font-weight:800;margin-bottom:12px;color:#f8fafc}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.stat{background:#1e293b;border-radius:10px;padding:12px;border:1px solid #334155}
.stat-val{font-size:1.4rem;font-weight:800;color:#38bdf8}
.stat-label{font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;margin-top:4px}
.lifecycle-flow{display:flex;flex-direction:column;gap:4px;margin-bottom:14px;padding:12px;background:#0f172a;border-radius:10px;border:1px dashed #475569;max-height:220px;overflow:auto}
.workflow-row{display:flex;align-items:flex-start;gap:8px;font-size:.74rem;padding:4px 0;border-bottom:1px solid #1e293b}
.workflow-row:last-child{border-bottom:none}
.workflow-icon{width:18px;text-align:center;font-weight:800;flex-shrink:0}
.workflow-icon.complete{color:#4ade80}
.workflow-icon.current{color:#38bdf8}
.workflow-icon.pending{color:#64748b}
.workflow-label{color:#e2e8f0;flex:1}
.workflow-meta{font-size:.65rem;color:#64748b;margin-top:2px}
.workflow-count{font-size:.68rem;color:#94a3b8;margin-left:6px}
.toolbar{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;align-items:center}
.toolbar input,.toolbar select{background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px 10px;font-size:.82rem}
.btn{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:.82rem;font-weight:700;cursor:pointer}
.btn.primary{background:#16a34a}
.btn.primary:hover{background:#15803d}
.btn:hover{background:#1d4ed8}
.btn.secondary{background:#334155}
.btn:disabled{opacity:.45;cursor:not-allowed}
.table-wrap{overflow:auto;border-radius:10px;border:1px solid #334155;min-height:120px}
table{width:100%;border-collapse:collapse;font-size:.78rem}
th,td{padding:10px;text-align:left;border-bottom:1px solid #1f2937;vertical-align:top}
th{background:#0f172a;color:#94a3b8;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;position:sticky;top:0}
.customer-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:4px 0}
.customer-card{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:180px}
.customer-card.archived{opacity:.85;border-color:#475569}
.customer-card-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.customer-card-head h3{margin:0;font-size:.92rem;font-weight:800;color:#f8fafc;line-height:1.3}
.customer-card-meta{font-size:.72rem;color:#94a3b8;line-height:1.45}
.customer-card-meta div{margin:3px 0}
.customer-card-progress{margin-top:auto}
.customer-card-progress-bar{height:6px;background:#1e293b;border-radius:999px;overflow:hidden;margin-top:6px}
.customer-card-progress-bar>div{height:100%;background:#38bdf8;border-radius:999px}
.customer-card-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.customer-card-actions .btn-grow{flex:1;min-width:140px;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:10px 12px;font-size:.78rem;font-weight:800;cursor:pointer}
.customer-card-actions .btn-grow:hover{background:#15803d}
.customer-card-actions .btn-archive{background:#334155;color:#cbd5e1;border:none;border-radius:10px;padding:8px 12px;font-size:.72rem;font-weight:600;cursor:pointer}
.customer-card-actions .btn-restore{background:#334155;color:#7dd3fc;border:none;border-radius:10px;padding:8px 12px;font-size:.72rem;font-weight:600;cursor:pointer}
.status-pill-row{display:flex;flex-wrap:wrap;gap:6px}
.status-pill{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:999px;background:#1e293b;color:#cbd5e1;border:1px solid #334155}
.status-pill.ok{background:#052e16;color:#86efac;border-color:#166534}
.status-pill.warn{background:#422006;color:#fcd34d;border-color:#854d0e}
.list-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.list-tab{background:#1e293b;border:1px solid #334155;color:#94a3b8;border-radius:999px;padding:8px 14px;font-size:.72rem;font-weight:700;cursor:pointer}
.list-tab.active{background:#2563eb;border-color:#3b82f6;color:#fff}
.list-hero{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
.list-hero h2{margin:0;font-size:1.05rem;font-weight:800}
.btn-new-pharmacy{background:#16a34a;color:#fff;border:none;border-radius:12px;padding:14px 22px;font-size:.88rem;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(22,163,74,.35)}
.btn-new-pharmacy:hover{background:#15803d}
.list-count{font-size:.72rem;color:#64748b;margin-left:8px;font-weight:600}
.sub{font-size:.68rem;color:#64748b;margin-top:2px}
.pill{display:inline-block;padding:3px 8px;border-radius:999px;font-size:.68rem;font-weight:700;background:#334155}
.health-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}
.health-healthy{background:#22c55e}
.health-warning{background:#f59e0b}
.health-offline{background:#ef4444}
.health-card{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px;margin-bottom:8px}
.health-head{display:flex;align-items:center;gap:8px;font-size:.82rem;margin-bottom:4px}
.health-status{font-size:.75rem;color:#38bdf8;font-weight:700}
.health-detail,.health-time{font-size:.68rem;color:#94a3b8;margin-top:3px}
.empty{padding:24px;text-align:center;color:#64748b}
.loading{padding:20px;text-align:center;color:#64748b;font-size:.85rem}
.modal-backdrop{position:fixed;inset:0;background:rgba(2,6,23,.72);display:none;align-items:center;justify-content:center;z-index:100;padding:20px}
.modal-backdrop.open{display:flex}
#onboardingIntakeModal{z-index:110}
#onboardingAreasReviewModal{z-index:120}
#cirModal{z-index:130}
#bprModal{z-index:125}
#cqrModal{z-index:125}
#cgeModal{z-index:125}
#idxModal{z-index:125}
#perfModal{z-index:125}
.modal{background:#111827;border:1px solid #475569;border-radius:14px;width:min(960px,100%);max-height:90vh;overflow:auto;padding:18px}
.modal h3{font-size:1.1rem;font-weight:800;margin-bottom:12px}
.modal-grid{display:grid;grid-template-columns:1fr 280px;gap:16px}
.detail-lifecycle{display:flex;flex-direction:column;gap:2px;margin:10px 0 14px;padding:10px;background:#0f172a;border-radius:10px;border:1px solid #334155;max-height:280px;overflow:auto}
.detail-step{font-size:.72rem;padding:6px 8px;border-radius:6px;display:flex;align-items:flex-start;gap:8px;color:#94a3b8}
.detail-step.active{background:#1e3a5f;color:#e0f2fe;font-weight:700}
.detail-step.complete{color:#86efac}
.detail-step.pending{color:#64748b}
.guidance-box{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px;margin-bottom:10px;font-size:.72rem;color:#cbd5e1}
.guidance-box h5{font-size:.68rem;text-transform:uppercase;color:#64748b;margin:8px 0 4px}
.guidance-box h5:first-child{margin-top:0}
.guidance-box ul{margin:0 0 0 16px;padding:0}
.history-panel{font-size:.68rem;max-height:120px;overflow:auto;margin-top:8px}
.continue-btn{background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px 16px;font-size:.88rem;font-weight:800;width:100%;cursor:pointer;margin-bottom:10px}
.continue-btn:hover:not(:disabled){background:#15803d}
.continue-btn:disabled{opacity:.45;cursor:not-allowed;background:#334155}
.orchestration-summary{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:10px;font-size:.74rem}
.orchestration-summary div{margin:4px 0;color:#cbd5e1}
.orchestration-summary .label{color:#64748b;font-size:.65rem;text-transform:uppercase;letter-spacing:.04em}
.block-reason{color:#f87171;font-size:.72rem;margin-top:6px}
.job-status{background:#1e293b;border:1px solid #475569;border-radius:8px;padding:8px;font-size:.72rem;margin-bottom:10px}
.action-group h4{font-size:.72rem;text-transform:uppercase;color:#64748b;margin-bottom:6px}
.action-btn{display:block;width:100%;text-align:left;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:8px;padding:8px 10px;font-size:.78rem;margin-bottom:4px;cursor:pointer}
.action-btn:hover:not(:disabled){background:#334155}
.action-btn:disabled{opacity:.4;cursor:not-allowed}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.tab{background:#0f172a;border:1px solid #334155;color:#94a3b8;border-radius:8px;padding:6px 10px;font-size:.72rem;cursor:pointer}
.tab.active{background:#2563eb;border-color:#2563eb;color:#fff}
.tab-panel{display:none;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px;font-size:.75rem;max-height:260px;overflow:auto}
.tab-panel.active{display:block}
.tab-panel pre{white-space:pre-wrap;word-break:break-word;color:#cbd5e1}
.audit-table{font-size:.72rem;width:100%}
.audit-table td,.audit-table th{padding:6px 8px}
.status-success{color:#4ade80}.status-error{color:#f87171}.status-warning{color:#fbbf24}
.status-running{color:#38bdf8}.status-queued{color:#94a3b8}.status-completed{color:#4ade80}.status-failed{color:#f87171}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.form-grid label{display:flex;flex-direction:column;gap:4px;font-size:.72rem;color:#94a3b8}
.form-grid input,.form-grid textarea{background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px;font-size:.82rem}
.form-grid textarea{min-height:60px;grid-column:1/-1}
.toast{position:fixed;bottom:20px;right:20px;background:#1e293b;border:1px solid #475569;color:#e2e8f0;padding:12px 16px;border-radius:10px;font-size:.82rem;display:none;z-index:200;max-width:360px}
.toast.show{display:block}
.job-row{font-size:.72rem;padding:6px 0;border-bottom:1px solid #1f2937}
@media(max-width:1100px){.layout{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.modal-grid{grid-template-columns:1fr}}
.bpr-layout{display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start}
.bpr-main{min-width:0}
.bpr-hero{background:linear-gradient(135deg,#0f172a,#1e1b4b);border:1px solid #4338ca;border-radius:12px;padding:16px;margin-bottom:12px}
.bpr-hero h4{font-size:1rem;font-weight:800;color:#f8fafc;margin:0 0 12px}
.bpr-hero-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;font-size:.78rem}
.bpr-hero-grid .stat{background:#111827;border:1px solid #334155;border-radius:8px;padding:10px}
.bpr-hero-grid .stat .lbl{color:#94a3b8;font-size:.65rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.bpr-hero-grid .stat .val{font-weight:700;color:#e2e8f0}
.bpr-hero-grid .stat .val.ok{color:#4ade80}
.bpr-hero-grid .stat .val.warn{color:#fbbf24}
.bpr-hero-status{margin-top:12px;padding-top:12px;border-top:1px solid #334155;font-size:.88rem;font-weight:800}
.bpr-accept-safe-btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:12px 16px;font-size:.82rem;font-weight:800;width:100%;cursor:pointer;margin-bottom:14px}
.bpr-accept-safe-btn:hover{background:#1d4ed8}
.bpr-action-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.bpr-action-item{background:#0f172a;border:1px solid #334155;border-radius:10px;overflow:hidden}
.bpr-action-item summary{cursor:pointer;padding:12px 14px;font-size:.82rem;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:8px;align-items:center}
.bpr-action-item summary::-webkit-details-marker{display:none}
.bpr-action-item summary::after{content:'+';color:#64748b;font-weight:400}
.bpr-action-item[open] summary::after{content:'−'}
.bpr-action-body{padding:0 14px 14px;font-size:.74rem;border-top:1px solid #1f2937}
.bpr-approval-panel{position:sticky;top:12px;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;font-size:.78rem}
.bpr-approval-panel h4{font-size:.72rem;text-transform:uppercase;color:#64748b;margin:0 0 10px;letter-spacing:.04em}
.bpr-panel-stat{margin:8px 0;padding:8px;background:#111827;border-radius:8px;border:1px solid #1f2937}
.bpr-panel-stat .lbl{color:#64748b;font-size:.62rem;text-transform:uppercase}
.bpr-panel-checklist{margin:10px 0 14px;padding-left:18px;color:#cbd5e1;font-size:.72rem}
.bpr-panel-checklist li{margin:4px 0}
.bpr-approve-btn{background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px;font-size:.85rem;font-weight:800;width:100%;cursor:pointer}
.bpr-approve-btn:disabled{opacity:.45;cursor:not-allowed;background:#334155}
.bpr-approve-reason{font-size:.72rem;color:#f87171;margin-top:10px;line-height:1.5}
.bpr-section{margin:14px 0}
.bpr-section h4{font-size:.72rem;text-transform:uppercase;color:#64748b;margin-bottom:8px;letter-spacing:.04em}
.bpr-cards{display:flex;flex-direction:column;gap:10px;max-height:48vh;overflow:auto;padding-right:4px}
.bpr-card{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px;font-size:.74rem}
.bpr-card-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px;font-weight:700}
.bpr-card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}
.bpr-card-grid div{background:#111827;border:1px solid #1f2937;border-radius:6px;padding:6px}
.bpr-card-grid .lbl{color:#64748b;font-size:.62rem;text-transform:uppercase;margin-bottom:2px}
.bpr-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.bpr-card-actions button{font-size:.68rem;background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:5px 8px;cursor:pointer}
.bpr-card-actions input[type=text],.bpr-card-actions input[type=email],.bpr-card-actions input[type=url],.bpr-card-actions input[type=tel]{flex:1;min-width:140px;background:#111827;border:1px solid #475569;color:#e2e8f0;border-radius:6px;padding:6px;font-size:.72rem}
.bpr-evidence{margin-top:8px;font-size:.66rem;color:#94a3b8}
.bpr-evidence summary{cursor:pointer;color:#cbd5e1}
.bpr-save-status{font-size:.72rem;color:#94a3b8;display:block;margin-top:8px;text-align:center}
.bpr-save-status.saved{color:#4ade80}.bpr-save-status.saving{color:#38bdf8}.bpr-save-status.failed{color:#f87171}
.bpr-reviewed-list{font-size:.68rem;color:#64748b;max-height:120px;overflow:auto}
.bpr-reviewed-list div{padding:4px 0;border-bottom:1px solid #1f2937}
.bpr-customer-banner{background:#1e1b4b;border:1px solid #4338ca;border-radius:10px;padding:12px;margin-bottom:10px}
.detail-collapse{background:#0f172a;border:1px solid #334155;border-radius:10px;margin-bottom:8px;overflow:hidden}
.detail-collapse summary{cursor:pointer;padding:10px 12px;font-size:.72rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;list-style:none}
.detail-collapse summary::-webkit-details-marker{display:none}
.detail-collapse .detail-collapse-body{padding:0 12px 12px}
.bpr-conflict{color:#fbbf24;font-weight:700}
.bpr-match{color:#4ade80}
.bpr-missing{color:#f87171}
.bpr-ready{color:#4ade80;font-weight:800}
.bpr-not-ready{color:#fbbf24;font-weight:800}
.bpr-btn-review{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:10px 14px;font-size:.82rem;font-weight:800;cursor:pointer;width:100%}
.bpr-btn-review:hover{background:#6d28d9}
.bpr-error-panel{background:#1f1315;border:1px solid #7f1d1d;border-radius:12px;padding:20px;text-align:center}
.bpr-error-panel h4{color:#fca5a5;font-size:.95rem;margin:0 0 10px}
.bpr-error-detail{color:#94a3b8;font-size:.78rem;margin-bottom:16px;line-height:1.5}
.bpr-error-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.bpr-approval-error{background:#1f1315;border:1px solid #7f1d1d;border-radius:8px;padding:10px;margin-top:10px;font-size:.72rem;color:#fca5a5;line-height:1.5}
.bpr-approval-error-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.local-coverage-subtitle{font-size:.74rem;color:#94a3b8;margin:0 0 12px;line-height:1.45}
.local-coverage-summary{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
.local-coverage-stat{background:#111827;border:1px solid #334155;border-radius:8px;padding:10px}
.local-coverage-stat .lbl{color:#64748b;font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.local-coverage-stat .val{font-weight:800;font-size:.92rem;color:#e2e8f0}
.local-coverage-stat .val.ready{color:#4ade80}
.local-coverage-stat .val.pending{color:#fbbf24}
.local-coverage-ready{background:#052e16;border:1px solid #166534;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:.78rem;font-weight:800;color:#4ade80;display:none}
.local-coverage-area-table{width:100%;font-size:.72rem;border-collapse:collapse;margin-bottom:10px}
.local-coverage-area-table th,.local-coverage-area-table td{padding:8px 10px;border-bottom:1px solid #1f2937;text-align:left;vertical-align:middle}
.local-coverage-area-table th{color:#64748b;font-size:.62rem;text-transform:uppercase}
.local-coverage-badge{display:inline-block;background:#1e3a5f;color:#7dd3fc;border-radius:999px;padding:2px 8px;font-size:.62rem;font-weight:700;margin-left:6px}
.local-coverage-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.local-coverage-actions button{font-size:.72rem}
.local-coverage-actions .btn.primary{font-weight:800}
.cqr-btn-review{background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:10px 14px;font-size:.82rem;font-weight:800;cursor:pointer;width:100%}
.cqr-btn-review:hover{background:#0284c7}
.cqr-customer-banner{background:#0c4a6e;border:1px solid #0369a1;border-radius:10px;padding:12px;margin-bottom:10px}
.cqr-layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
.cqr-main{min-width:0}
.cqr-hero{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:12px}
.cqr-hero h4{margin:0 0 10px;font-size:1rem;color:#e2e8f0}
.cqr-summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
.cqr-stat{background:#111827;border:1px solid #334155;border-radius:8px;padding:10px}
.cqr-stat .lbl{color:#64748b;font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.cqr-stat .val{font-weight:800;font-size:.88rem;color:#e2e8f0}
.cqr-stat .val.pass{color:#4ade80}.cqr-stat .val.warn{color:#fbbf24}.cqr-stat .val.fail{color:#f87171}
.cqr-overall{font-size:.92rem;font-weight:800;padding:10px 12px;border-radius:10px;margin-top:8px;text-align:center}
.cqr-overall.ready{background:#052e16;color:#4ade80;border:1px solid #166534}
.cqr-overall.blocked{background:#1f1315;color:#fca5a5;border:1px solid #7f1d1d}
.cqr-section{margin:12px 0}
.cqr-section h4{font-size:.72rem;text-transform:uppercase;color:#64748b;margin:0 0 8px;letter-spacing:.04em}
.cqr-totals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cqr-checks{display:flex;flex-direction:column;gap:6px}
.cqr-check{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;background:#111827;border:1px solid #1f2937;border-radius:8px;font-size:.74rem}
.cqr-check .status{font-weight:800;font-size:.68rem}
.cqr-check .status.PASS{color:#4ade80}.cqr-check .status.WARNING{color:#fbbf24}.cqr-check .status.FAIL{color:#f87171}
.cqr-list{margin:0;padding-left:18px;font-size:.74rem;color:#cbd5e1}
.cqr-list li{margin:4px 0}
.cqr-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.cqr-approval-panel{position:sticky;top:12px;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;font-size:.78rem}
.cqr-approval-panel h4{font-size:.72rem;text-transform:uppercase;color:#64748b;margin:0 0 10px;letter-spacing:.04em}
.cqr-approve-btn{background:#16a34a;color:#fff;border:none;border-radius:10px;padding:12px;font-size:.85rem;font-weight:800;width:100%;cursor:pointer;margin-top:10px}
.cqr-approve-btn:disabled{opacity:.45;cursor:not-allowed;background:#334155}
.cqr-approve-btn.spg-generate-ready:not(:disabled){opacity:1;cursor:pointer;background:#16a34a;box-shadow:0 0 0 2px rgba(74,222,128,.35)}
.cqr-publish-btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px;font-size:.78rem;font-weight:700;width:100%;cursor:pointer;margin-top:8px}
.cqr-inspection-progress{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.cqr-inspection-table-wrap{overflow:auto;border:1px solid #334155;border-radius:10px}
.cqr-inspection-table{width:100%;border-collapse:collapse;font-size:.72rem}
.cqr-inspection-table th,.cqr-inspection-table td{padding:8px 10px;border-bottom:1px solid #1f2937;text-align:left;vertical-align:top}
.cqr-inspection-table th{color:#64748b;font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;background:#0f172a;position:sticky;top:0}
.cqr-inspection-table tr:last-child td{border-bottom:none}
.cqr-preview-btn{background:#0ea5e9;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:.68rem;font-weight:700;cursor:pointer;white-space:nowrap}
.cqr-preview-btn:disabled{opacity:.45;cursor:not-allowed;background:#334155}
.cqr-review-select,.cqr-notes-input{background:#111827;border:1px solid #334155;border-radius:6px;color:#e2e8f0;font-size:.68rem;padding:6px 8px;width:100%}
.cqr-notes-input{min-width:140px}
.cqr-review-status-approved{color:#4ade80;font-weight:700}
.cqr-review-status-needs{color:#f87171;font-weight:700}
.cqr-review-status-pending{color:#94a3b8;font-weight:700}
.cqr-gen-generated{color:#4ade80;font-weight:700}
.cqr-gen-missing{color:#f87171;font-weight:700}
.cqr-publish-btn:disabled{opacity:.45;cursor:not-allowed;background:#334155}
.cpr-btn-review{background:#f59e0b;color:#111827;border:none;border-radius:8px;padding:10px 14px;font-size:.82rem;font-weight:800;cursor:pointer;width:100%}
.cpr-btn-review:hover{background:#d97706}
.cpr-customer-banner{background:#422006;border:1px solid #b45309;border-radius:10px;padding:12px;margin-bottom:10px}
.cdc-btn-review{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:10px 14px;font-size:.82rem;font-weight:800;cursor:pointer;width:100%}
.cdc-btn-review:hover{background:#6d28d9}
.cdc-customer-banner{background:#3b0764;border:1px solid #7c3aed;border-radius:10px;padding:12px;margin-bottom:10px}
.cdc-config-form{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}
.cdc-config-form label{display:block;font-size:.62rem;text-transform:uppercase;color:#64748b;margin-bottom:4px;letter-spacing:.04em}
.cdc-config-form input,.cdc-config-form select{width:100%;background:#111827;border:1px solid #334155;border-radius:8px;color:#e2e8f0;padding:8px 10px;font-size:.78rem}
.cdc-method-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}
.cdc-method-card{background:#111827;border:1px solid #334155;border-radius:8px;padding:10px;font-size:.72rem;cursor:pointer}
.cdc-method-card.selected{border-color:#7c3aed;background:#1e1b4b}
.cdc-method-card.unavailable{opacity:.45;cursor:not-allowed}
.cpr-layout{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
.cpr-hero{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:12px}
.cpr-section{margin:12px 0}
.cpr-section h4{font-size:.72rem;text-transform:uppercase;color:#64748b;margin:0 0 8px;letter-spacing:.04em}
.cpr-progress-stage{font-size:.72rem;padding:6px 8px;border-bottom:1px solid #1f2937;display:flex;justify-content:space-between;gap:8px}
.cpr-progress-stage.running{color:#38bdf8;font-weight:700}
.cpr-progress-stage.completed{color:#4ade80}
.cpr-progress-stage.failed{color:#f87171;font-weight:700}
.cpr-confirm-box{background:#111827;border:1px solid #334155;border-radius:10px;padding:12px;margin:12px 0;font-size:.74rem}
@media(max-width:900px){.cpr-layout{grid-template-columns:1fr}}
@media(max-width:900px){.cqr-layout{grid-template-columns:1fr}.cqr-approval-panel{position:static}}
@media(max-width:900px){.bpr-layout{grid-template-columns:1fr}.bpr-approval-panel{position:static}}
.ci-layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}
.ci-main{min-width:0}
.ci-hero{background:linear-gradient(135deg,#1e1b4b,#0f172a);border:1px solid #4c1d95;border-radius:14px;padding:18px;margin-bottom:14px}
.ci-hero h3{margin:0 0 6px;font-size:1.15rem;color:#f8fafc}
.ci-hero p{margin:0;font-size:.82rem;color:#c4b5fd;line-height:1.5}
.ci-status{display:inline-block;background:#312e81;color:#e9d5ff;font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:999px;margin-top:10px}
.ci-section{background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;margin-bottom:12px}
.ci-section h4{margin:0 0 8px;font-size:.88rem;color:#f1f5f9}
.ci-section .ci-narrative{font-size:.78rem;color:#94a3b8;line-height:1.55;margin-bottom:10px}
.ci-section ul{margin:0;padding-left:18px;font-size:.76rem;color:#cbd5e1;line-height:1.55}
.ci-section li{margin:5px 0}
.ci-exec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.ci-exec-card{background:#111827;border:1px solid #334155;border-radius:10px;padding:12px}
.ci-exec-card .lbl{font-size:.62rem;text-transform:uppercase;color:#64748b;letter-spacing:.04em;margin-bottom:4px}
.ci-exec-card .val{font-size:.8rem;color:#e2e8f0;line-height:1.45}
.ci-issue-block{background:#1f1315;border:1px solid #7f1d1d;border-radius:10px;padding:12px;margin-bottom:10px}
.ci-issue-rec{background:#1a1f2e;border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:10px}
.ci-issue-hist{background:#111827;border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:10px}
.ci-issue-block h5,.ci-issue-rec h5,.ci-issue-hist h5{font-size:.68rem;text-transform:uppercase;margin:0 0 8px;letter-spacing:.04em}
.ci-issue-block h5{color:#fca5a5}.ci-issue-rec h5{color:#7dd3fc}.ci-issue-hist h5{color:#94a3b8}
.ci-item{margin:6px 0;font-size:.74rem;color:#cbd5e1}
.ci-item strong{color:#f8fafc;display:block;margin-bottom:2px}
.ci-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.ci-stat{background:#111827;border:1px solid #334155;border-radius:8px;padding:10px;text-align:center}
.ci-stat .n{font-size:1.1rem;font-weight:800;color:#38bdf8}
.ci-stat .l{font-size:.62rem;color:#64748b;margin-top:2px}
.ci-approval-panel{position:sticky;top:12px;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px}
.ci-approval-panel h4{font-size:.72rem;text-transform:uppercase;color:#64748b;margin:0 0 10px}
.ci-tech-log{display:none;margin-top:12px;font-size:.68rem;color:#64748b;max-height:180px;overflow:auto;background:#0b1220;border:1px solid #334155;border-radius:8px;padding:10px}
.ci-tech-log.open{display:block}
.ci-metric-table{width:100%;border-collapse:collapse;font-size:.72rem;margin:8px 0}
.ci-metric-table th,.ci-metric-table td{border:1px solid #334155;padding:8px;text-align:left;vertical-align:top}
.ci-metric-table th{color:#64748b;font-weight:600;text-transform:uppercase;font-size:.62rem;letter-spacing:.04em}
.ci-evidence-foot{font-size:.68rem;color:#64748b;margin-top:8px;line-height:1.5}
@media(max-width:900px){.ci-layout{grid-template-columns:1fr}.ci-exec-grid{grid-template-columns:1fr}.ci-approval-panel{position:static}}
.po-ops{margin-bottom:18px}
.po-ops h2{font-size:1rem;font-weight:800;margin:0 0 6px;color:#f8fafc}
.po-ops .po-ops-sub{font-size:.72rem;color:#94a3b8;margin:0 0 14px}
.po-ops-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:12px}
.po-ops-card{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px}
.po-ops-card.clickable{cursor:pointer;transition:border-color .15s,background .15s}
.po-ops-card.clickable:hover,.po-ops-card.clickable.active{border-color:#38bdf8;background:#0c1a2e}
.po-ops-card .lbl{font-size:.62rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.po-ops-card .val{font-size:.88rem;font-weight:700;color:#e2e8f0;margin-top:4px;word-break:break-word}
.po-ops-section{margin-top:14px;padding-top:12px;border-top:1px solid #334155}
.po-ops-section h3{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin:0 0 8px}
.po-ops-section.po-ops-focus{outline:1px solid #38bdf8;outline-offset:4px;border-radius:8px}
.po-ops-table{width:100%;border-collapse:collapse;font-size:.72rem}
.po-ops-table th,.po-ops-table td{border:1px solid #334155;padding:7px 8px;text-align:left;vertical-align:top}
.po-ops-table th{color:#64748b;font-weight:600;text-transform:uppercase;font-size:.62rem}
.po-ops-table tr.clickable{cursor:pointer}
.po-ops-table tr.clickable:hover{background:#0f172a}
.po-ops-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.62rem;font-weight:700}
.po-ops-pill.pass,.po-ops-pill.ready,.po-ops-pill.healthy{background:#064e3b;color:#6ee7b7}
.po-ops-pill.warning{background:#78350f;color:#fcd34d}
.po-ops-pill.blocked,.po-ops-pill.error,.po-ops-pill.setup{background:#7f1d1d;color:#fca5a5}
.po-ops-links{display:flex;flex-wrap:wrap;gap:6px}
.po-ops-links a,.po-ops-links button{font-size:.72rem}
.po-ops-sc-disconnected{background:#0f172a;border:1px solid #78350f;border-radius:10px;padding:14px;margin-bottom:8px}
.po-ops-sc-disconnected strong{display:block;color:#fcd34d;font-size:.84rem;margin-bottom:6px}
.po-ops-sc-disconnected p{margin:0 0 10px;color:#94a3b8;font-size:.72rem}
</style>
</head>
<body data-internal-admin-theme="black">
<header class="topbar">
  <div class="topbar-logo">PharmaConnect</div>
  <span class="admin-pill">Master Admin</span>
  <span class="topbar-sub">Operational control centre</span>
  <span class="load-ms" id="loadMs"></span>
  <nav class="topbar-nav">
    <a href="/api/dashboard">SEO Engine</a>
    <button type="button" onclick="openPlatformInfrastructure()">Platform Publishing Connection</button>
    <a href="/api/admin/master/issues">Issue Centre</a>
    <button type="button" onclick="openAuditLog()">Audit Log</button>
    <button type="button" onclick="loadDashboard()">Refresh</button>
  </nav>
</header>

<div class="layout">
  <div class="main-col">
    <div class="panel po-ops" id="platformOpsPanel">
      <h2>Platform Operations</h2>
      <p class="po-ops-sub">Product Owner homepage — live RC1 platform state. Links open existing workflow screens.</p>
      <div id="platformOpsBody"><div class="loading">Loading platform operations…</div></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-val" id="statTotal">—</div><div class="stat-label">Total Customers</div></div>
      <div class="stat"><div class="stat-val" id="statActive">—</div><div class="stat-label">Active</div></div>
      <div class="stat"><div class="stat-val" id="statSuspended">—</div><div class="stat-label">Suspended</div></div>
      <div class="stat"><div class="stat-val" id="statArchived">—</div><div class="stat-label">Archived</div></div>
    </div>
    <div class="panel">
      <div class="list-hero">
        <div><h2>Pharmacy Customers <span class="list-count" id="customerListCount"></span></h2><p style="font-size:.72rem;color:#94a3b8;margin-top:4px">Single entry point — select a pharmacy to run onboarding, generation, publishing, and growth monitoring.</p></div>
        <button class="btn-new-pharmacy" type="button" onclick="openCreateModal()">+ New Pharmacy</button>
      </div>
      <div class="list-tabs" id="customerArchiveTabs">
        <button type="button" class="list-tab active" data-archive-filter="active" onclick="setCustomerArchiveFilter('active')">Active</button>
        <button type="button" class="list-tab" data-archive-filter="archived" onclick="setCustomerArchiveFilter('archived')">Archived</button>
        <button type="button" class="list-tab" data-archive-filter="all" onclick="setCustomerArchiveFilter('all')">All</button>
      </div>
      <div class="toolbar">
        <input id="search" type="search" placeholder="Search by pharmacy name or website…" oninput="filterCustomers()"/>
        <select id="lifecycleFilter" onchange="filterCustomers()"><option value="">All workflow stages</option></select>
      </div>
      <div class="cqr-section" style="margin-bottom:12px"><h4 style="font-size:.72rem;margin:0 0 8px;color:#64748b">Operational Workflow</h4><div class="lifecycle-flow" id="workflowOverview"><div class="loading">Loading workflow…</div></div></div>
      <div id="customerTableWrap"><div class="loading" id="tableLoading">Loading customers…</div></div>
    </div>
  </div>
  <aside class="side-col">
    <div class="panel"><h2>System Health <span style="font-size:.65rem;color:#64748b">(cached)</span></h2><div id="healthPanel"><div class="loading">Loading…</div></div></div>
    <div class="panel"><h2>Background Jobs</h2><div id="jobsPanel"><div class="loading">Loading…</div></div></div>
    <div class="panel"><h2>Recent Activity</h2><div id="activityPanel"><div class="loading">Loading…</div></div></div>
  </aside>
</div>

<div class="modal-backdrop" id="createModal"><div class="modal" style="width:min(820px,100%);max-height:90vh;overflow:auto">
  <h3>Create Customer — Unified Intake</h3>
  <p style="font-size:.78rem;color:#94a3b8;margin-bottom:12px">Collect the minimum setup data to drive Website Import, optional Google Import, local areas, and Business Profile Review.</p>
  <h4 style="font-size:.78rem;margin:8px 0 6px;color:#64748b">Business &amp; location (required)</h4>
  <div class="form-grid">
    <label>Business name *<input id="createName" required/></label>
    <label>Website URL *<input id="createWebsite" required placeholder="https://"/></label>
    <label>Address line 1 *<input id="createAddress1" required/></label>
    <label>Address line 2<input id="createAddress2"/></label>
    <label>Town or City <span id="createTownRequiredMark">*</span><input id="createTown" placeholder="Required for Local / Regional strategy"/></label>
    <label>Postcode *<input id="createPostcode" required placeholder="S11 8TP"/></label>
    <label>County<input id="createCounty"/></label>
    <label>Country *<input id="createCountry" required value="United Kingdom"/></label>
    <label>Primary service *<select id="createPrimaryService"><option value="">Select a service…</option>${renderLockedServiceOptions()}</select></label>
    <label>Primary email *<input id="createEmail" type="email" required/></label>
    <label>Phone<input id="createPhone"/></label>
  </div>
  <fieldset style="border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:8px 0 12px">
    <legend style="font-size:.72rem;color:#64748b;padding:0 6px">Market Scope *</legend>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="createMarketScope" value="local_regional" checked onchange="syncMarketScopeUi('create')"/> Local / Regional</label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="createMarketScope" value="national" onchange="syncMarketScopeUi('create')"/> National</label>
    <p style="margin:6px 0 0;font-size:.68rem;color:#94a3b8">National uses country / project primary market for campaign strategy. Local areas remain available for Local / Regional tenants.</p>
  </fieldset>
  <h4 style="font-size:.78rem;margin:12px 0 6px;color:#64748b">Google Business Profile (optional)</h4>
  <div class="form-grid">
    <label>Google profile URL<input id="createGoogle" placeholder="https://maps.app.goo.gl/…"/></label>
    <label>Google Place ID<input id="createPlaceId" placeholder="ChI…"/></label>
  </div>
  <fieldset style="border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:8px 0 12px">
    <legend style="font-size:.72rem;color:#64748b;padding:0 6px">Google profile policy *</legend>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="createGooglePolicy" value="configured"/> Connect URL / Place ID above</label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="createGooglePolicy" value="no_profile"/> This business does not have a Google Business Profile</label>
    <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="createGooglePolicy" value="deferred"/> Add or connect this later</label>
  </fieldset>
  <div id="createLocalAreasSection">
  <h4 style="font-size:.78rem;margin:8px 0 6px;color:#64748b">Local areas</h4>
  <p style="font-size:.72rem;color:#94a3b8;margin:0 0 8px">Add or select areas after Town or City and Postcode are entered. Suggestions require operator confirmation.</p>
  <div style="display:flex;gap:8px;margin-bottom:8px">
    <input id="createAreaName" placeholder="Area name" style="flex:1"/>
    <button class="btn secondary" type="button" onclick="addCreateIntakeArea()">Add Area</button>
  </div>
  <div style="max-height:140px;overflow:auto;border:1px solid #334155;border-radius:8px;margin-bottom:12px">
    <table class="local-coverage-area-table"><thead><tr><th></th><th>Area</th><th></th></tr></thead><tbody id="createIntakeAreasTbody"></tbody></table>
  </div>
  </div>
  <div id="createNationalMarketNote" style="display:none;margin:8px 0 12px;padding:10px;border:1px solid #334155;border-radius:8px;font-size:.72rem;color:#94a3b8">National market selected — local area selection is not required. Primary market defaults to Country / project primaryLocation (United Kingdom).</div>
  <h4 style="font-size:.78rem;margin:8px 0 6px;color:#64748b">Account &amp; internal</h4>
  <div class="form-grid">
    <label>Assigned Account Manager<input id="createAccountManager" placeholder="Unassigned"/></label>
    <label>Support Contact Name<input id="createSupportName"/></label>
    <label>Support Contact Email<input id="createSupportEmail" type="email"/></label>
    <label style="grid-column:1/-1">Internal Notes<textarea id="createNotes"></textarea></label>
  </div>
  <div id="createAccountPreview" class="orchestration-summary" style="margin-bottom:12px">
    <div><span class="label">Username</span><div id="createPreviewUsername" style="color:#64748b">Generated from business name after submit</div></div>
    <div><span class="label">Role</span><div>Customer</div></div>
  </div>
  <div style="display:flex;gap:8px;justify-content:flex-end">
    <button class="btn secondary" type="button" onclick="closeCreateModal()">Cancel</button>
    <button class="btn" type="button" onclick="createCustomer()">Create Customer &amp; Start Imports</button>
  </div>
</div></div>

<div class="modal-backdrop" id="customerModal"><div class="modal">
  <h3 id="detailTitle">Customer</h3>
  <div id="detailMeta" style="font-size:.78rem;color:#94a3b8;margin-bottom:8px"></div>
  <div id="detailLoading" class="loading" style="display:none">Loading workflow…</div>
  <div id="detailError" class="bpr-error-panel" style="display:none">
    <h4>Customer workflow could not be loaded.</h4>
    <p id="detailErrorDetail" class="bpr-error-detail"></p>
    <p class="workflow-meta" id="detailErrorTimestamp" style="margin-top:8px"></p>
    <div class="bpr-error-actions"><button class="btn" type="button" onclick="openCustomer(activeCustomer&&activeCustomer.slug?activeCustomer.slug:new URLSearchParams(location.search).get('customer'))">Retry</button><button class="btn secondary" type="button" onclick="closeCustomerModal()">Close</button></div>
  </div>
  <div id="detailContent" style="display:none">
    <div id="detailOnboardingSources" class="guidance-box" style="margin-bottom:10px"></div>
    <div id="detailBprBanner" class="bpr-customer-banner" style="display:none"></div>
    <div id="detailCirBanner" class="bpr-customer-banner" style="display:none"></div>
    <div id="detailCqrBanner" class="cqr-customer-banner" style="display:none"></div>
    <div id="detailCdcBanner" class="cdc-customer-banner" style="display:none"></div>
    <div id="detailCprBanner" class="cpr-customer-banner" style="display:none"></div>
    <div id="detailCgeBanner" class="cqr-customer-banner" style="display:none"></div>
    <div id="detailSpgBanner" class="cqr-customer-banner" style="display:none"></div>
    <div id="detailIdxBanner" class="cqr-customer-banner" style="display:none"></div>
    <div id="detailPerfBanner" class="cqr-customer-banner" style="display:none"></div>
    <div class="detail-lifecycle" id="detailLifecycle"></div>
    <div class="guidance-box" id="detailGuidance"></div>
    <div class="modal-grid">
      <div>
        <h4 style="font-size:.78rem;margin:0 0 8px;color:#64748b">Operational Summary</h4>
        <div class="orchestration-summary" id="detailOperationalSummary"></div>
        <div id="detailPlatformModules" class="guidance-box" style="margin-top:10px;display:none"></div>
        <div id="detailWorkflowSummary"></div>
        <div class="job-status" id="detailJobsPanel" style="margin-top:10px"></div>
        <h4 style="font-size:.78rem;margin:12px 0 6px;color:#64748b">Workflow History</h4>
        <div id="detailHistory" class="history-panel"></div>
      </div>
      <div>
        <button class="continue-btn" id="continueWorkflowBtn" type="button" onclick="continueWorkflow()">Continue Workflow</button>
        <div class="block-reason" id="detailBlockReason"></div>
        <div class="job-status" id="detailJobStatus" style="display:none;margin-top:10px"></div>
        <button class="btn secondary" type="button" id="editOnboardingSetupBtn" onclick="openOnboardingIntakeModal()" style="margin-top:8px;width:100%;font-size:.78rem">Edit Onboarding Setup</button>
        <button class="btn" type="button" id="reimportWebsiteWorkflowBtn" onclick="reimportWebsiteFromCustomerWorkflow()" style="margin-top:8px;width:100%;font-size:.78rem;display:none">Re-import Website</button>
        <button class="bpr-btn-review" type="button" id="openBprBtn" onclick="openBusinessProfileReview()" style="margin-top:8px">Open Business Profile Review</button>
        <button class="btn secondary" type="button" id="reviewConfirmedServicesBtn" onclick="openReviewConfirmedServices()" style="margin-top:8px;width:100%;font-size:.78rem">Review Confirmed Services</button>
        <button class="btn secondary" type="button" id="openIerBtn" onclick="openImportedEvidenceReview()" style="margin-top:8px;width:100%;font-size:.78rem">Open Imported Evidence Review</button>
        <button class="cir-btn-review" type="button" id="openCirBtn" onclick="openCommercialIntelligenceReview()" style="margin-top:8px;display:none">Open Competitor Analysis</button>
        <button class="cqr-btn-review" type="button" id="openCqrBtn" onclick="openCommercialQualityReview()" style="margin-top:8px;display:none">Open Quality Review</button>
        <button class="cqr-btn-review" type="button" id="openClusterReviewBtn" onclick="openClusterPageReview()" style="margin-top:8px;display:none">Review Locality Pages</button>
        <button class="mp-btn-review" type="button" id="openMpBtn" onclick="openManagedPublishing()" style="margin-top:8px;display:none">Open Managed Publishing</button>
        <button class="cpr-btn-review" type="button" id="openCprBtn" onclick="openCommercialPublishReview()" style="margin-top:8px;display:none">Open Publish Review</button>
        <button class="cqr-btn-review" type="button" id="openIdxBtn" onclick="openCommercialIndexingReview(true)" style="margin-top:8px">Search Console &amp; Indexing</button>
        <button class="cqr-btn-review" type="button" id="openPerfBtn" onclick="openCommercialPerformanceDashboard(true)" style="margin-top:8px">Growth Dashboard</button>
        <details class="detail-collapse" id="detailWebsiteCollapse">
          <summary>Website Source</summary>
          <div class="detail-collapse-body">
            <div id="detailWebsiteSource" class="orchestration-summary"></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" id="detailWebsiteActions"></div>
            <pre id="detailWebsiteEvidence" style="display:none;margin-top:8px;font-size:.72rem;max-height:160px;overflow:auto;background:#0f172a;padding:8px;border-radius:6px;color:#e2e8f0"></pre>
          </div>
        </details>
        <details class="detail-collapse" id="detailGoogleCollapse">
          <summary>Google Business Profile</summary>
          <div class="detail-collapse-body">
            <div id="detailGoogleSource" class="orchestration-summary"></div>
            <div id="detailGoogleConfirmation" class="guidance-box" style="display:none;margin-top:8px"></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" id="detailGoogleActions"></div>
            <pre id="detailGoogleEvidence" style="display:none;margin-top:8px;font-size:.72rem;max-height:160px;overflow:auto;background:#0f172a;padding:8px;border-radius:6px;color:#e2e8f0"></pre>
          </div>
        </details>
        <details class="detail-collapse" id="detailServiceCampaignsCollapse" open>
          <summary>Service Campaigns</summary>
          <div class="detail-collapse-body">
            <p class="local-coverage-subtitle">Independent service campaigns. Create a campaign, then complete Service Evidence for that service. Generation stays Product Owner controlled.</p>
            <div id="detailTenantCommercialServices" style="display:none;margin-bottom:14px;padding:12px;border:1px solid #334155;border-radius:10px;background:#0f172a"></div>
            <div id="detailCreateCampaignPanel" style="margin-bottom:14px;padding:12px;border:1px solid #334155;border-radius:10px;background:#0f172a">
              <div id="po-create-campaign" style="font-weight:800;font-size:.88rem;margin-bottom:8px">Create Campaign</div>
              <label style="display:block;font-size:.72rem;color:#94a3b8;margin-bottom:8px">Select Service
                <select id="createCampaignServiceSelect" style="width:100%;margin-top:4px;background:#0b1220;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px">
                  <option value="">Select a service…</option>
                  ${renderLockedServiceOptions()}
                </select>
              </label>
              <button class="btn" type="button" id="createCampaignBtn" style="font-size:.72rem" onclick="createServiceCampaignFromMasterDashboard()">Create</button>
              <div id="createCampaignMsg" style="font-size:.72rem;color:#94a3b8;margin-top:8px"></div>
            </div>
            <div id="detailServiceCampaignsList"></div>
            <div id="detailSelectedCampaignPanel" style="display:none;margin-top:12px;padding:12px;border:1px solid #334155;border-radius:10px;background:#0f172a"></div>
          </div>
        </details>
        <details class="detail-collapse" id="detailLocalCoverageCollapse">
          <summary id="detailCoverageSummaryLabel">Local Coverage</summary>
          <div class="detail-collapse-body">
            <div id="detailNationalCoverageState" style="display:none">
              <p class="local-coverage-subtitle">National market scope — locality selection is not part of campaign strategy.</p>
              <div class="local-coverage-summary">
                <div class="local-coverage-stat"><div class="lbl">Primary Market</div><div class="val" id="detailNationalPrimaryMarket">—</div></div>
                <div class="local-coverage-stat"><div class="lbl">Campaign Strategy</div><div class="val" style="font-size:.78rem">National service / topic / authority campaigns</div></div>
                <div class="local-coverage-stat"><div class="lbl">Local Area Requirement</div><div class="val ready">Not required</div></div>
                <div class="local-coverage-stat"><div class="lbl">Local Generation</div><div class="val ready">Not required</div></div>
              </div>
              <p style="font-size:.72rem;color:#94a3b8;margin:0">Registered business town/city may still appear in address fields and does not define the campaign market.</p>
            </div>
            <div id="detailLocalCoverageControls">
            <p class="local-coverage-subtitle">Choose the areas you would like dedicated Local SEO pages for.</p>
            <label style="display:block;font-size:.72rem;color:#94a3b8;margin-bottom:8px">Primary town or city (required)
              <input id="localCoveragePrimaryTown" style="width:100%;margin-top:4px" oninput="localAreasPrimaryTown=this.value.trim()"/>
            </label>
            <div id="detailLocalCoverageReady" class="local-coverage-ready">READY TO GENERATE</div>
            <div id="detailLocalCoverageSummary" class="local-coverage-summary"></div>
            <div style="max-height:220px;overflow:auto;border:1px solid #334155;border-radius:10px">
              <table class="local-coverage-area-table"><thead><tr><th></th><th>Area Name</th><th>Distance</th><th>Confidence</th><th></th></tr></thead><tbody id="localCoverageTbody"></tbody></table>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <input id="localCoverageNewArea" placeholder="Add area name" style="flex:1"/>
              <button class="btn secondary" type="button" onclick="addLocalCoverageArea()">Add Area</button>
            </div>
            <div class="local-coverage-actions" id="detailLocalCoverageActions"></div>
            <div id="detailLocalCoverageSaveStatus" style="font-size:.72rem;color:#94a3b8;margin-top:8px"></div>
            </div>
          </div>
        </details>
        <details class="detail-collapse" id="detailAccountCollapse">
          <summary>Customer Account</summary>
          <div class="detail-collapse-body">
            <div id="detailAccountSummary" class="orchestration-summary"></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" id="detailAccountActions"></div>
            <pre id="detailWelcomeDraft" style="display:none;margin-top:8px;font-size:.72rem;max-height:120px;overflow:auto;background:#0f172a;padding:8px;border-radius:6px;color:#e2e8f0"></pre>
          </div>
        </details>
        <details class="detail-collapse" id="detailActivityCollapse">
          <summary>Activity Timeline</summary>
          <div class="detail-collapse-body">
            <div id="detailTimeline" class="tab-panel active" style="display:block;max-height:160px"></div>
          </div>
        </details>
      </div>
    </div>
  </div>
  <div style="margin-top:14px;text-align:right"><button class="btn secondary" type="button" onclick="closeCustomerModal()">Close</button></div>
</div></div>

<div class="modal-backdrop" id="onboardingIntakeModal"><div class="modal" style="width:min(820px,100%);max-height:90vh;overflow:auto">
  <h3>Edit Onboarding Setup</h3>
  <p style="font-size:.78rem;color:#94a3b8;margin-bottom:12px">Update first-screen intake for this customer. Website Import and imported assets are preserved when saving.</p>
  <div id="onboardingIntakeLoading" class="loading" style="display:none">Loading onboarding setup…</div>
  <div id="onboardingIntakeContent">
    <div class="form-grid">
      <label>Business name *<input id="intakeName" required/></label>
      <label>Website URL *<input id="intakeWebsite" required/></label>
      <label>Address line 1 *<input id="intakeAddress1" required/></label>
      <label>Address line 2<input id="intakeAddress2"/></label>
      <label>Town or City <span id="intakeTownRequiredMark">*</span><input id="intakeTown"/></label>
      <label>Postcode *<input id="intakePostcode" required/></label>
      <label>County<input id="intakeCounty"/></label>
      <label>Country *<input id="intakeCountry" required value="United Kingdom"/></label>
      <label>Primary service *<select id="intakePrimaryService"><option value="">Select a service…</option>${renderLockedServiceOptions()}</select></label>
      <label>Primary email *<input id="intakeEmail" type="email" required/></label>
      <label>Phone<input id="intakePhone"/></label>
      <label>Google profile URL<input id="intakeGoogle"/></label>
      <label>Google Place ID<input id="intakePlaceId"/></label>
    </div>
    <fieldset style="border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:8px 0 12px">
      <legend style="font-size:.72rem;color:#64748b;padding:0 6px">Market Scope *</legend>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeMarketScope" value="local_regional" onchange="syncMarketScopeUi('intake')"/> Local / Regional</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeMarketScope" value="national" onchange="syncMarketScopeUi('intake')"/> National</label>
      <p id="intakePrimaryMarketHint" style="margin:6px 0 0;font-size:.68rem;color:#94a3b8">Primary market follows Country for National tenants (United Kingdom).</p>
    </fieldset>
    <fieldset style="border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:8px 0 12px">
      <legend style="font-size:.72rem;color:#64748b;padding:0 6px">Google profile policy *</legend>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeGooglePolicy" value="configured"/> Connect URL / Place ID above</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeGooglePolicy" value="no_profile"/> No Google Business Profile</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeGooglePolicy" value="deferred"/> Add or connect later</label>
    </fieldset>
    <div id="intakeLocalAreasBlock">
    <div class="orchestration-summary" id="intakeAreaDiscoverySummary" style="margin:12px 0">
      <div><span class="label">Local Areas</span><div id="intakeAreaDiscoveryTown">Town or City: —</div></div>
      <div><span class="label">Recommended areas</span><div id="intakeAreaDiscoveryRecommended">0</div></div>
      <div><span class="label">Selected areas</span><div id="intakeAreaDiscoverySelected">0</div></div>
      <div><span class="label">Local generation readiness</span><div id="intakeAreaDiscoveryReadiness">—</div></div>
    </div>
    <div style="margin-bottom:12px">
      <button class="btn secondary" type="button" onclick="openOnboardingAreasReviewModal()">View Local Areas</button>
    </div>
    </div>
    <div id="intakeNationalMarketNote" style="display:none;margin:8px 0 12px;padding:10px;border:1px solid #334155;border-radius:8px;font-size:.72rem;color:#94a3b8">National market — local areas and local generation readiness are not required for campaign strategy. Registered business address may still show Town / City.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn secondary" type="button" onclick="closeOnboardingIntakeModal()">Cancel</button>
      <button class="btn" type="button" onclick="saveOnboardingIntake()">Save Onboarding Setup</button>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="onboardingAreasReviewModal"><div class="modal" style="width:min(900px,100%);max-height:90vh;overflow:auto">
  <h3>Local Areas Review</h3>
  <p style="font-size:.78rem;color:#94a3b8;margin-bottom:12px">Review automatically discovered areas for the confirmed Town or City. Select areas for local page generation.</p>
  <div id="onboardingAreasReviewLoading" class="loading" style="display:none">Discovering local areas…</div>
  <div id="onboardingAreasReviewContent">
    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <input id="onboardingAreasFilter" placeholder="Search areas…" style="flex:1;min-width:180px" oninput="renderOnboardingAreasReviewTable()"/>
      <button class="btn secondary" type="button" onclick="refreshOnboardingAreaSuggestions()">Refresh Suggestions</button>
    </div>
    <div style="max-height:320px;overflow:auto;border:1px solid #334155;border-radius:8px;margin-bottom:10px">
      <table class="local-coverage-area-table"><thead><tr><th></th><th>Area</th><th>Type</th><th>Source</th><th>Confidence</th><th>Distance</th><th>Eligible</th></tr></thead><tbody id="onboardingAreasReviewTbody"></tbody></table>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <input id="onboardingCustomAreaName" placeholder="Add custom area" style="flex:1;min-width:180px"/>
      <button class="btn secondary" type="button" onclick="addCustomOnboardingArea()">Add Custom Area</button>
    </div>
    <div class="local-coverage-actions" style="margin-bottom:12px">
      <button class="btn primary" type="button" onclick="selectAllRecommendedOnboardingAreas()">Select All Recommended</button>
      <button class="btn secondary" type="button" onclick="clearOnboardingAreaSelection()">Clear Selection</button>
    </div>
    <div id="onboardingAreasReviewMeta" style="font-size:.72rem;color:#94a3b8;margin-bottom:12px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn secondary" type="button" onclick="closeOnboardingAreasReviewModal()">Cancel</button>
      <button class="btn" type="button" onclick="saveOnboardingAreasReview()">Save Areas</button>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="bprModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="bprLoading" class="loading">Loading review…</div>
  <div id="bprError" class="bpr-error-panel" style="display:none">
    <h4>Business Profile Review could not be loaded.</h4>
    <p id="bprErrorDetail" class="bpr-error-detail"></p>
    <div class="bpr-error-actions">
      <button class="btn" type="button" onclick="openBusinessProfileReview()">Retry Review</button>
      <button class="btn secondary" type="button" onclick="reportBprLoadIssue()">Report Issue</button>
      <button class="btn secondary" type="button" onclick="closeBusinessProfileReview()">Close</button>
    </div>
  </div>
  <div id="bprContent" style="display:none;flex:1;overflow:auto">
    <div class="bpr-layout">
      <div class="bpr-main">
        <div class="bpr-hero" id="bprHero"></div>
        <button class="bpr-accept-safe-btn" type="button" id="bprAcceptSafeBtn" onclick="acceptAllSafeRecommendations()">Accept All Safe Recommendations</button>
        <div class="bpr-section">
          <h4>Action Required</h4>
          <div class="bpr-action-list" id="bprActionRequired"></div>
        </div>
        <div class="bpr-section" id="bprMissingSection" style="display:none">
          <h4>Missing Information</h4>
          <div class="bpr-action-list" id="bprMissingInformation"></div>
        </div>
        <div class="bpr-section" id="bprOptionalSection" style="display:none">
          <h4>Optional / Recommended</h4>
          <p class="ci-narrative" style="margin:0 0 8px">Useful for this business context but not required for approval.</p>
          <div class="bpr-action-list" id="bprOptionalInformation"></div>
        </div>
        <div class="bpr-section" id="bprNotApplicableSection" style="display:none">
          <h4>Not Applicable</h4>
          <p class="ci-narrative" style="margin:0 0 8px">Excluded by business classification / service context — not approval blockers.</p>
          <div class="bpr-action-list" id="bprNotApplicableInformation"></div>
        </div>
        <div class="bpr-section" id="bprServiceReconciliationSection">
          <h4>Service Reconciliation</h4>
          <p class="ci-narrative" style="margin:0 0 10px">Website-discovered services reconciled with the configured tenant service library. Review match states before approval. Nothing here is auto-approved.</p>
          <div id="bprServiceReconciliation"></div>
        </div>
        <div class="bpr-section" id="bprGoogleSection">
          <h4>Google Business Profile</h4>
          <div id="bprGooglePanel" class="orchestration-summary"></div>
          <div id="bprGoogleOpportunity" class="guidance-box" style="display:none;margin-top:8px"></div>
          <div id="bprGoogleActions" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
        </div>
      </div>
      <aside class="bpr-approval-panel">
        <h4>Approval</h4>
        <div id="bprPanelStats"></div>
        <ul class="bpr-panel-checklist" id="bprPanelChecklist"></ul>
        <div id="bprApproveReason" class="bpr-approve-reason"></div>
        <button class="bpr-approve-btn" type="button" id="bprApproveBtn" onclick="approveBusinessProfileReview()">Approve Business Profile</button>
        <!-- UX backlog: platform-wide toast save notification component (NT-E2E-05) -->
        <span class="bpr-save-status" id="bprSaveStatus"></span>
        <div id="bprApprovalError" class="bpr-approval-error" style="display:none">
          <div id="bprApprovalErrorMsg"></div>
          <div class="bpr-approval-error-actions">
            <button class="btn secondary" type="button" style="font-size:.68rem" onclick="approveBusinessProfileReview()">Retry Approval</button>
            <button class="btn secondary" type="button" style="font-size:.68rem" onclick="reportBprLoadIssue()">Report Issue</button>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn secondary" type="button" style="flex:1;font-size:.72rem" onclick="closeBusinessProfileReview()">Close</button>
        </div>
        <div id="bprMsg" style="font-size:.72rem;margin-top:8px;color:#94a3b8"></div>
      </aside>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="cirModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="cirLoading" class="loading">Loading Commercial Intelligence…</div>
  <div id="cirError" class="bpr-error-panel" style="display:none">
    <h4>Commercial Intelligence Dashboard could not be loaded.</h4>
    <p id="cirErrorDetail" class="bpr-error-detail"></p>
    <div class="bpr-error-actions">
      <button class="btn" type="button" onclick="openCommercialIntelligenceReview()">Retry Dashboard</button>
      <button class="btn secondary" type="button" onclick="closeCommercialIntelligenceReview()">Close</button>
    </div>
  </div>
  <div id="cirContent" style="display:none;flex:1;overflow:auto">
    <div class="ci-layout">
      <div class="ci-main" id="cirMain"></div>
      <aside class="ci-approval-panel" id="cirApprovalPanel"></aside>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="cqrModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="cqrLoading" class="loading">Loading Quality Review…</div>
  <div id="cqrError" class="bpr-error-panel" style="display:none">
    <h4>Quality Review could not be loaded.</h4>
    <p id="cqrErrorDetail" class="bpr-error-detail"></p>
    <div class="bpr-error-actions">
      <button class="btn" type="button" onclick="openCommercialQualityReview()">Retry</button>
      <button class="btn secondary" type="button" onclick="closeCommercialQualityReview()">Close</button>
    </div>
  </div>
  <div id="cqrContent" style="display:none;flex:1;overflow:auto">
    <div class="cqr-layout">
      <div class="cqr-main">
        <div class="cqr-hero" id="cqrHero"></div>
        <div class="cqr-actions" id="cqrTopActions"></div>
        <div class="cqr-section"><h4>Content Summary</h4><div class="cqr-totals" id="cqrContentTotals"></div></div>
        <div class="cqr-section" id="cqrPageInspectionSection" style="display:none"><h4>Page Inspection Workspace</h4><div class="cqr-inspection-progress" id="cqrInspectionProgress"></div><div class="cqr-inspection-table-wrap"><table class="cqr-inspection-table"><thead><tr><th>Page Type</th><th>Page Name</th><th>Generation Status</th><th>Preview</th><th>Review Status</th><th>Notes</th></tr></thead><tbody id="cqrInspectionRows"></tbody></table></div></div>
        <div class="cqr-section"><h4>Quality Checks</h4><div class="cqr-checks" id="cqrChecks"></div></div>
        <div class="cqr-section" id="cqrWarningsSection" style="display:none"><h4>Warnings</h4><ul class="cqr-list" id="cqrWarnings"></ul></div>
        <div class="cqr-section" id="cqrBlockersSection" style="display:none"><h4>Blockers</h4><ul class="cqr-list" id="cqrBlockers"></ul></div>
      </div>
      <aside class="cqr-approval-panel">
        <h4>Approval</h4>
        <div id="cqrPanelStats"></div>
        <ul class="cqr-list" id="cqrPanelWarnings"></ul>
        <ul class="cqr-list" id="cqrPanelBlockers"></ul>
        <button class="cqr-approve-btn" type="button" id="cqrApproveBtn" onclick="approveCommercialQualityReview()">Approve Quality Review</button>
        <button class="cqr-publish-btn" type="button" id="cqrPublishBtn" onclick="openCommercialPublishReview()" disabled>Continue — Publish</button>
        <div id="cqrApprovalError" class="bpr-approval-error" style="display:none"><div id="cqrApprovalErrorMsg"></div></div>
        <div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialQualityReview()">Close</button></div>
      </aside>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="cdcModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="cdcLoading" class="loading">Loading Deployment Configuration…</div>
  <div id="cdcError" class="bpr-error-panel" style="display:none">
    <h4>Deployment Configuration could not be loaded.</h4>
    <p id="cdcErrorDetail" class="bpr-error-detail"></p>
    <div class="bpr-error-actions">
      <button class="btn" type="button" onclick="openCommercialDeploymentConfiguration()">Retry Deployment Configuration</button>
      <button class="btn secondary" type="button" onclick="reportCdcLoadIssue()">Report Issue</button>
      <button class="btn secondary" type="button" onclick="closeCommercialDeploymentConfiguration()">Close</button>
    </div>
  </div>
  <div id="cdcContent" style="display:none;flex:1;overflow:auto">
    <div class="cpr-layout">
      <div class="cpr-main">
        <div class="cpr-hero" id="cdcHero"></div>
        <div class="cqr-actions" id="cdcTopActions"></div>
        <div class="cpr-section" id="cdcConfigSection"><h4>Configure Deployment</h4><div id="cdcConfigForm" class="cdc-config-form"></div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="cdcSaveBtn" onclick="saveCommercialDeploymentConfiguration()">Save Deployment</button><button class="btn secondary" type="button" onclick="updateCommercialDeploymentCredentials()">Update Credentials</button></div></div>
        <div class="cpr-section"><h4>Deployment Summary</h4><div class="cqr-summary-grid" id="cdcSummary"></div></div>
        <div class="cpr-section"><h4>Connection Test</h4><div class="cqr-checks" id="cdcConnectionChecks"></div></div>
        <div class="cpr-section"><h4>Destination Validation</h4><div class="cqr-checks" id="cdcDestinationChecks"></div></div>
        <div class="cpr-section" id="cdcWarningsSection" style="display:none"><h4>Warnings</h4><ul class="cqr-list" id="cdcWarnings"></ul></div>
        <div class="cpr-section" id="cdcBlockersSection" style="display:none"><h4>Blockers</h4><ul class="cqr-list" id="cdcBlockers"></ul></div>
        <div class="cpr-section" id="cdcHistorySection" style="display:none"><h4>Publish History</h4><div id="cdcHistory"></div></div>
      </div>
      <aside class="cqr-approval-panel">
        <h4>Publishing Readiness</h4>
        <div id="cdcPanelStats"></div>
        <ul class="cqr-list" id="cdcPanelWarnings"></ul>
        <ul class="cqr-list" id="cdcPanelBlockers"></ul>
        <button class="cqr-approve-btn" type="button" id="cdcApproveBtn" onclick="approveCommercialDeployment()" disabled>Approve Deployment</button>
        <button class="cqr-publish-btn" type="button" id="cdcPublishBtn" onclick="openCommercialPublishReview()" disabled>Continue — Publish</button>
        <div id="cdcApprovalError" class="bpr-approval-error" style="display:none"><div id="cdcApprovalErrorMsg"></div></div>
        <div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialDeploymentConfiguration()">Close</button></div>
      </aside>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="piModal"><div class="modal" style="width:min(760px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="piLoading" class="loading">Loading Platform Publishing Connection…</div>
  <div id="piError" class="bpr-error-panel" style="display:none">
    <h4>Platform Publishing Connection could not be loaded.</h4>
    <p id="piErrorDetail" class="bpr-error-detail"></p>
    <div class="bpr-error-actions"><button class="btn" type="button" onclick="openPlatformInfrastructure()">Retry Connection</button><button class="btn secondary" type="button" onclick="closePlatformInfrastructure()">Close</button></div>
  </div>
  <div id="piContent" style="display:none;flex:1;overflow:auto">
    <h3 style="margin-bottom:8px">Platform Publishing Connection</h3>
    <div id="piStatusPanel" class="guidance-box" style="margin-bottom:12px"></div>
    <div id="piFailurePanel" class="bpr-error-panel" style="display:none;margin-bottom:12px"><strong>Failure reason</strong><p id="piFailureDetail" class="bpr-error-detail" style="margin-top:6px"></p></div>
    <div id="piConfigForm" class="cdc-config-form"></div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" type="button" onclick="savePlatformInfrastructure()">Save Connection</button>
      <button class="btn secondary" type="button" onclick="updatePlatformInfrastructureCredentials()">Update Credentials</button>
      <button class="btn secondary" type="button" onclick="testPlatformInfrastructureConnection()">Test Connection</button>
      <button class="btn secondary" type="button" onclick="validatePlatformPublishRoot()">Validate Publish Root</button>
      <button class="btn secondary" type="button" onclick="openPlatformInfrastructure()">Retry Connection</button>
    </div>
    <div class="cpr-section" style="margin-top:16px"><h4>Checks</h4><div class="cqr-checks" id="piChecks"></div></div>
    <div style="margin-top:12px"><button class="btn secondary" type="button" onclick="closePlatformInfrastructure()">Close</button></div>
  </div>
</div></div>

<div class="modal-backdrop" id="mpModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="mpLoading" class="loading">Loading Managed Publishing…</div>
  <div id="mpError" class="bpr-error-panel" style="display:none">
    <h4>Managed Publishing could not be loaded.</h4>
    <p id="mpErrorDetail" class="bpr-error-detail"></p>
    <div class="bpr-error-actions"><button class="btn" type="button" onclick="openManagedPublishing()">Retry</button><button class="btn secondary" type="button" onclick="closeManagedPublishing()">Close</button></div>
  </div>
  <div id="mpContent" style="display:none;flex:1;overflow:auto">
    <div class="cpr-layout">
      <div class="cpr-main">
        <div class="cpr-hero" id="mpHero"></div>
        <div class="cqr-actions" id="mpTopActions"></div>
        <div class="cpr-section"><h4>Managed Publishing</h4><div class="cqr-summary-grid" id="mpSummary"></div></div>
        <div class="cpr-section"><h4>Customer Ecosystem Domain</h4><div id="mpSubdomainForm" class="cdc-config-form"></div></div>
        <div class="cpr-section"><h4>DNS Instructions</h4><div id="mpDnsInstructions"></div></div>
        <div class="cpr-section"><h4>Releases</h4><div id="mpReleases"></div></div>
        <div class="cpr-section" id="mpWarningsSection" style="display:none"><h4>Warnings</h4><ul class="cqr-list" id="mpWarnings"></ul></div>
        <div class="cpr-section" id="mpBlockersSection" style="display:none"><h4>Blockers</h4><ul class="cqr-list" id="mpBlockers"></ul></div>
      </div>
      <aside class="cqr-approval-panel">
        <h4>Publishing Readiness</h4>
        <div id="mpPanelStats"></div>
        <button class="cqr-publish-btn" type="button" onclick="openCommercialPublishReview()">Open Publish Review</button>
        <div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeManagedPublishing()">Close</button></div>
      </aside>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="cprModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="cprLoading" class="loading">Loading Publish Review…</div>
  <div id="cprError" class="bpr-error-panel" style="display:none">
    <h4>Publish Review could not be loaded.</h4>
    <p id="cprErrorDetail" class="bpr-error-detail"></p>
    <div class="bpr-error-actions">
      <button class="btn" type="button" onclick="openCommercialPublishReview()">Retry</button>
      <button class="btn secondary" type="button" onclick="closeCommercialPublishReview()">Close</button>
    </div>
  </div>
  <div id="cprContent" style="display:none;flex:1;overflow:auto">
    <div class="cpr-layout">
      <div class="cpr-main">
        <div class="cpr-hero" id="cprHero"></div>
        <div class="cpr-section" id="cprPublicationVerificationSection" style="display:none"><h4>Publication Verification</h4><div class="cqr-summary-grid" id="cprPublicationVerification"></div></div>
        <div class="cpr-section"><h4>Release Management</h4><div class="cqr-summary-grid" id="cprReleaseManagement"></div></div>
        <div class="cqr-actions" id="cprTopActions"></div>
        <div class="cpr-section"><h4>Publish Destination</h4><div class="cqr-summary-grid" id="cprDestination"></div></div>
        <div class="cpr-section"><h4>Change Summary</h4><div class="cqr-summary-grid" id="cprChangeSummary"></div></div>
        <div class="cpr-section"><h4>Pre-Publish Checks</h4><div class="cqr-checks" id="cprChecks"></div></div>
        <div class="cpr-section" id="cprWarningsSection" style="display:none"><h4>Warnings</h4><ul class="cqr-list" id="cprWarnings"></ul></div>
        <div class="cpr-section" id="cprBlockersSection" style="display:none"><h4>Blockers</h4><ul class="cqr-list" id="cprBlockers"></ul></div>
        <div class="cpr-section" id="cprProgressSection" style="display:none"><h4>Publishing Progress</h4><div id="cprProgressStages"></div><div id="cprProgressMeta" style="font-size:.72rem;color:#94a3b8;margin-top:8px"></div></div>
      </div>
      <aside class="cqr-approval-panel">
        <h4>Publishing</h4>
        <div id="cprPanelStats"></div>
        <ul class="cqr-list" id="cprPanelWarnings"></ul>
        <ul class="cqr-list" id="cprPanelBlockers"></ul>
        <div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="cprConfirmCheckbox" onchange="updateCprApproveState()"/><span>I confirm that I have previewed the generated website and approve it for publishing.</span></label></div>
        <button class="cqr-approve-btn" type="button" id="cprApproveBtn" onclick="approveCommercialPublish()" disabled>Approve and Publish</button>
        <button class="cqr-publish-btn" type="button" id="cprRetryBtn" onclick="approveCommercialPublish()" style="display:none">Retry Publish</button>
        <button class="cqr-approve-btn" type="button" id="cprContinueIndexingBtn" onclick="continueToIndexingFromPublishReview()" style="display:none">Continue to Indexing</button>
        <div id="cprApprovalError" class="bpr-approval-error" style="display:none"><div id="cprApprovalErrorMsg"></div></div>
        <div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialPublishReview()">Close</button></div>
      </aside>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="cprPageListModal"><div class="modal" style="width:min(1100px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
    <div>
      <h4 id="cprPageListTitle" style="margin:0 0 4px">Published Assets</h4>
      <p id="cprPageListMeta" class="ci-narrative" style="margin:0"></p>
    </div>
    <button class="btn secondary" type="button" onclick="closePublishPageList()">Close</button>
  </div>
  <div id="cprPageListBody" style="flex:1;overflow:auto"></div>
</div></div>

<div class="modal-backdrop" id="cgeModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="cgeLoading" class="loading">Loading Generate Ecosystem…</div>
  <div id="cgeError" class="bpr-error-panel" style="display:none"><h4>Generate Ecosystem could not be loaded.</h4><p id="cgeErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openCommercialEcosystemGeneration()">Retry</button><button class="btn secondary" type="button" onclick="closeCommercialEcosystemGeneration()">Close</button></div></div>
  <div id="cgeContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="cgeHero"></div><div class="cqr-section" id="cgeHistoricalSection" style="display:none"><h4>Historical Ecosystem Package</h4><div id="cgeHistorical"></div></div><div class="cqr-section" id="cgeExternalPackageSection" style="display:none"><h4>Previous RC1 Package</h4><div id="cgeExternalPackage"></div></div><div class="cqr-section" id="cgeInventorySection" style="display:none"><h4>Canonical Inventory</h4><div id="cgeInventorySummary"></div></div><div class="cqr-section" id="cgeIncompleteSection" style="display:none"><h4>Authorised Generation Status</h4><div id="cgeIncomplete"></div></div><div class="cqr-section"><h4>Canonical Generation Plan</h4><div class="cqr-totals" id="cgeCanonicalPlan"></div></div><div class="cqr-section"><h4>Core Ecosystem</h4><div class="cqr-totals" id="cgeCoreEcosystem"></div><div id="cgeAreaClassifications" style="margin-top:8px"></div></div><div class="cqr-section" id="cgeRecommendedSection"><h4>Recommended Future Content</h4><div id="cgeRecommendedFuture"></div></div><div class="cqr-section"><h4>Generation Readiness</h4><div class="cqr-totals" id="cgeReadiness"></div></div><div class="cqr-section"><h4>Google Business Profile</h4><div id="cgeGoogle"></div></div><div class="cqr-section"><h4>What Will Be Generated</h4><p class="ci-narrative" id="cgeSummary"></p></div><div class="cqr-section" id="cgeProgressSection" style="display:none"><h4>Generation Progress</h4><div id="cgeProgress"></div></div></div><aside class="cqr-approval-panel"><h4 id="cgePanelTitle">Generate Product Owner Test Package</h4><div id="cgePanelStats"></div><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="cgeConfirmCheckbox" onchange="updateCgeGenerateState()"/><span>I have reviewed the Canonical Generation Plan and approve generation.</span></label></div><button class="cqr-approve-btn" type="button" id="cgeGenerateBtn" onclick="confirmCommercialEcosystemGeneration()" disabled>Generate Product Owner Test Package</button><div id="cgeMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialEcosystemGeneration()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="ierModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="ierLoading" class="loading">Loading imported evidence…</div>
  <div id="ierError" class="bpr-error-panel" style="display:none"><h4>Imported evidence could not be loaded.</h4><p id="ierErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openImportedEvidenceReview()">Retry</button><button class="btn secondary" type="button" onclick="closeImportedEvidenceReview()">Close</button></div></div>
  <div id="ierContent" style="display:none;flex:1;overflow:auto">
    <div class="cqr-layout"><div class="cqr-main">
      <div class="cqr-hero" id="ierHero"></div>
      <div class="cqr-section" id="ierBranchSection" style="display:none"><h4>Branch Selection Required</h4><div id="ierBranchPanel"></div></div>
      <div class="cqr-section" id="ierIsolationSection"><h4>Tenant Isolation Gate</h4><div id="ierIsolation"></div></div>
      <div class="cqr-section"><h4>Website Import Evidence</h4><div id="ierWebsiteEvidence"></div></div><div class="cqr-section"><h4>Brand / Website Style</h4><div id="ierBrandStyle"></div></div>
      <div class="cqr-section"><h4>Google Profile Search</h4><div id="ierGoogleSearch"></div><div id="ierGoogleCandidates" style="margin-top:8px"></div></div>
      <div class="cqr-section"><h4>Google Import Evidence</h4><div id="ierGoogleEvidence"></div></div>
      <div class="cqr-section"><h4>Website vs Google Comparison</h4><div id="ierComparison"></div></div>
    </div><aside class="cqr-approval-panel"><h4>Imported Evidence Review</h4><div id="ierPanelSummary"></div><p style="font-size:.72rem;color:#94a3b8;margin-top:12px">Review imported business, branding and Google evidence. Do not approve Business Profile until isolation gate passes.</p><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeImportedEvidenceReview()">Close</button></div></aside></div>
  </div>
</div></div>

<div class="modal-backdrop" id="spgModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="spgLoading" class="loading">Loading service page generation…</div>
  <div id="spgError" class="bpr-error-panel" style="display:none"><h4>Service page generation could not be loaded.</h4><p id="spgErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openServicePageGeneration()">Retry</button><button class="btn secondary" type="button" onclick="closeServicePageGeneration()">Close</button></div></div>
  <div id="spgContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="spgHero"></div><div id="spgFieldError" class="bpr-error-panel" style="display:none;margin:0 0 12px"></div><div class="cqr-section"><h4>Business Evidence</h4><div id="spgBusinessEvidence"></div></div><div class="cqr-section"><h4>Service Evidence</h4><div id="spgServiceEvidence"></div></div><div class="cqr-section"><h4>Trust Evidence</h4><div id="spgTrustEvidence"></div></div><div class="cqr-section"><h4>Brand &amp; Design</h4><div id="spgBrandEvidence"></div></div><div class="cqr-section"><h4>Image Evidence</h4><div id="spgImageEvidence"></div></div><div class="cqr-section"><h4>Image Selections</h4><div id="spgImageSelections"></div></div><div class="cqr-section"><h4>SEO Plan</h4><div id="spgSeoEvidence"></div><div id="spgPlan" style="margin-top:8px"></div></div><div class="cqr-section"><h4>Future Cluster-Link Plan</h4><div id="spgFutureLinks"></div></div></div><aside class="cqr-approval-panel"><h4>Generate Service Page</h4><div id="spgPanelStats"></div><div id="spgGenerationError" class="bpr-error-panel" style="display:none;margin:12px 0"></div><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="spgConfirmCheckbox"/><span>I have reviewed the evidence contract and approve generation of exactly one service page.</span></label></div><button class="cqr-approve-btn" type="button" id="spgGenerateBtn" disabled>Generate Service Page</button><button class="btn secondary" type="button" id="spgRetryBtn" style="width:100%;margin-top:8px;display:none">Generate Service Page</button><div id="spgProgressSection" style="display:none;margin-top:10px"><h5 style="margin:0 0 6px;font-size:.72rem;color:#94a3b8">Generation Progress</h5><div id="spgProgressStatus" style="font-size:.72rem;margin-bottom:4px"></div><div id="spgProgressStage" style="font-size:.72rem;margin-bottom:4px"></div><div style="background:#1e293b;border-radius:6px;height:8px;overflow:hidden"><div id="spgProgressBar" style="height:8px;width:0;background:#38bdf8;transition:width .3s"></div></div><div id="spgProgressStages" style="font-size:.65rem;margin-top:8px;color:#64748b"></div></div><div id="spgMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeServicePageGeneration()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="speModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="speLoading" class="loading">Loading evidence review…</div>
  <div id="speError" class="bpr-error-panel" style="display:none"><h4>Evidence review could not be loaded.</h4><p id="speErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openServicePageEvidenceReview()">Retry</button><button class="btn secondary" type="button" onclick="closeServicePageEvidenceReview()">Close</button></div></div>
  <div id="speContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="speHero"></div><div id="speSections"></div></div><aside class="cqr-approval-panel"><h4>Product Owner Evidence Review</h4><p class="ci-narrative">Confirm Business, Brand, Images, Service, Trust, and SEO evidence before generation is enabled.</p><div id="spePanelStats"></div><div id="speFieldError" class="bpr-error-panel" style="display:none;margin:12px 0"></div><div id="speApprovalError" class="bpr-error-panel" style="display:none;margin:12px 0"></div><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="speApproveCheckbox" onchange="updateSpeApproveState()"/><span>I confirm all evidence groups are complete and approve service page generation.</span></label></div><button class="cqr-approve-btn" type="button" id="speApproveBtn" disabled>Approve Evidence</button><button class="cqr-approve-btn" type="button" id="speGenerateBtn" style="display:none;width:100%;margin-top:8px">Generate Service Page</button><button class="btn secondary" type="button" id="speReopenBtn" style="width:100%;margin-top:8px;display:none">Reopen Evidence Review</button><div id="speMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeServicePageEvidenceReview()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="campaignLocalityModal"><div class="modal" style="width:min(720px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="campaignLocalityLoading" class="loading">Loading locality selection…</div>
  <div id="campaignLocalityError" class="bpr-error-panel" style="display:none"><h4>Locality selection could not be loaded.</h4><p id="campaignLocalityErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openCampaignLocalitySelection()">Retry</button><button class="btn secondary" type="button" onclick="closeCampaignLocalitySelection()">Close</button></div></div>
  <div id="campaignLocalityContent" style="display:none;flex:1;overflow:auto">
    <h4 style="margin:0 0 8px">Select Locality Areas</h4>
    <p class="ci-narrative" style="margin:0 0 12px">Choose which localities belong to this service campaign. Selections are campaign-specific and do not copy another service unless you select the same areas.</p>
    <div id="campaignLocalityList"></div>
    <div id="campaignLocalitySelectedSummary" style="font-size:.72rem;color:#94a3b8;margin:10px 0"></div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
      <button class="btn" type="button" id="campaignLocalitySaveBtn" onclick="saveCampaignLocalitySelection()">Save Selected Locality Areas</button>
      <button class="btn secondary" type="button" id="campaignLocalityGenerateBtn" onclick="generateCampaignLocalityPages()">Generate Locality Pages</button>
      <button class="btn secondary" type="button" onclick="closeCampaignLocalitySelection()">Close</button>
    </div>
    <div id="campaignLocalityMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div>
  </div>
</div></div>

<div class="modal-backdrop" id="cprClusterReviewModal"><div class="modal" style="width:min(960px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="cprClusterReviewLoading" class="loading">Loading Cluster Review…</div>
  <div id="cprClusterReviewError" class="bpr-error-panel" style="display:none"><h4>Cluster Review could not be loaded.</h4><p id="cprClusterReviewErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openClusterPageReview()">Retry</button><button class="btn secondary" type="button" onclick="closeClusterPageReview()">Close</button></div></div>
  <div id="cprClusterReviewContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="cprClusterReviewHero"></div><div class="cqr-section"><h4>Generated Cluster Pages</h4><div id="cprClusterReviewPages"></div></div><div class="cqr-section"><h4>Completed Job</h4><div id="cprClusterReviewJob"></div></div></div><aside class="cqr-approval-panel"><h4>Cluster Review</h4><p class="ci-narrative">Review generated cluster pages before publishing. Approval is manual — do not publish until clusters are approved.</p><div id="cprClusterReviewPanelStats"></div><div id="cprClusterBulkApproveWrap" style="display:none"><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="cprClusterApproveCheckbox" onchange="updateCprClusterApproveState()"/><span>I confirm I have reviewed every remaining locality page listed and approve them for this campaign only.</span></label></div><button class="cqr-approve-btn" type="button" id="cprClusterApproveBtn" onclick="approveClusterPageReview()" disabled>Approve All Remaining Locality Pages</button></div><button class="btn secondary" type="button" id="cprClusterRejectBtn" style="width:100%;margin-top:8px" onclick="rejectClusterPageReview()">Needs Changes</button><div id="cprClusterMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="returnToCampaignFromClusterReview()">Return to Campaign</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="sprModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="sprLoading" class="loading">Loading Service Page Review…</div>
  <div id="sprError" class="bpr-error-panel" style="display:none"><h4>Service Page Review could not be loaded.</h4><p id="sprErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openServicePageReview()">Retry</button><button class="btn secondary" type="button" onclick="closeServicePageReview()">Close</button></div></div>
  <div id="sprContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="sprHero"></div><div class="cqr-section"><h4>Preview Service Page</h4><div id="sprPreview"></div><div id="sprResponsive" style="margin-top:8px"></div></div><div class="cqr-section"><h4>Brand Resolution</h4><div id="sprBrandResolution"></div></div><div class="cqr-section"><h4>Evidence Used By Section</h4><div id="sprEvidence"></div></div><div class="cqr-section"><h4>Metadata &amp; Schema</h4><div id="sprMetadata"></div></div><div class="cqr-section"><h4>Images Selected</h4><div id="sprImages"></div></div><div class="cqr-section"><h4>Internal Links &amp; Future Cluster-Link Plan</h4><div id="sprLinks"></div><div id="sprFutureLinks" style="margin-top:8px"></div></div><div class="cqr-section"><h4>Commercial Checklist</h4><div id="sprCommercialChecklist"></div></div><div class="cqr-section"><h4>Quality Checks</h4><div id="sprQuality"></div></div><div class="cqr-section"><h4>Warnings &amp; Errors</h4><div id="sprWarnings"></div></div></div><aside class="cqr-approval-panel"><h4>Service Page Review</h4><p class="ci-narrative">Review the rendered service page. Approval is manual — cluster generation remains blocked until explicit approval.</p><div id="sprPanelStats"></div><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="sprApproveCheckbox" onchange="updateSprApproveState()"/><span>I approve this service page for CPR acceptance.</span></label></div><button class="cqr-approve-btn" type="button" id="sprApproveBtn" onclick="approveServicePageReview()" disabled>Approve Service Page</button><button class="cqr-approve-btn" type="button" id="sprClusterGenerateBtn" style="display:none;width:100%;margin-top:8px">Generate Locality Pages</button><button class="btn secondary" type="button" id="sprRejectBtn" style="width:100%;margin-top:8px" onclick="rejectServicePageReview()">Needs Changes</button><div id="sprNotesBox" style="margin-top:8px;display:none"><textarea id="sprNotes" rows="3" style="width:100%;background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px;font-size:.72rem" placeholder="Product Owner notes"></textarea></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeServicePageReview()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="idxModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="idxLoading" class="loading">Loading Indexing Dashboard…</div>
  <div id="idxError" class="bpr-error-panel" style="display:none"><h4>Indexing Dashboard could not be loaded.</h4><p id="idxErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openCommercialIndexingReview()">Retry</button><button class="btn secondary" type="button" onclick="closeCommercialIndexingReview()">Close</button></div></div>
  <div id="idxContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="idxHero"></div><div class="cqr-section"><h4>Search Console</h4><div class="cqr-totals" id="idxSearchConsole"></div></div><div class="cqr-section"><h4>Indexing Summary</h4><div class="cqr-totals" id="idxStats"></div></div><div class="cqr-section"><h4>Coverage</h4><p class="ci-narrative" id="idxCoverage"></p></div><div class="cqr-section"><h4>Expected URLs</h4><ul class="cqr-list" id="idxUrls"></ul></div><div class="cqr-section"><h4>Indexing History</h4><div id="idxHistory"></div></div></div><aside class="cqr-approval-panel"><h4>Request Indexing</h4><div id="idxPanelStats"></div><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="idxConfirmCheckbox" onchange="updateIdxRequestState()"/><span>I confirm that I want to submit published pages for search indexing.</span></label></div><button class="cqr-approve-btn" type="button" id="idxRequestBtn" onclick="requestCommercialIndexing()" disabled>Request Indexing</button><div id="idxMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialIndexingReview()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="perfModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="perfLoading" class="loading">Loading Performance Dashboard…</div>
  <div id="perfError" class="bpr-error-panel" style="display:none"><h4>Performance Dashboard could not be loaded.</h4><p id="perfErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openCommercialPerformanceDashboard()">Retry</button><button class="btn secondary" type="button" onclick="closeCommercialPerformanceDashboard()">Close</button></div></div>
  <div id="perfContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="perfHero"></div><div class="cqr-section"><h4>Search Console</h4><div class="cqr-totals" id="perfSearchConsole"></div></div><div class="cqr-section"><h4>Search Performance</h4><div class="cqr-totals" id="perfStats"></div></div><div class="cqr-section"><h4>Top Performing Pages</h4><div id="perfTopPages"></div></div><div class="cqr-section"><h4>Top Opportunities</h4><ul class="cqr-list" id="perfOpportunities"></ul></div><div class="cqr-section"><h4>Commercial Health</h4><div class="cqr-totals" id="perfHealth"></div></div></div><aside class="cqr-approval-panel"><h4>Complete Workflow</h4><div id="perfPanelStats"></div><button class="btn secondary" type="button" style="width:100%;margin-bottom:8px" onclick="refreshCommercialPerformanceDashboard()">Refresh Performance</button><button class="cqr-approve-btn" type="button" id="perfCompleteBtn" onclick="completeCommercialPerformanceDashboard()">Complete Commercial Workflow</button><div id="perfMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialPerformanceDashboard()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="auditModal"><div class="modal" style="width:min(900px,100%)">
  <h3>Audit Log</h3><div class="table-wrap" style="max-height:60vh"><table class="audit-table"><thead><tr><th>Timestamp</th><th>User</th><th>Customer</th><th>Action</th><th>Status</th><th>Evidence</th></tr></thead><tbody id="auditTbody"></tbody></table></div>
  <div style="margin-top:12px;text-align:right"><button class="btn secondary" type="button" onclick="closeAuditModal()">Close</button></div>
</div></div>

<div class="toast" id="toast"></div>

<script>
let customers=[];
let customerArchiveFilter='active';
let workflowStages=[];
let workflowStageCounts={};
let activeCustomer=null;
let pendingWebsiteBranchId=null;
let lastRenderedBranchSelection=null;
const workflowNavStack=[];
function pushWorkflowNav(entry){if(entry)workflowNavStack.push(entry);}
const WORKFLOW_PANEL_OPENERS={
  'imported-evidence-review':()=>openImportedEvidenceReview(),
  'business-profile-review':()=>openBusinessProfileReview(),
  'service-page-evidence-review':()=>openServicePageEvidenceReview(),
  'service-page-generation':()=>openServicePageGeneration(),
  'service-page-review':()=>openServicePageReview(),
  'campaign-locality-selection':()=>openCampaignLocalitySelection(),
  'cluster-page-review':()=>openClusterPageReview(),
  'quality-review':()=>openCommercialQualityReview(),
  'publish-review':()=>openCommercialPublishReview(),
  'indexing-review':()=>openCommercialIndexingReview(true),
  'performance-dashboard':()=>openCommercialPerformanceDashboard(true),
  'managed-publishing':()=>openManagedPublishing(),
  'generate-ecosystem':()=>openCommercialEcosystemGeneration(),
  'commercial-intelligence':()=>openCommercialIntelligenceReview(),
  'deployment-configuration':()=>openCommercialDeploymentConfiguration(),
};
function setWorkflowPanelUrl(panel){
  const p=new URLSearchParams(location.search);
  if(activeCustomer&&activeCustomer.slug)p.set('customer',activeCustomer.slug);
  if(activeCustomer&&activeCustomer.selectedCampaignId)p.set('campaignId',activeCustomer.selectedCampaignId);
  else if(!(activeCustomer&&activeCustomer.selectedCampaignId))p.delete('campaignId');
  if(panel)p.set('panel',panel);else p.delete('panel');
  history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''));
}
function setCustomerCampaignUrl(slug,campaignId){
  const p=new URLSearchParams(location.search);
  if(slug)p.set('customer',slug);else p.delete('customer');
  if(campaignId)p.set('campaignId',campaignId);else p.delete('campaignId');
  history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''));
}
function clearWorkflowPanelUrlParam(){setWorkflowPanelUrl(null);}
function mountWorkflowNav(heroElementId,backLabel){
  const el=document.getElementById(heroElementId);
  if(!el)return;
  const nav=workflowNavBarHtml(backLabel);
  const first=el.querySelector('.workflow-nav-bar');
  if(first){first.outerHTML=nav;return;}
  el.insertAdjacentHTML('afterbegin',nav);
}
function workflowNavBack(){
  const prev=workflowNavStack.pop();
  if(prev&&typeof prev.open==='function'){prev.open();return;}
  workflowNavBackToPharmacy();
}
function closeAllWorkflowPanelsExceptCustomer(){
  ['ierModal','speModal','spgModal','bprModal','cirModal','cqrModal','cprModal','cprPageListModal','cgeModal','idxModal','perfModal','onboardingModal','mpModal','cdcModal'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('open');});
  clearWorkflowPanelUrlParam();
}
async function workflowNavBackToPharmacy(){
  workflowNavStack.length=0;
  closeAllWorkflowPanelsExceptCustomer();
  if(activeCustomer&&activeCustomer.slug){
    const slug=activeCustomer.slug;
    try{
      const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/clear-campaign',{method:'POST',body:JSON.stringify({})});
      if(data.customer)activeCustomer=data.customer;
    }catch(_e){/* keep pharmacy open even if clear fails */}
    setCustomerCampaignUrl(slug,null);
    await openCustomer(slug);
  }
}
function workflowNavBackToMaster(){
  workflowNavStack.length=0;
  closeAllWorkflowPanelsExceptCustomer();
  const slug=activeCustomer&&activeCustomer.slug;
  if(slug){
    api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/clear-campaign',{method:'POST',body:JSON.stringify({})}).catch(function(){});
  }
  closeCustomerModal();
  const p=new URLSearchParams(location.search);p.delete('customer');p.delete('campaignId');p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''));
}
function pushWorkflowPanelNav(fromPanel,toPanel){
  if(fromPanel&&WORKFLOW_PANEL_OPENERS[fromPanel]){
    pushWorkflowNav({panel:fromPanel,open:WORKFLOW_PANEL_OPENERS[fromPanel]});
  }
  setWorkflowPanelUrl(toPanel);
}
function workflowNavBarHtml(backLabel){
  return '<div class="workflow-nav-bar" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">'+
    '<button type="button" class="btn secondary" style="font-size:.72rem" onclick="workflowNavBack()">← '+esc(backLabel||'Back')+'</button>'+
    '<button type="button" class="btn secondary" style="font-size:.72rem" onclick="workflowNavBackToPharmacy()">Back to Pharmacy</button>'+
    '<button type="button" class="btn secondary" style="font-size:.72rem" onclick="workflowNavBackToMaster()">Back to Master Dashboard</button></div>';
}
function evidenceFieldDecisionButtons(f,reviewLocked,prefix){
  if(reviewLocked)return '';
  const btns=[];
  if(f.status==='not_confirmed'){
    if(f.value||f.id==='fonts')btns.push('<button class="btn secondary '+prefix+'-field-decision-btn" type="button" data-'+prefix+'-field-id="'+esc(f.id)+'" data-'+prefix+'-decision="confirmed" style="font-size:.62rem;padding:4px 8px">Confirm</button>');
    if(f.allowNotApplicable)btns.push('<button class="btn secondary '+prefix+'-field-decision-btn" type="button" data-'+prefix+'-field-id="'+esc(f.id)+'" data-'+prefix+'-decision="not_applicable" style="font-size:.62rem;padding:4px 8px">Mark Not Applicable</button>');
    if(f.value&&f.id!=='fonts')btns.push('<button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px" onclick="editEvidenceFieldValue('+JSON.stringify(f.id)+','+JSON.stringify(prefix)+')">Edit</button>');
  }else if(f.status==='confirmed'||f.status==='not_applicable'){
    btns.push('<button class="btn secondary '+prefix+'-field-decision-btn" type="button" data-'+prefix+'-field-id="'+esc(f.id)+'" data-'+prefix+'-decision="confirmed" style="font-size:.62rem;padding:4px 8px">Confirm</button>');
    if(f.allowNotApplicable)btns.push('<button class="btn secondary '+prefix+'-field-decision-btn" type="button" data-'+prefix+'-field-id="'+esc(f.id)+'" data-'+prefix+'-decision="not_applicable" style="font-size:.62rem;padding:4px 8px">Mark Not Applicable</button>');
    if(f.value&&f.id!=='fonts')btns.push('<button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px" onclick="editEvidenceFieldValue('+JSON.stringify(f.id)+','+JSON.stringify(prefix)+')">Edit</button>');
  }
  return btns.length?('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">'+btns.join('')+'</div>'):'';
}
async function editEvidenceFieldValue(fieldId,origin){
  if(!activeCustomer)return;
  const next=prompt('Enter the corrected evidence value:');
  if(next==null)return;
  const trimmed=String(next).trim();
  if(!trimmed){toast('Value required',true);return;}
  await decideEvidenceReviewField(fieldId,'edit_value',null,origin,trimmed);
}
let activeBprReview=null;
let activeCqrReview=null;
let activeCdcReview=null;
let activeCprReview=null;
let activeCgeDashboard=null;
let activeIdxDashboard=null;
let activePerfDashboard=null;
let cprPollTimer=null;
let localAreasDraft=[];
let localAreasPrimaryTown='';
let localCoverageSavedConfirmed=false;
const LOCAL_COVERAGE_MINIMUM=3;
function formatLocalCoverageDistance(label){
  const text=String(label||'').trim();
  if(!text||text==='Distance unavailable')return 'Distance unavailable';
  const match=text.match(/([\d.]+)\s*km/i);
  return match?match[1]+' km':text;
}
function localCoverageDraftSelectedCount(){return localAreasDraft.filter(a=>a.selected).length}
function localCoverageGenerationStatus(savedConfirmed,selectedCount){
  if(savedConfirmed&&selectedCount>=LOCAL_COVERAGE_MINIMUM)return 'READY TO GENERATE';
  if(selectedCount>=LOCAL_COVERAGE_MINIMUM)return 'READY AFTER SAVE';
  return 'SELECT AREAS';
}
function renderLocalCoverageTable(){
  const tbody=document.getElementById('localCoverageTbody');
  if(!tbody)return;
  tbody.innerHTML=localAreasDraft.map((a,i)=>'<tr><td><input type="checkbox" '+(a.selected?'checked':'')+' onchange="toggleLocalCoverageArea('+i+',this.checked)"/></td><td>'+esc(a.areaName)+(a.recommended?' <span class="local-coverage-badge">Recommended</span>':'')+'</td><td>'+esc(formatLocalCoverageDistance(a.distanceLabel))+'</td><td>'+esc(String(a.confidence||'—'))+'</td><td><button class="btn secondary" type="button" style="font-size:.65rem" onclick="removeLocalCoverageArea('+i+')">Remove</button>'+(a.recommended?' <button class="btn secondary" type="button" style="font-size:.65rem" onclick="rejectLocalCoverageArea('+i+')">Reject</button>':'')+'</td></tr>').join('');
}
function renderLocalCoverageSummary(c){
  const gs=c.generationSetup||{};
  const recommended=localAreasDraft.filter(a=>a.recommended).length||gs.recommendedCount||0;
  const selected=localCoverageDraftSelectedCount()||gs.selectedCount||0;
  const savedConfirmed=Boolean(gs.areasConfirmed);
  localCoverageSavedConfirmed=savedConfirmed;
  const status=localCoverageGenerationStatus(savedConfirmed,selected);
  const summary=document.getElementById('detailLocalCoverageSummary');
  if(summary){
    summary.innerHTML=
      '<div class="local-coverage-stat"><div class="lbl">Recommended Areas</div><div class="val">'+esc(String(recommended))+'</div></div>'+
      '<div class="local-coverage-stat"><div class="lbl">Selected Areas</div><div class="val">'+esc(String(selected))+'</div></div>'+
      '<div class="local-coverage-stat"><div class="lbl">Minimum Required</div><div class="val">'+esc(String(LOCAL_COVERAGE_MINIMUM))+'</div></div>'+
      '<div class="local-coverage-stat"><div class="lbl">Generation Status</div><div class="val '+(status==='READY TO GENERATE'?'ready':status==='READY AFTER SAVE'?'pending':'')+'">'+esc(status)+'</div></div>';
  }
  const ready=document.getElementById('detailLocalCoverageReady');
  if(ready){
    ready.style.display=status==='READY TO GENERATE'?'block':'none';
    ready.textContent='READY TO GENERATE';
  }
  const actions=document.getElementById('detailLocalCoverageActions');
  if(actions){
    actions.innerHTML=
      '<button class="btn primary" type="button" onclick="acceptRecommendedLocalAreas()">Accept Recommended Areas</button>'+
      '<button class="btn secondary" type="button" onclick="selectAllLocalCoverageAreas()">Select All</button>'+
      '<button class="btn secondary" type="button" onclick="clearAllLocalCoverageAreas()">Clear All</button>'+
      '<button class="btn secondary" type="button" onclick="saveLocalAreasSelection()">Save Areas</button>';
  }
}
function addLocalCoverageArea(){
  const n=document.getElementById('localCoverageNewArea')?.value?.trim();
  if(!n){toast('Enter an area name',true);return}
  if(!localAreasPrimaryTown){toast('Enter primary town or city first',true);return}
  localAreasDraft.push({areaName:n,selected:true,recommended:false,source:'operator'});
  document.getElementById('localCoverageNewArea').value='';
  renderLocalCoverageTable();
  if(activeCustomer)renderLocalCoverageSummary(activeCustomer);
}
function removeLocalCoverageArea(i){
  localAreasDraft.splice(i,1);
  renderLocalCoverageTable();
  if(activeCustomer)renderLocalCoverageSummary(activeCustomer);
}
function rejectLocalCoverageArea(i){
  if(localAreasDraft[i]){localAreasDraft[i].selected=false;localAreasDraft[i].recommended=false}
  renderLocalCoverageTable();
  if(activeCustomer)renderLocalCoverageSummary(activeCustomer);
}
function isNationalMarketCustomer(c){
  if(c&&c.growthPlatform==='national')return true;
  const scope=(c&&c.marketScope&&c.marketScope.marketScope)||(c&&c.sections&&c.sections.businessProfile&&c.sections.businessProfile.marketScope)||'';
  return String(scope).toLowerCase()==='national';
}
async function loadLocalAreasDraft(){
  if(!activeCustomer)return;
  if(isNationalMarketCustomer(activeCustomer)){
    localAreasPrimaryTown='';
    localAreasDraft=[];
    const ptInput=document.getElementById('localCoveragePrimaryTown');
    if(ptInput)ptInput.value='';
    return;
  }
  const data=await api('/api/master-admin-platform/generation-setup/local-areas?slug='+encodeURIComponent(activeCustomer.slug));
  if(data.marketScope==='national'||data.localityStrategyActive===false){
    localAreasPrimaryTown='';
    localAreasDraft=[];
    const ptInput=document.getElementById('localCoveragePrimaryTown');
    if(ptInput)ptInput.value='';
    return;
  }
  localAreasPrimaryTown=data.primaryTown||'';
  const ptInput=document.getElementById('localCoveragePrimaryTown');
  if(ptInput)ptInput.value=localAreasPrimaryTown;
  localAreasDraft=(data.areas||[]).map(a=>({...a}));
}
async function renderLocalCoveragePanel(c){
  const gs=c.generationSetup||{};
  const collapse=document.getElementById('detailLocalCoverageCollapse');
  const national=isNationalMarketCustomer(c);
  const summaryLabel=document.getElementById('detailCoverageSummaryLabel');
  const nationalState=document.getElementById('detailNationalCoverageState');
  const localControls=document.getElementById('detailLocalCoverageControls');
  if(summaryLabel)summaryLabel.textContent=national?'National Coverage':'Local Coverage';
  if(nationalState)nationalState.style.display=national?'block':'none';
  if(localControls)localControls.style.display=national?'none':'block';
  if(national){
    const pm=document.getElementById('detailNationalPrimaryMarket');
    if(pm)pm.textContent=(c.marketScope&&c.marketScope.primaryMarket)||(c.sections&&c.sections.businessProfile&&c.sections.businessProfile.primaryMarket)||'United Kingdom';
    if(collapse)collapse.open=true;
    localAreasDraft=[];
    localAreasPrimaryTown='';
    return;
  }
  const atGenerate=String(c.currentStage||'').includes('generate')||String(c.workflow?.currentStage||'').includes('generate');
  if(collapse)collapse.open=Boolean(!gs.areasConfirmed||atGenerate);
  try{await loadLocalAreasDraft()}catch(e){toast(e.message,true)}
  renderLocalCoverageTable();
  renderLocalCoverageSummary(c);
}
function toggleLocalCoverageArea(idx,checked){
  if(localAreasDraft[idx])localAreasDraft[idx].selected=checked;
  renderLocalCoverageTable();
  if(activeCustomer)renderLocalCoverageSummary(activeCustomer);
}
function selectAllLocalCoverageAreas(){
  localAreasDraft.forEach(a=>{a.selected=true});
  renderLocalCoverageTable();
  if(activeCustomer)renderLocalCoverageSummary(activeCustomer);
}
function clearAllLocalCoverageAreas(){
  localAreasDraft.forEach(a=>{a.selected=false});
  renderLocalCoverageTable();
  if(activeCustomer)renderLocalCoverageSummary(activeCustomer);
}
async function syncWorkflowAfterLocalCoverageSave(validation){
  if(!activeCustomer)return;
  await refreshActiveCustomerDetail();
  if(validation&&validation.readiness==='READY TO GENERATE'){
    const btn=document.getElementById('continueWorkflowBtn');
    const orch=activeCustomer.orchestration||activeCustomer.workflow?.orchestration||{};
    if(btn){
      btn.disabled=!orch.canContinue;
      if(orch.canContinue)document.getElementById('detailBlockReason').textContent='';
    }
  }
}
async function saveLocalAreasSelection(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/generation-setup/local-areas/save',{method:'POST',body:JSON.stringify({slug:activeCustomer.slug,primaryTown:localAreasPrimaryTown,areas:localAreasDraft.map(a=>({areaName:a.areaName,selected:a.selected}))})});
    const st=document.getElementById('detailLocalCoverageSaveStatus');
    if(st)st.textContent='Saved '+String(data.setup?.selectedCount||0)+' selected area(s).';
    toast(data.validation?.readiness==='READY TO GENERATE'?'Local coverage saved — READY TO GENERATE':'Local coverage saved');
    if(data.setup)activeCustomer={...activeCustomer,generationSetup:data.setup};
    await syncWorkflowAfterLocalCoverageSave(data.validation);
    renderLocalCoverageTable();
    renderLocalCoverageSummary(activeCustomer);
  }catch(e){toast(e.message,true)}
}
async function acceptRecommendedLocalAreas(){
  if(!activeCustomer)return;
  try{
    localAreasDraft.forEach(a=>{if(a.recommended)a.selected=true});
    renderLocalCoverageTable();
    renderLocalCoverageSummary(activeCustomer);
    const data=await api('/api/master-admin-platform/generation-setup/local-areas/accept-recommended',{method:'POST',body:JSON.stringify({slug:activeCustomer.slug})});
    toast(data.validation?.readiness==='READY TO GENERATE'?'Recommended areas saved — READY TO GENERATE':'Recommended areas saved');
    if(data.setup)activeCustomer={...activeCustomer,generationSetup:data.setup};
    await loadLocalAreasDraft();
    await syncWorkflowAfterLocalCoverageSave(data.validation);
    renderLocalCoverageTable();
    renderLocalCoverageSummary(activeCustomer);
  }catch(e){toast(e.message,true)}
}
let bprDecisions={};
let bprShowAllImported=false;
let bprSaveTimer=null;
let jobPollTimer=null;
let customerJobPollTimer=null;
let customerDetailAbortController=null;
let customerDetailLoadSeq=0;
function stageDisplayLabel(c){if(c.currentStage==='live_customer')return'Customer Ready';return c.currentStageLabel||c.lifecycleLabel||''}
function jobDuration(j){if(!j.startedAt)return'—';const end=j.completedAt||j.updatedAt;const ms=new Date(end)-new Date(j.startedAt);return dur(ms)}
function accountStatusLabel(s){return s==='pending_first_login'?'Pending first login':s==='disabled'?'Disabled':s==='active'?'Active':s==='not_created'?'Not created':s||'—'}
function canonicalPreviewUrl(page){
  if(!activeCustomer)return'#';
  const slug=encodeURIComponent(activeCustomer.slug);
  const base='https://app.pharmaconnect.uk';
  if(page==='homepage')return base+'/api/pharmacy-visual-experience/?slug='+slug;
  if(page==='service')return base+'/api/pharmacy-visual-experience/pharmacy-first/?slug='+slug;
  if(page==='guide')return base+'/api/pharmacy-visual-experience/pharmacy-first-guide/?slug='+slug;
  if(page==='blog')return base+'/api/pharmacy-visual-experience/what-is-pharmacy-first/?slug='+slug;
  return'#';
}
function previewCanonicalWebsite(){window.open(canonicalPreviewUrl('homepage'),'_blank','noopener')}
function renderWebsiteSourcePanel(c){
  const ws=c.websiteSource||{};
  document.getElementById('detailWebsiteSource').innerHTML=
    '<div><span class="label">Canonical Website</span><div>'+(ws.canonicalWebsite?'<a href="'+esc(ws.canonicalWebsite)+'" target="_blank" rel="noopener">'+esc(ws.canonicalWebsite)+'</a>':'—')+'</div></div>'+
    '<div><span class="label">Website Status</span><div>'+esc(ws.websiteStatus||'—')+'</div></div>'+
    '<div><span class="label">Website Imported</span><div>'+(ws.websiteImported?'Yes':'No')+'</div></div>'+
    '<div><span class="label">Last Import</span><div>'+(ws.lastImportAt?fmt(ws.lastImportAt):'—')+(ws.lastImportMessage?'<div style="color:#64748b;font-size:.72rem">'+esc(ws.lastImportMessage)+'</div>':'')+'</div></div>'+
    '<div><span class="label">Import Evidence</span><div>'+(ws.importEvidenceUrl?esc(ws.importEvidenceUrl):'—')+(ws.importHistoryCount?'<div style="color:#64748b;font-size:.72rem">'+ws.importHistoryCount+' archived import(s)</div>':'')+'</div></div>'+
    (ws.websiteImported
      ? '<div style="margin-top:8px"><span class="label">Canonical Preview Pages</span><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;font-size:.72rem">'+
        '<a href="'+esc(canonicalPreviewUrl('homepage'))+'" target="_blank" rel="noopener">Homepage</a>'+
        '<a href="'+esc(canonicalPreviewUrl('service'))+'" target="_blank" rel="noopener">Service</a>'+
        '<a href="'+esc(canonicalPreviewUrl('guide'))+'" target="_blank" rel="noopener">Guide</a>'+
        '<a href="'+esc(canonicalPreviewUrl('blog'))+'" target="_blank" rel="noopener">Blog</a>'+
        '</div></div>'
      : '');
  const actions=document.getElementById('detailWebsiteActions');
  const canEdit=ws.canEditWebsite!==false;
  actions.innerHTML=
    '<button class="btn primary" type="button" onclick="previewCanonicalWebsite()">Preview Canonical Website</button>'+
    '<button class="btn secondary" type="button" onclick="editCanonicalWebsite()" '+(canEdit?'':'disabled title="'+esc(ws.editBlockedReason||'Locked')+'"')+'>Edit Website</button>'+
    '<button class="btn secondary" type="button" onclick="reimportWebsiteFromCustomerWorkflow()" '+(canEdit?'':'disabled')+'>Re-import Website</button>'+
    '<button class="btn secondary" type="button" onclick="openImportedEvidenceReview()">Open Imported Evidence Review</button>';
  const ev=document.getElementById('detailWebsiteEvidence');
  if(ws.importedEvidence&&ev.style.display!=='none'){ev.textContent=JSON.stringify(ws.importedEvidence,null,2)}else if(ev.style.display==='none'){ev.textContent=''}
}
function toggleWebsiteEvidence(){
  const el=document.getElementById('detailWebsiteEvidence');
  if(!activeCustomer||!activeCustomer.websiteSource||!activeCustomer.websiteSource.importedEvidence)return;
  if(el.style.display==='none'){el.style.display='block';el.textContent=JSON.stringify(activeCustomer.websiteSource.importedEvidence,null,2)}else{el.style.display='none'}
}
async function editCanonicalWebsite(){
  if(!activeCustomer)return;
  const ws=activeCustomer.websiteSource||{};
  if(ws.canEditWebsite===false){toast(ws.editBlockedReason||'Website locked',true);return}
  const url=prompt('Enter canonical branch website URL',ws.canonicalWebsite||activeCustomer.website||'');
  if(!url)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/edit_canonical_website',{method:'POST',body:JSON.stringify({websiteUrl:url.trim()})});
    toast('Canonical website updated');
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    await loadDashboard();
  }catch(e){toast(e.message,true)}
}
async function rerunWebsiteImport(){
  return reimportWebsiteFromCustomerWorkflow();
}
async function reimportWebsiteFromCustomerWorkflow(){
  if(!activeCustomer){toast('Open a customer first',true);return}
  const ws=activeCustomer.websiteSource||{};
  if(ws.canEditWebsite===false){toast(ws.editBlockedReason||'Website locked',true);return}
  const reimport=activeCustomer.websiteIntelligenceReimport||{};
  const target=reimport.targetUrl||ws.canonicalWebsite||activeCustomer.website||'';
  if(!target){toast('Canonical website is required before re-import',true);return}
  if(!confirm('Re-import Website for '+((activeCustomer.pharmacyName||activeCustomer.slug)||'this customer')+' from '+target+'?\\n\\nThis archives the current website import snapshot and runs a fresh website analysis using the existing website import capability. The current active snapshot will be replaced. Google Import will not run.'))return;
  const btn=document.getElementById('reimportWebsiteWorkflowBtn');
  if(btn){btn.disabled=true;btn.textContent='Queuing…'}
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/rerun_website_import',{method:'POST',body:'{}'});
    toast('Website re-import queued');
    startJobPolling();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){
    toast(e.message,true);
    if(btn){btn.disabled=false;btn.textContent='Re-import Website'}
  }
}
function renderGoogleConfirmationPanel(gs,preview){
  const panel=document.getElementById('detailGoogleConfirmation');
  const p=preview||gs.confirmationPreview;
  if(!p||gs.confirmationStatus!=='pending'){panel.style.display='none';panel.innerHTML='';return}
  panel.style.display='block';
  panel.innerHTML=
    '<h5>Confirm Google Business Profile</h5>'+
    '<p>Review this listing before Google Import runs.</p>'+
    '<div class="orchestration-summary">'+
    '<div><span class="label">Business Name</span><div>'+esc(p.businessName)+'</div></div>'+
    '<div><span class="label">Address</span><div>'+esc(p.address||'—')+'</div></div>'+
    '<div><span class="label">Telephone</span><div>'+esc(p.phone||'—')+'</div></div>'+
    '<div><span class="label">Website</span><div>'+(p.website?'<a href="'+esc(p.website)+'" target="_blank" rel="noopener">'+esc(p.website)+'</a>':'—')+'</div></div>'+
    '<div><span class="label">Rating</span><div>'+(p.rating!=null?esc(p.rating)+' ('+esc(p.reviewCount)+' reviews)':'—')+'</div></div>'+
    '<div><span class="label">Primary Category</span><div>'+esc(p.primaryCategory||'—')+'</div></div>'+
    '<div><span class="label">Place ID</span><div><code>'+esc(p.placeId)+'</code></div></div>'+
    '<div><span class="label">Google Maps</span><div>'+(p.googleMapsUrl?'<a href="'+esc(p.googleMapsUrl)+'" target="_blank" rel="noopener">Open in Maps</a>':'—')+'</div></div>'+
    '</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+
    '<button class="btn" type="button" onclick="confirmGoogleProfile()">Confirm</button>'+
    '<button class="btn secondary" type="button" onclick="rejectGoogleProfile()">Reject</button>'+
    '<button class="btn secondary" type="button" onclick="changeGoogleProfileUrl()">Replace URL</button>'+
    '<button class="btn secondary" type="button" onclick="searchGoogleProfileAgain()">Search Again</button>'+
    '</div>'+
    '<p class="ci-narrative" style="margin-top:8px;font-size:.68rem">Confirming starts Google Import automatically. You can also use Run Google Import after confirmation.</p>';
}
function renderGoogleSourcePanel(c){
  const gs=c.googleSource||{};
  document.getElementById('detailGoogleSource').innerHTML=
    '<div><span class="label">Business Name</span><div>'+esc(gs.businessName||'—')+'</div></div>'+
    '<div><span class="label">Google Business Profile URL</span><div>'+(gs.googleBusinessProfileUrl?'<a href="'+esc(gs.googleBusinessProfileUrl)+'" target="_blank" rel="noopener">'+esc(gs.googleBusinessProfileUrl)+'</a>':'—')+'</div></div>'+
    '<div><span class="label">Place ID</span><div>'+(gs.placeId?'<code>'+esc(gs.placeId)+'</code>':'—')+'</div></div>'+
    '<div><span class="label">Verification Status</span><div>'+esc(gs.verificationStatus||'—')+'</div></div>'+
    '<div><span class="label">Google Maps Link</span><div>'+(gs.googleMapsLink?'<a href="'+esc(gs.googleMapsLink)+'" target="_blank" rel="noopener">'+esc(gs.googleMapsLink)+'</a>':'—')+'</div></div>'+
    '<div><span class="label">Primary Category</span><div>'+esc(gs.primaryCategory||'—')+'</div></div>'+
    '<div><span class="label">Rating</span><div>'+(gs.rating!=null&&gs.rating>0?esc(gs.rating)+' ('+esc(gs.reviewCount||'Unknown')+' reviews)':(gs.placeId||gs.googleBusinessProfileUrl?'Not available':'Not connected'))+'</div></div>'+
    '<div><span class="label">Last Google Import</span><div>'+(gs.lastGoogleImport?fmt(gs.lastGoogleImport):'—')+'</div></div>'+
    '<div><span class="label">Import Status</span><div>'+esc(gs.importStatus||'—')+(gs.confidence!=null?' · confidence '+gs.confidence:'')+'</div></div>';
  renderGoogleConfirmationPanel(gs,gs.confirmationPreview);
  const actions=document.getElementById('detailGoogleActions');
  const canEdit=gs.canEditGoogle!==false;
  const hasUrl=Boolean(gs.googleBusinessProfileUrl||gs.placeId);
  actions.innerHTML=
    '<button class="btn secondary" type="button" onclick="addGoogleProfile()" '+(!hasUrl&&!canEdit?'disabled':'')+'>'+(hasUrl?'Edit Google Business Profile':'Add Google Business Profile')+'</button>'+
    (gs.confirmationStatus==='confirmed'?'<button class="btn secondary" type="button" onclick="confirmGoogleProfileDisplay()">Confirm Google Business Profile</button>':'')+
    (hasUrl?'<button class="btn secondary" type="button" onclick="changeGoogleProfileUrl()" '+(canEdit?'':'disabled')+'>Change Google Business Profile</button>':'')+
    '<button class="btn secondary" type="button" onclick="openGoogleCandidateSearch()">Search Google Listings</button>'+
    '<button class="btn secondary" type="button" onclick="openImportedEvidenceReview()">Open Imported Evidence Review</button>'+
    googleImportActionButtonHtml(gs,canEdit);
  const ev=document.getElementById('detailGoogleEvidence');
  if((gs.googleIntelligence||gs.importedEvidence)&&ev.style.display!=='none'){
    ev.textContent=JSON.stringify(gs.googleIntelligence||gs.importedEvidence,null,2);
  }else if(ev.style.display==='none'){ev.textContent=''}
}
function toggleGoogleEvidence(){
  const el=document.getElementById('detailGoogleEvidence');
  if(!activeCustomer||!activeCustomer.googleSource)return;
  const gs=activeCustomer.googleSource;
  const payload=gs.googleIntelligence||gs.importedEvidence;
  if(!payload)return;
  if(el.style.display==='none'){el.style.display='block';el.textContent=JSON.stringify(payload,null,2)}else{el.style.display='none'}
}
async function addGoogleProfile(){
  if(!activeCustomer)return;
  const gs=activeCustomer.googleSource||{};
  const url=prompt('Paste Google Maps, Google Business Profile, or Place ID URL',gs.googleBusinessProfileUrl||'');
  if(!url)return;
  const action=gs.googleBusinessProfileUrl?'edit_google_business_profile':'add_google_business_profile';
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/'+action,{method:'POST',body:JSON.stringify({googleBusinessUrl:url.trim()})});
    toast('Google Business Profile resolved — confirm before import');
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function changeGoogleProfileUrl(){
  if(!activeCustomer)return;
  const gs=activeCustomer.googleSource||{};
  const url=prompt('Replace Google Business Profile URL',gs.googleBusinessProfileUrl||'');
  if(!url)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/change_google_business_profile',{method:'POST',body:JSON.stringify({googleBusinessUrl:url.trim()})});
    toast('Google URL changed — confirm the new listing');
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function confirmGoogleProfile(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/confirm_google_business_profile',{method:'POST',body:'{}'});
    toast('Google Business Profile confirmed — Google Import is starting. Watch job status below.');
    startJobPolling();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    await loadDashboard();
  }catch(e){toast(e.message,true)}
}
function confirmGoogleProfileDisplay(){toast('Google Business Profile already confirmed')}
async function rejectGoogleProfile(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/reject_google_business_profile',{method:'POST',body:'{}'});
    toast('Google listing rejected');
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function searchGoogleProfileAgain(){
  if(!activeCustomer)return;
  const gs=activeCustomer.googleSource||{};
  const url=prompt('Search again with Google URL (leave blank to reuse current)',gs.googleBusinessProfileUrl||'');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/search_google_business_profile',{method:'POST',body:JSON.stringify({googleBusinessUrl:url?url.trim():undefined})});
    toast('Search completed — confirm the listing');
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function rerunGoogleImport(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/rerun_google_import',{method:'POST',body:'{}'});
    toast('Google import queued');
    startJobPolling();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
function googleImportActionButtonHtml(gs,canEdit){
  const confirmed=gs.confirmationStatus==='confirmed';
  const imported=Boolean(gs.googleImported||gs.lastGoogleImport);
  const enabled=confirmed&&canEdit;
  const label=imported?'Re-run Google Import':'Run Google Import';
  const hint=!confirmed?'Confirm the Google Business Profile listing first.':(!canEdit?(gs.editBlockedReason||'Google import is locked'):'');
  const btnClass=enabled&&!imported?'btn primary':'btn secondary';
  return '<button class="'+btnClass+'" type="button" onclick="runGoogleImport()" '+(enabled?'':'disabled')+(hint?' title="'+esc(hint)+'"':'')+'>'+esc(label)+'</button>';
}
async function runGoogleImport(){
  await rerunGoogleImport();
}
function renderCustomerAccountPanel(c){
  const ac=c.customerAccount||{};
  const temp=ac.temporaryPassword?esc(ac.temporaryPassword):'<span style="color:#64748b">Hidden after first login</span>';
  document.getElementById('detailAccountSummary').innerHTML=
    '<div><span class="label">Customer ID</span><div><code>'+esc(ac.customerId||c.slug)+'</code></div></div>'+
    '<div><span class="label">Username</span><div>'+esc(ac.username||'—')+'</div></div>'+
    '<div><span class="label">Email</span><div>'+esc(ac.email||'—')+'</div></div>'+
    '<div><span class="label">Temporary Password</span><div>'+temp+'</div></div>'+
    '<div><span class="label">Password Reset Token</span><div>'+(ac.passwordResetToken?'<code style="word-break:break-all">'+esc(ac.passwordResetToken)+'</code>':'—')+'</div></div>'+
    '<div><span class="label">Role</span><div>'+esc(ac.role||'—')+'</div></div>'+
    '<div><span class="label">Customer Dashboard URL</span><div>'+(ac.dashboardUrl?'<a href="'+esc(ac.dashboardUrl)+'" target="_blank" rel="noopener">'+esc(ac.dashboardUrl)+'</a>':'—')+'</div></div>'+
    '<div><span class="label">Account Status</span><div>'+esc(accountStatusLabel(ac.accountStatus))+'</div></div>'+
    '<div><span class="label">Welcome Email Draft</span><div>'+(ac.welcomeEmailDraft?'Prepared':'Not generated')+'</div></div>';
  const actions=document.getElementById('detailAccountActions');
  if(!ac.hasAccount){actions.innerHTML='<span style="color:#64748b;font-size:.78rem">No customer account on record.</span>';document.getElementById('detailWelcomeDraft').style.display='none';return}
  actions.innerHTML=
    '<button class="btn secondary" type="button" onclick="accountAction(\\'reset_password\\')">Generate New Password</button>'+
    '<button class="btn secondary" type="button" onclick="accountAction(\\'welcome_credentials_draft\\')">Generate Welcome Email</button>'+
    '<button class="btn secondary" type="button" onclick="copyCustomerCredentials()">Copy Credentials</button>';
  const draftEl=document.getElementById('detailWelcomeDraft');
  if(ac.welcomeEmailDraft){draftEl.style.display='block';draftEl.textContent=ac.welcomeEmailDraft}else{draftEl.style.display='none'}
}
async function accountAction(actionId){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/'+actionId,{method:'POST',body:'{}'});
    if(data.result&&data.result.temporaryPassword){toast('New password: '+data.result.temporaryPassword);activeCustomer.pendingPassword=data.result.temporaryPassword}
    if(data.result&&data.result.draft){toast('Welcome email draft generated');document.getElementById('detailWelcomeDraft').style.display='block';document.getElementById('detailWelcomeDraft').textContent=data.result.draft}
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
function copyCustomerCredentials(){
  if(!activeCustomer)return;
  const ac=activeCustomer.customerAccount||{};
  const pw=ac.temporaryPassword||activeCustomer.pendingPassword||'';
  const text='Username: '+(ac.username||'')+'\\nTemporary password: '+pw+'\\nLogin: '+(ac.loginUrl||'')+'\\nDashboard: '+(ac.dashboardUrl||'');
  navigator.clipboard.writeText(text).then(()=>toast('Credentials copied')).catch(()=>toast('Copy failed',true));
}

function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fmt(iso){if(!iso)return'—';try{return new Date(iso).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}catch{return iso}}
function healthDot(l){return l==='healthy'?'health-healthy':l==='warning'?'health-warning':'health-offline'}
function apiErrorMessage(err,fallback){
  if(err==null||err==='')return fallback||'Request failed';
  if(typeof err==='string')return err;
  if(typeof err.error==='string')return err.error;
  if(err.error&&typeof err.error.message==='string')return err.error.message;
  if(typeof err.message==='string'&&err.message)return err.message;
  try{return String(err)}catch(_e){return fallback||'Request failed'}
}
function toast(msg,isError){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=apiErrorMessage(msg,isError?'Request failed':'Done');
  el.style.borderColor=isError?'#ef4444':'#475569';
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),4000);
}
/** CPR-SERVICE-PREVIEW-01 — Product Owner preview links must carry login handoff (_t) when cookies are absent. */
function withAuthHandoff(href){
  if(!href||href==='#')return href;
  try{
    const handoff=new URLSearchParams(location.search).get('_t');
    if(!handoff)return href;
    const u=new URL(href,location.origin);
    if(!u.searchParams.get('_t'))u.searchParams.set('_t',handoff);
    return u.pathname+u.search+u.hash;
  }catch(_e){return href;}
}
function withCustomerSlug(href){
  if(!href||href==='#')return href;
  const slug=activeCustomer&&activeCustomer.slug;
  if(!slug)return href;
  try{
    const u=new URL(href,location.origin);
    if(!u.searchParams.get('slug')&&!u.searchParams.get('tenant'))u.searchParams.set('slug',slug);
    return u.pathname+u.search+u.hash;
  }catch(_e){return href;}
}
async function api(path,opts){
  const timeoutMs=(opts&&opts.timeoutMs)||30000;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const parentSignal=opts&&opts.signal;
  if(parentSignal){
    if(parentSignal.aborted){controller.abort();}
    else parentSignal.addEventListener('abort',()=>controller.abort(),{once:true});
  }
  const fetchOpts={headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',...opts,signal:controller.signal};
  delete fetchOpts.timeoutMs;
  // Preserve login handoff token (_t) for cookie-less iframe contexts.
  if(typeof path==='string'&&path.startsWith('/')){
    path=withAuthHandoff(path);
  }
  try{
    const res=await fetch(path,fetchOpts);
    const ct=res.headers.get('content-type')||'';
    const data=ct.includes('application/json')?await res.json().catch(()=>({})):null;
    if(!res.ok){
      if(res.redirected&&String(res.url||'').includes('/api/login'))throw new Error('Authentication required — sign in again.');
      let errMsg='';
      if(data){
        if(typeof data.error==='string')errMsg=data.error;
        else if(data.error&&typeof data.error.message==='string')errMsg=data.error.message;
        else if(typeof data.message==='string')errMsg=data.message;
      }
      throw new Error(errMsg||res.statusText||('HTTP '+res.status));
    }
    if(!data)throw new Error('Expected JSON response but received '+ct);
    return data;
  }catch(e){
    if(e&&e.name==='AbortError'){
      if(parentSignal&&parentSignal.aborted)throw e;
      throw new Error('Request timed out after '+timeoutMs+'ms');
    }
    throw e;
  }finally{clearTimeout(timer)}
}
async function loadCustomerDetailSections(_slug,_loadSeq){
  /* NT-E2E-32B: heavy sections load lazily via panel routes only */
}

function showCustomerTableError(message){
  const wrap=document.getElementById('customerTableWrap');
  if(!wrap)return;
  wrap.innerHTML='<div class="bpr-error-panel" style="margin:0"><h4>Customer list could not be loaded</h4><p class="bpr-error-detail">'+esc(message)+'</p><p class="workflow-meta" style="margin-top:8px">'+esc(new Date().toISOString())+'</p><div class="bpr-error-actions" style="margin-top:10px"><button class="btn" type="button" onclick="loadDashboard()">Retry</button></div></div>';
}

function workflowIcon(status){return status==='complete'?'✓':status==='current'?'▶':'○'}
function dur(ms){if(!ms&&ms!==0)return'';const m=Math.round(ms/60000);return m<1?'<1 min':m+' min'}

function renderWorkflowOverview(){
  const el=document.getElementById('workflowOverview');
  if(!workflowStages.length){el.innerHTML='<div class="empty">No workflow stages</div>';return}
  el.innerHTML=workflowStages.map(s=>{
    const count=workflowStageCounts[s.id]||0;
    const hasCurrent=customers.some(c=>c.currentStage===s.id);
    const status=hasCurrent?'current':'pending';
    return '<div class="workflow-row"><span class="workflow-icon '+status+'">'+workflowIcon(status)+'</span><div class="workflow-label">'+esc(s.label)+(count?'<span class="workflow-count">('+count+')</span>':'')+'</div></div>';
  }).join('');
  const sel=document.getElementById('lifecycleFilter');
  sel.innerHTML='<option value="">All workflow stages</option>'+workflowStages.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.label)+'</option>').join('');
}

function setCustomerArchiveFilter(mode){
  customerArchiveFilter=mode;
  document.querySelectorAll('#customerArchiveTabs .list-tab').forEach(btn=>{
    btn.classList.toggle('active',btn.getAttribute('data-archive-filter')===mode);
  });
  filterCustomers();
}
function openCustomerGrowthEngine(slug){
  if(!slug)return;
  openCustomer(slug);
}
async function archiveCustomerFromList(slug,event){
  if(event)event.stopPropagation();
  if(!slug||!confirm('Archive this pharmacy? Data is kept — it will move to the Archived list.'))return;
  try{
    await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/actions/archive',{method:'POST',body:'{}'});
    toast('Pharmacy archived');
    await loadDashboard();
  }catch(e){toast(e.message||String(e),true)}
}
async function restoreCustomerFromList(slug,event){
  if(event)event.stopPropagation();
  if(!slug)return;
  try{
    await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/actions/restore_archived',{method:'POST',body:'{}'});
    toast('Pharmacy restored to Active');
    customerArchiveFilter='active';
    setCustomerArchiveFilter('active');
    await loadDashboard();
  }catch(e){toast(e.message||String(e),true)}
}
function customerMatchesArchiveTab(c){
  if(customerArchiveFilter==='archived')return Boolean(c.archived);
  if(customerArchiveFilter==='all')return true;
  return !c.archived;
}
function statusPillClass(label){
  const u=String(label||'').toUpperCase();
  // Check negative forms first — "NOT CONNECTED" contains "CONNECTED".
  if(u.includes('NOT CONNECTED')||u.includes('NOT ')||u.includes('UNKNOWN')||u.includes('REQUIRED')||u.includes('FAIL'))return 'warn';
  if(u.includes('PUBLISHED')||u.includes('GENERATED')||u.includes('CONNECTED')||u.includes('COMPLETE')||u.includes('APPROVED')||u.includes('PASS'))return 'ok';
  return '';
}
function renderCustomerStatusPills(c){
  const ps=c.platformStatus||{};
  const scm=c.searchConsoleMetrics||{};
  const gscConnected=Boolean(scm.searchConsoleConnected);
  const pills=[
    ['Gen',c.generationStatus||ps.generationStatus],
    ['Pub',c.publishingStatus||ps.publishingStatus],
    ['GSC',gscConnected?'CONNECTED':'NOT CONNECTED'],
    ['Indexed',scm.indexedPages!=null?String(scm.indexedPages):'—'],
    ['Impr.',scm.impressions!=null?String(scm.impressions):'—'],
    ['Clicks',scm.clicks!=null?String(scm.clicks):'—'],
    ['Pos',scm.averagePosition||'—'],
    ['Health',scm.indexHealth||'—']
  ];
  return '<div class="status-pill-row">'+pills.map(p=>'<span class="status-pill '+statusPillClass(p[1])+'">'+esc(p[0]+': '+String(p[1]||'—'))+'</span>').join('')+'</div>';
}
function renderCustomerTable(){
  const visible=customers.filter(c=>customerMatchesArchiveTab(c));
  const countEl=document.getElementById('customerListCount');
  if(countEl)countEl.textContent='('+visible.length+' shown)';
  const cards=customers.map(c=>{
    const pct=Math.max(0,Math.min(100,Number(c.workflowCompletionPct??c.completionPct??0)));
    const website=c.website?('<a href="'+esc(c.website)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+esc(c.website.replace(/^https?:\\/\\//,''))+'</a>'):'—';
    const status=esc(c.currentStageLabel||c.lifecycleLabel||'—');
    const archived=Boolean(c.archived);
    const actions=archived
      ?'<button type="button" class="btn-restore" onclick="restoreCustomerFromList(\\''+esc(c.slug)+'\\',event)">Restore to Active</button>'
      :'<button type="button" class="btn-grow" onclick="openCustomerGrowthEngine(\\''+esc(c.slug)+'\\')">Open Pharmacy</button><button type="button" class="btn-archive" onclick="archiveCustomerFromList(\\''+esc(c.slug)+'\\',event)">Archive</button>';
    return '<article class="customer-card'+(archived?' archived':'')+'" data-slug="'+esc(c.slug)+'" data-archived="'+(archived?'1':'0')+'">'+
      '<div class="customer-card-head"><h3>'+esc(c.businessName)+'</h3><span class="health-dot '+healthDot(c.health)+'" title="'+esc(c.healthLabel)+'"></span></div>'+
      '<div class="customer-card-meta">'+
      '<div><strong>Status:</strong> '+status+'</div>'+
      '<div><strong>Website:</strong> '+website+'</div>'+
      '<div><strong>Last activity:</strong> '+fmt(c.lastActivity)+'</div>'+
      renderCustomerStatusPills(c)+
      (c.loadError?('<div style="color:#f87171">'+esc(c.loadError)+'</div>'):'')+
      '</div>'+
      '<div class="customer-card-progress"><div style="font-size:.68rem;color:#64748b;display:flex;justify-content:space-between"><span>Progress</span><span>'+esc(String(pct))+'%</span></div><div class="customer-card-progress-bar"><div style="width:'+pct+'%"></div></div></div>'+
      '<div class="customer-card-actions">'+actions+'</div></article>';
  }).join('');
  document.getElementById('customerTableWrap').innerHTML='<div class="customer-card-grid" id="customerCardGrid">'+(cards||'<div class="empty">No pharmacies in this list.</div>')+'</div>';
  filterCustomers();
}
function filterCustomers(){
  const q=(document.getElementById('search')?.value||'').toLowerCase();
  const lf=document.getElementById('lifecycleFilter')?.value||'';
  document.querySelectorAll('.customer-card').forEach(card=>{
    const slug=card.getAttribute('data-slug');
    const c=customers.find(x=>x.slug===slug);
    if(!c){card.style.display='none';return}
    const tabOk=customerMatchesArchiveTab(c);
    const match=!q||c.businessName.toLowerCase().includes(q)||(c.website||'').toLowerCase().includes(q);
    const stage=!lf||c.currentStage===lf;
    card.style.display=tabOk&&match&&stage?'':'none';
  });
  const shown=document.querySelectorAll('.customer-card:not([style*="display: none"])').length;
  const hiddenStyle=document.querySelectorAll('.customer-card[style*="display: none"]').length;
  const visible=Math.max(0,document.querySelectorAll('.customer-card').length-hiddenStyle);
  const countEl=document.getElementById('customerListCount');
  if(countEl){
    const tabLabel=customerArchiveFilter==='archived'?'Archived':customerArchiveFilter==='all'?'All':'Active';
    countEl.textContent=tabLabel+' · '+visible+' shown';
  }
}

function renderHealth(items){
  document.getElementById('healthPanel').innerHTML=(items||[]).map(h=>'<div class="health-card"><div class="health-head"><span class="health-dot '+healthDot(h.status)+'"></span><strong>'+esc(h.label)+'</strong></div><div class="health-status">'+esc(h.statusLabel)+'</div><div class="health-detail">'+esc(h.detail)+'</div><div class="health-time">'+(h.lastSuccessfulRun?fmt(h.lastSuccessfulRun):'No successful run recorded')+'</div></div>').join('');
}

function renderJobs(jobs){
  if(!jobs||!jobs.length){document.getElementById('jobsPanel').innerHTML='<div class="empty">No background jobs</div>';return}
  document.getElementById('jobsPanel').innerHTML=jobs.slice(0,8).map(j=>'<div class="job-row"><strong class="status-'+j.status+'">'+esc(j.status)+'</strong> · '+esc(j.action)+' · '+esc(j.slug)+'<br><span style="color:#64748b">'+esc(j.progressLabel)+' · '+fmt(j.updatedAt)+'</span></div>').join('');
}

function renderActivity(entries){
  document.getElementById('activityPanel').innerHTML='<table class="audit-table"><thead><tr><th>Time</th><th>Action</th><th>Status</th></tr></thead><tbody>'+(entries||[]).slice(0,8).map(a=>'<tr><td>'+fmt(a.timestamp)+'</td><td>'+esc(a.action)+'</td><td class="status-'+esc(a.status)+'">'+esc(a.status)+'</td></tr>').join('')+'</tbody></table>';
}

let platformOpsDashboard=null;
let platformOpsStageFilter='';
function poOpsPill(status){
  const s=String(status||'');
  const cls=/pass|ready|healthy|yes/i.test(s)?'pass':(/warn|configured|setup required/i.test(s)?'warning':'blocked');
  return '<span class="po-ops-pill '+cls+'">'+esc(s)+'</span>';
}
function poOpsCards(rows){
  return '<div class="po-ops-grid">'+rows.map(function(r){
    const click=r.onclick?' onclick="'+r.onclick+'" role="button" tabindex="0"':'';
    const cls='po-ops-card'+(r.onclick?' clickable':'')+(r.active?' active':'');
    return '<div class="'+cls+'"'+click+'><div class="lbl">'+esc(r.label)+'</div><div class="val">'+esc(String(r.value))+'</div></div>';
  }).join('')+'</div>';
}
function poOpsScrollTo(id){
  const el=document.getElementById(id);
  if(!el)return;
  document.querySelectorAll('.po-ops-section.po-ops-focus').forEach(function(n){n.classList.remove('po-ops-focus');});
  el.classList.add('po-ops-focus');
  if(el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'});
}
function poOpsCloseCustomerWorkspace(){
  const modal=document.getElementById('customerModal');
  if(modal)modal.classList.remove('open');
}
async function ensurePlatformOpsCustomer(slug,campaignId){
  if(!slug)throw new Error('Primary customer unavailable');
  if(!(activeCustomer&&activeCustomer.slug===slug)){
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug),{timeoutMs:30000});
    activeCustomer=data.customer;
    if(data.workflowSummary)activeCustomer.workflowSummary=data.workflowSummary;
  }
  if(campaignId&&activeCustomer&&activeCustomer.selectedCampaignId!==campaignId){
    try{
      const sel=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/select-campaign',{method:'POST',body:JSON.stringify({campaignId:campaignId})});
      if(sel.customer)activeCustomer=sel.customer;
      if(sel.workflowSummary&&activeCustomer)activeCustomer.workflowSummary=sel.workflowSummary;
    }catch(_e){}
  }
  poOpsCloseCustomerWorkspace();
  return activeCustomer;
}
function platformOpsPrimarySlug(){
  return (platformOpsDashboard&&platformOpsDashboard.primarySlug)||'leeds-pharmacy';
}
function platformOpsCampaignIdForStage(stage){
  const items=(platformOpsDashboard&&platformOpsDashboard.campaignOperations&&platformOpsDashboard.campaignOperations.items)||[];
  const preferred=items.find(function(i){return i.stage===stage&&String(i.href||'').includes(platformOpsPrimarySlug());});
  const any=items.find(function(i){return i.stage===stage;});
  const href=(preferred||any||{}).href||'';
  try{return new URL(href,location.origin).searchParams.get('campaignId')||'';}catch(_e){return '';}
}
async function openPlatformOpsQualityArtifacts(){
  await ensurePlatformOpsCustomer(platformOpsPrimarySlug());
  const modal=document.getElementById('cqrModal');
  if(!modal){toast('Quality Review screen unavailable',true);return;}
  modal.classList.add('open');
  document.getElementById('cqrLoading').style.display='block';
  document.getElementById('cqrContent').style.display='none';
  document.getElementById('cqrError').style.display='none';
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review');
    if(!data.review)throw new Error('Review payload missing');
    renderCommercialQualityReview(data.review);
    document.getElementById('cqrLoading').style.display='none';
    document.getElementById('cqrContent').style.display='block';
  }catch(e){
    document.getElementById('cqrLoading').style.display='none';
    document.getElementById('cqrError').style.display='block';
    document.getElementById('cqrErrorDetail').textContent=e.message||String(e);
  }
}
async function openPlatformOpsSearchVisibility(){
  await ensurePlatformOpsCustomer(platformOpsPrimarySlug());
  poOpsCloseCustomerWorkspace();
  await openCommercialIndexingReview(true);
}
function poOpsCloseOpenScreens(){
  document.querySelectorAll('.modal-backdrop.open').forEach(function(m){m.classList.remove('open');});
  poOpsCloseCustomerWorkspace();
}
let poOpsCapabilityNavInFlight=false;
function bindPlatformOpsCapabilityNav(){
  const root=document.getElementById('poOpsCapabilityMatrix');
  if(!root)return;
  root.onclick=async function(ev){
    const tr=ev.target&&ev.target.closest?ev.target.closest('tr[data-capability]'):null;
    if(!tr)return;
    const id=tr.getAttribute('data-capability');
    if(!id)return;
    ev.preventDefault();
    if(poOpsCapabilityNavInFlight)return;
    poOpsCapabilityNavInFlight=true;
    try{await openPlatformOpsCapability(id);}
    finally{poOpsCapabilityNavInFlight=false;}
  };
}
/** Capability Matrix only — opens existing Locality Review screen without changing workflow gates. */
async function openPlatformOpsLocalityReview(){
  const primary=platformOpsPrimarySlug();
  const items=(platformOpsDashboard&&platformOpsDashboard.campaignOperations&&platformOpsDashboard.campaignOperations.items)||[];
  const item=items.find(function(i){
    return i.stage==='Locality Review'&&String(i.href||'').indexOf('customer='+encodeURIComponent(primary))>=0;
  })||items.find(function(i){
    return i.stage==='Locality Review'&&String(i.href||'').indexOf('customer='+primary)>=0;
  })||items.find(function(i){return i.stage==='Locality Review';});
  let campSlug=primary,campId='';
  if(item&&item.href){
    try{
      const u=new URL(item.href,location.origin);
      campSlug=u.searchParams.get('customer')||primary;
      campId=u.searchParams.get('campaignId')||'';
    }catch(_e){}
  }
  await ensurePlatformOpsCustomer(campSlug,campId);
  poOpsCloseCustomerWorkspace();
  await openClusterPageReview();
}
async function openPlatformOpsCapability(capabilityId){
  const id=String(capabilityId||'');
  const slug=platformOpsPrimarySlug();
  poOpsCloseOpenScreens();
  try{
    if(id==='Service Registration'){poOpsScrollTo('poOpsServiceRegistration');return;}
    if(id==='Campaign Manager'){platformOpsStageFilter='';renderPlatformOperations(platformOpsDashboard);poOpsScrollTo('poOpsCampaignOperations');return;}
    if(id==='Business Profile'){await ensurePlatformOpsCustomer(slug);await openBusinessProfileReview({forceReadinessRecovery:true});poOpsCloseCustomerWorkspace();return;}
    if(id==='Evidence'){await ensurePlatformOpsCustomer(slug,platformOpsCampaignIdForStage('Evidence Review')||platformOpsCampaignIdForStage('Draft'));await openServicePageEvidenceReview();poOpsCloseCustomerWorkspace();return;}
    if(id==='Generation'){
      await ensurePlatformOpsCustomer(slug,platformOpsCampaignIdForStage('Service Review')||platformOpsCampaignIdForStage('Draft')||platformOpsCampaignIdForStage('Locality Review'));
      if(typeof customerAtCoreProductRecovery==='function'&&!customerAtCoreProductRecovery(activeCustomer)){
        await openServicePageEvidenceReview();
      }else{
        await openServicePageGeneration();
      }
      poOpsCloseCustomerWorkspace();
      return;
    }
    if(id==='Locality Generation'){await openPlatformOpsLocalityReview();return;}
    if(id==='Review'){await ensurePlatformOpsCustomer(slug,platformOpsCampaignIdForStage('Service Review')||platformOpsCampaignIdForStage('Locality Review'));await openServicePageReview();poOpsCloseCustomerWorkspace();return;}
    if(id==='Publishing'){
      await ensurePlatformOpsCustomer(slug);
      if(typeof customerAtManagedPublishing==='function'&&customerAtManagedPublishing(activeCustomer))await openManagedPublishing();
      else if(typeof customerAtPublishReview==='function'&&customerAtPublishReview(activeCustomer))await openCommercialPublishReview();
      else await openPlatformInfrastructure();
      poOpsCloseCustomerWorkspace();
      return;
    }
    if(id==='Static Deployment'){await openPlatformInfrastructure();return;}
    if(id==='Registry'||id==='Sitemap'||id==='Structured Data'){await openPlatformOpsQualityArtifacts();poOpsCloseCustomerWorkspace();return;}
    if(id==='Image Platform'){await ensurePlatformOpsCustomer(slug);await openServicePageEvidenceReview();poOpsCloseCustomerWorkspace();return;}
    if(id==='Indexing'||id==='Search Console'){await openPlatformOpsSearchVisibility();return;}
    if(id==='Rank Tracking'||id==='Dashboard Reporting'){await ensurePlatformOpsCustomer(slug);poOpsCloseCustomerWorkspace();await openCommercialPerformanceDashboard(true);return;}
    toast('No Product Owner screen mapped for '+id,true);
  }catch(e){
    toast((e&&e.message)?e.message:String(e),true);
  }
}
function openPlatformOpsCampaignStage(stage){
  platformOpsStageFilter=String(stage||'');
  renderPlatformOperations(platformOpsDashboard);
  poOpsScrollTo('poOpsCampaignOperations');
  const list=document.getElementById('poOpsCampaignStageList');
  if(list&&list.scrollIntoView)list.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function openPlatformOpsCreateCampaign(slug){
  if(!slug)return;
  await openCustomer(slug);
  const panel=document.getElementById('detailServiceCampaignsCollapse');
  if(panel)panel.open=true;
  const el=document.getElementById('po-create-campaign')||document.getElementById('detailCreateCampaignPanel');
  if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'});
}
async function openPlatformOpsHref(href){
  if(!href)return;
  if(href==='search-visibility'){await openPlatformOpsSearchVisibility();return;}
  try{
    const u=new URL(href,location.origin);
    const slug=u.searchParams.get('customer');
    const campaignId=u.searchParams.get('campaignId');
    if(slug){
      await openCustomer(slug,{campaignId:campaignId||''});
      if(u.hash==='#po-create-campaign'){
        const panel=document.getElementById('detailServiceCampaignsCollapse');
        if(panel)panel.open=true;
        const el=document.getElementById('po-create-campaign');
        if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'});
      }
      return;
    }
  }catch(_e){}
  location.href=href;
}
function renderPlatformOperations(dashboard){
  const el=document.getElementById('platformOpsBody');
  if(!el)return;
  if(!dashboard){
    el.innerHTML='<div class="empty">Platform operations unavailable</div>';
    return;
  }
  platformOpsDashboard=dashboard;
  const ps=dashboard.platformStatus||{};
  const caps=dashboard.capabilities||[];
  const services=dashboard.services||[];
  const stages=dashboard.campaignOperations&&dashboard.campaignOperations.counts||{};
  const stageItems=dashboard.campaignOperations&&dashboard.campaignOperations.items||[];
  const filteredItems=platformOpsStageFilter?stageItems.filter(function(item){return item.stage===platformOpsStageFilter;}):stageItems;
  const content=dashboard.contentStatus||{};
  const search=dashboard.searchVisibility||{};
  const health=dashboard.platformHealth||{};
  const polish=dashboard.polishBacklog||[];
  const release=dashboard.releaseReadiness||[];
  const scConnected=!!search.searchConsoleConnected;

  let html='';
  html+='<div class="po-ops-section" id="poOpsPlatformStatus"><h3>1 · Platform Status</h3>'+poOpsCards([
    {label:'Platform Version',value:ps.platformVersion||'—'},
    {label:'Architecture Status',value:ps.architectureStatus||'—'},
    {label:'Workflow Status',value:ps.workflowStatus||'—'},
    {label:'Generation Engine',value:ps.generationEngine||'—'},
    {label:'Image Platform',value:ps.imagePlatform||'—'},
    {label:'Static Deployment',value:ps.staticDeployment||'—'},
    {label:'Registry',value:ps.registry||'—'},
    {label:'Sitemap',value:ps.sitemap||'—'},
    {label:'Search Console',value:ps.searchConsole||'—'},
    {label:'Platform Health',value:ps.platformHealth||'—'},
    {label:'Last Platform Audit',value:ps.lastPlatformAudit?fmt(ps.lastPlatformAudit):'—'}
  ])+'</div>';

  html+='<div class="po-ops-section" id="poOpsCapabilityMatrix"><h3>2 · Platform Capability Matrix</h3><table class="po-ops-table"><thead><tr><th>Capability</th><th>Status</th><th>Live state</th><th></th></tr></thead><tbody>'+
    caps.map(function(c){
      const capLabel=c.id==='Service Registration'?'Pharmacy Customer Generation Capability':c.id;
      return '<tr class="clickable" data-capability="'+esc(c.id)+'" tabindex="0" role="link" aria-label="Open '+esc(capLabel)+'"><td>'+esc(capLabel)+'</td><td>'+poOpsPill(c.status)+'</td><td>'+esc(c.detail||'')+'</td><td><button class="btn secondary" type="button" style="font-size:.68rem">Open</button></td></tr>';
    }).join('')+
    '</tbody></table></div>';

  const tenantServices=dashboard.tenantCommercialServices||[];
  if(dashboard.viewingPlatform==='national'){
    html+='<div class="po-ops-section" id="poOpsTenantCommercialServices"><h3>3a · This customer\\'s commercial services</h3>'+
      '<p style="font-size:.74rem;color:#94a3b8;margin:0 0 10px">Digital-growth services from this NATIONAL customer\\'s project configuration. The locked patient-service catalogue is not this customer\\'s own services.</p>'+
      (tenantServices.length
        ? '<table class="po-ops-table"><thead><tr><th>Service</th><th>ID</th></tr></thead><tbody>'+
          tenantServices.map(function(s){return '<tr><td>'+esc(s.serviceName)+'</td><td>'+esc(s.serviceId)+'</td></tr>';}).join('')+
          '</tbody></table>'
        : '<div class="empty">No project commercial services configured for this customer.</div>')+
      '</div>';
  }

  html+='<div class="po-ops-section" id="poOpsServiceRegistration"><h3>3 · Pharmacy Customer Generation Capability</h3>'+
    '<p style="font-size:.74rem;color:#94a3b8;margin:0 0 10px">'+esc((dashboard.pharmacyCustomerGenerationCapability&&dashboard.pharmacyCustomerGenerationCapability.note)||'Locked patient-service catalogue for local pharmacy customers.')+'</p>'+
    '<table class="po-ops-table"><thead><tr><th>Service</th><th>Registration</th><th>Published</th><th>Indexed</th><th>Campaigns</th><th>Action</th></tr></thead><tbody>'+
    services.map(function(s){
      const action=s.generationReady
        ? '<button class="btn" type="button" style="font-size:.68rem" onclick="openPlatformOpsCreateCampaign(\\''+esc(dashboard.primarySlug||'')+'\\')">Create Campaign</button>'
        : '<span style="color:#94a3b8">Setup Required</span>';
      return '<tr><td>'+esc(s.serviceName)+'</td><td>'+poOpsPill(s.registrationStatus)+(s.missingRegistrations&&s.missingRegistrations.length?'<div style="margin-top:4px;color:#94a3b8">'+esc(s.missingRegistrations.join('; '))+'</div>':'')+'</td><td>'+esc(s.published?'Yes':'No')+'</td><td>'+esc(s.indexed?'Yes':'No')+'</td><td>'+esc(String(s.campaigns||0))+'</td><td>'+(dashboard.viewingPlatform==='national'?'<span style="color:#94a3b8">Platform capability — not this customer\\'s services</span>':action)+'</td></tr>';
    }).join('')+
    '</tbody></table></div>';

  html+='<div class="po-ops-section" id="poOpsCampaignOperations"><h3>4 · Campaign Operations</h3>'+poOpsCards([
    {label:'Draft',value:stages.Draft||0,onclick:"openPlatformOpsCampaignStage('Draft')",active:platformOpsStageFilter==='Draft'},
    {label:'Evidence Review',value:stages['Evidence Review']||0,onclick:"openPlatformOpsCampaignStage('Evidence Review')",active:platformOpsStageFilter==='Evidence Review'},
    {label:'Service Review',value:stages['Service Review']||0,onclick:"openPlatformOpsCampaignStage('Service Review')",active:platformOpsStageFilter==='Service Review'},
    {label:'Locality Review',value:stages['Locality Review']||0,onclick:"openPlatformOpsCampaignStage('Locality Review')",active:platformOpsStageFilter==='Locality Review'},
    {label:'Approved',value:stages.Approved||0,onclick:"openPlatformOpsCampaignStage('Approved')",active:platformOpsStageFilter==='Approved'},
    {label:'Published',value:stages.Published||0,onclick:"openPlatformOpsCampaignStage('Published')",active:platformOpsStageFilter==='Published'},
    {label:'Blocked',value:stages.Blocked||0,onclick:"openPlatformOpsCampaignStage('Blocked')",active:platformOpsStageFilter==='Blocked'}
  ])+'<div id="poOpsCampaignStageList" style="margin-top:8px">'+
    (platformOpsStageFilter?'<div style="font-size:.72rem;color:#94a3b8;margin-bottom:6px">Filtered to <strong style="color:#e2e8f0">'+esc(platformOpsStageFilter)+'</strong> · <button class="btn secondary" type="button" style="font-size:.66rem" onclick="openPlatformOpsCampaignStage(\\'\\')">Show all</button></div>':'')+
    '<div class="po-ops-links">'+(filteredItems.length?filteredItems.map(function(item){
      return '<button class="btn secondary" type="button" onclick="openPlatformOpsHref(\\''+esc(item.href)+'\\')">'+esc(item.stage)+': '+esc(item.label)+'</button>';
    }).join(''):'<span style="color:#94a3b8;font-size:.72rem">No campaigns in this stage</span>')+'</div></div></div>';

  html+='<div class="po-ops-section" id="poOpsContentStatus"><h3>5 · Content Status</h3>'+poOpsCards([
    {label:'Registered services',value:content.registeredServices||0},
    {label:'Campaigns',value:content.campaigns||0},
    {label:'Service Pages',value:content.servicePages||0},
    {label:'Locality Pages',value:content.localityPages||0},
    {label:'Approved Pages',value:content.approvedPages||0},
    {label:'Published Pages',value:content.publishedPages||0},
    {label:'Generated Images',value:content.generatedImages||0}
  ])+'</div>';

  html+='<div class="po-ops-section" id="poOpsSearchVisibility"><h3>6 · Search Visibility</h3>';
  if(!scConnected){
    html+='<div class="po-ops-sc-disconnected"><strong>Search Console not connected</strong><p>Connect Search Console to populate indexing and performance metrics. No fabricated metrics are shown.</p><div class="po-ops-links"><a class="btn" href="'+esc(search.connectUrl||'/api/gsc/auth/start')+'" style="text-decoration:none">Connect Search Console</a><button class="btn secondary" type="button" onclick="openPlatformOpsSearchVisibility()">Open Search Visibility</button></div></div>';
  }else{
    html+=poOpsCards([
      {label:'Indexed Pages',value:search.indexedPages??0},
      {label:'Not Indexed',value:search.notIndexed??0},
      {label:'Submitted',value:search.submitted??0},
      {label:'Impressions',value:search.impressions??'—'},
      {label:'Clicks',value:search.clicks??'—'},
      {label:'CTR',value:search.ctr??'—'},
      {label:'Average Position',value:search.averagePosition??'—'},
      {label:'Pending Requests',value:search.pendingRequests??0}
    ])+'<div class="po-ops-links" style="margin-top:8px"><button class="btn secondary" type="button" onclick="openPlatformOpsSearchVisibility()">Open Search Visibility</button></div>';
  }
  html+='</div>';

  html+='<div class="po-ops-section" id="poOpsPlatformHealth"><h3>7 · Platform Health</h3><table class="po-ops-table"><thead><tr><th>Area</th><th>Status</th></tr></thead><tbody>'+
    Object.keys(health).map(function(k){return '<tr><td>'+esc(k)+'</td><td>'+poOpsPill(health[k])+'</td></tr>';}).join('')+
    '</tbody></table></div>';

  html+='<div class="po-ops-section" id="poOpsPolishBacklog"><h3>8 · RC1 Polish Backlog</h3><ul style="margin:0;padding-left:18px;font-size:.78rem;color:#cbd5e1">'+
    polish.map(function(item){return '<li style="margin:4px 0">'+esc(item)+'</li>';}).join('')+
    '</ul></div>';

  html+='<div class="po-ops-section" id="poOpsReleaseReadiness"><h3>9 · Release Readiness</h3><table class="po-ops-table"><thead><tr><th>Service</th><th>Registration</th><th>Campaign</th><th>Service Page</th><th>Localities</th><th>Approved</th><th>Published</th><th>Indexed</th><th></th></tr></thead><tbody>'+
    release.map(function(r){
      const btn=r.href?'<button class="btn secondary" type="button" style="font-size:.68rem" onclick="openPlatformOpsHref(\\''+esc(r.href)+'\\')">Open</button>':'';
      return '<tr><td>'+esc(r.service)+'</td><td>'+poOpsPill(r.registration)+'</td><td>'+esc(r.campaign)+'</td><td>'+esc(r.servicePage)+'</td><td>'+esc(r.localities)+'</td><td>'+esc(r.approved)+'</td><td>'+esc(r.published)+'</td><td>'+esc(r.indexed)+'</td><td>'+btn+'</td></tr>';
    }).join('')+
    '</tbody></table></div>';

  el.innerHTML=html;
  bindPlatformOpsCapabilityNav();
}

async function loadPlatformOperations(){
  const el=document.getElementById('platformOpsBody');
  if(!el)return;
  try{
    const slug=activeCustomer&&activeCustomer.slug?encodeURIComponent(activeCustomer.slug):'';
    const data=await api('/api/master-admin-platform/platform-operations'+(slug?('?slug='+slug):''),{timeoutMs:45000});
    renderPlatformOperations(data.dashboard);
  }catch(e){
    el.innerHTML='<div class="empty">Platform operations unavailable — '+esc(e&&e.message?e.message:String(e))+'</div>';
  }
}

async function loadDashboard(){
  const loadStarted=Date.now();
  try{
    const data=await api('/api/master-admin-platform/dashboard',{timeoutMs:30000});
    customers=data.customers||[];
    workflowStages=data.workflowStages||[];
    workflowStageCounts=data.workflowStageCounts||{};
    document.getElementById('statTotal').textContent=data.totalCustomers??'—';
    document.getElementById('statActive').textContent=data.activeCustomers??'—';
    document.getElementById('statSuspended').textContent=data.suspendedCustomers??'—';
    document.getElementById('statArchived').textContent=data.archivedCustomers??'—';
    renderWorkflowOverview();
    renderCustomerTable();
    renderHealth(data.systemHealth);
    renderJobs(data.jobs);
    renderActivity(data.recentActivity);
    void loadPlatformOperations();
    const t=data.timings||{};
    document.getElementById('loadMs').textContent='Loaded in '+Math.round(t.totalMs||Date.now()-loadStarted)+'ms';
    startJobPolling();
  }catch(e){
    const msg=e&&e.message?e.message:'Dashboard load failed';
    toast('Dashboard load failed: '+msg,true);
    showCustomerTableError(msg);
    document.getElementById('workflowOverview').innerHTML='<div class="empty">Workflow unavailable — '+esc(msg)+'</div>';
    document.getElementById('healthPanel').innerHTML='<div class="empty">Health unavailable</div>';
    document.getElementById('jobsPanel').innerHTML='<div class="empty">Jobs unavailable</div>';
    document.getElementById('activityPanel').innerHTML='<div class="empty">Activity unavailable</div>';
    const ops=document.getElementById('platformOpsBody');
    if(ops)ops.innerHTML='<div class="empty">Platform operations unavailable</div>';
    document.getElementById('loadMs').textContent='Failed at '+new Date().toISOString();
  }
}

function startJobPolling(){
  if(jobPollTimer)clearInterval(jobPollTimer);
  let hadActiveForCustomer=false;
  jobPollTimer=setInterval(async()=>{
    try{
      const data=await api('/api/master-admin-platform/jobs?limit=20');
      renderJobs(data.jobs);
      const jobs=data.jobs||[];
      const active=jobs.some(j=>j.status==='queued'||j.status==='claimed'||j.status==='running');
      const mine=activeCustomer?jobs.find(j=>j.slug===activeCustomer.slug&&(j.status==='queued'||j.status==='claimed'||j.status==='running')):null;
      const jobEl=document.getElementById('detailJobStatus');
      if(activeCustomer&&mine){
        hadActiveForCustomer=true;
        if(jobEl){
          jobEl.style.display='block';
          jobEl.innerHTML='<strong>Active job</strong><br><strong class="status-'+esc(mine.status)+'">'+esc(mine.status)+'</strong> · '+esc(mine.action)+'<br>'+esc(mine.progressLabel||'Running')+' ('+esc(String(mine.progress||0))+'%)';
        }
      }
      if(activeCustomer&&hadActiveForCustomer&&!mine){
        hadActiveForCustomer=false;
        const rec=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug));
        activeCustomer=rec.customer;
        renderCustomerDetail(rec.customer);
        await loadDashboard();
        if(jobEl)jobEl.style.display='none';
        if(activeSpgDashboard&&document.getElementById('spgModal').classList.contains('open'))await openServicePageGeneration();
        else if(document.getElementById('cirModal')&&document.getElementById('cirModal').classList.contains('open'))await openCommercialIntelligenceReview();
        else if(customerAtServicePageReview(activeCustomer))openServicePageReview();
        toast((activeSpgDashboard&&document.getElementById('spgModal').classList.contains('open'))||customerAtServicePageReview(activeCustomer)?'Service page job completed':'Growth Intelligence job completed');
      }
      if(!active)clearInterval(jobPollTimer);
    }catch{}
  },3000);
}

let createIntakeAreasDraft=[];
let onboardingAreasDraft=[];
let onboardingAreaDiscoveryMeta={primaryTown:'',recommendedCount:0,selectedCount:0,localGenerationReadiness:'—',readinessWarning:''};
function selectedGooglePolicy(name){
  const el=document.querySelector('input[name="'+name+'"]:checked');
  return el?el.value:'';
}
function selectedMarketScope(name){
  const el=document.querySelector('input[name="'+name+'"]:checked');
  return el?el.value:'';
}
function syncMarketScopeUi(prefix){
  const scope=selectedMarketScope(prefix+'MarketScope')||'local_regional';
  const national=scope==='national';
  const townMark=document.getElementById(prefix+'TownRequiredMark');
  if(townMark)townMark.style.display=national?'none':'inline';
  const localCreate=document.getElementById('createLocalAreasSection');
  const nationalCreate=document.getElementById('createNationalMarketNote');
  const localIntake=document.getElementById('intakeLocalAreasBlock');
  const nationalIntake=document.getElementById('intakeNationalMarketNote');
  if(prefix==='create'){
    if(localCreate)localCreate.style.display=national?'none':'block';
    if(nationalCreate)nationalCreate.style.display=national?'block':'none';
  }
  if(prefix==='intake'){
    if(localIntake)localIntake.style.display=national?'none':'block';
    if(nationalIntake)nationalIntake.style.display=national?'block':'none';
  }
}
function renderIntakeAreasTable(tbodyId,draft,removeFn){
  const tbody=document.getElementById(tbodyId);
  if(!tbody)return;
  tbody.innerHTML=draft.map((a,i)=>'<tr><td><input type="checkbox" '+(a.selected!==false?'checked':'')+' onchange="'+removeFn.replace('remove','toggle')+'('+i+',this.checked)"/></td><td>'+esc(a.areaName)+(a.source==='operator'?' <span class="local-coverage-badge">Manual</span>':(a.recommended?' <span class="local-coverage-badge">Suggested</span>':''))+'</td><td><button class="btn secondary" type="button" style="font-size:.65rem" onclick="'+removeFn+'('+i+')">Remove</button></td></tr>').join('');
}
function toggleCreateIntakeArea(i,checked){if(createIntakeAreasDraft[i])createIntakeAreasDraft[i].selected=checked;renderIntakeAreasTable('createIntakeAreasTbody',createIntakeAreasDraft,'removeCreateIntakeArea')}
function removeCreateIntakeArea(i){createIntakeAreasDraft.splice(i,1);renderIntakeAreasTable('createIntakeAreasTbody',createIntakeAreasDraft,'removeCreateIntakeArea')}
function addCreateIntakeArea(){const n=document.getElementById('createAreaName').value.trim();if(!n){toast('Enter an area name',true);return}createIntakeAreasDraft.push({areaName:n,selected:true,source:'operator'});document.getElementById('createAreaName').value='';renderIntakeAreasTable('createIntakeAreasTbody',createIntakeAreasDraft,'removeCreateIntakeArea')}
function renderOnboardingAreaSummary(discovery){
  const d=discovery||{};
  onboardingAreaDiscoveryMeta={
    primaryTown:d.primaryTown||'',
    recommendedCount:d.recommendedCount||0,
    selectedCount:d.selectedCount||0,
    localGenerationReadiness:d.localGenerationReadiness||'—',
    readinessWarning:d.readinessWarning||''
  };
  onboardingAreasDraft=(d.areas||[]).map(a=>({...a}));
  const townEl=document.getElementById('intakeAreaDiscoveryTown');
  if(townEl)townEl.textContent='Town or City: '+(d.primaryTown||'—');
  const recEl=document.getElementById('intakeAreaDiscoveryRecommended');
  if(recEl)recEl.textContent=String(d.recommendedCount||0);
  const selEl=document.getElementById('intakeAreaDiscoverySelected');
  if(selEl)selEl.textContent=String(d.selectedCount||0);
  const readyEl=document.getElementById('intakeAreaDiscoveryReadiness');
  if(readyEl)readyEl.textContent=(d.localGenerationReadiness||'—')+(d.readinessWarning?(' · '+d.readinessWarning):'');
}
function setOnboardingAreasReviewView(state){
  const loading=document.getElementById('onboardingAreasReviewLoading');
  const content=document.getElementById('onboardingAreasReviewContent');
  if(loading)loading.style.display=state==='loading'?'block':'none';
  if(content)content.style.display=state==='ready'?'block':'none';
}
function renderOnboardingAreasReviewTable(){
  const tbody=document.getElementById('onboardingAreasReviewTbody');
  if(!tbody)return;
  const q=String(document.getElementById('onboardingAreasFilter')?.value||'').trim().toLowerCase();
  const rows=onboardingAreasDraft.filter(a=>!q||String(a.areaName||'').toLowerCase().includes(q));
  tbody.innerHTML=rows.map(a=>{
    const idx=onboardingAreasDraft.indexOf(a);
    return '<tr><td><input type="checkbox" '+(a.selected?'checked':'')+' onchange="toggleOnboardingArea('+idx+',this.checked)"/></td><td>'+esc(a.areaName)+(a.recommended?' <span class="local-coverage-badge">Recommended</span>':'')+'</td><td>'+esc(a.type||'—')+'</td><td>'+esc(a.source||'—')+'</td><td>'+esc(String(a.confidence||'—'))+'</td><td>'+esc(a.distanceLabel||'—')+'</td><td>'+(a.generationEligible?'Yes':'No')+'</td></tr>';
  }).join('');
  const meta=document.getElementById('onboardingAreasReviewMeta');
  if(meta){
    const selected=onboardingAreasDraft.filter(a=>a.selected).length;
    meta.textContent='Selected '+selected+' of '+onboardingAreasDraft.length+' · Recommended '+onboardingAreasDraft.filter(a=>a.recommended).length+' · Minimum for local generation: 3';
  }
}
async function openOnboardingAreasReviewModal(){
  const slug=resolveActiveCustomerSlug();
  if(!slug){toast('Open a customer first',true);return}
  document.getElementById('onboardingAreasReviewModal').classList.add('open');
  setOnboardingAreasReviewView('loading');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-area-discovery');
    renderOnboardingAreaSummary(data.discovery||{});
    renderOnboardingAreasReviewTable();
    setOnboardingAreasReviewView('ready');
  }catch(e){
    setOnboardingAreasReviewView('ready');
    closeOnboardingAreasReviewModal();
    toast(e.message,true);
  }
}
function closeOnboardingAreasReviewModal(){
  document.getElementById('onboardingAreasReviewModal').classList.remove('open');
  setOnboardingAreasReviewView('ready');
}
function toggleOnboardingArea(i,checked){
  if(onboardingAreasDraft[i]){
    onboardingAreasDraft[i].selected=checked;
    onboardingAreasDraft[i].generationEligible=checked;
  }
  renderOnboardingAreasReviewTable();
  renderOnboardingAreaSummary({...onboardingAreaDiscoveryMeta,areas:onboardingAreasDraft,selectedCount:onboardingAreasDraft.filter(a=>a.selected).length,recommendedCount:onboardingAreasDraft.filter(a=>a.recommended).length});
}
function selectAllRecommendedOnboardingAreas(){
  onboardingAreasDraft.forEach(a=>{if(a.recommended){a.selected=true;a.generationEligible=true}});
  renderOnboardingAreasReviewTable();
  renderOnboardingAreaSummary({...onboardingAreaDiscoveryMeta,areas:onboardingAreasDraft,selectedCount:onboardingAreasDraft.filter(a=>a.selected).length,recommendedCount:onboardingAreasDraft.filter(a=>a.recommended).length});
}
function clearOnboardingAreaSelection(){
  onboardingAreasDraft.forEach(a=>{a.selected=false;a.generationEligible=false});
  renderOnboardingAreasReviewTable();
  renderOnboardingAreaSummary({...onboardingAreaDiscoveryMeta,areas:onboardingAreasDraft,selectedCount:0,recommendedCount:onboardingAreasDraft.filter(a=>a.recommended).length});
}
function addCustomOnboardingArea(){
  const n=document.getElementById('onboardingCustomAreaName')?.value?.trim();
  if(!n){toast('Enter a custom area name',true);return}
  if(onboardingAreasDraft.some(a=>String(a.areaName||'').toLowerCase()===n.toLowerCase())){toast('Area already listed',true);return}
  onboardingAreasDraft.push({areaName:n,selected:true,recommended:false,type:'service area',source:'operator',confidence:100,distanceLabel:'Distance unavailable',generationEligible:true});
  document.getElementById('onboardingCustomAreaName').value='';
  renderOnboardingAreasReviewTable();
  renderOnboardingAreaSummary({...onboardingAreaDiscoveryMeta,areas:onboardingAreasDraft,selectedCount:onboardingAreasDraft.filter(a=>a.selected).length,recommendedCount:onboardingAreasDraft.filter(a=>a.recommended).length});
}
async function refreshOnboardingAreaSuggestions(){
  const slug=resolveActiveCustomerSlug();
  if(!slug)return;
  setOnboardingAreasReviewView('loading');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-area-discovery/refresh',{method:'POST',body:'{}'});
    renderOnboardingAreaSummary(data.discovery||{});
    renderOnboardingAreasReviewTable();
    setOnboardingAreasReviewView('ready');
    toast('Area suggestions refreshed');
  }catch(e){
    setOnboardingAreasReviewView('ready');
    toast(e.message,true);
  }
}
async function saveOnboardingAreasReview(){
  const slug=resolveActiveCustomerSlug();
  if(!slug)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-area-discovery/save',{method:'POST',body:JSON.stringify({primaryTown:onboardingAreaDiscoveryMeta.primaryTown||document.getElementById('intakeTown')?.value?.trim(),areas:onboardingAreasDraft.map(a=>({areaName:a.areaName,selected:a.selected,source:a.source})),manualAreas:onboardingAreasDraft.filter(a=>a.source==='operator').map(a=>a.areaName)})});
    renderOnboardingAreaSummary(data.discovery||{});
    toast('Local areas saved');
    closeOnboardingAreasReviewModal();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
function buildIntakeBodyFromCreate(){
  const googlePolicy=selectedGooglePolicy('createGooglePolicy');
  const marketScope=selectedMarketScope('createMarketScope')||'local_regional';
  return {pharmacyName:document.getElementById('createName').value.trim(),website:document.getElementById('createWebsite').value.trim(),contactEmail:document.getElementById('createEmail').value.trim(),phone:document.getElementById('createPhone').value.trim(),postcode:document.getElementById('createPostcode').value.trim(),addressLine1:document.getElementById('createAddress1').value.trim(),addressLine2:document.getElementById('createAddress2').value.trim(),townOrCity:document.getElementById('createTown').value.trim(),county:document.getElementById('createCounty').value.trim(),country:document.getElementById('createCountry').value.trim(),primaryServiceId:document.getElementById('createPrimaryService').value, googleBusinessProfileUrl:document.getElementById('createGoogle').value.trim(),googlePlaceId:document.getElementById('createPlaceId').value.trim(),googleProfileState:googlePolicy||'unknown',marketScope:marketScope,primaryMarket:marketScope==='national'?(document.getElementById('createCountry').value.trim()||'United Kingdom'):'',accountManager:document.getElementById('createAccountManager').value.trim(),supportContactName:document.getElementById('createSupportName').value.trim(),supportContactEmail:document.getElementById('createSupportEmail').value.trim(),notes:document.getElementById('createNotes').value.trim(),areas:marketScope==='national'?[]:createIntakeAreasDraft};
}
function resetCreateCustomerForm(){
  const ids=['createName','createWebsite','createAddress1','createAddress2','createTown','createPostcode','createCounty','createEmail','createPhone','createGoogle','createPlaceId','createAccountManager','createSupportName','createSupportEmail','createNotes','createAreaName'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  const country=document.getElementById('createCountry');if(country)country.value='United Kingdom';
  const svc=document.getElementById('createPrimaryService');if(svc)svc.selectedIndex=0;
  document.querySelectorAll('input[name="createGooglePolicy"]').forEach(r=>{r.checked=false});
  document.querySelectorAll('input[name="createMarketScope"]').forEach(r=>{r.checked=r.value==='local_regional'});
  syncMarketScopeUi('create');
  const preview=document.getElementById('createPreviewUsername');if(preview)preview.textContent='Generated from business name after submit';
  createIntakeAreasDraft=[];renderIntakeAreasTable('createIntakeAreasTbody',createIntakeAreasDraft,'removeCreateIntakeArea');
}
function openCreateModal(){resetCreateCustomerForm();document.getElementById('createModal').classList.add('open')}
function closeCreateModal(){document.getElementById('createModal').classList.remove('open')}
async function createCustomer(){
  try{
    const body=buildIntakeBodyFromCreate();
    if(!body.pharmacyName||!body.website||!body.contactEmail||!body.addressLine1||!body.postcode||!body.country){toast('Complete all required business and location fields',true);return}
    if(!body.marketScope){toast('Choose a Market Scope',true);return}
    if(body.marketScope!=='national'&&!body.townOrCity){toast('Town or City is required for Local / Regional market scope',true);return}
    if(!body.googleProfileState||body.googleProfileState==='unknown'){toast('Choose a Google Business Profile option',true);return}
    const data=await api('/api/master-admin-platform/customers',{method:'POST',body:JSON.stringify(body)});
    toast('Customer created — automated source imports started');
    if(data.temporaryPassword){toast('Temporary password issued — visible in Customer Account panel',false);document.getElementById('createPreviewUsername').textContent=data.username||''}
    closeCreateModal();await loadDashboard();
    if(data.slug){if(data.customer){data.customer.pendingPassword=data.temporaryPassword;openCustomer(data.slug);activeCustomer=data.customer;renderCustomerDetail(data.customer)}else openCustomer(data.slug);startJobPolling()}
  }catch(e){toast(e.message,true)}
}
function resolveActiveCustomerSlug(){
  if(activeCustomer&&activeCustomer.slug)return activeCustomer.slug;
  const urlSlug=new URLSearchParams(location.search).get('customer');
  if(urlSlug)return urlSlug.trim();
  return '';
}
function setOnboardingIntakeView(state){
  const loading=document.getElementById('onboardingIntakeLoading');
  const content=document.getElementById('onboardingIntakeContent');
  if(loading)loading.style.display=state==='loading'?'block':'none';
  if(content)content.style.display=state==='ready'?'block':'none';
}
async function openOnboardingIntakeModal(){
  const slug=resolveActiveCustomerSlug();
  if(!slug){toast('Open a customer first',true);return}
  document.getElementById('onboardingIntakeModal').classList.add('open');
  setOnboardingIntakeView('loading');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-intake');
    const i=data.intake||{};
    document.getElementById('intakeName').value=i.pharmacyName||'';
    document.getElementById('intakeWebsite').value=i.website||'';
    document.getElementById('intakeAddress1').value=i.addressLine1||'';
    document.getElementById('intakeAddress2').value=i.addressLine2||'';
    document.getElementById('intakeTown').value=i.townOrCity||'';
    document.getElementById('intakePostcode').value=i.postcode||'';
    document.getElementById('intakeCounty').value=i.county||'';
    document.getElementById('intakeCountry').value=i.country||'United Kingdom';
    document.getElementById('intakePrimaryService').value=i.primaryServiceId||'';
    document.getElementById('intakeEmail').value=i.contactEmail||'';
    document.getElementById('intakePhone').value=i.phone||'';
    document.getElementById('intakeGoogle').value=i.googleBusinessProfileUrl||'';
    document.getElementById('intakePlaceId').value=i.googlePlaceId||'';
    const gs=i.googleProfileState||i.googleState||'unknown';
    document.querySelectorAll('input[name="intakeGooglePolicy"]').forEach(r=>{r.checked=r.value===gs});
    const ms=i.marketScope||'local_regional';
    document.querySelectorAll('input[name="intakeMarketScope"]').forEach(r=>{r.checked=r.value===ms});
    const hint=document.getElementById('intakePrimaryMarketHint');
    if(hint)hint.textContent=ms==='national'?('Primary market: '+(i.primaryMarket||i.country||'United Kingdom')+' — local areas are not required for campaign strategy.'):'Local / Regional market — Town / City and local areas drive locality campaign strategy.';
    syncMarketScopeUi('intake');
    renderOnboardingAreaSummary(i.areaDiscovery||{areas:i.areas||[],primaryTown:i.townOrCity||'',recommendedCount:0,selectedCount:(i.areas||[]).filter(a=>a.selected!==false).length});
    setOnboardingIntakeView('ready');
  }catch(e){
    setOnboardingIntakeView('ready');
    closeOnboardingIntakeModal();
    toast(e.message,true);
  }
}
function closeOnboardingIntakeModal(){
  document.getElementById('onboardingIntakeModal').classList.remove('open');
  setOnboardingIntakeView('ready');
}
async function saveOnboardingIntake(){
  const slug=resolveActiveCustomerSlug();
  if(!slug){toast('Open a customer first',true);return}
  try{
    const marketScope=selectedMarketScope('intakeMarketScope')||'local_regional';
    const country=document.getElementById('intakeCountry').value.trim();
    const body={pharmacyName:document.getElementById('intakeName').value.trim(),website:document.getElementById('intakeWebsite').value.trim(),contactEmail:document.getElementById('intakeEmail').value.trim(),phone:document.getElementById('intakePhone').value.trim(),postcode:document.getElementById('intakePostcode').value.trim(),addressLine1:document.getElementById('intakeAddress1').value.trim(),addressLine2:document.getElementById('intakeAddress2').value.trim(),townOrCity:document.getElementById('intakeTown').value.trim(),county:document.getElementById('intakeCounty').value.trim(),country:country,primaryServiceId:document.getElementById('intakePrimaryService').value,googleBusinessProfileUrl:document.getElementById('intakeGoogle').value.trim(),googlePlaceId:document.getElementById('intakePlaceId').value.trim(),googleProfileState:selectedGooglePolicy('intakeGooglePolicy')||'unknown',marketScope:marketScope,primaryMarket:marketScope==='national'?(country||'United Kingdom'):''};
    if(marketScope!=='national'&&!body.townOrCity){toast('Town or City is required for Local / Regional market scope',true);return}
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-intake',{method:'POST',body:JSON.stringify(body)});
    toast('Onboarding setup saved — workflow recalculated');
    closeOnboardingIntakeModal();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    try{
      const discovery=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-area-discovery');
      renderOnboardingAreaSummary(discovery.discovery||{});
    }catch{}
  }catch(e){toast(e.message,true)}
}
function closeCustomerModal(){
  if(activeCustomer&&activeCustomer.slug&&activeCustomer.selectedCampaignId){
    api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/clear-campaign',{method:'POST',body:JSON.stringify({})}).catch(function(){});
  }
  document.getElementById('customerModal').classList.remove('open');
  activeCustomer=null;
  workflowNavStack.length=0;
  clearWorkflowPanelUrlParam();
  const p=new URLSearchParams(location.search);p.delete('customer');p.delete('campaignId');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''));
}
async function openCustomer(slug,options){
  options=options||{};
  if(customerDetailAbortController)customerDetailAbortController.abort();
  customerDetailAbortController=new AbortController();
  const loadSeq=++customerDetailLoadSeq;
  document.getElementById('customerModal').classList.add('open');
  document.getElementById('detailLoading').style.display='block';
  document.getElementById('detailContent').style.display='none';
  document.getElementById('detailError').style.display='none';
  document.getElementById('detailTitle').textContent=slug;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug),{timeoutMs:30000,signal:customerDetailAbortController.signal});
    if(loadSeq!==customerDetailLoadSeq)return;
    activeCustomer=data.customer;
    const listRow=customers.find(x=>x.slug===slug);
    if(listRow){
      activeCustomer.platformStatus=listRow.platformStatus||activeCustomer.platformStatus;
      activeCustomer.searchConsoleLabel=listRow.searchConsoleLabel||activeCustomer.searchConsoleLabel;
      activeCustomer.generationStatus=listRow.generationStatus||activeCustomer.generationStatus;
      activeCustomer.publishingStatus=listRow.publishingStatus||activeCustomer.publishingStatus;
      activeCustomer.searchConsoleMetrics=listRow.searchConsoleMetrics||activeCustomer.searchConsoleMetrics;
    }
    if(data.workflowSummary)activeCustomer.workflowSummary=data.workflowSummary;
    const urlCampaignId=options.campaignId||new URLSearchParams(location.search).get('campaignId')||'';
    if(urlCampaignId&&(!activeCustomer.selectedCampaignId||activeCustomer.selectedCampaignId!==urlCampaignId)){
      try{
        const sel=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/select-campaign',{method:'POST',body:JSON.stringify({campaignId:urlCampaignId})});
        if(sel.customer)activeCustomer=sel.customer;
        if(sel.workflowSummary&&activeCustomer)activeCustomer.workflowSummary=sel.workflowSummary;
      }catch(_e){/* list still renders */}
    }
    setCustomerCampaignUrl(slug,activeCustomer.selectedCampaignId||null);
    renderCustomerDetail(activeCustomer);
    void loadPlatformOperations();
    document.getElementById('detailLoading').style.display='none';
    document.getElementById('detailContent').style.display='block';
    if(options.openSelectedCampaignPanel&&activeCustomer.selectedServiceCampaign){
      await runSelectedCampaignNextAction(activeCustomer.selectedServiceCampaign,false);
    }
  }catch(e){
    if(e&&e.name==='AbortError')return;
    document.getElementById('detailLoading').style.display='none';
    document.getElementById('detailContent').style.display='none';
    document.getElementById('detailError').style.display='block';
    document.getElementById('detailErrorDetail').textContent=e.message||String(e);
    document.getElementById('detailErrorTimestamp').textContent=new Date().toISOString();
    toast(e.message||String(e),true);
  }
}
/**
 * CPR-PRODUCT-OWNER-CAMPAIGN-UI-01 — two content levels inside the same campaign.
 * Uses campaign-scoped content presentation + existing workflow action handlers.
 */
function renderProductOwnerCampaignContentStructure(camp,opts){
  opts=opts||{};
  const style=opts.style||'font-size:.72rem';
  if(!camp)return '';
  const cid=esc(camp.campaignId||'');
  const content=camp.content||{};
  const preview=String(camp.previewUrl||'').trim();
  const serviceStatus=String(content.serviceStatus||(camp.serviceGenerated?'Generated':'Not Generated'));
  const localityStatus=String(content.localityStatus||(camp.localitiesGenerated?'Generated':'Not Generated'));
  const serviceRevision=content.serviceRevision?String(content.serviceRevision):'';
  const generatedCount=Number(content.localityGeneratedCount||0);
  const approvedCount=Number(content.localityApprovedCount||0);
  const remainingCount=Number(content.localityRemainingCount||Math.max(0,generatedCount-approvedCount));
  const serviceApproved=Boolean(content.serviceApproved)||serviceStatus==='Approved';
  const serviceGenerated=Boolean(camp.serviceGenerated)||serviceStatus==='Generated'||serviceStatus==='Approved';
  const localitiesGenerated=Boolean(camp.localitiesGenerated)||generatedCount>0;

  const serviceActions=[];
  if(!serviceGenerated){
    serviceActions.push('<button class="btn" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'generate-service\\')">Generate Service Page</button>');
  }else{
    if(preview){
      serviceActions.push('<a class="btn secondary campaign-open-service-preview" href="'+esc(withAuthHandoff(preview))+'" target="_blank" rel="noopener" style="'+style+';text-align:center;display:inline-block">Open Service Preview</a>');
    }
    serviceActions.push('<button class="btn secondary" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'regenerate-service\\')">Regenerate Service Page</button>');
    if(serviceApproved){
      serviceActions.push('<div style="font-size:.72rem;color:#4ade80;font-weight:700">Approved</div>');
    }else{
      serviceActions.push('<button class="btn" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'approve-service\\')">Approve Service Page</button>');
    }
  }

  const localityActions=[];
  if(!serviceGenerated){
    localityActions.push('<div style="font-size:.7rem;color:#64748b">Generate the service page before locality pages.</div>');
  }else if(!localitiesGenerated){
    localityActions.push('<button class="btn secondary" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'generate-locality\\')">Generate Locality Pages</button>');
  }else{
    localityActions.push('<button class="btn secondary" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'review-locality\\')">Review Locality Pages</button>');
    if(remainingCount>0){
      localityActions.push('<button class="btn secondary" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'review-locality\\')">Regenerate Individual Page</button>');
      localityActions.push('<button class="btn secondary" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'regenerate-all-locality\\')">Regenerate All Locality Pages</button>');
      if(remainingCount>=2){
        localityActions.push('<button class="btn" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'approve-remaining-locality\\')">Approve All Remaining Locality Pages ('+remainingCount+')</button>');
      }
    }
  }

  const publishing=content.publishing||{};
  const publishReady=Boolean(publishing.ready);
  const publishLabel=String(publishing.label||(publishReady?'Ready to Publish':'Not Ready to Publish'));
  const publishBlockers=Array.isArray(publishing.blockers)?publishing.blockers:[];
  const publishActions=[];
  if(publishReady){
    publishActions.push('<div style="font-size:.78rem;color:#4ade80;font-weight:800">'+esc(publishLabel)+'</div>');
    publishActions.push('<button class="btn" type="button" style="'+style+'" onclick="poWorkflowAction(\\''+cid+'\\',\\'publish-campaign\\')">Publish Campaign</button>');
  }else if(publishLabel==='Published'){
    publishActions.push('<div style="font-size:.78rem;color:#4ade80;font-weight:800">Published</div>');
  }else{
    publishActions.push('<div style="font-size:.78rem;color:#f87171;font-weight:800">'+esc(publishLabel)+'</div>');
    if(publishBlockers.length){
      publishActions.push('<ul style="margin:6px 0 0 16px;padding:0;font-size:.7rem;color:#fca5a5">'+publishBlockers.map(function(b){return '<li>'+esc(String(b))+'</li>';}).join('')+'</ul>');
    }else{
      publishActions.push('<div style="font-size:.7rem;color:#fca5a5;margin-top:4px">Publishing readiness blocked.</div>');
    }
    publishActions.push('<button class="btn secondary" type="button" style="'+style+'" disabled>Publish Campaign</button>');
  }

  return ''+
    '<div class="po-content-level" data-content-level="service-page" style="margin-top:10px;padding:10px;border:1px solid #334155;border-radius:8px;background:#0b1220">'+
      '<div style="font-weight:800;font-size:.78rem;margin-bottom:6px">SERVICE PAGE</div>'+
      '<div style="font-size:.72rem;color:#cbd5e1"><strong>Status:</strong> '+esc(serviceStatus)+'</div>'+
      (serviceRevision?'<div style="font-size:.72rem;color:#94a3b8;margin-top:2px"><strong>Revision:</strong> '+esc(serviceRevision)+'</div>':'')+
      '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">'+serviceActions.join('')+'</div>'+
    '</div>'+
    '<div class="po-content-level" data-content-level="locality-pages" style="margin-top:10px;padding:10px;border:1px solid #334155;border-radius:8px;background:#0b1220">'+
      '<div style="font-weight:800;font-size:.78rem;margin-bottom:6px">LOCALITY PAGES</div>'+
      '<div style="font-size:.72rem;color:#cbd5e1"><strong>Status:</strong> '+esc(localityStatus)+'</div>'+
      '<div style="font-size:.72rem;color:#94a3b8;margin-top:4px">Generated: '+esc(String(generatedCount))+' · Approved: '+esc(String(approvedCount))+' · Remaining: '+esc(String(remainingCount))+'</div>'+
      '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">'+localityActions.join('')+'</div>'+
    '</div>'+
    '<div class="po-content-level" data-content-level="publishing" style="margin-top:10px;padding:10px;border:1px solid #334155;border-radius:8px;background:#0b1220">'+
      '<div style="font-weight:800;font-size:.78rem;margin-bottom:6px">PUBLISHING</div>'+
      '<div style="font-size:.72rem;color:#cbd5e1"><strong>Status:</strong> '+esc(publishLabel)+'</div>'+
      '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">'+publishActions.join('')+'</div>'+
    '</div>';
}
function renderProductOwnerWorkflowActions(camp,opts){
  return renderProductOwnerCampaignContentStructure(camp,opts);
}
/**
 * CPR-WORKFLOW-GENERATION-EXECUTE-01 — handoff only.
 * Generate Service Page must invoke the existing /service-page-generation/confirm endpoint
 * (same canonical queue path as regenerate), not stop after opening the generation screen.
 */
async function executeProductOwnerServicePageGeneration(){
  if(!activeCustomer||spgGenerationInFlight)return;
  const camp=selectedCampaignRef();
  const label=(camp&&camp.serviceName)||'service';
  if(!window.confirm('Generate the '+label+' service page now? This queues exactly one generation job and does not publish.'))return;
  await openServicePageGeneration();
  if(!activeSpgDashboard){
    toast('Service page generation is not ready.',true);
    return;
  }
  if(activeSpgDashboard.servicePageGenerated){
    toast('Service page already generated — use Regenerate Service Page.',true);
    return;
  }
  if(!activeSpgDashboard.canGenerate){
    toast((activeSpgDashboard.blockers&&activeSpgDashboard.blockers[0])||'Service page generation is blocked.',true);
    return;
  }
  const box=document.getElementById('spgConfirmCheckbox');
  if(box){box.disabled=false;box.checked=true;}
  await confirmSpgGenerationClick();
}
async function poWorkflowAction(campaignId,action){
  if(!activeCustomer||!campaignId)return;
  try{
    activeSpeReview=null;
    activeSpgDashboard=null;
    ['speModal','spgModal','cprClusterReviewModal','campaignLocalityModal'].forEach(function(id){const el=document.getElementById(id);if(el)el.classList.remove('open');});
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/select-campaign',{method:'POST',body:JSON.stringify({campaignId:campaignId})});
    if(data.customer)activeCustomer=data.customer;
    if(data.workflowSummary&&activeCustomer)activeCustomer.workflowSummary=data.workflowSummary;
    setCustomerCampaignUrl(activeCustomer.slug,campaignId);
    renderCustomerDetail(activeCustomer);
    if(action==='evidence')await openServicePageEvidenceReview();
    else if(action==='generate-service')await executeProductOwnerServicePageGeneration();
    else if(action==='regenerate-service')await regenerateSelectedServicePage();
    else if(action==='approve-service')await openServicePageReview();
    else if(action==='generate-locality')await generateCampaignLocalityPages();
    else if(action==='review-locality')await openClusterPageReview();
    else if(action==='approve-remaining-locality')await openClusterPageReview();
    else if(action==='regenerate-all-locality')await regenerateAllCampaignLocalityPages();
    else if(action==='publish-campaign'){
      const published=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/campaigns/'+encodeURIComponent(campaignId)+'/canonical-publish',{method:'POST',body:'{}'});
      if(!published.ok)throw new Error((published.blockers||[]).join('; ')||published.error||'Publish blocked');
      const refreshed=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug));
      if(refreshed.customer){activeCustomer=refreshed.customer;renderCustomerDetail(activeCustomer);}
      toast(published.idempotent?'Campaign revision is already published':'Campaign published');
    }
  }catch(e){toast(e.message||String(e),true)}
}
function renderServiceCampaignsPanel(c){
  const list=document.getElementById('detailServiceCampaignsList');
  const selectedPanel=document.getElementById('detailSelectedCampaignPanel');
  const collapse=document.getElementById('detailServiceCampaignsCollapse');
  if(!list)return;
  const campaigns=c.serviceCampaigns||[];
  if(collapse)collapse.open=true;
  const createPanel=document.getElementById('detailCreateCampaignPanel');
  const tenantBox=document.getElementById('detailTenantCommercialServices');
  const national=c.growthPlatform==='national'||isNationalMarketCustomer(c);
  const catalogue=(c.tenantServiceCatalogue&&c.tenantServiceCatalogue.services)||[];
  if(tenantBox){
    if(national){
      tenantBox.style.display='block';
      tenantBox.innerHTML='<div style="font-weight:800;font-size:.88rem;margin-bottom:8px">This customer\\'s commercial services</div>'+
        '<p style="font-size:.72rem;color:#94a3b8;margin:0 0 8px">Digital-growth services from project configuration. The locked pharmacy patient-service catalogue is a platform generation capability, not this customer\\'s own services.</p>'+
        (catalogue.length
          ? catalogue.map(function(s){return '<div style="font-size:.78rem;margin:4px 0"><strong>'+esc(s.serviceName)+'</strong> <span style="color:#94a3b8">'+esc(s.serviceId)+'</span></div>';}).join('')
          : '<div class="empty">No project commercial services configured.</div>');
    }else{
      tenantBox.style.display='none';
      tenantBox.innerHTML='';
    }
  }
  const select=document.getElementById('createCampaignServiceSelect');
  const createBtn=document.getElementById('createCampaignBtn');
  const createMsg=document.getElementById('createCampaignMsg');
  if(createPanel)createPanel.style.display='block';
  if(select){
    if(!select.dataset.lockedOptions)select.dataset.lockedOptions=select.innerHTML;
    if(national){
      select.innerHTML='<option value="">Select a service…</option>'+(catalogue.map(function(s){
        return '<option value="'+esc(s.serviceId)+'">'+esc(s.serviceName)+'</option>';
      }).join(''));
      select.disabled=true;
      select.dataset.platform='national';
    }else{
      if(select.dataset.platform==='national')select.innerHTML=select.dataset.lockedOptions;
      select.disabled=false;
      select.dataset.platform='local';
    }
  }
  if(national){
    if(createBtn){createBtn.disabled=true;createBtn.textContent='Generation not implemented';}
    if(createMsg){createMsg.style.color='#94a3b8';createMsg.textContent='National commercial content generation is not implemented. Patient-service Campaign Builder is not used for this customer.';}
  }else{
    if(createBtn){createBtn.disabled=false;createBtn.textContent='Create';}
    if(createMsg&&createMsg.textContent&&/National commercial/.test(createMsg.textContent))createMsg.textContent='';
  }
  if(!campaigns.length){
    list.innerHTML=national
      ? '<div class="empty">No patient-service campaigns for this national customer — that is expected. Strategy lives on the Growth Plan.</div>'
      : '<div class="empty">No service campaigns yet. Use Create Campaign above to start Service Evidence for a locked commercial service.</div>';
    if(selectedPanel)selectedPanel.style.display='none';
    return;
  }
  list.innerHTML=campaigns.map(function(camp){
    const selected=Boolean(camp.selected||(c.selectedCampaignId&&c.selectedCampaignId===camp.campaignId));
    const workflowActions=renderProductOwnerWorkflowActions(camp,{style:'width:auto;min-width:140px;font-size:.72rem'});
    return '<div class="service-campaign-card" data-service-id="'+esc(camp.serviceId||'')+'" data-campaign-id="'+esc(camp.campaignId||'')+'" style="border:1px solid '+(selected?'#38bdf8':'#334155')+';border-radius:10px;padding:12px;margin-bottom:10px;background:'+(selected?'#0c1a2e':'#0f172a')+'">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">'+
      '<div><div style="font-weight:800;font-size:.88rem">'+esc(camp.serviceName)+'</div>'+
      '<div style="font-size:.72rem;color:#94a3b8;margin-top:2px">'+esc(camp.statusLabel||camp.status)+' · '+esc(camp.currentStage)+'</div>'+
      '<div style="font-size:.72rem;color:#cbd5e1;margin-top:6px">'+esc(camp.servicePageStatus)+'</div>'+
      '<div style="font-size:.72rem;color:#cbd5e1">'+esc(camp.localPageStatus)+'</div>'+
      '<div style="font-size:.72rem;color:#7dd3fc;margin-top:6px"><strong>Next:</strong> '+esc(camp.nextAction)+'</div></div>'+
      '<div style="display:flex;flex-direction:column;gap:6px;min-width:140px">'+
      '<button class="btn" type="button" style="width:auto;min-width:140px;font-size:.72rem" data-campaign-id="'+esc(camp.campaignId)+'" onclick="openServiceCampaign(this.dataset.campaignId)">Open Campaign</button>'+
      workflowActions+
      '</div></div></div>';
  }).join('');
  const selected=c.selectedServiceCampaign||campaigns.find(function(x){return x.selected||x.campaignId===c.selectedCampaignId;})||null;
  if(selectedPanel){
    if(selected){
      selectedPanel.style.display='block';
      const workflowActions=renderProductOwnerWorkflowActions(selected,{style:'font-size:.72rem'});
      selectedPanel.innerHTML=
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">'+
        '<div><div style="font-weight:800;font-size:.9rem">Selected campaign: '+esc(selected.serviceName)+'</div>'+
        '<div style="font-size:.72rem;color:#94a3b8;margin-top:4px">'+esc(selected.statusLabel)+' · Stage: '+esc(selected.currentStage)+'</div>'+
        '<div style="font-size:.78rem;color:#7dd3fc;margin-top:8px"><strong>Next action:</strong> '+esc(selected.nextAction)+'</div>'+
        '<div style="font-size:.72rem;color:#94a3b8;margin-top:8px">Product Owner workflow — generation runs only after an explicit click.</div></div>'+
        '<div style="display:flex;flex-direction:column;gap:6px;min-width:180px" id="detailSelectedPoWorkflowActions">'+
        workflowActions+
        '<button class="btn secondary" type="button" style="font-size:.72rem" onclick="workflowNavBackToPharmacy()">Back to Pharmacy</button>'+
        '<button class="btn secondary" type="button" style="font-size:.72rem" onclick="workflowNavBackToMaster()">Back to Master Dashboard</button>'+
        '</div></div>';
    }else{
      selectedPanel.style.display='none';
      selectedPanel.innerHTML='';
    }
  }
}
async function openServiceCampaign(campaignId){
  if(!activeCustomer||!campaignId)return;
  try{
    // Clear stale campaign-specific evidence/generation UI state before loading the next campaign.
    activeSpeReview=null;
    activeSpgDashboard=null;
    ['speModal','spgModal','cprClusterReviewModal'].forEach(function(id){const el=document.getElementById(id);if(el)el.classList.remove('open');});
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/select-campaign',{method:'POST',body:JSON.stringify({campaignId:campaignId})});
    // Full replace — never keep a stale pre-generation campaign summary without previewUrl.
    if(data.customer)activeCustomer=data.customer;
    if(data.workflowSummary&&activeCustomer)activeCustomer.workflowSummary=data.workflowSummary;
    setCustomerCampaignUrl(activeCustomer.slug,campaignId);
    renderCustomerDetail(activeCustomer);
    const camp=activeCustomer.selectedServiceCampaign||(activeCustomer.serviceCampaigns||[]).find(function(x){return x.campaignId===campaignId;});
    if(camp)await runSelectedCampaignNextAction(camp,true);
    toast('Opened '+((camp&&camp.serviceName)||'campaign'));
  }catch(e){toast(e.message||String(e),true)}
}
let createCampaignInFlight=false;
async function createServiceCampaignFromMasterDashboard(){
  if(!activeCustomer||createCampaignInFlight)return;
  const select=document.getElementById('createCampaignServiceSelect');
  const btn=document.getElementById('createCampaignBtn');
  const msg=document.getElementById('createCampaignMsg');
  const serviceId=select&&select.value?String(select.value).trim():'';
  if(!serviceId){
    if(msg){msg.style.color='#f87171';msg.textContent='Select a service before creating a campaign.';}
    toast('Select a service first.',true);
    return;
  }
  const serviceLabel=select.options[select.selectedIndex]?select.options[select.selectedIndex].text:serviceId;
  if(!window.confirm('Create a new '+serviceLabel+' campaign for '+activeCustomer.pharmacyName+'? This inherits the approved Business Profile and opens Service Evidence. No pages are generated.'))return;
  createCampaignInFlight=true;
  if(btn){btn.disabled=true;btn.textContent='Creating…';}
  if(msg){msg.style.color='#94a3b8';msg.textContent='Creating campaign…';}
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/campaigns/create',{method:'POST',body:JSON.stringify({serviceId:serviceId,operatorConfirmed:true,initiationSource:'product_owner_dashboard'})});
    if(data.customer)activeCustomer=data.customer;
    if(data.workflowSummary&&activeCustomer)activeCustomer.workflowSummary=data.workflowSummary;
    const campaignId=(data.campaign&&(data.campaign.id||data.campaign.campaignId))||'';
    if(campaignId)setCustomerCampaignUrl(activeCustomer.slug,campaignId);
    renderCustomerDetail(activeCustomer);
    if(select)select.value='';
    if(msg){msg.style.color='#4ade80';msg.textContent='Campaign created — opening Service Evidence.';}
    toast('Campaign created: '+((data.campaign&&data.campaign.serviceName)||serviceLabel));
    const camp=activeCustomer.selectedServiceCampaign||(activeCustomer.serviceCampaigns||[]).find(function(x){return x.campaignId===campaignId;});
    if(camp&&camp.nextActionPanel==='service-page-evidence-review'){
      await openServicePageEvidenceReview();
    }else if(campaignId){
      await openServiceCampaign(campaignId);
    }else{
      await openServicePageEvidenceReview();
    }
  }catch(e){
    if(msg){msg.style.color='#f87171';msg.textContent=e.message||String(e);}
    toast(e.message||String(e),true);
  }finally{
    createCampaignInFlight=false;
    if(btn){btn.disabled=false;btn.textContent='Create';}
  }
}
async function runSelectedCampaignNextAction(camp,autoOpen){
  const selected=camp||(activeCustomer&&activeCustomer.selectedServiceCampaign);
  if(!selected)return;
  const panel=selected.nextActionPanel;
  if(!panel){
    if(autoOpen!==false)toast(selected.nextAction||'No panel action for this campaign stage');
    return;
  }
  const opener=WORKFLOW_PANEL_OPENERS[panel];
  if(typeof opener==='function'){
    await Promise.resolve(opener());
  }
}
function escJson(v){return esc(JSON.stringify(v,null,2))}
function renderOnboardingSourcesPanel(c){
  const os=c.onboardingSources||{};
  const w=os.website||{};
  const g=os.google||{};
  const batch=os.batch;
  document.getElementById('detailOnboardingSources').innerHTML=
    '<h5>Onboarding Sources</h5>'+
    '<div class="orchestration-summary">'+
    '<div><span class="label">Batch</span><div><strong>'+esc(os.overallState||'—')+'</strong>'+(os.blockingAction?'<div style="color:#f59e0b;font-size:.72rem">'+esc(os.blockingAction)+'</div>':'')+'</div></div>'+
    '<div><span class="label">Website</span><div>'+esc(w.canonicalUrl||c.website||'—')+' · '+esc(w.importState||'—')+(w.lastSuccessfulImport?' · '+fmt(w.lastSuccessfulImport):'')+'</div><div style="color:#64748b;font-size:.72rem">'+esc(w.progressLabel||'')+'</div></div>'+
    '<div><span class="label">Google</span><div>'+esc(g.placeId||c.googleSource?.placeId||'—')+' · '+esc(g.confirmationState||'—')+' · '+esc(g.importState||'—')+'</div><div style="color:#64748b;font-size:.72rem">'+esc(g.progressLabel||'')+'</div></div>'+
    '<div><span class="label">Latest Evidence</span><div>'+esc(os.latestEvidence||batch?.latestEvidence||'—')+'</div></div>'+
    '</div>'+
    (w.importState==='branch_selection_required'?'<div style="margin-top:10px;padding:10px;border:1px solid #334155;border-radius:8px"><div style="font-weight:700;margin-bottom:6px">Pharmacy branch selection required</div><p style="font-size:.72rem;color:#94a3b8;margin:0 0 8px">Select the pharmacy branch being onboarded from the imported website evidence.</p><button class="btn" type="button" onclick="openImportedEvidenceReviewFromOnboarding()">Select Pharmacy Branch</button></div>':w.importState==='failed'||String(w.progressLabel||'').toLowerCase().includes('incomplete')?'<div style="margin-top:10px;padding:10px;border:1px solid #334155;border-radius:8px"><div style="font-weight:700;margin-bottom:6px">Website Import action required</div><p style="font-size:.72rem;color:#94a3b8;margin:0 0 8px">Confirm imported website evidence in Imported Evidence Review.</p><button class="btn" type="button" onclick="openImportedEvidenceReviewFromOnboarding()">Open Imported Evidence Review</button></div>':'')+
    (os.overallState==='partially_complete'?'<div style="margin-top:8px"><button class="btn secondary" type="button" onclick="retryFailedSource()">Retry Failed Source</button></div>':'');
}
async function retryFailedSource(){
  if(!activeCustomer)return;
  const os=activeCustomer.onboardingSources||{};
  const source=os.website?.importState==='failed'?'website':'google';
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/retry_onboarding_source',{method:'POST',body:JSON.stringify({source})});
    toast('Retry queued for '+source);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    startJobPolling();
  }catch(e){toast(e.message,true)}
}
function renderWorkflowSummaryPanel(c){
  const ws=c.workflowSummary;
  if(!ws)return '';
  const canonical=ws.canonicalPlan||{};
  const image=ws.imagePlatform||{};
  const ci=ws.commercialIntelligence||{};
  const inv=canonical.inventoryCount!=null?String(canonical.inventoryCount):'—';
  const ciStatus=ci.approvalStatus||ci.status||'—';
  const ciDetail=ci.detail?'<div class="workflow-meta">'+esc(ci.detail)+'</div>':'';
  const imgLine=image.status==='unavailable'?'Unavailable':[
    image.assignmentCount!=null?image.assignmentCount+' assignments':null,
    image.uniqueApprovedAssets!=null?image.uniqueApprovedAssets+' unique approved assets':null,
    image.parityStatus||image.status||null
  ].filter(Boolean).join(' · ');
  return '<div class="orchestration-summary" style="margin-top:10px">'+
    '<div><span class="label">Canonical Inventory</span><div>'+esc(inv)+'</div></div>'+
    '<div><span class="label">Image Platform</span><div>'+esc(imgLine)+'</div></div>'+
    '<div><span class="label">Commercial Intelligence</span><div>'+esc(ciStatus)+ciDetail+'</div></div>'+
    '<div><span class="label">Workflow Readiness</span><div>'+esc(ws.workflowReadinessStatus||'—')+'</div></div>'+
    '</div>';
}
function renderCustomerDetail(c){
  document.getElementById('detailTitle').textContent=c.businessName;
  const atBpr=customerAtBusinessProfileReview(c);
  const selectedCampaign=c.selectedServiceCampaign||null;
  const campaignScoped=Boolean(selectedCampaign);
  document.getElementById('detailMeta').textContent=atBpr
    ? ['Business Profile Review'].filter(Boolean).join(' · ')
    : campaignScoped
      ? [selectedCampaign.serviceName,selectedCampaign.currentStage,'Next: '+selectedCampaign.nextAction,c.accountManager].filter(Boolean).join(' · ')
      : [stageDisplayLabel(c),c.nextAction?'Next: '+c.nextAction:'',(c.outstandingIssues||0)+' open issues',c.accountManager].filter(Boolean).join(' · ');
  renderOnboardingSourcesPanel(c);
  document.getElementById('detailOnboardingSources').style.display=atBpr?'none':'';
  const wf=c.workflow;
  if(wf&&wf.stages){
    document.getElementById('detailLifecycle').innerHTML=wf.stages.map(s=>'<div class="detail-step '+esc(s.status)+'"><span class="workflow-icon '+esc(s.status)+'">'+workflowIcon(s.status)+'</span><div><div>'+esc(s.id==='live_customer'?'Customer Ready':s.label)+'</div>'+(s.timestamp||s.operator?'<div class="workflow-meta">'+fmt(s.timestamp)+(s.operator?' · '+esc(s.operator):'')+(s.durationMs!=null?' · '+dur(s.durationMs):'')+(s.evidence?' · '+esc(s.evidence):'')+'</div>':'')+'</div></div>').join('');
    const g=wf.guidance||{};
    document.getElementById('detailGuidance').innerHTML='<h5>What to do next</h5><p>'+esc(g.expectedOutcome||g.purpose||'')+'</p>';
  }else{
    document.getElementById('detailLifecycle').innerHTML=(c.lifecycleProgress||[]).map(s=>'<span class="detail-step '+(s.active?'active':s.complete?'complete':'')+'">'+esc(s.label)+'</span>').join('');
    document.getElementById('detailGuidance').innerHTML='';
  }
  document.getElementById('detailLifecycle').style.display=atBpr?'none':'';
  document.getElementById('detailGuidance').style.display=atBpr?'none':'';
  const orch=c.orchestration||c.workflow?.orchestration||{};
  const op=c.operationalSummary||{};
  document.getElementById('detailOperationalSummary').innerHTML=
    '<div><span class="label">Current Stage</span><div>'+esc(stageDisplayLabel(c))+'</div></div>'+
    '<div><span class="label">Next Stage</span><div>'+esc(c.workflow?.nextStageLabel==='Live Customer'?'Customer Ready':(c.workflow?.nextStageLabel||'—'))+'</div></div>'+
    '<div><span class="label">Overall Progress</span><div>'+(c.workflowCompletionPct??0)+'%</div></div>'+
    '<div><span class="label">Estimated Time Remaining</span><div>'+(c.workflow?.estimatedMinutesRemaining??0)+' min</div></div>'+
    '<div><span class="label">Blocking Issues</span><div>'+((op.blockingIssues||[]).length?(op.blockingIssues||[]).map(x=>esc(x)).join('<br>'):'None')+'</div></div>'+
    '<div><span class="label">Latest Evidence</span><div>'+esc(op.latestEvidence||'—')+'</div></div>'+
    '<div><span class="label">Next Action</span><div>'+esc(campaignScoped?(selectedCampaign.nextAction):(orch.stageActionLabel||c.nextAction||'Continue Workflow'))+'</div></div>'+
    '<div><span class="label">Market Scope</span><div>'+esc((c.marketScope&&c.marketScope.marketScopeLabel)||'—')+'</div></div>'+
    '<div><span class="label">Primary Market</span><div>'+esc((c.marketScope&&c.marketScope.primaryMarket)||c.sections?.businessProfile?.primaryMarket||'—')+'</div></div>'+
    '<div><span class="label">Growth Platform</span><div>'+esc((c.growthPlatform||'local').toUpperCase())+'</div></div>';
  renderServiceCampaignsPanel(c);
  const mod=document.getElementById('detailPlatformModules');
  if(mod){
    const ps=c.platformStatus||{};
    const scm=c.searchConsoleMetrics||{};
    mod.style.display='block';
    mod.innerHTML='<div style="font-weight:800;font-size:.82rem;margin-bottom:8px">Platform status</div>'+
      renderCustomerStatusPills(c)+
      '<div style="font-size:.68rem;color:#64748b;margin-top:8px">Search Console: '+esc(scm.connectionStatus||'—')+' · Last sync: '+fmt(scm.lastSync||'')+' · Property: '+esc(scm.property||'—')+'</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">'+
      '<button class="btn secondary" type="button" style="font-size:.72rem" onclick="openCommercialIntelligenceReview()">Open Competitor Analysis</button>'+
      '<button class="btn secondary" type="button" style="font-size:.72rem" onclick="openCommercialIndexingReview(true)">Search Console &amp; Indexing</button>'+
      '<button class="btn secondary" type="button" style="font-size:.72rem" onclick="openCommercialPerformanceDashboard(true)">Growth Dashboard</button>'+
      '</div>'+
      '<div style="font-size:.68rem;color:#64748b;margin-top:8px">Website import: '+esc(ps.websiteImportState||'—')+' · Google: '+esc(ps.googleImportState||'—')+' · Business review: '+(ps.businessReviewApproved?'Approved':'Pending')+'</div>';
  }
  const wsEl=document.getElementById('detailWorkflowSummary');
  if(wsEl)wsEl.innerHTML=renderWorkflowSummaryPanel(c);
  const jobs=op.jobs||[];
  const atCge=customerAtGenerateEcosystem(c);
  const atIdx=customerAtIndexing(c);
  const atPerf=customerAtPerformanceDashboard(c);
  const atCirEarly=customerAtCommercialIntelligence(c);
  const atCqr=customerAtQualityReview(c);
  const atMp=customerAtManagedPublishing(c);
  const atPublishReview=customerAtPublishReview(c);
  const atCprJourney=customerAtCprServicePageJourney(c);
  const hideDiagnostics=atCirEarly||atCqr||atPublishReview||atMp||atCge||atIdx||atPerf||atCprJourney;
  document.getElementById('detailJobsPanel').innerHTML=hideDiagnostics?'<div class="empty">Use the commercial dashboard for this stage — operational summary only.</div>':(jobs.length?jobs.slice(0,6).map(j=>'<div class="job-row"><strong class="status-'+esc(j.status)+'">'+esc(j.status)+'</strong> · '+esc(j.action)+'<br><span style="color:#64748b">'+esc(j.progressLabel)+' · retry '+esc(j.retryCount||0)+' · '+jobDuration(j)+' · '+fmt(j.createdAt)+'</span></div>').join(''):'<div class="empty">No background jobs for this customer</div>');
  document.getElementById('detailHistory').innerHTML=hideDiagnostics?'<div class="workflow-meta">Commercial workflow history is available inside each dashboard stage.</div>':((wf&&wf.history||[]).slice(0,12).map(h=>'<div class="workflow-meta">'+fmt(h.timestamp)+' · '+esc(h.fromStage)+' → '+esc(h.toStage)+' · '+esc(h.operator)+(h.durationMs!=null?' · '+dur(h.durationMs):'')+'</div>').join('')||'<div class="workflow-meta">No transitions recorded yet.</div>');
  if(wf&&wf.executions&&wf.executions.length&&!hideDiagnostics){
    const execHtml=wf.executions.slice(0,6).map(e=>'<div class="workflow-meta">'+fmt(e.finishedAt||e.startedAt)+' · '+esc(e.stageId)+' · '+esc(e.status)+(e.durationMs!=null?' · '+dur(e.durationMs):'')+(e.retryCount?' · retry '+e.retryCount:'')+(e.evidence?' · '+esc(e.evidence):'')+'</div>').join('');
    document.getElementById('detailHistory').innerHTML=execHtml+document.getElementById('detailHistory').innerHTML;
  }
  document.getElementById('detailTimeline').innerHTML='<table class="audit-table"><thead><tr><th>Time</th><th>Action</th><th>Status</th></tr></thead><tbody>'+(c.sections.activityTimeline||[]).map(a=>'<tr><td>'+fmt(a.timestamp)+'</td><td>'+esc(a.action)+'</td><td class="status-'+esc(a.status)+'">'+esc(a.status)+'</td></tr>').join('')+'</tbody></table>';
  renderWebsiteSourcePanel(c);
  renderGoogleSourcePanel(c);
  renderCustomerAccountPanel(c);
  renderLocalCoveragePanel(c);
  const bprBanner=document.getElementById('detailBprBanner');
  const bpr=c.businessProfileReview;
  if(bprBanner){
    if(atBpr&&bpr&&bpr.summary){
      const s=bpr.summary;
      bprBanner.style.display='block';
      bprBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Business Profile Review</div><div style="font-size:.72rem;color:#c4b5fd">'+esc(s.readinessLabel||'')+' · '+esc(String(s.needsAttention||0))+' item(s) need attention · ~'+esc(String(s.estimatedReviewMinutes||2))+' min</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Website '+importStatusLabel(s.websiteImportStatus)+' · Google '+importStatusLabel(s.googleImportStatus)+' · '+esc(String(s.automaticallyVerified||0))+' fields verified automatically</div></div><div style="display:flex;flex-direction:column;gap:8px;min-width:220px"><button class="bpr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openBusinessProfileReview()">'+(s.approvalStatus==='approved'?'View Approved Profile':'Open Business Profile Review')+'</button><button class="btn secondary" type="button" style="width:auto;min-width:220px;font-size:.72rem" onclick="openReviewConfirmedServices()">Review Confirmed Services</button></div></div>';
    }else{bprBanner.style.display='none';bprBanner.innerHTML=''}
  }
  const reimportState=c.websiteIntelligenceReimport||{};
  const wsSource=c.websiteSource||{};
  const reimportBtn=document.getElementById('reimportWebsiteWorkflowBtn');
  if(reimportBtn){
    const canReimport=wsSource.canEditWebsite!==false&&Boolean(wsSource.canonicalWebsite||c.website)&&(Boolean(wsSource.websiteImported)||Boolean(reimportState.required));
    const required=Boolean(reimportState.required&&reimportState.actionId==='rerun_website_import');
    reimportBtn.style.display=canReimport?'block':'none';
    reimportBtn.className=required?'btn':'btn secondary';
    reimportBtn.style.width='100%';
    reimportBtn.style.marginTop='8px';
    reimportBtn.style.fontSize='.78rem';
    reimportBtn.textContent='Re-import Website';
    reimportBtn.disabled=false;
  }
  const bprBtn=document.getElementById('openBprBtn');
  if(bprBtn){
    const approved=Boolean(bpr&&bpr.summary&&bpr.summary.approvalStatus==='approved');
    // Hide BPR only while a corrective re-import is required — optional re-import does not block BPR.
    bprBtn.style.display=atBpr&&!approved&&!reimportState.required?'block':'none';
    bprBtn.textContent='Open Business Profile Review';
  }
  const atCdc=false;
  const cqrBtn=document.getElementById('openCqrBtn');
  if(cqrBtn){
    cqrBtn.style.display=(atCqr&&!customerAtCoreProductRecovery(c)&&!customerAtCprClusterReview(c))?'block':'none';
    cqrBtn.textContent='Open Quality Review';
  }
  const clusterReviewBtn=document.getElementById('openClusterReviewBtn');
  if(clusterReviewBtn){
    clusterReviewBtn.style.display=customerAtCprClusterReview(c)?'block':'none';
    clusterReviewBtn.textContent='Review Locality Pages';
  }
  const mpBtn=document.getElementById('openMpBtn');
  if(mpBtn){mpBtn.style.display=atMp?'block':'none'}
  const cdcBtn=document.getElementById('openCdcBtn');
  if(cdcBtn){cdcBtn.style.display='none'}
  const cprBtn=document.getElementById('openCprBtn');
  if(cprBtn){cprBtn.style.display=atPublishReview?'block':'none'}
  const idxBtn=document.getElementById('openIdxBtn');
  if(idxBtn){idxBtn.style.display='block'}
  const perfBtn=document.getElementById('openPerfBtn');
  if(perfBtn){perfBtn.style.display='block'}
  const cqrBanner=document.getElementById('detailCqrBanner');
  if(cqrBanner){
    if(customerAtCprClusterReview(c)){
      cqrBanner.style.display='block';
      cqrBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Locality Review</div><div style="font-size:.72rem;color:#7dd3fc">Locality pages generated — review before publishing</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Active action: Review Locality Pages</div></div><button class="cqr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openClusterPageReview()">Review Locality Pages</button></div>';
    }else if(atCqr&&!customerAtCoreProductRecovery(c)){
      cqrBanner.style.display='block';
      cqrBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Quality Review</div><div style="font-size:.72rem;color:#7dd3fc">Is this website ready to publish? · ~2 min review</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Review generated output only — nothing is regenerated</div></div><button class="cqr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialQualityReview()">Open Quality Review</button></div>';
    }else{cqrBanner.style.display='none';cqrBanner.innerHTML=''}
  }
  const cdcBanner=document.getElementById('detailCdcBanner');
  if(cdcBanner){
    if(atMp){
      const mp=c.managedPublishing||{};
      const status=mp.summary?.overallStatus||mp.summary?.publishingReadiness||'CONFIGURATION REQUIRED';
      cdcBanner.style.display='block';
      cdcBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Managed Publishing</div><div style="font-size:.72rem;color:#86efac">PharmaConnect Hosting · ✓ Managed</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">'+esc(mp.managedUrl||'Managed hostname pending')+' · '+esc(status)+'</div></div><button class="cdc-btn-review" type="button" style="width:auto;min-width:220px" onclick="openManagedPublishing()">Open Managed Publishing</button></div>';
    }else{cdcBanner.style.display='none';cdcBanner.innerHTML=''}
  }
  const cprBanner=document.getElementById('detailCprBanner');
  if(cprBanner){
    if(atPublishReview){
      cprBanner.style.display='block';
      cprBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Publish Website</div><div style="font-size:.72rem;color:#fcd34d">Is this generated website ready to go live now?</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Review destination, release summary and preview before publishing</div></div><button class="cpr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialPublishReview()">Open Publish Review</button></div>';
    }else{cprBanner.style.display='none';cprBanner.innerHTML=''}
  }
  const cgeBanner=document.getElementById('detailCgeBanner');
  const spgBanner=document.getElementById('detailSpgBanner');
  const customerInCprMode=Boolean(customerAtCoreProductRecovery(c));
  if(cgeBanner){
    if(atCge&&!customerInCprMode){
      cgeBanner.style.display='block';
      const cgeActionLabel=esc(c.nextAction||orch.continueLabel||'Generate Product Owner Test Package');
      cgeBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Generation Readiness</div><div style="font-size:.72rem;color:#7dd3fc">Review canonical inventory, expected pages, historical package status, and confirm generation.</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Active action: '+cgeActionLabel+' — explicit confirmation required inside the dialog.</div></div><button class="cqr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialEcosystemGeneration()">'+cgeActionLabel+'</button></div>';
    }else{cgeBanner.style.display='none';cgeBanner.innerHTML=''}
  }
  if(spgBanner){
    if(campaignScoped&&selectedCampaign){
      spgBanner.style.display='block';
      const spgActionLabel=esc(selectedCampaign.nextAction||'Open Campaign');
      const spgTitle=esc(selectedCampaign.serviceName)+' — '+esc(selectedCampaign.currentStage);
      const spgSub=esc(selectedCampaign.servicePageStatus)+' · '+esc(selectedCampaign.localPageStatus)+' · '+esc(selectedCampaign.workflowState||'');
      const spgWorkflow=renderProductOwnerWorkflowActions(selectedCampaign,{style:'width:auto;min-width:220px;font-size:.72rem'});
      spgBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">'+spgTitle+'</div><div style="font-size:.72rem;color:#7dd3fc">'+spgSub+'</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Active action: '+spgActionLabel+'</div></div><div style="display:flex;flex-direction:column;gap:8px;min-width:220px" id="detailSpgPoWorkflowActions">'+spgWorkflow+'</div></div>';
    }else if(customerInCprMode&&(atCprJourney||customerAtServicePageReview(c)||customerAtCprClusterGeneration(c)||customerAtCprClusterReview(c))){
      spgBanner.style.display='block';
      const clusterReviewPhase=customerAtCprClusterReview(c);
      const clusterPhase=customerAtCprClusterGeneration(c);
      const spgActionLabel=esc(c.nextAction||(clusterReviewPhase?'Review Locality Pages':(clusterPhase?'Generate Locality Pages':(customerAtServicePageReview(c)?'Open Service Preview':'Generate Service Page'))));
      const spgTitle=clusterReviewPhase?'Cluster Review':(clusterPhase?'Cluster Generation':((!c.coreProductRecovery?.evidenceReviewApproved&&!c.coreProductRecovery?.servicePageGenerated)?'Evidence Review':'CPR-01 Service Page'));
      const spgSub=clusterReviewPhase?'Cluster pages are ready — review them before publishing.':(clusterPhase?'Service page approved — generate local cluster pages for selected areas.':((!c.coreProductRecovery?.evidenceReviewApproved&&!c.coreProductRecovery?.servicePageGenerated)?'Review Business, Brand, Images, Service, Trust, and SEO evidence before generation is enabled.':'Generate exactly one gold-standard service page. No ecosystem, clusters, blogs, or guides.'));
      const spgHandler=clusterReviewPhase?'openClusterPageReview()':(clusterPhase?'openCprClusterGenerationFromBanner()':(customerAtServicePageReview(c)?'openServicePageReview()':((c.coreProductRecovery&&!c.coreProductRecovery.evidenceReviewApproved)?'openServicePageEvidenceReview()':'openServicePageGeneration()')));
      spgBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">'+esc(spgTitle)+'</div><div style="font-size:.72rem;color:#7dd3fc">'+esc(spgSub)+'</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Active action: '+spgActionLabel+'</div></div><button class="cqr-btn-review" type="button" style="width:auto;min-width:220px" onclick="'+spgHandler+'">'+spgActionLabel+'</button></div>';
    }else{spgBanner.style.display='none';spgBanner.innerHTML=''}
  }
  const idxBanner=document.getElementById('detailIdxBanner');
  if(idxBanner){
    if(atIdx){
      idxBanner.style.display='block';
      idxBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Indexing</div><div style="font-size:.72rem;color:#86efac">Submit published pages for search indexing and monitor coverage.</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Indexing requires explicit confirmation before submission.</div></div><button class="cqr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialIndexingReview()">Open Indexing</button></div>';
    }else{idxBanner.style.display='none';idxBanner.innerHTML=''}
  }
  const perfBanner=document.getElementById('detailPerfBanner');
  if(perfBanner){
    if(atPerf){
      perfBanner.style.display='block';
      perfBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Performance Dashboard</div><div style="font-size:.72rem;color:#c4b5fd">Review indexed pages, rankings, and commercial health — then complete the workflow.</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Final commercial stage before ongoing monitoring.</div></div><button class="cqr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialPerformanceDashboard()">Open Performance Dashboard</button></div>';
    }else{perfBanner.style.display='none';perfBanner.innerHTML=''}
  }
  const atCirReview=customerAtCommercialIntelligenceReview(c);
  const atCir=customerAtCommercialIntelligence(c);
  const cirBanner=document.getElementById('detailCirBanner');
  if(cirBanner){
    if(atCir){
      const stage=customerStage(c);
      const title=stage==='commercial_intelligence'?'Commercial Intelligence Dashboard':'Commercial Intelligence';
      const sub=atCirReview?((c.commercialIntelligenceStatusLabel||'Commercial Intelligence Ready For Review')+' — review all intelligence and approve before Generate Ecosystem.'):'Intelligence engines are generating automatically — review together when ready.';
      cirBanner.style.display='block';
      cirBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">'+esc(title)+'</div><div style="font-size:.72rem;color:#c4b5fd">'+esc(sub)+'</div></div><button class="cir-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialIntelligenceReview()">'+(atCirReview?'Open Dashboard & Approve':'Open Commercial Intelligence Dashboard')+'</button></div>';
    }else{cirBanner.style.display='none';cirBanner.innerHTML=''}
  }
  const cirBtn=document.getElementById('openCirBtn');
  if(cirBtn){cirBtn.style.display='block';cirBtn.textContent='Open Competitor Analysis'}
  const btn=document.getElementById('continueWorkflowBtn');
  btn.style.display=(atCqr||atMp||atPublishReview||atCirReview||atCge||atIdx||atPerf||atCprJourney||customerAtServicePageReview(c))?'none':'block';
  btn.textContent=orch.continueLabel||'Continue Workflow';
  if(customerStage(c)==='generate_growth_intelligence'){
    if(cirBanner){
      cirBanner.style.display='block';
      cirBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Growth Intelligence</div><div style="font-size:.72rem;color:#c4b5fd">Business Profile is approved. Generate Growth Intelligence when you confirm. Generation does not start until you use that action.</div></div></div>';
    }
    if(cirBtn){
      cirBtn.style.display='inline-block';
      cirBtn.textContent='Generate Growth Intelligence';
      cirBtn.setAttribute('onclick','continueWorkflow("orchestrate_growth_intelligence")');
    }
    btn.style.display='block';
    btn.textContent=(c.nextAction&&c.nextAction!=='—')?c.nextAction:'Generate Growth Intelligence';
  }
  btn.disabled=!orch.canContinue;
  const editOnboardingBtn=document.getElementById('editOnboardingSetupBtn');
  if(editOnboardingBtn)editOnboardingBtn.style.display='block';
  document.getElementById('detailBlockReason').textContent=orch.blockingReason&&!orch.canContinue?orch.blockingReason:'';
  const jobEl=document.getElementById('detailJobStatus');
  if(orch.activeJob){
    jobEl.style.display='block';
    jobEl.innerHTML='<strong>Active job</strong><br><strong class="status-'+esc(orch.activeJob.status)+'">'+esc(orch.activeJob.status)+'</strong> · '+esc(orch.activeJob.action)+'<br>'+esc(orch.activeJob.progressLabel)+' ('+orch.activeJob.progress+'%)';
  }else{jobEl.style.display='none'}
}
async function continueWorkflow(explicitActionId){
  if(!activeCustomer)return;
  const btn=document.getElementById('continueWorkflowBtn');
  const clusterBtn=document.getElementById('sprClusterGenerateBtn');
  const blockReasonEl=document.getElementById('detailBlockReason');
  const jobEl=document.getElementById('detailJobStatus');
  const orch=activeCustomer.orchestration||activeCustomer.workflow?.orchestration||{};
  const actionId=explicitActionId||orch.stageActionId||'';
  const priorLabel=btn?btn.textContent:'';
  if(btn)btn.disabled=true;
  if(clusterBtn&&actionId==='generate_local_cluster_pages')clusterBtn.disabled=true;
  if(actionId==='orchestrate_growth_intelligence'||actionId==='orchestrate_competitor_analysis'||actionId==='orchestrate_local_market_intelligence'||actionId==='generate_local_cluster_pages'){
    const label=actionId==='orchestrate_competitor_analysis'?'Generating Competitor Analysis…':actionId==='orchestrate_local_market_intelligence'?'Generating Local Market Intelligence…':actionId==='generate_local_cluster_pages'?'Generating Cluster Pages…':'Generating Growth Intelligence…';
    if(btn)btn.textContent=label;
    if(clusterBtn&&actionId==='generate_local_cluster_pages')clusterBtn.textContent=label;
    if(jobEl){jobEl.style.display='block';jobEl.innerHTML='<strong>'+esc(label)+'</strong>'}
  }
  try{
    const payload=actionId?{actionId:actionId,operatorConfirmed:true}:{};
    const res=await fetch(withAuthHandoff('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/continue-workflow'),{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok&&data.confirmationRequired){
      toast('Confirm Google Business Profile before continuing');
      if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
      else if(data.googleConfirmation){renderGoogleConfirmationPanel(activeCustomer.googleSource||{},data.googleConfirmation)}
      return;
    }
    if(!res.ok)throw new Error(data.error||data.outcome?.error||res.statusText);
    if(data.async&&data.jobId){
      toast(actionId==='orchestrate_growth_intelligence'?'Generating Growth Intelligence…':actionId==='generate_local_cluster_pages'?'Cluster generation queued':'Workflow job queued — waiting for completion');
      startJobPolling();
      if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
      if(clusterBtn&&actionId==='generate_local_cluster_pages'){clusterBtn.disabled=true;clusterBtn.textContent='Generating Cluster Pages…'}
      return;
    }
    const evidence=data.outcome?.evidence||data.customer?.operationalSummary?.latestEvidence||'Workflow continued';
    toast(actionId==='orchestrate_growth_intelligence'&&/generated|complete/i.test(evidence)?'Growth Intelligence generated':evidence);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    await loadDashboard();
  }catch(e){toast(e.message,true);if(activeCustomer){try{const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug));activeCustomer=data.customer;renderCustomerDetail(data.customer)}catch{}}}
  finally{
    if(activeCustomer){
      try{
        const fresh=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug));
        activeCustomer=fresh.customer;
        renderCustomerDetail(activeCustomer);
      }catch{}
      const freshOrch=activeCustomer.orchestration||activeCustomer.workflow?.orchestration||{};
      const activeClusterJob=freshOrch.activeJob&&freshOrch.activeJob.action==='generate_local_cluster_pages';
      if(btn){
        btn.disabled=!freshOrch.canContinue||Boolean(activeClusterJob);
        btn.textContent=activeClusterJob?'Generating Cluster Pages…':(freshOrch.continueLabel||priorLabel||'Continue Workflow');
      }
      if(clusterBtn&&(actionId==='generate_local_cluster_pages'||activeCustomer.coreProductRecovery?.clusterEligible)){
        clusterBtn.disabled=Boolean(activeClusterJob)||!activeCustomer.coreProductRecovery?.clusterEligible;
        clusterBtn.textContent=activeClusterJob?'Generating Locality Pages…':'Generate Locality Pages';
      }
      if(blockReasonEl)blockReasonEl.textContent=freshOrch.blockingReason&&!freshOrch.canContinue?freshOrch.blockingReason:'';
    }
  }
}
async function runAction(actionId){
  if(!activeCustomer)return;
  if(['view_dashboard','review_imports','resolve_conflicts','launch_bpi','open_business_profile_review','open_customer_dashboard','report_issue','view_open_issues','view_review_centre'].includes(actionId)){
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/'+actionId,{method:'POST',body:'{}'});
    if(data.result&&data.result.panel==='business-profile-review'){
      if(customerAtBusinessProfileReview(activeCustomer))openBusinessProfileReview();
      else toast('Business Profile Review is complete — continue with Generate Growth Intelligence.',false);
      return;
    }
    if(data.redirectUrl){window.open(data.redirectUrl,'_blank');return}
  }
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/'+actionId,{method:'POST',body:'{}'});
    if(data.async&&data.job){toast('Job queued: '+actionId);startJobPolling();return}
    toast('Action completed: '+actionId);
    if(data.customer)renderCustomerDetail(data.customer);
    if(data.result&&data.result.username)toast('Credentials: '+data.result.username+' / '+data.result.password);
    await loadDashboard();
  }catch(e){toast(e.message,true)}
}
function closeBusinessProfileReview(){
  document.getElementById('bprModal').classList.remove('open');
  activeBprReview=null;
  clearBprPanelUrlParam();
}
function clearBprPanelUrlParam(){
  const p=new URLSearchParams(location.search);
  if(!p.has('panel'))return;
  p.delete('panel');
  const next=location.pathname+(p.toString()?('?'+p.toString()):'');
  history.replaceState(null,'',next);
}
async function refreshActiveCustomerDetail(){
  if(!activeCustomer)return null;
  if(customerDetailAbortController)customerDetailAbortController.abort();
  customerDetailAbortController=new AbortController();
  const loadSeq=++customerDetailLoadSeq;
  const slug=activeCustomer.slug;
  const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug),{signal:customerDetailAbortController.signal});
  if(loadSeq!==customerDetailLoadSeq)return null;
  activeCustomer=data.customer;
  if(data.workflowSummary)activeCustomer.workflowSummary=data.workflowSummary;
  document.getElementById('customerModal').classList.add('open');
  document.getElementById('detailLoading').style.display='none';
  document.getElementById('detailContent').style.display='block';
  renderCustomerDetail(activeCustomer);
  return activeCustomer;
}
async function syncCustomerAfterProfileApproval(data){
  closeBusinessProfileReview();
  hideBprApprovalError();
  setBprSaveStatus('saved','Approved');
  if(data.customer){
    activeCustomer=data.customer;
    document.getElementById('customerModal').classList.add('open');
    document.getElementById('detailLoading').style.display='none';
    document.getElementById('detailContent').style.display='block';
    renderCustomerDetail(activeCustomer);
  }
  await refreshActiveCustomerDetail();
  if(typeof showUnifiedDashboardSection==='function') showUnifiedDashboardSection('intelligence');
  await loadDashboard();
}
function setBprViewState(state){
  document.getElementById('bprLoading').style.display=state==='loading'?'block':'none';
  document.getElementById('bprContent').style.display=state==='content'?'block':'none';
  document.getElementById('bprError').style.display=state==='error'?'block':'none';
}
function showBprLoadError(msg){
  setBprViewState('error');
  document.getElementById('bprErrorDetail').textContent=msg||'Unknown error';
  window.__lastBprLoadError=msg||'Unknown error';
}
function normalizeBusinessProfileReviewPayload(review){
  if(!review||typeof review!=='object'){
    return {summary:{},needsConfirmation:[],missingInformation:[],recommendedValues:[],verifiedFields:[],actionRequired:[],serviceReconciliation:null};
  }
  const needsConfirmation=Array.isArray(review.needsConfirmation)?review.needsConfirmation:(Array.isArray(review.actionRequired)?review.actionRequired:[]);
  const missingInformation=Array.isArray(review.missingInformation)?review.missingInformation:[];
  const recommendedValues=Array.isArray(review.recommendedValues)?review.recommendedValues:[];
  const verifiedFields=Array.isArray(review.verifiedFields)?review.verifiedFields:(Array.isArray(review.reviewedAutomatically)?review.reviewedAutomatically:[]);
  return Object.assign({},review,{summary:review.summary||{},needsConfirmation,missingInformation,recommendedValues,verifiedFields,actionRequired:needsConfirmation});
}
function bprCanonicalApproval(review){
  const s=(review&&review.summary)||{};
  const rec=(review&&review.serviceReconciliation)||{};
  const pending=Number(rec.pendingConfirmationCount||0);
  const remaining=Math.max(Number(s.remainingConfirmations||0),Number(s.needsConfirmationCount||0),pending);
  const approved=s.approvalStatus==='approved';
  const readinessLabel=remaining>0?('NEEDS '+remaining+' CONFIRMATIONS'):(s.readinessLabel||'');
  const canApprove=!approved&&remaining===0&&s.readinessLabel==='READY TO APPROVE';
  const approvalDisabledReason=s.approvalDisabledReason||(remaining>0?('Approve unavailable. Please confirm '+remaining+' proposed canonical service(s).'):null);
  return {remainingConfirmations:remaining,readinessLabel:readinessLabel,approvalDisabledReason:approvalDisabledReason,canApprove:canApprove};
}
function showBprApprovalError(msg){
  const el=document.getElementById('bprApprovalError');
  document.getElementById('bprApprovalErrorMsg').textContent=msg||'Business Profile approval failed.';
  el.style.display='block';
  window.__lastBprLoadError=msg||'Business Profile approval failed.';
}
function hideBprApprovalError(){document.getElementById('bprApprovalError').style.display='none'}
function reportBprLoadIssue(){
  if(!activeCustomer){toast('Open a customer first',true);return}
  const err=String(window.__lastBprLoadError||'Business Profile Review load failure');
  const url='/api/admin/master/issues/new?slug='+encodeURIComponent(activeCustomer.slug)+'&component=business-profile-review&summary='+encodeURIComponent(err.slice(0,240));
  window.open(url,'_blank');
}
function customerStage(c){return c.currentStage||c.workflow?.currentStage||''}
function customerAtCommercialIntelligence(c){
  if(customerAtCprServicePageJourney(c))return false;
  return ['competitor_analysis','local_market_intelligence','generate_growth_intelligence','commercial_intelligence'].includes(customerStage(c));
}
function customerAtCprServicePageJourney(c){
  const stage=customerStage(c);
  if(stage==='competitor_analysis'||stage==='local_market_intelligence'||stage==='generate_growth_intelligence'||stage==='commercial_intelligence')return false;
  return customerAtCoreProductRecovery(c)&&!customerAtBusinessProfileReview(c)&&!c.coreProductRecovery?.servicePageGenerated;
}
function customerAtCommercialIntelligenceReview(c){
  return customerStage(c)==='commercial_intelligence';
}
let activeCirDashboard=null;
function ciEvidenceFoot(evidence){
  if(!evidence)return '';
  const rows=[
    ['Evidence Source',evidence.evidenceSource],
    ['Captured At',evidence.capturedAt?fmt(evidence.capturedAt):'Unknown'],
    ['Confidence',evidence.confidence||'Unknown'],
    ['Data Freshness',evidence.dataFreshness||'Unknown']
  ];
  return '<div class="ci-evidence-foot">'+rows.map(r=>'<div><strong>'+esc(r[0])+':</strong> '+esc(String(r[1]||'Unknown'))+'</div>').join('')+'</div>';
}
function ciMetricTable(metrics){
  const rows=(metrics||[]);
  if(!rows.length)return '<p class="ci-narrative">Google Profile Metrics not yet available.</p>';
  return '<table class="ci-metric-table"><thead><tr><th>Metric</th><th>Your Pharmacy</th><th>Local Average</th><th>Highest Competitor</th><th>Gap</th><th>Recommended Target</th><th>Sample Size</th></tr></thead><tbody>'+
    rows.map(m=>'<tr><td>'+esc(m.label)+'</td><td>'+esc(m.yourPharmacy)+'</td><td>'+esc(m.localAverage)+'</td><td>'+esc(m.highestCompetitor)+'</td><td>'+esc(m.gap)+'</td><td>'+esc(m.recommendedTarget)+'</td><td>'+esc(m.sampleSizeLabel||(m.sampleSize!=null?('n='+m.sampleSize):'Not Available'))+'</td></tr>').join('')+
    '</tbody></table>';
}
function ciCompSummaryHtml(summary){
  const lines=(summary||[]);
  if(!lines.length)return '';
  return '<div style="margin-bottom:10px">'+lines.map(l=>'<p class="ci-narrative"><strong>'+esc(l.label)+':</strong> '+esc(l.statement)+'</p>').join('')+'</div>';
}
function ciGiNa(v){
  const s=v==null?'':String(v).trim();
  if(!s||s==='—'||/^unknown$/i.test(s)||s==='null'||s==='undefined')return 'Not Available';
  return s;
}
function ciGiServiceName(o){
  const title=String(o.title||'');
  const m=title.match(/\bfor (.+)$/);
  if(m&&m[1])return m[1].replace(/\s+missing$/i,'').trim();
  const id=String(o.serviceId||'');
  if(!id)return 'Not Available';
  return id.split('-').filter(Boolean).map(function(p){return p.charAt(0).toUpperCase()+p.slice(1);}).join(' ');
}
function ciGiCoverage(opps){
  if(!opps||!opps.length)return 'Not Available';
  const ecosystem=opps.some(function(o){return /content-ecosystem-missing/.test(o.id||'')||/^Generate content ecosystem/i.test(o.title||'');});
  if(ecosystem)return 'Not generated';
  const missing=opps.map(function(o){
    const t=String(o.title||'');
    if(/^Blog missing/i.test(t))return 'blog';
    if(/^Cluster pages missing/i.test(t))return 'cluster pages';
    if(/^FAQ missing/i.test(t))return 'FAQ';
    if(/^Guide missing/i.test(t))return 'guide';
    return '';
  }).filter(Boolean);
  if(missing.length)return 'Partial — '+missing.join(', ')+' missing';
  return 'Not Available';
}
function renderGrowthIntelligenceComplete(dashboard){
  const gi=dashboard.growthIntelligence||{};
  const assessment=gi.serviceOpportunityAssessment||null;
  const opps=gi.opportunities||[];
  const wideOpps=assessment? (assessment.googleProfileActions||[]): opps.filter(function(o){return !o.serviceId;});
  const photosMetric=(dashboard.googleProfileMetrics||[]).find(function(m){return m.id==='photos';});
  const hasPhotosOpp=wideOpps.some(function(o){return o.id==='google-photos-gap'||/photo/i.test(String(o.category||''))||/photo/i.test(String(o.title||''));});
  const photosUnknown=Boolean(photosMetric)&&!hasPhotosOpp;

  function demandLabel(row){
    if(!row||!row.demand) return 'Not Available';
    const d=row.demand;
    if(d.demandEvidenceStatus==='unknown') return 'Unknown';
    const parts=[];
    if(d.canonicalQueryVolume!=null) parts.push('canonical '+d.canonicalQueryVolume.toLocaleString('en-GB'));
    if(d.highestQueryVolume!=null&&d.highestQuery!==d.canonicalQueryVolume) parts.push('peak '+d.highestQueryVolume.toLocaleString('en-GB'));
    if(d.pharmacyIntentVolume!=null) parts.push('pharmacy '+d.pharmacyIntentVolume.toLocaleString('en-GB'));
    if(d.nearMeVolume!=null) parts.push('near-me '+d.nearMeVolume.toLocaleString('en-GB'));
    return parts.length? parts.join('; '): 'No returned volume';
  }
  function websiteLabel(row){
    if(!row||!row.websiteCoverage) return 'Not Available';
    const w=row.websiteCoverage;
    return String(w.classification||'unknown').replace(/-/g,' ')+(w.dedicatedImportedPageUrl? ' — '+w.dedicatedImportedPageUrl:'');
  }
  function organicLabel(row){
    if(!row||!row.organicVisibility) return 'Not Available';
    return String(row.organicVisibility.classification||'unavailable').replace(/-/g,' ');
  }

  const matrixRows=assessment? assessment.services.map(function(row){
    return '<tr data-service-id="'+esc(row.serviceId)+'"><td>'+esc(row.serviceName)+'</td><td>'+esc(demandLabel(row))+'</td><td>'+esc(websiteLabel(row))+'</td><td>'+esc(organicLabel(row))+'</td><td>'+esc(String(row.opportunityClassification||'').replace(/-/g,' '))+'</td><td>'+esc(ciGiNa(row.recommendedAction))+'</td><td>'+esc(row.evidenceConfidence||'unknown')+'</td></tr>';
  }).join(''):'';

  const matrixTable='<div class="ci-section"><h4>Pharmacy-wide Service Opportunity Matrix</h4><p class="ci-narrative">All confirmed services from selectedServices. Demand uses highest returned query volume — overlapping keyword volumes are not summed. CPC and paid competition reflect Google Ads only.</p><div class="table-wrap"><table class="audit-table" id="giServiceOpportunityMatrix"><thead><tr><th>Service</th><th>Demand</th><th>Website coverage</th><th>Organic visibility</th><th>Opportunity</th><th>Recommended action</th><th>Confidence</th></tr></thead><tbody>'+(matrixRows||'<tr><td colspan="7">Not Available</td></tr>')+'</tbody></table></div></div>';

  const topRows=assessment? assessment.topPriorityServices.map(function(row,i){
    const why=[
      row.priorityRationale,
      'Website: '+row.websiteEvidence,
      'Demand: '+row.demandEvidence,
      'Organic: '+row.organicVisibility,
      'Package: '+row.packageStatus
    ].join(' · ');
    return '<tr><td>'+esc(String(i+1))+'. '+esc(row.serviceName)+'</td><td>'+esc(ciGiNa(why))+'</td><td>'+esc(ciGiNa(row.recommendedAction))+'</td></tr>';
  }).join(''):'';
  const topTable='<div class="ci-section"><h4>Top Priority Services</h4><p class="ci-narrative">First five services ranked by website coverage, organic visibility, then demand evidence. Next action reflects package and publication state — not a repeat generate step when a package already exists.</p><div class="table-wrap"><table class="audit-table" id="giTopPriorityServices"><thead><tr><th>Service</th><th>Why prioritised</th><th>Next action</th></tr></thead><tbody>'+(topRows||'<tr><td colspan="3">Not Available</td></tr>')+'</tbody></table></div></div>';

  const wideRows=wideOpps.map(function(o){
    return '<tr data-opportunity-id="'+esc(o.id||'')+'" data-scope="pharmacy-wide"><td><span class="pill">pharmacy-wide</span> '+esc(ciGiNa(o.title))+'</td><td>'+esc(ciGiNa(o.evidenceSummary||o.impact||o.evidence))+'</td><td>'+esc(ciGiNa(o.evidenceSource))+'</td><td>'+esc(ciGiNa(o.recommendedAction||o.whyItMatters||o.impact||o.title))+'</td></tr>';
  });
  if(photosUnknown){
    wideRows.push('<tr data-opportunity-id="photos-unknown" data-scope="pharmacy-wide"><td><span class="pill">pharmacy-wide</span> Google Business photos</td><td>Not Available</td><td>Google Places</td><td>Not Available</td></tr>');
  }
  const wideTable='<div class="ci-section"><h4>Pharmacy-wide Google Profile Actions</h4><p class="ci-narrative">Google Places evidence applies once to the pharmacy listing — not repeated per service.</p><div class="table-wrap"><table class="audit-table" id="giPharmacyWideTable"><thead><tr><th>Action</th><th>Current evidence</th><th>Evidence source</th><th>Recommended action</th></tr></thead><tbody>'+(wideRows.join('')||'<tr><td colspan="4">Not Available</td></tr>')+'</tbody></table></div></div>';

  const limitItems=assessment&&assessment.evidenceLimitations? assessment.evidenceLimitations:[];
  const limitsHtml='<div class="ci-section"><h4>Evidence Limitations</h4>'+(limitItems.length?('<ul>'+limitItems.map(function(item){return '<li>'+esc(item)+'</li>';}).join('')+'</ul>'):'<p class="ci-narrative">Not Available</p>')+'</div>';

  return matrixTable+topTable+wideTable+limitsHtml;
}
function ciSection(title,narrative,items,evidence){
  const lis=(items||[]).filter(Boolean);
  if(!lis.length&&!narrative&&!evidence)return '';
  return '<div class="ci-section"><h4>'+esc(title)+'</h4>'+(narrative?'<p class="ci-narrative">'+esc(narrative)+'</p>':'')+(lis.length?'<ul>'+lis.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>':'')+ciEvidenceFoot(evidence)+'</div>';
}
function ciIssueBlock(kind,title,items){
  if(!items||!items.length)return '';
  const cls=kind==='block'?'ci-issue-block':kind==='rec'?'ci-issue-rec':'ci-issue-hist';
  return '<div class="'+cls+'"><h5>'+esc(title)+'</h5>'+items.map(it=>'<div class="ci-item"><strong>'+esc(it.title)+'</strong>'+esc(it.detail||'')+'</div>').join('')+'</div>';
}
function renderCommercialIntelligenceDashboard(dashboard){
  activeCirDashboard=dashboard;
  const mainEl=document.getElementById('cirMain');
  const panelEl=document.getElementById('cirApprovalPanel');
  if(!mainEl||!panelEl)throw new Error('Commercial Intelligence Dashboard container missing — rebuild and reload the application');

  if(dashboard.nationalGrowthPlatform&&dashboard.nationalGrowthPlatform.platform==='national'){
    const ng=dashboard.nationalGrowthPlatform;

    const steps=Array.isArray(ng.steps)?ng.steps:[];

    function nationalStatusIcon(status){
      if(status==='complete')return '✓';
      if(status==='ready')return '→';
      if(status==='not_applicable')return '—';
      return '○';
    }

    function nationalStatusLabel(step){
      if(step&&step.statusLabel)return step.statusLabel;
      if(step&&step.status==='complete')return 'Complete';
      if(step&&step.status==='ready')return 'Ready';
      if(step&&step.status==='not_applicable')return 'Not Applicable';
      return 'Not Run';
    }

    const stepHtml=steps.length
      ? steps.map(function(step){
          return '<div class="ci-exec-card" style="margin-bottom:10px">'+
            '<div style="display:flex;gap:10px;align-items:flex-start">'+
              '<div style="font-size:1rem;font-weight:800;min-width:18px">'+
                esc(nationalStatusIcon(step.status))+
              '</div>'+
              '<div style="flex:1">'+
                '<div class="lbl">'+esc(step.label||step.id||'National checkpoint')+'</div>'+
                '<div class="val">'+esc(nationalStatusLabel(step))+'</div>'+
                (step.detail
                  ? '<div style="font-size:.68rem;color:#94a3b8;margin-top:5px;line-height:1.45">'+esc(step.detail)+'</div>'
                  : '')+
              '</div>'+
            '</div>'+
          '</div>';
        }).join('')
      : '<div class="guidance-box">No National Growth Engine checkpoints are available.</div>';

    const action =
      ng.nextAction && typeof ng.nextAction==='object'
        ? ng.nextAction
        : null;

    const actionLabel =
      action&&action.label
        ? action.label
        : 'National workflow action unavailable';

    const actionDetail =
      action&&action.detail
        ? action.detail
        : 'No National workflow action has been supplied.';

    const actionState =
      action&&action.actionState
        ? action.actionState
        : 'blocked';

    const actionEnabled =
      Boolean(action&&action.enabled&&actionState==='ready');

    mainEl.innerHTML=
      '<div class="ci-hero">'+
        '<h3>National Growth Intelligence</h3>'+

      '<div id="verifiedNationalCompetitorIntelligence" class="ci-card" style="margin-top:14px">'+
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">'+
          '<div>'+
            '<div class="eyebrow">VERIFIED MARKET EVIDENCE</div>'+
            '<h3 style="margin-top:4px">National Competitor Intelligence</h3>'+
            '<p class="ci-narrative">Evidence-backed competitors using own-site commercial evidence and UK organic keyword intelligence.</p>'+
          '</div>'+
          '<div id="vnciStatus" class="status-pill">Loading…</div>'+
        '</div>'+

        '<div id="vnciMetrics" class="metric-grid" style="margin-top:14px"></div>'+

        '<div style="margin-top:16px">'+
          '<h4>Verified Direct Competitors</h4>'+
          '<div id="vnciDirect"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Adjacent Competitors</h4>'+
          '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Adjacent competitors show meaningful market overlap but do not meet the full verified direct-competitor threshold.</p>'+
          '<div id="vnciAdjacent"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Commercial Keyword Evidence</h4>'+
          '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Deduplicated persisted keyword evidence from verified competitors. No live DataForSEO search is executed here.</p>'+
          '<div id="vnciKeywordEvidence"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Market Opportunity Summary</h4>'+
          '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Commercial opportunities derived from persisted DataForSEO-ranked keyword evidence, positive/negative qualification and competitor overlap.</p>'+
          '<div id="moiSummary" class="metric-grid" style="margin-top:10px"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Top Market Opportunities</h4>'+
          '<div id="moiOpportunities"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Top Competitor Pages</h4>'+
          '<div id="moiPages"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Market Universe V2</h4>'+
          '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Expanded DataForSEO market universe groupings: untapped, weak coverage, new market, and authority/support topics.</p>'+
          '<div id="muv2Summary" class="metric-grid" style="margin-top:10px"></div>'+
          '<div id="muv2Groups" style="margin-top:10px"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Growth Plan Input</h4>'+
          '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Read-only contract view separating eligible Growth Plan opportunities from excluded, review and market-expansion evidence.</p>'+
          '<div id="gpiSummary" class="metric-grid" style="margin-top:10px"></div>'+
          '<div id="gpiGaps" class="metric-grid" style="margin-top:10px"></div>'+
        '</div>'+

        '<div style="margin-top:16px">'+
          '<h4>Growth Plan Intelligence</h4>'+
          '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Strategic action plan generated from the locked intelligence contract. No content is generated here.</p>'+
          '<div id="gpiv1Summary" class="metric-grid" style="margin-top:10px"></div>'+
          '<div id="gpiv1Actions" style="margin-top:10px"></div>'+
        '</div>'+

        '<div class="guidance-box" style="margin-top:14px">'+
          'Competitor qualification is based on commercial market fit, positive and negative keyword intent, UK ranking evidence and available own-site evidence. Industry relevance alone does not qualify a business as a direct competitor.'+
        '</div>'+
      '</div>'+
+
        '<p>National commercial intelligence for this customer — competitor discovery, website intelligence, search opportunity and national growth strategy. Local Google Places and healthcare-radius intelligence are intentionally excluded.</p>'+
        '<span class="ci-status">NATIONAL GROWTH PLATFORM</span>'+
      '</div>'+

      '<div class="ci-section">'+
        '<h4>Platform Classification</h4>'+
        '<div class="ci-exec-grid">'+
          '<div class="ci-exec-card"><div class="lbl">Growth Platform</div><div class="val">'+esc(ng.platform||'national')+'</div></div>'+
          '<div class="ci-exec-card"><div class="lbl">Commercial Market</div><div class="val">'+esc(ng.market||'United Kingdom')+'</div></div>'+
          '<div class="ci-exec-card"><div class="lbl">Target Market</div><div class="val">'+esc(ng.targetCustomer||'—')+'</div></div>'+
        '</div>'+
      '</div>'+

      '<div class="ci-section">'+
        '<h4>Local Intelligence</h4>'+
        '<p class="ci-narrative"><strong>Local Market Intelligence:</strong> '+esc(ng.localMarketIntelligence||'Not Applicable')+'</p>'+
        '<p class="ci-narrative"><strong>Google Places Local Discovery:</strong> '+esc(ng.googlePlacesCompetitorDiscovery||'Not Applicable')+'</p>'+
        '<p class="ci-narrative"><strong>Local Healthcare Intelligence:</strong> '+esc(ng.healthcareIntelligence||'Not Applicable')+'</p>'+
        '<p class="ci-narrative">A physical office location may exist, but it does not define the NATIONAL commercial competitor market.</p>'+
      '</div>'+

      '<div class="ci-section">'+
        '<h4>National Growth Engine Checkpoints</h4>'+
        '<div class="ci-exec-grid">'+stepHtml+'</div>'+
      '</div>'+

      '<div class="ci-section">'+
        '<h4>Next Action</h4>'+
        '<div class="ci-exec-card">'+
          '<div class="lbl">'+esc(actionState==='complete'?'Current Workflow State':'Recommended Workflow Action')+'</div>'+
          '<div class="val">'+esc(actionLabel)+'</div>'+
          '<div style="font-size:.7rem;color:#94a3b8;margin-top:6px;line-height:1.5">'+esc(actionDetail)+'</div>'+
        '</div>'+
        '<div class="guidance-box" style="margin-top:10px">The next intelligence stage must use NATIONAL competitor evidence. No Local Google Places competitor discovery will be executed.</div>'+
      '</div>'+

      '<div style="margin-top:12px">'+
        '<button class="btn secondary" type="button" onclick="closeCommercialIntelligenceReview()">Close Dashboard</button>'+
      '</div>';

    panelEl.innerHTML=
      '<h4>National Intelligence</h4>'+
      '<p style="font-size:.76rem;color:#94a3b8;line-height:1.5;margin-bottom:10px">The National Growth Platform is active for this customer.</p>'+
      '<div class="guidance-box" style="font-size:.72rem">Local Growth Engine: Not Applicable</div>'+
      '<div class="guidance-box" style="font-size:.72rem;margin-top:8px">National Competitor Intelligence: Required</div>'+
      '<button class="cqr-approve-btn" type="button" id="vnciReviewBtn" disabled style="margin-top:12px">'+
        'Review National Competitors'+
      '</button>'+
      '<div id="vnciReviewMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8">'+
        'Workflow control is visible but intentionally disabled until the live National Competitor Discovery execution route is implemented.'+
      '</div>';

    return;
  }
  const exec=dashboard.executiveSummary||{};
  const execHtml='<div class="ci-section"><h4>Executive Summary</h4><div class="ci-exec-grid">'+
    Object.entries({overallBusinessHealth:'Overall Business Health',biggestOpportunity:'Biggest Opportunity',biggestCommercialRisk:'Biggest Commercial Risk',strongestCompetitor:'Strongest Competitor',biggestLocalVisibilityGap:'Biggest Local Visibility Gap',biggestContentGap:'Biggest Content Gap',googleBusinessProfileStatus:'Google Business Profile',estimatedTrafficOpportunity:'Traffic Opportunity',estimatedEnquiryOpportunity:'Enquiry Opportunity',confidence:'Confidence'}).map(([k,l])=>'<div class="ci-exec-card"><div class="lbl">'+esc(l)+'</div><div class="val">'+esc(String(exec[k]||'Unknown'))+'</div></div>').join('')+
    '</div>'+ciEvidenceFoot(dashboard.sectionEvidence?.executiveSummary)+'</div>';
  const metrics=(dashboard.googleProfileMetrics||[]);
  const metricsHtml='<div class="ci-section"><h4>Google Profile Metrics</h4><p class="ci-narrative">Evidence-backed Google Business Profile comparison — your pharmacy vs local average vs highest nearby competitor.</p>'+
    ciMetricTable(metrics)+ciEvidenceFoot(dashboard.sectionEvidence?.googleProfileMetrics)+'</div>';
  const gapHtml='<div class="ci-section"><h4>Gap Analysis</h4><p class="ci-narrative">Commercial gaps measured against local benchmarks with recommended targets and PharmaConnect improvement actions.</p>'+
    (metrics.length?'<ul>'+metrics.map(m=>'<li><strong>'+esc(m.label)+'</strong> — Current: '+esc(m.yourPharmacy)+' · Average: '+esc(m.localAverage)+' · Gap: '+esc(m.gap)+' · Target: '+esc(m.recommendedTarget)+' · Sample: '+esc(m.sampleSizeLabel||(m.sampleSize!=null?('n='+m.sampleSize):'Not Available'))+'<br><span style="color:#94a3b8">'+esc(m.opportunity)+'</span></li>').join('')+'</ul>':'<p class="ci-narrative">Gap analysis pending local market evidence.</p>')+
    ciEvidenceFoot(dashboard.sectionEvidence?.googleProfileMetrics)+'</div>';
  const ca=dashboard.competitorAnalysis||{};
  const compRows=(ca.competitors||[]);
  const compSummary=ca.generated?ciCompSummaryHtml(ca.summary||dashboard.competitorSummary||[]):'';
  const providers=dashboard.analysisProviders||[];
  const organic=dashboard.organicSearchCompetitors||{};
  const organicEvidence=dashboard.organicSearchEvidence||{};
  const yourPharmacyRows=organicEvidence.yourPharmacy||[];
  const verifiedOrganicRows=organicEvidence.verifiedLocalCompetitorMatches||[];
  const widerOrganicRows=organicEvidence.widerOrganicLandscape||[];
  const stale=dashboard.staleCompletion||{};
  const canGenerate=Boolean(dashboard.canGenerateCompetitorAnalysis);
  const generateDisabled=Boolean(dashboard.activeCompetitorAnalysisJobId);
  const generateBtn=canGenerate?'<button class="btn secondary" type="button" data-generate-competitor-analysis="1" '+(generateDisabled?'disabled':'')+' onclick="generateCompetitorAnalysisFromCir()">Generate Competitor Analysis</button>':'';
  const providerHtml='<div class="ci-section"><h4>Analysis providers</h4>'+
    (dashboard.combinedCompetitorAnalysisStatus?'<p class="ci-narrative"><strong>Combined status:</strong> '+esc(dashboard.combinedCompetitorAnalysisStatus)+'</p>':'')+
    (providers.length?providers.map(function(p){return '<p class="ci-narrative"><strong>'+esc(p.label)+':</strong> '+esc(p.statusLabel)+(p.capturedAt?' · '+fmt(p.capturedAt):'')+' · '+esc(p.source||'')+(p.error?'<br><span style="color:#fca5a5">'+esc(p.error)+'</span>':'')+'</p>';}).join(''):'<p class="ci-narrative">Provider status unavailable.</p>')+
    '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Opening this dashboard does not start analysis. Generate queues one orchestrate_competitor_analysis job that runs Google Places local discovery and the existing DataForSEO organic-search adapter.</p></div>';
  const staleHtml=stale.flagged?'<div class="guidance-box" style="margin-bottom:10px">'+esc(stale.message||'Commercial Intelligence is marked complete, but Competitor Analysis evidence is missing.')+'</div>':'';
  const googleHtml='<div class="ci-section"><h4>Google/local competitors</h4>'+staleHtml+
    '<p class="ci-narrative"><strong>Analysis status:</strong> '+(ca.generated?'Generated':'Not generated')+(ca.evidenceTimestamp?' · '+fmt(ca.evidenceTimestamp):'')+' · '+esc(ca.discoverySource||'Google Places')+'</p>'+
    (dashboard.locality?.provenanceLabel?'<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Locality: '+esc(dashboard.locality.provenanceLabel)+'</p>':'')+
    (ca.generated?'<h5 style="font-size:.78rem;color:#cbd5e1;margin:8px 0 4px">Competitor Summary</h5>'+compSummary:'')+
    (ca.generated?(compRows.length?'<table class="audit-table"><thead><tr><th>Competitor</th><th>Rating</th><th>Reviews</th><th>Distance</th><th>Address</th><th>Categories</th><th>Phone</th><th>Website</th><th>Maps</th><th>Place ID</th><th>Evidence</th><th>Confidence</th></tr></thead><tbody>'+
    compRows.map(c=>'<tr><td>'+esc(c.name||'')+'</td><td>'+esc(c.rating||'Not Available')+'</td><td>'+esc(c.reviews||'Not Available')+'</td><td>'+esc(c.distance||'Not Available')+'</td><td>'+esc(c.address||'Not Available')+'</td><td>'+esc(c.categories||'Not Available')+'</td><td>'+esc(c.phone||'Not Available')+'</td><td>'+esc(c.website||'Not Available')+'</td><td>'+esc(c.maps||'Not Available')+'</td><td>'+esc(c.placeId||'Not Available')+'</td><td>'+esc(c.evidence||'Not Available')+'</td><td>'+esc(c.confidence||'Not Available')+'</td></tr>').join('')+'</tbody></table>':'<p class="ci-narrative">Google/local competitor analysis generated but no competitors returned.</p>'):
    '<p class="ci-narrative"><strong>Google/local competitor analysis not yet generated</strong></p><p class="ci-narrative">Action: Generate Competitor Analysis to load real nearby pharmacy evidence.</p>'+generateBtn)+ciEvidenceFoot(ca.evidence||dashboard.sectionEvidence?.competitorAnalysis)+'</div>';
  function organicEvidenceTable(rows){
    if(!rows.length) return '';
    return '<table class="audit-table"><thead><tr><th>Domain</th><th>URL</th><th>Position</th><th>Matched query</th><th>Title</th><th>Description</th><th>Evidence</th><th>Source</th><th>Captured</th><th>Classification</th></tr></thead><tbody>'+
      rows.map(c=>'<tr><td>'+esc(c.domain||c.host||'')+'</td><td>'+esc(c.url||'')+'</td><td>'+esc(c.position==null?'':String(c.position))+'</td><td>'+esc(c.matchedQuery||'')+'</td><td>'+esc(c.title||c.name||'')+'</td><td>'+esc(c.description||'')+'</td><td>'+esc(c.evidence||'')+'</td><td>'+esc(c.source||'')+'</td><td>'+esc(c.capturedAt?fmt(c.capturedAt):'')+'</td><td>'+esc(c.classificationLabel||'')+'</td></tr>').join('')+'</tbody></table>';
  }
  const organicGenerated=Boolean(organicEvidence.generated||organic.generated||(organicEvidence.rows||[]).length);
  const organicHtml='<div class="ci-section"><h4>Organic Search Evidence — DataForSEO</h4>'+
    '<p class="ci-narrative"><strong>Analysis status:</strong> '+esc(organicEvidence.statusLabel||organic.statusLabel||(organicGenerated?'completed':'not generated'))+(organicEvidence.capturedAt||organic.capturedAt?' · '+fmt(organicEvidence.capturedAt||organic.capturedAt):'')+' · '+esc(organicEvidence.provider||organic.provider||'dataforseo-google-organic-live')+(organicEvidence.locationName||organic.locationName?' · '+esc(organicEvidence.locationName||organic.locationName):'')+(organicEvidence.languageCode||organic.languageCode?' · '+esc(organicEvidence.languageCode||organic.languageCode):'')+'</p>'+
    '<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Google Places remains the only source of nearby physical competitors. These rows are stored organic-search evidence, matched by canonical website domain only.</p>'+
    ((organicEvidence.error||organic.error)?'<p class="ci-narrative" style="color:#fca5a5">'+esc(organicEvidence.error||organic.error)+'</p>':'')+
    (organicGenerated?
      '<h5 style="font-size:.78rem;color:#cbd5e1;margin:8px 0 4px">Your Pharmacy</h5>'+(yourPharmacyRows.length?organicEvidenceTable(yourPharmacyRows):'<p class="ci-narrative">No tenant pages appeared in the stored organic-search results.</p>')+
      '<h5 style="font-size:.78rem;color:#cbd5e1;margin:8px 0 4px">Verified Local Competitor Matches</h5>'+(verifiedOrganicRows.length?organicEvidenceTable(verifiedOrganicRows):'<p class="ci-narrative">No stored organic-search rows match a verified Google Places competitor website domain.</p>')+
      '<h5 style="font-size:.78rem;color:#cbd5e1;margin:8px 0 4px">Wider Organic Landscape</h5>'+(widerOrganicRows.length?organicEvidenceTable(widerOrganicRows):'<p class="ci-narrative">No wider organic-search landscape rows were stored.</p>'):
    '<p class="ci-narrative"><strong>Organic Search Evidence — DataForSEO not yet generated</strong></p><p class="ci-narrative">Organic-search domains are not treated as nearby physical pharmacies unless Google Places separately verifies that relationship.</p>'+(ca.generated||canGenerate?generateBtn:''))+'</div>';
  const compHtml=providerHtml+googleHtml+organicHtml;
  const traffic=dashboard.trafficOpportunity||{};
  const trafficHtml='<div class="ci-section"><h4>Traffic Opportunity</h4><p class="ci-narrative">'+esc(traffic.summary||'Search demand not yet available.')+'</p>'+
    ((traffic.keywords||[]).length?'<ul>'+traffic.keywords.map(k=>'<li><strong>'+esc(k.keyword)+'</strong> — '+esc(k.searchDemand)+' · Provenance: '+esc(k.provenance)+'</li>').join('')+'</ul>':'')+
    ciEvidenceFoot(traffic.evidence||dashboard.sectionEvidence?.trafficOpportunity)+'</div>';
  const lm=(dashboard.localMarketIntelligence?.sections||[]).map(s=>ciSection(s.title,s.narrative,s.items,s.evidence)).join('');
  // Growth Intelligence: render the complete stored opportunities list (no section slices / no duplicate Missing Content).
  const gi=renderGrowthIntelligenceComplete(dashboard);
  const pg=dashboard.previouslyGenerated||{};
  const prevHtml=pg.historicalAccidental?'<div class="ci-section"><h4>Historical Package Exists</h4><p class="ci-narrative">A historical ecosystem package was generated on <strong>'+esc(pg.completedAt?fmt(pg.completedAt):'—')+'</strong> before Commercial Intelligence approval. It is preserved for audit and is <strong>not Product Owner-authorised</strong>.</p><div class="ci-stats">'+
    [{n:pg.pages,l:'Pages'},{n:pg.locationPages,l:'Location Pages'},{n:pg.blogs,l:'Blogs'},{n:pg.guides,l:'Guides'},{n:pg.faqs,l:'FAQs'},{n:pg.images,l:'Images'}].map(s=>'<div class="ci-stat"><div class="n">'+esc(String(s.n||0))+'</div><div class="l">'+esc(s.l)+'</div></div>').join('')+'</div><p class="ci-narrative" style="margin-top:8px">Status: <strong>Not Product Owner-authorised</strong> · Action after approval: Generate Approved Ecosystem</p></div>':'';
  const issuesHtml=ciIssueBlock('block','Blocking Issues',dashboard.blockingIssues)+ciIssueBlock('rec','Recommendations',dashboard.recommendations)+ciIssueBlock('hist','Historical Events',dashboard.historicalEvents);
  mainEl.innerHTML=
    '<div class="ci-hero"><h3>Commercial Intelligence Dashboard</h3><p>Where you are now, what PharmaConnect discovered, why it matters, and what should happen next — one commercial decision before ecosystem generation.</p><span class="ci-status">'+esc(dashboard.statusLabel||'')+'</span></div>'+
    (dashboard.legacyAutoAdvance&&dashboard.legacyLabel?'<div class="guidance-box">'+esc(dashboard.legacyLabel)+'</div>':'')+
    execHtml+metricsHtml+gapHtml+compHtml+trafficHtml+'<div class="ci-section"><h4>Local Market Intelligence</h4>'+lm+ciEvidenceFoot(dashboard.sectionEvidence?.localMarketIntelligence)+'</div>'+'<div class="ci-section"><h4>Growth Intelligence</h4>'+gi+ciEvidenceFoot(dashboard.sectionEvidence?.growthIntelligence)+'</div>'+prevHtml+issuesHtml+
    '<button class="btn secondary" type="button" style="margin-top:8px;font-size:.72rem" onclick="toggleCiTechnicalLog()">View Technical Log</button>'+
    '<div class="ci-tech-log" id="cirTechnicalLog">'+(dashboard.technicalLog||[]).map(l=>'<div style="margin:4px 0">'+fmt(l.timestamp)+' · '+esc(l.label)+' · '+esc(l.detail)+'</div>').join('')+'</div>'+
    '<div style="margin-top:12px"><button class="btn secondary" type="button" onclick="closeCommercialIntelligenceReview()">Close Dashboard</button></div>';
  panelEl.innerHTML=
    '<h4>Commercial Decision</h4>'+
    '<p style="font-size:.76rem;color:#94a3b8;line-height:1.5;margin-bottom:10px">Review all intelligence above, then approve one commercial decision to continue.</p>'+
    (dashboard.approval&&dashboard.approval.approvedAt?'<div class="guidance-box" style="font-size:.72rem">Approved '+fmt(dashboard.approval.approvedAt)+(dashboard.approval.approvedBy?' by '+esc(dashboard.approval.approvedBy):'')+'</div>':'')+
    '<button class="cqr-approve-btn" type="button" id="cirApproveBtn" onclick="approveCommercialIntelligenceReview()" '+(dashboard.canApprove?'':'disabled')+'>Approve Intelligence</button>'+
    (dashboard.approved?'<button class="cqr-publish-btn" type="button" id="cirGenerateBtn" onclick="openCommercialEcosystemGenerationFromCi()">Generate Approved Ecosystem</button>':'')+
    (pg.historicalAccidental&&!dashboard.approved?'<p style="font-size:.68rem;color:#64748b;margin-top:8px">Historical package preserved for audit — approve intelligence first, then generate the first authorised ecosystem.</p>':'')+
    (dashboard.approved?'<p style="font-size:.68rem;color:#64748b;margin-top:8px">Intelligence approved — open Generation Readiness to confirm the first Product Owner-authorised ecosystem.</p>':'')+
    '<div id="cirMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8">'+(dashboard.approved?'Approved — continue to Generate Approved Ecosystem when ready.':(dashboard.blockingIssues||[]).map(b=>b.title).join(' · ')||'')+'</div>';
}
function toggleCiTechnicalLog(){const el=document.getElementById('cirTechnicalLog');if(el)el.classList.toggle('open')}
async function openCommercialIntelligenceReview(){
  if(!activeCustomer){
    toast('Select a customer to open Competitor Analysis.',true);
    throw new Error('Select a customer to open Competitor Analysis.');
  }
  const p=new URLSearchParams(location.search);
  p.set('customer',activeCustomer.slug);
  p.set('panel','commercial-intelligence');
  history.replaceState(null,'',location.pathname+'?'+p.toString());
  document.getElementById('customerModal').classList.remove('open');
  document.getElementById('cirModal').classList.add('open');
  document.getElementById('cirLoading').style.display='block';
  document.getElementById('cirContent').style.display='none';
  document.getElementById('cirError').style.display='none';
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-intelligence-dashboard');
    if(!data.dashboard)throw new Error('Dashboard payload missing');
    document.getElementById('cirLoading').style.display='none';
    document.getElementById('cirContent').style.display='block';
    renderCommercialIntelligenceDashboard(data.dashboard);
    if(data.customer)activeCustomer=data.customer;
  }catch(e){
    document.getElementById('cirLoading').style.display='none';
    document.getElementById('cirError').style.display='block';
    document.getElementById('cirErrorDetail').textContent=e.message||String(e);
  }
}
let competitorAnalysisGenerateInFlight=false;
async function generateCompetitorAnalysisFromCir(){
  if(!activeCustomer){
    toast('Select a customer to generate Competitor Analysis.',true);
    return;
  }
  if(competitorAnalysisGenerateInFlight)return;
  competitorAnalysisGenerateInFlight=true;
  document.querySelectorAll('[data-generate-competitor-analysis]').forEach(function(btn){btn.disabled=true});
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-intelligence-dashboard/generate-competitor-analysis',{method:'POST',body:'{}'});
    if(data.customer)activeCustomer=data.customer;
    toast(data.evidence||(data.idempotent?'Competitor Analysis already in progress':'Competitor Analysis queued'));
    if(data.async&&data.jobId)startJobPolling();
    if(data.dashboard)renderCommercialIntelligenceDashboard(data.dashboard);
    else await openCommercialIntelligenceReview();
  }catch(e){
    const msg=e&&e.message?e.message:String(e);
    toast(msg,true);
    const errEl=document.getElementById('cirError');
    const detail=document.getElementById('cirErrorDetail');
    if(errEl)errEl.style.display='block';
    if(detail)detail.textContent=msg;
    document.querySelectorAll('[data-generate-competitor-analysis]').forEach(function(btn){btn.disabled=false});
  }finally{
    competitorAnalysisGenerateInFlight=false;
  }
}
function closeCommercialIntelligenceReview(){
  document.getElementById('cirModal').classList.remove('open');
  document.getElementById('cirLoading').style.display='block';
  document.getElementById('cirContent').style.display='none';
  document.getElementById('cirError').style.display='none';
  activeCirDashboard=null;
  const p=new URLSearchParams(location.search);
  if(p.get('panel')==='commercial-intelligence'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
  if(activeCustomer){
    document.getElementById('customerModal').classList.add('open');
    renderCustomerDetail(activeCustomer);
  }
}
async function approveCommercialIntelligenceReview(){
  if(!activeCustomer||!activeCirDashboard)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-intelligence-dashboard/approve',{method:'POST',body:'{}'});
    toast('Commercial Intelligence approved');
    if(data.customer)activeCustomer=data.customer;
    if(data.dashboard)renderCommercialIntelligenceDashboard(data.dashboard);
    closeCommercialIntelligenceReview();
    await loadDashboard();
  }catch(e){toast(e.message,true)}
}
function openCommercialEcosystemGenerationFromCi(){
  if(!activeCustomer)return;
  closeCommercialIntelligenceReview();
  openCommercialEcosystemGeneration();
}
async function confirmGenerateEcosystemFromCi(){
  openCommercialEcosystemGenerationFromCi();
}
function customerAtBusinessProfileReview(c){
  return c.workflow&&['business_profile_intelligence','resolve_import_conflicts','approve_business_profile'].includes(c.workflow.currentStage);
}
function businessProfileReviewOpenAllowed(c){
  if(customerAtBusinessProfileReview(c))return true;
  const state=c&&c.businessProfileReview&&c.businessProfileReview.summary&&c.businessProfileReview.summary.googleProfileState;
  return state==='deferred'||state==='no_profile';
}
function customerAtQualityReview(c){
  const stage=c.currentStage||c.workflow?.currentStage||'';
  return stage==='quality_review';
}
function customerAtManagedPublishing(c){
  const stage=c.currentStage||c.workflow?.currentStage||'';
  return stage==='publish';
}
function customerAtDeploymentConfiguration(c){
  return false;
}
function selectedCampaignPublishReady(c){
  // CPR-PUBLISH-STATE-HOTFIX-01 — subsequent releases use campaign-scoped readiness,
  // not tenant workflow stage left behind by a prior release (e.g. request_indexing).
  const camp=c&&(c.selectedServiceCampaign||(c.serviceCampaigns||[]).find(function(x){return x.selected;}));
  return Boolean(camp&&camp.content&&camp.content.publishing&&camp.content.publishing.ready);
}
function customerAtPublishReview(c){
  if(selectedCampaignPublishReady(c))return true;
  const stage=c.currentStage||c.workflow?.currentStage||'';
  if(stage!=='publish')return false;
  if(customerAtCoreProductRecovery(c)&&!c.coreProductRecovery?.clusterReviewApproved)return false;
  return true;
}
function customerAtGenerateEcosystem(c){
  const stage=c.currentStage||c.workflow?.currentStage||'';
  if(customerAtCoreProductRecovery(c)){
    if(stage!=='generate_ecosystem')return false;
    if(!c.coreProductRecovery?.servicePageGenerated)return true;
    return Boolean(c.coreProductRecovery?.clusterEligible);
  }
  return stage==='generate_ecosystem';
}
function customerAtCoreProductRecovery(c){
  return Boolean(c&&c.coreProductRecovery&&c.coreProductRecovery.enabled);
}
function customerAtServicePageReview(c){
  return customerAtCoreProductRecovery(c)&&Boolean(c.coreProductRecovery?.servicePageGenerated)&&!c.coreProductRecovery?.servicePageReviewApproved;
}
function customerAtCprClusterGeneration(c){
  return customerAtCoreProductRecovery(c)&&Boolean(c.coreProductRecovery?.clusterEligible);
}
function customerAtCprClusterReview(c){
  return customerAtCoreProductRecovery(c)&&Boolean(c.coreProductRecovery?.clusterReviewPending||(c.coreProductRecovery?.clusterComplete&&!c.coreProductRecovery?.clusterReviewApproved));
}
function openCprClusterGenerationFromBanner(){
  if(!activeCustomer||!activeCustomer.coreProductRecovery?.clusterEligible)return;
  continueWorkflow('generate_local_cluster_pages');
}
let activeCprClusterReview=null;
let cprClusterPageDecisions={};
function renderClusterPageReview(review){
  activeCprClusterReview=review;
  const pages=review.pages||[];
  cprClusterPageDecisions={};
  pages.forEach(function(p){
    cprClusterPageDecisions[p.areaSlug]=p.decision||'pending';
  });
  const candidateAuthority=Boolean(review.candidateAuthority);
  document.getElementById('cprClusterReviewHero').innerHTML=
    '<h4>Review Locality Pages</h4>'+
    '<div style="font-size:.78rem;color:#94a3b8;margin-bottom:10px">'+(candidateAuthority?'Candidate-service approvals from Review Centre are the publish authority.':'Generated locality pages are ready for Product Owner review.')+'</div>'+
    '<div class="cqr-overall '+(review.reviewStatus==='approved'?'ready':'blocked')+'">Review Status: '+esc(review.reviewStatus||'pending')+' · '+esc(String(review.approvedLocalityCount||0))+' / '+esc(String(pages.length))+' localities approved</div>';
  document.getElementById('cprClusterReviewPages').innerHTML=pages.length
    ?pages.map(function(p){
      const decision=cprClusterPageDecisions[p.areaSlug]||'pending';
      const statusLabel=decision==='approved'?'Approved':decision==='rejected'?'Rejected':'Pending review';
      const statusColor=decision==='approved'?'#4ade80':decision==='rejected'?'#f87171':'#94a3b8';
      const slugAttr=esc(p.areaSlug||'');
      return '<div style="margin:10px 0;padding:10px;border:1px solid #334155;border-radius:8px;font-size:.78rem">'+
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'+
        '<strong>'+esc(p.label||p.areaSlug)+'</strong>'+
        '<span style="color:'+statusColor+';font-size:.7rem">'+esc(statusLabel)+'</span></div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:6px">'+
        '<a class="btn secondary" href="'+esc(withAuthHandoff(withCustomerSlug(p.previewUrl||'#')))+'" target="_blank" rel="noopener" style="font-size:.68rem;text-decoration:none">Open Preview</a>'+
        (candidateAuthority?'':
        '<button class="btn secondary" type="button" style="font-size:.68rem" id="cprRegen_'+slugAttr+'" onclick="regenerateOneCampaignLocalityPage(\\''+slugAttr+'\\')">Regenerate Individual Page</button>'+
        '<button class="btn secondary" type="button" style="font-size:.68rem" onclick="decideClusterLocalityPage(\\''+slugAttr+'\\',\\'approved\\')">Approve</button>'+
        '<button class="btn secondary" type="button" style="font-size:.68rem" onclick="decideClusterLocalityPage(\\''+slugAttr+'\\',\\'rejected\\')">Reject</button>')+
        '<button class="btn secondary" type="button" style="font-size:.68rem" onclick="returnToCampaignFromClusterReview()">Return to Campaign</button>'+
        '</div></div>';
    }).join('')
    :'<div class="empty">No cluster page previews available</div>';
  document.getElementById('cprClusterReviewJob').innerHTML=
    '<div style="font-size:.72rem"><strong>Completed job:</strong> '+esc(review.completedJobId||'—')+'</div>'+
    '<div style="font-size:.72rem"><strong>Pages:</strong> '+esc(String(review.pageCount||pages.length||0))+'</div>'+
    '<div style="font-size:.72rem"><strong>Service:</strong> '+esc(review.serviceId||'—')+'</div>'+
    (candidateAuthority?'':'<div style="margin-top:10px"><button class="btn secondary" type="button" id="cprRegenAllBtn" style="width:100%;font-size:.72rem" onclick="regenerateAllCampaignLocalityPages()">Regenerate All Locality Pages</button></div>')+
    '<div id="cprLocalityJobStatus" style="font-size:.68rem;color:#94a3b8;margin-top:8px"></div>';
  const approvedCount=pages.filter(function(p){return cprClusterPageDecisions[p.areaSlug]==='approved'}).length;
  const remainingCount=pages.length-approvedCount;
  document.getElementById('cprClusterReviewPanelStats').innerHTML=
    '<p class="ci-narrative">'+(review.reviewStatus==='approved'?'Cluster pages approved — publish review can proceed.':'Review every locality preview. Publishing stays blocked until clusters are approved.')+'</p>'+
    '<div class="bpr-panel-stat" style="margin-top:8px"><div class="lbl">Localities reviewed</div><div style="font-weight:800">'+(approvedCount+' / '+pages.length)+'</div></div>'+
    (remainingCount>=2?'<div class="bpr-panel-stat" style="margin-top:8px"><div class="lbl">Remaining to approve</div><div style="font-weight:800">'+remainingCount+'</div></div>':'');
  const box=document.getElementById('cprClusterApproveCheckbox');
  if(box)box.checked=false;
  const bulkWrap=document.getElementById('cprClusterBulkApproveWrap');
  if(bulkWrap)bulkWrap.style.display=remainingCount>=2?'block':'none';
  updateCprClusterApproveState();
}
async function decideClusterLocalityPage(areaSlug,decision){
  if(!activeCustomer||!activeCprClusterReview||!areaSlug)return;
  const next=decision==='rejected'?'rejected':'approved';
  if(next==='approved'&&!window.confirm('Approve locality page '+areaSlug+' for this campaign only? This does not publish and does not approve other localities.'))return;
  if(next==='rejected'&&!window.confirm('Mark locality page '+areaSlug+' as Needs Changes?'))return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/cluster-page-review/localities/'+encodeURIComponent(areaSlug)+'/decide',{method:'POST',body:JSON.stringify({
      operatorConfirmed:true,
      decision:next,
      campaignId:activeCprClusterReview.campaignId||'',
      serviceId:activeCprClusterReview.serviceId||''
    })});
    if(data.review)renderClusterPageReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    toast(next==='rejected'?'Locality marked Needs Changes':'Locality approved');
  }catch(e){
    toast(e.message||String(e),true);
  }
}
function updateCprClusterApproveState(){
  const btn=document.getElementById('cprClusterApproveBtn');
  const box=document.getElementById('cprClusterApproveCheckbox');
  if(!btn||!box||!activeCprClusterReview)return;
  const pages=activeCprClusterReview.pages||[];
  const remaining=pages.filter(function(p){return cprClusterPageDecisions[p.areaSlug]!=='approved'}).length;
  const campaignScoped=Boolean(activeCprClusterReview.campaignId&&activeCprClusterReview.serviceId);
  const canBulk=campaignScoped&&remaining>=2&&activeCprClusterReview.canApprove!==false;
  btn.textContent='Approve All Remaining Locality Pages ('+remaining+')';
  btn.style.display=remaining>=2?'inline-block':'none';
  const bulkWrap=document.getElementById('cprClusterBulkApproveWrap');
  if(bulkWrap)bulkWrap.style.display=remaining>=2?'block':'none';
  // Visible whenever 2+ remain for this campaign; enabled after Product Owner confirmation checkbox.
  btn.disabled=!canBulk||!box.checked;
}
async function approveClusterPageReview(){
  if(!activeCustomer||!activeCprClusterReview)return;
  const pages=activeCprClusterReview.pages||[];
  const remaining=pages.filter(function(p){return (cprClusterPageDecisions[p.areaSlug]||p.decision)!=='approved'}).length;
  if(remaining>0&&!window.confirm('Approve all '+remaining+' remaining locality pages for this campaign only? Already approved localities stay approved. This does not publish.'))return;
  const btn=document.getElementById('cprClusterApproveBtn');
  if(btn)btn.disabled=true;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/cluster-page-review/approve',{method:'POST',body:JSON.stringify({
      operatorConfirmed:true,
      campaignId:activeCprClusterReview.campaignId||'',
      serviceId:activeCprClusterReview.serviceId||''
    })});
    toast(remaining>0?'Remaining locality pages approved':'Cluster pages approved');
    if(data.review)renderClusterPageReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
  }catch(e){
    toast(e.message||String(e),true);
    updateCprClusterApproveState();
  }
}
function rejectClusterPageReview(){
  toast('Cluster set marked Needs Changes — return to campaign and re-open after updates.',true);
  const msg=document.getElementById('cprClusterMsg');
  if(msg)msg.textContent='Needs Changes recorded for Product Owner follow-up.';
}
function returnToCampaignFromClusterReview(){
  closeClusterPageReview();
  if(activeCustomer){
    try{renderCustomerDetail(activeCustomer)}catch(e){}
    const el=document.getElementById('detailSpgBanner')||document.getElementById('serviceCampaignsPanel');
    if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'start'});
  }
  toast('Returned to campaign');
}
async function openClusterPageReview(){
  if(!activeCustomer){toast('Select a customer first.',true);return;}
  const camp=selectedCampaignRef();
  const campaignId=(camp&&camp.campaignId)||activeCustomer.selectedCampaignId||'';
  const serviceId=(camp&&camp.serviceId)||'';
  if(!campaignId){toast('Select a service campaign first.',true);return;}
  document.getElementById('cprClusterReviewModal').classList.add('open');
  document.getElementById('cprClusterReviewLoading').style.display='block';
  document.getElementById('cprClusterReviewContent').style.display='none';
  document.getElementById('cprClusterReviewError').style.display='none';
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('campaignId',campaignId);p.set('panel','cluster-page-review');history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const q=new URLSearchParams();
    q.set('campaignId',campaignId);
    if(serviceId)q.set('serviceId',serviceId);
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/cluster-page-review?'+q.toString());
    renderClusterPageReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    document.getElementById('cprClusterReviewLoading').style.display='none';
    document.getElementById('cprClusterReviewContent').style.display='block';
  }catch(e){
    document.getElementById('cprClusterReviewLoading').style.display='none';
    document.getElementById('cprClusterReviewError').style.display='block';
    document.getElementById('cprClusterReviewErrorDetail').textContent=e.message||String(e);
  }
}
function closeClusterPageReview(){
  document.getElementById('cprClusterReviewModal').classList.remove('open');
  activeCprClusterReview=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='cluster-page-review'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
let activeCampaignLocalitySelection=null;
let localityJobInFlight=false;
function selectedCampaignRef(){
  return activeCustomer&&(activeCustomer.selectedServiceCampaign||(activeCustomer.serviceCampaigns||[]).find(function(x){return x.selected||x.campaignId===activeCustomer.selectedCampaignId;}))||null;
}
async function openCampaignLocalitySelection(){
  if(!activeCustomer)return;
  const camp=selectedCampaignRef();
  if(!camp||!camp.campaignId){toast('Select a service campaign first.',true);return;}
  document.getElementById('campaignLocalityModal').classList.add('open');
  document.getElementById('campaignLocalityLoading').style.display='block';
  document.getElementById('campaignLocalityContent').style.display='none';
  document.getElementById('campaignLocalityError').style.display='none';
  setWorkflowPanelUrl('campaign-locality-selection');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/campaigns/'+encodeURIComponent(camp.campaignId)+'/locality-selection');
    activeCampaignLocalitySelection=data.selection;
    renderCampaignLocalitySelection(data.selection);
    document.getElementById('campaignLocalityLoading').style.display='none';
    document.getElementById('campaignLocalityContent').style.display='block';
  }catch(e){
    document.getElementById('campaignLocalityLoading').style.display='none';
    document.getElementById('campaignLocalityError').style.display='block';
    document.getElementById('campaignLocalityErrorDetail').textContent=e.message||String(e);
  }
}
function closeCampaignLocalitySelection(){
  document.getElementById('campaignLocalityModal').classList.remove('open');
  activeCampaignLocalitySelection=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='campaign-locality-selection'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
function renderCampaignLocalitySelection(selection){
  const areas=selection.availableAreas||[];
  document.getElementById('campaignLocalityList').innerHTML=areas.length
    ?areas.map(function(a,idx){
      const id='locArea_'+idx;
      return '<label class="check-row" style="display:flex;gap:8px;align-items:flex-start;margin:6px 0;font-size:.78rem;cursor:pointer"><input type="checkbox" id="'+id+'" data-area-name="'+esc(a.areaName)+'" data-area-source="'+esc(a.source||'product-owner-selection')+'" data-area-priority="'+esc(String(a.priority||50))+'" '+(a.selected?'checked':'')+' onchange="updateCampaignLocalitySummary()"/><span>'+esc(a.areaName)+'<div style="font-size:.68rem;color:#64748b">'+esc(a.source||'campaign')+'</div></span></label>';
    }).join('')
    :'<div class="empty">No locality areas available from Business Profile. Approve area discovery first.</div>';
  updateCampaignLocalitySummary();
  const genBtn=document.getElementById('campaignLocalityGenerateBtn');
  if(genBtn){
    genBtn.disabled=!selection.canGenerateLocalities||localityJobInFlight;
    genBtn.textContent=selection.hasLocalPages?'Regenerate All Locality Pages':'Generate Locality Pages';
  }
}
function collectCampaignLocalityAreasFromUi(){
  return Array.prototype.slice.call(document.querySelectorAll('#campaignLocalityList input[type=checkbox]')).map(function(el){
    return {
      areaName:el.getAttribute('data-area-name')||'',
      selected:!!el.checked,
      source:el.getAttribute('data-area-source')||'product-owner-selection',
      priority:Number(el.getAttribute('data-area-priority')||50)
    };
  }).filter(function(a){return a.areaName;});
}
function updateCampaignLocalitySummary(){
  const selected=collectCampaignLocalityAreasFromUi().filter(function(a){return a.selected;});
  const el=document.getElementById('campaignLocalitySelectedSummary');
  if(el){
    el.innerHTML='<strong>Selected Locality Areas ('+selected.length+'):</strong> '+(selected.length?esc(selected.map(function(a){return a.areaName;}).join(', ')):'none');
  }
}
async function saveCampaignLocalitySelection(){
  if(!activeCustomer)return;
  const camp=selectedCampaignRef();
  if(!camp)return;
  const areas=collectCampaignLocalityAreasFromUi();
  if(!areas.some(function(a){return a.selected;})){toast('Select at least one locality area.',true);return;}
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/campaigns/'+encodeURIComponent(camp.campaignId)+'/locality-selection',{method:'POST',body:JSON.stringify({areas:areas})});
    activeCampaignLocalitySelection=data.selection;
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer);}
    renderCampaignLocalitySelection(data.selection);
    toast('Campaign locality selection saved');
  }catch(e){toast(e.message||String(e),true);}
}
async function pollLocalityJob(jobId,statusEl){
  if(!jobId)return;
  for(let i=0;i<90;i++){
    try{
      const data=await api('/api/master-admin-platform/jobs/'+encodeURIComponent(jobId));
      const job=data.job||{};
      if(statusEl)statusEl.textContent='Job '+esc(job.status||'queued')+(job.progressLabel?(' · '+job.progressLabel):'');
      if(job.status==='completed'||job.status==='failed'||job.status==='cancelled'){
        localityJobInFlight=false;
        if(job.status==='completed')toast('Locality job completed');
        else toast(job.error||'Locality job failed',true);
        if(document.getElementById('cprClusterReviewModal')&&document.getElementById('cprClusterReviewModal').classList.contains('open')){
          try{await openClusterPageReview();}catch(_e){}
        }
        if(activeCustomer){
          try{
            const fresh=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/select-campaign',{method:'POST',body:JSON.stringify({campaignId:(selectedCampaignRef()||{}).campaignId})});
            if(fresh.customer){activeCustomer=fresh.customer;renderCustomerDetail(fresh.customer);}
          }catch(_e){}
        }
        return;
      }
    }catch(_e){}
    await new Promise(function(r){setTimeout(r,2000);});
  }
  localityJobInFlight=false;
}
async function generateCampaignLocalityPages(){
  if(!activeCustomer||localityJobInFlight)return;
  const camp=selectedCampaignRef();
  if(!camp)return;
  if(!window.confirm('Generate locality pages for '+camp.serviceName+' using this campaign’s selected locality areas? This creates one job and does not publish.'))return;
  localityJobInFlight=true;
  const statusEl=document.getElementById('campaignLocalityMsg');
  const genBtn=document.getElementById('campaignLocalityGenerateBtn');
  if(genBtn){genBtn.disabled=true;genBtn.textContent='Generating Locality Pages…';}
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/locality-pages/generate',{method:'POST',body:JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard',campaignId:camp.campaignId,serviceId:camp.serviceId})});
    if(statusEl)statusEl.textContent='Queued job '+(data.jobId||'');
    await pollLocalityJob(data.jobId,statusEl);
  }catch(e){
    localityJobInFlight=false;
    if(genBtn){genBtn.disabled=false;genBtn.textContent='Generate Locality Pages';}
    toast(e.message||String(e),true);
  }
}
async function regenerateAllCampaignLocalityPages(){
  if(!activeCustomer||localityJobInFlight)return;
  const camp=selectedCampaignRef();
  if(!camp)return;
  if(!window.confirm('Regenerate ALL locality pages for '+camp.serviceName+'? Existing previews stay until the new revision succeeds. One job only. No auto-approve or publish.'))return;
  localityJobInFlight=true;
  const statusEl=document.getElementById('cprLocalityJobStatus')||document.getElementById('campaignLocalityMsg');
  const btn=document.getElementById('cprRegenAllBtn')||document.getElementById('campaignLocalityGenerateBtn');
  if(btn){btn.disabled=true;btn.textContent='Regenerating…';}
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/locality-pages/regenerate-all',{method:'POST',body:JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard',campaignId:camp.campaignId,serviceId:camp.serviceId})});
    if(statusEl)statusEl.textContent='Queued job '+(data.jobId||'');
    await pollLocalityJob(data.jobId,statusEl);
  }catch(e){
    localityJobInFlight=false;
    if(btn){btn.disabled=false;btn.textContent='Regenerate All Locality Pages';}
    toast(e.message||String(e),true);
  }
}
async function regenerateOneCampaignLocalityPage(areaSlug){
  if(!activeCustomer||localityJobInFlight||!areaSlug)return;
  const camp=selectedCampaignRef();
  if(!camp)return;
  if(!window.confirm('Regenerate only '+areaSlug+' for '+camp.serviceName+'? Other localities and the service page will not be regenerated.'))return;
  localityJobInFlight=true;
  const btn=document.getElementById('cprRegen_'+areaSlug);
  if(btn){btn.disabled=true;btn.textContent='Regenerating…';}
  const statusEl=document.getElementById('cprLocalityJobStatus');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/locality-pages/regenerate-one',{method:'POST',body:JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard',campaignId:camp.campaignId,serviceId:camp.serviceId,areaSlug:areaSlug})});
    if(statusEl)statusEl.textContent='Queued job '+(data.jobId||'')+' for '+areaSlug;
    await pollLocalityJob(data.jobId,statusEl);
  }catch(e){
    localityJobInFlight=false;
    if(btn){btn.disabled=false;btn.textContent='Regenerate Individual Page';}
    toast(e.message||String(e),true);
  }
}
async function regenerateServicePageFromSpg(){
  if(!activeCustomer||!activeSpgDashboard||spgGenerationInFlight)return;
  if(!window.confirm('Regenerate the service page using current approved evidence? Previous revision is preserved until the new page succeeds. Returns to Service Page Review. Does not publish.'))return;
  const box=document.getElementById('spgConfirmCheckbox');
  if(box){box.disabled=false;box.checked=true;}
  const msgEl=document.getElementById('spgMsg');
  const regenBtn=document.getElementById('spgRegenerateBtn');
  if(regenBtn){regenBtn.disabled=true;regenBtn.textContent='Regenerating…';}
  spgGenerationInFlight=true;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-generation/confirm',{method:'POST',body:JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard',regenerate:true})});
    if(msgEl)msgEl.textContent=data.jobId?('Regeneration job created — '+data.jobId):'Regeneration queued';
    if(data.jobId)startSpgJobPolling(data.jobId);
  }catch(e){
    toast(e.message||String(e),true);
  }finally{
    spgGenerationInFlight=false;
    updateSpgGenerateState();
  }
}
async function regenerateSelectedServicePage(){
  if(!activeCustomer)return;
  await openServicePageGeneration();
  await regenerateServicePageFromSpg();
}
function customerAtIndexing(c){
  const stage=c.currentStage||c.workflow?.currentStage||'';
  return stage==='request_indexing';
}
function customerAtPerformanceDashboard(c){
  const stage=c.currentStage||c.workflow?.currentStage||'';
  return stage==='initialise_rank_tracking'||stage==='monitoring';
}
function defaultDeploymentPort(method){
  if(method==='static_html_sftp')return 22;
  if(method==='cpanel')return 2083;
  return 21;
}
function renderCommercialDeploymentConfiguration(review){
  activeCdcReview=review;
  const s=review.summary||{};
  const p=review.profile||{};
  const methods=review.methods||[];
  const method=p.deploymentMethod||'static_html_ftp';
  const overallClass=s.overallStatus==='READY TO PUBLISH'?'ready':(s.overallStatus==='READY FOR VALIDATION'?'ready':'blocked');
  document.getElementById('cdcHero').innerHTML=
    '<h4>Deployment Configuration</h4>'+
    '<div style="font-size:.78rem;color:#94a3b8;margin-bottom:10px">Where should this website be deployed?</div>'+
    '<div class="cqr-overall '+overallClass+'">Overall Status: '+esc(s.overallStatus||'CONFIGURATION REQUIRED')+'</div>';
  document.getElementById('cdcTopActions').innerHTML=
    '<button class="btn secondary" type="button" onclick="testCommercialDeploymentConnection()">Test Connection</button>'+
    '<button class="btn secondary" type="button" onclick="validateCommercialDeploymentDestination()" '+(review.canValidateDestination?'':'disabled')+'>Validate Destination</button>'+
    '<button class="btn secondary" type="button" onclick="toggleCredentialUpdate()">'+(review.credentialsConfigured?'Update Credentials':'Set Credentials')+'</button>'+
    '<button class="btn secondary" type="button" onclick="viewDeploymentPublishHistory()">View Publish History</button>';
  document.getElementById('cdcConfigForm').innerHTML=
    '<div style="grid-column:1/-1"><h4 style="margin:0 0 8px;font-size:.72rem;color:#64748b;text-transform:uppercase">Public Website</h4></div>'+
    '<div><label>Production Website URL</label><input type="text" id="cdcProductionWebsite" value="'+esc(p.productionWebsite||'')+'" placeholder="https://example.com/your-branch"/></div>'+
    '<div><label>Public path / expected live URL</label><input type="text" id="cdcPublicPath" value="'+esc(p.publicPath||'/')+'" placeholder="/bannercross-pharmacy-sheffield"/></div>'+
    '<div style="grid-column:1/-1;margin-top:8px"><h4 style="margin:0 0 8px;font-size:.72rem;color:#64748b;text-transform:uppercase">Publishing Method</h4><div class="cdc-method-grid" id="cdcMethodGrid">'+
    methods.map(m=>'<div class="cdc-method-card '+(m.available?'':'unavailable')+(method===m.id?' selected':'')+'" data-method="'+esc(m.id)+'" onclick="selectDeploymentMethod(\\''+m.id+'\\','+(m.available?'true':'false')+')"><div style="font-weight:800;margin-bottom:4px">'+esc(m.label)+'</div><div style="color:#64748b">'+esc(m.description)+'</div></div>').join('')+
    '</div><input type="hidden" id="cdcDeploymentMethod" value="'+esc(method)+'"/></div>'+
    '<div style="grid-column:1/-1;margin-top:8px"><h4 style="margin:0 0 8px;font-size:.72rem;color:#64748b;text-transform:uppercase">Hosting Connection</h4></div>'+
    '<div><label>Hostname</label><input type="text" id="cdcHost" value="'+esc(p.host||'')+'" placeholder="ftp.your-host.com"/></div>'+
    '<div><label>Port</label><input type="number" id="cdcPort" value="'+esc(String(p.port||defaultDeploymentPort(method)))+'"/></div>'+
    '<div><label>Username</label><input type="text" id="cdcUsername" value="'+esc(p.username||'')+'"/></div>'+
    '<div id="cdcCredentialBox"><label>Password / API token</label><input type="password" id="cdcPassword" value="" placeholder="'+(review.credentialsConfigured?'Saved credentials — enter new value to update':'Required on first save')+'"/><div style="font-size:.66rem;color:#64748b;margin-top:4px">Stored securely · never shown after saving'+(review.credentialMasked?(' · '+esc(review.credentialMasked)):'')+'</div></div>'+
    (method==='static_html_ftp'?'<div style="display:flex;align-items:center;gap:8px;margin-top:28px"><input type="checkbox" id="cdcPassiveMode" '+(p.passiveMode!==false?'checked':'')+'/><label style="margin:0;text-transform:none;font-size:.74rem;color:#cbd5e1">Passive mode</label></div>':'')+
    '<div style="grid-column:1/-1;margin-top:8px"><h4 style="margin:0 0 8px;font-size:.72rem;color:#64748b;text-transform:uppercase">Remote Destination</h4></div>'+
    '<div><label>Remote root</label><input type="text" id="cdcRemoteRoot" value="'+esc(p.remoteRoot||'/')+'" placeholder="/public_html"/></div>'+
    '<div><label>Remote folder</label><input type="text" id="cdcRemoteFolder" value="'+esc(p.remoteFolder||'')+'" placeholder="bannercross-pharmacy-sheffield"/></div>'+
    '<div style="grid-column:1/-1"><label>Full resolved destination path</label><input type="text" id="cdcResolvedPath" value="'+esc(p.resolvedDestinationPath||'/')+'" readonly style="opacity:.85"/></div>';
  document.getElementById('cdcSummary').innerHTML=
    '<div class="cqr-stat"><div class="lbl">Production Website</div><div class="val" style="font-size:.72rem">'+esc(s.productionWebsite||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publishing Method</div><div class="val" style="font-size:.72rem">'+esc(s.publishingMethod||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Connection Details</div><div class="val" style="font-size:.72rem">'+esc(s.connectionDetails||'Not configured')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Remote Destination</div><div class="val" style="font-size:.72rem">'+esc(s.remoteDestination||'Not configured')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Connection Status</div><div class="val">'+esc(s.connectionStatus||'Offline')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Destination Status</div><div class="val">'+esc(s.destinationStatus||'Not validated')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Writable</div><div class="val">'+esc(s.writable||'Not verified')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publishing Enabled</div><div class="val '+(s.publishingEnabled?'pass':'fail')+'">'+(s.publishingEnabled?'Yes':'No')+'</div></div>';
  document.getElementById('cdcConnectionChecks').innerHTML=(review.connectionChecks||[]).map(ch=>'<div class="cqr-check"><span>'+esc(ch.label)+'<div style="color:#64748b;font-size:.66rem;margin-top:2px">'+esc(ch.detail)+'</div></span><span class="status '+esc(ch.status)+'">'+esc(ch.status)+'</span></div>').join('')||'<div style="font-size:.72rem;color:#64748b">Run Test Connection to verify hosting access. No files are uploaded.</div>';
  document.getElementById('cdcDestinationChecks').innerHTML=(review.destinationChecks||[]).map(ch=>'<div class="cqr-check"><span>'+esc(ch.label)+'<div style="color:#64748b;font-size:.66rem;margin-top:2px">'+esc(ch.detail)+'</div></span><span class="status '+esc(ch.status)+'">'+esc(ch.status)+'</span></div>').join('')||'<div style="font-size:.72rem;color:#64748b">Run Validate Destination after a successful connection test.</div>';
  const warnSec=document.getElementById('cdcWarningsSection');const blockSec=document.getElementById('cdcBlockersSection');
  if((review.warnings||[]).length){warnSec.style.display='block';document.getElementById('cdcWarnings').innerHTML=(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{warnSec.style.display='none';document.getElementById('cdcWarnings').innerHTML=''}
  if((review.blockers||[]).length){blockSec.style.display='block';document.getElementById('cdcBlockers').innerHTML=(review.blockers||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{blockSec.style.display='none';document.getElementById('cdcBlockers').innerHTML=''}
  const histSec=document.getElementById('cdcHistorySection');
  if((review.publishHistory||[]).length){histSec.style.display='block';document.getElementById('cdcHistory').innerHTML='<table class="audit-table"><thead><tr><th>Version</th><th>Approved</th><th>Operator</th></tr></thead><tbody>'+(review.publishHistory||[]).map(h=>'<tr><td>v'+esc(String(h.version))+'</td><td>'+fmt(h.approvedAt)+'</td><td>'+esc(h.operator)+'</td></tr>').join('')+'</tbody></table>'}else{histSec.style.display='none';document.getElementById('cdcHistory').innerHTML=''}
  document.getElementById('cdcPanelStats').innerHTML='<div class="bpr-panel-stat"><div class="lbl">Publishing Readiness</div><div style="font-weight:800;color:'+(s.overallStatus==='READY TO PUBLISH'?'#4ade80':'#f87171')+'">'+esc(s.overallStatus||'CONFIGURATION REQUIRED')+'</div></div>';
  document.getElementById('cdcPanelWarnings').innerHTML=(review.warnings||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Warnings</li>'+(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')):'';
  document.getElementById('cdcPanelBlockers').innerHTML=(review.blockers||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Blockers</li>'+(review.blockers||[]).map(w=>'<li style="color:#fca5a5">'+esc(w)+'</li>').join('')):'';
  document.getElementById('cdcApproveBtn').disabled=!review.canApprove;
  document.getElementById('cdcPublishBtn').disabled=!p.publishingEnabled;
  document.getElementById('cdcApprovalError').style.display='none';
  document.getElementById('cdcConfigSection').style.display=p.publishingEnabled?'none':'block';
  bindDeploymentPathPreview();
}
function bindDeploymentPathPreview(){
  const normSlashes=(v)=>String(v||'').split('\\\\').join('/');
  const trimLead=(v)=>{let s=normSlashes(v);while(s.startsWith('/'))s=s.slice(1);return s};
  const collapse=(v)=>{const parts=normSlashes(v).split('/').filter(Boolean);return parts.length?'/'+parts.join('/'):'/'};
  const update=()=>{
    const folder=trimLead(document.getElementById('cdcRemoteFolder')?.value).split('/').filter(Boolean).join('/');
    let resolved=collapse('/'+trimLead(document.getElementById('cdcRemoteRoot')?.value))+(folder?'/'+folder:'');
    if(resolved.length>1&&resolved.endsWith('/'))resolved=resolved.slice(0,-1);
    const el=document.getElementById('cdcResolvedPath');
    if(el)el.value=resolved||'/';
  };
  ['cdcRemoteRoot','cdcRemoteFolder'].forEach(id=>{const el=document.getElementById(id);if(el)el.oninput=update});
  update();
}
function setCdcViewState(state){
  document.getElementById('cdcLoading').style.display=state==='loading'?'block':'none';
  document.getElementById('cdcContent').style.display=state==='content'?'block':'none';
  document.getElementById('cdcError').style.display=state==='error'?'block':'none';
}
function showCdcLoadError(msg){
  setCdcViewState('error');
  document.getElementById('cdcErrorDetail').textContent=msg||'Unknown error';
  window.__lastCdcLoadError=msg||'Unknown error';
}
function reportCdcLoadIssue(){
  if(!activeCustomer){toast('Open a customer first',true);return}
  const err=String(window.__lastCdcLoadError||'Deployment Configuration load failure');
  const url='/api/admin/master/issues/new?slug='+encodeURIComponent(activeCustomer.slug)+'&component=deployment-configuration&summary='+encodeURIComponent(err.slice(0,240));
  window.open(url,'_blank');
}
function normalizeCommercialDeploymentReviewPayload(review){
  if(!review||typeof review!=='object')throw new Error('Deployment configuration payload missing');
  const profile=review.profile&&typeof review.profile==='object'?Object.assign({},review.profile):{};
  if(!profile.productionWebsite&&profile.publicWebsite)profile.productionWebsite=profile.publicWebsite;
  if(!profile.deploymentMethod&&profile.method)profile.deploymentMethod=profile.method;
  if(!profile.host&&profile.hostingConnection&&profile.hostingConnection.host)profile.host=profile.hostingConnection.host;
  if(!profile.remoteRoot&&profile.remoteDestination&&profile.remoteDestination.root)profile.remoteRoot=profile.remoteDestination.root;
  if(!profile.remoteFolder&&profile.remoteDestination&&profile.remoteDestination.folder)profile.remoteFolder=profile.remoteDestination.folder;
  const summary=review.summary&&typeof review.summary==='object'?Object.assign({},review.summary):{};
  if(!summary.productionWebsite&&profile.productionWebsite)summary.productionWebsite=profile.productionWebsite;
  if(summary.connectionStatus==null&&profile.connectionStatus)summary.connectionStatus=profile.connectionStatus;
  if(summary.destinationStatus==null&&profile.destinationStatus)summary.destinationStatus=profile.destinationStatus;
  if(summary.writable==null&&profile.writableStatus)summary.writable=profile.writableStatus;
  return Object.assign({},review,{
    profile,
    summary,
    methods:Array.isArray(review.methods)?review.methods:[],
    connectionChecks:Array.isArray(review.connectionChecks)?review.connectionChecks:[],
    destinationChecks:Array.isArray(review.destinationChecks)?review.destinationChecks:[],
    warnings:Array.isArray(review.warnings)?review.warnings:[],
    blockers:Array.isArray(review.blockers)?review.blockers:[],
    publishHistory:Array.isArray(review.publishHistory)?review.publishHistory:[]
  });
}
function toggleCredentialUpdate(){
  const box=document.getElementById('cdcCredentialBox');
  if(!box)return;
  box.scrollIntoView({behavior:'smooth',block:'center'});
  const input=document.getElementById('cdcPassword');
  if(input){input.focus();toast('Enter the new password or API token, then Save Deployment or Update Credentials')}
}
function selectDeploymentMethod(methodId,available){
  if(!available){toast('This publishing method is not available yet',true);return}
  document.getElementById('cdcDeploymentMethod').value=methodId;
  document.querySelectorAll('.cdc-method-card').forEach(el=>{el.classList.toggle('selected',el.getAttribute('data-method')===methodId)});
  const portEl=document.getElementById('cdcPort');
  if(portEl&&!portEl.dataset.userEdited)portEl.value=String(defaultDeploymentPort(methodId));
  if(activeCdcReview){activeCdcReview.profile.deploymentMethod=methodId;renderCommercialDeploymentConfiguration(activeCdcReview)}
}
function deploymentConfigurationPayload(){
  const method=document.getElementById('cdcDeploymentMethod')?.value||'static_html_ftp';
  return {
    productionWebsite:document.getElementById('cdcProductionWebsite')?.value||'',
    publicPath:document.getElementById('cdcPublicPath')?.value||'',
    deploymentMethod:method,
    host:document.getElementById('cdcHost')?.value||'',
    port:Number(document.getElementById('cdcPort')?.value||defaultDeploymentPort(method)),
    username:document.getElementById('cdcUsername')?.value||'',
    password:document.getElementById('cdcPassword')?.value||'',
    authMethod:method==='cpanel'?'api_token':'password',
    passiveMode:method==='static_html_ftp'?Boolean(document.getElementById('cdcPassiveMode')?.checked):undefined,
    remoteRoot:document.getElementById('cdcRemoteRoot')?.value||'/',
    remoteFolder:document.getElementById('cdcRemoteFolder')?.value||''
  };
}
async function updateCommercialDeploymentCredentials(){
  if(!activeCustomer)return;
  const payload=deploymentConfigurationPayload();
  if(!payload.password){toast('Enter a password or API token to update credentials',true);return}
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-deployment-configuration/credentials',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({username:payload.username,password:payload.password,authMethod:payload.authMethod})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast('Credentials updated securely');
    document.getElementById('cdcPassword').value='';
    if(data.review)renderCommercialDeploymentConfiguration(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function openCommercialDeploymentConfiguration(){
  if(!activeCustomer)return;
  if(!customerAtDeploymentConfiguration(activeCustomer)&&!(activeCustomer.deploymentConfiguration&&activeCustomer.deploymentConfiguration.approved)){toast('Deployment Configuration is not available for this customer.',true);return}
  document.getElementById('cdcModal').classList.add('open');
  setCdcViewState('loading');
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','deployment-configuration');history.replaceState(null,'',location.pathname+'?'+p.toString());
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-deployment-configuration',{headers:{'Accept':'application/json'},credentials:'same-origin',signal:controller.signal});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText||('HTTP '+res.status));
    const review=normalizeCommercialDeploymentReviewPayload(data.review);
    try{
      renderCommercialDeploymentConfiguration(review);
    }catch(renderErr){
      throw new Error(renderErr instanceof Error?renderErr.message:'Deployment Configuration screen failed to render');
    }
    setCdcViewState('content');
  }catch(e){
    const msg=e&&e.name==='AbortError'?'Deployment configuration request timed out. Please retry.':(e&&e.message?e.message:'Deployment Configuration could not be loaded.');
    showCdcLoadError(msg);
    toast(msg,true);
  }finally{clearTimeout(timeout)}
}
function closeCommercialDeploymentConfiguration(){
  document.getElementById('cdcModal').classList.remove('open');
  activeCdcReview=null;
  const p=new URLSearchParams(location.search);
  if(p.get('panel')==='deployment-configuration'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function saveCommercialDeploymentConfiguration(){
  if(!activeCustomer)return;
  const btn=document.getElementById('cdcSaveBtn');
  btn.disabled=true;
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-deployment-configuration',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(deploymentConfigurationPayload())});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast('Deployment configuration saved');
    document.getElementById('cdcPassword').value='';
    if(data.review)renderCommercialDeploymentConfiguration(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
  finally{btn.disabled=false}
}
async function testCommercialDeploymentConnection(){
  if(!activeCustomer)return;
  toast('Testing connection…');
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-deployment-configuration/test-connection',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast(data.connectionOk?'Connection test passed':'Connection test completed with issues',!data.connectionOk);
    if(data.review)renderCommercialDeploymentConfiguration(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function validateCommercialDeploymentDestination(){
  if(!activeCustomer)return;
  toast('Validating destination…');
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-deployment-configuration/validate',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast(data.validationOk?'Destination validation passed':'Destination validation completed with blockers',!data.validationOk);
    if(data.review)renderCommercialDeploymentConfiguration(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function approveCommercialDeployment(){
  if(!activeCustomer)return;
  const btn=document.getElementById('cdcApproveBtn');
  btn.disabled=true;
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-deployment-configuration/approve',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast('Deployment approved — ready to publish');
    if(data.review)renderCommercialDeploymentConfiguration(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    await loadDashboard();
  }catch(e){
    document.getElementById('cdcApprovalError').style.display='block';
    document.getElementById('cdcApprovalErrorMsg').textContent=e.message||String(e);
    if(activeCdcReview)btn.disabled=!activeCdcReview.canApprove;
  }
}
function viewDeploymentPublishHistory(){
  if(!activeCustomer)return;
  window.open('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-deployment-configuration/history','_blank');
}
let activePiReview=null;
let activeMpReview=null;
function setPiViewState(state){
  document.getElementById('piLoading').style.display=state==='loading'?'block':'none';
  document.getElementById('piContent').style.display=state==='content'?'block':'none';
  document.getElementById('piError').style.display=state==='error'?'block':'none';
}
function setMpViewState(state){
  document.getElementById('mpLoading').style.display=state==='loading'?'block':'none';
  document.getElementById('mpContent').style.display=state==='content'?'block':'none';
  document.getElementById('mpError').style.display=state==='error'?'block':'none';
}
function renderPlatformInfrastructure(review){
  activePiReview=review;
  const s=review.summary||{};
  const p=review.profile||{};
  const statusClass=s.platformStatus==='READY'?'ready':(s.platformStatus==='CONNECTED'?'ready':(s.platformStatus==='NOT CONFIGURED'||s.platformStatus==='NOT TESTED'?'':'blocked'));
  document.getElementById('piStatusPanel').innerHTML=
    '<div><strong>Connection:</strong> '+esc(s.connectionStatus||'Not Configured')+'</div>'+
    '<div style="margin-top:4px"><strong>Publish Root:</strong> '+esc(s.publishRootStatusLabel||'Not Validated')+'</div>'+
    '<div style="margin-top:4px;font-size:.72rem;color:#94a3b8">Credentials: '+(s.credentialsConfigured?'Configured (masked)':'Not configured')+
    (s.lastSuccessfulTestAt?' · Last successful test '+fmt(s.lastSuccessfulTestAt):'')+'</div>'+
    '<div class="cqr-overall '+statusClass+'" style="margin-top:8px">Platform Status: '+esc(s.platformStatus||'NOT CONFIGURED')+'</div>';
  const failPanel=document.getElementById('piFailurePanel');
  if(s.lastFailureReason){
    failPanel.style.display='block';
    document.getElementById('piFailureDetail').textContent=s.lastFailureReason;
  }else{failPanel.style.display='none';document.getElementById('piFailureDetail').textContent=''}
  document.getElementById('piConfigForm').innerHTML=
    '<div><label>Publishing Method</label><select id="piMethod"><option value="static_html_ftp">FTP</option><option value="static_html_sftp">SFTP</option></select></div>'+
    '<div><label>Host</label><input type="text" id="piHost" value="'+esc(p.serverHost||'')+'"/></div>'+
    '<div><label>Port</label><input type="number" id="piPort" value="'+esc(String(p.port||21))+'"/></div>'+
    '<div><label>Username</label><input type="text" id="piUsername" value="'+esc(p.username||'')+'"/></div>'+
    '<div><label>Password</label><input type="password" id="piPassword" value="" placeholder="'+(p.credentialsConfigured?'Leave blank to keep saved password':'Required on first save')+'"/></div>'+
    '<div><label>Global Publish Root</label><input type="text" id="piPublishRoot" value="'+esc(p.globalPublishRoot||'')+'"/></div>'+
    '<div><label>Managed Sites Domain</label><input type="text" id="piManagedDomain" value="'+esc(p.managedSitesDomain||'')+'" placeholder="sites.pharmaconnect.uk"/></div>';
  const methodEl=document.getElementById('piMethod');if(methodEl)methodEl.value=p.publishingMethod||'static_html_ftp';
  document.getElementById('piChecks').innerHTML=(review.checks||[]).map(ch=>'<div class="cqr-check"><span>'+esc(ch.label)+'<div style="color:#64748b;font-size:.66rem;margin-top:2px">'+esc(ch.detail)+'</div></span><span class="status '+esc(ch.status)+'">'+esc(ch.status)+'</span></div>').join('');
}
async function openPlatformInfrastructure(){
  document.getElementById('piModal').classList.add('open');
  setPiViewState('loading');
  const p=new URLSearchParams(location.search);p.set('panel','platform-infrastructure');history.replaceState(null,'',location.pathname+'?'+p.toString());
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch('/api/master-admin-platform/platform-infrastructure',{headers:{'Accept':'application/json'},credentials:'same-origin',signal:controller.signal});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    renderPlatformInfrastructure(data.review);
    setPiViewState('content');
  }catch(e){
    const msg=e&&e.name==='AbortError'?'Platform infrastructure request timed out.':(e&&e.message?e.message:'Platform Infrastructure could not be loaded.');
    setPiViewState('error');document.getElementById('piErrorDetail').textContent=msg;toast(msg,true);
  }finally{clearTimeout(timeout)}
}
function closePlatformInfrastructure(){
  document.getElementById('piModal').classList.remove('open');
  activePiReview=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='platform-infrastructure'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
function platformInfrastructurePayload(){
  return {
    publishingMethod:document.getElementById('piMethod')?.value||'static_html_ftp',
    serverHost:document.getElementById('piHost')?.value||'',
    port:Number(document.getElementById('piPort')?.value||21),
    username:document.getElementById('piUsername')?.value||'',
    password:document.getElementById('piPassword')?.value||'',
    globalPublishRoot:document.getElementById('piPublishRoot')?.value||'',
    managedSitesDomain:document.getElementById('piManagedDomain')?.value||''
  };
}
async function savePlatformInfrastructure(){
  try{
    const res=await fetch('/api/master-admin-platform/platform-infrastructure',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(platformInfrastructurePayload())});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast('Connection saved');
    document.getElementById('piPassword').value='';
    if(data.review)renderPlatformInfrastructure(data.review);
  }catch(e){toast(e.message,true)}
}
async function updatePlatformInfrastructureCredentials(){
  const password=document.getElementById('piPassword')?.value||'';
  const username=document.getElementById('piUsername')?.value||'';
  try{
    const res=await fetch('/api/master-admin-platform/platform-infrastructure/credentials',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({username,password:password||undefined})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast(password?'Credentials updated securely':'Username updated');
    document.getElementById('piPassword').value='';
    if(data.review)renderPlatformInfrastructure(data.review);
  }catch(e){toast(e.message,true)}
}
async function testPlatformInfrastructureConnection(){
  toast('Testing connection…');
  try{
    const res=await fetch('/api/master-admin-platform/platform-infrastructure/test-connection',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(data.review)renderPlatformInfrastructure(data.review);
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast(data.review?.summary?.platformStatus==='CONNECTED'||data.review?.summary?.platformStatus==='READY'?'Connection successful':'Connection test completed');
  }catch(e){toast(e.message,true)}
}
async function validatePlatformPublishRoot(){
  toast('Validating publish root…');
  try{
    const res=await fetch('/api/master-admin-platform/platform-infrastructure/validate-publish-root',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(data.review)renderPlatformInfrastructure(data.review);
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast(data.review?.summary?.platformStatus==='READY'?'Platform status: READY':'Publish root validation completed with issues',data.review?.summary?.platformStatus!=='READY');
  }catch(e){toast(e.message,true)}
}
function renderManagedPublishing(review){
  activeMpReview=review;
  const s=review.summary||{};
  const p=review.profile||{};
  const eco=review.ecosystemUrl||{};
  const overallClass=(s.overallStatus||'').includes('READY')?'ready':'blocked';
  document.getElementById('mpHero').innerHTML='<h4>Managed Publishing</h4><div style="font-size:.78rem;color:#94a3b8;margin-bottom:10px">'+esc(s.hostingLabel||'PharmaConnect Managed Infrastructure')+' · ✓ Managed</div><div class="cqr-overall '+overallClass+'">'+esc(s.overallStatus||s.publishingReadiness||'CONFIGURATION REQUIRED')+'</div>';
  document.getElementById('mpTopActions').innerHTML=
    (review.canConfirmDomain?'<button class="btn secondary" type="button" onclick="confirmManagedPublishingDomain()">Confirm Domain</button>':'')+
    (review.dnsInstructions?'<button class="btn secondary" type="button" onclick="viewManagedPublishingDnsInstructions()">View DNS Instructions</button>':'')+
    (review.canVerifyDns?'<button class="btn secondary" type="button" onclick="verifyManagedPublishingDns()">Verify DNS</button>':'')+
    (review.canVerifyDns?'<button class="btn secondary" type="button" onclick="recheckManagedPublishingDns()">Recheck DNS</button>':'')+
    (p.dnsStatus==='verified'&&p.sslStatus!=='active'?'<button class="btn secondary" type="button" onclick="verifyManagedPublishingSsl()">Verify SSL</button>':'')+
    (review.canChangeSubdomainLabel?'<button class="btn secondary" type="button" onclick="changeManagedPublishingSubdomainLabel()">Change Subdomain Label</button>':'')+
    (review.canRemoveSubdomain?'<button class="btn secondary" type="button" onclick="removeManagedPublishingSubdomain()">Remove Customer Domain Mapping</button>':'')+
    (review.canRollback?'<button class="btn secondary" type="button" onclick="rollbackManagedPublishingRelease()">Roll Back</button>':'');
  document.getElementById('mpSummary').innerHTML=
    '<div class="cqr-stat"><div class="lbl">Customer Root Domain</div><div class="val" style="font-size:.72rem">'+esc(s.customerRootDomain||'Pending confirmation')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Subdomain Label</div><div class="val">'+esc(s.subdomainLabel||'local')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Customer Ecosystem URL</div><div class="val" style="font-size:.72rem">'+esc(s.canonicalEcosystemUrl||'Pending domain confirmation')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Managed CNAME Target</div><div class="val" style="font-size:.72rem">'+esc(p.requiredCnameTarget||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Internal Managed URL</div><div class="val" style="font-size:.72rem">'+esc(s.internalFallbackUrl||s.managedUrl||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">DNS Status</div><div class="val">'+esc(s.dnsConnectionStatus||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">SSL Status</div><div class="val">'+esc(s.sslStatus||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Canonical URL Status</div><div class="val">'+esc(s.canonicalUrlStatus||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Current Release</div><div class="val">'+esc(s.currentRelease||'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publishing Readiness</div><div class="val">'+esc(s.publishingReadiness||'—')+'</div></div>';
  const confirmBanner=eco.domainConfirmationRequired?
    '<div class="guidance-box" style="grid-column:1/-1;border-color:#f59e0b"><div><strong>CUSTOMER DOMAIN CONFIRMATION REQUIRED</strong></div><div style="margin-top:8px;font-size:.78rem">Proposed domain: <strong>'+esc(eco.customerRootDomain||'—')+'</strong><br>Evidence: '+esc(eco.domainEvidenceSource||'none')+' — '+esc(eco.domainEvidenceUrl||'—')+'<br>'+esc(eco.domainConfirmationReason||'Confirm the pharmacy-owned root domain before DNS instructions are issued.')+'</div></div>':'';
  document.getElementById('mpSubdomainForm').innerHTML=
    confirmBanner+
    '<div><label>Customer root domain</label><input type="text" id="mpCustomerRootDomain" value="'+esc(eco.customerRootDomain||'')+'" placeholder="bannercrosspharmacy.co.uk"/></div>'+
    '<div><label>Subdomain label</label><input type="text" id="mpSubdomainLabel" value="'+esc(p.subdomainLabel||'local')+'" placeholder="local" '+(p.customerRootDomainConfirmed?'':'disabled')+'/></div>'+
    '<div style="grid-column:1/-1;font-size:.72rem;color:#64748b">Canonical ecosystem URL pattern: https://'+esc(p.subdomainLabel||'local')+'.&lt;customer-domain&gt;/ — customer root website remains untouched.</div>';
  const dns=review.dnsInstructions;
  document.getElementById('mpDnsInstructions').innerHTML=dns?
    '<div class="guidance-box"><div><strong>Required DNS record</strong></div><div style="margin-top:8px;font-size:.78rem">Record type: '+esc(dns.type)+'<br>Host / Name: '+esc(dns.host||'local')+'<br>Target / Value: '+esc(dns.target)+'<br>TTL: '+esc(dns.ttl)+'<br>Full expected hostname: '+esc(dns.fullExpectedHostname||'—')+'</div><div style="margin-top:8px;font-size:.68rem;color:#64748b">DNS completion is not required before internal managed release testing. Customer CNAME and valid SSL are required before indexing the customer-facing ecosystem URL.</div></div>':
    '<div style="font-size:.72rem;color:#64748b">Confirm the customer root domain to view CNAME instructions.</div>';
  document.getElementById('mpReleases').innerHTML=(review.releases||[]).length?
    '<table class="audit-table"><thead><tr><th>Release</th><th>Size</th><th>Current</th></tr></thead><tbody>'+(review.releases||[]).map(r=>'<tr><td>'+esc(r.releaseId)+'</td><td>'+esc(String(Math.round((r.sizeBytes||0)/1024)))+' KB</td><td>'+(r.current?'Yes':(r.previous?'Previous':'—'))+'</td></tr>').join('')+'</tbody></table>':
    '<div style="font-size:.72rem;color:#64748b">No releases published yet.</div>';
  const warnSec=document.getElementById('mpWarningsSection');const blockSec=document.getElementById('mpBlockersSection');
  if((review.warnings||[]).length){warnSec.style.display='block';document.getElementById('mpWarnings').innerHTML=(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{warnSec.style.display='none';document.getElementById('mpWarnings').innerHTML=''}
  if((review.blockers||[]).length){blockSec.style.display='block';document.getElementById('mpBlockers').innerHTML=(review.blockers||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{blockSec.style.display='none';document.getElementById('mpBlockers').innerHTML=''}
  document.getElementById('mpPanelStats').innerHTML='<div class="bpr-panel-stat"><div class="lbl">Internal Managed URL</div><div style="font-weight:800;font-size:.72rem">'+esc(s.internalFallbackUrl||s.managedUrl||'—')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Customer Ecosystem URL</div><div style="font-size:.72rem">'+esc(s.canonicalEcosystemUrl||'Pending confirmation')+'</div></div>';
}
async function confirmManagedPublishingDomain(){
  if(!activeCustomer)return;
  const customerRootDomain=document.getElementById('mpCustomerRootDomain')?.value||'';
  if(!customerRootDomain){toast('Enter the customer root domain',true);return}
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/confirm-domain',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({customerRootDomain})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast('Customer domain confirmed');
    if(data.review)renderManagedPublishing(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
function viewManagedPublishingDnsInstructions(){
  const dns=activeMpReview&&activeMpReview.dnsInstructions;
  if(!dns){toast('Confirm customer domain first',true);return}
  alert('Required DNS record\\n\\nType: '+dns.type+'\\nHost/Name: '+(dns.host||'local')+'\\nTarget/Value: '+dns.target+'\\nTTL: '+dns.ttl+'\\nFull hostname: '+(dns.fullExpectedHostname||'—'));
}
async function changeManagedPublishingSubdomainLabel(){
  if(!activeCustomer)return;
  const subdomainLabel=document.getElementById('mpSubdomainLabel')?.value||'local';
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/change-subdomain-label',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({subdomainLabel})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast('Subdomain label updated');
    if(data.review)renderManagedPublishing(data.review);
  }catch(e){toast(e.message,true)}
}
async function recheckManagedPublishingDns(){
  if(!activeCustomer)return;
  toast('Rechecking DNS…');
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/recheck-dns',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast(data.review?.profile?.dnsStatus==='verified'?'DNS verified':'DNS recheck completed',data.review?.profile?.dnsStatus!=='verified');
    if(data.review)renderManagedPublishing(data.review);
  }catch(e){toast(e.message,true)}
}
async function verifyManagedPublishingSsl(){
  if(!activeCustomer)return;
  toast('Verifying SSL…');
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/verify-ssl',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast(data.review?.profile?.sslStatus==='active'?'SSL active':'SSL verification completed',data.review?.profile?.sslStatus!=='active');
    if(data.review)renderManagedPublishing(data.review);
  }catch(e){toast(e.message,true)}
}
async function openManagedPublishing(){
  if(!activeCustomer)return;
  if(!customerAtManagedPublishing(activeCustomer)){toast('Managed Publishing is not available for this customer.',true);return}
  document.getElementById('mpModal').classList.add('open');
  setMpViewState('loading');
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','managed-publishing');history.replaceState(null,'',location.pathname+'?'+p.toString());
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing',{headers:{'Accept':'application/json'},credentials:'same-origin',signal:controller.signal});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    renderManagedPublishing(data.review);
    setMpViewState('content');
  }catch(e){
    const msg=e&&e.name==='AbortError'?'Managed publishing request timed out.':(e&&e.message?e.message:'Managed Publishing could not be loaded.');
    setMpViewState('error');document.getElementById('mpErrorDetail').textContent=msg;toast(msg,true);
  }finally{clearTimeout(timeout)}
}
function closeManagedPublishing(){
  document.getElementById('mpModal').classList.remove('open');
  activeMpReview=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='managed-publishing'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function saveManagedPublishingSubdomain(){
  if(!activeCustomer)return;
  const customerSubdomain=document.getElementById('mpCustomerSubdomain')?.value||'';
  if(!customerSubdomain){toast('Enter a customer subdomain',true);return}
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/subdomain',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({customerSubdomain})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast('Customer subdomain saved');
    if(data.review)renderManagedPublishing(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function removeManagedPublishingSubdomain(){
  if(!activeCustomer)return;
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/subdomain',{method:'DELETE',headers:{'Accept':'application/json'},credentials:'same-origin'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast('Customer subdomain removed');
    if(data.review)renderManagedPublishing(data.review);
  }catch(e){toast(e.message,true)}
}
async function verifyManagedPublishingDns(){
  if(!activeCustomer)return;
  toast('Verifying DNS…');
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/verify-dns',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast(data.review?.profile?.dnsStatus==='verified'?'DNS verified':'DNS verification completed with issues',data.review?.profile?.dnsStatus!=='verified');
    if(data.review)renderManagedPublishing(data.review);
  }catch(e){toast(e.message,true)}
}
async function rollbackManagedPublishingRelease(){
  if(!activeCustomer||!activeMpReview||!activeMpReview.profile?.previousRelease)return;
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/managed-publishing/rollback',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({releaseId:activeMpReview.profile.previousRelease})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||res.statusText);
    toast('Release rolled back');
    if(data.review)renderManagedPublishing(data.review);
  }catch(e){toast(e.message,true)}
}
function updateCprApproveState(){
  const btn=document.getElementById('cprApproveBtn');
  const retryBtn=document.getElementById('cprRetryBtn');
  const box=document.getElementById('cprConfirmCheckbox');
  if(!btn||!box||!activeCprReview)return;
  const job=activeCprReview.activePublishJob;
  const jobRunning=Boolean(job&&(job.status==='queued'||job.status==='running'));
  const jobFailed=Boolean(job&&job.status==='failed');
  btn.disabled=!box.checked||!activeCprReview.canApprove||jobRunning;
  if(retryBtn)retryBtn.disabled=!box.checked||jobRunning;
  if(jobFailed&&!jobRunning) btn.disabled=true;
}
function cprStatusTone(status){
  if(status==='PUBLISHED & VERIFIED'||status==='READY TO PUBLISH'||status==='PASS')return 'pass';
  if(status==='BLOCKED'||status==='FAIL'||status==='PUBLICATION INCOMPLETE')return 'fail';
  return '';
}
function cprOverallClass(status){
  if(status==='PUBLISHED & VERIFIED'||status==='READY TO PUBLISH')return 'ready';
  return 'blocked';
}
function cprRatio(part){
  if(!part)return '0 / 0';
  return String(part.ready||0)+' / '+String(part.total||0);
}
function renderCommercialPublishReview(review){
  activeCprReview=review;
  const s=review.summary||{};
  const ps=review.publishStageSummary||{};
  const rm=review.releaseManagement||{};
  const d=review.destination||{};
  const pv=review.publicationVerification||{};
  const publishedVerified=pv.status==='PASS'||ps.overallStatus==='PUBLISHED & VERIFIED'||ps.publishingReadiness==='PUBLISHED & VERIFIED';
  const overall=ps.overallStatus||s.publishingReadiness||'BLOCKED';
  document.getElementById('cprHero').innerHTML=
    '<h4>'+esc(ps.stageLabel||'Publish')+'</h4>'+
    '<div class="cqr-summary-grid">'+
    '<div class="cqr-stat"><div class="lbl">Generated Package</div><div class="val">'+esc(ps.generatedPackage||review.serviceId||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Current Release</div><div class="val">'+esc(ps.currentRelease||rm.currentRelease||'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Managed Hostname</div><div class="val" style="font-size:.72rem">'+esc(ps.managedHostname||d.host||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Managed URL</div><div class="val" style="font-size:.72rem">'+esc(ps.managedUrl||d.publicWebsite||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publishing Status</div><div class="val">'+esc(ps.publishingStatus||'not published')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Previous Release</div><div class="val">'+esc(ps.previousRelease||rm.previousRelease||'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publishing Readiness</div><div class="val '+cprStatusTone(ps.publishingReadiness||s.publishingReadiness)+'">'+esc(ps.publishingReadiness||s.publishingReadiness||'BLOCKED')+'</div></div>'+
    '</div>'+
    '<div class="cqr-overall '+cprOverallClass(overall)+'">Overall Status: '+esc(overall)+'</div>';
  mountWorkflowNav('cprHero','Customer Pharmacy');
  const pvSec=document.getElementById('cprPublicationVerificationSection');
  if(pvSec){
    if(pv&&pv.publishedRelease){
      pvSec.style.display='block';
      document.getElementById('cprPublicationVerification').innerHTML=
        '<div class="cqr-stat"><div class="lbl">Published Release</div><div class="val">'+esc(pv.publishedRelease||'—')+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Published At</div><div class="val" style="font-size:.72rem">'+esc(pv.publishedAt?fmt(pv.publishedAt):'—')+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Published By</div><div class="val">'+esc(pv.publishedBy||'—')+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Previous Release</div><div class="val">'+esc(pv.previousRelease||'None')+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Rollback Target</div><div class="val">'+esc(pv.rollbackTarget||'None')+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Campaign Pages</div><div class="val">'+esc(cprRatio(pv.campaignPages))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Service Pages</div><div class="val">'+esc(cprRatio(pv.servicePages))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Locality Pages</div><div class="val">'+esc(cprRatio(pv.localityPages))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Deployed</div><div class="val">'+esc(cprRatio(pv.deployed))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Live URLs</div><div class="val">'+esc(cprRatio(pv.liveUrls))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Registry</div><div class="val">'+esc(cprRatio(pv.registry))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Sitemap</div><div class="val">'+esc(cprRatio(pv.sitemap))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Publication Verification</div><div class="val '+cprStatusTone(pv.status)+'">'+esc(pv.label||pv.status||'—')+'</div></div>';
    }else{
      pvSec.style.display='none';
      document.getElementById('cprPublicationVerification').innerHTML='';
    }
  }
  document.getElementById('cprReleaseManagement').innerHTML=
    '<div class="cqr-stat"><div class="lbl">Published Version</div><div class="val">'+esc(rm.publishedVersion?('v'+rm.publishedVersion):'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Published At</div><div class="val" style="font-size:.72rem">'+esc(rm.publishedAt?fmt(rm.publishedAt):'Never')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Published By</div><div class="val">'+esc(rm.publishedBy||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publish Duration</div><div class="val">'+esc(rm.publishDurationMs?((rm.publishDurationMs/1000).toFixed(1)+'s'):'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Rollback Target</div><div class="val">'+esc(rm.rollbackTarget||'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Rollback Available</div><div class="val '+(rm.rollbackAvailable?'pass':'fail')+'">'+(rm.rollbackAvailable?'Yes':'No')+'</div></div>';
  document.getElementById('cprTopActions').innerHTML=publishedVerified
    ? '<button class="btn primary" type="button" onclick="viewPublishedAssets()">View Published Assets</button>'+
      '<button class="btn primary" type="button" onclick="continueToIndexingFromPublishReview()">Continue to Indexing</button>'+
      '<button class="btn secondary" type="button" onclick="previewFinalWebsite()">Preview Final Website</button>'+
      '<button class="btn secondary" type="button" onclick="viewPublishManifest()">View Publish Manifest</button>'+
      '<button class="btn secondary" type="button" onclick="viewQaApproval()">View QA Approval</button>'
    : '<button class="btn primary" type="button" onclick="previewFinalWebsite()">Preview Final Website</button>'+
      '<button class="btn secondary" type="button" onclick="viewPublishPageList()">View Page List</button>'+
      '<button class="btn secondary" type="button" onclick="viewPublishManifest()">View Publish Manifest</button>'+
      '<button class="btn secondary" type="button" onclick="viewQaApproval()">View QA Approval</button>';
  document.getElementById('cprDestination').innerHTML=
    '<div class="cqr-stat"><div class="lbl">Publishing Destination</div><div class="val" style="font-size:.72rem">'+esc(d.publishMethod||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Customer Ecosystem URL</div><div class="val" style="font-size:.72rem">'+esc(d.customerEcosystemUrl||d.publicWebsite||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Managed Target</div><div class="val" style="font-size:.72rem">'+esc(d.managedTargetUrl||d.internalManagedUrl||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">DNS Status</div><div class="val">'+esc(d.dnsStatus||'Pending')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">SSL Status</div><div class="val">'+esc(d.sslStatus||'Pending')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Infrastructure Status</div><div class="val">'+esc(d.connectionStatus||'Offline')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Tenant Allocation</div><div class="val" style="font-size:.72rem">'+esc(d.remotePath||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Campaign Pages Ready</div><div class="val">'+esc(String(s.filesReady||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Last Successful Publish</div><div class="val" style="font-size:.72rem">'+esc(d.lastSuccessfulPublish||rm.currentRelease||'Never')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Proposed Version</div><div class="val" style="font-size:.72rem">'+esc(publishedVerified?(rm.currentRelease||'—'):(d.proposedVersion||'—'))+'</div></div>';
  const cs=review.changeSummary||{};
  document.getElementById('cprChangeSummary').innerHTML=
    '<div class="cqr-stat"><div class="lbl">Release Type</div><div class="val">'+(cs.mode==='initial_publish'?'Initial Publish':'Incremental Publish')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Total Campaign Pages</div><div class="val">'+esc(String(cs.totalFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">New Campaign Pages</div><div class="val">'+esc(String(cs.newFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Changed Campaign Pages</div><div class="val">'+esc(String(cs.changedFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Unchanged Campaign Pages</div><div class="val">'+esc(String(cs.unchangedFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Deleted Campaign Pages</div><div class="val">'+esc(String(cs.deletedFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Pages</div><div class="val">'+esc(String(cs.pages||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Sitemap</div><div class="val">'+(cs.sitemap?'Yes':'No')+'</div></div>';
  document.getElementById('cprChecks').innerHTML=(review.checks||[]).map(ch=>'<div class="cqr-check"><span>'+esc(ch.label)+'<div style="color:#64748b;font-size:.66rem;margin-top:2px">'+esc(ch.detail)+'</div></span><span class="status '+esc(ch.status)+'">'+esc(ch.status)+'</span></div>').join('');
  const warnSec=document.getElementById('cprWarningsSection');const blockSec=document.getElementById('cprBlockersSection');
  if((review.warnings||[]).length){warnSec.style.display='block';document.getElementById('cprWarnings').innerHTML=(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{warnSec.style.display='none';document.getElementById('cprWarnings').innerHTML=''}
  if((review.blockers||[]).length){blockSec.style.display='block';document.getElementById('cprBlockers').innerHTML=(review.blockers||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{blockSec.style.display='none';document.getElementById('cprBlockers').innerHTML=''}
  document.getElementById('cprPanelStats').innerHTML=
    '<div class="bpr-panel-stat"><div class="lbl">Overall Status</div><div style="font-weight:800;color:'+(publishedVerified||overall==='READY TO PUBLISH'?'#4ade80':'#f87171')+'">'+esc(overall)+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Generated Package</div><div>'+esc(ps.generatedPackage||review.serviceId||'—')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Managed URL</div><div style="font-size:.68rem">'+esc(ps.managedUrl||d.publicWebsite||'—')+'</div></div>'+
    (publishedVerified?'<div class="bpr-panel-stat"><div class="lbl">Next Action</div><div style="font-weight:700;color:#7dd3fc">Continue to Indexing</div></div>':'');
  document.getElementById('cprPanelWarnings').innerHTML=(review.warnings||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Warnings</li>'+(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')):'';
  document.getElementById('cprPanelBlockers').innerHTML=(review.blockers||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Blockers</li>'+(review.blockers||[]).map(w=>'<li style="color:#fca5a5">'+esc(w)+'</li>').join('')):'';
  const confirmBox=document.getElementById('cprConfirmCheckbox');if(confirmBox)confirmBox.checked=false;
  const confirmWrap=confirmBox?confirmBox.closest('.cpr-confirm-box'):null;
  const continueIdxBtn=document.getElementById('cprContinueIndexingBtn');
  if(publishedVerified){
    if(confirmWrap)confirmWrap.style.display='none';
    document.getElementById('cprApproveBtn').style.display='none';
    document.getElementById('cprRetryBtn').style.display='none';
    if(continueIdxBtn)continueIdxBtn.style.display='block';
  }else{
    if(confirmWrap)confirmWrap.style.display='';
    if(continueIdxBtn)continueIdxBtn.style.display='none';
    document.getElementById('cprApproveBtn').style.display=review.activePublishJob&&review.activePublishJob.status==='failed'?'none':'block';
    document.getElementById('cprRetryBtn').style.display=review.activePublishJob&&review.activePublishJob.status==='failed'?'block':'none';
    updateCprApproveState();
  }
  renderCprProgress(review.activePublishJob);
}
function renderCprProgress(job){
  const sec=document.getElementById('cprProgressSection');
  if(!job||!sec){if(sec)sec.style.display='none';return}
  sec.style.display='block';
  const stages=job.publishProgress&&job.publishProgress.stages?job.publishProgress.stages:{};
  const labels={preparing_release:'Preparing release',validating_destination:'Validating destination',connecting:'Connecting',uploading_files:'Uploading files',verifying_files:'Verifying files',updating_sitemap:'Updating sitemap',updating_registry:'Updating registry',checking_live_urls:'Checking live URLs',finalising_release:'Finalising release'};
  document.getElementById('cprProgressStages').innerHTML=Object.keys(labels).map(k=>'<div class="cpr-progress-stage '+esc(stages[k]||'pending')+'"><span>'+esc(labels[k])+'</span><span>'+esc(String(stages[k]||'pending').toUpperCase())+'</span></div>').join('');
  document.getElementById('cprProgressMeta').innerHTML='Status: <strong>'+esc(job.status)+'</strong> · '+esc(job.progressLabel||'')+' · Progress '+esc(String(job.progress||0))+'%'+(job.startedAt?' · Started '+fmt(job.startedAt):'');
}
function previewFinalWebsite(){if(activeCprReview&&activeCprReview.previewUrl)window.open(activeCprReview.previewUrl,'_blank','noopener')}
function cprEvidencePill(status){
  const ok=status==='PASS';
  return '<span style="display:inline-block;min-width:52px;text-align:center;padding:2px 6px;border-radius:999px;font-size:.62rem;font-weight:800;background:'+(ok?'rgba(34,197,94,.15)':'rgba(248,113,113,.15)')+';color:'+(ok?'#4ade80':'#fca5a5')+'">'+esc(ok?'PASS':'FAIL')+'</span>';
}
function viewPublishedAssets(){
  if(!activeCprReview){toast('No published assets available',true);return}
  const pv=activeCprReview.publicationVerification||{};
  const pages=(pv.assets&&pv.assets.length)?pv.assets:(activeCprReview.publishedPageList||[]);
  if(!pages.length){toast('No published assets available for the current release',true);return}
  const titleEl=document.getElementById('cprPageListTitle');
  if(titleEl)titleEl.textContent='Published Assets';
  const serviceCount=pages.filter(function(p){return p.pageType==='Service Page'}).length;
  const localityCount=pages.filter(function(p){return p.pageType==='Locality Page'}).length;
  const releaseId=pv.publishedRelease||(activeCprReview.releaseManagement&&activeCprReview.releaseManagement.currentRelease)||(pages[0]&&pages[0].releaseId)||'—';
  const meta=document.getElementById('cprPageListMeta');
  if(meta){
    meta.textContent=String(activeCprReview.serviceId||'')+' · release '+String(releaseId)+' · '+pages.length+' pages ('+serviceCount+' service · '+localityCount+' localities) · verification '+(pv.label||pv.status||'—');
  }
  const body=document.getElementById('cprPageListBody');
  if(!body){toast('Published assets panel unavailable',true);return}
  body.innerHTML='<div style="display:grid;gap:8px">'+pages.map(function(p,i){
    const label=p.locality?esc(p.locality):esc(p.title||p.pageSlug||'Page');
    const publishedUrl=String(p.url||'').trim();
    const openAction=publishedUrl
      ? '<a class="btn secondary" style="font-size:.7rem;white-space:nowrap;text-decoration:none;display:inline-block" href="'+esc(publishedUrl)+'" target="_blank" rel="noopener noreferrer">Open Page</a>'
      : '<button class="btn secondary" type="button" style="font-size:.7rem;white-space:nowrap" disabled>Open Page</button>';
    return '<div style="padding:10px 12px;border:1px solid #334155;border-radius:8px;background:#0f172a">'+
      '<div style="display:grid;grid-template-columns:minmax(0,1.3fr) 110px minmax(0,1.5fr) auto;gap:10px;align-items:center">'+
      '<div><div style="font-weight:700;font-size:.78rem">'+esc(String(i+1))+'. '+label+'</div><div style="font-size:.66rem;color:#94a3b8;margin-top:2px">'+esc(p.title||'')+'</div><div style="font-size:.62rem;color:#64748b;margin-top:2px">'+esc(p.serviceId||'')+' · '+esc(p.campaignId||'—')+' · '+esc(p.releaseId||releaseId)+'</div></div>'+
      '<div style="font-size:.72rem;color:#7dd3fc">'+esc(p.pageType||'—')+'</div>'+
      '<div style="font-size:.68rem;color:#cbd5e1;word-break:break-all">'+esc(publishedUrl)+'</div>'+
      openAction+
      '</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:.66rem;color:#94a3b8">'+
      '<span>Deployed '+cprEvidencePill(p.deploymentStatus||'UNKNOWN')+'</span>'+
      '<span>Live URL '+cprEvidencePill(p.liveUrlStatus||'UNKNOWN')+'</span>'+
      '<span>Registry '+cprEvidencePill(p.registryStatus||'UNKNOWN')+'</span>'+
      '<span>Sitemap '+cprEvidencePill(p.sitemapStatus||'UNKNOWN')+'</span>'+
      '</div></div>';
  }).join('')+'</div>';
  document.getElementById('cprPageListModal').classList.add('open');
}
function viewPublishPageList(){
  if(activeCprReview&&activeCprReview.publicationVerification&&activeCprReview.publicationVerification.status==='PASS'){
    viewPublishedAssets();
    return;
  }
  if(!activeCprReview){toast('No page list available',true);return}
  const pages=(activeCprReview.publishedPageList&&activeCprReview.publishedPageList.length)
    ? activeCprReview.publishedPageList
    : [];
  if(!pages.length){toast('No published page list available for the current release',true);return}
  const titleEl=document.getElementById('cprPageListTitle');
  if(titleEl)titleEl.textContent='Published Page List';
  const rm=activeCprReview.releaseManagement||{};
  const serviceCount=pages.filter(function(p){return p.pageType==='Service Page'}).length;
  const localityCount=pages.filter(function(p){return p.pageType==='Locality Page'}).length;
  const releaseId=rm.currentRelease||(pages[0]&&pages[0].releaseId)||'—';
  const meta=document.getElementById('cprPageListMeta');
  if(meta){
    meta.textContent=String(activeCprReview.serviceId||'')+' · release '+String(releaseId)+' · '+pages.length+' pages ('+serviceCount+' service · '+localityCount+' localities)';
  }
  const body=document.getElementById('cprPageListBody');
  if(!body){toast('Page list panel unavailable',true);return}
  body.innerHTML='<div style="display:grid;gap:8px">'+pages.map(function(p,i){
    const label=p.locality?esc(p.locality):esc(p.title||p.pageSlug||'Page');
    const publishedUrl=String(p.url||'').trim();
    const openAction=publishedUrl
      ? '<a class="btn secondary" style="font-size:.7rem;white-space:nowrap;text-decoration:none;display:inline-block" href="'+esc(publishedUrl)+'" target="_blank" rel="noopener noreferrer">Open Page</a>'
      : '<button class="btn secondary" type="button" style="font-size:.7rem;white-space:nowrap" disabled>Open Page</button>';
    return '<div style="display:grid;grid-template-columns:minmax(0,1.4fr) 110px minmax(0,1.6fr) auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid #334155;border-radius:8px;background:#0f172a">'+
      '<div><div style="font-weight:700;font-size:.78rem">'+esc(String(i+1))+'. '+label+'</div><div style="font-size:.66rem;color:#94a3b8;margin-top:2px">'+esc(p.title||'')+'</div></div>'+
      '<div style="font-size:.72rem;color:#7dd3fc">'+esc(p.pageType||'—')+'</div>'+
      '<div style="font-size:.68rem;color:#cbd5e1;word-break:break-all">'+esc(publishedUrl)+'</div>'+
      openAction+
      '</div>';
  }).join('')+'</div>';
  document.getElementById('cprPageListModal').classList.add('open');
}
function continueToIndexingFromPublishReview(){
  if(!activeCustomer){toast('No active customer',true);return}
  closePublishPageList();
  closeCommercialPublishReview();
  openCommercialIndexingReview(true);
}
function closePublishPageList(){
  const el=document.getElementById('cprPageListModal');
  if(el)el.classList.remove('open');
}
function viewPublishManifest(){
  if(!activeCprReview){toast('Manifest not available',true);return}
  const pages=activeCprReview.pageList||[];
  if(pages.length){
    alert('Next release publish package — '+pages.length+' campaign HTML page(s)\\nCurrent release: '+(activeCprReview.releaseManagement&&activeCprReview.releaseManagement.currentRelease||'None')+'\\n\\n'+pages.map(function(p,i){return (i+1)+'. '+p.pageSlug+' — '+p.url;}).join('\\n'));
    return;
  }
  if(!activeCprReview.manifestPath){toast('Manifest not available',true);return}
  toast('Manifest: '+activeCprReview.manifestPath);
}
function viewQaApproval(){
  if(!activeCustomer)return;
  window.open('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review','_blank');
}
async function openCommercialPublishReview(){
  if(!activeCustomer)return;
  if(!customerAtPublishReview(activeCustomer)){toast('Publish Review is not in the right state.',true);return}
  document.getElementById('cprModal').classList.add('open');
  document.getElementById('cprLoading').style.display='block';
  document.getElementById('cprContent').style.display='none';
  document.getElementById('cprError').style.display='none';
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','publish-review');history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-publish-review');
    if(!data.review)throw new Error('Publish review payload missing');
    renderCommercialPublishReview(data.review);
    document.getElementById('cprLoading').style.display='none';
    document.getElementById('cprContent').style.display='block';
    if(data.review.activePublishJob&&(data.review.activePublishJob.status==='queued'||data.review.activePublishJob.status==='running'))startCprPolling(data.review.activePublishJob.id);
  }catch(e){
    document.getElementById('cprLoading').style.display='none';
    document.getElementById('cprError').style.display='block';
    document.getElementById('cprErrorDetail').textContent=e.message||String(e);
  }
}
function closeCommercialPublishReview(){
  document.getElementById('cprModal').classList.remove('open');
  activeCprReview=null;
  if(cprPollTimer){clearInterval(cprPollTimer);cprPollTimer=null}
  const p=new URLSearchParams(location.search);
  if(p.get('panel')==='publish-review'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
function startCprPolling(jobId){
  if(cprPollTimer)clearInterval(cprPollTimer);
  cprPollTimer=setInterval(async()=>{
    try{
      const data=await api('/api/master-admin-platform/jobs/'+encodeURIComponent(jobId)+'/publish-progress');
      if(!data.progress)return;
      const job={id:data.progress.jobId,status:data.progress.status,progress:data.progress.progress,progressLabel:data.progress.progressLabel,startedAt:data.progress.startedAt,completedAt:data.progress.completedAt,retryCount:data.progress.retryCount,publishProgress:data.progress.publishProgress};
      renderCprProgress(job);
      if(data.progress.status==='completed'||data.progress.status==='failed'){
        clearInterval(cprPollTimer);cprPollTimer=null;
        const reviewData=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-publish-review');
        if(reviewData.review)renderCommercialPublishReview(reviewData.review);
        if(reviewData.customer||data.progress.status==='completed'){
          const cust=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug));
          if(cust.customer){activeCustomer=cust.customer;renderCustomerDetail(cust.customer);await loadDashboard()}
        }
        toast(data.progress.status==='completed'?'Publishing completed — workflow advanced to Request Indexing':'Publishing failed — current release preserved',data.progress.status!=='completed');
      }
    }catch(e){void e}
  },2000);
}
async function approveCommercialPublish(){
  if(!activeCustomer)return;
  const btn=document.getElementById('cprApproveBtn');
  const box=document.getElementById('cprConfirmCheckbox');
  if(!box||!box.checked){toast('Confirmation checkbox required',true);return}
  btn.disabled=true;
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-publish-review/approve',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard'})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast('Publish job queued');
    if(data.review)renderCommercialPublishReview(data.review);
    if(data.jobId)startCprPolling(data.jobId);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){
    document.getElementById('cprApprovalError').style.display='block';
    document.getElementById('cprApprovalErrorMsg').textContent=e.message||String(e);
    updateCprApproveState();
  }
}
function cqrStatusClass(status){
  if(status==='PASS')return 'pass';
  if(status==='WARNING')return 'warn';
  return 'fail';
}
function cqrPageTypeLabel(t){
  const m={homepage:'Homepage','service-hub':'Service Hub','cluster-page':'Cluster Page',guide:'Guide',blog:'Blog',faq:'FAQ','supporting-page':'Supporting Page'};
  return m[t]||t||'—';
}
function cqrReviewStatusLabel(s){
  if(s==='approved')return 'Approved';
  if(s==='needs_changes')return 'Needs Changes';
  return 'Not Reviewed';
}
function cqrReviewStatusClass(s){
  if(s==='approved')return 'cqr-review-status-approved';
  if(s==='needs_changes')return 'cqr-review-status-needs';
  return 'cqr-review-status-pending';
}
function openCqrPagePreview(pageSlug){
  if(!activeCustomer)return;
  window.open('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review/pages/'+encodeURIComponent(pageSlug)+'/preview','_blank','noopener');
}
async function saveCqrPageReview(pageSlug,reviewStatus,notes){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review/pages/'+encodeURIComponent(pageSlug)+'/review',{method:'POST',body:JSON.stringify({reviewStatus,notes})});
    if(data.review)renderCommercialQualityReview(data.review);
  }catch(e){toast(e.message||String(e),true)}
}
function renderCqrPageInspection(workspace){
  const sec=document.getElementById('cqrPageInspectionSection');
  const prog=document.getElementById('cqrInspectionProgress');
  const rows=document.getElementById('cqrInspectionRows');
  if(!sec||!prog||!rows)return;
  if(!workspace||!(workspace.pages||[]).length){sec.style.display='none';prog.innerHTML='';rows.innerHTML='';return}
  sec.style.display='block';
  const p=workspace.progress||{};
  prog.innerHTML=[
    ['Pages Reviewed',p.reviewed||0],['Pages Approved',p.approved||0],['Pages Requiring Changes',p.needsChanges||0],['Progress %',(p.progressPercent||0)+'%']
  ].map(r=>'<div class="cqr-stat"><div class="lbl">'+esc(r[0])+'</div><div class="val">'+esc(String(r[1]))+'</div></div>').join('');
  rows.innerHTML=(workspace.pages||[]).map(page=>{
    const genOk=page.generationStatus==='generated';
    const previewDisabled=genOk?'':' disabled';
    return '<tr data-page-slug="'+esc(page.pageSlug)+'">'+
    '<td>'+esc(cqrPageTypeLabel(page.pageType))+'</td>'+
    '<td>'+esc(page.pageName)+'</td>'+
    '<td class="'+(genOk?'cqr-gen-generated':'cqr-gen-missing')+'">'+(genOk?'Generated':'Missing')+'</td>'+
    '<td><button class="cqr-preview-btn" type="button" data-cqr-preview="'+esc(page.pageSlug)+'"'+previewDisabled+'>Preview</button></td>'+
    '<td><select class="cqr-review-select" data-page-slug="'+esc(page.pageSlug)+'">'+
    ['not_reviewed','approved','needs_changes'].map(v=>'<option value="'+v+'"'+(page.reviewStatus===v?' selected':'')+'>'+esc(cqrReviewStatusLabel(v))+'</option>').join('')+
    '</select></td>'+
    '<td><input class="cqr-notes-input" type="text" data-page-slug="'+esc(page.pageSlug)+'" value="'+esc(page.notes||'')+'" placeholder="Review notes"/></td>'+
    '</tr>';
  }).join('');
  bindCqrPageInspectionEvents();
}
function bindCqrPageInspectionEvents(){
  const rows=document.getElementById('cqrInspectionRows');
  if(!rows||rows.dataset.bound==='1')return;
  rows.dataset.bound='1';
  rows.addEventListener('click',e=>{
    const btn=e.target.closest('[data-cqr-preview]');
    if(btn&&!btn.disabled)openCqrPagePreview(btn.getAttribute('data-cqr-preview'));
  });
  rows.addEventListener('change',e=>{
    const sel=e.target.closest('.cqr-review-select');
    if(!sel)return;
    const slug=sel.getAttribute('data-page-slug');
    const notesEl=rows.querySelector('.cqr-notes-input[data-page-slug="'+slug+'"]');
    saveCqrPageReview(slug,sel.value,notesEl?notesEl.value:'');
  });
  rows.addEventListener('blur',e=>{
    const input=e.target.closest('.cqr-notes-input');
    if(!input)return;
    const slug=input.getAttribute('data-page-slug');
    const sel=rows.querySelector('.cqr-review-select[data-page-slug="'+slug+'"]');
    saveCqrPageReview(slug,sel?sel.value:'not_reviewed',input.value);
  },true);
}
function renderCommercialQualityReview(review){
  activeCqrReview=review;
  const s=review.summary||{};
  document.getElementById('cqrHero').innerHTML=
    '<h4>Quality Review</h4>'+
    '<div class="cqr-summary-grid">'+
    '<div class="cqr-stat"><div class="lbl">Content Generated</div><div class="val '+(s.contentGenerated?'pass':'fail')+'">'+(s.contentGenerated?'✓ Complete':esc(s.contentGeneratedLabel||'Missing'))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Pages Generated</div><div class="val">'+esc(String(s.pagesGenerated||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Images Generated</div><div class="val">'+esc(String(s.imagesGenerated||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Internal Links</div><div class="val '+cqrStatusClass(s.internalLinksLabel==='Passed'?'PASS':s.internalLinksLabel==='Review'?'WARNING':'FAIL')+'">'+(s.internalLinksLabel==='Passed'?'✓ Passed':esc(s.internalLinksLabel||'—'))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Schema Validation</div><div class="val '+cqrStatusClass(s.schemaValidationLabel==='Passed'?'PASS':s.schemaValidationLabel==='Review'?'WARNING':'FAIL')+'">'+(s.schemaValidationLabel==='Passed'?'✓ Passed':esc(s.schemaValidationLabel||'—'))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">SEO Health</div><div class="val '+cqrStatusClass(s.seoValidationLabel==='Passed'?'PASS':s.seoValidationLabel==='Review'?'WARNING':'FAIL')+'">'+(s.seoValidationLabel==='Passed'?'✓ Passed':esc(s.seoValidationLabel||'—'))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Navigation</div><div class="val">'+esc(s.navigationValidationLabel||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Content Quality Score</div><div class="val">'+esc(String(s.contentQualityScore??0))+'%</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Missing Assets</div><div class="val">'+esc(String(s.missingAssets||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Critical Errors</div><div class="val '+(s.criticalErrors?'fail':'pass')+'">'+esc(String(s.criticalErrors||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Estimated Review Time</div><div class="val">'+esc(String(s.estimatedReviewMinutes||2))+' minutes</div></div>'+
    '</div>'+
    '<div class="cqr-overall '+(s.overallStatus==='READY FOR PUBLISHING'?'ready':'blocked')+'">Overall Status: '+esc(s.overallStatus||'BLOCKED')+'</div>';
  mountWorkflowNav('cqrHero','Customer Pharmacy');
  document.getElementById('cqrTopActions').innerHTML=
    '<button class="btn primary" type="button" onclick="previewGeneratedWebsite()">Preview Website</button>'+
    '<button class="btn secondary" type="button" onclick="downloadQaReport()">Download QA Report</button>';
  const t=review.contentTotals||{};
  const totalRows=[
    ['Website Pages',t.websitePages],['Service Pages',t.servicePages],['Location Pages',t.locationPages],['Blog Posts',t.blogPosts],
    ['Patient Guides',t.patientGuides],['FAQ Pages',t.faqPages],['Images',t.images],['Schemas',t.schemas],
    ['Internal Links',t.internalLinks],['Sitemap',t.sitemap],['Registry',t.registry],['Manifest',t.manifest]
  ];
  document.getElementById('cqrContentTotals').innerHTML=totalRows.map(r=>'<div class="cqr-stat"><div class="lbl">'+esc(r[0])+'</div><div class="val">'+esc(String(r[1]??0))+'</div></div>').join('')+
    (review.locationBreakdown?('<div class="cqr-stat"><div class="lbl">Hub Count</div><div class="val">'+esc(String(review.locationBreakdown.hubCount))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Cluster Count</div><div class="val">'+esc(String(review.locationBreakdown.clusterCount))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Area Page Count</div><div class="val">'+esc(String(review.locationBreakdown.areaPageCount))+'</div></div>'):'')+
    (review.authorisedGenerationJobId?('<div class="cqr-stat"><div class="lbl">Authorised Job ID</div><div class="val" style="font-size:.68rem">'+esc(String(review.authorisedGenerationJobId))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Generation Revision</div><div class="val" style="font-size:.68rem">'+esc(String(review.authorisedGenerationRevision||'—'))+'</div></div>'):'');
  renderCqrPageInspection(review.pageInspectionWorkspace||null);
  document.getElementById('cqrChecks').innerHTML=(review.checks||[]).map(ch=>'<div class="cqr-check"><span>'+esc(ch.label)+'<div style="color:#64748b;font-size:.66rem;margin-top:2px">'+esc(ch.detail)+'</div></span><span class="status '+esc(ch.status)+'">'+esc(ch.status)+'</span></div>').join('');
  const warnSec=document.getElementById('cqrWarningsSection');
  const blockSec=document.getElementById('cqrBlockersSection');
  if((review.warnings||[]).length){warnSec.style.display='block';document.getElementById('cqrWarnings').innerHTML=(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{warnSec.style.display='none';document.getElementById('cqrWarnings').innerHTML=''}
  if((review.blockers||[]).length){blockSec.style.display='block';document.getElementById('cqrBlockers').innerHTML=(review.blockers||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{blockSec.style.display='none';document.getElementById('cqrBlockers').innerHTML=''}
  document.getElementById('cqrPanelStats').innerHTML=
    '<div class="bpr-panel-stat"><div class="lbl">Publishing Readiness</div><div style="font-weight:800;color:'+(s.publishingReadiness==='Ready'?'#4ade80':'#f87171')+'">'+esc(s.publishingReadiness||'Blocked')+'</div></div>'+
    (review.pageInspectionWorkspace?(
      '<div class="bpr-panel-stat" style="margin-top:8px"><div class="lbl">Pages Reviewed</div><div style="font-weight:800">'+esc(String(review.pageInspectionWorkspace.progress.reviewed||0))+' / '+esc(String(review.pageInspectionWorkspace.progress.total||0))+'</div></div>'+
      '<div class="bpr-panel-stat"><div class="lbl">Pages Approved</div><div style="font-weight:800;color:#4ade80">'+esc(String(review.pageInspectionWorkspace.progress.approved||0))+'</div></div>'+
      '<div class="bpr-panel-stat"><div class="lbl">Pages Requiring Changes</div><div style="font-weight:800;color:#f87171">'+esc(String(review.pageInspectionWorkspace.progress.needsChanges||0))+'</div></div>'+
      '<div class="bpr-panel-stat"><div class="lbl">Review Progress</div><div style="font-weight:800">'+esc(String(review.pageInspectionWorkspace.progress.progressPercent||0))+'%</div></div>'
    ):'');
  document.getElementById('cqrPanelWarnings').innerHTML=(review.warnings||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Warnings</li>'+(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')):'';
  document.getElementById('cqrPanelBlockers').innerHTML=(review.blockers||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Blockers</li>'+(review.blockers||[]).map(w=>'<li style="color:#fca5a5">'+esc(w)+'</li>').join('')):'';
  const approveBtn=document.getElementById('cqrApproveBtn');
  const publishBtn=document.getElementById('cqrPublishBtn');
  approveBtn.disabled=!review.canApprove;
  publishBtn.disabled=review.approvalStatus!=='approved';
  document.getElementById('cqrApprovalError').style.display='none';
}
function previewGeneratedWebsite(){
  if(!activeCustomer)return;
  openCqrPagePreview('index');
}
function downloadQaReport(){
  if(!activeCustomer)return;
  window.open('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review/qa-report','_blank');
}
async function openCommercialQualityReview(){
  if(!activeCustomer)return;
  if(!customerAtQualityReview(activeCustomer)){toast('Quality Review is not the current stage for this customer.',true);return}
  document.getElementById('cqrModal').classList.add('open');
  document.getElementById('cqrLoading').style.display='block';
  document.getElementById('cqrContent').style.display='none';
  document.getElementById('cqrError').style.display='none';
  const p=new URLSearchParams(location.search);
  p.set('customer',activeCustomer.slug);
  p.set('panel','quality-review');
  history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review');
    if(!data.review)throw new Error('Review payload missing');
    renderCommercialQualityReview(data.review);
    document.getElementById('cqrLoading').style.display='none';
    document.getElementById('cqrContent').style.display='block';
  }catch(e){
    document.getElementById('cqrLoading').style.display='none';
    document.getElementById('cqrError').style.display='block';
    document.getElementById('cqrErrorDetail').textContent=e.message||String(e);
  }
}
function closeCommercialQualityReview(){
  document.getElementById('cqrModal').classList.remove('open');
  activeCqrReview=null;
  const p=new URLSearchParams(location.search);
  if(p.get('panel')==='quality-review'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function approveCommercialQualityReview(){
  if(!activeCustomer)return;
  const btn=document.getElementById('cqrApproveBtn');
  btn.disabled=true;
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review/approve',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast(data.alreadyApproved?'Quality Review already approved':'Quality Review approved — ready to publish');
    if(data.review)renderCommercialQualityReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    await loadDashboard();
  }catch(e){
    document.getElementById('cqrApprovalError').style.display='block';
    document.getElementById('cqrApprovalErrorMsg').textContent=e.message||String(e);
    if(activeCqrReview)btn.disabled=!activeCqrReview.canApprove;
  }
}
function importStatusLabel(status){return status==='Complete'?'✓ Complete':status==='Failed'?'✗ Failed':'— '+String(status||'Missing')}
function bprJsStr(v){return String(v??'').replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'").replace(/[\\r\\n]/g,' ')}
function bprHoursRowsHtml(days,editable){
  const rows=days&&days.length?days:[{day:'Monday',hours:''},{day:'Tuesday',hours:''},{day:'Wednesday',hours:''},{day:'Thursday',hours:''},{day:'Friday',hours:''},{day:'Saturday',hours:''},{day:'Sunday',hours:''}];
  return '<table class="local-coverage-area-table" style="font-size:.78rem;margin:8px 0"><thead><tr><th>Day</th><th>Opening hours</th></tr></thead><tbody>'+
    rows.map(function(row){
      const day=row.day||'';
      const hours=row.hours||'';
      const cell=editable
        ?'<input type="text" id="bpr-hours-'+esc(String(day).toLowerCase())+'" placeholder="Closed or opening hours" value="'+esc(hours)+'" style="width:100%"/>'
        :esc(hours||'—');
      return '<tr><td>'+esc(day)+'</td><td>'+cell+'</td></tr>';
    }).join('')+
    '</tbody></table>';
}
function bprOpeningHoursCard(f){
  const weekly=f.weeklyHours||{};
  const source=weekly.source||'none';
  const badge=weekly.sourceBadge||(source==='google'?'Imported from Google':source==='website'?'Imported from website':'');
  let html='';
  if(badge) html+='<div style="margin-bottom:8px"><span class="pill">'+esc(badge)+'</span></div>';
  if(source==='conflict'){
    html+='<p class="ci-narrative">Google and website hours differ. Confirm which schedule to use. Hours are not combined.</p>';
    html+='<div class="lbl" style="margin-top:8px">Google</div>'+bprHoursRowsHtml(weekly.googleDays||weekly.days,false);
    html+='<div class="lbl" style="margin-top:8px">Website</div>'+bprHoursRowsHtml(weekly.websiteDays||[],false);
    html+='<div class="bpr-card-actions">'+
      '<button type="button" onclick="bprChooseField(\\''+f.id+'\\',\\'use_google\\',\\''+bprJsStr(f.googleValue||weekly.googleSummary||'')+'\\')">Use Google hours</button>'+
      '<button type="button" onclick="bprChooseField(\\''+f.id+'\\',\\'use_website\\',\\''+bprJsStr(f.websiteValue||weekly.websiteSummary||'')+'\\')">Use website hours</button>'+
      '</div>';
    return html;
  }
  const editable=f.reviewTier==='missing'||source==='none';
  html+=bprHoursRowsHtml(weekly.days,editable);
  if(editable){
    html+='<div class="bpr-card-actions"><button type="button" onclick="bprSaveWeeklyHours()">Save hours</button></div>';
    return html;
  }
  if(f.requiresAction){
    html+='<div class="bpr-card-actions"><button type="button" onclick="bprChooseField(\\''+f.id+'\\',\\'confirm\\',\\''+bprJsStr(f.recommendedValue||f.finalValue||weekly.recommendedSummary||'')+'\\')">Confirm hours</button></div>';
  }
  return html;
}
function bprSaveWeeklyHours(){
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const parts=days.map(function(day){
    const el=document.getElementById('bpr-hours-'+day.toLowerCase());
    const value=el&&el.value?String(el.value).trim():'';
    return value?day+': '+value:'';
  }).filter(Boolean);
  if(!parts.length){toast('Enter at least one day of opening hours',true);return;}
  bprSaveField('openingHoursSummary','manual',parts.join('; '));
}
function bprFieldCardBody(f,showEvidence){
  if(f.id==='openingHoursSummary'||f.inputType==='opening_hours'){
    return bprOpeningHoursCard(f);
  }
  const inputType=f.inputType||'text';
  let actionHtml='';
  if(f.reviewTier==='missing'){
    actionHtml='<div class="bpr-card-actions"><input type="text" id="bpr-manual-'+f.id+'" placeholder="Enter '+esc(f.label.toLowerCase())+'" value="'+esc(f.decision?.finalValue||'')+'"/><button type="button" onclick="bprManualField(\\''+f.id+'\\',\\'manual\\')">Save</button></div>';
  }else{
    const val=f.decision?.finalValue||f.recommendedValue||f.finalValue||'';
    if(inputType==='yes_no'){
      actionHtml='<div class="bpr-card-actions">'+
        '<button type="button" onclick="bprChooseField(\\''+f.id+'\\',\\'confirm\\',\\'Yes\\')">Yes</button>'+
        '<button type="button" onclick="bprChooseField(\\''+f.id+'\\',\\'confirm\\',\\'No\\')">No</button>'+
        '<button type="button" onclick="bprChooseField(\\''+f.id+'\\',\\'confirm\\',\\'Not yet confirmed\\')">Not yet confirmed</button>'+
        '</div>';
    }else{
      actionHtml='<div class="bpr-card-actions">'+
        (val?'<div style="font-size:.72rem;color:#94a3b8;margin-bottom:6px">Recommended: '+esc(val)+'</div>':'')+
        '<button type="button" onclick="bprChooseField(\\''+f.id+'\\',\\'confirm\\',\\''+bprJsStr(val)+'\\')">Confirm</button>'+
        '<input type="text" id="bpr-manual-'+f.id+'" placeholder="Enter value" value="'+esc(val)+'"/>'+
        '<button type="button" onclick="bprManualField(\\''+f.id+'\\',\\'confirm\\')">Save</button>'+
        '</div>';
    }
  }
  return actionHtml;
}
function bprActionItem(f){
  const label=f.commercialActionLabel||('Confirm '+f.label);
  return '<details class="bpr-action-item"><summary><span>'+esc(label)+'</span></summary><div class="bpr-action-body">'+bprFieldCardBody(f,false)+'</div></details>';
}
function renderBprGoogleSection(review){
  const s=review.summary||{};
  const panel=document.getElementById('bprGooglePanel');
  const opp=document.getElementById('bprGoogleOpportunity');
  const actions=document.getElementById('bprGoogleActions');
  if(!panel||!opp||!actions)return;
  panel.innerHTML=
    '<div><span class="label">Status</span><div>'+esc(s.googleSectionStatus||'—')+'</div></div>'+
    '<div><span class="label">Policy</span><div>'+esc(s.googleProfileState||'—')+'</div></div>'+
    '<div><span class="label">Place ID</span><div>'+(s.googlePlaceId?'<code>'+esc(s.googlePlaceId)+'</code>':'Not connected')+'</div></div>'+
    '<div><span class="label">Import status</span><div>'+esc(s.googleImportStatus||'Not connected')+'</div></div>'+
    '<div><span class="label">Detail</span><div style="font-size:.72rem;color:#94a3b8">'+esc(s.googleSectionDetail||'')+'</div></div>';
  if(s.googleGrowthOpportunity){
    opp.style.display='block';
    opp.innerHTML='<strong>Growth opportunity</strong><div style="font-size:.78rem;margin-top:4px">'+esc(s.googleGrowthOpportunity)+'</div>';
  }else{opp.style.display='none';opp.innerHTML=''}
  const gs=activeCustomer&&activeCustomer.googleSource?activeCustomer.googleSource:{};
  const canEdit=gs.canEditGoogle!==false;
  const hasUrl=Boolean(s.googlePlaceId||gs.googleBusinessProfileUrl||gs.placeId);
  const state=s.googleProfileState||'unknown';
  let actionHtml='';
  if(state==='no_profile'){
    actionHtml=
      '<button class="btn secondary" type="button" onclick="addGoogleProfile()">Search for or connect a profile</button>'+
      '<button class="btn secondary" type="button" onclick="openOnboardingIntakeModal()">Confirm no Google profile</button>';
  }else if(state==='deferred'){
    actionHtml='<button class="btn secondary" type="button" onclick="addGoogleProfile()">Connect profile now</button>';
  }else if(state==='unknown'){
    actionHtml=
      '<button class="btn secondary" type="button" onclick="addGoogleProfile()">Connect a Google profile</button>'+
      '<button class="btn secondary" type="button" onclick="openOnboardingIntakeModal()">Choose Google policy</button>';
  }else{
    actionHtml=
      '<button class="btn secondary" type="button" onclick="addGoogleProfile()" '+(!canEdit?'disabled':'')+'>'+(hasUrl?'Change Google Business Profile':'Add Google Business Profile')+'</button>'+
      (hasUrl?'<button class="btn secondary" type="button" onclick="changeGoogleProfileUrl()" '+(canEdit?'':'disabled')+'>Change profile URL</button>':'')+
      googleImportActionButtonHtml(gs,canEdit);
  }
  actions.innerHTML=actionHtml;
  renderManualBrandConfirmation(review);
}
function renderManualBrandConfirmation(review){
  const host=document.getElementById('bprGoogleActions');
  if(!host)return;
  const offer=review&&review.manualBrandConfirmation;
  if(!offer)return;
  if(offer.confirmed&&offer.value){
    host.insertAdjacentHTML('beforeend','<div style="flex-basis:100%;font-size:.72rem;color:#4ade80;margin-top:6px">Brand source confirmed from onboarding business information. Google remains '+esc(offer.googleProfileState||'deferred')+'.</div>');
    return;
  }
  if(!offer.available)return;
  host.insertAdjacentHTML('beforeend','<button class="btn" type="button" id="confirmManualBrandSourceBtn" style="font-size:.72rem" onclick="confirmManualOnboardingBrandSource()">Confirm brand source from business information</button><div style="flex-basis:100%;font-size:.72rem;color:#94a3b8">Uses the pharmacy name and website already captured. Does not connect Google and does not invent website import evidence.</div>');
}
async function confirmManualOnboardingBrandSource(){
  if(!activeCustomer)return;
  const btn=document.getElementById('confirmManualBrandSourceBtn');
  if(btn)btn.disabled=true;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review/confirm-manual-brand-source',{method:'POST',body:'{}'});
    if(!data.ok)throw new Error(data.error||'Brand source confirmation failed');
    if(data.review){activeBprReview=data.review;renderBusinessProfileReview(data.review)}
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    toast('Brand source confirmed from onboarding business information. Google remains not connected.');
  }catch(e){
    if(btn)btn.disabled=false;
    toast(e.message||'Brand source confirmation failed',true);
  }
}
let activeImportedEvidenceReview=null;
function ierEvidenceRowHtml(row){
  const statusClass=row.status==='Confirmed'?'ok':row.status==='Needs Review'?'warn':'';
  return '<tr><td>'+esc(row.label)+'</td><td>'+esc(row.value)+'</td><td style="font-size:.68rem;max-width:180px;overflow:hidden;text-overflow:ellipsis">'+esc(row.sourceUrl)+'</td><td>'+esc(row.extractionMethod)+'</td><td>'+(row.confidence!=null?esc(String(row.confidence)):'—')+'</td><td style="font-size:.68rem">'+esc(row.capturedAt||'—')+'</td><td class="'+statusClass+'">'+esc(row.status)+'</td></tr>';
}
function ierEvidenceTable(rows,group){
  const filtered=(rows||[]).filter(r=>!group||r.group===group);
  if(!filtered.length)return '<p class="ci-narrative">No evidence rows for this section.</p>';
  return '<div style="overflow:auto;max-height:320px"><table class="local-coverage-area-table" style="font-size:.72rem"><thead><tr><th>Field</th><th>Value</th><th>Source URL</th><th>Method</th><th>Conf.</th><th>Captured</th><th>Status</th></tr></thead><tbody>'+filtered.map(ierEvidenceRowHtml).join('')+'</tbody></table></div>';
}
function renderBranchSelectionPanel(branchSelection){
  const section=document.getElementById('ierBranchSection');
  const panel=document.getElementById('ierBranchPanel');
  if(!section||!panel)return;
  if(branchSelection)lastRenderedBranchSelection=branchSelection;
  const bs=branchSelection||lastRenderedBranchSelection||{};
  const resolution=bs.resolution||{};
  const branches=resolution.detectedBranches||[];
  const requires=bs.requiresSelection||resolution.status==='branch_selection_required';
  if(!requires&&resolution.status!=='branch_selected'){
    section.style.display='none';
    panel.innerHTML='';
    return;
  }
  section.style.display='block';
  const parent=resolution.parentBrand||{};
  let html='<p class="ci-narrative">This website lists multiple pharmacy branches. Select the branch being onboarded for this customer. Shared parent branding is preserved separately.</p>';
  if(parent.tradingName){
    html+='<div class="bpr-panel-stat" style="margin-bottom:10px"><div class="lbl">Parent brand</div><div style="font-weight:700;margin-top:4px">'+esc(parent.tradingName)+'</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">'+esc(parent.parentWebsite||'')+'</div></div>';
  }
  if(resolution.status==='branch_selected'&&resolution.selectedBranch){
    const sb=resolution.selectedBranch;
    html+='<div class="cqr-overall ready" style="margin-bottom:10px">Selected branch: '+esc(sb.branchName)+'</div>';
    html+='<div style="font-size:.72rem;color:#94a3b8">Google match: '+esc(bs.googleBranchMatchStatus||resolution.googleBranchMatchStatus||'pending')+'</div>';
    if((resolution.googleBranchMatchNotes||[]).length){
      html+='<ul class="cqr-list" style="margin-top:8px">'+(resolution.googleBranchMatchNotes||[]).map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>';
    }
  }
  if(branches.length){
    html+='<div style="overflow:auto;max-width:100%;margin-top:10px"><table class="local-coverage-area-table" style="font-size:.72rem;min-width:960px"><thead><tr><th>Action</th><th>Pharmacy name</th><th>Address</th><th>Town/City</th><th>Postcode</th><th>Telephone</th><th>Website URL</th><th>Confidence</th><th>Source</th><th>Google candidate</th></tr></thead><tbody>';
    html+=branches.map(b=>{
      const selected=resolution.selectedBranchId===b.branchId;
      const googleLabel=b.googleBusinessName?esc(b.googleBusinessName)+' ('+esc(b.googlePlaceId||'—')+')':(b.googlePlaceId?esc(b.googlePlaceId):'—');
      const sourceLabel=(b.evidenceSources&&b.evidenceSources.length)?esc(b.evidenceSources.map(s=>s.detectionMethod).join(', ')):'website-import';
      const conf=b.googleMatchConfidence!=null?String(b.googleMatchConfidence):(b.detectionSignals&&b.detectionSignals.length?'85':'—');
      const actionCell=selected
        ?'<span style="color:#4ade80;white-space:nowrap">Confirmed</span>'
        :requires
          ?'<button class="btn" type="button" style="font-size:.72rem;padding:6px 10px;white-space:nowrap" data-ier-branch-select="1" data-branch-id="'+esc(b.branchId)+'">Use This Pharmacy</button>'
          :'';
      return '<tr'+(selected?' style="background:#0f2f23"':'')+'><td>'+actionCell+'</td><td><strong>'+esc(b.branchName||'Unnamed branch')+'</strong><div style="color:#64748b">'+esc(b.parentBrandName||'')+'</div></td><td>'+esc(b.addressLine1||'—')+(b.addressLine2?('<div>'+esc(b.addressLine2)+'</div>'):'')+'</td><td>'+esc(b.town||'—')+'</td><td>'+esc(b.postcode||'—')+'</td><td>'+esc(b.phone||'—')+'</td><td>'+(b.branchUrl?'<a href="'+esc(b.branchUrl)+'" target="_blank" rel="noopener">'+esc(b.branchUrl)+'</a>':'—')+'</td><td>'+esc(conf)+'</td><td style="font-size:.65rem">'+sourceLabel+'</td><td>'+googleLabel+'</td></tr>';
    }).join('');
    html+='</tbody></table></div>';
  }else if(requires){
    html+='<div class="bpr-error-panel" style="margin-top:10px"><p style="margin:0 0 8px">No reliable branch list was detected. Enter the branch details from imported evidence.</p></div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px;font-size:.72rem">'+
      '<label>Pharmacy name<input id="manualBranchName" style="width:100%"/></label>'+
      '<label>Address<input id="manualBranchAddress" style="width:100%"/></label>'+
      '<label>Town/City<input id="manualBranchTown" style="width:100%"/></label>'+
      '<label>Postcode<input id="manualBranchPostcode" style="width:100%"/></label>'+
      '<label>Telephone<input id="manualBranchPhone" style="width:100%"/></label>'+
      '<label>Website URL<input id="manualBranchUrl" style="width:100%"/></label></div>'+
      '<button class="btn" type="button" style="margin-top:10px" onclick="confirmManualWebsiteBranch()">Use this pharmacy branch</button>';
  }
  if(requires){
    html+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn secondary" type="button" onclick="runGoogleCandidateSearch()">Search Google match</button><button class="btn secondary" type="button" onclick="markNoneOfTheseBranches()">None of these branches</button><button class="btn secondary" type="button" onclick="closeImportedEvidenceReview();openOnboardingIntakeModal()">Return to onboarding setup</button></div>';
  }
  panel.innerHTML=html;
}
function brandSwatch(value){
  const hex=String(value||'');
  if(!/^#[0-9a-fA-F]{3,8}$/.test(hex))return esc(hex||'Not found');
  return '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:6px;background:'+hex+'"></span>'+esc(hex);
}
function brandLine(label, item){
  const status=(item&&item.status)||'NOT FOUND';
  const value=(item&&item.value)||'';
  const shown=/^#[0-9a-fA-F]{3,8}$/.test(String(value||''))?brandSwatch(value):esc(value||'Not found');
  return '<div class="bpr-panel-stat"><div class="lbl">'+esc(label)+'</div><div style="font-weight:700;margin-top:4px">'+shown+'</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">'+esc(status)+(item&&item.method?(' · '+esc(item.method)):'')+(item&&item.sourceRevision?(' · '+esc(item.sourceRevision)):'')+'</div></div>';
}
function renderImportedBrandStyle(brand){
  const el=document.getElementById('ierBrandStyle');
  if(!el)return;
  if(!brand){el.innerHTML='<p class="ci-narrative">Brand evidence has not been read.</p>';return}
  const logo=brand.logo||{};
  const logoUrl=String(logo.assetUrl||logo.value||'');
  const logoIsHttp=logoUrl.indexOf('http://')===0||logoUrl.indexOf('https://')===0;
  const logoHtml=logoIsHttp?'<img src="'+esc(logoUrl)+'" alt="Imported logo" style="max-height:48px;max-width:220px;background:#fff;padding:6px;border-radius:6px"/>':'<span>Not found</span>';
  const nav=(brand.headerNavigation||[]).slice(0,12).map(esc).join(' · ')||'Not found';
  const footer=(brand.footerLinks||[]).slice(0,12).map(esc).join(' · ')||'Not found';
  const social=(brand.socialLinks||[]).slice(0,6).map(esc).join(' · ')||'Not found';
  const images=(brand.imagery||[]).slice(0,6).map(function(img){return esc(img.role||'asset')+': '+esc(img.url||'');}).join('<br>')||'Not found';
  const pages=(brand.structure||[]).slice(0,8).map(function(page){return esc(page.category||'page')+' · '+esc(page.title||page.url||'');}).join('<br>')||'Not found';
  el.innerHTML=
    '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><div>'+logoHtml+'</div><div style="font-size:.72rem;color:#94a3b8">'+esc(logo.status||'NOT FOUND')+' · '+esc(logo.method||'')+'</div></div>'+
    '<div class="bpr-panel-stat" style="margin-bottom:8px"><div class="lbl">Source</div><div style="margin-top:4px">'+esc(brand.primaryUrl||'—')+'</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">'+esc(brand.method||'')+' · '+esc(brand.sourceRevision||'')+' · '+esc(brand.capturedAt||'')+'</div></div>'+
    brandLine('Favicon', brand.favicon)+
    brandLine('Primary colour', brand.primaryColour)+
    brandLine('Secondary colour', brand.secondaryColour)+
    brandLine('Accent colour', brand.accentColour)+
    '<div class="bpr-panel-stat"><div class="lbl">Palette</div><div style="margin-top:4px">'+((brand.palette||[]).slice(0,12).map(function(item){return brandSwatch(item.value);}).join(' ')||'Not found')+'</div></div>'+
    brandLine('Heading font', brand.headingFont)+
    brandLine('Body font', brand.bodyFont)+
    brandLine('Header', brand.headerSummary)+
    '<div class="bpr-panel-stat"><div class="lbl">Navigation</div><div style="margin-top:4px">'+nav+'</div></div>'+
    brandLine('Header CTA', brand.headerCta)+
    brandLine('Footer', brand.footerSummary)+
    '<div class="bpr-panel-stat"><div class="lbl">Footer links</div><div style="margin-top:4px">'+footer+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Footer contact</div><div style="margin-top:4px">'+((brand.footerContact||[]).slice(0,6).map(esc).join(' · ')||'Not found')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Footer legal</div><div style="margin-top:4px">'+((brand.footerLegal||[]).slice(0,6).map(esc).join(' · ')||'Not found')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Social</div><div style="margin-top:4px">'+social+'</div></div>'+
    brandLine('Imagery', brand.imagerySummary)+
    '<div class="bpr-panel-stat"><div class="lbl">Discovered assets</div><div style="margin-top:4px;font-size:.72rem">'+images+'</div></div>'+
    brandLine('Website structure', brand.structureSummary)+
    '<div class="bpr-panel-stat"><div class="lbl">Pages</div><div style="margin-top:4px;font-size:.72rem">'+pages+'</div></div>'+
    brandLine('Visual style', brand.styleSummary);
}
function renderImportedEvidenceReview(review){
  activeImportedEvidenceReview=review;
  document.getElementById('ierHero').innerHTML='<h4>'+esc(review.pharmacyName||review.slug)+'</h4><p class="ci-narrative">'+esc(review.summary||'')+'</p><div class="cqr-overall '+(review.tenantIsolation&&review.tenantIsolation.passed?'ready':'blocked')+'">'+(review.tenantIsolation&&review.tenantIsolation.passed?'Tenant isolation: PASS':'Tenant isolation: BLOCKED')+'</div>';
  mountWorkflowNav('ierHero','Customer Pharmacy');
  renderBranchSelectionPanel(review.branchSelection);
  const iso=review.tenantIsolation||{passed:true,blockers:[],checks:[]};
  document.getElementById('ierIsolation').innerHTML=(iso.checks||[]).map(c=>'<div style="margin:4px 0;color:'+(c.passed?'#4ade80':'#f87171')+'">'+(c.passed?'✓':'✗')+' '+esc(c.detail)+'</div>').join('')+(iso.blockers&&iso.blockers.length?'<div class="bpr-error-panel" style="margin-top:8px">'+iso.blockers.map(b=>'<div>'+esc(b)+'</div>').join('')+'</div>':'');
  document.getElementById('ierWebsiteEvidence').innerHTML=ierEvidenceTable(review.websiteEvidence);
  renderImportedBrandStyle(review.websiteBrand);
  const googleImportHtml=review.googleProfileState==='no_profile'
    ?'<p class="ci-narrative">Product Owner declared: No Google Business Profile.</p>'
    :(!review.googleImported
      ?'<p class="ci-narrative"><strong>NOT IMPORTED</strong> — Google Import Evidence shows only values obtained from a Google import. Profile/onboarding values are listed separately when present.</p>'+ierEvidenceTable(review.googleEvidence)+(review.googleProfileReconciliation&&review.googleProfileReconciliation.length?'<p class="ci-narrative" style="margin-top:10px">Profile / onboarding (not Google import):</p>'+ierEvidenceTable(review.googleProfileReconciliation):'')
      :ierEvidenceTable(review.googleEvidence));
  document.getElementById('ierGoogleEvidence').innerHTML=googleImportHtml;
  document.getElementById('ierGoogleSearch').innerHTML=
    '<p class="ci-narrative" style="margin-bottom:8px">Search for the pharmacy Google listing. Paste a Maps URL or leave blank to search by business name and postcode.</p>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="ierGoogleSearchInput" placeholder="Google Maps URL (optional)" style="flex:1;min-width:200px"/><button class="btn secondary" type="button" onclick="runGoogleCandidateSearch()">Search Google Listings</button></div>';
  const candidates=review.googleCandidates||[];
  const branchBlocked=Boolean(review.branchSelection&&review.branchSelection.requiresSelection);
  document.getElementById('ierGoogleCandidates').innerHTML=candidates.length?('<table class="local-coverage-area-table" style="font-size:.72rem"><thead><tr><th>Business</th><th>Address</th><th>Place ID</th><th>Rating</th><th></th></tr></thead><tbody>'+candidates.map(c=>'<tr><td>'+esc(c.businessName)+'</td><td>'+esc(c.address)+'</td><td><code>'+esc(c.placeId)+'</code></td><td>'+(c.rating!=null?esc(String(c.rating)):'—')+'</td><td>'+(branchBlocked?'<button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px" disabled title="Website branch selection is required before Google listing selection.">Select</button>':'<button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px" data-place-id="'+esc(c.placeId)+'" onclick="selectGoogleCandidate(this.dataset.placeId)">Select</button>')+'</td></tr>').join('')+'</tbody></table>'):'<p class="ci-narrative">No search results yet — run Search Google Listings.</p>';
  const cmp=review.comparison||[];
  const cmpState=review.comparisonState||(cmp.length?'available':'suppressed');
  document.getElementById('ierComparison').innerHTML=cmpState==='not_applicable'
    ?'<p class="ci-narrative">Website vs Google comparison not applicable — no Google Business Profile.</p>'
    :(cmpState!=='available'||!cmp.length)
      ?'<p class="ci-narrative">Website vs Google comparison suppressed — Google Import has not been executed.</p>'
      :('<table class="local-coverage-area-table" style="font-size:.72rem"><thead><tr><th>Field</th><th>Website</th><th>Google</th><th>Match</th></tr></thead><tbody>'+cmp.map(r=>'<tr><td>'+esc(r.label)+'</td><td>'+esc(r.websiteValue)+'</td><td>'+esc(r.googleValue)+'</td><td>'+esc(r.matchStatus)+'</td></tr>').join('')+'</tbody></table>');
  const eq=review.evidenceQuality||null;
  const crawl=review.crawlCoverage||null;
  const eqLabel=eq?(eq.safeForBusinessProfileReview?'SAFE FOR REVIEW':(eq.technicallyComplete?'TECHNICALLY COMPLETE — BLOCKED':'INCOMPLETE')):'—';
  const reimportRequired=Boolean(review.websiteReimportRequired);
  const reimportAvailable=Boolean(review.websiteReimportAvailable||review.websiteReimportActionId==='rerun_website_import'||review.websiteImported);
  const reimportTarget=esc(review.websiteReimportTargetUrl||review.websiteUrl||'');
  const correctivePanel=reimportRequired
    ?('<div class="bpr-error-panel" style="margin-top:10px;grid-column:1/-1">'+
      '<div style="font-weight:800;margin-bottom:6px">Website re-import required</div>'+
      '<div style="margin-bottom:8px">'+esc(review.summary||'Fresh website re-import is required to populate repaired Website Intelligence evidence.')+'</div>'+
      (eq&&eq.blockers&&eq.blockers.length?eq.blockers.map(function(b){return '<div style="margin:2px 0">'+esc(b)+'</div>';}).join(''):'')+
      '<div style="font-size:.72rem;color:#94a3b8;margin:8px 0">Target website: '+(reimportTarget||'—')+'</div>'+
      '<button class="btn" type="button" id="ierReimportWebsiteBtn" onclick="reimportWebsiteFromEvidenceReview()">Re-import Website</button>'+
      '</div>')
    :(eq&&eq.blockers&&eq.blockers.length?'<div class="bpr-error-panel" style="margin-top:10px;grid-column:1/-1">'+eq.blockers.map(function(b){return '<div>'+esc(b)+'</div>';}).join('')+'</div>':'');
  const optionalReimportPanel=(!reimportRequired&&reimportAvailable)
    ?('<div style="margin-top:10px;grid-column:1/-1;padding:10px;border:1px solid #334155;border-radius:8px">'+
      '<div style="font-weight:700;margin-bottom:4px">Website Import</div>'+
      '<div style="font-size:.72rem;color:#94a3b8;margin-bottom:8px">Optional — run a fresh website analysis for '+(reimportTarget||'the canonical website')+'. The current active snapshot will be archived and replaced. Google Import will not run.</div>'+
      '<button class="btn secondary" type="button" id="ierReimportWebsiteBtn" onclick="reimportWebsiteFromEvidenceReview()">Re-import Website</button>'+
      '</div>')
    :'';
  document.getElementById('ierPanelSummary').innerHTML=
    '<div class="bpr-panel-stat"><div class="lbl">Website imported</div><div style="font-weight:700;margin-top:4px">'+(review.websiteImported?'Yes':'No')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Google imported</div><div style="font-weight:700;margin-top:4px">'+(review.googleImported?'Yes':review.googleProfileState==='no_profile'?'N/A (none)':'No')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Evidence quality</div><div style="font-weight:700;margin-top:4px">'+esc(eqLabel)+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">HTML pages analysed</div><div style="font-weight:700;margin-top:4px">'+(crawl?esc(String(crawl.contentPagesAnalysed)):(eq?esc(String(eq.contentPagesAnalysed)):'—'))+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Google policy</div><div style="font-weight:700;margin-top:4px">'+esc(review.googleProfileState||'—')+'</div></div>'+
    correctivePanel+
    optionalReimportPanel+
    (review.acceptance&&review.acceptance.accepted
      ?'<div style="margin-top:12px;grid-column:1/-1"><div style="font-weight:700;color:#4ade80">Imported evidence accepted</div><button class="btn" type="button" id="ierContinueBusinessProfileBtn" style="width:100%;margin-top:8px" onclick="continueToBusinessProfileReview()">Continue to Business Profile Review</button></div>'
      :(review.acceptance&&review.acceptance.ready
        ?'<div style="margin-top:12px;grid-column:1/-1"><button class="btn" type="button" id="ierAcceptEvidenceBtn" style="width:100%" onclick="acceptImportedEvidenceReview()">Accept Imported Evidence</button></div>'
        :(review.acceptance&&review.acceptance.unavailableReason?'<div style="margin-top:12px;grid-column:1/-1;font-size:.72rem;color:#94a3b8">'+esc(review.acceptance.unavailableReason)+'</div>':'')))+
    (crawl&&crawl.pages&&crawl.pages.length?'<div style="margin-top:10px;grid-column:1/-1;font-size:.68rem"><div class="lbl" style="margin-bottom:4px">Crawl coverage</div><table class="local-coverage-area-table"><thead><tr><th>URL</th><th>Source</th><th>Class</th><th>Title</th></tr></thead><tbody>'+crawl.pages.slice(0,20).map(function(p){return '<tr><td>'+esc(p.url)+'</td><td>'+esc(p.discoverySource)+'</td><td>'+esc(p.category)+'</td><td>'+esc(p.title||p.h1||'—')+'</td></tr>';}).join('')+'</tbody></table></div>':'');
  document.getElementById('ierLoading').style.display='none';
  document.getElementById('ierError').style.display='none';
  document.getElementById('ierContent').style.display='block';
}
async function acceptImportedEvidenceReview(){
  if(!activeCustomer){toast("Open a customer first",true);return}
  const review=activeImportedEvidenceReview||{};
  if(!review.acceptance||!review.acceptance.ready||review.acceptance.accepted){
    toast((review.acceptance&&review.acceptance.unavailableReason)||"Imported evidence is not ready to accept",true);
    return;
  }
  if(!confirm("Accept the reviewed imported evidence for "+(activeCustomer.pharmacyName||activeCustomer.slug)+" and continue to Business Profile Review?"))return;
  const btn=document.getElementById("ierAcceptEvidenceBtn");
  if(btn){btn.disabled=true;btn.textContent="Accepting…"}
  try{
    const data=await api("/api/master-admin-platform/customers/"+encodeURIComponent(activeCustomer.slug)+"/imported-evidence-review/accept",{method:"POST",body:"{}"});
    if(data.review)renderImportedEvidenceReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    toast("Imported evidence accepted");
    closeImportedEvidenceReview();
    openBusinessProfileReview();
  }catch(e){
    toast(e.message||String(e),true);
    if(btn){btn.disabled=false;btn.textContent="Accept Imported Evidence"}
  }
}
function continueToBusinessProfileReview(){
  closeImportedEvidenceReview();
  openBusinessProfileReview();
}
async function reimportWebsiteFromEvidenceReview(){
  if(!activeCustomer){toast("Open a customer first",true);return}
  const review=activeImportedEvidenceReview||{};
  const available=Boolean(review.websiteReimportAvailable||review.websiteReimportRequired||review.websiteReimportActionId==="rerun_website_import"||review.websiteImported);
  if(!available){toast("Website re-import is not available for the current evidence state",true);return}

  const target=review.websiteReimportTargetUrl||review.websiteUrl||(activeCustomer.websiteSource&&activeCustomer.websiteSource.canonicalWebsite)||activeCustomer.website||"";
  if(!confirm("Re-import Website for "+((activeCustomer.pharmacyName||activeCustomer.slug)||"this customer")+" from "+target+"?\\n\\nThis archives the current website import snapshot and runs a fresh website analysis using the existing website import capability. The current active snapshot will be replaced."))return;

  const btn=document.getElementById("ierReimportWebsiteBtn");
  if(btn){btn.disabled=true;btn.textContent="Queuing…"}

  try{
    const data=await api("/api/master-admin-platform/customers/"+encodeURIComponent(activeCustomer.slug)+"/actions/rerun_website_import",{method:"POST",body:"{}"});
    const jobId=data.jobId;

    if(!jobId)throw new Error("Website re-import did not return a job ID");

    toast("Website re-import queued");

    for(let attempt=0;attempt<120;attempt++){
      await new Promise(resolve=>setTimeout(resolve,1000));

      const jobsData=await api("/api/master-admin-platform/jobs?limit=20");
      const jobs=jobsData.jobs||[];
      const job=jobs.find(j=>String(j.id||j.jobId||"")===String(jobId));

      if(!job)continue;

      if(job.status==="completed"){
        toast("Website re-import completed");
        await openImportedEvidenceReview();
        return;
      }

      if(job.status==="failed"||job.status==="cancelled"){
        throw new Error(job.error||job.progressLabel||"Website re-import failed");
      }

      if(btn){
        btn.disabled=true;
        btn.textContent=(job.status==="running"||job.status==="claimed")
          ?"Re-importing…"
          :"Queuing…";
      }
    }

    throw new Error("Website re-import status timed out");
  }catch(e){
    toast(e.message||String(e),true);
    if(btn){btn.disabled=false;btn.textContent="Re-import Website"}
  }
}
function closeImportedEvidenceReview(){
  document.getElementById('ierModal').classList.remove('open');
  activeImportedEvidenceReview=null;
  pendingWebsiteBranchId=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='imported-evidence-review'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
function bindIerBranchSelectionControls(){
  const panel=document.getElementById('ierBranchPanel');
  if(!panel||panel.dataset.branchSelectBound==='1')return;
  panel.dataset.branchSelectBound='1';
  panel.addEventListener('click',function(e){
    const btn=e.target&&e.target.closest?e.target.closest('[data-ier-branch-select]'):null;
    if(!btn||btn.disabled)return;
    const branchId=btn.getAttribute('data-branch-id');
    selectWebsiteBranch(branchId);
  });
}
async function openImportedEvidenceReview(){
  if(!activeCustomer){toast('Open a customer first',true);return}
  document.getElementById('ierModal').classList.add('open');
  document.getElementById('ierLoading').style.display='block';
  document.getElementById('ierContent').style.display='none';
  document.getElementById('ierError').style.display='none';
  pushWorkflowPanelNav(null,'imported-evidence-review');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/imported-evidence-review');
    if(!data.review)throw new Error(data.error||'Imported evidence unavailable');
    renderImportedEvidenceReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){
    document.getElementById('ierLoading').style.display='none';
    document.getElementById('ierError').style.display='block';
    document.getElementById('ierErrorDetail').textContent=e.message||String(e);
  }
}
function openGoogleCandidateSearch(){openImportedEvidenceReview()}
async function runGoogleCandidateSearch(){
  if(!activeCustomer)return;
  const input=document.getElementById('ierGoogleSearchInput');
  const url=input?input.value.trim():'';
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/google-candidates/search',{method:'POST',body:JSON.stringify({googleBusinessUrl:url||undefined})});
    toast('Google search completed — select the correct listing');
    if(data.review)renderImportedEvidenceReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function openImportedEvidenceReviewFromOnboarding(){
  pushWorkflowNav({open:()=>{if(activeCustomer)openCustomer(activeCustomer.slug);}});
  return openImportedEvidenceReview();
}
function stageWebsiteBranch(branchId){
  const id=String(branchId||'').trim();
  if(!id){toast('Branch identifier missing — try again or refresh the panel',true);return;}
  pendingWebsiteBranchId=id;
  const bs=(activeImportedEvidenceReview&&activeImportedEvidenceReview.branchSelection)||lastRenderedBranchSelection;
  renderBranchSelectionPanel(bs);
}
async function confirmStagedWebsiteBranch(){
  if(!pendingWebsiteBranchId)return;
  await selectWebsiteBranch(pendingWebsiteBranchId);
  pendingWebsiteBranchId=null;
}
async function confirmManualWebsiteBranch(){
  if(!activeCustomer)return;
  const body={
    branchName:document.getElementById('manualBranchName')?.value||'',
    addressLine1:document.getElementById('manualBranchAddress')?.value||'',
    town:document.getElementById('manualBranchTown')?.value||'',
    postcode:document.getElementById('manualBranchPostcode')?.value||'',
    phone:document.getElementById('manualBranchPhone')?.value||'',
    branchUrl:document.getElementById('manualBranchUrl')?.value||activeCustomer.website||''
  };
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/website-branches/manual-confirm',{method:'POST',body:JSON.stringify(body)});
    toast('Pharmacy branch confirmed');
    if(data.review)renderImportedEvidenceReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function selectWebsiteBranch(branchId){
  if(!activeCustomer||!branchId)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/website-branches/select',{method:'POST',body:JSON.stringify({branchId:branchId})});
    toast('Branch confirmed — Website Import updated');
    if(data.review)renderImportedEvidenceReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e,true)}
}
async function markNoneOfTheseBranches(){
  if(!activeCustomer)return;
  if(!confirm('Confirm that none of the detected website branches match this customer?'))return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/website-branches/none',{method:'POST',body:'{}'});
    toast('Recorded: none of these branches');
    if(data.review)renderImportedEvidenceReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e.message,true)}
}
async function selectGoogleCandidate(placeId){
  if(!activeCustomer||!placeId)return;
  if(activeImportedEvidenceReview&&activeImportedEvidenceReview.branchSelection&&activeImportedEvidenceReview.branchSelection.requiresSelection){
    toast('Website branch selection is required before Google listing selection.',true);
    return;
  }
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/google-candidates/select',{method:'POST',body:JSON.stringify({placeId:placeId})});
    toast('Google listing selected — confirm in Google Business Profile panel');
    if(data.review)renderImportedEvidenceReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){toast(e,true)}
}
function renderBusinessProfileReview(review){
  review=normalizeBusinessProfileReviewPayload(review);
  activeBprReview=review;
  bprDecisions={};
  const s=review.summary||{};
  const authority=bprCanonicalApproval(review);
  const confirmFields=review.needsConfirmation||[];
  const missingFields=review.missingInformation||[];
  const recommendedCount=s.recommendedCount||review.recommendedValues?.length||0;
  document.getElementById('bprHero').innerHTML=
    '<h4>Business Profile Review — '+esc(s.pharmacyName||'')+'</h4>'+
    '<div class="bpr-hero-grid">'+
    '<div class="stat"><div class="lbl">Website Import</div><div class="val ok">'+importStatusLabel(s.websiteImportStatus)+'</div></div>'+
    '<div class="stat"><div class="lbl">Google Import</div><div class="val ok">'+importStatusLabel(s.googleImportStatus)+'</div></div>'+
    '<div class="stat"><div class="lbl">Automatically Verified</div><div class="val ok">'+esc(String(s.verifiedCount||s.automaticallyVerified||0))+' fields</div></div>'+
    '<div class="stat"><div class="lbl">Recommended</div><div class="val ok">'+esc(String(recommendedCount))+' values</div></div>'+
    '<div class="stat"><div class="lbl">Needs Your Attention</div><div class="val '+(authority.remainingConfirmations+missingFields.length?'warn':'ok')+'">'+esc(String(authority.remainingConfirmations))+' confirmations</div></div>'+
    '<div class="stat"><div class="lbl">Estimated Review Time</div><div class="val">'+esc(String(s.estimatedReviewMinutes||2))+' minute'+(s.estimatedReviewMinutes===1?'':'s')+'</div></div>'+
    '</div>'+
    '<div class="bpr-hero-status '+(authority.canApprove?'bpr-ready':'bpr-not-ready')+'">Overall Status: '+esc(authority.readinessLabel||'')+'</div>';
  mountWorkflowNav('bprHero','Customer Pharmacy');
  document.getElementById('bprActionRequired').innerHTML=confirmFields.length?confirmFields.map(bprActionItem).join(''):'<div class="empty" style="padding:16px;text-align:center;color:#4ade80">No confirmations required.</div>';
  document.getElementById('bprMissingSection').style.display=missingFields.length?'block':'none';
  document.getElementById('bprMissingInformation').innerHTML=missingFields.length?missingFields.map(bprActionItem).join(''):'';
  const optionalFields=(review.optionalFields||[]).filter(function(f){return f.id==='openingHoursSummary'||!String(f.id||'').startsWith('openingHours_');});
  const notApplicableFields=(review.notApplicableFields||[]).filter(function(f){return f.id==='openingHoursSummary'||!String(f.id||'').startsWith('openingHours_');});
  const optSec=document.getElementById('bprOptionalSection');
  const naSec=document.getElementById('bprNotApplicableSection');
  if(optSec){
    optSec.style.display=optionalFields.length?'block':'none';
    const optHost=document.getElementById('bprOptionalInformation');
    if(optHost)optHost.innerHTML=optionalFields.length?optionalFields.map(function(f){return '<div class="bpr-action-item" style="opacity:.9"><div style="font-weight:700">'+esc(f.label||f.id)+' <span class="pill">Optional</span></div><div style="font-size:.72rem;color:#94a3b8;margin-top:4px">'+esc(f.evidenceSource||f.displayStatus||'Optional for this business context')+'</div></div>';}).join(''):'';
  }
  if(naSec){
    naSec.style.display=notApplicableFields.length?'block':'none';
    const naHost=document.getElementById('bprNotApplicableInformation');
    if(naHost)naHost.innerHTML=notApplicableFields.length?notApplicableFields.map(function(f){return '<div class="bpr-action-item" style="opacity:.85"><div style="font-weight:700">'+esc(f.label||f.id)+' <span class="pill">Not applicable</span></div><div style="font-size:.72rem;color:#94a3b8;margin-top:4px">'+esc(f.evidenceSource||'Not applicable for this business classification')+'</div></div>';}).join(''):'';
  }
  document.getElementById('bprPanelStats').innerHTML=
    '<div class="bpr-panel-stat"><div class="lbl">Remaining confirmations</div><div style="font-weight:700;margin-top:4px">'+authority.remainingConfirmations+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Missing information</div><div style="font-weight:700;margin-top:4px">'+missingFields.length+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Approval readiness</div><div style="font-weight:700;margin-top:4px;color:'+(authority.canApprove?'#4ade80':'#fbbf24')+'">'+(authority.canApprove?'Ready':'Not ready')+'</div></div>';
  const checklist=s.approvalChecklist&&s.approvalChecklist.length?s.approvalChecklist:[...confirmFields,...missingFields].map(f=>f.commercialActionLabel||f.label);
  document.getElementById('bprPanelChecklist').innerHTML=checklist.length?checklist.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li style="list-style:none;color:#4ade80">Nothing remaining</li>';
  const approveBtn=document.getElementById('bprApproveBtn');
  approveBtn.disabled=!authority.canApprove;
  if(approveBtn.disabled&&(checklist.length||authority.approvalDisabledReason)){
    document.getElementById('bprApproveReason').innerHTML=checklist.length?('Approve unavailable.<br>Please confirm:<br>• '+checklist.map(esc).join('<br>• ')):esc(authority.approvalDisabledReason||'Approve unavailable.');
  }else{
    document.getElementById('bprApproveReason').textContent=authority.canApprove?'Ready to approve and continue to Generate Growth Intelligence.':'';
  }
  const acceptBtn=document.getElementById('bprAcceptSafeBtn');
  acceptBtn.style.display=s.approvalStatus==='approved'?'none':'block';
  acceptBtn.textContent=recommendedCount?'Accept All Safe Recommendations ('+recommendedCount+' recommended)':'Accept All Safe Recommendations';
  renderBprServiceReconciliation(review);
  renderBprGoogleSection(review);
  setBprViewState('content');
}
function renderBprServiceReconciliation(review){
  const host=document.getElementById('bprServiceReconciliation');
  const section=document.getElementById('bprServiceReconciliationSection');
  if(!host||!section)return;
  const rec=review.serviceReconciliation;
  if(!rec||!rec.rows||!rec.rows.length){
    host.innerHTML='<div class="empty" style="padding:12px;color:#94a3b8">No service reconciliation proposal available yet. Complete Website Intelligence import first.</div>';
    return;
  }
  const rows=rec.rows.map(function(r){
    const state=esc(r.matchStateLabel||r.matchState||'');
    const configured=esc(r.configuredServiceName||'—');
    const discovered=esc(r.websiteDiscoveredLabel||'—');
    const source=r.websiteSourceUrl?'<a href="'+esc(r.websiteSourceUrl)+'" target="_blank" rel="noopener">'+esc(r.websiteSourceUrl)+'</a>':'—';
    const proposed=r.proposedForCanonical?'Yes':'No';
    return '<tr><td><strong>'+esc(r.canonicalServiceName||r.canonicalServiceId)+'</strong><div style="font-size:.68rem;color:#94a3b8">'+esc(r.canonicalServiceId||'')+'</div></td><td>'+configured+'</td><td>'+discovered+'</td><td style="font-size:.72rem">'+source+'</td><td><span class="pill">'+state+'</span></td><td>'+proposed+'</td></tr>';
  }).join('');
  host.innerHTML=
    '<div style="font-size:.72rem;color:#94a3b8;margin-bottom:8px">Classification: '+esc(rec.businessClassificationClass||'unknown')+
    ' · Clinical catalogue: '+(rec.clinicalCatalogueEligible?'eligible':'not eligible')+
    ' · Snapshot: '+esc(rec.websiteSnapshotImportedAt||'—')+
    ' · Proposed canonical: '+(rec.proposedCanonicalServiceIds||[]).length+
    ' · Downstream trusted: '+(rec.downstreamTrusted?'yes':'no (awaiting approval)')+'</div>'+
    '<div style="overflow:auto"><table class="data" style="width:100%;font-size:.78rem"><thead><tr><th>Canonical / proposed</th><th>Configured</th><th>Website-discovered</th><th>Evidence source</th><th>Match state</th><th>Proposed</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">'+
    (rec.pendingConfirmationCount?'<button class="btn" type="button" style="font-size:.72rem" onclick="confirmProposedCanonicalServices()">Confirm proposed canonical services</button>':(rec.proposalConfirmed&&!rec.downstreamTrusted?'<span style="font-size:.72rem;color:#4ade80">Proposed canonical services confirmed — awaiting Business Profile approval</span>':''))+
    '<button class="btn secondary" type="button" style="font-size:.72rem" onclick="openReviewConfirmedServices()">Review Confirmed Services</button></div>';
}
function confirmProposedCanonicalServices(){
  const rec=activeBprReview&&activeBprReview.serviceReconciliation;
  const ids=rec&&Array.isArray(rec.proposedCanonicalServiceIds)?rec.proposedCanonicalServiceIds.join(','):'';
  bprSaveField('serviceReconciliationProposal','confirm',ids);
}
function setBprSaveStatus(state,msg){
  const el=document.getElementById('bprSaveStatus');
  el.className='bpr-save-status '+state;
  el.textContent=msg||state;
}
async function bprSaveField(fieldId,action,finalValue){
  if(!activeCustomer)return;
  setBprSaveStatus('saving','Saving…');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review/field',{method:'POST',body:JSON.stringify({fieldId:fieldId,action:action,finalValue:finalValue||''})});
    setBprSaveStatus('saved','Business Profile saved');
    if(data.review){activeBprReview=data.review;renderBusinessProfileReview(data.review)}
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){setBprSaveStatus('failed','Failed to save');toast(e.message,true)}
}
function bprChooseField(fieldId,action,finalValue){bprSaveField(fieldId,action,finalValue||'')}
function bprManualField(fieldId,action){
  const el=document.getElementById('bpr-manual-'+fieldId);
  bprSaveField(fieldId,action||'manual',el?el.value:'');
}
async function acceptAllSafeRecommendations(){
  if(!activeCustomer)return;
  setBprSaveStatus('saving','Applying safe recommendations…');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review/accept-safe',{method:'POST',body:'{}'});
    setBprSaveStatus('saved','Business Profile saved');
    if(data.review){activeBprReview=data.review;renderBusinessProfileReview(data.review)}
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    toast('Safe recommendations accepted');
  }catch(e){setBprSaveStatus('failed','Failed');toast(e.message,true)}
}
function openReviewConfirmedServices(){
  if(!activeCustomer||!activeCustomer.slug){toast('Open a customer first',true);return}
  const url='/api/pharmacy-profile-wizard?slug='+encodeURIComponent(activeCustomer.slug)+'&step=4';
  window.location.href=url;
}
async function openBusinessProfileReview(opts){
  if(!activeCustomer){toast('Open a customer first',true);return}
  const forceReadinessRecovery=Boolean(opts&&opts.forceReadinessRecovery);
  const bprApproved=(activeCustomer.businessProfileReview&&activeCustomer.businessProfileReview.approvalStatus==='approved')||(activeCustomer.businessProfile&&activeCustomer.businessProfile.approvalStatus==='approved');
  if(!forceReadinessRecovery&&!businessProfileReviewOpenAllowed(activeCustomer)){
    if(bprApproved){
      toast('Business Profile Review is already approved.',false);
    }else{
      toast('Complete earlier workflow steps (Google Import) before Business Profile Review, or use Open Business Profile Review from the Generate panel.',false);
    }
    return;
  }
  document.getElementById('bprModal').classList.add('open');
  pushWorkflowPanelNav(null,'business-profile-review');
  setBprViewState('loading');
  document.getElementById('bprLoading').textContent='Loading review…';
  document.getElementById('bprMsg').textContent='';
  try{
    // Use canonical Master Admin api()/withAuthHandoff(_t) — same path as Imported Evidence Review.
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review',{timeoutMs:15000});
    if(!data.ok)throw new Error(data.error||'Failed to load review');
    if(!data.review)throw new Error('Review payload missing');
    try{
      renderBusinessProfileReview(data.review);
    }catch(renderErr){
      throw new Error(renderErr instanceof Error?renderErr.message:'Review screen failed to render');
    }
  }catch(e){
    const msg=e&&e.name==='AbortError'?'Review request timed out. Please retry.':(e&&e.message?e.message:'Failed to load review');
    showBprLoadError(msg);
    toast(msg,true);
  }
}
async function saveBusinessProfileReview(){
  if(!activeCustomer)return;
  setBprSaveStatus('saving','Saving…');
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review/save',{method:'POST',body:JSON.stringify({decisions:bprDecisions})});
    setBprSaveStatus('saved','Business Profile saved');
    toast('Business Profile saved');
    if(data.review)renderBusinessProfileReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
  }catch(e){setBprSaveStatus('failed','Failed to save');toast(e.message,true)}
}
async function approveBusinessProfileReview(){
  if(!activeCustomer)return;
  if(!confirm('Approve this business profile and continue to Generate Growth Intelligence?'))return;
  hideBprApprovalError();
  setBprSaveStatus('saving','Approving…');
  const approveBtn=document.getElementById('bprApproveBtn');
  approveBtn.disabled=true;
  try{
    // Canonical Master Admin api()/withAuthHandoff(_t) — auth wiring only; approval semantics unchanged.
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review/approve',{method:'POST',body:'{}'});
    if(!data.ok){
      const msg=data.message||data.error||(data.details&&data.details.reason)||(data.result&&data.result.errors&&data.result.errors[0])||'Business Profile approval failed.';
      showBprApprovalError(msg);
      setBprSaveStatus('failed',msg);
      toast(msg,true);
      if(activeBprReview){
        const authority=bprCanonicalApproval(activeBprReview);
        approveBtn.disabled=!authority.canApprove;
      }
      return;
    }
    toast(data.alreadyApproved?'Business Profile already approved.':'Business Profile approved — workflow advanced');
    await syncCustomerAfterProfileApproval(data);
  }catch(e){
    const msg=e&&e.message?e.message:'Business Profile approval failed.';
    showBprApprovalError(msg);
    setBprSaveStatus('failed',msg);
    toast(msg,true);
    if(activeBprReview){
      const authority=bprCanonicalApproval(activeBprReview);
      approveBtn.disabled=!authority.canApprove;
    }
  }
}
async function openAuditLog(){try{const data=await api('/api/master-admin-platform/audit-log?limit=200');document.getElementById('auditTbody').innerHTML=(data.entries||[]).map(a=>'<tr><td>'+fmt(a.timestamp)+'</td><td>'+esc(a.user)+'</td><td>'+esc(a.slug)+'</td><td>'+esc(a.action)+'</td><td class="status-'+esc(a.status)+'">'+esc(a.status)+'</td><td>'+esc(a.evidence)+'</td></tr>').join('');document.getElementById('auditModal').classList.add('open')}catch(e){toast(e.message,true)}}
function closeAuditModal(){document.getElementById('auditModal').classList.remove('open')}
function renderCommercialEcosystemGeneration(dashboard){
  activeCgeDashboard=dashboard;
  const r=dashboard.readiness||{};
  const hist=dashboard.historicalPackage;
  const auth=dashboard.authorisedGeneration||{};
  const statusLabel=dashboard.generationInProgress?'Generating Approved Ecosystem…':dashboard.authorisedEcosystemGenerated?'Authorised Ecosystem Generated':(auth.completenessStatus==='SUPERSEDED_INCOMPLETE_RC1'||auth.completenessStatus==='INCOMPLETE_AGAINST_CANONICAL_PLAN')?'Superseded — Incomplete Against RC1 Content Architecture V1':dashboard.canGenerate?'Ready to Generate Approved Ecosystem':'Not Ready';
  document.getElementById('cgeHero').innerHTML='<h4>Generation Readiness</h4><p class="ci-narrative">'+esc(dashboard.summary||'')+'</p><div class="cqr-overall '+(dashboard.canGenerate||dashboard.generationInProgress?'ready':'blocked')+'">'+esc(statusLabel)+'</div>';
  const incompleteSection=document.getElementById('cgeIncompleteSection');
  const incompleteEl=document.getElementById('cgeIncomplete');
  if(incompleteSection&&incompleteEl){
    if(auth.completenessStatus==='SUPERSEDED_INCOMPLETE_RC1'||auth.completenessStatus==='INCOMPLETE_AGAINST_CANONICAL_PLAN'){
      incompleteSection.style.display='block';
      incompleteEl.innerHTML='<div class="guidance-box" style="border-color:#f97316;background:#fff7ed;color:#9a3412"><strong>Superseded — Incomplete Against RC1 Content Architecture V1</strong><br>Job: '+esc(String(auth.jobId||'—'))+'<br>Generated pages: '+esc(String(auth.pageCount||'—'))+' · Expected by RC1 canonical plan: '+esc(String(auth.expectedPageCount||r.expectedTotalPageCount||'—'))+'<br><span style="font-size:.72rem">This 15-page package is preserved for audit. It is not Quality Review-ready and must not be published. Confirm a new RC1 generation when ready.</span></div>';
    }else{incompleteSection.style.display='none';incompleteEl.innerHTML=''}
  }
  const core=r.coreEcosystemInventory||{};
  const reconciliationInventory=r.inventoryReconciliation||{};
  const canonicalEl=document.getElementById('cgeCanonicalPlan');
  if(canonicalEl){
    canonicalEl.innerHTML=[
      ['Canonical Plan ID',r.canonicalPlanId||'—'],
      ['Canonical Plan Revision',r.canonicalPlanRevision||'—'],
      ['Plan Checksum',(r.canonicalPlanChecksum||'—').slice(0,16)+'…'],
      ['Inventory Total',reconciliationInventory.inventoryTotal??core.inventoryTotal??r.expectedTotalPageCount??'—'],
      ['Category Sum',reconciliationInventory.categorySum??core.categorySum??'—'],
      ['Total Calculation',reconciliationInventory.totalCalculation??'—'],
      ['Scheduler Page Count',r.schedulerPageCount??reconciliationInventory.schedulerTotal??r.expectedTotalPageCount??'—'],
      ['Dashboard Total',reconciliationInventory.dashboardTotal??r.expectedTotalPageCount??'—'],
      ['Inventory / Scheduler / Dashboard',String(reconciliationInventory.inventoryTotal??r.expectedTotalPageCount)===String(r.schedulerPageCount)&&String(r.schedulerPageCount)===String(reconciliationInventory.dashboardTotal??r.expectedTotalPageCount)?'RECONCILED':'MISMATCH']
    ].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val">'+esc(String(row[1]))+'</div></div>').join('');
  }
  const coreEl=document.getElementById('cgeCoreEcosystem');
  if(coreEl){
    coreEl.innerHTML=[
      ['Homepage',core.homepage??r.expectedHomepageCount],
      ['Service Hubs',core.serviceHubs??r.expectedServiceHubCount],
      ['Approved Areas',core.approvedAreas??r.approvedAreaCount],
      ['Cluster Pages',core.clusterPages??r.clusterPagesToGenerate],
      ['Blogs',core.blogs??r.expectedBlogCount],
      ['Guides',core.guides??r.expectedGuideCount],
      ['FAQs',core.faqs??r.expectedFaqCount],
      ['Supporting Pages',core.supportingPages??0],
      ['Assigned Images',core.images??0],
      ['Required Image Roles',core.requiredImageRoles??r.requiredImageCount],
      ['Core Total Pages',core.inventoryTotal??core.totalPages??r.expectedTotalPageCount]
    ].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val">'+esc(String(row[1]))+'</div></div>').join('');
  }
  const areaEl=document.getElementById('cgeAreaClassifications');
  if(areaEl){
    const rows=(r.areaClassifications||[]).map(a=>'<tr><td>'+esc(a.area)+'</td><td>'+esc(a.classification)+'</td><td>'+esc(a.parentServiceHub||'—')+'</td><td>'+esc(a.pageType||'—')+'</td><td>'+esc(a.inclusionStatus)+'</td><td>'+esc(a.clusterPageUrl||'—')+'</td></tr>').join('');
    areaEl.innerHTML=rows?('<table class="data-table" style="width:100%;font-size:.72rem"><thead><tr><th>Area</th><th>Classification</th><th>Parent Service Hub</th><th>Page Type</th><th>Status</th><th>Cluster Page URL</th></tr></thead><tbody>'+rows+'</tbody></table>'):'<p class="ci-narrative">No area classifications recorded.</p>';
  }
  const recEl=document.getElementById('cgeRecommendedFuture');
  const recSection=document.getElementById('cgeRecommendedSection');
  if(recEl&&recSection){
    const items=(r.recommendedFutureContent||[]);
    if(items.length){
      recSection.style.display='block';
      recEl.innerHTML='<ul class="cqr-list">'+items.map(i=>'<li><strong>'+esc(i.title)+'</strong> · '+esc(i.classification)+' · '+esc(i.source)+'<br><span style="font-size:.68rem;color:#64748b">'+esc(i.detail||'')+'</span></li>').join('')+'</ul>';
    }else{recSection.style.display='block';recEl.innerHTML='<p class="ci-narrative">No optional recommendations recorded for this run.</p>'}
  }
  const histSection=document.getElementById('cgeHistoricalSection');
  const histEl=document.getElementById('cgeHistorical');
  if(histSection&&histEl){
    if(hist){
      histSection.style.display='block';
      const generatedLabel=hist.generatedAt?new Date(hist.generatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'—';
      histEl.innerHTML='<div class="guidance-box" style="border-color:#f59e0b;background:#fffbeb;color:#78350f"><strong>Historical ecosystem package</strong><br>Generated: '+esc(generatedLabel)+'<br>Source: '+esc(hist.source||'Accidental pre-approval admin workflow job')+'<br>Status: <strong>Not Product Owner-authorised</strong><br><span style="font-size:.72rem">This package is preserved for audit only and will not be published. Do not delete or overwrite it before the new authorised package completes successfully.</span></div>';
    }else{histSection.style.display='none';histEl.innerHTML=''}
  }
  const acceptance=dashboard.productOwnerAcceptance||{};
  const externalSection=document.getElementById('cgeExternalPackageSection');
  const externalEl=document.getElementById('cgeExternalPackage');
  if(externalSection&&externalEl){
    const ext=acceptance.previousDashboardExternalPackage;
    if(acceptance.required&&ext){
      externalSection.style.display='block';
      externalEl.innerHTML='<div class="guidance-box" style="border-color:#0369a1;background:#eff6ff;color:#1e3a8a"><strong>'+esc(ext.label)+'</strong><br>Status: '+esc(ext.status)+'<br>Job ID: '+esc(ext.jobId)+'<br><span style="font-size:.72rem">This package is preserved for audit and is not proof of the dashboard generation flow. Generate the Product Owner test package from this panel.</span></div>';
    }else{externalSection.style.display='none';externalEl.innerHTML=''}
  }
  const inventorySection=document.getElementById('cgeInventorySection');
  const inventoryEl=document.getElementById('cgeInventorySummary');
  const canonicalInventory=dashboard.canonicalInventorySummary||{};
  if(inventorySection&&inventoryEl){
    if(acceptance.required){
      inventorySection.style.display='block';
      inventoryEl.innerHTML='<div class="cqr-totals">'+
        '<div class="cqr-stat"><div class="lbl">Canonical Plan</div><div class="val">'+esc(String(canonicalInventory.totalPages||16))+' pages</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Homepage</div><div class="val">×'+esc(String(canonicalInventory.homepage||1))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Service Hub</div><div class="val">×'+esc(String(canonicalInventory.serviceHubs||1))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Cluster Pages</div><div class="val">×'+esc(String(canonicalInventory.clusterPages||8))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Blogs</div><div class="val">×'+esc(String(canonicalInventory.blogs||3))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Guide</div><div class="val">×'+esc(String(canonicalInventory.guides||1))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">FAQ</div><div class="val">×'+esc(String(canonicalInventory.faqs||1))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Supporting Page</div><div class="val">×'+esc(String(canonicalInventory.supportingPages||1))+'</div></div>'+
        '</div>';
    }else{inventorySection.style.display='none';inventoryEl.innerHTML=''}
  }
  document.getElementById('cgeReadiness').innerHTML=[
    ['Pharmacy Name',r.pharmacyName||'—'],
    ['Approved Intelligence Revision',r.approvedIntelligenceRevision||'—'],
    ['Primary Service',r.primaryServiceName||r.primaryService||'—'],
    ['Additional Services',(r.additionalServices||[]).join(', ')||'—'],
    ['Confirmed Town or City',r.confirmedTown||'—'],
    ['Selected Local Areas',(r.selectedLocalAreas||[]).join(', ')||'—'],
    ['Design Intelligence Status',r.designIntelligenceStatus||'—'],
    ['Image Platform Readiness',r.imagePlatformReadiness||'—'],
    ['Expected Homepage Count',r.expectedHomepageCount],
    ['Expected Service Hubs',r.expectedServiceHubCount],
    ['Approved Areas',r.approvedAreaCount],
    ['Cluster Pages to Generate',r.clusterPagesToGenerate],
    ['Expected Guides',r.expectedGuideCount],
    ['Expected Blogs',r.expectedBlogCount],
    ['Expected FAQs',r.expectedFaqCount],
    ['Supporting Pages',r.expectedSupportingPageCount??(core.supportingPages??0)],
    ['Expected Total Page Count',r.expectedTotalPageCount],
    ['Scheduler Page Count',r.schedulerPageCount??r.expectedTotalPageCount],
    ['Required Images',r.requiredImageCount],
    ['Estimated Duration',(r.estimatedGenerationMinutes||30)+' min']
  ].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val">'+esc(String(row[1]))+'</div></div>').join('')+
  ((r.opportunities||[]).length?'<div class="guidance-box" style="margin-top:8px;font-size:.72rem;border-color:#93c5fd;background:#eff6ff;color:#1e3a8a"><strong>Opportunities</strong><ul>'+(r.opportunities||[]).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'')+
  ((r.warnings||[]).length?'<div class="guidance-box" style="margin-top:8px;font-size:.72rem"><strong>Warnings</strong><ul>'+(r.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'')+
  ((r.blockingIssues||[]).length?'<div class="bpr-error-panel" style="margin-top:8px;font-size:.72rem"><strong>Blocking Issues</strong><ul>'+(r.blockingIssues||[]).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'');
  const google=r.googleBusinessProfile||{};
  const googleEl=document.getElementById('cgeGoogle');
  if(googleEl){
    googleEl.innerHTML='<div class="cqr-totals">'+
      '<div class="cqr-stat"><div class="lbl">Status</div><div class="val">'+esc(google.statusLabel||'—')+'</div></div>'+
      '<div class="cqr-stat"><div class="lbl">Google State</div><div class="val">'+esc(google.state||'—')+'</div></div>'+
      '<div class="cqr-stat"><div class="lbl">Generation</div><div class="val '+(google.generationLabel==='Available'?'pass':'fail')+'">'+esc(google.generationLabel||'—')+'</div></div>'+
      '</div>'+
      '<p class="ci-narrative" style="margin-top:8px"><strong>Impact:</strong> '+esc(google.impactLabel||'—')+'</p>'+
      (google.recommendedNextStep?('<p class="ci-narrative" style="margin-top:6px"><strong>Recommended next step:</strong> '+esc(google.recommendedNextStep)+'</p>'):'');
  }
  document.getElementById('cgeSummary').textContent='Canonical plan '+String(r.canonicalPlanRevision||'—')+'. Town: '+String(r.confirmedTown||'')+'. Areas: '+String((r.selectedLocalAreas||[]).join(', ')||'—')+'. Scheduler total: '+String(r.schedulerPageCount??r.expectedTotalPageCount??'—')+'. '+String(dashboard.nextStep||'');
  const panelTitle=document.getElementById('cgePanelTitle');
  if(panelTitle)panelTitle.textContent=acceptance.required?acceptance.generateActionLabel:'Generate Approved Ecosystem';
  document.getElementById('cgePanelStats').innerHTML=[
    ['Expected Pages',r.expectedTotalPageCount??r.schedulerPageCount??'—'],
    ['Expected Images',r.requiredImageCount??'—'],
    ['Estimated Duration',(r.estimatedGenerationMinutes||30)+' min']
  ].map(row=>'<div class="bpr-panel-stat"><div class="lbl">'+esc(row[0])+'</div><div style="font-weight:800">'+esc(String(row[1]))+'</div></div>').join('')+
    '<div class="bpr-panel-stat" style="margin-top:8px"><div class="lbl">Active Action</div><div style="font-weight:800">'+esc(dashboard.nextStep||'')+'</div></div>';
  const progressSection=document.getElementById('cgeProgressSection');
  const progressEl=document.getElementById('cgeProgress');
  if(progressSection&&progressEl){
    if(dashboard.generationInProgress){
      progressSection.style.display='block';
      const gp=dashboard.generationProgress||{};
      const elapsed=gp.elapsedMs!=null?Math.round(gp.elapsedMs/1000)+'s':'—';
      const remaining=gp.remainingMs!=null?Math.max(0,Math.round(gp.remainingMs/1000))+'s':(gp.percent>0&&gp.elapsedMs?Math.max(0,Math.round((gp.elapsedMs/gp.percent)*(100-gp.percent)/1000))+'s':'—');
      progressEl.innerHTML='<div style="font-weight:800;margin-bottom:8px">'+(dashboard.productOwnerAcceptance&&dashboard.productOwnerAcceptance.required?'Generating Product Owner Test Package…':'Generating Approved Ecosystem…')+'</div>'+
        '<div class="cqr-totals">'+
        '<div class="cqr-stat"><div class="lbl">Current Stage</div><div class="val">'+esc(gp.currentStage||dashboard.nextStep||'Running')+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Progress</div><div class="val">'+esc(String(gp.percent??0))+'%</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Elapsed Time</div><div class="val">'+esc(elapsed)+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Remaining Estimate</div><div class="val">'+esc(remaining)+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Job ID</div><div class="val" style="font-size:.68rem">'+esc(String(dashboard.activeJobId||'queued'))+'</div></div>'+
        '</div>'+
        ((gp.warnings||[]).length?'<div class="guidance-box" style="margin-top:8px;font-size:.72rem"><strong>Warnings</strong><ul>'+(gp.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></div>':'');
    }else{progressSection.style.display='none';progressEl.textContent=''}
  }
  updateCgeGenerateState();
  document.getElementById('cgeMsg').textContent=dashboard.generationInProgress?'Generation in progress — do not start another job.':(dashboard.authorisedEcosystemGenerated?'Authorised ecosystem generated — open Quality Review.':(hist?'Historical package preserved — confirm to generate the first authorised ecosystem.':''));
}
function updateCgeGenerateState(){
  const box=document.getElementById('cgeConfirmCheckbox');
  const btn=document.getElementById('cgeGenerateBtn');
  if(!btn||!activeCgeDashboard)return;
  const acceptance=activeCgeDashboard.productOwnerAcceptance||{};
  const actionLabel=acceptance.required?acceptance.generateActionLabel:'Generate Approved Ecosystem';
  btn.disabled=!activeCgeDashboard.canGenerate||activeCgeDashboard.generationInProgress||activeCgeDashboard.authorisedEcosystemGenerated||!(box&&box.checked);
  btn.textContent=activeCgeDashboard.generationInProgress?(acceptance.required?'Generating Product Owner Test Package…':'Generating Approved Ecosystem…'):actionLabel;
}
async function openCommercialEcosystemGeneration(){
  if(!activeCustomer)return;
  if(!customerAtGenerateEcosystem(activeCustomer)&&!(activeCirDashboard&&activeCirDashboard.canGenerateEcosystem)){toast('Generate Ecosystem is not the current stage for this customer.',true);return}
  document.getElementById('cgeModal').classList.add('open');
  document.getElementById('cgeLoading').style.display='block';
  document.getElementById('cgeContent').style.display='none';
  document.getElementById('cgeError').style.display='none';
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','generate-ecosystem');history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-ecosystem-generation');
    renderCommercialEcosystemGeneration(data.dashboard);
    if(data.customer)activeCustomer=data.customer;
    document.getElementById('cgeLoading').style.display='none';
    document.getElementById('cgeContent').style.display='block';
  }catch(e){
    document.getElementById('cgeLoading').style.display='none';
    document.getElementById('cgeError').style.display='block';
    document.getElementById('cgeErrorDetail').textContent=e.message||String(e);
  }
}
function closeCommercialEcosystemGeneration(){
  document.getElementById('cgeModal').classList.remove('open');
  activeCgeDashboard=null;
  const box=document.getElementById('cgeConfirmCheckbox');
  if(box)box.checked=false;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='generate-ecosystem'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
let activeSpgDashboard=null;
let spgGenerationInFlight=false;
let spgGenerationError=null;
function initSpgGenerateControls(){
  const modal=document.getElementById('spgModal');
  if(!modal||modal.dataset.spgControlsBound==='1')return;
  modal.dataset.spgControlsBound='1';
  modal.addEventListener('change',function(e){
    const t=e.target;
    if(!t||t.id!=='spgConfirmCheckbox')return;
    updateSpgGenerateState();
  });
  modal.addEventListener('input',function(e){
    const t=e.target;
    if(!t||t.id!=='spgConfirmCheckbox')return;
    updateSpgGenerateState();
  });
  modal.addEventListener('click',function(e){
    const t=e.target;
    if(t&&t.id==='spgGenerateBtn'){
      if(t.disabled||spgGenerationInFlight)return;
      confirmSpgGenerationClick();
    }
    if(t&&t.id==='spgRetryBtn'){
      if(t.disabled||spgGenerationInFlight)return;
      retrySpgGenerationClick();
    }
  });
}
function spgDashboardReadyForGenerate(dashboard){
  if(!dashboard||dashboard.servicePageGenerated)return false;
  if(dashboard.generationInProgress||spgGenerationInFlight)return false;
  return Boolean(dashboard.canGenerate);
}
function setSpgGenerateButtonDisabled(btn,disabled){
  btn.disabled=disabled;
  if(disabled)btn.setAttribute('disabled','');
  else btn.removeAttribute('disabled');
  btn.classList.toggle('spg-generate-ready',!disabled);
  btn.setAttribute('aria-disabled',disabled?'true':'false');
}
function clearSpgGenerationError(){
  spgGenerationError=null;
  const el=document.getElementById('spgGenerationError');
  if(el){el.style.display='none';el.innerHTML='';}
}
function renderSpgGenerationError(err){
  spgGenerationError=err;
  const el=document.getElementById('spgGenerationError');
  if(!el)return;
  el.style.display='block';
  el.innerHTML='<h5 style="margin:0 0 8px;color:#fca5a5">Service page generation failed</h5>'+
    '<div><strong>Failed stage:</strong> '+esc(err.stage||'generation')+'</div>'+
    '<div><strong>HTTP status:</strong> '+esc(String(err.status||'—'))+'</div>'+
    (err.jobId?('<div><strong>Job ID:</strong> '+esc(String(err.jobId))+'</div>'):'')+
    '<div style="margin-top:6px"><strong>Error:</strong> '+esc(err.error||'Unknown error')+'</div>'+
    '<div class="bpr-error-actions" style="margin-top:10px"><button class="btn" type="button" id="spgGenerationErrorRetry">Generate Service Page</button></div>';
  const retry=document.getElementById('spgGenerationErrorRetry');
  if(retry)retry.onclick=function(){retrySpgGenerationClick();};
}
let activeSpeReview=null;
function evidenceStatusLabel(status){
  if(status==='confirmed')return 'Confirmed';
  if(status==='not_applicable')return 'Not Applicable';
  return 'Not Confirmed';
}
function spgEvidenceBlockerPatterns(){
  return [
    /Product Owner evidence review approval required/i,
    /Approved evidence review snapshot missing/i,
    /Business Profile changed since evidence review approval/i,
    /Evidence review decisions changed since approval/i,
    /must be confirmed before approval/i,
    /must be confirmed or marked Not Applicable/i,
    /evidence incomplete — confirm/i,
    /Required evidence gate/i
  ];
}
function partitionSpgBlockers(dashboard){
  const all=dashboard&&dashboard.blockers?dashboard.blockers:[];
  const evidence=[];
  const preflight=[];
  const patterns=spgEvidenceBlockerPatterns();
  for(const b of all){
    if(patterns.some(p=>p.test(b)))evidence.push(b);
    else preflight.push(b);
  }
  if(dashboard&&!dashboard.evidenceReviewApproved&&!evidence.length){
    evidence.push('Product Owner evidence review approval required before service page generation.');
  }
  return {evidenceBlockers:evidence,preflightBlockers:preflight,total:all.length};
}
function spgHeroEvidenceStatusLabel(dashboard){
  if(!dashboard)return 'Evidence incomplete';
  if(dashboard.evidenceComplete)return 'Ready for generation';
  if(dashboard.evidenceReviewApproved)return 'Evidence approved · generation blocked';
  return 'Evidence incomplete';
}
function spgPreflightBlockerActionHtml(label){
  const l=String(label||'');
  if(/Canonical Business Profile|Business Profile approved/i.test(l)){
    return '<button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px;margin-top:4px" onclick="openBusinessProfileReviewFromSpg()">Open Business Profile Review</button>';
  }
  if(/Google/i.test(l)){
    return '<button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px;margin-top:4px" onclick="openGoogleSetupFromSpg()">Open Google Import</button>';
  }
  return '';
}
function renderSpgPanelStats(dashboard){
  const el=document.getElementById('spgPanelStats');
  if(!el)return;
  const gate=dashboard.requiredEvidenceGate||{};
  const parts=partitionSpgBlockers(dashboard);
  let html='';
  if(!dashboard.evidenceReviewApproved){
    html+='<p class="ci-narrative" style="margin:0 0 8px">Confirm or mark Not Applicable on each evidence field below, then open <strong>Evidence Review</strong> to approve.</p>';
  }else if(parts.evidenceBlockers.length){
    html+='<p class="ci-narrative" style="margin:0 0 8px">Evidence decisions need attention before generation.</p>';
  }else if(parts.preflightBlockers.length){
    html+='<p class="ci-narrative" style="margin:0 0 8px">Product Owner evidence is approved. Remaining blockers are platform readiness (Google Import / Business Profile), not evidence field confirmations.</p>';
  }
  if(parts.evidenceBlockers.length){
    html+='<div class="bpr-error-panel" style="margin:0 0 8px"><h5>Evidence blockers ('+parts.evidenceBlockers.length+')</h5>'+
      parts.evidenceBlockers.map(b=>'<div>'+esc(b)+'</div>').join('')+'</div>';
  }
  if(parts.preflightBlockers.length){
    html+='<div class="bpr-error-panel" style="margin:0"><h5>Platform readiness blockers ('+parts.preflightBlockers.length+')</h5>'+
      parts.preflightBlockers.map(b=>'<div>'+esc(b)+spgPreflightBlockerActionHtml(b)+'</div>').join('')+'</div>';
  }
  if(!parts.total){
    html+='<p class="ci-narrative">Required evidence gate: '+esc(gate.passed?'PASS':'FAIL')+' — one service page only, no ecosystem pages.</p>';
  }
  html+='<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">'+
    '<button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="openServicePageEvidenceReviewFromSpg()">Open Evidence Review</button>';
  if(dashboard.evidenceReviewApproved){
    html+='<button class="btn secondary" type="button" style="width:100%;font-size:.72rem" id="spgReopenEvidenceBtn">Reopen Evidence Review</button>';
  }
  html+='</div>';
  el.innerHTML=html;
  const reopen=document.getElementById('spgReopenEvidenceBtn');
  if(reopen)reopen.onclick=function(){reopenServicePageEvidenceReview('product_owner_generate_panel');};
}
function openServicePageEvidenceReviewFromSpg(){
  openServicePageEvidenceReview();
}
function openBusinessProfileReviewFromSpg(){
  closeServicePageGeneration();
  openBusinessProfileReview({forceReadinessRecovery:true});
}
function openGoogleSetupFromSpg(){
  closeServicePageGeneration();
  if(!activeCustomer){toast('Open a customer first',true);return;}
  const collapse=document.getElementById('detailGoogleCollapse');
  const confirmPanel=document.getElementById('detailGoogleConfirmation');
  if(collapse){collapse.open=true;}
  if(collapse){collapse.scrollIntoView({behavior:'smooth',block:'start'});}
  else if(confirmPanel){confirmPanel.scrollIntoView({behavior:'smooth',block:'start'});}
  if(activeCustomer.googleSource){renderGoogleSourcePanel(activeCustomer);}
  const gs=activeCustomer.googleSource||{};
  if(gs.confirmationStatus==='pending'&&gs.confirmationPreview){
    toast('Confirm Google Business Profile in the customer panel, then Continue Workflow to run Google Import.',false);
  }else if(gs.confirmationStatus==='confirmed'&&!gs.googleImported){
    toast('Google profile confirmed — use Re-run Google Import or Continue Workflow on the customer panel.',false);
  }else{
    toast('Complete Google Business Profile setup on the customer panel below.',false);
  }
}
function spgEvidenceFieldRow(f,dashboard){
  const statusColor=f.status==='confirmed'?'#4ade80':(f.status==='not_applicable'?'#94a3b8':'#f87171');
  let actions='';
  const reviewLocked=Boolean(dashboard&&dashboard.evidenceReviewApproved);
  if(!reviewLocked){
    actions=evidenceFieldDecisionButtons(f,false,'spg');
    if(f.requiresBusinessProfile||(!f.value&&f.required&&!f.allowNotApplicable&&f.id!=='fonts'))actions+=(actions||'')+'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px" onclick="openBusinessProfileReviewFromSpg()">'+(f.id==='brandSource'?'Confirm brand source in Business Profile':'Return to Business Profile')+'</button></div>';
  }else if(reviewLocked&&f.status==='not_confirmed'){
    actions='<div style="margin-top:4px;color:#fbbf24;font-size:.65rem">Reopen Evidence Review to change this field.</div>';
  }
  if(f.decisionInvalidatedReason)actions=(actions||'')+'<div style="margin-top:4px;color:#fbbf24">'+esc(f.decisionInvalidatedReason)+'</div>';
  return '<div style="margin:8px 0;padding:8px;border:1px solid #334155;border-radius:8px;font-size:.72rem"><div style="display:flex;gap:8px;flex-wrap:wrap"><strong style="min-width:160px">'+esc(f.label)+'</strong><span style="color:#94a3b8">Source: '+esc(f.source||'—')+'</span>'+(f.confidence!=null?('<span style="color:#94a3b8">Confidence: '+esc(String(f.confidence))+'%</span>'):'')+'<span style="margin-left:auto;color:'+statusColor+'">'+esc(evidenceStatusLabel(f.status))+(f.required?' · Required':'')+'</span></div><div style="margin-top:4px">'+esc(f.value||'—')+'</div>'+actions+'</div>';
}
function bindSpgFieldDecisionControls(){
  const root=document.getElementById('spgModal');
  if(!root||root.dataset.spgFieldBound==='1')return;
  root.dataset.spgFieldBound='1';
  root.addEventListener('click',function(e){
    const btn=e.target.closest('.spg-field-decision-btn');
    if(!btn||btn.disabled)return;
    const fieldId=btn.getAttribute('data-spg-field-id');
    const decision=btn.getAttribute('data-spg-decision');
    if(!fieldId||!decision)return;
    decideEvidenceReviewField(fieldId,decision,btn,'spg');
  });
}
function renderSpgFieldDecisionError(err){
  const el=document.getElementById('spgFieldError');
  if(!el)return;
  el.style.display='block';
  el.innerHTML='<h5 style="margin:0 0 8px;color:#fca5a5">Evidence decision failed</h5>'+
    '<div><strong>Field:</strong> '+esc(err.fieldId)+'</div>'+
    '<div><strong>Action:</strong> '+esc(err.action)+'</div>'+
    '<div><strong>HTTP status:</strong> '+esc(String(err.status||'—'))+'</div>'+
    '<div style="margin-top:6px"><strong>Error:</strong> '+esc(err.error||'Unknown error')+'</div>';
}
function clearSpgFieldDecisionError(){
  const el=document.getElementById('spgFieldError');
  if(el){el.style.display='none';el.innerHTML='';}
}
async function refreshServicePageGenerationDashboard(){
  if(!activeCustomer)return null;
  const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-generation');
  if(data&&data.dashboard)renderServicePageGeneration(data.dashboard);
  if(data&&data.customer)activeCustomer=data.customer;
  return data&&data.dashboard;
}
let speReopenInFlight=false;
function bindSpeReopenControl(){
  const btn=document.getElementById('speReopenBtn');
  if(!btn||btn.dataset.speReopenBound==='1')return;
  btn.dataset.speReopenBound='1';
  btn.addEventListener('click',function(){
    if(btn.disabled||speReopenInFlight)return;
    reopenServicePageEvidenceReview('product_owner_evidence_review');
  });
}
async function reopenServicePageEvidenceReview(source){
  if(!activeCustomer||speReopenInFlight)return;
  if(!(activeSpeReview?.approved||activeSpgDashboard?.evidenceReviewApproved))return;
  const notes='Product Owner reopened evidence review'+(source?(' ('+source+')'):'');
  const btn=document.getElementById('speReopenBtn');
  const spgBtn=document.getElementById('spgReopenEvidenceBtn');
  speReopenInFlight=true;
  if(btn){btn.disabled=true;btn.textContent='Reopening…';}
  if(spgBtn){spgBtn.disabled=true;spgBtn.textContent='Reopening…';}
  try{
    const path='/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-evidence-review/reject';
    const res=await fetch(path,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({notes:notes})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error((data&&data.error)||res.statusText||('HTTP '+res.status));
    if(data.review)renderServicePageEvidenceReview(data.review);
    if(data.customer)activeCustomer=data.customer;
    const spgOpen=document.getElementById('spgModal')?.classList.contains('open');
    if(spgOpen)await refreshServicePageGenerationDashboard();
    const msgEl=document.getElementById('speMsg');
    if(msgEl)msgEl.textContent='Evidence review reopened — field Confirm / Not Applicable controls are available again.';
  }catch(e){
    renderSpeApprovalError({stage:'POST /service-page-evidence-review/reject',status:0,error:e.message||String(e)});
  }finally{
    speReopenInFlight=false;
    updateSpeReopenState();
  }
}
function updateSpeReopenState(){
  const btn=document.getElementById('speReopenBtn');
  if(!btn||!activeSpeReview)return;
  const show=Boolean(activeSpeReview.approved);
  btn.style.display=show?'block':'none';
  btn.disabled=speReopenInFlight;
  btn.textContent=speReopenInFlight?'Reopening…':'Reopen Evidence Review';
}
function speFieldRow(f){
  const statusColor=f.status==='confirmed'?'#4ade80':(f.status==='not_applicable'?'#94a3b8':'#f87171');
  let actions='';
  if(!activeSpeReview?.approved){
    actions=evidenceFieldDecisionButtons(f,false,'spe');
    if(f.requiresBusinessProfile||(!f.value&&f.required&&!f.allowNotApplicable&&f.id!=='fonts'))actions+=(actions||'')+'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><button class="btn secondary" type="button" style="font-size:.62rem;padding:4px 8px" onclick="openBusinessProfileReviewFromEvidence()">'+(f.id==='brandSource'?'Confirm brand source in Business Profile':'Return to Business Profile')+'</button></div>';
  }
  if(f.decisionInvalidatedReason)actions=(actions||'')+'<div style="margin-top:4px;color:#fbbf24">'+esc(f.decisionInvalidatedReason)+'</div>';
  return '<div style="margin:8px 0;padding:8px;border:1px solid #334155;border-radius:8px;font-size:.72rem"><div style="display:flex;gap:8px;flex-wrap:wrap"><strong style="min-width:160px">'+esc(f.label)+'</strong><span style="color:#94a3b8">Source: '+esc(f.source||'—')+'</span>'+(f.confidence!=null?('<span style="color:#94a3b8">Confidence: '+esc(String(f.confidence))+'%</span>'):'')+(f.capturedAt?('<span style="color:#94a3b8">Captured: '+esc(f.capturedAt)+'</span>'):'')+'<span style="margin-left:auto;color:'+statusColor+'">'+esc(evidenceStatusLabel(f.status))+(f.required?' · Required':'')+'</span></div><div style="margin-top:4px">'+esc(f.value||'—')+'</div>'+actions+'</div>';
}
function bindSpeFieldDecisionControls(){
  const root=document.getElementById('speSections');
  if(!root||root.dataset.speBound==='1')return;
  root.dataset.speBound='1';
  root.addEventListener('click',function(e){
    const btn=e.target.closest('.spe-field-decision-btn');
    if(!btn||btn.disabled)return;
    const fieldId=btn.getAttribute('data-spe-field-id');
    const decision=btn.getAttribute('data-spe-decision');
    if(!fieldId||!decision)return;
    decideEvidenceReviewField(fieldId,decision,btn);
  });
}
let speFieldDecisionInFlight=false;
let speFieldDecisionError=null;
let speApprovalInFlight=false;
let speApprovalError=null;
function bindSpeApproveControl(){
  const btn=document.getElementById('speApproveBtn');
  if(!btn||btn.dataset.speApproveBound==='1')return;
  btn.dataset.speApproveBound='1';
  btn.addEventListener('click',function(){
    if(btn.disabled||speApprovalInFlight)return;
    approveServicePageEvidenceReview();
  });
}
function initSpeGenerateControls(){
  const modal=document.getElementById('speModal');
  if(!modal||modal.dataset.speGenerateBound==='1')return;
  modal.dataset.speGenerateBound='1';
  modal.addEventListener('click',function(e){
    const btn=e.target.closest('#speGenerateBtn');
    if(!btn||btn.disabled||speApprovalInFlight)return;
    if(!(activeSpeReview&&activeSpeReview.approved))return;
    e.preventDefault();
    void openServicePageGenerationFromEvidenceReview();
  });
}
async function openServicePageGenerationFromEvidenceReview(){
  if(!activeCustomer)return;
  if(!(activeSpeReview&&activeSpeReview.approved))return;
  const speModal=document.getElementById('speModal');
  if(speModal)speModal.classList.remove('open');
  await openServicePageGeneration();
}
function clearSpeApprovalError(){
  speApprovalError=null;
  const el=document.getElementById('speApprovalError');
  if(el){el.style.display='none';el.innerHTML='';}
}
function renderSpeApprovalError(err){
  speApprovalError=err;
  const el=document.getElementById('speApprovalError');
  if(!el)return;
  el.style.display='block';
  el.innerHTML='<h5 style="margin:0 0 8px;color:#fca5a5">Evidence approval failed</h5>'+
    '<div><strong>Failed stage:</strong> '+esc(err.stage||'approval')+'</div>'+
    '<div><strong>HTTP status:</strong> '+esc(String(err.status||'—'))+'</div>'+
    '<div style="margin-top:6px"><strong>Error:</strong> '+esc(err.error||'Unknown error')+'</div>'+
    '<div class="bpr-error-actions" style="margin-top:10px"><button class="btn" type="button" id="speApprovalErrorRetry">Retry Approval</button></div>';
  const retry=document.getElementById('speApprovalErrorRetry');
  if(retry)retry.onclick=function(){approveServicePageEvidenceReview();};
}
function clearSpeFieldDecisionError(){
  speFieldDecisionError=null;
  const el=document.getElementById('speFieldError');
  if(el){el.style.display='none';el.innerHTML='';}
}
function renderSpeFieldDecisionError(err){
  speFieldDecisionError=err;
  const el=document.getElementById('speFieldError');
  if(!el)return;
  el.style.display='block';
  el.innerHTML='<h5 style="margin:0 0 8px;color:#fca5a5">Evidence decision failed</h5>'+
    '<div><strong>Field:</strong> '+esc(err.fieldId)+'</div>'+
    '<div><strong>Action:</strong> '+esc(err.action)+'</div>'+
    '<div><strong>HTTP status:</strong> '+esc(String(err.status||'—'))+'</div>'+
    '<div style="margin-top:6px"><strong>Error:</strong> '+esc(err.error||'Unknown error')+'</div>'+
    '<div class="bpr-error-actions" style="margin-top:10px"><button class="btn" type="button" id="speFieldErrorRetry">Retry</button></div>';
  const retry=document.getElementById('speFieldErrorRetry');
  if(retry)retry.onclick=function(){decideEvidenceReviewField(err.retryFieldId,err.retryDecision,null);};
}
function renderEvidenceGroup(elId,fields,dashboard){
  const el=document.getElementById(elId);
  if(!el)return;
  const dash=dashboard||activeSpgDashboard;
  el.innerHTML=(fields||[]).map(f=>spgEvidenceFieldRow(f,dash)).join('')||'<div class="empty">No evidence</div>';
}
function renderServicePageGeneration(dashboard){
  activeSpgDashboard=dashboard;
  const plan=dashboard.plan||{};
  const seo=dashboard.seoPlan||{};
  document.getElementById('spgHero').innerHTML='<h3 style="margin:0 0 6px">'+esc(dashboard.customerName)+'</h3><p class="ci-narrative">'+esc(dashboard.summary||'')+'</p><span class="ci-status">'+esc(spgHeroEvidenceStatusLabel(dashboard))+'</span>';
  mountWorkflowNav('spgHero','Customer Pharmacy');
  const fields=dashboard.evidenceFields||[];
  bindSpgFieldDecisionControls();
  clearSpgFieldDecisionError();
  renderEvidenceGroup('spgBusinessEvidence',fields.filter(f=>f.group==='business'),dashboard);
  renderEvidenceGroup('spgServiceEvidence',fields.filter(f=>f.group==='service'),dashboard);
  renderEvidenceGroup('spgTrustEvidence',fields.filter(f=>f.group==='trust'),dashboard);
  renderEvidenceGroup('spgBrandEvidence',fields.filter(f=>f.group==='brand'),dashboard);
  renderEvidenceGroup('spgImageEvidence',fields.filter(f=>f.group==='images'),dashboard);
  renderEvidenceGroup('spgSeoEvidence',fields.filter(f=>f.group==='seo'),dashboard);
  document.getElementById('spgImageSelections').innerHTML=(dashboard.imageSelections||[]).map(i=>'<div style="margin:6px 0;font-size:.72rem"><strong>'+esc(i.role)+'</strong> · '+esc(i.approvedAssetId||'—')+' · '+esc(i.selectionReason)+' · '+esc(i.status)+'</div>').join('')||'<div class="empty">No image selections</div>';
  document.getElementById('spgPlan').innerHTML='<div class="cqr-totals">'+
    [{l:'Page title',v:plan.pageTitle||seo.title},{l:'Meta description',v:seo.metaDescription},{l:'Planned URL',v:plan.plannedUrl},{l:'Canonical URL',v:plan.canonicalUrl||seo.canonicalUrl},{l:'Robots',v:seo.robots},{l:'OpenGraph',v:seo.openGraph&&seo.openGraph.title},{l:'Twitter',v:seo.twitter&&seo.twitter.title},{l:'Town or city',v:plan.townOrCity},{l:'Schema types',v:(plan.schemaTypes||seo.schemaTypes||[]).join(', ')}].map(x=>'<div class="cqr-stat"><div class="lbl">'+esc(x.l)+'</div><div class="val">'+esc(String(x.v||'—'))+'</div></div>').join('')+'</div>';
  const future=dashboard.futureLinkPlan||{};
  document.getElementById('spgFutureLinks').innerHTML=(future.entries||[]).length?(future.entries||[]).map(e=>'<div style="margin:4px 0;font-size:.72rem"><strong>'+esc(e.areaName)+'</strong> · '+esc(e.futurePageTitle)+' · '+esc(e.futureCanonicalUrl)+' · '+esc(e.status)+'</div>').join(''):('<p class="ci-narrative">'+esc(future.note||'No generation-eligible areas confirmed yet.')+'</p>');
  renderSpgPanelStats(dashboard);
  document.getElementById('spgMsg').textContent=formatSpgProgressMessage(dashboard);
  renderSpgProgressPanel(dashboard);
  updateSpgGenerateState();
  if(dashboard.generationInProgress&&dashboard.activeJobId){startSpgJobPolling(dashboard.activeJobId);}
}
const SPG_PROGRESS_STAGES=['queued','claimed','running','validate-context','resolve-brand','resolve-images','compose-content','render-page','write-metadata','write-schema','write-manifest','write-registry','create-review','completed'];
const SPG_POLL_INTERVAL_MS=1000;
const SPG_TERMINAL_JOB_STATUSES={completed:true,failed:true,cancelled:true};
let spgAutoOpenPreview=false;
let spgPollTimer=null;
let spgPollJobId=null;
let spgPollInFlight=false;
let spgPollGeneration=0;
function isSpgJobTerminal(status){
  return Boolean(SPG_TERMINAL_JOB_STATUSES[String(status||'')]);
}
function stopSpgJobPolling(){
  if(spgPollTimer){clearTimeout(spgPollTimer);spgPollTimer=null;}
  spgPollGeneration+=1;
  spgPollJobId=null;
  spgPollInFlight=false;
}
function applySpgJobProgress(job){
  if(!activeSpgDashboard||!job)return job;
  const running=job.status==='queued'||job.status==='claimed'||job.status==='running';
  activeSpgDashboard.generationInProgress=running;
  activeSpgDashboard.activeJobId=job.id;
  activeSpgDashboard.generationProgress={
    percent:job.progress??0,
    stage:job.stage||job.progressLabel||job.status,
    status:job.status
  };
  activeSpgDashboard.generationError=job.status==='failed'?(job.error||'Generation failed'):null;
  activeSpgDashboard.canRetryGeneration=job.status==='failed';
  if(job.status==='completed'){
    activeSpgDashboard.servicePageGenerated=true;
    activeSpgDashboard.canGenerate=false;
    activeSpgDashboard.generationCompletedVisible=true;
    activeSpgDashboard.generationInProgress=false;
    activeSpgDashboard.nextStep='Open Service Page Review';
    activeSpgDashboard.summary='Gold-standard service page generated — open Service Page Review for Product Owner inspection.';
    if(activeCustomer&&activeCustomer.coreProductRecovery){
      activeCustomer.coreProductRecovery.servicePageGenerated=true;
    }
  }
  renderSpgProgressPanel(activeSpgDashboard);
  const msgEl=document.getElementById('spgMsg');
  if(msgEl){
    if(job.status==='failed')msgEl.style.color='#f87171';
    else if(job.status==='completed')msgEl.style.color='#4ade80';
    msgEl.textContent=formatSpgProgressMessage(activeSpgDashboard);
  }
  updateSpgGenerateState();
  return job;
}
function spgProgressStageIndex(status,stage){
  const si=SPG_PROGRESS_STAGES.indexOf(String(stage||''));
  const sti=SPG_PROGRESS_STAGES.indexOf(String(status||''));
  return Math.max(si,sti,0);
}
function renderSpgProgressPanel(dashboard){
  const section=document.getElementById('spgProgressSection');
  const statusEl=document.getElementById('spgProgressStatus');
  const stageEl=document.getElementById('spgProgressStage');
  const barEl=document.getElementById('spgProgressBar');
  const stagesEl=document.getElementById('spgProgressStages');
  if(!section||!statusEl||!stageEl||!barEl||!stagesEl)return;
  const showPanel=dashboard&&dashboard.generationProgress&&(dashboard.generationInProgress||dashboard.generationCompletedVisible);
  section.style.display=showPanel?'block':'none';
  if(!showPanel){barEl.style.width='0%';stagesEl.textContent='';return;}
  const p=dashboard.generationProgress;
  const status=String(p.status||'queued');
  const stage=String(p.stage||status);
  const pct=Math.max(0,Math.min(100,Number(p.percent||0)));
  const currentIdx=spgProgressStageIndex(status,stage);
  if(typeof dashboard.maxStageIndex!=='number'||currentIdx>dashboard.maxStageIndex)dashboard.maxStageIndex=currentIdx;
  const reachedIdx=dashboard.generationCompletedVisible?SPG_PROGRESS_STAGES.length-1:dashboard.maxStageIndex;
  statusEl.textContent='Status: '+status;
  stageEl.textContent='Stage: '+stage+' ('+pct+'%)';
  barEl.style.width=pct+'%';
  stagesEl.innerHTML=SPG_PROGRESS_STAGES.map((s,i)=>'<div style="margin:2px 0;color:'+(i<reachedIdx?'#4ade80':(i===reachedIdx?'#38bdf8':'#64748b'))+'">'+esc(s)+(i<reachedIdx?' ✓':'')+'</div>').join('');
}
function formatSpgProgressMessage(dashboard){
  if(!dashboard)return '';
  if(dashboard.generationInProgress&&dashboard.generationProgress){
    const p=dashboard.generationProgress;
    const status=String(p.status||'running');
    const stage=String(p.stage||status);
    return 'Generating service page — '+status+' → '+stage+' ('+String(p.percent||0)+'%)';
  }
  if(dashboard.generationError)return 'Generation failed: '+dashboard.generationError;
  return dashboard.nextStep||'';
}
function renderServicePageEvidenceReview(review){
  activeSpeReview=review;
  document.getElementById('speHero').innerHTML='<h3 style="margin:0 0 6px">'+esc(review.customerName)+'</h3><p class="ci-narrative">'+esc(review.summary||'')+'</p><span class="ci-status">'+esc(review.approved?'Approved':'Pending review')+'</span>';
  mountWorkflowNav('speHero','Customer Pharmacy');
  document.getElementById('speSections').innerHTML=(review.sections||[]).map(sec=>'<div class="cqr-section"><h4>'+esc(sec.label)+' ('+esc(String(sec.confirmedCount))+'/'+esc(String(sec.totalCount))+')</h4>'+(sec.fields||[]).map(f=>speFieldRow(f)).join('')+'</div>').join('');
  document.getElementById('spePanelStats').innerHTML=review.approved
    ?('<p class="ci-narrative" style="color:#4ade80">Evidence approved — use Generate Service Page to continue.</p>')
    :(review.canApprove?('<p class="ci-narrative" style="color:#4ade80">All evidence decisions complete — tick the confirmation box to enable approval.</p>'):((review.blockers||[]).length?('<div class="bpr-error-panel" style="margin:0">'+review.blockers.map(b=>'<div>'+esc(b)+'</div>').join('')+'</div>'):('<p class="ci-narrative">Complete Product Owner evidence decisions before approval.</p>')));
  bindSpeFieldDecisionControls();
  bindSpeApproveControl();
  bindSpeReopenControl();
  updateSpeReopenState();
  updateSpeApproveState();
}
async function decideEvidenceReviewField(fieldId,decision,btn,origin,editedValue){
  if(!activeCustomer)return;
  const reviewLocked=Boolean(activeSpeReview?.approved||activeSpgDashboard?.evidenceReviewApproved);
  if(reviewLocked)return;
  if(speFieldDecisionInFlight)return;
  const action=decision==='not_applicable'?'not_applicable':decision==='edit_value'?'edit_value':'confirm';
  const actionLabel=action==='not_applicable'?'Mark Not Applicable':action==='edit_value'?'Edit':'Confirm';
  const msgEl=document.getElementById('speMsg');
  if(btn){
    btn.disabled=true;
    btn.dataset.speOriginalText=btn.textContent||actionLabel;
    btn.textContent='Saving…';
  }
  speFieldDecisionInFlight=true;
  try{
    const path='/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-evidence-review/field';
    const res=await fetch(path,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({fieldId:fieldId,action:action,value:editedValue})});
    const data=await res.json().catch(()=>({}));
    if(data.review)renderServicePageEvidenceReview(data.review);
    if(data.customer)activeCustomer=data.customer;
    const spgOpen=document.getElementById('spgModal')?.classList.contains('open');
    if(origin==='spg'||spgOpen){
      try{await refreshServicePageGenerationDashboard();}catch(_e){}
    }
    if(!res.ok){
      if(origin==='spg'){
        renderSpgFieldDecisionError({fieldId:fieldId,action:actionLabel,status:res.status,error:(data&&data.error)||res.statusText||('HTTP '+res.status)});
      }else{
        renderSpeFieldDecisionError({fieldId:fieldId,action:actionLabel,status:res.status,error:(data&&data.error)||res.statusText||('HTTP '+res.status),retryFieldId:fieldId,retryDecision:decision});
      }
      return;
    }
    clearSpeFieldDecisionError();
    clearSpgFieldDecisionError();
    if(msgEl)msgEl.textContent='Saved '+fieldId+' as '+actionLabel+'.';
  }catch(e){
    if(origin==='spg'){
      renderSpgFieldDecisionError({fieldId:fieldId,action:actionLabel,status:0,error:e.message||String(e)});
    }else{
      renderSpeFieldDecisionError({fieldId:fieldId,action:actionLabel,status:0,error:e.message||String(e),retryFieldId:fieldId,retryDecision:decision});
    }
  }finally{
    speFieldDecisionInFlight=false;
  }
}
function openBusinessProfileReviewFromEvidence(){
  closeServicePageEvidenceReview();
  openBusinessProfileReview();
}
function updateSpeApproveState(){
  const btn=document.getElementById('speApproveBtn');
  const box=document.getElementById('speApproveCheckbox');
  if(!btn||!activeSpeReview)return;
  if(box){
    if(activeSpeReview.approved){
      box.checked=true;
      box.disabled=true;
    }else{
      box.disabled=!activeSpeReview.canApprove||speApprovalInFlight;
      if(box.disabled&&!speApprovalInFlight)box.checked=false;
    }
  }
  if(activeSpeReview.approved){
    btn.disabled=true;
    btn.textContent='Evidence Approved';
    btn.classList.remove('spg-generate-ready');
    const genBtn=document.getElementById('speGenerateBtn');
    if(genBtn){
      genBtn.style.display='block';
      setSpgGenerateButtonDisabled(genBtn,false);
    }
    updateSpeReopenState();
    return;
  }
  const genBtn=document.getElementById('speGenerateBtn');
  if(genBtn){
    genBtn.style.display='none';
    setSpgGenerateButtonDisabled(genBtn,true);
  }
  updateSpeReopenState();
  if(speApprovalInFlight){
    btn.disabled=true;
    btn.textContent='Approving…';
    return;
  }
  btn.textContent='Approve Evidence';
  btn.disabled=!activeSpeReview.canApprove||!(box&&box.checked);
}
async function openServicePageEvidenceReview(){
  if(!activeCustomer)return;
  document.getElementById('speModal').classList.add('open');
  pushWorkflowPanelNav(null,'service-page-evidence-review');
  document.getElementById('speLoading').style.display='block';
  document.getElementById('speContent').style.display='none';
  document.getElementById('speError').style.display='none';
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-evidence-review');
    if(!data.review)throw new Error(data.error||'Evidence review unavailable');
    renderServicePageEvidenceReview(data.review);
    if(data.customer)activeCustomer=data.customer;
    document.getElementById('speLoading').style.display='none';
    document.getElementById('speContent').style.display='block';
  }catch(e){
    document.getElementById('speLoading').style.display='none';
    document.getElementById('speError').style.display='block';
    document.getElementById('speErrorDetail').textContent=e.message||String(e);
  }
}
function closeServicePageEvidenceReview(){
  document.getElementById('speModal').classList.remove('open');
  activeSpeReview=null;
  speApprovalInFlight=false;
  clearSpeApprovalError();
  const box=document.getElementById('speApproveCheckbox');if(box)box.checked=false;
  const msgEl=document.getElementById('speMsg');if(msgEl)msgEl.textContent='';
  const p=new URLSearchParams(location.search);if(p.get('panel')==='service-page-evidence-review'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function approveServicePageEvidenceReview(){
  if(!activeCustomer||!activeSpeReview||activeSpeReview.approved)return;
  if(speApprovalInFlight)return;
  const box=document.getElementById('speApproveCheckbox');
  if(!(box&&box.checked)){
    renderSpeApprovalError({stage:'client validation',status:0,error:'Tick the confirmation box before approving evidence.'});
    return;
  }
  if(!activeSpeReview.canApprove){
    renderSpeApprovalError({stage:'client validation',status:0,error:(activeSpeReview.blockers&&activeSpeReview.blockers[0])||'Evidence approval is blocked.'});
    return;
  }
  const msgEl=document.getElementById('speMsg');
  const slug=activeCustomer.slug;
  const url='/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/service-page-evidence-review/approve';
  const body=JSON.stringify({operatorConfirmed:true});
  speApprovalInFlight=true;
  updateSpeApproveState();
  if(msgEl){msgEl.style.color='#94a3b8';msgEl.textContent='Submitting evidence approval…';}
  try{
    const res=await fetch(url,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body});
    const ct=res.headers.get('content-type')||'';
    const data=ct.includes('application/json')?await res.json().catch(()=>({})):null;
    if(res.redirected&&String(res.url||'').includes('/api/login')){
      throw new Error('Authentication required — sign in again.');
    }
    if(data&&data.review)renderServicePageEvidenceReview(data.review);
    if(data&&data.customer){activeCustomer=data.customer;renderCustomerDetail(activeCustomer);}
    if(!res.ok){
      renderSpeApprovalError({stage:'POST /service-page-evidence-review/approve',status:res.status,error:(data&&data.error)||res.statusText||('HTTP '+res.status)});
      if(msgEl){msgEl.style.color='#f87171';msgEl.textContent='Evidence approval failed — see error above.';}
      return;
    }
    clearSpeApprovalError();
    if(msgEl){msgEl.style.color='#4ade80';msgEl.textContent='Evidence approved — Generate Service Page is now available.';}
  }catch(e){
    renderSpeApprovalError({stage:'POST /service-page-evidence-review/approve',status:0,error:e.message||String(e)});
    if(msgEl){msgEl.style.color='#f87171';msgEl.textContent='Evidence approval failed — see error above.';}
  }finally{
    speApprovalInFlight=false;
    updateSpeApproveState();
  }
}
function updateSpgGenerateState(){
  const btn=document.getElementById('spgGenerateBtn');
  const retryBtn=document.getElementById('spgRetryBtn');
  const box=document.getElementById('spgConfirmCheckbox');
  if(!btn||!activeSpgDashboard)return;
  const busy=spgGenerationInFlight||activeSpgDashboard.generationInProgress;
  const confirmed=!!(box&&box.checked);
  if(box){
    box.disabled=busy||activeSpgDashboard.servicePageGenerated;
  }
  if(activeSpgDashboard.servicePageGenerated){
    setSpgGenerateButtonDisabled(btn,true);
    btn.textContent='Service Page Generated';
    if(retryBtn)retryBtn.style.display='none';
    const selected=activeCustomer&&(activeCustomer.selectedServiceCampaign||(activeCustomer.serviceCampaigns||[]).find(function(x){return x.selected||x.serviceId===activeSpgDashboard.primaryService;}));
    const previewUrl=(selected&&selected.previewUrl)||(activeSpgDashboard.primaryService?('/api/pharmacy-visual-experience/'+encodeURIComponent(activeSpgDashboard.primaryService)+'/?slug='+encodeURIComponent(activeCustomer.slug)):'');
    let previewSlot=document.getElementById('spgOpenPreviewSlot');
    if(!previewSlot){
      previewSlot=document.createElement('div');
      previewSlot.id='spgOpenPreviewSlot';
      previewSlot.style.marginTop='8px';
      btn.insertAdjacentElement('afterend',previewSlot);
    }
    if(previewUrl){
      previewSlot.innerHTML='<a class="btn secondary campaign-open-service-preview" href="'+esc(withAuthHandoff(previewUrl))+'" target="_blank" rel="noopener" style="width:100%;font-size:.72rem;text-align:center;display:inline-block">Open Service Preview</a>'+
        '<button class="btn" type="button" id="spgRegenerateBtn" style="width:100%;margin-top:8px;font-size:.72rem" onclick="regenerateServicePageFromSpg()">Regenerate Service Page</button>'+
        '<button class="btn secondary" type="button" style="width:100%;margin-top:8px;font-size:.72rem" onclick="closeServicePageGeneration();generateCampaignLocalityPages()">Generate Locality Pages</button>';
    }else{
      previewSlot.innerHTML='<div style="font-size:.68rem;color:#fcd34d;margin-bottom:6px">Preview unavailable — use Generate Service Page</div>'+
        '<button class="btn" type="button" style="width:100%;font-size:.72rem" id="spgRetryAfterMissingPreview" onclick="confirmSpgGenerationClick()">Generate Service Page</button>';
    }
    if(retryBtn){retryBtn.style.display='none';retryBtn.disabled=true;}
    return;
  }
  const stalePreviewSlot=document.getElementById('spgOpenPreviewSlot');
  if(stalePreviewSlot)stalePreviewSlot.innerHTML='';
  if(spgGenerationInFlight){
    setSpgGenerateButtonDisabled(btn,true);
    btn.textContent='Creating Job…';
    if(retryBtn){retryBtn.style.display='none';retryBtn.disabled=true;}
    return;
  }
  if(activeSpgDashboard.generationInProgress){
    setSpgGenerateButtonDisabled(btn,true);
    btn.textContent='Generating Service Page…';
    if(retryBtn){retryBtn.style.display='none';retryBtn.disabled=true;}
    return;
  }
  btn.textContent='Generate Service Page';
  const ready=spgDashboardReadyForGenerate(activeSpgDashboard);
  setSpgGenerateButtonDisabled(btn,!ready||!confirmed);
  // Legacy retry control permanently hidden from Product Owner workflow.
  if(retryBtn){retryBtn.style.display='none';retryBtn.disabled=true;}
}
async function openServicePageGeneration(){
  if(!activeCustomer)return;
  if(!customerAtCoreProductRecovery(activeCustomer)){toast('CPR-01 mode is not active for this customer.',true);return}
  document.getElementById('spgModal').classList.add('open');
  pushWorkflowPanelNav(null,'service-page-generation');
  document.getElementById('spgLoading').style.display='block';
  document.getElementById('spgContent').style.display='none';
  document.getElementById('spgError').style.display='none';
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-generation');
    if(data.customer){
      activeCustomer=data.customer;
      renderCustomerDetail(data.customer);
    }
    renderServicePageGeneration(data.dashboard);
    const box=document.getElementById('spgConfirmCheckbox');
    if(box)box.checked=false;
    updateSpgGenerateState();
    document.getElementById('spgLoading').style.display='none';
    document.getElementById('spgContent').style.display='block';
  }catch(e){
    document.getElementById('spgLoading').style.display='none';
    document.getElementById('spgError').style.display='block';
    document.getElementById('spgErrorDetail').textContent=e.message||String(e);
  }
}
function closeServicePageGeneration(){
  stopSpgJobPolling();
  document.getElementById('spgModal').classList.remove('open');
  activeSpgDashboard=null;
  spgGenerationInFlight=false;
  clearSpgGenerationError();
  const box=document.getElementById('spgConfirmCheckbox');if(box)box.checked=false;
  const msgEl=document.getElementById('spgMsg');if(msgEl){msgEl.textContent='';msgEl.style.color='#94a3b8';}
  const p=new URLSearchParams(location.search);if(p.get('panel')==='service-page-generation'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function confirmSpgGenerationClick(){
  if(!activeCustomer||!activeSpgDashboard){
    renderSpgGenerationError({stage:'client validation',status:0,error:'Service page generation panel is not ready.'});
    return;
  }
  if(spgGenerationInFlight||activeSpgDashboard.generationInProgress)return;
  const box=document.getElementById('spgConfirmCheckbox');
  if(!(box&&box.checked)){
    renderSpgGenerationError({stage:'client validation',status:0,error:'Tick the confirmation box before generating the service page.'});
    return;
  }
  if(!activeSpgDashboard.canGenerate){
    renderSpgGenerationError({stage:'client validation',status:0,error:(activeSpgDashboard.blockers&&activeSpgDashboard.blockers[0])||'Service page generation is blocked.'});
    return;
  }
  const msgEl=document.getElementById('spgMsg');
  const slug=activeCustomer.slug;
  const serviceId=activeSpgDashboard.primaryService||activeSpgDashboard.plan?.serviceId||'';
  const url='/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/service-page-generation/confirm';
  const body=JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard'});
  spgGenerationInFlight=true;
  updateSpgGenerateState();
  if(msgEl){msgEl.style.color='#94a3b8';msgEl.textContent='Creating generation job for '+slug+(serviceId?(' · '+serviceId):'')+'…';}
  try{
    const res=await fetch(url,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body});
    const ct=res.headers.get('content-type')||'';
    const data=ct.includes('application/json')?await res.json().catch(()=>({})):null;
    if(res.redirected&&String(res.url||'').includes('/api/login')){
      throw new Error('Authentication required — sign in again.');
    }
    if(data&&data.dashboard)renderServicePageGeneration(data.dashboard);
    if(data&&data.customer){activeCustomer=data.customer;renderCustomerDetail(activeCustomer);}
    if(!res.ok){
      renderSpgGenerationError({
        stage:'POST /service-page-generation/confirm',
        status:res.status,
        error:(data&&data.error)||(data&&data.message)||res.statusText||('HTTP '+res.status),
        jobId:data&&data.jobId
      });
      if(msgEl){msgEl.style.color='#f87171';msgEl.textContent='Generation job creation failed — see error above.';}
      return;
    }
    if(!data)throw new Error('Expected JSON response but received '+ct);
    clearSpgGenerationError();
    if(activeSpgDashboard){
      activeSpgDashboard.generationInProgress=true;
      activeSpgDashboard.generationCompletedVisible=false;
      activeSpgDashboard.maxStageIndex=0;
      activeSpgDashboard.generationProgress={percent:0,stage:'queued',status:'queued'};
      if(data.jobId)activeSpgDashboard.activeJobId=data.jobId;
      renderSpgProgressPanel(activeSpgDashboard);
    }
    if(msgEl){
      msgEl.style.color='#4ade80';
      msgEl.textContent=data.jobId?('Generation job created — Job ID: '+data.jobId+' — monitor progress below.'):'Generation job queued — monitor progress below.';
    }
    updateSpgGenerateState();
    if(data.jobId){startSpgJobPolling(data.jobId);return;}
    await loadDashboard();
  }catch(e){
    if(activeSpgDashboard)activeSpgDashboard.generationInProgress=false;
    renderSpgGenerationError({stage:'POST /service-page-generation/confirm',status:0,error:e.message||String(e)});
    if(msgEl){msgEl.style.color='#f87171';msgEl.textContent='Generation job creation failed — see error above.';}
    updateSpgGenerateState();
  }finally{
    spgGenerationInFlight=false;
    updateSpgGenerateState();
  }
}
async function pollSpgJobOnce(jobId){
  const data=await api('/api/master-admin-platform/jobs/'+encodeURIComponent(jobId));
  const job=data.job;
  if(!job)return null;
  applySpgJobProgress(job);
  return job;
}
function startSpgJobPolling(jobId){
  if(!jobId)return;
  if(spgPollJobId===jobId && (spgPollTimer||spgPollInFlight))return;
  stopSpgJobPolling();
  const generation=spgPollGeneration;
  spgPollJobId=jobId;
  const tick=async function(){
    if(generation!==spgPollGeneration||spgPollJobId!==jobId)return;
    spgPollInFlight=true;
    try{
      const job=await pollSpgJobOnce(jobId);
      if(generation!==spgPollGeneration||spgPollJobId!==jobId)return;
      if(job&&isSpgJobTerminal(job.status)){
        stopSpgJobPolling();
        if(job.status==='completed'){
          clearSpgGenerationError();
          toast('Service page generation completed');
        }else{
          renderSpgGenerationError({
            stage:'worker execution',
            status:0,
            error:job.error||'Generation failed',
            jobId:job.id
          });
        }
        return;
      }
    }catch(_e){}
    finally{
      if(generation===spgPollGeneration)spgPollInFlight=false;
    }
    if(generation===spgPollGeneration&&spgPollJobId===jobId){
      spgPollTimer=setTimeout(tick,SPG_POLL_INTERVAL_MS);
    }
  };
  void tick();
}
async function retrySpgGenerationClick(){
  if(!activeCustomer||!activeSpgDashboard)return;
  if(spgGenerationInFlight||activeSpgDashboard.generationInProgress)return;
  const box=document.getElementById('spgConfirmCheckbox');
  if(!(box&&box.checked)){
    renderSpgGenerationError({stage:'client validation',status:0,error:'Tick the confirmation box before retrying service page generation.'});
    return;
  }
  clearSpgGenerationError();
  await confirmSpgGenerationClick();
}
let activeSprReview=null;
function updateSprApproveState(){
  const btn=document.getElementById('sprApproveBtn');
  const box=document.getElementById('sprApproveCheckbox');
  if(!btn||!activeSprReview)return;
  if(box&&activeSprReview.reviewStatus==='approved')box.checked=true;
  btn.disabled=!activeSprReview.canApprove||!(box&&box.checked)||activeSprReview.reviewStatus==='approved';
}
function renderServicePageReview(review){
  activeSprReview=review;
  document.getElementById('sprHero').innerHTML='<h3 style="margin:0 0 6px">'+esc(review.pageTitle)+'</h3><p class="ci-narrative">'+esc(review.customerName||review.slug)+' · '+esc(review.serviceName)+' · '+esc(review.townOrCity||'—')+'</p><div style="font-size:.72rem;color:#94a3b8">Job: '+esc(String(review.jobId||'—'))+' · Revision: '+esc(String(review.generationRevision||'—'))+' · Scope: '+esc(review.scope||'service-page-only')+'</div><span class="ci-status">'+esc(review.reviewStatus)+'</span>';
  document.getElementById('sprPreview').innerHTML='<a class="btn" href="'+esc(withAuthHandoff(review.previewUrl))+'" target="_blank" rel="noopener">Preview Service Page</a><div style="margin-top:8px;font-size:.72rem;color:#94a3b8">Word count: '+esc(String(review.wordCount||'—'))+' · Canonical: '+esc(review.canonicalUrl||'—')+'</div>';
  const br=review.brandResolution||{};
  document.getElementById('sprBrandResolution').innerHTML=[
    ['Template source',br.templateSource],
    ['Colour source',br.colourSource],
    ['Font source',br.fontSource],
    ['Logo source',br.logoSource],
    ['Header source',br.headerSource],
    ['Footer source',br.footerSource],
    ['Fallback reason',br.fallbackReason||'None — tenant brand resolved']
  ].map(([l,v])=>'<div style="margin:4px 0;font-size:.72rem"><strong>'+esc(l)+':</strong> '+esc(String(v||'—'))+'</div>').join('');
  const rr=review.responsiveResults||{};
  document.getElementById('sprResponsive').innerHTML=['desktop','tablet','mobile'].map(k=>'<div style="font-size:.72rem;margin:2px 0"><strong>'+esc(k)+':</strong> '+esc(rr[k]||'—')+'</div>').join('');
  document.getElementById('sprEvidence').innerHTML=(review.evidenceBySection||[]).map(sec=>'<div style="margin-bottom:8px"><strong>'+esc(sec.section)+'</strong>'+sec.fields.map(f=>'<div style="font-size:.72rem;margin:2px 0 2px 12px">'+esc(f.label)+': '+esc(f.value||'—')+' · '+esc(evidenceStatusLabel(f.status))+'</div>').join('')+'</div>').join('')||'<div class="empty">No evidence sections</div>';
  document.getElementById('sprMetadata').innerHTML='<div><strong>Title:</strong> '+esc(review.metadata?.title||'—')+'</div><div><strong>Description:</strong> '+esc(review.metadata?.description||'—')+'</div><div><strong>Canonical:</strong> '+esc(review.metadata?.canonical||'—')+'</div><div><strong>Robots:</strong> '+esc(review.metadata?.robots||'—')+'</div><div><strong>Schema:</strong> '+esc((review.schemaTypes||[]).join(', '))+'</div>';
  document.getElementById('sprImages').innerHTML=(review.imageSelections||[]).map(i=>'<div style="margin:4px 0;font-size:.72rem"><strong>'+esc(i.role)+'</strong> · '+esc(i.approvedAssetId||'—')+' · '+esc(i.altText||'—')+' · '+esc(i.dimensions||'—')+' · '+esc(i.status)+'</div>').join('');
  document.getElementById('sprLinks').innerHTML=(review.internalLinks||[]).map(l=>'<div style="margin:4px 0;font-size:.72rem"><strong>'+esc(l.label)+'</strong> · '+esc(l.href)+' · '+esc(l.status)+'</div>').join('');
  document.getElementById('sprFutureLinks').innerHTML=(review.futureLinkPlan?.entries||[]).map(e=>'<div style="margin:4px 0;font-size:.72rem"><strong>'+esc(e.areaName)+'</strong> · '+esc(e.plannedAnchorText)+' · '+esc(e.status)+'</div>').join('')||'<div class="empty">No future cluster links planned</div>';
  const checks=[...(review.qualityChecks||[]),...(review.seoChecks||[])];
  document.getElementById('sprQuality').innerHTML=checks.length?checks.map(c=>'<div style="font-size:.72rem;color:'+(c.passed?'#4ade80':'#f87171')+'">'+esc(c.label)+' — '+esc(c.detail||'')+'</div>').join(''):'<div class="empty">Quality checks pending</div>';
  const cl=review.commercialChecklist;
  document.getElementById('sprCommercialChecklist').innerHTML=cl?(cl.grouped||[]).map(g=>'<div style="margin-bottom:10px"><strong>'+esc(g.category)+'</strong>'+g.items.map(i=>'<div style="font-size:.72rem;color:'+(i.passed?'#4ade80':'#f87171')+'">'+esc(i.passed?'PASS':'FAIL')+' — '+esc(i.label)+'</div>').join('')+'</div>').join('')+'<div style="font-size:.72rem;margin-top:8px">'+esc(String(cl.passedCount))+' passed · '+esc(String(cl.failedCount))+' failed</div>':'<div class="empty">Commercial checklist unavailable</div>';
  document.getElementById('sprWarnings').innerHTML=[...(review.errors||[]).map(e=>'<div style="color:#f87171">'+esc(e)+'</div>'),...(review.warnings||[]).map(w=>'<div>'+esc(w)+'</div>')].join('')||'<div class="empty">No warnings or errors</div>';
  document.getElementById('sprPanelStats').innerHTML=review.reviewStatus==='approved'
    ?('<p class="ci-narrative" style="color:#4ade80">Service page approved — cluster generation is available when eligible.</p>')
    :review.canApprove
    ?('<p class="ci-narrative">Manual Product Owner review required — do not approve automatically.</p>')
    :('<div class="bpr-error-panel" style="margin:0"><h5>Approval blocked</h5><div>Resolve errors before approving.</div></div>');
  const clusterBtn=document.getElementById('sprClusterGenerateBtn');
  if(clusterBtn){
    clusterBtn.style.display=review.clusterEligible||review.reviewStatus==='approved'?'block':'none';
    clusterBtn.disabled=false;
    clusterBtn.textContent='Generate Locality Pages';
    clusterBtn.onclick=function(){generateCampaignLocalityPages();};
  }
  updateSprApproveState();
}
async function approveServicePageReviewAction(){
  if(!activeCustomer||!activeSprReview)return;
  if(!window.confirm('Approve this service page? Cluster generation remains locked until later CPR stages.'))return;
  try{
    const camp=selectedCampaignRef();
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-review/approve',{method:'POST',body:JSON.stringify({
      operatorConfirmed:true,
      campaignId:activeSprReview.campaignId||(camp&&camp.campaignId)||activeCustomer.selectedCampaignId||'',
      serviceId:activeSprReview.serviceId||(camp&&camp.serviceId)||''
    })});
    toast('Service page approved');
    if(data.review)renderServicePageReview(data.review);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
  }catch(e){toast(e.message,true)}
}
async function rejectServicePageReview(){
  if(!activeCustomer||!activeSprReview)return;
  const notesBox=document.getElementById('sprNotesBox');
  const notesEl=document.getElementById('sprNotes');
  if(notesBox&&notesBox.style.display==='none'){notesBox.style.display='block';return}
  const notes=notesEl?notesEl.value.trim():'';
  if(!notes){toast('Add Product Owner notes before requesting changes.',true);return}
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-review/reject',{method:'POST',body:JSON.stringify({notes})});
    toast('Marked as needs changes');
    if(data.review)renderServicePageReview(data.review);
  }catch(e){toast(e.message,true)}
}
function approveServicePageReview(){approveServicePageReviewAction()}
async function openServicePageReview(){
  if(!activeCustomer)return;
  document.getElementById('sprModal').classList.add('open');
  document.getElementById('sprLoading').style.display='block';
  document.getElementById('sprContent').style.display='none';
  document.getElementById('sprError').style.display='none';
  const camp=selectedCampaignRef();
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','service-page-review');
  if(camp&&camp.campaignId)p.set('campaignId',camp.campaignId);
  history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const q=new URLSearchParams();
    if(camp&&camp.campaignId)q.set('campaignId',camp.campaignId);
    if(camp&&camp.serviceId)q.set('serviceId',camp.serviceId);
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/service-page-review'+(q.toString()?('?'+q.toString()):''));
    renderServicePageReview(data.review);
    document.getElementById('sprLoading').style.display='none';
    document.getElementById('sprContent').style.display='block';
    if(spgAutoOpenPreview&&data.review&&data.review.previewUrl){
      spgAutoOpenPreview=false;
      window.open(withAuthHandoff(data.review.previewUrl),'_blank','noopener');
    }
  }catch(e){
    spgAutoOpenPreview=false;
    document.getElementById('sprLoading').style.display='none';
    document.getElementById('sprError').style.display='block';
    document.getElementById('sprErrorDetail').textContent=e.message||String(e);
  }
}
function closeServicePageReview(){
  document.getElementById('sprModal').classList.remove('open');
  activeSprReview=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='service-page-review'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function confirmCommercialEcosystemGeneration(){
  if(!activeCustomer||!activeCgeDashboard)return;
  const acceptance=activeCgeDashboard.productOwnerAcceptance||{};
  const confirmMessage=acceptance.required?acceptance.confirmationMessage:'This will create the first Product Owner-authorised ecosystem using the approved Commercial Intelligence, Business Profile and current platform engines.\\n\\nThe historical package will remain preserved for audit.';
  if(!window.confirm(confirmMessage))return;
  const btn=document.getElementById('cgeGenerateBtn');
  btn.disabled=true;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-ecosystem-generation/confirm',{method:'POST',body:JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard'})});
    toast('Authorised ecosystem generation started');
    if(data.dashboard)renderCommercialEcosystemGeneration(data.dashboard);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    if(data.jobId){startCgeJobPolling(data.jobId);return}
    await loadDashboard();
  }catch(e){toast(e.message,true);updateCgeGenerateState()}
}
let cgePollTimer=null;
let cgePollStartedAt=null;
function startCgeJobPolling(jobId){
  if(cgePollTimer)clearInterval(cgePollTimer);
  cgePollStartedAt=Date.now();
  cgePollTimer=setInterval(async()=>{
    try{
      const data=await api('/api/master-admin-platform/jobs/'+encodeURIComponent(jobId));
      const job=data.job;
      if(!job)return;
      if(activeCgeDashboard){
        activeCgeDashboard.generationInProgress=job.status==='queued'||job.status==='running';
        activeCgeDashboard.activeJobId=job.id;
        activeCgeDashboard.generationProgress={
          percent:job.progress??0,
          currentStage:job.progressLabel||'Running',
          elapsedMs:cgePollStartedAt?Date.now()-cgePollStartedAt:null,
          remainingMs:job.estimatedRemainingMs??null,
          warnings:activeCgeDashboard.authorisedGeneration?.warnings||[]
        };
        renderCommercialEcosystemGeneration(activeCgeDashboard);
      }
      if(job.status==='completed'){
        clearInterval(cgePollTimer);
        cgePollTimer=null;
        toast('Authorised ecosystem generation completed');
        const rec=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-ecosystem-generation');
        if(rec.dashboard)renderCommercialEcosystemGeneration(rec.dashboard);
        if(rec.customer){activeCustomer=rec.customer;renderCustomerDetail(rec.customer)}
        await loadDashboard();
        closeCommercialEcosystemGeneration();
        openCommercialQualityReview();
      }
      if(job.status==='failed'){
        clearInterval(cgePollTimer);
        cgePollTimer=null;
        toast(job.error||'Generation failed',true);
        updateCgeGenerateState();
      }
    }catch{}
  },3000);
  startJobPolling();
}
function renderSearchConsoleIntegrationPanel(sc,targetId){
  const el=document.getElementById(targetId);
  if(!el)return;
  if(!sc){el.innerHTML='<p class="ci-narrative">Search Console data not available yet.</p>';return}
  const full=sc.version===1;
  const rows=full?[
    ['Connected',sc.connected?'Yes':'No'],
    ['Connection Status',sc.connectionStatus],
    ['Property',sc.property||'—'],
    ['Last Sync',sc.lastSync?fmt(sc.lastSync):'—'],
    ['Indexed Pages',sc.indexing.indexedPages??'—'],
    ['Submitted Pages',sc.indexing.submittedPages??'—'],
    ['Pending Pages',sc.indexing.pendingPages??'—'],
    ['Failed Pages',sc.indexing.failedPages??'—'],
    ['Coverage',sc.indexing.coverageSummary||'—'],
    ['Last Crawl',sc.indexing.lastCrawl?fmt(sc.indexing.lastCrawl):'—'],
    ['Impressions',sc.performance.impressions??'—'],
    ['Clicks',sc.performance.clicks??'—'],
    ['CTR',sc.performance.ctr||'—'],
    ['Average Position',sc.performance.averagePosition||'—'],
    ['Index Health',sc.indexHealth]
  ]:[
    ['Connection',sc.connectionStatus||sc.connectionStatus],
    ['Index Status',sc.indexStatus],
    ['Indexed Pages',sc.indexedPages??'—'],
    ['Submitted Pages',sc.submittedPages??'—'],
    ['Impressions',sc.impressions??'—'],
    ['Clicks',sc.clicks??'—'],
    ['Average Position',sc.averagePosition??'—'],
    ['Coverage',sc.coverage??'—'],
    ['Last Crawl',sc.lastCrawl?fmt(sc.lastCrawl):'—'],
    ['Last Sync',sc.lastSync?fmt(sc.lastSync):'—'],
    ['Property',sc.property||'—']
  ];
  let html=rows.map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val" style="font-size:.72rem">'+esc(String(row[1]))+'</div></div>').join('');
  if(full&&!sc.connected){
    html+='<div style="margin-top:12px"><a class="btn secondary" href="'+esc(sc.connectUrl)+'" style="display:inline-block;text-decoration:none;font-size:.72rem;padding:8px 12px">Connect Search Console</a></div>';
  }
  if(full&&sc.insights&&sc.insights.topPages&&sc.insights.topPages.length){
    html+='<div class="cqr-section" style="margin-top:12px;grid-column:1/-1"><h4 style="font-size:.72rem;color:#64748b">Top Pages</h4><table class="audit-table"><thead><tr><th>Page</th><th>Clicks</th><th>Impr.</th><th>Pos.</th></tr></thead><tbody>'+
      sc.insights.topPages.map(p=>'<tr><td>'+esc(p.title)+'<div style="font-size:.66rem;color:#64748b">'+esc(p.url)+'</div></td><td>'+esc(p.clicks)+'</td><td>'+esc(p.impressions)+'</td><td>'+esc(p.position??'—')+'</td></tr>').join('')+
      '</tbody></table></div>';
  }
  if(full&&sc.insights&&sc.insights.pagesAwaitingIndexing&&sc.insights.pagesAwaitingIndexing.length){
    html+='<div class="cqr-section" style="margin-top:8px;grid-column:1/-1"><h4 style="font-size:.72rem;color:#64748b">Pages Awaiting Indexing</h4><ul class="cqr-list">'+
      sc.insights.pagesAwaitingIndexing.slice(0,6).map(function(p){return '<li>'+esc(p.url)+(p.reason?' · '+esc(p.reason):'')+'</li>';}).join('')+'</ul></div>';
  }
  el.innerHTML=html;
}
function renderCommercialIndexingReview(dashboard){
  activeIdxDashboard=dashboard;
  const entryState=dashboard.entryStateLabel||dashboard.coverageLabel||'';
  const entryTone=dashboard.indexingRequested?'ready':(dashboard.canRequestIndexing||dashboard.publicationVerification==='PASS'?'ready':'blocked');
  document.getElementById('idxHero').innerHTML='<h4>Search Console &amp; Indexing</h4><p class="ci-narrative">'+esc(dashboard.narrative||'')+'</p><div class="cqr-overall '+entryTone+'">'+esc(entryState)+'</div>';
  mountWorkflowNav('idxHero','Customer Pharmacy');
  renderSearchConsoleIntegrationPanel(dashboard.searchConsoleIntegration,'idxSearchConsole');
  document.getElementById('idxStats').innerHTML=[
    ['Publication',dashboard.publicationStateLabel||(dashboard.published?'Published':'Not published')],
    ['Publication verification',dashboard.publicationVerification||'—'],
    ['Approval',dashboard.approvalStateLabel||'—'],
    ['Indexing inventory',dashboard.inventoryStateLabel||'—'],
    ['Pages ready',dashboard.pagesReady!=null?dashboard.pagesReady:dashboard.expectedUrls?.length||0],
    ['Search Console',dashboard.searchConsoleStatus||'Not connected'],
    ['Indexing submission',dashboard.indexingSubmissionLabel||'Not started'],
    ['Sitemap',dashboard.sitemapUrl||'—'],
    ['Robots',dashboard.robotsLabel||'—']
  ].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val" style="font-size:.72rem">'+esc(String(row[1]))+'</div></div>').join('');
  document.getElementById('idxCoverage').textContent=dashboard.coverageLabel||entryState||'';
  document.getElementById('idxUrls').innerHTML=(dashboard.expectedUrls||[]).length?(dashboard.expectedUrls||[]).map(u=>'<li>'+esc(u)+'</li>').join(''):'<li>No URLs registered yet</li>';
  document.getElementById('idxHistory').innerHTML=(dashboard.history||[]).map(h=>'<div class="workflow-meta">'+fmt(h.timestamp)+' · '+esc(h.label)+' · '+esc(h.detail)+'</div>').join('')||'<div class="workflow-meta">No indexing history yet.</div>';
  document.getElementById('idxPanelStats').innerHTML='<div class="bpr-panel-stat"><div class="lbl">Next Step</div><div style="font-weight:800">'+esc(dashboard.nextStep||'')+'</div></div>';
  updateIdxRequestState();
  if(dashboard.indexingRequested)document.getElementById('idxMsg').textContent='Indexing already requested.';
  else if(!dashboard.published)document.getElementById('idxMsg').textContent='Publish first.';
  else if(!dashboard.searchConsoleConnected)document.getElementById('idxMsg').textContent='Connect Search Console to continue controlled indexing.';
  else document.getElementById('idxMsg').textContent=dashboard.nextStep||'';
}
function updateIdxRequestState(){
  const box=document.getElementById('idxConfirmCheckbox');
  const btn=document.getElementById('idxRequestBtn');
  if(!btn||!activeIdxDashboard)return;
  btn.disabled=!activeIdxDashboard.canRequestIndexing||activeIdxDashboard.indexingRequested||!(box&&box.checked);
  btn.textContent=activeIdxDashboard.indexingRequested?'Indexing Requested':'Request Indexing';
}
async function openCommercialIndexingReview(force){
  if(!activeCustomer)return;
  if(!force&&!customerAtIndexing(activeCustomer)){toast('Indexing is not the current stage for this customer.',true);return}
  document.getElementById('idxModal').classList.add('open');
  document.getElementById('idxLoading').style.display='block';
  document.getElementById('idxContent').style.display='none';
  document.getElementById('idxError').style.display='none';
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','indexing-review');history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-indexing-review');
    renderCommercialIndexingReview(data.dashboard);
    if(data.customer)activeCustomer=data.customer;
    document.getElementById('idxLoading').style.display='none';
    document.getElementById('idxContent').style.display='block';
  }catch(e){
    document.getElementById('idxLoading').style.display='none';
    document.getElementById('idxError').style.display='block';
    document.getElementById('idxErrorDetail').textContent=e.message||String(e);
  }
}
function closeCommercialIndexingReview(){
  document.getElementById('idxModal').classList.remove('open');
  activeIdxDashboard=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='indexing-review'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function requestCommercialIndexing(){
  if(!activeCustomer||!activeIdxDashboard)return;
  const btn=document.getElementById('idxRequestBtn');
  btn.disabled=true;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-indexing-review/request',{method:'POST',body:JSON.stringify({operatorConfirmed:true,initiationSource:'product_owner_dashboard',campaignId:activeCustomer.selectedCampaignId||''})});
    toast('Indexing requested');
    if(data.dashboard)renderCommercialIndexingReview(data.dashboard);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    await loadDashboard();
  }catch(e){toast(e.message,true);updateIdxRequestState()}
}
function renderCommercialPerformanceDashboard(dashboard){
  activePerfDashboard=dashboard;
  document.getElementById('perfHero').innerHTML='<h4>Growth Dashboard</h4><p class="ci-narrative">'+esc(dashboard.narrative||'')+'</p><div class="cqr-overall '+(dashboard.completed?'ready':'blocked')+'">'+(dashboard.completed?'Commercial Workflow Complete':esc(dashboard.nextStep||''))+'</div>';
  mountWorkflowNav('perfHero','Customer Pharmacy');
  renderSearchConsoleIntegrationPanel(dashboard.searchConsoleIntegration,'perfSearchConsole');
  document.getElementById('perfStats').innerHTML=[['Indexed Pages',dashboard.indexedPages],['Ranked Pages',dashboard.rankedPages],['Average Position',dashboard.averagePosition],['Impressions',dashboard.impressions],['Clicks',dashboard.clicks],['CTR',dashboard.ctr],['Last Update',dashboard.lastUpdate?fmt(dashboard.lastUpdate):'Not available']].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val">'+esc(String(row[1]))+'</div></div>').join('');
  document.getElementById('perfTopPages').innerHTML=(dashboard.topPerformingPages||[]).length?('<table class="audit-table"><thead><tr><th>Page</th><th>Position</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>'+(dashboard.topPerformingPages||[]).map(p=>'<tr><td>'+esc(p.title)+'<div style="font-size:.66rem;color:#64748b">'+esc(p.url)+'</div></td><td>'+esc(p.position)+'</td><td>'+esc(p.impressions)+'</td><td>'+esc(p.clicks)+'</td><td>'+esc(p.ctr)+'</td></tr>').join('')+'</tbody></table>'):'<p class="ci-narrative">Performance page data not yet available.</p>';
  document.getElementById('perfOpportunities').innerHTML=(dashboard.topOpportunities||[]).map(o=>'<li>'+esc(o)+'</li>').join('');
  document.getElementById('perfHealth').innerHTML=[['SEO Health',dashboard.seoHealthLabel],['Commercial Health',dashboard.commercialHealthLabel],['Growth Trend',dashboard.growthTrendLabel],['Google Business Profile',dashboard.googleBusinessProfileStatus]].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val" style="font-size:.72rem">'+esc(String(row[1]))+'</div></div>').join('');
  document.getElementById('perfPanelStats').innerHTML='<div class="bpr-panel-stat"><div class="lbl">Next Step</div><div style="font-weight:800">'+esc(dashboard.nextStep||'')+'</div></div>';
  const btn=document.getElementById('perfCompleteBtn');
  if(btn){btn.disabled=!dashboard.canComplete;btn.textContent=dashboard.completed?'Workflow Complete':'Complete Commercial Workflow'}
  document.getElementById('perfMsg').textContent=dashboard.completed?'You can continue monitoring from the customer dashboard.':'';
  const canonical=dashboard.canonicalResults;
  if(canonical&&canonical.classification==='CANONICAL'){
    const lines=(canonical.pages||[]).map(function(page){
      return esc(page.identity.canonicalUrl)+' · '+esc(page.submissionStatus)+' · '+esc(page.indexingStatus)+' · '+esc(page.dataFreshness);
    });
    document.getElementById('perfMsg').textContent='Canonical campaign results: '+canonical.publishedPageCount+' published, '+canonical.submittedPageCount+' submitted, '+canonical.indexedPageCount+' indexed. '+(lines.join(' | ')||'');
  }
}
async function openCommercialPerformanceDashboard(force){
  if(!activeCustomer)return;
  if(!force&&!customerAtPerformanceDashboard(activeCustomer)){toast('Growth Dashboard is not the current stage for this customer.',true);return}
  document.getElementById('perfModal').classList.add('open');
  document.getElementById('perfLoading').style.display='block';
  document.getElementById('perfContent').style.display='none';
  document.getElementById('perfError').style.display='none';
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','performance-dashboard');history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const campaignQuery=activeCustomer.selectedCampaignId?('?campaignId='+encodeURIComponent(activeCustomer.selectedCampaignId)):'';
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-performance-dashboard'+campaignQuery);
    renderCommercialPerformanceDashboard(data.dashboard);
    if(data.customer)activeCustomer=data.customer;
    document.getElementById('perfLoading').style.display='none';
    document.getElementById('perfContent').style.display='block';
  }catch(e){
    document.getElementById('perfLoading').style.display='none';
    document.getElementById('perfError').style.display='block';
    document.getElementById('perfErrorDetail').textContent=e.message||String(e);
  }
}
function closeCommercialPerformanceDashboard(){
  document.getElementById('perfModal').classList.remove('open');
  activePerfDashboard=null;
  const p=new URLSearchParams(location.search);if(p.get('panel')==='performance-dashboard'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function refreshCommercialPerformanceDashboard(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-performance-dashboard/refresh',{method:'POST',body:'{}'});
    if(data.dashboard)renderCommercialPerformanceDashboard(data.dashboard);
    toast('Performance refreshed');
  }catch(e){toast(e.message,true)}
}
async function completeCommercialPerformanceDashboard(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-performance-dashboard/complete',{method:'POST',body:'{}'});
    toast('Commercial workflow complete');
    if(data.dashboard)renderCommercialPerformanceDashboard(data.dashboard);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    if(data.workflow){activeCustomer.workflow=data.workflow}
    await loadDashboard();
  }catch(e){toast(e.message,true)}
}
document.querySelectorAll('.modal-backdrop').forEach(el=>{el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open')})});
initSpgGenerateControls();
initSpeGenerateControls();
bindIerBranchSelectionControls();
loadDashboard().then(()=>{const p=new URLSearchParams(location.search);const slug=p.get('customer');const campaignId=p.get('campaignId');if(p.get('panel')==='platform-infrastructure')openPlatformInfrastructure();else if(slug)openCustomer(slug,{campaignId:campaignId||''}).then(()=>{if(p.get('panel')==='business-profile-review'&&businessProfileReviewOpenAllowed(activeCustomer))openBusinessProfileReview();else if(p.get('panel')==='business-profile-review')clearBprPanelUrlParam();else if(p.get('panel')==='commercial-intelligence')openCommercialIntelligenceReview();else if(p.get('panel')==='quality-review'&&customerAtQualityReview(activeCustomer))openCommercialQualityReview();else if(p.get('panel')==='generate-ecosystem'&&activeCustomer&&(customerAtGenerateEcosystem(activeCustomer)||(activeCustomer.commercialIntelligence&&activeCustomer.commercialIntelligence.canGenerateEcosystem)))openCommercialEcosystemGeneration();else if(p.get('panel')==='imported-evidence-review'&&activeCustomer)openImportedEvidenceReview();else if(p.get('panel')==='service-page-evidence-review'&&activeCustomer)openServicePageEvidenceReview();else if(p.get('panel')==='service-page-generation'&&activeCustomer)openServicePageGeneration();else if(p.get('panel')==='service-page-review'&&activeCustomer)openServicePageReview();else if(p.get('panel')==='cluster-page-review'&&activeCustomer)openClusterPageReview();else if(p.get('panel')==='indexing-review')openCommercialIndexingReview(true);else if(p.get('panel')==='performance-dashboard'||p.get('panel')==='growth-dashboard')openCommercialPerformanceDashboard(true);else if(p.get('panel')==='managed-publishing'&&activeCustomer&&customerAtManagedPublishing(activeCustomer))openManagedPublishing();else if(p.get('panel')==='legacy-deployment-configuration'&&activeCustomer)openCommercialDeploymentConfiguration();else if(p.get('panel')==='publish-review'&&customerAtPublishReview(activeCustomer))openCommercialPublishReview();else if(p.get('panel')==='local-coverage'||p.get('panel')==='generation-setup'){const el=document.getElementById('detailLocalCoverageCollapse');if(el)el.open=true}})});

async function loadVerifiedNationalCompetitorIntelligence(){
  const root=document.getElementById(
    'verifiedNationalCompetitorIntelligence'
  );

  if(!root) return;

  try{
    const slug=
      new URLSearchParams(location.search).get('slug') ||
      'pharmaconnect';

    const x=await api(
      '/api/master-admin-platform/customers/' +
      encodeURIComponent(slug) +
      '/verified-national-competitor-intelligence'
    );

    document.getElementById('vnciStatus').textContent=
      x.status === 'complete' ?
      'VERIFIED' :
      String(x.status || 'UNKNOWN').toUpperCase();

    const safeMetric=function(value){
      if(value===null||value===undefined||value==='')return 'Not available';
      const n=Number(value);
      if(typeof value==='number'&&!Number.isFinite(value))return 'Not available';
      if(typeof value==='string'&&value.toLowerCase()==='nan')return 'Not available';
      return String(value);
    };

    const pct=function(value){
      if(value===null||value===undefined||value==='')return 'Not available';
      const n=Number(value);
      if(!Number.isFinite(n))return 'Not available';
      return Math.round(n)+'%';
    };

    const metrics=[
      ['Verified Direct Competitors',x.directCompetitorCount],
      ['Adjacent Competitors',x.adjacentCompetitorCount],
      ['Commercial Keywords',x.totalRelevantKeywords],
      ['High-Commercial Keywords',x.totalHighCommercialKeywords],
      ['Relevant Search Volume',x.totalRelevantSearchVolume],
    ];

    document.getElementById('vnciMetrics').innerHTML=
      metrics.map(([label,value])=>
        '<div class="metric-card">'+
          '<div class="metric-value">'+esc(safeMetric(value))+'</div>'+
          '<div class="metric-label">'+esc(label)+'</div>'+
        '</div>'
      ).join('');

    const keywordHtml=function(k){
      const url=k&&k.url?String(k.url):'';
      const keyword=esc(k&&k.keyword?k.keyword:'Not available');
      return '<div style="font-size:.75rem;padding:5px 0;border-top:1px solid rgba(148,163,184,.12)">'+
        '<strong>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+keyword+'</a>':keyword)+'</strong>'+
        ' · Position '+esc(safeMetric(k&&k.position))+
        ' · Volume '+esc(safeMetric(k&&k.searchVolume))+
      '</div>';
    };

    const evidenceHtml=function(c){
      const reasons=[
        ...(Array.isArray(c.reasons)?c.reasons:[]),
        ...(Array.isArray(c.qualificationReasons)?c.qualificationReasons:[]),
        ...(c.evidenceBasis?['Evidence basis: '+c.evidenceBasis]:[]),
        ...(c.websiteCommercialEvidence?['Own-site commercial evidence available']:[]),
      ].filter(Boolean).slice(0,4);
      return reasons.length
        ? '<details style="margin-top:10px"><summary style="cursor:pointer;color:#cbd5e1;font-size:.76rem;font-weight:800">Evidence and rationale</summary><ul style="margin:8px 0 0 18px;color:#94a3b8;font-size:.72rem;line-height:1.45">'+
          reasons.map(function(reason){return '<li>'+esc(reason)+'</li>';}).join('')+
          '</ul></details>'
        : '<div style="font-size:.72rem;color:#94a3b8;margin-top:10px">Evidence detail not available in persisted snapshot.</div>';
    };

    const renderCompetitor=function(c,classificationLabel){
      const keywords=Array.isArray(c.strongestKeywords)?c.strongestKeywords:[];
      return '<div class="ci-card" style="margin-top:10px">'+
        '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
          '<strong>'+esc(c.domain || 'Domain not available')+'</strong>'+
          '<span class="status-pill">'+
            'Confidence '+esc(pct(c.confidenceScore))+
          '</span>'+
        '</div>'+
        '<div style="font-size:.74rem;color:#94a3b8;margin-top:6px">'+
          esc(classificationLabel || c.classification || 'Competitor')+
          ' · Evidence: '+esc(c.evidenceBasis || 'Not available')+
        '</div>'+
        '<div style="font-size:.78rem;margin-top:8px">'+
          'Relevant keywords: <strong>'+esc(safeMetric(c.relevantKeywords))+'</strong>'+
          ' · High-commercial: <strong>'+esc(safeMetric(c.highCommercialKeywords))+'</strong>'+
          ' · Top 10: <strong>'+esc(safeMetric(c.top10RelevantKeywords))+'</strong>'+
          ' · Search volume: <strong>'+esc(safeMetric(c.relevantSearchVolume))+'</strong>'+
        '</div>'+
        (keywords.length ?
          '<div style="margin-top:10px">'+
            keywords.slice(0,5).map(keywordHtml).join('')+
          '</div>'
          :
          '<div style="font-size:.72rem;color:#94a3b8;margin-top:10px">No strongest keyword evidence available for this competitor.</div>'
        )+
        evidenceHtml(c)+
      '</div>';
    };

    const directCompetitors=x.directCompetitors || [];
    const adjacentCompetitors=x.adjacentCompetitors || [];

    document.getElementById('vnciDirect').innerHTML=
      directCompetitors.length ?
      directCompetitors.map(function(c){return renderCompetitor(c,'Direct competitor');}).join('') :
      '<div class="guidance-box">No verified direct competitors.</div>';

    document.getElementById('vnciAdjacent').innerHTML=
      adjacentCompetitors.length ?
      adjacentCompetitors.map(function(c){return renderCompetitor(c,'Adjacent competitor');}).join('') :
      '<div class="guidance-box">No adjacent competitors.</div>';

    const bestByKeyword=new Map();
    [...directCompetitors,...adjacentCompetitors].forEach(function(c){
      (Array.isArray(c.strongestKeywords)?c.strongestKeywords:[]).forEach(function(k){
        const key=String(k.keyword||'').trim().toLowerCase();
        if(!key)return;
        const current=bestByKeyword.get(key);
        const currentPos=Number(current&&current.position);
        const nextPos=Number(k.position);
        if(!current||(
          Number.isFinite(nextPos)&&(!Number.isFinite(currentPos)||nextPos<currentPos)
        )){
          bestByKeyword.set(key,{...k,competitor:c.domain||'Not available'});
        }
      });
    });

    const keywordRows=[...bestByKeyword.values()].sort(function(a,b){
      const av=Number(a.searchVolume)||0;
      const bv=Number(b.searchVolume)||0;
      return bv-av;
    });

    document.getElementById('vnciKeywordEvidence').innerHTML=
      keywordRows.length ?
      '<table class="audit-table"><thead><tr><th>Keyword</th><th>Best Observed Competitor</th><th>Position</th><th>Search Volume</th><th>Commercial Signal</th></tr></thead><tbody>'+
        keywordRows.map(function(k){
          return '<tr>'+
            '<td>'+esc(k.keyword||'Not available')+'</td>'+
            '<td>'+esc(k.competitor||'Not available')+'</td>'+
            '<td>'+esc(safeMetric(k.position))+'</td>'+
            '<td>'+esc(safeMetric(k.searchVolume))+'</td>'+
            '<td>'+esc(k.classification||'Not available')+'</td>'+
          '</tr>';
        }).join('')+
      '</tbody></table>' :
      '<div class="guidance-box">No persisted keyword evidence available.</div>';

    const hasVerifiedEvidence=directCompetitors.length>0||adjacentCompetitors.length>0;
    const reviewBtn=document.getElementById('vnciReviewBtn');
    const reviewMsg=document.getElementById('vnciReviewMsg');
    if(reviewBtn&&hasVerifiedEvidence){
      reviewBtn.disabled=false;
      reviewBtn.onclick=function(){
        const panel=document.getElementById('verifiedNationalCompetitorIntelligence');
        if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});
      };
    }
    if(reviewMsg){
      reviewMsg.textContent=hasVerifiedEvidence
        ? 'Verified national competitor evidence is available for Product Owner review. This button focuses the current review panel; no discovery or regeneration is executed.'
        : 'Review is disabled because no verified national competitor evidence is available.';
    }

  }catch(error){
    document.getElementById('vnciStatus').textContent='ERROR';

    document.getElementById('vnciDirect').innerHTML=
      '<div class="guidance-box">'+
      esc(error instanceof Error ? error.message : String(error))+
      '</div>';
    const metrics=document.getElementById('vnciMetrics');
    if(metrics)metrics.innerHTML='<div class="guidance-box">National intelligence API unavailable.</div>';
    const adjacent=document.getElementById('vnciAdjacent');
    if(adjacent)adjacent.innerHTML='<div class="guidance-box">Adjacent competitor evidence unavailable.</div>';
    const keywords=document.getElementById('vnciKeywordEvidence');
    if(keywords)keywords.innerHTML='<div class="guidance-box">Commercial keyword evidence unavailable.</div>';
  }
}

async function loadMarketOpportunityIntelligence(){
  const summaryEl=document.getElementById('moiSummary');
  const oppEl=document.getElementById('moiOpportunities');
  const pagesEl=document.getElementById('moiPages');
  if(!summaryEl||!oppEl||!pagesEl)return;

  const safeMetric=function(value){
    if(value===null||value===undefined||value==='')return 'Not available';
    const n=Number(value);
    if(typeof value==='number'&&!Number.isFinite(value))return 'Not available';
    if(typeof value==='string'&&value.toLowerCase()==='nan')return 'Not available';
    return String(value);
  };

  try{
    const slug=
      new URLSearchParams(location.search).get('slug') ||
      'pharmaconnect';

    const data=await api(
      '/api/master-admin-platform/customers/' +
      encodeURIComponent(slug) +
      '/market-opportunity-intelligence'
    );

    const s=data.summary||{};
    const metrics=[
      ['Keyword Universe',s.keywordUniverse],
      ['Qualified Commercial Keywords',s.qualifiedCommercialKeywords],
      ['High-Priority Opportunities',s.highPriorityOpportunities],
      ['Untapped',s.untappedKeywords],
      ['Weak Coverage',s.weakCoverageKeywords],
      ['Qualified Search Demand',s.totalSearchDemand],
    ];

    summaryEl.innerHTML=metrics.map(function(row){
      return '<div class="metric-card">'+
        '<div class="metric-value">'+esc(safeMetric(row[1]))+'</div>'+
        '<div class="metric-label">'+esc(row[0])+'</div>'+
      '</div>';
    }).join('');

    const qualified=(data.keywordOpportunities||[])
      .filter(function(item){return item.qualification==='QUALIFIED';})
      .slice(0,10);

    oppEl.innerHTML=qualified.length?
      '<table class="audit-table"><thead><tr><th>Keyword</th><th>Volume</th><th>CPC</th><th>Competitors Ranking</th><th>Best Position</th><th>PharmaConnect Position</th><th>Gap</th><th>Score</th><th>Priority</th></tr></thead><tbody>'+
      qualified.map(function(item){
        return '<tr>'+
          '<td><strong>'+esc(item.keyword||'Not available')+'</strong><br><span style="font-size:.68rem;color:#94a3b8">'+esc((item.reasons||[]).slice(0,2).join(' '))+'</span></td>'+
          '<td>'+esc(safeMetric(item.searchVolume))+'</td>'+
          '<td>'+esc(safeMetric(item.cpc))+'</td>'+
          '<td>'+esc(safeMetric(item.competitorCount))+'</td>'+
          '<td>'+esc(safeMetric(item.bestCompetitorPosition))+'</td>'+
          '<td>'+esc(safeMetric(item.subjectPosition))+'</td>'+
          '<td>'+esc(item.gapType||'unknown')+'</td>'+
          '<td>'+esc(safeMetric(item.opportunityScore))+'</td>'+
          '<td>'+esc(item.priority||'LOW')+'</td>'+
        '</tr>';
      }).join('')+
      '</tbody></table>'+
      '<details style="margin-top:10px"><summary style="cursor:pointer;color:#cbd5e1;font-size:.76rem;font-weight:800">Opportunity evidence details</summary>'+
        qualified.map(function(item){
          return '<div class="ci-card" style="margin-top:10px">'+
            '<strong>'+esc(item.keyword||'Not available')+'</strong>'+
            '<div style="font-size:.72rem;color:#94a3b8;margin-top:6px">'+
              'Winning URL: '+(item.bestRankingUrl?'<a href="'+esc(item.bestRankingUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(item.bestRankingUrl)+'</a>':'Not available')+
            '</div>'+
            '<ul style="font-size:.72rem;color:#94a3b8;line-height:1.45;margin:8px 0 0 18px">'+
              (item.reasons||[]).map(function(reason){return '<li>'+esc(reason)+'</li>';}).join('')+
            '</ul>'+
          '</div>';
        }).join('')+
      '</details>'
      : '<div class="guidance-box">No qualified commercial opportunities available.</div>';

    const pages=(data.rankingPages||[]).slice(0,10);
    pagesEl.innerHTML=pages.length?
      '<table class="audit-table"><thead><tr><th>Competitor</th><th>URL</th><th>Qualified Keywords</th><th>Best Position</th><th>Search Demand</th></tr></thead><tbody>'+
      pages.map(function(page){
        return '<tr>'+
          '<td>'+esc(page.competitorDomain||'Not available')+'</td>'+
          '<td>'+(page.url?'<a href="'+esc(page.url)+'" target="_blank" rel="noopener noreferrer">'+esc(page.url)+'</a>':'Not available')+'</td>'+
          '<td>'+esc(safeMetric(page.relevantKeywordCount))+'</td>'+
          '<td>'+esc(safeMetric(page.bestPosition))+'</td>'+
          '<td>'+esc(safeMetric(page.searchDemand))+'</td>'+
        '</tr>';
      }).join('')+
      '</tbody></table>'
      : '<div class="guidance-box">No competitor ranking pages available.</div>';

  }catch(error){
    summaryEl.innerHTML='<div class="guidance-box">Market Opportunity Intelligence unavailable.</div>';
    oppEl.innerHTML='<div class="guidance-box">'+esc(error instanceof Error?error.message:String(error))+'</div>';
    pagesEl.innerHTML='<div class="guidance-box">Competitor page evidence unavailable.</div>';
  }
}

async function loadMarketUniverseV2(){
  const summaryEl=document.getElementById('muv2Summary');
  const groupsEl=document.getElementById('muv2Groups');
  if(!summaryEl||!groupsEl)return;
  const safe=function(value){
    if(value===null||value===undefined||value==='')return 'Not available';
    const n=Number(value);
    if(typeof value==='number'&&!Number.isFinite(value))return 'Not available';
    if(typeof value==='string'&&value.toLowerCase()==='nan')return 'Not available';
    return String(value);
  };
  try{
    const slug=new URLSearchParams(location.search).get('slug')||'pharmaconnect';
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/market-opportunity-intelligence-v2');
    const s=data.summary||{};
    const metrics=[
      ['Total Market Keyword Universe',s.unique],
      ['Money Keywords',s.moneyKeywords],
      ['Commercial Support',s.commercialSupport],
      ['Untapped',s.untapped],
      ['Weak Coverage',s.weakCoverage],
      ['Qualified Demand',s.qualifiedCommercialSearchDemand],
    ];
    summaryEl.innerHTML=metrics.map(function(row){
      return '<div class="metric-card"><div class="metric-value">'+esc(safe(row[1]))+'</div><div class="metric-label">'+esc(row[0])+'</div></div>';
    }).join('');
    const groupDefs=[
      ['CORE','Core Commercial Opportunities'],
      ['ADJACENT','Adjacent/Broader Market Opportunities'],
      ['BROAD','Broad Pharma Market Opportunities'],
      ['MONEY_KEYWORD','Money Keywords'],
      ['COMMERCIAL_SUPPORT','Commercial Support'],
      ['AUTHORITY_SUPPORT','Authority / Content Support'],
      ['PATIENT_SERVICE','Excluded Patient Searches'],
      ['AMBIGUOUS_REVIEW','Review Required'],
      ['UNTAPPED','Untapped Commercial Opportunities'],
      ['WEAK_COVERAGE','Weak Coverage'],
      ['NEW_MARKET','New Market Opportunities'],
    ];
    groupsEl.innerHTML=groupDefs.map(function(group){
      const rows=(data.universe||[]).filter(function(item){return item.gapType===group[0]||item.type===group[0]||item.marketScope===group[0];}).slice(0,8);
      return '<div class="ci-card" style="margin-top:10px"><h5 style="margin:0 0 8px;color:#e2e8f0">'+esc(group[1])+'</h5>'+
        (rows.length?'<table class="audit-table"><thead><tr><th>Keyword</th><th>Volume</th><th>CPC</th><th>Difficulty</th><th>Intent</th><th>Gap</th><th>Score</th><th>Evidence</th></tr></thead><tbody>'+
          rows.map(function(item){
            return '<tr><td>'+esc(item.keyword||'Not available')+'</td><td>'+esc(safe(item.searchVolume))+'</td><td>'+esc(safe(item.cpc))+'</td><td>'+esc(safe(item.keywordDifficulty))+'</td><td>'+esc(safe(item.intent))+'</td><td>'+esc(item.gapType||'REVIEW')+'</td><td>'+esc(safe(item.score))+'</td><td>'+esc((item.reasons||[]).slice(0,2).join(' '))+'</td></tr>';
          }).join('')+'</tbody></table>':'<div class="guidance-box">No '+esc(group[1]).toLowerCase()+' in the current snapshot.</div>')+
      '</div>';
    }).join('');
  }catch(error){
    summaryEl.innerHTML='<div class="guidance-box">Market Universe V2 unavailable.</div>';
    groupsEl.innerHTML='<div class="guidance-box">'+esc(error instanceof Error?error.message:String(error))+'</div>';
  }
}

async function loadGrowthPlanInputContract(){
  const summaryEl=document.getElementById('gpiSummary');
  const gapsEl=document.getElementById('gpiGaps');
  if(!summaryEl||!gapsEl)return;
  const safe=function(value){
    if(value===null||value===undefined||value==='')return 'Not available';
    const n=Number(value);
    if(typeof value==='number'&&!Number.isFinite(value))return 'Not available';
    return String(value);
  };
  try{
    const slug=new URLSearchParams(location.search).get('slug')||'pharmaconnect';
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/growth-plan-intelligence-input');
    const s=data.summary||{};
    const summary=[
      ['Primary Commercial',s.primaryCommercialCount],
      ['Supporting Commercial',s.supportingCommercialCount],
      ['Authority Support',s.authoritySupportCount],
      ['Market Expansion',s.marketExpansionCount],
      ['Excluded',s.excludedCount],
      ['Review Required',s.reviewRequiredCount],
    ];
    const gaps=[
      ['Proven Untapped',s.provenUntappedCount],
      ['Weak Coverage',s.provenWeakCoverageCount],
      ['Defend/Improve',s.provenDefendImproveCount],
      ['Insufficient Gap Evidence',s.insufficientGapEvidenceCount],
    ];
    summaryEl.innerHTML=summary.map(function(row){return '<div class="metric-card"><div class="metric-value">'+esc(safe(row[1]))+'</div><div class="metric-label">'+esc(row[0])+'</div></div>';}).join('');
    gapsEl.innerHTML=gaps.map(function(row){return '<div class="metric-card"><div class="metric-value">'+esc(safe(row[1]))+'</div><div class="metric-label">'+esc(row[0])+'</div></div>';}).join('');
  }catch(error){
    summaryEl.innerHTML='<div class="guidance-box">Growth Plan Input has not been built yet.</div>';
    gapsEl.innerHTML='';
  }
}

async function loadGrowthPlanIntelligenceV1(){
  const summaryEl=document.getElementById('gpiv1Summary');
  const actionsEl=document.getElementById('gpiv1Actions');
  if(!summaryEl||!actionsEl)return;
  const safe=function(value){
    if(value===null||value===undefined||value==='')return 'Not available';
    const n=Number(value);
    if(typeof value==='number'&&!Number.isFinite(value))return 'Not available';
    return String(value);
  };
  try{
    const slug=new URLSearchParams(location.search).get('slug')||'pharmaconnect';
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/growth-plan-intelligence');
    const s=data.summary||{};
    const summary=[
      ['Recommended Actions',s.totalActions],
      ['High Priority',s.highPriorityActions],
      ['Primary Demand',s.primaryCommercialDemand],
      ['Supporting Demand',s.supportingDemand],
      ['Proven Untapped',s.provenUntappedCount],
      ['Needs More Evidence',s.insufficientEvidenceCount],
    ];
    summaryEl.innerHTML=summary.map(function(row){return '<div class="metric-card"><div class="metric-value">'+esc(safe(row[1]))+'</div><div class="metric-label">'+esc(row[0])+'</div></div>';}).join('');
    const actions=(data.actions||[]).slice(0,8);
    actionsEl.innerHTML=actions.length?'<table class="audit-table"><thead><tr><th>Action</th><th>Keyword</th><th>Demand</th><th>Priority</th><th>Gap</th><th>Competitor</th><th>Why</th></tr></thead><tbody>'+
      actions.map(function(action){
        return '<tr><td>'+esc(action.actionType||'Not available')+'</td><td>'+esc(action.primaryKeyword||'Not available')+'</td><td>'+esc(safe(action.combinedSearchDemand))+'</td><td>'+esc(action.priority||'LOW')+'</td><td>'+esc((action.gapEvidenceStatus||'')+' / '+(action.gapConfidence||''))+'</td><td>'+esc(action.bestCompetitorDomain||'Not available')+'</td><td>'+esc(action.rationale||'Not available')+'</td></tr>';
      }).join('')+'</tbody></table>':'<div class="guidance-box">Growth Plan Intelligence has no actions yet.</div>';
  }catch(error){
    summaryEl.innerHTML='<div class="guidance-box">Growth Plan Intelligence has not been built yet.</div>';
    actionsEl.innerHTML='';
  }
}

loadVerifiedNationalCompetitorIntelligence();
loadMarketOpportunityIntelligence();
loadMarketUniverseV2();
loadGrowthPlanInputContract();
loadGrowthPlanIntelligenceV1();

</script>
</body>
</html>`;
}

router.get("/admin/master", requireAdmin, (_req, res) => {
  res.type("html").send(renderMasterAdminPlatformShell());
});

export default router;
