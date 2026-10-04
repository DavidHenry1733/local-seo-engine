/**
 * Locked NHS Pharmacy First clinical tracks for the service-hub authority grid.
 */
export const NHS_PHARMACY_FIRST_CONDITION_TRACKS = [
  "Sore Throat",
  "Earache",
  "Sinusitis",
  "Impetigo",
  "Infected Insect Bites",
  "Shingles",
  "Uncomplicated UTIs",
] as const;

export type NhsPharmacyFirstConditionTrack = (typeof NHS_PHARMACY_FIRST_CONDITION_TRACKS)[number];

function iconSvg(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const CONDITION_TRACK_ICONS: Record<NhsPharmacyFirstConditionTrack, string> = {
  "Sore Throat": iconSvg(
    `<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.2 1.6 2.3 2.2 3.5 2.2s2.3-.6 3.5-2.2"/><path d="M9 10h.01M15 10h.01"/>`,
  ),
  Earache: iconSvg(
    `<path d="M16 7.5c0-2.5-2-4.5-4.5-4.5S7 5 7 7.5c0 2 1.2 3.2 2.4 4.2.8.7 1.6 1.4 1.6 2.3v2"/><path d="M11 18.5v.5a2.5 2.5 0 0 0 5 0c0-1.8-1.5-2.4-1.5-4"/>`,
  ),
  Sinusitis: iconSvg(
    `<path d="M12 4.5c3.5 0 6 2.4 6 5.4 0 2.4-1.4 3.7-2.6 4.6-.7.5-1.2 1.2-1.2 2v1.5"/><path d="M9.8 17.5h4.4"/><path d="M12 4.5C8.5 4.5 6 6.9 6 9.9c0 1.4.5 2.5 1.2 3.4"/>`,
  ),
  Impetigo: iconSvg(
    `<circle cx="8.5" cy="9" r="2.2"/><circle cx="14.5" cy="8" r="1.6"/><circle cx="12" cy="14.5" r="2.6"/><circle cx="17.5" cy="13" r="1.4"/>`,
  ),
  "Infected Insect Bites": iconSvg(
    `<path d="M12 5v3M9 9h6"/><path d="M7 13c1.5-1.5 3.2-2 5-2s3.5.5 5 2"/><path d="M8 19c1.4-2 2.6-3 4-3s2.6 1 4 3"/><circle cx="12" cy="12" r="1.2"/>`,
  ),
  Shingles: iconSvg(
    `<path d="M4 8c2.5 1.4 4.5 1.4 7 0s4.5-1.4 7 0 3.5 1.4 6 0"/><path d="M4 12c2.5 1.4 4.5 1.4 7 0s4.5-1.4 7 0 3.5 1.4 6 0"/><path d="M4 16c2.5 1.4 4.5 1.4 7 0s4.5-1.4 7 0 3.5 1.4 6 0"/>`,
  ),
  "Uncomplicated UTIs": iconSvg(
    `<path d="M12 4c3.5 4.2 5.5 7 5.5 9.4A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-5.6C6.5 11 8.5 8.2 12 4z"/>`,
  ),
};

export function renderNhsPharmacyFirstConditionGridHtml(): string {
  const cards = NHS_PHARMACY_FIRST_CONDITION_TRACKS.map(
    (name) => `<article class="card equal-height-card condition-track-card" data-condition-track="${name}">
<div class="condition-track-icon cluster-accent-text" aria-hidden="true">${CONDITION_TRACK_ICONS[name]}</div>
<h3>${name}</h3>
</article>`,
  ).join("\n");
  return `<section id="conditions-grid" class="conditions-authority-section" data-template-block="conditions" data-condition-layout="authority-7">
<div class="wrap">
<div class="section-head center">
<h2>Conditions Covered Under NHS Pharmacy First</h2>
</div>
<div class="conditions-authority-grid conditions-grid" data-grid-cols="7">${cards}</div>
</div>
</section>`;
}
