/**
 * areaExample.ts
 *
 * Demonstrates the area engine against the Sheffield dataset.
 *
 * Run:
 *   pnpm exec tsx src/area/areaExample.ts
 */

import { runAreaEngine, getAreaSignals, getRankedAreas } from "./areaEngine";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Run the full engine
// ══════════════════════════════════════════════════════════════════════════════

const result = runAreaEngine({
  cityName:          "Sheffield",
  serviceName:       "Web Design",
  maxPriorityAreas:  5,
  maxSecondaryAreas: 4,
});

// ── Header ────────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════");
console.log(`  Area Engine — ${result.city}, ${result.region}`);
console.log(`  Service     : ${result.serviceName}`);
console.log(`  Areas       : ${result.rankedAreas.length}`);
console.log("═══════════════════════════════════════════════════════════\n");

// ── Ranked areas ──────────────────────────────────────────────────────────────

console.log("── 1. Ranked Areas (by opportunity score) ────────────────");
console.log(
  `  ${"Rank".padEnd(5)}${"Area".padEnd(24)}${"Score".padEnd(7)}Tier`
);
console.log("  " + "─".repeat(50));

for (const area of result.rankedAreas) {
  const tier =
    area.tier === "priority"  ? "▲ Priority"  :
    area.tier === "secondary" ? "◆ Secondary" :
                                "· Tertiary";
  console.log(
    `  ${String(area.rank).padEnd(5)}${area.area.padEnd(24)}${String(area.score).padEnd(7)}${tier}`
  );
}

// ── Coverage report ───────────────────────────────────────────────────────────

const report = result.coverageReport;
console.log("\n── 2. Coverage Report ────────────────────────────────────");
console.log(`  Total areas       : ${report.totalAreas}`);
console.log(`  Priority tier     : ${report.priorityAreas.join(", ") || "none"}`);
console.log(`  Secondary tier    : ${report.secondaryAreas.join(", ") || "none"}`);
console.log(`  Tertiary tier     : ${report.tertiaryAreas.join(", ") || "none"}`);

if (report.uncoveredHighDemand.length > 0) {
  console.log(`\n  ⚠  High-demand areas not in priority tier:`);
  report.uncoveredHighDemand.forEach((a) => console.log(`       · ${a}`));
}

console.log("\n  Recommendations:");
report.recommendations.forEach((r) => console.log(`    → ${r}`));

// ── Related area map ──────────────────────────────────────────────────────────

console.log("\n── 3. Related Area Map (for internal linking) ────────────");
const topAreas = result.rankedAreas.filter((a) => a.tier === "priority").map((a) => a.area);

for (const area of topAreas) {
  const related = result.relatedAreaMap[area] ?? [];
  console.log(`  ${area.padEnd(24)} → ${related.join(", ")}`);
}

// ── Content signals for the top-ranked area ───────────────────────────────────

const topArea = result.rankedAreas[0]!.area;
const signals = result.contentSignals[topArea]!;

console.log(`\n── 4. Content Signals — ${topArea} ─────────────────────────`);
console.log(`  Postcode         : ${signals.postcode}`);
console.log(`  Character        : ${signals.character}`);
console.log(`  Known for        : ${signals.knownFor}`);
console.log(`  Business type    : ${signals.businessType}`);
console.log(`  Affluence        : ${signals.affluence}`);
console.log(`  Landmarks        : ${signals.landmarks.join(", ")}`);
console.log(`  Nearby areas     : ${signals.nearbyAreas.join(", ")}`);
console.log(`\n  Local context:`);
console.log(`    "${signals.localContext}"`);
console.log(`\n  Demand note:`);
console.log(`    "${signals.demandNote}"`);
console.log(`\n  Competition note:`);
console.log(`    "${signals.competitionNote}"`);
console.log(`\n  Competitor angle:`);
console.log(`    "${signals.competitorAngle}"`);
console.log(`\n  Messaging register:`);
console.log(`    "${signals.messagingRegister}"`);

// ══════════════════════════════════════════════════════════════════════════════
// 2. Convenience helper — single-area signals
// ══════════════════════════════════════════════════════════════════════════════

console.log("\n── 5. getAreaSignals() — Ecclesall standalone ────────────");
const ecclesallSignals = getAreaSignals("Sheffield", "Ecclesall", "Web Design");
console.log(`  Area     : ${ecclesallSignals.area}`);
console.log(`  Context  : ${ecclesallSignals.localContext}`);
console.log(`  Register : ${ecclesallSignals.messagingRegister}`);

// ══════════════════════════════════════════════════════════════════════════════
// 3. Convenience helper — lightweight ranking only
// ══════════════════════════════════════════════════════════════════════════════

console.log("\n── 6. getRankedAreas() — top 5 only ──────────────────────");
const top5 = getRankedAreas("Sheffield", "Web Design", undefined, 5, 0);
top5.filter((a) => a.tier === "priority").forEach((a) =>
  console.log(`  #${a.rank} ${a.area} (score: ${a.score})`)
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. Full JSON output
// ══════════════════════════════════════════════════════════════════════════════

console.log("\n── 7. Full engine output (JSON) ──────────────────────────");
console.log(JSON.stringify(result, null, 2));
