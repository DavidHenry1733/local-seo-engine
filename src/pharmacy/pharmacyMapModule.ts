/**
 * Pharmacy Local Map Module V1 — profile-driven map card for service, hub and area pages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, renderSectionHeader } from "./pharmacyComponentLibrary.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";

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

export interface PharmacyMapProfile {
  pharmacyName: string;
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
  phone: string;
  googleBusinessProfileUrl: string;
  googlePlaceId: string;
  latitude: number | null;
  longitude: number | null;
}

export const MAP_MODULE_MARKER = "pharmacy-map-module";
export const MAP_SECTION_TYPE = "pharmacyMap";

const LOCAL_ANCHOR_PRIORITY = [
  "localContext",
  "localNarrative",
  "localServiceIntro",
  "localRelevance",
  "nearbyAreas",
  "localExpansion",
  "whyThisArea",
] as const;

function parseCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

export function mapProfileFromData(raw: Record<string, unknown> = {}): PharmacyMapProfile {
  const data = normalizeProfileData(raw);
  return {
    pharmacyName: data.pharmacyName || data.tradingName || "Your Pharmacy",
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    townCity: data.townCity,
    county: data.county,
    postcode: data.postcode,
    phone: data.phone,
    googleBusinessProfileUrl: data.googleBusinessProfileUrl,
    googlePlaceId: data.googlePlaceId,
    latitude: parseCoord(data.latitude),
    longitude: parseCoord(data.longitude),
  };
}

export function loadPharmacyMapProfile(slug: string): PharmacyMapProfile | null {
  const file = path.join(PROFILE_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: Record<string, unknown> };
  return mapProfileFromData(doc.data || {});
}

export function formatPharmacyAddress(profile: PharmacyMapProfile): string {
  return [
    profile.addressLine1,
    profile.addressLine2,
    profile.townCity,
    profile.county,
    profile.postcode,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function hasPharmacyAddress(profile: PharmacyMapProfile): boolean {
  return Boolean(profile.addressLine1 && profile.townCity && profile.postcode);
}

export function hasMapCoordinates(profile: PharmacyMapProfile): boolean {
  return profile.latitude != null && profile.longitude != null;
}

export function canRenderPharmacyMapModule(profile: PharmacyMapProfile | null): profile is PharmacyMapProfile {
  if (!profile) return false;
  return (
    hasPharmacyAddress(profile) ||
    hasMapCoordinates(profile) ||
    Boolean(profile.googleBusinessProfileUrl.trim())
  );
}

export function buildGoogleMapsOpenUrl(profile: PharmacyMapProfile): string {
  if (profile.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(profile.googlePlaceId)}`;
  }
  if (hasMapCoordinates(profile)) {
    return `https://www.google.com/maps/search/?api=1&query=${profile.latitude},${profile.longitude}`;
  }
  const address = formatPharmacyAddress(profile);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildGoogleMapsDirectionsUrl(profile: PharmacyMapProfile): string {
  const gbp = profile.googleBusinessProfileUrl.trim();
  if (gbp) return gbp;
  if (profile.googlePlaceId) {
    return `https://www.google.com/maps/dir/?api=1&destination_place_id=${encodeURIComponent(profile.googlePlaceId)}`;
  }
  if (hasMapCoordinates(profile)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${profile.latitude},${profile.longitude}`;
  }
  const address = formatPharmacyAddress(profile);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function buildGoogleMapsEmbedUrl(profile: PharmacyMapProfile): string | null {
  if (profile.googlePlaceId) {
    return `https://maps.google.com/maps?q=place_id:${encodeURIComponent(profile.googlePlaceId)}&z=15&output=embed`;
  }
  if (!hasMapCoordinates(profile)) return null;
  const { latitude, longitude } = profile;
  return `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
}

function renderMapEmbed(profile: PharmacyMapProfile): string {
  const embedUrl = buildGoogleMapsEmbedUrl(profile);
  if (embedUrl) {
    return `<div class="pharmacy-map-embed">
  <iframe
    title="${esc(`${profile.pharmacyName} location map`)}"
    src="${esc(embedUrl)}"
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
    allowfullscreen
  ></iframe>
</div>`;
  }

  const address = formatPharmacyAddress(profile);
  const gbp = profile.googleBusinessProfileUrl.trim();
  const openUrl = buildGoogleMapsOpenUrl(profile);

  return `<div class="pharmacy-map-fallback content-card">
  <p class="pharmacy-map-fallback-address">${esc(address || "Pharmacy address on file")}</p>
  ${
    gbp
      ? `<p><a class="btn-secondary" href="${esc(gbp)}" target="_blank" rel="noopener noreferrer">View on Google Business Profile</a></p>`
      : `<p><a class="btn-secondary" href="${esc(openUrl)}" target="_blank" rel="noopener noreferrer">Open In Google Maps</a></p>`
  }
</div>`;
}

export function renderPharmacyMapModule(profile: PharmacyMapProfile): string {
  if (!canRenderPharmacyMapModule(profile)) return "";

  const address = formatPharmacyAddress(profile);
  const directionsUrl = buildGoogleMapsDirectionsUrl(profile);
  const openMapsUrl = buildGoogleMapsOpenUrl(profile);
  const phoneHtml = profile.phone
    ? `<p class="pharmacy-map-phone"><a href="tel:${esc(profile.phone.replace(/\s/g, ""))}">${esc(profile.phone)}</a></p>`
    : "";

  return `<section class="section-block" data-component="${MAP_MODULE_MARKER}" data-section-type="${MAP_SECTION_TYPE}">
  <div class="wrap">
    ${renderSectionHeader("Find us", `Visit ${profile.pharmacyName}`, "Your local pharmacy — directions, map and contact details.")}
    <div class="pharmacy-map-card content-card">
      <div class="pharmacy-map-grid">
        <div class="pharmacy-map-details">
          <h3 class="pharmacy-map-name">${esc(profile.pharmacyName)}</h3>
          <p class="pharmacy-map-address" data-map-field="address">${esc(address)}</p>
          ${phoneHtml}
        </div>
        ${renderMapEmbed(profile)}
      </div>
      <div class="hero-ctas hero-ctas--premium pharmacy-map-ctas">
        <a class="btn-primary" href="${esc(directionsUrl)}" target="_blank" rel="noopener noreferrer" data-map-cta="directions">Get Directions</a>
        <a class="btn-secondary" href="${esc(openMapsUrl)}" target="_blank" rel="noopener noreferrer" data-map-cta="open-maps">Open In Google Maps</a>
      </div>
    </div>
  </div>
</section>`;
}

export function renderPharmacyMapModuleForSlug(slug: string): string {
  const profile = loadPharmacyMapProfile(slug);
  if (!canRenderPharmacyMapModule(profile)) return "";
  return renderPharmacyMapModule(profile);
}

export function resolveMapInjectionAnchor(sections: Array<{ type: string }>): string | null {
  for (const anchor of LOCAL_ANCHOR_PRIORITY) {
    if (sections.some((s) => s.type === anchor)) return anchor;
  }
  return sections.length ? sections[sections.length - 1]!.type : null;
}

export function assembleBodyBlocksWithMapModule<T extends { type: string }>(
  bodySections: T[],
  renderSection: (section: T, index: number) => string,
  mapHtml: string,
): string[] {
  if (!mapHtml.trim()) {
    return bodySections.map((section, index) => renderSection(section, index));
  }

  const anchor = resolveMapInjectionAnchor(bodySections);
  const blocks: string[] = [];
  let inserted = false;

  for (let i = 0; i < bodySections.length; i++) {
    const section = bodySections[i]!;
    blocks.push(renderSection(section, i));
    if (!inserted && anchor && section.type === anchor) {
      blocks.push(mapHtml);
      inserted = true;
    }
  }

  if (!inserted) blocks.push(mapHtml);
  return blocks;
}

export function pharmacyMapModuleStyles(): string {
  return `<style>
.pharmacy-map-card { padding: 28px; }
.pharmacy-map-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  align-items: stretch;
}
.pharmacy-map-name { margin: 0 0 10px; font-size: 1.2rem; color: var(--nhs-dark); }
.pharmacy-map-address { margin: 0 0 12px; color: #334155; line-height: 1.65; }
.pharmacy-map-phone { margin: 0; font-weight: 700; }
.pharmacy-map-phone a { color: var(--nhs-blue); text-decoration: none; }
.pharmacy-map-phone a:hover { text-decoration: underline; }
.pharmacy-map-embed {
  min-height: 260px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
}
.pharmacy-map-embed iframe {
  width: 100%;
  height: 100%;
  min-height: 260px;
  border: 0;
  display: block;
}
.pharmacy-map-fallback { padding: 20px; min-height: 180px; display: flex; flex-direction: column; justify-content: center; }
.pharmacy-map-fallback-address { margin: 0 0 16px; font-size: 1rem; line-height: 1.6; color: #334155; }
.pharmacy-map-ctas { margin-top: 22px; }
@media (max-width: 860px) {
  .pharmacy-map-grid { grid-template-columns: 1fr; }
}
</style>`;
}
