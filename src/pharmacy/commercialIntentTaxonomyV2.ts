export type CommercialIntentV2Type =
  | "MONEY_KEYWORD"
  | "COMMERCIAL_SUPPORT"
  | "AUTHORITY_SUPPORT"
  | "PATIENT_SERVICE"
  | "NAVIGATIONAL"
  | "LOCAL_PHARMACY"
  | "INDUSTRY_IRRELEVANT"
  | "AMBIGUOUS_REVIEW";

export interface CommercialIntentV2Result {
  keyword: string;
  type: CommercialIntentV2Type;
  marketScope: "CORE" | "ADJACENT" | "BROAD" | "NONE";
  commercialIntentScore: number;
  reasons: string[];
  matchedMarketSignals: string[];
  matchedCommercialSignals: string[];
  matchedNegativeSignals: string[];
}

const marketSignals = [
  "pharmacy",
  "pharmacies",
  "pharmacist",
  "pharmacists",
  "pharma",
  "community pharmacy",
  "independent pharmacy",
];

const moneyServiceSignals = [
  "seo",
  "search engine optimisation",
  "search engine optimization",
  "marketing",
  "digital marketing",
  "advertising",
  "ads",
  "ppc",
  "website",
  "websites",
  "web design",
  "website design",
  "website development",
  "digital agency",
  "marketing agency",
  "patient acquisition",
  "customer acquisition",
  "online visibility",
  "google visibility",
  "local seo",
  "email marketing",
  "social media marketing",
  "digital strategy",
  "branding",
  "growth",
  "creative agency",
  "creative agencies",
];

const commercialSupportSignals = [
  "ideas",
  "strategy",
  "strategies",
  "requirements",
  "how to",
  "guide",
  "tips",
  "attract patients",
  "increase patients",
  "grow a pharmacy",
  "grow your pharmacy",
  "promote",
  "promotion",
  "leaflet",
  "leaflets",
  "letter",
  "letters",
  "promotional materials",
  "patient engagement",
  "digital transformation",
];

const authoritySignals = [
  "statistics",
  "market",
  "trends",
  "benchmark",
  "examples",
  "best practice",
  "case study",
  "case studies",
  "customer behaviour",
  "online services",
  "technology trends",
  "digital trends",
  "patient engagement",
  "digital transformation",
];

const patientServiceSignals = [
  "flu jab",
  "flu jabs",
  "flu vaccine",
  "flu vaccination",
  "vaccination",
  "ear wax",
  "blood pressure",
  "travel vaccination",
  "weight loss",
  "prescription",
  "repeat prescription",
  "medicine",
  "medicines",
  "ozempic",
  "pharmacy4u",
  "online pharmacies",
  "treatment",
  "symptoms",
  "cost of",
  "how much",
  "cheapest",
];

const navigationSignals = [
  "login",
  "log in",
  "portal",
  "sign in",
  "numark login",
  "pharma focus",
  "pharmafocus",
  "pharmaplace",
];

const localSignals = [
  "near me",
  "chatham pharmacy",
  "clock pharmacy",
  "quays pharmacy",
  "asda pharmacy",
  "abbeyfield pharmacy",
  "colchester",
  "chemist near me",
  "pharmacy near me",
];

const operationsIrrelevantSignals = [
  "inventory management",
  "pharmacovigilance",
  "service provider",
  "chain pharmacy",
  "pharmacy seekers",
  "media pharmacy",
];

function includesAny(text: string, terms: string[]): string[] {
  const padded = ` ${text} `;
  return terms.filter((term) => padded.includes(term));
}

function hasForMarketPattern(text: string): boolean {
  return /(?:seo|marketing|advertising|ads|web(?:site)? design|digital marketing|website(?:s)?|branding|growth|visibility)\s+for\s+(?:pharma|pharmac(?:y|ies)|pharmacists?)/i.test(text) ||
    /(?:pharma|pharmac(?:y|ies)|pharmacists?)\s+(?:seo|marketing|advertising|ads|web(?:site)? design|digital marketing|website(?:s)?|branding|growth|visibility)/i.test(text);
}

