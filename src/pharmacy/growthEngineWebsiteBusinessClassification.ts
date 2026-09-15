/**
 * Lightweight website business classification for scoping clinical pharmacy dictionaries.
 * A site that discusses pharmacies is not automatically a dispensing/community pharmacy.
 */

export type WebsiteBusinessClass =
  | "community_pharmacy"
  | "pharmacy_industry_supplier"
  | "digital_agency"
  | "professional_services"
  | "trades"
  | "unknown";

export interface WebsiteBusinessClassification {
  class: WebsiteBusinessClass;
  clinicalServiceDetectionEnabled: boolean;
  confidence: number;
  signals: string[];
  reasoning: string;
}

function textBlob(htmlByUrl: Record<string, string>, limit = 120_000): string {
  return Object.values(htmlByUrl).join("\n").slice(0, limit).toLowerCase();
}

export function classifyWebsiteBusinessType(input: {
  host: string;
  homepageHtml: string;
  pageHtmlByUrl: Record<string, string>;
  pagePaths: string[];
}): WebsiteBusinessClassification {
  const signals: string[] = [];
  const blob = `${input.homepageHtml}\n${textBlob(input.pageHtmlByUrl)}`.toLowerCase();
  const paths = input.pagePaths.map((p) => p.toLowerCase()).join(" ");

  const retailSignals = [
    { id: "nhs-pharmacy-first", re: /\bpharmacy first\b|\bnhs\s+pharmacy\b|\bnhs\.uk\b/ },
    { id: "gphc", re: /\bgphc\b|general pharmaceutical council|pharmacy registration number/ },
    { id: "dispensing", re: /\bdispens(?:e|ing|ary)\b|\brepeat prescriptions?\b|\border your prescription\b/ },
    { id: "local-pharmacy", re: /\byour local pharmacy\b|\bcommunity pharmacy\b|\bchemist\b/ },
    { id: "opening-hours-pharmacy", re: /\bcollection\b.*\bprescription\b|\bpharmacy counter\b/ },
  ];

  const supplierAgencySignals = [
    { id: "website-design-service", re: /\bpharmacy website design\b|\bwebsite design for pharmacies\b|\bweb design\b/ },
    { id: "seo-service", re: /\blocal seo for pharmacies\b|\bseo for pharmacies\b|\bdigital marketing\b/ },
    { id: "email-marketing-service", re: /\bemail marketing for pharmacies\b|\bpharmacy email marketing\b/ },
    { id: "hosting-service", re: /\bwebsite hosting\b|\bweb hosting\b/ },
    { id: "agency-positioning", re: /\bgrowth partner\b|\bmarketing agency\b|\bdigital agency\b|\bwe (?:build|design|help) pharmacies\b/ },
    { id: "commercial-paths", re: /website-design|local-seo|email-marketing|website-hosting|growth-audit/ },
  ];

  let retailScore = 0;
  for (const s of retailSignals) {
    if (s.re.test(blob) || s.re.test(paths)) {
      retailScore += 1;
      signals.push(`retail:${s.id}`);
    }
  }

  let supplierScore = 0;
  for (const s of supplierAgencySignals) {
    if (s.re.test(blob) || s.re.test(paths)) {
      supplierScore += 1;
      signals.push(`supplier:${s.id}`);
    }
  }

  // Dedicated clinical service paths strongly indicate community pharmacy
  if (/\/(pharmacy-first|travel-clinic|ear-wax|flu-jab|repeat-prescription)/i.test(paths)) {
    retailScore += 2;
    signals.push("retail:clinical-service-paths");
  }

  if (supplierScore >= 2 && supplierScore >= retailScore) {
    return {
      class: supplierScore >= 3 ? "digital_agency" : "pharmacy_industry_supplier",
      clinicalServiceDetectionEnabled: false,
      confidence: Math.min(92, 55 + supplierScore * 10),
      signals,
      reasoning: `Supplier/agency signals (${supplierScore}) outweigh retail pharmacy signals (${retailScore}); clinical dictionaries disabled.`,
    };
  }

  if (retailScore >= 2 && retailScore > supplierScore) {
    return {
      class: "community_pharmacy",
      clinicalServiceDetectionEnabled: true,
      confidence: Math.min(94, 50 + retailScore * 12),
      signals,
      reasoning: `Community/retail pharmacy signals (${retailScore}) activate scoped clinical service detection.`,
    };
  }

  if (supplierScore >= 1 && retailScore <= 1) {
    return {
      class: "pharmacy_industry_supplier",
      clinicalServiceDetectionEnabled: false,
      confidence: 60,
      signals,
      reasoning: "Weak retail pharmacy evidence with supplier/agency cues; clinical dictionaries disabled.",
    };
  }

  return {
    class: "unknown",
    clinicalServiceDetectionEnabled: false,
    confidence: 40,
    signals,
    reasoning: "Insufficient classification evidence; clinical pharmacy dictionaries remain inactive until retail pharmacy classification is established.",
  };
}
