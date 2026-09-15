#!/usr/bin/env node
/**
 * Phase 4 — Pharmacy Service Template Architecture
 * Maps 62 pharmacy services to 5 template families. Architecture only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BI_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "business-intelligence.json");
const SI_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "service-intelligence.json");
const CAMPAIGN_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "campaign-blueprints", "pharmacy-first-rotherham.json");
const ARCH_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "template-architecture.json");
const REPORT_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "pharmacy-template-architecture-report.json");

function section(key, name, purpose, opts = {}) {
  return {
    sectionKey: key,
    sectionName: name,
    sectionPurpose: purpose,
    contentInputsRequired: opts.contentInputsRequired ?? [],
    dynamicTokens: opts.dynamicTokens ?? ["{serviceName}", "{location}", "{pharmacyName}"],
    recommendedWordCount: opts.recommendedWordCount ?? "80-150",
    schemaUse: opts.schemaUse ?? false,
    ctaUse: opts.ctaUse ?? false,
    internalLinkUse: opts.internalLinkUse ?? false,
    imageUse: opts.imageUse ?? null,
    complianceNotes: opts.complianceNotes ?? [],
  };
}

function buildSectionsClinicalNhs() {
  return [
    section("hero", "Hero", "Immediate service recognition and same-day access promise", { contentInputsRequired: ["heroPositioning", "primaryKeyword", "keyBenefits"], dynamicTokens: ["{serviceName}", "{location}", "{pharmacyName}", "{primaryKeyword}"], recommendedWordCount: "40-80", schemaUse: true, ctaUse: true, imageUse: "hero", complianceNotes: ["NHS eligibility qualifier required where applicable"] }),
    section("service-overview", "Service Overview", "Explain NHS/clinical service scope in plain language", { contentInputsRequired: ["shortDescription", "longDescription"], recommendedWordCount: "120-180", schemaUse: true }),
    section("who-this-helps", "Who This Service Helps", "Primary and secondary audience framing", { contentInputsRequired: ["primaryAudience", "secondaryAudience", "customerPersonas"], internalLinkUse: false, recommendedWordCount: "80-120" }),
    section("conditions-scope", "Conditions or Service Scope", "List pathways, conditions or service boundaries", { contentInputsRequired: ["conditionsList", "serviceScope", "problemsSolved"], recommendedWordCount: "100-160", complianceNotes: ["Only list commissioned/eligible pathways"] }),
    section("how-it-works", "How It Works", "Step-by-step patient journey from arrival to outcome", { contentInputsRequired: ["processSteps"], recommendedWordCount: "120-180", ctaUse: true }),
    section("eligibility-cost", "Eligibility and Cost", "NHS entitlement, exemptions and private elements", { contentInputsRequired: ["eligibilityRules", "costGuidance"], recommendedWordCount: "100-150", complianceNotes: ["NHS logo rules", "No universal free claims without eligibility"] }),
    section("benefits", "Key Benefits", "Patient outcomes and access benefits", { contentInputsRequired: ["serviceBenefits"], recommendedWordCount: "80-140" }),
    section("problems-solved", "Problems We Solve", "Pain points addressed by pharmacy access", { contentInputsRequired: ["problemsSolved"], recommendedWordCount: "80-140" }),
    section("why-choose-us", "Why Choose Our Pharmacy", "Local trust, team credentials, consultation room", { contentInputsRequired: ["trustSignals", "evidencePoints", "localProof"], recommendedWordCount: "100-150", imageUse: "trust" }),
    section("areas-we-cover", "Areas We Cover", "Cluster links for local SEO neighbourhoods", { contentInputsRequired: ["clusterBlueprints", "location"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("related-services", "Related NHS Services", "Cross-link supporting and upsell NHS services", { contentInputsRequired: ["internalLinkingOpportunities"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("trust-compliance", "Trust and Safety", "GPhC, safeguarding, referral pathways", { contentInputsRequired: ["trustSignals", "complianceGuardrails"], recommendedWordCount: "80-120", complianceNotes: ["Red flag referral language mandatory"] }),
    section("faq", "Frequently Asked Questions", "Service-specific FAQ with schema", { contentInputsRequired: ["customerQuestions", "faqSet"], recommendedWordCount: "300-600", schemaUse: true }),
    section("cta-primary", "Book or Visit Today", "Walk-in, phone and appointment CTAs", { contentInputsRequired: ["ctaStrategy"], ctaUse: true, recommendedWordCount: "40-80" }),
  ];
}

function buildSectionsPrivateHealthcare() {
  return [
    section("hero", "Hero", "Private service value proposition and booking path", { contentInputsRequired: ["heroPositioning", "primaryKeyword"], ctaUse: true, imageUse: "hero", recommendedWordCount: "40-80" }),
    section("service-overview", "Service Overview", "What the private service includes", { contentInputsRequired: ["shortDescription", "longDescription"], schemaUse: true, recommendedWordCount: "120-180" }),
    section("who-this-helps", "Who This Service Is For", "Ideal patient profiles and suitability", { contentInputsRequired: ["primaryAudience", "secondaryAudience"], recommendedWordCount: "80-120" }),
    section("what-to-expect", "What to Expect", "Appointment flow, duration, preparation", { contentInputsRequired: ["processSteps", "preparationGuidance"], recommendedWordCount: "120-160" }),
    section("benefits", "Benefits of Choosing Us", "Speed, discretion, expertise, convenience", { contentInputsRequired: ["serviceBenefits"], recommendedWordCount: "80-140" }),
    section("pricing-transparency", "Pricing and Packages", "Transparent fees where publishable", { contentInputsRequired: ["pricingGuidance"], recommendedWordCount: "80-120", complianceNotes: ["Publish clear private fees", "No hidden cost implication"] }),
    section("clinical-standards", "Clinical Standards", "Qualifications, equipment, hygiene protocols", { contentInputsRequired: ["trustSignals", "evidencePoints"], imageUse: "trust", recommendedWordCount: "100-140" }),
    section("preparation", "How to Prepare", "Before-appointment checklist", { contentInputsRequired: ["preparationChecklist"], recommendedWordCount: "80-120" }),
    section("results-follow-up", "Results and Follow-Up", "Turnaround times, GP referral, next steps", { contentInputsRequired: ["followUpGuidance"], recommendedWordCount: "80-120", complianceNotes: ["Diagnostic limits — not a substitute for GP diagnosis"] }),
    section("areas-we-cover", "Areas We Serve", "Local cluster coverage", { contentInputsRequired: ["clusterBlueprints"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("related-services", "Related Private Services", "Cross-sell complementary private care", { contentInputsRequired: ["internalLinkingOpportunities"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("faq", "Frequently Asked Questions", "Private service FAQs", { contentInputsRequired: ["customerQuestions"], schemaUse: true, recommendedWordCount: "300-500" }),
    section("cta-booking", "Book Your Appointment", "Primary booking and phone CTAs", { contentInputsRequired: ["ctaStrategy"], ctaUse: true, recommendedWordCount: "40-80" }),
  ];
}

function buildSectionsTravelHealth() {
  return [
    section("hero", "Hero", "Travel health urgency and consultation booking", { contentInputsRequired: ["heroPositioning", "primaryKeyword"], ctaUse: true, imageUse: "hero", recommendedWordCount: "40-80" }),
    section("service-overview", "Travel Health Overview", "Scope of travel clinic services", { contentInputsRequired: ["shortDescription"], schemaUse: true, recommendedWordCount: "100-150" }),
    section("destination-advice", "Destination Health Advice", "Country-specific risk framing", { contentInputsRequired: ["destinationGuidance", "itineraryInputs"], recommendedWordCount: "120-180" }),
    section("vaccines-required", "Vaccines and Medicines You May Need", "Linked vaccine and malaria pathways", { contentInputsRequired: ["vaccineSchedule", "relatedServices"], internalLinkUse: true, recommendedWordCount: "120-180" }),
    section("how-it-works", "How Our Travel Clinic Works", "Consult → plan → vaccinate → certify", { contentInputsRequired: ["processSteps"], recommendedWordCount: "100-150", ctaUse: true }),
    section("timing-schedule", "When to Book Before Travel", "Lead times and multi-dose courses", { contentInputsRequired: ["timingGuidance"], recommendedWordCount: "80-120", complianceNotes: ["Last-minute travel limitations"] }),
    section("pricing", "Travel Clinic Pricing", "Consultation and vaccine fee transparency", { contentInputsRequired: ["pricingGuidance"], recommendedWordCount: "80-120" }),
    section("certificates", "Certificates and Documentation", "Yellow fever ICVP and records", { contentInputsRequired: ["certificateGuidance"], complianceNotes: ["Yellow fever centre accreditation only if certified"] }),
    section("benefits", "Why Use Our Travel Clinic", "Convenience vs GP travel clinic waits", { contentInputsRequired: ["serviceBenefits"], recommendedWordCount: "80-120" }),
    section("areas-we-cover", "Serving Local Travellers", "Cluster geography for local SEO", { contentInputsRequired: ["clusterBlueprints"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("related-travel-services", "Related Travel Services", "Malaria, rabies, first aid kits", { contentInputsRequired: ["internalLinkingOpportunities"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("faq", "Travel Health FAQs", "Destination, cost, timing questions", { contentInputsRequired: ["customerQuestions"], schemaUse: true, recommendedWordCount: "300-500" }),
    section("cta-consultation", "Book Travel Consultation", "Consultation booking CTA", { contentInputsRequired: ["ctaStrategy"], ctaUse: true, recommendedWordCount: "40-80" }),
  ];
}

function buildSectionsWeightManagement() {
  return [
    section("hero", "Hero", "Safe medically supported weight management positioning", { contentInputsRequired: ["heroPositioning"], ctaUse: true, imageUse: "hero", recommendedWordCount: "40-80", complianceNotes: ["No guaranteed weight loss claims"] }),
    section("service-overview", "Weight Management Overview", "Programme scope and medical supervision", { contentInputsRequired: ["shortDescription"], schemaUse: true, recommendedWordCount: "100-150" }),
    section("who-eligible", "Who May Be Eligible", "BMI, comorbidities, clinical criteria", { contentInputsRequired: ["eligibilityRules"], recommendedWordCount: "100-140", complianceNotes: ["NICE-aligned eligibility language"] }),
    section("programme-structure", "Our Programme Structure", "Consultation, monitoring, lifestyle, pharmacotherapy", { contentInputsRequired: ["programmeSteps"], recommendedWordCount: "120-180" }),
    section("glp1-pathway", "Medical Treatment Options", "GLP-1 where legally supplied — eligibility only", { contentInputsRequired: ["treatmentOptions"], recommendedWordCount: "100-150", complianceNotes: ["POM advertising restrictions", "No outcome guarantees"] }),
    section("lifestyle-support", "Lifestyle and Nutrition Support", "Behaviour change alongside medical pathway", { contentInputsRequired: ["lifestyleGuidance"], recommendedWordCount: "100-140" }),
    section("monitoring", "Progress Monitoring", "BMI, check-ins, accountability", { contentInputsRequired: ["monitoringPlan"], recommendedWordCount: "80-120" }),
    section("benefits", "Benefits of Pharmacy-Led Support", "Local access, supervised care, continuity", { contentInputsRequired: ["serviceBenefits"], recommendedWordCount: "80-120" }),
    section("pricing", "Programme Fees", "Consultation and programme pricing transparency", { contentInputsRequired: ["pricingGuidance"], recommendedWordCount: "80-120" }),
    section("trust-safety", "Trust and Clinical Safety", "Pharmacist oversight, safeguarding, referrals", { contentInputsRequired: ["trustSignals"], imageUse: "trust", recommendedWordCount: "80-120" }),
    section("areas-we-cover", "Areas We Serve", "Local cluster links", { contentInputsRequired: ["clusterBlueprints"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("faq", "Weight Management FAQs", "Eligibility, GLP-1, cost, safety", { contentInputsRequired: ["customerQuestions"], schemaUse: true, recommendedWordCount: "300-500" }),
    section("cta-assessment", "Book Eligibility Assessment", "Assessment booking and lead form", { contentInputsRequired: ["ctaStrategy"], ctaUse: true, recommendedWordCount: "40-80" }),
  ];
}

function buildSectionsVaccination() {
  return [
    section("hero", "Hero", "Vaccination availability and booking/walk-in", { contentInputsRequired: ["heroPositioning"], ctaUse: true, imageUse: "hero", recommendedWordCount: "40-80" }),
    section("service-overview", "Vaccination Service Overview", "NHS vs private programme clarity", { contentInputsRequired: ["shortDescription"], schemaUse: true, recommendedWordCount: "100-150", complianceNotes: ["Distinguish NHS eligibility from private supply"] }),
    section("who-eligible", "Who Can Get Vaccinated", "Age, clinical group, NHS eligibility", { contentInputsRequired: ["eligibilityRules"], recommendedWordCount: "100-140" }),
    section("vaccine-detail", "About This Vaccination", "Disease protection, schedule, boosters", { contentInputsRequired: ["vaccineFacts"], recommendedWordCount: "120-160" }),
    section("how-it-works", "How to Get Vaccinated", "Book, walk-in, course scheduling", { contentInputsRequired: ["processSteps"], ctaUse: true, recommendedWordCount: "80-120" }),
    section("side-effects", "What to Expect After Vaccination", "Common side effects and safety-netting", { contentInputsRequired: ["aftercareGuidance"], recommendedWordCount: "80-120", complianceNotes: ["MHRA Yellow Card signposting where appropriate"] }),
    section("pricing", "Cost and NHS Eligibility", "Free NHS vs private fee", { contentInputsRequired: ["pricingGuidance"], recommendedWordCount: "80-120" }),
    section("benefits", "Why Get Vaccinated Locally", "Convenience, community access, hours", { contentInputsRequired: ["serviceBenefits"], recommendedWordCount: "80-120" }),
    section("seasonal-timing", "When to Vaccinate", "Seasonal campaigns and booking windows", { contentInputsRequired: ["seasonalGuidance"], recommendedWordCount: "60-100" }),
    section("areas-we-cover", "Areas We Serve", "Local cluster SEO", { contentInputsRequired: ["clusterBlueprints"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("related-vaccines", "Other Vaccinations Available", "Cross-link vaccine portfolio", { contentInputsRequired: ["internalLinkingOpportunities"], internalLinkUse: true, recommendedWordCount: "60-100" }),
    section("faq", "Vaccination FAQs", "Eligibility, booking, side effects", { contentInputsRequired: ["customerQuestions"], schemaUse: true, recommendedWordCount: "300-500" }),
    section("cta-book-jab", "Book Your Vaccination", "Booking and walk-in CTAs", { contentInputsRequired: ["ctaStrategy"], ctaUse: true, recommendedWordCount: "40-80" }),
  ];
}

const CONTENT_RULES = {
  "clinical-nhs-services": {
    wordsToUse: ["NHS", "pharmacist-led", "same-day", "walk-in", "consultation", "where eligible", "where clinically appropriate", "private consultation room", "refer to GP", "free at point of care"],
    wordsToAvoid: ["guaranteed cure", "replace your GP", "always free", "instant antibiotics", "skip the doctor", "cheapest", "miracle"],
    claimsToAvoid: ["Universal NHS entitlement", "All conditions treated", "No need for GP ever", "Guaranteed same-day treatment"],
    complianceWarnings: ["Pharmacy First pathway limits", "PGD scope boundaries", "Safeguarding for minors", "POM supply rules"],
    requiredDisclaimers: ["Not for emergencies — call 999", "Individual assessment required", "GP referral when red flags present"],
    recommendedProofPoints: ["GPhC registration", "NHS service provider", "Trained clinical team", "Private consultation room"],
  },
  "private-healthcare-services": {
    wordsToUse: ["book appointment", "private consultation", "transparent pricing", "qualified clinician", "discreet", "professional", "fast access"],
    wordsToAvoid: ["NHS free", "guaranteed results", "cheapest", "DIY", "miracle cure"],
    claimsToAvoid: ["Clinical outcome guarantees", "Before/after promises", "Unsubstantiated cheapest claims"],
    complianceWarnings: ["POM advertising ban", "Diagnostic test limits", "Cosmetic/medical boundary"],
    requiredDisclaimers: ["Private fees apply", "Not a substitute for emergency care", "Results interpretation limits for screening"],
    recommendedProofPoints: ["Clear pricing", "Qualified staff", "Hygiene standards", "Patient reviews"],
  },
  "travel-health-services": {
    wordsToUse: ["travel consultation", "destination-specific", "itinerary", "certificate", "malaria prophylaxis", "vaccination schedule", "book before travel"],
    wordsToAvoid: ["all destinations covered without assessment", "guaranteed entry", "no consultation needed"],
    claimsToAvoid: ["Guaranteed visa/entry approval", "One vaccine fits all destinations"],
    complianceWarnings: ["Yellow fever centre accreditation", "Cold chain", "Last-minute travel limits"],
    requiredDisclaimers: ["Requirements vary by destination", "Consultation required for personalised advice"],
    recommendedProofPoints: ["Travel health trained staff", "Certificate issuance", "Vaccine record keeping"],
  },
  "weight-management-services": {
    wordsToUse: ["medically supervised", "eligibility assessment", "sustainable", "BMI monitoring", "lifestyle support", "NICE-aligned"],
    wordsToAvoid: ["guaranteed weight loss", "rapid results", "miracle", "without assessment", "cheapest GLP-1"],
    claimsToAvoid: ["Fixed kg loss promises", "Off-label promotion", "Comparison to unregulated online suppliers without context"],
    complianceWarnings: ["GLP-1 legal supply frameworks", "POM advertising", "Mental health sensitivity"],
    requiredDisclaimers: ["Individual results vary", "Clinical eligibility required", "Not emergency eating disorder care"],
    recommendedProofPoints: ["Pharmacist supervision", "Regular monitoring", "Structured programme"],
  },
  "vaccination-services": {
    wordsToUse: ["book vaccination", "walk-in", "NHS eligible", "private jab", "protection", "seasonal", "qualified vaccinator"],
    wordsToAvoid: ["100% protection", "no side effects", "mandatory", "guaranteed immunity"],
    claimsToAvoid: ["Absolute immunity claims", "Anti-GP framing", "Unqualified NHS free for all without eligibility"],
    complianceWarnings: ["JCVI programme rules", "Anaphylaxis protocols", "Age restrictions"],
    requiredDisclaimers: ["Eligibility varies", "Common side effects possible", "Seek urgent care for severe reaction"],
    recommendedProofPoints: ["NHS or private programme clarity", "Cold chain compliance", "Booking availability"],
  },
};

function baseTemplate(key, name, purpose, opts) {
  return {
    templateKey: key,
    templateName: name,
    purpose,
    serviceCategories: opts.serviceCategories,
    includedServices: opts.includedServices ?? [],
    excludedServices: opts.excludedServices ?? [],
    primaryIntent: opts.primaryIntent,
    secondaryIntents: opts.secondaryIntents ?? [],
    conversionGoals: opts.conversionGoals,
    complianceLevel: opts.complianceLevel,
    pageTone: opts.pageTone,
    trustPositioning: opts.trustPositioning,
    recommendedSchemaTypes: opts.recommendedSchemaTypes,
    requiredSections: opts.requiredSections,
    optionalSections: opts.optionalSections ?? [],
    ctaStrategy: opts.ctaStrategy,
    faqStrategy: opts.faqStrategy,
    internalLinkingStrategy: opts.internalLinkingStrategy,
    aiSearchStrategy: opts.aiSearchStrategy,
    contentEngineHooks: opts.contentEngineHooks,
    imageStrategy: opts.imageStrategy,
    localSeoStrategy: opts.localSeoStrategy,
    contentRules: CONTENT_RULES[key],
    sections: opts.sections,
  };
}

const TEMPLATE_FAMILIES = [
  baseTemplate("clinical-nhs-services", "Clinical NHS Services", "NHS and core clinical pharmacy access pages for same-day care, dispensing support and commissioned pathways.", {
    serviceCategories: ["nhs", "prescription", "consultation", "testing"],
    excludedServices: ["private-only retail", "travel-only", "standalone vaccination programmes", "weight-management programmes"],
    primaryIntent: "Can the pharmacy help me today?",
    secondaryIntents: ["Can I avoid a GP wait?", "Is this an NHS service?", "Can I walk in?", "What conditions are covered?"],
    conversionGoals: ["walk-in visit", "phone call", "appointment request"],
    complianceLevel: "nhs-clinical-service",
    pageTone: "Reassuring, accessible, clinically credible, NHS-aware, safety-first",
    trustPositioning: "GPhC-registered NHS pharmacy with pharmacist-led care and clear GP/A&E referral pathways",
    recommendedSchemaTypes: ["Pharmacy", "MedicalBusiness", "Service", "FAQPage", "MedicalWebPage"],
    requiredSections: ["hero", "service-overview", "how-it-works", "eligibility-cost", "faq", "cta-primary"],
    optionalSections: ["conditions-scope", "areas-we-cover", "related-services", "trust-compliance"],
    ctaStrategy: { primary: "Walk in today", secondary: "Call the pharmacy", tertiary: "Book appointment", placement: ["hero", "how-it-works", "footer"] },
    faqStrategy: { minCount: 10, schema: "FAQPage", includeNhsEligibility: true, includeReferralGuidance: true },
    internalLinkingStrategy: { hubToClusters: true, clusterToHub: true, relatedNhsServices: true, maxContextualLinks: 10 },
    aiSearchStrategy: { targetSpeakable: true, featuredSnippets: ["eligibility", "cost", "conditions", "walk-in"], aiOverviewFocus: "NHS pharmacy clinical access" },
    contentEngineHooks: { assetTypes: ["blog_post", "gbp_post", "facebook_post", "youtube_script"], focus: "access-without-GP-wait", tone: biPlaceholder("tone") },
    imageStrategy: { hero: "pharmacist consultation room", support: "NHS clinical service in pharmacy", trust: "GPhC credentials and team", conversion: "walk-in or phone CTA scene" },
    localSeoStrategy: { hubPattern: "{service}-{location}", clusterPattern: "{service}-{area}", keywords: ["NHS", "walk-in", "same-day", "near me"] },
    sections: buildSectionsClinicalNhs(),
  }),
  baseTemplate("private-healthcare-services", "Private Healthcare Services", "Private fee-based clinical and screening services requiring appointment-led conversion.", {
    serviceCategories: ["private", "testing"],
    excludedServices: ["NHS commissioned-only pathways without private option"],
    primaryIntent: "I need a private healthcare service.",
    secondaryIntents: ["How much does it cost?", "Can I book without GP referral?", "How quickly can I be seen?"],
    conversionGoals: ["appointment booking", "phone call", "lead form"],
    complianceLevel: "private-healthcare",
    pageTone: "Professional, discreet, transparent, premium-accessible",
    trustPositioning: "Qualified private clinic standards within a regulated pharmacy setting",
    recommendedSchemaTypes: ["Pharmacy", "MedicalBusiness", "Service", "FAQPage"],
    requiredSections: ["hero", "service-overview", "pricing-transparency", "faq", "cta-booking"],
    optionalSections: ["results-follow-up", "preparation", "areas-we-cover"],
    ctaStrategy: { primary: "Book appointment", secondary: "Call for availability", tertiary: "Request callback", placement: ["hero", "pricing", "footer"] },
    faqStrategy: { minCount: 8, includePricing: true, includePreparation: true },
    internalLinkingStrategy: { hubToClusters: true, relatedPrivateServices: true, upsellScreeningPackages: true },
    aiSearchStrategy: { featuredSnippets: ["cost", "how it works", "booking"], localIntent: "private {service} {location}" },
    contentEngineHooks: { assetTypes: ["blog_post", "gbp_post", "email_sequence"], focus: "private-access-and-pricing" },
    imageStrategy: { hero: "private consultation", support: "clinical procedure setting", trust: "credentials and clean room", conversion: "booking confirmation" },
    localSeoStrategy: { hubPattern: "{service}-{location}", keywords: ["private", "book", "appointment", "cost"] },
    sections: buildSectionsPrivateHealthcare(),
  }),
  baseTemplate("travel-health-services", "Travel Health Services", "Destination-led travel clinic pages for vaccines, malaria and travel medicine advice.", {
    serviceCategories: ["travel"],
    primaryIntent: "What vaccines or travel medicines do I need?",
    secondaryIntents: ["When should I book?", "How much will it cost?", "Do I need yellow fever certificate?"],
    conversionGoals: ["travel consultation booking", "vaccination appointment", "phone enquiry"],
    complianceLevel: "travel-clinic",
    pageTone: "Expert, advisory, itinerary-focused, practical",
    trustPositioning: "Destination-aware travel clinic with documented vaccination records",
    recommendedSchemaTypes: ["Pharmacy", "MedicalBusiness", "Service", "FAQPage"],
    requiredSections: ["hero", "destination-advice", "how-it-works", "timing-schedule", "faq", "cta-consultation"],
    optionalSections: ["certificates", "related-travel-services"],
    ctaStrategy: { primary: "Book travel consultation", secondary: "Call travel clinic", placement: ["hero", "timing-schedule"] },
    faqStrategy: { minCount: 8, includeDestination: true, includeTiming: true },
    internalLinkingStrategy: { travelConsultToVaccines: true, malariaCoPrescribe: true, clusterLocalTravellers: true },
    aiSearchStrategy: { featuredSnippets: ["vaccines for {country}", "when to book", "malaria tablets"], aiOverviewFocus: "travel health planning" },
    contentEngineHooks: { assetTypes: ["blog_post", "youtube_script", "gbp_post"], focus: "destination-guides" },
    imageStrategy: { hero: "travel health consultation", support: "world map / itinerary", trust: "vaccination certificate", conversion: "consultation booking" },
    localSeoStrategy: { keywords: ["travel clinic", "travel vaccinations", "malaria tablets", "{location}"] },
    sections: buildSectionsTravelHealth(),
  }),
  baseTemplate("weight-management-services", "Weight Management Services", "Medically supervised weight management and GLP-1 programme pages.", {
    serviceCategories: ["weight-management"],
    primaryIntent: "Can you help me lose weight safely?",
    secondaryIntents: ["Am I eligible?", "Do you offer GLP-1?", "What does the programme include?"],
    conversionGoals: ["eligibility assessment", "consultation booking", "lead form"],
    complianceLevel: "weight-management-clinical",
    pageTone: "Supportive, non-judgemental, evidence-based, medically supervised",
    trustPositioning: "Pharmacy-supervised programme with monitoring — not fad dieting",
    recommendedSchemaTypes: ["Pharmacy", "MedicalBusiness", "Service", "FAQPage"],
    requiredSections: ["hero", "who-eligible", "programme-structure", "faq", "cta-assessment"],
    optionalSections: ["glp1-pathway", "monitoring", "lifestyle-support"],
    ctaStrategy: { primary: "Book eligibility assessment", secondary: "Request programme info", placement: ["hero", "who-eligible", "footer"] },
    faqStrategy: { minCount: 8, includeEligibility: true, includeGlp1: true, noOutcomeGuarantees: true },
    internalLinkingStrategy: { linkHealthyLiving: true, linkBmiMonitoring: true, hubClusterLocal: true },
    aiSearchStrategy: { featuredSnippets: ["eligibility", "GLP-1 pharmacy", "programme cost"], caution: "no weight loss guarantees" },
    contentEngineHooks: { assetTypes: ["blog_post", "email_sequence", "facebook_post"], focus: "safe-supervised-weight-management" },
    imageStrategy: { hero: "supportive consultation", support: "BMI monitoring", trust: "pharmacist supervision", conversion: "assessment booking" },
    localSeoStrategy: { keywords: ["weight management", "weight loss pharmacy", "GLP-1", "{location}"] },
    sections: buildSectionsWeightManagement(),
  }),
  baseTemplate("vaccination-services", "Vaccination Services", "Immunisation pages for NHS and private vaccine programmes.", {
    serviceCategories: ["vaccination", "nhs"],
    includedServices: ["NHS and private immunisation programmes"],
    primaryIntent: "Can I get vaccinated here?",
    secondaryIntents: ["Am I eligible for NHS jab?", "Can I walk in?", "How much is private vaccine?"],
    conversionGoals: ["vaccination booking", "phone enquiry", "walk-in visit where appropriate"],
    complianceLevel: "vaccination-programme",
    pageTone: "Clear, seasonal, public-health aligned, accessible",
    trustPositioning: "Registered vaccinators with NHS programme alignment and safe storage",
    recommendedSchemaTypes: ["Pharmacy", "MedicalBusiness", "Service", "FAQPage"],
    requiredSections: ["hero", "who-eligible", "how-it-works", "pricing", "faq", "cta-book-jab"],
    optionalSections: ["seasonal-timing", "related-vaccines"],
    ctaStrategy: { primary: "Book vaccination", secondary: "Walk in for flu jab", tertiary: "Call for availability", placement: ["hero", "seasonal-timing"] },
    faqStrategy: { minCount: 8, includeEligibility: true, includeSideEffects: true },
    internalLinkingStrategy: { crossLinkVaccinePortfolio: true, seasonalCampaignLinks: true },
    aiSearchStrategy: { featuredSnippets: ["free flu jab eligibility", "walk in", "side effects"], speakable: "vaccination availability {location}" },
    contentEngineHooks: { assetTypes: ["gbp_post", "facebook_post", "email_sequence"], focus: "seasonal-immunisation" },
    imageStrategy: { hero: "vaccination in pharmacy", support: "seasonal campaign", trust: "trained vaccinator", conversion: "booking jab" },
    localSeoStrategy: { keywords: ["flu jab", "vaccination", "walk in", "{location}"] },
    sections: buildSectionsVaccination(),
  }),
];

function biPlaceholder(field) {
  return `{businessIntelligence.generationHints.${field}}`;
}

/** Explicit service → template mapping with confidence */
const SERVICE_TEMPLATE_MAP = {
  // Prescription → Clinical NHS (core pharmacy access)
  "prescription-dispensing": { template: "clinical-nhs-services", reason: "Core NHS medicines supply and dispensing access", confidence: 0.95 },
  "electronic-prescription-service-eps": { template: "clinical-nhs-services", reason: "NHS EPS infrastructure for prescription access", confidence: 0.95 },
  "repeat-prescription-service": { template: "clinical-nhs-services", reason: "NHS repeat medicines access workflow", confidence: 0.95 },
  "prescription-delivery": { template: "clinical-nhs-services", reason: "NHS prescription fulfilment and patient access", confidence: 0.9 },
  "blister-packs-and-compliance-aids": { template: "clinical-nhs-services", reason: "Medicines compliance support within NHS care", confidence: 0.9 },
  "emergency-supply": { template: "clinical-nhs-services", reason: "Urgent medicines access — same-day pharmacy help", confidence: 0.95 },
  "prescription-collection-service": { template: "clinical-nhs-services", reason: "Prescription access coordination", confidence: 0.9 },
  "private-prescription-dispensing": { template: "private-healthcare-services", reason: "Private fee-based prescription supply", confidence: 0.95 },
  // NHS clinical
  "pharmacy-first": { template: "clinical-nhs-services", reason: "Flagship NHS Advanced Service for minor illness", confidence: 1.0 },
  "nhs-blood-pressure-checks": { template: "clinical-nhs-services", reason: "NHS Hypertension Case Finding commissioned service", confidence: 1.0 },
  "nhs-new-medicine-service-nms": { template: "clinical-nhs-services", reason: "NHS Advanced Service for new medicine support", confidence: 1.0 },
  "pharmacy-contraception-service": { template: "clinical-nhs-services", reason: "NHS commissioned contraception pathway", confidence: 1.0 },
  "nhs-smoking-cessation-support": { template: "clinical-nhs-services", reason: "NHS public health cessation programme", confidence: 0.95 },
  "discharge-medicines-service": { template: "clinical-nhs-services", reason: "NHS hospital discharge reconciliation service", confidence: 1.0 },
  "supervised-consumption": { template: "clinical-nhs-services", reason: "NHS clinical supervision service", confidence: 0.95 },
  "palliative-care-dispensing": { template: "clinical-nhs-services", reason: "Priority NHS medicines access for end-of-life care", confidence: 0.95 },
  "hepatitis-c-testing-and-referral": { template: "clinical-nhs-services", reason: "NHS commissioned screening and referral pathway", confidence: 0.9 },
  "nhs-flu-vaccination": { template: "vaccination-services", reason: "NHS seasonal immunisation programme", confidence: 1.0 },
  // Private
  "private-health-consultations": { template: "private-healthcare-services", reason: "Private appointment-led clinical consultations", confidence: 1.0 },
  "private-ear-wax-removal": { template: "private-healthcare-services", reason: "Private clinical procedure service", confidence: 1.0 },
  "private-blood-testing": { template: "private-healthcare-services", reason: "Private health screening and diagnostics", confidence: 1.0 },
  "vitamin-b12-injections": { template: "private-healthcare-services", reason: "Private injectable treatment service", confidence: 1.0 },
  "emergency-hormonal-contraception": { template: "private-healthcare-services", reason: "Private/emergency contraception access — appointment-led", confidence: 0.95 },
  "private-minor-ailment-treatment": { template: "private-healthcare-services", reason: "Private PGD-led treatment outside NHS pathway", confidence: 0.9 },
  "compounding-and-specialist-supply": { template: "private-healthcare-services", reason: "Specialist private medicines supply", confidence: 0.9 },
  "private-prescription-service-fees": { template: "private-healthcare-services", reason: "Private dispensing fee transparency", confidence: 0.95 },
  // Travel
  "travel-health-consultation": { template: "travel-health-services", reason: "Destination travel health advisory hub", confidence: 1.0 },
  "travel-vaccinations": { template: "travel-health-services", reason: "Travel immunisation core service", confidence: 1.0 },
  "malaria-prophylaxis": { template: "travel-health-services", reason: "Travel medicine prescribing pathway", confidence: 1.0 },
  "travel-first-aid-and-kit-supply": { template: "travel-health-services", reason: "Travel health retail adjunct", confidence: 0.85 },
  "yellow-fever-vaccination-centre": { template: "travel-health-services", reason: "Certified travel vaccination with ICVP", confidence: 1.0 },
  "rabies-vaccination": { template: "travel-health-services", reason: "Travel-specific immunisation", confidence: 1.0 },
  "altitude-sickness-prevention": { template: "travel-health-services", reason: "Travel medicine prophylaxis", confidence: 0.95 },
  // Vaccination
  "seasonal-flu-vaccination-private": { template: "vaccination-services", reason: "Private immunisation programme", confidence: 1.0 },
  "shingles-vaccination": { template: "vaccination-services", reason: "Adult immunisation service", confidence: 1.0 },
  "pneumococcal-vaccination": { template: "vaccination-services", reason: "Adult immunisation service", confidence: 1.0 },
  "meningitis-acwy-vaccination": { template: "vaccination-services", reason: "Travel/university immunisation", confidence: 1.0 },
  "chickenpox-vaccination": { template: "vaccination-services", reason: "Private paediatric/adult immunisation", confidence: 1.0 },
  "hpv-vaccination": { template: "vaccination-services", reason: "Immunisation programme", confidence: 1.0 },
  "covid-19-vaccination": { template: "vaccination-services", reason: "NHS/private COVID immunisation", confidence: 1.0 },
  "whooping-cough-pertussis-vaccination": { template: "vaccination-services", reason: "NHS pregnancy immunisation programme", confidence: 1.0 },
  "rsv-vaccination": { template: "vaccination-services", reason: "NHS adult immunisation programme", confidence: 1.0 },
  // Weight
  "weight-management-consultation": { template: "weight-management-services", reason: "Weight programme entry consultation", confidence: 1.0 },
  "pharmacy-weight-loss-programme": { template: "weight-management-services", reason: "Structured weight management programme", confidence: 1.0 },
  "glp-1-weight-management-treatment": { template: "weight-management-services", reason: "Medically supervised GLP-1 pathway", confidence: 1.0 },
  "body-composition-and-bmi-monitoring": { template: "weight-management-services", reason: "Programme monitoring component", confidence: 0.95 },
  "nutritional-and-lifestyle-advice": { template: "weight-management-services", reason: "Weight programme lifestyle support", confidence: 0.9 },
  // Testing — split by NHS pathway vs private screening
  "blood-pressure-monitoring": { template: "clinical-nhs-services", reason: "Supports NHS hypertension monitoring pathway", confidence: 0.9 },
  "urinalysis-and-uti-screening": { template: "clinical-nhs-services", reason: "Pharmacy First UTI diagnostic support", confidence: 0.95 },
  "drug-tariff-and-point-of-care-diagnostics": { template: "clinical-nhs-services", reason: "POC diagnostics supporting NHS clinical services", confidence: 0.85 },
  "covid-19-lateral-flow-supply": { template: "clinical-nhs-services", reason: "OTC diagnostic access within pharmacy care", confidence: 0.8 },
  "diabetes-screening": { template: "private-healthcare-services", reason: "Private health screening service", confidence: 0.9 },
  "cholesterol-testing": { template: "private-healthcare-services", reason: "Private cardiovascular screening", confidence: 0.9 },
  "pregnancy-testing": { template: "private-healthcare-services", reason: "Private diagnostic with counselling", confidence: 0.85 },
  // Consultation
  "medicines-use-review-mur-structured-medication-review": { template: "clinical-nhs-services", reason: "NHS medicines optimisation consultation", confidence: 0.95 },
  "minor-illness-consultation": { template: "clinical-nhs-services", reason: "Pharmacist minor illness triage aligned with NHS access", confidence: 0.95 },
  "healthy-living-advice": { template: "clinical-nhs-services", reason: "Preventive NHS-aligned pharmacy advice", confidence: 0.85 },
  "asthma-and-copd-inhaler-technique-review": { template: "clinical-nhs-services", reason: "NHS respiratory medicines optimisation", confidence: 0.95 },
  "pain-management-consultation": { template: "clinical-nhs-services", reason: "Pharmacist-led OTC and safety consultation", confidence: 0.9 },
  "skin-condition-assessment": { template: "clinical-nhs-services", reason: "Minor ailment assessment within pharmacy scope", confidence: 0.9 },
  "sleep-and-stress-support-consultation": { template: "clinical-nhs-services", reason: "Pharmacy wellbeing consultation with GP signposting", confidence: 0.85 },
  "children-s-health-consultation": { template: "clinical-nhs-services", reason: "Paediatric minor illness pharmacy access", confidence: 0.95 },
};

