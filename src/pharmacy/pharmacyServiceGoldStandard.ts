/**
 * Pharmacy Service Page Gold Standard V1 —
 * Curated, publish-ready content for priority NHS/clinical services.
 * A pharmacy owner should be able to publish these pages without manual editing.
 */
import type { ServicePageSection, ServicePageFaq } from "./pharmacyServicePageGenerator.ts";

export const GOLD_STANDARD_SERVICE_IDS = new Set([
  "pharmacy-first",
  "blood-pressure-checks",
  "travel-vaccinations",
  "prescription-dispensing",
  "emergency-contraception",
]);

/** Publish section order — no blueprint expansion blocks on gold-standard pages. */
export const GOLD_STANDARD_SECTION_ORDER: Record<string, string[]> = {
  "pharmacy-first": [
    "problem",
    "conditionsCovered",
    "howItWorks",
    "eligibility",
    "preparationGuide",
    "mythVsFact",
    "trust",
  ],
  "blood-pressure-checks": [
    "problem",
    "howItWorks",
    "eligibility",
    "patientOutcomes",
    "preparationGuide",
    "mythVsFact",
    "trust",
  ],
  "travel-vaccinations": [
    "problem",
    "benefits",
    "howItWorks",
    "eligibility",
    "preparationGuide",
    "mythVsFact",
    "trust",
  ],
  "prescription-dispensing": [
    "howItWorks",
    "benefits",
    "eligibility",
    "preparationGuide",
    "trust",
  ],
  "emergency-contraception": [
    "problem",
    "howItWorks",
    "eligibility",
    "preparationGuide",
    "mythVsFact",
    "trust",
  ],
};

export interface GoldStandardContext {
  pharmacyName: string;
  town: string;
  serviceName: string;
  serviceId: string;
}

export interface GoldStandardSpec {
  intro: string;
  metaDescription: string;
  faqs: ServicePageFaq[];
  sections: Record<string, { heading: string; body: string; bullets: string[] }>;
}

