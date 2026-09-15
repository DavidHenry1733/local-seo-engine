/**
 * Profile Dashboard V1 — form section HTML builders.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { OPENING_HOUR_DAYS } from "./pharmacyProfileHours.ts";
import { REVIEWER_BIO_EXAMPLES } from "./pharmacyProfileDashboardConfig.ts";
import {
  brandImportPanelCss,
  renderBrandImportPanelHtml,
} from "../generator/brandImportPanel.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function field(label: string, id: string, value: string, type = "text", hint = "", tier: "required" | "optional" = "optional"): string {
  const badge =
    tier === "required"
      ? `<span class="field-tier field-tier-required">Required</span>`
      : `<span class="field-tier field-tier-optional">Optional</span>`;
  const input =
    type === "checkbox"
      ? `<label class="check-row"><input type="checkbox" id="${id}" data-field="${id}" ${value ? "checked" : ""}/> ${esc(label)} ${badge}</label>`
      : `<label for="${id}">${esc(label)} ${badge}</label><input type="${type}" id="${id}" data-field="${id}" value="${esc(value)}"/>`;
  return `<div class="field field-${tier}">${input}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>`;
}

export function renderWebsiteBrandingSection(data: PharmacyProfileData): string {
  return `<section class="panel" id="section-branding">
<h2>2. Website Analysis &amp; Profile Import</h2>
<p class="lead">Enter your existing pharmacy website and click <strong>Analyse Existing Website</strong>. PharmaConnect reuses the Local SEO Engine analyser to populate identity, branding, navigation, contact, location and service detection — then shows what still needs manual completion.</p>
${renderBrandImportPanelHtml({ mode: "pharmacy", websiteUrl: data.website || "" })}
<p class="hint" style="margin-top:12px">Review imported values before saving. Existing manual profile values are preserved unless fields are empty. Save Profile to persist and refresh Authority Audit.</p>
</section>`;
}

/** @deprecated use renderWebsiteBrandingSection */
export const renderBrandingSection = renderWebsiteBrandingSection;

export function comingSoonField(label: string, id: string): string {
  return `<div class="field field-disabled"><label for="${id}">${esc(label)}</label><input type="text" id="${id}" disabled placeholder="Coming Soon"/><span class="hint">Future feature — not yet available</span></div>`;
}

export function renderBusinessSection(data: PharmacyProfileData, hourFields: string): string {
  return `<section class="panel" id="section-business">
<h2>1. Business Information</h2>
<p class="lead">Legal identity, contact and location — used across headers, footers and trust layers.</p>
<div class="grid-2">
${field("Pharmacy Name", "pharmacyName", data.pharmacyName, "text", "", "required")}
${field("Trading Name", "tradingName", data.tradingName, "text", "", "optional")}
${field("Company Name", "companyName", data.companyName, "text", "", "optional")}
${field("Company Registration Number", "companyRegistrationNumber", data.companyRegistrationNumber, "text", "", "optional")}
${field("GPhC Premises Number", "gphcNumber", data.gphcNumber, "text", "", "optional")}
${field("NHS Profile URL", "nhsProfileUrl", data.nhsProfileUrl, "url", "", "optional")}
${field("Website", "website", data.website, "url", "Required if brand is not imported", "required")}
${field("Email", "businessEmail", data.businessEmail, "email", "", "optional")}
${field("Telephone", "phone", data.phone, "tel", "Used on headers, footers and service pages", "required")}
${field("Emergency Contact", "emergencyContact", data.emergencyContact, "tel", "", "optional")}
</div>
</section>

<section class="panel" id="section-address">
<h2>Address &amp; Location</h2>
<div class="grid-2">
${field("Address Line 1", "addressLine1", data.addressLine1, "text", "", "required")}
${field("Address Line 2", "addressLine2", data.addressLine2, "text", "", "optional")}
${field("Town / City", "townCity", data.townCity, "text", "", "required")}
${field("County", "county", data.county, "text", "", "optional")}
${field("Postcode", "postcode", data.postcode, "text", "", "required")}
${field("Country", "country", data.country || "United Kingdom", "text", "", "optional")}
${field("Latitude", "latitude", data.latitude, "text", "Optional if Google Maps URL is set", "optional")}
${field("Longitude", "longitude", data.longitude, "text", "Optional if Google Maps URL is set", "optional")}
${field("Google Maps URL", "googleMapsEmbedUrl", data.googleMapsEmbedUrl, "url", "Leave blank to auto-generate from address", "optional")}
</div>
<div class="address-map" id="addressMapPreview"></div>
</section>

<section class="panel" id="section-hours">
<h2>Opening Hours</h2>
<p class="lead">Displayed on service pages exactly as formatted below.</p>
<div class="grid-2">${hourFields}</div>
<div class="field" style="margin-top:12px">
<label>Page display preview</label>
<div id="hoursPreview" style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px">${esc(data.openingHours || "No hours set")}</div>
</div>
</section>

</section>`;
}

