/**
 * Technical SEO index eligibility gate.
 * Inspects FINAL HTML. BLOCKERS fail closed. RECOMMENDATIONS never block alone.
 */
import {
  getTechnicalSeoContract,
  resolveTechnicalSeoPageType,
  TECHNICAL_SEO_CONTRACT_VERSION,
  type TechnicalSeoPageType,
  type TechnicalSeoSeverity,
} from "./pharmacyTechnicalSeoContract.ts";
import {
  inspectTechnicalSeoHtml,
  jsonLdFaqQuestions,
  jsonLdHasType,
  jsonLdPageEntityUrls,
  jsonLdPersonNames,
  type InspectedTechnicalSeoHtml,
} from "./pharmacyTechnicalSeoHtmlInspector.ts";
import {
  resolveAuthoritativePublicationCanonical,
  type AuthoritativePublicationCanonicalInput,
} from "./pharmacyPublicationCanonicalAuthority.ts";

export interface TechnicalSeoFinding {
  severity: TechnicalSeoSeverity;
  code: string;
  message: string;
}

export interface TechnicalSeoIndexGateInput {
  slug: string;
  serviceId: string;
  pageType: string;
  publicPath: string;
  html: string;
  pageUrl?: string | null;
  httpStatus?: number | null;
  sitemapUrls?: string[];
  campaignCanonicals?: string[];
  expectedLocality?: string | null;
  intendedIndexable?: boolean | null;
  profileWebsite?: string | null;
  storedCanonicalUrl?: string | null;
  managedProfile?: AuthoritativePublicationCanonicalInput["managedProfile"];
  brokenSameHostPaths?: string[];
  servicePublicPath?: string | null;
}

export interface TechnicalSeoIndexGateResult {
  version: typeof TECHNICAL_SEO_CONTRACT_VERSION;
  slug: string;
  serviceId: string;
  pageType: TechnicalSeoPageType | "unregistered";
  registered: boolean;
  publicPath: string;
  pageUrl: string;
  canonical: string;
  authoritativeCanonical: string;
  intendedIndexable: boolean;
  eligible: boolean;
  httpStatus: number | null;
  title: string;
  metaDescription: string;
  robots: string;
  h1: string[];
  schemaTypes: string[];
  blockers: TechnicalSeoFinding[];
  recommendations: TechnicalSeoFinding[];
  informational: TechnicalSeoFinding[];
  inspected: InspectedTechnicalSeoHtml;
}

function str(value: unknown): string {
  return String(value || "").trim();
}

function normalizeUrl(value: string): string {
  const raw = str(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return `${url.protocol}//${url.hostname.toLowerCase()}${path}${url.search}`.replace(/\/+$/, "/") ;
  } catch {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return path.endsWith("/") ? path : `${path}/`;
  }
}

