import { ProjectConfig, PagePlanItem } from "./types";
import { slugify } from "../seo/slugify";
import { buildAreaPlan } from "./buildAreaPlan";

export function buildProjectPlan(config: ProjectConfig): PagePlanItem[] {
  // Multiple clusters: areaConfigs (array) takes precedence over areaConfig (string)
  if (config.areaConfigs && config.areaConfigs.length > 0) {
    return config.areaConfigs.flatMap((name) => buildAreaPlan(config, name));
  }

  // Single cluster (legacy / backward compat)
  if (config.areaConfig) {
    return buildAreaPlan(config, config.areaConfig);
  }

  // Fallback: flat location list — each location treated as a standalone hub
  const pages: PagePlanItem[] = [];

  for (const service of config.services) {
    for (const location of config.locations) {
      pages.push({
        serviceKey:   service.key,
        serviceLabel: service.label,
        location,
        slug:         `${slugify(service.label)}-${slugify(location)}`,
        template:     "service-location-v1",
        pageRole:     "hub",
      });
    }
  }

  return pages;
}
