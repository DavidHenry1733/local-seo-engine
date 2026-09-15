/**
 * Campaign Recommendation Intelligence V1 — premium consultation panel renderer.
 */
import type { CampaignRecommendationIntelligence } from "./growthEngineCampaignRecommendationIntelligenceModel.ts";
import { campaignRecommendationIntelligenceCss } from "./growthEngineCampaignRecommendationIntelligenceCss.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function renderStars(count: number): string {
  return "★".repeat(count) + "☆".repeat(Math.max(0, 5 - count));
}

function levelClass(level: string): string {
  if (level === "Excellent") return "excellent";
  if (level === "Good") return "good";
  return "needs";
}

export function renderCampaignRecommendationIntelligencePanel(
  intel: CampaignRecommendationIntelligence,
): string {
  const evidenceHtml = intel.evidenceCards
    .map(
      (card) => `<div class="cri-evidence-card">
<span class="cri-evidence-check">✓</span>
<div>
<strong>${esc(card.label)}</strong>
<p>${esc(card.detail)}</p>
</div>
</div>`,
    )
    .join("");

  const positionHtml = intel.currentPosition
    .map(
      (row) => `<div class="cri-position-row">
<span>${esc(row.label)}</span>
<strong class="cri-level ${levelClass(row.level)}">${esc(row.level)}</strong>
</div>`,
    )
    .join("");

  const outcomesHtml = intel.expectedOutcomes
    .map((o) => `<li>${esc(o)}</li>`)
    .join("");

  const confidenceSources = intel.confidence.sources
    .map((s) => `<li>✓ ${esc(s)}</li>`)
    .join("");

  return `<section class="cri-panel" aria-label="Campaign recommendation intelligence">
<div class="cri-section">
<h3>${esc(intel.whyRecommendTitle)}</h3>
<p class="cri-lead">${esc(intel.whyNow)}</p>
<div class="cri-evidence-grid">${evidenceHtml}</div>
</div>

<div class="cri-section">
<h3>Current visibility</h3>
<div class="cri-position-card">${positionHtml}</div>
</div>

<div class="cri-section">
<h3>What this campaign is designed to achieve</h3>
<ul class="cri-outcomes">${outcomesHtml}</ul>
</div>

<div class="cri-section cri-summary">
<h3>Campaign summary</h3>
<div class="cri-summary-grid">
<div><span>Campaign</span><strong>${esc(intel.summary.campaignName)}</strong></div>
<div><span>Reason selected</span><strong>${esc(intel.summary.reasonSelected)}</strong></div>
<div><span>Marketing content to create</span><strong>${intel.summary.assetsToCreate} pieces</strong></div>
<div><span>Estimated build time</span><strong>${esc(intel.summary.estimatedBuildTime)}</strong></div>
</div>
<p class="cri-tagline">${esc(intel.summary.tagline)}</p>
</div>

<div class="cri-section cri-confidence">
<h3>Recommendation Confidence</h3>
<div class="cri-confidence-stars">${renderStars(intel.confidence.stars)}</div>
<p class="cri-confidence-level">${esc(intel.confidence.level)}</p>
${intel.confidence.sources.length ? `<p class="cri-confidence-based">Based on:</p><ul class="cri-confidence-sources">${confidenceSources}</ul>` : ""}
</div>

<div class="cri-section cri-next">
<h3>What's next</h3>
<p class="cri-lead">${esc(intel.whatsNext)}</p>
</div>
</section>`;
}

export function campaignRecommendationIntelligenceStyles(): string {
  return campaignRecommendationIntelligenceCss();
}