function mapAllServices(serviceIndex) {
  return serviceIndex.map((s) => {
    const mapping = SERVICE_TEMPLATE_MAP[s.serviceKey];
    if (!mapping) {
      return {
        serviceKey: s.serviceKey,
        serviceName: s.serviceName,
        category: s.category,
        assignedTemplateKey: null,
        assignmentReason: "UNMAPPED",
        confidenceScore: 0,
      };
    }
    return {
      serviceKey: s.serviceKey,
      serviceName: s.serviceName,
      category: s.category,
      assignedTemplateKey: mapping.template,
      assignmentReason: mapping.reason,
      confidenceScore: mapping.confidence,
    };
  });
}

function validatePharmacyFirstCampaign(campaign, templates, serviceMap) {
  const pfMapping = serviceMap.find((m) => m.serviceKey === "pharmacy-first");
  const clinicalTemplate = templates.find((t) => t.templateKey === "clinical-nhs-services");
  const hubSections = campaign.hubBlueprint?.serviceSections?.map((s) => s.id) ?? [];
  const templateSectionKeys = clinicalTemplate.sections.map((s) => s.sectionKey);

  const hubSectionSupport = {
    "service-overview": templateSectionKeys.includes("service-overview"),
    "conditions-covered": templateSectionKeys.includes("conditions-scope"),
    "who-it-helps": templateSectionKeys.includes("who-this-helps"),
    "how-it-works": templateSectionKeys.includes("how-it-works"),
    "eligibility-cost": templateSectionKeys.includes("eligibility-cost"),
    "why-choose-us": templateSectionKeys.includes("why-choose-us"),
    "areas-we-cover": templateSectionKeys.includes("areas-we-cover"),
    "related-services": templateSectionKeys.includes("related-services"),
    faq: templateSectionKeys.includes("faq"),
    "book-cta": templateSectionKeys.includes("cta-primary"),
  };

  const hubSupported = Object.entries(hubSectionSupport).every(([, ok]) => ok);
  const clusterSupported = clinicalTemplate.sections.some((s) => s.sectionKey === "areas-we-cover")
    && clinicalTemplate.sections.some((s) => s.internalLinkUse);

  const ceHooks = clinicalTemplate.contentEngineHooks;
  const ceSupported = !!campaign.contentEngineBlueprint?.assetPlan
    && !!ceHooks;

  const complianceAlign = pfMapping?.assignedTemplateKey === "clinical-nhs-services"
    && !!campaign.complianceGuardrails?.pharmacyFirstWordingConstraints?.length;

  return {
    mapsToClinicalNhs: pfMapping?.assignedTemplateKey === "clinical-nhs-services",
    hubSectionsSupported: hubSupported,
    hubSectionMapping: hubSectionSupport,
    clusterSectionsSupported: clusterSupported,
    contentEngineSupported: ceSupported,
    complianceGuardrailsAlign: complianceAlign,
    pass: pfMapping?.assignedTemplateKey === "clinical-nhs-services" && hubSupported && clusterSupported && ceSupported && complianceAlign,
  };
}

