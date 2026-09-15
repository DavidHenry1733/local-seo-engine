/**
 * Local cluster copy variant families — deterministic selection per area.
 */
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";

export interface LocalCopyVariant {
  body: string;
}

export interface LocalHeadingVariant {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface LocalProcessVariant {
  intro: string;
  steps: Array<{ title: string; body: string }>;
}

export interface LocalCtaVariant {
  primary: string;
  secondary: string;
  phonePrompt: string;
}

function pick<T>(
  items: T[],
  slug: string,
  serviceId: string,
  areaSlug: string,
  slot: string,
  areaIndex = 0,
): T {
  // Prime multiplier spreads indices that are close (e.g. aston=3 vs parkgate=5)
  const jitter = hashSeed(slug, serviceId, slot, areaSlug) % items.length;
  const idx = (areaIndex * 3 + jitter) % items.length;
  return items[(idx + items.length) % items.length]!;
}

const HERO_OPENERS = [
  "Locally,",
  "In practice,",
  "For many patients,",
  "Across the area,",
  "In this community,",
  "For residents nearby,",
  "On a practical level,",
  "From a patient perspective,",
  "When booking locally,",
  "For convenient access,",
];

const AREA_ANGLE_LINES = [
  "Many adults in {area} book a check after a GP suggestion, a pharmacy NHS service leaflet, or a home monitor reading they want confirmed.",
  "In {area}, patients often arrange blood pressure screening before starting new medicines or during an annual health review.",
  "People across {area} use {pharmacy} when they want a measured reading with time to ask follow-up questions in plain language.",
  "Patients travelling from {area} frequently call ahead to confirm appointment length, parking and whether walk-in support is available.",
  "For {area} residents managing busy schedules, a pharmacy check can be easier to arrange than waiting for a routine GP screening slot.",
  "Some patients in {area} attend after noticing headaches, dizziness or fatigue — the pharmacist helps interpret whether the reading needs urgent action.",
  "Others in {area} attend for baseline screening with no symptoms, especially if they have family history or age-related risk factors.",
  "Households near {area} sometimes book together so partners or relatives receive consistent advice from the same pharmacy team.",
  "Patients around {area} may compare home monitor readings with a pharmacy measurement to check technique and cuff positioning.",
  "If you are new to {area} or recently changed GP, a pharmacy check can provide an interim reading while routine care is arranged.",
];

export function fillLocalTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, "gi"), value);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

const HERO_FAMILIES: LocalCopyVariant[] = [
  {
    body: "Patients in {area} can use {pharmacy} for a straightforward {serviceLower} — clear guidance on what the reading means and practical next steps. Call {phone} to check availability.",
  },
  {
    body: "If you live in or around {area}, {pharmacy} offers pharmacist-led {serviceLower} with time to discuss your result and whether GP follow-up is needed. Call {phone} to book or ask about walk-in availability.",
  },
  {
    body: "{pharmacy} supports people in {area} who want a convenient {serviceLower} without waiting for a routine GP appointment. The team explains your reading in plain language. Call {phone} for opening times and booking.",
  },
  {
    body: "Many residents in {area} choose {pharmacy} for {serviceLower} because the consultation is private, practical and easy to arrange around work or family commitments. Call {phone} to speak to the team.",
  },
  {
    body: "Whether you are monitoring an existing reading or checking for the first time, patients in {area} can access {serviceLower} at {pharmacy}. Call {phone} to confirm suitability and appointment options.",
  },
  {
    body: "A {serviceLower} at {pharmacy} suits patients in {area} who want a professional reading without committing to a full GP appointment first. The pharmacist explains what your numbers mean and when to seek further help. Call {phone} to arrange a visit.",
  },
  {
    body: "From {area}, many people contact {pharmacy} when home monitoring shows a reading they want verified in a clinical setting. Call {phone} for appointment times, walk-in availability and preparation advice.",
  },
  {
    body: "If you are overdue a blood pressure review, {pharmacy} offers a measured {serviceLower} for patients based in {area} with clear follow-up guidance. Phone {phone} to check suitability before travelling.",
  },
  {
    body: "Patients in {area} often value having time to ask questions after a reading — {pharmacy} provides that as part of every {serviceLower}. Call {phone} to book or enquire about same-day options.",
  },
  {
    body: "Whether you have symptoms, a family history concern or a GP request for a check, {area} residents can arrange {serviceLower} at {pharmacy}. Call {phone} for directions and opening hours.",
  },
];

