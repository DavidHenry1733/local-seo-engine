#!/usr/bin/env npx tsx
/**
 * Business Profile Intelligence V2 — Phase 3B service page integration validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { buildBusinessProfileIntelligenceFromProfile } from "../src/pharmacy/businessProfileIntelligence/buildBusinessProfileIntelligence.ts";
import {
  phraseConsultationRoom,
  phraseParking,
  phraseYearsServing,
} from "../src/pharmacy/contentEngine/pharmacyLongFormIntelligencePhrases.ts";
import { buildVisualExperiencePage, validateVisualExperienceHtml } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { validatePharmacyServicePageHtml } from "../src/pharmacy/pharmacyVisualExperienceLayoutV3.ts";
import { intelligenceSupportsClaim } from "../src/pharmacy/pharmacyServicePageIntelligence.ts";
import { PROFILE_SCHEMA_VERSION, normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

async function validateSlug(slug: string) {
  const prefix = `${slug}/${SERVICE_ID}`;
  console.log(`\n=== ${prefix} ===\n`);

  const ctx = buildContentGenerationContext(slug, SERVICE_ID);
  record(`${prefix}:context-intelligence`, ctx.businessProfileIntelligence.slug === slug, slug);

  buildVisualExperiencePage(slug, SERVICE_ID);

  const htmlPath = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE_ID, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const text = pageText(html);

  const layout = validatePharmacyServicePageHtml(html);
  record(`${prefix}:layout-validation`, layout.pass, layout.failures.join(", ") || "ok");

  const visual = validateVisualExperienceHtml(html, SERVICE_ID);
  record(`${prefix}:visual-validation`, visual.pass, visual.failures.join(", ") || "ok");

  record(`${prefix}:hero-section`, html.includes('data-template-block="hero"'), "hero present");
  record(`${prefix}:process-section`, html.includes('data-template-block="process"'), "process present");
  record(`${prefix}:faq-section`, html.includes('id="faq-section"'), "faq present");
  record(`${prefix}:cta-band`, html.includes("cta-band"), "cta present");

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
      "years serving community from profile",
    );
  }

  const parkingPhrase = phraseParking(ctx);
  record(
    `${prefix}:fallback-no-parking`,
    !parkingPhrase || text.toLowerCase().includes("parking"),
    parkingPhrase || "none",
  );

  const minimalRaw = normalizeProfileData({
    pharmacyName: ctx.profile.pharmacyName,
    phone: ctx.profile.phone,
    primaryTown: ctx.primaryTown,
    townCity: ctx.primaryTown,
    openingHours: ctx.cta.openingHours,
    addressLine1: ctx.profile.fullAddress,
    consultationRoomAvailable: false,
    yearsServingCommunity: "",
    parkingInfo: "",
    serviceDeliveryProfiles: {},
  });
  const minimalIntel = buildBusinessProfileIntelligenceFromProfile(
    ctx.resolvedSlug,
    minimalRaw,
    ctx.businessProfileIntelligence.provenance.profileUpdatedAt,
    PROFILE_SCHEMA_VERSION,
  );
  record(`${prefix}:minimal-no-years`, !minimalIntel.trust.yearsServingCommunity, "minimal profile strips years");
}

async function main() {
  console.log("\n=== Business Profile Intelligence V2 — Phase 3B Service Page ===\n");

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
