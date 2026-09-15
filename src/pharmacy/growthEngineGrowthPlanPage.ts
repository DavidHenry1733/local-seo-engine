/**
 * Growth Engine — Growth Plan Intelligence V1 page renderer (Step 5).
 */
import {
  buildGrowthEngineFramework,
  resolveGrowthPlanContinueCta,
} from "./growthEngineFrameworkService.ts";
import type { GrowthPlanIntelligence } from "./growthEngineCampaignRecommendationEngine.ts";
import type {
  CampaignAlternative,
  CampaignEvidence,
  CampaignReadinessItem,
  GrowthEngineCampaignRecommendation,
} from "./growthEngineCampaignModel.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import { resolveAuthoritativeCampaignPriority, listEnabledPharmacyServices, resolveGrowthPlan } from "./growthEngineGrowthPlanResolver.ts";
import { buildGrowthPlanForSelectedService } from "./growthEngineCampaignRecommendationEngine.ts";
import { buildGrowthPlanCommercialView } from "./growthEngineGrowthPlanPresentationView.ts";
import {
  commercialBlueChromeGradientCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";
import {
  customerReadinessLabelForPlatform,
  growthEnginePlatformCopy,
} from "./growthEnginePlatformCopy.ts";
import type { NationalGrowthPlanView, NationalPrimaryRecommendation } from "./growthEngineNationalGrowthPlanService.ts";
import { buildAuthoritativeCampaignProgramme } from "./pharmacyAuthoritativeCampaignProgrammeService.ts";
import { tenantHasExistingCampaign } from "./pharmacyGenerateNextCampaignAuthority.ts";
import { resolveGrowthPlanLifecyclePresentation, type GrowthPlanLifecyclePresentation } from "./growthEngineGrowthPlanLifecycle.ts";
import { buildPlatformNavItems } from "./pharmacyPlatformNav.ts";
import { reviewCentreUrl } from "./growthEngineReviewCentreService.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function customerEvidenceSource(source: string): string {
  const map: Record<string, string> = {
    "Business Profile": "Your Pharmacy",
    "Website Intelligence": "Your Website Report",
    "Local Healthcare Intelligence": "Your Local Market",
    "Growth Intelligence": "Evidence synthesis",
    "Google Business Profile": "Google Business Profile",
    "Service intelligence": "Service intelligence",
  };
  return map[source] || source.replace(/Business Intelligence/g, "Your Pharmacy");
}

function customerCopy(text: string, platform: "local" | "national" = "local"): string {
  if (platform === "national") return text;
  return text
    .replace(/Business Intelligence/g, "Your Pharmacy")
    .replace(/Local Healthcare Intelligence/g, "Your Local Market")
    .replace(/Website Intelligence/g, "Your Website Report")
    .replace(/Growth Intelligence/g, "evidence synthesis");
}

