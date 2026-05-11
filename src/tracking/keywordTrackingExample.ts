/**
 * Keyword Tracking Engine — example usage
 *
 * Run (print existing report):
 *   pnpm exec tsx src/tracking/keywordTrackingExample.ts
 *
 * Run (fresh check):
 *   pnpm exec tsx src/tracking/keywordTrackingExample.ts --run
 *
 * ─── What this does ───────────────────────────────────────────────────────────
 *
 * 1. Loads keyword → URL pairs from output/rotherham-proof/selected-area-defs.json
 * 2. For each keyword, fetches a Google search (100 results) and finds position
 * 3. Computes position change vs previous run
 * 4. Writes output/rotherham-proof/keyword-tracking.json
 * 5. Prints a ranked summary table
 *
 * ─── Notes ────────────────────────────────────────────────────────────────────
 *
 * - New pages typically take 2–8 weeks to appear in rankings after indexing
 * - Run weekly or fortnightly — daily checks risk rate-limiting
 * - Position > 20 is still valuable to track (improvement over time)
 * - Does NOT use the Google Indexing / Search Console API
 */

import {
  runKeywordTracking,
  readKeywordReport,
  loadKeywordTargets,
} from "./keywordTrackingEngine";
import type { KeywordRecord } from "./keywordTrackingTypes";

const PROJECT_SLUG = "rotherham-proof";

function changeLabel(r: KeywordRecord): string {
  if (r.change === null) {
    return r.previousPosition === null && r.position !== null ? "NEW" : "—";
  }
  if (r.change > 0) return `↑${r.change}`;
  if (r.change < 0) return `↓${Math.abs(r.change)}`;
  return "→";
}

function posLabel(pos: number | null): string {
  return pos !== null ? `#${String(pos).padStart(3)}` : " n/a";
}

async function main(): Promise<void> {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  KEYWORD TRACKING ENGINE — Rotherham proof");
  console.log("════════════════════════════════════════════════════════════\n");

  const runCheck = process.argv.includes("--run");

  if (runCheck) {
    const targets = loadKeywordTargets(PROJECT_SLUG);
    console.log(`── Found ${targets.length} keyword targets\n`);
    for (const t of targets) {
      console.log(`   "${t.keyword}" → ${t.targetUrl}`);
    }
    console.log(`\n── Running checks (limit=20, delay=2500ms)…\n`);

    const report = await runKeywordTracking(PROJECT_SLUG, null, {
      limit:   20,
      delayMs: 2500,
    });

    console.log(`\n── Run completed at: ${report.runAt}`);
    console.log(`   Keywords checked  : ${report.totalKeywords}`);
    console.log(`   Ranked in top 100 : ${report.ranked}`);
    console.log(`   Improved          : ${report.improved}`);
    console.log(`   Dropped           : ${report.dropped}`);
    console.log(`   New rankings      : ${report.newRankings}`);

    console.log("\n── Keyword ranking table:\n");
    const w = 45;
    console.log(`  ${"Keyword".padEnd(w)}  Pos     Change  URL`);
    console.log(`  ${"─".repeat(w)}  ──────  ──────  ─────`);
    for (const r of report.records) {
      const kw  = r.keyword.padEnd(w);
      const pos = posLabel(r.position);
      const ch  = changeLabel(r).padStart(6);
      console.log(`  ${kw}  ${pos}  ${ch}  ${r.targetUrl}`);
    }
  } else {
    const report = readKeywordReport(PROJECT_SLUG);

    if (!report) {
      console.log("No tracking data found. Run with --run to perform a check:");
      console.log("  pnpm exec tsx src/tracking/keywordTrackingExample.ts --run\n");
      return;
    }

    console.log(`── Last run       : ${report.runAt}`);
    console.log(`── Total keywords : ${report.totalKeywords}`);
    console.log(`── Ranked top 100 : ${report.ranked}`);
    console.log(`── Improved       : ${report.improved}`);
    console.log(`── Dropped        : ${report.dropped}`);
    console.log(`── New rankings   : ${report.newRankings}`);
    console.log("\n── Keyword table:\n");

    const w = 45;
    console.log(`  ${"Keyword".padEnd(w)}  Pos     Change  URL`);
    console.log(`  ${"─".repeat(w)}  ──────  ──────  ─────`);
    for (const r of report.records) {
      const kw  = r.keyword.padEnd(w);
      const pos = posLabel(r.position);
      const ch  = changeLabel(r).padStart(6);
      console.log(`  ${kw}  ${pos}  ${ch}  ${r.targetUrl}`);
    }
  }

  console.log("\n── Notes:");
  console.log("   - New pages typically take 2–8 weeks to rank");
  console.log("   - Run weekly for best tracking accuracy");
  console.log("   - Use /api/keyword-tracking/run to trigger from the dashboard\n");
}

main().catch(e => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
