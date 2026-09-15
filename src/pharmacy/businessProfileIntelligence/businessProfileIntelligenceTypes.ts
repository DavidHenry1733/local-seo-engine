/**
 * Business Profile Intelligence V2 — Phase 1 architecture types.
 *
 * Pure data model. Not wired into generators, APIs, or rendering in this phase.
 *
 * Pipeline (future):
 *   PharmacyProfileData → BusinessProfileIntelligence → ContentIntelligence → Generators
 */

export const BUSINESS_PROFILE_INTELLIGENCE_VERSION = "2.0.0-phase1" as const;

export type IntelligenceFieldSource =
  | "profile"
  | "inferred"
  | "default"
  | "catalog"
  | "manual"
  | "future";

export interface IntelligenceProvenance {
  source: IntelligenceFieldSource;
  profileField?: string;
  note?: string;
}

export interface WithProvenance<T> {
  value: T;
  provenance: IntelligenceProvenance;
}

// ─── Section 1: Business Identity ───────────────────────────────────────────

export interface SocialMediaLinks {
  facebook: string;
  instagram: string;
  linkedIn: string;
  x: string;
  youTube: string;
}

export interface ContactDetails {
  phone: string;
  businessEmail: string;
  nhsEmail: string;
  primaryContactName: string;
  emergencyContact: string;
}

export interface GphcRegistration {
  premisesNumber: string;
  premisesUrl: string;
  markedMissing: boolean;
}

export interface SuperintendentPharmacist {
  name: string;
  markedMissing: boolean;
}

export interface PharmacistTeamMember {
  name: string;
  role: string;
  gphcNumber: string;
  isIndependentPrescriber: boolean;
}

