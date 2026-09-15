/**
 * Pharmacy Area Narrative Intelligence V1 — narrative types and deterministic area profiles.
 */
import type { NarrativeType } from "./pharmacyAreaNarrativeLibrary.ts";

export type { NarrativeType };

export interface AreaNarrativeProfile {
  areaSlug: string;
  areaName: string;
  narrativeType: NarrativeType;
  populationType: string;
  healthcareFocus: string;
  patientBehaviour: string;
  serviceDrivers: string[];
  narrativeStyle: string;
  localHealthcareContext: string;
  localLifestylePattern: string;
  ctaIntent: string;
  differentiationNotes: string;
  generatedAt: string;
}

/** Deterministic area → narrative type assignments (pharmaconnect). */
export const AREA_NARRATIVE_ASSIGNMENTS: Record<string, NarrativeType> = {
  rawmarsh: "retirement_health",
  brinsworth: "working_professionals",
  parkgate: "convenience_access",
  kimberworth: "young_families",
  eastwood: "community_health",
  clifton: "preventative_health",
  dalton: "medication_support",
  bradgate: "wellbeing_focus",
  brightside: "community_health",
  rotherham: "health_management",
};

/** Canonical 10-area list for pharmaconnect narrative profiles. */
export const CANONICAL_NARRATIVE_AREAS = [
  "Rawmarsh",
  "Brinsworth",
  "Parkgate",
  "Kimberworth",
  "Eastwood",
  "Clifton",
  "Dalton",
  "Bradgate",
  "Brightside",
  "Rotherham",
];

export const NARRATIVE_TYPE_METADATA: Record<
  NarrativeType,
  Omit<AreaNarrativeProfile, "areaSlug" | "areaName" | "narrativeType" | "generatedAt">
