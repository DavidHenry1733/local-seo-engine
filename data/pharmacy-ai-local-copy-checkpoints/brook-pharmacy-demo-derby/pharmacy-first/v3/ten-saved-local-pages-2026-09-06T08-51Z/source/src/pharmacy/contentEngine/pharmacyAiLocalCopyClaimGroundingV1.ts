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
  validationResult: "pass" | "fail" | "review";
  detail?: string;
};

export type WritingContractSeverityV3 = "fail" | "review";

export function formatWritingContractFindingV3(opts: {
  severity?: WritingContractSeverityV3;
  field: string;
  sentence: string;
  rule: string;
  defect: string;
}): string {
  const label = opts.severity === "review" ? "REVIEW REQUIRED" : "FAIL";
  const sentence = String(opts.sentence || "").replace(/\s+/g, " ").trim();
  return `${label} | field=${opts.field} | sentence=${sentence} | rule=${opts.rule} | defect=${opts.defect}`;
}

const JOURNEY_CLAIM =
  /\b(\d+\s*(?:minute|minutes|hour|hours)|drive time|driving time|walking time|walk time|\bparking\b|opens? at\s+\d|opening hours|wait(?:ing)? times?)\b/i;
const AFFILIATION =
  /\b(partner(?:ship)? with|affiliated|referral (?:route|partner)|refers patients|referred to the pharmacy|works with the pharmacy|endorsed by)\b/i;
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

const APPROXIMATE_DISTANCE_WORDING_V3 =
  /\b(approximate(?:ly)?|approx\.?|around|about|roughly)\b/i;
const STRAIGHT_LINE_DISTANCE_WORDING_V3 = /\bstraight[\s-]lines?\b/i;

