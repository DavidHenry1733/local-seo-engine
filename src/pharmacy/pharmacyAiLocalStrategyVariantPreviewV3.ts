/**
 * Isolated strategy-variant comparison Preview for Wombwell and Darfield.
 * Restores existing Pharmacy First locality strategies (primary-care-led /
 * community-led) without rewriting accepted candidates or calling OpenAI.
 */
import fs from "node:fs";
import path from "node:path";

import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  AI_LOCAL_STRATEGY_VARIANT_BANNER,
  AI_PILOT_V3_PREVIEW_BANNER,
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalCopyPilotPath,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { aiLocalCopyOverlay } from "./contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { loadAiLocalCopyPilotV3 } from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import type { LocalityPageStrategyId } from "./contentEngine/pharmacyLocalityPageStrategyV1.ts";
import { renderAiLocalPagePilotHtmlInMemoryV3 } from "./pharmacyAiLocalPagePilotAssemblerV3.ts";
import { repairPreviewSectionHashLinks } from "./pharmacyContentEcosystemPreviewRoute.ts";

const YORKSHIRE_SERVICE_PREVIEW_HREF =
  "/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=service-page";
const WOMBWELL_STRAIGHT_LINE_DISTANCE = "Wombwell is approximately 1.7 km in a straight line.";

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

export const STRATEGY_VARIANT_COMPARISON_AREAS = {
  wombwell: "primary-care-led",
  darfield: "community-led",
} as const satisfies Record<string, LocalityPageStrategyId>;

export type StrategyVariantComparisonArea = keyof typeof STRATEGY_VARIANT_COMPARISON_AREAS;

function esc(value: string): string {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch] || ch));
}

function correctWombwellDistanceFaq(html: string): string {
  return String(html || "")
    .replace(
      /Wombwell is 1\.7 km of the pharmacy\.\s*Saved coordinates and provenance are used rather than estimated travel times\./g,
      WOMBWELL_STRAIGHT_LINE_DISTANCE,
    )
    .replace(/\s*Saved coordinates and provenance are used rather than estimated travel times\./g, "");
}

function rewriteWombwellMainServicePreviewLinks(html: string): string {
  return String(html || "").replace(
    /href="\/pharmacy-first\/?"/g,
    `href="${YORKSHIRE_SERVICE_PREVIEW_HREF}"`,
  );
}

function previewAuthTokenPreserveScript(): string {
  return `<script data-preview-auth-preserve>
(function(){
  var token = new URLSearchParams(window.location.search).get("_t");
  if (!token) return;
  document.addEventListener("click", function(event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    try {
      var url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.indexOf("/api/growth-engine/") !== 0) return;
      if (!url.searchParams.get("_t")) {
        url.searchParams.set("_t", token);
        link.setAttribute("href", url.pathname + url.search + url.hash);
      }
    } catch (err) {}
  }, true);
})();
</script>`;
}

function wrapVariantHtml(html: string, areaSlug: string, strategy: LocalityPageStrategyId): string {
  let out = String(html || "");
  if (!/name="robots"\s+content="noindex,\s*nofollow"/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow"/>`);
  }
  out = out.replace(/<style data-candidate-preview="ai-local-area-page-pilot-v3">[\s\S]*?<\/style>\s*/i, "");
  out = out.replace(/<div class="candidate-preview-toolbar"[^>]*>[\s\S]*?<\/div>\s*/i, "");
  if (areaSlug === "wombwell") {
    out = rewriteWombwellMainServicePreviewLinks(correctWombwellDistanceFaq(out));
  }
  out = repairPreviewSectionHashLinks(out);
  const label = areaSlug === "wombwell" ? "Wombwell" : areaSlug === "darfield" ? "Darfield" : areaSlug;
  const banner = `${AI_LOCAL_STRATEGY_VARIANT_BANNER} · ${label} · restored ${strategy}`;
  const style = `<style data-strategy-variant="v3">.strategy-variant-toolbar{position:sticky;top:0;z-index:10001;min-height:40px;box-sizing:border-box;background:#ecfdf5;border-bottom:1px solid #059669;color:#065f46;font:800 13px/1.45 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}.strategy-variant-toolbar~.site-header{top:40px}html{scroll-padding-top:130px}section[id]{scroll-margin-top:130px}</style>`;
  const bar = `<div class="strategy-variant-toolbar" data-component="strategy-variant-banner">${esc(banner)}</div>`;
  const authScript = areaSlug === "wombwell" ? previewAuthTokenPreserveScript() : "";
  if (/data-component="strategy-variant-banner"/i.test(out)) return out;
  if (!/<body/i.test(out)) {
    return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="robots" content="noindex, nofollow"/><title>Strategy variant comparison</title></head><body>${style}\n${bar}<main><p>Strategy variant comparison is unavailable.</p></main>${authScript}</body></html>`;
  }
  out = out.replace(/<body([^>]*)>/i, `<body$1>\n${style}\n${bar}`);
  if (authScript && !/data-preview-auth-preserve/i.test(out)) {
    out = out.replace(/<\/body>/i, `${authScript}\n</body>`);
  }
  return out;
}

function unavailableHtml(areaSlug = ""): string {
  const label = areaSlug.trim() ? ` for ${esc(areaSlug.trim())}` : "";
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Strategy variant comparison unavailable</title>
</head>
<body>
<div class="strategy-variant-toolbar" data-component="strategy-variant-banner">${esc(AI_LOCAL_STRATEGY_VARIANT_BANNER)}</div>
<main>
<p><strong>This strategy variant comparison preview is not available${label}.</strong></p>
<p>Only Wombwell (primary-care-led) and Darfield (community-led) are exposed. This route cannot approve or publish.</p>
</main>
</body>
</html>`;
}

export function renderStrategyVariantComparisonPreview(areaSlug: string): {
  html: string;
  sourcePath: string | null;
  sourceRoute: string;
  strategy: LocalityPageStrategyId | null;
} {
  const slug = String(areaSlug || "").trim().toLowerCase();
  const strategy = STRATEGY_VARIANT_COMPARISON_AREAS[slug as StrategyVariantComparisonArea];
  if (!strategy) {
    return {
      html: unavailableHtml(slug),
      sourcePath: null,
      sourceRoute: "review-preview-strategy-variant-unavailable",
      strategy: null,
    };
  }
  const record = loadAiLocalCopyPilotV3(YORKSHIRE, SERVICE, slug);
  const copy = record?.outputCopy;
  const sourcePath = aiLocalCopyPilotPath(YORKSHIRE, SERVICE, slug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
  if (!copy) {
    return {
      html: unavailableHtml(slug),
      sourcePath: fs.existsSync(sourcePath) ? sourcePath : null,
      sourceRoute: "review-preview-strategy-variant-unavailable",
      strategy,
    };
  }
  const rendered = renderAiLocalPagePilotHtmlInMemoryV3({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaSlug: slug,
    overlay: aiLocalCopyOverlay(copy),
    wrapPreviewBanner: false,
    forceStrategy: strategy,
    restoreStrategyVariants: true,
  });
  if (!rendered.ok) {
    return {
      html: unavailableHtml(slug),
      sourcePath,
      sourceRoute: "review-preview-strategy-variant-unavailable",
      strategy,
    };
  }
  return {
    html: wrapVariantHtml(rendered.html, slug, strategy),
    sourcePath,
    sourceRoute: "ai-local-strategy-variant-v3",
    strategy,
  };
}

export { AI_LOCAL_STRATEGY_VARIANT_BANNER, AI_PILOT_V3_PREVIEW_BANNER };
