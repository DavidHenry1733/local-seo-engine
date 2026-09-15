#!/usr/bin/env npx tsx
/**
 * Visual Page Image Assignment V1 — validates 16/16 images on benchmark pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllVisualExperiencePages } from "../src/pharmacy/pharmacyVisualExperience.ts";
import {
  auditVisualPageImageSlots,
  seedVisualPageImageAssignments,
} from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES } from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";

interface SlotReport {
  serviceId: string;
  slot: string;
  source: string;
  assetPath: string;
  assetExists: boolean;
  renderedImg: boolean;
  placeholderVisible: boolean;
  altPresent: boolean;
  pass: boolean;
  failures: string[];
}

function extractMain(html: string): string {
  return html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
}

function slotImgInHtml(main: string, slot: string, assetPath: string): boolean {
  const file = assetPath.split("/").pop() || assetPath;
  const base = file.replace(/\.(webp|svg|jpg|jpeg|png)$/i, "");
  return (
    main.includes(`data-image-slot="${slot}"`) &&
    (main.includes(file) || main.includes(base + ".svg") || main.includes(base + ".webp"))
  );
}

function validatePageHtml(serviceId: string, html: string, audit: ReturnType<typeof auditVisualPageImageSlots>): SlotReport[] {
  const main = extractMain(html);
  const rows = audit.filter((a) => a.serviceId === serviceId);
  return rows.map((row) => {
    const failures: string[] = [];
    if (!row.assetExists) failures.push("asset-missing-on-disk");
    if (!row.alt?.trim()) failures.push("missing-alt");
    const renderedImg = slotImgInHtml(main, row.slot, row.assetPath);
    if (!renderedImg) failures.push("no-img-in-html");
    const placeholderVisible =
      /<div class="v3-placeholder"/i.test(main) || /data-image-missing="true"/i.test(main);
    if (placeholderVisible) failures.push("placeholder-visible");
    return {
      serviceId: row.serviceId,
      slot: row.slot,
      source: row.source,
      assetPath: row.assetPath,
      assetExists: row.assetExists,
      renderedImg,
      placeholderVisible,
      altPresent: Boolean(row.alt?.trim()),
      pass: failures.length === 0,
      failures,
    };
  });
}

console.log(`\nVisual Page Image Assignment V1 — ${slug}\n`);

seedVisualPageImageAssignments(slug, true);
const auditBefore = auditVisualPageImageSlots(slug);
console.log("Resolution audit:");
for (const row of auditBefore) {
  console.log(`  ${row.serviceId}/${row.slot}: ${row.source} | ${row.assetExists ? "OK" : "FAIL"} | ${row.assetPath}`);
}

buildAllVisualExperiencePages(slug);

const allReports: SlotReport[] = [];
for (const serviceId of VISUAL_EXPERIENCE_BENCHMARK_SERVICES) {
  const file = path.join(ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
  const html = fs.readFileSync(file, "utf8");
  const reports = validatePageHtml(serviceId, html, auditBefore);
  allReports.push(...reports);
  const pass = reports.every((r) => r.pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${serviceId}${pass ? "" : ` — ${reports.flatMap((r) => r.failures).join(", ")}`}`);
}

const resolved = auditBefore.filter((r) => r.assetExists).length;
const allPass = allReports.every((r) => r.pass) && resolved === 16;

const outDir = path.join(ROOT, "data/validation-reports");
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, `visual-page-image-assignment-v1-${slug}.json`);
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      slug,
      resolvedCount: resolved,
      totalSlots: 16,
      pass: allPass,
      audit: auditBefore,
      htmlValidation: allReports,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\nResolved: ${resolved}/16`);
console.log(`Report: ${reportPath}`);
console.log(allPass ? "\n✅ ALL 16 IMAGES PASS\n" : "\n❌ VALIDATION FAILED\n");
process.exit(allPass ? 0 : 1);
