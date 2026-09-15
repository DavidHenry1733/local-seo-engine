#!/usr/bin/env npx tsx
/**
 * APPROVED-CORE-PAGE-SHARED-RENDERER-QUALITY-29 — no-write neutral fixture validation (4 services).
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  loadServiceVariantPack,
  localizeFaqQuestion,
  resolveApprovedServiceBank,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import {
  buildApprovedBankServicePageContract,
  withApprovedBankServicePageContract,
} from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import { composeCommercialClusterNarrativeV1 } from "../src/pharmacy/pharmacyLocalClusterContentEngine.ts";
import { buildPharmacyServicePageMainHtml } from "../src/pharmacy/pharmacyVisualExperienceLayoutV3.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { resolvePharmacyImageForSlot } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import type { ContentGenerationContext } from "../src/pharmacy/contentEngine/contentGenerationContextTypes.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUT = "/tmp/shared-renderer-quality-29-four-service-fixtures.json";
const PROFILE_SLUG = "yorkshire-pharmacy-and-health-clinic";
const CONTENT_SLUG = "neutral-fixture-pharmacy";
const SERVICES = [
  { serviceId: "pharmacy-first", serviceName: "Pharmacy First" },
  { serviceId: "travel-vaccinations", serviceName: "Travel Vaccinations" },
  { serviceId: "blood-pressure-checks", serviceName: "Blood Pressure Checks" },
  { serviceId: "flu-vaccinations", serviceName: "Flu Vaccinations" },
] as const;

const REGISTRY = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/pharmacy-approved-service-banks/registry.json"), "utf8"),
) as {
  services: Record<string, { approvedBankHash: string; approvedBankRelativePath: string }>;
};

function shaFile(p: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function buildFixtureContext(serviceId: string): ContentGenerationContext {
  const ctx = buildContentGenerationContext(PROFILE_SLUG, serviceId);
  const pack = loadServiceVariantPack(serviceId)!;
  return { ...ctx, variantPack: pack, resolvedSlug: CONTENT_SLUG };
}

function validateService(serviceId: string, serviceName: string) {
  const failures: string[] = [];
  const registryEntry = REGISTRY.services[serviceId];
  const bankPath = path.join(ROOT, registryEntry.approvedBankRelativePath);
  const bankHashBefore = shaFile(bankPath);
  if (bankHashBefore !== registryEntry.approvedBankHash) {
    failures.push(`bank hash drift for ${serviceId}: registry ${registryEntry.approvedBankHash} !== disk ${bankHashBefore}`);
  }

  const pack = loadServiceVariantPack(serviceId)!;
  const contract = buildApprovedBankServicePageContract(pack);
  for (const step of contract.processSteps) {
    if (!step.title || !step.body) failures.push(`${serviceId}: empty process step ${step.stepNumber}`);
    if (step.body.startsWith(step.title)) failures.push(`${serviceId}: process step ${step.stepNumber} body starts with title`);
    if (/^Step \d+$/.test(step.title) && step.body.length > 40) {
      failures.push(`${serviceId}: generic step title with long body on step ${step.stepNumber}`);
    }
  }

  const ctx = buildFixtureContext(serviceId);
  const profile = buildPharmacyServicePageProfile(PROFILE_SLUG);
  const imageCtx = {
    slug: PROFILE_SLUG,
    templateFamilyKey: "clinical-nhs-services",
    serviceKey: serviceId,
    serviceName,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    previewBasePath: "/assets",
    visualDemoMode: false,
    previewMode: false,
  };
  const html = buildPharmacyServicePageMainHtml("<html><body><main></main></body></html>", imageCtx, profile, ctx);

  if (/id="pharmacy-trust-cards"/.test(html)) {
    failures.push(`${serviceId}: generic trust cards section rendered on approved-bank service page`);
  }
  if (/id="pharmacy-trust-cards"[\s\S]*?(Private Consultation Room|trained pharmacists|GPhC Registered Pharmacy|Pharmacist-led assessment)/i.test(html)) {
    failures.push(`${serviceId}: injected generic trust/profile claim in trust cards`);
  }
  if (/Local guidance for |For [A-Za-z]+ residents:|pharmacy access —/i.test(html)) {
    failures.push(`${serviceId}: locality-prefixed FAQ on service page`);
  }
  const processCards = [...html.matchAll(/data-template-block="process"[\s\S]*?<h3 class="card-title-line-1">([^<]+)<\/h3>[\s\S]*?<p class="card-body">([^<]+)<\/p>/g)];
  for (const [, title, body] of processCards) {
    if (/^Step \d+$/.test(String(title).trim()) && String(body).length > 60) {
      failures.push(`${serviceId}: process title/body run-on (${title})`);
    }
    if (String(body).trim().startsWith(String(title).trim())) {
      failures.push(`${serviceId}: process body repeats title (${title})`);
    }
  }

  const hero = resolvePharmacyImageForSlot(PROFILE_SLUG, serviceId, "hero", { campaignId: serviceId });
  if (hero.assetPath.includes("/pharmacy-first/") && serviceId !== "pharmacy-first") {
    const assetId = hero.imageKey || path.basename(hero.assetPath, path.extname(hero.assetPath));
    if (/consultation-room|confidential-consultation|pf-hero-consultation/i.test(`${assetId} ${hero.assetPath}`)) {
      failures.push(`${serviceId}: cross-service Pharmacy First consultation-room hero (${assetId})`);
    }
  }
  for (const other of SERVICES) {
    if (other.serviceId === serviceId) continue;
    if (new RegExp(other.serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(html)) {
      failures.push(`${serviceId}: cross-service wording (${other.serviceName})`);
    }
  }

  const locality = composeCommercialClusterNarrativeV1(
    {
      slug: CONTENT_SLUG,
      serviceId,
      serviceName,
      areaName: "Darfield",
      areaSlug: "darfield",
      nearbyAreaNames: ["Cudworth"],
      areaSlugsInCluster: ["darfield", "cudworth"],
    },
    ctx,
  );
  for (const [i, faq] of locality.faqs.entries()) {
    const localized = localizeFaqQuestion(faq.question, "Darfield", "darfield", i, serviceId);
    if (localized !== faq.question.trim()) {
      failures.push(`${serviceId}: FAQ question rewritten for Darfield [${i}]: ${localized}`);
    }
    if (/Local guidance for |For Darfield residents:|Darfield pharmacy access —|Darfield patients —/i.test(localized)) {
      failures.push(`${serviceId}: locality SEO FAQ prefix [${i}]: ${localized}`);
    }
  }

  const bankHashAfter = shaFile(bankPath);
  if (bankHashAfter !== bankHashBefore) {
    failures.push(`${serviceId}: bank file mutated during validation`);
  }

  return {
    serviceId,
    bankHash: bankHashBefore,
    bankHashUnchanged: bankHashAfter === bankHashBefore,
    processStepCount: contract.processSteps.length,
    heroImage: {
      assetPath: hero.assetPath || null,
      imageKey: hero.imageKey,
      source: hero.source,
      schemaUsage: hero.schemaUsage,
    },
    failures,
    pass: failures.length === 0,
  };
}

function main() {
  const results = SERVICES.map((s) => validateService(s.serviceId, s.serviceName));
  const result = {
    ok: results.every((r) => r.pass),
    task: "APPROVED-CORE-PAGE-SHARED-RENDERER-QUALITY-29",
    fixtureSlug: CONTENT_SLUG,
    profileSlug: PROFILE_SLUG,
    writeMode: "no-write-neutral-fixtures",
    services: results,
    failureCount: results.reduce((n, r) => n + r.failures.length, 0),
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main();
