#!/usr/bin/env node
/**
 * Phase 2 — Pharmacy Service Intelligence Layer
 * Builds output/pharmacy-blueprint/service-intelligence.json from business-intelligence.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BI_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "business-intelligence.json");
const OUT_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "service-intelligence.json");

const bi = JSON.parse(fs.readFileSync(BI_PATH, "utf8"));

/** Normalise service key to graph node id */
function graphId(serviceKey) {
  return serviceKey
    .replace(/^nhs-/, "")
    .replace(/-service$/, "")
    .replace(/-and-referral$/, "")
    .replace(/-support$/, "")
    .replace(/-checks$/, "-check")
    .replace(/electronic-prescription-service-eps/, "prescription-dispensing")
    .replace(/repeat-prescription-service/, "repeat-prescription")
    .replace(/prescription-collection-service/, "repeat-prescription")
    .replace(/private-prescription-service-fees/, "private-prescription-dispensing")
    .replace(/private-minor-ailment-treatment/, "minor-illness-consultation")
    .replace(/private-health-consultations/, "minor-illness-consultation")
    .replace(/medicines-use-review-mur-structured-medication-review/, "mur")
    .replace(/medicines-use-review/, "mur")
    .replace(/nhs-new-medicine-service-nms/, "nms")
    .replace(/nhs-blood-pressure-checks/, "blood-pressure")
    .replace(/nhs-flu-vaccination/, "nhs-flu")
    .replace(/nhs-smoking-cessation-support/, "smoking-cessation")
    .replace(/pharmacy-contraception-service/, "contraception")
    .replace(/emergency-hormonal-contraception/, "ehc")
    .replace(/blister-packs-and-compliance-aids/, "blister-packs")
    .replace(/travel-health-consultation/, "travel-health-consultation")
    .replace(/malaria-prophylaxis/, "malaria-prophylaxis")
    .replace(/private-ear-wax-removal/, "ear-wax-removal")
    .replace(/private-blood-testing/, "blood-testing")
    .replace(/vitamin-b12-injections/, "blood-testing")
    .replace(/weight-management-consultation/, "weight-consultation")
    .replace(/pharmacy-weight-loss-programme/, "weight-consultation")
    .replace(/glp-1-weight-management-treatment/, "glp1")
    .replace(/body-composition-and-bmi-monitoring/, "bmi-monitoring")
    .replace(/nutritional-and-lifestyle-advice/, "healthy-living")
    .replace(/blood-pressure-monitoring/, "blood-pressure")
    .replace(/cholesterol-testing/, "cholesterol-test")
    .replace(/diabetes-screening/, "diabetes-screening")
    .replace(/minor-illness-consultation/, "minor-illness-consultation")
    .replace(/healthy-living-advice/, "healthy-living")
    .replace(/asthma-and-copd-inhaler-technique-review/, "inhaler-technique")
    .replace(/seasonal-flu-vaccination-private/, "private-flu")
    .replace(/travel-vaccinations/, "travel-vaccinations")
    .replace(/travel-first-aid-and-kit-supply/, "travel-first-aid")
    .replace(/yellow-fever-vaccination-centre/, "yellow-fever")
    .replace(/rabies-vaccination/, "travel-vaccinations")
    .replace(/altitude-sickness-prevention/, "travel-first-aid")
    .replace(/compounding-and-specialist-supply/, "private-prescription-dispensing")
    .replace(/palliative-care-dispensing/, "prescription-dispensing")
    .replace(/hepatitis-c-testing-and-referral/, "blood-testing")
    .replace(/drug-tariff-and-point-of-care-diagnostics/, "minor-illness-consultation")
    .replace(/co-vid-19-lateral-flow-supply/, "minor-illness-consultation")
    .replace(/co-vid-19-vaccination/, "nhs-flu")
    .replace(/whooping-cough-pertussis-vaccination/, "nhs-flu")
    .replace(/rsv-vaccination/, "nhs-flu")
    .replace(/pregnancy-testing/, "minor-illness-consultation")
    .replace(/urinalysis-and-uti-screening/, "pharmacy-first")
    .replace(/pain-management-consultation/, "minor-illness-consultation")
    .replace(/skin-condition-assessment/, "minor-illness-consultation")
    .replace(/sleep-and-stress-support-consultation/, "healthy-living")
    .replace(/children-s-health-consultation/, "minor-illness-consultation");
}

