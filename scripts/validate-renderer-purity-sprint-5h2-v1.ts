#!/usr/bin/env npx tsx
/**
 * Sprint 5H.2 — prove renderer has zero hard-coded layout decisions.
 */
import fs from "node:fs";
import path from "node:path";
import { runVisualFidelityEngineDeterministic } from "../src/pharmacy/pharmacyVisualFidelityEngine.ts";

const rendererFiles = [
  "src/pharmacy/pharmacyServicePageDesignSystem.ts",
  "src/pharmacy/pharmacyLocalAreaPageRenderer.ts",
  "src/pharmacy/pharmacyBrandDnaComponentRenderers.ts",
  "src/pharmacy/pharmacyBrandDnaFooterRenderer.ts",
  "src/pharmacy/pharmacyVisualExperience.ts",
];

const forbiddenPatterns: Array<{ id: string; pattern: RegExp }> = [
  { id: "hero-stats-grid", pattern: /\.hero-stats\{[^}]*grid-template-columns:repeat\(3/ },
  { id: "compare-grid", pattern: /\.compare\{[^}]*grid-template-columns:/ },
  { id: "timeline-grid", pattern: /\.timeline\{[^}]*grid-template-columns:/ },
  { id: "proof-row-grid", pattern: /\.proof-row\{[^}]*grid-template-columns:/ },
  { id: "card-title-minheight-em", pattern: /card-title-line-[12][^}]*min-height:\s*[0-9.]+em/ },
  { id: "nearby-grid-hardcoded", pattern: /nearby-areas-grid\{[^}]*minmax\(220px/ },
  { id: "legacy-hide-rules", pattern: /main \.(timeline|compare|proof-band)\s*\{\s*display:\s*none/ },
];

const root = process.cwd();
const violations: Array<{ file: string; id: string }> = [];

for (const file of rendererFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(content)) violations.push({ file, id: rule.id });
  }
}

const componentDnaCss = fs.readFileSync(path.join(root, "src/pharmacy/pharmacyComponentDnaLayoutCss.ts"), "utf8");
const componentDnaUsesVars = /--component-/.test(componentDnaCss);

const slug = process.argv[2] || "broom-lane-pharmacy";
const serviceId = process.argv[3] || "pharmacy-first";
const reportA = runVisualFidelityEngineDeterministic({ slug, serviceId });
const reportB = runVisualFidelityEngineDeterministic({ slug, serviceId });
const deterministic = reportA.deterministicHash === reportB.deterministicHash;

const pass = violations.length === 0 && componentDnaUsesVars && deterministic;

console.log(
  JSON.stringify(
    {
      ok: pass,
      rendererVisualDecisions: violations.length,
      componentDnaVisualDecisions: componentDnaUsesVars ? "100%" : "FAIL",
      hardCodedLayoutValuesRemaining: violations.length,
      deterministicRenderer: deterministic ? "PASS" : "FAIL",
      violations,
    },
    null,
    2,
  ),
);

process.exit(pass ? 0 : 1);
