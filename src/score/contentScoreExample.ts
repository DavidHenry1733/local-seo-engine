/**
 * contentScoreExample.ts
 *
 * Example usage of scoreContent() — the content scoring engine entry point.
 * Runs the scorer on a generated page and logs the full report as JSON.
 *
 * Run with:
 *   pnpm exec tsx src/score/contentScoreExample.ts
 */

import fs   from "node:fs";
import path from "node:path";
import { scoreContent } from "./contentScorer";
import type { ContentScoreInput } from "./contentScoreTypes";

// ── Load real project + cluster configs ───────────────────────────────────────

const projectPath = path.resolve("config/projects/inboxingproweb-local.json");
const clusterPath = path.resolve("config/clusters/inboxingproweb-web-design-ecclesall.json");
const htmlPath    = path.resolve("output/inboxingproweb-local/ecclesall/index.html");

const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
const cluster = JSON.parse(fs.readFileSync(clusterPath, "utf8"));
const html    = fs.readFileSync(htmlPath, "utf8");

// ── Build input ───────────────────────────────────────────────────────────────

const input: ContentScoreInput = {
  html,
  pageType:           "cluster",
  primaryKeyword:     cluster.primaryKeyword,
  supportingKeywords: cluster.supportingKeywords ?? [],
  location:           cluster.location ?? cluster.primaryKeyword.split(" ").pop() ?? "",
  serviceName:        cluster.serviceName ?? project.services?.[0]?.label ?? "Web Design",
};

// ── Run scorer and log full report ────────────────────────────────────────────

const report = scoreContent(input);

console.log(JSON.stringify(report, null, 2));

console.log(`
──────────────────────────────────────────
Overall Score : ${report.overallScore}%
Rating        : ${report.rating}
Passed        : ${report.passed}
──────────────────────────────────────────`);
