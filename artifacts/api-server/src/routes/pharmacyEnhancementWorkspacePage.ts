/**
 * Campaign Improvements — guided optimisation workspace (UI/UX only).
 * Route: /api/pharmacy-enhancement-workspace?slug={slug}&service={serviceId}
 */
import { Router, type Request, type Response } from "express";
import {
  ENHANCEMENT_CATEGORY_LABELS,
  buildEnhancementWorkspaceView,
  type EnhancementWorkspaceTask,
} from "../../../../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import {
  buildCampaignImprovementsLocation,
  campaignImprovementsNeedsCanonicalRedirect,
  resolveCampaignImprovementsServiceForTenant,
} from "../../../../src/pharmacy/pharmacyCampaignImprovementsServiceAuthority.ts";
import { campaignImprovementsWorkflowNext } from "../../../../src/pharmacy/pharmacyCampaignImprovementsLaunchAuthority.ts";
import type { CampaignImprovementsLaunchAuthority } from "../../../../src/pharmacy/pharmacyCampaignImprovementsLaunchAuthority.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import {
  findNextCampaignAction,
  groupCampaignImprovements,
  plainEnglishBenefit,
  plainEnglishTitle,
  statusBadge,
  whatToDoText,
} from "../../../../src/pharmacy/pharmacyEnhancementWorkspaceUi.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function allTasks(view: ReturnType<typeof buildEnhancementWorkspaceView>): EnhancementWorkspaceTask[] {
  const b = view.board;
  return [...b.ready, ...b.inProgress, ...b.completed, ...b.deferred];
}

function whereButtonGoes(task: EnhancementWorkspaceTask): string {
  const label = task.primaryAction?.label || "the linked page";
  if (/profile/i.test(label)) return "Opens your Profile Dashboard to update pharmacy details.";
  if (/image/i.test(label)) return "Opens the Image Library to upload or assign photos.";
  if (/publish/i.test(label)) return "Opens Publishing Settings to confirm how your page goes live.";
  if (/campaign/i.test(label)) return "Opens Campaign OS to manage this campaign.";
  return `Takes you to: ${label}.`;
}

