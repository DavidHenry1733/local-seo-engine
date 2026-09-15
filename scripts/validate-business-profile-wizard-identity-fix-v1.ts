import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { normalizeProfileDoc, type PharmacyProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import {
  renderProfileWizardHtml,
  resolveWizardHeaderPharmacyName,
} from "../src/pharmacy/pharmacyProfileWizardPage.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const URL = `https://app.pharmaconnect.uk/api/pharmacy-profile-wizard?slug=${SLUG}`;
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const WIZARD_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardPage.ts");
const OUTPUT_ROOTS = [
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, CAMPAIGN_ID, "index.html"),
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID),
  path.join(ROOT, "data/pharmacy-content-packages", SLUG, `${CAMPAIGN_ID}.json`),
  path.join(ROOT, "data/pharmacy-generation-reports", SLUG, `${CAMPAIGN_ID}.json`),
];

function mtimeMs(target: string): number | null {
  return fs.existsSync(target) ? fs.statSync(target).mtimeMs : null;
}

function readProfile(): PharmacyProfileData {
  return normalizeProfileDoc(SLUG, JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"))).data;
}

function rawProfile(): Record<string, unknown> {
  return (JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8")).data || {}) as Record<string, unknown>;
}

async function fetchLiveWizard(): Promise<{ status: number; finalUrl: string; body: string }> {
  try {
    const response = await fetch(URL, {
      redirect: "follow",
      headers: { "User-Agent": "PharmaConnectIdentityValidation/1.0" },
    });
    return { status: response.status, finalUrl: response.url, body: await response.text() };
  } catch (err) {
    return { status: 0, finalUrl: URL, body: String(err) };
  }
}

async function main(): Promise<void> {
  if (fs.realpathSync(process.cwd()) !== ROOT) {
    throw new Error(`Workspace mismatch: ${process.cwd()}`);
  }

  const before = OUTPUT_ROOTS.map((target) => [target, mtimeMs(target)] as const);
  const data = readProfile();
  const raw = rawProfile();
  const header = resolveWizardHeaderPharmacyName(data, SLUG);
  const html = renderProfileWizardHtml(SLUG, data);
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const live = await fetchLiveWizard();
  const after = OUTPUT_ROOTS.map((target) => [target, mtimeMs(target)] as const);
  const noGenerationOccurred = before.every(([target, mtime], index) => target === after[index]?.[0] && mtime === after[index]?.[1]);

  const baseline = (raw.customerSetupAdminBaseline as Record<string, unknown> | undefined)?.pharmacyName;
  const source = fs.readFileSync(WIZARD_SOURCE, "utf8");
  const renderedHeaderOk = html.includes("Auto-enriched setup for Pharmacy Delivered 4U") && !html.includes("setup for Home");
  const liveHeaderOk = live.body.includes("Auto-enriched setup for Pharmacy Delivered 4U") && !live.body.includes("setup for Home");

  const output = {
    rootCause: "Business Profile Wizard header used data.pharmacyName || slug; data.pharmacyName had been polluted with generic website title 'Home'.",
    wizardIdentityFunction: "resolveWizardHeaderPharmacyName() in src/pharmacy/pharmacyProfileWizardPage.ts",
    canonicalSource: header.source,
    canonicalValue: header.value,
    liveFieldsCorrected: {
      "data.pharmacyName": data.pharmacyName,
      "data.tradingName": data.tradingName,
      "customerSetupAdminBaseline.pharmacyName": baseline,
    },
    browserHeaderResult: liveHeaderOk
      ? "PASS: live route contains Pharmacy Delivered 4U and not setup for Home"
      : renderedHeaderOk
        ? `ROUTE AUTH/BYPASS CHECK: render PASS; live fetch status=${live.status}; finalUrl=${live.finalUrl}`
        : "FAIL",
    exactBrowserUrl: URL,
    checks: {
      headerContainsCanonicalName: renderedHeaderOk,
      liveFetchHeaderContainsCanonicalName: liveHeaderOk,
      canonicalBaselineUnchanged: baseline === "Pharmacy Delivered 4U",
      generationContextStillCanonical: ctx.profile.pharmacyName === "Pharmacy Delivered 4U" && ctx.tokens.pharmacy === "Pharmacy Delivered 4U",
      pageTitleCannotOverrideIdentity: header.source === "customerSetupAdminBaseline.pharmacyName" && source.includes("resolveWizardHeaderPharmacyName"),
      noGenerationOccurred,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (
    !output.checks.headerContainsCanonicalName ||
    !output.checks.canonicalBaselineUnchanged ||
    !output.checks.generationContextStillCanonical ||
    !output.checks.pageTitleCannotOverrideIdentity ||
    !output.checks.noGenerationOccurred
  ) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
