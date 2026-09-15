/**
 * Shared pharmacy template utilities for non-Clinical-NHS families.
 * Clinical NHS renderer remains separate and unchanged.
 */

import {
  familyAccentColor,
  renderHeroTrustRow,
  renderPharmacyBrandStyles,
  renderSiteFooter,
  renderSiteHeader,
} from "./pharmacyBrandSystem.ts";
import {
  renderPharmacyImageSlot,
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
} from "./pharmacyImageLibrary.ts";

export interface PharmacyPreviewConfig {
  pharmacyName: string;
  domain: string;
  phone?: string;
  email?: string;
  address?: string;
  previewBasePath?: string;
}

export interface MiniCampaignBlueprint {
  campaignIdentity: Record<string, unknown>;
  hubBlueprint: Record<string, unknown>;
  clusterBlueprints: Record<string, unknown>[];
  complianceGuardrails: Record<string, unknown>;
}

export interface FamilyRendererContext {
  pageType: "hub" | "cluster";
  serviceIntelligence: Record<string, unknown>;
  templateFamily: Record<string, unknown>;
  preview: PharmacyPreviewConfig;
  blueprint: MiniCampaignBlueprint;
  clusterBlueprint?: Record<string, unknown>;
}

export interface ContextualLinkCandidate {
  href: string;
  label: string;
  kind: "hub" | "cluster" | "related-service" | "money-page";
}

interface ProcessStep {
  title: string;
  text: string;
}

interface FamilyCtaSet {
  heroPrimary: string;
  heroSecondary: string;
  footerPrimary: string;
  footerSecondary: string;
  footerTertiary: string;
  footerIntro: string;
}

interface FamilyTemplateConfig {
  processSteps: (serviceName: string, preview: PharmacyPreviewConfig, location: string) => ProcessStep[];
  ctas: FamilyCtaSet;
  benefitsTitle: string;
  benefitHeading: (benefit: string, index: number) => string;
  buildDedicatedSections: (ctx: FamilyRendererContext, location: string, serviceName: string) => string;
  contextualSectionIds: string[];
}

const CLUSTER_AREAS = [
  { area: "Aston", slugSuffix: "aston" },
  { area: "Bramley", slugSuffix: "bramley" },
  { area: "Rawmarsh", slugSuffix: "rawmarsh" },
  { area: "Wickersley", slugSuffix: "wickersley" },
];

const GENERIC_BENEFIT_RE =
  /^professional pharmacist oversight|^convenient local access|^clear advice from a qualified|^reduced need to wait|^confidential consultation in a private|^extended opening hours|^integrated with your wider|^trusted regulated healthcare|^support for carers/i;

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function extractUsp(si: Record<string, unknown>): string {
  const benefits = (si.serviceBenefits as string[]) ?? [];
  const distinctive = benefits.find((b) => !GENERIC_BENEFIT_RE.test(b.trim()));
  if (distinctive) return distinctive.replace(/\.$/, "").trim();
  const short = String((si.serviceProfile as Record<string, unknown>)?.shortDescription ?? "");
  if (short) return short.split(".")[0]?.trim() ?? short;
  return "";
}

export function resolveTokens(text: string, preview: PharmacyPreviewConfig, location?: string): string {
  return resolveAllTokens(text, preview, { location });
}

export function resolveAllTokens(
  text: string,
  preview: PharmacyPreviewConfig,
  opts: { location?: string; serviceName?: string; usp?: string } = {},
): string {
  const location = opts.location ?? "Rotherham";
  const usp = (opts.usp ?? "").trim();
  const serviceName = opts.serviceName ?? "";

  let out = text
    .replace(/\{pharmacyName\}/g, preview.pharmacyName)
    .replace(/\{domain\}/g, preview.domain)
    .replace(/\{location\}/g, location)
    .replace(/\{city\}/g, location)
    .replace(/\{locationSlug\}/g, location.toLowerCase().replace(/\s+/g, "-"))
    .replace(/\{service\}/g, serviceName);

  if (usp) {
    out = out.replace(/\{usp\}/g, usp);
  } else {
    out = out
      .replace(/\.\s*\{usp\}\.\s*/gi, ". ")
      .replace(/\s*\{usp\}\.\s*/gi, " ")
      .replace(/\s*\{usp\}\s*/gi, " ");
  }

  out = out.replace(/\{[a-zA-Z]+\}/g, "").replace(/\s{2,}/g, " ").replace(/\.\s*\./g, ".").trim();
  return out;
}

export function previewHref(slug: string, preview: PharmacyPreviewConfig): string {
  const base = preview.previewBasePath ?? "..";
  if (slug.startsWith("http")) return slug;
  return `${base}/${slug}/index.html`;
}

export function telHref(phone?: string): string {
  if (!phone) return "#";
  return `tel:${phone.replace(/\s+/g, "")}`;
}

export function benefitToHeading(benefit: string): string {
  const words = benefit.replace(/\.$/, "").trim().split(/\s+/).slice(0, 5);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Pharmacy Support";
}

function distinctBenefits(si: Record<string, unknown>, limit = 6): string[] {
  const all = ((si.serviceBenefits as string[]) ?? []).filter((b) => !GENERIC_BENEFIT_RE.test(b.trim()));
  return (all.length ? all : ((si.serviceBenefits as string[]) ?? [])).slice(0, limit);
}

