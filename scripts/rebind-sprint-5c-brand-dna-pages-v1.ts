#!/usr/bin/env npx tsx
/**
 * Sprint 5C — re-render Pharmacy First service page + eight local pages with Brand DNA chrome.
 * Preserves frozen narrative content and image assignments; no content regeneration.
 */
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { rebindPharmacyFirstLocalClusterPages } from "../src/pharmacy/rebindPharmacyFirstLocalPages.ts";
import { resolveBrandDnaRenderTokens } from "../src/pharmacy/pharmacyBrandDnaRenderTokens.ts";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { buildPharmacyThemeWithBrandDna } from "../src/pharmacy/pharmacyBrandDnaResolver.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceId = process.argv[3] || "pharmacy-first";

const serviceResult = buildVisualExperiencePage(slug, serviceId as "pharmacy-first");
const localResult = rebindPharmacyFirstLocalClusterPages(slug, serviceId, {
  preserveExistingNarrative: true,
});

const fallbackProfile = buildPharmacyServicePageProfile("pharmaconnect");
const fallbackTheme = buildPharmacyThemeWithBrandDna(fallbackProfile, resolveBrandDnaForRender("pharmaconnect"));
const fallbackTokens = resolveBrandDnaRenderTokens("pharmaconnect");
const fallbackPass =
  Boolean(fallbackTheme.primaryColor) &&
  !fallbackTokens.hasTenantDna &&
  fallbackTokens.css.includes("--brand-primary");

const tenantTokens = resolveBrandDnaRenderTokens(slug);

console.log(
  JSON.stringify(
    {
      slug,
      serviceId,
      servicePage: { ok: true, htmlPath: serviceResult.outputPath, previewUrl: serviceResult.previewUrl },
      localPages: localResult,
      brandTokenAdapter: {
        tenantHasDna: tenantTokens.hasTenantDna,
        cssVarCount: (tenantTokens.css.match(/--brand-/g) || []).length,
      },
      fallbackTest: fallbackPass ? "PASS" : "FAIL",
      pagesRendered: 1 + localResult.pagesRebound,
      pagesExpected: 9,
      previewUrls: {
        service: `https://app.pharmaconnect.uk/api/pharmacy-visual-experience/${serviceId}/?slug=${slug}`,
        wickersley: `https://app.pharmaconnect.uk/api/pharmacy-content-ecosystem-preview/${serviceId}/local/wickersley/?slug=${slug}`,
        bramley: `https://app.pharmaconnect.uk/api/pharmacy-content-ecosystem-preview/${serviceId}/local/bramley/?slug=${slug}`,
      },
    },
    null,
    2,
  ),
);
