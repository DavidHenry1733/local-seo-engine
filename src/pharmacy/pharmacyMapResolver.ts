/**
 * Profile-driven map resolution — safe embeds only; no Europe/world fallbacks.
 */
import fs from "node:fs";
import path from "node:path";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeTelHref } from "./pharmacyServicePageProfileContext.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { loadLocalMarketSnapshot } from "./pharmacyLocalMarketSnapshot.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_MAP_CONTACT_SECTION_ID } from "./pharmacyMapContactComponent.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export interface MapResolveInput {
  mapEmbedUrl?: string;
  googleMapsEmbedUrl?: string;
  googlePlaceId?: string;
  pharmacyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  townCity?: string;
  primaryTown?: string;
  postcode?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  areaName?: string;
}

export interface ResolvedPharmacyMap {
  embedUrl: string | null;
  fallbackAddress: string;
  mapAvailable: boolean;
  reason: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isInvalidGenericMapEmbedUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return true;
  if (!/google\.(com|[a-z]{2,3})\/maps|maps\.google\.com|googleusercontent\.com\/maps/.test(u)) {
    if (!u.startsWith("http")) return true;
  }
  if (/[?&](q=0%2c0|q=0,0|center=0|ll=0%2c0|ll=0,0)/.test(u)) return true;
  if (/[?&]z=([01])(?:\D|$)/.test(u)) return true;
  if (/[?&]q=\s*(?:&|$)/.test(u)) return true;
  // q=place_id:…&output=embed frequently renders a world map in iframes — never treat as verified locality.
  if (/[?&]q=place_id:/i.test(u)) return true;
  if (/output=embed(?:\s|$)/.test(u) && !/[?&]q=/.test(u) && !/[@=]-?\d/.test(u)) {
    return true;
  }
  return false;
}

