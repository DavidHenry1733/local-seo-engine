export function campaignExplorerCss(): string {
  return `
.ce-explorer{margin-top:32px;padding-top:28px;border-top:1px solid #e8edf3}
.ce-explorer h3{margin:0 0 8px;font-size:20px;font-weight:900;color:#0f172a}
.ce-explorer .ce-sub{margin:0 0 8px;font-size:15px;color:#64748b;line-height:1.65}
.ce-explorer .ce-detail{margin:0 0 18px;font-size:14px;color:#94a3b8;line-height:1.6}
.ce-messaging{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin:0 0 24px;font-size:14px;color:#334155;line-height:1.65}
.ce-messaging strong{display:block;color:#0f172a;margin-bottom:4px}
.ce-return{display:inline-flex;margin-bottom:18px;font-size:13px;font-weight:800;color:#005eb8;text-decoration:none}
.ce-return:hover{text-decoration:underline}
.ce-category{border:1px solid #e2e8f0;border-radius:18px;margin-bottom:12px;background:#fff;overflow:hidden}
.ce-category summary{cursor:pointer;padding:16px 18px;font-size:15px;font-weight:800;color:#0f172a;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px}
.ce-category summary::-webkit-details-marker{display:none}
.ce-category summary:after{content:"+";font-size:18px;color:#64748b;font-weight:700}
.ce-category[open] summary:after{content:"−"}
.ce-category-hint{font-size:12px;font-weight:700;color:#64748b}
.ce-category-body{padding:0 14px 14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.ce-category-lead{margin:0;padding:0 18px 12px;font-size:13px;color:#64748b;line-height:1.55}
.ce-detected-note{margin:0 0 4px;font-size:12px;font-weight:800;color:#166534}
.ce-card{border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fafbfc;display:flex;flex-direction:column;gap:10px}
.ce-card h4{margin:0;font-size:16px;font-weight:800;color:#0f172a}
.ce-card p{margin:0;font-size:13px;color:#64748b;line-height:1.55;flex:1}
.ce-badge{display:inline-flex;font-size:11px;font-weight:800;padding:6px 10px;border-radius:999px;width:fit-content}
.ce-badge.existing{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}
.ce-badge.growth{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
.ce-badge.nhs{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.ce-badge.private{background:#f5f3ff;color:#5b21b6;border:1px solid #ddd6fe}
.ce-select{display:inline-flex;align-items:center;justify-content:center;background:#fff;color:#005eb8;border:1px solid #005eb8;border-radius:12px;padding:10px 16px;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none;width:fit-content}
.ce-select:hover{background:#eff6ff}
@media(max-width:720px){.ce-category-body{grid-template-columns:1fr}}
`;
}
