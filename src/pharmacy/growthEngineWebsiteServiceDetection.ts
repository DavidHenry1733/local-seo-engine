/**
 * Growth Engine — Website Intelligence service detection.
 * Clinical pharmacy dictionaries are scoped and must not apply to every tenant.
 */
export interface WebsiteServicePattern {
  id: string;
  name: string;
  urlPatterns: RegExp[];
  htmlPatterns: RegExp[];
}

/** Clinical / community-pharmacy service patterns — activate only for retail pharmacy classification. */
export const CLINICAL_PHARMACY_SERVICE_PATTERNS: WebsiteServicePattern[] = [
  { id: "pharmacy-first", name: "Pharmacy First", urlPatterns: [/pharmacy-first/i], htmlPatterns: [/pharmacy\s+first/i, /\bnhs\s+pharmacy\s+first\b/i] },
  { id: "blood-pressure-checks", name: "Blood Pressure Checks", urlPatterns: [/blood-pressure/i, /bp-check/i], htmlPatterns: [/blood\s+pressure/i, /\bbp\s+check/i] },
  { id: "travel-vaccinations", name: "Travel Clinic", urlPatterns: [/travel-vaccin/i, /travel-clinic/i, /travel-health/i], htmlPatterns: [/travel\s+vaccin/i, /travel\s+clinic/i, /travel\s+health/i] },
  { id: "flu-vaccinations", name: "Flu Vaccination", urlPatterns: [/flu-vaccin/i, /flu-jab/i], htmlPatterns: [/flu\s+vaccin/i, /seasonal\s+flu/i, /flu\s+jab/i] },
  { id: "covid-vaccinations", name: "Covid Vaccination", urlPatterns: [/covid-vaccin/i], htmlPatterns: [/covid\s+vaccin/i, /coronavirus\s+vaccin/i] },
  { id: "pharmacy-contraception-service", name: "Contraception", urlPatterns: [/contraception/i], htmlPatterns: [/contraception/i, /pharmacy\s+contraception/i] },
  { id: "weight-management", name: "Weight Management", urlPatterns: [/weight-management/i, /weight-loss/i], htmlPatterns: [/weight\s+management/i, /weight\s+loss\s+service/i] },
  { id: "smoking-cessation", name: "Smoking Cessation", urlPatterns: [/smoking-cessation/i, /stop-smoking/i], htmlPatterns: [/smoking\s+cessation/i, /stop\s+smoking/i] },
  { id: "emergency-contraception", name: "Emergency Contraception", urlPatterns: [/emergency-contraception/i], htmlPatterns: [/emergency\s+contraception/i, /\bmorning\s+after\b/i] },
  { id: "repeat-prescriptions", name: "Repeat Prescriptions", urlPatterns: [/repeat-prescription/i], htmlPatterns: [/repeat\s+prescription/i, /repeat\s+medication/i] },
  { id: "new-medicine-service", name: "New Medicine Service", urlPatterns: [/new-medicine-service/i, /\bnms\b/i], htmlPatterns: [/new\s+medicine\s+service/i, /\bnms\b/i] },
  { id: "discharge-medicines-service", name: "Discharge Medicines Service", urlPatterns: [/discharge-medicin/i], htmlPatterns: [/discharge\s+medicines/i] },
  { id: "minor-ailments", name: "Minor Ailments", urlPatterns: [/minor-ailment/i], htmlPatterns: [/minor\s+ailment/i, /common\s+conditions/i] },
  { id: "ear-wax-removal", name: "Ear Wax Removal", urlPatterns: [/ear-wax/i, /microsuction/i], htmlPatterns: [/ear\s+wax/i, /micro\s*suction/i] },
  { id: "health-checks", name: "Health Checks", urlPatterns: [/health-check/i], htmlPatterns: [/health\s+check/i, /health\s+screening/i] },
  { id: "private-prescribing", name: "Private Prescribing", urlPatterns: [/private-prescrib/i], htmlPatterns: [/private\s+prescrib/i] },
  { id: "independent-prescriber", name: "Independent Prescriber", urlPatterns: [/independent-prescrib/i, /ip-clinic/i], htmlPatterns: [/independent\s+prescrib/i] },
  { id: "prescription-dispensing", name: "Prescription Dispensing", urlPatterns: [/prescription/i, /dispens/i], htmlPatterns: [/prescription\s+dispens/i, /order\s+prescription/i] },
  { id: "malaria-prevention", name: "Malaria Prevention", urlPatterns: [/malaria/i], htmlPatterns: [/malaria/i, /antimalarial/i] },
  { id: "medication-reviews", name: "Medication Reviews", urlPatterns: [/medication-review/i], htmlPatterns: [/medication\s+review/i, /medicines\s+use\s+review/i] },
  { id: "vaccinations", name: "Vaccinations", urlPatterns: [/vaccination/i, /vaccine/i, /immunisation/i], htmlPatterns: [/vaccination/i, /vaccine/i, /immunisation/i] },
];

/** @deprecated Use CLINICAL_PHARMACY_SERVICE_PATTERNS with classification scoping. Kept as alias for existing imports. */
export const WEBSITE_SERVICE_PATTERNS = CLINICAL_PHARMACY_SERVICE_PATTERNS;

export function servicePatternById(id: string): WebsiteServicePattern | undefined {
  return CLINICAL_PHARMACY_SERVICE_PATTERNS.find((s) => s.id === id);
}

export function serviceDisplayName(id: string): string {
  return servicePatternById(id)?.name || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function detectServicesInUrl(path: string, options?: { clinicalEnabled?: boolean }): string[] {
  if (options?.clinicalEnabled === false) return [];
  const found: string[] = [];
  for (const svc of CLINICAL_PHARMACY_SERVICE_PATTERNS) {
    if (svc.urlPatterns.some((re) => re.test(path))) found.push(svc.id);
  }
  return found;
}

export function detectServicesInHtml(html: string, options?: { clinicalEnabled?: boolean }): string[] {
  if (options?.clinicalEnabled === false) return [];
  const found: string[] = [];
  for (const svc of CLINICAL_PHARMACY_SERVICE_PATTERNS) {
    if (svc.htmlPatterns.some((re) => re.test(html))) found.push(svc.id);
  }
  return [...new Set(found)];
}

export function detectAllServicesFromPages(
  pages: { path: string; category: string; detectedServiceIds: string[]; url: string }[],
  options?: { clinicalEnabled?: boolean },
): Map<string, { pages: typeof pages }> {
  const map = new Map<string, { pages: typeof pages }>();
  if (options?.clinicalEnabled === false) return map;
  for (const page of pages) {
    const ids = new Set(page.detectedServiceIds);
    if (page.category === "service-page") {
      for (const id of detectServicesInUrl(page.path, options)) ids.add(id);
    }
    for (const id of ids) {
      const entry = map.get(id) || { pages: [] };
      entry.pages.push(page);
      map.set(id, entry);
    }
  }
  return map;
}
