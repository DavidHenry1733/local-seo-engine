/**
 * Canonical commercial-evidence qualification.
 *
 * Google Places remains the authority for nearby physical competitors.
 * DataForSEO rows stay stored as raw search evidence and are classified
 * at read time. This module does not collect or rewrite provider artifacts.
 */
import { isDirectCommunityPharmacyCompetitor } from "./pharmacyCompetitorDiscovery.ts";

export const ORGANIC_SEARCH_EVIDENCE_HEADING = "Organic Search Evidence — DataForSEO" as const;

export const COMMERCIAL_EVIDENCE_CLASSES = [
  "LOCAL_COMMERCIAL_COMPETITOR",
  "ORGANIC_COMMERCIAL_COMPETITOR",
  "AUTHORITATIVE_INFORMATIONAL",
  "IRRELEVANT",
] as const;

export type CommercialEvidenceClass = (typeof COMMERCIAL_EVIDENCE_CLASSES)[number];
export type CommercialEvidenceConfidence = "high" | "medium" | "low";

export interface CommercialEvidenceCandidate {
  name?: string;
  domain?: string;
  host?: string;
  url?: string;
  position?: number | null;
  matchedQuery?: string;
  title?: string;
  description?: string;
  provider?: string;
  source?: string;
  capturedAt?: string | null;
  sourceRevision?: string | null;
  placeId?: string | null;
  primaryCategory?: string | null;
  categories?: string[];
  distanceKm?: number | null;
  discoveryAccepted?: boolean;
  verifiedLocalDomains?: string[];
}

export interface CommercialEvidenceQualification {
  evidenceClass: CommercialEvidenceClass;
  confidence: CommercialEvidenceConfidence;
  qualificationReason: string;
  evidenceUsed: string[];
  domain: string;
  url: string;
  query: string;
  position: number | null;
  title: string;
  description: string;
  provider: string;
  capturedAt: string | null;
  sourceRevision: string | null;
}

const EXCLUDED_NON_PHARMACY = /\b(restaurant|cafe|coffee|bar|pub|school|gym|hotel|museum|hospital|dentist|doctor|supermarket|grocery)\b/i;
const PHARMACY_IDENTITY = /\b(pharmac(?:y|ies)|chemists?|drugstore)\b/i;
const DOCUMENT_URL = /\.pdf(?:$|\?)|\/pdf\/|content\/pdf/i;
const ACADEMIC_DOCUMENT = /\b(cited by|springer nature|doi\.org|journal article)\b/i;
const UNRELATED_MEDIA = /\b(album|metascore|instrumental remix|practical electronics|radio history)\b/i;
const DIRECTORY_INTENT = /\/find-a-service\/|\/find-a-pharmacy|search results/i;
const NEWS_ARTICLE = /\/news\/\d+/i;
const BLOG_ONLY = /\/blog\//i;
const COMMERCIAL_SERVICE = /\b(book|appointment|service|branch|clinic)\b/i;

export type OrganicSearchEvidenceSection =
  | "your_pharmacy"
  | "verified_local_competitor"
  | "wider_organic_landscape";

export type OrganicSearchLandscapeKind =
  | "tenant"
  | "verified_local_competitor"
  | "other_pharmacy"
  | "directory"
  | "regulator"
  | "social"
  | "nhs_community"
  | "publisher"
  | "other_landscape";

export interface OrganicSearchEvidenceInputRow {
  name?: string;
  domain?: string;
  host?: string;
  url?: string;
  position?: number | null;
  matchedQuery?: string;
  title?: string;
  description?: string;
  evidence?: string;
  overlapEvidence?: string;
  source?: string;
  provider?: string;
  capturedAt?: string | null;
  taskId?: string | null;
}

export interface VerifiedGoogleCompetitorWebsite {
  name: string;
  website: string;
  placeId?: string | null;
  source?: string | null;
}

export interface ClassifiedOrganicSearchEvidenceRow {
  name: string;
  domain: string;
  host: string;
  url: string;
  position: number | null;
  matchedQuery: string;
  title: string;
  description: string;
  evidence: string;
  source: string;
  capturedAt: string | null;
  taskId: string | null;
  section: OrganicSearchEvidenceSection;
  landscapeKind: OrganicSearchLandscapeKind;
  classificationLabel: string;
  matchedCompetitorName: string | null;
  evidenceClass: CommercialEvidenceClass | null;
  confidence: CommercialEvidenceConfidence | null;
  qualificationReason: string;
  evidenceUsed: string[];
}

