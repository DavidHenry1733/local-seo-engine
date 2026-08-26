/**
 * Pre-review locality-page duplication gate.
 * Compares substantive sections after removing unavoidable shared chrome.
 * Does not fail on shared clinical, navigation, or footer copy.
 */
import fs from "node:fs";
import path from "node:path";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { copySimilarityScore } from "./pharmacyLocalClusterVariantFamilies.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const LOCALITY_NEAR_DUPLICATE_THRESHOLD = 0.92;
export const LOCALITY_NAME_SUBSTITUTION_THRESHOLD = 0.97;

export type LocalitySubstantiveSectionId =
  | "seo-title"
  | "meta-description"
  | "h1-intro"
  | "local-relevance"
  | "access"
  | "supporting"
  | "faqs"
  | "cta";

const SUBSTANTIVE_SECTIONS: LocalitySubstantiveSectionId[] = [
  "seo-title",
  "meta-description",
  "h1-intro",
  "local-relevance",
  "access",
  "supporting",
  "faqs",
  "cta",
];

/** Shared clinically accurate / contact-process copy may match across localities. */
const ALLOWED_SHARED_SECTIONS = new Set<LocalitySubstantiveSectionId>([
  "local-relevance",
  "supporting",
  "cta",
  "faqs",
  // Title pattern "… for patients from {area}" is expected name substitution.
  "seo-title",
]);

export type LocalitySectionComparison = {
  section: LocalitySubstantiveSectionId;
  exact: boolean;
  nearDuplicate: boolean;
  nameSubstitution: boolean;
  score: number;
};

export type LocalityPairDuplication = {
  a: string;
  b: string;
  sections: LocalitySectionComparison[];
  blocked: boolean;
  reason: string;
};

export type LocalityDuplicationGateResult = {
  ok: boolean;
  failed: boolean;
  message: string;
  pairs: LocalityPairDuplication[];
  pagesCompared: string[];
};

const SHARED_CLINICAL_PATTERNS: RegExp[] = [
  /sore throat,? earache,? impetigo,? infected insect bites,? shingles,? sinusitis,? and uncomplicated uti in eligible women/gi,
  /breathing difficulties,? chest pain,? severe dehydration,? confusion,? a non-blanching rash,? or any emergency symptoms that make you feel critically unwell/gi,
  /patient group directions?/gi,
  /nhs 111/gi,
  /gphc/gi,
  /seek urgent medical care/gi,
  /eligibility depends on symptoms and nhs pathway criteria/gi,
  /bring a medicines list/gi,
  /private consultation (room|space)/gi,
];

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function matchBlock(html: string, re: RegExp): string {
  return html.match(re)?.[0] || "";
}

