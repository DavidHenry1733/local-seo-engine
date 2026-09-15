export type TemplateType =
  | "classic"
  | "problem_solution"
  | "authority";

export function pickTemplate(areaIdx:number): TemplateType {
  const templates: TemplateType[] = [
    "classic",
    "problem_solution",
    "authority"
  ];

  return templates[Math.abs(areaIdx) % templates.length];
}
