/**
 * Content Engine Contract V1 — canonical generation context types.
 * Every generator MUST accept ContentGenerationContext as its only tenant/service input.
 */
import type { MasterLibrarySection, MasterOwnerVariables, ParsedMasterLibrary } from "../pharmacyMasterLibraryParser.ts";
import type { ServicePublishMeta } from "../pharmacyMasterPublishConfig.ts";
import type { PharmacyServicePageProfile } from "../pharmacyServicePageProfileContext.ts";
import type { PharmacyProfileData } from "../pharmacyProfileSchema.ts";
import type { ServiceVariantPack } from "../pharmacyServiceVariantLibrary.ts";
import type { BusinessProfileIntelligence } from "../businessProfileIntelligence/businessProfileIntelligenceTypes.ts";
import type { AreaDiscoverySnapshot, LocalMarketSnapshot } from "../pharmacyLocalMarketSnapshot.ts";
import type { LocalLocationHierarchy } from "../pharmacyLocalAreaResolver.ts";

export const CONTENT_ENGINE_CONTRACT_VERSION = "1.0.0" as const;

export type ContentVertical = "pharmacy" | "dentist" | "optician" | "solicitor" | "accountant" | "landscaper" | "restaurant" | "electrician" | string;

export interface ContentGenerationArea {
  areaName: string;
  areaSlug: string;
  selected: boolean;
  priority?: number;
  order?: number;
}

export interface ContentGenerationBrand {
  primaryColor: string;
  secondaryColor: string;
  ctaColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  fontHeading: string;
  fontBody: string;
  buttonRadius: string;
  cardRadius: string;
  logoUrl: string;
  headerLogoUrl: string;
  footerLogoUrl: string;
}

export interface ContentGenerationReviewer {
  name: string;
  role: string;
  qualifications: string;
  registrations: string;
  gphcNumber: string;
  experienceYears: string;
  bio: string;
  photoUrl: string;
  clinicalReviewDate: string;
  nextReviewDate: string;
}

export interface ContentGenerationCta {
  phone: string;
  email: string;
  website: string;
  bookingUrl: string;
  primaryCta: string;
  headerCtaText: string;
  headerCtaUrl: string;
  openingHours: string;
}

export interface ContentGenerationMap {
  latitude: string;
  longitude: string;
  googleMapsEmbedUrl: string;
  fullAddress: string;
  resolvedEmbedUrl: string;
}

export interface ContentGenerationLinks {
  mainServicePath: string;
  mainServicePreviewUrl: string;
  visualExperiencePath: string;
  visualExperiencePreviewUrl: string;
  ecosystemRoot: string;
  masterPublishPath: string;
  localClusterPaths: Record<string, string>;
  moneyLinks: Array<{ label: string; url: string }>;
}

export interface ContentGenerationImages {
  assignmentPath: string | null;
  assignmentsLoaded: boolean;
  slots: string[];
}

export interface ContentGenerationMasterLibrary {
  relativePath: string;
  absolutePath: string;
  parsed: ParsedMasterLibrary;
  sections: MasterLibrarySection[];
  faqs: Array<{ question: string; answer: string }>;
  ownerVariables: MasterOwnerVariables;
}

export interface ContentGenerationContext {
  contractVersion: typeof CONTENT_ENGINE_CONTRACT_VERSION;
  builtAt: string;
  vertical: ContentVertical;
  slug: string;
  resolvedSlug: string;
  serviceId: string;
  serviceName: string;
  serviceMeta: ServicePublishMeta;
  profile: PharmacyServicePageProfile;
  rawProfile: PharmacyProfileData;
  brand: ContentGenerationBrand;
  reviewer: ContentGenerationReviewer;
  cta: ContentGenerationCta;
  map: ContentGenerationMap;
  selectedAreas: ContentGenerationArea[];
  primaryTown: string;
  localArea: string;
  coverageAreas: string[];
  masterLibrary: ContentGenerationMasterLibrary;
  variantPack: ServiceVariantPack | null;
  links: ContentGenerationLinks;
  images: ContentGenerationImages;
  /** Tenant-specific token map for {{key}} replacement — no Brook/pharmaconnect fallbacks. */
  tokens: Record<string, string>;
  demoMode: boolean;
  /** Normalized Business Profile Intelligence — built once per context; long-form generator consumes first. */
  businessProfileIntelligence: BusinessProfileIntelligence;
  /** Frozen Local Market snapshot (healthcare providers, yourPharmacy coords). */
  localMarket: LocalMarketSnapshot | null;
  /** Campaign area discovery evidence for local page uniqueness. */
  areaDiscovery: AreaDiscoverySnapshot | null;
  /** Evidence-backed local hub / cluster / area hierarchy for generation. */
  localLocationHierarchy: LocalLocationHierarchy | null;
  /** CPR-12 — bound approved evidence, brand resolution audit, and section bundles. */
  tenantContext?: import("../pharmacyServicePageTenantContextService.ts").TenantContextBinding;
}

export interface ContentGenerationContextBuildOptions {
  localArea?: string;
  vertical?: ContentVertical;
  /** Campaign Builder frozen area selection — overrides profile area resolution. */
  selectedAreasOverride?: ContentGenerationArea[];
}
