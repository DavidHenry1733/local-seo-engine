/**
 * Shared locality evidence allocation layer.
 * Injects persisted locality intelligence into service-correct locality drafts
 * without rewriting service banks or inventing place facts.
 */
import { areaDiscoveryForName } from "../pharmacyLocalMarketSnapshot.ts";
import { hashSeed } from "../pharmacyLayoutTemplateLibrary.ts";
import {
  resolveLocalityIntelligencePack,
  type LocalityIntelPack,
} from "./pharmacyLocalityIntelligencePackV1.ts";
import { LocalityMemoryV1 } from "./pharmacyLocalityMemoryV1.ts";
import {
  resolveLocalityPageStrategyV1,
  type LocalityPageStrategyPlan,
} from "./pharmacyLocalityPageStrategyV1.ts";
import {
  getLocalityVariationSessionV1,
  rememberStrategyForSlug,
} from "./pharmacyLocalityVariationSessionV1.ts";
import type { VerifiedLocalityEvidence } from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import { verifiedTravelSummary } from "./pharmacyVerifiedLocalityEvidenceV1.ts";

export type LocalityEvidenceAllocationInput = {
  areaName: string;
  areaSlug: string;
  pharmacyName: string;
  serviceName: string;
  displayPhone: string;
  pharmacyAddress?: string;
  nearbyAreaNames?: string[];
  areaSlugsInCluster?: string[];
  areaDiscovery?: Parameters<typeof areaDiscoveryForName>[0];
  verified?: VerifiedLocalityEvidence | null;
};

export type LocalityEvidenceAllocation = {
  strategyId: string;
  evidenceFocus: LocalityPageStrategyPlan["evidenceFocus"];
  openingLocalitySentence: string;
  accessHeading: string;
  accessBody: string;
  consultationLocalityNote: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaPhonePrompt: string;
  nearbyIntro: string;
  headings: LocalityPageStrategyPlan["headings"];
  pack: LocalityIntelPack;
  verified?: VerifiedLocalityEvidence | null;
};

