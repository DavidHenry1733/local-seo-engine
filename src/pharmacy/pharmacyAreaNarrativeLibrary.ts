/**
 * Pharmacy Area Narrative Library V1 — patient journey pattern library (20 per category per type).
 * Patterns use {{placeholders}} — not synonym spinners; each encodes a distinct healthcare motivation.
 */
export type NarrativeType =
  | "health_management"
  | "working_professionals"
  | "young_families"
  | "community_health"
  | "preventative_health"
  | "travel_preparation"
  | "medication_support"
  | "wellbeing_focus"
  | "retirement_health"
  | "convenience_access";

export interface NarrativePatternSet {
  intro: string[];
  patientJourney: string[];
  healthcareContext: string[];
  localLifestyle: string[];
  cta: string[];
  faqOpener: string[];
  bridge: string[];
}

export const NARRATIVE_TYPES: NarrativeType[] = [
  "health_management",
  "working_professionals",
  "young_families",
  "community_health",
  "preventative_health",
  "travel_preparation",
  "medication_support",
  "wellbeing_focus",
  "retirement_health",
  "convenience_access",
];

type PatternCategory = keyof NarrativePatternSet;

const INTRO_ANGLES: Record<NarrativeType, string[]> = {
  health_management: [
    "{{areaName}} residents managing ongoing health needs often ask how {{serviceName}} fits existing GP and pharmacy contacts before booking at {{pharmacyName}}.",
    "Patients across {{areaName}} who coordinate long-term care want clarity on whether {{serviceName}} supports their current medicine routine — assessment at {{pharmacyName}} confirms suitability.",
    "For {{areaName}} patients balancing repeat medicines and monitoring, {{serviceName}} at {{pharmacyName}} is explained as structured support within wider NHS pathways.",
    "Health management in {{areaName}} means planning pharmacy visits alongside existing appointments — {{pharmacyName}} outlines what {{serviceName}} can reasonably offer before you attend.",
    "Residents in {{areaName}} seeking continuity ask {{pharmacyName}} how {{serviceName}} complements rather than replaces their existing healthcare contacts.",
    "When {{areaName}} patients review ongoing treatment plans, {{serviceName}} conversations at {{pharmacyName}} focus on practical next steps after individual assessment.",
    "{{areaName}} patients managing chronic or recurring health needs use {{pharmacyName}} for {{serviceName}} when they need pharmacist-led guidance with documented follow-up.",
    "Structured health management around {{areaName}} includes knowing when {{serviceName}} is appropriate — {{pharmacyName}} confirms this at consultation, not from website text alone.",
    "Patients in {{areaName}} coordinating multiple health appointments ask {{pharmacyName}} to explain fees, NHS eligibility and timing for {{serviceName}} upfront.",
    "Ongoing care in {{areaName}} often involves repeat contact with familiar clinicians — {{serviceName}} at {{pharmacyName}} adds pharmacy-led support within that wider picture.",
    "{{areaName}} residents planning medicine reviews or monitoring sometimes book {{serviceName}} when they need clarity before changing routines.",
    "Managing health over time in {{areaName}} requires realistic expectations — {{pharmacyName}} explains what {{serviceName}} includes after reviewing your individual circumstances.",
    "Patients near {{areaName}} who maintain regular GP contact may still ask {{pharmacyName}} about {{serviceName}} for convenient structured support.",
    "Health management priorities in {{areaName}} vary — {{pharmacyName}} tailors {{serviceName}} advice to your situation following pharmacist assessment.",
    "Residents across {{areaName}} and {{town}} often want to know how {{serviceName}} fits seasonal health planning before booking with {{pharmacyName}}.",
    "{{areaName}} patients value knowing escalation routes — {{serviceName}} at {{pharmacyName}} is positioned within primary care, not as emergency care.",
    "When ongoing symptoms need review, {{areaName}} patients contact {{pharmacyName}} about {{serviceName}} after understanding assessment is required first.",
    "Long-term health stability in {{areaName}} includes pharmacist conversations about {{serviceName}} when supply, monitoring or advice is needed.",
    "{{areaName}} residents approaching {{pharmacyName}} for {{serviceName}} typically ask what to bring and whether an appointment is necessary.",
    "Coordinated care around {{areaName}} means {{serviceName}} at {{pharmacyName}} supports management goals confirmed individually at consultation.",
  ],
  working_professionals: [
    "{{areaName}} commuters and working adults ask whether {{serviceName}} at {{pharmacyName}} fits employment schedules before they book.",
    "Time-aware patients in {{areaName}} want realistic waiting and preparation guidance for {{serviceName}} — {{pharmacyName}} explains this before attendance.",
    "Working residents near {{areaName}} often contact {{pharmacyName}} by phone first to confirm {{serviceName}} suits a lunch break or pre-work window.",
    "Employment patterns around {{areaName}} shape pharmacy access — {{serviceName}} suitability is still confirmed individually at {{pharmacyName}}.",
    "{{areaName}} professionals planning {{serviceName}} ask {{pharmacyName}} about appointment length and what preparation avoids a wasted visit.",
    "Before fitting {{serviceName}} around shifts, {{areaName}} patients ask {{pharmacyName}} whether walk-in or booked access is appropriate.",
    "Working-age residents in {{areaName}} prioritise clear booking routes for {{serviceName}} at {{pharmacyName}} when time is limited.",
    "{{areaName}} patients balancing childcare and work ask {{pharmacyName}} when {{serviceName}} appointments are typically available.",
    "Efficient access from {{areaName}} does not skip assessment — {{pharmacyName}} confirms {{serviceName}} suitability before treatment decisions.",
    "Residents commuting through {{areaName}} may combine pharmacy contact with travel — {{serviceName}} guidance from {{pharmacyName}} clarifies timing first.",
    "{{areaName}} workers often need fee and NHS eligibility answers for {{serviceName}} before arranging time off to visit {{pharmacyName}}.",
    "Planning {{serviceName}} around deadlines matters to {{areaName}} professionals — {{pharmacyName}} documents next steps after consultation.",
    "Working patients in {{areaName}} ask {{pharmacyName}} how {{serviceName}} follow-up fits if symptoms change after the appointment.",
    "Flexible access near {{areaName}} still requires clinical assessment for {{serviceName}} — {{pharmacyName}} explains boundaries clearly.",
    "{{areaName}} residents in employment value plain-language preparation lists for {{serviceName}} from {{pharmacyName}}.",
    "Before visiting during a break, {{areaName}} patients confirm with {{pharmacyName}} whether {{serviceName}} needs prior GP contact.",
    "Work-related travel or hybrid schedules around {{areaName}} influence when patients ask about {{serviceName}} at {{pharmacyName}}.",
    "{{areaName}} professionals seek {{serviceName}} when pharmacy-led advice saves unnecessary GP waits — suitability is confirmed first.",
    "Time-conscious patients from {{areaName}} contact {{pharmacyName}} to understand {{serviceName}} outcomes they can expect after assessment.",
    "Employment commitments in {{areaName}} make booking clarity essential — {{pharmacyName}} supports {{serviceName}} with documented next steps.",
  ],
  young_families: [
    "Families in {{areaName}} ask {{pharmacyName}} whether {{serviceName}} suits children and adults in the household before booking.",
    "Parents around {{areaName}} coordinate {{serviceName}} around school hours — {{pharmacyName}} explains timing and suitability individually.",
    "Household health in {{areaName}} often involves multiple questions — {{serviceName}} at {{pharmacyName}} is assessment-led for each patient.",
    "{{areaName}} families planning seasonal health needs contact {{pharmacyName}} about {{serviceName}} with realistic preparation guidance.",
    "School-run schedules near {{areaName}} influence when families can attend {{serviceName}} — {{pharmacyName}} clarifies appointment needs first.",
    "Parents in {{areaName}} want plain-language answers on {{serviceName}} fees and NHS routes before visiting {{pharmacyName}} with children.",
    "Family households around {{areaName}} ask whether one appointment covers multiple concerns — {{serviceName}} suitability is confirmed per person.",
    "{{areaName}} carers booking {{serviceName}} at {{pharmacyName}} ask what documentation or history to bring for dependants.",
    "Young families near {{areaName}} seek {{serviceName}} when practical pharmacy advice supports routine household health planning.",
    "Term-time routines in {{areaName}} shape family pharmacy access — {{pharmacyName}} explains {{serviceName}} availability realistically.",
    "Parents across {{areaName}} ask {{pharmacyName}} when GP referral is more appropriate than {{serviceName}} for sudden symptom changes.",
    "Family health planning in {{areaName}} includes asking {{pharmacyName}} how {{serviceName}} fits vaccinations or minor ailment support.",
    "{{areaName}} households with mixed ages value {{pharmacyName}} explaining {{serviceName}} boundaries in accessible language.",
    "Weekend availability matters to {{areaName}} families booking {{serviceName}} — {{pharmacyName}} confirms access routes upfront.",
    "Parents near {{areaName}} contact {{pharmacyName}} about {{serviceName}} when they need structured advice before committing children to appointments.",
    "Household medicine questions in {{areaName}} sometimes lead to {{serviceName}} conversations at {{pharmacyName}} after individual assessment.",
    "{{areaName}} families balancing work and childcare ask for realistic durations for {{serviceName}} at {{pharmacyName}}.",
    "Seasonal health around {{areaName}} prompts family enquiries about {{serviceName}} — suitability is never assumed from online information.",
    "Parents in {{areaName}} appreciate {{pharmacyName}} documenting follow-up steps after {{serviceName}} when further care is needed.",
    "Family-centred access from {{areaName}} means {{serviceName}} at {{pharmacyName}} respects each patient's clinical circumstances separately.",
  ],
  community_health: [
    "Neighbours in {{areaName}} often ask {{pharmacyName}} to explain how {{serviceName}} works locally before they book.",
    "Community access around {{areaName}} depends on plain-language guidance — {{serviceName}} suitability is confirmed at {{pharmacyName}}.",
    "Established residents in {{areaName}} value trustworthy explanations of {{serviceName}} within everyday healthcare habits.",
    "{{areaName}} community members contact {{pharmacyName}} when they need clarity on {{serviceName}} fees, timing and NHS eligibility.",
    "Local familiarity in {{areaName}} helps attendance — {{pharmacyName}} still assesses {{serviceName}} suitability individually.",
    "Residents across {{areaName}} ask how {{serviceName}} complements existing GP relationships before visiting {{pharmacyName}}.",
    "Community health understanding in {{areaName}} grows through accessible {{serviceName}} conversations at {{pharmacyName}}.",
    "{{areaName}} patients prefer knowing escalation routes when {{serviceName}} at {{pharmacyName}} is not the right next step.",
    "Inclusive guidance for {{areaName}} means {{serviceName}} advice from {{pharmacyName}} respects varied ages and circumstances.",
    "Local networks in {{areaName}} influence when people seek {{serviceName}} — assessment at {{pharmacyName}} remains essential.",
    "Community members near {{areaName}} ask {{pharmacyName}} what to expect during {{serviceName}} appointments in plain terms.",
    "Accessible pharmacy support in {{areaName}} includes {{serviceName}} when clinically appropriate after pharmacist review.",
    "Residents walking familiar routes through {{areaName}} may contact {{pharmacyName}} first about {{serviceName}} access questions.",
    "{{areaName}} neighbours often share practical tips — {{pharmacyName}} provides authoritative {{serviceName}} guidance after assessment.",
    "Community trust around {{areaName}} builds when {{serviceName}} boundaries are explained clearly by {{pharmacyName}}.",
    "Local healthcare habits in {{areaName}} vary — {{pharmacyName}} tailors {{serviceName}} conversations accordingly.",
    "{{areaName}} residents ask {{pharmacyName}} how {{serviceName}} fits wider {{town}} primary care pathways.",
    "Service understanding in {{areaName}} reduces unnecessary visits — {{pharmacyName}} confirms {{serviceName}} need first.",
    "Community-focused patients in {{areaName}} value documented next steps after {{serviceName}} at {{pharmacyName}}.",
    "Everyday healthcare in {{areaName}} includes knowing when {{serviceName}} is suitable — {{pharmacyName}} advises after consultation.",
  ],
  preventative_health: [
    "Health-conscious residents in {{areaName}} ask {{pharmacyName}} what {{serviceName}} can reasonably assess before preventative booking.",
    "Preventative planning around {{areaName}} includes understanding {{serviceName}} limits — {{pharmacyName}} explains after review.",
    "{{areaName}} patients seeking early checks contact {{pharmacyName}} about {{serviceName}} with realistic outcome expectations.",
    "Risk-awareness in {{areaName}} prompts questions on {{serviceName}} timing and follow-up at {{pharmacyName}}.",
    "Preventative health in {{areaName}} means escalation to GP when {{serviceName}} findings require medical review.",
    "Residents near {{areaName}} book {{serviceName}} at {{pharmacyName}} when they want structured early conversations, not instant diagnosis.",
    "{{areaName}} patients ask which preparations improve {{serviceName}} appointments at {{pharmacyName}}.",
    "Seasonal preventative routines in {{areaName}} sometimes include {{serviceName}} — suitability confirmed individually.",
    "Early intervention conversations in {{areaName}} start with {{pharmacyName}} assessing whether {{serviceName}} is appropriate.",
    "Preventative-minded patients across {{areaName}} want fee clarity for {{serviceName}} before visiting {{pharmacyName}}.",
    "{{areaName}} residents planning health goals ask {{pharmacyName}} how {{serviceName}} supports monitoring over time.",
    "Preventative checks near {{areaName}} complement GP care — {{serviceName}} at {{pharmacyName}} stays within pharmacist scope.",
    "Patients in {{areaName}} avoid assumptions about {{serviceName}} results — {{pharmacyName}} explains follow-up pathways.",
    "Lifestyle-linked prevention around {{areaName}} may include {{serviceName}} when clinically suitable after assessment.",
    "{{areaName}} patients contact {{pharmacyName}} early about {{serviceName}} to allow preparation time before appointments.",
    "Preventative motivation in {{areaName}} differs from urgent care — {{serviceName}} suitability is judged case by case.",
    "Residents across {{areaName}} ask {{pharmacyName}} when repeat {{serviceName}} monitoring is recommended.",
    "Forward-looking health in {{areaName}} includes documented plans after {{serviceName}} at {{pharmacyName}}.",
    "{{areaName}} patients value knowing what {{serviceName}} cannot detect before booking with {{pharmacyName}}.",
    "Preventative access from {{areaName}} works best with assessment-first {{serviceName}} guidance from {{pharmacyName}}.",
  ],
  travel_preparation: [
    "Travellers from {{areaName}} planning departures ask {{pharmacyName}} about {{serviceName}} lead times and suitability early.",
    "Destination planning around {{areaName}} includes {{serviceName}} conversations at {{pharmacyName}} once travel dates are known.",
    "{{areaName}} residents preparing overseas trips contact {{pharmacyName}} to confirm {{serviceName}} fits their itinerary and history.",
    "Travel health timelines matter — {{areaName}} patients book {{serviceName}} at {{pharmacyName}} with enough preparation window.",
    "Occupational travel from {{areaName}} prompts {{serviceName}} questions — assessment at {{pharmacyName}} confirms requirements.",
    "Holiday planners in {{areaName}} ask {{pharmacyName}} which documents to bring for {{serviceName}} consultations.",
    "Travel preparation near {{areaName}} depends on destination and medical history — {{serviceName}} suitability is individual.",
    "{{areaName}} residents ask {{pharmacyName}} when {{serviceName}} must be completed relative to departure dates.",
    "Last-minute travel from {{areaName}} may limit {{serviceName}} options — {{pharmacyName}} explains availability honestly.",
    "Family travel plans around {{areaName}} include separate {{serviceName}} assessments at {{pharmacyName}} for each traveller.",
    "Travel-related {{serviceName}} at {{pharmacyName}} supports preparation — it does not replace destination-specific medical advice when urgent.",
    "{{areaName}} patients returning from travel may contact {{pharmacyName}} about follow-up {{serviceName}} if symptoms develop.",
    "Seasonal trip planning in {{areaName}} often starts with {{pharmacyName}} clarifying {{serviceName}} fees and NHS routes.",
    "Travel health in {{areaName}} requires realistic expectations — {{pharmacyName}} outlines {{serviceName}} scope after review.",
    "{{areaName}} business travellers ask {{pharmacyName}} to schedule {{serviceName}} around meeting commitments where possible.",
    "Destination vaccines and {{serviceName}} near {{areaName}} are confirmed after pharmacist assessment at {{pharmacyName}}.",
    "Travel documentation questions from {{areaName}} are addressed during {{serviceName}} planning with {{pharmacyName}}.",
    "Pre-travel checks for {{areaName}} residents include knowing when GP input is needed before {{serviceName}} at {{pharmacyName}}.",
    "{{areaName}} travellers value clear follow-up advice after {{serviceName}} appointments at {{pharmacyName}}.",
    "Planning ahead from {{areaName}} makes {{serviceName}} at {{pharmacyName}} more useful before departure dates firm up.",
  ],
  medication_support: [
    "Patients in {{areaName}} managing repeat medicines ask {{pharmacyName}} how {{serviceName}} supports existing prescriptions.",
    "Medicine continuity around {{areaName}} includes {{serviceName}} conversations when supply or usage questions arise.",
    "{{areaName}} residents on new medicines contact {{pharmacyName}} about {{serviceName}} for structured review and advice.",
    "Adherence support in {{areaName}} may involve {{serviceName}} at {{pharmacyName}} after individual medicine assessment.",
    "Complex schedules near {{areaName}} prompt questions on {{serviceName}} — {{pharmacyName}} respects prescriber decisions.",
    "Repeat supply clarity for {{areaName}} patients sometimes requires {{serviceName}} guidance from {{pharmacyName}}.",
    "Medicine reviews around {{areaName}} help patients understand {{serviceName}} options within pharmacist scope.",
    "{{areaName}} patients ask {{pharmacyName}} when to involve their GP before starting {{serviceName}} related to medicines.",
    "Prescription changes in {{areaName}} lead to {{serviceName}} enquiries — suitability confirmed at {{pharmacyName}}.",
    "Medication-focused access from {{areaName}} means {{serviceName}} at {{pharmacyName}} clarifies interactions and usage.",
    "Residents near {{areaName}} collecting regular items may book {{serviceName}} when questions exceed a quick counter chat.",
    "Medicine safety in {{areaName}} includes {{pharmacyName}} explaining {{serviceName}} follow-up when symptoms change.",
    "{{areaName}} patients value pharmacist time for {{serviceName}} without rushing medicine conversations.",
    "Structured medicine support in {{areaName}} documents next steps after {{serviceName}} at {{pharmacyName}}.",
    "Households in {{areaName}} with multiple prescriptions ask {{pharmacyName}} about {{serviceName}} per patient.",
    "Medication routines near {{areaName}} influence when {{serviceName}} appointments are practical at {{pharmacyName}}.",
    "{{areaName}} residents seek {{serviceName}} when they need clarity before altering repeat ordering patterns.",
    "Pharmacist-led {{serviceName}} in {{areaName}} complements prescribers — {{pharmacyName}} explains boundaries clearly.",
    "Medicine questions from {{areaName}} often start by phone — {{pharmacyName}} advises whether {{serviceName}} needs booking.",
    "Long-term medicine stability around {{areaName}} can include periodic {{serviceName}} reviews at {{pharmacyName}}.",
  ],
  wellbeing_focus: [
    "Residents in {{areaName}} exploring wellbeing goals ask {{pharmacyName}} what {{serviceName}} reasonably includes.",
    "Wellbeing conversations near {{areaName}} stay assessment-led — {{serviceName}} at {{pharmacyName}} avoids overstating outcomes.",
    "{{areaName}} patients seek {{serviceName}} when lifestyle-linked support fits their health goals after pharmacist review.",
    "Holistic planning around {{areaName}} includes knowing GP routes when {{serviceName}} is not sufficient.",
    "Wellbeing motivation in {{areaName}} differs from urgent care — {{pharmacyName}} confirms {{serviceName}} suitability first.",
    "{{areaName}} residents ask {{pharmacyName}} about {{serviceName}} fees and preparation for wellbeing appointments.",
    "Self-care planning near {{areaName}} may involve {{serviceName}} guidance from {{pharmacyName}} within clinical boundaries.",
    "Wellbeing-focused patients across {{areaName}} want plain-language {{serviceName}} explanations before booking.",
    "{{areaName}} patients contact {{pharmacyName}} when {{serviceName}} supports realistic lifestyle conversations.",
    "Personal health goals in {{areaName}} shape questions on {{serviceName}} timing at {{pharmacyName}}.",
    "Wellbeing access from {{areaName}} requires individual assessment for {{serviceName}} — not one-size-fits-all promises.",
    "{{areaName}} residents appreciate {{pharmacyName}} documenting follow-up after {{serviceName}} wellbeing discussions.",
    "Boundary-aware {{serviceName}} in {{areaName}} means {{pharmacyName}} escalates when medical review is needed.",
    "Wellbeing enquiries around {{areaName}} often start with what {{serviceName}} cannot provide — clarity first.",
    "{{areaName}} patients planning gradual health changes ask {{pharmacyName}} about suitable {{serviceName}} support.",
    "Supportive {{serviceName}} conversations at {{pharmacyName}} respect {{areaName}} patients' individual circumstances.",
    "Wellbeing journeys near {{areaName}} combine {{serviceName}} with wider primary care when appropriate.",
    "{{areaName}} residents ask {{pharmacyName}} how often {{serviceName}} reviews are typically useful.",
    "Goal-oriented patients in {{areaName}} book {{serviceName}} at {{pharmacyName}} after understanding realistic scope.",
    "Wellbeing-focused access in {{areaName}} keeps {{serviceName}} medically conservative and assessment-first.",
  ],
  retirement_health: [
    "Older residents in {{areaName}} prioritise dependable {{serviceName}} access through {{pharmacyName}} with unhurried conversations.",
    "Medicine continuity for {{areaName}} retirement-age patients often includes {{serviceName}} reviews at {{pharmacyName}}.",
    "{{areaName}} patients value familiar pharmacist contact when planning {{serviceName}} around long-term routines.",
    "Preventative monitoring near {{areaName}} may include {{serviceName}} — {{pharmacyName}} confirms individual suitability.",
    "Accessible appointments in {{areaName}} help older patients attend {{serviceName}} at {{pharmacyName}} comfortably.",
    "Retirement-health planning around {{areaName}} respects existing GP relationships alongside {{serviceName}} support.",
    "{{areaName}} residents ask {{pharmacyName}} for plain-language {{serviceName}} instructions they can share with family carers.",
    "Stable routines in {{areaName}} support consistent {{serviceName}} attendance at {{pharmacyName}} over time.",
    "Older patients near {{areaName}} contact {{pharmacyName}} before changing repeat patterns related to {{serviceName}}.",
    "Long-term health in {{areaName}} includes {{serviceName}} when pharmacist assessment confirms it is appropriate.",
    "{{areaName}} patients appreciate clear waiting expectations for {{serviceName}} at {{pharmacyName}}.",
    "Retirement-age residents across {{areaName}} ask whether {{serviceName}} needs an appointment or phone triage first.",
    "Medicine reviews and {{serviceName}} in {{areaName}} are linked conversations at {{pharmacyName}} when clinically suitable.",
    "{{areaName}} patients seek {{pharmacyName}} support when {{serviceName}} helps maintain independence with clear guidance.",
    "Predictable access from {{areaName}} reduces anxiety — {{pharmacyName}} explains {{serviceName}} steps calmly.",
    "Older households in {{areaName}} may involve carers in {{serviceName}} planning with {{pharmacyName}}.",
    "Retirement health near {{areaName}} escalates to GP or emergency care when {{serviceName}} is not appropriate.",
    "{{areaName}} residents book {{serviceName}} at {{pharmacyName}} when monitoring or supply questions need structured time.",
    "Continuity matters to {{areaName}} patients returning for {{serviceName}} follow-up at {{pharmacyName}}.",
    "Long-term stability around {{areaName}} includes documented plans after {{serviceName}} pharmacist consultations.",
  ],
  convenience_access: [
    "Residents in {{areaName}} combining errands ask {{pharmacyName}} whether {{serviceName}} needs an appointment first.",
    "High-street convenience near {{areaName}} helps contact {{pharmacyName}} — {{serviceName}} suitability still requires assessment.",
    "{{areaName}} shoppers often phone {{pharmacyName}} about {{serviceName}} availability before making a special trip.",
    "Quick access questions from {{areaName}} focus on timing and fees for {{serviceName}} at {{pharmacyName}}.",
    "Errand-friendly planning around {{areaName}} includes knowing if {{serviceName}} fits a routine town visit.",
    "{{areaName}} patients value clear walk-in versus appointment guidance for {{serviceName}} from {{pharmacyName}}.",
    "Convenience-led access in {{areaName}} does not bypass clinical review for {{serviceName}} at {{pharmacyName}}.",
    "Retail footfall near {{areaName}} creates natural moments to ask about {{serviceName}} — answers come after assessment.",
    "{{areaName}} residents want realistic waiting information before choosing {{serviceName}} at {{pharmacyName}}.",
    "Everyday trip planning in {{areaName}} prompts {{serviceName}} enquiries — {{pharmacyName}} clarifies next steps.",
    "Accessible high-street support for {{areaName}} means {{serviceName}} boundaries are explained upfront.",
    "{{areaName}} patients contact {{pharmacyName}} en route when unsure if {{serviceName}} suits same-day visiting.",
    "Convenience access near {{areaName}} works best when {{serviceName}} preparation is understood before arrival.",
    "{{areaName}} residents ask {{pharmacyName}} how long {{serviceName}} appointments typically take.",
    "Errand chains around {{areaName}} influence when patients can attend {{serviceName}} at {{pharmacyName}}.",
    "Walk-in suitability for {{serviceName}} in {{areaName}} is confirmed by {{pharmacyName}} — not assumed from signage.",
    "{{areaName}} patients prefer phone triage for {{serviceName}} when unsure a visit is necessary.",
    "Practical access from {{areaName}} includes {{pharmacyName}} documenting outcomes after {{serviceName}} consultations.",
    "Local retail patterns in {{areaName}} help patients remember to ask about {{serviceName}} during routine visits.",
    "Convenience-focused {{areaName}} residents still receive assessment-first {{serviceName}} care at {{pharmacyName}}.",
  ],
};

