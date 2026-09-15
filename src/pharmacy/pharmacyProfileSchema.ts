/**
 * Pharmacy Profile V2 — schema, normalization, and audit (read-only on generators).
 */
import {
  countCommunityEntities,
  countHealthcareEntities,
  mergeLocalIntelligenceIntoProfile,
  normalizeEntityList,
  type ProfileLocalEntity,
} from "./pharmacyProfileLocalIntelligenceSelection.ts";
import { syncOpeningHoursSummary } from "./pharmacyProfileHours.ts";
import { DEFAULT_BRANDING, DEFAULT_HEADER_NAV_LINKS } from "./pharmacyProfileDashboardConfig.ts";
import {
  collectServiceIdsFromProfile,
  defaultPharmacyProfileV2Extension,
  normalizePharmacyProfileV2Extension,
  type PharmacyProfileV2Extension,
} from "./pharmacyProfileV2Fields.ts";
import type { WebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import { normalizeWebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { CustomerVisibleWebsiteService } from "./growthEngineWebsiteImportCustomerVisibleServices.ts";

export interface ProfileNavLink {
  label: string;
  url: string;
  order: number;
  visible: boolean;
}

export interface ProfileFooterLink {
  label: string;
  url: string;
  order: number;
}

export interface ProfileAreaEntry {
  areaName: string;
  areaType?: string;
  priority: number;
  order: number;
  selected: boolean;
  source: string;
  confidence?: number;
  score?: number;
  tier?: string;
  postcode?: string;
  areaId?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  distanceLabel?: string;
  distanceMethod?: string;
  distanceProvenance?: Record<string, unknown>;
}

/** Wizard V2 competitor selection — stored on profile; not wired to generators. */
export interface ProfileWizardCompetitor {
  id: string;
  name: string;
  address: string;
  locality: string;
  rating: number | null;
  reviewCount: number;
  website: string;
  phone: string;
  placeId: string;
  distanceKm: number | null;
  distanceLabel: string;
  selected: boolean;
  notes: string;
  source: string;
}

export type CustomerSetupGoogleMatchStatus =
  | "none"
  | "confirmed"
  | "possible_match"
  | "not_found"
  | "rejected";

export interface CustomerSetupGoogleCandidate {
  placeId: string;
  businessName: string;
  address: string;
  postcode: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  primaryCategory: string;
  googleMapsUrl: string;
  distanceKm: number | null;
  distanceLabel: string;
  confidence: number;
}

export interface CustomerSetupGoogleListing {
  placeId: string;
  businessName: string;
  address: string;
  postcode: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  primaryCategory: string;
  openingHours: string[];
  googleMapsUrl: string;
  latitude: number | null;
  longitude: number | null;
  confirmedAt: string;
}

export type SetupImportSnapshotStatus =
  | "imported"
  | "not_found"
  | "needs_review"
  | "possible_match"
  | "branch_selection_required";

export interface GoogleImportSnapshot {
  status: SetupImportSnapshotStatus;
  importedAt: string;
  message: string;
  googleBusinessUrl: string;
  searchPharmacyName: string;
  searchTown: string;
  searchPostcode: string;
  placeId: string;
  businessName: string;
  address: string;
  town: string;
  postcode: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number;
  photoCount: number;
  categories: string[];
  openingHours: string[];
  googleMapsUrl: string;
  latitude: number | null;
  longitude: number | null;
  candidates: CustomerSetupGoogleCandidate[];
  nationalWebsiteDetected: boolean;
}

export interface SetupImportDebugRecord {
  at: string;
  receivedUrl: string;
  resolvedUrl: string;
  kgMid: string;
  qParameter: string;
  candidateCount: number;
  selectedPlaceId: string;
  possibleMatch: boolean;
  snapshotStatus: SetupImportSnapshotStatus | "";
  snapshotWritten: boolean;
  profilePath: string;
  message: string;
}

export interface WebsiteImportSnapshot {
  status: SetupImportSnapshotStatus;
  importedAt: string;
  message: string;
  websiteUrl: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  phone: string;
  email: string;
  address: string;
  town: string;
  postcode: string;
  socialLinks: string[];
  footerLinks: string[];
  servicesDetected: string[];
  /** Strict customer-facing services with direct website evidence (V1 accuracy). */
  customerVisibleServices: CustomerVisibleWebsiteService[];
  description: string;
  openingHours: string;
  intelligence: WebsiteIntelligenceImportV2 | null;
  regulatoryEvidence?: import("./pharmacyWebsiteRegulatoryEvidence.ts").WebsiteRegulatoryEvidence[];
}

export type CustomerSetupFieldSource = "google" | "website" | "manual";

export interface CustomerSetupAdminBaseline {
  pharmacyName: string;
  website: string;
  town: string;
  postcode: string;
  phone: string;
  email: string;
  adminNotes: string;
  platformClientStatus: string;
  capturedAt: string;
}

function normalizeNavLinks(raw: unknown): ProfileNavLink[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_HEADER_NAV_LINKS.map((l) => ({ ...l }));
  return raw
    .map((item, idx) => {
      const row = item as Record<string, unknown>;
      return {
        label: str(row.label) || `Link ${idx + 1}`,
        url: str(row.url) || "#",
        order: Number(row.order) || idx + 1,
        visible: row.visible !== false,
      };
    })
    .sort((a, b) => a.order - b.order);
}

function normalizeFooterLinks(raw: unknown): ProfileFooterLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      const row = item as Record<string, unknown>;
      return {
        label: str(row.label),
        url: str(row.url) || "#",
        order: Number(row.order) || idx + 1,
      };
    })
    .filter((l) => l.label)
    .sort((a, b) => a.order - b.order);
}

export type PharmacyCredentialKind = "demonstration" | "verified";
export type PharmacyCredentialVerificationStatus = "unverified" | "verified";

export interface PharmacyDisplayCredentials {
  kind: PharmacyCredentialKind;
  verificationStatus: PharmacyCredentialVerificationStatus;
  sourceUrl: string;
  superintendentPharmacistName: string;
  superintendentGphcNumber: string;
  premisesGphcNumber: string;
  allowedTenantSlug: string;
  allowedSurfaces: string[];
}

export interface PharmacyProfileData extends PharmacyProfileV2Extension {
  pharmacyName: string;
  tradingName: string;
  logoUrl: string;

  businessEmail: string;
  nhsEmail: string;
  phone: string;
  primaryContactName: string;
  website: string;
  bookingUrl: string;
  bookingMethod: string;
  /** @deprecated use businessEmail — kept for backward compatibility */
  email: string;

  gphcNumber: string;
  gphcPremisesUrl: string;
  nhsProfileUrl: string;
  /**
   * Preview-only display credentials. Demonstration/unverified values must never
   * be copied into gphcNumber, linked to the live GPhC register, or emitted as
   * production structured data.
   */
  displayCredentials?: PharmacyDisplayCredentials | null;
  superintendentPharmacistName: string;
  pharmacyOwnerName: string;
  companyName: string;
  companyRegistrationNumber: string;
  emergencyContact: string;
  country: string;
  /** Growth Engine campaign market scope — local/regional locality strategy vs national. */
  marketScope?: string;
  /** Campaign primary market label (national typically United Kingdom). */
  primaryMarket?: string;
  gphcNumberMarkedMissing: boolean;
  superintendentPharmacistNameMarkedMissing: boolean;
  nhsProfileUrlMarkedMissing: boolean;
  /** @deprecated use superintendentPharmacistName */
  superintendentName: string;
  googleBusinessProfileUrl: string;
  googleMapsEmbedUrl: string;
  googlePlaceId: string;
  latitude: string;
  longitude: string;

  yearsServingCommunity: string;
  independentPharmacy: boolean;
  consultationRoomAvailable: boolean;
  privateServicesAvailable: boolean;
  nhsServicesAvailable: boolean;
  homeDeliveryAvailable: boolean;
  languagesSpoken: string[];
  accreditations: string[];

  addressLine1: string;
  addressLine2: string;
  townCity: string;
  primaryTown: string;
  primaryCity: string;
  county: string;
  postcode: string;
  openingHours: string;
  displayAddress: string;
  displayOpeningHours: string;
  openingHoursMonday: string;
  openingHoursTuesday: string;
  openingHoursWednesday: string;
  openingHoursThursday: string;
  openingHoursFriday: string;
  openingHoursSaturday: string;
  openingHoursSunday: string;
  localAuthority: string;
  icb: string;
  nhsRegion: string;
  coverageRadius: string;
  rankingAreas: string[];
  nearbyAreas: string[];
  coverageAreas: string[];
  selectedAreas: ProfileAreaEntry[];
  manualAreas: string[];
  areaDiscoverySource: string;
  areaDiscoveryUpdatedAt: string;
  googleProfileOnboardingState?: string;
  primaryLocalityMeta?: Record<string, unknown>;
  onboardingIntakeCompletedAt?: string;
  localHierarchyRoot?: string;
  onboardingAreaDiscoveryRevision?: string;
  pendingOnboardingOpportunities?: Array<{ id: string; title: string; status: string; detail?: string }>;

