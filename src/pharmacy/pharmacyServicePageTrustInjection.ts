/**
 * Profile-driven local trust injection for visual service pages.
 * Business Profile Intelligence V2 Phase 3B: optional contentContext for profile-first copy.
 */
import * as cheerio from "cheerio";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { ParsedMasterSection } from "./pharmacyVisualExperienceLayoutV2.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { resolveOpeningHours } from "./pharmacyServicePageProfileContext.ts";
import { renderPharmacyLocalAccessMap } from "./pharmacyLocalAccessMap.ts";
import {
  enrichTrustCards,
  isPharmacyFirstService,
  isTravelVaccinationsService,
  preferredServicePageCta,
  servicePageFinalCtaBody,
  servicePageHeroEyebrow,
  servicePageHeroIntro,
  servicePageLocalExtras,
  appendExtrasToParagraph,
  resolveContactCtaHref,
} from "./pharmacyServicePageIntelligence.ts";
import { renderHeroContactTreatment } from "./pharmacyComponentDnaContactRenderer.ts";
import { resolveComponentDnaForRender } from "./pharmacyComponentDnaResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import {
  buildHealthcareContextItems,
  buildSafetyStatement,
  stripUnsupportedLocalCopy,
} from "./pharmacyLocalAccessComponentRenderer.ts";
import { stripUnconfirmedConsultationRoomClaims } from "./pharmacyTrustCopyGuards.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";

export interface LocalAreaLink {
  areaName: string;
  href: string;
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/i;
const NON_LOCALITY_ADDRESS_TOKEN =
  /^(uk|united kingdom|england|south yorkshire|west yorkshire|north yorkshire|east yorkshire|yorkshire)$/i;
const STREET_TOKEN_RE = /\b(rd|road|lane|street|st|avenue|ave|close|drive|dr|hill|way|terrace|row|court|place|crescent|walk)$/i;

function formatUkPostcode(value: string): string {
  const compact = String(value || "").replace(/\s+/g, "").toUpperCase();
  const match = compact.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})$/);
  return match ? `${match[1]} ${match[2]}` : String(value || "").trim();
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Named places inside a display address. Never used as the main-page market locality. */
function namedPlacesFromDisplayAddress(address: string): string[] {
  const places: string[] = [];
  for (const raw of String(address || "").split(",")) {
    const token = raw.replace(UK_POSTCODE_RE, "").replace(/\bUK\b/gi, "").trim();
    if (!token || NON_LOCALITY_ADDRESS_TOKEN.test(token)) continue;
    const words = token.split(/\s+/);
    const last = words[words.length - 1] || "";
    if (STREET_TOKEN_RE.test(last) || /^\d/.test(token)) continue;
    if (!places.some((place) => place.toLowerCase() === token.toLowerCase())) places.push(token);
  }
  return places;
}

/**
 * Main service-page market locality from the business profile primary town.
 * Never uses selectedAreas, campaign targets, or a premises-address token.
 */
export function resolveMainServiceMarketLocality(profile: PharmacyServicePageProfile): string {
  const data = (loadPharmacyProfile(profile.slug)?.data || {}) as {
    primaryTown?: string;
    townCity?: string;
  };
  return firstNonEmpty(data.primaryTown, data.townCity, profile.town);
}

export function resolveAuthoritativePremisesAddress(profile: PharmacyServicePageProfile): string {
  const display = String(profile.displayAddress || "").trim();
  if (display) return display.replace(UK_POSTCODE_RE, (_, a: string, b: string) => `${a.toUpperCase()} ${b.toUpperCase()}`);
  const market = resolveMainServiceMarketLocality(profile);
  const parts = [profile.addressLine1, profile.addressLine2, market, formatUkPostcode(profile.postcode)].filter(Boolean);
  return parts.join(", ");
}

/** Keep market locality and physical premises address as separate fields. */
export function applyPremisesIdentityForServicePageRender(
  profile: PharmacyServicePageProfile,
  _sourceHtml = "",
): PharmacyServicePageProfile {
  const address = resolveAuthoritativePremisesAddress(profile);
  const marketLocality = resolveMainServiceMarketLocality(profile);
  return {
    ...profile,
    town: marketLocality || profile.town,
    customerFacingAddress: address || profile.customerFacingAddress,
    fullAddress: address || profile.fullAddress,
    postcode: formatUkPostcode(profile.postcode) || profile.postcode,
  };
}

/**
 * When a premises village appears in market-positioning copy, rewrite it to the
 * main-service market locality. The complete physical address is left intact.
 */
