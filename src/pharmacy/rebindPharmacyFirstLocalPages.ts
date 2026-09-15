/**
 * Rebind local cluster / hierarchy pages using generic area resolver.
 */
import fs from "node:fs";
import path from "node:path";
import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";
import type { GenerationStamp } from "./benchmarkServiceEcosystemBuilder.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "./pharmacyLocalLocationGenerationService.ts";

export interface RebindPharmacyFirstLocalResult {
  slug: string;
  serviceId: string;
  pagesRebound: number;
  pagesExpected: number;
  outputPaths: string[];
  inactiveLocalPages: Array<{ areaSlug: string; reason: string }>;
}

export interface RebindPharmacyFirstLocalOptions {
  preserveExistingNarrative?: boolean;
}

export function rebindPharmacyFirstLocalClusterPages(
  slug: string,
  serviceId = "pharmacy-first",
  _options: RebindPharmacyFirstLocalOptions = {},
): RebindPharmacyFirstLocalResult {
  const resolvedSlug = resolveTenantProfileSlug(slug) || slug;
  const baseCtx = buildContentGenerationContext(resolvedSlug, serviceId);
  const result = generateLocalLocationHierarchyPages(baseCtx);
  if (!result.ok) {
    return {
      slug: resolvedSlug,
      serviceId,
      pagesRebound: 0,
      pagesExpected: 0,
      outputPaths: [],
      inactiveLocalPages: [],
    };
  }

  mergeLocalAssetsIntoEcosystemIndex(resolvedSlug, serviceId, result);
  const outputPaths = [
    result.hubPath,
    ...result.clusterPaths,
    ...result.areaPaths,
  ].filter(Boolean) as string[];

  return {
    slug: resolvedSlug,
    serviceId,
    pagesRebound: outputPaths.length,
    pagesExpected: 1 + result.hierarchy.clusters.length + result.hierarchy.areas.length,
    outputPaths,
    inactiveLocalPages: [],
  };
}