export function renderLocalAreasSection(data: PharmacyProfileData): string {
  const town = data.primaryTown || data.primaryCity || data.townCity || "";
  const limitOptions = [5, 10, 15, 20, 30]
    .map((n) => `<option value="${n}">${n}</option>`)
    .join("");
  const areas = data.selectedAreas?.length
    ? data.selectedAreas
    : (data.rankingAreas || []).map((name, i) => ({
        areaName: name,
        areaType: "",
        priority: i + 1,
        order: i + 1,
        selected: true,
        source: "legacy",
      }));
  const selectedCount = areas.filter((a) => a.selected).length;
  const lastGen = data.areaDiscoveryUpdatedAt
    ? new Date(data.areaDiscoveryUpdatedAt).toLocaleString("en-GB")
    : "Not generated yet";
  const sourceLabel = data.areaDiscoverySource || "—";

  const rows = areas
    .map(
      (a, i) =>
        `<li class="area-row" data-area-index="${i}">
<label class="check-row area-check"><input type="checkbox" class="area-selected" ${a.selected ? "checked" : ""}/> <strong>${esc(a.areaName)}</strong></label>
<span class="area-meta">${esc(a.areaType || "area")} · priority ${a.priority}${a.confidence != null ? ` · ${a.confidence}%` : ""} · ${esc(a.source)}</span>
<span class="area-actions"><button type="button" class="btn-area-move" data-dir="up" title="Move up">↑</button><button type="button" class="btn-area-move" data-dir="down" title="Move down">↓</button><button type="button" class="btn-area-remove" title="Remove">×</button></span>
</li>`,
    )
    .join("");

  return `<section class="panel" id="section-coverage">
<h2>Local Areas &amp; Target Locations</h2>
<p class="lead">Enter your main town or city and generate suggested local cluster areas in priority order. Tick areas to include in campaigns and coverage.</p>
<div class="grid-2">
<div class="field field-required"><label for="primaryTown">Main Town / City <span class="field-tier field-tier-required">Required</span></label><input type="text" id="primaryTown" data-field="primaryTown" value="${esc(town)}" placeholder="e.g. Rotherham"/></div>
<div class="field"><label for="areaSuggestLimit">Number of suggested areas</label><select id="areaSuggestLimit">${limitOptions}</select></div>
</div>
<div style="margin:12px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center">
<button type="button" class="btn-area-generate" id="btnGenerateAreas">Generate Suggested Areas</button>
<span class="hint" id="areaGenStatus"></span>
</div>
<div class="field"><label>Suggested area checklist</label><ul class="area-checklist" id="areaChecklist">${rows || '<li class="muted area-empty">Generate areas or add manually below.</li>'}</ul></div>
<div class="grid-2" style="margin-top:12px">
<div class="field"><label for="manualAreaInput">Manual area</label><input type="text" id="manualAreaInput" placeholder="Add neighbourhood or suburb"/></div>
<div class="field" style="display:flex;align-items:flex-end"><button type="button" class="btn-area-add" id="btnAddManualArea">Add area</button></div>
</div>
<div class="area-summary">
<span><strong id="areaSelectedCount">${selectedCount}</strong> selected</span>
<span>Source: <strong id="areaSourceLabel">${esc(sourceLabel)}</strong></span>
<span>Last generated: <strong id="areaLastGenerated">${esc(lastGen)}</strong></span>
</div>
<input type="hidden" id="selectedAreas" data-field="selectedAreas" value='${esc(JSON.stringify(areas))}'/>
<input type="hidden" id="manualAreas" data-field="manualAreas" value='${esc(JSON.stringify(data.manualAreas || []))}'/>
<input type="hidden" id="areaDiscoverySource" data-field="areaDiscoverySource" value="${esc(data.areaDiscoverySource || "")}"/>
<input type="hidden" id="areaDiscoveryUpdatedAt" data-field="areaDiscoveryUpdatedAt" value="${esc(data.areaDiscoveryUpdatedAt || "")}"/>
<input type="hidden" id="coverageAreas" data-field="coverageAreas" value='${esc(JSON.stringify(data.coverageAreas || data.rankingAreas || []))}'/>
<input type="hidden" id="rankingAreas" data-field="rankingAreas" value='${esc(JSON.stringify(data.rankingAreas || []))}'/>
<input type="hidden" id="nearbyAreas" data-field="nearbyAreas" value='${esc(JSON.stringify(data.nearbyAreas || []))}'/>
<input type="hidden" id="primaryCity" data-field="primaryCity" value="${esc(data.primaryCity || town)}"/>
</section>`;
}