const LOCAL_RELEVANCE_FAMILIES: LocalHeadingVariant[] = [
  {
    heading: "Why {service} matters for {area} patients",
    body: "High blood pressure often develops without obvious symptoms. A pharmacy check helps patients in {area} understand their reading and whether further monitoring, lifestyle advice or GP review is appropriate.",
  },
  {
    heading: "{service} for people in {area}",
    body: "Patients across {area} use {pharmacy} when they want a measured assessment, plain-language explanation and documented advice — especially if GP waiting times make routine screening harder to arrange.",
  },
  {
    heading: "Local access to {serviceLower} from {area}",
    body: "From {area}, contacting {pharmacy} directly is often the quickest way to confirm appointment availability, preparation advice and what to bring to a {serviceLower} consultation.",
  },
  {
    heading: "Practical pharmacy support near {area}",
    body: "The {pharmacy} team regularly supports patients travelling from {area} and neighbouring communities. Each consultation confirms suitability individually rather than assuming online information applies to everyone.",
  },
  {
    heading: "Blood pressure screening for {area} residents",
    body: "Regular checks can identify raised readings early. Patients in {area} can ask {pharmacy} about frequency, home monitoring comparisons and when urgent medical help is more appropriate than pharmacy review.",
  },
  {
    heading: "Keeping on top of blood pressure in {area}",
    body: "Untreated high blood pressure increases long-term health risks, yet many adults feel well. {pharmacy} helps patients from {area} interpret a reading and decide whether lifestyle changes, repeat checks or GP input are sensible next steps.",
  },
  {
    heading: "{service} without the GP wait",
    body: "When routine GP screening is hard to schedule, a pharmacy {serviceLower} offers a practical alternative for {area} patients who still want professional measurement and advice.",
  },
  {
    heading: "Community pharmacy support for {area}",
    body: "The {pharmacy} team sees patients from {area} for one-off checks, repeat monitoring and advice after GP referral. Each visit is assessed individually for clinical suitability.",
  },
  {
    heading: "Why {area} patients choose pharmacy screening",
    body: "Convenience, privacy and plain-language explanation matter. {pharmacy} focuses on what your reading means today and what to do before your next review.",
  },
  {
    heading: "Local {serviceLower} with clear next steps",
    body: "Patients travelling from {area} receive measured assessment, not counter-side guessing. Call {phone} if you are unsure whether a pharmacy check is right for your circumstances.",
  },
];

