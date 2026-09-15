/**
 * Business Profile Wizard V2 — step panel HTML builders.
 */
import type { PharmacyProfileData, ProfileWizardCompetitor } from "./pharmacyProfileSchema.ts";
import {
  field,
  renderHourFields,
  renderLocalAreasSection,
  renderWebsiteBrandingSection,
} from "./pharmacyProfileDashboardSections.ts";
import {
  renderV2BrandSection,
  renderV2ServiceSection,
  renderV2TeamSection,
  renderV2ConversionSection,
  renderV2ContentSection,
} from "./pharmacyProfileDashboardV2Sections.ts";
import { buildWizardServiceConfirmationOptions } from "./growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import type { WizardQualityResult } from "./pharmacyProfileWizardScoring.ts";
import { WIZARD_STEPS } from "./pharmacyProfileWizardSteps.ts";
import {
  buildWizardImportFields,
  buildImportBrandSummary,
  buildLocalIntelPreview,
  countImportSummary,
  type WizardFieldStatus,
} from "./pharmacyProfileWizardEnrichment.ts";
import {
  PATIENT_GROUP_OPTIONS,
  TRUST_ACCREDITATION_PRESETS,
  CONTENT_TONE_OPTIONS,
  BOOKING_METHOD_OPTIONS,
  selectedPatientGroupIds,
  CONSULTATION_LENGTH_OPTIONS,
  SERVICE_EQUIPMENT_OPTIONS,
  SERVICE_PREPARATION_OPTIONS,
  SERVICE_AFTERCARE_OPTIONS,
  SERVICE_REFERRAL_OPTIONS,
  SERVICE_RESULTS_OPTIONS,
} from "./pharmacyProfileWizardPresets.ts";
import {
  ENTITY_GROUP_LABELS,
  type EntityGroupKey,
  type ProfileLocalEntity,
} from "./pharmacyProfileLocalIntelligenceSelection.ts";
import { collectServiceIdsFromProfile, defaultProfileServiceDelivery } from "./pharmacyProfileV2Fields.ts";
import { renderServiceFactsFields, serviceFactsFormCss } from "./pharmacyProfileServiceFactsForm.ts";
import { hasOpeningHours } from "./pharmacyProfileHours.ts";
import {
  auditGenerationInputFields,
  generationInputCompletenessPercent,
} from "./pharmacyProfileGenerationInputCompleteness.ts";
import { computeCommercialPublishingReadiness } from "./pharmacyCommercialReadinessGate.ts";

const WIZARD_LOCAL_GROUPS: EntityGroupKey[] = [
  "gpSurgeries",
  "healthCentres",
  "hospitals",
  "landmarks",
  "transportLinks",
];

const UNIQUE_SELLING_POINT_PRESETS = [
  "Fast local access",
  "Friendly pharmacy team",
  "NHS services available",
  "Private consultation room",
  "Convenient repeat prescription support",
  "Clear patient advice",
];

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function wizardHelp(tip: string): string {
  return `<span class="wizard-help" tabindex="0" aria-label="${esc(tip)}" data-help="${esc(tip)}">?</span>`;
}

function importBadge(status: WizardFieldStatus): string {
  const labels: Record<WizardFieldStatus, string> = {
    imported: "Imported",
    review: "Review",
    confirmed: "Confirmed",
    missing: "Not found",
    manual: "Manual entry",
  };
  return `<span class="wizard-import-badge status-${status}">${labels[status] || status}</span>`;
}

function renderImportFieldCard(
  label: string,
  fieldKey: string,
  value: string,
  status: WizardFieldStatus,
  inputType: "text" | "url" | "tel" | "email" | "textarea" = "text",
  hint = "",
): string {
  const readonly = status === "review" || status === "imported" || status === "confirmed";
  const input =
    inputType === "textarea"
      ? `<textarea id="${fieldKey}" data-field="${fieldKey}" rows="2" ${readonly ? "readonly" : ""}>${esc(value)}</textarea>`
      : `<input type="${inputType}" id="${fieldKey}" data-field="${fieldKey}" value="${esc(value)}" ${readonly ? "readonly" : ""}/>`;
  const acceptBtn =
    status === "review" || status === "imported"
      ? `<button type="button" class="wizard-chip-btn accept" data-accept-field="${fieldKey}">Accept</button>`
      : "";
  return `<div class="wizard-import-card status-${status}" data-field-card="${fieldKey}">
<div class="wizard-import-head"><strong>${esc(label)}</strong>${importBadge(status)}</div>
${input}
${hint ? `<span class="hint">${esc(hint)}</span>` : ""}
<div class="wizard-import-actions">
${acceptBtn}
<button type="button" class="wizard-chip-btn" data-confirm-field="${fieldKey}">Confirm</button>
<button type="button" class="wizard-chip-btn ghost" data-edit-field="${fieldKey}">Edit</button>
</div>
</div>`;
}

