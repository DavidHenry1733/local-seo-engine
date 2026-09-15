/**
 * Customer Setup Import Split V1 — Step 2 review imported details page.
 * COMMERCIAL-PHARMACY-PROFILE-IMPORT-REVIEW-45: customer-facing presentation only.
 * Does not change import, matching, evidence, profile or conflict-resolution logic.
 */
import {
  buildCustomerSetupConfirmView,
  formatCustomerSetupSourceLabel,
  readCustomerSetupProfile,
  type ConfirmFieldWithSource,
} from "./growthEngineCustomerSetupConfirmService.ts";
import { customerSetupStartCss } from "./growthEngineCustomerSetupStartPage.ts";
import { renderRetiredSetupTestBanner } from "./growthEngineCustomerSetupTestTenants.ts";
import {
  commercialBlueChromeGradientCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";
import { resolveTenantBrandIdentity } from "./pharmacyTenantBrandIdentityContract.ts";
import { customerBrandReviewUrl } from "./growthEngineCustomerBrandReviewPage.ts";
import { tenantImageLibraryPanelCss } from "./pharmacyTenantImageLibraryPanel.ts";
import {
  buildTenantImageLibraryView,
  MAX_ACTIVE_TENANT_IMAGES,
  publicTenantImageUrl,
} from "./pharmacyTenantImageLibraryContract.ts";
import type { BusinessDetailConflict } from "./pharmacyBusinessDisplayResolver.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function customerSetupConfirmCss(): string {
  return `${customerSetupStartCss()}
.css-wrap-wide{max-width:880px;margin:0 auto;padding:28px 20px 28px}
.css-hero{background:${commercialBlueChromeGradientCss()};border-radius:16px;padding:20px 22px;color:#fff;margin-bottom:18px;box-shadow:0 10px 28px rgba(0,94,184,.16)}
.css-hero h1{margin:0 0 6px;font-size:24px;font-weight:900;letter-spacing:-.02em;line-height:1.25}
.css-hero p{margin:0;font-size:14px;color:#dbeafe;line-height:1.45;max-width:640px}
.css-hero-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}
.css-hero-metric{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:8px 10px}
.css-hero-metric strong{display:block;font-size:12px;font-weight:800;line-height:1.35;color:#fff}
.css-section{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 20px;margin-bottom:14px;box-shadow:0 8px 28px rgba(15,23,42,.05)}
.css-section-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
.css-section-head h2{margin:0;font-size:17px;font-weight:900;color:#0f172a}
.css-section-notice{margin:-4px 0 14px;padding:12px 14px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px;font-weight:600;line-height:1.5}
.css-section-notice.warn{background:#eff6ff;border-color:#bfdbfe;color:#1e40af}
.css-badge{font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:999px;letter-spacing:.04em}
.css-badge.imported{background:#dcfce7;color:#166534}
.css-badge.needs_review{background:#fef3c7;color:#92400e}
.css-badge.not_found{background:#f1f5f9;color:#64748b}
.css-dl{display:grid;grid-template-columns:140px 1fr;gap:8px 12px;font-size:14px;margin:0}
.css-dl dt{font-weight:700;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
.css-dl dd{margin:0;color:#0f172a;line-height:1.45;word-break:break-word}
.css-use-btn{margin-top:14px;padding:11px 16px;border:1.5px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font-size:13px;font-weight:800;cursor:pointer}
.css-use-btn:hover{border-color:#005eb8;color:#005eb8}
.css-candidate{border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px;background:#fafbfc;font-size:13px}
.css-candidate strong{display:block;font-size:14px;margin-bottom:6px}
.css-essentials h2{margin:0 0 6px;font-size:17px;font-weight:900}
.css-essentials p{margin:0 0 14px;font-size:13px;color:#64748b}
.css-field{margin-bottom:12px}
.css-field label{display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px}
.css-field input,.css-field select{width:100%;padding:11px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:15px;color:#0f172a;background:#fafbfc}
.css-field-source{font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-left:8px;padding:2px 8px;border-radius:999px;background:#f1f5f9}
.css-field-source.google{background:#ede9fe;color:#5b21b6}
.css-field-source.website{background:#dbeafe;color:#1d4ed8}
.css-field-source.manual{background:#ecfdf5;color:#166534}
.css-field-source.action_required{background:#fee2e2;color:#991b1b}
.css-brand-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.css-brand-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
.css-brand-label{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.css-logo-preview{min-height:72px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:10px;margin-bottom:10px}
.css-logo-preview img{max-width:160px;max-height:64px;object-fit:contain}
.css-logo-status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 10px;font-size:10px;font-weight:900;text-transform:uppercase;background:#fee2e2;color:#991b1b}
.css-logo-status.found{background:#dcfce7;color:#166534}
.css-colour-list{display:grid;gap:8px}
.css-colour-row{display:flex;align-items:center;gap:10px;font-size:13px;color:#0f172a}
.css-colour-swatch{width:28px;height:28px;border-radius:8px;border:1px solid #cbd5e1;display:inline-block}
.css-colour-meta{display:block;font-size:11px;color:#64748b;margin-top:2px}
.css-brand-compact{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}
.css-brand-swatches{display:flex;gap:6px}
.css-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;background:#005eb8;color:#fff;font-weight:800;font-size:13px;text-decoration:none;border:0;cursor:pointer}
.css-btn-secondary{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;background:#fff;color:#005eb8;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #005eb8}
.css-conflict{border:1px solid #fecaca;background:#fff7f7;border-radius:14px;padding:16px;margin-bottom:12px}
.css-conflict h3{margin:0 0 8px;font-size:15px;color:#991b1b}
.css-conflict-options{display:grid;gap:8px;margin:10px 0}
.css-conflict-option{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid #fecaca;border-radius:10px;background:#fff;font-size:13px}
.css-conflict-source{margin:0;font-size:12px;color:#64748b}
.css-conflict-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:13px}
.css-field-missing label{color:#991b1b}
.css-field-missing input{border-color:#dc2626!important;background:#fef2f2!important}
.css-final-actions{margin-bottom:0}
.css-final-actions-inner{display:flex;flex-direction:column;gap:12px}
.css-final-actions-msg{margin:0;padding:10px 12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;font-weight:600;line-height:1.45}
.css-final-actions-msg:not(.show){display:none}
.css-final-actions-buttons{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.css-final-actions-buttons .css-btn-secondary{flex:1 1 200px;min-height:48px}
.css-submit-primary{flex:1 1 260px;min-width:220px;min-height:48px;padding:15px 22px;border:none;border-radius:12px;background:${commercialBlueChromeGradientCss()};color:#fff;font-size:16px;font-weight:900;cursor:pointer}
.css-submit-primary:disabled{opacity:.55;cursor:not-allowed}
.css-reset-btn{padding:12px 16px;border:1.5px solid #fecaca;border-radius:12px;background:#fff;color:#991b1b;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none}
.css-brand-review .css-brand-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;align-items:center}
.css-brand-review .css-brand-confirm{padding:11px 16px;border:none;border-radius:10px;background:${commercialBlueChromeGradientCss()};color:#fff;font-size:13px;font-weight:800;cursor:pointer}
.css-brand-review .css-logo-upload{margin-top:10px;font-size:13px;color:#334155}
.css-brand-review .css-logo-upload input[type=file]{display:block;margin-top:6px}
.css-font-preview{background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:14px;margin-top:8px}
.css-font-preview h3{margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a}
.css-font-preview p{margin:0;font-size:15px;color:#334155;line-height:1.5}
.css-brand-edit{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.css-colour-row input[type=color]{width:36px;height:30px;border:1px solid #cbd5e1;border-radius:8px;padding:0;background:#fff}
.css-conf{font-size:11px;color:#64748b;font-weight:700}
.css-image-actions button{padding:6px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:11px;font-weight:800;cursor:pointer}
.css-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.css-thumbs img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;background:#fff}
.css-service-list{margin:0;padding-left:18px;font-size:14px;color:#0f172a;columns:2;gap:24px}
.css-import-details{margin-top:8px}
.css-import-details summary{cursor:pointer;font-weight:800;color:#005eb8;font-size:14px}
.css-import-summary{margin:12px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}
.css-import-summary div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px}
.css-muted{margin:8px 0 0;font-size:13px;color:#64748b}
${tenantImageLibraryPanelCss()}
@media(max-width:960px){.css-hero-metrics{grid-template-columns:1fr 1fr}.css-brand-compact,.css-service-list{grid-template-columns:1fr;columns:1}}
.css-brand-review-details>summary{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:720px){.css-hero{padding:16px}.css-hero h1{font-size:22px}.css-hero-metrics,.css-brand-grid,.css-brand-edit,.css-import-summary,.css-dl{grid-template-columns:1fr}.css-brand-compact{grid-template-columns:1fr}.css-final-actions-buttons{flex-direction:column;align-items:stretch}.css-final-actions-buttons .css-btn-secondary,.css-submit-primary{width:100%;flex:1 1 auto}}
`;
}

