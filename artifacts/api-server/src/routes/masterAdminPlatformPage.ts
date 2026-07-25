/**
 * Master Admin Platform V1 — instant shell; data loaded asynchronously via API.
 */
import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAuth.js";

const router = Router();

export function renderMasterAdminPlatformShell(): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Master Admin · PharmaConnect</title>
<style>
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
.customer-row{cursor:pointer}
.customer-row:hover{background:#1e293b}
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
.cqr-publish-btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px;font-size:.78rem;font-weight:700;width:100%;cursor:pointer;margin-top:8px}
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
</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-logo">PharmaConnect</div>
  <span class="admin-pill">Master Admin</span>
  <span class="topbar-sub">Operational control centre</span>
  <span class="load-ms" id="loadMs"></span>
  <nav class="topbar-nav">
    <button type="button" onclick="openPlatformInfrastructure()">Platform Publishing Connection</button>
    <a href="/api/admin/master/issues">Issue Centre</a>
    <button type="button" onclick="openAuditLog()">Audit Log</button>
    <button type="button" onclick="loadDashboard()">Refresh</button>
    <a href="/api/admin/pharmacies">Legacy Admin</a>
  </nav>
</header>

<div class="layout">
  <div class="main-col">
    <div class="stats">
      <div class="stat"><div class="stat-val" id="statTotal">—</div><div class="stat-label">Total Customers</div></div>
      <div class="stat"><div class="stat-val" id="statActive">—</div><div class="stat-label">Active</div></div>
      <div class="stat"><div class="stat-val" id="statSuspended">—</div><div class="stat-label">Suspended</div></div>
      <div class="stat"><div class="stat-val" id="statArchived">—</div><div class="stat-label">Archived</div></div>
    </div>
    <div class="panel">
      <h2>Operational Workflow</h2>
      <div class="lifecycle-flow" id="workflowOverview"><div class="loading">Loading workflow…</div></div>
      <div class="toolbar">
        <input id="search" type="search" placeholder="Search customers…" oninput="filterCustomers()"/>
        <select id="lifecycleFilter" onchange="filterCustomers()"><option value="">All workflow stages</option></select>
        <button class="btn" type="button" onclick="openCreateModal()">+ Create Customer</button>
      </div>
      <div class="table-wrap" id="customerTableWrap"><div class="loading" id="tableLoading">Loading customers…</div></div>
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
    <label>Town or City *<input id="createTown" required placeholder="Operator must confirm — not inferred from postcode alone"/></label>
    <label>Postcode *<input id="createPostcode" required placeholder="S11 8TP"/></label>
    <label>County<input id="createCounty"/></label>
    <label>Country *<input id="createCountry" required value="United Kingdom"/></label>
    <label>Primary service *<select id="createPrimaryService"><option value="pharmacy-first">Pharmacy First</option></select></label>
    <label>Primary email *<input id="createEmail" type="email" required/></label>
    <label>Phone<input id="createPhone"/></label>
  </div>
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
  <h4 style="font-size:.78rem;margin:8px 0 6px;color:#64748b">Local areas</h4>
  <p style="font-size:.72rem;color:#94a3b8;margin:0 0 8px">Add or select areas after Town or City and Postcode are entered. Suggestions require operator confirmation.</p>
  <div style="display:flex;gap:8px;margin-bottom:8px">
    <input id="createAreaName" placeholder="Area name" style="flex:1"/>
    <button class="btn secondary" type="button" onclick="addCreateIntakeArea()">Add Area</button>
  </div>
  <div style="max-height:140px;overflow:auto;border:1px solid #334155;border-radius:8px;margin-bottom:12px">
    <table class="local-coverage-area-table"><thead><tr><th></th><th>Area</th><th></th></tr></thead><tbody id="createIntakeAreasTbody"></tbody></table>
  </div>
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
  <div id="detailLoading" class="loading" style="display:none">Loading customer record…</div>
  <div id="detailContent" style="display:none">
    <div id="detailOnboardingSources" class="guidance-box" style="margin-bottom:10px"></div>
    <div id="detailBprBanner" class="bpr-customer-banner" style="display:none"></div>
    <div id="detailCirBanner" class="bpr-customer-banner" style="display:none"></div>
    <div id="detailCqrBanner" class="cqr-customer-banner" style="display:none"></div>
    <div id="detailCdcBanner" class="cdc-customer-banner" style="display:none"></div>
    <div id="detailCprBanner" class="cpr-customer-banner" style="display:none"></div>
    <div id="detailCgeBanner" class="cqr-customer-banner" style="display:none"></div>
    <div id="detailIdxBanner" class="cqr-customer-banner" style="display:none"></div>
    <div id="detailPerfBanner" class="cqr-customer-banner" style="display:none"></div>
    <div class="detail-lifecycle" id="detailLifecycle"></div>
    <div class="guidance-box" id="detailGuidance"></div>
    <div class="modal-grid">
      <div>
        <h4 style="font-size:.78rem;margin:0 0 8px;color:#64748b">Operational Summary</h4>
        <div class="orchestration-summary" id="detailOperationalSummary"></div>
        <div class="job-status" id="detailJobsPanel" style="margin-top:10px"></div>
        <h4 style="font-size:.78rem;margin:12px 0 6px;color:#64748b">Workflow History</h4>
        <div id="detailHistory" class="history-panel"></div>
      </div>
      <div>
        <button class="continue-btn" id="continueWorkflowBtn" type="button" onclick="continueWorkflow()">Continue Workflow</button>
        <div class="block-reason" id="detailBlockReason"></div>
        <div class="job-status" id="detailJobStatus" style="display:none;margin-top:10px"></div>
        <button class="btn secondary" type="button" id="editOnboardingSetupBtn" onclick="openOnboardingIntakeModal()" style="margin-top:8px;width:100%;font-size:.78rem">Edit Onboarding Setup</button>
        <button class="bpr-btn-review" type="button" id="openBprBtn" onclick="openBusinessProfileReview()" style="margin-top:8px">Open Business Profile Review</button>
        <button class="cir-btn-review" type="button" id="openCirBtn" onclick="openCommercialIntelligenceReview()" style="margin-top:8px;display:none">Open Intelligence Review</button>
        <button class="cqr-btn-review" type="button" id="openCqrBtn" onclick="openCommercialQualityReview()" style="margin-top:8px;display:none">Open Quality Review</button>
        <button class="mp-btn-review" type="button" id="openMpBtn" onclick="openManagedPublishing()" style="margin-top:8px;display:none">Open Managed Publishing</button>
        <button class="cdc-btn-review" type="button" id="openCdcBtn" onclick="openCommercialDeploymentConfiguration()" style="margin-top:8px;display:none">Legacy External Deployment</button>
        <button class="cpr-btn-review" type="button" id="openCprBtn" onclick="openCommercialPublishReview()" style="margin-top:8px;display:none">Open Publish Review</button>
        <button class="cqr-btn-review" type="button" id="openCgeBtn" onclick="openCommercialEcosystemGeneration()" style="margin-top:8px;display:none">Open Generate Ecosystem</button>
        <button class="cqr-btn-review" type="button" id="openIdxBtn" onclick="openCommercialIndexingReview()" style="margin-top:8px;display:none">Open Indexing</button>
        <button class="cqr-btn-review" type="button" id="openPerfBtn" onclick="openCommercialPerformanceDashboard()" style="margin-top:8px;display:none">Open Performance Dashboard</button>
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
        <details class="detail-collapse" id="detailLocalCoverageCollapse">
          <summary>Local Coverage</summary>
          <div class="detail-collapse-body">
            <p class="local-coverage-subtitle">Choose the areas you would like PharmaConnect to generate dedicated Local SEO pages for.</p>
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
      <label>Town or City *<input id="intakeTown" required/></label>
      <label>Postcode *<input id="intakePostcode" required/></label>
      <label>County<input id="intakeCounty"/></label>
      <label>Country *<input id="intakeCountry" required value="United Kingdom"/></label>
      <label>Primary service *<select id="intakePrimaryService"><option value="pharmacy-first">Pharmacy First</option></select></label>
      <label>Primary email *<input id="intakeEmail" type="email" required/></label>
      <label>Phone<input id="intakePhone"/></label>
      <label>Google profile URL<input id="intakeGoogle"/></label>
      <label>Google Place ID<input id="intakePlaceId"/></label>
    </div>
    <fieldset style="border:1px solid #334155;border-radius:8px;padding:10px 12px;margin:8px 0 12px">
      <legend style="font-size:.72rem;color:#64748b;padding:0 6px">Google profile policy *</legend>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeGooglePolicy" value="configured"/> Connect URL / Place ID above</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeGooglePolicy" value="no_profile"/> No Google Business Profile</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:.78rem"><input type="radio" name="intakeGooglePolicy" value="deferred"/> Add or connect later</label>
    </fieldset>
    <div class="orchestration-summary" id="intakeAreaDiscoverySummary" style="margin:12px 0">
      <div><span class="label">Local Areas</span><div id="intakeAreaDiscoveryTown">Town or City: —</div></div>
      <div><span class="label">Recommended areas</span><div id="intakeAreaDiscoveryRecommended">0</div></div>
      <div><span class="label">Selected areas</span><div id="intakeAreaDiscoverySelected">0</div></div>
      <div><span class="label">Local generation readiness</span><div id="intakeAreaDiscoveryReadiness">—</div></div>
    </div>
    <div style="margin-bottom:12px">
      <button class="btn secondary" type="button" onclick="openOnboardingAreasReviewModal()">View Local Areas</button>
    </div>
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
        <div class="cqr-section" id="cqrPreviewSection" style="display:none"><h4>Canonical Preview</h4><div class="cqr-actions" id="cqrPreviewLinks"></div></div>
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
        <button class="btn secondary" type="button" style="width:100%;font-size:.72rem;margin-top:12px" onclick="openCommercialDeploymentConfiguration()">Legacy External Deployment</button>
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
        <div id="cprApprovalError" class="bpr-approval-error" style="display:none"><div id="cprApprovalErrorMsg"></div></div>
        <div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialPublishReview()">Close</button></div>
      </aside>
    </div>
  </div>
