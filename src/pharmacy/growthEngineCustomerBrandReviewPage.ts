/**
 * COMMERCIAL-BRAND-REVIEW-PRESENTATION-46
 *
 * Customer-facing Brand Review presentation for the existing tenant-brand
 * confirmation workflow. Does not create a second branding system and does
 * not write brand values on render.
 */
import { readCustomerSetupProfile } from "./growthEngineCustomerSetupConfirmService.ts";
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";
import {
  buildTenantBrandOverlayCss,
  resolveTenantBrandIdentity,
  type TenantBrandField,
  type TenantBrandFieldSource,
  type TenantBrandIdentityResolved,
} from "./pharmacyTenantBrandIdentityContract.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function customerBrandReviewUrl(slug: string): string {
  return `/api/growth-engine/brand-review?slug=${encodeURIComponent(slug)}`;
}

function displayPharmacyName(rawName: string, slug: string): string {
  const stripped = String(rawName || "").replace(/^Welcome to\s+/i, "").trim();
  if (slug === "yorkshire-pharmacy-and-health-clinic" || /^Yorkshire Pharmacy and Health Clinic$/i.test(stripped)) {
    return "Yorkshire Pharmacy & Health Clinic";
  }
  return stripped || "your pharmacy";
}

function sourceLabel(source: TenantBrandFieldSource, kind: "logo" | "colour" | "font"): string {
  if (source === "po-confirmed") return "Confirmed by you";
  if (source === "uploaded-tenant-asset") return "Uploaded logo";
  if (source === "brand-dna") return kind === "logo" ? "Imported from your website" : "Imported from your website";
  if (kind === "logo") return "No logo imported yet";
  return "PharmaConnect default";
}

function simpleConfidence(field: TenantBrandField): string {
  const n = Number(field.confidence);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 80) return "High confidence";
  if (n >= 50) return "Good confidence";
  return "";
}

function fallbackFromStack(stack: string, name: string): string {
  const stripped = String(stack || "")
    .replace(new RegExp(`^['"]?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]?\\s*,\\s*`, "i"), "")
    .trim();
  return stripped || "system-ui, sans-serif";
}

function colourField(
  label: string,
  id: string,
  field: TenantBrandField,
): string {
  const conf = simpleConfidence(field);
  return `<article class="cbr-colour" data-colour-id="${esc(id)}">
<div class="cbr-swatch" id="${esc(id)}Swatch" style="background:${esc(field.value)}" aria-hidden="true"></div>
<div class="cbr-colour-copy">
<h3>${esc(label)}</h3>
<p class="cbr-meta">${esc(sourceLabel(field.source, "colour"))}${conf ? ` · ${esc(conf)}` : ""}</p>
<p class="cbr-hex" id="${esc(id)}Value">${esc(field.value)}</p>
</div>
<div class="cbr-colour-edit">
<label class="cbr-sr" for="${esc(id)}">Edit ${esc(label)}</label>
<input type="color" id="${esc(id)}" name="${esc(id)}" value="${esc(field.value)}" aria-label="${esc(label)}"/>
<input type="text" id="${esc(id)}Text" value="${esc(field.value)}" spellcheck="false" autocomplete="off" aria-label="${esc(label)} value"/>
</div>
</article>`;
}

