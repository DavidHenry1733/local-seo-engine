#!/usr/bin/env npx tsx
/**
 * RC1-I1 — Rerun design intelligence capture only (no renderer, no DNA regen).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import {
  captureWebsiteDesignEvidence,
  validateCapturedDesignIntelligence,
} from "../src/pharmacy/pharmacyWebsiteDesignCaptureService.ts";
import { importDesignEvidenceAssets } from "../src/pharmacy/pharmacyWebsiteDesignAssetImporter.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";
const SOURCE_URL =
  process.argv[3] || "https://pharmacyhealthhub.co.uk/bannercross-pharmacy-sheffield/";

async function main() {
  const captured = await captureWebsiteDesignEvidence({ slug: SLUG, primaryUrl: SOURCE_URL });
  const assetResult = await importDesignEvidenceAssets(SLUG, captured);
  captured.assets = assetResult.assets;

  const profilePath = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
  if (fs.existsSync(profilePath)) {
    const profile = JSON.parse(fs.readFileSync(profilePath, "utf8")) as {
      websiteImportSnapshot?: { intelligence?: { designEvidence?: unknown } };
    };
    if (profile.websiteImportSnapshot?.intelligence) {
      profile.websiteImportSnapshot.intelligence.designEvidence = captured;
      fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    }
  }

  const validation = validateCapturedDesignIntelligence(SLUG);
  console.log(
    JSON.stringify(
      {
        slug: SLUG,
        sourceUrl: SOURCE_URL,
        sourceRevision: captured.sourceRevision,
        designEvidence: path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", SLUG, "design-evidence.json"),
        designIntelligence: path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", SLUG, "design-intelligence.json"),
        validation,
        navigationItems: captured.navigation.items.length,
        navigationDepth: captured.navigation.hierarchyDepth,
        footerBackground: captured.footer.backgroundColour,
      },
      null,
      2,
    ),
  );

  if (!validation.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
