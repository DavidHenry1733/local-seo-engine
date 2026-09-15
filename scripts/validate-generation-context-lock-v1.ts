import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import { normalizeProfileData, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const BANNED_PATTERNS = [
  /brook/i,
  /rowlands/i,
  /\bdhm\b/i,
  /pharmacy\.inboxingproweb/i,
  /default pharmacy/i,
  /fallback profile/i,
];

type FieldStatus = "Imported" | "Manual" | "Auto populated" | "Missing";
type FieldSource =
  | "Business Profile"
  | "Google Import"
  | "Website Import"
  | "Local Market"
  | "Trust"
  | "Images"
  | "Campaign"
  | "Generation Context";

interface LockedField {
  value: unknown;
  source: FieldSource;
  status: FieldStatus;
}

interface Section {
  [field: string]: LockedField;
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return str(value) !== "";
}

function field(value: unknown, source: FieldSource, status: FieldStatus): LockedField {
  return { value, source, status: present(value) ? status : "Missing" };
}

function snapshot(data: PharmacyProfileData, key: "googleImportSnapshot" | "websiteImportSnapshot"): Record<string, unknown> {
  const value = data[key] as unknown;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function assignmentFor(assignments: Record<string, any>, slot: string): unknown {
  return assignments[`${CAMPAIGN_ID}:${CAMPAIGN_ID}:${slot}`] || null;
}

function missingFields(sections: Record<string, Section>): string[] {
  const required = new Set([
    "BUSINESS PROFILE.pharmacyName",
    "BUSINESS PROFILE.tradingName",
    "BUSINESS PROFILE.website",
    "BUSINESS PROFILE.phone",
    "BUSINESS PROFILE.email",
    "BUSINESS PROFILE.address",
    "BUSINESS PROFILE.town",
    "BUSINESS PROFILE.postcode",
    "BUSINESS PROFILE.brand colours",
    "GOOGLE IMPORT.business name",
    "GOOGLE IMPORT.phone",
    "GOOGLE IMPORT.address",
    "GOOGLE IMPORT.rating",
    "GOOGLE IMPORT.review count",
    "GOOGLE IMPORT.opening hours",
    "GOOGLE IMPORT.categories",
    "GOOGLE IMPORT.maps URL",
    "WEBSITE IMPORT.services detected",
    "WEBSITE IMPORT.customerVisibleServices",
    "WEBSITE IMPORT.brand colours",
    "WEBSITE IMPORT.contact details",
    "WEBSITE IMPORT.website intelligence",
    "LOCAL MARKET.local areas",
    "LOCAL MARKET.town context",
    "TRUST.superintendent pharmacist",
    "TRUST.reviewer",
    "TRUST.qualifications",
    "TRUST.GPhC",
    "TRUST.NHS profile",
    "IMAGES.hero",
    "IMAGES.support",
    "IMAGES.trust",
    "IMAGES.conversion",
    "CAMPAIGN.campaign ID",
    "CAMPAIGN.selected assets",
    "CAMPAIGN.campaign settings",
  ]);
  const missing: string[] = [];
  for (const [sectionName, section] of Object.entries(sections)) {
    for (const [fieldName, locked] of Object.entries(section)) {
      const key = `${sectionName}.${fieldName}`;
      if (required.has(key) && locked.status === "Missing") missing.push(key);
    }
  }
  return missing;
}

function score(section: Section): number {
  const values = Object.values(section);
  if (!values.length) return 100;
  return Math.round((values.filter((item) => item.status !== "Missing").length / values.length) * 100);
}

function leakMatches(value: unknown): string[] {
  const text = JSON.stringify(value);
  const matches: string[] = [];
  for (const pattern of BANNED_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) matches.push(match[0]);
  }
  return [...new Set(matches)];
}

function sourceResolutionIssues(sections: Record<string, Section>): string[] {
  return Object.entries(sections).flatMap(([sectionName, section]) =>
    Object.entries(section)
      .filter(([, item]) => item.status !== "Missing" && !item.source)
      .map(([fieldName]) => `${sectionName}.${fieldName}`),
  );
}

async function main(): Promise<void> {
  const profilePath = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
  const campaignPath = path.join(ROOT, "data/growth-engine", `${SLUG}-campaign-builder.json`);
  const imagePath = path.join(ROOT, "data/pharmacy-image-assignments", `${SLUG}.json`);

  const profileDoc = readJson<{ slug?: string; data?: Record<string, unknown> }>(profilePath, {});
  const data = normalizeProfileData(profileDoc.data || {});
  const google = snapshot(data, "googleImportSnapshot");
  const website = snapshot(data, "websiteImportSnapshot");
  const campaign = readJson<Record<string, unknown>>(campaignPath, {});
  const images = readJson<{ assignments?: Record<string, any> }>(imagePath, {});
  const assignments = images.assignments || {};
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const validation = validateContentGenerationContext(ctx);

  const sections: Record<string, Section> = {
    "BUSINESS PROFILE": {
      pharmacyName: field(ctx.profile.pharmacyName, "Business Profile", "Manual"),
      tradingName: field(ctx.profile.tradingName, "Business Profile", "Manual"),
      website: field(ctx.profile.website, "Business Profile", "Manual"),
      phone: field(ctx.profile.phone, "Business Profile", "Auto populated"),
      email: field(ctx.profile.email, "Business Profile", "Auto populated"),
      address: field(ctx.profile.fullAddress, "Business Profile", "Auto populated"),
      town: field(ctx.profile.town, "Business Profile", "Auto populated"),
      postcode: field(ctx.profile.postcode, "Business Profile", "Auto populated"),
      logo: field(ctx.profile.logoUrl, "Business Profile", "Missing"),
      "brand colours": field(ctx.brand, "Business Profile", "Imported"),
    },
    "GOOGLE IMPORT": {
      "business name": field(google.businessName, "Google Import", "Imported"),
      phone: field(google.phone, "Google Import", "Imported"),
      address: field(google.address, "Google Import", "Imported"),
      rating: field(google.rating, "Google Import", "Imported"),
      "review count": field(google.reviewCount, "Google Import", "Imported"),
      "opening hours": field(google.openingHours, "Google Import", "Imported"),
      categories: field(google.categories, "Google Import", "Imported"),
      "maps URL": field(google.googleMapsUrl, "Google Import", "Imported"),
    },
    "WEBSITE IMPORT": {
      "services detected": field(website.servicesDetected, "Website Import", "Imported"),
      customerVisibleServices: field(website.customerVisibleServices, "Website Import", "Imported"),
      logo: field(website.logoUrl, "Website Import", "Imported"),
      "brand colours": field(
        {
          primary: website.brandPrimaryColor,
          secondary: website.brandSecondaryColor,
          accent: website.brandAccentColor,
          background: website.brandBackgroundColor,
          text: website.brandTextColor,
        },
        "Website Import",
        "Imported",
      ),
      "contact details": field({ phone: website.phone, email: website.email, address: website.address }, "Website Import", "Imported"),
      "website intelligence": field(website.intelligence, "Website Import", "Imported"),
    },
    "LOCAL MARKET": {
      competitors: field(data.profileCompetitors, "Local Market", "Missing"),
      "healthcare providers": field({ gpSurgeries: data.gpSurgeries, healthCentres: data.healthCentres, hospitals: data.hospitals }, "Local Market", "Missing"),
      "local areas": field(ctx.selectedAreas, "Local Market", "Auto populated"),
      "town context": field(ctx.localArea || ctx.primaryTown, "Local Market", "Auto populated"),
    },
    TRUST: {
      "superintendent pharmacist": field(data.superintendentPharmacistName, "Trust", "Manual"),
      reviewer: field(data.reviewerName, "Trust", "Manual"),
      qualifications: field(data.reviewerQualifications, "Trust", "Manual"),
      GPhC: field(data.gphcNumber || data.reviewerGphcNumber, "Trust", "Manual"),
      "NHS profile": field(data.nhsProfileUrl, "Trust", "Manual"),
      accreditations: field(data.accreditations, "Trust", "Manual"),
    },
    IMAGES: {
      hero: field(assignmentFor(assignments, "hero"), "Images", "Manual"),
      support: field(assignmentFor(assignments, "support"), "Images", "Manual"),
      trust: field(assignmentFor(assignments, "trust"), "Images", "Manual"),
      conversion: field(assignmentFor(assignments, "conversion"), "Images", "Manual"),
    },
    CAMPAIGN: {
      "campaign ID": field(CAMPAIGN_ID, "Campaign", "Manual"),
      "selected assets": field(campaign.assetSelection, "Campaign", "Manual"),
      "campaign settings": field(
        {
          selectedServiceId: campaign.selectedServiceId,
          mode: campaign.mode,
          step: campaign.step,
          cta: ctx.cta,
        },
        "Campaign",
        "Manual",
      ),
    },
  };

  const missing = missingFields(sections);
  const leaks = leakMatches({
    slug: ctx.resolvedSlug,
    profile: ctx.profile,
    rawProfile: ctx.rawProfile,
    brand: ctx.brand,
    reviewer: ctx.reviewer,
    cta: ctx.cta,
    selectedAreas: ctx.selectedAreas,
    tokens: ctx.tokens,
    sections,
  });
  const sourceIssues = sourceResolutionIssues(sections);
  const serialised = JSON.stringify(ctx);
  const readiness = {
    Business: score(sections["BUSINESS PROFILE"]),
    Brand: Math.round((score(sections["BUSINESS PROFILE"]) + score(sections["WEBSITE IMPORT"])) / 2),
    Google: score(sections["GOOGLE IMPORT"]),
    Website: score(sections["WEBSITE IMPORT"]),
    Trust: score(sections.TRUST),
    Images: score(sections.IMAGES),
    Campaign: score(sections.CAMPAIGN),
  };
  const overall = Math.round(Object.values(readiness).reduce((sum, item) => sum + item, 0) / Object.values(readiness).length);
  const status = validation.ok && ctx.resolvedSlug === SLUG && ctx.serviceId === CAMPAIGN_ID && leaks.length === 0 && sourceIssues.length === 0 && serialised.length > 0 && missing.length === 0
    ? "GENERATION READY"
    : "NOT READY";

  const output = {
    status,
    tenantSlug: ctx.resolvedSlug,
    campaignId: ctx.serviceId,
    builtAt: ctx.builtAt,
    groupedFields: sections,
    generationReadiness: { ...readiness, Overall: overall },
    missingFields: missing,
    validationChecks: {
      noMissingRequiredGenerationFields: validation.ok,
      noDemoLeakage: leaks.length === 0,
      allContextSourcesResolved: sourceIssues.length === 0,
      tenantSlugCorrect: ctx.resolvedSlug === SLUG,
      campaignCorrect: ctx.serviceId === CAMPAIGN_ID,
      generationContextSerialisesSuccessfully: serialised.length > 0,
    },
    contractValidation: validation,
    sourceResolutionIssues: sourceIssues,
    demoLeakageMatches: leaks,
    customerCampaignGenerationContext: ctx,
  };

  console.log(JSON.stringify(output, null, 2));
  if (status !== "GENERATION READY") process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
