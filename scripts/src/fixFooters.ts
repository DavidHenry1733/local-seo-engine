/**
 * fixFooters.ts
 *
 * Post-processes all generated HTML pages for a given project slug and
 * replaces the <footer id="site-footer"> block with a correct, fully
 * client-branded footer built from the project config JSON.
 *
 * Fixes:
 *  - Web-hosting / web-design pages that were generated with old platform
 *    footer (inboxingproweb.com links, wrong email).
 *  - Local-seo / cluster pages missing Privacy Policy and Terms links.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run fix:footers [slug]
 *   Defaults to "rotherham-proof" when no slug is supplied.
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE    = path.resolve(__dirname, "../..");
const OUTPUT_DIR   = path.join(WORKSPACE, "output");
const PROJECTS_DIR = path.join(WORKSPACE, "config", "projects");

// ---------------------------------------------------------------------------
// Load project config
// ---------------------------------------------------------------------------

interface ProjectLink  { label: string; href: string }
interface ProjectConfig {
  businessName:       string;
  domain:             string;
  email:              string;
  phone?:             string;
  businessAddress:    string;
  footerCompanyName?: string;
  companyNumber?:     string;
  footerCompanyNumber?: string;
  footerStrapline?:   string;
  strapline?:         string;
  privacyUrl?:        string;
  termsUrl?:          string;
  footerLinks?:       ProjectLink[];
  footerServiceLinks?: ProjectLink[];
  primaryCtaUrl?:     string;
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

// ---------------------------------------------------------------------------
// Build footer HTML from project config
// ---------------------------------------------------------------------------

function buildFooterHtml(p: ProjectConfig): string {
  const year        = new Date().getFullYear();
  const address     = p.businessAddress.replace(/,\s*/g, "<br>");
  const company     = p.footerCompanyName ?? p.businessName;
  const number      = p.companyNumber ?? p.footerCompanyNumber ?? "";
  const strapline   = p.footerStrapline ?? p.strapline ?? `${p.businessName} — Professional Digital Services`;
  const privacyUrl  = p.privacyUrl  ?? "/privacy-policy/";
  const termsUrl    = p.termsUrl    ?? "/terms/";

  // Footer links column: always lead with Privacy Policy + Terms, then any
  // additional links from footerLinks that are not privacy/terms duplicates.
  const extraLinks = (p.footerLinks ?? []).filter(
    (l) => !l.label.toLowerCase().includes("privacy") && !l.label.toLowerCase().includes("terms")
  );
  const linkItems: ProjectLink[] = [
    { label: "Privacy Policy",   href: privacyUrl },
    { label: "Terms of Service", href: termsUrl },
    ...extraLinks,
  ];
  const footerLinksHtml = linkItems
    .map((l) => `          <p><a href="${l.href}">${l.label}</a></p>`)
    .join("\n");

  // Services column
  const serviceItems: ProjectLink[] = p.footerServiceLinks ?? [];
  const serviceLinksHtml = serviceItems.length > 0
    ? serviceItems.map((l) => `          <p><a href="${l.href}">${l.label}</a></p>`).join("\n")
    : `          <p>Web Design</p>\n          <p>Local SEO</p>\n          <p>Hosting</p>`;

  // Phone — only include if not garbled (must look like a real number)
  const phone = p.phone ?? "";
  const phoneClean = phone.replace(/\s/g, "");
  const phoneValid = /^\+?[\d()\s-]{7,}$/.test(phone) && phoneClean.length >= 7;
  const phoneHtml  = phoneValid
    ? `\n          <p><a href="tel:${phoneClean}">${phone}</a></p>`
    : "";

  return `<footer id="site-footer" class="site-footer">
  <div class="wrap">
    <div class="footer-grid">

      <div>
        <h4>About</h4>
        <p>${strapline}</p>
      </div>

      <div>
        <h4>Links</h4>
${footerLinksHtml}
      </div>

      <div>
        <h4>Services</h4>
${serviceLinksHtml}
      </div>

      <div>
        <h4>Contact</h4>
        <p>${address}</p>${phoneHtml}
        <p><a href="mailto:${p.email}">${p.email}</a></p>
      </div>

    </div>
  </div>
  <div class="footer-bottom">
    &copy; ${year} ${company} &ndash; Company Number ${number} &ndash; All Rights Reserved
  </div>
</footer>`;
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

const project    = loadProject(slug);
const newFooter  = buildFooterHtml(project);

// Regex: match from <footer id="site-footer" to </footer> (non-greedy, multiline)
const FOOTER_RE  = /<footer\s+id="site-footer"[\s\S]*?<\/footer>/i;

let fixed   = 0;
let clean   = 0;
let noFooter = 0;

const entries = fs.readdirSync(clientDir);
for (const entry of entries) {
  const htmlPath = path.join(clientDir, entry, "index.html");
  if (!fs.existsSync(htmlPath)) continue;

  const original = fs.readFileSync(htmlPath, "utf8");

  if (!FOOTER_RE.test(original)) {
    console.log(`  ⚠  No footer found: ${entry}`);
    noFooter++;
    continue;
  }

  const updated = original.replace(FOOTER_RE, newFooter);

  if (updated === original) {
    clean++;
    continue;
  }

  fs.writeFileSync(htmlPath, updated, "utf8");
  fixed++;
  console.log(`  ✓  Fixed: ${entry}`);
}

console.log(`\nSummary for "${slug}":`);
console.log(`  Fixed    : ${fixed}`);
console.log(`  Already clean : ${clean}`);
console.log(`  No footer: ${noFooter}`);
console.log(`  Total dirs: ${entries.length}`);
