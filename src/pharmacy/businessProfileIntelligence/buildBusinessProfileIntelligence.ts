/**
 * Business Profile Intelligence V2 — Phase 1 builder / migration.
 *
 * Maps legacy PharmacyProfileData → BusinessProfileIntelligence.
 * Read-only transformation — does not mutate stored profiles or connect to generators.
 */
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import {
  PROFILE_SCHEMA_VERSION,
  type PharmacyProfileData,
  type PharmacyProfileDoc,
} from "../pharmacyProfileSchema.ts";
import {
  defaultAiIntelligence,
  defaultBrandIdentityIntelligence,
  defaultBusinessIdentityIntelligence,
  defaultBusinessProfileIntelligence,
  defaultContentIntelligence,
  defaultConversionIntelligence,
  defaultLocationIntelligence,
  defaultPatientIntelligence,
  defaultServiceIntelligence,
  defaultTeamIntelligence,
  defaultTrustIntelligence,
} from "./businessProfileIntelligenceDefaults.ts";
import type {
  BusinessProfileIntelligence,
  PatientGroup,
  ServiceDeliveryIntelligence,
  ServiceFundingModel,
  TeamMemberIntelligence,
} from "./businessProfileIntelligenceTypes.ts";
import { collectServiceIdsFromProfile } from "../pharmacyProfileV2Fields.ts";
import { resolveServiceDeliveryFromProfile, profileHasV2Fields } from "./mapProfileV2ToIntelligence.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  return [];
}