function buildImplementationGuidance() {
  return {
    templateSelection: {
      step1: "Resolve serviceKey from campaign blueprint or page config",
      step2: "Look up serviceMappings[serviceKey].assignedTemplateKey",
      step3: "Load templateFamilies[assignedTemplateKey] for section architecture and rules",
      step4: "Apply hub vs cluster pageType from campaign blueprint (cluster may omit optional sections)",
      fallback: "If mapping missing, halt generation and report unmapped service",
    },
    serviceIntelligenceFeed: {
      hubSections: "Map serviceIntelligence.serviceBenefits → benefits section; problemsSolved → problems section; customerQuestions → faq section",
      trust: "Merge serviceIntelligence.trustSignals with businessIntelligence.trustSignals",
      links: "Use internalLinkingOpportunities for related-services and contextual anchors",
      localSeo: "Combine localSearchIntent with campaign identity keywords",
    },
    campaignBlueprintFeed: {
      hub: "campaignBlueprint.hubBlueprint provides H1, meta, hero, FAQ set, CTA strategy, section hints",
      clusters: "campaignBlueprint.clusterBlueprints provide area slugs, local angles, FAQ variants, hub links",
      compliance: "campaignBlueprint.complianceGuardrails override template contentRules where stricter",
      contentEngine: "campaignBlueprint.contentEngineBlueprint.assetPlan connects to template contentEngineHooks",
    },
    contentEngineConnection: {
      rule: "Only generate asset types listed in template.contentEngineHooks.assetTypes",
      topicSource: "Prefer campaignBlueprint.contentEngineBlueprint.assetPlan topics",
      tone: "Apply template.contentRules + campaign complianceGuardrails",
      linking: "All assets link to campaignBlueprint.hubBlueprint.urlPattern",
    },
    internalLinkApplication: {
      hubToCluster: "Render areas-we-cover from campaignBlueprint.internalLinkMap.hubToClusters",
      clusterToHub: "Every cluster page includes cluster-to-hub link in hero or breadcrumb",
      relatedServices: "Render related-services from internalLinkMap.relatedServices using assigned template keys for URL patterns",
      contextualAnchors: "Inject max internalLinkingStrategy.maxContextualLinks body links in narrative sections",
    },
    imageSlotSelection: {
      hero: "template.imageStrategy.hero — campaign pane hero slot if assigned",
      support: "template.imageStrategy.support — mid-page section with imageUse: support",
      trust: "template.imageStrategy.trust — why-choose-us / trust sections",
      conversion: "template.imageStrategy.conversion — CTA band",
      rule: "Never use image-library fallback when campaign pane images assigned (parity with hosting template)",
    },
  };
}

