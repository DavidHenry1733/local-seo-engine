import fs from "node:fs";
import path from "node:path";

import { auditBlogArticle } from "./auditBlogArticle";
import { buildBlogFromPage } from "./buildBlogFromPage";
import { generateBlogArticle, type BlogArticle } from "./generateBlogArticle";
import { renderBlogArticle } from "./renderBlogArticle";
import { renderBlogIndex } from "./renderBlogIndex";
import { upsertPage } from "../registry/pageRegistry";

const CLIENT_SLUG = "inboxingproweb";
const PROJECT_CONFIG_PATH = path.join(process.cwd(), "config", "projects", `${CLIENT_SLUG}.json`);
const BLOG_ROOT = path.join(process.cwd(), "output", CLIENT_SLUG, "blog");
const INDEX_TARGETS = ["web-design-sheffield", "local-seo-sheffield"];

export interface BlogFromPageResult {
  sourceSlug: string;
  outputDir: string;
  articlePath: string;
  htmlPath: string;
  indexPath: string;
  auditPath: string;
  assetPaths: Record<string, string>;
  passed: boolean;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath: string, value: string): void {
  fs.writeFileSync(filePath, `${value.trim()}\n`);
}

function articlePathFor(slug: string): string {
  return path.join(BLOG_ROOT, slug, "article.json");
}

function projectDomain(): string {
  try {
    const project = JSON.parse(fs.readFileSync(PROJECT_CONFIG_PATH, "utf8")) as { domain?: string };
    const domain = (project.domain ?? "").replace(/\/+$/, "");
    if (domain) return domain;
  } catch {
    // Fall back to the known local site domain used by this project.
  }

  return "https://local.inboxingproweb.com";
}

function registerBlogUrls(article: BlogArticle): void {
  const domain = projectDomain();
  const now = new Date().toISOString();
  const entries = [
    {
      url: `${domain}/blog/`,
      slug: "blog",
      remotePath: "/blog/",
      label: "Blog",
    },
    {
      url: `${domain}/blog/${article.slug}/`,
      slug: `blog/${article.slug}`,
      remotePath: `/blog/${article.slug}/`,
      label: article.title,
    },
  ];

  for (const entry of entries) {
    upsertPage(CLIENT_SLUG, {
      ...entry,
      type: "supporting",
      status: "live",
      includedInSitemap: true,
      priority: 0.6,
      lastDeployedAt: now,
      source: "blog-v1",
    });
  }
}

function readIndexArticles(currentArticle: BlogArticle): BlogArticle[] {
  const articles = new Map<string, BlogArticle>();
  articles.set(currentArticle.slug, currentArticle);

  for (const target of INDEX_TARGETS) {
    const filePath = articlePathFor(target);
    if (!fs.existsSync(filePath)) continue;
    const article = JSON.parse(fs.readFileSync(filePath, "utf8")) as BlogArticle;
    articles.set(article.slug, article);
  }

  return [...articles.values()];
}

export function generateBlogFromPage(sourceSlug: string): BlogFromPageResult {
  const brief = buildBlogFromPage(sourceSlug);
  const article = generateBlogArticle(brief);
  const audit = auditBlogArticle(article);
  const outputDir = path.join(BLOG_ROOT, article.slug);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(BLOG_ROOT, { recursive: true });

  const assetPaths = {
    gbp: path.join(outputDir, "gbp-post.txt"),
    facebook: path.join(outputDir, "facebook-post.txt"),
    linkedin: path.join(outputDir, "linkedin-post.txt"),
    x: path.join(outputDir, "x-post.txt"),
    youtube: path.join(outputDir, "youtube-script.txt"),
  };

  writeJson(path.join(outputDir, "brief.json"), brief);
  writeJson(path.join(outputDir, "article.json"), article);
  writeJson(path.join(outputDir, "audit.json"), audit);
  fs.writeFileSync(path.join(outputDir, "index.html"), renderBlogArticle(article));

  writeText(assetPaths.gbp, article.gbpPostDraft);
  writeText(assetPaths.facebook, article.socialPostDrafts.facebook);
  writeText(assetPaths.linkedin, article.socialPostDrafts.linkedin);
  writeText(assetPaths.x, article.socialPostDrafts.x);
  writeText(assetPaths.youtube, article.youtubeScriptDraft);

  const indexArticles = readIndexArticles(article);
  const indexPath = path.join(BLOG_ROOT, "index.html");
  fs.writeFileSync(indexPath, renderBlogIndex(indexArticles));
  registerBlogUrls(article);

  return {
    sourceSlug,
    outputDir,
    articlePath: path.join(outputDir, "article.json"),
    htmlPath: path.join(outputDir, "index.html"),
    indexPath,
    auditPath: path.join(outputDir, "audit.json"),
    assetPaths,
    passed: audit.passed,
  };
}

function isCliRun(): boolean {
  return process.argv[1] ? path.resolve(process.argv[1]).endsWith("generateBlogFromPage.ts") : false;
}

if (isCliRun()) {
  const sourceSlug = process.argv[2];
  if (!sourceSlug) {
    console.error("Usage: pnpm exec tsx src/blog/generateBlogFromPage.ts web-design-sheffield");
    process.exit(1);
  }

  try {
    const result = generateBlogFromPage(sourceSlug);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