</div></div>

<div class="modal-backdrop" id="cgeModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="cgeLoading" class="loading">Loading Generate Ecosystem…</div>
  <div id="cgeError" class="bpr-error-panel" style="display:none"><h4>Generate Ecosystem could not be loaded.</h4><p id="cgeErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openCommercialEcosystemGeneration()">Retry</button><button class="btn secondary" type="button" onclick="closeCommercialEcosystemGeneration()">Close</button></div></div>
  <div id="cgeContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="cgeHero"></div><div class="cqr-section" id="cgeHistoricalSection" style="display:none"><h4>Historical Ecosystem Package</h4><div id="cgeHistorical"></div></div><div class="cqr-section" id="cgeIncompleteSection" style="display:none"><h4>Authorised Generation Status</h4><div id="cgeIncomplete"></div></div><div class="cqr-section"><h4>Canonical Generation Plan</h4><div class="cqr-totals" id="cgeCanonicalPlan"></div></div><div class="cqr-section"><h4>Core Ecosystem</h4><div class="cqr-totals" id="cgeCoreEcosystem"></div><div id="cgeAreaClassifications" style="margin-top:8px"></div></div><div class="cqr-section" id="cgeRecommendedSection"><h4>Recommended Future Content</h4><div id="cgeRecommendedFuture"></div></div><div class="cqr-section"><h4>Generation Readiness</h4><div class="cqr-totals" id="cgeReadiness"></div></div><div class="cqr-section"><h4>Google Business Profile</h4><div id="cgeGoogle"></div></div><div class="cqr-section"><h4>What Will Be Generated</h4><p class="ci-narrative" id="cgeSummary"></p></div><div class="cqr-section" id="cgeProgressSection" style="display:none"><h4>Generation Progress</h4><div id="cgeProgress"></div></div></div><aside class="cqr-approval-panel"><h4>Generate Approved Ecosystem</h4><div id="cgePanelStats"></div><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="cgeConfirmCheckbox" onchange="updateCgeGenerateState()"/><span>I confirm that I want to create the first Product Owner-authorised ecosystem using the approved Commercial Intelligence and current Business Profile.</span></label></div><button class="cqr-approve-btn" type="button" id="cgeGenerateBtn" onclick="confirmCommercialEcosystemGeneration()" disabled>Generate Approved Ecosystem</button><div id="cgeMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialEcosystemGeneration()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="idxModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="idxLoading" class="loading">Loading Indexing Dashboard…</div>
  <div id="idxError" class="bpr-error-panel" style="display:none"><h4>Indexing Dashboard could not be loaded.</h4><p id="idxErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openCommercialIndexingReview()">Retry</button><button class="btn secondary" type="button" onclick="closeCommercialIndexingReview()">Close</button></div></div>
  <div id="idxContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="idxHero"></div><div class="cqr-section"><h4>Indexing Summary</h4><div class="cqr-totals" id="idxStats"></div></div><div class="cqr-section"><h4>Coverage</h4><p class="ci-narrative" id="idxCoverage"></p></div><div class="cqr-section"><h4>Expected URLs</h4><ul class="cqr-list" id="idxUrls"></ul></div><div class="cqr-section"><h4>Indexing History</h4><div id="idxHistory"></div></div></div><aside class="cqr-approval-panel"><h4>Request Indexing</h4><div id="idxPanelStats"></div><div class="cpr-confirm-box"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="idxConfirmCheckbox" onchange="updateIdxRequestState()"/><span>I confirm that I want to submit published pages for search indexing.</span></label></div><button class="cqr-approve-btn" type="button" id="idxRequestBtn" onclick="requestCommercialIndexing()" disabled>Request Indexing</button><div id="idxMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialIndexingReview()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="perfModal"><div class="modal" style="width:min(1180px,96vw);display:flex;flex-direction:column;max-height:92vh;padding:18px">
  <div id="perfLoading" class="loading">Loading Performance Dashboard…</div>
  <div id="perfError" class="bpr-error-panel" style="display:none"><h4>Performance Dashboard could not be loaded.</h4><p id="perfErrorDetail" class="bpr-error-detail"></p><div class="bpr-error-actions"><button class="btn" type="button" onclick="openCommercialPerformanceDashboard()">Retry</button><button class="btn secondary" type="button" onclick="closeCommercialPerformanceDashboard()">Close</button></div></div>
  <div id="perfContent" style="display:none;flex:1;overflow:auto"><div class="cqr-layout"><div class="cqr-main"><div class="cqr-hero" id="perfHero"></div><div class="cqr-section"><h4>Search Performance</h4><div class="cqr-totals" id="perfStats"></div></div><div class="cqr-section"><h4>Top Performing Pages</h4><div id="perfTopPages"></div></div><div class="cqr-section"><h4>Top Opportunities</h4><ul class="cqr-list" id="perfOpportunities"></ul></div><div class="cqr-section"><h4>Commercial Health</h4><div class="cqr-totals" id="perfHealth"></div></div></div><aside class="cqr-approval-panel"><h4>Complete Workflow</h4><div id="perfPanelStats"></div><button class="btn secondary" type="button" style="width:100%;margin-bottom:8px" onclick="refreshCommercialPerformanceDashboard()">Refresh Performance</button><button class="cqr-approve-btn" type="button" id="perfCompleteBtn" onclick="completeCommercialPerformanceDashboard()">Complete Commercial Workflow</button><div id="perfMsg" style="font-size:.72rem;margin-top:10px;color:#94a3b8"></div><div style="margin-top:12px"><button class="btn secondary" type="button" style="width:100%;font-size:.72rem" onclick="closeCommercialPerformanceDashboard()">Close</button></div></aside></div></div>
</div></div>

<div class="modal-backdrop" id="auditModal"><div class="modal" style="width:min(900px,100%)">
  <h3>Audit Log</h3><div class="table-wrap" style="max-height:60vh"><table class="audit-table"><thead><tr><th>Timestamp</th><th>User</th><th>Customer</th><th>Action</th><th>Status</th><th>Evidence</th></tr></thead><tbody id="auditTbody"></tbody></table></div>
  <div style="margin-top:12px;text-align:right"><button class="btn secondary" type="button" onclick="closeAuditModal()">Close</button></div>
</div></div>

<div class="toast" id="toast"></div>