export function growthPlanPageCss(): string {
  return `${growthEngineWorkflowCss()}
.gp-hero{background:${commercialBlueChromeGradientCss()};border-radius:16px;padding:24px;color:#fff;margin-bottom:18px}
.gp-hero h2{margin:0 0 10px;font-size:22px;color:#fff}
.gp-hero p{margin:0 0 8px;font-size:14px;color:#dbeafe;line-height:1.55}
.gp-hero strong{color:#fff}
.gp-campaign{border:2px solid #005eb8;border-radius:16px;padding:22px;background:linear-gradient(180deg,#eff6ff,#fff);margin-bottom:16px}
.gp-campaign-name{font-size:26px;font-weight:900;margin:0 0 12px;color:#0f172a}
.gp-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.gp-pill{font-size:10px;font-weight:800;padding:5px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}
.gp-pill.priority-high{background:#fef3c7;color:#92400e}
.gp-pill.priority-medium{background:#dbeafe;color:#1e40af}
.gp-pill.priority-low{background:#f1f5f9;color:#475569}
.gp-pill.confidence-high{background:#dcfce7;color:#166534}
.gp-pill.confidence-medium{background:#e0e7ff;color:#3730a3}
.gp-pill.confidence-low{background:#fce7f3;color:#9d174d}
.gp-pill.source{background:#eff6ff;color:#1e40af;text-transform:none;font-size:11px}
.gp-evidence-list{margin:0;padding:0;list-style:none}
.gp-evidence-item{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fafbfc}
.gp-evidence-item label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b;margin-bottom:4px}
.gp-evidence-item strong{display:block;font-size:14px;color:#0f172a;margin-bottom:4px}
.gp-evidence-item p{margin:0;font-size:13px;color:#475569;line-height:1.5}
.gp-output-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:12px}
.gp-output-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
.gp-output-card strong{display:block;font-size:22px;font-weight:900;color:#0f172a}
.gp-output-card span{font-size:11px;color:#64748b;font-weight:700}
.gp-benefits{margin:0;padding-left:18px;font-size:14px;color:#334155;line-height:1.7}
.gp-alt{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fff}
.gp-alt h4{margin:0 0 6px;font-size:15px}
.gp-readiness{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.gp-ready-item{border:1px solid #e2e8f0;border-radius:10px;padding:12px;font-size:13px}
.gp-ready-item.complete{border-color:#bbf7d0;background:#f0fdf4}
.gp-ready-item.incomplete{border-color:#fed7aa;background:#fff7ed}
.gp-ready-item strong{display:block;font-size:13px;margin-bottom:4px}
.gp-ready-item span{font-size:12px;color:#64748b}
.gp-cta-band{margin-top:20px;padding:22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.gp-empty{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:18px;font-size:13px;color:#64748b}
.gp-section-note{font-size:13px;color:#64748b;margin:0 0 14px}
.gp-select-label{display:block;font-size:12px;font-weight:800;color:#334155;margin:0 0 8px}
.gp-select{width:100%;max-width:440px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:700;color:#0f172a;background:#fff}
.gp-select-actions{margin-top:16px}
.gp-pill.selected{background:#dbeafe;color:#1e40af;letter-spacing:.06em}
.gp-fact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:14px 0 8px}
.gp-fact{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:14px}
.gp-fact strong{display:block;font-size:22px;font-weight:900;color:#fff}
.gp-fact span{display:block;font-size:11px;font-weight:700;color:#dbeafe;text-transform:uppercase;letter-spacing:.04em;margin-top:4px}
.gp-output-card em{display:block;font-size:10px;font-style:normal;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.gp-error{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:10px 12px;font-size:13px;margin:0 0 14px}`;
}

function priorityPill(priority: string): string {
  return `<span class="gp-pill priority-${esc(priority)}">${esc(priority)} priority</span>`;
}

function confidencePill(confidence: string): string {
  return `<span class="gp-pill confidence-${esc(confidence)}">${esc(confidence)} confidence</span>`;
}

function renderExecutiveSummary(
  summary: GrowthPlanIntelligence["executiveSummary"],
  platform: "local" | "national" = "local",
  mode: "full" | "position-only" = "full",
): string {
  return `<div class="gp-hero">
<h2>Your current position</h2>
<p><strong>Current position:</strong> ${esc(customerCopy(summary.currentPosition, platform))}</p>
${
  mode === "position-only"
    ? ""
    : `<p><strong>Primary opportunity:</strong> ${esc(customerCopy(summary.primaryOpportunity, platform))}</p>
<p><strong>Why this campaign:</strong> ${esc(customerCopy(summary.whyRecommended, platform))}</p>
<p><strong>What you gain:</strong> ${esc(customerCopy(summary.estimatedBusinessBenefit, platform))}</p>`
}
</div>`;
}

function campaignConfidenceIsSupported(campaign: GrowthEngineCampaignRecommendation): boolean {
  const blob = campaign.evidence.map((e) => `${e.headline} ${e.detail}`).join(" ");
  if (/organic visibility[:\s]+unavailable/i.test(blob)) return false;
  const sources = new Set(campaign.evidence.map((e) => e.source));
  const onlyGapSignals =
    campaign.evidence.every(
      (e) =>
        e.source === "Business Profile" ||
        e.source === "Generated Content" ||
        /query volume/i.test(`${e.headline} ${e.detail}`),
    ) && !sources.has("Website Intelligence");
  if (onlyGapSignals) return false;
  return campaign.confidence === "high";
}

function presentCampaign(campaign: GrowthEngineCampaignRecommendation): GrowthEngineCampaignRecommendation {
  if (campaign.confidence === "high" && !campaignConfidenceIsSupported(campaign)) {
    return { ...campaign, confidence: "medium" };
  }
  return campaign;
}

function renderSelectedPosition(view: ReturnType<typeof buildGrowthPlanCommercialView>): string {
  return `<div class="gp-hero">
<h2>Your current position</h2>
<div class="gp-fact-grid">${view.facts
    .map((f) => `<div class="gp-fact"><strong>${esc(f.value)}</strong><span>${esc(f.label)}</span></div>`)
    .join("")}</div>
<p><strong>Selected campaign priority:</strong> ${esc(view.selectedPriority)}</p>
</div>`;
}