function pf(ctx: GoldStandardContext): GoldStandardSpec {
  const p = ctx.pharmacyName;
  const t = ctx.town;
  return {
    intro: `${p} offers NHS Pharmacy First for selected minor illnesses in ${t}. A pharmacist assesses your symptoms, explains whether treatment is appropriate, and refers you to your GP or urgent care when needed.`,
    metaDescription: `Pharmacy First at ${p}, ${t} — pharmacist assessment for sore throat, earache, sinusitis, impetigo, shingles and uncomplicated UTI where commissioned.`,
    faqs: [
      {
        question: "Can a pharmacy treat a UTI without a GP?",
        answer: `Where the uncomplicated UTI pathway is commissioned locally, women aged 16–64 may receive assessment and supply at ${p} without a GP appointment first. The pharmacist checks symptoms, history and safety criteria before any treatment.`,
      },
      {
        question: "Do I need an appointment for Pharmacy First?",
        answer: `Booking ahead helps ${p} allow enough time for assessment. Same-day appointments may be available — call the pharmacy to check walk-in capacity and waiting times.`,
      },
      {
        question: "What should I bring to my Pharmacy First appointment?",
        answer: "Bring your current medicines list, allergy history, and details of when symptoms started. For children, confirm the child's age. If you are pregnant or breastfeeding, tell the pharmacist at the start of the consultation.",
      },
      {
        question: "Is Pharmacy First free on the NHS?",
        answer: `Pharmacy First is free where the service is NHS-commissioned and you meet pathway criteria. ${p} confirms eligibility before any supply — there is no charge for advice-only outcomes.`,
      },
      {
        question: "Can I use Pharmacy First for my child?",
        answer: `Paediatric pathways depend on the condition and age limits under local NHS rules. Contact ${p} before attending so the team can confirm whether Pharmacy First is suitable for your child.`,
      },
      {
        question: "When should I see a GP instead of using Pharmacy First?",
        answer: "See your GP or call NHS 111 for persistent, worsening or severe symptoms, pregnancy complications, chronic conditions, or any red-flag signs such as chest pain, breathing difficulty, or confusion. Emergencies need 999.",
      },
      {
        question: "Is Pharmacy First safe if I take other medicines?",
        answer: "Yes — bring your full medicines list. The pharmacist checks interactions and contraindications before recommending or supplying any treatment.",
      },
      {
        question: "What conditions can Pharmacy First treat?",
        answer: "Commissioned pathways typically include sore throat, earache, sinusitis, impetigo, infected insect bites, shingles and uncomplicated UTI in eligible women. Suitability is confirmed individually at consultation.",
      },
    ],
    sections: {
      problem: {
        heading: "What Is Pharmacy First?",
        body: `Pharmacy First is an NHS service that lets you see a pharmacist for selected common illnesses without booking a GP appointment first. At ${p}, consultations take place in a private room with a registered pharmacist who can assess, advise, supply treatment where eligible, or refer you onward.`,
        bullets: [
          "Same-day access for suitable minor illnesses when commissioned locally",
          "Free NHS care where you meet pathway eligibility criteria",
        ],
      },
      conditionsCovered: {
        heading: "Conditions We Can Help With",
        body: "The pharmacist assesses your symptoms against NHS pathway criteria. If your presentation falls outside pharmacy scope, you receive clear advice and referral to GP or urgent care.",
        bullets: [
          "Sore throat: assessment for streptococcal infection where testing is available, with supply or referral as appropriate",
          "Earache: review for otitis externa or media in eligible age groups, with GP referral when examination is needed",
          "Sinusitis: symptom duration and red-flag review with self-care advice, supply or GP signposting",
          "Impetigo: lesion assessment and topical treatment supply when clinically appropriate",
          "Shingles: rash and pain review with antiviral supply where NHS criteria are met",
          "Uncomplicated UTI (women 16–64): assessment and supply where the local pathway is commissioned",
        ],
      },
      howItWorks: {
        heading: "How Your Appointment Works",
        body: `Your appointment at ${p} follows a clear clinical pathway so you know what to expect before any treatment decision.`,
        bullets: [],
      },
      eligibility: {
        heading: "When To See Your GP Instead",
        body: "Pharmacy First is for suitable minor illnesses — not emergencies or complex ongoing conditions. Your pharmacist will tell you honestly if GP or urgent care is more appropriate.",
        bullets: [
          "Symptoms that are severe, worsening or have lasted longer than expected",
          "Red flags such as high fever with confusion, difficulty breathing, or non-blanching rash",
          "Children outside the age range for a specific pathway",
          "Pregnancy-related concerns unless the pathway explicitly allows treatment",
        ],
      },
      preparationGuide: {
        heading: "What To Bring",
        body: `A few minutes of preparation helps your pharmacist give accurate advice at ${p}.`,
        bullets: [
          "Current medicines and allergy history",
          "When symptoms started and how they have changed",
          "Child's age for paediatric presentations",
          "Pregnancy or breastfeeding status if relevant",
        ],
      },
      mythVsFact: {
        heading: "Pharmacy First — myths and facts",
        body: "Clear information helps you use the service safely.",
        bullets: [
          "Myth: Pharmacy First covers every illness. Fact: Only NHS-commissioned pathway conditions are included — the pharmacist confirms scope at assessment.",
          "Myth: You always receive antibiotics. Fact: Many sore throats and viral illnesses need self-care or referral, not antibiotics.",
          "Myth: Children qualify for every pathway. Fact: Age limits apply per condition — confirm with the pharmacy before attending.",
          "Myth: Emergency symptoms can wait. Fact: Chest pain, stroke signs and severe breathing difficulty need 999 or A&E, not a routine pharmacy appointment.",
        ],
      },
      trust: {
        heading: `Why Choose ${p}?`,
        body: `${p} delivers Pharmacy First under GPhC professional standards with confidential consultations and documented clinical governance.`,
        bullets: [
          "Registered pharmacists with NHS pathway training",
          "Private consultation room for confidential discussions",
          "Clear fees and eligibility explained before any private element",
        ],
      },
    },
  };
}

