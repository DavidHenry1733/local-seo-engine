/**
 * Fail-closed patient-copy quality gate for locality cluster pages.
 * Shared production logic — no tenant-specific conditionals.
 */
export type LocalityPatientCopyGateResult = {
  ok: boolean;
  failures: string[];
};

const INTERNAL_PHRASES: RegExp[] = [
  /\bprimary locality\b/i,
  /\bdesignated locality\b/i,
  /\bstored profile\b/i,
  /\bselected localities\b/i,
  /\bselected set\b/i,
  /\branks?\s+\d+\s+of\s+\d+\b/i,
  /\branked by distance\b/i,
  /\bdistance file\b/i,
  /\bcomparison set\b/i,
  /\binward\b/i,
  /\boutward\b/i,
  /\bnamed distance roll\b/i,
  /\bcatchment\b/i,
  /\blocality evidence\b/i,
  /\bevidence pack\b/i,
  /\bnearby-context\b/i,
  /\bplanning aid\b/i,
  /\bvariation family\b/i,
  /\bcontent differentiation\b/i,
  /\bfunding remains unconfirmed\b/i,
  /\barrangement rules\b/i,
  /\bprovenance\b/i,
  /\bmid-list\b/i,
  /\bouter-mid\b/i,
  /\bnear-edge\b/i,
  /\bedge-of-set\b/i,
  /\bedge ledger\b/i,
  /\bstraight-line aid\b/i,
  /\bsibling\b/i,
  /\brank-\d+\b/i,
  /\bdistance roll\b/i,
  /\bselectedAreas\b/i,
  /\bsignposts?\b/i,
  /\bsignposting\b/i,
  /\bemergency signposting\b/i,
  /\bfacts on file\b/i,
  /\bhaversine\b/i,
];

/** Fail-closed operational and clinical claims for approved-service locality copy. */
export const UNSAFE_LOCALITY_PATIENT_COPY_RULES: Array<{ id: string; re: RegExp }> = [
  { id: "placeholder-opening-hours", re: /contact the pharmacy to confirm current opening hours/i },
  { id: "placeholder-opening-hours-touch", re: /confirm when you get in touch/i },
  { id: "book-or-walk-in", re: /\bbook or walk[- ]?in\b/i },
  { id: "walk-ins-welcome", re: /\bwalk-?ins?\s+welcome\b/i },
  { id: "walk-in-assumption", re: /\bwalk-?ins?\b/i },
  { id: "book-an-appointment", re: /\bbook an appointment\b/i },
  { id: "appointments-available", re: /\bappointments available\b/i },
  { id: "appointment-tips", re: /\bappointment tips\b/i },
  { id: "triage-and-booking", re: /\btriage and booking\b/i },
  { id: "booking-options", re: /\bbooking options\b/i },
  { id: "invented-duration-range", re: /\btypically\s+\d+\s*[–-]\s*\d+\s*minutes?\b/i },
  { id: "invented-duration-typical", re: /\b\d+\s*[–-]\s*\d+\s*minutes?\s+(?:typical|including)\b/i },
  { id: "invented-duration-allow", re: /\ballow(?:\s+\d+)?\s+\d+\s*minutes?\b/i },
  { id: "invented-duration-minutes-typical", re: /\b\d+\s*[–-]\s*\d+\s*minutes?\s+typical\b/i },
  { id: "supply-where-appropriate", re: /\bsupply where appropriate\b/i },
  { id: "treatment-or-referral", re: /\btreatment or referral\b/i },
  { id: "treatment-or-supply", re: /\btreatment or supply\b/i },
  { id: "referral-if-needed", re: /\breferral if needed\b/i },
  { id: "treatment-is-supplied", re: /\btreatment is supplied\b/i },
  { id: "treatment-where-appropriate", re: /\btreatment where appropriate\b/i },
  { id: "treatment-advice-or-referral", re: /\btreatment,\s*advice or referral\b/i },
  { id: "get-treatment", re: /\bget treatment\b/i },
  { id: "you-may-receive-treatment", re: /\byou may receive treatment\b/i },
  { id: "safe-referral", re: /\bsafe referral\b/i },
  { id: "emergency-signposting", re: /\bemergency signposting\b/i },
  { id: "photo-id", re: /\bphoto\s*id\b/i },
  { id: "no-antibiotics-if-inappropriate", re: /\bno antibiotics if inappropriate\b/i },
  { id: "guaranteed-outcome", re: /\bguaranteed\b/i },
];