export function buildMapLocationQuery(input: MapResolveInput): string {
  return [
    input.pharmacyName,
    input.addressLine1,
    input.addressLine2,
    input.townCity,
    input.postcode,
    "UK",
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function resolvePharmacyMapEmbed(input: MapResolveInput): ResolvedPharmacyMap {
  const fallbackAddress = buildMapLocationQuery(input);
  const query = buildMapLocationQuery(input);

  const lat = parseFloat(String(input.latitude ?? ""));
  const lng = parseFloat(String(input.longitude ?? ""));
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.01 && Math.abs(lng) > 0.01) {
    const url = `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`;
    if (!isInvalidGenericMapEmbedUrl(url)) {
      return { embedUrl: url, fallbackAddress, mapAvailable: true, reason: "coordinates" };
    }
  }

  const placeIdEarly = String(input.googlePlaceId ?? "").trim();
  if (placeIdEarly) {
    const url = `https://maps.google.com/maps?q=place_id:${encodeURIComponent(placeIdEarly)}&hl=en&z=15&output=embed`;
    if (!isInvalidGenericMapEmbedUrl(url)) {
      return { embedUrl: url, fallbackAddress, mapAvailable: true, reason: "place-id" };
    }
  }

  if (query.replace(/,\s*UK$/i, "").trim().length >= 4) {
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=en&z=15&output=embed`;
    if (!isInvalidGenericMapEmbedUrl(url)) {
      return { embedUrl: url, fallbackAddress: query, mapAvailable: true, reason: "location-query" };
    }
  }

  for (const raw of [input.mapEmbedUrl, input.googleMapsEmbedUrl]) {
    const url = String(raw ?? "").trim();
    if (url && !isInvalidGenericMapEmbedUrl(url)) {
      return { embedUrl: url, fallbackAddress, mapAvailable: true, reason: "profile-embed-url" };
    }
  }

  const placeId = String(input.googlePlaceId ?? "").trim();
  if (placeId) {
    const url = `https://maps.google.com/maps?q=place_id:${encodeURIComponent(placeId)}&hl=en&z=15&output=embed`;
    if (!isInvalidGenericMapEmbedUrl(url)) {
      return { embedUrl: url, fallbackAddress, mapAvailable: true, reason: "place-id" };
    }
  }

  if (query.replace(/,\s*UK$/i, "").trim().length < 4) {
    return { embedUrl: null, fallbackAddress: fallbackAddress || "Address on file", mapAvailable: false, reason: "no-location-data" };
  }

  return { embedUrl: null, fallbackAddress: query, mapAvailable: false, reason: "invalid-embed-query" };
}

export function mapResolveInputFromProfile(
  profile: PharmacyServicePageProfile,
  slug?: string,
): MapResolveInput {
  let primaryTown = "";
  let mapEmbedUrl = "";
  let googlePlaceId = "";
  let latitude: string | number | null = null;
  let longitude: string | number | null = null;

  const hasValidCoords = (lat: unknown, lng: unknown): boolean => {
    const a = Number(lat);
    const b = Number(lng);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) > 0.01 && Math.abs(b) > 0.01;
  };

  if (slug) {
    const key = resolveTenantProfileSlug(slug) || slug;
    const loaded = loadPharmacyProfile(key);
    const data = loaded?.data || {};
    primaryTown = String(data.primaryTown || "").trim();
    mapEmbedUrl = String((data as Record<string, unknown>).mapEmbedUrl ?? "").trim();
    if (!mapEmbedUrl) {
      mapEmbedUrl = String(data.googleMapsEmbedUrl || "").trim();
    }
    googlePlaceId = String(data.googlePlaceId || "").trim();
    if (!googlePlaceId) {
      const snap = data.googleImportSnapshot as { placeId?: string } | undefined;
      googlePlaceId = String(snap?.placeId || "").trim();
    }
    latitude = data.latitude ?? null;
    longitude = data.longitude ?? null;
    if ((!latitude || !longitude) && data.googleImportSnapshot) {
      const snap = data.googleImportSnapshot as {
        latitude?: number | string | null;
        longitude?: number | string | null;
        lat?: number | string | null;
        lng?: number | string | null;
      };
      latitude = snap.latitude ?? snap.lat ?? latitude;
      longitude = snap.longitude ?? snap.lng ?? longitude;
    }

    // Stored LMI / Google-identity coordinates — never invent; only reuse verified evidence files.
    // Prefer growth-engine pharmacy coordinates when present (canonical locality pin).
    if (!hasValidCoords(latitude, longitude)) {
      try {
        const competitorsPath = path.join(
          PHARMACY_WORKSPACE_ROOT,
          "data/growth-engine",
          `${key}-competitors.json`,
        );
        if (fs.existsSync(competitorsPath)) {
          const competitors = JSON.parse(fs.readFileSync(competitorsPath, "utf8")) as {
            pharmacy?: { latitude?: number; longitude?: number };
            yourPharmacy?: { latitude?: number | null; longitude?: number | null; placeId?: string };
          };
          const pharmacyCoords = competitors.pharmacy;
          if (pharmacyCoords && hasValidCoords(pharmacyCoords.latitude, pharmacyCoords.longitude)) {
            latitude = pharmacyCoords.latitude!;
            longitude = pharmacyCoords.longitude!;
          } else if (
            competitors.yourPharmacy &&
            hasValidCoords(competitors.yourPharmacy.latitude, competitors.yourPharmacy.longitude)
          ) {
            latitude = competitors.yourPharmacy.latitude!;
            longitude = competitors.yourPharmacy.longitude!;
          }
          if (!googlePlaceId && competitors.yourPharmacy?.placeId) {
            googlePlaceId = String(competitors.yourPharmacy.placeId);
          }
        }
        if (!hasValidCoords(latitude, longitude)) {
          const giPath = path.join(
            PHARMACY_WORKSPACE_ROOT,
            "data/pharmacy-master-admin/google-identity",
            `${key}.json`,
          );
          if (fs.existsSync(giPath)) {
            const gi = JSON.parse(fs.readFileSync(giPath, "utf8")) as {
              placeId?: string;
              urlResolution?: { coordinates?: { latitude?: number; longitude?: number } };
            };
            if (!googlePlaceId && gi.placeId) googlePlaceId = String(gi.placeId);
            const coords = gi.urlResolution?.coordinates;
            if (coords && hasValidCoords(coords.latitude, coords.longitude)) {
              latitude = coords.latitude!;
              longitude = coords.longitude!;
            }
          }
        }
      } catch {
        /* keep prior values */
      }
    }

    const market = loadLocalMarketSnapshot(key);
    const coords = market?.yourPharmacy;
    if (!googlePlaceId && coords?.placeId) googlePlaceId = coords.placeId;
    if (!hasValidCoords(latitude, longitude) && coords && hasValidCoords(coords.latitude, coords.longitude)) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
  }

  return {
    mapEmbedUrl,
    googleMapsEmbedUrl: profile.googleMapsEmbedUrl,
    googlePlaceId,
    pharmacyName: profile.pharmacyName,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    townCity: profile.town,
    primaryTown,
    postcode: profile.postcode,
    latitude,
    longitude,
  };
}

export function renderPharmacyMapContactComponent(
  profile: PharmacyServicePageProfile,
  options: {
    slug?: string;
    areaName?: string;
    title?: string;
  } = {},
): string {
  return renderPharmacyMapSectionHtml(profile, {
    ...options,
    sectionId: PHARMACY_MAP_CONTACT_SECTION_ID,
    title: options.title || `Find ${profile.pharmacyName || "Pharmacy"}`,
    intro: `${profile.pharmacyName || "Pharmacy"} — directions, map and contact details.`,
  });
}

