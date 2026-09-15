/**
 * PharmaConnect Authority Enhancement Engine V1 — full enhancement dashboard.
 * Route: /api/pharmacy-authority-enhancements?slug={slug}&service={serviceId}
 */
import { Router, type Request, type Response } from "express";
import {
  ENHANCEMENT_CATEGORIES,
  ENHANCEMENT_CATEGORY_LABELS,
  buildAuthorityEnhancementDashboard,
  refreshPharmacyAuthorityEnhancement,
  type EnhancementRecommendation,
  type ServiceAuthorityEnhancement,
} from "../../../../src/pharmacy/pharmacyAuthorityEnhancementService.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../../../../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function impactClass(impact: string): string {
  if (impact === "High") return "high";
  if (impact === "Medium") return "medium";
  return "low";
}

function diffClass(d: string): string {
  if (d === "Easy") return "easy";
  if (d === "Advanced") return "advanced";
  return "medium";
}

function renderCategoryScores(enh: ServiceAuthorityEnhancement): string {
  return enh.categoryScores
    .map((c) => {
      const cls = c.currentScore >= 75 ? "ok" : c.currentScore >= 50 ? "warn" : "missing";
      return `<div class="score-card ${cls}">
  <span class="label">${esc(c.label)}</span>
  <strong>${c.currentScore}</strong>
  <div class="muted">→ ${c.potentialScore} potential · +${c.improvementPotential}% room</div>
  <div class="gain-row"><span>Auth +${c.estimatedAuthorityGain}</span><span>AI +${c.estimatedAiCitationGain}</span><span>Local +${c.estimatedLocalVisibilityGain}</span></div>
</div>`;
    })
    .join("");
}

function renderRecommendation(rec: EnhancementRecommendation): string {
  return `<article class="rec-card impact-${impactClass(rec.estimatedImpact)}">
  <div class="rec-head">
    <strong>${esc(rec.title)}</strong>
    <span class="badge cat">${esc(ENHANCEMENT_CATEGORY_LABELS[rec.category])}</span>
    <span class="badge diff-${diffClass(rec.difficulty)}">${esc(rec.difficulty)}</span>
    <span class="badge impact-${impactClass(rec.estimatedImpact)}">${esc(rec.estimatedImpact)} impact</span>
  </div>
  <p>${esc(rec.reason)}</p>
  <ul class="evidence">${rec.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
  <div class="gain-row">
    <span>Score +${rec.estimatedScoreGain}</span>
    <span>AI +${rec.estimatedAiGain}</span>
    <span>Visibility +${rec.estimatedVisibilityGain}</span>
  </div>
  <p class="next"><strong>Next:</strong> ${esc(rec.recommendedNextAction)}</p>
  <a class="btn-xs" href="${esc(rec.linkedUrl)}">${esc(rec.linkedModule)}</a>
</article>`;
}

