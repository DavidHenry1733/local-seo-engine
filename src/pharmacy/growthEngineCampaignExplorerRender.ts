/**
 * Campaign Explorer V1 — choose-step explorer panel renderer.
 */
import type { CampaignExplorerCatalog, CampaignExplorerItem } from "./growthEngineCampaignExplorerModel.ts";
import { CE_DETECTED_ON_WEBSITE, CE_EXPLORE_DETAIL, CE_SELECT_CAMPAIGN, CE_CURRENTLY_SELECTED } from "./growthEngineCampaignExplorerModel.ts";
import { explorerSections } from "./growthEngineCampaignExplorerService.ts";
import { campaignExplorerCss } from "./growthEngineCampaignExplorerCss.ts";
import { WEBSITE_IMPORT_SERVICE_SOURCE_FIELD } from "./growthEngineCampaignExplorerWebsiteServices.ts";

import { campaignBuilderWizardUrl } from "./growthEngineCampaignBuilderRoutingService.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function badgeClass(type: CampaignExplorerItem["badgeType"]): string {
  if (type === "existing") return "existing";
  if (type === "growth-opportunity") return "growth";
  if (type === "nhs") return "nhs";
  return "private";
}

function badgeEmoji(type: CampaignExplorerItem["badgeType"]): string {
  if (type === "existing") return "🟢";
  if (type === "growth-opportunity") return "🟠";
  return "";
}

function renderExplorerCard(slug: string, item: CampaignExplorerItem, currentlySelectedId: string): string {
  const emoji = badgeEmoji(item.badgeType);
  const detectedNote =
    item.detectedOnWebsite && item.badgeType !== "existing"
      ? `<p class="ce-detected-note">${esc(CE_DETECTED_ON_WEBSITE)}</p>`
      : "";
  const selected = item.serviceId === currentlySelectedId;
  const action = selected
    ? `<span class="ce-select" aria-current="true">${esc(CE_CURRENTLY_SELECTED)}</span>`
    : `<a class="ce-select" href="${esc(campaignBuilderWizardUrl(slug, "areas", item.serviceId))}">${esc(CE_SELECT_CAMPAIGN)}</a>`;
  return `<div class="ce-card${selected ? " ce-card-selected" : ""}">
<h4>${esc(item.serviceName)}</h4>
<span class="ce-badge ${badgeClass(item.badgeType)}">${emoji ? `${emoji} ` : ""}${esc(selected ? CE_CURRENTLY_SELECTED : item.badgeLabel)}</span>
${detectedNote}
<p>${esc(item.description)}</p>
${action}
</div>`;
}

function renderCategory(slug: string, section: ReturnType<typeof explorerSections>[number], currentlySelectedId: string): string {
  if (section.hiddenWhenEmpty && !section.items.length) return "";
  const cards = section.items.map((item) => renderExplorerCard(slug, item, currentlySelectedId)).join("");
  const hint = section.badgeHint ? `<span class="ce-category-hint">${esc(section.badgeHint)}</span>` : "";
  const lead = section.lead ? `<p class="ce-category-lead">${esc(section.lead)}</p>` : "";
  return `<details class="ce-category"${section.id === "existing" ? " open" : ""}>
<summary><span>${esc(section.title)}</span>${hint}</summary>
${lead}
<div class="ce-category-body">${cards || `<p style="padding:8px 4px;color:#64748b;font-size:14px">No campaigns in this category yet.</p>`}</div>
</details>`;
}

export function renderCampaignExplorerPanel(slug: string, catalog: CampaignExplorerCatalog): string {
  const currentlySelectedId = catalog.recommendedServiceId;
  const sections = explorerSections(catalog)
    .map((section) => renderCategory(slug, section, currentlySelectedId))
    .filter(Boolean)
    .join("");

  return `<!-- existing-services-source: ${WEBSITE_IMPORT_SERVICE_SOURCE_FIELD} count: ${catalog.websiteImportServiceCount} -->
<div class="ce-explorer">
<h3>${esc(catalog.exploreTitle)}</h3>
<p class="ce-sub">${esc(catalog.exploreSubtitle)}</p>
<p class="ce-detail">${esc(CE_EXPLORE_DETAIL)}</p>
<div class="ce-messaging">
<strong>${esc(catalog.recommendMessage)}</strong>
${esc(catalog.controlMessage)}
</div>
${sections}
</div>`;
}

export function renderReturnToRecommendedLink(slug: string, catalog: CampaignExplorerCatalog, selectedServiceId: string): string {
  if (selectedServiceId === catalog.recommendedServiceId) return "";
  return `<a class="ce-return" href="/api/growth-engine/campaign-builder?slug=${esc(slug)}&step=choose#recommended">← Return to recommended campaign (${esc(catalog.recommendedServiceName)})</a>`;
}

export function campaignExplorerStyles(): string {
  return campaignExplorerCss();
}
