/**
 * Customer Setup Import Split V1 — Step 1 start page (two independent imports).
 */
import { customerSetupStartUrl, loadCustomerSetupStartDefaults } from "./growthEngineCustomerSetupImportSplitService.ts";
import { renderRetiredSetupTestBanner } from "./growthEngineCustomerSetupTestTenants.ts";
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function customerSetupStartCss(): string {
  return `${commercialBlueUiBaselineCss()}
*{box-sizing:border-box}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:linear-gradient(180deg,#f0f7ff 0%,#f8fafc 55%);color:#0f172a;line-height:1.5;min-height:100vh}
.css-wrap{max-width:680px;margin:0 auto;padding:40px 24px 64px}
.css-brand{text-align:center;margin-bottom:28px}
.css-brand-mark{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:${commercialBlueChromeGradientCss()};color:#fff;font-size:28px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,94,184,.22)}
.css-brand h1{margin:0 0 10px;font-size:26px;font-weight:900;letter-spacing:-.02em;color:#0f172a}
.css-brand p{margin:0;font-size:15px;color:#64748b;line-height:1.55}
.css-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px 24px 26px;margin-bottom:18px;box-shadow:0 12px 40px rgba(15,23,42,.06)}
.css-card h2{margin:0 0 6px;font-size:18px;font-weight:900;color:#0f172a}
.css-card .sub{margin:0 0 18px;font-size:13px;color:#64748b;line-height:1.5}
.css-divider{text-align:center;margin:8px 0 18px;font-size:12px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}
.css-field{margin-bottom:16px}
.css-field label{display:block;font-size:13px;font-weight:700;color:#334155;margin-bottom:6px}
.css-field input{width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:15px;color:#0f172a;background:#fafbfc}
.css-field input:focus{outline:none;border-color:#005eb8;box-shadow:0 0 0 3px rgba(0,94,184,.12);background:#fff}
.css-field .hint{display:block;margin-top:5px;font-size:12px;color:#94a3b8;line-height:1.45}
.css-help{margin:12px 0 0;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.55}
.css-help strong{display:block;margin-bottom:6px;color:#0f172a;font-size:13px}
.css-help ol{margin:0;padding-left:18px}
.css-submit{width:100%;margin-top:4px;padding:14px 18px;border:none;border-radius:12px;background:${commercialBlueChromeGradientCss()};color:#fff;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 6px 20px rgba(0,94,184,.25)}
.css-submit.secondary{background:${commercialBlueChromeGradientCss()}}
.css-submit:disabled{opacity:.65;cursor:not-allowed}
.css-status{margin-top:10px;font-size:12px;font-weight:700;padding:8px 10px;border-radius:10px;display:none}
.css-status.show{display:block}
.css-status.ok{background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}
.css-status.warn{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
.css-status.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
.css-continue-wrap{margin-top:8px;text-align:center}
.css-continue{display:inline-block;width:100%;max-width:420px;padding:16px 22px;border:none;border-radius:14px;background:#005eb8;color:#fff;font-size:16px;font-weight:900;text-decoration:none;box-shadow:0 8px 24px rgba(0,94,184,.18)}
.css-continue-note{margin-top:10px;font-size:12px;color:#64748b}
.css-reset-btn{display:block;width:100%;margin-top:14px;padding:11px 16px;border:1.5px solid #fecaca;border-radius:12px;background:#fff;color:#991b1b;font-size:13px;font-weight:800;cursor:pointer}
.css-reset-btn:hover{background:#fef2f2;border-color:#f87171}
.css-error{display:none;margin-bottom:14px;padding:12px 14px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;font-weight:600}
.css-error.show{display:block}
.css-retired-banner{margin-bottom:18px;padding:14px 16px;border-radius:14px;background:#fff7ed;border:1.5px solid #fdba74;color:#9a3412;font-size:13px;line-height:1.5}
.css-retired-banner strong{display:block;font-size:14px;margin-bottom:6px;color:#7c2d12}
.css-retired-banner p{margin:0 0 10px}
.css-retired-banner a{font-weight:800;color:#c2410c}
@media(max-width:720px){.css-wrap{padding:24px 16px 48px}.css-brand h1{font-size:22px}}
`;
}

function renderField(id: string, label: string, value: string, placeholder = "", hint = ""): string {
  return `<div class="css-field">
<label for="${esc(id)}">${esc(label)}</label>
<input type="text" id="${esc(id)}" value="${esc(value)}" placeholder="${esc(placeholder)}"/>
${hint ? `<span class="hint">${esc(hint)}</span>` : ""}
</div>`;
}

function googleStatusMessage(status: string): string {
  if (status === "imported") return "Google Profile imported — ready to review.";
  if (status === "needs_review" || status === "possible_match") return "Needs review — check details on the next step.";
  return "";
}

function websiteStatusMessage(status: string): string {
  if (status === "imported") return "Website Intelligence imported — ready to review.";
  if (status === "needs_review" || status === "possible_match") return "Needs review — check details on the next step.";
  return "";
}