function renderBrandSummaryPanel(data: PharmacyProfileData): string {
  const brand = buildImportBrandSummary(data);
  if (!data.websiteAnalysisAt && !brand.logoUrl) return "";
  const swatch = brand.primaryColor
    ? `<span class="wizard-brand-swatch" style="background:${esc(brand.primaryColor)}"></span>`
    : "";
  const logo = brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="" class="wizard-brand-logo"/>` : "";
  return `<div class="wizard-brand-summary">
${logo}
<div>
<strong>${esc(data.pharmacyName || "Your pharmacy")}</strong>
<div class="wizard-brand-meta">${swatch}${brand.servicesDetected ? `${brand.servicesDetected} services detected · ` : ""}${brand.navLinks ? `${brand.navLinks} nav links · ` : ""}${brand.footerLinks ? `${brand.footerLinks} footer links · ` : ""}${brand.socialCount ? `${brand.socialCount} social links` : ""}</div>
</div>
</div>`;
}

function renderLocalIntelPreviewPanel(data: PharmacyProfileData): string {
  const p = buildLocalIntelPreview(data);
  const row = (label: string, ok: boolean, detail: string) =>
    `<div class="wizard-local-preview-row ${ok ? "ok" : "pending"}"><span>${esc(label)}</span><strong>${esc(detail)}</strong></div>`;
  return `<div class="wizard-local-preview">
<h3 class="wizard-subhead">Local intelligence ${wizardHelp("Loaded from Google when you run Load local suggestions in step 5.")}</h3>
${row("Google listing", p.googlePlaceFound, p.googlePlaceFound ? p.googlePlaceLabel : "Add in step 1 or load suggestions")}
${row("Competitors found", p.competitorCount > 0, p.competitorCount ? String(p.competitorCount) : "—")}
${row("GP surgeries", p.gpCount > 0, p.gpCount ? String(p.gpCount) : "Confirm in step 5")}
${row("Health centres", p.healthCentreCount > 0, p.healthCentreCount ? String(p.healthCentreCount) : "Confirm in step 5")}
${row("Hospitals", p.hospitalCount > 0, p.hospitalCount ? String(p.hospitalCount) : "Confirm in step 5")}
${row("Landmarks", p.landmarkCount > 0, p.landmarkCount ? String(p.landmarkCount) : "Confirm in step 5")}
</div>`;
}

function renderGenerationInputStatusPanel(data: PharmacyProfileData): string {
  const groups = auditGenerationInputFields(data);
  const percent = generationInputCompletenessPercent(groups);
  const rows = groups
    .map((group) => {
      const cls = group.status === "AUTO IMPORTED" ? "auto" : "action";
      const detail = group.actionRequired.length
        ? `Action required: ${group.actionRequired.join(", ")}`
        : "Auto imported or already present";
      return `<div class="wizard-generation-status-row ${cls}">
<span>${esc(group.group)}</span>
<strong>${group.status}</strong>
<small>${esc(detail)}</small>
</div>`;
    })
    .join("");
  return `<div class="wizard-generation-status">
<div class="wizard-generation-status-head"><strong>Generation input readiness</strong><span>${percent}% auto-complete</span></div>
<div class="wizard-generation-status-grid">${rows}</div>
</div>`;
}

function actionBadge(ok: boolean): string {
  return `<span class="wizard-action-badge ${ok ? "complete" : "required"}">${ok ? "SAVED" : "ACTION REQUIRED"}</span>`;
}

function optionalBadge(ok: boolean): string {
  return `<span class="wizard-action-badge optional">${ok ? "OPTIONAL SAVED" : "OPTIONAL"}</span>`;
}

function renderTrustProfessionalReviewGate(data: PharmacyProfileData): string {
  const readiness = computeCommercialPublishingReadiness(data);
  const hasValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim());
  const gphcSaved = hasValue(data.gphcNumber);
  const gateCopy = gphcSaved
    ? "GPhC premises number is saved. Optional trust and reviewer details enrich content only when supplied; PharmaConnect will not infer or invent regulator or reviewer details."
    : "GPhC premises number is required before commercial publishing. Optional trust and reviewer details enrich content only when supplied; PharmaConnect will not infer or invent regulator or reviewer details.";
  const fieldRow = (label: string, id: string, value: string, type = "text", required = true) => `
<div class="wizard-action-field ${required ? "required" : "optional"}">
<div class="wizard-action-head"><strong>${esc(label)}</strong>${required ? actionBadge(hasValue(value)) : optionalBadge(hasValue(value))}</div>
${field(label, id, value, type, "", required ? "required" : "optional")}
</div>`;

  return `<section class="wizard-commercial-gate" id="wizard-trust-professional-review">
<div class="wizard-commercial-head">
<div><h3>Trust &amp; Professional Review</h3><p>${esc(gateCopy)}</p></div>
<strong class="${readiness.status === "READY" ? "ready" : "blocked"}">${readiness.status}</strong>
</div>
<h4 class="wizard-commercial-subhead">Required before publishing</h4>
<div class="grid-2">
${fieldRow("GPhC premises number", "gphcNumber", data.gphcNumber)}
</div>
${readiness.missingManualFields.length ? `<p class="wizard-commercial-missing">Missing: ${esc(readiness.missingManualFields.join(", "))}</p>` : ""}
<h4 class="wizard-commercial-subhead optional">Optional trust and professional details</h4>
<p class="hint">These enrich content only when supplied. Missing optional items never block generation, approval or publishing readiness.</p>
<div class="grid-2">
${fieldRow("NHS profile URL", "nhsProfileUrl", data.nhsProfileUrl, "url", false)}
${fieldRow("Superintendent Pharmacist name", "superintendentPharmacistName", data.superintendentPharmacistName, "text", false)}
${fieldRow("Reviewer name", "reviewerName", data.reviewerName, "text", false)}
${fieldRow("Reviewer role", "reviewerRole", data.reviewerRole, "text", false)}
${fieldRow("Reviewer qualifications", "reviewerQualifications", data.reviewerQualifications, "text", false)}
${fieldRow("Reviewer GPhC number", "reviewerGphcNumber", data.reviewerGphcNumber, "text", false)}
${fieldRow("Review date", "clinicalReviewDate", data.clinicalReviewDate, "date", false)}
${fieldRow("Next Review Date", "nextReviewDate", data.nextReviewDate, "date", false)}
${fieldRow("Awards", "awards", (data.awards || []).join(", "), "text", false)}
${fieldRow("Review highlights", "reviewHighlights", (data.reviewHighlights || []).join(", "), "text", false)}
${fieldRow("Number of patients served", "numberOfPatients", data.numberOfPatients, "text", false)}
</div>
<div class="wizard-action-field optional">
<div class="wizard-action-head"><strong>Accreditations</strong>${optionalBadge((data.accreditations || []).length > 0)}</div>
${renderTrustCheckboxes(data)}
</div>
<div class="wizard-action-field optional">
<div class="wizard-action-head"><strong>Review quotes</strong>${optionalBadge((data.testimonials || []).length > 0)}</div>
<textarea id="testimonialsRaw" data-field="testimonialsRaw" rows="3">${esc((data.testimonials || []).map((t) => `${t.quote} | ${t.author} | ${t.source}`).join("\n"))}</textarea>
<input type="hidden" id="testimonials" data-field="testimonials" value='${esc(JSON.stringify(data.testimonials || []))}'/>
</div>
</section>`;
}

function renderWizardServiceQuickSetup(data: PharmacyProfileData): string {
  const ids = collectServiceIdsFromProfile(data as unknown as Record<string, unknown>);
  if (!ids.length) return "";
  const cards = ids
    .slice(0, 6)
    .map((serviceId) => {
      const profile = data.serviceDeliveryProfiles?.[serviceId] || defaultProfileServiceDelivery(serviceId);
      const fundingLabels: Record<string, string> = { nhs: "NHS", private: "Private", mixed: "Both", unknown: "Unknown" };
      const lengthOpts = CONSULTATION_LENGTH_OPTIONS.map(
        (o) => `<option value="${esc(o.value)}" ${String(profile.consultationLengthMinutes || "") === o.value ? "selected" : ""}>${esc(o.label)}</option>`,
      ).join("");
      const fundingOpts = ["unknown", "nhs", "private", "mixed"]
        .map((v) => `<option value="${v}" ${profile.fundingModel === v ? "selected" : ""}>${esc(fundingLabels[v] || v)}</option>`)
        .join("");
      const equip = SERVICE_EQUIPMENT_OPTIONS.map(
        (o) =>
          `<label class="wizard-chip-check"><input type="checkbox" class="wizard-svc-equip" data-service="${esc(serviceId)}" value="${esc(o)}" ${profile.equipmentUsed.includes(o) ? "checked" : ""}/> ${esc(o)}</label>`,
      ).join("");
      return `<details class="wizard-svc-quick" data-service-id="${esc(serviceId)}">
<summary><strong>${esc(profile.serviceName || serviceId)}</strong> ${wizardHelp("Record how this service is funded, delivered and charged. Unknown stays unknown.")}</summary>
<div class="grid-2">
<div class="field"><label>Funding</label><select class="wizard-svc-funding" data-svc-field="fundingModel" data-service="${esc(serviceId)}">${fundingOpts}</select></div>
<div class="field"><label>Consultation length</label><select class="wizard-svc-length" data-svc-field="consultationLengthMinutes" data-service="${esc(serviceId)}">${lengthOpts}</select></div>
<div class="field"><label>Appointment required</label><select class="wizard-svc-appt" data-svc-field="appointmentRequired" data-service="${esc(serviceId)}"><option value="">Unknown</option><option value="true" ${profile.appointmentRequired === true ? "selected" : ""}>Yes</option><option value="false" ${profile.appointmentRequired === false ? "selected" : ""}>No</option></select></div>
<div class="field"><label>Walk-in</label><select class="wizard-svc-walkin" data-svc-field="walkInAvailable" data-service="${esc(serviceId)}"><option value="">Unknown</option><option value="true" ${profile.walkInAvailable === true ? "selected" : ""}>Yes</option><option value="false" ${profile.walkInAvailable === false ? "selected" : ""}>No</option></select></div>
</div>
<div class="wizard-chip-grid">${equip}</div>
${renderServiceFactsFields(profile, { pharmacyName: data.pharmacyName, reviewerName: data.reviewerName, reviewerRole: data.reviewerRole })}
</details>`;
    })
    .join("");
  return `<div id="wizardServiceQuickHost">${cards}</div>
<input type="hidden" id="serviceDeliveryProfiles" data-field="serviceDeliveryProfiles" value='${esc(JSON.stringify(data.serviceDeliveryProfiles || {}))}'/>`;
}

function mergeEntitiesForGroup(data: PharmacyProfileData, group: EntityGroupKey): ProfileLocalEntity[] {
  const candidates = (data.localIntelligenceCandidates?.[group] as ProfileLocalEntity[] | undefined) || [];
  const saved = (data[group] as ProfileLocalEntity[] | undefined) || [];
  const byId = new Map<string, ProfileLocalEntity>();
  for (const e of [...candidates, ...saved]) {
    if (!e?.name) continue;
    const id = e.id || e.name;
    byId.set(id, { ...e, id, selected: e.selected !== false });
  }
  return Array.from(byId.values()).slice(0, 12);
}

function renderEntityGroup(data: PharmacyProfileData, group: EntityGroupKey): string {
  const entities = mergeEntitiesForGroup(data, group);
  const label = ENTITY_GROUP_LABELS[group];
  if (!entities.length) {
    return `<div class="wizard-entity-group" data-entity-group="${group}">
<h4>${esc(label)}</h4>
<p class="hint">Load local suggestions to see nearby ${esc(label.toLowerCase())}.</p>
</div>`;
  }
  const rows = entities
    .map(
      (e) =>
        `<label class="wizard-entity-check"><input type="checkbox" class="wizard-entity-cb" data-entity-group="${group}" data-entity-id="${esc(e.id)}" ${e.selected !== false ? "checked" : ""}/> <span><strong>${esc(e.name)}</strong> <span class="hint-inline">${esc(e.distanceLabel || e.category || "")}</span></span></label>`,
    )
    .join("");
  return `<div class="wizard-entity-group" data-entity-group="${group}">
<h4>${esc(label)}</h4>
<div class="wizard-entity-grid">${rows}</div>
<input type="hidden" id="${group}" data-field="${group}" data-json-entities="true" value='${esc(JSON.stringify(entities))}'/>
</div>`;
}

function renderCompetitorCards(competitors: ProfileWizardCompetitor[]): string {
  if (!competitors.length) {
    return `<p class="hint" id="competitorEmptyHint">Load local suggestions to discover nearby pharmacy competitors.</p>`;
  }
  return competitors
    .map(
      (c, i) =>
        `<div class="wizard-competitor-card" data-competitor-index="${i}">
<label class="wizard-entity-check"><input type="checkbox" class="wizard-competitor-cb" data-competitor-id="${esc(c.id)}" ${c.selected ? "checked" : ""}/> <strong>${esc(c.name)}</strong></label>
<div class="wizard-competitor-meta">
<span>${esc(c.distanceLabel || "")}</span>
${c.rating != null ? `<span>★ ${c.rating.toFixed(1)} (${c.reviewCount} reviews)</span>` : ""}
${c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">Website</a>` : ""}
</div>
<div class="field"><label>Notes</label><input type="text" class="wizard-competitor-notes" data-competitor-id="${esc(c.id)}" value="${esc(c.notes)}" placeholder="Optional — e.g. main high street competitor"/></div>
</div>`,
    )
    .join("");
}

function renderPatientGroupCheckboxes(data: PharmacyProfileData): string {
  const selected = new Set(selectedPatientGroupIds(data.targetPatientGroups || []));
  const boxes = PATIENT_GROUP_OPTIONS.map(
    (o) =>
      `<label class="wizard-chip-check"><input type="checkbox" class="wizard-patient-cb" value="${esc(o.id)}" ${selected.has(o.id) ? "checked" : ""}/> ${esc(o.label)}</label>`,
  ).join("");
  const other = (data.targetPatientGroups || []).filter(
    (g) => !PATIENT_GROUP_OPTIONS.some((o) => o.label.toLowerCase() === g.toLowerCase()),
  );
  return `<div class="wizard-chip-grid">${boxes}</div>
<div class="field"><label for="targetPatientGroupsOther">Other patient groups <span class="hint-inline">optional</span></label>
<input type="text" id="targetPatientGroupsOther" value="${esc(other.join(", "))}" placeholder="Comma-separated"/>
<input type="hidden" id="targetPatientGroups" data-field="targetPatientGroups" value='${esc(JSON.stringify(data.targetPatientGroups || []))}'/>
</div>`;
}

function renderUniqueSellingPointCheckboxes(data: PharmacyProfileData): string {
  const selected = new Set((data.uniqueSellingPoints || []).map((value) => value.toLowerCase()));
  const boxes = UNIQUE_SELLING_POINT_PRESETS.map(
    (option) =>
      `<label class="wizard-chip-check"><input type="checkbox" class="wizard-usp-cb" value="${esc(option)}" ${selected.has(option.toLowerCase()) ? "checked" : ""}/> ${esc(option)}</label>`,
  ).join("");
  const custom = (data.uniqueSellingPoints || []).filter(
    (value) => !UNIQUE_SELLING_POINT_PRESETS.some((option) => option.toLowerCase() === value.toLowerCase()),
  );
  return `<div class="wizard-chip-grid">${boxes}</div>
<div class="field"><label for="uniqueSellingPointsOther">Other differentiators <span class="hint-inline">optional</span></label>
<input type="text" id="uniqueSellingPointsOther" value="${esc(custom.join(", "))}" placeholder="Comma-separated"/>
<input type="hidden" id="uniqueSellingPoints" data-field="uniqueSellingPoints" value='${esc(JSON.stringify(data.uniqueSellingPoints || []))}'/>
</div>`;
}

function renderTrustCheckboxes(data: PharmacyProfileData): string {
  const acc = new Set((data.accreditations || []).map((a) => a.toLowerCase()));
  const presets = TRUST_ACCREDITATION_PRESETS.map(
    (p) =>
      `<label class="wizard-chip-check"><input type="checkbox" class="wizard-trust-preset" value="${esc(p)}" ${acc.has(p.toLowerCase()) ? "checked" : ""}/> ${esc(p)}</label>`,
  ).join("");
  return `<div class="wizard-chip-grid">${presets}</div>
<input type="hidden" id="accreditations" data-field="accreditations" value='${esc(JSON.stringify(data.accreditations || []))}'/>`;
}

export function renderWizardStepImport(data: PharmacyProfileData): string {
  const fields = buildWizardImportFields(data);
  const summary = countImportSummary(fields);
  const cards = fields.map((f) => renderImportFieldCard(f.label, f.fieldKey, f.value === "Set" ? "" : f.value, f.status, f.inputType)).join("");
  const detected = (data.detectedWebsiteServices || [])
    .map((s) => `<li>${esc(s.serviceName)} <span class="hint-inline">${s.confidence}% confidence</span></li>`)
    .join("");
  const importStatus = data.websiteAnalysisAt
    ? `<p class="wizard-import-status ok">Last website import: ${esc(new Date(data.websiteAnalysisAt).toLocaleString("en-GB"))}${data.websiteAnalysisSourceUrl ? ` from ${esc(data.websiteAnalysisSourceUrl)}` : ""}</p>`
    : `<p class="wizard-import-status warn">No website import yet — enter your URL below and run import.</p>`;

  return `<div class="wizard-step-panel" data-wizard-step="1">
<p class="wizard-step-why">${esc(WIZARD_STEPS[0].why)}</p>
${importStatus}
${renderBrandSummaryPanel(data)}
${renderGenerationInputStatusPanel(data)}
<h3 class="wizard-subhead">Business description</h3>
<div class="field"><label for="businessDescription">Business description <span class="hint-inline">required for high-quality campaign content</span></label><textarea id="businessDescription" data-field="businessDescription" rows="3">${esc(data.businessDescription)}</textarea><span class="hint">Keep this short: who you help, where you serve, and what patients can expect.</span></div>
<div class="wizard-import-summary">
<span class="pill imported">${summary.imported + summary.review} imported</span>
<span class="pill confirmed">${summary.confirmed} confirmed</span>
<span class="pill missing">${summary.missing} not found</span>
</div>
<h3 class="wizard-subhead">Website import ${wizardHelp("Paste your pharmacy website URL and click Analyse — we import brand, contact and services automatically.")}</h3>
${renderWebsiteBrandingSection(data).replace(/<section[^>]*>/, "").replace(/<\/section>\s*$/, "")}
<h3 class="wizard-subhead">Detected business information ${wizardHelp("Review imported values — Accept or Edit each field. You should rarely need to type.")}</h3>
<div class="wizard-import-grid">${cards}</div>
${detected ? `<h3 class="wizard-subhead">Services detected on website</h3><ul class="wizard-detected-list">${detected}</ul>` : ""}
${renderLocalIntelPreviewPanel(data)}
<h3 class="wizard-subhead">Google Business listing ${wizardHelp("Optional — improves local competitor comparison.")}</h3>
<div class="grid-2">
${field("Google Place ID", "googlePlaceId", data.googlePlaceId, "text", "Optional — from Google Maps share link")}
${field("Google Business Profile URL", "googleBusinessProfileUrl", data.googleBusinessProfileUrl, "url")}
</div>
${data.googleBusinessRating != null ? `<p class="hint">Google rating: ${data.googleBusinessRating.toFixed(1)} (${data.googleBusinessReviewCount} reviews)</p>` : ""}
<input type="hidden" id="profileFieldConfirmations" data-field="profileFieldConfirmations" value='${esc(JSON.stringify(data.profileFieldConfirmations || {}))}'/>
<input type="hidden" id="websiteImportedFieldKeys" data-field="websiteImportedFieldKeys" value='${esc(JSON.stringify(data.websiteImportedFieldKeys || []))}'/>
</div>`;
}

export function renderWizardStepBasics(data: PharmacyProfileData): string {
  const gaps = buildWizardImportFields(data).filter((f) => f.status === "missing" || !f.value);
  const gapKeys = new Set(gaps.map((g) => g.id));
  const allGood = gaps.length === 0 && hasOpeningHours(data);
  const gapCards = gaps
    .filter((g) => g.id !== "openingHours")
    .map((f) => renderImportFieldCard(f.label, f.fieldKey, f.value, f.status, f.inputType))
    .join("");
  const hours = !hasOpeningHours(data) ? `<h3 class="wizard-subhead">Opening hours</h3><div class="grid-2">${renderHourFields(data)}</div>` : "";
  const social =
    !data.socialFacebook && !data.socialInstagram
      ? `<h3 class="wizard-subhead">Social links <span class="hint-inline">optional</span></h3>
<div class="grid-2">
${field("Facebook", "socialFacebook", data.socialFacebook, "url")}
${field("Instagram", "socialInstagram", data.socialInstagram, "url")}
</div>`
      : "";

  return `<div class="wizard-step-panel" data-wizard-step="2" hidden>
<p class="wizard-step-why">${esc(WIZARD_STEPS[1].why)}</p>
${allGood ? `<div class="wizard-ready ok"><strong>✓ Basics look complete</strong><p>Imported contact and address information is in place. Continue to brand styling or edit any field below.</p></div>` : ""}
${gapCards || (!allGood ? "" : "")}
${hours}
${social}
${gapKeys.has("pharmacyName") || !data.pharmacyName ? field("Pharmacy name", "pharmacyName", data.pharmacyName, "text", "", "required") : `<input type="hidden" id="pharmacyName" data-field="pharmacyName" value="${esc(data.pharmacyName)}"/>`}
${gapKeys.has("phone") || !data.phone ? field("Telephone", "phone", data.phone, "tel", "", "required") : `<input type="hidden" id="phone" data-field="phone" value="${esc(data.phone)}"/>`}
<button type="button" class="wizard-ghost" data-skip-step="2">Skip for now — I'll confirm later</button>
</div>`;
}

export function renderWizardStepBrand(data: PharmacyProfileData): string {
  return `<div class="wizard-step-panel" data-wizard-step="3" hidden>
<p class="wizard-step-why">${esc(WIZARD_STEPS[2].why)}</p>
<div class="grid-2">
${field("Logo URL", "logoUrl", data.logoUrl, "url")}
${field("Primary colour", "brandPrimaryColor", data.brandPrimaryColor, "color")}
${field("Secondary colour", "brandSecondaryColor", data.brandSecondaryColor, "color")}
${field("CTA button colour", "brandCtaColor", data.brandCtaColor, "color")}
${field("Heading font", "fontHeading", data.fontHeading, "text")}
${field("Body font", "fontBody", data.fontBody, "text")}
</div>
${renderV2BrandSection(data).replace(/<section[^>]*>/, "").replace(/<\/section>\s*$/, "")}
<p class="hint">Header/footer colours and footer links are imported from your website when available.</p>
</div>`;
}

export function renderWizardStepServices(data: PharmacyProfileData, slug?: string): string {
  const confirmation = buildWizardServiceConfirmationOptions(data, slug);
  const detectedBanner =
    data.detectedWebsiteServices?.length
      ? `<div class="wizard-detected-banner"><strong>Detected from your website:</strong> ${data.detectedWebsiteServices.map((s) => esc(s.serviceName)).join(", ")}</div>`
      : (data.websiteImportSnapshot?.servicesDetected?.length
        ? `<div class="wizard-detected-banner"><strong>Website Intelligence services:</strong> ${data.websiteImportSnapshot.servicesDetected.map((s) => esc(String(s))).join(", ")}</div>`
        : "");
  const nonCanonical =
    confirmation.nonCanonicalLabels.length
      ? `<div class="wizard-noncanonical-banner" role="status"><strong>Non-canonical website labels (not selectable):</strong> ${confirmation.nonCanonicalLabels.map((l) => esc(l)).join(", ")}</div>`
      : "";
  const checkboxes = confirmation.rows
    .map((s) => {
      const evidenceBlock = s.detectedSuggestion
        ? (() => {
            const ev = s.evidence;
            const strength = ev?.strength || "unavailable";
            const url = ev?.sourceUrl?.trim() || "";
            const text = ev?.evidenceText?.trim() || "";
            const conf = ev?.confidence;
            const strengthLabel =
              strength === "strong" ? "Evidence strength: strong" : strength === "weak" ? "Weak evidence" : "Evidence unavailable";
            const openLink = url
              ? `<a class="wizard-evidence-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open evidence page</a>`
              : `<span class="wizard-evidence-unavailable">Open evidence page unavailable</span>`;
            return `<div class="wizard-service-evidence" data-evidence-strength="${esc(strength)}">
<span class="wizard-evidence-strength ${strength === "weak" ? "is-weak" : strength === "unavailable" ? "is-unavailable" : "is-strong"}">${esc(strengthLabel)}</span>
<div class="wizard-evidence-row"><span class="lbl">Source page</span><span class="val">${url ? esc(url) : "Unavailable"}</span></div>
<div class="wizard-evidence-row"><span class="lbl">Stored evidence</span><span class="val">${text ? esc(text) : "Unavailable"}</span></div>
<div class="wizard-evidence-row"><span class="lbl">Confidence</span><span class="val">${conf != null ? `${esc(String(conf))}%` : "Unavailable"}</span></div>
${openLink}
</div>`;
          })()
        : "";
      return `<label class="wizard-service-check ${s.detectedSuggestion ? "from-website" : ""}"><span class="wizard-service-check-main"><input type="checkbox" class="wizard-service-cb" value="${esc(s.serviceId)}" ${s.checked ? "checked" : ""}/> <span>${esc(s.serviceName)}${s.detectedSuggestion ? ' <span class="wizard-import-badge status-imported">Detected suggestion</span>' : ""}</span></span>${evidenceBlock}</label>`;
    })
    .join("");
  const v2Services = renderWizardServiceQuickSetup(data) || renderV2ServiceSection(data).replace(/^<section[^>]*>/, "").replace(/<\/section>\s*$/, "");
  return `<div class="wizard-step-panel" data-wizard-step="4" hidden>
<p class="wizard-step-why">${esc(WIZARD_STEPS[3].why)}</p>
${detectedBanner}
${nonCanonical}
<h3 class="wizard-subhead">Enabled services ${wizardHelp("Tick services you offer. Website detections are suggestions only until you confirm and save.")}</h3>
<div class="wizard-service-grid" id="wizardServiceGrid">${checkboxes}</div>
<input type="hidden" id="selectedServices" data-field="selectedServices" value='${esc(JSON.stringify(confirmation.selectedServiceIds))}'/>
<p class="hint">Suggestions stay unchecked until confirmed. Saving confirmed services does not start Growth Intelligence, campaigns or content generation.</p>
<button type="button" class="wizard-primary" id="btnSaveConfirmedServices">Save confirmed services</button>
<span class="wizard-save-status" id="confirmedServicesSaveStatus" aria-live="polite"></span>
<div class="wizard-service-nav" id="wizardServiceNav" hidden>
<button type="button" class="wizard-ghost" id="wizardServicePrev">← Previous service</button>
<span id="wizardServiceCounter"></span>
<button type="button" class="wizard-ghost" id="wizardServiceNext">Next service →</button>
</div>
<div id="wizardServiceDetailHost">${v2Services}</div>
<button type="button" class="wizard-ghost" data-skip-step="4">Skip service details for now</button>
</div>`;
}