function bp(ctx: GoldStandardContext): GoldStandardSpec {
  const p = ctx.pharmacyName;
  const t = ctx.town;
  return {
    intro: `${p} offers NHS blood pressure checks in ${t}. A pharmacist measures your reading, explains what it means, and signposts you to your GP when follow-up is needed.`,
    metaDescription: `Blood pressure checks at ${p}, ${t} — NHS Hypertension Case-Finding where commissioned, with clear results and GP signposting when appropriate.`,
    faqs: [
      {
        question: "How long does a blood pressure check take?",
        answer: "Most checks take around 10–15 minutes, including a brief discussion of your reading and any recommended next steps.",
      },
      {
        question: "Is a blood pressure check free on the NHS?",
        answer: `The NHS Hypertension Case-Finding Service is free where commissioned locally. ${p} confirms eligibility when you book or attend.`,
      },
      {
        question: "What happens if my blood pressure is high?",
        answer: "One raised reading does not diagnose hypertension. The pharmacist explains whether repeat measurement, ambulatory monitoring, or GP review is appropriate.",
      },
      {
        question: "Do I need an appointment?",
        answer: `Booking is recommended at ${p} so staff can allow time for measurement and advice. Call to ask about walk-in availability.`,
      },
      {
        question: "Who should have regular blood pressure checks?",
        answer: "Adults over 40, people with risk factors such as diabetes or smoking, and anyone with a family history of hypertension or cardiovascular disease benefit from regular checks.",
      },
      {
        question: "Should I avoid caffeine before a check?",
        answer: "Avoid caffeine and vigorous exercise for 30 minutes before your reading. Rest quietly for five minutes before measurement for the most accurate result.",
      },
    ],
    sections: {
      problem: {
        heading: "Why Blood Pressure Matters",
        body: "High blood pressure often has no symptoms but increases the risk of stroke, heart disease and kidney problems. A pharmacy check offers convenient access without waiting for a routine GP appointment.",
        bullets: [
          "Many adults are unaware they have raised blood pressure",
          "Early detection supports timely lifestyle advice and GP follow-up",
        ],
      },
      howItWorks: {
        heading: "How The Check Works",
        body: `At ${p}, your check follows a structured NHS pathway.`,
        bullets: [],
      },
      eligibility: {
        heading: "Who Should Be Checked",
        body: "Blood pressure screening is particularly valuable for adults who have not been checked recently or who have cardiovascular risk factors.",
        bullets: [
          "Adults aged 40 and over without a recent check in the last five years",
          "People with diabetes, smoking history or family history of hypertension",
          "Anyone advised by their GP to monitor blood pressure between appointments",
        ],
      },
      patientOutcomes: {
        heading: "Understanding Your Results",
        body: "Your pharmacist explains your reading in plain language and documents recommended next steps.",
        bullets: [
          "Normal range: generally below 140/90 mmHg for most adults — individual targets may differ",
          "Raised reading: may need repeat measurement or GP review — not an immediate diagnosis",
          "Very high reading: urgent GP or same-day medical review may be advised",
        ],
      },
      preparationGuide: {
        heading: "Before Your Check",
        body: "Simple preparation improves accuracy.",
        bullets: [
          "Rest for five minutes before measurement",
          "Avoid caffeine and exercise for 30 minutes beforehand",
          "Wear loose sleeves that roll up easily",
        ],
      },
      mythVsFact: {
        heading: "Blood pressure — myths and facts",
        body: "",
        bullets: [
          "Myth: One high reading means hypertension. Fact: Diagnosis requires repeated measurements — a single check is a screening step.",
          "Myth: Pharmacy checks replace GP care. Fact: Pharmacy screening complements your GP — ongoing hypertension management stays with your doctor.",
          "Myth: Home monitors are always accurate. Fact: Pharmacy checks use validated equipment with trained staff — bring home readings to discuss.",
        ],
      },
      trust: {
        heading: `Why Choose ${p}?`,
        body: `${p} provides blood pressure checks with trained staff and confidential consultation facilities in ${t}.`,
        bullets: [
          "NHS Hypertension Case-Finding where locally commissioned",
          "Clear GP signposting when readings need medical review",
        ],
      },
    },
  };
}

