/**
 * Claim grounding for AI local copy.
 * Every local factual sentence must map to a canonical pharmacy field or accepted evidence entity.
 */
import type { AiLocalCopyV1 } from "./pharmacyAiLocalCopySchemaV1.ts";
import { flattenAiLocalCopyText } from "./pharmacyAiLocalCopySchemaV1.ts";
import type { BusinessLocalityCopyInputV1 } from "./pharmacyAiLocalNarrativePromptContractV1.ts";
import type { EditorialFactV3 } from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import { RAW_PROVIDER_LABEL, isCustomerAppropriateOrganisationName } from "./pharmacyLocalEditorialEvidenceContractV3.ts";

export type AiLocalClaimMapRowV1 = {
  generatedField: string;
  exactSentence: string;
  supportingCanonicalFieldOrEntity: string;
  providerSource: string;
  validationResult: "pass" | "fail";
  detail?: string;
};

const JOURNEY_CLAIM =
  /\b(\d+\s*(?:minute|minutes|hour|hours)|drive time|driving time|walking time|walk time|\bparking\b|opens? at\s+\d|opening hours|wait(?:ing)? times?)\b/i;
const AFFILIATION =
  /\b(partner(?:ship)? with|affiliated|referral (?:route|partner)|works with the pharmacy|endorsed by)\b/i;
const READER_USES_GP =
  /\b(your usual gp|your gp (?:at|practice|surgery)|your surgery on|your (?:medical )?practice on|you (?:normally|usually) (?:use|attend|visit|see)|patients who (?:normally |usually )?(?:use|attend)|registered at .{0,40}(?:surgery|practice|medical centre)|if .+ is your usual gp)\b/i;
const GP_WAITING =
  /\b(gp wait(?:ing)?|long wait(?:s|ing)? (?:for|at) (?:the )?gp|hard to (?:get|book) a(?:n)? (?:gp |routine )?appointment|gp (?:is )?busy|waiting lists? (?:at|for) (?:the )?(?:gp|surgery))\b/i;

export function splitSentences(text: string): string[] {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
}

function localCopyFields(copy: AiLocalCopyV1): Array<{ field: string; text: string }> {
  return [
    { field: "heroHeading", text: copy.heroHeading },
    { field: "heroIntroduction", text: copy.heroIntroduction },
    { field: "localIntroduction", text: copy.localIntroduction },
    { field: "localContextHeading", text: copy.localContextHeading },
    ...copy.localContextParagraphs.map((text, i) => ({ field: `localContextParagraphs[${i}]`, text })),
    { field: "relationshipToPharmacy", text: copy.relationshipToPharmacy },
    { field: "localAccessIntroduction", text: copy.localAccessIntroduction },
    ...copy.localFaqs.flatMap((faq, i) => [
      { field: `localFaqs[${i}].question`, text: faq.question },
      { field: `localFaqs[${i}].answer`, text: faq.answer },
    ]),
    { field: "localCtaBridge", text: copy.localCtaBridge },
  ].filter((row) => String(row.text || "").trim());
}