function card(title: string, body: string): string {
  return `<div class="card"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
}

function sectionBlock(id: string, title: string, intro: string, inner: string, soft = false): string {
  return `<section${soft ? ' class="soft"' : ""} id="${id}">
<div class="wrap">
<div class="section-head"><h2>${esc(title)}</h2>${intro ? `<p>${esc(intro)}</p>` : ""}</div>
${inner}
</div>
</section>`;
}

const FAMILY_CONFIGS: Record<string, FamilyTemplateConfig> = {
  "vaccination-services": {
    processSteps: (serviceName, preview, location) => [
      { title: "Check eligibility", text: `Confirm whether you qualify for NHS ${serviceName} or a private option. The team at ${preview.pharmacyName} in ${location} can advise.` },
      { title: "Book or ask in pharmacy", text: "Call, book online where available, or ask in store about walk-in jab availability during flu season." },
      { title: "Vaccination appointment", text: "A trained vaccinator reviews your history, explains the vaccine and administers the jab in a suitable setting." },
      { title: "Aftercare advice", text: "You receive guidance on common side effects, when to seek help, and any follow-up if a second dose is needed." },
    ],
    ctas: {
      heroPrimary: "Check vaccine availability",
      heroSecondary: "Speak to the pharmacy team",
      footerPrimary: "Book a vaccination",
      footerSecondary: "Check vaccine availability",
      footerTertiary: "Speak to the pharmacy team",
      footerIntro: "Ask about seasonal flu vaccination availability in {location} or call to check NHS and private options.",
    },
    benefitsTitle: "Why Get Your Flu Jab Here",
    benefitHeading: (b, i) => {
      const map = ["Walk-In Or Booked Jab Access", "Community Flu Protection", "Seasonal Immunisation Support", "Pharmacist-Led Vaccination Care", "Local High-Street Convenience", "Family And Carer Jab Support"];
      return map[i] ?? benefitToHeading(b);
    },
    contextualSectionIds: ["service-overview", "service-vaccine-eligibility", "service-seasonal-timing", "service-vaccine-safety", "service-process"],
    buildDedicatedSections: (ctx, location, serviceName) => {
      const profile = ctx.serviceIntelligence.serviceProfile as Record<string, unknown>;
      const secondary = ((profile.secondaryAudience as string[]) ?? []).join("; ");
      return [
        sectionBlock(
          "service-vaccine-eligibility",
          "Vaccine Eligibility",
          "Who can receive this immunisation and how NHS eligibility is assessed.",
          `<div class="grid-2">${card("NHS eligible groups", String(profile.primaryAudience ?? "Patients in eligible NHS groups as defined by current seasonal programme guidance."))}${card("Private options", secondary || "Private flu vaccination may be available for patients outside NHS groups — confirm current availability and fees.")}</div>`,
        ),
        sectionBlock(
          "service-seasonal-timing",
          "Seasonal Availability & Timing",
          "Flu vaccination is seasonal — book early in the programme where possible.",
          `<div class="grid-2">${card("When to book", "Autumn and early winter are the busiest periods. Contact the pharmacy to confirm stock and appointment slots in " + location + ".")}${card("Walk-in or appointment", "Some patients can walk in during advertised clinic times; others may need a booked slot. Call ahead during peak season.")}</div>`,
        ),
        sectionBlock(
          "service-vaccine-expect",
          "What To Expect At Your Appointment",
          "",
          `<div class="grid-2">${card("Before your jab", "Bring any relevant medical information. The vaccinator checks suitability and answers questions about the vaccine.")}${card("During the appointment", "The injection is usually quick. You may be asked to wait briefly afterwards for observation where clinically appropriate.")}</div>`,
        ),
        sectionBlock(
          "service-vaccine-safety",
          "Vaccine Safety & Side Effects",
          "Immunisation is widely used — your vaccinator provides individual safety-netting advice.",
          `<div class="grid-2">${card("Common side effects", "Mild soreness, tiredness or a low-grade temperature can occur. Serious reactions are rare — seek urgent help for severe symptoms.")}${card("When to seek help", "Contact the pharmacy, NHS 111 or your GP if you are concerned after vaccination. Call 999 for emergencies.")}</div>`,
        ),
        sectionBlock(
          "service-nhs-private",
          "NHS & Private Vaccination Options",
          "",
          `<p>NHS ${serviceName} is offered to eligible groups under the seasonal NHS programme. Private seasonal flu vaccination may also be available for patients who do not meet NHS criteria — fees and availability vary. Contact ${esc(ctx.preview.pharmacyName)} to confirm what applies to you.</p>`,
        ),
      ].join("\n");
    },
  },
  "private-healthcare-services": {
    processSteps: (serviceName, preview, location) => [
      { title: "Book a private appointment", text: `Contact ${preview.pharmacyName} to arrange ${serviceName} at a time that suits you in ${location}.` },
      { title: "Discuss your symptoms", text: "A trained clinician reviews your history, examines where appropriate and explains whether the service is suitable." },
      { title: "Treatment or referral advice", text: "Where appropriate, your procedure or consultation is delivered with clear professional guidance in a private setting." },
      { title: "Aftercare guidance", text: "You receive advice on recovery, ear care and when to seek GP or emergency support if symptoms change." },
    ],
    ctas: {
      heroPrimary: "Book a private appointment",
      heroSecondary: "Ask about availability",
      footerPrimary: "Book a private appointment",
      footerSecondary: "Ask about availability",
      footerTertiary: "Speak to a pharmacist",
      footerIntro: "Book {service} at {pharmacyName} in {location} or call to discuss fees and appointment times.",
    },
    benefitsTitle: "Benefits Of Private Pharmacy Care",
    benefitHeading: (b, i) => {
      const map = ["Safe Professional Ear Care", "Rapid Private Access", "Discreet Consultation Room", "Avoid Lengthy GP Waits", "Trained Clinician Procedure", "Clear Aftercare Guidance"];
      return map[i] ?? benefitToHeading(b);
    },
    contextualSectionIds: ["service-overview", "service-appointment-detail", "service-pricing-transparency", "service-aftercare", "service-process"],
    buildDedicatedSections: (ctx, location, serviceName) => [
      sectionBlock(
        "service-appointment-detail",
        "What Your Appointment Includes",
        "",
        `<div class="grid-2">${card("Initial assessment", "Your clinician reviews symptoms, ear history and suitability for microsuction or irrigation before treatment.")}${card("Procedure time", "Most appointments are completed in a single visit. Duration varies by wax build-up and individual needs.")}</div>`,
      ),
      sectionBlock(
        "service-consultation-expect",
        "What To Expect During Treatment",
        "",
        `<div class="grid-2">${card("During the procedure", `${serviceName} is performed by trained staff using professional equipment in a suitable clinical environment.`)}${card("Comfort measures", "The team explains each step and checks you are comfortable throughout. Stop and ask questions at any time.")}</div>`,
        true,
      ),
      sectionBlock(
        "service-comfort-privacy",
        "Comfort & Privacy",
        "",
        `<p>Private consultations take place in a confidential consultation room at ${esc(ctx.preview.pharmacyName)}. Your care is discreet, professional and focused on your comfort throughout ${esc(serviceName)} in ${esc(location)}.</p>`,
      ),
      sectionBlock(
        "service-pricing-transparency",
        "Pricing & Transparency",
        "Private fees apply — confirm current pricing before booking.",
        `<div class="grid-2">${card("Private service fees", "This is a fee-based private service. Contact the pharmacy for current prices — no hidden charges beyond what is explained at booking.")}${card("NHS vs private", "Routine ear wax removal is not always available on the NHS. Private pharmacy access offers a convenient alternative when clinically appropriate.")}</div>`,
      ),
      sectionBlock(
        "service-aftercare",
        "Aftercare & Signposting",
        "",
        `<div class="grid-2">${card("After your appointment", "You receive guidance on ear care, hearing changes and when to return if symptoms persist.")}${card("When to seek further help", "Contact your GP or NHS 111 if pain, discharge or hearing loss worsens. Call 999 for emergencies.")}</div>`,
        true,
      ),
    ].join("\n"),
  },
  "travel-health-services": {
    processSteps: (serviceName, preview, location) => [
      { title: "Tell us your destination", text: `Share your itinerary, dates and activities so ${preview.pharmacyName} can advise on travel health needs for ${location} patients.` },
      { title: "Review vaccine requirements", text: "A travel health professional reviews recommended and required vaccines based on destination, season and your medical history." },
      { title: "Plan timing before travel", text: "Some vaccines need multiple doses weeks apart. Early booking helps ensure cover before departure." },
      { title: "Receive travel health advice", text: "You leave with a personalised plan covering vaccines, malaria prevention where relevant and general travel medicine guidance." },
    ],
    ctas: {
      heroPrimary: "Book a travel consultation",
      heroSecondary: "Ask about travel vaccines",
      footerPrimary: "Book a travel consultation",
      footerSecondary: "Ask about travel vaccines",
      footerTertiary: "Check before you travel",
      footerIntro: "Plan {service} before you travel — book a consultation at {pharmacyName} in {location}.",
    },
    benefitsTitle: "Why Book Travel Health Here",
    benefitHeading: (b, i) => {
      const map = ["Destination-Aware Vaccine Advice", "Timely Pre-Travel Planning", "Malaria & Travel Medicine Support", "Certificate Documentation Help", "Pharmacist Travel Consultation", "Convenient Local Clinic Access"];
      return map[i] ?? benefitToHeading(b);
    },
    contextualSectionIds: ["service-overview", "service-destination-advice", "service-travel-timing", "service-travel-medicines", "service-process"],
    buildDedicatedSections: (ctx, location, serviceName) => [
      sectionBlock(
        "service-destination-advice",
        "Destination Risk Advice",
        "",
        `<div class="grid-2">${card("Itinerary review", "Risk varies by country, region, season and activities such as rural travel or healthcare work. Share full travel details for tailored advice.")}${card("Required vs recommended", "Some destinations require proof of vaccination. Others have recommended vaccines based on public health guidance — individual assessment applies.")}</div>`,
      ),
      sectionBlock(
        "service-travel-timing",
        "When To Book Before Travel",
        "",
        `<div class="grid-2">${card("Ideal lead time", "Book 6–8 weeks before departure where possible so multi-dose courses can complete on time.")}${card("Last-minute travel", "Some protection can still be arranged closer to departure — contact ${esc(ctx.preview.pharmacyName)} as early as you can.")}</div>`,
        true,
      ),
      sectionBlock(
        "service-travel-medicines",
        "Vaccines, Malaria & Travel Medicines",
        "",
        `<div class="grid-2">${card("Travel vaccinations", `${serviceName} may include hepatitis A/B, typhoid, rabies and other destination-specific vaccines as clinically appropriate.`)}${card("Malaria prophylaxis", "Antimalarial tablets may be recommended for some destinations. A consultation determines suitability — not all travellers need them.")}</div>`,
      ),
      sectionBlock(
        "service-travel-consultation",
        "Travel Consultation Process",
        "",
        `<p>A travel health consultation at ${esc(ctx.preview.pharmacyName)} covers your itinerary, medical history, vaccine schedule and practical advice for safe travel from ${esc(location)}. Records are documented for your trip.</p>`,
      ),
      sectionBlock(
        "service-popular-destinations",
        "Popular Destination Questions",
        "",
        `<div class="grid-3">${card("Africa & Asia", "Yellow fever, typhoid and hepatitis vaccines are commonly discussed. Certificate requirements vary by country.")}${card("Central & South America", "Hepatitis A, typhoid and rabies may be advised depending on your route and activities.")}${card("Middle East & Europe", "Requirements differ widely — a consultation confirms what is appropriate for your specific trip.")}</div>`,
        true,
      ),
    ].join("\n"),
  },
  "weight-management-services": {
    processSteps: (serviceName, preview, location) => [
      { title: "Initial suitability check", text: `Contact ${preview.pharmacyName} to discuss whether ${serviceName} may be appropriate for you in ${location}.` },
      { title: "Consultation and assessment", text: "A pharmacist reviews your history, BMI and goals in a confidential consultation to assess eligibility." },
      { title: "Personal support plan", text: "Where suitable, you receive a structured programme combining lifestyle guidance and monitored pharmacy support." },
      { title: "Monitoring and follow-up", text: "Regular check-ins track progress, side effects and adherence — with referral to GP when needed." },
    ],
    ctas: {
      heroPrimary: "Check suitability",
      heroSecondary: "Book a weight management consultation",
      footerPrimary: "Check suitability",
      footerSecondary: "Book a weight management consultation",
      footerTertiary: "Speak to the pharmacy team",
      footerIntro: "Find out if {service} is right for you at {pharmacyName} in {location}.",
    },
    benefitsTitle: "Programme Benefits",
    benefitHeading: (b, i) => {
      const map = ["Medically Supervised Support", "Structured Weight Management Plan", "Regular Progress Monitoring", "Lifestyle And Nutrition Guidance", "Confidential Pharmacy Consultations", "Safe Evidence-Based Approach"];
      return map[i] ?? benefitToHeading(b);
    },
    contextualSectionIds: ["service-overview", "service-suitability", "service-programme-structure", "service-monitoring", "service-process"],
    buildDedicatedSections: (ctx, location, serviceName) => [
      sectionBlock(
        "service-suitability",
        "Suitability & Eligibility",
        "",
        `<div class="grid-2">${card("Who this programme helps", String((ctx.serviceIntelligence.serviceProfile as Record<string, unknown>).primaryAudience ?? "Adults seeking medically supervised weight management support."))}${card("Individual assessment", "Eligibility depends on BMI, medical history and current medicines. A pharmacist assesses whether the programme is safe and suitable for you.")}</div>`,
      ),
      sectionBlock(
        "service-assessment",
        "Consultation & Assessment",
        "",
        `<div class="grid-2">${card("Initial consultation", "Your pharmacist discusses goals, lifestyle, previous attempts and any conditions that affect treatment options.")}${card("What to expect", "Measurements and a structured conversation form the basis of your personalised plan — no guaranteed outcomes are promised.")}</div>`,
        true,
      ),
      sectionBlock(
        "service-programme-structure",
        "Programme Structure",
        "",
        `<div class="grid-2">${card("Phased support", `${serviceName} combines regular pharmacy reviews with lifestyle coaching and monitored progress over time.`)}${card("GLP-1 and medicines", "Where clinically appropriate and eligible, medicine options may be discussed under pharmacist supervision — individual assessment always applies.")}</div>`,
      ),
      sectionBlock(
        "service-monitoring",
        "Progress Monitoring",
        "",
        `<div class="grid-2">${card("Regular reviews", "Follow-up appointments track weight, wellbeing and any side effects to keep your plan safe and effective.")}${card("BMI and health markers", "Monitoring helps adjust support over time and identify when GP referral is needed.")}</div>`,
      ),
      sectionBlock(
        "service-lifestyle-support",
        "Lifestyle Support",
        "",
        `<p>Sustainable weight management includes nutrition, activity and behaviour support alongside pharmacy monitoring. Your team at ${esc(ctx.preview.pharmacyName)} focuses on long-term habits — not quick-fix promises.</p>`,
        true,
      ),
      sectionBlock(
        "service-medicine-caution",
        "Medicine Advertising & Safety",
        "",
        `<div class="compliance"><h3>Important — weight management medicines</h3><ul><li>Weight loss medicines are not suitable for everyone and require individual clinical assessment.</li><li>Results vary — no guaranteed weight loss outcomes are promised.</li><li>Prescription-only options are not advertised to the public; suitability is assessed in consultation.</li><li>Report side effects promptly and follow pharmacist and GP guidance.</li></ul></div>`,
      ),
    ].join("\n"),
  },
};

function getFamilyConfig(templateKey: string): FamilyTemplateConfig {
  return (
    FAMILY_CONFIGS[templateKey] ?? {
      processSteps: (serviceName, preview) => [
        { title: "Book or visit", text: `Contact ${preview.pharmacyName} about ${serviceName}.` },
        { title: "Consultation", text: "A qualified professional assesses your needs." },
        { title: "Service delivery", text: "Care is provided where clinically appropriate." },
        { title: "Follow-up", text: "You receive safety-netting and follow-up advice." },
      ],
      ctas: {
        heroPrimary: "Book appointment",
        heroSecondary: "Call the pharmacy",
        footerPrimary: "Call the pharmacy",
        footerSecondary: "Ask about service",
        footerTertiary: "Check availability",
        footerIntro: "Contact {pharmacyName} about {service} in {location}.",
      },
      benefitsTitle: "Key Benefits",
      benefitHeading: (b) => benefitToHeading(b),
      contextualSectionIds: ["service-overview", "service-process", "service-benefits", "service-local"],
      buildDedicatedSections: () => "",
    }
  );
}

export function expandPatientFacingFaqAnswer(
  question: string,
  _hint: string,
  preview: PharmacyPreviewConfig,
  location: string,
  serviceName: string,
  templateKey?: string,
): string {
  const q = question.toLowerCase();
  const pharmacy = preview.pharmacyName;

  if (templateKey === "vaccination-services") {
    if (/free|cost|how much|price|nhs/i.test(q)) {
      return `NHS ${serviceName} is free for eligible groups under the seasonal NHS programme. Private vaccination fees may apply for others — contact ${pharmacy} in ${location} for current availability.`;
    }
    if (/side effect|safe|risk/i.test(q)) {
      return `Common vaccine side effects are usually mild. Your vaccinator at ${pharmacy} explains what to expect and when to seek help after ${serviceName}.`;
    }
    if (/eligible|who is|who can/i.test(q)) {
      return `NHS flu vaccination eligibility follows current seasonal NHS guidance. ${pharmacy} can confirm whether you qualify and discuss private options if needed.`;
    }
  }

  if (templateKey === "private-healthcare-services") {
    if (/cost|how much|price|fee/i.test(q)) {
      return `${serviceName} is a private fee-based service at ${pharmacy}. Contact the team for current pricing before booking your appointment in ${location}.`;
    }
    if (/appointment|book|walk/i.test(q)) {
      return `Book a private appointment for ${serviceName} at ${pharmacy}. The team confirms availability, fees and what to expect during your visit.`;
    }
  }

  if (templateKey === "travel-health-services") {
    if (/travel|destination|when|before/i.test(q)) {
      return `Travel vaccine requirements depend on your destination and dates. Book a travel consultation at ${pharmacy} ideally 6–8 weeks before departure from ${location}.`;
    }
    if (/malaria|typhoid|hepatitis|yellow fever/i.test(q)) {
      return `Recommended vaccines and malaria prevention vary by destination. A travel health consultation at ${pharmacy} provides individual advice for your itinerary.`;
    }
  }

  if (templateKey === "weight-management-services") {
    if (/eligible|suitable|who/i.test(q)) {
      return `Eligibility for ${serviceName} depends on BMI, medical history and individual assessment. Book a consultation at ${pharmacy} — no guaranteed outcomes are promised.`;
    }
    if (/glp|medicine|mounjaro|wegovy|ozempic/i.test(q)) {
      return `Medicine options are discussed only after individual clinical assessment at ${pharmacy}. Prescription-only weight loss medicines are not advertised — suitability is reviewed in consultation.`;
    }
    if (/safe|side effect|weight/i.test(q)) {
      return `${serviceName} at ${pharmacy} is medically supervised with regular monitoring. Results vary — your pharmacist provides safety-netting and lifestyle support throughout.`;
    }
  }

  if (/free|cost|how much|price|nhs/i.test(q)) {
    return `${serviceName} may be NHS-funded or privately priced depending on eligibility. Contact ${pharmacy} for current availability and any charges that apply in ${location}.`;
  }
  if (/appointment|walk in|book/i.test(q)) {
    return `Contact ${pharmacy} to book ${serviceName} or ask about walk-in availability in ${location}. The pharmacy team can advise on waiting times and what to bring.`;
  }
  if (/eligible|who is|who can|suitable/i.test(q)) {
    return `Eligibility for ${serviceName} depends on your individual circumstances and the service pathway. A pharmacist or trained team member assesses suitability during your consultation.`;
  }
  if (/what is|how does|how do/i.test(q)) {
    return `${serviceName} is provided by qualified pharmacy professionals at ${pharmacy}. Your pharmacist explains the service scope, what to expect, and safe next steps where appropriate.`;
  }
  if (/how long|take/i.test(q)) {
    return `Appointment length varies by service and individual needs. The pharmacy team at ${pharmacy} can give a typical timeframe when you enquire.`;
  }
  if (/safe|side effect|risk|glp|weight/i.test(q)) {
    return `Your pharmacist provides safety-netting advice as part of ${serviceName}. Always follow professional guidance supplied and read any patient information leaflets provided.`;
  }
  if (/travel|destination|vaccine|jab|flu/i.test(q) && /need|require|when/i.test(q)) {
    return `Requirements for ${serviceName} depend on your travel plans, medical history and destination. Book a consultation at ${pharmacy} so the team can advise what is appropriate for you.`;
  }
  return `Contact ${pharmacy} to ask about ${serviceName} in ${location}. This is general information — a qualified professional assesses your individual case.`;
}

export function buildSchemas(opts: {
  pageUrl: string;
  serviceName: string;
  schemaServiceName: string;
  areaServed: string;
  description: string;
  preview: PharmacyPreviewConfig;
  faqs: { question: string; answer: string }[];
}): string {
  const { pageUrl, serviceName, schemaServiceName, areaServed, description, preview, faqs } = opts;
  const blocks = [
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: preview.pharmacyName,
      url: pageUrl,
      telephone: preview.phone ?? "",
      email: preview.email ?? "",
      address: preview.address
        ? { "@type": "PostalAddress", streetAddress: preview.address, addressLocality: areaServed, addressCountry: "GB" }
        : { "@type": "PostalAddress", addressLocality: areaServed, addressCountry: "GB" },
    },
    {
      "@context": "https://schema.org",
      "@type": "MedicalBusiness",
      name: preview.pharmacyName,
      url: pageUrl,
      medicalSpecialty: "Pharmacy",
      areaServed,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: schemaServiceName,
      serviceType: serviceName,
      description,
      areaServed: { "@type": "Place", name: areaServed },
      provider: { "@type": "MedicalBusiness", name: preview.pharmacyName, url: pageUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ];
  return blocks.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n ");
}

export function getPharmacyStyles(accent = "#005eb8"): string {
  return renderPharmacyBrandStyles(accent);
}

function buildImageRenderContext(
  ctx: FamilyRendererContext,
  location: string,
  serviceName?: string,
): PharmacyImageRenderContext {
  const profile = ctx.serviceIntelligence.serviceProfile as Record<string, unknown>;
  const identity = ctx.blueprint.campaignIdentity;
  return {
    templateFamilyKey: String(ctx.templateFamily.templateKey ?? ""),
    serviceKey: String(identity.serviceKey ?? profile.serviceKey ?? ""),
    serviceName: serviceName ?? String(identity.serviceName),
    pharmacyName: ctx.preview.pharmacyName,
    location,
    previewBasePath: ctx.preview.previewBasePath,
  };
}

export function imageSlot(ctx: FamilyRendererContext, slot: PharmacyImageSlot, location: string, serviceName?: string): string {
  return renderPharmacyImageSlot(slot, buildImageRenderContext(ctx, location, serviceName));
}

export function buildBlueprintFromIntelligence(
  si: Record<string, unknown>,
  templateFamily: Record<string, unknown>,
): MiniCampaignBlueprint {
  const profile = si.serviceProfile as Record<string, unknown>;
  const campaign = si.campaignInputs as Record<string, unknown> | undefined;
  const hubGen = (campaign?.hubGeneration as Record<string, unknown>) ?? {};
  const ctaStrategy = (templateFamily.ctaStrategy as Record<string, unknown>) ?? {};
  const serviceKey = String(profile.serviceKey);
  const serviceName = String(profile.serviceName);
  const location = "Rotherham";
  const locationSlug = "rotherham";
  const hubSlug = `${serviceKey}-${locationSlug}`;
  const usp = extractUsp(si);

  const clusterBlueprints = CLUSTER_AREAS.map((c) => ({
    area: c.area,
    pageSlug: `${serviceKey}-${c.slugSuffix}`,
    anchorText: `${serviceName} ${c.area}`,
    h1: `${serviceName} ${c.area}`,
    metaTitle: `${serviceName} ${c.area} | ${location} | {pharmacyName}`,
    metaDescription: `${serviceName} for ${c.area} — professional pharmacy care serving ${c.area} and ${location} from {pharmacyName}.`,
    localAngle: `Serving ${c.area} and surrounding ${location} neighbourhoods with convenient pharmacy access.`,
    localCta: {
      primary: `Ask about ${serviceName} — ${c.area}`,
      secondary: `Call us from ${c.area}`,
    },
    faqVariants: ((si.customerQuestions as Record<string, unknown>[]) ?? []).slice(0, 5).map((f) => ({
      question: String(f.question).replace(/\{location\}/g, c.area).replace(/near me/i, `in ${c.area}`),
      answerHint: "",
    })),
    internalLinks: {
      hub: { pageSlug: hubSlug, anchorText: `${serviceName} ${location}` },
      nearbyAreas: [] as Record<string, unknown>[],
    },
  }));

  for (let i = 0; i < clusterBlueprints.length; i++) {
    clusterBlueprints[i].internalLinks.nearbyAreas = clusterBlueprints
      .filter((_, j) => j !== i)
      .slice(0, 3)
      .map((c) => ({ area: c.area, pageSlug: c.pageSlug, anchorText: c.anchorText }));
  }

  const trust = si.trustSignals as Record<string, unknown> | undefined;
  const disclaimers = (trust?.complianceConsiderations as string[]) ?? [];
  const familyDisclaimers = (templateFamily.contentRules as Record<string, unknown>)?.requiredDisclaimers as string[] | undefined;

  return {
    campaignIdentity: { serviceName, serviceKey, location, locationSlug, campaignSlug: hubSlug },
    hubBlueprint: {
      pageSlug: hubSlug,
      h1: resolveTokens(String(hubGen.h1Pattern ?? `${serviceName} in ${location}`), { pharmacyName: "{pharmacyName}", domain: "{domain}" }, location),
      metaTitle: String(hubGen.metaTitlePattern ?? `${serviceName} ${location} | {pharmacyName}`),
      metaDescription: String(hubGen.metaDescriptionPattern ?? `${serviceName} in ${location} at {pharmacyName}.`),
      heroPositioning: String(profile.shortDescription ?? ""),
      primaryCta: String(hubGen.ctaPrimary ?? ctaStrategy.primary ?? "Book appointment"),
      secondaryCta: String(hubGen.ctaSecondary ?? ctaStrategy.secondary ?? "Call the pharmacy"),
      eyebrow: String(templateFamily.templateName ?? "Pharmacy Service"),
      usp,
    },
    clusterBlueprints,
    complianceGuardrails: {
      medicalAdviceDisclaimers: [
        "Content is for general information — not a substitute for personal medical advice.",
        "Patients with severe, worsening or emergency symptoms should call 999 or attend A&E.",
        "Pharmacists and trained staff assess suitability individually — not all patients qualify for every pathway.",
        ...(familyDisclaimers ?? []),
        ...disclaimers.slice(0, 3),
      ],
    },
  };
}

function buildTrustPoints(si: Record<string, unknown>): string[] {
  const trust = (si.trustSignals as Record<string, unknown>)?.serviceSpecificTrustFactors as string[] | undefined;
  const defaults = [
    "Qualified GPhC-registered pharmacy team",
    "Professional pharmacy service pathway",
    "Convenient local high-street access",
    "Clear signposting to GP or emergency care when needed",
    "Private consultation room for confidential support",
    "Friendly, patient-centred pharmacist guidance",
  ];
  return (trust?.length ? trust.filter((t) => !/reviews|pricing/i.test(t)) : defaults).slice(0, 6);
}

function buildContextualCandidates(ctx: FamilyRendererContext): ContextualLinkCandidate[] {
  const identity = ctx.blueprint.campaignIdentity;
  const hubSlug = String(identity.campaignSlug);
  const locationSlug = String(identity.locationSlug ?? "rotherham");
  const links = ctx.serviceIntelligence.internalLinkingOpportunities as Record<string, unknown> | undefined;
  const related = (links?.relatedServices as Record<string, unknown>[]) ?? [];
  const parents = (links?.parentServices as Record<string, unknown>[]) ?? [];
  const candidates: ContextualLinkCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: ContextualLinkCandidate) => {
    const k = `${c.kind}:${c.href}`;
    if (seen.has(k)) return;
    seen.add(k);
    candidates.push(c);
  };

  if (ctx.pageType === "hub") {
    for (const cl of ctx.blueprint.clusterBlueprints) {
      add({ href: previewHref(String(cl.pageSlug), ctx.preview), label: String(cl.anchorText), kind: "cluster" });
    }
  } else if (ctx.clusterBlueprint) {
    add({ href: previewHref(hubSlug, ctx.preview), label: String((ctx.clusterBlueprint.internalLinks as Record<string, unknown>)?.hub?.anchorText ?? "Main hub"), kind: "hub" });
    for (const n of ((ctx.clusterBlueprint.internalLinks as Record<string, unknown>)?.nearbyAreas as Record<string, unknown>[]) ?? []) {
      add({ href: previewHref(String(n.pageSlug), ctx.preview), label: String(n.anchorText ?? n.area), kind: "cluster" });
    }
  }
  for (const r of related.slice(0, 4)) {
    add({ href: previewHref(`${String(r.serviceKey)}-${locationSlug}`, ctx.preview), label: String(r.label ?? r.serviceKey), kind: "related-service" });
  }
  for (const p of parents.slice(0, 1)) {
    add({ href: previewHref(`${String(p.serviceKey)}-${locationSlug}`, ctx.preview), label: String(p.label ?? p.serviceKey), kind: "money-page" });
  }
  return candidates;
}

function contextualSentence(c: ContextualLinkCandidate, idx: number, area: string): string {
  const anchor = `<a class="contextual-link contextual-link--${c.kind}" href="${esc(c.href)}">${esc(c.label)}</a>`;
  const patterns: Record<string, string[]> = {
    hub: [` For the wider service overview, see ${anchor}.`, ` To compare the full ${area} service, visit ${anchor}.`],
    cluster: [` Patients in ${area} may also find our ${anchor} information useful.`, ` If you are comparing nearby options, read about ${anchor}.`],
    "related-service": [` You may also want to explore ${anchor} for related pharmacy support.`, ` For complementary services, see ${anchor}.`],
    "money-page": [` Learn more about ${anchor}.`, ` For additional pharmacy support, see ${anchor}.`],
  };
  const list = patterns[c.kind] ?? patterns["money-page"]!;
  return list[idx % list.length]!;
}

export function applyFamilyContextualLinks(html: string, ctx: FamilyRendererContext, areaLabel: string): string {
  const templateKey = String(ctx.templateFamily.templateKey ?? "");
  const config = getFamilyConfig(templateKey);
  const candidates = buildContextualCandidates(ctx);
  if (!candidates.length) return html;
  let idx = 0;
  let patternIdx = 0;
  let pageLinks = 0;
  const used = new Set<string>();

  let output = html;
  for (const sid of config.contextualSectionIds) {
    if (pageLinks >= 8) break;
    const re = new RegExp(`<section[^>]*id="${sid}"[^>]*>[\\s\\S]*?<\\/section>`, "i");
    output = output.replace(re, (section) => {
      const usedSection = new Set<string>();
      return section.replace(/<div class="section-head"[^>]*>[\s\S]*?<\/div>/gi, (block) =>
        block.replace(/<p>([\s\S]*?)<\/p>/gi, (full, body: string) => {
          if (pageLinks >= 8 || /<a\b/i.test(body)) return full;
          while (idx < candidates.length) {
            const c = candidates[idx++]!;
            if (used.has(c.href) || usedSection.has(c.href)) continue;
            used.add(c.href);
            usedSection.add(c.href);
            pageLinks += 1;
            return `<p>${body}${contextualSentence(c, patternIdx++, areaLabel)}</p>`;
          }
          return full;
        }),
      ).replace(/<div class="step"[^>]*>[\s\S]*?<\/div>/gi, (block) =>
        block.replace(/<p>([\s\S]*?)<\/p>/gi, (full, body: string) => {
          if (pageLinks >= 8 || /<a\b/i.test(body)) return full;
          while (idx < candidates.length) {
            const c = candidates[idx++]!;
            if (used.has(c.href) || usedSection.has(c.href)) continue;
            used.add(c.href);
            usedSection.add(c.href);
            pageLinks += 1;
            return `<p>${body}${contextualSentence(c, patternIdx++, areaLabel)}</p>`;
          }
          return full;
        }),
      );
    });
  }
  return output;
}

function familyAccent(templateKey: string): string {
  return familyAccentColor(templateKey);
}

function buildCtaBand(
  config: FamilyTemplateConfig,
  preview: PharmacyPreviewConfig,
  serviceName: string,
  location: string,
  usp: string,
  ctx: FamilyRendererContext,
): string {
  const intro = resolveAllTokens(config.ctas.footerIntro, preview, { location, serviceName, usp })
    .replace(/\{pharmacyName\}/g, preview.pharmacyName)
    .replace(/\{service\}/g, serviceName);
  return `<section class="cta-band" id="service-cta">
<div class="wrap">
<h2>${esc(config.ctas.footerPrimary)}</h2>
<p>${esc(intro)}</p>
<div class="btns" style="justify-content:center">${imageSlot(ctx, "conversion", location, serviceName)}</div>
<div class="btns" style="justify-content:center;margin-top:16px">
<a class="btn" href="${esc(telHref(preview.phone))}">${esc(config.ctas.footerPrimary)}</a>
<a class="btn secondary" href="#service-faq">${esc(config.ctas.footerSecondary)}</a>
<a class="btn secondary" href="${esc(telHref(preview.phone))}">${esc(config.ctas.footerTertiary)}</a>
</div></div>
</section>`;
}

export function renderPharmacyFamilyHub(ctx: FamilyRendererContext): string {
  const si = ctx.serviceIntelligence;
  const profile = si.serviceProfile as Record<string, unknown>;
  const hub = ctx.blueprint.hubBlueprint;
  const identity = ctx.blueprint.campaignIdentity;
  const preview = ctx.preview;
  const location = String(identity.location ?? "Rotherham");
  const serviceName = String(identity.serviceName);
  const slug = String(hub.pageSlug);
  const pageUrl = `https://${preview.domain}/${slug}/`;
  const templateKey = String(ctx.templateFamily.templateKey ?? "");
  const config = getFamilyConfig(templateKey);
  const accent = familyAccent(templateKey);
  const usp = String(hub.usp ?? extractUsp(si));
  const tokenOpts = { location, serviceName, usp };

  const h1 = resolveAllTokens(String(hub.h1), preview, tokenOpts);
  const metaTitle = resolveAllTokens(String(hub.metaTitle), preview, tokenOpts);
  const metaDesc = resolveAllTokens(String(hub.metaDescription ?? profile.shortDescription), preview, tokenOpts);
  const heroText = resolveAllTokens(String(hub.heroPositioning ?? profile.shortDescription), preview, tokenOpts);
  const primaryCta = config.ctas.heroPrimary;
  const secondaryCta = config.ctas.heroSecondary;
  const eyebrow = String(hub.eyebrow ?? ctx.templateFamily.templateName);

  const benefits = distinctBenefits(si);
  const trustPoints = buildTrustPoints(si);
  const trustHero = trustPoints.slice(0, 4);
  const steps = config.processSteps(serviceName, preview, location);
  const faqs = ((si.customerQuestions as Record<string, unknown>[]) ?? []).slice(0, 10).map((f) => ({
    question: String(f.question),
    answer: expandPatientFacingFaqAnswer(String(f.question), "", preview, location, serviceName, templateKey),
  }));

  const related = ((si.internalLinkingOpportunities as Record<string, unknown>)?.relatedServices as Record<string, unknown>[]) ?? [];
  const disclaimers = (ctx.blueprint.complianceGuardrails.medicalAdviceDisclaimers as string[]) ?? [];
  const dedicatedSections = config.buildDedicatedSections(ctx, location, serviceName);

  let html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(metaTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${esc(pageUrl)}">
${buildSchemas({ pageUrl, serviceName, schemaServiceName: `${serviceName} ${location}`, areaServed: location, description: metaDesc, preview, faqs })}
<style>${getPharmacyStyles(accent)}</style>
</head>
<body>
<div class="preview-banner">Local preview only — not deployed · not indexed</div>
${renderSiteHeader(preview, previewHref(slug, preview), primaryCta, "#service-cta", "#service-faq")}

<section class="hero" id="service-hero">
<div class="wrap hero-grid">
<div>
<div class="eyebrow">${esc(eyebrow)}</div>
<h1>${esc(h1)}</h1>
<p>${esc(heroText)}</p>
<div class="btns">
<a class="btn" href="#service-cta">${esc(primaryCta)}</a>
<a class="btn secondary btn-green" href="${esc(telHref(preview.phone))}">${esc(secondaryCta)}</a>
</div>
${renderHeroTrustRow(trustHero)}
</div>
<div class="hero-media">${imageSlot(ctx, "hero", location, serviceName)}</div>
</div>
</section>

<section class="blue-band" id="service-overview">
<div class="wrap"><div class="section-head center"><h2>About ${esc(serviceName)}</h2><p>${esc(String(profile.shortDescription ?? ""))}</p></div></div>
</section>

${dedicatedSections}

<section id="service-trust">
<div class="wrap">
<div class="section-head"><span class="section-kicker">Trusted local care</span><h2>Why Choose ${esc(preview.pharmacyName)}</h2></div>
<div class="grid-2">
<div class="check-list">${trustPoints.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
<div>${imageSlot(ctx, "trust", location, serviceName)}</div>
</div>
</div>
</section>

<section class="green-band soft" id="service-process">
<div class="wrap"><div class="section-head"><h2>How It Works</h2></div>
<div class="steps">${steps.map((s) => `<div class="step"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join("")}</div></div>
</section>

<section id="service-benefits">
<div class="wrap"><div class="section-head"><h2>${esc(config.benefitsTitle)}</h2></div>
<div class="grid-3">${benefits.map((b, i) => `<div class="card"><h3>${esc(config.benefitHeading(b, i))}</h3><p>${esc(b)}</p></div>`).join("")}</div></div>
</section>

<section id="service-local">
<div class="wrap"><div class="section-head"><h2>${esc(serviceName)} in ${esc(location)}</h2><p>Serving ${esc(location)} and surrounding communities.</p></div>
${imageSlot(ctx, "support", location, serviceName)}</div>
</section>

<section class="soft" id="service-nearby">
<div class="wrap"><div class="section-head"><h2>Nearby Areas</h2></div>
<div class="areas-grid">${ctx.blueprint.clusterBlueprints.map((c) => `<a class="area-card" href="${esc(previewHref(String(c.pageSlug), preview))}"><h3>${esc(String(c.area))}</h3><p>${esc(String(c.localAngle ?? "").slice(0, 100))}</p></a>`).join("")}</div></div>
</section>

<section id="service-related">
<div class="wrap"><div class="section-head"><h2>Related Services</h2></div>
<div class="related-grid">${related.slice(0, 3).map((r) => `<a class="related-card" href="${esc(previewHref(`${String(r.serviceKey)}-${String(identity.locationSlug)}`, preview))}"><h3>${esc(String(r.label))}</h3><p>Complementary pharmacy services.</p></a>`).join("")}</div></div>
</section>

<section class="soft" id="service-faq">
<div class="wrap"><div class="section-head center"><h2>Frequently Asked Questions</h2></div>
${faqs.map((f) => `<div class="faq"><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></div>`).join("")}</div>
</section>

<section id="service-compliance"><div class="wrap compliance"><h3>Important information</h3><ul>${disclaimers.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div></section>

${buildCtaBand(config, preview, serviceName, location, usp, ctx)}

${renderSiteFooter(preview, `${serviceName} — ${location}`)}
</body></html>`;

  html = applyFamilyContextualLinks(html, ctx, location);
  return html;
}

export function renderPharmacyFamilyCluster(ctx: FamilyRendererContext): string {
  const cluster = ctx.clusterBlueprint!;
  const si = ctx.serviceIntelligence;
  const profile = si.serviceProfile as Record<string, unknown>;
  const identity = ctx.blueprint.campaignIdentity;
  const hub = ctx.blueprint.hubBlueprint;
  const preview = ctx.preview;
  const location = String(identity.location ?? "Rotherham");
  const area = String(cluster.area);
  const serviceName = String(identity.serviceName);
  const slug = String(cluster.pageSlug);
  const hubSlug = String(hub.pageSlug);
  const pageUrl = `https://${preview.domain}/${slug}/`;
  const templateKey = String(ctx.templateFamily.templateKey ?? "");
  const config = getFamilyConfig(templateKey);
  const accent = familyAccent(templateKey);
  const usp = String(hub.usp ?? extractUsp(si));
  const tokenOpts = { location: area, serviceName, usp };

  const h1 = resolveAllTokens(String(cluster.h1), preview, tokenOpts);
  const metaTitle = resolveAllTokens(String(cluster.metaTitle), preview, tokenOpts);
  const metaDesc = resolveAllTokens(String(cluster.metaDescription ?? profile.shortDescription), preview, tokenOpts);
  const localAngle = resolveAllTokens(String(cluster.localAngle ?? ""), preview, tokenOpts);
  const localCta = cluster.localCta as Record<string, unknown>;
  const primaryCta = String(localCta?.primary ?? config.ctas.heroPrimary);
  const secondaryCta = String(localCta?.secondary ?? config.ctas.heroSecondary);

  const benefits = distinctBenefits(si);
  const steps = config.processSteps(serviceName, preview, area);
  const faqs = ((cluster.faqVariants as Record<string, unknown>[]) ?? []).map((f) => ({
    question: resolveAllTokens(String(f.question), preview, tokenOpts),
    answer: expandPatientFacingFaqAnswer(String(f.question), "", preview, area, serviceName, templateKey),
  }));
  const related = ((si.internalLinkingOpportunities as Record<string, unknown>)?.relatedServices as Record<string, unknown>[]) ?? [];
  const nearby = ((cluster.internalLinks as Record<string, unknown>)?.nearbyAreas as Record<string, unknown>[]) ?? [];
  const disclaimers = (ctx.blueprint.complianceGuardrails.medicalAdviceDisclaimers as string[]) ?? [];

  let html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(metaTitle)}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${esc(pageUrl)}">
${buildSchemas({ pageUrl, serviceName, schemaServiceName: `${serviceName} ${area}`, areaServed: area, description: metaDesc, preview, faqs })}
<style>${getPharmacyStyles(accent)}</style>
</head>
<body>
<div class="preview-banner">Local preview only — not deployed · not indexed</div>
${renderSiteHeader(preview, previewHref(hubSlug, preview), primaryCta, "#service-cta", "#service-faq")}

<section class="hero" id="service-hero">
<div class="wrap hero-grid">
<div>
<div class="eyebrow">${esc(String(ctx.templateFamily.templateName))} · ${esc(area)}</div>
<h1>${esc(h1)}</h1>
<p>${esc(localAngle)}</p>
<div class="btns">
<a class="btn" href="#service-cta">${esc(primaryCta)}</a>
<a class="btn secondary btn-green" href="${esc(telHref(preview.phone))}">${esc(secondaryCta)}</a>
</div>
</div>
<div class="hero-media">${imageSlot(ctx, "hero", area, serviceName)}</div>
</div>
</section>

<section class="blue-band" id="service-overview">
<div class="wrap section-head"><h2>${esc(serviceName)} for ${esc(area)}</h2><p>${esc(String(profile.shortDescription ?? ""))}</p></div>
</section>

<section id="service-trust">
<div class="wrap"><div class="section-head"><h2>Why Choose Us</h2><p>Professional ${esc(serviceName)} serving patients from ${esc(area)}.</p></div>
${imageSlot(ctx, "trust", area, serviceName)}</div>
</section>

<section class="green-band soft" id="service-process">
<div class="wrap"><div class="section-head"><h2>How It Works</h2></div>
<div class="steps">${steps.map((s) => `<div class="step"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join("")}</div></div>
</section>

<section id="service-benefits">
<div class="wrap"><div class="section-head"><h2>${esc(config.benefitsTitle)} — ${esc(area)}</h2></div>
<div class="grid-3">${benefits.map((b, i) => `<div class="card"><h3>${esc(config.benefitHeading(b, i))}</h3><p>${esc(b)}</p></div>`).join("")}</div></div>
</section>

<section id="service-local">
<div class="wrap"><div class="section-head"><h2>Local Service for ${esc(area)}</h2><p>Serving patients travelling from ${esc(area)} to our ${esc(location)} pharmacy.</p></div>
${imageSlot(ctx, "support", area, serviceName)}</div>
</section>

<section class="soft" id="service-nearby">
<div class="wrap"><div class="section-head"><h2>Nearby Areas</h2></div>
<div class="areas-grid">
<a class="area-card" href="${esc(previewHref(hubSlug, preview))}"><h3>${esc(serviceName)} ${esc(location)}</h3><p>Main hub page</p></a>
${nearby.map((n) => `<a class="area-card" href="${esc(previewHref(String(n.pageSlug), preview))}"><h3>${esc(String(n.anchorText))}</h3><p>Nearby neighbourhood</p></a>`).join("")}
</div></div>
</section>

<section id="service-related">
<div class="wrap"><div class="section-head"><h2>Related Services</h2></div>
<div class="related-grid">${related.slice(0, 3).map((r) => `<a class="related-card" href="${esc(previewHref(`${String(r.serviceKey)}-${String(identity.locationSlug)}`, preview))}"><h3>${esc(String(r.label))}</h3></a>`).join("")}</div></div>
</section>

<section class="soft" id="service-faq">
<div class="wrap">${faqs.map((f) => `<div class="faq"><h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p></div>`).join("")}</div>
</section>

<section id="service-compliance"><div class="wrap compliance"><h3>Important information</h3><ul>${disclaimers.slice(0, 4).map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div></section>

${buildCtaBand(config, preview, serviceName, area, usp, ctx)}

${renderSiteFooter(preview, `${serviceName} — ${area}`)}
</body></html>`;

  html = applyFamilyContextualLinks(html, { ...ctx, pageType: "cluster", clusterBlueprint: cluster }, area);
  return html;
}
