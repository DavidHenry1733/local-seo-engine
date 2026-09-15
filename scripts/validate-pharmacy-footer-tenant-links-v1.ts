#!/usr/bin/env npx tsx
/**
 * Footer tenant link safety — no cross-tenant URL leakage in profile or rendered footers.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { renderPharmacyServicePageFooter } from "../src/pharmacy/pharmacyServicePageDesignSystem.ts";
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES_DIR = path.join(ROOT, "data/pharmacy-profiles");
const SERVICE_ID = "blood-pressure-checks";

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

function loadProfile(slug: string) {
  const file = path.join(PROFILES_DIR, `${slug}.json`);
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8")));
}

function footerHtmlFor(slug: string): string {
  const profile = buildPharmacyServicePageProfile(slug);
  return renderPharmacyServicePageFooter(profile, "Blood Pressure Checks");
}

function scanOutputHtml(slug: string): string[] {
  const base = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, SERVICE_ID);
  const files: string[] = [];
  if (!fs.existsSync(base)) return files;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) files.push(full);
    }
  };
  walk(base);
  return files;
}

function htmlBodyContent(html: string): string {
  const m = html.match(/<body[\s\S]*$/i);
  return m?.[0] ?? html;
}

function main() {
  console.log("\n=== Pharmacy Footer Tenant Links V1 ===\n");

  const pharmaconnectDoc = loadProfile("pharmaconnect");
  const dhmdigitalDoc = loadProfile("dhmdigital");

  const pcFooterLinks = pharmaconnectDoc.data.footerLinks || [];
  record(
    "pharmaconnect-profile-no-dhmdigital",
    !pcFooterLinks.some((l) => /dhmdigital\.net/i.test(l.url)),
    `${pcFooterLinks.length} footer link(s)`,
  );
  record(
    "pharmaconnect-profile-pharmaconnect-domain",
    pcFooterLinks.every((l) => !l.url || /pharmaconnect\.uk/i.test(l.url) || /brookpharmacy|inboxingproweb/i.test(l.url)),
    pcFooterLinks.map((l) => l.url).join(", ") || "none",
  );

  const dhFooterLinks = dhmdigitalDoc.data.footerLinks || [];
  record(
    "dhmdigital-profile-no-pharmaconnect-uk",
    !dhFooterLinks.some((l) => /pharmaconnect\.uk/i.test(l.url)),
    `${dhFooterLinks.length} footer link(s)`,
  );

  buildVisualExperiencePage("pharmaconnect", SERVICE_ID);
  buildVisualExperiencePage("dhmdigital", SERVICE_ID);

  const pcFooterRendered = footerHtmlFor("pharmaconnect");
  const dhFooterRendered = footerHtmlFor("dhmdigital");

  record(
    "pharmaconnect-rendered-footer-no-dhmdigital",
    !/dhmdigital\.net/i.test(pcFooterRendered),
    "renderPharmacyServicePageFooter",
  );
  record(
    "dhmdigital-rendered-footer-no-pharmaconnect-uk",
    !/pharmaconnect\.uk/i.test(dhFooterRendered),
    "renderPharmacyServicePageFooter",
  );

  const pcVisualPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-visual-experience/pharmaconnect",
    SERVICE_ID,
    "index.html",
  );
  if (fs.existsSync(pcVisualPath)) {
    const visualHtml = fs.readFileSync(pcVisualPath, "utf8");
    record(
      "pharmaconnect-service-page-no-dhmdigital",
      !/dhmdigital\.net/i.test(htmlBodyContent(visualHtml)),
      pcVisualPath,
    );
  }

  const dhVisualPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-visual-experience/dhmdigital",
    SERVICE_ID,
    "index.html",
  );
  if (fs.existsSync(dhVisualPath)) {
    const visualHtml = fs.readFileSync(dhVisualPath, "utf8");
    record(
      "dhmdigital-service-page-no-pharmaconnect-uk",
      !/pharmaconnect\.uk/i.test(htmlBodyContent(visualHtml)),
      dhVisualPath,
    );
  }

  for (const file of scanOutputHtml("pharmaconnect").slice(0, 12)) {
    const html = fs.readFileSync(file, "utf8");
    const rel = path.relative(PHARMACY_WORKSPACE_ROOT, file);
    record(
      `pharmaconnect-output:${path.basename(path.dirname(file))}-no-dhmdigital`,
      !/dhmdigital\.net/i.test(htmlBodyContent(html)),
      rel,
    );
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
