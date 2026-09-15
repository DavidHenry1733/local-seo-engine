#!/usr/bin/env npx tsx
/**
 * STAGING-PREVIEW-PARITY-41F
 * Validates staging packaging preview parity without publishing or mutating sources.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readActiveServiceCampaignSelection } from "../src/pharmacy/masterAdminActiveServiceCampaignStore.ts";
import {
  extractVisibleStagingServiceHubCta,
  packageLockedCampaignStagingRelease,
  PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID,
  resolveLockedCampaignStagingInventory,
  STAGING_ROBOTS_TXT,
  STAGING_SERVICE_OVERVIEW_ALIGN_MARKER,
  stagingLocalityNavHeading,
  stagingLocalityPublicPath,
  stagingServiceHubCtaButtonLabel,
  stagingServiceHubCtaHeading,
  stagingServicePublicPath,
} from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FLU = "flu-vaccinations";
const BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";
const STAGING = "https://yorkshire-pharmacy-and-health-clinic.sites.pharmaconnect.uk";
const AREAS = [
  "darfield",
  "wombwell",
  "thurnscoe",
  "grimethorpe",
  "goldthorpe",
  "worsbrough",
  "hoyland",
  "cudworth",
];

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function shaFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function snapshotSources(): Record<string, string | null> {
  const out: Record<string, string | null> = {
    service: shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, FLU, "index.html")),
    assembler: shaFile(path.join(ROOT, "src/pharmacy/pharmacyPublishPackageAssembler.ts")),
    fluBank: shaFile(path.join(ROOT, "data/pharmacy-approved-service-banks/banks", FLU, `${BANK}.json`)),
    fluApproval: shaFile(path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${FLU}.json`)),
    activeCampaign: shaFile(path.join(ROOT, "data/pharmacy-master-admin/active-service-campaign", `${SLUG}.json`)),
    bpService: shaFile(path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "blood-pressure-checks", "index.html")),
    bpDarfield: shaFile(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, "blood-pressure-checks", "local/darfield/index.html"),
    ),
  };
  for (const area of AREAS) {
    out[`local:${area}`] = shaFile(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, FLU, "local", area, "index.html"),
    );
  }
  return out;
}

function htmlOf(files: Array<{ relativePath: string; contents: Buffer }>, rel: string): string {
  return files.find((f) => f.relativePath === rel)?.contents.toString("utf8") || "";
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/\bhref=["']([^"']+)["']/gi)].map((m) => m[1]);
}

async function main(): Promise<void> {
  const before = snapshotSources();
  const activeBefore = readActiveServiceCampaignSelection(SLUG);
  const inventory = resolveLockedCampaignStagingInventory(SLUG, FLU);
  const packed = packageLockedCampaignStagingRelease(inventory);
  record(
    "package-ok",
    inventory.ok && packed.ok,
    packed.ok ? `files=${packed.pkg.files.length}` : [...inventory.blockers, ...(packed.ok ? [] : packed.blockers)].join("; "),
  );
  if (!packed.ok) throw new Error("package failed; remaining checks skipped");
  const pkg = packed.pkg;
  const serviceHtml = htmlOf(pkg.files, `${FLU}/index.html`);
  const hub = stagingServicePublicPath(FLU);
  const heading = stagingServiceHubCtaHeading(FLU);
  const button = stagingServiceHubCtaButtonLabel(FLU);
  const localityHrefs = AREAS.map((area) => stagingLocalityPublicPath(FLU, area));

  const css = serviceHtml.includes(PHARMACONNECT_SERVICE_PAGE_PRESENTATION_CONTRACT_ID);
  const marker = serviceHtml.includes(STAGING_SERVICE_OVERVIEW_ALIGN_MARKER);
  const tagCentered =
    serviceHtml.includes("#service-definition .definition-split-copy>.tag") &&
    /#service-definition \.section-opening-copy>\.tag\{display:inline-block;text-align:center;margin-left:auto;margin-right:auto/.test(
      serviceHtml,
    );
  const parasCentered =
    serviceHtml.includes("#service-definition .definition-split-copy>p") &&
    /#service-definition \.section-opening-copy>p\{text-align:center;max-width:var\(--reading-width-narrative\);margin:0 auto 18px/.test(
      serviceHtml,
    );
  const readableWidth = serviceHtml.includes("--reading-width-narrative:720px");
  const mobile =
    /@media\(max-width:960px\)/.test(serviceHtml) && serviceHtml.includes("--reading-width-narrative:100%");
  const notFluSpecific = !/\[data-pharmacy-service=["']flu-vaccinations["']\][^{]*#service-definition/.test(serviceHtml);
  record(
    "service-overview-alignment",
    css && marker && tagCentered && parasCentered && readableWidth && mobile && notFluSpecific,
    `contract=${css} marker=${marker} tag=${tagCentered} paras=${parasCentered} width=${readableWidth} mobile=${mobile} shared=${notFluSpecific}`,
  );

  const missingCtas: string[] = [];
  for (const area of AREAS) {
    const html = htmlOf(pkg.files, `${FLU}/local/${area}/index.html`);
    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi)]
      .map((m) => m[0])
      .join("");
    const cta = extractVisibleStagingServiceHubCta(html);
    const buttonHref =
      cta?.match(
        new RegExp(`<a[^>]*class=["'][^"']*btn-white[^"']*["'][^>]*href=["']${hub}["'][^>]*>\\s*${button}`, "i"),
      ) ||
      cta?.match(
        new RegExp(`<a[^>]*href=["']${hub}["'][^>]*class=["'][^"']*btn-white[^"']*["'][^>]*>\\s*${button}`, "i"),
      );
    const headingInCta = Boolean(cta && cta.includes(`>${heading}</h2>`));
    const headingOnlyInJsonLd = jsonLd.includes(heading) && !headingInCta;
    const siblingKept = /data-template-block=["']parent-child-links["']/.test(html);
    if (!cta || !headingInCta || !buttonHref || headingOnlyInJsonLd || !siblingKept) {
      missingCtas.push(area);
    }
  }
  record(
    "eight-visible-locality-to-hub-ctas",
    missingCtas.length === 0,
    missingCtas.length ? `missing=${missingCtas.join(",")}` : `heading=${heading} button=${button} href=${hub}`,
  );

  const serviceNav =
    serviceHtml.includes(stagingLocalityNavHeading(FLU)) &&
    localityHrefs.every((href) => hrefs(serviceHtml).includes(href));
  record(
    "service-to-locality-navigation",
    serviceNav,
    serviceNav ? `links=${localityHrefs.length}` : "service page missing locality links",
  );

  const allowed = new Set([hub, ...localityHrefs]);
  const broken: string[] = [];
  const htmlFiles = pkg.files.filter((f) => f.relativePath.endsWith("index.html"));
  for (const file of htmlFiles) {
    const html = file.contents.toString("utf8");
    for (const href of hrefs(html)) {
      if (/^(mailto:|tel:|#)/i.test(href)) continue;
      if (/^https?:\/\/(?:(?:www\.)?google\.com\/maps|maps\.google|fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(href)) {
        continue;
      }
      if (href.startsWith("/assets/") || href === "/robots.txt") continue;
      let pathOnly = href;
      if (/^https?:\/\//i.test(href)) {
        try {
          const url = new URL(href);
          if (url.origin.replace(/\/+$/, "") === STAGING && (url.pathname === "/" || url.pathname === "")) continue;
          pathOnly = url.pathname;
        } catch {
          broken.push(`${file.relativePath}:${href}`);
          continue;
        }
      }
      pathOnly = pathOnly.replace(/\/?$/, "/");
      if (pathOnly === "/") continue;
      if (!allowed.has(pathOnly)) broken.push(`${file.relativePath}:${href}`);
    }
  }
  record(
    "internal-campaign-paths",
    broken.length === 0,
    broken.length ? broken.slice(0, 8).join(" | ") : "all internal campaign hrefs resolve",
  );

  const identityOk =
    htmlFiles.length === 9 &&
    htmlFiles.every((f) => /name="robots"\s+content="noindex, nofollow"/.test(f.contents.toString("utf8"))) &&
    htmlFiles.every((f) => f.contents.toString("utf8").includes(`rel="canonical" href="${STAGING}`)) &&
    htmlFiles.every((f) => {
      const html = f.contents.toString("utf8");
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
      return blocks.length > 0 && blocks.every((block) => block[1].includes(STAGING));
    }) &&
    pkg.files.some((f) => f.relativePath === "robots.txt" && f.contents.toString("utf8") === STAGING_ROBOTS_TXT) &&
    !pkg.files.some((f) => f.relativePath === "sitemap.xml");
  record(
    "canonical-jsonld-noindex",
    identityOk,
    `html=${htmlFiles.length} staging=${STAGING}`,
  );

  const after = snapshotSources();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  const activeAfter = readActiveServiceCampaignSelection(SLUG);
  record(
    "source-integrity",
    mutated.length === 0 &&
      activeAfter?.campaignId === activeBefore?.campaignId &&
      activeAfter?.serviceId === "blood-pressure-checks",
    mutated.length ? `mutated=${mutated.join(",")}` : "approved source files unchanged",
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS staging-preview-parity-41f");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
