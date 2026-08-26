/**
 * Patient-facing locality narrative for cluster pages.
 * Clarity and usefulness outrank word-count / n-gram uniqueness.
 * Uses only confirmed pharmacy + stored locality distance facts.
 *
 * Instruction ownership (no repeated contact prompts):
 * - Hero: service, pharmacy, locality, distance
 * - Access/travel: map and directions only
 * - confirmBody / final CTA: contact the pharmacy
 */
import type { VerifiedLocalityEvidence } from "./pharmacyVerifiedLocalityEvidenceV1.ts";

export type LocalitySiblingFact = {
  areaName: string;
  areaSlug: string;
  distanceKm: number | null;
  distanceLabel: string;
  areaType?: string;
  order?: number;
};

export type LocalityEvidenceInventory = {
  areaName: string;
  areaSlug: string;
  distanceKm: number | null;
  distanceLabel: string;
  distanceProvenance: string;
  cardinalDirection: string;
  directionProvenance: string;
  areaType: string;
  order: number;
  rankAmongSelected: number;
  selectedCount: number;
  closerSiblings: LocalitySiblingFact[];
  furtherSiblings: LocalitySiblingFact[];
  neighbourLinks: Array<{ areaName: string; areaSlug: string; reason: string }>;
  pharmacyName: string;
  pharmacyAddress: string;
  serviceName: string;
  displayPhone: string;
  evidenceSources: string[];
  evidenceLimited: boolean;
};

export type UniqueLocalityNarrative = {
  h1: string;
  seoTitle: string;
  metaDescription: string;
  heroIntro: string;
  relationshipHeading: string;
  relationshipIntro: string;
  relationshipBody: string;
  patientFocusHeading: string;
  patientFocusBody: string;
  accessHeading: string;
  accessBody: string;
  confirmBody: string;
  nearbyIntro: string;
  uniqueWordCount: number;
  evidenceSources: string[];
};

function words(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function formatList(names: string[]): string {
  const clean = names.map((n) => String(n || "").trim()).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0]!;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/** Prefer a short road-style place name for patient copy when the address includes one. */
function shortPlace(address: string): string {
  const raw = String(address || "").trim();
  if (!raw) return "the pharmacy";
  const road = raw.match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Road|Street|Lane|Avenue|Drive|Way|Hill|Rd|St|Ave))\b/,
  );
  if (road?.[1]) {
    return road[1]
      .replace(/\bRd\b/, "Road")
      .replace(/\bSt\b/, "Street")
      .replace(/\bAve\b/, "Avenue");
  }
  const first = raw.split(",")[0]?.trim();
  return first || raw;
}

/** Natural patient-facing service phrase (avoid awkward plurals). */
function serviceWantPhrase(serviceName: string): string {
  const s = String(serviceName || "").trim();
  if (/^blood pressure checks$/i.test(s)) return "a blood pressure check";
  if (/^flu vaccinations$/i.test(s)) return "a flu vaccination";
  if (/^travel vaccinations$/i.test(s)) return "travel vaccination advice";
  if (/^pharmacy first$/i.test(s)) return "Pharmacy First advice";
  return s.toLowerCase() || "this service";
}

function serviceArrangePhrase(serviceName: string): string {
  const s = String(serviceName || "").trim();
  if (/^blood pressure checks$/i.test(s)) return "a blood pressure check";
  if (/^flu vaccinations$/i.test(s)) return "a flu vaccination";
  if (/^travel vaccinations$/i.test(s)) return "travel vaccinations";
  if (/^pharmacy first$/i.test(s)) return "Pharmacy First";
  return s.toLowerCase() || "this service";
}