const WHY_CHECKS_FAMILIES: LocalHeadingVariant[] = [
  {
    heading: "Why regular blood pressure checks matter",
    body: "Blood pressure can be high without clear symptoms, which is why periodic screening matters. A pharmacy check helps patients understand whether a single reading needs repeating, lifestyle review or GP follow-up.",
    bullets: [
      "Silent risk — elevated readings may not feel obvious day to day",
      "Pharmacist explains what your numbers mean in plain language",
      "Guidance on monitoring, GP contact or urgent help when appropriate",
      "Useful between routine GP reviews for many adults over 40",
    ],
  },
  {
    heading: "What a pharmacy blood pressure check includes",
    body: "The consultation is structured and measured — not a quick shop-floor test. Patients receive context for their reading and clear safety-netting before they leave.",
    bullets: [
      "Rest period before measurement where clinically appropriate",
      "Blood pressure reading with explanation of the result",
      "Discussion of risk factors, medicines and lifestyle where relevant",
      "Advice on repeat checks, home monitoring or GP referral",
    ],
  },
  {
    heading: "Understanding your blood pressure reading",
    body: "One reading does not always tell the full story, but it is a useful starting point. The pharmacist helps patients in {area} decide whether to monitor, book a GP review or seek urgent care.",
    bullets: [
      "Results explained without medical jargon",
      "Comparison with previous readings when available",
      "When to repeat the check or monitor at home",
      "Escalation advice if symptoms or readings cause concern",
    ],
  },
  {
    heading: "Why patients in {area} book blood pressure checks",
    body: "People often book when they want reassurance, a baseline reading, or support managing an existing diagnosis. {pharmacy} focuses on practical next steps rather than generic health messaging.",
    bullets: [
      "Convenient access alongside everyday pharmacy services",
      "Private consultation room discussion where available",
      "Documentation or advice for GP continuity when needed",
      "Clear boundaries on what pharmacy can and cannot diagnose",
    ],
  },
  {
    heading: "Blood pressure checks at {pharmacy}",
    body: "Pharmacist-led screening complements GP care. It is suitable for many adults who want a measured check with professional interpretation and follow-up guidance.",
    bullets: [
      "Assessment before any advice is given",
      "Plain-language explanation of systolic and diastolic readings",
      "Lifestyle and medicine questions handled sensitively",
      "Safety-netting for symptoms that need urgent attention",
    ],
  },
  {
    heading: "When a pharmacy check is useful",
    body: "Many adults in {area} book when they want a baseline, a second opinion on home readings, or reassurance between GP reviews. The pharmacist explains limits as well as benefits.",
    bullets: [
      "No diagnosis from a single visit — context matters",
      "Repeat measurement may be recommended on the day",
      "Red-flag symptoms trigger urgent care advice, not delay",
      "Useful for adults over 40 and those with risk factors",
    ],
  },
  {
    heading: "What happens during screening",
    body: "The consultation is structured: suitability, measurement, explanation and follow-up plan. Patients from {area} can ask questions throughout.",
    bullets: [
      "Brief health history before the cuff is applied",
      "Rest period where clinically appropriate",
      "Numbers explained without jargon",
      "Written or verbal guidance for GP continuity when needed",
    ],
  },
  {
    heading: "Blood pressure and silent risk",
    body: "Elevated readings often cause no obvious symptoms, which is why periodic checks help. {pharmacy} supports {area} patients with practical monitoring advice.",
    bullets: [
      "Single readings interpreted cautiously",
      "Home monitor technique can be discussed",
      "Medicines and lifestyle factors considered",
      "Clear escalation when GP or emergency care is needed",
    ],
  },
  {
    heading: "Professional measurement matters",
    body: "Shop-floor devices and home cuffs vary in accuracy. A pharmacist-led check at {pharmacy} follows a consistent process for patients visiting from {area}.",
    bullets: [
      "Correct cuff size and arm position checked",
      "Multiple readings when appropriate",
      "Comparison with previous results if available",
      "Advice tailored to your age and medical history",
    ],
  },
  {
    heading: "After your reading",
    body: "You leave knowing whether to monitor, repeat the check, adjust lifestyle factors or contact your GP. The team at {pharmacy} does not leave results unexplained.",
    bullets: [
      "Follow-up intervals discussed clearly",
      "Symptoms that need urgent assessment highlighted",
      "Documentation for GP when clinically useful",
      "Boundaries of pharmacy screening explained honestly",
    ],
  },
];

