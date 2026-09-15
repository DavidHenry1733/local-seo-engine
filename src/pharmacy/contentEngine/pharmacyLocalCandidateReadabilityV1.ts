/**
 * Automated customer-copy readability preflight for isolated local-page candidates.
 * This cannot establish Product Owner approval. Report as AUTOMATED READABILITY PREFLIGHT.
 */
import {
  extractCustomerVisibleBody,
  extractLocalityNarrativeHtml,
  extractParagraphsFromHtml,
  extractTemplateBlock,
} from "./pharmacyLocalPageCandidateUniquenessV1.ts";

export const AUTOMATED_READABILITY_PREFLIGHT_LABEL = "AUTOMATED READABILITY PREFLIGHT";

export const PROMPT_91_UNNATURAL_CUSTOMER_PHRASES = [
  "not as a service delivered from a local landmark list",
  "recorded school context",
  "should not be read as a recommendation, drop-off arrangement, or referral route",
  "Eligibility depends ... not on which local place you recognise",
  "Local context for Darfield is meant to be recognisable, not exhaustive",
  "That geography does not tell the pharmacist what to prescribe",
  "symptoms rather than a map of local buildings",
];

const INTERNAL_VALIDATION_TERMS = [
  /\bevidence packs?\b/i,
  /\brecorded (?:school |health |local |landmark |transport |retail |community )?context\b/i,
  /\blandmark lists?\b/i,
  /\bdatabases?\b/i,
  /\bprovider records\b/i,
  /\battribution\b/i,
  /\bprovenance\b/i,
  /\blocal-copy strategy\b/i,
  /\buniqueness\b/i,
  /\bpadding\b/i,
  /\bon file\b/i,
  /\bverified facts on file\b/i,
  /\bsaved locality evidence\b/i,
  /\bsaved coordinates\b/i,
  /\bmaps? of local buildings\b/i,
];

const DEFENSIVE_NON_AFFILIATION = [
  /\bshould not be read as a recommendation\b/i,
  /\bdrop-off arrangement\b/i,
  /\breferral route\b/i,
  /\breferral partner\b/i,
  /\bnot affiliated\b/i,
  /\bnot a partner of the pharmacy\b/i,
  /\bdoes not speak for the pharmacy\b/i,
  /\bnon-affiliation\b/i,
  /\bnot an endorsement\b/i,
  /\bcommercial relationship with the pharmacy\b/i,
  /\bcommercial tie to\b/i,
  /\bnot a recommended stop\b/i,
  /\bnot a pharmacy first partner\b/i,
  /\bdoes not decide (?:pharmacy first )?eligibility\b/i,
];

const META_WHY_PLACE_MENTIONED = [
  /\bnot as a service delivered from a local landmark list\b/i,
  /\bmeant to be recognis[ae]ble, not exhaustive\b/i,
  /\bgeography does not tell the pharmacist\b/i,
  /\bdoes not tell the pharmacist what to prescribe\b/i,
  /\bnot on which local place you recognise\b/i,
  /\beligibility depends on symptoms and nhs pathway criteria, not on which local place\b/i,
  /\bthat distinction matters\b/i,
  /\bkeeping those two facts apart\b/i,
  /\blocal names are (?:orientation|context)\b/i,
  /\blocal context only\b/i,
  /\brecorded landmark context\b/i,
  /\bwhy .{0,40}was included\b/i,
  /\bthis page does not treat it as\b/i,
  /\bmixing the two usually causes confusion\b/i,
  /\bhonest naming here means\b/i,
  /\bthe remaining job of this section\b/i,
];

const IMAGINED_ROUTINES = [
  /\bweekday errands\b/i,
  /\bafter-school pickups?\b/i,
  /\bweekend visits\b/i,
  /\bschool-run\b/i,
  /\bshopping routines?\b/i,
  /\bmarket days\b/i,
  /\bmatch days\b/i,
  /\blunch-break visits\b/i,
  /\bshift workers\b/i,
  /\bgrandparents, carers\b/i,
  /\bnewcomers and long-settled\b/i,
  /\bfamily geography\b/i,
  /\beveryday errands around\b/i,
  /\bcombine local errands\b/i,
];

const UNNATURAL_CTA = [
  /\bthe useful action is to contact\b/i,
  /\bthe next step is ordinary\b/i,
  /\bhonest first call\b/i,
  /\bstart with symptoms rather than a map\b/i,
];