export function renderWizardStepLocal(data: PharmacyProfileData): string {
  const localSection = renderLocalAreasSection(data).replace(/^<section[^>]*>/, "").replace(/<\/section>\s*$/, "");
  const entityGroups = WIZARD_LOCAL_GROUPS.map((g) => renderEntityGroup(data, g)).join("");
  const competitors = renderCompetitorCards(data.profileCompetitors || []);
  return `<div class="wizard-step-panel" data-wizard-step="5" hidden>
<p class="wizard-step-why">${esc(WIZARD_STEPS[4].why)}</p>
<button type="button" class="wizard-primary" id="btnWizardEnrichLocal">Load local suggestions</button>
<p class="hint" id="wizardEnrichStatus">${data.profileWizardEnrichedAt ? `Last loaded: ${esc(new Date(data.profileWizardEnrichedAt).toLocaleString("en-GB"))}` : "Uses Google Places when available — otherwise demo suggestions."}</p>
<h3 class="wizard-subhead">Areas you serve</h3>
${localSection}
<h3 class="wizard-subhead">Nearby healthcare & landmarks</h3>
<div id="wizardLocalEntityHost">${entityGroups}</div>
<h3 class="wizard-subhead">Local pharmacy competitors</h3>
<p class="hint">Select competitors patients might compare — valuable for your local strategy (not used in generated content yet).</p>
<div id="wizardCompetitorHost">${competitors}</div>
<label class="wizard-entity-check"><input type="checkbox" id="competitorReviewConfirmed" data-field="competitorReviewConfirmed" ${data.competitorReviewConfirmed ? "checked" : ""}/> <span><strong>Competitor review completed</strong><span class="hint">Tick when you have reviewed the competitor suggestions for this campaign.</span></span></label>
<input type="hidden" id="profileCompetitors" data-field="profileCompetitors" value='${esc(JSON.stringify(data.profileCompetitors || []))}'/>
<input type="hidden" id="localIntelligenceCandidates" data-field="localIntelligenceCandidates" value='${esc(JSON.stringify(data.localIntelligenceCandidates || {}))}'/>
</div>`;
}