type LocalitySourcePack = {
  intro?: Array<{ body?: string }>;
  problem?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  benefits?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  eligibility?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  howItWorks?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  treatmentProcess?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  preparationGuide?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  trustSafety?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  patientEducation?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  mythVsFact?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  patientOutcomes?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
  cta?: Array<{ primary?: string; secondary?: string; phonePrompt?: string; bookingPrompt?: string }>;
  faqs?: Array<{ question?: string; answer?: string }>;
  localityPage?: {
    overviewHeading?: string;
    overviewParagraphs?: string[];
    overviewBullets?: string[];
    considerHeading?: string;
    considerBody?: string;
    considerBullets?: string[];
    scopeHeading?: string;
    scopeBody?: string;
    scopeBullets?: string[];
    processHeading?: string;
    processBody?: string;
    processSteps?: Array<{ heading?: string; body?: string; bullets?: string[] }>;
    preparationHeading?: string;
    preparationBody?: string;
    preparationBullets?: string[];
    safetyHeading?: string;
    safetyBody?: string;
    safetyBullets?: string[];
    faqs?: Array<{ question?: string; answer?: string }>;
  };
};

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countPhrase(text: string, phrase: string): number {
  if (!phrase) return 0;
  const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (text.match(re) || []).length;
}

function extractFaqQuestions(html: string): string[] {
  return [...html.matchAll(/<(?:h[23]|p)[^>]*class="[^"]*faq-q[^"]*"[^>]*>([\s\S]*?)<\/(?:h[23]|p)>/gi)].map((m) =>
    stripHtml(m[1] || ""),
  );
}

function localityPrefixedFaqFailures(questions: string[], areaName?: string): string[] {
  const failures: string[] = [];
  const area = String(areaName || "").trim();
  const areaRe = area
    ? new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : null;
  for (const q of questions) {
    const text = String(q || "").trim();
    if (!text) continue;
    if (/^for\s+.+\s+residents:/i.test(text)) {
      failures.push(`locality-prefixed-faq:${text.slice(0, 80)}`);
      continue;
    }
    if (areaRe && area) {
      const esc = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prefixed = [
        new RegExp(`^for\\s+${esc}\\s+residents:`, "i"),
        new RegExp(`^${esc}\\s+patients\\s+[—–-]`, "i"),
        new RegExp(`^local guidance for\\s+${esc}:`, "i"),
        new RegExp(`^${esc}\\s+pharmacy access\\s+[—–-]`, "i"),
        new RegExp(`^${esc}\\s+[—–-]`, "i"),
      ];
      if (prefixed.some((re) => re.test(text))) {
        failures.push(`locality-prefixed-faq:${text.slice(0, 80)}`);
      }
    }
  }
  return failures;
}

function maskVerifiedEvidenceNames(text: string, names: readonly string[]): string {
  const ordered = names
    .map((name) => String(name || "").trim())
    .filter((name) => name.length >= 3)
    .sort((a, b) => b.length - a.length);
  let out = String(text || "");
  for (const name of ordered) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    out = out.replace(new RegExp(escaped, "gi"), " ");
  }
  return out;
}

function scanUnsafePatientCopy(text: string, prefix: string): string[] {
  const failures: string[] = [];
  const hay = String(text || "");
  for (const rule of UNSAFE_LOCALITY_PATIENT_COPY_RULES) {
    if (rule.re.test(hay)) {
      failures.push(`${prefix}${rule.id}`);
    }
  }
  return failures;
}