export interface OrganicSearchEvidenceClassification {
  heading: typeof ORGANIC_SEARCH_EVIDENCE_HEADING;
  yourPharmacy: ClassifiedOrganicSearchEvidenceRow[];
  verifiedLocalCompetitorMatches: ClassifiedOrganicSearchEvidenceRow[];
  widerOrganicLandscape: ClassifiedOrganicSearchEvidenceRow[];
  rows: ClassifiedOrganicSearchEvidenceRow[];
}

const SOCIAL_DOMAIN_PATTERNS = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)tiktok\.com$/i,
];

const REGULATOR_DOMAIN_PATTERNS = [
  /(^|\.)pharmacyregulation\.org$/i,
  /(^|\.)gov\.uk$/i,
  /(^|\.)cqc\.org\.uk$/i,
  /(^|\.)professionalstandards\.org\.uk$/i,
];

const NHS_COMMUNITY_DOMAIN_PATTERNS = [
  /(^|\.)nhs\.uk$/i,
  /(^|\.)communitypharmacy\.org\.uk$/i,
  /healthwatch/i,
  /healthcentre/i,
];

const DIRECTORY_DOMAIN_PATTERNS = [
  /(^|\.)yell\.com$/i,
  /(^|\.)thomsonlocal\.com$/i,
  /(^|\.)cylex-uk\.co\.uk$/i,
  /(^|\.)allhealthandcare\.co\.uk$/i,
  /(^|\.)192\.com$/i,
  /(^|\.)touchlocal\.com$/i,
  /(^|\.)hotfrog\.co\.uk$/i,
  /(^|\.)treatlocal\.co\.uk$/i,
  /(^|\.)mylocalsurgery\.co\.uk$/i,
  /(^|\.)carehome\.co\.uk$/i,
  /(^|\.)nursinghome\.co\.uk$/i,
];

const PUBLISHER_DOMAIN_PATTERNS = [
  /(^|\.)wikipedia\.org$/i,
  /(^|\.)bbc\.co\.uk$/i,
  /(^|\.)theguardian\.com$/i,
  /(^|\.)pharmaceutical-journal\.com$/i,
  /(^|\.)bmj\.com$/i,
  /(^|\.)chemistanddruggist\.co\.uk$/i,
];

function clean(value: unknown): string {
  return String(value || "").trim();
}

export function canonicalWebsiteDomain(raw: unknown): string {
  return clean(raw)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .split(":")[0];
}

export function isVerifiedGooglePlacesCompetitor(source?: string | null, placeId?: string | null): boolean {
  const id = clean(placeId);
  if (!id || id.startsWith("demo-")) return false;
  return /google-places/i.test(clean(source));
}

export function collectTenantWebsiteDomains(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const domain = canonicalWebsiteDomain(url);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push(domain);
  }
  return out;
}

export function collectVerifiedGoogleCompetitorDomains(
  competitors: VerifiedGoogleCompetitorWebsite[],
): Array<{ domain: string; name: string }> {
  const seen = new Set<string>();
  const out: Array<{ domain: string; name: string }> = [];
  for (const competitor of competitors) {
    if (!isVerifiedGooglePlacesCompetitor(competitor.source, competitor.placeId)) continue;
    const domain = canonicalWebsiteDomain(competitor.website);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    out.push({ domain, name: clean(competitor.name) || domain });
  }
  return out;
}

function matchesAny(domain: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(domain));
}

export function registrableBrandKey(domain: string): string {
  const host = canonicalWebsiteDomain(domain);
  if (!host) return "";
  const suffixes = ["co.uk", "org.uk", "ac.uk", "gov.uk", "nhs.uk", "me.uk"];
  for (const suffix of suffixes) {
    if (host === suffix) return "";
    if (host.endsWith(`.${suffix}`)) {
      const rest = host.slice(0, -(suffix.length + 1));
      const label = rest.split(".").pop() || rest;
      return label.replace(/[^a-z0-9]/g, "");
    }
  }
  const parts = host.split(".");
  if (parts.length >= 2) return parts[parts.length - 2].replace(/[^a-z0-9]/g, "");
  return host.replace(/[^a-z0-9]/g, "");
}