const CATEGORY_AUDIENCE = {
  prescription: {
    primary: "Regular NHS prescription patients and repeat medication users",
    secondary: ["Elderly patients and family carers", "Housebound and rural patients", "Care home liaisons"],
  },
  nhs: {
    primary: "Patients seeking NHS clinical care without a GP appointment",
    secondary: ["Busy working adults", "Parents managing family health", "Chronic condition managers"],
  },
  private: {
    primary: "Patients seeking convenient private healthcare access",
    secondary: ["Busy professionals", "Self-pay wellness customers", "Patients with GP waiting list frustration"],
  },
  travel: {
    primary: "Leisure and business travellers requiring destination-specific health advice",
    secondary: ["Families travelling with children", "Adventure and backpacking travellers", "Last-minute travel planners"],
  },
  vaccination: {
    primary: "Adults and families seeking immunisation protection",
    secondary: ["Employer-organised health customers", "University entrants", "Clinical at-risk groups"],
  },
  "weight-management": {
    primary: "Adults seeking medically supported weight management",
    secondary: ["Patients referred from primary care", "Repeat dieters seeking structured support", "Health-conscious professionals"],
  },
  testing: {
    primary: "Health-conscious adults seeking screening and monitoring",
    secondary: ["Hypertension and diabetes managers", "Preventive health customers", "Private screening seekers"],
  },
  consultation: {
    primary: "Patients needing pharmacist-led advice and medicines optimisation",
    secondary: ["Polypharmacy elderly patients", "Respiratory patients", "Parents seeking paediatric guidance"],
  },
};

const CATEGORY_COMPLIANCE = {
  prescription: ["Human Medicines Regulations 2012", "GPhC dispensing standards", "EPS governance", "Patient confidentiality GDPR"],
  nhs: ["NHS service specifications", "CPCF requirements", "PGD governance where applicable", "NHS logo usage compliance"],
  private: ["GPhC advertising standards", "Transparent private fee disclosure", "POM advertising restrictions", "Informed consent documentation"],
  travel: ["Yellow fever centre certification where applicable", "Travel health record keeping", "Private fee transparency", "Vaccine cold chain SOPs"],
  vaccination: ["JCVI programme alignment", "NHS or private programme rules", "Anaphylaxis protocols", "Vaccine storage compliance"],
  "weight-management": ["NICE obesity guidance alignment", "GLP-1 supply legal frameworks", "No guaranteed weight loss claims", "Clinical eligibility assessment required"],
  testing: ["IVD regulatory compliance", "Result interpretation limits", "GP referral pathways", "Data protection for health results"],
  consultation: ["Scope of practice boundaries", "Safeguarding protocols", "Red flag referral obligations", "Confidential consultation records"],
};

const CATEGORY_RELATED = {
  prescription: ["repeat-prescription-service", "prescription-delivery", "blister-packs-and-compliance-aids", "emergency-supply"],
  nhs: ["pharmacy-first", "nhs-blood-pressure-checks", "nhs-new-medicine-service-nms", "nhs-flu-vaccination"],
  private: ["private-health-consultations", "private-blood-testing", "private-ear-wax-removal"],
  travel: ["travel-health-consultation", "travel-vaccinations", "malaria-prophylaxis", "travel-first-aid-and-kit-supply"],
  vaccination: ["nhs-flu-vaccination", "seasonal-flu-vaccination-private", "shingles-vaccination", "travel-vaccinations"],
  "weight-management": ["weight-management-consultation", "pharmacy-weight-loss-programme", "glp-1-weight-management-treatment", "body-composition-and-bmi-monitoring"],
  testing: ["nhs-blood-pressure-checks", "blood-pressure-monitoring", "cholesterol-testing", "diabetes-screening"],
  consultation: ["pharmacy-first", "minor-illness-consultation", "healthy-living-advice", "asthma-and-copd-inhaler-technique-review"],
};

const CATEGORY_PARENT = {
  prescription: [],
  nhs: ["prescription-dispensing"],
  private: ["pharmacy-first"],
  travel: ["travel-health-consultation"],
  vaccination: ["travel-health-consultation"],
  "weight-management": ["weight-management-consultation"],
  testing: ["nhs-blood-pressure-checks"],
  consultation: ["pharmacy-first"],
};

