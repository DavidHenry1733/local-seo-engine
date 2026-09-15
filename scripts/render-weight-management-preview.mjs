#!/usr/bin/env node
import { renderWeightManagementHubPage, renderWeightManagementClusterPage } from "../src/pharmacy/templates/renderWeightManagementService.ts";
import { renderFamilyPreview } from "./lib/pharmacy-family-preview.mjs";

const result = renderFamilyPreview({
  templateKey: "weight-management-services",
  serviceKey: "pharmacy-weight-loss-programme",
  renderHub: renderWeightManagementHubPage,
  renderCluster: renderWeightManagementClusterPage,
});

console.log(result.pass ? "PASS" : "FAIL", "weight-management-services", result.pageCount, "pages");
if (result.issues.length) console.error(result.issues.join(", "));
process.exit(result.pass ? 0 : 1);
