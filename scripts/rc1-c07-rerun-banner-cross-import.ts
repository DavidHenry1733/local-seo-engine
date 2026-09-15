#!/usr/bin/env npx tsx
/**
 * RC1-C07 — Rerun Banner Cross website import with full design capture.
 */
import { archiveWebsiteImportSnapshot } from "../src/pharmacy/masterAdminCanonicalWebsiteService.ts";
import { runSetupWebsiteImport } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  buildCanonicalFinalRender,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { preparePharmacyPublishOutput } from "../src/pharmacy/pharmacyLivePublishService.ts";
import { persistComponentDnaFromBrandEvidence } from "../src/pharmacy/masterAdminComponentDnaPersistenceService.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const URL =
  process.argv[3] || "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield/";
const SERVICE = process.argv[4] || "pharmacy-first";

async function main() {
  const archived = archiveWebsiteImportSnapshot(SLUG, "RC1-C07 full-fidelity design import — previous snapshot archived");
  console.log(`[rc1-c07] archived previous import: ${archived ? "YES" : "NO"}`);

  const result = await runSetupWebsiteImport(SLUG, { websiteUrl: URL });
  console.log(`[rc1-c07] website import status=${result.status} message=${result.message}`);

  persistComponentDnaFromBrandEvidence(SLUG, { force: true });
  await buildCanonicalFinalRender(SLUG, SERVICE);
  preparePharmacyPublishOutput(SLUG, SERVICE);

  console.log(JSON.stringify({ ok: true, slug: SLUG, url: URL, status: result.status }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
