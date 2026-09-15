#!/usr/bin/env npx tsx
/**
 * NT-E2E-32 — Customer workflow load validation.
 */
import { performance } from "node:perf_hooks";
import { buildMasterAdminCustomerRecordLite, profileMasterAdminCustomerRecordLoad } from "../src/pharmacy/masterAdminCustomerRecordLiteService.ts";
import { buildPharmacyPlatformDashboard } from "../src/pharmacy/pharmacyPlatformDashboardService.ts";

const SLUG = "reliable-direct-pharmacy";
const BASE = process.env.APP_DOMAIN || "http://127.0.0.1:3001";

async function main() {
  const profile = profileMasterAdminCustomerRecordLoad(SLUG);
  const liteStart = performance.now();
  const lite = buildMasterAdminCustomerRecordLite(SLUG);
  const liteMs = Math.round(performance.now() - liteStart);

  let platformDashboardMs = 0;
  try {
    const pdStart = performance.now();
    buildPharmacyPlatformDashboard(SLUG);
    platformDashboardMs = Math.round(performance.now() - pdStart);
  } catch {
    platformDashboardMs = -1;
  }

  const loginRes = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "username=admin&password=changeme123",
    redirect: "manual",
  });
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";
  const apiStart = performance.now();
  const detailRes = await fetch(`${BASE}/api/master-admin-platform/customers/${SLUG}`, {
    headers: { Accept: "application/json", Cookie: cookie },
  });
  const apiMs = Math.round(performance.now() - apiStart);
  const detailJson = detailRes.ok ? ((await detailRes.json()) as Record<string, unknown>) : null;

  const pagePath = "artifacts/api-server/src/routes/masterAdminPlatformPage.ts";
  const pageSrc = await import("node:fs").then((fs) => fs.readFileSync(pagePath, "utf8"));
  const parseOk = !/\basync function openCustomer/.test(pageSrc) || pageSrc.includes("loadCustomerDetailSections");

  console.log(
    JSON.stringify(
      {
        profile,
        liteMs,
        platformDashboardMs,
        apiHttpStatus: detailRes.status,
        apiMs,
        currentStage: (detailJson?.customer as { currentStage?: string })?.currentStage || lite?.currentStage,
        nextAction: (detailJson?.customer as { nextAction?: string })?.nextAction || lite?.nextAction,
        lite: detailJson?.lite,
        timings: detailJson?.timings,
        embeddedParseOk: parseOk,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
