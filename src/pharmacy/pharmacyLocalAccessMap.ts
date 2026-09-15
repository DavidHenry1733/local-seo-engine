/**
 * Local Access map presentation — profile-driven Google Maps embed.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  mapResolveInputFromProfile,
  resolvePharmacyMapEmbed,
} from "./pharmacyMapResolver.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPharmacyLocalAccessMap(
  profile: PharmacyServicePageProfile,
  slug?: string,
): string {
  const resolved = resolvePharmacyMapEmbed(mapResolveInputFromProfile(profile, slug));
  if (!resolved.embedUrl) return "";

  const name = profile.pharmacyName || "Pharmacy location";
  const mapTitle = `Map showing ${name}${profile.town ? ` in ${profile.town}` : ""}`;

  return `<div class="pharmacy-map-card" data-component="pharmacy-local-map">
<iframe
  src="${esc(resolved.embedUrl)}"
  title="${esc(mapTitle)}"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  allowfullscreen
></iframe>
</div>`;
}
