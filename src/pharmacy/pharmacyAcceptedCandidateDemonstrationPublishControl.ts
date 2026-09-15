/**
 * Review Centre publication panel and authenticated demonstration-publish confirmation.
 */
import type { ReviewCentrePublicationPanel } from "./growthEngineReviewCentreModel.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function shortHash(value: string): string {
  const hash = String(value || "").trim();
  return hash ? hash.slice(0, 12) : "—";
}

export function renderAcceptedCandidateDemonstrationPublishConfirm(input: ReviewCentrePublicationPanel): string {
  if (input.primaryAction !== "publish-demonstration" && input.primaryAction !== "update-demonstration") {
    return "";
  }
  const areaLine =
    input.pageType === "service-page"
      ? `${input.pageTypeLabel}`
      : `${input.pageTypeLabel} · ${input.areaLabel}`;
  return `<dialog class="rc-publication-confirm" data-publication-confirm="1" data-area="${esc(input.area)}" data-asset="${esc(input.asset)}">
<div class="rc-publication-confirm-inner">
<h4>${esc(input.primaryActionLabel)}</h4>
<dl>
<div><dt>Pharmacy</dt><dd>${esc(input.pharmacyName)}</dd></div>
<div><dt>Campaign / service</dt><dd>${esc(input.campaignName)}</dd></div>
<div><dt>Page type and area</dt><dd>${esc(areaLine)}</dd></div>
<div><dt>Candidate version</dt><dd>${esc(input.candidateVersion)} · HTML ${esc(input.candidateHtmlSha256)} · copy ${esc(input.candidateCopySha256)}</dd></div>
<div><dt>Destination URL</dt><dd>${esc(input.destinationUrl)}</dd></div>
<div><dt>Demonstration / indexing</dt><dd>Demonstration publication. Robots: ${esc(input.robots)}. Not clinically approved. Not submitted for indexing.</dd></div>
</dl>
<label class="rc-publication-confirm-check">
<input type="checkbox" data-publication-confirm-check="1"/>
<span>I confirm this demonstration publication. It is not clinically approved and will not be submitted for indexing.</span>
</label>
<div class="rc-publication-confirm-actions">
<button type="button" class="rc-btn rc-btn-ghost" data-publication-confirm-cancel="1">Cancel</button>
<button type="button" class="rc-btn rc-btn-staging" data-publication-confirm-submit="1" data-api="${esc(input.apiPath)}" data-asset="${esc(input.asset)}" data-area="${esc(input.area)}" disabled>${esc(input.primaryActionLabel)}</button>
</div>
</div>
</dialog>`;
}

export function renderAcceptedCandidateDemonstrationPublishControl(input: ReviewCentrePublicationPanel): string {
  if (input.primaryAction === "view-published" && input.publishedUrl) {
    return `<a class="rc-btn rc-btn-staging" data-view-published-page="1" href="${esc(input.publishedUrl)}" target="_blank" rel="noopener">View published page</a>`;
  }
  if (input.primaryAction === "publish-demonstration" || input.primaryAction === "update-demonstration") {
    return `<button type="button" class="rc-btn rc-btn-staging" data-publication-open-confirm="1">${esc(input.primaryActionLabel)}</button>`;
  }
  return "";
}

export function renderAcceptedCandidatePublicationPanel(input: ReviewCentrePublicationPanel): string {
  if (!input.enabled) return "";
  const dest =
    input.primaryAction === "view-published" && input.publishedUrl
      ? `<a href="${esc(input.publishedUrl)}" target="_blank" rel="noopener">${esc(input.publishedUrl)}</a>`
      : esc(input.destinationUrl);
  const lock = input.lockReason ? `<p class="rc-publication-lock">${esc(input.lockReason)}</p>` : "";
  const notice = input.demonstrationNotice
    ? `<p class="rc-publication-notice">${esc(input.demonstrationNotice)}</p>`
    : "";
  return `<section class="rc-publication-panel" data-publication-panel="1" data-publication-kind="${esc(input.kind)}" data-publication-status="${esc(input.publicationStatus)}" data-publication-action="${esc(input.primaryAction)}" data-area="${esc(input.area)}" data-asset="${esc(input.asset)}">
<h4>Publication</h4>
${notice}
<dl>
<div><dt>Publication status</dt><dd data-publication-status-value="${esc(input.publicationStatus)}">${esc(input.publicationStatusLabel)}</dd></div>
<div><dt>Destination URL</dt><dd data-publication-destination>${dest}</dd></div>
<div><dt>Candidate version</dt><dd data-publication-version>${esc(input.candidateVersion)} · HTML ${esc(shortHash(input.candidateHtmlSha256))} · copy ${esc(shortHash(input.candidateCopySha256))}</dd></div>
<div><dt>Approval status</dt><dd>${esc(input.approvalStatusLabel)}</dd></div>
<div><dt>Indexing status</dt><dd>${esc(input.indexingStatusLabel)}</dd></div>
</dl>
${lock}
<div class="rc-publication-actions">
${renderAcceptedCandidateDemonstrationPublishControl(input)}
</div>
${renderAcceptedCandidateDemonstrationPublishConfirm(input)}
</section>`;
}