function renderImprovementCard(
  task: EnhancementWorkspaceTask,
  isRequired = false,
  launchAuthority?: CampaignImprovementsLaunchAuthority,
): string {
  const badge = statusBadge(task, launchAuthority);
  const title = plainEnglishTitle(task.title);
  const benefit = plainEnglishBenefit(task);
  const why = task.reason || "This step helps your campaign perform better for patients and search engines.";
  const todo = whatToDoText(task);
  const destination = whereButtonGoes(task);

  return `<article class="improvement-card status-${esc(task.status)} ${isRequired ? "is-required" : ""}" id="task-${esc(task.id)}" data-rec-id="${esc(task.id)}" data-service-id="${esc(task.serviceId)}">
  <div class="card-top">
    <span class="status-badge ${esc(badge.cls)}">${badge.icon} ${esc(badge.label)}</span>
    <h3 class="card-title">${esc(title)}</h3>
  </div>
  <div class="card-body">
    <div class="card-field"><span class="field-label">Why this matters</span><p>${esc(why)}</p></div>
    <div class="card-field"><span class="field-label">What you need to do</span><p>${esc(todo)}</p></div>
    ${isRequired ? `<div class="card-field"><span class="field-label">Where the button goes</span><p>${esc(destination)}</p></div>` : ""}
    <div class="card-field benefit"><span class="field-label">Estimated benefit</span><p>${esc(benefit)}</p></div>
  </div>
  <details class="card-details">
    <summary>Show Details</summary>
    <div class="details-inner">
      <p class="muted">${esc(task.serviceName)}</p>
      <p><strong>Category:</strong> ${esc(ENHANCEMENT_CATEGORY_LABELS[task.category])}</p>
      <p><strong>Difficulty:</strong> ${esc(task.difficulty)} · <strong>Impact:</strong> ${esc(task.estimatedImpact)}</p>
      <div class="score-chips">
        <span>Authority +${task.estimatedAuthorityGain}</span>
        <span>AI +${task.estimatedAiGain}</span>
        <span>Local +${task.estimatedVisibilityGain}</span>
      </div>
      ${task.evidence.length ? `<ul class="evidence">${task.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      ${task.completedAt ? `<p class="muted">Completed ${esc(new Date(task.completedAt).toLocaleString("en-GB"))}${task.beforeScore !== null ? ` · Score ${task.beforeScore}→${task.afterScore}` : ""}</p>` : ""}
    </div>
  </details>
  <div class="card-actions">
    <a class="btn btn-primary" href="${esc(task.primaryAction.url)}">${esc(task.primaryAction.label)}</a>
    ${task.status !== "completed" ? `<button type="button" class="btn btn-secondary btn-start" data-rec="${esc(task.id)}" data-service="${esc(task.serviceId)}">Start</button>` : ""}
    ${task.status !== "completed" ? `<button type="button" class="btn btn-complete" data-rec="${esc(task.id)}" data-service="${esc(task.serviceId)}">Mark complete</button>` : ""}
    ${task.status !== "deferred" && task.status !== "completed" ? `<button type="button" class="btn btn-muted btn-defer" data-rec="${esc(task.id)}" data-service="${esc(task.serviceId)}">Defer</button>` : ""}
    ${task.status === "completed" || task.status === "deferred" ? `<button type="button" class="btn btn-muted btn-reset" data-rec="${esc(task.id)}" data-service="${esc(task.serviceId)}">Move to ready</button>` : ""}
  </div>
</article>`;
}

function renderSection(
  id: string,
  title: string,
  tasks: EnhancementWorkspaceTask[],
  opts: {
    defaultLimit?: number;
    collapsed?: boolean;
    isRequired?: boolean;
    emptyMessage?: string;
    launchAuthority?: CampaignImprovementsLaunchAuthority;
  },
): string {
  const limit = opts.defaultLimit ?? tasks.length;
  const collapsed = opts.collapsed ?? false;
  const showToggle = tasks.length > limit;
  const visible = tasks.slice(0, limit);
  const hidden = tasks.slice(limit);
  const empty = tasks.length === 0;
  const card = (t: EnhancementWorkspaceTask) => renderImprovementCard(t, opts.isRequired, opts.launchAuthority);

  return `<section class="improvement-section ${collapsed ? "is-collapsed" : ""}" id="${esc(id)}" data-section="${esc(id)}">
  <div class="section-head">
    <h2>${esc(title)} <span class="section-count">${tasks.length}</span></h2>
    ${collapsed ? `<button type="button" class="section-toggle" data-target="${esc(id)}" aria-expanded="false">Show section</button>` : ""}
  </div>
  <div class="section-body ${collapsed ? "hidden" : ""}">
    ${empty ? `<p class="empty-msg">${esc(opts.emptyMessage || "No items in this section.")}</p>` : ""}
    ${!empty ? `<div class="card-grid" data-visible-count="${visible.length}">${visible.map(card).join("")}</div>` : ""}
    ${showToggle && !collapsed ? `<div class="card-grid card-grid-extra hidden" data-extra-for="${esc(id)}">${hidden.map(card).join("")}</div>` : ""}
    ${showToggle && !collapsed ? `<button type="button" class="show-more-btn" data-section="${esc(id)}">Show More (${hidden.length})</button>` : ""}
  </div>
</section>`;
}

export function renderEnhancementWorkspaceHtml(view: ReturnType<typeof buildEnhancementWorkspaceView>): string {
  const s = view.summary;
  const primary = view.brandPrimaryColor || "#1a5c42";
  const tasks = allTasks(view);
  const launchAuthority = view.launchAuthority;
  const groups = groupCampaignImprovements(tasks, launchAuthority);
  const nextAction = findNextCampaignAction(groups);
  const requiredActive = groups.requiredBeforeLaunch.filter((t) => t.status !== "completed");
  const quickActive = groups.quickWins.filter((t) => t.status !== "completed" && t.status !== "deferred");
  const highActive = groups.highImpact.filter((t) => t.status !== "completed" && t.status !== "deferred");
  const remaining = tasks.filter((t) => t.status !== "completed" && t.status !== "deferred").length;

  const serviceOptions = view.authoritativeServiceIds.map(
    (id) => `<option value="${esc(id)}" ${view.selectedServiceId === id ? "selected" : ""}>${esc(id.replace(/-/g, " "))}</option>`,
  ).join("");

  const categoryOptions = Object.entries(ENHANCEMENT_CATEGORY_LABELS)
    .map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`)
    .join("");

  const requiredEmpty =
    requiredActive.length === 0
      ? "No launch blockers remain. Your campaign is ready for publishing."
      : undefined;

  const workflowNext = campaignImprovementsWorkflowNext({
    livePublishReady: launchAuthority.livePublishReady,
    slug: view.slug,
    serviceId: view.selectedServiceId,
  });

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Campaign Improvements — ${esc(view.pharmacyName)}</title>
<style>
:root{--primary:${esc(primary)};--required:#dc2626;--done:#059669;--future:#64748b;--ready:#2563eb}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f4f6f9;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#0f172a,var(--primary));color:#fff;padding:24px 28px}
header h1{margin:0;font-size:26px;font-weight:800}
header .subtitle{margin:8px 0 0;color:#dbeafe;font-size:15px;max-width:640px}
main{max-width:1200px;margin:24px auto 48px;padding:0 20px}
.summary-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:20px}
@media(max-width:900px){.summary-strip{grid-template-columns:repeat(3,1fr)}}
@media(max-width:520px){.summary-strip{grid-template-columns:repeat(2,1fr)}}
.summary-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center}
.summary-card strong{display:block;font-size:28px;color:var(--primary);line-height:1.1}
.summary-card span{font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.03em}
.summary-card.required strong{color:var(--required)}
.summary-card.done strong{color:var(--done)}
.continue-wrap{margin-bottom:24px;text-align:center}
.btn-continue{background:var(--primary);color:#fff;border:0;border-radius:10px;padding:14px 28px;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.12)}
.btn-continue:hover{filter:brightness(1.05)}
.improvement-section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;margin-bottom:18px}
.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
.section-head h2{margin:0;font-size:18px;font-weight:800}
.section-count{background:#f1f5f9;color:#475569;border-radius:999px;padding:2px 10px;font-size:13px;font-weight:700}
.card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}
@media(max-width:960px){.card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.card-grid{grid-template-columns:1fr}}
.improvement-card{display:flex;flex-direction:column;background:#fafbfc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;height:100%;min-height:280px}
.improvement-card.is-required{border-color:#fecaca;background:#fffbfb}
.improvement-card.status-completed{opacity:.92;border-color:#a7f3d0}
.improvement-card.highlight{box-shadow:0 0 0 3px var(--primary);animation:pulse 1.2s ease 2}
@keyframes pulse{50%{box-shadow:0 0 0 6px rgba(26,92,66,.25)}}
.card-top{margin-bottom:10px}
.card-title{margin:8px 0 0;font-size:16px;font-weight:800;line-height:1.3}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase}
.status-badge.required{background:#fee2e2;color:#991b1b}
.status-badge.done{background:#d1fae5;color:#065f46}
.status-badge.future{background:#f1f5f9;color:#64748b}
.status-badge.ready{background:#dbeafe;color:#1e40af}
.status-badge.progress{background:#fef3c7;color:#92400e}
.card-body{flex:1;font-size:13px}
.field-label{display:block;font-size:10px;text-transform:uppercase;font-weight:700;color:#64748b;margin-bottom:2px;letter-spacing:.04em}
.card-field{margin-bottom:10px}
.card-field p{margin:0;color:#334155}
.card-details{margin:8px 0;font-size:12px}
.card-details summary{cursor:pointer;color:var(--primary);font-weight:700;list-style:none}
.card-details summary::-webkit-details-marker{display:none}
.details-inner{margin-top:8px;padding-top:8px;border-top:1px dashed #e2e8f0}
.score-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.score-chips span{background:#f1f5f9;padding:2px 8px;border-radius:999px;font-size:11px;color:#64748b}
.evidence{margin:8px 0;padding-left:18px;color:#64748b}
.card-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:12px;border-top:1px solid #e2e8f0}
.btn{border:0;border-radius:8px;padding:8px 12px;font-weight:700;font-size:12px;cursor:pointer;text-decoration:none;display:inline-block}
.btn-primary{background:var(--primary);color:#fff}
.btn-secondary{background:#e0e7ff;color:#3730a3}
.btn-complete{background:#059669;color:#fff}
.btn-muted{background:#f1f5f9;color:#475569}
.show-more-btn,.section-toggle{margin-top:12px;background:transparent;border:1px solid #cbd5e1;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;color:#475569}
.hidden{display:none!important}
.empty-msg{color:#64748b;font-size:14px;padding:12px 0;margin:0}
.advanced-filters{background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:18px}
.advanced-filters summary{padding:14px 22px;font-weight:700;cursor:pointer;color:#475569;list-style:none}
.advanced-filters summary::-webkit-details-marker{display:none}
.filter-body{padding:0 22px 18px;display:flex;flex-wrap:wrap;gap:14px;align-items:end}
.filter-body select{padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px}
.filter-body label{display:block;font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px;text-transform:uppercase}
.muted{color:#64748b;font-size:12px}
#toast{position:fixed;bottom:20px;right:20px;background:#0f172a;color:#fff;padding:12px 16px;border-radius:8px;display:none;font-size:13px;z-index:99}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>Campaign Improvements</h1>
  <p class="subtitle">${esc(view.selectedServiceName || "Campaign")} improvements for ${esc(view.pharmacyName)}.</p>
  <p class="muted" style="color:#94a3b8;margin-top:6px;font-size:13px" data-campaign-service="${esc(view.selectedServiceId || "")}" data-service-source="${esc(view.serviceSource)}" data-visual-page="${view.visualPageRecognised ? "recognised" : "missing"}" data-publish-gate="${esc(launchAuthority.publishGate)}" data-live-publish-ready="${launchAuthority.livePublishReady ? "true" : "false"}" data-authority-score="${esc(launchAuthority.overallScore)}">${esc(view.pharmacyName)}${view.selectedServiceName ? ` · ${esc(view.selectedServiceName)}` : ""} · ${esc(launchAuthority.overallScore)}/100 ${esc(launchAuthority.publishGate.replace(/_/g, " "))}</p>
  ${renderPharmacyPlatformNavBar({ slug: view.slug, serviceId: view.selectedServiceId || undefined, activeId: "enhancement" })}
</header>
<main>
${renderPlatformWorkflowBar({ slug: view.slug, nextStepUrl: workflowNext.nextStepUrl, nextStepLabel: workflowNext.nextStepLabel })}
  <div class="summary-strip">
    <div class="summary-card required"><strong>${requiredActive.length}</strong><span>Required Before Launch</span></div>
    <div class="summary-card"><strong>${quickActive.length}</strong><span>Quick Wins</span></div>
    <div class="summary-card"><strong>${highActive.length}</strong><span>High Impact</span></div>
    <div class="summary-card done"><strong>${groups.completed.length}</strong><span>Completed</span></div>
    <div class="summary-card"><strong>${remaining}</strong><span>Remaining</span></div>
    <div class="summary-card"><strong>${s.potentialAuthorityScore}</strong><span>Potential Score</span></div>
  </div>
  <div class="continue-wrap">
    <button type="button" class="btn-continue" id="btn-continue-next"${nextAction ? ` data-next-id="task-${esc(nextAction.id)}"` : " disabled"}>Continue Next Action</button>
  </div>

  ${renderSection("required-before-launch", "Required Before Launch", groups.requiredBeforeLaunch, {
    isRequired: true,
    emptyMessage: requiredEmpty,
    launchAuthority,
  })}
  ${renderSection("quick-wins", "Quick Wins", groups.quickWins, { defaultLimit: 6, launchAuthority })}
  ${renderSection("high-impact", "High Impact Improvements", groups.highImpact, { defaultLimit: 6, launchAuthority })}
  ${renderSection("future-improvements", "Future Improvements", groups.future, { collapsed: true, launchAuthority })}
  ${renderSection("completed", "Completed", groups.completed, { collapsed: true, launchAuthority })}
  ${renderSection("deferred", "Deferred", groups.deferred, { collapsed: true, launchAuthority })}

  <details class="advanced-filters">
    <summary>Advanced Filters</summary>
    <div class="filter-body">
      <form method="get" style="display:flex;flex-wrap:wrap;gap:14px;align-items:end;width:100%">
        <input type="hidden" name="slug" value="${esc(view.slug)}"/>
        <div><label>Service</label><select name="service">${serviceOptions}</select></div>
        <div><label>Category</label><select name="category" id="filter-category"><option value="">All categories</option>${categoryOptions}</select></div>
        <div><label>Difficulty</label><select name="difficulty" id="filter-difficulty"><option value="">All</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Advanced">Advanced</option></select></div>
        <div><label>Impact</label><select name="impact" id="filter-impact"><option value="">All</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
        <button type="submit" class="btn btn-primary">Apply filters</button>
      </form>
    </div>
  </details>
</main>
<div id="toast"></div>
<script>
const SLUG = ${JSON.stringify(view.slug)};

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function postStatus(recId, status, serviceId) {
  const res = await fetch('/api/pharmacy-enhancement-workspace/' + SLUG + '/tasks/' + encodeURIComponent(recId) + '/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ status, serviceId, completedBy: 'pharmacy-owner' })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function markComplete(recId, serviceId) {
  const res = await fetch('/api/pharmacy-enhancement-workspace/' + SLUG + '/tasks/' + encodeURIComponent(recId) + '/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ serviceId, completedBy: 'pharmacy-owner' })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

document.querySelectorAll('.btn-start').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await postStatus(btn.dataset.rec, 'in_progress', btn.dataset.service);
      toast('Started');
      location.reload();
    } catch (e) { toast(String(e.message || e)); }
  });
});

document.querySelectorAll('.btn-complete').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      const data = await markComplete(btn.dataset.rec, btn.dataset.service);
      toast(data.message || 'Marked complete');
      location.reload();
    } catch (e) { toast(String(e.message || e)); }
  });
});

document.querySelectorAll('.btn-defer').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await postStatus(btn.dataset.rec, 'deferred', btn.dataset.service);
      toast('Deferred for later');
      location.reload();
    } catch (e) { toast(String(e.message || e)); }
  });
});

document.querySelectorAll('.btn-reset').forEach(btn => {
  btn.addEventListener('click', async () => {
    try {
      await postStatus(btn.dataset.rec, 'ready', btn.dataset.service);
      toast('Moved back to ready');
      location.reload();
    } catch (e) { toast(String(e.message || e)); }
  });
});

document.querySelectorAll('.show-more-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sectionId = btn.dataset.section;
    const extra = document.querySelector('.card-grid-extra[data-extra-for="' + sectionId + '"]');
    if (!extra) return;
    const hidden = extra.classList.contains('hidden');
    extra.classList.toggle('hidden', !hidden);
    btn.textContent = hidden ? 'Show Less' : 'Show More (' + extra.querySelectorAll('.improvement-card').length + ')';
  });
});

document.querySelectorAll('.section-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = document.getElementById(btn.dataset.target);
    if (!section) return;
    const body = section.querySelector('.section-body');
    const collapsed = body.classList.toggle('hidden');
    btn.textContent = collapsed ? 'Show section' : 'Hide section';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });
});

document.getElementById('btn-continue-next')?.addEventListener('click', () => {
  const id = document.getElementById('btn-continue-next')?.dataset.nextId;
  if (!id) return;
  const card = document.getElementById(id);
  if (!card) return;
  const section = card.closest('.improvement-section');
  if (section) {
    const body = section.querySelector('.section-body');
    body?.classList.remove('hidden');
    const toggle = section.querySelector('.section-toggle');
    if (toggle) { toggle.textContent = 'Hide section'; toggle.setAttribute('aria-expanded', 'true'); }
    const extra = section.querySelector('.card-grid-extra');
    if (extra) extra.classList.remove('hidden');
    const showMore = section.querySelector('.show-more-btn');
    if (showMore) showMore.textContent = 'Show Less';
  }
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('highlight');
  setTimeout(() => card.classList.remove('highlight'), 3000);
  const primaryBtn = card.querySelector('.btn-primary');
  if (primaryBtn) primaryBtn.focus();
});
</script>
</body>
</html>`;
}

function handlePage(req: Request, res: Response): void {
  try {
    const slug = String(req.query.slug || "pharmaconnect");
    const requested = req.query.service ? String(req.query.service) : null;
    const resolved = resolveCampaignImprovementsServiceForTenant(slug, requested);
    if (campaignImprovementsNeedsCanonicalRedirect(requested, resolved.resolvedServiceId)) {
      res.redirect(302, buildCampaignImprovementsLocation(slug, resolved.resolvedServiceId!, req.query as Record<string, unknown>));
      return;
    }
    const view = buildEnhancementWorkspaceView(slug, { serviceId: resolved.resolvedServiceId });
    res.type("html").send(renderEnhancementWorkspaceHtml(view));
  } catch (err) {
    res.status(500).type("text/plain").send(String(err));
  }
}

router.get("/pharmacy-enhancement-workspace", handlePage);

export default router;