function renderSelectedCampaignCard(view: ReturnType<typeof buildGrowthPlanCommercialView>): string {
  return `<div class="ge-panel">
<h2>Your selected campaign priority</h2>
<div class="gp-campaign">
<h3 class="gp-campaign-name">${esc(view.serviceName)}</h3>
<div class="gp-badges"><span class="gp-pill selected">Customer selected</span></div>
<p style="margin:0;font-size:14px;color:#334155;line-height:1.55">${esc(view.selectedSupportCopy)}</p>
</div>
</div>`;
}

function renderOpportunityEvidence(cards: ReturnType<typeof buildGrowthPlanCommercialView>["evidenceCards"]): string {
  if (!cards.length) return "";
  return `<div class="ge-panel">
<h2>Why this campaign is an opportunity</h2>
<p class="gp-section-note">Recorded findings that show where patients may miss this service today, and where a focused campaign can help.</p>
<ul class="gp-evidence-list">${cards
    .map(
      (c) => `<li class="gp-evidence-item">
<label>${esc(c.category)}</label>
<strong>${esc(c.headline)}</strong>
<p>${esc(c.detail)}</p>
</li>`,
    )
    .join("")}</ul>
</div>`;
}

function renderProposedPackage(view: ReturnType<typeof buildGrowthPlanCommercialView>): string {
  const total = view.packageItems.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  return `<div class="ge-panel">
<h2>Your proposed campaign package</h2>
<p class="gp-section-note">${esc(view.packageCopy)}</p>
<div class="gp-output-grid">${view.packageItems
    .map(
      (c) => `<div class="gp-output-card"><em>Proposed</em><strong>${c.count}</strong><span>${esc(c.label)}</span></div>`,
    )
    .join("")}</div>
<p class="gp-section-note" style="margin-top:16px"><strong>${total} marketing assets</strong></p>
</div>`;
}

function renderExpectedBenefits(view: ReturnType<typeof buildGrowthPlanCommercialView>): string {
  return `<div class="ge-panel">
<h2>Expected campaign benefits</h2>
<p class="gp-section-note">${esc(view.benefitsCopy)}</p>
<ul class="gp-benefits">${view.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
</div>`;
}

function renderWhyCampaign(evidence: CampaignEvidence[]): string {
  const actionable = evidence.filter((e) => e.source !== "Business Profile" || evidence.length === 1);
  const items = actionable.length ? actionable : evidence;

  if (!items.length) {
    return `<div class="ge-panel">
<h2>Why This Campaign?</h2>
<div class="gp-empty">Evidence will appear here once earlier workflow steps are complete.</div>
</div>`;
  }

  return `<div class="ge-panel">
<h2>Why This Campaign?</h2>
<p class="gp-section-note">Every point below comes from your pharmacy profile, website report, local market comparison, and Google Business Profile — nothing is invented.</p>
<ul class="gp-evidence-list">${items
    .map(
      (e) => `<li class="gp-evidence-item">
<label>${esc(customerEvidenceSource(e.source))}</label>
<strong>${esc(customerCopy(e.headline))}</strong>
<p>${esc(customerCopy(e.detail))}</p>
</li>`,
    )
    .join("")}</ul>
</div>`;
}

function renderWhatWillBeBuilt(outputs: GrowthEngineCampaignRecommendation["estimatedOutputs"] | null): string {
  if (!outputs) {
    return `<div class="ge-panel">
<h2>What Will Be Built?</h2>
<div class="gp-empty">Output estimates appear when a campaign is recommended. Counts match the benchmark content generator configuration.</div>
</div>`;
  }

  const cards = [
    { label: "Service Page", count: outputs.servicePage },
    { label: "Cluster Pages", count: outputs.clusterPages },
    { label: "Patient Guides", count: outputs.patientGuides },
    { label: "Blogs", count: outputs.blogs },
    { label: "FAQs", count: outputs.faqs },
    { label: "GBP Posts", count: outputs.gbpPosts },
    { label: "Social Posts", count: outputs.socialPosts },
    { label: "Emails", count: outputs.emails },
    { label: "Videos", count: outputs.videos },
    { label: "Landing Pages", count: outputs.landingPages },
  ];

  return `<div class="ge-panel">
<h2>What Will Be Built?</h2>
<p class="gp-section-note">Estimated content from your Growth Cycle plan — based on your selected services and target areas.</p>
<div class="gp-output-grid">${cards
    .map((c) => `<div class="gp-output-card"><strong>${c.count}</strong><span>${esc(c.label)}</span></div>`)
    .join("")}</div>
</div>`;
}

