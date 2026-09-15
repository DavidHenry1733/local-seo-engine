/**
 * Website Analysis & Profile Import — orchestrates LSE brand importer for pharmacy onboarding.
 * Reuses importBrandFromUrl; adds location, services, social, completion and smart merge.
 */
import { importBrandFromUrl, type BrandProfile } from "../generator/brandImporter.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { mapBrandProfileToPharmacyData } from "./pharmacyBrandProfileMapper.ts";
import {
  computeProfileCompleteness,
  computeWebsiteAnalysisChecklist,
  type ProfileCompletenessResult,
  type WebsiteAnalysisChecklistItem,
} from "./pharmacyProfileCompleteness.ts";
import type { WebsiteAddressCandidate } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import { isRejectedSocialUrl } from "./growthEngineWebsiteBusinessIntelligenceEvidence.ts";

export interface DetectedWebsiteService {
  serviceId: string;
  serviceName: string;
  confidence: number;
}

export interface WebsiteLocationHints {
  primaryTown: string;
  primaryCity: string;
  county: string;
  postcode: string;
  addressLine1: string;
  confidence: number;
}

export interface WebsiteAddressHtmlInput {
  html: string;
  sourceUrl: string;
  sourceType: WebsiteAddressCandidate["sourceType"];
}

export interface WebsiteSocialLinks {
  facebook: string;
  instagram: string;
  linkedIn: string;
  x: string;
  youTube: string;
}

export interface AnalysisPhaseItem {
  label: string;
  value: string;
  confidence?: number;
}

export interface AnalysisPhase {
  id: string;
  label: string;
  status: "complete" | "partial" | "empty";
  items: AnalysisPhaseItem[];
}

export interface MergeFieldPreview {
  field: string;
  label: string;
  imported: string;
  existing: string;
  action: "apply" | "skip";
}

export interface WebsiteAnalysisResult {
  brand: BrandProfile;
  phases: AnalysisPhase[];
  location: WebsiteLocationHints;
  socialLinks: WebsiteSocialLinks;
  googleMapsUrl: string;
  buttonStyle: string;
  detectedServices: DetectedWebsiteService[];
  profilePatch: Partial<PharmacyProfileData>;
  mergePreview: MergeFieldPreview[];
  checklist: WebsiteAnalysisChecklistItem[];
  completeness: ProfileCompletenessResult;
  projectedCompleteness: ProfileCompletenessResult;
}

/** Known pharmacy service keywords → canonical service id. */
const SERVICE_DETECTION_PATTERNS: { id: string; name: string; patterns: RegExp[] }[] = [
  { id: "pharmacy-first", name: "Pharmacy First", patterns: [/pharmacy\s+first/i, /\bnhs\s+pharmacy\s+first\b/i] },
  { id: "travel-vaccinations", name: "Travel Vaccinations", patterns: [/travel\s+vaccin/i, /travel\s+health/i] },
  { id: "blood-pressure-checks", name: "Blood Pressure Checks", patterns: [/blood\s+pressure/i, /\bbp\s+check/i] },
  { id: "emergency-contraception", name: "Emergency Contraception", patterns: [/emergency\s+contraception/i, /\bmorning\s+after\b/i] },
  { id: "flu-vaccinations", name: "Flu Vaccinations", patterns: [/flu\s+vaccin/i, /seasonal\s+flu/i] },
  { id: "weight-management", name: "Weight Management", patterns: [/weight\s+management/i, /weight\s+loss\s+service/i] },
  { id: "repeat-prescriptions", name: "Repeat Prescriptions", patterns: [/repeat\s+prescription/i, /repeat\s+medication/i] },
  { id: "ear-wax-removal", name: "Ear Wax Removal", patterns: [/ear\s+wax/i, /micro\s*suction/i] },
  { id: "smoking-cessation", name: "Smoking Cessation", patterns: [/smoking\s+cessation/i, /stop\s+smoking/i] },
  { id: "new-medicine-service", name: "New Medicine Service", patterns: [/new\s+medicine\s+service/i, /\bnms\b/i] },
  { id: "prescription-dispensing", name: "Prescription Dispensing", patterns: [/prescription\s+dispens/i, /order\s+prescription/i] },
];

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