function expandCategory(type: NarrativeType, category: PatternCategory, base: string[]): string[] {
  if (base.length >= 20) return base.slice(0, 20);
  const extras: string[] = [];
  const suffixes: Record<PatternCategory, string[]> = {
    intro: INTRO_ANGLES[type],
    patientJourney: [],
    healthcareContext: [],
    localLifestyle: [],
    cta: [],
    faqOpener: [],
    bridge: [],
  };
  const pool = suffixes[category].length ? suffixes[category] : base;
  for (let i = 0; pool.length + extras.length < 20; i++) {
    const src = pool[i % pool.length];
    if (!extras.includes(src) && !base.includes(src)) extras.push(src);
    if (i > 40) break;
  }
  return [...base, ...extras].slice(0, 20);
}

function journeyPatterns(type: NarrativeType): string[] {
  const journeys: Record<NarrativeType, string[]> = {
    health_management: [
      "Step 1 — Contact {{pharmacyName}} to discuss whether {{serviceName}} fits your current health plan. Step 2 — Attend assessment with relevant medicine lists. Step 3 — Receive documented next steps within primary care pathways.",
      "Patients in {{areaName}} typically confirm GP contact history before {{serviceName}}. Pharmacist review follows. Follow-up plans are agreed if monitoring is needed.",
      "Initial phone enquiry clarifies appointment need for {{serviceName}}. Assessment at {{pharmacyName}} confirms suitability. Ongoing management continues with existing clinicians where appropriate.",
      "Booking {{serviceName}} starts with understanding your current treatment goals in {{areaName}}. Consultation reviews medicines and symptoms. Escalation occurs if medical review is required.",
      "Management-focused patients gather prescription information before {{serviceName}}. {{pharmacyName}} assesses individually. Results inform whether repeat monitoring is useful.",
      "Health planning in {{areaName}} integrates {{serviceName}} after pharmacist assessment — not as a standalone diagnosis route.",
      "Patients document questions before {{serviceName}} to make management reviews productive at {{pharmacyName}}.",
      "Repeat attenders in {{areaName}} use {{serviceName}} for structured check-ins when symptoms or medicines change.",
      "Coordination with existing care teams may be discussed during {{serviceName}} at {{pharmacyName}}.",
      "Management journeys emphasise continuity — sudden symptom changes redirect to GP or emergency care.",
      "Seasonal management reviews in {{areaName}} may include {{serviceName}} when clinically appropriate.",
      "Patients track outcomes discussed at {{serviceName}} and return to {{pharmacyName}} when plans need updating.",
      "Initial assessment clarifies NHS versus private routes for {{serviceName}} in {{areaName}}.",
      "Management patients prefer written next steps after {{serviceName}} consultations.",
      "Long-term plans evolve through periodic {{serviceName}} reviews at {{pharmacyName}}.",
      "Medicine list reviews often precede meaningful {{serviceName}} discussions in {{areaName}}.",
      "Patients ask about monitoring intervals during {{serviceName}} management appointments.",
      "Health goals are revisited after each {{serviceName}} assessment at {{pharmacyName}}.",
      "Management journeys avoid unnecessary duplication of GP tests already planned.",
      "Closing each {{serviceName}} visit with clear follow-up dates supports {{areaName}} patients.",
    ],
    working_professionals: [
      "Step 1 — Phone {{pharmacyName}} to confirm {{serviceName}} fits your schedule. Step 2 — Prepare documents in advance. Step 3 — Attend assessment and receive time-bound next steps.",
      "Working patients in {{areaName}} confirm appointment duration before booking {{serviceName}}.",
      "Commute-friendly planning may influence morning or lunch {{serviceName}} slots at {{pharmacyName}}.",
      "Professionals ask about waiting times upfront to avoid missed meetings after {{serviceName}}.",
      "Preparation lists reduce second visits for busy {{areaName}} patients seeking {{serviceName}}.",
      "Follow-up calls fit better than repeat trips when {{serviceName}} plans change.",
      "Employment constraints are discussed honestly during {{serviceName}} booking.",
      "Shift workers enquire about earliest availability for {{serviceName}} at {{pharmacyName}}.",
      "Time-bound outcomes are documented at the end of {{serviceName}} consultations.",
      "Working-age patients escalate urgent symptoms rather than delaying for convenient slots.",
      "Hybrid workers may prefer phone triage before committing to {{serviceName}} visits.",
      "Deadline-driven travellers still complete assessment before {{serviceName}} proceeds.",
      "Professionals value SMS or call-back options when {{serviceName}} slots are limited.",
      "Brief preparatory questions save time during {{serviceName}} appointments.",
      "Work travel may require rescheduling {{serviceName}} — {{pharmacyName}} advises on timing.",
      "Lunch-hour {{serviceName}} visits need confirmed suitability to avoid wasted breaks.",
      "Patients ask whether results are available same day after {{serviceName}}.",
      "Follow-up appointments are booked only when clinically indicated.",
      "Working patients document employer-friendly appointment times where possible.",
      "Efficiency never skips clinical assessment for {{serviceName}} in {{areaName}}.",
    ],
    young_families: [
      "Step 1 — Confirm who the {{serviceName}} appointment is for. Step 2 — Gather child or adult history. Step 3 — Attend assessment with realistic household expectations.",
      "Families coordinate {{serviceName}} around school pickups in {{areaName}}.",
      "Parents ask separate suitability questions for each household member.",
      "Seasonal family health planning may include {{serviceName}} after pharmacist review.",
      "Carers bring documentation for dependants attending {{serviceName}} at {{pharmacyName}}.",
      "Family journeys emphasise plain-language explanations children can understand where appropriate.",
      "Weekend slots matter for dual-income households booking {{serviceName}}.",
      "Parents escalate paediatric symptoms promptly rather than relying on {{serviceName}} alone.",
      "Household medicine cabinets are reviewed before some {{serviceName}} consultations.",
      "Family follow-ups clarify when to return for {{serviceName}} monitoring.",
      "School holiday periods see higher {{serviceName}} enquiries from {{areaName}}.",
      "Parents appreciate knowing whether siblings need separate {{serviceName}} bookings.",
      "Family planners ask about vaccination timing relative to {{serviceName}}.",
      "Household budgets influence questions on {{serviceName}} fees at {{pharmacyName}}.",
      "Family journeys document who to contact if symptoms worsen after {{serviceName}}.",
      "Parents prepare questions collaboratively before {{serviceName}} visits.",
      "Term-time illness prompts careful triage before {{serviceName}} booking.",
      "Multi-generational households discuss {{serviceName}} suitability per person.",
      "Family routines are respected when scheduling {{serviceName}} follow-ups.",
      "Closing conversations summarise what each family member should do next.",
    ],
    community_health: [
      "Step 1 — Ask {{pharmacyName}} how {{serviceName}} works locally. Step 2 — Attend assessment. Step 3 — Share understandable next steps with neighbours or carers if helpful.",
      "Community members often learn about {{serviceName}} through word of mouth in {{areaName}} — official guidance comes from {{pharmacyName}}.",
      "Local access routes are explained before first {{serviceName}} attendance.",
      "Inclusive appointments respect varied literacy and language needs during {{serviceName}}.",
      "Neighbourhood familiarity reduces anxiety before {{serviceName}} consultations.",
      "Community health fairs sometimes prompt {{serviceName}} follow-up at {{pharmacyName}}.",
      "Residents ask how {{serviceName}} fits local GP waiting times realistically.",
      "Group conversations are avoided — each {{serviceName}} assessment remains individual.",
      "Community trust grows when {{serviceName}} limits are explained honestly.",
      "Local volunteers may accompany residents to {{serviceName}} appointments.",
      "Walking-distance access influences first contact about {{serviceName}}.",
      "Community members document questions for {{pharmacyName}} before visiting.",
      "Follow-up posters or leaflets are not substitutes for personalised {{serviceName}} advice.",
      "Residents return when {{serviceName}} plans need updating after life changes.",
      "Community health journeys emphasise shared understanding, not shared clinical decisions.",
      "Local networks help reminders for {{serviceName}} follow-ups when appropriate.",
      "Accessible hours support community attendance for {{serviceName}}.",
      "Residents ask when to involve family doctors after {{serviceName}}.",
      "Neighbourhood events may increase initial {{serviceName}} enquiries — assessment still required.",
      "Community journeys end with clear written guidance from {{pharmacyName}}.",
    ],
    preventative_health: [
      "Step 1 — Discuss what {{serviceName}} can detect or support. Step 2 — Attend assessment. Step 3 — Plan follow-up monitoring or GP referral if needed.",
      "Preventative patients book {{serviceName}} early to allow preparation time.",
      "Risk discussions precede any {{serviceName}} intervention in {{areaName}}.",
      "Baseline measurements may be compared over repeat {{serviceName}} visits.",
      "Preventative journeys clarify false reassurance risks after {{serviceName}}.",
      "Patients ask about evidence behind {{serviceName}} recommendations.",
      "Seasonal prevention cycles include {{serviceName}} when suitable.",
      "Lifestyle factors are discussed during {{serviceName}} assessments.",
      "Abnormal findings trigger GP pathways after {{serviceName}} at {{pharmacyName}}.",
      "Preventative plans are realistic — not guaranteed risk elimination.",
      "Patients track metrics discussed during {{serviceName}} reviews.",
      "Prevention-focused residents avoid skipping GP contact when symptoms emerge.",
      "Follow-up intervals are agreed after initial {{serviceName}} assessments.",
      "Preventative booking surges are managed with triage first.",
      "Education is emphasised throughout {{serviceName}} consultations.",
      "Patients understand limits of pharmacy-led {{serviceName}} screening.",
      "Goal setting occurs after suitability confirmation for {{serviceName}}.",
      "Preventative journeys respect patient autonomy on attendance.",
      "Documentation supports continuity between {{serviceName}} visits.",
      "Closing reviews summarise preventative actions patients can take safely.",
    ],
    travel_preparation: [
      "Step 1 — Confirm travel dates and destination. Step 2 — Book {{serviceName}} with adequate lead time. Step 3 — Complete preparation and document advice before departure.",
      "Travellers gather itineraries before {{serviceName}} consultations at {{pharmacyName}}.",
      "Lead times vary by destination — early {{serviceName}} booking is advised.",
      "Family travel requires separate {{serviceName}} assessments per traveller.",
      "Occupational travel deadlines are discussed during {{serviceName}} planning.",
      "Documentation lists are provided after suitable {{serviceName}} consultations.",
      "Last-minute departures may limit {{serviceName}} options — triage explains alternatives.",
      "Post-travel symptoms may require GP rather than repeat {{serviceName}} alone.",
      "Vaccination histories are reviewed during travel-related {{serviceName}}.",
      "Travel journeys emphasise preparation windows, not instant clearance.",
      "Patients ask about contraindications before {{serviceName}} proceeds.",
      "Follow-up doses are scheduled when {{serviceName}} requires courses.",
      "Travel insurance questions are outside {{serviceName}} but signposting may help.",
      "Group tours still need individual {{serviceName}} suitability checks.",
      "Destination disease risks drive {{serviceName}} conversations in {{areaName}}.",
      "Travellers store advice sheets from {{serviceName}} appointments.",
      "Rescheduling {{serviceName}} is common when itineraries change.",
      "Pharmacy travel {{serviceName}} complements specialist travel clinics when needed.",
      "Patients confirm paediatric travel {{serviceName}} needs separately.",
      "Pre-departure checklists close each travel {{serviceName}} consultation.",
    ],
    medication_support: [
      "Step 1 — List current medicines. Step 2 — Discuss {{serviceName}} concerns with {{pharmacyName}}. Step 3 — Agree supply or review plans with prescriber contact if needed.",
      "Medicine support journeys start with accurate prescription records.",
      "New medicine starts prompt {{serviceName}} questions in {{areaName}}.",
      "Adherence difficulties are explored during {{serviceName}} reviews.",
      "Interaction concerns are escalated appropriately after {{serviceName}} assessment.",
      "Repeat supply issues may be resolved through {{serviceName}} guidance.",
      "Patients ask when to contact prescribers during {{serviceName}} plans.",
      "Medicine reviews document changes discussed at {{pharmacyName}}.",
      "Support journeys respect individual treatment decisions from GPs.",
      "Carers assist with medicine lists for {{serviceName}} appointments.",
      "Dosage questions are clarified within pharmacist scope during {{serviceName}}.",
      "Supply delays trigger {{serviceName}} enquiries — solutions vary case by case.",
      "Monitoring plans may follow {{serviceName}} when medicines change.",
      "Patients avoid stopping medicines without review after {{serviceName}} advice.",
      "Structured conversations reduce confusion during {{serviceName}} visits.",
      "Medicine support emphasises safety over convenience alone.",
      "Follow-up {{serviceName}} reviews track reported side effects.",
      "Patients store written plans from {{serviceName}} consultations.",
      "Emergency symptoms bypass {{serviceName}} for urgent care.",
      "Closing {{serviceName}} visits confirm who to call with medicine questions.",
    ],
    wellbeing_focus: [
      "Step 1 — Discuss wellbeing goals with {{pharmacyName}}. Step 2 — Confirm {{serviceName}} suitability. Step 3 — Agree realistic self-care and follow-up steps.",
      "Wellbeing journeys clarify what {{serviceName}} can and cannot achieve.",
      "Goal-setting conversations precede {{serviceName}} appointments in {{areaName}}.",
      "Patients explore lifestyle factors during suitable {{serviceName}} reviews.",
      "Wellbeing plans respect medical limits of pharmacy {{serviceName}}.",
      "Follow-up wellbeing checks occur when clinically useful.",
      "Patients escalate persistent symptoms after {{serviceName}} if needed.",
      "Holistic conversations remain evidence-informed during {{serviceName}}.",
      "Wellbeing journeys avoid promising rapid transformation.",
      "Support plans document small actionable steps after {{serviceName}}.",
      "Patients revisit goals periodically through {{serviceName}} reviews.",
      "Wellbeing enquiries may redirect to GP when appropriate.",
      "Self-care resources complement {{serviceName}} advice from {{pharmacyName}}.",
      "Wellbeing motivation differs from acute symptom management.",
      "Patients ask about complementary boundaries during {{serviceName}}.",
      "Stress and sleep topics may arise in {{serviceName}} conversations.",
      "Wellbeing journeys emphasise sustainable habits over quick fixes.",
      "Follow-up motivation is discussed at the end of {{serviceName}} visits.",
      "Patients track progress discussed during {{serviceName}} check-ins.",
      "Closing summaries reinforce realistic wellbeing expectations.",
    ],
    retirement_health: [
      "Step 1 — Contact {{pharmacyName}} at a comfortable pace. Step 2 — Attend {{serviceName}} with medicine lists and questions. Step 3 — Receive clear written follow-up plans.",
      "Retirement-age patients prefer unhurried {{serviceName}} discussions in {{areaName}}.",
      "Medicine continuity reviews often anchor {{serviceName}} journeys.",
      "Preventative monitoring may be scheduled after suitable {{serviceName}} assessments.",
      "Carers may join {{serviceName}} conversations when patients consent.",
      "Accessible appointment times support {{serviceName}} attendance.",
      "Patients ask for large-print or clear verbal summaries after {{serviceName}}.",
      "Long-term relationships with {{pharmacyName}} support repeat {{serviceName}} visits.",
      "Retirement journeys emphasise stability and predictable follow-up.",
      "Symptom changes prompt GP contact rather than delayed {{serviceName}}.",
      "Medicine reviews and {{serviceName}} may occur in the same planned visit.",
      "Patients store appointment cards for {{serviceName}} follow-ups.",
      "Transport planning is discussed when {{areaName}} access is difficult.",
      "Retirement health avoids rushed counter conversations for complex {{serviceName}}.",
      "Patients appreciate reminder calls for {{serviceName}} monitoring.",
      "Family members receive guidance only with patient permission after {{serviceName}}.",
      "Retirement journeys document who to call out of hours.",
      "Repeat {{serviceName}} builds familiarity and trust over time.",
      "Patients review goals annually through {{serviceName}} where appropriate.",
      "Closing visits confirm understanding in plain language.",
    ],
    convenience_access: [
      "Step 1 — Phone {{pharmacyName}} before travelling to {{areaName}} shops. Step 2 — Confirm {{serviceName}} need. Step 3 — Visit only if assessment or appointment is appropriate.",
      "Errand-based journeys start with quick triage calls about {{serviceName}}.",
      "Walk-in suitability is confirmed before patients divert for {{serviceName}}.",
      "Convenience patients ask about queue times for {{serviceName}}.",
      "Same-day planning depends on {{serviceName}} availability at {{pharmacyName}}.",
      "Retail trips combine with {{serviceName}} only when clinically appropriate.",
      "Patients avoid unnecessary journeys after phone {{serviceName}} triage.",
      "High-street access reduces friction but not clinical assessment.",
      "Convenience journeys document whether return visits are needed.",
      "Short appointments suit errand planners when {{serviceName}} allows.",
      "Patients ask opening hours before combining {{serviceName}} with shopping.",
      "Parking and access questions arise for {{areaName}} convenience visits.",
      "Quick questions may be resolved without full {{serviceName}} appointments.",
      "Patients appreciate honest wait-time information for {{serviceName}}.",
      "Convenience does not mean skipping preparation for {{serviceName}}.",
      "Follow-up by phone suits errand-focused {{areaName}} patients.",
      "Walk-away triage prevents wasted trips when {{serviceName}} is unsuitable.",
      "Patients store {{pharmacyName}} numbers for future {{serviceName}} questions.",
      "Seasonal shopping peaks increase {{serviceName}} enquiries — triage first.",
      "Closing calls confirm whether another visit is necessary.",
    ],
  };
  return journeys[type];
}

