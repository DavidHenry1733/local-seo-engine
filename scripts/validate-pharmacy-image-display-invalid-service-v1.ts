#!/usr/bin/env npx tsx
/**
 * PharmaConnect Image Display Invalid Service V1 — library assign/display serviceId validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignSlotImage,
  buildImageOperatingSystemDashboard,
  isImageLibraryPackKey,
  loadImageAssignments,
  normalizeImageLibraryServiceId,
} from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { buildAllVisualExperiencePages } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { renderImageLibraryDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyImageLibraryPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";

const SERVICES = [
  "blood-pressure-checks",
  "pharmacy-first",
  "travel-vaccinations",
  "emergency-contraception",
] as const;

const LIBRARY_REFS: Record<string, string> = {
  "blood-pressure-checks": "clinical-nhs-services/blood-pressure-check",
  "pharmacy-first": "clinical-nhs-services/pharmacy-first",
  "travel-vaccinations": "travel-health-services/travel-vaccination",
  "emergency-contraception": "clinical-nhs-services/contraception-service",
};

interface Check {
  serviceId: string;
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(serviceId: string, id: string, pass: boolean, detail: string) {
  checks.push({ serviceId, id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${serviceId}] ${id} — ${detail}`);
}

console.log(`\nPharmaConnect Image Display Invalid Service V1 — ${slug}\n`);

for (const serviceId of SERVICES) {
  const dashboard = buildImageOperatingSystemDashboard(slug, { serviceId });
  const html = renderImageLibraryDashboardHtml(dashboard, "hero");

  record(serviceId, "page-loads", html.includes("Pharmacy Image Library"), "Dashboard HTML renders");
  record(
    serviceId,
    "hidden-page-service-id",
    html.includes(`id="pageServiceId" value="${serviceId}"`),
    "Hidden pageServiceId matches canonical service",
  );
  record(
    serviceId,
    "canonical-service-helper",
    html.includes("function canonicalServiceId()") && html.includes("pageServiceId"),
    "Assign flow uses canonicalServiceId()",
  );
  record(
    serviceId,
    "library-card-service-id",
    html.includes(`data-service-id="${serviceId}"`) && html.includes("data-library-ref="),
    "Library cards embed canonical serviceId separate from libraryRef",
  );
  record(
    serviceId,
    "image-pack-not-service-id",
    html.includes("data-image-pack=") && !html.includes(`data-service-id="travel-health-services"`),
    "Image pack stored separately from serviceId",
  );
  record(
    serviceId,
    "reject-image-pack-as-service",
    normalizeImageLibraryServiceId("travel-health-services") === null && isImageLibraryPackKey("travel-health-services"),
    "travel-health-services rejected as serviceId",
  );
  record(
    serviceId,
    "reject-slot-as-service",
    normalizeImageLibraryServiceId("hero") === null,
    "slot name hero rejected as serviceId",
  );

  const libraryRef = LIBRARY_REFS[serviceId];
  assignSlotImage(slug, serviceId, "hero", { source: "library", libraryRef });
  const doc = loadImageAssignments(slug);
  const key = `${serviceId}:hero`;
  record(
    serviceId,
    "assignment-saves",
    doc.assignments[key]?.libraryRef === libraryRef,
    `Assigned ${libraryRef} to ${key}`,
  );

  const reloaded = buildImageOperatingSystemDashboard(slug, { serviceId });
  record(
    serviceId,
    "reload-shows-assignment",
    reloaded.pageSlots.find((p) => p.slot === "hero")?.libraryRef === libraryRef,
    "Reload shows libraryRef on hero slot",
  );
}

buildAllVisualExperiencePages(slug);
for (const serviceId of SERVICES) {
  const pageFile = path.join(ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
  const pageHtml = fs.existsSync(pageFile) ? fs.readFileSync(pageFile, "utf8") : "";
  record(
    serviceId,
    "visual-page-renders",
    pageHtml.includes('data-image-slot="hero"') && pageHtml.includes("<img"),
    fs.existsSync(pageFile) ? "Visual page has hero img" : "Visual page missing",
  );
}

const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-image-display-invalid-service-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      slug,
      services: [...SERVICES],
      summary: { passed, total, allPass: passed === total },
      checks,
      manualTestUrls: SERVICES.map(
        (s) => `/api/pharmacy-image-library?slug=${slug}&service=${s}&slot=hero`,
      ),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\n${passed}/${total} checks passed`);
console.log(`Report: ${reportPath}\n`);
process.exit(passed === total ? 0 : 1);