const PROCESS_FAMILIES: LocalProcessVariant[] = [
  {
    intro: "A typical {serviceLower} appointment at {pharmacy} for patients coming from {area} follows four clear steps.",
    steps: [
      { title: "Call or enquire", body: "Contact {pharmacy} on {phone} to check availability, walk-in suitability and whether you should avoid caffeine or exercise beforehand." },
      { title: "Private consultation", body: "A pharmacist confirms suitability, takes your reading and asks brief health questions relevant to blood pressure screening." },
      { title: "Result and advice", body: "You receive a plain-language explanation of your reading and what it may mean for monitoring, lifestyle changes or GP review." },
      { title: "Next steps", body: "The team advises on repeat checks, home monitoring or contacting your GP if the reading or symptoms warrant further assessment." },
    ],
  },
  {
    intro: "Patients travelling from {area} usually find the process straightforward once appointment expectations are clear.",
    steps: [
      { title: "Book your visit", body: "Call {phone} to arrange a {serviceLower} at {pharmacy} or ask whether a same-day slot may be available." },
      { title: "Arrive prepared", body: "Allow a short rest before measurement if asked, and mention medicines, caffeine or recent activity that could affect the reading." },
      { title: "Review your reading", body: "The pharmacist explains whether the result looks typical, elevated or needs repeating before any decision is made." },
      { title: "Follow-up plan", body: "You leave with practical guidance on monitoring intervals, GP contact or urgent care if red-flag symptoms are present." },
    ],
  },
  {
    intro: "How {serviceLower} works when you visit {pharmacy} from {area}.",
    steps: [
      { title: "Check suitability", body: "Phone {phone} if you are unsure whether a pharmacy check is appropriate — the team can advise before you travel." },
      { title: "Measured assessment", body: "Blood pressure is taken in a professional setting with time to discuss context, not rushed at the counter." },
      { title: "Personalised advice", body: "Advice reflects your age, medicines, symptoms and any previous readings you can share." },
      { title: "Safety-netting", body: "You are told when to repeat the check, book a GP review or seek urgent help depending on the result." },
    ],
  },
  {
    intro: "From first contact to follow-up, {pharmacy} keeps {serviceLower} practical for patients based in {area}.",
    steps: [
      { title: "Contact the pharmacy", body: "Call {phone} for opening hours, appointment length and what identification or medical details to bring." },
      { title: "Consultation", body: "The pharmacist conducts the check privately and explains the process before measurement." },
      { title: "Outcome discussion", body: "Your reading is interpreted with clear explanation of limits of a single screening visit." },
      { title: "Ongoing support", body: "Repeat visits, home monitoring tips or GP referral guidance are discussed where clinically appropriate." },
    ],
  },
  {
    intro: "Expect a structured appointment — not a quick unattended reading — when you attend {pharmacy} from {area}.",
    steps: [
      { title: "Arrange attendance", body: "Use {phone} to confirm whether you need an appointment or can attend during a suitable opening window." },
      { title: "Health context", body: "Brief questions cover medicines, symptoms and previous blood pressure history to interpret the result safely." },
      { title: "Reading explained", body: "The pharmacist explains the numbers and whether lifestyle, monitoring or GP input should be considered next." },
      { title: "Written or verbal next steps", body: "You receive actionable guidance before leaving, including when not to rely on pharmacy screening alone." },
    ],
  },
  {
    intro: "Booking from {area} is simple — the team at {pharmacy} talks you through timing, preparation and what the consultation includes.",
    steps: [
      { title: "Phone first", body: "Dial {phone} to confirm {serviceLower} availability and whether an appointment is required." },
      { title: "Prepare calmly", body: "Avoid heavy exercise and large caffeine intake shortly before your visit if possible; the pharmacist will advise on the day." },
      { title: "Measured reading", body: "Blood pressure is taken with appropriate rest and technique, then explained in context of your health history." },
      { title: "Plan forward", body: "You receive guidance on repeat checks, GP contact or urgent care depending on the result and any symptoms." },
    ],
  },
  {
    intro: "Patients from {area} often ask what to expect — here is the usual flow for {serviceLower} at {pharmacy}.",
    steps: [
      { title: "Enquire", body: "Call {phone} with any questions about suitability, especially if you are pregnant, under 18 or have complex conditions." },
      { title: "Attend", body: "Allow time for a private discussion; the check is not limited to a single cuff reading without explanation." },
      { title: "Understand results", body: "Systolic and diastolic values are explained and compared with typical ranges for your circumstances." },
      { title: "Next actions", body: "Monitoring intervals, lifestyle factors and GP referral thresholds are discussed before you leave." },
    ],
  },
  {
    intro: "A structured visit from {area} to {pharmacy} typically covers suitability, measurement and follow-up planning.",
    steps: [
      { title: "Confirm booking", body: "Use {phone} to secure a slot or check walk-in windows that suit your journey from {area}." },
      { title: "Health questions", body: "The pharmacist asks about medicines, symptoms and previous readings to interpret results safely." },
      { title: "Take reading", body: "Measurement follows appropriate rest; a second reading may be taken if the first seems unexpectedly high or low." },
      { title: "Leave informed", body: "You know whether to monitor at home, return for repeat screening or contact your GP promptly." },
    ],
  },
  {
    intro: "For {area} residents, {pharmacy} keeps {serviceLower} focused on clarity — what was measured, what it means and what to do next.",
    steps: [
      { title: "Reach out", body: "Phone {phone} for opening hours and to confirm the consultation room is available." },
      { title: "Consultation", body: "The pharmacist confirms the service is appropriate and explains the process before measurement." },
      { title: "Review together", body: "Results are discussed with time for questions — rushed counter checks are not the standard here." },
      { title: "Safety-netting", body: "Emergency symptoms and very high readings trigger clear escalation advice, not vague reassurance." },
    ],
  },
  {
    intro: "Many patients travelling from {area} appreciate knowing the steps in advance before visiting {pharmacy}.",
    steps: [
      { title: "Call to book", body: "Ring {phone} to arrange {serviceLower} and ask about parking or public transport from {area}." },
      { title: "Arrive ready", body: "Wear loose clothing on your upper arm and mention if you have already taken readings at home." },
      { title: "Professional check", body: "The pharmacist conducts the assessment and documents key points where appropriate." },
      { title: "Follow-up advice", body: "Repeat visit timing, home monitoring tips and GP communication are covered before you go." },
    ],
  },
];

