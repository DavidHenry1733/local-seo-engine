/**
 * Customer-facing guided completion page for campaign content quality fields.
 * Saves profile data only; it never regenerates campaign content.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../../../../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../../../../src/pharmacy/contentEngine/contentEngineContract.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
} from "../../../../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { computeWizardQualityScore } from "../../../../src/pharmacy/pharmacyProfileWizardScoring.ts";
import {
  normalizeProfileData,
  normalizeProfileDoc,
  PROFILE_SCHEMA_VERSION,
  type PharmacyProfileData,
  type ProfileAreaEntry,
} from "../../../../src/pharmacy/pharmacyProfileSchema.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";

const router = Router();
const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const PROFILE_DIR = path.join(ROOT, "data", "pharmacy-profiles");
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const CAMPAIGN_ID = "pharmacy-first";
const PATIENT_GROUP_PRESETS = [
  "Families with children",
  "Older adults",
  "Working adults",
  "People managing long-term conditions",
  "Patients needing fast access to care",
  "People who find GP appointments difficult",
  "Local residents",
  "Carers",
];

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function profileFile(slug: string): string {
  return path.join(PROFILE_DIR, `${slug}.json`);
}

function loadProfile(slug: string): PharmacyProfileData {
  const file = profileFile(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

function websiteSuggestedDescription(data: PharmacyProfileData): string {
  return (
    data.websiteImportSnapshot?.description ||
    data.websiteImportSnapshot?.intelligence?.identity?.metaDescription ||
    data.websiteImportSnapshot?.intelligence?.business?.businessName?.selected ||
    ""
  ).trim();
}

function serviceName(serviceId: string, data: PharmacyProfileData): string {
  return data.serviceDeliveryProfiles?.[serviceId]?.serviceName || serviceId.replace(/-/g, " ");
}

function serviceIds(data: PharmacyProfileData): string[] {
  return (data.selectedServices || []).length ? data.selectedServices : [CAMPAIGN_ID];
}

function selectedServiceId(data: PharmacyProfileData): string {
  return serviceIds(data).includes(CAMPAIGN_ID) ? CAMPAIGN_ID : serviceIds(data)[0] || CAMPAIGN_ID;
}

function competitorReportExists(slug: string): boolean {
  return fs.existsSync(path.join(ROOT, "data", "growth-engine", `${slug}-competitors.json`));
}

function areaOptions(data: PharmacyProfileData): string[] {
  const names = new Set<string>();
  for (const area of data.selectedAreas || []) if (area.areaName) names.add(area.areaName);
  for (const name of [...(data.rankingAreas || []), ...(data.coverageAreas || []), ...(data.nearbyAreas || [])]) {
    if (name) names.add(name);
  }
  if (data.primaryTown || data.townCity) names.add(data.primaryTown || data.townCity);
  return [...names];
}

function entityOptions(data: PharmacyProfileData): Array<{ group: string; label: string }> {
  const groups: Array<[string, Array<{ name?: string }>] > = [
    ["Nearest GP surgeries", data.gpSurgeries || []],
    ["Nearest health centres", data.healthCentres || []],
    ["Relevant local landmarks", data.landmarks || []],
  ];
  return groups.flatMap(([group, rows]) => rows.filter((row) => row.name).map((row) => ({ group, label: row.name || "" })));
}

function uspOptions(data: PharmacyProfileData): string[] {
  const options: string[] = [];
  if (data.primaryTown || data.townCity || data.addressLine1) options.push("Convenient local access");
  if (data.consultationRoomAvailable) options.push("Private consultation available");
  if (data.reviewerName || data.superintendentPharmacistName) options.push("Experienced pharmacy team");
  if ((data.websiteImportSnapshot?.customerVisibleServices || []).some((service) => /prescription/i.test(service.serviceName))) {
    options.push("Online prescription support");
  }
  if (data.phone) options.push("Fast response by phone");
  if (data.addressLine1 && (data.primaryTown || data.townCity)) options.push("Accessible town-centre location");
  options.push("Clear patient guidance");
  options.push("Other");
  return [...new Set(options)];
}

function checked(list: string[], value: string): string {
  return list.includes(value) ? "checked" : "";
}

function status(id: string, ok: boolean): string {
  return `<span class="status ${ok ? "complete" : "incomplete"}" data-status-for="${esc(id)}">${ok ? "Complete" : "Action required"}</span>`;
}

function arrayBodyValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const single = String(value || "").trim();
  return single ? [single] : [];
}

function wantsJson(req: { get(name: string): string | undefined }): boolean {
  return /application\/json/i.test(req.get("accept") || "") || /XMLHttpRequest/i.test(req.get("x-requested-with") || "");
}

function saveSectionsFromBody(body: Record<string, unknown>): Set<string> {
  const section = String(body._saveSection || "all");
  const dirty = String(body._dirtySections || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([section, ...dirty]);
}

export function validateQualitySection(section: string, body: Record<string, unknown>, slug: string): string | null {
  if (section === "all") return null;
  if (section === "businessDescription" && !String(body.businessDescription || "").trim()) return "Business description is required.";
  if (section === "appointmentMethod" && !String(body.appointmentMethod || "").trim()) return "Choose an appointment or walk-in method.";
  if (section === "fundingModel" && !["nhs", "private", "mixed"].includes(String(body.fundingModel || ""))) return "Choose a confirmed funding model.";
  if (section === "localAreas" && ![...arrayBodyValue(body.serviceAreas), String(body.additionalArea || "").trim()].filter(Boolean).length) return "Select at least one service area.";
  if (section === "competitorsReviewed") {
    if (!competitorReportExists(slug)) return "Local competitor report is not available.";
    if (body.profileCompetitorsReviewed !== "true") return "Confirm you have reviewed competitors.";
  }
  if (section === "targetPatientGroups" && !arrayBodyValue(body.targetPatientGroups).length) return "Select at least one target patient group.";
  if (section === "uniqueSellingPoints" && ![...arrayBodyValue(body.uniqueSellingPoints).filter((value) => value !== "Other"), String(body.customUniqueSellingPoint || "").trim()].filter(Boolean).length) return "Select or enter at least one unique selling point.";
  return null;
}

export function saveProfileQualityFields(existing: PharmacyProfileData, body: Record<string, unknown>): PharmacyProfileData {
  const sections = saveSectionsFromBody(body);
  const shouldSave = (section: string): boolean => sections.has("all") || sections.has(section);
  const serviceId = String(body.serviceId || selectedServiceId(existing));
  const existingProfile = existing.serviceDeliveryProfiles?.[serviceId] || {
    serviceId,
    serviceName: serviceName(serviceId, existing),
    fundingModel: "unknown",
    appointmentRequired: null,
    walkInAvailable: null,
    consultationLengthMinutes: null,
    consultationLengthLabel: "",
    equipmentUsed: [],
    preparationRequired: [],
    aftercare: [],
    resultsProcess: "",
    referralProcess: "",
    pricing: "",
    ageRestrictions: "",
  };
  const appointmentMethod = String(body.appointmentMethod || "");
  const fundingModel = String(body.fundingModel || existingProfile.fundingModel);
  const serviceProfile = {
    ...existingProfile,
    fundingModel: shouldSave("fundingModel") ? (["nhs", "private", "mixed"].includes(fundingModel) ? fundingModel : "unknown") : existingProfile.fundingModel,
    appointmentRequired: shouldSave("appointmentMethod")
      ? appointmentMethod === "appointment" || appointmentMethod === "both" ? true : appointmentMethod === "walkin" ? false : existingProfile.appointmentRequired
      : existingProfile.appointmentRequired,
    walkInAvailable: shouldSave("appointmentMethod")
      ? appointmentMethod === "walkin" || appointmentMethod === "both" ? true : appointmentMethod === "appointment" ? false : existingProfile.walkInAvailable
      : existingProfile.walkInAvailable,
  };
  const selectedAreas = [
    ...arrayBodyValue(body.serviceAreas),
    String(body.additionalArea || "").trim(),
  ].filter(Boolean);
  const areaEntries: ProfileAreaEntry[] = selectedAreas.map((areaName, index) => ({
    areaName: String(areaName),
    areaType: index === 0 ? "primary-town" : "service-area",
    priority: index + 1,
    order: index + 1,
    selected: true,
    source: "profile-quality-page",
  }));
  const targetPatientGroups = arrayBodyValue(body.targetPatientGroups);
  const uniqueSellingPoints = arrayBodyValue(body.uniqueSellingPoints).filter((value) => value !== "Other");
  const customUsp = String(body.customUniqueSellingPoint || "").trim();
  if (customUsp) uniqueSellingPoints.push(customUsp);
  const competitorsReviewed = body.profileCompetitorsReviewed === "true";
  const now = new Date().toISOString();

  return normalizeProfileData({
    ...existing,
    businessDescription: shouldSave("businessDescription") ? String(body.businessDescription || "").trim() : existing.businessDescription,
    serviceDeliveryProfiles: {
      ...(existing.serviceDeliveryProfiles || {}),
      [serviceId]: serviceProfile,
    },
    selectedAreas: shouldSave("localAreas") && areaEntries.length ? areaEntries : existing.selectedAreas,
    coverageAreas: shouldSave("localAreas") && selectedAreas.length ? selectedAreas.map(String) : existing.coverageAreas,
    rankingAreas: shouldSave("localAreas") && selectedAreas.length ? selectedAreas.map(String) : existing.rankingAreas,
    targetPatientGroups: shouldSave("targetPatientGroups") ? targetPatientGroups : existing.targetPatientGroups,
    uniqueSellingPoints: shouldSave("uniqueSellingPoints") ? uniqueSellingPoints : existing.uniqueSellingPoints,
    profileCompetitorsReviewed: shouldSave("competitorsReviewed") ? competitorsReviewed || existing.profileCompetitorsReviewed : existing.profileCompetitorsReviewed,
    competitorReviewConfirmed: shouldSave("competitorsReviewed") ? competitorsReviewed || existing.competitorReviewConfirmed : existing.competitorReviewConfirmed,
    profileCompetitorsReviewedAt: shouldSave("competitorsReviewed") && competitorsReviewed ? now : existing.profileCompetitorsReviewedAt,
    bookingMethod: shouldSave("appointmentMethod") ? (appointmentMethod === "confirm" ? "contact-pharmacy-to-confirm" : "") : existing.bookingMethod,
  });
}

export function qualityFieldStatuses(data: PharmacyProfileData): Record<string, boolean> {
  const quality = computeWizardQualityScore(data);
  return Object.fromEntries(quality.requiredQualityFields.map((field) => [field.id, field.ok]));
}

function renderPage(slug: string, data: PharmacyProfileData, saved = false): string {
  const quality = computeWizardQualityScore(data);
  const ctx = buildContentGenerationContext(slug, CAMPAIGN_ID);
  const technical = computeTechnicalGenerationReadiness(validateContentGenerationContext(ctx), false);
  const commercial = computeCommercialPublishingReadiness(data);
  const suggestion = websiteSuggestedDescription(data);
  const serviceId = selectedServiceId(data);
  const delivery = data.serviceDeliveryProfiles?.[serviceId];
  const appointmentValue = delivery?.walkInAvailable && delivery?.appointmentRequired
    ? "both"
    : delivery?.walkInAvailable
      ? "walkin"
      : delivery?.appointmentRequired
        ? "appointment"
        : data.bookingMethod === "contact-pharmacy-to-confirm"
          ? "confirm"
          : "";
  const fundingValue = delivery?.fundingModel || "unknown";
  const areaNames = areaOptions(data);
  const entities = entityOptions(data);
  const competitorAvailable = competitorReportExists(slug);
  const selectedGroups = data.targetPatientGroups || [];
  const selectedUsps = data.uniqueSellingPoints || [];
  const usps = uspOptions(data);
  const selectedAreas = new Set((data.selectedAreas || []).filter((a) => a.selected !== false).map((a) => a.areaName));
  const complete = Object.fromEntries(quality.requiredQualityFields.map((field) => [field.id, field.ok]));
  const readinessUrl = `/api/pharmacy-profile-wizard?slug=${encodeURIComponent(slug)}#wizardStepHost`;

  const areaChecks = areaNames.map((name) => `<label><input type="checkbox" name="serviceAreas" value="${esc(name)}" ${selectedAreas.has(name) ? "checked" : ""}/> ${esc(name)}</label>`).join("");
  const entityList = entities.length
    ? entities.map((entity) => `<li><strong>${esc(entity.group)}:</strong> ${esc(entity.label)}</li>`).join("")
    : `<li>No GP, health-centre or landmark presets are currently imported.</li>`;
  const patientChecks = PATIENT_GROUP_PRESETS.map((name) => `<label><input type="checkbox" name="targetPatientGroups" value="${esc(name)}" ${checked(selectedGroups, name)}/> ${esc(name)}</label>`).join("");
  const uspChecks = usps.map((name) => `<label><input type="checkbox" name="uniqueSellingPoints" value="${esc(name)}" ${checked(selectedUsps, name)}/> ${esc(name)}</label>`).join("");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Profile Quality Completion · ${esc(data.pharmacyName || slug)}</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#005eb8,#003087);color:#fff;padding:22px 24px}
main{max-width:980px;margin:0 auto;padding:22px 18px 80px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.card,.section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 8px 24px rgba(15,23,42,.04)}
.card strong{font-size:24px;display:block}
.section h2{margin:0 0 6px;font-size:18px}
.status{float:right;font-size:11px;font-weight:900;text-transform:uppercase;border-radius:999px;padding:4px 8px}
.complete{background:#dcfce7;color:#166534}.incomplete{background:#ffedd5;color:#9a3412}
label{display:block;margin:8px 0;font-weight:650}
textarea,input[type=text]{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:10px;font-size:14px}
textarea{min-height:110px}
.hint{font-size:12px;color:#64748b}.suggestion{border:1px dashed #93c5fd;background:#eff6ff;border-radius:10px;padding:10px;margin:10px 0}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.btn{border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-block}
.primary{background:#005eb8;color:#fff}.ghost{background:#e2e8f0;color:#334155}.save{background:#047857;color:#fff}
fieldset{border:0;padding:0;margin:8px 0}.saved{background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:12px;margin-bottom:14px}
.save-status{position:sticky;top:0;z-index:5;display:inline-block;margin-bottom:12px;border-radius:999px;padding:8px 12px;background:#e2e8f0;color:#334155;font-weight:900}.save-status.dirty{background:#fef3c7;color:#92400e}.save-status.saving{background:#dbeafe;color:#1d4ed8}.save-status.saved-ok{background:#dcfce7;color:#166534}
.field-error{display:none;margin-top:10px;border-radius:10px;background:#fee2e2;color:#991b1b;padding:10px;font-weight:800}.field-error.show{display:block}.section.saved-flash{border-color:#86efac}
</style>
</head>
<body>
<header><h1>Profile Quality Completion</h1><p>${esc(data.pharmacyName || slug)} · Pharmacy First</p></header>
<main>
${saved ? `<div class="saved"><strong>Profile quality details saved.</strong> Campaign content quality has been recalculated. No content was regenerated.</div>` : ""}
<div id="saveStatus" class="save-status saved-ok">Saved</div>
<div class="grid">
<div class="card"><span>Technical Generation Readiness</span><strong>${technical.status}</strong></div>
<div class="card"><span>Commercial Publishing Readiness</span><strong>${commercial.status}</strong></div>
<div class="card"><span>Campaign Content Quality</span><strong id="qualityScore">${quality.overallScore}%</strong></div>
</div>
<form method="post" action="/api/pharmacy-profile-quality?slug=${encodeURIComponent(slug)}">
<section class="section" data-section="businessDescription"><h2>1. Business Description ${status("businessDescription", Boolean(complete.businessDescription))}</h2>
<p class="hint">Suggested from website. This is not accepted until you save.</p>
<div class="suggestion"><strong>Suggested from website</strong><p id="suggestedDescription">${esc(suggestion || "No website description was imported.")}</p></div>
<textarea id="businessDescription" name="businessDescription">${esc(data.businessDescription)}</textarea>
<div class="field-error" data-error-for="businessDescription"></div>
<div class="actions"><button type="button" class="btn ghost" id="useSuggestedDescription" ${suggestion ? "" : "disabled"}>Use Suggested Description</button><button type="button" class="btn ghost" onclick="document.getElementById('businessDescription').focus()">Edit Description</button><button type="button" class="btn primary save-continue" data-section="businessDescription">Save & Continue</button></div>
</section>
<section class="section" data-section="appointmentMethod"><h2>2. Appointment / Walk-In Method ${status("serviceAppointmentWalkIn", Boolean(complete.serviceAppointmentWalkIn))}</h2>
<p class="hint">Choose one clear option for ${esc(serviceName(serviceId, data))}.</p>
<fieldset>
<label><input type="radio" name="appointmentMethod" value="walkin" ${appointmentValue === "walkin" ? "checked" : ""}/> Walk-in available</label>
<label><input type="radio" name="appointmentMethod" value="appointment" ${appointmentValue === "appointment" ? "checked" : ""}/> Appointment available</label>
<label><input type="radio" name="appointmentMethod" value="both" ${appointmentValue === "both" ? "checked" : ""}/> Both</label>
<label><input type="radio" name="appointmentMethod" value="confirm" ${appointmentValue === "confirm" ? "checked" : ""}/> Contact pharmacy to confirm</label>
</fieldset>
<div class="field-error" data-error-for="appointmentMethod"></div>
<div class="actions"><button type="button" class="btn primary save-continue" data-section="appointmentMethod">Save & Continue</button></div>
</section>
<section class="section" data-section="fundingModel"><h2>3. Funding Model ${status("serviceFundingModel", Boolean(complete.serviceFundingModel))}</h2>
<p class="hint">Suggested from service definition: ${serviceId === CAMPAIGN_ID ? "NHS funded for Pharmacy First" : "No service-specific funding suggestion"}. The user must still confirm and save.</p>
<fieldset>
<label><input type="radio" name="fundingModel" value="nhs" ${fundingValue === "nhs" ? "checked" : ""}/> NHS funded</label>
<label><input type="radio" name="fundingModel" value="private" ${fundingValue === "private" ? "checked" : ""}/> Private service</label>
<label><input type="radio" name="fundingModel" value="mixed" ${fundingValue === "mixed" ? "checked" : ""}/> NHS and private</label>
<label><input type="radio" name="fundingModel" value="unknown" ${fundingValue === "unknown" ? "checked" : ""}/> Not confirmed</label>
</fieldset>
<div class="field-error" data-error-for="fundingModel"></div>
<div class="actions"><button type="button" class="btn primary save-continue" data-section="fundingModel">Save & Continue</button></div>
</section>
<section class="section" data-section="localAreas"><h2>4. Local Entities / Areas ${status("localEntitiesAreas", Boolean(complete.localEntitiesAreas))}</h2>
<p class="hint">Use existing Local Market data. At least one service area is required.</p>
${areaChecks || `<p class="hint">No service area presets were imported. Add one below.</p>`}
<label>Additional area <input type="text" name="additionalArea" value=""/></label>
<ul>${entityList}</ul>
<div class="field-error" data-error-for="localAreas"></div>
<div class="actions"><button type="button" class="btn primary save-continue" data-section="localAreas">Save & Continue</button></div>
</section>
<section class="section" data-section="competitorsReviewed"><h2>5. Competitors Reviewed ${status("competitorsReviewed", Boolean(complete.competitorsReviewed))}</h2>
<p>${competitorAvailable ? "Local competitor report available." : "No local competitor report is currently available."}</p>
<label><input type="checkbox" name="profileCompetitorsReviewed" value="true" ${data.profileCompetitorsReviewed ? "checked" : ""} ${competitorAvailable ? "" : "disabled"}/> Confirm I Have Reviewed Competitors</label>
<div class="field-error" data-error-for="competitorsReviewed"></div>
<div class="actions"><button type="button" class="btn primary save-continue" data-section="competitorsReviewed">Save & Continue</button></div>
</section>
<section class="section" data-section="targetPatientGroups"><h2>6. Target Patient Groups ${status("targetPatientGroups", Boolean(complete.targetPatientGroups))}</h2>
${patientChecks}
<div class="field-error" data-error-for="targetPatientGroups"></div>
<div class="actions"><button type="button" class="btn primary save-continue" data-section="targetPatientGroups">Save & Continue</button></div>
</section>
<section class="section" data-section="uniqueSellingPoints"><h2>7. Unique Selling Points ${status("uniqueSellingPoints", Boolean(complete.uniqueSellingPoints))}</h2>
<p class="hint">Presets are based only on confirmed/imported profile facts. Use Other for one custom point.</p>
${uspChecks}
<label>Optional custom selling point <input type="text" name="customUniqueSellingPoint" value=""/></label>
<div class="field-error" data-error-for="uniqueSellingPoints"></div>
<div class="actions"><button type="button" class="btn primary save-continue" data-section="uniqueSellingPoints">Save & Continue</button></div>
</section>
<input type="hidden" name="serviceId" value="${esc(serviceId)}"/>
<div class="actions"><button type="submit" class="btn save">Save All Profile Quality Details</button><a class="btn primary" href="${readinessUrl}">Return to readiness screen</a></div>
</form>
</main>
<script>
var form = document.querySelector('form');
var dirtySections = new Set();
var statusEl = document.getElementById('saveStatus');
function setSaveStatus(text, cls){
  statusEl.textContent = text;
  statusEl.className = 'save-status ' + cls;
}
function sectionForControl(el){
  var section = el.closest && el.closest('.section');
  return section ? section.getAttribute('data-section') : '';
}
form?.addEventListener('input', function(e){
  var section = sectionForControl(e.target);
  if (section) dirtySections.add(section);
  setSaveStatus('Unsaved changes', 'dirty');
});
form?.addEventListener('change', function(e){
  var section = sectionForControl(e.target);
  if (section) dirtySections.add(section);
  setSaveStatus('Unsaved changes', 'dirty');
});
document.getElementById('useSuggestedDescription')?.addEventListener('click', function(){
  var text = document.getElementById('suggestedDescription')?.textContent || '';
  if (text && !/^No website description/.test(text)) {
    document.getElementById('businessDescription').value = text;
    dirtySections.add('businessDescription');
    setSaveStatus('Unsaved changes', 'dirty');
  }
});
function values(name){
  return Array.from(form.querySelectorAll('[name="'+name+'"]')).filter(function(el){ return (el.type !== 'checkbox' && el.type !== 'radio') || el.checked; }).map(function(el){ return el.value; }).filter(Boolean);
}
function showError(sectionName, message){
  var error = document.querySelector('[data-error-for="'+sectionName+'"]');
  if (error) {
    error.textContent = message || '';
    error.classList.toggle('show', Boolean(message));
  }
}
function clientValidation(sectionName){
  if (sectionName === 'businessDescription' && !document.getElementById('businessDescription').value.trim()) return 'Business description is required.';
  if (sectionName === 'appointmentMethod' && !values('appointmentMethod').length) return 'Choose an appointment or walk-in method.';
  if (sectionName === 'fundingModel' && !values('fundingModel').filter(function(v){ return v !== 'unknown'; }).length) return 'Choose a confirmed funding model.';
  if (sectionName === 'localAreas' && !values('serviceAreas').length && !String(form.elements.additionalArea?.value || '').trim()) return 'Select at least one service area.';
  if (sectionName === 'competitorsReviewed' && !values('profileCompetitorsReviewed').length) return 'Confirm you have reviewed competitors.';
  if (sectionName === 'targetPatientGroups' && !values('targetPatientGroups').length) return 'Select at least one target patient group.';
  if (sectionName === 'uniqueSellingPoints' && !values('uniqueSellingPoints').filter(function(v){ return v !== 'Other'; }).length && !String(form.elements.customUniqueSellingPoint?.value || '').trim()) return 'Select or enter at least one unique selling point.';
  return '';
}
function updateFieldStatuses(statuses){
  var ids = {
    businessDescription: 'businessDescription',
    serviceAppointmentWalkIn: 'serviceAppointmentWalkIn',
    serviceFundingModel: 'serviceFundingModel',
    localEntitiesAreas: 'localEntitiesAreas',
    competitorsReviewed: 'competitorsReviewed',
    targetPatientGroups: 'targetPatientGroups',
    uniqueSellingPoints: 'uniqueSellingPoints'
  };
  Object.keys(ids).forEach(function(id){
    var el = document.querySelector('[data-status-for="'+ids[id]+'"]');
    if (!el || statuses[id] === undefined) return;
    el.textContent = statuses[id] ? 'Complete' : 'Action required';
    el.classList.toggle('complete', Boolean(statuses[id]));
    el.classList.toggle('incomplete', !statuses[id]);
  });
}
document.querySelectorAll('.save-continue').forEach(function(btn){
  btn.addEventListener('click', async function(){
    var sectionName = btn.getAttribute('data-section');
    var validation = clientValidation(sectionName);
    showError(sectionName, validation);
    if (validation) return;
    setSaveStatus('Saving…', 'saving');
    var body = new FormData(form);
    body.set('_saveSection', sectionName);
    body.set('_dirtySections', Array.from(dirtySections).join(','));
    var response = await fetch(form.action, { method: 'POST', body, headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
    var json = await response.json();
    if (!response.ok || !json.ok) {
      showError(sectionName, json.error || 'Unable to save this section.');
      setSaveStatus('Unsaved changes', 'dirty');
      return;
    }
    dirtySections.delete(sectionName);
    updateFieldStatuses(json.fieldStatuses || {});
    if (json.qualityScore !== undefined) document.getElementById('qualityScore').textContent = json.qualityScore + '%';
    setSaveStatus('Saved', 'saved-ok');
    var section = btn.closest('.section');
    section?.classList.add('saved-flash');
    window.setTimeout(function(){ section?.classList.remove('saved-flash'); }, 900);
    var section = btn.closest('.section');
    var next = section && section.nextElementSibling;
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
</script>
</body>
</html>`;
}

router.get("/pharmacy-profile-quality", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const data = loadProfile(slug);
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(renderPage(slug, data, req.query.saved === "1"));
});

router.post("/pharmacy-profile-quality", (req, res) => {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const existing = loadProfile(slug);
  const body = (req.body || {}) as Record<string, unknown>;
  const section = String(body._saveSection || "all");
  const validationError = validateQualitySection(section, body, slug);
  if (validationError) {
    if (wantsJson(req)) return res.status(400).json({ ok: false, error: validationError, section });
    return res.status(400).type("html").send(renderPage(slug, existing));
  }
  const now = new Date().toISOString();
  const data = saveProfileQualityFields(existing, body);
  fs.writeFileSync(profileFile(slug), JSON.stringify({
    slug,
    updatedAt: now,
    version: PROFILE_SCHEMA_VERSION,
    data,
  }, null, 2));
  if (wantsJson(req)) {
    const quality = computeWizardQualityScore(data);
    return res.json({
      ok: true,
      saved: true,
      section,
      message: "Saved",
      qualityScore: quality.overallScore,
      fieldStatuses: qualityFieldStatuses(data),
    });
  }
  res.redirect(303, `/api/pharmacy-profile-quality?slug=${encodeURIComponent(slug)}&saved=1`);
});

export default router;