export function renderWizardStepPatients(data: PharmacyProfileData): string {
  return `<div class="wizard-step-panel" data-wizard-step="6" hidden>
<p class="wizard-step-why">${esc(WIZARD_STEPS[5].why)}</p>
<h3 class="wizard-subhead">Who do you help most?</h3>
${renderPatientGroupCheckboxes(data)}
<h3 class="wizard-subhead">Unique selling points</h3>
${renderUniqueSellingPointCheckboxes(data)}
<button type="button" class="wizard-ghost" data-skip-step="6">Not sure yet — skip</button>
</div>`;
}

export function renderWizardStepTrust(data: PharmacyProfileData, slug: string, authorityMissing: string[]): string {
  void slug;
  void authorityMissing;
  const team = renderV2TeamSection(data).replace(/^<section[^>]*>/, "").replace(/<\/section>\s*$/, "");
  return `<div class="wizard-step-panel" data-wizard-step="7" hidden>
<p class="wizard-step-why">${esc(WIZARD_STEPS[6].why)}</p>
${renderTrustProfessionalReviewGate(data)}
<div class="grid-2">
${field("Years serving community", "yearsServingCommunity", data.yearsServingCommunity, "text")}
${field("NHS pharmacy", "nhsServicesAvailable", data.nhsServicesAvailable ? "1" : "", "checkbox")}
${field("Independent prescriber", "independentPrescriberAvailable", data.independentPrescriberAvailable ? "1" : "", "checkbox")}
${field("Consultation room", "consultationRoomAvailable", data.consultationRoomAvailable ? "1" : "", "checkbox")}
</div>
<h3 class="wizard-subhead">Professional review & team</h3>
<div class="grid-2">
${field("Languages spoken", "languagesSpoken", (data.languagesSpoken || []).join(", "), "text", "Comma-separated")}
</div>
${team}
</div>`;
}

