import * as discoveryModel from "../src/pharmacy/nationalCompetitorDiscoveryModel.ts";
import * as discoveryQuery from "../src/pharmacy/nationalCompetitorDiscoveryQueryService.ts";
import * as qualification from "../src/pharmacy/nationalCompetitorQualificationService.ts";
import * as discoveryStorage from "../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts";
import * as growthPlatform from "../src/pharmacy/growthPlatformResolverService.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { emptyNationalCompetitorDiscoveryResult } = exported(discoveryModel);
const { buildNationalCompetitorDiscoveryQueries } = exported(discoveryQuery);
const { qualifyNationalCompetitor } = exported(qualification);
const { nationalCompetitorDiscoveryPath } = exported(discoveryStorage);
const { resolveGrowthPlatform } = exported(growthPlatform);

let passed = 0;
let failed = 0;

function check(
  id: string,
  condition: boolean,
  detail: unknown,
): void {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${id} — ${String(detail)}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${id} — ${String(detail)}`);
  }
}

console.log("\n=== NC-02 NATIONAL COMPETITOR DISCOVERY V1 ===\n");

const platform = resolveGrowthPlatform("pharmaconnect");

check(
  "platform-national",
  platform.platform === "national",
  platform.platform,
);

const context = {
  businessName: "PharmaConnect",
  marketCountry: "United Kingdom",
  targetCustomerMarket: "UK community pharmacies",
  services: [
    "Pharmacy Website Design",
    "Pharmacy Local SEO",
    "Pharmacy Email Marketing",
    "Pharmacy Website Hosting",
    "Pharmacy Growth Audits",
  ],
};

const queries = buildNationalCompetitorDiscoveryQueries(context);

check(
  "queries-created",
  queries.length >= 5,
  queries.length,
);

check(
  "queries-national-country",
  queries.every((q) => q.marketCountry === "United Kingdom"),
  queries.map((q) => q.marketCountry).join(", "),
);

check(
  "queries-pharmacy-market",
  queries.every((q) => /pharmac/i.test(q.query)),
  queries.map((q) => q.query).join(" | "),
);

check(
  "queries-no-rotherham",
  queries.every((q) => !/rotherham/i.test(q.query)),
  "physical office locality excluded",
);

check(
  "queries-no-distance",
  queries.every((q) => !/near me|within \d|radius|distance/i.test(q.query)),
  "no proximity discovery",
);

const strong = qualifyNationalCompetitor({
  candidateName: "Example Pharmacy Digital",
  domain: "example-pharmacy-digital.co.uk",
  websiteText:
    "We are a UK digital agency for pharmacies providing pharmacy website design, SEO, email marketing and hosting.",
  targetCustomerMarket: context.targetCustomerMarket,
  targetServices: context.services,
  ownDomains: ["pharmaconnect.uk"],
});

check(
  "strong-competitor-qualified",
  strong.qualification === "qualified",
  `${strong.qualification} score=${strong.score}`,
);

check(
  "strong-service-overlap",
  strong.matchedServices.length >= 3,
  strong.matchedServices.join(", "),
);

const unrelated = qualifyNationalCompetitor({
  candidateName: "Example Restaurant Agency",
  domain: "restaurant-example.co.uk",
  websiteText:
    "Restaurant branding and menu photography services for independent restaurants.",
  targetCustomerMarket: context.targetCustomerMarket,
  targetServices: context.services,
  ownDomains: ["pharmaconnect.uk"],
});

check(
  "unrelated-rejected",
  unrelated.qualification === "rejected",
  `${unrelated.qualification} score=${unrelated.score}`,
);

const self = qualifyNationalCompetitor({
  candidateName: "PharmaConnect",
  domain: "pharmaconnect.uk",
  websiteText:
    "Pharmacy website design, local SEO, email marketing and hosting for pharmacies.",
  targetCustomerMarket: context.targetCustomerMarket,
  targetServices: context.services,
  ownDomains: ["pharmaconnect.uk"],
});

check(
  "self-domain-rejected",
  self.qualification === "rejected",
  self.rejectionReasons.join("; "),
);

const empty = emptyNationalCompetitorDiscoveryResult(
  "pharmaconnect",
  context.marketCountry,
  context.targetCustomerMarket,
);

check(
  "empty-platform-national",
  empty.platform === "national",
  empty.platform,
);

check(
  "empty-status-draft",
  empty.status === "draft",
  empty.status,
);

check(
  "empty-no-fake-competitors",
  empty.qualifiedCompetitors.length === 0,
  empty.qualifiedCompetitors.length,
);

const storage = nationalCompetitorDiscoveryPath("pharmaconnect");

check(
  "storage-national",
  storage.includes("/data/national-growth-engine/"),
  storage,
);

check(
  "storage-not-local-market",
  !storage.includes("local-market"),
  storage,
);

const forbiddenKeys = [
  "placeId",
  "distanceKm",
  "distanceLabel",
  "latitude",
  "longitude",
  "googleMapsUrl",
  "healthcare",
  "nearestDistanceKm",
];

const serialised = JSON.stringify({
  empty,
  queries,
  strong,
});

check(
  "no-local-google-fields",
  forbiddenKeys.every(
    (key) => !new RegExp(`"${key}"\\s*:`).test(serialised),
  ),
  forbiddenKeys.join(", "),
);

console.log(
  `\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`,
);

if (failed) process.exit(1);