export function renderAuthorityEnhancementDashboardHtml(
  d: ReturnType<typeof buildAuthorityEnhancementDashboard>,
): string {
  const enh = d.selectedEnhancement;
  const primary = d.brandPrimaryColor || "#1a5c42";
  const summary = d.doc.summary;
  const serviceOptions = VISUAL_EXPERIENCE_BENCHMARK_SERVICES.map(
    (id) => `<option value="${esc(id)}" ${id === d.selectedServiceId ? "selected" : ""}>${esc(id.replace(/-/g, " "))}</option>`,
  ).join("");
  const categoryOptions = `<option value="all">All categories</option>${ENHANCEMENT_CATEGORIES.map(
    (c) => `<option value="${esc(c)}" ${d.filters.category === c ? "selected" : ""}>${esc(ENHANCEMENT_CATEGORY_LABELS[c])}</option>`,
  ).join("")}`;
  const os = buildPlatformOperatingSystem(d.slug);

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Authority Enhancement — ${esc(d.pharmacyName)}</title>
<style>
:root{--primary:${esc(primary)}}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#0f172a,var(--primary));color:#fff;padding:24px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.toolbar a{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;text-decoration:none;background:rgba(255,255,255,.15);color:#fff}
main{max-width:1180px;margin:24px auto 48px;padding:0 20px}
section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px 24px;margin-bottom:20px}
section h2{margin:0 0 12px;font-size:18px}
.lead{margin:0 0 16px;font-size:13px;color:#64748b}
.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.filters label{display:block;font-size:12px;font-weight:600;margin-bottom:4px}
.filters select{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center}
.stat strong{display:block;font-size:26px;color:var(--primary)}
.stat span{font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700}
.score-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.score-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fafbfc}
.score-card.ok{border-color:#a7f3d0}.score-card.warn{border-color:#fde68a}.score-card.missing{border-color:#fecaca}
.score-card .label{display:block;font-size:11px;color:#64748b;margin-bottom:6px}
.score-card strong{font-size:24px;color:var(--primary)}
.gain-row{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:#64748b;margin-top:6px}
.gain-row span{background:#f1f5f9;padding:2px 8px;border-radius:999px}
.rec-list{display:flex;flex-direction:column;gap:14px}
.rec-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#fafbfc}
.rec-card.impact-high{border-left:4px solid #dc2626}
.rec-card.impact-medium{border-left:4px solid #d97706}
.rec-card.impact-low{border-left:4px solid #64748b}
.rec-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase}
.badge.cat{background:#e0e7ff;color:#3730a3}
.badge.easy{background:#d1fae5;color:#065f46}
.badge.medium{background:#fef3c7;color:#92400e}
.badge.advanced{background:#fee2e2;color:#991b1b}
.badge.impact-high{background:#fee2e2;color:#991b1b}
.badge.impact-medium{background:#fef3c7;color:#92400e}
.badge.impact-low{background:#f1f5f9;color:#475569}
.evidence{font-size:12px;color:#64748b;margin:8px 0;padding-left:18px}
.next{font-size:13px;margin:8px 0}
.btn-xs{display:inline-block;background:var(--primary);color:#fff;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;text-decoration:none}
.btn{display:inline-block;background:var(--primary);color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
.muted{color:#64748b}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>Authority Enhancement Engine</h1>
  <p>${esc(d.pharmacyName)} · AI Quality Consultant · advisory only — no content modified</p>
  ${renderPharmacyPlatformNavBar({ slug: d.slug, serviceId: d.selectedServiceId || "blood-pressure-checks", activeId: "enhancement" })}
</header>
<main>
${renderPlatformWorkflowBar({ slug: d.slug, nextStepUrl: os.nextStep?.url })}
  <section>
    <h2>Platform summary</h2>
    <p class="lead">How strong pages are today, what prevents authority, and exactly what to improve — with estimated gains.</p>
    <div class="stats">
      <div class="stat"><strong>${summary.averageCurrentScore}</strong><span>Current score</span></div>
      <div class="stat"><strong>${summary.averagePotentialScore}</strong><span>Potential score</span></div>
      <div class="stat"><strong>+${summary.estimatedOverallImprovement}</strong><span>Est. improvement</span></div>
      <div class="stat"><strong>${summary.totalRecommendations}</strong><span>Recommendations</span></div>
      <div class="stat"><strong>${summary.easyWins}</strong><span>Easy wins</span></div>
      <div class="stat"><strong>${summary.highImpactImprovements}</strong><span>High impact</span></div>
    </div>
  </section>

  <section>
    <h2>Filters</h2>
    <form class="filters" id="filterForm" method="get">
      <input type="hidden" name="slug" value="${esc(d.slug)}"/>
      <div><label>Service</label><select name="service" id="serviceSelect">${serviceOptions}</select></div>
      <div><label>Category</label><select name="category">${categoryOptions}</select></div>
      <div><label>Difficulty</label><select name="difficulty">
        <option value="all">All</option>
        <option value="Easy" ${d.filters.difficulty === "Easy" ? "selected" : ""}>Easy</option>
        <option value="Medium" ${d.filters.difficulty === "Medium" ? "selected" : ""}>Medium</option>
        <option value="Advanced" ${d.filters.difficulty === "Advanced" ? "selected" : ""}>Advanced</option>
      </select></div>
      <div><label>Impact</label><select name="impact">
        <option value="all">All</option>
        <option value="High" ${d.filters.impact === "High" ? "selected" : ""}>High</option>
        <option value="Medium" ${d.filters.impact === "Medium" ? "selected" : ""}>Medium</option>
        <option value="Low" ${d.filters.impact === "Low" ? "selected" : ""}>Low</option>
      </select></div>
      <div style="align-self:end"><button type="submit" class="btn">Apply filters</button></div>
    </form>
    <button type="button" class="btn" id="refreshBtn" style="margin-top:8px">Refresh analysis</button>
  </section>

  ${
    enh
      ? `<section>
    <h2>${esc(enh.serviceName)}</h2>
    <div class="stats">
      <div class="stat"><strong>${enh.currentAuthorityScore}</strong><span>Current authority</span></div>
      <div class="stat"><strong>${enh.potentialAuthorityScore}</strong><span>Potential authority</span></div>
      <div class="stat"><strong>${enh.totalRecommendations}</strong><span>Recommendations</span></div>
      <div class="stat"><strong>${enh.easyWins}</strong><span>Easy wins</span></div>
      <div class="stat"><strong>${enh.highImpactImprovements}</strong><span>High impact</span></div>
    </div>
    <h3>Category scores</h3>
    <div class="score-grid">${renderCategoryScores(enh)}</div>
    <h3 style="margin-top:20px">Top recommendations (${enh.recommendations.length} shown)</h3>
    <div class="rec-list">${enh.recommendations.length ? enh.recommendations.map(renderRecommendation).join("") : "<p class=\"muted\">All signals present for current filters — excellent baseline.</p>"}</div>
  </section>`
      : `<section><p class="muted">Select a service to view enhancement opportunities.</p></section>`
  }
</main>
<script>
const SLUG = ${JSON.stringify(d.slug)};
document.getElementById('refreshBtn').addEventListener('click', async () => {
  await fetch('/api/pharmacy-authority-enhancements/' + SLUG + '/refresh', { method:'POST', credentials:'same-origin' });
  location.reload();
});
</script>
</body>
</html>`;
}

function handleDashboard(req: Request, res: Response): void {
  try {
    const slug = String(req.query.slug || "pharmaconnect");
    const serviceId = req.query.service ? String(req.query.service) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const difficulty = req.query.difficulty ? String(req.query.difficulty) : undefined;
    const impact = req.query.impact ? String(req.query.impact) : undefined;
    const dashboard = buildAuthorityEnhancementDashboard(slug, { serviceId, category, difficulty, impact });
    res.type("html").send(renderAuthorityEnhancementDashboardHtml(dashboard));
  } catch (err) {
    res.status(500).type("text/plain").send(String(err));
  }
}

router.get("/pharmacy-authority-enhancements", handleDashboard);

export default router;