export function rewritePremisesLocalityUsedAsMarketCopy(
  text: string,
  profile: PharmacyServicePageProfile,
): string {
  const market = resolveMainServiceMarketLocality(profile);
  const address = resolveAuthoritativePremisesAddress(profile);
  if (!market || !text) return text;
  const tokens = namedPlacesFromDisplayAddress(address).filter(
    (place) => place.toLowerCase() !== market.toLowerCase(),
  );
  if (!tokens.length) return text;
  const blocks: string[] = [];
  let out = text;
  if (address) {
    out = out.split(address).join(`\u0000PCADDR${blocks.length}\u0000`);
    blocks.push(address);
  }
  for (const token of tokens) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, "gi"), market);
  }
  for (let i = 0; i < blocks.length; i += 1) {
    out = out.split(`\u0000PCADDR${i}\u0000`).join(blocks[i]);
  }
  return out;
}

function readServiceFundingModel(slug: string | undefined, serviceId: string | undefined): string {
  if (!slug || !serviceId) return "unknown";
  try {
    const data = (loadPharmacyProfile(slug)?.data || {}) as {
      serviceDeliveryProfiles?: Record<string, { fundingModel?: string }>;
    };
    return String(data.serviceDeliveryProfiles?.[serviceId]?.fundingModel || "unknown").toLowerCase();
  } catch {
    return "unknown";
  }
}

function readServiceAppointmentRequired(
  slug: string | undefined,
  serviceId: string | undefined,
): boolean | null {
  if (!slug || !serviceId) return null;
  try {
    const data = (loadPharmacyProfile(slug)?.data || {}) as {
      serviceDeliveryProfiles?: Record<string, { appointmentRequired?: boolean | null }>;
    };
    const value = data.serviceDeliveryProfiles?.[serviceId]?.appointmentRequired;
    if (value === true) return true;
    if (value === false) return false;
    return null;
  } catch {
    return null;
  }
}

/** Same component ID as approved homepage / service local coverage cards. */
export const HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID = "homepage-areas-we-support";

/** Approved homepage location / map / access block (split-map-details). */
export const HOMEPAGE_LOCATION_COMPONENT_ID = "homepage-location-map-access";

export function renderHomepageCoverageTagsHtml(
  town: string,
  localAreaLinks: LocalAreaLink[],
): string {
  const coverageLabel = town ? `Areas served around ${town}` : "Areas served";
  if (!localAreaLinks.length) return "";
  return `<div><strong>${esc(coverageLabel)}</strong><div class="coverage-tags" role="list">${localAreaLinks
    .map((item) =>
      item.href
        ? `<a class="coverage-tag" role="listitem" href="${esc(item.href)}">${esc(item.areaName)}</a>`
        : `<span class="coverage-tag" role="listitem">${esc(item.areaName)}</span>`,
    )
    .join("\n")}</div></div>`;
}

export function renderHomepageAreasWeSupportSection(
  serviceName: string,
  localAreaLinks: LocalAreaLink[],
  options: { heading?: string; intro?: string; town?: string } = {},
): string {
  const heading = options.heading || "Areas We Support";
  const intro =
    options.intro ||
    `Local ${serviceName.toLowerCase()} pages for neighbourhoods served by the same pharmacy team.`;
  const town = options.town || "";
  return `<section class="nearby-areas-section soft" id="areas-we-support" data-template-block="areas-we-support" data-component-id="${HOMEPAGE_AREAS_WE_SUPPORT_COMPONENT_ID}">
<div class="wrap">
${renderSectionHead(heading, intro, true)}
${renderHomepageCoverageTagsHtml(town, localAreaLinks)}
</div>
</section>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSectionHead(title: string, intro = "", center = true): string {
  const cls = center ? "section-head center" : "section-head";
  return `<div class="${cls}">${title ? `<h2>${esc(title)}</h2>` : ""}${intro ? `<p>${esc(intro)}</p>` : ""}</div>`;
}

function resolvePrimaryCtaHref(
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
  label?: string,
): string {
  const ctaLabel = label || preferredServicePageCta(contentContext, profile);
  return resolveContactCtaHref(profile, ctaLabel);
}

export function buildProfileHeroHtml(
  serviceName: string,
  profile: PharmacyServicePageProfile,
  heroImageHtml: string,
  contentContext?: ContentGenerationContext,
): string {
  const name = profile.pharmacyName;
  const ctaLabel =
    profile.headerCtaText && !/call pharmacy/i.test(profile.headerCtaText)
      ? profile.headerCtaText
      : preferredServicePageCta(contentContext, profile);
  const ctaHref = resolvePrimaryCtaHref(profile, contentContext, ctaLabel);
  const intro = servicePageHeroIntro(contentContext, profile, serviceName);
  const eyebrow = servicePageHeroEyebrow(contentContext, profile, serviceName);
  const brand = resolveBrandDnaForRender(profile.slug);
  const componentDna = resolveComponentDnaForRender(profile.slug, brand);
  const contactHtml = renderHeroContactTreatment(profile, componentDna.contact);

  return `<section class="hero" id="hero-section" data-template-block="hero">
<div class="wrap hero-grid">
<div>
<div class="eyebrow">${esc(eyebrow)}</div>
<h1>${esc(serviceName)} at ${esc(name)}</h1>
<p>${esc(intro)}</p>
<div class="btns">
<a class="btn" href="${esc(ctaHref.startsWith("tel:") || ctaHref.startsWith("http") ? ctaHref : "#contact")}">${esc(ctaLabel)}</a>
<a class="btn secondary" href="${esc(
    profile.fullAddress || profile.addressLine1
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          [profile.addressLine1, profile.town, profile.postcode].filter(Boolean).join(", "),
        )}`
      : "#local-access",
  )}">Get directions</a>
</div>
${/contact the pharmacy|call\b/i.test(ctaLabel) ? "" : contactHtml}
</div>
${heroImageHtml}
</div>
</section>`;
}

