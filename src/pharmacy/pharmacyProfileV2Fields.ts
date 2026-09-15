/**
 * Pharmacy Profile V2 enhanced fields — storage types and normalization.
 * Phase 2: profile data + UI only. Not wired to generators.
 */
import type { ServiceFundingModel } from "./businessProfileIntelligence/businessProfileIntelligenceTypes.ts";

export const PROFILE_V2_FIELDS_VERSION = 2;

export type ProfileServiceFundingModel = ServiceFundingModel;
export type ProfileUkNation = "unknown" | "england" | "scotland" | "wales" | "northern-ireland";
export type ProfileServiceDeliveryMode = "unknown" | "in-person" | "remote" | "both";
export type ProfilePrescribingSupplyStatus =
  | "unknown"
  | "none"
  | "pgd"
  | "independent-prescriber"
  | "pharmacy-supply"
  | "mixed";
export type ProfileServiceFeeKind = "unknown" | "free" | "included" | "fixed" | "from" | "variable";
export type ProfileDepositStatus = "unknown" | "none" | "required";
export type ProfileClinicalReviewerStatus = "unknown" | "suggested" | "confirmed";

export interface ProfileServiceFee {
  kind: ProfileServiceFeeKind;
  amount: string;
  notes: string;
}

export interface ProfilePharmacistTeamMember {
  name: string;
  role: string;
  gphcNumber: string;
  isIndependentPrescriber: boolean;
}

export interface ProfileServiceDeliveryProfile {
  serviceId: string;
  serviceName: string;
  fundingModel: ProfileServiceFundingModel;
  appointmentRequired: boolean | null;
  walkInAvailable: boolean | null;
  consultationLengthMinutes: number | null;
  consultationLengthLabel: string;
  equipmentUsed: string[];
  preparationRequired: string[];
  aftercare: string[];
  resultsProcess: string;
  referralProcess: string;
  pricing: string;
  ageRestrictions: string;
  ukNation: ProfileUkNation;
  physicalBranchOffered: boolean | null;
  physicalBranchName: string;
  physicalBranchConfirmed: boolean;
  deliveryMode: ProfileServiceDeliveryMode;
  prescribingSupplyStatus: ProfilePrescribingSupplyStatus;
  prescribingSupplyConfirmed: boolean;
  consultationFee: ProfileServiceFee;
  treatmentFee: ProfileServiceFee;
  followUpFee: ProfileServiceFee;
  depositStatus: ProfileDepositStatus;
  depositAmount: string;
  depositTerms: string;
  cancellationTerms: string;
  clinicalReviewerName: string;
  clinicalReviewerRole: string;
  clinicalReviewerStatus: ProfileClinicalReviewerStatus;
}

export interface ProfileTeamMemberRecord {
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

export interface ProfileTestimonialRecord {
  quote: string;
  author: string;
  source: string;
}

export interface ProfileContentIntelligenceStorage {
  toneOfVoice: string;
  readingLevel: "plain-english" | "standard" | "detailed" | string;
  preferredLength: "concise" | "standard" | "comprehensive" | string;
  mentionPharmacists: boolean;
  mentionReviews: boolean;
  localReferences: boolean;
  faqIncludeTenantSpecific: boolean;
  faqMaxCount: number;
  faqPreferPracticalQuestions: boolean;
  internalLinkBehaviour: "service-first" | "local-first" | "balanced" | string;
}

export interface PharmacyProfileV2Extension {
  tagline: string;
  businessDescription: string;
  yearEstablished: string;
  independentPrescriberAvailable: boolean;
  pharmacistTeamMembers: ProfilePharmacistTeamMember[];
  heroStyle: string;
  photographyStyle: string;
  iconStyle: string;
  ctaStyleBrand: string;
  countiesCovered: string[];
  parkingInfo: string;
  wheelchairAccess: boolean;
  serviceDeliveryProfiles: Record<string, ProfileServiceDeliveryProfile>;
  meetTheTeamIntro: string;
  teamMembers: ProfileTeamMemberRecord[];
  awards: string[];
  reviewHighlights: string[];
  testimonials: ProfileTestimonialRecord[];
  numberOfPatients: string;
  secondaryCta: string;
  contactFormUrl: string;
  onlineBookingAvailable: boolean;
  preferredCtaWording: string;
  contentIntelligence: ProfileContentIntelligenceStorage;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === true) return true;
  if (v === "false" || v === false) return false;
  return fallback;
}

function nullableBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === "") return null;
  return bool(v);
}

function parseMinutes(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function defaultProfileServiceFee(): ProfileServiceFee {
  return { kind: "unknown", amount: "", notes: "" };
}

const FEE_KINDS = new Set<ProfileServiceFeeKind>(["unknown", "free", "included", "fixed", "from", "variable"]);
const UK_NATIONS = new Set<ProfileUkNation>(["unknown", "england", "scotland", "wales", "northern-ireland"]);
const DELIVERY_MODES = new Set<ProfileServiceDeliveryMode>(["unknown", "in-person", "remote", "both"]);
const PRESCRIBING_STATUSES = new Set<ProfilePrescribingSupplyStatus>([
  "unknown",
  "none",
  "pgd",
  "independent-prescriber",
  "pharmacy-supply",
  "mixed",
]);
const DEPOSIT_STATUSES = new Set<ProfileDepositStatus>(["unknown", "none", "required"]);
const REVIEWER_STATUSES = new Set<ProfileClinicalReviewerStatus>(["unknown", "suggested", "confirmed"]);

function enumOrUnknown<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const raw = str(value).toLowerCase();
  if (allowed.has(raw as T)) return raw as T;
  return fallback;
}

export function normalizeProfileServiceFee(raw: unknown): ProfileServiceFee {
  const base = defaultProfileServiceFee();
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && str(raw)) {
      const kind = enumOrUnknown(raw, FEE_KINDS, "unknown");
      return { ...base, kind };
    }
    return base;
  }
  const item = raw as Record<string, unknown>;
  const kind = enumOrUnknown(item.kind, FEE_KINDS, "unknown");
  const amount = kind === "fixed" || kind === "from" ? str(item.amount) : "";
  return {
    kind,
    amount,
    notes: str(item.notes),
  };
}

export function defaultProfileContentIntelligence(): ProfileContentIntelligenceStorage {
  return {
    toneOfVoice: "professional",
    readingLevel: "plain-english",
    preferredLength: "standard",
    mentionPharmacists: true,
    mentionReviews: false,
    localReferences: true,
    faqIncludeTenantSpecific: true,
    faqMaxCount: 10,
    faqPreferPracticalQuestions: true,
    internalLinkBehaviour: "balanced",
  };
}

export function defaultProfileServiceDelivery(
  serviceId: string,
  serviceName = "",
): ProfileServiceDeliveryProfile {
  return {
    serviceId,
    serviceName: serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    fundingModel: "unknown",
    appointmentRequired: null,
    walkInAvailable: null,
    consultationLengthMinutes: null,
    consultationLengthLabel: "",
    equipmentUsed: [],
    preparationRequired: [],
    aftercare: [],
    resultsProcess: "",
    referralProcess: "",
    pricing: "",
    ageRestrictions: "",
    ukNation: "unknown",
    physicalBranchOffered: null,
    physicalBranchName: "",
    physicalBranchConfirmed: false,
    deliveryMode: "unknown",
    prescribingSupplyStatus: "unknown",
    prescribingSupplyConfirmed: false,
    consultationFee: defaultProfileServiceFee(),
    treatmentFee: defaultProfileServiceFee(),
    followUpFee: defaultProfileServiceFee(),
    depositStatus: "unknown",
    depositAmount: "",
    depositTerms: "",
    cancellationTerms: "",
    clinicalReviewerName: "",
    clinicalReviewerRole: "",
    clinicalReviewerStatus: "unknown",
  };
}

export function defaultPharmacyProfileV2Extension(): PharmacyProfileV2Extension {
  return {
    tagline: "",
    businessDescription: "",
    yearEstablished: "",
    independentPrescriberAvailable: false,
    pharmacistTeamMembers: [],
    heroStyle: "",
    photographyStyle: "",
    iconStyle: "",
    ctaStyleBrand: "",
    countiesCovered: [],
    parkingInfo: "",
    wheelchairAccess: false,
    serviceDeliveryProfiles: {},
    meetTheTeamIntro: "",
    teamMembers: [],
    awards: [],
    reviewHighlights: [],
    testimonials: [],
    numberOfPatients: "",
    secondaryCta: "",
    contactFormUrl: "",
    onlineBookingAvailable: false,
    preferredCtaWording: "",
    contentIntelligence: defaultProfileContentIntelligence(),
  };
}

