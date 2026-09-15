/**
 * Service page — Business Profile Intelligence phrase and section helpers.
 * Reuses long-form phrase helpers; profile-first with legacy fallbacks when context is absent.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { isApprovedBankRegisteredService } from "./pharmacyServiceVariantLibrary.ts";
import {
  buildProfileBackedFaqEntries,
  collectIntelligenceSentences,
  intelligenceSupportsClaim,
  phraseBusinessDescription,
  phraseBookingCta,
  phraseConsultationLength,
  phraseConsultationRoom,
  phraseIndependentPrescriber,
  phraseLanguages,
  phraseOnlineBooking,
  phraseParking,
  phraseResultsProcess,
  phraseServiceAftercare,
  phraseServiceEquipment,
  phraseServicePreparation,
  phraseServicePricing,
  phraseTagline,
  phraseWalkIn,
  phraseWheelchairAccess,
  phraseYearsServing,
  teamSubjectPhrase,
} from "./contentEngine/pharmacyLongFormIntelligencePhrases.ts";
import { collectLocalMarketSentences } from "./contentEngine/pharmacyLocalMarketIntelligencePhrases.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import type { ProfileTrustCard } from "./pharmacyServicePageTrustInjection.ts";

export { intelligenceSupportsClaim };

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function hasServicePageIntelligence(ctx?: ContentGenerationContext): ctx is ContentGenerationContext {
  return Boolean(ctx?.businessProfileIntelligence?.slug);
}

/** Presentation narrative selection — Pharmacy First vs other approved services. */
export function isPharmacyFirstService(serviceId?: string, serviceName?: string): boolean {
  const id = String(serviceId || "").toLowerCase().trim();
  const name = String(serviceName || "").toLowerCase().trim();
  return id === "pharmacy-first" || name.includes("pharmacy first");
}

export function isTravelVaccinationsService(serviceId?: string, serviceName?: string): boolean {
  const id = String(serviceId || "").toLowerCase().trim();
  const name = String(serviceName || "").toLowerCase().trim();
  return id === "travel-vaccinations" || name.includes("travel vaccination");
}

export function servicePageConditionsIntro(serviceId?: string, serviceName?: string): string {
  if (isPharmacyFirstService(serviceId, serviceName)) {
    return "The Pharmacy First service covers seven NHS clinical pathways. The pharmacist will confirm whether your symptoms fit the pathway before any treatment is supplied.";
  }
  return "";
}

export function servicePageEligibilityIntro(serviceId?: string, serviceName?: string): string {
  if (isPharmacyFirstService(serviceId, serviceName)) {
    return "The pharmacist will check NHS pathway criteria before treatment is supplied.";
  }
  return "";
}

export function servicePageTrustFallbackProse(
  profile: PharmacyServicePageProfile,
  serviceName: string,
  serviceId?: string,
): string {
  const name = profile.pharmacyName;
  if (isPharmacyFirstService(serviceId, serviceName)) {
    return `${name} is your local pharmacy team for ${serviceName}. The pharmacist will explain whether Pharmacy First is suitable, when treatment can be supplied, and when another NHS service is more appropriate.`;
  }
  if (isTravelVaccinationsService(serviceId, serviceName)) {
    return `${name} is your local pharmacy team for ${serviceName}. The pharmacist will discuss destination-based vaccine recommendations, what can be offered locally, and when another service may be more appropriate.`;
  }
  return `${name} is your local pharmacy team for ${serviceName}. The pharmacist will explain what the consultation covers and the next steps that are appropriate for you.`;
}

export interface ServiceProcessFallbackStep {
  title: string;
  body: string;
}