export function renderHeaderSection(data: PharmacyProfileData): string {
  const navRows = (data.headerNavLinks || [])
    .map(
      (link, i) =>
        `<tr data-nav-row="${i}">
<td><input type="text" class="nav-label" value="${esc(link.label)}" data-nav-label="${i}"/></td>
<td><input type="text" class="nav-url" value="${esc(link.url)}" data-nav-url="${i}"/></td>
<td><input type="number" class="nav-order" value="${link.order}" min="1" data-nav-order="${i}"/></td>
<td><label class="check-row"><input type="checkbox" class="nav-visible" ${link.visible ? "checked" : ""} data-nav-visible="${i}"/> Show</label></td>
</tr>`,
    )
    .join("");

  return `<section class="panel" id="section-header">
<h2>3. Header Settings</h2>
<div class="grid-2">
${field("Header Logo URL", "headerLogoUrl", data.headerLogoUrl, "url", "Defaults to main logo if blank")}
${field("Header CTA Text", "headerCtaText", data.headerCtaText, "text", "Defaults to primary CTA")}
${field("Header CTA URL", "headerCtaUrl", data.headerCtaUrl, "url", "Defaults to booking URL or #contact")}
</div>
<h3 style="font-size:15px;margin-top:16px">Header Navigation</h3>
<table class="nav-editor"><thead><tr><th>Label</th><th>URL</th><th>Order</th><th>Visible</th></tr></thead><tbody id="headerNavBody">${navRows}</tbody></table>
<input type="hidden" id="headerNavLinks" data-field="headerNavLinks" value='${esc(JSON.stringify(data.headerNavLinks || []))}'/>
</section>`;
}

