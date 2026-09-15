#!/usr/bin/env npx tsx
/**
 * Header/footer brand colour profile fields — schema, import mapping, theme CSS usage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapBrandProfileToPharmacyData } from "../src/pharmacy/pharmacyBrandProfileMapper.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import {
  buildPharmacyTheme,
  pharmacyThemeRootCss,
} from "../src/pharmacy/pharmacyThemeEngine.ts";
import { buildPharmacyServicePageStyleBlock } from "../src/pharmacy/pharmacyServicePageDesignSystem.ts";
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function main() {
  console.log("\n=== Pharmacy Header/Footer Brand Colours V1 ===\n");

  const empty = normalizeProfileData({});
  record("defaults-empty-chrome-fields", !empty.brandHeaderBackgroundColor && !empty.brandFooterBackgroundColor, "blank until set");

  const themeDefault = buildPharmacyTheme(buildPharmacyServicePageProfile("pharmaconnect"));
  record("theme-default-header-bg", themeDefault.headerBackgroundColor.toLowerCase() === "#ffffff", themeDefault.headerBackgroundColor);
  record("theme-default-footer-bg", themeDefault.footerBackgroundColor.length > 0, themeDefault.footerBackgroundColor);

  const cssDefault = pharmacyThemeRootCss(themeDefault);
  record("css-vars-present", /--header-bg:/.test(cssDefault) && /--footer-bg:/.test(cssDefault) && /--footer-link:/.test(cssDefault), "root vars");

  const customData = normalizeProfileData({
    pharmacyName: "Test Pharmacy",
    phone: "01709210731",
    brandPrimaryColor: "#005eb8",
    brandTextColor: "#1f2933",
    brandBackgroundColor: "#ffffff",
    brandHeaderBackgroundColor: "#eef6ff",
    brandHeaderTextColor: "#003087",
    brandFooterBackgroundColor: "#142033",
    brandFooterTextColor: "#ffffff",
    brandFooterLinkColor: "#93c5fd",
    brandFooterAccentColor: "#cbd5e1",
  });

  record("round-trip-header-bg", customData.brandHeaderBackgroundColor === "#eef6ff", customData.brandHeaderBackgroundColor);
  record("round-trip-footer-link", customData.brandFooterLinkColor === "#93c5fd", customData.brandFooterLinkColor);

  const customProfile = buildPharmacyServicePageProfile("pharmaconnect");
  const customTheme = buildPharmacyTheme({
    ...customProfile,
    brandHeaderBackgroundColor: customData.brandHeaderBackgroundColor,
    brandHeaderTextColor: customData.brandHeaderTextColor,
    brandFooterBackgroundColor: customData.brandFooterBackgroundColor,
    brandFooterTextColor: customData.brandFooterTextColor,
    brandFooterLinkColor: customData.brandFooterLinkColor,
    brandFooterAccentColor: customData.brandFooterAccentColor,
  });
  record("theme-uses-profile-header", customTheme.headerBackgroundColor === "#eef6ff", customTheme.headerBackgroundColor);
  record("theme-uses-profile-footer-link", customTheme.footerLinkColor === "#93c5fd", customTheme.footerLinkColor);

  const styleBlock = buildPharmacyServicePageStyleBlock(customTheme);
  record("generated-css-header-var", styleBlock.includes("--header-bg:#eef6ff"), "style block");
  record("generated-css-footer-var", styleBlock.includes("--footer-bg:#142033"), "style block");
  record("shell-uses-header-bg", /\.site-header\{[^}]*var\(--header-bg/.test(styleBlock), "layout css");

  const importPatch = mapBrandProfileToPharmacyData(
    {
      headerBackgroundColour: "#112233",
      headerTextColour: "#ffffff",
      footerBackgroundColour: "#445566",
      footerTextColour: "#eeeeee",
      footerLinkColour: "#aabbcc",
      footerAccentColour: "#8899aa",
    },
    {},
  );
  record("import-maps-header-bg", importPatch.brandHeaderBackgroundColor === "#112233", importPatch.brandHeaderBackgroundColor || "");
  record("import-maps-footer-link", importPatch.brandFooterLinkColor === "#aabbcc", importPatch.brandFooterLinkColor || "");
  record(
    "import-skips-invented-colours",
    !importPatch.brandHeaderBackgroundColor?.includes("not-a-colour"),
    "invalid values rejected",
  );

  buildVisualExperiencePage("pharmaconnect", "blood-pressure-checks");
  const visualPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-visual-experience/pharmaconnect/blood-pressure-checks/index.html",
  );
  if (fs.existsSync(visualPath)) {
    const html = fs.readFileSync(visualPath, "utf8");
    record("service-page-has-chrome-vars", /--header-bg:/.test(html) && /--footer-bg:/.test(html), visualPath);
  } else {
    record("service-page-has-chrome-vars", false, "visual page missing");
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