/** @deprecated use renderPharmacyMapContactComponent */
export function renderPharmacyMapSectionHtml(
  profile: PharmacyServicePageProfile,
  options: {
    slug?: string;
    areaName?: string;
    intro?: string;
    title?: string;
    sectionId?: string;
  } = {},
): string {
  const resolved = resolvePharmacyMapEmbed(mapResolveInputFromProfile(profile, options.slug));
  const name = profile.pharmacyName || "Pharmacy";
  const areaLine = options.areaName
    ? `<p class="local-area-serving">Serving patients in <strong>${esc(options.areaName)}</strong> and nearby areas.</p>`
    : "";
  const title = options.title || (options.areaName ? `${name} — local access` : `Find ${name}`);
  const sectionId = options.sectionId || PHARMACY_MAP_CONTACT_SECTION_ID;
  void options.intro;

  const addressBlock = `<p><strong>Address:</strong> ${esc(profile.fullAddress || resolved.fallbackAddress)}</p>`;
  const phoneBlock = profile.phone
    ? `<p><strong>Phone:</strong> <a href="${esc(normalizeTelHref(profile.phone))}">${esc(profile.displayPhone || profile.phone)}</a></p>`
    : "";
  const emailBlock = profile.email
    ? `<p><strong>Email:</strong> <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></p>`
    : "";
  const mapInput = mapResolveInputFromProfile(profile, options.slug);
  const placeId = String(mapInput.googlePlaceId ?? "").trim();
  const directionsUrl = placeId
    ? `https://www.google.com/maps/dir/?api=1&destination_place_id=${encodeURIComponent(placeId)}`
    : resolved.fallbackAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(resolved.fallbackAddress)}`
      : "";
  const directionsBlock = directionsUrl
    ? `<p class="local-access-cta"><a class="btn secondary" href="${esc(directionsUrl)}" target="_blank" rel="noopener noreferrer">Get directions</a></p>`
    : "";

  const mapInner = resolved.embedUrl
    ? `<div class="pharmacy-map-card" data-component="pharmacy-local-map"${placeId ? ` data-map-source="place-id" data-google-place-id="${esc(placeId)}"` : ` data-map-source="${esc(resolved.reason)}"`}>
<iframe src="${esc(resolved.embedUrl)}" title="Map for ${esc(name)}${options.areaName ? ` — ${esc(options.areaName)}` : ""}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
</div>`
    : `<div class="map-placeholder map-unavailable" role="img" aria-label="Map unavailable">
<div><strong>Map unavailable</strong><span>${esc(resolved.fallbackAddress)}</span></div>
</div>`;

  return `<section class="local pharmacy-map-contact" id="${esc(sectionId)}" data-template-block="map-contact" data-component="pharmacy-map-contact" data-map-layout="split-map-details">
<div class="wrap">
<div class="section-head center"><h2>${esc(title)}</h2>${areaLine}</div>
<div class="pharmacy-local-grid">
<div class="pharmacy-local-details">
<h3>${esc(name)}</h3>
${addressBlock}
${phoneBlock}
${emailBlock}
${profile.openingHours ? `<p><strong>Opening hours:</strong> ${esc(profile.openingHours)}</p>` : ""}
${directionsBlock}
</div>
${mapInner}
</div>
</div>
</section>`;
}

export function validateMapInHtml(html: string): { ok: boolean; detail: string; hasIframe: boolean; hasFallback: boolean } {
  const hasIframe = /<iframe[^>]+src=["'][^"']*google[^"']*maps/i.test(html);
  const hasFallback = /map-unavailable|Map unavailable/i.test(html);
  const europeLike = /<iframe[^>]+src=["'][^"']*(?:q=0%2C0|q=0,0|z=0|z=1(?:[^0-9]|$))/i.test(html);
  if (europeLike) return { ok: false, detail: "generic Europe/world map detected", hasIframe, hasFallback };
  if (hasIframe) {
    const srcMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    const src = srcMatch?.[1] || "";
    if (isInvalidGenericMapEmbedUrl(src)) {
      return { ok: false, detail: "invalid map embed src", hasIframe, hasFallback };
    }
    return { ok: true, detail: "map iframe present", hasIframe, hasFallback };
  }
  if (hasFallback || /map-placeholder|pharmacy-local-details/i.test(html)) {
    return { ok: true, detail: "address fallback (no misleading map)", hasIframe, hasFallback };
  }
  return { ok: false, detail: "no map or local access section", hasIframe, hasFallback };
}
