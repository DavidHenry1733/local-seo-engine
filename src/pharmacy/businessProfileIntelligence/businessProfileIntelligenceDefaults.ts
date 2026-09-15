/**
 * Business Profile Intelligence V2 — Phase 1 default values.
 */
import type {
  AiIntelligence,
  BrandIdentityIntelligence,
  BusinessIdentityIntelligence,
  BusinessProfileIntelligence,
  ContentIntelligence,
  ConversionIntelligence,
  LocationIntelligence,
  PatientIntelligence,
  ServiceIntelligence,
  TeamIntelligence,
  TrustIntelligence,
} from "./businessProfileIntelligenceTypes.ts";
import { BUSINESS_PROFILE_INTELLIGENCE_VERSION } from "./businessProfileIntelligenceTypes.ts";
import { DEFAULT_BRANDING } from "../pharmacyProfileDashboardConfig.ts";

export function defaultBusinessIdentityIntelligence(): BusinessIdentityIntelligence {
  return {
    businessName: "",
    tradingName: "",
    tagline: "",
    businessDescription: "",
    yearEstablished: "",
    gphc: { premisesNumber: "", premisesUrl: "", markedMissing: false },
    superintendentPharmacist: { name: "", markedMissing: false },
    pharmacistTeam: [],
    independentPrescriberAvailable: false,
    contact: {
      phone: "",
      businessEmail: "",
      nhsEmail: "",
      primaryContactName: "",
      emergencyContact: "",
    },
    openingHours: {
      summary: "",
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    },
    website: "",
    socialMedia: {
      facebook: "",
      instagram: "",
      linkedIn: "",
      x: "",
      youTube: "",
    },
    companyName: "",
    companyRegistrationNumber: "",
    country: "United Kingdom",
  };
}

export function defaultBrandIdentityIntelligence(): BrandIdentityIntelligence {
  return {
    primaryColour: DEFAULT_BRANDING.brandPrimaryColor,
    secondaryColour: DEFAULT_BRANDING.brandSecondaryColor,
    accentColour: DEFAULT_BRANDING.brandAccentColor,
    ctaColour: DEFAULT_BRANDING.brandCtaColor,
    backgroundColour: DEFAULT_BRANDING.brandBackgroundColor,
    textColour: DEFAULT_BRANDING.brandTextColor,
    mutedTextColour: DEFAULT_BRANDING.brandMutedTextColor,
    logo: { primary: "", header: "", footer: "", favicon: "" },
    fontFamily: DEFAULT_BRANDING.fontHeading,
    headingFont: DEFAULT_BRANDING.fontHeading,
    bodyFont: DEFAULT_BRANDING.fontBody,
    headingFontWeight: DEFAULT_BRANDING.fontHeadingWeight,
    bodyFontWeight: DEFAULT_BRANDING.fontBodyWeight,
    heroStyle: DEFAULT_BRANDING.pageStyle || "nhs-premium",
    photographyStyle: DEFAULT_BRANDING.imageStyle || "healthcare-natural",
    iconStyle: "line-healthcare",
    ctaStyle: DEFAULT_BRANDING.buttonStyle || "pill-primary",
    buttonStyle: DEFAULT_BRANDING.buttonStyle,
    buttonRadius: DEFAULT_BRANDING.buttonRadius,
    cardRadius: DEFAULT_BRANDING.cardRadius,
    pageStyle: DEFAULT_BRANDING.pageStyle,
  };
}

export function defaultLocationIntelligence(): LocationIntelligence {
  return {
    primaryTown: "",
    primaryCity: "",
    townCity: "",
    county: "",
    countiesCovered: [],
    postcode: "",
    addressLine1: "",
    addressLine2: "",
    fullAddress: "",
    serviceRadius: "",
    nearbyGpPractices: [],
    nearbyHospitals: [],
    parking: [],
    publicTransport: [],
    wheelchairAccess: false,
    areasServed: [],
    coverageAreas: [],
    latitude: "",
    longitude: "",
    googlePlaceId: "",
    googleMapsEmbedUrl: "",
  };
}

export function defaultServiceIntelligence(): ServiceIntelligence {
  return {
    selectedServiceIds: [],
    priorityServiceIds: [],
    byServiceId: {},
  };
}

export function defaultTeamIntelligence(): TeamIntelligence {
  return {
    meetTheTeamIntro: "",
    members: [],
    languagesSpoken: [],
  };
}

export function defaultPatientIntelligence(): PatientIntelligence {
  return {
    targetGroups: [],
    uniqueSellingPoints: [],
    patientQuestions: [],
  };
}

export function defaultTrustIntelligence(): TrustIntelligence {
  return {
    awards: [],
    accreditations: [],
    reviewHighlights: [],
    testimonials: [],
    yearsServingCommunity: "",
    numberOfPatients: "",
    nhsProfileUrl: "",
    googleBusinessProfileUrl: "",
    gphcPremisesUrl: "",
    independentPharmacy: false,
    consultationRoomAvailable: false,
    clinicalReviewDate: "",
    nextReviewDate: "",
  };
}

export function defaultConversionIntelligence(): ConversionIntelligence {
  return {
    primaryCta: "",
    secondaryCta: "",
    bookingUrl: "",
    telephone: "",
    email: "",
    onlineBookingAvailable: false,
    contactFormUrl: "",
    preferredCtaWording: "",
    headerCtaText: "",
    headerCtaUrl: "",
    bookingMethod: "",
  };
}

export function defaultContentIntelligence(): ContentIntelligence {
  return {
    toneOfVoice: "professional",
    readingLevel: "plain-english",
    preferredLength: "standard",
    mentionPharmacists: true,
    mentionReviews: false,
    localReferences: true,
    faqPreferences: {
      includeTenantSpecific: true,
      maxFaqs: 10,
      preferPracticalQuestions: true,
    },
    internalLinkBehaviour: "balanced",
    primaryGrowthGoal: "",
    rankingKeywords: [],
  };
}

export function defaultAiIntelligence(): AiIntelligence {
  return {
    requireReviewerAttribution: true,
    preferLocalContext: true,
    doNotInventWithoutProfile: [
      "gphcNumber",
      "superintendentPharmacistName",
      "openingHours",
      "phone",
      "bookingUrl",
      "pricing",
      "serviceAvailability",
    ],
    profileFirstFields: [
      "identity.businessName",
      "identity.contact.phone",
      "location.primaryTown",
      "conversion.bookingUrl",
      "trust.superintendentPharmacist",
      "services.byServiceId",
    ],
    promptPackVersion: null,
  };
}

export function defaultBusinessProfileIntelligence(slug = ""): BusinessProfileIntelligence {
  const now = new Date().toISOString();
  return {
    version: BUSINESS_PROFILE_INTELLIGENCE_VERSION,
    slug,
    provenance: {
      builtAt: now,
      profileSlug: slug,
      profileUpdatedAt: "",
      profileSchemaVersion: 0,
      intelligenceVersion: BUSINESS_PROFILE_INTELLIGENCE_VERSION,
      migrationNotes: [],
    },
    identity: defaultBusinessIdentityIntelligence(),
    brand: defaultBrandIdentityIntelligence(),
    location: defaultLocationIntelligence(),
    services: defaultServiceIntelligence(),
    team: defaultTeamIntelligence(),
    patients: defaultPatientIntelligence(),
    trust: defaultTrustIntelligence(),
    conversion: defaultConversionIntelligence(),
    content: defaultContentIntelligence(),
    ai: defaultAiIntelligence(),
  };
}