function tv(ctx: GoldStandardContext): GoldStandardSpec {
  const p = ctx.pharmacyName;
  return {
    intro: `${p} provides travel health consultations including destination-specific vaccination advice. Book early — some courses need several weeks before departure.`,
    metaDescription: `Travel vaccinations at ${p} — risk assessment, vaccine scheduling and travel health advice tailored to your itinerary.`,
    faqs: [
      {
        question: "How far in advance should I book travel vaccinations?",
        answer: "Book 6–8 weeks before travel when possible. Multi-dose vaccines such as rabies or hepatitis B need time to complete the course before departure.",
      },
      {
        question: "Which vaccines do I need for my destination?",
        answer: "Requirements depend on your destination, activities, medical history and previous vaccinations. The pharmacist reviews your itinerary during consultation — do not rely on online lists alone.",
      },
      {
        question: "Are travel vaccines free on the NHS?",
        answer: "Some vaccines are NHS-funded for certain risk groups. Many destination-specific vaccines are private — fees are explained before any supply.",
      },
      {
        question: "What should I bring to my travel appointment?",
        answer: "Bring your travel itinerary with dates, previous vaccination records, a medicines list, and details of any health conditions or pregnancy.",
      },
      {
        question: "Can I get vaccinations last minute before travel?",
        answer: "Last-minute appointments may still help, but some vaccines cannot be completed in time. Contact the pharmacy as early as possible.",
      },
      {
        question: "Do you provide malaria prevention advice?",
        answer: "Yes — where the service is offered, the pharmacist discusses malaria risk for your destination and appropriate prevention options.",
      },
    ],
    sections: {
      problem: {
        heading: "Planning Travel Health",
        body: "Travel exposes you to infections that may not exist in the UK. A structured travel health consultation identifies recommended vaccines and health precautions for your specific trip.",
        bullets: [
          "Destination and activity-specific risks vary widely",
          "Some vaccine courses need multiple weeks to complete",
        ],
      },
      benefits: {
        heading: "What We Cover",
        body: "Consultations are tailored to your itinerary and medical history.",
        bullets: [
          "Hepatitis A and typhoid for many destinations",
          "Rabies, Japanese encephalitis and yellow fever where clinically indicated",
          "Malaria prevention advice for at-risk regions",
          "Travel health leaflets and vaccination records for your trip",
        ],
      },
      howItWorks: {
        heading: "Your Travel Consultation",
        body: `At ${p}, travel health follows a structured assessment and scheduling process.`,
        bullets: [],
      },
      eligibility: {
        heading: "Who Should Book",
        body: "Anyone travelling abroad benefits from a risk assessment — especially for long-stay, rural, or adventure travel.",
        bullets: [
          "Holidaymakers visiting countries with vaccine-preventable disease risk",
          "Backpackers and volunteers on extended trips",
          "People visiting friends and relatives in high-risk regions",
          "Occupational travellers with specific exposure risks",
        ],
      },
      preparationGuide: {
        heading: "Before Your Appointment",
        body: "Bring detailed trip information for accurate advice.",
        bullets: [
          "Full itinerary with dates and regions visited",
          "Previous vaccination records",
          "Current medicines and allergy history",
        ],
      },
      mythVsFact: {
        heading: "Travel health — myths and facts",
        body: "",
        bullets: [
          "Myth: UK childhood vaccines cover all travel needs. Fact: Destination-specific vaccines are often required in addition to routine immunisations.",
          "Myth: Last-minute travel means no vaccines are possible. Fact: Some protection can still be given — but earlier booking is always safer.",
          "Myth: Online advice replaces a consultation. Fact: Personalised assessment considers your health, itinerary and timing.",
        ],
      },
      trust: {
        heading: `Why Choose ${p}?`,
        body: `${p} provides pharmacist-led travel health advice with vaccination scheduling support.`,
        bullets: [
          "Destination-specific risk assessment",
          "Written vaccination records for your travel documents",
        ],
      },
    },
  };
}

function pd(ctx: GoldStandardContext): GoldStandardSpec {
  const p = ctx.pharmacyName;
  const t = ctx.town;
  return {
    intro: `${p} dispenses NHS prescriptions accurately and on time for patients in ${t}. Our team checks your medicines, answers questions, and supports safe ongoing treatment.`,
    metaDescription: `NHS prescription dispensing at ${p}, ${t} — accurate supply, medicines counselling and repeat prescription support.`,
    faqs: [
      {
        question: "How long does prescription dispensing take?",
        answer: "Ready-to-collect times depend on prescription type and stock. The team advises expected collection time when your prescription arrives.",
      },
      {
        question: "Can I nominate this pharmacy for EPS?",
        answer: `Yes — Electronic Prescription Service nomination sends NHS prescriptions electronically to ${p}. Ask the team to set up or change nomination.`,
      },
      {
        question: "What if my medicine is out of stock?",
        answer: "The pharmacy orders stock promptly or arranges a suitable alternative in discussion with your prescriber where appropriate.",
      },
      {
        question: "Do you offer medicines counselling?",
        answer: "Pharmacists explain how to take new medicines safely, including timing, food interactions and common side effects to watch for.",
      },
      {
        question: "Can someone else collect my prescription?",
        answer: "Yes — they may need to confirm your details. Controlled medicines and certain items may have additional requirements.",
      },
    ],
    sections: {
      howItWorks: {
        heading: "Our Dispensing Process",
        body: `Every prescription at ${p} is checked by a pharmacist for accuracy, interactions and suitability before supply.`,
        bullets: [],
      },
      benefits: {
        heading: "What You Can Expect",
        body: "Professional dispensing with patient safety at the centre.",
        bullets: [
          "Clinical accuracy checks on every prescription",
          "Confidential medicines counselling for new or changed treatments",
          "Repeat prescription ordering support to avoid gaps in treatment",
          "Clear labelling and written information where helpful",
        ],
      },
      eligibility: {
        heading: "Who Can Use Our Dispensing Service",
        body: "Any patient with a valid NHS or private prescription can use the pharmacy dispensing service.",
        bullets: [
          "NHS prescriptions via paper, EPS, or electronic repeat dispensing",
          "Private prescriptions from UK prescribers",
          "Hospital discharge prescriptions where accepted locally",
        ],
      },
      preparationGuide: {
        heading: "When You Collect",
        body: "Help us dispense safely and quickly.",
        bullets: [
          "Bring your prescription token or EPS nomination confirmation",
          "Tell us about allergies and other medicines you take",
          "Ask about any new medicine — counselling is included",
        ],
      },
      trust: {
        heading: `Why Choose ${p}?`,
        body: `${p} is a GPhC-registered pharmacy providing reliable dispensing for ${t} patients.`,
        bullets: [
          "Qualified pharmacists on every supply",
          "Repeat prescription management to support continuity of care",
        ],
      },
    },
  };
}

