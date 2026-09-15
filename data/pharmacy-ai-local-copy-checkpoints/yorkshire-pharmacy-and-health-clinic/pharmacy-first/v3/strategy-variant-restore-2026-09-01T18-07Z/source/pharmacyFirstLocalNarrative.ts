/**
 * Pharmacy First — commercial local narrative composer (Content Engine V1).
 * Evidence-led page strategies + locality memory for cross-locality uniqueness.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { areaDiscoveryForName } from "./pharmacyLocalMarketSnapshot.ts";
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";
import {
  loadServiceVariantPack,
  type FaqVariant,
} from "./pharmacyServiceVariantLibrary.ts";
import type {
  LocalClusterContentInput,
  LocalClusterPageContent,
} from "./pharmacyLocalClusterContentEngine.ts";
import { dedupeSentencesInText } from "./pharmacyLocalClusterCompositionDedupe.ts";
import {
  resolveLocalityIntelligencePack,
  type LocalityIntelPack,
} from "./contentEngine/pharmacyLocalityIntelligencePackV1.ts";
import { LocalityMemoryV1 } from "./contentEngine/pharmacyLocalityMemoryV1.ts";
import {
  resolveLocalityPageStrategyV1,
  type LocalityPageStrategyId,
  type LocalityPageStrategyPlan,
} from "./contentEngine/pharmacyLocalityPageStrategyV1.ts";
import {
  getLocalityVariationSessionV1,
  getSessionAiLocalCopy,
  rememberStrategyForSlug,
  sessionRestoresStrategyVariants,
} from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
import {
  bindVerifiedLocalityEvidenceV1,
  type VerifiedLocalityEvidence,
} from "./contentEngine/pharmacyVerifiedLocalityEvidenceV1.ts";
import {
  composeEvidenceLedLocalityPassagesV1,
  pharmacyIsInSelectedArea,
} from "./contentEngine/pharmacyEvidenceLedLocalNarrativeV1.ts";
import { aiLocalContextRenderPartsV3 } from "./contentEngine/pharmacyAiLocalCopySchemaV1.ts";

const PHARMACY_FIRST_CONDITIONS =
  "sore throat, earache, impetigo, infected insect bites, shingles, sinusitis, and uncomplicated UTI in eligible women";

const MIN_SECTION_WORDS = 70;

export type PharmacyFirstNarrativeOptions = {
  usedStrategies?: Set<LocalityPageStrategyId>;
  forceStrategy?: LocalityPageStrategyId;
  areaIndex?: number;
};

function pickIndex(seed: string, count: number): number {
  if (count <= 0) return 0;
  return hashSeed(seed) % count;
}

function wordCount(text: string): number {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean).length;
}

function ensureCommercialSection(text: string, fallback: string): string {
  const body = dedupeSentencesInText(text);
  if (wordCount(body) >= MIN_SECTION_WORDS) return body;
  return dedupeSentencesInText(`${body} ${fallback}`.trim());
}

function splitAcceptedOverlayContext(paragraphs: string[]): {
  healthcare: string[];
  access: string[];
  remainder: string[];
} {
  const healthcare: string[] = [];
  const access: string[] = [];
  const remainder: string[] = [];
  for (const para of paragraphs) {
    const parts = String(para || "")
      .split(/(?<=\.)\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const sentence of parts) {
      if (/NHS general practice services in .+ are provided from /i.test(sentence)) {
        healthcare.push(sentence);
        continue;
      }
      if (
        /approximately [\d.]+ km\b/i.test(sentence) ||
        /can access Yorkshire Pharmacy/i.test(sentence)
      ) {
        access.push(sentence);
        continue;
      }
      if (
        /Pharmacy First can help with eligible common conditions/i.test(sentence) ||
        /pharmacist will confirm what can be assessed/i.test(sentence)
      ) {
        continue;
      }
      remainder.push(sentence);
    }
  }
  return { healthcare, access, remainder };
}

function confirmedAddressLine(ctx: ContentGenerationContext): string {
  return String(
    ctx.profile.displayAddress || ctx.profile.customerFacingAddress || ctx.profile.fullAddress || "",
  ).trim();
}

function roadFromAddress(address: string): string {
  const match = address.match(
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:Road|Street|Lane|Avenue|Drive|Way|Rd|St|Ave|Ln))\b/,
  );
  const raw = match?.[1] || "";
  return raw
    .replace(/\bRd\b/g, "Road")
    .replace(/\bSt\b/g, "Street")
    .replace(/\bAve\b/g, "Avenue")
    .replace(/\bLn\b/g, "Lane");
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
  // One locality-context sentence only — assigned deliberately, not inventory-dumped.
  const localContext = memory.claimOne(pack.localContext.map((n) => memory.scrubUsedEntities(n)));
  return { roads, landmarks, shopping, school, transport, gp, localContext };
}

function buildHero(
  plan: LocalityPageStrategyPlan,
  areaName: string,
  serviceName: string,
  address: string,
  evidence: ReturnType<typeof claimFocusEvidence>,
  displayPhone: string,
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
      if (evidence.transport) bits.push(`${evidence.transport}.`);
      break;
    case "community":
      bits.push(`For the ${areaName} community, ${serviceName} offers pharmacist assessment for eligible common conditions.`);
      if (evidence.shopping) bits.push(`Everyday routines around ${evidence.shopping} make practical pharmacy access valuable.`);
      if (evidence.school) bits.push(`Family schedules near ${evidence.school} also shape when people can attend.`);
      break;
    case "convenience":
      bits.push(`Around ${areaName}, convenient pharmacist access helps when minor illness needs prompt assessment.`);
      if (evidence.shopping || evidence.roads[0]) {
        bits.push(
          `Households combining errands${evidence.shopping ? ` near ${evidence.shopping}` : ""}${
            evidence.roads[0] ? ` or travel on ${evidence.roads[0]}` : ""
          } can plan a consultation without a routine GP appointment first.`,
        );
      }
      break;
    case "landmark":
      bits.push(
        evidence.landmarks.length
          ? `If you orient yourself around ${evidence.landmarks.join(" or ")}, ${serviceName} is available for eligible common conditions.`
          : `From recognisable points around ${areaName}, patients can arrange ${serviceName} for eligible common conditions.`,
      );
      if (evidence.roads[0]) bits.push(`Familiar approach routes include ${evidence.roads[0]}.`);
      break;
    case "primaryCare":
      bits.push(`${serviceName} complements local primary care for ${areaName} residents with eligible common conditions.`);
      if (evidence.gp) bits.push(`Where ${evidence.gp} is part of your usual care network, pharmacy assessment can still be appropriate for pathway conditions.`);
      break;
    case "journey":
    default:
      bits.push(
        `For households around ${areaName}, ${serviceName} offers pharmacist assessment and clear advice when symptoms need prompt attention.`,
      );
      if (evidence.gp) {
        bits.push(`Named local healthcare recorded for ${areaName} includes ${evidence.gp}.`);
      }
      if (evidence.landmarks.length) {
        bits.push(`Local orientation for ${areaName} includes ${evidence.landmarks.join(" and ")}.`);
      }
      if (evidence.transport) {
        bits.push(`${evidence.transport} is a recorded transport reference for ${areaName}.`);
      }
      if (evidence.shopping) {
        bits.push(`Everyday local errands around ${evidence.shopping} can sit alongside a pharmacy visit.`);
      }
      break;
  }
  const localContext = String(evidence.localContext || "").trim();
  if (
    localContext &&
    !/local guidance|service hub|saved coordinates|provenance|haversine|\bkm\b/i.test(localContext)
  ) {
    bits.push(localContext.endsWith(".") ? localContext : `${localContext}.`);
  }
  if (address) bits.push(`Consultations take place at ${address}.`);
  if (discoveryLabel) bits.push(`${areaName} is ${discoveryLabel.toLowerCase()} from the pharmacy.`);
  return ensureCommercialSection(bits.join(" "), `Call ${displayPhone} to ask whether a consultation is available.`);
}

function buildWhy(
  plan: LocalityPageStrategyPlan,
  areaName: string,
  displayPhone: string,
  evidence: ReturnType<typeof claimFocusEvidence>,
): string {
  const angles: Record<LocalityPageStrategyPlan["heroMode"], string> = {
    access: `Clear directions, approachable advice and honest next steps matter when you are travelling from ${areaName}.`,
    community: `Community patients value private consultation space where available and practical guidance that fits everyday routines in ${areaName}.`,
    convenience: `Busy schedules around ${areaName} make a clear, one-visit outcome valuable — treatment, advice or referral without unnecessary delay.`,
    journey: `Patients look for approachable conversations, private consultation space where available, and honest guidance about the safest next step.`,
    landmark: `Orientation around familiar local places should make pharmacy care easier to plan, not harder.`,
    primaryCare: `Pharmacy assessment is useful when it complements, rather than replaces, local primary-care pathways.`,
  };
  const evidenceLine = (() => {
    switch (plan.heroMode) {
      case "access":
        return evidence.roads[0]
          ? `Knowing the approach via ${evidence.roads[0]} helps you plan the visit with confidence.`
          : "";
      case "community":
        return evidence.shopping
          ? `Local routines around ${evidence.shopping} often shape when a pharmacist consultation is practical.`
          : "";
      case "convenience":
        return evidence.school
          ? `Family timing near ${evidence.school} is one reason a prompt pharmacy pathway is useful.`
          : "";
      case "landmark":
        return evidence.landmarks[0]
          ? `Familiar orientation around ${evidence.landmarks[0]} should make the journey feel straightforward.`
          : "";
      case "primaryCare":
        return evidence.gp
          ? `Where ${evidence.gp} is part of your usual network, pharmacy assessment can still be the right first step for pathway conditions.`
          : "";
      default:
        if (evidence.gp) {
          return `Where ${evidence.gp} is part of usual care for ${areaName}, pharmacy assessment can still be the right first step for pathway conditions.`;
        }
        if (evidence.landmarks[0]) {
          return `Familiar local orientation around ${evidence.landmarks[0]} should make the visit easier to plan.`;
        }
        if (evidence.transport) {
          return `${evidence.transport} is a recorded local transport reference when planning the visit from ${areaName}.`;
        }
        return "";
    }
  })();
  return ensureCommercialSection(
    [
      angles[plan.heroMode],
      evidenceLine,
      plan.heroMode === "journey"
        ? `The aim is practical care: understand the symptoms, check what is suitable, and leave with a clear plan.`
        : `You should leave knowing whether treatment, self-care advice or referral is the safest outcome.`,
      `For people in ${areaName}, that clarity matters when work, study or family schedules make delayed care hard to manage.`,
    ]
      .filter(Boolean)
      .join(" "),
    `Call ${displayPhone} if you want to confirm consultation availability.`,
  );
}

function buildHow(
  plan: LocalityPageStrategyPlan,
  serviceName: string,
  areaName: string,
  displayPhone: string,
): string {
  switch (plan.strategyId) {
    case "access-led":
      return ensureCommercialSection(
        [
          `Before you leave ${areaName}, it helps to know what ${serviceName} can actually deliver on arrival.`,
          `This NHS community pharmacy pathway lets a pharmacist assess eligible common conditions without a routine GP appointment first.`,
          `You should expect one clear outcome: treatment where pathway criteria are met, practical advice when self-care is safer, or referral when pharmacy care is not enough.`,
          `Call ${displayPhone} first if you want to confirm a consultation is available before making the journey.`,
        ].join(" "),
        `Call ${displayPhone} to ask about ${serviceName} availability.`,
      );
    case "community-led":
      return ensureCommercialSection(
        [
          `For people organising care around everyday life in ${areaName}, ${serviceName} provides pharmacist assessment for eligible common conditions.`,
          `It sits in community pharmacy rather than waiting for a routine GP slot, but it is still a structured NHS pathway with clinical limits.`,
          `The pharmacist decides whether treatment, advice or referral is appropriate — not the postcode you travel from.`,
          `If you want to check timing around work, school or caring routines, call ${displayPhone} before you visit.`,
        ].join(" "),
        `Call ${displayPhone} to ask about ${serviceName} availability.`,
      );
    case "convenience-led":
      return ensureCommercialSection(
        [
          `${serviceName} is useful when you need a prompt, practical assessment without turning a minor illness into a longer care delay.`,
          `Eligible common conditions can be reviewed in community pharmacy first, with treatment supplied only where NHS pathway criteria are met.`,
          `The visit is built around a clear next step so patients from ${areaName} leave knowing what to do at home or where to go next.`,
          `Phone ${displayPhone} if you want to confirm walk-in options or booking before you set off.`,
        ].join(" "),
        `Call ${displayPhone} to ask about ${serviceName} availability.`,
      );
    case "landmark-led":
      return ensureCommercialSection(
        [
          `Once you know how to reach the pharmacy from familiar points around ${areaName}, ${serviceName} can be a straightforward option for eligible common conditions.`,
          `The pharmacist completes a structured NHS assessment and explains whether treatment, advice or referral is the safest outcome.`,
          `Nothing is assumed from local orientation alone — suitability is confirmed in consultation against the pathway.`,
          `Call ${displayPhone} if you want opening-hour or consultation guidance before travelling.`,
        ].join(" "),
        `Call ${displayPhone} to ask about ${serviceName} availability.`,
      );
    case "primary-care-led":
      return ensureCommercialSection(
        [
          `${serviceName} is designed to sit alongside local primary care, not replace it.`,
          `For eligible common conditions, a pharmacist can assess symptoms, review medicines and decide whether pharmacy treatment is appropriate under NHS pathway rules.`,
          `Where pharmacy care is not enough, you are directed back toward GP, NHS 111 or urgent care with a clear explanation.`,
          `Patients in ${areaName} can call ${displayPhone} to ask whether a pharmacy consultation is the right first step today.`,
        ].join(" "),
        `Call ${displayPhone} to ask about ${serviceName} availability.`,
      );
    case "patient-journey-led":
    default:
      return ensureCommercialSection(
        [
          `${serviceName} is an NHS community pharmacy service that lets a pharmacist assess eligible common conditions without a routine GP appointment first.`,
          `Treatment is supplied only where pathway criteria are met; otherwise you receive advice or referral.`,
          `The service is designed to give a clear outcome in one visit: treatment where appropriate, practical self-care guidance, or a safe referral when pharmacy care is not enough.`,
          `Patients from ${areaName} can call ${displayPhone} ahead to confirm whether a consultation is available before travelling.`,
        ].join(" "),
        `Call ${displayPhone} to ask about ${serviceName} availability.`,
      );
  }
}

function buildConditions(
  plan: LocalityPageStrategyPlan,
  serviceName: string,
  displayPhone: string,
  areaName: string,
): string {
  const list = PHARMACY_FIRST_CONDITIONS;
  switch (plan.strategyId) {
    case "access-led":
      return ensureCommercialSection(
        [
          `If you are travelling from ${areaName} specifically for ${serviceName}, check first whether your symptoms sit inside the pathway.`,
          `The seven NHS pathway conditions are ${list}.`,
          `Commissioning and clinical criteria still decide what can be offered on the day, so the pharmacist confirms suitability during assessment.`,
          `Bring details of medicines, allergies and when symptoms began so the review is quicker once you arrive.`,
          `If the presentation falls outside the pathway, you leave with advice on GP, NHS 111 or urgent care instead of an unsupported pharmacy treatment.`,
          `Unsure before you travel? Call ${displayPhone}.`,
        ].join(" "),
        `Call ${displayPhone} to ask whether a ${serviceName} consultation is appropriate.`,
      );
    case "community-led":
      return ensureCommercialSection(
        [
          `Common neighbourhood presentations that may fit ${serviceName} include ${list}.`,
          `That list is the NHS pathway scope — not a promise that every sore throat or earache from ${areaName} will receive pharmacy treatment.`,
          `Each patient is assessed individually, including red-flag checks and medicine review.`,
          `Where criteria are met, treatment may be supplied under a Patient Group Direction; otherwise self-care advice or referral is the outcome.`,
          `Call ${displayPhone} if you want to check whether your symptoms are worth a pharmacy visit first.`,
        ].join(" "),
        `Call ${displayPhone} to ask whether a ${serviceName} consultation is appropriate.`,
      );
    case "convenience-led":
      return ensureCommercialSection(
        [
          `A practical way to use ${serviceName} is to match your symptoms to the pathway before you rearrange your day.`,
          `Eligible presentations include ${list}.`,
          `The pharmacist still has to confirm clinical suitability, so availability of treatment is never assumed in advance.`,
          `If pharmacy care is not appropriate, you should still leave with a clear plan rather than a wasted journey from ${areaName}.`,
          `Phone ${displayPhone} for a quick suitability check when symptoms are unclear.`,
        ].join(" "),
        `Call ${displayPhone} to ask whether a ${serviceName} consultation is appropriate.`,
      );
    case "landmark-led":
      return ensureCommercialSection(
        [
          `Local orientation gets you to the pharmacy; the NHS pathway decides what can be assessed.`,
          `${serviceName} may cover ${list}.`,
          `During consultation the pharmacist reviews symptoms, medicines and safety concerns before deciding on treatment, advice or referral.`,
          `Living or travelling near familiar ${areaName} landmarks does not change eligibility — only the clinical criteria do.`,
          `Call ${displayPhone} if you want to confirm whether a consultation is sensible before you set off.`,
        ].join(" "),
        `Call ${displayPhone} to ask whether a ${serviceName} consultation is appropriate.`,
      );
    case "primary-care-led":
      return ensureCommercialSection(
        [
          `Think of ${serviceName} as a defined pharmacy pathway that can complement GP care for selected minor illnesses.`,
          `Pathway conditions include ${list}.`,
          `It is not a general replacement for ongoing GP review, pregnancy-related concerns outside pathway rules, or symptoms that suggest more serious illness.`,
          `Where criteria are met, pharmacy treatment may be appropriate; where they are not, referral back into medical care is the safe outcome.`,
          `Patients from ${areaName} can call ${displayPhone} to ask which route makes sense today.`,
        ].join(" "),
        `Call ${displayPhone} to ask whether a ${serviceName} consultation is appropriate.`,
      );
    case "patient-journey-led":
    default:
      return ensureCommercialSection(
        [
          `${serviceName} can cover seven NHS pathway conditions: ${list}.`,
          `Availability still depends on current NHS commissioning and the specific pathway criteria that apply on the day you attend.`,
          `The pharmacist assesses each patient individually — reviewing symptoms, medicines, allergies, pregnancy status where relevant, and any red-flag concerns.`,
          `Where clinically appropriate and criteria are met, treatment may be supplied under the relevant Patient Group Direction.`,
          `In other cases the pharmacist may provide self-care advice, safety-netting, or referral to a GP, NHS 111 or urgent care.`,
          `Eligibility is never assumed from the area you travel from; it is confirmed during consultation against the NHS pathway.`,
          `If you are unsure whether your symptoms fit ${serviceName}, call ${displayPhone} before travelling.`,
        ].join(" "),
        `Call ${displayPhone} to ask whether a ${serviceName} consultation is appropriate.`,
      );
  }
}

function buildConsultation(
  plan: LocalityPageStrategyPlan,
  displayPhone: string,
  areaName: string,
): string {
  switch (plan.strategyId) {
    case "access-led":
      return ensureCommercialSection(
        [
          `When you arrive from ${areaName}, the consultation is kept focused so the journey is worthwhile.`,
          `Expect questions about symptom timing, medicines already tried, allergies and any red-flag concerns.`,
          `The pharmacist then explains what sits inside the pathway and what needs medical care instead.`,
          `You leave with instructions for treatment, self-care or referral — not with an ambiguous next step.`,
          `Call ${displayPhone} beforehand if you want to confirm what to bring.`,
        ].join(" "),
        `Call ${displayPhone} if you want to confirm what to bring.`,
      );
    case "community-led":
      return ensureCommercialSection(
        [
          `The consultation is a private, structured conversation shaped around your symptoms and day-to-day context in ${areaName}.`,
          `You will cover what has already been tried, current medicines and whether pharmacy treatment is clinically suitable.`,
          `If treatment is appropriate, dosing and safety advice are explained clearly.`,
          `If it is not, the pharmacist still gives practical guidance on GP, NHS 111 or urgent care.`,
          `Telephone ${displayPhone} if you need to check consultation availability around family or work schedules.`,
        ].join(" "),
        `Call ${displayPhone} if you want to confirm what to bring.`,
      );
    case "convenience-led":
      return ensureCommercialSection(
        [
          `The visit is designed to be efficient: gather the key clinical facts, decide the safest outcome, and explain what to do next.`,
          `Have a medicines list ready and note when symptoms started so the review moves quickly.`,
          `You may receive treatment where pathway criteria are met, or advice and referral where they are not.`,
          `That clarity is the point of the consultation for busy patients travelling from ${areaName}.`,
          `Call ${displayPhone} if you want to check walk-in or booking options first.`,
        ].join(" "),
        `Call ${displayPhone} if you want to confirm what to bring.`,
      );
    case "landmark-led":
      return ensureCommercialSection(
        [
          `After you have found the pharmacy from local orientation points, the consultation itself follows a clinical sequence rather than a tourist one.`,
          `Symptoms, medicines and safety checks come first; treatment is only offered where the NHS pathway allows.`,
          `Ask questions during the visit if you are unsure about self-care, warning signs or when to re-seek help.`,
          `Call ${displayPhone} if you want arrival or parking guidance before you travel from ${areaName}.`,
        ].join(" "),
        `Call ${displayPhone} if you want to confirm what to bring.`,
      );
    case "primary-care-led":
      return ensureCommercialSection(
        [
          `The consultation decides whether pharmacy care can safely help now or whether medical services should remain the lead.`,
          `Your symptoms, medicines and history are reviewed against pathway criteria.`,
          `Possible outcomes are pharmacy treatment where appropriate, self-care with safety-netting, or referral to GP, NHS 111 or urgent care.`,
          `This keeps ${areaName} patients inside a joined-up pathway instead of guessing between pharmacy and GP.`,
          `Call ${displayPhone} if you want to discuss suitability before travelling.`,
        ].join(" "),
        `Call ${displayPhone} if you want to confirm what to bring.`,
      );
    case "patient-journey-led":
    default:
      return ensureCommercialSection(
        [
          `Your visit follows a structured consultation so decisions are clinically safe and clearly explained.`,
          `You will be asked about when symptoms started, what you have already tried, and which medicines you take.`,
          `The pharmacist explains what can be managed under the pathway and what falls outside it.`,
          `Where treatment is suitable, you leave with clear instructions; where it is not, you leave with next-step advice rather than uncertainty.`,
          `Bring a medicines list if you can, and mention allergies, pregnancy or breastfeeding early in the conversation.`,
          `If you need to check walk-in availability or booking options first, call ${displayPhone}.`,
        ].join(" "),
        `Call ${displayPhone} if you want to confirm what to bring.`,
      );
  }
}

function buildTravel(
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
      if (evidence.roads.length) {
        bits.push(`Useful approach routes include ${evidence.roads.join(" and ")}.`);
      }
      if (evidence.transport) bits.push(evidence.transport.endsWith(".") ? evidence.transport : `${evidence.transport}.`);
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
        bits.push(`If you orient yourself using ${evidence.landmarks.join(" or ")}, you are already close to a usable mental map for the visit.`);
      } else {
        bits.push(`Use the pharmacy address and a call ahead to plan the simplest approach from ${areaName}.`);
      }
      if (evidence.roads[0]) bits.push(`Approach routes often include ${evidence.roads[0]}.`);
      bits.push(
        address
          ? `The pharmacy address is ${address}. Call ${displayPhone} for parking or arrival advice.`
          : `Call ${displayPhone} for parking or arrival advice.`,
      );
      break;
    case "primary-care-led":
      bits.push(`If pharmacy assessment is the right first step, travelling from ${areaName} should still feel clinically purposeful.`);
      if (evidence.gp) bits.push(`Where ${evidence.gp} is part of your usual care network, pharmacy pathways can still help for eligible minor illness.`);
      if (evidence.roads.length) bits.push(`Approach via ${evidence.roads.join(" or ")} when you have confirmed a consultation makes sense.`);
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
      if (evidence.landmarks.length) {
        bits.push(`Recorded local landmarks for ${areaName} include ${evidence.landmarks.join(" and ")}.`);
      }
      if (evidence.transport) {
        bits.push(`${evidence.transport} is a recorded transport reference for ${areaName}.`);
      }
      if (evidence.gp) {
        bits.push(`${evidence.gp} is a recorded healthcare setting for ${areaName}.`);
      }
      bits.push(`Ask about parking, opening hours and consultation availability on ${displayPhone} before you set off.`);
      break;
  }
  if (
    note &&
    !/saved coordinates|provenance|haversine/i.test(note) &&
    !(plan.strategyId === "patient-journey-led" && /\bkm\b/i.test(note))
  ) {
    bits.push(note.endsWith(".") ? note : `${note}.`);
  }
  return ensureCommercialSection(bits.join(" "), `Call ${displayPhone} for directions from ${areaName}.`);
}

function buildGp(
  plan: LocalityPageStrategyPlan,
  areaName: string,
  displayPhone: string,
  serviceName: string,
): string {
  const emergency =
    "Seek urgent medical care for breathing difficulties, chest pain, severe dehydration, confusion, a non-blanching rash, or any emergency symptoms that make you feel critically unwell.";
  switch (plan.strategyId) {
    case "access-led":
      return [
        `Do not make the journey from ${areaName} if symptoms already look more serious than a community pharmacy pathway.`,
        emergency,
        `Contact your GP, NHS 111 or urgent care when symptoms keep worsening, fail to improve as expected, or sit outside ${serviceName} criteria.`,
        `If you are unsure before travelling, call ${displayPhone} and ask whether a pharmacy consultation is appropriate today.`,
      ].join(" ");
    case "community-led":
      return [
        `Pharmacy care supports common community presentations, but it is not the right service for every illness in ${areaName}.`,
        `Return to your GP, NHS 111 or urgent care when symptoms persist, worsen, or suggest a more serious infection.`,
        emergency,
        `Pregnancy, very young children outside pathway age limits, or problems already under active GP review usually need medical assessment instead.`,
        `Call ${displayPhone} if you want help deciding whether ${serviceName} is suitable before you visit.`,
      ].join(" ");
    case "convenience-led":
      return [
        `A convenient pharmacy visit is only useful when the pathway still fits.`,
        `Choose GP, NHS 111 or urgent care instead when symptoms are escalating, unusually severe, or clearly outside ${serviceName}.`,
        emergency,
        `If speed matters but suitability is unclear, a short call to ${displayPhone} can prevent an unnecessary trip from ${areaName}.`,
      ].join(" ");
    case "landmark-led":
      return [
        `Local familiarity gets you to the pharmacy; clinical judgement decides whether you should be there at all.`,
        `Use your GP, NHS 111 or urgent care when symptoms worsen, persist, or look more serious than a minor-illness pathway.`,
        emergency,
        `Call ${displayPhone} from ${areaName} if you want a quick steer before travelling.`,
      ].join(" ");
    case "primary-care-led":
      return [
        `Pharmacy First should reinforce local primary care, not compete with it.`,
        `Go back to your GP, NHS 111 or urgent care when symptoms are persistent, deteriorating, pregnancy-related outside pathway rules, or already under medical review.`,
        emergency,
        `For ${areaName} patients, calling ${displayPhone} first is often the safest way to choose between pharmacy assessment and medical care.`,
      ].join(" ");
    case "patient-journey-led":
    default:
      return [
        `Contact your GP, NHS 111, or urgent care if symptoms are persistent beyond expected recovery, keep worsening despite pharmacy advice, or suggest a more serious infection.`,
        emergency,
        `Pharmacy pathways are for defined minor illnesses only — if you are pregnant, caring for a very young child outside pathway age limits, or already under active GP review for the same problem, arrange medical assessment instead.`,
        `If you are unsure after symptoms start in ${areaName}, call ${displayPhone} before travelling and ask whether a ${serviceName} consultation is appropriate today.`,
      ].join(" ");
  }
}

function buildFaqs(
  plan: LocalityPageStrategyPlan,
  input: LocalClusterContentInput,
  ctx: ContentGenerationContext,
  pharmacyName: string,
  displayPhone: string,
  discovery: ReturnType<typeof areaDiscoveryForName>,
  memory: LocalityMemoryV1,
  verified: VerifiedLocalityEvidence | null,
): FaqVariant[] {
  const address = confirmedAddressLine(ctx);
  const area = input.areaName;
  const distance = verified?.distanceLabel
    ? `${area} is ${verified.distanceLabel}${verified.cardinalDirection ? ` ${verified.cardinalDirection}` : ""} of the pharmacy.`
    : `Call ${displayPhone} for the simplest route from ${area}${address ? ` to ${address}` : ""}.`;
  void discovery;

  const evidenceFaqs: FaqVariant[] = [];
  if (verified?.distanceLabel) {
    evidenceFaqs.push({
      question: `How far is ${pharmacyName} from ${area}?`,
      answer: `${distance} Saved coordinates and provenance are used rather than estimated travel times.`,
    });
  }
  if (verified?.landmarks[0]) {
    evidenceFaqs.push({
      question: `What local reference points are on file for ${area}?`,
      answer: `Saved locality evidence lists ${verified.landmarks
        .slice(0, 2)
        .map((l) => l.name)
        .join(" and ")} for ${area}. Consultations take place at the pharmacy, not at those landmarks.`,
    });
  }
  if (verified?.nearbyLocalities[0]) {
    evidenceFaqs.push({
      question: `Are there Pharmacy First pages for places near ${area}?`,
      answer: `Nearby approved locality pages include ${verified.nearbyLocalities
        .slice(0, 2)
        .map((n) => n.areaName)
        .join(" and ")}. ${verified.nearbyLocalities[0].reason}.`,
    });
  }

  const byStrategy: Record<LocalityPageStrategyId, FaqVariant[]> = {
    "access-led": [
      {
        question: `What is the simplest way to reach ${pharmacyName} from ${area}?`,
        answer: `Call ${displayPhone} for directions from ${area}${address ? ` to ${address}` : ""}. Ask about parking and consultation availability before you travel.`,
      },
      {
        question: `Should I call before travelling from ${area} for Pharmacy First?`,
        answer: `Yes — call ${displayPhone} first when you want to confirm whether a consultation is available and whether your symptoms sound suitable for the pathway.`,
      },
      {
        question: `How far is ${pharmacyName} from ${area}?`,
        answer: `${distance} The team can help you plan the journey on ${displayPhone}.`,
      },
      {
        question: `What if I arrive and Pharmacy First is not suitable?`,
        answer: `The pharmacist will explain whether GP, NHS 111 or urgent care is the safer next step, so the journey still ends with clear advice.`,
      },
      {
        question: `Do I need an appointment before leaving ${area}?`,
        answer: `Booking is recommended where available; walk-in options vary. Call ${displayPhone} to check before you set off.`,
      },
      {
        question: `Is Pharmacy First free if I travel from ${area}?`,
        answer: `For eligible patients it is free at the point of care where local commissioning applies. Confirm with ${pharmacyName} on ${displayPhone}.`,
      },
    ],
    "community-led": [
      {
        question: `Can families in ${area} use Pharmacy First?`,
        answer: `Some pathways include age limits. The pharmacist confirms suitability for children during consultation — call ${displayPhone} if you want to check first.`,
      },
      {
        question: `Is Pharmacy First part of everyday care for ${area} residents?`,
        answer: `It can be a practical first step for eligible common conditions, with treatment, advice or referral explained during consultation. Contact ${pharmacyName} on ${displayPhone}.`,
      },
      {
        question: `What should I bring from ${area}?`,
        answer: `Bring a medicines list, note when symptoms started, and mention allergies, pregnancy or breastfeeding. Call ${displayPhone} if you are unsure whether to attend.`,
      },
      {
        question: `What if Pharmacy First is not suitable for my symptoms?`,
        answer: `You will be guided toward GP, NHS 111 or urgent care with a clear explanation rather than left guessing.`,
      },
      {
        question: `How do people in ${area} usually arrange a visit?`,
        answer: `Call ${displayPhone} to ask about walk-in options or booking, then travel when a consultation is available.`,
      },
      {
        question: `How far is the pharmacy from ${area}?`,
        answer: distance,
      },
    ],
    "convenience-led": [
      {
        question: `Can I check suitability quickly from ${area}?`,
        answer: `Yes. Call ${displayPhone} and describe your symptoms before rearranging your day.`,
      },
      {
        question: `Do I need an appointment for Pharmacy First from ${area}?`,
        answer: `Booking is recommended where available; walk-in options vary by day. Call ${displayPhone} to check before travelling.`,
      },
      {
        question: `What should I bring to keep the visit efficient?`,
        answer: `Bring your medicines list and be ready to explain when symptoms started, what you have tried, and any allergies.`,
      },
      {
        question: `Is Pharmacy First free for patients travelling from ${area}?`,
        answer: `For eligible patients it is free at the point of care where local commissioning applies. Confirm on ${displayPhone}.`,
      },
      {
        question: `What happens if pharmacy treatment is not appropriate?`,
        answer: `You should still leave with advice on GP, NHS 111 or urgent care so the visit remains useful.`,
      },
      {
        question: `How far is ${pharmacyName} from ${area}?`,
        answer: distance,
      },
    ],
    "patient-journey-led": [
      {
        question: `How do patients in ${area} reach ${pharmacyName} for Pharmacy First?`,
        answer: `Call ${displayPhone} for directions from ${area}${address ? ` to ${address}` : ""}. The team can also confirm whether a consultation is available before you travel.`,
      },
      {
        question: `Can ${area} patients use Pharmacy First?`,
        answer: `That depends on your symptoms and NHS pathway criteria. The pharmacist confirms suitability during consultation — contact ${pharmacyName} on ${displayPhone}.`,
      },
      {
        question: `How far is ${pharmacyName} from ${area}?`,
        answer: `Call ${displayPhone} for the simplest route from ${area}${address ? ` to ${address}` : ""}.`,
      },
      {
        question: `What should I bring to Pharmacy First from ${area}?`,
        answer: `Bring your medicines list, describe when symptoms started, and mention allergies, pregnancy, or breastfeeding. Call ${displayPhone} beforehand if you are unsure whether a consultation is appropriate.`,
      },
      {
        question: `Is Pharmacy First free for patients travelling from ${area}?`,
        answer: `For eligible patients it is free at the point of care where local commissioning applies. Confirm with ${pharmacyName} on ${displayPhone} before you travel.`,
      },
      {
        question: `What if Pharmacy First is not suitable for my symptoms?`,
        answer: `The pharmacist will explain when to use your GP, NHS 111, or urgent care instead, so you leave with a clear plan.`,
      },
    ],
    "landmark-led": [
      {
        question: `How do I find ${pharmacyName} from familiar places in ${area}?`,
        answer: `Call ${displayPhone} for directions from ${area}${address ? ` to ${address}` : ""}. The team can also help with parking and arrival guidance.`,
      },
      {
        question: `Does living near local landmarks change Pharmacy First eligibility?`,
        answer: `No. Eligibility depends on symptoms and NHS pathway criteria, confirmed during consultation.`,
      },
      {
        question: `What should I bring to the consultation?`,
        answer: `Bring a medicines list and be ready to describe symptom timing, allergies and anything already tried.`,
      },
      {
        question: `Should I call before travelling from ${area}?`,
        answer: `Yes, if you want to confirm consultation availability or check whether your symptoms sound suitable. Call ${displayPhone}.`,
      },
      {
        question: `What if pharmacy care is not enough?`,
        answer: `The pharmacist will signpost to GP, NHS 111 or urgent care with clear next-step advice.`,
      },
      {
        question: `How far is the pharmacy from ${area}?`,
        answer: distance,
      },
    ],
    "primary-care-led": [
      {
        question: `When should ${area} patients choose Pharmacy First instead of the GP?`,
        answer: `For eligible common conditions that fit the NHS pharmacy pathway. Call ${displayPhone} if you want help deciding whether pharmacy assessment is the right first step.`,
      },
      {
        question: `Can Pharmacy First complement my usual GP care?`,
        answer: `Yes for defined minor illnesses. It does not replace ongoing GP review or urgent medical care when symptoms are more serious.`,
      },
      {
        question: `What if I am already under GP review for the same problem?`,
        answer: `Arrange medical assessment instead of assuming pharmacy treatment is appropriate. Call ${displayPhone} if you want a quick suitability steer.`,
      },
      {
        question: `How do I reach ${pharmacyName} from ${area}?`,
        answer: `Call ${displayPhone} for directions from ${area}${address ? ` to ${address}` : ""}. Confirm consultation availability before you travel.`,
      },
      {
        question: `Is Pharmacy First free?`,
        answer: `For eligible patients it is free at the point of care where local commissioning applies. Confirm with ${pharmacyName} on ${displayPhone}.`,
      },
      {
        question: `What happens if pharmacy treatment is not suitable?`,
        answer: `You will be directed toward GP, NHS 111 or urgent care with an explanation of why that route is safer.`,
      },
    ],
  };

  const selected = [...(byStrategy[plan.strategyId] || byStrategy["patient-journey-led"]!)];
  if (plan.strategyId === "patient-journey-led") {
    return selected.slice(0, 6);
  }
  const merged: FaqVariant[] = [...evidenceFaqs];
  for (const faq of selected) {
    if (merged.some((existing) => existing.question === faq.question)) continue;
    if (verified?.distanceLabel && /how far is/i.test(faq.question)) continue;
    if (verified?.landmarks[0] && /local reference points|familiar places/i.test(faq.question)) continue;
    merged.push(faq);
  }
  const rotate = plan.faqRotate % merged.length;
  return [...merged.slice(rotate), ...merged.slice(0, rotate)].slice(0, 6);
}

function buildCta(
  plan: LocalityPageStrategyPlan,
  pharmacyName: string,
  displayPhone: string,
  areaName: string,
  verified: VerifiedLocalityEvidence | null,
) {
  const geo =
    verified?.distanceLabel && verified.cardinalDirection
      ? ` ${areaName} is ${verified.distanceLabel} ${verified.cardinalDirection} of the pharmacy.`
      : verified?.distanceLabel
        ? ` ${areaName} is ${verified.distanceLabel} from the pharmacy.`
        : "";
  const landmark = verified?.landmarks[0] ? ` Local reference on file: ${verified.landmarks[0].name}.` : "";
  switch (plan.ctaFrame) {
    case "directions-first":
      return {
        primary: `Get directions to ${pharmacyName} from ${areaName}`,
        secondary: `Call ${displayPhone}`,
        phonePrompt: `Call ${displayPhone} for directions from ${areaName}.${geo}${landmark}`,
      };
    case "check-suitability":
      return {
        primary: `Check if Pharmacy First is suitable from ${areaName}`,
        secondary: `Call ${displayPhone}`,
        phonePrompt: `Call ${displayPhone} to check suitability before travelling from ${areaName}.${geo}${landmark}`,
      };
    case "call-first":
      return {
        primary: `Call the ${pharmacyName} team from ${areaName}`,
        secondary: `Ask about Pharmacy First`,
        phonePrompt: `Call ${displayPhone} from ${areaName}.${geo}${landmark}`,
      };
    case "book-first":
    default:
      return {
        primary: `Book Pharmacy First from ${areaName}`,
        secondary: `Call ${displayPhone}`,
        phonePrompt: `Call ${displayPhone} from ${areaName}.`,
      };
  }
}

function nearbyIntro(
  plan: LocalityPageStrategyPlan,
  area: string,
  pharmacy: string,
  service: string,
  neighbours: string[],
): string {
  const hint = neighbours.slice(0, 2).filter(Boolean);
  switch (plan.nearbyIntroStyle) {
    case "travel":
      return hint.length
        ? `If you are travelling from ${hint.join(" or ")}, you can also use ${service} at ${pharmacy}. Choose a nearby area below for local guidance.`
        : `Other approved locality pages can help if you are travelling from communities around ${area} to ${pharmacy}.`;
    case "family":
      return `Families around ${area}${hint.length ? `, including ${hint.join(" and ")}` : ""}, can access the same ${service} support at ${pharmacy}.`;
    case "corridor":
      return hint.length
        ? `Patients travelling between ${area} and ${hint.join(" or ")} can also arrange ${service} at ${pharmacy}.`
        : `Patients travelling from ${area} can also arrange ${service} at ${pharmacy}.`;
    case "community":
    default:
      return hint.length
        ? `Patients from ${hint.join(" and ")} can also use ${service} at ${pharmacy}. Choose a nearby area below for local guidance.`
        : `Patients from communities around ${area} can also use ${service} at ${pharmacy}.`;
  }
}

export function buildPharmacyFirstLocalNarrative(
  input: LocalClusterContentInput,
  ctx: ContentGenerationContext,
  options: PharmacyFirstNarrativeOptions = {},
): LocalClusterPageContent {
  const profile = ctx.profile;
  const pharmacyName = profile.pharmacyName;
  const displayPhone = profile.displayPhone || profile.phone;
  const serviceName = input.serviceName;
  const areaName = input.areaName;
  const discovery = areaDiscoveryForName(ctx.areaDiscovery, areaName);
  const siblings = (input.siblingLocalities?.length
    ? input.siblingLocalities
    : input.nearbyAreaNames.map((name, i) => ({
        areaName: name,
        areaSlug: input.areaSlugsInCluster[i] || name.toLowerCase(),
      }))
  ).concat(
    (input.siblingLocalities || []).some((s) => s.areaSlug === input.areaSlug)
      ? []
      : [{ areaName: input.areaName, areaSlug: input.areaSlug, ...input.localityRecord }],
  );
  const verified = bindVerifiedLocalityEvidenceV1({
    ctx,
    areaName,
    areaSlug: input.areaSlug,
    siblingLocalities: siblings,
    localityRecord: input.localityRecord,
  });
  const session = getLocalityVariationSessionV1();
  const listedIdx = input.areaSlugsInCluster.indexOf(input.areaSlug);
  const areaIndex =
    options.areaIndex ??
    session?.areaIndexBySlug.get(input.areaSlug) ??
    (listedIdx >= 0 ? listedIdx : pickIndex(`${input.areaSlug}:area-idx`, 8));
  const pack = resolveLocalityIntelligencePack({
    areaName,
    nearbyAreaNames: verified.nearbyLocalities.map((n) => n.areaName),
    pharmacyAddress: profile.fullAddress,
    verified,
  });
  const plan = resolveLocalityPageStrategyV1({
    areaName,
    areaSlug: input.areaSlug,
    pharmacyName,
    serviceName,
    pack,
    areaIndex,
    usedStrategies: options.usedStrategies || session?.usedStrategies,
    forceStrategy: options.forceStrategy || session?.forceStrategyBySlug.get(input.areaSlug) || "patient-journey-led",
  });
  rememberStrategyForSlug(input.areaSlug, plan.strategyId);

  const memory = new LocalityMemoryV1();
  const address = confirmedAddressLine(ctx);
  const confirmedRoad = roadFromAddress(address);
  if (confirmedRoad) memory.claim([confirmedRoad], 1);
  // Reserve neighbour names for nearby section only.
  memory.claim(verified.nearbyLocalities.map((n) => n.areaName), 12);

  const evidence = claimFocusEvidence(pack, memory, plan.evidenceFocus);
  const variantPack = loadServiceVariantPack("pharmacy-first");
  const prepVariant = variantPack?.preparationGuide?.[areaIndex % (variantPack.preparationGuide.length || 1)];
  const aiCopy = getSessionAiLocalCopy(input.areaSlug);
  const evidenceLed = aiCopy
    ? null
    : plan.strategyId === "patient-journey-led"
      ? composeEvidenceLedLocalityPassagesV1({
          verified,
          pharmacyName,
          serviceName,
          displayPhone,
          address,
          areaIndex,
        })
      : null;

  const restoreVariants = sessionRestoresStrategyVariants();
  const overlaySplit = aiCopy ? splitAcceptedOverlayContext(aiCopy.localContextParagraphs || []) : null;
  const heroIntro =
    aiCopy?.heroIntroduction ||
    evidenceLed?.heroIntro ||
    buildHero(plan, areaName, serviceName, address, evidence, displayPhone, "");
  const localRelevanceBody = buildConditions(plan, serviceName, displayPhone, areaName);
  const aiContext = aiCopy && !restoreVariants ? aiLocalContextRenderPartsV3(aiCopy) : null;
  const whyChecksBody = restoreVariants && aiCopy
    ? [aiCopy.localIntroduction, ...(overlaySplit?.remainder || [])].filter(Boolean).join("\n\n")
    : aiCopy
      ? aiContext!.bodyParts.join("\n\n")
      : evidenceLed?.localContextBody || buildWhy(plan, areaName, displayPhone, evidence);
  const processOnly = buildHow(plan, serviceName, areaName, displayPhone);
  const consultationBody = buildConsultation(plan, displayPhone, areaName);
  const accessBody = restoreVariants && aiCopy
    ? [aiCopy.relationshipToPharmacy, aiCopy.localAccessIntroduction, ...(overlaySplit?.access || [])]
        .filter(Boolean)
        .join(" ")
    : aiCopy
      ? [aiCopy.relationshipToPharmacy, aiCopy.localAccessIntroduction].filter(Boolean).join(" ")
      : evidenceLed
        ? evidenceLed.relationshipBody
        : [
            buildTravel(plan, areaName, address, evidence, displayPhone, pack, memory),
            plan.strategyId === "patient-journey-led" && verified.distanceLabel
              ? `${areaName} is ${verified.distanceLabel} from the pharmacy.`
              : "",
          ]
            .filter(Boolean)
            .join(" ")
            .trim();
  const trustBody = restoreVariants && overlaySplit?.healthcare.length
    ? [overlaySplit.healthcare.join(" "), buildGp(plan, areaName, displayPhone, serviceName)].join(" ")
    : buildGp(plan, areaName, displayPhone, serviceName);
  const cta = restoreVariants
    ? (() => {
        const base = buildCta(plan, pharmacyName, displayPhone, areaName, verified);
        const bridge = String(aiCopy?.localCtaBridge || "").trim();
        if (bridge && !base.phonePrompt.includes(bridge)) {
          return { ...base, phonePrompt: `${base.phonePrompt} ${bridge}`.trim() };
        }
        return base;
      })()
    : aiCopy
      ? {
          primary: `Book An Appointment`,
          secondary: `Call ${displayPhone}`,
          phonePrompt: String(aiCopy.localCtaBridge || "").trim(),
        }
      : evidenceLed
        ? {
            primary: `Book An Appointment`,
            secondary: `Call ${displayPhone}`,
            phonePrompt: pharmacyIsInSelectedArea(verified, address)
              ? `Call ${displayPhone} before visiting if you want to check how a consultation is being arranged.`
              : `Call ${displayPhone} before travelling from ${areaName} if you want to check how a consultation is being arranged.`,
          }
        : buildCta(plan, pharmacyName, displayPhone, areaName, verified);
  const nearby = nearbyIntro(
    plan,
    areaName,
    pharmacyName,
    serviceName,
    (input.nearbyAreaNames || []).filter((n) => n.trim().toLowerCase() !== areaName.trim().toLowerCase()).slice(0, 2),
  );

  const processIntro = [
    processOnly,
    "%%CONSULTATION%%",
    plan.headings.consultation,
    consultationBody,
    "%%STRATEGY%%",
    plan.strategyId,
    "%%SECTION_ORDER%%",
    plan.sectionOrder.join(","),
    "%%NEARBY_INTRO%%",
    nearby,
    "%%TRAVEL%%",
    accessBody,
    "%%CTA_FRAME%%",
    `${cta.primary}|||${cta.phonePrompt}`,
    "%%HEADINGS%%",
    JSON.stringify(plan.headings),
  ].join("\n");

  const content: LocalClusterPageContent = {
    heroIntro,
    localRelevanceHeading: plan.headings.conditions,
    localRelevanceIntro: `${serviceName} covers defined NHS pathway conditions. The pharmacist confirms what can be assessed for you on the day.`,
    localRelevanceBody,
    localRelevanceBullets: [],
    whyChecksHeading: restoreVariants ? plan.headings.why : aiContext?.heading || plan.headings.why,
    whyChecksBody,
    whyChecksBullets: [
      "Approachable pharmacist care with clear next steps",
      "Private consultation space when available",
      "Advice, treatment or referral based on clinical assessment",
      "Practical support when routine GP care is not the first step",
    ],
    processHeading: plan.headings.how,
    processIntro,
    processSteps: [
      { title: "Check availability", body: `Call ${displayPhone} to ask about walk-in options or booking.` },
      { title: "Consultation", body: "The pharmacist reviews symptoms, medicines and red-flag concerns." },
      { title: "Outcome", body: "You may receive treatment where appropriate, self-care advice, safety-netting, or referral." },
      { title: "Next steps", body: "You leave knowing what to do at home and when to seek further medical care." },
    ],
    accessHeading: plan.headings.travel,
    accessBody,
    clinicalEnvironmentHeading: plan.headings.consultation,
    clinicalEnvironmentBody: dedupeSentencesInText(
      `${prepVariant?.body || "Bring your medicines list and note when symptoms started."} ${consultationBody}`,
    ),
    trustHeading: plan.headings.gp,
    trustIntro: undefined,
    trustBullets: undefined,
    trustClosing: undefined,
    trustBody,
    faqs: (() => {
      if (aiCopy?.localFaqs?.length) return aiCopy.localFaqs.slice(0, 6);
      if (evidenceLed?.faqs?.length) return evidenceLed.faqs.slice(0, 6);
      const baseFaqs = buildFaqs(plan, input, ctx, pharmacyName, displayPhone, discovery, memory, verified);
      return baseFaqs.slice(0, 6);
    })(),
    ctaPrimary: cta.primary,
    ctaSecondary: cta.secondary,
    ctaPhonePrompt: cta.phonePrompt,
    contentFingerprint: "",
    localIntelligenceUsed: true,
    narrativeType: `pharmacy-first-intelligence:${plan.strategyId}`,
    wordCountEstimate: 0,
    seoTitle: `${serviceName} in ${areaName} | ${pharmacyName}`,
    metaDescription: `${pharmacyName} provides ${serviceName} for patients in ${areaName}. Call ${displayPhone} to ask how the service is arranged.`,
    supportingHeading: `Using ${serviceName} from ${areaName}`,
    supportingIntro: aiCopy
      ? String(aiCopy.localCtaBridge || "").trim()
      : evidenceLed
        ? pharmacyIsInSelectedArea(verified, address)
          ? `If you live in ${areaName} and think ${serviceName} may help, call ${displayPhone} before visiting.`
          : `If you live in ${areaName} and think ${serviceName} may help, call ${displayPhone} before travelling.`
        : `This page uses only verified facts on file for ${areaName}.`,
    supportingItems: [],
    nearbyLocalityLinks: verified.nearbyLocalities,
    sectionEvidence: verified.sectionEvidence,
    evidenceLimited: verified.evidenceLimited,
  };

  content.contentFingerprint = [
    input.areaSlug,
    plan.strategyId,
    "pharmacy-first-intelligence-v5-uniqueness",
    content.heroIntro.slice(0, 80),
    content.localRelevanceBody.slice(0, 80),
    plan.sectionOrder.join("-"),
  ]
    .join("::")
    .toLowerCase();

  content.wordCountEstimate = [
    content.heroIntro,
    content.whyChecksBody,
    processOnly,
    consultationBody,
    content.localRelevanceBody,
    content.accessBody,
    content.trustBody,
    ...content.faqs.map((f) => `${f.question} ${f.answer}`),
  ]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

  return content;
}