export function evidenceEntityId(name: string, category: string): string {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${category}:${slug}`;
}

export function acceptedEntityId(entity: BusinessLocalityCopyInputV1["locality"]["acceptedEntities"][number]): string {
  return entity.entityId || evidenceEntityId(entity.name, entity.category);
}

function looksFactual(sentence: string): boolean {
  return (
    /\b(\d+(?:\.\d+)?\s*km|north|south|east|west|road|street|address|pharmacy is|based in|based on|call \d|01226|[A-Z][a-z]+ (?:Surgery|Practice|Centre|Center|Station|Interchange|Library|Park|Academy|School))\b/i.test(
      sentence,
    ) || /[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){1,6}/.test(sentence)
  );
}

export function groundAiLocalCopyClaimsV1(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[]; claims: AiLocalClaimMapRowV1[] } {
  const failures: string[] = [];
  const claims: AiLocalClaimMapRowV1[] = [];
  const accepted = input.locality.acceptedEntities;
  const acceptedIds = new Set(accepted.map(acceptedEntityId));
  const acceptedNames = accepted.map((e) => e.name);
  const pharmacy = input.business;
  const hay = flattenAiLocalCopyText(copy);

  if (copy.area !== input.locality.areaName) {
    failures.push(`area field "${copy.area}" does not match selected area "${input.locality.areaName}"`);
  }
  for (const id of copy.evidenceEntityIdsUsed) {
    if (!acceptedIds.has(id)) failures.push(`evidenceEntityIdsUsed contains unknown id ${id}`);
  }
  if (JOURNEY_CLAIM.test(hay)) failures.push("unsupported journey, parking or opening-hours claim");
  if (AFFILIATION.test(hay)) failures.push("implied partnership, referral or endorsement");
  if (READER_USES_GP.test(hay)) failures.push("implies the reader uses a named medical practice");
  if (GP_WAITING.test(hay)) failures.push("assumes GP waiting times");

  const seen = new Set<string>();
  for (const { field, text } of localCopyFields(copy)) {
    const parts = splitSentences(text);
    if (!parts.length && text.trim()) parts.push(text.trim());
    for (const uniqueSentence of parts) {
      const key = `${field}::${uniqueSentence}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!looksFactual(uniqueSentence) && uniqueSentence.split(/\s+/).length < 12) continue;

      const named = accepted.filter((entity) => {
        if (entity.name.trim().toLowerCase() === input.locality.areaName.trim().toLowerCase()) return false;
        return uniqueSentence.toLowerCase().includes(entity.name.toLowerCase());
      });
      let support = "";
      let source = "";
      if (named.length) {
        support = named.map((e) => acceptedEntityId(e)).join(", ");
        source = named.map((e) => e.provider).join(", ");
      } else if (pharmacy.address && uniqueSentence.toLowerCase().includes(pharmacy.address.toLowerCase())) {
        support = "business.address";
        source = "canonical-pharmacy-profile";
      } else if (pharmacy.telephone && uniqueSentence.includes(pharmacy.telephone)) {
        support = "business.telephone";
        source = "canonical-pharmacy-profile";
      } else if (pharmacy.name && uniqueSentence.toLowerCase().includes(pharmacy.name.toLowerCase())) {
        support = "business.name";
        source = "canonical-pharmacy-profile";
      } else if (
        input.locality.distanceLabel &&
        uniqueSentence.toLowerCase().includes(input.locality.distanceLabel.toLowerCase())
      ) {
        support = "locality.distanceLabel";
        source = "verified-locality-evidence";
      } else if (uniqueSentence.toLowerCase().includes(input.locality.areaName.toLowerCase())) {
        support = "locality.areaName";
        source = "campaign-builder-selected-area";
      } else if (
        /eligible common conditions|pharmacy first|pharmacist|nhs 111|urgent care|red-flag|consultation/i.test(
          uniqueSentence,
        )
      ) {
        support = "offer.lockedClinicalFacts";
        source = "approved-clinical-copy";
      }

      const invented =
        uniqueSentence.match(
          /\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,5}\s(?:Surgery|Practice|Centre|Center|Station|Academy|School|Library|Park))\b/g,
        ) || [];
      let failed = false;
      for (const name of invented) {
        const acceptedHit = acceptedNames.some(
          (n) =>
            n.toLowerCase() === name.toLowerCase() ||
            name.toLowerCase().includes(n.toLowerCase()) ||
            n.toLowerCase().includes(name.toLowerCase()),
        );
        if (acceptedHit) continue;
        if (pharmacy.name.toLowerCase().includes(name.toLowerCase())) continue;
        if (/^health clinic$/i.test(name)) continue;
        failures.push(`ungrounded named entity: ${name}`);
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: "",
          providerSource: "",
          validationResult: "fail",
          detail: `ungrounded named entity: ${name}`,
        });
        failed = true;
      }
      if (failed) continue;

      const kmMatch = uniqueSentence.match(/(\d+(?:\.\d+)?)\s*km\b/i);
      if (kmMatch && input.locality.distanceKm != null && Number.isFinite(input.locality.distanceKm)) {
        const claimed = Number(kmMatch[1]);
        if (Math.abs(claimed - input.locality.distanceKm) > 0.2) {
          failures.push(
            `unsupported distance claim: ${claimed} km (verified ${input.locality.distanceKm.toFixed(1)} km)`,
          );
          claims.push({
            generatedField: field,
            exactSentence: uniqueSentence,
            supportingCanonicalFieldOrEntity: "",
            providerSource: "",
            validationResult: "fail",
            detail: "distance does not match verified locality evidence",
          });
          continue;
        }
      }

      const needsGround =
        /\b\d+(?:\.\d+)?\s*km\b|\bS\d{1,2}\s*\d[A-Z]{2}\b|01226|north|south|east|west of the pharmacy/i.test(
          uniqueSentence,
        );
      if (!support && needsGround) {
        failures.push(`ungrounded factual sentence: ${uniqueSentence.slice(0, 120)}`);
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: "",
          providerSource: "",
          validationResult: "fail",
          detail: "no matching canonical field or evidence entity",
        });
        continue;
      }

      claims.push({
        generatedField: field,
        exactSentence: uniqueSentence,
        supportingCanonicalFieldOrEntity: support || "non-factual-prose",
        providerSource: source || "none-required",
        validationResult: "pass",
      });
    }
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)], claims };
}