const ACCESS_FAMILIES: LocalHeadingVariant[] = [
  {
    heading: "Access from {area}",
    body: "Patients in {area} can contact {pharmacy} on {phone} for directions to the pharmacy, opening hours and appointment availability. The pharmacy address is {address}.",
  },
  {
    heading: "Visiting {pharmacy} from {area}",
    body: "If you are travelling from {area}, call {phone} before visiting so the team can confirm the best time for a {serviceLower} and any preparation advice. Full address: {address}.",
  },
  {
    heading: "Contact and directions for {area} patients",
    body: "The simplest route is to call {pharmacy} on {phone}. The team can explain parking, access and whether booking is required for {serviceLower}. Address: {address}.",
  },
  {
    heading: "Planning your visit from {area}",
    body: "Many patients from {area} call ahead on {phone} to fit a consultation around work or caring responsibilities. {pharmacy} is located at {address}.",
  },
  {
    heading: "How to reach {pharmacy} from {area}",
    body: "Use {phone} to confirm opening hours and book a {serviceLower}. The pharmacy serves patients from {area} and surrounding communities from {address}.",
  },
  {
    heading: "Getting to {pharmacy} from {area}",
    body: "Call {phone} for the quickest route from {area}, expected journey time and whether appointments are required. The pharmacy is at {address}.",
  },
  {
    heading: "Directions for {area} patients",
    body: "Patients in {area} can phone {phone} for step-by-step directions, parking options and accessibility information before booking {serviceLower}. Address: {address}.",
  },
  {
    heading: "Contact {pharmacy} from {area}",
    body: "The team at {phone} can confirm same-day availability, consultation length and what to bring. {pharmacy} is located at {address}.",
  },
  {
    heading: "Planning travel from {area}",
    body: "Whether you drive or use public transport from {area}, calling {phone} first helps you choose a suitable appointment window. Full address: {address}.",
  },
  {
    heading: "Visit {pharmacy} from {area}",
    body: "Book or enquire about {serviceLower} by calling {phone}. The pharmacy welcomes patients from {area} and nearby communities at {address}.",
  },
];

const TRUST_FAMILIES: LocalHeadingVariant[] = [
  {
    heading: "Professional standards you can expect",
    body: "{pharmacy} delivers {serviceLower} with pharmacist oversight, clear consent and escalation to GP or emergency services when a reading or symptoms require it.",
  },
  {
    heading: "Safe, measured screening",
    body: "Suitability is confirmed individually for each patient from {area}. The team does not provide a hypertension diagnosis from a single pharmacy reading alone.",
  },
  {
    heading: "Accountability and clinical governance",
    body: "Patients visiting from {area} receive care from a GPhC-registered team with documented review processes and plain-language safety-netting.",
  },
  {
    heading: "Why patients trust {pharmacy}",
    body: "Consultations are professional and private where possible. Advice is practical, evidence-informed and focused on appropriate next steps after your reading.",
  },
  {
    heading: "Clinical boundaries explained clearly",
    body: "Pharmacy screening supports monitoring and advice, but ongoing diagnosis and treatment planning may still require GP or specialist input when indicated.",
  },
  {
    heading: "Registered pharmacy professionals",
    body: "Every {serviceLower} at {pharmacy} is delivered under pharmacist supervision with governance processes appropriate to NHS and private pharmacy services.",
  },
  {
    heading: "Honest, measured advice",
    body: "Patients from {area} are told when a pharmacy reading is sufficient for monitoring and when GP or emergency assessment is the safer option.",
  },
  {
    heading: "Privacy and professionalism",
    body: "Consultations take place in a professional setting where possible, with sensitive health information handled appropriately.",
  },
  {
    heading: "Evidence-informed screening",
    body: "{pharmacy} follows recognised protocols for blood pressure measurement and escalation, with plain-language explanation for {area} patients.",
  },
  {
    heading: "Your safety comes first",
    body: "If a reading or symptom pattern suggests urgent concern, the team directs you to appropriate care rather than treating pharmacy screening as a substitute.",
  },
];

