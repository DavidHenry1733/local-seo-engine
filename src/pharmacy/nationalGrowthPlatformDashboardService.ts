import { readVerifiedNationalCompetitorIntelligence } from "./verifiedNationalCompetitorIntelligenceService.ts";
/**
 * National Growth Platform Dashboard V1
 *
 * Visual/product checkpoint for the NATIONAL Growth Platform.
 *
 * This service is intentionally status-only.
 * It does NOT execute discovery.
 * It does NOT execute Google Places.
 * It does NOT execute healthcare discovery.
 * It does NOT mutate LOCAL Growth Platform evidence.
 */

import fs from "node:fs";
import {
  resolveGrowthPlatform,
  isNationalGrowthPlatform,
} from "./growthPlatformResolverService.ts";
import { nationalIntelligenceDataPath } from "./nationalIntelligenceStorageService.ts";

export type NationalPlatformStepStatus =
  | "complete"
  | "ready"
  | "not_run"
  | "not_applicable";

export interface NationalPlatformDashboardStep {
  id: string;
  label: string;
  status: NationalPlatformStepStatus;
  statusLabel: string;
  detail: string;
}

export interface NationalGrowthPlatformDashboard {
  platform: "national";
  platformLabel: string;
  market: string;
  targetCustomer: string;
  competitorUniverse: string;
  localMarketIntelligence: string;
  googlePlacesCompetitorDiscovery: string;
  healthcareIntelligence: string;
  steps: NationalPlatformDashboardStep[];
  nextAction: {
    id: string;
    label: string;
    enabled: boolean;
    detail: string;
    actionType: "workflow";
    actionState: "ready" | "blocked" | "complete";
  };
  evidence: {
    competitorDiscoveryPath: string;
    competitorDiscoveryExists: boolean;
    competitorDiscoveryStatus: string;
    competitorCount: number;
    generatedAt: string | null;
  };
}

function discoveryPath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "competitor-discovery");
}

function readDiscoveryEvidence(slug: string): {
  exists: boolean;
  status: string;
  competitorCount: number;
  generatedAt: string | null;
} {
  const file = discoveryPath(slug);

  if (!fs.existsSync(file)) {
    return {
      exists: false,
      status: "not_run",
      competitorCount: 0,
      generatedAt: null,
    };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const competitors = Array.isArray(raw?.competitors)
      ? raw.competitors
      : Array.isArray(raw?.qualifiedCompetitors)
        ? raw.qualifiedCompetitors
        : [];

    return {
      exists: true,
      status: String(raw?.status || "draft"),
      competitorCount: competitors.length,
      generatedAt: raw?.generatedAt || raw?.updatedAt || null,
    };
  } catch {
    return {
      exists: true,
      status: "invalid_evidence",
      competitorCount: 0,
      generatedAt: null,
    };
  }
}


function getVerifiedNationalCompetitorDashboardEvidence(slug: string){
  try {
    const intelligence =
      readVerifiedNationalCompetitorIntelligence(slug);
    if (!intelligence) throw new Error("verified_national_competitor_intelligence_not_found");

    return {
      status: intelligence.status,
      generatedAt: intelligence.generatedAt,
      market: intelligence.market,
      evidenceSources: intelligence.evidenceSources,

      directCompetitorCount:
        intelligence.directCompetitorCount,

      adjacentCompetitorCount:
        intelligence.adjacentCompetitorCount,

      rejectedCount:
        intelligence.rejectedCount,

      insufficientEvidenceCount:
        intelligence.insufficientEvidenceCount,

      totalRelevantKeywords:
        intelligence.totalRelevantKeywords,

      totalHighCommercialKeywords:
        intelligence.totalHighCommercialKeywords,

      totalRelevantSearchVolume:
        intelligence.totalRelevantSearchVolume,

      directCompetitors:
        intelligence.directCompetitors,

      adjacentCompetitors:
        intelligence.adjacentCompetitors,
    };
  } catch (error) {
    return {
      status:"unavailable",
      error:
        error instanceof Error ?
        error.message :
        String(error),
      directCompetitorCount:0,
      adjacentCompetitorCount:0,
      directCompetitors:[],
      adjacentCompetitors:[],
    };
  }
}

