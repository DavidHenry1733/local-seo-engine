/**
 * Service-specific publish config for master-library renderer.
 * Owner-variable defaults and local-access copy only — no blueprint content.
 */
import type { MasterOwnerVariables } from "./pharmacyMasterLibraryParser.ts";

export interface LocalLayerContext {
  pharmacyName: string;
  town: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  postcode: string;
  coverageRadius: string;
  rankingAreas: string[];
}

export interface ServicePublishMeta {
  serviceId: string;
  serviceName: string;
  masterFile: string;
  urlPath: string;
  ctaHeading: (pharmacyName: string) => string;
  metaDescription: (pharmacyName: string, town: string) => string;
  localHeading: (town: string) => string;
  localBody: (ctx: LocalLayerContext) => string;
  ownerVariableDefaults: (ctx: {
    phone: string;
    data: Record<string, unknown>;
  }) => Partial<MasterOwnerVariables>;
}

const BLUEPRINT_BODY_MARKERS = [
  'data-component="conversion-reassurance"',
  'data-section-type="conversionReassurance"',
  'data-section-type="authorityInsights"',
  'data-section-type="deepDive"',
  'data-section-type="patientObjections"',
];

export function detectBlueprintLeakage(html: string): boolean {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const main = mainMatch?.[1] || html;
  return BLUEPRINT_BODY_MARKERS.some((m) => main.includes(m));
}