export const UNSUPPORTED_EVALUATIVE_CLAIM_V2 =
  /\b(convenient(?:ly)?|convenience|efficient(?:ly)?|within easy reach|easy reach|easily reached|easy to reach|prompt support|prompt care|avoid(?:ing)? (?:unnecessary )?delays?|without delay|quick access|nearby enough|just around the corner|popular (?:choice|option)|ideal for|perfect for|support your health locally)\b/i;

const DELAY_CLAIM_V2 =
  /\b(avoid(?:ing)? (?:unnecessary )?delays?|without (?:the )?wait(?:ing)?|faster than (?:a |the )?gp|skip the (?:gp )?queue|gp wait(?:ing)?|waiting for (?:a )?(?:routine )?gp)\b/i;

const NON_CLAIM_CTA_V2 =
  /^(please )?(get in touch|contact us|call the pharmacy|book an appointment|speak to the (?:team|pharmacy))([.,].*)?$/i;

function entityMentionedInText(
  sentence: string,
  entity: BusinessLocalityCopyInputV1["locality"]["acceptedEntities"][number],
  areaName: string,
): boolean {
  const hay = sentence.toLowerCase();
  const name = entity.name.toLowerCase();
  if (name === areaName.trim().toLowerCase()) return false;
  if (hay.includes(name)) return true;
  const site = name.match(
    /([a-z0-9][a-z0-9'’.\-]*(?:\s[a-z0-9'’.\-]*){0,6}\s(?:medical centre|health centre|surgery|practice|library|country park|park|mill|station|interchange))/,
  );
  if (site?.[1] && site[1] !== areaName.trim().toLowerCase() && hay.includes(site[1])) return true;
  return false;
}

function streetFromAddress(address: string): string {
  const first = String(address || "").split(",")[0] || "";
  return first.replace(/^\d+\s+/, "").trim();
}

function normalizePlaceText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bcentre\b/g, "center")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasVerifiableOrEvaluativeClaimV2(sentence: string): boolean {
  return (
    UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(sentence) ||
    DELAY_CLAIM_V2.test(sentence) ||
    /\b(\d+(?:\.\d+)?\s*km|01226|S\d{1,2}\s*\d[A-Z]{2}|north|south|east|west of)\b/i.test(sentence) ||
    /\b(located in|based in|serves patients|available (?:from|at|directly)|within easy|partnership|affiliated|registered at)\b/i.test(
      sentence,
    )
  );
}

