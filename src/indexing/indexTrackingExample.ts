/**
 * Index Tracking Engine — example usage
 *
 * Run:  pnpm exec tsx src/indexing/indexTrackingExample.ts
 *
 * ─── What this does ───────────────────────────────────────────────────────────
 *
 * 1. Reads URL list from output/rotherham-proof/sitemap.xml
 * 2. For each URL, performs a Google `site:URL` search (with delay)
 * 3. Determines whether the page is indexed or not
 * 4. Writes results to output/rotherham-proof/index-tracking.json
 * 5. Prints a summary table to stdout
 *
 * ─── Safety notes ─────────────────────────────────────────────────────────────
 *
 * - Default: checks up to 10 URLs per run with 2.5 s delay between requests
 * - Does NOT use the Google Indexing API (reserved for JobPosting/BroadcastEvent)
 * - Pages typically take 1–4 weeks to be indexed after sitemap submission
 * - Run this check periodically (e.g. weekly), not on every deploy
 *
 * ─── Integration notes ────────────────────────────────────────────────────────
 *
 * Call runIndexTracking() after sitemap is deployed and submitted.
 * Results are available via the API:
 *   GET  /api/index-tracking?projectSlug=rotherham-proof
 *   POST /api/index-tracking/run   { projectSlug, limit, delayMs }
 */

import { runIndexTracking, readTrackingReport } from "./indexTrackingEngine";

const PROJECT_SLUG = "inboxingproweb";

const STATUS_ICON: Record<string, string> = {
  indexed:     "✓",
  not_indexed: "✗",
  unknown:     "?",
};

async function main(): Promise<void> {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  INDEX TRACKING ENGINE — Rotherham proof");
  console.log("════════════════════════════════════════════════════════════\n");

  // Option A: run a fresh check
  const runCheck = process.argv.includes("--run");

  if (runCheck) {
    console.log("── Running index check (limit=10, delay=2500ms)…\n");
    const report = await runIndexTracking(PROJECT_SLUG, { limit: 10, delayMs: 2500 });

    console.log(`\n── Run completed at: ${report.runAt}`);
    console.log(`   URLs checked   : ${report.totalChecked}`);
    console.log(`   Indexed        : ${report.indexedCount}`);
    console.log(`   Not indexed    : ${report.notIndexedCount}`);
    console.log(`   Unknown        : ${report.unknownCount}`);

    console.log("\n── Page-level results:\n");
    const col = 60;
    for (const r of report.records) {
      const icon    = STATUS_ICON[r.status] ?? "?";
      const padded  = r.url.padEnd(col);
      const first   = r.firstDetectedIndexedAt
        ? `  (first indexed: ${r.firstDetectedIndexedAt.slice(0, 10)})`
        : "";
      console.log(`  ${icon}  ${padded}  ${r.status}${first}`);
    }

    if (report.notIndexedCount > 0) {
      console.log("\n── Not-indexed URLs (submit sitemap or wait):");
      report.records
        .filter(r => r.status === "not_indexed")
        .forEach(r => console.log(`     ${r.url}`));
    }
  } else {
    // Option B: just print existing report
    const report = readTrackingReport(PROJECT_SLUG);

    if (!report) {
      console.log("No tracking data found. Run with --run to perform a check:");
      console.log("  pnpm exec tsx src/indexing/indexTrackingExample.ts --run\n");
      return;
    }

    console.log(`── Last run : ${report.runAt}`);
    console.log(`── Indexed  : ${report.indexedCount} / ${report.records.length}`);
    console.log(`── Not yet  : ${report.notIndexedCount}`);
    console.log(`── Unknown  : ${report.unknownCount}`);
    console.log("\n── Page-level results:\n");

    const col = 60;
    for (const r of report.records) {
      const icon   = STATUS_ICON[r.status] ?? "?";
      const padded = r.url.padEnd(col);
      console.log(`  ${icon}  ${padded}  ${r.status}`);
    }
  }

  console.log("\n── Next steps:");
  console.log("   - Run weekly to track indexing progress");
  console.log("   - Pages typically appear within 1–4 weeks of sitemap submission");
  console.log("   - Use /api/index-tracking/run to trigger from the dashboard\n");
}

main().catch(e => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