  priorityServices: string[];
  targetPatientGroups: string[];
  uniqueSellingPoints: string[];
  patientQuestions: string[];
  preferredCta: string;
  primaryGrowthGoal: string;

  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandCtaColor: string;
  faviconUrl: string;
  brandAccentColor: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  brandMutedTextColor: string;
  brandHeaderBackgroundColor: string;
  brandHeaderTextColor: string;
  brandFooterBackgroundColor: string;
  brandFooterTextColor: string;
  brandFooterLinkColor: string;
  brandFooterAccentColor: string;
  fontHeading: string;
  fontBody: string;
  fontHeadingWeight: string;
  fontBodyWeight: string;
  fontH1Size: string;
  fontH2Size: string;
  fontH3Size: string;
  fontBodySize: string;
  buttonStyle: string;
  buttonRadius: string;
  cardRadius: string;
  imageStyle: string;
  pageStyle: string;

  headerLogoUrl: string;
  headerCtaText: string;
  headerCtaUrl: string;
  headerNavLinks: ProfileNavLink[];

  footerLogoUrl: string;
  footerText: string;
  footerCopyright: string;
  footerCompanyNumber: string;
  footerPrivacyPolicyUrl: string;
  footerCookiePolicyUrl: string;
  footerTermsUrl: string;
  footerLinks: ProfileFooterLink[];

  socialFacebook: string;
  socialInstagram: string;
  socialLinkedIn: string;
  socialX: string;
  socialYouTube: string;

  selectedServices: string[];
  prescriptionMethod: string;
  deliveryAvailable: string[];
  deliveryAreas: string[];
  facilities: string[];

  tone: string;
  primaryGoal: string;
  mainCompetitors: string[];
  rankingKeywords: string[];
  currentMarketingChallenges: string[];

  localLandmarks: string[];
  localGpSurgeries: string[];
  careHomesServed: string[];
  nearbyHealthCentres: string[];
  nearbyHospitals: string[];
  nearbySchools: string[];
  nearbyEmployers: string[];
  communityLinks: string[];
  localEvents: string[];

  localAreas: string[];
  localHealthcareLocations: string[];
  localGps: string[];
  localHospitals: string[];
  localDentists: string[];
  localPharmacies: string[];
  localCommunityLocations: string[];
  localSchools: string[];
  localCareHomes: string[];
  localTransportLinks: string[];
  localRetailCentres: string[];
  localResidentialAreas: string[];

  gpSurgeries: ProfileLocalEntity[];
  hospitals: ProfileLocalEntity[];
  healthCentres: ProfileLocalEntity[];
  careHomes: ProfileLocalEntity[];
  schools: ProfileLocalEntity[];
  majorEmployers: ProfileLocalEntity[];
  landmarks: ProfileLocalEntity[];
  communityFacilities: ProfileLocalEntity[];
  transportLinks: ProfileLocalEntity[];
  retailCentres: ProfileLocalEntity[];
  residentialAreas: ProfileLocalEntity[];
  localIntelligenceGenerated: boolean;
  localIntelligenceGeneratedAt: string;
  localIntelligenceCandidates: Record<string, ProfileLocalEntity[]>;

  reviewerName: string;
  reviewerRole: string;
  reviewerQualifications: string;
  reviewerProfessionalRegistrations: string;
  reviewerGphcNumber: string;
  reviewerExperienceYears: string;
  reviewerBio: string;
  reviewerSpecialisms: string[];
  reviewerSpecialInterests: string[];
  reviewerClinicalInterests: string[];
  reviewerPhoto: string;
  reviewerSignature: string;
  clinicalReviewDate: string;
  nextReviewDate: string;

  demoMode: boolean;
  trustDataStatus: string;
  /** Admin Client Creation V1 — setup_required until pharmacy completes onboarding. */
  platformClientStatus: string;
  /** Internal admin notes — not shown on customer-facing pages. */
  adminNotes: string;

  /** Website analysis metadata — populated by Analyse Existing Website workflow. */
  websiteAnalysisAt: string;
  websiteAnalysisSourceUrl: string;
  detectedWebsiteServices: { serviceId: string; serviceName: string; confidence: number }[];

  /** Wizard resume — optional; backwards compatible. */
  profileWizardStep: number;
  profileWizardUpdatedAt: string;

  /** Wizard V2 — Google Business rating when resolved from Places. */
  googleBusinessRating: number | null;
  googleBusinessReviewCount: number;
  /** Wizard V2 — nearby pharmacy competitors (display/selection only). */
  profileCompetitors: ProfileWizardCompetitor[];
  competitorReviewConfirmed: boolean;
  profileCompetitorsReviewed: boolean;
  profileCompetitorsReviewedAt: string;
  profileWizardEnrichedAt: string;
  /** Sprint 1 BI — field keys last applied from website import. */
  websiteImportedFieldKeys: string[];
  /** Sprint 1 BI — owner-confirmed field keys (ISO timestamp per key). */
  profileFieldConfirmations: Record<string, string>;

  /** Customer setup — Google listing match (Step 1/2 only). */
  customerSetupGoogleMatchStatus: CustomerSetupGoogleMatchStatus;
  customerSetupGoogleCandidates: CustomerSetupGoogleCandidate[];
  customerSetupGoogleListing: CustomerSetupGoogleListing | null;
  customerSetupNationalWebsiteDetected: boolean;
  /** Field keys applied from confirmed Google listing — separate from website import. */
  googleImportedFieldKeys: string[];

  /** Customer setup — isolated import snapshots (Step 1/2 only). */
  googleImportSnapshot: GoogleImportSnapshot | null;
  websiteImportSnapshot: WebsiteImportSnapshot | null;
  /** CPR-RESET-04 — multi-location branch resolution state. */
  websiteBranchResolution: import("./masterAdminWebsiteBranchResolutionModel.ts").WebsiteBranchResolution | null;
  /** Last setup import debug trace (Step 1 POST only). */
  lastGoogleImportDebug: SetupImportDebugRecord | null;
  lastWebsiteImportDebug: SetupImportDebugRecord | null;
  customerSetupFieldSources: Record<string, CustomerSetupFieldSource>;
  /** Admin-entered identity preserved across import resets. */
  customerSetupAdminBaseline: CustomerSetupAdminBaseline | null;
}

export interface PharmacyProfileDoc {
  slug: string;
  updatedAt: string;
  version?: number;
  demoMode?: boolean;
  trustDataStatus?: string;
  data: PharmacyProfileData;
}

export interface ProfileAuditCheck {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  message: string;
}

export interface ProfileAuditResult {
  slug: string;
  auditedAt: string;
  passed: boolean;
  score: number;
  requiredPassed: number;
  requiredTotal: number;
  checks: ProfileAuditCheck[];
  recommendations: string[];
  demoMode: boolean;
  trustDataStatus: string;
  dataClassification: "DEMO DATA" | "LIVE PROFILE";
  warnings: string[];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function dateOnly(v: unknown): string {
  const raw = str(v);
  if (!raw) return "";
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
}

function hexColorOrEmpty(v: unknown): string {
  const s = str(v);
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : "";
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === true) return true;
  if (v === "false" || v === false) return false;
  if (Array.isArray(v) && v.length) return true;
  return fallback;
}

export function normalizeDisplayCredentials(raw: unknown): PharmacyDisplayCredentials | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const kindRaw = str(item.kind).toLowerCase();
  const statusRaw = str(item.verificationStatus).toLowerCase();
  const kind: PharmacyCredentialKind | "" =
    kindRaw === "demonstration" || kindRaw === "verified" ? kindRaw : "";
  const verificationStatus: PharmacyCredentialVerificationStatus | "" =
    statusRaw === "unverified" || statusRaw === "verified" ? statusRaw : "";
  if (!kind || !verificationStatus) return null;
  const demonstration = kind === "demonstration" || verificationStatus === "unverified";
  const superintendentPharmacistName = str(item.superintendentPharmacistName);
  const superintendentGphcNumber = str(item.superintendentGphcNumber);
  const premisesGphcNumber = str(item.premisesGphcNumber);
  if (!superintendentPharmacistName && !superintendentGphcNumber && !premisesGphcNumber) return null;
  return {
    kind: demonstration ? "demonstration" : "verified",
    verificationStatus: demonstration ? "unverified" : "verified",
    sourceUrl: str(item.sourceUrl),
    superintendentPharmacistName,
    superintendentGphcNumber,
    premisesGphcNumber,
    allowedTenantSlug: str(item.allowedTenantSlug).toLowerCase(),
    allowedSurfaces: strArray(item.allowedSurfaces).map((surface) => surface.toLowerCase()),
  };
}

export const PROFILE_SCHEMA_VERSION = 5;

