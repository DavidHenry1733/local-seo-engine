/**
 * buildClusterConfigsExample.ts
 *
 * Demonstrates the full bridge from area engine output to cluster page
 * config objects using two Sheffield areas.
 *
 * Run:
 *   pnpm exec tsx src/generator/buildClusterConfigsExample.ts
 *
 * This script does NOT write any files to disk and does NOT call the AI.
 * It shows the SelectedAreaPageDef and ClusterConfigEnriched objects that
 * would be written / passed to the generator.
 */

import { runAreaEngine }     from "../area/areaEngine";
import {
  buildSelectedAreaDef,
  buildClusterConfig,
  buildAllSelectedAreaDefs,
  deriveKeywords,
} from "./buildClusterConfigs";

// ── 1. Run the area engine ────────────────────────────────────────────────────

const engineOutput = runAreaEngine({
  cityName:          "Sheffield",
  serviceName:       "Web Design",
  maxPriorityAreas:  5,
  maxSecondaryAreas: 4,
});

// Project identifiers — in production these come from config/projects/*.json
const PROJECT_DOMAIN = "https://local.inboxingproweb.com";
const CLIENT_SLUG    = "inboxingproweb-local";

// ── 2. Two selected areas (one priority, one secondary) ───────────────────────

const SELECTED_AREAS = ["Ecclesall", "Hillsborough"];

// ── 3. Build SelectedAreaPageDef for each selected area ───────────────────────

console.log("═══════════════════════════════════════════════════════════");
console.log("  Cluster Config Builder — Area Engine Integration Demo");
console.log("═══════════════════════════════════════════════════════════\n");

// Show the ranked context for transparency
console.log("── Area Engine Rankings (Sheffield) ──────────────────────");
for (const r of engineOutput.rankedAreas) {
  const marker = SELECTED_AREAS.includes(r.area) ? " ◄ selected" : "";
  console.log(
    `  ${String(r.rank).padEnd(3)} ${r.area.padEnd(26)} ${String(r.score).padEnd(5)} ${r.tier}${marker}`
  );
}

// ── 4. Build defs for all selected areas (sorted priority-first) ──────────────

const defs = buildAllSelectedAreaDefs(
  SELECTED_AREAS,
  engineOutput,
  PROJECT_DOMAIN,
  CLIENT_SLUG
);

// ── 5. Log each def and its resulting cluster config ──────────────────────────

for (const def of defs) {
  const config = buildClusterConfig(def);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  AREA: ${def.area}  |  TIER: ${def.tier}  |  SCORE: ${
    engineOutput.rankedAreas.find((r) => r.area === def.area)?.score ?? "—"
  }`);
  console.log("═".repeat(60));

  // ── SelectedAreaPageDef summary ──────────────────────────────────────────
  console.log("\n── SelectedAreaPageDef ───────────────────────────────────");
  console.log(`  area             : ${def.area}`);
  console.log(`  city             : ${def.city}`);
  console.log(`  service          : ${def.service}`);
  console.log(`  tier             : ${def.tier}`);
  console.log(`  primaryKeyword   : ${def.primaryKeyword}`);
  console.log(`  supportingKws    :`);
  def.supportingKeywords.forEach((kw) => console.log(`    · ${kw}`));
  console.log(`  hubUrl           : ${def.hubUrl}`);
  console.log(`  hubAnchor        : ${def.hubAnchor}`);
  console.log(`  relatedPages     : ${def.relatedPages}`);
  console.log(`  remotePath       : ${def.remotePath}`);
  console.log(`  configPath       : ${def.configPath}`);

  // ── Content signals summary ──────────────────────────────────────────────
  console.log("\n── Area Content Signals ──────────────────────────────────");
  console.log(`  affluence        : ${def.signals.affluence}`);
  console.log(`  localContext     :\n    "${def.signals.localContext}"`);
  console.log(`  demandNote       :\n    "${def.signals.demandNote}"`);
  console.log(`  competitionNote  :\n    "${def.signals.competitionNote}"`);
  console.log(`  competitorAngle  :\n    "${def.signals.competitorAngle}"`);
  console.log(`  messagingRegister:\n    "${def.signals.messagingRegister}"`);
  console.log(`  landmarks        : ${def.signals.landmarks.join(", ")}`);

  // ── Cluster config (what gets written to disk) ───────────────────────────
  console.log("\n── ClusterConfigEnriched (disk format) ───────────────────");
  // Print without areaSignals for readability (signals shown above)
  const { areaSignals: _omit, ...rest } = config;
  console.log(JSON.stringify(rest, null, 2));

  // ── Prompt context block (what gets appended to the cluster prompt) ────────
  console.log("\n── Prompt Area Context Block ─────────────────────────────");
  const s = def.signals;
  console.log(
    `LOCAL AREA CONTEXT (use this to localise copy — do not repeat verbatim):\n\n` +
    `Local context    : ${s.localContext}\n` +
    `Demand note      : ${s.demandNote}\n` +
    `Competition note : ${s.competitionNote}\n` +
    `Competitor angle : ${s.competitorAngle}\n` +
    `Messaging        : ${s.messagingRegister}\n` +
    `Landmarks        : ${s.landmarks.join(", ")}`
  );
}

// ── 6. Full JSON output ───────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log("  Full JSON — SelectedAreaPageDef objects");
console.log("═".repeat(60));
console.log(JSON.stringify(defs, null, 2));

// ── 7. Quick keyword derivation check ────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log("  Keyword Derivation Check — all 12 Sheffield areas");
console.log("═".repeat(60));

for (const { area } of engineOutput.rankedAreas) {
  const signals = engineOutput.contentSignals[area]!;
  const kws     = deriveKeywords("Web Design", area, signals);
  console.log(`\n  ${area}`);
  kws.forEach((kw) => console.log(`    · ${kw}`));
}