/** Fail-closed replacements aligned to UNSAFE_LOCALITY_PATIENT_COPY_RULES. */
export function scrubUnsafeLocalityPatientCopyHtml(html: string): string {
  return String(html || "")
    .replace(/\bwalk-in availability or booking options\b/gi, "how a consultation is arranged")
    .replace(/\bwalk-in options or booking\b/gi, "how a consultation is arranged")
    .replace(/\bwalk-in or booking options\b/gi, "how a consultation is arranged")
    .replace(/\bwalk-ins?\s+welcome\b/gi, "patients can ask about a consultation")
    .replace(/>Book An Appointment</gi, ">Contact the pharmacy<")
    .replace(/\bbook an appointment\b/gi, "contact the pharmacy")
    .replace(/\bbooking options\b/gi, "how a consultation is arranged")
    .replace(/\btreatment, advice or referral\b/gi, "the safest next step")
    .replace(/\bAdvice, treatment or referral\b/gi, "Clear next steps")
    .replace(/\btreatment or referral\b/gi, "a clinically appropriate next step")
    .replace(/\btreatment or supply\b/gi, "pharmacy care")
    .replace(/\btreatment is supplied\b/gi, "pharmacy care is offered")
    .replace(/\btreatment where appropriate\b/gi, "care that meets pathway criteria")
    .replace(/\byou may receive treatment\b/gi, "the pharmacist explains the outcome")
    .replace(/\bget treatment\b/gi, "get pharmacist advice")
    .replace(/\breferral if needed\b/gi, "further care if clinically required");
}

function sectionTexts(
  items: Array<{ heading?: string; body?: string; bullets?: string[] }> | undefined,
): string[] {
  const out: string[] = [];
  for (const item of items || []) {
    if (item.heading) out.push(item.heading);
    if (item.body) out.push(item.body);
    for (const b of item.bullets || []) out.push(b);
  }
  return out;
}

/** Flatten locality pools only — never the locked service-page contract. */
export function collectLocalitySourceText(pack: LocalitySourcePack): {
  text: string;
  faqQuestions: string[];
  variantCount: number;
} {
  const parts: string[] = [];
  let variantCount = 0;
  for (const item of pack.intro || []) {
    variantCount += 1;
    if (item.body) parts.push(item.body);
  }
  const sectionKeys: Array<keyof LocalitySourcePack> = [
    "problem",
    "benefits",
    "eligibility",
    "howItWorks",
    "treatmentProcess",
    "preparationGuide",
    "trustSafety",
    "patientEducation",
    "mythVsFact",
    "patientOutcomes",
  ];
  for (const key of sectionKeys) {
    const items = pack[key] as Array<{ heading?: string; body?: string; bullets?: string[] }> | undefined;
    variantCount += items?.length || 0;
    parts.push(...sectionTexts(items));
  }
  for (const item of pack.cta || []) {
    variantCount += 1;
    parts.push(item.primary || "", item.secondary || "", item.phonePrompt || "", item.bookingPrompt || "");
  }
  const faqQuestions: string[] = [];
  for (const faq of pack.faqs || []) {
    variantCount += 1;
    if (faq.question) {
      faqQuestions.push(faq.question);
      parts.push(faq.question);
    }
    if (faq.answer) parts.push(faq.answer);
  }
  const locality = pack.localityPage;
  if (locality) {
    variantCount += 1;
    parts.push(
      locality.overviewHeading || "",
      ...(locality.overviewParagraphs || []),
      ...(locality.overviewBullets || []),
      locality.considerHeading || "",
      locality.considerBody || "",
      ...(locality.considerBullets || []),
      locality.scopeHeading || "",
      locality.scopeBody || "",
      ...(locality.scopeBullets || []),
      locality.processHeading || "",
      locality.processBody || "",
      locality.preparationHeading || "",
      locality.preparationBody || "",
      ...(locality.preparationBullets || []),
      locality.safetyHeading || "",
      locality.safetyBody || "",
      ...(locality.safetyBullets || []),
    );
    parts.push(...sectionTexts(locality.processSteps));
    variantCount += locality.processSteps?.length || 0;
    for (const faq of locality.faqs || []) {
      variantCount += 1;
      if (faq.question) {
        faqQuestions.push(faq.question);
        parts.push(faq.question);
      }
      if (faq.answer) parts.push(faq.answer);
    }
  }
  return { text: parts.filter(Boolean).join("\n"), faqQuestions, variantCount };
}

/**
 * Scan reusable locality source pools before generation.
 * Does not inspect embedded service-page contracts.
 */