function renderEstimatedOutcome(benefits: string[]): string {
  if (!benefits.length) {
    return `<div class="ge-panel">
<h2>Estimated Outcome</h2>
<div class="gp-empty">Outcomes appear once a campaign recommendation is confirmed.</div>
</div>`;
  }
  return `<div class="ge-panel">
<h2>Estimated Outcome</h2>
<p class="gp-section-note">Business outcomes only — we do not predict search rankings.</p>
<ul class="gp-benefits">${benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
</div>`;
}

function renderAlternatives(alternatives: CampaignAlternative[]): string {
  if (!alternatives.length) {
    return `<div class="ge-panel">
<h2>Alternative Campaigns</h2>
<div class="gp-empty">No alternative campaigns with sufficient evidence right now.</div>
</div>`;
  }

  return `<div class="ge-panel">
<h2>Alternative Campaigns</h2>
<p class="gp-section-note">Up to three alternatives — each with evidence, but not selected as the first priority.</p>
${alternatives
    .map(
      (a) => `<div class="gp-alt">
<h4>${esc(a.campaignName)}</h4>
<div class="gp-badges" style="margin-bottom:8px">${priorityPill(a.priority)}${confidencePill(a.confidence)}</div>
<p style="margin:0 0 6px;font-size:13px"><strong>Reason:</strong> ${esc(a.reason)}</p>
<p style="margin:0;font-size:13px;color:#64748b"><strong>Why not first:</strong> ${esc(a.whyNotFirst)}</p>
</div>`,
    )
    .join("")}
</div>`;
}

function pharmacyRoute(slug: string): string {
  return `/api/growth-engine/business-intelligence?slug=${encodeURIComponent(slug)}`;
}

function localReadinessStatusLine(items: CampaignReadinessItem[], ready: boolean): string {
  if (ready) return "Ready to Generate";
  const pharmacy = items.find((r) => r.id === "business-profile");
  if (pharmacy && !pharmacy.complete) return "Complete your pharmacy details to continue";
  const website = items.find((r) => r.id === "website");
  if (website && !website.complete) return "Complete Your Website Report to continue";
  const market = items.find((r) => r.id === "local-healthcare");
  if (market && !market.complete) return "Complete Your Local Market to continue";
  const evidence = items.find((r) => r.id === "growth-intelligence");
  if (evidence && !evidence.complete) return "Review the campaign evidence to continue";
  const generator = items.find((r) => r.id === "generator");
  if (generator && !generator.complete) return "Content creation is not yet available for this service";
  return "Complete the remaining steps below to continue";
}

function localReadinessNote(items: CampaignReadinessItem[], ready: boolean): string {
  if (ready) return "All prerequisites are complete — you can generate this campaign.";
  const pharmacy = items.find((r) => r.id === "business-profile");
  if (pharmacy && !pharmacy.complete) {
    return "Finish the remaining pharmacy details before campaign approval or content generation.";
  }
  return "Complete the remaining steps below before campaign approval or content generation.";
}

function renderReadiness(
  items: CampaignReadinessItem[],
  ready: boolean,
  platform: "local" | "national" = "local",
  lifecycle?: GrowthPlanLifecyclePresentation,
): string {
  const useLifecycle = platform === "local" && lifecycle && lifecycle.kind !== "blocked";
  const status =
    platform === "national"
      ? ready
        ? "Ready to Generate"
        : "Strategy recommendation — generation not implemented"
      : useLifecycle
        ? lifecycle.readinessStatus
        : localReadinessStatusLine(items, ready);
  const note =
    platform === "national"
      ? "National strategy readiness uses persisted commercial intelligence. Local pharmacy steps are not required."
      : useLifecycle
        ? lifecycle.readinessNote
        : localReadinessNote(items, ready);
  const emphasisReady = useLifecycle
    ? lifecycle.kind === "ready-to-generate" || lifecycle.kind === "ready-to-generate-next"
    : ready;
  const statusColor =
    lifecycle?.kind === "existing-exhausted" ? "#0f172a" : emphasisReady ? "#166534" : "#9a3412";
  return `<div class="ge-panel" id="campaign-readiness">
<h2>Campaign Readiness</h2>
<p class="gp-section-note">${esc(note)}</p>
<div class="gp-readiness">${items
    .map(
      (r) => `<div class="gp-ready-item ${r.complete ? "complete" : "incomplete"}">
<strong>${r.complete ? "✓" : "○"} ${esc(customerReadinessLabelForPlatform(platform, r.label, r.complete))}</strong>
<span>${esc(platform === "local" ? customerCopy(r.detail) : r.detail)}</span>
</div>`,
    )
    .join("")}
<p style="margin-top:14px;font-size:14px;font-weight:800;color:${statusColor}">${esc(status)}</p>
</div>`;
}