function inferYearEstablished(yearsServing: string): string {
  const n = parseInt(yearsServing, 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(new Date().getFullYear() - n);
}

function inferFundingModel(data: PharmacyProfileData): ServiceFundingModel {
  if (data.nhsServicesAvailable && data.privateServicesAvailable) return "mixed";
  if (data.privateServicesAvailable) return "private";
  if (data.nhsServicesAvailable) return "nhs";
  return "unknown";
}

function inferWalkIn(data: PharmacyProfileData): boolean | null {
  const method = str(data.bookingMethod).toLowerCase();
  if (!method) return null;
  if (/walk.?in|no appointment|drop.?in/i.test(method)) return true;
  if (/appointment|book/i.test(method)) return false;
  return null;
}

function buildServiceDelivery(
  serviceId: string,
  serviceName: string,
  data: PharmacyProfileData,
  opts: { priority: boolean; detectedFromWebsite: boolean },
): ServiceDeliveryIntelligence {
  const stored = resolveServiceDeliveryFromProfile(data, serviceId);
  if (stored) {
    return {
      serviceId,
      serviceName: str(stored.serviceName) || serviceName,
      fundingModel: stored.fundingModel as ServiceFundingModel,
      appointmentRequired: stored.appointmentRequired,
      walkInAvailable: stored.walkInAvailable,
      consultationLengthMinutes: stored.consultationLengthMinutes,
      equipmentUsed: stored.equipmentUsed,
      preparation: stored.preparationRequired,
      aftercare: stored.aftercare,
      resultsProcess: str(stored.resultsProcess),
      referralProcess: str(stored.referralProcess),
      pricing: str(stored.pricing),
      ageRestrictions: str(stored.ageRestrictions),
      priority: opts.priority,
      detectedFromWebsite: opts.detectedFromWebsite,
    };
  }
  return {
    serviceId,
    serviceName,
    fundingModel: inferFundingModel(data),
    appointmentRequired: inferWalkIn(data) === false ? true : inferWalkIn(data) === true ? false : null,
    walkInAvailable: inferWalkIn(data),
    consultationLengthMinutes: null,
    equipmentUsed: [],
    preparation: [],
    aftercare: [],
    resultsProcess: "",
    referralProcess: "",
    pricing: "",
    ageRestrictions: "",
    priority: opts.priority,
    detectedFromWebsite: opts.detectedFromWebsite,
  };
}

function buildServices(data: PharmacyProfileData): BusinessProfileIntelligence["services"] {
  const base = defaultServiceIntelligence();
  const selected = strArray(data.selectedServices);
  const priority = strArray(data.priorityServices);
  const detected = data.detectedWebsiteServices || [];

  base.selectedServiceIds = selected;
  base.priorityServiceIds = priority;

  const allIds = collectServiceIdsFromProfile(data as unknown as Record<string, unknown>);

  for (const serviceId of allIds) {
    const detectedRow = detected.find((d) => d.serviceId === serviceId);
    const serviceName =
      detectedRow?.serviceName ||
      serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    base.byServiceId[serviceId] = buildServiceDelivery(serviceId, serviceName, data, {
      priority: priority.includes(serviceId),
      detectedFromWebsite: Boolean(detectedRow),
    });
  }

  return base;
}

function buildTeam(data: PharmacyProfileData): BusinessProfileIntelligence["team"] {
  const team = defaultTeamIntelligence();
  team.languagesSpoken = strArray(data.languagesSpoken);
  team.meetTheTeamIntro = str(data.meetTheTeamIntro) || str(data.reviewerBio);

  const fromRecords = (data.teamMembers || []).map(
    (m): TeamMemberIntelligence => ({
      name: str(m.name),
      role: str(m.role),
      qualifications: str(m.qualifications),
      languages: m.languages || [],
      experienceYears: str(m.experienceYears),
      specialInterests: m.specialInterests || [],
      clinicalExpertise: m.clinicalExpertise || [],
      photoUrl: str(m.photoUrl),
      isPrimaryReviewer: Boolean(m.isPrimaryReviewer),
    }),
  ).filter((m) => m.name);

  if (fromRecords.length) {
    team.members = fromRecords;
    return team;
  }

  const superintendent: TeamMemberIntelligence = {
    name: str(data.superintendentPharmacistName) || str(data.reviewerName),
    role: str(data.reviewerRole) || "Superintendent Pharmacist",
    qualifications: str(data.reviewerQualifications),
    languages: strArray(data.languagesSpoken),
    experienceYears: str(data.reviewerExperienceYears) || str(data.yearsServingCommunity),
    specialInterests: strArray(data.reviewerSpecialInterests),
    clinicalExpertise: [
      ...strArray(data.reviewerSpecialisms),
      ...strArray(data.reviewerClinicalInterests),
    ],
    photoUrl: str(data.reviewerPhoto),
    isPrimaryReviewer: true,
  };

  if (superintendent.name) {
    team.members.push(superintendent);
  }

  for (const p of data.pharmacistTeamMembers || []) {
    if (!str(p.name) || team.members.some((m) => m.name.toLowerCase() === str(p.name).toLowerCase())) continue;
    team.members.push({
      name: str(p.name),
      role: str(p.role),
      qualifications: "",
      languages: [],
      experienceYears: "",
      specialInterests: [],
      clinicalExpertise: [],
      photoUrl: "",
      isPrimaryReviewer: false,
    });
  }

  return team;
}

function buildPatients(data: PharmacyProfileData): BusinessProfileIntelligence["patients"] {
  const patients = defaultPatientIntelligence();
  patients.uniqueSellingPoints = strArray(data.uniqueSellingPoints);
  patients.patientQuestions = strArray(data.patientQuestions);
  patients.targetGroups = strArray(data.targetPatientGroups).map(
    (label, idx): PatientGroup => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `group-${idx + 1}`,
      label,
      description: "",
      priority: idx + 1,
    }),
  );
  return patients;
}

