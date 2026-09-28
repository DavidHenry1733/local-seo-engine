/**
 * Archived 2026-09-28.
 * Former Growth Intelligence URL-slug matcher.
 * Not imported, routed, or used as a fallback.
 * Dedicated service coverage now uses canonicalExistingServiceCoverage.ts.
 */
const GENERIC_PAGE_PATH =
  /\/privacy-policy|\/cookie|\/terms|\/about-us\/?$|\/services\/?$|^\/$|\/book-a-service/i;

const SERVICE_PATH_HINTS: Record<string, RegExp[]> = {
  "blood-pressure-checks": [/blood-pressure/, /hypertension/, /blood-pressure-check/],
  "discharge-medicines-service": [/discharge-medicines/, /discharge-medicine/],
  "flu-vaccinations": [/flu-vaccination/, /flu-jab/, /flu-vacc/],
  "health-checks": [/health-check/, /health-screen/],
  "independent-prescriber": [/independent-prescriber/, /private-prescriber/, /prescriber/],
  "malaria-prevention": [/malaria/, /antimalarial/, /travel-health/],
  "medication-reviews": [/medication-review/, /medicines-review/],
  "minor-ailments": [/minor-ailment/, /pharmacy-first/],
  "new-medicine-service": [/new-medicine/, /nms/],
  "pharmacy-first": [/pharmacy-first/],
  "prescription-dispensing": [/prescription-dispensing/, /dispensing/],
  "repeat-prescriptions": [/repeat-prescription/, /repeat-prescriptions/],
  "smoking-cessation": [/smoking-cessation/, /stop-smoking/, /healthy-lifestyle/],
  "weight-management": [/weight-loss/, /weight-management/, /weight-loss-clinic/],
};

export function archivedPathMatchesService(serviceId: string, url: string): boolean {
  if (!url) return false;
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  if (GENERIC_PAGE_PATH.test(path)) return false;
  const hints = SERVICE_PATH_HINTS[serviceId] || [new RegExp(serviceId.replace(/-/g, "[-/]"))];
  return hints.some((re) => re.test(path));
}
