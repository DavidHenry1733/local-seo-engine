#!/usr/bin/env npx tsx
/**
 * Browser Import Pipeline V1 — exercises setup POST routes and confirm page output.
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
import { PHARMACY_DELIVERED_TEST_SLUG } from "../src/pharmacy/growthEngineCustomerSetupTestTenants.ts";
import growthEngineApiRouter from "../artifacts/api-server/src/routes/api/growthEngine.ts";
import growthEnginePageRouter from "../artifacts/api-server/src/routes/growthEnginePageRouter.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const express = require(path.join(ROOT, "artifacts/api-server/node_modules/express")) as typeof import("express");

const SLUG = PHARMACY_DELIVERED_TEST_SLUG;
const GOOGLE_URL = "https://share.google/8UYG5leCfWKagXNpH";
const WEBSITE_URL = "https://pharmacydelivered4u.co.uk/";
const EXPECTED_PLACE_ID = "ChIJo06COfV2eUgRK54itj93usM";

const ROWLANDS_NEEDLES = [
  "Rowlands Pharmacy",
  "rowlandspharmacy.co.uk",
  "patientexperience@rowlandspharmacy.co.uk",
];

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

async function postJson(baseUrl: string, route: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

async function getText(baseUrl: string, route: string) {
  const res = await fetch(`${baseUrl}${route}`, { headers: { Accept: "text/html" } });
  return { status: res.status, text: await res.text() };
}

async function main() {
  loadEnv();
  console.log("\n=== Browser Import Pipeline V1 ===\n");

  provisionPharmacyDelivered4uTestTenant();
  resetSetupImports(SLUG);

  const beforeImport = readSetupProfile(SLUG);
  const coreBefore = {
    pharmacyName: beforeImport.pharmacyName,
    website: beforeImport.website,
    googlePlaceId: beforeImport.googlePlaceId,
    businessDescription: beforeImport.businessDescription,
  };

  const app = express();
  app.use(express.json());
  app.use("/api", growthEngineApiRouter);
  app.use("/api", growthEnginePageRouter);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}/api`;

  try {
    const googlePost = await postJson(base, `/growth-engine/${SLUG}/setup-google-import`, {
      googleBusinessUrl: GOOGLE_URL,
      pharmacyName: "",
      town: "",
      postcode: "",
    });
    record("google-post-ok", googlePost.status === 200 && googlePost.json.ok === true, JSON.stringify(googlePost.json));
    record(
      "google-post-imported",
      googlePost.json.status === "imported",
      String(googlePost.json.status),
    );

    const afterGoogle = readSetupProfile(SLUG);
    const googleSnap = afterGoogle.googleImportSnapshot;
    record("google-snapshot-written", Boolean(googleSnap?.importedAt), googleSnap?.status || "missing");
    record(
      "google-import-pharmacy-delivered",
      Boolean(googleSnap?.businessName?.includes("Pharmacy Delivered")),
      googleSnap?.businessName || "none",
    );
    record("google-place-id-stored", googleSnap?.placeId === EXPECTED_PLACE_ID, googleSnap?.placeId || "none");
    record("google-debug-written", Boolean(afterGoogle.lastGoogleImportDebug?.snapshotWritten), "lastGoogleImportDebug");

    const debugRes = await fetch(`${base}/growth-engine/${SLUG}/setup-debug`, {
      headers: { Accept: "application/json" },
    });
    const debugJson = (await debugRes.json()) as Record<string, unknown>;
    record("setup-debug-ok", debugRes.status === 200 && debugJson.ok === true, String(debugRes.status));
    record(
      "setup-debug-has-snapshot",
      Boolean(debugJson.googleImportSnapshot),
      debugJson.googleImportSnapshot ? "present" : "missing",
    );
    record(
      "setup-debug-direct-import",
      (debugJson.googleImportSnapshot as { status?: string } | undefined)?.status === "imported",
      String((debugJson.googleImportSnapshot as { status?: string } | undefined)?.status),
    );

    const websitePost = await postJson(base, `/growth-engine/${SLUG}/setup-website-import`, {
      websiteUrl: WEBSITE_URL,
    });
    record("website-post-ok", websitePost.status === 200 && websitePost.json.ok === true, JSON.stringify(websitePost.json));

    const afterWebsite = readSetupProfile(SLUG);
    const websiteSnap = afterWebsite.websiteImportSnapshot;
    record("website-snapshot-written", Boolean(websiteSnap?.importedAt), websiteSnap?.websiteUrl || "missing");
    record(
      "website-snapshot-domain",
      Boolean(websiteSnap?.websiteUrl?.includes("pharmacydelivered4u.co.uk")),
      websiteSnap?.websiteUrl || "none",
    );
    record("website-debug-written", Boolean(afterWebsite.lastWebsiteImportDebug?.snapshotWritten), "lastWebsiteImportDebug");

    const confirmPage = await getText(base, `/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(SLUG)}`);
    record("confirm-page-200", confirmPage.status === 200, String(confirmPage.status));
    record(
      "confirm-html-pharmacy-delivered",
      confirmPage.text.includes("Pharmacy Delivered"),
      "Pharmacy Delivered in HTML",
    );
    record(
      "confirm-html-google-imported",
      confirmPage.text.includes("Google Profile Imported"),
      "Google Profile Imported badge",
    );
    record(
      "confirm-html-wellgate",
      confirmPage.text.includes("Wellgate") || confirmPage.text.includes("145-147"),
      "address in HTML",
    );
    record("confirm-html-phone", confirmPage.text.includes("01709"), "phone in HTML");
    record("confirm-html-rating", confirmPage.text.includes("rating"), "rating in HTML");
    record("confirm-html-place-id-hidden", !confirmPage.text.includes(EXPECTED_PLACE_ID), "Place ID hidden");
    record(
      "confirm-html-website-snapshot",
      confirmPage.text.includes("pharmacydelivered4u.co.uk") || confirmPage.text.includes("Website Import"),
      "website section present",
    );

    const rowlandsHit = ROWLANDS_NEEDLES.find((needle) => confirmPage.text.includes(needle));
    record("confirm-no-rowlands", !rowlandsHit, rowlandsHit || "clean");

    const afterBoth = readSetupProfile(SLUG);
    record(
      "core-pharmacy-name-unchanged",
      afterBoth.pharmacyName === coreBefore.pharmacyName,
      afterBoth.pharmacyName,
    );
    record("core-google-place-empty", !afterBoth.googlePlaceId, afterBoth.googlePlaceId || "empty");
    record(
      "core-description-not-polluted",
      !afterBoth.businessDescription?.includes("Rowlands") && !afterBoth.businessDescription?.includes("400 pharmacies"),
      "core description clean",
    );
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
