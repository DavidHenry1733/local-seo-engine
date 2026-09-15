/**
 * Pharmacy Trust Layer V1 — profile-driven trust panel, credentials, authority and schema.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, renderSectionHeader } from "./pharmacyComponentLibrary.ts";
import { MAP_MODULE_MARKER } from "./pharmacyMapModule.ts";
import {
  normalizeProfileData,
  type PharmacyDisplayCredentials,
  type PharmacyProfileData,
} from "./pharmacyProfileSchema.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { isReviewerProfileComplete } from "./pharmacyRealEnhancementActionsService.ts";
import {
  buildProductionTrustSignals,
  productionContextFromProfile,
  resolveProductionGphcDisplay,
  resolveProductionGphcPremisesUrl,
  resolveProductionNhsProfileUrl,
  resolveProductionSuperintendentDisplay,
  schemaSafeGphcIdentifier,
  schemaSafeSuperintendentName,
  stripDemoSchemaExtensions,
  PRODUCTION_FALLBACKS,
} from "./pharmacyProfileProductionSafety.ts";
import { resolvePublicationPharmacyIdentity } from "./pharmacyServicePagePublicationQuality.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWorkspaceRoot(): string {
  const candidates = [
    process.env.WORKSPACE_ROOT,
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "data/pharmacy-profiles"))) return root;
  }
  return path.resolve(__dirname, "../..");
}

const ROOT = resolveWorkspaceRoot();
const PROFILE_DIR = path.join(ROOT, "data/pharmacy-profiles");

export interface PharmacyTrustProfile {
  pharmacyName: string;
  demoMode: boolean;
  trustDataStatus: string;
  gphcNumber: string;
  gphcPremisesUrl: string;
  nhsProfileUrl: string;
  superintendentPharmacistName: string;
  companyName: string;
  yearsServingCommunity: string;
  consultationRoomAvailable: boolean;
  homeDeliveryAvailable: boolean;
  privateServicesAvailable: boolean;
  nhsServicesAvailable: boolean;
  accreditations: string[];
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  postcode: string;
  coverageRadius: string;
  rankingAreas: string[];
}

export interface TrustCredentialCard {
  id: string;
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
}

export interface TrustProfileStrength {
  canRender: boolean;
  canEnhanceSchema: boolean;
  credentialCount: number;
  panelSignalCount: number;
}

export const TRUST_LAYER_MARKER = "pharmacy-trust-layer";
export const TRUST_PANEL_MARKER = "pharmacy-trust-panel";
export const TRUST_CREDENTIALS_MARKER = "pharmacy-trust-credentials";
export const TRUST_AUTHORITY_MARKER = "pharmacy-trust-authority";
export const TRUST_DEMO_MARKER = "pharmacy-trust-demo-notice";
export const SHARED_PHARMACY_CREDENTIALS_MARKER = "pharmacy-shared-credentials";
export const SERVICE_PAGE_MASTER_TEMPLATE_CREDENTIALS_SURFACE = "service-page-master-template-v1-preview";
export const PHARMACY_FIRST_LOCAL_PAGE_PREVIEW_CREDENTIALS_SURFACE = "pharmacy-first-local-page-preview";
export const DEMONSTRATION_CREDENTIALS_NOTICE =
  "Demonstration credentials — not a real pharmacy registration.";

export type ResolvedSharedPharmacyCredentials = {
  kind: "demonstration" | "verified";
  verificationStatus: "unverified" | "verified";
  verified: boolean;
  schemaEligible: boolean;
  superintendentPharmacistName: string;
  superintendentGphcNumber: string;
  premisesGphcNumber: string;
  sourceUrl: string;
};

export function resolveSharedPharmacyCredentials(input: {
  slug: string;
  credentials: PharmacyDisplayCredentials | null | undefined;
  surface: string;
}): ResolvedSharedPharmacyCredentials | null {
  const creds = input.credentials;
  if (!creds) return null;
  const slug = String(input.slug || "").trim().toLowerCase();
  const surface = String(input.surface || "").trim().toLowerCase();
  const demonstration = creds.kind === "demonstration" || creds.verificationStatus === "unverified";
  if (demonstration) {
    if (creds.kind !== "demonstration" || creds.verificationStatus !== "unverified") return null;
    if (!slug || slug !== creds.allowedTenantSlug) return null;
    if (!surface || !creds.allowedSurfaces.includes(surface)) return null;
    if (!creds.superintendentPharmacistName && !creds.superintendentGphcNumber && !creds.premisesGphcNumber) {
      return null;
    }
    return {
      kind: "demonstration",
      verificationStatus: "unverified",
      verified: false,
      schemaEligible: false,
      superintendentPharmacistName: creds.superintendentPharmacistName,
      superintendentGphcNumber: creds.superintendentGphcNumber,
      premisesGphcNumber: creds.premisesGphcNumber,
      sourceUrl: creds.sourceUrl,
    };
  }
  return null;
}

export function renderSharedPharmacyCredentialsHtml(
  resolved: ResolvedSharedPharmacyCredentials | null,
): string {
  if (!resolved || resolved.kind !== "demonstration" || resolved.verified || resolved.schemaEligible) {
    return "";
  }
  return `<div class="trust-grid" data-component="${SHARED_PHARMACY_CREDENTIALS_MARKER}" data-credential-kind="demonstration" data-verification-status="unverified" data-schema-eligible="false">
<div class="trust-item pharmacy-shared-credentials">
<p class="credentials-role">Superintendent Pharmacist</p>
<p class="credentials-value">${esc(resolved.superintendentPharmacistName)}</p>
<p class="credentials-value">Demo GPhC No. ${esc(resolved.superintendentGphcNumber)}</p>
<p class="credentials-role">Pharmacy premises</p>
<p class="credentials-value">Demo GPhC registration No. ${esc(resolved.premisesGphcNumber)}</p>
<p class="credentials-demo-note">${esc(DEMONSTRATION_CREDENTIALS_NOTICE)}</p>
</div>
</div>`;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function mentionsGphc(accreditations: string[]): boolean {
  return accreditations.some((a) => /gphc|general pharmaceutical council/i.test(a));
}

function mentionsNhs(accreditations: string[]): boolean {
  return accreditations.some((a) => /nhs/i.test(a));
}

export function trustProfileFromData(raw: Record<string, unknown> = {}): PharmacyTrustProfile {
  const data = normalizeProfileData(raw);
  return {
    pharmacyName: resolvePublicationPharmacyIdentity(data).pharmacyName || data.tradingName || "Your Pharmacy",
    demoMode: data.demoMode,
    trustDataStatus: data.trustDataStatus,
    gphcNumber: data.gphcNumber,
    gphcPremisesUrl: data.gphcPremisesUrl,
    nhsProfileUrl: data.nhsProfileUrl,
    superintendentPharmacistName: data.superintendentPharmacistName,
    companyName: data.companyName,
    yearsServingCommunity: data.yearsServingCommunity,
    consultationRoomAvailable: data.consultationRoomAvailable,
    homeDeliveryAvailable: data.homeDeliveryAvailable,
    privateServicesAvailable: data.privateServicesAvailable,
    nhsServicesAvailable: data.nhsServicesAvailable || mentionsNhs(data.accreditations),
    accreditations: data.accreditations,
    phone: data.phone,
    website: data.website,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    townCity: data.townCity,
    postcode: data.postcode,
    coverageRadius: data.coverageRadius,
    rankingAreas: data.rankingAreas || [],
  };
}

export function loadPharmacyTrustProfile(slug: string): PharmacyTrustProfile | null {
  const file = path.join(PROFILE_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, "utf8")) as {
    demoMode?: boolean;
    trustDataStatus?: string;
    data?: Record<string, unknown>;
  };
  return trustProfileFromData({
    ...(doc.data || {}),
    demoMode: doc.demoMode ?? doc.data?.demoMode,
    trustDataStatus: doc.trustDataStatus ?? doc.data?.trustDataStatus,
  });
}

function renderDemoTrustNotice(_profile: PharmacyTrustProfile): string {
  return "";
}

export function isGphcRegistered(profile: PharmacyTrustProfile): boolean {
  return Boolean(profile.gphcNumber) || mentionsGphc(profile.accreditations);
}

export function buildTrustCredentialCards(profile: PharmacyTrustProfile): TrustCredentialCard[] {
  const cards: TrustCredentialCard[] = [];
  const town = profile.townCity || "your area";
  const name = profile.pharmacyName;
  const data = profile as PharmacyTrustProfile & Partial<ReturnType<typeof normalizeProfileData>>;
  const ctx = productionContextFromProfile(data, profile);
  const gphc = resolveProductionGphcDisplay(data, ctx);
  const superintendent = resolveProductionSuperintendentDisplay(data, ctx);
  const nhs = resolveProductionNhsProfileUrl(data, ctx);
  const gphcUrl = resolveProductionGphcPremisesUrl(data, ctx);

  if (gphc.verified || isGphcRegistered(profile)) {
    cards.push({
      id: "gphc",
      title: `${name} — GPhC registered pharmacy`,
      body: gphc.verified
        ? `${name} is registered with the General Pharmaceutical Council (premises ${gphc.raw}), providing regulated pharmacist-led care in ${town}.`
        : `${name} is a General Pharmaceutical Council registered pharmacy providing regulated pharmacist-led care in ${town}. ${PRODUCTION_FALLBACKS.gphc}.`,
      link: gphcUrl || undefined,
      linkLabel: gphcUrl ? "View GPhC premises register" : undefined,
    });
  } else if (mentionsGphc(profile.accreditations)) {
    cards.push({
      id: "gphc-accreditation",
      title: `${name} — GPhC registered pharmacy`,
      body: `${name} operates as a General Pharmaceutical Council registered premises with pharmacist accountability and professional standards in ${town}.`,
      link: profile.gphcPremisesUrl || undefined,
      linkLabel: profile.gphcPremisesUrl ? "View GPhC premises register" : undefined,
    });
  }

  if (superintendent.verified || profile.superintendentPharmacistName) {
    cards.push({
      id: "superintendent",
      title: "Superintendent pharmacist",
      body: superintendent.verified
        ? `${superintendent.display} is the superintendent pharmacist responsible for professional standards at ${name}.`
        : `${PRODUCTION_FALLBACKS.superintendent} for ${name}.`,
    });
  }

  if (profile.yearsServingCommunity) {
    cards.push({
      id: "years",
      title: `${profile.yearsServingCommunity} serving ${town}`,
      body: `${name} has supported patients in ${town} and surrounding neighbourhoods for ${profile.yearsServingCommunity.toLowerCase()}, building trusted local pharmacy relationships.`,
    });
  }

  if (profile.rankingAreas.length) {
    const areas = profile.rankingAreas.slice(0, 4).join(", ");
    const more = profile.rankingAreas.length > 4 ? ` and nearby areas` : "";
    cards.push({
      id: "local-coverage",
      title: `Local service coverage`,
      body: `${name} serves patients across ${areas}${more}${profile.coverageRadius ? ` within ${profile.coverageRadius.toLowerCase()}` : ""} from ${town}.`,
    });
  }

  if (profile.phone) {
    cards.push({
      id: "contact",
      title: "Contact the pharmacy team",
      body: `Call ${name} on ${profile.phone} to book appointments, check NHS service availability or ask about private consultations in ${town}.`,
    });
  }

  if (nhs.verified && nhs.url) {
    cards.push({
      id: "nhs-profile",
      title: "NHS pharmacy profile",
      body: `${name} is listed on the NHS service finder so patients can verify NHS services, location and contact details for ${town}.`,
      link: nhs.url,
      linkLabel: "View NHS profile",
    });
  }

  if (profile.consultationRoomAvailable) {
    cards.push({
      id: "consultation-room",
      title: "Private consultation room",
      body: `${name} provides confidential pharmacist consultations in a dedicated private room — suitable for clinical services, medicines reviews and sensitive health discussions.`,
    });
  }

  if (profile.homeDeliveryAvailable) {
    cards.push({
      id: "delivery",
      title: "Home delivery",
      body: `${name} offers prescription and medicines delivery for eligible patients in ${town} who cannot easily collect in person — ask the team about local delivery routes.`,
    });
  }

  if (profile.nhsServicesAvailable) {
    cards.push({
      id: "nhs-services",
      title: "NHS pharmacy services",
      body: `${name} delivers NHS-commissioned pharmacy services in ${town} where locally eligible — including clinical pathways such as Pharmacy First, vaccinations and medicines support.`,
    });
  }

  if (profile.privateServicesAvailable) {
    cards.push({
      id: "private-services",
      title: "Private pharmacy services",
      body: `${name} also offers private pharmacy-led clinics and consultations in ${town} for patients seeking flexible appointment-based care alongside NHS services.`,
    });
  }

  const skipAccreditation = new Set(
    ["gphc registered pharmacy", "nhs services available", "private consultation room", "pharmacist-led advice"].map(
      (s) => s.toLowerCase(),
    ),
  );

  for (const accreditation of profile.accreditations) {
    const normalized = accreditation.trim();
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (skipAccreditation.has(lower)) continue;
    if (cards.some((c) => c.title.toLowerCase().includes(lower) || c.body.toLowerCase().includes(lower))) continue;

    if (/pharmacist-led|clinical advice|medicines counselling/i.test(normalized)) {
      cards.push({
        id: `accreditation-${cards.length}`,
        title: normalized,
        body: `${name}'s pharmacists provide clinical advice, medicines counselling and safety-netting for patients across ${town}.`,
      });
      continue;
    }

    cards.push({
      id: `accreditation-${cards.length}`,
      title: normalized,
      body: `${name} maintains ${normalized.toLowerCase()} as part of its professional pharmacy offer to patients in ${town}.`,
    });
  }

  return cards.filter((c) => c.title && c.body).slice(0, 8);
}

export function trustProfileStrength(profile: PharmacyTrustProfile | null): TrustProfileStrength {
  if (!profile) {
    return { canRender: false, canEnhanceSchema: false, credentialCount: 0, panelSignalCount: 0 };
  }

  const cards = buildTrustCredentialCards(profile);
  const panelSignals = [
    isGphcRegistered(profile),
    Boolean(profile.yearsServingCommunity),
    profile.consultationRoomAvailable,
    profile.nhsServicesAvailable,
    profile.privateServicesAvailable,
  ].filter(Boolean).length;

  const canEnhanceSchema =
    Boolean(profile.pharmacyName) &&
    (isGphcRegistered(profile) ||
      Boolean(profile.superintendentPharmacistName) ||
      Boolean(profile.companyName) ||
      cards.length >= 2);

  return {
    canRender: cards.length >= 2 && panelSignals >= 2,
    canEnhanceSchema,
    credentialCount: cards.length,
    panelSignalCount: panelSignals,
  };
}

function renderTrustPanel(profile: PharmacyTrustProfile): string {
  const items: Array<{ label: string; active: boolean }> = [
    { label: "GPhC Registered Pharmacy", active: isGphcRegistered(profile) },
    { label: "Years Serving Community", active: Boolean(profile.yearsServingCommunity) },
    { label: "Consultation Room Available", active: profile.consultationRoomAvailable },
    { label: "NHS Services Available", active: profile.nhsServicesAvailable },
    { label: "Private Services Available", active: profile.privateServicesAvailable },
  ].filter((item) => item.active);

  if (!items.length) return "";

  const badges = items
    .map(
      (item) =>
        `<div class="trust-panel-badge" data-trust-signal="${esc(item.label.toLowerCase().replace(/\s+/g, "-"))}">
  <span class="trust-panel-icon" aria-hidden="true">✓</span>
  <span>${esc(item.label)}</span>
</div>`,
    )
    .join("\n");

  return `<div class="trust-panel" data-component="${TRUST_PANEL_MARKER}">
  <div class="trust-panel-grid">${badges}</div>
</div>`;
}

function renderTrustCard(card: TrustCredentialCard): string {
  const linkHtml = card.link
    ? `<p class="trust-card-link"><a href="${esc(card.link)}" target="_blank" rel="noopener noreferrer">${esc(card.linkLabel || "Learn more")}</a></p>`
    : "";
  return `<div class="feature-card trust-credential-card" data-trust-card="${esc(card.id)}">
  <div class="feature-icon trust-card-icon" aria-hidden="true">◆</div>
  <h3>${esc(card.title)}</h3>
  <p>${esc(card.body)}</p>
  ${linkHtml}
</div>`;
}

function renderCredentialsSection(profile: PharmacyTrustProfile, cards: TrustCredentialCard[]): string {
  if (!cards.length) return "";

  const gridClass =
    cards.length <= 2
      ? "feature-grid feature-grid--2"
      : cards.length === 3
        ? "feature-grid feature-grid--3"
        : "feature-grid feature-grid--2";

  return `<section class="section-block trust-credentials-block" data-section-type="trustCredentials">
  <div class="wrap">
    ${renderSectionHeader("Patient trust", `Why Patients Choose ${profile.pharmacyName}`, "Regulated pharmacy care with transparent credentials and local accountability.")}
    <div class="${gridClass}" data-component="${TRUST_CREDENTIALS_MARKER}">
      ${cards.map(renderTrustCard).join("\n")}
    </div>
  </div>
</section>`;
}

function renderAuthoritySection(profile: PharmacyTrustProfile): string {
  const rows: string[] = [];
  const superintendent = resolveProductionSuperintendentDisplay(profile as PharmacyTrustProfile & Partial<ReturnType<typeof normalizeProfileData>>, productionContextFromProfile(profile, profile));

  if (profile.superintendentPharmacistName || superintendent.display) {
    rows.push(
      `<div class="trust-authority-item"><h3>Superintendent Pharmacist</h3><p data-trust-field="superintendent">${esc(superintendent.verified ? superintendent.display : PRODUCTION_FALLBACKS.superintendent)}</p></div>`,
    );
  }

  if (profile.companyName) {
    rows.push(
      `<div class="trust-authority-item"><h3>Company Name</h3><p data-trust-field="company">${esc(profile.companyName)}</p></div>`,
    );
  }

  if (profile.accreditations.length) {
    const list = profile.accreditations.map((a) => `<li>${esc(a)}</li>`).join("");
    rows.push(
      `<div class="trust-authority-item"><h3>Accreditations</h3><ul class="check-list" data-trust-field="accreditations">${list}</ul></div>`,
    );
  }

  if (!rows.length) return "";

  return `<section class="section-block trust-authority-block" data-section-type="trustAuthority">
  <div class="wrap">
    ${renderSectionHeader("Pharmacy authority", "Regulatory & Professional Accountability", "Clear leadership and accreditation signals for patient confidence.")}
    <div class="content-card trust-authority-card" data-component="${TRUST_AUTHORITY_MARKER}">
      <div class="trust-authority-grid">${rows.join("\n")}</div>
    </div>
  </div>
</section>`;
}

export function renderPharmacyTrustLayer(profile: PharmacyTrustProfile): string {
  const strength = trustProfileStrength(profile);
  if (!strength.canRender) return "";

  const cards = buildTrustCredentialCards(profile);
  const panel = renderTrustPanel(profile);
  const credentials = renderCredentialsSection(profile, cards);
  const authority = renderAuthoritySection(profile);

  if (!panel && !credentials && !authority) return "";

  return `<div data-component="${TRUST_LAYER_MARKER}">
${renderDemoTrustNotice(profile)}
${panel}
${credentials}
${authority}
</div>`;
}

export function renderPharmacyTrustLayerForSlug(slug: string): string {
  const profile = loadPharmacyTrustProfile(slug);
  if (!profile) return "";
  return renderPharmacyTrustLayer(profile);
}

export function injectTrustLayerAfterMap(blocks: string[], trustHtml: string): string[] {
  if (!trustHtml.trim()) return blocks;

  const mapIdx = blocks.findIndex((b) => b.includes(`data-component="${MAP_MODULE_MARKER}"`));
  if (mapIdx >= 0) {
    const out = [...blocks];
    out.splice(mapIdx + 1, 0, trustHtml);
    return out;
  }

  const faqIdx = blocks.findIndex((b) => b.includes('data-component="faq-accordion"'));
  if (faqIdx >= 0) {
    const out = [...blocks];
    out.splice(faqIdx, 0, trustHtml);
    return out;
  }

  return [...blocks, trustHtml];
}

function schemaNodes(schema: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(schema["@graph"])) {
    return (schema["@graph"] as Record<string, unknown>[]).map((n) => ({ ...n }));
  }
  if (schema["@type"]) return [{ ...schema }];
  return [];
}

function writeGraph(schema: Record<string, unknown>, nodes: Record<string, unknown>[]): Record<string, unknown> {
  if (Array.isArray(schema["@graph"]) || nodes.length > 1) {
    return { "@context": "https://schema.org", "@graph": nodes };
  }
  if (nodes.length === 1) {
    return { "@context": "https://schema.org", ...nodes[0] };
  }
  return { ...schema, "@context": schema["@context"] || "https://schema.org" };
}

function findPharmacyNode(nodes: Record<string, unknown>[]): Record<string, unknown> | null {
  for (const node of nodes) {
    const type = node["@type"];
    const types = Array.isArray(type) ? type.map(String) : [String(type || "")];
    if (types.some((t) => /Pharmacy|MedicalBusiness|LocalBusiness|MedicalClinic/i.test(t))) {
      return node;
    }
    const provider = node.provider as Record<string, unknown> | undefined;
    if (provider && String(provider["@type"] || "").includes("Pharmacy")) return provider;
  }
  return null;
}

export function enhanceTrustSchema(
  schema: Record<string, unknown> | undefined,
  profile: PharmacyTrustProfile,
  reviewerProfile?: Partial<PharmacyProfileData>,
): Record<string, unknown> {
  const base = schema && Object.keys(schema).length ? JSON.parse(JSON.stringify(schema)) : {};
  const nodes = schemaNodes(base);
  let pharmacyNode = findPharmacyNode(nodes);

  if (!pharmacyNode) {
    pharmacyNode = {
      "@type": ["Pharmacy", "MedicalBusiness", "LocalBusiness"],
      name: profile.pharmacyName,
    };
    nodes.push(pharmacyNode);
  } else {
    const existing = pharmacyNode["@type"];
    const merged = new Set<string>(["Pharmacy", "MedicalBusiness", "LocalBusiness"]);
    if (Array.isArray(existing)) existing.forEach((t) => merged.add(String(t)));
    else if (existing) merged.add(String(existing));
    pharmacyNode["@type"] = [...merged];
  }

  pharmacyNode.name = profile.pharmacyName || pharmacyNode.name;

  if (profile.addressLine1 || profile.townCity || profile.postcode) {
    pharmacyNode.address = {
      "@type": "PostalAddress",
      streetAddress: [profile.addressLine1, profile.addressLine2].filter(Boolean).join(", ") || undefined,
      addressLocality: profile.townCity || undefined,
      postalCode: profile.postcode || undefined,
      addressCountry: "GB",
    };
  }

  if (profile.phone) pharmacyNode.telephone = profile.phone;
  if (profile.website) pharmacyNode.url = profile.website;

  const ctx = productionContextFromProfile(profile, profile);
  const gphcId = schemaSafeGphcIdentifier(profile, ctx);
  const superintendentName = schemaSafeSuperintendentName(profile, ctx);
  const gphcUrl = resolveProductionGphcPremisesUrl(profile, ctx);
  const nhs = resolveProductionNhsProfileUrl(profile, ctx);

  if (gphcId) {
    pharmacyNode.identifier = {
      "@type": "PropertyValue",
      propertyID: "GPhC",
      name: "General Pharmaceutical Council Registration",
      value: gphcId,
    };
    pharmacyNode.hasCredential = {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Professional Registration",
      recognizedBy: {
        "@type": "Organization",
        name: "General Pharmaceutical Council",
      },
      identifier: gphcId,
    };
  }

  if (profile.yearsServingCommunity) {
    pharmacyNode.description = `${profile.pharmacyName} — community pharmacy serving patients for ${profile.yearsServingCommunity}.`;
  }

  if (superintendentName) {
    pharmacyNode.employee = {
      "@type": "Person",
      name: superintendentName,
      jobTitle: "Superintendent Pharmacist",
    };
  }

  if (profile.companyName) {
    pharmacyNode.parentOrganization = {
      "@type": "Organization",
      name: profile.companyName,
    };
  }

  const amenities: string[] = [];
  if (profile.consultationRoomAvailable) amenities.push("Private consultation room");
  if (profile.homeDeliveryAvailable) amenities.push("Home delivery");
  if (profile.nhsServicesAvailable) amenities.push("NHS pharmacy services");
  if (profile.privateServicesAvailable) amenities.push("Private pharmacy services");
  if (amenities.length) pharmacyNode.amenityFeature = amenities;

  if (profile.accreditations.length) {
    pharmacyNode.award = profile.accreditations;
  }

  if (reviewerProfile && isReviewerProfileComplete(reviewerProfile as PharmacyProfileData)) {
    const reviewerName = String(reviewerProfile.reviewerName ?? "").trim();
    const reviewerRole = String(reviewerProfile.reviewerRole ?? "Superintendent Pharmacist").trim();
    pharmacyNode.reviewedBy = {
      "@type": "Person",
      name: reviewerName,
      jobTitle: reviewerRole,
    };
    if (reviewerProfile.clinicalReviewDate) {
      pharmacyNode.lastReviewed = reviewerProfile.clinicalReviewDate;
    }
    const hasReviewerNode = nodes.some(
      (n) => String(n["@type"]) === "Person" && String(n.name ?? "") === reviewerName,
    );
    if (!hasReviewerNode) {
      nodes.push({
        "@type": "Person",
        "@id": "#clinical-reviewer",
        name: reviewerName,
        jobTitle: reviewerRole,
        ...(reviewerProfile.reviewerQualifications
          ? { honorificSuffix: reviewerProfile.reviewerQualifications }
          : {}),
        ...(reviewerProfile.reviewerBio ? { description: reviewerProfile.reviewerBio } : {}),
      });
    }
  }

  const sameAs = [gphcUrl, nhs.url].filter(Boolean) as string[];
  if (sameAs.length) pharmacyNode.sameAs = sameAs;

  const enhanced = stripDemoSchemaExtensions(writeGraph(base, nodes));
  enhanced["@context"] = "https://schema.org";
  enhanced["x-pharmacy-trust-layer"] = "v1";
  return enhanced;
}

export function enhanceTrustSchemaForSlug(
  slug: string,
  schema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const profile = loadPharmacyTrustProfile(slug);
  if (!profile || !trustProfileStrength(profile).canEnhanceSchema) {
    return schema || {};
  }
  const doc = loadPharmacyProfile(slug);
  const reviewerProfile = normalizeProfileData((doc?.data || {}) as Partial<PharmacyProfileData>);
  return enhanceTrustSchema(schema, profile, reviewerProfile);
}

export function pharmacyTrustLayerStyles(): string {
  return `<style>
.trust-panel {
  background: linear-gradient(135deg, #f0f9ff 0%, #ecfdf5 100%);
  border: 1px solid #bae6fd;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 18px;
}
.trust-panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.trust-panel-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: .88rem;
  font-weight: 700;
  color: #0f172a;
}
.trust-panel-icon {
  color: #15803d;
  font-weight: 900;
}
.trust-credential-card { min-height: 100%; }
.trust-card-icon { color: var(--nhs-blue); }
.trust-card-link { margin: 10px 0 0; font-size: .88rem; }
.trust-card-link a { color: var(--nhs-blue); font-weight: 700; text-decoration: none; }
.trust-card-link a:hover { text-decoration: underline; }
.trust-authority-card { padding: 24px; }
.trust-authority-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 18px;
}
.trust-authority-item h3 {
  margin: 0 0 8px;
  font-size: .95rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.trust-authority-item p {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--nhs-dark);
}
.trust-demo-notice {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 18px;
  color: #92400e;
  font-size: .92rem;
  line-height: 1.55;
}
.trust-demo-notice strong { color: #78350f; }
</style>`;
}

export function trustLayerQualityInputs(slug: string): {
  usesTrustLayer: boolean;
  trustCredentialCount: number;
  hasEnhancedTrustSchema: boolean;
} {
  const profile = loadPharmacyTrustProfile(slug);
  const strength = trustProfileStrength(profile);
  return {
    usesTrustLayer: strength.canRender,
    trustCredentialCount: strength.credentialCount,
    hasEnhancedTrustSchema: strength.canEnhanceSchema,
  };
}
