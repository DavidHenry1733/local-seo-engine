/**
 * NT-E2E-26A — Enable Product Owner acceptance generation contract (generic, per slug argument).
 */
import {
  enableProductOwnerAcceptanceGenerationContract,
  patchAuthorisedGenerationInitiationSource,
  SERVICE_LAYER_INITIATION_SOURCE,
  buildDashboardExternalPackageRecord,
} from "../src/pharmacy/masterAdminProductOwnerAcceptanceGenerationService.ts";
import { readAuthorisedEcosystemGenerationRecord } from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npx tsx scripts/nt-e2e-26a-enable-product-owner-acceptance-generation.ts <slug>");
  process.exit(1);
}

const record = readAuthorisedEcosystemGenerationRecord(slug);
if (record?.jobId) {
  patchAuthorisedGenerationInitiationSource(
    slug,
    SERVICE_LAYER_INITIATION_SOURCE,
    record.generationRevision || record.completedAt || record.initiatedAt,
  );
}

const contract = enableProductOwnerAcceptanceGenerationContract(slug, "nt-e2e-26a", {
  dashboardExternalPackages: record?.jobId ? [buildDashboardExternalPackageRecord(record)] : [],
});

console.log(JSON.stringify({ ok: true, slug, contract, previousJobId: record?.jobId || null }, null, 2));