function ec(ctx: GoldStandardContext): GoldStandardSpec {
  const p = ctx.pharmacyName;
  const t = ctx.town;
  return {
    intro: `${p} provides confidential emergency contraception consultations in ${t}. A pharmacist assesses your situation, explains options including the emergency contraceptive pill where suitable, and advises on timing and follow-up.`,
    metaDescription: `Emergency contraception at ${p}, ${t} — confidential pharmacist consultation with supply where clinically appropriate.`,
    faqs: [
      {
        question: "How quickly do I need emergency contraception?",
        answer: "Act as soon as possible. Levonorgestrel pills are most effective within 72 hours; ulipristal acetate may be used up to 120 hours depending on clinical assessment. Effectiveness decreases with delay.",
      },
      {
        question: "Is emergency contraception available without a GP appointment?",
        answer: `Yes — ${p} offers pharmacist-led emergency contraception where commissioned or as a private service. Call immediately if you need same-day access.`,
      },
      {
        question: "Which emergency contraceptive pill is right for me?",
        answer: "The pharmacist assesses timing since unprotected sex, your weight, other medicines, and whether you have used emergency contraception recently. The most suitable option is explained before supply.",
      },
      {
        question: "Is the consultation confidential?",
        answer: "Yes — consultations take place in a private room. Records are held under pharmacy confidentiality standards.",
      },
      {
        question: "Does emergency contraception affect fertility long term?",
        answer: "Emergency contraception does not affect long-term fertility. The pharmacist explains how each option works and when to consider ongoing contraception.",
      },
      {
        question: "What if I am already on regular contraception?",
        answer: "Tell the pharmacist about your usual contraception and any missed pills or interactions. They advise whether additional emergency contraception is needed.",
      },
    ],
    sections: {
      problem: {
        heading: "When You Need Emergency Contraception",
        body: "Emergency contraception can prevent pregnancy after unprotected sex or contraceptive failure. Time is critical — the pharmacist prioritises urgent access and clear advice on the most effective option for your situation.",
        bullets: [
          "Consultations are confidential and non-judgemental",
          "Same-day access is prioritised where possible",
        ],
      },
      howItWorks: {
        heading: "How The Consultation Works",
        body: `At ${p}, the pharmacist reviews timing, medical history and suitability before any supply.`,
        bullets: [],
      },
      eligibility: {
        heading: "Who Can Access This Service",
        body: "Emergency contraception is available to women who need it after unprotected intercourse or method failure, subject to clinical assessment.",
        bullets: [
          "Timing since unprotected sex determines which options remain effective",
          "Certain medicines and medical conditions affect which pill can be supplied",
          "Ongoing contraception signposting is offered after emergency supply",
        ],
      },
      preparationGuide: {
        heading: "What To Expect",
        body: "The consultation focuses on safety and timing.",
        bullets: [
          "When unprotected sex or contraceptive failure occurred",
          "Your last menstrual period and any pregnancy symptoms",
          "Current medicines including herbal products",
          "Previous use of emergency contraception in the current cycle",
        ],
      },
      mythVsFact: {
        heading: "Emergency contraception — myths and facts",
        body: "",
        bullets: [
          "Myth: Emergency contraception works at any time. Fact: Effectiveness decreases with delay — attend as soon as possible.",
          "Myth: It is the same as an abortion pill. Fact: Emergency contraception prevents pregnancy; it does not terminate an established pregnancy.",
          "Myth: You cannot use it more than once. Fact: It can be used more than once when needed, but is not a regular contraceptive method.",
        ],
      },
      trust: {
        heading: `Why Choose ${p}?`,
        body: `${p} provides discreet, pharmacist-led emergency contraception with clear follow-up advice in ${t}.`,
        bullets: [
          "Private consultation room",
          "Clear explanation of options, timing and next steps",
        ],
      },
    },
  };
}