function main() {
  const bi = JSON.parse(fs.readFileSync(BI_PATH, "utf8"));
  const si = JSON.parse(fs.readFileSync(SI_PATH, "utf8"));
  const campaign = JSON.parse(fs.readFileSync(CAMPAIGN_PATH, "utf8"));

  // Inject bi tone into template if loaded
  for (const t of TEMPLATE_FAMILIES) {
    if (t.contentEngineHooks?.focus && typeof t.contentEngineHooks.tone === "string") {
      t.contentEngineHooks.tone = bi.generationHints?.tone ?? "Professional, reassuring, clinically credible";
    }
  }

  const serviceMappings = mapAllServices(si.serviceIndex ?? []);
  const unmapped = serviceMappings.filter((m) => !m.assignedTemplateKey);

  // Populate includedServices per template
  for (const t of TEMPLATE_FAMILIES) {
    t.includedServices = serviceMappings
      .filter((m) => m.assignedTemplateKey === t.templateKey)
      .map((m) => m.serviceKey);
  }

  const pfValidation = validatePharmacyFirstCampaign(campaign, TEMPLATE_FAMILIES, serviceMappings);

  const sectionCounts = TEMPLATE_FAMILIES.map((t) => ({
    templateKey: t.templateKey,
    sectionCount: t.sections.length,
  }));

  const validation = {
    templateFamilyCount: TEMPLATE_FAMILIES.length,
    templateFamilyCountExpected: 5,
    allTemplatesHave10To14Sections: sectionCounts.every((s) => s.sectionCount >= 10 && s.sectionCount <= 14),
    sectionCounts,
    totalServicesMapped: serviceMappings.filter((m) => m.assignedTemplateKey).length,
    totalServicesExpected: 62,
    unmappedCount: unmapped.length,
    pharmacyFirstAssignment: serviceMappings.find((m) => m.serviceKey === "pharmacy-first"),
    pharmacyFirstCampaignValidation: pfValidation,
    complianceDataPresent: TEMPLATE_FAMILIES.every((t) => t.contentRules && t.complianceLevel),
    noPagesGenerated: true,
    noContentGenerated: true,
    noDeployment: true,
    noRegistryChanges: true,
    noSitemapChanges: true,
  };

  const pass =
    validation.templateFamilyCount === 5
    && validation.allTemplatesHave10To14Sections
    && validation.totalServicesMapped === 62
    && validation.unmappedCount === 0
    && pfValidation.pass
    && validation.complianceDataPresent;

  const architecture = {
    schemaVersion: "1.0",
    architectureType: "pharmacy-service-template-architecture",
    generatedAt: new Date().toISOString(),
    phase: "template-architecture-v1",
    sourceFiles: {
      businessIntelligence: "output/pharmacy-blueprint/business-intelligence.json",
      serviceIntelligence: "output/pharmacy-blueprint/service-intelligence.json",
      referenceCampaignBlueprint: "output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json",
    },
    intelligenceOnly: true,
    noPagesGenerated: true,
    noContentGenerated: true,
    noDeployment: true,
    noRegistryChanges: true,
    noSitemapChanges: true,
    templateFamilies: TEMPLATE_FAMILIES,
    serviceMappings,
    mappingSummary: {
      total: serviceMappings.length,
      byTemplate: Object.fromEntries(
        TEMPLATE_FAMILIES.map((t) => [t.templateKey, t.includedServices.length]),
      ),
    },
    pharmacyFirstCampaignValidation: pfValidation,
    implementationGuidance: buildImplementationGuidance(),
  };

  fs.writeFileSync(ARCH_PATH, JSON.stringify(architecture, null, 2) + "\n", "utf8");

  const report = {
    reportType: "pharmacy-template-architecture",
    verdict: pass
      ? "PASS: Pharmacy Template Architecture Complete"
      : "FAIL: Pharmacy Template Architecture Requires Investigation",
    generatedAt: new Date().toISOString(),
    templateFamiliesCreated: TEMPLATE_FAMILIES.map((t) => ({ templateKey: t.templateKey, templateName: t.templateName, sectionCount: t.sections.length, servicesAssigned: t.includedServices.length })),
    servicesMapped: validation.totalServicesMapped,
    unmappedServices: unmapped,
    pharmacyFirstTemplateAssignment: validation.pharmacyFirstAssignment,
    pharmacyFirstCampaignValidation: pfValidation,
    validationStatus: validation,
    readyForFirstPharmacyPageTemplateBuild: pass,
    remainingBlockers: pass
      ? []
      : [
          ...(validation.templateFamilyCount !== 5 ? ["Template family count !== 5"] : []),
          ...(!validation.allTemplatesHave10To14Sections ? ["Section count out of range for one or more templates"] : []),
          ...(validation.unmappedCount > 0 ? [`${validation.unmappedCount} unmapped services`] : []),
          ...(!pfValidation.pass ? ["Pharmacy First campaign validation failed"] : []),
        ],
    outputFiles: {
      templateArchitecture: ARCH_PATH,
    },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(report.verdict);
  console.log(`Architecture: ${ARCH_PATH}`);
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Templates: ${TEMPLATE_FAMILIES.length} | Mapped: ${validation.totalServicesMapped}/62 | PF validation: ${pfValidation.pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}

main();
