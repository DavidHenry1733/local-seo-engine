/**
 * Locality page strategy V1 — reconnects evidence-led cross-locality variation.
 * Uses locality intelligence packs + deterministic selection (not area-name synonyms).
 */
import { hashSeed } from "../pharmacyLayoutTemplateLibrary.ts";
import { slugifyArea } from "../pharmacyAreaNarrativeProfiles.ts";
import type { LocalityIntelPack } from "./pharmacyLocalityIntelligencePackV1.ts";

export type LocalityPageStrategyId =
  | "access-led"
  | "community-led"
  | "convenience-led"
  | "patient-journey-led"
  | "landmark-led"
  | "primary-care-led";

export type LocalityNarrativeSlot =
  | "why"
  | "how"
  | "conditions"
  | "consultation"
  | "travel"
  | "gp"
  | "faq"
  | "cta"
  | "nearby";

export type LocalityPageStrategyPlan = {
  strategyId: LocalityPageStrategyId;
  label: string;
  sectionOrder: LocalityNarrativeSlot[];
  headings: Record<
    "why" | "how" | "conditions" | "consultation" | "travel" | "gp" | "faq" | "book" | "nearby",
    string
  >;
  evidenceFocus: Array<"roads" | "landmarks" | "shopping" | "schools" | "transport" | "gp" | "neighbours">;
  faqRotate: number;
  ctaFrame: "call-first" | "directions-first" | "book-first" | "check-suitability";
  nearbyIntroStyle: "community" | "travel" | "family" | "corridor";
  heroMode: "access" | "community" | "convenience" | "journey" | "landmark" | "primaryCare";
};

const ALL_STRATEGIES: LocalityPageStrategyId[] = [
  "access-led",
  "community-led",
  "convenience-led",
  "patient-journey-led",
  "landmark-led",
  "primary-care-led",
];

function scoreStrategy(pack: LocalityIntelPack, strategy: LocalityPageStrategyId): number {
  const roads = pack.roads.length;
  const landmarks = pack.landmarks.length;
  const shopping = pack.shopping.length;
  const schools = pack.schools.length;
  const transport = pack.transport.length;
  const gp = pack.gpSurgeries.length;
  const parks = pack.parks.length;
  const context = pack.localContext.length;
  switch (strategy) {
    case "access-led":
      // Strong only when transport/travel notes dominate — avoid roads alone collapsing every Leeds page.
      return transport * 4 + pack.travelNotes.length * 3 + roads;
    case "community-led":
      return shopping * 4 + schools * 4 + pack.neighbouring.length * 2 + context;
    case "convenience-led":
      return shopping * 3 + transport * 2 + roads + schools * 2;
    case "patient-journey-led":
      return 8 + hashSeed(slugifyArea(pack.areaName), "journey") % 3;
    case "landmark-led":
      return landmarks * 5 + parks * 4 + context;
    case "primary-care-led":
      return gp * 6 + pack.travelNotes.length * 2 + context;
    default:
      return 0;
  }
}