const CTA_FAMILIES: LocalCtaVariant[] = [
  { primary: "Call {pharmacy}", secondary: "View main service page", phonePrompt: "Call {phone} to book {serviceLower}" },
  { primary: "Check availability", secondary: "Main {service} page", phonePrompt: "Phone {phone} for appointment times" },
  { primary: "Speak to the pharmacist", secondary: "Back to service page", phonePrompt: "Call {phone} from {area} today" },
  { primary: "Book {serviceLower}", secondary: "Full service details", phonePrompt: "Ring {phone} to arrange your visit" },
  { primary: "Contact {pharmacy}", secondary: "Main service information", phonePrompt: "Call {phone} — {pharmacy}" },
  { primary: "Arrange {serviceLower}", secondary: "Service overview", phonePrompt: "Phone {phone} from {area}" },
  { primary: "Call for availability", secondary: "Back to {service}", phonePrompt: "Ring {phone} to book today" },
  { primary: "Book your check", secondary: "Full {service} details", phonePrompt: "Dial {phone} — {area} patients welcome" },
  { primary: "Enquire now", secondary: "Main service page", phonePrompt: "Call {phone} for appointment options" },
  { primary: "Speak to {pharmacy}", secondary: "View service page", phonePrompt: "{phone} — book {serviceLower}" },
];

const WHY_CHECKS_AREA_LINES = [
  "Risk often increases quietly with age, medicines and family history — a pharmacy reading helps establish whether home or GP monitoring is more appropriate.",
  "Weekend and evening availability can make pharmacy screening easier to fit around work, school runs and caring responsibilities.",
  "Some patients attend after a home monitor showed an unusually high or low reading and want a second measurement.",
  "Seasonal changes, stress and short-term illness can affect readings — the pharmacist helps interpret this context.",
  "If you take medicines for diabetes, kidney disease or heart conditions, regular checks may be especially useful.",
  "Patients starting new medicines that affect blood pressure sometimes book a baseline reading for comparison later.",
  "Clear safety-netting matters: you will be told when symptoms require urgent assessment rather than routine review.",
  "Documentation for your GP can be helpful if you are between routine appointments or recently changed surgery.",
  "Lifestyle factors such as salt intake, alcohol and activity are discussed sensitively where relevant to your result.",
  "Repeat measurement is often recommended because one reading rarely tells the complete clinical picture.",
];

/** Area-index-specific paragraph injected into local relevance for stronger copy differentiation. */
export const LOCAL_DISTINCT_PARAGRAPHS = [
  "Some patients prefer to combine a pharmacy visit with other errands, while others book a dedicated appointment slot — either approach works when you call ahead.",
  "If you monitor at home, note the time of day and whether you rested before measuring; the pharmacist can compare this with the in-pharmacy reading.",
  "Carers and family members often ask how to support someone with borderline readings — the team explains monitoring intervals in plain language.",
  "New patients sometimes worry about white-coat effects; resting before measurement and a calm consultation room help produce a representative reading.",
  "If you take medicines for diabetes, kidney disease or heart conditions, mention them when booking so the pharmacist can interpret results in context.",
  "Patients between GP reviews may find pharmacy screening useful as an interim check, especially when routine appointments are weeks away.",
  "Travel time and parking can affect how relaxed you feel on arrival — allow a few minutes to settle before measurement if you have driven from the local area.",
  "Seasonal illness, stress and short-term dehydration can shift readings; the pharmacist helps decide whether to repeat the check another day.",
  "If you have symptoms such as persistent headache, chest pain or sudden vision changes, mention them immediately — urgent care may be more appropriate than screening alone.",
  "Documentation of today's reading can support conversations with your GP, particularly if you are building a record of home and pharmacy measurements over time.",
];

