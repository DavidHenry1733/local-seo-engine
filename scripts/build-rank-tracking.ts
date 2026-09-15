import { buildGscRankTracking, type GscRankTrackingRecord } from "../src/tracking/gscRankTrackingEngine";

const projectSlug = process.argv[2] || "inboxingproweb";

function argNumber(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return fallback;
  const parsed = Number(arg.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function pos(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function line(record: GscRankTrackingRecord): string {
  return `${record.keyword} -> ${record.url} | ${record.impressions} impressions, ${record.clicks} clicks, CTR ${pct(record.ctr)}, avg position ${pos(record.averagePosition)}`;
}

const report = await buildGscRankTracking(projectSlug, {
  outputDir: "output",
  days: argNumber("days", 90),
  rowLimit: argNumber("row-limit", 25000),
});

console.log("PASS: GSC rank tracking data layer generated");
console.log(`Project: ${report.projectSlug}`);
console.log(`Output: ${report.outputPath}`);
if (report.backupPath) console.log(`Backup: ${report.backupPath}`);
console.log(`Property: ${report.searchAnalytics.property ?? "—"}`);
console.log(`Date range: ${report.dateRange.startDate} to ${report.dateRange.endDate}`);
console.log(`Records count: ${report.summary.recordsCount}`);
console.log(`Keywords count: ${report.summary.keywordsCount}`);
console.log(`URLs count: ${report.summary.urlsCount}`);
console.log(`Total clicks: ${report.summary.totalClicks}`);
console.log(`Total impressions: ${report.summary.totalImpressions}`);
console.log(`Average position: ${pos(report.summary.averagePosition)}`);
console.log(`New keywords: ${report.summary.newKeywords}`);
console.log(`Improved keywords: ${report.summary.improvedKeywords}`);
console.log(`Dropped keywords: ${report.summary.droppedKeywords}`);

console.log("Top 10 keywords by impressions:");
for (const record of report.topKeywordsByImpressions) {
  console.log(`- ${line(record)}`);
}

console.log("Top 10 keywords by clicks:");
for (const record of report.topKeywordsByClicks) {
  console.log(`- ${line(record)}`);
}

console.log("Top 10 ranking opportunities:");
for (const record of report.topRankingOpportunities) {
  console.log(`- ${line(record)}`);
}
