import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { normalizeProfileDoc, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  isInvalidPharmacyIdentity,
  resolveCanonicalPharmacyName,
} from "../src/pharmacy/pharmacyServicePageProfileContext.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const CONTEXT_SOURCE = path.join(ROOT, "src/pharmacy/contentEngine/buildContentGenerationContext.ts");
const PROFILE_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyServicePageProfileContext.ts");
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const OUTPUT_ROOTS = [
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, CAMPAIGN_ID, "index.html"),
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${CAMPAIGN_ID}.json`),
  path.join(ROOT, "data/pharmacy-generation-reports", SLUG, `${CAMPAIGN_ID}.json`),
];

type HomeOccurrence = {
  file: string;
  fieldPath: string;
  source: string;
  canInfluencePharmacyIdentity: "YES" | "NO";
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function mtimeMs(target: string): number | null {
  return fs.existsSync(target) ? fs.statSync(target).mtimeMs : null;
}

function valueAt(source: Record<string, unknown>, keys: string[]): unknown {
  let value: unknown = source;
  for (const key of keys) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function stringAt(source: Record<string, unknown>, keys: string[]): string {
  return String(valueAt(source, keys) ?? "").trim();
}

function collectExactHome(value: unknown, prefix = "data"): HomeOccurrence[] {
  const out: HomeOccurrence[] = [];
  if (value === "Home") {
    const identityInfluencing = [
      "data.pharmacyName",
      "data.tradingName",
      "data.websiteImportSnapshot.intelligence.identity.title",
    ].includes(prefix);
    out.push({
      file: PROFILE_PATH,
      fieldPath: prefix,
      source: prefix.includes("websiteImportSnapshot") ? "website page title" : "live profile field",
      canInfluencePharmacyIdentity: identityInfluencing ? "YES" : "NO",
    });
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => out.push(...collectExactHome(item, `${prefix}[${index}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out.push(...collectExactHome(child, `${prefix}.${key}`));
    }
  }
  return out;
}

function sourceHomeOccurrences(): HomeOccurrence[] {
  const sourceFiles = [CONTEXT_SOURCE, PROFILE_SOURCE];
  return sourceFiles.flatMap((file) => {
    const raw = fs.readFileSync(file, "utf8");
    return [...raw.matchAll(/\bHome\b/g)].map(() => ({
      file,
      fieldPath: "(source literal/search policy)",
      source: "generation source",
      canInfluencePharmacyIdentity: raw.includes("INVALID_IDENTITY_VALUES") ? "NO" as const : "YES" as const,
    }));
  });
}

function main(): void {
  if (fs.realpathSync(process.cwd()) !== ROOT) {
    throw new Error(`Workspace mismatch: ${process.cwd()}`);
  }

  const before = OUTPUT_ROOTS.map((target) => [target, mtimeMs(target)] as const);
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(PROFILE_PATH);
  const profile = normalizeProfileDoc(SLUG, profileDoc).data as PharmacyProfileData;
  const rawData = profileDoc.data || {};
  const canonical = resolveCanonicalPharmacyName(profile);
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const after = OUTPUT_ROOTS.map((target) => [target, mtimeMs(target)] as const);
  const noGenerationOccurred = before.every(([target, mtime], index) => target === after[index]?.[0] && mtime === after[index]?.[1]);
  const homeOccurrences = [...collectExactHome(rawData), ...sourceHomeOccurrences()];

  const exactFields = {
    "customerSetupAdminBaseline.pharmacyName": stringAt(rawData, ["customerSetupAdminBaseline", "pharmacyName"]),
    "data.pharmacyName": profile.pharmacyName,
    "data.tradingName": profile.tradingName,
    "googleImportSnapshot business name": stringAt(rawData, ["googleImportSnapshot", "businessName"]),
    "websiteImportSnapshot business name": stringAt(rawData, ["websiteImportSnapshot", "intelligence", "business", "businessName", "selected"]),
    "websiteImportSnapshot page title": stringAt(rawData, ["websiteImportSnapshot", "intelligence", "identity", "title"]),
    "websiteImportSnapshot homepage H1": stringAt(rawData, ["websiteImportSnapshot", "intelligence", "identity", "homepageH1"]),
    "CustomerCampaignGenerationContext pharmacy name": ctx.profile.pharmacyName,
  };

  const output = {
    exactFields,
    homeOccurrences,
    invalidIdentityGuard: ["Home", "About", "Services", "Contact", "Welcome", "Pharmacy", "", "https://example.com"].map((value) => ({
      value,
      invalid: isInvalidPharmacyIdentity(value),
    })),
    canonicalPharmacyNameSource: canonical.source,
    canonicalPharmacyNameValue: canonical.value,
    incorrectHomeSource: homeOccurrences
      .filter((item) => item.fieldPath === "data.pharmacyName" || item.fieldPath === "data.tradingName" || item.fieldPath === "data.websiteImportSnapshot.intelligence.identity.title")
      .map((item) => `${item.fieldPath} (${item.source})`)
      .join("; "),
    filesChanged: [PROFILE_SOURCE, CONTEXT_SOURCE, SCRIPT_PATH],
    generationContextIdentity: ctx.profile.pharmacyName === "Pharmacy Delivered 4U" && ctx.tokens.pharmacy === "Pharmacy Delivered 4U" ? "PASS" : "FAIL",
    noGenerationOccurred,
    pageTitlesNavigationCannotOverrideIdentity:
      canonical.source === "customerSetupAdminBaseline.pharmacyName" &&
      exactFields["websiteImportSnapshot page title"] === "Home" &&
      ctx.profile.pharmacyName === "Pharmacy Delivered 4U",
  };

  console.log(JSON.stringify(output, null, 2));

  if (
    output.canonicalPharmacyNameValue !== "Pharmacy Delivered 4U" ||
    output.generationContextIdentity !== "PASS" ||
    !output.noGenerationOccurred ||
    !output.pageTitlesNavigationCannotOverrideIdentity
  ) {
    process.exitCode = 1;
  }
}

main();
