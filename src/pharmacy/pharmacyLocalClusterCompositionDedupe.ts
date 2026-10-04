/**
 * Idempotent sentence/intent dedupe for local-cluster page composition.
 * Rejects repeated NHS / eligibility / assessment / referral / CTA intents.
 */
import type { LocalClusterPageContent } from "./pharmacyLocalClusterContentEngine.ts";

const INTENT_PATTERNS: Array<{ intent: string; re: RegExp }> = [
  { intent: "nhs-service", re: /\bNHS (?:Pharmacy First|advanced service|community pharmacy service|pathway)\b/i },
  { intent: "nhs-explanation", re: /\bseven common conditions\b|\bPatient Group Directions\b|\bPGDs?\b/i },
  { intent: "eligibility", re: /\beligib(?:le|ility)\b|\bpathway criteria\b|\bcommissioning criteria\b/i },
  { intent: "assessment", re: /\bstructured (?:NHS )?assessment\b|\bpharmacist(?:-led)? assessment\b/i },
  { intent: "referral", re: /\breferral if needed\b|\bsignposts? to GP\b|\bsafety-netting\b/i },
  { intent: "consultation", re: /\bprivate consultation\b|\bconfidential consultation\b/i },
  { intent: "cta", re: /\b(book (?:an )?appointment|call \d|book pharmacy first|speak to the pharmacist)\b/i },
];

