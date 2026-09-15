/**
 * Pharmacy Growth Action Plan V1 — full action plan HTML page.
 */
import { Router } from "express";
import {
  readPharmacyGrowthActionPlan,
  refreshPharmacyGrowthActionPlan,
  type GrowthAction,
  type GrowthActionCategory,
  type PharmacyGrowthActionPlan,
} from "../../../../src/pharmacy/pharmacyGrowthActionPlanService.ts";
import { buildGrowthJourneyDashboard } from "../../../../src/pharmacy/pharmacyGrowthJourneyService.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { PRIMARY_PLATFORM_SERVICE_ID } from "../../../../src/pharmacy/pharmacyPlatformDashboardService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function statusClass(status: string): string {
  if (status === "complete") return "status complete";
  if (status === "in_progress") return "status progress";
  if (status === "deferred") return "status deferred";
  return "status pending";
}

function renderActionCard(action: GrowthAction, slug: string): string {
  return `<article class="action-card" data-action-id="${esc(action.id)}">
  <div class="action-top">
    <strong>${esc(action.title)}</strong>
    <span class="pill">${esc(action.category)}</span>
    <span class="pill priority">${esc(action.priority)}</span>
    <span class="${statusClass(action.status)}">${esc(action.status.replace("_", " "))}</span>
  </div>
  <p class="muted">${esc(action.reason)}</p>
  <div class="meta-grid">
    <div><strong>Impact</strong><p>${esc(action.impact)}</p></div>
    <div><strong>Effort</strong><p>${esc(action.effort)}</p></div>
    <div><strong>Next step</strong><p>${esc(action.recommendedNextStep)}</p></div>
  </div>
  ${action.evidence.length ? `<ul class="evidence">${action.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
  <div class="action-foot">
    <a class="btn-sm" href="${esc(action.linkedUrl)}">${esc(action.linkedModule)} →</a>
    <select class="status-select" data-slug="${esc(slug)}" data-action-id="${esc(action.id)}" aria-label="Update status">
      <option value="pending" ${action.status === "pending" ? "selected" : ""}>Pending</option>
      <option value="in_progress" ${action.status === "in_progress" ? "selected" : ""}>In progress</option>
      <option value="complete" ${action.status === "complete" ? "selected" : ""}>Complete</option>
      <option value="deferred" ${action.status === "deferred" ? "selected" : ""}>Deferred</option>
    </select>
  </div>
</article>`;
}

function renderCategoryGroup(category: GrowthActionCategory, actions: GrowthAction[], slug: string): string {
  if (!actions.length) return "";
  return `<section class="category-block">
  <h2>${esc(category)} <span class="count">${actions.length}</span></h2>
  ${actions.map((a) => renderActionCard(a, slug)).join("")}
</section>`;
}

export function renderGrowthActionPlanHtml(plan: PharmacyGrowthActionPlan, pharmacyName: string, brandPrimary: string): string {
  const categories = Object.keys(plan.actionsByCategory).sort() as GrowthActionCategory[];
  const categoryBlocks = categories
    .map((c) => renderCategoryGroup(c, plan.actionsByCategory[c] || [], plan.slug))
    .join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Growth Action Plan — ${esc(pharmacyName)}</title>
<style>
:root{--primary:${esc(brandPrimary)}}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#003087,var(--primary));color:#fff;padding:24px 28px}
header h1{margin:0;font-size:26px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.toolbar a,.toolbar button{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;text-decoration:none;cursor:pointer;background:rgba(255,255,255,.15);color:#fff}
.toolbar .primary{background:#fff;color:var(--primary)}
main{max-width:1100px;margin:24px auto 48px;padding:0 20px}
.hero{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;margin-bottom:16px}
.stat-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:12px}
.stat-chip{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:12px}
.stat-chip strong{display:block;font-size:20px;color:var(--primary)}
.category-block{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;margin-bottom:16px}
.category-block h2{margin:0 0 14px;font-size:18px}
.count{font-size:13px;color:#64748b;font-weight:700}
.action-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:12px;background:#fafbfc}
.action-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.pill{display:inline-block;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800}
.pill.priority{background:#fef3c7;color:#92400e}
.status{font-size:11px;font-weight:800;text-transform:uppercase;padding:4px 8px;border-radius:999px}
.status.complete{background:#dcfce7;color:#166534}
.status.progress{background:#dbeafe;color:#1d4ed8}
.status.pending{background:#f1f5f9;color:#64748b}
.status.deferred{background:#fce7f3;color:#9d174d}
.meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;font-size:13px;margin:10px 0}
.evidence{margin:8px 0 0;padding-left:18px;font-size:13px;color:#475569}
.action-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px}
.btn-sm{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px}
.status-select{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px}
.muted{color:#64748b;font-size:13px}
@media(max-width:900px){.stat-grid,.meta-grid{grid-template-columns:1fr}}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>Growth Action Plan</h1>
  <p>Prioritised next steps for ${esc(pharmacyName)} — ranked by impact, urgency and effort.</p>
  ${renderPharmacyPlatformNavBar({ slug: plan.slug, serviceId: PRIMARY_PLATFORM_SERVICE_ID, activeId: "growth-actions" })}
  <div class="toolbar" style="margin-top:10px">
    <button type="button" id="btn-refresh-plan" data-slug="${esc(plan.slug)}">Refresh Action Plan</button>
  </div>
</header>
<main>
  <section class="hero">
    <strong>${plan.totalActions} actions</strong> · Updated ${esc(plan.lastUpdated)}
    <div class="stat-grid">
      <div class="stat-chip"><strong>${plan.pendingActions}</strong> pending</div>
      <div class="stat-chip"><strong>${plan.inProgressActions}</strong> in progress</div>
      <div class="stat-chip"><strong>${plan.completeActions}</strong> complete</div>
      <div class="stat-chip"><strong>${plan.deferredActions}</strong> deferred</div>
      <div class="stat-chip"><strong>${plan.topPriorityActions.length}</strong> top priority</div>
    </div>
  </section>
  ${categoryBlocks || `<p class="muted">No actions generated yet. Click Refresh Action Plan.</p>`}
</main>
<script>
(function(){
  var refreshBtn = document.getElementById("btn-refresh-plan");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function(){
      var slug = refreshBtn.getAttribute("data-slug") || "pharmaconnect";
      refreshBtn.disabled = true;
      fetch("/api/pharmacy-growth-actions/" + slug + "/refresh", { method: "POST", headers: { "Accept": "application/json" } })
        .then(function(r){ return r.json(); })
        .then(function(data){ if (data.ok) window.location.reload(); else { alert(data.error || "Refresh failed"); refreshBtn.disabled = false; } })
        .catch(function(err){ alert(String(err)); refreshBtn.disabled = false; });
    });
  }
  document.querySelectorAll(".status-select").forEach(function(sel){
    sel.addEventListener("change", function(){
      var slug = sel.getAttribute("data-slug");
      var actionId = sel.getAttribute("data-action-id");
      fetch("/api/pharmacy-growth-actions/" + slug + "/" + actionId + "/status", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel.value })
      }).then(function(r){ return r.json(); }).then(function(data){
        if (!data.ok) alert(data.error || "Status update failed");
      }).catch(function(err){ alert(String(err)); });
    });
  });
})();
</script>
</body>
</html>`;
}

router.get("/pharmacy-growth-actions", (req, res) => {
  const slug = safeSlug(String(req.query.slug || "pharmaconnect"));
  try {
    let plan = readPharmacyGrowthActionPlan(slug);
    if (!plan) {
      plan = refreshPharmacyGrowthActionPlan(slug).plan;
    }
    const dash = buildGrowthJourneyDashboard(slug);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderGrowthActionPlanHtml(plan, dash.profile.pharmacyName, dash.profile.brandPrimaryColor));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Growth Action Plan error: ${esc(String(err))}</pre>`);
  }
});

export default router;