function buildLocation(data: PharmacyProfileData): BusinessProfileIntelligence["location"] {
  const location = defaultLocationIntelligence();
  location.primaryTown = str(data.primaryTown) || str(data.townCity);
  location.primaryCity = str(data.primaryCity) || location.primaryTown;
  location.townCity = str(data.townCity) || location.primaryTown;
  location.county = str(data.county);
  location.countiesCovered = data.countiesCovered?.length
    ? strArray(data.countiesCovered)
    : location.county
      ? [location.county]
      : [];
  location.postcode = str(data.postcode);
  location.addressLine1 = str(data.addressLine1);
  location.addressLine2 = str(data.addressLine2);
  location.fullAddress = [location.addressLine1, location.addressLine2, location.townCity, location.postcode]
    .filter(Boolean)
    .join(", ");
  location.serviceRadius = str(data.coverageRadius);
  location.nearbyGpPractices = [
    ...strArray(data.localGpSurgeries),
    ...strArray(data.localGps),
    ...(data.gpSurgeries || []).map((g) => str(g.name)).filter(Boolean),
  ];
  location.nearbyHospitals = [
    ...strArray(data.nearbyHospitals),
    ...strArray(data.localHospitals),
    ...(data.hospitals || []).map((h) => str(h.name)).filter(Boolean),
  ];
  location.publicTransport = [
    ...strArray(data.localTransportLinks),
    ...(data.transportLinks || []).map((t) => str(t.name)).filter(Boolean),
  ];
  location.wheelchairAccess =
    "wheelchairAccess" in data && data.wheelchairAccess
      ? true
      : strArray(data.facilities).some((f) => /wheelchair|accessible|access/i.test(f));
  location.parking = str(data.parkingInfo)
    ? [str(data.parkingInfo)]
    : strArray(data.facilities).filter((f) => /parking/i.test(f));
  location.coverageAreas = strArray(data.coverageAreas);
  location.areasServed = (data.selectedAreas || [])
    .filter((a) => a.selected !== false && str(a.areaName))
    .map((a) => ({
      areaName: str(a.areaName),
      areaSlug: slugifyArea(str(a.areaName)),
      priority: a.priority,
      order: a.order,
      selected: a.selected !== false,
      source: str(a.source) || "profile",
    }));
  location.latitude = str(data.latitude);
  location.longitude = str(data.longitude);
  location.googlePlaceId = str(data.googlePlaceId);
  location.googleMapsEmbedUrl = str(data.googleMapsEmbedUrl);
  return location;
}

function buildIdentity(data: PharmacyProfileData): BusinessProfileIntelligence["identity"] {
  const identity = defaultBusinessIdentityIntelligence();
  identity.businessName = str(data.pharmacyName);
  identity.tradingName = str(data.tradingName) || identity.businessName;
  identity.tagline = str(data.tagline) || str(data.footerText).slice(0, 160);
  identity.businessDescription = str(data.businessDescription) || str(data.uniqueSellingPoints[0]) || "";
  identity.yearEstablished = str(data.yearEstablished) || inferYearEstablished(str(data.yearsServingCommunity));
  identity.gphc = {
    premisesNumber: str(data.gphcNumber),
    premisesUrl: str(data.gphcPremisesUrl),
    markedMissing: Boolean(data.gphcNumberMarkedMissing),
  };
  identity.superintendentPharmacist = {
    name: str(data.superintendentPharmacistName),
    markedMissing: Boolean(data.superintendentPharmacistNameMarkedMissing),
  };
  identity.independentPrescriberAvailable = Boolean(data.independentPrescriberAvailable);
  identity.pharmacistTeam = (data.pharmacistTeamMembers || []).map((p) => ({
    name: str(p.name),
    role: str(p.role),
    gphcNumber: str(p.gphcNumber),
    isIndependentPrescriber: Boolean(p.isIndependentPrescriber),
  }));
  identity.contact = {
    phone: str(data.phone),
    businessEmail: str(data.businessEmail) || str(data.email),
    nhsEmail: str(data.nhsEmail),
    primaryContactName: str(data.primaryContactName),
    emergencyContact: str(data.emergencyContact),
  };
  identity.openingHours = {
    summary: str(data.openingHours),
    monday: str(data.openingHoursMonday),
    tuesday: str(data.openingHoursTuesday),
    wednesday: str(data.openingHoursWednesday),
    thursday: str(data.openingHoursThursday),
    friday: str(data.openingHoursFriday),
    saturday: str(data.openingHoursSaturday),
    sunday: str(data.openingHoursSunday),
  };
  identity.website = str(data.website);
  identity.socialMedia = {
    facebook: str(data.socialFacebook),
    instagram: str(data.socialInstagram),
    linkedIn: str(data.socialLinkedIn),
    x: str(data.socialX),
    youTube: str(data.socialYouTube),
  };
  identity.companyName = str(data.companyName);
  identity.companyRegistrationNumber = str(data.companyRegistrationNumber);
  identity.country = str(data.country) || "United Kingdom";
  return identity;
}

