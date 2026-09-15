/**
 * PharmaConnect Platform Dashboard — asset-first customer journey V1.
 */
import { Router } from "express";
import {
  buildPharmacyPlatformDashboard,
  PRIMARY_PLATFORM_SERVICE_ID,
  type PharmacyPlatformDashboard,
  type PlatformOsStepState,
} from "../../../../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { buildCustomerExperienceView } from "../../../../src/pharmacy/pharmacyCustomerExperienceService.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { verifyPharmacyWorkspaceReady } from "../../../../src/pharmacy/pharmacyWorkspaceProvisionService.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";

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

function stepStatusLabel(status: PlatformOsStepState["status"]): string {
  if (status === "COMPLETE") return "Complete";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "BLOCKED") return "Blocked";
  if (status === "WAITING") return "Waiting";
  if (status === "READY") return "Ready";
  return "Locked";
}

function renderWorkflowStep(step: PlatformOsStepState, currentId: string | undefined): string {
  const isCurrent = step.id === currentId;
  const cls = [
    "workflow-step",
    `status-${step.status.toLowerCase().replace(/_/g, "-")}`,
    step.locked ? "is-locked" : "",
    isCurrent ? "is-current" : "",
    step.status === "COMPLETE" ? "is-complete" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const link = step.locked ? "#" : step.url;
  return `<li class="${cls}">
  <a href="${esc(link)}" ${step.locked ? 'aria-disabled="true"' : ""}>
    <span class="step-num">${step.stepNumber}</span>
    <span class="step-title">${esc(step.title)}</span>
    <span class="step-status">${esc(stepStatusLabel(step.status))}</span>
    ${isCurrent ? '<span class="step-current-badge">Current Step</span>' : ""}
  </a>
  ${step.lockReason && step.locked ? `<p class="step-lock">${esc(step.lockReason)}</p>` : ""}
</li>`;
}

export function renderPharmacyPlatformDashboardHtml(d: PharmacyPlatformDashboard): string {
  const cx = buildCustomerExperienceView(d);
  const os = d.operatingSystem;
  const current = os.currentStep || os.nextStep;
  const nextUrl = os.nextStep?.url || d.nextAction.url;
  const profileDone = os.steps.find((s) => s.id === "create-profile")?.status === "COMPLETE";

  const logo = d.identity.logoUrl
    ? `<img src="${esc(d.identity.logoUrl)}" alt="" class="profile-logo">`
    : `<div class="profile-logo-fallback">${esc((d.identity.pharmacyName || "P").charAt(0))}</div>`;

  const stepsHtml = os.steps.map((s) => renderWorkflowStep(s, current?.id)).join("");

  const assetPanel = d.currentCampaign
    ? `<p><strong>${esc(d.currentCampaign.serviceName)}</strong>${d.currentCampaign.name ? ` · ${esc(d.currentCampaign.name)}` : ""}</p>`
    : `<p class="muted">No service asset started yet — choose your first service and area in Step 2.</p>`;

  const advancedTools = cx.advancedTools.map((t) => `<a class="tool-link" href="${esc(t.url)}">${esc(t.label)}</a>`).join("");

  const perfSection = os.hideGrowthMetrics
    ? ""
    : `<section class="panel" id="performance">
  <h2>Track Results</h2>
  <p class="muted">How your pharmacy is performing online.</p>
  <div class="perf-grid">
    <div class="perf-card"><span class="perf-label">Search Visibility</span><strong>${cx.performanceSummary.visibilityScore}</strong></div>
    <div class="perf-card"><span class="perf-label">Indexed</span><strong>${esc(cx.performanceSummary.indexedLabel)}</strong></div>
    <div class="perf-card"><span class="perf-label">Improvements</span><strong>${cx.performanceSummary.pendingImprovements}</strong></div>
  </div>
</section>`;

  const welcomeSection = os.hideGrowthMetrics
    ? `<section class="panel welcome-simple">
  <h2>Create your first service page</h2>
  <p class="welcome-lead">We guide you step by step. Complete each stage below — we handle the technical work.</p>
  ${profileDone ? `<p class="status-ok">✓ Profile Complete</p>` : `<p class="muted">Start with Step 1 — Create Profile.</p>`}
</section>`
    : "";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(os.assetPhaseLabel)} — ${esc(d.identity.pharmacyName)}</title>
<style>
:root{--primary:${esc(d.brandPrimaryColor)};--secondary:${esc(d.brandSecondaryColor)}}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f4f6f9;color:#0f172a;line-height:1.55}
header{background:linear-gradient(135deg,var(--secondary),var(--primary));color:#fff;padding:24px 28px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header .sub{margin:8px 0 0;color:#dbeafe;font-size:15px;max-width:680px}
.identity{display:flex;gap:16px;align-items:center;margin-top:16px}
.profile-logo,.profile-logo-fallback{width:52px;height:52px;border-radius:12px;background:#fff;object-fit:contain}
.profile-logo-fallback{display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--primary);font-size:22px}
.identity-meta{font-size:14px;color:#e2e8f0}
main{max-width:960px;margin:24px auto 48px;padding:0 20px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px 26px;margin-bottom:18px}
.panel h2{margin:0 0 12px;font-size:20px;font-weight:800}
.muted{color:#64748b;font-size:14px}
.welcome-lead{font-size:16px;color:#334155;margin:0 0 12px}
.status-ok{color:#059669;font-weight:700;margin:8px 0 0}
.workflow-steps{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
.workflow-step{border:1px solid #e2e8f0;border-radius:12px;background:#fafbfc;overflow:hidden}
.workflow-step a{display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;padding:14px 16px;text-decoration:none;color:inherit}
.workflow-step.is-current{border-color:var(--primary);box-shadow:0 0 0 2px rgba(0,94,184,.12);background:#eff6ff}
.workflow-step.is-locked{opacity:.72}
.workflow-step.is-complete{border-color:#a7f3d0;background:#f0fdf4}
.step-num{width:32px;height:32px;border-radius:999px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
.is-current .step-num{background:var(--primary);color:#fff}
.is-complete .step-num{background:#059669;color:#fff}
.step-title{font-weight:800;font-size:15px}
.step-status{font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b}
.step-current-badge{grid-column:2/4;font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase}
.step-lock{margin:0;padding:0 16px 12px 62px;font-size:12px;color:#64748b}
.hero-cta{text-align:center;margin-top:18px}
.btn-primary{display:inline-block;background:var(--primary);color:#fff;padding:12px 22px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;border:0}
details.advanced{border:1px solid #e2e8f0;border-radius:14px;background:#fff;margin-bottom:18px}
details.advanced summary{padding:16px 22px;font-weight:800;cursor:pointer;color:#475569;list-style:none}
details.advanced summary::-webkit-details-marker{display:none}
.tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 22px 20px}
.tool-link{display:block;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:var(--primary);font-weight:700;font-size:13px;background:#f8fafc}
.progress-bar{height:10px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin:10px 0}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--primary),#059669)}
.perf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.perf-card{border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc}
.perf-label{display:block;font-size:11px;text-transform:uppercase;font-weight:700;color:#64748b}
.perf-card strong{font-size:22px;color:var(--primary)}
@media(max-width:720px){.tool-grid,.perf-grid{grid-template-columns:1fr}}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>${esc(os.assetPhaseLabel)}</h1>
  <p class="sub">${esc(d.setupHeadline)}</p>
  <div class="identity">
    ${logo}
    <div>
      <strong style="font-size:17px">${esc(d.identity.pharmacyName)}</strong>
      <div class="identity-meta">${esc(d.identity.town)}</div>
    </div>
  </div>
  ${renderPharmacyPlatformNavBar({
    slug: d.slug,
    serviceId: os.currentCampaignServiceId || PRIMARY_PLATFORM_SERVICE_ID,
    activeId: "platform-dashboard",
  })}
</header>
<main>
  ${welcomeSection}

  <section class="panel" id="workflow">
    <h2>Your journey</h2>
    <p class="muted">All 9 steps — complete them in order. Only one step is active at a time.</p>
    <p><strong>Progress:</strong> ${os.overallCompletionPct}%</p>
    <div class="progress-bar"><div class="progress-fill" style="width:${os.overallCompletionPct}%"></div></div>
    <ol class="workflow-steps">${stepsHtml}</ol>
    <div class="hero-cta">
      <a class="btn-primary" href="${esc(nextUrl)}">${current ? `Continue: ${esc(current.title)}` : "Continue Next Step"}</a>
    </div>
  </section>

  <section class="panel" id="current-asset">
    <h2>Current Service Asset</h2>
    ${assetPanel}
  </section>

  ${perfSection}

  <details class="advanced">
    <summary>Advanced Tools</summary>
    <p class="muted" style="padding:0 22px 12px">Indexing, rankings, authority scores and reports — available when you need them.</p>
    <div class="tool-grid">${advancedTools}</div>
  </details>
</main>
</body>
</html>`;
}

function renderWorkspaceProvisioningFailedHtml(
  slug: string,
  verification: ReturnType<typeof verifyPharmacyWorkspaceReady>,
  errMessage: string,
): string {
  const failed = verification.checks.filter((c) => !c.pass);
  const rows = failed
    .map(
      (c) =>
        `<tr><td><strong>${esc(c.resource)}</strong></td><td>${esc(c.reason || "Missing or invalid")}</td><td>${esc(c.recovery || "Contact support.")}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Setup failed</title></head><body style="font-family:system-ui;max-width:720px;margin:48px auto;padding:0 20px">
<h1>Workspace setup failed</h1><p>${esc(errMessage)}</p>
${failed.length ? `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">${rows}</table>` : ""}
</body></html>`;
}

router.get("/pharmacy-dashboard", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  try {
    const dashboard = buildPharmacyPlatformDashboard(slug);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(renderPharmacyPlatformDashboardHtml(dashboard));
  } catch (err) {
    const verification = verifyPharmacyWorkspaceReady(slug);
    res.status(503);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderWorkspaceProvisioningFailedHtml(slug, verification, String(err)));
  }
});

export default router;
