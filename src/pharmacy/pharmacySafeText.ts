/**
 * Pharmacy Safe Text — sentence-safe body copy for publish vs preview display.
 */

const ELLIPSIS_END = /(?:…|\.\.\.)\s*$/;

export function stripEllipsisFromBodyText(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(ELLIPSIS_END, "")
    .trim();
}

export function splitIntoCompleteSentences(text: string): string[] {
  const cleaned = stripEllipsisFromBodyText(text);
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!parts) return [cleaned];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Limit preview/admin text by complete sentences — never mid-word ellipsis. */
export function limitToCompleteSentences(text: string, maxChars?: number): string {
  const cleaned = stripEllipsisFromBodyText(text);
  if (!cleaned) return "";
  if (!maxChars || cleaned.length <= maxChars) return cleaned;

  const sentences = splitIntoCompleteSentences(cleaned);
  if (!sentences.length) return cleaned;

  let out = "";
  for (const sentence of sentences) {
    const candidate = out ? `${out} ${sentence}` : sentence;
    if (candidate.length > maxChars) break;
    out = candidate;
  }

  if (out) return out;
  return sentences[0];
}

/** Full reader-facing body copy for published HTML — never truncated. */
export function publishBodyText(text: string): string {
  return stripEllipsisFromBodyText(text);
}

/** Route body copy through publish (full) or preview (sentence-limited) paths. */
export function bodyTextForRender(text: string, maxChars: number, publishMode?: boolean): string {
  const cleaned = stripEllipsisFromBodyText(text);
  if (publishMode) return cleaned;
  return limitToCompleteSentences(cleaned, maxChars);
}

export interface MidSentenceTruncationIssue {
  field: string;
  excerpt: string;
  reason: string;
}

export function assertNoMidSentenceTruncation(
  text: string,
  field = "body",
): MidSentenceTruncationIssue | null {
  const t = String(text || "").trim();
  if (!t) return null;

  if (ELLIPSIS_END.test(t)) {
    return { field, excerpt: t.slice(-80), reason: "ends with ellipsis truncation marker" };
  }

  if (t.length >= 20 && !/[.!?]$/.test(t)) {
    const last = t.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z'-]/gi, "") || "";
    const dangling = new Set(["and", "or", "for", "with", "to", "from", "near", "around", "within"]);
    if (dangling.has(last)) {
      return { field, excerpt: t.slice(-80), reason: `ends mid-sentence on "${last}"` };
    }
  }

  return null;
}

const INTERNAL_LABEL_PREFIXES =
  /^(?:Patient intent|Barrier addressed|Authority topic|Benefit|Risk consideration|Preparation step|Aftercare step|Presentation|Condition context|Local search intent|Eligibility question|Cost\/value question|Question|Bridge|Suitability factor)\s*\d*\s*[:.]?\s*/i;

const INTERNAL_LABEL_INLINE =
  /\b(?:Patient intent|Barrier addressed|Authority topic|Eligibility question|Cost\/value question|Bridge|Question|Presentation|Condition context|Local search intent|Suitability factor|Benefit|Risk consideration|Preparation step|Aftercare step)\s+\d+\s*[:.]?\s*/gi;

/** Remove blueprint assembly labels from reader-facing copy. */
export function stripBlueprintLabels(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(INTERNAL_LABEL_INLINE, "")
    .replace(INTERNAL_LABEL_PREFIXES, "")
    .trim();
}

/** @deprecated use stripBlueprintLabels */
export function stripInternalBlueprintLabels(text: string): string {
  return stripBlueprintLabels(text);
}

/** Ensure short marketing fragments end as complete sentences. */
export function ensureCompleteSentence(text: string): string {
  const t = stripBlueprintLabels(stripEllipsisFromBodyText(text));
  if (!t) return "";
  const cleaned = t.replace(/:\.+/g, ".").replace(/:\s*$/g, ".");
  if (/[.!?]$/.test(cleaned)) return cleaned;
  if (cleaned.length >= 12) return `${cleaned}.`;
  return cleaned;
}

/** Meta description — complete sentences only, never mid-word cut. */
export function publishMetaDescription(text: string, maxChars = 160): string {
  const cleaned = stripBlueprintLabels(stripEllipsisFromBodyText(text));
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return ensureCompleteSentence(cleaned);
  return limitToCompleteSentences(cleaned, maxChars);
}

