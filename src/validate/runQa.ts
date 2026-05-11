/**
 * runQa.ts — CLI runner for the QA validator
 *
 * Usage:
 *   pnpm exec tsx src/validate/runQa.ts <html-file> <hub|cluster> <project-config.json> [cluster-config.json]
 *
 * Examples:
 *   pnpm exec tsx src/validate/runQa.ts \
 *     output/inboxingproweb-local/index.html hub \
 *     config/projects/inboxingproweb-local.json
 *
 *   pnpm exec tsx src/validate/runQa.ts \
 *     output/inboxingproweb-local/ecclesall/index.html cluster \
 *     config/projects/inboxingproweb-local.json \
 *     config/clusters/inboxingproweb-web-design-ecclesall.json
 */

import fs   from "node:fs";
import path from "node:path";
import { validatePage }              from "./qaValidator";
import type { QaCheck, QaValidatorInput } from "./qaTypes";

// ── ANSI colour helpers ───────────────────────────────────────────────────────

const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const RESET  = "\x1b[0m";

function statusIcon(status: QaCheck["status"]): string {
  if (status === "pass")    return `${GREEN}✔${RESET}`;
  if (status === "warning") return `${YELLOW}⚠${RESET}`;
  return `${RED}✖${RESET}`;
}

// ── Config builder ────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return `/${text.trim().toLowerCase().replace(/\s+/g, "-")}/`;
}

function buildInput(
  html:        string,
  pageType:    "hub" | "cluster",
  projectPath: string,
  clusterPath: string | undefined
): QaValidatorInput {
  const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
  const cluster = clusterPath ? JSON.parse(fs.readFileSync(clusterPath, "utf8")) : null;

  // relatedClusterUrls: explicit array wins, else slugify the relatedPages text
  const relatedClusterUrls: string[] =
    cluster?.relatedUrls
      ? (cluster.relatedUrls as string[])
      : cluster?.relatedPages
        ? (cluster.relatedPages as string).split(",").map(slugify)
        : [];

  return {
    html,
    pageType,
    brandName:          project.businessName,
    legalName:          project.footerCompanyName ?? project.businessName,
    companyNumber:      project.footerCompanyNumber ?? "",
    addressLines:       (project.businessAddress as string).split(", "),
    email:              project.email,
    privacyUrl:         project.privacyUrl  ?? "/privacy-policy/",
    termsUrl:           project.termsUrl    ?? "/terms/",
    primaryKeyword:     cluster?.primaryKeyword ?? `${project.services?.[0]?.label ?? ""} ${project.areaConfigs?.[0] ?? ""}`.trim(),
    supportingKeywords: cluster?.supportingKeywords ?? [],
    hubPageUrl:         cluster?.hubUrl ?? project.domain,
    relatedClusterUrls,
    supportingPageUrls: project.navItems?.map((n: { href: string }) => n.href) ?? [],
  };
}

// ── Report printer ────────────────────────────────────────────────────────────

function printReport(report: ReturnType<typeof validatePage>, filename: string): void {
  const scoreColor = report.score >= 80 ? GREEN : report.score >= 60 ? YELLOW : RED;
  const passLabel  = report.passed ? `${GREEN}PASSED${RESET}` : `${RED}FAILED${RESET}`;

  console.log(`\n${BOLD}QA Report — ${path.basename(filename)} (${report.pageType})${RESET}`);
  console.log("─".repeat(60));
  console.log(`Overall:  ${passLabel}   Score: ${scoreColor}${BOLD}${report.score}%${RESET}`);
  console.log("─".repeat(60) + "\n");

  // Group checks by category prefix (first dot-segment of the key)
  const categories: Record<string, QaCheck[]> = {};
  for (const check of report.checks) {
    const cat = check.key.split(".")[0];
    (categories[cat] ??= []).push(check);
  }

  for (const [cat, checks] of Object.entries(categories)) {
    const allPass = checks.every((c) => c.status === "pass");
    const hasFail = checks.some((c) => c.status === "fail");
    const catColor = allPass ? GREEN : hasFail ? RED : YELLOW;
    console.log(`${BOLD}${catColor}${cat.toUpperCase()}${RESET}`);

    for (const c of checks) {
      const subKey = c.key.split(".").slice(1).join(".") || c.key;
      console.log(`  ${statusIcon(c.status)} ${DIM}${subKey}${RESET}  ${c.message}`);
    }
    console.log();
  }

  const passes   = report.checks.filter((c) => c.status === "pass").length;
  const warnings = report.checks.filter((c) => c.status === "warning").length;
  const fails    = report.checks.filter((c) => c.status === "fail").length;

  console.log("─".repeat(60));
  console.log(`${GREEN}${passes} passed${RESET}  ${YELLOW}${warnings} warnings${RESET}  ${RED}${fails} failed${RESET}  (${report.checks.length} total checks)`);
  console.log();
}

// ── Entry point ───────────────────────────────────────────────────────────────

function main(): void {
  const [,, htmlFile, pageTypeArg, projectConfig, clusterConfig] = process.argv;

  if (!htmlFile || !pageTypeArg || !projectConfig) {
    console.error(
      "Usage: pnpm exec tsx src/validate/runQa.ts <html-file> <hub|cluster> <project-config.json> [cluster-config.json]"
    );
    process.exit(1);
  }

  if (pageTypeArg !== "hub" && pageTypeArg !== "cluster") {
    console.error(`Page type must be "hub" or "cluster", got: "${pageTypeArg}"`);
    process.exit(1);
  }

  const html   = fs.readFileSync(htmlFile, "utf8");
  const input  = buildInput(html, pageTypeArg as "hub" | "cluster", projectConfig, clusterConfig);
  const report = validatePage(input);

  printReport(report, htmlFile);

  process.exit(report.passed ? 0 : 1);
}

main();