<script>
let customers=[];
let workflowStages=[];
let workflowStageCounts={};
let activeCustomer=null;
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
  if(!text||text==='Distance unavailable')return '—';
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
async function loadLocalAreasDraft(){
  if(!activeCustomer)return;
  const data=await api('/api/master-admin-platform/generation-setup/local-areas?slug='+encodeURIComponent(activeCustomer.slug));
  localAreasPrimaryTown=data.primaryTown||'';
  const ptInput=document.getElementById('localCoveragePrimaryTown');
  if(ptInput)ptInput.value=localAreasPrimaryTown;
  localAreasDraft=(data.areas||[]).map(a=>({...a}));
}
async function renderLocalCoveragePanel(c){
  const gs=c.generationSetup||{};
  const collapse=document.getElementById('detailLocalCoverageCollapse');
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
    '<div style="margin-top:8px"><span class="label">Canonical Preview Pages</span><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;font-size:.72rem">'+
    '<a href="'+esc(canonicalPreviewUrl('homepage'))+'" target="_blank" rel="noopener">Homepage</a>'+
    '<a href="'+esc(canonicalPreviewUrl('service'))+'" target="_blank" rel="noopener">Service</a>'+
    '<a href="'+esc(canonicalPreviewUrl('guide'))+'" target="_blank" rel="noopener">Guide</a>'+
    '<a href="'+esc(canonicalPreviewUrl('blog'))+'" target="_blank" rel="noopener">Blog</a>'+
    '</div></div>';
  const actions=document.getElementById('detailWebsiteActions');
  const canEdit=ws.canEditWebsite!==false;
  actions.innerHTML=
    '<button class="btn primary" type="button" onclick="previewCanonicalWebsite()">Preview Canonical Website</button>'+
    '<button class="btn secondary" type="button" onclick="editCanonicalWebsite()" '+(canEdit?'':'disabled title="'+esc(ws.editBlockedReason||'Locked')+'"')+'>Edit Website</button>'+
    '<button class="btn secondary" type="button" onclick="rerunWebsiteImport()" '+(canEdit?'':'disabled')+'>Re-run Website Import</button>'+
    '<button class="btn secondary" type="button" onclick="toggleWebsiteEvidence()" '+(ws.importedEvidence?'':'disabled')+'>View Imported Evidence</button>';
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
    await loadDashboard();
  }catch(e){toast(e.message,true)}
}
async function rerunWebsiteImport(){
  if(!activeCustomer)return;
  const ws=activeCustomer.websiteSource||{};
  if(ws.canEditWebsite===false){toast(ws.editBlockedReason||'Website locked',true);return}
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/rerun_website_import',{method:'POST',body:'{}'});
    toast('Website import queued');
    startJobPolling();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
  }catch(e){toast(e.message,true)}
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
    '</div>';
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
    '<button class="btn secondary" type="button" onclick="toggleGoogleEvidence()" '+((gs.importedEvidence||gs.googleIntelligence)?'':'disabled')+'>View Imported Google Data</button>'+
    '<button class="btn secondary" type="button" onclick="rerunGoogleImport()" '+(gs.confirmationStatus==='confirmed'&&canEdit?'':'disabled')+'>Re-run Google Import</button>';
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
  }catch(e){toast(e.message,true)}
}
async function confirmGoogleProfile(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/confirm_google_business_profile',{method:'POST',body:'{}'});
    toast('Google Business Profile confirmed — Continue Workflow will run Google Import');
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
  }catch(e){toast(e.message,true)}
}
function confirmGoogleProfileDisplay(){toast('Google Business Profile already confirmed')}
async function rejectGoogleProfile(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/reject_google_business_profile',{method:'POST',body:'{}'});
    toast('Google listing rejected');
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
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
  }catch(e){toast(e.message,true)}
}
async function rerunGoogleImport(){
  if(!activeCustomer)return;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/actions/rerun_google_import',{method:'POST',body:'{}'});
    toast('Google import queued');
    startJobPolling();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
  }catch(e){toast(e.message,true)}
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
function toast(msg,isError){const el=document.getElementById('toast');el.textContent=msg;el.style.borderColor=isError?'#ef4444':'#475569';el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4000)}
async function api(path,opts){
  const timeoutMs=(opts&&opts.timeoutMs)||30000;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const fetchOpts={headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',...opts,signal:controller.signal};
  delete fetchOpts.timeoutMs;
  try{
    const res=await fetch(path,fetchOpts);
    const ct=res.headers.get('content-type')||'';
    const data=ct.includes('application/json')?await res.json().catch(()=>({})):null;
    if(!res.ok){
      if(res.redirected&&String(res.url||'').includes('/api/login'))throw new Error('Authentication required — sign in again.');
      throw new Error((data&&data.error)||res.statusText||('HTTP '+res.status));
    }
    if(!data)throw new Error('Expected JSON response but received '+ct);
    return data;
  }catch(e){
    if(e&&e.name==='AbortError')throw new Error('Request timed out after '+timeoutMs+'ms');
    throw e;
  }finally{clearTimeout(timer)}
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

function renderCustomerTable(){
  const rows=customers.map(c=>'<tr class="customer-row'+(c.loadError?' load-error':'')+'" data-slug="'+esc(c.slug)+'" onclick="openCustomer(\\''+esc(c.slug)+'\\')"><td><strong>'+esc(c.businessName)+'</strong><div class="sub"><code>'+esc(c.slug)+'</code>'+(c.loadError?'<div class="workflow-meta" style="color:#f87171">Load error: '+esc(c.loadError)+'</div>':'')+'</div></td><td>'+(c.website?'<a href="'+esc(c.website)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+esc(c.website.replace(/^https?:\\/\\//,'').slice(0,36))+'</a>':'—')+'</td><td><span class="pill">'+esc(c.currentStageLabel||c.lifecycleLabel)+'</span></td><td>'+esc(c.nextAction||'—')+'</td><td>'+(c.workflowCompletionPct??c.completionPct)+'%</td><td>'+(c.outstandingIssues||0)+'</td><td>'+fmt(c.lastActivity)+'</td><td>'+esc(c.accountManager)+'</td><td><span class="health-dot '+healthDot(c.health)+'" title="'+esc(c.healthLabel)+'"></span> '+esc(c.healthLabel)+'</td></tr>').join('');
  document.getElementById('customerTableWrap').innerHTML='<table id="customerTable"><thead><tr><th>Business Name</th><th>Website</th><th>Current Stage</th><th>Next Action</th><th>Workflow %</th><th>Issues</th><th>Latest Activity</th><th>Account Manager</th><th>Health</th></tr></thead><tbody id="customerTbody">'+(rows||'<tr><td colspan="9" class="empty">No active customers.</td></tr>')+'</tbody></table>';
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
      const active=jobs.some(j=>j.status==='queued'||j.status==='running');
      const mine=activeCustomer?jobs.find(j=>j.slug===activeCustomer.slug&&(j.status==='queued'||j.status==='running')):null;
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
        toast('Growth Intelligence job completed');
      }
      if(!active)clearInterval(jobPollTimer);
    }catch{}
  },3000);
}

function filterCustomers(){const q=document.getElementById('search').value.toLowerCase();const lf=document.getElementById('lifecycleFilter').value;document.querySelectorAll('.customer-row').forEach(row=>{const slug=row.dataset.slug;const c=customers.find(x=>x.slug===slug);if(!c){row.style.display='none';return}const match=!q||c.businessName.toLowerCase().includes(q)||c.slug.includes(q)||(c.website||'').toLowerCase().includes(q);const stage=!lf||c.currentStage===lf;row.style.display=match&&stage?'':'none'})}
let createIntakeAreasDraft=[];
let onboardingAreasDraft=[];
let onboardingAreaDiscoveryMeta={primaryTown:'',recommendedCount:0,selectedCount:0,localGenerationReadiness:'—',readinessWarning:''};
function selectedGooglePolicy(name){
  const el=document.querySelector('input[name="'+name+'"]:checked');
  return el?el.value:'';
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
  }catch(e){toast(e.message,true)}
}
function buildIntakeBodyFromCreate(){
  const googlePolicy=selectedGooglePolicy('createGooglePolicy');
  return {pharmacyName:document.getElementById('createName').value.trim(),website:document.getElementById('createWebsite').value.trim(),contactEmail:document.getElementById('createEmail').value.trim(),phone:document.getElementById('createPhone').value.trim(),postcode:document.getElementById('createPostcode').value.trim(),addressLine1:document.getElementById('createAddress1').value.trim(),addressLine2:document.getElementById('createAddress2').value.trim(),townOrCity:document.getElementById('createTown').value.trim(),county:document.getElementById('createCounty').value.trim(),country:document.getElementById('createCountry').value.trim(),primaryServiceId:document.getElementById('createPrimaryService').value, googleBusinessProfileUrl:document.getElementById('createGoogle').value.trim(),googlePlaceId:document.getElementById('createPlaceId').value.trim(),googleProfileState:googlePolicy||'unknown',accountManager:document.getElementById('createAccountManager').value.trim(),supportContactName:document.getElementById('createSupportName').value.trim(),supportContactEmail:document.getElementById('createSupportEmail').value.trim(),notes:document.getElementById('createNotes').value.trim(),areas:createIntakeAreasDraft};
}
function openCreateModal(){createIntakeAreasDraft=[];renderIntakeAreasTable('createIntakeAreasTbody',createIntakeAreasDraft,'removeCreateIntakeArea');document.getElementById('createModal').classList.add('open')}
function closeCreateModal(){document.getElementById('createModal').classList.remove('open')}
async function createCustomer(){
  try{
    const body=buildIntakeBodyFromCreate();
    if(!body.pharmacyName||!body.website||!body.contactEmail||!body.addressLine1||!body.townOrCity||!body.postcode||!body.country){toast('Complete all required business and location fields',true);return}
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
    document.getElementById('intakePrimaryService').value=i.primaryServiceId||'pharmacy-first';
    document.getElementById('intakeEmail').value=i.contactEmail||'';
    document.getElementById('intakePhone').value=i.phone||'';
    document.getElementById('intakeGoogle').value=i.googleBusinessProfileUrl||'';
    document.getElementById('intakePlaceId').value=i.googlePlaceId||'';
    const gs=i.googleProfileState||i.googleState||'unknown';
    document.querySelectorAll('input[name="intakeGooglePolicy"]').forEach(r=>{r.checked=r.value===gs});
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
    const body={pharmacyName:document.getElementById('intakeName').value.trim(),website:document.getElementById('intakeWebsite').value.trim(),contactEmail:document.getElementById('intakeEmail').value.trim(),phone:document.getElementById('intakePhone').value.trim(),postcode:document.getElementById('intakePostcode').value.trim(),addressLine1:document.getElementById('intakeAddress1').value.trim(),addressLine2:document.getElementById('intakeAddress2').value.trim(),townOrCity:document.getElementById('intakeTown').value.trim(),county:document.getElementById('intakeCounty').value.trim(),country:document.getElementById('intakeCountry').value.trim(),primaryServiceId:document.getElementById('intakePrimaryService').value,googleBusinessProfileUrl:document.getElementById('intakeGoogle').value.trim(),googlePlaceId:document.getElementById('intakePlaceId').value.trim(),googleProfileState:selectedGooglePolicy('intakeGooglePolicy')||'unknown'};
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-intake',{method:'POST',body:JSON.stringify(body)});
    toast('Onboarding setup saved — workflow recalculated');
    closeOnboardingIntakeModal();
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    try{
      const discovery=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/onboarding-area-discovery');
      renderOnboardingAreaSummary(discovery.discovery||{});
    }catch{}
  }catch(e){toast(e.message,true)}
}
function closeCustomerModal(){document.getElementById('customerModal').classList.remove('open');activeCustomer=null}
async function openCustomer(slug){
  document.getElementById('customerModal').classList.add('open');
  document.getElementById('detailLoading').style.display='block';
  document.getElementById('detailContent').style.display='none';
  document.getElementById('detailTitle').textContent=slug;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(slug));
    activeCustomer=data.customer;
    renderCustomerDetail(data.customer);
    document.getElementById('detailLoading').style.display='none';
    document.getElementById('detailContent').style.display='block';
  }catch(e){toast(e.message,true);closeCustomerModal()}
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
    startJobPolling();
  }catch(e){toast(e.message,true)}
}
function renderCustomerDetail(c){
  document.getElementById('detailTitle').textContent=c.businessName;
  const atBpr=customerAtBusinessProfileReview(c);
  document.getElementById('detailMeta').textContent=atBpr
    ? [c.slug,'Business Profile Review'].filter(Boolean).join(' · ')
    : [c.slug,stageDisplayLabel(c),c.nextAction?'Next: '+c.nextAction:'',(c.outstandingIssues||0)+' open issues',c.accountManager].filter(Boolean).join(' · ');
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
    '<div><span class="label">Next Action</span><div>'+esc(orch.stageActionLabel||c.nextAction||'Continue Workflow')+'</div></div>';
  const jobs=op.jobs||[];
  const atCge=customerAtGenerateEcosystem(c);
  const atIdx=customerAtIndexing(c);
  const atPerf=customerAtPerformanceDashboard(c);
  const atCirEarly=customerAtCommercialIntelligence(c);
  const hideDiagnostics=atCirEarly||atCqr||atCpr||atMp||atCge||atIdx||atPerf;
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
      bprBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Business Profile Review</div><div style="font-size:.72rem;color:#c4b5fd">'+esc(s.readinessLabel||'')+' · '+esc(String(s.needsAttention||0))+' item(s) need attention · ~'+esc(String(s.estimatedReviewMinutes||2))+' min</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Website '+importStatusLabel(s.websiteImportStatus)+' · Google '+importStatusLabel(s.googleImportStatus)+' · '+esc(String(s.automaticallyVerified||0))+' fields verified automatically</div></div><button class="bpr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openBusinessProfileReview()">'+(s.approvalStatus==='approved'?'View Approved Profile':'Open Business Profile Review')+'</button></div>';
    }else{bprBanner.style.display='none';bprBanner.innerHTML=''}
  }
  const bprBtn=document.getElementById('openBprBtn');
  if(bprBtn){
    const approved=Boolean(bpr&&bpr.summary&&bpr.summary.approvalStatus==='approved');
    bprBtn.style.display=atBpr&&!approved?'block':'none';
    bprBtn.textContent='Open Business Profile Review';
  }
  const atCqr=customerAtQualityReview(c);
  const atMp=customerAtManagedPublishing(c);
  const atCdc=false;
  const atCpr=customerAtPublishReview(c);
  const cqrBtn=document.getElementById('openCqrBtn');
  if(cqrBtn){
    cqrBtn.style.display=atCqr?'block':'none';
    cqrBtn.textContent='Open Quality Review';
  }
  const mpBtn=document.getElementById('openMpBtn');
  if(mpBtn){mpBtn.style.display=atMp?'block':'none'}
  const cdcBtn=document.getElementById('openCdcBtn');
  if(cdcBtn){cdcBtn.style.display='none'}
  const cprBtn=document.getElementById('openCprBtn');
  if(cprBtn){cprBtn.style.display=atCpr?'block':'none'}
  const cgeBtn=document.getElementById('openCgeBtn');
  if(cgeBtn){cgeBtn.style.display=atCge?'block':'none'}
  const idxBtn=document.getElementById('openIdxBtn');
  if(idxBtn){idxBtn.style.display=atIdx?'block':'none'}
  const perfBtn=document.getElementById('openPerfBtn');
  if(perfBtn){perfBtn.style.display=atPerf?'block':'none'}
  const cqrBanner=document.getElementById('detailCqrBanner');
  if(cqrBanner){
    if(atCqr){
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
    if(atCpr){
      cprBanner.style.display='block';
      cprBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Publish Website</div><div style="font-size:.72rem;color:#fcd34d">Is this generated website ready to go live now?</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Review destination, release summary and preview before publishing</div></div><button class="cpr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialPublishReview()">Open Publish Review</button></div>';
    }else{cprBanner.style.display='none';cprBanner.innerHTML=''}
  }
  const cgeBanner=document.getElementById('detailCgeBanner');
  if(cgeBanner){
    if(atCge){
      cgeBanner.style.display='block';
      cgeBanner.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><div style="font-weight:800;font-size:.88rem;margin-bottom:4px">Generation Readiness</div><div style="font-size:.72rem;color:#7dd3fc">Review readiness counts, historical package status, and confirm the first Product Owner-authorised ecosystem.</div><div style="font-size:.68rem;color:#94a3b8;margin-top:4px">Active action: Generate Approved Ecosystem — explicit confirmation required.</div></div><button class="cqr-btn-review" type="button" style="width:auto;min-width:220px" onclick="openCommercialEcosystemGeneration()">Open Generation Readiness</button></div>';
    }else{cgeBanner.style.display='none';cgeBanner.innerHTML=''}
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
  if(cirBtn){cirBtn.style.display=atCir?'block':'none';cirBtn.textContent=atCirReview?'Open Dashboard & Approve':'Open Commercial Intelligence Dashboard'}
  const btn=document.getElementById('continueWorkflowBtn');
  btn.style.display=(atCqr||atMp||atCpr||atCirReview||atCge||atIdx||atPerf)?'none':'block';
  btn.textContent=orch.continueLabel||'Continue Workflow';
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
async function continueWorkflow(){
  if(!activeCustomer)return;
  const btn=document.getElementById('continueWorkflowBtn');
  const blockReasonEl=document.getElementById('detailBlockReason');
  const jobEl=document.getElementById('detailJobStatus');
  const orch=activeCustomer.orchestration||activeCustomer.workflow?.orchestration||{};
  const actionId=orch.stageActionId||'';
  const priorLabel=btn.textContent;
  btn.disabled=true;
  if(actionId==='orchestrate_growth_intelligence'||actionId==='orchestrate_competitor_analysis'||actionId==='orchestrate_local_market_intelligence'){
    const label=actionId==='orchestrate_competitor_analysis'?'Generating Competitor Analysis…':actionId==='orchestrate_local_market_intelligence'?'Generating Local Market Intelligence…':'Generating Growth Intelligence…';
    btn.textContent=label;
    if(jobEl){jobEl.style.display='block';jobEl.innerHTML='<strong>'+esc(label)+'</strong>'}
  }
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/continue-workflow',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok&&data.confirmationRequired){
      toast('Confirm Google Business Profile before continuing');
      if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
      else if(data.googleConfirmation){renderGoogleConfirmationPanel(activeCustomer.googleSource||{},data.googleConfirmation)}
      return;
    }
    if(!res.ok)throw new Error(data.error||data.outcome?.error||res.statusText);
    if(data.async&&data.jobId){
      toast(actionId==='orchestrate_growth_intelligence'?'Generating Growth Intelligence…':'Workflow job queued — waiting for completion');
      startJobPolling();
      if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
      return;
    }
    const evidence=data.outcome?.evidence||data.customer?.operationalSummary?.latestEvidence||'Workflow continued';
    toast(actionId==='orchestrate_growth_intelligence'&&/generated|complete/i.test(evidence)?'Growth Intelligence generated':evidence);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
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
      btn.disabled=!freshOrch.canContinue;
      btn.textContent=freshOrch.continueLabel||priorLabel||'Continue Workflow';
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
  const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug));
  activeCustomer=data.customer;
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
    return {summary:{},needsConfirmation:[],missingInformation:[],recommendedValues:[],verifiedFields:[],actionRequired:[]};
  }
  const needsConfirmation=Array.isArray(review.needsConfirmation)?review.needsConfirmation:(Array.isArray(review.actionRequired)?review.actionRequired:[]);
  const missingInformation=Array.isArray(review.missingInformation)?review.missingInformation:[];
  const recommendedValues=Array.isArray(review.recommendedValues)?review.recommendedValues:[];
  const verifiedFields=Array.isArray(review.verifiedFields)?review.verifiedFields:(Array.isArray(review.reviewedAutomatically)?review.reviewedAutomatically:[]);
  return Object.assign({},review,{summary:review.summary||{},needsConfirmation,missingInformation,recommendedValues,verifiedFields,actionRequired:needsConfirmation});
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
  return ['competitor_analysis','local_market_intelligence','generate_growth_intelligence','commercial_intelligence'].includes(customerStage(c));
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
  return '<table class="ci-metric-table"><thead><tr><th>Metric</th><th>Your Pharmacy</th><th>Local Average</th><th>Highest Competitor</th><th>Gap</th><th>Recommended Target</th></tr></thead><tbody>'+
    rows.map(m=>'<tr><td>'+esc(m.label)+'</td><td>'+esc(m.yourPharmacy)+'</td><td>'+esc(m.localAverage)+'</td><td>'+esc(m.highestCompetitor)+'</td><td>'+esc(m.gap)+'</td><td>'+esc(m.recommendedTarget)+'</td></tr>').join('')+
    '</tbody></table>';
}
function ciCompSummaryHtml(summary){
  const lines=(summary||[]);
  if(!lines.length)return '';
  return '<div style="margin-bottom:10px">'+lines.map(l=>'<p class="ci-narrative"><strong>'+esc(l.label)+':</strong> '+esc(l.statement)+'</p>').join('')+'</div>';
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
  const exec=dashboard.executiveSummary||{};
  const execHtml='<div class="ci-section"><h4>Executive Summary</h4><div class="ci-exec-grid">'+
    Object.entries({overallBusinessHealth:'Overall Business Health',biggestOpportunity:'Biggest Opportunity',biggestCommercialRisk:'Biggest Commercial Risk',strongestCompetitor:'Strongest Competitor',biggestLocalVisibilityGap:'Biggest Local Visibility Gap',biggestContentGap:'Biggest Content Gap',googleBusinessProfileStatus:'Google Business Profile',estimatedTrafficOpportunity:'Traffic Opportunity',estimatedEnquiryOpportunity:'Enquiry Opportunity',confidence:'Confidence'}).map(([k,l])=>'<div class="ci-exec-card"><div class="lbl">'+esc(l)+'</div><div class="val">'+esc(String(exec[k]||'Unknown'))+'</div></div>').join('')+
    '</div>'+ciEvidenceFoot(dashboard.sectionEvidence?.executiveSummary)+'</div>';
  const metrics=(dashboard.googleProfileMetrics||[]);
  const metricsHtml='<div class="ci-section"><h4>Google Profile Metrics</h4><p class="ci-narrative">Evidence-backed Google Business Profile comparison — your pharmacy vs local average vs highest nearby competitor.</p>'+
    ciMetricTable(metrics)+ciEvidenceFoot(dashboard.sectionEvidence?.googleProfileMetrics)+'</div>';
  const gapHtml='<div class="ci-section"><h4>Gap Analysis</h4><p class="ci-narrative">Commercial gaps measured against local benchmarks with recommended targets and PharmaConnect improvement actions.</p>'+
    (metrics.length?'<ul>'+metrics.map(m=>'<li><strong>'+esc(m.label)+'</strong> — Current: '+esc(m.yourPharmacy)+' · Average: '+esc(m.localAverage)+' · Gap: '+esc(m.gap)+' · Target: '+esc(m.recommendedTarget)+'<br><span style="color:#94a3b8">'+esc(m.opportunity)+'</span></li>').join('')+'</ul>':'<p class="ci-narrative">Gap analysis pending local market evidence.</p>')+
    ciEvidenceFoot(dashboard.sectionEvidence?.googleProfileMetrics)+'</div>';
  const ca=dashboard.competitorAnalysis||{};
  const compRows=(ca.competitors||[]);
  const compSummary=ca.generated?ciCompSummaryHtml(ca.summary||dashboard.competitorSummary||[]):'';
  const compHtml='<div class="ci-section"><h4>Competitor Analysis</h4>'+
    (dashboard.locality?.provenanceLabel?'<p class="ci-narrative" style="font-size:.72rem;color:#94a3b8">Locality: '+esc(dashboard.locality.provenanceLabel)+'</p>':'')+
    (ca.generated?'<h5 style="font-size:.78rem;color:#cbd5e1;margin:8px 0 4px">Competitor Summary</h5>'+compSummary:'')+
    (ca.generated?(compRows.length?'<table class="audit-table"><thead><tr><th>Competitor</th><th>Rating</th><th>Reviews</th><th>Distance</th><th>Address</th><th>Categories</th><th>Phone</th><th>Website</th><th>Maps</th><th>Place ID</th><th>Evidence</th><th>Confidence</th></tr></thead><tbody>'+
    compRows.map(c=>'<tr><td>'+esc(c.name||'')+'</td><td>'+esc(c.rating||'Not Available')+'</td><td>'+esc(c.reviews||'Not Available')+'</td><td>'+esc(c.distance||'Not Available')+'</td><td>'+esc(c.address||'Not Available')+'</td><td>'+esc(c.categories||'Not Available')+'</td><td>'+esc(c.phone||'Not Available')+'</td><td>'+esc(c.website||'Not Available')+'</td><td>'+esc(c.maps||'Not Available')+'</td><td>'+esc(c.placeId||'Not Available')+'</td><td>'+esc(c.evidence||'Not Available')+'</td><td>'+esc(c.confidence||'Not Available')+'</td></tr>').join('')+'</tbody></table>':'<p class="ci-narrative">Competitor Analysis generated but no competitors returned.</p>'):
    '<p class="ci-narrative"><strong>Competitor Analysis not yet generated</strong></p><p class="ci-narrative">Action: Generate Competitor Analysis from the workflow to load real nearby pharmacy evidence.</p><button class="btn secondary" type="button" onclick="closeCommercialIntelligenceReview();continueWorkflow()">Generate Competitor Analysis</button>')+ciEvidenceFoot(ca.evidence||dashboard.sectionEvidence?.competitorAnalysis)+'</div>';
  const traffic=dashboard.trafficOpportunity||{};
  const trafficHtml='<div class="ci-section"><h4>Traffic Opportunity</h4><p class="ci-narrative">'+esc(traffic.summary||'Search demand not yet available.')+'</p>'+
    ((traffic.keywords||[]).length?'<ul>'+traffic.keywords.map(k=>'<li><strong>'+esc(k.keyword)+'</strong> — '+esc(k.searchDemand)+' · Provenance: '+esc(k.provenance)+'</li>').join('')+'</ul>':'')+
    ciEvidenceFoot(traffic.evidence||dashboard.sectionEvidence?.trafficOpportunity)+'</div>';
  const lm=(dashboard.localMarketIntelligence?.sections||[]).map(s=>ciSection(s.title,s.narrative,s.items,s.evidence)).join('');
  const gi=(dashboard.growthIntelligence?.sections||[]).map(s=>ciSection(s.title,s.narrative,s.items,s.evidence)).join('');
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
  if(!activeCustomer)return;
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
function customerAtPublishReview(c){
  const stage=c.currentStage||c.workflow?.currentStage||'';
  return stage==='publish';
}
function customerAtGenerateEcosystem(c){
  const stage=c.currentStage||c.workflow?.currentStage||'';
  return stage==='generate_ecosystem';
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
function renderCommercialPublishReview(review){
  activeCprReview=review;
  const s=review.summary||{};
  const ps=review.publishStageSummary||{};
  const rm=review.releaseManagement||{};
  const d=review.destination||{};
  document.getElementById('cprHero').innerHTML=
    '<h4>'+esc(ps.stageLabel||'Publish')+'</h4>'+
    '<div class="cqr-summary-grid">'+
    '<div class="cqr-stat"><div class="lbl">Generated Package</div><div class="val">'+esc(ps.generatedPackage||review.serviceId||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Current Release</div><div class="val">'+esc(ps.currentRelease||rm.currentRelease||'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Managed Hostname</div><div class="val" style="font-size:.72rem">'+esc(ps.managedHostname||d.host||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Managed URL</div><div class="val" style="font-size:.72rem">'+esc(ps.managedUrl||d.publicWebsite||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publishing Status</div><div class="val">'+esc(ps.publishingStatus||'not published')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Previous Release</div><div class="val">'+esc(ps.previousRelease||rm.previousRelease||'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publishing Readiness</div><div class="val '+(ps.publishingReadiness==='READY TO PUBLISH'?'pass':'fail')+'">'+esc(ps.publishingReadiness||s.publishingReadiness||'BLOCKED')+'</div></div>'+
    '</div>'+
    '<div class="cqr-overall '+((ps.overallStatus||s.publishingReadiness)==='READY TO PUBLISH'?'ready':'blocked')+'">Overall Status: '+esc(ps.overallStatus||s.publishingReadiness||'BLOCKED')+'</div>';
  document.getElementById('cprReleaseManagement').innerHTML=
    '<div class="cqr-stat"><div class="lbl">Published Version</div><div class="val">'+esc(rm.publishedVersion?('v'+rm.publishedVersion):'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Published At</div><div class="val" style="font-size:.72rem">'+esc(rm.publishedAt?fmt(rm.publishedAt):'Never')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Published By</div><div class="val">'+esc(rm.publishedBy||'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Publish Duration</div><div class="val">'+esc(rm.publishDurationMs?((rm.publishDurationMs/1000).toFixed(1)+'s'):'—')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Rollback Target</div><div class="val">'+esc(rm.rollbackTarget||'None')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Rollback Available</div><div class="val '+(rm.rollbackAvailable?'pass':'fail')+'">'+(rm.rollbackAvailable?'Yes':'No')+'</div></div>';
  document.getElementById('cprTopActions').innerHTML=
    '<button class="btn primary" type="button" onclick="previewFinalWebsite()">Preview Final Website</button>'+
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
    '<div class="cqr-stat"><div class="lbl">Files Ready</div><div class="val">'+esc(String(s.filesReady||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Last Successful Publish</div><div class="val" style="font-size:.72rem">'+esc(d.lastSuccessfulPublish||'Never')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Proposed Version</div><div class="val" style="font-size:.72rem">'+esc(d.proposedVersion||'—')+'</div></div>';
  const cs=review.changeSummary||{};
  document.getElementById('cprChangeSummary').innerHTML=
    '<div class="cqr-stat"><div class="lbl">Release Type</div><div class="val">'+(cs.mode==='initial_publish'?'Initial Publish':'Incremental Publish')+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Total Files</div><div class="val">'+esc(String(cs.totalFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">New Files</div><div class="val">'+esc(String(cs.newFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Changed Files</div><div class="val">'+esc(String(cs.changedFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Unchanged Files</div><div class="val">'+esc(String(cs.unchangedFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Deleted Files</div><div class="val">'+esc(String(cs.deletedFiles||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Pages</div><div class="val">'+esc(String(cs.pages||0))+'</div></div>'+
    '<div class="cqr-stat"><div class="lbl">Sitemap</div><div class="val">'+(cs.sitemap?'Yes':'No')+'</div></div>';
  document.getElementById('cprChecks').innerHTML=(review.checks||[]).map(ch=>'<div class="cqr-check"><span>'+esc(ch.label)+'<div style="color:#64748b;font-size:.66rem;margin-top:2px">'+esc(ch.detail)+'</div></span><span class="status '+esc(ch.status)+'">'+esc(ch.status)+'</span></div>').join('');
  const warnSec=document.getElementById('cprWarningsSection');const blockSec=document.getElementById('cprBlockersSection');
  if((review.warnings||[]).length){warnSec.style.display='block';document.getElementById('cprWarnings').innerHTML=(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{warnSec.style.display='none';document.getElementById('cprWarnings').innerHTML=''}
  if((review.blockers||[]).length){blockSec.style.display='block';document.getElementById('cprBlockers').innerHTML=(review.blockers||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{blockSec.style.display='none';document.getElementById('cprBlockers').innerHTML=''}
  document.getElementById('cprPanelStats').innerHTML=
    '<div class="bpr-panel-stat"><div class="lbl">Overall Status</div><div style="font-weight:800;color:'+((ps.overallStatus||s.publishingReadiness)==='READY TO PUBLISH'?'#4ade80':'#f87171')+'">'+esc(ps.overallStatus||s.publishingReadiness||'BLOCKED')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Generated Package</div><div>'+esc(ps.generatedPackage||review.serviceId||'—')+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Managed URL</div><div style="font-size:.68rem">'+esc(ps.managedUrl||d.publicWebsite||'—')+'</div></div>';
  document.getElementById('cprPanelWarnings').innerHTML=(review.warnings||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Warnings</li>'+(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')):'';
  document.getElementById('cprPanelBlockers').innerHTML=(review.blockers||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Blockers</li>'+(review.blockers||[]).map(w=>'<li style="color:#fca5a5">'+esc(w)+'</li>').join('')):'';
  const confirmBox=document.getElementById('cprConfirmCheckbox');if(confirmBox)confirmBox.checked=false;
  document.getElementById('cprApproveBtn').style.display=review.activePublishJob&&review.activePublishJob.status==='failed'?'none':'block';
  document.getElementById('cprRetryBtn').style.display=review.activePublishJob&&review.activePublishJob.status==='failed'?'block':'none';
  updateCprApproveState();
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
function viewPublishPageList(){
  if(!activeCprReview||!activeCprReview.pageList||!activeCprReview.pageList.length){toast('No page list available',true);return}
  alert('Pages to publish:\\n\\n'+activeCprReview.pageList.map(p=>p.title+' — '+p.url).join('\\n'));
}
function viewPublishManifest(){
  if(!activeCprReview||!activeCprReview.manifestPath){toast('Manifest not available',true);return}
  toast('Manifest: '+activeCprReview.manifestPath);
}
function viewQaApproval(){
  if(!activeCustomer)return;
  window.open('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-quality-review','_blank');
}
async function openCommercialPublishReview(){
  if(!activeCustomer)return;
  if(!customerAtPublishReview(activeCustomer)){toast('Publish Review is not the current stage.',true);return}
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
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-publish-review/approve',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({operatorConfirmed:true})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||res.statusText);
    toast('Publish job queued');
    if(data.review)renderCommercialPublishReview(data.review);
    if(data.jobId)startCprPolling(data.jobId);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
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
  const previewSec=document.getElementById('cqrPreviewSection');
  const previewEl=document.getElementById('cqrPreviewLinks');
  if(previewSec&&previewEl){
    const links=review.previewLinks||[];
    if(links.length&&review.productOwnerAuthorised){previewSec.style.display='block';previewEl.innerHTML=links.map(l=>'<button class="btn secondary" type="button" style="margin:4px 6px 4px 0" onclick="window.open('+JSON.stringify(l.url)+',\'_blank\',\'noopener\')">'+esc(l.label)+'</button>').join('')}else{previewSec.style.display='none';previewEl.innerHTML=''}
  }
  document.getElementById('cqrChecks').innerHTML=(review.checks||[]).map(ch=>'<div class="cqr-check"><span>'+esc(ch.label)+'<div style="color:#64748b;font-size:.66rem;margin-top:2px">'+esc(ch.detail)+'</div></span><span class="status '+esc(ch.status)+'">'+esc(ch.status)+'</span></div>').join('');
  const warnSec=document.getElementById('cqrWarningsSection');
  const blockSec=document.getElementById('cqrBlockersSection');
  if((review.warnings||[]).length){warnSec.style.display='block';document.getElementById('cqrWarnings').innerHTML=(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{warnSec.style.display='none';document.getElementById('cqrWarnings').innerHTML=''}
  if((review.blockers||[]).length){blockSec.style.display='block';document.getElementById('cqrBlockers').innerHTML=(review.blockers||[]).map(w=>'<li>'+esc(w)+'</li>').join('')}else{blockSec.style.display='none';document.getElementById('cqrBlockers').innerHTML=''}
  document.getElementById('cqrPanelStats').innerHTML=
    '<div class="bpr-panel-stat"><div class="lbl">Publishing Readiness</div><div style="font-weight:800;color:'+(s.publishingReadiness==='Ready'?'#4ade80':'#f87171')+'">'+esc(s.publishingReadiness||'Blocked')+'</div></div>';
  document.getElementById('cqrPanelWarnings').innerHTML=(review.warnings||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Warnings</li>'+(review.warnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')):'';
  document.getElementById('cqrPanelBlockers').innerHTML=(review.blockers||[]).length?('<li style="list-style:none;color:#64748b;font-size:.66rem;text-transform:uppercase;margin-bottom:4px">Blockers</li>'+(review.blockers||[]).map(w=>'<li style="color:#fca5a5">'+esc(w)+'</li>').join('')):'';
  const approveBtn=document.getElementById('cqrApproveBtn');
  const publishBtn=document.getElementById('cqrPublishBtn');
  approveBtn.disabled=!review.canApprove;
  publishBtn.disabled=review.approvalStatus!=='approved';
  document.getElementById('cqrApprovalError').style.display='none';
}
function previewGeneratedWebsite(){
  if(!activeCqrReview||!activeCqrReview.previewUrl)return;
  window.open(activeCqrReview.previewUrl,'_blank','noopener');
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
    await loadDashboard();
  }catch(e){
    document.getElementById('cqrApprovalError').style.display='block';
    document.getElementById('cqrApprovalErrorMsg').textContent=e.message||String(e);
    if(activeCqrReview)btn.disabled=!activeCqrReview.canApprove;
  }
}
function importStatusLabel(status){return status==='Complete'?'✓ Complete':status==='Failed'?'✗ Failed':'— '+String(status||'Missing')}
function bprJsStr(v){return String(v??'').replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'").replace(/[\\r\\n]/g,' ')}
function bprFieldCardBody(f,showEvidence){
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
      (gs.confirmationStatus==='confirmed'?'<button class="btn secondary" type="button" onclick="rerunGoogleImport()" '+(canEdit?'':'disabled')+'>Re-run Google Import</button>':'');
  }
  actions.innerHTML=actionHtml;
}
function renderBusinessProfileReview(review){
  review=normalizeBusinessProfileReviewPayload(review);
  activeBprReview=review;
  bprDecisions={};
  const s=review.summary||{};
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
    '<div class="stat"><div class="lbl">Needs Your Attention</div><div class="val '+(confirmFields.length+missingFields.length?'warn':'ok')+'">'+esc(String(s.needsConfirmationCount||confirmFields.length))+' confirmations</div></div>'+
    '<div class="stat"><div class="lbl">Estimated Review Time</div><div class="val">'+esc(String(s.estimatedReviewMinutes||2))+' minute'+(s.estimatedReviewMinutes===1?'':'s')+'</div></div>'+
    '</div>'+
    '<div class="bpr-hero-status '+(s.readinessLabel==='READY TO APPROVE'?'bpr-ready':'bpr-not-ready')+'">Overall Status: '+esc(s.readinessLabel||'')+'</div>';
  document.getElementById('bprActionRequired').innerHTML=confirmFields.length?confirmFields.map(bprActionItem).join(''):'<div class="empty" style="padding:16px;text-align:center;color:#4ade80">No confirmations required.</div>';
  document.getElementById('bprMissingSection').style.display=missingFields.length?'block':'none';
  document.getElementById('bprMissingInformation').innerHTML=missingFields.length?missingFields.map(bprActionItem).join(''):'';
  document.getElementById('bprPanelStats').innerHTML=
    '<div class="bpr-panel-stat"><div class="lbl">Remaining confirmations</div><div style="font-weight:700;margin-top:4px">'+confirmFields.length+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Missing information</div><div style="font-weight:700;margin-top:4px">'+missingFields.length+'</div></div>'+
    '<div class="bpr-panel-stat"><div class="lbl">Approval readiness</div><div style="font-weight:700;margin-top:4px;color:'+(s.readinessLabel==='READY TO APPROVE'?'#4ade80':'#fbbf24')+'">'+esc(s.readinessLabel==='READY TO APPROVE'?'Ready':'Not ready')+'</div></div>';
  const checklist=s.approvalChecklist&&s.approvalChecklist.length?s.approvalChecklist:[...confirmFields,...missingFields].map(f=>f.commercialActionLabel||f.label);
  document.getElementById('bprPanelChecklist').innerHTML=checklist.length?checklist.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li style="list-style:none;color:#4ade80">Nothing remaining</li>';
  const approveBtn=document.getElementById('bprApproveBtn');
  approveBtn.disabled=s.readinessLabel!=='READY TO APPROVE'||s.approvalStatus==='approved';
  if(approveBtn.disabled&&checklist.length){
    document.getElementById('bprApproveReason').innerHTML='Approve unavailable.<br>Please confirm:<br>• '+checklist.map(esc).join('<br>• ');
  }else{
    document.getElementById('bprApproveReason').textContent=s.readinessLabel==='READY TO APPROVE'?'Ready to approve and continue to Generate Growth Intelligence.':'';
  }
  const acceptBtn=document.getElementById('bprAcceptSafeBtn');
  acceptBtn.style.display=s.approvalStatus==='approved'?'none':'block';
  acceptBtn.textContent=recommendedCount?'Accept All Safe Recommendations ('+recommendedCount+' recommended)':'Accept All Safe Recommendations';
  renderBprGoogleSection(review);
  setBprViewState('content');
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
    toast('Safe recommendations accepted');
  }catch(e){setBprSaveStatus('failed','Failed');toast(e.message,true)}
}
async function openBusinessProfileReview(){
  if(!activeCustomer){toast('Open a customer first',true);return}
  if(!customerAtBusinessProfileReview(activeCustomer)){
    toast('Business Profile Review is complete — continue with Generate Growth Intelligence.',false);
    return;
  }
  document.getElementById('bprModal').classList.add('open');
  setBprViewState('loading');
  document.getElementById('bprLoading').textContent='Loading review…';
  document.getElementById('bprMsg').textContent='';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review',{headers:{'Accept':'application/json'},credentials:'same-origin',signal:controller.signal});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||res.statusText||('HTTP '+res.status));
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
  }finally{clearTimeout(timeout)}
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
    const res=await fetch('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/business-profile-review/approve',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},credentials:'same-origin',body:'{}'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok){
      const msg=data.message||data.error||(data.details&&data.details.reason)||(data.result&&data.result.errors&&data.result.errors[0])||res.statusText||'Business Profile approval failed.';
      showBprApprovalError(msg);
      setBprSaveStatus('failed',msg);
      toast(msg,true);
      if(activeBprReview&&activeBprReview.summary){
        const s=activeBprReview.summary;
        approveBtn.disabled=s.readinessLabel!=='READY TO APPROVE'||s.approvalStatus==='approved';
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
    if(activeBprReview&&activeBprReview.summary){
      const s=activeBprReview.summary;
      approveBtn.disabled=s.readinessLabel!=='READY TO APPROVE'||s.approvalStatus==='approved';
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
  const statusLabel=dashboard.generationInProgress?'Generating Approved Ecosystem…':dashboard.authorisedEcosystemGenerated?'Authorised Ecosystem Generated':auth.completenessStatus==='INCOMPLETE_AGAINST_CANONICAL_PLAN'?'Authorised Generation — Incomplete Against Canonical Plan':dashboard.canGenerate?'Ready to Generate Approved Ecosystem':'Not Ready';
  document.getElementById('cgeHero').innerHTML='<h4>Generation Readiness</h4><p class="ci-narrative">'+esc(dashboard.summary||'')+'</p><div class="cqr-overall '+(dashboard.canGenerate||dashboard.generationInProgress?'ready':'blocked')+'">'+esc(statusLabel)+'</div>';
  const incompleteSection=document.getElementById('cgeIncompleteSection');
  const incompleteEl=document.getElementById('cgeIncomplete');
  if(incompleteSection&&incompleteEl){
    if(auth.completenessStatus==='INCOMPLETE_AGAINST_CANONICAL_PLAN'){
      incompleteSection.style.display='block';
      incompleteEl.innerHTML='<div class="guidance-box" style="border-color:#f97316;background:#fff7ed;color:#9a3412"><strong>Authorised Generation — Incomplete Against Canonical Plan</strong><br>Job: '+esc(String(auth.jobId||'—'))+'<br>Generated pages: '+esc(String(auth.pageCount||'—'))+' · Expected by canonical plan: '+esc(String(auth.expectedPageCount||r.expectedTotalPageCount||'—'))+'<br><span style="font-size:.72rem">This package is preserved for audit. It is not Quality Review-ready. Confirm a new generation after reviewing the canonical plan.</span></div>';
    }else{incompleteSection.style.display='none';incompleteEl.innerHTML=''}
  }
  const canonicalEl=document.getElementById('cgeCanonicalPlan');
  if(canonicalEl){
    canonicalEl.innerHTML=[
      ['Canonical Plan ID',r.canonicalPlanId||'—'],
      ['Canonical Plan Revision',r.canonicalPlanRevision||'—'],
      ['Plan Checksum',(r.canonicalPlanChecksum||'—').slice(0,16)+'…'],
      ['Scheduler Page Count',r.schedulerPageCount??r.expectedTotalPageCount??'—'],
      ['Readiness Page Count',r.expectedTotalPageCount??'—'],
      ['Plan / Scheduler Parity',String(r.schedulerPageCount)===String(r.expectedTotalPageCount)?'PASS':'FAIL']
    ].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val">'+esc(String(row[1]))+'</div></div>').join('');
  }
  const core=r.coreEcosystemInventory||{};
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
      ['Core Total Pages',core.totalPages??r.expectedTotalPageCount]
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
  document.getElementById('cgePanelStats').innerHTML='<div class="bpr-panel-stat"><div class="lbl">Active Action</div><div style="font-weight:800">'+esc(dashboard.nextStep||'')+'</div></div>';
  const progressSection=document.getElementById('cgeProgressSection');
  const progressEl=document.getElementById('cgeProgress');
  if(progressSection&&progressEl){
    if(dashboard.generationInProgress){
      progressSection.style.display='block';
      const gp=dashboard.generationProgress||{};
      const elapsed=gp.elapsedMs!=null?Math.round(gp.elapsedMs/1000)+'s':'—';
      progressEl.innerHTML='<div style="font-weight:800;margin-bottom:8px">Generating Approved Ecosystem…</div>'+
        '<div class="cqr-totals">'+
        '<div class="cqr-stat"><div class="lbl">Progress</div><div class="val">'+esc(String(gp.percent??0))+'%</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Current Stage</div><div class="val">'+esc(gp.currentStage||dashboard.nextStep||'Running')+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Job ID</div><div class="val" style="font-size:.68rem">'+esc(String(dashboard.activeJobId||'queued'))+'</div></div>'+
        '<div class="cqr-stat"><div class="lbl">Elapsed</div><div class="val">'+esc(elapsed)+'</div></div>'+
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
  btn.disabled=!activeCgeDashboard.canGenerate||activeCgeDashboard.generationInProgress||activeCgeDashboard.authorisedEcosystemGenerated||!(box&&box.checked);
  btn.textContent=activeCgeDashboard.generationInProgress?'Generating Approved Ecosystem…':'Generate Approved Ecosystem';
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
  const p=new URLSearchParams(location.search);if(p.get('panel')==='generate-ecosystem'){p.delete('panel');history.replaceState(null,'',location.pathname+(p.toString()?('?'+p.toString()):''))}
}
async function confirmCommercialEcosystemGeneration(){
  if(!activeCustomer||!activeCgeDashboard)return;
  if(!window.confirm('This will create the first Product Owner-authorised ecosystem using the approved Commercial Intelligence, Business Profile and current platform engines.\\n\\nThe historical package will remain preserved for audit.'))return;
  const btn=document.getElementById('cgeGenerateBtn');
  btn.disabled=true;
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-ecosystem-generation/confirm',{method:'POST',body:JSON.stringify({operatorConfirmed:true})});
    toast('Authorised ecosystem generation started');
    if(data.dashboard)renderCommercialEcosystemGeneration(data.dashboard);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
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
function renderCommercialIndexingReview(dashboard){
  activeIdxDashboard=dashboard;
  document.getElementById('idxHero').innerHTML='<h4>Indexing</h4><p class="ci-narrative">'+esc(dashboard.narrative||'')+'</p><div class="cqr-overall '+(dashboard.indexingRequested?'ready':'blocked')+'">'+esc(dashboard.coverageLabel||'')+'</div>';
  document.getElementById('idxStats').innerHTML=[['Pages Submitted',dashboard.pagesSubmitted],['Pages Indexed',dashboard.pagesIndexed],['Pending',dashboard.pagesPending],['Excluded',dashboard.pagesExcluded],['Sitemap',dashboard.sitemapUrl],['Robots',dashboard.robotsLabel],['Search Console',dashboard.searchConsoleStatus]].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val" style="font-size:.72rem">'+esc(String(row[1]))+'</div></div>').join('');
  document.getElementById('idxCoverage').textContent=dashboard.coverageLabel||'';
  document.getElementById('idxUrls').innerHTML=(dashboard.expectedUrls||[]).length?(dashboard.expectedUrls||[]).map(u=>'<li>'+esc(u)+'</li>').join(''):'<li>No URLs registered yet</li>';
  document.getElementById('idxHistory').innerHTML=(dashboard.history||[]).map(h=>'<div class="workflow-meta">'+fmt(h.timestamp)+' · '+esc(h.label)+' · '+esc(h.detail)+'</div>').join('')||'<div class="workflow-meta">No indexing history yet.</div>';
  document.getElementById('idxPanelStats').innerHTML='<div class="bpr-panel-stat"><div class="lbl">Next Step</div><div style="font-weight:800">'+esc(dashboard.nextStep||'')+'</div></div>';
  updateIdxRequestState();
  document.getElementById('idxMsg').textContent=dashboard.indexingRequested?'Indexing already requested.':(!dashboard.published?'Publish first.':'');
}
function updateIdxRequestState(){
  const box=document.getElementById('idxConfirmCheckbox');
  const btn=document.getElementById('idxRequestBtn');
  if(!btn||!activeIdxDashboard)return;
  btn.disabled=!activeIdxDashboard.canRequestIndexing||activeIdxDashboard.indexingRequested||!(box&&box.checked);
  btn.textContent=activeIdxDashboard.indexingRequested?'Indexing Requested':'Request Indexing';
}
async function openCommercialIndexingReview(){
  if(!activeCustomer)return;
  if(!customerAtIndexing(activeCustomer)){toast('Indexing is not the current stage for this customer.',true);return}
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
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-indexing-review/request',{method:'POST',body:JSON.stringify({operatorConfirmed:true})});
    toast('Indexing requested');
    if(data.dashboard)renderCommercialIndexingReview(data.dashboard);
    if(data.customer){activeCustomer=data.customer;renderCustomerDetail(data.customer)}
    await loadDashboard();
  }catch(e){toast(e.message,true);updateIdxRequestState()}
}
function renderCommercialPerformanceDashboard(dashboard){
  activePerfDashboard=dashboard;
  document.getElementById('perfHero').innerHTML='<h4>Performance Dashboard</h4><p class="ci-narrative">'+esc(dashboard.narrative||'')+'</p><div class="cqr-overall '+(dashboard.completed?'ready':'blocked')+'">'+(dashboard.completed?'Commercial Workflow Complete':esc(dashboard.nextStep||''))+'</div>';
  document.getElementById('perfStats').innerHTML=[['Indexed Pages',dashboard.indexedPages],['Ranked Pages',dashboard.rankedPages],['Average Position',dashboard.averagePosition],['Impressions',dashboard.impressions],['Clicks',dashboard.clicks],['CTR',dashboard.ctr],['Last Update',dashboard.lastUpdate?fmt(dashboard.lastUpdate):'Not available']].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val">'+esc(String(row[1]))+'</div></div>').join('');
  document.getElementById('perfTopPages').innerHTML=(dashboard.topPerformingPages||[]).length?('<table class="audit-table"><thead><tr><th>Page</th><th>Position</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>'+(dashboard.topPerformingPages||[]).map(p=>'<tr><td>'+esc(p.title)+'<div style="font-size:.66rem;color:#64748b">'+esc(p.url)+'</div></td><td>'+esc(p.position)+'</td><td>'+esc(p.impressions)+'</td><td>'+esc(p.clicks)+'</td><td>'+esc(p.ctr)+'</td></tr>').join('')+'</tbody></table>'):'<p class="ci-narrative">Performance page data not yet available.</p>';
  document.getElementById('perfOpportunities').innerHTML=(dashboard.topOpportunities||[]).map(o=>'<li>'+esc(o)+'</li>').join('');
  document.getElementById('perfHealth').innerHTML=[['SEO Health',dashboard.seoHealthLabel],['Commercial Health',dashboard.commercialHealthLabel],['Growth Trend',dashboard.growthTrendLabel],['Google Business Profile',dashboard.googleBusinessProfileStatus]].map(row=>'<div class="cqr-stat"><div class="lbl">'+esc(row[0])+'</div><div class="val" style="font-size:.72rem">'+esc(String(row[1]))+'</div></div>').join('');
  document.getElementById('perfPanelStats').innerHTML='<div class="bpr-panel-stat"><div class="lbl">Next Step</div><div style="font-weight:800">'+esc(dashboard.nextStep||'')+'</div></div>';
  const btn=document.getElementById('perfCompleteBtn');
  if(btn){btn.disabled=!dashboard.canComplete;btn.textContent=dashboard.completed?'Workflow Complete':'Complete Commercial Workflow'}
  document.getElementById('perfMsg').textContent=dashboard.completed?'You can continue monitoring from the customer dashboard.':'';
}
async function openCommercialPerformanceDashboard(){
  if(!activeCustomer)return;
  if(!customerAtPerformanceDashboard(activeCustomer)){toast('Performance Dashboard is not the current stage for this customer.',true);return}
  document.getElementById('perfModal').classList.add('open');
  document.getElementById('perfLoading').style.display='block';
  document.getElementById('perfContent').style.display='none';
  document.getElementById('perfError').style.display='none';
  const p=new URLSearchParams(location.search);p.set('customer',activeCustomer.slug);p.set('panel','performance-dashboard');history.replaceState(null,'',location.pathname+'?'+p.toString());
  try{
    const data=await api('/api/master-admin-platform/customers/'+encodeURIComponent(activeCustomer.slug)+'/commercial-performance-dashboard');
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
    await loadDashboard();
  }catch(e){toast(e.message,true)}
}
document.querySelectorAll('.modal-backdrop').forEach(el=>{el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open')})});
loadDashboard().then(()=>{const p=new URLSearchParams(location.search);const slug=p.get('customer');if(p.get('panel')==='platform-infrastructure')openPlatformInfrastructure();else if(slug)openCustomer(slug).then(()=>{if(p.get('panel')==='business-profile-review'&&customerAtBusinessProfileReview(activeCustomer))openBusinessProfileReview();else if(p.get('panel')==='business-profile-review')clearBprPanelUrlParam();else if(p.get('panel')==='commercial-intelligence'&&customerAtCommercialIntelligence(activeCustomer))openCommercialIntelligenceReview();else if(p.get('panel')==='quality-review'&&customerAtQualityReview(activeCustomer))openCommercialQualityReview();else if(p.get('panel')==='generate-ecosystem'&&activeCustomer&&(customerAtGenerateEcosystem(activeCustomer)||(activeCustomer.commercialIntelligence&&activeCustomer.commercialIntelligence.canGenerateEcosystem)))openCommercialEcosystemGeneration();else if(p.get('panel')==='indexing-review'&&customerAtIndexing(activeCustomer))openCommercialIndexingReview();else if(p.get('panel')==='performance-dashboard'&&customerAtPerformanceDashboard(activeCustomer))openCommercialPerformanceDashboard();else if(p.get('panel')==='managed-publishing'&&activeCustomer&&customerAtManagedPublishing(activeCustomer))openManagedPublishing();else if(p.get('panel')==='legacy-deployment-configuration'&&activeCustomer)openCommercialDeploymentConfiguration();else if(p.get('panel')==='publish-review'&&customerAtPublishReview(activeCustomer))openCommercialPublishReview();else if(p.get('panel')==='local-coverage'||p.get('panel')==='generation-setup'){const el=document.getElementById('detailLocalCoverageCollapse');if(el)el.open=true}})});
</script>
</body>
</html>`;
}

router.get("/admin/master", requireAdmin, (_req, res) => {
  res.type("html").send(renderMasterAdminPlatformShell());
});

export default router;
