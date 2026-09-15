#!/usr/bin/env npx tsx
/** CPR-GSC-INTEGRATION-V1 — read-only validation */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import { buildPharmacySearchConsoleDashboard } from "../src/pharmacy/pharmacySearchConsoleDashboardService.ts";
import { enrichMasterAdminCustomerListRow } from "../src/pharmacy/masterAdminPlatformIntegrationService.ts";
import { buildMasterAdminDashboardLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";

const REUSED = [
  "src/indexing/indexTrackingEngine.ts",
  "artifacts/api-server/src/routes/api/gscAuth.ts",
  "artifacts/api-server/src/routes/api/gscSummary.ts",
  "artifacts/api-server/src/routes/api/gscIndex.ts",
  "artifacts/api-server/src/routes/api/searchConsole.ts",
  "artifacts/api-server/src/routes/api/indexTracking.ts",
  "src/pharmacy/pharmacySearchConsoleDashboardService.ts",
];

const reusedOk = REUSED.every((rel) => fs.existsSync(path.join(WORKSPACE_ROOT, rel)));
const page = fs.readFileSync(path.join(WORKSPACE_ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
const api = fs.readFileSync(path.join(WORKSPACE_ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");

const dash = buildMasterAdminDashboardLite();
const enriched = dash.customers.slice(0, 3).map((c) => enrichMasterAdminCustomerListRow(c));
const sample = enriched[0]?.slug || "commercial-validation-pharmacy";
const gsc = buildPharmacySearchConsoleDashboard(sample);

const report = {
  reusedModules: reusedOk,
  noDuplicateEngine: !fs.existsSync(path.join(WORKSPACE_ROOT, "src/pharmacy/gscDuplicateEngine.ts")),
  masterListMetrics: enriched.every((c) => c.searchConsoleMetrics),
  masterUi: page.includes("searchConsoleMetrics") && page.includes("Connect Search Console"),
  growthUi: page.includes("perfSearchConsole") && page.includes("Growth Dashboard"),
  apiRoute: api.includes("search-console-dashboard"),
  dashboardShape: gsc.version === 1 && Boolean(gsc.indexing && gsc.performance && gsc.insights),
  indexingBridge: fs.existsSync(path.join(WORKSPACE_ROOT, "src/pharmacy/pharmacyIndexingBridgeService.ts")),
};

const pass =
  report.reusedModules &&
  report.noDuplicateEngine &&
  report.masterListMetrics &&
  report.apiRoute &&
  report.dashboardShape;

console.log(
  JSON.stringify(
    {
      pass,
      sample,
      gscConnected: gsc.connected,
      report,
    },
    null,
    2,
  ),
);
process.exit(pass ? 0 : 2);
