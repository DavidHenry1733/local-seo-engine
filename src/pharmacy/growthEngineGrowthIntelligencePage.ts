/**
 * Growth Engine — Growth Intelligence V1 page renderer (Step 3).
 */
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { buildGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";
import type { GrowthOpportunity, GrowthOpportunityReport } from "./growthEngineOpportunityModel.ts";
import { opportunityCategoryLabel } from "./growthEngineOpportunityModel.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import {
  commercialBlueChromeGradientCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function growthIntelligencePageCss(): string {
  return `${growthEngineWorkflowCss()}
.gi-overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
.gi-stat{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;text-align:center}
.gi-stat strong{display:block;font-size:28px;font-weight:900;color:#0f172a;line-height:1.1}
.gi-stat span{font-size:11px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:.04em}
.gi-stat.high strong{color:#b45309}
.gi-stat.medium strong{color:#1d4ed8}
.gi-stat.low strong{color:#64748b}
.gi-opp{border:1px solid #e2e8f0;border-radius:14px;margin-bottom:12px;background:#fff;overflow:hidden}
.gi-opp-head{padding:16px 18px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid #f1f5f9}
.gi-opp-title{font-size:16px;font-weight:900;margin:0;color:#0f172a}
.gi-badges{display:flex;flex-wrap:wrap;gap:6px}
.gi-pill{font-size:10px;font-weight:800;padding:4px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em}
.gi-pill.priority-high{background:#fef3c7;color:#92400e}
.gi-pill.priority-medium{background:#dbeafe;color:#1e40af}
.gi-pill.priority-low{background:#f1f5f9;color:#475569}
.gi-pill.confidence-high{background:#dcfce7;color:#166534}
.gi-pill.confidence-medium{background:#e0e7ff;color:#3730a3}
.gi-pill.confidence-low{background:#fce7f3;color:#9d174d}
.gi-pill.source{background:#eff6ff;color:#1e40af;text-transform:none}
.gi-opp-body{padding:16px 18px;font-size:13px;color:#334155;line-height:1.6}
.gi-evidence-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:12px 0}
.gi-evidence-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px}
.gi-evidence-card label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-bottom:4px}
.gi-evidence-card strong{font-size:18px;font-weight:900;color:#0f172a}
.gi-section-note{font-size:13px;color:#64748b;margin:0 0 14px}
.gi-roadmap-col{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fafbfc}
.gi-roadmap-col h3{margin:0 0 10px;font-size:14px}
.gi-roadmap-item{font-size:13px;padding:8px 0;border-bottom:1px solid #e2e8f0}
.gi-roadmap-item:last-child{border-bottom:0}
.gi-future-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px}
.gi-future-card{border:1px dashed #cbd5e1;border-radius:10px;padding:12px;background:#fafbfc;font-size:12px;color:#64748b}
.gi-future-card strong{display:block;color:#334155;font-size:13px;margin-bottom:4px}
.gi-ready{margin-top:8px;padding:22px;background:${commercialBlueChromeGradientCss()};border-radius:16px;color:#fff}
.gi-ready h3{margin:0 0 8px;font-size:18px}
.gi-ready p{margin:0 0 6px;font-size:14px;color:#dbeafe}
.gi-ready .ge-btn-primary{background:#fff;color:#005eb8;margin-top:14px}
.gi-empty{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:18px;font-size:13px;color:#64748b}
.gi-warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:16px}`;
}

function priorityPill(priority: string): string {
  return `<span class="gi-pill priority-${esc(priority)}">${esc(priority)} priority</span>`;
}

function confidencePill(confidence: string): string {
  return `<span class="gi-pill confidence-${esc(confidence)}">${esc(confidence)} confidence</span>`;
}

function renderOverview(overview: GrowthOpportunityReport["overview"]): string {
  return `<div class="gi-overview">
<div class="gi-stat"><strong>${overview.total}</strong><span>Opportunities</span></div>
<div class="gi-stat high"><strong>${overview.high}</strong><span>High Priority</span></div>
<div class="gi-stat medium"><strong>${overview.medium}</strong><span>Medium Priority</span></div>
<div class="gi-stat low"><strong>${overview.low}</strong><span>Low Priority</span></div>
</div>`;
}

function renderOpportunityCard(opp: GrowthOpportunity, expanded = false): string {
  const body = `<div class="gi-opp-body">
<p style="margin:0 0 10px"><strong>Why this matters:</strong> ${esc(opp.whyItMatters)}</p>
<div class="gi-evidence-grid">
<div class="gi-evidence-card"><label>Current</label><strong>${esc(opp.currentValue)}</strong></div>
<div class="gi-evidence-card"><label>Comparison</label><strong>${esc(opp.comparisonValue)}</strong></div>
</div>
<p style="margin:10px 0 6px"><strong>Evidence:</strong> ${esc(opp.evidenceSummary)}</p>
<p style="margin:0 0 6px"><strong>Recommended action:</strong> ${esc(opp.recommendedAction)}</p>
<p style="margin:0"><strong>Expected outcome:</strong> ${esc(opp.expectedBenefit)}</p>
</div>`;

  if (expanded) {
    return `<article class="gi-opp">
<div class="gi-opp-head">
<h3 class="gi-opp-title">${esc(opp.title)}</h3>
<div class="gi-badges">${priorityPill(opp.priority)}${confidencePill(opp.confidence)}<span class="gi-pill source">${esc(opp.evidenceSource)}</span><span class="gi-pill source">${esc(opportunityCategoryLabel(opp.category))}</span></div>
</div>
${body}
</article>`;
  }

  return `<article class="gi-opp">
<div class="gi-opp-head">
<h3 class="gi-opp-title">${esc(opp.title)}</h3>
<div class="gi-badges">${priorityPill(opp.priority)}<span class="gi-pill source">${esc(opportunityCategoryLabel(opp.category))}</span></div>
</div>
</article>`;
}

function renderOpportunityList(opportunities: GrowthOpportunity[], emptyMessage: string): string {
  if (!opportunities.length) {
    return `<div class="gi-empty">${esc(emptyMessage)}</div>`;
  }
  return opportunities.map((o) => renderOpportunityCard(o, true)).join("");
}

function renderRoadmap(roadmap: GrowthOpportunityReport["roadmap"]): string {
  const col = (title: string, items: GrowthOpportunity[]) =>
    `<div class="gi-roadmap-col">
<h3>${esc(title)}</h3>
${items.length ? items.map((o) => `<div class="gi-roadmap-item"><strong>${esc(o.title)}</strong><br/><span style="color:#64748b;font-size:12px">${esc(o.recommendedAction)}</span></div>`).join("") : `<p class="gi-section-note" style="margin:0">No items yet — add evidence from Business Intelligence and Local Market.</p>`}
</div>`;

  return `<div class="ge-grid-3">${col("High Priority", roadmap.high)}${col("Medium Priority", roadmap.medium)}${col("Later", roadmap.later)}</div>`;
}

function renderWebsiteSection(slug: string, placeholders: GrowthOpportunityReport["websiteAnalysisPlaceholders"]): string {
  const website = loadWebsiteIntelligenceSnapshot(slug);
  if (website?.analysis?.understandingComplete) {
    const inv = website.analysis.inventory;
    return `<div class="gi-evidence-grid">
<div class="gi-evidence-card"><label>Pages analysed</label><strong>${inv.totalPages}</strong></div>
<div class="gi-evidence-card"><label>Service pages</label><strong>${inv.servicePages}</strong></div>
<div class="gi-evidence-card"><label>Blogs</label><strong>${inv.blogArticles}</strong></div>
<div class="gi-evidence-card"><label>Content gaps</label><strong>${website.analysis.missingContent.length}</strong></div>
</div>
<p style="font-size:13px;color:#64748b;margin:12px 0 0">From Your Website Report — <a href="/api/growth-engine/website-intelligence?slug=${esc(slug)}">View full website report →</a></p>`;
  }
  return `<p class="gi-section-note">Website analysis has not run yet — complete Step 3 first.</p>${renderWebsitePlaceholders(placeholders)}`;
}
function renderWebsitePlaceholders(placeholders: GrowthOpportunityReport["websiteAnalysisPlaceholders"]): string {
  return `<div class="gi-future-grid">${placeholders
    .map((p) => `<div class="gi-future-card"><strong>${esc(p.label)}</strong>${esc(p.note)}</div>`)
    .join("")}</div>`;
}

function renderReadyToBuild(report: GrowthOpportunityReport, slug: string): string {
  const r = report.readyToBuild;
  return `<div class="gi-ready">
<h3>Ready To Build</h3>
<p><strong>Recommended first campaign:</strong> ${esc(r.recommendedCampaign)}</p>
<p><strong>Reason:</strong> ${esc(r.reason)}</p>
<p><strong>Estimated ecosystem:</strong> ${esc(r.estimatedEcosystem)}</p>
<p><strong>Estimated time:</strong> ${esc(r.estimatedTime)}</p>
<a class="ge-btn ge-btn-primary" href="${esc(r.planUrl)}">Open Your Growth Plan →</a>
<form method="post" action="/api/growth-engine/${esc(slug)}/acknowledge/growth-intelligence" style="margin-top:12px;display:inline-block;margin-left:8px">
<button type="submit" class="ge-btn ge-btn-ghost" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff">Mark as reviewed →</button>
</form>
</div>`;
}

export function renderGrowthIntelligenceV1Page(
  slug: string,
  snapshot: GrowthEngineCompetitorSnapshot | null,
  options?: { prevUrl?: string; nextUrl?: string },
): string {
  const framework = buildGrowthEngineFramework(slug);
  const report = buildGrowthOpportunityReport(slug, snapshot);
  const hasLiveGoogle = snapshot?.analysis?.dataSource === "google-places-live";
  const warn = !hasLiveGoogle
    ? `<div class="gi-warn">Live Google Places data is not available yet. Local visibility opportunities will appear after you run competitor discovery in Local Market Intelligence.</div>`
    : "";

  const priorityCards = report.opportunities.length
    ? report.opportunities.slice(0, 8).map((o) => renderOpportunityCard(o)).join("")
    : `<div class="gi-empty">No evidence-backed opportunities yet. Complete Business Intelligence and Local Market discovery first.</div>`;

  const body = `<div class="ge-panel" style="border-color:#93c5fd;background:#eff6ff">
<p style="margin:0;font-size:14px"><strong>This analysis now lives in Your Growth Plan.</strong> Continue there for your one recommended campaign with full evidence.</p>
<p style="margin:10px 0 0"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${esc(slug)}">Open Your Growth Plan →</a></p>
</div>
${warn}
<div class="ge-panel">
<h2>1. Growth Overview</h2>
<p class="gi-section-note">Information only — no scoring. Counts reflect genuine opportunities backed by your profile, Google Places, generated content, or Search Console data.</p>
${renderOverview(report.overview)}
${report.dataSources.length ? `<p style="font-size:12px;color:#64748b;margin:12px 0 0">Evidence sources: ${report.dataSources.map((s) => esc(s)).join(" · ")}</p>` : ""}
</div>

<div class="ge-panel">
<h2>2. Priority Opportunities</h2>
<p class="gi-section-note">Highest-value actions first — only shown when supported by evidence.</p>
${priorityCards}
</div>

<div class="ge-panel">
<h2>3. Evidence</h2>
<p class="gi-section-note">Full detail for every recommendation: why it matters, current vs comparison, and expected outcome.</p>
${renderOpportunityList(report.opportunities, "No recommendations yet — we only show opportunities backed by real data.")}
</div>

<div class="ge-panel">
<h2>4. Missing Content</h2>
<p class="gi-section-note">Enabled services compared against your generated content ecosystem — website not inspected in this phase.</p>
${renderOpportunityList(report.missingContent, "No missing content gaps detected, or no services selected on your profile.")}
</div>

<div class="ge-panel">
<h2>5. Local Visibility</h2>
<p class="gi-section-note">Based on Google Places data from Local Market Intelligence only.</p>
${renderOpportunityList(report.localVisibility, hasLiveGoogle ? "No local visibility gaps detected from available Google data." : "Run Local Market discovery to compare reviews, photos and categories.")}
</div>

<div class="ge-panel">
<h2>6. Website Analysis</h2>
${renderWebsiteSection(slug, report.websiteAnalysisPlaceholders)}
</div>

<div class="ge-panel">
<h2>7. Growth Roadmap</h2>
<p class="gi-section-note">Prioritised roadmap from genuine opportunities only.</p>
${renderRoadmap(report.roadmap)}
</div>

<div class="ge-panel">
<h2>8. Ready To Build</h2>
${renderReadyToBuild(report, slug)}
</div>`;

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Growth Intelligence · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthIntelligencePageCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:${commercialBlueChromeGradientCss()};color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Growth Intelligence</h1>
<p>Evidence-backed pharmacy growth opportunities — what to improve first and why</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "growth-intelligence", {
  prevUrl: options?.prevUrl,
  nextUrl: options?.nextUrl,
  nextLabel: "Continue to Growth Plan →",
})}
${body}
</div>
</body></html>`);
}
