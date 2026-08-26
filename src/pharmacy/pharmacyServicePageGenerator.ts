/**
 * PharmaConnect Growth Engine — Service Page Generator V1.
 * Generates structured JSON master service pages (not HTML, not area pages).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPharmacyProfile,
  loadPharmacyBusinessIntelligence,
  loadPharmacyContentBlueprint,
  type PharmacyContentBlueprint,
  type ServiceOpportunity,
} from "./pharmacyContentBlueprintService.ts";
import { getLocalIntelligence } from "./pharmacyAreaSelectionService.ts";
import { loadPharmacyServiceLibrary, normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import {
  loadServiceIntelligenceProfile,
  type ServiceIntelligenceProfile,
} from "./pharmacyServiceIntelligenceService.ts";
import {
  countExpertiseTerms,
  isGenericAnswer,
  loadServiceExpertiseProfile,
  type ServiceExpertiseProfile,
} from "./pharmacyServiceExpertiseService.ts";
import {
  countExpansionWords,
  loadServiceExpansionProfile,
  type DeepDiveBlock,
  type ServiceExpansionProfile,
} from "./pharmacyServiceExpansionService.ts";
import {
  countAuthorityTerms,
  loadServiceAuthorityProfile,
  type ServiceAuthorityProfile,
} from "./pharmacyServiceAuthorityService.ts";
import {
  buildServicePageBlueprintSections,
  enrichIntroFromBlueprint,
  getEnrichedBlueprint,
  mergeBlueprintFaqs,
  selectBlueprintFaqs,
} from "./pharmacyServiceBlueprintContentService.ts";
import {
  buildConversionLayer,
  conversionProfileFromData,
  mergeConversionCta,
} from "./pharmacyConversionLayer.ts";
import { publishHeroIntro, publishMetaDescription } from "./pharmacySafeText.ts";
import { prepareFaqsForPublish } from "./pharmacyFaqAlignment.ts";
import { applyPublishFrameworkToServicePage, usesPublishFramework } from "./pharmacyServiceFramework.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "config/pharmacy/service-library.json"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

export const WORKSPACE_ROOT = resolveWorkspaceRoot();
export const STORAGE_ROOT = path.join(WORKSPACE_ROOT, "data/pharmacy-generated-service-pages");

export interface ServicePageSection {
  type: string;
  heading: string;
  body: string;
  bullets: string[];
}

export interface ServicePageFaq {
  question: string;
  answer: string;
}

export interface ServicePageCta {
  primary: string;
  secondary: string;
  phonePrompt?: string;
  bookingPrompt?: string;
  emailPrompt?: string;
  bookingUrl?: string;
  businessEmail?: string;
}

export interface ServicePageQualitySignals {
  wordCount: number;
  sectionCount: number;
  faqCount: number;
  localReferenceCount: number;
  usesServiceIntelligence: boolean;
  usesBusinessIntelligence: boolean;
  usesLocalIntelligence: boolean;
  usesServiceExpertise: boolean;
  clinicalConceptCount: number;
  serviceTerminologyCount: number;
  genericFallbackCount: number;
  usesContentExpansion: boolean;
  expansionSectionCount: number;
  expansionWordCount: number;
  meetsWordTarget: boolean;
  usesAuthorityLayer: boolean;
  authorityInsightCount: number;
  mythVsFactCount: number;
  patientEducationCount: number;
  commonMistakeCount: number;
  usesEnrichedBlueprint?: boolean;
  faqSourceEnrichedBlueprint?: boolean;
  mythSourceEnrichedBlueprint?: boolean;
  authoritySourceEnrichedBlueprint?: boolean;
  patientQuestionsSourceEnrichedBlueprint?: boolean;
  usesConversionLayer?: boolean;
  conversionReassuranceCount?: number;
}

export interface GeneratedServicePage {
  serviceId: string;
  serviceName: string;
  slug: string;
  pageSlug: string;
  generatedAt: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: ServicePageSection[];
  faqs: ServicePageFaq[];
  cta: ServicePageCta;
  schema: Record<string, unknown>;
  aiSummary: string;
  qualitySignals: ServicePageQualitySignals;
}

export interface GeneratedServicePagesIndex {
  slug: string;
  generatedAt: string;
  pageCount: number;
  pages: Array<{
    serviceId: string;
    serviceName: string;
    pageSlug: string;
    sectionCount: number;
    faqCount: number;
    wordCount: number;
    generatedAt: string;
  }>;
}

interface GenerationContext {
  slug: string;
  pharmacyName: string;
  town: string;
  postcode: string;
  localAuthority: string;
  selectedAreas: string[];
  phone: string;
  businessEmail: string;
  nhsEmail: string;
  bookingUrl: string;
  county: string;
  blueprint: PharmacyContentBlueprint;
  hasBusinessIntelligence: boolean;
  hasLocalIntelligence: boolean;
}

interface BiServiceEntry {
  id?: string;
  label?: string;
  patientIntent?: string;
  contentAngles?: string[];
  faqs?: string[];
  keywords?: string[];
}

interface SectionPlan {
  type: string;
  heading: string;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function pharmacyPagesDir(slug: string): string {
  return path.join(STORAGE_ROOT, slug);
}

export function servicePagePath(slug: string, serviceId: string): string {
  return path.join(pharmacyPagesDir(slug), `${normalizeServiceId(serviceId)}.json`);
}

export function servicePagesIndexPath(slug: string): string {
  return path.join(pharmacyPagesDir(slug), "_index.json");
}

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickItems<T>(items: T[], count: number, seed: string): T[] {
  if (!items.length) return [];
  const start = hashSeed(seed) % items.length;
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, items.length); i++) {
    out.push(items[(start + i) % items.length]);
  }
  return out;
}

function cleanPharmacyName(name: string): string {
  return name.trim() || "Your Local Pharmacy";
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function countLocalReferences(
  text: string,
  areas: string[],
  town: string,
  pharmacyName = "",
  postcode = "",
  county = "",
): number {
  let count = 0;
  const lower = text.toLowerCase();
  if (town && lower.includes(town.toLowerCase())) count++;
  if (pharmacyName && lower.includes(pharmacyName.toLowerCase())) count++;
  if (county && lower.includes(county.toLowerCase())) count++;
  const outward = String(postcode || "").trim().split(/\s+/)[0];
  if (outward && outward.length >= 2 && lower.includes(outward.toLowerCase())) count++;
  for (const area of areas) {
    if (area && lower.includes(area.toLowerCase())) count++;
  }
  return count;
}

const SERVICE_SECTION_PLANS: Record<string, SectionPlan[]> = {
  "pharmacy-first": [
    { type: "hero", heading: "Pharmacy First at {pharmacy}" },
    { type: "problem", heading: "What Is Pharmacy First?" },
    { type: "conditionsCovered", heading: "Conditions We Can Help With" },
    { type: "howItWorks", heading: "How The Consultation Works" },
    { type: "eligibility", heading: "When To Contact A GP Instead" },
    { type: "trust", heading: "Why Choose {pharmacy}?" },
    { type: "faqs", heading: "Frequently Asked Questions" },
    { type: "cta", heading: "Book Your Pharmacy First Consultation" },
  ],
  "travel-vaccinations": [
    { type: "hero", heading: "Travel Vaccinations in {town}" },
    { type: "problem", heading: "Travel Health Risks Worth Planning For" },
    { type: "benefits", heading: "Destination-Specific Vaccine Advice" },
    { type: "howItWorks", heading: "Vaccine Planning Appointments" },
    { type: "eligibility", heading: "Who Should Book Travel Vaccinations" },
    { type: "treatmentProcess", heading: "Travel Preparation Support" },
    { type: "faqs", heading: "Travel Vaccination FAQs" },
    { type: "cta", heading: "Plan Your Travel Health Consultation" },
  ],
  "blood-pressure-checks": [
    { type: "hero", heading: "Blood Pressure Checks at {pharmacy}" },
    { type: "problem", heading: "Why Blood Pressure Matters" },
    { type: "eligibility", heading: "Who Should Have A Blood Pressure Check" },
    { type: "howItWorks", heading: "How The Check Works" },
    { type: "patientOutcomes", heading: "Understanding Your Results" },
    { type: "faqs", heading: "Blood Pressure Check FAQs" },
    { type: "cta", heading: "Arrange A Blood Pressure Check" },
  ],
  "prescription-delivery": [
    { type: "hero", heading: "Prescription Delivery From {pharmacy}" },
    { type: "eligibility", heading: "Who Prescription Delivery Helps Most" },
    { type: "howItWorks", heading: "How Delivery Works" },
    { type: "localRelevance", heading: "Areas We Serve" },
    { type: "benefits", heading: "Repeat Prescription Support" },
    { type: "faqs", heading: "Delivery Service FAQs" },
    { type: "cta", heading: "Request Prescription Delivery" },
  ],
  "weight-management": [
    { type: "hero", heading: "Weight Management Support in {town}" },
    { type: "problem", heading: "Weight Management Challenges We Understand" },
    { type: "eligibility", heading: "Who May Be Suitable" },
    { type: "treatmentProcess", heading: "Structured Treatment Support" },
    { type: "patientOutcomes", heading: "Expected Outcomes" },
    { type: "faqs", heading: "Weight Management FAQs" },
    { type: "cta", heading: "Start Your Weight Management Consultation" },
  ],
  "repeat-prescriptions": [
    { type: "hero", heading: "Repeat Prescriptions at {pharmacy}" },
    { type: "benefits", heading: "Why Patients Choose Us For Repeat Medicines" },
    { type: "howItWorks", heading: "How Repeat Ordering Works" },
    { type: "localRelevance", heading: "Serving Patients Across {town}" },
    { type: "trust", heading: "Reliable Repeat Prescription Support" },
    { type: "faqs", heading: "Repeat Prescription FAQs" },
    { type: "cta", heading: "Set Up Repeat Prescriptions" },
  ],
  "prescription-dispensing": [
    { type: "hero", heading: "NHS Prescription Dispensing" },
    { type: "howItWorks", heading: "Our Dispensing Process" },
    { type: "benefits", heading: "What You Can Expect" },
    { type: "trust", heading: "Professional Medicines Expertise" },
    { type: "localRelevance", heading: "Your Local Pharmacy in {town}" },
    { type: "faqs", heading: "Prescription FAQs" },
    { type: "cta", heading: "Collect Your Prescription" },
  ],
  "new-medicine-service": [
    { type: "hero", heading: "New Medicine Service (NMS)" },
    { type: "problem", heading: "Starting A New Medicine Can Feel Uncertain" },
    { type: "howItWorks", heading: "How NMS Support Works" },
    { type: "patientOutcomes", heading: "Better Confidence With New Treatments" },
    { type: "eligibility", heading: "Who The New Medicine Service Is For" },
    { type: "faqs", heading: "NMS FAQs" },
    { type: "cta", heading: "Ask About NMS Support" },
  ],
  "ear-wax-removal": [
    { type: "hero", heading: "Ear Wax Removal in {town}" },
    { type: "problem", heading: "When Ear Wax Becomes A Problem" },
    { type: "howItWorks", heading: "Safe Professional Removal" },
    { type: "eligibility", heading: "Who Should Book Ear Wax Removal" },
    { type: "patientOutcomes", heading: "Clearer Hearing, Less Discomfort" },
    { type: "faqs", heading: "Ear Wax Removal FAQs" },
    { type: "cta", heading: "Book Ear Wax Removal" },
  ],
  "smoking-cessation": [
    { type: "hero", heading: "Stop Smoking Support" },
    { type: "benefits", heading: "Why Quit With Pharmacy Support" },
    { type: "howItWorks", heading: "Your Stop Smoking Journey" },
    { type: "eligibility", heading: "Who Can Access NHS Cessation Support" },
    { type: "trust", heading: "Non-Judgemental Professional Help" },
    { type: "faqs", heading: "Stop Smoking FAQs" },
    { type: "cta", heading: "Start Your Quit Plan" },
  ],
  "independent-prescribing": [
    { type: "hero", heading: "Pharmacist Prescribing Clinics" },
    { type: "benefits", heading: "Faster Access To Treatment" },
    { type: "howItWorks", heading: "How Independent Prescribing Works" },
    { type: "eligibility", heading: "Conditions We May Treat" },
    { type: "trust", heading: "Qualified Independent Prescribers" },
    { type: "faqs", heading: "Prescribing Service FAQs" },
    { type: "cta", heading: "Book A Prescribing Consultation" },
  ],
};

const CATEGORY_SECTION_PLANS: Record<string, SectionPlan[]> = {
  "core-pharmacy": [
    { type: "hero", heading: "{serviceName} at {pharmacy}" },
    { type: "benefits", heading: "Patient Benefits" },
    { type: "howItWorks", heading: "How It Works" },
    { type: "localRelevance", heading: "Local Pharmacy Access" },
    { type: "trust", heading: "Why Patients Trust Us" },
    { type: "faqs", heading: "FAQs" },
    { type: "cta", heading: "Get Started" },
  ],
  "nhs-clinical": [
    { type: "hero", heading: "{serviceName} in {town}" },
    { type: "problem", heading: "The Problem We Help Solve" },
    { type: "howItWorks", heading: "How The Service Works" },
    { type: "eligibility", heading: "Who This Service Is For" },
    { type: "patientOutcomes", heading: "Outcomes You Can Expect" },
    { type: "faqs", heading: "Common Questions" },
    { type: "cta", heading: "Book An Appointment" },
  ],
  "private-clinical": [
    { type: "hero", heading: "Private {serviceName}" },
    { type: "benefits", heading: "Why Choose Private Pharmacy Care" },
    { type: "treatmentProcess", heading: "Your Appointment Journey" },
    { type: "eligibility", heading: "Ideal Patients" },
    { type: "trust", heading: "Professional Clinical Standards" },
    { type: "faqs", heading: "Service FAQs" },
    { type: "cta", heading: "Book A Private Consultation" },
  ],
  specialist: [
    { type: "hero", heading: "{serviceName} — {pharmacy}" },
    { type: "benefits", heading: "Specialist Pharmacy-Led Care" },
    { type: "howItWorks", heading: "Consultation Process" },
    { type: "patientOutcomes", heading: "Clinical Outcomes" },
    { type: "localRelevance", heading: "Serving {town} And Surrounding Areas" },
    { type: "faqs", heading: "FAQs" },
    { type: "cta", heading: "Speak To Our Team" },
  ],
};

function resolveHeading(template: string, ctx: GenerationContext, serviceName: string): string {
  return template
    .replace(/\{pharmacy\}/g, ctx.pharmacyName)
    .replace(/\{town\}/g, ctx.town)
    .replace(/\{serviceName\}/g, serviceName);
}

function findBiService(serviceId: string, intelligence: ReturnType<typeof loadPharmacyBusinessIntelligence>): BiServiceEntry | null {
  const id = normalizeServiceId(serviceId);
  const services = intelligence.services?.selectedServices as BiServiceEntry[] | undefined;
  if (!services?.length) return null;
  return (
    services.find((s) => normalizeServiceId(String(s.id || "")) === id) ||
    services.find((s) => normalizeServiceId(String(s.label || "")).includes(id.replace(/-/g, ""))) ||
    null
  );
}

function buildIntro(
  ctx: GenerationContext,
  service: ServiceOpportunity,
  intel: ServiceIntelligenceProfile,
  bi: BiServiceEntry | null,
  expertise: ServiceExpertiseProfile | null,
  styleIndex: number,
): string {
  const areas = pickItems(ctx.selectedAreas, 2, service.serviceKey + "-intro");
  const authority = expertise?.authorityStatements[0] || "";
  const explanation = expertise?.serviceExplanations[0] || intel.description;
  const terminology = expertise?.serviceTerminology.slice(0, 2).join(" and ") || service.serviceName.toLowerCase();
  const concern = expertise?.patientConcerns[0] || intel.idealPatients[0] || "your health needs";
  const biIntent = bi?.patientIntent || "";

  const styles = [
    () =>
      expertise
        ? `${explanation} ${authority} At ${ctx.pharmacyName}, we focus on ${terminology.toLowerCase()} — with a confidential consultation and clear next steps if GP care is more appropriate.`
        : `Looking for ${service.serviceName.toLowerCase()}? ${ctx.pharmacyName} offers professional pharmacist-led care with patient safety at the centre.`,
    () =>
      `${concern.endsWith("?") ? `If you are asking "${concern}"` : `If ${concern.toLowerCase()} matters to you`}, our ${terminology.toLowerCase()} appointment explains what is clinically appropriate before any supply or referral.${biIntent ? ` ${biIntent}` : ""}`,
    () =>
      areas.length
        ? `Serving patients from ${areas.join(" and ")} and across ${ctx.town}, ${ctx.pharmacyName} delivers ${service.serviceName} with structured ${terminology.toLowerCase()} — not a rushed counter conversation.`
        : `${ctx.pharmacyName} in ${ctx.town} provides ${service.serviceName} through qualified pharmacists who follow defined clinical pathways and safety-netting protocols.`,
    () =>
      `${authority || `${service.serviceName} should feel clear before you commit.`} ${expertise?.serviceExplanations[1] || explanation}`,
    () =>
      `Whether you need ${terminology.toLowerCase()} or simply want plain-language answers, ${ctx.pharmacyName} starts with assessment — then personalised advice, supply where suitable, or referral when symptoms sit outside pharmacy scope.`,
    () =>
      `${explanation} That is the clinical context behind ${service.serviceName} at ${ctx.pharmacyName}: practical access${areas[0] ? ` for ${areas[0]} and nearby communities` : ` in ${ctx.town}`}, with professional governance throughout.`,
  ];

  return styles[styleIndex % styles.length]();
}

function buildSectionContent(
  plan: SectionPlan,
  ctx: GenerationContext,
  service: ServiceOpportunity,
  intel: ServiceIntelligenceProfile,
  bi: BiServiceEntry | null,
  expertise: ServiceExpertiseProfile | null,
  localAreas: string[],
): ServicePageSection {
  const name = service.serviceName;
  const heading = resolveHeading(plan.heading, ctx, name);
  const concepts = expertise?.clinicalConcepts.slice(0, 4).join(", ") || "";
  const explanation = expertise?.serviceExplanations[0] || intel.description;
  const authority = expertise?.authorityStatements[0] || "";

  switch (plan.type) {
    case "hero":
      return {
        type: plan.type,
        heading,
        body: expertise
          ? `${explanation} ${ctx.pharmacyName} provides ${name.toLowerCase()} with ${expertise.serviceTerminology.slice(0, 2).join(" and ").toLowerCase() || "structured clinical assessment"}.`
          : `${ctx.pharmacyName} provides ${name.toLowerCase()} for patients in ${ctx.town}. ${intel.description}`,
        bullets: pickItems(expertise?.consultationTopics.length ? expertise.consultationTopics : intel.serviceFeatures, 4, service.serviceKey + "-hero"),
      };

    case "problem":
      if (service.serviceKey === "pharmacy-first" && heading.includes("What Is")) {
        return {
          type: plan.type,
          heading,
          body:
            expertise?.serviceExplanations[0] ||
            `${name} is an NHS service for selected minor illnesses without a GP appointment first, where commissioned and clinically appropriate.`,
          bullets: pickItems(intel.patientBenefits.slice(0, 4), 3, service.serviceKey + "-whatis"),
        };
      }
      return {
        type: plan.type,
        heading,
        body: expertise
          ? `${explanation}${concepts ? ` Key clinical considerations include ${concepts.toLowerCase()}.` : ""}${expertise.riskFactors.length ? ` Risk factors such as ${pickItems(expertise.riskFactors, 3, service.serviceKey + "-risk").join(", ").toLowerCase()} often influence the advice you need.` : ""}`
          : `Many patients delay care because they are unsure whether a pharmacy can help. ${name} exists to bridge that gap with professional assessment.`,
        bullets: pickItems(
          (expertise?.patientConcerns.filter((c) => !isCatalogFallbackConcern(c, name)) || []).length
            ? expertise!.patientConcerns.filter((c) => !isCatalogFallbackConcern(c, name))
            : intel.patientBenefits.slice(3),
          4,
          service.serviceKey + "-problem",
        ),
      };

    case "benefits":
      return {
        type: plan.type,
        heading,
        body: expertise
          ? `${authority || `Professional ${name.toLowerCase()} should feel clear and proportionate.`} Consultation covers ${pickItems(expertise.consultationTopics, 3, service.serviceKey + "-ben-topics").join(", ").toLowerCase()}.`
          : `Choosing ${name} at ${ctx.pharmacyName} means access to professional pharmacy care with a team who explain options in plain language.`,
        bullets: pickItems(expertise?.contentDo.length ? expertise.contentDo : intel.patientBenefits, 5, service.serviceKey + "-benefits"),
      };

    case "patientOutcomes":
      return {
        type: plan.type,
        heading,
        body: expertise?.serviceExplanations[1] || expertise?.serviceExplanations[0] ||
          `Our aim is that you leave understanding what your results or next steps mean — whether that is lifestyle advice, monitoring or GP follow-up.`,
        bullets: pickItems(intel.serviceOutcomes, 5, service.serviceKey + "-outcomes"),
      };

    case "howItWorks":
      return {
        type: plan.type,
        heading,
        body: expertise
          ? `Your appointment typically covers ${pickItems(expertise.consultationTopics, 3, service.serviceKey + "-how").join(", ").toLowerCase()}. We explain each step before proceeding — and signpost to your GP if symptoms fall outside pharmacy scope.`
          : bi?.contentAngles?.[0]
            ? `${bi.contentAngles[0]}. Our team follows structured clinical protocols.`
            : `Appointments begin with clinical assessment, followed by personalised advice and supply or referral where appropriate.`,
        bullets: pickItems(expertise?.commonMistakes.length ? expertise.commonMistakes.map((m) => `Avoid: ${m}`) : intel.serviceFeatures, 5, service.serviceKey + "-how"),
      };

    case "eligibility":
      return {
        type: plan.type,
        heading,
        body: plan.heading.includes("GP")
          ? `Pharmacy teams treat many common presentations, but red-flag symptoms need GP or urgent care. We refer clearly to your doctor, NHS 111 or A&E when appropriate — your safety comes first.`
          : expertise
            ? `${name} suits patients where ${pickItems(expertise.riskFactors, 3, service.serviceKey + "-elig").join(", ").toLowerCase()} may apply — but suitability is confirmed only after individual assessment.${expertise.contentAvoid[0] ? ` ${expertise.contentAvoid[0]}` : ""}`
            : `${name} is helpful for ${intel.idealPatients.slice(0, 2).join(" and ").toLowerCase() || "patients seeking pharmacy access"}. Eligibility varies by commissioning and presentation.`,
        bullets: pickItems(expertise?.riskFactors.length ? expertise.riskFactors : intel.idealPatients, 5, service.serviceKey + "-eligibility"),
      };

    case "conditionsCovered": {
      const isOverview = heading.includes("What Is");
      return {
        type: plan.type,
        heading,
        body: isOverview
          ? expertise?.serviceExplanations[0] || `${name} is an NHS service for selected minor illnesses without a GP appointment first, where commissioned and clinically appropriate.`
          : expertise && service.serviceKey === "pharmacy-first"
            ? `Pharmacy First pathways can include ${pickItems(expertise.clinicalConcepts.filter((c) => !c.includes("Pharmacy First")), 6, "pf-cond").join(", ").toLowerCase()} — subject to assessment and local NHS commissioning.`
            : `${name} covers clinically appropriate presentations defined by the service specification and local commissioning.`,
        bullets: isOverview
          ? []
          : service.serviceKey === "pharmacy-first"
            ? pickItems(expertise?.clinicalConcepts.filter((c) => c.includes("UTI") || ["Sore throat", "Earache", "Shingles", "Impetigo", "Sinusitis"].some((t) => c.includes(t))) || ["Earache", "Sore throat", "Impetigo", "Shingles", "Sinusitis", "Infected insect bites", "Uncomplicated UTI (women 16–64)"], 7, "pf-bullets")
            : pickItems(expertise?.clinicalConcepts.length ? expertise.clinicalConcepts : intel.serviceFeatures, 5, service.serviceKey + "-conditions"),
      };
    }

    case "treatmentProcess":
      return {
        type: plan.type,
        heading,
        body: expertise
          ? `We follow a structured pathway: ${pickItems(expertise.consultationTopics, 4, service.serviceKey + "-proc").join(", ").toLowerCase()}. ${pickItems(expertise.commonMistakes, 1, service.serviceKey + "-mistake")[0] ? `Patients often regret ${pickItems(expertise.commonMistakes, 1, service.serviceKey + "-mistake")[0]!.toLowerCase()} — we help you plan ahead.` : ""}`
          : `Structured assessment through to follow-up advice so you know what to expect at each stage.`,
        bullets: pickItems(expertise?.consultationTopics.length ? expertise.consultationTopics : intel.serviceFeatures, 5, service.serviceKey + "-process"),
      };

    case "localRelevance":
      return {
        type: plan.type,
        heading,
        body: localAreas.length
          ? `${ctx.pharmacyName} supports patients across ${ctx.town} including ${localAreas.slice(0, 2).join(" and ")}.${localAreas.length > 2 ? ` We also serve ${localAreas[2]}.` : ""} Convenient pharmacy access matters when you need ${name.toLowerCase()} without travelling to a distant clinic.`
          : `${ctx.pharmacyName} is rooted in ${ctx.town}, offering ${name.toLowerCase()} with the continuity of a local pharmacy team.`,
        bullets: pickItems(intel.localRelevanceSignals, 3, service.serviceKey + "-local"),
      };

    case "trust":
      return {
        type: plan.type,
        heading,
        body: expertise?.authorityStatements[1] || expertise?.authorityStatements[0] ||
          `${ctx.pharmacyName} operates from GPhC-registered premises with qualified pharmacists and defined safety-netting.`,
        bullets: pickItems(intel.trustSignals, 5, service.serviceKey + "-trust"),
      };

    case "relatedServices":
      return {
        type: plan.type,
        heading,
        body: `Patients accessing ${name} often benefit from complementary pharmacy services. Ask our team about related support during your visit.`,
        bullets: ctx.blueprint.serviceOpportunities
          .filter((s) => s.serviceKey !== service.serviceKey)
          .slice(0, 4)
          .map((s) => s.serviceName),
      };

    case "faqs":
      return { type: plan.type, heading, body: "", bullets: [] };

    case "cta":
      return {
        type: plan.type,
        heading,
        body: expertise
          ? `Ready to discuss ${name.toLowerCase()}? Book a ${pickItems(expertise.consultationTopics.slice(0, 4), 1, service.serviceKey + "-cta")[0]?.toLowerCase() || "consultation"} — our team will confirm eligibility, timing and what to bring.`
          : `Ready to arrange ${name.toLowerCase()}? ${ctx.pharmacyName} will guide you through booking and eligibility.`,
        bullets: pickItems(intel.ctaOptions, 3, service.serviceKey + "-cta"),
      };

    default:
      return {
        type: plan.type,
        heading,
        body: `${name} at ${ctx.pharmacyName} combines ${intel.description.toLowerCase()} with patient-centred pharmacy care.`,
        bullets: pickItems(intel.patientBenefits, 4, service.serviceKey + "-default"),
      };
  }
}

function isCatalogFallbackConcern(concern: string, serviceName: string): boolean {
  const c = concern.trim();
  return (
    c === `What does ${serviceName} involve?` ||
    c === `Who is ${serviceName} suitable for?` ||
    c === `How do I access ${serviceName} at a pharmacy?`
  );
}

function answerFromPatientConcern(
  concern: string,
  ctx: GenerationContext,
  service: ServiceOpportunity,
  expertise: ServiceExpertiseProfile,
): string | null {
  const sid = normalizeServiceId(service.serviceKey);
  const c = concern.toLowerCase();

  if (sid === "travel-vaccinations") {
    if (c.includes("which vaccines")) {
      return `Vaccines depend on destination, medical history and planned activities — commonly discussed options include hepatitis A, typhoid, rabies, yellow fever and Japanese encephalitis where clinically appropriate. A travel risk assessment identifies what may be recommended for your trip; some courses need several weeks before departure.`;
    }
    if (c.includes("how soon before travel") || c.includes("book")) {
      return `Book as early as possible — ideally 6–8 weeks before travel for multi-course vaccines. Last-minute appointments may still help, but booking too close to departure limits options. We review your itinerary and build a vaccination schedule at consultation.`;
    }
    if (c.includes("destination") || c.includes("required")) {
      return `Destination requirements vary by country and activity (rural travel, visiting friends and relatives, backpacking). We review your itinerary during a travel health consultation — we do not give destination-specific advice without assessing your full travel context.`;
    }
    if (c.includes("children") || c.includes("safe")) {
      return `Child travel vaccines depend on age, destination and medical history. A pharmacist reviews suitability during a travel health consultation and explains any age-related scheduling or documentation requirements.`;
    }
    if (c.includes("short notice")) {
      return `Even with limited time before departure, a travel health consultation can identify priority vaccines and precautions. Some protection may still be possible, though full courses are ideally started 6–8 weeks ahead.`;
    }
  }

  if (sid === "blood-pressure-checks") {
    if (c.includes("too high") || c.includes("numbers mean")) {
      return `A reading records systolic and diastolic pressure (mmHg). One raised check does not diagnose hypertension — but it can indicate cardiovascular risk and whether GP follow-up or ambulatory blood pressure monitoring (ABPM) may be appropriate under the NHS Hypertension Case-Finding Service.`;
    }
    if (c.includes("see a gp") || c.includes("gp")) {
      return `If your reading is raised, our pharmacist explains next steps — which may include repeat measurement, lifestyle advice, ABPM referral or signposting to your GP. We do not replace GP care or emergency assessment.`;
    }
    if (c.includes("lifestyle")) {
      return `Lifestyle changes — reducing salt, increasing activity, managing weight and stopping smoking — can support blood pressure control alongside medical care. We discuss practical steps and when GP follow-up is more appropriate.`;
    }
    if (c.includes("how often")) {
      return `Frequency depends on your age, risk factors (smoking, diabetes, family history) and previous readings. Over-40s and those with risk factors benefit from regular checks; we advise follow-up intervals after each appointment.`;
    }
  }

  if (sid === "repeat-prescriptions") {
    if (c.includes("order")) {
      return `Order repeats through your GP surgery as usual; with EPS nomination, prescriptions can be sent electronically to ${ctx.pharmacyName}. We help you plan reorder timing to avoid gaps in medication continuity.`;
    }
    if (c.includes("nominate") || c.includes("eps")) {
      return `EPS nomination directs NHS prescriptions to your chosen pharmacy electronically. Our team can explain nomination and help you switch if you are moving to ${ctx.pharmacyName}.`;
    }
    if (c.includes("authorise") || c.includes("surgery")) {
      return `If your GP surgery is slow to authorise a repeat, our team can liaise where appropriate and advise on reorder timing so you do not run out of essential medicines.`;
    }
  }

  if (sid === "prescription-delivery") {
    if (c.includes("deliver") || c.includes("address")) {
      const areas = pickItems(ctx.selectedAreas, 2, c);
      return `Home delivery supports patients who cannot easily collect in person — often elderly patients, carers and those with mobility limitations. Coverage depends on local delivery routes${areas.length ? ` including ${areas.join(" and ")}` : ""}; suitability and medicines type are confirmed before arranging supply.`;
    }
    if (c.includes("free") || c.includes("cost")) {
      return `Delivery fees and eligibility vary by pharmacy and local policy. Our team confirms whether home delivery is available for your address and medicines before arranging supply.`;
    }
  }

  if (sid === "pharmacy-first") {
    if (c.includes("free") || c.includes("nhs")) {
      return `Pharmacy First is an NHS service where commissioned — typically free for eligible pathways. Suitability and supply are confirmed after pharmacist assessment, not from a website checklist alone.`;
    }
  }

  return null;
}

function answerFromAuthority(
  question: string,
  ctx: GenerationContext,
  service: ServiceOpportunity,
  authority: ServiceAuthorityProfile,
): string | null {
  const q = question.toLowerCase();

  const matchedMyth = authority.mythVsFact.find(
    (e) => q.includes(e.myth.toLowerCase().slice(0, 20)) || q.includes("myth") || q.includes("true") || q.includes("misconception"),
  );
  if (matchedMyth && (q.includes("myth") || q.includes("true") || q.includes("misconception") || q.includes("fact"))) {
    return `Myth: ${matchedMyth.myth} Fact: ${matchedMyth.fact}`;
  }

  const heard = authority.patientQuestionsWeOftenHear.find(
    (h) => q === h.toLowerCase() || h.toLowerCase().includes(q.slice(0, 15)) || q.includes(h.toLowerCase().slice(0, 20)),
  );
  if (heard) {
    const insight = authority.professionalInsights[authority.patientQuestionsWeOftenHear.indexOf(heard)] ||
      authority.professionalInsights[0] || "";
    return `${insight} ${authority.authorityStatements[0] || ""}`.trim();
  }

  if (q.includes("when should") || q.includes("when to") || q.includes("seek advice") || q.includes("see a gp")) {
    return `Seek pharmacist advice when ${pickItems(authority.whenToSeekAdvice, 3, q).join("; ").toLowerCase()}. ${authority.safetyConsiderations[0] || "Red-flag symptoms need GP or urgent care."}`;
  }

  if (q.includes("mistake") || q.includes("avoid") || q.includes("wrong")) {
    return `Common errors include ${pickItems(authority.commonPatientMistakes, 3, q).join(", ").toLowerCase()}. ${authority.bestPracticeGuidance[0] || "Our team helps you plan ahead to avoid these pitfalls."}`;
  }

  if (q.includes("learn") || q.includes("understand") || q.includes("education") || q.includes("explain")) {
    return `${authority.patientEducationTopics.slice(0, 3).join(". ")}. ${authority.professionalInsights[0] || ""}`.trim();
  }

  const mythMatch = authority.mythVsFact.find((e) =>
    q.split(/\s+/).some((w) => w.length > 4 && e.myth.toLowerCase().includes(w)),
  );
  if (mythMatch) {
    return `Myth: ${mythMatch.myth} Fact: ${mythMatch.fact}`;
  }

  return null;
}

function answerFaq(
  question: string,
  ctx: GenerationContext,
  service: ServiceOpportunity,
  intel: ServiceIntelligenceProfile,
  expertise: ServiceExpertiseProfile | null,
  authority: ServiceAuthorityProfile | null,
): string {
  const q = question.toLowerCase();
  const name = service.serviceName;
  const sid = normalizeServiceId(service.serviceKey);

  if (sid === "travel-vaccinations") {
    if (q.includes("vaccine") || q.includes("need") || q.includes("which")) {
      return `Vaccines depend on destination, medical history and planned activities — commonly discussed options include hepatitis A, typhoid, rabies, yellow fever and Japanese encephalitis where clinically appropriate. A travel risk assessment identifies what may be recommended for your trip; some courses need several weeks before departure.`;
    }
    if (q.includes("soon") || q.includes("before travel") || q.includes("book")) {
      return `Book as early as possible — ideally 6–8 weeks before travel for multi-course vaccines. Last-minute appointments may still help, but booking too close to departure can limit options. We review your itinerary and build a vaccination schedule at consultation.`;
    }
    if (q.includes("country") || q.includes("destination") || q.includes("required")) {
      return `Destination requirements vary by country and activity (rural travel, visiting friends and relatives, backpacking). We review your itinerary during a travel health consultation — we do not give destination-specific advice without assessing your full travel context.`;
    }
    if (q.includes("nhs") || q.includes("cost") || q.includes("much") || q.includes("free")) {
      return `Some travel vaccines may be available on the NHS for certain risk groups; many destination-specific vaccines are private. Fees and NHS eligibility are explained before any supply — we do not assume funding without checking your individual circumstances.`;
    }
  }

  if (sid === "blood-pressure-checks") {
    if (q.includes("high") || q.includes("mean") || q.includes("number") || q.includes("reading")) {
      return `A reading records systolic and diastolic pressure (mmHg). One raised check does not diagnose hypertension — but it can indicate cardiovascular risk and whether GP follow-up or ambulatory blood pressure monitoring (ABPM) may be appropriate under the NHS Hypertension Case-Finding Service.`;
    }
    if (q.includes("gp") || q.includes("refer")) {
      return `If your reading is raised, our pharmacist explains next steps — which may include repeat measurement, lifestyle advice, ABPM referral or signposting to your GP. We do not replace GP care or emergency assessment.`;
    }
    if (q.includes("often") || q.includes("check")) {
      return `Frequency depends on your age, risk factors (smoking, diabetes, family history) and previous readings. Over-40s and those with risk factors benefit from regular checks; we advise follow-up intervals after each appointment.`;
    }
    if (q.includes("free") || q.includes("nhs") || q.includes("cost")) {
      return `Blood pressure checks are offered through the NHS Hypertension Case-Finding Service where locally commissioned — typically at no charge for eligible screening. Private monitoring may apply in other contexts; we confirm at appointment.`;
    }
  }

  if (sid === "pharmacy-first") {
    if (q.includes("uti") || q.includes("urinary")) {
      return `Where the uncomplicated UTI pathway is commissioned locally, women aged 16–64 may receive pharmacist assessment and supply without a GP appointment first. Eligibility depends on symptoms, history and safety criteria — ${ctx.pharmacyName} confirms suitability at consultation or signposts to GP care.`;
    }
    if (q.includes("child") || q.includes("paediatric")) {
      return `Paediatric Pharmacy First depends on age limits per pathway. Contact ${ctx.pharmacyName} to confirm guardian requirements, commissioned paediatric scope and whether GP review is more appropriate.`;
    }
    if (q.includes("condition") || q.includes("cover") || q.includes("what")) {
      return `Pharmacy First covers selected pathways such as sore throat, earache, sinusitis, impetigo, infected insect bites, shingles and uncomplicated UTIs in women (16–64) — subject to clinical assessment and local NHS commissioning. If your symptoms fall outside scope, we refer to GP or urgent care.`;
    }
    if (q.includes("free") || q.includes("nhs")) {
      return `Pharmacy First is an NHS service where commissioned — typically free for eligible pathways. Suitability and supply are confirmed after pharmacist assessment, not from a website checklist alone.`;
    }
  }

  if (sid === "repeat-prescriptions") {
    if (q.includes("order") || q.includes("repeat")) {
      return `Order repeats through your GP surgery as usual; with EPS nomination, prescriptions can be sent electronically to ${ctx.pharmacyName}. We help you plan reorder timing to avoid gaps in medication continuity.`;
    }
    if (q.includes("nominate") || q.includes("eps")) {
      return `EPS nomination directs NHS prescriptions to your chosen pharmacy electronically. Our team can explain nomination and help you switch if you are moving to ${ctx.pharmacyName}.`;
    }
  }

  if (sid === "prescription-delivery") {
    if (q.includes("deliver") || q.includes("area") || q.includes("home")) {
      const areas = pickItems(ctx.selectedAreas, 2, q);
      return `Home delivery supports patients who cannot easily collect in person — often elderly patients, carers and those with mobility limitations. Coverage depends on local delivery routes${areas.length ? ` including ${areas.join(" and ")}` : ""}; suitability and medicines type are confirmed before arranging supply.`;
    }
  }

  if (q.includes("free") || q.includes("cost") || q.includes("much")) {
    if (["pharmacy-first", "blood-pressure-checks", "smoking-cessation", "new-medicine-service", "flu-vaccinations"].includes(sid)) {
      return `${name} may be available on the NHS where you are eligible and the service is commissioned locally. Private elements, if any, are explained before treatment — we do not assume funding without assessment.`;
    }
    return `${name} is typically a private pharmacy service. Fees depend on consultation and any treatment supplied; transparent pricing is provided before you commit.`;
  }

  if (q.includes("appointment") || q.includes("book")) {
    const topic = expertise?.consultationTopics[0]?.toLowerCase() || name.toLowerCase();
    return `We recommend booking a ${topic} in advance so the clinical team can allow appropriate time. Appointments usually take 10–30 minutes depending on complexity.`;
  }

  if (q.includes("gp") || q.includes("replace")) {
    return `${name} complements GP care but does not replace it. Pharmacists assess whether pharmacy scope is appropriate and refer clearly to your GP, NHS 111 or urgent care when needed.${expertise?.contentAvoid.find((a) => a.toLowerCase().includes("gp")) ? ` ${expertise.contentAvoid.find((a) => a.toLowerCase().includes("gp"))}` : ""}`;
  }

  if (q.includes("eligible") || q.includes("who")) {
    const risks = expertise?.riskFactors.slice(0, 3).join(", ").toLowerCase();
    return `${name} may suit patients where ${risks || intel.idealPatients.slice(0, 2).join(" and ").toLowerCase()} apply — but suitability is confirmed only after individual clinical assessment.`;
  }

  if (q.includes("safe") && (q.includes("medicin") || q.includes("other"))) {
    return `Bring your full medicines list — the pharmacist checks interactions and contraindications before any supply related to ${name}.`;
  }

  if (q.includes("long") || q.includes("how long") || (q.includes("take") && q.includes("minute"))) {
    return `Most ${name.toLowerCase()} consultations take 10–30 minutes depending on complexity — allowing time for ${expertise?.consultationTopics.slice(0, 2).join(" and ").toLowerCase() || "assessment and advice"} without rushing.`;
  }

  if (q.includes("bring")) {
    if (sid === "pharmacy-first") {
      return `Bring your current medicines list, allergy history and details of when symptoms started. For paediatric presentations, confirm the child's age. ${ctx.pharmacyName} will advise anything else when you book Pharmacy First.`;
    }
    return `Bring current medicines, relevant medical history, and service-specific records (e.g. vaccination history for travel, previous BP readings). Our team will advise anything else when you book.`;
  }

  if (q.includes("near me") || q.includes("where") || q.includes("access")) {
    if (sid === "travel-vaccinations") {
      return `${ctx.pharmacyName} in ${ctx.town} offers travel health consultations with destination review and vaccination scheduling. Book ahead — ideally 6–8 weeks before travel — so multi-course vaccines can be completed in time.`;
    }
    if (sid === "blood-pressure-checks") {
      return `${ctx.pharmacyName} in ${ctx.town} provides NHS Hypertension Case-Finding blood pressure checks where commissioned — convenient access without waiting for a routine GP appointment.`;
    }
    return `${ctx.pharmacyName} in ${ctx.town} provides ${name.toLowerCase()}. ${expertise?.authorityStatements[0] || "Contact the pharmacy for opening hours and appointment availability."}`;
  }

  if (authority) {
    const authorityAnswer = answerFromAuthority(question, ctx, service, authority);
    if (authorityAnswer) return authorityAnswer;
  }

  if (expertise?.serviceExplanations[0]) {
    const matchedConcern = expertise.patientConcerns.find(
      (c) => q === c.toLowerCase() || c.toLowerCase() === q,
    );
    if (matchedConcern) {
      const mapped = answerFromPatientConcern(matchedConcern, ctx, service, expertise);
      if (mapped) return mapped;
    }
    return `${expertise.serviceExplanations[Math.min(1, expertise.serviceExplanations.length - 1)]} ${expertise.authorityStatements[0] || ""}`.trim();
  }

  if (authority?.professionalInsights[0]) {
    return `${authority.professionalInsights[0]} ${authority.authorityStatements[0] || ""}`.trim();
  }

  return `${name} at ${ctx.pharmacyName} is delivered with pharmacist oversight. ${intel.patientBenefits[0] || "Assessment determines the appropriate next step."}`;
}

function buildDeepDiveSection(
  block: DeepDiveBlock,
  ctx: GenerationContext,
  service: ServiceOpportunity,
  seed: string,
): ServicePageSection {
  const body = block.paragraphs.join(" ");
  return {
    type: "deepDive",
    heading: block.heading,
    body,
    bullets: pickItems(block.bulletTopics, 5, seed),
  };
}

function buildExpansionSections(
  ctx: GenerationContext,
  service: ServiceOpportunity,
  intel: ServiceIntelligenceProfile,
  expertise: ServiceExpertiseProfile | null,
  expansion: ServiceExpansionProfile,
  localAreas: string[],
): ServicePageSection[] {
  const sections: ServicePageSection[] = [];
  const sid = normalizeServiceId(service.serviceKey);
  let deepDiveIndex = 0;

  for (const spec of expansion.expansionSections) {
    switch (spec.type) {
      case "preparationGuide":
        if (expansion.preparationGuide.length) {
          sections.push({
            type: "preparationGuide",
            heading: spec.heading,
            body: `Before your ${service.serviceName.toLowerCase()} appointment at ${ctx.pharmacyName}, preparing the following helps our clinical team give accurate advice:`,
            bullets: pickItems(expansion.preparationGuide, 6, sid + "-prep"),
          });
        }
        break;

      case "timeline":
        if (expansion.timelineNotes.length) {
          sections.push({
            type: "timeline",
            heading: spec.heading,
            body: `Planning ahead improves outcomes for ${service.serviceName.toLowerCase()}. Typical timelines we discuss at consultation include:`,
            bullets: pickItems(expansion.timelineNotes, 5, sid + "-timeline"),
          });
        }
        break;

      case "comparison":
        if (expansion.comparisonPoints.length) {
          sections.push({
            type: "comparison",
            heading: spec.heading,
            body: `${service.serviceName} at a community pharmacy works alongside GP and urgent care — understanding the difference helps you choose the right access route:`,
            bullets: pickItems(expansion.comparisonPoints, 4, sid + "-compare"),
          });
        }
        break;

      case "deepDive": {
        const block = expansion.deepDiveBlocks[deepDiveIndex];
        if (block) {
          sections.push(buildDeepDiveSection(block, ctx, service, sid + "-dd-" + deepDiveIndex));
          deepDiveIndex++;
        } else if (expertise?.serviceExplanations[1]) {
          sections.push({
            type: "deepDive",
            heading: spec.heading,
            body: expertise.serviceExplanations[1],
            bullets: pickItems(expertise.clinicalConcepts, 4, sid + "-dd-fallback"),
          });
        }
        break;
      }

      case "localExpansion":
        sections.push({
          type: "localExpansion",
          heading: spec.heading.replace("{town}", ctx.town),
          body: localAreas.length
            ? `${ctx.pharmacyName} supports patients across ${ctx.town} including ${localAreas.slice(0, 3).join(", ")} with convenient ${service.serviceName.toLowerCase()} access.`
            : `${ctx.pharmacyName} provides ${service.serviceName.toLowerCase()} for patients in ${ctx.town} and surrounding communities.`,
          bullets: pickItems(intel.localRelevanceSignals, 4, sid + "-local-exp"),
        });
        break;

      default:
        break;
    }
  }

  if (expansion.relatedTopicLinks.length) {
    sections.push({
      type: "relatedTopics",
      heading: "Related Pharmacy Services",
      body: `Patients accessing ${service.serviceName.toLowerCase()} often benefit from complementary services available at ${ctx.pharmacyName}:`,
      bullets: pickItems(expansion.relatedTopicLinks, 4, sid + "-related"),
    });
  }

  return sections;
}

function buildAuthoritySections(
  ctx: GenerationContext,
  service: ServiceOpportunity,
  authority: ServiceAuthorityProfile,
): ServicePageSection[] {
  const sid = normalizeServiceId(service.serviceKey);
  const sections: ServicePageSection[] = [];

  if (authority.professionalInsights.length) {
    sections.push({
      type: "professionalInsight",
      heading: `Professional Insight: ${service.serviceName}`,
      body: pickItems(authority.professionalInsights, 2, sid + "-insight").join(" "),
      bullets: pickItems(authority.bestPracticeGuidance, 4, sid + "-best"),
    });
  }

  if (authority.commonPatientMistakes.length) {
    sections.push({
      type: "commonMistakes",
      heading: "Common Mistakes To Avoid",
      body: `Experienced pharmacy clinicians frequently help patients avoid preventable errors. With ${service.serviceName.toLowerCase()}, these are the mistakes we see most often:`,
      bullets: pickItems(authority.commonPatientMistakes, 5, sid + "-mistakes"),
    });
  }

  if (authority.patientEducationTopics.length) {
    sections.push({
      type: "patientEducation",
      heading: "Patient Education",
      body: `${ctx.pharmacyName} provides clear, educational guidance so you understand ${service.serviceName.toLowerCase()} before committing to treatment or supply:`,
      bullets: pickItems(authority.patientEducationTopics, 5, sid + "-edu"),
    });
  }

  if (authority.mythVsFact.length) {
    const entries = pickItems(authority.mythVsFact, 3, sid + "-mvf");
    sections.push({
      type: "mythVsFact",
      heading: "Myths Vs Facts",
      body: `Evidence-based pharmacy advice helps separate common misconceptions from clinically accurate information:`,
      bullets: entries.map((e) => `Myth: ${e.myth} Fact: ${e.fact}`),
    });
  }

  if (authority.safetyConsiderations.length || authority.whenToSeekAdvice.length) {
    sections.push({
      type: "safetyConsiderations",
      heading: "Safety And When To Seek Advice",
      body: authority.authorityStatements[1] || authority.authorityStatements[0] ||
        `Patient safety is central to every ${service.serviceName.toLowerCase()} consultation.`,
      bullets: pickItems([...authority.whenToSeekAdvice, ...authority.safetyConsiderations], 6, sid + "-safety"),
    });
  }

  return sections;
}

function buildFaqs(
  ctx: GenerationContext,
  service: ServiceOpportunity,
  intel: ServiceIntelligenceProfile,
  bi: BiServiceEntry | null,
  expertise: ServiceExpertiseProfile | null,
  expansion: ServiceExpansionProfile | null,
  authority: ServiceAuthorityProfile | null,
): ServicePageFaq[] {
  const concernPool = (expertise?.patientConcerns || []).filter(
    (c) => !isCatalogFallbackConcern(c, service.serviceName),
  );
  const pool = uniqueStrings([
    ...intel.commonQuestions,
    ...(bi?.faqs || []),
    ...(expansion?.expandedFaqQuestions || []),
    ...(authority?.patientQuestionsWeOftenHear || []),
    ...concernPool,
    ...intel.faqTopics,
  ]);
  const faqCount = expansion?.contentTargets.minFaqCount || 10;
  const selected = pickItems(pool, faqCount, service.serviceKey + "-faqs");
  return selected.map((question) => ({
    question,
    answer: answerFaq(question, ctx, service, intel, expertise, authority),
  }));
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = String(item || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Merge duplicate condition sections and drop repeated card grids on the same page. */
function dedupeServicePageSections(sections: ServicePageSection[]): ServicePageSection[] {
  const out: ServicePageSection[] = [];

  for (const section of sections) {
    if (section.type !== "conditionsCovered") {
      out.push(section);
      continue;
    }

    const existingIdx = out.findIndex((s) => s.type === "conditionsCovered");
    if (existingIdx < 0) {
      out.push({ ...section, bullets: [...section.bullets] });
      continue;
    }

    const existing = out[existingIdx];
    if (section.heading.includes("What Is") && !existing.heading.includes("What Is")) {
      existing.body = `${section.body} ${existing.body}`.trim();
    } else if (!section.heading.includes("What Is")) {
      if (existing.heading.includes("What Is") && section.bullets.length) {
        existing.heading = section.heading;
      } else if (!existing.heading.includes("What Is")) {
        existing.heading = section.heading;
      }
      if (section.body && !existing.body.includes(section.body.slice(0, 40))) {
        existing.body = existing.body ? `${existing.body} ${section.body}` : section.body;
      }
    }
    existing.bullets = uniqueStrings([...existing.bullets, ...section.bullets]).slice(0, 7);
  }

  return out;
}