const CATEGORY_UPSELL = {
  prescription: ["repeat-prescription-service", "prescription-delivery", "blister-packs-and-compliance-aids"],
  nhs: ["nhs-new-medicine-service-nms", "nhs-blood-pressure-checks"],
  private: ["private-blood-testing", "private-health-consultations"],
  travel: ["travel-vaccinations", "malaria-prophylaxis", "travel-first-aid-and-kit-supply"],
  vaccination: ["seasonal-flu-vaccination-private", "shingles-vaccination"],
  "weight-management": ["glp-1-weight-management-treatment", "body-composition-and-bmi-monitoring"],
  testing: ["private-blood-testing", "medicines-use-review-mur-structured-medication-review"],
  consultation: ["nhs-new-medicine-service-nms", "healthy-living-advice"],
};

function flattenServices() {
  const out = [];
  for (const [groupKey, services] of Object.entries(bi.coreServices)) {
    for (const s of services) {
      out.push({ ...s, groupKey });
    }
  }
  return out;
}

function buildLinkIndex() {
  const edges = bi.serviceRelationships?.edges ?? [];
  const nodes = bi.serviceRelationships?.nodes ?? [];
  const labelById = Object.fromEntries(nodes.map((n) => [n.id, n.label]));
  const keyById = {};
  for (const s of flattenServices()) {
    keyById[graphId(s.serviceKey)] = s.serviceKey;
  }

  const parent = {};
  const supporting = {};
  const upsell = {};
  const related = {};

  for (const e of edges) {
    const fromKey = keyById[e.from] ?? e.from;
    const toKey = keyById[e.to] ?? e.to;
    if (!related[fromKey]) related[fromKey] = [];
    if (!related[toKey]) related[toKey] = [];
    related[fromKey].push({ serviceKey: toKey, relationship: e.relationship, label: labelById[e.to] ?? toKey });
    related[toKey].push({ serviceKey: fromKey, relationship: `reverse_${e.relationship}`, label: labelById[e.from] ?? fromKey });

    if (["informs_required_immunisations", "risk_assessment", "clinical_pathway", "feeds_supply", "triggers_for_new_medicines"].includes(e.relationship)) {
      if (!parent[toKey]) parent[toKey] = [];
      parent[toKey].push({ serviceKey: fromKey, label: labelById[e.from] ?? fromKey });
    }
    if (["treatment_supply", "delivery_option", "compliance_support", "ongoing_monitoring"].includes(e.relationship)) {
      if (!supporting[fromKey]) supporting[fromKey] = [];
      supporting[fromKey].push({ serviceKey: toKey, label: labelById[e.to] ?? toKey });
    }
    if (["often_co_prescribed", "adult_immunisation_bundle", "seasonal_co_promotion", "treatment_eligibility"].includes(e.relationship)) {
      if (!upsell[fromKey]) upsell[fromKey] = [];
      upsell[fromKey].push({ serviceKey: toKey, label: labelById[e.to] ?? toKey });
    }
  }

  return { parent, supporting, upsell, related };
}

function expandBenefits(service) {
  const base = [...(service.customerBenefits ?? [])];
  const templates = [
    `Professional pharmacist oversight for ${service.serviceName.toLowerCase()}`,
    "Convenient local access on your high street",
    "Clear advice from a qualified medicines expert",
    "Reduced need to wait for GP appointments where appropriate",
    "Confidential consultation in a private room",
    "Extended opening hours compared with many GP surgeries",
    "Integrated with your wider pharmacy care",
    "Trusted regulated healthcare setting (GPhC registered)",
    "Support for carers and family members where relevant",
    "Transparent next steps and safety-netting advice",
    "Same-day or rapid access where clinically appropriate",
    "Coordination with your GP when referral is needed",
  ];
  const out = [...base];
  for (const t of templates) {
    if (out.length >= 12 && out.length >= 10) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, Math.max(10, out.length));
}

function expandProblems(service) {
  const base = [...(service.commonProblemsSolved ?? [])];
  const templates = [
    "Difficulty accessing GP appointments quickly",
    "Uncertainty whether symptoms need urgent care",
    "Confusion about eligibility and cost",
    "Limited awareness that pharmacies offer this service",
    "Transport or mobility barriers to healthcare",
    "Work-hour conflicts with surgery opening times",
    "Anxiety about treatment safety and suitability",
    "Previous poor experience with delayed care elsewhere",
    "Need for discreet professional advice",
    "Managing multiple health needs across different providers",
    "Incomplete information found online",
    "Carer burden coordinating family healthcare",
  ];
  const out = [...base];
  for (const t of templates) {
    if (out.length >= 12) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, Math.max(10, out.length));
}

