/**
 * Export Content Engine blog_post assets to static HTML and refresh blog hub index.
 * Does not modify registry, sitemap, lifecycle, or deploy.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { BlogPostPayload } from "../src/content-engine/types.js";
import {
  exportContentEngineBlogAsset,
  isGuideVariantSlug,
  loadBlogHubEntryFromArticleJson,
  renderBlogHubIndex,
  type BlogHubEntry,
} from "../src/content-engine/exportBlogHtml.js";

const PROJECT = "inboxingproweb";
const CAMPAIGN_ID = "rotherham-webho-ting-5b9958";
const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "output", PROJECT);
const BLOG_DIR = path.join(OUTPUT_DIR, "blog");
const ASSETS_DIR = path.join(OUTPUT_DIR, "campaign-content", CAMPAIGN_ID, "assets");
const DOMAIN = "https://local.inboxingproweb.com";

const PRIMARY_BLOG_V1_SLUGS = ["local-seo-sheffield", "web-design-sheffield"];

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function existsLocalHref(href: string): boolean {
  if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return true;
  const slug = href.replace(/^\/|\/$/g, "");
  if (slug === "blog") return fs.existsSync(path.join(BLOG_DIR, "index.html"));
  return fs.existsSync(path.join(OUTPUT_DIR, slug, "index.html"))
    || fs.existsSync(path.join(BLOG_DIR, slug, "index.html"));
}

function auditBlogHtml(htmlPath: string, slug: string) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const issues: string[] = [];
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  const metaDesc = html.match(/<meta name="description" content="([^"]+)"/i)?.[1] ?? "";
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] ?? "";
  const h1 = html.match(/<h1>([^<]+)<\/h1>/i)?.[1] ?? "";
  const hasBody = /<main[\s\S]*<\/main>/i.test(html) && html.includes("<p>");
  const hasAiSummary = html.includes('class="ai-summary"') || html.includes("<h2>AI Summary</h2>");
  const hasFaq = html.includes('class="faq"');
  const hasCta = html.includes('class="cta"');
  const hasBlogNav = html.includes('href="/blog/"');
  const articleSchema = /"@type"\s*:\s*"BlogPosting"/.test(html);
  const faqSchema = /"@type"\s*:\s*"FAQPage"/.test(html);
  const tokens = html.match(/\{\{[A-Z_]+\}\}/g) ?? [];
  const broken: string[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!existsLocalHref(m[1])) broken.push(m[1]);
  }

  if (!title) issues.push("missing-title");
  if (!metaDesc) issues.push("missing-meta-description");
  if (!canonical.includes(`/blog/${slug}/`)) issues.push("canonical-mismatch");
  if (!h1) issues.push("missing-h1");
  if (!hasBody) issues.push("missing-body");
  if (!hasAiSummary) issues.push("missing-ai-summary");
  if (!hasFaq) issues.push("missing-faq-block");
  if (!hasCta) issues.push("missing-cta");
  if (!hasBlogNav) issues.push("missing-blog-nav");
  if (!articleSchema) issues.push("missing-article-schema");
  if (!faqSchema) issues.push("missing-faq-schema");
  if (tokens.length) issues.push(`unreplaced-tokens:${tokens.join(",")}`);
  if (broken.length) issues.push(`broken-links:${broken.join(",")}`);

  return {
    slug,
    htmlPath,
    title,
    metaTitle: title,
    metaDescription: metaDesc,
    canonical,
    h1,
    articleSchema,
    faqSchema,
    contextualLinksInBody: (html.match(/<main[\s\S]*?<\/main>/i)?.[0]?.match(/<a\b/gi) ?? []).length,
    brokenLinks: broken,
    issues,
    pass: issues.length === 0,
  };
}

function main(): void {
  const registryPath = path.join(OUTPUT_DIR, "page-registry.json");
  const sitemapPath = path.join(OUTPUT_DIR, "sitemap.xml");
  const registryHashBefore = fs.existsSync(registryPath) ? sha256(registryPath) : "";
  const sitemapHashBefore = fs.existsSync(sitemapPath) ? sha256(sitemapPath) : "";

  const assetFiles = fs.readdirSync(ASSETS_DIR)
    .filter((f) => f.startsWith("asset-blog-") && f.endsWith(".json"))
    .sort();

  const exported = assetFiles.map((file) =>
    exportContentEngineBlogAsset(path.join(ASSETS_DIR, file), OUTPUT_DIR, DOMAIN),
  );

  const hubEntries: BlogHubEntry[] = [];

  for (const slug of PRIMARY_BLOG_V1_SLUGS) {
    const articlePath = path.join(BLOG_DIR, slug, "article.json");
    if (fs.existsSync(articlePath)) {
      hubEntries.push(loadBlogHubEntryFromArticleJson(articlePath, "blog-v1"));
    }
  }

  for (const result of exported) {
    const envelope = JSON.parse(fs.readFileSync(result.jsonPath, "utf8")) as {
      payload: BlogPostPayload;
    };
    hubEntries.push({
      slug: result.slug,
      title: envelope.payload.title,
      excerpt: envelope.payload.metaDescription || envelope.payload.aiSummary,
      source: "content-engine",
    });
  }

  const hubHtml = renderBlogHubIndex(hubEntries, DOMAIN);
  fs.writeFileSync(path.join(BLOG_DIR, "index.html"), hubHtml, "utf8");

  const registryHashAfter = fs.existsSync(registryPath) ? sha256(registryPath) : "";
  const sitemapHashAfter = fs.existsSync(sitemapPath) ? sha256(sitemapPath) : "";

  const hubHtmlContent = fs.readFileSync(path.join(BLOG_DIR, "index.html"), "utf8");
  const hubCardCount = (hubHtmlContent.match(/<article class="card"/g) ?? []).length;
  const hubSlugs = hubEntries.map((e) => e.slug);

  const postAudits = [
    ...PRIMARY_BLOG_V1_SLUGS.map((slug) => auditBlogHtml(path.join(BLOG_DIR, slug, "index.html"), slug)),
    ...exported.map((r) => auditBlogHtml(r.htmlPath, r.slug)),
  ];

  const guideDirs = fs.readdirSync(BLOG_DIR).filter(
    (d) => fs.statSync(path.join(BLOG_DIR, d)).isDirectory() && isGuideVariantSlug(d),
  );

  const navConfigPath = path.join(ROOT, "config", "projects", `${PROJECT}.json`);
  const navConfig = JSON.parse(fs.readFileSync(navConfigPath, "utf8")) as {
    navItems?: { label: string; href: string }[];
  };
  const blogNavInConfig = (navConfig.navItems ?? []).some(
    (item) => item.href.replace(/\/+$/, "") === "/blog" || item.label.trim().toLowerCase() === "blog",
  );

  const allNewPostsPass = exported.every((r) =>
    auditBlogHtml(r.htmlPath, r.slug).pass,
  );
  const hubListsSix = hubCardCount === 6;
  const registryUnchanged = registryHashBefore === registryHashAfter;
  const sitemapUnchanged = sitemapHashBefore === sitemapHashAfter;
  const pass = allNewPostsPass && hubListsSix && registryUnchanged && sitemapUnchanged && blogNavInConfig;

  const report = {
    reportType: "content-engine-blog-static-export-integration-v1",
    verdict: pass
      ? "PASS: Content Engine Blog Static Export Integration V1 Complete"
      : "FAIL: Blog Static Export Integration Requires Investigation",
    generatedAt: new Date().toISOString(),
    campaignId: CAMPAIGN_ID,
    filesCreated: [
      "src/content-engine/exportBlogHtml.ts",
      "scripts/export-campaign-blogs.ts",
      ...exported.flatMap((r) => [r.htmlPath, r.jsonPath]),
      path.join(BLOG_DIR, "index.html"),
    ],
    blogPostsExported: exported.map((r) => ({
      assetId: r.assetId,
      slug: r.slug,
      htmlPath: r.htmlPath,
    })),
    blogHubPostCount: hubCardCount,
    blogHubSlugs: hubSlugs,
    orphanGuideVariantsExcluded: guideDirs,
    navigationUpdateStatus: {
      configNavItemsUpdated: blogNavInConfig,
      renderClusterPageBlogInjection: true,
      blogNavHref: "/blog/",
      note: "Service pages will include Blog on next render; existing HTML not bulk-patched.",
    },
    schemaStatus: {
      contentEnginePosts: postAudits
        .filter((a) => exported.some((e) => e.slug === a.slug))
        .map((a) => ({
          slug: a.slug,
          articleSchema: a.articleSchema,
          faqSchema: a.faqSchema,
        })),
    },
    validation: {
      hubListsSixPosts: hubListsSix,
      postAudits,
    },
    registryUnchanged,
    sitemapUnchanged,
    deploymentOccurred: false,
    safeToDeploy: pass,
    recommendedNextAction: pass
      ? "Review exported blog HTML locally, then run registry/sitemap sync and deploy when ready."
      : "Fix failing validation checks before registry sync or deployment.",
  };

  const outPath = path.join(OUTPUT_DIR, "content-engine-blog-static-export-integration-v1-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(report.verdict);
  console.log(`Report: ${outPath}`);
  if (!pass) process.exit(1);
}

main();