function buildBrand(data: PharmacyProfileData): BusinessProfileIntelligence["brand"] {
  const brand = defaultBrandIdentityIntelligence();
  brand.primaryColour = str(data.brandPrimaryColor) || brand.primaryColour;
  brand.secondaryColour = str(data.brandSecondaryColor) || brand.secondaryColour;
  brand.accentColour = str(data.brandAccentColor) || brand.accentColour;
  brand.ctaColour = str(data.brandCtaColor) || brand.ctaColour;
  brand.backgroundColour = str(data.brandBackgroundColor) || brand.backgroundColour;
  brand.textColour = str(data.brandTextColor) || brand.textColour;
  brand.mutedTextColour = str(data.brandMutedTextColor) || brand.mutedTextColour;
  brand.logo = {
    primary: str(data.logoUrl),
    header: str(data.headerLogoUrl) || str(data.logoUrl),
    footer: str(data.footerLogoUrl) || str(data.logoUrl),
    favicon: str(data.faviconUrl),
  };
  brand.fontFamily = str(data.fontHeading) || brand.fontFamily;
  brand.headingFont = str(data.fontHeading) || brand.headingFont;
  brand.bodyFont = str(data.fontBody) || brand.bodyFont;
  brand.headingFontWeight = str(data.fontHeadingWeight) || brand.headingFontWeight;
  brand.bodyFontWeight = str(data.fontBodyWeight) || brand.bodyFontWeight;
  brand.heroStyle = str(data.heroStyle) || str(data.pageStyle) || brand.heroStyle;
  brand.photographyStyle = str(data.photographyStyle) || str(data.imageStyle) || brand.photographyStyle;
  brand.iconStyle = str(data.iconStyle) || brand.iconStyle;
  brand.ctaStyle = str(data.ctaStyleBrand) || str(data.buttonStyle) || brand.ctaStyle;
  brand.buttonStyle = str(data.buttonStyle) || brand.buttonStyle;
  brand.buttonRadius = str(data.buttonRadius) || brand.buttonRadius;
  brand.cardRadius = str(data.cardRadius) || brand.cardRadius;
  brand.pageStyle = str(data.pageStyle) || brand.pageStyle;
  return brand;
}

function buildTrust(data: PharmacyProfileData): BusinessProfileIntelligence["trust"] {
  const trust = defaultTrustIntelligence();
  trust.awards = strArray(data.awards);
  trust.reviewHighlights = strArray(data.reviewHighlights);
  trust.testimonials = (data.testimonials || []).map((t) => ({
    quote: str(t.quote),
    author: str(t.author),
    source: str(t.source),
  }));
  trust.numberOfPatients = str(data.numberOfPatients);
  trust.accreditations = strArray(data.accreditations);
  trust.yearsServingCommunity = str(data.yearsServingCommunity);
  trust.nhsProfileUrl = str(data.nhsProfileUrl);
  trust.googleBusinessProfileUrl = str(data.googleBusinessProfileUrl);
  trust.gphcPremisesUrl = str(data.gphcPremisesUrl);
  trust.independentPharmacy = Boolean(data.independentPharmacy);
  trust.consultationRoomAvailable = Boolean(data.consultationRoomAvailable);
  trust.clinicalReviewDate = str(data.clinicalReviewDate);
  trust.nextReviewDate = str(data.nextReviewDate);
  return trust;
}

function buildConversion(data: PharmacyProfileData): BusinessProfileIntelligence["conversion"] {
  const conversion = defaultConversionIntelligence();
  conversion.telephone = str(data.phone);
  conversion.email = str(data.businessEmail) || str(data.email);
  conversion.bookingUrl = str(data.bookingUrl);
  conversion.onlineBookingAvailable =
    "onlineBookingAvailable" in data ? Boolean(data.onlineBookingAvailable) : Boolean(str(data.bookingUrl));
  conversion.preferredCtaWording = str(data.preferredCtaWording) || str(data.preferredCta);
  conversion.headerCtaText = str(data.headerCtaText);
  conversion.headerCtaUrl = str(data.headerCtaUrl) || str(data.bookingUrl) || str(data.website);
  conversion.bookingMethod = str(data.bookingMethod);
  conversion.primaryCta =
    str(data.headerCtaText) ||
    str(data.preferredCta) ||
    (str(data.phone) ? `Call ${str(data.phone)}` : "");
  conversion.secondaryCta = str(data.secondaryCta) || (str(data.bookingUrl) ? "Book online" : "");
  conversion.contactFormUrl = str(data.contactFormUrl) || str(data.website);
  return conversion;
}

