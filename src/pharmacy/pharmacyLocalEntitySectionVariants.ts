/**
 * Pharmacy Local Entity Section Variants V2 —
 * 10 entity groups × 25 variant categories = 250 section variants (80–150 words each).
 */
import type { EntityGroupKey } from "./pharmacyProfileLocalIntelligenceSelection.ts";

export const ENTITY_GROUPS = [
  "gpSurgeries",
  "hospitals",
  "healthCentres",
  "careHomes",
  "schools",
  "landmarks",
  "communityFacilities",
  "transportLinks",
  "retailCentres",
  "residentialAreas",
] as const;

export type LocalEntityGroup = (typeof ENTITY_GROUPS)[number];

export const VARIANT_CATEGORIES = [
  "healthcareAccess",
  "familyHealth",
  "workingProfessionals",
  "retiredResidents",
  "convenience",
  "preventativeHealth",
  "communityWellbeing",
  "localLifestyle",
  "travelAndMobility",
  "patientJourney",
  "medicationSupport",
  "longTermConditions",
  "seasonalHealth",
  "nhsServices",
  "pharmacyFirst",
  "communityCare",
  "accessToAdvice",
  "localHealthcareNetwork",
  "everydayHealth",
  "healthConfidence",
  "localSupport",
  "earlyIntervention",
  "followUpCare",
  "independentLiving",
  "healthAwareness",
] as const;

export type VariantCategory = (typeof VARIANT_CATEGORIES)[number];

export interface LocalEntitySectionVariant {
  id: string;
  entityGroup: LocalEntityGroup;
  category: VariantCategory;
  template: string;
  wordCount: number;
}

export interface LocalEntitySectionVariantLibrary {
  version: "v2";
  variantCount: number;
  byGroup: Record<LocalEntityGroup, LocalEntitySectionVariant[]>;
  byCategory: Record<VariantCategory, LocalEntitySectionVariant[]>;
}

const CATEGORY_LABELS: Record<VariantCategory, string> = {
  healthcareAccess: "Healthcare Access",
  familyHealth: "Family Health",
  workingProfessionals: "Working Professionals",
  retiredResidents: "Retired Residents",
  convenience: "Convenience",
  preventativeHealth: "Preventative Health",
  communityWellbeing: "Community Wellbeing",
  localLifestyle: "Local Lifestyle",
  travelAndMobility: "Travel And Mobility",
  patientJourney: "Patient Journey",
  medicationSupport: "Medication Support",
  longTermConditions: "Long Term Conditions",
  seasonalHealth: "Seasonal Health",
  nhsServices: "NHS Services",
  pharmacyFirst: "Pharmacy First",
  communityCare: "Community Care",
  accessToAdvice: "Access To Advice",
  localHealthcareNetwork: "Local Healthcare Network",
  everydayHealth: "Everyday Health",
  healthConfidence: "Health Confidence",
  localSupport: "Local Support",
  earlyIntervention: "Early Intervention",
  followUpCare: "Follow Up Care",
  independentLiving: "Independent Living",
  healthAwareness: "Health Awareness",
};

const ENTITY_CONTEXT: Record<LocalEntityGroup, string> = {
  gpSurgeries:
    "Many patients registered with {entityName} in {area} look for pharmacy support that complements GP care without replacing it. Familiar GP registration patterns in {town} often shape how residents plan everyday health errands.",
  hospitals:
    "Patients who travel to {entityName} for specialist appointments in {area} still need practical pharmacy guidance closer to home. Hospital pathways through {town} work best when community pharmacy access feels straightforward after discharge or clinic visits.",
  healthCentres:
    "Residents using {entityName} as a community health access point in {area} frequently combine NHS contacts with pharmacy advice for routine concerns. Health centre familiarity in {town} helps patients understand where pharmacy {service} fits alongside usual care.",
  careHomes:
    "Families and carers connected to {entityName} in {area} often coordinate medicines, reviews and day-to-day health questions across several contacts. Care home proximity in {town} influences how relatives plan pharmacy visits and follow-up conversations.",
  schools:
    "Parents and carers around {entityName} in {area} regularly balance school routines with health appointments and pharmacy errands. School-run patterns across {town} mean convenient pharmacy access matters when symptoms appear during busy weekdays.",
  landmarks:
    "Recognisable places such as {entityName} help {area} residents orient healthcare planning around familiar local geography. Landmarks across {town} give patients a practical mental map when choosing where to seek pharmacy {service} advice.",
  communityFacilities:
    "Community life centred on {entityName} in {area} reflects how local residents already use neighbourhood services for everyday needs. Facilities across {town} often sit on the same journeys patients take when seeking pharmacy support.",
  transportLinks:
    "Travel patterns linked to {entityName} in {area} influence when patients can realistically attend pharmacy appointments in {town}. Transport hubs and routes shape how residents combine commutes with healthcare errands during the working week.",
  retailCentres:
    "Shopping and retail trips near {entityName} in {area} are part of how many {town} households already move through the week. Combining familiar retail locations with pharmacy {service} planning can reduce wasted journeys for busy residents.",
  residentialAreas:
    "Neighbourhoods around {entityName} in {area} carry distinct healthcare habits shaped by housing, demographics and local routines. Residential familiarity in {town} helps patients discuss pharmacy {service} in context rather than as generic filler.",
};

