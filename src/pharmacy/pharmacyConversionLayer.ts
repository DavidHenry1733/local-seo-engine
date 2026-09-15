/**
 * Pharmacy Conversion Layer V1 — profile-driven conversion sections for service and hub pages.
 */
import { hashSeed } from "./pharmacyLayoutTemplateLibrary.ts";
import { getEnrichedBlueprint } from "./pharmacyServiceBlueprintContentService.ts";
import type { ServicePageCta, ServicePageSection } from "./pharmacyServicePageGenerator.ts";

export type ConversionPageKind = "service" | "hub" | "area";

export interface ConversionProfile {
  pharmacyName: string;
  town: string;
  phone: string;
  postcode?: string;
  county?: string;
  businessEmail?: string;
  nhsEmail?: string;
  bookingUrl?: string;
}

export interface ReassuranceCard {
  title: string;
  body: string;
}

export interface ConversionLayerMeta {
  hasNextStepPanel: boolean;
  reassuranceCardCount: number;
  hasPhone: boolean;
  hasEmail: boolean;
  hasBooking: boolean;
  usesConversionLayer: boolean;
}

export interface ConversionLayerResult {
  sections: ServicePageSection[];
  cta: ServicePageCta;
  meta: ConversionLayerMeta;
}

const PRIMARY_CTAS = [
  "Ask about availability",
  "Check suitability today",
  "Speak to a pharmacist",
  "Request clinical advice",
  "Book a consultation",
  "Check service eligibility",
];

const SECONDARY_CTAS = [
  "Email the pharmacy team",
  "Request advice by email",
  "Ask about NHS eligibility",
  "Send a secure enquiry",
  "Check opening hours first",
];

const HEADING_BUILDERS: Array<(pharmacy: string, service: string) => string> = [
  (_p, service) => `Speak to the pharmacy team about ${service}`,
  (pharmacy, service) => `Ask ${pharmacy} about ${service}`,
  (_p, service) => `Need help with ${service}?`,
];

const REASSURANCE_SOURCES: Array<{
  title: string;
  field:
    | "patientQuestions"
    | "bookingBarriers"
    | "safetyConcerns"
    | "costValueQuestions"
    | "nhsPrivateComparisons";
}> = [
  { title: "Common patient questions", field: "patientQuestions" },
  { title: "Booking made simple", field: "bookingBarriers" },
  { title: "Your safety matters", field: "safetyConcerns" },
  { title: "Fees and value", field: "costValueQuestions" },
  { title: "NHS and private options", field: "nhsPrivateComparisons" },
];

function pickBySeed<T>(items: T[], serviceId: string, kind: ConversionPageKind, category: string, count: number): T[] {
  if (!items.length || count <= 0) return [];
  const offset = hashSeed(serviceId, kind, category) % items.length;
  const step = 1 + (hashSeed(category, serviceId, kind) % 2);
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const item = items[(offset + i * step) % items.length];
    if (item !== undefined && !out.includes(item)) out.push(item);
  }
  let cursor = 0;
  const maxCursor = items.length + count + 2;
  while (out.length < Math.min(count, items.length) && cursor < maxCursor) {
    const item = items[(offset + cursor) % items.length];
    if (item !== undefined && !out.includes(item)) out.push(item);
    cursor++;
  }
  return out.slice(0, count);
}

function resolveEmail(profile: ConversionProfile): string {
  return String(profile.businessEmail || profile.nhsEmail || "").trim();
}

function buildReassuranceCards(
  serviceId: string,
  kind: ConversionPageKind,
  cardCount: number,
): ReassuranceCard[] {
  const blueprint = getEnrichedBlueprint(serviceId);
  if (!blueprint) return [];

  const orderedSources = pickBySeed(REASSURANCE_SOURCES, serviceId, kind, "reassurance-order", cardCount);
  const cards: ReassuranceCard[] = [];

  for (const source of orderedSources) {
    const pool = blueprint[source.field];
    if (!Array.isArray(pool) || !pool.length) continue;
    const body = pickBySeed(pool, serviceId, kind, source.field, 1)[0];
    if (!body) continue;
    cards.push({ title: source.title, body: String(body) });
  }

  return cards.slice(0, cardCount);
}

