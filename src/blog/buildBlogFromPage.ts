import fs from "node:fs";
import path from "node:path";

import * as cheerio from "cheerio";

import {
  buildBlogBrief,
  type BlogBrief,
  type BlogImage,
} from "./buildBlogBrief";

const CLIENT_SLUG = "inboxingproweb";

function sourceHtmlPath(sourceSlug: string): string {
  return path.join(process.cwd(), "output", CLIENT_SLUG, sourceSlug, "index.html");
}

function extractImage($: cheerio.CheerioAPI, serviceName: string, city: string): BlogImage | undefined {
  const heroImage = $(".hero img, .hero-media img, .hero-image-wrap img").first();
  const heroSrc = heroImage.attr("src");
  const ogSrc = $('meta[property="og:image"]').attr("content");
  const src = heroSrc || ogSrc;

  if (!src) return undefined;

  return {
    src,
    alt: heroImage.attr("alt") || `${serviceName} guidance for ${city} businesses`,
  };
}

export function buildBlogFromPage(sourceSlug: string): BlogBrief {
  const brief = buildBlogBrief(sourceSlug);
  const htmlPath = sourceHtmlPath(sourceSlug);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Source page HTML not found: ${htmlPath}`);
  }

  const $ = cheerio.load(fs.readFileSync(htmlPath, "utf8"));

  return {
    ...brief,
    image: extractImage($, brief.serviceName, brief.city),
  };
}

function isCliRun(): boolean {
  return process.argv[1] ? path.resolve(process.argv[1]).endsWith("buildBlogFromPage.ts") : false;
}

if (isCliRun()) {
  const sourceSlug = process.argv[2];
  if (!sourceSlug) {
    console.error("Usage: pnpm exec tsx src/blog/buildBlogFromPage.ts web-design-sheffield");
    process.exit(1);
  }
  console.log(JSON.stringify(buildBlogFromPage(sourceSlug), null, 2));
}
