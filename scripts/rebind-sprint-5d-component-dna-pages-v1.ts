#!/usr/bin/env npx tsx
/**
 * Sprint 5H.5 — single-pass render for service page + Wickersley + Bramley.
 */
import fs from "node:fs";
import path from "node:path";
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { renderLocalLocationAreaFullPage } from "../src/pharmacy/pharmacyLocalHierarchyFullPageRenderer.ts";
import { scopeContentGenerationContextForArea } from "../src/pharmacy/contentEngine/contentEngineContextScope.ts";
import { getEcosystemRoot } from "../src/pharmacy/contentEngine/contentEnginePaths.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";
import { getPharmaConnectBrandDnaComponentDefaults } from "../src/pharmacy/pharmacyBrandDnaComponentDefaults.ts";
import { resolveBrandDnaComponents } from "../src/pharmacy/pharmacyBrandDnaComponentResolver.ts";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceId = process.argv[3] || "pharmacy-first";
const localSlugs = ["wickersley", "bramley"];

const resolvedSlug = resolveTenantProfileSlug(slug) || slug;
const serviceResult = buildVisualExperiencePage(resolvedSlug, serviceId as "pharmacy-first");

const baseCtx = buildContentGenerationContext(resolvedSlug, serviceId);
const hierarchy = resolveLocalLocationHierarchy(baseCtx.resolvedSlug, baseCtx.serviceId, baseCtx.rawProfile);
if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "hierarchy blocked");
const ecosystemRoot = getEcosystemRoot(serviceId, resolvedSlug);
const selectedAreas = hierarchy.areas.filter((a) => localSlugs.includes(a.slug));
const localPaths: string[] = [];

for (const area of selectedAreas) {
  const scopedCtx = scopeContentGenerationContextForArea(baseCtx, area.name);
  const html = renderLocalLocationAreaFullPage(scopedCtx, hierarchy, area);
  const outPath = path.join(ecosystemRoot, "local", area.slug, "index.html");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, "utf8");
  localPaths.push(outPath);
}

const fallbackDefaults = getPharmaConnectBrandDnaComponentDefaults();
const tenantComponents = resolveBrandDnaComponents(resolveBrandDnaForRender(resolvedSlug));
const fallbackPass =
  fallbackDefaults.headerVariant === "standard-navigation" &&
  tenantComponents.headerVariant === "topbar-white-navigation";

console.log(
  JSON.stringify(
    {
      slug: resolvedSlug,
      serviceId,
      pipeline: "single-pass-v1",
      servicePage: {
        ok: true,
        htmlPath: serviceResult.outputPath,
        previewUrl: serviceResult.previewUrl,
      },
      localPages: { rendered: localPaths.length, paths: localPaths },
      componentDna: tenantComponents,
      genericFallback: fallbackPass ? "PASS" : "FAIL",
      pagesRendered: 1 + localPaths.length,
      previewUrls: {
        service: `https://app.pharmaconnect.uk/api/pharmacy-visual-experience/${serviceId}/?slug=${resolvedSlug}`,
        wickersley: `https://app.pharmaconnect.uk/api/pharmacy-content-ecosystem-preview/${serviceId}/local/wickersley/?slug=${resolvedSlug}`,
        bramley: `https://app.pharmaconnect.uk/api/pharmacy-content-ecosystem-preview/${serviceId}/local/bramley/?slug=${resolvedSlug}`,
      },
    },
    null,
    2,
  ),
);
