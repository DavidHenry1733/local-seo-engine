/**
 * Rebuild Commercial Intelligence evidence only (no content/ecosystem regeneration).
 */
import { refreshPharmacyVisibility } from "../src/pharmacy/pharmacyVisibilityBridgeService.ts";
import {
  discoverCompetitors,
  loadPharmacyDiscoveryInput,
  writeCompetitorDiscoveryResult,
} from "../src/pharmacy/pharmacyCompetitorDiscovery.ts";
import {
  buildCompetitorIntelligence,
  writeCompetitorIntelligence,
} from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";
import { discoverLocalMarketCompetitors } from "../src/pharmacy/growthEngineLocalMarketService.ts";
import {
  buildGrowthOpportunityReport,
  saveGrowthOpportunityReport,
} from "../src/pharmacy/growthEngineOpportunityEngine.ts";
import { buildCommercialIntelligenceDashboard } from "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import { resolveTenantLocality } from "../src/pharmacy/masterAdminPrimaryLocalityService.ts";
import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { loadCompetitorIntelligence } from "../src/pharmacy/pharmacyCompetitorIntelligence.ts";
import { loadCompetitorSnapshot } from "../src/pharmacy/growthEngineLocalMarketService.ts";

const slug = process.argv[2] || "reliable-direct-pharmacy";

async function main() {
  console.log(`Rebuilding Commercial Intelligence evidence for ${slug}…`);
  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  console.log(`Locality: ${locality.provenanceLabel}`);

  const vis = refreshPharmacyVisibility(slug);
  console.log(`Visibility refreshed → ${vis.reportPath}`);

  const input = loadPharmacyDiscoveryInput(slug);
  const discovery = await discoverCompetitors(slug, input);
  writeCompetitorDiscoveryResult(discovery);
  const intelligence = await buildCompetitorIntelligence(discovery);
  writeCompetitorIntelligence(intelligence);
  console.log(
    `Competitor Analysis → ${intelligence.competitors.length} competitors (${discovery.source}) centre=${discovery.pharmacy.address}`,
  );

  const localMarket = await discoverLocalMarketCompetitors(slug);
  console.log(
    `Local Market → ${localMarket.competitors.length} competitors (${localMarket.source})`,
  );

  const growth = buildGrowthOpportunityReport(slug, localMarket);
  const growthPath = saveGrowthOpportunityReport(growth);
  console.log(`Growth Intelligence → ${growth.opportunities.length} opportunities (${growthPath})`);

  const dashboard = buildCommercialIntelligenceDashboard(slug);
  const intel = loadCompetitorIntelligence(slug);
  const snap = loadCompetitorSnapshot(slug);
  console.log(`Dashboard canApprove=${dashboard.canApprove} competitors=${dashboard.competitorAnalysis.competitors.length}`);
  console.log(`Intel file competitors=${intel?.competitors.length ?? 0} snap=${snap?.competitors.length ?? 0}`);
  console.log(`Traffic opportunity: ${dashboard.executiveSummary.estimatedTrafficOpportunity}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
