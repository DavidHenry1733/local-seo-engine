/**
 * NC-02 — National Competitor Discovery Storage V1
 */

import fs from "node:fs";

import type {
  NationalCompetitorDiscoveryResult,
} from "./nationalCompetitorDiscoveryModel.ts";
import {
  ensureNationalIntelligenceDataDir,
  nationalIntelligenceDataPath,
} from "./nationalIntelligenceStorageService.ts";

export function nationalCompetitorDiscoveryPath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "competitor-discovery");
}

export function readNationalCompetitorDiscovery(
  slug: string,
): NationalCompetitorDiscoveryResult | null {
  const file = nationalCompetitorDiscoveryPath(slug);

  if (!fs.existsSync(file)) return null;

  return JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as NationalCompetitorDiscoveryResult;
}

export function writeNationalCompetitorDiscovery(
  result: NationalCompetitorDiscoveryResult,
): string {
  ensureNationalIntelligenceDataDir();

  const file = nationalCompetitorDiscoveryPath(result.slug);

  fs.writeFileSync(
    file,
    JSON.stringify(result, null, 2) + "\n",
    "utf8",
  );

  return file;
}
