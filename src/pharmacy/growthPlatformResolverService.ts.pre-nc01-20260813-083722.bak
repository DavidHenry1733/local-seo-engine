/**
 * Growth Platform Resolver V1
 *
 * Runtime resolver for the explicit two-platform Growth Engine architecture.
 *
 * LOCAL:
 *   Existing Local Growth Engine.
 *
 * NATIONAL:
 *   Separate National Growth Engine.
 *
 * Platform selection is explicit from project configuration.
 * No keyword inference.
 * No physical-locality inference.
 */

import fs from "node:fs";
import path from "node:path";

import {
  buildGrowthPlatformContract,
  type GrowthPlatform,
  type GrowthPlatformContract,
} from "./commercialMarketContextService.ts";

function projectConfigPath(slug: string): string {
  return path.join(process.cwd(), "config", "projects", `${slug}.json`);
}

export interface ResolvedGrowthPlatform {
  slug: string;
  platform: GrowthPlatform;
  contract: GrowthPlatformContract;
  source: string;
}

export function resolveGrowthPlatform(slug: string): ResolvedGrowthPlatform {
  const file = projectConfigPath(slug);

  if (!fs.existsSync(file)) {
    /*
     * Backwards compatibility:
     * Existing tenants without an explicit setting remain on the established
     * Local Growth Engine. We do not infer NATIONAL.
     */
    return {
      slug,
      platform: "local",
      contract: buildGrowthPlatformContract("local"),
      source: "backwards-compatible-local-default",
    };
  }

  const project = JSON.parse(fs.readFileSync(file, "utf8")) as {
    growthPlatform?: GrowthPlatform;
  };

  const platform: GrowthPlatform =
    project.growthPlatform === "national" ? "national" : "local";

  return {
    slug,
    platform,
    contract: buildGrowthPlatformContract(platform),
    source:
      project.growthPlatform === "national" || project.growthPlatform === "local"
        ? "project-config-explicit"
        : "backwards-compatible-local-default",
  };
}

export function isNationalGrowthPlatform(slug: string): boolean {
  return resolveGrowthPlatform(slug).platform === "national";
}

export function isLocalGrowthPlatform(slug: string): boolean {
  return resolveGrowthPlatform(slug).platform === "local";
}
