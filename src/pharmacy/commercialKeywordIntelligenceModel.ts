/**
 * Shared Growth Platform Commercial Keyword Intelligence.
 *
 * The model is intentionally business-type agnostic.
 * PharmaConnect is the first production tenant.
 */

export type CommercialKeywordTaxonomy = {
  version: number;
  market: string;
  country: string;
  languageCode: string;

  targetMarketTerms: string[];
  serviceTerms: string[];
  highIntentTerms: string[];

  negativeIntentGroups: Record<string,string[]>;

  generatedCombinations: string[];
};

export type RankedKeywordEvidence = {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  url: string | null;

  marketMatches: string[];
  serviceMatches: string[];
  highIntentMatches: string[];
  negativeMatches: string[];

  positiveScore: number;
  negativeScore: number;

  classification:
    | "high_commercial_relevance"
    | "commercial_relevance"
    | "industry_only"
    | "negative_intent"
    | "irrelevant";
};

export type DomainCommercialKeywordScore = {
  domain: string;

  rankedKeywordsAnalysed: number;
  relevantKeywords: number;
  highCommercialKeywords: number;
  negativeIntentKeywords: number;

  relevantSearchVolume: number;
  top10RelevantKeywords: number;
  top20RelevantKeywords: number;

  marketEvidenceScore: number;
  serviceEvidenceScore: number;
  commercialIntentScore: number;
  negativeIntentScore: number;

  confidenceScore: number;

  classification:
    | "direct_competitor"
    | "adjacent_competitor"
    | "not_competitor"
    | "insufficient_evidence";

  reasons: string[];

  strongestKeywords: RankedKeywordEvidence[];
  negativeKeywords: RankedKeywordEvidence[];
};

function uniq(values:string[]):string[] {
  return [...new Set(
    values
      .map(v=>String(v || "").trim().toLowerCase())
      .filter(Boolean)
  )];
}

export function buildCommercialKeywordTaxonomy(input:{
  market:string;
  country:string;
  languageCode:string;
  targetMarketTerms:string[];
  serviceTerms:string[];
  highIntentTerms?:string[];
  negativeIntentGroups?:Record<string,string[]>;
}):CommercialKeywordTaxonomy {

  const targetMarketTerms=uniq(input.targetMarketTerms);
  const serviceTerms=uniq(input.serviceTerms);
  const highIntentTerms=uniq(input.highIntentTerms || []);

  const generatedCombinations:string[]=[];

  for(const market of targetMarketTerms){
    for(const service of serviceTerms){
      generatedCombinations.push(`${market} ${service}`);
      generatedCombinations.push(`${service} ${market}`);
    }
  }

  return {
    version:1,
    market:input.market,
    country:input.country,
    languageCode:input.languageCode,
    targetMarketTerms,
    serviceTerms,
    highIntentTerms,
    negativeIntentGroups:input.negativeIntentGroups || {},
    generatedCombinations:uniq(generatedCombinations),
  };
}
