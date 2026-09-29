/**
 * Local Patient Copy V1.
 * Synthesises approved service intelligence with Locality Intelligence V1.
 * The renderer must print this copy. It must not invent locality relevance
 * by swapping a locality name into the service page.
 */
import {
  assessLocalityEvidenceSufficiency,
  selectLocalityIntelligenceForSynthesis,
  type LocalityEvidenceSufficiencyV1,
  type LocalityIntelligenceFactV1,
  type LocalityIntelligenceV1,
} from "./pharmacyLocalityIntelligenceV1.ts";

export const LOCAL_PATIENT_COPY_V1 = "local-patient-copy-v1";

export type LocalPatientCopyServiceIntelligenceV1 = {
  serviceName: string;
  serviceExplanation: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
};

export type LocalPatientCopyV1 = {
  contractId: typeof LOCAL_PATIENT_COPY_V1;
  sufficiency: Exclude<LocalityEvidenceSufficiencyV1, "insufficient">;
  introduction: string;
  serviceContext: string;
  accessContext: string;
  healthcareCommunityContext: string;
  whyUseful: string;
  nextStep: string;
  consumedFactNames: string[];
};

export type LocalPatientCopyBlockedV1 = {
  ok: false;
  sufficiency: "insufficient";
  blocker: string;
  missing: string[];
};

function clean(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstSentence(text: string): string {
  const body = clean(text);
  if (!body) return "";
  const match = body.match(/^[\s\S]{12,320}?[.]/);
  return clean(match ? match[0] : body.slice(0, 320));
}

function directionClause(intel: LocalityIntelligenceV1): string {
  const direction = clean(intel.geographic.cardinalDirection);
  const provenance = clean(intel.geographic.directionProvenance);
  if (!direction || !provenance) return "";
  return `The recorded position of the pharmacy is ${direction} of ${intel.areaName}.`;
}

function placeSentence(fact: LocalityIntelligenceFactV1, areaName: string): string {
  const where = fact.address ? `, ${fact.address},` : "";
  if (fact.category === "healthcare") {
    return `${fact.name}${where} is a verified healthcare location in ${areaName}. This service is provided at the pharmacy, not at ${fact.name}.`;
  }
  if (fact.category === "transport") {
    return `${fact.name}${where} is a verified transport location in ${areaName}. This service is provided at the pharmacy, not at ${fact.name}.`;
  }
  if (fact.category === "community") {
    return `${fact.name}${where} is a verified community location in ${areaName}. This service is provided at the pharmacy, not at ${fact.name}.`;
  }
  return `${fact.name}${where} is a verified local place in ${areaName}. This service is provided at the pharmacy, not at ${fact.name}.`;
}

/**
 * Service intelligence × locality intelligence → local patient prose.
 * Insufficient evidence blocks. Sparse evidence stays limited and does not invent places.
 */
export function synthesiseLocalPatientCopyV1(
  intel: LocalityIntelligenceV1,
  service: LocalPatientCopyServiceIntelligenceV1,
): { ok: true; copy: LocalPatientCopyV1 } | LocalPatientCopyBlockedV1 {
  const sufficiency = assessLocalityEvidenceSufficiency(intel);
  if (sufficiency.classification === "insufficient") {
    return {
      ok: false,
      sufficiency: "insufficient",
      missing: sufficiency.missing,
      blocker: `Locality content contract blocked — insufficient verified local evidence for ${intel.areaName || "this locality"}. Missing: ${sufficiency.missing.join("; ")}.`,
    };
  }
  const facts = selectLocalityIntelligenceForSynthesis(intel);
  const area = intel.areaName;
  const pharmacy = clean(service.pharmacyName);
  const serviceName = clean(service.serviceName) || "this service";
  const pharmacyAddress = clean(service.pharmacyAddress) || clean(intel.geographic.pharmacyAddress);
  const phone = clean(service.pharmacyPhone);
  const explanation = firstSentence(service.serviceExplanation);
  const lead = facts[0]!;
  const direction = directionClause(intel);
  const introduction = [
    `Patients in ${area} can use ${serviceName} at ${pharmacy}${pharmacyAddress ? `, ${pharmacyAddress}` : ""}.`,
    direction,
    placeSentence(lead, area),
  ]
    .filter(Boolean)
    .join(" ");
  const serviceContext = [
    explanation,
    `For a patient in ${area}, that service is available at the pharmacy.`,
    placeSentence(lead, area),
  ]
    .filter(Boolean)
    .join(" ");
  const transport = facts.find((fact) => fact.category === "transport");
  const accessContext = [
    placeSentence(transport || lead, area),
    pharmacyAddress ? `The pharmacy address is ${pharmacyAddress}.` : "",
    direction,
    transport
      ? ""
      : "No verified transport location is included, so this page does not describe roads or how long travel takes.",
  ]
    .filter(Boolean)
    .join(" ");
  const healthcareCommunityContext = facts.map((fact) => placeSentence(fact, area)).join(" ");
  const whyUseful = `${serviceName} is for a patient in ${area} who wants the service described above. This page does not estimate how many people in ${area} need it.`;
  const nextStep = `A patient in ${area} can contact the pharmacy${pharmacyAddress ? ` at ${pharmacyAddress}` : ""}${phone ? ` or call ${phone}` : ""} to ask how to use ${serviceName}.`;
  return {
    ok: true,
    copy: {
      contractId: LOCAL_PATIENT_COPY_V1,
      sufficiency: sufficiency.classification,
      introduction,
      serviceContext,
      accessContext,
      healthcareCommunityContext,
      whyUseful,
      nextStep,
      consumedFactNames: facts.map((fact) => fact.name),
    },
  };
}

export function localPatientCopyBody(copy: LocalPatientCopyV1): string {
  return [
    copy.introduction,
    copy.serviceContext,
    copy.accessContext,
    copy.healthcareCommunityContext,
    copy.whyUseful,
    copy.nextStep,
  ]
    .filter(Boolean)
    .join("\n");
}
