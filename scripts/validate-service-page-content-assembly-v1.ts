#!/usr/bin/env npx tsx
/**
 * Service Page Content Assembly Fix V1.
 *
 * Validates the generated visual service page contains complete customer-facing content.
 */
import fs from "node:fs";
import { buildVisualExperiencePage, resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const checks: Check[] = [];
const forbidden = /Brook Pharmacy|Rowlands Pharmacy|DHM Digital|pharmacy\.inboxingproweb\.com|demo pharmacy/i;

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

function readGeneratedHtml(): { html: string; filePath: string } {
  const built = buildVisualExperiencePage(slug, campaignId as any);
  const filePath = resolveVisualExperienceHtmlPath(campaignId, slug) || built.outputPath;
  return { html: fs.readFileSync(filePath, "utf8"), filePath };
}

function hasVisibleImageState(html: string): boolean {
  const missingPanels = [...html.matchAll(/<div[^>]*(?:image-panel|hero-image-wrap)[^>]*data-image-missing="true"[^>]*>([\s\S]*?)<\/div>/gi)];
  const noEmptyPanels = !/<div[^>]*(?:image-panel|hero-image-wrap)[^>]*data-image-missing="true"[^>]*>\s*<\/div>/i.test(html);
  const placeholdersVisible = missingPanels.every((match) => /Image will be added before publishing/i.test(match[0]));
  return /<img\b/i.test(html) || (missingPanels.length > 0 && noEmptyPanels && placeholdersVisible);
}

async function main(): Promise<void> {
  console.log(`\n=== Service Page Content Assembly V1: ${slug}/${campaignId} ===\n`);
  const { html, filePath } = readGeneratedHtml();

  record("service page contains hero", /data-template-block="hero"[\s\S]*?<h1>Pharmacy First at Pharmacy Delivered 4U<\/h1>/i.test(html), filePath);
  record("contains intro/service explanation", /data-template-block="service-definition"[\s\S]*Pharmacy First is an NHS advanced service/i.test(html), "service-definition");
  record("contains how it works", /data-template-block="process"[\s\S]*APPOINTMENT PROCESS[\s\S]*Before appointment[\s\S]*During appointment/i.test(html), "process");
  record("contains eligibility/conditions section", /data-template-block="conditions"[\s\S]*CONDITIONS COVERED/i.test(html) && /data-template-block="eligibility"[\s\S]*ELIGIBILITY/i.test(html), "conditions + eligibility");
  record("contains FAQ", /data-template-block="faq"[\s\S]*COMMON PATIENT QUESTIONS/i.test(html), "faq");
  record("contains local access", /id="local-access"[\s\S]*Pharmacy Delivered 4U[\s\S]*Rotherham/i.test(html), "local access");
  record("contains CTA", /data-template-block="final-cta"[\s\S]*Book Pharmacy First at Pharmacy Delivered 4U/i.test(html), "final cta");
  record("contains header/footer", /data-component="pharmacy-page-header"/i.test(html) && /data-component="pharmacy-page-footer"/i.test(html), "header/footer");
  record("image slots have image or visible placeholder", hasVisibleImageState(html), "image state visible");
  record("no empty image panels", !/<div[^>]*(?:image-panel|hero-image-wrap)[^>]*data-image-missing="true"[^>]*>\s*<\/div>/i.test(html), "empty image panels absent");
  record("no raw placeholder credential text", !/Professional review details available from the pharmacy|holds \[\]|SOCIAL CONTENT LIBRARY/i.test(html), "raw placeholders absent");
  record("professional fallback is honest", /Reviewed by the pharmacy team\. Full professional details can be added before publishing\./i.test(html), "review fallback");
  record("no Brook/Rowlands/DHM strings", !forbidden.test(html), "demo content absent");

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
