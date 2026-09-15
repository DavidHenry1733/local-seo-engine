import { readSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { resolveCommercialMarketContext } from "../src/pharmacy/commercialMarketContextService.ts";

let passed = 0;
let failed = 0;

function check(id: string, condition: boolean, detail: string) {
  if (condition) {
    passed++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    failed++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

console.log("\n=== COMMERCIAL MARKET CONTEXT V1 ===\n");

const pharmaConnect = readSetupProfile("pharmaconnect");
const national = resolveCommercialMarketContext(pharmaConnect);

check(
  "pharmaconnect-business-model",
  national.businessModel === "b2b_service_provider",
  national.businessModel,
);

check(
  "pharmaconnect-market-scope",
  national.marketScope === "national",
  national.marketScope,
);

check(
  "pharmaconnect-market-country",
  national.marketCountry === "United Kingdom",
  national.marketCountry,
);

check(
  "pharmaconnect-customer-market",
  national.customerMarket === "community_pharmacies",
  national.customerMarket,
);

check(
  "pharmaconnect-competitor-type",
  national.competitorType === "pharmacy_digital_service_providers",
  national.competitorType,
);

check(
  "pharmaconnect-national-strategy",
  national.competitorStrategy === "national_commercial",
  national.competitorStrategy,
);

check(
  "pharmaconnect-locality-not-market",
  national.localityDefinesCommercialMarket === false,
  `physical=${national.physicalLocality.value || "unavailable"}`,
);

check(
  "pharmaconnect-local-market-na",
  national.localMarketIntelligenceApplicable === false,
  String(national.localMarketIntelligenceApplicable),
);

check(
  "pharmaconnect-healthcare-na",
  national.healthcareIntelligenceApplicable === false,
  String(national.healthcareIntelligenceApplicable),
);

/*
 * Synthetic community-pharmacy fixture.
 * This proves the new resolver preserves the existing local model
 * without modifying any live pharmacy tenant.
 */
const communityPharmacy = {
  businessName: "Validation Community Pharmacy",
  businessType: "community_pharmacy",
  description: "Independent community pharmacy serving local patients.",
  primaryTown: "Leeds",
  townCity: "Leeds",
  postcode: "LS1 1AA",
  services: [
    { name: "Pharmacy First" },
    { name: "Blood Pressure Checks" },
  ],
} as any;

const local = resolveCommercialMarketContext(communityPharmacy);

check(
  "pharmacy-business-model",
  local.businessModel === "community_pharmacy",
  local.businessModel,
);

check(
  "pharmacy-market-scope",
  local.marketScope === "local",
  local.marketScope,
);

check(
  "pharmacy-local-strategy",
  local.competitorStrategy === "google_places_local",
  local.competitorStrategy,
);

check(
  "pharmacy-locality-is-market",
  local.localityDefinesCommercialMarket === true,
  String(local.localityDefinesCommercialMarket),
);

check(
  "pharmacy-local-market-applicable",
  local.localMarketIntelligenceApplicable === true,
  String(local.localMarketIntelligenceApplicable),
);

check(
  "pharmacy-healthcare-applicable",
  local.healthcareIntelligenceApplicable === true,
  String(local.healthcareIntelligenceApplicable),
);

check(
  "pharmacy-locality",
  local.physicalLocality.value === "Leeds",
  local.physicalLocality.value || "unavailable",
);

console.log("\n--- PHARMACONNECT CONTEXT ---");
console.log(JSON.stringify(national, null, 2));

console.log("\n--- LOCAL PHARMACY CONTEXT ---");
console.log(JSON.stringify(local, null, 2));

console.log(`\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`);

if (failed) process.exit(1);
