#!/usr/bin/env npx tsx
/**
 * Approved Pharmacy Template Restore V1 — validates fixed lockdown-v1 slot layout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllVisualExperiencePages, validateVisualExperienceHtml } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import {
  buildPharmacyTheme,
  LARGE_SECTION_BACKGROUND_SELECTORS,
  PHARMACY_VISUAL_PIPELINE_VERSION,
  sectionUsesSolidBrandBlueBackground,
} from "../src/pharmacy/pharmacyThemeEngine.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import { bodyContainsForbiddenPhrases } from "../src/pharmacy/pharmacyServicePageBodyLocalisation.ts";
import { validateCardBodiesComplete } from "../src/pharmacy/pharmacyServicePageBalance.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";

const profile = buildPharmacyServicePageProfile(slug);
const theme = buildPharmacyTheme(profile);
const LSE_LEAKS = ["#0969ff", "Montserrat", "Raleway", "cluster.html", "web-design-rotherham", "InboxingProWeb"];

interface PageReport {
  serviceId: string;
  pass: boolean;
  failures: string[];
}

function extractMain(html: string): string {
  return html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
}

function extractStyle(html: string): string {
  return html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "";
}

function validatePage(serviceId: string, html: string): PageReport {
  const failures: string[] = [];
  const main = extractMain(html);
  const style = extractStyle(html);
  const layout = validateVisualExperienceHtml(html, serviceId);
  if (!layout.pass) failures.push(...layout.failures.map((f) => `layout:${f}`));

  if (!html.includes(`data-pipeline-version="${PHARMACY_VISUAL_PIPELINE_VERSION}"`)) failures.push("missing-pipeline-version");
  if (!main.includes("hero-grid")) failures.push("missing-hero-5050");
  if (!main.includes("hero-image-wrap") && !main.includes("hero-media")) failures.push("missing-hero-image");
  if (!main.includes('id="pharmacy-trust-cards"')) failures.push("missing-trust-cards");
  if (!main.includes('data-template-block="service-definition"')) failures.push("missing-service-definition-split");
  if (!main.includes("definition-split-row")) failures.push("missing-definition-split");
  if (!main.includes('data-template-block="conditions"')) failures.push("missing-conditions-grid");
  if (!main.includes("process-grid")) failures.push("missing-process-grid");
  if (!main.includes('data-template-block="support-image"')) failures.push("missing-support-image-band");
  if (!main.includes('data-template-block="safety"')) failures.push("missing-safety-panel");
  if (!main.includes('data-template-block="trust-split"')) failures.push("missing-trust-section");
  if (!main.includes('id="faq-section"')) failures.push("missing-faq");
  if (!main.includes('id="local-access"')) failures.push("missing-local-access");
  if (!main.includes("cta-band")) failures.push("missing-final-cta");
  if (!html.includes('data-component="pharmacy-page-footer"')) failures.push("missing-footer");

  if (main.includes('data-template-block="benefits"')) failures.push("dashboard-benefits-dump");
  if (/<div class="compare">/.test(main)) failures.push("dashboard-compare-dump");
  if (main.includes('data-template-block="proof-band"')) failures.push("proof-band-dump");

  const cardCount = (main.match(/class="card equal-height-card"/g) || []).length;
  if (cardCount > 22) failures.push(`excessive-card-count:${cardCount}`);
  if (cardCount < 8) failures.push(`too-few-structured-cards:${cardCount}`);

  if (!style.includes(`--brand-primary:${theme.primaryColor}`)) failures.push("missing-brand-primary");
  for (const leak of LSE_LEAKS) {
    if (html.includes(leak)) failures.push(`lse-leak:${leak}`);
  }
  for (const selector of LARGE_SECTION_BACKGROUND_SELECTORS) {
    if (sectionUsesSolidBrandBlueBackground(style, selector)) {
      failures.push(`solid-brand-blue-background:${selector}`);
    }
  }

  if (!main.includes(profile.pharmacyName)) failures.push("missing-pharmacy-name");
  if (!main.includes(profile.town)) failures.push("missing-town");
  if (!main.includes(profile.phone.replace(/\s/g, "")) && !main.includes(profile.phone)) failures.push("missing-phone");

  const forbidden = bodyContainsForbiddenPhrases(html);
  if (forbidden.length) failures.push(...forbidden.map((p) => `forbidden:${p}`));

  const cardAudit = validateCardBodiesComplete(html);
  if (!cardAudit.pass) failures.push(...cardAudit.issues.slice(0, 3).map((i) => `incomplete-card:${i.context}`));

  if ((main.match(/Clinical guidance/gi) || []).length > 1) failures.push("duplicate-clinical-guidance");
  if ((main.match(/Important guidance/gi) || []).length > 1) failures.push("duplicate-important-guidance");

  return { serviceId, pass: failures.length === 0, failures };
}

console.log(`\nApproved Pharmacy Template Restore V1 — ${slug}`);
console.log(`Profile: ${profile.pharmacyName} · theme ${theme.primaryColor}`);
console.log(`Pipeline: ${PHARMACY_VISUAL_PIPELINE_VERSION}\n`);

buildAllVisualExperiencePages(slug);

const reports: PageReport[] = [];
for (const serviceId of VISUAL_EXPERIENCE_BENCHMARK_SERVICES) {
  const file = path.join(ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const report = validatePage(serviceId, html);
  reports.push(report);
  console.log(`${report.pass ? "PASS" : "FAIL"}  ${serviceId}${report.failures.length ? ` — ${report.failures.join(", ")}` : ""}`);
}

const allPass = reports.every((r) => r.pass);
const outDir = path.join(ROOT, "data/validation-reports");
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, `approved-pharmacy-template-restore-v1-${slug}.json`);
fs.writeFileSync(
  reportPath,
  JSON.stringify({ slug, theme, pipelineVersion: PHARMACY_VISUAL_PIPELINE_VERSION, pass: allPass, pages: reports, generatedAt: new Date().toISOString() }, null, 2),
  "utf8",
);

console.log(`\nReport: ${reportPath}`);
console.log(allPass ? "\n✅ ALL PAGES PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
