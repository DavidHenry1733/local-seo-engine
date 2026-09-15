/**
 * NC-03E — National Competitor Evidence Enrichment V1
 *
 * This is NOT NC-04 website intelligence.
 *
 * It performs narrowly-scoped evidence acquisition from candidate
 * websites so that National Competitor Qualification can distinguish
 * real competitors from search-result false positives.
 *
 * It must not:
 * - run DataForSEO discovery
 * - run Google Places
 * - use proximity/local-market logic
 * - perform SEO/ranking analysis
 */

import { qualifyNationalCompetitorV2 } from "./nationalCompetitorQualificationV2Service.ts";

export type EnrichmentClassification =
  | "direct_competitor"
  | "adjacent_competitor"
  | "not_competitor"
  | "manual_review"
  | "unreachable";

export type CandidateForEnrichment = {
  domain: string;
  name?: string;
  score?: number;
  classification?: string;
  reasons?: string[];
};

export type EvidencePage = {
  url: string;
  status: number | null;
  title: string | null;
  textSample: string | null;
};

export type EnrichedCompetitorEvidence = {
  domain: string;
  name: string;
  fetchedAt: string;
  reachable: boolean;
  pagesChecked: EvidencePage[];
  pharmacyMarketEvidence: string[];
  commercialProviderEvidence: string[];
  serviceEvidence: string[];
  ukMarketEvidence: string[];
  detectedServiceGroups: string[];
  evidenceUrls: string[];
  classification: EnrichmentClassification;
  score: number;
  qualificationReasons: string[];
  exclusionReasons: string[];
  rationale: string;
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; PharmaConnectGrowthEngine/1.0; competitor-evidence-review)";

const SERVICE_GROUPS: Record<string,string[]> = {
  website: [
    "website design",
    "web design",
    "website development",
    "pharmacy website",
    "pharmacy websites",
    "website hosting",
    "web hosting",
  ],
  seo: [
    "seo",
    "search engine optimisation",
    "search engine optimization",
    "local seo",
    "google business profile",
    "local search",
  ],
  marketing: [
    "digital marketing",
    "pharmacy marketing",
    "marketing agency",
    "online marketing",
    "digital growth",
  ],
  email: [
    "email marketing",
    "email campaigns",
    "email automation",
    "patient email",
  ],
  growth: [
    "growth audit",
    "marketing audit",
    "digital audit",
    "growth strategy",
    "digital strategy",
    "marketing strategy",
  ],
};

const PHARMACY_SIGNALS = [
  "community pharmacy",
  "community pharmacies",
  "independent pharmacy",
  "independent pharmacies",
  "pharmacy owner",
  "pharmacy owners",
  "pharmacy business",
  "pharmacy businesses",
  "pharmacy group",
  "pharmacy groups",
  "pharmacies",
  "pharmacists",
];

const COMMERCIAL_SIGNALS = [
  "our services",
  "we provide",
  "we offer",
  "we help",
  "work with pharmacies",
  "working with pharmacies",
  "for pharmacies",
  "our clients",
  "our customers",
  "book a call",
  "request a quote",
  "contact us",
  "get started",
  "agency",
  "specialist",
  "specialists",
];

const ADJACENT_SIGNALS = [
  "pharmacy software",
  "pharmacy platform",
  "patient app",
  "prescription app",
  "pharmacy system",
  "pmr",
  "patient relationship management",
  "digital pharmacy platform",
];

const NON_COMPETITOR_SIGNALS = [
  "news",
  "journal",
  "regulator",
  "regulation",
  "guidance",
  "research",
  "directory",
  "accountants",
  "accountancy",
  "email database",
  "email addresses",
  "mailing list",
];

