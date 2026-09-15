/**
 * Presentation-layer body localisation for visual service pages.
 * Adapts generic master-publish wording to the current pharmacy profile
 * without changing clinical facts, eligibility, or safety guidance.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { rewritePremisesLocalityUsedAsMarketCopy } from "./pharmacyServicePageTrustInjection.ts";

export interface BodyLocalisationContext {
  profile: PharmacyServicePageProfile;
  serviceName: string;
  privateServicesAvailable?: boolean;
}

export type PhraseClassification = "SAFE_GENERIC" | "NEEDS_PROFILE_LOCALISATION";

export interface GenericPhraseRule {
  phrase: string;
  classification: PhraseClassification;
  note: string;
}

/** Catalogue of generic body phrases scanned on visual service pages. */
export const GENERIC_BODY_PHRASE_CATALOGUE: GenericPhraseRule[] = [
  { phrase: "not every pharmacy", classification: "NEEDS_PROFILE_LOCALISATION", note: "Availability — replace with pharmacy-specific availability" },
  { phrase: "local participation may vary", classification: "NEEDS_PROFILE_LOCALISATION", note: "Availability hedging" },
  { phrase: "local participation varies", classification: "NEEDS_PROFILE_LOCALISATION", note: "Availability hedging" },
  { phrase: "your pharmacy provides the service", classification: "NEEDS_PROFILE_LOCALISATION", note: "Contact/access wording" },
  { phrase: "your pharmacy offers", classification: "NEEDS_PROFILE_LOCALISATION", note: "Contact/access wording" },
  { phrase: "what your pharmacy offers", classification: "NEEDS_PROFILE_LOCALISATION", note: "Contact/access wording" },
  { phrase: "call your pharmacy", classification: "NEEDS_PROFILE_LOCALISATION", note: "Contact wording" },
  { phrase: "your local pharmacy", classification: "NEEDS_PROFILE_LOCALISATION", note: "Local relevance" },
  { phrase: "a participating pharmacy", classification: "NEEDS_PROFILE_LOCALISATION", note: "Service access" },
  { phrase: "participating pharmacy", classification: "NEEDS_PROFILE_LOCALISATION", note: "Service access" },
  { phrase: "some pharmacies", classification: "NEEDS_PROFILE_LOCALISATION", note: "Availability plural" },
  { phrase: "ask the pharmacy team", classification: "NEEDS_PROFILE_LOCALISATION", note: "Team wording" },
  { phrase: "the pharmacy team", classification: "NEEDS_PROFILE_LOCALISATION", note: "Team wording" },
  { phrase: "contact the pharmacy", classification: "NEEDS_PROFILE_LOCALISATION", note: "Contact wording" },
  { phrase: "at your pharmacy", classification: "NEEDS_PROFILE_LOCALISATION", note: "Location reference" },
  { phrase: "speak to a pharmacist", classification: "NEEDS_PROFILE_LOCALISATION", note: "CTA/contact when unnamed" },
  { phrase: "community pharmacy", classification: "SAFE_GENERIC", note: "OK in clinical/NHS definitions" },
  { phrase: "gp referral", classification: "SAFE_GENERIC", note: "Clinical fact" },
  { phrase: "urgent care", classification: "SAFE_GENERIC", note: "Clinical fact" },
];

export const FORBIDDEN_BODY_PHRASES = [
  "not every pharmacy offers",
  "local participation may vary",
  "local participation varies",
  "your pharmacy provides the service",
  "confirm your pharmacy provides",
  "whether the pharmacy offers",
  "ask whether the pharmacy",
  "the pharmacy offers",
  "in supermarkets, and in neighbourhoods",
  "participating pharmacy",
] as const;

function collapseDuplicateCallSentences(text: string, name: string, phone: string): string {
  if (!phone) return text;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPhone = phone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s/g, "\\s*");
  const callRe = new RegExp(`Call ${escapedName}(?:\\s+on\\s+${escapedPhone})?[^.]*\\.`, "gi");
  let seen = false;
  return text
    .replace(callRe, (match) => {
      if (seen) return "";
      seen = true;
      return match.trim();
    })
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