export function buildNationalGrowthPlatformDashboard(
  slug: string,
): NationalGrowthPlatformDashboard {
  const platform = resolveGrowthPlatform(slug);

  if (!isNationalGrowthPlatform(slug)) {
    throw new Error(
      `National Growth Platform Dashboard is not applicable to ${slug}; resolved platform=${platform.platform}`,
    );
  }

  const discovery = readDiscoveryEvidence(slug);

  const discoveryComplete =
    discovery.exists &&
    discovery.competitorCount > 0 &&
    !["draft", "not_run", "invalid_evidence"].includes(discovery.status);

  return {
    platform: "national",
    platformLabel: "NATIONAL Growth Platform",
    market: "United Kingdom",
    targetCustomer: "UK Community Pharmacies",
    competitorUniverse:
      "National pharmacy digital-service providers competing for UK pharmacy customers",
    localMarketIntelligence: "Not Applicable",
    googlePlacesCompetitorDiscovery: "Not Applicable",
    healthcareIntelligence: "Not Applicable",

    steps: [
      {
        id: "platform_classification",
        label: "Platform Classification",
        status: "complete",
        statusLabel: "Complete",
        detail: "This customer is explicitly configured for the NATIONAL Growth Platform.",
      },
      {
        id: "runtime_separation",
        label: "Runtime Separation",
        status: "complete",
        statusLabel: "Complete",
        detail: "National and Local Growth Platform applicability is resolved independently.",
      },
      {
        id: "workflow_protection",
        label: "Workflow Protection",
        status: "complete",
        statusLabel: "Complete",
        detail: "Local competitor and Local Market Intelligence workflows are blocked for the national platform.",
      },
      {
        id: "national_competitor_contract",
        label: "National Competitor Contract",
        status: "complete",
        statusLabel: "Complete",
        detail: "National competitor evidence is separated from Google Places/local proximity evidence.",
      },
      {
        id: "national_discovery_engine",
        label: "National Discovery Engine",
        status: "complete",
        statusLabel: "Complete",
        detail: "National query generation, qualification and evidence storage contracts are implemented and validated.",
      },
      {
        id: "live_competitor_discovery",
        label: "Live Competitor Discovery",
        status: discoveryComplete ? "complete" : "not_run",
        statusLabel: discoveryComplete ? "Complete" : "Not Run",
        detail: discoveryComplete
          ? `${discovery.competitorCount} qualified national competitors recorded.`
          : "Live national competitor discovery has not yet been run.",
      },
      {
        id: "competitor_website_analysis",
        label: "Competitor Website Analysis",
        status: "not_run",
        statusLabel: "Not Run",
        detail: "Runs after qualified national competitors have been captured.",
      },
      {
        id: "national_market_intelligence",
        label: "National Market Intelligence",
        status: "not_run",
        statusLabel: "Not Run",
        detail: "National competitive-market synthesis has not yet been generated.",
      },
      {
        id: "national_growth_intelligence",
        label: "National Growth Intelligence",
        status: "not_run",
        statusLabel: "Not Run",
        detail: "National growth recommendations have not yet been generated.",
      },
    ],

    nextAction: {
      id: "run_national_competitor_discovery",
      label: discoveryComplete
        ? "Review National Competitors"
        : "Run National Competitor Discovery",
      enabled: true,
      detail: discoveryComplete
        ? "National competitor evidence exists and is ready for review."
        : "Execute the National Competitor Discovery workflow against live national evidence.",
      actionType: "workflow",
      actionState: discoveryComplete ? "complete" : "ready",
    },

    evidence: {
      competitorDiscoveryPath: discoveryPath(slug),
      competitorDiscoveryExists: discovery.exists,
      competitorDiscoveryStatus: discovery.status,
      competitorCount: discovery.competitorCount,
      generatedAt: discovery.generatedAt,
    },
  };
}
