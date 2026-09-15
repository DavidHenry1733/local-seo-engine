import fs from "node:fs";
import { resolveNationalIntelligenceSubject } from "./nationalIntelligenceSubjectResolver.ts";
import {
  ensureNationalIntelligenceDataDir,
  nationalIntelligenceDataPath,
  resolveNationalIntelligenceArtifactPath,
} from "./nationalIntelligenceStorageService.ts";

function readJson(path:string){
  return JSON.parse(fs.readFileSync(path,"utf8"));
}

function domainKey(value:any){
  return String(value?.domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//,"")
    .replace(/^www\./,"")
    .split("/")[0];
}

function uniqueByDomain(items:any[]){
  const map=new Map<string,any>();

  for(const item of items){
    const key=domainKey(item);

    if(!key) continue;

    if(!map.has(key)){
      map.set(key,item);
    }else{
      map.set(key,{
        ...map.get(key),
        ...item,
      });
    }
  }

  return [...map.values()];
}

export function buildVerifiedNationalCompetitorIntelligence(slug: string){
  const subject = resolveNationalIntelligenceSubject(slug);
  const enrichmentFile = resolveNationalIntelligenceArtifactPath(slug, "competitor-evidence-enrichment-v1");
  const keywordFile = resolveNationalIntelligenceArtifactPath(slug, "commercial-keyword-qualification-v1");
  if (!enrichmentFile) throw new Error(`Competitor evidence enrichment snapshot not found for ${slug}`);
  if (!keywordFile) throw new Error(`Commercial keyword qualification snapshot not found for ${slug}`);

  const enrichment=readJson(enrichmentFile);
  const keyword=readJson(keywordFile);

  const ownSiteDirect=
    enrichment.directCompetitors || [];

  const ownSiteAdjacent=
    enrichment.adjacentCompetitors || [];

  const keywordDirect=
    keyword.directCompetitors || [];

  const keywordAdjacent=
    keyword.adjacentCompetitors || [];

  const direct=uniqueByDomain([
    ...ownSiteDirect.map((x:any)=>({
      ...x,
      domain:domainKey(x),
      evidenceBasis:"own_site",
      verified:true,
      classification:"direct_competitor",
      confidenceScore:
        x.confidenceScore ??
        x.score ??
        null,
      strongestKeywords:
        x.strongestKeywords || [],
    })),

    ...keywordDirect.map((x:any)=>({
      ...x,
      domain:domainKey(x),
      evidenceBasis:
        x.websiteCommercialEvidence ?
        "own_site_and_ranked_keywords" :
        "ranked_keywords",
      verified:true,
      classification:"direct_competitor",
    })),
  ]);

  const directDomains=
    new Set(direct.map(domainKey));

  const adjacent=uniqueByDomain([
    ...ownSiteAdjacent,
    ...keywordAdjacent,
  ])
    .filter((x:any)=>!directDomains.has(domainKey(x)))
    .map((x:any)=>({
      ...x,
      domain:domainKey(x),
      classification:"adjacent_competitor",
      verified:true,
      confidenceScore:
        x.confidenceScore ??
        x.score ??
        null,
    }));

  const rejected=
    (keyword.rejectedCandidates || []).map((x:any)=>({
      ...x,
      domain:domainKey(x),
      classification:"not_competitor",
    }));

  const insufficient=
    (keyword.insufficientEvidence || []).map((x:any)=>({
      ...x,
      domain:domainKey(x),
      classification:"insufficient_evidence",
    }));

  const totalRelevantSearchVolume=
    direct.reduce(
      (sum:number,x:any)=>
        sum + Number(x.relevantSearchVolume || 0),
      0
    );

  const totalRelevantKeywords=
    direct.reduce(
      (sum:number,x:any)=>
        sum + Number(x.relevantKeywords || 0),
      0
    );

  const totalHighCommercialKeywords=
    direct.reduce(
      (sum:number,x:any)=>
        sum + Number(x.highCommercialKeywords || 0),
      0
    );

  const output={
    version:1,

    generatedAt:new Date().toISOString(),

    tenant: subject.slug,

    platformScope:"national",

    market:"UK Community Pharmacy Digital Growth",

    status:"complete",

    evidenceSources:[
      "Own-site commercial evidence",
      "DataForSEO Labs Google Ranked Keywords — United Kingdom",
    ],

    directCompetitorCount:direct.length,
    adjacentCompetitorCount:adjacent.length,
    rejectedCount:rejected.length,
    insufficientEvidenceCount:insufficient.length,

    totalRelevantKeywords,
    totalHighCommercialKeywords,
    totalRelevantSearchVolume,

    directCompetitors:direct,
    adjacentCompetitors:adjacent,
    rejectedCandidates:rejected,
    insufficientEvidence:insufficient,

    governance:{
      discoveryRun:false,
      localDiscoveryRun:false,
      dashboardPromotion:true,
      nc04Implemented:false,
    },
  };

  ensureNationalIntelligenceDataDir();
  const file = nationalIntelligenceDataPath(slug, "verified-national-competitors");
  fs.writeFileSync(
    file,
    JSON.stringify(output,null,2)+"\n"
  );

  return output;
}

export function readVerifiedNationalCompetitorIntelligence(slug: string){
  const file = resolveNationalIntelligenceArtifactPath(slug, "verified-national-competitors");
  if(!file){
    return null;
  }

  return readJson(file);
}