function buildContent(data: PharmacyProfileData): BusinessProfileIntelligence["content"] {
  const content = defaultContentIntelligence();
  const ci = data.contentIntelligence;
  const tone = str(ci?.toneOfVoice) || str(data.tone).toLowerCase();
  if (tone) content.toneOfVoice = tone;
  if (ci?.readingLevel) content.readingLevel = ci.readingLevel as typeof content.readingLevel;
  if (ci?.preferredLength) content.preferredLength = ci.preferredLength as typeof content.preferredLength;
  if (ci) {
    content.mentionPharmacists = ci.mentionPharmacists;
    content.mentionReviews = ci.mentionReviews;
    content.localReferences = ci.localReferences;
    content.faqPreferences = {
      includeTenantSpecific: ci.faqIncludeTenantSpecific,
      maxFaqs: ci.faqMaxCount,
      preferPracticalQuestions: ci.faqPreferPracticalQuestions,
    };
    if (ci.internalLinkBehaviour) {
      content.internalLinkBehaviour = ci.internalLinkBehaviour as typeof content.internalLinkBehaviour;
    }
  } else {
    content.mentionReviews = Boolean(str(data.googleBusinessProfileUrl));
  }
  content.primaryGrowthGoal = str(data.primaryGrowthGoal) || str(data.primaryGoal);
  content.rankingKeywords = strArray(data.rankingKeywords);
  return content;
}

function buildMigrationNotes(data: PharmacyProfileData): string[] {
  const notes: string[] = [];
  if (!Object.keys(buildServices(data).byServiceId).length) {
    notes.push("No services mapped — populate selectedServices or detectedWebsiteServices on profile.");
  }
  if (!str(data.bookingUrl) && /online/i.test(str(data.bookingMethod))) {
    notes.push("bookingMethod suggests online booking but bookingUrl is empty.");
  }
  if (!str(data.tagline) && !str(data.footerText)) {
    notes.push("tagline empty — add under Business Identity (V2) or footer text.");
  }
  if (!profileHasV2Fields(data)) {
    notes.push("V2 enhanced fields not populated — using legacy profile inference where available.");
  }
  return notes;
}

/**
 * Build normalized intelligence from a legacy profile document.
 * Safe to call on any existing pharmacy — unknown fields receive defaults.
 */
export function buildBusinessProfileIntelligenceFromDoc(
  doc: PharmacyProfileDoc,
): BusinessProfileIntelligence {
  return buildBusinessProfileIntelligenceFromProfile(doc.slug, doc.data, doc.updatedAt, doc.version);
}

/**
 * Build normalized intelligence from normalized profile data.
 */
export function buildBusinessProfileIntelligenceFromProfile(
  slug: string,
  data: PharmacyProfileData,
  profileUpdatedAt = "",
  profileSchemaVersion = PROFILE_SCHEMA_VERSION,
): BusinessProfileIntelligence {
  const intelligence = defaultBusinessProfileIntelligence(slug);
  intelligence.provenance = {
    builtAt: new Date().toISOString(),
    profileSlug: slug,
    profileUpdatedAt: profileUpdatedAt || new Date().toISOString(),
    profileSchemaVersion: profileSchemaVersion ?? PROFILE_SCHEMA_VERSION,
    intelligenceVersion: intelligence.version,
    migrationNotes: buildMigrationNotes(data),
  };
  intelligence.identity = buildIdentity(data);
  intelligence.brand = buildBrand(data);
  intelligence.location = buildLocation(data);
  intelligence.services = buildServices(data);
  intelligence.team = buildTeam(data);
  intelligence.patients = buildPatients(data);
  intelligence.trust = buildTrust(data);
  intelligence.conversion = buildConversion(data);
  intelligence.content = buildContent(data);
  intelligence.ai = defaultAiIntelligence();
  return intelligence;
}

/**
 * Extension point (Phase 2): derive generator-facing content intelligence slice.
 * Not consumed by generators in Phase 1.
 */
export function toContentIntelligenceContext(
  intelligence: BusinessProfileIntelligence,
  opts?: { serviceId?: string; localArea?: string },
) {
  return {
    intelligence,
    serviceId: opts?.serviceId,
    localArea: opts?.localArea || intelligence.location.primaryTown,
  };
}