export function servicePageProcessFallbackSteps(
  profile: PharmacyServicePageProfile,
  serviceName: string,
  serviceId?: string,
): ServiceProcessFallbackStep[] {
  const name = profile.pharmacyName;
  if (isTravelVaccinationsService(serviceId, serviceName)) {
    return [
      {
        title: "Travel itinerary discussion",
        body: `Contact ${name} to discuss your destination, trip length, season and planned activities before travel.`,
      },
      {
        title: "Travel health assessment",
        body: profile.consultationRoomAvailable
          ? "Speak with the pharmacist in a private consultation room so they can review your medical and vaccination history."
          : "Speak with the pharmacist in a confidential consultation so they can review your medical and vaccination history.",
      },
      {
        title: "Destination-specific recommendations",
        body: "The pharmacist discusses destination-based vaccine recommendations and practical travel-health precautions for your itinerary.",
      },
      {
        title: "Vaccination planning",
        body: "Where clinically appropriate, authorised and available, vaccines can be given with documentation and advice on any follow-up doses.",
      },
    ];
  }
  if (isPharmacyFirstService(serviceId, serviceName)) {
    return [
      {
        title: `Contact ${name}`,
        body: `Contact ${name} to check availability and confirm that Pharmacy First is suitable for your symptoms.`,
      },
      {
        title: "Private consultation",
        body: profile.consultationRoomAvailable
          ? "Speak with the pharmacist in a private consultation room so they can assess symptoms, medicines, allergies and red flags."
          : "Speak with the pharmacist in a confidential consultation so they can assess symptoms, medicines, allergies and red flags.",
      },
      {
        title: "Your outcome",
        body: "The pharmacist explains whether treatment can be supplied, whether self-care is best, or whether another NHS service is needed.",
      },
      {
        title: "Follow-up care",
        body: "You leave with safety-netting advice, expected recovery times and clear next steps if symptoms worsen.",
      },
    ];
  }
  return [
    {
      title: "Contact the pharmacy",
      body: `Contact the pharmacy to ask how ${serviceName.toLowerCase()} are arranged.`,
    },
    {
      title: "Private consultation",
      body: profile.consultationRoomAvailable
        ? "Speak with the pharmacist in a private consultation room so they can understand your needs and medical history."
        : "Speak with the pharmacist in a confidential consultation so they can understand your needs and medical history.",
    },
    {
      title: "Your outcome",
      body: `The pharmacist explains the ${serviceName} options available and whether another service is more appropriate.`,
    },
    {
      title: "Follow-up care",
      body: "You leave with clear advice and next steps for follow-up where needed.",
    },
  ];
}

export function servicePageHeroIntro(
  ctx: ContentGenerationContext | undefined,
  profile: PharmacyServicePageProfile,
  serviceName: string,
): string {
  const name = profile.pharmacyName;
  const town = profile.town;
  const phone = profile.displayPhone || profile.phone;
  const team = ctx ? teamSubjectPhrase(ctx) : null;
  const desc = ctx ? phraseBusinessDescription(ctx) : null;
  const tagline = ctx ? phraseTagline(ctx) : null;
  const arrange = phone
    ? `Call ${phone} to ask how blood pressure checks are arranged.`
    : "Contact the pharmacy to ask how blood pressure checks are arranged.";
  const arrangeGeneric = phone
    ? `Call ${phone} to ask how ${serviceName.toLowerCase()} are arranged.`
    : `Contact the pharmacy to ask how ${serviceName.toLowerCase()} are arranged.`;
  const closer = /blood pressure/i.test(serviceName) ? arrange : arrangeGeneric;

  if (desc) {
    const provider = team ? `${team} at ${name}` : name;
    return `${desc} ${provider}${town ? ` in ${town}` : ""} provides ${serviceName} with pharmacist-led assessment and advice. ${closer}`;
  }
  if (tagline) {
    return `${tagline} — ${name}${town ? ` in ${town}` : ""} provides ${serviceName}. ${closer}`;
  }
  if (team) {
    return `${team} at ${name}${town ? ` in ${town}` : ""} provides ${serviceName} — pharmacist-led assessment and advice for local patients. ${closer}`;
  }
  return town
    ? `${name} in ${town} provides ${serviceName} — pharmacist-led assessment and advice for local patients. ${closer}`
    : `${name} provides ${serviceName} with pharmacist-led assessment and advice. ${closer}`;
}

export function servicePageHeroEyebrow(
  ctx: ContentGenerationContext | undefined,
  profile: PharmacyServicePageProfile,
  serviceName: string,
): string {
  const tagline = ctx ? phraseTagline(ctx) : null;
  if (tagline) return `${profile.pharmacyName} · ${tagline} · ${serviceName}`;
  return `${profile.pharmacyName} · ${profile.town} · ${serviceName}`;
}