export function acceptedCandidateDemonstrationPublishControlScript(): string {
  return `
(function(){
  var publishing = false;
  function withAuthToken(href) {
    if (!href) return href;
    var token = new URLSearchParams(window.location.search).get('_t');
    if (!token) return href;
    try {
      var url = new URL(href, window.location.origin);
      if (!url.searchParams.get('_t')) url.searchParams.set('_t', token);
      return url.pathname + url.search + url.hash;
    } catch (err) {
      return href;
    }
  }
  document.querySelectorAll("[data-publication-panel]").forEach(function(panel){
    var dialog = panel.querySelector("[data-publication-confirm]");
    var openBtn = panel.querySelector("[data-publication-open-confirm]");
    if (openBtn && dialog) {
      openBtn.addEventListener("click", function(){
        var check = dialog.querySelector("[data-publication-confirm-check]");
        var submit = dialog.querySelector("[data-publication-confirm-submit]");
        if (check) check.checked = false;
        if (submit) submit.disabled = true;
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      });
    }
    if (!dialog) return;
    var check = dialog.querySelector("[data-publication-confirm-check]");
    var submit = dialog.querySelector("[data-publication-confirm-submit]");
    var cancel = dialog.querySelector("[data-publication-confirm-cancel]");
    function syncSubmit() {
      if (!submit) return;
      submit.disabled = publishing || !(check && check.checked);
    }
    if (check) check.addEventListener("change", syncSubmit);
    if (cancel) cancel.addEventListener("click", function(){
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    });
    dialog.addEventListener("cancel", function(){
      if (check) check.checked = false;
      syncSubmit();
    });
    if (submit) submit.addEventListener("click", async function(){
      if (publishing || !check || !check.checked) return;
      var api = submit.getAttribute("data-api");
      var asset = submit.getAttribute("data-asset") || panel.getAttribute("data-asset");
      var area = submit.getAttribute("data-area") || panel.getAttribute("data-area");
      var tenantSlug = typeof SLUG === "string" ? SLUG : "";
      var campaignId = typeof CAMPAIGN === "string" ? CAMPAIGN : "";
      if (!api || !tenantSlug || !campaignId || !asset || !area) return;
      publishing = true;
      submit.disabled = true;
      if (openBtn) openBtn.disabled = true;
      if (typeof showStatus === "function") showStatus("Publishing accepted demonstration page…", true);
      try {
        var url = withAuthToken(api);
        var res = await fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ tenantSlug: tenantSlug, campaignId: campaignId, asset: asset, area: area })
        });
        var json = await res.json();
        if (!json.ok) throw new Error(json.error || json.unmetCondition || "Demonstration publish failed");
        var msg = json.duplicate
          ? (json.message || "Demonstration publication is already current.")
          : (json.message || "Published demonstration page.");
        if (json.publishedUrl) msg += " " + json.publishedUrl;
        if (typeof showStatus === "function") showStatus(msg, true);
        setTimeout(function(){
          if (typeof PAGE_URL === "string") location.href = PAGE_URL;
          else location.reload();
        }, 600);
      } catch (e) {
        publishing = false;
        if (openBtn) openBtn.disabled = false;
        syncSubmit();
        if (typeof showStatus === "function") showStatus(e.message || String(e), false);
      }
    });
    syncSubmit();
  });
})();
`;
}
