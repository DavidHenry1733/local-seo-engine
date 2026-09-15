#!/usr/bin/env npx tsx
/**
 * Website Intelligence Import V2 validation — pharmacydelivered4u.co.uk
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import {
  provisionPharmacyDelivered4uTestTenant,
  readSetupProfile,
  resetSetupImports,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { buildCustomerSetupConfirmView } from "../src/pharmacy/growthEngineCustomerSetupConfirmService.ts";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderWebsiteIntelligencePage } from "../src/pharmacy/growthEngineWebsiteIntelligencePage.ts";
import {
  buildWebsiteIntelligenceImportV2,
  websiteImportSnapshotToGrowthEngineSnapshot,
} from "../src/pharmacy/growthEngineWebsiteIntelligenceImportV2Service.ts";
import { PHARMACY_DELIVERED_TEST_SLUG } from "../src/pharmacy/growthEngineCustomerSetupTestTenants.ts";
import growthEngineApiRouter from "../artifacts/api-server/src/routes/api/growthEngine.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const express = require(path.join(ROOT, "artifacts/api-server/node_modules/express")) as typeof import("express");

const SLUG = PHARMACY_DELIVERED_TEST_SLUG;
const WEBSITE_URL = "https://pharmacydelivered4u.co.uk/";

const PROVIDER_NEEDLES = ["wordpress.com", "wix.com", "squarespace.com", "shopify.com", "godaddy"];

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function loadEnv(): void {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
  if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;
}

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function main() {
  loadEnv();
  console.log("\n=== Website Intelligence Import V2 ===\n");

  provisionPharmacyDelivered4uTestTenant();
  resetSetupImports(SLUG);

  const before = readSetupProfile(SLUG);
  const coreBefore = {
    pharmacyName: before.pharmacyName,
    googlePlaceId: before.googlePlaceId,
    businessDescription: before.businessDescription,
  };

  const baseline = before.customerSetupAdminBaseline;
  const direct = await buildWebsiteIntelligenceImportV2(WEBSITE_URL, baseline);
  record("v2-version", direct.intelligence.version === 2, String(direct.intelligence.version));
  record("identity-resolved-url", Boolean(direct.intelligence.identity.resolvedUrl.includes("pharmacydelivered4u")), direct.intelligence.identity.resolvedUrl);
  record("identity-title", Boolean(direct.intelligence.identity.title), direct.intelligence.identity.title.slice(0, 60));
  record("identity-cms", Boolean(direct.intelligence.identity.cmsDetected), direct.intelligence.identity.cmsDetected);
  record("structure-pages", direct.intelligence.structure.totalPages > 0, String(direct.intelligence.structure.totalPages));
  record("structure-sitemap", typeof direct.intelligence.structure.sitemapFound === "boolean", String(direct.intelligence.structure.sitemapFound));
  record("services-detected", direct.intelligence.services.some((s) => s.exists), `${direct.intelligence.services.filter((s) => s.exists).length} services`);
  record("seo-completeness", direct.intelligence.seoSnapshot.overallCompletenessPercent > 0, `${direct.intelligence.seoSnapshot.overallCompletenessPercent}%`);
  record("evidence-present", direct.intelligence.evidence.length > 0, String(direct.intelligence.evidence.length));

  const bizBlob = JSON.stringify(direct.intelligence.business);
  const providerHit = PROVIDER_NEEDLES.find((n) => bizBlob.toLowerCase().includes(n));
  record("no-provider-contact", !providerHit, providerHit || "clean");

  const name =
    direct.intelligence.business.businessName.selected ||
    direct.intelligence.business.businessName.candidates[0]?.value ||
    direct.brand.businessName ||
    direct.intelligence.identity.resolvedUrl;
  record(
    "pharmacy-identified",
    /pharmacy|delivered|4u|pharmacydelivered4u/i.test(name),
    name.slice(0, 80),
  );

  const app = express();
  app.use(express.json());
  app.use("/api", growthEngineApiRouter);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/api`;

  try {
    const res = await fetch(`${base}/growth-engine/${SLUG}/setup-website-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ websiteUrl: WEBSITE_URL }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    record("route-post-ok", res.status === 200 && json.ok === true, JSON.stringify(json));

    const data = readSetupProfile(SLUG);
    const snap = data.websiteImportSnapshot;
    record("snapshot-written", Boolean(snap?.importedAt), snap?.status || "");
    record("snapshot-intelligence-v2", snap?.intelligence?.version === 2, String(snap?.intelligence?.version));
    record("snapshot-imported-status", snap?.status === "imported", snap?.status || "");

    const intel = snap?.intelligence;
    if (intel) {
      record("snapshot-page-count", intel.structure.totalPages > 0, String(intel.structure.totalPages));
      record("snapshot-service-pages", intel.structure.servicePages >= 0, String(intel.structure.servicePages));
      record("snapshot-services-list", intel.services.filter((s) => s.exists).length > 0, String(intel.services.filter((s) => s.exists).length));
    }

    const reportSnap = snap ? websiteImportSnapshotToGrowthEngineSnapshot(SLUG, snap) : null;
    record("report-adapter", Boolean(reportSnap?.analysis), reportSnap?.source || "null");
    if (reportSnap?.analysis) {
      const reportHtml = renderWebsiteIntelligencePage(SLUG, reportSnap, {});
      record("report-renders", reportHtml.includes("Your Website Report"), "HTML ok");
      record("report-plain-english", !reportHtml.includes("canonical") && !reportHtml.includes("meta robots"), "no jargon");
      record("report-has-pages", reportHtml.includes("page"), "page mention");
    }

    const view = buildCustomerSetupConfirmView(SLUG);
    record("confirm-website-imported-label", view.websiteSection.statusLabel.includes("Imported"), view.websiteSection.statusLabel);
    record("confirm-has-services-row", view.websiteSection.rows.some((r) => r.label === "Services detected"), "services row");

    const html = renderCustomerSetupConfirmPage(SLUG);
    record("confirm-html-intelligence", html.includes("Website Intelligence"), "section title");
    record("confirm-no-schema-jargon", !html.includes("schema.org") && !html.includes("canonical"), "plain English");

    const after = readSetupProfile(SLUG);
    record("core-name-unchanged", after.pharmacyName === coreBefore.pharmacyName, after.pharmacyName);
    record("core-google-unchanged", after.googlePlaceId === coreBefore.googlePlaceId, after.googlePlaceId || "empty");
    record("core-description-not-overwritten", !after.businessDescription?.includes("Rowlands"), "clean");
  } finally {
    server.close();
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.error(`  FAIL ${c.id}: ${c.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