export function classifyCommercialIntentV2(rawKeyword: string): CommercialIntentV2Result {
  const keyword = String(rawKeyword || "").trim();
  const lower = keyword.toLowerCase().replace(/\s+/g, " ");
  const market = includesAny(lower, marketSignals);
  const commercial = includesAny(lower, moneyServiceSignals);
  const support = includesAny(lower, commercialSupportSignals);
  const authority = includesAny(lower, authoritySignals);
  const patient = includesAny(lower, patientServiceSignals);
  const nav = includesAny(lower, navigationSignals);
  const local = includesAny(lower, localSignals);
  const operationsIrrelevant = includesAny(lower, operationsIrrelevantSignals);
  const wordOrderCommercial = hasForMarketPattern(lower);
  const hasCoreMarket = /pharmac(?:y|ies|ists?)/i.test(lower);
  const hasBroaderPharma = /\bpharma(?:ceutical)?\b/i.test(lower) && !hasCoreMarket;
  const marketScope: CommercialIntentV2Result["marketScope"] =
    hasCoreMarket ? "CORE" :
    hasBroaderPharma && (commercial.length || wordOrderCommercial) ? "BROAD" :
    hasBroaderPharma ? "ADJACENT" :
    "NONE";

  const reasons: string[] = [];
  if (market.length) reasons.push(`Market signal: ${market.join(", ")}`);
  if (commercial.length) reasons.push(`Commercial service signal: ${commercial.join(", ")}`);
  if (wordOrderCommercial) reasons.push("Commercial word-order pattern matched.");
  if (support.length) reasons.push(`Commercial support signal: ${support.join(", ")}`);
  if (authority.length) reasons.push(`Authority signal: ${authority.join(", ")}`);
  if (patient.length) reasons.push(`Patient-service negative signal: ${patient.join(", ")}`);
  if (nav.length) reasons.push(`Navigational negative signal: ${nav.join(", ")}`);
  if (local.length) reasons.push(`Local-pharmacy negative signal: ${local.join(", ")}`);
  if (operationsIrrelevant.length) reasons.push(`Industry-irrelevant signal: ${operationsIrrelevant.join(", ")}`);
  if (marketScope !== "NONE") reasons.push(`Market scope: ${marketScope}`);

  let type: CommercialIntentV2Type = "INDUSTRY_IRRELEVANT";
  if (nav.length) type = "NAVIGATIONAL";
  else if (patient.length && !wordOrderCommercial) type = "PATIENT_SERVICE";
  else if (local.length && !commercial.length) type = "LOCAL_PHARMACY";
  else if (operationsIrrelevant.length && !wordOrderCommercial) type = "INDUSTRY_IRRELEVANT";
  else if (market.length && (commercial.length || wordOrderCommercial)) type = "MONEY_KEYWORD";
  else if (market.length && support.length) type = "COMMERCIAL_SUPPORT";
  else if (market.length && authority.length) type = "AUTHORITY_SUPPORT";
  else if (market.length) type = "AMBIGUOUS_REVIEW";

  let score = 0;
  if (market.length) score += 25;
  if (commercial.length) score += 40;
  if (wordOrderCommercial) score += 25;
  if (support.length) score += 15;
  if (authority.length) score += 8;
  if (patient.length) score -= 60;
  if (nav.length) score -= 70;
  if (local.length && !commercial.length) score -= 50;
  if (operationsIrrelevant.length && !wordOrderCommercial) score -= 45;
  if (marketScope === "BROAD") score -= 12;
  if (marketScope === "ADJACENT") score -= 6;
  score = Math.max(0, Math.min(100, score));

  return {
    keyword,
    type,
    marketScope,
    commercialIntentScore: score,
    reasons,
    matchedMarketSignals: market,
    matchedCommercialSignals: commercial,
    matchedNegativeSignals: [...patient, ...nav, ...local],
  };
}

export function scoreCommercialOpportunityV2(input: {
  keyword: string;
  searchVolume?: number | null;
  cpc?: number | null;
  paidCompetition?: number | null;
  directCompetitorsRanking?: number;
  bestCompetitorPosition?: number | null;
  hasDomainGapEvidence?: boolean;
}): { type: CommercialIntentV2Type; marketScope: CommercialIntentV2Result["marketScope"]; score: number; reasons: string[] } {
  const intent = classifyCommercialIntentV2(input.keyword);
  let score = intent.commercialIntentScore * 0.45;
  const volume = input.searchVolume || 0;
  const cpc = input.cpc || 0;
  const direct = input.directCompetitorsRanking || 0;
  const best = input.bestCompetitorPosition || 999;
  score += Math.min(20, volume / 10);
  score += Math.min(10, cpc / 3);
  score += Math.min(20, direct * 5);
  if (best <= 3) score += 12;
  else if (best <= 10) score += 8;
  else if (best <= 20) score += 4;
  if (input.hasDomainGapEvidence) score += 15;
  if (intent.type !== "MONEY_KEYWORD" && intent.type !== "COMMERCIAL_SUPPORT") {
    score = Math.min(score, 40);
  }
  return {
    type: intent.type,
    marketScope: intent.marketScope,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: intent.reasons,
  };
}