export function preferredServicePageCta(
  ctx: ContentGenerationContext | undefined,
  profile: PharmacyServicePageProfile,
): string {
  const delivery = (
    ctx?.rawProfile as { serviceDeliveryProfiles?: Record<string, { appointmentRequired?: boolean | null }> } | undefined
  )?.serviceDeliveryProfiles?.[ctx?.serviceId || ""];
  const appointmentRequired = delivery?.appointmentRequired ?? null;
  if (appointmentRequired !== true) {
    return "Contact the pharmacy";
  }
  if (profile.headerCtaText && !/call pharmacy/i.test(profile.headerCtaText)) return profile.headerCtaText;
  const wording = ctx ? str(ctx.businessProfileIntelligence.conversion.preferredCtaWording) : "";
  if (wording && !/call pharmacy/i.test(wording)) return wording;
  if (profile.primaryCta && !/call pharmacy/i.test(profile.primaryCta)) return profile.primaryCta;
  if (profile.bookingUrl) return "Book An Appointment";
  return `Speak to ${profile.pharmacyName}`;
}

/** Confirmed http(s) pharmacy website only — never tel:/mailto:/booking placeholders. */
export function resolveConfirmedPharmacyWebsite(profile: { website?: string | null }): string {
  const raw = String(profile.website || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return "";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)\b/i.test(raw)) return "";
  return raw.replace(/\/+$/, "") === raw ? raw : raw; // keep as stored
}

/**
 * Shared Contact CTA destination.
 * Confirmed website → website; otherwise confirmed tel:; never put the phone number in the button label.
 */
export function resolveContactCtaHref(
  profile: { website?: string | null; phone?: string | null; bookingUrl?: string | null; headerCtaUrl?: string | null; headerCtaText?: string | null; showProminentTelephoneCta?: boolean },
  label?: string,
): string {
  const ctaLabel = String(label || "").trim();
  const website = resolveConfirmedPharmacyWebsite(profile);
  const tel = String(profile.phone || "").replace(/\s/g, "");

  if (/contact the pharmacy/i.test(ctaLabel)) {
    if (website) return website;
    if (tel) return `tel:${tel}`;
    return "#contact";
  }

  // Explicit call-labelled CTAs dial; phone number itself stays out of the button text.
  if (/^call\b/i.test(ctaLabel) && tel) return `tel:${tel}`;

  if (profile.headerCtaUrl && !/call|contact the pharmacy/i.test(profile.headerCtaText || "")) {
    return String(profile.headerCtaUrl);
  }
  if (profile.bookingUrl) return String(profile.bookingUrl);
  if (website) return website;
  if (tel && profile.showProminentTelephoneCta) return `tel:${tel}`;
  return tel ? `tel:${tel}` : "#contact";
}

export function enrichTrustCards(
  ctx: ContentGenerationContext | undefined,
  profile: PharmacyServicePageProfile,
  baseCards: ProfileTrustCard[],
): ProfileTrustCard[] {
  if (!ctx) return baseCards;
  const intel = ctx.businessProfileIntelligence;
  const cards = baseCards.map((c) => ({ ...c }));

  const years = phraseYearsServing(ctx);
  if (years && cards[3]) {
    cards[3] = { ...cards[3], body: `${cards[3].body} ${years}` };
  }

  const awards = intel.trust.awards.filter(Boolean);
  if (awards.length && cards[0]) {
    cards[0] = {
      title: "Recognised pharmacy team",
      body: awards.slice(0, 2).join(". ") + (awards[0]!.endsWith(".") ? "" : "."),
    };
  }

  const accreditations = intel.trust.accreditations
    .map((item) => String(item || "").trim())
    .filter((item) => item && item !== "[]" && !/^n\/a$/i.test(item));
  if (accreditations.length && !awards.length && cards[0]) {
    cards[0] = {
      title: "Accreditations & registration",
      body: `${profile.pharmacyName} holds ${accreditations.join(", ")}${profile.gphcNumber ? ` (GPhC premises ${profile.gphcNumber})` : "."}`,
    };
  }

  const reviewHighlight = intel.trust.reviewHighlights.find(Boolean);
  if (reviewHighlight && cards[2]) {
    cards[2] = {
      ...cards[2],
      body: `${cards[2].body} ${reviewHighlight}.`,
    };
  }

  const prescriber = phraseIndependentPrescriber(ctx);
  if (prescriber && cards[1]) {
    cards[1] = { ...cards[1], body: `${cards[1].body} ${prescriber}` };
  }

  return cards;
}

