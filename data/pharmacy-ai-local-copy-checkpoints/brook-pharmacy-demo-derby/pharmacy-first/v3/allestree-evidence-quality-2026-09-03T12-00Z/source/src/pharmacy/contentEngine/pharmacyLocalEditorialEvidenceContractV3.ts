/**
 * Editorial-evidence contract for Pharmacy First local v3 pilots.
 * Facts are short paraphrases with provenance. Do not store copyrighted passages.
 */
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import type { GeographicEvidenceContext } from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { buildDisambiguatedEvidenceQuery } from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import type { LocalEvidenceEntity, PharmacyLocalEvidencePackV3 } from "./pharmacyLocalEvidencePackContractV1.ts";

export const EDITORIAL_EVIDENCE_CONTRACT_ID = "pharmacy-local-editorial-evidence-v3";
export const EDITORIAL_EVIDENCE_VERSION = "v3";
export const EDITORIAL_EVIDENCE_DIRNAME =
  "data/pharmacy-local-editorial-evidence-pilots";
export const EDITORIAL_PILOT_AREAS = ["darfield", "wombwell", "worsbrough"] as const;
export const MAX_SEARCHES_PER_AREA = 3;
export const MAX_PAGE_RETRIEVALS_PER_AREA = 3;
export const MAX_COMBINED_EXTERNAL_COST_USD = 2;

export type EditorialFactCategory =
  | "area-identity"
  | "community"
  | "healthcare"
  | "access-transport"
  | "heritage"
  | "pharmacy-relationship";

export type PermittedCopyRole =
  | "area-introduction"
  | "neutral-community-context"
  | "healthcare-context"
  | "access-context"
  | "local-faq";

export type EditorialFactV3 = {
  factId: string;
  area: string;
  areaSlug: string;
  category: EditorialFactCategory;
  normalizedStatement: string;
  sourceTitle: string;
  sourceUrl: string;
  publisher: string;
  retrievedAt: string;
  sourceClass: "primary" | "secondary";
  corroboratingSource: { title: string; url: string; publisher: string } | null;
  confidence: "high" | "medium" | "low";
  usefulnessToPharmacyFirstReader: string;
  permittedCopyRole: PermittedCopyRole;
  prohibitedInference: string;
  validationStatus: "accepted" | "rejected";
};

export type EditorialSearchRecordV3 = {
  topic: string;
  query: string;
  disambiguated: boolean;
  costUsd: number;
  resultCount: number;
  capturedAt: string;
  provider: "dataforseo";
};

export type EditorialRetrievedPageV3 = {
  url: string;
  title: string;
  publisher: string;
  sourceClass: "primary" | "secondary" | "rejected";
  status: number | null;
  retrievedAt: string;
  textSample?: string;
};

export type EditorialSufficiencyV3 = {
  status: "READY" | "EVIDENCE LIMITED";
  intro: boolean;
  localContext: boolean;
  relationshipAccess: boolean;
  faq: boolean;
  reasons: string[];
  acceptedFactCount: number;
  placesEntityCount: number;
};

export type EditorialEvidencePackV3 = {
  contractId: string;
  version: string;
  slug: string;
  area: string;
  areaSlug: string;
  collectedAt: string;
  geographicContext: {
    areaName: string;
    parentTown: string;
    county: string;
    country: string;
    queryPlaceLabel: string;
  };
  searches: EditorialSearchRecordV3[];
  retrievedPages: EditorialRetrievedPageV3[];
  rejectedSources: Array<{ url: string; reason: string }>;
  facts: EditorialFactV3[];
  sufficiency: EditorialSufficiencyV3;
  costUsd: number;
};

export function editorialEvidencePackPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    EDITORIAL_EVIDENCE_DIRNAME,
    slug,
    serviceId,
    EDITORIAL_EVIDENCE_VERSION,
    `${areaSlug}.json`,
  );
}

const REJECT_HOST_FRAGMENTS = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "reddit.com",
  "nextdoor.",
  "tripadvisor.",
  "trustpilot.",
  "yell.com",
  "cylex",
  "thomsonlocal",
  "192.com",
  "hotfrog",
  "pinterest.",
  "wikipedia.org",
  "wikidata.org",
  "chatgpt.com",
  "perplexity.ai",
  "boots.com",
  "well.co.uk",
  "lloydspharmacy",
  "superdrug.com",
  "directories",
  "yelp.",
  "foursquare.",
];

const DIRECTORY_OR_DOORWAY =
  /\b(find a (?:gp|doctor|pharmacy)|gp near you|local directory|business directory|top \d+ (?:gps|pharmacies)|best pharmacies in)\b/i;

