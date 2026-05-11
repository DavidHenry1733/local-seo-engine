import fs from "node:fs";
import path from "node:path";
import { AreaConfig, PagePlanItem, ProjectConfig } from "./types";
import { slugify } from "../seo/slugify";

export function buildAreaPlan(
  project: ProjectConfig,
  areaConfigName: string
): PagePlanItem[] {
  const configPath = path.resolve(
    process.cwd(),
    "config/areas",
    `${areaConfigName}.json`
  );
  const areaConfig: AreaConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const pages: PagePlanItem[] = [];

  for (const service of project.services) {
    const hubSlug = `${slugify(service.label)}-${slugify(areaConfig.primaryCity)}`;

    const allAreaSlugs = areaConfig.coreAreas.map(
      (area) => `${slugify(service.label)}-${slugify(area)}`
    );

    // Hub page
    pages.push({
      serviceKey:   service.key,
      serviceLabel: service.label,
      location:     areaConfig.primaryCity,
      slug:         hubSlug,
      template:     "service-location-v1",
      pageRole:     "hub",
      allAreaSlugs,
      areaConfig,
    });

    // Area pages
    for (const area of areaConfig.coreAreas) {
      const areaSlug = `${slugify(service.label)}-${slugify(area)}`;

      // Sibling slugs: priorityAreas first, excluding self, capped at 3
      const siblingAreaSlugs = [
        ...areaConfig.priorityAreas,
        ...areaConfig.coreAreas.filter(
          (a) => !areaConfig.priorityAreas.includes(a)
        ),
      ]
        .filter((a) => a !== area)
        .slice(0, 3)
        .map((a) => `${slugify(service.label)}-${slugify(a)}`);

      pages.push({
        serviceKey:      service.key,
        serviceLabel:    service.label,
        location:        area,
        slug:            areaSlug,
        template:        "service-location-v1",
        pageRole:        "area",
        hubSlug,
        siblingAreaSlugs,
        areaConfig,
      });
    }
  }

  return pages;
}
