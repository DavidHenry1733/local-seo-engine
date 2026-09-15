#!/usr/bin/env npx tsx
/**
 * Pharmacy Delivered 4U test tenant provisioner.
 *
 * Usage: npx tsx scripts/create-pharmacy-delivered-4u-test-tenant-v1.ts
 */
import { provisionPharmacyDelivered4uTestTenant } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { PHARMACY_DELIVERED_TEST_SLUG } from "../src/pharmacy/growthEngineCustomerSetupTestTenants.ts";

const result = provisionPharmacyDelivered4uTestTenant();
console.log(`Provisioned ${PHARMACY_DELIVERED_TEST_SLUG}`);
console.log(`Profile: ${result.profilePath}`);
console.log(`Start: /api/growth-engine/start?slug=${encodeURIComponent(result.slug)}`);
console.log(`Confirm: /api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(result.slug)}`);