export type SourceClassResult = {
  class: "primary" | "secondary" | "rejected";
  publisher: string;
  reason: string;
};

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function classifyEditorialSource(
  url: string,
  title = "",
  snippet = "",
): SourceClassResult {
  const host = hostFromUrl(url);
  const hay = `${title} ${snippet} ${url}`.toLowerCase();
  if (!host) return { class: "rejected", publisher: "", reason: "unparseable-url" };
  if (REJECT_HOST_FRAGMENTS.some((frag) => host.includes(frag) || url.toLowerCase().includes(frag))) {
    return { class: "rejected", publisher: host, reason: "disallowed-host" };
  }
  if (DIRECTORY_OR_DOORWAY.test(hay) && !host.endsWith(".nhs.uk") && !host.endsWith(".gov.uk")) {
    return { class: "rejected", publisher: host, reason: "directory-or-doorway" };
  }
  if (/\b(forum|comment thread|review of)\b/i.test(hay) && !host.endsWith(".nhs.uk")) {
    return { class: "rejected", publisher: host, reason: "forum-or-review" };
  }
  if (host.endsWith(".nhs.uk") || host === "nhs.uk") {
    return { class: "primary", publisher: "NHS", reason: "official-healthcare" };
  }
  if (host.endsWith(".gov.uk")) {
    return { class: "primary", publisher: host, reason: "local-authority-or-government" };
  }
  if (host === "nationalrail.co.uk" || host.endsWith(".nationalrail.co.uk")) {
    return { class: "primary", publisher: "National Rail", reason: "official-public-transport" };
  }
  if (host === "northernrailway.co.uk" || host.endsWith(".northernrailway.co.uk")) {
    return { class: "primary", publisher: "Northern", reason: "official-public-transport-operator" };
  }
  if (host === "travelsouthyorkshire.com" || host.endsWith(".travelsouthyorkshire.com")) {
    return { class: "primary", publisher: "Travel South Yorkshire", reason: "official-public-transport" };
  }
  if (host === "stagecoachbus.com" || host.endsWith(".stagecoachbus.com")) {
    return { class: "primary", publisher: "Stagecoach", reason: "official-public-transport-operator" };
  }
  if (host === "historicengland.org.uk" || host.endsWith(".historicengland.org.uk")) {
    return { class: "primary", publisher: "Historic England", reason: "official-heritage" };
  }
  if (host === "canalrivertrust.org.uk") {
    return { class: "primary", publisher: "Canal & River Trust", reason: "official-heritage" };
  }
  return { class: "rejected", publisher: host, reason: "not-authoritative-primary" };
}

export function isQueryGeographicallyDisambiguated(
  query: string,
  geo: Pick<GeographicEvidenceContext, "areaName" | "parentTown" | "county" | "country" | "countryCode" | "queryPlaceLabel">,
): boolean {
  const q = query.toLowerCase();
  const area = geo.areaName.trim().toLowerCase();
  if (!area || q === area || q === `"${area}"`) return false;
  if (!q.includes(area)) return false;
  const parent = geo.parentTown.trim().toLowerCase();
  const county = geo.county.trim().toLowerCase();
  const country = (geo.country || "").trim().toLowerCase();
  const countryCode = (geo.countryCode || "").trim().toLowerCase();
  const countryOk =
    q.includes("england") ||
    q.includes("united kingdom") ||
    /\buk\b/.test(q) ||
    (country && q.includes(country)) ||
    (countryCode === "gb" && /\buk\b/.test(q));
  const parentOk = !parent || q.includes(parent);
  const countyOk = !county || q.includes(county);
  const placeLabel = (geo.queryPlaceLabel || "").toLowerCase();
  const labelOk = placeLabel && q.includes(placeLabel.toLowerCase());
  return Boolean((parentOk && countyOk && countryOk) || labelOk);
}

export function buildEditorialSearchQueries(opts: {
  geo: GeographicEvidenceContext;
  pack: PharmacyLocalEvidencePackV3 | null;
}): Array<{ topic: string; query: string }> {
  const { geo, pack } = opts;
  const healthcare = pack?.healthcare || [];
  const community = pack?.community || [];
  const landmarks = pack?.landmarks || [];
  const transport = pack?.transport || [];
  const millOrPark = landmarks.find((e) => /\b(mill|country park|park)\b/i.test(e.name));
  const library = community.find((e) => /\blibrary\b/i.test(e.name));
  const rail = transport.find((e) => (e.types || []).some((t) => /train_station|transit_station/i.test(t)));

  const communityPhrase = millOrPark
    ? `official council ${millOrPark.name.replace(/industrial heritage monument/i, "Mill Country Park")} heritage`
    : library
      ? `official council ${library.name} community`
      : "official council community information";
  const transportPhrase = rail
    ? "National Rail railway station official"
    : "official public transport information";
  const healthPhrase = healthcare.length
    ? "NHS GP surgery Health Centre official"
    : "NHS healthcare official";

  return [
    { topic: "official-community", query: buildDisambiguatedEvidenceQuery(communityPhrase, geo) },
    { topic: "official-transport", query: buildDisambiguatedEvidenceQuery(transportPhrase, geo) },
    { topic: "official-healthcare", query: buildDisambiguatedEvidenceQuery(healthPhrase, geo) },
  ].slice(0, MAX_SEARCHES_PER_AREA);
}

export const RAW_PROVIDER_LABEL =
  /\bDr\s+[A-Z]\.?\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+-\s+.+/;

export const RAW_COPIED_PASSAGE_MIN_WORDS = 12;