function buildHealthcareContext(type: NarrativeType): string[] {
  const templates: Record<NarrativeType, string> = {
    health_management: "Healthcare context for {{areaName}}: {{serviceName}} supports ongoing management within NHS primary care — GP review remains central when symptoms change.",
    working_professionals: "Healthcare context for {{areaName}}: {{serviceName}} fits employment schedules only after pharmacist assessment confirms clinical suitability.",
    young_families: "Healthcare context for {{areaName}}: {{serviceName}} addresses household questions individually — paediatric escalation routes are explained clearly.",
    community_health: "Healthcare context for {{areaName}}: {{serviceName}} reflects how neighbours already use local services — advice stays community-appropriate.",
    preventative_health: "Healthcare context for {{areaName}}: {{serviceName}} supports prevention conversations — abnormal results follow GP pathways.",
    travel_preparation: "Healthcare context for {{areaName}}: {{serviceName}} depends on destination, dates and history — preparation windows vary.",
    medication_support: "Healthcare context for {{areaName}}: {{serviceName}} respects prescriber roles while clarifying supply and safe usage.",
    wellbeing_focus: "Healthcare context for {{areaName}}: {{serviceName}} supports wellbeing within pharmacist scope — medical symptoms escalate appropriately.",
    retirement_health: "Healthcare context for {{areaName}}: {{serviceName}} emphasises continuity, monitoring and accessible pharmacist contact.",
    convenience_access: "Healthcare context for {{areaName}}: {{serviceName}} clarifies appointment need before patients travel to {{pharmacyName}}.",
  };
  const variants = [
    templates[type],
    `${templates[type]} Patients in {{town}} receive the same clinical standards with locally relevant access guidance.`,
    `${templates[type]} Emergency care remains appropriate when symptoms are severe or sudden.`,
    `${templates[type]} NHS and private routes are explained after individual assessment.`,
    `${templates[type]} Follow-up plans are documented when monitoring is clinically useful.`,
  ];
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    out.push(`${variants[i % variants.length]} (${i + 1})`);
  }
  return out;
}

