#!/usr/bin/env npx tsx
/**
 * Pharmacy Visual Template Regression V2 — consolidated pipeline validation.
 * Ensures all four benchmark pages share one renderer, theme, and profile branding.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAllVisualExperiencePages,
  validateVisualExperienceHtml,
} from "../src/pharmacy/pharmacyVisualExperience.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { buildPharmacyTheme, NHS_INFORMATIONAL_BLUE, PHARMACY_VISUAL_PIPELINE_VERSION } from "../src/pharmacy/pharmacyThemeEngine.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import {
  validateCardBodiesComplete,
} from "../src/pharmacy/pharmacyServicePageBalance.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";

const LSE_FORBIDDEN = ["#0969ff", "cluster.html", "web-design-rotherham", "InboxingProWeb", "Montserrat", "Raleway"];
const profile = buildPharmacyServicePageProfile(slug);
const theme = buildPharmacyTheme(profile);

interface PageReport {
  serviceId: string;
  pass: boolean;
  failures: string[];
}

function extractStyleBlock(html: string): string {
  const m = html.match(/<style>([\s\S]*?)<\/style>/i);
  return m?.[1] ?? "";
}

function validatePage(serviceId: string, html: string): PageReport {
  const failures: string[] = [];
  const layout = validateVisualExperienceHtml(html, serviceId);
  if (!layout.pass) failures.push(...layout.failures.map((f) => `layout:${f}`));

  if (!html.includes(`data-pipeline-version="${PHARMACY_VISUAL_PIPELINE_VERSION}"`)) {
    failures.push("missing-pipeline-version");
  }
  if (!html.includes('data-component="pharmacy-page-header"')) failures.push("missing-profile-header");
  if (!html.includes('data-component="pharmacy-page-footer"')) failures.push("missing-profile-footer");
  if (!html.includes(profile.pharmacyName)) failures.push("missing-pharmacy-name");
  if (!html.includes(theme.primaryColor)) failures.push("missing-profile-primary-color");
  if (html.includes("--blue:#0969ff") || html.includes("--blue: #0969ff")) failures.push("lse-blue-leak");

  const style = extractStyleBlock(html);
  for (const token of LSE_FORBIDDEN) {
    if (style.includes(token)) failures.push(`forbidden-style:${token}`);
  }

  if (!html.includes('data-component="pharmacy-local-map"') && !html.includes("<iframe")) {
    failures.push("missing-map");
  }
  if (!html.includes('id="local-access"')) failures.push("missing-local-access");
  if (!html.includes("cta-band")) failures.push("missing-cta-band");

  const cardAudit = validateCardBodiesComplete(html);
  if (!cardAudit.pass) {
    failures.push(...cardAudit.issues.map((i) => `card-body:${i.context || i.reason}`));
  }

  return { serviceId, pass: failures.length === 0, failures };
}

console.log(`\nPharmacy Visual Template Regression V2 — ${slug}`);
console.log(`Profile: ${profile.pharmacyName} · theme primary ${theme.primaryColor}`);
console.log(`Pipeline: ${PHARMACY_VISUAL_PIPELINE_VERSION}\n`);

buildAllVisualExperiencePages(slug);

const reports: PageReport[] = [];
for (const serviceId of VISUAL_EXPERIENCE_BENCHMARK_SERVICES) {
  const file = path.join(ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const report = validatePage(serviceId, html);
  reports.push(report);
  const status = report.pass ? "PASS" : "FAIL";
  console.log(`${status}  ${serviceId}${report.failures.length ? ` — ${report.failures.join(", ")}` : ""}`);
}

const allPass = reports.every((r) => r.pass);
const outDir = path.join(ROOT, "data/validation-reports");
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, `pharmacy-visual-template-regression-v2-${slug}.json`);
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      slug,
      pipelineVersion: PHARMACY_VISUAL_PIPELINE_VERSION,
      theme,
      nhsInformationalBlue: NHS_INFORMATIONAL_BLUE,
      generatedAt: new Date().toISOString(),
      pass: allPass,
      pages: reports,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ ALL PAGES PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
