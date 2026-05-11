/**
 * validate-pages.ts
 *
 * Pre-push validation for all generated HTML pages.
 * Run before any FTP deployment to catch broken CSS selectors,
 * missing width constraints, and old placeholder templates.
 *
 * Usage: pnpm --filter @workspace/scripts run validate-pages
 */

import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../output/rotherham-proof");

interface PageIssue {
  file: string;
  issues: string[];
}

function validatePage(filePath: string): string[] {
  const issues: string[] = [];
  const content = fs.readFileSync(filePath, "utf8");

  // 1. Broken CSS selector — .wrap.container with no comma
  if (/\.wrap\.container\s*\{/.test(content)) {
    issues.push(
      "BROKEN SELECTOR: .wrap.container { — missing comma, 960px constraint won't apply. Fix: .wrap, .container {"
    );
  }

  // 2. Missing correct selector entirely
  if (!/\.wrap,\s*\.container\s*\{/.test(content) && !/styles unchanged/.test(content)) {
    issues.push("MISSING SELECTOR: .wrap, .container { not found in CSS");
  }

  // 3. Old placeholder template
  if (/styles unchanged/.test(content)) {
    issues.push("OLD TEMPLATE: page uses placeholder CSS (/* ... styles unchanged ... */). Needs regeneration.");
  }

  // 4. Still has 1200px (the original over-wide value)
  if (/max-width:\s*1200px/.test(content)) {
    issues.push("WIDE CONTAINER: max-width 1200px found — should be 960px");
  }

  return issues;
}

function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error("Output directory not found:", OUTPUT_DIR);
    process.exit(1);
  }

  const dirs = fs.readdirSync(OUTPUT_DIR).filter((d) => {
    const full = path.join(OUTPUT_DIR, d);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "index.html"));
  });

  const failures: PageIssue[] = [];

  for (const slug of dirs) {
    const filePath = path.join(OUTPUT_DIR, slug, "index.html");
    const issues = validatePage(filePath);
    if (issues.length > 0) {
      failures.push({ file: slug, issues });
    }
  }

  console.log(`\nValidated ${dirs.length} pages`);

  if (failures.length === 0) {
    console.log("✓ All pages passed validation — safe to deploy\n");
    process.exit(0);
  } else {
    console.error(`\n✗ ${failures.length} page(s) failed validation:\n`);
    for (const f of failures) {
      console.error(`  ${f.file}`);
      for (const issue of f.issues) {
        console.error(`    → ${issue}`);
      }
    }
    console.error("\nFix these issues before deploying.\n");
    process.exit(1);
  }
}

run();