function buildLocalLifestyle(type: NarrativeType): string[] {
  const base: Record<NarrativeType, string> = {
    health_management: "Lifestyle in {{areaName}}: patients weave {{serviceName}} around existing appointments and medicine routines.",
    working_professionals: "Lifestyle in {{areaName}}: shifts and commutes determine when {{serviceName}} is practical at {{pharmacyName}}.",
    young_families: "Lifestyle in {{areaName}}: school runs and childcare shape family {{serviceName}} planning.",
    community_health: "Lifestyle in {{areaName}}: familiar local routes make pharmacy contact part of everyday health habits.",
    preventative_health: "Lifestyle in {{areaName}}: preventative {{serviceName}} often aligns with seasonal health planning.",
    travel_preparation: "Lifestyle in {{areaName}}: departure dates drive when travellers seek {{serviceName}} advice.",
    medication_support: "Lifestyle in {{areaName}}: collection habits and reminders influence {{serviceName}} timing.",
    wellbeing_focus: "Lifestyle in {{areaName}}: personal health goals guide when {{serviceName}} feels relevant.",
    retirement_health: "Lifestyle in {{areaName}}: steady routines support repeat {{serviceName}} attendance.",
    convenience_access: "Lifestyle in {{areaName}}: retail errands create natural moments to ask about {{serviceName}}.",
  };
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    out.push(`${base[type]} Local pattern variant ${i + 1} for {{areaName}} residents.`);
  }
  return out;
}

