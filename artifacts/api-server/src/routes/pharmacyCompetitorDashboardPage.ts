import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const INTEL_DIR = path.join(ROOT, "data", "pharmacy-competitor-intelligence");
const OPP_DIR = path.join(ROOT, "data", "pharmacy-opportunity-engine");

export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m] || m));
}

function safeSlug(v: string) {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function loadDashboard(slug: string): any | null {
  const primary = path.join(INTEL_DIR, `${slug}-dashboard.json`);
  const fallback = path.join(OPP_DIR, `${slug}-dashboard.json`);
  const file = fs.existsSync(primary) ? primary : fs.existsSync(fallback) ? fallback : null;
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function priorityClass(priority: string): string {
  const p = String(priority || "").toLowerCase();
  if (p === "critical") return "badge critical";
  if (p === "high") return "badge high";
  if (p === "medium") return "badge medium";
  return "badge low";
}

function gapClass(level: string): string {
  const l = String(level || "").toLowerCase();
  if (l === "high" || l === "critical") return "badge high";
  if (l === "medium") return "badge medium";
  return "badge low";
}

function bestCompetitorReviewCount(competitors: any[]): number {
  if (!competitors?.length) return 0;
  return Math.max(...competitors.map((c) => Number(c.gbpReviewCount || c.reviewCount || 0)));
}

export function renderCompetitorDashboardHtml(slug: string, dashboard: any | null): string {
  const styles = `
    body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;color:#0f172a}
    header{background:#005eb8;color:white;padding:22px 30px}
    header h1{margin:0;font-size:24px}
    header p{margin:6px 0 0;color:#dbeafe}
    main{max-width:1200px;margin:24px auto;padding:0 18px 40px}
    .grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
    .grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .card{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:16px}
    .metric{font-size:28px;font-weight:900;color:#005eb8}
    .muted{color:#64748b;font-size:13px}
    h2{margin:0 0 12px;font-size:19px}
    h3{margin:0 0 8px;font-size:16px}
    table{width:100%;border-collapse:collapse;background:white}
    th,td{border-bottom:1px solid #e2e8f0;text-align:left;padding:10px;vertical-align:top;font-size:14px}
    th{background:#f1f5f9;color:#334155}
    .btn{display:inline-block;background:#005eb8;color:white;text-decoration:none;border-radius:8px;padding:10px 14px;font-weight:800;margin-right:8px;border:0;cursor:pointer;font-size:14px}
    .btn.alt{background:#0f766e}
    .btn.secondary{background:#334155}
    .btn:disabled{opacity:.6;cursor:not-allowed}
    .badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase}
    .badge.critical{background:#fee2e2;color:#991b1b}
    .badge.high{background:#ffedd5;color:#9a3412}
    .badge.medium{background:#dbeafe;color:#1d4ed8}
    .badge.low{background:#e2e8f0;color:#475569}
    .opp-card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff}
    .opp-card h3{margin-top:8px}
    .action-list{margin:0;padding-left:20px}
    .action-list li{margin-bottom:10px}
    .stat-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9}
    .stat-row:last-child{border-bottom:0}
    .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:16px}
    .status-msg{font-size:14px;color:#334155;margin-left:8px}
    .empty{padding:28px;text-align:center}
    .explain{font-size:14px;line-height:1.55;color:#475569;margin:0 0 14px}
    .gap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:8px}
    .gap-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
    .gap-box h4{margin:0 0 6px;font-size:14px;color:#0f172a}
    @media (max-width:900px){.grid,.grid-2,.gap-grid{grid-template-columns:1fr}}
  `;

  if (!dashboard) {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Competitor Intelligence — PharmaConnect</title>
  <style>${styles}</style>
</head>
<body>
<header>
  <h1>Competitor Intelligence Dashboard</h1>
  <p>No competitor intelligence report has been generated yet for ${esc(slug)}.</p>
</header>
<main>
  <div class="toolbar">
    <button class="btn" id="runBtn" data-slug="${esc(slug)}">Run Competitor Intelligence</button>
    <a class="btn alt" href="/api/pharmacy-setup">Pharmacy Setup</a>
    <a class="btn secondary" href="/api/pharmacy-intelligence">Pharmacy Intelligence</a>
    <span class="status-msg" id="statusMsg"></span>
  </div>
  <div class="card empty">
    <p class="muted">Run competitor intelligence to discover nearby pharmacies, analyse service gaps and generate opportunities.</p>
  </div>
</main>
<script>
const btn = document.getElementById('runBtn');
const msg = document.getElementById('statusMsg');
btn?.addEventListener('click', async () => {
  btn.disabled = true;
  msg.textContent = 'Running competitor intelligence…';
  try {
    const slug = btn.dataset.slug || '${esc(slug)}';
    const res = await fetch('/api/pharmacy-competitor-intelligence/' + slug + '/build', { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Build failed');
    msg.textContent = 'Complete — reloading…';
    location.reload();
  } catch (e) {
    msg.textContent = e.message || 'Build failed';
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;
  }

  const summary = dashboard.competitorSummary || {};
  const review = dashboard.reviewComparison || {};
  const serviceCoverage = dashboard.serviceCoverage || [];
  const competitors = dashboard.competitors || [];
  const opportunities = (dashboard.opportunities || []).slice(0, 10);
  const actions = dashboard.recommendedActions || [];
  const serviceGapCount = serviceCoverage.filter((s: any) => s.gapLevel === "high").length;
  const highPriority = (dashboard.opportunities || []).filter(
    (o: any) => o.priority === "Critical" || o.priority === "High",
  ).length;
  const gaps = dashboard.gaps || {};
  const gapExplain = (key: string, title: string, fallback: string) => {
    const g = gaps[key];
    const summary = g?.summary || fallback;
    return `<div class="gap-box"><h4>${esc(title)}</h4><p class="explain">${esc(summary)}</p><span class="${gapClass(g?.level || "low")}">${esc(g?.level || "low")}</span></div>`;
  };

  const friendlyAction = (s: any) => {
    if (s.gapLevel === "high") return `Many nearby pharmacies promote ${s.serviceName.toLowerCase()}. Stand out with clear local pages and booking prompts.`;
    if (s.gapLevel === "medium") return `Some competitors offer ${s.serviceName.toLowerCase()}. Keep your service visible in local search.`;
    return `Lower local competition for ${s.serviceName.toLowerCase()} — a good opportunity to rank.`;
  };

  const friendlyOpp = (o: any) => {
    const action = String(o.action || "").replace(/^Build dedicated /i, "Create local pages for ").replace(/ area pages with local proof points and conversion CTAs\.?$/i, ".");
    return action;
  };

  const bestReviews = bestCompetitorReviewCount(competitors);

  const competitorRows = competitors
    .map(
      (c: any) => `
    <tr>
      <td><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.address)}</span></td>
      <td>${esc(c.distanceLabel || c.distanceKm + "km")}</td>
      <td>${esc(c.gbpRating ?? c.rating ?? "—")}</td>
      <td>${esc(c.gbpReviewCount ?? c.reviewCount ?? 0)}</td>
      <td>${c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">Website</a>` : `<span class="muted">—</span>`}</td>
      <td>${c.phone ? esc(c.phone) : `<span class="muted">—</span>`}</td>
    </tr>`,
    )
    .join("");

  const serviceRows = serviceCoverage
    .map(
      (s: any) => `
    <tr>
      <td><strong>${esc(s.serviceName)}</strong></td>
      <td>${s.pharmacyOffers ? "Yes" : "No"}</td>
      <td>${esc(s.competitorCoverage)} / ${esc(summary.count || competitors.length)}</td>
      <td><span class="${gapClass(s.gapLevel)}">${esc(s.gapLevel)}</span></td>
      <td>${esc(friendlyAction(s))}</td>
    </tr>`,
    )
    .join("");

  const oppCards = opportunities
    .map(
      (o: any) => `
    <div class="opp-card" data-section="opportunity">
      <span class="${priorityClass(o.priority)}">${esc(o.priority)} priority</span>
      <h3>${esc(o.title)}</h3>
      <p>${esc(o.description)}</p>
      <p class="muted"><strong>Why this matters:</strong> ${esc(o.impact || o.description)}</p>
      <p><strong>What to do next:</strong> ${esc(friendlyOpp(o))}</p>
    </div>`,
    )
    .join("");

  const actionItems = actions
    .map(
      (a: any) => `
    <li data-section="recommended-action">
      <span class="${priorityClass(a.priority)}">${esc(a.priority)}</span>
      <strong>${esc(a.title)}</strong>
      <div class="muted">${esc(a.description)} · ${esc(a.timeframe)} · ${esc(a.effort)} effort</div>
    </li>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Competitor Intelligence — ${esc(slug)} — PharmaConnect</title>
  <style>${styles}</style>
</head>
<body>
<header>
  <h1>Local Competitor Intelligence</h1>
  <p>See who you compete with nearby, where you are ahead or behind, and what to do next · ${esc(summary.count || competitors.length)} pharmacies analysed</p>
</header>
<main>
  <div class="toolbar">
    <button class="btn" id="runBtn" data-slug="${esc(slug)}">Run Competitor Intelligence</button>
    <a class="btn alt" href="/api/pharmacy-competitor-intelligence/${esc(slug)}/dashboard">View JSON</a>
    <a class="btn secondary" href="/api/pharmacy-intelligence">Pharmacy Intelligence</a>
    <a class="btn secondary" href="/api/pharmacy-setup">Pharmacy Setup</a>
    <span class="status-msg" id="statusMsg"></span>
  </div>

  <section id="competitor-summary" data-section="competitor-summary">
    <div class="grid">
      <div class="card"><div class="metric">${esc(summary.count || competitors.length)}</div><div class="muted">Nearby Pharmacies Found</div></div>
      <div class="card"><div class="metric">${esc(summary.avgReviewCount || 0)}</div><div class="muted">Avg. Google Reviews (Competitors)</div></div>
      <div class="card"><div class="metric">${esc(summary.avgRating || 0)}</div><div class="muted">Avg. Star Rating (Competitors)</div></div>
      <div class="card"><div class="metric">${esc(serviceGapCount)}</div><div class="muted">High-Competition Services</div></div>
      <div class="card"><div class="metric">${esc(highPriority)}</div><div class="muted">Priority Actions</div></div>
    </div>
  </section>

  <section id="competitor-table" data-section="competitor-table" class="card">
    <h2>Nearby Pharmacies</h2>
    <p class="explain">Pharmacies closest to your location, with Google rating and review counts to help you compare local visibility.</p>
    <table>
      <thead><tr><th>Competitor</th><th>Distance</th><th>Rating</th><th>Reviews</th><th>Website</th><th>Phone</th></tr></thead>
      <tbody>${competitorRows || `<tr><td colspan="6" class="muted">No competitors found.</td></tr>`}</tbody>
    </table>
  </section>

  <section id="review-gap" data-section="review-gap" class="card">
    <h2>Google Reviews Comparison</h2>
    <p class="explain">Patients often compare pharmacies on Google before visiting. This shows how your review profile compares with nearby competitors.</p>
    <div class="grid-2">
      <div>
        <div class="stat-row"><span>Your pharmacy reviews</span><strong>${esc(review.pharmacyReviewCount ?? 0)}</strong></div>
        <div class="stat-row"><span>Your pharmacy rating</span><strong>${esc(review.pharmacyRating ?? "—")}</strong></div>
        <div class="stat-row"><span>Competitor average reviews</span><strong>${esc(review.competitorAvgReviewCount ?? 0)}</strong></div>
        <div class="stat-row"><span>Competitor average rating</span><strong>${esc(review.competitorAvgRating ?? 0)}</strong></div>
      </div>
      <div>
        <div class="stat-row"><span>Review gap</span><strong>${esc(review.reviewCountDelta ?? 0)} reviews</strong></div>
        <div class="stat-row"><span>Rating delta</span><strong>${esc(review.ratingDelta ?? 0)}</strong></div>
        <div class="stat-row"><span>Best competitor review count</span><strong>${esc(bestReviews)}</strong></div>
        <div class="stat-row"><span>Gap level</span><strong><span class="${gapClass(dashboard.gaps?.reviewGap?.level || "low")}">${esc(dashboard.gaps?.reviewGap?.level || "low")}</span></strong></div>
      </div>
    </div>
  </section>

  <section id="gap-explanations" data-section="gap-explanations" class="card">
    <h2>Understanding Your Gaps</h2>
    <p class="explain">These five gap types show where competitors may have an advantage — and where you can improve quickly.</p>
    <div class="gap-grid">
      ${gapExplain("reviewGap", "Review gap", "How your Google reviews compare with nearby pharmacies.")}
      ${gapExplain("serviceGap", "Service gap", "How many competitors promote the same services as you.")}
      ${gapExplain("contentGap", "Content gap", "Whether your local service pages are strong enough to compete in search.")}
      ${gapExplain("visibilityGap", "Visibility gap", "How complete your Google Business Profile and website presence is.")}
      ${gapExplain("trustGap", "Trust gap", "How your trust signals compare with nearby pharmacies.")}
    </div>
  </section>

  <section id="service-coverage" data-section="service-coverage" class="card">
    <h2>Service Competition by Service</h2>
    <p class="explain">For each service you offer, see how many nearby pharmacies also promote it. High competition means you need stronger local pages to stand out.</p>
    <table>
      <thead><tr><th>Service</th><th>Your Coverage</th><th>Competitor Coverage</th><th>Gap Severity</th><th>Recommended Action</th></tr></thead>
      <tbody>${serviceRows || `<tr><td colspan="5" class="muted">No service comparisons available.</td></tr>`}</tbody>
    </table>
  </section>

  <section id="opportunities" data-section="opportunities" class="card">
    <h2>Your Top Opportunities</h2>
    <p class="explain">Practical improvements ranked by priority. Start with high-priority items for the fastest impact on local visibility.</p>
    ${oppCards || `<p class="muted">No opportunities generated yet.</p>`}
  </section>

  <section id="recommended-actions" data-section="recommended-actions" class="card">
    <h2>Suggested Next Steps</h2>
    <p class="explain">A simple action list you can work through as a pharmacy owner or manager.</p>
    <ul class="action-list">${actionItems || `<li class="muted">No recommended actions yet.</li>`}</ul>
  </section>
</main>
<script>
const btn = document.getElementById('runBtn');
const msg = document.getElementById('statusMsg');
btn?.addEventListener('click', async () => {
  btn.disabled = true;
  msg.textContent = 'Running competitor intelligence…';
  try {
    const slug = btn.dataset.slug || '${esc(slug)}';
    const res = await fetch('/api/pharmacy-competitor-intelligence/' + slug + '/build', { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Build failed');
    msg.textContent = 'Complete — reloading…';
    location.reload();
  } catch (e) {
    msg.textContent = e.message || 'Build failed';
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;
}

router.get("/pharmacy-competitor-dashboard", (req, res) => {
  const slug = safeSlug(String(req.query.slug || "pharmaconnect"));
  const dashboard = loadDashboard(slug);
  res.type("html").send(renderCompetitorDashboardHtml(slug, dashboard));
});

export default router;