/** Strip internal routing/engine labels from public-facing cluster copy. */
export function scrubPublicLocalEngineTerms(text: string): string {
  return String(text || "")
    .replace(/\blocation[- ]cluster(?:s)?\b/gi, "local area")
    .replace(/\bcluster pages?\b/gi, "local guides")
    .replace(/\blocal area pages?\b/gi, "local guides")
    .replace(/\bhub pages?\b/gi, "location overview")
    .replace(/\blocal-hub\b/gi, "locations")
    .replace(/\bcluster-[a-z0-9-]+\b/gi, "local area")
    .replace(/\bin the ([^.]+?) cluster\b/gi, "near $1")
    .replace(/\b([A-Za-z][\w' -]{1,40}) cluster\b/g, "$1")
    .replace(/\bMain ([^.]+?) page\b/gi, "$1 overview")
    .replace(/\bLocation hub\b/gi, "All locations")
    .replace(/\blocal guides under service hub for [^.]+/gi, "local guidance for patients around Barnsley")
    .replace(/\bunder service hub for [A-Za-z][\w' -]{0,40}/gi, "for patients in the local area")
    .replace(/\bservice hub for [A-Za-z][\w' -]{0,40}/gi, "local pharmacy service")
    .replace(/\bservice hub\b/gi, "local pharmacy service")
    .replace(/\bOther approved ([A-Za-z][\w' -]{1,40}) locality pages?\b/gi, "Guidance for patients travelling from $1")
    .replace(/\binternal routing\b/gi, "local navigation")
    .replace(/\btemplate names?\b/gi, "page layout")
    .replace(/\binternal section IDs?\b/gi, "section labels")
    .replace(/\bbuilder terminology\b/gi, "page wording")
    .replace(/\bpages for communities\b/gi, "support for communities")
    .replace(/\bdata-local-cluster\b/gi, "data-local-area")
    .replace(/\bLandmark orientation:\s*/gi, "")
    .replace(/\bGreen space nearby:\s*/gi, "")
    .replace(/\bLocal shopping:\s*/gi, "")
    .replace(/\bSchools in the catchment:\s*/gi, "")
    .replace(/\bNeighbouring communities:\s*/gi, "")
    .replace(/\bnearby in the local catchment(?:\s+from the pharmacy)?\b/gi, "a short journey away")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Scrub public HTML attributes/paths that leak internal routing terms. */
export function scrubPublicLocalEngineHtml(html: string): string {
  if (/data-approved-bank-locality-contract=/i.test(html)) return html;
  return String(html || "")
    .replace(/\bdata-local-page-kind="location-cluster"/gi, 'data-local-page-kind="location-area"')
    .replace(/\bdata-publish-source="local-cluster-v1"/gi, 'data-publish-source="local-area-v1"')
    .replace(/\bdata-publish-source="local-hub-v1"/gi, 'data-publish-source="local-locations-v1"')
    .replace(/\bdata-local-page-contract="local-cluster-v1"/gi, 'data-local-page-contract="local-area-v1"')
    .replace(/\bdata-local-page-contract="local-hub-v1"/gi, 'data-local-page-contract="local-locations-v1"')
    .replace(/\bdata-local-cluster="/gi, 'data-local-area="')
    .replace(/\/local\/cluster-/gi, "/local/")
    .replace(/\/local-hub\//gi, "/locations/")
    .replace(/\/local\/hub\//gi, "/locations/")
    .replace(/local\/cluster-/gi, "local/")
    .replace(/\bcluster-cluster-/gi, "")
    .replace(/>\s*cluster\s*</gi, "><")
    .replace(/>\s*hub\s*</gi, "><");
}

export function normalizeSentenceKey(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s'-]/g, "")
    .trim();
}

function splitSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sentenceKey(text: string): string {
  const key = normalizeSentenceKey(text);
  return key.length > 80 ? key.slice(0, 80) : key;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeSentenceKey(text)
      .split(" ")
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: string, b: string): number {
  const aSet = tokenSet(a);
  const bSet = tokenSet(b);
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const t of aSet) if (bSet.has(t)) inter += 1;
  return inter / (aSet.size + bSet.size - inter);
}

function nearDuplicate(a: string, b: string): boolean {
  const ka = sentenceKey(a);
  const kb = sentenceKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.length >= 40 && kb.length >= 40 && (ka.includes(kb) || kb.includes(ka))) return true;
  return jaccard(a, b) >= 0.72;
}

export function dedupeSentencesInText(text: string, usedKeys?: Set<string>): string {
  const seen = usedKeys ?? new Set<string>();
  const kept: string[] = [];

  for (const raw of splitSentences(text)) {
    const key = sentenceKey(raw);
    if (key.length < 12) {
      kept.push(raw);
      continue;
    }
    if (seen.has(key)) continue;
    if (kept.some((existing) => nearDuplicate(existing, raw))) continue;
    seen.add(key);
    kept.push(raw);
  }

  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

export function dedupeStringList(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = sentenceKey(trimmed);
    if (seen.has(key)) continue;
    if (out.some((existing) => nearDuplicate(existing, trimmed))) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function detectIntents(text: string): string[] {
  return INTENT_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.intent);
}

function dedupeFieldWithIntents(
  text: string,
  usedKeys: Set<string>,
  usedIntents: Set<string>,
  allowIntents: string[] = [],
): string {
  const allow = new Set(allowIntents);
  const kept: string[] = [];
  for (const raw of splitSentences(scrubPublicLocalEngineTerms(text))) {
    const key = sentenceKey(raw);
    if (key.length < 12) {
      kept.push(raw);
      continue;
    }
    if (usedKeys.has(key) || kept.some((existing) => nearDuplicate(existing, raw))) continue;
    const intents = detectIntents(raw);
    const blocked = intents.filter((intent) => usedIntents.has(intent) && !allow.has(intent));
    if (blocked.length) continue;
    for (const intent of intents) {
      if (!allow.has(intent)) usedIntents.add(intent);
    }
    usedKeys.add(key);
    kept.push(raw);
  }
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

export function finalizeLocalClusterPageContent(content: LocalClusterPageContent): LocalClusterPageContent {
  const usedKeys = new Set<string>();
  const usedIntents = new Set<string>();

  // Pharmacy First commercial planner owns section intents explicitly (How vs Conditions).
  // Cross-field intent blocking was deleting the Conditions inventory and How opener.
  const pharmacyFirstCommercial = String(content.narrativeType || "").startsWith("pharmacy-first-intelligence");

  const heroIntro = dedupeFieldWithIntents(content.heroIntro, usedKeys, usedIntents);
  const whyChecksBody = dedupeFieldWithIntents(content.whyChecksBody, usedKeys, usedIntents);
  // Preserve %%TRAVEL%% / %%CONSULTATION%% marker payloads — sentence dedupe would
  // strip the travel body (already present in accessBody) and empty polish meta.
  const processIntro = /%%(?:TRAVEL|CONSULTATION|STRATEGY)%%/i.test(content.processIntro || "")
    ? scrubPublicLocalEngineTerms(content.processIntro)
    : dedupeFieldWithIntents(content.processIntro, usedKeys, usedIntents, [
        "nhs-service",
        "nhs-explanation",
        "eligibility",
        "assessment",
        "referral",
      ]);
  const localRelevanceIntro = dedupeFieldWithIntents(
    content.localRelevanceIntro,
    usedKeys,
    usedIntents,
    pharmacyFirstCommercial ? ["nhs-service", "nhs-explanation", "eligibility", "assessment", "referral"] : [],
  );
  const localRelevanceBody = dedupeFieldWithIntents(
    content.localRelevanceBody,
    usedKeys,
    usedIntents,
    pharmacyFirstCommercial ? ["nhs-service", "nhs-explanation", "eligibility", "assessment", "referral"] : [],
  );
  const processSteps = content.processSteps.map((step) => ({
    title: scrubPublicLocalEngineTerms(step.title),
    body: dedupeFieldWithIntents(step.body, usedKeys, usedIntents, step.title.toLowerCase().includes("next") ? ["referral"] : []),
  }));
  const accessOwnKeys = new Set<string>();
  const accessBody = dedupeFieldWithIntents(content.accessBody, accessOwnKeys, usedIntents, [
    "cta",
  ]);
  for (const key of accessOwnKeys) usedKeys.add(key);
  const clinicalEnvironmentBody = dedupeFieldWithIntents(content.clinicalEnvironmentBody, usedKeys, usedIntents);
  const preserveApprovedSafety = String(content.narrativeType || "").startsWith("canonical-local-content-engine");
  const trustBody = preserveApprovedSafety
    ? scrubPublicLocalEngineTerms(content.trustBody)
    : dedupeFieldWithIntents(content.trustBody, usedKeys, usedIntents, ["referral"]);
  const trustIntro = content.trustIntro
    ? dedupeFieldWithIntents(content.trustIntro, usedKeys, usedIntents, ["referral"])
    : undefined;
  const trustClosing = content.trustClosing
    ? dedupeFieldWithIntents(content.trustClosing, usedKeys, usedIntents, ["cta"])
    : undefined;
  const faqs = content.faqs.map((faq) => ({
    question: scrubPublicLocalEngineTerms(faq.question),
    answer: dedupeFieldWithIntents(faq.answer, usedKeys, usedIntents, ["eligibility", "cta", "referral"]),
  }));

  return {
    ...content,
    heroIntro,
    localRelevanceHeading: scrubPublicLocalEngineTerms(content.localRelevanceHeading),
    localRelevanceIntro,
    localRelevanceBody,
    localRelevanceBullets: dedupeStringList(content.localRelevanceBullets.map(scrubPublicLocalEngineTerms)),
    whyChecksHeading: scrubPublicLocalEngineTerms(content.whyChecksHeading),
    whyChecksBody,
    whyChecksBullets: dedupeStringList(content.whyChecksBullets.map(scrubPublicLocalEngineTerms)),
    processHeading: scrubPublicLocalEngineTerms(content.processHeading),
    processIntro,
    processSteps,
    accessHeading: scrubPublicLocalEngineTerms(content.accessHeading),
    accessBody,
    clinicalEnvironmentHeading: scrubPublicLocalEngineTerms(content.clinicalEnvironmentHeading),
    clinicalEnvironmentBody,
    trustHeading: scrubPublicLocalEngineTerms(content.trustHeading),
    trustBody,
    trustIntro,
    trustBullets: content.trustBullets
      ? dedupeStringList(content.trustBullets.map(scrubPublicLocalEngineTerms))
      : undefined,
    trustClosing,
    faqs,
    ctaPrimary: scrubPublicLocalEngineTerms(content.ctaPrimary),
    ctaSecondary: scrubPublicLocalEngineTerms(content.ctaSecondary),
    ctaPhonePrompt: scrubPublicLocalEngineTerms(content.ctaPhonePrompt),
  };
}
