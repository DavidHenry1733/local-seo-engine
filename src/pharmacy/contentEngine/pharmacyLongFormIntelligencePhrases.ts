/**
 * Long-form supporting content — Business Profile Intelligence phrase helpers.
 * Profile-first: returns null when intelligence has no backing data so callers keep legacy copy.
 */
import type { BusinessProfileIntelligence } from "../businessProfileIntelligence/businessProfileIntelligenceTypes.ts";
import type { ServiceDeliveryIntelligence } from "../businessProfileIntelligence/businessProfileIntelligenceTypes.ts";
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function intelligenceFromContext(ctx: ContentGenerationContext): BusinessProfileIntelligence {
  return ctx.businessProfileIntelligence;
}

export function serviceDeliveryForContext(ctx: ContentGenerationContext): ServiceDeliveryIntelligence | undefined {
  return intelligenceFromContext(ctx).services.byServiceId[ctx.serviceId];
}

/** True when Phase 2 serviceDeliveryProfiles contains an entry for this service. */
export function hasStoredServiceDelivery(ctx: ContentGenerationContext): boolean {
  return Boolean(ctx.rawProfile.serviceDeliveryProfiles?.[ctx.serviceId]);
}

export function hasRichTeamIntelligence(intel: BusinessProfileIntelligence): boolean {
  return (
    intel.identity.pharmacistTeam.length > 0 ||
    intel.team.members.length > 1 ||
    Boolean(str(intel.team.meetTheTeamIntro)) ||
    intel.identity.independentPrescriberAvailable
  );
}

export function teamSubjectPhrase(ctx: ContentGenerationContext): string | null {
  const intel = intelligenceFromContext(ctx);
  if (!intel.content.mentionPharmacists || !hasRichTeamIntelligence(intel)) return null;
  return "Our pharmacist team";
}

export function phraseConsultationRoom(ctx: ContentGenerationContext): string | null {
  if (!intelligenceFromContext(ctx).trust.consultationRoomAvailable) return null;
  return "Consultations take place in a private consultation room.";
}

export function phraseIndependentPrescriber(ctx: ContentGenerationContext): string | null {
  if (!intelligenceFromContext(ctx).identity.independentPrescriberAvailable) return null;
  return "Independent prescribing is available from the pharmacy team.";
}

export function phraseParking(ctx: ContentGenerationContext): string | null {
  const parking = intelligenceFromContext(ctx).location.parking.filter(Boolean);
  if (!parking.length) return null;
  return parking.length === 1 ? parking[0]! : parking.join(". ");
}

export function phraseWheelchairAccess(ctx: ContentGenerationContext): string | null {
  if (!intelligenceFromContext(ctx).location.wheelchairAccess) return null;
  return "The premises offer wheelchair access.";
}

export function phraseLanguages(ctx: ContentGenerationContext): string | null {
  const langs = intelligenceFromContext(ctx).team.languagesSpoken.filter(Boolean);
  if (!langs.length) return null;
  return `The team can support consultations in ${langs.join(", ")}.`;
}

export function phraseConsultationLength(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  if (!svc?.consultationLengthMinutes) return null;
  return `Most consultations take approximately ${svc.consultationLengthMinutes} minutes.`;
}

export function phraseWalkIn(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  if (svc?.walkInAvailable !== true) return null;
  return "Walk-in appointments are accepted when capacity allows.";
}

export function phraseAppointmentRequired(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  if (svc?.appointmentRequired !== true) return null;
  return "Appointments are required — call ahead to arrange a suitable time.";
}

export function phraseResultsProcess(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  const text = str(svc?.resultsProcess);
  if (!text) return null;
  return text.endsWith(".") ? text : `${text}.`;
}

export function phraseServicePricing(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  const text = str(svc?.pricing);
  if (!text) return null;
  return text.endsWith(".") ? text : `${text}.`;
}

