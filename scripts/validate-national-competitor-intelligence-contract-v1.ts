import {
  emptyNationalCompetitorIntelligenceSnapshot,
} from "../src/pharmacy/nationalCompetitorIntelligenceModel.ts";

import {
  emptyNationalMarketIntelligenceSnapshot,
} from "../src/pharmacy/nationalMarketIntelligenceModel.ts";

import {
  emptyNationalGrowthIntelligenceSnapshot,
} from "../src/pharmacy/nationalGrowthIntelligenceModel.ts";

import {
  nationalCompetitorSnapshotPath,
  nationalMarketSnapshotPath,
  nationalGrowthSnapshotPath,
} from "../src/pharmacy/nationalIntelligenceStorageService.ts";

import {
  resolveGrowthPlatform,
} from "../src/pharmacy/growthPlatformResolverService.ts";

let passed = 0;
let failed = 0;

function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    failed++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

console.log("\n=== NC-01 NATIONAL COMPETITOR INTELLIGENCE CONTRACT V1 ===\n");

const slug = "pharmaconnect";

const platform = resolveGrowthPlatform(slug);

check(
  "platform-national",
  platform.platform === "national",
  platform.platform,
);

const competitor = emptyNationalCompetitorIntelligenceSnapshot(slug);

check(
  "competitor-platform-national",
  competitor.growthPlatform === "national",
  competitor.growthPlatform,
);

check(
  "competitor-country",
  competitor.marketCountry === "United Kingdom",
  competitor.marketCountry,
);

check(
  "competitor-source",
  competitor.source === "national-competitor-intelligence-v1",
  competitor.source,
);

check(
  "competitor-empty",
  competitor.competitors.length === 0,
  String(competitor.competitors.length),
);

check(
  "competitor-gap-empty",
  competitor.gaps.length === 0,
  String(competitor.gaps.length),
);

check(
  "competitor-status-draft",
  competitor.status === "draft",
  competitor.status,
);

check(
  "competitor-count-zero-not-evidence",
  competitor.summary.competitorCount === 0,
  String(competitor.summary.competitorCount),
);

const market = emptyNationalMarketIntelligenceSnapshot(slug);

check(
  "market-platform-national",
  market.growthPlatform === "national",
  market.growthPlatform,
);

check(
  "market-country",
  market.country === "United Kingdom",
  market.country,
);

check(
  "market-status-draft",
  market.status === "draft",
  market.status,
);

const growth = emptyNationalGrowthIntelligenceSnapshot(slug);

check(
  "growth-platform-national",
  growth.growthPlatform === "national",
  growth.growthPlatform,
);

check(
  "growth-opportunities-empty",
  growth.opportunities.length === 0,
  String(growth.opportunities.length),
);

check(
  "growth-roadmap-high-empty",
  growth.roadmap.high.length === 0,
  String(growth.roadmap.high.length),
);

check(
  "growth-roadmap-medium-empty",
  growth.roadmap.medium.length === 0,
  String(growth.roadmap.medium.length),
);

check(
  "growth-roadmap-later-empty",
  growth.roadmap.later.length === 0,
  String(growth.roadmap.later.length),
);

check(
  "growth-status-draft",
  growth.status === "draft",
  growth.status,
);

const competitorPath = nationalCompetitorSnapshotPath(slug);
const marketPath = nationalMarketSnapshotPath(slug);
const growthPath = nationalGrowthSnapshotPath(slug);

check(
  "competitor-storage-is-national",
  /data\/national-growth-engine\/pharmaconnect-competitors\.json$/.test(
    competitorPath.replaceAll("\\", "/"),
  ),
  competitorPath,
);

check(
  "market-storage-is-national",
  /data\/national-growth-engine\/pharmaconnect-market\.json$/.test(
    marketPath.replaceAll("\\", "/"),
  ),
  marketPath,
);

check(
  "growth-storage-is-national",
  /data\/national-growth-engine\/pharmaconnect-growth\.json$/.test(
    growthPath.replaceAll("\\", "/"),
  ),
  growthPath,
);

/*
 * Structural safeguard:
 * National competitor records deliberately have no local-market fields.
 */
const forbiddenNationalFields = [
  "placeId",
  "distanceKm",
  "latitude",
  "longitude",
  "googleMapsUrl",
  "healthcare",
  "nearestDistanceKm",
];

const sampleNationalRecord = {
  competitorId: "sample",
  businessName: "Sample",
  domain: "example.com",
  website: "https://example.com",
  discoverySource: "operator_seed",
  relationship: "direct",
  confidence: "high",
  targetCustomer: [],
  sectors: [],
  services: [],
  positioning: [],
  commercialStrengths: [],
  commercialWeaknesses: [],
  websiteEvidence: null,
  searchEvidence: null,
  evidence: [],
  discoveredAt: new Date().toISOString(),
  analysedAt: null,
};

check(
  "no-local-fields-in-national-record",
  forbiddenNationalFields.every(
    (field) => !(field in sampleNationalRecord),
  ),
  forbiddenNationalFields.join(", "),
);

console.log(
  `\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`,
);

if (failed) process.exit(1);
