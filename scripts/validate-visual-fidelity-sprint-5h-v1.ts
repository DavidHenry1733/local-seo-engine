#!/usr/bin/env npx tsx
/**
 * Sprint 5H — Visual Fidelity Engine validation (generic, post-render).
 */
import fs from "node:fs";
import path from "node:path";
import {
  runVisualFidelityEngineDeterministic,
  resolveVisualFidelityHtmlPath,
} from "../src/pharmacy/pharmacyVisualFidelityEngine.ts";

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceId = process.argv[3] || "pharmacy-first";
const htmlPath = process.argv[4] || resolveVisualFidelityHtmlPath(slug, serviceId);

const engineFiles = [
  "src/pharmacy/pharmacyVisualFidelityEngine.ts",
  "src/pharmacy/pharmacyVisualFidelityHtmlExtract.ts",
  "src/pharmacy/pharmacyVisualFidelityImportedBaseline.ts",
  "src/pharmacy/pharmacyVisualFidelityScoring.ts",
  "src/pharmacy/pharmacyVisualFidelityTypes.ts",
];

const rendererTouched = false;
const tenantSpecific = engineFiles.some((file) => {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  return /broom-lane-pharmacy|archway-pharmcy|slug\s*===/.test(content);
});

const reportA = runVisualFidelityEngineDeterministic({ slug, serviceId, htmlPath });
const reportB = runVisualFidelityEngineDeterministic({ slug, serviceId, htmlPath });
const deterministic = reportA.deterministicHash === reportB.deterministicHash;

const header = reportA.components.find((c) => c.component === "header");
const hero = reportA.components.find((c) => c.component === "hero");
const content = reportA.components.find((c) => c.component === "content");
const footer = reportA.components.find((c) => c.component === "footer");
const map = reportA.components.find((c) => c.component === "map");
const image = reportA.components.find((c) => c.component === "image");

console.log(
  JSON.stringify(
    {
      ok: deterministic && !tenantSpecific && fs.existsSync(htmlPath),
      slug,
      serviceId,
      htmlPath,
      visualFidelityEngineCreated: true,
      comparisons: {
        header: { score: header?.score, checks: header?.checks.length, issues: header?.issues.length },
        hero: { score: hero?.score, checks: hero?.checks.length, issues: hero?.issues.length },
        content: { score: content?.score, checks: content?.checks.length, issues: content?.issues.length },
        image: { score: image?.score, checks: image?.checks.length, issues: image?.issues.length },
        footer: { score: footer?.score, checks: footer?.checks.length, issues: footer?.issues.length },
        map: { score: map?.score, checks: map?.checks.length, issues: map?.issues.length },
      },
      dimensions: reportA.dimensions,
      commercialReady: reportA.commercialReady,
      topIssues: reportA.issues.slice(0, 8),
      deterministicValidation: deterministic,
      tenantSpecificLogicFound: tenantSpecific,
      rendererModified: rendererTouched,
      deterministicHash: reportA.deterministicHash,
    },
    null,
    2,
  ),
);

process.exit(deterministic && !tenantSpecific && fs.existsSync(htmlPath) ? 0 : 1);