function claimedKilometresMatchSuppliedV3(clause: string, distanceKm: number): boolean {
  const claimed = String(clause).match(/\d+(?:\.\d+)?\s*km/gi) || [];
  return claimed.some((raw) => {
    const n = Number(String(raw).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && Math.abs(n - distanceKm) <= 0.2;
  });
}

function clauseNamesPharmacyEndpointV3(clause: string, input: BusinessLocalityCopyInputV1): boolean {
  const pharmacyName = String(input.business.name || "").trim();
  if (pharmacyName && clause.toLowerCase().includes(pharmacyName.toLowerCase())) return true;
  return /\b(the pharmacy|pharmacy & health clinic|premises|consultations? take place)\b/i.test(clause);
}

/** Equivalent approximate straight-line wording: matching km, selected-area origin, pharmacy endpoint, and method. Not an exact-phrase check. */
export function clauseStatesSuppliedApproximateStraightLineDistanceV3(
  clause: string,
  input: BusinessLocalityCopyInputV1,
): boolean {
  const km = input.locality.distanceKm;
  if (km == null || !Number.isFinite(km)) return false;
  if (TRAVEL_OR_CENTRE_DISTANCE_V3.test(clause)) return false;
  if (!APPROXIMATE_DISTANCE_WORDING_V3.test(clause) || !STRAIGHT_LINE_DISTANCE_WORDING_V3.test(clause)) return false;
  if (!claimedKilometresMatchSuppliedV3(clause, km)) return false;
  const area = String(input.locality.areaName || "").trim();
  if (!area || !new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(clause)) return false;
  return clauseNamesPharmacyEndpointV3(clause, input);
}

export function editorialFactSupportsSentence(fact: EditorialFactV3, sentence: string): boolean {
  const covered = clauseCoveredByFactV3(sentence, fact);
  return covered.covered && !covered.extraAssertion;
}

export type ClauseGroundingBranchV3 =
  | "numbersUnsupportedV3"
  | "datesUnsupportedV3"
  | "localityContradictionV3"
  | "UNSUPPORTED_CHARACTER_V3"
  | "CLINICAL_BROADENING_V3"
  | "EMPTY_LOCAL_CLAIM_V3"
  | "clauseCoveredByFactV3"
  | "canonical-or-clinical-support"
  | "uncertain-paraphrase"
  | "no-covering-support"
  | "non-claim-structure";

const GROUNDING_STOP_V3 = new Set([
  "from", "with", "that", "this", "have", "has", "were", "been", "they", "their", "area", "also",
  "the", "and", "for", "are", "was", "its", "into", "within", "part", "than", "then", "such",
]);
const CLINICAL_ALLOW_V3 = new Set([
  "pharmacy", "first", "offers", "offering", "way", "people", "help", "helping", "eligible", "common",
  "conditions", "nhs", "pharmacist", "consultation", "consultations", "advice", "treatment", "need",
  "get", "may", "can", "available", "through", "reader", "arrange", "arranged", "book", "call",
  "appointment", "discuss", "symptoms", "confirm", "confirms", "will", "review", "your", "happens",
  "during", "when", "should", "instead", "suitable", "advise", "seek", "urgent", "medical", "care",
  "chest", "pain", "book",
]);
const ACCESS_ALLOW_V3 = new Set([
  "consultations", "take", "place", "premises", "provided", "from", "sits", "within", "ward",
  "home", "public", "library", "metropolitan", "borough", "south", "yorkshire", "general",
  "practice", "services", "national", "rail", "station", "medical", "centre", "center", "named",
]);
const UNSUPPORTED_CHARACTER_V3 =
  /\b(distinct(?:ive)?(?: south yorkshire)? character|strong sense of place|strong community links|familiar spot|valued resource|known for|recognised for|recognized for|strong local identity|own identity|identity within)\b/i;
const CLINICAL_BROADENING_V3 =
  /\b(without waiting|without(?:\s+\w+){0,2}\s+delays?|without needing (?:a |an )?(?:gp|doctor)|do not need to see a (?:gp|doctor)|waiting for (?:a )?gp|another(?:\s+\w+){0,2}\s+option|common health concerns|skip (?:the |a )?gp|avoid (?:a |the )?gp wait|minor (?:health )?concerns?|local pharmacist)\b/i;
const EMPTY_LOCAL_CLAIM_V3 =
  /\b(community resources|healthcare landscape|local healthcare options|local amenities|range of (?:local )?services|residents[’'] wellbeing)\b/i;

export function splitIndependentClausesV3(sentence: string): string[] {
  const text = String(sentence || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const out: string[] = [];
  for (const semi of text.split(/;\s+/)) {
    const chunks = semi.split(/,\s+(?=which\b|giving\b|offering\b|supporting\b|providing\b|helping\b)/i);
    for (const chunk of chunks) {
      const andSplit = chunk.split(/\s+and\s+(?=[A-Z]|NHS\b|the area\b)/);
      if (
        andSplit.length === 2 &&
        /\b(is|are|has|have|sits|benefits|offers|provided)\b/i.test(andSplit[0] || "") &&
        /\b(is|are|has|have|sits|benefits|offers|provided)\b/i.test(andSplit[1] || "")
      ) {
        out.push(...andSplit);
      } else {
        out.push(chunk);
      }
    }
  }
  return out.map((part) => part.trim()).filter(Boolean);
}

const LEFTOVER_GLUE_V3 = new Set([
  "there",
  "here",
  "also",
  "such",
  "being",
  "itself",
  "among",
  "using",
  "located",
  "around",
  "about",
  "well",
  "even",
  "still",
  "both",
  "each",
  "every",
  "very",
  "just",
  "only",
  "once",
  "into",
  "onto",
]);

function leftoverContentTokensV3(leftover: string[]): string[] {
  return leftover.filter((token) => !LEFTOVER_GLUE_V3.has(token));
}

function clauseCoveredByFactV3(
  clause: string,
  fact: EditorialFactV3,
): { covered: boolean; extraAssertion: boolean } {
  const clauseNorm = clause.toLowerCase();
  const factNorm = fact.normalizedStatement.toLowerCase();
  const factTokens = contentTokensV3(fact.normalizedStatement);
  const clauseTokens = new Set(contentTokensV3(clause));
  const distinctive = factTokens.filter((token) => !LEFTOVER_GLUE_V3.has(token));
  const overlap = distinctive.filter((token) => clauseTokens.has(token));
  const coveredByOverlap =
    distinctive.length >= 2 && overlap.length >= Math.max(2, Math.ceil(distinctive.length * 0.5));
  const geography =
    /metropolitan borough/.test(factNorm) &&
    /(?:is in|sits within|is part of|is a ward (?:in|within))/.test(clauseNorm) &&
    /metropolitan borough/.test(clauseNorm);
  const library = /public library/.test(factNorm) && /public library/.test(clauseNorm);
  const healthcare =
    /medical centre|health centre/.test(factNorm) &&
    /nhs general practice|gp services in|are provided from|medical centre|health centre/.test(clauseNorm);
  const station = /national rail station/.test(factNorm) && /national rail station/.test(clauseNorm);
  const covered =
    geography ||
    library ||
    healthcare ||
    station ||
    coveredByOverlap ||
    (factNorm.length > 20 && clauseNorm.includes(factNorm.slice(0, Math.min(40, factNorm.length))));
  const extra =
    UNSUPPORTED_CHARACTER_V3.test(clause) ||
    CLINICAL_BROADENING_V3.test(clause) ||
    EMPTY_LOCAL_CLAIM_V3.test(clause);
  return { covered, extraAssertion: extra };
}

function contentTokensV3(value: string): string[] {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !GROUNDING_STOP_V3.has(token));
}

function supportCorpusV3(facts: EditorialFactV3[], input: BusinessLocalityCopyInputV1): string {
  const premises =
    String(input.business.address || "")
      .replace(/,\s*(United Kingdom|UK)\s*$/i, "")
      .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g, "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)[1] || "";
  return [
    ...facts.map((fact) => fact.normalizedStatement),
    input.business.name,
    input.business.address,
    premises,
    input.locality.areaName,
    input.business.marketTown || "",
    input.locality.distanceLabel || "",
    String(input.locality.distanceKm ?? ""),
    "Pharmacy First",
    "eligible common conditions",
    input.offer?.lockedClinicalFacts?.suitability || "",
    input.offer?.lockedClinicalFacts?.process || "",
    input.offer?.lockedClinicalFacts?.safety || "",
  ].join(" ");
}

function leftoverUnsupportedV3(clause: string, corpus: string): string[] {
  const allowed = new Set([...contentTokensV3(corpus), ...CLINICAL_ALLOW_V3, ...ACCESS_ALLOW_V3]);
  return contentTokensV3(clause).filter((token) => !allowed.has(token));
}

function lockedClinicalCoversClauseV3(clause: string, input: BusinessLocalityCopyInputV1): boolean {
  const locked = [
    "Pharmacy First",
    "eligible common conditions",
    input.offer?.lockedClinicalFacts?.suitability || "",
    input.offer?.lockedClinicalFacts?.process || "",
    input.offer?.lockedClinicalFacts?.safety || "",
  ].join(" ");
  const lockedTokens = new Set(contentTokensV3(locked));
  const distinctive = contentTokensV3(clause).filter((token) => !LEFTOVER_GLUE_V3.has(token));
  const hits = distinctive.filter((token) => lockedTokens.has(token));
  return distinctive.length >= 2 && hits.length >= Math.max(2, Math.ceil(distinctive.length * 0.5));
}

function datesUnsupportedV3(clause: string, corpus: string): string[] {
  const years = String(clause).match(/\b(?:19|20)\d{2}\b/g) || [];
  const corpusYears = new Set(String(corpus).match(/\b(?:19|20)\d{2}\b/g) || []);
  return years.filter((year) => !corpusYears.has(year));
}

function localityContradictionV3(clause: string, facts: EditorialFactV3[], areaName: string): string | null {
  const escaped = String(areaName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return null;
  const match = clause.match(
    new RegExp(`\\b${escaped}\\b.{0,80}(?:is in|sits within|is part of|located in)\\s+([^.,;]+)`, "i"),
  );
  if (!match) return null;
  const claimedTokens = contentTokensV3(match[1] || "");
  if (!claimedTokens.length) return null;
  const geoFacts = facts.filter(
    (fact) =>
      new RegExp(`\\b${escaped}\\b`, "i").test(fact.normalizedStatement) &&
      /\b(is in|sits within|metropolitan|borough|south yorkshire)\b/i.test(fact.normalizedStatement),
  );
  if (!geoFacts.length) return null;
  const supported = geoFacts.map((fact) => fact.normalizedStatement.toLowerCase()).join(" ");
  const hits = claimedTokens.filter((token) => supported.includes(token));
  if (hits.length === 0) return match[1].trim();
  return null;
}

function numbersUnsupportedV3(clause: string, corpus: string, distanceKm: number | null | undefined): string[] {
  const claimed = String(clause).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  const corpusNums = new Set(
    (String(corpus).match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, "")),
  );
  const unsupported: string[] = [];
  for (const raw of claimed) {
    const n = raw.replace(/,/g, "");
    if (corpusNums.has(n)) continue;
    if (distanceKm != null && Number.isFinite(distanceKm) && Math.abs(Number(n) - distanceKm) <= 0.2) continue;
    let rounded = false;
    for (const known of corpusNums) {
      const k = Number(known);
      const c = Number(n);
      if (k >= 1000 && c >= 1000 && Math.abs(c - k) / k <= 0.06) rounded = true;
    }
    if (rounded) continue;
    unsupported.push(raw);
  }
  return unsupported;
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
): { ok: boolean; failures: string[]; reviews: string[]; claims: AiLocalClaimMapRowV1[] } {
  const failures: string[] = [];
  const reviews: string[] = [];
  const claims: AiLocalClaimMapRowV1[] = [];
  const acceptedFacts = editorialFacts.filter((f) => f.validationStatus === "accepted");
  const accepted = input.locality.acceptedEntities.filter((e) => isCustomerAppropriateOrganisationName(e.name));
  const hay = flattenAiLocalCopyText(copy);
  const pharmacy = input.business;
  const street = streetFromAddress(pharmacy.address);
  const corpus = supportCorpusV3(acceptedFacts, input);

  const pushFail = (field: string, sentence: string, rule: string, defect: string) => {
    failures.push(formatWritingContractFindingV3({ field, sentence, rule, defect }));
  };
  const pushReview = (field: string, sentence: string, rule: string, defect: string) => {
    reviews.push(formatWritingContractFindingV3({ severity: "review", field, sentence, rule, defect }));
  };

  if (copy.area !== input.locality.areaName) {
    pushFail("area", copy.area, "area-match", `area field "${copy.area}" does not match selected area "${input.locality.areaName}"`);
  }
  if (JOURNEY_CLAIM.test(hay)) {
    const hit = splitSentences(hay).find((s) => JOURNEY_CLAIM.test(s)) || hay;
    pushFail("page", hit, "unsupported-journey-claim", "the copy infers journey time, parking or opening hours");
  }
  if (AFFILIATION.test(hay)) {
    const hit = splitSentences(hay).find((s) => AFFILIATION.test(s)) || hay;
    pushFail("page", hit, "implied-affiliation", "the copy implies partnership, referral or endorsement");
  }
  if (ROUTE_IMPLICATION_V3.test(hay)) {
    const hit = splitSentences(hay).find((s) => ROUTE_IMPLICATION_V3.test(s)) || hay;
    pushFail("page", hit, "unsupported-route", "the copy implies a route to the pharmacy that is not supplied");
  }
  if (TRAVEL_OR_CENTRE_DISTANCE_V3.test(hay)) {
    const hit = splitSentences(hay).find((s) => TRAVEL_OR_CENTRE_DISTANCE_V3.test(s)) || hay;
    pushFail("page", hit, "unsupported-travel-distance", "the copy presents kilometres as travel or town-centre distance");
  }
  if (NEAREST_OR_CLOSEST_V3.test(hay)) {
    const hit = splitSentences(hay).find((s) => NEAREST_OR_CLOSEST_V3.test(s)) || hay;
    pushFail("page", hit, "unsupported-nearest-claim", "the copy claims nearest or closest without support");
  }
  if (RAW_PROVIDER_LABEL.test(hay) || /\bDr C Liley\b/i.test(hay)) {
    const hit = splitSentences(hay).find((s) => RAW_PROVIDER_LABEL.test(s) || /Dr C Liley/i.test(s)) || hay;
    pushFail("page", hit, "raw-provider-label", "raw provider listing language appears in customer copy");
  }
  if (UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(hay)) {
    const hit = splitSentences(hay).find((s) => UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(s)) || hay;
    pushFail("page", hit, "unsupported-evaluative-claim", "convenience, accessibility, speed or marketing language is not a supplied fact");
  }

  const seen = new Set<string>();
  for (const { field, text } of localCopyFields(copy)) {
    const parts = splitSentences(text);
    if (!parts.length && text.trim()) parts.push(text.trim());
    for (const uniqueSentence of parts) {
      const key = `${field}::${uniqueSentence}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (
        ROUTE_IMPLICATION_V3.test(uniqueSentence) ||
        TRAVEL_OR_CENTRE_DISTANCE_V3.test(uniqueSentence) ||
        UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(uniqueSentence) ||
        NEAREST_OR_CLOSEST_V3.test(uniqueSentence)
      ) {
        pushFail(field, uniqueSentence, "unsupported-inference", "the sentence contains an unsupported inference or evaluative claim");
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

      const clauses = splitIndependentClausesV3(uniqueSentence);
      const clauseResults: Array<{
        clause: string;
        status: "pass" | "fail" | "review";
        detail: string;
        support: string;
        source: string;
        rule: string;
        branch: ClauseGroundingBranchV3;
      }> = [];
      for (const clause of clauses.length ? clauses : [uniqueSentence]) {
        const numbers = numbersUnsupportedV3(clause, corpus, input.locality.distanceKm);
        if (numbers.length) {
          clauseResults.push({
            clause,
            status: "fail",
            detail: `unsupported number ${numbers.join(", ")} is not in the supplied facts or verified distance`,
            support: "",
            source: "",
            rule: "unsupported-number",
            branch: "numbersUnsupportedV3",
          });
          continue;
        }
        const dates = datesUnsupportedV3(clause, corpus);
        if (dates.length) {
          clauseResults.push({
            clause,
            status: "fail",
            detail: `unsupported date ${dates.join(", ")} is not in the supplied facts`,
            support: "",
            source: "",
            rule: "unsupported-date",
            branch: "datesUnsupportedV3",
          });
          continue;
        }
        const localityConflict = localityContradictionV3(clause, acceptedFacts, input.locality.areaName);
        if (localityConflict) {
          clauseResults.push({
            clause,
            status: "fail",
            detail: `locality contradiction: “${localityConflict}” is not the geography supplied for ${input.locality.areaName}`,
            support: "",
            source: "",
            rule: "locality-contradiction",
            branch: "localityContradictionV3",
          });
          continue;
        }
        if (UNSUPPORTED_CHARACTER_V3.test(clause)) {
          clauseResults.push({
            clause,
            status: "fail",
            detail: "local character or resident value is asserted without a supplied fact",
            support: "",
            source: "",
            rule: "unsupported-character",
            branch: "UNSUPPORTED_CHARACTER_V3",
          });
          continue;
        }
        if (CLINICAL_BROADENING_V3.test(clause)) {
          clauseResults.push({
            clause,
            status: "fail",
            detail: "the clause broadens approved clinical copy (waiting, another option, or a condition set that is not supplied)",
            support: "",
            source: "",
            rule: "clinical-broadening",
            branch: "CLINICAL_BROADENING_V3",
          });
          continue;
        }
        if (EMPTY_LOCAL_CLAIM_V3.test(clause)) {
          clauseResults.push({
            clause,
            status: "fail",
            detail: "empty local claim is not a supplied fact",
            support: "",
            source: "",
            rule: "empty-local-claim",
            branch: "EMPTY_LOCAL_CLAIM_V3",
          });
          continue;
        }

        const matchedFacts = acceptedFacts.filter((fact) => clauseCoveredByFactV3(clause, fact).covered);
        const leftover = leftoverUnsupportedV3(clause, corpus).filter((token) => {
          if (/\b\d+(?:\.\d+)?\s*km\b/i.test(clause) && /approximately|approx|around|about|roughly|straight|line|located|away/.test(token)) {
            return false;
          }
          return true;
        });
        const leftoverContent = leftoverContentTokensV3(leftover);

        let support = "";
        let source = "";
        let supportBranch: ClauseGroundingBranchV3 = "no-covering-support";
        if (matchedFacts.length) {
          support = matchedFacts.map((f) => f.factId).join(", ");
          source = matchedFacts.map((f) => f.publisher).join(", ");
          supportBranch = "clauseCoveredByFactV3";
        } else if (street && street.length > 6 && normalizePlaceText(clause).includes(normalizePlaceText(street))) {
          support = "business.address";
          source = "canonical-pharmacy-profile";
          supportBranch = "canonical-or-clinical-support";
        } else if (pharmacy.address && normalizePlaceText(clause).includes(normalizePlaceText(pharmacy.address))) {
          support = "business.address";
          source = "canonical-pharmacy-profile";
          supportBranch = "canonical-or-clinical-support";
        } else if (pharmacy.telephone && clause.includes(pharmacy.telephone)) {
          support = "business.telephone";
          source = "canonical-pharmacy-profile";
          supportBranch = "canonical-or-clinical-support";
        } else if (premisesLocalitySupportsSentence(pharmacy.address, clause)) {
          support = "business.address";
          source = "canonical-pharmacy-profile";
          supportBranch = "canonical-or-clinical-support";
        } else if (clauseStatesSuppliedApproximateStraightLineDistanceV3(clause, input)) {
          support = "locality.distanceKm";
          source = "verified-locality-evidence";
          supportBranch = "canonical-or-clinical-support";
        } else if (pharmacy.name && clause.toLowerCase().includes(pharmacy.name.toLowerCase())) {
          support = "business.name";
          source = "canonical-pharmacy-profile";
          supportBranch = "canonical-or-clinical-support";
        } else if (
          /eligible common conditions|pharmacy first can (?:help|support)|pharmacist will (?:assess|advise|review|confirm)|pharmacist (?:still )?confirms what can be assessed|pharmacist may (?:also )?advise referral|nhs 111|urgent (?:medical )?care|red-flag|consultation is being arranged|call ahead|call before visiting|call the pharmacy before visiting|self-care advice|safety-netting|eligibility (?:depends|for pharmacy first)|nhs pathway criteria|discuss your symptoms|if pharmacy first is not suitable/i.test(
            clause,
          )
        ) {
          support = "offer.lockedClinicalFacts";
          source = "approved-clinical-copy";
          supportBranch = "canonical-or-clinical-support";
        } else if (lockedClinicalCoversClauseV3(clause, input)) {
          support = "offer.lockedClinicalFacts";
          source = "approved-clinical-copy";
          supportBranch = "canonical-or-clinical-support";
        } else if (
          uniqueSentence.toLowerCase().includes(input.locality.areaName.toLowerCase()) &&
          (field === "heroHeading" || field === "localContextHeading" || field === "heroIntroduction")
        ) {
          support = "locality.areaName";
          source = "campaign-builder-selected-area";
          supportBranch = "canonical-or-clinical-support";
        } else if (/pharmacy first/i.test(clause) && !CLINICAL_BROADENING_V3.test(clause)) {
          support = "offer.lockedClinicalFacts";
          source = "approved-clinical-copy";
          supportBranch = "canonical-or-clinical-support";
        }

        if (support && leftoverContent.length === 0) {
          clauseResults.push({
            clause,
            status: "pass",
            detail: "",
            support,
            source,
            rule: "grounded",
            branch: supportBranch,
          });
          continue;
        }
        if (support && leftoverContent.length > 0) {
          clauseResults.push({
            clause,
            status: "review",
            detail: `uncertain paraphrase: unmatched wording (${leftoverContent.join(", ")}) is not proof of a new fact, and is not established as supported`,
            support,
            source,
            rule: "uncertain-paraphrase",
            branch: "uncertain-paraphrase",
          });
          continue;
        }

        const isQuestion = /\.question$/.test(field) || /\?$/.test(uniqueSentence.trim());
        if (
          isQuestion &&
          !NEAREST_OR_CLOSEST_V3.test(clause) &&
          !UNSUPPORTED_EVALUATIVE_CLAIM_V2.test(clause) &&
          !ROUTE_IMPLICATION_V3.test(clause) &&
          !UNSUPPORTED_CHARACTER_V3.test(clause) &&
          !CLINICAL_BROADENING_V3.test(clause)
        ) {
          clauseResults.push({
            clause,
            status: "pass",
            detail: "",
            support: "non-claim-structure",
            source: "none-required",
            rule: "non-claim-structure",
            branch: "non-claim-structure",
          });
          continue;
        }
        if (field === "heroHeading" || field === "localContextHeading") {
          clauseResults.push({
            clause,
            status: leftoverContent.length ? "review" : "pass",
            detail: leftoverContent.length
              ? `uncertain heading wording (${leftoverContent.join(", ")})`
              : "",
            support: "non-claim-structure",
            source: "none-required",
            rule: leftoverContent.length ? "uncertain-paraphrase" : "non-claim-structure",
            branch: leftoverContent.length ? "uncertain-paraphrase" : "non-claim-structure",
          });
          continue;
        }
        if (isGenuineNonClaimCtaV3(field, clause)) {
          clauseResults.push({
            clause,
            status: leftoverContent.length ? "review" : "pass",
            detail: leftoverContent.length
              ? `uncertain CTA wording (${leftoverContent.join(", ")})`
              : "",
            support: field === "localCtaBridge" ? "non-claim-cta" : "non-claim-structure",
            source: "none-required",
            rule: leftoverContent.length ? "uncertain-paraphrase" : "non-claim-structure",
            branch: leftoverContent.length ? "uncertain-paraphrase" : "non-claim-structure",
          });
          continue;
        }

        clauseResults.push({
          clause,
          status: "fail",
          detail: "no supplied fact, canonical field or approved clinical text covers this clause",
          support: "",
          source: "",
          rule: "ungrounded-clause",
          branch: "no-covering-support",
        });
      }

      const failed = clauseResults.filter((row) => row.status === "fail");
      const reviewed = clauseResults.filter((row) => row.status === "review");
      if (failed.length) {
        for (const row of failed) {
          pushFail(field, uniqueSentence, row.rule, `${row.clause} — ${row.detail}`);
        }
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: failed.map((row) => row.support).filter(Boolean).join(", "),
          providerSource: "",
          validationResult: "fail",
          detail: failed.map((row) => `${row.branch}: ${row.detail}`).join("; "),
        });
        continue;
      }
      if (reviewed.length) {
        for (const row of reviewed) {
          pushReview(field, uniqueSentence, row.rule, `${row.clause} — ${row.detail}`);
        }
        claims.push({
          generatedField: field,
          exactSentence: uniqueSentence,
          supportingCanonicalFieldOrEntity: reviewed.map((row) => row.support).filter(Boolean).join(", "),
          providerSource: reviewed.map((row) => row.source).filter(Boolean).join(", "),
          validationResult: "review",
          detail: reviewed.map((row) => `${row.branch}: ${row.detail}`).join("; "),
        });
        continue;
      }

      claims.push({
        generatedField: field,
        exactSentence: uniqueSentence,
        supportingCanonicalFieldOrEntity: clauseResults.map((row) => row.support).filter(Boolean).join(", "),
        providerSource: clauseResults.map((row) => row.source).filter(Boolean).join(", "),
        validationResult: "pass",
        detail: clauseResults.map((row) => row.branch).filter(Boolean).join(", "),
      });
    }
  }

  return {
    ok: failures.length === 0 && reviews.length === 0,
    failures: [...new Set(failures)],
    reviews: [...new Set(reviews)],
    claims,
  };
}