/** Hub/service overview body — strip labels and drop per-area concatenated blurbs. */
export function publishHubSectionBody(text: string, sectionType?: string): string {
  let cleaned = stripBlueprintLabels(stripEllipsisFromBodyText(text));
  if (!cleaned) return "";

  if (sectionType === "serviceOverview") {
    const sentences = splitIntoCompleteSentences(cleaned).filter(
      (s) => !/\bfor [A-Z][a-z]+ patients:\b/.test(s) && !/^The .+ page covers local access/.test(s),
    );
    cleaned = sentences.slice(0, 4).join(" ");
  } else if (sectionType === "coverageAreas") {
    const sentences = splitIntoCompleteSentences(cleaned).filter(
      (s) => !/^The .+ page covers local access/.test(s),
    );
    cleaned = sentences.slice(0, 2).join(" ");
  } else {
    cleaned = splitIntoCompleteSentences(cleaned).slice(0, 6).join(" ");
  }

  return ensureCompleteSentence(cleaned);
}

export interface CardHeadingSplit {
  heading: string;
  body: string;
}

export interface PublishCardContext {
  serviceName: string;
  serviceId?: string;
  pharmacyName?: string;
  town?: string;
  currentArea?: string;
  sectionType?: string;
}

const GENERIC_CARD_BODY_PATTERNS = [
  /^Professional support from your registered pharmacy team\.?$/i,
  /^Clear, confidential advice tailored to your needs\.?$/i,
  /^Structured assessment before any supply or treatment\.?$/i,
  /^Transparent fees and eligibility explained upfront\.?$/i,
  /^Convenient local access with clinical governance\.?$/i,
  /^Follow[- ]up guidance and safety[- ]netting where appropriate\.?$/i,
  /^Trusted healthcare support\.?$/i,
  /^Patient[- ]centred service\.?$/i,
  /^Confidential pharmacy consultations\.?$/i,
  /^Clear clinical guidance\.?$/i,
  /^Professional pharmacy care\.?$/i,
  /^Confidential consultation\.?$/i,
  /^Local community access\.?$/i,
];