export function renderFooterSection(data: PharmacyProfileData): string {
  return `<section class="panel" id="section-footer">
<h2>4. Footer Settings</h2>
<div class="grid-2">
${field("Footer Logo URL", "footerLogoUrl", data.footerLogoUrl, "url", "Defaults to main logo")}
${field("Footer Text", "footerText", data.footerText)}
${field("Copyright", "footerCopyright", data.footerCopyright)}
${field("Company Number", "footerCompanyNumber", data.footerCompanyNumber || data.companyRegistrationNumber)}
${field("GPhC Link", "gphcPremisesUrl", data.gphcPremisesUrl, "url")}
${field("NHS Profile Link", "nhsProfileUrl", data.nhsProfileUrl, "url")}
${field("Privacy Policy URL", "footerPrivacyPolicyUrl", data.footerPrivacyPolicyUrl, "url")}
${field("Cookie Policy URL", "footerCookiePolicyUrl", data.footerCookiePolicyUrl, "url")}
${field("Terms URL", "footerTermsUrl", data.footerTermsUrl, "url")}
${field("Facebook", "socialFacebook", data.socialFacebook, "url")}
${field("Instagram", "socialInstagram", data.socialInstagram, "url")}
${field("LinkedIn", "socialLinkedIn", data.socialLinkedIn, "url")}
${field("X (Twitter)", "socialX", data.socialX, "url")}
${field("YouTube", "socialYouTube", data.socialYouTube, "url")}
</div>
<div class="field"><label for="footerLinks">Footer Links (one per line: Label | URL)</label><textarea id="footerLinks" data-field="footerLinks" rows="4">${esc(
    (data.footerLinks || []).map((l) => `${l.label} | ${l.url}`).join("\n"),
  )}</textarea></div>
</section>`;
}

