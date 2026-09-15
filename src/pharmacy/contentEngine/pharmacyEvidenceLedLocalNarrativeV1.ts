/**
 * Generic evidence-to-local-narrative assembly.
 * Turns verified locality facts into natural patient-facing British English.
 * Evidence packs are optional context, not mandatory keywords.
 * Safeguards belong in validation — never in customer copy.
 */
import type { NamedLocalityFact, VerifiedLocalityEvidence } from "./pharmacyVerifiedLocalityEvidenceV1.ts";

export const EVIDENCE_LED_LOCAL_NARRATIVE_ID = "evidence-led-local-narrative-v1";

export type EvidenceCategoryKey =
  | "healthcare"
  | "community"
  | "landmarks"
  | "transport"
  | "schools"
  | "retail";

export type EvidenceEntityUse = {
  name: string;
  category: EvidenceCategoryKey;
  patientValue: string;
};

export type EvidenceEntityOmission = {
  name: string;
  category: EvidenceCategoryKey;
  reason: string;
};

export type EvidenceLedLocalPassages = {
  heroIntro: string;
  localContextBody: string;
  relationshipBody: string;
  faqs: Array<{ question: string; answer: string }>;
  mentionedEntities: EvidenceEntityUse[];
  omittedEntities: EvidenceEntityOmission[];
  categoriesUsed: EvidenceCategoryKey[];
};

const GENERIC_TOKENS = new Set([
  "the",
  "and",
  "nhs",
  "dr",
  "practice",
  "surgery",
  "library",
  "park",
  "centre",
  "center",
  "school",
  "primary",
  "academy",
  "medical",
  "community",
  "road",
  "street",
  "health",
  "group",
  "branch",
  "lane",
  "way",
  "high",
]);

function tokens(name: string): string[] {
  return String(name || "")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function distinctiveScore(name: string, areaName: string): number {
  const area = areaName.trim().toLowerCase();
  return tokens(name).filter((t) => t.toLowerCase() !== area && !GENERIC_TOKENS.has(t.toLowerCase())).length;
}

function isAreaOnlyName(name: string, areaName: string): boolean {
  return String(name || "").trim().toLowerCase() === areaName.trim().toLowerCase();
}

function bucketsFromVerified(verified: VerifiedLocalityEvidence): Record<EvidenceCategoryKey, NamedLocalityFact[]> {
  return {
    healthcare: verified.healthcare || [],
    community: verified.community || [],
    landmarks: verified.landmarks || [],
    transport: verified.transport || [],
    schools: verified.schools || [],
    retail: verified.retail || [],
  };
}

function allNamedEntities(
  buckets: Record<EvidenceCategoryKey, NamedLocalityFact[]>,
): Array<{ cat: EvidenceCategoryKey; name: string }> {
  const order: EvidenceCategoryKey[] = [
    "healthcare",
    "community",
    "landmarks",
    "transport",
    "schools",
    "retail",
  ];
  const out: Array<{ cat: EvidenceCategoryKey; name: string }> = [];
  const seen = new Set<string>();
  for (const cat of order) {
    for (const item of buckets[cat]) {
      const name = String(item?.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ cat, name });
    }
  }
  return out;
}

function looksLikeJunctionName(name: string): boolean {
  return /[A-Za-z]\s*\/\s*[A-Za-z]/.test(name);
}

export function looksLikeOverseasOrGenericNoise(name: string): boolean {
  return (
    /\b(yellowstone|mississauga|syracuse|north carolina|new hampshire|\bNH\b|\bNY\b|national park|walk-in clinic)\b/i.test(
      name,
    ) || /^(medical centre|gp walk-in clinic|urgent treatment centre|medical center)$/i.test(name.trim())
  );
}

function isSchoolCategory(cat: EvidenceCategoryKey, name: string): boolean {
  if (cat === "schools") return true;
  return /\b(primary school|infant school|junior school|academy|college)\b/i.test(name);
}

export function isUsefulTransportName(name: string, area: string): boolean {
  if (isAreaOnlyName(name, area) || looksLikeJunctionName(name)) return false;
  return /\b(station|interchange|railway|rail\b|bus station)\b/i.test(name);
}