function hostOf(value: string): string {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function managedHost(slug: string): string {
  return `${str(slug).toLowerCase()}.sites.pharmaconnect.uk`;
}

function isPlaceholderHost(host: string): boolean {
  const value = host.replace(/^www\./, "");
  return (
    value === "example.local" ||
    value === "example.com" ||
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "0.0.0.0"
  );
}

function isCustomerCampaignPath(href: string, profileWebsite: string, publicPath: string): boolean {
  const profileHost = hostOf(profileWebsite).replace(/^www\./, "");
  const hrefHost = hostOf(href).replace(/^www\./, "");
  if (!profileHost || hrefHost !== profileHost) return false;
  try {
    const path = new URL(href.includes("://") ? href : `https://${href}`).pathname.toLowerCase();
    const campaign = publicPath.replace(/\/$/, "").toLowerCase();
    return Boolean(campaign) && (path === campaign || path === `${campaign}/` || path.startsWith(`${campaign}/`));
  } catch {
    return false;
  }
}

function filenameOnlyAlt(src: string, alt: string): boolean {
  if (!alt) return false;
  const base = src.split("/").pop()?.split("?")[0] || "";
  return alt === base || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(alt);
}

function add(
  findings: TechnicalSeoFinding[],
  severity: TechnicalSeoSeverity,
  code: string,
  message: string,
): void {
  findings.push({ severity, code, message });
}

export function evaluateTechnicalSeoIndexGate(input: TechnicalSeoIndexGateInput): TechnicalSeoIndexGateResult {
  const slug = str(input.slug);
  const serviceId = str(input.serviceId);
  const publicPath = str(input.publicPath).startsWith("/")
    ? str(input.publicPath).endsWith("/")
      ? str(input.publicPath)
      : `${str(input.publicPath)}/`
    : `/${str(input.publicPath)}/`;
  const inspected = inspectTechnicalSeoHtml(input.html);
  const resolvedType =
    publicPath === "/" ? "homepage" : resolveTechnicalSeoPageType(input.pageType);
  const contract = resolvedType ? getTechnicalSeoContract(resolvedType) : null;
  const registered = Boolean(contract);
  const pageType: TechnicalSeoPageType | "unregistered" = resolvedType || "unregistered";
  const authority = resolveAuthoritativePublicationCanonical({
    slug,
    serviceId,
    publicPath: resolvedType === "homepage" ? `/${serviceId}/` : publicPath,
    storedCanonicalUrl: input.storedCanonicalUrl,
    profileWebsite: input.profileWebsite,
    managedProfile: input.managedProfile,
  });
  const authoritativeCanonical =
    resolvedType === "homepage" ? authority.canonicalUrl : authority.canonicalUrl;
  const intendedIndexable =
    typeof input.intendedIndexable === "boolean"
      ? input.intendedIndexable
      : Boolean(contract?.indexableByDefault);
  const blockers: TechnicalSeoFinding[] = [];
  const recommendations: TechnicalSeoFinding[] = [];
  const informational: TechnicalSeoFinding[] = [];
  const pageUrl = str(input.pageUrl) || authoritativeCanonical;
  const httpStatus = typeof input.httpStatus === "number" ? input.httpStatus : null;

  if (!registered || !contract) {
    if (intendedIndexable) {
      add(blockers, "BLOCKER", "unregistered_page_type", `Unregistered page type '${input.pageType}' cannot become index-eligible.`);
    } else {
      add(informational, "INFORMATIONAL", "unregistered_non_indexable", `Unregistered page type '${input.pageType}' is not indexable.`);
    }
  }

  if (intendedIndexable && httpStatus !== null && httpStatus !== 200) {
    add(blockers, "BLOCKER", "non_200", `Intended indexable URL returned HTTP ${httpStatus}.`);
  }

  if (intendedIndexable && contract) {
    if (contract.requiredMetadata.includes("title") && !inspected.title) {
      add(blockers, "BLOCKER", "missing_title", "Title is missing or empty.");
    } else if (inspected.title.length > 70) {
      add(recommendations, "RECOMMENDATION", "title_length", `Title is ${inspected.title.length} characters; consider tightening for SERP display.`);
    }
    if (contract.requiredMetadata.includes("metaDescription") && !inspected.metaDescription) {
      add(blockers, "BLOCKER", "missing_meta_description", "Meta description is missing or empty.");
    }
    if (!inspected.canonical) {
      add(blockers, "BLOCKER", "missing_canonical", "Canonical URL is missing.");
    } else {
      if (!/^https:\/\//i.test(inspected.canonical)) {
        add(blockers, "BLOCKER", "invalid_canonical", "Canonical must be an absolute HTTPS URL.");
      }
      if (normalizeUrl(inspected.canonical) !== normalizeUrl(authoritativeCanonical)) {
        add(
          blockers,
          "BLOCKER",
          "canonical_publication_disagreement",
          `Canonical '${inspected.canonical}' does not match authoritative publication destination '${authoritativeCanonical}'.`,
        );
      }
      const canonicalHost = hostOf(inspected.canonical);
      if (canonicalHost.endsWith(".sites.pharmaconnect.uk") && canonicalHost !== managedHost(slug)) {
        add(blockers, "BLOCKER", "cross_tenant_canonical", `Canonical host '${canonicalHost}' is not attributable to tenant '${slug}'.`);
      }
      const profileHost = hostOf(input.profileWebsite || "").replace(/^www\./, "");
      if (
        profileHost &&
        canonicalHost.replace(/^www\./, "") === profileHost &&
        authority.source === "managed_publication"
      ) {
        add(
          blockers,
          "BLOCKER",
          "profile_website_cannot_override_managed",
          "Customer website/profile URL cannot override managed publication canonical authority.",
        );
      }
    }

    const noindex = /\bnoindex\b/i.test(inspected.robots);
    if (contract.robotsPolicy.accidentalNoindexIsBlocker && noindex) {
      add(blockers, "BLOCKER", "accidental_noindex", "Intended indexable page contains noindex.");
    }

    if (contract.headingPolicy.requireSingleH1) {
      const meaningful = inspected.h1.filter(Boolean);
      if (meaningful.length === 0) add(blockers, "BLOCKER", "missing_h1", "Missing or empty H1.");
      else if (meaningful.length > 1) add(blockers, "BLOCKER", "multiple_h1", `Expected one H1, found ${meaningful.length}.`);
    }
    if (contract.headingPolicy.emptyHeadingsAreBlockers && inspected.headings.some((item) => !item.text)) {
      add(blockers, "BLOCKER", "empty_heading", "Empty heading element present.");
    }
    if (
      contract.headingPolicy.h1MustMatchPageIntent &&
      input.expectedLocality &&
      inspected.h1[0] &&
      !inspected.h1[0].toLowerCase().includes(input.expectedLocality.toLowerCase())
    ) {
      add(
        blockers,
        "BLOCKER",
        "wrong_locality_h1",
        `H1 '${inspected.h1[0]}' does not include expected locality '${input.expectedLocality}'.`,
      );
    }
    if (input.expectedLocality) {
      const locality = input.expectedLocality.toLowerCase();
      if (inspected.title && !inspected.title.toLowerCase().includes(locality)) {
        add(blockers, "BLOCKER", "wrong_locality_title", `Title does not include expected locality '${input.expectedLocality}'.`);
      }
      if (inspected.metaDescription && !inspected.metaDescription.toLowerCase().includes(locality)) {
        add(blockers, "BLOCKER", "wrong_locality_meta", `Meta description does not include expected locality '${input.expectedLocality}'.`);
      }
    }

    for (const image of inspected.images) {
      if (!image.hasAltAttribute) {
        add(blockers, "BLOCKER", "image_missing_alt", `Meaningful image missing alt attribute (${image.src || "unknown src"}).`);
      } else if (image.alt === "" && contract.imageAltPolicy.decorativeEmptyAltValid) {
        add(informational, "INFORMATIONAL", "decorative_empty_alt", `Decorative image uses empty alt (${image.src || "unknown src"}).`);
      } else if (image.alt && filenameOnlyAlt(image.src, image.alt)) {
        add(recommendations, "RECOMMENDATION", "filename_alt", `Image alt looks like a filename (${image.alt}).`);
      }
    }

    const invalidJson = inspected.jsonLd.filter((block) => block.parseError);
    for (const block of invalidJson) {
      add(blockers, "BLOCKER", "invalid_json_ld", `JSON-LD failed to parse: ${block.parseError}`);
    }
    if (contract.structuredDataPolicy.pageEntityUrlMustAgreeWithCanonical) {
      for (const entityUrl of jsonLdPageEntityUrls(inspected)) {
        if (isPlaceholderHost(hostOf(entityUrl))) {
          add(blockers, "BLOCKER", "schema_placeholder_url", `Structured data page URL uses placeholder host '${entityUrl}'.`);
        } else if (normalizeUrl(entityUrl) !== normalizeUrl(inspected.canonical || authoritativeCanonical)) {
          add(
            blockers,
            "BLOCKER",
            "schema_canonical_disagreement",
            `Structured data page URL '${entityUrl}' disagrees with canonical '${inspected.canonical || authoritativeCanonical}'.`,
          );
        }
        const entityHost = hostOf(entityUrl);
        if (entityHost.endsWith(".sites.pharmaconnect.uk") && entityHost !== managedHost(slug)) {
          add(blockers, "BLOCKER", "cross_tenant_schema_url", `Structured data URL host '${entityHost}' is not this tenant.`);
        }
      }
    }
    if (contract.structuredDataPolicy.faqSchemaRequiresVisibleFaq && jsonLdHasType(inspected, "FAQPage")) {
      for (const question of jsonLdFaqQuestions(inspected)) {
        if (question && !inspected.text.toLowerCase().includes(question.toLowerCase())) {
          add(blockers, "BLOCKER", "faq_schema_without_visible_content", `FAQ schema question is not visible in page content: ${question}`);
        }
      }
    }
    if (contract.structuredDataPolicy.personSchemaRequiresVisibleName) {
      for (const name of jsonLdPersonNames(inspected)) {
        if (name && !inspected.text.includes(name)) {
          add(blockers, "BLOCKER", "person_schema_without_visible_name", `Person schema name '${name}' is not present in visible content.`);
        }
      }
    }
    for (const type of contract.structuredDataPolicy.recommendedTypes) {
      if (!jsonLdHasType(inspected, type)) {
        add(recommendations, "RECOMMENDATION", "optional_schema_missing", `Optional ${type} structured data is not present.`);
      }
    }

    if (contract.sitemapPolicy.includeWhenIndexable) {
      const sitemap = (input.sitemapUrls || []).map(normalizeUrl);
      const canonicalNorm = normalizeUrl(inspected.canonical || authoritativeCanonical);
      const listedPage = normalizeUrl(str(input.pageUrl));
      if (sitemap.length > 0 && canonicalNorm && !sitemap.includes(canonicalNorm)) {
        add(blockers, "BLOCKER", "sitemap_missing_indexable_url", "Intended indexable canonical is not present in the sitemap.");
      }
      if (listedPage && canonicalNorm && sitemap.includes(listedPage) && listedPage !== canonicalNorm) {
        add(
          blockers,
          "BLOCKER",
          "sitemap_canonical_disagreement",
          `Sitemap lists '${input.pageUrl}' which disagrees with canonical '${inspected.canonical || authoritativeCanonical}'.`,
        );
      }
    }

    if (contract.internalLinkPolicy.requireServiceLocalityRelationship && input.servicePublicPath) {
      const servicePath = input.servicePublicPath.endsWith("/") ? input.servicePublicPath : `${input.servicePublicPath}/`;
      const hasServiceLink = inspected.links.some((link) => {
        const href = link.href;
        return href === servicePath || href.endsWith(servicePath) || href.includes(servicePath);
      });
      if (!hasServiceLink) {
        add(recommendations, "RECOMMENDATION", "missing_service_relationship_link", "Locality page does not link to the service page.");
      }
    }
  }

  if (!intendedIndexable) {
    if (contract?.robotsPolicy.requireExplicitNoindexWhenNotIndexable && !/\bnoindex\b/i.test(inspected.robots) && !inspected.hasMetaRefresh) {
      add(recommendations, "RECOMMENDATION", "missing_explicit_noindex", "Non-indexable page should declare noindex explicitly.");
    }
    const sitemap = (input.sitemapUrls || []).map(normalizeUrl);
    const listedPageUrl = normalizeUrl(str(input.pageUrl));
    if (listedPageUrl && sitemap.includes(listedPageUrl)) {
      add(blockers, "BLOCKER", "non_indexable_in_sitemap", "Non-indexable page URL is included in the sitemap.");
    }
    add(informational, "INFORMATIONAL", "published_not_indexable", "Published page is recognised as not index-eligible.");
  }

  for (const href of inspected.links.map((link) => link.href)) {
    if (input.profileWebsite && isCustomerCampaignPath(href, input.profileWebsite, publicPath)) {
      add(blockers, "BLOCKER", "stale_customer_campaign_link", `Internal campaign relationship points at customer-domain path '${href}'.`);
    }
    const hrefHost = hostOf(href);
    if (hrefHost.endsWith(".sites.pharmaconnect.uk") && hrefHost !== managedHost(slug)) {
      add(blockers, "BLOCKER", "cross_tenant_link", `Internal link host '${hrefHost}' is not this tenant.`);
    }
    if (isPlaceholderHost(hrefHost)) {
      add(blockers, "BLOCKER", "placeholder_link", `Link uses placeholder host '${href}'.`);
    }
  }
  for (const broken of input.brokenSameHostPaths || []) {
    add(blockers, "BLOCKER", "broken_internal_link", `Internal destination '${broken}' does not resolve.`);
  }

  const campaignCanonicals = (input.campaignCanonicals || []).map(normalizeUrl).filter(Boolean);
  const selfCanonical = normalizeUrl(inspected.canonical);
  if (intendedIndexable && selfCanonical && campaignCanonicals.filter((item) => item === selfCanonical).length > 1) {
    add(blockers, "BLOCKER", "duplicate_canonical", "Another campaign page shares this canonical URL.");
  }

  const eligible = intendedIndexable && blockers.length === 0 && registered;
  return {
    version: TECHNICAL_SEO_CONTRACT_VERSION,
    slug,
    serviceId,
    pageType,
    registered,
    publicPath,
    pageUrl,
    canonical: inspected.canonical,
    authoritativeCanonical,
    intendedIndexable,
    eligible,
    httpStatus,
    title: inspected.title,
    metaDescription: inspected.metaDescription,
    robots: inspected.robots,
    h1: inspected.h1,
    schemaTypes: [...new Set(inspected.jsonLd.flatMap((block) => block.types))],
    blockers,
    recommendations,
    informational,
    inspected,
  };
}

export function isTechnicalSeoIndexEligible(result: TechnicalSeoIndexGateResult): boolean {
  return result.eligible;
}