function renderCandidateSelector(candidates: import("./pharmacyProfileSchema.ts").CustomerSetupGoogleCandidate[]): string {
  if (!candidates.length) return "";
  return `<div style="margin-top:12px">${candidates
    .map(
      (c) => `<div class="css-candidate">
<strong>${esc(c.businessName)}</strong>
${esc(c.address)} · ${esc(c.postcode || "—")} · ${c.rating != null ? esc(String(c.rating)) + " / 5" : "No rating"}
<button type="button" class="css-use-btn" data-select-google="${esc(c.placeId)}" style="margin-top:8px">This is my pharmacy</button>
</div>`,
    )
    .join("")}</div>`;
}

function renderPlainField(id: string, label: string, field: ConfirmFieldWithSource): string {
  const value = field.value;
  const source = field.source;
  const resolvedSource = source || (value ? "manual" : "action_required");
  const sourceClass = `css-field-source ${esc(resolvedSource)}`;
  const sourceLabel =
    resolvedSource === "action_required"
      ? "Action Required"
      : formatCustomerSetupSourceLabel(resolvedSource as import("./pharmacyProfileSchema.ts").CustomerSetupFieldSource | "");
  return `<div class="css-field" data-field="${esc(id)}">
<label for="${esc(id)}">${esc(label)}<span class="${sourceClass}" id="${esc(id)}Source">${esc(sourceLabel)}</span></label>
<input type="text" id="${esc(id)}" name="${esc(id)}" value="${esc(value)}" autocomplete="off"/>
</div>`;
}