export function isUsefulHealthcareName(name: string, area: string): boolean {
  if (isAreaOnlyName(name, area) || looksLikeOverseasOrGenericNoise(name)) return false;
  return /\b(surgery|practice|health centre|health center|medical centre|medical center|clinic|urgent care|care centre|care center|hospital)\b/i.test(
    name,
  );
}

/** Existing sufficiency classification: hospital / urgent-care / similar facility. */
export function isHospitalOrUrgentCareName(name: string): boolean {
  return /\b(hospital|infirmary|a\s*&\s*e|accident and emergency|urgent treatment|urgent care|minor injuries|walk-in centre|walk-in center)\b/i.test(
    name,
  );
}

/**
 * Existing sufficiency classification: named GP / medical practice.
 * Hospitals and urgent-care sites are never GP practices.
 */
export function isGpPracticeName(name: string): boolean {
  if (isHospitalOrUrgentCareName(name)) return false;
  return /\b(surgery|practice|health centre|health center|medical centre|medical center|gp)\b/i.test(name);
}

export type HealthcareEntityWordingKind = "gp-practice" | "healthcare-facility";

/**
 * Wording kind for a healthcare-bucket entity. Pack category stays authoritative;
 * this only distinguishes GP-practice vs facility frames inside healthcare.
 */
export function healthcareEntityWordingKind(name: string): HealthcareEntityWordingKind {
  if (isHospitalOrUrgentCareName(name)) return "healthcare-facility";
  if (isGpPracticeName(name)) return "gp-practice";
  return "healthcare-facility";
}

const CIVIC_CENTRE_PLACE_GENERIC = new Set(["the", "and", "a", "civic", "centre", "center"]);

/**
 * Named UK civic-centre buildings (e.g. "{Locality} Civic Centre").
 * Generic "civic" wording, pharmacy/business names, and unattributable
 * "Civic Centre" labels are not place identity.
 */
export function isNamedUkCivicCentrePlace(name: string, area: string): boolean {
  const value = String(name || "").replace(/\s+/g, " ").trim();
  if (!value || isAreaOnlyName(value, area) || looksLikeJunctionName(value) || looksLikeOverseasOrGenericNoise(value)) {
    return false;
  }
  if (/\b(pharmacy|chemist|dispensary|pharmacist)\b/i.test(value)) return false;
  if (/\b(ltd|limited|plc|llp|inc|llc)\b/i.test(value)) return false;
  if (!/\bcivic centres?\b|\bcivic centers?\b/i.test(value)) return false;
  if (/\b(services|amenities|facilities|offices?|provision)\b/i.test(value)) return false;
  if (/\b(offers|provides|include|including|residents can|patients? (in|can)|rely on)\b/i.test(value)) {
    return false;
  }
  const areaNorm = area.trim().toLowerCase();
  const extra = tokens(value).filter((token) => {
    const lower = token.toLowerCase();
    if (CIVIC_CENTRE_PLACE_GENERIC.has(lower)) return false;
    if (areaNorm && areaNorm.split(/[^a-z0-9]+/).includes(lower)) return false;
    return true;
  });
  const includesArea = Boolean(areaNorm) && value.toLowerCase().includes(areaNorm);
  return includesArea || extra.length > 0;
}

export function isUsefulOrientationName(name: string, area: string): boolean {
  if (isAreaOnlyName(name, area) || looksLikeJunctionName(name) || looksLikeOverseasOrGenericNoise(name)) {
    return false;
  }
  if (isNamedUkCivicCentrePlace(name, area)) return true;
  return /\b(library|leisure centre|leisure center|community centre|community center|park|nature reserve|mill|war memorial|memorial)\b/i.test(
    name,
  );
}

function patientValueFor(cat: EvidenceCategoryKey): string {
  switch (cat) {
    case "transport":
      return "Helps the reader recognise the starting area from a verified transport location, without a route or journey time.";
    case "healthcare":
      return "Supports a natural explanation of when Pharmacy First may be considered instead of seeking a routine GP appointment.";
    case "community":
    case "landmarks":
      return "Provides recognisable orientation for the selected area.";
    case "retail":
      return "Assists orientation or access in an exceptional case.";
    case "schools":
      return "Assists orientation or access in an exceptional case.";
    default:
      return "Helps the reader understand the selected area.";
  }
}

