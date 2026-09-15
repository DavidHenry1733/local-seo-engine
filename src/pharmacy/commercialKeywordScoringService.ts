import type {
  CommercialKeywordTaxonomy,
  RankedKeywordEvidence,
  DomainCommercialKeywordScore,
} from "./commercialKeywordIntelligenceModel.ts";

import type {
  DataForSeoRankedKeyword,
} from "./dataForSeoRankedKeywordIntelligenceService.ts";

function matches(text:string,terms:string[]):string[]{
  const lower=` ${text.toLowerCase()} `;

  return terms.filter(term=>
    lower.includes(term.toLowerCase())
  );
}

function allNegativeTerms(
  taxonomy:CommercialKeywordTaxonomy
):string[]{
  return Object.values(taxonomy.negativeIntentGroups).flat();
}

export function scoreRankedKeyword(
  item:DataForSeoRankedKeyword,
  taxonomy:CommercialKeywordTaxonomy,
):RankedKeywordEvidence {

  const keyword=item.keyword.toLowerCase();

  const marketMatches=
    matches(keyword,taxonomy.targetMarketTerms);

  const serviceMatches=
    matches(keyword,taxonomy.serviceTerms);

  const highIntentMatches=
    matches(keyword,taxonomy.highIntentTerms);

  const negativeMatches=
    matches(keyword,allNegativeTerms(taxonomy));

  let positiveScore=0;
  let negativeScore=0;

  if(marketMatches.length) positiveScore+=20;
  if(serviceMatches.length) positiveScore+=25;
  if(highIntentMatches.length) positiveScore+=45;

  // Market + service in the SAME ranking keyword is the strongest
  // generic commercial-overlap signal.
  if(marketMatches.length && serviceMatches.length){
    positiveScore+=35;
  }

  const position=item.position || 999;

  if(
    (highIntentMatches.length ||
      (marketMatches.length && serviceMatches.length)) &&
    position <= 10
  ){
    positiveScore+=15;
  }else if(
    (highIntentMatches.length ||
      (marketMatches.length && serviceMatches.length)) &&
    position <= 20
  ){
    positiveScore+=8;
  }

  if(negativeMatches.length){
    negativeScore+=35;
  }

  // Negative intent must not automatically erase a strong
  // explicit commercial market+service keyword.
  if(
    negativeMatches.length &&
    !highIntentMatches.length &&
    !(marketMatches.length && serviceMatches.length)
  ){
    negativeScore+=25;
  }

  let classification:
    RankedKeywordEvidence["classification"]="irrelevant";

  if(
    negativeScore >= 35 &&
    positiveScore < 45
  ){
    classification="negative_intent";
  }
  else if(
    highIntentMatches.length ||
    (marketMatches.length && serviceMatches.length)
  ){
    classification="high_commercial_relevance";
  }
  else if(
    serviceMatches.length &&
    marketMatches.length
  ){
    classification="commercial_relevance";
  }
  else if(marketMatches.length){
    classification="industry_only";
  }

  return {
    ...item,
    marketMatches,
    serviceMatches,
    highIntentMatches,
    negativeMatches,
    positiveScore,
    negativeScore,
    classification,
  };
}

export function scoreDomainCommercialKeywords(
  domain:string,
  ranked:DataForSeoRankedKeyword[],
  taxonomy:CommercialKeywordTaxonomy,
  websiteCommercialEvidence:boolean,
):DomainCommercialKeywordScore {

  const scored=ranked.map(item=>
    scoreRankedKeyword(item,taxonomy)
  );

  const relevant=scored.filter(x=>
    x.classification==="high_commercial_relevance" ||
    x.classification==="commercial_relevance"
  );

  const high=scored.filter(x=>
    x.classification==="high_commercial_relevance"
  );

  const negative=scored.filter(x=>
    x.classification==="negative_intent"
  );

  const relevantSearchVolume=relevant.reduce(
    (sum,x)=>sum+(x.searchVolume || 0),
    0
  );

  const top10=relevant.filter(
    x=>(x.position || 999)<=10
  ).length;

  const top20=relevant.filter(
    x=>(x.position || 999)<=20
  ).length;

  const marketEvidenceScore=Math.min(
    25,
    scored.filter(x=>x.marketMatches.length).length * 2
  );

  const serviceEvidenceScore=Math.min(
    25,
    scored.filter(x=>x.serviceMatches.length).length * 3
  );

  const commercialIntentScore=Math.min(
    35,
    high.length * 7
  );

  const negativeIntentScore=Math.min(
    40,
    negative.length * 4
  );

  let confidence=
    marketEvidenceScore +
    serviceEvidenceScore +
    commercialIntentScore +
    (websiteCommercialEvidence ? 15 : 0) -
    negativeIntentScore;

  confidence=Math.max(0,Math.min(100,confidence));

  let classification:
    DomainCommercialKeywordScore["classification"] =
      "insufficient_evidence";

  const reasons:string[]=[];

  if(high.length){
    reasons.push(
      `${high.length} high-commercial-relevance ranking keywords detected.`
    );
  }

  if(relevant.length){
    reasons.push(
      `${relevant.length} commercially relevant ranking keywords detected.`
    );
  }

  if(top10){
    reasons.push(
      `${top10} relevant keywords rank in the top 10.`
    );
  }

  if(relevantSearchVolume){
    reasons.push(
      `Relevant keyword search-volume footprint: ${relevantSearchVolume}.`
    );
  }

  if(websiteCommercialEvidence){
    reasons.push(
      "Own-site evidence supports a commercial pharmacy-sector proposition."
    );
  }

  if(negative.length){
    reasons.push(
      `${negative.length} negative-intent ranking keywords detected.`
    );
  }

  if(
    websiteCommercialEvidence &&
    high.length >= 1 &&
    confidence >= 55
  ){
    classification="direct_competitor";
  }
  else if(
    high.length >= 2 &&
    confidence >= 60
  ){
    classification="direct_competitor";
  }
  else if(
    relevant.length >= 1 &&
    confidence >= 35
  ){
    classification="adjacent_competitor";
  }
  else if(
    ranked.length >= 20 &&
    relevant.length === 0
  ){
    classification="not_competitor";
  }

  const strongest=[...relevant]
    .sort((a,b)=>
      (b.positiveScore-a.positiveScore) ||
      ((b.searchVolume || 0)-(a.searchVolume || 0))
    )
    .slice(0,20);

  const negatives=[...negative]
    .sort((a,b)=>
      (b.negativeScore-a.negativeScore) ||
      ((b.searchVolume || 0)-(a.searchVolume || 0))
    )
    .slice(0,20);

  return {
    domain,
    rankedKeywordsAnalysed:ranked.length,
    relevantKeywords:relevant.length,
    highCommercialKeywords:high.length,
    negativeIntentKeywords:negative.length,
    relevantSearchVolume,
    top10RelevantKeywords:top10,
    top20RelevantKeywords:top20,
    marketEvidenceScore,
    serviceEvidenceScore,
    commercialIntentScore,
    negativeIntentScore,
    confidenceScore:confidence,
    classification,
    reasons,
    strongestKeywords:strongest,
    negativeKeywords:negatives,
  };
}