function renderBlockedGenerateCta(slug: string, items: CampaignReadinessItem[]): string {
  const pharmacyIncomplete = items.some((r) => r.id === "business-profile" && !r.complete);
  const websiteIncomplete = items.some((r) => r.id === "website" && !r.complete);
  const marketIncomplete = items.some((r) => r.id === "local-healthcare" && !r.complete);
  let href = `#campaign-readiness`;
  let label = "Review Campaign Details";
  let note = "Campaign approval and content generation stay unavailable until the remaining readiness steps are complete.";
  if (pharmacyIncomplete) {
    href = pharmacyRoute(slug);
    label = "Complete Your Pharmacy";
    note = "Complete Your Pharmacy before campaign approval or content generation.";
  } else if (websiteIncomplete) {
    href = `/api/growth-engine/website-intelligence?slug=${encodeURIComponent(slug)}`;
    label = "Complete Your Website Report";
    note = "Complete Your Website Report before campaign approval or content generation.";
  } else if (marketIncomplete) {
    href = `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`;
    label = "Complete Your Local Market";
    note = "Complete Your Local Market before campaign approval or content generation.";
  }
  return `<div class="ge-panel">
<h2>Build Your Campaign</h2>
<p class="gp-section-note">${esc(note)}</p>
<div class="gp-cta-band">
<a class="ge-btn ge-btn-primary" href="${esc(href)}">${esc(label)}</a>
<a class="ge-btn ge-btn-ghost" href="#campaign-readiness">Review Campaign Details</a>
</div>
</div>`;
}

function renderApprovePlanForm(slug: string, show: boolean): string {
  if (!show) return "";
  return `<form method="post" action="/api/growth-engine/${esc(slug)}/acknowledge/growth-plan" style="margin-top:16px">
<button type="submit" class="ge-btn ge-btn-ghost">Approve plan &amp; continue →</button>
</form>`;
}

function renderExistingCampaignManagementLinks(slug: string, serviceId: string): string {
  const nav = buildPlatformNavItems(slug, serviceId);
  const dashboard = nav.find((item) => item.id === "platform-dashboard") || {
    label: "Dashboard",
    url: `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`,
  };
  const review = nav.find((item) => item.id === "authority");
  const publish = nav.find((item) => item.id === "publishing");
  const reviewUrl = serviceId ? reviewCentreUrl(slug, serviceId) : review?.url;
  const links = [
    `<a class="ge-btn ge-btn-primary" href="${esc(dashboard.url)}">Open Dashboard</a>`,
    reviewUrl ? `<a class="ge-btn ge-btn-ghost" href="${esc(reviewUrl)}">Content Review</a>` : "",
    publish ? `<a class="ge-btn ge-btn-ghost" href="${esc(publish.url)}">Ready To Publish</a>` : "",
  ].filter(Boolean);
  return `<div class="gp-cta-band">${links.join("")}</div>`;
}

function renderGenerateNextButton(
  slug: string,
  programme: NonNullable<ReturnType<typeof buildAuthoritativeCampaignProgramme>>,
  nextServiceName?: string | null,
  showInitialPlanApproval = false,
): string {
  const nextNote = nextServiceName
    ? `Generate Next Campaign will create ${nextServiceName}. It will not regenerate an existing campaign.`
    : "Next campaign is selected from the tenant-enabled registered-service queue. Generate Next Campaign calls the Product Owner workflow with tenant + intent only.";
  return `<div class="ge-panel">
<h2>Build Your Campaign</h2>
<p class="gp-section-note">${esc(nextNote)}</p>
<div class="gp-cta-band">
<button type="button" class="ge-btn ge-btn-primary" id="gpGenerateNext" data-api="${esc(programme.generateNextApiPath)}" data-tenant="${esc(programme.slug)}" data-intent="${esc(programme.generateNextIntent)}">Generate Next Campaign</button>
<a class="ge-btn ge-btn-ghost" href="/api/growth-engine/dashboard?slug=${esc(slug)}">Open Dashboard</a>
</div>
<p id="gpGenerateNextMsg" style="font-size:13px;color:#64748b;margin-top:10px">Tenant + intent only — no manual service, area, content, or bank fields.</p>
<script>
(function(){
  const btn=document.getElementById('gpGenerateNext');
  if(!btn)return;
  btn.addEventListener('click', async function(){
    const msg=document.getElementById('gpGenerateNextMsg');
    btn.disabled=true;
    try{
      const res=await fetch(btn.getAttribute('data-api'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tenantSlug:btn.getAttribute('data-tenant'),intent:btn.getAttribute('data-intent')})});
      const json=await res.json();
      if(!json.ok) throw new Error(json.error||'Failed');
      location.href='/api/growth-engine/dashboard?slug='+encodeURIComponent(${JSON.stringify(slug)});
    }catch(e){if(msg)msg.textContent=e.message;btn.disabled=false;}
  });
})();
</script>
${renderApprovePlanForm(slug, showInitialPlanApproval)}
</div>`;
}