export function normalizePharmacistTeamMembers(raw: unknown): ProfilePharmacistTeamMember[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const name = str(item.name);
      if (!name) return null;
      return {
        name,
        role: str(item.role),
        gphcNumber: str(item.gphcNumber),
        isIndependentPrescriber: bool(item.isIndependentPrescriber),
      };
    })
    .filter(Boolean) as ProfilePharmacistTeamMember[];
}

export function normalizeTeamMemberRecords(raw: unknown): ProfileTeamMemberRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const name = str(item.name);
      if (!name) return null;
      return {
        name,
        role: str(item.role),
        qualifications: str(item.qualifications),
        languages: strArray(item.languages),
        experienceYears: str(item.experienceYears),
        specialInterests: strArray(item.specialInterests),
        clinicalExpertise: strArray(item.clinicalExpertise),
        photoUrl: str(item.photoUrl),
        isPrimaryReviewer: bool(item.isPrimaryReviewer),
      };
    })
    .filter(Boolean) as ProfileTeamMemberRecord[];
}

export function normalizeTestimonials(raw: unknown): ProfileTestimonialRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = row as Record<string, unknown>;
      const quote = str(item.quote);
      if (!quote) return null;
      return {
        quote,
        author: str(item.author),
        source: str(item.source),
      };
    })
    .filter(Boolean) as ProfileTestimonialRecord[];
}

export function normalizeServiceDeliveryProfile(
  serviceId: string,
  raw: unknown,
  fallbackName = "",
): ProfileServiceDeliveryProfile {
  const base = defaultProfileServiceDelivery(serviceId, fallbackName);
  if (!raw || typeof raw !== "object") return base;
  const item = raw as Record<string, unknown>;
  const funding = str(item.fundingModel).toLowerCase();
  const fundingModel: ProfileServiceFundingModel =
    funding === "nhs" || funding === "private" || funding === "mixed"
      ? funding
      : funding === "both"
        ? "mixed"
        : base.fundingModel;
  const reviewerName = str(item.clinicalReviewerName);
  const reviewerStatus = enumOrUnknown(item.clinicalReviewerStatus, REVIEWER_STATUSES, "unknown");
  const prescribingStatus = enumOrUnknown(item.prescribingSupplyStatus, PRESCRIBING_STATUSES, "unknown");
  const depositStatus = enumOrUnknown(item.depositStatus, DEPOSIT_STATUSES, "unknown");
  const physicalOffered = nullableBool(item.physicalBranchOffered);

  return {
    serviceId,
    serviceName: str(item.serviceName) || base.serviceName,
    fundingModel,
    appointmentRequired: nullableBool(item.appointmentRequired),
    walkInAvailable: nullableBool(item.walkInAvailable),
    consultationLengthMinutes: parseMinutes(item.consultationLengthMinutes),
    consultationLengthLabel: str(item.consultationLengthLabel),
    equipmentUsed: strArray(item.equipmentUsed),
    preparationRequired: strArray(item.preparationRequired),
    aftercare: strArray(item.aftercare),
    resultsProcess: str(item.resultsProcess),
    referralProcess: str(item.referralProcess),
    pricing: str(item.pricing),
    ageRestrictions: str(item.ageRestrictions),
    ukNation: enumOrUnknown(item.ukNation, UK_NATIONS, "unknown"),
    physicalBranchOffered: physicalOffered,
    physicalBranchName: str(item.physicalBranchName),
    physicalBranchConfirmed: physicalOffered === true ? bool(item.physicalBranchConfirmed) : false,
    deliveryMode: enumOrUnknown(item.deliveryMode, DELIVERY_MODES, "unknown"),
    prescribingSupplyStatus: prescribingStatus,
    prescribingSupplyConfirmed:
      prescribingStatus === "unknown" || prescribingStatus === "none" ? false : bool(item.prescribingSupplyConfirmed),
    consultationFee: normalizeProfileServiceFee(item.consultationFee),
    treatmentFee: normalizeProfileServiceFee(item.treatmentFee),
    followUpFee: normalizeProfileServiceFee(item.followUpFee),
    depositStatus,
    depositAmount: depositStatus === "required" ? str(item.depositAmount) : "",
    depositTerms: depositStatus === "required" ? str(item.depositTerms) : "",
    cancellationTerms: str(item.cancellationTerms),
    clinicalReviewerName: reviewerName,
    clinicalReviewerRole: str(item.clinicalReviewerRole),
    clinicalReviewerStatus: reviewerName
      ? reviewerStatus === "confirmed" || reviewerStatus === "suggested"
        ? reviewerStatus
        : "unknown"
      : "unknown",
  };
}