function omissionReason(cat: EvidenceCategoryKey, name: string, area: string): string {
  if (isSchoolCategory(cat, name)) {
    return "School names are omitted unless they provide demonstrable orientation or access value.";
  }
  if (cat === "retail") {
    return "Retail names are omitted unless they naturally assist orientation or access.";
  }
  if (isAreaOnlyName(name, area)) {
    return "The area name on its own is not a useful separate place for the reader.";
  }
  if (looksLikeJunctionName(name)) {
    return "A junction or stop name would require inventing a route.";
  }
  if (looksLikeOverseasOrGenericNoise(name)) {
    return "The name is too generic or not useful Pharmacy First orientation.";
  }
  return "Not selected: a more useful distance, contact, healthcare or orientation fact was available.";
}

export function pharmacyIsInSelectedArea(verified: VerifiedLocalityEvidence, address: string): boolean {
  const area = String(verified.areaName || "").trim().toLowerCase();
  if (area && String(address || "").toLowerCase().includes(area)) return true;
  if (verified.distanceKm != null && Number.isFinite(verified.distanceKm) && verified.distanceKm < 1) return true;
  return false;
}

export function streetFromPremisesAddress(address: string): string {
  const first = String(address || "").split(",")[0]?.trim() || "";
  if (!first) return "";
  return first
    .replace(/^\d+\s+/, "")
    .replace(/\bRd\b/g, "Road")
    .replace(/\bSt\b/g, "Street")
    .replace(/\bAve\b/g, "Avenue")
    .replace(/\bLn\b/g, "Lane")
    .replace(/\bDr\b/g, "Drive")
    .trim();
}

export function selectPatientUsefulLocalEvidence(
  verified: VerifiedLocalityEvidence,
  address = "",
): { selected: EvidenceEntityUse[]; omitted: EvidenceEntityOmission[] } {
  const area = verified.areaName;
  const buckets = bucketsFromVerified(verified);
  const inArea = pharmacyIsInSelectedArea(verified, address);
  const rankScore = (name: string): number => {
    const anchored = name.toLowerCase().includes(area.toLowerCase()) ? 100 : 0;
    const doctorPenalty = /^dr\b/i.test(name) ? 15 : 0;
    const shoutPenalty = (name.match(/\b[A-Z]{3,}\b/g) || []).length * 20;
    const lengthPenalty = Math.max(0, tokens(name).length - 4);
    return anchored + distinctiveScore(name, area) - doctorPenalty - shoutPenalty - lengthPenalty;
  };
  const ranked = (cat: EvidenceCategoryKey, pred: (name: string) => boolean): NamedLocalityFact[] =>
    [...buckets[cat]]
      .filter((item) => item?.name && pred(item.name))
      .sort((a, b) => rankScore(b.name) - rankScore(a.name) || a.name.localeCompare(b.name));

  const selected: EvidenceEntityUse[] = [];
  const used = new Set<string>();
  const take = (cat: EvidenceCategoryKey, item: NamedLocalityFact | undefined) => {
    const name = String(item?.name || "").trim();
    if (!name || used.has(name.toLowerCase()) || selected.length >= 4) return;
    used.add(name.toLowerCase());
    selected.push({ name, category: cat, patientValue: patientValueFor(cat) });
  };

  const transport = ranked("transport", (name) => isUsefulTransportName(name, area))[0];
  const healthcare = ranked("healthcare", (name) => isUsefulHealthcareName(name, area))[0];
  const orientationCommunity = ranked("community", (name) => isUsefulOrientationName(name, area))[0];
  const orientationLandmark = ranked("landmarks", (name) => isUsefulOrientationName(name, area))[0];

  take("healthcare", healthcare);
  if (!inArea) take("transport", transport);
  take("community", orientationCommunity);
  take("landmarks", orientationLandmark);

  const omitted = allNamedEntities(buckets)
    .filter((row) => !used.has(row.name.toLowerCase()))
    .map((row) => ({
      name: row.name,
      category: row.cat,
      reason: selected.length
        ? omissionReason(row.cat, row.name, area)
        : inArea
          ? "The pharmacy premises and verified distance already explain the local relationship."
          : omissionReason(row.cat, row.name, area),
    }));

  return { selected, omitted };
}

