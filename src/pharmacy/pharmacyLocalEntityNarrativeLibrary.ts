/**
 * Pharmacy Local Entity Narrative Library V1 —
 * 8 entity types × 5 categories × 25 patterns = 1,000 narrative blocks.
 */
export const ENTITY_TYPES = [
  "gpSurgery",
  "hospital",
  "healthCentre",
  "careHome",
  "school",
  "employer",
  "landmark",
  "communityFacility",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const NARRATIVE_CATEGORIES = [
  "healthcareAccess",
  "patientJourney",
  "convenience",
  "localCommunity",
  "ctaSupport",
] as const;

export type NarrativeCategory = (typeof NARRATIVE_CATEGORIES)[number];

export interface EntityNarrativeBlock {
  id: string;
  entityType: EntityType;
  category: NarrativeCategory;
  template: string;
}

export interface EntityNarrativeLibrary {
  version: "v1";
  blockCount: number;
  byType: Record<EntityType, EntityNarrativeBlock[]>;
}

export const PROFILE_GROUP_TO_ENTITY_TYPE: Record<string, EntityType> = {
  gpSurgeries: "gpSurgery",
  hospitals: "hospital",
  healthCentres: "healthCentre",
  careHomes: "careHome",
  schools: "school",
  majorEmployers: "employer",
  landmarks: "landmark",
  communityFacilities: "communityFacility",
};

const CATEGORY_LABELS: Record<NarrativeCategory, string> = {
  healthcareAccess: "healthcare access",
  patientJourney: "patient journey",
  convenience: "convenience",
  localCommunity: "local community",
  ctaSupport: "CTA support",
};

function baseTemplates(entityType: EntityType): Record<NarrativeCategory, string[]> {
  const t: Record<EntityType, Record<NarrativeCategory, string[]>> = {
    gpSurgery: {
      healthcareAccess: [
        "Patients registered with {entityName} often look for convenient healthcare services closer to home. Community pharmacy services can help support access to everyday healthcare advice and treatment.",
        "Many {areaName} residents registered at {entityName} use pharmacy services for advice that complements GP appointments without replacing them.",
        "If your GP practice is {entityName}, pharmacy {serviceName} can offer practical support while you wait for a GP review when appropriate.",
        "Patients linked to {entityName} frequently ask about pharmacy access for routine checks and medicine questions in {areaName}.",
        "For those registered with {entityName}, {pharmacyName} provides structured pharmacy support alongside your usual GP care.",
      ],
      patientJourney: [
        "Your journey often starts with {entityName} for ongoing care, then pharmacy for day-to-day support in {areaName}.",
        "Patients registered at {entityName} typically confirm eligibility before booking pharmacy {serviceName}.",
        "Many {areaName} patients at {entityName} plan pharmacy visits after GP advice or while awaiting review.",
        "If {entityName} manages your repeat prescriptions, pharmacy can help with related questions locally.",
        "GP registration at {entityName} does not replace pharmacy assessment — both play distinct roles.",
      ],
      convenience: [
        "Convenient pharmacy access matters for {areaName} patients connected to {entityName}.",
        "Proximity to {entityName} makes practical pharmacy visits easier for {areaName} residents.",
        "When {entityName} is part of your local map, {pharmacyName} offers reachable pharmacy {serviceName}.",
        "Short journeys from {entityName} support regular pharmacy attendance in {areaName}.",
        "Patients referencing {entityName} often prefer pharmacy services within their usual travel radius.",
      ],
      localCommunity: [
        "{entityName} is a recognised GP practice in {areaName} — local pharmacy services support the wider community health picture.",
        "Community life around {entityName} includes everyday health needs that pharmacy {serviceName} can address appropriately.",
        "Residents who know {entityName} often appreciate healthcare that feels locally grounded in {areaName}.",
        "{pharmacyName} serves patients across {areaName}, including those connected to {entityName}.",
        "Local identity around {entityName} reflects how {areaName} patients think about convenient healthcare access.",
      ],
      ctaSupport: [
        "If {entityName} is part of your local routine in {areaName}, contact {pharmacyName} to discuss {serviceName}.",
        "Patients linked to {entityName} can enquire about pharmacy {serviceName} at {pharmacyName} in {town}.",
        "Planning around {entityName}? {pharmacyName} can help with {serviceName} when clinically appropriate.",
        "For {areaName} residents connected to {entityName}, speak to {pharmacyName} about suitable pharmacy support.",
        "Contact {pharmacyName} for {serviceName} — especially if {entityName} shapes your local healthcare planning.",
      ],
    },
    hospital: {
      healthcareAccess: [
        "Patients attending appointments at {entityName} may benefit from convenient access to pharmacy support before or after their hospital visit.",
        "If you travel to {entityName} for specialist care, local pharmacy services in {areaName} can help with practical medicine questions.",
        "Hospital visits to {entityName} are often planned in advance — pharmacy {serviceName} can fit around appointment dates when clinically suitable.",
        "After attending {entityName}, patients in {areaName} sometimes need pharmacy guidance on medicines discussed at hospital.",
        "Travelling from {areaName} to {entityName} for care makes local pharmacy access valuable for day-to-day health support at home.",
      ],
      patientJourney: [
        "Hospital pathways via {entityName} may include pharmacy follow-up for medicines discussed at discharge or clinic.",
        "Before travelling to {entityName}, patients in {areaName} sometimes clarify pharmacy options locally.",
        "After {entityName} appointments, pharmacy {serviceName} can support practical next steps when appropriate.",
        "Specialist care at {entityName} often continues with GP and pharmacy support closer to home.",
        "Planning around {entityName} visits helps {areaName} patients fit pharmacy care into their schedule.",
      ],
      convenience: [
        "Patients near {entityName} value pharmacy access that does not require additional long journeys.",
        "Combining hospital visits to {entityName} with local pharmacy planning can simplify follow-up in {areaName}.",
        "When {entityName} is on your calendar, {pharmacyName} can clarify {serviceName} timing in advance.",
        "Residents around {areaName} often coordinate pharmacy contact before or after {entityName} appointments.",
        "Practical access near {entityName} supports realistic healthcare planning for {areaName} patients.",
      ],
      localCommunity: [
        "{entityName} is a major healthcare anchor for {areaName} — pharmacy services complement hospital pathways locally.",
        "Hospital contact through {entityName} does not replace community pharmacy advice for everyday concerns.",
        "Patients across {town} and {areaName} use {entityName} alongside local pharmacy support.",
        "{pharmacyName} supports {areaName} residents who also attend {entityName} for specialist care.",
        "Community understanding of {entityName} helps patients plan realistic pharmacy follow-up in {areaName}.",
      ],
      ctaSupport: [
        "Attending {entityName}? Contact {pharmacyName} about {serviceName} if you need pharmacy guidance in {areaName}.",
        "Patients visiting {entityName} can speak to {pharmacyName} about {serviceName} when clinically suitable.",
        "For follow-up questions after {entityName}, {pharmacyName} may help with {serviceName} following assessment.",
        "If {entityName} is part of your care plan, ask {pharmacyName} how {serviceName} fits locally.",
        "Reach {pharmacyName} in {town} to discuss {serviceName} alongside hospital care at {entityName}.",
      ],
    },
    healthCentre: {
      healthcareAccess: [
        "Patients using {entityName} for community healthcare often appreciate pharmacy services that complement NHS access in {areaName}.",
        "Health centre patients at {entityName} may use pharmacy {serviceName} for advice that supports their usual care pathway.",
        "Residents near {entityName} frequently combine health centre appointments with pharmacy support for everyday health needs.",
        "If {entityName} is your local health access point, {pharmacyName} can provide structured pharmacy guidance in {areaName}.",
        "Community health services at {entityName} work alongside pharmacy care for patients across {areaName}.",
      ],
      patientJourney: [
        "Health centre users at {entityName} often combine NHS access with pharmacy advice for everyday concerns.",
        "Your local pathway may include {entityName} for community care and pharmacy for structured support.",
        "Patients visiting {entityName} should treat pharmacy {serviceName} as a separate booked service.",
        "Community healthcare at {entityName} and pharmacy services in {areaName} address different needs.",
        "If {entityName} is your first contact point, pharmacy can complement — not duplicate — that care.",
      ],
      convenience: [
        "Health centre routines around {entityName} make nearby pharmacy access useful for {areaName} patients.",
        "Patients visiting {entityName} may plan {serviceName} around existing appointment times.",
        "When {entityName} is nearby, {pharmacyName} offers practical pharmacy support in {areaName}.",
        "Short journeys between {entityName} and {pharmacyName} help patients maintain regular contact.",
        "Convenient planning near {entityName} supports realistic attendance for {serviceName}.",
      ],
      localCommunity: [
        "{entityName} reflects how {areaName} residents access community healthcare locally.",
        "Health centre contact at {entityName} sits alongside pharmacy advice for everyday patient needs.",
        "Patients connected to {entityName} often value locally grounded pharmacy guidance.",
        "{pharmacyName} supports residents who use {entityName} as a community health hub.",
        "Local healthcare in {areaName} includes both {entityName} and pharmacy-led services where appropriate.",
      ],
      ctaSupport: [
        "Use {entityName} for NHS community care and contact {pharmacyName} about {serviceName} when pharmacy support is needed.",
        "Patients at {entityName} can enquire about {serviceName} at {pharmacyName} in {town}.",
        "If {entityName} is your usual access point, ask {pharmacyName} whether {serviceName} is suitable.",
        "For {areaName} residents using {entityName}, {pharmacyName} explains {serviceName} after individual assessment.",
        "Speak to {pharmacyName} about {serviceName} alongside community care at {entityName}.",
      ],
    },
    careHome: {
      healthcareAccess: [
        "Families supporting residents linked to {entityName} often value clear pharmacy advice for medicine questions and health checks.",
        "Care settings such as {entityName} mean relatives in {areaName} may need pharmacy support they can access independently.",
        "When a loved one is connected to {entityName}, pharmacy {serviceName} can offer practical guidance for family carers.",
        "Patients and families associated with {entityName} often plan pharmacy visits around care home routines.",
        "Pharmacy services near {entityName} support families in {areaName} with accessible health advice.",
      ],
      patientJourney: [
        "Families supporting care at {entityName} often manage their own health needs through local pharmacy.",
        "Visiting {entityName} may prompt questions about medicines — pharmacy can clarify for carers in {areaName}.",
        "Care home connections to {entityName} mean pharmacy visits are often planned around family availability.",
        "Relatives linked to {entityName} value pharmacy guidance they can access independently.",
        "The care journey involving {entityName} often includes separate pharmacy support for family members.",
      ],
      convenience: [
        "Family carers visiting {entityName} may combine trips with pharmacy contact in {areaName}.",
        "Practical access near {entityName} helps relatives fit {serviceName} around visiting schedules.",
        "When {entityName} is part of your week, plan pharmacy visits realistically with {pharmacyName}.",
        "Carers around {entityName} often need flexible pharmacy access in {areaName}.",
        "Convenient pharmacy planning supports families connected to {entityName}.",
      ],
      localCommunity: [
        "{entityName} is part of the care landscape in {areaName} — pharmacy services support families locally.",
        "Community care through {entityName} often involves relatives seeking their own health advice nearby.",
        "Families linked to {entityName} appreciate pharmacy guidance that respects care routines.",
        "{pharmacyName} serves carers and residents connected to {entityName} across {areaName}.",
        "Local care networks around {entityName} include pharmacy support for family members.",
      ],
      ctaSupport: [
        "Supporting someone at {entityName}? Contact {pharmacyName} about {serviceName} for your own health needs.",
        "Family carers near {entityName} can ask {pharmacyName} about {serviceName} in {town}.",
        "If {entityName} is part of your caring responsibilities, speak to {pharmacyName} about suitable pharmacy support.",
        "Relatives visiting {entityName} may enquire about {serviceName} at {pharmacyName}.",
        "Contact {pharmacyName} for {serviceName} — especially when caring for someone linked to {entityName}.",
      ],
    },
    school: {
      healthcareAccess: [
        "Parents and carers near {entityName} often need healthcare services that fit around school hours and term-time routines.",
        "Families connected to {entityName} in {areaName} frequently look for pharmacy access before or after the school day.",
        "School communities around {entityName} benefit from pharmacy {serviceName} that respects busy family schedules.",
        "If your children attend {entityName}, {pharmacyName} offers pharmacy support that can align with family timetables.",
        "Term-time routines near {entityName} make convenient pharmacy access important for {areaName} families.",
      ],
      patientJourney: [
        "School runs near {entityName} shape when {areaName} families can attend pharmacy appointments.",
        "Parents connected to {entityName} often book pharmacy {serviceName} outside peak school hours.",
        "Family healthcare journeys near {entityName} include planning around term dates and holidays.",
        "If {entityName} is central to your week, pharmacy access should fit that rhythm.",
        "School-community life around {entityName} influences how families use pharmacy in {areaName}.",
      ],
      convenience: [
        "Families near {entityName} value pharmacy access before morning drop-off or after collection.",
        "Planning {serviceName} around {entityName} hours helps {areaName} parents avoid wasted trips.",
        "When {entityName} defines your routine, {pharmacyName} can clarify appointment timing.",
        "Convenient pharmacy contact supports busy parents connected to {entityName}.",
        "Short journeys from {entityName} to {pharmacyName} help families maintain regular health contact.",
      ],
      localCommunity: [
        "{entityName} is part of everyday life in {areaName} — pharmacy services support family health locally.",
        "School communities around {entityName} often need practical pharmacy advice for household health.",
        "Parents linked to {entityName} appreciate clear guidance on {serviceName} from {pharmacyName}.",
        "Family life near {entityName} includes planning healthcare around shared schedules.",
        "Local schools such as {entityName} reflect how {areaName} families structure health appointments.",
      ],
      ctaSupport: [
        "Parents near {entityName} can contact {pharmacyName} to discuss {serviceName} for the family.",
        "If {entityName} shapes your week, ask {pharmacyName} about {serviceName} timing in {town}.",
        "Families connected to {entityName} may enquire about {serviceName} at {pharmacyName}.",
        "For household health near {entityName}, speak to {pharmacyName} about {serviceName}.",
        "Contact {pharmacyName} for {serviceName} — especially when planning around {entityName}.",
      ],
    },
    employer: {
      healthcareAccess: [
        "Employees working for organisations such as {entityName} often value healthcare services that can fit around busy working schedules.",
        "Staff based at or near {entityName} frequently plan pharmacy visits around shift patterns and commute times.",
        "Workers linked to {entityName} in {areaName} may prefer pharmacy {serviceName} with flexible access options.",
        "If you work for {entityName}, {pharmacyName} can support healthcare planning around your working week.",
        "Employers such as {entityName} shape how {areaName} residents schedule healthcare — pharmacy access should reflect that.",
      ],
      patientJourney: [
        "Working at {entityName} means pharmacy visits often happen before shifts, at lunch, or after work.",
        "Employees near {entityName} plan {serviceName} around commuting and meeting schedules.",
        "Work commitments at {entityName} make flexible pharmacy access important for {areaName} staff.",
        "If {entityName} defines your weekday routine, plan pharmacy care accordingly.",
        "Professional schedules linked to {entityName} influence when patients book pharmacy in {areaName}.",
      ],
      convenience: [
        "Staff at {entityName} often need pharmacy access that fits limited break times.",
        "Commuting via {entityName} may allow practical pharmacy contact in {areaName}.",
        "When work at {entityName} is demanding, {pharmacyName} clarifies {serviceName} booking steps upfront.",
        "Convenient pharmacy planning supports employees linked to {entityName}.",
        "Time-aware access near {entityName} helps working patients attend {serviceName}.",
      ],
      localCommunity: [
        "{entityName} is a local employment anchor in {areaName} — pharmacy services support working residents.",
        "Workplace communities around {entityName} often need healthcare that respects shift patterns.",
        "Employees connected to {entityName} value plain-language pharmacy guidance from {pharmacyName}.",
        "Local employment at {entityName} influences when {areaName} patients seek {serviceName}.",
        "Working life near {entityName} is part of the local healthcare context in {areaName}.",
      ],
      ctaSupport: [
        "Working at {entityName}? Contact {pharmacyName} to discuss {serviceName} around your schedule.",
        "Employees near {entityName} can enquire about {serviceName} at {pharmacyName} in {town}.",
        "If {entityName} shapes your working week, ask {pharmacyName} about {serviceName} timing.",
        "Staff linked to {entityName} may speak to {pharmacyName} about suitable pharmacy support.",
        "Reach {pharmacyName} for {serviceName} — especially when balancing work at {entityName}.",
      ],
    },
    landmark: {
      healthcareAccess: [
        "Residents living near {entityName} often use local healthcare services throughout the year and may benefit from convenient access to pharmacy support.",
        "The {entityName} area is a familiar reference point for {areaName} patients planning pharmacy visits.",
        "People who know {entityName} as a local landmark often appreciate pharmacy services within easy reach of daily routes.",
        "Living or travelling near {entityName} makes practical pharmacy access in {areaName} especially useful.",
        "For patients orienting around {entityName}, {pharmacyName} offers pharmacy {serviceName} within the local area.",
      ],
      patientJourney: [
        "Local familiarity with {entityName} helps {areaName} patients plan pharmacy visits along regular routes.",
        "Patients near {entityName} often combine errands with healthcare appointments.",
        "Knowing {entityName} as a reference point makes pharmacy access feel more convenient.",
        "Daily movement around {entityName} influences when residents seek pharmacy {serviceName}.",
        "Landmark-led routines near {entityName} support predictable pharmacy planning in {areaName}.",
      ],
      convenience: [
        "Proximity to {entityName} makes short pharmacy journeys realistic for {areaName} residents.",
        "Patients passing {entityName} may plan {serviceName} around existing local routes.",
        "When {entityName} is on your map, {pharmacyName} is reachable for routine pharmacy contact.",
        "Convenient local orientation around {entityName} supports regular healthcare attendance.",
        "Residents near {entityName} often prefer pharmacy access close to familiar places.",
      ],
      localCommunity: [
        "{entityName} is a recognised local reference in {areaName} — pharmacy care fits naturally into that context.",
        "Community life around {entityName} includes everyday health maintenance for local residents.",
        "Landmarks such as {entityName} help patients describe convenient access to {pharmacyName}.",
        "Local identity near {entityName} reflects how {areaName} residents plan healthcare.",
        "Patients across {areaName} orient healthcare journeys using familiar places like {entityName}.",
      ],
      ctaSupport: [
        "Near {entityName}? Contact {pharmacyName} to discuss {serviceName} in {areaName}.",
        "If {entityName} is part of your local area, ask {pharmacyName} about {serviceName}.",
        "Residents around {entityName} can enquire about {serviceName} at {pharmacyName} in {town}.",
        "For patients near {entityName}, {pharmacyName} explains {serviceName} after individual assessment.",
        "Speak to {pharmacyName} about {serviceName} — especially if you live or travel near {entityName}.",
      ],
    },
    communityFacility: {
      healthcareAccess: [
        "Community facilities such as {entityName} reflect how {areaName} residents connect with local services — pharmacy care fits naturally alongside them.",
        "Patients who use {entityName} often value healthcare access that feels part of the same local community.",
        "If {entityName} is part of your routine in {areaName}, pharmacy {serviceName} can complement community activities.",
        "Local community life around {entityName} includes practical health needs that pharmacy services can support.",
        "{pharmacyName} serves {areaName} patients who also use community facilities such as {entityName}.",
      ],
      patientJourney: [
        "Community involvement at {entityName} often runs alongside regular health maintenance in {areaName}.",
        "Patients active at {entityName} may schedule pharmacy {serviceName} around community commitments.",
        "Local facilities like {entityName} reflect how {areaName} residents structure their week.",
        "Healthcare planning for users of {entityName} should respect existing community routines.",
        "Pharmacy support complements — not replaces — activities connected to {entityName}.",
      ],
      convenience: [
        "Combining visits to {entityName} with pharmacy contact can suit busy {areaName} routines.",
        "When {entityName} is nearby, {pharmacyName} offers practical access for {serviceName}.",
        "Community schedules around {entityName} influence when patients book pharmacy appointments.",
        "Convenient local access near {entityName} supports regular healthcare contact.",
        "Patients using {entityName} often plan pharmacy visits on the same trip when possible.",
      ],
      localCommunity: [
        "{entityName} is part of community life in {areaName} — pharmacy services support residents locally.",
        "Facilities such as {entityName} show how {areaName} patients experience everyday healthcare access.",
        "Community touchpoints like {entityName} sit alongside pharmacy advice from {pharmacyName}.",
        "Local participation at {entityName} reflects shared health needs across {areaName}.",
        "Residents connected to {entityName} value pharmacy guidance that feels community-aware.",
      ],
      ctaSupport: [
        "Use {entityName} for community activities and contact {pharmacyName} about {serviceName} when needed.",
        "If {entityName} is part of your routine, ask {pharmacyName} about {serviceName} in {town}.",
        "Patients linked to {entityName} can enquire about {serviceName} at {pharmacyName}.",
        "For {areaName} residents who use {entityName}, {pharmacyName} explains {serviceName} individually.",
        "Contact {pharmacyName} for {serviceName} — especially if {entityName} is central to your week.",
      ],
    },
  };
  return t[entityType];
}

const VARIANT_SUFFIXES = [
  " Individual suitability is confirmed at consultation.",
  " Always follow your usual clinician's advice for urgent symptoms.",
  " Pharmacy services complement NHS care rather than replacing it.",
  " Booking ahead helps ensure appropriate clinician time.",
  " Ask the pharmacy team if you are unsure whether this service fits your situation.",
  " Bring any relevant medicines or notes to your appointment.",
  " Check opening hours before travelling.",
  " Eligibility is confirmed individually at consultation.",
  " This remains general pharmacy guidance for {areaName} patients.",
  " Escalate to emergency services if symptoms worsen suddenly.",
  " Suitable for many patients — not all — following assessment.",
  " Useful context for planning — not a substitute for clinical review.",
  " Helpful for {areaName} residents mapping local access.",
  " Relevant where {entityName} forms part of your routine.",
  " Practical for patients comparing local options in {town}.",
  " Supports informed booking decisions at {pharmacyName}.",
  " Keeps expectations realistic before you attend.",
  " Framed for everyday healthcare planning in {areaName}.",
  " Written for local patient intent — not generic filler.",
  " Confirms pharmacy role alongside existing NHS contacts.",
  " Encourages questions before booking {serviceName}.",
  " Reflects common patient questions near {entityName}.",
  " Grounded in local access patterns around {areaName}.",
  " One of several local signals — not an exhaustive list.",
  " Part of personalised local content for {areaName} patients.",
];

function expandCategory(
  entityType: EntityType,
  category: NarrativeCategory,
  bases: string[],
  count: number,
): EntityNarrativeBlock[] {
  const blocks: EntityNarrativeBlock[] = [];
  for (let i = 0; i < count; i++) {
    const base = bases[i % bases.length];
    const suffix = VARIANT_SUFFIXES[i % VARIANT_SUFFIXES.length];
    let template = `${base}${suffix}`.replace(/\s+/g, " ").trim();
    if (i >= bases.length) {
      template = template.replace(/\.$/, ` (${CATEGORY_LABELS[category]} context ${i + 1}).`);
    }
    blocks.push({
      id: `${entityType}_${category}_${String(i + 1).padStart(3, "0")}`,
      entityType,
      category,
      template,
    });
  }
  return blocks;
}

function buildTypeLibrary(entityType: EntityType): EntityNarrativeBlock[] {
  const bases = baseTemplates(entityType);
  const perCategory = 25;
  return NARRATIVE_CATEGORIES.flatMap((category) =>
    expandCategory(entityType, category, bases[category], perCategory),
  );
}

let _library: EntityNarrativeLibrary | null = null;

export function getEntityNarrativeLibrary(): EntityNarrativeLibrary {
  if (_library) return _library;
  const byType = {} as Record<EntityType, EntityNarrativeBlock[]>;
  let blockCount = 0;
  for (const type of ENTITY_TYPES) {
    byType[type] = buildTypeLibrary(type);
    blockCount += byType[type].length;
  }
  _library = { version: "v1", blockCount, byType };
  return _library;
}

export function fillEntityNarrativeTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return out.replace(/\s+/g, " ").trim();
}

