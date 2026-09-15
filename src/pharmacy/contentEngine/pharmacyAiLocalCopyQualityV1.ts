/**
 * Quality gates for AI local copy — language, clinical boundary, stuffing, fragments, repetition.
 */
import { evaluateProhibitedCustomerLanguage, evaluateGrammarAndFragments } from "./pharmacyLocalCandidateReadabilityV1.ts";
import type { AiLocalCopyV1 } from "./pharmacyAiLocalCopySchemaV1.ts";
import { flattenAiLocalCopyText } from "./pharmacyAiLocalCopySchemaV1.ts";
import {
  ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3,
  PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1,
  premisesLocalityFromCanonicalAddress,
  isRendererOwnedPharmacyFirstIntroductionSentence,
  isApprovedPharmacyFirstServiceMeaningSentence,
  stripRendererOwnedPharmacyFirstIntroductionParagraph,
  stripRendererOwnedLocalHandoverClinicalSentence,
  RENDERER_OWNED_PHARMACY_FIRST_INTRODUCTION_PARAGRAPH,
} from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import type { BusinessLocalityCopyInputV1 } from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import { formatWritingContractFindingV3, splitSentences } from "./pharmacyAiLocalCopyClaimGroundingV1.ts";
import { copySimilarityScore } from "../pharmacyLocalClusterVariantFamilies.ts";
import type { EditorialFactV3 } from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import {
  UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE,
  UK_LOCAL_INTRODUCTION_MAX_WORDS,
  UK_LOCAL_INTRODUCTION_MIN_WORDS,
  UK_LOCAL_INTRODUCTION_GEMINI_MAX_WORDS,
  UK_LOCAL_INTRODUCTION_GEMINI_MIN_WORDS,
  UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS,
  UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS,
  countUkLocalIntroductionWords,
} from "./pharmacyUkLocalIntroductionStyleContractV1.ts";

const SCHOOL_RETAIL =
  /\b(Academy|Primary School|Infant School|Junior School|Secondary School|Retail Park|Shopping Centre|Supermarket)\b/;
const CALL_BEFORE = /\bcall\b[\s\S]{0,40}\bbefore (?:visiting|travelling|you (?:visit|travel|set off))\b/i;

