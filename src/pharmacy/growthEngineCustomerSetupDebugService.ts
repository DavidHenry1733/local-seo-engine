/**
 * Emergency Import Debug V1 — trace setup import data sources.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { buildCustomerSetupConfirmView } from "./growthEngineCustomerSetupConfirmService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import type { PharmacyProfileData, SetupImportDebugRecord } from "./pharmacyProfileSchema.ts";

const PROFILE_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles");
const BRAND_PROFILE_DIR = path.join(WORKSPACE_ROOT, "config", "projects");

export const SETUP_STALE_NEEDLES = [
  "patientexperience@rowlandspharmacy.co.uk",
  "With over 400 pharmacies",
  "we&#x27;re always on hand",
  "Pharmacy Delivered",
] as const;

export interface SetupDebugStaleMatch {
  needle: string;
  sourceFile: string;
  fieldPath: string;
  valuePreview: string;
}

export interface SetupDebugReport {
  slug: string;
  profilePath: string;
  brandProfilePath: string;
  brandProfileExists: boolean;
  googleImportSnapshot: PharmacyProfileData["googleImportSnapshot"];
  candidateGoogleListings: import("./pharmacyProfileSchema.ts").CustomerSetupGoogleCandidate[];
  websiteImportSnapshot: PharmacyProfileData["websiteImportSnapshot"];
  lastGoogleImportDebug: SetupImportDebugRecord | null;
  lastWebsiteImportDebug: SetupImportDebugRecord | null;
  googleImportSnapshotExists: boolean;
  websiteImportSnapshotExists: boolean;
  customerSetupAdminBaselineExists: boolean;
  confirmFieldsUsed: {
    googleSectionSource: "googleImportSnapshot" | "none";
    websiteSectionSource: "websiteImportSnapshot" | "none";
    formFieldsSource: "customerSetupAdminBaseline" | "empty";
    googleNotice: string;
    websiteNotice: string;
    googleRowCount: number;
    websiteRowCount: number;
    formPharmacyName: string;
    formWebsite: string;
    formEmail: string;
  };
  confirmHtmlStale: boolean;
  staleStringsFound: boolean;
  staleMatches: SetupDebugStaleMatch[];
  legacyCoreImportFields: {
    websiteImportedFieldKeys: string[];
    profileFieldConfirmations: string[];
    businessEmail: string;
    businessDescriptionPreview: string;
    websiteAnalysisAt: string;
  };
}

function profilePath(slug: string): string {
  return path.join(PROFILE_DIR, `${slug}.json`);
}

function brandPath(slug: string): string {
  return path.join(BRAND_PROFILE_DIR, slug, "brand-profile.json");
}

function decodeHtml(s: string): string {
  return s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

function walkForNeedles(
  value: unknown,
  needles: readonly string[],
  sourceFile: string,
  prefix: string,
  out: SetupDebugStaleMatch[],
): void {
  if (value == null) return;
  if (typeof value === "string") {
    const decoded = decodeHtml(value);
    for (const needle of needles) {
      if (value.includes(needle) || decoded.includes(needle)) {
        out.push({
          needle,
          sourceFile,
          fieldPath: prefix || "(root)",
          valuePreview: decoded.slice(0, 120),
        });
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkForNeedles(item, needles, sourceFile, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walkForNeedles(child, needles, sourceFile, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

function scanFile(file: string, needles: readonly string[]): SetupDebugStaleMatch[] {
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, "utf8");
    const matches: SetupDebugStaleMatch[] = [];
    if (file.endsWith(".json")) {
      walkForNeedles(JSON.parse(raw), needles, file, "", matches);
    } else {
      for (const needle of needles) {
        if (raw.includes(needle)) {
          matches.push({ needle, sourceFile: file, fieldPath: "(file text)", valuePreview: raw.slice(0, 120) });
        }
      }
    }
    return matches;
  } catch {
    return [];
  }
}

function collectConfirmHtmlStrings(view: ReturnType<typeof buildCustomerSetupConfirmView>): string {
  const parts = [
    view.googleSection.notice || "",
    view.websiteSection.notice || "",
    ...view.googleSection.rows.map((r) => `${r.label}:${r.value}`),
    ...view.websiteSection.rows.map((r) => `${r.label}:${r.value}`),
    view.fields.pharmacyName.value,
    view.fields.website.value,
    view.fields.phone.value,
    view.fields.email.value,
    view.fields.address.value,
    view.fields.town.value,
    view.fields.postcode.value,
  ];
  return decodeHtml(parts.join("\n"));
}

export function buildSetupDebugReport(slug: string): SetupDebugReport {
  const file = profilePath(slug);
  const brandFile = brandPath(slug);
  const data = readSetupProfile(slug);
  const view = buildCustomerSetupConfirmView(slug);
  const confirmBlob = collectConfirmHtmlStrings(view);

  const staleMatches = [
    ...scanFile(file, SETUP_STALE_NEEDLES),
    ...scanFile(brandFile, SETUP_STALE_NEEDLES),
  ];

  const confirmHtmlStale = SETUP_STALE_NEEDLES.some((needle) => confirmBlob.includes(needle));

  const googleSnap = data.googleImportSnapshot;
  const websiteSnap = data.websiteImportSnapshot;
  const baseline = data.customerSetupAdminBaseline;

  return {
    slug,
    profilePath: file,
    brandProfilePath: brandFile,
    brandProfileExists: fs.existsSync(brandFile),
    googleImportSnapshot: googleSnap,
    candidateGoogleListings: googleSnap?.candidates?.length ? googleSnap.candidates : [],
    websiteImportSnapshot: websiteSnap,
    lastGoogleImportDebug: data.lastGoogleImportDebug,
    lastWebsiteImportDebug: data.lastWebsiteImportDebug,
    googleImportSnapshotExists: Boolean(googleSnap?.importedAt),
    websiteImportSnapshotExists: Boolean(websiteSnap?.importedAt),
    customerSetupAdminBaselineExists: Boolean(baseline?.pharmacyName),
    confirmFieldsUsed: {
      googleSectionSource: googleSnap?.importedAt ? "googleImportSnapshot" : "none",
      websiteSectionSource: websiteSnap?.importedAt ? "websiteImportSnapshot" : "none",
      formFieldsSource: baseline?.pharmacyName ? "customerSetupAdminBaseline" : "empty",
      googleNotice: view.googleSection.notice || "",
      websiteNotice: view.websiteSection.notice || "",
      googleRowCount: view.googleSection.rows.length,
      websiteRowCount: view.websiteSection.rows.length,
      formPharmacyName: view.fields.pharmacyName.value,
      formWebsite: view.fields.website.value,
      formEmail: view.fields.email.value,
    },
    confirmHtmlStale,
    staleStringsFound: staleMatches.length > 0 || confirmHtmlStale,
    staleMatches,
    legacyCoreImportFields: legacyImportFields(data),
  };
}

function legacyImportFields(data: PharmacyProfileData) {
  return {
    websiteImportedFieldKeys: data.websiteImportedFieldKeys || [],
    profileFieldConfirmations: Object.keys(data.profileFieldConfirmations || {}),
    businessEmail: data.businessEmail || data.email || "",
    businessDescriptionPreview: decodeHtml(String(data.businessDescription || "")).slice(0, 120),
    websiteAnalysisAt: data.websiteAnalysisAt || "",
  };
}
