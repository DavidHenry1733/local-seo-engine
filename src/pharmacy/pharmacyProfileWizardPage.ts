/**
 * Business Profile Wizard V2 — page render and client script.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { mapPharmacyDataToBrandProfile } from "./pharmacyBrandProfileMapper.ts";
import { renderBrandImportClientScript, brandImportPanelCss } from "../generator/brandImportPanel.ts";
import { profileV2ClientScript, profileV2DashboardCss } from "./pharmacyProfileDashboardV2Sections.ts";
import { profileDashboardExtraCss } from "./pharmacyProfileDashboardSections.ts";
import { OPENING_HOUR_DAYS } from "./pharmacyProfileHours.ts";
import { REVIEWER_BIO_EXAMPLES } from "./pharmacyProfileDashboardConfig.ts";
import { computeWizardQualityScore, wizardProgressPercent } from "./pharmacyProfileWizardScoring.ts";
import {
  WIZARD_STEPS,
  WIZARD_TOTAL_STEPS,
  WIZARD_VERSION,
  clampWizardStep,
  resolveInitialWizardStep,
} from "./pharmacyProfileWizardSteps.ts";
import {
  renderWizardStepImport,
  renderWizardStepBasics,
  renderWizardStepBrand,
  renderWizardStepServices,
  renderWizardStepLocal,
  renderWizardStepPatients,
  renderWizardStepTrust,
  renderWizardStepReadiness,
  renderWizardStepper,
  wizardPageCss,
} from "./pharmacyProfileWizardSections.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "./pharmacyPlatformNav.ts";
import { buildPlatformOperatingSystem } from "./pharmacyPlatformOperatingSystemService.ts";
import { loadPharmacyAuthorityReadiness } from "./pharmacyAuthorityReadinessService.ts";
import { PATIENT_GROUP_OPTIONS } from "./pharmacyProfileWizardPresets.ts";
import { resolveCanonicalPharmacyName } from "./pharmacyServicePageProfileContext.ts";
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function resolveWizardHeaderPharmacyName(data: PharmacyProfileData, slug: string): { value: string; source: string } {
  const canonical = resolveCanonicalPharmacyName(data);
  return canonical.value ? canonical : { value: slug, source: "slug fallback" };
}

export function renderProfileWizardHtml(
  slug: string,
  data: PharmacyProfileData,
  options?: { initialStep?: number },
): string {
  const requestedStep = Number(options?.initialStep);
  const initialStep = Number.isFinite(requestedStep) && requestedStep >= 1
    ? clampWizardStep(requestedStep)
    : resolveInitialWizardStep(data);
  const quality = computeWizardQualityScore(data);
  const progress = wizardProgressPercent(initialStep);
  const os = buildPlatformOperatingSystem(slug);
  const initialBrand = mapPharmacyDataToBrandProfile(data);
  const wizardHeaderName = resolveWizardHeaderPharmacyName(data, slug).value;
  const authorityDoc = loadPharmacyAuthorityReadiness(slug);
  const authorityMissing = [
    ...new Set(
      (authorityDoc?.services || []).flatMap((s) =>
        s.missingSignals.filter((m) => /review|expertise|reviewer/i.test(m)),
      ),
    ),
  ].slice(0, 6);

  const stepPanels = [
    renderWizardStepImport(data),
    renderWizardStepBasics(data),
    renderWizardStepBrand(data),
    renderWizardStepServices(data, slug),
    renderWizardStepLocal(data),
    renderWizardStepPatients(data),
    renderWizardStepTrust(data, slug, authorityMissing),
    renderWizardStepReadiness(data, quality, slug),
  ].join("\n");

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Business Profile Wizard · ${esc(wizardHeaderName)}</title>
<style>
${commercialBlueUiBaselineCss()}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:${commercialBlueChromeGradientCss()};color:#fff;padding:18px 24px}
header h1{margin:0;font-size:22px}
header p{margin:6px 0 0;color:#dbeafe;font-size:14px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.field{margin-bottom:12px}
.field label{display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px}
.field input,.field textarea,.field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:9px 10px;font-size:14px}
.hint{display:block;font-size:11px;color:#64748b;margin-top:4px}
.check-row{display:flex;align-items:center;gap:8px;font-size:14px}
${platformPlatformNavCss()}
${brandImportPanelCss()}
${profileV2DashboardCss()}
${profileDashboardExtraCss()}
${wizardPageCss()}
@media(max-width:720px){.grid-2{grid-template-columns:1fr}.wizard-step-dot .dot-label{display:none}}
</style>
</head>
<body data-slug="${esc(slug)}" data-wizard-version="${WIZARD_VERSION}">
${renderPharmacyPlatformNavBar(slug)}
<header>
<h1>Business Profile Wizard</h1>
<p>Auto-enriched setup for ${esc(wizardHeaderName)} — confirm imported data, add only what's missing. <a href="/api/pharmacy-profile-dashboard?slug=${encodeURIComponent(slug)}&amp;legacy=1" style="color:#dbeafe">Open full form</a></p>
</header>
<div class="wizard-shell">
${renderPlatformWorkflowBar({
  slug,
  nextStepUrl: os.nextStep?.url || `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`,
  nextStepLabel: os.nextStep ? `Continue: ${os.nextStep.title}` : "Growth Programme",
})}
<div class="wizard-progress">
<div class="wizard-progress-bar"><div class="wizard-progress-fill" id="wizardProgressFill" style="width:${progress}%"></div></div>
<div class="wizard-progress-meta"><span id="wizardProgressLabel">Step ${initialStep} of ${WIZARD_TOTAL_STEPS}</span><span id="wizardQualityLabel">Campaign Content Quality: ${quality.overallScore}%</span></div>
</div>
<nav class="wizard-stepper" id="wizardStepper" aria-label="Wizard steps">${renderWizardStepper(initialStep)}</nav>
<div id="wizardError" class="wizard-error" hidden></div>
<div id="wizardStepHost">${stepPanels}</div>
</div>
<nav class="wizard-nav">
<div class="wizard-nav-inner">
<button type="button" class="wizard-ghost" id="wizardBackBtn">Back</button>
<span class="wizard-save-status" id="wizardSaveStatus">Saved</span>
<button type="button" class="wizard-primary" id="wizardNextBtn">Continue</button>
</div>
</nav>
<script>
const SLUG = ${JSON.stringify(slug)};
const WIZARD_TOTAL = ${WIZARD_TOTAL_STEPS};
const PATIENT_GROUP_LABELS = ${JSON.stringify(Object.fromEntries(PATIENT_GROUP_OPTIONS.map(o=>[o.id,o.label])))};
const DAY_KEYS = ${JSON.stringify(OPENING_HOUR_DAYS.map((d) => d.key))};
const DAY_LABELS = ${JSON.stringify(Object.fromEntries(OPENING_HOUR_DAYS.map((d) => [d.key, d.label])))};
const REVIEWER_EXAMPLES = ${JSON.stringify(REVIEWER_BIO_EXAMPLES)};
const INITIAL_BRAND = ${JSON.stringify(initialBrand)};
const INITIAL_STEP = ${initialStep};
const ESTIMATED_MINUTES = ${quality.estimatedMinutesRemaining};
const LOCAL_ENTITY_GROUPS = ${JSON.stringify(["gpSurgeries","healthCentres","hospitals","landmarks","transportLinks"])};

let fieldConfirmations = parseJsonField(document.getElementById('profileFieldConfirmations')?.value, {});

let wizardStep = clampStep(INITIAL_STEP);
let areaState = [];
let autoSaveTimer = null;
let serviceDetailIndex = 0;
let localCandidates = parseJsonField(document.getElementById('localIntelligenceCandidates')?.value, {});

function clampStep(n){ return Math.max(1, Math.min(WIZARD_TOTAL, Number(n)||1)); }
function escapeHtml(v){ return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function parseTags(v){ return String(v||'').split(/[,\\n]/).map(x=>x.trim()).filter(Boolean); }
function parseJsonField(v,f){ try { return JSON.parse(v||''); } catch { return f; } }

function loadAreaStateFromHidden(){
  areaState = parseJsonField(document.getElementById('selectedAreas')?.value, []);
}

function syncAreaHiddenFields(){
  const selected = areaState.filter(a=>a.selected);
  const allNames = areaState.map(a=>a.areaName);
  const manual = areaState.filter(a=>a.source==='manual').map(a=>a.areaName);
  const el = (id)=>document.getElementById(id);
  if (el('selectedAreas')) el('selectedAreas').value = JSON.stringify(areaState);
  if (el('manualAreas')) el('manualAreas').value = JSON.stringify(manual);
  if (el('coverageAreas')) el('coverageAreas').value = JSON.stringify(selected.map(a=>a.areaName));
  if (el('rankingAreas')) el('rankingAreas').value = JSON.stringify(selected.map(a=>a.areaName));
  if (el('nearbyAreas')) el('nearbyAreas').value = JSON.stringify(allNames);
  if (el('areaSelectedCount')) el('areaSelectedCount').textContent = String(selected.length);
}

function renderAreaChecklist(){
  const list = document.getElementById('areaChecklist');
  if (!list) return;
  if (!areaState.length){
    list.innerHTML = '<li class="muted area-empty">Generate areas or add manually below.</li>';
    syncAreaHiddenFields();
    return;
  }
  list.innerHTML = areaState.map((a,i)=>
    '<li class="area-row" data-area-index="'+i+'">'+
    '<label class="check-row area-check"><input type="checkbox" class="area-selected" '+(a.selected?'checked':'')+'/> <strong>'+escapeHtml(a.areaName)+'</strong></label>'+
    '<span class="area-meta">'+escapeHtml(a.areaType||'area')+' · priority '+a.priority+'</span>'+
    '<span class="area-actions"><button type="button" class="btn-area-move" data-dir="up">↑</button><button type="button" class="btn-area-move" data-dir="down">↓</button><button type="button" class="btn-area-remove">×</button></span></li>'
  ).join('');
  syncAreaHiddenFields();
}

function syncPatientGroups(){
  const labels = Array.from(document.querySelectorAll('.wizard-patient-cb:checked')).map(el=>PATIENT_GROUP_LABELS[el.value]||el.value);
  const other = parseTags(document.getElementById('targetPatientGroupsOther')?.value);
  const hidden = document.getElementById('targetPatientGroups');
  if (hidden) hidden.value = JSON.stringify([...labels, ...other]);
}

function syncUniqueSellingPoints(){
  const presets = Array.from(document.querySelectorAll('.wizard-usp-cb:checked')).map(el=>el.value);
  const other = parseTags(document.getElementById('uniqueSellingPointsOther')?.value);
  const hidden = document.getElementById('uniqueSellingPoints');
  if (hidden) hidden.value = JSON.stringify([...presets, ...other]);
}

function syncTrustAccreditations(){
  const selected = Array.from(document.querySelectorAll('.wizard-trust-preset:checked')).map(el=>el.value);
  const hidden = document.getElementById('accreditations');
  if (hidden) hidden.value = JSON.stringify(selected);
}

function syncLocalEntitiesFromDom(){
  LOCAL_ENTITY_GROUPS.forEach(group=>{
    const hidden = document.getElementById(group);
    if (!hidden) return;
    const pool = parseJsonField(hidden.value, []);
    const selectedIds = new Set(Array.from(document.querySelectorAll('.wizard-entity-cb[data-entity-group="'+group+'"]:checked')).map(el=>el.getAttribute('data-entity-id')));
    const updated = pool.map(e=>({ ...e, selected: selectedIds.has(e.id) }));
    hidden.value = JSON.stringify(updated);
  });
}

function syncCompetitorsFromDom(){
  const hidden = document.getElementById('profileCompetitors');
  if (!hidden) return;
  const pool = parseJsonField(hidden.value, []);
  const updated = pool.map(c=>{
    const cb = document.querySelector('.wizard-competitor-cb[data-competitor-id="'+c.id+'"]');
    const notes = document.querySelector('.wizard-competitor-notes[data-competitor-id="'+c.id+'"]');
    return { ...c, selected: cb ? cb.checked : c.selected, notes: notes ? notes.value.trim() : c.notes };
  });
  hidden.value = JSON.stringify(updated);
}

function renderLocalEntityGroups(groups){
  const host = document.getElementById('wizardLocalEntityHost');
  if (!host || !groups) return;
  const labels = { gpSurgeries:'GP Surgeries', healthCentres:'Health Centres', hospitals:'Hospitals', landmarks:'Landmarks', transportLinks:'Transport & parking' };
  host.innerHTML = LOCAL_ENTITY_GROUPS.map(group=>{
    const entities = groups[group] || [];
    if (!entities.length) return '<div class="wizard-entity-group"><h4>'+escapeHtml(labels[group]||group)+'</h4><p class="hint">No suggestions for this group.</p></div>';
    const rows = entities.map(e=>'<label class="wizard-entity-check"><input type="checkbox" class="wizard-entity-cb" data-entity-group="'+group+'" data-entity-id="'+escapeHtml(e.id)+'" '+(e.selected!==false?'checked':'')+'/> <span><strong>'+escapeHtml(e.name)+'</strong> <span class="hint-inline">'+escapeHtml(e.distanceLabel||'')+'</span></span></label>').join('');
    return '<div class="wizard-entity-group"><h4>'+escapeHtml(labels[group]||group)+'</h4><div class="wizard-entity-grid">'+rows+'</div><input type="hidden" id="'+group+'" data-field="'+group+'" data-json-entities="true" value="'+escapeHtml(JSON.stringify(entities))+'"/></div>';
  }).join('');
}

function renderCompetitorHost(competitors){
  const host = document.getElementById('wizardCompetitorHost');
  const hidden = document.getElementById('profileCompetitors');
  if (!host) return;
  if (!competitors?.length){
    host.innerHTML = '<p class="hint">No competitor suggestions found.</p>';
    if (hidden) hidden.value = '[]';
    return;
  }
  host.innerHTML = competitors.map((c,i)=>
    '<div class="wizard-competitor-card"><label class="wizard-entity-check"><input type="checkbox" class="wizard-competitor-cb" data-competitor-id="'+escapeHtml(c.id)+'" '+(c.selected?'checked':'')+'/> <strong>'+escapeHtml(c.name)+'</strong></label>'+
    '<div class="wizard-competitor-meta"><span>'+escapeHtml(c.distanceLabel||'')+'</span>'+(c.rating!=null?'<span>★ '+Number(c.rating).toFixed(1)+' ('+c.reviewCount+' reviews)</span>':'')+(c.website?'<a href="'+escapeHtml(c.website)+'" target="_blank" rel="noopener">Website</a>':'')+'</div>'+
    '<div class="field"><label>Notes</label><input type="text" class="wizard-competitor-notes" data-competitor-id="'+escapeHtml(c.id)+'" value="'+escapeHtml(c.notes||'')+'" placeholder="Optional notes"/></div></div>'
  ).join('');
  if (hidden) hidden.value = JSON.stringify(competitors);
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

function syncSelectedServicesFromCheckboxes(){
  const ids = Array.from(document.querySelectorAll('.wizard-service-cb:checked')).map(el=>el.value);
  const hidden = document.getElementById('selectedServices');
  if (hidden) hidden.value = JSON.stringify(ids);
  return ids;
}

let wizardEnrichPatch = null;

function syncWizardServiceProfiles(){
  if (typeof collectServiceDeliveryProfiles === 'function') {
    collectServiceDeliveryProfiles();
    return;
  }
  const hidden = document.getElementById('serviceDeliveryProfiles');
  if (!hidden) return;
  const profiles = parseJsonField(hidden.value, {});
  document.querySelectorAll('.wizard-svc-quick').forEach(card=>{
    const sid = card.getAttribute('data-service-id');
    if (!sid) return;
    const p = profiles[sid] || { serviceId: sid, fundingModel: 'unknown', equipmentUsed: [] };
    const funding = card.querySelector('.wizard-svc-funding');
    const length = card.querySelector('.wizard-svc-length');
    const appt = card.querySelector('.wizard-svc-appt');
    const walk = card.querySelector('.wizard-svc-walkin');
    if (funding) p.fundingModel = funding.value || 'unknown';
    if (length && length.value) {
      p.consultationLengthMinutes = Number(length.value) || null;
      p.consultationLengthLabel = length.options[length.selectedIndex]?.text?.replace('About ','').replace(' minutes',' min') || '';
    }
    if (appt) p.appointmentRequired = appt.value === '' ? null : appt.value === 'true';
    if (walk) p.walkInAvailable = walk.value === '' ? null : walk.value === 'true';
    p.equipmentUsed = Array.from(card.querySelectorAll('.wizard-svc-equip:checked')).map(el=>el.value);
    profiles[sid] = p;
  });
  hidden.value = JSON.stringify(profiles);
}

function markFieldConfirmed(fieldKey){
  fieldConfirmations[fieldKey] = new Date().toISOString();
  const hidden = document.getElementById('profileFieldConfirmations');
  if (hidden) hidden.value = JSON.stringify(fieldConfirmations);
  const card = document.querySelector('[data-field-card="'+fieldKey+'"]');
  if (card){
    card.classList.remove('status-imported','status-review');
    card.classList.add('status-confirmed');
    const badge = card.querySelector('.wizard-import-badge');
    if (badge){ badge.className = 'wizard-import-badge status-confirmed'; badge.textContent = 'Confirmed'; }
    const input = card.querySelector('#'+fieldKey);
    if (input) input.readOnly = true;
  }
}

function collectProfileData(){
  syncPatientGroups();
  syncUniqueSellingPoints();
  syncTrustAccreditations();
  syncLocalEntitiesFromDom();
  syncCompetitorsFromDom();
  syncWizardServiceProfiles();
  const data = { profileWizardStep: wizardStep, profileWizardUpdatedAt: new Date().toISOString(), profileFieldConfirmations: fieldConfirmations };
  document.querySelectorAll('[data-field]').forEach(el=>{
    const key = el.getAttribute('data-field');
    if (!key || key === 'headerNavLinks') return;
    if (el.type === 'checkbox') data[key] = el.checked;
    else if (el.hasAttribute('data-json-entities') || ['selectedAreas','manualAreas','coverageAreas','rankingAreas','nearbyAreas','selectedServices','pharmacistTeamMembers','teamMembers','serviceDeliveryProfiles','contentIntelligence','testimonials','profileCompetitors','localIntelligenceCandidates','gpSurgeries','hospitals','healthCentres','landmarks','transportLinks','targetPatientGroups','accreditations','websiteImportedFieldKeys','profileFieldConfirmations'].includes(key)) data[key] = parseJsonField(el.value, Array.isArray(parseJsonField(el.value,null)) ? [] : {});
    else if (['reviewerSpecialisms','reviewerSpecialInterests','reviewerClinicalInterests','uniqueSellingPoints','patientQuestions','countiesCovered','awards','reviewHighlights','localLandmarks','localGpSurgeries','nearbyHospitals','languagesSpoken'].includes(key)) data[key] = parseTags(el.value);
    else if (key === 'footerLinks') data.footerLinks = parseFooterLinks(el.value);
    else data[key] = el.value.trim();
  });
  data.headerNavLinks = collectHeaderNav();
  if (typeof window.biCollectProfilePatch === 'function') {
    const patch = window.biCollectProfilePatch();
    Object.assign(data, patch);
    data.headerNavLinks = collectHeaderNav().length ? collectHeaderNav() : (patch.headerNavLinks || data.headerNavLinks);
  }
  if (typeof window.v2CollectProfilePatch === 'function') Object.assign(data, window.v2CollectProfilePatch());
  if (wizardEnrichPatch) Object.assign(data, wizardEnrichPatch);
  return data;
}

function showWizardError(msg){
  const el = document.getElementById('wizardError');
  if (!el) return;
  if (msg){ el.hidden = false; el.textContent = msg; }
  else { el.hidden = true; el.textContent = ''; }
}

function updateProgressUi(){
  const pct = wizardStep <= 1 ? 0 : Math.min(100, Math.round(((wizardStep-1)/(WIZARD_TOTAL-1))*100));
  const fill = document.getElementById('wizardProgressFill');
  const label = document.getElementById('wizardProgressLabel');
  if (fill) fill.style.width = pct+'%';
  if (label) label.textContent = 'Step '+wizardStep+' of '+WIZARD_TOTAL+' · ~'+ESTIMATED_MINUTES+' min left';
  document.querySelectorAll('.wizard-step-dot').forEach(btn=>{
    const s = Number(btn.getAttribute('data-goto-step'));
    btn.classList.toggle('active', s === wizardStep);
    btn.classList.toggle('done', s < wizardStep);
  });
  document.querySelectorAll('.wizard-step-panel').forEach(panel=>{
    panel.hidden = Number(panel.getAttribute('data-wizard-step')) !== wizardStep;
  });
  document.getElementById('wizardBackBtn').disabled = wizardStep <= 1;
  document.getElementById('wizardNextBtn').textContent = wizardStep >= WIZARD_TOTAL ? 'Finish' : 'Continue';
}

async function saveProfile(silent){
  const status = document.getElementById('wizardSaveStatus');
  if (status && !silent) status.textContent = 'Saving…';
  const data = collectProfileData();
  const res = await fetch('/api/pharmacy/profile/'+SLUG, {
    method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');
  if (status) status.textContent = 'Saved · '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const qLabel = document.getElementById('wizardQualityLabel');
  if (qLabel && json.wizardQuality) qLabel.textContent = 'Campaign Content Quality: '+json.wizardQuality.overallScore+'%';
  return json;
}

async function saveConfirmedServicesOnly(){
  const status = document.getElementById('confirmedServicesSaveStatus');
  const ids = syncSelectedServicesFromCheckboxes();
  if (status) status.textContent = 'Saving…';
  const res = await fetch('/api/pharmacy/profile/'+SLUG, {
    method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({ selectedServices: ids })
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed');
  if (status) status.textContent = 'Saved confirmed services · '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  return json;
}

document.getElementById('btnSaveConfirmedServices')?.addEventListener('click', async ()=>{
  try { await saveConfirmedServicesOnly(); }
  catch(e){ showWizardError(e.message || String(e)); }
});

function scheduleAutoSave(ev){
  if (ev && ev.target && (ev.target.classList.contains('wizard-service-cb') || ev.target.closest?.('#wizardServiceGrid'))) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(()=>{ saveProfile(true).catch(()=>{}); }, 800);
}

async function validateCurrentStep(){
  const data = collectProfileData();
  const res = await fetch('/api/pharmacy/profile/'+SLUG+'/wizard-validate', {
    method:'POST', credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ step: wizardStep, data })
  });
  const json = await res.json();
  return json.error || null;
}

async function goToStep(next){
  wizardStep = clampStep(next);
  updateProgressUi();
  showWizardError('');
  if (wizardStep === 4) initServiceCarousel();
  try { await saveProfile(true); } catch(e){}
}

document.getElementById('wizardBackBtn')?.addEventListener('click', ()=>{ if (wizardStep>1) goToStep(wizardStep-1); });
document.getElementById('wizardNextBtn')?.addEventListener('click', async ()=>{
  const err = await validateCurrentStep();
  if (err){ showWizardError(err); return; }
  try { await saveProfile(false); } catch(e){ showWizardError(e.message); return; }
  if (wizardStep >= WIZARD_TOTAL) {
    window.location.href = '/api/growth-engine?slug='+encodeURIComponent(SLUG);
    return;
  }
  goToStep(wizardStep+1);
});

document.getElementById('wizardStepper')?.addEventListener('click', async (ev)=>{
  const btn = ev.target.closest('[data-goto-step]');
  if (!btn) return;
  const target = Number(btn.getAttribute('data-goto-step'));
  if (target === wizardStep) return;
  if (target > wizardStep){
    const err = await validateCurrentStep();
    if (err){ showWizardError(err); return; }
  }
  goToStep(target);
});

document.querySelector('.wizard-shell')?.addEventListener('click', (ev)=>{
  const skip = ev.target.closest('[data-skip-step]');
  if (skip) goToStep(Number(skip.getAttribute('data-skip-step'))+1);
  const acceptBtn = ev.target.closest('[data-accept-field]');
  if (acceptBtn){
    markFieldConfirmed(acceptBtn.getAttribute('data-accept-field'));
    scheduleAutoSave();
  }
  const confirmBtn = ev.target.closest('[data-confirm-field]');
  if (confirmBtn){
    markFieldConfirmed(confirmBtn.getAttribute('data-confirm-field'));
    scheduleAutoSave();
  }
  const editBtn = ev.target.closest('[data-edit-field]');
  if (editBtn){
    const key = editBtn.getAttribute('data-edit-field');
    const input = document.getElementById(key);
    if (input) input.readOnly = false;
  }
  const help = ev.target.closest('.wizard-help');
  if (help && help.dataset.help) alert(help.dataset.help);
  const useReviewer = ev.target.closest('[data-use-profile-reviewer]');
  if (useReviewer){
    const card = useReviewer.closest('.wizard-svc-quick, .svc-delivery-card');
    if (card){
      const name = card.querySelector('[data-svc-field="clinicalReviewerName"]');
      const role = card.querySelector('[data-svc-field="clinicalReviewerRole"]');
      const status = card.querySelector('[data-svc-field="clinicalReviewerStatus"]');
      if (name && !name.value.trim() && name.getAttribute('placeholder')) name.value = name.getAttribute('placeholder');
      if (role && !role.value.trim() && role.getAttribute('placeholder')) role.value = role.getAttribute('placeholder');
      if (status) status.value = 'suggested';
      syncWizardServiceProfiles();
      scheduleAutoSave();
    }
  }
  const actionJump = ev.target.closest('[data-wizard-action-step]');
  if (actionJump) goToStep(Number(actionJump.getAttribute('data-wizard-action-step')));
});

function initServiceCarousel(){
  const cards = Array.from(document.querySelectorAll('.wizard-svc-quick, .svc-delivery-card'));
  const nav = document.getElementById('wizardServiceNav');
  if (!cards.length || !nav) return;
  nav.hidden = cards.length <= 1;
  serviceDetailIndex = Math.min(serviceDetailIndex, cards.length-1);
  cards.forEach((c,i)=>{ c.hidden = i !== serviceDetailIndex; });
  const counter = document.getElementById('wizardServiceCounter');
  if (counter) counter.textContent = 'Service '+(serviceDetailIndex+1)+' of '+cards.length;
}

document.getElementById('wizardServicePrev')?.addEventListener('click', ()=>{
  const cards = document.querySelectorAll('.wizard-svc-quick, .svc-delivery-card');
  if (!cards.length) return;
  serviceDetailIndex = Math.max(0, serviceDetailIndex-1);
  initServiceCarousel();
});
document.getElementById('wizardServiceNext')?.addEventListener('click', ()=>{
  const cards = document.querySelectorAll('.wizard-svc-quick, .svc-delivery-card');
  if (!cards.length) return;
  serviceDetailIndex = Math.min(cards.length-1, serviceDetailIndex+1);
  initServiceCarousel();
});

document.getElementById('wizardServiceGrid')?.addEventListener('change', ()=>{
  scheduleAutoSave();
});

document.getElementById('btnWizardEnrichLocal')?.addEventListener('click', async ()=>{
  const status = document.getElementById('wizardEnrichStatus');
  if (status) status.textContent = 'Loading local suggestions…';
  try {
    await saveProfile(true);
    const res = await fetch('/api/pharmacy/profile/'+SLUG+'/wizard-enrich-local', {
      method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:'{}'
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Enrichment failed');
    localCandidates = json.localIntelligenceCandidates || {};
    const candHidden = document.getElementById('localIntelligenceCandidates');
    if (candHidden) candHidden.value = JSON.stringify(localCandidates);
    renderLocalEntityGroups(json.groups || localCandidates);
    renderCompetitorHost(json.profileCompetitors || []);
    wizardEnrichPatch = {
      profileWizardEnrichedAt: json.profileWizardEnrichedAt || new Date().toISOString(),
      localIntelligenceGenerated: true,
      localIntelligenceGeneratedAt: json.profileWizardEnrichedAt || new Date().toISOString(),
      localIntelligenceCandidates: localCandidates,
      profileCompetitors: json.profileCompetitors || [],
    };
    if (status) status.textContent = 'Loaded '+ (json.source || 'local') +' · '+new Date().toLocaleString('en-GB');
    scheduleAutoSave();
  } catch(e){
    if (status) status.textContent = e.message || 'Failed to load suggestions';
  }
});

document.getElementById('btnGenerateAreas')?.addEventListener('click', async ()=>{
  const town = document.getElementById('primaryTown')?.value?.trim();
  const limit = Number(document.getElementById('areaSuggestLimit')?.value || 10);
  if (!town){ alert('Enter main town first'); return; }
  const status = document.getElementById('areaGenStatus');
  if (status) status.textContent = 'Generating…';
  const res = await fetch('/api/pharmacy/profile/'+SLUG+'/discover-areas', {
    method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ town, limit, preserveSelection: areaState })
  });
  const json = await res.json();
  if (!json.ok){ if (status) status.textContent = json.error || 'Failed'; return; }
  areaState = json.discovery?.areas || json.areas || [];
  renderAreaChecklist();
  if (status) status.textContent = 'Generated '+areaState.length+' areas';
  scheduleAutoSave();
});

document.getElementById('btnAddManualArea')?.addEventListener('click', ()=>{
  const input = document.getElementById('manualAreaInput');
  const name = input?.value?.trim();
  if (!name) return;
  areaState.push({ areaName:name, areaType:'manual', priority:areaState.length+1, order:areaState.length+1, selected:true, source:'manual' });
  input.value = '';
  renderAreaChecklist();
  scheduleAutoSave();
});

document.getElementById('areaChecklist')?.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('button');
  const row = ev.target.closest('.area-row');
  if (!row) return;
  const idx = Number(row.getAttribute('data-area-index'));
  if (btn?.classList.contains('btn-area-remove')){ areaState.splice(idx,1); renderAreaChecklist(); scheduleAutoSave(); return; }
  if (btn?.classList.contains('btn-area-move')){
    const dir = btn.getAttribute('data-dir');
    const swap = dir === 'up' ? idx-1 : idx+1;
    if (swap < 0 || swap >= areaState.length) return;
    [areaState[idx], areaState[swap]] = [areaState[swap], areaState[idx]];
    renderAreaChecklist();
    scheduleAutoSave();
  }
});

document.getElementById('areaChecklist')?.addEventListener('change', (ev)=>{
  if (!ev.target.classList.contains('area-selected')) return;
  const row = ev.target.closest('.area-row');
  const idx = Number(row?.getAttribute('data-area-index'));
  if (Number.isNaN(idx) || !areaState[idx]) return;
  areaState[idx].selected = ev.target.checked;
  syncAreaHiddenFields();
  scheduleAutoSave();
});

document.querySelector('.wizard-shell')?.addEventListener('input', scheduleAutoSave);
document.querySelector('.wizard-shell')?.addEventListener('change', scheduleAutoSave);

loadAreaStateFromHidden();
renderAreaChecklist();
updateProgressUi();
if (wizardStep === 4) initServiceCarousel();
</script>
<script>${profileV2ClientScript()}</script>
<script>${renderBrandImportClientScript("pharmacy")}</script>
</body>
</html>`);
}