> = {
  health_management: {
    populationType: "Mixed-age residents managing ongoing health needs across town-centre and suburban access routes",
    healthcareFocus: "Structured medicine management, routine monitoring and coordinated pharmacy support within wider NHS pathways",
    patientBehaviour: "Patients plan appointments around existing GP contacts and seek clarity before adding pharmacy services",
    serviceDrivers: [
      "Medicine continuity",
      "Routine monitoring",
      "Clear escalation when symptoms change",
      "Practical booking guidance",
    ],
    narrativeStyle: "Measured, pathway-aware and assessment-first — emphasises how pharmacy services fit ongoing health management",
    localHealthcareContext:
      "Town-centre patients often balance pharmacy appointments with existing NHS contacts — suitability is confirmed individually, not assumed online",
    localLifestylePattern:
      "Errands, work patterns and family commitments shape when patients can attend — booking clarity reduces unnecessary journeys",
    ctaIntent: "Confirm suitability and next steps before attending",
    differentiationNotes: "Centres on ongoing health management rather than one-off convenience or family scheduling",
  },
  working_professionals: {
    populationType: "Working-age adults balancing employment, commuting and household responsibilities",
    healthcareFocus: "Time-efficient pharmacy access with realistic appointment expectations and preparation guidance",
    patientBehaviour: "Patients ask whether services fit lunch breaks, early evenings or pre-work windows before committing",
    serviceDrivers: [
      "Flexible access",
      "Appointment clarity",
      "Minimal waiting where possible",
      "Preparation before visiting",
    ],
    narrativeStyle: "Direct and time-aware — respects employment schedules without promising instant outcomes",
    localHealthcareContext:
      "Residents often combine pharmacy visits with commuting routes — assessment still precedes any treatment or supply decision",
    localLifestylePattern:
      "Work shifts and school runs influence when patients can attend; clear phone or booking routes reduce aborted visits",
    ctaIntent: "Check timing, suitability and what to bring before visiting",
    differentiationNotes: "Frames healthcare around employment and travel routines, not retirement or family-first scheduling",
  },
  young_families: {
    populationType: "Families with children, school schedules and multi-generational household health needs",
    healthcareFocus: "Practical family pharmacy advice, seasonal services and household medicine routines",
    patientBehaviour: "Parents ask about suitability for children and adults in the same household before booking",
    serviceDrivers: [
      "Family suitability",
      "Seasonal vaccinations",
      "Household medicine questions",
      "Accessible plain-language advice",
    ],
    narrativeStyle: "Reassuring and practical — acknowledges school runs and childcare without overstating outcomes",
    localHealthcareContext:
      "Families often coordinate pharmacy visits around term-time routines — GP or emergency care remains appropriate when symptoms worsen",
    localLifestylePattern:
      "School hours, after-school activities and weekend errands shape when families can attend pharmacy appointments",
    ctaIntent: "Ask whether the service suits your household before booking",
    differentiationNotes: "Distinct family journey — not commuter efficiency or retirement continuity alone",
  },
  community_health: {
    populationType: "Established neighbourhoods with varied ages sharing local healthcare habits",
    healthcareFocus: "Accessible pharmacy guidance that reflects how residents already use local NHS and community services",
    patientBehaviour: "Patients prefer plain-language explanations of how a service works locally before they book",
    serviceDrivers: [
      "Service understanding",
      "Local accessibility",
      "Community-appropriate advice",
      "Trustworthy next steps",
    ],
    narrativeStyle: "Inclusive and community-grounded — explains services in everyday language",
    localHealthcareContext:
      "Neighbourhood healthcare habits vary — pharmacy support complements existing contacts rather than replacing them",
    localLifestylePattern:
      "Local networks, walking routes and familiar high-street patterns influence how residents choose when to visit",
    ctaIntent: "Speak to the pharmacy team about local access and suitability",
    differentiationNotes: "Community understanding focus — distinct from town-centre management or commuter timing",
  },
  preventative_health: {
    populationType: "Health-conscious residents prioritising early checks and risk reduction",
    healthcareFocus: "Preventative screening, lifestyle-linked pharmacy services and early intervention conversations",
    patientBehaviour: "Patients ask what a service can reasonably detect or support before booking preventative appointments",
    serviceDrivers: [
      "Early detection conversations",
      "Preventative screening",
      "Risk awareness",
      "Follow-up planning",
    ],
    narrativeStyle: "Forward-looking and educational — avoids implying diagnosis beyond pharmacist scope",
    localHealthcareContext:
      "Preventative appointments sit within wider primary care — abnormal findings are escalated appropriately",
    localLifestylePattern:
      "Residents often book preventative checks alongside routine errands or seasonal health planning",
    ctaIntent: "Discuss what the service can and cannot assess before booking",
    differentiationNotes: "Preventative motivation — not medication routines or travel preparation",
  },
  travel_preparation: {
    populationType: "Residents planning overseas travel, seasonal trips or occupational travel health needs",
    healthcareFocus: "Travel health preparation, vaccination timing and destination-appropriate pharmacy advice",
    patientBehaviour: "Travellers ask about lead times, documentation and suitability relative to departure dates",
    serviceDrivers: [
      "Travel timing",
      "Vaccination schedules",
      "Destination preparation",
      "Follow-up before departure",
    ],
    narrativeStyle: "Planning-oriented and date-aware — emphasises preparation windows without guaranteeing coverage",
    localHealthcareContext:
      "Travel services depend on destination, medical history and availability — assessment confirms suitability",
    localLifestylePattern:
      "Holiday planning and work travel deadlines drive when patients seek pharmacy travel consultations",
    ctaIntent: "Confirm travel dates and preparation requirements early",
    differentiationNotes: "Travel-specific journey — distinct from everyday convenience or chronic medicine support",
  },
  medication_support: {
    populationType: "Patients managing repeat medicines, new prescriptions or complex medicine schedules",
    healthcareFocus: "Medicine reviews, adherence support and structured repeat supply conversations",
    patientBehaviour: "Patients ask how pharmacy support fits existing prescriptions before changing routines",
    serviceDrivers: [
      "Repeat supply clarity",
      "Medicine reviews",
      "Adherence support",
      "Interaction awareness",
    ],
    narrativeStyle: "Medicine-focused and continuity-led — respects prescriber roles and individual treatment plans",
    localHealthcareContext:
      "Medicine support complements prescriber decisions — pharmacists clarify supply and usage, not replace medical diagnosis",
    localLifestylePattern:
      "Collection patterns and reminder routines influence when patients discuss medicines with the pharmacy team",
    ctaIntent: "Review medicines and supply needs with the pharmacist",
    differentiationNotes: "Medication journey — not general wellbeing or family scheduling",
  },
  wellbeing_focus: {
    populationType: "Residents seeking lifestyle-linked pharmacy support and general wellbeing conversations",
    healthcareFocus: "Wellbeing services, lifestyle advice boundaries and realistic pharmacy-led support",
    patientBehaviour: "Patients ask what wellbeing services include and when GP referral is more appropriate",
    serviceDrivers: [
      "Wellbeing conversations",
      "Lifestyle boundaries",
      "Realistic outcomes",
      "Holistic next steps",
    ],
    narrativeStyle: "Supportive and boundary-aware — wellbeing without overstating clinical outcomes",
    localHealthcareContext:
      "Wellbeing services remain assessment-led — symptoms requiring medical review are directed appropriately",
    localLifestylePattern:
      "Residents link wellbeing appointments to personal health goals and routine self-care planning",
    ctaIntent: "Discuss wellbeing goals and suitable pharmacy support",
    differentiationNotes: "Wellbeing motivation — distinct from medication support or preventative screening alone",
  },
  retirement_health: {
    populationType: "Older residents prioritising medicine continuity, accessibility and long-term health stability",
    healthcareFocus: "Repeat medicine routines, blood pressure monitoring, medicine reviews and steady pharmacist contact",
    patientBehaviour: "Patients value continuity, clear instructions and unhurried conversations before attending",
    serviceDrivers: [
      "Medicine continuity",
      "Preventative monitoring",
      "Accessible appointments",
      "Long-term stability",
    ],
    narrativeStyle: "Patient, clear and unhurried — emphasises dependable support and plain language",
    localHealthcareContext:
      "Older patients often maintain long-term GP relationships — pharmacy services add structured support alongside them",
    localLifestylePattern:
      "Regular routines, local familiarity and predictable appointment timing support consistent attendance",
    ctaIntent: "Arrange a suitable appointment with time to discuss your needs",
    differentiationNotes: "Retirement/long-term health journey — not commuter or family-first framing",
  },
  convenience_access: {
    populationType: "Residents combining pharmacy visits with retail errands and high-street convenience",
    healthcareFocus: "Quick access clarity, walk-in suitability and realistic waiting expectations",
    patientBehaviour: "Patients ask whether a service needs an appointment or can fit an existing trip to local shops",
    serviceDrivers: [
      "Access clarity",
      "Appointment vs walk-in guidance",
      "Errand-friendly planning",
      "Service availability",
    ],
    narrativeStyle: "Practical and access-led — convenience without implying instant clinical outcomes",
    localHealthcareContext:
      "High-street access helps attendance — clinical suitability is still confirmed before treatment",
    localLifestylePattern:
      "Shopping trips and local errands create natural opportunities to contact the pharmacy team first",
    ctaIntent: "Check whether you need an appointment before visiting",
    differentiationNotes: "Convenience journey — distinct from deep medication or retirement continuity narratives",
  },
};

export function slugifyArea(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveNarrativeType(areaName: string): NarrativeType {
  const slug = slugifyArea(areaName);
  if (AREA_NARRATIVE_ASSIGNMENTS[slug]) return AREA_NARRATIVE_ASSIGNMENTS[slug];
  const types = Object.keys(NARRATIVE_TYPE_METADATA) as NarrativeType[];
  return types[slug.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % types.length];
}

export function buildAreaNarrativeProfile(areaName: string): AreaNarrativeProfile {
  const areaSlug = slugifyArea(areaName);
  const narrativeType = resolveNarrativeType(areaName);
  const meta = NARRATIVE_TYPE_METADATA[narrativeType];
  return {
    areaSlug,
    areaName,
    narrativeType,
    ...meta,
    generatedAt: new Date().toISOString(),
  };
}