function plainEvidenceSource(conflict: BusinessDetailConflict): string {
  const src = String(conflict.source || "").toLowerCase();
  if (src.includes("google") && !src.includes("http")) return "Google Business Profile";
  if (conflict.field === "gphcNumber" || src.includes("http") || src.includes("website")) return "Pharmacy website";
  if (src.includes("google")) return "Google Business Profile";
  return "Imported pharmacy record";
}

function renderBusinessDetailConflictsPanel(
  view: ReturnType<typeof buildCustomerSetupConfirmView>,
  addressField: ConfirmFieldWithSource,
  townField: ConfirmFieldWithSource,
  postcodeField: ConfirmFieldWithSource,
): string {
  if (!view.businessDetailConflicts.length && !view.googleSelectorVisible) return "";
  const rows = view.businessDetailConflicts
    .map((conflict) => {
      const fieldId = conflict.field.replace(/[^a-z0-9]+/gi, "-");
      const extra =
        conflict.field === "displayAddress"
          ? `<div class="css-field css-manual-field" data-manual-for="${esc(fieldId)}" hidden style="margin-top:12px">
${renderPlainField("address", "Address", addressField)}
${renderPlainField("town", "Town", townField)}
${renderPlainField("postcode", "Postcode", postcodeField)}
<label for="displayAddress">Edited address</label>
<input id="displayAddress" name="displayAddress" type="text" form="confirmForm" value="${esc(conflict.importedValue)}"/>
</div>`
          : conflict.field === "gphcNumber"
            ? `<div class="css-field css-manual-field" data-manual-for="${esc(fieldId)}" hidden style="margin-top:12px">
${renderPlainField("gphcNumber", "GPhC registration number", view.fields.gphcNumber)}
</div>
<input type="hidden" name="gphcConfirmation" id="gphcConfirmation" form="confirmForm" value=""/>`
            : "";
      return `<div class="css-conflict" data-conflict-field="${esc(conflict.field)}" data-conflict-label="${esc(conflict.label)}">
<h3>${esc(conflict.label)}</h3>
<p class="css-conflict-source">Imported from your ${esc(plainEvidenceSource(conflict).toLowerCase())}.</p>
<div class="css-conflict-options">
<div class="css-conflict-option"><strong>Current details</strong><span>${esc(conflict.canonicalValue || "Not stored yet")}</span></div>
<div class="css-conflict-option"><strong>Imported value</strong><span>${esc(conflict.importedValue)}</span></div>
</div>
<div class="css-conflict-actions">
<label><input type="radio" name="resolution-${esc(fieldId)}" value="keep-canonical" form="confirmForm"/> Keep current details</label>
<label><input type="radio" name="resolution-${esc(fieldId)}" value="use-imported" form="confirmForm"/> Use imported value</label>
<label><input type="radio" name="resolution-${esc(fieldId)}" value="edit-manually" form="confirmForm"/> Enter a different value</label>
</div>
${extra}
</div>`;
    })
    .join("");
  const googleChoice = view.googleSelectorVisible
    ? `<div class="css-conflict"><h3>Google listing</h3><p class="css-conflict-source">Select the correct Google Business Profile.</p>${renderCandidateSelector(view.googleCandidates)}</div>`
    : "";
  const confirmLabels = [
    ...view.businessDetailConflicts.map((c) => c.label),
    ...(view.googleSelectorVisible ? ["Google listing"] : []),
  ].filter(Boolean);
  const notice = confirmLabels.length
    ? `<p class="css-section-notice" id="conflictGateNotice">Please confirm: ${esc(confirmLabels.join(", "))}.</p>`
    : "";
  return `<section class="css-section" id="items-requiring-confirmation" aria-labelledby="conflicts-heading">
<div class="css-section-head">
<h2 id="conflicts-heading">Items requiring confirmation</h2>
<span class="css-badge needs_review">Action needed</span>
</div>
${notice}
<p class="css-muted">Choose one option for each item. Nothing is selected until you confirm it.</p>
${rows}
${googleChoice}
</section>`;
}

