#!/usr/bin/env npx tsx
/**
 * Production output cleanup — removes demo/preview artefacts from generated HTML only.
 * Does not regenerate content or modify generation templates.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = process.argv[2] || "broom-lane-pharmacy";
const SERVICE = process.argv[3] || "pharmacy-first";
const HOME_URL = process.argv[4] || "https://www.broomlanepharmacy.co.uk/";

const TARGET_DIRS = [
  path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE),
  path.join(ROOT, "output/pharmacy-visual-experience", SLUG, SERVICE),
  path.join(ROOT, "output/pharmacy-publish", SLUG, SERVICE),
  path.join(ROOT, "output/pharmacy-master-publish", SLUG, SERVICE),
];

function listHtmlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

export function cleanupProductionHtml(html: string, homeUrl: string): string {
  let out = html;

  out = out.replace(/<div class="demo-banner">[\s\S]*?<\/div>\s*/gi, "");
  out = out.replace(/<style>\s*\.demo-banner\{[^<]*<\/style>\s*/gi, "");
  out = out.replace(/\.demo-banner\{[^}]+\}\s*/g, "");

  out = out.replace(/\.trust-demo-notice\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.trust-demo-notice strong\s*\{[^}]+\}\s*/g, "");
  out = out.replace(
    /body\[data-pharmacy-template="lockdown-v1"\]\s*\[data-component="pharmacy-trust-demo-notice"\]\s*\{\s*display:\s*none\s*!important;\s*\}\s*/g,
    "",
  );

  out = out.replace(/<[^>]*data-component="pharmacy-trust-demo-notice"[\s\S]*?<\/[^>]+>\s*/gi, "");
  out = out.replace(/<div class="trust-demo-notice"[\s\S]*?<\/div>\s*/gi, "");
  out = out.replace(/<div class="preview-banner"[\s\S]*?<\/div>\s*/gi, "");
  out = out.replace(/<footer class="preview-footer"[\s\S]*?<\/footer>\s*/gi, "");

  out = out.replace(/\.preview-banner\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-banner strong\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-footer\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-footer-inner\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-footer h3\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-footer p\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-footer a:hover\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-footer a\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\.preview-footer-note\s*\{[^}]+\}\s*/g, "");
  out = out.replace(/\s*\.preview-footer-inner\s*\{\s*grid-template-columns:\s*1fr;\s*\}\s*/g, "");

  out = out.replace(/<a href="#">Home<\/a>/g, `<a href="${homeUrl}">Home</a>`);

  return out;
}

function main() {
  const files = TARGET_DIRS.flatMap(listHtmlFiles);
  let changed = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    const after = cleanupProductionHtml(before, HOME_URL);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
    }
  }
  console.log(`Cleaned ${changed}/${files.length} HTML files for ${SLUG}/${SERVICE}`);
}

main();