function generateFaqs(service) {
  const n = service.serviceName;
  const nk = n.toLowerCase();
  const cat = service.category;
  const isNhs = cat === "nhs" || nk.includes("nhs");
  const templates = [
    `What is ${n} at a community pharmacy?`,
    `How do I access ${n} at my local pharmacy?`,
    `Do I need an appointment for ${n}?`,
    `Is ${n} available on the NHS?`,
    `How much does ${n} cost at a pharmacy?`,
    `Who is eligible for ${n}?`,
    `How long does a ${nk} appointment take?`,
    `What should I bring to my ${nk} appointment?`,
    `Can I book ${n} online?`,
    `Is ${n} confidential?`,
    `Can children receive ${n} at a pharmacy?`,
    `Is ${n} available at weekends?`,
    `What qualifications do pharmacy staff need to provide ${n}?`,
    `Can ${n} replace seeing my GP?`,
    `What happens after my ${nk} consultation?`,
    `Are there any risks or side effects associated with ${n}?`,
    `How do I know if ${n} is right for me?`,
    `Can I get ${n} if I am pregnant or breastfeeding?`,
    `Does ${n} require a GP referral?`,
    `What is the difference between pharmacy ${nk} and a GP service?`,
    `How do I find a pharmacy offering ${n} near me?`,
    `Can carers arrange ${n} on behalf of someone else?`,
    `Will my GP be informed about my ${nk} visit?`,
    `What documents or ID do I need for ${n}?`,
    `Can I use ${n} if I am visiting from outside the area?`,
  ];

  const specific = [];
  if (isNhs) specific.push(`Is ${n} free on the NHS?`, `Which NHS service specification covers ${n}?`);
  if (cat === "travel") specific.push(`How far before travel should I book ${n}?`, `Which destinations require ${n}?`);
  if (cat === "vaccination") specific.push(`Can I walk in for ${n} without booking?`, `What are common side effects after ${n}?`);
  if (cat === "prescription") specific.push(`How long does ${n} take to prepare?`, `Can someone else collect my ${nk} items?`);
  if (cat === "weight-management") specific.push(`Who is eligible for pharmacy ${nk}?`, `Is ${n} medically supervised?`);

  for (const q of service.customerIntent ?? []) {
    const cleaned = q.trim();
    if (/[?]$/.test(cleaned)) {
      specific.push(cleaned);
    } else if (/^(how|what|where|when|why|can|do|is|are)\b/i.test(cleaned)) {
      specific.push(`${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}?`);
    } else if (cleaned.toLowerCase() === n.toLowerCase() || cleaned.toLowerCase() === nk) {
      specific.push(`Where can I access ${n} near me?`);
    } else if (/\bnear me\b/i.test(cleaned)) {
      specific.push(`Where can I get ${nk} near me?`);
    } else if (/^(collect|dispense|order|book|register)\b/i.test(cleaned)) {
      specific.push(`How do I ${cleaned} at a pharmacy?`);
    } else if (/\b(for|vs|treatment|service|check|jabs?|vaccine|prescription|delivery)\b/i.test(cleaned)) {
      specific.push(`Can a pharmacy help with ${cleaned}?`);
    } else {
      specific.push(`How do I find a pharmacy for ${cleaned}?`);
    }
  }

  const merged = [...specific, ...templates];
  const unique = [...new Set(merged)];
  return unique.slice(0, Math.max(20, Math.min(25, unique.length))).map((question, i) => ({
    id: `${service.serviceKey}-faq-${i + 1}`,
    question,
  }));
}