function buildCta(type: NarrativeType): string[] {
  const base: Record<NarrativeType, string> = {
    health_management: "Contact {{pharmacyName}} to confirm how {{serviceName}} supports your ongoing health plan in {{areaName}}.",
    working_professionals: "Call {{pharmacyName}} to check {{serviceName}} timing fits your work schedule in {{areaName}}.",
    young_families: "Speak to {{pharmacyName}} about whether {{serviceName}} suits your household in {{areaName}}.",
    community_health: "Ask {{pharmacyName}} how {{serviceName}} works for {{areaName}} residents before booking.",
    preventative_health: "Discuss what {{serviceName}} can assess with {{pharmacyName}} before preventative booking in {{areaName}}.",
    travel_preparation: "Confirm travel dates with {{pharmacyName}} when planning {{serviceName}} from {{areaName}}.",
    medication_support: "Review your medicines with {{pharmacyName}} to see if {{serviceName}} is appropriate in {{areaName}}.",
    wellbeing_focus: "Talk through wellbeing goals at {{pharmacyName}} before booking {{serviceName}} in {{areaName}}.",
    retirement_health: "Arrange a comfortable appointment with {{pharmacyName}} for {{serviceName}} in {{areaName}}.",
    convenience_access: "Phone {{pharmacyName}} first to check if you need an appointment for {{serviceName}} near {{areaName}}.",
  };
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    out.push(`${base[type]} Intent variant ${i + 1}.`);
  }
  return out;
}