const DAY_KEY_MAP: Record<string, string> = {
  monday: "openingHoursMonday",
  tuesday: "openingHoursTuesday",
  wednesday: "openingHoursWednesday",
  thursday: "openingHoursThursday",
  friday: "openingHoursFriday",
  saturday: "openingHoursSaturday",
  sunday: "openingHoursSunday",
};

function str(v: unknown): string {
  return String(v ?? "").trim();
}

/** Extract meta / schema business description — no invention. */
export function extractBusinessDescriptionFromHtml(html: string): string {
  const meta =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
    ?? html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/"description"\s*:\s*"([^"]{20,500})"/i)?.[1];
  const cleaned = str(meta).replace(/\s+/g, " ");
  if (cleaned.length < 20) return "";
  return cleaned.slice(0, 600);
}

/** Extract opening hours from schema.org when present. */
export function extractOpeningHoursFromHtml(html: string): Partial<PharmacyProfileData> {
  const patch: Partial<PharmacyProfileData> = {};
  const blocks = html.match(/"openingHoursSpecification"\s*:\s*\[[\s\S]*?\]/gi) || [];
  const specs = blocks.length ? blocks[0] : html;

  for (const [dayName, key] of Object.entries(DAY_KEY_MAP)) {
    const dayPattern = new RegExp(`"dayOfWeek"\\s*:\\s*"[^"]*${dayName}[^"]*"[^}]*"opens"\\s*:\\s*"([^"]+)"[^}]*"closes"\\s*:\\s*"([^"]+)"`, "i");
    const m = specs.match(dayPattern);
    if (m) {
      (patch as Record<string, string>)[key] = `${m[1]} – ${m[2]}`;
    }
  }

  // Compact Mo–Fr pattern fallback
  if (!Object.keys(patch).length) {
    const compact = html.match(/(?:Mon|Monday)[^<]{0,120}(?:\d{1,2}[:.]?\d{0,2}\s*(?:am|pm)?[^<]{0,40}){1,2}/i)?.[0];
    if (compact && compact.length > 8 && compact.length < 120) {
      patch.openingHours = compact.trim();
    }
  }

  return patch;
}

function isEmptyProfileValue(field: string, value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (field === "gphcNumberMarkedMissing" || field === "superintendentPharmacistNameMarkedMissing") return false;
  return false;
}

const MERGE_FIELD_LABELS: Record<string, string> = {
  pharmacyName: "Pharmacy name",
  tradingName: "Trading name",
  website: "Website URL",
  logoUrl: "Logo",
  faviconUrl: "Favicon",
  brandPrimaryColor: "Primary colour",
  brandSecondaryColor: "Secondary colour",
  brandCtaColor: "CTA colour",
  brandAccentColor: "Accent colour",
  brandBackgroundColor: "Background colour",
  brandTextColor: "Heading colour",
  brandMutedTextColor: "Text colour",
  fontHeading: "Heading font",
  fontBody: "Body font",
  buttonStyle: "Button style",
  headerNavLinks: "Header navigation",
  footerLinks: "Footer navigation",
  headerCtaText: "Primary CTA",
  headerCtaUrl: "Primary CTA URL",
  phone: "Telephone",
  businessEmail: "Email",
  socialFacebook: "Facebook",
  socialInstagram: "Instagram",
  socialLinkedIn: "LinkedIn",
  socialX: "X / Twitter",
  socialYouTube: "YouTube",
  googleMapsEmbedUrl: "Google Maps link",
  townCity: "Town / city",
  primaryTown: "Primary town",
  primaryCity: "City",
  county: "County",
  postcode: "Postcode",
  addressLine1: "Address line 1",
  businessDescription: "About / description",
  openingHoursMonday: "Monday hours",
  openingHoursTuesday: "Tuesday hours",
  openingHoursWednesday: "Wednesday hours",
  openingHoursThursday: "Thursday hours",
  openingHoursFriday: "Friday hours",
  openingHoursSaturday: "Saturday hours",
  openingHoursSunday: "Sunday hours",
  openingHours: "Opening hours summary",
};