export function evaluateAiLocalCopyQualityV1(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const hay = flattenAiLocalCopyText({
    ...copy,
    localIntroduction: stripRendererOwnedPharmacyFirstIntroductionParagraph(copy.localIntroduction),
  });
  const grammarHay = [
    copy.heroIntroduction,
    stripRendererOwnedPharmacyFirstIntroductionParagraph(copy.localIntroduction),
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

const GP_ALTERNATIVE_V3 =
  /\b(use my GP|my GP practice instead|use (?:my |a )?GP practice instead|contact a GP practice such as|(?:a |your )?GP practice such as)\b/i;
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
  /\b(orient you towards|route to the pharmacy|helps? you (?:reach|find your way)(?: to)?|reach (?:the pharmacy|pharmacy first) by travelling|by travelling to|walking connection|along .{0,40} (?:road|lane|way) to the pharmacy|help you reach the pharmacy)\b/i;
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

function qualityFinding(
  field: string,
  sentence: string,
  rule: string,
  defect: string,
  severity: "fail" | "review" = "fail",
): string {
  return formatWritingContractFindingV3({ severity, field, sentence, rule, defect });
}

function fieldSentencesV3(copy: AiLocalCopyV1): Array<{ field: string; sentence: string }> {
  const rows: Array<{ field: string; sentence: string }> = [];
  const push = (field: string, text: string) => {
    const parts = splitSentences(text);
    if (!parts.length && String(text || "").trim()) parts.push(String(text).trim());
    for (const sentence of parts) rows.push({ field, sentence });
  };
  push("heroHeading", copy.heroHeading);
  push("heroIntroduction", copy.heroIntroduction);
  push("localIntroduction", copy.localIntroduction);
  push("localContextHeading", copy.localContextHeading);
  copy.localContextParagraphs.forEach((text, i) => push(`localContextParagraphs[${i}]`, text));
  push("relationshipToPharmacy", copy.relationshipToPharmacy);
  push("localAccessIntroduction", copy.localAccessIntroduction);
  copy.localFaqs.forEach((faq, i) => {
    push(`localFaqs[${i}].question`, faq.question);
    push(`localFaqs[${i}].answer`, faq.answer);
  });
  push("localCtaBridge", copy.localCtaBridge);
  return rows;
}

const EMPTY_LOCAL_CLAIM_QUALITY_V3: Array<{ re: RegExp; defect: string }> = [
  { re: /\bcommunity resources\b/i, defect: "“community resources” is an empty local claim, not a supplied fact" },
  { re: /\bcommunity networks\b/i, defect: "“community networks” is an empty local claim, not a supplied fact" },
  { re: /\bhealthcare networks\b|\bestablished local healthcare\b/i, defect: "empty healthcare-network wording is not a supplied fact" },
  { re: /\brange of support\b|\baccess to a range of support\b/i, defect: "“range of support” is an empty local claim, not a supplied fact" },
  { re: /\bhealthcare landscape\b/i, defect: "“healthcare landscape” is an empty local claim, not a supplied fact" },
  { re: /\blocal healthcare options\b/i, defect: "“local healthcare options” is an empty local claim, not a supplied fact" },
  { re: /\blocal amenities\b/i, defect: "“local amenities” is an empty local claim, not a supplied fact" },
  { re: /\bknown for\b/i, defect: "“known for” asserts character that is not a supplied fact" },
  { re: /\bstrong local identity\b|\blocal identity\b|\bown identity\b/i, defect: "identity wording is not a supplied fact" },
  { re: /\bpart of the local community\b|\bserving the local community\b/i, defect: "community-belonging wording is not a supplied fact" },
  { re: /\bresidents can access\b/i, defect: "“residents can access” is empty pathway wording" },
];

export function evaluateAiLocalCopyQualityV3(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[]; reviews: string[] } {
  const base = evaluateAiLocalCopyQualityV2(copy, input);
  const failures = [...base.failures];
  const reviews: string[] = [];
  const hay = flattenAiLocalCopyText({
    ...copy,
    localIntroduction: stripRendererOwnedPharmacyFirstIntroductionParagraph(copy.localIntroduction),
  });
  for (const { field, sentence } of fieldSentencesV3(copy)) {
    if (isRendererOwnedPharmacyFirstIntroductionSentence(sentence)) continue;
    if (isApprovedPharmacyFirstServiceMeaningSentence(sentence)) continue;
    for (const check of EMPTY_LOCAL_CLAIM_QUALITY_V3) {
      if (check.re.test(sentence)) {
        failures.push(qualityFinding(field, sentence, "empty-local-claim", check.defect));
      }
    }
    if (/\b(straightforward|community focus|sense of local heritage|those nearby|range of services nearby|just outside the area|benefits from established|reflecting its role|centre for local services)\b/i.test(sentence)) {
      failures.push(qualityFinding(field, sentence, "empty-local-claim", "the sentence uses empty local wording that is not a supplied fact"));
    }
  }
  if (GP_ALTERNATIVE_V3.test(hay)) {
    const hit = fieldSentencesV3(copy).find((row) => GP_ALTERNATIVE_V3.test(row.sentence));
    failures.push(qualityFinding(hit?.field || "page", hit?.sentence || hay, "gp-alternative", "unsupported GP-alternative implication"));
  }
  if (EVIDENCE_JARGON_V3.test(hay)) {
    const hit = fieldSentencesV3(copy).find((row) => EVIDENCE_JARGON_V3.test(row.sentence));
    failures.push(qualityFinding(hit?.field || "page", hit?.sentence || hay, "evidence-jargon", "internal evidence terminology"));
  }
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
    const hit = fieldSentencesV3(copy).find((row) => /from the centre of/i.test(row.sentence) || TRAVEL_OR_CENTRE_DISTANCE_V3.test(row.sentence));
    failures.push(qualityFinding(hit?.field || "page", hit?.sentence || hay, "unsupported-travel-distance", "unsupported travel-distance or town-centre claim"));
  }
  if (RAW_PROVIDER_V3.test(hay)) failures.push("raw provider label in customer copy");
  if (ROUTE_V3.test(hay)) {
    const hit = fieldSentencesV3(copy).find((row) => ROUTE_V3.test(row.sentence));
    failures.push(qualityFinding(hit?.field || "page", hit?.sentence || hay, "unsupported-route", "unsupported route implication"));
  }
  failures.push(...inspectLocalLandmarkHelpfulnessV3(copy));
  const namedOrgs = hay.match(/\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,4}\s(?:Medical Centre|Health Centre|Surgery|Practice)\b/g) || [];
  if (new Set(namedOrgs.map((n) => n.toLowerCase())).size >= 3) {
    failures.push("entity list of healthcare providers");
  }
  for (const para of [copy.localIntroduction, ...copy.localContextParagraphs].flatMap((text) =>
    String(text || "").split(/\n\n+/),
  )) {
    const health = para.match(/\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,3}\s(?:Medical Centre|Health Centre)\b/g) || [];
    if (new Set(health.map((n) => n.toLowerCase())).size >= 3) {
      failures.push("entity list rather than editorial narrative");
    }
  }
  if (/\bWood Walk|Dovecliffe Road|Bleachcroft Way|Wombwell Lane\b/i.test(hay) && !/\bstation\b/i.test(hay)) {
    failures.push("road names without meaningful patient value");
  }
  if (countAddressMentionsV2(hay, input.business.address) >= 1) {
    const hit = fieldSentencesV3(copy).find((row) => countAddressMentionsV2(row.sentence, input.business.address) >= 1);
    failures.push(qualityFinding(hit?.field || "page", hit?.sentence || hay, "street-address-in-copy", "repeated address guidance — validate the original prose; do not silently strip the address"));
  }
  for (const { field, sentence } of fieldSentencesV3(copy)) {
    if (/\byour gp\b/i.test(sentence)) {
      failures.push(qualityFinding(field, sentence, "your-gp", "“your GP” implies the reader uses a named practice; this is a defect in the original prose"));
    }
  }
  if (input.business.telephone && splitSentences(hay).some((s) => s.includes(input.business.telephone))) {
    failures.push("repeated contact guidance");
  }
  const kmHits = splitSentences(hay).filter((s) => /\b\d+(?:\.\d+)?\s*km\b/i.test(s)).length;
  if (kmHits >= 2) failures.push("repeated distance guidance");
  for (const { field, sentence } of fieldSentencesV3(copy)) {
    if (!/\b\d+(?:\.\d+)?\s*km\b/i.test(sentence)) continue;
    if (!sentenceIdentifiesApproximateStraightLineKm(sentence)) {
      failures.push(qualityFinding(field, sentence, "unlabelled-distance", "distance must be identified as approximate straight-line"));
    }
  }
  for (const faq of copy.localFaqs) {
    if (/^the pharmacy is not in [^.]+\.?$/i.test(faq.answer.trim())) {
      failures.push(qualityFinding("localFaqs", faq.answer, "unhelpful-location-answer", "unhelpful location answer"));
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
    failures.push(qualityFinding("heroIntroduction", copy.heroIntroduction, "hero-lead", "hero does not lead with Pharmacy First"));
  }
  const collapsedHero = copy.heroIntroduction.trim().replace(/\s+/g, " ");
  if (
    /^(?:.+ )?(?:has|is served by) a National Rail station\.?$/i.test(collapsedHero) ||
    /^NHS general practice services in .+ are provided from .+$/i.test(collapsedHero) ||
    /^.+ has a public library\.?$/i.test(collapsedHero)
  ) {
    failures.push(qualityFinding("heroIntroduction", copy.heroIntroduction, "bare-hero-fact", "hero is a bare local fact"));
  }
  const firstHero = splitSentences(copy.heroIntroduction)[0] || collapsedHero;
  if (
    /National Rail station|Medical Centre|Health Centre|public library|Country Park/i.test(firstHero) &&
    !/pharmacy first/i.test(firstHero)
  ) {
    failures.push(qualityFinding("heroIntroduction", firstHero, "hero-lead", "hero leads with a station, landmark or GP practice"));
  }
  failures.push(...inspectOffPremisesAccessCopyV3(copy, input).failures);
  failures.push(...inspectLocalRecognitionV3(copy, input));
  const usesGeminiHeroAndLocalHandover = Boolean(
    (input as { ukLocalIntroductionStyle?: unknown }).ukLocalIntroductionStyle,
  );
  const geminiLocalIntroduction = stripRendererOwnedPharmacyFirstIntroductionParagraph(copy.localIntroduction);
  const assembledWithRendererOwnedClose = copy.localIntroduction.includes(
    RENDERER_OWNED_PHARMACY_FIRST_INTRODUCTION_PARAGRAPH,
  );
  const introWords = countUkLocalIntroductionWords(
    usesGeminiHeroAndLocalHandover
      ? stripRendererOwnedLocalHandoverClinicalSentence(copy.localIntroduction)
      : assembledWithRendererOwnedClose
        ? geminiLocalIntroduction
        : copy.localIntroduction,
  );
  const heroWords = countUkLocalIntroductionWords(copy.heroIntroduction);
  const localParagraphs = String(copy.localIntroduction || "")
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const paragraphsEmpty = !copy.localContextParagraphs.join(" ").trim();
  if (usesGeminiHeroAndLocalHandover) {
    const pharmacyName = String(input.business.name || "").trim();
    const pharmacyRe = pharmacyName
      ? new RegExp(pharmacyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : /(?!)/;
    if (heroWords < UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS || heroWords > UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS) {
      failures.push(
        qualityFinding(
          "heroIntroduction",
          copy.heroIntroduction,
          "hero-introduction-length",
          `Gemini hero introduction must be ${UK_LOCAL_HERO_INTRODUCTION_MIN_WORDS}–${UK_LOCAL_HERO_INTRODUCTION_MAX_WORDS} words (found ${heroWords})`,
        ),
      );
    }
    if (
      localParagraphs.length !== 3 ||
      introWords < UK_LOCAL_INTRODUCTION_GEMINI_MIN_WORDS ||
      introWords > UK_LOCAL_INTRODUCTION_GEMINI_MAX_WORDS
    ) {
      failures.push(
        qualityFinding(
          "localIntroduction",
          copy.localIntroduction,
          "local-introduction-length",
          `Gemini local introduction must be three paragraphs totalling ${UK_LOCAL_INTRODUCTION_GEMINI_MIN_WORDS}–${UK_LOCAL_INTRODUCTION_GEMINI_MAX_WORDS} words (found ${localParagraphs.length} paragraphs, ${introWords} words)`,
        ),
      );
    }
    if (!pharmacyRe.test(copy.heroIntroduction) || !/pharmacy first/i.test(copy.heroIntroduction)) {
      failures.push(
        qualityFinding(
          "heroIntroduction",
          copy.heroIntroduction,
          "hero-provider",
          `hero must introduce Pharmacy First and name ${pharmacyName || "the confirmed pharmacy"}`,
        ),
      );
    }
    if (!pharmacyRe.test(copy.localIntroduction) || !/pharmacy first/i.test(copy.localIntroduction)) {
      failures.push(
        qualityFinding(
          "localIntroduction",
          copy.localIntroduction,
          "local-handover",
          `local introduction must name ${pharmacyName || "the confirmed pharmacy"} and Pharmacy First`,
        ),
      );
    }
  } else if (paragraphsEmpty && introWords >= 40) {
    const minWords = assembledWithRendererOwnedClose
      ? UK_LOCAL_INTRODUCTION_GEMINI_MIN_WORDS
      : UK_LOCAL_INTRODUCTION_MIN_WORDS;
    const maxWords = assembledWithRendererOwnedClose
      ? UK_LOCAL_INTRODUCTION_GEMINI_MAX_WORDS
      : UK_LOCAL_INTRODUCTION_MAX_WORDS;
    if (introWords < minWords || introWords > maxWords) {
      failures.push(
        qualityFinding(
          "localIntroduction",
          copy.localIntroduction,
          "local-introduction-length",
          assembledWithRendererOwnedClose
            ? `Gemini local introduction must be ${minWords}–${maxWords} words before the renderer-owned Pharmacy First paragraph (found ${introWords})`
            : `local introduction must be ${minWords}–${maxWords} words (found ${introWords})`,
        ),
      );
    }
  }
  if (UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE.test(copy.heroIntroduction)) {
    failures.push(
      qualityFinding(
        "heroIntroduction",
        copy.heroIntroduction,
        "evidence-listing-language",
        "customer-facing hero uses evidence-listing language",
      ),
    );
  }
  if (UK_LOCAL_INTRODUCTION_LISTING_LANGUAGE.test(copy.localIntroduction)) {
    failures.push(
      qualityFinding(
        "localIntroduction",
        copy.localIntroduction,
        "evidence-listing-language",
        "customer-facing introduction uses evidence-listing language",
      ),
    );
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)], reviews: [...new Set(reviews)] };
}

