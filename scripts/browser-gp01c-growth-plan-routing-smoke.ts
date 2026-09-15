#!/usr/bin/env npx tsx
/**
 * GP-01C browser smoke — national + local Growth Plan HTML.
 * Local test profiles only. Does not call DataForSEO, Places, or GSC.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { getPharmacyProfilePath, PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SECRET = process.env.SESSION_SECRET || "dev-fallback-secret-change-in-prod";
const BASE = (process.env.GP01C_BASE_URL || `http://127.0.0.1:${process.env.PORT || "4173"}`).replace(/\/$/, "");

function ensureProfile(slug: string, data: Record<string, unknown>) {
  const file = getPharmacyProfilePath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) return;
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        slug,
        updatedAt: new Date().toISOString(),
        version: 2,
        data,
      },
      null,
      2,
    ) + "\n",
  );
}

function tokenUrl(pathname: string, slug: string): string {
  const u = new URL(pathname, BASE);
  u.searchParams.set("slug", slug);
  u.searchParams.set("_t", SECRET);
  return u.toString();
}

interface Item {
  id: string;
  pass: boolean;
  detail: string;
}

const items: Item[] = [];

function check(id: string, pass: boolean, detail: string) {
  items.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function main() {
  console.log(`Workspace: ${PHARMACY_WORKSPACE_ROOT}`);
  console.log(`Base URL: ${BASE}`);

  ensureProfile("pharmaconnect", {
    pharmacyName: "PharmaConnect",
    website: "https://pharmaconnect.uk",
    marketScope: "national",
    primaryMarket: "United Kingdom",
    country: "United Kingdom",
    addressLine1: "Moorgate Crofts Business Centre, South Grove",
    townCity: "Rotherham",
    postcode: "S60 2DH",
  });
  ensureProfile("leeds-pharmacy", {
    pharmacyName: "Leeds Pharmacy",
    website: "https://leedspharmacy.co.uk",
    selectedServices: ["pharmacy-first", "blood-pressure-checks", "flu-vaccinations"],
    primaryTown: "Leeds",
    townCity: "Leeds",
    postcode: "LS6 1AA",
    country: "United Kingdom",
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${SECRET}` },
  });
  const page = await context.newPage();

  const nationalUrl = tokenUrl("/api/growth-engine/growth-plan", "pharmaconnect");
  const nationalResp = await page.goto(nationalUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  const nationalStatus = nationalResp?.status() ?? 0;
  const nationalText = await page.locator("body").innerText();
  const nationalHtml = await page.content();

  console.log("\n=== BROWSER NATIONAL ===\n");
  console.log(`URL ${nationalUrl} status ${nationalStatus}`);
  check("national-http-200", nationalStatus === 200, String(nationalStatus));
  check("national-digital-provider", /digital-growth provider serving UK community pharmacies/i.test(nationalText), "identity");
  check("national-not-a-pharmacy", !/is a pharmacy\b|Your pharmacy programme|serves Rotherham/i.test(nationalText), "not described as a pharmacy");
  check("national-not-rotherham-market", !/Commercial market: Rotherham/i.test(nationalText) && !/serves Rotherham/i.test(nationalText), "Rotherham not commercial market");
  check("national-no-pharmacy-first-service", !nationalText.includes("Pharmacy First"), "Pharmacy First absent");
  check("national-no-bp-service", !nationalText.includes("Blood Pressure Checks"), "BP absent");
  check("national-no-travel-vax", !nationalText.includes("Travel Vaccinations"), "Travel Vaccinations absent");
  check("national-no-flu-vax", !nationalText.includes("Flu Vaccinations"), "Flu Vaccinations absent");
  check("national-no-dispensing", !nationalText.includes("Prescription Dispensing"), "Dispensing absent");
  check("national-digital-services", /Pharmacy Website Design|Pharmacy Local SEO|Pharmacy Email Marketing/i.test(nationalText), "configured digital services");
  check("national-gp01-authoritative", /Recommended national commercial action/i.test(nationalText) && /pharmacy seo/i.test(nationalText), "GP-01 primary");
  check("national-no-empty-priority", !nationalText.includes("No priority campaign yet"), "eligible action shown");
  check("national-no-places-prereq", /Google Places \/ Your Local Market is not a prerequisite/i.test(nationalText), "Places not required");
  check("national-gap-truthful", /NEW_MARKET_EVIDENCE/i.test(nationalText) && /\bLOW\b/.test(nationalText) && !/PROVEN_UNTAPPED/.test(nationalText), "gap evidence");
  check("national-no-side-panel", !nationalHtml.includes("Market Opportunity Plan"), "no duplicate side panel");
  check("national-platform-attr", nationalHtml.includes('data-growth-platform="national"'), "platform attr");

  const rec = await page.locator(".gp-campaign-name").first().textContent().catch(() => "");
  console.log(`Primary recommendation visible: ${rec || "(none)"}`);

  const localUrl = tokenUrl("/api/growth-engine/growth-plan", "leeds-pharmacy");
  const localResp = await page.goto(localUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  const localStatus = localResp?.status() ?? 0;
  const localText = await page.locator("body").innerText();
  const localHtml = await page.content();

  console.log("\n=== BROWSER LOCAL ===\n");
  console.log(`URL ${localUrl} status ${localStatus}`);
  check("local-http-200", localStatus === 200, String(localStatus));
  check("local-plan-renders", /Where you stand|Campaign Readiness/i.test(localText), "local plan");
  check("local-your-pharmacy", localText.includes("Your Pharmacy"), "Your Pharmacy");
  check("local-your-local-market", localText.includes("Your Local Market"), "Your Local Market");
  check("local-no-national-keywords", !localText.includes("pharmacy seo") && !localText.includes("UK Community Pharmacy Digital Growth"), "no national fixture");
  check("local-campaign-engine", /Open Campaign Builder|No evidence-backed campaign|Your recommended campaign/i.test(localText), "local engine");
  check("local-platform-attr", localHtml.includes('data-growth-platform="local"'), "platform attr");

  const builderResp = await page.goto(tokenUrl("/api/growth-engine/campaign-builder", "pharmaconnect"), {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  const builderText = await page.locator("body").innerText();
  check("national-builder-bounded", (builderResp?.status() ?? 0) === 200 && /National campaign strategy/i.test(builderText), "bounded CTA destination");

  await browser.close();

  const failed = items.filter((i) => !i.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${items.length - failed.length}/${items.length} browser checks\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