export function detectPharmacyServicesFromHtml(html: string): DetectedWebsiteService[] {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const found: DetectedWebsiteService[] = [];
  for (const svc of SERVICE_DETECTION_PATTERNS) {
    const hits = svc.patterns.filter((p) => p.test(text)).length;
    if (!hits) continue;
    const navBonus = svc.patterns.some((p) => {
      const navMatch = html.match(/<(?:nav|header)[^>]*>([\s\S]*?)<\/(?:nav|header)>/gi);
      return navMatch?.some((block) => p.test(block)) ?? false;
    });
    const confidence = Math.min(95, 45 + hits * 15 + (navBonus ? 20 : 0));
    found.push({ serviceId: svc.id, serviceName: svc.name, confidence });
  }
  return found.sort((a, b) => b.confidence - a.confidence);
}

export function extractSocialLinksFromHtml(html: string): WebsiteSocialLinks {
  const pick = (pattern: RegExp): string => {
    const matches = [...html.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
    for (const m of matches) {
      const url = (m[1] || "").trim();
      if (url && !isRejectedSocialUrl(url)) return url;
    }
    return "";
  };
  return {
    facebook: pick(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/i),
    instagram: pick(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i),
    linkedIn: pick(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']+)["']/i),
    x: pick(/href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i),
    youTube: pick(/href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"']+)["']/i),
  };
}

export function extractGoogleMapsUrlFromHtml(html: string): string {
  const m =
    html.match(/href=["'](https?:\/\/(?:www\.)?google\.[^"']*\/maps[^"']+)["']/i)
    ?? html.match(/href=["'](https?:\/\/maps\.google\.[^"']+)["']/i);
  return m?.[1]?.trim() || "";
}

function cleanText(v: string): string {
  return str(v)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&copy;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/address|\/section|\/footer|\/header)\b[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s*\|\s*/g, " | ");
}

export function extractFooterHtmlFromHomepage(homepageHtml: string): string {
  return homepageHtml.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i)?.[0] || "";
}

function sourcePriority(sourceType: WebsiteAddressCandidate["sourceType"]): number {
  return { schema: 5, microdata: 4, "contact-page": 3, footer: 2, "about-page": 1 }[sourceType] || 0;
}

