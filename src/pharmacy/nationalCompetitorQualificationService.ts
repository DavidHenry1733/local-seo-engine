/**
 * NC-02 — National Competitor Qualification Service V1
 *
 * Determines whether a discovered website is a genuine NATIONAL commercial
 * competitor.
 *
 * Qualification is based on:
 * - customer-market overlap
 * - service overlap
 * - commercial relevance
 *
 * It is NOT based on physical distance.
 */

export interface NationalCompetitorQualificationInput {
  candidateName: string;
  domain: string;
  websiteText: string;
  targetCustomerMarket: string;
  targetServices: string[];
  ownDomains?: string[];
}

export interface NationalCompetitorQualificationResult {
  qualification: "qualified" | "candidate" | "rejected";
  score: number;
  qualificationReasons: string[];
  rejectionReasons: string[];
  matchedServices: string[];
}

function normalise(value: unknown): string {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normaliseDomain(value: string): string {
  return normalise(value)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function serviceTokens(service: string): string[] {
  const s = normalise(service);

  const tokens = new Set<string>();

  if (/website|web design/.test(s)) {
    tokens.add("website");
    tokens.add("web design");
  }

  if (/seo|search engine/.test(s)) {
    tokens.add("seo");
    tokens.add("search engine optimisation");
    tokens.add("search engine optimization");
  }

  if (/email/.test(s)) {
    tokens.add("email marketing");
    tokens.add("email");
  }

  if (/hosting/.test(s)) {
    tokens.add("hosting");
    tokens.add("web hosting");
  }

  if (/growth|audit/.test(s)) {
    tokens.add("growth");
    tokens.add("audit");
    tokens.add("digital marketing");
  }

  tokens.add(s);

  return [...tokens].filter(Boolean);
}

export function qualifyNationalCompetitor(
  input: NationalCompetitorQualificationInput,
): NationalCompetitorQualificationResult {
  const text = normalise(input.websiteText);
  const domain = normaliseDomain(input.domain);

  const ownDomains = (input.ownDomains || []).map(normaliseDomain);

  const qualificationReasons: string[] = [];
  const rejectionReasons: string[] = [];
  const matchedServices: string[] = [];

  if (!domain) {
    rejectionReasons.push("No usable competitor domain.");
  }

  if (ownDomains.includes(domain)) {
    rejectionReasons.push("Candidate is the platform owner's own domain.");
  }

  const pharmacyMarketEvidence =
    /\bpharmac(y|ies|ist|ists|eutical)\b/.test(text);

  if (pharmacyMarketEvidence) {
    qualificationReasons.push(
      "Website contains explicit pharmacy-sector customer-market evidence.",
    );
  }

  for (const service of input.targetServices || []) {
    const tokens = serviceTokens(service);
    if (tokens.some((token) => text.includes(token))) {
      matchedServices.push(service);
    }
  }

  if (matchedServices.length) {
    qualificationReasons.push(
      `Commercial service overlap detected: ${matchedServices.join(", ")}.`,
    );
  }

  let score = 0;

  if (pharmacyMarketEvidence) score += 50;

  score += Math.min(40, matchedServices.length * 10);

  if (
    /\b(agency|marketing|digital|website|seo|hosting|communications?|growth)\b/.test(
      text,
    )
  ) {
    score += 10;
    qualificationReasons.push(
      "Website contains commercial digital-service evidence.",
    );
  }

  if (rejectionReasons.length) {
    return {
      qualification: "rejected",
      score: 0,
      qualificationReasons,
      rejectionReasons,
      matchedServices,
    };
  }

  if (score >= 60 && pharmacyMarketEvidence && matchedServices.length > 0) {
    return {
      qualification: "qualified",
      score,
      qualificationReasons,
      rejectionReasons,
      matchedServices,
    };
  }

  if (score >= 30) {
    return {
      qualification: "candidate",
      score,
      qualificationReasons,
      rejectionReasons,
      matchedServices,
    };
  }

  rejectionReasons.push(
    "Insufficient evidence of pharmacy customer-market and service overlap.",
  );

  return {
    qualification: "rejected",
    score,
    qualificationReasons,
    rejectionReasons,
    matchedServices,
  };
}
