/**
 * Growth Engine Framework V1 — step page HTML renderers.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import {
  buildGrowthEngineFramework,
  growthEngineWizardUrl,
  isCustomerVisibleInStepper,
  type GrowthEngineFramework,
  type GrowthEnginePlanRecommendation,
} from "./growthEngineFrameworkService.ts";
import {
  growthEngineWorkflowCss,
  renderGrowthEngineNavBar,
} from "./growthEngineWorkflowNav.ts";
import {
  buildWizardImportFields,
  buildImportBrandSummary,
  buildLocalIntelPreview,
  countImportSummary,
} from "./pharmacyProfileWizardEnrichment.ts";
import { computeWizardQualityScore } from "./pharmacyProfileWizardScoring.ts";
import { isRequiredProfileComplete } from "./pharmacyProfileFieldClassification.ts";
import { buildAuthoritativeCampaignProgramme } from "./pharmacyAuthoritativeCampaignProgrammeService.ts";
import {
  campaignApproveControlScript,
  renderCampaignApproveControl,
} from "./growthEngineCampaignApproveControl.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
} from "./pharmacyPlatformNav.ts";
import { renderGrowthPlanV1Page } from "./growthEngineGrowthPlanPage.ts";
import { renderPremiumCustomerDashboardPage } from "./growthEnginePremiumCustomerDashboardPage.ts";
import { renderLiveIntegrationProofPage } from "./growthEngineLiveIntegrationProofPage.ts";
import { growthEnginePlatformCopy } from "./growthEnginePlatformCopy.ts";
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function pageShell(
  slug: string,
  title: string,
  subtitle: string,
  activeStep: GrowthEngineFramework["currentStep"],
  body: string,
  navOptions?: { prevUrl?: string; nextUrl?: string; nextLabel?: string },
): string {
  const framework = buildGrowthEngineFramework(slug);
  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} · Growth Engine</title>
<style>
${commercialBlueUiBaselineCss()}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthEngineWorkflowCss()}
</style>
</head>
<body data-slug="${esc(slug)}">
<header style="background:${commercialBlueChromeGradientCss()};color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>${esc(title)}</h1>
<p>${esc(subtitle)}</p>
</div>
${renderGrowthEngineNavBar(slug, framework, activeStep, navOptions)}
${body}
</div>
</body></html>`);
}

function importBadgeClass(status: string): string {
  if (status === "imported") return "imported";
  if (status === "missing") return "missing";
  return "confirmed";
}

import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { renderLocalMarketIntelligencePage } from "./growthEngineLocalMarketPage.ts";
import { renderNationalSearchIntelligencePage } from "./nationalSearchIntelligencePage.ts";
import { renderLocalSearchIntelligencePage } from "./growthEngineLocalSearchIntelligencePage.ts";
import { renderGrowthIntelligenceV1Page } from "./growthEngineGrowthIntelligencePage.ts";
import { renderWebsiteIntelligencePage as renderWebsiteIntelligenceHtml } from "./growthEngineWebsiteIntelligencePage.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";

function stepNavUrls(slug: string, framework: GrowthEngineFramework, step: number) {
  const prev = framework.steps.find((s) => s.step === step - 1)?.url;
  const next = framework.steps.find((s) => s.step === step + 1)?.url;
  return { prev, next };
}

export function renderGrowthEngineHubPage(slug: string): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  const steps = framework.steps
    .filter((s) => isCustomerVisibleInStepper(s.id))
    .map(
      (s) =>
        `<a class="ge-card" href="${esc(s.url)}" style="text-decoration:none;color:inherit">
<h3>${esc(s.title)}</h3>
<p style="font-size:13px;color:#64748b;margin:0">${esc(s.summary)}</p>
<p style="font-size:12px;font-weight:800;color:#005eb8;margin:8px 0 0">${s.completionPct}% · ${esc(s.status.replace("_", " "))}</p>
</a>`,
    )
    .join("");
  const nextUrl = framework.nextStep?.url || framework.steps[0].url;
  const programme = buildAuthoritativeCampaignProgramme(slug);
  const campaignCards = programme.campaigns
    .map(
      (c) => `<div class="ge-card">
<h3>${esc(c.serviceName)}</h3>
<p style="font-size:13px;margin:0 0 6px"><strong>${esc(c.statusLabel)}</strong></p>
<p style="font-size:12px;color:#64748b;word-break:break-all;margin:0 0 6px">Bank ${esc(c.approvedBankHash || "—")}</p>
<p style="font-size:13px;margin:0 0 8px">${c.servicePageCount} service page + ${c.localityPageCount} locality pages</p>
<p>${c.controls.map((ctl) => `<a class="ge-btn ge-btn-ghost" href="${esc(ctl.href)}" style="margin-right:6px">${esc(ctl.label)}</a>`).join("")}</p>
</div>`,
    )
    .join("");
  const next = programme.nextCampaign;
  const nextHtml = next
    ? `<div class="ge-card">
<h3>Next campaign: ${esc(next.serviceName)}</h3>
<p style="font-size:13px;color:#64748b">${esc(next.reason)}</p>
<button type="button" class="ge-btn ge-btn-primary" id="hubGenerateNext" data-api="${esc(programme.generateNextApiPath)}" data-tenant="${esc(slug)}" data-intent="${esc(programme.generateNextIntent)}">Generate Next Campaign</button>
</div>
<script>
(function(){
  const btn=document.getElementById('hubGenerateNext');
  if(!btn)return;
  btn.addEventListener('click', async function(){
    btn.disabled=true;
    try{
      const res=await fetch(btn.getAttribute('data-api'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:btn.getAttribute('data-tenant'),intent:btn.getAttribute('data-intent')})});
      const json=await res.json();
      if(!json.ok) throw new Error(json.error||'Failed');
      location.reload();
    }catch(e){alert(e.message);btn.disabled=false;}
  });
})();
</script>`
    : programme.exhausted
      ? `<div class="ge-card"><h3>Campaign queue</h3><p style="font-size:13px;color:#64748b">${esc(programme.exhaustedMessage || "No next approved registered-service campaign is available")}</p></div>`
      : "";
  const body = `<div class="ge-panel">
<h2>${esc(copy.hubTitle)}</h2>
<p class="ge-lead">${esc(copy.hubLead)}</p>
<div class="ge-grid-3">${steps}</div>
<p style="margin-top:20px"><a class="ge-btn ge-btn-primary" href="${esc(nextUrl)}">Continue where you left off →</a></p>
</div>
<div class="ge-panel">
<h2>Campaign programme</h2>
<p class="ge-lead">Authoritative campaign records — not Growth Plan scoring.</p>
<div class="ge-grid-3">${campaignCards}${nextHtml}</div>
</div>`;
  return pageShell(slug, copy.hubTitle, copy.hubLead, framework.currentStep, body);
}

export function renderBusinessIntelligencePage(slug: string, data: PharmacyProfileData): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  const quality = computeWizardQualityScore(data);
  const ready = isRequiredProfileComplete(data);
  const fields = buildWizardImportFields(data);
  const summary = countImportSummary(fields);
  const brand = buildImportBrandSummary(data);
  const local = buildLocalIntelPreview(data);
  const rows = fields
    .map(
      (f) => {
        const statusLabel =
          f.status === "review"
            ? "Needs Review"
            : f.status === "imported"
              ? "Imported"
              : f.status === "confirmed"
                ? "Confirmed"
                : f.status === "missing"
                  ? "Not found"
                  : "Manual";
        const badgeClass =
          f.status === "review"
            ? "review"
            : f.status === "imported"
              ? "imported"
              : f.status === "confirmed"
                ? "confirmed"
                : f.status === "missing"
                  ? "missing"
                  : "confirmed";
        return `<div class="ge-import-row"><span>${esc(f.label)}</span><span class="ge-import-badge ${badgeClass}">${esc(statusLabel)}</span></div>`;
      },
    )
    .join("");
  const hero = brand.logoUrl
    ? `<div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;padding:16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px">
${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="" style="max-height:52px;max-width:140px;border-radius:6px;background:#fff;padding:4px"/>` : ""}
<div><strong style="font-size:18px">${esc(data.pharmacyName || slug)}</strong>
<p style="margin:4px 0 0;font-size:13px;color:#64748b">${brand.servicesDetected ? `${brand.servicesDetected} services detected · ` : ""}${brand.navLinks ? `${brand.navLinks} nav links · ` : ""}${brand.socialCount ? `${brand.socialCount} social profiles` : "Run website import to auto-fill your profile"}</p></div></div>`
    : `<div style="margin-bottom:16px;padding:14px;border:1px dashed #cbd5e1;border-radius:12px;font-size:13px;color:#64748b">Import your website to auto-fill business name, contact, brand and services — minimal typing required.</div>`;
  const localRows = copy.platform === "national"
    ? ""
    : [
    ["Google listing", local.googlePlaceFound ? local.googlePlaceLabel : "Not linked"],
    ["Competitors", local.competitorCount ? String(local.competitorCount) : "Load in wizard"],
    ["GP surgeries", local.gpCount ? String(local.gpCount) : "—"],
    ["Health centres", local.healthCentreCount ? String(local.healthCentreCount) : "—"],
    ["Hospitals", local.hospitalCount ? String(local.hospitalCount) : "—"],
    ["Landmarks", local.landmarkCount ? String(local.landmarkCount) : "—"],
  ]
    .map(([label, val]) => `<div class="ge-import-row"><span>${esc(label)}</span><span style="font-size:13px;font-weight:700;color:#334155">${esc(val)}</span></div>`)
    .join("");
  const { prev, next } = stepNavUrls(slug, framework, 1);
  const body = `<div class="ge-panel">
<h2>Import-first — confirm what we found</h2>
<p class="ge-lead">We populate your profile from your website, Google Places, and existing data. Badges: <strong>Imported</strong> · <strong>Confirmed</strong> · <strong>Needs Review</strong>.</p>
<p class="ge-lead">${summary.imported + summary.review} imported · ${summary.confirmed} confirmed · ${summary.missing} not found · ${quality.overallScore}% complete · ~${quality.estimatedMinutesRemaining} min to finish</p>
${hero}
${ready ? `<p style="color:#059669;font-weight:700">✓ Required profile fields complete</p>` : `<p style="color:#b45309;font-weight:700">${quality.missingRequired.length} required item(s) still needed — mostly confirm imported values</p>`}
<h3 style="font-size:15px;margin:20px 0 10px">Imported business information</h3>
<div style="margin:8px 0">${rows}</div>
${copy.platform === "national" ? `<h3 style="font-size:15px;margin:20px 0 10px">National market</h3><p class="ge-lead">Commercial market is national / UK. Local Google Places comparison is not a prerequisite.</p>` : `<h3 style="font-size:15px;margin:20px 0 10px">Local market preview</h3>
<div style="margin:8px 0">${localRows}</div>`}
<p style="margin-top:20px"><a class="ge-btn ge-btn-primary" href="${esc(growthEngineWizardUrl(slug))}">Review &amp; confirm in wizard →</a>
<a class="ge-btn ge-btn-ghost" href="${esc(growthEngineWizardUrl(slug))}" style="margin-left:8px">Import website</a></p>
</div>`;
  return pageShell(slug, copy.businessStepTitle, copy.businessStepSubtitle, "business-intelligence", body, {
    nextUrl: next,
    nextLabel: `Continue to ${copy.marketStepTitle} →`,
  });
}

export function renderWebsiteIntelligencePage(slug: string): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev } = stepNavUrls(slug, framework, 3);
  const next = framework.steps.find((s) => s.id === "growth-plan")?.url;
  const snapshot = resolveWebsiteIntelligenceSnapshot(slug);
  const importSnap = readSetupProfile(slug).websiteImportSnapshot;
  return renderWebsiteIntelligenceHtml(slug, snapshot, { prevUrl: prev, nextUrl: next }, importSnap);
}

export function renderLocalMarketPage(slug: string, snapshot: GrowthEngineCompetitorSnapshot | null): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 2);
  if (isNationalGrowthPlatform(slug)) {
    return renderNationalSearchIntelligencePage(slug, { prevUrl: prev, nextUrl: next });
  }
  return renderLocalMarketIntelligencePage(slug, snapshot, { prevUrl: prev, nextUrl: next });
}

export function renderSearchIntelligencePage(slug: string): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 2);
  if (isNationalGrowthPlatform(slug)) {
    return renderNationalSearchIntelligencePage(slug, { prevUrl: prev, nextUrl: next });
  }
  return renderLocalSearchIntelligencePage(slug, { prevUrl: prev, nextUrl: next });
}

export function renderGrowthIntelligencePage(slug: string, snapshot: GrowthEngineCompetitorSnapshot | null): string {
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 4);
  return renderGrowthIntelligenceV1Page(slug, snapshot, { prevUrl: prev, nextUrl: next });
}

export function renderGrowthPlanPage(
  slug: string,
  _plan: GrowthEnginePlanRecommendation,
  options?: { selectionError?: string },
): string {
  const framework = buildGrowthEngineFramework(slug);
  const prev = framework.steps.find((s) => s.id === "website-intelligence")?.url;
  return renderGrowthPlanV1Page(slug, { prevUrl: prev, selectionError: options?.selectionError });
}

export function renderGeneratePage(slug: string, _plan: GrowthEnginePlanRecommendation): string {
  const copy = growthEnginePlatformCopy(slug);
  const framework = buildGrowthEngineFramework(slug);
  const { prev, next } = stepNavUrls(slug, framework, 6);
  if (copy.platform === "national") {
    const body = `<div class="ge-panel">
<h2>Campaign strategy</h2>
<p class="ge-lead">This national tenant uses persisted commercial intelligence. Patient-service Campaign Builder is not the next step. National commercial content generation is not yet implemented.</p>
<p style="margin-top:16px"><a class="ge-btn ge-btn-primary" href="/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}">Return to Growth Plan →</a></p>
</div>`;
    return pageShell(slug, copy.generateStepTitle, copy.generateStepSubtitle, "generate", body, {
      prevUrl: prev,
      nextUrl: next,
      nextLabel: "Continue to Dashboard →",
    });
  }
  const programme = buildAuthoritativeCampaignProgramme(slug);
  const nextCampaign = programme.nextCampaign;
  const cards = programme.campaigns
    .map(
      (c) => `<li style="margin-bottom:12px">
<strong>${esc(c.serviceName)}</strong> — ${esc(c.statusLabel)}<br/>
<span style="font-size:12px;color:#64748b;word-break:break-all">Approved bank hash: ${esc(c.approvedBankHash || "—")}</span><br/>
${c.servicePageCount} service page + ${c.localityPageCount} locality pages<br/>
${c.controls
            .map((ctl) =>
              ctl.action === "approve"
                ? renderCampaignApproveControl({
                    tenantSlug: slug,
                    campaignId: c.serviceId,
                    apiPath: c.approveApiPath,
                    className: "ge-btn ge-btn-ghost",
                  })
                : `<a class="ge-btn ge-btn-ghost" href="${esc(ctl.href || "#")}" style="margin:8px 8px 0 0">${esc(ctl.label)}</a>`,
            )
            .join("")}
</li>`,
    )
    .join("");
  const nextHtml = nextCampaign
    ? `<p style="margin-top:16px"><strong>Next approved campaign:</strong> ${esc(nextCampaign.serviceName)}</p>
<p style="font-size:13px;color:#64748b">${esc(nextCampaign.reason)}</p>
<button type="button" class="ge-btn ge-btn-primary" id="genGenerateNext" data-api="${esc(programme.generateNextApiPath)}" data-tenant="${esc(slug)}" data-intent="${esc(programme.generateNextIntent)}">Generate Next Campaign</button>
<p id="genGenerateNextMsg" style="font-size:13px;color:#64748b;margin-top:8px">Calls the Product Owner workflow with tenant + intent only.</p>
<script>
(function(){
  const btn=document.getElementById('genGenerateNext');
  if(!btn)return;
  btn.addEventListener('click', async function(){
    const msg=document.getElementById('genGenerateNextMsg');
    btn.disabled=true;
    try{
      const res=await fetch(btn.getAttribute('data-api'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:btn.getAttribute('data-tenant'),intent:btn.getAttribute('data-intent')})});
      const json=await res.json();
      if(!json.ok) throw new Error(json.error||'Failed');
      location.reload();
    }catch(e){if(msg)msg.textContent=e.message;btn.disabled=false;}
  });
})();
</script>`
    : programme.exhausted
      ? `<p style="margin-top:16px">${esc(programme.exhaustedMessage || "No next approved registered-service campaign is available")}</p>`
      : "";
  const body = `<div class="ge-panel">
<h2>Create your content</h2>
<p class="ge-lead">Campaign status is read from generated packages, approved banks, Review Centre, and core-page inventory.</p>
<ul style="font-size:14px;color:#475569;padding-left:18px">${cards || "<li>No generated campaigns yet.</li>"}</ul>
${campaignApproveControlScript()}
${nextHtml}
</div>`;
  return pageShell(slug, "Create Content", "Build content for your Growth Cycle", "generate", body, {
    prevUrl: prev,
    nextUrl: next,
    nextLabel: "Continue to Dashboard →",
  });
}

export function renderGrowthEngineDashboardPage(
  slug: string,
  _section = "overview",
  options: { approvedCampaignId?: string } = {},
): string {
  return renderPremiumCustomerDashboardPage(slug, options);
}

export { renderLiveIntegrationProofPage };
