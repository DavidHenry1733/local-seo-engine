import fs from "node:fs";
import path from "node:path";

import { auditBlogArticle } from "./auditBlogArticle";
import { buildBlogBrief } from "./buildBlogBrief";
import { generateBlogArticle } from "./generateBlogArticle";
import { renderBlogArticle } from "./renderBlogArticle";

export interface BlogEcosystemResult {
  sourceSlug: string;
  outputDir: string;
  articlePath: string;
  htmlPath: string;
  auditPath: string;
  passed: boolean;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function generateBlogEcosystem(sourceSlug: string): BlogEcosystemResult {
  const brief = buildBlogBrief(sourceSlug);
  const article = generateBlogArticle(brief);
  const audit = auditBlogArticle(article);
  const outputDir = path.join(process.cwd(), "output", brief.clientSlug, "blog", article.slug);

  fs.mkdirSync(outputDir, { recursive: true });
  writeJson(path.join(outputDir, "brief.json"), brief);
  writeJson(path.join(outputDir, "article.json"), article);
  writeJson(path.join(outputDir, "audit.json"), audit);
  fs.writeFileSync(path.join(outputDir, "index.html"), renderBlogArticle(article));

  return {
    sourceSlug,
    outputDir,
    articlePath: path.join(outputDir, "article.json"),
    htmlPath: path.join(outputDir, "index.html"),
    auditPath: path.join(outputDir, "audit.json"),
    passed: audit.passed,
  };
}

function isCliRun(): boolean {
  return process.argv[1] ? path.resolve(process.argv[1]).endsWith("generateBlogEcosystem.ts") : false;
}

if (isCliRun()) {
  const sourceSlug = process.argv[2];
  if (!sourceSlug) {
    console.error("Usage: pnpm exec tsx src/blog/generateBlogEcosystem.ts \"web-design-sheffield\"");
    process.exit(1);
  }

  try {
    const result = generateBlogEcosystem(sourceSlug);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