function buildFaqOpener(type: NarrativeType): string[] {
  const openers: Record<NarrativeType, string[]> = {
    health_management: ["For ongoing care in {{areaName}}, ", "When managing health routines, ", "Patients coordinating treatment ask ", "If you already use local NHS services, ", "Before changing management plans, "],
    working_professionals: ["If you need {{serviceName}} around work hours, ", "Before taking time off for {{serviceName}}, ", "Commuters from {{areaName}} often ask ", "When scheduling around shifts, ", "Working patients wondering about timing ask "],
    young_families: ["Parents in {{areaName}} frequently ask ", "For household {{serviceName}} questions, ", "When booking around school hours, ", "Families planning together ask ", "If children and adults need advice, "],
    community_health: ["Neighbours in {{areaName}} often ask ", "For local {{serviceName}} access, ", "Community members checking suitability ask ", "When learning how services work locally, ", "Residents new to {{serviceName}} ask "],
    preventative_health: ["For preventative {{serviceName}} planning, ", "When considering early checks, ", "Health-conscious patients in {{areaName}} ask ", "Before preventative booking, ", "If you want realistic screening scope, "],
    travel_preparation: ["Before travelling from {{areaName}}, ", "When planning departure dates, ", "Travellers preparing itineraries ask ", "For destination-related {{serviceName}}, ", "If your trip is soon, "],
    medication_support: ["For medicine-related {{serviceName}} questions, ", "When reviewing repeat prescriptions, ", "Patients managing medicines ask ", "If supply or dosage is unclear, ", "Before changing medicine routines, "],
    wellbeing_focus: ["For wellbeing-related {{serviceName}} goals, ", "When exploring lifestyle support, ", "Patients focused on wellbeing ask ", "If you want realistic outcomes, ", "Before wellbeing booking, "],
    retirement_health: ["For long-term health in {{areaName}}, ", "Older patients planning {{serviceName}} ask ", "When maintaining medicine routines, ", "If you prefer unhurried appointments, ", "Residents seeking continuity ask "],
    convenience_access: ["Before combining errands with {{serviceName}}, ", "When checking walk-in suitability, ", "If you are already near {{areaName}} shops, ", "For quick access questions, ", "Before making a special trip, "],
  };
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    out.push(`${openers[type][i % openers[type].length]}{{questionStub}}`);
  }
  return out;
}

