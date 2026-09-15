/**
 * Pharmacy Executive Dashboard V1 — HTML UI route.
 */
import { Router } from "express";
import {
  buildExecutiveDashboard,
  writeExecutiveDashboardJson,
  type ExecutiveDashboardV1,
  type PrioritisedAction,
} from "../../../../src/pharmacy/pharmacyExecutiveDashboardService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m] || m));
}

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function bandClass(band: string): string {
  const b = String(band || "").toLowerCase();
  if (b === "leading" || b === "high") return "pill pill-green";
  if (b === "strong") return "pill pill-teal";
  if (b === "building" || b === "moderate") return "pill pill-blue";
  if (b === "behind" || b === "limited" || b === "early") return "pill pill-amber";
  return "pill pill-gray";
}

function priorityClass(p: string): string {
  const v = String(p || "").toLowerCase();
  if (v === "critical" || v === "high") return "pill pill-amber";
  if (v === "medium") return "pill pill-blue";
  return "pill pill-gray";
}

function renderActionRows(actions: PrioritisedAction[]): string {
  if (!actions.length) {
    return `<p class="muted">Run competitor intelligence to generate your prioritised action plan.</p>`;
  }
  return `<ol class="action-plan">${actions
    .map(
      (a) => `<li class="action-item">
  <div class="action-rank">${a.rank}</div>
  <div class="action-body">
    <div class="action-top"><strong>${esc(a.title)}</strong> <span class="${priorityClass(a.priority)}">${esc(a.priority)}</span></div>
    <p class="action-why">${esc(a.why)}</p>
    <div class="action-meta"><span>${esc(a.timeframe)}</span> · <span>${esc(a.effort)} effort</span> · <span>${esc(a.category)}</span></div>
  </div>
</li>`,
    )
    .join("")}</ol>`;
}

