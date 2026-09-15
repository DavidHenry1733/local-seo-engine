#!/usr/bin/env npx tsx
/**
 * Business Profile Intelligence V2 — Phase 3C cluster page integration validation.
 */
import fs from "node:fs";
import path from "node:path";
import { slugifyArea } from "../src/pharmacy/pharmacyAreaNarrativeProfiles.ts";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { buildBusinessProfileIntelligenceFromProfile } from "../src/pharmacy/businessProfileIntelligence/buildBusinessProfileIntelligence.ts";
import {
  phraseConsultationRoom,
  phraseParking,
  phraseYearsServing,
} from "../src/pharmacy/contentEngine/pharmacyLongFormIntelligencePhrases.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { validateLocalClusterQuality } from "../src/pharmacy/pharmacyLocalClusterQualityValidation.ts";
import { intelligenceSupportsClaim } from "../src/pharmacy/pharmacyLocalClusterIntelligence.ts";
import { localPageWordCount, countNearbyAreaLinks } from "../src/pharmacy/pharmacyLocalAreaPageDiagnostics.ts";
import { PROFILE_SCHEMA_VERSION, normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { loadPharmacyProfile } from "../src/pharmacy/pharmacyContentBlueprintService.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";

import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
const SERVICE_ID = "blood-pressure-checks";

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

function pageText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function readLocalPage(slug: string, areaSlug: string): string {
  const file = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    SERVICE_ID,
    "local",
    areaSlug,
    "index.html",
  );
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

async function validateSlug(slugArg: string) {
  const slug = resolveTenantProfileSlug(slugArg) || slugArg;
  const ctx = buildContentGenerationContext(slugArg, SERVICE_ID);
  const sampleArea =
    ctx.selectedAreas.find((a) => a.selected !== false)?.areaName ||
    ctx.primaryTown ||
    "Ecclesall";
  const areaSlug = slugifyArea(sampleArea);
  const prefix = `${slug}/${SERVICE_ID}/${areaSlug}`;
  console.log(`\n=== ${prefix} ===\n`);

  record(`${prefix}:context-intelligence`, ctx.businessProfileIntelligence.slug === slug, slug);

  await generateContentPackage(slugArg, SERVICE_ID);

  const html = readLocalPage(slug, areaSlug);
  const text = pageText(html);
  record(`${prefix}:cluster-page-exists`, Boolean(html), `${localPageWordCount(html)} words`);
  record(
    `${prefix}:bpi-marker`,
    html.includes(`data-business-profile-intelligence="${slug}"`),
    "cluster page consumes intelligence",
  );
  record(`${prefix}:area-in-copy`, text.toLowerCase().includes(sampleArea.toLowerCase()), sampleArea);
  record(
    `${prefix}:main-service-link`,
    html.includes("/api/pharmacy-visual-experience/") || html.includes("Main Blood Pressure Checks page"),
    "service page link intact",
  );
  record(`${prefix}:nearby-links`, countNearbyAreaLinks(html) >= 1, `${countNearbyAreaLinks(html)} nearby links`);

  const areas = (ctx.selectedAreas || []).map((a) => a.areaName).filter(Boolean);
  const visualPath = resolveVisualExperienceHtmlPath(SERVICE_ID as never, slug);
  const visualHtml = visualPath && fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
  const clusterQuality = validateLocalClusterQuality(slugArg, SERVICE_ID, areas, visualHtml);
  record(`${prefix}:cluster-quality-v3`, clusterQuality.ok, clusterQuality.detail);

  record(
    `${prefix}:intelligence-supports-claims`,
    intelligenceSupportsClaim(ctx, text),
    "no unsupported invented claims",
  );

  if (phraseConsultationRoom(ctx)) {
    record(
      `${prefix}:uses-consultation-room`,
      text.toLowerCase().includes("private consultation room"),
      "profile-backed consultation room",
    );
  }

  if (phraseYearsServing(ctx)) {
    record(
      `${prefix}:uses-years-serving`,
      /\bserved the local community for\b/i.test(text),
      "years serving from profile",
    );
  }

  record(`${prefix}:fallback-no-parking`, !phraseParking(ctx) || text.toLowerCase().includes("parking"), phraseParking(ctx) || "none");

  const minimalRaw = normalizeProfileData({
    pharmacyName: ctx.profile.pharmacyName,
    phone: ctx.profile.phone,
    primaryTown: ctx.primaryTown,
    consultationRoomAvailable: false,
    yearsServingCommunity: "",
    parkingInfo: "",
    serviceDeliveryProfiles: {},
  });
  const minimalIntel = buildBusinessProfileIntelligenceFromProfile(
    slug,
    minimalRaw,
    ctx.businessProfileIntelligence.provenance.profileUpdatedAt,
    PROFILE_SCHEMA_VERSION,
  );
  record(`${prefix}:minimal-no-years`, !minimalIntel.trust.yearsServingCommunity, "fallback strips years");
}

async function main() {
  console.log("\n=== Business Profile Intelligence V2 — Phase 3C Cluster Page ===\n");

  const doc = loadPharmacyProfile("dhmdigital");
  record("dhmdigital:profile-loads", Boolean(doc?.data?.pharmacyName), doc?.data?.pharmacyName || "missing");

  await validateSlug("dhmdigital");
  await validateSlug("pharmaconnect");

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
  if (checks.some((c) => !c.pass)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