function headingsFor(
  strategy: LocalityPageStrategyId,
  area: string,
  pharmacy: string,
  service: string,
): LocalityPageStrategyPlan["headings"] {
  switch (strategy) {
    case "access-led":
      return {
        why: `Why patients travelling from ${area} choose ${pharmacy}`,
        how: `How ${service} supports ${area} residents`,
        conditions: `Which conditions ${service} can assess`,
        consultation: `What to expect when you arrive`,
        travel: `Directions from ${area}`,
        gp: `When pharmacy care is not enough`,
        faq: `${service} questions from ${area}`,
        book: `Call before you travel from ${area}`,
        nearby: `Other areas we also support`,
      };
    case "community-led":
      return {
        why: `A practical pharmacy choice for the ${area} community`,
        how: `Using ${service} from ${area}`,
        conditions: `${service} conditions explained`,
        consultation: `Inside the ${service} consultation`,
        travel: `Getting to ${pharmacy} from ${area}`,
        gp: `GP and emergency guidance`,
        faq: `Common questions for ${area} patients`,
        book: `Speak to the ${pharmacy} team`,
        nearby: `Nearby communities we also help`,
      };
    case "convenience-led":
      return {
        why: `Convenient pharmacist care for people around ${area}`,
        how: `What ${service} offers locally`,
        conditions: `Conditions suitable for ${service}`,
        consultation: `How your consultation works`,
        travel: `Practical access from ${area}`,
        gp: `Safety-netting and urgent care`,
        faq: `Common questions from ${area}`,
        book: `Check availability for ${area}`,
        nearby: `Areas close to ${area} we also help`,
      };
    case "patient-journey-led":
      return {
        why: `Why ${area} patients start with the pharmacist`,
        how: `How ${service} can help`,
        conditions: `Conditions ${service} may cover`,
        consultation: `What happens during the consultation`,
        travel: `Travelling to ${pharmacy}`,
        gp: `When to contact a GP, NHS 111 or emergency services`,
        faq: `Frequently asked questions`,
        book: `Book, call or get directions`,
        nearby: `Nearby areas we also help`,
      };
    case "landmark-led":
      return {
        why: `Orientating pharmacy care around ${area}`,
        how: `${service} for patients near local landmarks`,
        conditions: `Conditions ${service} can cover`,
        consultation: `Your consultation step by step`,
        travel: `Finding ${pharmacy} from ${area}`,
        gp: `When to seek GP or urgent care instead`,
        faq: `Landmark-area patient questions`,
        book: `Plan your visit from ${area}`,
        nearby: `Neighbouring places we also help`,
      };
    case "primary-care-led":
      return {
        why: `Pharmacy support that complements local primary care`,
        how: `How ${service} fits alongside GP care`,
        conditions: `${service} conditions explained`,
        consultation: `Assessment and advice options`,
        travel: `Reach ${pharmacy} from ${area}`,
        gp: `When to go back to your GP or urgent care`,
        faq: `Common questions for ${area} patients`,
        book: `Confirm suitability before you travel`,
        nearby: `Other localities we support`,
      };
    default:
      return headingsFor("patient-journey-led", area, pharmacy, service);
  }
}

function sectionOrderFor(strategy: LocalityPageStrategyId): LocalityNarrativeSlot[] {
  switch (strategy) {
    case "access-led":
      return ["why", "travel", "how", "conditions", "consultation", "gp", "faq", "cta", "nearby"];
    case "community-led":
      return ["why", "conditions", "how", "consultation", "travel", "gp", "faq", "cta", "nearby"];
    case "convenience-led":
      return ["why", "how", "consultation", "conditions", "travel", "gp", "faq", "cta", "nearby"];
    case "patient-journey-led":
      // Approved Headingley commercial sequence.
      return ["why", "how", "conditions", "consultation", "travel", "gp", "faq", "cta", "nearby"];
    case "landmark-led":
      return ["why", "how", "travel", "conditions", "consultation", "gp", "faq", "cta", "nearby"];
    case "primary-care-led":
      return ["why", "how", "gp", "conditions", "consultation", "travel", "faq", "cta", "nearby"];
    default:
      return ["why", "how", "conditions", "consultation", "travel", "gp", "faq", "cta", "nearby"];
  }
}

function evidenceFocusFor(
  strategy: LocalityPageStrategyId,
  pack?: LocalityIntelPack,
): LocalityPageStrategyPlan["evidenceFocus"] {
  const has = (items?: string[]) => Array.isArray(items) && items.some((item) => String(item || "").trim());
  switch (strategy) {
    case "access-led":
      return has(pack?.roads) ? ["roads", "transport"] : ["transport"];
    case "community-led":
      return ["shopping", "schools", "neighbours"];
    case "convenience-led":
      return has(pack?.roads) ? ["shopping", "roads", "transport"] : ["shopping", "transport"];
    case "patient-journey-led": {
      const focus: LocalityPageStrategyPlan["evidenceFocus"] = ["gp", "landmarks", "transport", "shopping", "schools"];
      if (has(pack?.roads)) focus.unshift("roads");
      return focus;
    }
    case "landmark-led":
      return has(pack?.roads) ? ["landmarks", "roads"] : ["landmarks"];
    case "primary-care-led":
      return has(pack?.roads) ? ["gp", "roads"] : ["gp"];
    default:
      return ["gp", "landmarks", "transport"];
  }
}

