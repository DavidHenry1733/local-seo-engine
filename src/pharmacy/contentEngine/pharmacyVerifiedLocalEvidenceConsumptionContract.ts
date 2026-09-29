/**
 * Canonical verified local-evidence consumption contract.
 * Locality generation and the patient-copy evidence gate both use this module.
 * It chooses which stored facts must appear, and it recognises those facts in
 * visible copy after normal HTML escaping.
 */

export const VERIFIED_LOCAL_EVIDENCE_PATIENT_COPY_SLOT_LIMIT = 3;

export const VERIFIED_LOCAL_EVIDENCE_REQUIRED_CATEGORIES = ["healthcare", "transport"] as const;

export const VERIFIED_LOCAL_EVIDENCE_SUPPORTING_CATEGORIES = [
  "landmarks",
  "community",
  "schools",
  "retail",
] as const;

export type VerifiedLocalEvidenceCategory =
  | (typeof VERIFIED_LOCAL_EVIDENCE_REQUIRED_CATEGORIES)[number]
  | (typeof VERIFIED_LOCAL_EVIDENCE_SUPPORTING_CATEGORIES)[number];

export type VerifiedLocalEvidenceFact = {
  name: string;
  category: VerifiedLocalEvidenceCategory;
};

export type VerifiedLocalEvidenceConsumption = {
  selected: VerifiedLocalEvidenceFact[];
  required: VerifiedLocalEvidenceFact[];
};

const KNOWN_CATEGORIES = new Set<string>([
  ...VERIFIED_LOCAL_EVIDENCE_REQUIRED_CATEGORIES,
  ...VERIFIED_LOCAL_EVIDENCE_SUPPORTING_CATEGORIES,
]);

function isKnownCategory(category: string): category is VerifiedLocalEvidenceCategory {
  return KNOWN_CATEGORIES.has(category);
}

/** Plain text after one HTML-entity decode, apostrophe folding, and whitespace collapse. */
export function normalizeVerifiedEvidenceText(value: string): string {
  let text = String(value || "");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex: string) => decodeCodePoint(entity, Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (entity, dec: string) => decodeCodePoint(entity, Number(dec)))
    .replace(/&amp;/gi, "&");
  text = text.replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D]/g, '"');
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function decodeCodePoint(entity: string, codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return entity;
  return String.fromCodePoint(codePoint);
}

function stripNonVisibleRegions(html: string): string {
  let source = String(html || "");
  source = source.replace(/<!--[\s\S]*?-->/g, " ");
  source = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  source = source.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const hidden =
    /<([a-zA-Z0-9]+)\b[^>]*\b(?:hidden(?=[\s=/>])|aria-hidden\s*=\s*(["'])true\2|style\s*=\s*(["'])[^"']*display\s*:\s*none[^"']*\3|class\s*=\s*(["'])[^"']*\b(?:visually-hidden|sr-only)\b[^"']*\4)[^>]*>[\s\S]*?<\/\1>/gi;
  let previous = "";
  while (source !== previous) {
    previous = source;
    source = source.replace(hidden, " ");
  }
  return source.replace(/<[^>]+>/g, " ");
}

/** Visible patient-facing text. Hidden, script, style, and comment text is excluded. */
export function visiblePatientFacingText(html: string): string {
  return normalizeVerifiedEvidenceText(stripNonVisibleRegions(html));
}

export function visibleCopyContainsVerifiedEvidenceName(html: string, name: string): boolean {
  const needle = normalizeVerifiedEvidenceText(name);
  if (needle.length < 3) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(visiblePatientFacingText(html));
}

export function visibleCopyContainsRequiredVerifiedEvidence(html: string, names: readonly string[]): boolean {
  return names.every((name) => visibleCopyContainsVerifiedEvidenceName(html, name));
}

/**
 * Facts that locality copy must be able to show.
 * When healthcare or transport evidence exists, the first healthcare fact
 * (or the first transport fact when there is no healthcare) is required and
 * occupies a slot before landmarks, community, or other supporting facts.
 */
export function selectVerifiedLocalEvidenceForPatientCopy(
  facts: readonly { name: string; category: string }[],
): VerifiedLocalEvidenceConsumption {
  const accepted: VerifiedLocalEvidenceFact[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    const category = String(fact.category || "").trim();
    if (!isKnownCategory(category)) continue;
    const name = String(fact.name || "").trim().replace(/\s+/g, " ");
    const key = normalizeVerifiedEvidenceText(name);
    if (key.length < 3 || seen.has(key)) continue;
    seen.add(key);
    accepted.push({ name, category });
  }

  const mandatory =
    accepted.find((fact) => fact.category === "healthcare") ||
    accepted.find((fact) => fact.category === "transport") ||
    null;

  const supportingOrder: VerifiedLocalEvidenceCategory[] = [
    "landmarks",
    "community",
    "schools",
    "retail",
    "transport",
    "healthcare",
  ];
  const supporting: VerifiedLocalEvidenceFact[] = [];
  for (const category of supportingOrder) {
    for (const fact of accepted) {
      if (fact.category !== category) continue;
      if (mandatory && normalizeVerifiedEvidenceText(fact.name) === normalizeVerifiedEvidenceText(mandatory.name)) {
        continue;
      }
      supporting.push(fact);
    }
  }

  const selected: VerifiedLocalEvidenceFact[] = [];
  if (mandatory) selected.push(mandatory);
  for (const fact of supporting) {
    if (selected.length >= VERIFIED_LOCAL_EVIDENCE_PATIENT_COPY_SLOT_LIMIT) break;
    selected.push(fact);
  }
  return { selected, required: mandatory ? [mandatory] : [] };
}

export function joinVerifiedLocalEvidenceNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Visible sentence used when stored local facts are included in locality access copy. */
export function verifiedLocalEvidencePatientCopySentence(names: readonly string[]): string {
  if (!names.length) return "";
  return `Useful stored local context for this journey includes ${joinVerifiedLocalEvidenceNames(names)}.`;
}

/** True when every fact this contract requires is present in visible patient-facing copy. */
export function pageConsumesRequiredVerifiedLocalEvidence(
  html: string,
  facts: readonly { name: string; category: string }[],
): boolean {
  const consumption = selectVerifiedLocalEvidenceForPatientCopy(facts);
  return visibleCopyContainsRequiredVerifiedEvidence(
    html,
    consumption.required.map((fact) => fact.name),
  );
}