const LOCATES_PHARMACY_LANGUAGE_V3 =
  /\b(the pharmacy|pharmacy & health clinic|premises|consultations? take place)\b/i;

function sentenceLocatesPharmacyInPremisesLocality(sentence: string, locRe: RegExp): boolean {
  return locRe.test(sentence) && LOCATES_PHARMACY_LANGUAGE_V3.test(sentence);
}

function fieldLocatesPharmacyInPremisesLocality(text: string, locRe: RegExp): boolean {
  return splitSentences(String(text || "")).some((sentence) => sentenceLocatesPharmacyInPremisesLocality(sentence, locRe));
}

export function inspectOffPremisesAccessCopyV3(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  if (input.locality.pharmacyIsInArea) return { ok: true, failures };
  const hay = flattenAiLocalCopyText(copy);
  const area = String(input.locality.areaName || "").trim();
  if (area && (!/pharmacy first/i.test(copy.heroIntroduction) || !new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(copy.heroIntroduction))) {
    failures.push(qualityFinding("heroIntroduction", copy.heroIntroduction, "area-in-hero", "copy does not explain Pharmacy First for readers in the selected area"));
  }
  const premises = canonicalPremisesLocalityFromAddress(input.business.address);
  if (premises) {
    const locRe = new RegExp(`\\b${premises.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const locatesPharmacy = splitSentences(hay).some((sentence) => sentenceLocatesPharmacyInPremisesLocality(sentence, locRe));
    if (!locatesPharmacy) {
      failures.push(qualityFinding("relationshipToPharmacy", copy.relationshipToPharmacy, "premises-locality", "copy does not explain that the pharmacy is in the premises locality"));
    }
    const locationFields = [copy.heroIntroduction, copy.relationshipToPharmacy, copy.localAccessIntroduction]
      .map((text) => String(text || "").trim())
      .filter(Boolean);
    const locationMentions = locationFields.filter((text) => locRe.test(text)).length;
    const contextMentions = [copy.localIntroduction, ...copy.localContextParagraphs].filter((text) =>
      fieldLocatesPharmacyInPremisesLocality(text, locRe),
    ).length;
    if (locationMentions >= 1 && contextMentions >= 1) {
      failures.push("premises locality repeated across local context and access fields");
    }
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
    (/\b(orient you towards|route to|helps? you (?:reach|find your way) to|get to the pharmacy|travel to the pharmacy|by travelling to)\b/i.test(
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
  if (input) failures.push(...inspectOffPremisesAccessCopyV3(copy, input).failures);
  failures.push(...inspectLocalRecognitionV3(copy, input));
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function canonicalPremisesLocalityFromAddress(address: string): string {
  return premisesLocalityFromCanonicalAddress(address);
}

function landmarkSentenceHelpsPharmacy(sentence: string): boolean {
  if (/place context|recognisable local setting|local setting for/i.test(sentence)) return false;
  if (
    /(?:contact|call|visit|use)\s+(?:a |the |your )?.{0,40}(?:Medical Centre|Health Centre)|Medical Centre.{0,40}(?:instead|your gp|usual gp)/i.test(
      sentence,
    )
  ) {
    return false;
  }
  if (
    /National Rail station/i.test(sentence) &&
    /\b(orient you towards|route to|helps? you (?:reach|find your way)(?: to)?|get to the pharmacy|travel to the pharmacy|by travelling to|help you reach the pharmacy)\b/i.test(
      sentence,
    )
  ) {
    return false;
  }
  return true;
}

export function inspectLocalLandmarkHelpfulnessV3(copy: AiLocalCopyV1): string[] {
  const failures: string[] = [];
  const fields: Array<{ field: string; text: string }> = [
    { field: "heroIntroduction", text: copy.heroIntroduction },
    { field: "localIntroduction", text: copy.localIntroduction },
    ...copy.localContextParagraphs.map((text, i) => ({ field: `localContextParagraphs[${i}]`, text })),
    { field: "localAccessIntroduction", text: copy.localAccessIntroduction },
  ];
  for (const { field, text } of fields) {
    for (const sentence of splitSentences(text).concat(text.trim() ? [text.trim()] : [])) {
      if (!landmarkSentenceHelpsPharmacy(sentence)) {
        failures.push(
          qualityFinding(
            field,
            sentence,
            "landmark-misused",
            "local fact does not help the reader understand the pharmacy's location, access or service — the sentence uses a station or Medical Centre as a route, booking alternative, or padded place-context phrase. Supported local character does not need to describe a route.",
          ),
        );
        return failures;
      }
    }
  }
  return failures;
}

export function inspectLocalRecognitionV3(copy: AiLocalCopyV1, input?: BusinessLocalityCopyInputV1): string[] {
  const failures: string[] = [];
  const hay = flattenAiLocalCopyText(copy);
  const localHay = [copy.localIntroduction, ...copy.localContextParagraphs].join(" ");
  if (
    /\b(because .{0,80}(?:need|choose|use) pharmacy first|mining heritage means|poor health means|census health .{0,40}(?:so|therefore)|residents (?:often|typically) (?:need|choose|use) pharmacy first)\b/i.test(
      hay,
    )
  ) {
    failures.push(
      qualityFinding(
        "localContextParagraphs[0]",
        localHay || hay,
        "character-proves-demand",
        "local character used to prove healthcare demand or treatment choice",
      ),
    );
  }
  if (!String(localHay || "").trim()) {
    failures.push(qualityFinding("localIntroduction", "", "missing-local-account", "missing locally informed account"));
    return failures;
  }
  const area = String(input?.locality.areaName || copy.area || "").trim();
  const premises = input ? canonicalPremisesLocalityFromAddress(input.business.address) : "";
  const pharmacy = String(input?.business.name || "").trim();
  let stripped = localHay;
  if (area) stripped = stripped.replace(new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  if (premises) stripped = stripped.replace(new RegExp(premises.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  if (pharmacy) stripped = stripped.replace(new RegExp(pharmacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  stripped = stripped
    .replace(/\b\d+(?:\.\d+)?\s*km\b/gi, " ")
    .replace(/\bapproximate(?:ly)?\b/gi, " ")
    .replace(/\bstraight[\s-]lines?\b/gi, " ")
    .replace(/\bconsultations? take place\b/gi, " ")
    .replace(/\bpharmacy is not in\b/gi, " ")
    .replace(/\bsouth area council\b/gi, " ")
    .replace(/\b(which|like|from|with|into|onto|also|just)\b/gi, " ");
  if (input?.business.marketTown) {
    stripped = stripped.replace(new RegExp(input.business.marketTown.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), " ");
  }
  const words = stripped
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
  if (words.length < 2) {
    failures.push(
      qualityFinding(
        "localIntroduction",
        localHay,
        "access-only-local-copy",
        "local copy is only access or location restatement and would not help a reader recognise the area; locality quality does not require population, housing, industry, a library or a Medical Centre",
      ),
    );
  }
  return failures;
}

export function inspectWombwellLocalRecognitionV3(copy: AiLocalCopyV1, input?: BusinessLocalityCopyInputV1): string[] {
  return inspectLocalRecognitionV3(copy, input);
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
  const hay = flattenAiLocalCopyText({
    ...copy,
    localIntroduction: stripRendererOwnedPharmacyFirstIntroductionParagraph(copy.localIntroduction),
  });
  const grammarHay = [
    copy.heroIntroduction,
    stripRendererOwnedPharmacyFirstIntroductionParagraph(copy.localIntroduction),
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
  if (/\bwithin easy reach\b|\beasy reach\b|\bconvenient\b|\befficient(?:ly)?\b|\bprompt support\b|\bavoid(?:ing)? (?:unnecessary )?delays?\b|\bwithout(?:\s+\w+){0,2}\s+delays?\b/i.test(hay)) {
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

const NEAR_DUPLICATE_SENTENCE_THRESHOLD = 0.88;
export const MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2 = 3;

function normalizeSentenceForDup(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function localContextNarrativeFingerprint(copy: AiLocalCopyV1): string {
  return [copy.localIntroduction, copy.localContextHeading, ...copy.localContextParagraphs, copy.localAccessIntroduction, copy.localCtaBridge]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function stripRendererOwnedPharmacyFirstSentences(text: string): string {
  const clinical = ALLOWED_PHARMACY_FIRST_AI_FIELD_SENTENCE_V3.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ownedClose = RENDERER_OWNED_PHARMACY_FIRST_INTRODUCTION_PARAGRAPH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(text || "")
    .replace(new RegExp(ownedClose, "gi"), " ")
    .replace(new RegExp(clinical, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findRepeatedLocalSentences(copy: AiLocalCopyV1): string[] {
  const failures: string[] = [];
  const sentences = fieldSentencesV3(copy)
    .filter((row) => !/^heroHeading$|^heroIntroduction$|^relationshipToPharmacy$/.test(row.field))
    .map((row) => row.sentence)
    .filter((sentence) => sentence.split(/\s+/).filter(Boolean).length >= 6);
  const normalized = sentences.map(normalizeSentenceForDup);
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      if (!normalized[i] || !normalized[j]) continue;
      if (normalized[i] === normalized[j]) {
        failures.push(`repeated sentence: ${sentences[i]!.slice(0, 100)}`);
        return failures;
      }
      if (copySimilarityScore(normalized[i]!, normalized[j]!) > NEAR_DUPLICATE_SENTENCE_THRESHOLD) {
        failures.push(`near-duplicate sentence: ${sentences[i]!.slice(0, 100)}`);
        return failures;
      }
    }
  }
  return failures;
}

export function distinctVerifiedLocalReferencesFromCopy(
  copy: AiLocalCopyV1 & { editorialFactIdsUsed?: string[] },
  facts: EditorialFactV3[],
): string[] {
  const hay = [
    copy.localIntroduction,
    ...copy.localContextParagraphs,
    copy.localAccessIntroduction,
    ...copy.localFaqs.map((faq) => faq.answer),
  ]
    .join(" ")
    .toLowerCase();
  const usedIds = [
    ...new Set(
      [
        ...(copy.editorialFactIdsUsed || []),
        ...copy.evidenceClaims.map((row) => String(row.editorialFactId || "").trim()),
      ].filter(Boolean),
    ),
  ];
  const byId = new Map(facts.filter((fact) => fact.validationStatus === "accepted").map((fact) => [fact.factId, fact]));
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const id of usedIds) {
    const fact = byId.get(id);
    if (!fact) continue;
    if (fact.category === "pharmacy-relationship") continue;
    if (
      !hay.includes(fact.normalizedStatement.slice(0, 24).toLowerCase()) &&
      !statementNameAppears(fact.normalizedStatement, hay)
    ) {
      continue;
    }
    const label = distinctiveLocalReferenceLabel(fact);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function statementNameAppears(statement: string, hay: string): boolean {
  const name = distinctiveLocalReferenceLabel({ normalizedStatement: statement, category: "community" });
  return name.length >= 4 && hay.includes(name.toLowerCase());
}

function distinctiveLocalReferenceLabel(fact: Pick<EditorialFactV3, "normalizedStatement" | "category">): string {
  const statement = String(fact.normalizedStatement || "").trim();
  const from =
    statement.match(/provided from\s+(.+?)\.?$/i)?.[1] ||
    statement.match(/^(.+?)\s+is listed as a /i)?.[1] ||
    statement.match(/^(.+?)\s+is named on /i)?.[1] ||
    statement.match(/\bhas a ([A-Z][^.]*?(?:Board|Park|Library|Centre|Carnival)[^.]*)/i)?.[1] ||
    statement;
  return String(from || statement).replace(/\.$/, "").trim();
}

function isDistinctNamedLocalReference(fact: Pick<EditorialFactV3, "normalizedStatement" | "category" | "validationStatus">): boolean {
  if (fact.validationStatus && fact.validationStatus !== "accepted") return false;
  if (fact.category === "pharmacy-relationship") return false;
  const label = distinctiveLocalReferenceLabel(fact);
  if (label.length < 4) return false;
  if (fact.category === "area-identity") {
    return (
      /\b(board|park|library|centre|center|carnival|hall|church|school|reserve|meadow|memorial)\b/i.test(label) &&
      !/^[^.]+ is a (neighbourhood ward|ward|village|suburb|town)\b/i.test(label)
    );
  }
  return true;
}

/** Named healthcare, landmark, park, community or civic references from accepted facts. */
export function distinctVerifiedLocalReferenceLabelsFromFacts(
  facts: Array<Pick<EditorialFactV3, "normalizedStatement" | "category" | "validationStatus">>,
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    if (!isDistinctNamedLocalReference(fact)) continue;
    const label = distinctiveLocalReferenceLabel(fact);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function evaluateImprovedLocalPageCandidateQualityV1(
  copy: AiLocalCopyV1 & { editorialFactIdsUsed?: string[] },
  input: BusinessLocalityCopyInputV1,
  facts: EditorialFactV3[],
): { ok: boolean; failures: string[]; localReferences: string[] } {
  const failures: string[] = [];
  failures.push(...findRepeatedLocalSentences(copy));
  const claimIds = copy.evidenceClaims.map((row) => String(row.editorialFactId || "").trim()).filter(Boolean);
  const seenClaim = new Set<string>();
  for (const id of claimIds) {
    if (seenClaim.has(id)) {
      failures.push(`evidence fact used more than once: ${id}`);
      break;
    }
    seenClaim.add(id);
  }
  const usedIds = (copy.editorialFactIdsUsed || []).filter(Boolean);
  const seenUsed = new Set<string>();
  for (const id of usedIds) {
    if (seenUsed.has(id)) {
      failures.push(`evidence fact used more than once: ${id}`);
      break;
    }
    seenUsed.add(id);
  }
  if (EVIDENCE_JARGON_V3.test(flattenAiLocalCopyText(copy))) {
    failures.push("customer-facing evidence identifier");
  }
  const areaRe = new RegExp(`\\b${input.locality.areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const localHay = [copy.localIntroduction, ...copy.localContextParagraphs].join(" ");
  if (!areaRe.test(localHay)) {
    failures.push("selected-area coverage is too thin");
  }
  const localReferences = distinctVerifiedLocalReferencesFromCopy(copy, facts);
  if (localReferences.length < MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2) {
    failures.push(
      `fewer than ${MIN_DISTINCT_VERIFIED_LOCAL_REFERENCES_V2} distinct verified local references (${localReferences.join("; ") || "none"})`,
    );
  }
  if (!localHay.trim()) {
    failures.push("evidence-backed local narrative is missing");
  }
  return { ok: failures.length === 0, failures: [...new Set(failures)], localReferences };
}
