/**
 * Pharmacy Campaign Launch Queue V1 — full launch checklist HTML page.
 */
import { Router } from "express";
import { loadPharmacyProfile } from "../../../../src/pharmacy/pharmacyContentBlueprintService.ts";
import {
  refreshPharmacyCampaignLaunchQueue,
  type CampaignLaunchQueueEntry,
  type CampaignLaunchTask,
  type LaunchTaskCategory,
} from "../../../../src/pharmacy/pharmacyCampaignLaunchQueueService.ts";
import { readPharmacyCampaignStore } from "../../../../src/pharmacy/pharmacyCampaignService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function safeSlug(v: string): string {
  return (
    String(v || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function statusClass(status: string): string {
  if (status === "complete") return "status complete";
  if (status === "in_progress") return "status progress";
  if (status === "blocked") return "status blocked";
  return "status pending";
}

function renderTaskCard(task: CampaignLaunchTask, slug: string, hideManualControls = false): string {
  return `<article class="task-card" data-task-id="${esc(task.id)}">
  <div class="task-top">
    <strong>${esc(task.title)}</strong>
    <span class="pill">${esc(task.category)}</span>
    <span class="pill priority">${esc(task.priority)}</span>
    <span class="${statusClass(task.status)}">${esc(task.status.replace("_", " "))}</span>
  </div>
  ${task.blockedReason ? `<p class="blocked">${esc(task.blockedReason)}</p>` : ""}
  ${task.evidence.length ? `<ul class="evidence">${task.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
  <div class="task-foot">
    <a class="btn-sm" href="${esc(task.linkedUrl)}">${esc(task.linkedModule)} →</a>
    ${hideManualControls ? "" : `<select class="status-select" data-slug="${esc(slug)}" data-task-id="${esc(task.id)}" aria-label="Update task status">
      <option value="pending" ${task.status === "pending" ? "selected" : ""}>Pending</option>
      <option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>In progress</option>
      <option value="complete" ${task.status === "complete" ? "selected" : ""}>Complete</option>
      <option value="blocked" ${task.status === "blocked" ? "selected" : ""}>Blocked</option>
    </select>
    <button type="button" class="btn-sm alt btn-complete" data-slug="${esc(slug)}" data-task-id="${esc(task.id)}">Mark complete</button>`}
  </div>
</article>`;
}

function renderCategoryGroup(
  category: LaunchTaskCategory,
  tasks: CampaignLaunchTask[],
  slug: string,
  hideManualControls = false,
): string {
  if (!tasks.length) return "";
  return `<section class="category-block">
  <h2>${esc(category)} <span class="count">${tasks.length}</span></h2>
  ${tasks.map((t) => renderTaskCard(t, slug, hideManualControls)).join("")}
</section>`;
}

export function renderCampaignLaunchQueueHtml(
  slug: string,
  pharmacyName: string,
  brandPrimary: string,
  queue: CampaignLaunchQueueEntry | null,
  campaigns: Array<{ id: string; name: string }>,
  selectedCampaignId: string,
): string {
  const categories = ["Profile", "Content", "Publishing", "Indexing", "Visibility", "Promotion", "Growth"] as LaunchTaskCategory[];
  const hideManualControls = Boolean(queue?.candidatePublish);
  const categoryBlocks = queue
    ? categories
        .map((c) => renderCategoryGroup(c, queue.tasks.filter((t) => t.category === c), slug, hideManualControls))
        .join("")
    : "";

  const campaignOptions = campaigns
    .map(
      (c) =>
        `<option value="${esc(c.id)}" ${c.id === selectedCampaignId ? "selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Campaign Launch Queue — ${esc(pharmacyName)}</title>
<style>
:root{--primary:${esc(brandPrimary)}}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#003087,var(--primary));color:#fff;padding:24px 28px}
header h1{margin:0;font-size:26px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:center}
.toolbar a,.toolbar button{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;text-decoration:none;cursor:pointer;background:rgba(255,255,255,.15);color:#fff}
.toolbar .primary{background:#fff;color:var(--primary)}
.toolbar select{border:0;border-radius:8px;padding:9px 12px;font-size:13px;font-weight:700}
main{max-width:1100px;margin:24px auto 48px;padding:0 20px}
.hero{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 24px;margin-bottom:16px}
.stat-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:12px}
.stat-chip{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:12px}
.stat-chip strong{display:block;font-size:20px;color:var(--primary)}
.category-block{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;margin-bottom:16px}
.category-block h2{margin:0 0 14px;font-size:18px}
.count{font-size:13px;color:#64748b;font-weight:700}
.task-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:12px;background:#fafbfc}
.task-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.pill{display:inline-block;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:800}
.pill.priority{background:#fef3c7;color:#92400e}
.status{font-size:11px;font-weight:800;text-transform:uppercase;padding:4px 8px;border-radius:999px}
.status.complete{background:#dcfce7;color:#166534}
.status.progress{background:#dbeafe;color:#1d4ed8}
.status.pending{background:#f1f5f9;color:#64748b}
.status.blocked{background:#fee2e2;color:#b91c1c}
.blocked{color:#b91c1c;font-size:13px;margin:0 0 8px}
.evidence{margin:8px 0 0;padding-left:18px;font-size:13px;color:#475569}
.task-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px}
.btn-sm,.btn{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px;border:0;cursor:pointer}
.btn-sm.alt{background:#475569}
.status-select{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px}
.candidate-ready{background:#ecfdf5;border:1px solid #86efac;border-radius:14px;padding:18px 20px;margin-bottom:16px}
.candidate-ready h2{margin:0 0 8px;font-size:20px}
.candidate-ready .ready-badge{display:inline-block;background:#dcfce7;color:#166534;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800;margin-bottom:10px}
.toolbar .primary[aria-disabled="true"]{opacity:.45;pointer-events:none}
.muted{color:#64748b;font-size:13px}
@media(max-width:900px){.stat-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <h1>Campaign Launch Queue</h1>
  <p>Operational checklist from campaign creation through publishing, indexing, visibility and promotion.</p>
  <div class="toolbar">
    <a class="primary" href="/api/pharmacy-campaigns?slug=${esc(slug)}">Campaign Dashboard</a>
    <a href="/api/pharmacy-growth-dashboard?slug=${esc(slug)}">Growth Journey</a>
    ${queue?.candidatePublish
      ? `<a class="primary" id="candidate-publish-control" href="${esc(queue.candidatePublish.publishUrl)}"${queue.candidatePublish.ready && !queue.candidatePublish.published ? "" : ' aria-disabled="true"'}>Publish</a>`
      : ""}
    <select id="campaign-selector" aria-label="Select campaign">${campaignOptions}</select>
    <button type="button" id="btn-refresh-queue" data-slug="${esc(slug)}">Refresh Queue</button>
  </div>
</header>
<main>
  <section class="hero">
    <strong>${queue ? esc(queue.serviceName) : "No campaign selected"}</strong>
    ${queue ? `<div class="stat-grid">
      <div class="stat-chip"><strong>${queue.totalTasks}</strong> total tasks</div>
      <div class="stat-chip"><strong>${queue.completeTasks}</strong> complete</div>
      <div class="stat-chip"><strong>${queue.blockedTasks}</strong> blocked</div>
      <div class="stat-chip"><strong>${queue.progressPct}%</strong> progress</div>
      <div class="stat-chip"><strong>${queue.nextLaunchTask ? esc(queue.nextLaunchTask.title) : "All done"}</strong> next task</div>
    </div>` : `<p class="muted">Select a campaign or create one from the Campaign Dashboard.</p>`}
  </section>
  ${queue?.candidatePublish ? `<section class="candidate-ready" data-candidate-publish="${queue.candidatePublish.ready ? "ready" : "not-ready"}">
    <span class="ready-badge">${queue.candidatePublish.ready ? "Ready" : "Not ready"}</span>
    <h2>Approved current-run candidates</h2>
    <p>${queue.candidatePublish.approvedCount} of ${queue.candidatePublish.expectedCount} approved ${esc(queue.candidatePublish.candidateVersion || "current")} candidates recognised as the pages ready to publish.</p>
    ${queue.candidatePublish.ready && !queue.candidatePublish.published
      ? `<p><a class="btn" id="candidate-publish-btn" href="${esc(queue.candidatePublish.publishUrl)}">Publish</a></p>`
      : queue.candidatePublish.published
        ? `<p class="muted">Already published through the configured publishing connection.</p>`
        : `<p class="muted">Approve remaining current-run candidates before publishing.</p>`}
  </section>` : ""}
  ${categoryBlocks || `<p class="muted">No launch tasks yet. Refresh the queue after creating a campaign.</p>`}
</main>
<script>
(function(){
  var refreshBtn = document.getElementById("btn-refresh-queue");
  var selector = document.getElementById("campaign-selector");
  if (selector) {
    selector.addEventListener("change", function(){
      window.location.href = "/api/pharmacy-campaign-launch-queue?slug=${esc(slug)}&campaignId=" + encodeURIComponent(selector.value);
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function(){
      var slug = refreshBtn.getAttribute("data-slug") || "pharmaconnect";
      refreshBtn.disabled = true;
      fetch("/api/pharmacy-campaign-launch-queue/" + slug + "/refresh", { method: "POST", headers: { "Accept": "application/json" } })
        .then(function(r){ return r.json(); })
        .then(function(data){ if (data.ok) window.location.reload(); else { alert(data.error || "Refresh failed"); refreshBtn.disabled = false; } })
        .catch(function(err){ alert(String(err)); refreshBtn.disabled = false; });
    });
  }
  document.querySelectorAll(".status-select").forEach(function(sel){
    sel.addEventListener("change", function(){
      fetch("/api/pharmacy-campaign-launch-queue/" + sel.getAttribute("data-slug") + "/" + sel.getAttribute("data-task-id") + "/status", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel.value })
      }).then(function(r){ return r.json(); }).then(function(data){ if (!data.ok) alert(data.error || "Status update failed"); });
    });
  });
  document.querySelectorAll(".btn-complete").forEach(function(btn){
    btn.addEventListener("click", function(){
      fetch("/api/pharmacy-campaign-launch-queue/" + btn.getAttribute("data-slug") + "/" + btn.getAttribute("data-task-id") + "/status", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ status: "complete" })
      }).then(function(r){ return r.json(); }).then(function(data){ if (data.ok) window.location.reload(); else alert(data.error || "Update failed"); });
    });
  });
})();
</script>
</body>
</html>`;
}

router.get("/pharmacy-campaign-launch-queue", (req, res) => {
  const slug = safeSlug(String(req.query.slug || "pharmaconnect"));
  const selectedCampaignId = String(req.query.campaignId || "");
  const selectedService = String(req.query.service || "").trim().toLowerCase();
  try {
    const profile = loadPharmacyProfile(slug);
    const data = (profile.data || {}) as Record<string, unknown>;
    const pharmacyName = String(data.pharmacyName || "Pharmacy");
    const brandPrimary = String(data.brandPrimaryColor || "#003087");
    const queueStore = refreshPharmacyCampaignLaunchQueue(slug).store;
    const campaignStore = readPharmacyCampaignStore(slug);
    const campaigns = (campaignStore?.campaigns || [])
      .filter((c) => c.status === "active")
      .map((c) => ({ id: c.id, name: c.name, serviceId: c.serviceId }));
    const campaignId =
      selectedCampaignId ||
      (selectedService
        ? campaigns.find((c) => c.serviceId === selectedService || c.id === selectedService)?.id || ""
        : "") ||
      campaigns[0]?.id ||
      "";
    const queue =
      queueStore.campaigns.find((c) => c.campaignId === campaignId || c.serviceId === selectedService) ||
      queueStore.campaigns[0] ||
      null;
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderCampaignLaunchQueueHtml(slug, pharmacyName, brandPrimary, queue, campaigns, campaignId || queue?.campaignId || ""));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Launch queue error: ${esc(String(err))}</pre>`);
  }
});

export default router;
