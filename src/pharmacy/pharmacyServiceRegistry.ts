/**
 * Central service catalog for launch channels and the 20-service roadmap.
 * Screen surfaces and generation endpoints filter on status === "active".
 */
export type ServiceRegistryStatus = "active" | "pipeline";
export type ServiceRegistryFunding = "nhs" | "private";

export interface ServiceRegistryEntry {
  id: string;
  name: string;
  status: ServiceRegistryStatus;
  funding: ServiceRegistryFunding;
  description: string;
  aliases?: readonly string[];
}

export const SERVICE_REGISTRY: readonly ServiceRegistryEntry[] = [
  {
    id: "pharmacy-first",
    name: "Pharmacy First",
    status: "active",
    funding: "nhs",
    description: "Help patients access NHS Pharmacy First for common conditions.",
  },
  {
    id: "blood-pressure-checks",
    name: "Blood Pressure Checks",
    status: "active",
    funding: "nhs",
    description: "Promote NHS blood pressure screening and case-finding in your pharmacy.",
  },
  {
    id: "travel-vaccinations",
    name: "Travel Vaccinations",
    status: "active",
    funding: "private",
    description: "Promote private travel health consultations and vaccinations.",
  },
  {
    id: "flu-vaccinations",
    name: "Flu Vaccinations",
    status: "active",
    funding: "nhs",
    aliases: ["flu-vaccination"],
    description: "Help patients find seasonal flu vaccination at your pharmacy.",
  },
  {
    id: "prescription-dispensing",
    name: "Prescription Dispensing",
    status: "pipeline",
    funding: "nhs",
    description: "Explain your dispensing service and how patients can collect medicines.",
  },
  {
    id: "emergency-contraception",
    name: "Emergency Contraception",
    status: "pipeline",
    funding: "nhs",
    description: "Help patients understand confidential emergency contraception access.",
  },
  {
    id: "repeat-prescriptions",
    name: "Repeat Prescriptions",
    status: "pipeline",
    funding: "nhs",
    description: "Make repeat ordering and EPS nomination clearer for local patients.",
  },
  {
    id: "pharmacy-contraception-service",
    name: "Pharmacy Contraception Service",
    status: "pipeline",
    funding: "nhs",
    description: "Promote NHS Pharmacy Contraception consultations where commissioned.",
  },
  {
    id: "new-medicine-service",
    name: "New Medicine Service",
    status: "pipeline",
    funding: "nhs",
    description: "Support patients starting new long-term medicines with NMS.",
  },
  {
    id: "malaria-prevention",
    name: "Malaria Prevention",
    status: "pipeline",
    funding: "nhs",
    description: "Share antimalarial advice where NHS or travel pathways apply.",
  },
  {
    id: "medication-reviews",
    name: "Medication Reviews",
    status: "pipeline",
    funding: "nhs",
    description: "Promote structured medicines reviews and pharmacist consultations.",
  },
  {
    id: "discharge-medicines-service",
    name: "Discharge Medicines Service",
    status: "pipeline",
    funding: "nhs",
    description: "Promote support for patients leaving hospital with new medicines.",
  },
  {
    id: "covid-vaccinations",
    name: "Covid Vaccinations",
    status: "pipeline",
    funding: "nhs",
    description: "Promote covid vaccination availability and booking information.",
  },
  {
    id: "smoking-cessation",
    name: "Smoking Cessation",
    status: "pipeline",
    funding: "nhs",
    description: "Support patients looking for stop-smoking help at your pharmacy.",
  },
  {
    id: "minor-ailments",
    name: "Minor Ailments",
    status: "pipeline",
    funding: "nhs",
    description: "Help patients understand minor ailment advice and treatment options.",
  },
  {
    id: "ear-wax-removal",
    name: "Ear Wax Removal",
    status: "pipeline",
    funding: "private",
    description: "Promote private ear wax removal and microsuction appointments.",
  },
  {
    id: "weight-management",
    name: "Weight Management",
    status: "pipeline",
    funding: "private",
    description: "Promote private weight management support at your pharmacy.",
  },
  {
    id: "health-checks",
    name: "Health Checks",
    status: "pipeline",
    funding: "private",
    description: "Help patients discover private health screening at your pharmacy.",
  },
  {
    id: "travel-health-consultations",
    name: "Travel Health Consultations",
    status: "pipeline",
    funding: "private",
    description: "Help travellers book private travel health appointments.",
  },
  {
    id: "vitamin-b12-injections",
    name: "Vitamin B12 Injections",
    status: "pipeline",
    funding: "private",
    description: "Promote vitamin B12 and related supplement services.",
  },
] as const;

const ALIAS_TO_ID: Record<string, string> = {};
for (const entry of SERVICE_REGISTRY) {
  ALIAS_TO_ID[entry.id] = entry.id;
  for (const alias of entry.aliases || []) ALIAS_TO_ID[alias] = entry.id;
}

export function isActiveServiceStatus(status: string | undefined): boolean {
  return status === "active";
}

export function activeServiceRegistry(): ServiceRegistryEntry[] {
  return SERVICE_REGISTRY.filter((entry) => isActiveServiceStatus(entry.status));
}

export function pipelineServiceRegistry(): ServiceRegistryEntry[] {
  return SERVICE_REGISTRY.filter((entry) => entry.status === "pipeline");
}

export const ACTIVE_SERVICE_IDS = activeServiceRegistry().map((entry) => entry.id);

export const ACTIVE_SERVICE_CHANNELS = activeServiceRegistry().map((entry) => ({
  id: entry.id,
  label: entry.name,
  aliases: entry.aliases ? [...entry.aliases] : undefined,
}));

export function canonicalizeServiceId(raw: unknown): string {
  const id = String(raw || "").trim().toLowerCase();
  return ALIAS_TO_ID[id] || id;
}

export function findServiceRegistryEntry(raw: unknown): ServiceRegistryEntry | undefined {
  const id = canonicalizeServiceId(raw);
  return SERVICE_REGISTRY.find((entry) => entry.id === id);
}

export function resolveActiveServiceId(raw: unknown): string | null {
  const entry = findServiceRegistryEntry(raw);
  if (!entry || !isActiveServiceStatus(entry.status)) return null;
  return entry.id;
}

export function isActiveServiceId(raw: unknown): boolean {
  return Boolean(resolveActiveServiceId(raw));
}

export function activeServiceLabel(raw: unknown): string {
  const entry = findServiceRegistryEntry(raw);
  return entry?.name || canonicalizeServiceId(raw);
}

export function activeServiceChannelPayload(): Array<{
  id: string;
  label: string;
  status: ServiceRegistryStatus;
  active: boolean;
}> {
  return activeServiceRegistry().map((entry) => ({
    id: entry.id,
    label: entry.name,
    status: entry.status,
    active: true,
  }));
}

export function activeServiceIdsList(): string {
  return ACTIVE_SERVICE_IDS.join(", ");
}