function renderGenerateCta(
  slug: string,
  campaign: GrowthEngineCampaignRecommendation | null,
  ready: boolean,
  programme: ReturnType<typeof buildAuthoritativeCampaignProgramme> | undefined,
  items: CampaignReadinessItem[] = [],
  lifecycle?: GrowthPlanLifecyclePresentation,
  selectedServiceId?: string | null,
): string {
  if (!ready || lifecycle?.kind === "blocked") {
    return renderBlockedGenerateCta(slug, items);
  }
  if (lifecycle?.kind === "existing-exhausted") {
    return `<div class="ge-panel">
<h2>Build Your Campaign</h2>
<p class="gp-section-note">${esc(lifecycle.exhaustedMessage || "No next approved registered-service campaign is available")}</p>
${renderExistingCampaignManagementLinks(slug, String(selectedServiceId || campaign?.serviceId || ""))}
</div>`;
  }
  if (lifecycle?.kind === "ready-to-generate-next" && programme && lifecycle.showGenerateNext) {
    return renderGenerateNextButton(slug, programme, lifecycle.generateNextServiceName, false);
  }
  const next = programme?.nextCampaign;
  if (next && programme && (lifecycle?.showGenerateNext || !lifecycle)) {
    return renderGenerateNextButton(
      slug,
      programme,
      lifecycle?.generateNextServiceName || next.serviceName,
      Boolean(lifecycle?.showInitialPlanApproval),
    );
  }
  const builderUrl = `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}`;
  const primaryDisabled = !campaign || !ready;
  const primaryAttrs = primaryDisabled ? ' aria-disabled="true" style="opacity:.55;pointer-events:none"' : "";

  return `<div class="ge-panel">
<h2>Build Your Campaign</h2>
<p class="gp-section-note">Use Campaign Builder to see exactly what will be created before generation starts.</p>
${!campaign ? `<div class="gp-empty" style="margin-bottom:14px">Select and complete earlier workflow steps to unlock an evidence-backed campaign recommendation.</div>` : ""}
<div class="gp-cta-band">
<a class="ge-btn ge-btn-primary" href="${esc(builderUrl)}"${primaryAttrs}>Open Campaign Builder →</a>
<a class="ge-btn ge-btn-ghost" href="#campaign-readiness">Review Campaign Details</a>
</div>
${renderApprovePlanForm(slug, Boolean(lifecycle?.showInitialPlanApproval ?? campaign))}
</div>`;
}

function metric(label: string, value: unknown): string {
  const text = value == null || value === "" ? "Not available" : String(value);
  return `<div class="gp-ready-item complete"><strong>${esc(label)}</strong><span>${esc(text)}</span></div>`;
}

function renderNationalPrimary(rec: NationalPrimaryRecommendation): string {
  return `<div class="ge-panel">
<h2>Recommended national commercial action</h2>
<p class="gp-section-note">Authoritative recommendation from persisted Growth Plan Intelligence. Gap evidence is not upgraded.</p>
<div class="gp-campaign">
<h3 class="gp-campaign-name">${esc(rec.title)}</h3>
<div class="gp-badges">${priorityPill(rec.priority.toLowerCase())}${confidencePill(rec.confidence.toLowerCase())}<span class="gp-pill source">${esc(rec.growthPlanRole)}</span><span class="gp-pill source">${esc(rec.marketScope)}</span></div>
<p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.55"><strong>Why:</strong> ${esc(rec.rationale)}</p>
<div class="gp-readiness">
${metric("Action type", rec.actionType)}
${metric("Primary keyword", rec.primaryKeyword)}
${metric("Supporting keywords", rec.supportingKeywords.length ? rec.supportingKeywords.join(", ") : "None")}
${metric("Combined search demand", rec.combinedSearchDemand)}
${metric("Priority", rec.priority)}
${metric("Market scope", rec.marketScope)}
${metric("Gap evidence", `${rec.gapEvidenceStatus} / ${rec.gapConfidence}`)}
${metric("Classification confidence", rec.confidence)}
${metric("Competitor signals", rec.competitorCount)}
${metric("Best competitor", rec.bestCompetitorDomain)}
${metric("Best competitor position", rec.bestCompetitorPosition)}
${metric("Winning URL", rec.bestRankingUrl)}
</div>
</div>
</div>`;
}

