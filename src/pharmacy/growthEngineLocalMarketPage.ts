/**
 * Growth Engine — Local Market Report V2 (Commercial Intelligence).
 * Presentation layer only — live Google Places data, no invented metrics.
 */
import type { GrowthEngineCompetitor, GrowthEngineCompetitorSnapshot, GrowthEngineYourPharmacy } from "./growthEngineCompetitorModel.ts";
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import { growthEngineWorkflowCss, renderGrowthEngineNavBar } from "./growthEngineWorkflowNav.ts";
import { platformPlatformNavCss, renderPharmacyPlatformNavBar } from "./pharmacyPlatformNav.ts";
import {
  buildLocalMarketLocalContextView,
  buildLocalMarketReportView,
  sortCompetitorsByDistance,
  type LocalContextPlaceCard,
  type LocalMarketLocalContextView,
  type LocalMarketOverviewCounts,
} from "./growthEngineLocalMarketReportView.ts";
import { realGoogleCompetitors } from "./growthEngineLocalMarketAnalysis.ts";
import {
  formatLocalMarketPlacesError,
  loadProfileDataForLocalMarket,
  localMarketBranchRequired,
  profileCanRunLocalMarketDiscovery,
  resolveLocalMarketYourPharmacy,
} from "./growthEngineLocalMarketService.ts";
import { isNationalGrowthPlatform } from "./growthPlatformResolverService.ts";
import { renderNationalSearchIntelligencePage } from "./nationalSearchIntelligencePage.ts";
import {
  commercialBlueChromeGradientCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function localMarketPageCss(): string {
  return `${growthEngineWorkflowCss()}
.lmr-hero{border:2px solid #005eb8;border-radius:20px;padding:24px 26px;background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);margin-bottom:22px;box-shadow:0 10px 30px rgba(15,23,42,.06)}
.lmr-hero-label{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#005eb8;margin-bottom:10px}
.lmr-hero-name{font-size:28px;font-weight:900;margin:0 0 12px;color:#0f172a;line-height:1.2}
.lmr-badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.lmr-badge{font-size:10px;font-weight:800;text-transform:uppercase;padding:4px 10px;border-radius:999px}
.lmr-badge.imported{background:#bbf7d0;color:#065f46}
.lmr-badge.confirmed{background:#dbeafe;color:#1e40af}
.lmr-badge.review{background:#fef3c7;color:#92400e}
.lmr-badge.live{background:#ecfdf5;color:#065f46;border:1px solid #bbf7d0}
.lmr-stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin:16px 0}
.lmr-stat{background:#fff;border:1px solid #dbeafe;border-radius:14px;padding:16px;text-align:center}
.lmr-stat strong{display:block;font-size:32px;font-weight:900;color:#005eb8;line-height:1}
.lmr-stat span{display:block;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;margin-top:6px;letter-spacing:.04em}
.lmr-meta{font-size:13px;color:#475569;line-height:1.6;margin:8px 0}
.lmr-meta a{color:#005eb8;font-weight:700;text-decoration:none}
.lmr-hours{font-size:12px;color:#64748b;margin-top:12px;padding:12px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px}
.lmr-hours li{margin:4px 0}
.lmr-section{margin-bottom:22px}
.lmr-section h2{margin:0 0 6px;font-size:18px;font-weight:900}
.lmr-lead{font-size:14px;color:#64748b;margin:0 0 18px;line-height:1.65}
.lmr-overview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.lmr-overview-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:18px;text-align:center}
.lmr-overview-card strong{display:block;font-size:36px;font-weight:900;color:#0f172a}
.lmr-overview-card span{display:block;font-size:12px;color:#64748b;font-weight:700;margin-top:6px}
.lmr-compare-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:18px}
.lmr-compare-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px}
.lmr-compare-card h4{margin:0 0 10px;font-size:12px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:.04em}
.lmr-compare-row{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-bottom:8px}
.lmr-compare-row strong{font-size:22px;font-weight:900;color:#0f172a}
.lmr-compare-row span{font-size:12px;color:#64748b}
.lmr-bar{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:8px}
.lmr-bar-fill{height:100%;background:${commercialBlueChromeGradientCss()};border-radius:999px}
.lmr-bar-fill.muted{background:#94a3b8}
.lmr-comp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.lmr-comp-card{border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.04)}
.lmr-comp-name{font-size:16px;font-weight:900;margin:0 0 8px;color:#0f172a}
.lmr-comp-stats{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
.lmr-comp-stat{font-size:12px;font-weight:800;color:#334155;background:#f1f5f9;padding:6px 10px;border-radius:8px}
.lmr-comp-meta{font-size:12px;color:#64748b;line-height:1.55;margin-top:8px}
.lmr-comp-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;font-size:12px;font-weight:700}
.lmr-comp-links a{color:#005eb8;text-decoration:none}
.lmr-insight{border-left:4px solid #0f766e;background:#ecfdf5;padding:14px 16px;margin-bottom:10px;border-radius:0 12px 12px 0;font-size:14px;color:#065f46;line-height:1.55}
.lmr-action{border:1px solid #dbeafe;background:#eff6ff;padding:14px 16px;margin-bottom:10px;border-radius:12px;font-size:14px;color:#1e40af;line-height:1.55}
.lmr-action strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:4px}
.lmr-network-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.lmr-network-card{border:1px solid #e2e8f0;border-radius:14px;padding:16px;background:#fff}
.lmr-network-card h4{margin:0 0 6px;font-size:14px;font-weight:800}
.lmr-network-count{font-size:28px;font-weight:900;color:#005eb8;margin:4px 0}
.lmr-network-nearest{font-size:12px;color:#64748b;line-height:1.5}
.lmr-opportunity{background:${commercialBlueChromeGradientCss()};color:#fff;border-radius:18px;padding:24px 26px;margin:24px 0}
.lmr-opportunity h2{margin:0 0 12px;font-size:18px;color:#fff}
.lmr-opportunity p{margin:0;font-size:15px;line-height:1.7;color:#dbeafe}
.lmr-warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:14px 16px;border-radius:12px;font-size:13px;margin-bottom:18px}
.lmr-discover-panel{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(135deg,#eff6ff 0%,#ecfdf5 100%);border:2px solid #005eb8;border-radius:18px;padding:20px 22px;margin-bottom:22px;box-shadow:0 10px 30px rgba(15,23,42,.06)}
.lmr-discover-panel--loaded{border-color:#059669;background:linear-gradient(135deg,#ecfdf5 0%,#eff6ff 100%)}
.lmr-discover-panel--error{border-color:#dc2626;background:linear-gradient(135deg,#fef2f2 0%,#fff7ed 100%)}
.lmr-discover-panel-main{flex:1 1 280px;min-width:0}
.lmr-discover-title{margin:0 0 6px;font-size:20px;font-weight:900;color:#0f172a}
.lmr-discover-lead{margin:0;font-size:14px;color:#475569;line-height:1.55}
.lmr-discover-loaded-label{display:block;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#059669;margin-bottom:6px}
.lmr-discover-btn{flex:0 0 auto;padding:16px 24px;border:none;border-radius:14px;background:${commercialBlueChromeGradientCss()};color:#fff;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(0,94,184,.28);min-width:220px}
.lmr-discover-btn:hover:not(:disabled){filter:brightness(1.05)}
.lmr-discover-btn:disabled{opacity:.72;cursor:wait}
.lmr-discover-btn-secondary{background:#fff;color:#005eb8;border:2px solid #005eb8;box-shadow:none}
.lmr-discover-status{flex:1 1 100%;margin:0;font-size:13px;font-weight:700;color:#475569;line-height:1.5}
.lmr-discover-status-error{color:#991b1b}
.lmr-cta{margin-top:28px;padding:24px;background:${commercialBlueChromeGradientCss()};border-radius:16px;color:#fff;text-align:center}
.lmr-cta h3{margin:0 0 8px;font-size:18px}
.lmr-cta p{margin:0 0 16px;color:#dbeafe;font-size:14px}
.lmr-cta .ge-btn-primary{background:#fff;color:#005eb8}
.lmr-empty{font-size:13px;color:#64748b;padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px}
.lmr-local-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:0 0 14px}
.lmr-local-fact{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px}
.lmr-local-fact span{display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:4px}
.lmr-local-fact strong{display:block;font-size:14px;font-weight:800;color:#0f172a;line-height:1.35}
.lmr-area-badges{display:flex;flex-wrap:wrap;gap:8px}
.lmr-area-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;font-size:13px;font-weight:800}
.lmr-area-badge em{font-style:normal;font-size:11px;font-weight:700;color:#64748b}
.lmr-subhead{margin:14px 0 8px;font-size:13px;font-weight:800;color:#0f172a}
.lmr-network-group{margin-bottom:14px}
.lmr-network-group h3{margin:0 0 8px;font-size:14px;font-weight:800;color:#0f172a}
.lmr-place-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.lmr-place-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff}
.lmr-place-card h4{margin:0 0 4px;font-size:14px;font-weight:800;color:#0f172a}
.lmr-place-type{margin:0;font-size:12px;color:#64748b;font-weight:700;line-height:1.45}
.lmr-place-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:12px;font-weight:700}
.lmr-place-links a{color:#005eb8;text-decoration:none}`;
}

function formatCategory(label: string): string {
  if (!label) return "—";
  return label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderBadges(yours: GrowthEngineYourPharmacy | null, live: boolean): string {
  const badges: string[] = [];
  if (live) badges.push(`<span class="lmr-badge live">Live Google Places</span>`);
  if (yours?.source === "google-places") badges.push(`<span class="lmr-badge imported">Imported</span>`);
  if (yours?.businessName) badges.push(`<span class="lmr-badge confirmed">Confirmed listing</span>`);
  if (!yours?.openingHours?.length || !yours?.website) badges.push(`<span class="lmr-badge review">Needs review</span>`);
  return badges.length ? `<div class="lmr-badges">${badges.join("")}</div>` : "";
}

function renderGoogleListingAction(slug: string): string {
  const profile = loadProfileDataForLocalMarket(slug);
  const googleSnap = profile.googleImportSnapshot;
  const confirmUrl = `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(slug)}`;
  const startUrl = `/api/growth-engine/start?slug=${encodeURIComponent(slug)}`;

  if (googleSnap?.status === "needs_review" && (googleSnap.candidates?.length || 0) > 0) {
    return `We could not load your Google Business listing yet. <a href="${esc(confirmUrl)}">Review imported details</a> and select the correct Google listing.`;
  }
  if (googleSnap?.status === "imported" && String(profile.googlePlaceId || "").trim()) {
    return `Your Google listing is linked from import. Run <strong>Discover local market</strong> below to load live comparison data.`;
  }
  if (googleSnap?.importedAt) {
    return `We could not load your Google Business listing. <a href="${esc(confirmUrl)}">Review imported details</a> to confirm your Google listing.`;
  }
  return `We could not load your Google Business listing. <a href="${esc(startUrl)}">Run Google import</a> and confirm your listing.`;
}

function renderGoogleBusinessProfile(
  slug: string,
  yours: GrowthEngineYourPharmacy | null,
  snapshot: GrowthEngineCompetitorSnapshot | null,
  lastUpdated: string | null,
): string {
  const profile = loadProfileDataForLocalMarket(slug);
  const pharmacyName =
    yours?.businessName || profile.pharmacyName || profile.tradingName || snapshot?.pharmacy?.name || "Your pharmacy";
  const live = snapshot?.analysis?.dataSource === "google-places-live";

  if (!yours) {
    return `<div class="lmr-hero">
<div class="lmr-hero-label">Section 1 · Your Google Business Profile</div>
<h2 class="lmr-hero-name">${esc(pharmacyName)}</h2>
<div class="lmr-badges"><span class="lmr-badge review">Needs review</span></div>
<p class="lmr-meta" style="margin:0">${renderGoogleListingAction(slug)}</p>
${lastUpdated ? `<p class="lmr-meta" style="margin-top:12px;font-size:12px">Last updated: ${esc(new Date(lastUpdated).toLocaleString("en-GB"))}</p>` : ""}
</div>`;
  }

  const secondary = yours.secondaryCategories.slice(0, 6).map(formatCategory).join(" · ");
  const hours = yours.openingHours.length
    ? `<ul class="lmr-hours">${yours.openingHours.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
    : `<p class="lmr-meta">Opening hours not listed on Google.</p>`;

  return `<div class="lmr-hero">
<div class="lmr-hero-label">Section 1 · Your Google Business Profile</div>
<h2 class="lmr-hero-name">${esc(yours.businessName)}</h2>
${renderBadges(yours, live)}
<div class="lmr-stat-row">
<div class="lmr-stat"><strong>${yours.rating != null ? esc(yours.rating.toFixed(1)) : "—"}</strong><span>Rating</span></div>
<div class="lmr-stat"><strong>${esc(yours.reviewCount)}</strong><span>Reviews</span></div>
<div class="lmr-stat"><strong>${yours.photoCount > 0 ? esc(yours.photoCount) : "—"}</strong><span>Photos</span></div>
</div>
<p class="lmr-meta"><strong>Primary category:</strong> ${esc(formatCategory(yours.primaryCategory))}</p>
${secondary ? `<p class="lmr-meta"><strong>Also listed as:</strong> ${esc(secondary)}</p>` : ""}
${hours}
<p class="lmr-meta"><strong>Address:</strong> ${esc(yours.address)}</p>
<div class="lmr-meta">
${yours.phone ? `<a href="tel:${esc(yours.phone)}">${esc(yours.phone)}</a> · ` : ""}
${yours.website ? `<a href="${esc(yours.website)}" target="_blank" rel="noopener">Website</a> · ` : ""}
${yours.googleMapsUrl ? `<a href="${esc(yours.googleMapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ""}
</div>
${lastUpdated ? `<p class="lmr-meta" style="margin-top:14px;font-size:12px;color:#64748b">Last updated: ${esc(new Date(lastUpdated).toLocaleString("en-GB"))}</p>` : ""}
</div>`;
}

function renderOverviewCounts(counts: LocalMarketOverviewCounts, live: boolean): string {
  if (!live) {
    return `<p class="lmr-lead">Counts appear when live Google Places data is loaded.</p>`;
  }
  const items = [
    { label: "Nearby pharmacies", count: counts.pharmacies },
    { label: "GP surgeries", count: counts.gpSurgeries },
    { label: "Hospitals", count: counts.hospitals },
    { label: "Health centres", count: counts.healthCentres },
    { label: "Walk-in centres", count: counts.walkInCentres },
    { label: "Care homes", count: counts.careHomes },
    { label: "Other healthcare providers", count: counts.otherHealthcare },
  ];
  return `<p class="lmr-lead">We analysed live listings from Google Places in your area:</p>
<div class="lmr-overview-grid">${items
    .map(
      (i) => `<div class="lmr-overview-card"><strong>${i.count}</strong><span>${esc(i.label)}</span></div>`,
    )
    .join("")}</div>`;
}

function parseComparisonNumber(value: string): number | null {
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function renderProgressBar(yours: number | null, benchmark: number | null): string {
  if (yours == null || benchmark == null || benchmark <= 0) return "";
  const pct = Math.min(100, Math.round((yours / benchmark) * 100));
  return `<div class="lmr-bar"><div class="lmr-bar-fill" style="width:${pct}%"></div></div>`;
}

function renderComparisonProgress(snapshot: GrowthEngineCompetitorSnapshot | null): string {
  const rows = snapshot?.analysis?.comparisons?.filter((r) => r.hasData) || [];
  if (!rows.length) {
    return `<div class="lmr-empty">Comparison charts appear when live competitor data is available.</div>`;
  }

  return `<div class="lmr-compare-grid">${rows
    .map((r) => {
      const yours = parseComparisonNumber(r.yourPharmacy);
      const avg = parseComparisonNumber(r.competitorAverage);
      const best = parseComparisonNumber(r.highestCompetitor);
      const benchmark = best ?? avg;
      return `<div class="lmr-compare-card">
<h4>${esc(r.label)}</h4>
<div class="lmr-compare-row"><strong>${esc(r.yourPharmacy)}</strong><span>You</span></div>
${renderProgressBar(yours, benchmark)}
<div class="lmr-compare-row" style="margin-top:12px"><strong>${esc(r.competitorAverage)}</strong><span>Local average</span></div>
<div class="lmr-bar"><div class="lmr-bar-fill muted" style="width:${avg && benchmark ? Math.min(100, Math.round((avg / benchmark) * 100)) : 0}%"></div></div>
<div class="lmr-compare-row" style="margin-top:12px"><strong>${esc(r.highestCompetitor)}</strong><span>Best nearby</span></div>
</div>`;
    })
    .join("")}</div>`;
}

function renderCompetitorCard(c: GrowthEngineCompetitor): string {
  const category = formatCategory(c.primaryCategory);
  return `<div class="lmr-comp-card">
<h3 class="lmr-comp-name">${esc(c.businessName)}</h3>
<div class="lmr-comp-stats">
${c.rating != null ? `<span class="lmr-comp-stat">★ ${esc(c.rating.toFixed(1))}</span>` : ""}
<span class="lmr-comp-stat">${esc(c.reviewCount)} reviews</span>
${c.photoCount > 0 ? `<span class="lmr-comp-stat">${esc(c.photoCount)} photos</span>` : ""}
<span class="lmr-comp-stat">${esc(c.distanceLabel || "—")}</span>
</div>
<p class="lmr-comp-meta"><strong>Category:</strong> ${esc(category)}</p>
<div class="lmr-comp-links">
${c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">Website</a>` : ""}
${c.googleMapsUrl ? `<a href="${esc(c.googleMapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ""}
</div>
</div>`;
}

function renderCompetitorComparison(competitors: GrowthEngineCompetitor[], live: boolean): string {
  const pool = sortCompetitorsByDistance(realGoogleCompetitors(competitors));
  if (!pool.length) {
    return `<div class="lmr-empty">${live ? "No nearby pharmacy competitors found in Google Places." : "Discover local market to load competitor cards."}</div>`;
  }
  return `<div class="lmr-comp-grid">${pool.map(renderCompetitorCard).join("")}</div>`;
}

function renderInsightList(items: string[]): string {
  if (!items.length) return `<div class="lmr-empty">Insights appear when live Google Places comparison data is available.</div>`;
  return items.map((i) => `<div class="lmr-insight">${esc(i)}</div>`).join("");
}

function renderActionList(items: string[]): string {
  if (!items.length) return `<div class="lmr-empty">Actions appear when we have evidence from your local market data.</div>`;
  return items
    .map((a, i) => `<div class="lmr-action"><strong>Action ${i + 1}</strong>${esc(a)}</div>`)
    .join("");
}

function renderPlaceCards(cards: LocalContextPlaceCard[], category: string): string {
  if (!cards.length) {
    return `<p class="lmr-empty">No verified ${esc(category)} information is currently recorded.</p>`;
  }
  return `<div class="lmr-place-grid">${cards
    .map((card) => {
      const links = [
        card.websiteUrl ? `<a href="${esc(card.websiteUrl)}" target="_blank" rel="noopener">Website</a>` : "",
        card.mapsUrl ? `<a href="${esc(card.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `<article class="lmr-place-card">
<h4>${esc(card.name)}</h4>
<p class="lmr-place-type">${esc(card.typeLabel)}${card.distanceLabel ? ` · ${esc(card.distanceLabel)}` : ""}</p>
${links ? `<div class="lmr-place-links">${links}</div>` : ""}
</article>`;
    })
    .join("")}</div>`;
}

function renderYourLocalArea(ctx: LocalMarketLocalContextView): string {
  const facts = [
    ctx.pharmacyLocation ? ["Pharmacy location", ctx.pharmacyLocation] : null,
    ctx.primaryTown ? ["Primary town", ctx.primaryTown] : null,
    ctx.coverageRadiusLabel ? ["Coverage radius", ctx.coverageRadiusLabel] : null,
  ].filter(Boolean) as Array<[string, string]>;
  const factHtml = facts.length
    ? `<div class="lmr-local-facts">${facts
        .map(([label, value]) => `<div class="lmr-local-fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`)
        .join("")}</div>`
    : "";
  const areas = ctx.servedAreas.length
    ? `<p class="lmr-subhead">Local areas served</p>
<div class="lmr-area-badges">${ctx.servedAreas
        .map(
          (area) =>
            `<span class="lmr-area-badge">${esc(area.name)}${area.distanceLabel ? `<em>${esc(area.distanceLabel)}</em>` : ""}</span>`,
        )
        .join("")}</div>`
    : `<p class="lmr-empty">No verified local area information is currently recorded.</p>`;
  const landmarks = `<p class="lmr-subhead">Local landmarks</p>${renderPlaceCards(ctx.landmarks, "landmarks")}`;
  return `${factHtml}${areas}${landmarks}`;
}

function renderHealthcareNetwork(ctx: LocalMarketLocalContextView): string {
  return `<div class="lmr-network-group">
<h3>GP surgeries</h3>
${renderPlaceCards(ctx.gpSurgeries, "GP surgeries")}
</div>
<div class="lmr-network-group">
<h3>Health centres</h3>
${renderPlaceCards(ctx.healthCentres, "Health centres")}
</div>
<div class="lmr-network-group">
<h3>Hospitals</h3>
${renderPlaceCards(ctx.hospitals, "Hospitals")}
</div>`;
}

function renderDiscoverPanel(
  slug: string,
  live: boolean,
  placesErrorMsg: string | null,
  snapshot: GrowthEngineCompetitorSnapshot | null,
): string {
  const profile = loadProfileDataForLocalMarket(slug);
  const canDiscover = profileCanRunLocalMarketDiscovery(profile);
  const panelClass = live
    ? "lmr-discover-panel lmr-discover-panel--loaded"
    : placesErrorMsg
      ? "lmr-discover-panel lmr-discover-panel--error"
      : "lmr-discover-panel";

  if (live) {
    return `<div class="${panelClass}" id="discoverPanel">
<div class="lmr-discover-panel-main">
<span class="lmr-discover-loaded-label">Local market loaded</span>
<p class="lmr-discover-lead">Live competitor and healthcare data is ready in sections 2–7 below.</p>
</div>
<button type="button" class="lmr-discover-btn lmr-discover-btn-secondary" id="btnDiscoverCompetitors">Refresh Local Market</button>
<p id="discoverStatus" class="lmr-discover-status" role="status"></p>
</div>`;
  }

  const lead = canDiscover
    ? "Find nearby pharmacy competitors and healthcare providers using your linked Google listing."
    : "Link your Google listing first, then discover your local market.";
  const statusText = placesErrorMsg ? `Unable to load local market — ${placesErrorMsg}` : "";
  const statusClass = placesErrorMsg ? "lmr-discover-status lmr-discover-status-error" : "lmr-discover-status";

  return `<div class="${panelClass}" id="discoverPanel">
<div class="lmr-discover-panel-main">
<h2 class="lmr-discover-title">Discover your local market</h2>
<p class="lmr-discover-lead">${esc(lead)}</p>
</div>
<button type="button" class="lmr-discover-btn" id="btnDiscoverCompetitors"${canDiscover ? "" : " disabled"}>Discover Local Market</button>
<p id="discoverStatus" class="${statusClass}" role="status">${esc(statusText)}</p>
</div>`;
}

function renderSection(title: string, subtitle: string, body: string): string {
  return `<div class="ge-panel lmr-section">
<h2>${esc(title)}</h2>
<p class="lmr-lead">${esc(subtitle)}</p>
${body}
</div>`;
}

export function renderLocalMarketIntelligencePage(
  slug: string,
  snapshot: GrowthEngineCompetitorSnapshot | null,
  nav: { prevUrl?: string; nextUrl?: string },
): string {
  if (isNationalGrowthPlatform(slug)) {
    return renderNationalSearchIntelligencePage(slug, nav);
  }
  const framework = buildGrowthEngineFramework(slug);
  const localContext = buildLocalMarketLocalContextView(slug, snapshot);
  const report = buildLocalMarketReportView(snapshot, {
    gpSurgeries: localContext.gpSurgeries.length,
    healthCentres: localContext.healthCentres.length,
    hospitals: localContext.hospitals.length,
  });
  const competitors = snapshot?.competitors || [];
  const live = report.live;
  const yours = resolveLocalMarketYourPharmacy(slug, snapshot);

  const branchRequired = localMarketBranchRequired(snapshot, slug);
  const placesErrorMsg = branchRequired ? null : formatLocalMarketPlacesError(snapshot);
  const warn = branchRequired
    ? `<div class="lmr-warn"><strong>Google listing required.</strong> Run Google import and confirm your listing before discovering your local market.</div>`
    : "";

  const body = `${renderDiscoverPanel(slug, live, placesErrorMsg, snapshot)}
${warn}
${renderGoogleBusinessProfile(slug, yours, snapshot, report.lastUpdated)}

${renderSection(
  "Section 2 · Local market overview",
  "Counts from live Google Places only — nothing invented.",
  renderOverviewCounts(report.overview, live),
)}

${renderSection(
  "Your local area",
  "See the places, healthcare providers and communities surrounding your pharmacy.",
  renderYourLocalArea(localContext),
)}

${renderSection(
  "Section 3 · Competitor comparison",
  "Nearby pharmacies sorted by distance. Premium cards — no internal identifiers shown.",
  `${renderComparisonProgress(snapshot)}${renderCompetitorComparison(competitors, live)}`,
)}

${renderSection(
  "Section 4 · Market insights",
  "Plain-English observations based on how you compare locally.",
  renderInsightList(report.insights),
)}

${renderSection(
  "Section 5 · Recommended actions",
  "Practical next steps supported by live evidence only.",
  renderActionList(report.actions),
)}

${renderSection(
  "Healthcare network",
  "GP surgeries, health centres and hospitals already recorded for your pharmacy.",
  renderHealthcareNetwork(localContext),
)}

<div class="lmr-opportunity">
<h2>Section 7 · Local opportunity</h2>
<p>${report.opportunitySummary ? esc(report.opportunitySummary) : "Complete discovery to see your executive summary."}</p>
</div>

<div class="lmr-cta">
<h3>Ready for Your Website Report</h3>
<p>See what your website contains and what is missing for patients.</p>
<a class="ge-btn ge-btn-primary" href="/api/growth-engine/website-intelligence?slug=${esc(slug)}">Continue to Your Website Report →</a>
</div>

<script>
const SLUG = ${JSON.stringify(slug)};
const DISCOVER_ENDPOINT = '/api/growth-engine/' + encodeURIComponent(SLUG) + '/local-market/discover';

function setDiscoverState(state, message){
  const btn = document.getElementById('btnDiscoverCompetitors');
  const status = document.getElementById('discoverStatus');
  const panel = document.getElementById('discoverPanel');
  if (!btn || !status) return;
  if (state === 'running') {
    btn.disabled = true;
    btn.textContent = 'Discovering your local market…';
    status.textContent = message || 'Discovering your local market…';
    status.classList.remove('lmr-discover-status-error');
    panel?.classList.remove('lmr-discover-panel--error');
    return;
  }
  if (state === 'loaded') {
    btn.disabled = false;
    btn.textContent = 'Refresh Local Market';
    status.textContent = message || 'Local market loaded';
    status.classList.remove('lmr-discover-status-error');
    panel?.classList.add('lmr-discover-panel--loaded');
    panel?.classList.remove('lmr-discover-panel--error');
    return;
  }
  if (state === 'error') {
    btn.disabled = false;
    btn.textContent = 'Retry';
    status.textContent = message || 'Unable to load local market — please try again.';
    status.classList.add('lmr-discover-status-error');
    panel?.classList.add('lmr-discover-panel--error');
    panel?.classList.remove('lmr-discover-panel--loaded');
  }
}

async function runLocalMarketDiscover(){
  const btn = document.getElementById('btnDiscoverCompetitors');
  if (!btn || btn.disabled) return;
  setDiscoverState('running');
  try {
    const res = await fetch(DISCOVER_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}'
    });
    const json = await res.json();
    if (!json.ok) {
      const err = json.placesError?.message || json.error || 'Discovery did not return live Google Places data';
      throw new Error(err);
    }
    setDiscoverState('loaded', 'Local market loaded');
    window.location.reload();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    setDiscoverState('error', 'Unable to load local market — ' + msg);
  }
}

document.getElementById('btnDiscoverCompetitors')?.addEventListener('click', runLocalMarketDiscover);
</script>`;

  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Local Market · Growth Engine</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:${commercialBlueChromeGradientCss()};color:#fff;padding:16px 24px}
${platformPlatformNavCss()}
${localMarketPageCss()}
.ge-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px 24px;margin-bottom:18px}
.ge-btn{display:inline-flex;align-items:center;padding:10px 16px;border-radius:9px;font-weight:800;font-size:13px;text-decoration:none;border:1px solid #cbd5e1;color:#1e293b;background:#fff;cursor:pointer}
.ge-btn-primary{background:#005eb8;border-color:#005eb8;color:#fff}
.ge-shell{max-width:1040px;margin:0 auto;padding:24px 20px 80px}
</style>
</head>
<body>
<header>
<h1 style="margin:0;font-size:20px">PharmaConnect Growth Engine</h1>
${renderPharmacyPlatformNavBar({ slug, activeId: "growth-engine" })}
</header>
<div class="ge-shell">
<div class="ge-header-band">
<h1 style="margin:0 0 6px;font-size:24px">Your Local Market</h1>
<p style="margin:0;color:#dbeafe;font-size:14px">Commercial intelligence from live Google Places — how you compare and what to do next</p>
</div>
${renderGrowthEngineNavBar(slug, framework, "local-market", { prevUrl: nav.prevUrl, nextUrl: nav.nextUrl, nextLabel: "Continue to Your Website Report →" })}
${body}
</div>
</body></html>`);
}
