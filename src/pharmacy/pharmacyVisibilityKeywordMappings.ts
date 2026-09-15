/**
 * Visibility Tracking Bridge V1 — local keyword templates for benchmark services.
 * Town is injected dynamically from the pharmacy profile.
 */

export interface ServiceKeywordTemplate {
  serviceId: string;
  primaryKeywordTemplate: string;
  secondaryKeywordTemplates: string[];
}

export const VISIBILITY_KEYWORD_TEMPLATES: ServiceKeywordTemplate[] = [
  {
    serviceId: "pharmacy-first",
    primaryKeywordTemplate: "pharmacy first {town}",
    secondaryKeywordTemplates: ["minor illness pharmacy {town}", "NHS pharmacy first {town}"],
  },
  {
    serviceId: "blood-pressure-checks",
    primaryKeywordTemplate: "blood pressure check {town}",
    secondaryKeywordTemplates: ["pharmacy blood pressure check {town}", "hypertension screening pharmacy {town}"],
  },
  {
    serviceId: "travel-vaccinations",
    primaryKeywordTemplate: "travel vaccinations {town}",
    secondaryKeywordTemplates: ["travel clinic {town}", "travel health pharmacy {town}"],
  },
  {
    serviceId: "prescription-dispensing",
    primaryKeywordTemplate: "prescription dispensing {town}",
    secondaryKeywordTemplates: ["pharmacy prescription collection {town}", "EPS pharmacy {town}"],
  },
  {
    serviceId: "emergency-contraception",
    primaryKeywordTemplate: "emergency contraception {town}",
    secondaryKeywordTemplates: ["morning after pill pharmacy {town}", "pharmacy emergency contraception {town}"],
  },
  {
    serviceId: "repeat-prescriptions",
    primaryKeywordTemplate: "repeat prescriptions {town}",
    secondaryKeywordTemplates: ["pharmacy repeat prescription {town}", "EPS repeat prescription {town}"],
  },
  {
    serviceId: "pharmacy-contraception-service",
    primaryKeywordTemplate: "pharmacy contraception service {town}",
    secondaryKeywordTemplates: ["contraception pharmacy {town}", "NHS pharmacy contraception {town}"],
  },
  {
    serviceId: "new-medicine-service",
    primaryKeywordTemplate: "new medicine service {town}",
    secondaryKeywordTemplates: ["NHS new medicine service {town}", "pharmacy medicine support {town}"],
  },
  {
    serviceId: "malaria-prevention",
    primaryKeywordTemplate: "malaria prevention {town}",
    secondaryKeywordTemplates: ["antimalarial consultation {town}", "malaria tablets pharmacy {town}"],
  },
  {
    serviceId: "medication-reviews",
    primaryKeywordTemplate: "medication review {town}",
    secondaryKeywordTemplates: ["pharmacy medication review {town}", "structured medication review {town}"],
  },
];

export function resolveServiceKeywords(serviceId: string, town: string): {
  primaryKeyword: string;
  secondaryKeywords: string[];
} | null {
  const template = VISIBILITY_KEYWORD_TEMPLATES.find((t) => t.serviceId === serviceId);
  if (!template) return null;
  const fill = (s: string) => s.replace(/\{town\}/gi, town);
  return {
    primaryKeyword: fill(template.primaryKeywordTemplate),
    secondaryKeywords: template.secondaryKeywordTemplates.map(fill),
  };
}

export function countTrackedKeywords(town: string): number {
  return VISIBILITY_KEYWORD_TEMPLATES.reduce((sum, t) => {
    const kw = resolveServiceKeywords(t.serviceId, town);
    return sum + (kw ? 1 + kw.secondaryKeywords.length : 0);
  }, 0);
}