function asSentence(text: string): string {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function claimFocusEvidence(
  pack: LocalityIntelPack,
  memory: LocalityMemoryV1,
  focus: LocalityPageStrategyPlan["evidenceFocus"],
): {
  roads: string[];
  landmarks: string[];
  shopping: string;
  school: string;
  transport: string;
  gp: string;
  localContext: string;
} {
  const roads = focus.includes("roads") && pack.roads.length ? memory.claim(pack.roads, 2) : [];
  const landmarks = focus.includes("landmarks") ? memory.claim([...pack.landmarks, ...pack.parks], 2) : [];
  const shopping = focus.includes("shopping") ? memory.claimOne(pack.shopping) : "";
  const school = focus.includes("schools") ? memory.claimOne(pack.schools) : "";
  const transport = focus.includes("transport") ? memory.claimOne(pack.transport) : "";
  const gp = focus.includes("gp") ? memory.claimOne(pack.gpSurgeries) : "";
  if (focus.includes("neighbours")) memory.claim(pack.neighbouring, 4);
  const localContext = memory.claimOne(pack.localContext.map((n) => memory.scrubUsedEntities(n)));
  return { roads, landmarks, shopping, school, transport, gp, localContext };
}

function buildOpeningLocalitySentence(
  plan: LocalityPageStrategyPlan,
  areaName: string,
  serviceName: string,
  evidence: ReturnType<typeof claimFocusEvidence>,
  discoveryLabel: string,
): string {
  const bits: string[] = [];
  switch (plan.heroMode) {
    case "access":
      bits.push(
        evidence.roads.length
          ? `Patients approaching from ${areaName} often use ${evidence.roads.join(" or ")} when arranging ${serviceName}.`
          : `Patients in ${areaName} often want clear travel guidance before arranging ${serviceName}.`,
      );
      if (evidence.transport) bits.push(asSentence(evidence.transport));
      break;
    case "community":
      bits.push(`For the ${areaName} community, ${serviceName} is available with practical local access.`);
      if (evidence.shopping) bits.push(`Everyday routines around ${evidence.shopping} make a pharmacy visit easier to plan.`);
      if (evidence.school) bits.push(`Family schedules near ${evidence.school} also shape when people can attend.`);
      break;
    case "convenience":
      bits.push(`Around ${areaName}, convenient pharmacy access helps when ${serviceName.toLowerCase()} needs to fit around a busy day.`);
      if (evidence.shopping || evidence.roads[0]) {
        bits.push(
          `Households combining errands${evidence.shopping ? ` near ${evidence.shopping}` : ""}${
            evidence.roads[0] ? ` or travel on ${evidence.roads[0]}` : ""
          } can plan a consultation without an unnecessary extra journey.`,
        );
      }
      break;
    case "landmark":
      bits.push(
        evidence.landmarks.length
          ? `If you orient yourself around ${evidence.landmarks.join(" or ")}, ${serviceName} is available nearby.`
          : `From recognisable points around ${areaName}, patients can arrange ${serviceName}.`,
      );
      if (evidence.roads[0]) bits.push(`Familiar approach routes include ${evidence.roads[0]}.`);
      break;
    case "primaryCare":
      bits.push(`${serviceName} supports ${areaName} residents alongside local primary care.`);
      if (evidence.gp) bits.push(`Where ${evidence.gp} is part of your usual care network, pharmacy support can still be appropriate.`);
      break;
    case "journey":
    default:
      bits.push(`For households around ${areaName}, ${serviceName} is available with clear local access guidance.`);
      break;
  }
  if (evidence.localContext) bits.push(asSentence(evidence.localContext));
  if (discoveryLabel) bits.push(`${areaName} is ${discoveryLabel.toLowerCase()} from the pharmacy.`);
  return bits.join(" ").trim();
}

function buildAccessBody(
  plan: LocalityPageStrategyPlan,
  areaName: string,
  address: string,
  evidence: ReturnType<typeof claimFocusEvidence>,
  displayPhone: string,
  pack: LocalityIntelPack,
  memory: LocalityMemoryV1,
): string {
  const note = memory.claimOne(pack.travelNotes.map((n) => memory.scrubUsedEntities(n)));
  const bits: string[] = [];
  switch (plan.strategyId) {
    case "access-led":
      bits.push(
        address
          ? `Plan the journey to ${address} before you leave ${areaName}.`
          : `Call ${displayPhone} for the pharmacy address before you leave ${areaName}.`,
      );
      if (evidence.roads.length) bits.push(`Useful approach routes include ${evidence.roads.join(" and ")}.`);
      if (evidence.transport) bits.push(asSentence(evidence.transport));
      bits.push(`Confirm parking, opening hours and consultation availability on ${displayPhone} so the trip is purposeful.`);
      break;
    case "community-led":
      bits.push(`Patients from the ${areaName} community regularly combine local errands with a pharmacy visit.`);
      if (evidence.shopping) bits.push(`Everyday routes near ${evidence.shopping} can sit alongside a consultation plan.`);
      if (evidence.school) bits.push(`Family timing around ${evidence.school} often shapes when a visit is realistic.`);
      bits.push(
        address
          ? `The pharmacy is at ${address}. Call ${displayPhone} if you want the simplest route from ${areaName}.`
          : `Call ${displayPhone} for directions from ${areaName}.`,
      );
      break;
    case "convenience-led":
      bits.push(`Keep the journey practical: confirm availability, then travel when it fits your day.`);
      if (evidence.roads[0]) bits.push(`${evidence.roads[0]} is a useful approach reference from ${areaName}.`);
      if (evidence.shopping) bits.push(`Some patients pair the visit with stops near ${evidence.shopping}.`);
      bits.push(
        address
          ? `Consultations take place at ${address}. Phone ${displayPhone} before you set off if you want parking or timing guidance.`
          : `Phone ${displayPhone} before you set off if you want parking or timing guidance.`,
      );
      break;
    case "landmark-led":
      if (evidence.landmarks.length) {
        bits.push(
          `If you orient yourself using ${evidence.landmarks.join(" or ")}, you are already close to a usable mental map for the visit.`,
        );
      } else {
        bits.push(`Use familiar local landmarks around ${areaName} to plan the simplest approach.`);
      }
      if (evidence.roads[0]) bits.push(`Approach routes often include ${evidence.roads[0]}.`);
      bits.push(
        address
          ? `The pharmacy address is ${address}. Call ${displayPhone} for parking or arrival advice.`
          : `Call ${displayPhone} for parking or arrival advice.`,
      );
      break;
    case "primary-care-led":
      bits.push(`If a pharmacy consultation is the right first step, travelling from ${areaName} should still feel purposeful.`);
      if (evidence.gp) {
        bits.push(`Where ${evidence.gp} is part of your usual care network, pharmacy pathways can still help.`);
      }
      if (evidence.roads.length) {
        bits.push(`Approach via ${evidence.roads.join(" or ")} when you have confirmed a consultation makes sense.`);
      }
      bits.push(
        address
          ? `Attend at ${address}. Call ${displayPhone} first if you want to check suitability before you travel.`
          : `Call ${displayPhone} first if you want to check suitability before you travel.`,
      );
      break;
    case "patient-journey-led":
    default:
      bits.push(address ? `You will find the pharmacy at ${address}.` : `Call ${displayPhone} for the pharmacy address from ${areaName}.`);
      if (evidence.roads.length) bits.push(`From ${areaName}, useful approach routes include ${evidence.roads.join(" and ")}.`);
      bits.push(`Ask about opening hours and consultation arrangement on ${displayPhone} before you set off.`);
      break;
  }
  if (note) bits.push(asSentence(note));
  return bits.join(" ").trim();
}

function buildConsultationLocalityNote(
  plan: LocalityPageStrategyPlan,
  areaName: string,
  evidence: ReturnType<typeof claimFocusEvidence>,
  displayPhone: string,
): string {
  if (plan.heroMode === "access" && evidence.roads[0]) {
    return `If you are travelling from ${areaName} via ${evidence.roads[0]}, call ${displayPhone} first so consultation timing is clear.`;
  }
  if (plan.heroMode === "landmark" && evidence.landmarks[0]) {
    return `Patients orienting from ${evidence.landmarks[0]} often call ${displayPhone} before leaving ${areaName}.`;
  }
  if (evidence.transport) {
    return `When using ${evidence.transport} from ${areaName}, a quick call to ${displayPhone} helps confirm the best arrival window.`;
  }
  return `Call ${displayPhone} before travelling from ${areaName} if you want arrival guidance.`;
}

function buildCta(
  plan: LocalityPageStrategyPlan,
  pharmacyName: string,
  displayPhone: string,
  areaName: string,
  serviceName: string,
  evidence: ReturnType<typeof claimFocusEvidence>,
): { primary: string; secondary: string; phonePrompt: string } {
  const roadHint = evidence.roads[0] ? ` via ${evidence.roads[0]}` : "";
  switch (plan.ctaFrame) {
    case "directions-first":
      return {
        primary: `Get directions to ${pharmacyName}`,
        secondary: `Call ${displayPhone}`,
        phonePrompt: `Call ${displayPhone} for directions from ${areaName}${roadHint}`,
      };
    case "check-suitability":
      return {
        primary: `Check if ${serviceName} is suitable`,
        secondary: `Call ${displayPhone}`,
        phonePrompt: `Call ${displayPhone} to check suitability from ${areaName}`,
      };
    case "call-first":
      return {
        primary: `Call the ${pharmacyName} team`,
        secondary: `Ask about ${serviceName}`,
        phonePrompt: `Call ${displayPhone} from ${areaName}${roadHint}`,
      };
    case "book-first":
    default:
      return {
        primary: `Book or call about ${serviceName}`,
        secondary: `Call ${displayPhone}`,
        phonePrompt: `Call ${displayPhone} from ${areaName}${roadHint}`,
      };
  }
}

function buildNearbyIntro(
  plan: LocalityPageStrategyPlan,
  area: string,
  pharmacy: string,
  service: string,
  neighbours: string[],
): string {
  const neighbourHint = neighbours.slice(0, 2).filter(Boolean);
  switch (plan.nearbyIntroStyle) {
    case "travel":
      return neighbourHint.length
        ? `If you are travelling from ${neighbourHint.join(" or ")}, you can also use ${service} at ${pharmacy}. Choose a nearby area below for local guidance.`
        : `If you are travelling from communities near ${area}, you can also use ${service} at ${pharmacy}. Choose a nearby area below for local guidance.`;
    case "family":
      return `Families and neighbours around ${area}${neighbourHint.length ? `, including ${neighbourHint.join(" and ")}` : ""}, can access the same ${service} support at ${pharmacy}. Use the links below for area-specific guidance.`;
    case "corridor":
      return neighbourHint.length
        ? `Patients along nearby corridors from ${area} toward ${neighbourHint.join(" and ")} can also arrange ${service} at ${pharmacy}. Explore the links below.`
        : `Patients along nearby corridors from ${area} can also arrange ${service} at ${pharmacy}. Explore the links below.`;
    case "community":
    default:
      return neighbourHint.length
        ? `Households in ${area} and nearby communities such as ${neighbourHint.join(" and ")} can access ${service} at ${pharmacy}.`
        : `Households in ${area} and nearby communities can access ${service} at ${pharmacy}.`;
  }
}

/**
 * Allocate persisted locality evidence across opening / access / consultation / CTA / nearby.
 * Does not invent landmarks — claims only from the resolved locality intelligence pack.
 */
export function allocateLocalityEvidenceV1(
  input: LocalityEvidenceAllocationInput,
): LocalityEvidenceAllocation {
  const session = getLocalityVariationSessionV1();
  const listedIdx = (input.areaSlugsInCluster || []).indexOf(input.areaSlug);
  const areaIndex =
    session?.areaIndexBySlug.get(input.areaSlug) ??
    (listedIdx >= 0 ? listedIdx : hashSeed(`${input.areaSlug}:area-idx`) % 8);

  const pack = resolveLocalityIntelligencePack({
    areaName: input.areaName,
    nearbyAreaNames: input.nearbyAreaNames,
    pharmacyAddress: input.pharmacyAddress,
    verified: input.verified,
  });

  const plan = resolveLocalityPageStrategyV1({
    areaName: input.areaName,
    areaSlug: input.areaSlug,
    pharmacyName: input.pharmacyName,
    serviceName: input.serviceName,
    pack,
    areaIndex,
    usedStrategies: session?.usedStrategies,
    forceStrategy: session?.forceStrategyBySlug.get(input.areaSlug),
  });
  rememberStrategyForSlug(input.areaSlug, plan.strategyId);

  const memory = new LocalityMemoryV1();
  const address = String(input.pharmacyAddress || "").trim();
  const roadMatch = address.match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Road|Street|Lane|Avenue|Drive|Way))\b/,
  );
  if (roadMatch?.[1]) memory.claim([roadMatch[1]], 1);
  memory.claim(input.nearbyAreaNames || [], 12);

  const evidence = claimFocusEvidence(pack, memory, plan.evidenceFocus);
  const geo =
    input.verified?.distanceLabel && input.verified.cardinalDirection
      ? ` ${input.areaName} is ${input.verified.distanceLabel} ${input.verified.cardinalDirection} of the pharmacy.`
      : input.verified?.distanceLabel
        ? ` ${input.areaName} is ${input.verified.distanceLabel} from the pharmacy.`
        : "";
  const landmark = input.verified?.landmarks[0] ? ` Local reference on file: ${input.verified.landmarks[0].name}.` : "";
  const verifiedTravel = input.verified ? verifiedTravelSummary(input.verified) : "";
  const discoveryLabel = input.verified?.distanceLabel
    ? [input.verified.distanceLabel, input.verified.cardinalDirection].filter(Boolean).join(" ")
    : "";
  const openingLocalitySentence = [
    buildOpeningLocalitySentence(
      plan,
      input.areaName,
      input.serviceName,
      evidence,
      discoveryLabel,
    ),
    verifiedTravel && !discoveryLabel ? verifiedTravel : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const accessBody = buildAccessBody(
    plan,
    input.areaName,
    address,
    evidence,
    input.displayPhone,
    pack,
    memory,
  );
  const consultationLocalityNote = buildConsultationLocalityNote(
    plan,
    input.areaName,
    evidence,
    input.displayPhone,
  );
  const cta = buildCta(
    plan,
    input.pharmacyName,
    input.displayPhone,
    input.areaName,
    input.serviceName,
    evidence,
  );
  const neighbourNames = (input.verified?.nearbyLocalities.map((n) => n.areaName).length
    ? input.verified.nearbyLocalities.map((n) => n.areaName)
    : memory.claim(pack.neighbouring, 2)
  ).slice(0, 2);
  const nearbyIntro = buildNearbyIntro(
    plan,
    input.areaName,
    input.pharmacyName,
    input.serviceName,
    neighbourNames,
  );
  const accessWithGeo = [accessBody, verifiedTravel].filter(Boolean).join(" ").trim();

  return {
    strategyId: plan.strategyId,
    evidenceFocus: plan.evidenceFocus,
    openingLocalitySentence,
    accessHeading: plan.headings.travel,
    accessBody: accessWithGeo,
    consultationLocalityNote,
    ctaPrimary: cta.primary,
    ctaSecondary: cta.secondary,
    ctaPhonePrompt: `${cta.phonePrompt}.${geo}${landmark}`.replace(/\.\s*\./g, ".").trim(),
    nearbyIntro,
    headings: plan.headings,
    pack,
    verified: input.verified || null,
  };
}