function localSearchIntent(service) {
  const sn = service.serviceName;
  const sk = service.serviceKey.replace(/-/g, " ");
  const intents = service.customerIntent ?? [];
  return {
    commercial: [
      `${sk} pharmacy`,
      `${sk} near me`,
      `book ${sk} appointment`,
      `best pharmacy for ${sk}`,
      `${sk} cost`,
      `${sk} prices`,
      `private ${sk} pharmacy`,
    ],
    informational: [
      `what is ${sn}`,
      `how does ${sn} work`,
      `who is eligible for ${sn}`,
      `is ${sn} available on NHS`,
      `${sn} vs GP`,
      ...intents.map((i) => `how to ${i}`),
    ],
    emergency: service.category === "prescription" || sn.toLowerCase().includes("emergency")
      ? [`urgent ${sk}`, `emergency ${sk}`, `${sk} today`, `${sk} open now`, `same day ${sk}`]
      : service.category === "nhs" || service.category === "private"
        ? [`same day ${sk}`, `${sk} walk in`, `${sk} without appointment`, `urgent ${sk} pharmacy`]
        : [`last minute ${sk}`, `${sk} today`, `${sk} open now`],
    local: [
      `${sk} [town]`,
      `${sn} [town]`,
      `pharmacy ${sk} [town]`,
      `${sk} [postcode]`,
      `local ${sk} service`,
      `${sn} near [landmark]`,
    ],
  };
}

function contentTopics(service) {
  const n = service.serviceName;
  const nk = n.toLowerCase();
  const blog = [
    `Complete guide to ${n} at UK community pharmacies`,
    `Who should use ${n} and when to see your GP instead`,
    `How ${n} works: step-by-step patient journey`,
    `NHS vs private options for ${nk}`,
    `Common myths about ${n} debunked`,
    `What to expect during your first ${nk} appointment`,
    `How pharmacists deliver ${n} safely`,
    `${n}: eligibility, cost and booking explained`,
    `Top questions patients ask about ${n}`,
    `How ${n} supports better health outcomes in your community`,
    `Preparing for ${n}: checklist for patients and carers`,
    `${n} and your medicines: what you need to know`,
    `Why local pharmacies are expanding ${nk} services`,
    `Patient stories: how ${n} helped avoid GP waits`,
    `${n} for families: what parents should know`,
    `Accessibility and ${n}: inclusive pharmacy care`,
    `${n} after hospital discharge: continuity of care`,
    `Digital booking and ${n}: modern pharmacy access`,
    `${n} in rural communities: pharmacy as front door care`,
    `Seasonal demand and planning ahead for ${nk}`,
  ];
  const gbp = [
    `Now offering ${n} — book your appointment today`,
    `Walk in for ${n} at our pharmacy`,
    `Free NHS ${nk} available here where eligible`,
    `Expert pharmacist-led ${nk} service`,
    `Same-day ${n} appointments available`,
    `Trusted local ${nk} — serving [area] families`,
    `Questions about ${n}? Speak to our pharmacist`,
    `New patients welcome for ${n}`,
    `${n} — convenient care on your high street`,
    `Book online for ${n} in minutes`,
  ];
  const facebook = [
    `Did you know you can get ${n} at your local pharmacy?`,
    `Skip the GP wait — ask us about ${n}`,
    `5 things to know before your ${nk} appointment`,
    `Our pharmacy team is here to help with ${n}`,
    `Open late? Ask about ${n} availability`,
    `Family-friendly ${n} support available here`,
    `Confused about ${n}? We explain it simply`,
    `Community health update: ${n} now available`,
    `Carers: how we support ${n} for your loved ones`,
    `Patient question answered: ${n} explained`,
  ];
  const linkedin = [
    `How community pharmacy ${n} reduces primary care pressure`,
    `The clinical role of pharmacists in ${nk}`,
    `Pharmacy First and the future of ${n}`,
    `Why ${n} belongs in neighbourhood healthcare strategy`,
    `Workforce training standards for ${n}`,
    `Patient access metrics: demand for ${nk} in primary care`,
    `Independent pharmacy differentiation through ${n}`,
    `Integrated care: pharmacy ${n} and GP collaboration`,
    `Regulatory compliance considerations for ${n}`,
    `Building trust in pharmacy-led ${nk} services`,
  ];
  const youtube = [
    `What is ${n}? Pharmacist explains in 60 seconds`,
    `Inside a pharmacy ${nk} appointment`,
    `How to prepare for ${n} at your local pharmacy`,
    `${n}: NHS eligibility explained`,
    `Patient journey: booking to completion for ${n}`,
    `Common mistakes people make with ${nk}`,
    `Pharmacist answers top ${n} questions`,
    `When to choose pharmacy ${n} vs your GP`,
    `${n} for carers: what you need to know`,
    `Behind the counter: how we deliver ${n} safely`,
  ];
  const email = [
    `Introducing ${n} at [Pharmacy Name]`,
    `Book your ${nk} appointment this week`,
    `Reminder: you may be eligible for ${n}`,
    `New service alert — ${n} now available`,
    `Prepare for your upcoming ${nk} visit`,
    `Follow-up care after your ${n} appointment`,
    `Seasonal reminder: don't forget ${n}`,
    `Carer newsletter: ${n} support for families`,
    `FAQ edition: your ${n} questions answered`,
    `Thank you for using our ${n} service — next steps`,
  ];
  return { blog, gbpPost: gbp, facebook, linkedin, youtube, email };
}