export function pickEntityNarrativeBlock(
  entityType: EntityType,
  category: NarrativeCategory,
  seed: number,
): EntityNarrativeBlock {
  const pool = getEntityNarrativeLibrary().byType[entityType].filter((b) => b.category === category);
  const idx = ((seed % pool.length) + pool.length) % pool.length;
  return pool[idx];
}

export function validateEntityNarrativeLibrary(): {
  valid: boolean;
  blockCount: number;
  perType: Record<EntityType, number>;
  perCategory: Record<NarrativeCategory, number>;
  errors: string[];
} {
  const lib = getEntityNarrativeLibrary();
  const errors: string[] = [];
  const perType = {} as Record<EntityType, number>;
  const perCategory = {} as Record<NarrativeCategory, number>;
  for (const cat of NARRATIVE_CATEGORIES) perCategory[cat] = 0;
  for (const type of ENTITY_TYPES) {
    perType[type] = lib.byType[type].length;
    if (perType[type] < 125) errors.push(`${type}: ${perType[type]} blocks (need 125)`);
    for (const block of lib.byType[type]) perCategory[block.category]++;
  }
  if (lib.blockCount < 1000) errors.push(`Total ${lib.blockCount} blocks (need 1000+)`);
  return { valid: errors.length === 0, blockCount: lib.blockCount, perType, perCategory, errors };
}

export function libraryTotals(): {
  blockCount: number;
  perType: Record<EntityType, number>;
  perCategory: Record<NarrativeCategory, number>;
} {
  const v = validateEntityNarrativeLibrary();
  return { blockCount: v.blockCount, perType: v.perType, perCategory: v.perCategory };
}
