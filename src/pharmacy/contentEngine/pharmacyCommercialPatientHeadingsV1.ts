/**
 * Content Engine V1 — patient-facing heading planner.
 * Maps internal master-library labels to commercial public headings.
 */
export type PatientHeadingContext = {
  pharmacyName: string;
  town: string;
  serviceName: string;
};

const SYSTEM_HEADING =
  /^(SERVICE OVERVIEW|CONDITIONS COVERED|ELIGIBILITY|APPOINTMENT PROCESS|COMMON MISCONCEPTIONS|TRUST CONTENT|LOCAL INFORMATION|LOCAL ACCESS|LOCAL RELEVANCE|CLINICAL ENVIRONMENT|PROCESS|SAFETY|SUPPORT)$/i;

export function isSystemServiceHeading(heading: string): boolean {
  const h = String(heading || "").trim();
  if (!h) return false;
  if (SYSTEM_HEADING.test(h)) return true;
  if (h === h.toUpperCase() && h.length > 3 && /[A-Z]/.test(h) && !/[a-z]/.test(h)) return true;
  return false;
}

/** Resolve a master-library / section heading into patient-facing commercial copy. */
export function resolvePatientFacingServiceHeading(
  heading: string,
  ctx: PatientHeadingContext,
): string {
  const raw = String(heading || "").trim();
  const key = raw.toUpperCase().replace(/\s+/g, " ");
  const pharmacy = ctx.pharmacyName.trim() || "our pharmacy";
  const town = ctx.town.trim() || "your area";
  const service = ctx.serviceName.trim() || "Pharmacy First";

  switch (key) {
    case "SERVICE OVERVIEW":
    case "SERVICE DEFINITION":
      return `Why patients choose ${pharmacy}`;
    case "CONDITIONS COVERED":
    case "CONDITIONS":
      return `How our pharmacists can help with ${service}`;
    case "ELIGIBILITY":
    case "ELIGIBILITY AND CONDITIONS":
      return `Who ${service} is suitable for`;
    case "APPOINTMENT PROCESS":
    case "PROCESS":
    case "HOW IT WORKS":
      return "What happens during your consultation";
    case "COMMON MISCONCEPTIONS":
    case "SAFETY":
      return "When to see a GP or urgent care instead";
    case "TRUST CONTENT":
    case "TRUST":
    case "STANDARDS":
    case "STANDARDS FOR PHARMACY PROFESSIONALS":
    case "GPHC TRUST CONTENT":
    case "NHS TRUST CONTENT":
      return `Why patients trust ${pharmacy}`;
    case "LOCAL INFORMATION":
    case "LOCAL ACCESS":
    case "LOCAL RELEVANCE":
    case "LOCAL":
      return `Local access from ${town}`;
    case "CLINICAL ENVIRONMENT":
    case "SUPPORT":
      return "How our pharmacists can help";
    case "COMMON QUESTIONS (FAQS)":
    case "COMMON PATIENT QUESTIONS":
    case "FREQUENTLY ASKED QUESTIONS":
      return "Frequently asked questions";
    case "BOOKING CTA":
    case "FINAL CTA":
    case "CTA":
      return "Book your consultation";
    default:
      break;
  }

  if (/standards|gphc trust|nhs trust content/i.test(raw)) {
    return `Why patients trust ${pharmacy}`;
  }

  if (isSystemServiceHeading(raw)) {
    return `Why patients choose ${pharmacy}`;
  }

  if (raw === raw.toUpperCase() && raw.length > 3 && /[A-Z]/.test(raw) && !/[a-z]/.test(raw)) {
    return raw
      .toLowerCase()
      .split(" ")
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  return raw;
}

export function resolvePatientFacingClusterHeading(
  kind:
    | "why"
    | "how"
    | "conditions"
    | "consultation"
    | "travel"
    | "landmarks"
    | "parking"
    | "gp"
    | "faq"
    | "book"
    | "neighbours",
  areaName: string,
  pharmacyName: string,
  serviceName = "Pharmacy First",
): string {
  const area = areaName.trim() || "your area";
  const pharmacy = pharmacyName.trim() || "our pharmacy";
  const service = serviceName.trim() || "Pharmacy First";
  switch (kind) {
    case "why":
      return `Why ${area} patients choose ${pharmacy}`;
    case "how":
      return `How ${service} can help`;
    case "conditions":
      return `Conditions ${service} may cover`;
    case "consultation":
      return "What happens during the consultation";
    case "travel":
      return `Travelling to ${pharmacy}`;
    case "landmarks":
      return `Finding ${pharmacy}`;
    case "parking":
      return `Parking and transport`;
    case "gp":
      return "When to contact a GP, NHS 111 or emergency services";
    case "faq":
      return "Frequently asked questions";
    case "book":
      return "Book, call or get directions";
    case "neighbours":
      return "Nearby areas we also help";
    default:
      return `Pharmacy care in ${area}`;
  }
}