function aiSearchTopics(service) {
  const n = service.serviceName;
  const nk = n.toLowerCase();
  return {
    commonQuestions: [
      `Can I get ${n} at a pharmacy?`,
      `Is ${n} free on the NHS?`,
      `Do I need an appointment for ${n}?`,
      `How much does ${n} cost in the UK?`,
      `What is ${n} and who is it for?`,
      `Can a pharmacist provide ${n} without a GP?`,
      `Where can I find ${n} near me?`,
      `How long does ${n} take at a pharmacy?`,
    ],
    aiOverviewOpportunities: [
      `Explain ${n} in the context of UK community pharmacy clinical services`,
      `Compare pharmacy ${nk} with GP pathway — when to use each`,
      `Summarise NHS eligibility and cost for ${n}`,
      `Step-by-step: how to access ${n} at a local pharmacy`,
      `List qualifications and regulations governing ${n}`,
      `Patient safety and referral criteria for ${n}`,
    ],
    featuredSnippetOpportunities: [
      `What is ${n}?`,
      `How much does ${n} cost?`,
      `Is ${n} available on the NHS?`,
      `Who is eligible for ${n}?`,
      `Do you need an appointment for ${n}?`,
      `How long does ${n} take?`,
    ],
  };
}

function trustSignals(service) {
  const cat = service.category;
  return {
    serviceSpecificTrustFactors: [
      "GPhC-registered pharmacy premises",
      "Qualified pharmacist clinical oversight",
      "Private consultation room available",
      "Clear service information on website and in-store",
      ...(cat === "nhs" ? ["NHS commissioned service provider", "NHS service specification compliance"] : []),
      ...(cat === "travel" ? ["Destination-specific travel health expertise", "Vaccination record documentation"] : []),
      ...(cat === "vaccination" ? ["Cold chain storage compliance", "Anaphylaxis-trained staff"] : []),
      ...(cat === "prescription" ? ["Accurate dispensing protocols", "EPS integrated workflow"] : []),
      "Patient reviews citing helpful pharmacist advice",
      "Transparent pricing for private elements",
    ],
    complianceConsiderations: CATEGORY_COMPLIANCE[cat] ?? CATEGORY_COMPLIANCE.consultation,
    evidencePoints: [
      `Pharmacy team trained to deliver ${service.serviceName}`,
      "Documented clinical SOPs and safeguarding procedures",
      "Patient information leaflets and written advice provided",
      "Referral pathways to GP or A&E when red flags identified",
      "Service availability published with opening hours",
    ],
  };
}