export function renderCustomerSetupStartPage(slug: string): string {
  const d = loadCustomerSetupStartDefaults(slug);
  const confirmUrl = `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(slug)}`;
  const googleStatus = googleStatusMessage(d.googleImportStatus);
  const websiteStatus = websiteStatusMessage(d.websiteImportStatus);

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Customer Setup · PharmaConnect</title>
<style>${customerSetupStartCss()}</style>
</head>
<body data-page="customer-setup-start" data-slug="${esc(slug)}">
<div class="css-wrap">
${renderRetiredSetupTestBanner(slug)}
<div class="css-brand">
<div class="css-brand-mark" aria-hidden="true">💊</div>
<h1>Set up your pharmacy</h1>
<p>Import your Google Profile and website separately. You can do either or both before continuing.</p>
</div>

<div id="globalError" class="css-error" role="alert"></div>

<section class="css-card" aria-labelledby="google-card-heading">
<h2 id="google-card-heading">Import Google Business Profile</h2>
<p class="sub">Find your local pharmacy listing on Google Maps.</p>
${renderField("googleBusinessUrl", "Google Maps URL or Google Business Profile URL", d.googleBusinessUrl, "https://maps.google.com/...")}
<div class="css-divider">or search by details</div>
${renderField("googlePharmacyName", "Pharmacy name", d.pharmacyName, "e.g. Rowlands Pharmacy")}
${renderField("googleTown", "Town", d.town, "e.g. Manchester")}
${renderField("googlePostcode", "Postcode", d.postcode, "e.g. M1 1AE")}
<details class="css-help">
<summary><strong>Where do I find my Google Profile link?</strong></summary>
<ol>
<li>Search for your pharmacy on Google.</li>
<li>Click your pharmacy listing or Google Maps result.</li>
<li>Click Share.</li>
<li>Copy the link.</li>
<li>Paste it here.</li>
</ol>
<p style="margin:8px 0 0">You can paste a Google Maps business URL or short share URL.</p>
</details>
<button type="button" class="css-submit" id="googleImportBtn">Find Google Profile</button>
<div id="googleStatus" class="css-status ${googleStatus ? "show ok" : ""}">${esc(googleStatus)}</div>
</section>

<section class="css-card" aria-labelledby="website-card-heading">
<h2 id="website-card-heading">Import Website</h2>
<p class="sub">Import branding and contact details from your pharmacy website.</p>
${renderField("websiteUrl", "Website URL", d.websiteUrl, "https://yourpharmacy.co.uk")}
<button type="button" class="css-submit secondary" id="websiteImportBtn">Import Website</button>
<div id="websiteStatus" class="css-status ${websiteStatus ? "show ok" : ""}">${esc(websiteStatus)}</div>
</section>

<div class="css-continue-wrap">
<a class="css-continue" href="${esc(confirmUrl)}" id="continueBtn">Review Imported Details</a>
<p class="css-continue-note">Continue when you have imported Google Profile, website, or both.</p>
<button type="button" class="css-reset-btn" id="resetImportsBtn">Reset imported data</button>
</div>
</div>
<script>
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var globalErr = document.getElementById('globalError');

  function showStatus(el, msg, kind){
    el.textContent = msg;
    el.className = 'css-status show ' + (kind || 'ok');
  }

  async function postImport(url, payload){
    var res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload || {})
    });
    var json = await res.json();
    if (!json.ok) throw new Error(json.error || json.message || 'Import failed.');
    return json;
  }

  document.getElementById('googleImportBtn').addEventListener('click', async function(){
    var btn = this;
    globalErr.classList.remove('show');
    btn.disabled = true;
    var statusEl = document.getElementById('googleStatus');
    try {
      var json = await postImport('/api/growth-engine/'+encodeURIComponent(SLUG)+'/setup-google-import', {
        googleBusinessUrl: document.getElementById('googleBusinessUrl').value.trim(),
        pharmacyName: document.getElementById('googlePharmacyName').value.trim(),
        town: document.getElementById('googleTown').value.trim(),
        postcode: document.getElementById('googlePostcode').value.trim()
      });
      showStatus(statusEl, json.message || 'Google import finished.', json.status === 'imported' ? 'ok' : 'warn');
    } catch(e) {
      showStatus(statusEl, e.message || String(e), 'err');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('websiteImportBtn').addEventListener('click', async function(){
    var btn = this;
    globalErr.classList.remove('show');
    btn.disabled = true;
    var statusEl = document.getElementById('websiteStatus');
    try {
      var json = await postImport('/api/growth-engine/'+encodeURIComponent(SLUG)+'/setup-website-import', {
        websiteUrl: document.getElementById('websiteUrl').value.trim()
      });
      showStatus(statusEl, json.message || 'Website import finished.', json.status === 'imported' ? 'ok' : 'warn');
    } catch(e) {
      showStatus(statusEl, e.message || String(e), 'err');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('resetImportsBtn').addEventListener('click', async function(){
    if (!window.confirm('Clear all imported Google and website data? Admin-entered details will be kept.')) return;
    var btn = this;
    globalErr.classList.remove('show');
    btn.disabled = true;
    try {
      await postImport('/api/growth-engine/'+encodeURIComponent(SLUG)+'/setup-reset-imports', {});
      window.location.reload();
    } catch(e) {
      globalErr.textContent = e.message || String(e);
      globalErr.classList.add('show');
      btn.disabled = false;
    }
  });
})();
</script>
</body></html>`);
}

export { customerSetupStartUrl };