export function evaluateLocalitySourceCopyQualityGate(pack: LocalitySourcePack): LocalityPatientCopyGateResult {
  const failures: string[] = [];
  const collected = collectLocalitySourceText(pack);
  for (const re of INTERNAL_PHRASES) {
    if (re.test(collected.text)) {
      failures.push(`internal-phrase:${re.source}`);
    }
  }
  failures.push(...scanUnsafePatientCopy(collected.text, "source-claim:"));
  failures.push(...localityPrefixedFaqFailures(collected.faqQuestions));
  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

function extractLeadParagraphs(html: string): string {
  const bits: string[] = [];
  const hero = html.match(
    /<section\b[^>]*(?:data-template-block="hero"|class="[^"]*hero)[^>]*>[\s\S]*?<\/section>/i,
  );
  if (hero) {
    const intros = [
      ...hero[0].matchAll(/<p\b[^>]*class="[^"]*(?:hero-intro|lead|intro)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi),
    ];
    if (intros.length) {
      bits.push(...intros.map((m) => stripHtml(m[1] || "")));
    } else {
      const firstP = hero[0].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
      if (firstP) bits.push(stripHtml(firstP[1] || ""));
    }
  }
  for (const re of [
    /<section\b[^>]*id="cluster-context"[^>]*>[\s\S]*?<\/section>/i,
    /<section\b[^>]*id="cluster-relevance"[^>]*>[\s\S]*?<\/section>/i,
    /<section\b[^>]*data-template-block="local-relevance"[^>]*>[\s\S]*?<\/section>/i,
    /<section\b[^>]*id="child-areas"[^>]*>[\s\S]*?<\/section>/i,
    /<section\b[^>]*id="cluster-consultation"[^>]*>[\s\S]*?<\/section>/i,
    /<section\b[^>]*id="local-access"[^>]*>[\s\S]*?<\/section>/i,
  ]) {
    const block = html.match(re)?.[0] || "";
    if (!block) continue;
    const head = block.match(/<div class="section-head[^"]*">([\s\S]*?)<\/div>/i)?.[1] || "";
    const headText = stripHtml(head);
    if (headText) bits.push(headText);
    const lead = block.match(/<p class="local-intro-lead">([\s\S]*?)<\/p>/i)?.[1] || "";
    const leadText = stripHtml(lead);
    // Access/cluster leads are nested inside .section-head; do not count that copy twice.
    if (leadText && !headText.includes(leadText)) bits.push(leadText);
  }
  return bits
    .map((b) => {
      const t = String(b || "").replace(/\s+/g, " ").trim();
      if (!t) return "";
      return /[.!?]$/.test(t) ? t : `${t}.`;
    })
    .filter(Boolean)
    .join(" ");
}

/**
 * Validate customer-facing locality HTML after generation.
 */
