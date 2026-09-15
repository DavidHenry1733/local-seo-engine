#!/usr/bin/env npx tsx
/**
 * Pharmacy Visual Final Fix V1 — P0 regression validation for consolidated pipeline.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllVisualExperiencePages } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import {
  buildPharmacyTheme,
  LARGE_SECTION_BACKGROUND_SELECTORS,
  NHS_INFORMATIONAL_BLUE,
  PHARMACY_VISUAL_PIPELINE_VERSION,
  sectionUsesSolidBrandBlueBackground,
} from "../src/pharmacy/pharmacyThemeEngine.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import { bodyContainsForbiddenPhrases } from "../src/pharmacy/pharmacyServicePageBodyLocalisation.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";

const profile = buildPharmacyServicePageProfile(slug);
const theme = buildPharmacyTheme(profile);

const LSE_LEAKS = ["#0969ff", "Montserrat", "Raleway", "cluster.html", "web-design-rotherham", "InboxingProWeb"];
const GENERIC_PHRASES = [
  "whether the pharmacy offers",
  "the pharmacy offers",
  "participating pharmacy",
  "not every pharmacy offers",
  "in supermarkets, and in neighbourhoods",
  "ask the pharmacy",
];

interface PageReport {
  serviceId: string;
  pass: boolean;
  failures: string[];
}

function extractStyle(html: string): string {
  return html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "";
}

function extractMain(html: string): string {
  return html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
}

function countOccurrences(haystack: string, needle: string): number {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (haystack.match(re) || []).length;
}

function validatePage(serviceId: string, html: string): PageReport {
  const failures: string[] = [];
  const style = extractStyle(html);
  const main = extractMain(html);

  if (!html.includes(`data-pipeline-version="${PHARMACY_VISUAL_PIPELINE_VERSION}"`)) {
    failures.push("missing-pipeline-version");
  }
  if (!style.includes(`--brand-primary:${theme.primaryColor}`)) {
    failures.push("missing-brand-primary-css-var");
  }
  if (!style.includes(`--brand-secondary:${theme.secondaryColor}`)) {
    failures.push("missing-brand-secondary-css-var");
  }
  if (!style.includes(`--brand-cta:${theme.ctaColor}`)) {
    failures.push("missing-brand-cta-css-var");
  }

  for (const forbidden of LSE_LEAKS) {
    if (html.includes(forbidden)) failures.push(`lse-leak:${forbidden}`);
  }

  for (const selector of LARGE_SECTION_BACKGROUND_SELECTORS) {
    if (sectionUsesSolidBrandBlueBackground(style, selector)) {
      failures.push(`solid-brand-blue-background:${selector}`);
    }
  }
  if (
    /--blue:\s*#005eb8/i.test(style) ||
    /--blue:\s*#005EB8/.test(style)
  ) {
    failures.push("nhs-blue-hardcoded-as-theme-var");
  }

  if (!main.includes(profile.pharmacyName)) failures.push("missing-pharmacy-name-in-body");
  if (!main.includes(profile.town)) failures.push("missing-town-in-body");
  if (!main.includes(profile.phone.replace(/\s/g, "")) && !main.includes(profile.phone)) {
    failures.push("missing-phone-in-body");
  }

  for (const phrase of GENERIC_PHRASES) {
    if (main.toLowerCase().includes(phrase)) failures.push(`generic-phrase:${phrase}`);
  }

  const forbiddenBody = bodyContainsForbiddenPhrases(html);
  if (forbiddenBody.length) failures.push(...forbiddenBody.map((p) => `forbidden:${p}`));

  if (countOccurrences(main, "Clinical guidance") > 1) failures.push("duplicate-clinical-guidance");
  if (countOccurrences(main, "Important guidance") > 1) failures.push("duplicate-important-guidance");

  const faqAnswers = [...main.matchAll(/class="faq-a"[^>]*>([^<]+)</gi)].map((m) => m[1]?.trim().toLowerCase());
  const faqDupes = faqAnswers.filter((a, i) => faqAnswers.indexOf(a) !== i);
  if (faqDupes.length) failures.push("duplicate-faq-answers");

  if (!html.includes('data-component="pharmacy-local-map"') && !html.includes("<iframe")) {
    failures.push("missing-map");
  }
  if (!html.includes("hero-grid")) failures.push("missing-hero-5050");
  if (!html.includes('id="pharmacy-trust-cards"')) failures.push("missing-trust-cards");
  if (!html.includes("definition-split-row") && !html.includes("service-breakdown")) {
    failures.push("missing-definition-split");
  }
  if (!html.includes("cta-band")) failures.push("missing-final-cta");
  if (!html.includes('data-component="pharmacy-page-footer"')) failures.push("missing-profile-footer");
  if (/<main[^>]*>[\s\S]*<h2[^>]*>[\s\S]*<p>[\s\S]*<\/p>[\s\S]*<h2/.test(main) && !html.includes("card-grid-equal")) {
    failures.push("plain-stacked-layout");
  }

  if (serviceId === "pharmacy-first") {
    if (!main.includes("Book Pharmacy First at Brook Pharmacy")) failures.push("missing-pharmacy-first-cta-heading");
    if (!main.includes("walk-in support is available")) failures.push("missing-pharmacy-first-cta-body");
  }

  return { serviceId, pass: failures.length === 0, failures };
}

console.log(`\nPharmacy Visual Final Fix V1 — ${slug}`);
console.log(`Profile: ${profile.pharmacyName} · theme ${theme.primaryColor} / ${theme.secondaryColor} / ${theme.ctaColor}`);
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
const reportPath = path.join(outDir, `pharmacy-visual-final-fix-v1-${slug}.json`);
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