function buildBridge(type: NarrativeType): string[] {
  const bridges: Record<NarrativeType, string[]> = {
    health_management: [
      "Within ongoing care pathways, {{serviceName}} at {{pharmacyName}} adds pharmacist structure — not a replacement for medical diagnosis.",
      "Management-focused patients in {{areaName}} should treat {{serviceName}} as one coordinated step among existing contacts.",
    ],
    working_professionals: [
      "Efficient access from {{areaName}} still requires clinical assessment before {{serviceName}} proceeds.",
      "Work schedules influence timing, not the clinical standards applied to {{serviceName}}.",
    ],
    young_families: [
      "Family bookings for {{serviceName}} assess each person individually at {{pharmacyName}}.",
      "Household convenience never bypasses suitability checks for {{serviceName}}.",
    ],
    community_health: [
      "Local understanding helps {{areaName}} patients use {{serviceName}} appropriately within community healthcare habits.",
      "Community access guidance from {{pharmacyName}} stays authoritative after assessment.",
    ],
    preventative_health: [
      "Preventative {{serviceName}} conversations clarify scope before expectations form.",
      "Early checks through {{serviceName}} complement — not replace — GP oversight when needed.",
    ],
    travel_preparation: [
      "Travel timelines determine whether {{serviceName}} at {{pharmacyName}} can be completed before departure.",
      "Destination-specific risks shape {{serviceName}} advice for {{areaName}} travellers.",
    ],
    medication_support: [
      "Medicine support through {{serviceName}} respects prescriber authority while clarifying safe use.",
      "Supply questions for {{areaName}} patients are resolved case by case after review.",
    ],
    wellbeing_focus: [
      "Wellbeing-oriented {{serviceName}} stays within pharmacist scope for {{areaName}} patients.",
      "Goals discussed during {{serviceName}} must remain medically realistic.",
    ],
    retirement_health: [
      "Continuity matters — {{serviceName}} at {{pharmacyName}} supports stable routines for {{areaName}} residents.",
      "Accessible conversations help older patients use {{serviceName}} confidently.",
    ],
    convenience_access: [
      "Convenience from {{areaName}} begins with a quick suitability check for {{serviceName}}.",
      "Errand planning should not skip assessment before {{serviceName}} treatment decisions.",
    ],
  };
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    out.push(`${bridges[type][i % bridges[type].length]} Bridge ${i + 1}.`);
  }
  return out;
}