export function dedupeTrustSectionBody(markdown: string): string {
  return markdown
    .split(/\n\n+/)
    .map((para) =>
      para
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !/General Pharmaceutical Council|GPhC registered/i.test(sentence))
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

export function detectTrustLayerDuplication(trustSectionBody: string): boolean {
  return /General Pharmaceutical Council|GPhC registered/i.test(trustSectionBody);
}

export function detectLocalLayerDuplication(sectionOneBody: string, localBody: string): boolean {
  const intro = sectionOneBody
    .split(/\n\n+/)[0]
    ?.replace(/\*\*/g, "")
    .trim()
    .toLowerCase();
  if (!intro || intro.length < 40) return false;
  const snippet = intro.slice(0, Math.min(80, intro.length));
  return localBody.toLowerCase().includes(snippet);
}

function areaPhrase(ctx: LocalLayerContext): string {
  const areas = ctx.rankingAreas.filter((a) => a.toLowerCase() !== ctx.town.toLowerCase()).slice(0, 5);
  return areas.length ? areas.join(", ") : "surrounding neighbourhoods";
}

function addressLine(ctx: LocalLayerContext): string {
  return [ctx.addressLine1, ctx.addressLine2, ctx.postcode].filter(Boolean).join(", ");
}

function localAccessBody(ctx: LocalLayerContext, serviceLabel: string, accessDetail: string): string {
  const areas = areaPhrase(ctx);
  const address = addressLine(ctx);
  return `${ctx.pharmacyName} is located at ${address}. Patients in ${ctx.town} and nearby areas including ${areas} can access ${serviceLabel} by calling ${ctx.phone}. ${accessDetail}`;
}

/** Research-backed benchmark masters — canonical publish set (root pages only). */
export const BENCHMARK_MASTER_SERVICE_IDS = [
  "pharmacy-first",
  "blood-pressure-checks",
  "travel-vaccinations",
  "flu-vaccinations",
  "prescription-dispensing",
  "emergency-contraception",
  "repeat-prescriptions",
  "pharmacy-contraception-service",
  "new-medicine-service",
  "malaria-prevention",
  "medication-reviews",
] as const;

export const MASTER_PUBLISH_SERVICES: ServicePublishMeta[] = [
  {
    serviceId: "pharmacy-first",
    serviceName: "Pharmacy First",
    masterFile: "pharmacy-first-master-v2.md",
    urlPath: "/pharmacy-first/",
    ctaHeading: (p) => `Book your consultation at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — NHS Pharmacy First for common illnesses with pharmacist assessment and treatment where appropriate.`,
    localHeading: (town) => `Local access from ${town}`,
    localBody: (ctx) => {
      const areas = areaPhrase(ctx);
      const address = addressLine(ctx);
      return `Find us at ${address}. The easiest approaches are the familiar local routes serving ${ctx.town}, with patients also travelling from ${areas}. Call ${ctx.phone} for directions, parking guidance, opening hours, or to check whether a same-day consultation is available before you set off.`;
    },
    ownerVariableDefaults: () => ({}),
  },
  {
    serviceId: "blood-pressure-checks",
    serviceName: "Blood Pressure Checks",
    masterFile: "blood-pressure-checks-master-v1.md",
    urlPath: "/blood-pressure-checks/",
    ctaHeading: (p) => `Book a blood pressure check at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — blood pressure checks and private screening options where available.`,
    localHeading: (town) => `Blood Pressure Checks For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "blood pressure checks",
        "Appointments take place in the pharmacy's private consultation room — call to ask what blood pressure support is available.",
      ),
    ownerVariableDefaults: () => ({
      nhs_service:
        "Blood pressure checks — call to confirm what is available locally",
      private_service: "Private blood pressure checks may be available — fee confirmed when you call if applicable",
    }),
  },
  {
    serviceId: "travel-vaccinations",
    serviceName: "Travel Vaccinations",
    masterFile: "travel-vaccinations-master-v1.md",
    urlPath: "/travel-vaccinations/",
    ctaHeading: (p) => `Book travel vaccinations at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — private travel health consultations and destination-based vaccinations.`,
    localHeading: (town) => `Travel Vaccinations For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "travel health consultations",
        "Appointments take place in the pharmacy's private consultation room — share your itinerary and travel dates when you call.",
      ),
    ownerVariableDefaults: () => ({
      travel_clinic:
        "Private travel health consultations with destination-based vaccine recommendations and personal vaccination records",
      private_service: "Private consultation and vaccine fees confirmed at booking",
    }),
  },
  {
    serviceId: "flu-vaccinations",
    serviceName: "Flu Vaccinations",
    masterFile: "flu-vaccinations-master-v1.md",
    urlPath: "/flu-vaccinations/",
    ctaHeading: (p) => `Book a flu vaccination at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — seasonal NHS flu vaccination with clear advice on suitability and booking.`,
    localHeading: (town) => `Flu Vaccinations For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "flu vaccinations",
        "Appointments take place in the pharmacy's private consultation room — ask about NHS flu eligibility when you call.",
      ),
    ownerVariableDefaults: () => ({
      nhs_service:
        "NHS seasonal flu vaccination — confirm local eligibility and commissioning when you call",
      private_service: "Private flu vaccination may be available where NHS eligibility does not apply — fee confirmed at booking",
    }),
  },
  {
    serviceId: "prescription-dispensing",
    serviceName: "Prescription Dispensing",
    masterFile: "prescription-dispensing-master-v1.md",
    urlPath: "/prescription-dispensing/",
    ctaHeading: (p) => `Prescription enquiries at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — regulated NHS and private prescription dispensing with pharmacist clinical checking.`,
    localHeading: (town) => `Prescription Dispensing For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "prescription dispensing and collection",
        "The team supports EPS nomination, collection, and delivery where available — call for prescription enquiries or repeat ordering help.",
      ),
    ownerVariableDefaults: ({ phone, data }) => ({
      ordering_link: String(data.bookingUrl || "").trim() || `Call ${phone} to order repeats`,
      delivery_service: data.homeDeliveryAvailable
        ? "Home delivery available for eligible prescriptions — ask about local routes and fees"
        : "Ask the pharmacy team about collection options",
      electronic_prescription_service:
        "EPS nomination can be set up in pharmacy or via the NHS App — ask the team for help",
      private_prescriptions: "Private prescription acceptance — fees confirmed before supply",
      repeat_prescription_support:
        "Repeat prescription ordering support available — separate from clinical dispensing checks",
    }),
  },
  {
    serviceId: "emergency-contraception",
    serviceName: "Emergency Contraception",
    masterFile: "emergency-contraception-master-v1.md",
    urlPath: "/emergency-contraception/",
    ctaHeading: (p) => `Emergency contraception at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — confidential, time-sensitive pharmacist assessment and supply where appropriate.`,
    localHeading: (town) => `Emergency Contraception For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "urgent emergency contraception advice",
        "Consultations take place in a private consultation room — say when unprotected sex occurred so the team can triage time-critical options quickly.",
      ),
    ownerVariableDefaults: () => ({
      nhs_service:
        "NHS Pharmacy Contraception Service oral emergency contraception where eligible — confirm at consultation",
      private_ec_fee: "Private consultation and supply fee confirmed at consultation if NHS route not eligible",
      walk_in_policy: "Call urgently for same-day access — appointments and walk-ins where capacity allows",
      cu_iud_referral:
        "Copper coil (IUD) referral signposted to local sexual health or GP services when clinically appropriate",
    }),
  },
  {
    serviceId: "repeat-prescriptions",
    serviceName: "Repeat Prescriptions",
    masterFile: "repeat-prescriptions-master-v2.md",
    urlPath: "/repeat-prescriptions/",
    ctaHeading: (p) => `Reorder repeats at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — NHS repeat prescription ordering, EPS nomination and GP liaison support.`,
    localHeading: (town) => `Repeat Prescription Support For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "repeat prescription ordering support",
        "The team supports EPS nomination, reorder timing, and collection or delivery where available.",
      ),
    ownerVariableDefaults: ({ phone, data }) => ({
      pharmacy_orders_repeats:
        "Call to confirm — the pharmacy team can advise whether they order repeats on your behalf",
      repeat_reminders: "Ask about SMS or app reminders when you reorder",
      ready_notification: "The team will contact you when your medicines are ready to collect or deliver",
      delivery_available: data.homeDeliveryAvailable
        ? "Home delivery available for eligible repeat prescriptions — ask about local routes and fees"
        : "Ask the pharmacy team about collection options for repeat prescriptions",
      eps_nomination: "EPS nomination can be set up in pharmacy or via the NHS App — ask the team for help",
    }),
  },
  {
    serviceId: "pharmacy-contraception-service",
    serviceName: "Pharmacy Contraception Service",
    masterFile: "pharmacy-contraception-service-master-v2.md",
    urlPath: "/pharmacy-contraception-service/",
    ctaHeading: (p) => `Pharmacy contraception at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — NHS Pharmacy Contraception Service for ongoing oral contraception where commissioned.`,
    localHeading: (town) => `Pharmacy Contraception For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "pharmacy contraception appointments",
        "Consultations take place in a private consultation room — call to ask about NHS eligibility and booking.",
      ),
    ownerVariableDefaults: () => ({
      nhs_contraception_service:
        "NHS Pharmacy Contraception Service for ongoing oral contraception where commissioned — confirm at consultation",
      private_contraception: "Private consultation and supply fee confirmed if NHS route not eligible",
      walk_in_policy: "Call to check walk-in or appointment availability",
      larc_referral:
        "Long-acting reversible contraception referral signposted to local sexual health or GP services when appropriate",
    }),
  },
  {
    serviceId: "new-medicine-service",
    serviceName: "New Medicine Service",
    masterFile: "new-medicine-service-master-v2.md",
    urlPath: "/new-medicine-service/",
    ctaHeading: (p) => `New Medicine Service at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — free NHS support when starting selected new long-term medicines.`,
    localHeading: (town) => `New Medicine Service For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "New Medicine Service follow-up",
        "In-person consultations take place in the pharmacy's private consultation room — respond to pharmacy contact or call to arrange your Intervention or Follow-up.",
      ),
    ownerVariableDefaults: () => ({
      nhs_new_medicine_service: "NHS New Medicine Service actively delivered at this pharmacy — confirm when contacted",
      nms_medicine_groups: "Eligible medicine groups confirmed at NMS enrolment — ask the team if unsure",
      private_medicines_counselling_fee:
        "Private non-NMS medicines counselling fee confirmed if offered and NHS NMS does not apply",
    }),
  },
  {
    serviceId: "malaria-prevention",
    serviceName: "Malaria Prevention",
    masterFile: "malaria-prevention-master-v2.md",
    urlPath: "/malaria-prevention/",
    ctaHeading: (p) => `Book malaria prevention at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — antimalarial chemoprophylaxis planning and travel risk assessment.`,
    localHeading: (town) => `Malaria Prevention For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "malaria prevention planning",
        "Consultations take place in a private consultation room — share your travel dates and destination when you call, especially for last-minute trips.",
      ),
    ownerVariableDefaults: () => ({
      private_malaria_fee: "Private malaria consultation fee confirmed at booking",
      ip_prescriber_available: "Independent prescriber available for antimalarial supply where commissioned — confirm when booking",
      nhs_malaria_service: "Not routinely commissioned as NHS malaria service at community pharmacy — private pathway applies",
      antimalarial_stock: "Antimalarial agents stocked locally — confirm availability when booking",
      combined_travel_fee: "Combined travel health and malaria pricing available on request",
    }),
  },
  {
    serviceId: "medication-reviews",
    serviceName: "Medication Reviews",
    masterFile: "medication-reviews-master-v2.md",
    urlPath: "/medication-reviews/",
    ctaHeading: (p) => `Book a medication review at ${p}`,
    metaDescription: (p, t) =>
      `${p} in ${t} — structured pharmacist-led review of your medicines for safety, adherence and optimisation.`,
    localHeading: (town) => `Medication Reviews For Patients In ${town}`,
    localBody: (ctx) =>
      localAccessBody(
        ctx,
        "structured medication review appointments",
        "Appointments take place in the pharmacy's private consultation room. If you received a GP Structured Medication Review invitation, attend that NHS appointment as directed.",
      ),
    ownerVariableDefaults: () => ({
      nhs_medication_review:
        "Not currently commissioned as an NHS structured medication review at this pharmacy — call to confirm local options.",
      private_review_fee: "Private structured medication review — fee confirmed when you book",
    }),
  },
];

export function getServicePublishMeta(serviceId: string): ServicePublishMeta | undefined {
  return MASTER_PUBLISH_SERVICES.find((s) => s.serviceId === serviceId);
}

export function getBenchmarkPublishServices(): ServicePublishMeta[] {
  return BENCHMARK_MASTER_SERVICE_IDS.map((id) => {
    const meta = getServicePublishMeta(id);
    if (!meta) throw new Error(`Missing publish config for benchmark service: ${id}`);
    return meta;
  });
}
