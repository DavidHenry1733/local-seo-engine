#!/usr/bin/env npx tsx
/** CPR-COMMERCIAL-INTEGRATION-V1 — read-only integration validation */
import fs from "node:fs";
import path from "node:path";
import { buildMasterAdminDashboardLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { enrichMasterAdminCustomerListRow, buildMasterAdminIntegratedGrowthDashboard } from "../src/pharmacy/masterAdminPlatformIntegrationService.ts";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";

const page = fs.readFileSync(
  path.join(WORKSPACE_ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"),
  "utf8",
);
const legacy = fs.readFileSync(
  path.join(WORKSPACE_ROOT, "artifacts/api-server/src/routes/pharmacyMasterAdminPage.ts"),
  "utf8",
);

const dash = buildMasterAdminDashboardLite();
const enriched = dash.customers.map((c) => enrichMasterAdminCustomerListRow(c));
const hasPills = enriched.every((c) => c.platformStatus && c.generationStatus);
const greenfield = enriched.find((c) => c.slug === "commercial-validation-pharmacy");
const growth = greenfield ? buildMasterAdminIntegratedGrowthDashboard(greenfield.slug) : null;

const report = {
  masterDashboard: {
    customerList: dash.customers.length > 0,
    enrichedStatus: hasPills,
    searchConsoleField: enriched.some((c) => Boolean(c.searchConsoleLabel || c.platformStatus?.searchConsoleStatus)),
    noLegacyNavLink: !page.includes('href="/api/admin/pharmacies">Legacy Admin'),
    legacyRedirect: legacy.includes('redirect(302, "/api/admin/master")'),
    growthPanelApi: fs.existsSync(
      path.join(WORKSPACE_ROOT, "src/pharmacy/masterAdminPlatformIntegrationService.ts"),
    ),
  },
  customerJourney: {
    createModal: page.includes("openCreateModal") && page.includes("createCustomer"),
    openPharmacy: page.includes("Open Pharmacy"),
  },
  workflowIntegration: {
    continueWorkflow: page.includes("continueWorkflow"),
    modularButtons: page.includes("Growth Dashboard") && page.includes("openCommercialIndexingReview(true)"),
  },
  searchConsole: {
    integrationService: Boolean(growth?.searchConsole),
    indexingModalSection: page.includes("idxSearchConsole"),
    perfModalSection: page.includes("perfSearchConsole"),
  },
  growthDashboard: {
    integrated: Boolean(growth?.performance && growth?.indexing),
    slug: greenfield?.slug || null,
  },
};

const pass =
  report.masterDashboard.customerList &&
  report.masterDashboard.enrichedStatus &&
  report.masterDashboard.noLegacyNavLink &&
  report.masterDashboard.legacyRedirect &&
  report.workflowIntegration.modularButtons &&
  report.searchConsole.indexingModalSection;

console.log(JSON.stringify({ pass, report }, null, 2));
process.exit(pass ? 0 : 2);