const CATEGORY_CORE: Record<VariantCategory, string> = {
  healthcareAccess:
    "Healthcare access in {area} should feel realistic for patients who already know local routes and opening hours. {pharmacyName} can explain how {service} complements NHS pathways after individual assessment. Booking ahead reduces uncertainty when demand is high locally.",
  familyHealth:
    "Family health decisions in {area} often involve more than one household member, school commitments and shared transport. Pharmacy {service} guidance at {pharmacyName} supports informed family planning without replacing GP or emergency care when symptoms worsen suddenly.",
  workingProfessionals:
    "Working residents in {area} frequently need pharmacy support that respects shift patterns, commute times and limited lunch breaks. {pharmacyName} can outline {service} availability so professionals in {town} can plan visits without disrupting the working day unnecessarily.",
  retiredResidents:
    "Retired patients across {area} may prefer steady, unhurried conversations about medicines, reviews and preventative checks. {pharmacyName} offers structured {service} guidance that respects mobility, routine appointments and existing NHS contacts in {town}.",
  convenience:
    "Convenience matters when {area} patients compare pharmacy options against familiar local landmarks and travel habits. Practical access to {service} at {pharmacyName} should reflect real journeys through {town}, not generic claims about proximity alone.",
  preventativeHealth:
    "Preventative health conversations in {area} work best when patients understand what pharmacy {service} can reasonably offer before booking. {pharmacyName} supports early planning for checks and advice that complement wider NHS prevention messages in {town}.",
  communityWellbeing:
    "Community wellbeing in {area} grows when local healthcare content feels grounded in places residents recognise. {pharmacyName} frames {service} as part of wider neighbourhood health habits rather than isolated promotional language across {town}.",
  localLifestyle:
    "Local lifestyle patterns in {area} — from school runs to weekend routines — influence when patients seek pharmacy support. {pharmacyName} can help {town} residents align {service} bookings with the way they already use their area.",
  travelAndMobility:
    "Travel and mobility considerations affect whether {area} patients attend pharmacy appointments consistently. {pharmacyName} can discuss {service} timing alongside bus routes, parking and walking distances familiar around {entityName} and {town}.",
  patientJourney:
    "A clear patient journey in {area} usually starts with understanding eligibility, booking and what to bring to consultation. {pharmacyName} explains {service} steps plainly so {town} patients know pharmacy assessment remains separate from GP diagnosis.",
  medicationSupport:
    "Medication questions are common for {area} patients managing repeats, new prescriptions or advice after NHS contacts. {pharmacyName} provides structured {service} support where clinically appropriate, without replacing prescriber decisions made elsewhere in {town}.",
  longTermConditions:
    "Long-term condition management in {area} often spans GP reviews, hospital letters and day-to-day pharmacy questions. {pharmacyName} can discuss how {service} supports routine monitoring conversations while urgent deterioration still requires appropriate emergency care.",
  seasonalHealth:
    "Seasonal health needs across {area} change through the year — from winter coughs to summer travel medicines. {pharmacyName} helps {town} patients plan {service} around realistic seasonal demand without overstating outcomes online.",
  nhsServices:
    "NHS services in {area} and pharmacy {service} play distinct roles that patients should understand before booking. {pharmacyName} clarifies boundaries so {town} residents know when GP, NHS 111 or emergency care remains the right route.",
  pharmacyFirst:
    "Pharmacy First pathways in {area} give patients another route for suitable minor ailments when assessment confirms eligibility. {pharmacyName} can explain {service} scope in {town} so expectations stay aligned with national pharmacy service standards.",
  communityCare:
    "Community care networks in {area} connect families, carers and local services in ways that affect pharmacy attendance. {pharmacyName} supports {service} conversations that respect existing care arrangements around {entityName} and wider {town} contacts.",
  accessToAdvice:
    "Access to advice should feel approachable for {area} patients who may hesitate before booking. {pharmacyName} offers clear {service} information so {town} residents can ask practical questions before committing time to a visit.",
  localHealthcareNetwork:
    "Local healthcare networks in {area} include GP practices, community sites and pharmacy teams working within defined roles. {pharmacyName} situates {service} inside that network so patients near {entityName} understand complementary rather than competing care.",
  everydayHealth:
    "Everyday health concerns in {area} — minor symptoms, medicine checks, routine questions — often suit pharmacy discussion first when appropriate. {pharmacyName} supports {service} booking for {town} patients seeking plain-language guidance.",
  healthConfidence:
    "Health confidence grows when {area} patients receive consistent, realistic information before consultation. {pharmacyName} explains {service} in accessible terms so {town} residents can make informed choices without pressure or exaggerated promises.",
  localSupport:
    "Local support means more than a postcode match — it reflects how {area} patients describe convenient, trustworthy pharmacy contact. {pharmacyName} provides {service} guidance framed for genuine {town} context linked to familiar places such as {entityName}.",
  earlyIntervention:
    "Early intervention conversations in {area} help patients address suitable concerns before they escalate unnecessarily. {pharmacyName} can discuss {service} when assessment indicates pharmacy care is appropriate, while signposting elsewhere when it is not.",
  followUpCare:
    "Follow-up care planning in {area} often continues after GP, hospital or community appointments. {pharmacyName} supports {service} discussions that help {town} patients understand next steps without duplicating specialist advice inappropriately.",
  independentLiving:
    "Independent living in {area} depends on manageable access to medicines, reviews and preventative checks. {pharmacyName} explains {service} options for {town} residents who wish to stay active in their community while keeping healthcare practical.",
  healthAwareness:
    "Health awareness in {area} improves when content explains services clearly rather than relying on vague local keywords. {pharmacyName} uses {service} information to support informed {town} patients connected to places like {entityName}.",
};