const ENTITY_LIST_NARRATION = [
  /\blocal context for \w+ is meant to be\b/i,
  /\ba couple of verified .{0,40}places\b/i,
  /\bdirectory of every nearby building\b/i,
  /\brecognis[ae]ble, not exhaustive\b/i,
  /\bsmall number of verified places\b/i,
  /\bnames what is actually recorded nearby\b/i,
  /\bis a recognis[ae]ble place in\b/i,
  /\bwill already have a sense of\b/i,
  /\bis a useful orientation point\b/i,
  /\bchoosing between .{0,80} and a pharmacist visit\b/i,
  /\bcan help you place\b/i,
  /\bis a useful way to identify\b/i,
  /\bKeep the journey simple\b/i,
  /\bBring the full address with you\b/i,
  /\barriving unannounced\b/i,
  /\bThe complete destination is\b/i,
  /\bThe destination is\b/i,
  /\bis not based in\b/i,
];

function visibleLocalAndAccess(html: string): string {
  const local = extractCustomerVisibleBody(extractLocalityNarrativeHtml(html));
  const access = extractCustomerVisibleBody(extractTemplateBlock(html, "local") || "");
  const faq = extractCustomerVisibleBody(extractTemplateBlock(html, "faq") || "");
  const hero = extractCustomerVisibleBody(extractTemplateBlock(html, "hero") || "");
  const definition = extractCustomerVisibleBody(extractTemplateBlock(html, "service-definition") || "");
  return `${hero} ${definition} ${local} ${access} ${faq}`.replace(/\s+/g, " ").trim();
}

function customerFacingMain(html: string): string {
  return extractCustomerVisibleBody(html);
}

export function evaluateProhibitedCustomerLanguage(text: string): string[] {
  const failures: string[] = [];
  const hay = String(text || "");
  const checks: Array<{ label: string; patterns: RegExp[] }> = [
    { label: "internal validation terminology", patterns: INTERNAL_VALIDATION_TERMS },
    { label: "defensive non-affiliation prose", patterns: DEFENSIVE_NON_AFFILIATION },
    { label: "meta explanation of why a locality is mentioned", patterns: META_WHY_PLACE_MENTIONED },
    { label: "entity-list narration", patterns: ENTITY_LIST_NARRATION },
    { label: "imagined routines or demographics", patterns: IMAGINED_ROUTINES },
    { label: "unnatural CTA transition", patterns: UNNATURAL_CTA },
  ];
  for (const check of checks) {
    for (const pattern of check.patterns) {
      if (pattern.test(hay)) failures.push(`${check.label}: ${pattern.source}`);
    }
  }
  if (/\bCall\b[\s\S]{0,80}\bfor directions from\b[\s\S]{0,40}\bto\b[\s\S]{0,80}$/i.test(hay.split(/(?<=[.!?])\s+/).find((s) => /for directions from/i.test(s) || "") || "")) {
    const answers = hay.split(/(?<=[.!?])\s+/).filter((s) => /for directions from/i.test(s));
    for (const answer of answers) {
      if (/^call\b[\s\S]{0,60}for directions from\b[\s\S]+to\b[\s\S]+$/i.test(answer.trim()) && !/\bkm\b|\bmiles?\b|from the pharmacy/i.test(answer)) {
        failures.push("directions FAQ used as the complete answer without verified distance");
      }
    }
  }
  return [...new Set(failures)];
}

export function evaluateGrammarAndFragments(text: string): string[] {
  const failures: string[] = [];
  const hay = String(text || "").replace(/\s+/g, " ").trim();
  if (/\bfrom\s+to\b/i.test(hay)) failures.push("fragment: empty from-place");
  const sentences = hay
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  for (const sentence of sentences) {
    if (/^(and|or|but|which|that geography|local context for)\b/i.test(sentence) && !/[.!?]$/.test(sentence)) {
      failures.push(`fragmented sentence: ${sentence.slice(0, 80)}`);
    }
    if (/\?$/.test(sentence)) continue;
    if (/^[a-z]/.test(sentence) && sentence.split(/\s+/).length > 4) {
      failures.push(`sentence does not start with a capital: ${sentence.slice(0, 80)}`);
    }
    if (!/[.!?]"?$/.test(sentence) && sentence.split(/\s+/).length > 8 && !/:$/.test(sentence)) {
      failures.push(`grammatically incomplete sentence: ${sentence.slice(0, 80)}`);
    }
    if (/^Call\s+[\d\s]+\s+to ask\.?$/i.test(sentence)) {
      failures.push(`leftover fragment: ${sentence}`);
    }
  }
  return failures;
}

