/**
 * Customer setup test tenant registry (Step 1/2 only).
 */
export const PHARMACY_DELIVERED_TEST_SLUG = "pharmacy-delivered-4u-test";

export const RETIRED_SETUP_TEST_SLUGS = new Set<string>(["rowlands-test"]);

export const PHARMACY_DELIVERED_TEST_BASELINE = {
  pharmacyName: "Pharmacy Delivered 4U",
  website: "https://pharmacydelivered4u.co.uk/",
  town: "Rotherham",
  postcode: "S60 2NN",
} as const;

export function isRetiredSetupTestSlug(slug: string): boolean {
  return RETIRED_SETUP_TEST_SLUGS.has(String(slug || "").trim());
}

export function retiredSetupTestBannerMessage(_slug: string): string {
  return `This test profile is retired. Use ${PHARMACY_DELIVERED_TEST_SLUG}.`;
}

export function renderRetiredSetupTestBanner(slug: string): string {
  if (!isRetiredSetupTestSlug(slug)) return "";
  const message = retiredSetupTestBannerMessage(slug);
  const target = `/api/growth-engine/start?slug=${encodeURIComponent(PHARMACY_DELIVERED_TEST_SLUG)}`;
  return `<div class="css-retired-banner" role="alert">
<strong>Retired test profile</strong>
<p>${escapeHtml(message)}</p>
<a href="${target}">Open ${escapeHtml(PHARMACY_DELIVERED_TEST_SLUG)}</a>
</div>`;
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export const ROWLANDS_STALE_NEEDLES = [
  "rowlandspharmacy.co.uk",
  "patientexperience@rowlandspharmacy.co.uk",
  "With over 400 pharmacies",
  "Rowlands Pharmacy",
] as const;

export function profileContainsRowlandsStaleText(raw: string): string | null {
  for (const needle of ROWLANDS_STALE_NEEDLES) {
    if (raw.includes(needle)) return needle;
  }
  return null;
}
