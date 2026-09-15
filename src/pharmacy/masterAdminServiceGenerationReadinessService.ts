/**
 * CPR-SERVICE-READINESS-01 / CPR-SERVICE-REGISTRATION-01
 * Shared generation-readiness resolver backed by the canonical Service Registration Framework.
 * Create Campaign must use this status. Does not generate pages or patch service content.
 */
import {
  evaluateServiceRegistration,
  listLockedCommercialServiceRegistrations,
  type ServiceRegistrationRequirement,
} from "./masterAdminServiceRegistrationFramework.ts";

/** Display labels for Create Campaign / readiness UI — aligned to registration checklist. */
export const SERVICE_GENERATION_READINESS_COMPONENTS = [
  "Commercial registration",
  "Service metadata",
  "Evidence schema",
  "Master content registration",
  "Visual Experience registration",
  "Generation registration",
  "Locality support",
  "FAQ bank",
  "CTA bank",
  "Image compatibility",
  "Readiness validation",
] as const;

export type ServiceGenerationReadinessComponent =
  (typeof SERVICE_GENERATION_READINESS_COMPONENTS)[number];

export type ServiceGenerationReadinessStatus = "Ready" | "Setup Required";

export interface ServiceGenerationReadiness {
  serviceId: string;
  serviceName: string;
  status: ServiceGenerationReadinessStatus;
  generationReady: boolean;
  selectable: boolean;
  missingComponents: ServiceGenerationReadinessComponent[];
  components: Record<ServiceGenerationReadinessComponent, boolean>;
}

function toReadiness(
  evaluation: NonNullable<ReturnType<typeof evaluateServiceRegistration>>,
): ServiceGenerationReadiness {
  const components = {} as Record<ServiceGenerationReadinessComponent, boolean>;
  for (const key of SERVICE_GENERATION_READINESS_COMPONENTS) {
    components[key] = evaluation.registrations[key as ServiceRegistrationRequirement];
  }
  return {
    serviceId: evaluation.serviceId,
    serviceName: evaluation.serviceName,
    status: evaluation.status,
    generationReady: evaluation.generationReady,
    selectable: evaluation.selectable,
    missingComponents: evaluation.missingRegistrations as ServiceGenerationReadinessComponent[],
    components,
  };
}

export function resolveServiceGenerationReadiness(
  serviceId: string,
): ServiceGenerationReadiness | null {
  const evaluation = evaluateServiceRegistration(serviceId);
  if (!evaluation) return null;
  return toReadiness(evaluation);
}

export function listLockedCommercialServicesWithGenerationReadiness(): ServiceGenerationReadiness[] {
  return listLockedCommercialServiceRegistrations().map(toReadiness);
}

export function isServiceGenerationReady(serviceId: string): boolean {
  return resolveServiceGenerationReadiness(serviceId)?.generationReady === true;
}
