#!/usr/bin/env npx tsx
/**
 * STAGING-CAMPAIGN-NAVIGATION-41E
 * Validates Flu staging package navigation without publishing or mutating sources.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readActiveServiceCampaignSelection } from "../src/pharmacy/masterAdminActiveServiceCampaignStore.ts";
import {
  packageLockedCampaignStagingRelease,
  resolveLockedCampaignStagingInventory,
  STAGING_ROBOTS_TXT,
  stagingLocalityNavHeading,
  stagingLocalityPublicPath,
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
const OTHER_SERVICES = ["pharmacy-first", "travel-vaccinations", "blood-pressure-checks", "prescription-dispensing"];

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

function pathOf(href: string): string | null {
  if (/^(mailto:|tel:|#)/i.test(href)) return null;
  if (
    /^https?:\/\/(?:(?:www\.)?google\.com\/maps|maps\.google|fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(href)
  ) {
    return null;
  }
  let pathOnly = href;
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if (url.origin.replace(/\/+$/, "") !== STAGING) return href;
      pathOnly = url.pathname;
    } catch {
      return href;
    }
  }
  if (pathOnly.startsWith("/assets/") || pathOnly === "/robots.txt") return null;
  if (pathOnly === "/") return null;
  return pathOnly.replace(/\/?$/, "/");
}

async function main(): Promise<void> {
  const before = snapshotSources();
  const activeBefore = readActiveServiceCampaignSelection(SLUG);
  const inventory = resolveLockedCampaignStagingInventory(SLUG, FLU);
  const packed = packageLockedCampaignStagingRelease(inventory);
  record(
    "package-ok",
    inventory.ok && packed.ok && inventory.lockedBankHash === BANK,
    packed.ok ? `files=${packed.pkg.files.length}` : [...inventory.blockers, ...(packed.ok ? [] : packed.blockers)].join("; "),
  );
  if (!packed.ok) throw new Error("package failed; remaining checks skipped");

  const pkg = packed.pkg;
  const serviceHtml = htmlOf(pkg.files, `${FLU}/index.html`);
  const heading = stagingLocalityNavHeading(FLU);
  const hub = stagingServicePublicPath(FLU);
  const localityHrefs = AREAS.map((area) => stagingLocalityPublicPath(FLU, area));
  const serviceHasHeading = serviceHtml.includes(`>${heading}</h2>`);
  const serviceHasAll = localityHrefs.every((href) => hrefs(serviceHtml).includes(href));
  record(
    "service-to-eight-localities",
    serviceHasHeading && serviceHasAll && /data-staging-campaign-nav="service"/.test(serviceHtml),
    serviceHasHeading && serviceHasAll
      ? `heading=${heading} links=${localityHrefs.length}`
      : `heading=${serviceHasHeading} missing=${localityHrefs.filter((href) => !hrefs(serviceHtml).includes(href)).join(" ")}`,
  );

  const localityMissingHub: string[] = [];
  for (const area of AREAS) {
    const html = htmlOf(pkg.files, `${FLU}/local/${area}/index.html`);
    if (!hrefs(html).includes(hub)) localityMissingHub.push(area);
  }
  record(
    "locality-to-service",
    localityMissingHub.length === 0,
    localityMissingHub.length ? `missingHub=${localityMissingHub.join(",")}` : `hub=${hub} localities=${AREAS.length}`,
  );

  const siblingBroken: string[] = [];
  for (const area of AREAS) {
    const html = htmlOf(pkg.files, `${FLU}/local/${area}/index.html`);
    if (/href=["']\/local\//i.test(html) || /href=["']\/local-[a-z0-9-]+/i.test(html) || /href=["']\/locations\//i.test(html)) {
      siblingBroken.push(`${area}:unpackaged`);
    }
    for (const href of hrefs(html)) {
      const resolved = pathOf(href);
      if (!resolved) continue;
      if (resolved.startsWith(`/${FLU}/local/`)) {
        const areaMatch = resolved.match(/^\/flu-vaccinations\/local\/([a-z0-9-]+)\/$/);
        if (!areaMatch || !AREAS.includes(areaMatch[1])) siblingBroken.push(`${area}:${resolved}`);
      }
    }
  }
  record(
    "sibling-link-integrity",
    siblingBroken.length === 0,
    siblingBroken.length ? siblingBroken.join(" | ") : "sibling locality hrefs resolve to packaged paths",
  );

  const allowed = new Set([hub, ...localityHrefs]);
  const broken: string[] = [];
  const cross: string[] = [];
  const htmlFiles = pkg.files.filter((f) => f.relativePath.endsWith("index.html"));
  for (const file of htmlFiles) {
    const html = file.contents.toString("utf8");
    for (const href of hrefs(html)) {
      const resolved = pathOf(href);
      if (!resolved) continue;
      if (!allowed.has(resolved)) broken.push(`${file.relativePath}:${href}`);
      for (const other of OTHER_SERVICES) {
        if (resolved === `/${other}/` || resolved.startsWith(`/${other}/`)) {
          cross.push(`${file.relativePath}:${href}`);
        }
      }
    }
  }
  record(
    "zero-broken-internal-campaign-links",
    broken.length === 0,
    broken.length ? broken.slice(0, 8).join(" | ") : "all internal campaign hrefs resolve",
  );
  record(
    "zero-cross-service-links",
    cross.length === 0,
    cross.length ? cross.join(" | ") : "no other-service hrefs",
  );

  const expectedRels = [`${FLU}/index.html`, ...AREAS.map((area) => `${FLU}/local/${area}/index.html`)];
  const noindexOk =
    htmlFiles.length === 9 &&
    expectedRels.every((rel) => pkg.files.some((f) => f.relativePath === rel)) &&
    htmlFiles.every((f) => /name="robots"\s+content="noindex, nofollow"/.test(f.contents.toString("utf8"))) &&
    htmlFiles.every((f) => f.contents.toString("utf8").includes(`rel="canonical" href="${STAGING}`)) &&
    pkg.files.some((f) => f.relativePath === "robots.txt" && f.contents.toString("utf8") === STAGING_ROBOTS_TXT) &&
    !pkg.files.some((f) => f.relativePath === "sitemap.xml") &&
    htmlFiles.every((f) => f.relativePath.startsWith(`${FLU}/`));
  record(
    "nine-page-noindex-integrity",
    noindexOk,
    `html=${htmlFiles.length} public=${pkg.pagePublicPaths.join(" ")}`,
  );

  const after = snapshotSources();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  const activeAfter = readActiveServiceCampaignSelection(SLUG);
  record(
    "source-page-integrity",
    mutated.length === 0 &&
      activeAfter?.campaignId === activeBefore?.campaignId &&
      activeAfter?.serviceId === "blood-pressure-checks" &&
      before.service === after.service &&
      AREAS.every((area) => before[`local:${area}`] === after[`local:${area}`]),
    mutated.length ? `mutated=${mutated.join(",")}` : "source campaign files unchanged",
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS staging-campaign-navigation-41e");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