export function phraseServicePreparation(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  if (!svc?.preparation.length) return null;
  return `Before your visit: ${svc.preparation.join("; ")}.`;
}

export function phraseServiceAftercare(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  if (!svc?.aftercare.length) return null;
  return `After your appointment: ${svc.aftercare.join("; ")}.`;
}

export function phraseServiceEquipment(ctx: ContentGenerationContext): string | null {
  const svc = serviceDeliveryForContext(ctx);
  if (!svc?.equipmentUsed.length) return null;
  return `Equipment used includes ${svc.equipmentUsed.join(", ")}.`;
}

export function phraseOnlineBooking(ctx: ContentGenerationContext): string | null {
  const conversion = intelligenceFromContext(ctx).conversion;
  if (!conversion.onlineBookingAvailable || !str(conversion.bookingUrl)) return null;
  return "Patients can book online through the pharmacy booking link.";
}

export function phraseBookingMethod(ctx: ContentGenerationContext): string | null {
  const method = str(intelligenceFromContext(ctx).conversion.bookingMethod);
  if (!method) return null;
  return `Booking: ${method}.`;
}

function isStubBusinessDescription(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  if (/^medical,\s*doctor,\s*dental\.?$/i.test(normalized)) return true;
  const fragments = normalized.replace(/\.$/, "").split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  if (fragments.length >= 2 && fragments.every((part) => part.split(/\s+/).length <= 2)) {
    return normalized.split(/\s+/).length <= fragments.length * 2 + 1;
  }
  return normalized.split(/\s+/).length < 4;
}

export function phraseBusinessDescription(ctx: ContentGenerationContext): string | null {
  const text = str(intelligenceFromContext(ctx).identity.businessDescription);
  if (!text || isStubBusinessDescription(text)) return null;
  return text.endsWith(".") ? text : `${text}.`;
}

export function phraseTagline(ctx: ContentGenerationContext): string | null {
  return str(intelligenceFromContext(ctx).identity.tagline) || null;
}

export function phraseYearsServing(ctx: ContentGenerationContext): string | null {
  const years = str(intelligenceFromContext(ctx).trust.yearsServingCommunity);
  if (!years) return null;
  return `The pharmacy has served the local community for ${years} years.`;
}

export function phraseGuideIntroduction(ctx: ContentGenerationContext): string | null {
  const p = ctx.profile.pharmacyName;
  const svc = ctx.serviceName;
  const town = ctx.localArea || ctx.primaryTown;
  const desc = phraseBusinessDescription(ctx);
  const tagline = phraseTagline(ctx);
  const team = teamSubjectPhrase(ctx);

  if (desc) {
    const opener = team ? `${team} at ${p}` : p;
    return `${desc} This guide explains how ${svc.toLowerCase()} work at ${opener} for patients in ${town} and nearby communities.`;
  }
  if (tagline) {
    return `${tagline} — this guide explains how ${svc.toLowerCase()} work for patients in ${town} and nearby communities at ${p}.`;
  }
  return null;
}

export function phraseBookingCta(ctx: ContentGenerationContext): string | null {
  const phone = ctx.cta.phone;
  const parts: string[] = [];
  const online = phraseOnlineBooking(ctx);
  const walkIn = phraseWalkIn(ctx);
  const appointment = phraseAppointmentRequired(ctx);
  const method = phraseBookingMethod(ctx);

  if (online) parts.push(online);
  if (walkIn) parts.push(walkIn);
  if (appointment) parts.push(appointment);
  if (method) parts.push(method);

  if (!parts.length) return null;
  return `${parts.join(" ")} Call ${phone} to book or ask about appointment availability.`;
}

export function collectIntelligenceSentences(phrases: Array<string | null>): string[] {
  return [...new Set(phrases.filter(Boolean) as string[])];
}

/** @deprecated use collectIntelligenceSentences + tenantize in engine */
export function appendIntelligenceSentences(_ctx: ContentGenerationContext, phrases: Array<string | null>): string {
  return collectIntelligenceSentences(phrases).map((p) => `<p>${p}</p>`).join("\n");
}