export function buildLocalityEvidenceInventory(input: {
  areaName: string;
  areaSlug: string;
  pharmacyName: string;
  pharmacyAddress: string;
  serviceName: string;
  displayPhone: string;
  verified?: VerifiedLocalityEvidence | null;
  selectedSiblings?: LocalitySiblingFact[];
  areaType?: string;
  order?: number;
}): LocalityEvidenceInventory {
  const self =
    (input.selectedSiblings || []).find((s) => s.areaSlug === input.areaSlug) ||
    ({
      areaName: input.areaName,
      areaSlug: input.areaSlug,
      distanceKm: input.verified?.distanceKm ?? null,
      distanceLabel: input.verified?.distanceLabel || "",
      areaType: input.areaType || "",
      order: input.order,
    } satisfies LocalitySiblingFact);

  const ranked = [...(input.selectedSiblings || [])]
    .filter((s) => s.distanceKm != null)
    .sort((a, b) => Number(a.distanceKm) - Number(b.distanceKm));
  const rankIdx = ranked.findIndex((s) => s.areaSlug === input.areaSlug);
  const rankAmongSelected = rankIdx >= 0 ? rankIdx + 1 : Number(self.order || input.order || 0) || 1;
  const selfKm = self.distanceKm ?? input.verified?.distanceKm ?? null;

  const sources = [
    self.distanceLabel || input.verified?.distanceLabel
      ? input.verified?.distanceProvenance || "profile.selectedAreas:distance"
      : "",
    input.pharmacyAddress ? "profile:pharmacy-address" : "",
    ...(input.verified?.nearbyLocalities || []).map((n) =>
      n.geographic ? "haversine-between-saved-coords" : "approved-sibling-locality",
    ),
    input.areaType || self.areaType ? "profile.selectedAreas:areaType" : "",
  ].filter(Boolean);

  return {
    areaName: input.areaName,
    areaSlug: input.areaSlug,
    distanceKm: selfKm,
    distanceLabel: self.distanceLabel || input.verified?.distanceLabel || "",
    distanceProvenance: input.verified?.distanceProvenance || "profile.selectedAreas:distance",
    cardinalDirection: input.verified?.cardinalDirection || "",
    directionProvenance: input.verified?.directionProvenance || "",
    areaType: String(input.areaType || self.areaType || "").trim(),
    order: Number(self.order || input.order || rankAmongSelected || 0),
    rankAmongSelected,
    selectedCount: Math.max(ranked.length, (input.selectedSiblings || []).length, 1),
    closerSiblings: ranked.filter(
      (s) => s.areaSlug !== input.areaSlug && selfKm != null && Number(s.distanceKm) < Number(selfKm),
    ),
    furtherSiblings: ranked.filter(
      (s) => s.areaSlug !== input.areaSlug && selfKm != null && Number(s.distanceKm) > Number(selfKm),
    ),
    neighbourLinks: (input.verified?.nearbyLocalities || [])
      .slice(0, 4)
      .map((n) => ({ areaName: n.areaName, areaSlug: n.areaSlug, reason: n.reason })),
    pharmacyName: input.pharmacyName,
    pharmacyAddress: input.pharmacyAddress,
    serviceName: input.serviceName,
    displayPhone: input.displayPhone,
    evidenceSources: [...new Set(sources)],
    evidenceLimited: Boolean(input.verified?.evidenceLimited),
  };
}

/**
 * Natural, concise patient copy. Band varies tone only — never exposes ranks or comparison maths.
 * Pharmacy full name appears at most twice across the returned fields (typically once in the hero).
 */