export function renderExecutiveDashboardHtml(slug: string, dash: ExecutiveDashboardV1): string {
  const s = dash.executiveSummary;
  const styles = `
    body{font-family:Inter,Arial,sans-serif;background:#f0f4f8;margin:0;color:#0f172a;line-height:1.5}
    header{background:linear-gradient(135deg,#005eb8 0%,#003d7a 100%);color:white;padding:28px 32px 32px}
    header h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em}
    header .sub{margin:8px 0 0;color:#dbeafe;font-size:15px}
    main{max-width:1180px;margin:-20px auto 48px;padding:0 20px}
    .hero{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:28px 32px;margin-bottom:20px;box-shadow:0 4px 24px rgba(15,23,42,.06)}
    .hero-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:28px;align-items:center}
    .hero-score{text-align:center;padding:20px;background:linear-gradient(180deg,#f8fafc,#fff);border-radius:14px;border:1px solid #e2e8f0}
    .score-num{font-size:56px;font-weight:900;color:#005eb8;line-height:1}
    .score-label{font-size:13px;color:#64748b;margin-top:6px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
    .insight{font-size:17px;color:#334155;margin:0 0 16px;line-height:1.55}
    .pill{display:inline-block;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase;margin-right:6px}
    .pill-green{background:#dcfce7;color:#166534}
    .pill-teal{background:#ccfbf1;color:#115e59}
    .pill-blue{background:#dbeafe;color:#1d4ed8}
    .pill-amber{background:#ffedd5;color:#9a3412}
    .pill-gray{background:#e2e8f0;color:#475569}
    .hero-stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .stat-chip{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-size:13px}
    .stat-chip strong{display:block;font-size:18px;color:#005eb8}
    .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
    .btn{display:inline-block;background:#005eb8;color:white;text-decoration:none;border-radius:8px;padding:10px 16px;font-weight:700;font-size:14px;border:0;cursor:pointer}
    .btn.alt{background:#0f766e}
    .btn.secondary{background:#475569}
    .grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
    .card{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:16px}
    .card h2{margin:0 0 6px;font-size:18px;font-weight:800;color:#0f172a}
    .card .lead{margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.55}
    .metric{font-size:32px;font-weight:900;color:#005eb8;line-height:1.1}
    .muted{color:#64748b;font-size:13px}
    .factor-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
    .factor-row:last-child{border-bottom:0}
    .bar{height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:6px}
    .bar-fill{height:100%;background:#005eb8;border-radius:999px}
    .opp-item{padding:14px 0;border-bottom:1px solid #f1f5f9}
    .opp-item:last-child{border-bottom:0}
    .opp-item h3{margin:0 0 4px;font-size:15px}
    .weak-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:10px}
    .weak-item h4{margin:0 0 4px;font-size:14px}
    .action-plan{list-style:none;margin:0;padding:0}
    .action-item{display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #f1f5f9}
    .action-item:last-child{border-bottom:0}
    .action-rank{width:36px;height:36px;border-radius:50%;background:#005eb8;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0}
    .action-body{flex:1}
    .action-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px}
    .action-why{margin:0 0 6px;font-size:14px;color:#475569;line-height:1.5}
    .action-meta{font-size:12px;color:#94a3b8;text-transform:capitalize}
    ul.clean{margin:8px 0 0;padding-left:18px;font-size:14px;color:#475569}
    ul.clean li{margin-bottom:6px}
    .area-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
    .area-tag{background:#eff6ff;color:#1e40af;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600}
    @media(max-width:900px){.hero-grid,.grid-2,.grid-3{grid-template-columns:1fr}}
  `;

  const factorRows = dash.growthScore.factors
    .map(
      (f) => `<div class="factor-row">
  <div><strong>${esc(f.label)}</strong><div class="muted">${esc(f.note)}</div><div class="bar"><div class="bar-fill" style="width:${Math.min(100, f.score)}%"></div></div></div>
  <div style="font-weight:800;color:#005eb8;min-width:42px;text-align:right">${f.score}</div>
</div>`,
    )
    .join("");

  const oppItems = dash.opportunityEngine.topOpportunities
    .map(
      (o) => `<div class="opp-item">
  <h3>${esc(o.title)} <span class="${priorityClass(o.priority)}">${esc(o.priority)}</span></h3>
  <p class="muted">${esc(o.impact)}</p>
  <p style="margin:6px 0 0;font-size:14px">${esc(o.action)}</p>
</div>`,
    )
    .join("");

  const weaknessItems = dash.competitorWeaknesses.items
    .map(
      (w) => `<div class="weak-item">
  <h4>${esc(w.serviceName)} · ${w.competitorCoveragePct}% local competition</h4>
  <p class="muted" style="margin:0">${esc(w.opportunity)}</p>
</div>`,
    )
    .join("");

  const entitySummary = Object.entries(dash.localCoverage.entityBreakdown)
    .map(([k, n]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${n}`)
    .join(" · ");

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Executive Dashboard — ${esc(dash.pharmacyName)}</title>
  <style>${styles}</style>
</head>
<body>
<header>
  <h1>Executive Dashboard</h1>
  <p class="sub">${esc(s.subheadline)}</p>
</header>
<main>
  <div class="toolbar">
    <a class="primary" href="/api/pharmacy-growth-dashboard?slug=${esc(slug)}">Growth Journey</a>
    <a class="btn" href="/api/pharmacy-profile-dashboard?slug=${esc(slug)}">Pharmacy Profile</a>
    <a class="btn alt" href="/api/pharmacy-competitor-dashboard?slug=${esc(slug)}">Competitor Detail</a>
    <a class="btn secondary" href="/api/pharmacy-launch-demo">Launch Guide</a>
  </div>

  <section class="hero" id="executive-summary">
    <div class="hero-grid">
      <div>
        <span class="${bandClass(s.growthBand)}">${esc(s.growthBand)}</span>
        <span class="${bandClass(s.competitorPosition)}">${esc(s.competitorPosition)} vs competitors</span>
        <span class="${bandClass(s.growthPotential)}">${esc(s.growthPotential)} potential</span>
        <p class="insight" style="margin-top:16px"><strong>Key insight:</strong> ${esc(s.topInsight)}</p>
        <div class="hero-stats">
          <div class="stat-chip"><strong>${esc(String(dash.competitorPosition.competitorCount))}</strong> competitors</div>
          <div class="stat-chip"><strong>${esc(String(dash.localCoverage.areasSelected))}</strong> areas</div>
          <div class="stat-chip"><strong>${esc(String(dash.localCoverage.pagesGenerated))}</strong> pages</div>
          <div class="stat-chip"><strong>${esc(s.readinessLabel)}</strong> status</div>
        </div>
      </div>
      <div class="hero-score">
        <div class="score-num">${s.growthScore}</div>
        <div class="score-label">Growth Score</div>
        <p class="muted" style="margin:12px 0 0;font-size:13px">${esc(dash.growthScore.summary)}</p>
      </div>
    </div>
  </section>

  <div class="grid-2">
    <section class="card" id="competitor-position">
      <h2>2. Competitor Position</h2>
      <p class="lead">${esc(dash.competitorPosition.summary)}</p>
      <div class="grid-3" style="margin-bottom:14px">
        <div><div class="metric">${dash.competitorPosition.yourRating ?? "—"}</div><div class="muted">Your rating</div></div>
        <div><div class="metric">${dash.competitorPosition.competitorAvgRating ?? "—"}</div><div class="muted">Local average</div></div>
        <div><div class="metric">${dash.competitorPosition.yourReviews ?? "—"}</div><div class="muted">Your reviews</div></div>
      </div>
      <p class="muted">${esc(dash.competitorPosition.chainVsIndependent)}${dash.competitorPosition.nearestKm != null ? ` · Nearest ${dash.competitorPosition.nearestKm}km` : ""}</p>
      ${dash.competitorPosition.strengths.length ? `<p><strong>Strengths</strong></p><ul class="clean">${dash.competitorPosition.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${dash.competitorPosition.risks.length ? `<p><strong>Watch</strong></p><ul class="clean">${dash.competitorPosition.risks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    </section>

    <section class="card" id="local-coverage">
      <h2>4. Local Coverage</h2>
      <p class="lead">${esc(dash.localCoverage.summary)}</p>
      <div class="metric">${dash.localCoverage.entitiesSelected}</div>
      <div class="muted">local places referenced</div>
      <div class="area-tags">${dash.localCoverage.areas.map((a) => `<span class="area-tag">${esc(a)}</span>`).join("")}</div>
      ${entitySummary ? `<p class="muted" style="margin-top:12px">${esc(entitySummary)}</p>` : ""}
      <p class="muted" style="margin-top:10px">Coverage: ${esc(dash.localCoverage.coverageRadius)} · Intelligence: ${esc(dash.localCoverage.localIntelligenceStatus)}</p>
    </section>
  </div>

  <section class="card" id="growth-score-detail">
    <h2>1. Growth Score Breakdown</h2>
    <p class="lead">${esc(dash.growthScore.summary)}</p>
    ${factorRows}
  </section>

  <div class="grid-2">
    <section class="card" id="opportunity-engine">
      <h2>3. Opportunity Engine</h2>
      <p class="lead">${esc(dash.opportunityEngine.summary)}</p>
      ${oppItems || `<p class="muted">No opportunities yet — run competitor intelligence.</p>`}
    </section>

    <section class="card" id="competitor-weaknesses">
      <h2>5. Competitor Weaknesses</h2>
      <p class="lead">${esc(dash.competitorWeaknesses.summary)}</p>
      ${weaknessItems || `<p class="muted">Competitor service gaps will appear after intelligence runs.</p>`}
    </section>
  </div>

  <section class="card" id="growth-potential">
    <h2>6. Estimated Growth Potential</h2>
    <p class="lead"><span class="${bandClass(dash.estimatedGrowthPotential.label)}">${esc(dash.estimatedGrowthPotential.label)}</span> ${esc(dash.estimatedGrowthPotential.summary)}</p>
    <ul class="clean">${dash.estimatedGrowthPotential.drivers.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
  </section>

  <section class="card" id="action-plan">
    <h2>7. Recommended Action Plan</h2>
    <p class="lead">${esc(dash.actionPlan.summary)}</p>
    ${renderActionRows(dash.actionPlan.actions)}
  </section>

  <p class="muted" style="text-align:center;font-size:12px">Generated ${esc(dash.generatedAt)} · PharmaConnect Executive Dashboard V1</p>
</main>
</body>
</html>`;
}

router.get("/pharmacy-executive-dashboard", (req, res) => {
  const slug = safeSlug(String(req.query.slug || "pharmaconnect"));
  try {
    writeExecutiveDashboardJson(slug);
    const dash = buildExecutiveDashboard(slug);
    res.type("html").send(renderExecutiveDashboardHtml(slug, dash));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Dashboard error: ${esc(String(err))}</pre>`);
  }
});

export default router;