function renderBrandCompact(view: ReturnType<typeof buildCustomerSetupConfirmView>): string {
  const brand = resolveTenantBrandIdentity(view.slug);
  const logo = brand.logoUrl.value
    ? `<img src="${esc(brand.logoUrl.value)}" alt="Pharmacy logo" style="max-height:48px;max-width:120px;object-fit:contain"/>`
    : `<span class="css-muted">No logo yet</span>`;
  const status = brand.confirmationStatus === "confirmed" ? "Confirmed" : "Needs confirmation";
  const swatches = [brand.primaryColor.value, brand.secondaryColor.value, brand.accentColor.value]
    .map((hex) => `<span class="css-colour-swatch" style="background:${esc(hex)}" title="${esc(hex)}"></span>`)
    .join("");
  return `<section class="css-section" aria-labelledby="brand-review-heading" data-brand-review="v1">
<div class="css-section-head">
<h2 id="brand-review-heading">Brand Review</h2>
<span class="css-badge ${brand.confirmationStatus === "confirmed" ? "imported" : "needs_review"}">${esc(status)}</span>
</div>
<div class="css-brand-compact">
<div class="css-logo-preview" style="min-height:56px;margin:0">${logo}</div>
<div>
<div class="css-brand-swatches">${swatches}</div>
<p class="css-muted">Heading ${esc(brand.headingFont.value)} · Body ${esc(brand.bodyFont.value)}</p>
</div>
<a class="css-btn" id="openBrandReviewBtn" href="${esc(customerBrandReviewUrl(view.slug))}">Review brand</a>
</div>
</section>`;
}

