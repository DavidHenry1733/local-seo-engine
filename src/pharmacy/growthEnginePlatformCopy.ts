/**
 * Shared Growth Engine copy for LOCAL vs NATIONAL product mode.
 * Do not globally rename "pharmacy". PharmaConnect serves pharmacies;
 * it is not itself a pharmacy.
 */
import type { GrowthPlatform } from "./commercialMarketContextService.ts";
import { resolveGrowthPlatform } from "./growthPlatformResolverService.ts";

export interface GrowthEnginePlatformCopy {
  platform: GrowthPlatform;
  programmeLabel: string;
  hubTitle: string;
  hubLead: string;
  businessStepTitle: string;
  businessStepSubtitle: string;
  marketStepTitle: string;
  marketStepSubtitle: string;
  websiteStepTitle: string;
  websiteStepSubtitle: string;
  planStepTitle: string;
  planStepSubtitle: string;
  generateStepTitle: string;
  generateStepSubtitle: string;
  dashboardStepTitle: string;
  stepperAriaLabel: string;
  readinessBusiness: string;
  readinessBusinessIncomplete: string;
  readinessWebsite: string;
  readinessWebsiteIncomplete: string;
  readinessMarket: string;
  readinessMarketIncomplete: string;
  readinessIntelligence: string;
  readinessIntelligenceIncomplete: string;
  readinessGenerator: string;
  readinessGeneratorIncomplete: string;
  evidencePharmacyProfile: string;
  emptyCampaignNote: string;
  generateCta: string;
}

const LOCAL_COPY: GrowthEnginePlatformCopy = {
  platform: "local",
  programmeLabel: "Your pharmacy programme",
  hubTitle: "Your Pharmacy Programme",
  hubLead: "Four commercial reports tell you where you stand, how you compare, what is missing, and what to do next — then create and publish your campaign.",
  businessStepTitle: "Your Pharmacy",
  businessStepSubtitle: "Import from your website and Google — confirm what we found",
  marketStepTitle: "Your Local Market",
  marketStepSubtitle: "See how you compare to nearby pharmacies",
  websiteStepTitle: "Your Website Report",
  websiteStepSubtitle: "What your website contains and what is missing",
  planStepTitle: "Your Growth Plan",
  planStepSubtitle: "One evidence-backed campaign recommendation",
  generateStepTitle: "Create Content",
  generateStepSubtitle: "Build your campaign pages and supporting content",
  dashboardStepTitle: "Your Dashboard",
  stepperAriaLabel: "Pharmacy growth reports",
  readinessBusiness: "Pharmacy information ready",
  readinessBusinessIncomplete: "Your Pharmacy incomplete",
  readinessWebsite: "Your Website Report complete",
  readinessWebsiteIncomplete: "Your Website Report incomplete",
  readinessMarket: "Your Local Market complete",
  readinessMarketIncomplete: "Your Local Market incomplete",
  readinessIntelligence: "Evidence reviewed",
  readinessIntelligenceIncomplete: "Evidence not yet reviewed",
  readinessGenerator: "Content creation ready",
  readinessGeneratorIncomplete: "Content creation not yet available",
  evidencePharmacyProfile: "your pharmacy profile",
  emptyCampaignNote:
    "No evidence-backed campaign is available yet. Complete Your Pharmacy, Your Local Market, and Your Website Report to unlock a recommendation.",
  generateCta: "Open Campaign Builder →",
};

const NATIONAL_COPY: GrowthEnginePlatformCopy = {
  platform: "national",
  programmeLabel: "National digital-growth programme",
  hubTitle: "National Digital Growth Programme",
  hubLead: "National market intelligence for a digital-growth business serving UK community pharmacies — not a local pharmacy workflow.",
  businessStepTitle: "Your Business",
  businessStepSubtitle: "National digital-growth identity and commercial services",
  marketStepTitle: "National Market",
  marketStepSubtitle: "Organic ranking keywords and search competitors — local Google Places is not applicable",
  websiteStepTitle: "Your Website Report",
  websiteStepSubtitle: "What your website contains and what is missing",
  planStepTitle: "Your Growth Plan",
  planStepSubtitle: "Evidence-backed national commercial recommendation",
  generateStepTitle: "Campaign Strategy",
  generateStepSubtitle: "National recommendation is strategy-first — patient-service generation is not used here",
  dashboardStepTitle: "Your Dashboard",
  stepperAriaLabel: "National digital-growth reports",
  readinessBusiness: "National business identity confirmed",
  readinessBusinessIncomplete: "National business identity not confirmed",
  readinessWebsite: "Website report available",
  readinessWebsiteIncomplete: "Website report not yet available",
  readinessMarket: "National market intelligence (Google Places not required)",
  readinessMarketIncomplete: "National market intelligence not yet available",
  readinessIntelligence: "National commercial intelligence loaded",
  readinessIntelligenceIncomplete: "National commercial intelligence not loaded",
  readinessGenerator: "National content generation not yet available",
  readinessGeneratorIncomplete: "National content generation not yet available",
  evidencePharmacyProfile: "your national commercial profile",
  emptyCampaignNote:
    "No eligible national commercial action is available in persisted Growth Plan Intelligence. Local pharmacy prerequisites are not required.",
  generateCta: "National strategy is ready",
};

export function growthEnginePlatformCopy(slugOrPlatform: string | GrowthPlatform): GrowthEnginePlatformCopy {
  const platform =
    slugOrPlatform === "national" || slugOrPlatform === "local"
      ? slugOrPlatform
      : resolveGrowthPlatform(slugOrPlatform).platform;
  return platform === "national" ? NATIONAL_COPY : LOCAL_COPY;
}

export function customerReadinessLabelForPlatform(
  platform: GrowthPlatform,
  label: string,
  complete = true,
): string {
  const copy = growthEnginePlatformCopy(platform);
  if (platform === "local") {
    const local: Record<string, { done: string; pending: string }> = {
      "Business Profile complete": { done: copy.readinessBusiness, pending: copy.readinessBusinessIncomplete },
      "Website analysed": { done: copy.readinessWebsite, pending: copy.readinessWebsiteIncomplete },
      "Local Healthcare analysed": { done: copy.readinessMarket, pending: copy.readinessMarketIncomplete },
      "Growth Intelligence complete": {
        done: copy.readinessIntelligence,
        pending: copy.readinessIntelligenceIncomplete,
      },
      "Generator available": { done: copy.readinessGenerator, pending: copy.readinessGeneratorIncomplete },
    };
    const pair = local[label];
    if (pair) return complete ? pair.done : pair.pending;
  }
  const map: Record<string, string> = {
    "Business Profile complete": copy.readinessBusiness,
    "Website analysed": copy.readinessWebsite,
    "Local Healthcare analysed": copy.readinessMarket,
    "National market intelligence": copy.readinessMarket,
    "Growth Intelligence complete": copy.readinessIntelligence,
    "National commercial intelligence": copy.readinessIntelligence,
    "Generator available": copy.readinessGenerator,
    "National content generation": copy.readinessGenerator,
  };
  if (map[label]) return map[label];
  if (platform === "local") {
    return label.replace(/generator/gi, "content creation").replace(/registry/gi, "page tracker");
  }
  return label;
}