/** Profile-backed FAQ answers — only when intelligence supplies the fact. */
export function buildProfileBackedFaqEntries(
  ctx: ContentGenerationContext,
): Array<{ question: string; answer: string; key: string }> {
  const p = ctx.profile.pharmacyName;
  const svc = ctx.serviceName;
  const phone = ctx.cta.phone;
  const entries: Array<{ question: string; answer: string; key: string }> = [];

  const bookingCta = phraseBookingCta(ctx);
  if (bookingCta) {
    entries.push({
      key: "booking",
      question: `How do I book ${svc} at ${p}?`,
      answer: bookingCta,
    });
  }

  const parking = phraseParking(ctx);
  if (parking) {
    entries.push({
      key: "parking",
      question: `Is parking available for ${svc} at ${p}?`,
      answer: parking,
    });
  }

  const length = phraseConsultationLength(ctx);
  if (length) {
    entries.push({
      key: "consultation-length",
      question: `How long does ${svc.toLowerCase()} take at ${p}?`,
      answer: length,
    });
  }

  const walkIn = phraseWalkIn(ctx);
  if (walkIn) {
    entries.push({
      key: "walk-in",
      question: `Can I walk in for ${svc.toLowerCase()} at ${p}?`,
      answer: walkIn,
    });
  }

  const langs = phraseLanguages(ctx);
  if (langs) {
    entries.push({
      key: "languages",
      question: `Which languages are spoken at ${p}?`,
      answer: langs,
    });
  }

  const prep = phraseServicePreparation(ctx);
  if (prep) {
    entries.push({
      key: "preparation",
      question: `How should I prepare for ${svc.toLowerCase()} at ${p}?`,
      answer: prep,
    });
  }

  const aftercare = phraseServiceAftercare(ctx);
  if (aftercare) {
    entries.push({
      key: "aftercare",
      question: `What aftercare advice is given after ${svc.toLowerCase()} at ${p}?`,
      answer: aftercare,
    });
  }

  const pricing = phraseServicePricing(ctx);
  if (pricing) {
    entries.push({
      key: "pricing",
      question: `What does ${svc.toLowerCase()} cost at ${p}?`,
      answer: pricing,
    });
  }

  const wheelchair = phraseWheelchairAccess(ctx);
  if (wheelchair) {
    entries.push({
      key: "wheelchair",
      question: `Is ${p} accessible for ${svc.toLowerCase()} appointments?`,
      answer: wheelchair,
    });
  }

  const prescriber = phraseIndependentPrescriber(ctx);
  if (prescriber) {
    entries.push({
      key: "prescriber",
      question: `Does ${p} offer independent prescribing?`,
      answer: prescriber,
    });
  }

  if (!bookingCta && phone) {
    // no-op — legacy FAQs cover generic booking
  }

  return entries;
}

/** Detect phrases that imply facts not present in intelligence (validation aid). */
export const INVENTED_CLAIM_PATTERNS: RegExp[] = [
  /\bfree parking\b/i,
  /\b15 minutes\b/i,
  /\bindependent prescrib/i,
  /\bwalk-in appointments are accepted\b/i,
  /\bpatients can book online\b/i,
];

export function intelligenceSupportsClaim(ctx: ContentGenerationContext, text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bfree parking\b/i.test(lower) && !phraseParking(ctx)) return false;
  if (/\b15 minutes\b/i.test(lower) && !phraseConsultationLength(ctx)) return false;
  if (/\bindependent prescrib/i.test(lower) && !phraseIndependentPrescriber(ctx)) return false;
  if (/\bwalk-in appointments are accepted\b/i.test(lower) && !phraseWalkIn(ctx)) return false;
  if (/\bpatients can book online\b/i.test(lower) && !phraseOnlineBooking(ctx)) return false;
  return true;
}