function syncProfileAreaFields(data: PharmacyProfileData): PharmacyProfileData {
  const merged = [...(data.selectedAreas || [])];
  const byName = new Map<string, ProfileAreaEntry>();
  for (const entry of merged) {
    if (entry?.areaName) byName.set(entry.areaName.toLowerCase(), entry);
  }
  const entries = [...byName.values()].sort((a, b) => a.order - b.order || a.priority - b.priority);
  const selectedNames = entries.filter((a) => a.selected).map((a) => a.areaName);
  const allNames = entries.map((a) => a.areaName).filter(Boolean);
  const manualNames = (data.manualAreas || []).filter(Boolean);
  const coverageAreas = [...new Set([...selectedNames, ...manualNames])];
  const rankingAreas = selectedNames.length ? selectedNames : data.rankingAreas.length ? data.rankingAreas : coverageAreas;
  const nearbyAreas = allNames.length ? [...new Set([...allNames, ...manualNames])] : data.nearbyAreas;

  return {
    ...data,
    selectedAreas: entries,
    coverageAreas: coverageAreas.length ? coverageAreas : data.coverageAreas,
    rankingAreas: rankingAreas.length ? rankingAreas : data.rankingAreas,
    nearbyAreas: nearbyAreas.length ? nearbyAreas : data.nearbyAreas,
    primaryTown: data.primaryTown || data.primaryCity || data.townCity,
    primaryCity: data.primaryCity || data.primaryTown || data.townCity,
    townCity: data.townCity || data.primaryTown || data.primaryCity,
  };
}

function normalizeAreaEntries(raw: unknown): ProfileAreaEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      const row = item as Record<string, unknown>;
      const areaName = str(row.areaName);
      if (!areaName) return null;
      return {
        areaName,
        areaType: str(row.areaType),
        priority: Number(row.priority) || idx + 1,
        order: Number(row.order) || idx + 1,
        selected: row.selected !== false,
        source: str(row.source) || "profile",
        confidence: row.confidence != null ? Number(row.confidence) : undefined,
        score: row.score != null ? Number(row.score) : undefined,
        tier: str(row.tier),
        postcode: str(row.postcode),
        areaId: str(row.areaId) || undefined,
        latitude: row.latitude == null || row.latitude === "" ? undefined : Number(row.latitude),
        longitude: row.longitude == null || row.longitude === "" ? undefined : Number(row.longitude),
        distanceKm: row.distanceKm == null || row.distanceKm === "" ? undefined : Number(row.distanceKm),
        distanceLabel: str(row.distanceLabel) || undefined,
        distanceMethod: str(row.distanceMethod) || undefined,
        distanceProvenance: row.distanceProvenance && typeof row.distanceProvenance === "object"
          ? (row.distanceProvenance as Record<string, unknown>)
          : undefined,
      } satisfies ProfileAreaEntry;
    })
    .filter(Boolean) as ProfileAreaEntry[];
}

export function defaultProfileData(): PharmacyProfileData {
  return {
    pharmacyName: "",
    tradingName: "",
    logoUrl: "",
    businessEmail: "",
    nhsEmail: "",
    phone: "",
    primaryContactName: "",
    website: "",
    bookingUrl: "",
    bookingMethod: "",
    email: "",
    gphcNumber: "",
    gphcPremisesUrl: "",
    nhsProfileUrl: "",
    displayCredentials: null,
    superintendentPharmacistName: "",
    pharmacyOwnerName: "",
    companyName: "",
    companyRegistrationNumber: "",
    emergencyContact: "",
    country: "United Kingdom",
    marketScope: "",
    primaryMarket: "",
    gphcNumberMarkedMissing: false,
    superintendentPharmacistNameMarkedMissing: false,
    nhsProfileUrlMarkedMissing: false,
    superintendentName: "",
    googleBusinessProfileUrl: "",
    googleMapsEmbedUrl: "",
    googlePlaceId: "",
    latitude: "",
    longitude: "",
    yearsServingCommunity: "",
    independentPharmacy: false,
    consultationRoomAvailable: false,
    privateServicesAvailable: false,
    nhsServicesAvailable: false,
    homeDeliveryAvailable: false,
    languagesSpoken: [],
    accreditations: [],
    addressLine1: "",
    addressLine2: "",
    townCity: "",
    primaryTown: "",
    primaryCity: "",
    county: "",
    postcode: "",
    openingHours: "",
    displayAddress: "",
    displayOpeningHours: "",
    openingHoursMonday: "",
    openingHoursTuesday: "",
    openingHoursWednesday: "",
    openingHoursThursday: "",
    openingHoursFriday: "",
    openingHoursSaturday: "",
    openingHoursSunday: "",
    localAuthority: "",
    icb: "",
    nhsRegion: "",
    coverageRadius: "",
    rankingAreas: [],
    nearbyAreas: [],
    coverageAreas: [],
    selectedAreas: [],
    manualAreas: [],
    areaDiscoverySource: "",
    areaDiscoveryUpdatedAt: "",
    priorityServices: [],
    targetPatientGroups: [],
    uniqueSellingPoints: [],
    patientQuestions: [],
    preferredCta: "",
    primaryGrowthGoal: "",
    brandPrimaryColor: DEFAULT_BRANDING.brandPrimaryColor,
    brandSecondaryColor: DEFAULT_BRANDING.brandSecondaryColor,
    brandCtaColor: DEFAULT_BRANDING.brandCtaColor,
    faviconUrl: "",
    brandAccentColor: DEFAULT_BRANDING.brandAccentColor,
    brandBackgroundColor: DEFAULT_BRANDING.brandBackgroundColor,
    brandTextColor: DEFAULT_BRANDING.brandTextColor,
    brandMutedTextColor: DEFAULT_BRANDING.brandMutedTextColor,
    brandHeaderBackgroundColor: DEFAULT_BRANDING.brandHeaderBackgroundColor,
    brandHeaderTextColor: DEFAULT_BRANDING.brandHeaderTextColor,
    brandFooterBackgroundColor: DEFAULT_BRANDING.brandFooterBackgroundColor,
    brandFooterTextColor: DEFAULT_BRANDING.brandFooterTextColor,
    brandFooterLinkColor: DEFAULT_BRANDING.brandFooterLinkColor,
    brandFooterAccentColor: DEFAULT_BRANDING.brandFooterAccentColor,
    fontHeading: DEFAULT_BRANDING.fontHeading,
    fontBody: DEFAULT_BRANDING.fontBody,
    fontHeadingWeight: DEFAULT_BRANDING.fontHeadingWeight,
    fontBodyWeight: DEFAULT_BRANDING.fontBodyWeight,
    fontH1Size: DEFAULT_BRANDING.fontH1Size,
    fontH2Size: DEFAULT_BRANDING.fontH2Size,
    fontH3Size: DEFAULT_BRANDING.fontH3Size,
    fontBodySize: DEFAULT_BRANDING.fontBodySize,
    buttonStyle: DEFAULT_BRANDING.buttonStyle,
    buttonRadius: DEFAULT_BRANDING.buttonRadius,
    cardRadius: DEFAULT_BRANDING.cardRadius,
    imageStyle: DEFAULT_BRANDING.imageStyle,
    pageStyle: DEFAULT_BRANDING.pageStyle,
    headerLogoUrl: "",
    headerCtaText: "",
    headerCtaUrl: "",
    headerNavLinks: DEFAULT_HEADER_NAV_LINKS.map((l) => ({ ...l })),
    footerLogoUrl: "",
    footerText: "",
    footerCopyright: "",
    footerCompanyNumber: "",
    footerPrivacyPolicyUrl: "",
    footerCookiePolicyUrl: "",
    footerTermsUrl: "",
    footerLinks: [],
    socialFacebook: "",
    socialInstagram: "",
    socialLinkedIn: "",
    socialX: "",
    socialYouTube: "",
    selectedServices: [],
    prescriptionMethod: "",
    deliveryAvailable: [],
    deliveryAreas: [],
    facilities: [],
    tone: "",
    primaryGoal: "",
    mainCompetitors: [],
    rankingKeywords: [],
    currentMarketingChallenges: [],
    localLandmarks: [],
    localGpSurgeries: [],
    careHomesServed: [],
    nearbyHealthCentres: [],
    nearbyHospitals: [],
    nearbySchools: [],
    nearbyEmployers: [],
    communityLinks: [],
    localEvents: [],
    localAreas: [],
    localHealthcareLocations: [],
    localGps: [],
    localHospitals: [],
    localDentists: [],
    localPharmacies: [],
    localCommunityLocations: [],
    localSchools: [],
    localCareHomes: [],
    localTransportLinks: [],
    localRetailCentres: [],
    localResidentialAreas: [],
    gpSurgeries: [],
    hospitals: [],
    healthCentres: [],
    careHomes: [],
    schools: [],
    majorEmployers: [],
    landmarks: [],
    communityFacilities: [],
    transportLinks: [],
    retailCentres: [],
    residentialAreas: [],
    localIntelligenceGenerated: false,
    localIntelligenceGeneratedAt: "",
    localIntelligenceCandidates: {},
    reviewerName: "",
    reviewerRole: "",
    reviewerQualifications: "",
    reviewerProfessionalRegistrations: "",
    reviewerGphcNumber: "",
    reviewerExperienceYears: "",
    reviewerBio: "",
    reviewerSpecialisms: [],
    reviewerSpecialInterests: [],
    reviewerClinicalInterests: [],
    reviewerPhoto: "",
    reviewerSignature: "",
    clinicalReviewDate: "",
    nextReviewDate: "",
    demoMode: false,
    trustDataStatus: "",
    platformClientStatus: "",
    adminNotes: "",
    websiteAnalysisAt: "",
    websiteAnalysisSourceUrl: "",
    detectedWebsiteServices: [],
    profileWizardStep: 1,
    profileWizardUpdatedAt: "",
    googleBusinessRating: null,
    googleBusinessReviewCount: 0,
    profileCompetitors: [],
    competitorReviewConfirmed: false,
    profileCompetitorsReviewed: false,
    profileCompetitorsReviewedAt: "",
    profileWizardEnrichedAt: "",
    websiteImportedFieldKeys: [],
    profileFieldConfirmations: {},
    customerSetupGoogleMatchStatus: "none",
    customerSetupGoogleCandidates: [],
    customerSetupGoogleListing: null,
    customerSetupNationalWebsiteDetected: false,
    googleImportedFieldKeys: [],
    googleImportSnapshot: null,
    websiteImportSnapshot: null,
    websiteBranchResolution: null,
    lastGoogleImportDebug: null,
    lastWebsiteImportDebug: null,
    customerSetupFieldSources: {},
    customerSetupAdminBaseline: null,
    ...defaultPharmacyProfileV2Extension(),
  };
}

