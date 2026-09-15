/**
 * Quality gates for AI local copy — language, clinical boundary, stuffing, fragments, repetition.
 */
import { evaluateProhibitedCustomerLanguage, evaluateGrammarAndFragments } from "./pharmacyLocalCandidateReadabilityV1.ts";
import type { AiLocalCopyV1 } from "./pharmacyAiLocalCopySchemaV1.ts";
import { flattenAiLocalCopyText } from "./pharmacyAiLocalCopySchemaV1.ts";
import { PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1, premisesLocalityFromCanonicalAddress } from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import type { BusinessLocalityCopyInputV1 } from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { splitSentences } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";

const SCHOOL_RETAIL =
  /\b(Academy|Primary School|Infant School|Junior School|Secondary School|Retail Park|Shopping Centre|Supermarket)\b/;
const CALL_BEFORE = /\bcall\b[\s\S]{0,40}\bbefore (?:visiting|travelling|you (?:visit|travel|set off))\b/i;

export function evaluateAiLocalCopyQualityV1(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const hay = flattenAiLocalCopyText(copy);
  const grammarHay = [
    copy.heroIntroduction,
    copy.localIntroduction,
    ...copy.localContextParagraphs,
    copy.relationshipToPharmacy,
    copy.localAccessIntroduction,
    ...copy.localFaqs.map((faq) => faq.answer),
    copy.localCtaBridge,
  ].join(" ");
  failures.push(...evaluateProhibitedCustomerLanguage(hay).map((f) => `prohibited: ${f}`));
  failures.push(...evaluateGrammarAndFragments(grammarHay).map((f) => `grammar: ${f}`));

  if (/\bin-area premises\b|\btravelling from the area to the supplied address\b|\bsupplied address\b/i.test(hay)) {
    failures.push("instruction text leaked into copy");
  }
  if (/\bnot as a service delivered from a local landmark list\b/i.test(hay)) failures.push("defensive recommendation disclaimer");
  if (/\bsymptoms rather than a map of local buildings\b/i.test(hay)) failures.push("defensive evidence-handling language");
  if (/\bshould not be read as a recommendation\b/i.test(hay)) failures.push("defensive recommendation disclaimer");
  if (
    /\bpatients who normally use\b|\byour usual gp\b|\byour local gp\b|\byour gp (?:at|practice|surgery)\b|\bregistered at .{0,40}(?:surgery|practice|medical centre|gp)\b/i.test(
      hay,
    )
  ) {
    failures.push("implies the reader uses a named medical practice");
  }
  if (/\boften (?:visit|use|travel)\b/i.test(hay)) {
    failures.push("assumed patient routines");
  }
  if (
    /\bwaiting for (?:a )?routine gp\b|\bwithout waiting for (?:a )?(?:routine )?gp\b|\balternative to waiting for a routine gp\b|\bgp wait|\bwaiting (?:times? )?for (?:a )?gp\b|\bhard to book\b|\bgp (?:is )?busy\b/i.test(
      hay,
    )
  ) {
    failures.push("assumed GP waiting times");
  }
  if (/\bsame-day\b|\bsame day\b|\bpharmacist availability\b|\bcheck availability\b|\bcurrent availability\b/i.test(hay)) {
    failures.push("unsupported availability claim");
  }
  if (
    /\bquick access\b|\btravel far\b|\bshort (?:distance|journey)\b|\beasily reached\b|\beasy to reach\b|\beasily accessible\b|\bconvenient reach\b|\bwithout travelling far\b|\bwithout the need to travel\b/i.test(
      hay,
    )
  ) {
    failures.push("unsupported journey characterisation");
  }
  const forcedPlace = input.locality.acceptedEntities.filter((e) =>
    ["schools", "retail", "community", "landmarks"].includes(e.category),
  );
  for (const entity of forcedPlace) {
    if (!hay.toLowerCase().includes(entity.name.toLowerCase())) continue;
    const window = splitSentences(hay).find((s) => s.toLowerCase().includes(entity.name.toLowerCase())) || "";
    if (!/\b(next to|opposite|on the same street|helps you find|outside|beside)\b/i.test(window)) {
      failures.push(`school/retail/landmark stuffing: ${entity.name}`);
    }
  }

  const schoolRetailHits = hay.match(new RegExp(SCHOOL_RETAIL, "g")) || [];
  for (const hit of schoolRetailHits) {
    const allowed = input.locality.acceptedEntities.some(
      (e) => (e.category === "schools" || e.category === "retail") && hay.toLowerCase().includes(e.name.toLowerCase()),
    );
    if (!allowed) failures.push(`school/retail stuffing: ${hit}`);
  }
  const forcedSchool = input.locality.acceptedEntities.filter((e) => e.category === "schools" || e.category === "retail");
  for (const entity of forcedSchool) {
    if (!hay.toLowerCase().includes(entity.name.toLowerCase())) continue;
    const window = splitSentences(hay).find((s) => s.toLowerCase().includes(entity.name.toLowerCase())) || "";
    if (!/\b(next to|opposite|on the same street|helps you find|outside)\b/i.test(window)) {
      failures.push(`school/retail stuffing: ${entity.name}`);
    }
  }

  const callSentences = splitSentences(hay).filter((s) => CALL_BEFORE.test(s));
  if (callSentences.length >= 3) failures.push("repetitive call-before-visiting sentences");

  const sentences = splitSentences(hay);
  const normalized = sentences.map((s) => s.toLowerCase().replace(/\s+/g, " "));
  const dup = normalized.filter((s, i) => normalized.indexOf(s) !== i && s.split(" ").length >= 8);
  if (dup.length) failures.push(`repeated sentence: ${dup[0]!.slice(0, 100)}`);

  const lockedList = PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.conditionSet;
  const inventedCondition = /\b(chickenpox|covid|flu jab|blood pressure|travel vaccine|hay fever)\b/i.test(hay);
  if (inventedCondition) failures.push("unsupported clinical claim");
  const listed = hay.match(/sore throat, earache[^.]+/i);
  if (listed && !lockedList.toLowerCase().includes("sore throat, earache, impetigo")) {
    failures.push("approved clinical copy rewritten");
  }
  if (listed && listed[0] && !lockedList.toLowerCase().startsWith("sore throat, earache, impetigo")) {
    failures.push("approved clinical copy rewritten");
  }
  if (listed && !/infected insect bites, shingles, sinusitis/.test(listed[0])) {
    failures.push("approved clinical copy rewritten");
  }

  for (const para of copy.localContextParagraphs) {
    if (para.split(/\s+/).filter(Boolean).length > 140) failures.push("generic filler written only to increase length");
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

const FILLER_V3 =
  /\b(healthcare landscape|local healthcare options|part of the local community|serving the local community|residents can access|you can decide whether|located outside the area|convenient|easy reach|avoid delays|these practices help shape|community resources|residents[’'] wellbeing|here are some common questions|local amenities|alongside healthcare|reflecting the area|providing local transport links|close to home|supporting access to nhs care|making it accessible|travelling from nearby|from nearby areas|strong local identity|local identity|own identity|identity within)\b/i;
const GP_ALTERNATIVE_V3 =
  /\b(use my GP|my GP practice instead|use (?:my |a )?GP practice instead|contact a GP practice such as|such as .{0,60}(?:Medical Centre|Health Centre))\b/i;
const EVIDENCE_JARGON_V3 =
  /\b(factId|sourceClass|editorial evidence|provenance|Places pack|evidence pack|corroborating)\b/i;
const LOCAL_FACT_MARKERS_V3: Array<{ id: string; re: RegExp }> = [
  { id: "station", re: /National Rail station/i },
  { id: "medical-centre", re: /Medical Centre/i },
  { id: "health-centre", re: /Health Centre/i },
  { id: "library", re: /public library|\bLibrary\b/i },
  { id: "mill", re: /\bMill Country Park\b|\bCountry Park\b/i },
];
const RAW_PROVIDER_V3 =
  /\bDr\s+[A-Z]\.?\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+-\s+.+|Dr C Liley|the Dove Valley Practice\b/i;
const ROUTE_V3 =
  /\b(orient you towards|route to the pharmacy|helps? you (?:reach|find your way) to|reach (?:the pharmacy|pharmacy first) by travelling|by travelling to|walking connection|along .{0,40} (?:road|lane|way) to the pharmacy)\b/i;
const TRAVEL_OR_CENTRE_DISTANCE_V3 =
  /\b(travel(?:ling)? distance|driving distance|walking distance|by road|\d+(?:\.\d+)?\s*km (?:drive|walk|journey)|from the (?:town )?centre)\b/i;
const APPROXIMATE_DISTANCE_WORDING_V3 =
  /\b(approximate(?:ly)?|approx\.?|around|about|roughly)\b/i;
const STRAIGHT_LINE_DISTANCE_WORDING_V3 = /\bstraight[\s-]lines?\b/i;

export function sentenceIdentifiesApproximateStraightLineKm(sentence: string): boolean {
  return APPROXIMATE_DISTANCE_WORDING_V3.test(sentence) && STRAIGHT_LINE_DISTANCE_WORDING_V3.test(sentence);
}
const ENTITY_LIST_V3 =
  /(?:Medical Centre|Health Centre|National Rail station|public library|Country Park).{0,80}(?:Medical Centre|Health Centre|National Rail station|public library|Country Park).{0,80}(?:Medical Centre|Health Centre|National Rail station|public library|Country Park)/i;

export function evaluateAiLocalCopyQualityV3(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  const base = evaluateAiLocalCopyQualityV2(copy, input);
  const failures = [...base.failures];
  const hay = flattenAiLocalCopyText(copy);
  if (FILLER_V3.test(hay)) failures.push("generic filler");
  if (/\b(straightforward|known for|community focus|sense of local heritage|those nearby|range of services nearby|just outside the area|benefits from established|reflecting its role|centre for local services)\b/i.test(hay)) {
    failures.push("generic filler");
  }
  if (GP_ALTERNATIVE_V3.test(hay)) failures.push("unsupported GP-alternative implication");
  if (EVIDENCE_JARGON_V3.test(hay)) failures.push("internal evidence terminology");
  const sharedLocalFacts = LOCAL_FACT_MARKERS_V3.filter(
    (marker) => marker.re.test(copy.heroIntroduction) && marker.re.test(copy.localIntroduction),
  );
  if (sharedLocalFacts.length >= 2) failures.push("repetitive facts across hero and local introduction");
  if ((hay.match(/\bbased in\b/gi) || []).length >= 2) failures.push("repetitive in-area fact");
  const premisesLocality = canonicalPremisesLocalityFromAddress(input.business.address);
  const canonicalPlaceHay = `${input.business.address} ${input.business.marketTown} ${premisesLocality}`.toLowerCase();
  for (const sibling of input.locality.neighbouringSelectedAreas || []) {
    if (
      sibling &&
      sibling.toLowerCase() !== input.locality.areaName.toLowerCase() &&
      !canonicalPlaceHay.includes(sibling.toLowerCase()) &&
      new RegExp(`\\b${sibling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(hay)
    ) {
      failures.push("forced place names");
    }
  }
  if (/\bfrom the centre of\b/i.test(hay) || TRAVEL_OR_CENTRE_DISTANCE_V3.test(hay)) {
    failures.push("unsupported travel-distance or town-centre claim");
  }
  if (RAW_PROVIDER_V3.test(hay)) failures.push("raw provider label in customer copy");
  if (ROUTE_V3.test(hay)) failures.push("unsupported route implication");
  failures.push(...inspectLocalLandmarkHelpfulnessV3(copy));
  const namedOrgs = hay.match(/\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,4}\s(?:Medical Centre|Health Centre|Surgery|Practice)\b/g) || [];
  if (new Set(namedOrgs.map((n) => n.toLowerCase())).size >= 3) {
    failures.push("entity list of healthcare providers");
  }
  for (const para of [copy.localIntroduction, ...copy.localContextParagraphs]) {
    const health = para.match(/\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,3}\s(?:Medical Centre|Health Centre)\b/g) || [];
    if (new Set(health.map((n) => n.toLowerCase())).size >= 2) {
      failures.push("entity list rather than editorial narrative");
    }
  }
  if (/\bWood Walk|Dovecliffe Road|Bleachcroft Way|Wombwell Lane\b/i.test(hay) && !/\bstation\b/i.test(hay)) {
    failures.push("road names without meaningful patient value");
  }
  if (countAddressMentionsV2(hay, input.business.address) >= 1) {
    failures.push("repeated address guidance");
  }
  if (input.business.telephone && splitSentences(hay).some((s) => s.includes(input.business.telephone))) {
    failures.push("repeated contact guidance");
  }
  const kmHits = splitSentences(hay).filter((s) => /\b\d+(?:\.\d+)?\s*km\b/i.test(s)).length;
  if (kmHits >= 2) failures.push("repeated distance guidance");
  for (const sentence of splitSentences(hay)) {
    if (!/\b\d+(?:\.\d+)?\s*km\b/i.test(sentence)) continue;
    if (!sentenceIdentifiesApproximateStraightLineKm(sentence)) {
      failures.push("distance must be identified as approximate straight-line");
    }
  }
  for (const faq of copy.localFaqs) {
    if (/^the pharmacy is not in [^.]+\.?$/i.test(faq.answer.trim())) {
      failures.push("unhelpful location answer");
    }
  }
  const rendererOwnedClinical =
    /\b(the pharmacist confirms what can be assessed|pharmacist will review your symptoms|seek urgent medical care|if pharmacy first is not suitable|call before visiting to check how a consultation|red-flag concerns|self-care advice, safety-netting|what happens during a pharmacy first consultation)\b/i;
  const localNames = [input.locality.areaName, premisesLocality].filter(Boolean);
  const localMarker = localNames.length
    ? new RegExp(`\\b(?:${localNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i")
    : /$a/;
  const supplementalClinicalFields = [
    copy.relationshipToPharmacy,
    copy.localAccessIntroduction,
    ...copy.localFaqs.flatMap((faq) => [faq.question, faq.answer]),
  ];
  if (
    supplementalClinicalFields.some(
      (text) => String(text || "").trim() && rendererOwnedClinical.test(text) && !localMarker.test(text),
    )
  ) {
    failures.push("restates renderer-owned clinical copy");
  }
  if (!/pharmacy first/i.test(copy.heroIntroduction)) {
    failures.push("hero does not lead with Pharmacy First");
  }
  const collapsedHero = copy.heroIntroduction.trim().replace(/\s+/g, " ");
  if (
    /^(?:.+ )?(?:has|is served by) a National Rail station\.?$/i.test(collapsedHero) ||
    /^NHS general practice services in .+ are provided from .+$/i.test(collapsedHero) ||
    /^.+ has a public library\.?$/i.test(collapsedHero)
  ) {
    failures.push("hero is a bare local fact");
  }
  const firstHero = splitSentences(copy.heroIntroduction)[0] || collapsedHero;
  if (
    /National Rail station|Medical Centre|Health Centre|public library|Country Park/i.test(firstHero) &&
    !/pharmacy first/i.test(firstHero)
  ) {
    failures.push("hero leads with a station, landmark or GP practice");
  }
  if (String(input.locality.areaSlug || "").toLowerCase() === "wombwell") {
    failures.push(...inspectWombwellHeroCopyFix(copy, input).failures);
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function inspectWombwellHeroCopyFix(
  copy: AiLocalCopyV1,
  input?: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const hay = flattenAiLocalCopyText(copy);
  if (!/pharmacy first/i.test(copy.heroIntroduction)) {
    failures.push("hero does not lead with Pharmacy First");
  }
  const firstHero = splitSentences(copy.heroIntroduction)[0] || copy.heroIntroduction;
  if (
    /National Rail station|Medical Centre|Health Centre|public library|Country Park/i.test(firstHero) &&
    !/pharmacy first/i.test(firstHero)
  ) {
    failures.push("hero is a bare local fact");
  }
  if (
    /National Rail station/i.test(hay) &&
    (/\b(orient you towards|route to|from \w+ to darfield|helps? you (?:reach|find your way) to|get to the pharmacy|travel to the pharmacy|by travelling to)\b/i.test(
      hay,
    ) ||
      /station.{0,60}(?:to the pharmacy|reach the pharmacy|get to (?:the )?pharmacy)/i.test(hay))
  ) {
    failures.push("station used as an unsupported route to the pharmacy");
  }
  if (
    /(?:contact|call|visit|use)\s+(?:a |the |your )?.{0,40}(?:Medical Centre|Health Centre)|Medical Centre.{0,40}(?:instead|your gp|usual gp)/i.test(
      hay,
    )
  ) {
    failures.push("named GP used without patient value");
  }
  failures.push(...inspectLocalLandmarkHelpfulnessV3(copy));
  if (
    /\b(residents can access|healthcare landscape|local healthcare options|convenient|easy reach|here are some common questions|expert help|prompt assessment|quick NHS|wait for a GP appointment)\b/i.test(
      hay,
    )
  ) {
    failures.push("generic or mechanical wording");
  }
  if (input && !input.locality.pharmacyIsInArea) {
    const area = String(input.locality.areaName || "").trim();
    if (area && (!/pharmacy first/i.test(copy.heroIntroduction) || !new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(copy.heroIntroduction))) {
      failures.push("copy does not explain Pharmacy First for readers in the selected area");
    }
    const premises = canonicalPremisesLocalityFromAddress(input.business.address);
    if (premises) {
      const locRe = new RegExp(`\\b${premises.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const locatesPharmacy = splitSentences(hay).some(
        (sentence) =>
          locRe.test(sentence) &&
          /\b(the pharmacy|pharmacy & health clinic|premises)\b/i.test(sentence) &&
          new RegExp(
            `\\b(?:is in|are in|based in|located in)\\s+${premises.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "i",
          ).test(sentence),
      );
      if (!locatesPharmacy) {
        failures.push("copy does not explain that the pharmacy is in the premises locality");
      }
    }
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function canonicalPremisesLocalityFromAddress(address: string): string {
  return premisesLocalityFromCanonicalAddress(address);
}

function landmarkSentenceHelpsPharmacy(sentence: string): boolean {
  if (!/National Rail station|Medical Centre|Health Centre/i.test(sentence)) return true;
  if (/place context|recognisable local setting|local setting for/i.test(sentence)) return false;
  const locationOrAccess =
    /\bpremises\b/i.test(sentence) ||
    (/\bthe pharmacy\b/i.test(sentence) &&
      /\b(\d+(?:\.\d+)?\s*km|is in |is not in |based in |located in |call|visit|consultations? take place)\b/i.test(
        sentence,
      ));
  const serviceDistinction =
    /pharmacy first/i.test(sentence) &&
    /(?:pharmacist|not a gp appointment|consultation)/i.test(sentence) &&
    /\b(not|rather than|instead of)\b/i.test(sentence) &&
    /\b(gp appointment|medical centre|health centre)\b/i.test(sentence);
  return locationOrAccess || serviceDistinction;
}

export function inspectLocalLandmarkHelpfulnessV3(copy: AiLocalCopyV1): string[] {
  const failures: string[] = [];
  const fields = [copy.heroIntroduction, copy.localIntroduction, ...copy.localContextParagraphs, copy.localAccessIntroduction];
  for (const field of fields) {
    for (const sentence of splitSentences(field).concat(field.trim() ? [field.trim()] : [])) {
      if (!landmarkSentenceHelpsPharmacy(sentence)) {
        failures.push("local fact does not help the reader understand the pharmacy's location, access or service");
        return failures;
      }
    }
  }
  return failures;
}

export function formatCustomerFacingLocalCopyV3(copy: AiLocalCopyV1): string {
  const lines = [
    `heroHeading: ${copy.heroHeading}`,
    `heroIntroduction: ${copy.heroIntroduction}`,
  ];
  if (String(copy.localIntroduction || "").trim()) lines.push(`localIntroduction: ${copy.localIntroduction}`);
  if (String(copy.localContextHeading || "").trim()) lines.push(`localContextHeading: ${copy.localContextHeading}`);
  lines.push(...copy.localContextParagraphs.map((para, i) => `localContextParagraphs[${i}]: ${para}`));
  if (String(copy.relationshipToPharmacy || "").trim()) lines.push(`relationshipToPharmacy: ${copy.relationshipToPharmacy}`);
  if (String(copy.localAccessIntroduction || "").trim()) lines.push(`localAccessIntroduction: ${copy.localAccessIntroduction}`);
  lines.push(...copy.localFaqs.flatMap((faq) => [`Q: ${faq.question}`, `A: ${faq.answer}`]));
  if (String(copy.localCtaBridge || "").trim()) lines.push(`localCtaBridge: ${copy.localCtaBridge}`);
  return lines.join("\n");
}

export function inspectAiLocalCopyForPublicationV3(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  return evaluateAiLocalCopyQualityV3(copy, input);
}

export function localNarrativeFingerprint(copy: AiLocalCopyV1): string {
  return [
    copy.heroIntroduction,
    copy.localIntroduction,
    copy.localContextParagraphs.join(" "),
    copy.relationshipToPharmacy,
    copy.localAccessIntroduction,
    copy.localFaqs[0]?.answer || "",
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CALL_AHEAD_V2 =
  /\b(call(?:ing)? ahead|call before|phone (?:the pharmacy )?(?:before|ahead)|before (?:coming in|attending|visiting|travelling|setting out|you (?:visit|travel)))\b/i;
const GENERIC_OPENING_V2 =
  /^\s*residents (?:of|in) .{2,40} can (?:access|use) pharmacy first\b/i;
const EMPTY_LOCAL_V2 =
  /\b(support your health locally|designed to support your health|convenient way for .+ residents|prompt support for minor|supports access to nhs care|do not need to travel outside|without needing to travel outside|do not need to look outside|close to home)\b/i;

function countAddressMentionsV2(hay: string, address: string): number {
  const street = String(address || "").split(",")[0]?.replace(/^\d+\s+/, "").trim() || "";
  const sentences = splitSentences(hay);
  if (!street) return 0;
  return sentences.filter((s) => s.toLowerCase().includes(street.toLowerCase())).length;
}

export function evaluateAiLocalCopyQualityV2(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const hay = flattenAiLocalCopyText(copy);
  const grammarHay = [
    copy.heroIntroduction,
    copy.localIntroduction,
    ...copy.localContextParagraphs,
    copy.relationshipToPharmacy,
    copy.localAccessIntroduction,
    ...copy.localFaqs.map((faq) => faq.answer),
    copy.localCtaBridge,
  ].join(" ");
  failures.push(...evaluateProhibitedCustomerLanguage(hay).map((f) => `prohibited: ${f}`));
  failures.push(...evaluateGrammarAndFragments(grammarHay).map((f) => `grammar: ${f}`));

  if (/\bin-area premises\b|\btravelling from the area to the supplied address\b|\bsupplied address\b/i.test(hay)) {
    failures.push("instruction text leaked into copy");
  }
  if (/\bevidence packs?\b|\battribution\b|\bprovenance\b|\bshould not be read as a recommendation\b|\bnot affiliated\b/i.test(hay)) {
    failures.push("explains evidence handling or non-affiliation");
  }
  if (GENERIC_OPENING_V2.test(copy.heroIntroduction)) {
    failures.push("generic area-substitution opening");
  }
  if (/\bprovide a range of nhs services\b/i.test(hay)) {
    failures.push("unsupported local NHS-service claim");
  }
  if (/\bwithin easy reach\b|\beasy reach\b|\bconvenient\b|\befficient(?:ly)?\b|\bprompt support\b|\bavoid(?:ing)? (?:unnecessary )?delays?\b/i.test(hay)) {
    failures.push("unsupported convenience, reach or delay claim");
  }
  if (/\bshort distance\b|\bjust a short\b/i.test(hay)) {
    failures.push("unsupported proximity characterisation");
  }
  const gpUsageV2 = splitSentences(hay).filter(
    (sentence) =>
      /\bpatients who normally use\b|\byour usual gp\b|\byour local gp\b|\byour gp (?:at|practice|surgery)\b|registered at .{0,40}(?:surgery|practice|medical centre|gp)/i.test(
        sentence,
      ) &&
      !/\bnot (?:your|assumed)\b/i.test(sentence) &&
      !/\bonly for people registered\b/i.test(sentence) &&
      !/\?$/.test(sentence.trim()),
  );
  if (gpUsageV2.length) failures.push("implies the reader uses a named medical practice");
  if (/\boften (?:visit|use|travel)\b/i.test(hay)) failures.push("assumed patient routines");
  if (/\bsame-day\b|\bsame day\b|\bpharmacist availability\b/i.test(hay)) {
    failures.push("unsupported availability claim");
  }

  const addressHits = countAddressMentionsV2(hay, input.business.address);
  if (addressHits >= 2) failures.push("repeated address guidance");
  const phoneHits = splitSentences(hay).filter((s) => input.business.telephone && s.includes(input.business.telephone)).length;
  if (phoneHits >= 2) failures.push("repeated contact guidance");
  const callHits = splitSentences(hay).filter((s) => CALL_AHEAD_V2.test(s));
  if (callHits.length >= 2) failures.push("repeated call-ahead guidance");

  const areaMentions = splitSentences(hay).filter((s) =>
    s.toLowerCase().includes(input.locality.areaName.toLowerCase()),
  ).length;
  if (areaMentions >= 12) failures.push("area name repeated as SEO stuffing");

  const schoolRetail = input.locality.acceptedEntities.filter((e) => e.category === "schools" || e.category === "retail");
  for (const entity of schoolRetail) {
    if (hay.toLowerCase().includes(entity.name.toLowerCase())) {
      failures.push(`school/retail forced into copy: ${entity.name}`);
    }
  }

  const listedEntities = input.locality.acceptedEntities.filter((entity) => {
    if (entity.name.trim().toLowerCase() === input.locality.areaName.trim().toLowerCase()) return false;
    return hay.toLowerCase().includes(entity.name.toLowerCase());
  });
  if (listedEntities.length >= 4) {
    const context = copy.localContextParagraphs.join(" ");
    const namedInOnePara = listedEntities.filter((e) => context.toLowerCase().includes(e.name.toLowerCase()));
    if (namedInOnePara.length >= 5) failures.push("entity list rather than editorial narrative");
  }

  const lockedList = PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1.conditionSet;
  if (/\b(chickenpox|covid|flu jab|blood pressure|travel vaccine|hay fever)\b/i.test(hay)) {
    failures.push("unsupported clinical claim");
  }
  const listed = hay.match(/sore throat, earache[^.]+/i);
  if (listed && listed[0] && !/infected insect bites, shingles, sinusitis/.test(listed[0])) {
    failures.push("approved clinical copy rewritten");
  }
  if (listed && !lockedList.toLowerCase().includes("sore throat, earache, impetigo")) {
    failures.push("approved clinical copy rewritten");
  }

  for (const para of copy.localContextParagraphs) {
    if (para.split(/\s+/).filter(Boolean).length > 140) failures.push("generic filler written only to increase length");
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}
