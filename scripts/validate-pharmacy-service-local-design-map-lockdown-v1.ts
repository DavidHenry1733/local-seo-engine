#!/usr/bin/env npx tsx
/**
 * Service & Local Page Design / Map Lockdown V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateContentPackage,
  loadContentPackage,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  loadGenerationReport,
  packageCanBeApproved,
  validateDesignMapLockdown,
} from "../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import { validateMapInHtml, isInvalidGenericMapEmbedUrl } from "../src/pharmacy/pharmacyMapResolver.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function readLocalPage(slug: string, serviceId: string, areaSlug: string): string | null {
  const file = path.join(
    ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "local",
    areaSlug,
    "index.html",
  );
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

async function validateTenant(slugArg: string, serviceId: string, sampleArea = "ecclesall") {
  const slug = resolveTenantProfileSlug(slugArg) || slugArg;
  const prefix = `${slug}/${serviceId}`;
  const profile = buildPharmacyServicePageProfile(slug);

  console.log(`\n=== ${prefix} ===\n`);

  await generateContentPackage(slugArg, serviceId);

  const visualPath = resolveVisualExperienceHtmlPath(serviceId as never, slug);
  const visualHtml = visualPath && fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
  record(`${prefix}:visual-exists`, Boolean(visualHtml), visualPath || "missing");

  const localHtml = readLocalPage(slug, serviceId, sampleArea);
  record(`${prefix}:local-page-exists`, Boolean(localHtml), sampleArea);

  const serviceMap = validateMapInHtml(visualHtml);
  record(`${prefix}:service-no-europe-map`, serviceMap.ok, serviceMap.detail);
  if (serviceMap.hasIframe) {
    const src = visualHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1] || "";
    record(`${prefix}:service-map-src-valid`, !isInvalidGenericMapEmbedUrl(src), src.slice(0, 120));
    record(
      `${prefix}:service-map-has-location`,
      /S60|Rotherham|Sheffield|Moorgate|postcode|place_id|z=15/i.test(src) || serviceMap.hasFallback,
      "location in embed or fallback",
    );
  }

  if (localHtml) {
    const localMap = validateMapInHtml(localHtml);
    record(`${prefix}:local-map-section`, /id="local-access"/.test(localHtml), "local-access section");
    record(`${prefix}:local-no-europe-map`, localMap.ok, localMap.detail);
    record(`${prefix}:local-serving-copy`, /Serving patients in/i.test(localHtml), "area serving copy");

    const serviceLogo =
      visualHtml.match(/data-component="pharmacy-page-header"[\s\S]*?src="([^"]+)"/i)?.[1] ||
      visualHtml.match(/class="brand-text"[^>]*>([^<]+)/i)?.[1] ||
      "";
    record(
      `${prefix}:logo-parity`,
      !serviceLogo || localHtml.includes(serviceLogo) || localHtml.includes(profile.pharmacyName),
      serviceLogo || profile.pharmacyName,
    );
    record(
      `${prefix}:header-parity`,
      localHtml.includes('data-component="pharmacy-page-header"') &&
        visualHtml.includes('data-component="pharmacy-page-header"'),
      "shared header component",
    );
    record(
      `${prefix}:footer-parity`,
      localHtml.includes('data-component="pharmacy-page-footer"') &&
        visualHtml.includes('data-component="pharmacy-page-footer"'),
      "shared footer component",
    );
    record(
      `${prefix}:brand-css`,
      localHtml.includes("--brand-primary") && localHtml.includes("data-pharmacy-template=\"lockdown-v1\""),
      "brand CSS variables",
    );
    record(
      `${prefix}:no-demo-blue`,
      !localHtml.includes("demo-banner") && !localHtml.includes("PharmaConnect Content Ecosystem"),
      "no demo ecosystem chrome",
    );
    record(`${prefix}:nearby-links`, /nearby-area-card|id="nearby-areas"/.test(localHtml), "nearby area links");
    record(
      `${prefix}:main-service-link`,
      localHtml.includes("pharmacy-visual-experience") || localHtml.includes("Main service page"),
      "link to main service",
    );
    record(`${prefix}:money-links`, /money-page-band|btn-white|tel:/.test(localHtml), "money/phone links");
    if (slug !== "pharmaconnect") {
      record(`${prefix}:no-brook`, !/Brook Pharmacy/i.test(localHtml), "no Brook content");
      record(
        `${prefix}:no-pharmaconnect-links`,
        !/\/pharmacy-content-ecosystem\/pharmaconnect\//.test(localHtml),
        "tenant paths only",
      );
    }
  }

  const design = validateDesignMapLockdown(slug, serviceId, visualHtml, localHtml);
  record(`${prefix}:design-map-lockdown`, design.ok, design.detail);

  const report = loadGenerationReport(slug, serviceId);
  record(`${prefix}:report-design-validation`, Boolean(report?.designMapValidation), report?.designMapValidation?.detail || "missing");

  const manifest = loadContentPackage(slug, serviceId);
  record(`${prefix}:package-generated`, manifest?.status === "generated", manifest?.status || "missing");

  const approval = packageCanBeApproved(report);
  if (slug === "pharmaconnect") {
    record(`${prefix}:approval`, approval.ok, approval.message);
  } else {
    record(`${prefix}:approval-gate`, approval.ok, approval.message);
  }
}

async function main() {
  await validateTenant("dhmdigital", "blood-pressure-checks", "ecclesall");
  await validateTenant("pharmaconnect", "blood-pressure-checks", "wickersley");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