function buildCta(ctx: GenerationContext, intel: ServiceIntelligenceProfile, serviceId: string): ServicePageCta {
  const options = intel.ctaOptions.length ? intel.ctaOptions : ["Book Consultation", "Speak To Our Team", "Call Today"];
  const primary = pickItems(options, 1, serviceId + "-cta-p")[0];
  const secondary = pickItems(options.filter((o) => o !== primary), 1, serviceId + "-cta-s")[0] || "Request Advice";
  return {
    primary,
    secondary,
    phonePrompt: `Call ${ctx.pharmacyName} in ${ctx.town} to ${primary.toLowerCase()}.`,
    bookingPrompt: `${primary} for this service — our team will confirm availability and eligibility.`,
  };
}

function buildSchema(
  ctx: GenerationContext,
  service: ServiceOpportunity,
  intel: ServiceIntelligenceProfile,
  page: { metaDescription: string; faqs: ServicePageFaq[] },
): Record<string, unknown> {
  const schemaType = intel.schemaType || "MedicalClinic";
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: `${service.serviceName} — ${ctx.pharmacyName}`,
    description: page.metaDescription,
    areaServed: {
      "@type": "City",
      name: ctx.town,
    },
    provider: {
      "@type": "Pharmacy",
      name: ctx.pharmacyName,
      address: {
        "@type": "PostalAddress",
        addressLocality: ctx.town,
        postalCode: ctx.postcode || undefined,
        addressRegion: ctx.localAuthority || undefined,
      },
    },
  };

  if (page.faqs.length) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        base,
        {
          "@type": "FAQPage",
          mainEntity: page.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        },
      ],
    };
  }

  return base;
}