function isNonClaimStructureV2(field: string, sentence: string): boolean {
  if (field === "heroHeading" || field === "localContextHeading" || field === "heroIntroduction") {
    return !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(sentence) && !DELAY_CLAIM_V2.test(sentence);
  }
  if (/\.question$/.test(field) || /\?$/.test(sentence.trim())) {
    return !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(sentence) && !DELAY_CLAIM_V2.test(sentence);
  }
  if (
    (field === "localCtaBridge" || field === "heroIntroduction" || field === "localAccessIntroduction") &&
    (NON_CLAIM_CTA_V2.test(sentence.trim()) ||
      /get in touch|please (?:call|contact|book)|speak to the (?:team|pharmacist|pharmacy)|discuss your (?:symptoms|needs)|contact the pharmacy/i.test(
        sentence,
      ))
  ) {
    return !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(sentence) && !DELAY_CLAIM_V2.test(sentence);
  }
  return false;
}

export function groundAiLocalCopyClaimsV2(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
): { ok: boolean; failures: string[]; claims: AiLocalClaimMapRowV1[] } {
  const failures: string[] = [];
  const claims: AiLocalClaimMapRowV1[] = [];
  const accepted = input.locality.acceptedEntities;
  const acceptedIds = new Set(accepted.map(acceptedEntityId));
  const acceptedNames = accepted.map((e) => e.name);
  const pharmacy = input.business;
  const hay = flattenAiLocalCopyText(copy);
  const street = streetFromAddress(pharmacy.address);

  if (copy.area !== input.locality.areaName) {
    failures.push(`area field "${copy.area}" does not match selected area "${input.locality.areaName}"`);
  }
  for (const id of copy.evidenceEntityIdsUsed) {
    if (!acceptedIds.has(id)) failures.push(`evidenceEntityIdsUsed contains unknown id ${id}`);
  }
  if (JOURNEY_CLAIM.test(hay)) failures.push("unsupported journey, parking or opening-hours claim");
  if (AFFILIATION.test(hay)) failures.push("implied partnership, referral or endorsement");
  const gpUsageSentences = splitSentences(hay).filter(
    (sentence) =>
      READER_USES_GP.test(sentence) &&
      !/\bnot (?:your|assumed)\b/i.test(sentence) &&
      !/\bonly for people registered\b/i.test(sentence) &&
      !/\?$/.test(sentence.trim()),
  );
  if (gpUsageSentences.length) failures.push("implies the reader uses a named medical practice");
  if (GP_WAITING.test(hay) || DELAY_CLAIM_V2.test(hay)) {
    failures.push("assumes GP waiting times or unsupported delay reduction");
  }
  if (UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(hay)) {
    failures.push("unsupported convenience, accessibility, speed or marketing claim");
  }

  const seen = new Set<string>();
  for (const { field, text } of localCopyFields(copy)) {
    const parts = splitSentences(text);
    if (!parts.length && text.trim()) parts.push(text.trim());
    for (const uniqueSentence of parts) {
      const key = `${field}::${uniqueSentence}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(uniqueSentence) || DELAY_CLAIM_V2.test(uniqueSentence)) {
        failures.push(`unsupported evaluative claim: ${uniqueSentence.slice(0, 120)}`);
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: "",
          providerSource: "",
          validationResult: "fail",
          detail: "non-factual-prose cannot bypass grounding for evaluative claims",
        });
        continue;
      }

      const named = accepted.filter((entity) => entityMentionedInText(uniqueSentence, entity, input.locality.areaName));
      const fieldNamed = accepted.filter((entity) => entityMentionedInText(text, entity, input.locality.areaName));
      let support = "";
      let source = "";
      if (named.length) {
        support = named.map((e) => acceptedEntityId(e)).join(", ");
        source = named.map((e) => e.provider).join(", ");
      } else if (
        fieldNamed.length &&
        /\b(these (?:centres|practices|sites)|these are part|the (?:local |established )?healthcare landscape)\b/i.test(uniqueSentence) &&
        !/\brange of nhs services\b/i.test(uniqueSentence)
      ) {
        support = fieldNamed.map((e) => acceptedEntityId(e)).join(", ");
        source = fieldNamed.map((e) => e.provider).join(", ");
      } else if (street && street.length > 6 && normalizePlaceText(uniqueSentence).includes(normalizePlaceText(street))) {
        support = "business.address";
        source = "canonical-pharmacy-profile";
      } else if (pharmacy.address && normalizePlaceText(uniqueSentence).includes(normalizePlaceText(pharmacy.address))) {
        support = "business.address";
        source = "canonical-pharmacy-profile";
      } else if (pharmacy.telephone && uniqueSentence.includes(pharmacy.telephone)) {
        support = "business.telephone";
        source = "canonical-pharmacy-profile";
      } else if (
        input.locality.distanceLabel &&
        uniqueSentence.toLowerCase().includes(input.locality.distanceLabel.toLowerCase())
      ) {
        support = "locality.distanceLabel";
        source = "verified-locality-evidence";
      } else if (/\b\d+(?:\.\d+)?\s*km\b/i.test(uniqueSentence) && input.locality.distanceKm != null) {
        support = "locality.distanceKm";
        source = "verified-locality-evidence";
      } else if (pharmacy.name && uniqueSentence.toLowerCase().includes(pharmacy.name.toLowerCase())) {
        support = "business.name";
        source = "canonical-pharmacy-profile";
      } else if (
        /eligible common conditions|common conditions where you live|pharmacy first can (?:help|support)|pharmacist will (?:assess|advise|review|confirm)|pharmacist (?:still )?confirms what can be assessed|pharmacist may (?:also )?advise referral|pharmacist assess your needs|nhs 111|urgent (?:medical )?care|red-flag|consultation is being arranged|call ahead|call before visiting|self-care advice|list of (?:any |your current )?medicines|current medications|medicines you (?:are |were )?taking|bring details of|medical (?:history|information)|safety-netting|refer you|not suitable for pharmacy first|breathing difficulties|chest pain|non-blanching rash|eligibility (?:depends|for pharmacy first)|nhs pathway criteria|nhs criteria|not your gp practice|contact the pharmacy|other healthcare options|access the service|discuss your symptoms/i.test(
          uniqueSentence,
        )
      ) {
        support = "offer.lockedClinicalFacts";
        source = "approved-clinical-copy";
      } else if (uniqueSentence.toLowerCase().includes(input.locality.areaName.toLowerCase())) {
        if (
          /\b(located in|located within|based (?:directly )?in|is in|people in|this page|premises|from|for|within|your own area)\b/i.test(uniqueSentence) ||
          field === "heroHeading" ||
          field === "localContextHeading" ||
          field === "heroIntroduction" ||
          field === "localIntroduction" ||
          field === "relationshipToPharmacy"
        ) {
          support = "locality.areaName";
          source = "campaign-builder-selected-area";
        }
      }

      const invented =
        uniqueSentence.match(
          /\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,5}\s(?:Surgery|Practice|Centre|Center|Station|Academy|School|Library|Park|Mill))\b/g,
        ) || [];
      let failed = false;
      for (const name of invented) {
        const acceptedHit = acceptedNames.some(
          (n) =>
            n.toLowerCase() === name.toLowerCase() ||
            name.toLowerCase().includes(n.toLowerCase()) ||
            n.toLowerCase().includes(name.toLowerCase()),
        );
        if (acceptedHit) continue;
        if (pharmacy.name.toLowerCase().includes(name.toLowerCase())) continue;
        if (/^health clinic$/i.test(name)) continue;
        failures.push(`ungrounded named entity: ${name}`);
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: "",
          providerSource: "",
          validationResult: "fail",
          detail: `ungrounded named entity: ${name}`,
        });
        failed = true;
      }
      if (failed) continue;

      const kmMatch = uniqueSentence.match(/(\d+(?:\.\d+)?)\s*km\b/i);
      if (kmMatch && input.locality.distanceKm != null && Number.isFinite(input.locality.distanceKm)) {
        const claimed = Number(kmMatch[1]);
        if (Math.abs(claimed - input.locality.distanceKm) > 0.2) {
          failures.push(
            `unsupported distance claim: ${claimed} km (verified ${input.locality.distanceKm.toFixed(1)} km)`,
          );
          claims.push({
            generatedField: field,
            exactSentence: uniqueSentence,
            supportingCanonicalFieldOrEntity: "",
            providerSource: "",
            validationResult: "fail",
            detail: "distance does not match verified locality evidence",
          });
          continue;
        }
      }

      if (!support) {
        if (isNonClaimStructureV2(field, uniqueSentence) && !hasVerifiableOrEvaluativeClaimV2(uniqueSentence)) {
          const kind = field === "localCtaBridge" ? "non-claim-cta" : "non-claim-structure";
          claims.push({
            generatedField: field,
            exactSentence: uniqueSentence,
            supportingCanonicalFieldOrEntity: kind,
            providerSource: "none-required",
            validationResult: "pass",
          });
          continue;
        }
        failures.push(`ungrounded factual or evaluative sentence: ${uniqueSentence.slice(0, 140)}`);
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: "",
          providerSource: "",
          validationResult: "fail",
          detail: "non-factual-prose cannot bypass grounding",
        });
        continue;
      }

      claims.push({
        generatedField: field,
        exactSentence: uniqueSentence,
        supportingCanonicalFieldOrEntity: support,
        providerSource: source,
        validationResult: "pass",
      });
    }
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)], claims };
}

const ROUTE_IMPLICATION_V3 =
  /\b(orient you towards|route to the pharmacy|helps? you (?:reach|find your way) to|reach (?:the pharmacy|pharmacy first) by travelling|by travelling to|walking connection|along .{0,40} (?:road|lane|way) to the pharmacy)\b/i;
const TRAVEL_OR_CENTRE_DISTANCE_V3 =
  /\b(travel(?:ling)? distance|driving distance|walking distance|by road|\d+(?:\.\d+)?\s*km (?:drive|walk|journey)|from the (?:town )?centre)\b/i;
const NEAREST_OR_CLOSEST_V3 = /\b(nearest|closest)\b/i;

function premisesLocalitySupportsSentence(address: string, sentence: string): boolean {
  const loc =
    String(address || "")
      .replace(/,\s*(United Kingdom|UK)\s*$/i, "")
      .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g, "")
      .replace(/[,\s]+$/g, "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)[1] || "";
  if (!loc) return false;
  return (
    /\b(pharmacy|premises)\b/i.test(sentence) &&
    new RegExp(`\\b${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence)
  );
}

function tokensForOverlap(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !["from", "with", "that", "this", "have", "has", "were", "been", "they", "their", "area", "also"].includes(token));
}