function joinProse(parts: string[]): string {
  return parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function distanceClause(area: string, distanceLabel: string, direction: string): string {
  if (!distanceLabel) return "";
  if (direction) return `${area} is ${distanceLabel} ${direction} of the pharmacy`;
  return `${area} is ${distanceLabel} from the pharmacy`;
}

function composeHero(input: {
  area: string;
  service: string;
  pharmacy: string;
  phone: string;
  inArea: boolean;
  index: number;
}): string {
  const { area, service, pharmacy, phone, inArea, index } = input;
  const inAreaFrames = [
    `${service} is available for people in ${area}. If you think a pharmacist consultation may help, call ${phone} before visiting to check how it is being arranged.`,
    `If you live in ${area} and ${service} may be suitable, call ${phone} before visiting.`,
    `People in ${area} can ask about ${service} on ${phone}. The pharmacist will confirm whether a consultation is appropriate.`,
  ];
  const travellingFrames = [
    `${pharmacy} provides ${service} for people in ${area}. If you think a pharmacist consultation may help, call ${phone} before travelling to check how it is being arranged.`,
    `If you live in ${area} and ${service} may be suitable, call ${phone} before travelling to ${pharmacy}.`,
    `People in ${area} can ask ${pharmacy} about ${service} on ${phone}. The pharmacist will confirm whether a consultation is appropriate.`,
    `${service} is available at ${pharmacy} for patients in ${area}. Call ${phone} to check how consultations are being offered.`,
    `If you are in ${area} and need advice about an eligible common condition, ${pharmacy} can assess whether ${service} is suitable. Call ${phone} first.`,
    `${pharmacy} offers ${service} to people living in or near ${area}. Phone ${phone} before you travel if you want to check availability.`,
    `Patients in ${area} can contact ${pharmacy} on ${phone} to ask about ${service} and how a consultation would be arranged.`,
    `For people in ${area}, ${service} at ${pharmacy} can be a first pharmacist conversation for eligible conditions. Call ${phone} to check.`,
    `${pharmacy} can help people in ${area} who think ${service} may be suitable. Call ${phone} to confirm whether a consultation can be offered.`,
    `If you live in ${area} and think ${service} may help, call ${pharmacy} on ${phone} before travelling to check how the service is being arranged.`,
  ];
  const frames = inArea ? inAreaFrames : travellingFrames;
  return frames[index % frames.length]!;
}

function orientationSentence(name: string, area: string): string {
  return `The area includes ${name} in ${area}.`;
}

function healthcareSentence(
  name: string,
  service: string,
  pharmacy: string,
  phone: string,
  index: number,
): string {
  void pharmacy;
  const gpFrames = [
    `If you would usually use ${name} for a routine GP appointment, ${service} at the pharmacy may still be able to assess eligible common conditions without seeing a GP first. The pharmacist will confirm what can be assessed on the day.`,
    `Patients who normally use ${name} can still ask about ${service} for eligible common conditions, instead of waiting for a routine GP appointment. Call ${phone} if you want to check first.`,
    `If ${name} is your usual GP practice, you can still use ${service} for eligible common conditions without a routine GP appointment first. The pharmacist confirms suitability during the consultation.`,
  ];
  const facilityFrames = [
    `If you would usually go to ${name} for care, ${service} at the pharmacy may still be able to assess eligible common conditions. The pharmacist will confirm what can be assessed on the day.`,
    `Patients who already know ${name} locally can still ask about ${service} for eligible common conditions. Call ${phone} if you want to check first.`,
    `If ${name} is a local healthcare site you already know, you can still use ${service} for eligible common conditions without a routine GP appointment first. The pharmacist confirms suitability during the consultation.`,
  ];
  const frames = healthcareEntityWordingKind(name) === "gp-practice" ? gpFrames : facilityFrames;
  return frames[index % frames.length]!;
}

function transportSentence(
  name: string,
  area: string,
  address: string,
  phone: string,
  index: number,
): string {
  void area;
  const dest = address || "the pharmacy";
  const frames = [
    `If you are travelling from near ${name}, call ${phone} before you set off. Consultations take place at ${dest}.`,
    `People coming from around ${name} should call ${phone} before travelling. The pharmacy is at ${dest}.`,
    `Call ${phone} before travelling from near ${name}. Consultations take place at ${dest}.`,
  ];
  return frames[index % frames.length]!;
}

function composeLocalIntroduction(input: {
  area: string;
  service: string;
  pharmacy: string;
  phone: string;
  address: string;
  street: string;
  distanceLabel: string;
  direction: string;
  inArea: boolean;
  selected: EvidenceEntityUse[];
  index: number;
}): string {
  const { area, service, pharmacy, phone, address, street, distanceLabel, direction, inArea, selected, index } =
    input;
  const dist = distanceClause(area, distanceLabel, direction);
  const dest = address || "the pharmacy";
  const extras = selected
    .map((entity) => {
      if (entity.category === "healthcare") return healthcareSentence(entity.name, service, pharmacy, phone, index);
      if (entity.category === "transport") return transportSentence(entity.name, area, address, phone, index);
      if (entity.category === "community" || entity.category === "landmarks") {
        return orientationSentence(entity.name, area);
      }
      return "";
    })
    .filter(Boolean);
  const hasExtras = extras.length > 0;

  // Headingley takes the first sentence as the section intro and then pairs the rest.
  // Keep an odd total sentence count so leftovers are complete 2-sentence passages.
  let opening: string;
  if (inArea) {
    const premises = street
      ? `${pharmacy} is based on ${street} in ${area}.`
      : `${pharmacy} is based in ${area}.`;
    const visit = `If you live locally and think ${service} may be suitable, call ${phone} before visiting to check how consultations are being arranged.`;
    const find = street
      ? `You will find ${pharmacy} on ${street} in ${area}.`
      : `You will find ${pharmacy} in ${area}.`;
    const check = `Call ${phone} if you want to check whether a ${service} consultation can be offered.`;
    const inAreaOpenings = hasExtras
      ? [premises, find, `${pharmacy} has its premises in ${area}${street ? ` on ${street}` : ""}.`]
      : [
          joinProse([premises, visit]),
          joinProse([find, check]),
          joinProse([
            `${pharmacy} has its premises in ${area}${street ? ` on ${street}` : ""}.`,
            `If ${service} may help, phone ${phone} before you visit.`,
          ]),
        ];
    opening = inAreaOpenings[index % inAreaOpenings.length]!;
  } else {
    const travellingOpenings = [
      joinProse([
        dist ? `${dist}.` : "",
        `Consultations take place at ${dest}.`,
        `Call ${phone} before travelling from ${area} if you want to check whether a consultation is available.`,
      ]),
      joinProse([
        dist ? `${dist}.` : "",
        `The pharmacy is at ${dest}.`,
        `Phone ${phone} first if you would like to check how ${service} is being offered.`,
      ]),
      joinProse([
        `If you live in ${area} and think ${service} may be suitable, call ${phone} before travelling.`,
        dist ? `${dist}.` : "",
        `Consultations take place at ${dest}.`,
      ]),
    ];
    opening = travellingOpenings[index % travellingOpenings.length]!;
  }

  return joinProse([opening, ...extras]);
}

function composeAccess(input: {
  area: string;
  service: string;
  pharmacy: string;
  phone: string;
  address: string;
  distanceLabel: string;
  direction: string;
  inArea: boolean;
  index: number;
}): string {
  const { area, service, phone, address, inArea, index } = input;
  const dest = address ? `The pharmacy is at ${address}` : `Call ${phone} for the pharmacy address`;
  if (inArea) {
    const inAreaFrames = [
      joinProse([`${dest}.`, `Call ${phone} before visiting to check how ${service} is being arranged.`]),
      joinProse([`${dest}.`, `Phone ${phone} first if you want to confirm whether a consultation can be offered today.`]),
      joinProse([`Consultations take place at ${address || "the pharmacy"}.`, `Call ${phone} before you visit.`]),
    ];
    return inAreaFrames[index % inAreaFrames.length]!;
  }
  const travellingFrames = [
    joinProse([
      `${dest}.`,
      `Call ${phone} before travelling from ${area} to check how ${service} is being arranged.`,
    ]),
    joinProse([
      `Consultations take place at ${address || "the pharmacy"}.`,
      `People coming from ${area} should phone ${phone} before they set off.`,
    ]),
    joinProse([
      `${dest}.`,
      `If you are coming from ${area}, call ${phone} first so the team can confirm whether a consultation is appropriate.`,
    ]),
    joinProse([
      `The confirmed premises are at ${address || "the pharmacy"}.`,
      `Travelling from ${area} is straightforward once you have checked with the pharmacy on ${phone}.`,
    ]),
    joinProse([
      `${dest}.`,
      `From ${area}, the useful first step is to call ${phone} and ask how ${service} is being offered that day.`,
    ]),
    joinProse([
      `You will be seen at ${address || "the pharmacy"}.`,
      `A short call to ${phone} helps patients in ${area} confirm the visit is appropriate before they travel.`,
    ]),
    joinProse([
      `${dest}.`,
      `Patients travelling from ${area} can use ${phone} to ask what to bring and whether a consultation can go ahead.`,
    ]),
    joinProse([
      `Attend at ${address || "the pharmacy"} after checking first.`,
      `If you live in ${area}, ${phone} is the number to call before you leave.`,
    ]),
  ];
  return travellingFrames[index % travellingFrames.length]!;
}

function composeUsefulFaqs(input: {
  area: string;
  pharmacy: string;
  phone: string;
  address: string;
  distanceLabel: string;
  direction: string;
  inArea: boolean;
  index: number;
}): Array<{ question: string; answer: string }> {
  const { area, pharmacy, phone, address, distanceLabel, direction, inArea, index } = input;
  const dist = distanceClause(area, distanceLabel, direction);
  const dest = address || "the pharmacy premises";
  const faqs = [
    {
      question: `How far is the pharmacy from ${area}?`,
      answer: dist
        ? `${dist}. The pharmacy is at ${dest}. Call ${phone} if you want to check the best way to get there.`
        : `${pharmacy} is at ${dest}. Call ${phone} if you want help planning your visit from ${area}.`,
    },
    {
      question: inArea ? `Should I call before visiting?` : `Should I call before travelling from ${area}?`,
      answer: `Yes. Call ${phone} to check whether a consultation is available and whether your symptoms sound suitable for Pharmacy First.`,
    },
    {
      question: `Where is the pharmacy located?`,
      answer: `${pharmacy} is at ${dest}. Call ${phone} if you want to confirm opening details before you visit.`,
    },
    {
      question: `What happens if Pharmacy First is not suitable?`,
      answer: `The pharmacist will explain when to use your GP, NHS 111 or urgent care instead, so you leave with a clear next step.`,
    },
    {
      question: `What should I bring to a Pharmacy First consultation?`,
      answer: `Bring a list of your medicines, note when symptoms started, and mention allergies, pregnancy or breastfeeding. Call ${phone} if you are unsure whether to attend.`,
    },
  ];
  const rotate = index % faqs.length;
  return [...faqs.slice(rotate), ...faqs.slice(0, rotate)];
}

export function composeEvidenceLedLocalityPassagesV1(input: {
  verified: VerifiedLocalityEvidence;
  pharmacyName: string;
  serviceName: string;
  displayPhone: string;
  address: string;
  areaIndex?: number;
}): EvidenceLedLocalPassages {
  const verified = input.verified;
  const area = verified.areaName;
  const index = Math.max(0, input.areaIndex ?? 0);
  const address = String(input.address || verified.pharmacyAddress || "").trim();
  const { selected, omitted } = selectPatientUsefulLocalEvidence(verified, address);
  const street = streetFromPremisesAddress(address);
  const inArea = pharmacyIsInSelectedArea(verified, address);

  return {
    heroIntro: composeHero({
      area,
      service: input.serviceName,
      pharmacy: input.pharmacyName,
      phone: input.displayPhone,
      inArea,
      index,
    }),
    localContextBody: composeLocalIntroduction({
      area,
      service: input.serviceName,
      pharmacy: input.pharmacyName,
      phone: input.displayPhone,
      address,
      street,
      distanceLabel: verified.distanceLabel || "",
      direction: verified.cardinalDirection || "",
      inArea,
      selected,
      index,
    }),
    relationshipBody: composeAccess({
      area,
      service: input.serviceName,
      pharmacy: input.pharmacyName,
      phone: input.displayPhone,
      address,
      distanceLabel: "",
      direction: "",
      inArea,
      index,
    }),
    faqs: composeUsefulFaqs({
      area,
      pharmacy: input.pharmacyName,
      phone: input.displayPhone,
      address,
      distanceLabel: verified.distanceLabel || "",
      direction: verified.cardinalDirection || "",
      inArea,
      index,
    }),
    mentionedEntities: selected,
    omittedEntities: omitted,
    categoriesUsed: [...new Set(selected.map((item) => item.category))],
  };
}

export function evidenceMentionedInProse(htmlOrText: string, names: string[]): boolean {
  const text = String(htmlOrText || "").replace(/<[^>]+>/g, " ");
  return names.some((name) => name && text.toLowerCase().includes(name.toLowerCase()));
}

function escapeEvidenceNameRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueEvidenceNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = String(raw || "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function evidenceNamesPresentInText(text: string, names: string[]): string[] {
  const lower = String(text || "").toLowerCase();
  return names.filter((name) => name && lower.includes(name.toLowerCase()));
}

function htmlToEvidenceScanText(html: string): string {
  return String(html || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(?:p|div|h[1-6]|tr|table|section|article|blockquote)\s*>/gi, "\n")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n");
}

const EVIDENCE_LIST_LABEL_RE =
  /\b(?:local\s+evidence|named\s+evidence|named\s+places?|evidence|landmarks?)\s*:/gi;
const EVIDENCE_LIST_CONNECTOR_RE = /^(?:and|or|plus|&)$/i;

function stripEnumerationResidue(fragment: string, names: string[]): string {
  let remain = String(fragment || "");
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    remain = remain.replace(new RegExp(escapeEvidenceNameRe(name), "gi"), " ");
  }
  remain = remain.replace(EVIDENCE_LIST_LABEL_RE, " ");
  remain = remain.replace(/[•·]/g, " ");
  remain = remain.replace(/^\s*[-*]\s+/gm, " ");
  remain = remain.replace(/[\s,;:./\\|–—&+()[\]'"“”‘’-]+/g, " ").trim();
  return remain
    .split(/\s+/)
    .filter((tok) => tok && !EVIDENCE_LIST_CONNECTOR_RE.test(tok))
    .join(" ");
}

function fragmentIsBareNameEnumeration(fragment: string, names: string[]): boolean {
  const present = evidenceNamesPresentInText(fragment, names);
  if (present.length < 2) return false;
  return stripEnumerationResidue(fragment, present).length === 0;
}

function lineIsBareEvidenceName(line: string, names: string[]): boolean {
  const trimmed = String(line || "")
    .replace(/^[•·*\-\d.)\s]+/, "")
    .trim();
  if (!trimmed) return false;
  const present = evidenceNamesPresentInText(trimmed, names);
  if (present.length !== 1) return false;
  return stripEnumerationResidue(trimmed, present).length === 0;
}

/**
 * Detects raw evidence dumps: comma/slash concatenations, label/value inventories,
 * and bullet/newline name lists. A single named entity in ordinary prose is not a
 * list. Multiple names in a grammatical sentence are not a list.
 */
export function looksLikeRawEvidenceList(html: string, names: string[]): boolean {
  const uniqueNames = uniqueEvidenceNames(names);
  if (!uniqueNames.length) return false;

  const text = htmlToEvidenceScanText(html);
  const present = evidenceNamesPresentInText(text, uniqueNames);
  if (present.length < 2) return false;

  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let nameOnlyRun = 0;
  for (const line of lines) {
    if (fragmentIsBareNameEnumeration(line, present)) return true;
    if (lineIsBareEvidenceName(line, present)) {
      nameOnlyRun += 1;
      if (nameOnlyRun >= 2) return true;
    } else {
      nameOnlyRun = 0;
    }
  }

  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences) {
    if (fragmentIsBareNameEnumeration(sentence, present)) return true;
  }

  return false;
}
