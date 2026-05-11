import { slugify } from "./seo/slugify";

/**
 * Canonical path for a hub page: /{service-slug}-{city-slug}/
 */
export function hubPath(serviceName: string, cityName: string): string {
  return `/${slugify(serviceName)}-${slugify(cityName)}/`;
}

/**
 * Canonical path for a cluster/area page: /{service-slug}-{area-slug}/
 */
export function clusterPath(serviceName: string, areaName: string): string {
  return `/${slugify(serviceName)}-${slugify(areaName)}/`;
}

/**
 * Determine remotePath from service + area/city + tier.
 * This is the single source of truth for all page URL generation.
 */
export function pageRemotePath(
  serviceName: string,
  locationName: string,
  tier: "hub" | "priority" | "secondary" | string
): string {
  if (tier === "hub") return hubPath(serviceName, locationName);
  return clusterPath(serviceName, locationName);
}