const SERVICE_FEE_OBJECT_KEYS = ["consultationFee", "treatmentFee", "followUpFee"] as const;

/** Shallow-merge stored service records with a partial save payload. Does not drop existing services. */
export function mergeServiceDeliveryProfileMaps(
  existing: unknown,
  incoming: unknown,
): Record<string, unknown> {
  const prev =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  const next =
    incoming && typeof incoming === "object" && !Array.isArray(incoming)
      ? (incoming as Record<string, unknown>)
      : {};
  const out: Record<string, unknown> = { ...prev };
  for (const [serviceId, row] of Object.entries(next)) {
    if (!serviceId) continue;
    const prevRow =
      prev[serviceId] && typeof prev[serviceId] === "object" && !Array.isArray(prev[serviceId])
        ? (prev[serviceId] as Record<string, unknown>)
        : {};
    const nextRow = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
    const merged: Record<string, unknown> = { ...prevRow, ...nextRow };
    for (const key of SERVICE_FEE_OBJECT_KEYS) {
      const a = prevRow[key];
      const b = nextRow[key];
      if (a && typeof a === "object" && b && typeof b === "object") {
        merged[key] = { ...(a as Record<string, unknown>), ...(b as Record<string, unknown>) };
      }
    }
    out[serviceId] = merged;
  }
  return out;
}

export function normalizeServiceDeliveryProfiles(
  raw: unknown,
  serviceIds: string[] = [],
): Record<string, ProfileServiceDeliveryProfile> {
  const out: Record<string, ProfileServiceDeliveryProfile> = {};
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const ids = [...new Set([...Object.keys(source), ...serviceIds])];
  for (const serviceId of ids) {
    if (!serviceId) continue;
    out[serviceId] = normalizeServiceDeliveryProfile(serviceId, source[serviceId]);
  }
  return out;
}

export function normalizeProfileContentIntelligence(raw: unknown): ProfileContentIntelligenceStorage {
  const base = defaultProfileContentIntelligence();
  if (!raw || typeof raw !== "object") return base;
  const item = raw as Record<string, unknown>;
  const maxFaqs = Number(item.faqMaxCount);
  return {
    toneOfVoice: str(item.toneOfVoice) || base.toneOfVoice,
    readingLevel: str(item.readingLevel) || base.readingLevel,
    preferredLength: str(item.preferredLength) || base.preferredLength,
    mentionPharmacists: "mentionPharmacists" in item ? bool(item.mentionPharmacists, base.mentionPharmacists) : base.mentionPharmacists,
    mentionReviews: "mentionReviews" in item ? bool(item.mentionReviews, base.mentionReviews) : base.mentionReviews,
    localReferences: "localReferences" in item ? bool(item.localReferences, base.localReferences) : base.localReferences,
    faqIncludeTenantSpecific:
      "faqIncludeTenantSpecific" in item
        ? bool(item.faqIncludeTenantSpecific, base.faqIncludeTenantSpecific)
        : base.faqIncludeTenantSpecific,
    faqMaxCount: Number.isFinite(maxFaqs) && maxFaqs > 0 ? Math.min(30, Math.round(maxFaqs)) : base.faqMaxCount,
    faqPreferPracticalQuestions:
      "faqPreferPracticalQuestions" in item
        ? bool(item.faqPreferPracticalQuestions, base.faqPreferPracticalQuestions)
        : base.faqPreferPracticalQuestions,
    internalLinkBehaviour: str(item.internalLinkBehaviour) || base.internalLinkBehaviour,
  };
}