export interface ProfileTrustCard {
  title: string;
  body: string;
}

export function buildProfileTrustCards(
  profile: PharmacyServicePageProfile,
  options?: { skipGenericFillers?: boolean; serviceId?: string; serviceName?: string },
): ProfileTrustCard[] {
  const name = profile.pharmacyName;
  const town = profile.town;
  const serviceId = options?.serviceId;
  const serviceName = options?.serviceName || "";
  const cards: ProfileTrustCard[] = [];

  if (profile.gphcNumber?.trim()) {
    cards.push({
      title: "GPhC Registered Pharmacy",
      body: `${name} is a GPhC registered pharmacy premises (${profile.gphcNumber}).`,
    });
  }

  if (profile.nhsServicesAvailable && !isTravelVaccinationsService(serviceId, serviceName)) {
    // Only claim NHS pharmacy services when this service's funding evidence confirms NHS/mixed.
    const funding = readServiceFundingModel(profile.slug, serviceId);
    if (funding === "nhs" || funding === "mixed") {
      cards.push({
        title: "NHS Pharmacy Services",
        body: `${name} provides NHS pharmacy services for eligible patients in ${town || "the local area"}.`,
      });
    }
  }

  if (profile.consultationRoomAvailable) {
    cards.push({
      title: "Private Consultation Room",
      body: `Speak privately with the ${name} pharmacist team in a dedicated consultation room.`,
    });
  }

  cards.push({
    title: town ? `Local ${town} Pharmacy` : "Local Community Pharmacy",
    body: town
      ? `${name} supports patients in ${town}${profile.coverageRadius ? ` and surrounding areas (${profile.coverageRadius})` : " and nearby communities"}.`
      : `${name} is your local community pharmacy team.`,
  });

  if (options?.skipGenericFillers) {
    return cards.slice(0, 4);
  }

  const fillerCards: ProfileTrustCard[] = isPharmacyFirstService(serviceId, serviceName)
    ? [
        {
          title: "Pharmacy First pathways",
          body: `${name} uses NHS clinical pathways for sore throat, earache, impetigo, infected insect bites, shingles, sinusitis, and uncomplicated UTI where eligible.`,
        },
        {
          title: "Pharmacist-led assessment",
          body: `Trained pharmacists at ${name} assess symptoms, apply PGDs where appropriate, and signpost to GP or urgent care when needed.`,
        },
        {
          title: "NHS-funded service",
          body: `${name} provides NHS Pharmacy First at no charge for eligible patients where commissioning criteria are met.`,
        },
      ]
    : isTravelVaccinationsService(serviceId, serviceName)
      ? [
          {
            title: "Destination-based advice",
            body: `${name} discusses travel vaccinations based on destination, trip length, season and planned activities.`,
          },
          {
            title: "Pharmacist-led travel consultation",
            body: `Trained pharmacists at ${name} review medical and vaccination history before recommending travel-health options.`,
          },
          {
            title: "Vaccination planning support",
            body: `${name} explains what can be offered locally, including documentation and follow-up dose advice where needed.`,
          },
        ]
      : [
          {
            title: "Pharmacist-led assessment",
            body: `Trained pharmacists at ${name} provide assessment, advice and clear next steps for ${serviceName || "this service"}.`,
          },
        ];

  for (const filler of fillerCards) {
    if (cards.length >= 4) break;
    if (!cards.some((c) => c.title === filler.title)) cards.push(filler);
  }

  return cards.slice(0, 4);
}