function decodeHtmlEntities(value: string): string {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function cleanHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html: string): string | null {
  const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? cleanHtml(m[1]).slice(0,300) : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function snippetsFor(text: string, signals: string[]): string[] {
  const lower=text.toLowerCase();
  const found:string[]=[];

  for (const signal of signals) {
    const idx=lower.indexOf(signal);
    if (idx < 0) continue;

    const start=Math.max(0,idx-100);
    const end=Math.min(text.length,idx+signal.length+160);
    found.push(text.slice(start,end).trim());

    if (found.length >= 6) break;
  }

  return unique(found);
}

async function fetchPage(url: string): Promise<EvidencePage> {
  try {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);

    const response=await fetch(url,{
      signal:controller.signal,
      redirect:"follow",
      headers:{
        "user-agent":USER_AGENT,
        "accept":"text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timer);

    const contentType=response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return {
        url:response.url || url,
        status:response.status,
        title:null,
        textSample:null,
      };
    }

    const html=(await response.text()).slice(0,1500000);
    const text=cleanHtml(html).slice(0,100000);

    return {
      url:response.url || url,
      status:response.status,
      title:titleFromHtml(html),
      textSample:text,
    };
  } catch {
    return {
      url,
      status:null,
      title:null,
      textSample:null,
    };
  }
}

/** Reuse the existing 12s / 1.5MB HTML-only fetch for editorial evidence. */
export async function fetchSafeHtmlEvidencePage(url: string): Promise<EvidencePage> {
  return fetchPage(url);
}

export function stripHtmlToPlainTextSample(html: string, maxChars = 100000): string {
  return cleanHtml(html).slice(0, maxChars);
}

async function fetchCandidatePages(domain: string): Promise<EvidencePage[]> {
  const base=`https://${domain}`;

  const paths=[
    "",
    "/services/",
    "/pharmacy/",
    "/pharmacies/",
    "/about/",
  ];

  const pages:EvidencePage[]=[];

  for (const path of paths) {
    const page=await fetchPage(`${base}${path}`);
    pages.push(page);

    if (pages.filter(p=>p.status && p.status < 400).length >= 3) break;
  }

  if (!pages.some(p=>p.status && p.status < 400)) {
    const fallback=await fetchPage(`http://${domain}`);
    pages.push(fallback);
  }

  return pages;
}

export async function enrichNationalCompetitorEvidence(
  candidate: CandidateForEnrichment,
): Promise<EnrichedCompetitorEvidence> {

  const domain=String(candidate.domain || "")
    .toLowerCase()
    .replace(/^https?:\/\//,"")
    .replace(/^www\./,"")
    .split("/")[0];

  const pages=await fetchCandidatePages(domain);

  const reachable=pages.some(
    p=>p.status !== null && p.status >= 200 && p.status < 400 && p.textSample,
  );

  if (!reachable) {
    return {
      domain,
      name:candidate.name || domain,
      fetchedAt:new Date().toISOString(),
      reachable:false,
      pagesChecked:pages,
      pharmacyMarketEvidence:[],
      commercialProviderEvidence:[],
      serviceEvidence:[],
      ukMarketEvidence:[],
      detectedServiceGroups:[],
      evidenceUrls:[],
      classification:"unreachable",
      score:candidate.score || 0,
      qualificationReasons:[],
      exclusionReasons:[],
      rationale:"Candidate website could not be reached sufficiently to establish commercial competitor evidence.",
    };
  }

  const usable=pages.filter(p=>p.textSample);
  const combined=usable.map(p=>`${p.title || ""} ${p.textSample || ""}`).join(" ");
  const lower=combined.toLowerCase();

  const pharmacyEvidence=snippetsFor(combined,PHARMACY_SIGNALS);
  const commercialEvidence=snippetsFor(combined,COMMERCIAL_SIGNALS);

  const detectedGroups=Object.entries(SERVICE_GROUPS)
    .filter(([,signals])=>signals.some(s=>lower.includes(s)))
    .map(([group])=>group);

  const serviceSignals=Object.values(SERVICE_GROUPS).flat();
  const serviceEvidence=snippetsFor(combined,serviceSignals);

  const ukSignals=[
    "united kingdom",
    " uk ",
    "uk-based",
    "uk based",
    "england",
    "scotland",
    "wales",
    "northern ireland",
  ];

  const ukEvidence=snippetsFor(` ${combined} `,ukSignals);

  if (domain.endsWith(".co.uk")) {
    ukEvidence.unshift(`UK domain evidence: ${domain}`);
  }

  const qualification=qualifyNationalCompetitorV2({
    domain,
    title:usable.map(p=>p.title || "").join(" "),
    websiteText:combined,
    servicesDetected:detectedGroups,
  });

  const adjacentEvidence=ADJACENT_SIGNALS.some(s=>lower.includes(s));
  const nonCompetitorEvidence=NON_COMPETITOR_SIGNALS.some(s=>lower.includes(s));

  const pharmacyMarket=pharmacyEvidence.length > 0;
  const commercialProvider=commercialEvidence.length > 0;
  const serviceOverlap=detectedGroups.length > 0;
  const ukMarket=ukEvidence.length > 0;

  let classification:EnrichmentClassification="manual_review";
  let rationale="Evidence is mixed and requires review.";

  if (
    qualification.qualified &&
    pharmacyMarket &&
    commercialProvider &&
    serviceOverlap &&
    ukMarket
  ) {
    classification="direct_competitor";
    rationale=
      `Own-site evidence confirms pharmacy-sector targeting, commercial service provision, UK market evidence and overlapping digital services (${detectedGroups.join(", ")}).`;
  } else if (
    pharmacyMarket &&
    commercialProvider &&
    adjacentEvidence &&
    !qualification.qualified
  ) {
    classification="adjacent_competitor";
    rationale=
      "Own-site evidence shows a commercial pharmacy technology/platform proposition, but insufficient evidence of direct PharmaConnect-style digital growth service competition.";
  } else if (
    nonCompetitorEvidence &&
    (!commercialProvider || !serviceOverlap)
  ) {
    classification="not_competitor";
    rationale=
      "Own-site evidence does not establish a competing pharmacy digital-growth service proposition.";
  } else if (
    !pharmacyMarket ||
    !commercialProvider ||
    !serviceOverlap
  ) {
    classification="not_competitor";
    rationale=
      "Own-site evidence fails one or more required direct-competitor gates: pharmacy customer market, commercial service provision, or overlapping digital services.";
  }

  return {
    domain,
    name:candidate.name || domain,
    fetchedAt:new Date().toISOString(),
    reachable:true,
    pagesChecked:pages.map(p=>({
      ...p,
      textSample:p.textSample ? p.textSample.slice(0,2500) : null,
    })),
    pharmacyMarketEvidence:pharmacyEvidence,
    commercialProviderEvidence:commercialEvidence,
    serviceEvidence,
    ukMarketEvidence:ukEvidence,
    detectedServiceGroups:detectedGroups,
    evidenceUrls:unique(
      usable
        .filter(p=>p.status && p.status < 400)
        .map(p=>p.url),
    ),
    classification,
    score:qualification.score,
    qualificationReasons:qualification.reasons,
    exclusionReasons:qualification.exclusionReasons,
    rationale,
  };
}
