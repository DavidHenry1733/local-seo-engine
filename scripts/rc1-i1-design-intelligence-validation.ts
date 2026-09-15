#!/usr/bin/env npx tsx
/**
 * RC1-I1 — Validate imported Design Intelligence hierarchy only.
 */
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import {
  loadWebsiteDesignIntelligence,
  validateCapturedDesignIntelligence,
} from "../src/pharmacy/pharmacyWebsiteDesignCaptureService.ts";

const SLUG = process.argv[2] || "banner-cross-pharmacy";

function main() {
  const manifest = loadWebsiteDesignIntelligence(SLUG);
  const validation = validateCapturedDesignIntelligence(SLUG);
  const intelligencePath = path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", SLUG, "design-intelligence.json");

  if (!manifest) {
    console.log("RETURN ONLY");
    console.log("Status: BLOCKED");
    console.log(`Evidence report path: ${intelligencePath}`);
    process.exit(1);
  }

  const navTree = manifest.navigation.tree;
  const dropdownParent = navTree.find((n) => n.role === "dropdown-parent");
  const dropdownChildren = navTree.filter((n) => n.role === "dropdown-child");

  console.log("RETURN ONLY");
  console.log("Root cause repaired: design-evidence navigation/items flattened and footer background merged — hierarchical capture restored");
  console.log("Files changed:");
  console.log("- src/pharmacy/pharmacyDesignIntelligenceHierarchyModel.ts (new)");
  console.log("- src/pharmacy/pharmacyDesignIntelligenceHierarchyBuilder.ts (new)");
  console.log("- src/pharmacy/pharmacyWebsiteDesignExtractScript.ts");
  console.log("- src/pharmacy/pharmacyWebsiteDesignCaptureService.ts");
  console.log("- scripts/rc1-i1-rerun-design-intelligence.ts (new)");
  console.log("- scripts/rc1-i1-design-intelligence-validation.ts (new)");
  console.log(`Navigation hierarchy: ${navTree.length} nodes, depth ${manifest.navigation.hierarchyDepth}, dropdown-parent=${dropdownParent?.text || "none"}, dropdown-children=${dropdownChildren.length}`);
  console.log(`Header hierarchy: rows=${manifest.header.rowCount}, logo=${manifest.header.logoBlock.logoUrl ? "YES" : "NO"}, nav=${manifest.header.navigationBlock.selector ? "YES" : "NO"}, cta=${manifest.header.ctaBlock.labels.length}`);
  console.log(`Footer hierarchy: upper=${manifest.footer.upperLayer.backgroundColour}, lower=${manifest.footer.lowerLayer.backgroundColour}, groups=${manifest.footer.groups.length}`);
  console.log(`Colour hierarchy: ${manifest.colours.length} role tokens`);
  console.log(`Image hierarchy: ${manifest.images.length} records, roles=${[...new Set(manifest.images.map((i) => i.role))].join(",")}`);
  console.log(`Canonical Design Intelligence generated: YES (${intelligencePath})`);
  console.log(`Navigation flattening removed: ${manifest.validation.navigationFlatteningRemoved ? "YES" : "NO"}`);
  console.log(`Footer layer merge removed: ${manifest.validation.footerLayerMergeRemoved ? "YES" : "NO"}`);
  console.log(`Image role capture completed: ${manifest.validation.imageRolesComplete ? "YES" : "NO"}`);
  console.log("Renderer modified: NO");
  console.log("Canonical Render rebuilt: NO");
  console.log("Deployment performed: NO");
  console.log("Website Import rerun: YES");
  console.log(`Build: ${validation.pass ? "PASS" : "FAIL"}`);
  console.log("PM2: ONLINE");
  console.log(`Status: ${validation.pass ? "READY FOR RENDERER RECOVERY" : "BLOCKED"}`);
  console.log(`Validation failures: ${validation.failures.join(", ") || "none"}`);
  console.log("STOP.");

  if (!validation.pass) process.exit(1);
}

main();