export function localDistinctParagraph(areaIndex: number): string {
  return LOCAL_DISTINCT_PARAGRAPHS[areaIndex % LOCAL_DISTINCT_PARAGRAPHS.length]!;
}

const PROCESS_INTRO_TAILS = [
  "Appointments are usually short, but allow time to discuss your result before leaving.",
  "If you monitor at home, bring your device or recent readings to compare technique and timing.",
  "Tell the pharmacist about medicines, caffeine and activity before the reading is taken.",
  "Wear loose sleeves if possible so the cuff can be placed comfortably on your upper arm.",
  "If you feel unwell, mention symptoms straight away — urgent care may be more appropriate.",
  "Children and adults may have different suitability — confirm when you call to book.",
  "Carers are welcome to attend and ask questions on behalf of someone they support.",
  "Allow a few minutes to rest if you have walked quickly from parking or public transport.",
  "Repeat checks may be advised rather than making decisions from a single measurement.",
  "Ask about documentation for your GP if you need a record of the reading.",
];

const TRUST_BODY_TAILS = [
  "Single readings are interpreted cautiously; the pharmacist explains when repeat measurement is sensible.",
  "You will be told clearly if your result suggests routine GP follow-up rather than emergency care.",
  "Any advice given is specific to your consultation — online general guidance may not apply.",
  "The team documents key points where appropriate so you can share them with your GP.",
  "If you already treat hypertension, bring your current medicines and recent readings.",
  "Emergency symptoms are never ignored — you will be directed to appropriate care if needed.",
  "Confidential discussion is available in the consultation room where provided.",
  "The pharmacy cannot replace GP diagnosis but can support monitoring and signposting.",
  "Follow-up intervals depend on your age, history and the reading taken on the day.",
  "You can ask about lifestyle factors that may affect blood pressure between appointments.",
];

const FAQ_ANSWER_SUFFIXES = [
  "The {pharmacy} team can confirm this when you call {phone}.",
  "Ask during booking on {phone} if you are travelling from {area}.",
  "This is discussed during your consultation at {pharmacy}.",
  "Call {phone} for the latest availability and suitability guidance.",
  "The pharmacist will explain this clearly before your check goes ahead.",
  "Phone {phone} before visiting from {area} if you need accessibility information.",
  "The team at {pharmacy} can advise on appointment length when you call {phone}.",
  "Mention you are coming from {area} when you call {phone} for tailored directions.",
  "Suitability questions are best answered on {phone} before you travel from {area}.",
  "Call {phone} to confirm whether walk-in {serviceLower} slots are available today.",
];