function wordCount(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeCardText(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isInternalOnlyLabel(text: string): boolean {
  return /^(?:Patient intent|Barrier addressed|Authority topic|Myth|Question|Eligibility question|Cost\/value question|Bridge|Presentation|Condition context|Suitability factor)\s*\d*\.?$/i.test(
    text.trim(),
  );
}

export function isGenericCardBody(text: string): boolean {
  const t = String(text || "").trim();
  return GENERIC_CARD_BODY_PATTERNS.some((re) => re.test(t));
}

/** Patient-facing card title — strip labels, complete phrase, no trailing colon. */
export function safeCardTitle(raw: string): string {
  let t = stripBlueprintLabels(String(raw || "")).trim();
  if (!t) return "";
  t = t.replace(/:\s*$/, "").trim();

  if (t.length > 90 && t.includes("?")) {
    t = t.slice(0, t.indexOf("?") + 1);
  } else if (t.length > 85) {
    const sentences = splitIntoCompleteSentences(t);
    t = sentences[0]?.replace(/\.$/, "") || t.slice(0, 85).trim();
  }

  const dangling = new Set(["and", "or", "for", "with", "to", "the", "a", "an", "on", "in", "at", "by"]);
  const words = t.split(/\s+/).filter(Boolean);
  while (words.length > 4 && dangling.has(words[words.length - 1]?.toLowerCase() || "")) {
    words.pop();
  }
  t = words.join(" ");

  if (/^[a-z]/.test(t)) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

/** Contextual card body when blueprint bullets lack detail. */
export function buildServiceSpecificCardBody(title: string, ctx: PublishCardContext): string {
  const t = title.toLowerCase().replace(/\?$/, "").trim();
  const svc = ctx.serviceName || "this service";
  const lower = svc.toLowerCase();
  const pharmacy = ctx.pharmacyName || "your pharmacy";
  const town = ctx.town || "your area";
  const area = ctx.currentArea || town;
  const section = ctx.sectionType || "";

  if (title.trim().endsWith("?")) {
    if (/worth the fee|nhs alternatives|private|cost|value/.test(t)) {
      return `The team at ${pharmacy} compares NHS-funded and private ${lower} routes, including typical fees, eligibility and waiting times before you commit to an appointment.`;
    }
    if (/qualify|eligible|commission/.test(t)) {
      return `Eligibility for ${lower} depends on age, symptoms and local NHS commissioning — confirmed at consultation rather than assumed from online information alone.`;
    }
    return `${pharmacy} answers this during a brief consultation so you know whether ${lower} is appropriate before you book.`;
  }

  if (/pricing|fee|cost|appointment information|clear pricing/.test(t)) {
    return `The pharmacy team explains whether ${lower} is NHS-funded, privately paid, or subject to eligibility before your appointment goes ahead.`;
  }
  if (/expect during consultation|what to expect|during consultation/.test(t)) {
    return `Your pharmacist reviews symptoms or needs, checks safety, and explains next steps for ${lower} in plain language before any supply or referral.`;
  }
  if (/booking|book|appointment|schedule|documents before|confirm booking/.test(t)) {
    return `Call or book online for ${lower} — ${pharmacy} confirms what to bring, consultation length and same-day availability for ${town} patients.`;
  }
  if (/suitability|speak to a pharmacist|right for you/.test(t)) {
    return `A pharmacist assesses whether ${lower} fits your symptoms and medical history, with referral to GP or urgent care if red flags are present.`;
  }
  if (/safety|follow-up|follow up|aftercare|safety-netting|report concerns/.test(t)) {
    return `You receive clear return criteria after ${lower}, including when to contact GP, NHS 111 or emergency services if symptoms change.`;
  }
  if (/trust|gphc|governance|registered|standard|clinical governance/.test(t)) {
    return `${pharmacy} delivers ${lower} under GPhC professional standards with documented advice and supply records for continuity of care.`;
  }
  if (/pathway|process|step|contact to follow-up|first contact/.test(t) || section === "servicePathway") {
    return `Each stage of ${lower} at ${pharmacy} is explained before you leave, from triage and assessment through to supply, referral or follow-up booking.`;
  }
  if (/local access|support for|nearby|surrounding areas/.test(t) || section === "localContext") {
    return `Patients in ${area} and surrounding neighbourhoods can access ${lower} at ${pharmacy} with the same clinical pathway used across ${town}.`;
  }
  if (/education|understand|learn|prepare|options, eligibility/.test(t) || section === "patientEducation") {
    return `Understanding ${lower} before your visit helps you prepare questions and set realistic expectations for pharmacist-led care at ${pharmacy}.`;
  }

  const clinicalHeadings: Record<string, string> = {
    "condition assessment": `The pharmacist examines presentation and history to decide whether ${lower} is clinically appropriate before treatment or supply.`,
    "supply where eligible": `If you meet NHS or private criteria, ${lower} supply is completed in-pharmacy with counselling on safe use and side effects.`,
    "self-care advice": `You receive practical self-care guidance alongside ${lower}, including when symptoms should prompt GP review instead.`,
    "gp referral": `When ${lower} is not suitable in pharmacy, the team arranges GP referral or urgent signposting with documented safety-netting advice.`,
  };
  for (const [key, body] of Object.entries(clinicalHeadings)) {
    if (t.includes(key)) return body;
  }

  if (section === "patientIntent") {
    return `Patients choose ${lower} at ${pharmacy} for accessible pharmacist-led care with clear eligibility checks and booking support in ${town}.`;
  }
  if (section === "patientQuestions" || section === "areaPatientQuestions") {
    return `This is one of the most common questions about ${lower} — answered by the pharmacy team with reference to local NHS commissioning where applicable.`;
  }
  if (section === "authorityHighlights") {
    return `Professional governance for ${lower} at ${pharmacy} includes pharmacist oversight, confidential consultations and alignment with NHS specifications.`;
  }
  if (section === "trustSafety" || section === "areaTrust") {
    return `${pharmacy} maintains safety standards for ${lower}, including infection control, safeguarding policies and medicines interaction checks.`;
  }
  if (section === "bookingGuidance" || section === "localAccess") {
    return `Practical tips from ${pharmacy} help you book ${lower} without delay — including peak times, required information and whether walk-in slots are available in ${town}.`;
  }

  return `The team at ${pharmacy} provides clear, personalised guidance on ${lower} so you can make an informed decision before attending your appointment.`;
}

/** Card body — complete sentence, contextual, never generic duplicate of title. */
export function safeCardBody(raw: string, title: string, ctx: PublishCardContext): string {
  let body = stripBlueprintLabels(String(raw || "")).trim();
  if (body) body = ensureCompleteSentence(body);
  if (!body || isGenericCardBody(body) || rejectLowInformationCard(title, body)) {
    body = buildServiceSpecificCardBody(title, ctx);
  }
  return ensureCompleteSentence(body);
}

/** Reject cards that add no useful information beyond the heading. */
export function rejectLowInformationCard(title: string, body: string): boolean {
  const t = safeCardTitle(title);
  const b = ensureCompleteSentence(stripBlueprintLabels(body));
  if (!t || t.length < 8) return true;
  if (!b || wordCount(b) < 8) return true;
  if (isGenericCardBody(b)) return true;
  if (isInternalOnlyLabel(t)) return true;

  const normT = normalizeCardText(t);
  const normB = normalizeCardText(b);
  if (normT === normB) return true;
  if (normB.startsWith(normT) && wordCount(b) - wordCount(t) <= 3) return true;
  if (normT.startsWith(normB) && wordCount(t) - wordCount(b) <= 2) return true;

  if (/^(?:at|in|on|for|with|from|without|by|to|the|a|an)\b/i.test(b) && wordCount(b) <= 8) return true;

  return false;
}

/** Split bullet into complete card heading + body for publish feature cards. */
export function cardHeadingFromBullet(raw: string): CardHeadingSplit | null {
  let text = stripBlueprintLabels(String(raw || "")).trim();
  if (!text || text.length < 6 || isInternalOnlyLabel(text)) return null;

  const mythMatch = text.match(/^Myth:\s*(.+?)\s*Fact:\s*(.+)$/i);
  if (mythMatch) {
    return { heading: mythMatch[1].trim(), body: mythMatch[2].trim() };
  }

  const colonIdx = text.indexOf(":");
  if (colonIdx > 0 && colonIdx < 56) {
    const before = text.slice(0, colonIdx).trim();
    const after = text.slice(colonIdx + 1).trim();
    if (/^(?:Patient intent|Barrier addressed|Benefit|Risk|Preparation step|Aftercare step|Question|Bridge|Eligibility question|Cost\/value question)\s*\d*$/i.test(before) && after) {
      text = after;
    } else if (after.length >= 12 && before.length >= 4 && !isInternalOnlyLabel(before)) {
      return { heading: safeCardTitle(before), body: after };
    }
  }

  if (text.includes("?")) {
    const qEnd = text.indexOf("?") + 1;
    const question = text.slice(0, qEnd).trim();
    const rest = text.slice(qEnd).trim();
    if (question.length >= 12) {
      return { heading: safeCardTitle(question), body: rest || "" };
    }
  }

  const sentences = splitIntoCompleteSentences(text);
  if (sentences.length >= 2 && sentences[0].length <= 80) {
    return { heading: safeCardTitle(sentences[0].replace(/\.$/, "")), body: sentences.slice(1).join(" ") };
  }

  return { heading: safeCardTitle(text.replace(/\.$/, "")), body: "" };
}

/** Build a publish-ready feature card from a raw blueprint bullet. */
export function preparePublishFeatureCard(
  raw: string,
  ctx: PublishCardContext,
): { title: string; body: string } | null {
  const split = cardHeadingFromBullet(raw);
  if (!split) return null;

  const title = safeCardTitle(split.heading);
  if (!title || isInternalOnlyLabel(title)) return null;

  const body = safeCardBody(split.body, title, ctx);
  if (rejectLowInformationCard(title, body)) return null;

  return { title, body };
}

export function sanitizeBulletsForPublishCards(bullets: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const b of bullets) {
    const split = cardHeadingFromBullet(b);
    if (!split) continue;
    const key = `${split.heading.toLowerCase()}|${split.body.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(split.body ? `${split.heading}: ${split.body}` : split.heading);
  }
  return out;
}

/** Hero intro — strip blueprint labels and ensure a complete sentence for publish. */
export function publishHeroIntro(text: string): string {
  return ensureCompleteSentence(stripBlueprintLabels(stripEllipsisFromBodyText(text)));
}
