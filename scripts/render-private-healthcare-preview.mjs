#!/usr/bin/env node
import { renderPrivateHealthcareHubPage, renderPrivateHealthcareClusterPage } from "../src/pharmacy/templates/renderPrivateHealthcareService.ts";
import { renderFamilyPreview } from "./lib/pharmacy-family-preview.mjs";

const result = renderFamilyPreview({
  templateKey: "private-healthcare-services",
  serviceKey: "private-ear-wax-removal",
  renderHub: renderPrivateHealthcareHubPage,
  renderCluster: renderPrivateHealthcareClusterPage,
});

console.log(result.pass ? "PASS" : "FAIL", "private-healthcare-services", result.pageCount, "pages");
if (result.issues.length) console.error(result.issues.join(", "));
process.exit(result.pass ? 0 : 1);
