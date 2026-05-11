/**
 * qaExample.ts
 *
 * Example usage of validatePage() — the QA validator entry point.
 *
 * Run with:
 *   pnpm exec tsx src/validate/qaExample.ts
 */

import fs from "node:fs";
import path from "node:path";
import { validatePage } from "./qaValidator";
import type { QaValidatorInput } from "./qaTypes";

// ── Build a sample input from real project files ──────────────────────────────

const projectPath = path.resolve("config/projects/inboxingproweb-local.json");
const clusterPath = path.resolve("config/clusters/inboxingproweb-web-design-ecclesall.json");
const htmlPath    = path.resolve("output/inboxingproweb-local/ecclesall/index.html");

const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
const cluster = JSON.parse(fs.readFileSync(clusterPath, "utf8"));
const html    = fs.readFileSync(htmlPath, "utf8");

const input: QaValidatorInput = {
  html,
  pageType:           "cluster",
  brandName:          project.businessName,
  legalName:          project.footerCompanyName,
  companyNumber:      project.footerCompanyNumber,
  addressLines:       (project.businessAddress as string).split(", "),
  email:              project.email,
  privacyUrl:         project.privacyUrl,
  termsUrl:           project.termsUrl,
  primaryKeyword:     cluster.primaryKeyword,
  supportingKeywords: cluster.supportingKeywords ?? [],
  hubPageUrl:         cluster.hubUrl,
  relatedClusterUrls: cluster.relatedPages
    ? (cluster.relatedPages as string).split(",").map((s: string) => `/${s.trim().toLowerCase().replace(/\s+/g, "-")}/`)
    : [],
  supportingPageUrls: project.navItems?.map((n: { href: string }) => n.href) ?? [],
};

// ── Run validation and log the result ─────────────────────────────────────────

const report = validatePage(input);

console.log(JSON.stringify(report, null, 2));
console.log(`\nResult: ${report.passed ? "PASSED" : "FAILED"}  Score: ${report.score}%`);
