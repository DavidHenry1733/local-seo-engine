/**
 * Visual Experience V1 — benchmark service presentation config.
 * Presentation only — does not alter master content or publish pipeline.
 * Brand colours come from pharmacy profile via pharmacyThemeEngine.
 */

export const VISUAL_EXPERIENCE_BENCHMARK_SERVICES = [
  "pharmacy-first",
  "blood-pressure-checks",
  "travel-vaccinations",
  "flu-vaccinations",
  "emergency-contraception",
] as const;

export type VisualExperienceServiceId = (typeof VISUAL_EXPERIENCE_BENCHMARK_SERVICES)[number];

export interface VisualExperienceServiceConfig {
  serviceId: VisualExperienceServiceId;
  serviceName: string;
  templateFamilyKey: string;
  /** Image library serviceKey (may differ from serviceId) */
  imageServiceKey: string;
}

export const VISUAL_EXPERIENCE_SERVICE_CONFIG: Record<
  VisualExperienceServiceId,
  VisualExperienceServiceConfig
> = {
  "pharmacy-first": {
    serviceId: "pharmacy-first",
    serviceName: "Pharmacy First",
    templateFamilyKey: "clinical-nhs-services",
    imageServiceKey: "pharmacy-first",
  },
  "blood-pressure-checks": {
    serviceId: "blood-pressure-checks",
    serviceName: "Blood Pressure Checks",
    templateFamilyKey: "clinical-nhs-services",
    imageServiceKey: "blood-pressure-checks",
  },
  "travel-vaccinations": {
    serviceId: "travel-vaccinations",
    serviceName: "Travel Vaccinations",
    templateFamilyKey: "travel-health-services",
    imageServiceKey: "travel-vaccinations",
  },
  "flu-vaccinations": {
    serviceId: "flu-vaccinations",
    serviceName: "Flu Vaccinations",
    templateFamilyKey: "clinical-nhs-services",
    imageServiceKey: "flu-vaccinations",
  },
  "emergency-contraception": {
    serviceId: "emergency-contraception",
    serviceName: "Emergency Contraception",
    templateFamilyKey: "clinical-nhs-services",
    imageServiceKey: "emergency-contraception",
  },
};

export const VISUAL_EXPERIENCE_ROOT = "output/pharmacy-visual-experience";
export const MASTER_PUBLISH_SOURCE_ROOT = "output/pharmacy-master-publish";
