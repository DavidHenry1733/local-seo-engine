#!/usr/bin/env npx tsx
/**
 * Validates shared branding engine integration on Profile Dashboard.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapBrandProfileToPharmacyData, mapPharmacyDataToBrandProfile } from "../src/pharmacy/pharmacyBrandProfileMapper.ts";
import { renderBrandImportPanelHtml, renderBrandImportClientScript } from "../src/generator/brandImportPanel.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import type { BrandProfile } from "../src/generator/brandImporter.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

let pass = 0;
let fail = 0;

function check(id: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
  if (ok) pass++;
  else fail++;
}

console.log("\nPharmaConnect Shared Branding Engine — validation\n");

const dashPage = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/pharmacyProfileDashboardPage.ts"),
  "utf8",
);
const sections = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyProfileDashboardSections.ts"), "utf8");
const profilesApi = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyProfiles.ts"), "utf8");

check("shared-brand-panel-module", fs.existsSync(path.join(ROOT, "src/generator/brandImportPanel.ts")), "brandImportPanel.ts");
check("dashboard-uses-brand-panel", dashPage.includes("renderBrandImportClientScript"), "client script wired");
check("dashboard-no-pharma-color-fields", !sections.includes("colorField("), "duplicate colour pickers removed");
check("website-branding-section", sections.includes("Website Branding") && sections.includes("renderBrandImportPanelHtml"), "import panel in section");
check("apply-brand-import-api", profilesApi.includes("apply-brand-import"), "profile apply endpoint");
check("brand-mapper-module", fs.existsSync(path.join(ROOT, "src/pharmacy/pharmacyBrandProfileMapper.ts")), "mapper exists");

const sampleBrand: Partial<BrandProfile> = {
  sourceUrl: "https://example-pharmacy.co.uk",
  logoUrl: "https://example-pharmacy.co.uk/logo.png",
  faviconUrl: "https://example-pharmacy.co.uk/favicon.ico",
  primaryColour: "#1a5c42",
  secondaryColour: "#0f3324",
  buttonColour: "#007f3b",
  accentColour: "#0d9488",
  backgroundColour: "#ffffff",
  bodyTextColour: "#142033",
  headingFont: "Poppins",
  bodyFont: "Inter",
  navigationLinks: [{ label: "Services", href: "#services" }],
  footerLinks: [{ label: "Contact", href: "#contact" }],
  contact: { phone: "01onal 000000", email: "info@example.com", address: "" },
};

const mapped = mapBrandProfileToPharmacyData(sampleBrand, {});
check("mapper-logo", mapped.logoUrl === sampleBrand.logoUrl, mapped.logoUrl || "");
check("mapper-colours", mapped.brandPrimaryColor === sampleBrand.primaryColour, mapped.brandPrimaryColor || "");
check("mapper-nav", (mapped.headerNavLinks?.length || 0) === 1, String(mapped.headerNavLinks?.length));

const profile = normalizeProfileData(mapped);
const roundTrip = mapPharmacyDataToBrandProfile(profile);
check("round-trip-colour", roundTrip.primaryColour === profile.brandPrimaryColor, roundTrip.primaryColour || "");

const panelHtml = renderBrandImportPanelHtml({ mode: "pharmacy", websiteUrl: "https://test.co.uk" });
check("panel-import-button", panelHtml.includes("Import Website Branding"), "pharmacy import label");
check("panel-colour-grid", panelHtml.includes("bi-colour-grid"), "LSE colour grid");
const panelJs = renderBrandImportClientScript("pharmacy");
check("panel-bi-collect", panelJs.includes("biCollectProfilePatch"), "profile patch collector");
check("single-brand-importer", fs.existsSync(path.join(ROOT, "src/generator/brandImporter.ts")), "master brandImporter.ts");

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass}/${pass + fail} checks\n`);
process.exit(fail === 0 ? 0 : 1);