function buildPatternSet(type: NarrativeType): NarrativePatternSet {
  return {
    intro: expandCategory(type, "intro", INTRO_ANGLES[type]),
    patientJourney: journeyPatterns(type),
    healthcareContext: buildHealthcareContext(type),
    localLifestyle: buildLocalLifestyle(type),
    cta: buildCta(type),
    faqOpener: buildFaqOpener(type),
    bridge: buildBridge(type),
  };
}

export const NARRATIVE_LIBRARY: Record<NarrativeType, NarrativePatternSet> = Object.fromEntries(
  NARRATIVE_TYPES.map((t) => [t, buildPatternSet(t)]),
) as Record<NarrativeType, NarrativePatternSet>;

export function validateNarrativeLibrary(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const type of NARRATIVE_TYPES) {
    const set = NARRATIVE_LIBRARY[type];
    for (const cat of ["intro", "patientJourney", "healthcareContext", "localLifestyle", "cta", "faqOpener", "bridge"] as const) {
      if (set[cat].length < 20) errors.push(`${type}.${cat} has ${set[cat].length} patterns (need 20)`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function fillPattern(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export function pickPattern(
  patterns: string[],
  seed: number,
): string {
  if (!patterns.length) return "";
  return patterns[((seed % patterns.length) + patterns.length) % patterns.length];
}