export function renderWizardStepReadiness(data: PharmacyProfileData, quality: WizardQualityResult, slug: string): string {
  const commercial = computeCommercialPublishingReadiness(data);
  const technicalStatus = quality.readyToGenerate ? "PASS" : "FAIL";
  const toneOptions = CONTENT_TONE_OPTIONS.map(
    (o) => `<option value="${o.value}" ${data.contentIntelligence?.toneOfVoice === o.value || data.tone === o.value ? "selected" : ""}>${esc(o.label)}</option>`,
  ).join("");
  const bookingOptions = BOOKING_METHOD_OPTIONS.map(
    (o) => `<option value="${esc(o.value)}" ${data.bookingMethod === o.value ? "selected" : ""}>${esc(o.label)}</option>`,
  ).join("");
  const conversion = renderV2ConversionSection(data).replace(/^<section[^>]*>/, "").replace(/<\/section>\s*$/, "");
  const content = renderV2ContentSection(data).replace(/^<section[^>]*>/, "").replace(/<\/section>\s*$/, "");

  const cats = quality.categories
    .map((c) => {
      const icon = c.status === "complete" ? "✓" : c.status === "partial" ? "◐" : "○";
      return `<div class="wizard-score-row ${c.status}"><span>${icon} ${esc(c.label)}</span><strong>${c.percent}%</strong></div>`;
    })
    .join("");
  const requiredRows = quality.requiredQualityFields
    .map((fieldItem) => `<div class="wizard-quality-field ${fieldItem.ok ? "complete" : "missing"}"><span>${fieldItem.ok ? "✓" : "○"} ${esc(fieldItem.label)}</span><strong>${fieldItem.ok ? "Complete" : "Incomplete"}</strong></div>`)
    .join("");
  const optionalRows = quality.optionalQualityFields
    .map((fieldItem) => `<div class="wizard-quality-field optional ${fieldItem.ok ? "complete" : "missing"}"><span>${esc(fieldItem.label)}</span><strong>${fieldItem.ok ? "Complete" : "Optional"}</strong></div>`)
    .join("");
  const actionButtons = Array.from(
    new Map(
      quality.requiredQualityFields
        .filter((fieldItem) => !fieldItem.ok)
        .map((fieldItem) => [fieldItem.actionLabel, fieldItem]),
    ).values(),
  )
    .map((fieldItem) => `<a class="wizard-primary wizard-action-jump" href="/api/pharmacy-profile-quality?slug=${esc(slug)}">${esc(fieldItem.actionLabel)}</a>`)
    .join("");
  const ready = quality.requiredQualityIncomplete.length === 0
    ? `<div class="wizard-ready ok"><strong>Campaign Content Quality complete</strong><p>All seven quality fields are complete. Generation is not started automatically.</p><a class="wizard-primary" href="/api/growth-engine?slug=${esc(slug)}">Return to Growth Engine</a></div>`
    : `<div class="wizard-ready warn"><strong>Guided completion needed</strong><p>Complete the required quality items below before generating high-quality campaign content.</p><div class="wizard-guided-actions">${actionButtons}</div></div>`;

  const completionMeta = `<div class="wizard-completion-meta">
<span><strong>Technical Generation Readiness:</strong> ${technicalStatus}</span>
<span><strong>Commercial Publishing Readiness:</strong> ${commercial.status}</span>
<span><strong>Campaign Content Quality:</strong> ${quality.overallScore}%</span>
<span>~${quality.estimatedMinutesRemaining} min remaining</span>
</div>`;

  return `<div class="wizard-step-panel" data-wizard-step="8" hidden>
<p class="wizard-step-why">${esc(WIZARD_STEPS[7].why)}</p>
${completionMeta}
<div class="wizard-status-grid">
<div class="wizard-status-card ${technicalStatus === "PASS" ? "ok" : "warn"}"><span>Technical Generation Readiness</span><strong>${technicalStatus}</strong><small>Structural inputs required for generation.</small></div>
<div class="wizard-status-card ${commercial.status === "READY" ? "ok" : "warn"}"><span>Commercial Publishing Readiness</span><strong>${commercial.status}</strong><small>Identity and GPhC publishing gate.</small></div>
<div class="wizard-status-card quality"><span>Campaign Content Quality</span><strong>${quality.overallScore}%</strong><small>Content depth before generation.</small></div>
</div>
<div class="grid-2">
${field("Preferred CTA", "preferredCta", data.preferredCta || data.preferredCtaWording, "text")}
<div class="field"><label for="bookingMethod">Booking method</label><select id="bookingMethod" data-field="bookingMethod"><option value="">Select…</option>${bookingOptions}</select></div>
<div class="field"><label for="contentTone">Content tone</label><select id="contentTone" data-field="tone">${toneOptions}</select></div>
${field("Booking URL", "bookingUrl", data.bookingUrl, "url", "Optional")}
</div>
${conversion}
${content}
<div class="wizard-score-band band-${quality.band}">
<div class="wizard-score-main"><span class="wizard-score-value">${quality.overallScore}%</span><span class="wizard-score-label">Campaign Content Quality · ${esc(quality.bandLabel)}</span></div>
</div>
${ready}
<h3 class="wizard-subhead">Required quality fields</h3>
<div class="wizard-quality-grid">${requiredRows}</div>
<h3 class="wizard-subhead">Recommended optional improvements</h3>
<div class="wizard-quality-grid">${optionalRows}</div>
<h3 class="wizard-subhead">Section context</h3>
<div class="wizard-score-grid">${cats}</div>
</div>`;
}