export function looksLikeRawCopiedPassage(statement: string, sourceText: string): boolean {
  const norm = collapseWs(statement);
  const src = collapseWs(sourceText);
  if (!norm || !src) return false;
  if (norm.split(/\s+/).length < RAW_COPIED_PASSAGE_MIN_WORDS) return false;
  return src.toLowerCase().includes(norm.toLowerCase());
}

export function collapseWs(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(value: string): string {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

/** Tokenise hyphenated hosts/paths so "worsbrough-mill" matches "Worsbrough Mill". */
export function tokenizeForGeographicMatch(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/https?:\/\//gi, " ")
    .replace(/[/?#=&._]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hostname pattern only. A hyphenated mill domain does not confer source authority. */
export function isOfficialNamedMillHost(host: string): boolean {
  return /^[a-z0-9-]+-mill\.(com|co\.uk|org|org\.uk)$/i.test(String(host || "").replace(/^www\./, ""));
}

export function hasUsablePageBody(title: string, text: string): boolean {
  const body = collapseWs(decodeHtmlEntities(text));
  const head = collapseWs(decodeHtmlEntities(title));
  if (body.split(/\s+/).filter(Boolean).length < 6) return false;
  if (head && body.toLowerCase() === head.toLowerCase()) return false;
  return true;
}

export const UNSUPPORTED_INFERENCE_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "demographics", re: /\b(young families|elderly population|working-class|affluent)\b/i },
  { id: "patient-behaviour", re: /\b(residents (?:often|usually|tend to)|people (?:here )?often (?:visit|use))\b/i },
  { id: "gp-waiting", re: /\b(gp wait(?:ing)?|hard to book|long wait(?:s|ing)?)\b/i },
  { id: "journey-time", re: /\b(\d+\s*(?:minute|minutes|hour|hours)|drive time|walking time)\b/i },
  { id: "parking", re: /\bparking\b/i },
  { id: "opening-hours", re: /\bopens? at\s+\d|opening hours\b/i },
  { id: "route", re: /\b(route to|orient you towards|from \w+ to \w+ via|travelling to darfield)\b/i },
  { id: "accessibility", re: /\b(wheelchair|step-free|disabled access)\b/i },
  { id: "endorsement", re: /\b(recommended by|endorsed|affiliated|partner(?:ship)? with)\b/i },
  { id: "referral", re: /\b(referral (?:from|to)|works with the pharmacy)\b/i },
  { id: "other-org-availability", re: /\b(appointments available at|same-day gp)\b/i },
  { id: "eligibility-from-location", re: /\b(eligible because you (?:live|are) in)\b/i },
];

export function unsupportedInferencesIn(text: string): string[] {
  return UNSUPPORTED_INFERENCE_PATTERNS.filter((row) => row.re.test(text)).map((row) => row.id);
}

export function isCustomerAppropriateOrganisationName(name: string): boolean {
  const text = String(name || "").trim();
  if (!text) return false;
  if (RAW_PROVIDER_LABEL.test(text)) return false;
  if (/^Dr\s+[A-Z]\.?\s+[A-Za-z]+/i.test(text) && /health centre|practice/i.test(text)) return false;
  if (/\bPractice\b.+\bHealth Centre\b/i.test(text)) return false;
  return true;
}

export function customerFacingPlacesName(entity: LocalEvidenceEntity): string | null {
  if (isCustomerAppropriateOrganisationName(entity.name)) return entity.name.trim();
  const addressHead = String(entity.address || "").split(",")[0]?.trim() || "";
  if (addressHead && isCustomerAppropriateOrganisationName(addressHead) && /\b(Health Centre|Medical Centre|Library|Park|Mill|Station)\b/i.test(addressHead)) {
    return addressHead;
  }
  const healthCentre = entity.address.match(/\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,3}\sHealth Centre)\b/);
  if (healthCentre?.[1] && isCustomerAppropriateOrganisationName(healthCentre[1])) return healthCentre[1];
  return null;
}

export function factIdFor(areaSlug: string, category: string, statement: string): string {
  const slug = collapseWs(statement)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${areaSlug}:${category}:${slug}`;
}

export function assessEditorialSufficiency(opts: {
  facts: EditorialFactV3[];
  placesEntityCount: number;
  pharmacyIsInArea: boolean;
  hasVerifiedDistance: boolean;
}): EditorialSufficiencyV3 {
  const accepted = opts.facts.filter((f) => f.validationStatus === "accepted");
  const webPrimary = accepted.filter(
    (f) => f.sourceClass === "primary" && f.category !== "pharmacy-relationship",
  );
  const identity = accepted.filter(
    (f) =>
      f.category === "area-identity" ||
      f.category === "heritage" ||
      f.category === "community" ||
      (f.category === "access-transport" && /station/i.test(f.normalizedStatement)),
  );
  const context = accepted.filter(
    (f) =>
      f.category === "community" ||
      f.category === "heritage" ||
      f.category === "healthcare" ||
      f.permittedCopyRole === "neutral-community-context" ||
      f.permittedCopyRole === "healthcare-context",
  );
  const access = accepted.filter(
    (f) =>
      f.category === "access-transport" ||
      f.category === "pharmacy-relationship" ||
      f.permittedCopyRole === "access-context",
  );
  const intro = identity.length >= 1 && webPrimary.length >= 1;
  const localContext =
    context.some((f) => f.category !== "pharmacy-relationship" && f.sourceClass === "primary") &&
    webPrimary.length >= 1;
  const relationshipAccess = opts.pharmacyIsInArea || opts.hasVerifiedDistance || access.some((f) => f.category === "pharmacy-relationship");
  const faq = relationshipAccess;
  const distinctWeb = new Set(webPrimary.map((f) => f.category)).size;
  const reasons: string[] = [];
  if (!intro) reasons.push("no attributable identity fact from an authoritative web source");
  if (!localContext) reasons.push("no useful community, heritage or healthcare fact from an authoritative web source");
  if (!relationshipAccess) reasons.push("no verified pharmacy relationship or access fact");
  if (webPrimary.length < 2 || distinctWeb < 1) {
    if (webPrimary.length < 2) reasons.push("fewer than two primary web facts — entity names alone are not sufficient");
  }
  if (opts.placesEntityCount > 0 && webPrimary.length === 0) {
    reasons.push("Places entity count cannot mark an area ready");
  }
  const ready = intro && localContext && relationshipAccess && faq && webPrimary.length >= 2;
  return {
    status: ready ? "READY" : "EVIDENCE LIMITED",
    intro,
    localContext,
    relationshipAccess,
    faq,
    reasons: ready ? ["substantive editorial evidence supports intro, context, access and FAQ"] : [...new Set(reasons)],
    acceptedFactCount: accepted.length,
    placesEntityCount: opts.placesEntityCount,
  };
}

/** UK local-page sufficiency: a GP research attempt may return zero verified practices. */
export function assessUkLocalPageEditorialSufficiency(opts: {
  facts: EditorialFactV3[];
  placesEntityCount: number;
  pharmacyIsInArea: boolean;
  hasVerifiedDistance: boolean;
  verifiedGpPracticeCount: number;
}): EditorialSufficiencyV3 {
  const accepted = opts.facts.filter((f) => f.validationStatus === "accepted");
  const webPrimary = accepted.filter(
    (f) => f.sourceClass === "primary" && f.category !== "pharmacy-relationship",
  );
  const identity = accepted.filter(
    (f) => f.category === "area-identity" || f.category === "heritage" || f.category === "community",
  );
  const context = accepted.filter(
    (f) =>
      f.category === "community" ||
      f.category === "heritage" ||
      f.category === "healthcare" ||
      f.category === "area-identity" ||
      f.permittedCopyRole === "neutral-community-context" ||
      f.permittedCopyRole === "healthcare-context",
  );
  const access = accepted.filter(
    (f) =>
      f.category === "pharmacy-relationship" ||
      f.permittedCopyRole === "access-context",
  );
  const intro = identity.length >= 1 && webPrimary.length >= 1;
  const localContext =
    context.some((f) => f.category !== "pharmacy-relationship" && f.sourceClass === "primary") &&
    webPrimary.length >= 1;
  const relationshipAccess =
    opts.pharmacyIsInArea || opts.hasVerifiedDistance || access.some((f) => f.category === "pharmacy-relationship");
  const reasons: string[] = [];
  if (!intro) reasons.push("no attributable identity fact from an authoritative web source");
  if (!localContext) reasons.push("no useful locality fact from an authoritative web source");
  if (!relationshipAccess) reasons.push("no verified pharmacy relationship or access fact");
  if (opts.placesEntityCount > 0 && webPrimary.length === 0) {
    reasons.push("Places entity count cannot mark an area ready");
  }
  if (opts.verifiedGpPracticeCount === 0) {
    reasons.push("GP research returned zero verified practices — recorded, not a retry");
  }
  const ready = intro && localContext && relationshipAccess && webPrimary.length >= 1;
  return {
    status: ready ? "READY" : "EVIDENCE LIMITED",
    intro,
    localContext,
    relationshipAccess,
    faq: relationshipAccess,
    reasons: ready
      ? opts.verifiedGpPracticeCount === 0
        ? ["required locality and access evidence is present; zero verified GP practices is a valid research outcome"]
        : ["substantive editorial evidence supports intro, context and access"]
      : [...new Set(reasons)],
    acceptedFactCount: accepted.length,
    placesEntityCount: opts.placesEntityCount,
  };
}

export type ExtractedFactDraft = {
  category: EditorialFactCategory;
  normalizedStatement: string;
  permittedCopyRole: PermittedCopyRole;
  usefulnessToPharmacyFirstReader: string;
  prohibitedInference: string;
  confidence: "high" | "medium" | "low";
};

export function extractEditorialFactDrafts(opts: {
  areaName: string;
  title: string;
  text: string;
  sourceClass: "primary" | "secondary";
  publisher: string;
  host: string;
}): ExtractedFactDraft[] {
  const area = opts.areaName.trim();
  const title = decodeHtmlEntities(opts.title);
  const text = decodeHtmlEntities(opts.text);
  if (!hasUsablePageBody(title, text)) return [];
  const hay = `${title} ${text}`;
  const bodyHay = tokenizeForGeographicMatch(text);
  const lower = `${hay} ${bodyHay}`.toLowerCase();
  const areaRe = new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (!areaRe.test(title) && !areaRe.test(text) && !areaRe.test(bodyHay)) return [];
  const drafts: ExtractedFactDraft[] = [];
  const push = (draft: ExtractedFactDraft) => {
    if (looksLikeRawCopiedPassage(draft.normalizedStatement, hay)) return;
    if (unsupportedInferencesIn(draft.normalizedStatement).length) return;
    if (drafts.some((row) => row.normalizedStatement === draft.normalizedStatement)) return;
    drafts.push(draft);
  };

  const escapedArea = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const genericSettlement = text.match(
    new RegExp(
      `${escapedArea}\\s+is\\s+an?\\s+(suburb|ward|village|town|civil parish)\\s+(?:of|in)\\s+([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+){0,3})`,
      "i",
    ),
  );
  if (opts.host.endsWith(".gov.uk") && genericSettlement?.[1] && genericSettlement[2]) {
    const kind = genericSettlement[1].toLowerCase();
    const parent = genericSettlement[2].trim();
    push({
      category: "area-identity",
      normalizedStatement: `${area} is a ${kind} of ${parent}.`,
      permittedCopyRole: "area-introduction",
      usefulnessToPharmacyFirstReader: "Gives the reader a real geographic identity from an official local-authority page.",
      prohibitedInference: "Does not describe residents, routines, or the pharmacy’s catchment.",
      confidence: "high",
    });
  }

  const titleWard = title.match(
    new RegExp(
      `^${escapedArea}\\s+(neighbourhood\\s+ward|ward)\\b(?:\\s*[-–—|]\\s*(.+?))?$`,
      "i",
    ),
  );
  if (opts.host.endsWith(".gov.uk") && titleWard) {
    const kind = /neighbourhood/i.test(titleWard[1] || "") ? "neighbourhood ward" : "ward";
    const authority = String(titleWard[2] || opts.publisher || "")
      .replace(/\s+City Council.*$/i, "")
      .replace(/\s+Borough Council.*$/i, "")
      .replace(/\s+District Council.*$/i, "")
      .replace(/\s+Council.*$/i, "")
      .trim();
    push({
      category: "area-identity",
      normalizedStatement: authority
        ? `${area} is a ${kind} in ${authority}.`
        : `${area} is a local-authority ${kind}.`,
      permittedCopyRole: "area-introduction",
      usefulnessToPharmacyFirstReader: "States the official local-authority geography named on the council page title.",
      prohibitedInference: "A ward name does not describe residents, travel, or healthcare demand.",
      confidence: "high",
    });
  }

  const settlement =
    lower.includes("village") ? "village" : lower.includes("town") ? "town" : lower.includes("suburb") ? "suburb" : lower.includes("ward") ? "ward" : "";
  if (
    opts.host.endsWith(".gov.uk") &&
    settlement &&
    /barnsley/i.test(text) &&
    new RegExp(`${area}.{0,80}${settlement}|${settlement}.{0,80}${area}`, "i").test(`${title} ${text}`)
  ) {
    push({
      category: "area-identity",
      normalizedStatement: `${area} is a ${settlement} in the Metropolitan Borough of Barnsley, South Yorkshire.`,
      permittedCopyRole: "area-introduction",
      usefulnessToPharmacyFirstReader: "Gives the reader a real geographic identity beyond repeating the area name.",
      prohibitedInference: "Does not describe residents, routines, or the pharmacy’s catchment.",
      confidence: "high",
    });
  }

  if (
    (/barnsley/i.test(text) && opts.host.endsWith(".gov.uk") && /metropolitan borough/i.test(text) && areaRe.test(hay)) ||
    (opts.host.endsWith(".gov.uk") && /barnsley/i.test(text) && areaRe.test(title))
  ) {
    push({
      category: "area-identity",
      normalizedStatement: `${area} is in the Metropolitan Borough of Barnsley, South Yorkshire.`,
      permittedCopyRole: "area-introduction",
      usefulnessToPharmacyFirstReader: "Places the area in its local authority without inventing character.",
      prohibitedInference: "Does not imply travel time, routes, or service eligibility.",
      confidence: "high",
    });
  }

  const areaCouncilRe =
    /\b(?:the\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+Area Council covers the ([^.]{8,200}?)\s+wards\b/gi;
  if (opts.host.endsWith(".gov.uk") && /barnsley/i.test(text)) {
    for (const match of text.matchAll(areaCouncilRe)) {
      const councilName = match[1].trim();
      const wardList = match[2];
      if (!new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(wardList)) continue;
      push({
        category: "area-identity",
        normalizedStatement: `${area} is a ward in Barnsley's ${councilName} Area Council.`,
        permittedCopyRole: "area-introduction",
        usefulnessToPharmacyFirstReader: "Places the area in its official local-government geography without inventing travel.",
        prohibitedInference: "Sharing an area council does not prove a route, journey time, or that two wards are adjacent.",
        confidence: "high",
      });
    }
  }

  if (
    new RegExp(`${area}\\s+Library`, "i").test(text) &&
    (opts.host.endsWith(".gov.uk") || /library/i.test(title))
  ) {
    push({
      category: "community",
      normalizedStatement: `${area} has a public library.`,
      permittedCopyRole: "neutral-community-context",
      usefulnessToPharmacyFirstReader: "A recognizable civic facility that helps describe the place.",
      prohibitedInference: "Does not imply the pharmacy is next to the library or that readers use it.",
      confidence: "high",
    });
    const heritageGroup = text.match(/local history sessions run by ([^.]+Heritage Group)/i);
    if (heritageGroup?.[1]) {
      push({
        category: "heritage",
        normalizedStatement: `${area} Library hosts local history sessions run by ${heritageGroup[1].trim()}.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "A supplied community-history activity at the library, not an invented industrial story.",
        prohibitedInference: "Does not invent the area’s industrial past, imply that residents attend these sessions, or prove healthcare demand.",
        confidence: "high",
      });
    }
    const historySociety = text.match(
      new RegExp(`${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+History Society run local history group sessions`, "i"),
    );
    if (historySociety) {
      push({
        category: "heritage",
        normalizedStatement: `${area} History Society runs local history group sessions.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "A supplied community-history activity named on the library page, not an invented industrial story.",
        prohibitedInference: "Does not invent the area’s industrial past, imply that residents attend these sessions, or prove healthcare demand.",
        confidence: "high",
      });
    }
    const findUs = text.match(
      new RegExp(
        `Find us\\s+([A-Z][A-Za-z0-9'’.-]+(?:\\s+[A-Z][A-Za-z0-9'’.-]+){0,4}\\s+(?:Street|Road|Lane|Avenue|Drive|Way)),\\s*${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i",
      ),
    );
    if (findUs?.[1]) {
      push({
        category: "community",
        normalizedStatement: `${area} Library is on ${findUs[1].trim()}.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "Places the library on a named street from the official page, not a route to the pharmacy.",
        prohibitedInference: "A library street does not prove walking time, adjacency to the pharmacy, or that readers visit the library.",
        confidence: "high",
      });
    }
    if (/regular activities and special events for children and adults/i.test(text)) {
      push({
        category: "community",
        normalizedStatement: `${area} Library runs regular activities and special events for children and adults.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "Official library programming that describes community activity, not a pharmacy offer.",
        prohibitedInference: "Does not imply that Pharmacy First patients attend library events or that the pharmacy hosts them.",
        confidence: "high",
      });
    }
    if (/citizens advice run advice and welfare rights drop[- ]?in sessions/i.test(text)) {
      push({
        category: "community",
        normalizedStatement: `Citizens Advice runs advice and welfare rights drop-in sessions at ${area} Library.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "A supplied civic service at the library, distinct from Pharmacy First.",
        prohibitedInference: "Does not imply a referral relationship with the pharmacy or that readers use Citizens Advice.",
        confidence: "high",
      });
    }
  }

  if (
    (/nationalrail\.co\.uk|northernrailway\.co\.uk/.test(opts.host) || /National Rail/i.test(opts.publisher)) &&
    new RegExp(`${area}\\s+(railway\\s+)?station`, "i").test(text)
  ) {
    push({
      category: "access-transport",
      normalizedStatement: `${area} has a National Rail station.`,
      permittedCopyRole: "access-context",
      usefulnessToPharmacyFirstReader: "Official transport context for the area, not a journey to the pharmacy.",
      prohibitedInference:
        "A station in the area does not prove a route, walking connection, timetable, or journey time to the pharmacy.",
      confidence: "high",
    });
  }

  if (
    (opts.host.includes("travelsouthyorkshire.com") || opts.publisher === "Travel South Yorkshire") &&
    new RegExp(`artwork at ${area}\\s+station`, "i").test(hay)
  ) {
    if (/collaboration between SYMCA/i.test(text) && /Barnsley Council/i.test(text)) {
      push({
        category: "community",
        normalizedStatement: `Artwork at ${area} station was unveiled following a collaboration between SYMCA, Barnsley Council and the town's community.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "A supplied local community project, not a route or a healthcare claim.",
        prohibitedInference: "Station artwork does not prove a journey to the pharmacy, typical residents, or healthcare demand. Do not copy promotional wording such as inspiring, rich history or community spirit.",
        confidence: "high",
      });
    }
    if (new RegExp(`Roly Poly Hill and Wishing Tree at ${area} Park`, "i").test(text)) {
      push({
        category: "community",
        normalizedStatement: `Artwork at ${area} station refers to the Roly Poly Hill and Wishing Tree at ${area} Park.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "Names a Wombwell-specific park feature as stated on an official transport page.",
        prohibitedInference: "Does not invent a visit to the park, a route from the park, or healthcare demand.",
        confidence: "high",
      });
    }
    if (new RegExp(`${area}\\s+[“"']?unicorn[”"']? emblem`, "i").test(text)) {
      push({
        category: "community",
        normalizedStatement: `The artwork at ${area} station features the ${area} unicorn emblem.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "A distinctive local emblem named by an official source.",
        prohibitedInference: "An emblem does not describe residents, industry, or healthcare need.",
        confidence: "high",
      });
    }
  }

  if (
    new RegExp(`${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[-\\s]+mill`, "i").test(`${text} ${bodyHay}`) &&
    /(country park|museum|heritage|working mill)/i.test(text) &&
    (opts.host.endsWith(".gov.uk") || opts.host.includes("historicengland"))
  ) {
    push({
      category: "heritage",
      normalizedStatement: `${area} Mill Country Park is a public mill and country park in ${area}.`,
      permittedCopyRole: "neutral-community-context",
      usefulnessToPharmacyFirstReader: "Gives the area a distinctive, official place identity.",
      prohibitedInference: "Does not create directions or imply the pharmacy is at the mill.",
      confidence: "high",
    });
  }

  if (
    (opts.host.includes("historicengland.org.uk") || opts.publisher === "Historic England") &&
    areaRe.test(hay) &&
    !/heritage hub|search the list|the list: results/i.test(title)
  ) {
    const listingPage = /listed building|list entry/i.test(text);
    if (listingPage) {
      const listing = text.match(
        /\b([A-Z][A-Za-z0-9'’.\-]+(?:\s[A-Z][A-Za-z0-9'’.\-]+){0,8})\s+is (?:a |an )?(Grade\s+I{1,3}\*?\s+)?listed building\b/i,
      );
      const gradeFromBody = text.match(/\bGrade\s+(I{1,3}\*?)\b/i)?.[1];
      let name = listing?.[1]?.trim() || "";
      if (!name) {
        name = title
          .replace(/\s*[|\-–]\s*Historic England.*$/i, "")
          .replace(/\s*[-–]\s*\d{5,}.*$/, "")
          .replace(new RegExp(`,\\s*${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*$`, "i"), "")
          .replace(/,\s*Barnsley.*$/i, "")
          .trim();
      }
      if (name && name.length >= 4 && name.length <= 90 && !/^barnsley$/i.test(name) && !/listed building/i.test(name)) {
        const grade = listing?.[2]?.trim() || (gradeFromBody ? `Grade ${gradeFromBody}` : "");
        const gradePrefix = grade ? `${grade} `.replace(/\s+/g, " ") : "";
        push({
          category: "heritage",
          normalizedStatement: `${name} is a ${gradePrefix}listed building in ${area}.`.replace(/\s+/g, " ").trim(),
          permittedCopyRole: "neutral-community-context",
          usefulnessToPharmacyFirstReader: "Official heritage identity for the place, used only as history or character of place.",
          prohibitedInference: "A listed building does not prove a route to the pharmacy, present-day employment, or healthcare demand.",
          confidence: "high",
        });
      }
    }
    const colliery = text.match(
      new RegExp(
        `\\b(${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+Main)?\\s+Colliery|[A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)?\\s+Colliery)\\b`,
      ),
    );
    if (
      colliery?.[1] &&
      new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(`${colliery[1]} ${text.slice(0, 2000)}`) &&
      /\b(former|historic|closed|site of|was a)\b.{0,80}\b(colliery|coal mine|coal mining)\b|\bcolliery\b/i.test(text)
    ) {
      push({
        category: "heritage",
        normalizedStatement: `${colliery[1]} was a coal mine associated with ${area}.`,
        permittedCopyRole: "neutral-community-context",
        usefulnessToPharmacyFirstReader: "Historical industry only, as stated by an official heritage source.",
        prohibitedInference: "Do not infer present occupations, typical patients, or healthcare demand from historical mining.",
        confidence: "high",
      });
    }
  }

  if (opts.host.endsWith(".gov.uk") && /ward profile/i.test(text)) {
    const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sectionMatch = text.match(
      new RegExp(`${escaped}\\s+ward profile[\\s\\S]*?(?=(?:[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\s+ward profile|Give feedback|$)`, "i"),
    );
    const section = sectionMatch?.[0] || "";
    if (section) {
          const pop = section.match(
            new RegExp(`([\\d,]+)\\s+people live in ${escaped},?\\s+or\\s+([\\d.]+)% of Barnsley`, "i"),
          );
      if (pop) {
        push({
          category: "area-identity",
          normalizedStatement: `${area} is a Barnsley ward with ${pop[1]} residents, about ${pop[2]}% of the borough population.`,
          permittedCopyRole: "area-introduction",
          usefulnessToPharmacyFirstReader: "Gives a recognisable, official picture of the place that is not a place-name swap.",
          prohibitedInference: "A population figure is not a healthcare-demand, eligibility or travel claim. Do not treat Barnsley borough averages as Wombwell figures. Do not describe the figure as current unless the source gives a reference year.",
          confidence: "high",
        });
      }
      const retail = section.match(/Wholesale and retail trades employ the most workers at ([\d.]+)%/i);
      const construction = section.match(/followed by construction at ([\d.]+)%/i);
      if (retail && construction) {
        push({
          category: "community",
          normalizedStatement: `Among working adults in ${area}, wholesale and retail trades are the largest source of employment at ${retail[1]}%, followed by construction at ${construction[1]}%.`,
          permittedCopyRole: "neutral-community-context",
          usefulnessToPharmacyFirstReader: "States local employment from the official ward profile, distinct from historical industry. Do not call the figure current unless the source gives a reference year.",
          prohibitedInference: "Ward-profile employment is not historical coal mining, not a typical patient's job, and does not explain why someone uses Pharmacy First. Do not describe it as current without a source year.",
          confidence: "high",
        });
      }
      if (/almost half of all homes are semi-detached houses or bungalows/i.test(section)) {
        push({
          category: "community",
          normalizedStatement: `Almost half of homes in ${area} are semi-detached houses or bungalows.`,
          permittedCopyRole: "neutral-community-context",
          usefulnessToPharmacyFirstReader: "A specific present-day description of the place.",
          prohibitedInference: "Housing mix does not describe resident attitudes, wealth, or healthcare need.",
          confidence: "high",
        });
      }
    }
  }

  if (opts.host.endsWith(".nhs.uk") || opts.publisher === "NHS") {
    const titleName = extractCustomerFacingNhsName(title, area);
    const nameInBody = Boolean(titleName && new RegExp(titleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text));
    const centreInBody = new RegExp(
      `${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:Health Centre|Medical Centre|Surgery)`,
      "i",
    ).test(text);
    if (titleName && (nameInBody || centreInBody)) {
      push({
        category: "healthcare",
        normalizedStatement: `NHS general practice services in ${area} are provided from ${titleName}.`,
        permittedCopyRole: "healthcare-context",
        usefulnessToPharmacyFirstReader: "Names a local NHS site in customer-facing language, without a pharmacy relationship.",
        prohibitedInference:
          "A healthcare provider’s presence does not prove a relationship with the pharmacy, registration, waiting times, or eligibility.",
        confidence: "high",
      });
    }
  }

  return drafts;
}

export function extractCustomerFacingNhsName(title: string, areaName: string): string | null {
  let cleaned = collapseWs(decodeHtmlEntities(String(title || "")));
  cleaned = cleaned.replace(/\s*[|\-–]\s*NHS.*$/i, "");
  cleaned = cleaned.replace(/^Home\s*[|\-–]\s*/i, "");
  if (!cleaned) return null;
  const areaCentre = cleaned.match(
    new RegExp(
      `\\b(${areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:Health Centre|Medical Centre|Surgery))\\b`,
      "i",
    ),
  );
  if (areaCentre?.[1] && isCustomerAppropriateOrganisationName(areaCentre[1])) return areaCentre[1];
  const centre = cleaned.match(
    /\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,4}\s(?:Health Centre|Medical Centre|Surgery))\b/,
  );
  if (centre?.[1] && isCustomerAppropriateOrganisationName(centre[1])) return centre[1];
  if (!isCustomerAppropriateOrganisationName(cleaned)) return null;
  if (!/\b(Health Centre|Medical Centre|Surgery|Practice)\b/i.test(cleaned)) return null;
  if (
    !new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(cleaned) &&
    !/Health Centre|Medical Centre/i.test(cleaned)
  ) {
    return null;
  }
  return cleaned;
}

export function canonicalPharmacyFacts(opts: {
  areaName: string;
  areaSlug: string;
  pharmacyName: string;
  address: string;
  pharmacyIsInArea: boolean;
  distanceKm: number | null;
  retrievedAt: string;
}): EditorialFactV3[] {
  const facts: EditorialFactV3[] = [];
  if (opts.pharmacyIsInArea) {
    facts.push({
      factId: factIdFor(opts.areaSlug, "pharmacy-relationship", "in-area"),
      area: opts.areaName,
      areaSlug: opts.areaSlug,
      category: "pharmacy-relationship",
      normalizedStatement: `${opts.pharmacyName} is in ${opts.areaName} at ${opts.address}.`,
      sourceTitle: "Pharmacy profile",
      sourceUrl: "canonical://pharmacy-profile",
      publisher: "canonical-pharmacy-profile",
      retrievedAt: opts.retrievedAt,
      sourceClass: "primary",
      corroboratingSource: null,
      confidence: "high",
      usefulnessToPharmacyFirstReader: "States the verified physical location of the pharmacy in this area.",
      permittedCopyRole: "access-context",
      prohibitedInference: "Does not describe parking, hours, or how readers usually travel.",
      validationStatus: "accepted",
    });
  } else if (opts.distanceKm != null && Number.isFinite(opts.distanceKm)) {
    facts.push({
      factId: factIdFor(opts.areaSlug, "pharmacy-relationship", "distance"),
      area: opts.areaName,
      areaSlug: opts.areaSlug,
      category: "pharmacy-relationship",
      normalizedStatement: `${opts.pharmacyName} is ${opts.distanceKm.toFixed(1)} km from ${opts.areaName}, at ${opts.address}.`,
      sourceTitle: "Verified locality evidence",
      sourceUrl: "canonical://verified-locality",
      publisher: "verified-locality-evidence",
      retrievedAt: opts.retrievedAt,
      sourceClass: "primary",
      corroboratingSource: null,
      confidence: "high",
      usefulnessToPharmacyFirstReader: "Gives the verified distance without inventing a route or journey time.",
      permittedCopyRole: "access-context",
      prohibitedInference: "Distance is not a route, timetable, or travel-time claim.",
      validationStatus: "accepted",
    });
  }
  return facts;
}