export interface OpeningHoursSchedule {
  summary: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface BusinessIdentityIntelligence {
  businessName: string;
  tradingName: string;
  tagline: string;
  businessDescription: string;
  yearEstablished: string;
  gphc: GphcRegistration;
  superintendentPharmacist: SuperintendentPharmacist;
  pharmacistTeam: PharmacistTeamMember[];
  independentPrescriberAvailable: boolean;
  contact: ContactDetails;
  openingHours: OpeningHoursSchedule;
  website: string;
  socialMedia: SocialMediaLinks;
  companyName: string;
  companyRegistrationNumber: string;
  country: string;
}

// ─── Section 2: Brand Identity ──────────────────────────────────────────────

export interface LogoAssets {
  primary: string;
  header: string;
  footer: string;
  favicon: string;
}

export interface BrandIdentityIntelligence {
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
  ctaColour: string;
  backgroundColour: string;
  textColour: string;
  mutedTextColour: string;
  logo: LogoAssets;
  fontFamily: string;
  headingFont: string;
  bodyFont: string;
  headingFontWeight: string;
  bodyFontWeight: string;
  heroStyle: string;
  photographyStyle: string;
  iconStyle: string;
  ctaStyle: string;
  buttonStyle: string;
  buttonRadius: string;
  cardRadius: string;
  pageStyle: string;
}

// ─── Section 3: Location Intelligence ───────────────────────────────────────

export interface AreaServed {
  areaName: string;
  areaSlug: string;
  priority: number;
  order: number;
  selected: boolean;
  source: string;
}

export interface LocationIntelligence {
  primaryTown: string;
  primaryCity: string;
  townCity: string;
  county: string;
  countiesCovered: string[];
  postcode: string;
  addressLine1: string;
  addressLine2: string;
  fullAddress: string;
  serviceRadius: string;
  nearbyGpPractices: string[];
  nearbyHospitals: string[];
  parking: string[];
  publicTransport: string[];
  wheelchairAccess: boolean;
  areasServed: AreaServed[];
  coverageAreas: string[];
  latitude: string;
  longitude: string;
  googlePlaceId: string;
  googleMapsEmbedUrl: string;
}

// ─── Section 4: Service Intelligence ────────────────────────────────────────

export type ServiceFundingModel = "nhs" | "private" | "mixed" | "unknown";

export interface ServiceDeliveryIntelligence {
  serviceId: string;
  serviceName: string;
  fundingModel: ServiceFundingModel;
  appointmentRequired: boolean | null;
  walkInAvailable: boolean | null;
  consultationLengthMinutes: number | null;
  equipmentUsed: string[];
  preparation: string[];
  aftercare: string[];
  resultsProcess: string;
  referralProcess: string;
  pricing: string;
  ageRestrictions: string;
  priority: boolean;
  detectedFromWebsite: boolean;
}

export interface ServiceIntelligence {
  selectedServiceIds: string[];
  priorityServiceIds: string[];
  byServiceId: Record<string, ServiceDeliveryIntelligence>;
}

// ─── Section 5: Team Intelligence ───────────────────────────────────────────

export interface TeamMemberIntelligence {
  name: string;
  role: string;
  qualifications: string;
  languages: string[];
  experienceYears: string;
  specialInterests: string[];
  clinicalExpertise: string[];
  photoUrl: string;
  isPrimaryReviewer: boolean;
}

export interface TeamIntelligence {
  meetTheTeamIntro: string;
  members: TeamMemberIntelligence[];
  languagesSpoken: string[];
}

// ─── Section 6: Patient Intelligence ────────────────────────────────────────

export interface PatientGroup {
  id: string;
  label: string;
  description: string;
  priority: number;
}

export interface PatientIntelligence {
  targetGroups: PatientGroup[];
  uniqueSellingPoints: string[];
  patientQuestions: string[];
}

// ─── Section 7: Trust Intelligence ──────────────────────────────────────────

export interface Testimonial {
  quote: string;
  author: string;
  source: string;
}

export interface TrustIntelligence {
  awards: string[];
  accreditations: string[];
  reviewHighlights: string[];
  testimonials: Testimonial[];
  yearsServingCommunity: string;
  numberOfPatients: string;
  nhsProfileUrl: string;
  googleBusinessProfileUrl: string;
  gphcPremisesUrl: string;
  independentPharmacy: boolean;
  consultationRoomAvailable: boolean;
  clinicalReviewDate: string;
  nextReviewDate: string;
}

// ─── Section 8: Conversion Intelligence ─────────────────────────────────────

export interface ConversionIntelligence {
  primaryCta: string;
  secondaryCta: string;
  bookingUrl: string;
  telephone: string;
  email: string;
  onlineBookingAvailable: boolean;
  contactFormUrl: string;
  preferredCtaWording: string;
  headerCtaText: string;
  headerCtaUrl: string;
  bookingMethod: string;
}

// ─── Section 9: Content Intelligence ────────────────────────────────────────

export type ToneOfVoice =
  | "professional"
  | "warm"
  | "clinical"
  | "community"
  | "premium"
  | "custom";

export type ReadingLevel = "plain-english" | "standard" | "detailed";

export type PreferredContentLength = "concise" | "standard" | "comprehensive";

export type InternalLinkBehaviour = "service-first" | "local-first" | "balanced";

export interface ContentIntelligence {
  toneOfVoice: ToneOfVoice | string;
  readingLevel: ReadingLevel;
  preferredLength: PreferredContentLength;
  mentionPharmacists: boolean;
  mentionReviews: boolean;
  localReferences: boolean;
  faqPreferences: {
    includeTenantSpecific: boolean;
    maxFaqs: number;
    preferPracticalQuestions: boolean;
  };
  internalLinkBehaviour: InternalLinkBehaviour;
  primaryGrowthGoal: string;
  rankingKeywords: string[];
}

// ─── Section 10: AI Intelligence + aggregate object ─────────────────────────

export interface AiIntelligence {
  /** Whether generated clinical copy must carry reviewer attribution. */
  requireReviewerAttribution: boolean;
  /** Whether local area names should be woven into long-form copy when available. */
  preferLocalContext: boolean;
  /** Topics or phrases generators should never invent without profile data. */
  doNotInventWithoutProfile: string[];
  /** Fields generators should prefer from intelligence over hard-coded defaults. */
  profileFirstFields: string[];
  /** Placeholder for future prompt-pack version binding. */
  promptPackVersion: string | null;
}

export interface BusinessProfileIntelligenceProvenance {
  builtAt: string;
  profileSlug: string;
  profileUpdatedAt: string;
  profileSchemaVersion: number;
  intelligenceVersion: typeof BUSINESS_PROFILE_INTELLIGENCE_VERSION;
  migrationNotes: string[];
}

/**
 * Single normalized intelligence object future generators consume.
 * Generators should depend on this type — not on raw profile JSON shape.
 */
export interface BusinessProfileIntelligence {
  version: typeof BUSINESS_PROFILE_INTELLIGENCE_VERSION;
  slug: string;
  provenance: BusinessProfileIntelligenceProvenance;
  identity: BusinessIdentityIntelligence;
  brand: BrandIdentityIntelligence;
  location: LocationIntelligence;
  services: ServiceIntelligence;
  team: TeamIntelligence;
  patients: PatientIntelligence;
  trust: TrustIntelligence;
  conversion: ConversionIntelligence;
  content: ContentIntelligence;
  ai: AiIntelligence;
}

/** Extension point: future phase derives generator-facing content rules from intelligence. */
export interface ContentIntelligenceContext {
  intelligence: BusinessProfileIntelligence;
  /** Reserved — populated in Phase 2 when wired to generators. */
  serviceId?: string;
  localArea?: string;
}