function renderNationalServices(view: NationalGrowthPlanView): string {
  if (!view.commercialServices.length) {
    return `<div class="ge-panel"><h2>Commercial services</h2><div class="gp-empty">No project commercial services configured.</div></div>`;
  }
  return `<div class="ge-panel">
<h2>${esc(view.businessName)} commercial services</h2>
<p class="gp-section-note">These are the digital-growth services this national business sells. They are not patient-facing pharmacy services.</p>
<div class="gp-readiness">${view.commercialServices
    .map(
      (s) => `<div class="gp-ready-item complete"><strong>${esc(s.serviceName)}</strong><span>${esc(s.serviceId)}${s.href ? ` · ${esc(s.href)}` : ""}</span></div>`,
    )
    .join("")}</div>
</div>`;
}

function renderNationalPlanBody(view: NationalGrowthPlanView): string {
  const copy = growthEnginePlatformCopy("national");
  const primary = view.primary;
  const alt = view.alternatives.length
    ? view.alternatives
        .map(
          (a) => `<div class="gp-alt">
<h4>${esc(a.title)}</h4>
<div class="gp-badges">${priorityPill(a.priority.toLowerCase())}${confidencePill(a.confidence.toLowerCase())}</div>
<p style="margin:0 0 6px;font-size:13px"><strong>Keyword:</strong> ${esc(a.primaryKeyword)}</p>
<p style="margin:0;font-size:13px;color:#64748b"><strong>Gap evidence:</strong> ${esc(a.gapEvidenceStatus)} / ${esc(a.gapConfidence)} — not selected first because ${esc(primary?.primaryKeyword || "the primary action")} has a stronger existing score.</p>
</div>`,
        )
        .join("")
    : `<div class="gp-empty">No alternative eligible national actions in the persisted snapshot.</div>`;

  return `${renderExecutiveSummary(view.executiveSummary, "national")}
${primary ? renderNationalPrimary(primary) : `<div class="ge-panel"><h2>Recommended national commercial action</h2><div class="gp-empty">${esc(copy.emptyCampaignNote)}</div></div>`}
${renderNationalServices(view)}
<div class="ge-panel">
<h2>Why this action?</h2>
<p class="gp-section-note">Evidence is copied from persisted GP-01 intelligence. Classification and gap confidence are kept separate.</p>
${
  primary
    ? `<ul class="gp-evidence-list">${primary.evidenceReasons
        .map((r) => `<li class="gp-evidence-item"><strong>${esc(r)}</strong><p>Source: persisted national Growth Plan Intelligence. Gap evidence status ${esc(primary.gapEvidenceStatus)} remains ${esc(primary.gapConfidence)} confidence.</p></li>`)
        .join("")}</ul>`
    : `<div class="gp-empty">No primary national action to evidence.</div>`
}
</div>
<div class="ge-panel">
<h2>Estimated outcome</h2>
<p class="gp-section-note">Strategy only — no pages are generated here, and gap evidence is not upgraded.</p>
<ul class="gp-benefits"><li>${esc(view.executiveSummary.estimatedBusinessBenefit)}</li><li>${esc(primary?.recommendedNextStep || "Use this as a structured Growth Plan candidate.")}</li></ul>
</div>
<div class="ge-panel">
<h2>Alternative national actions</h2>
${alt}
</div>
${renderReadiness(view.readiness, false, "national")}
<div class="ge-panel">
<h2>Campaign strategy</h2>
<p class="gp-section-note">National commercial content generation is not yet implemented. This plan does not open the patient-service Campaign Builder.</p>
<div class="gp-cta-band">
<span class="ge-btn ge-btn-primary" aria-disabled="true" style="opacity:.7;pointer-events:none">${esc(copy.generateCta)}</span>
<a class="ge-btn ge-btn-ghost" href="#campaign-readiness">Review evidence</a>
</div>
<div class="gp-empty" style="margin-top:14px">Bounded state: recommendation ready${view.strategyReady ? "" : " once persisted intelligence contains an eligible action"}; patient-service generation is not the next step.</div>
</div>`;
}

