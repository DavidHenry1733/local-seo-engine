/**
 * Generic Technical SEO + Structured Data contract.
 * Page-type aware. Not tenant- or service-specific.
 * Unregistered page types cannot become index-eligible.
 */
export const TECHNICAL_SEO_CONTRACT_VERSION = "technical-seo-structured-data-contract-v1";

export const TECHNICAL_SEO_PAGE_TYPES = [
  "service",
  "locality",
  "service_hub",
  "cluster",
  "patient_guide",
  "faq",
  "article",
  "landing",
  "homepage",
] as const;

export type TechnicalSeoPageType = (typeof TECHNICAL_SEO_PAGE_TYPES)[number];

export type TechnicalSeoSeverity = "BLOCKER" | "RECOMMENDATION" | "INFORMATIONAL";

export interface TechnicalSeoRobotsPolicy {
  indexableByDefault: boolean;
  accidentalNoindexIsBlocker: boolean;
  requireExplicitNoindexWhenNotIndexable: boolean;
}

export interface TechnicalSeoHeadingPolicy {
  requireSingleH1: boolean;
  h1MustMatchPageIntent: boolean;
  emptyHeadingsAreBlockers: boolean;
}

export interface TechnicalSeoImageAltPolicy {
  meaningfulImagesRequireAlt: boolean;
  decorativeEmptyAltValid: boolean;
  filenameOnlyAltSeverity: TechnicalSeoSeverity;
}

export interface TechnicalSeoStructuredDataPolicy {
  jsonLdMustBeValidWhenPresent: boolean;
  pageEntityUrlMustAgreeWithCanonical: boolean;
  faqSchemaRequiresVisibleFaq: boolean;
  personSchemaRequiresVisibleName: boolean;
  recommendedTypes: string[];
}

export interface TechnicalSeoInternalLinkPolicy {
  requireServiceLocalityRelationship: boolean;
  brokenSameHostLinksAreBlockers: boolean;
  staleCampaignCustomerPathsAreBlockers: boolean;
}

export interface TechnicalSeoSitemapPolicy {
  includeWhenIndexable: boolean;
  excludeWhenNotIndexable: boolean;
  urlsMustMatchCanonical: boolean;
}

export interface TechnicalSeoPageTypeContract {
  pageType: TechnicalSeoPageType;
  indexableByDefault: boolean;
  requiredMetadata: Array<"title" | "metaDescription" | "canonical" | "robots">;
  canonicalPolicy: "authoritative_publication_destination";
  robotsPolicy: TechnicalSeoRobotsPolicy;
  headingPolicy: TechnicalSeoHeadingPolicy;
  imageAltPolicy: TechnicalSeoImageAltPolicy;
  structuredDataPolicy: TechnicalSeoStructuredDataPolicy;
  internalLinkPolicy: TechnicalSeoInternalLinkPolicy;
  sitemapPolicy: TechnicalSeoSitemapPolicy;
}

const INDEXABLE_ROBOTS: TechnicalSeoRobotsPolicy = {
  indexableByDefault: true,
  accidentalNoindexIsBlocker: true,
  requireExplicitNoindexWhenNotIndexable: false,
};

const NON_INDEXABLE_ROBOTS: TechnicalSeoRobotsPolicy = {
  indexableByDefault: false,
  accidentalNoindexIsBlocker: false,
  requireExplicitNoindexWhenNotIndexable: true,
};

const STANDARD_HEADINGS: TechnicalSeoHeadingPolicy = {
  requireSingleH1: true,
  h1MustMatchPageIntent: true,
  emptyHeadingsAreBlockers: true,
};

const STANDARD_ALT: TechnicalSeoImageAltPolicy = {
  meaningfulImagesRequireAlt: true,
  decorativeEmptyAltValid: true,
  filenameOnlyAltSeverity: "RECOMMENDATION",
};

const STANDARD_LINKS: TechnicalSeoInternalLinkPolicy = {
  requireServiceLocalityRelationship: false,
  brokenSameHostLinksAreBlockers: true,
  staleCampaignCustomerPathsAreBlockers: true,
};

const LOCALITY_LINKS: TechnicalSeoInternalLinkPolicy = {
  ...STANDARD_LINKS,
  requireServiceLocalityRelationship: true,
};

const INDEXABLE_SITEMAP: TechnicalSeoSitemapPolicy = {
  includeWhenIndexable: true,
  excludeWhenNotIndexable: true,
  urlsMustMatchCanonical: true,
};

const NON_INDEXABLE_SITEMAP: TechnicalSeoSitemapPolicy = {
  includeWhenIndexable: false,
  excludeWhenNotIndexable: true,
  urlsMustMatchCanonical: true,
};

