/**
 * Service variant content definitions V1 — Part 3 (expansion services).
 * Clinically safe, service-specific, area-agnostic.
 */
import type { ServiceVariantPack } from "./pharmacyServiceVariantLibrary.ts";

type SV = Omit<ServiceVariantPack, "version" | "generatedAt">;

function faqs(items: Array<{ question: string; answer: string }>) {
  return items;
}

function ctaSet(primary: string[], secondary: string[]) {
  return primary.map((p, i) => ({
    primary: p,
    secondary: secondary[i % secondary.length],
    phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
    bookingPrompt: "Book online or by phone once suitability is confirmed at assessment.",
  }));
}

function sec(heading: string, body: string, bullets: string[]) {
  return { heading, body, bullets };
}

export const SERVICE_VARIANT_DEFINITIONS_PART3: Record<string, SV> = {
  "pharmacy-first": {
    serviceId: "pharmacy-first",
    serviceName: "Pharmacy First",
    intro: [
      {
        body: "Pharmacy First offers NHS minor illness consultations for common conditions — with assessment, treatment where eligible, and clear referral when needed."
      },
      {
        body: "Same-day pharmacy access can help when GP appointments are unavailable and symptoms fall within commissioned Pharmacy First pathways."
      },
      {
        body: "A pharmacist assesses suitability, explains options in plain language, and supplies treatment or signposts to GP or urgent care when appropriate."
      },
      {
        body: "Pharmacy First complements GP care — it does not replace medical review for complex, severe or persistent symptoms."
      },
      {
        body: "Community pharmacy access puts professional minor illness care on your high street with confidential consultation space."
      }
    ],
    problem: [
      {
        heading: "Why Pharmacy First Matters",
        body: "Minor illnesses cause discomfort and time off work, yet GP capacity is limited. Pharmacy First provides structured NHS assessment for suitable conditions.",
        bullets: [
          "Sore throat and earache",
          "UTI symptoms in eligible patients",
          "Sinusitis and impetigo",
          "When GP is still needed"
        ]
      },
      {
        heading: "Accessing Minor Illness Care",
        body: "Patients often delay treatment unsure whether symptoms need GP review. Pharmacy First clarifies scope and next steps.",
        bullets: [
          "Same-day assessment",
          "NHS eligibility rules",
          "Private alternatives",
          "Emergency red flags"
        ]
      },
      {
        heading: "Understanding The Service",
        body: "Commissioned pathways cover defined conditions with clinical governance — not every symptom qualifies.",
        bullets: [
          "Seven common pathways",
          "Age and eligibility limits",
          "Supply where appropriate",
          "Safety-netting"
        ]
      },
      {
        heading: "When Pharmacy Care Helps",
        body: "Working adults, parents and older patients benefit from convenient assessment without always needing a GP slot.",
        bullets: [
          "Convenient access",
          "Reduced A&E misuse",
          "Appropriate referrals",
          "Treatment supply"
        ]
      },
      {
        heading: "Scope And Limits",
        body: "Pharmacy First treats defined minor conditions — severe, persistent or complex symptoms need GP or urgent care.",
        bullets: [
          "Pathway eligibility",
          "Referral criteria",
          "Follow-up advice",
          "Not for emergencies"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy First",
        body: "Structured NHS assessment with treatment supply where eligible and professional safety-netting.",
        bullets: [
          "Same-day access",
          "Free where NHS eligible",
          "Pharmacist assessment",
          "Clear referral guidance"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Confidential consultation, condition assessment, and plain-language advice on treatment or next steps.",
        bullets: [
          "Private room discussion",
          "Treatment options explained",
          "Supply if eligible",
          "Documentation offered"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "High street access without lengthy GP waits for suitable minor illness presentations.",
        bullets: [
          "Walk-in where offered",
          "Appointment booking",
          "Family-friendly access",
          "Complements GP care"
        ]
      },
      {
        heading: "Patient-Focused Care",
        body: "Focus on appropriate treatment, self-care education and when to seek further medical review.",
        bullets: [
          "Self-care guidance",
          "Safety-netting",
          "GP liaison when needed",
          "Evidence-based pathways"
        ]
      },
      {
        heading: "Accessible NHS Support",
        body: "Local pharmacy teams deliver commissioned care with regulated clinical governance.",
        bullets: [
          "Regulated premises",
          "Pathway training",
          "NHS governance",
          "Local community access"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use Pharmacy First",
        body: "Eligibility depends on condition, age and NHS commissioning. Individual assessment confirms suitability at consultation.",
        bullets: [
          "Condition-specific criteria",
          "Age limits apply",
          "NHS vs private scope",
          "Symptom severity assessment"
        ]
      },
      {
        heading: "Suitability Overview",
        body: "Suitable for defined minor illness presentations within pathway scope — not for emergencies or complex cases.",
        bullets: [
          "Pathway conditions only",
          "Persistent symptoms need GP",
          "Pregnancy exceptions",
          "Immunocompromised signposting"
        ]
      },
      {
        heading: "Before You Attend",
        body: "Bring ID if required, list current medicines, and describe symptom onset and severity accurately.",
        bullets: [
          "Medicines list",
          "Symptom timeline",
          "Previous treatment tried",
          "Allergy information"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise whether Pharmacy First, GP or urgent care is appropriate.",
        bullets: [
          "Phone triage available",
          "Red flag screening",
          "Scope explained upfront",
          "Alternative pathways"
        ]
      },
      {
        heading: "NHS Eligibility",
        body: "Free NHS care applies where commissioned and criteria met — confirm locally at booking.",
        bullets: [
          "Commissioning varies",
          "Private options exist",
          "Eligibility checked at visit",
          "No guarantee of supply"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How Pharmacy First Works",
        body: "Book or walk in, receive assessment, get treatment or referral with safety-netting advice.",
        bullets: [
          "Triage and booking",
          "Confidential assessment",
          "Treatment or supply",
          "Referral if needed",
          "Follow-up guidance"
        ]
      },
      {
        heading: "Your Consultation Steps",
        body: "Pharmacist reviews symptoms, checks eligibility, explains options and documents advice.",
        bullets: [
          "History taking",
          "Clinical assessment",
          "Treatment plan",
          "Safety-netting"
        ]
      },
      {
        heading: "The Assessment Process",
        body: "Structured pathway assessment determines whether pharmacy treatment is safe and appropriate.",
        bullets: [
          "Pathway criteria",
          "Examination if needed",
          "Patient consent",
          "Record keeping"
        ]
      },
      {
        heading: "From Arrival To Outcome",
        body: "Allow time for full assessment — rushed consultations are avoided to maintain safety.",
        bullets: [
          "15–20 minutes typical",
          "Questions encouraged",
          "Written advice offered",
          "GP contact if required"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow safety-netting advice and return if symptoms worsen or persist beyond expected timeframe.",
        bullets: [
          "Self-care steps",
          "When to return",
          "GP follow-up triggers",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Pharmacy First",
        body: "Note symptom start date, severity and any medicines already tried.",
        bullets: [
          "Symptom diary",
          "Current medicines",
          "Allergy list",
          "NHS number if known"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if requested, medicines list and details of previous similar episodes.",
        bullets: [
          "ID for NHS services",
          "OTC medicines used",
          "GP contact details",
          "Child health record if relevant"
        ]
      },
      {
        heading: "Before Your Appointment",
        body: "Avoid assuming antibiotics are needed — the pharmacist assesses whether they are appropriate.",
        bullets: [
          "Open discussion",
          "Honest symptom description",
          "Pregnancy declaration",
          "Immunosuppression disclosure"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear accessible clothing if examination may be needed and allow adequate time.",
        bullets: [
          "Allow 20 minutes",
          "One parent for minors",
          "Mask if respiratory symptoms",
          "Ask questions"
        ]
      },
      {
        heading: "Getting The Most From Your Visit",
        body: "Write down questions beforehand and follow self-care advice between reviews.",
        bullets: [
          "Question list",
          "Follow safety-netting",
          "Complete any treatment course",
          "Report side effects"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Pharmacy First follows NHS pathway governance — referral when symptoms fall outside scope or worsen.",
        bullets: [
          "Pathway limits apply",
          "No antibiotics if inappropriate",
          "Emergency signposting",
          "Individual assessment"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe pain, breathing difficulty, confusion, rash with fever, or rapidly worsening symptoms need urgent medical care.",
        bullets: [
          "Red flag symptoms",
          "Infants under pathway age",
          "Pregnancy complications",
          "Immunocompromised patients"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate symptom reporting, completing prescribed courses, and returning if not improving.",
        bullets: [
          "Honest history",
          "Follow-up adherence",
          "Avoid sharing medicines",
          "Ask when unsure"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "Regulated pharmacy teams deliver commissioned NHS pathways with documented assessment and referral criteria.",
        bullets: [
          "GPhC-regulated team",
          "NHS governance",
          "Confidential care",
          "Audit-ready records"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Pharmacy First",
        body: "An NHS service for defined minor conditions — not a replacement for GP management of ongoing or complex illness.",
        bullets: [
          "Defined pathways",
          "Free if eligible",
          "Self-care role",
          "GP for chronic care"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Rest, fluids and appropriate OTC support may complement supplied treatment — follow pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Complete treatment courses",
          "Isolation if infectious",
          "Monitor symptoms"
        ]
      },
      {
        heading: "Antibiotic Awareness",
        body: "Antibiotics are supplied only when clinically appropriate — unnecessary use contributes to resistance.",
        bullets: [
          "Not always needed",
          "Complete the course",
          "Side effect reporting",
          "Return if no improvement"
        ]
      },
      {
        heading: "After Treatment",
        body: "Know when improvement is expected and when to seek GP review if symptoms persist.",
        bullets: [
          "Expected recovery time",
          "Return criteria",
          "GP follow-up",
          "Emergency triggers"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based pharmacy advice:",
        bullets: [
          "Myth: Pharmacy First covers every illness. Fact: Only commissioned pathway conditions.",
          "Myth: You always get antibiotics. Fact: Supply follows clinical need.",
          "Myth: It replaces your GP. Fact: It complements GP care for minor illness."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate information supports safe use:",
        bullets: [
          "Myth: Walk-in guarantees treatment. Fact: Eligibility assessed individually.",
          "Myth: Free for all conditions. Fact: NHS eligibility applies to commissioned pathways.",
          "Myth: No documentation provided. Fact: Advice and supply are recorded."
        ]
      },
      {
        heading: "Pharmacy First Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Children are never seen. Fact: Age limits vary by pathway.",
          "Myth: Online diagnosis is enough. Fact: Assessment requires consultation.",
          "Myth: Persistent symptoms are fine. Fact: Ongoing symptoms need GP review."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use Pharmacy First appropriately:",
        bullets: [
          "Myth: Same day means instant antibiotics. Fact: Assessment determines treatment.",
          "Myth: Multiple pharmacies for one episode. Fact: Continuity aids safe care.",
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "What conditions does Pharmacy First cover?",
        answer: "Commissioned pathways typically include conditions such as sore throat, earache, sinusitis, impetigo and UTI symptoms in eligible patients — confirm locally."
      },
      {
        question: "Is Pharmacy First free on the NHS?",
        answer: "NHS care is free where the service is commissioned and you meet eligibility criteria — confirm at booking."
      },
      {
        question: "Do I need an appointment?",
        answer: "Booking is recommended; walk-in availability varies. Appointments allow adequate assessment time."
      },
      {
        question: "Can a pharmacy treat a UTI without a GP?",
        answer: "Where the NHS Pharmacy First UTI pathway is commissioned and you meet criteria, pharmacist assessment and supply may be available."
      },
      {
        question: "What if the pharmacist cannot help?",
        answer: "You receive clear signposting to GP, NHS 111 or urgent care when symptoms fall outside scope or need further review."
      },
      {
        question: "How long does a Pharmacy First consultation take?",
        answer: "Typically 15–20 minutes including assessment, advice and supply where appropriate."
      },
      {
        question: "Can I use Pharmacy First for my child?",
        answer: "Age limits apply per pathway — the pharmacy team confirms whether paediatric assessment is available."
      },
      {
        question: "Will I always receive antibiotics?",
        answer: "No — antibiotics are supplied only when clinically appropriate for the assessed condition."
      },
      {
        question: "What should I bring to my appointment?",
        answer: "Bring a medicines list, allergy information and details of symptoms including when they started."
      },
      {
        question: "Is the consultation confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room."
      },
      {
        question: "What symptoms need urgent care instead?",
        answer: "Severe breathing difficulty, chest pain, confusion, severe dehydration or rapidly worsening illness need urgent medical attention."
      },
      {
        question: "Can I use Pharmacy First if I am pregnant?",
        answer: "Some pathways have pregnancy exclusions — declare pregnancy at assessment for safe signposting."
      },
      {
        question: "Does Pharmacy First replace my GP?",
        answer: "No — it complements GP care for suitable minor illness. Ongoing and complex conditions remain with your GP."
      },
      {
        question: "How do I know if my pharmacy offers Pharmacy First?",
        answer: "Contact the pharmacy team — commissioning and pathway availability vary by location."
      },
      {
        question: "What happens after treatment?",
        answer: "Follow safety-netting advice and return or see your GP if symptoms persist or worsen."
      }
    ]
  },
  "flu-vaccinations": {
    serviceId: "flu-vaccinations",
    serviceName: "Flu Vaccinations",
    intro: [
      {
        body: "Flu Vaccinations at a community pharmacy offers professional seasonal NHS flu vaccination with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led flu vaccinations for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Flu Vaccinations complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver flu vaccinations with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Flu Vaccinations addresses practical barriers to seasonal NHS flu vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "eligibility groups",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Flu Vaccinations addresses practical barriers to seasonal NHS flu vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "appointment booking",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Flu Vaccinations addresses practical barriers to seasonal NHS flu vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "egg allergy assessment",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Flu Vaccinations addresses practical barriers to seasonal NHS flu vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "booster timing",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional seasonal NHS flu vaccination with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for flu vaccinations is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Over-65s",
          "Clinical risk groups",
          "Carers and household contacts",
          "Pregnant women where eligible",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for flu vaccinations, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Flu Vaccinations follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Flu Vaccinations",
        body: "Educational guidance covers what flu vaccinations involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for flu vaccinations. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for flu vaccinations?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Flu Vaccinations available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Flu Vaccinations appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Flu Vaccinations appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Flu Vaccinations?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Flu Vaccinations?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Flu Vaccinations?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Flu Vaccinations?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Flu Vaccinations consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Flu Vaccinations?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Flu Vaccinations for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Flu Vaccinations confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Flu Vaccinations?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Flu Vaccinations require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Flu Vaccinations at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "covid-vaccinations": {
    serviceId: "covid-vaccinations",
    serviceName: "COVID Vaccinations",
    intro: [
      {
        body: "COVID Vaccinations at a community pharmacy offers professional seasonal NHS COVID-19 vaccination with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led covid vaccinations for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "COVID Vaccinations complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver covid vaccinations with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "COVID Vaccinations addresses practical barriers to seasonal NHS COVID-19 vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "campaign eligibility",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "COVID Vaccinations addresses practical barriers to seasonal NHS COVID-19 vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "booster intervals",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "COVID Vaccinations addresses practical barriers to seasonal NHS COVID-19 vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "vaccine types",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "COVID Vaccinations addresses practical barriers to seasonal NHS COVID-19 vaccination. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "side effect advice",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional seasonal NHS COVID-19 vaccination with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for covid vaccinations is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Eligible NHS patients",
          "Clinically vulnerable groups",
          "Seasonal campaign groups",
          "Patients unsure about boosters",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for covid vaccinations, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "COVID Vaccinations follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding COVID Vaccinations",
        body: "Educational guidance covers what covid vaccinations involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for covid vaccinations. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for covid vaccinations?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is COVID Vaccinations available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a COVID Vaccinations appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my COVID Vaccinations appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for COVID Vaccinations?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking COVID Vaccinations?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for COVID Vaccinations?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for COVID Vaccinations?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a COVID Vaccinations consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using COVID Vaccinations?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use COVID Vaccinations for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is COVID Vaccinations confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after COVID Vaccinations?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does COVID Vaccinations require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book COVID Vaccinations at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "weight-management": {
    serviceId: "weight-management",
    serviceName: "Weight Management",
    intro: [
      {
        body: "Weight Management at a community pharmacy offers professional private weight management consultation with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led weight management for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Weight Management complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver weight management with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Weight Management addresses practical barriers to private weight management consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "BMI assessment",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Weight Management addresses practical barriers to private weight management consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "lifestyle planning",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Weight Management addresses practical barriers to private weight management consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "medicines where offered",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Weight Management addresses practical barriers to private weight management consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "GP coordination",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional private weight management consultation with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for weight management is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Adults with raised BMI",
          "Patients seeking structured support",
          "Those who tried self-guided diets",
          "People needing medical suitability checks",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for weight management, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Weight Management follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Weight Management",
        body: "Educational guidance covers what weight management involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for weight management. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for weight management?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Weight Management available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Weight Management appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Weight Management appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Weight Management?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Weight Management?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Weight Management?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Weight Management?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Weight Management consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Weight Management?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Weight Management for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Weight Management confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Weight Management?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Weight Management require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Weight Management at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "smoking-cessation": {
    serviceId: "smoking-cessation",
    serviceName: "Smoking Cessation",
    intro: [
      {
        body: "Smoking Cessation at a community pharmacy offers professional NHS stop smoking support with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led smoking cessation for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Smoking Cessation complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver smoking cessation with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Smoking Cessation addresses practical barriers to NHS stop smoking support. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "NRT supply",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Smoking Cessation addresses practical barriers to NHS stop smoking support. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "behavioural support",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Smoking Cessation addresses practical barriers to NHS stop smoking support. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "quit planning",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Smoking Cessation addresses practical barriers to NHS stop smoking support. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "follow-up reviews",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional NHS stop smoking support with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for smoking cessation is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Daily smokers ready to quit",
          "Patients referred by GP",
          "Repeat quit attempts",
          "Pregnant smokers seeking support",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for smoking cessation, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Smoking Cessation follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Smoking Cessation",
        body: "Educational guidance covers what smoking cessation involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for smoking cessation. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for smoking cessation?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Smoking Cessation available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Smoking Cessation appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Smoking Cessation appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Smoking Cessation?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Smoking Cessation?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Smoking Cessation?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Smoking Cessation?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Smoking Cessation consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Smoking Cessation?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Smoking Cessation for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Smoking Cessation confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Smoking Cessation?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Smoking Cessation require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Smoking Cessation at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "emergency-contraception": {
    serviceId: "emergency-contraception",
    serviceName: "Emergency Contraception",
    intro: [
      {
        body: "Emergency Contraception at a community pharmacy offers professional time-sensitive emergency contraception consultation with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led emergency contraception for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Emergency Contraception complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver emergency contraception with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Emergency Contraception addresses practical barriers to time-sensitive emergency contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "effectiveness windows",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Emergency Contraception addresses practical barriers to time-sensitive emergency contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "confidential supply",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Emergency Contraception addresses practical barriers to time-sensitive emergency contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "option comparison",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Emergency Contraception addresses practical barriers to time-sensitive emergency contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "ongoing contraception signposting",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional time-sensitive emergency contraception consultation with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for emergency contraception is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "After unprotected sex",
          "Contraceptive failure",
          "Patients needing same-day advice",
          "Those unable to access GP quickly",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for emergency contraception, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Emergency Contraception follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Emergency Contraception",
        body: "Educational guidance covers what emergency contraception involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for emergency contraception. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for emergency contraception?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Emergency Contraception available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Emergency Contraception appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Emergency Contraception appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Emergency Contraception?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Emergency Contraception?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Emergency Contraception?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Emergency Contraception?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Emergency Contraception consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Emergency Contraception?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Emergency Contraception for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Emergency Contraception confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Emergency Contraception?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Emergency Contraception require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Emergency Contraception at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "pharmacy-contraception-service": {
    serviceId: "pharmacy-contraception-service",
    serviceName: "Pharmacy Contraception Service",
    intro: [
      {
        body: "Pharmacy Contraception Service at a community pharmacy offers professional NHS pharmacy contraception consultation with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led pharmacy contraception service for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Pharmacy Contraception Service complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver pharmacy contraception service with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Pharmacy Contraception Service addresses practical barriers to NHS pharmacy contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "initiation and switching",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Pharmacy Contraception Service addresses practical barriers to NHS pharmacy contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "blood pressure checks",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Pharmacy Contraception Service addresses practical barriers to NHS pharmacy contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "supply where commissioned",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Pharmacy Contraception Service addresses practical barriers to NHS pharmacy contraception consultation. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "GP liaison",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional NHS pharmacy contraception consultation with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for pharmacy contraception service is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Women seeking NHS contraception",
          "Switching methods",
          "Missed pill advice signposting",
          "New starters without GP wait",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for pharmacy contraception service, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Pharmacy Contraception Service follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Pharmacy Contraception Service",
        body: "Educational guidance covers what pharmacy contraception service involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for pharmacy contraception service. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for pharmacy contraception service?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Pharmacy Contraception Service available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Pharmacy Contraception Service appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Pharmacy Contraception Service appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Pharmacy Contraception Service?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Pharmacy Contraception Service?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Pharmacy Contraception Service?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Pharmacy Contraception Service?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Pharmacy Contraception Service consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Pharmacy Contraception Service?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Pharmacy Contraception Service for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Pharmacy Contraception Service confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Pharmacy Contraception Service?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Pharmacy Contraception Service require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Pharmacy Contraception Service at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "ear-wax-removal": {
    serviceId: "ear-wax-removal",
    serviceName: "Ear Wax Removal",
    intro: [
      {
        body: "Ear Wax Removal at a community pharmacy offers professional private ear wax removal including microsuction with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led ear wax removal for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Ear Wax Removal complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver ear wax removal with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Ear Wax Removal addresses practical barriers to private ear wax removal including microsuction. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "softening preparation",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Ear Wax Removal addresses practical barriers to private ear wax removal including microsuction. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "microsuction procedure",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Ear Wax Removal addresses practical barriers to private ear wax removal including microsuction. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "hearing symptom review",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Ear Wax Removal addresses practical barriers to private ear wax removal including microsuction. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "aftercare advice",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional private ear wax removal including microsuction with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for ear wax removal is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Blocked ears from wax",
          "Hearing muffling",
          "Failed self-syringing",
          "Patients needing professional removal",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for ear wax removal, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Ear Wax Removal follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Ear Wax Removal",
        body: "Educational guidance covers what ear wax removal involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for ear wax removal. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for ear wax removal?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Ear Wax Removal available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Ear Wax Removal appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Ear Wax Removal appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Ear Wax Removal?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Ear Wax Removal?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Ear Wax Removal?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Ear Wax Removal?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Ear Wax Removal consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Ear Wax Removal?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Ear Wax Removal for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Ear Wax Removal confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Ear Wax Removal?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Ear Wax Removal require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Ear Wax Removal at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "new-medicine-service": {
    serviceId: "new-medicine-service",
    serviceName: "New Medicine Service",
    intro: [
      {
        body: "New Medicine Service at a community pharmacy offers professional NHS support when starting selected new medicines with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led new medicine service for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "New Medicine Service complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver new medicine service with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "New Medicine Service addresses practical barriers to NHS support when starting selected new medicines. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "adherence support",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "New Medicine Service addresses practical barriers to NHS support when starting selected new medicines. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "side effect monitoring",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "New Medicine Service addresses practical barriers to NHS support when starting selected new medicines. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "lifestyle advice",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "New Medicine Service addresses practical barriers to NHS support when starting selected new medicines. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "GP feedback",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional NHS support when starting selected new medicines with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for new medicine service is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "New starters on NMS medicines",
          "Patients unsure about new treatment",
          "Complex dosing schedules",
          "Those with adherence concerns",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for new medicine service, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "New Medicine Service follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding New Medicine Service",
        body: "Educational guidance covers what new medicine service involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for new medicine service. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for new medicine service?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is New Medicine Service available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a New Medicine Service appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my New Medicine Service appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for New Medicine Service?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking New Medicine Service?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for New Medicine Service?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for New Medicine Service?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a New Medicine Service consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using New Medicine Service?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use New Medicine Service for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is New Medicine Service confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after New Medicine Service?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does New Medicine Service require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book New Medicine Service at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "minor-ailments": {
    serviceId: "minor-ailments",
    serviceName: "Minor Ailments",
    intro: [
      {
        body: "Minor Ailments at a community pharmacy offers professional pharmacist advice for common minor conditions with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led minor ailments for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Minor Ailments complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver minor ailments with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Minor Ailments addresses practical barriers to pharmacist advice for common minor conditions. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "OTC guidance",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Minor Ailments addresses practical barriers to pharmacist advice for common minor conditions. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "self-care education",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Minor Ailments addresses practical barriers to pharmacist advice for common minor conditions. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "GP signposting",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Minor Ailments addresses practical barriers to pharmacist advice for common minor conditions. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "symptom safety-netting",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional pharmacist advice for common minor conditions with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for minor ailments is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Mild self-limiting symptoms",
          "Parents seeking child advice",
          "Unsure if GP needed",
          "OTC product selection help",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for minor ailments, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Minor Ailments follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Minor Ailments",
        body: "Educational guidance covers what minor ailments involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for minor ailments. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for minor ailments?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Minor Ailments available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Minor Ailments appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Minor Ailments appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Minor Ailments?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Minor Ailments?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Minor Ailments?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Minor Ailments?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Minor Ailments consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Minor Ailments?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Minor Ailments for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Minor Ailments confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Minor Ailments?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Minor Ailments require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Minor Ailments at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "malaria-prevention": {
    serviceId: "malaria-prevention",
    serviceName: "Malaria Prevention",
    intro: [
      {
        body: "Malaria Prevention at a community pharmacy offers professional antimalarial advice and supply for travel with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led malaria prevention for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Malaria Prevention complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver malaria prevention with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Malaria Prevention addresses practical barriers to antimalarial advice and supply for travel. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "destination risk",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Malaria Prevention addresses practical barriers to antimalarial advice and supply for travel. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "tablet selection",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Malaria Prevention addresses practical barriers to antimalarial advice and supply for travel. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "adherence planning",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Malaria Prevention addresses practical barriers to antimalarial advice and supply for travel. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "side effect counselling",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional antimalarial advice and supply for travel with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for malaria prevention is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Travellers to endemic areas",
          "Backpackers",
          "Business travel",
          "Families on holiday abroad",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for malaria prevention, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Malaria Prevention follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Malaria Prevention",
        body: "Educational guidance covers what malaria prevention involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for malaria prevention. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for malaria prevention?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Malaria Prevention available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Malaria Prevention appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Malaria Prevention appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Malaria Prevention?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Malaria Prevention?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Malaria Prevention?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Malaria Prevention?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Malaria Prevention consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Malaria Prevention?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Malaria Prevention for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Malaria Prevention confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Malaria Prevention?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Malaria Prevention require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Malaria Prevention at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "vitamin-b12-injections": {
    serviceId: "vitamin-b12-injections",
    serviceName: "Vitamin B12 Injections",
    intro: [
      {
        body: "Vitamin B12 Injections at a community pharmacy offers professional private B12 injection service with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led vitamin b12 injections for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Vitamin B12 Injections complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver vitamin b12 injections with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Vitamin B12 Injections addresses practical barriers to private B12 injection service. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "deficiency confirmation",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Vitamin B12 Injections addresses practical barriers to private B12 injection service. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "injection scheduling",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Vitamin B12 Injections addresses practical barriers to private B12 injection service. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "dietary advice",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Vitamin B12 Injections addresses practical barriers to private B12 injection service. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "GP result review",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional private B12 injection service with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for vitamin b12 injections is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Confirmed B12 deficiency",
          "Malabsorption patients",
          "Dietary deficiency support",
          "Patients on replacement schedule",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for vitamin b12 injections, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Vitamin B12 Injections follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Vitamin B12 Injections",
        body: "Educational guidance covers what vitamin b12 injections involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for vitamin b12 injections. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for vitamin b12 injections?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Vitamin B12 Injections available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Vitamin B12 Injections appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Vitamin B12 Injections appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Vitamin B12 Injections?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Vitamin B12 Injections?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Vitamin B12 Injections?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Vitamin B12 Injections?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Vitamin B12 Injections consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Vitamin B12 Injections?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Vitamin B12 Injections for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Vitamin B12 Injections confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Vitamin B12 Injections?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Vitamin B12 Injections require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Vitamin B12 Injections at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "health-checks": {
    serviceId: "health-checks",
    serviceName: "Health Checks",
    intro: [
      {
        body: "Health Checks at a community pharmacy offers professional private preventative health screening with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led health checks for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Health Checks complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver health checks with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Health Checks addresses practical barriers to private preventative health screening. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "blood pressure and metrics",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Health Checks addresses practical barriers to private preventative health screening. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "risk interpretation",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Health Checks addresses practical barriers to private preventative health screening. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "GP signposting",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Health Checks addresses practical barriers to private preventative health screening. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "repeat screening advice",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional private preventative health screening with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for health checks is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Preventative screening seekers",
          "Cardiovascular risk monitoring",
          "Between GP checks",
          "Wellness-focused adults",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for health checks, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Health Checks follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Health Checks",
        body: "Educational guidance covers what health checks involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for health checks. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for health checks?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Health Checks available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Health Checks appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Health Checks appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Health Checks?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Health Checks?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Health Checks?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Health Checks?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Health Checks consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Health Checks?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Health Checks for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Health Checks confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Health Checks?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Health Checks require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Health Checks at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "medication-reviews": {
    serviceId: "medication-reviews",
    serviceName: "Medication Reviews",
    intro: [
      {
        body: "Medication Reviews at a community pharmacy offers professional structured medicines use review with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led medication reviews for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "Medication Reviews complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver medication reviews with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "Medication Reviews addresses practical barriers to structured medicines use review. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "interaction checks",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "Medication Reviews addresses practical barriers to structured medicines use review. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "adherence discussion",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "Medication Reviews addresses practical barriers to structured medicines use review. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "action planning",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "Medication Reviews addresses practical barriers to structured medicines use review. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "GP sharing",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional structured medicines use review with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for medication reviews is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Multi-medicine patients",
          "New long-term treatment",
          "Adherence concerns",
          "Carers managing medicines",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for medication reviews, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "Medication Reviews follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding Medication Reviews",
        body: "Educational guidance covers what medication reviews involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for medication reviews. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for medication reviews?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is Medication Reviews available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a Medication Reviews appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my Medication Reviews appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for Medication Reviews?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking Medication Reviews?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for Medication Reviews?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for Medication Reviews?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a Medication Reviews consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using Medication Reviews?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use Medication Reviews for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is Medication Reviews confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after Medication Reviews?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does Medication Reviews require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book Medication Reviews at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
  "nhs-services": {
    serviceId: "nhs-services",
    serviceName: "NHS Services",
    intro: [
      {
        body: "NHS Services at a community pharmacy offers professional overview of NHS pharmacy services locally with clear advice on suitability, booking and next steps."
      },
      {
        body: "Patients choose pharmacy-led nhs services for convenient local access and pharmacist oversight throughout the process."
      },
      {
        body: "A structured consultation explains eligibility, what to expect, and when GP or urgent care is more appropriate."
      },
      {
        body: "NHS Services complements wider healthcare — with safety-netting and referral guidance when needs fall outside pharmacy scope."
      },
      {
        body: "Regulated pharmacy teams deliver nhs services with confidential consultation space and plain-language patient education."
      }
    ],
    problem: [
      {
        heading: "Why This Service Matters",
        body: "NHS Services addresses practical barriers to overview of NHS pharmacy services locally. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "service eligibility",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Understanding Access",
        body: "NHS Services addresses practical barriers to overview of NHS pharmacy services locally. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "booking pathways",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Common Patient Questions",
        body: "NHS Services addresses practical barriers to overview of NHS pharmacy services locally. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "free NHS care scope",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      },
      {
        heading: "Getting The Right Care",
        body: "NHS Services addresses practical barriers to overview of NHS pharmacy services locally. Patients often need clarity on eligibility, timing and whether pharmacy care is suitable before booking.",
        bullets: [
          "signposting support",
          "Eligibility and commissioning",
          "Appointment vs walk-in",
          "GP referral when needed"
        ]
      }
    ],
    benefits: [
      {
        heading: "Benefits Of Pharmacy Care",
        body: "Professional overview of NHS pharmacy services locally with convenient community access and pharmacist-led assessment.",
        bullets: [
          "Local high street access",
          "Confidential consultation",
          "Clear next steps",
          "Plain-language advice"
        ]
      },
      {
        heading: "What You Can Expect",
        body: "Structured discussion covering suitability, process steps and follow-up planning.",
        bullets: [
          "Individual assessment",
          "Safety-netting",
          "Documentation where offered",
          "Professional standards"
        ]
      },
      {
        heading: "Practical Advantages",
        body: "Pharmacy access reduces delay for suitable presentations without replacing GP for complex care.",
        bullets: [
          "Flexible booking",
          "Same-day where offered",
          "Integrated records",
          "Complements GP pathways"
        ]
      },
      {
        heading: "Patient-Focused Support",
        body: "Education and adherence guidance help you use the service safely and effectively.",
        bullets: [
          "Self-care advice",
          "Follow-up intervals",
          "Side effect awareness",
          "Questions welcomed"
        ]
      },
      {
        heading: "Accessible Healthcare",
        body: "Community pharmacy puts specialist support closer to where people live and work.",
        bullets: [
          "Serving nearby areas",
          "Reduced travel",
          "Carer-friendly access",
          "Regulated premises"
        ]
      }
    ],
    eligibility: [
      {
        heading: "Who Can Use This Service",
        body: "Suitability for nhs services is confirmed individually based on clinical criteria and local commissioning.",
        bullets: [
          "Unsure which service to use",
          "New to area patients",
          "Seeking free NHS care",
          "Carers navigating access",
          "Symptom severity review",
          "Age-specific limits"
        ]
      },
      {
        heading: "Eligibility Overview",
        body: "Not every patient qualifies — assessment confirms whether pharmacy care is safe and appropriate.",
        bullets: [
          "Clinical criteria apply",
          "NHS vs private scope",
          "Pregnancy and medicines review",
          "Emergency exclusions"
        ]
      },
      {
        heading: "Before You Book",
        body: "Share accurate medical history, medicines and allergy information for safe assessment.",
        bullets: [
          "Medicines list",
          "Allergy history",
          "Recent test results",
          "GP details"
        ]
      },
      {
        heading: "Is This Right For Me",
        body: "Contact the pharmacy team if unsure — they advise on the best pathway for your situation.",
        bullets: [
          "Phone triage",
          "Scope explained",
          "Alternative signposting",
          "Booking guidance"
        ]
      },
      {
        heading: "Commissioning And Fees",
        body: "NHS services may be free where commissioned; private services incur disclosed fees — confirm at booking.",
        bullets: [
          "Local availability",
          "Fee transparency",
          "Insurance not typically covered",
          "Eligibility checked at visit"
        ]
      }
    ],
    howItWorks: [
      {
        heading: "How The Service Works",
        body: "Book or attend, receive assessment for nhs services, and leave with a clear plan including supply or referral where appropriate.",
        bullets: [
          "Booking or triage",
          "Confidential assessment",
          "Treatment or advice",
          "Follow-up plan",
          "Safety-netting"
        ]
      },
      {
        heading: "Consultation Steps",
        body: "The pharmacist reviews history, confirms eligibility and explains each step before proceeding.",
        bullets: [
          "History and consent",
          "Clinical checks",
          "Option discussion",
          "Documentation"
        ]
      },
      {
        heading: "The Clinical Process",
        body: "Structured governance ensures appropriate care within pharmacy scope.",
        bullets: [
          "Standard operating procedures",
          "Referral criteria",
          "Record keeping",
          "Quality standards"
        ]
      },
      {
        heading: "During Your Appointment",
        body: "Allow adequate time for questions — typically 15–30 minutes depending on service complexity.",
        bullets: [
          "Questions encouraged",
          "Private room",
          "No rushed decisions",
          "Carer involvement if needed"
        ]
      },
      {
        heading: "After Your Visit",
        body: "Follow advice given and return or contact GP if symptoms persist, worsen or new concerns arise.",
        bullets: [
          "Self-care steps",
          "Return triggers",
          "GP follow-up criteria",
          "Emergency symptoms"
        ]
      }
    ],
    preparationGuide: [
      {
        heading: "Preparing For Your Visit",
        body: "Bring medicines list, relevant test results and note questions in advance.",
        bullets: [
          "Medicines and OTC list",
          "Previous results",
          "Symptom timeline",
          "Insurance not required for NHS"
        ]
      },
      {
        heading: "What To Bring",
        body: "Photo ID if required, GP details and any referral or travel itinerary documents where relevant.",
        bullets: [
          "Photo ID",
          "GP surgery details",
          "Travel dates if relevant",
          "Allergy information"
        ]
      },
      {
        heading: "Before Appointment Day",
        body: "Follow any pre-appointment instructions such as fasting, softening drops or avoiding certain medicines.",
        bullets: [
          "Service-specific prep",
          "Arrive on time",
          "Declare pregnancy",
          "Mask if unwell"
        ]
      },
      {
        heading: "Appointment Tips",
        body: "Wear suitable clothing for checks if required and allow buffer time after the appointment.",
        bullets: [
          "Comfortable clothing",
          "Allow 30 minutes",
          "One guardian for minors",
          "Hydration for blood tests"
        ]
      },
      {
        heading: "Maximising Your Consultation",
        body: "Honest answers help safe care — ask about alternatives, costs and follow-up before you leave.",
        bullets: [
          "Ask about fees",
          "Confirm follow-up",
          "Understand side effects",
          "Know emergency signs"
        ]
      }
    ],
    trustSafety: [
      {
        heading: "Safety And Professional Standards",
        body: "NHS Services follows regulated pharmacy governance with referral when care falls outside scope.",
        bullets: [
          "Individual suitability",
          "Emergency signposting",
          "Not for red-flag symptoms",
          "Clinical limits apply"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "When To Seek GP Or Urgent Care",
        body: "Severe, persistent or worsening symptoms, pregnancy complications and emergency presentations need medical review beyond routine pharmacy care.",
        bullets: [
          "Red flag symptoms",
          "Chest pain or breathing difficulty",
          "Severe allergic reaction",
          "Sudden neurological symptoms"
        ],
        type: "safetyConsiderations"
      },
      {
        heading: "Professional Insight",
        body: "Best outcomes follow accurate history, adherence to advice and timely follow-up when symptoms do not improve.",
        bullets: [
          "Complete courses",
          "Report side effects",
          "Avoid sharing medicines",
          "Keep GP informed"
        ],
        type: "professionalInsight"
      },
      {
        heading: "Trust And Clinical Governance",
        body: "GPhC-regulated pharmacy teams maintain confidential records and commissioned service standards where applicable.",
        bullets: [
          "Regulated premises",
          "Trained clinicians",
          "Audit-ready processes",
          "Patient confidentiality"
        ],
        type: "trust"
      }
    ],
    patientEducation: [
      {
        heading: "Understanding NHS Services",
        body: "Educational guidance covers what nhs services involves, eligibility, and realistic outcomes.",
        bullets: [
          "Service scope",
          "NHS vs private",
          "Self-care role",
          "Follow-up expectations"
        ]
      },
      {
        heading: "Self-Care And Recovery",
        body: "Lifestyle measures and self-care often support treatment — follow personalised pharmacist advice.",
        bullets: [
          "Rest and hydration",
          "Healthy habits",
          "Monitor symptoms",
          "Return if no improvement"
        ]
      },
      {
        heading: "Medicines And Treatment Awareness",
        body: "Understand how supplied medicines work, common side effects and when to seek further help.",
        bullets: [
          "How to take treatment",
          "Side effect reporting",
          "Interactions",
          "Storage instructions"
        ]
      },
      {
        heading: "Long-Term Health",
        body: "Pharmacy services support ongoing wellbeing — chronic or complex conditions remain with your GP.",
        bullets: [
          "GP for long-term care",
          "Preventative habits",
          "Regular reviews",
          "Emergency awareness"
        ]
      }
    ],
    mythVsFact: [
      {
        heading: "Myths Vs Facts",
        body: "Evidence-based information:",
        bullets: [
          "Myth: Every patient qualifies for nhs services. Fact: Individual assessment confirms suitability.",
          "Myth: Pharmacy replaces GP care. Fact: Services complement GP pathways.",
          "Myth: No follow-up is needed. Fact: Safety-netting and review matter."
        ]
      },
      {
        heading: "Common Misconceptions",
        body: "Accurate facts support safe decisions:",
        bullets: [
          "Myth: Walk-in always available. Fact: Booking may be required.",
          "Myth: All services are free. Fact: NHS eligibility and fees vary.",
          "Myth: Online advice is enough. Fact: Assessment requires consultation for supply."
        ]
      },
      {
        heading: "Service Facts",
        body: "Separating myths from facts:",
        bullets: [
          "Myth: Instant treatment guaranteed. Fact: Clinical assessment determines care.",
          "Myth: Same service everywhere. Fact: Commissioning varies locally.",
          "Myth: Side effects should be ignored. Fact: Report concerns promptly."
        ]
      },
      {
        heading: "Safe Use Clarified",
        body: "Use pharmacy services appropriately:",
        bullets: [
          "Myth: Emergency care at pharmacy. Fact: Emergencies need 999 or A&E.",
          "Myth: Share unused medicines. Fact: Never share prescription treatment.",
          "Myth: Skip follow-up if feeling better. Fact: Complete courses and reviews."
        ]
      }
    ],
    cta: [
      {
        primary: "Book Appointment",
        secondary: "Speak To A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Check Availability",
        secondary: "Ask A Pharmacist",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Request Advice",
        secondary: "Get Advice",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Start Booking",
        secondary: "Phone The Team",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      },
      {
        primary: "Speak To Team",
        secondary: "Book Consultation",
        phonePrompt: "Call the pharmacy team to ask about availability, suitability and booking options.",
        bookingPrompt: "Book online or by phone once suitability is confirmed at assessment."
      }
    ],
    faqs: [
      {
        question: "Do I need an appointment for nhs services?",
        answer: "Booking ahead is recommended so adequate consultation time is allowed — walk-in availability varies by service and location."
      },
      {
        question: "Is NHS Services available on the NHS?",
        answer: "NHS care may be free where commissioned and you meet eligibility criteria; private options may incur a fee — confirm at booking."
      },
      {
        question: "How long does a NHS Services appointment take?",
        answer: "Most consultations take 15–30 minutes depending on clinical complexity and any tests or supply involved."
      },
      {
        question: "What should I bring to my NHS Services appointment?",
        answer: "Bring a medicines list, allergy information, relevant test results and photo ID if required for the service."
      },
      {
        question: "Who is eligible for NHS Services?",
        answer: "Eligibility depends on clinical criteria, age and local commissioning — assessed individually at consultation."
      },
      {
        question: "Can I speak to a pharmacist before booking NHS Services?",
        answer: "Yes — contact the pharmacy team to discuss suitability, availability and booking options before attending."
      },
      {
        question: "What if I am not eligible for NHS Services?",
        answer: "You receive clear signposting to GP, NHS 111 or alternative services when pharmacy care is not appropriate."
      },
      {
        question: "Are there fees for NHS Services?",
        answer: "Fees depend on NHS commissioning and whether the service is private — the team confirms costs before supply where applicable."
      },
      {
        question: "What happens during a NHS Services consultation?",
        answer: "A pharmacist assesses suitability, explains options, provides treatment or advice where appropriate, and documents next steps."
      },
      {
        question: "When should I see a GP instead of using NHS Services?",
        answer: "Persistent, severe or worsening symptoms, pregnancy complications and emergency presentations need GP or urgent care review."
      },
      {
        question: "Can I use NHS Services for my child?",
        answer: "Age limits vary by service — contact the pharmacy to confirm paediatric availability and guardian requirements."
      },
      {
        question: "Is NHS Services confidential?",
        answer: "Yes — consultations take place in a private pharmacy consultation room with professional confidentiality standards."
      },
      {
        question: "What follow-up is needed after NHS Services?",
        answer: "Follow safety-netting advice; return for review or see your GP if symptoms persist, worsen or new concerns arise."
      },
      {
        question: "Does NHS Services require a GP referral?",
        answer: "Referral requirements vary — many pharmacy services are accessible without GP referral; confirm locally for your service."
      },
      {
        question: "How do I book NHS Services at the pharmacy?",
        answer: "Book online or by phone using the pharmacy contact details — the team confirms availability and preparation instructions."
      }
    ]
  },
};