function fixAccessibilityWording(text: string, name: string, town: string): string {
  let out = text;
  out = out.replace(/is accessible locally, in supermarkets, and in neighbourhoods\.?/gi, `is accessible for patients in ${town} and nearby areas.`);
  out = out.replace(
    new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: in ${town.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})? is accessible locally[^.]*\\.`, "gi"),
    `${name} is accessible for patients in ${town} and nearby areas.`,
  );
  out = out.replace(
    /Community pharmacies are on high streets[^.]+\./gi,
    `${name} is accessible for patients in ${town} and nearby areas.`,
  );
  return out;
}

function fixGenericPharmacyOffers(text: string, name: string, phone: string, serviceName: string): string {
  let out = text;
  out = out.replace(
    /Call \d[\d\s]+ to ask whether the pharmacy offers [^.]+\./gi,
    `Call ${name} on ${phone} to ask about ${serviceName} availability and appointment options.`,
  );
  out = out.replace(/whether the pharmacy offers/gi, `whether ${name} offers`);
  out = out.replace(/ask whether the pharmacy/gi, `call ${name}${phone ? ` on ${phone}` : ""} to ask`);
  out = out.replace(/\bthe pharmacy offers\b/gi, `${name} offers`);
  return out;
}

function availabilitySentence(ctx: BodyLocalisationContext): string {
  const { profile, serviceName } = ctx;
  const name = profile.pharmacyName;
  const phone = canonicalDisplayPhone(profile);
  if (profile.nhsServicesAvailable) {
    return `${serviceName} is available at ${name}${profile.town ? ` in ${profile.town}` : ""}. If you would like to check appointment availability before visiting, call ${name}${phone ? ` on ${phone}` : ""}.`;
  }
  return `Contact ${name}${phone ? ` on ${phone}` : ""} to confirm current ${serviceName} availability.`;
}

function privateAvailabilitySuffix(ctx: BodyLocalisationContext): string {
  if (ctx.privateServicesAvailable) {
    return ` Private service options may also be available at ${ctx.profile.pharmacyName} where clinically appropriate.`;
  }
  return "";
}

function applyFullSentenceReplacements(text: string, ctx: BodyLocalisationContext): string {
  const { profile, serviceName } = ctx;
  const name = profile.pharmacyName;
  const town = profile.town;
  const phone = canonicalDisplayPhone(profile);
  const avail = availabilitySentence(ctx);

  const replacements: Array<[RegExp, string]> = [
    [
      /Not every pharmacy offers Pharmacy First, and local participation may vary\s*[—-]\s*call ahead to confirm your pharmacy provides the service before you travel\.?/gi,
      avail,
    ],
    [
      /Not every pharmacy offers the NHS service or ABPM, and local participation varies\s*[—-]\s*confirm before you travel\.?/gi,
      `${serviceName} is available at ${name}${town ? ` in ${town}` : ""}. Call ${name}${phone ? ` on ${phone}` : ""} to ask what blood pressure support is available before you visit.${privateAvailabilitySuffix(ctx)}`,
    ],
    [
      /Not every pharmacy stocks every vaccine\. Availability and pricing are confirmed before supply\.?/gi,
      `${name} confirms travel vaccine availability and pricing before supply. Call ${name}${phone ? ` on ${phone}` : ""} to discuss your travel plans.${privateAvailabilitySuffix(ctx)}`,
    ],
    [
      /Not every pharmacy or area offers the NHS service\.?/gi,
      `${name}${town ? ` in ${town}` : ""} can advise on NHS service availability when you call${phone ? ` ${phone}` : ""}.`,
    ],
    [
      /Not every pharmacy delivers NHS NMS\.[^.]*\.?/gi,
      `Contact ${name}${phone ? ` on ${phone}` : ""} to confirm New Medicine Service availability.`,
    ],
    [
      /Most pharmacy travel vaccination services in England are private and fee-based\.[^.]*ask what applies at your pharmacy\.?/gi,
      `Travel vaccination appointments at ${name}${town ? ` in ${town}` : ""} are mainly private and fee-based, with some NHS-funded vaccines available in specific circumstances. Call ${name}${phone ? ` on ${phone}` : ""} to confirm what applies for your trip.`,
    ],
  ];

  let out = text;
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function applyPartialReplacements(text: string, ctx: BodyLocalisationContext): string {
  const { profile } = ctx;
  const name = profile.pharmacyName;
  const town = profile.town;
  const phone = canonicalDisplayPhone(profile);

  if (!name) return text;

  let out = text;

  const partials: Array<[RegExp, string]> = [
    [/Participating pharmacies in England can deliver/gi, `${name}${town ? ` in ${town}` : ""} delivers`],
    [/Participating pharmacies in England can/gi, `${name}${town ? ` in ${town}` : ""} can`],
    [/A pharmacy check helps/gi, `A check at ${name}${town ? ` in ${town}` : ""} helps`],
    [/A pharmacy check screens/gi, `A check at ${name} screens`],
    [/Community pharmacies are on high streets/gi, `${name}${town ? ` in ${town}` : ""} is accessible locally`],
    [/If you already collect prescriptions from the same pharmacy/gi, `If you already collect prescriptions from ${name}`],
    [/Travel health consultations usually need a booked appointment so enough time can be set aside for a proper assessment\. Call ahead/gi, `Travel health consultations at ${name}${town ? ` in ${town}` : ""} usually need a booked appointment so enough time can be set aside for a proper assessment. Call ${name}${phone ? ` on ${phone}` : ""}`],
    [/Call ahead — especially/gi, `Call ${name}${phone ? ` on ${phone}` : ""} — especially`],
    [/Call ahead/gi, `Call ${name}${phone ? ` on ${phone}` : ""}`],
    [/When you arrive, the team/gi, `When you arrive at ${name}${town ? ` in ${town}` : ""}, the team`],
    [/Contact a participating pharmacy/gi, `Contact ${name}`],
    [/contact a participating pharmacy/gi, `contact ${name}`],
    [/At a participating pharmacy,/gi, `At ${name},`],
    [/at a participating pharmacy,/gi, `at ${name},`],
    [/a participating pharmacy/gi, name],
    [/participating pharmacy/gi, name],
    [
      /Some pharmacies accept walk-ins; others prefer you to book so enough time is set aside(?: for a proper assessment)?\.?/gi,
      `${name} may accept walk-ins or booked appointments — call ${name}${phone ? ` on ${phone}` : ""} to check availability.`,
    ],
    [
      /Some pharmacies offer walk-in checks; others prefer you to book/gi,
      `${name} may offer walk-in checks or booked appointments`,
    ],
    [/Call ahead to ask what your pharmacy offers/gi, `Call ${name}${phone ? ` on ${phone}` : ""} to ask what is available`],
    [/Call your pharmacy to ask what they offer/gi, `Call ${name}${phone ? ` on ${phone}` : ""} to ask what is available`],
    [/call your pharmacy to ask/gi, `call ${name}${phone ? ` on ${phone}` : ""} to ask`],
    [/what your pharmacy offers/gi, `what ${name} offers`],
    [/your pharmacy offers/gi, `${name} offers`],
    [/your pharmacy provides/gi, `${name} provides`],
    [/Your pharmacy can/gi, `${name} can`],
    [/your pharmacy can/gi, `${name} can`],
    [/ask what applies at your pharmacy/gi, `ask what applies at ${name}`],
    [/your local pharmacy/gi, name],
    [/Your local pharmacy/gi, name],
    [/at your pharmacy/gi, `at ${name}`],
    [/from your pharmacy/gi, `from ${name}`],
    [/ask the pharmacy team/gi, `ask the ${name} team${town ? ` in ${town}` : ""}`],
    [/Ask the pharmacy team/gi, `Ask the ${name} team${town ? ` in ${town}` : ""}`],
    [/the pharmacy team/gi, `the ${name} team`],
    [/Contact the pharmacy/gi, `Contact ${name}`],
    [/contact the pharmacy/gi, `contact ${name}`],
    [/call ahead to confirm/gi, `call ${name}${phone ? ` on ${phone}` : ""} to confirm`],
    [/Call ahead to ask/gi, `Call ${name}${phone ? ` on ${phone}` : ""} to ask`],
    [/Speak to a pharmacist(?! at )/gi, `Speak to a pharmacist at ${name}`],
    [/speak to a pharmacist(?! at )/gi, `speak to a pharmacist at ${name}`],
    [/Some pharmacies/gi, name],
    [/some pharmacies/gi, name],
  ];

  for (const [pattern, replacement] of partials) {
    out = out.replace(pattern, replacement);
  }

  out = out.replace(new RegExp(`${name} team at ${name}`, "gi"), `the ${name} team`);
  out = out.replace(new RegExp(`pharmacist at ${name} at ${name}`, "gi"), `pharmacist at ${name}`);
  out = out.replace(new RegExp(`${name} also offer`, "gi"), `${name} also offers`);
  out = out.replace(new RegExp(`${name} may offer walk-in checks or booked appointments`, "gi"), `${name}${town ? ` in ${town}` : ""} may offer walk-in checks or booked appointments`);

  if (town && name) {
    out = out.replace(new RegExp(`At ${name}, a pharmacist`, "gi"), `At ${name} in ${town}, a pharmacist`);
    out = out.replace(new RegExp(`Contact ${name} urgently`, "gi"), `Contact ${name} in ${town} urgently`);
  }

  return out;
}

function canonicalDisplayPhone(profile: PharmacyServicePageProfile): string {
  return String(profile.displayPhone || profile.phone || "").trim();
}

function applyServicePagePlaceholderLocalisation(text: string, ctx: BodyLocalisationContext): string {
  const name = String(ctx.profile.pharmacyName || "").trim();
  const town = String(ctx.profile.town || "").trim();
  const phone = canonicalDisplayPhone(ctx.profile);
  const contactLabel = name || "the pharmacy";
  let out = text;
  if (town) {
    out = out.replace(/\byour area\b/gi, town);
  } else {
    out = out
      .replace(/\b(?:from|in|around|for)\s+your area\b/gi, "")
      .replace(/\byour area\b/gi, "")
      .replace(/\s{2,}/g, " ");
  }
  if (phone) {
    out = out.replace(/contact the pharmacy on\s*\./gi, `contact ${contactLabel} on ${phone}.`);
    out = out.replace(new RegExp(`contact ${contactLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} on\\s*\\.`, "gi"), `contact ${contactLabel} on ${phone}.`);
    out = out.replace(/\bon\s*\.(?=\s|$)/g, `on ${phone}.`);
    out = out.replace(/\bcall\s+\./gi, `call ${phone}.`);
    out = out.replace(/\ba short call to can\b/gi, `a short call to ${phone} can`);
  } else {
    out = out.replace(/contact the pharmacy on\s*\./gi, "contact the pharmacy.");
    out = out.replace(/\bon\s*\.(?=\s|$)/g, ".");
    out = out.replace(/\bcall\s+\./gi, "call.");
    out = out.replace(/\ba short call to can\b/gi, "a short call can");
  }
  return out.replace(/\s+\./g, ".").replace(/\.\./g, ".");
}

export function localiseServicePageBodyText(
  text: string,
  profile: PharmacyServicePageProfile,
  serviceName: string,
  privateServicesAvailable = false,
): string {
  if (!text?.trim()) return text;
  const ctx: BodyLocalisationContext = { profile, serviceName, privateServicesAvailable };
  let out = applyServicePagePlaceholderLocalisation(text, ctx);
  out = applyFullSentenceReplacements(out, ctx);
  out = applyPartialReplacements(out, ctx);
  out = applyServicePagePlaceholderLocalisation(out, ctx);
  out = fixAccessibilityWording(out, profile.pharmacyName, profile.town);
  const phone = canonicalDisplayPhone(profile);
  out = fixGenericPharmacyOffers(out, profile.pharmacyName, phone, serviceName);
  out = collapseDuplicateCallSentences(out, profile.pharmacyName, phone);
  out = rewritePremisesLocalityUsedAsMarketCopy(out, profile);
  return out;
}

export function extractMainBodyContent(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!mainMatch) return html;
  let body = mainMatch[1];
  const chromeBlocks = ["hero", "trust-cards", "local", "final-cta", "conversion-image", "proof-band"];
  for (const block of chromeBlocks) {
    body = body.replace(new RegExp(`<section[^>]*data-template-block="${block}"[\\s\\S]*?<\\/section>`, "gi"), "");
  }
  body = body.replace(/<section[^>]*id="pharmacy-trust-cards"[\s\S]*?<\/section>/gi, "");
  return body;
}

export function bodyContainsForbiddenPhrases(html: string): string[] {
  const body = extractMainBodyContent(html).toLowerCase();
  return FORBIDDEN_BODY_PHRASES.filter((p) => body.includes(p.toLowerCase()));
}