function indexableContract(
  pageType: TechnicalSeoPageType,
  recommendedTypes: string[],
  links: TechnicalSeoInternalLinkPolicy = STANDARD_LINKS,
): TechnicalSeoPageTypeContract {
  return {
    pageType,
    indexableByDefault: true,
    requiredMetadata: ["title", "metaDescription", "canonical", "robots"],
    canonicalPolicy: "authoritative_publication_destination",
    robotsPolicy: INDEXABLE_ROBOTS,
    headingPolicy: STANDARD_HEADINGS,
    imageAltPolicy: STANDARD_ALT,
    structuredDataPolicy: {
      jsonLdMustBeValidWhenPresent: true,
      pageEntityUrlMustAgreeWithCanonical: true,
      faqSchemaRequiresVisibleFaq: true,
      personSchemaRequiresVisibleName: true,
      recommendedTypes,
    },
    internalLinkPolicy: links,
    sitemapPolicy: INDEXABLE_SITEMAP,
  };
}

export const TECHNICAL_SEO_CONTRACTS: Record<TechnicalSeoPageType, TechnicalSeoPageTypeContract> = {
  service: indexableContract("service", ["WebPage", "Service"]),
  locality: indexableContract("locality", ["WebPage", "Service"], LOCALITY_LINKS),
  service_hub: indexableContract("service_hub", ["WebPage", "ItemList"]),
  cluster: indexableContract("cluster", ["WebPage"]),
  patient_guide: indexableContract("patient_guide", ["WebPage", "Article"]),
  faq: indexableContract("faq", ["WebPage", "FAQPage"]),
  article: indexableContract("article", ["WebPage", "Article"]),
  landing: indexableContract("landing", ["WebPage"]),
  homepage: {
    pageType: "homepage",
    indexableByDefault: false,
    requiredMetadata: ["canonical"],
    canonicalPolicy: "authoritative_publication_destination",
    robotsPolicy: NON_INDEXABLE_ROBOTS,
    headingPolicy: {
      requireSingleH1: false,
      h1MustMatchPageIntent: false,
      emptyHeadingsAreBlockers: false,
    },
    imageAltPolicy: STANDARD_ALT,
    structuredDataPolicy: {
      jsonLdMustBeValidWhenPresent: true,
      pageEntityUrlMustAgreeWithCanonical: false,
      faqSchemaRequiresVisibleFaq: true,
      personSchemaRequiresVisibleName: true,
      recommendedTypes: [],
    },
    internalLinkPolicy: STANDARD_LINKS,
    sitemapPolicy: NON_INDEXABLE_SITEMAP,
  },
};

const PUBLISH_TYPE_ALIASES: Record<string, TechnicalSeoPageType> = {
  service: "service",
  "service-page": "service",
  locality: "locality",
  "service-area": "locality",
  "location-area": "locality",
  "location-cluster": "locality",
  local: "locality",
  "service-hub": "service_hub",
  "service_hub": "service_hub",
  hub: "service_hub",
  cluster: "cluster",
  supporting: "cluster",
  "patient-guide": "patient_guide",
  "patient_guide": "patient_guide",
  guide: "patient_guide",
  faq: "faq",
  "faq-page": "faq",
  article: "article",
  blog: "article",
  "blog-article": "article",
  landing: "landing",
  "landing-page": "landing",
  homepage: "homepage",
  home: "homepage",
  index: "homepage",
};

export function isRegisteredTechnicalSeoPageType(value: string): value is TechnicalSeoPageType {
  return (TECHNICAL_SEO_PAGE_TYPES as readonly string[]).includes(value);
}

export function resolveTechnicalSeoPageType(raw: string | null | undefined): TechnicalSeoPageType | null {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (isRegisteredTechnicalSeoPageType(key)) return key;
  return PUBLISH_TYPE_ALIASES[key] || PUBLISH_TYPE_ALIASES[key.replace(/_/g, "-")] || null;
}

export function getTechnicalSeoContract(pageType: string): TechnicalSeoPageTypeContract | null {
  const resolved = resolveTechnicalSeoPageType(pageType);
  return resolved ? TECHNICAL_SEO_CONTRACTS[resolved] : null;
}

export const TECHNICAL_SEO_MANDATORY_RULES = [
  "Final published HTML is the authority for pre-index validation; generator inputs are not sufficient.",
  "Unregistered page types fail closed and cannot become index-eligible.",
  "Indexable pages require a non-empty title, meta description, single meaningful H1, and absolute HTTPS canonical.",
  "Canonical must equal the authoritative publication destination for that page path.",
  "A Business Profile / customer website URL cannot become canonical unless verified production-domain publication is authoritative.",
  "Intended indexable pages must not carry accidental noindex; non-indexable pages must not be submitted merely because they were published.",
  "JSON-LD, when present, must parse and page-entity URLs must agree with canonical.",
  "Sitemap must include intended indexable URLs, exclude non-indexable URLs, and agree with canonicals.",
  "Cross-tenant or cross-service canonical/entity leakage blocks indexing.",
  "BLOCKERS prevent indexing. RECOMMENDATIONS never block indexing by themselves.",
] as const;