function scopedOverlayCss(brand: TenantBrandIdentityResolved): string {
  return buildTenantBrandOverlayCss(brand)
    .replace(/\/\*[\s\S]*?\*\//, "")
    .replace(/:root\{/, ".cbr-preview{");
}

function renderPreview(slug: string, brand: TenantBrandIdentityResolved): string {
  const profile = readCustomerSetupProfile(slug);
  const name = displayPharmacyName(String(profile.pharmacyName || ""), slug);
  const cta = String(profile.preferredCta || profile.headerCtaText || "").trim() || "Call the pharmacy";
  const logo = brand.logoUrl.value
    ? `<img src="${esc(brand.logoUrl.value)}" alt="" data-tenant-brand-logo="overlay"/>`
    : `<strong class="cbr-preview-name">${esc(name)}</strong>`;
  return `<div class="cbr-preview" data-tenant-brand-preview="v1">
<style>${scopedOverlayCss(brand)}
.cbr-preview{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
.cbr-preview-bar{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:3px solid var(--brand-primary,#005eb8);background:#fff}
.cbr-preview-bar img{max-height:40px;max-width:140px;object-fit:contain}
.cbr-preview-name{font-family:var(--brand-font-heading),sans-serif;font-size:14px;font-weight:800;color:var(--brand-secondary,#003087)}
.cbr-preview-body{padding:16px 16px 18px}
.cbr-preview-body h3{margin:0 0 8px;font-family:var(--brand-font-heading),sans-serif;font-size:22px;line-height:1.25;color:var(--brand-secondary,#003087)}
.cbr-preview-body p{margin:0 0 14px;font-family:var(--brand-font-body),sans-serif;font-size:14px;line-height:1.5;color:#334155}
.cbr-preview-cta{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:9px;background:var(--brand-cta,var(--brand-primary,#005eb8));color:#fff;font-weight:800;font-size:13px;text-decoration:none}
</style>
<div class="cbr-preview-bar"><a class="brand" href="#">${logo}</a></div>
<div class="cbr-preview-body">
<h3>Flu vaccinations</h3>
<p>Book your flu vaccination at ${esc(name)}.</p>
<a class="cbr-preview-cta" href="#">${esc(cta)}</a>
</div>
</div>`;
}

export function renderCustomerBrandReviewPage(slug: string): string {
  const brand = resolveTenantBrandIdentity(slug);
  const confirmed = brand.confirmationStatus === "confirmed";
  const status = confirmed ? "Confirmed" : "Needs confirmation";
  const pharmacyUrl = `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(slug)}`;
  const dashboardUrl = `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`;
  const logoPreview = brand.logoUrl.value
    ? `<img id="brandLogoPreviewImg" src="${esc(brand.logoUrl.value)}" alt="Pharmacy logo"/>`
    : `<span id="brandLogoPreviewEmpty">No logo imported yet</span>`;
  const logoConf = simpleConfidence(brand.logoUrl);
  const headingFallback = fallbackFromStack(brand.headingFontStack, brand.headingFont.value);
  const bodyFallback = fallbackFromStack(brand.bodyFontStack, brand.bodyFont.value);
  const fontLink = brand.googleFontsHref
    ? `<link rel="stylesheet" href="${esc(brand.googleFontsHref)}"/>`
    : "";
  const fontOptions = ["Poppins", "Inter"];
  const headingOptions = fontOptions
    .map((name) => `<option value="${esc(name)}"${brand.headingFont.value === name ? " selected" : ""}>${esc(name)}</option>`)
    .join("");
  const bodyOptions = fontOptions
    .map((name) => `<option value="${esc(name)}"${brand.bodyFont.value === name ? " selected" : ""}>${esc(name)}</option>`)
    .join("");

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Review your brand · PharmaConnect</title>
${fontLink}
<style>
*{box-sizing:border-box}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:linear-gradient(180deg,#f0f7ff 0%,#f8fafc 55%);color:#0f172a;line-height:1.5;min-height:100vh}
${commercialBlueUiBaselineCss()}
.cbr-wrap{max-width:800px;margin:0 auto;padding:24px 20px 28px}
.cbr-hero{background:${commercialBlueChromeGradientCss()};border-radius:16px;padding:20px 22px;color:#fff;margin-bottom:16px;box-shadow:0 10px 28px rgba(0,94,184,.16)}
.cbr-hero h1{margin:0 0 6px;font-size:24px;font-weight:900;letter-spacing:-.02em;line-height:1.25}
.cbr-hero p{margin:0;font-size:14px;color:#dbeafe;line-height:1.45;max-width:640px}
.cbr-hero-status{display:inline-flex;margin-top:12px;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);font-size:12px;font-weight:800}
.cbr-section{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin-bottom:12px;box-shadow:0 8px 28px rgba(15,23,42,.05)}
.cbr-section h2{margin:0 0 12px;font-size:16px;font-weight:900;color:#0f172a}
.cbr-logo{display:grid;grid-template-columns:160px 1fr;gap:16px;align-items:center}
.cbr-logo-preview{min-height:88px;display:flex;align-items:center;justify-content:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:12px}
.cbr-logo-preview img{max-width:140px;max-height:64px;object-fit:contain}
.cbr-meta{margin:0 0 6px;font-size:13px;color:#64748b}
.cbr-hex{margin:0;font-size:13px;font-weight:800;color:#0f172a}
.cbr-file{margin-top:10px;display:block;position:relative}
.cbr-file-btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 14px;border-radius:10px;border:1px solid #005eb8;background:#fff;color:#005eb8;font-weight:800;font-size:14px;cursor:pointer}
.cbr-file input[type=file]{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.cbr-file-name{display:none;margin:8px 0 0;font-size:13px;font-weight:700;color:#334155}
.cbr-file-name.show{display:block}
.cbr-colours{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cbr-colour{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#f8fafc}
.cbr-swatch{height:44px;border-radius:10px;border:1px solid #cbd5e1;margin-bottom:10px}
.cbr-colour h3{margin:0 0 4px;font-size:13px;font-weight:800}
.cbr-colour-edit{display:flex;gap:8px;align-items:center;margin-top:8px}
.cbr-colour-edit input[type=color]{width:36px;height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0;background:#fff}
.cbr-colour-edit input[type=text]{flex:1;min-width:0;padding:7px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:700}
.cbr-fonts{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cbr-font-card select{width:100%;margin-top:6px;padding:9px 10px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px}
.cbr-font-sample-h{margin:10px 0 0;font-size:22px;font-weight:800;line-height:1.25}
.cbr-font-sample-b{margin:8px 0 0;font-size:15px;line-height:1.5;color:#334155}
.cbr-note{margin:0;font-size:14px;color:#334155;line-height:1.55}
.cbr-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.cbr-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 18px;border-radius:10px;border:0;background:${commercialBlueChromeGradientCss()};color:#fff;font-weight:800;font-size:15px;cursor:pointer;text-decoration:none;flex:1 1 200px}
.cbr-btn-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 16px;border-radius:10px;border:1px solid #005eb8;background:#fff;color:#005eb8;font-weight:800;font-size:14px;text-decoration:none;flex:1 1 160px}
.cbr-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.cbr-msg{display:none;margin:0 0 10px;padding:10px 12px;border-radius:10px;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;font-size:13px;font-weight:700}
.cbr-msg.show{display:block}
.cbr-msg.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}
@media(max-width:720px){
.cbr-hero{padding:16px}.cbr-hero h1{font-size:22px}
.cbr-logo,.cbr-colours,.cbr-fonts,.cbr-actions{grid-template-columns:1fr;flex-direction:column;align-items:stretch}
.cbr-btn,.cbr-btn-secondary{width:100%;flex:1 1 auto}
}
</style>
</head>
<body data-page="customer-brand-review" data-brand-review="v1" data-slug="${esc(slug)}">
<div class="cbr-wrap">
<section class="cbr-hero" aria-label="Review your brand">
<h1>Review your brand</h1>
<p>Confirm the logo, colours and fonts PharmaConnect will use on your generated pharmacy pages.</p>
<div class="cbr-hero-status">${esc(status)}</div>
</section>

<section class="cbr-section" aria-labelledby="logo-heading">
<h2 id="logo-heading">Logo</h2>
<div class="cbr-logo">
<div class="cbr-logo-preview" id="brandLogoPreview">${logoPreview}</div>
<div>
<p class="cbr-meta">${esc(sourceLabel(brand.logoUrl.source, "logo"))}${logoConf ? ` · ${esc(logoConf)}` : ""}</p>
<p class="cbr-hex">${esc(status)}</p>
<label class="cbr-file" for="brandLogoFile">
<span class="cbr-file-btn">Choose a different logo</span>
<input type="file" id="brandLogoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml"/>
</label>
<p class="cbr-file-name" id="brandLogoFileName"></p>
<input type="hidden" id="brandLogoUrl" value="${esc(brand.logoUrl.value)}"/>
</div>
</div>
</section>

<section class="cbr-section" aria-labelledby="colours-heading">
<h2 id="colours-heading">Colours</h2>
<div class="cbr-colours">
${colourField("Primary colour", "brandPrimaryColor", brand.primaryColor)}
${colourField("Secondary colour", "brandSecondaryColor", brand.secondaryColor)}
${colourField("Accent colour", "brandAccentColor", brand.accentColor)}
</div>
</section>

<section class="cbr-section" aria-labelledby="fonts-heading">
<h2 id="fonts-heading">Fonts</h2>
<div class="cbr-fonts">
<div class="cbr-font-card">
<label for="brandHeadingFont"><strong>Heading font</strong></label>
<p class="cbr-meta" data-recorded-fallback="${esc(headingFallback)}">${esc(sourceLabel(brand.headingFont.source, "font"))} · Safe system fallback available</p>
<select id="brandHeadingFont" name="brandHeadingFont">${headingOptions}</select>
<div class="cbr-font-sample-h" id="brandHeadingSample" style="font-family:${esc(brand.headingFontStack)}">The pharmacy heading</div>
</div>
<div class="cbr-font-card">
<label for="brandBodyFont"><strong>Body font</strong></label>
<p class="cbr-meta" data-recorded-fallback="${esc(bodyFallback)}">${esc(sourceLabel(brand.bodyFont.source, "font"))} · Safe system fallback available</p>
<select id="brandBodyFont" name="brandBodyFont">${bodyOptions}</select>
<div class="cbr-font-sample-b" id="brandBodySample" style="font-family:${esc(brand.bodyFontStack)}">Patients should be able to read this clearly on every generated page.</div>
</div>
</div>
</section>

<section class="cbr-section" aria-labelledby="preview-heading">
<h2 id="preview-heading">Website preview</h2>
${renderPreview(slug, brand)}
</section>

<section class="cbr-section">
<p class="cbr-note">Your confirmed brand will be applied consistently to service pages and local pages. You can update it later without changing approved page content.</p>
</section>

<section class="cbr-section" aria-label="Brand actions">
<p id="brandConfirmMsg" class="cbr-msg" role="status"></p>
<div class="cbr-actions">
<button type="button" class="cbr-btn" id="confirmBrandBtn">Confirm brand</button>
<a class="cbr-btn-secondary" href="${esc(pharmacyUrl)}">Return to pharmacy details</a>
<a class="cbr-btn-secondary" href="${esc(dashboardUrl)}">Return to dashboard</a>
</div>
</section>
</div>
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var BRAND_IDENTITY_URL = '/api/growth-engine/' + encodeURIComponent(SLUG) + '/brand-identity';
  var LOGO_UPLOAD_URL = '/api/pharmacy/profile/' + encodeURIComponent(SLUG) + '/logo';
  var STACK = ', system-ui, -apple-system, Segoe UI, sans-serif';

  function val(id){
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }
  function setSwatch(id, hex){
    var swatch = document.getElementById(id + 'Swatch');
    var shown = document.getElementById(id + 'Value');
    if (swatch) swatch.style.background = hex;
    if (shown) shown.textContent = hex;
  }
  function syncPreview(){
    var root = document.querySelector('.cbr-preview');
    if (!root) return;
    var primary = val('brandPrimaryColor') || '#005eb8';
    var secondary = val('brandSecondaryColor') || '#003087';
    var accent = val('brandAccentColor') || primary;
    var heading = val('brandHeadingFont') || 'Poppins';
    var body = val('brandBodyFont') || 'Inter';
    root.style.setProperty('--brand-primary', primary);
    root.style.setProperty('--brand-secondary', secondary);
    root.style.setProperty('--brand-accent', accent);
    root.style.setProperty('--brand-cta', accent);
    root.style.setProperty('--brand-font-heading', "'" + heading + "'" + STACK);
    root.style.setProperty('--brand-font-body', "'" + body + "'" + STACK);
    var h = document.getElementById('brandHeadingSample');
    var p = document.getElementById('brandBodySample');
    if (h) h.style.fontFamily = heading + STACK;
    if (p) p.style.fontFamily = body + STACK;
  }
  function bindColour(id){
    var picker = document.getElementById(id);
    var text = document.getElementById(id + 'Text');
    if (!picker || !text) return;
    picker.addEventListener('input', function(){
      text.value = picker.value;
      setSwatch(id, picker.value);
      syncPreview();
    });
    text.addEventListener('change', function(){
      var next = text.value.trim();
      if (!/^#?[0-9a-fA-F]{3,8}$/.test(next)) return;
      if (next.charAt(0) !== '#') next = '#' + next;
      picker.value = next.length === 4 || next.length === 7 ? next : picker.value;
      text.value = picker.value;
      setSwatch(id, picker.value);
      syncPreview();
    });
  }
  ['brandPrimaryColor','brandSecondaryColor','brandAccentColor'].forEach(bindColour);
  ['brandHeadingFont','brandBodyFont'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', syncPreview);
  });

  var logoFile = document.getElementById('brandLogoFile');
  if (logoFile) logoFile.addEventListener('change', async function(){
    if (!this.files || !this.files[0]) return;
    var nameEl = document.getElementById('brandLogoFileName');
    if (nameEl) {
      nameEl.textContent = this.files[0].name;
      nameEl.className = 'cbr-file-name show';
    }
    var data = new FormData();
    data.append('logo', this.files[0]);
    try {
      var res = await fetch(LOGO_UPLOAD_URL, { method: 'POST', credentials: 'same-origin', body: data });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Logo upload failed.');
      var url = json.logoUrl || '';
      var hidden = document.getElementById('brandLogoUrl');
      if (hidden) hidden.value = url;
      var preview = document.getElementById('brandLogoPreview');
      if (preview) preview.innerHTML = '<img id="brandLogoPreviewImg" src="'+url+'" alt="Pharmacy logo"/>';
      var overlayLogo = document.querySelector('[data-tenant-brand-logo="overlay"]');
      if (overlayLogo) overlayLogo.setAttribute('src', url);
    } catch (e) {
      alert(e.message || String(e));
    }
  });

  var confirmBrandBtn = document.getElementById('confirmBrandBtn');
  var msg = document.getElementById('brandConfirmMsg');
  if (confirmBrandBtn) confirmBrandBtn.addEventListener('click', async function(){
    confirmBrandBtn.disabled = true;
    try {
      var res = await fetch(BRAND_IDENTITY_URL, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          logoUrl: val('brandLogoUrl'),
          primaryColor: val('brandPrimaryColor'),
          secondaryColor: val('brandSecondaryColor'),
          accentColor: val('brandAccentColor'),
          headingFont: val('brandHeadingFont'),
          bodyFont: val('brandBodyFont')
        })
      });
      var json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Could not confirm brand.');
      window.location.reload();
    } catch (e) {
      if (msg) {
        msg.textContent = e.message || String(e);
        msg.className = 'cbr-msg err show';
      } else {
        alert(e.message || String(e));
      }
      confirmBrandBtn.disabled = false;
    }
  });
})();
</script>
</body></html>`);
}
