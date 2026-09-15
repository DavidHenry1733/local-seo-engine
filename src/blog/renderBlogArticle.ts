import type { BlogArticle } from "./generateBlogArticle";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(items: string[]): string {
  return items.map((item) => `<p>${esc(item)}</p>`).join("\n");
}

function linkList(links: { label: string; href: string }[]): string {
  return links.map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join("\n");
}

export function renderBlogArticle(article: BlogArticle): string {
  const schemaJson = JSON.stringify(article.schema);
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <title>${esc(article.metaTitle)}</title>
  <meta name="description" content="${esc(article.metaDescription)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://local.inboxingproweb.com/blog/${esc(article.slug)}/">
  <script type="application/ld+json">${schemaJson}</script>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;line-height:1.65;color:#142033;margin:0;background:#fff}
    .wrap{max-width:920px;margin:0 auto;padding:42px 22px}
    header{background:#f6f9fc;border-bottom:1px solid #dce7f3}
    h1{font-size:44px;line-height:1.1;margin:0 0 18px;color:#07111f}
    h2{font-size:30px;line-height:1.2;margin:36px 0 12px;color:#07111f}
    p,li{font-size:18px}
    a{color:#0969ff;font-weight:700}
    .blog-nav{font-weight:700;margin-bottom:18px}
    .excerpt{font-size:20px;color:#5d6b7f}
    .hero-image{margin:28px 0 0;border-radius:22px;overflow:hidden;border:1px solid #dce7f3;background:#f8fbff}
    .hero-image img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover}
    .link-panel,.cta,.faq{border:1px solid #dce7f3;border-radius:18px;padding:22px;margin:32px 0;background:#f8fbff}
    .cta{background:#071a3d;color:#fff}.cta h2,.cta p{color:#fff}.cta a{color:#fff}
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <p class="blog-nav"><a href="/blog/">InboxingProWeb Blog</a></p>
      <h1>${esc(article.h1)}</h1>
      <p class="excerpt">${esc(article.excerpt)}</p>
      ${article.image ? `<figure class="hero-image"><img src="${esc(article.image.src)}" alt="${esc(article.image.alt)}" loading="eager" decoding="async"></figure>` : ""}
    </div>
  </header>
  <main class="wrap">
    <section>
      ${paragraphs(article.intro)}
    </section>
    ${article.sections.map((section) => `<section>
      <h2>${esc(section.heading)}</h2>
      ${paragraphs(section.body)}
    </section>`).join("\n")}
    <section>
      <h2>${esc(article.localRelevance.heading)}</h2>
      ${paragraphs(article.localRelevance.body)}
    </section>
    <section class="link-panel" aria-label="Internal link plan">
      <h2>Useful Next Steps</h2>
      <h3>Parent Service Hub</h3>
      <ul>${linkList([article.internalLinkPlan.parentHub])}</ul>
      <h3>Relevant Local Pages</h3>
      <ul>${linkList(article.internalLinkPlan.clusterLinks)}</ul>
      <h3>Related Services</h3>
      <ul>${linkList(article.internalLinkPlan.relatedServiceLinks)}</ul>
    </section>
    <section class="faq">
      <h2>Frequently Asked Questions</h2>
      ${article.faq.map((item) => `<h3>${esc(item.question)}</h3>\n<p>${esc(item.answer)}</p>`).join("\n")}
    </section>
    <section class="cta">
      <h2>${esc(article.cta.heading)}</h2>
      <p>${esc(article.cta.body)}</p>
      <p><a href="${esc(article.cta.href)}">${esc(article.cta.buttonText)}</a></p>
    </section>
    <section>
      <h2>AI Summary</h2>
      <p>${esc(article.aiSummary)}</p>
    </section>
  </main>
</body>
</html>`;
}
