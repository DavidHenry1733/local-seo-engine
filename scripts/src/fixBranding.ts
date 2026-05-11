/**
 * fixBranding.ts
 *
 * Post-processes all generated HTML pages for a given project slug and
 * replaces legacy platform brand name occurrences ("InboxingProWeb") with
 * the correct client brand name.
 *
 * Pages generated before the project config was corrected often contain the
 * platform name in: page titles, <img> alt attributes, section labels,
 * AI-generated body text, and JSON-LD schema @type Organisation/Service names.
 *
 * Strategy:
 *   1. Fix the old platform email inside JSON-LD before masking.
 *   2. Mask all inboxingproweb.com domain URLs so they survive unchanged
 *      (they are the correct hosting domain, not brand leakage).
 *   3. Replace every remaining "InboxingProWeb" occurrence with the client
 *      business name.
 *   4. Restore masked domain URLs.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run fix:branding [slug]
 *   Defaults to "rotherham-proof" when no slug is supplied.
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE    = path.resolve(__dirname, "../..");
const OUTPUT_DIR   = path.join(WORKSPACE, "output");
const PROJECTS_DIR = path.join(WORKSPACE, "config", "projects");

interface ProjectConfig {
  businessName: string;
  email:        string;
}

function loadProject(slug: string): ProjectConfig {
  const flat = path.join(PROJECTS_DIR, `${slug}.json`);
  if (fs.existsSync(flat)) {
    return JSON.parse(fs.readFileSync(flat, "utf8")) as ProjectConfig;
  }
  const nested = path.join(PROJECTS_DIR, slug, "project.json");
  if (fs.existsSync(nested)) {
    return JSON.parse(fs.readFileSync(nested, "utf8")) as ProjectConfig;
  }
  throw new Error(`No project config found for slug: ${slug}`);
}

/**
 * Fix platform brand name leakage in a single HTML string.
 * Returns the fixed HTML, or null if no changes were needed.
 */
function fixBranding(html: string, brandName: string, brandEmail: string): string | null {
  const PLATFORM_TOKEN  = /InboxingProWeb/gi;
  const OLD_EMAIL       = /info@inboxingproweb\.com/gi;
  const DOMAIN_URL_RE   = /https?:\/\/[a-z0-9.-]*inboxingproweb\.com[^\s"'<>]*/gi;

  // Quick bail-out if nothing to fix (case-insensitive)
  if (!/inboxingproweb/i.test(html)) return null;

  let out = html;

  // 1. Fix old platform email address (JSON-LD schema and any remaining text)
  out = out.replace(OLD_EMAIL, brandEmail);

  // 2. Mask all inboxingproweb.com domain URLs with a placeholder that
  //    contains no trace of "inboxingproweb" — we restore them after the
  //    brand-name replacement so the hosting URLs are preserved.
  const urlStore: string[] = [];
  out = out.replace(DOMAIN_URL_RE, (match) => {
    const idx = urlStore.length;
    urlStore.push(match);
    return `__PLATFORM_URL_${idx}__`;
  });

  // 3. Replace the platform brand name with the client brand name.
  //    The regex is case-insensitive but replaces with a fixed-case value
  //    to handle "inboxingproweb" (lowercase) and "InboxingProWeb" (title).
  out = out.replace(PLATFORM_TOKEN, brandName);

  // 4. Restore masked domain URLs.
  for (let i = 0; i < urlStore.length; i++) {
    out = out.replace(`__PLATFORM_URL_${i}__`, urlStore[i]);
  }

  return out === html ? null : out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const slug      = process.argv[2] ?? "rotherham-proof";
const clientDir = path.join(OUTPUT_DIR, slug);

if (!fs.existsSync(clientDir)) {
  console.error(`Output directory not found: ${clientDir}`);
  process.exit(1);
}

const project   = loadProject(slug);
const brandName = project.businessName;
const brandEmail= project.email;

let fixed    = 0;
let clean    = 0;
let noHtml   = 0;

const entries = fs.readdirSync(clientDir);
for (const entry of entries) {
  const htmlPath = path.join(clientDir, entry, "index.html");
  if (!fs.existsSync(htmlPath)) { noHtml++; continue; }

  const original = fs.readFileSync(htmlPath, "utf8");
  const updated  = fixBranding(original, brandName, brandEmail);

  if (updated === null) {
    clean++;
    continue;
  }

  fs.writeFileSync(htmlPath, updated, "utf8");
  fixed++;
  console.log(`  ✓  Fixed: ${entry}`);
}

console.log(`\nSummary for "${slug}":`);
console.log(`  Brand name applied : ${brandName}`);
console.log(`  Email applied      : ${brandEmail}`);
console.log(`  Pages fixed        : ${fixed}`);
console.log(`  Already clean      : ${clean}`);
console.log(`  No HTML            : ${noHtml}`);
