/**
 * Shared approved consumer demand language for confirmed pharmacy services.
 * Not tenant-specific. NHS demand eligibility is resolved separately.
 */
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { isNationallyCommissionedNhsCommunityPharmacyService } from "./serviceSearchDemandNhsEligibility.ts";

export type ConsumerDemandLanguage = {
  serviceId: string;
  /** Catalogue display name (not used as primary demand phrase). */
  serviceName: string;
  /** Plain-English consumer phrase without locality. */
  canonicalConsumerPhrase: string;
  /** Approved plain-English synonym distinct from canonical. */
  consumerSynonym: string | null;
  nearMeAppropriate: boolean;
};

/** Shared consumer demand phrases — not clinical/internal catalogue labels. */
const CONSUMER_DEMAND_LANGUAGE: Record<string, Omit<ConsumerDemandLanguage, "serviceId" | "serviceName">> = {
  "blood-pressure-checks": {
    canonicalConsumerPhrase: "blood pressure check",
    consumerSynonym: "blood pressure test",
    nearMeAppropriate: true,
  },
  "discharge-medicines-service": {
    canonicalConsumerPhrase: "discharge medicines service",
    consumerSynonym: "discharge medicines",
    nearMeAppropriate: true,
  },
  "flu-vaccinations": {
    canonicalConsumerPhrase: "flu vaccination",
    consumerSynonym: "flu jab",
    nearMeAppropriate: true,
  },
  "health-checks": {
    canonicalConsumerPhrase: "health check",
    consumerSynonym: "health screening",
    nearMeAppropriate: true,
  },
  "independent-prescriber": {
    canonicalConsumerPhrase: "independent prescriber",
    consumerSynonym: "private prescriber",
    nearMeAppropriate: true,
  },
  "malaria-prevention": {
    canonicalConsumerPhrase: "malaria prevention",
    consumerSynonym: "antimalarial tablets",
    nearMeAppropriate: true,
  },
  "medication-reviews": {
    canonicalConsumerPhrase: "medication review",
    consumerSynonym: "medicines review",
    nearMeAppropriate: true,
  },
  "minor-ailments": {
    canonicalConsumerPhrase: "minor ailments",
    consumerSynonym: "common illness pharmacy",
    nearMeAppropriate: true,
  },
  "new-medicine-service": {
    canonicalConsumerPhrase: "new medicine service",
    consumerSynonym: "new medicine consultation",
    nearMeAppropriate: true,
  },
  "pharmacy-first": {
    canonicalConsumerPhrase: "pharmacy first",
    consumerSynonym: "pharmacy first appointment",
    nearMeAppropriate: true,
  },
  "prescription-dispensing": {
    canonicalConsumerPhrase: "prescription dispensing",
    consumerSynonym: "medicine dispensing",
    nearMeAppropriate: true,
  },
  "repeat-prescriptions": {
    canonicalConsumerPhrase: "repeat prescription",
    consumerSynonym: "repeat prescriptions",
    nearMeAppropriate: true,
  },
  "smoking-cessation": {
    canonicalConsumerPhrase: "smoking cessation",
    consumerSynonym: "stop smoking",
    nearMeAppropriate: true,
  },
  "weight-management": {
    canonicalConsumerPhrase: "weight management",
    consumerSynonym: "weight loss service",
    nearMeAppropriate: true,
  },
  "travel-vaccinations": {
    canonicalConsumerPhrase: "travel vaccination",
    consumerSynonym: "travel jabs",
    nearMeAppropriate: true,
  },
};

function humanizeServiceId(serviceId: string): string {
  return String(serviceId || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveConsumerDemandLanguage(serviceId: string): ConsumerDemandLanguage | null {
  const id = String(serviceId || "").trim();
  if (!id) return null;
  const shared = CONSUMER_DEMAND_LANGUAGE[id];
  const serviceName = getServicePublishMeta(id)?.serviceName || humanizeServiceId(id);
  if (shared) {
    return { serviceId: id, serviceName, ...shared };
  }
  const fallbackPhrase = serviceName.toLowerCase();
  return {
    serviceId: id,
    serviceName,
    canonicalConsumerPhrase: fallbackPhrase,
    consumerSynonym: null,
    nearMeAppropriate: true,
  };
}

/** @deprecated Use resolveConsumerDemandLanguage — kept for callers expecting old shape. */
export type ServiceSearchDemandMeta = ConsumerDemandLanguage & {
  approvedSynonym: string | null;
};

export function resolveServiceSearchDemandMeta(serviceId: string): ServiceSearchDemandMeta {
  const lang = resolveConsumerDemandLanguage(serviceId);
  if (!lang) {
    return {
      serviceId: String(serviceId || "").trim(),
      serviceName: humanizeServiceId(serviceId),
      canonicalConsumerPhrase: "",
      consumerSynonym: null,
      approvedSynonym: null,
      nearMeAppropriate: false,
    };
  }
  return {
    ...lang,
    approvedSynonym: lang.consumerSynonym,
  };
}

export function isSharedNhsService(serviceId: string): boolean {
  return isNationallyCommissionedNhsCommunityPharmacyService(serviceId);
}

export function getApprovedServiceSynonym(serviceId: string): string | null {
  return resolveConsumerDemandLanguage(serviceId)?.consumerSynonym ?? null;
}

export function listSharedConsumerDemandServiceIds(): string[] {
  return Object.keys(CONSUMER_DEMAND_LANGUAGE).sort();
}
