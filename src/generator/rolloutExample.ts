/**
 * rolloutExample.ts
 *
 * Demonstrates the full area rollout pipeline using Sheffield / Web Design
 * with three representative areas — one from each tier.
 *
 * Runs in dry-run mode: cluster configs are written to disk but no AI calls
 * or FTP uploads are made. Use this to verify rollout ordering, config
 * correctness, deferred queue output, and log structure.
 *
 * Run:
 *   pnpm exec tsx src/generator/rolloutExample.ts
 *
 * Output files written:
 *   config/clusters/inboxingproweb-local-web-design-ecclesall.json   (priority)
 *   config/clusters/inboxingproweb-local-web-design-hillsborough.json (secondary)
 *   output/inboxingproweb-local/deferred-areas.json                  (Woodseats deferred)
 *   output/inboxingproweb-local/rollout-log.json                     (run summary)
 */

import fs from "node:fs";

import { runAreaEngine }          from "../area/areaEngine";
import { buildAllSelectedAreaDefs } from "./buildClusterConfigs";
import { runAreaRollout }           from "./rolloutRunner";
import type { RenderProjectConfig } from "./renderClusterPage";

// ── 1. Load project config ────────────────────────────────────────────────────

const projectPath = "config/projects/inboxingproweb-local.json";
if (!fs.existsSync(projectPath)) {
  console.error(`Project config not found: ${projectPath}`);
  process.exit(1);
}
const project = JSON.parse(
  fs.readFileSync(projectPath, "utf8")
) as RenderProjectConfig;

// ── 2. Run the area engine ────────────────────────────────────────────────────

console.log("Running area engine for Sheffield / Web Design…");
const engine = runAreaEngine({
  cityName:          "Sheffield",
  serviceName:       "Web Design",
  maxPriorityAreas:  5,
  maxSecondaryAreas: 4,
});

console.log("\nRanked areas:");
for (const r of engine.rankedAreas) {
  console.log(
    `  ${String(r.rank).padEnd(3)} ${r.area.padEnd(26)} score ${String(r.score).padEnd(4)} ${r.tier}`
  );
}

// ── 3. Select three areas — one per tier ──────────────────────────────────────
//
//   Ecclesall  → rank 1  — priority
//   Hillsborough → rank 7 — secondary
//   Woodseats    → rank 10 — tertiary

const selectedAreaNames = ["Ecclesall", "Hillsborough", "Woodseats"];

const defs = buildAllSelectedAreaDefs(
  selectedAreaNames,
  engine,
  project.domain,
  project.clientSlug
);

console.log("\nSelected defs (sorted priority-first):");
for (const d of defs) {
  console.log(`  ${d.area.padEnd(16)} tier=${d.tier}   keyword="${d.primaryKeyword}"`);
}

// ── 4–6. Run the rollout and print results ────────────────────────────────────

async function main(): Promise<void> {
  // Run in dry-run mode:
  //   includeSecondary: true  → Hillsborough is generated (not deferred)
  //   dryRun:           true  → configs written, no AI or FTP
  //   deferTertiary:    true  → Woodseats written to deferred queue
  const log = await runAreaRollout(defs, project, {
    includeSecondary: true,
    dryRun:           true,
    deferTertiary:    true,
  });

  // ── 5. Print the full rollout log ──────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Rollout Log (JSON)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(JSON.stringify(log, null, 2));

  // ── 6. Confirm written files ───────────────────────────────────────────────
  console.log("\n── Written files ─────────────────────────────────────────");
  for (const entry of log.entries) {
    if (entry.configPath) {
      const exists = fs.existsSync(entry.configPath);
      console.log(
        `  ${entry.area.padEnd(16)} ${entry.tier.padEnd(10)} ` +
        `config=${exists ? "✓" : "✗"}  status=${entry.status}`
      );
    }
  }

  const deferredFile = `output/${project.clientSlug}/deferred-areas.json`;
  const logFile      = `output/${project.clientSlug}/rollout-log.json`;
  console.log(`\n  Deferred queue: ${fs.existsSync(deferredFile) ? "✓" : "✗"}  ${deferredFile}`);
  console.log(`  Rollout log:    ${fs.existsSync(logFile)       ? "✓" : "✗"}  ${logFile}`);
}

main().catch((err) => {
  console.error("Rollout example failed:", err.message);
  process.exit(1);
});
