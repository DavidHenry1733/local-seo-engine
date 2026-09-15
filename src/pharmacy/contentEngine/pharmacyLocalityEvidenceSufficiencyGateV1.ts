/**
 * Generic UK locality evidence-sufficiency gate.
 * Scores verified evidence available to the renderer by distinct category,
 * not sentence count or generated copy volume.
 * Does not invent facts, pad copy, or change uniqueness / unsupported-claim gates.
 */
import { buildContentGenerationContext } from "./buildContentGenerationContext.ts";
import {
  isGpPracticeName,
  isHospitalOrUrgentCareName,
  isNamedUkCivicCentrePlace,
  isUsefulHealthcareName,
  isUsefulOrientationName,
  isUsefulTransportName,
  looksLikeOverseasOrGenericNoise,
  pharmacyIsInSelectedArea,
} from "./pharmacyEvidenceLedLocalNarrativeV1.ts";
import { loadEditorialEvidencePack } from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { planPharmacyLocalEvidenceRequest } from "./pharmacyLocalEvidencePackContractV1.ts";
import {
  bindVerifiedLocalityEvidenceV1,
  type NamedLocalityFact,
  type NearbyLocalityLink,
  type VerifiedLocalityEvidence,
} from "./pharmacyVerifiedLocalityEvidenceV1.ts";
import { AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET } from "./pharmacyAiLocalPageCandidatePaths.ts";
import { bindCurrentRegisteredApprovedBank } from "../pharmacyApprovedBankRunProvenance.ts";
import { resolveTenantProfileSlug } from "../pharmacyTenantSlug.ts";

export const LOCALITY_EVIDENCE_SUFFICIENCY_GATE_ID = "locality-evidence-sufficiency-v1";
export const LOCALITY_EVIDENCE_SUFFICIENCY_GATE_VERSION = 1;

/**
 * Generic UK thresholds. Count distinct verified categories, not copy volume.
 * Place-identity categories are named local facts a reader can recognise
 * independently of the pharmacy relationship.
 */
export const PLACE_IDENTITY_CATEGORIES = [
  "civic-identity",
  "gp-practice",
  "healthcare-facility",
  "landmark-community",
] as const;

export const LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS = {
  minCategoriesForAcceptable: 2,
  minPlaceIdentityForAcceptable: 1,
  minCategoriesForRich: 4,
  minPlaceIdentityForRich: 2,
} as const;

export const LOCALITY_EVIDENCE_SUFFICIENCY_CATEGORIES = [
  "civic-identity",
  "gp-practice",
  "healthcare-facility",
  "landmark-community",
  "transport-access",
  "surrounding-locality",
  "pharmacy-relationship",
  "other-attributable",
] as const;

export type LocalityEvidenceSufficiencyCategory =
  (typeof LOCALITY_EVIDENCE_SUFFICIENCY_CATEGORIES)[number];

export type LocalityEvidenceSufficiencyClassification = "rich" | "acceptable" | "insufficient";

export type LocalityEvidenceSufficiencyItem = {
  category: LocalityEvidenceSufficiencyCategory;
  label: string;
};

export type LocalityEvidenceSufficiencyEditorialFact = {
  category?: string;
  normalizedStatement?: string;
  validationStatus?: string;
  permittedCopyRole?: string;
};

export type LocalityEvidenceSufficiencyInput = {
  areaName: string;
  areaSlug?: string;
  pharmacyAddress?: string;
  verified?: Partial<VerifiedLocalityEvidence> | null;
  healthcare?: NamedLocalityFact[];
  landmarks?: NamedLocalityFact[];
  community?: NamedLocalityFact[];
  transport?: NamedLocalityFact[];
  nearbyLocalities?: Array<Pick<NearbyLocalityLink, "areaName"> & { geographic?: boolean }>;
  distanceKm?: number | null;
  distanceLabel?: string;
  discoveryReason?: string;
  editorialFacts?: LocalityEvidenceSufficiencyEditorialFact[];
  /** Ignored on purpose: generated copy cannot raise evidence sufficiency. */
  renderedCopy?: string;
  genericFiller?: string;
};

