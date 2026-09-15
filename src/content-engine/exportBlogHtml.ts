import fs from "node:fs";
import path from "node:path";

import type { AssetEnvelope, BlogPostPayload, InternalLink } from "./types.js";

export interface BlogHubEntry {
  slug: string;
  title: string;
  excerpt: string;
  source: "blog-v1" | "content-engine";
}

export interface ExportBlogHtmlResult {
  slug: string;
  assetId: string;
  htmlPath: string;
  jsonPath: string;
}

const DEFAULT_DOMAIN = "https://local.inboxingproweb.com";

export const BLOG_ARTICLE_STYLES = `
    body{font-family:Arial,Helvetica,sans-serif;line-height:1.65;color:#142033;margin:0;background:#fff}
    .wrap{max-width:920px;margin:0 auto;padding:42px 22px}
    header{background:#f6f9fc;border-bottom:1px solid #dce7f3}
    h1{font-size:44px;line-height:1.1;margin:0 0 18px;color:#07111f}
    h2{font-size:30px;line-height:1.2;margin:36px 0 12px;color:#07111f}
    h3{font-size:22px;line-height:1.3;margin:24px 0 10px;color:#07111f}
    p,li{font-size:18px}
    a{color:#0969ff;font-weight:700}
    .blog-nav{font-weight:700;margin-bottom:18px}
    .excerpt{font-size:20px;color:#5d6b7f}
    .hero-image{margin:28px 0 0;border-radius:22px;overflow:hidden;border:1px solid #dce7f3;background:#f8fbff}
    .hero-image img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover}
    .link-panel,.cta,.faq{border:1px solid #dce7f3;border-radius:18px;padding:22px;margin:32px 0;background:#f8fbff}
    .cta{background:#071a3d;color:#fff}.cta h2,.cta p{color:#fff}.cta a{color:#fff}
    .ai-summary{border-top:1px solid #dce7f3;padding-top:28px;margin-top:36px}
`.trim();

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeHrefToLocal(href: string): string {
  const stripped = href.replace(/^https?:\/\/[^/]+/, "") || href;
  if (stripped.startsWith("http")) return stripped;
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

const MONEY_PAGE_HREFS: Record<string, string> = {
  "/uk-website-hosting/": "https://inboxingproweb.com/uk-website-hosting/",
  "/local-seo-services/": "https://inboxingproweb.com/local-seo-services/",
  "/custom-website-design/": "https://inboxingproweb.com/custom-website-design/",
  "/email-marketing-3/": "https://inboxingproweb.com/email-marketing-3/",
  "/our-services/": "https://inboxingproweb.com/our-services/",
};

function hrefForOutput(href: string): string {
  const local = normalizeHrefToLocal(href);
  if (local.startsWith("http")) return local.endsWith("/") ? local : `${local}/`;
  const withSlash = local.endsWith("/") ? local : `${local}/`;
  if (MONEY_PAGE_HREFS[withSlash]) return MONEY_PAGE_HREFS[withSlash];
  return withSlash;
}

function inlineFormat(text: string): string {
  let out = text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) =>
      `\u0000LINK\u0000${hrefForOutput(url)}\u0000${label}\u0000`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "\u0000BOLD\u0000$1\u0000");
  out = esc(out);
  return out
    .replace(/\u0000LINK\u0000([^\u0000]+)\u0000([^\u0000]+)\u0000/g, (_m, href: string, label: string) =>
      `<a href="${href}">${label}</a>`,
    )
    .replace(/\u0000BOLD\u0000([^\u0000]+)\u0000/g, "<strong>$1</strong>");
}

