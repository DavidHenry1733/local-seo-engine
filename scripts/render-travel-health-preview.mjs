#!/usr/bin/env node
import { renderTravelHealthHubPage, renderTravelHealthClusterPage } from "../src/pharmacy/templates/renderTravelHealthService.ts";
import { renderFamilyPreview } from "./lib/pharmacy-family-preview.mjs";

const result = renderFamilyPreview({
  templateKey: "travel-health-services",
  serviceKey: "travel-vaccinations",
  renderHub: renderTravelHealthHubPage,
  renderCluster: renderTravelHealthClusterPage,
});

console.log(result.pass ? "PASS" : "FAIL", "travel-health-services", result.pageCount, "pages");
if (result.issues.length) console.error(result.issues.join(", "));
process.exit(result.pass ? 0 : 1);