function normalizeProfileCompetitors(raw: unknown): ProfileWizardCompetitor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      const item = row as Record<string, unknown>;
      const name = str(item.name);
      if (!name) return null;
      const ratingRaw = item.rating;
      const rating =
        ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
          ? null
          : Math.min(5, Math.max(0, Number(ratingRaw) || 0));
      return {
        id: str(item.id) || str(item.placeId) || `competitor-${i + 1}`,
        name,
        address: str(item.address),
        locality: str(item.locality),
        rating,
        reviewCount: Math.max(0, Number(item.reviewCount) || 0),
        website: str(item.website),
        phone: str(item.phone),
        placeId: str(item.placeId),
        distanceKm: item.distanceKm != null && item.distanceKm !== "" ? Number(item.distanceKm) : null,
        distanceLabel: str(item.distanceLabel),
        selected: item.selected !== false,
        notes: str(item.notes),
        source: str(item.source) || "google-places",
      } satisfies ProfileWizardCompetitor;
    })
    .filter(Boolean) as ProfileWizardCompetitor[];
}

function normalizeCustomerSetupGoogleCandidates(raw: unknown): CustomerSetupGoogleCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const placeId = str(item.placeId);
      if (!placeId) return null;
      const ratingRaw = item.rating;
      const rating =
        ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
          ? null
          : Math.min(5, Math.max(0, Number(ratingRaw) || 0));
      return {
        placeId,
        businessName: str(item.businessName),
        address: str(item.address),
        postcode: str(item.postcode),
        phone: str(item.phone),
        website: str(item.website),
        rating,
        reviewCount: Math.max(0, Number(item.reviewCount) || 0),
        photoCount: Math.max(0, Number(item.photoCount) || 0),
        primaryCategory: str(item.primaryCategory),
        googleMapsUrl: str(item.googleMapsUrl),
        distanceKm: item.distanceKm != null && item.distanceKm !== "" ? Number(item.distanceKm) : null,
        distanceLabel: str(item.distanceLabel) || "—",
        confidence: Math.min(100, Math.max(0, Number(item.confidence) || 0)),
      } satisfies CustomerSetupGoogleCandidate;
    })
    .filter(Boolean) as CustomerSetupGoogleCandidate[];
}

function normalizeCustomerSetupGoogleListing(raw: unknown): CustomerSetupGoogleListing | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const placeId = str(item.placeId);
  if (!placeId) return null;
  const ratingRaw = item.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
      ? null
      : Math.min(5, Math.max(0, Number(ratingRaw) || 0));
  return {
    placeId,
    businessName: str(item.businessName),
    address: str(item.address),
    postcode: str(item.postcode),
    phone: str(item.phone),
    website: str(item.website),
    rating,
    reviewCount: Math.max(0, Number(item.reviewCount) || 0),
    photoCount: Math.max(0, Number(item.photoCount) || 0),
    primaryCategory: str(item.primaryCategory),
    openingHours: strArray(item.openingHours),
    googleMapsUrl: str(item.googleMapsUrl),
    latitude: item.latitude != null && item.latitude !== "" ? Number(item.latitude) : null,
    longitude: item.longitude != null && item.longitude !== "" ? Number(item.longitude) : null,
    confirmedAt: str(item.confirmedAt),
  };
}

function normalizeGoogleMatchStatus(raw: unknown): CustomerSetupGoogleMatchStatus {
  const v = str(raw);
  if (v === "confirmed" || v === "possible_match" || v === "not_found" || v === "rejected") return v;
  return "none";
}

function normalizeSetupImportStatus(raw: unknown): SetupImportSnapshotStatus {
  const v = str(raw);
  if (
    v === "imported" ||
    v === "not_found" ||
    v === "needs_review" ||
    v === "possible_match" ||
    v === "branch_selection_required"
  ) {
    return v;
  }
  return "not_found";
}

function normalizeSetupImportDebugRecord(raw: unknown): SetupImportDebugRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const statusRaw = str(item.snapshotStatus);
  const snapshotStatus =
    statusRaw === "imported" ||
    statusRaw === "not_found" ||
    statusRaw === "needs_review" ||
    statusRaw === "possible_match" ||
    statusRaw === "branch_selection_required"
      ? statusRaw
      : "";
  return {
    at: str(item.at),
    receivedUrl: str(item.receivedUrl),
    resolvedUrl: str(item.resolvedUrl),
    kgMid: str(item.kgMid),
    qParameter: str(item.qParameter),
    candidateCount: Math.max(0, Number(item.candidateCount) || 0),
    selectedPlaceId: str(item.selectedPlaceId),
    possibleMatch: bool(item.possibleMatch),
    snapshotStatus,
    snapshotWritten: bool(item.snapshotWritten),
    profilePath: str(item.profilePath),
    message: str(item.message),
  };
}

function normalizeGoogleImportSnapshot(raw: unknown): GoogleImportSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const ratingRaw = item.rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined || ratingRaw === ""
      ? null
      : Math.min(5, Math.max(0, Number(ratingRaw) || 0));
  return {
    status: normalizeSetupImportStatus(item.status),
    importedAt: str(item.importedAt),
    message: str(item.message),
    googleBusinessUrl: str(item.googleBusinessUrl),
    searchPharmacyName: str(item.searchPharmacyName),
    searchTown: str(item.searchTown),
    searchPostcode: str(item.searchPostcode),
    placeId: str(item.placeId),
    businessName: str(item.businessName),
    address: str(item.address),
    town: str(item.town),
    postcode: str(item.postcode),
    phone: str(item.phone),
    website: str(item.website),
    rating,
    reviewCount: Math.max(0, Number(item.reviewCount) || 0),
    photoCount: Math.max(0, Number(item.photoCount) || 0),
    categories: strArray(item.categories),
    openingHours: strArray(item.openingHours),
    googleMapsUrl: str(item.googleMapsUrl),
    latitude: item.latitude != null && item.latitude !== "" ? Number(item.latitude) : null,
    longitude: item.longitude != null && item.longitude !== "" ? Number(item.longitude) : null,
    candidates: normalizeCustomerSetupGoogleCandidates(item.candidates),
    nationalWebsiteDetected: bool(item.nationalWebsiteDetected),
  };
}

function normalizeCustomerVisibleServices(raw: unknown): CustomerVisibleWebsiteService[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const serviceName = str(item.serviceName);
      if (!serviceName) return null;
      return {
        serviceId: str(item.serviceId),
        serviceName,
        sourceUrl: str(item.sourceUrl),
        matchedSnippet: str(item.matchedSnippet),
        detectionMethod: str(item.detectionMethod),
        confidence: Number(item.confidence) || 0,
      };
    })
    .filter(Boolean) as CustomerVisibleWebsiteService[];
}

