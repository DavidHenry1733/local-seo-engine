/**
 * National Intelligence Storage V1
 *
 * File locations only at this stage.
 *
 * NC-01 deliberately does not write snapshots.
 * Later stages will use these canonical paths.
 */

import path from "node:path";

export const NATIONAL_INTELLIGENCE_DIR =
  path.join(process.cwd(), "data", "national-growth-engine");

export function nationalCompetitorSnapshotPath(slug: string): string {
  return path.join(
    NATIONAL_INTELLIGENCE_DIR,
    `${slug}-competitors.json`,
  );
}

export function nationalMarketSnapshotPath(slug: string): string {
  return path.join(
    NATIONAL_INTELLIGENCE_DIR,
    `${slug}-market.json`,
  );
}

export function nationalGrowthSnapshotPath(slug: string): string {
  return path.join(
    NATIONAL_INTELLIGENCE_DIR,
    `${slug}-growth.json`,
  );
}