export function buildConversionLayer(
  serviceId: string,
  serviceName: string,
  kind: ConversionPageKind,
  profile: ConversionProfile,
): ConversionLayerResult {
  const primary = pickBySeed(PRIMARY_CTAS, serviceId, kind, "cta-primary", 1)[0] || "Speak to a pharmacist";
  const secondary =
    pickBySeed(SECONDARY_CTAS, serviceId, kind, "cta-secondary", 1)[0] || "Email the pharmacy team";
  const headingIdx = hashSeed(serviceId, kind, "heading") % HEADING_BUILDERS.length;
  const heading = HEADING_BUILDERS[headingIdx]!(profile.pharmacyName, serviceName);

  const email = resolveEmail(profile);
  const hasPhone = Boolean(String(profile.phone || "").trim());
  const hasEmail = Boolean(email);
  const hasBooking = Boolean(String(profile.bookingUrl || "").trim());

  const cardCount = 3 + (hashSeed(serviceId, kind, "cards") % 2);
  const reassuranceCards = buildReassuranceCards(serviceId, kind, cardCount);

  const phoneDisplay = String(profile.phone || "").trim();
  const nextStepBody =
    kind === "hub"
      ? `${profile.pharmacyName} in ${profile.town} helps you choose the right local ${serviceName.toLowerCase()} page, confirm eligibility, and take the next step by phone${hasEmail ? ", email" : ""}${hasBooking ? ", or online booking" : ""}.`
      : kind === "area"
        ? `${profile.pharmacyName} in ${profile.town}${profile.postcode ? ` (${profile.postcode})` : ""} provides ${serviceName.toLowerCase()} with pharmacist-led assessment. Contact the team to confirm suitability for your area.`
        : `${profile.pharmacyName} in ${profile.town} provides ${serviceName.toLowerCase()} with pharmacist-led assessment. Contact the team to confirm suitability, discuss fees or NHS eligibility, and arrange your appointment.`;

  const phonePrompt = hasPhone
    ? `Call ${profile.pharmacyName} on ${phoneDisplay} to ${primary.toLowerCase()} for ${serviceName.toLowerCase()} in ${profile.town}.`
    : `Contact ${profile.pharmacyName} in ${profile.town} to ${primary.toLowerCase()} for ${serviceName.toLowerCase()}.`;

  const bookingPrompt = hasBooking
    ? `Book ${serviceName.toLowerCase()} online when ready — ${profile.pharmacyName} confirms eligibility and appointment details after booking.`
    : `${primary} for ${serviceName.toLowerCase()} — ${profile.pharmacyName} confirms availability, eligibility, and what to bring before your appointment.`;

  const emailPrompt = hasEmail
    ? `Email ${profile.pharmacyName} at ${email} with your ${serviceName.toLowerCase()} enquiry — the team responds with suitability guidance and next steps.`
    : undefined;

  const actionBullets: string[] = [];
  if (hasPhone) actionBullets.push(`Phone: ${phoneDisplay}`);
  if (hasBooking) actionBullets.push(`Book online: ${profile.bookingUrl}`);
  if (hasEmail) actionBullets.push(`Email: ${email}`);

  const sections: ServicePageSection[] = [
    {
      type: "conversionNextStep",
      heading,
      body: nextStepBody,
      bullets: actionBullets,
    },
    {
      type: "conversionReassurance",
      heading: "Patient reassurance before you book",
      body: `Common concerns about ${serviceName.toLowerCase()} at ${profile.pharmacyName} — answered before you commit to an appointment:`,
      bullets: reassuranceCards.map((c) => `${c.title}::${c.body}`),
    },
  ];

  const cta: ServicePageCta = {
    primary,
    secondary,
    phonePrompt,
    bookingPrompt,
    emailPrompt,
    bookingUrl: hasBooking ? profile.bookingUrl : undefined,
    businessEmail: hasEmail ? email : undefined,
  };

  return {
    sections,
    cta,
    meta: {
      hasNextStepPanel: true,
      reassuranceCardCount: reassuranceCards.length,
      hasPhone,
      hasEmail,
      hasBooking,
      usesConversionLayer: true,
    },
  };
}

export function conversionProfileFromData(data: Record<string, unknown>): ConversionProfile {
  return {
    pharmacyName: String(data.pharmacyName || data.tradingName || "Your Pharmacy").trim(),
    town: String(data.townCity || "your area").trim(),
    phone: String(data.phone || "").trim(),
    postcode: String(data.postcode || "").trim() || undefined,
    county: String(data.county || "").trim() || undefined,
    businessEmail: String(data.businessEmail || data.email || "").trim() || undefined,
    nhsEmail: String(data.nhsEmail || "").trim() || undefined,
    bookingUrl: String(data.bookingUrl || "").trim() || undefined,
  };
}

export function buildAreaConversionCta(
  serviceId: string,
  serviceName: string,
  area: string,
  profile: ConversionProfile,
): ServicePageCta {
  const layer = buildConversionLayer(serviceId, serviceName, "area", profile);
  return {
    ...layer.cta,
    bookingPrompt: `${profile.pharmacyName} supports ${serviceName.toLowerCase()} for ${area} patients in ${profile.town}${profile.county ? `, ${profile.county}` : ""}. ${layer.cta.bookingPrompt}`,
  };
}

export function mergeConversionCta(existing: ServicePageCta, layer: ConversionLayerResult): ServicePageCta {
  return {
    ...existing,
    ...layer.cta,
    primary: layer.cta.primary,
    secondary: layer.cta.secondary,
    phonePrompt: layer.cta.phonePrompt || existing.phonePrompt,
    bookingPrompt: layer.cta.bookingPrompt || existing.bookingPrompt,
    emailPrompt: layer.cta.emailPrompt || existing.emailPrompt,
    bookingUrl: layer.cta.bookingUrl || existing.bookingUrl,
    businessEmail: layer.cta.businessEmail || existing.businessEmail,
  };
}