export function extractLocalitySubstantiveSections(html: string): Record<LocalitySubstantiveSectionId, string> {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html;
  return {
    "seo-title": stripHtml(html.match(/<title>([^<]+)<\/title>/i)?.[1] || ""),
    "meta-description": stripHtml(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || ""),
    "h1-intro": stripHtml(
      matchBlock(main, /data-template-block=["']hero["'][\s\S]*?<\/section>/i) ||
        `${main.match(/<h1[^>]*>[\s\S]*?<\/h1>/i)?.[0] || ""} ${main.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<p>[\s\S]*?<\/p>/i)?.[0] || ""}`,
    ),
    "local-relevance": stripHtml(matchBlock(main, /data-template-block=["']local-relevance["'][\s\S]*?<\/section>/i)),
    access: stripHtml(
      matchBlock(main, /data-template-block=["']local["'][\s\S]*?<\/section>/i) ||
        matchBlock(main, /id=["']local-access["'][\s\S]*?<\/section>/i),
    ),
    supporting: stripHtml(matchBlock(main, /data-template-block=["']child-areas["'][\s\S]*?<\/section>/i)),
    faqs: stripHtml(matchBlock(main, /data-template-block=["']faq["'][\s\S]*?<\/section>/i)),
    cta: stripHtml(
      [
        matchBlock(html, /data-template-block=["']final-cta["'][\s\S]*?<\/section>/i),
        matchBlock(html, /data-locality-cta[\s\S]*?<\/p>/i),
      ].join(" "),
    ),
  };
}

function stripSharedClinical(text: string): string {
  let out = text;
  for (const re of SHARED_CLINICAL_PATTERNS) out = out.replace(re, " ");
  return out.replace(/\s+/g, " ").trim();
}

export function normalizeLocalitySectionForGate(
  text: string,
  currentArea: string,
  pharmacyName: string,
): string {
  let out = stripSharedClinical(String(text || "").toLowerCase());
  if (currentArea) out = out.replace(new RegExp(escapeRe(currentArea.toLowerCase()), "g"), "{area}");
  if (pharmacyName) out = out.replace(new RegExp(escapeRe(pharmacyName.toLowerCase()), "g"), "{pharmacy}");
  out = out
    .replace(/\b0\d[\d\s]{8,}\b/g, "{phone}")
    .replace(/\+44[\d\s]{8,}/g, "{phone}")
    .replace(/https?:\/\/\S+/g, "{url}")
    .replace(/\b[a-z]{1,2}\d{1,2}[a-z]?\s*\d[a-z]{2}\b/gi, "{postcode}")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

function tokensForDistinctiveness(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && w !== "area" && w !== "pharmacy" && w !== "phone" && w !== "url" && w !== "postcode")
      .filter((w) => w.length > 2 || /^\d/.test(w)),
  );
}

function hasDistinctiveDifference(a: string, b: string): boolean {
  const ta = tokensForDistinctiveness(a);
  const tb = tokensForDistinctiveness(b);
  let onlyA = 0;
  let onlyB = 0;
  for (const w of ta) if (!tb.has(w)) onlyA++;
  for (const w of tb) if (!ta.has(w)) onlyB++;
  return onlyA + onlyB >= 1;
}

function normalizeForNameSubstitution(
  text: string,
  _areaNames: string[],
  pharmacyName: string,
  currentArea: string,
): string {
  return normalizeLocalitySectionForGate(text, currentArea, pharmacyName);
}

function comparePair(
  aSlug: string,
  bSlug: string,
  aHtml: string,
  bHtml: string,
  aName: string,
  bName: string,
  areaNames: string[],
  pharmacyName: string,
): LocalityPairDuplication {
  const aSections = extractLocalitySubstantiveSections(aHtml);
  const bSections = extractLocalitySubstantiveSections(bHtml);
  const sections: LocalitySectionComparison[] = SUBSTANTIVE_SECTIONS.map((section) => {
    const na = normalizeLocalitySectionForGate(aSections[section], aName, pharmacyName);
    const nb = normalizeLocalitySectionForGate(bSections[section], bName, pharmacyName);
    const score = !na || !nb ? 0 : na === nb ? 1 : copySimilarityScore(na, nb);
    const nameA = normalizeForNameSubstitution(aSections[section], areaNames, pharmacyName, aName);
    const nameB = normalizeForNameSubstitution(bSections[section], areaNames, pharmacyName, bName);
    const nameScore = !nameA || !nameB ? 0 : nameA === nameB ? 1 : copySimilarityScore(nameA, nameB);
    const distinctive = hasDistinctiveDifference(na, nb);
    return {
      section,
      exact: Boolean(na && nb && na === nb),
      nearDuplicate: !distinctive && score >= LOCALITY_NEAR_DUPLICATE_THRESHOLD,
      nameSubstitution:
        !distinctive && Boolean(nameA && nameB) && nameScore >= LOCALITY_NAME_SUBSTITUTION_THRESHOLD,
      score: Number(score.toFixed(3)),
    };
  });

  const exactHits = sections
    .filter((s) => s.exact && !ALLOWED_SHARED_SECTIONS.has(s.section))
    .map((s) => s.section);
  const nearHits = sections
    .filter((s) => s.nearDuplicate && !ALLOWED_SHARED_SECTIONS.has(s.section))
    .map((s) => s.section);
  const nameHits = sections
    .filter((s) => s.nameSubstitution && !ALLOWED_SHARED_SECTIONS.has(s.section))
    .map((s) => s.section);
  // Core patient-facing locality blocks that must differ beyond name substitution.
  const core = ["h1-intro", "access"] as LocalitySubstantiveSectionId[];
  const coreNear = core.every((id) => sections.find((s) => s.section === id)?.nearDuplicate);
  const coreNameOnly = core.every((id) => sections.find((s) => s.section === id)?.nameSubstitution);
  const blocked =
    exactHits.length >= 2 ||
    nearHits.length >= 3 ||
    nameHits.length >= 3 ||
    coreNear ||
    coreNameOnly;

  let reason = "";
  if (blocked) {
    const pair = `${aSlug} / ${bSlug}`;
    if (coreNameOnly || (coreNear && nameHits.includes("h1-intro"))) {
      reason = `Locality pages ${pair} have near-duplicate intro/access after locality-name normalisation.`;
    } else if (nameHits.length >= 3) {
      reason = `Locality pages ${pair} differ primarily by locality-name substitution in ${nameHits.join(", ")}.`;
    } else if (coreNear) {
      reason = `Locality pages ${pair} have near-duplicate intro and access sections.`;
    } else if (exactHits.length >= 2) {
      reason = `Locality pages ${pair} have exact duplicate substantive sections: ${exactHits.join(", ")}.`;
    } else {
      reason = `Locality pages ${pair} have near-duplicate substantive sections: ${nearHits.join(", ")}.`;
    }
  }

  return { a: aSlug, b: bSlug, sections, blocked, reason };
}

export function evaluateLocalityHtmlDuplicationGate(input: {
  pages: Array<{ areaSlug: string; areaName: string; html: string }>;
  pharmacyName: string;
}): LocalityDuplicationGateResult {
  const areaNames = input.pages.map((p) => p.areaName);
  const pairs: LocalityPairDuplication[] = [];
  for (let i = 0; i < input.pages.length; i++) {
    for (let j = i + 1; j < input.pages.length; j++) {
      const a = input.pages[i]!;
      const b = input.pages[j]!;
      pairs.push(
        comparePair(a.areaSlug, b.areaSlug, a.html, b.html, a.areaName, b.areaName, areaNames, input.pharmacyName),
      );
    }
  }
  const failed = pairs.filter((p) => p.blocked);
  const message = failed.length
    ? failed.map((p) => p.reason).join(" ")
    : `Compared ${input.pages.length} locality pages — no exact or near-duplicate substantive sections beyond allowed shared clinical copy.`;
  return {
    ok: failed.length === 0,
    failed: failed.length > 0,
    message,
    pairs,
    pagesCompared: input.pages.map((p) => p.areaSlug),
  };
}

function localPagePath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "local",
    areaSlug,
    "index.html",
  );
}

export function evaluateLocalityPageDuplicationGate(
  slug: string,
  serviceId: string,
  areaNames: string[],
  pharmacyName: string,
): LocalityDuplicationGateResult {
  const key = resolveTenantProfileSlug(slug) || slug;
  const pages = areaNames
    .map((areaName) => {
      const areaSlug = slugifyArea(areaName);
      const file = localPagePath(key, serviceId, areaSlug);
      if (!fs.existsSync(file)) return null;
      return { areaSlug, areaName, html: fs.readFileSync(file, "utf8") };
    })
    .filter(Boolean) as Array<{ areaSlug: string; areaName: string; html: string }>;
  if (pages.length < 2) {
    return {
      ok: true,
      failed: false,
      message: pages.length ? "Fewer than two locality pages — duplication gate skipped." : "No locality pages to compare.",
      pairs: [],
      pagesCompared: pages.map((p) => p.areaSlug),
    };
  }
  return evaluateLocalityHtmlDuplicationGate({ pages, pharmacyName });
}