export function pharmacyNameBrandKey(name: string): string {
  const primary = clean(name).split("|")[0];
  return primary.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isReservedLandscapeDomain(domain: string): boolean {
  return (
    matchesAny(domain, SOCIAL_DOMAIN_PATTERNS) ||
    matchesAny(domain, REGULATOR_DOMAIN_PATTERNS) ||
    matchesAny(domain, NHS_COMMUNITY_DOMAIN_PATTERNS) ||
    matchesAny(domain, DIRECTORY_DOMAIN_PATTERNS) ||
    matchesAny(domain, PUBLISHER_DOMAIN_PATTERNS)
  );
}

export function isOwnBusinessDomain(
  domain: string,
  tenantDomains: string[],
  pharmacyName?: string,
): boolean {
  if (!domain || isReservedLandscapeDomain(domain)) return false;
  if (tenantDomains.some((own) => domain === own || (own && domain.endsWith(`.${own}`)))) return true;
  const keys = new Set(tenantDomains.map(registrableBrandKey).filter((key) => key.length >= 4));
  const nameKey = pharmacyNameBrandKey(pharmacyName || "");
  if (nameKey.length >= 8) keys.add(nameKey);
  const domainKey = registrableBrandKey(domain);
  return Boolean(domainKey && keys.has(domainKey));
}

function looksLikeOtherPharmacy(domain: string, title: string, description: string): boolean {
  if (/pharmacy|chemist/.test(domain)) return true;
  const titleText = clean(title).toLowerCase();
  if (!/\b(pharmacy|chemist)\b/.test(titleText)) return false;
  const stripped = titleText.replace(/^nhs\s+/i, "").trim();
  if (/^pharmacy first\b/.test(stripped) && stripped.length < 40) return false;
  return true;
}

export function classifyWiderLandscapeKind(
  domain: string,
  title = "",
  description = "",
): OrganicSearchLandscapeKind {
  if (matchesAny(domain, SOCIAL_DOMAIN_PATTERNS)) return "social";
  if (matchesAny(domain, REGULATOR_DOMAIN_PATTERNS)) return "regulator";
  if (matchesAny(domain, NHS_COMMUNITY_DOMAIN_PATTERNS)) return "nhs_community";
  if (matchesAny(domain, DIRECTORY_DOMAIN_PATTERNS)) return "directory";
  if (matchesAny(domain, PUBLISHER_DOMAIN_PATTERNS)) return "publisher";
  if (looksLikeOtherPharmacy(domain, title, description)) return "other_pharmacy";
  return "other_landscape";
}

function landscapeLabel(kind: OrganicSearchLandscapeKind, matchedCompetitorName: string | null): string {
  if (kind === "tenant") return "Your pharmacy";
  if (kind === "verified_local_competitor") {
    return matchedCompetitorName
      ? `Verified local competitor — ${matchedCompetitorName}`
      : "Verified local competitor";
  }
  if (kind === "other_pharmacy") return "Other pharmacy competitor";
  if (kind === "directory") return "Directory";
  if (kind === "regulator") return "Regulator";
  if (kind === "social") return "Social";
  if (kind === "nhs_community") return "NHS/community";
  if (kind === "publisher") return "Publisher";
  return "Other search result";
}

function isTenantDomain(domain: string, tenantDomains: string[], pharmacyName?: string): boolean {
  return isOwnBusinessDomain(domain, tenantDomains, pharmacyName);
}

function result(
  input: CommercialEvidenceCandidate,
  evidenceClass: CommercialEvidenceClass,
  confidence: CommercialEvidenceConfidence,
  qualificationReason: string,
  evidenceUsed: string[],
): CommercialEvidenceQualification {
  const domain = canonicalWebsiteDomain(input.domain || input.host || input.url);
  return {
    evidenceClass,
    confidence,
    qualificationReason,
    evidenceUsed,
    domain,
    url: clean(input.url),
    query: clean(input.matchedQuery),
    position: Number.isFinite(input.position as number) ? (input.position as number) : input.position ?? null,
    title: clean(input.title || input.name),
    description: clean(input.description),
    provider: clean(input.provider || input.source),
    capturedAt: input.capturedAt || null,
    sourceRevision: input.sourceRevision || null,
  };
}

function pharmacyIdentity(input: CommercialEvidenceCandidate, blob: string): boolean {
  const categories = (input.categories || []).join(" ");
  const primary = clean(input.primaryCategory);
  if (PHARMACY_IDENTITY.test(categories) || PHARMACY_IDENTITY.test(primary)) return true;
  if (PHARMACY_IDENTITY.test(clean(input.name)) || PHARMACY_IDENTITY.test(clean(input.title)) || /pharmacy|chemist/.test(canonicalWebsiteDomain(input.domain || input.host || input.url))) {
    return true;
  }
  if (!primary) return false;
  return isDirectCommunityPharmacyCompetitor({
    name: input.name || input.title,
    primaryCategory: primary,
  });
}

function excludedNonPharmacy(input: CommercialEvidenceCandidate, blob: string): boolean {
  if (pharmacyIdentity(input, blob)) return false;
  const primary = clean(input.primaryCategory);
  return EXCLUDED_NON_PHARMACY.test(blob) || EXCLUDED_NON_PHARMACY.test(primary);
}

function googlePlacesCandidate(input: CommercialEvidenceCandidate): boolean {
  return /google-places/i.test(clean(input.source || input.provider));
}

export function countsTowardLocalBenchmark(evidenceClass: CommercialEvidenceClass | null): boolean {
  return evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR";
}

export function countsTowardOrganicAnalysis(evidenceClass: CommercialEvidenceClass | null): boolean {
  return evidenceClass === "ORGANIC_COMMERCIAL_COMPETITOR";
}

export function countsTowardCommercialCompetitorTotal(evidenceClass: CommercialEvidenceClass | null): boolean {
  return evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR" || evidenceClass === "ORGANIC_COMMERCIAL_COMPETITOR";
}

export function countsTowardOpportunityScoring(evidenceClass: CommercialEvidenceClass | null): boolean {
  return evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR";
}

export function qualifyCommercialEvidenceCandidate(
  input: CommercialEvidenceCandidate,
): CommercialEvidenceQualification {
  const domain = canonicalWebsiteDomain(input.domain || input.host || input.url);
  const blob = [input.name, input.title, input.description, input.url, domain, input.primaryCategory, ...(input.categories || [])]
    .map((part) => clean(part))
    .join(" ");
  const used = [clean(input.provider || input.source) || "stored evidence", clean(input.matchedQuery), clean(input.url), clean(input.title)].filter(Boolean);

  if (googlePlacesCandidate(input)) {
    const placeId = clean(input.placeId);
    if (!placeId || placeId.startsWith("demo-")) {
      return result(input, "IRRELEVANT", "low", "Google Places row has no verified place identity.", [...used, "missing place id"]);
    }
    if (excludedNonPharmacy(input, blob)) {
      return result(input, "IRRELEVANT", "high", "Google Places result is not a pharmacy competitor.", [...used, "excluded non-pharmacy type"]);
    }
    if (pharmacyIdentity(input, blob) || input.discoveryAccepted) {
      const corroborated = pharmacyIdentity(input, blob);
      return result(
        input,
        "LOCAL_COMMERCIAL_COMPETITOR",
        corroborated ? "high" : "medium",
        corroborated
          ? "Google Places pharmacy identity with a physical place."
          : "Nearby business retained by pharmacy discovery with a physical place.",
        [...used, corroborated ? "pharmacy identity" : "pharmacy discovery acceptance", input.distanceKm != null ? "distance" : ""].filter(Boolean),
      );
    }
    return result(input, "IRRELEVANT", "medium", "Google Places result is not a local commercial pharmacy competitor.", used);
  }

  const verified = (input.verifiedLocalDomains || []).some((item) => canonicalWebsiteDomain(item) === domain && domain);
  if (verified) {
    return result(
      input,
      "LOCAL_COMMERCIAL_COMPETITOR",
      "high",
      "Organic result matches a verified Google Places competitor domain.",
      [...used, "verified local domain"],
    );
  }

  if (DOCUMENT_URL.test(clean(input.url)) || ACADEMIC_DOCUMENT.test(blob) || UNRELATED_MEDIA.test(blob)) {
    return result(input, "IRRELEVANT", "high", "Search result is a document or unrelated media page, not a commercial competitor.", [...used, "document or unrelated media"]);
  }

  if (matchesAny(domain, SOCIAL_DOMAIN_PATTERNS) && !pharmacyIdentity(input, blob)) {
    return result(input, "IRRELEVANT", "high", "Social result is not a commercial pharmacy competitor.", [...used, "social result"]);
  }

  if (
    matchesAny(domain, REGULATOR_DOMAIN_PATTERNS) ||
    matchesAny(domain, NHS_COMMUNITY_DOMAIN_PATTERNS) ||
    matchesAny(domain, DIRECTORY_DOMAIN_PATTERNS) ||
    matchesAny(domain, PUBLISHER_DOMAIN_PATTERNS) ||
    DIRECTORY_INTENT.test(blob) ||
    NEWS_ARTICLE.test(clean(input.url))
  ) {
    return result(
      input,
      "AUTHORITATIVE_INFORMATIONAL",
      isReservedLandscapeDomain(domain) ? "high" : "medium",
      "Search result is authoritative, directory, or informational evidence, not a commercial pharmacy competitor.",
      [...used, "authority or directory intent"],
    );
  }

  if (BLOG_ONLY.test(clean(input.url)) && !COMMERCIAL_SERVICE.test(blob)) {
    return result(input, "IRRELEVANT", "medium", "Blog-only page is not a local or commercial competitor.", [...used, "blog-only"]);
  }

  if (pharmacyIdentity(input, blob) || /pharmacy|chemist/.test(domain)) {
    return result(
      input,
      "ORGANIC_COMMERCIAL_COMPETITOR",
      COMMERCIAL_SERVICE.test(blob) || /pharmacy|chemist/.test(domain) ? "high" : "medium",
      "Commercial pharmacy or provider website ranking organically, without verified nearby physical evidence.",
      [...used, "pharmacy commercial identity", "no verified local place"],
    );
  }

  return result(input, "IRRELEVANT", "medium", "Query-term overlap is not commercial competitor evidence.", [...used, "query-term coincidence"]);
}

export function commercialEvidenceClassLabel(evidenceClass: CommercialEvidenceClass | null): string {
  if (evidenceClass === "LOCAL_COMMERCIAL_COMPETITOR") return "Local commercial competitor";
  if (evidenceClass === "ORGANIC_COMMERCIAL_COMPETITOR") return "Organic commercial competitor";
  if (evidenceClass === "AUTHORITATIVE_INFORMATIONAL") return "Authoritative / informational";
  if (evidenceClass === "IRRELEVANT") return "Irrelevant";
  return "Own pharmacy";
}

export function classifyOrganicSearchEvidence(input: {
  tenantWebsiteUrls: Array<string | null | undefined>;
  verifiedGoogleCompetitorWebsites: VerifiedGoogleCompetitorWebsite[];
  rows: OrganicSearchEvidenceInputRow[];
  pharmacyName?: string;
}): OrganicSearchEvidenceClassification {
  const tenantDomains = collectTenantWebsiteDomains(input.tenantWebsiteUrls);
  const verifiedDomains = collectVerifiedGoogleCompetitorDomains(input.verifiedGoogleCompetitorWebsites);
  const classified: ClassifiedOrganicSearchEvidenceRow[] = [];

  for (const row of input.rows || []) {
    const domain = canonicalWebsiteDomain(row.domain || row.host || row.url);
    const host = canonicalWebsiteDomain(row.host || row.domain || row.url) || domain;
    const verified = verifiedDomains.find((competitor) => competitor.domain === domain);
    const tenant = Boolean(domain && isTenantDomain(domain, tenantDomains, input.pharmacyName));

    let section: OrganicSearchEvidenceSection = "wider_organic_landscape";
    let landscapeKind: OrganicSearchLandscapeKind = domain
      ? classifyWiderLandscapeKind(domain, clean(row.title || row.name), clean(row.description))
      : "other_landscape";
    let matchedCompetitorName: string | null = null;

    if (tenant) {
      section = "your_pharmacy";
      landscapeKind = "tenant";
    } else if (verified) {
      section = "verified_local_competitor";
      landscapeKind = "verified_local_competitor";
      matchedCompetitorName = verified.name;
    }

    const qualification = tenant
      ? null
      : qualifyCommercialEvidenceCandidate({
          name: row.name,
          domain,
          host,
          url: row.url,
          position: row.position,
          matchedQuery: row.matchedQuery,
          title: row.title || row.name,
          description: row.description,
          provider: row.provider,
          source: row.source || row.provider,
          capturedAt: row.capturedAt,
          verifiedLocalDomains: verified ? [domain] : [],
        });

    classified.push({
      name: clean(row.title || row.name || row.domain) || "Not available",
      domain,
      host,
      url: clean(row.url),
      position: Number.isFinite(row.position as number) ? (row.position as number) : row.position ?? null,
      matchedQuery: clean(row.matchedQuery),
      title: clean(row.title),
      description: clean(row.description),
      evidence: clean(row.evidence || row.overlapEvidence),
      source: clean(row.source || row.provider) || "dataforseo-google-organic-live",
      capturedAt: row.capturedAt || null,
      taskId: row.taskId ?? null,
      section,
      landscapeKind,
      classificationLabel: landscapeLabel(landscapeKind, matchedCompetitorName),
      matchedCompetitorName,
      evidenceClass: qualification?.evidenceClass || null,
      confidence: qualification?.confidence || null,
      qualificationReason: qualification?.qualificationReason || "Own pharmacy search appearance is not a competitor candidate.",
      evidenceUsed: qualification?.evidenceUsed || ["tenant website"],
    });
  }

  return {
    heading: ORGANIC_SEARCH_EVIDENCE_HEADING,
    yourPharmacy: classified.filter((row) => row.section === "your_pharmacy"),
    verifiedLocalCompetitorMatches: classified.filter((row) => row.section === "verified_local_competitor"),
    widerOrganicLandscape: classified.filter((row) => row.section === "wider_organic_landscape"),
    rows: classified,
  };
}