const GOLD_SPECS: Record<string, (ctx: GoldStandardContext) => GoldStandardSpec> = {
  "pharmacy-first": pf,
  "blood-pressure-checks": bp,
  "travel-vaccinations": tv,
  "prescription-dispensing": pd,
  "emergency-contraception": ec,
};

export function isGoldStandardService(serviceId: string): boolean {
  return GOLD_STANDARD_SERVICE_IDS.has(serviceId);
}

export function getGoldStandardSpec(ctx: GoldStandardContext): GoldStandardSpec | null {
  const builder = GOLD_SPECS[ctx.serviceId];
  return builder ? builder(ctx) : null;
}

function cardBullet(heading: string, body: string): string {
  return body ? `${heading}: ${body}` : heading;
}

export function buildGoldStandardSections(
  ctx: GoldStandardContext,
  existing: ServicePageSection[],
): ServicePageSection[] {
  const spec = getGoldStandardSpec(ctx);
  const order = GOLD_STANDARD_SECTION_ORDER[ctx.serviceId];
  if (!spec || !order) return existing;

  const hero = existing.find((s) => s.type === "hero");
  const cta = existing.find((s) => s.type === "cta");
  const curated: ServicePageSection[] = [];

  if (hero) curated.push(hero);

  for (const type of order) {
    const src = spec.sections[type];
    if (!src) continue;
    curated.push({
      type,
      heading: src.heading,
      body: src.body,
      bullets: src.bullets.map((b) => {
        if (b.includes("Myth:") && b.includes("Fact:")) return b;
        const colon = b.indexOf(":");
        if (colon > 0 && colon < 48) return b;
        return b;
      }),
    });
  }

  if (cta) curated.push(cta);
  return curated;
}

export function applyGoldStandardToServicePage(input: {
  serviceId: string;
  serviceName: string;
  pharmacyName: string;
  town: string;
  intro: string;
  metaDescription: string;
  faqs: ServicePageFaq[];
  sections: ServicePageSection[];
}): {
  intro: string;
  metaDescription: string;
  faqs: ServicePageFaq[];
  sections: ServicePageSection[];
} {
  if (!isGoldStandardService(input.serviceId)) {
    return input;
  }

  const ctx: GoldStandardContext = {
    serviceId: input.serviceId,
    serviceName: input.serviceName,
    pharmacyName: input.pharmacyName,
    town: input.town,
  };
  const spec = getGoldStandardSpec(ctx);
  if (!spec) return input;

  return {
    intro: spec.intro,
    metaDescription: spec.metaDescription,
    faqs: spec.faqs,
    sections: buildGoldStandardSections(ctx, input.sections),
  };
}

/** Documented benchmark for platform content quality. */
export const GOLD_STANDARD_NARRATIVE_SPEC = {
  sectionOrderPrinciple: "Explain → treat → process → safety → prepare → clarify myths → trust → book → FAQs",
  maxCoreSections: 8,
  faqCount: "6–10, each answering one patient question directly",
  cardStandard: "Heading names the topic; body adds clinical detail the heading does not repeat",
  narrativeStandard: "Define the service once in hero + What Is; never repeat the same pathway list in later sections",
  removedFromPublish: [
    "deepDive",
    "serviceOverview",
    "benefits (patient-intent grids)",
    "aftercare",
    "risksAndLimitations",
    "nhsPrivateComparison",
    "patientObjections",
    "safetyConsiderations (duplicate)",
    "authorityInsights",
    "trustSafety",
    "patientEducation (heading-only)",
    "conversionReassurance",
    "relatedTopics",
    "comparison (weak tables)",
  ],
} as const;
