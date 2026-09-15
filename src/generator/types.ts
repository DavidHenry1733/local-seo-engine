import type { TemplateId } from "../templates/templateRegistry";

export type ServiceKey = "web_design" | "local_seo" | "website_hosting" | "local_business_visibility";

export type DeployConfig = {
  enabled: boolean;
  protocol: "ftp" | "sftp";
  host: string;
  port: number;
  remoteRoot: string;
  username?: string;
  password?: string;
};

export type NarrativeEngineConfig = {
  enabled: boolean;
  serviceKeys: string[];
  areas?: string[];
};

export type AreaProfile = {
  character: string;
  knownFor: string;
  businessType: string;
};

export type AreaConfig = {
  primaryCity: string;
  coreAreas: string[];
  priorityAreas: string[];
  areaProfiles?: Record<string, AreaProfile>;
};

export type NavLink = {
  label: string;
  href: string;
};

export type InternalLinkConfig = {
  /** Root-relative or absolute href, e.g. "/web-design-barnsley/" */
  href: string;
  /** Service key this page belongs to, e.g. "web_design" */
  service?: string;
  /** City / area name, e.g. "Barnsley" */
  location?: string;
  /** "hub" = main service+city page; "area" = sub-area cluster page */
  tier?: "hub" | "area";
};

export type InternalLinksConfig = {
  /** Full pool of pages eligible for internal linking. */
  links: InternalLinkConfig[];
  /** Optional sitewide contact / quote page to append as a low-priority link. */
  contactPage?: { href: string; anchor?: string };
};

export type ProjectConfig = {
  clientSlug: string;
  businessName: string;
  domain: string;
  phone: string;
  email: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  businessAddress: string;
  /** Template to use when generating pages for this project. Defaults to inboxingproweb_default. */
  templateId?: TemplateId;
  logoUrl?: string;
  strapline?: string;
  brandColour?: string;
  navItems?: NavLink[];
  footerCompanyName?: string;
  footerStrapline?: string;
  footerLinks?: NavLink[];
  footerServiceLinks?: NavLink[];
  privacyUrl?: string;
  termsUrl?: string;
  mapEmbedUrl?:        string;
  moneyPageUrl?:       string;
  moneyPageKeyword?:   string;
  parentCity?: string;
  branding: {
    primaryColor: string;
    accentColor: string;
  };
  services: Array<{
    key: ServiceKey;
    label: string;
  }>;
  locations: string[];
  areaConfig?: string;
  areaConfigs?: string[];
  deploy?: DeployConfig;
  narrativeEngine?: NarrativeEngineConfig;
  aiCitationOptimisation?: {
    enabled: boolean;
  };
  industryType?: string;
  buyerType?: "household" | "business" | "landlord-property" | "mixed";
  /** Pool of pages available for internal linking + contact page fallback. */
  internalLinks?: InternalLinksConfig;
};

/**
 * The legacy render path identifier used before the template registry.
 * Still accepted alongside the new TemplateId union so existing plan files
 * continue to work without migration.
 */
export type LegacyTemplate = "service-location-v1";

export type PagePlanItem = {
  serviceKey: ServiceKey;
  serviceLabel: string;
  location: string;
  slug: string;
  /** Template identifier — use a TemplateId from the registry. Legacy value "service-location-v1" also accepted. */
  template: TemplateId | LegacyTemplate;
  pageRole: "hub" | "area";
  hubSlug?: string;
  allAreaSlugs?: string[];
  siblingAreaSlugs?: string[];
  areaConfig?: AreaConfig;
};

export type ImageAssignment = {
  hero: string;
  support: string;
  conversion: string;
};

export type InternalLink = {
  href: string;
  label: string;
};

export type MapEmbed = {
  heading: string;
  body: string;
  query: string;
  embedUrl: string;
};

export type AreaCoverage = {
  heading: string;
  body: string;
  links: InternalLink[];
};

export type PagePayload = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  h1: string;
  intro: string;
  sections: Array<{
    id: string;
    heading: string;
    body: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  cta: {
    heading: string;
    body: string;
    buttonText: string;
    buttonUrl: string;
  };
  images: ImageAssignment;
  internalLinks: InternalLink[];
  areaCoverage?: AreaCoverage;
  mapEmbed: MapEmbed;
  schema: Record<string, unknown>[];
};
