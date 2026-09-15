/**
 * Publishing Settings — canonical, noindex, structured data (placeholder flag) per service.
 */
import { Router } from "express";
import {
  getServicePublishingSettings,
  loadPharmacyPublishingSettings,
  saveServicePublishingSettings,
} from "../../../../src/pharmacy/pharmacyPublishingSettingsService.ts";
import { refreshPlatformAfterEnhancementComplete } from "../../../../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { getServiceAuthorityAudit } from "../../../../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { getServicePublishMeta } from "../../../../src/pharmacy/pharmacyMasterPublishConfig.ts";
import { buildPharmacyServicePageProfile } from "../../../../src/pharmacy/pharmacyServicePageProfileContext.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBarLight,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { getPharmacyLivePublishStatus } from "../../../../src/pharmacy/pharmacyLivePublishService.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "../../../../src/pharmacy/pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
import { resolveAuthoritativePublicationCanonical } from "../../../../src/pharmacy/pharmacyPublicationCanonicalAuthority.ts";

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

export function renderPharmacyPublishingSettingsPage(slug: string, serviceId: string): string {
  return renderPage(slug, serviceId);
}

function renderPage(slug: string, serviceId: string): string {
  const s = safeSlug(slug);
  const settings = getServicePublishingSettings(s, serviceId);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || serviceId;
  const pageProfile = buildPharmacyServicePageProfile(s);
  const audit = getServiceAuthorityAudit(s, serviceId);
  const canonicalAuthority = resolveAuthoritativePublicationCanonical({
    slug: s,
    serviceId,
    storedCanonicalUrl: settings?.canonicalUrl,
    profileWebsite: pageProfile.website,
  });
  const defaultCanonical = canonicalAuthority.canonicalUrl;
  const os = buildPlatformOperatingSystem(s);
  const livePub = getPharmacyLivePublishStatus(s);
  const candidates = resolveApprovedCurrentRunCandidatePublishReadiness(s, serviceId);
  const pubConnected = livePub.ftpConfigured && livePub.ftpCredentialsPresent;
  const candidateReady = Boolean(candidates?.ready && !candidates.published);
  const publishEnabled = pubConnected && (candidateReady || livePub.staticOutputReady);
  const pubStatusLabel = !pubConnected
    ? "Publishing not configured"
    : livePub.lastPublishedAt && !candidateReady
      ? "Published live"
      : candidateReady
        ? "Ready"
        : livePub.staticOutputReady
          ? "Ready to publish"
          : "Prepare publish output";
  const pubBadgeClass = publishEnabled && (candidateReady || livePub.staticOutputReady) ? "ready" : pubConnected ? "warn" : "off";

  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Publishing Settings — ${esc(serviceName)}</title>
<style>
body{font-family:Inter,Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#0f172a;background:#f8fafc}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:16px}
h1{margin:0 0 8px;font-size:1.5rem}
.lead{color:#64748b;margin:0 0 20px}
.field{margin-bottom:16px}
.field label{display:block;font-weight:600;margin-bottom:6px}
.field input[type=text],.field input[type=url]{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box}
.check-row{display:flex;align-items:center;gap:8px;font-weight:500}
.hint{font-size:.85rem;color:#64748b;margin-top:4px;display:block}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#dbeafe;color:#1e40af}
.badge.fail{background:#fee2e2;color:#991b1b}
.badge.pass{background:#d1fae5;color:#065f46}
.badge.warn{background:#fef3c7;color:#92400e}
.btn{display:inline-block;background:#005eb8;color:#fff;padding:10px 16px;border-radius:8px;border:none;font-weight:700;cursor:pointer;text-decoration:none}
.btn.secondary{background:#64748b}
.status{margin-left:12px;font-size:.9rem;color:#64748b}
.actions{margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.pub-panel{border:2px solid #005eb8;border-radius:12px;padding:20px;margin-bottom:16px;background:linear-gradient(180deg,#eff6ff,#fff)}
.pub-panel h2{margin:0 0 8px;font-size:1.1rem}
.pub-meta{font-size:13px;color:#475569;line-height:1.6;margin:0 0 12px}
.pub-badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;margin-bottom:10px}
.pub-badge.ready{background:#dcfce7;color:#166534}
.pub-badge.warn{background:#fef3c7;color:#92400e}
.pub-badge.off{background:#f1f5f9;color:#64748b}
.pub-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.pub-note{font-size:12px;color:#64748b;margin-top:10px}
.pub-note.ok{color:#166534;font-weight:700}
.pub-note.err{color:#991b1b;font-weight:700}
${platformPlatformNavCss()}
</style></head><body>
${renderPharmacyPlatformNavBarLight({ slug: s, serviceId, activeId: "publishing" })}
${renderPlatformWorkflowBar({ slug: s, nextStepUrl: os.nextStep?.url })}
<div class="panel">
  <h1>Publishing Settings</h1>
  <p class="lead">${esc(pageProfile.pharmacyName)} · ${esc(serviceName)}</p>
  <p>Configure canonical URL and indexability. Structured data toggle is saved for future use — does not modify live pages yet.</p>
  <p><span class="badge ${audit?.publishGate === "FAIL" ? "fail" : audit?.publishGate === "PASS" ? "pass" : "warn"}">Publish gate: ${esc(audit?.publishGate || "—")}</span>
  <span class="badge">Authority score: ${audit?.overallScore ?? "—"}</span></p>
</div>
<div class="pub-panel">
  <span class="pub-badge ${pubBadgeClass}">${esc(pubStatusLabel)}</span>
  <h2>Live publishing</h2>
  <p class="pub-meta">
    ${pubConnected ? `FTP: ${esc(livePub.ftpHost || "configured")}` : "Add deploy config and DEPLOY_USERNAME / DEPLOY_PASSWORD to connect FTP."}<br/>
    ${candidateReady
      ? `${candidates?.approvedCount} of ${candidates?.expectedCount} approved ${esc(candidates?.candidateVersion || "current")} candidates ready to publish — first publication does not require a live page to already exist.`
      : `Static output: ${livePub.pageCount} page${livePub.pageCount === 1 ? "" : "s"}${livePub.sitemapReady ? " · sitemap ready" : ""}`}<br/>
    ${livePub.lastPublishedAt ? `Last published: ${esc(livePub.lastPublishedAt.slice(0, 10))}${livePub.lastPublishedUrl ? ` · <a href="${esc(livePub.lastPublishedUrl)}" target="_blank" rel="noopener">${esc(livePub.lastPublishedUrl)}</a>` : ""}` : "Not published live yet — use explicit Publish action below."}
  </p>
  <div class="pub-actions">
    <button type="button" class="btn" id="prepareBtn">Prepare publish output</button>
    <button type="button" class="btn secondary" id="ftpTestBtn" ${pubConnected ? "" : "disabled"}>Test FTP connection</button>
    <button type="button" class="btn" id="publishBtn" ${publishEnabled ? "" : "disabled"} style="background:#0f766e">Publish content live</button>
  </div>
  <p class="pub-note" id="pubActionStatus">Publishing never runs automatically — each action requires your confirmation.</p>
</div>
<form class="panel" id="settingsForm">
  <div class="field">
    <label for="canonicalUrl">Canonical URL</label>
    <input type="url" id="canonicalUrl" name="canonicalUrl" value="${esc(defaultCanonical)}" placeholder="https://example.com/services/pharmacy-first"/>
    <span class="hint">Follows the live publication destination. A Business Profile website URL is not canonical unless that host is the verified customer-domain publication target. Current source: ${esc(canonicalAuthority.source.replace(/_/g, " "))}.</span>
  </div>
  <div class="field">
    <label class="check-row"><input type="checkbox" id="noindex" name="noindex" ${settings?.noindex === false ? "" : "checked"}/> noindex (block search indexing)</label>
    <span class="hint">Uncheck to mark page indexable in publishing settings (overrides HTML noindex for audit).</span>
  </div>
  <div class="field">
    <label class="check-row"><input type="checkbox" id="structuredDataEnabled" name="structuredDataEnabled" ${settings?.structuredDataEnabled ? "checked" : ""}/> structuredDataEnabled (placeholder)</label>
    <span class="hint">Placeholder only — structured data editing not yet wired.</span>
  </div>
  <div class="actions">
    <button type="submit" class="btn" id="saveBtn">Save Publishing Settings</button>
    <span class="status" id="saveStatus"></span>
  </div>
</form>
<p>
  <a class="btn secondary" href="/api/pharmacy-enhancement-workspace?slug=${esc(s)}&service=${esc(serviceId)}">← Campaign Improvements</a>
  <a class="btn secondary" href="/api/pharmacy-authority-readiness?slug=${esc(s)}&service=${esc(serviceId)}" style="margin-left:8px">Authority Audit</a>
</p>
<script>
const SLUG = ${JSON.stringify(s)};
const SERVICE = ${JSON.stringify(serviceId)};
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('saveStatus');
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  status.textContent = 'Saving…';
  try {
    const res = await fetch('/api/pharmacy/publishing-settings/' + SLUG + '/' + SERVICE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonicalUrl: document.getElementById('canonicalUrl').value.trim(),
        noindex: document.getElementById('noindex').checked,
        structuredDataEnabled: document.getElementById('structuredDataEnabled').checked
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Save failed');
    status.textContent = 'Saved — platform refreshed. Publish gate: ' + (data.audit?.publishGate || '—');
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    status.textContent = String(err);
  } finally {
    btn.disabled = false;
  }
});
function pubActionDetail(data){
  return data && data.result && data.result.detail ? String(data.result.detail) : '';
}
function pubActionOk(data){
  return Boolean(data && (data.ok === true || (data.result && data.result.ok === true)));
}
function showPubActionStatus(ok, text){
  const status = document.getElementById('pubActionStatus');
  if (!status) return;
  status.classList.remove('ok', 'err');
  if (ok) {
    status.classList.add('ok');
    status.textContent = text || 'Done';
  } else {
    status.classList.add('err');
    status.textContent = 'Error: ' + (text || 'Action failed');
  }
}
async function pubAction(path, body, opts){
  const status = document.getElementById('pubActionStatus');
  if (status) { status.classList.remove('ok', 'err'); status.textContent = 'Working…'; }
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  const detail = pubActionDetail(data);
  const ok = pubActionOk(data);
  if (!ok) {
    showPubActionStatus(false, data.error || detail || 'Action failed');
    const err = new Error(data.error || detail || 'Action failed');
    err.displayHandled = true;
    throw err;
  }
  showPubActionStatus(true, detail || 'Done — refreshing…');
  if (!opts || opts.reload !== false) setTimeout(() => location.reload(), 700);
  return data;
}
document.getElementById('prepareBtn')?.addEventListener('click', async ()=>{
  try { await pubAction('/api/pharmacy-publishing/' + SLUG + '/prepare', { serviceId: SERVICE }); }
  catch (e) { if (!e || !e.displayHandled) showPubActionStatus(false, e instanceof Error ? e.message : String(e)); }
});
document.getElementById('ftpTestBtn')?.addEventListener('click', async ()=>{
  try { await pubAction('/api/pharmacy-publishing/' + SLUG + '/ftp-test', undefined, { reload: false }); }
  catch (e) { if (!e || !e.displayHandled) showPubActionStatus(false, e instanceof Error ? e.message : String(e)); }
});
document.getElementById('publishBtn')?.addEventListener('click', async ()=>{
  if (!confirm('Publish prepared content to your live website now?')) return;
  try { await pubAction('/api/pharmacy-publishing/' + SLUG + '/publish', { serviceId: SERVICE, confirm: true }); }
  catch (e) { if (!e || !e.displayHandled) showPubActionStatus(false, e instanceof Error ? e.message : String(e)); }
});
</script>
</body></html>`;
}

router.get("/pharmacy-publishing-settings", (req, res) => {
  const slug = safeSlug(String(req.query.slug || "pharmaconnect"));
  const serviceId = String(req.query.service || "pharmacy-first");
  res.type("html").send(renderPage(slug, serviceId));
});

export default router;
