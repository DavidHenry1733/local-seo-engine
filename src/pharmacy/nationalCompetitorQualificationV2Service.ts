/**
 * NC-03D — National Competitor Qualification V2
 *
 * Purpose:
 * Determine whether a discovered organisation is a genuine commercial
 * competitor to PharmaConnect in the UK community-pharmacy digital
 * growth market.
 *
 * IMPORTANT:
 * Search relevance alone is NOT competitor evidence.
 *
 * A page mentioning pharmacy + SEO/websites/email/audit does not make
 * the underlying organisation a competitor.
 */

export type NationalCompetitorQualificationV2Input = {
  domain: string;
  title?: string | null;
  snippet?: string | null;
  url?: string | null;
  websiteText?: string | null;
  servicesDetected?: string[];
  matchedQueries?: string[];
  ownDomains?: string[];
};

export type NationalCompetitorQualificationV2Result = {
  qualified: boolean;
  score: number;
  classification:
    | "direct_competitor"
    | "adjacent_competitor"
    | "insufficient_evidence"
    | "excluded";
  reasons: string[];
  exclusionReasons: string[];
  evidence: {
    pharmacyMarket: boolean;
    commercialProvider: boolean;
    digitalService: boolean;
    ukMarket: boolean;
    multiServiceOverlap: boolean;
  };
};

const DIRECT_EXCLUDED_DOMAINS = new Set([
  "reddit.com",
  "dribbble.com",
  "pharmaceutical-journal.com",
  "qualitysafety.bmj.com",
  "bmj.com",
  "pharmacyregulation.org",
  "cpe.org.uk",
  "cpsc.org.uk",
  "communitypharmacy.org.uk",
]);

const EXCLUDED_DOMAIN_PATTERNS = [
  /(^|\.)reddit\.com$/i,
  /(^|\.)dribbble\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)wikipedia\.org$/i,
  /(^|\.)gov\.uk$/i,
  /(^|\.)nhs\.uk$/i,
  /(^|\.)bmj\.com$/i,
];

const EXCLUDED_ORGANISATION_SIGNALS = [
  "regulator",
  "regulation",
  "professional journal",
  "journal",
  "research paper",
  "academic",
  "guidance",
  "committee",
  "government",
  "nhs",
  "community pharmacy england",
  "local pharmaceutical committee",
  "association",
  "directory",
  "best agencies",
  "top agencies",
  "email address list",
  "email addresses",
  "mailing list",
  "database",
  "accountants",
  "accountancy",
];

const PHARMACY_MARKET_SIGNALS = [
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
  "pharmacy",
  "pharmacist",
  "pharmacists",
];

const COMMERCIAL_PROVIDER_SIGNALS = [
  "we provide",
  "we offer",
  "our services",
  "our clients",
  "our customers",
  "work with pharmacies",
  "working with pharmacies",
  "help pharmacies",
  "for pharmacies",
  "pharmacy clients",
  "book a call",
  "contact us",
  "get started",
  "request a quote",
  "free consultation",
  "agency",
  "specialists",
  "specialist",
];

const DIGITAL_SERVICE_GROUPS: Array<{
  name: string;
  signals: string[];
}> = [
  {
    name: "website",
    signals: [
      "website design",
      "web design",
      "website development",
      "pharmacy website",
      "pharmacy websites",
      "website hosting",
      "web hosting",
    ],
  },
  {
    name: "seo",
    signals: [
      "seo",
      "search engine optimisation",
      "search engine optimization",
      "local seo",
      "google business profile",
      "google maps",
      "local search",
    ],
  },
  {
    name: "marketing",
    signals: [
      "digital marketing",
      "pharmacy marketing",
      "marketing agency",
      "online marketing",
      "digital growth",
      "patient marketing",
    ],
  },
  {
    name: "email",
    signals: [
      "email marketing",
      "email campaigns",
      "patient email",
      "email automation",
    ],
  },
  {
    name: "growth",
    signals: [
      "growth audit",
      "marketing audit",
      "digital audit",
      "growth strategy",
      "digital strategy",
      "marketing strategy",
    ],
  },
];

const UK_SIGNALS = [
  "united kingdom",
  " uk ",
  "uk-based",
  "uk based",
  ".co.uk",
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "british",
];