export function servicePageProcessIntro(
  ctx: ContentGenerationContext | undefined,
  profile: PharmacyServicePageProfile,
  serviceName: string,
): string {
  const base = `How your ${serviceName} consultation works at ${profile.pharmacyName}.`;
  if (!ctx || isApprovedBankRegisteredService(ctx.serviceId)) return base;
  const extras = collectIntelligenceSentences([
    phraseConsultationRoom(ctx),
    phraseConsultationLength(ctx),
    phraseWalkIn(ctx),
  ]);
  return extras.length ? `${base} ${extras.join(" ")}` : base;
}

export function servicePageDefinitionExtras(ctx: ContentGenerationContext | undefined): string[] {
  if (!ctx) return [];
  return collectIntelligenceSentences([
    phraseServicePricing(ctx),
    phraseResultsProcess(ctx),
    phraseIndependentPrescriber(ctx),
  ]);
}

export function servicePageSupportExtras(ctx: ContentGenerationContext | undefined): string[] {
  if (!ctx || isApprovedBankRegisteredService(ctx.serviceId)) return [];
  return collectIntelligenceSentences([
    phraseServicePreparation(ctx),
    phraseServiceEquipment(ctx),
    phraseConsultationRoom(ctx),
  ]);
}

export function servicePageTrustProseExtras(ctx: ContentGenerationContext | undefined): string[] {
  if (!ctx) return [];
  return collectIntelligenceSentences([
    phraseYearsServing(ctx),
    phraseIndependentPrescriber(ctx),
    ...(ctx.businessProfileIntelligence.trust.testimonials.slice(0, 1).map((t) => t.quote) || []),
  ]);
}

export function servicePageLocalExtras(ctx: ContentGenerationContext | undefined): string[] {
  if (!ctx) return [];
  return collectIntelligenceSentences([
    phraseParking(ctx),
    phraseWheelchairAccess(ctx),
    phraseLanguages(ctx),
    ...collectLocalMarketSentences(ctx),
  ]);
}

export function servicePageFinalCtaBody(
  ctx: ContentGenerationContext | undefined,
  profile: PharmacyServicePageProfile,
  serviceName: string,
): string {
  const bookingIntel = ctx ? phraseBookingCta(ctx) : null;
  if (bookingIntel) return bookingIntel;

  const name = profile.pharmacyName;
  const phone = profile.displayPhone || profile.phone;
  const serviceLower = serviceName.toLowerCase();
  const online = ctx ? phraseOnlineBooking(ctx) : null;
  const walkIn = ctx ? phraseWalkIn(ctx) : null;
  const parts: string[] = [];
  if (online) parts.push(online);
  if (walkIn) parts.push(walkIn);
  if (parts.length) {
    return `${parts.join(" ")} Call ${name} on ${phone} to ask about ${serviceLower} availability.`;
  }
  return `Call ${name} on ${phone} to ask about ${serviceLower.includes("pharmacy first") ? "Pharmacy First availability, appointment options, or whether walk-in support is available" : `${serviceName} availability, appointment options, or whether walk-in support is available`}.`;
}

export function servicePageFaqEntries(
  ctx: ContentGenerationContext | undefined,
): Array<{ question: string; answer: string }> {
  if (!ctx) return [];
  return buildProfileBackedFaqEntries(ctx).map((f) => ({ question: f.question, answer: f.answer }));
}

export function appendExtrasToParagraph(paragraph: string, extras: string[]): string {
  if (!extras.length) return paragraph;
  let out = paragraph.trim();
  for (const extra of extras) {
    const trimmed = String(extra || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s'-]/g, "").trim();
    const existing = out.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s'-]/g, "");
    if (key.length >= 20 && existing.includes(key)) continue;
    out = `${out} ${trimmed}`;
  }
  return out.replace(/\s{2,}/g, " ").trim();
}