function campaignInputs(service) {
  const sk = service.serviceKey;
  const sn = service.serviceName;
  const kw = (service.customerIntent ?? []).concat([sk.replace(/-/g, " "), sn.toLowerCase()]);
  return {
    hubGeneration: {
      pageType: "service-hub",
      primaryKeywordPattern: `{service} {location}`,
      primaryKeywordExamples: kw.slice(0, 5).map((k) => `${k} {location}`),
      supportingKeywords: kw,
      h1Pattern: `${sn} in {location}`,
      metaTitlePattern: `${sn} {location} | {pharmacyName}`,
      metaDescriptionPattern: `Professional ${sn.toLowerCase()} at {pharmacyName} in {location}. {usp}. Book online or walk in.`,
      sectionHints: ["service overview", "who it helps", "how it works", "eligibility and cost", "why choose us", "FAQs", "book appointment"],
      ctaPrimary: service.category === "prescription" ? "Order repeat prescription" : "Book appointment",
      ctaSecondary: "Speak to a pharmacist",
      schemaTypes: ["Pharmacy", "MedicalBusiness", "Service"],
    },
    clusterGeneration: {
      pageType: "service-cluster",
      clusterPatterns: [
        `{service} {neighbourhood}`,
        `{service} near {landmark}`,
        `{service} for {persona}`,
      ],
      localSignals: ["neighbourhood name", "nearby GP surgeries", "parking", "bus routes", "opening hours"],
      internalLinkToHub: true,
      wordCountTarget: "800-1200",
    },
    contentEngine: {
      assetTypes: ["blog_post", "facebook_post", "linkedin_post", "gbp_post", "reddit_post", "youtube_script", "youtube_metadata", "email_sequence"],
      campaignFocusKeyword: kw[0] ?? sk,
      linkedHubUrlPattern: `https://{domain}/{service-slug}-{location-slug}/`,
      contentSignals: ["service benefits", "patient FAQs", "local access", "trust signals", "NHS vs private clarity"],
      toneNotes: bi.generationHints?.tone ?? "Professional, reassuring, clinically credible",
      forbiddenClaims: bi.generationHints?.forbiddenClaims ?? [],
    },
    blogEngine: {
      primaryTopicCluster: sn,
      suggestedCategories: [service.category, "pharmacy advice", "local health"],
      internalLinkTargets: ["service hub", "related services", "booking page"],
      articleAngles: contentTopics(service).blog.slice(0, 5),
    },
    gbpEngine: {
      postTypes: ["service announcement", "seasonal reminder", "FAQ answer", "team spotlight", "booking CTA"],
      suggestedTopics: contentTopics(service).gbpPost,
      ctaTypes: ["BOOK", "LEARN_MORE", "CALL"],
      attributeHints: ["has_service", "opening_hours", "accessibility"],
    },
    aiSearchEngine: {
      targetQuestions: aiSearchTopics(service).commonQuestions,
      aiOverviewTargets: aiSearchTopics(service).aiOverviewOpportunities,
      snippetTargets: aiSearchTopics(service).featuredSnippetOpportunities,
      entityTags: [sn, "community pharmacy", "UK pharmacy", service.category],
      speakableSummaryPattern: `{pharmacyName} offers ${sn.toLowerCase()} in {location}. {oneSentenceBenefit}. Book online or visit our pharmacy.`,
    },
  };
}

function longDescription(service) {
  const n = service.serviceName;
  const cat = service.category;
  const catLabel = {
    prescription: "prescription and medicines supply",
    nhs: "NHS clinical services",
    private: "private pharmacy healthcare",
    travel: "travel health",
    vaccination: "vaccination and immunisation",
    "weight-management": "weight management",
    testing: "health testing and screening",
    consultation: "pharmacist consultation",
  }[cat] ?? "pharmacy care";

  return `${n} is a core ${catLabel} offering delivered by UK community pharmacies under GPhC regulation. ${service.description} Patients choose pharmacy-based ${n.toLowerCase()} for convenient local access, extended opening hours and professional medicines expertise without always needing a GP appointment. At campaign level, this service supports hub pages for "{service} {location}" searches, cluster pages for nearby areas, and Content Engine assets that explain eligibility, cost, booking and trust signals. Pharmacists provide clinical assessment, safety-netting and referral to GP or emergency care when symptoms fall outside the service scope. This intelligence profile is structured for hub generation, cluster generation, blog, GBP, social, email, YouTube and AI search optimisation without pre-generating page content.`;
}