function buildAiSummary(
  ctx: GenerationContext,
  service: ServiceOpportunity,
  intel: ServiceIntelligenceProfile,
  expertise: ServiceExpertiseProfile | null,
  sections: ServicePageSection[],
  expansion: ServiceExpansionProfile | null,
  authority: ServiceAuthorityProfile | null,
): string {
  const concepts = expertise?.clinicalConcepts.slice(0, 3).join(", ") || "";
  const terminology = expertise?.serviceTerminology.slice(0, 2).join(" and ") || service.serviceName;
  const explanation = expertise?.serviceExplanations[0] || intel.description;
  const sectionTopics = sections
    .filter((s) => s.type !== "faqs" && s.type !== "cta")
    .slice(0, 5)
    .map((s) => s.heading)
    .join(", ");
  const depthNote = expansion?.deepDiveBlocks.length
    ? ` Includes expanded guidance on ${expansion.deepDiveBlocks.slice(0, 2).map((b) => b.heading.toLowerCase()).join(" and ")}.`
    : "";
  const authorityNote = authority?.professionalInsights[0]
    ? ` ${authority.professionalInsights[0]}`
    : "";
  const educationNote = authority?.patientEducationTopics.length
    ? ` Patient education covers ${authority.patientEducationTopics.slice(0, 2).join(" and ").toLowerCase()}.`
    : "";
  return `${ctx.pharmacyName} offers ${service.serviceName} in ${ctx.town}. ${explanation}${concepts ? ` Clinical focus includes ${concepts.toLowerCase()}.` : ""} Consultation covers ${terminology.toLowerCase()}.${depthNote}${authorityNote}${educationNote} Topics: ${sectionTopics.toLowerCase()}. Eligibility confirmed at assessment; GP referral when appropriate.`;
}