/** Merge V2 extension fields from raw profile JSON into normalized shape. */
export function normalizePharmacyProfileV2Extension(
  raw: Record<string, unknown>,
  serviceIds: string[] = [],
): PharmacyProfileV2Extension {
  const base = defaultPharmacyProfileV2Extension();
  const ciRaw =
    raw.contentIntelligence && typeof raw.contentIntelligence === "object"
      ? raw.contentIntelligence
      : {
          toneOfVoice: raw.contentToneOfVoice,
          readingLevel: raw.contentReadingLevel,
          preferredLength: raw.contentPreferredLength,
          mentionPharmacists: raw.contentMentionPharmacists,
          mentionReviews: raw.contentMentionReviews,
          localReferences: raw.contentLocalReferences,
          faqIncludeTenantSpecific: raw.contentFaqIncludeTenant,
          faqMaxCount: raw.contentFaqMaxCount,
          faqPreferPracticalQuestions: raw.contentFaqPreferPractical,
          internalLinkBehaviour: raw.contentInternalLinkBehaviour,
        };

  return {
    tagline: str(raw.tagline),
    businessDescription: str(raw.businessDescription),
    yearEstablished: str(raw.yearEstablished),
    independentPrescriberAvailable: bool(raw.independentPrescriberAvailable),
    pharmacistTeamMembers: normalizePharmacistTeamMembers(raw.pharmacistTeamMembers),
    heroStyle: str(raw.heroStyle),
    photographyStyle: str(raw.photographyStyle),
    iconStyle: str(raw.iconStyle),
    ctaStyleBrand: str(raw.ctaStyleBrand),
    countiesCovered: strArray(raw.countiesCovered),
    parkingInfo: str(raw.parkingInfo),
    wheelchairAccess: bool(raw.wheelchairAccess),
    serviceDeliveryProfiles: normalizeServiceDeliveryProfiles(raw.serviceDeliveryProfiles, serviceIds),
    meetTheTeamIntro: str(raw.meetTheTeamIntro),
    teamMembers: normalizeTeamMemberRecords(raw.teamMembers),
    awards: strArray(raw.awards),
    reviewHighlights: strArray(raw.reviewHighlights),
    testimonials: normalizeTestimonials(raw.testimonials),
    numberOfPatients: str(raw.numberOfPatients),
    secondaryCta: str(raw.secondaryCta),
    contactFormUrl: str(raw.contactFormUrl),
    onlineBookingAvailable: bool(raw.onlineBookingAvailable),
    preferredCtaWording: str(raw.preferredCtaWording) || str(raw.preferredCta),
    contentIntelligence: normalizeProfileContentIntelligence(ciRaw),
  };
}

export function collectServiceIdsFromProfile(raw: Record<string, unknown>): string[] {
  const selected = strArray(raw.selectedServices);
  const priority = strArray(raw.priorityServices);
  const detected = Array.isArray(raw.detectedWebsiteServices)
    ? (raw.detectedWebsiteServices as Array<{ serviceId?: string }>).map((d) => str(d.serviceId)).filter(Boolean)
    : [];
  const fromDelivery =
    raw.serviceDeliveryProfiles && typeof raw.serviceDeliveryProfiles === "object"
      ? Object.keys(raw.serviceDeliveryProfiles as object)
      : [];
  const merged = [...new Set([...selected, ...priority, ...detected, ...fromDelivery])];
  // Classification gate: do not let incompatible clinical residue contaminate non-clinical tenants.
  const intel = (raw.websiteImportSnapshot as { intelligence?: Record<string, unknown> } | undefined)?.intelligence;
  const bc = (intel?.businessClassification || {}) as Record<string, unknown>;
  const clinicalEnabled = bc.clinicalServiceDetectionEnabled === true;
  const cls = typeof bc.class === "string" ? bc.class : "";
  const nonClinicalClass = cls === "digital_agency" || cls === "supplier" || cls === "agency";
  if (!clinicalEnabled && (nonClinicalClass || priority.length > 0)) {
    const clinicalIds = new Set([
      "pharmacy-first",
      "blood-pressure-checks",
      "travel-vaccinations",
      "flu-vaccinations",
      "prescription-dispensing",
      "emergency-contraception",
      "repeat-prescriptions",
      "pharmacy-contraception-service",
      "new-medicine-service",
      "malaria-prevention",
      "medication-reviews",
      "ear-wax-removal",
      "covid-vaccinations",
      "discharge-medicines-service",
      "smoking-cessation",
      "weight-management",
      "health-checks",
      "private-prescribing",
      "independent-prescriber",
      "minor-ailments",
      "vaccinations",
    ]);
    return merged.filter((id) => !clinicalIds.has(String(id).toLowerCase()));
  }
  return merged;
}