function normalizeWebsiteBranchResolution(
  raw: unknown,
): import("./masterAdminWebsiteBranchResolutionModel.ts").WebsiteBranchResolution | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const statusRaw = str(item.status);
  const status =
    statusRaw === "none" ||
    statusRaw === "branch_selection_required" ||
    statusRaw === "branch_selected" ||
    statusRaw === "none_of_these_branches"
      ? statusRaw
      : "none";
  const parent = (item.parentBrand || {}) as Record<string, unknown>;
  const branches = Array.isArray(item.detectedBranches) ? item.detectedBranches : [];
  const selected = (item.selectedBranch || null) as Record<string, unknown> | null;
  const normalizeBranch = (row: unknown) => {
    const b = row as Record<string, unknown>;
    return {
      branchId: str(b.branchId),
      branchName: str(b.branchName),
      parentBrandName: str(b.parentBrandName),
      addressLine1: str(b.addressLine1),
      addressLine2: str(b.addressLine2),
      town: str(b.town),
      postcode: str(b.postcode),
      phone: str(b.phone),
      email: str(b.email),
      branchUrl: str(b.branchUrl),
      logoUrl: str(b.logoUrl),
      openingHours: str(b.openingHours),
      services: strArray(b.services),
      googlePlaceId: str(b.googlePlaceId) || null,
      googleBusinessName: str(b.googleBusinessName) || null,
      googleAddress: str(b.googleAddress) || null,
      googleMatchConfidence: b.googleMatchConfidence == null ? null : Number(b.googleMatchConfidence) || null,
      evidenceSources: Array.isArray(b.evidenceSources)
        ? (b.evidenceSources as Array<Record<string, unknown>>).map((s) => ({
            sourceUrl: str(s.sourceUrl),
            detectionMethod: str(s.detectionMethod),
          }))
        : [],
      detectionSignals: strArray(b.detectionSignals),
    };
  };
  return {
    status,
    detectedAt: str(item.detectedAt),
    selectedAt: str(item.selectedAt) || null,
    selectedBy: str(item.selectedBy) || null,
    parentBrand: {
      tradingName: str(parent.tradingName),
      parentWebsite: str(parent.parentWebsite),
      logoUrl: str(parent.logoUrl),
      brandPrimaryColor: hexColorOrEmpty(parent.brandPrimaryColor),
      brandSecondaryColor: hexColorOrEmpty(parent.brandSecondaryColor),
      brandAccentColor: hexColorOrEmpty(parent.brandAccentColor),
    },
    detectedBranches: branches.map(normalizeBranch),
    selectedBranchId: str(item.selectedBranchId) || null,
    selectedBranch: selected ? normalizeBranch(selected) : null,
    rawImportPreserved: bool(item.rawImportPreserved),
    googleBranchMatchStatus:
      item.googleBranchMatchStatus === "matched" ||
      item.googleBranchMatchStatus === "mismatch" ||
      item.googleBranchMatchStatus === "pending" ||
      item.googleBranchMatchStatus === "none"
        ? item.googleBranchMatchStatus
        : "none",
    googleBranchMatchNotes: strArray(item.googleBranchMatchNotes),
  };
}

function normalizeWebsiteImportSnapshot(raw: unknown): WebsiteImportSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  return {
    status: normalizeSetupImportStatus(item.status),
    importedAt: str(item.importedAt),
    message: str(item.message),
    websiteUrl: str(item.websiteUrl),
    logoUrl: str(item.logoUrl),
    brandPrimaryColor: hexColorOrEmpty(item.brandPrimaryColor),
    brandSecondaryColor: hexColorOrEmpty(item.brandSecondaryColor),
    brandAccentColor: hexColorOrEmpty(item.brandAccentColor),
    brandBackgroundColor: hexColorOrEmpty(item.brandBackgroundColor),
    brandTextColor: hexColorOrEmpty(item.brandTextColor),
    phone: str(item.phone),
    email: str(item.email),
    address: str(item.address),
    town: str(item.town),
    postcode: str(item.postcode),
    socialLinks: strArray(item.socialLinks),
    footerLinks: strArray(item.footerLinks),
    servicesDetected: strArray(item.servicesDetected),
    customerVisibleServices: normalizeCustomerVisibleServices(item.customerVisibleServices),
    description: str(item.description),
    openingHours: str(item.openingHours),
    intelligence: normalizeWebsiteIntelligenceImportV2(item.intelligence),
    regulatoryEvidence: normalizeWebsiteRegulatoryEvidence(item.regulatoryEvidence),
  };
}

function normalizeWebsiteRegulatoryEvidence(raw: unknown): import("./pharmacyWebsiteRegulatoryEvidence.ts").WebsiteRegulatoryEvidence[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const detectedValue = str(item.detectedValue);
      if (!detectedValue) return null;
      return {
        type: (str(item.type) || "gphc-premises") as import("./pharmacyWebsiteRegulatoryEvidence.ts").WebsiteRegulatoryEvidenceType,
        detectedValue,
        sourceUrl: str(item.sourceUrl),
        sourceSelector: str(item.sourceSelector),
        sourceContext: str(item.sourceContext),
        extractionMethod: str(item.extractionMethod) || "footer-text-pattern",
        confidence: Number(item.confidence) || 0,
        importedAt: str(item.importedAt),
        verificationStatus:
          (str(item.verificationStatus) as import("./pharmacyWebsiteRegulatoryEvidence.ts").WebsiteRegulatoryVerificationStatus) ||
          "customer-confirmation-required",
      };
    })
    .filter(Boolean) as import("./pharmacyWebsiteRegulatoryEvidence.ts").WebsiteRegulatoryEvidence[];
}

function normalizeCustomerSetupFieldSources(raw: unknown): Record<string, CustomerSetupFieldSource> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, CustomerSetupFieldSource> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = str(value);
    if (v === "google" || v === "website" || v === "manual") out[key] = v;
  }
  return out;
}

function normalizeCustomerSetupAdminBaseline(raw: unknown): CustomerSetupAdminBaseline | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const pharmacyName = str(item.pharmacyName);
  if (!pharmacyName) return null;
  return {
    pharmacyName,
    website: str(item.website),
    town: str(item.town),
    postcode: str(item.postcode),
    phone: str(item.phone),
    email: str(item.email),
    adminNotes: str(item.adminNotes),
    platformClientStatus: str(item.platformClientStatus) || "setup_required",
    capturedAt: str(item.capturedAt),
  };
}

