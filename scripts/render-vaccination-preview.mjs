#!/usr/bin/env node
import { renderVaccinationHubPage, renderVaccinationClusterPage } from "../src/pharmacy/templates/renderVaccinationService.ts";
import { renderFamilyPreview } from "./lib/pharmacy-family-preview.mjs";

const result = renderFamilyPreview({
  templateKey: "vaccination-services",
  serviceKey: "nhs-flu-vaccination",
  renderHub: renderVaccinationHubPage,
  renderCluster: renderVaccinationClusterPage,
});

console.log(result.pass ? "PASS" : "FAIL", "vaccination-services", result.pageCount, "pages");
if (result.issues.length) console.error(result.issues.join(", "));
process.exit(result.pass ? 0 : 1);