export function evaluateForcedSchoolRetailAndRoutines(
  text: string,
  areaName: string,
): string[] {
  const failures: string[] = [];
  const hay = String(text || "");
  if (/\b(upperwood academy|park street primary|netherwood academy)\b/i.test(hay) && /recorded|referral|drop-off|pickup|family geography|everyday life/i.test(hay)) {
    failures.push(`${areaName}: school mentioned without demonstrable patient access value`);
  }
  if (/\b(drop-off|pickup|pick-up|school-run)\b/i.test(hay)) {
    failures.push("imagined school drop-off or pickup");
  }
  const schoolHits = hay.match(/\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s(?:Academy|Primary School|Infant School|Junior School))\b/g) || [];
  for (const name of schoolHits) {
    const window = sentenceContaining(hay, name);
    if (!/\b(next to|opposite|on the same street|helps you find|helps you place|outside)\b/i.test(window)) {
      failures.push(`forced school reference without patient value: ${name}`);
    }
  }
  return failures;
}

function sentenceContaining(text: string, needle: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.find((s) => s.toLowerCase().includes(needle.toLowerCase())) || "";
}

export function evaluateEntityMentionsHavePatientValue(
  html: string,
  mentioned: Array<{ name: string; patientValue?: string }>,
): string[] {
  const failures: string[] = [];
  const local = visibleLocalAndAccess(html);
  for (const entity of mentioned) {
    const name = String(entity.name || "").trim();
    if (!name) continue;
    if (!local.toLowerCase().includes(name.toLowerCase())) continue;
    const sentence = sentenceContaining(local, name);
    const useful =
      /\b(call|pharmacy|consult|appointment|gp|place|recognise|recognize|station|library|park|distance|address|travelling|before you set off|without seeing a gp|routine gp)\b/i.test(
        sentence,
      );
    const meta = /recorded|not affiliated|referral|endorsement|context only|landmark list/i.test(sentence);
    if (!useful || meta) {
      failures.push(`entity mentioned without patient value: ${name}`);
    }
    if (mentioned.length && !String(entity.patientValue || "").trim()) {
      failures.push(`missing stated patient benefit for ${name}`);
    }
  }
  return failures;
}

export function evaluateAutomatedReadabilityPreflight(
  html: string,
  acceptedNames: string[] = [],
  areaName = "",
): { ok: boolean; failures: string[]; label: typeof AUTOMATED_READABILITY_PREFLIGHT_LABEL } {
  const failures: string[] = [];
  const visible = customerFacingMain(html);
  const local = visibleLocalAndAccess(html);
  failures.push(...evaluateProhibitedCustomerLanguage(local));
  failures.push(...evaluateGrammarAndFragments(local));
  failures.push(...evaluateForcedSchoolRetailAndRoutines(local, areaName));
  if (/\bfrom\s+to\b/i.test(visible)) failures.push("empty from-place in directions copy");
  if (/\bseo\b/i.test(local)) failures.push("search-engine meta commentary");
  const sentences = local.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    const hits = acceptedNames.filter((name) => name && sentence.toLowerCase().includes(name.toLowerCase()));
    if (hits.length >= 3) failures.push(`${areaName}: place-name stuffing (${hits.length} entities in one sentence)`);
  }
  const thinParas = extractParagraphsFromHtml(extractLocalityNarrativeHtml(html)).filter((para) => {
    const words = para.split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length < 8 && acceptedNames.some((n) => para.toLowerCase().includes(n.toLowerCase()));
  });
  if (thinParas.length >= 2) failures.push(`${areaName}: thin entity-only paragraphs`);
  const frames = sentences
    .map((s) => s.replace(/\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\b/g, "{name}").toLowerCase())
    .filter((s) => /\{name\} is a recorded/.test(s) || /\{name\} is recorded/.test(s));
  if (frames.length >= 2) failures.push(`${areaName}: repetitive recorded-entity sentence frames`);
  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    label: AUTOMATED_READABILITY_PREFLIGHT_LABEL,
  };
}

export function quotedPrompt91PhrasesFailPreflight(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const phrase of PROMPT_91_UNNATURAL_CUSTOMER_PHRASES) {
    const html = `<main><section data-template-block="hero"><p>${phrase}.</p></section></main>`;
    const result = evaluateAutomatedReadabilityPreflight(html, [], "Darfield");
    if (result.ok) failures.push(`quoted phrase did not fail preflight: ${phrase}`);
  }
  const equivalents = [
    "This is recorded local health context for Wombwell only.",
    "Chapeltown Library is not affiliated with the pharmacy and does not decide eligibility.",
    "Local names are orientation, and Pharmacy First is an assessment.",
    "Weekday errands around Goldthorpe still start with symptoms.",
    "That geography does not tell the pharmacist what to prescribe.",
    "Eligibility depends on symptoms, not on which local place you recognise.",
  ];
  for (const phrase of equivalents) {
    const html = `<main><section data-template-block="hero"><p>${phrase}</p></section></main>`;
    const result = evaluateAutomatedReadabilityPreflight(html, [], "Wombwell");
    if (result.ok) failures.push(`equivalent defensive wording did not fail preflight: ${phrase}`);
  }
  return { ok: failures.length === 0, failures };
}
