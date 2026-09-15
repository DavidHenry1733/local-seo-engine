/**
 * Review Centre “Publish to staging” control — POST tenantSlug + campaignId only.
 * Does not change the active Growth Plan campaign.
 */
function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function lockedCampaignStagingPublishApiPath(slug: string): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/publish-to-staging`;
}

export function renderPublishToStagingControl(input: {
  tenantSlug: string;
  campaignId: string;
  apiPath: string;
  enabled: boolean;
  className: string;
}): string {
  if (!input.enabled) {
    return `<span class="${esc(input.className)} disabled">Publish to staging</span>`;
  }
  return `<button type="button" class="${esc(input.className)}" data-publish-to-staging="1" data-api="${esc(input.apiPath)}" data-tenant="${esc(input.tenantSlug)}" data-campaign="${esc(input.campaignId)}">Publish to staging</button>`;
}

/** Client posts only tenantSlug and campaignId. */
export function publishToStagingControlScript(): string {
  return `
(function(){
  document.querySelectorAll("[data-publish-to-staging]").forEach(function(btn){
    btn.addEventListener("click", async function(){
      var api=btn.getAttribute("data-api");
      var tenantSlug=btn.getAttribute("data-tenant");
      var campaignId=btn.getAttribute("data-campaign");
      if(!api||!tenantSlug||!campaignId)return;
      btn.disabled=true;
      if(typeof showStatus==="function") showStatus("Publishing locked campaign to staging…", true);
      try{
        var res=await fetch(api,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({tenantSlug:tenantSlug,campaignId:campaignId})});
        var json=await res.json();
        if(!json.ok) throw new Error(json.error||json.unmetCondition||"Staging publish failed");
        if(typeof showStatus==="function") showStatus(json.message||"Published to staging.", true);
      }catch(e){
        btn.disabled=false;
        if(typeof showStatus==="function") showStatus(e.message||String(e), false);
      }
    });
  });
})();
`;
}