export function renderProfessionalReviewSection(
  data: PharmacyProfileData,
  slug: string,
  authorityMissing: string[],
): string {
  const examples = REVIEWER_BIO_EXAMPLES.map(
    (ex) =>
      `<div class="example-card"><strong>${esc(ex.title)}</strong><p>${esc(ex.bio.slice(0, 120))}…</p>
<button type="button" class="btn-example" data-example-id="${esc(ex.id)}">Use example</button>
<button type="button" class="btn-example secondary" data-copy-id="${esc(ex.id)}">Copy</button></div>`,
  ).join("");

  return `<section class="panel" id="section-professional-review">
<h2>5. Professional Review</h2>
<p class="lead">Reviewer profile and clinical review dates — detected by Authority Audit and shown on service pages.</p>
<div class="grid-2">
${field("Reviewer Name", "reviewerName", data.reviewerName, "text", "Or use Superintendent Pharmacist below", "required")}
${field("Professional Role", "reviewerRole", data.reviewerRole, "text", "", "required")}
${field("Qualifications", "reviewerQualifications", data.reviewerQualifications, "text", "", "optional")}
${field("Professional Registrations", "reviewerProfessionalRegistrations", data.reviewerProfessionalRegistrations, "text", "", "optional")}
${field("Years Experience", "reviewerExperienceYears", data.reviewerExperienceYears, "text", "", "optional")}
${field("Reviewer Photo URL", "reviewerPhoto", data.reviewerPhoto, "url", "", "optional")}
${field("Clinical Review Date", "clinicalReviewDate", data.clinicalReviewDate, "date", "", "required")}
${field("Next Review Date", "nextReviewDate", data.nextReviewDate, "date", "", "required")}
</div>
<div class="field"><label for="reviewerBio">Biography</label><textarea id="reviewerBio" data-field="reviewerBio" rows="4">${esc(data.reviewerBio)}</textarea></div>
<div class="grid-2">
<div class="field"><label for="reviewerSpecialInterests">Special Interests (comma-separated)</label><textarea id="reviewerSpecialInterests" data-field="reviewerSpecialInterests">${esc((data.reviewerSpecialInterests || []).join(", "))}</textarea></div>
<div class="field"><label for="reviewerClinicalInterests">Clinical Interests (comma-separated)</label><textarea id="reviewerClinicalInterests" data-field="reviewerClinicalInterests">${esc((data.reviewerClinicalInterests || []).join(", "))}</textarea></div>
</div>
<div class="field"><label for="reviewerSpecialisms">Specialisms (comma-separated)</label><textarea id="reviewerSpecialisms" data-field="reviewerSpecialisms">${esc((data.reviewerSpecialisms || []).join(", "))}</textarea></div>
${comingSoonField("Reviewer Signature", "reviewerSignature")}
<h3 style="font-size:15px;margin-top:16px">Guided biography examples</h3>
<div class="example-grid">${examples}</div>
<div id="reviewCardPreviewHost" style="margin-top:16px"></div>
${
  authorityMissing.length
    ? `<ul class="missing">${authorityMissing.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`
    : `<p class="hint">Authority audit has no outstanding professional review signals.</p>`
}
<p><a href="/api/pharmacy-authority-readiness?slug=${esc(slug)}">Open Authority Audit</a></p>
</section>`;
}

export function renderTrustSection(data: PharmacyProfileData): string {
  return `<section class="panel" id="section-trust">
<h2>Trust &amp; Regulation</h2>
<div class="grid-2">
${field("Superintendent Pharmacist", "superintendentPharmacistName", data.superintendentPharmacistName, "text", "Counts as reviewer name if Reviewer Name is blank", "optional")}
${field("Consultation Room Available", "consultationRoomAvailable", data.consultationRoomAvailable ? "1" : "", "checkbox")}
${field("NHS Services Available", "nhsServicesAvailable", data.nhsServicesAvailable ? "1" : "", "checkbox")}
${field("Private Services Available", "privateServicesAvailable", data.privateServicesAvailable ? "1" : "", "checkbox")}
${field("Years Serving Community", "yearsServingCommunity", data.yearsServingCommunity)}
</div>
</section>`;
}

export function renderFutureSection(): string {
  return `<section class="panel" id="section-future">
<h2>Future Features</h2>
<p class="lead">Advanced capabilities not yet available.</p>
<div class="grid-2">
${comingSoonField("Reviewer Signature Capture", "futureReviewerSignature")}
${comingSoonField("Multi-site Brand Sync", "futureMultiSiteBrand")}
</div>
</section>`;
}

export function renderHourFields(data: PharmacyProfileData): string {
  return OPENING_HOUR_DAYS.map(({ key, label }) =>
    field(label, key, String(data[key as keyof PharmacyProfileData] ?? "")),
  ).join("");
}

export function profileDashboardExtraCss(): string {
  return `${brandImportPanelCss()}
.nav-editor{width:100%;font-size:13px;margin-top:8px}
.nav-editor th,.nav-editor td{padding:8px;border-bottom:1px solid #e2e8f0}
.nav-editor input{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px}
.field-disabled input{background:#f1f5f9;color:#94a3b8}
.example-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.example-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;font-size:12px}
.example-card p{color:#64748b;margin:8px 0}
.btn-example{border:0;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;background:#005eb8;color:#fff;margin-right:6px}
.btn-example.secondary{background:#e2e8f0;color:#334155}
.preview-section{margin-top:14px;padding-top:14px;border-top:1px dashed #e2e8f0}
.preview-section h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.typography-preview{margin-top:12px;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}
.typography-preview h1,.typography-preview h2,.typography-preview h3,.typography-preview p{margin:0 0 8px}
.preview-footer-block{margin-top:12px;padding:12px;background:#f8fafc;border-radius:10px;font-size:12px}
.area-summary{display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;padding:12px;background:#f8fafc;border-radius:10px;font-size:13px}
.area-checklist{list-style:none;margin:0;padding:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.area-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px}
.area-row:last-child{border-bottom:0}
.area-meta{color:#64748b;font-size:12px}
.area-actions{display:flex;gap:4px}
.btn-area-generate,.btn-area-add{border:0;border-radius:8px;padding:9px 14px;font-weight:800;cursor:pointer;background:#005eb8;color:#fff;font-size:13px}
.btn-area-move,.btn-area-remove{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px}
@media(max-width:900px){.example-grid{grid-template-columns:1fr}.area-row{grid-template-columns:1fr}}`;
}