export function renderProfileTrustCardsHtml(
  profile: PharmacyServicePageProfile,
  renderGrid: (cards: ProfileTrustCard[]) => string,
  contentContext?: ContentGenerationContext,
  options?: { skipGenericFillers?: boolean },
): string {
  const cards = enrichTrustCards(
    contentContext,
    profile,
    buildProfileTrustCards(profile, {
      skipGenericFillers: options?.skipGenericFillers,
      serviceId: contentContext?.serviceId,
      serviceName: contentContext?.serviceName,
    }),
  );
  return `<section id="pharmacy-trust-cards" data-template-block="trust-cards">
<div class="wrap">
${renderGrid(cards)}
</div>
</section>`;
}

function extractOpeningHoursFromSection(section: ParsedMasterSection | undefined): string {
  if (!section) return "";
  const match = section.proseHtml.match(/Monday[^<]+/i);
  return match?.[0]?.trim() || "";
}

function rebindLocalIntroText(text: string, profile: PharmacyServicePageProfile): string {
  let out = text;
  const displayPhone = profile.displayPhone || profile.phone;
  if (profile.phone) {
    out = out.replace(/\+44\d+/g, displayPhone).replace(profile.phone, displayPhone);
  }
  if (profile.fullAddress) {
    out = out.replace(
      new RegExp(`${profile.fullAddress.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},\\s*${profile.postcode.replace(/\s+/g, "")}`, "i"),
      profile.fullAddress,
    );
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

export function renderProfileLocalAccessSectionHtml(
  serviceName: string,
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
  options: {
    title?: string;
    town?: string;
    includeCoverageTags?: boolean;
    localAreaLinks?: LocalAreaLink[];
    section13?: ParsedMasterSection;
    intro?: string;
  } = {},
): string {
  const town = options.town || profile.town;
  const name = profile.pharmacyName;
  const title = options.title || `Visit ${name}`;
  const displayPhone = profile.displayPhone || profile.phone;
  const tel = profile.phone.replace(/\s/g, "");
  const hours = resolveOpeningHours(profile, extractOpeningHoursFromSection(options.section13));
  const ctaLabel = preferredServicePageCta(contentContext, profile);
  const ctaHref = resolvePrimaryCtaHref(profile, contentContext, ctaLabel);
  const includeCoverage = options.includeCoverageTags !== false;
  const coverageLabel = town ? `Areas served around ${town}` : "Areas served";
  const coverageItems =
    options.localAreaLinks && options.localAreaLinks.length > 0
      ? options.localAreaLinks
      : profile.coverageAreas.slice(0, 10).map((areaName) => ({ areaName, href: "" }));
  const coverageHtml =
    includeCoverage && coverageItems.length > 0
      ? renderHomepageCoverageTagsHtml(town || profile.town || "", coverageItems)
      : "";

  const nhsPrefix = isPharmacyFirstService(contentContext?.serviceId, serviceName) ? "NHS " : "";
  const premisesAddress = resolveAuthoritativePremisesAddress(profile);
  const fallbackIntro = `${name} is located at ${premisesAddress || profile.customerFacingAddress || profile.fullAddress || [profile.addressLine1, profile.postcode].filter(Boolean).join(", ")}. Patients in ${town || "the local area"} can access ${nhsPrefix}${serviceName} at the pharmacy${profile.phone ? ` by calling ${displayPhone}` : ""}.`;
  const introSource = options.intro === undefined ? fallbackIntro : String(options.intro).trim();
  const introShort = stripUnsupportedLocalCopy(
    stripUnconfirmedConsultationRoomClaims(introSource, profile),
    profile,
  );

  const bookingLine = profile.consultationRoomAvailable
    ? "A private consultation room may be available — call to confirm."
    : "Call the pharmacy to ask how this service is arranged.";
  const healthcareItems = buildHealthcareContextItems(profile, contentContext, town);
  const healthcareBlock = healthcareItems.length
    ? `<div class="local-healthcare-context card">
<h3>Local healthcare context</h3>
<ul class="clean local-healthcare-list">${healthcareItems.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
</div>`
    : "";
  const safetyBlock = `<div class="local-safety-note"><p>${esc(buildSafetyStatement(profile, serviceName, contentContext?.serviceId))}</p></div>`;
  const mapHtml = renderPharmacyLocalAccessMap(profile, profile.slug);
  const directionsQuery = encodeURIComponent(
    premisesAddress || profile.fullAddress || `${name}, ${town}, ${profile.postcode}, UK`,
  );
  const directionsUrl =
    premisesAddress || profile.fullAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${directionsQuery}`
      : "";

  return `<section class="local" id="local-access" data-template-block="local" data-component-variant="split-map-details" data-component-id="${HOMEPAGE_LOCATION_COMPONENT_ID}">
<div class="wrap">
<div class="section-head center"><h2>${esc(title)}</h2>${introShort ? `<p class="local-intro-lead">${esc(introShort)}</p>` : ""}</div>
<div class="local-structured-blocks">
${healthcareBlock}
${safetyBlock}
</div>
<div class="pharmacy-local-grid">
<div class="pharmacy-local-details local-access-details">
<h3>${esc(name)}</h3>
<ul class="clean local-access-details-list">
<li><strong>Address:</strong> ${esc(premisesAddress || profile.customerFacingAddress || profile.fullAddress || [profile.addressLine1, profile.addressLine2, profile.postcode].filter(Boolean).join(", "))}</li>
${profile.phone ? `<li><strong>Phone:</strong> ${esc(displayPhone)}</li>` : ""}
${hours ? `<li><strong>Opening hours:</strong> ${esc(hours)}</li>` : ""}
<li>${esc(stripUnsupportedLocalCopy(bookingLine, profile))}</li>
</ul>
${coverageHtml}
<div class="local-access-cta">${directionsUrl ? `<a class="btn secondary" href="${esc(directionsUrl)}" target="_blank" rel="noopener noreferrer">Get directions</a> ` : ""}<a class="btn" href="${esc(ctaHref)}">${esc(ctaLabel)}</a></div>
</div>
${mapHtml || `<div class="map-placeholder map-unavailable" role="img" aria-label="Map unavailable for ${esc(name)}"><div><strong>Map unavailable</strong><span>${esc(profile.customerFacingAddress || profile.fullAddress || town)}</span></div></div>`}
</div>
</div>
</section>`;
}

export function buildProfileLocalSectionHtml(
  serviceName: string,
  _$: cheerio.CheerioAPI,
  section13: ParsedMasterSection | undefined,
  profile: PharmacyServicePageProfile,
  localAreaLinks: LocalAreaLink[] = [],
  contentContext?: ContentGenerationContext,
): string {
  const marketLocality = resolveMainServiceMarketLocality(profile);
  return renderProfileLocalAccessSectionHtml(serviceName, profile, contentContext, {
    title: `Visit ${profile.pharmacyName}`,
    town: marketLocality,
    includeCoverageTags: true,
    localAreaLinks,
    section13,
  });
}

export function buildProfileFinalCtaHtml(
  serviceName: string,
  profile: PharmacyServicePageProfile,
  conversionImageHtml: string,
  _masterHeading = "",
  _masterBody = "",
  contentContext?: ContentGenerationContext,
): string {
  const name = profile.pharmacyName;
  const tel = profile.phone.replace(/\s/g, "");
  const serviceLower = serviceName.toLowerCase();
  const appointmentRequired = readServiceAppointmentRequired(profile.slug, contentContext?.serviceId);
  const heading =
    appointmentRequired === true
      ? serviceLower.includes("pharmacy first")
        ? `Book Pharmacy First at ${name}`
        : `Book ${serviceName} at ${name}`
      : `${serviceName} at ${name}`;
  const displayPhone = profile.displayPhone || profile.phone;
  const body =
    appointmentRequired === true
      ? servicePageFinalCtaBody(contentContext, profile, serviceName)
      : profile.phone
        ? `Call ${displayPhone} to ask how ${serviceName.toLowerCase()} are arranged.`
        : `Contact the pharmacy to ask how ${serviceName.toLowerCase()} are arranged.`;
  const ctaLabel =
    appointmentRequired === true
      ? preferredServicePageCta(contentContext, profile)
      : "Contact the pharmacy";
  const ctaHref = resolvePrimaryCtaHref(profile, contentContext, ctaLabel);
  const contactCtaHtml = ctaHref
    ? `<a class="btn-white" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>`
    : "";
  const secondaryActionHtml = `<a class="btn-white-outline" href="#faq-section">View FAQs</a>`;

  return `<section class="section-band conversion-image-section" data-template-block="conversion-image">
<div class="wrap">${conversionImageHtml}</div>
</section>
<section id="contact" class="cta-band" data-template-block="final-cta">
<div class="wrap">
<h2>${esc(heading)}</h2>
<p class="cta-close">${esc(body)}</p>
<div class="cta-actions">
${contactCtaHtml}
${secondaryActionHtml}
</div>
</div>
</section>`;
}