function getSectionPlan(serviceId: string, category: string): SectionPlan[] {
  const id = normalizeServiceId(serviceId);
  if (SERVICE_SECTION_PLANS[id]) return SERVICE_SECTION_PLANS[id];
  return CATEGORY_SECTION_PLANS[category] || CATEGORY_SECTION_PLANS["nhs-clinical"];
}

function generateServicePage(
  ctx: GenerationContext,
  service: ServiceOpportunity,
  serviceIndex: number,
): GeneratedServicePage {
  const serviceId = normalizeServiceId(service.serviceKey);
  const intel = loadServiceIntelligenceProfile(serviceId);
  if (!intel) {
    throw new Error(`Service intelligence not found for "${serviceId}". Build Service Intelligence first.`);
  }

  const expertise = loadServiceExpertiseProfile(serviceId);
  const expansion = loadServiceExpansionProfile(serviceId);
  const authority = loadServiceAuthorityProfile(serviceId);

  const bi = findBiService(serviceId, loadPharmacyBusinessIntelligence(ctx.slug));
  const localAreas = pickItems(ctx.selectedAreas, 3, serviceId + "-areas");
  const styleIndex = hashSeed(serviceId) + serviceIndex;

  const h1 =
    serviceId === "pharmacy-first"
      ? `Pharmacy First in ${ctx.town}`
      : serviceId === "prescription-delivery"
        ? `Prescription Delivery in ${ctx.town}`
        : `${service.serviceName} at ${ctx.pharmacyName}`;

  const metaTitle = `${service.serviceName} ${ctx.town} | ${ctx.pharmacyName}`.slice(0, 65);
  const metaDescriptionRaw =
    expertise?.serviceExplanations[0] ||
    `${service.serviceName} at ${ctx.pharmacyName}, ${ctx.town}. ${intel.patientBenefits.slice(0, 2).join(". ")}.`;
  let metaDescription = publishMetaDescription(metaDescriptionRaw);

  let intro = buildIntro(ctx, service, intel, bi, expertise, styleIndex);

  const usePublishFramework = usesPublishFramework(serviceId);

  const plans = getSectionPlan(serviceId, intel.category);
  const sections: ServicePageSection[] = [];
  for (const plan of plans) {
    if (plan.type === "faqs") continue;
    sections.push(buildSectionContent(plan, ctx, service, intel, bi, expertise, localAreas));
  }

  const expansionSections = !usePublishFramework && expansion
    ? buildExpansionSections(ctx, service, intel, expertise, expansion, localAreas)
    : [];
  const ctaIndex = sections.findIndex((s) => s.type === "cta");
  if (expansionSections.length) {
    if (ctaIndex >= 0) {
      sections.splice(ctaIndex, 0, ...expansionSections);
    } else {
      sections.push(...expansionSections);
    }
  }

  const enrichedBlueprint = getEnrichedBlueprint(serviceId);
  let usesEnrichedBlueprint = false;
  let faqSourceEnrichedBlueprint = false;
  let mythSourceEnrichedBlueprint = false;
  let authoritySourceEnrichedBlueprint = false;
  let patientQuestionsSourceEnrichedBlueprint = false;

  if (!usePublishFramework && enrichedBlueprint) {
    usesEnrichedBlueprint = true;
    const blueprintSections = buildServicePageBlueprintSections(
      enrichedBlueprint,
      ctx.pharmacyName,
      ctx.town,
      localAreas,
    )
      .filter((bs) => !sections.some((s) => s.type === bs.type))
      .map((bs) => ({
        type: bs.type,
        heading: bs.heading,
        body: bs.body,
        bullets: bs.bullets,
      }));
    mythSourceEnrichedBlueprint = blueprintSections.some((s) => s.type === "mythVsFact");
    authoritySourceEnrichedBlueprint = blueprintSections.some((s) => s.type === "authorityInsights");
    patientQuestionsSourceEnrichedBlueprint = enrichedBlueprint.patientQuestions.length > 0;
    const blueprintInsertAt = sections.findIndex((s) => s.type === "cta");
    if (blueprintSections.length) {
      if (blueprintInsertAt >= 0) {
        sections.splice(blueprintInsertAt, 0, ...blueprintSections);
      } else {
        sections.push(...blueprintSections);
      }
    }
  }

  const authoritySkipTypes = new Set(["mythVsFact", "safetyConsiderations", "authorityInsights"]);
  const authoritySections =
    !usePublishFramework && authority
      ? buildAuthoritySections(ctx, service, authority).filter(
          (s) => !(usesEnrichedBlueprint && authoritySkipTypes.has(s.type)),
        )
      : [];
  const ctaIndexAfterExpansion = sections.findIndex((s) => s.type === "cta");
  if (authoritySections.length) {
    if (ctaIndexAfterExpansion >= 0) {
      sections.splice(ctaIndexAfterExpansion, 0, ...authoritySections);
    } else {
      sections.push(...authoritySections);
    }
  }

  let faqs = buildFaqs(ctx, service, intel, bi, expertise, expansion, authority);
  if (!usePublishFramework && enrichedBlueprint) {
    const blueprintFaqs = selectBlueprintFaqs(enrichedBlueprint, "service", serviceId, 16);
    faqSourceEnrichedBlueprint = blueprintFaqs.length >= 8;
    if (blueprintFaqs.length >= 10) {
      faqs = blueprintFaqs;
    } else {
      faqs = mergeBlueprintFaqs(blueprintFaqs, faqs, 16);
    }
  }

  const conversionProfile = conversionProfileFromData({
    pharmacyName: ctx.pharmacyName,
    townCity: ctx.town,
    phone: ctx.phone,
    postcode: ctx.postcode,
    county: ctx.county,
    businessEmail: ctx.businessEmail,
    nhsEmail: ctx.nhsEmail,
    bookingUrl: ctx.bookingUrl,
  });
  const conversionLayer = buildConversionLayer(serviceId, service.serviceName, "service", conversionProfile);
  if (!usePublishFramework) {
    const ctaInsertAt = sections.findIndex((s) => s.type === "cta");
    if (ctaInsertAt >= 0) {
      sections.splice(ctaInsertAt, 0, ...conversionLayer.sections);
    } else {
      sections.push(...conversionLayer.sections);
    }
  }
  const cta = mergeConversionCta(buildCta(ctx, intel, serviceId), conversionLayer);

  const dedupedSections = dedupeServicePageSections(sections);
  sections.splice(0, sections.length, ...dedupedSections);

  if (!usePublishFramework && enrichedBlueprint) {
    intro = enrichIntroFromBlueprint(intro, enrichedBlueprint, "service");
  }
  intro = publishHeroIntro(intro);

  if (usePublishFramework) {
    const framed = applyPublishFrameworkToServicePage({
      serviceId,
      serviceName: service.serviceName,
      pharmacyName: ctx.pharmacyName,
      town: ctx.town,
      intro,
      metaDescription,
      faqs,
      sections,
      intel,
      expertise,
      authority,
      answerQuestion: (question) => answerFaq(question, ctx, service, intel, expertise, authority),
    });
    intro = framed.intro;
    metaDescription = framed.metaDescription;
    faqs = framed.faqs;
    sections.splice(0, sections.length, ...framed.sections);
  } else {
    faqs = prepareFaqsForPublish(
      faqs,
      {
        serviceName: service.serviceName,
        serviceId,
        pharmacyName: ctx.pharmacyName,
        town: ctx.town,
      },
      (question) => answerFaq(question, ctx, service, intel, expertise, authority),
    );
  }

  const pageSlug = serviceId;

  const draft = {
    metaDescription,
    faqs,
  };

  const aiSummary = buildAiSummary(ctx, service, intel, expertise, sections, expansion, authority);
  const schema = buildSchema(ctx, service, intel, draft);

  const expansionOnlySections = sections.filter((s) =>
    ["deepDive", "preparationGuide", "timeline", "comparison", "localExpansion", "relatedTopics"].includes(s.type),
  );
  const expansionWordCount = countExpansionWords(expansionOnlySections);
  const wordTarget = expansion?.contentTargets.minWordCount || 0;

  const allText = [
    intro,
    metaDescription,
    aiSummary,
    ...sections.flatMap((s) => [s.heading, s.body, ...s.bullets]),
    ...faqs.flatMap((f) => [f.question, f.answer]),
    cta.phonePrompt || "",
    cta.bookingPrompt || "",
  ].join(" ");

  const expertiseTerms = expertise ? countExpertiseTerms(allText, expertise) : { clinicalConceptCount: 0, serviceTerminologyCount: 0 };
  const authorityTerms = authority ? countAuthorityTerms(allText, authority) : {
    authorityInsightCount: 0,
    mythVsFactCount: 0,
    patientEducationCount: 0,
    commonMistakeCount: 0,
  };
  const genericFallbackCount = faqs.filter((f) => isGenericAnswer(f.answer)).length;

  const qualitySignals: ServicePageQualitySignals = {
    wordCount: countWords(allText),
    sectionCount: sections.length,
    faqCount: faqs.length,
    localReferenceCount: countLocalReferences(
      allText,
      ctx.selectedAreas,
      ctx.town,
      ctx.pharmacyName,
      ctx.postcode,
      ctx.county,
    ),
    usesServiceIntelligence: true,
    usesBusinessIntelligence: !!bi,
    usesLocalIntelligence: ctx.selectedAreas.length > 0,
    usesServiceExpertise: !!expertise,
    clinicalConceptCount: expertiseTerms.clinicalConceptCount,
    serviceTerminologyCount: expertiseTerms.serviceTerminologyCount,
    genericFallbackCount,
    usesContentExpansion: !!expansion,
    expansionSectionCount: expansionSections.length,
    expansionWordCount,
    meetsWordTarget: wordTarget > 0 ? countWords(allText) >= wordTarget : false,
    usesAuthorityLayer: !!authority,
    authorityInsightCount: authorityTerms.authorityInsightCount,
    mythVsFactCount: authorityTerms.mythVsFactCount,
    patientEducationCount: authorityTerms.patientEducationCount,
    commonMistakeCount: authorityTerms.commonMistakeCount,
    usesEnrichedBlueprint,
    faqSourceEnrichedBlueprint,
    mythSourceEnrichedBlueprint,
    authoritySourceEnrichedBlueprint,
    patientQuestionsSourceEnrichedBlueprint,
    usesConversionLayer: conversionLayer.meta.usesConversionLayer,
    conversionReassuranceCount: conversionLayer.meta.reassuranceCardCount,
  };

  return {
    serviceId,
    serviceName: service.serviceName,
    slug: ctx.slug,
    pageSlug,
    generatedAt: new Date().toISOString(),
    metaTitle,
    metaDescription,
    h1,
    intro,
    sections,
    faqs,
    cta,
    schema,
    aiSummary,
    qualitySignals,
  };
}