export function stripTrailingBlogSections(markdown: string): string {
  let text = markdown;
  const markers = [/^## Frequently Asked Questions/im, /^## Related Local Pages/im];
  for (const marker of markers) {
    const idx = text.search(marker);
    if (idx >= 0) text = text.slice(0, idx);
  }
  return text.replace(/\n\nNeed help[\s\S]*$/i, "").trim();
}

export function markdownToBlogBodyHtml(markdown: string): string {
  let md = markdown.replace(/^#\s+.+\n+/, "");
  md = stripTrailingBlogSections(md);

  const lines = md.split("\n");
  const parts: string[] = [];
  let listItems: string[] = [];
  let sectionOpen = false;

  const flushList = () => {
    if (!listItems.length) return;
    parts.push(`<ul>${listItems.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  const openSection = () => {
    if (!sectionOpen) {
      parts.push("<section>");
      sectionOpen = true;
    }
  };

  const closeSection = () => {
    flushList();
    if (sectionOpen) {
      parts.push("</section>");
      sectionOpen = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("## ")) {
      closeSection();
      parts.push(`<section><h2>${esc(line.slice(3).trim())}</h2>`);
      sectionOpen = true;
      continue;
    }
    if (line.startsWith("### ")) {
      openSection();
      flushList();
      parts.push(`<h3>${esc(line.slice(4).trim())}</h3>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      openSection();
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    openSection();
    flushList();
    parts.push(`<p>${inlineFormat(line.trim())}</p>`);
  }

  closeSection();
  return parts.join("\n");
}

function linkList(links: InternalLink[]): string {
  return links
    .map((link) => `<li><a href="${esc(hrefForOutput(link.href))}">${esc(link.label)}</a></li>`)
    .join("\n");
}

function extractCtaFromMarkdown(markdown: string): { heading: string; body: string; buttonText: string; href: string } | null {
  const match = markdown.match(/Need help[^?\n]*\?\s*\[([^\]]+)\]\(([^)]+)\)/i);
  if (!match) return null;
  return {
    heading: "Take the next step",
    body: "Use the parent service hub to review options and request support tailored to your business.",
    buttonText: match[1].trim(),
    href: hrefForOutput(match[2]),
  };
}

function buildInternalLinkPlan(payload: BlogPostPayload): {
  parentHub: InternalLink;
  clusterLinks: InternalLink[];
  relatedServiceLinks: InternalLink[];
} {
  const hubHref = payload.linkedHubUrl;
  const hubNorm = normalizeHrefToLocal(hubHref).replace(/\/+$/, "");
  const parentFromLinks = payload.internalLinks.find(
    (link) => normalizeHrefToLocal(link.href).replace(/\/+$/, "") === hubNorm,
  );
  const parentHub: InternalLink = parentFromLinks ?? {
    label: payload.title.split(":")[0]?.trim() || "Service Hub",
    href: hubHref,
  };

  const clusterSet = new Set(
    (payload.linkedClusterUrls ?? []).map((url) => normalizeHrefToLocal(url).replace(/\/+$/, "")),
  );
  const clusterLinks = payload.internalLinks.filter((link) =>
    clusterSet.has(normalizeHrefToLocal(link.href).replace(/\/+$/, "")),
  );
  const clusterHrefs = new Set(clusterLinks.map((link) => normalizeHrefToLocal(link.href).replace(/\/+$/, "")));

  const relatedServiceLinks = payload.internalLinks.filter((link) => {
    const norm = normalizeHrefToLocal(link.href).replace(/\/+$/, "");
    return norm !== hubNorm && !clusterHrefs.has(norm);
  });

  return { parentHub, clusterLinks, relatedServiceLinks };
}

function buildCta(payload: BlogPostPayload, service: string, location: string): {
  heading: string;
  body: string;
  buttonText: string;
  href: string;
} {
  const extracted = extractCtaFromMarkdown(payload.bodyMarkdown);
  if (extracted) {
    return {
      ...extracted,
      heading: `Review ${service} in ${location}`,
    };
  }
  return {
    heading: `Review ${service} in ${location}`,
    body: payload.aiSummary,
    buttonText: "View service hub",
    href: hrefForOutput(payload.linkedHubUrl),
  };
}

export function renderContentEngineBlogHtml(
  envelope: AssetEnvelope,
  domain = DEFAULT_DOMAIN,
): string {
  const payload = envelope.payload as unknown as BlogPostPayload;
  const canonical = `${domain.replace(/\/+$/, "")}/blog/${payload.slug}/`;
  const articleSchema = {
    ...payload.articleSchema,
    url: canonical,
    mainEntityOfPage: canonical,
  };
  const faqSchema = payload.faqSchema;
  const bodyHtml = markdownToBlogBodyHtml(payload.bodyMarkdown);
  const linkPlan = buildInternalLinkPlan(payload);
  const cta = buildCta(payload, envelope.service, envelope.location);
  const excerpt = payload.metaDescription || payload.aiSummary;

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <title>${esc(payload.metaTitle)}</title>
  <meta name="description" content="${esc(payload.metaDescription)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${esc(canonical)}">
  <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <style>${BLOG_ARTICLE_STYLES}</style>
</head>
<body>
  <header>
    <div class="wrap">
      <p class="blog-nav"><a href="/blog/">InboxingProWeb Blog</a></p>
      <h1>${esc(payload.h1)}</h1>
      <p class="excerpt">${esc(excerpt)}</p>
    </div>
  </header>
  <main class="wrap">
    ${bodyHtml}
    <section class="link-panel" aria-label="Internal link plan">
      <h2>Useful Next Steps</h2>
      <h3>Parent Service Hub</h3>
      <ul>${linkList([linkPlan.parentHub])}</ul>
      ${linkPlan.clusterLinks.length ? `<h3>Relevant Local Pages</h3>
      <ul>${linkList(linkPlan.clusterLinks)}</ul>` : ""}
      ${linkPlan.relatedServiceLinks.length ? `<h3>Related Services</h3>
      <ul>${linkList(linkPlan.relatedServiceLinks)}</ul>` : ""}
    </section>
    <section class="faq">
      <h2>Frequently Asked Questions</h2>
      ${payload.faqBlock.map((item) => `<h3>${esc(item.question)}</h3>\n<p>${esc(item.answer)}</p>`).join("\n")}
    </section>
    <section class="cta">
      <h2>${esc(cta.heading)}</h2>
      <p>${esc(cta.body)}</p>
      <p><a href="${esc(cta.href)}">${esc(cta.buttonText)}</a></p>
    </section>
    <section class="ai-summary">
      <h2>AI Summary</h2>
      <p>${esc(payload.aiSummary)}</p>
    </section>
  </main>
</body>
</html>`;
}

export function renderBlogHubIndex(entries: BlogHubEntry[], domain = DEFAULT_DOMAIN): string {
  const cards = entries
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((entry) => {
      const eyebrow = entry.source === "content-engine" ? "Rotherham Hosting Guide" : "InboxingProWeb Guide";
      return `<article class="card">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2><a href="/blog/${esc(entry.slug)}/">${esc(entry.title)}</a></h2>
      <p>${esc(entry.excerpt)}</p>
      <p><a href="/blog/${esc(entry.slug)}/">Read the guide</a></p>
    </article>`;
    })
    .join("\n");

  const canonical = `${domain.replace(/\/+$/, "")}/blog/`;

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <title>InboxingProWeb Blog | Local Business Growth Guides</title>
  <meta name="description" content="Practical Web Design, Local SEO and Web Hosting guides for local businesses, built from InboxingProWeb service page insights.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${esc(canonical)}">
  <style>
    body{font-family:Arial,Helvetica,sans-serif;line-height:1.65;color:#142033;margin:0;background:#fff}
    .wrap{max-width:1040px;margin:0 auto;padding:48px 22px}
    header{background:#071a3d;color:#fff}
    h1{font-size:48px;line-height:1.1;margin:0 0 16px}
    h2{font-size:28px;line-height:1.2;margin:0 0 12px}
    p{font-size:18px}
    a{color:#0969ff;font-weight:700}
    header a,header p{color:#dcecff}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px}
    .card{border:1px solid #dce7f3;border-radius:20px;padding:24px;background:#f8fbff}
    .eyebrow{font-size:13px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#5d6b7f}
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <p><a href="/">InboxingProWeb</a> / Blog</p>
      <h1>InboxingProWeb Blog</h1>
      <p>Fast, practical guides repurposed from existing service page content, local relevance, FAQs and internal link plans.</p>
    </div>
  </header>
  <main class="wrap">
    <section class="grid">
      ${cards}
    </section>
  </main>
</body>
</html>`;
}

export function loadBlogHubEntryFromArticleJson(articlePath: string, source: BlogHubEntry["source"]): BlogHubEntry {
  const article = JSON.parse(fs.readFileSync(articlePath, "utf8")) as {
    slug: string;
    title: string;
    excerpt?: string;
    metaDescription?: string;
    aiSummary?: string;
  };
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt ?? article.metaDescription ?? article.aiSummary ?? "",
    source,
  };
}

export function exportContentEngineBlogAsset(
  assetPath: string,
  outputRoot: string,
  domain = DEFAULT_DOMAIN,
): ExportBlogHtmlResult {
  const envelope = JSON.parse(fs.readFileSync(assetPath, "utf8")) as AssetEnvelope;
  if (envelope.assetType !== "blog_post") {
    throw new Error(`${assetPath} is not a blog_post asset (${envelope.assetType})`);
  }
  const payload = envelope.payload as unknown as BlogPostPayload;
  const slug = payload.slug;
  const outDir = path.join(outputRoot, "blog", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const html = renderContentEngineBlogHtml(envelope, domain);
  const htmlPath = path.join(outDir, "index.html");
  const jsonPath = path.join(outDir, "content-engine-asset.json");
  fs.writeFileSync(htmlPath, html, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(envelope, null, 2) + "\n", "utf8");

  return { slug, assetId: envelope.assetId, htmlPath, jsonPath };
}

export function isGuideVariantSlug(slug: string): boolean {
  return slug.endsWith("-guide");
}
