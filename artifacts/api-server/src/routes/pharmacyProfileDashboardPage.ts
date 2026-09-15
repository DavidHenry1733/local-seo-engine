/**
 * Pharmacy Profile Dashboard V1 — production profile management UI.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import {
  renderBrandingSection,
  renderBusinessSection,
  renderFooterSection,
  renderFutureSection,
  renderHeaderSection,
  renderHourFields,
  renderLocalAreasSection,
  renderProfessionalReviewSection,
  renderTrustSection,
  profileDashboardExtraCss,
} from "../../../../src/pharmacy/pharmacyProfileDashboardSections.ts";
import { mapPharmacyDataToBrandProfile } from "../../../../src/pharmacy/pharmacyBrandProfileMapper.ts";
import { renderBrandImportClientScript } from "../../../../src/generator/brandImportPanel.ts";
import { buildProfilePreviewHtml } from "../../../../src/pharmacy/pharmacyProfileDashboardPreview.ts";
import { REVIEWER_BIO_EXAMPLES } from "../../../../src/pharmacy/pharmacyProfileDashboardConfig.ts";
import {
  renderAllV2IntelligenceSections,
  profileV2ClientScript,
  profileV2DashboardCss,
} from "../../../../src/pharmacy/pharmacyProfileDashboardV2Sections.ts";
import {
  normalizeProfileData,
  normalizeProfileDoc,
  type PharmacyProfileData,
} from "../../../../src/pharmacy/pharmacyProfileSchema.ts";
import { computeProfileCompleteness } from "../../../../src/pharmacy/pharmacyProfileCompleteness.ts";
import { resolveGoogleMapsEmbedUrlFromData } from "../../../../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { loadPharmacyAuthorityReadiness } from "../../../../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { PRIMARY_PLATFORM_SERVICE_ID } from "../../../../src/pharmacy/pharmacyPlatformDashboardService.ts";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { computeRequiredProfileCompleteness } from "../../../../src/pharmacy/pharmacyProfileFieldClassification.ts";
import { OPENING_HOUR_DAYS } from "../../../../src/pharmacy/pharmacyProfileHours.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";

const router = Router();
const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const PROFILE_DIR = path.join(ROOT, "data", "pharmacy-profiles");

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

function loadInitialProfile(slug: string): PharmacyProfileData {
  const file = path.join(PROFILE_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileDoc(slug, raw).data;
}

function renderDashboardHtml(slug: string, data: PharmacyProfileData): string {
  const completeness = computeProfileCompleteness(data, slug);
  const required = computeRequiredProfileCompleteness(data);
  const os = buildPlatformOperatingSystem(slug);
  const nextStep = os.nextStep;
  const mapUrl = resolveGoogleMapsEmbedUrlFromData(data);
  const previewHtml = buildProfilePreviewHtml(data);
  const hourFields = renderHourFields(data);
  const initialBrandProfile = mapPharmacyDataToBrandProfile(data);
  const authorityDoc = loadPharmacyAuthorityReadiness(slug);
  const authorityMissing = [
    ...new Set(
      (authorityDoc?.services || []).flatMap((s) =>
        s.missingSignals.filter((m) => /review|expertise|reviewer/i.test(m)),
      ),
    ),
  ].slice(0, 6);

  const sectionScores = completeness.sections
    .map((s) => {
      const pct = s.maxScore ? Math.round((s.score / s.maxScore) * 100) : 0;
      const icon = s.status === "complete" ? "✓" : s.status === "partial" ? "⚠" : "○";
      return `<div class="score-row"><span>${icon} ${esc(s.label)}</span><strong>${pct}%</strong></div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pharmacy Profile — ${esc(data.pharmacyName || slug)}</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:22px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header p{margin:6px 0 0;color:#dbeafe;font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.score-badge{display:inline-flex;align-items:center;gap:8px;background:#ecfdf5;color:#166534;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:800}
.score-badge.warn{background:#fff7ed;color:#9a3412}
.layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:20px;max-width:1440px;margin:0 auto;padding:20px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 4px 18px rgba(15,23,42,.04)}
.panel h2{margin:0 0 4px;font-size:17px;font-weight:800}
.panel .lead{margin:0 0 14px;color:#64748b;font-size:13px}
.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.field label{display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px}
.field input[type=text],.field input[type=url],.field input[type=email],.field input[type=tel],.field input[type=date],.field input[type=color],.field textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:9px 10px;font-size:14px}
.field textarea{min-height:72px;resize:vertical}
.hint{display:block;font-size:11px;color:#64748b;margin-top:4px}
.check-row{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
.score-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.missing{margin:10px 0 0;padding-left:18px;font-size:12px;color:#64748b}
.preview-sticky{position:sticky;top:16px}
.preview-card{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}
.preview-card-head{padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:800;font-size:14px;background:#f8fafc}
.preview-header{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px;color:#fff}
.preview-logo{max-height:40px;width:auto;border-radius:6px;background:#fff;padding:2px}
.preview-logo-placeholder{width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-weight:900}
.preview-map iframe{width:100%;height:180px;border:0}
.address-map iframe{width:100%;height:220px;border:0}
.logo-row{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.logo-preview{width:72px;height:72px;border:1px dashed #cbd5e1;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8fafc}
.logo-preview img{max-width:100%;max-height:100%;object-fit:contain}
.save-bar{position:sticky;bottom:0;background:#fff;border-top:1px solid #e2e8f0;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;z-index:20}
.save-bar button{border:0;border-radius:8px;padding:11px 18px;font-weight:800;cursor:pointer;background:#005eb8;color:#fff}
.save-bar .status{font-size:13px;color:#64748b}
${profileDashboardExtraCss()}
${profileV2DashboardCss()}
${platformPlatformNavCss()}
@media(max-width:1100px){.layout{grid-template-columns:1fr}.preview-sticky{position:static}.grid-2{grid-template-columns:1fr}}
</style>
</head>
<body data-dashboard="pharmacy-profile-v1" data-slug="${esc(slug)}">
<header>
  <h1>Pharmacy Profile Dashboard</h1>
  <p>Single source of truth for branding, trust, navigation, header, footer and business identity.</p>
  <div class="toolbar">
    <span class="score-badge ${required.score >= 100 ? "" : "warn"}" id="headerScore">Required profile: ${required.score}% (${required.requiredComplete}/${required.requiredTotal})</span>
  </div>
  ${renderPharmacyPlatformNavBar({ slug, serviceId: PRIMARY_PLATFORM_SERVICE_ID, activeId: "profile" })}
</header>

<div class="layout">
  <div class="form-column">
    <div id="saveBanner" class="save-banner" role="status" aria-live="polite"></div>
    ${renderPlatformWorkflowBar({
      slug,
      nextStepUrl: nextStep?.url || `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`,
      nextStepLabel: nextStep ? `Continue: ${nextStep.title}` : "Continue Next Step",
    })}
    ${renderBusinessSection(data, hourFields)}
    ${renderLocalAreasSection(data)}
    ${renderBrandingSection(data)}
    ${renderHeaderSection(data)}
    ${renderFooterSection(data)}
    ${renderProfessionalReviewSection(data, slug, authorityMissing)}
    ${renderTrustSection(data)}
    ${renderAllV2IntelligenceSections(data)}
    ${renderFutureSection()}
    <section class="panel" id="section-completeness">
      <h2>Profile Completeness</h2>
      <p class="lead">Progress is based on <strong>required fields only</strong>. Optional fields improve trust but do not block your Growth Programme.</p>
      <div id="sectionScores">${sectionScores}</div>
      <ul class="missing" id="missingList">${completeness.missingItems.slice(0, 12).map((m) => `<li>${esc(m)}</li>`).join("") || "<li>All required fields complete.</li>"}</ul>
    </section>
  </div>
  <aside class="preview-sticky">
    <div class="preview-card">
      <div class="preview-card-head">Live profile preview</div>
      <div id="livePreview" style="padding:12px">${previewHtml}</div>
    </div>
  </aside>
</div>

<div class="save-bar">
  <span class="status" id="saveStatus">Changes not saved</span>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <a class="workflow-btn workflow-btn-ghost" href="/api/pharmacy-dashboard?slug=${esc(slug)}" style="text-decoration:none;padding:11px 16px">Return to Growth Programme</a>
    <a class="workflow-btn workflow-btn-primary" id="continueNextBtn" href="${esc(nextStep?.url || `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`)}" style="text-decoration:none;padding:11px 16px">${esc(nextStep ? `Continue: ${nextStep.title}` : "Continue Next Step")}</a>
    <button type="button" id="saveBtn">Save Profile</button>
  </div>
</div>

<script>
const SLUG = ${JSON.stringify(slug)};
const DAY_KEYS = ${JSON.stringify(OPENING_HOUR_DAYS.map((d) => d.key))};
const DAY_LABELS = ${JSON.stringify(Object.fromEntries(OPENING_HOUR_DAYS.map((d) => [d.key, d.label])))};
const REVIEWER_EXAMPLES = ${JSON.stringify(REVIEWER_BIO_EXAMPLES)};
const INITIAL_MAP = ${JSON.stringify(mapUrl)};
const INITIAL_BRAND = ${JSON.stringify(initialBrandProfile)};

function escapeHtml(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function parseTags(v){ return String(v||'').split(/[,\\n]/).map(x=>x.trim()).filter(Boolean); }
function parseJsonField(v, fallback){ try { return JSON.parse(v||''); } catch { return fallback; } }

let areaState = [];

function loadAreaStateFromHidden(){
  const el = document.getElementById('selectedAreas');
  areaState = parseJsonField(el?.value, []);
  return areaState;
}

function syncAreaHiddenFields(){
  const selected = areaState.filter(a=>a.selected);
  const allNames = areaState.map(a=>a.areaName);
  const manual = areaState.filter(a=>a.source==='manual').map(a=>a.areaName);
  document.getElementById('selectedAreas').value = JSON.stringify(areaState);
  document.getElementById('manualAreas').value = JSON.stringify(manual);
  document.getElementById('coverageAreas').value = JSON.stringify(selected.map(a=>a.areaName));
  document.getElementById('rankingAreas').value = JSON.stringify(selected.map(a=>a.areaName));
  document.getElementById('nearbyAreas').value = JSON.stringify(allNames);
  document.getElementById('areaSelectedCount').textContent = String(selected.length);
}

function renderAreaChecklist(){
  const list = document.getElementById('areaChecklist');
  if (!areaState.length){
    list.innerHTML = '<li class="muted area-empty">Generate areas or add manually below.</li>';
    syncAreaHiddenFields();
    return;
  }
  list.innerHTML = areaState.map((a,i)=>
    '<li class="area-row" data-area-index="'+i+'">'+
    '<label class="check-row area-check"><input type="checkbox" class="area-selected" '+(a.selected?'checked':'')+'/> <strong>'+escapeHtml(a.areaName)+'</strong></label>'+
    '<span class="area-meta">'+escapeHtml(a.areaType||'area')+' · priority '+a.priority+(a.confidence!=null?' · '+a.confidence+'%':'')+' · '+escapeHtml(a.source)+'</span>'+
    '<span class="area-actions"><button type="button" class="btn-area-move" data-dir="up">↑</button><button type="button" class="btn-area-move" data-dir="down">↓</button><button type="button" class="btn-area-remove">×</button></span>'+
    '</li>'
  ).join('');
  syncAreaHiddenFields();
}

function collectProfileData(){
  const data = {};
  document.querySelectorAll('[data-field]').forEach(el=>{
    const key = el.getAttribute('data-field');
    if (!key || key === 'headerNavLinks') return;
    if (el.type === 'checkbox') data[key] = el.checked;
    else if (['selectedAreas','manualAreas','coverageAreas','rankingAreas','nearbyAreas'].includes(key)) data[key] = parseJsonField(el.value, []);
    else if (['reviewerSpecialisms','reviewerSpecialInterests','reviewerClinicalInterests','targetPatientGroups','uniqueSellingPoints','patientQuestions','accreditations','countiesCovered','awards','reviewHighlights'].includes(key)) data[key] = parseTags(el.value);
    else if (key === 'footerLinks') data.footerLinks = parseFooterLinks(el.value);
    else data[key] = el.value.trim();
  });
  data.headerNavLinks = collectHeaderNav();
  if (typeof window.biCollectProfilePatch === 'function') {
    const patch = window.biCollectProfilePatch();
    const formPhone = data.phone;
    const formEmail = data.businessEmail;
    Object.assign(data, patch);
    if (formPhone) data.phone = formPhone;
    if (formEmail) data.businessEmail = formEmail;
    data.headerNavLinks = collectHeaderNav().length ? collectHeaderNav() : (patch.headerNavLinks || data.headerNavLinks);
  }
  if (typeof window.v2CollectProfilePatch === 'function') {
    Object.assign(data, window.v2CollectProfilePatch());
  }
  return data;
}

function collectHeaderNav(){
  const rows = document.querySelectorAll('#headerNavBody tr[data-nav-row]');
  const links = [];
  rows.forEach((row,i)=>{
    links.push({
      label: row.querySelector('.nav-label')?.value?.trim() || 'Link',
      url: row.querySelector('.nav-url')?.value?.trim() || '#',
      order: Number(row.querySelector('.nav-order')?.value) || i+1,
      visible: row.querySelector('.nav-visible')?.checked !== false
    });
  });
  links.sort((a,b)=>a.order-b.order);
  const hidden = document.getElementById('headerNavLinks');
  if (hidden) hidden.value = JSON.stringify(links);
  return links;
}

function parseFooterLinks(text){
  return String(text||'').split('\\n').map((line,i)=>{
    const parts = line.split('|').map(p=>p.trim());
    if (!parts[0]) return null;
    return { label: parts[0], url: parts[1] || '#', order: i+1 };
  }).filter(Boolean);
}

function formatHours(data){
  const parts = DAY_KEYS.map(key=>{ const v=String(data[key]||'').trim(); return v?DAY_LABELS[key]+': '+v:''; }).filter(Boolean);
  return parts.length ? parts.join(' · ') : (data.openingHours || 'No hours set');
}

function resolveMapUrl(data){
  if (String(data.googleMapsEmbedUrl||'').trim()) return data.googleMapsEmbedUrl.trim();
  const q = [data.pharmacyName,data.addressLine1,data.addressLine2,data.townCity,data.postcode].filter(Boolean).join(', ');
  return q ? 'https://www.google.com/maps?q='+encodeURIComponent(q)+'&output=embed' : '';
}

function buildReviewCardHtml(data){
  const name = data.reviewerName || data.superintendentPharmacistName || '';
  if (!name) return '<div class="profile-review-card profile-review-card--fallback"><p class="profile-review-fallback">Professional review details available from the pharmacy.</p></div>';
  const role = data.reviewerRole || 'Superintendent Pharmacist';
  const pharmacy = data.pharmacyName || data.tradingName || 'this pharmacy';
  let html = '<div class="profile-review-card"><div class="profile-review-body">';
  if (data.reviewerPhoto) html += '<div class="profile-review-photo"><img src="'+escapeHtml(data.reviewerPhoto)+'" alt=""/></div>';
  html += '<h3 class="profile-review-name">'+escapeHtml(name)+'</h3>';
  html += '<p class="profile-review-role">'+escapeHtml(role)+' at '+escapeHtml(pharmacy)+'</p>';
  if (data.reviewerQualifications) html += '<p class="profile-review-qual">'+escapeHtml(data.reviewerQualifications)+'</p>';
  if (data.reviewerBio) html += '<p class="profile-review-bio">'+escapeHtml(data.reviewerBio)+'</p>';
  if (data.clinicalReviewDate) html += '<p class="profile-review-date"><strong>Clinical review date:</strong> '+escapeHtml(data.clinicalReviewDate)+'</p>';
  if (data.nextReviewDate) html += '<p class="profile-review-date"><strong>Next review due:</strong> '+escapeHtml(data.nextReviewDate)+'</p>';
  html += '</div></div>';
  return html;
}

function buildPreviewHtml(data){
  const name = data.pharmacyName || data.tradingName || 'Your pharmacy';
  const primary = data.brandPrimaryColor || '#005eb8';
  const secondary = data.brandSecondaryColor || '#003087';
  const cta = data.brandCtaColor || primary;
  const accent = data.brandAccentColor || '#0d9488';
  const text = data.brandTextColor || '#142033';
  const muted = data.brandMutedTextColor || '#5d6b7f';
  const ctaText = data.headerCtaText || data.preferredCta || 'Book Consultation';
  const nav = (data.headerNavLinks||[]).filter(l=>l.visible).map(l=>'<a class="preview-nav-link" href="#">'+escapeHtml(l.label)+'</a>').join('') || '<a class="preview-nav-link" href="#">Services</a>';
  const logo = data.headerLogoUrl || data.logoUrl;
  const logoHtml = logo ? '<img src="'+escapeHtml(logo)+'" class="preview-logo" alt=""/>' : '<div class="preview-logo-placeholder">P</div>';
  return '<div style="font-size:13px">' +
    '<div class="preview-header" style="background:'+secondary+'">'+logoHtml+'<div><strong>'+escapeHtml(name)+'</strong></div><div class="preview-nav-links">'+nav+'</div></div>' +
    '<div style="padding:12px;background:linear-gradient(135deg,'+secondary+','+primary+');color:#fff;margin-top:8px;border-radius:10px"><strong>Hero sample</strong><div style="margin-top:8px"><a style="display:inline-block;background:'+cta+';color:#fff;padding:8px 12px;border-radius:'+(data.buttonRadius||'14px')+';text-decoration:none;font-weight:800" href="#">'+escapeHtml(ctaText)+'</a></div></div>' +
    '<div style="padding:12px;margin-top:8px"><strong style="color:'+text+'">Typography</strong><p style="color:'+muted+';font-family:'+escapeHtml(data.fontBody||'Inter')+'">Body sample</p></div>' +
    buildReviewCardHtml(data) +
    '<div class="preview-footer-block" style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px"><strong>'+escapeHtml(name)+'</strong><p>'+escapeHtml(data.footerText||'')+'</p><p style="font-size:11px">'+escapeHtml(data.footerCopyright||'')+'</p></div></div>';
}

async function refreshCompleteness(data){
  const res = await fetch('/api/pharmacy/profile/'+SLUG+'/audit', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(data) });
  const json = await res.json();
  if (json.completeness){
    const req = json.requiredCompleteness || json.completeness;
    const score = json.requiredCompleteness ? json.requiredCompleteness.score : json.completeness.score;
    const label = json.requiredCompleteness
      ? 'Required profile: '+score+'% ('+json.requiredCompleteness.requiredComplete+'/'+json.requiredCompleteness.requiredTotal+')'
      : 'Profile completeness: '+score+'%';
    document.getElementById('headerScore').textContent = label;
    document.getElementById('headerScore').className = 'score-badge'+(score>=100?'':' warn');
    document.getElementById('sectionScores').innerHTML = json.completeness.sections.map(s=>'<div class="score-row"><span>'+escapeHtml(s.label)+'</span><strong>'+s.score+'/'+s.maxScore+'</strong></div>').join('');
    const missing = json.completeness.missingItems || [];
    document.getElementById('missingList').innerHTML = missing.slice(0,12).map(m=>'<li>'+escapeHtml(m)+'</li>').join('') || '<li>All required fields complete.</li>';
  }
}

function showSaveBanner(ok, message){
  const el = document.getElementById('saveBanner');
  if (!el) return;
  el.className = 'save-banner '+(ok?'ok':'err');
  el.textContent = message;
  el.style.display = 'block';
}

async function saveProfile(){
  const data = collectProfileData();
  document.getElementById('saveStatus').textContent = 'Saving…';
  showSaveBanner(false, '');
  document.getElementById('saveBanner').style.display = 'none';
  try {
    const res = await fetch('/api/pharmacy/profile/'+SLUG, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(data) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Save failed');
    const savedAt = new Date(json.profile.updatedAt);
    document.getElementById('saveStatus').textContent = 'Last saved '+savedAt.toLocaleString();
    showSaveBanner(true, 'Profile saved successfully. Last saved just now.');
    if (json.completeness) {
      const score = json.requiredCompleteness ? json.requiredCompleteness.score : json.completeness.score;
      const label = json.requiredCompleteness
        ? 'Required profile: '+score+'% ('+json.requiredCompleteness.requiredComplete+'/'+json.requiredCompleteness.requiredTotal+')'
        : 'Profile completeness: '+score+'%';
      document.getElementById('headerScore').textContent = label;
      document.getElementById('headerScore').className = 'score-badge'+(score>=100?'':' warn');
      document.getElementById('missingList').innerHTML = (json.completeness.missingItems||[]).slice(0,12).map(m=>'<li>'+escapeHtml(m)+'</li>').join('') || '<li>All required fields complete.</li>';
    }
    if (json.nextStep && json.nextStep.url) {
      const btn = document.getElementById('continueNextBtn');
      if (btn) { btn.href = json.nextStep.url; btn.textContent = 'Continue: '+json.nextStep.title; }
    }
  } catch(err) {
    document.getElementById('saveStatus').textContent = 'Save failed';
    showSaveBanner(false, 'Could not save profile. '+String(err));
  }
}

function updateLivePreview(){
  const data = collectProfileData();
  document.getElementById('livePreview').innerHTML = buildPreviewHtml(data);
  document.getElementById('hoursPreview').textContent = formatHours(data);
  const mapUrl = resolveMapUrl(data);
  document.getElementById('addressMapPreview').innerHTML = mapUrl ? '<iframe src="'+escapeHtml(mapUrl)+'" title="Map" loading="lazy"></iframe>' : '<div style="padding:40px;text-align:center;color:#64748b">Enter address to preview map</div>';
  document.getElementById('reviewCardPreviewHost').innerHTML = buildReviewCardHtml(data);
  refreshCompleteness(data);
  document.getElementById('saveStatus').textContent = 'Unsaved changes';
}

document.getElementById('saveBtn').addEventListener('click', saveProfile);

document.querySelectorAll('[data-field], #headerNavBody input').forEach(el=>{
  el.addEventListener('input', updateLivePreview);
  el.addEventListener('change', updateLivePreview);
});

document.querySelectorAll('.btn-example').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const id = btn.getAttribute('data-example-id') || btn.getAttribute('data-copy-id');
    const ex = REVIEWER_EXAMPLES.find(e=>e.id===id);
    if (!ex) return;
    if (btn.getAttribute('data-example-id')){
      document.getElementById('reviewerBio').value = ex.bio;
      document.getElementById('reviewerRole').value = ex.role;
      document.getElementById('reviewerSpecialisms').value = ex.specialisms.join(', ');
    } else {
      navigator.clipboard.writeText(ex.bio);
    }
    updateLivePreview();
  });
});

document.getElementById('addressMapPreview').innerHTML = INITIAL_MAP ? '<iframe src="'+escapeHtml(INITIAL_MAP)+'" title="Map" loading="lazy"></iframe>' : '<div style="padding:40px;text-align:center;color:#64748b">Enter address to preview map</div>';

loadAreaStateFromHidden();
renderAreaChecklist();

document.getElementById('btnGenerateAreas')?.addEventListener('click', async function(){
  const town = document.getElementById('primaryTown')?.value?.trim() || '';
  const limit = Number(document.getElementById('areaSuggestLimit')?.value || 10);
  const status = document.getElementById('areaGenStatus');
  if (!town){ alert('Enter a main town or city first.'); return; }
  status.textContent = 'Generating…';
  try {
    const res = await fetch('/api/pharmacy/profile/'+SLUG+'/discover-areas', {
      method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ town, limit, preserveSelection: areaState })
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Discovery failed');
    areaState = json.discovery.areas || [];
    document.getElementById('primaryTown').value = json.discovery.primaryCity || town;
    document.getElementById('primaryCity').value = json.discovery.primaryCity || town;
    document.getElementById('areaDiscoverySource').value = json.discovery.source || '';
    document.getElementById('areaDiscoveryUpdatedAt').value = json.discovery.generatedAt || '';
    document.getElementById('areaSourceLabel').textContent = json.discovery.source || '—';
    document.getElementById('areaLastGenerated').textContent = json.discovery.generatedAt ? new Date(json.discovery.generatedAt).toLocaleString('en-GB') : '—';
    renderAreaChecklist();
    status.textContent = 'Generated '+areaState.length+' areas';
    updateLivePreview();
  } catch(err){
    status.textContent = '';
    alert(String(err));
  }
});

document.getElementById('btnAddManualArea')?.addEventListener('click', function(){
  const input = document.getElementById('manualAreaInput');
  const name = input?.value?.trim();
  if (!name) return;
  if (areaState.some(a=>a.areaName.toLowerCase()===name.toLowerCase())){ alert('Area already in list'); return; }
  areaState.push({ areaName:name, areaType:'manual', priority:areaState.length+1, order:areaState.length+1, selected:true, source:'manual', confidence:100 });
  input.value = '';
  renderAreaChecklist();
  updateLivePreview();
});

document.getElementById('areaChecklist')?.addEventListener('click', function(ev){
  const btn = ev.target.closest('.btn-area-move, .btn-area-remove');
  if (!btn) return;
  const row = btn.closest('.area-row');
  const idx = Number(row?.getAttribute('data-area-index'));
  if (Number.isNaN(idx)) return;
  if (btn.classList.contains('btn-area-remove')){
    areaState.splice(idx,1);
    areaState.forEach((a,i)=>{ a.order=i+1; a.priority=i+1; });
    renderAreaChecklist();
    updateLivePreview();
    return;
  }
  const dir = btn.getAttribute('data-dir');
  const swap = dir === 'up' ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= areaState.length) return;
  const tmp = areaState[idx];
  areaState[idx] = areaState[swap];
  areaState[swap] = tmp;
  areaState.forEach((a,i)=>{ a.order=i+1; });
  renderAreaChecklist();
});

document.getElementById('areaChecklist')?.addEventListener('change', function(ev){
  if (!ev.target.classList.contains('area-selected')) return;
  const row = ev.target.closest('.area-row');
  const idx = Number(row?.getAttribute('data-area-index'));
  if (Number.isNaN(idx) || !areaState[idx]) return;
  areaState[idx].selected = ev.target.checked;
  syncAreaHiddenFields();
  updateLivePreview();
});

updateLivePreview();
</script>
<script>${profileV2ClientScript()}</script>
<script>${renderBrandImportClientScript("pharmacy")}</script>
</body>
</html>`;
}

router.get("/pharmacy-profile-dashboard", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  if (!req.query.legacy) {
    res.redirect(`/api/pharmacy-profile-wizard?slug=${encodeURIComponent(slug)}`);
    return;
  }
  try {
    const data = loadInitialProfile(slug);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderDashboardHtml(slug, data));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Profile dashboard error: ${esc(String(err))}</pre>`);
  }
});

export default router;