export function normalizeProfileData(raw: Record<string, unknown> = {}): PharmacyProfileData {
  const base = defaultProfileData();
  const merged = mergeLocalIntelligenceIntoProfile({ ...base, ...raw }) as Record<string, unknown>;

  const businessEmail = str(merged.businessEmail) || str(merged.email);
  const phone =
    str(merged.phone) ||
    str(merged.telephone) ||
    str(merged.phoneNumber) ||
    str(merged.businessPhone) ||
    str(merged.contactPhone);
  const superintendentPharmacistName =
    str(merged.superintendentPharmacistName) || str(merged.superintendentName);

  const deliveryArr = strArray(merged.deliveryAvailable);
  const homeDeliveryAvailable =
    bool(merged.homeDeliveryAvailable) ||
    deliveryArr.some((d) => /delivery/i.test(d)) ||
    strArray(merged.deliveryAreas).length > 0;

  const facilities = strArray(merged.facilities);
  const consultationRoomAvailable =
    bool(merged.consultationRoomAvailable) ||
    facilities.some((f) => /consultation room|private consultation/i.test(f));

  const dayHours = {
    openingHoursMonday: str(merged.openingHoursMonday),
    openingHoursTuesday: str(merged.openingHoursTuesday),
    openingHoursWednesday: str(merged.openingHoursWednesday),
    openingHoursThursday: str(merged.openingHoursThursday),
    openingHoursFriday: str(merged.openingHoursFriday),
    openingHoursSaturday: str(merged.openingHoursSaturday),
    openingHoursSunday: str(merged.openingHoursSunday),
  };
  const openingHours = syncOpeningHoursSummary({ ...merged, ...dayHours }) || str(merged.openingHours);

  const primaryTown = str(merged.primaryTown) || str(merged.primaryCity) || str(merged.townCity);
  const primaryCity = str(merged.primaryCity) || str(merged.primaryTown) || str(merged.townCity);
  const townCity = str(merged.townCity) || primaryTown;

  const serviceIds = collectServiceIdsFromProfile(merged);
  const v2 = normalizePharmacyProfileV2Extension(merged, serviceIds);

  const normalized = {
    ...base,
    ...v2,
    pharmacyName: str(merged.pharmacyName),
    tradingName: str(merged.tradingName),
    logoUrl: str(merged.logoUrl),
    businessEmail,
    nhsEmail: str(merged.nhsEmail),
    phone,
    primaryContactName: str(merged.primaryContactName),
    website: str(merged.website),
    bookingUrl: str(merged.bookingUrl),
    bookingMethod: str(merged.bookingMethod),
    email: businessEmail,
    onlineBookingAvailable:
      "onlineBookingAvailable" in merged
        ? bool(merged.onlineBookingAvailable)
        : Boolean(str(merged.bookingUrl)),
    gphcNumber: str(merged.gphcNumber),
    gphcPremisesUrl: str(merged.gphcPremisesUrl),
    nhsProfileUrl: str(merged.nhsProfileUrl),
    displayCredentials: normalizeDisplayCredentials(merged.displayCredentials),
    superintendentPharmacistName,
    pharmacyOwnerName: str(merged.pharmacyOwnerName),
    companyName: str(merged.companyName),
    companyRegistrationNumber: str(merged.companyRegistrationNumber),
    emergencyContact: str(merged.emergencyContact),
    country: str(merged.country) || "United Kingdom",
    marketScope: str(merged.marketScope),
    primaryMarket: str(merged.primaryMarket),
    gphcNumberMarkedMissing: bool(merged.gphcNumberMarkedMissing),
    superintendentPharmacistNameMarkedMissing: bool(merged.superintendentPharmacistNameMarkedMissing),
    nhsProfileUrlMarkedMissing: bool(merged.nhsProfileUrlMarkedMissing),
    superintendentName: superintendentPharmacistName,
    googleBusinessProfileUrl: str(merged.googleBusinessProfileUrl),
    googleMapsEmbedUrl: str(merged.googleMapsEmbedUrl),
    googlePlaceId: str(merged.googlePlaceId),
    latitude: str(merged.latitude),
    longitude: str(merged.longitude),
    yearsServingCommunity: str(merged.yearsServingCommunity),
    independentPharmacy: bool(merged.independentPharmacy),
    consultationRoomAvailable,
    privateServicesAvailable: bool(merged.privateServicesAvailable),
    nhsServicesAvailable:
      "nhsServicesAvailable" in raw ? bool(merged.nhsServicesAvailable) : true,
    homeDeliveryAvailable,
    languagesSpoken: strArray(merged.languagesSpoken),
    accreditations: strArray(merged.accreditations),
    addressLine1: str(merged.addressLine1),
    addressLine2: str(merged.addressLine2),
    townCity,
    primaryTown,
    primaryCity,
    county: str(merged.county),
    postcode: str(merged.postcode),
    openingHours,
    displayAddress: str(merged.displayAddress),
    displayOpeningHours: str(merged.displayOpeningHours),
    ...dayHours,
    localAuthority: str(merged.localAuthority),
    icb: str(merged.icb),
    nhsRegion: str(merged.nhsRegion),
    coverageRadius: str(merged.coverageRadius),
    rankingAreas: strArray(merged.rankingAreas),
    nearbyAreas: strArray(merged.nearbyAreas),
    coverageAreas: strArray(merged.coverageAreas),
    selectedAreas: normalizeAreaEntries(merged.selectedAreas),
    manualAreas: strArray(merged.manualAreas),
    areaDiscoverySource: str(merged.areaDiscoverySource),
    areaDiscoveryUpdatedAt: str(merged.areaDiscoveryUpdatedAt),
    googleProfileOnboardingState: str(merged.googleProfileOnboardingState),
    onboardingIntakeCompletedAt: str(merged.onboardingIntakeCompletedAt),
    localHierarchyRoot: str(merged.localHierarchyRoot) || primaryTown,
    onboardingAreaDiscoveryRevision: str(merged.onboardingAreaDiscoveryRevision),
    primaryLocalityMeta:
      merged.primaryLocalityMeta && typeof merged.primaryLocalityMeta === "object"
        ? (merged.primaryLocalityMeta as Record<string, unknown>)
        : undefined,
    pendingOnboardingOpportunities: Array.isArray(merged.pendingOnboardingOpportunities)
      ? (merged.pendingOnboardingOpportunities as Array<{ id: string; title: string; status: string; detail?: string }>)
      : [],
    priorityServices: strArray(merged.priorityServices),
    targetPatientGroups: strArray(merged.targetPatientGroups),
    uniqueSellingPoints: strArray(merged.uniqueSellingPoints),
    patientQuestions: strArray(merged.patientQuestions),
    preferredCta: str(merged.preferredCta) || v2.preferredCtaWording,
    preferredCtaWording: v2.preferredCtaWording || str(merged.preferredCta),
    primaryGrowthGoal: str(merged.primaryGrowthGoal),
    brandPrimaryColor: str(merged.brandPrimaryColor) || DEFAULT_BRANDING.brandPrimaryColor,
    brandSecondaryColor: str(merged.brandSecondaryColor) || DEFAULT_BRANDING.brandSecondaryColor,
    brandCtaColor: str(merged.brandCtaColor) || str(merged.brandPrimaryColor) || DEFAULT_BRANDING.brandCtaColor,
    faviconUrl: str(merged.faviconUrl),
    brandAccentColor: str(merged.brandAccentColor) || DEFAULT_BRANDING.brandAccentColor,
    brandBackgroundColor: str(merged.brandBackgroundColor) || DEFAULT_BRANDING.brandBackgroundColor,
    brandTextColor: str(merged.brandTextColor) || DEFAULT_BRANDING.brandTextColor,
    brandMutedTextColor: str(merged.brandMutedTextColor) || DEFAULT_BRANDING.brandMutedTextColor,
    brandHeaderBackgroundColor: hexColorOrEmpty(merged.brandHeaderBackgroundColor),
    brandHeaderTextColor: hexColorOrEmpty(merged.brandHeaderTextColor),
    brandFooterBackgroundColor: hexColorOrEmpty(merged.brandFooterBackgroundColor),
    brandFooterTextColor: hexColorOrEmpty(merged.brandFooterTextColor),
    brandFooterLinkColor: hexColorOrEmpty(merged.brandFooterLinkColor),
    brandFooterAccentColor: hexColorOrEmpty(merged.brandFooterAccentColor),
    fontHeading: str(merged.fontHeading) || DEFAULT_BRANDING.fontHeading,
    fontBody: str(merged.fontBody) || DEFAULT_BRANDING.fontBody,
    fontHeadingWeight: str(merged.fontHeadingWeight) || DEFAULT_BRANDING.fontHeadingWeight,
    fontBodyWeight: str(merged.fontBodyWeight) || DEFAULT_BRANDING.fontBodyWeight,
    fontH1Size: str(merged.fontH1Size) || DEFAULT_BRANDING.fontH1Size,
    fontH2Size: str(merged.fontH2Size) || DEFAULT_BRANDING.fontH2Size,
    fontH3Size: str(merged.fontH3Size) || DEFAULT_BRANDING.fontH3Size,
    fontBodySize: str(merged.fontBodySize) || DEFAULT_BRANDING.fontBodySize,
    buttonStyle: str(merged.buttonStyle) || DEFAULT_BRANDING.buttonStyle,
    buttonRadius: str(merged.buttonRadius) || DEFAULT_BRANDING.buttonRadius,
    cardRadius: str(merged.cardRadius) || DEFAULT_BRANDING.cardRadius,
    imageStyle: str(merged.imageStyle) || DEFAULT_BRANDING.imageStyle,
    pageStyle: str(merged.pageStyle) || DEFAULT_BRANDING.pageStyle,
    headerLogoUrl: str(merged.headerLogoUrl),
    headerCtaText: str(merged.headerCtaText),
    headerCtaUrl: str(merged.headerCtaUrl),
    headerNavLinks: normalizeNavLinks(merged.headerNavLinks),
    footerLogoUrl: str(merged.footerLogoUrl),
    footerText: str(merged.footerText),
    footerCopyright: str(merged.footerCopyright),
    footerCompanyNumber: str(merged.footerCompanyNumber),
    footerPrivacyPolicyUrl: str(merged.footerPrivacyPolicyUrl),
    footerCookiePolicyUrl: str(merged.footerCookiePolicyUrl),
    footerTermsUrl: str(merged.footerTermsUrl),
    footerLinks: normalizeFooterLinks(merged.footerLinks),
    socialFacebook: str(merged.socialFacebook),
    socialInstagram: str(merged.socialInstagram),
    socialLinkedIn: str(merged.socialLinkedIn),
    socialX: str(merged.socialX),
    socialYouTube: str(merged.socialYouTube),
    selectedServices: strArray(merged.selectedServices),
    prescriptionMethod: str(merged.prescriptionMethod),
    deliveryAvailable: deliveryArr,
    deliveryAreas: strArray(merged.deliveryAreas),
    facilities,
    tone: str(merged.tone),
    primaryGoal: str(merged.primaryGoal),
    mainCompetitors: strArray(merged.mainCompetitors),
    rankingKeywords: strArray(merged.rankingKeywords),
    currentMarketingChallenges: strArray(merged.currentMarketingChallenges),
    localLandmarks: strArray(merged.localLandmarks),
    localGpSurgeries: strArray(merged.localGpSurgeries),
    careHomesServed: strArray(merged.careHomesServed),
    nearbyHealthCentres: strArray(merged.nearbyHealthCentres),
    nearbyHospitals: strArray(merged.nearbyHospitals),
    nearbySchools: strArray(merged.nearbySchools),
    nearbyEmployers: strArray(merged.nearbyEmployers),
    communityLinks: strArray(merged.communityLinks),
    localEvents: strArray(merged.localEvents),
    localAreas: strArray(merged.localAreas),
    localHealthcareLocations: strArray(merged.localHealthcareLocations),
    localGps: strArray(merged.localGps),
    localHospitals: strArray(merged.localHospitals),
    localDentists: strArray(merged.localDentists),
    localPharmacies: strArray(merged.localPharmacies),
    localCommunityLocations: strArray(merged.localCommunityLocations),
    localSchools: strArray(merged.localSchools),
    localCareHomes: strArray(merged.localCareHomes),
    localTransportLinks: strArray(merged.localTransportLinks),
    localRetailCentres: strArray(merged.localRetailCentres),
    localResidentialAreas: strArray(merged.localResidentialAreas),
    gpSurgeries: normalizeEntityList(merged.gpSurgeries, "gpSurgeries"),
    hospitals: normalizeEntityList(merged.hospitals, "hospitals"),
    healthCentres: normalizeEntityList(merged.healthCentres, "healthCentres"),
    careHomes: normalizeEntityList(merged.careHomes, "careHomes"),
    schools: normalizeEntityList(merged.schools, "schools"),
    majorEmployers: normalizeEntityList(merged.majorEmployers, "majorEmployers"),
    landmarks: normalizeEntityList(merged.landmarks, "landmarks"),
    communityFacilities: normalizeEntityList(merged.communityFacilities, "communityFacilities"),
    transportLinks: normalizeEntityList(merged.transportLinks, "transportLinks"),
    retailCentres: normalizeEntityList(merged.retailCentres, "retailCentres"),
    residentialAreas: normalizeEntityList(merged.residentialAreas, "residentialAreas"),
    localIntelligenceGenerated: bool(merged.localIntelligenceGenerated),
    localIntelligenceGeneratedAt: str(merged.localIntelligenceGeneratedAt),
    localIntelligenceCandidates:
      merged.localIntelligenceCandidates && typeof merged.localIntelligenceCandidates === "object"
        ? (merged.localIntelligenceCandidates as Record<string, ProfileLocalEntity[]>)
        : {},
    reviewerName: str(merged.reviewerName),
    reviewerRole: str(merged.reviewerRole),
    reviewerQualifications: str(merged.reviewerQualifications),
    reviewerProfessionalRegistrations:
      str(merged.reviewerProfessionalRegistrations) || str(merged.reviewerGphcNumber),
    reviewerGphcNumber: str(merged.reviewerGphcNumber),
    reviewerExperienceYears: str(merged.reviewerExperienceYears),
    reviewerBio: str(merged.reviewerBio),
    reviewerSpecialisms: strArray(merged.reviewerSpecialisms),
    reviewerSpecialInterests: strArray(merged.reviewerSpecialInterests),
    reviewerClinicalInterests: strArray(merged.reviewerClinicalInterests),
    reviewerPhoto: str(merged.reviewerPhoto),
    reviewerSignature: str(merged.reviewerSignature),
    clinicalReviewDate: dateOnly(merged.clinicalReviewDate),
    nextReviewDate: dateOnly(merged.nextReviewDate),
    demoMode: bool(merged.demoMode),
    trustDataStatus: str(merged.trustDataStatus),
    platformClientStatus: str(merged.platformClientStatus),
    adminNotes: str(merged.adminNotes),
    websiteAnalysisAt: str(merged.websiteAnalysisAt),
    websiteAnalysisSourceUrl: str(merged.websiteAnalysisSourceUrl),
    detectedWebsiteServices: Array.isArray(merged.detectedWebsiteServices)
      ? merged.detectedWebsiteServices
          .map((row) => {
            const item = row as Record<string, unknown>;
            const serviceId = str(item.serviceId);
            const serviceName = str(item.serviceName);
            if (!serviceId || !serviceName) return null;
            return {
              serviceId,
              serviceName,
              confidence: Math.min(100, Math.max(0, Number(item.confidence) || 0)),
            };
          })
          .filter(Boolean) as { serviceId: string; serviceName: string; confidence: number }[]
      : [],
    profileWizardStep: Math.max(1, Math.min(8, Number(merged.profileWizardStep) || 1)),
    profileWizardUpdatedAt: str(merged.profileWizardUpdatedAt),
    googleBusinessRating:
      merged.googleBusinessRating === null || merged.googleBusinessRating === undefined || merged.googleBusinessRating === ""
        ? null
        : Math.min(5, Math.max(0, Number(merged.googleBusinessRating) || 0)),
    googleBusinessReviewCount: Math.max(0, Number(merged.googleBusinessReviewCount) || 0),
    profileCompetitors: normalizeProfileCompetitors(merged.profileCompetitors),
    competitorReviewConfirmed: bool(merged.competitorReviewConfirmed) || bool(merged.profileCompetitorsReviewed),
    profileCompetitorsReviewed: bool(merged.profileCompetitorsReviewed) || bool(merged.competitorReviewConfirmed),
    profileCompetitorsReviewedAt: str(merged.profileCompetitorsReviewedAt),
    profileWizardEnrichedAt: str(merged.profileWizardEnrichedAt),
    websiteImportedFieldKeys: strArray(merged.websiteImportedFieldKeys),
    profileFieldConfirmations:
      merged.profileFieldConfirmations && typeof merged.profileFieldConfirmations === "object"
        ? (merged.profileFieldConfirmations as Record<string, string>)
        : {},
    customerSetupGoogleMatchStatus: normalizeGoogleMatchStatus(merged.customerSetupGoogleMatchStatus),
    customerSetupGoogleCandidates: normalizeCustomerSetupGoogleCandidates(merged.customerSetupGoogleCandidates),
    customerSetupGoogleListing: normalizeCustomerSetupGoogleListing(merged.customerSetupGoogleListing),
    customerSetupNationalWebsiteDetected: bool(merged.customerSetupNationalWebsiteDetected),
    googleImportedFieldKeys: strArray(merged.googleImportedFieldKeys),
    googleImportSnapshot: normalizeGoogleImportSnapshot(merged.googleImportSnapshot),
    websiteImportSnapshot: normalizeWebsiteImportSnapshot(merged.websiteImportSnapshot),
    websiteBranchResolution: normalizeWebsiteBranchResolution(merged.websiteBranchResolution),
    lastGoogleImportDebug: normalizeSetupImportDebugRecord(merged.lastGoogleImportDebug),
    lastWebsiteImportDebug: normalizeSetupImportDebugRecord(merged.lastWebsiteImportDebug),
    customerSetupFieldSources: normalizeCustomerSetupFieldSources(merged.customerSetupFieldSources),
    customerSetupAdminBaseline: normalizeCustomerSetupAdminBaseline(merged.customerSetupAdminBaseline),
  };

  return syncProfileAreaFields(normalized);
}

