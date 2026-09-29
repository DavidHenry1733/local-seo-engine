/**
 * Shared publication-quality helpers for customer-facing pharmacy service pages.
 * Prefer confirmed Google/website evidence over corrupted profile fields.
 */
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

const WELCOME_PREFIX = /^(welcome\s+to\s+)/i;
const INVALID_IDENTITY = new Set(["home", "about", "services", "contact", "welcome", "pharmacy"]);

export function stripWelcomePharmacyNamePrefix(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(WELCOME_PREFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isInvalidPharmacyIdentityValue(value: unknown): boolean {
  const text = stripWelcomePharmacyNamePrefix(value);
  if (!text) return true;
  const normalized = text.toLowerCase();
  if (INVALID_IDENTITY.has(normalized)) return true;
  if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) return true;
  if (/^welcome\b/i.test(String(value ?? "").trim()) && text.length < 12) return true;
  if (/\bwordpress\b/i.test(text)) return true;
  if (/^(my blog|hello world!?|sample page|uncategorized|log in)$/i.test(normalized)) return true;
  if (/\(c\)|©|\bcopyright\b/i.test(normalized) && !/\bpharmacy\b/i.test(normalized)) return true;
  return false;
}

/**
 * Google listing titles sometimes append clinics/treatments/conditions after `|`.
 * Those remain confirmed identity evidence, but must not be the customer-facing pharmacy name.
 */
export function isKeywordStuffedPharmacyListingName(value: unknown): boolean {
  const text = stripWelcomePharmacyNamePrefix(value);
  if (!text.includes("|")) return false;
  const parts = text.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.length >= 3) return true;
  const tail = parts.slice(1).join(" ");
  return /(clinic|treatment|vaccin|\bache\b|sore throat|sinus|shingles|\buti\b|impetigo|ear wax|infected bite)/i.test(
    tail,
  );
}

export function isPlausibleUkPhoneNumber(phone: unknown): boolean {
  const raw = String(phone ?? "").trim();
  if (!raw) return false;
  if (/\/|\\|\.png|\.jpe?g|\.webp|\.svg|wsimg|favicon/i.test(raw)) return false;
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length >= 11 && digits.length <= 12) return true;
  if (digits.startsWith("0") && digits.length === 11) return true;
  return false;
}