function renderImageCompact(slug: string): string {
  const images = buildTenantImageLibraryView(slug);
  const thumbs = images.selectable
    .slice(0, 6)
    .map((img) => {
      const src = publicTenantImageUrl(img);
      return src ? `<img src="${esc(src)}" alt=""/>` : "";
    })
    .join("");
  return `<section class="css-section css-image-library" aria-labelledby="image-library-heading" data-image-library="v1">
<div class="css-section-head">
<h2 id="image-library-heading">Image Library</h2>
<span class="css-badge imported">${esc(String(images.activeCount))} of ${esc(String(MAX_ACTIVE_TENANT_IMAGES))} active</span>
</div>
<p class="css-muted" style="margin-top:0">Placement is automatic. You do not assign hero, support, trust, conversion or locality slots.</p>
<div class="css-thumbs">${thumbs}</div>
<p class="css-image-count">${esc(String(images.activeCount))} of ${esc(String(MAX_ACTIVE_TENANT_IMAGES))} active images</p>
<p style="margin:12px 0 0"><a class="css-btn" href="/api/pharmacy-image-library?slug=${esc(slug)}">Open Image Library</a></p>
</section>`;
}

export function renderCustomerSetupConfirmPage(slug: string): string {
  const view = buildCustomerSetupConfirmView(slug);
  const profile = readCustomerSetupProfile(slug);
  const f = view.fields;
  const brand = resolveTenantBrandIdentity(slug);
  const images = buildTenantImageLibraryView(slug);
  const setupConfirmUrl = `/api/growth-engine/${encodeURIComponent(slug)}/setup-confirm`;
  const googleSelectUrl = `/api/growth-engine/${encodeURIComponent(slug)}/setup-google-select`;
  const dashboardUrl = `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`;
  const conflictFields = new Set(view.businessDetailConflicts.map((c) => c.field));
  const services = (profile.websiteImportSnapshot?.customerVisibleServices || [])
    .map((s) => s.serviceName)
    .filter(Boolean);
  const serviceNames =
    services.length > 0
      ? services
      : (profile.websiteImportSnapshot?.servicesDetected || []).slice(0, 16);
  const openingHours = String(profile.openingHours || "").trim();
  const openingStatus = openingHours ? "Imported" : "Not listed";
  const cta = String(profile.preferredCta || profile.headerCtaText || "").trim() || "Call the pharmacy";
  const gphcConfirmed = Boolean(String(profile.gphcNumber || "").trim()) && !conflictFields.has("gphcNumber");
  const emailValue = String(f.email.value || "").trim();
  const unresolvedConfirmLabels = [
    ...view.businessDetailConflicts.map((c) => c.label),
    ...(view.googleSelectorVisible ? ["Google listing"] : []),
  ].filter(Boolean);
  const unresolvedConfirmMessage = unresolvedConfirmLabels.length
    ? `Please confirm: ${unresolvedConfirmLabels.join(", ")}.`
    : "";

  const nationalBanner = view.nationalWebsiteWarning
    ? `<div class="css-section-notice warn">This appears to be a national or multi-location website. Please confirm the local branch Google listing.</div>`
    : "";

  const identityImported =
    view.googleSection.status === "imported" || view.websiteSection.status === "imported" || Boolean(f.pharmacyName.value);
  const websiteReviewed = view.websiteSection.status === "imported" || view.websiteBrandSummary.visible;
  const brandStatus = brand.confirmationStatus === "confirmed" ? "Brand confirmed" : "Brand Review needs confirmation";

  const confirmedRows: Array<[string, string]> = [
    ["Pharmacy name", f.pharmacyName.value || "—"],
    ...(!conflictFields.has("displayAddress")
      ? ([["Address", [f.address.value, f.town.value, f.postcode.value].filter(Boolean).join(", ") || "—"]] as Array<[string, string]>)
      : []),
    ["Telephone", f.phone.value || "—"],
    ["Website", f.website.value || "—"],
    ...(emailValue ? ([["Email", emailValue]] as Array<[string, string]>) : []),
    ...(gphcConfirmed ? ([["GPhC registration number", profile.gphcNumber]] as Array<[string, string]>) : []),
    ["Opening hours", openingStatus],
    ["Primary contact", cta],
  ];

  const hiddenSettledFields = [
    conflictFields.has("displayAddress") ? "" : renderPlainField("address", "Address", f.address) + renderPlainField("town", "Town", f.town) + renderPlainField("postcode", "Postcode", f.postcode),
    !view.gphcCandidate || conflictFields.has("gphcNumber") ? "" : renderPlainField("gphcNumber", "GPhC registration number", f.gphcNumber),
  ].join("");

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Review your pharmacy details · PharmaConnect</title>
<style>${customerSetupConfirmCss()}</style>
</head>
<body data-page="customer-setup-confirm" data-commercial-import-review="45" data-slug="${esc(slug)}">
<div class="css-wrap-wide">
${renderRetiredSetupTestBanner(slug)}
<section class="css-hero" aria-label="Review your pharmacy details">
<h1>Review your pharmacy details</h1>
<p>We imported information from your website and business profile. Confirm the details below before continuing.</p>
<div class="css-hero-metrics">
<div class="css-hero-metric"><strong>${identityImported ? "Pharmacy identity imported" : "Pharmacy identity needed"}</strong></div>
<div class="css-hero-metric"><strong>${websiteReviewed ? "Website reviewed" : "Website not reviewed"}</strong></div>
<div class="css-hero-metric"><strong>${serviceNames.length ? `${serviceNames.length} services detected` : "Services detected"}</strong></div>
<div class="css-hero-metric"><strong>${esc(brandStatus)}</strong></div>
<div class="css-hero-metric"><strong>Image Library: ${esc(String(images.activeCount))} of ${esc(String(MAX_ACTIVE_TENANT_IMAGES))} active</strong></div>
</div>
</section>
${nationalBanner}

<section class="css-section css-essentials" aria-labelledby="essentials-heading">
<div class="css-section-head"><h2 id="essentials-heading">Confirmed pharmacy details</h2></div>
<dl class="css-dl">${confirmedRows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
<form id="confirmForm" data-setup-confirm-url="${esc(setupConfirmUrl)}" novalidate>
<details class="css-import-details" style="margin-top:12px">
<summary>Edit these details</summary>
${renderPlainField("pharmacyName", "Pharmacy name", f.pharmacyName)}
${renderPlainField("website", "Website", f.website)}
${renderPlainField("phone", "Phone", f.phone)}
${renderPlainField("email", "Email", f.email)}
${hiddenSettledFields}
</details>
</form>
</section>

${renderBusinessDetailConflictsPanel(view, f.address, f.town, f.postcode)}

<section class="css-section" aria-labelledby="services-heading">
<div class="css-section-head"><h2 id="services-heading">Services found</h2></div>
${serviceNames.length
    ? `<ul class="css-service-list">${serviceNames.map((name) => `<li>${esc(name)}</li>`).join("")}</ul>`
    : `<p class="css-muted">No services were detected on the imported website.</p>`}
</section>

${renderBrandCompact(view)}
${renderImageCompact(slug)}

<section class="css-section" aria-labelledby="import-details-heading">
<details class="css-import-details">
<summary>View import details</summary>
<h2 id="import-details-heading" class="visually-hidden" style="position:absolute;left:-9999px">Import evidence</h2>
<div class="css-import-summary">
<div><strong>Google Business Profile</strong><p class="css-muted" style="margin:4px 0 0">${esc(view.googleSection.statusLabel)}</p></div>
<div><strong>Pharmacy website</strong><p class="css-muted" style="margin:4px 0 0">${esc(view.websiteSection.statusLabel)}</p></div>
<div><strong>Website inventory</strong><p class="css-muted" style="margin:4px 0 0">${view.websiteBrandSummary.totalPages ? `${esc(String(view.websiteBrandSummary.totalPages))} pages reviewed` : "Not tested"}</p></div>
<div><strong>Local intelligence</strong><p class="css-muted" style="margin:4px 0 0">${view.googleSection.status === "imported" ? "Google listing imported" : view.googleSection.statusLabel}</p></div>
</div>
</details>
</section>
<section class="css-section css-final-actions" role="region" aria-label="Confirm actions">
<div class="css-final-actions-inner">
<div id="formError" class="css-final-actions-msg${unresolvedConfirmMessage ? " show" : ""}" role="alert">${unresolvedConfirmMessage ? esc(unresolvedConfirmMessage) : "Please complete the highlighted details before continuing."}</div>
<div class="css-final-actions-buttons">
<a class="css-btn-secondary" href="${esc(dashboardUrl)}">Return to dashboard</a>
<button type="submit" form="confirmForm" class="css-submit-primary" id="confirmBtn"${view.businessDetailConflicts.length ? " disabled" : ""}>Confirm and continue</button>
</div>
</div>
</section>
</div>
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var SETUP_CONFIRM_URL = ${JSON.stringify(setupConfirmUrl)};
  var RESET_IMPORTS_URL = '/api/growth-engine/'+encodeURIComponent(SLUG)+'/setup-reset-imports';
  var GOOGLE_SELECT_URL = ${JSON.stringify(googleSelectUrl)};
  var GOOGLE_DRAFT = ${JSON.stringify(view.googleDraft)};
  var WEBSITE_DRAFT = ${JSON.stringify(view.websiteDraft)};
  var SOURCE_LABELS = { google: 'Google Import', website: 'Website Import', manual: 'Manual', action_required: 'Action Required' };
  var fieldSources = ${JSON.stringify({
    pharmacyName: f.pharmacyName.source,
    website: f.website.source,
    phone: f.phone.source,
    email: f.email.source,
    address: f.address.source,
    town: f.town.source,
    postcode: f.postcode.source,
  })};

  var form = document.getElementById('confirmForm');
  var errEl = document.getElementById('formError');
  var btn = document.getElementById('confirmBtn');
  var REQUIRED = ['pharmacyName', 'website'];

  function setSource(id, source){
    fieldSources[id] = source;
    var el = document.getElementById(id + 'Source');
    if (!el) return;
    var resolved = source || 'action_required';
    el.textContent = SOURCE_LABELS[resolved] || 'Manual';
    el.className = 'css-field-source ' + resolved;
  }

  function applyDraft(draft){
    Object.keys(draft.sources || {}).forEach(function(key){
      if (draft[key] && document.getElementById(key)) {
        document.getElementById(key).value = draft[key];
        setSource(key, draft.sources[key]);
      }
    });
    ['pharmacyName','website','phone','email','address','town','postcode'].forEach(function(key){
      if (draft[key] && document.getElementById(key) && !draft.sources[key]) {
        document.getElementById(key).value = draft[key];
      }
    });
  }

  var useGoogleBtn = document.getElementById('useGoogleBtn');
  if (useGoogleBtn) useGoogleBtn.addEventListener('click', function(){ applyDraft(GOOGLE_DRAFT); });
  var useWebsiteBtn = document.getElementById('useWebsiteBtn');
  if (useWebsiteBtn) useWebsiteBtn.addEventListener('click', function(){ applyDraft(WEBSITE_DRAFT); });

  var resetBtn = document.getElementById('resetImportsBtn');
  if (resetBtn) resetBtn.addEventListener('click', async function(){
    if (!window.confirm('Clear all imported Google and website data? Admin-entered details will be kept.')) return;
    resetBtn.disabled = true;
    try {
      var res = await fetch(RESET_IMPORTS_URL, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({})
      });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || json.message || 'Reset failed.');
      window.location.reload();
    } catch(e) {
      alert(e.message || String(e));
      resetBtn.disabled = false;
    }
  });

  document.querySelectorAll('[data-select-google]').forEach(function(el){
    el.addEventListener('click', async function(){
      try {
        var res = await fetch(GOOGLE_SELECT_URL, {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ action: 'confirm', placeId: el.getAttribute('data-select-google') })
        });
        var json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Could not select listing.');
        window.location.reload();
      } catch(e) { alert(e.message || String(e)); }
    });
  });

  function unresolvedConflicts(){
    var labels = [];
    document.querySelectorAll('[data-conflict-field]').forEach(function(el){
      if (!el.querySelector('input[type="radio"]:checked')) {
        labels.push(el.getAttribute('data-conflict-label') || 'imported detail');
      }
    });
    return labels;
  }

  function syncManualFields(){
    document.querySelectorAll('[data-conflict-field]').forEach(function(el){
      var fieldId = (el.getAttribute('data-conflict-field') || '').replace(/[^a-z0-9]+/gi, '-');
      var selected = el.querySelector('input[type="radio"]:checked');
      var manual = el.querySelector('[data-manual-for="'+fieldId+'"]');
      if (manual) manual.hidden = !(selected && selected.value === 'edit-manually');
      if ((el.getAttribute('data-conflict-field') === 'gphcNumber') && selected) {
        var hidden = document.getElementById('gphcConfirmation');
        if (hidden) {
          if (selected.value === 'use-imported') hidden.value = 'confirm';
          else if (selected.value === 'keep-canonical') hidden.value = 'reject';
          else hidden.value = '';
        }
      }
    });
  }

  function updateConflictGate(){
    syncManualFields();
    var labels = unresolvedConflicts();
    if (!btn || !errEl) return;
    if (labels.length) {
      btn.disabled = true;
      errEl.textContent = 'Please confirm: ' + labels.join(', ') + '.';
      errEl.classList.add('show');
    } else {
      btn.disabled = false;
      if (errEl.textContent.indexOf('Please confirm:') === 0) errEl.classList.remove('show');
    }
  }

  document.querySelectorAll('[data-conflict-field] input[type="radio"]').forEach(function(input){
    input.addEventListener('change', updateConflictGate);
  });
  updateConflictGate();

  form.querySelectorAll('input').forEach(function(input){
    input.addEventListener('input', function(){
      if (input.id) setSource(input.id, 'manual');
    });
  });

  form.addEventListener('submit', async function(ev){
    ev.preventDefault();
    errEl.classList.remove('show');
    var labels = unresolvedConflicts();
    if (labels.length) {
      errEl.textContent = 'Please confirm: ' + labels.join(', ') + '.';
      errEl.classList.add('show');
      var target = document.getElementById('items-requiring-confirmation');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    btn.disabled = true;
    var payload = {
      pharmacyName: (document.getElementById('pharmacyName') || {}).value.trim(),
      website: (document.getElementById('website') || {}).value.trim(),
      phone: (document.getElementById('phone') || {}).value.trim(),
      email: (document.getElementById('email') || {}).value.trim(),
      address: document.getElementById('address') ? document.getElementById('address').value.trim() : '',
      town: document.getElementById('town') ? document.getElementById('town').value.trim() : '',
      postcode: document.getElementById('postcode') ? document.getElementById('postcode').value.trim() : '',
      gphcNumber: document.getElementById('gphcNumber') ? document.getElementById('gphcNumber').value.trim() : '',
      gphcConfirmation: (document.getElementById('gphcConfirmation') || {}).value || (document.querySelector('input[name="gphcConfirmation"]:checked') || {}).value || '',
      displayAddress: document.getElementById('displayAddress') ? document.getElementById('displayAddress').value.trim() : '',
      displayAddressResolution: (document.querySelector('input[name="resolution-displayAddress"]:checked') || {}).value || '',
      fieldResolutions: {},
      fieldSources: fieldSources,
      confirmBrand: false
    };
    document.querySelectorAll('[data-conflict-field]').forEach(function(el){
      var field = el.getAttribute('data-conflict-field');
      var selected = el.querySelector('input[type="radio"]:checked');
      if (field && selected) payload.fieldResolutions[field] = selected.value;
    });
    if (!payload.displayAddressResolution && payload.fieldResolutions.displayAddress) {
      payload.displayAddressResolution = payload.fieldResolutions.displayAddress;
    }
    if (payload.fieldResolutions.gphcNumber === 'use-imported') payload.gphcConfirmation = 'confirm';
    if (payload.fieldResolutions.gphcNumber === 'keep-canonical') payload.gphcConfirmation = 'reject';
    if (payload.fieldResolutions.gphcNumber === 'edit-manually') payload.gphcConfirmation = '';
    var missing = REQUIRED.filter(function(id){ return !payload[id]; });
    if (missing.length) {
      missing.forEach(function(id){
        var input = document.getElementById(id);
        if (input && input.closest('.css-field')) input.closest('.css-field').classList.add('css-field-missing');
      });
      errEl.textContent = 'Please complete the highlighted details before continuing.';
      errEl.classList.add('show');
      btn.disabled = false;
      return;
    }
    try {
      var res = await fetch(SETUP_CONFIRM_URL, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not save.');
      window.location.href = json.redirectUrl;
    } catch(e) {
      errEl.textContent = e.message || String(e);
      errEl.classList.add('show');
      btn.disabled = false;
    }
  });
})();
</script>
</body></html>`);
}

export function renderCustomerSetupConfirmPlaceholderPage(slug: string): string {
  return renderCustomerSetupConfirmPage(slug);
}
