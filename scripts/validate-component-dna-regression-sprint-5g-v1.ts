#!/usr/bin/env npx tsx
/**
 * Sprint 5G RD024 — deterministic Component DNA regression validations.
 */
import fs from "node:fs";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { resolveComponentDna } from "../src/pharmacy/pharmacyComponentDnaResolver.ts";
import { normalizeLogoMaxHeight } from "../src/pharmacy/pharmacyComponentDnaNormalize.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { applyBrandDnaToServicePageProfile } from "../src/pharmacy/pharmacyBrandDnaResolver.ts";
import { renderBrandFooterComponent } from "../src/pharmacy/pharmacyBrandDnaComponentRenderers.ts";
import { resolvePageComponentDna } from "../src/pharmacy/pharmacyBrandDnaComponentRenderers.ts";
import { resolveOpeningHoursRows } from "../src/pharmacy/pharmacyOpeningHoursTable.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceHtmlPath =
  process.argv[3] ||
  `/home/inboxingproweb/pharmaconnect-growth-engine/output/pharmacy-visual-experience/${slug}/pharmacy-first/index.html`;

const brand = resolveBrandDnaForRender(slug);
const componentDna = resolveComponentDna(brand);
const profile = applyBrandDnaToServicePageProfile(buildPharmacyServicePageProfile(slug), brand);
const footerHtml = renderBrandFooterComponent(profile, "Pharmacy First", componentDna.variants, slug, componentDna);
const html = fs.existsSync(serviceHtmlPath) ? fs.readFileSync(serviceHtmlPath, "utf8") : "";

const logoPx = Number(normalizeLogoMaxHeight("230px").replace("px", ""));
const headerLogoOk = logoPx <= 56;
const headerOverflowCss = /--component-header-logo-max:min\([^,]+,56px\)/.test(html);
const footerFourCols = /footer-grid--four/.test(footerHtml) && (footerHtml.match(/footer-col/g) || []).length >= 4;
const hoursRows = resolveOpeningHoursRows(profile).length;
const nhsBadge = /footer-badge|footer-badge-image/.test(footerHtml);
const gphcRow = /GPhC|gphc/i.test(footerHtml);
const legalBar = /footer-legal-links/.test(footerHtml);
const processFourColCss = /process-grid\.grid-4\{grid-template-columns:repeat\(4/.test(html) || !/\.process-grid\{grid-template-columns:repeat\(3/.test(html);
const cardGridSafe = !/\.card-grid-equal\{grid-template-columns:repeat\(3/.test(html);
const extremeNormalised = normalizeLogoMaxHeight("999px") === "56px";

const checks = {
  headerLogoWithinRange: headerLogoOk,
  headerLogoCssCapped: headerOverflowCss,
  cardGridEqualNotForcedThreeCol: cardGridSafe,
  processGridFourColPreserved: processFourColCss,
  footerFourColumnVariant: footerFourCols,
  openingHoursSevenRows: hoursRows === 7,
  nhsBadgePresent: nhsBadge,
  gphcRowWhenProfilePresent: profile.gphcNumber ? gphcRow : true,
  legalBottomBarPresent: legalBar,
  extremeValuesNormalised: extremeNormalised,
  deterministicComponentDna: resolveComponentDna(brand).header.logoMaxHeight === componentDna.header.logoMaxHeight,
};

const pass = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok: pass, slug, serviceHtmlPath, checks, componentDnaHeader: componentDna.header }, null, 2));
process.exit(pass ? 0 : 1);
