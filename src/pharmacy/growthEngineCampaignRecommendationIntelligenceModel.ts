/**
 * Campaign Recommendation Intelligence V1 — evidence-backed consultation model.
 */

export const CAMPAIGN_RECOMMENDATION_INTELLIGENCE_VERSION = 1;

export type CampaignPositionLevel = "Excellent" | "Good" | "Needs Improvement";

export type CampaignConfidenceLevel = "High" | "Medium" | "Low";

export type CampaignEvidenceCardId =
  | "website-detected"
  | "gbp-not-promoted"
  | "competitors-promoting"
  | "limited-supporting-content"
  | "missing-patient-guide"
  | "missing-faqs"
  | "missing-local-pages"
  | "website-limited-support"
  | "profile-service-match";

export interface CampaignEvidenceCard {
  id: CampaignEvidenceCardId;
  label: string;
  detail: string;
  source: "Google Business Profile" | "Website Analysis" | "Local Market Analysis";
}

export interface CampaignPositionScore {
  id: string;
  label: string;
  level: CampaignPositionLevel;
}

export interface CampaignRecommendationSummary {
  campaignName: string;
  reasonSelected: string;
  assetsToCreate: number;
  estimatedBuildTime: string;
  tagline: string;
}

export interface CampaignRecommendationConfidence {
  level: CampaignConfidenceLevel;
  stars: number;
  sources: Array<"Google Business Profile" | "Website Analysis" | "Local Market Analysis">;
}

export interface CampaignRecommendationIntelligence {
  version: number;
  slug: string;
  serviceId: string;
  serviceName: string;
  whyRecommendTitle: string;
  whyNow: string;
  evidenceCards: CampaignEvidenceCard[];
  currentPosition: CampaignPositionScore[];
  expectedOutcomes: string[];
  summary: CampaignRecommendationSummary;
  confidence: CampaignRecommendationConfidence;
  whatsNext: string;
}

export const CAMPAIGN_EVIDENCE_CARD_LABELS: Record<CampaignEvidenceCardId, string> = {
  "website-detected": "Service detected on your website",
  "gbp-not-promoted": "Service not promoted on Google Business Profile",
  "competitors-promoting": "Competitors actively promoting this service",
  "limited-supporting-content": "Limited supporting content on your website",
  "missing-patient-guide": "Missing patient guide",
  "missing-faqs": "Missing FAQs",
  "missing-local-pages": "Missing local landing pages",
  "website-limited-support": "Website contains the service but limited supporting information",
  "profile-service-match": "Service matches your selected pharmacy services",
};

export const CAMPAIGN_EXPECTED_OUTCOME_OPTIONS = [
  "Help more patients discover this service",
  "Strengthen your online presence",
  "Improve supporting content",
  "Build trust with patients",
  "Support local Google visibility",
  "Improve consistency across your website",
] as const;

export const CAMPAIGN_INTELLIGENCE_FORBIDDEN_TERMS = [
  "seo",
  "generator",
  "engine",
  "workflow",
  " ai ",
  "artificial intelligence",
  "ranking",
  "revenue",
  "demand",
  "statistics",
] as const;
