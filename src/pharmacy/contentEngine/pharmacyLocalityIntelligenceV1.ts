/**
 * Locality Intelligence V1.
 * One structured contract for verified local facts used in patient-facing synthesis.
 * It keeps name, address, category, and provenance. It does not invent missing facts.
 */
import type { LocalEvidenceEntity, PharmacyLocalEvidencePackV3 } from "./pharmacyLocalEvidencePackContractV1.ts";
import { attributableEntities } from "./pharmacyLocalEvidencePackContractV1.ts";

export const LOCALITY_INTELLIGENCE_V1 = "locality-intelligence-v1";

export const LOCALITY_INTELLIGENCE_PLACE_CATEGORIES = [
  "healthcare",
  "transport",
  "community",
  "landmarks",
  "schools",
  "retail",
] as const;

export type LocalityIntelligencePlaceCategory = (typeof LOCALITY_INTELLIGENCE_PLACE_CATEGORIES)[number];

export type LocalityIntelligenceFactV1 = {
  name: string;
  category: LocalityIntelligencePlaceCategory;
  address: string;
  provenance: string;
  relationship: string;
};

export type LocalityGeographicRelationshipV1 = {
  distanceLabel: string;
  distanceProvenance: string;
  cardinalDirection: string;
  directionProvenance: string;
  pharmacyAddress: string;
  pharmacyAddressProvenance: string;
};

export type LocalityIntelligenceV1 = {
  contractId: typeof LOCALITY_INTELLIGENCE_V1;
  areaName: string;
  areaSlug: string;
  tenantSlug: string;
  geographic: LocalityGeographicRelationshipV1;
  healthcare: LocalityIntelligenceFactV1[];
  access: LocalityIntelligenceFactV1[];
  community: LocalityIntelligenceFactV1[];
  landmarks: LocalityIntelligenceFactV1[];
  schools: LocalityIntelligenceFactV1[];
  retail: LocalityIntelligenceFactV1[];
};

export type LocalityEvidenceSufficiencyV1 = "sufficient" | "limited" | "insufficient";

const CATEGORY_SET = new Set<string>(LOCALITY_INTELLIGENCE_PLACE_CATEGORIES);

function clean(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function factFromEntity(entity: LocalEvidenceEntity): LocalityIntelligenceFactV1 | null {
  const category = clean(entity.category);
  if (!CATEGORY_SET.has(category)) return null;
  const name = clean(entity.name);
  const provenance = [clean(entity.source) || clean(entity.provider), clean(entity.placeId) || clean(entity.sourceRef)]
    .filter(Boolean)
    .join(":");
  if (name.length < 3 || !provenance) return null;
  return {
    name,
    category: category as LocalityIntelligencePlaceCategory,
    address: clean(entity.address),
    provenance,
    relationship: clean(entity.relationship),
  };
}

function emptyGeographic(): LocalityGeographicRelationshipV1 {
  return {
    distanceLabel: "",
    distanceProvenance: "",
    cardinalDirection: "",
    directionProvenance: "",
    pharmacyAddress: "",
    pharmacyAddressProvenance: "",
  };
}

export function buildLocalityIntelligenceV1(input: {
  areaName: string;
  areaSlug: string;
  tenantSlug: string;
  pack?: PharmacyLocalEvidencePackV3 | null;
  geographic?: Partial<LocalityGeographicRelationshipV1> | null;
}): LocalityIntelligenceV1 {
  const geographic = { ...emptyGeographic(), ...(input.geographic || {}) };
  const pack = input.pack;
  const packTenant = clean(pack?.slug);
  const isolated = Boolean(pack) && (!packTenant || packTenant === input.tenantSlug);
  const grouped: Record<LocalityIntelligencePlaceCategory, LocalityIntelligenceFactV1[]> = {
    healthcare: [],
    transport: [],
    community: [],
    landmarks: [],
    schools: [],
    retail: [],
  };
  if (isolated && pack) {
    for (const entity of attributableEntities(pack)) {
      const fact = factFromEntity(entity);
      if (!fact) continue;
      const entityArea = clean(entity.areaName).toLowerCase();
      const expected = clean(input.areaName).toLowerCase();
      if (entityArea && expected && entityArea !== expected) continue;
      grouped[fact.category].push(fact);
    }
  }
  return {
    contractId: LOCALITY_INTELLIGENCE_V1,
    areaName: clean(input.areaName),
    areaSlug: clean(input.areaSlug),
    tenantSlug: clean(input.tenantSlug),
    geographic: {
      distanceLabel: clean(geographic.distanceLabel),
      distanceProvenance: clean(geographic.distanceProvenance),
      cardinalDirection: clean(geographic.cardinalDirection),
      directionProvenance: clean(geographic.directionProvenance),
      pharmacyAddress: clean(geographic.pharmacyAddress),
      pharmacyAddressProvenance: clean(geographic.pharmacyAddressProvenance),
    },
    healthcare: grouped.healthcare,
    access: grouped.transport,
    community: grouped.community,
    landmarks: grouped.landmarks,
    schools: grouped.schools,
    retail: grouped.retail,
  };
}

export function localityIntelligencePlaces(intel: LocalityIntelligenceV1): LocalityIntelligenceFactV1[] {
  return [
    ...intel.healthcare,
    ...intel.access,
    ...intel.community,
    ...intel.landmarks,
    ...intel.schools,
    ...intel.retail,
  ];
}

/** Facts chosen for patient-facing synthesis. Healthcare or transport leads when it exists. */
export function selectLocalityIntelligenceForSynthesis(
  intel: LocalityIntelligenceV1,
): LocalityIntelligenceFactV1[] {
  const selected: LocalityIntelligenceFactV1[] = [];
  const push = (fact: LocalityIntelligenceFactV1 | undefined) => {
    if (!fact || selected.some((item) => item.name.toLowerCase() === fact.name.toLowerCase())) return;
    selected.push(fact);
  };
  push(intel.healthcare[0]);
  push(intel.access[0]);
  push(intel.community[0]);
  push(intel.landmarks[0]);
  push(intel.schools[0]);
  push(intel.retail[0]);
  return selected.slice(0, 4);
}

export function assessLocalityEvidenceSufficiency(intel: LocalityIntelligenceV1): {
  classification: LocalityEvidenceSufficiencyV1;
  missing: string[];
} {
  const places = localityIntelligencePlaces(intel);
  if (!places.length) {
    return {
      classification: "insufficient",
      missing: [
        "attributable local place with source provenance (healthcare, transport, community, landmark, school, or retail)",
      ],
    };
  }
  const categories = new Set(places.map((fact) => fact.category));
  if (intel.healthcare.length > 0 || intel.access.length > 0 || categories.size >= 2) {
    return { classification: "sufficient", missing: [] };
  }
  return {
    classification: "limited",
    missing: intel.healthcare.length || intel.access.length
      ? []
      : ["healthcare or transport evidence is absent, so the page must stay limited to the verified places on file"],
  };
}