export function formatConfirmedUkPhone(phone: unknown): string {
  const raw = String(phone ?? "").trim();
  if (!isPlausibleUkPhoneNumber(raw)) return "";
  const digits = raw.replace(/\D/g, "");
  let local = digits;
  if (digits.startsWith("44") && digits.length >= 11) local = `0${digits.slice(2)}`;
  if (local.length === 11 && local.startsWith("0")) {
    return `${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return raw;
}

type WebsiteIdentitySnapshot = {
  pharmacyName?: string;
  businessName?: string;
  intelligence?: {
    business?: { businessName?: { selected?: string; candidates?: Array<{ value?: string }> } };
  };
};

function firstValidIdentityName(values: unknown[]): string {
  for (const value of values) {
    const text = stripWelcomePharmacyNamePrefix(value);
    if (!isInvalidPharmacyIdentityValue(text)) return text;
  }
  return "";
}

export function firstCustomerFacingPharmacyName(values: unknown[]): string {
  for (const value of values) {
    const text = stripWelcomePharmacyNamePrefix(value);
    if (isInvalidPharmacyIdentityValue(text) || isKeywordStuffedPharmacyListingName(text)) continue;
    return text;
  }
  return "";
}

function htmlEncodedPharmacyName(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Google listing titles that must not be treated as the customer-facing pharmacy name. */
export function keywordStuffedPharmacyListingNameCandidates(data: {
  pharmacyName?: string;
  googleImportSnapshot?: { businessName?: string } | null;
}): string[] {
  const values = [data.pharmacyName, data.googleImportSnapshot?.businessName];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const text = stripWelcomePharmacyNamePrefix(value);
    if (!isKeywordStuffedPharmacyListingName(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

/**
 * Replace keyword-stuffed listing titles with the customer-facing pharmacy name.
 * Service/condition wording that is not part of that listing title is left intact.
 */
export function replaceKeywordStuffedPharmacyListingNames(html: string, data: PharmacyProfileData): string {
  const canonical = resolvePublicationPharmacyIdentity(data).pharmacyName;
  if (!canonical || !html) return html;
  let out = html;
  for (const stuffed of keywordStuffedPharmacyListingNameCandidates(data)) {
    if (!stuffed || stuffed === canonical) continue;
    if (out.includes(stuffed)) out = out.split(stuffed).join(canonical);
    const encoded = htmlEncodedPharmacyName(stuffed);
    if (encoded !== stuffed && out.includes(encoded)) out = out.split(encoded).join(canonical);
  }
  return out;
}

function websiteIntelligenceBusinessNames(data: {
  websiteImportSnapshot?: WebsiteIdentitySnapshot | null;
}): string[] {
  const snapshot = data.websiteImportSnapshot as WebsiteIdentitySnapshot | null;
  const field = snapshot?.intelligence?.business?.businessName;
  const values = [field?.selected, ...(field?.candidates || []).map((row) => row.value)];
  return values.map((value) => stripWelcomePharmacyNamePrefix(value)).filter(Boolean);
}

/** Confirmed Google, branch, parent-brand and non-placeholder profile names. Not page H1. */
export function confirmedTenantIdentityCandidates(data: {
  pharmacyName?: string;
  tradingName?: string;
  googleImportSnapshot?: { businessName?: string } | null;
  websiteImportSnapshot?: WebsiteIdentitySnapshot | null;
  websiteBranchResolution?: {
    parentBrand?: { tradingName?: string };
    selectedBranch?: { googleBusinessName?: string | null };
  } | null;
}): string[] {
  const google = data.googleImportSnapshot;
  const website = data.websiteImportSnapshot as WebsiteIdentitySnapshot | null;
  const branch = data.websiteBranchResolution?.selectedBranch;
  const parentBrand = data.websiteBranchResolution?.parentBrand;
  const values = [
    google?.businessName,
    branch?.googleBusinessName,
    parentBrand?.tradingName,
    website?.pharmacyName,
    website?.businessName,
    ...websiteIntelligenceBusinessNames(data),
    data.tradingName,
    data.pharmacyName,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const text = stripWelcomePharmacyNamePrefix(value);
    if (isInvalidPharmacyIdentityValue(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function snapshotName(data: PharmacyProfileData): string {
  return (
    firstCustomerFacingPharmacyName(confirmedTenantIdentityCandidates(data)) ||
    firstValidIdentityName(confirmedTenantIdentityCandidates(data))
  );
}

function snapshotPhone(data: PharmacyProfileData): string {
  const google = data.googleImportSnapshot;
  const website = data.websiteImportSnapshot as { phone?: string } | null;
  const branch = data.websiteBranchResolution?.selectedBranch as { phone?: string } | undefined;
  const candidates = [google?.phone, website?.phone, branch?.phone, data.phone];
  for (const candidate of candidates) {
    if (isPlausibleUkPhoneNumber(candidate)) return formatConfirmedUkPhone(candidate);
  }
  return "";
}

export function resolvePublicationPharmacyIdentity(data: PharmacyProfileData): {
  pharmacyName: string;
  phone: string;
  source: { name: string; phone: string };
} {
  const fromSnapshot = snapshotName(data);
  const fromProfile = firstCustomerFacingPharmacyName([data.tradingName, data.pharmacyName])
    || stripWelcomePharmacyNamePrefix(data.tradingName || data.pharmacyName || "");
  const pharmacyName =
    (!isInvalidPharmacyIdentityValue(fromSnapshot) && fromSnapshot) ||
    (!isInvalidPharmacyIdentityValue(fromProfile) && fromProfile) ||
    "";
  const phone = snapshotPhone(data);
  return {
    pharmacyName,
    phone,
    source: {
      name: fromSnapshot && pharmacyName === fromSnapshot ? "google-or-website-snapshot" : "profile-sanitised",
      phone: phone ? "confirmed-plausible-uk" : "unavailable",
    },
  };
}

function removeFaqCard(html: string, questionPattern: RegExp): string {
  return html.replace(
    new RegExp(
      `<div class="cluster-faq-item faq-card"><h3 class="faq-q">${questionPattern.source}</h3><p class="faq-a">[\\s\\S]*?</p></div>`,
      "gi",
    ),
    "",
  );
}

function removeEqualHeightCardByTitle(html: string, titlePattern: RegExp): string {
  return html.replace(
    new RegExp(
      `<div class="card equal-height-card"[^>]*>\\s*<div class="card-title-block"><h3 class="card-title-line-2">(?:<span class="visually-hidden">[^<]*</span>)?${titlePattern.source}</h3></div><p class="card-body">[\\s\\S]*?</p></div>`,
      "gi",
    ),
    "",
  );
}

const UNCONFIRMED_AMENITY_VALUES = ["Private consultation room", "NHS pharmacy services"];

function isUnconfirmedAmenityList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== UNCONFIRMED_AMENITY_VALUES.length) return false;
  return UNCONFIRMED_AMENITY_VALUES.every((item, i) => value[i] === item);
}

function rewriteJsonLdValue(value: unknown, mutateNode: (node: Record<string, unknown>) => void): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteJsonLdValue(item, mutateNode));
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node)) {
    if (!key) continue;
    out[key] = rewriteJsonLdValue(child, mutateNode);
  }
  mutateNode(out);
  return out;
}

function clearUnconfirmedAmenityFeature(node: Record<string, unknown>): void {
  if (isUnconfirmedAmenityList(node.amenityFeature)) node.amenityFeature = [];
}

function rewriteJsonLdScriptElements(
  html: string,
  mutate: (data: unknown) => unknown,
): string {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs: string, raw: string) => {
    if (!/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) return full;
    try {
      const data = JSON.parse(String(raw));
      const next = mutate(data);
      return `<script type="application/ld+json">${JSON.stringify(next)}</script>`;
    } catch {
      return full;
    }
  });
}

function scrubUnsupportedFaqJsonLd(
  html: string,
  options: { dropEligibility: boolean; dropAbpm: boolean },
): string {
  return rewriteJsonLdScriptElements(html, (data) => {
    const graph = Array.isArray((data as { ["@graph"]?: unknown })?.["@graph"])
      ? (data as { ["@graph"]: unknown[] })["@graph"]
      : Array.isArray(data)
        ? data
        : [data];
    for (const node of graph) {
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (record["@type"] !== "FAQPage" || !Array.isArray(record.mainEntity)) continue;
      record.mainEntity = record.mainEntity.filter((item: { name?: string }) => {
        const name = String(item?.name || "");
        if (
          options.dropEligibility &&
          (/not eligible/i.test(name) || /under 40 but my parent/i.test(name))
        ) {
          return false;
        }
        if (options.dropAbpm && (/What is ABPM/i.test(name) || /What is further monitoring/i.test(name))) {
          return false;
        }
        return true;
      });
      const seen = new Set<string>();
      record.mainEntity = record.mainEntity.filter((item: { name?: string }) => {
        const key = String(item?.name || "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return data;
  });
}

/** BP-only evidence scrub — never run for other services. */
export function scrubBloodPressureUnconfirmedClaims(
  html: string,
  options: {
    fundingModel?: string | null;
    walkInAvailable?: boolean | null;
    appointmentRequired?: boolean | null;
    abpmConfirmed?: boolean;
  },
): string {
  let out = html;
  const funding = String(options.fundingModel || "unknown").toLowerCase();
  const nhsConfirmed = funding === "nhs" || funding === "mixed";

  if (!nhsConfirmed) {
    out = out.replace(
      /delivers the NHS Hypertension Case-Finding Service[^.]*\./gi,
      "offers blood pressure checks to help identify raised readings early.",
    );
    out = out.replace(/\bNHS Hypertension Case-Finding Service\b/gi, "blood pressure check service");
    out = out.replace(/\bNHS hypertension case-finding\b/gi, "blood pressure screening");
    out = out.replace(/\ba free screening service\b/gi, "a blood pressure check");
    out = out.replace(/\bfree NHS screening\b/gi, "blood pressure screening");
    out = out.replace(/confirm NHS screening or ABPM availability before you visit\./gi, "ask what blood pressure support is available before you visit.");
    out = out.replace(/NHS hypertension case-finding and private blood pressure screening/gi, "blood pressure checks and private screening options where available");
    out = rewriteJsonLdScriptElements(out, (data) =>
      rewriteJsonLdValue(data, clearUnconfirmedAmenityFeature),
    );
    out = out.replace(/alt="NHS blood pressure check/gi, 'alt="Blood pressure check');
    out = out.replace(/\bthe NHS service\b/gi, "the pharmacy blood pressure check");
    out = out.replace(/\bthe NHS case-?finding service\b/gi, "this blood pressure check");
    out = out.replace(/\bNHS case-?finding service\b/gi, "blood pressure check");
    out = out.replace(/\bNHS casefinding service\b/gi, "blood pressure check");
    out = out.replace(/These are separate from the NHS service[^.]*\./gi, "Ask what is available locally and whether a charge applies.");
    out = out.replace(/If the NHS service is not suitable[^.]*\./gi, "Ask when you call what options may suit you, including a private check or GP appointment.");
    out = out.replace(
      /Yorkshire Pharmacy[^<]{0,80}also offers private blood pressure checks for a fee\.[^<]*/gi,
      "Private blood pressure checks may be available for a fee — ask what applies locally.",
    );
    out = removeEqualHeightCardByTitle(out, /Routine screening if you are 40 or over/);
    out = removeEqualHeightCardByTitle(out, /Younger adults with a reason to check/);
    out = removeEqualHeightCardByTitle(out, /You may not be suitable for the NHS casefinding service if:/);
    out = removeFaqCard(out, /What if I am not eligible for the NHS service\?/);
    out = removeFaqCard(out, /What if I am not eligible for the pharmacy blood pressure check\?/);
    out = removeFaqCard(out, /I am under 40 but my parent had high blood pressure — can I still get checked\?/);
    out = removeFaqCard(out, /What is further monitoring and why might I need it\?/);
    out = out.replace(/NHS Hypertension Case-Finding Service — confirm local commissioning when you call/gi, "Blood pressure checks — call to confirm what is available locally");
    out = out.replace(/How long does a blood pressure appointment take\?/gi, "How long does a blood pressure check take?");
    out = out.replace(/What Happens During The Appointment/gi, "What Happens During The Check");
    out = out.replace(/How your Blood Pressure Checks consultation works/gi, "How a Blood Pressure Checks consultation works");
    out = out.replace(
      /Regulated pharmacy teams follow clinical governance for NHS screening pathways where commissioned[^.]*\./gi,
      "Regulated pharmacy teams follow clinical governance for blood pressure checks, with clear scope and referral criteria.",
    );
    out = out.replace(/\bNHS screening pathways\b/gi, "pharmacy blood pressure pathways");
    out = removeFaqCard(out, /can I walk in without booking\?/i);
    out = removeFaqCard(out, /Do I need an appointment or can I walk in\?/i);
    out = out.replace(/Walk-in availability varies\.[^<]*/gi, "Contact the pharmacy to ask how blood pressure checks are arranged.");
    out = out.replace(/\bBooking ensures dedicated time[^.]*\./gi, "The pharmacy can explain how checks are arranged.");
    out = out.replace(/\bfree (blood pressure|BP) checks?\b/gi, "blood pressure checks");
  }

  if (!options.abpmConfirmed) {
    out = out.replace(
      /That may include ambulatory blood pressure monitoring \(ABPM\)[^.]*\./gi,
      "Your pharmacist explains the result and the safest next step, which may include GP follow-up.",
    );
    out = out.replace(
      /ABPM is offered when[^.]*\./gi,
      "Further monitoring may be advised when a clinic reading is raised but not in the emergency range.",
    );
    out = out.replace(/usually with ABPM,?/gi, "with further monitoring,");
    out = out.replace(/or ABPM availability/gi, "or further monitoring options");
    out = out.replace(/,?\s*and ABPM is the preferred method[^.]*\./gi, ".");
    out = out.replace(/ABPM or home monitoring over time helps tell the difference\./gi, "Home monitoring over time can help tell the difference.");
    out = out.replace(/if ABPM shows a very high average,?\s*/gi, "");
    out = removeFaqCard(out, /What is ABPM and why might I need it\?/);
    out = out.replace(/\bABPM\b/g, "further monitoring");
  }

  if (options.walkInAvailable !== true) {
    out = out.replace(
      /may offer walk-in checks or booked appointments[^.]*\./gi,
      "can advise how blood pressure checks are arranged.",
    );
    out = out.replace(/,?\s*or whether walk-in support is available/gi, "");
    out = out.replace(/Do I need an appointment or can I walk in\?/gi, "How are blood pressure checks arranged?");
  }

  if (options.appointmentRequired !== true && options.appointmentRequired !== false) {
    out = out.replace(/Booking ahead is recommended[^.]*\./gi, "Call the pharmacy to ask how to arrange a blood pressure check.");
    out = out.replace(/Private consultation room appointments may be available — call to confirm\./gi, "Call to ask how blood pressure checks are arranged.");
    out = out.replace(/check availability or book a consultation/gi, "ask how blood pressure checks are arranged");
    out = out.replace(/to check availability and book a Blood Pressure Checks consultation\./gi, "to ask how blood pressure checks are arranged.");
    out = out.replace(/Book Blood Pressure Checks at the pharmacy/gi, "Blood Pressure Checks at the pharmacy");
    out = out.replace(/Book Blood Pressure Checks at /gi, "Blood Pressure Checks at ");
    out = out.replace(/Do I need an appointment for a blood pressure check\?/gi, "How are blood pressure checks arranged?");
    out = out.replace(
      /can advise whether a booked consultation is available for a blood pressure check\./gi,
      "can advise how blood pressure checks are arranged.",
    );
    out = out.replace(
      /The pharmacy in Barnsley can advise whether a booked consultation is available for a blood pressure check\.[^<]*/gi,
      "Contact the pharmacy to ask how blood pressure checks are arranged. Call 01226 210477.",
    );
    out = out.replace(/Bring your readings to the appointment\./gi, "Bring your readings when you visit the pharmacy.");
    out = out.replace(/\bbooked consultation\b/gi, "blood pressure check");
  }

  if (!nhsConfirmed || !options.abpmConfirmed) {
    out = scrubUnsupportedFaqJsonLd(out, {
      dropEligibility: !nhsConfirmed,
      dropAbpm: !options.abpmConfirmed,
    });
  }

  out = out.replace(
    /(<div class="safety-prose"><p>Blood pressure screening is not for emergencies[\s\S]*?<\/p>)<p>Seek same-day medical review[\s\S]*?<\/p>(<\/div>)/i,
    "$1$2",
  );

  return out;
}

/** Scrub unconfirmed clinical/access claims from customer-facing HTML. */
export function scrubUnconfirmedServiceClaims(
  html: string,
  options: {
    fundingModel?: string | null;
    walkInAvailable?: boolean | null;
    appointmentRequired?: boolean | null;
    abpmConfirmed?: boolean;
    gphcConfirmed?: boolean;
    /** When set, BP-specific wording is applied only for blood-pressure-checks. */
    serviceId?: string | null;
    /** Locked approved-bank copy is the content authority and is not rewritten. */
    approvedBankContractAuthoritative?: boolean;
  },
): string {
  let out = html;
  const funding = String(options.fundingModel || "unknown").toLowerCase();
  const nhsConfirmed = funding === "nhs" || funding === "mixed";
  const serviceId = String(options.serviceId || "").trim();
  const isBloodPressure = serviceId === "blood-pressure-checks";

  // Shared sanitiser: never insert another service's clinical name or wording.
  if (!nhsConfirmed) {
    out = rewriteJsonLdScriptElements(out, (data) =>
      rewriteJsonLdValue(data, clearUnconfirmedAmenityFeature),
    );
    out = out.replace(/<a href="#nhs-services">NHS Services<\/a>/gi, "");
    if (serviceId !== "pharmacy-first") {
      out = out.replace(/>Book An Appointment</gi, ">Contact the pharmacy<");
    }
    out = removeEqualHeightCardByTitle(out, /^NHS Pharmacy Services$/i);
    out = out.replace(/\bNHS pharmacy services\b/gi, "pharmacy services");
    out = out.replace(/<div class="trust-item">✓?\s*NHS Services Available<\/div>/gi, "");
    out = out.replace(/<div class="trust-item">✓?\s*NHS service standards<\/div>/gi, "");
    out = out.replace(/✓\s*NHS Services Available/gi, "");
    out = out.replace(/\bNHS Services Available\b/gi, "");
    out = out.replace(/\bNHS-funded\b/gi, "pharmacy");
  }

  if (options.appointmentRequired !== true && options.appointmentRequired !== false) {
    out = out.replace(/availability, appointment options\./gi, "availability.");
    out = out.replace(/\bbooking support\b/gi, "advice");
    out = out.replace(/ or book a consultation/gi, "");
    out = out.replace(/to check availability and book[^.]*\./gi, "to ask how this service is arranged.");
    out = out.replace(/>Book [A-Za-z][^<]* at the pharmacy</gi, (m) => m.replace(/^>Book /, ">").replace(/ at the pharmacy</, " at the pharmacy<"));
    out = out.replace(/\bappointments available\b/gi, "availability");
    out = out.replace(/\bwalk-in available\b/gi, "availability");
    out = out.replace(/\bbook a consultation\b/gi, "contact the pharmacy");
  }

  if (!options.gphcConfirmed) {
    out = out.replace(/\s*·\s*GPhC Registered Pharmacy/gi, "");
    out = out.replace(/Professional registration, clinical governance and local accountability sit behind every consultation[^.]*\./gi, "");
  }

  if (isBloodPressure && !options.approvedBankContractAuthoritative) {
    out = scrubBloodPressureUnconfirmedClaims(out, options);
  }

  // Strip known URL-timestamp false phone artefacts if they survived earlier layers.
  out = out.replace(/0250511165738/g, "");
  out = out.replace(/tel:0250511165738/g, "#contact");
  out = out.replace(/Welcome to\s+/gi, "");

  // Deduplicate identical FAQ cards (keep first).
  const seenFaq = new Set<string>();
  out = out.replace(
    /<div class="cluster-faq-item faq-card"><h3 class="faq-q">([\s\S]*?)<\/h3><p class="faq-a">[\s\S]*?<\/p><\/div>/gi,
    (full, q) => {
      const key = String(q).replace(/\s+/g, " ").trim().toLowerCase();
      if (seenFaq.has(key)) return "";
      seenFaq.add(key);
      return full;
    },
  );

  return out;
}

export function reducePharmacyNameRepetition(html: string, pharmacyName: string): string {
  if (!pharmacyName || pharmacyName.length < 8) return html;
  const esc = pharmacyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ampEsc = esc.replace(/&/g, "(?:&|&amp;)");
  const protectedBlocks: string[] = [];
  const withoutProtected = html.replace(
    /<(script|style|noscript|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (block) => {
      protectedBlocks.push(block);
      return `<!--__PC_PROTECTED_${protectedBlocks.length - 1}__-->`;
    },
  ).replace(
    /<section\b[^>]*\bid=["']local-access["'][^>]*>[\s\S]*?<\/section>/gi,
    (block) => {
      protectedBlocks.push(block);
      return `<!--__PC_PROTECTED_${protectedBlocks.length - 1}__-->`;
    },
  );
  const parts = withoutProtected.split(/(<[^>]+>)/g);
  let count = 0;
  let prevEndedSentence = true;
  const rewritten = parts
    .map((part) => {
      if (part.startsWith("<")) {
        prevEndedSentence = /[.!?]["']?\s*$/.test(part) ? prevEndedSentence : prevEndedSentence;
        // Tags themselves don't change sentence state; look at preceding text.
        return part;
      }
      const next = part.replace(new RegExp(ampEsc, "gi"), (match, offset) => {
        count += 1;
        if (count <= 10) return match;
        const before = part.slice(0, offset);
        const atSentenceStart =
          !before.trim() ||
          /[.!?]["']?\s*$/.test(before) ||
          (offset === 0 && prevEndedSentence);
        return atSentenceStart ? "The pharmacy" : "the pharmacy";
      });
      prevEndedSentence = /[.!?]["']?\s*$/.test(next) || (!next.trim() && prevEndedSentence);
      return next;
    })
    .join("");
  return rewritten.replace(/<!--__PC_PROTECTED_(\d+)__-->/g, (_, idx) => protectedBlocks[Number(idx)] || "");
}