function uniqueAddressCandidates(candidates: WebsiteAddressCandidate[]): WebsiteAddressCandidate[] {
  const seen = new Set<string>();
  const out: WebsiteAddressCandidate[] = [];
  for (const c of candidates) {
    const key = `${c.addressLine1}|${c.town}|${c.postcode}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function buildSchemaCandidate(input: WebsiteAddressHtmlInput): WebsiteAddressCandidate | null {
  const html = input.html;
  const schemaType = /PostalAddress|schema\.org\/PostalAddress|streetAddress|addressLocality|postalCode/i.test(html)
    ? input.sourceType
    : null;
  if (!schemaType) return null;

  const locality =
    html.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1]
    ?? html.match(/itemprop=["']addressLocality["'][^>]*>([^<]+)/i)?.[1];
  const postal =
    html.match(/"postalCode"\s*:\s*"([^"]+)"/i)?.[1]
    ?? html.match(/itemprop=["']postalCode["'][^>]*>([^<]+)/i)?.[1];
  const street =
    html.match(/"streetAddress"\s*:\s*"([^"]+)"/i)?.[1]
    ?? html.match(/itemprop=["']streetAddress["'][^>]*>([\s\S]*?)<\/(?:span|div|p|address)>/i)?.[1];

  const addressLine1 = cleanText(String(street || "").replace(/<[^>]+>/g, " "));
  const town = cleanText(locality || "");
  const postcode = cleanText(postal || "").toUpperCase();
  if (!addressLine1 || !town || !UK_POSTCODE_RE.test(postcode)) return null;

  return {
    addressLine1,
    addressLine2: "",
    town,
    postcode: postcode.replace(/\s+/, " "),
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType === "microdata" ? "microdata" : "schema",
    matchedSnippet: cleanText([addressLine1, town, postcode].join(", ")).slice(0, 260),
    confidence: input.sourceType === "microdata" ? 88 : 92,
  };
}

function stripNoiseFromAddressWindow(raw: string): string {
  let text = cleanText(raw)
    .replace(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+44\s?|0)\d[\d\s().-]{8,}\d/g, " ")
    .replace(/\b(?:Phone|Telephone|Tel|Email|Mail|Opening Hours?|Hours?|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b:?/gi, " ")
    .replace(/\b(?:All rights reserved|Powered by|Copyright|Cookies?|Privacy Policy|Terms(?: and Conditions)?)\b[\s\S]*$/i, " ");
  text = text.replace(/\s*\|\s*/g, ", ").replace(/\s+/g, " ").trim();
  return text;
}

function visibleAddressCandidate(input: WebsiteAddressHtmlInput): WebsiteAddressCandidate | null {
  if (!input.html) return null;
  const text = visibleTextFromHtml(input.html);
  const postcodeMatch = text.match(UK_POSTCODE_RE);
  if (!postcodeMatch || postcodeMatch.index == null) return null;

  const rawWindow = text.slice(Math.max(0, postcodeMatch.index - 260), postcodeMatch.index + postcodeMatch[0].length + 120);
  if (/\b(?:registered office|supplier address|delivery address|returns address|company number|vat number)\b/i.test(rawWindow)) {
    return null;
  }

  const postcode = postcodeMatch[1].toUpperCase().replace(/\s+/, " ");
  const cleanedWindow = stripNoiseFromAddressWindow(rawWindow);
  const postcodeIndex = cleanedWindow.toUpperCase().indexOf(postcode.toUpperCase());
  const beforePostcode = postcodeIndex >= 0 ? cleanedWindow.slice(0, postcodeIndex) : cleanedWindow;
  const parts = beforePostcode
    .split(/\s*,\s*/)
    .map((p) => cleanText(p.replace(/\b(?:Address|Find us|Contact us|Visit us|Our pharmacy|Location|Our Location)\b:?/gi, " ")))
    .filter((p) => p && p.length <= 90);

  let streetIndex = -1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    if (/\d+[A-Z]?\b/.test(p) && /\b(?:road|rd|street|st|lane|ln|avenue|ave|drive|dr|close|cl|way|place|pl|terrace|court|ct|broom|high\s+street|park|square|sq|crescent|cres)\b/i.test(p)) {
      streetIndex = i;
      break;
    }
  }
  if (streetIndex < 0) return null;

  const addressLine1 = parts[streetIndex];
  const previousLine = parts[streetIndex - 1] || "";
  const addressLine2 = /\b(?:unit|suite|flat|floor|building|shop)\b/i.test(previousLine) && !/\b(?:contact|email|phone|opening|home|about|services|information|team|help)\b/i.test(previousLine)
    ? previousLine
    : "";
  const town = parts[streetIndex + 1] || "";
  if (!town || /\d|@|www\.|https?:/i.test(town)) return null;

  const labelBonus = /\b(?:Address|Find us|Contact us|Visit us|Our pharmacy|Location|Our Location)\b/i.test(rawWindow) ? 8 : 0;
  const sourceBonus = input.sourceType === "contact-page" ? 8 : input.sourceType === "footer" ? 4 : 0;
  const confidence = Math.min(88, 60 + labelBonus + sourceBonus + (addressLine1 ? 8 : 0) + (town ? 6 : 0));
  if (confidence < 70) return null;

  return {
    addressLine1,
    addressLine2,
    town,
    postcode,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    matchedSnippet: cleanText(rawWindow).slice(0, 320),
    confidence,
  };
}

export function extractWebsiteAddressCandidates(inputs: WebsiteAddressHtmlInput[]): WebsiteAddressCandidate[] {
  const candidates: WebsiteAddressCandidate[] = [];
  for (const input of inputs) {
    if (!input.html) continue;
    const schemaCandidate = buildSchemaCandidate(input);
    if (schemaCandidate) candidates.push(schemaCandidate);
    if (input.sourceType === "contact-page" || input.sourceType === "footer" || input.sourceType === "about-page") {
      const visibleCandidate = visibleAddressCandidate(input);
      if (visibleCandidate) candidates.push(visibleCandidate);
    }
  }
  return uniqueAddressCandidates(candidates).sort((a, b) => {
    const priorityDelta = sourcePriority(b.sourceType) - sourcePriority(a.sourceType);
    return priorityDelta || b.confidence - a.confidence;
  });
}

export function selectCanonicalWebsiteAddressCandidate(
  candidates: WebsiteAddressCandidate[],
): WebsiteAddressCandidate | null {
  return candidates.find((c) => c.confidence >= 70 && c.addressLine1 && c.town && UK_POSTCODE_RE.test(c.postcode)) || null;
}

export function extractLocationFromHtml(html: string, contactAddress = ""): WebsiteLocationHints {
  const empty: WebsiteLocationHints = {
    primaryTown: "",
    primaryCity: "",
    county: "",
    postcode: "",
    addressLine1: "",
    confidence: 0,
  };

  const locality =
    html.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1]
    ?? html.match(/itemprop="addressLocality"[^>]*>([^<]+)/i)?.[1];
  const region =
    html.match(/"addressRegion"\s*:\s*"([^"]+)"/i)?.[1]
    ?? html.match(/itemprop="addressRegion"[^>]*>([^<]+)/i)?.[1];
  const postal =
    html.match(/"postalCode"\s*:\s*"([^"]+)"/i)?.[1]
    ?? html.match(/itemprop="postalCode"[^>]*>([^<]+)/i)?.[1];
  const street =
    html.match(/"streetAddress"\s*:\s*"([^"]+)"/i)?.[1]
    ?? html.match(/itemprop="streetAddress"[^>]*>([^<]+)/i)?.[1];

  let postcode = str(postal);
  let addressLine1 = str(street);
  let primaryTown = str(locality);
  let county = str(region);

  if (!postcode && contactAddress) {
    const pc = contactAddress.match(UK_POSTCODE_RE);
    if (pc) postcode = pc[1].toUpperCase().replace(/\s+/, " ");
  }
  if (!addressLine1 && contactAddress && !postcode) {
    addressLine1 = contactAddress.split(",")[0]?.trim() || "";
  }

  const found = [primaryTown, county, postcode, addressLine1].filter(Boolean).length;
  if (found === 0) return empty;

  const confidence = postcode && primaryTown ? 85 : postcode || primaryTown ? 60 : 35;
  if (confidence < 50) {
    return { ...empty, confidence };
  }

  return {
    primaryTown,
    primaryCity: primaryTown,
    county,
    postcode: postcode.toUpperCase(),
    addressLine1,
    confidence,
  };
}

function detectButtonStyleFromBrand(brand: BrandProfile): string {
  const cta = str(brand.buttonColour);
  if (cta && cta.toLowerCase() !== "#005eb8") return "rounded-cta";
  return "";
}

function buildPhases(brand: BrandProfile, location: WebsiteLocationHints, social: WebsiteSocialLinks, services: DetectedWebsiteService[]): AnalysisPhase[] {
  const phaseStatus = (items: AnalysisPhaseItem[]): AnalysisPhase["status"] => {
    const filled = items.filter((i) => i.value).length;
    if (filled === 0) return "empty";
    if (filled >= items.length) return "complete";
    return "partial";
  };

  const identity: AnalysisPhaseItem[] = [
    { label: "Pharmacy name", value: brand.businessName, confidence: brand.businessName ? 80 : 0 },
    { label: "Trading name", value: brand.businessName, confidence: brand.businessName ? 70 : 0 },
    { label: "Website URL", value: brand.sourceUrl, confidence: 100 },
    { label: "Logo", value: brand.logoUrl ? "Detected" : "", confidence: brand.confidence.logo },
    { label: "Favicon", value: brand.faviconUrl ? "Detected" : "", confidence: brand.faviconUrl ? 70 : 0 },
  ];

  const branding: AnalysisPhaseItem[] = [
    { label: "Primary colour", value: brand.primaryColour, confidence: brand.confidence.colours },
    { label: "Secondary colour", value: brand.secondaryColour, confidence: brand.confidence.colours },
    { label: "CTA colour", value: brand.buttonColour, confidence: brand.confidence.colours },
    { label: "Accent colour", value: brand.accentColour, confidence: brand.confidence.colours },
    { label: "Background colour", value: brand.backgroundColour, confidence: brand.confidence.colours },
    { label: "Heading colour", value: brand.headingColour, confidence: brand.confidence.colours },
    { label: "Text colour", value: brand.bodyTextColour, confidence: brand.confidence.colours },
    { label: "Heading font", value: brand.headingFont, confidence: brand.confidence.fonts },
    { label: "Body font", value: brand.bodyFont, confidence: brand.confidence.fonts },
  ];

  const navigation: AnalysisPhaseItem[] = [
    { label: "Header links", value: brand.navigationLinks?.length ? `${brand.navigationLinks.length} link(s)` : "" },
    { label: "Footer links", value: brand.footerLinks?.length ? `${brand.footerLinks.length} link(s)` : "" },
    { label: "Primary CTA", value: brand.ctaText || "" },
    { label: "Primary CTA URL", value: brand.ctaUrl || "" },
  ];

  const contact: AnalysisPhaseItem[] = [
    { label: "Telephone", value: brand.contact?.phone || "", confidence: brand.confidence.contact },
    { label: "Email", value: brand.contact?.email || "", confidence: brand.confidence.contact },
    { label: "Facebook", value: social.facebook },
    { label: "Instagram", value: social.instagram },
    { label: "Google Maps", value: brand.contact?.address ? "Address detected" : "" },
  ];

  const locationItems: AnalysisPhaseItem[] = [
    { label: "Primary town", value: location.primaryTown, confidence: location.confidence },
    { label: "City", value: location.primaryCity, confidence: location.confidence },
    { label: "County", value: location.county, confidence: location.confidence },
    { label: "Postcode", value: location.postcode, confidence: location.confidence },
  ];

  const serviceItems: AnalysisPhaseItem[] = services.slice(0, 8).map((s) => ({
    label: s.serviceName,
    value: `${s.confidence}% confidence`,
    confidence: s.confidence,
  }));

  return [
    { id: "identity", label: "Website Identity", status: phaseStatus(identity), items: identity },
    { id: "branding", label: "Brand Identity", status: phaseStatus(branding), items: branding },
    { id: "navigation", label: "Navigation", status: phaseStatus(navigation), items: navigation },
    { id: "contact", label: "Contact Information", status: phaseStatus(contact), items: contact },
    { id: "location", label: "Location", status: phaseStatus(locationItems), items: locationItems },
    { id: "services", label: "Service Detection", status: serviceItems.length ? "partial" : "empty", items: serviceItems },
  ];
}

export function buildProfilePatchFromAnalysis(
  brand: BrandProfile,
  location: WebsiteLocationHints,
  social: WebsiteSocialLinks,
  googleMapsUrl: string,
  buttonStyle: string,
  detectedServices: DetectedWebsiteService[],
  html = "",
): Partial<PharmacyProfileData> {
  const base = mapBrandProfileToPharmacyData(brand);
  const patch: Partial<PharmacyProfileData> = { ...base };

  if (location.confidence >= 50) {
    if (location.primaryTown) {
      patch.primaryTown = location.primaryTown;
      patch.primaryCity = location.primaryCity;
      patch.townCity = location.primaryTown;
    }
    if (location.county) patch.county = location.county;
    if (location.postcode) patch.postcode = location.postcode;
    if (location.addressLine1) patch.addressLine1 = location.addressLine1;
  }

  if (social.facebook) patch.socialFacebook = social.facebook;
  if (social.instagram) patch.socialInstagram = social.instagram;
  if (social.linkedIn) patch.socialLinkedIn = social.linkedIn;
  if (social.x) patch.socialX = social.x;
  if (social.youTube) patch.socialYouTube = social.youTube;
  if (googleMapsUrl) patch.googleMapsEmbedUrl = googleMapsUrl;
  if (buttonStyle) patch.buttonStyle = buttonStyle;

  if (html) {
    const description = extractBusinessDescriptionFromHtml(html);
    if (description) patch.businessDescription = description;
    Object.assign(patch, extractOpeningHoursFromHtml(html));
  }

  patch.websiteAnalysisAt = new Date().toISOString();
  patch.websiteAnalysisSourceUrl = brand.sourceUrl;
  patch.detectedWebsiteServices = detectedServices;

  return patch;
}

export function buildMergePreview(
  patch: Partial<PharmacyProfileData>,
  existing: PharmacyProfileData,
): MergeFieldPreview[] {
  const preview: MergeFieldPreview[] = [];
  for (const [field, importedVal] of Object.entries(patch)) {
    if (field === "websiteAnalysisAt" || field === "websiteAnalysisSourceUrl" || field === "detectedWebsiteServices") continue;
    if (importedVal == null) continue;

    const existingVal = (existing as Record<string, unknown>)[field];
    const importedStr = Array.isArray(importedVal)
      ? `${importedVal.length} item(s)`
      : typeof importedVal === "object"
        ? JSON.stringify(importedVal)
        : str(importedVal);
    const existingStr = Array.isArray(existingVal)
      ? `${existingVal.length} item(s)`
      : str(existingVal);

    if (!importedStr) continue;

    const action =
      isEmptyProfileValue(field, existingVal) || importedStr === existingStr ? "apply" : "skip";

    preview.push({
      field,
      label: MERGE_FIELD_LABELS[field] || field,
      imported: importedStr,
      existing: existingStr || "(empty)",
      action,
    });
  }
  return preview;
}

export function mergeWebsiteAnalysisIntoProfile(
  patch: Partial<PharmacyProfileData>,
  existing: PharmacyProfileData,
  overwrite = false,
): { merged: Partial<PharmacyProfileData>; applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];
  const merged: Partial<PharmacyProfileData> = {};

  for (const [field, value] of Object.entries(patch)) {
    if (value == null) continue;
    const existingVal = (existing as Record<string, unknown>)[field];
    const empty = isEmptyProfileValue(field, existingVal);
    const same = JSON.stringify(existingVal) === JSON.stringify(value);

    if (empty || overwrite || same) {
      (merged as Record<string, unknown>)[field] = value;
      if (!same) applied.push(field);
    } else {
      skipped.push(field);
    }
  }

  return { merged, applied, skipped };
}

export async function analyzeWebsiteForPharmacy(
  url: string,
  existing: PharmacyProfileData,
): Promise<WebsiteAnalysisResult> {
  const brand = await importBrandFromUrl(url);
  const html = await fetchHtmlSnippet(url);

  const socialLinks = extractSocialLinksFromHtml(html);
  const googleMapsUrl = extractGoogleMapsUrlFromHtml(html);
  const location = extractLocationFromHtml(html, brand.contact?.address || "");
  const detectedServices = detectPharmacyServicesFromHtml(html);
  const buttonStyle = detectButtonStyleFromBrand(brand);

  const profilePatch = buildProfilePatchFromAnalysis(brand, location, socialLinks, googleMapsUrl, buttonStyle, detectedServices, html);
  const mergePreview = buildMergePreview(profilePatch, existing);
  const phases = buildPhases(brand, location, socialLinks, detectedServices);

  const { merged } = mergeWebsiteAnalysisIntoProfile(profilePatch, existing, false);
  const projectedData = { ...existing, ...merged } as PharmacyProfileData;

  return {
    brand,
    phases,
    location,
    socialLinks,
    googleMapsUrl,
    buttonStyle,
    detectedServices,
    profilePatch,
    mergePreview,
    checklist: computeWebsiteAnalysisChecklist(projectedData, {
      brand,
      location,
      detectedServices,
      socialLinks,
    }),
    completeness: computeProfileCompleteness(existing),
    projectedCompleteness: computeProfileCompleteness(projectedData),
  };
}

/** Minimal HTML fetch for analysis extensions — same safe limits as brand importer. */
async function fetchHtmlSnippet(url: string): Promise<string> {
  try {
    const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PharmaConnectAnalysis/1.0)", Accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 1_500_000);
  } catch {
    return "";
  }
}