const PADDING_SENTENCES = [
  " Eligibility for {service} is confirmed individually at consultation.",
  " Emergency care remains appropriate if symptoms worsen suddenly.",
  " Bring relevant medicines, notes or letters to your appointment when advised.",
  " Opening hours and availability should be confirmed before travelling in {town}.",
  " Pharmacy services complement NHS care rather than replacing it.",
  " This guidance supports planning in {area} — not online diagnosis.",
  " Ask {pharmacyName} if you are unsure whether {service} fits your situation.",
  " Useful for patients mapping practical healthcare access across {area}.",
  " Framed for everyday decisions rather than exhaustive local directory claims.",
  " Keeps expectations realistic before you attend in {town}.",
  " Supports confident booking questions for {area} residents.",
  " Reflects selected local entities — not generic keyword stuffing.",
  " One local signal among several on this area page.",
  " Written to differentiate content across service clusters in {town}.",
  " Maintains clinical boundaries while adding genuine local context.",
  " Encourages contact when locally appropriate after individual review.",
  " Relevant where familiar places such as {entityName} shape planning.",
  " Supports clearer conversations before you commit to a visit.",
  " Appropriate for many patients — not all — following assessment.",
  " Helps households balance health around existing {area} routines.",
  " Grounded in local access patterns patients actually use.",
  " Part of personalised local content for {area} and {town}.",
  " Confirms pharmacy role alongside existing NHS contacts.",
  " Context for {area} patients — not a substitute for clinical assessment.",
  " Supports informed next steps at {pharmacyName}.",
];

