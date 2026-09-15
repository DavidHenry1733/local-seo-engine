#!/usr/bin/env npx tsx
/**
 * Real Pharmacy Test Profile V1 — Rowlands live website import.
 *
 * Usage: npx tsx scripts/create-rowlands-test-profile-v1.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BrandProfile } from "../src/generator/brandImporter.ts";
import { mapBrandProfileToPharmacyData } from "../src/pharmacy/pharmacyBrandProfileMapper.ts";
import {
  analyzeWebsiteForPharmacy,
  mergeWebsiteAnalysisIntoProfile,
} from "../src/pharmacy/pharmacyWebsiteAnalysisService.ts";
import {
  missingLocalMarketFields,
  profileHasBranchLocation,
} from "../src/pharmacy/localMarketBranchLocation.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "rowlands-test";
const WEBSITE = "https://rowlandspharmacy.co.uk/";
const PROFILE_FILE = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const BRAND_DIR = path.join(ROOT, "config/projects", SLUG);
const BRAND_FILE = path.join(BRAND_DIR, "brand-profile.json");
const REPORT_FILE = path.join(ROOT, "data/validation-reports", `${SLUG}-profile-v1.json`);

function loadEnv(): void {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
  if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;
}

function ensureMinimalProfile(): Record<string, unknown> {
  if (fs.existsSync(PROFILE_FILE)) {
    return JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
  }

  fs.mkdirSync(path.dirname(PROFILE_FILE), { recursive: true });
  const doc = {
    slug: SLUG,
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data: normalizeProfileData({
      pharmacyName: "Rowlands Pharmacy",
      tradingName: "Rowlands Pharmacy",
      website: WEBSITE,
      country: "United Kingdom",
      selectedServices: ["pharmacy-first", "repeat-prescriptions", "flu-vaccinations"],
      isDemo: true,
    }),
  };
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(doc, null, 2));
  return doc;
}

function saveBrandProfile(brand: BrandProfile): void {
  fs.mkdirSync(BRAND_DIR, { recursive: true });
  fs.writeFileSync(BRAND_FILE, JSON.stringify({ ...brand, approved: true }, null, 2));
}

function buildImportReport(data: ReturnType<typeof normalizeProfileData>, analysis: Awaited<ReturnType<typeof analyzeWebsiteForPharmacy>>) {
  const brand = analysis.brand;
  return {
    slug: SLUG,
    website: WEBSITE,
    generatedAt: new Date().toISOString(),
    websiteImport: {
      completedAt: data.websiteAnalysisAt || null,
      sourceUrl: data.websiteAnalysisSourceUrl || WEBSITE,
      importedFieldKeys: data.websiteImportedFieldKeys || [],
      businessName: data.pharmacyName || data.tradingName || "",
      logoUrl: data.logoUrl || "",
      colours: {
        primary: data.brandPrimaryColor || "",
        secondary: data.brandSecondaryColor || "",
        cta: data.brandCtaColor || "",
        accent: data.brandAccentColor || "",
        background: data.brandBackgroundColor || "",
        text: data.brandTextColor || "",
      },
      headerFooterColours: {
        headerBackground: data.brandHeaderBackgroundColor || "",
        headerText: data.brandHeaderTextColor || "",
        footerBackground: data.brandFooterBackgroundColor || "",
        footerText: data.brandFooterTextColor || "",
        footerLink: data.brandFooterLinkColor || "",
      },
      footerLinks: (data.footerLinks || []).map((l) => ({ label: l.label, url: l.url })),
      headerNavLinks: (data.headerNavLinks || []).map((l) => ({ label: l.label, url: l.url })),
      servicesDetected: (analysis.detectedServices || []).map((s) => ({
        id: s.serviceId,
        name: s.serviceName,
        confidence: s.confidence,
      })),
      contact: {
        phone: data.phone || "",
        email: data.email || data.businessEmail || "",
        website: data.website || "",
        bookingUrl: data.bookingUrl || "",
      },
      social: {
        facebook: data.socialFacebook || analysis.socialLinks.facebook || "",
        instagram: data.socialInstagram || analysis.socialLinks.instagram || "",
        linkedIn: data.socialLinkedIn || analysis.socialLinks.linkedIn || "",
        x: data.socialX || analysis.socialLinks.x || "",
        youTube: data.socialYouTube || analysis.socialLinks.youTube || "",
      },
      brandImporterSignals: {
        navLinks: (brand.navigationLinks || []).length,
        footerLinks: (brand.footerLinks || []).length,
        fonts: { heading: brand.headingFont || "", body: brand.bodyFont || "" },
      },
    },
    missingLocalMarketData: missingLocalMarketFields(data),
    branchLocationReady: profileHasBranchLocation(data),
    nextActionRequired: profileHasBranchLocation(data)
      ? "Run Discover local market on Your Local Market report."
      : "Select a branch/location to run Local Market Report.",
    localMarketMessage: profileHasBranchLocation(data)
      ? null
      : "Select a branch/location to run Local Market Report.",
    contentGeneration: "not started",
    publishing: "not started",
  };
}

async function main(): Promise<void> {
  loadEnv();
  console.log(`\n=== Real Pharmacy Test Profile V1 — ${SLUG} ===\n`);

  const rawDoc = ensureMinimalProfile();
  const existing = normalizeProfileData(rawDoc.data || {});

  console.log(`Profile: ${PROFILE_FILE}`);
  console.log(`Importing website: ${WEBSITE}`);

  const analysis = await analyzeWebsiteForPharmacy(WEBSITE, existing);
  saveBrandProfile({ ...analysis.brand, approved: true });

  const brandPatch = mapBrandProfileToPharmacyData(analysis.brand, existing);
  const { merged, applied } = mergeWebsiteAnalysisIntoProfile(
    {
      ...brandPatch,
      ...analysis.profilePatch,
      website: WEBSITE,
      websiteAnalysisAt: new Date().toISOString(),
      websiteAnalysisSourceUrl: analysis.brand.sourceUrl || WEBSITE,
    },
    existing,
    false,
  );

  const data = normalizeProfileData({
    ...existing,
    ...merged,
    websiteImportedFieldKeys: [...new Set([...(existing.websiteImportedFieldKeys || []), ...applied])],
  });

  const doc = {
    slug: SLUG,
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data,
  };
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(doc, null, 2));

  const report = buildImportReport(data, analysis);
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log("\n--- Imported website data ---");
  console.log(`Business name: ${report.websiteImport.businessName}`);
  console.log(`Logo: ${report.websiteImport.logoUrl ? "yes" : "no"}`);
  console.log(`Primary colour: ${report.websiteImport.colours.primary || "(not detected)"}`);
  console.log(`Header/footer colours: ${report.websiteImport.headerFooterColours.headerBackground || "(not detected)"} / ${report.websiteImport.headerFooterColours.footerBackground || "(not detected)"}`);
  console.log(`Footer links: ${report.websiteImport.footerLinks.length}`);
  console.log(`Header nav links: ${report.websiteImport.headerNavLinks.length}`);
  console.log(`Services detected: ${report.websiteImport.servicesDetected.length}`);
  console.log(`Contact phone: ${report.websiteImport.contact.phone || "(not on site)"}`);
  console.log(`Social profiles: ${Object.values(report.websiteImport.social).filter(Boolean).length}`);

  console.log("\n--- Missing required local data ---");
  if (report.missingLocalMarketData.length) {
    for (const item of report.missingLocalMarketData) console.log(`- ${item}`);
  } else {
    console.log("- none");
  }

  console.log("\n--- Next action required ---");
  console.log(report.nextActionRequired);
  console.log(`\nReport saved: ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