export function editorialFactSupportsSentence(fact: EditorialFactV3, sentence: string): boolean {
  const statement = fact.normalizedStatement.toLowerCase();
  const hay = sentence.toLowerCase();
  if (statement && hay.includes(statement.slice(0, Math.min(40, statement.length)))) return true;
  const factTokens = tokensForOverlap(fact.normalizedStatement);
  const sentenceTokens = new Set(tokensForOverlap(sentence));
  if (factTokens.length < 3) return hay.includes(fact.normalizedStatement.toLowerCase());
  const hits = factTokens.filter((token) => sentenceTokens.has(token)).length;
  return hits / factTokens.length >= 0.45;
}

function isGenuineNonClaimCtaV3(field: string, sentence: string): boolean {
  if (field === "heroHeading" || field === "localContextHeading") {
    return !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(sentence) && !ROUTE_IMPLICATION_V3.test(sentence);
  }
  if (/\.question$/.test(field) || /\?$/.test(sentence.trim())) {
    return !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(sentence) && !ROUTE_IMPLICATION_V3.test(sentence);
  }
  if (field === "localCtaBridge" || field === "localAccessIntroduction" || field === "relationshipToPharmacy") {
    return (
      /get in touch|please (?:call|contact|book)|speak to the (?:team|pharmacist|pharmacy)|book an appointment|call the pharmacy|pharmacist confirms|not suitable|discuss your symptoms|use the options below|contact the pharmacy|arrange (?:your |a )?pharmacy first/i.test(
        sentence,
      ) && !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(sentence)
    );
  }
  return false;
}

