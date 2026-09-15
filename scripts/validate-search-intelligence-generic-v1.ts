#!/usr/bin/env npx tsx
/**
 * Search Intelligence — generic organic classification, UK GBP money, campaign reuse.
 * Fixtures/mocks only. No live DataForSEO or Places calls. Does not write tenant artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyOrganicSearchEvidence,
  isOwnBusinessDomain,
} from "../src/pharmacy/organicSearchEvidenceClassification.ts";
import {
  convertUsdToGbp,
  presentSearchIntelligenceMoney,
  searchIntelligenceMoneyFootnote,
  USD_TO_GBP_RATE,
} from "../src/pharmacy/searchIntelligenceMoney.ts";
import { buildSearchIntelligenceCampaignQueries } from "../src/pharmacy/searchIntelligenceCampaignInputs.ts";
import { buildServiceSearchDemandQueries } from "../src/pharmacy/serviceSearchDemandQueryBuilder.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function main() {
  console.log("\n=== Search Intelligence generic classification / GBP / campaign reuse ===\n");

  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    throw new Error(`Unexpected external request: ${String(input)}`);
  }) as typeof fetch;

  const classified = classifyOrganicSearchEvidence({
    tenantWebsiteUrls: ["https://www.acmepharmacy.com/"],
    pharmacyName: "Acme Pharmacy",
    verifiedGoogleCompetitorWebsites: [
      {
        name: "Village Pharmacy",
        website: "https://villagepharmacy.example/",
        placeId: "ChIJ-village",
        source: "google-places",
      },
    ],
    rows: [
      {
        domain: "acmepharmacy.co.uk",
        title: "Welcome to Acme Pharmacy",
        url: "https://acmepharmacy.co.uk/",
        position: 2,
      },
      {
        domain: "villagepharmacy.example",
        title: "Village Pharmacy",
        url: "https://villagepharmacy.example/services",
        position: 2,
      },
      {
        domain: "riverpharmacy.co.uk",
        title: "Pharmacy First - NHS Common conditions Service",
        url: "https://www.riverpharmacy.co.uk/nhs-services/pharmacy-first",
        position: 2,
      },
      {
        domain: "safyschemist.example",
        title: "Free NHS Pharmacy First",
        url: "https://safyschemist.example/pharmacy-first/",
        position: 5,
      },
      {
        domain: "treatlocal.co.uk",
        title: "NHS Pharmacy First Service in Leicester",
        url: "https://treatlocal.co.uk/pharmacy-first/leicester",
        position: 3,
      },
      {
        domain: "mylocalsurgery.co.uk",
        title: "Pharmacy First Consultations",
        url: "https://mylocalsurgery.co.uk/our-services/pharmacy-first",
        position: 4,
      },
      {
        domain: "nhs.uk",
        title: "PHARMACY FIRST",
        url: "https://www.nhs.uk/services/pharmacy/pharmacy-first/FAK57",
        position: 1,
      },
      {
        domain: "communitypharmacy.org.uk",
        title: "Pharmacy First",
        url: "https://communitypharmacy.org.uk/national-services/",
        position: 5,
      },
      {
        domain: "facebook.com",
        title: "Shingles pharmacist post",
        url: "https://www.facebook.com/example/posts/1",
        position: 5,
      },
      {
        domain: "careoperator.example",
        title: "Pharmacy First",
        url: "https://www.careoperator.example/pharmacy-first/",
        position: 5,
      },
    ],
  });

  const byDomain = Object.fromEntries(classified.rows.map((row) => [row.domain, row]));
  const labels = classified.rows.map((row) => row.classificationLabel);

  record(
    "own-domain-related-tld",
    byDomain["acmepharmacy.co.uk"]?.section === "your_pharmacy" &&
      byDomain["acmepharmacy.co.uk"]?.classificationLabel === "Your pharmacy",
    "acmepharmacy.co.uk is own business vs acmepharmacy.com",
  );
  record(
    "own-domain-brand-helper",
    isOwnBusinessDomain("acmepharmacy.co.uk", ["acmepharmacy.com"], "Acme Pharmacy"),
    "brand key matches related TLD",
  );
  record(
    "verified-local-competitor",
    byDomain["villagepharmacy.example"]?.section === "verified_local_competitor" &&
      /Verified local competitor/.test(byDomain["villagepharmacy.example"]?.classificationLabel || ""),
    "Places website match stays verified local competitor",
  );
  record(
    "pharmacy-domain-other-competitor",
    byDomain["riverpharmacy.co.uk"]?.landscapeKind === "other_pharmacy" &&
      byDomain["riverpharmacy.co.uk"]?.section === "wider_organic_landscape" &&
      byDomain["riverpharmacy.co.uk"]?.classificationLabel === "Other pharmacy competitor",
    "pharmacy domain is other pharmacy competitor, not Places competitor",
  );
  record(
    "chemist-domain-other-competitor",
    byDomain["safyschemist.example"]?.landscapeKind === "other_pharmacy" &&
      byDomain["safyschemist.example"]?.classificationLabel === "Other pharmacy competitor",
    "chemist domain classified as other pharmacy competitor",
  );
  record(
    "directory-treatlocal",
    byDomain["treatlocal.co.uk"]?.landscapeKind === "directory" &&
      byDomain["treatlocal.co.uk"]?.classificationLabel === "Directory",
    "treatlocal is directory landscape",
  );
  record(
    "directory-mylocalsurgery",
    byDomain["mylocalsurgery.co.uk"]?.landscapeKind === "directory",
    "mylocalsurgery is directory landscape",
  );
  record(
    "nhs-community",
    byDomain["nhs.uk"]?.landscapeKind === "nhs_community" &&
      byDomain["communitypharmacy.org.uk"]?.landscapeKind === "nhs_community",
    "NHS/community stay landscape",
  );
  record("social-landscape", byDomain["facebook.com"]?.landscapeKind === "social", "social stays landscape");
  record(
    "insufficient-evidence-other-result",
    byDomain["careoperator.example"]?.landscapeKind === "other_landscape" &&
      byDomain["careoperator.example"]?.classificationLabel === "Other search result" &&
      byDomain["careoperator.example"]?.section === "wider_organic_landscape",
    "Pharmacy First title alone is not a manufactured competitor",
  );
  record(
    "no-unmatched-domain-label",
    labels.every((label) => !/unmatched/i.test(label)),
    labels.join(" | "),
  );
  record(
    "nhs-not-own-business-by-name",
    !isOwnBusinessDomain("england.nhs.uk", ["acmepharmacy.com"], "NHS Pharmacy"),
    "NHS hosts are never own-business by brand key",
  );

  const converted = presentSearchIntelligenceMoney(2.71, "USD");
  record("gbp-display-currency", converted.displayCurrency === "GBP" && converted.display.startsWith("£"), converted.display);
  record("gbp-converted-not-relabelled", converted.converted === true && converted.sourceCurrency === "USD", `source=${converted.sourceCurrency}`);
  record(
    "gbp-amount",
    converted.amountGbp === convertUsdToGbp(2.71) && converted.amountGbp === 2.01,
    `£${converted.amountGbp} at ${USD_TO_GBP_RATE}`,
  );
  record(
    "gbp-native-not-converted",
    presentSearchIntelligenceMoney(1.5, "GBP").converted === false &&
      presentSearchIntelligenceMoney(1.5, "GBP").display === "£1.50",
    "native GBP left as GBP",
  );
  record("gbp-footnote-explains-usd-source", /USD/.test(searchIntelligenceMoneyFootnote()) && /GBP/.test(searchIntelligenceMoneyFootnote()), "footnote has source semantics");

  const pageSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/growthEngineLocalSearchIntelligencePage.ts"), "utf8");
  record("page-uses-gbp-presenter", pageSrc.includes("presentSearchIntelligenceMoney") && pageSrc.includes("searchIntelligenceMoneyFootnote"), "page wires GBP presenter");
  record("page-cpc-not-usd-column", !pageSrc.includes("CPC (USD)"), "CPC column is not labelled USD");
  record("page-money-uses-source-currency", pageSrc.includes("row.cpcCurrency"), "CPC uses stored source currency");

  const pf = buildSearchIntelligenceCampaignQueries({
    serviceId: "pharmacy-first",
    pharmacyName: "Acme Pharmacy",
    town: "Leeds",
    postcode: "LS1 1AA",
  });
  const travel = buildSearchIntelligenceCampaignQueries({
    serviceId: "travel-vaccinations",
    pharmacyName: "Acme Pharmacy",
    town: "Leeds",
    postcode: "LS1 1AA",
  });
  const travelDemand = buildServiceSearchDemandQueries({ serviceId: "travel-vaccinations" });
  const pfDemand = buildServiceSearchDemandQueries({ serviceId: "pharmacy-first" });

  record("campaign-service-ids", pf.serviceId === "pharmacy-first" && travel.serviceId === "travel-vaccinations", `${pf.serviceId} / ${travel.serviceId}`);
  record(
    "second-service-organic-is-specific",
    travel.organicQueries.length > 0 &&
      travel.organicQueries.some((q) => /travel/i.test(q)) &&
      travel.organicQueries.every((q) => !/pharmacy first/i.test(q)),
    travel.organicQueries.join(" | "),
  );
  record(
    "second-service-demand-is-specific",
    travelDemand.length > 0 &&
      travelDemand.some((q) => /travel/i.test(q)) &&
      travelDemand.every((q) => !/pharmacy first/i.test(q)) &&
      travel.demandQueries.every((q) => !/pharmacy first/i.test(q)),
    travelDemand.join(" | "),
  );
  record(
    "pharmacy-first-queries-remain-service-specific",
    pfDemand.some((q) => /pharmacy first/i.test(q)) &&
      pf.organicQueries.some((q) => /pharmacy first/i.test(q)),
    pfDemand.join(" | "),
  );
  record(
    "services-produce-different-inputs",
    JSON.stringify(travel.organicQueries) !== JSON.stringify(pf.organicQueries) &&
      JSON.stringify(travelDemand) !== JSON.stringify(pfDemand),
    "travel-vaccinations inputs differ from pharmacy-first",
  );
  record(
    "second-service-name-not-pharmacy-first",
    !/pharmacy first/i.test(travel.serviceName),
    travel.serviceName,
  );

  const visionDemand = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/growth-engine/vision-pharmacy-service-search-demand.json"), "utf8"),
  ) as { confirmedServiceIds: string[]; demandByService: Record<string, { queries: Array<{ query: string; cpc: number | null; cpcCurrency: string | null }> }> };
  const visionQueries = visionDemand.demandByService["pharmacy-first"]?.queries || [];
  record(
    "vision-pharmacy-first-demand-intact",
    visionDemand.confirmedServiceIds.includes("pharmacy-first") &&
      visionQueries.some((row) => row.query === "pharmacy first" && row.cpc === 2.71 && row.cpcCurrency === "USD"),
    `${visionQueries.length} stored PF demand rows`,
  );

  record("no-external-calls", fetchCalls.length === 0, fetchCalls.join(" | ") || "none");
  globalThis.fetch = originalFetch;

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
