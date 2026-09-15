/**
 * Profile Dashboard V2 — Business Profile Intelligence field sections.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import {
  collectServiceIdsFromProfile,
  defaultProfileServiceDelivery,
} from "./pharmacyProfileV2Fields.ts";
import { renderServiceFactsFields, serviceFactsFormCss } from "./pharmacyProfileServiceFactsForm.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function field(
  label: string,
  id: string,
  value: string,
  type = "text",
  hint = "",
  tier: "required" | "optional" = "optional",
): string {
  const badge =
    tier === "required"
      ? `<span class="field-tier field-tier-required">Required</span>`
      : `<span class="field-tier field-tier-optional">Optional</span>`;
  const input =
    type === "checkbox"
      ? `<label class="check-row"><input type="checkbox" id="${id}" data-field="${id}" ${value ? "checked" : ""}/> ${esc(label)} ${badge}</label>`
      : type === "select"
        ? value
        : `<label for="${id}">${esc(label)} ${badge}</label><input type="${type}" id="${id}" data-field="${id}" value="${esc(value)}"/>`;
  return `<div class="field field-${tier}">${input}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
}

function textareaField(label: string, id: string, value: string, hint = ""): string {
  return `<div class="field"><label for="${id}">${esc(label)} <span class="field-tier field-tier-optional">Optional</span></label><textarea id="${id}" data-field="${id}" rows="3">${esc(value)}</textarea>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
}

function tagListField(label: string, id: string, values: string[], hint = ""): string {
  return `<div class="field"><label for="${id}">${esc(label)}</label><textarea id="${id}" data-field="${id}" rows="2">${esc(values.join(", "))}</textarea>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
}

function serviceIds(data: PharmacyProfileData): string[] {
  return collectServiceIdsFromProfile(data as unknown as Record<string, unknown>);
}

function renderServiceDeliveryCard(data: PharmacyProfileData, serviceId: string): string {
  const profile = data.serviceDeliveryProfiles?.[serviceId] || defaultProfileServiceDelivery(serviceId);
  const fundingLabels: Record<string, string> = { nhs: "NHS", private: "Private", mixed: "Both", unknown: "Unknown" };
  const fundingOptions = ["unknown", "nhs", "private", "mixed"]
    .map(
      (v) =>
        `<option value="${v}" ${profile.fundingModel === v ? "selected" : ""}>${esc(fundingLabels[v] || v)}</option>`,
    )
    .join("");

  const apptSel = (v: boolean | null, want: boolean) => (v === want ? "selected" : "");
  const walkSel = (v: boolean | null, want: boolean) => (v === want ? "selected" : "");

  return `<details class="svc-delivery-card" data-service-id="${esc(serviceId)}" open>
<summary><strong>${esc(profile.serviceName || serviceId)}</strong> <code>${esc(serviceId)}</code></summary>
<div class="grid-2 svc-delivery-grid" data-service-id="${esc(serviceId)}">
<div class="field"><label>Funding model</label><select data-svc-field="fundingModel">${fundingOptions}</select></div>
<div class="field"><label>Consultation length (minutes)</label><input type="number" min="0" data-svc-field="consultationLengthMinutes" value="${profile.consultationLengthMinutes ?? ""}"/></div>
<div class="field"><label>Consultation length label</label><input type="text" data-svc-field="consultationLengthLabel" value="${esc(profile.consultationLengthLabel)}" placeholder="e.g. 15-minute consultation"/></div>
<div class="field"><label>Appointment required</label><select data-svc-field="appointmentRequired"><option value="" ${profile.appointmentRequired === null ? "selected" : ""}>Unknown</option><option value="true" ${apptSel(profile.appointmentRequired, true)}>Yes</option><option value="false" ${apptSel(profile.appointmentRequired, false)}>No</option></select></div>
<div class="field"><label>Walk-in available</label><select data-svc-field="walkInAvailable"><option value="" ${profile.walkInAvailable === null ? "selected" : ""}>Unknown</option><option value="true" ${walkSel(profile.walkInAvailable, true)}>Yes</option><option value="false" ${walkSel(profile.walkInAvailable, false)}>No</option></select></div>
<div class="field"><label>Pricing notes</label><input type="text" data-svc-field="pricing" value="${esc(profile.pricing)}" placeholder="Optional free-text notes"/></div>
<div class="field"><label>Age restrictions</label><input type="text" data-svc-field="ageRestrictions" value="${esc(profile.ageRestrictions)}"/></div>
<div class="field"><label>Equipment used</label><textarea data-svc-field="equipmentUsed" rows="2">${esc(profile.equipmentUsed.join(", "))}</textarea></div>
<div class="field"><label>Preparation required</label><textarea data-svc-field="preparationRequired" rows="2">${esc(profile.preparationRequired.join(", "))}</textarea></div>
<div class="field"><label>Aftercare</label><textarea data-svc-field="aftercare" rows="2">${esc(profile.aftercare.join(", "))}</textarea></div>
<div class="field"><label>Results process</label><textarea data-svc-field="resultsProcess" rows="2">${esc(profile.resultsProcess)}</textarea></div>
<div class="field"><label>Referral process</label><textarea data-svc-field="referralProcess" rows="2">${esc(profile.referralProcess)}</textarea></div>
</div>
${renderServiceFactsFields(profile, { pharmacyName: data.pharmacyName, reviewerName: data.reviewerName, reviewerRole: data.reviewerRole })}
</details>`;
}

export function renderV2IdentitySection(data: PharmacyProfileData): string {
  return `<section class="panel v2-panel" id="section-v2-identity">
<h2>Business Identity (Intelligence V2)</h2>
<p class="lead">Rich identity fields used by Business Profile Intelligence — not yet connected to page generation.</p>
<div class="grid-2">
${field("Tagline", "tagline", data.tagline, "text", "Short pharmacy tagline for content")}
${field("Year established", "yearEstablished", data.yearEstablished, "text", "e.g. 1998")}
${field("Independent prescriber available", "independentPrescriberAvailable", data.independentPrescriberAvailable ? "1" : "", "checkbox")}
</div>
${textareaField("Business description", "businessDescription", data.businessDescription, "Overview of the pharmacy for content generation")}
${tagListField("Additional pharmacist team (comma-separated names)", "pharmacistTeamMembersRaw", (data.pharmacistTeamMembers || []).map((m) => m.name), "Full team editor in a future release — names only for now")}
<input type="hidden" id="pharmacistTeamMembers" data-field="pharmacistTeamMembers" value='${esc(JSON.stringify(data.pharmacistTeamMembers || []))}'/>
</section>`;
}

export function renderV2BrandSection(data: PharmacyProfileData): string {
  return `<section class="panel v2-panel" id="section-v2-brand">
<h2>Brand Identity (Intelligence V2)</h2>
<p class="lead">Visual and tone-of-brand settings beyond core colours (also editable via Website Import).</p>
<div class="grid-2">
${field("Hero style", "heroStyle", data.heroStyle || data.pageStyle, "text", "e.g. nhs-premium")}
${field("Photography style", "photographyStyle", data.photographyStyle || data.imageStyle, "text", "e.g. healthcare-natural")}
${field("Icon style", "iconStyle", data.iconStyle, "text", "e.g. line-healthcare")}
${field("CTA style", "ctaStyleBrand", data.ctaStyleBrand || data.buttonStyle, "text", "e.g. pill-primary")}
</div>
<h3 style="font-size:15px;margin-top:16px">Header &amp; footer colours</h3>
<p class="hint">Leave blank to use page shell defaults (header: white background; footer: heading colour background).</p>
<div class="grid-2">
${field("Header background", "brandHeaderBackgroundColor", data.brandHeaderBackgroundColor, "color", "Page header bar background")}
${field("Header text", "brandHeaderTextColor", data.brandHeaderTextColor, "color", "Nav links and brand text on header")}
${field("Footer background", "brandFooterBackgroundColor", data.brandFooterBackgroundColor, "color", "Footer bar background")}
${field("Footer text", "brandFooterTextColor", data.brandFooterTextColor, "color", "Footer headings and body text")}
${field("Footer link colour", "brandFooterLinkColor", data.brandFooterLinkColor, "color", "Footer links — defaults to footer text")}
${field("Footer accent", "brandFooterAccentColor", data.brandFooterAccentColor, "color", "Footer link hover / muted accent")}
</div>
</section>`;
}

export function renderV2LocationSection(data: PharmacyProfileData): string {
  return `<section class="panel v2-panel" id="section-v2-location">
<h2>Location Intelligence (V2)</h2>
<p class="lead">Accessibility and coverage detail for local content.</p>
<div class="grid-2">
${tagListField("Counties covered", "countiesCovered", data.countiesCovered?.length ? data.countiesCovered : data.county ? [data.county] : [], "Comma-separated")}
${field("Parking information", "parkingInfo", data.parkingInfo, "text", "e.g. Free parking behind the pharmacy")}
${field("Wheelchair access", "wheelchairAccess", data.wheelchairAccess ? "1" : "", "checkbox")}
</div>
</section>`;
}

export function renderV2ServiceSection(data: PharmacyProfileData): string {
  const ids = serviceIds(data);
  const cards = ids.length
    ? ids.map((id) => renderServiceDeliveryCard(data, id)).join("\n")
    : `<p class="hint">Add services under Priority Services / Selected Services, or run Website Analysis to detect services.</p>`;
  return `<section class="panel v2-panel" id="section-v2-services">
<h2>Service Intelligence (V2)</h2>
<p class="lead">Per-service delivery and confirmed service facts — appointment rules, funding, fees and reviewer. Unknown is never treated as free or available.</p>
<div id="serviceDeliveryEditor">${cards}</div>
<input type="hidden" id="serviceDeliveryProfiles" data-field="serviceDeliveryProfiles" value='${esc(JSON.stringify(data.serviceDeliveryProfiles || {}))}'/>
</section>`;
}

export function renderV2TeamSection(data: PharmacyProfileData): string {
  return `<section class="panel v2-panel" id="section-v2-team">
<h2>Team Intelligence (V2)</h2>
<p class="lead">Meet the team content beyond the primary reviewer. Professional Review section remains the primary reviewer source.</p>
${textareaField("Meet the team introduction", "meetTheTeamIntro", data.meetTheTeamIntro || data.reviewerBio, "Shown on team-focused content when wired in Phase 3")}
<input type="hidden" id="teamMembers" data-field="teamMembers" value='${esc(JSON.stringify(data.teamMembers || []))}'/>
<p class="hint">Additional team member records can be added in a future dashboard release. Primary reviewer is mapped from Professional Review.</p>
</section>`;
}

export function renderV2PatientSection(data: PharmacyProfileData): string {
  return `<section class="panel v2-panel" id="section-v2-patients">
<h2>Patient Intelligence (V2)</h2>
<p class="lead">Target patient groups for tailored content angles.</p>
${tagListField("Target patient groups", "targetPatientGroups", data.targetPatientGroups || [], "Comma-separated — shared with growth programme")}
${tagListField("Unique selling points", "uniqueSellingPoints", data.uniqueSellingPoints || [])}
${tagListField("Common patient questions", "patientQuestions", data.patientQuestions || [])}
</section>`;
}

export function renderV2TrustSection(data: PharmacyProfileData): string {
  return `<section class="panel v2-panel" id="section-v2-trust">
<h2>Trust Intelligence (V2)</h2>
<div class="grid-2">
${tagListField("Awards", "awards", data.awards || [])}
${tagListField("Accreditations", "accreditations", data.accreditations || [])}
${tagListField("Review highlights", "reviewHighlights", data.reviewHighlights || [], "Short quotes from Google/reviews")}
${field("Number of patients served", "numberOfPatients", data.numberOfPatients, "text", "e.g. 5,000+ local patients")}
</div>
${textareaField("Testimonials (one per line: Quote | Author | Source)", "testimonialsRaw", (data.testimonials || []).map((t) => `${t.quote} | ${t.author} | ${t.source}`).join("\n"))}
<input type="hidden" id="testimonials" data-field="testimonials" value='${esc(JSON.stringify(data.testimonials || []))}'/>
</section>`;
}

export function renderV2ConversionSection(data: PharmacyProfileData): string {
  return `<section class="panel v2-panel" id="section-v2-conversion">
<h2>Conversion Intelligence (V2)</h2>
<div class="grid-2">
${field("Primary CTA wording", "preferredCtaWording", data.preferredCtaWording || data.preferredCta, "text", "Preferred call-to-action phrase")}
${field("Secondary CTA", "secondaryCta", data.secondaryCta, "text", "e.g. Book online")}
${field("Contact form URL", "contactFormUrl", data.contactFormUrl, "url")}
${field("Online booking available", "onlineBookingAvailable", data.onlineBookingAvailable ? "1" : "", "checkbox")}
</div>
<p class="hint">Telephone, email and booking URL remain in Business Information and Header sections.</p>
</section>`;
}

export function renderV2ContentSection(data: PharmacyProfileData): string {
  const ci = data.contentIntelligence;
  const readingOptions = ["plain-english", "standard", "detailed"]
    .map((v) => `<option value="${v}" ${ci.readingLevel === v ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
  const lengthOptions = ["concise", "standard", "comprehensive"]
    .map((v) => `<option value="${v}" ${ci.preferredLength === v ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
  const linkOptions = ["balanced", "service-first", "local-first"]
    .map((v) => `<option value="${v}" ${ci.internalLinkBehaviour === v ? "selected" : ""}>${esc(v)}</option>`)
    .join("");

  return `<section class="panel v2-panel" id="section-v2-content">
<h2>Content Intelligence (V2)</h2>
<p class="lead">Tone, depth and linking preferences for future content generation.</p>
<div class="grid-2">
<div class="field"><label for="contentToneOfVoice">Tone of voice</label><input type="text" id="contentToneOfVoice" data-ci-field="toneOfVoice" value="${esc(ci.toneOfVoice || data.tone || "professional")}"/></div>
<div class="field"><label for="contentReadingLevel">Reading level</label><select id="contentReadingLevel" data-ci-field="readingLevel">${readingOptions}</select></div>
<div class="field"><label for="contentPreferredLength">Preferred length</label><select id="contentPreferredLength" data-ci-field="preferredLength">${lengthOptions}</select></div>
<div class="field"><label for="contentInternalLinkBehaviour">Internal link behaviour</label><select id="contentInternalLinkBehaviour" data-ci-field="internalLinkBehaviour">${linkOptions}</select></div>
<div class="field"><label for="contentFaqMaxCount">FAQ max count</label><input type="number" id="contentFaqMaxCount" min="1" max="30" data-ci-field="faqMaxCount" value="${ci.faqMaxCount}"/></div>
</div>
<div class="grid-2">
${field("Mention pharmacists", "contentMentionPharmacists", ci.mentionPharmacists ? "1" : "", "checkbox")}
${field("Mention reviews", "contentMentionReviews", ci.mentionReviews ? "1" : "", "checkbox")}
${field("Local references", "contentLocalReferences", ci.localReferences ? "1" : "", "checkbox")}
${field("Tenant-specific FAQs", "contentFaqIncludeTenant", ci.faqIncludeTenantSpecific ? "1" : "", "checkbox")}
${field("Prefer practical FAQ questions", "contentFaqPreferPractical", ci.faqPreferPracticalQuestions ? "1" : "", "checkbox")}
</div>
<input type="hidden" id="contentIntelligence" data-field="contentIntelligence" value='${esc(JSON.stringify(ci))}'/>
</section>`;
}

export function renderV2NavStrip(): string {
  return `<nav class="v2-nav" aria-label="Intelligence V2 sections">
<a href="#section-v2-identity">Identity</a>
<a href="#section-v2-brand">Brand</a>
<a href="#section-v2-location">Location</a>
<a href="#section-v2-services">Services</a>
<a href="#section-v2-team">Team</a>
<a href="#section-v2-patients">Patients</a>
<a href="#section-v2-trust">Trust</a>
<a href="#section-v2-conversion">Conversion</a>
<a href="#section-v2-content">Content</a>
</nav>`;
}

export function profileV2DashboardCss(): string {
  return `${serviceFactsFormCss()}
.v2-nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px}
.v2-nav a{font-size:12px;font-weight:700;color:#005eb8;text-decoration:none;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid #dbeafe}
.v2-panel{border-left:3px solid #005eb8}
.svc-delivery-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:12px;background:#fafbfc}
.svc-delivery-card summary{cursor:pointer;font-size:14px;margin-bottom:8px}
.svc-delivery-grid{margin-top:10px}
.field-tier{font-size:10px;font-weight:800;text-transform:uppercase;border-radius:999px;padding:2px 7px;margin-left:6px;vertical-align:middle}
.field-tier-required{background:#fef2f2;color:#b91c1c}
.field-tier-optional{background:#f1f5f9;color:#64748b}`;
}

export function profileV2ClientScript(): string {
  return `
function parseTags(v){ return String(v||'').split(/[,\\n]/).map(x=>x.trim()).filter(Boolean); }
function readJsonField(v,f){ try { return JSON.parse(v||''); } catch { return f; } }

function setSvcFieldValue(row, key, el){
  const raw = el.type === 'checkbox' ? (el.checked ? 'true' : 'false') : String(el.value ?? '');
  const assign = (target, field) => {
    if (el.type === 'checkbox') target[field] = el.checked;
    else if (el.tagName === 'SELECT' && raw === '' && (field === 'appointmentRequired' || field === 'walkInAvailable' || field === 'physicalBranchOffered')) target[field] = null;
    else if (el.tagName === 'SELECT' && (field === 'appointmentRequired' || field === 'walkInAvailable' || field === 'physicalBranchOffered')) target[field] = raw === 'true';
    else if (field === 'consultationLengthMinutes') target[field] = raw ? Number(raw) : null;
    else if (['equipmentUsed','preparationRequired','aftercare'].includes(field)) target[field] = parseTags(raw);
    else target[field] = raw.trim();
  };
  if (key.includes('.')) {
    const [a,b] = key.split('.');
    row[a] = row[a] && typeof row[a] === 'object' ? row[a] : {};
    assign(row[a], b);
    return;
  }
  assign(row, key);
}

function toggleServiceFactFields(card){
  if (!card) return;
  const funding = card.querySelector('[data-svc-field="fundingModel"]')?.value || 'unknown';
  const branch = card.querySelector('[data-svc-field="physicalBranchOffered"]')?.value || '';
  const delivery = card.querySelector('[data-svc-field="deliveryMode"]')?.value || 'unknown';
  const prescribing = card.querySelector('[data-svc-field="prescribingSupplyStatus"]')?.value || 'unknown';
  const deposit = card.querySelector('[data-svc-field="depositStatus"]')?.value || 'unknown';
  const privateFunded = funding === 'private' || funding === 'mixed';
  card.querySelectorAll('.wizard-svc-when-branch').forEach(el => { el.hidden = branch !== 'true'; });
  card.querySelectorAll('.wizard-svc-when-remote').forEach(el => { el.hidden = !(delivery === 'remote' || delivery === 'both'); });
  card.querySelectorAll('.wizard-svc-when-prescribing').forEach(el => { el.hidden = prescribing === 'unknown' || prescribing === 'none'; });
  card.querySelectorAll('.wizard-svc-when-deposit').forEach(el => { el.hidden = !(deposit === 'required' || privateFunded); });
  card.querySelectorAll('.wizard-svc-when-deposit-amount, .wizard-svc-when-deposit-terms').forEach(el => { el.hidden = deposit !== 'required'; });
  card.querySelectorAll('.wizard-svc-when-cancel').forEach(el => { el.hidden = !(deposit === 'required' || privateFunded); });
  card.querySelectorAll('.wizard-svc-fee').forEach(block => {
    const kind = block.querySelector('.wizard-svc-fee-kind')?.value || 'unknown';
    block.querySelectorAll('.wizard-svc-when-amount').forEach(el => { el.hidden = !(kind === 'fixed' || kind === 'from'); });
  });
}

function collectServiceDeliveryProfiles(){
  const hidden = document.getElementById('serviceDeliveryProfiles');
  const out = readJsonField(hidden?.value, {});
  document.querySelectorAll('.svc-delivery-card, .wizard-svc-quick').forEach(card=>{
    const serviceId = card.getAttribute('data-service-id') || card.querySelector('[data-service-id]')?.getAttribute('data-service-id');
    if (!serviceId) return;
    const existing = out[serviceId] && typeof out[serviceId] === 'object' ? out[serviceId] : {};
    const row = Object.assign({}, existing, { serviceId, serviceName: card.querySelector('summary strong')?.textContent?.trim() || existing.serviceName || serviceId });
    card.querySelectorAll('[data-svc-field]').forEach(el=>{
      const key = el.getAttribute('data-svc-field');
      if (!key) return;
      setSvcFieldValue(row, key, el);
    });
    const length = card.querySelector('.wizard-svc-length');
    if (length && length.tagName === 'SELECT' && length.value) {
      const text = length.options[length.selectedIndex]?.text || '';
      row.consultationLengthLabel = text.replace('About ','').replace(' minutes',' min');
    }
    if (card.querySelector('.wizard-svc-equip')) {
      row.equipmentUsed = Array.from(card.querySelectorAll('.wizard-svc-equip:checked')).map(el=>el.value);
    }
    out[serviceId] = row;
  });
  if (hidden) hidden.value = JSON.stringify(out);
  return out;
}

function collectContentIntelligence(){
  const ci = readJsonField(document.getElementById('contentIntelligence')?.value, {});
  document.querySelectorAll('[data-ci-field]').forEach(el=>{
    const key = el.getAttribute('data-ci-field');
    if (!key) return;
    if (el.type === 'checkbox') ci[key] = el.checked;
    else if (el.type === 'number') ci[key] = Number(el.value) || ci[key];
    else ci[key] = el.value.trim();
  });
  ['contentMentionPharmacists','contentMentionReviews','contentLocalReferences','contentFaqIncludeTenant','contentFaqPreferPractical'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    const map = { contentMentionPharmacists:'mentionPharmacists', contentMentionReviews:'mentionReviews', contentLocalReferences:'localReferences', contentFaqIncludeTenant:'faqIncludeTenantSpecific', contentFaqPreferPractical:'faqPreferPracticalQuestions' };
    ci[map[id]] = el.checked;
  });
  const hidden = document.getElementById('contentIntelligence');
  if (hidden) hidden.value = JSON.stringify(ci);
  return ci;
}

function collectV2ProfilePatch(){
  collectContentIntelligence();
  collectServiceDeliveryProfiles();
  const patch = {};
  ['tagline','businessDescription','yearEstablished','meetTheTeamIntro','heroStyle','photographyStyle','iconStyle','ctaStyleBrand','parkingInfo','numberOfPatients','secondaryCta','contactFormUrl','preferredCtaWording','brandHeaderBackgroundColor','brandHeaderTextColor','brandFooterBackgroundColor','brandFooterTextColor','brandFooterLinkColor','brandFooterAccentColor'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) patch[id] = el.value.trim();
  });
  ['independentPrescriberAvailable','wheelchairAccess','onlineBookingAvailable'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) patch[id] = el.checked;
  });
  ['countiesCovered','awards','reviewHighlights','targetPatientGroups','uniqueSellingPoints','patientQuestions','accreditations'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) patch[id] = parseTags(el.value);
  });
  const teamRaw = document.getElementById('pharmacistTeamMembersRaw');
  if (teamRaw) {
    patch.pharmacistTeamMembers = parseTags(teamRaw.value).map(name=>({ name, role:'', gphcNumber:'', isIndependentPrescriber:false }));
  }
  const testimonialsRaw = document.getElementById('testimonialsRaw');
  if (testimonialsRaw) {
    patch.testimonials = String(testimonialsRaw.value||'').split('\\n').map(line=>{
      const parts = line.split('|').map(p=>p.trim());
      if (!parts[0]) return null;
      return { quote: parts[0], author: parts[1]||'', source: parts[2]||'' };
    }).filter(Boolean);
  }
  const sd = document.getElementById('serviceDeliveryProfiles');
  if (sd) patch.serviceDeliveryProfiles = readJsonField(sd.value, {});
  const ci = document.getElementById('contentIntelligence');
  if (ci) patch.contentIntelligence = readJsonField(ci.value, {});
  return patch;
}

window.v2CollectProfilePatch = collectV2ProfilePatch;
window.toggleServiceFactFields = toggleServiceFactFields;

document.querySelectorAll('[data-ci-field], [data-svc-field], #testimonialsRaw, #pharmacistTeamMembersRaw').forEach(el=>{
  el.addEventListener('input', ()=>{ collectV2ProfilePatch(); if (typeof updateLivePreview === 'function') updateLivePreview(); });
  el.addEventListener('change', ()=>{
    const card = el.closest('.svc-delivery-card, .wizard-svc-quick');
    if (card) toggleServiceFactFields(card);
    collectV2ProfilePatch();
    if (typeof updateLivePreview === 'function') updateLivePreview();
  });
});
document.querySelectorAll('.svc-delivery-card, .wizard-svc-quick').forEach(card => toggleServiceFactFields(card));
`;
}

export function renderAllV2IntelligenceSections(data: PharmacyProfileData): string {
  return `${renderV2NavStrip()}
${renderV2IdentitySection(data)}
${renderV2BrandSection(data)}
${renderV2LocationSection(data)}
${renderV2ServiceSection(data)}
${renderV2TeamSection(data)}
${renderV2PatientSection(data)}
${renderV2TrustSection(data)}
${renderV2ConversionSection(data)}
${renderV2ContentSection(data)}`;
}