function buildServiceProfile(service, linkIndex, serviceByKey) {
  const audience = CATEGORY_AUDIENCE[service.category] ?? CATEGORY_AUDIENCE.consultation;
  const gid = graphId(service.serviceKey);
  const related = linkIndex.related[service.serviceKey] ?? linkIndex.related[gid] ?? [];

  const dedupeLinks = (arr) => {
    const seen = new Set();
    return (arr ?? []).filter((x) => {
      if (seen.has(x.serviceKey)) return false;
      seen.add(x.serviceKey);
      return x.serviceKey !== service.serviceKey;
    });
  };

  const toLink = (key) => {
    const s = serviceByKey[key];
    if (!s || key === service.serviceKey) return null;
    return { serviceKey: key, label: s.serviceName };
  };

  const graphParent = dedupeLinks(linkIndex.parent[service.serviceKey] ?? linkIndex.parent[gid]);
  const graphSupporting = dedupeLinks(linkIndex.supporting[service.serviceKey] ?? linkIndex.supporting[gid]);
  const graphUpsell = dedupeLinks(linkIndex.upsell[service.serviceKey] ?? linkIndex.upsell[gid]);
  const graphRelated = dedupeLinks(related);

  const catParent = (CATEGORY_PARENT[service.category] ?? []).map(toLink).filter(Boolean);
  const catRelated = (CATEGORY_RELATED[service.category] ?? []).map(toLink).filter(Boolean);
  const catUpsell = (CATEGORY_UPSELL[service.category] ?? []).map(toLink).filter(Boolean);

  const mergeLinks = (...lists) => {
    const seen = new Set();
    const out = [];
    for (const list of lists) {
      for (const item of list) {
        if (item.serviceKey === service.serviceKey || seen.has(item.serviceKey)) continue;
        seen.add(item.serviceKey);
        out.push(item);
      }
    }
    return out;
  };

  return {
    serviceProfile: {
      serviceKey: service.serviceKey,
      serviceName: service.serviceName,
      category: service.category,
      groupKey: service.groupKey,
      shortDescription: service.description,
      longDescription: longDescription(service),
      customerIntent: service.customerIntent ?? [],
      primaryAudience: audience.primary,
      secondaryAudience: audience.secondary,
    },
    serviceBenefits: expandBenefits(service),
    problemsSolved: expandProblems(service),
    customerQuestions: generateFaqs(service),
    localSearchIntent: localSearchIntent(service),
    contentTopics: contentTopics(service),
    aiSearchTopics: aiSearchTopics(service),
    internalLinkingOpportunities: {
      parentServices: mergeLinks(graphParent, catParent).slice(0, 6),
      supportingServices: mergeLinks(graphSupporting).slice(0, 6),
      upsellServices: mergeLinks(graphUpsell, catUpsell).slice(0, 6),
      relatedServices: mergeLinks(graphRelated, catRelated).slice(0, 8),
    },
    trustSignals: trustSignals(service),
    campaignInputs: campaignInputs(service),
  };
}

const services = flattenServices();
const serviceByKey = Object.fromEntries(services.map((s) => [s.serviceKey, s]));
const linkIndex = buildLinkIndex();
const serviceLibrary = {};

for (const service of services) {
  serviceLibrary[service.serviceKey] = buildServiceProfile(service, linkIndex, serviceByKey);
}

const output = {
  schemaVersion: "1.0",
  industryType: "pharmacy",
  phase: "service-intelligence-layer",
  generatedAt: new Date().toISOString(),
  sourceFile: "output/pharmacy-blueprint/business-intelligence.json",
  purpose: "Campaign-ready service blueprint library for hub, cluster, Content Engine, blog, GBP, social, email, YouTube and AI search generation. Intelligence only — no pages, content or campaigns.",
  summary: {
    totalServices: services.length,
    categories: Object.fromEntries(
      Object.entries(
        services.reduce((acc, s) => {
          acc[s.category] = (acc[s.category] ?? 0) + 1;
          return acc;
        }, {}),
      ),
    ),
    minimums: {
      benefitsPerService: 10,
      problemsPerService: 10,
      faqsPerService: 20,
      blogTopicsPerService: 20,
      gbpTopicsPerService: 10,
      facebookTopicsPerService: 10,
      linkedinTopicsPerService: 10,
      youtubeTopicsPerService: 10,
      emailTopicsPerService: 10,
    },
  },
  services: serviceLibrary,
  serviceIndex: services.map((s) => ({
    serviceKey: s.serviceKey,
    serviceName: s.serviceName,
    category: s.category,
    groupKey: s.groupKey,
  })),
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");

// Validation
let pass = true;
for (const s of services) {
  const p = serviceLibrary[s.serviceKey];
  if (p.serviceBenefits.length < 10) { console.error(`FAIL benefits: ${s.serviceKey} (${p.serviceBenefits.length})`); pass = false; }
  if (p.problemsSolved.length < 10) { console.error(`FAIL problems: ${s.serviceKey} (${p.problemsSolved.length})`); pass = false; }
  if (p.customerQuestions.length < 20) { console.error(`FAIL faqs: ${s.serviceKey} (${p.customerQuestions.length})`); pass = false; }
  if (p.contentTopics.blog.length < 20) { console.error(`FAIL blog: ${s.serviceKey}`); pass = false; }
}

console.log(`Written: ${OUT_PATH}`);
console.log(`Services: ${services.length} | Validation: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