export function buildUniqueLocalityNarrative(inv: LocalityEvidenceInventory): UniqueLocalityNarrative {
  const area = inv.areaName;
  const pharmacy = inv.pharmacyName;
  const place = shortPlace(inv.pharmacyAddress);
  const dist = inv.distanceLabel;
  const service = inv.serviceName || "this service";
  const want = serviceWantPhrase(service);
  const arrange = serviceArrangePhrase(service);
  const slot = Math.max(0, Number(inv.order || inv.rankAmongSelected || 1) - 1);
  const neighbourNames = (inv.neighbourLinks.length
    ? inv.neighbourLinks.map((n) => n.areaName)
    : [...inv.closerSiblings, ...inv.furtherSiblings].slice(0, 3).map((n) => n.areaName)
  ).filter((n) => n && n !== area);
  const neighbourBit = neighbourNames.length
    ? `You can also open the pages for ${formatList(neighbourNames.slice(0, 3))} if that matches where you are starting from.`
    : `Other nearby area pages are linked below if your journey starts somewhere else.`;

  // Hero: pharmacy, place, locality, distance — no contact instruction.
  const heroBySlot = [
    dist
      ? `${pharmacy} is on ${place}, approximately ${dist} from ${area}. If you would like ${want}, this page covers the pharmacy location for patients from ${area}.`
      : `${pharmacy} is on ${place}. This page is for patients from ${area} who would like ${want}.`,
    dist
      ? `${pharmacy} on ${place} serves patients from ${area}. The pharmacy is approximately ${dist} away.`
      : `${pharmacy} on ${place} serves patients from ${area}.`,
    dist
      ? `Patients travelling from ${area} can reach ${pharmacy} on ${place}, approximately ${dist} away.`
      : `Patients travelling from ${area} can reach ${pharmacy} on ${place}.`,
    dist
      ? `${pharmacy} on ${place} is approximately ${dist} from ${area}.`
      : `${pharmacy} is on ${place}, for patients travelling from ${area}.`,
    dist
      ? `If you are starting in ${area}, ${pharmacy} is on ${place}, approximately ${dist} away.`
      : `If you are starting in ${area}, ${pharmacy} is on ${place}.`,
    dist
      ? `Coming from ${area}? ${pharmacy} is on ${place}, approximately ${dist} away.`
      : `Coming from ${area}? ${pharmacy} is on ${place}.`,
    dist
      ? `For patients from ${area}, ${pharmacy} is on ${place}, approximately ${dist} away.`
      : `For patients from ${area}, ${pharmacy} is on ${place}.`,
    dist
      ? `Patients travelling from ${area} can reach ${pharmacy} on ${place}. The pharmacy is approximately ${dist} away.`
      : `Patients travelling from ${area} can reach ${pharmacy} on ${place}.`,
  ];

  // Travel: map / directions only — no contact instruction.
  const accessBySlot = [
    {
      h: `Getting to the pharmacy from ${area}`,
      b: `Use the map and directions below to plan your journey from ${area}.`,
    },
    {
      h: `Directions for ${area} patients`,
      b: `Open the directions link below when you are ready to travel from ${area}.`,
    },
    {
      h: `Directions from ${area}`,
      b: `The directions link below shows the confirmed pharmacy location from ${area}.`,
    },
    {
      h: `Getting here from ${area}`,
      b: `Plan your journey from ${area} with the map below.`,
    },
    {
      h: `Travel notes for ${area}`,
      b: `Use the directions below to travel from ${area} to the pharmacy.`,
    },
    {
      h: `Map and travel from ${area}`,
      b: `The map shows the pharmacy’s confirmed location for travel from ${area}.`,
    },
    {
      h: `Directions from ${area}`,
      b: `Open the directions link below to travel from ${area} to the pharmacy.`,
    },
    {
      h: `Map for ${area} travellers`,
      b: `The directions below show the confirmed location for journeys from ${area}.`,
    },
  ];

  // Relationship copy is a fallback when the service bank has no “why” section — keep free of contact prompts.
  const relBySlot = [
    {
      h: `Coming from ${area}`,
      i: `This page is written for people whose journey starts in ${area}.`,
      b: `The map below shows the confirmed pharmacy location.`,
    },
    {
      h: `${area} and this pharmacy`,
      i: `This page is for patients whose journey starts in ${area}.`,
      b: `The map below shows the confirmed location.`,
    },
    {
      h: `Support for patients from ${area}`,
      i: `This page is for people whose journey starts in ${area}.`,
      b: `The map below shows the confirmed pharmacy location.`,
    },
    {
      h: `Visiting from ${area}`,
      i: `This page helps patients travelling from ${area}.`,
      b: `Use the map when you plan your visit.`,
    },
    {
      h: `${area} access guidance`,
      i: `Use this page if you are travelling from ${area} for this service.`,
      b: `Directions are linked below.`,
    },
    {
      h: `Planning a visit from ${area}`,
      i: `This page is for people coming from ${area}.`,
      b: `The map and directions below show the confirmed location.`,
    },
    {
      h: `Longer journey from ${area}`,
      i: `This page is for patients travelling from ${area}.`,
      b: `The map below shows the confirmed pharmacy location.`,
    },
    {
      h: `${area} visit overview`,
      i: `This page is for patients travelling from ${area}.`,
      b: `Use the map and directions when you are ready to visit.`,
    },
  ];

  const idx = slot % heroBySlot.length;
  let heroIntro = heroBySlot[idx]!;
  if (words(heroIntro) > 42 && dist) {
    heroIntro = `${pharmacy} is on ${place}, approximately ${dist} from ${area}.`;
  }
  const relationshipHeading = relBySlot[idx]!.h;
  const relationshipIntro = relBySlot[idx]!.i;
  const relationshipBody = relBySlot[idx]!.b;
  const accessHeading = accessBySlot[idx]!.h;
  const accessBody = accessBySlot[idx]!.b;

  // Drop the redundant “Local guidance…” block — it only repeated the hero.
  const patientFocusHeading = "";
  const patientFocusBody = "";

  // Final CTA owns the contact instruction.
  const confirmBody = `Contact the pharmacy to ask how to arrange ${arrange}. Use the website contact option or the phone number shown on this page.`;

  const nearbyIntro = neighbourBit;

  const uniqueText = [
    heroIntro,
    relationshipHeading,
    relationshipIntro,
    relationshipBody,
    accessHeading,
    accessBody,
    confirmBody,
    nearbyIntro,
  ].join(" ");

  const h1 = `${inv.serviceName} for patients from ${inv.areaName}`;
  return {
    h1,
    seoTitle: `${h1} | ${inv.pharmacyName}`,
    metaDescription: dist
      ? `${service} for patients from ${area}. The pharmacy is about ${dist} away on ${place}.`
      : `${service} for patients from ${area} at the pharmacy.`,
    heroIntro,
    relationshipHeading,
    relationshipIntro,
    relationshipBody,
    patientFocusHeading,
    patientFocusBody,
    accessHeading,
    accessBody,
    confirmBody,
    nearbyIntro,
    uniqueWordCount: words(uniqueText),
    evidenceSources: inv.evidenceSources,
  };
}
