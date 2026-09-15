import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const PHARMACY_CONFIG_DIR = path.join(ROOT, "config", "pharmacy");

function readConfigJson(file: string) {
  const p = path.join(PHARMACY_CONFIG_DIR, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

router.get("/pharmacy-setup", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const schema = readConfigJson("setup-schema.json");
  const library = readConfigJson("service-library.json");

  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Pharmacy Setup — PharmaConnect Growth Engine</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;color:#0f172a}
    header{background:#005eb8;color:white;padding:18px 28px}
    header h1{margin:0;font-size:22px}
    header p{margin:5px 0 0;color:#dbeafe}
    main{max-width:1180px;margin:24px auto;padding:0 18px}
    .progress-wrap{background:#dbeafe;border-radius:999px;height:12px;overflow:hidden;margin-top:12px}
    .progress-bar{height:100%;background:#22c55e;width:0%}
    .tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}
    .tab{border:1px solid #cbd5e1;background:white;border-radius:999px;padding:9px 13px;font-weight:800;cursor:pointer;color:#334155}
    .tab.active{background:#005eb8;color:white;border-color:#005eb8}
    .panel{background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:14px;overflow:hidden}
    .panel-head{padding:16px 18px;font-weight:900;background:#fff;border-bottom:1px solid #e2e8f0}
    .panel-body{padding:18px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    label{font-size:13px;font-weight:700;color:#334155;display:block;margin-bottom:6px}
    input,select,textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:10px;font-size:14px}
    .required{color:#dc2626}
    .service-group{margin-bottom:16px;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
    .service-group h3{margin:0 0 6px}
    .service-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}
    .check{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px;font-size:13px}
    .actions{position:sticky;bottom:0;background:white;border-top:1px solid #e2e8f0;padding:14px;margin-top:22px;display:flex;gap:10px;justify-content:space-between;align-items:center}
    button{border:0;border-radius:8px;padding:10px 16px;font-weight:800;cursor:pointer}
    .primary{background:#005eb8;color:white}
    .secondary{background:#e2e8f0;color:#0f172a}
    .score{float:right;background:#dcfce7;color:#166534;border-radius:999px;padding:4px 10px;font-size:12px}
    .score.fail{background:#fee2e2;color:#991b1b}
    .audit-pass{color:#15803d;font-weight:700}
    .audit-fail{color:#dc2626;font-weight:700}
    .audit-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
    .audit-table th,.audit-table td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
    .muted{color:#64748b;font-size:13px}
    .entity-group{margin-bottom:18px;border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc}
    .entity-group h3{margin:0 0 4px;font-size:16px}
    .entity-group .limit{font-size:12px;color:#64748b;margin-bottom:10px}
    .entity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .entity-card{background:white;border:1px solid #dbeafe;border-radius:8px;padding:10px;font-size:13px}
    .entity-card label{display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-weight:600}
    .entity-meta{color:#64748b;font-size:12px;margin-top:6px;line-height:1.45}
    .entity-meta span{display:block}
    .intro-copy{max-width:820px;line-height:1.55;margin-bottom:14px}
  </style>
</head>
<body>
<header>
  <h1>Pharmacy Business Setup <span class="score" id="score">Profile strength: 0%</span></h1>
  <p>Set up your pharmacy profile, local intelligence, services and areas — then generate content and competitor insights. <a href="/api/pharmacy-profile-dashboard?slug=pharmaconnect" style="color:#fff;font-weight:700">Open Profile Dashboard →</a></p>
  <div class="progress-wrap"><div class="progress-bar" id="progressBar"></div></div>
</header>

<main>
  <div class="tabs" id="tabs"></div>
  <div id="app">Loading pharmacy setup...</div>
</main>

<script>
let SETUP_SCHEMA = ${JSON.stringify(schema)};
let SERVICE_LIBRARY = ${JSON.stringify(library)};
let ACTIVE_TAB = 0;
let TAB_SECTIONS = [];
let PROFILE_DATA = {};
let PROFILE_AUDIT = null;

const TAB_MAP = [
  {id:'profile', label:'Pharmacy Profile', sections:['pharmacy_basics','contact_details'], intro:'Enter your pharmacy name, contact details and website. These appear on generated pages and trust signals.'},
  {id:'trust', label:'Trust & Regulatory', sections:['trust_compliance','trust_signals'], intro:'Add GPhC registration, NHS profile links and superintendent details. Strong trust fields improve patient confidence and SEO.'},
  {id:'location', label:'Location Intelligence', sections:['location','local_authority'], intro:'Confirm your address, postcode and coverage radius. Use postcode lookup to fill town, county and NHS location fields automatically.'},
  {id:'local-intelligence', label:'Local Intelligence', sections:[], intro:'Discover nearby GP surgeries, hospitals, schools and community places. Select the locations that should appear in your local content.'},
  {id:'services', label:'Services', sections:['services','patient_access','facilities'], intro:'Choose the pharmacy services you offer. Selected services drive page generation, FAQs and local SEO coverage.'},
  {id:'growth', label:'Growth & SEO', sections:['seo_profile'], intro:'Set your target areas, patient groups and growth goals. Ranking areas control which local service pages are generated.'},
  {id:'content', label:'Content Intelligence', sections:['content_intelligence','content_preferences'], intro:'Define tone, patient questions and unique selling points used in generated content.'},
  {id:'review', label:'Review & Save', sections:[], intro:'Review your profile audit, save your setup, then continue the demo launch path.'}
];

const LOCAL_INTEL_GROUPS = [
  {key:'gpSurgeries', label:'GP Surgeries', limit:8},
  {key:'hospitals', label:'Hospitals', limit:4},
  {key:'healthCentres', label:'Health Centres', limit:6},
  {key:'careHomes', label:'Care Homes', limit:8},
  {key:'schools', label:'Schools', limit:8},
  {key:'landmarks', label:'Landmarks', limit:8},
  {key:'communityFacilities', label:'Community Facilities', limit:8},
  {key:'transportLinks', label:'Transport Links', limit:6},
  {key:'retailCentres', label:'Retail Centres', limit:6},
  {key:'residentialAreas', label:'Residential Areas', limit:10}
];

let LOCAL_INTEL_CANDIDATES = {};

async function loadSetup(){
  if(!SETUP_SCHEMA || !SERVICE_LIBRARY){
    document.getElementById('app').innerHTML = '<p>Unable to load pharmacy setup configuration.</p>';
    return;
  }

  try {
    const res = await fetch('/api/pharmacy/profile/pharmaconnect', {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();

    if(data.ok && data.exists && data.profile && data.profile.data){
      PROFILE_DATA = data.profile.data;
      PROFILE_AUDIT = data.audit || null;
      LOCAL_INTEL_CANDIDATES = PROFILE_DATA.localIntelligenceCandidates || {};
    }
  } catch(e) {
    console.warn('Profile load skipped', e);
  }

  TAB_SECTIONS = TAB_MAP;
  renderTabs();
  renderActiveTab();
}

function renderTabs(){
  document.getElementById('tabs').innerHTML = TAB_SECTIONS.map((t,i) =>
    '<button class="tab '+(i===ACTIVE_TAB?'active':'')+'" onclick="setTab('+i+')">'+escapeHtml(t.label)+'</button>'
  ).join('');
}

function setTab(i){
  captureCurrentTabData();
  ACTIVE_TAB = i;
  renderTabs();
  renderActiveTab();
}

function getSectionsForActiveTab(){
  const tab = TAB_SECTIONS[ACTIVE_TAB];
  return (SETUP_SCHEMA.sections || []).filter(s => tab.sections.includes(s.id));
}

function renderActiveTab(){
  const tab = TAB_SECTIONS[ACTIVE_TAB];
  const sections = getSectionsForActiveTab();
  let html = '';

  if(tab.id === 'review'){
    html += '<div class="panel"><div class="panel-head">Onboarding Launch Path</div><div class="panel-body"><ol class="intro-copy" style="margin:0;padding-left:20px"><li><strong>Complete profile</strong> — fill all required tabs and save</li><li><strong>Generate local intelligence</strong> — Local Intelligence tab</li><li><strong>Select local entities</strong> — tick relevant places, then save</li><li><strong>Run competitor intelligence</strong> — <a href="/api/pharmacy-competitor-dashboard">Competitor Dashboard</a></li><li><strong>Generate pages</strong> — pages build from saved profile (240 publish-ready)</li><li><strong>View executive dashboard</strong> — <a href="/api/pharmacy-executive-dashboard"><strong>Executive Dashboard</strong></a> · <a href="/api/pharmacy-launch-demo">Launch Guide</a></li></ol></div></div>';
    html += '<div class="panel"><div class="panel-head">Profile Audit</div><div class="panel-body" id="auditPanel"><p class="muted">Loading audit...</p></div></div>';
    html += '<div class="panel"><div class="panel-head">Review & Save</div><div class="panel-body"><p class="muted">Check your profile audit below, then save. Saving stores your profile, selected services, local entities and ranking areas.</p><button class="primary" onclick="saveProfile()" style="font-size:16px;padding:14px 22px">Save Pharmacy Profile</button><button class="primary" onclick="generateIntelligence()" style="font-size:16px;padding:14px 22px;background:#0f766e;margin-left:8px">Generate Intelligence Report</button><p id="saveMsg" class="muted" style="margin-top:12px"></p><p id="intelligenceMsg" class="muted" style="margin-top:8px"></p></div></div>';
  } else if(tab.id === 'local-intelligence'){
    html += '<div class="panel"><div class="panel-head">Local Intelligence</div><div class="panel-body">';
    html += '<p class="intro-copy">We analyse your pharmacy address to find nearby healthcare locations, schools and community places. Select the ones that are genuinely relevant to your patients.</p>';
    html += '<p class="muted">Tip: generate first, review suggestions, untick anything irrelevant, then save your profile on the Review tab.</p>';
    html += '<button class="primary" id="generateLocalIntelBtn" onclick="generateLocalIntelligence()" style="font-size:15px;padding:12px 18px;background:#0f766e;margin:14px 0">Generate Local Intelligence</button>';
    html += '<p id="localIntelSelectionMsg" class="muted"></p>';
    html += '<div id="localIntelSelectionGroups"></div>';
    html += '</div></div>';
  } else if(!sections.length){
    html += '<div class="panel"><div class="panel-head">'+escapeHtml(tab.label)+'</div><div class="panel-body"><p class="muted">This section is ready for the next intelligence fields.</p></div></div>';
  } else {
    if(tab.intro){
      html += '<p class="intro-copy">'+escapeHtml(tab.intro)+'</p>';
    }
    sections.forEach(section => {
      html += '<div class="panel">';
      html += '<div class="panel-head">'+escapeHtml(section.label)+' '+(section.required?'<span class="required">*</span>':'')+'</div>';
      html += '<div class="panel-body">';

      if(section.id === 'services'){
        html += '<p class="muted" style="margin-bottom:12px">Tick every service your pharmacy offers. These drive service pages, hubs and local area content.</p>';
        (SERVICE_LIBRARY.serviceGroups || []).forEach(g => {
          html += '<div class="service-group">';
          html += '<h3>'+escapeHtml(g.label)+'</h3>';
          html += '<p class="muted">'+escapeHtml(g.description || '')+'</p>';
          html += '<div class="service-grid">';
          (g.services || []).forEach(s => {
            html += '<label class="check"><input type="checkbox" data-service="'+escapeHtml(s.id)+'"/> '+escapeHtml(s.label)+'</label>';
          });
          html += '</div></div>';
        });
      } else {
        html += '<div class="grid">';
        (section.fields || []).forEach(f => html += fieldHtml(f));
        html += '</div>';
      }

      html += '</div></div>';
    });
  }

  html += '<div class="actions"><button class="secondary" onclick="prevTab()">Previous</button><div><button class="secondary" onclick="location.href=\\'/api/pharmacy-launch-demo\\'">Launch Guide</button> <button class="secondary" onclick="location.href=\\'/api/dashboard\\'">Dashboard</button> <button class="primary" onclick="nextTab()">Next</button></div></div>';

  document.getElementById('app').innerHTML = html;
  hydrateRenderedFields();
  if(tab.id === 'local-intelligence') renderLocalIntelSelectionGroups();
  document.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('input', () => { captureCurrentTabData(); updateScore(); }));
  document.querySelectorAll('input[type=checkbox]').forEach(el => el.addEventListener('change', () => { captureCurrentTabData(); updateScore(); }));
  updateScore();
  if(tab.id === 'review') renderAuditPanel();
}

function prevTab(){ if(ACTIVE_TAB > 0) setTab(ACTIVE_TAB - 1); }
function nextTab(){ if(ACTIVE_TAB < TAB_SECTIONS.length - 1) setTab(ACTIVE_TAB + 1); }

function fieldHtml(f){
  const req = f.required ? '<span class="required">*</span>' : '';

  if(f.type === 'postcode_lookup'){
    return '<div style="grid-column:1/-1"><label>'+f.label+' '+req+'</label><div style="display:flex;gap:8px"><input id="postcodeLookupInput" type="text" placeholder="Enter postcode, e.g. S60 2DH" data-required="'+!!f.required+'"/><button type="button" class="secondary" onclick="findAddress()">Find Address</button></div><p id="postcodeLookupMsg" class="muted">Use this to populate address, town, county, local authority and NHS location data.</p></div>';
  }

  if(f.id === 'coverageRadius'){
    const opts = (f.options || []).map(o => '<option value="'+escapeHtml(o)+'">'+escapeHtml(o)+'</option>').join('');
    return '<div><label>'+f.label+' '+req+'</label><div style="display:flex;gap:8px"><select id="coverageRadiusSelect" data-field="'+escapeHtml(f.id)+'" data-required="'+!!f.required+'"><option value="">Select...</option>'+opts+'</select><button type="button" class="secondary" onclick="findNearbyAreas()">Find Nearby Areas</button></div></div>';
  }

  if(f.type === 'select'){
    const opts = (f.options || []).map(o => '<option value="'+escapeHtml(o)+'">'+escapeHtml(o)+'</option>').join('');
    return '<div><label>'+f.label+' '+req+'</label><select data-field="'+escapeHtml(f.id)+'" data-required="'+!!f.required+'" data-value="'+escapeHtml(PROFILE_DATA[f.id] || '')+'"><option value="">Select...</option>'+opts+'</select></div>';
  }

  if(f.type === 'boolean'){
    const checked = PROFILE_DATA[f.id] === true ? ' checked' : '';
    return '<div class="check"><label><input type="checkbox" data-field="'+escapeHtml(f.id)+'" data-boolean="true"'+checked+'/> '+f.label+'</label></div>';
  }

  if(f.type === 'multi_text'){
    return '<div><label>'+f.label+' '+req+'</label><textarea data-field="'+escapeHtml(f.id)+'" rows="3" placeholder="Add one per line">'+escapeHtml(Array.isArray(PROFILE_DATA[f.id]) ? PROFILE_DATA[f.id].join(String.fromCharCode(10)) : (PROFILE_DATA[f.id] || ''))+'</textarea></div>';
  }

  if(f.type === 'multi_checkbox'){
    const opts = (f.options || []).map(o => '<label class="check"><input type="checkbox" data-field="'+escapeHtml(f.id)+'" value="'+escapeHtml(o)+'"/> '+escapeHtml(o)+'</label>').join('');
    return '<div style="grid-column:1/-1"><label>'+f.label+'</label><div class="service-grid">'+opts+'</div></div>';
  }

  return '<div><label>'+f.label+' '+req+'</label><input type="'+escapeHtml(f.type || 'text')+'" data-field="'+escapeHtml(f.id)+'" data-required="'+!!f.required+'" value="'+escapeHtml(PROFILE_DATA[f.id] || '')+'"/></div>';
}

async function findAddress(){
  const pc = document.getElementById('postcodeLookupInput')?.value || '';
  const msg = document.getElementById('postcodeLookupMsg');

  if(!pc.trim()){
    msg.textContent = 'Enter a postcode first.';
    msg.style.color = '#dc2626';
    return;
  }

  msg.textContent = 'Looking up postcode...';
  msg.style.color = '#005eb8';

  try {
    const res = await fetch('/api/pharmacy/postcode-lookup?postcode=' + encodeURIComponent(pc), { credentials:'same-origin', headers:{'Accept':'application/json'} });

    if(res.redirected || res.url.includes('/api/login')){
      msg.textContent = 'Session expired. Refresh the page and log in again.';
      msg.style.color = '#dc2626';
      return;
    }

    const contentType = res.headers.get('content-type') || '';
    if(!contentType.includes('application/json')){
      msg.textContent = 'Lookup returned non-JSON. Refresh and log in again.';
      msg.style.color = '#dc2626';
      return;
    }

    const data = await res.json();

    if(!data.ok){
      msg.textContent = data.error || 'Postcode lookup failed.';
      msg.style.color = '#dc2626';
      return;
    }

    setFieldValue('postcode', data.postcode || pc.toUpperCase());
    setFieldValue('townCity', data.townCity || '');
    setFieldValue('county', data.county || '');
    setFieldValue('localAuthority', data.localAuthority || '');
    setFieldValue('icb', data.icb || '');
    setFieldValue('nhsRegion', data.nhsRegion || '');

    msg.textContent = 'Postcode found. Location fields populated.';
    msg.style.color = '#15803d';
    updateScore();
  } catch(e) {
    msg.textContent = 'Lookup failed. Please try again.';
    msg.style.color = '#dc2626';
  }
}

function setFieldValue(fieldId, value){
  PROFILE_DATA[fieldId] = value || '';
  const el = document.querySelector('[data-field="'+fieldId+'"]');
  if(el) el.value = value || '';
}

function findNearbyAreas(){
  const radius = document.getElementById('coverageRadiusSelect')?.value || '';
  if(!radius){
    alert('Select a coverage radius first.');
    return;
  }
  const ranking = Array.isArray(PROFILE_DATA.rankingAreas) ? PROFILE_DATA.rankingAreas : [];
  const existing = Array.isArray(PROFILE_DATA.nearbyAreas) ? PROFILE_DATA.nearbyAreas : [];
  const suggested = ranking.length ? ranking : existing;
  if(!suggested.length){
    alert('Add areas in Growth & SEO first (Areas You Want To Rank In), then use this to copy them here.');
    return;
  }
  PROFILE_DATA.nearbyAreas = suggested.slice();
  const el = document.querySelector('[data-field="nearbyAreas"]');
  if(el) el.value = suggested.join(String.fromCharCode(10));
  captureCurrentTabData();
  updateScore();
  alert('Nearby areas updated from your ranking areas (' + suggested.length + ' areas). Edit the list if needed.');
}

function hydrateRenderedFields(){
  document.querySelectorAll('select[data-field][data-value]').forEach(el => {
    const v = el.getAttribute('data-value') || '';
    if(v) el.value = v;
  });

  document.querySelectorAll('[data-field][type="checkbox"]').forEach(el => {
    const key = el.getAttribute('data-field');
    const stored = PROFILE_DATA[key];
    if(el.getAttribute('data-boolean') === 'true'){
      el.checked = stored === true;
    } else if(Array.isArray(stored)){
      el.checked = stored.includes(el.value) || stored.includes(true);
    } else if(stored === true){
      el.checked = true;
    }
  });

  document.querySelectorAll('[data-service]').forEach(el => {
    const selected = PROFILE_DATA.selectedServices || [];
    el.checked = selected.includes(el.getAttribute('data-service'));
  });
}

function captureCurrentTabData(){
  document.querySelectorAll('[data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if(!key) return;

    if(el.type === 'checkbox'){
      const siblings = document.querySelectorAll('[data-field="'+key+'"]');
      if(siblings.length === 1 && siblings[0].getAttribute('data-boolean') === 'true'){
        PROFILE_DATA[key] = el.checked;
      } else {
        if(!PROFILE_DATA[key]) PROFILE_DATA[key] = [];
        PROFILE_DATA[key] = Array.from(document.querySelectorAll('[data-field="'+key+'"]:checked')).map(x => x.value || true);
      }
    } else if(el.tagName === 'TEXTAREA'){
      PROFILE_DATA[key] = el.value.split(String.fromCharCode(10)).map(v => v.trim()).filter(Boolean);
    } else {
      PROFILE_DATA[key] = el.value || '';
    }
  });

  const visibleServiceBoxes = document.querySelectorAll('[data-service]');
  if(visibleServiceBoxes.length){
    PROFILE_DATA.selectedServices = Array.from(document.querySelectorAll('[data-service]:checked')).map(el => el.getAttribute('data-service'));
  }
}

function updateScore(){
  if(PROFILE_AUDIT && typeof PROFILE_AUDIT.score === 'number'){
    const pct = PROFILE_AUDIT.score;
    const scoreEl = document.getElementById('score');
    scoreEl.textContent = 'Profile audit: ' + pct + '%' + (PROFILE_AUDIT.passed ? ' — PASS' : ' — needs work');
    scoreEl.className = 'score' + (PROFILE_AUDIT.passed ? '' : ' fail');
    document.getElementById('progressBar').style.width = pct + '%';
    return;
  }

  const required = Array.from(document.querySelectorAll('[data-required="true"]'));
  const filled = required.filter(el => (el.value || '').trim()).length;
  const services = document.querySelectorAll('[data-service]:checked').length;
  const total = required.length + 1;
  const done = filled + (services > 0 ? 1 : 0);
  const pct = total ? Math.round((done/total)*100) : 0;
  document.getElementById('score').textContent = 'Profile strength: ' + pct + '%';
  document.getElementById('progressBar').style.width = pct + '%';
}

async function refreshAudit(){
  captureCurrentTabData();
  try {
    const res = await fetch('/api/pharmacy/profile/pharmaconnect/audit', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(collectProfileData())
    });
    if(res.ok){
      const data = await res.json();
      if(data.ok && data.audit){
        PROFILE_AUDIT = data.audit;
        updateScore();
        return data.audit;
      }
    }
  } catch(e) {
    console.warn('Audit refresh skipped', e);
  }
  return null;
}

function renderAuditPanel(){
  const panel = document.getElementById('auditPanel');
  if(!panel) return;

  refreshAudit().then(audit => {
    if(!audit){
      panel.innerHTML = '<p class="muted">Save the profile to run a full audit.</p>';
      return;
    }

    const status = audit.passed
      ? '<span class="audit-pass">PASS — ' + audit.score + '%</span>'
      : '<span class="audit-fail">INCOMPLETE — ' + audit.score + '% (' + audit.requiredPassed + '/' + audit.requiredTotal + ' required)</span>';

    let html = '<p>' + status + '</p>';
    html += '<table class="audit-table"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>';
    (audit.checks || []).forEach(c => {
      html += '<tr><td>' + escapeHtml(c.label) + (c.required ? ' *' : '') + '</td><td>' + (c.passed ? '✓' : '✗') + '</td><td>' + escapeHtml(c.message) + '</td></tr>';
    });
    html += '</tbody></table>';

    if((audit.recommendations || []).length){
      html += '<p style="margin-top:14px;font-weight:700">Recommendations</p><ul class="muted">';
      audit.recommendations.forEach(r => { html += '<li>' + escapeHtml(r) + '</li>'; });
      html += '</ul>';
    }

    panel.innerHTML = html;
  });
}

async function saveProfile(){
  captureCurrentTabData();
  const profile = collectProfileData();
  const saveMsg = document.getElementById('saveMsg');
  if(saveMsg) saveMsg.textContent = 'Saving profile…';

  try {
    const res = await fetch('/api/pharmacy/profile/pharmaconnect', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(profile)
    });

    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch(e) {
      if(saveMsg) saveMsg.textContent = 'Save failed — server returned an unexpected response.';
      return;
    }

    if(!res.ok || !data.ok){
      if(saveMsg) saveMsg.textContent = 'Save failed: ' + (data.error || ('HTTP ' + res.status));
      return;
    }

    if(data.audit) PROFILE_AUDIT = data.audit;
    updateScore();
    if(saveMsg) saveMsg.innerHTML = 'Profile saved successfully.' + (data.audit && !data.audit.passed ? ' Some required checks still need attention — see audit below.' : '') + ' <a href="/api/pharmacy-executive-dashboard" style="font-weight:700">Open Executive Dashboard →</a>';
    if(ACTIVE_TAB === TAB_SECTIONS.findIndex(t => t.id === 'review')) renderAuditPanel();
  } catch(e) {
    if(saveMsg) saveMsg.textContent = 'Save failed: ' + (e && e.message ? e.message : 'Unknown error');
  }
}

function collectProfileData(){
  captureCurrentTabData();
  if(typeof captureLocalEntitySelections === 'function') captureLocalEntitySelections();
  return PROFILE_DATA;
}

function selectedEntityIdsForGroup(groupKey){
  const saved = PROFILE_DATA[groupKey] || [];
  return new Set((saved || []).map(function(e){
    if(typeof e === 'string') return e;
    return e.id || e.name;
  }));
}

function isEntitySelected(groupKey, entity){
  const selected = selectedEntityIdsForGroup(groupKey);
  return selected.has(entity.id) || selected.has(entity.name);
}

function renderLocalIntelSelectionGroups(){
  const container = document.getElementById('localIntelSelectionGroups');
  if(!container) return;

  let html = '';
  LOCAL_INTEL_GROUPS.forEach(function(group){
    const candidates = LOCAL_INTEL_CANDIDATES[group.key] || PROFILE_DATA[group.key] || [];
    if(!candidates.length) return;

    html += '<div class="entity-group" data-entity-group="'+escapeHtml(group.key)+'">';
    html += '<h3>'+escapeHtml(group.label)+'</h3>';
    html += '<div class="limit">Suggested limit: '+group.limit+' · tick the places you want to use in generated content</div>';
    html += '<div class="entity-grid">';

    candidates.forEach(function(entity, idx){
      const item = typeof entity === 'string' ? {id: group.key+'-'+idx, name: entity, address:'', category: group.label, source:'local intelligence', distanceLabel:''} : entity;
      const checked = isEntitySelected(group.key, item) ? ' checked' : '';
      html += '<div class="entity-card">';
      html += '<label><input type="checkbox" data-entity-group="'+escapeHtml(group.key)+'" data-entity-id="'+escapeHtml(item.id || item.name)+'"'+checked+' onchange="captureLocalEntitySelections()"/> '+escapeHtml(item.name)+'</label>';
      html += '<div class="entity-meta">';
      if(item.address) html += '<span>'+escapeHtml(item.address)+'</span>';
      if(item.category) html += '<span>'+escapeHtml(item.category)+'</span>';
      if(item.distanceLabel) html += '<span>'+escapeHtml(item.distanceLabel)+'</span>';
      html += '<span>Source: '+escapeHtml(item.source || 'local intelligence')+'</span>';
      html += '</div></div>';
    });

    html += '</div></div>';
  });

  if(!html){
    html = '<p class="muted">No local intelligence yet. Click <strong>Generate Local Intelligence</strong> to discover nearby places.</p>';
  }

  container.innerHTML = html;
}

function captureLocalEntitySelections(){
  LOCAL_INTEL_GROUPS.forEach(function(group){
    const candidates = LOCAL_INTEL_CANDIDATES[group.key] || [];
    const selected = [];
    document.querySelectorAll('[data-entity-group="'+group.key+'"]:checked').forEach(function(el){
      const id = el.getAttribute('data-entity-id');
      const match = candidates.find(function(c){
        const item = typeof c === 'string' ? {id: c, name: c} : c;
        return (item.id || item.name) === id;
      });
      if(match){
        selected.push(typeof match === 'string' ? {name: match, entityType: group.key, source: 'local intelligence', selected: true} : Object.assign({}, match, {selected: true}));
      }
    });
    PROFILE_DATA[group.key] = selected;
  });
}

async function generateLocalIntelligence(){
  captureCurrentTabData();
  const msg = document.getElementById('localIntelSelectionMsg');
  if(msg) msg.textContent = 'Generating local intelligence...';

  try {
    const res = await fetch('/api/pharmacy-local-intelligence/pharmaconnect/generate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        slug: 'pharmaconnect',
        address: PROFILE_DATA.addressLine1 || '',
        postcode: PROFILE_DATA.postcode || '',
        townCity: PROFILE_DATA.townCity || '',
        latitude: PROFILE_DATA.latitude || '',
        longitude: PROFILE_DATA.longitude || '',
        demoMode: PROFILE_DATA.demoMode === true
      })
    });

    const data = await res.json();
    if(!data.ok){
      if(msg) msg.textContent = 'Local intelligence failed: ' + (data.error || 'Unknown error');
      return;
    }

    LOCAL_INTEL_CANDIDATES = data.groups || {};
    PROFILE_DATA.localIntelligenceCandidates = LOCAL_INTEL_CANDIDATES;
    PROFILE_DATA.localIntelligenceGenerated = true;
    PROFILE_DATA.localIntelligenceGeneratedAt = data.localIntelligence?.generatedAt || new Date().toISOString();

    LOCAL_INTEL_GROUPS.forEach(function(group){
      const items = (LOCAL_INTEL_CANDIDATES[group.key] || []).slice(0, group.limit);
      PROFILE_DATA[group.key] = items.map(function(item){ return Object.assign({}, item, {selected: true}); });
    });

    if(msg) msg.textContent = 'Local intelligence generated. Review the suggestions below, adjust your selections, then save the profile.';
    renderLocalIntelSelectionGroups();
    updateScore();
  } catch(e) {
    if(msg) msg.textContent = 'Local intelligence failed.';
  }
}

async function buildLocalIntelligence(){
  captureCurrentTabData();

  const msg = document.getElementById('localIntelMsg');
  const results = document.getElementById('localIntelResults');

  if(msg) msg.textContent = 'Building local intelligence...';
  if(results) results.innerHTML = '';

  try {
    const res = await fetch('/api/pharmacy/local-intelligence/pharmaconnect/build', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        townCity: PROFILE_DATA.townCity || '',
        postcode: PROFILE_DATA.postcode || '',
        localAuthority: PROFILE_DATA.localAuthority || '',
        icb: PROFILE_DATA.icb || '',
        nhsRegion: PROFILE_DATA.nhsRegion || '',
        coverageRadius: PROFILE_DATA.coverageRadius || ''
      })
    });

    const data = await res.json();

    if(!data.ok){
      if(msg) msg.textContent = 'Local intelligence failed: ' + (data.error || 'Unknown error');
      return;
    }

    const li = data.localIntelligence || {};

    PROFILE_DATA.localAreas = li.localAreas || [];
    PROFILE_DATA.localLandmarks = li.localLandmarks || [];
    PROFILE_DATA.localHealthcareLocations = li.localHealthcareLocations || [];
    PROFILE_DATA.localGps = li.localGps || [];
    PROFILE_DATA.localHospitals = li.localHospitals || [];
    PROFILE_DATA.localDentists = li.localDentists || [];
    PROFILE_DATA.localPharmacies = li.localPharmacies || [];
    PROFILE_DATA.localCommunityLocations = li.localCommunityLocations || [];
    PROFILE_DATA.localSchools = li.localSchools || [];
    PROFILE_DATA.localCareHomes = li.localCareHomes || [];
    PROFILE_DATA.localTransportLinks = li.localTransportLinks || [];
    PROFILE_DATA.localRetailCentres = li.localRetailCentres || [];
    PROFILE_DATA.localResidentialAreas = li.localResidentialAreas || [];

    if(msg) msg.textContent = 'Local intelligence built successfully. Review the suggestions below, then save the profile.';

    if(results){
      results.innerHTML =
        renderLocalIntelPanel('Suggested Areas', PROFILE_DATA.localAreas, 'localAreas') +
        renderLocalIntelPanel('Suggested Landmarks', PROFILE_DATA.localLandmarks, 'localLandmarks') +
        renderLocalIntelPanel('GP Surgeries & Health Centres', PROFILE_DATA.localGps, 'localGps') +
        renderLocalIntelPanel('Hospitals & Urgent Care', PROFILE_DATA.localHospitals, 'localHospitals') +
        renderLocalIntelPanel('Care Homes', PROFILE_DATA.localCareHomes, 'localCareHomes') +
        renderLocalIntelPanel('Dental Practices', PROFILE_DATA.localDentists, 'localDentists') +
        renderLocalIntelPanel('Nearby Pharmacies', PROFILE_DATA.localPharmacies, 'localPharmacies') +
        renderLocalIntelPanel('Schools & Colleges', PROFILE_DATA.localSchools, 'localSchools') +
        renderLocalIntelPanel('Community Locations', PROFILE_DATA.localCommunityLocations, 'localCommunityLocations') +
        renderLocalIntelPanel('Retail Centres', PROFILE_DATA.localRetailCentres, 'localRetailCentres') +
        renderLocalIntelPanel('Residential Areas', PROFILE_DATA.localResidentialAreas, 'localResidentialAreas');
    }

    updateScore();
  } catch(e) {
    if(msg) msg.textContent = 'Local intelligence failed.';
  }
}

function renderLocalIntelPanel(title, items, key){
  if(!items || !items.length) return '';

  const checks = (items || []).map((x, i) =>
    '<label class="check"><input type="checkbox" checked data-local-key="'+escapeHtml(key)+'" value="'+escapeHtml(x)+'" onchange="captureLocalIntelSelections()"/> '+escapeHtml(x)+'</label>'
  ).join('');

  return '<div class="card" style="margin-bottom:0"><h2>'+escapeHtml(title)+'</h2><div>'+checks+'</div></div>';
}

function captureLocalIntelSelections(){
  ['localAreas','localLandmarks','localHealthcareLocations','localGps','localHospitals','localDentists','localPharmacies','localCommunityLocations','localSchools','localCareHomes','localRetailCentres','localResidentialAreas'].forEach(key => {
    PROFILE_DATA[key] = Array.from(document.querySelectorAll('[data-local-key="'+key+'"]:checked')).map(el => el.value);
  });
}

async function generateIntelligence(){
  const msg = document.getElementById('intelligenceMsg');
  if(msg) msg.textContent = 'Generating pharmacy intelligence...';

  try {
    const res = await fetch('/api/pharmacy/intelligence/pharmaconnect/generate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();

    if(!data.ok){
      if(msg) msg.textContent = 'Intelligence generation failed: ' + (data.error || 'Unknown error');
      return;
    }

    if(msg) msg.innerHTML = 'Pharmacy intelligence generated. <a href="/api/pharmacy-executive-dashboard" style="font-weight:700">Open Executive Dashboard →</a>';
  } catch(e) {
    if(msg) msg.textContent = 'Intelligence generation failed.';
  }
}

function escapeHtml(str){
  return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

loadSetup();
</script>
</body>
</html>`);
});

export default router;
