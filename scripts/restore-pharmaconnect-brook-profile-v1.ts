#!/usr/bin/env npx tsx
/**
 * Restore Brook Pharmacy demo profile — data repair only.
 * Source: validation report theme + existing Brook structural fields in profile + visual HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importBrandFromUrl } from "../src/generator/brandImporter.ts";
import { mapBrandProfileToPharmacyData } from "../src/pharmacy/pharmacyBrandProfileMapper.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILE_FILE = path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.json");
const BACKUP_FILE = path.join(ROOT, "data/pharmacy-profiles/pharmaconnect.before-brook-restore-v1.json");
const THEME_FILE = path.join(ROOT, "data/validation-reports/approved-pharmacy-template-restore-v1-pharmaconnect.json");
const BROOK_URL = "https://pharmacy.inboxingproweb.com";

async function main() {
  if (!fs.existsSync(PROFILE_FILE)) throw new Error("pharmaconnect profile missing");
  fs.copyFileSync(PROFILE_FILE, BACKUP_FILE);

  const raw = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
  const existing = normalizeProfileData(raw.data || {});
  const theme = fs.existsSync(THEME_FILE) ? JSON.parse(fs.readFileSync(THEME_FILE, "utf8")).theme : null;

  const brand = await importBrandFromUrl(BROOK_URL);
  const patch = mapBrandProfileToPharmacyData(brand, existing);

  const restored = normalizeProfileData({
    ...existing,
    ...patch,
    pharmacyName: "Brook Pharmacy",
    tradingName: "Brook Pharmacy",
    phone: "01709 210731",
    email: "pharmacy@brookpharmacy.co.uk",
    businessEmail: "pharmacy@brookpharmacy.co.uk",
    website: BROOK_URL,
    logoUrl: theme?.logoUrl || patch.logoUrl || existing.logoUrl,
    faviconUrl: theme?.logoUrl || patch.logoUrl || existing.faviconUrl,
    headerLogoUrl: theme?.logoUrl || patch.logoUrl || existing.headerLogoUrl,
    footerLogoUrl: theme?.logoUrl || patch.logoUrl || existing.footerLogoUrl,
    brandPrimaryColor: theme?.primaryColor || "#005eb8",
    brandSecondaryColor: theme?.secondaryColor || "#004a91",
    brandCtaColor: theme?.ctaColor || "#f59e0b",
    brandAccentColor: theme?.accentColor || "#007a7a",
    brandBackgroundColor: theme?.backgroundColor || "#ffffff",
    brandTextColor: theme?.textColor || "#1f2933",
    brandMutedTextColor: theme?.mutedTextColor || "#5f6c7b",
    fontHeading: theme?.fontHeading || "Open Sans",
    fontBody: theme?.fontBody || "Open Sans",
    buttonRadius: theme?.buttonRadius || "14px",
    cardRadius: theme?.cardRadius || "26px",
    websiteAnalysisSourceUrl: BROOK_URL,
    websiteAnalysisAt: existing.websiteAnalysisAt || new Date().toISOString(),
    reviewerName: "Dr Sarah Mitchell",
    superintendentPharmacistName: "Dr Sarah Mitchell",
    superintendentName: "Dr Sarah Mitchell",
    pharmacyOwnerName: "Brook Pharmacy Ltd",
    companyName: "Brook Pharmacy Ltd",
    gphcNumber: "9012345",
    demoMode: false,
    trustDataStatus: "verified",
  });

  const doc = {
    slug: "pharmaconnect",
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data: restored,
  };
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(doc, null, 2));

  console.log("Restored Brook Pharmacy profile:");
  console.log(`  pharmacyName: ${restored.pharmacyName}`);
  console.log(`  phone: ${restored.phone}`);
  console.log(`  website: ${restored.website}`);
  console.log(`  logoUrl: ${(restored.logoUrl || "").slice(0, 70)}...`);
  console.log(`  backup: ${BACKUP_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