export function normalizeProfileDoc(
  slug: string,
  doc: {
    slug?: string;
    updatedAt?: string;
    version?: number;
    demoMode?: boolean;
    trustDataStatus?: string;
    data?: Record<string, unknown>;
  },
): PharmacyProfileDoc {
  const data = normalizeProfileData({
    ...(doc.data || {}),
    demoMode: doc.demoMode ?? doc.data?.demoMode,
    trustDataStatus: doc.trustDataStatus ?? doc.data?.trustDataStatus,
  });
  return {
    slug: str(doc.slug) || slug,
    updatedAt: doc.updatedAt || new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    demoMode: data.demoMode,
    trustDataStatus: data.trustDataStatus,
    data,
  };
}

export function mergeProfileAuditRaw(doc: {
  demoMode?: boolean;
  trustDataStatus?: string;
  data?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...(doc.data || {}),
    demoMode: doc.demoMode ?? doc.data?.demoMode,
    trustDataStatus: doc.trustDataStatus ?? doc.data?.trustDataStatus,
  };
}

function hasAddress(data: PharmacyProfileData): boolean {
  return Boolean(data.addressLine1 && data.townCity && data.postcode);
}

export function auditPharmacyProfile(slug: string, raw: Record<string, unknown>): ProfileAuditResult {
  const data = normalizeProfileData(raw);
  const demoMode = bool(raw.demoMode);
  const trustDataStatus = str(raw.trustDataStatus) || (demoMode ? "mock" : "");
  const dataClassification = demoMode ? "DEMO DATA" : "LIVE PROFILE";
  const warnings: string[] = [];

  const checks: ProfileAuditCheck[] = [
    {
      id: "pharmacyName",
      label: "Pharmacy name",
      passed: Boolean(data.pharmacyName),
      required: true,
      message: data.pharmacyName ? "Pharmacy name provided" : "Add pharmacy name",
    },
    {
      id: "contactEmail",
      label: "Business or NHS email",
      passed: Boolean(data.businessEmail || data.nhsEmail),
      required: true,
      message:
        data.businessEmail || data.nhsEmail
          ? "At least one contact email provided"
          : "Add business email and/or NHS email",
    },
    {
      id: "phone",
      label: "Phone number",
      passed: Boolean(data.phone),
      required: true,
      message: data.phone ? "Phone number provided" : "Add phone number",
    },
    {
      id: "address",
      label: "Address (line 1, town, postcode)",
      passed: hasAddress(data),
      required: true,
      message: hasAddress(data) ? "Address complete" : "Add address line 1, town and postcode",
    },
    {
      id: "gphcNumber",
      label: "GPhC number or marked missing",
      passed: Boolean(data.gphcNumber) || data.gphcNumberMarkedMissing,
      required: true,
      message:
        data.gphcNumber
          ? "GPhC number provided"
          : data.gphcNumberMarkedMissing
            ? "GPhC marked as not yet available"
            : "Add GPhC number or mark as missing",
    },
    {
      id: "superintendentPharmacistName",
      label: "Superintendent pharmacist or marked missing",
      passed: Boolean(data.superintendentPharmacistName) || data.superintendentPharmacistNameMarkedMissing,
      required: true,
      message:
        data.superintendentPharmacistName
          ? "Superintendent pharmacist provided"
          : data.superintendentPharmacistNameMarkedMissing
            ? "Superintendent marked as not yet available"
            : "Add superintendent name or mark as missing",
    },
    {
      id: "nhsProfileUrl",
      label: "NHS profile URL or marked missing",
      passed: Boolean(data.nhsProfileUrl) || data.nhsProfileUrlMarkedMissing,
      required: true,
      message:
        data.nhsProfileUrl
          ? "NHS profile URL provided"
          : data.nhsProfileUrlMarkedMissing
            ? "NHS profile URL marked as not yet available"
            : "Add NHS profile URL or mark as missing",
    },
    {
      id: "rankingAreas",
      label: "At least one ranking area",
      passed: data.rankingAreas.length > 0,
      required: true,
      message:
        data.rankingAreas.length > 0
          ? `${data.rankingAreas.length} ranking area(s) defined`
          : "Add at least one area you want to rank in",
    },
    {
      id: "priorityServices",
      label: "At least one priority service",
      passed: data.priorityServices.length > 0,
      required: true,
      message:
        data.priorityServices.length > 0
          ? `${data.priorityServices.length} priority service(s) defined`
          : "Add at least one priority service",
    },
    {
      id: "website",
      label: "Website URL",
      passed: Boolean(data.website),
      required: false,
      message: data.website ? "Website provided" : "Consider adding website URL",
    },
    {
      id: "bookingUrl",
      label: "Online booking URL",
      passed: Boolean(data.bookingUrl),
      required: false,
      message: data.bookingUrl ? "Booking URL provided" : "Add booking URL if online booking is available",
    },
    {
      id: "trustSignals",
      label: "Trust signals (years, accreditations or GPhC premises URL)",
      passed: Boolean(
        data.yearsServingCommunity || data.accreditations.length || data.gphcPremisesUrl,
      ),
      required: false,
      message: "Trust signals strengthen pharmacy SEO pages",
    },
    {
      id: "demoTrustMarked",
      label: "Demo trust data explicitly marked",
      passed: !demoMode || trustDataStatus === "mock",
      required: demoMode,
      message:
        demoMode && trustDataStatus === "mock"
          ? "Demo profile uses mock trust data (not verified)"
          : demoMode
            ? "Set trustDataStatus to mock for demo pharmacies"
            : "Live profile — regulatory fields must be verified",
    },
    {
      id: "googleBusinessProfileUrl",
      label: "Google Business Profile URL",
      passed: Boolean(data.googleBusinessProfileUrl),
      required: false,
      message: data.googleBusinessProfileUrl
        ? "Google Business Profile URL provided"
        : "Add Google Business Profile URL for local map trust",
    },
    {
      id: "gphcPremisesUrl",
      label: "GPhC premises register URL",
      passed: Boolean(data.gphcPremisesUrl),
      required: false,
      message: data.gphcPremisesUrl
        ? "GPhC premises URL provided"
        : "Add GPhC premises register URL",
    },
    {
      id: "localIntelligenceGenerated",
      label: "Local intelligence generated",
      passed: data.localIntelligenceGenerated,
      required: false,
      message: data.localIntelligenceGenerated
        ? "Local intelligence has been generated"
        : "Generate local intelligence from the Local Intelligence tab",
    },
    {
      id: "healthcareEntitiesSelected",
      label: "At least 3 healthcare entities selected",
      passed: countHealthcareEntities(data as unknown as Record<string, unknown>) >= 3,
      required: false,
      message:
        countHealthcareEntities(data as unknown as Record<string, unknown>) >= 3
          ? `${countHealthcareEntities(data as unknown as Record<string, unknown>)} healthcare entities selected`
          : "Select at least 3 GP surgeries, hospitals, health centres or care homes",
    },
    {
      id: "communityEntitiesSelected",
      label: "At least 3 community/local entities selected",
      passed: countCommunityEntities(data as unknown as Record<string, unknown>) >= 3,
      required: false,
      message:
        countCommunityEntities(data as unknown as Record<string, unknown>) >= 3
          ? `${countCommunityEntities(data as unknown as Record<string, unknown>)} community/local entities selected`
          : "Select at least 3 schools, landmarks, community facilities, transport, retail or residential areas",
    },
  ];

  const required = checks.filter((c) => c.required);
  const requiredPassed = required.filter((c) => c.passed).length;
  const passed = required.every((c) => c.passed);
  const score = required.length ? Math.round((requiredPassed / required.length) * 100) : 0;

  const recommendations: string[] = [];
  for (const c of checks.filter((x) => x.required && !x.passed)) {
    recommendations.push(c.message);
  }

  if (demoMode) {
    recommendations.push(
      "Example pharmacy profile — trust and regulatory fields are for demonstration in this preview environment.",
    );
    if (data.gphcNumber) {
      recommendations.push(`Example GPhC reference ${data.gphcNumber} — verify against the GPhC register before live publish.`);
    }
    if (/demo/i.test(data.superintendentPharmacistName)) {
      recommendations.push("Superintendent pharmacist name is an example profile entry — verify before live publish.");
    }
  } else {
    if (!data.gphcNumber && !data.gphcNumberMarkedMissing) {
      warnings.push("Missing GPhC number — required for live pharmacy trust pages");
    }
    if (!data.nhsProfileUrl && !data.nhsProfileUrlMarkedMissing) {
      warnings.push("Missing NHS profile URL — required for live NHS trust signals");
    }
    if (!data.googleBusinessProfileUrl) {
      warnings.push("Missing Google Business Profile URL — recommended for local SEO trust");
    }
    if (!data.gphcPremisesUrl && data.gphcNumber) {
      warnings.push("GPhC number provided without premises register URL");
    }
    if (!data.superintendentPharmacistName && !data.superintendentPharmacistNameMarkedMissing) {
      warnings.push("Missing superintendent pharmacist name");
    }
    if (/demo|mock|example|test/i.test(data.superintendentPharmacistName)) {
      warnings.push("Superintendent name appears to be placeholder text — verify before publishing live");
    }
  }

  if (!data.nhsEmail && data.businessEmail && !demoMode) {
    recommendations.push("Add NHS email if the pharmacy uses a separate NHS contact address");
  }
  if (!data.gphcPremisesUrl && data.gphcNumber && !demoMode) {
    recommendations.push("Add GPhC premises URL for regulatory trust signals");
  }
  if (!data.bookingUrl && /online/i.test(data.bookingMethod)) {
    recommendations.push("Add booking URL to match online booking method");
  }

  return {
    slug,
    auditedAt: new Date().toISOString(),
    passed,
    score,
    requiredPassed,
    requiredTotal: required.length,
    checks,
    recommendations,
    demoMode,
    trustDataStatus,
    dataClassification,
    warnings,
  };
}

export function profileSummaryLines(data: PharmacyProfileData): string[] {
  const lines: string[] = [];
  if (data.pharmacyName) lines.push(`Pharmacy: ${data.pharmacyName}`);
  if (data.businessEmail) lines.push(`Business email: ${data.businessEmail}`);
  if (data.nhsEmail) lines.push(`NHS email: ${data.nhsEmail}`);
  if (data.phone) lines.push(`Phone: ${data.phone}`);
  if (hasAddress(data)) {
    lines.push(`Address: ${[data.addressLine1, data.townCity, data.postcode].filter(Boolean).join(", ")}`);
  }
  if (data.gphcNumber) lines.push(`GPhC: ${data.gphcNumber}`);
  if (data.rankingAreas.length) lines.push(`Ranking areas: ${data.rankingAreas.join(", ")}`);
  if (data.priorityServices.length) lines.push(`Priority services: ${data.priorityServices.join(", ")}`);
  return lines;
}
