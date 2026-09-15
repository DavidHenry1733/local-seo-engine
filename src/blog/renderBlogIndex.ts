import type { BlogArticle } from "./generateBlogArticle";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBlogIndex(articles: BlogArticle[]): string {
  const cards = articles
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((article) => `<article class="card">
      <p class="eyebrow">InboxingProWeb Guide</p>
      <h2><a href="/blog/${esc(article.slug)}/">${esc(article.title)}</a></h2>
      <p>${esc(article.excerpt)}</p>
      <p><a href="/blog/${esc(article.slug)}/">Read the guide</a></p>
    </article>`)
    .join("\n");

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <title>InboxingProWeb Blog | Local Business Growth Guides</title>
  <meta name="description" content="Practical Web Design and Local SEO guides for local businesses, built from existing InboxingProWeb service page insights.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://local.inboxingproweb.com/blog/">
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