function normalise(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalDomain(value: string): string {
  return normalise(value)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
}

function containsAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

export function qualifyNationalCompetitorV2(
  input: NationalCompetitorQualificationV2Input,
): NationalCompetitorQualificationV2Result {
  const domain = canonicalDomain(input.domain);

  const combined = normalise([
    domain,
    input.title,
    input.snippet,
    input.url,
    input.websiteText,
    ...(input.servicesDetected ?? []),
    ...(input.matchedQueries ?? []),
  ].join(" "));

  const evidenceText = normalise([
    domain,
    input.title,
    input.snippet,
    input.url,
    input.websiteText,
    ...(input.servicesDetected ?? []),
  ].join(" "));

  const reasons: string[] = [];
  const exclusionReasons: string[] = [];

  const ownDomains = (input.ownDomains || []).map((value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0],
  ).filter(Boolean);
  if (ownDomains.some((own) => domain === own || domain.endsWith(`.${own}`))) {
    exclusionReasons.push("Subject's own domain.");
  }

  if (
    DIRECT_EXCLUDED_DOMAINS.has(domain) ||
    EXCLUDED_DOMAIN_PATTERNS.some((pattern) => pattern.test(domain))
  ) {
    exclusionReasons.push(
      "Publisher, regulator, social platform, directory or non-commercial evidence source.",
    );
  }

  if (containsAny(evidenceText, EXCLUDED_ORGANISATION_SIGNALS)) {
    exclusionReasons.push(
      "Evidence describes a publisher, regulator, directory, data provider, professional body or other non-competing organisation.",
    );
  }

  const pharmacyMarket = containsAny(evidenceText, PHARMACY_MARKET_SIGNALS);

  const commercialProvider =
    containsAny(evidenceText, COMMERCIAL_PROVIDER_SIGNALS) ||
    /(?:services?|solutions?|agency|marketing|design|development|hosting)/i.test(
      normalise(input.title),
    );

  const detectedGroups = DIGITAL_SERVICE_GROUPS.filter((group) =>
    containsAny(evidenceText, group.signals),
  ).map((group) => group.name);

  const digitalService = detectedGroups.length > 0;
  const multiServiceOverlap = detectedGroups.length >= 2;

  const ukMarket =
    domain.endsWith(".co.uk") ||
    containsAny(` ${combined} `, UK_SIGNALS) ||
    (input.matchedQueries ?? []).some((q) =>
      /united kingdom|\buk\b/i.test(q),
    );

  let score = 0;

  if (pharmacyMarket) {
    score += 30;
    reasons.push("Explicit pharmacy-sector market evidence.");
  }

  if (commercialProvider) {
    score += 25;
    reasons.push("Commercial service-provider evidence.");
  }

  if (digitalService) {
    score += 20;
    reasons.push(
      `Relevant digital-service evidence: ${detectedGroups.join(", ")}.`,
    );
  }

  if (multiServiceOverlap) {
    score += 15;
    reasons.push("Multiple PharmaConnect service categories overlap.");
  }

  if (ukMarket) {
    score += 10;
    reasons.push("UK commercial-market evidence.");
  }

  /*
   * Critical gate:
   *
   * A genuine competitor MUST have evidence of all three:
   *   1. pharmacy customer market
   *   2. commercial service provision
   *   3. relevant digital service provision
   *
   * Keyword/search-query relevance alone cannot pass this gate.
   */

  const commercialCompetitorGate =
    pharmacyMarket &&
    commercialProvider &&
    digitalService &&
    exclusionReasons.length === 0;

  if (!commercialCompetitorGate) {
    return {
      qualified: false,
      score,
      classification:
        exclusionReasons.length > 0
          ? "excluded"
          : "insufficient_evidence",
      reasons,
      exclusionReasons,
      evidence: {
        pharmacyMarket,
        commercialProvider,
        digitalService,
        ukMarket,
        multiServiceOverlap,
      },
    };
  }

  /*
   * Direct competitor:
   * Strong commercial evidence plus either multiple overlapping
   * digital services or a very strong total evidence score.
   */

  const direct =
    ukMarket &&
    (multiServiceOverlap || score >= 85);

  return {
    qualified: direct,
    score,
    classification: direct
      ? "direct_competitor"
      : "adjacent_competitor",
    reasons,
    exclusionReasons,
    evidence: {
      pharmacyMarket,
      commercialProvider,
      digitalService,
      ukMarket,
      multiServiceOverlap,
    },
  };
}
