export function campaignRecommendationIntelligenceCss(): string {
  return `
.cri-panel{background:#fff;border:1px solid #e8edf3;border-radius:24px;padding:28px;margin-bottom:24px;box-shadow:0 12px 40px rgba(15,23,42,.05)}
.cri-section{margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #eef2f7}
.cri-section:last-child{margin-bottom:0;padding-bottom:0;border-bottom:0}
.cri-section h3{margin:0 0 10px;font-size:18px;font-weight:900;color:#0f172a;letter-spacing:-.02em}
.cri-lead{margin:0;font-size:15px;color:#64748b;line-height:1.65}
.cri-evidence-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:16px}
.cri-evidence-card{display:flex;gap:12px;align-items:flex-start;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px}
.cri-evidence-check{color:#059669;font-weight:900;font-size:16px;line-height:1.2;margin-top:2px}
.cri-evidence-card strong{display:block;font-size:14px;color:#0f172a;margin-bottom:4px}
.cri-evidence-card p{margin:0;font-size:13px;color:#64748b;line-height:1.55}
.cri-position-card{border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;margin-top:12px}
.cri-position-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 18px;border-bottom:1px solid #eef2f7;font-size:14px;color:#334155}
.cri-position-row:last-child{border-bottom:0}
.cri-level{font-size:13px;font-weight:800;padding:6px 12px;border-radius:999px;white-space:nowrap}
.cri-level.excellent{background:#ecfdf5;color:#166534}
.cri-level.good{background:#eff6ff;color:#1d4ed8}
.cri-level.needs{background:#fff7ed;color:#9a3412}
.cri-outcomes{margin:12px 0 0;padding-left:20px;color:#334155;line-height:1.8;font-size:15px}
.cri-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:14px}
.cri-summary-grid div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px}
.cri-summary-grid span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:6px}
.cri-summary-grid strong{display:block;font-size:14px;color:#0f172a;line-height:1.5}
.cri-tagline{margin:16px 0 0;font-size:15px;color:#334155;font-weight:700;line-height:1.6}
.cri-confidence{text-align:center}
.cri-confidence-stars{color:#f59e0b;font-size:22px;letter-spacing:3px;margin:8px 0}
.cri-confidence-level{margin:0;font-size:16px;font-weight:900;color:#0f172a}
.cri-confidence-based{margin:14px 0 6px;font-size:13px;color:#64748b;font-weight:700}
.cri-confidence-sources{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.cri-confidence-sources li{font-size:13px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:8px 14px;font-weight:700}
.cri-next .cri-lead{max-width:640px}
@media(max-width:720px){.cri-evidence-grid{grid-template-columns:1fr}}
`;
}