function buildContext(slug: string): GenerationContext {
  const profile = loadPharmacyProfile(slug);
  const blueprint = loadPharmacyContentBlueprint(slug);
  if (!blueprint) {
    throw new Error(`Content Blueprint not found for "${slug}". Generate a Content Blueprint first.`);
  }
  if (!blueprint.serviceOpportunities?.length) {
    throw new Error("Content Blueprint has no service opportunities. Select services and regenerate the blueprint.");
  }

  let hasBusinessIntelligence = false;
  try {
    loadPharmacyBusinessIntelligence(slug);
    hasBusinessIntelligence = true;
  } catch {
    hasBusinessIntelligence = false;
  }

  const local = getLocalIntelligence(slug);
  const profileData = profile.data || {};

  return {
    slug,
    pharmacyName: cleanPharmacyName(
      blueprint.pharmacyName || String(profileData.pharmacyName || profileData.tradingName || ""),
    ),
    town: blueprint.primaryLocation || String(profileData.townCity || local.town || "your area"),
    postcode: String(profileData.postcode || ""),
    localAuthority: String(profileData.localAuthority || local.localAuthority || ""),
    selectedAreas: (local.selectedAreas || []).filter(Boolean).slice(0, 4),
    phone: String(profileData.phone || ""),
    businessEmail: String(profileData.businessEmail || profileData.email || ""),
    nhsEmail: String(profileData.nhsEmail || ""),
    bookingUrl: String(profileData.bookingUrl || ""),
    county: String(profileData.county || ""),
    blueprint,
    hasBusinessIntelligence,
    hasLocalIntelligence: (local.selectedAreas || []).length > 0,
  };
}