export function renderWizardStepper(currentStep: number): string {
  return WIZARD_STEPS.map((s) => {
    const cls = s.step === currentStep ? "active" : s.step < currentStep ? "done" : "";
    return `<button type="button" class="wizard-step-dot ${cls}" data-goto-step="${s.step}" title="${esc(s.title)}"><span class="dot-num">${s.step}</span><span class="dot-label">${esc(s.title)}</span></button>`;
  }).join("");
}

export function wizardPageCss(): string {
  return `${serviceFactsFormCss()}
.wizard-shell{max-width:920px;margin:0 auto;padding:24px 20px 120px}
.wizard-progress{margin:16px 0 24px}
.wizard-progress-bar{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden}
.wizard-progress-fill{height:100%;background:linear-gradient(90deg,#005eb8,#007a7a);transition:width .25s}
.wizard-progress-meta{display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-top:6px;font-weight:700}
.wizard-stepper{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px}
.wizard-step-dot{border:1px solid #dbeafe;background:#fff;border-radius:999px;padding:4px 10px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:#64748b}
.wizard-step-dot.active{background:#005eb8;color:#fff;border-color:#005eb8}
.wizard-step-dot.done{background:#ecfdf5;color:#065f46;border-color:#bbf7d0}
.wizard-step-dot .dot-num{font-weight:800}
.wizard-step-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 8px 24px rgba(15,23,42,.04)}
.wizard-step-why{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;font-size:13px;color:#1e3a5f;margin:0 0 18px}
.wizard-subhead{font-size:15px;margin:20px 0 10px;color:#0f172a}
.hint-inline{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase}
.wizard-nav{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e2e8f0;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;z-index:40}
.wizard-nav-inner{max-width:920px;margin:0 auto;width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px}
.wizard-primary,.wizard-ghost{border:0;border-radius:10px;padding:12px 18px;font-weight:800;cursor:pointer;font-size:14px;text-decoration:none;display:inline-block}
.wizard-primary{background:#005eb8;color:#fff}
.wizard-ghost{background:#f1f5f9;color:#334155}
.wizard-save-status{font-size:12px;color:#64748b}
.wizard-import-summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px}
.pill{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px}
.pill.imported{background:#ecfdf5;color:#065f46}
.pill.confirmed{background:#eff6ff;color:#1e40af}
.pill.missing{background:#fef2f2;color:#b91c1c}
.wizard-import-grid{display:grid;gap:10px;margin-bottom:16px}
.wizard-import-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fafbfc}
.wizard-import-card.status-imported{border-color:#bbf7d0;background:#f0fdf4}
.wizard-import-card.status-missing{border-color:#fecaca;background:#fff7ed}
.wizard-import-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;font-size:13px}
.wizard-import-badge{font-size:10px;font-weight:800;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#475569}
.wizard-import-badge.status-imported{background:#bbf7d0;color:#065f46}
.wizard-import-badge.status-missing{background:#fecaca;color:#991b1b}
.wizard-generation-status{border:1px solid #dbeafe;background:#f8fbff;border-radius:12px;padding:14px;margin:14px 0}
.wizard-generation-status-head{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#0f172a;margin-bottom:10px}
.wizard-generation-status-head span{font-weight:900;color:#005eb8}
.wizard-generation-status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.wizard-generation-status-row{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:10px;display:grid;gap:4px;font-size:12px}
.wizard-generation-status-row strong{font-size:10px;text-transform:uppercase;border-radius:999px;padding:3px 8px;width:max-content}
.wizard-generation-status-row small{color:#64748b;line-height:1.35}
.wizard-generation-status-row.auto strong{background:#bbf7d0;color:#065f46}
.wizard-generation-status-row.action strong{background:#fed7aa;color:#9a3412}
.wizard-commercial-gate{border:1px solid #fed7aa;background:#fff7ed;border-radius:14px;padding:16px;margin:0 0 18px}
.wizard-commercial-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:12px}
.wizard-commercial-head h3{margin:0 0 6px;font-size:16px;color:#7c2d12}
.wizard-commercial-head p{margin:0;color:#9a3412;font-size:13px;line-height:1.45}
.wizard-commercial-head strong{font-size:11px;text-transform:uppercase;border-radius:999px;padding:5px 10px;white-space:nowrap}
.wizard-commercial-head strong.ready{background:#bbf7d0;color:#065f46}
.wizard-commercial-head strong.blocked{background:#fecaca;color:#991b1b}
.wizard-action-field{background:#fff;border:1px solid #fed7aa;border-radius:10px;padding:10px}
.wizard-action-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px;font-size:13px}
.wizard-action-badge{font-size:10px;font-weight:900;text-transform:uppercase;border-radius:999px;padding:3px 8px}
.wizard-action-badge.required{background:#fecaca;color:#991b1b}
.wizard-action-badge.complete{background:#bbf7d0;color:#065f46}
.wizard-action-badge.optional{background:#e0f2fe;color:#075985}
.wizard-commercial-subhead{font-size:13px;text-transform:uppercase;letter-spacing:.04em;margin:14px 0 10px;color:#7c2d12}
.wizard-commercial-subhead.optional{color:#075985}
.wizard-action-field.optional{border-color:#bae6fd;background:#f0f9ff}
.wizard-commercial-missing{margin:12px 0 0;color:#991b1b;font-size:13px;font-weight:700}
.wizard-import-actions{display:flex;gap:6px;margin-top:8px}
.wizard-chip-btn{font-size:11px;font-weight:700;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 10px;cursor:pointer}
.wizard-chip-btn.ghost{background:transparent}
.wizard-import-status{font-size:13px;padding:10px 12px;border-radius:8px;margin-bottom:12px}
.wizard-import-status.ok{background:#ecfdf5;color:#065f46}
.wizard-import-status.warn{background:#fff7ed;color:#9a3412}
.wizard-detected-list{margin:0;padding-left:20px;font-size:13px;color:#475569}
.wizard-detected-banner{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px}
.wizard-noncanonical-banner{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px;color:#9a3412}
.wizard-service-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:16px}
.wizard-service-check{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:12px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;cursor:pointer}
.wizard-service-check-main{display:flex;align-items:flex-start;gap:8px}
.wizard-service-check.from-website{border-color:#bbf7d0}
.wizard-service-evidence{margin-top:2px;padding:8px 10px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#334155;cursor:default}
.wizard-service-evidence[data-evidence-strength="weak"]{background:#fff7ed;border-color:#fdba74}
.wizard-service-evidence[data-evidence-strength="unavailable"]{background:#f8fafc;border-color:#cbd5e1;color:#64748b}
.wizard-evidence-strength{display:inline-block;font-weight:700;font-size:11px;margin-bottom:6px}
.wizard-evidence-strength.is-weak{color:#c2410c}
.wizard-evidence-strength.is-unavailable{color:#64748b}
.wizard-evidence-strength.is-strong{color:#15803d}
.wizard-evidence-row{display:grid;grid-template-columns:90px 1fr;gap:6px;margin:3px 0}
.wizard-evidence-row .lbl{color:#64748b;font-weight:600}
.wizard-evidence-row .val{word-break:break-word}
.wizard-evidence-open{display:inline-block;margin-top:6px;color:#1d4ed8;font-weight:600;text-decoration:underline}
.wizard-evidence-unavailable{display:inline-block;margin-top:6px;color:#94a3b8;font-style:italic}
.wizard-service-nav{display:flex;align-items:center;justify-content:space-between;margin:12px 0;font-size:13px;font-weight:700}
.wizard-chip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:14px}
.wizard-chip-check,.wizard-entity-check{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;cursor:pointer;background:#fff}
.wizard-entity-grid{display:grid;gap:8px;margin-bottom:12px}
.wizard-entity-group{margin-bottom:16px}
.wizard-entity-group h4{margin:0 0 8px;font-size:14px}
.wizard-competitor-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px;background:#fafbfc}
.wizard-competitor-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:#64748b;margin:6px 0}
.wizard-score-band{border-radius:12px;padding:20px;margin-bottom:16px}
.band-poor{background:#fef2f2;border:1px solid #fecaca}
.band-good{background:#fffbeb;border:1px solid #fde68a}
.band-excellent{background:#ecfdf5;border:1px solid #bbf7d0}
.wizard-score-main{text-align:center}
.wizard-score-value{font-size:42px;font-weight:900;color:#0f172a;display:block}
.wizard-score-label{font-size:14px;font-weight:700;color:#64748b}
.wizard-score-grid{display:grid;gap:8px;margin-bottom:16px}
.wizard-score-row{display:flex;justify-content:space-between;padding:10px 12px;border-radius:8px;background:#f8fafc;font-size:13px}
.wizard-score-row.complete{background:#ecfdf5}
.wizard-ready{border-radius:12px;padding:16px;margin-bottom:16px}
.wizard-ready.ok{background:#ecfdf5;border:1px solid #bbf7d0}
.wizard-ready.warn{background:#fff7ed;border:1px solid #fed7aa}
.wizard-missing,.wizard-improve{margin:8px 0;padding-left:18px;font-size:13px;color:#64748b}
.wizard-error{color:#b91c1c;font-size:13px;font-weight:700;margin:8px 0}
.wizard-help{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#e2e8f0;color:#475569;font-size:11px;font-weight:900;cursor:help;margin-left:6px;vertical-align:middle}
.wizard-brand-summary{display:flex;align-items:center;gap:14px;padding:14px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;margin-bottom:14px}
.wizard-brand-logo{max-height:48px;max-width:120px;border-radius:6px;background:#fff;padding:4px}
.wizard-brand-swatch{display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid #cbd5e1;vertical-align:middle;margin-right:6px}
.wizard-brand-meta{font-size:12px;color:#64748b;margin-top:4px}
.wizard-local-preview{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:16px 0;background:#fafbfc}
.wizard-local-preview-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f1f5f9}
.wizard-local-preview-row:last-child{border-bottom:0}
.wizard-local-preview-row.ok strong{color:#065f46}
.wizard-local-preview-row.pending strong{color:#64748b}
.wizard-import-card.status-review{border-color:#fde68a;background:#fffbeb}
.wizard-import-badge.status-review{background:#fef3c7;color:#92400e}
.wizard-chip-btn.accept{background:#059669;color:#fff;border-color:#059669}
.wizard-completion-meta{display:flex;flex-wrap:wrap;gap:16px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:16px;font-size:13px}
.wizard-status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px}
.wizard-status-card{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:14px;display:grid;gap:4px}
.wizard-status-card span{font-size:12px;font-weight:800;color:#475569;text-transform:uppercase}
.wizard-status-card strong{font-size:24px;color:#0f172a}
.wizard-status-card small{color:#64748b;font-size:12px}
.wizard-status-card.ok{border-color:#bbf7d0;background:#f0fdf4}
.wizard-status-card.warn{border-color:#fed7aa;background:#fff7ed}
.wizard-status-card.quality{border-color:#bfdbfe;background:#eff6ff}
.wizard-guided-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.wizard-action-jump{font-size:13px;padding:10px 12px}
.wizard-quality-grid{display:grid;gap:8px;margin-bottom:16px}
.wizard-quality-field{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;font-size:13px}
.wizard-quality-field.complete{background:#ecfdf5;border-color:#bbf7d0}
.wizard-quality-field.optional{background:#f8fafc;border-color:#e2e8f0}
.wizard-quality-field strong{font-size:11px;text-transform:uppercase;color:#475569}
.wizard-svc-quick{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:10px;background:#fafbfc}
.wizard-svc-quick summary{cursor:pointer;font-weight:700;font-size:14px}`;
}