function buildPlan(
  strategy: LocalityPageStrategyId,
  area: string,
  pharmacy: string,
  service: string,
  faqRotate: number,
  pack?: LocalityIntelPack,
): LocalityPageStrategyPlan {
  const ctaFrameByStrategy: Record<LocalityPageStrategyId, LocalityPageStrategyPlan["ctaFrame"]> = {
    "access-led": "directions-first",
    "community-led": "call-first",
    "convenience-led": "check-suitability",
    "patient-journey-led": "book-first",
    "landmark-led": "directions-first",
    "primary-care-led": "check-suitability",
  };
  const nearbyByStrategy: Record<LocalityPageStrategyId, LocalityPageStrategyPlan["nearbyIntroStyle"]> = {
    "access-led": "travel",
    "community-led": "community",
    "convenience-led": "family",
    "patient-journey-led": "community",
    "landmark-led": "corridor",
    "primary-care-led": "travel",
  };
  const heroByStrategy: Record<LocalityPageStrategyId, LocalityPageStrategyPlan["heroMode"]> = {
    "access-led": "access",
    "community-led": "community",
    "convenience-led": "convenience",
    "patient-journey-led": "journey",
    "landmark-led": "landmark",
    "primary-care-led": "primaryCare",
  };
  return {
    strategyId: strategy,
    label: strategy,
    sectionOrder: sectionOrderFor(strategy),
    headings: headingsFor(strategy, area, pharmacy, service),
    evidenceFocus: evidenceFocusFor(strategy, pack),
    faqRotate,
    ctaFrame: ctaFrameByStrategy[strategy],
    nearbyIntroStyle: nearbyByStrategy[strategy],
    heroMode: heroByStrategy[strategy],
  };
}

/**
 * Deterministic strategy for one locality. Prefer unused strategies across siblings.
 * Headingley is pinned to patient-journey-led to protect the approved commercial sequence.
 */
export function resolveLocalityPageStrategyV1(input: {
  areaName: string;
  areaSlug: string;
  pharmacyName: string;
  serviceName: string;
  pack: LocalityIntelPack;
  areaIndex: number;
  usedStrategies?: Set<LocalityPageStrategyId>;
  forceStrategy?: LocalityPageStrategyId;
}): LocalityPageStrategyPlan {
  const area = input.areaName.trim() || "your area";
  const pharmacy = input.pharmacyName.trim() || "our pharmacy";
  const service = input.serviceName.trim() || "Pharmacy First";
  const slug = slugifyArea(input.areaSlug || area);
  const faqRotate = hashSeed(slug, "faq-rotate", String(input.areaIndex)) % 6;

  if (slug === "headingley") {
    return buildPlan("patient-journey-led", area, pharmacy, service, faqRotate, input.pack);
  }
  if (input.forceStrategy) {
    return buildPlan(input.forceStrategy, area, pharmacy, service, faqRotate, input.pack);
  }

  const used = input.usedStrategies || new Set<LocalityPageStrategyId>();
  // patient-journey-led is reserved for the approved Headingley commercial sequence.
  const available = ALL_STRATEGIES.filter(
    (strategy) => strategy !== "patient-journey-led" && !used.has(strategy),
  );
  const pool =
    available.length > 0
      ? available
      : ALL_STRATEGIES.filter((strategy) => strategy !== "patient-journey-led");

  const ranked = pool
    .map((strategy) => ({
      strategy,
      score: scoreStrategy(input.pack, strategy) * 10 + (hashSeed(slug, strategy) % 7),
    }))
    .sort((a, b) => b.score - a.score);

  const chosen = ranked[0]?.strategy || "access-led";
  return buildPlan(chosen, area, pharmacy, service, faqRotate, input.pack);
}

export function nextStrategyCandidate(
  current: LocalityPageStrategyId,
  used: Set<LocalityPageStrategyId>,
): LocalityPageStrategyId {
  const pool = ALL_STRATEGIES.filter((strategy) => strategy !== "patient-journey-led");
  const start = Math.max(0, pool.indexOf(current as (typeof pool)[number]));
  for (let i = 1; i <= pool.length; i++) {
    const candidate = pool[(start + i) % pool.length]!;
    if (!used.has(candidate)) return candidate;
  }
  return pool[(start + 1) % pool.length] || "access-led";
}