export type LocalityEvidenceSufficiencyResult = {
  gateId: string;
  version: number;
  areaName: string;
  areaSlug: string;
  classification: LocalityEvidenceSufficiencyClassification;
  reviewReady: boolean;
  publishable: boolean;
  categoriesPresent: LocalityEvidenceSufficiencyCategory[];
  categoriesMissing: LocalityEvidenceSufficiencyCategory[];
  missingCategoryLabels: string[];
  evidenceItems: LocalityEvidenceSufficiencyItem[];
  categoryCount: number;
  placeIdentityCount: number;
  reasons: string[];
  reviewBlockReason: string | null;
};

const CATEGORY_LABELS: Record<LocalityEvidenceSufficiencyCategory, string> = {
  "civic-identity": "locality / civic identity",
  "gp-practice": "named GP / medical practice",
  "healthcare-facility": "hospital / urgent-care / healthcare facility",
  "landmark-community": "recognised landmark / community asset",
  "transport-access": "transport / access evidence",
  "surrounding-locality": "surrounding locality / geographic context",
  "pharmacy-relationship": "pharmacy relationship / verified distance",
  "other-attributable": "other attributable local evidence",
};

const PLACE_IDENTITY = new Set<LocalityEvidenceSufficiencyCategory>(PLACE_IDENTITY_CATEGORIES);

const GENERIC_NAME_TOKENS = new Set([
  "the",
  "and",
  "nhs",
  "dr",
  "practice",
  "surgery",
  "library",
  "park",
  "centre",
  "center",
  "school",
  "primary",
  "academy",
  "medical",
  "community",
  "road",
  "street",
  "health",
  "group",
  "branch",
  "lane",
  "way",
  "high",
]);