export function evaluateLocalityPatientCopyQualityGate(input: {
  html: string;
  areaName: string;
  pharmacyName: string;
  distanceLabel?: string;
  /** Verified place names that must be allowed to appear. They are not operational claims. */
  verifiedEvidenceNames?: readonly string[];
}): LocalityPatientCopyGateResult {
  const failures: string[] = [];
  const html = String(input.html || "");
  const area = String(input.areaName || "").trim();
  const pharmacy = String(input.pharmacyName || "").trim();
  const dist = String(input.distanceLabel || "").trim();
  const verifiedNames = input.verifiedEvidenceNames || [];

  const localitySurface = extractLeadParagraphs(html);
  const mainScan = stripHtml((html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i) || [])[0] || html);
  const claimScan = maskVerifiedEvidenceNames(mainScan, verifiedNames);
  const surfaceClaimScan = maskVerifiedEvidenceNames(localitySurface, verifiedNames);

  for (const re of INTERNAL_PHRASES) {
    if (re.test(mainScan)) {
      failures.push(`internal-phrase:${re.source}`);
    }
  }
  failures.push(...scanUnsafePatientCopy(claimScan, "unsupported-claim:"));
  failures.push(...localityPrefixedFaqFailures(extractFaqQuestions(html), area));

  const kmHits = localitySurface.match(/\b\d+(?:\.\d+)?\s*km\b/gi) || [];
  if (kmHits.length > 1) {
    failures.push(`distance-repeated:${kmHits.length}`);
  }

  if (pharmacy) {
    const narrativeNameCount = countPhrase(localitySurface, pharmacy);
    if (narrativeNameCount > 2) {
      failures.push(`pharmacy-name-overuse:${narrativeNameCount}`);
    }
  }

  if (dist) {
    const distCount = countPhrase(localitySurface, dist);
    if (distCount > 1) {
      failures.push(`distance-label-overuse:${distCount}`);
    }
  }

  for (const s of sentences(localitySurface)) {
    const wc = s.split(/\s+/).filter(Boolean).length;
    if (wc > 40) {
      failures.push(`long-sentence:${wc}:${s.slice(0, 60)}`);
    }
  }

  const unsupported = [
    /\bfree parking\b/i,
    /\bparking is available\b/i,
    /\bon-site parking\b/i,
    /\bbus route\b/i,
    /\btravel time\b/i,
    /\b\d+\s*minutes?\s+(?:away|drive|walk|journey)\b/i,
    /\bwalk-?ins?\s+welcome\b/i,
    /\bfree NHS\b/i,
    /\bguaranteed\b/i,
    /\bdemographics?\b/i,
    /\bpopulation of\b/i,
  ];
  for (const re of unsupported) {
    if (re.test(surfaceClaimScan)) {
      failures.push(`unsupported-claim:${re.source}`);
    }
  }

  if (area) {
    const stuffed = (
      localitySurface.match(
        new RegExp(
          `blood pressure checks[^.?]{0,40}${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "gi",
        ),
      ) || []
    ).length;
    if (stuffed > 3) {
      failures.push(`keyword-stuffing:${stuffed}`);
    }
  }

  if (/\b(ledger|comparison set|distance roll|rank-\d+)\b/i.test(mainScan)) {
    failures.push("forced-uniqueness-filler");
  }

  if (/\{\{[a-z0-9._-]+\}\}|%%[A-Z0-9_]+%%|TODO:|FIXME:|lorem ipsum/i.test(mainScan)) {
    failures.push("unresolved-placeholder");
  }

  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) =>
    stripHtml(m[1] || "").toLowerCase().replace(/\s+/g, " ").trim(),
  ).filter((h) => h.length > 3);
  const headingSeen = new Set<string>();
  for (const heading of headings) {
    if (headingSeen.has(heading)) failures.push(`duplicate-heading:${heading.slice(0, 60)}`);
    headingSeen.add(heading);
  }

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) =>
    stripHtml(m[1] || "").toLowerCase().replace(/\s+/g, " ").trim(),
  ).filter((p) => p.split(/\s+/).length >= 8);
  const paraSeen = new Set<string>();
  for (const para of paragraphs) {
    const key = area ? para.replace(new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "{area}") : para;
    if (paraSeen.has(key)) failures.push(`duplicate-paragraph:${key.slice(0, 60)}`);
    paraSeen.add(key);
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function localityIntroductionsAreDistinct(
  aHtml: string,
  bHtml: string,
  aName: string,
  bName: string,
): boolean {
  const introOf = (html: string) => {
    const hero =
      html.match(
        /<section\b[^>]*(?:data-template-block="hero"|class="[^"]*hero)[^>]*>[\s\S]*?<\/section>/i,
      )?.[0] || "";
    const p = hero.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    return stripHtml(p?.[1] || "");
  };
  const accessOf = (html: string) => {
    const lead =
      html.match(/<p class="local-intro-lead">([\s\S]*?)<\/p>/i)?.[1] ||
      html.match(
        /<section\b[^>]*id="local-access"[^>]*>[\s\S]*?<div class="section-head[^"]*">([\s\S]*?)<\/div>/i,
      )?.[1] ||
      "";
    return stripHtml(lead);
  };

  const norm = (text: string, name: string) =>
    text
      .toLowerCase()
      .replace(new RegExp(name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "{area}")
      .replace(/\b\d+(?:\.\d+)?\s*km\b/g, "{dist}")
      .replace(/\s+/g, " ")
      .trim();

  const introA = introOf(aHtml);
  const introB = introOf(bHtml);
  const accessA = accessOf(aHtml);
  const accessB = accessOf(bHtml);

  if (introA && introB && norm(introA, aName) === norm(introB, bName)) return false;
  if (accessA && accessB && norm(accessA, aName) === norm(accessB, bName)) return false;
  return true;
}