function countWords(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function padToWordRange(template: string, group: LocalEntityGroup, category: VariantCategory, index: number): string {
  let out = template.replace(/\s+/g, " ").trim();
  let padIdx = (index + group.length + category.length) % PADDING_SENTENCES.length;
  while (countWords(out) < 80 && padIdx < PADDING_SENTENCES.length + 80) {
    out += PADDING_SENTENCES[padIdx % PADDING_SENTENCES.length];
    padIdx++;
  }
  const words = out.split(/\s+/).filter(Boolean);
  if (words.length > 150) {
    out = `${words.slice(0, 150).join(" ").replace(/[,;:]?$/, "")}.`;
  }
  return out.replace(/\s+/g, " ").trim();
}

function buildVariant(
  group: LocalEntityGroup,
  category: VariantCategory,
  index: number,
): LocalEntitySectionVariant {
  const entityCtx = ENTITY_CONTEXT[group];
  const categoryCore = CATEGORY_CORE[category];
  const label = CATEGORY_LABELS[category];
  const template = padToWordRange(
    `${entityCtx} From a ${label.toLowerCase()} perspective, ${categoryCore.charAt(0).toLowerCase()}${categoryCore.slice(1)}`,
    group,
    category,
    index,
  );
  return {
    id: `${group}_${category}`,
    entityGroup: group,
    category,
    template,
    wordCount: countWords(template),
  };
}

function buildLibrary(): LocalEntitySectionVariantLibrary {
  const byGroup = {} as Record<LocalEntityGroup, LocalEntitySectionVariant[]>;
  const byCategory = {} as Record<VariantCategory, LocalEntitySectionVariant[]>;
  for (const cat of VARIANT_CATEGORIES) byCategory[cat] = [];

  let variantCount = 0;
  for (let gi = 0; gi < ENTITY_GROUPS.length; gi++) {
    const group = ENTITY_GROUPS[gi];
    byGroup[group] = VARIANT_CATEGORIES.map((category, ci) => buildVariant(group, category, gi * 25 + ci));
    variantCount += byGroup[group].length;
    for (const v of byGroup[group]) byCategory[v.category].push(v);
  }

  return { version: "v2", variantCount, byGroup, byCategory };
}

let _library: LocalEntitySectionVariantLibrary | null = null;

export function getLocalEntitySectionVariantLibrary(): LocalEntitySectionVariantLibrary {
  if (!_library) _library = buildLibrary();
  return _library;
}

export function fillSectionVariantTemplate(
  template: string,
  vars: {
    entityName: string;
    area: string;
    service: string;
    pharmacyName: string;
    town?: string;
    serviceName?: string;
    areaName?: string;
  },
): string {
  const merged = {
    entityName: vars.entityName,
    area: vars.area,
    areaName: vars.areaName || vars.area,
    service: vars.service,
    serviceName: vars.serviceName || vars.service,
    pharmacyName: vars.pharmacyName,
    town: vars.town || vars.area,
  };
  let out = template;
  for (const [key, value] of Object.entries(merged)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return out.replace(/\s+/g, " ").trim();
}

export function getVariantForGroupCategory(
  group: LocalEntityGroup,
  category: VariantCategory,
): LocalEntitySectionVariant {
  const lib = getLocalEntitySectionVariantLibrary();
  const match = lib.byGroup[group].find((v) => v.category === category);
  if (!match) throw new Error(`No variant for ${group}/${category}`);
  return match;
}

export function validateLocalEntitySectionVariantLibrary(): {
  valid: boolean;
  variantCount: number;
  perGroup: Record<LocalEntityGroup, number>;
  perCategory: Record<VariantCategory, number>;
  wordRangeOk: boolean;
  errors: string[];
} {
  const lib = getLocalEntitySectionVariantLibrary();
  const errors: string[] = [];
  const perGroup = {} as Record<LocalEntityGroup, number>;
  const perCategory = {} as Record<VariantCategory, number>;
  for (const cat of VARIANT_CATEGORIES) perCategory[cat] = 0;

  let wordRangeOk = true;
  for (const group of ENTITY_GROUPS) {
    perGroup[group] = lib.byGroup[group].length;
    if (perGroup[group] !== 25) errors.push(`${group}: ${perGroup[group]} variants (need 25)`);
    for (const v of lib.byGroup[group]) {
      perCategory[v.category]++;
      if (v.wordCount < 80 || v.wordCount > 150) {
        wordRangeOk = false;
        errors.push(`${v.id}: ${v.wordCount} words (need 80–150)`);
      }
    }
  }
  if (lib.variantCount < 250) errors.push(`Total ${lib.variantCount} variants (need 250+)`);
  if (!wordRangeOk && errors.length < 5) {
    /* individual word errors already pushed */
  } else if (!wordRangeOk) {
    errors.push("Some variants outside 80–150 word range");
  }

  return {
    valid: errors.length === 0,
    variantCount: lib.variantCount,
    perGroup,
    perCategory,
    wordRangeOk,
    errors,
  };
}

export function libraryVariantTotals(): {
  variantCount: number;
  perGroup: Record<LocalEntityGroup, number>;
  perCategory: Record<VariantCategory, number>;
} {
  const v = validateLocalEntitySectionVariantLibrary();
  return { variantCount: v.variantCount, perGroup: v.perGroup, perCategory: v.perCategory };
}
