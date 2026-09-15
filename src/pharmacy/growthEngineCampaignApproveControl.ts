/**
 * Shared dashboard campaign Approve control — POST tenantSlug + campaignId only.
 */
function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function campaignApproveApiPath(slug: string): string {
  return `/api/growth-engine/${encodeURIComponent(slug)}/approve-campaign`;
}

export function renderCampaignApproveControl(input: {
  tenantSlug: string;
  campaignId: string;
  apiPath: string;
  className: string;
}): string {
  return `<button type="button" class="${esc(input.className)}" data-campaign-approve="1" data-api="${esc(input.apiPath)}" data-tenant="${esc(input.tenantSlug)}" data-campaign="${esc(input.campaignId)}">Approve</button>`;
}

/** Client posts only tenantSlug and campaignId, then follows backend redirect. */
export function campaignApproveControlScript(): string {
  return `<script>
(function(){
  document.querySelectorAll("[data-campaign-approve]").forEach(function(btn){
    btn.addEventListener("click", async function(){
      var api=btn.getAttribute("data-api");
      var tenantSlug=btn.getAttribute("data-tenant");
      var campaignId=btn.getAttribute("data-campaign");
      if(!api||!tenantSlug||!campaignId)return;
      btn.disabled=true;
      try{
        var res=await fetch(api,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({tenantSlug:tenantSlug,campaignId:campaignId})});
        var json=await res.json();
        if(json.redirect){ location.href=json.redirect; return; }
        throw new Error(json.unmetCondition||json.error||"Approval failed");
      }catch(e){
        btn.disabled=false;
        btn.setAttribute("title", e.message||String(e));
      }
    });
  });
})();
</script>`;
}
