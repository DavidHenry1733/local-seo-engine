#!/usr/bin/env npx tsx
/**
 * Google Profile URL Direct Import V1 validation.
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
import { PHARMACY_DELIVERED_TEST_SLUG } from "../src/pharmacy/growthEngineCustomerSetupTestTenants.ts";
import growthEngineApiRouter from "../artifacts/api-server/src/routes/api/growthEngine.ts";
import growthEnginePageRouter from "../artifacts/api-server/src/routes/growthEnginePageRouter.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const express = require(path.join(ROOT, "artifacts/api-server/node_modules/express")) as typeof import("express");

const SLUG = PHARMACY_DELIVERED_TEST_SLUG;
const GOOGLE_URL = "https://share.google/8UYG5leCfWKagXNpH";
const EXPECTED_PLACE_ID = "ChIJo06COfV2eUgRK54itj93usM";

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
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function main() {
  loadEnv();
  console.log("\n=== Google Profile URL Direct Import V1 ===\n");

  provisionPharmacyDelivered4uTestTenant();
  resetSetupImports(SLUG);

  const before = readSetupProfile(SLUG);
  const coreBefore = {
    pharmacyName: before.pharmacyName,
    googlePlaceId: before.googlePlaceId,
    phone: before.phone,
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
    record("share-url-post-ok", googlePost.status === 200 && googlePost.json.ok === true, JSON.stringify(googlePost.json));
    record("status-imported-not-possible-match", googlePost.json.status === "imported", String(googlePost.json.status));

    const data = readSetupProfile(SLUG);
    const snap = data.googleImportSnapshot;
    record("kgmid-debug", Boolean(data.lastGoogleImportDebug?.kgMid), data.lastGoogleImportDebug?.kgMid || "missing");
    record("snapshot-populated", Boolean(snap?.importedAt), snap?.status || "missing");
    record("snapshot-status-imported", snap?.status === "imported", snap?.status || "");
    record("snapshot-not-needs-review", snap?.status !== "needs_review" && snap?.status !== "possible_match", snap?.status || "");
    record("business-name", snap?.businessName?.includes("Pharmacy Delivered") ?? false, snap?.businessName || "");
    record("place-id-stored", snap?.placeId === EXPECTED_PLACE_ID, snap?.placeId || "");
    record("phone-stored", Boolean(snap?.phone?.includes("01709")), snap?.phone || "");
    record("rating-stored", snap?.rating === 5, String(snap?.rating));
    record("reviews-stored", snap?.reviewCount === 5, String(snap?.reviewCount));
    record("address-stored", Boolean(snap?.address?.includes("Wellgate")), snap?.address || "");
    record("maps-link-stored", Boolean(snap?.googleMapsUrl), snap?.googleMapsUrl?.slice(0, 60) || "");
    record("no-candidate-list-on-direct", (snap?.candidates?.length ?? 0) === 0, String(snap?.candidates?.length ?? 0));

    const view = buildCustomerSetupConfirmView(SLUG);
    record("confirm-status-label", view.googleSection.statusLabel === "Google Profile Imported", view.googleSection.statusLabel);
    record("confirm-has-rating-row", view.googleSection.rows.some((r) => r.label === "Rating" && r.value.includes("rating")), "rating row");
    record("confirm-has-reviews-row", view.googleSection.rows.some((r) => r.label === "Review count" && r.value.includes("review")), "reviews row");
    record("confirm-has-phone-row", view.googleSection.rows.some((r) => r.label === "Phone" && r.value.includes("01709")), "phone row");
    record("confirm-no-place-id-row", !view.googleSection.rows.some((r) => r.label === "Place ID"), "Place ID hidden");
    record("confirm-no-selector", !view.googleSelectorVisible, "selector hidden");

    const html = renderCustomerSetupConfirmPage(SLUG);
    record("html-google-profile-imported", html.includes("Google Profile Imported"), "badge text");
    record("html-pharmacy-delivered", html.includes("Pharmacy Delivered"), "business name");
    record("html-wellgate", html.includes("Wellgate") || html.includes("145-147"), "address");
    record("html-phone", html.includes("01709"), "phone");
    record("html-rating", html.includes("5.0 rating") || html.includes("5 rating"), "rating");
    record("html-reviews", html.includes("5 reviews"), "reviews");
    record("html-place-id-hidden", !html.includes(EXPECTED_PLACE_ID), "Place ID not shown");
    record("html-no-possible-match", !html.includes("Possible Match") && !html.includes("This is my pharmacy"), "no review selector");

    const after = readSetupProfile(SLUG);
    record("core-name-unchanged", after.pharmacyName === coreBefore.pharmacyName, after.pharmacyName);
    record("core-place-id-empty", !after.googlePlaceId, after.googlePlaceId || "empty");
    record("core-phone-empty", !after.phone, after.phone || "empty");
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