export function groundAiLocalCopyClaimsV3(
  copy: AiLocalCopyV1,
  input: BusinessLocalityCopyInputV1,
  editorialFacts: EditorialFactV3[] = [],
): { ok: boolean; failures: string[]; claims: AiLocalClaimMapRowV1[] } {
  const failures: string[] = [];
  const claims: AiLocalClaimMapRowV1[] = [];
  const acceptedFacts = editorialFacts.filter((f) => f.validationStatus === "accepted");
  const accepted = input.locality.acceptedEntities.filter((e) => isCustomerAppropriateOrganisationName(e.name));
  const hay = flattenAiLocalCopyText(copy);
  const pharmacy = input.business;
  const street = streetFromAddress(pharmacy.address);

  if (copy.area !== input.locality.areaName) {
    failures.push(`area field "${copy.area}" does not match selected area "${input.locality.areaName}"`);
  }
  if (JOURNEY_CLAIM.test(hay)) failures.push("unsupported journey, parking or opening-hours claim");
  if (AFFILIATION.test(hay)) failures.push("implied partnership, referral or endorsement");
  if (ROUTE_IMPLICATION_V3.test(hay)) failures.push("unsupported route implication");
  if (TRAVEL_OR_CENTRE_DISTANCE_V3.test(hay)) failures.push("unsupported travel-distance or town-centre claim");
  if (NEAREST_OR_CLOSEST_V3.test(hay)) failures.push("unsupported nearest or closest claim");
  if (RAW_PROVIDER_LABEL.test(hay) || /\bDr C Liley\b/i.test(hay)) {
    failures.push("raw provider label in customer copy");
  }
  if (UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(hay)) {
    failures.push("unsupported convenience, accessibility, speed or marketing claim");
  }

  const seen = new Set<string>();
  for (const { field, text } of localCopyFields(copy)) {
    const parts = splitSentences(text);
    if (!parts.length && text.trim()) parts.push(text.trim());
    for (const uniqueSentence of parts) {
      const key = `${field}::${uniqueSentence}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (ROUTE_IMPLICATION_V3.test(uniqueSentence) || TRAVEL_OR_CENTRE_DISTANCE_V3.test(uniqueSentence) || UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(uniqueSentence) || NEAREST_OR_CLOSEST_V3.test(uniqueSentence)) {
        failures.push(`unsupported claim: ${uniqueSentence.slice(0, 120)}`);
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: "",
          providerSource: "",
          validationResult: "fail",
          detail: "unsupported inference or evaluative language",
        });
        continue;
      }

      const matchedFacts = acceptedFacts.filter((fact) => editorialFactSupportsSentence(fact, uniqueSentence));
      const named = accepted.filter((entity) => entityMentionedInText(uniqueSentence, entity, input.locality.areaName));
      let support = "";
      let source = "";
      if (matchedFacts.length) {
        support = matchedFacts.map((f) => f.factId).join(", ");
        source = matchedFacts.map((f) => f.publisher).join(", ");
      } else if (named.length) {
        support = named.map((e) => acceptedEntityId(e)).join(", ");
        source = named.map((e) => e.provider).join(", ");
      } else if (street && street.length > 6 && normalizePlaceText(uniqueSentence).includes(normalizePlaceText(street))) {
        support = "business.address";
        source = "canonical-pharmacy-profile";
      } else if (pharmacy.address && normalizePlaceText(uniqueSentence).includes(normalizePlaceText(pharmacy.address))) {
        support = "business.address";
        source = "canonical-pharmacy-profile";
      } else if (pharmacy.telephone && uniqueSentence.includes(pharmacy.telephone)) {
        support = "business.telephone";
        source = "canonical-pharmacy-profile";
      } else if (premisesLocalitySupportsSentence(pharmacy.address, uniqueSentence)) {
        support = "business.address";
        source = "canonical-pharmacy-profile";
      } else if (
        input.locality.distanceLabel &&
        uniqueSentence.toLowerCase().includes(input.locality.distanceLabel.toLowerCase())
      ) {
        support = "locality.distanceLabel";
        source = "verified-locality-evidence";
      } else if (/\b\d+(?:\.\d+)?\s*km\b/i.test(uniqueSentence) && input.locality.distanceKm != null) {
        support = "locality.distanceKm";
        source = "verified-locality-evidence";
      } else if (pharmacy.name && uniqueSentence.toLowerCase().includes(pharmacy.name.toLowerCase())) {
        support = "business.name";
        source = "canonical-pharmacy-profile";
      } else if (
        /eligible common conditions|pharmacy first can (?:help|support)|pharmacist will (?:assess|advise|review|confirm)|pharmacist (?:still )?confirms what can be assessed|pharmacist may (?:also )?advise referral|nhs 111|urgent (?:medical )?care|red-flag|consultation is being arranged|call ahead|call before visiting|call the pharmacy before visiting|calling the pharmacy is recommended|self-care advice|list of (?:any |your current )?medicines|current medications|bring details of|safety-netting|not suitable for pharmacy first|breathing difficulties|chest pain|non-blanching rash|eligibility (?:depends|for pharmacy first)|nhs pathway criteria|discuss your symptoms|if pharmacy first is not suitable/i.test(
          uniqueSentence,
        )
      ) {
        support = "offer.lockedClinicalFacts";
        source = "approved-clinical-copy";
      } else if (
        uniqueSentence.toLowerCase().includes(input.locality.areaName.toLowerCase()) &&
        (field === "heroHeading" || field === "localContextHeading" || field === "heroIntroduction")
      ) {
        support = "locality.areaName";
        source = "campaign-builder-selected-area";
      } else if (
        input.locality.pharmacyIsInArea &&
        /pharmacy is in /i.test(uniqueSentence) &&
        uniqueSentence.toLowerCase().includes(input.locality.areaName.toLowerCase())
      ) {
        support = "locality.pharmacyIsInArea";
        source = "verified-locality-evidence";
      } else if (
        !input.locality.pharmacyIsInArea &&
        /pharmacy is not in /i.test(uniqueSentence) &&
        uniqueSentence.toLowerCase().includes(input.locality.areaName.toLowerCase())
      ) {
        support = "locality.pharmacyIsInArea";
        source = "verified-locality-evidence";
      }

      if (!support) {
        const isQuestion = /\.question$/.test(field) || /\?$/.test(uniqueSentence.trim());
        if (isQuestion && !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(uniqueSentence) && !ROUTE_IMPLICATION_V3.test(uniqueSentence) && !NEAREST_OR_CLOSEST_V3.test(uniqueSentence)) {
          claims.push({
            generatedField: field,
            exactSentence: uniqueSentence,
            supportingCanonicalFieldOrEntity: "non-claim-structure",
            providerSource: "none-required",
            validationResult: "pass",
          });
          continue;
        }
        if (isGenuineNonClaimCtaV3(field, uniqueSentence) && !hasVerifiableOrEvaluativeClaimV2(uniqueSentence)) {
          claims.push({
            generatedField: field,
            exactSentence: uniqueSentence,
            supportingCanonicalFieldOrEntity: field === "localCtaBridge" ? "non-claim-cta" : "non-claim-structure",
            providerSource: "none-required",
            validationResult: "pass",
          });
          continue;
        }
        failures.push(`ungrounded factual sentence: ${uniqueSentence.slice(0, 140)}`);
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: "",
          providerSource: "",
          validationResult: "fail",
          detail: "no canonical, Places, editorial or clinical support",
        });
        continue;
      }

      claims.push({
        generatedField: field,
        exactSentence: uniqueSentence,
        supportingCanonicalFieldOrEntity: support,
        providerSource: source,
        validationResult: "pass",
      });
    }
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)], claims };
}