function normName(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return String(name || "")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function distinctiveScore(name: string, areaName: string): number {
  const area = areaName.trim().toLowerCase();
  return tokens(name).filter((t) => t.toLowerCase() !== area && !GENERIC_NAME_TOKENS.has(t.toLowerCase())).length;
}

function isAreaOnlyName(name: string, areaName: string): boolean {
  return normName(name) === normName(areaName);
}

function uniqueNamed(items: Array<{ name?: string } | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    const key = normName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function isCivicOrganisationName(name: string, area: string): boolean {
  if (isAreaOnlyName(name, area) || looksLikeOverseasOrGenericNoise(name)) return false;
  if (isNamedUkCivicCentrePlace(name, area)) return true;
  return /\b(parish council|town council|village hall|civic hall|history society|neighbourhood board|neighborhood board)\b/i.test(
    name,
  );
}

function isCommunityAssetName(name: string, area: string): boolean {
  if (isAreaOnlyName(name, area) || looksLikeOverseasOrGenericNoise(name)) return false;
  if (isUsefulOrientationName(name, area)) return true;
  if (/\b(heritage group|citizens advice|community group|village hall)\b/i.test(name)) return true;
  if (/\b(church|chapel|mosque)\b/i.test(name) && distinctiveScore(name, area) > 0) return true;
  return false;
}

function acceptedEditorialFacts(
  facts: LocalityEvidenceSufficiencyEditorialFact[] | undefined,
): LocalityEvidenceSufficiencyEditorialFact[] {
  return (facts || []).filter((fact) => {
    const status = String(fact.validationStatus || "accepted").trim().toLowerCase();
    const statement = String(fact.normalizedStatement || "").trim();
    return Boolean(statement) && (status === "accepted" || status === "");
  });
}

function isGenericCivicWording(text: string): boolean {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!/\bcivic\b/i.test(value)) return false;
  if (isNamedUkCivicCentrePlace(value, "") || /\bcivic hall\b/i.test(value)) {
    return /\b(services|amenities|facilities|offers|provides|residents can)\b/i.test(value);
  }
  return true;
}

function isGenericLocalityWording(text: string): boolean {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return true;
  return (
    isGenericCivicWording(value) ||
    /established residential area/i.test(value) ||
    /well connected and convenient/i.test(value) ||
    /rely on nearby (healthcare|facilities|community services)/i.test(value) ||
    /range of amenities/i.test(value) ||
    /excellent access to the wider/i.test(value) ||
    /local patients can receive professional/i.test(value) ||
    /^(the )?(area|neighbourhood|locality) is (a )?(local |residential )?area\b/i.test(value)
  );
}

function statementHasAttributableTransport(text: string, area: string): boolean {
  return isUsefulTransportName(text, area) || /\b(station|interchange|railway|rail\b|bus station)\b/i.test(text);
}

function looksLikePharmacyRelationshipEvidence(
  text: string,
  opts: { areaName: string; pharmacyAddress?: string; distanceLabel?: string },
): boolean {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return false;
  if (/\b\d+(?:\.\d+)?\s*km\b/i.test(value)) return true;
  if (/\bstraight line\b/i.test(value)) return true;
  if (/\bconsultations take place\b/i.test(value)) return true;
  const distance = String(opts.distanceLabel || "").trim();
  if (distance && value.toLowerCase().includes(distance.toLowerCase())) return true;
  const address = String(opts.pharmacyAddress || "").trim();
  if (address) {
    if (normName(value).includes(normName(address))) return true;
    const street = address.split(",")[0]?.trim() || "";
    if (street.length >= 8 && value.toLowerCase().includes(street.toLowerCase())) return true;
  }
  const area = String(opts.areaName || "").trim();
  if (area && /\bpharmacy\b/i.test(value) && new RegExp(`\\bis in\\s+${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(value)) {
    return true;
  }
  return false;
}

function civicIdentityFromDiscovery(reason: string, area: string): boolean {
  const text = String(reason || "").replace(/\s+/g, " ").trim();
  if (!text || isGenericLocalityWording(text)) return false;
  if (/^recognised neighbourhood/i.test(text)) return false;
  if (looksLikeOverseasOrGenericNoise(text)) return false;
  if (looksLikePharmacyRelationshipEvidence(text, { areaName: area })) return false;
  const areaRe = new RegExp(`\\b${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return areaRe.test(text) && /\b(village|town|suburb|ward|parish|civil parish)\b/i.test(text);
}

function addItem(
  buckets: Map<LocalityEvidenceSufficiencyCategory, string[]>,
  category: LocalityEvidenceSufficiencyCategory,
  label: string,
): void {
  const name = String(label || "").trim();
  if (!name) return;
  const key = normName(name);
  const existing = buckets.get(category) || [];
  if (existing.some((row) => normName(row) === key)) return;
  existing.push(name);
  buckets.set(category, existing);
}

function classifyFromCategories(
  present: LocalityEvidenceSufficiencyCategory[],
): LocalityEvidenceSufficiencyClassification {
  const placeCount = present.filter((category) => PLACE_IDENTITY.has(category)).length;
  const { minCategoriesForAcceptable, minPlaceIdentityForAcceptable, minCategoriesForRich, minPlaceIdentityForRich } =
    LOCALITY_EVIDENCE_SUFFICIENCY_THRESHOLDS;
  if (present.length < minCategoriesForAcceptable || placeCount < minPlaceIdentityForAcceptable) {
    return "insufficient";
  }
  if (present.length >= minCategoriesForRich && placeCount >= minPlaceIdentityForRich) return "rich";
  return "acceptable";
}

function emptyResult(
  areaName: string,
  areaSlug: string,
  extraReason: string,
): LocalityEvidenceSufficiencyResult {
  const categoriesMissing = [...LOCALITY_EVIDENCE_SUFFICIENCY_CATEGORIES];
  return {
    gateId: LOCALITY_EVIDENCE_SUFFICIENCY_GATE_ID,
    version: LOCALITY_EVIDENCE_SUFFICIENCY_GATE_VERSION,
    areaName,
    areaSlug,
    classification: "insufficient",
    reviewReady: false,
    publishable: false,
    categoriesPresent: [],
    categoriesMissing,
    missingCategoryLabels: categoriesMissing.map((category) => CATEGORY_LABELS[category]),
    evidenceItems: [],
    categoryCount: 0,
    placeIdentityCount: 0,
    reasons: [extraReason],
    reviewBlockReason: extraReason,
  };
}

/**
 * Evaluate verified renderer evidence. Copy volume, generic filler, duplicate
 * names and unsupported/rejected facts cannot raise the classification.
 */
export function evaluateLocalityEvidenceSufficiencyGate(
  input: LocalityEvidenceSufficiencyInput,
): LocalityEvidenceSufficiencyResult {
  const areaName = String(input.areaName || "").trim();
  const areaSlug = String(input.areaSlug || "").trim() || areaName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  void input.renderedCopy;
  void input.genericFiller;

  if (!areaName) {
    return emptyResult("", areaSlug, "Selected area identity is missing.");
  }

  const verified = input.verified || {};
  const address = String(input.pharmacyAddress || verified.pharmacyAddress || "").trim();
  const healthcare = uniqueNamed([...(verified.healthcare || []), ...(input.healthcare || [])]);
  const landmarks = uniqueNamed([...(verified.landmarks || []), ...(input.landmarks || [])]);
  const community = uniqueNamed([...(verified.community || []), ...(input.community || [])]);
  const transport = uniqueNamed([...(verified.transport || []), ...(input.transport || [])]);
  const nearby = [...(verified.nearbyLocalities || []), ...(input.nearbyLocalities || [])]
    .map((row) => String(row?.areaName || "").trim())
    .filter((name) => name && normName(name) !== normName(areaName));
  const distanceKm =
    input.distanceKm != null
      ? input.distanceKm
      : verified.distanceKm != null
        ? verified.distanceKm
        : null;
  const distanceLabel = String(input.distanceLabel || verified.distanceLabel || "").trim();
  const discoveryReason = String(input.discoveryReason || verified.discoveryReason || "").trim();
  const editorial = acceptedEditorialFacts(input.editorialFacts);
  const hasDistance =
    (distanceKm != null && Number.isFinite(Number(distanceKm))) || Boolean(distanceLabel);
  const inArea = pharmacyIsInSelectedArea(
    {
      areaName,
      distanceKm: distanceKm != null && Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : null,
    } as VerifiedLocalityEvidence,
    address,
  );

  const buckets = new Map<LocalityEvidenceSufficiencyCategory, string[]>();
  const claimedIdentity = new Map<string, LocalityEvidenceSufficiencyCategory>();
  const relationshipOpts = { areaName, pharmacyAddress: address, distanceLabel };

  const claim = (category: LocalityEvidenceSufficiencyCategory, label: string): void => {
    const name = String(label || "").trim();
    if (!name || isGenericLocalityWording(name) || looksLikeOverseasOrGenericNoise(name)) return;
    const key = normName(name);
    if (!key) return;
    const existing = claimedIdentity.get(key);
    if (existing && existing !== category) return;
    if (existing === category) return;
    claimedIdentity.set(key, category);
    addItem(buckets, category, name);
  };

  if (hasDistance || inArea) {
    claim(
      "pharmacy-relationship",
      distanceLabel || (inArea ? `${areaName} includes the pharmacy premises` : "verified pharmacy relationship"),
    );
  }

  for (const name of healthcare) {
    if (looksLikePharmacyRelationshipEvidence(name, relationshipOpts) || !isUsefulHealthcareName(name, areaName)) {
      continue;
    }
    if (isHospitalOrUrgentCareName(name)) claim("healthcare-facility", name);
    else if (isGpPracticeName(name)) claim("gp-practice", name);
    else claim("healthcare-facility", name);
  }

  for (const name of transport) {
    if (looksLikePharmacyRelationshipEvidence(name, relationshipOpts)) continue;
    if (isUsefulTransportName(name, areaName)) claim("transport-access", name);
  }

  for (const name of [...landmarks, ...community]) {
    if (looksLikePharmacyRelationshipEvidence(name, relationshipOpts)) continue;
    if (isCivicOrganisationName(name, areaName)) claim("civic-identity", name);
    else if (isCommunityAssetName(name, areaName)) claim("landmark-community", name);
  }

  for (const fact of editorial) {
    const statement = String(fact.normalizedStatement || "").trim();
    const category = String(fact.category || "").trim();
    const role = String(fact.permittedCopyRole || "").trim();
    if (!statement || isGenericLocalityWording(statement) || looksLikeOverseasOrGenericNoise(statement)) continue;
    if (looksLikePharmacyRelationshipEvidence(statement, relationshipOpts) || category === "pharmacy-relationship") {
      claim("pharmacy-relationship", statement);
      continue;
    }
    if (statementHasAttributableTransport(statement, areaName)) {
      claim("transport-access", statement);
      continue;
    }
    if (category === "healthcare" || role === "healthcare-context") {
      if (isHospitalOrUrgentCareName(statement)) claim("healthcare-facility", statement);
      else claim("gp-practice", statement);
      continue;
    }
    if (category === "area-identity" || role === "area-introduction") {
      claim("civic-identity", statement);
      continue;
    }
    if (category === "community" || category === "heritage" || role === "neutral-community-context") {
      claim("landmark-community", statement);
      continue;
    }
    if (category === "access-transport" || role === "access-context") {
      continue;
    }
    claim("other-attributable", statement);
  }

  if (civicIdentityFromDiscovery(discoveryReason, areaName)) {
    claim("civic-identity", discoveryReason);
  }

  const uniqueNearby = [...new Set(nearby.map((name) => normName(name)))].filter(Boolean);
  if (uniqueNearby.length) {
    claim("surrounding-locality", nearby[0]!);
  }

  const categoriesPresent = LOCALITY_EVIDENCE_SUFFICIENCY_CATEGORIES.filter((category) => buckets.has(category));
  const categoriesMissing = LOCALITY_EVIDENCE_SUFFICIENCY_CATEGORIES.filter(
    (category) => !buckets.has(category),
  );
  const classification = classifyFromCategories(categoriesPresent);
  const reviewReady = classification !== "insufficient";
  const placeIdentityCount = categoriesPresent.filter((category) => PLACE_IDENTITY.has(category)).length;
  const evidenceItems: LocalityEvidenceSufficiencyItem[] = [];
  for (const category of categoriesPresent) {
    for (const label of buckets.get(category) || []) {
      evidenceItems.push({ category, label });
    }
  }

  const reasons: string[] = [];
  if (classification === "rich") {
    reasons.push("Enough verified evidence for a substantial locality page.");
  } else if (classification === "acceptable") {
    reasons.push("Enough verified evidence for a useful, differentiated locality page.");
  } else {
    reasons.push("Too little attributable locality evidence to create a commercially acceptable local page.");
  }
  if (categoriesMissing.length) {
    reasons.push(`Missing evidence categories: ${categoriesMissing.map((category) => CATEGORY_LABELS[category]).join("; ")}.`);
  }

  const reviewBlockReason = reviewReady
    ? null
    : `Locality evidence is insufficient for review. Missing: ${categoriesMissing
        .map((category) => CATEGORY_LABELS[category])
        .join("; ")}.`;

  return {
    gateId: LOCALITY_EVIDENCE_SUFFICIENCY_GATE_ID,
    version: LOCALITY_EVIDENCE_SUFFICIENCY_GATE_VERSION,
    areaName,
    areaSlug,
    classification,
    reviewReady,
    publishable: reviewReady,
    categoriesPresent,
    categoriesMissing,
    missingCategoryLabels: categoriesMissing.map((category) => CATEGORY_LABELS[category]),
    evidenceItems,
    categoryCount: categoriesPresent.length,
    placeIdentityCount,
    reasons,
    reviewBlockReason,
  };
}

export function localityEvidenceSufficiencyCategoryLabel(
  category: LocalityEvidenceSufficiencyCategory,
): string {
  return CATEGORY_LABELS[category];
}

export function areaSlugFromLocalPageCandidateAssetKey(assetKey: string): string | null {
  const prefix = `${AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET}:`;
  const key = String(assetKey || "").trim();
  if (!key.startsWith(prefix)) return null;
  const areaSlug = key.slice(prefix.length).trim();
  return areaSlug || null;
}

/**
 * Bind verified renderer evidence once, then evaluate sufficiency.
 * Review Centre and publishing both consume this result; they do not score separately.
 */
export function evaluateLocalityEvidenceSufficiencyForCampaignAreas(opts: {
  slug: string;
  serviceId: string;
  areas: Array<{ areaName: string; areaSlug: string }>;
}): Map<string, LocalityEvidenceSufficiencyResult> {
  const out = new Map<string, LocalityEvidenceSufficiencyResult>();
  const slug = resolveTenantProfileSlug(opts.slug) || opts.slug;
  const serviceId = String(opts.serviceId || "").trim() || "pharmacy-first";
  const areas = (opts.areas || []).filter((area) => area?.areaSlug);
  if (!slug) {
    for (const area of areas) {
      out.set(area.areaSlug, emptyResult(area.areaName, area.areaSlug, "Tenant identity is missing."));
    }
    return out;
  }
  try {
    const plan = planPharmacyLocalEvidenceRequest(slug, serviceId);
    const siblings = plan.areas.length ? plan.areas : areas;
    const ctx = bindCurrentRegisteredApprovedBank(
      buildContentGenerationContext(slug, serviceId, {
        selectedAreasOverride: siblings.map((area, order) => ({
          areaName: area.areaName,
          areaSlug: area.areaSlug,
          selected: true,
          order: order + 1,
          priority: order + 1,
        })),
      }),
    );
    const address = String(ctx.profile.fullAddress || ctx.profile.customerFacingAddress || "");
    for (const area of areas) {
      const verified = bindVerifiedLocalityEvidenceV1({
        ctx,
        areaName: area.areaName,
        areaSlug: area.areaSlug,
        siblingLocalities: siblings,
      });
      const editorial = loadEditorialEvidencePack(slug, serviceId, area.areaSlug);
      out.set(
        area.areaSlug,
        evaluateLocalityEvidenceSufficiencyGate({
          areaName: area.areaName,
          areaSlug: area.areaSlug,
          pharmacyAddress: address,
          verified,
          editorialFacts: editorial?.facts || [],
        }),
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    for (const area of areas) {
      if (!out.has(area.areaSlug)) {
        out.set(
          area.areaSlug,
          emptyResult(
            area.areaName,
            area.areaSlug,
            `Verified renderer evidence could not be evaluated (${detail}).`,
          ),
        );
      }
    }
  }
  return out;
}

export function evaluateLocalityEvidenceSufficiencyForArea(opts: {
  slug: string;
  serviceId: string;
  areaName?: string;
  areaSlug: string;
}): LocalityEvidenceSufficiencyResult {
  const areaSlug = String(opts.areaSlug || "").trim();
  const areaName = String(opts.areaName || "").trim() || areaSlug;
  if (!areaSlug) {
    return emptyResult(areaName, areaSlug, "Tenant or locality identity is missing.");
  }
  return (
    evaluateLocalityEvidenceSufficiencyForCampaignAreas({
      slug: opts.slug,
      serviceId: opts.serviceId,
      areas: [{ areaName, areaSlug }],
    }).get(areaSlug) || emptyResult(areaName, areaSlug, "Verified renderer evidence could not be evaluated.")
  );
}

export function assertLocalityEvidenceSufficiencyAllowsApproval(opts: {
  slug: string;
  serviceId: string;
  areaName?: string;
  areaSlug: string;
}): LocalityEvidenceSufficiencyResult {
  const result = evaluateLocalityEvidenceSufficiencyForArea(opts);
  if (!result.reviewReady) {
    throw new Error(
      result.reviewBlockReason ||
        "This locality is not review-ready because verified local evidence is insufficient.",
    );
  }
  return result;
}