export function loadGeneratedServicePage(slug: string, serviceId: string): GeneratedServicePage | null {
  return readJson<GeneratedServicePage>(servicePagePath(slug, serviceId));
}

export function loadGeneratedServicePagesIndex(slug: string): GeneratedServicePagesIndex | null {
  return readJson<GeneratedServicePagesIndex>(servicePagesIndexPath(slug));
}

export function loadAllGeneratedServicePages(slug: string): {
  index: GeneratedServicePagesIndex | null;
  pages: GeneratedServicePage[];
} {
  const index = loadGeneratedServicePagesIndex(slug);
  const dir = pharmacyPagesDir(slug);
  if (!fs.existsSync(dir)) return { index, pages: [] };

  const pages = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => readJson<GeneratedServicePage>(path.join(dir, f)))
    .filter(Boolean) as GeneratedServicePage[];

  pages.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
  return { index, pages };
}

export function getServicePagesStatus(slug: string): {
  hasProfile: boolean;
  hasBusinessIntelligence: boolean;
  hasLocalIntelligence: boolean;
  hasServiceLibrary: boolean;
  hasServiceIntelligence: boolean;
  hasContentBlueprint: boolean;
  serviceBlueprintCount: number;
  generatedPageCount: number;
  lastGeneratedAt: string | null;
} {
  let hasProfile = false;
  let hasBusinessIntelligence = false;
  let hasLocalIntelligence = false;
  let hasServiceLibrary = false;
  let hasContentBlueprint = false;
  let serviceBlueprintCount = 0;

  try {
    loadPharmacyProfile(slug);
    hasProfile = true;
  } catch { /* empty */ }
  try {
    loadPharmacyBusinessIntelligence(slug);
    hasBusinessIntelligence = true;
  } catch { /* empty */ }
  try {
    const local = getLocalIntelligence(slug);
    hasLocalIntelligence = (local.selectedAreas || []).length > 0;
  } catch { /* empty */ }
  try {
    const lib = loadPharmacyServiceLibrary(slug);
    hasServiceLibrary = lib.selectedServices.length > 0;
  } catch { /* empty */ }

  const blueprint = loadPharmacyContentBlueprint(slug);
  if (blueprint) {
    hasContentBlueprint = true;
    serviceBlueprintCount = blueprint.serviceOpportunities?.length || 0;
  }

  const index = loadGeneratedServicePagesIndex(slug);
  const siStatus = fs.existsSync(path.join(WORKSPACE_ROOT, "data/pharmacy-service-intelligence/_index.json"));

  return {
    hasProfile,
    hasBusinessIntelligence,
    hasLocalIntelligence,
    hasServiceLibrary,
    hasServiceIntelligence: siStatus,
    hasContentBlueprint,
    serviceBlueprintCount,
    generatedPageCount: index?.pageCount || 0,
    lastGeneratedAt: index?.generatedAt ?? null,
  };
}

export function generatePharmacyServicePages(slug: string): {
  index: GeneratedServicePagesIndex;
  pages: GeneratedServicePage[];
} {
  const ctx = buildContext(slug);
  const pages: GeneratedServicePage[] = [];

  fs.mkdirSync(pharmacyPagesDir(slug), { recursive: true });

  ctx.blueprint.serviceOpportunities.forEach((service, index) => {
    const page = generateServicePage(ctx, service, index);
    writeJson(servicePagePath(slug, page.serviceId), page);
    pages.push(page);
  });

  pages.sort((a, b) => a.serviceName.localeCompare(b.serviceName));

  const index: GeneratedServicePagesIndex = {
    slug,
    generatedAt: new Date().toISOString(),
    pageCount: pages.length,
    pages: pages.map((p) => ({
      serviceId: p.serviceId,
      serviceName: p.serviceName,
      pageSlug: p.pageSlug,
      sectionCount: p.qualitySignals.sectionCount,
      faqCount: p.qualitySignals.faqCount,
      wordCount: p.qualitySignals.wordCount,
      generatedAt: p.generatedAt,
    })),
  };

  writeJson(servicePagesIndexPath(slug), index);
  return { index, pages };
}