export function selectLocalClusterVariants(
  slug: string,
  serviceId: string,
  areaSlug: string,
  vars: Record<string, string>,
  areaIndex = 0,
): {
  heroIntro: string;
  localRelevance: LocalHeadingVariant;
  whyChecks: LocalHeadingVariant;
  process: LocalProcessVariant;
  access: LocalHeadingVariant;
  trust: LocalHeadingVariant;
  cta: LocalCtaVariant;
  faqAnswerSuffix: string;
  areaAngleLine: string;
  processIntroTail: string;
  trustBodyTail: string;
  whyChecksAreaLine: string;
} {
  const hero = pick(HERO_FAMILIES, slug, serviceId, areaSlug, "hero", areaIndex);
  const localRelevance = pick(LOCAL_RELEVANCE_FAMILIES, slug, serviceId, areaSlug, "local-relevance", areaIndex);
  const whyChecks = pick(WHY_CHECKS_FAMILIES, slug, serviceId, areaSlug, "why-checks", areaIndex);
  const process = pick(PROCESS_FAMILIES, slug, serviceId, areaSlug, "process", areaIndex);
  const access = pick(ACCESS_FAMILIES, slug, serviceId, areaSlug, "access", areaIndex);
  const trust = pick(TRUST_FAMILIES, slug, serviceId, areaSlug, "trust", areaIndex);
  const cta = pick(CTA_FAMILIES, slug, serviceId, areaSlug, "cta", areaIndex);
  const faqAnswerSuffix = pick(FAQ_ANSWER_SUFFIXES, slug, serviceId, areaSlug, "faq-suffix", areaIndex);
  const areaAngle = AREA_ANGLE_LINES[areaIndex % AREA_ANGLE_LINES.length]!;

  const fill = (t: string) => fillLocalTemplate(t, vars);
  return {
    heroIntro: `${HERO_OPENERS[areaIndex % HERO_OPENERS.length]!} ${fill(hero.body)}`,
    localRelevance: {
      heading: fill(localRelevance.heading),
      body: fill(localRelevance.body),
      bullets: localRelevance.bullets?.map(fill),
    },
    whyChecks: {
      heading: fill(whyChecks.heading),
      body: fill(whyChecks.body),
      bullets: whyChecks.bullets?.map(fill),
    },
    process: {
      intro: fill(process.intro),
      steps: process.steps.map((s) => ({ title: fill(s.title), body: fill(s.body) })),
    },
    access: {
      heading: fill(access.heading),
      body: fill(access.body),
    },
    trust: {
      heading: fill(trust.heading),
      body: fill(trust.body),
    },
    cta: {
      primary: fill(cta.primary),
      secondary: fill(cta.secondary),
      phonePrompt: fill(cta.phonePrompt),
    },
    faqAnswerSuffix: fill(faqAnswerSuffix),
    areaAngleLine: fill(areaAngle),
    processIntroTail: PROCESS_INTRO_TAILS[areaIndex % PROCESS_INTRO_TAILS.length]!,
    trustBodyTail: TRUST_BODY_TAILS[areaIndex % TRUST_BODY_TAILS.length]!,
    whyChecksAreaLine: WHY_CHECKS_AREA_LINES[areaIndex % WHY_CHECKS_AREA_LINES.length]!,
  };
}

export function stripAreaPrefixCopy(text: string, areaName: string): string {
  const escaped = areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`^\\s*${escaped}\\s*[:—–-]\\s*`, "i"), "")
    .replace(new RegExp(`\\b${escaped}\\s*\\([^)]+\\)\\s*:`, "gi"), "")
    .trim();
}

export function detectAreaPrefixParagraphs(html: string, areaNames: string[]): string[] {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const paragraphs = main.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
  const hits: string[] = [];
  for (const p of paragraphs) {
    const text = p.replace(/<[^>]+>/g, "").trim();
    for (const area of areaNames) {
      if (new RegExp(`^${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i").test(text)) {
        hits.push(`${area}:${text.slice(0, 60)}`);
      }
    }
  }
  return hits;
}

export function extractLocalUniqueContentHtml(html: string): string {
  const patterns = [
    /data-template-block="hero"[\s\S]*?<\/section>/i,
    /data-template-block="local-relevance"[\s\S]*?<\/section>/i,
    /id="why-blood-pressure"[\s\S]*?<\/section>/i,
    /data-template-block="process"[\s\S]*?<\/section>/i,
    /data-template-block="local-area-access"[\s\S]*?<\/section>/i,
    /data-template-block="safety"[\s\S]*?<\/section>/i,
    /data-template-block="faq"[\s\S]*?<\/section>/i,
  ];
  return patterns.map((p) => html.match(p)?.[0] || "").join("\n");
}

export function normalizeCopyForSimilarity(text: string, areaNames: string[], pharmacyName: string): string {
  let out = text.toLowerCase();
  for (const area of areaNames) {
    out = out.replace(new RegExp(area.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "{area}");
  }
  out = out.replace(new RegExp(pharmacyName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "{pharmacy}");
  return out.replace(/\s+/g, " ").trim();
}

export function copySimilarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const wa = new Set(a.split(" ").filter((w) => w.length > 3));
  const wb = new Set(b.split(" ").filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.max(wa.size, wb.size);
}