function renderCampaignSelectionPanel(
  slug: string,
  services: Array<{ serviceId: string; serviceName: string }>,
  error?: string,
): string {
  const options = [
    `<option value="" selected disabled>Select a service</option>`,
    ...services.map((s) => `<option value="${esc(s.serviceId)}">${esc(s.serviceName)}</option>`),
  ].join("");
  return `<div class="ge-panel">
<h2>Choose your campaign priority</h2>
<p class="gp-section-note">Select the service you want PharmaConnect to prioritise. We will use your pharmacy, website and local-market evidence to prepare the campaign plan.</p>
${error ? `<p class="gp-error">${esc(error)}</p>` : ""}
<form method="post" action="/api/growth-engine/growth-plan?slug=${esc(slug)}">
<label class="gp-select-label" for="gpPriorityService">Service to prioritise</label>
<select class="gp-select" id="gpPriorityService" name="serviceId" required>
${options}
</select>
<div class="gp-select-actions">
<button type="submit" class="ge-btn ge-btn-primary">Prepare my campaign plan</button>
</div>
</form>
</div>`;
}

function renderLocalPlanBody(slug: string, plan: GrowthPlanIntelligence, selectionError?: string): string {
  const programme = buildAuthoritativeCampaignProgramme(slug);
  const selectedServiceId = resolveAuthoritativeCampaignPriority(slug);
  const selectedPlan = selectedServiceId ? buildGrowthPlanForSelectedService(slug, selectedServiceId) : null;
  const campaign = selectedPlan ? presentCampaign(selectedPlan.campaign) : null;

  if (!campaign) {
    const services = listEnabledPharmacyServices(slug);
    return `${renderExecutiveSummary(plan.executiveSummary, "local", "position-only")}
${renderCampaignSelectionPanel(slug, services, selectionError)}`;
  }

  const ready = Boolean(campaign) && selectedPlan.readyToGenerate;
  const lifecycle = resolveGrowthPlanLifecyclePresentation({
    prerequisitesReady: ready,
    selectedServiceId,
    selectedServiceName: campaign.campaignName,
    selectedServiceHasExistingCampaign: selectedServiceId ? tenantHasExistingCampaign(slug, selectedServiceId) : false,
    nextServiceId: programme.nextCampaign?.serviceId,
    nextServiceName: programme.nextCampaign?.serviceName,
    exhausted: programme.exhausted,
    exhaustedMessage: programme.exhaustedMessage,
  });
  const view = buildGrowthPlanCommercialView(slug, campaign);
  return `${renderSelectedPosition(view)}
${renderSelectedCampaignCard(view)}
${renderOpportunityEvidence(view.evidenceCards)}
${renderProposedPackage(view)}
${renderExpectedBenefits(view)}
${renderReadiness(selectedPlan.readiness, ready, "local", lifecycle)}
${renderGenerateCta(slug, campaign, ready, programme, selectedPlan.readiness, lifecycle, selectedServiceId)}`;
}

export function renderGrowthPlanV1Page(
  slug: string,
  options?: { prevUrl?: string; nextUrl?: string; selectionError?: string },
): string {
  const framework = buildGrowthEngineFramework(slug);
  const resolved = resolveGrowthPlan(slug);
  const copy = growthEnginePlatformCopy(resolved.platform);
  const body =
    resolved.platform === "national"
      ? renderNationalPlanBody(resolved.plan)
      : renderLocalPlanBody(slug, resolved.plan, options?.selectionError);

  const continueCta =
    resolved.platform === "national"
      ? { nextUrl: options?.nextUrl || framework.steps.find((s) => s.id === "generate")?.url || null, nextLabel: "Campaign strategy note →" }
      : resolveGrowthPlanContinueCta(framework);

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Growth Plan · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
${platformPlatformNavCss()}
${growthPlanPageCss()}
</style>
</head>
<body data-slug="${esc(slug)}" data-growth-platform="${esc(resolved.platform)}">
<header style="background:${commercialBlueChromeGradientCss()};color:#fff;padding:16px 24px">
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1>Your Growth Plan</h1>
<p>${esc(copy.planStepSubtitle)}</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "growth-plan", {
  prevUrl: options?.prevUrl || framework.steps.find((s) => s.id === "website-intelligence")?.url,
  nextUrl: continueCta.nextUrl || undefined,
  nextLabel: continueCta.nextLabel || undefined,
})}
${body}
</div>
</body></html>`);
}
