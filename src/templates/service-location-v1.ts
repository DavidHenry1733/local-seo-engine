import { PagePayload, ProjectConfig } from "../generator/types";

export type RenderMode = "static" | "wordpress";

function buildStyles(mode: RenderMode): string {
  const heroPadTop = mode === "wordpress" ? "0" : "60px";

  return `
    /* ── Reset + base ─────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; }
    ${mode === "static" ? `body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 17px;
      line-height: 1.7;
      color: #334155;
      background: #fff;
    }` : `.slv-page {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 17px;
      line-height: 1.7;
      color: #334155;
    }`}
    .slv-page img, img { max-width: 100%; height: auto; display: block; }
    .slv-page a, a { color: #005EB8; text-decoration: none; }
    .slv-page a:hover, a:hover { text-decoration: underline; }

    /* ── Layout ───────────────────────────────────── */
    .wrap {
      max-width: 1060px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* ── Typography ───────────────────────────────── */
    .slv-page h1, h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); color: #003A6D; line-height: 1.2; margin: 0 0 20px; }
    .slv-page h2, h2 { font-size: clamp(1.2rem, 2.5vw, 1.7rem); color: #003A6D; margin: 0 0 12px; }
    .slv-page h3, h3 { font-size: 1.05rem; color: #003A6D; margin: 0 0 8px; }
    .slv-page p,  p  { margin: 0 0 16px; }

    /* ── Hero ─────────────────────────────────────── */
    .hero {
      background: #F4F6F8;
      border-bottom: 1px solid #D9E2EC;
      padding: ${heroPadTop} 0 0;
    }
    .hero-inner {
      display: flex;
      align-items: center;
      gap: 40px;
    }
    .hero-text {
      flex: 1 1 360px;
      padding-bottom: 48px;
      min-width: 0;
    }
    .hero-text .intro { font-size: 1.1rem; color: #334155; margin-bottom: 28px; }
    .hero-media {
      flex: 0 0 45%;
      max-width: 45%;
      align-self: flex-end;
      min-width: 0;
    }
    .hero-media img {
      border-radius: 12px 12px 0 0;
      box-shadow: 0 8px 32px rgba(0,62,109,0.12);
      width: 100%;
      max-width: 100%;
    }
    .btn {
      display: inline-block;
      background: #005EB8;
      color: #fff;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      transition: background 0.2s;
    }
    .btn:hover { background: #003A6D; text-decoration: none; }

    /* ── Content sections ─────────────────────────── */
    .section-band { padding: 56px 0; }
    .section-band--alt { background: #F4F6F8; border-top: 1px solid #D9E2EC; border-bottom: 1px solid #D9E2EC; }

    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
    .content-card {
      background: #fff;
      border: 1px solid #D9E2EC;
      border-radius: 12px;
      padding: 28px 28px 24px;
      box-shadow: 0 2px 8px rgba(0,62,109,0.05);
    }

    /* ── Media panels — hero, support, conversion ─── */
    .media-panel {
      background: #fff;
      border: 1px solid #D9E2EC;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 16px rgba(0,62,109,0.07);
      margin: 0 auto;
      max-width: 780px;
    }
    .media-panel img {
      border-radius: 10px;
      width: 100%;
      max-width: 100%;
      height: auto;
    }
    .media-panel-caption {
      text-align: center;
      font-size: 0.9rem;
      color: #64748b;
      margin-top: 14px;
      margin-bottom: 0;
    }

    /* ── Map section ──────────────────────────────── */
    .map-panel {
      background: #F4F6F8;
      border: 1px solid #D9E2EC;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 16px rgba(0,62,109,0.07);
    }
    .map-panel h2 { margin-bottom: 8px; }
    .map-panel p  { color: #64748b; margin-bottom: 20px; }
    .map-frame {
      border-radius: 12px;
      overflow: hidden;
      line-height: 0;
    }
    .map-frame iframe {
      display: block;
      width: 100%;
      height: 400px;
      border: 0;
    }
    @media (max-width: 720px) {
      .map-frame iframe { height: 280px; }
    }

    /* ── CTA band ─────────────────────────────────── */
    .cta-band {
      background: linear-gradient(135deg, #003A6D 0%, #005EB8 60%, #1CA9C9 100%);
      color: #fff;
      padding: 64px 0;
      text-align: center;
    }
    .cta-band h2 { color: #fff; font-size: clamp(1.4rem, 3vw, 2rem); margin-bottom: 12px; }
    .cta-band p  { color: rgba(255,255,255,0.88); font-size: 1.05rem; max-width: 580px; margin: 0 auto 20px; }
    .cta-band p.cta-close { margin-bottom: 28px; }
    .btn-white {
      display: inline-block;
      background: #fff;
      color: #005EB8;
      padding: 14px 36px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
    }
    .btn-white:hover { background: #F4F6F8; text-decoration: none; }

    /* ── FAQ ──────────────────────────────────────── */
    .faq-list { display: flex; flex-direction: column; gap: 16px; }
    .faq-card {
      border: 1px solid #D9E2EC;
      border-radius: 10px;
      padding: 22px 24px;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0,62,109,0.04);
    }
    .faq-q { font-size: 1rem; font-weight: 700; color: #003A6D; margin: 0 0 8px; }
    .faq-a { margin: 0; color: #334155; }

    /* ── Related links + Areas We Cover ──────────── */
    .related-grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .related-link {
      display: inline-block;
      background: #F4F6F8;
      border: 1px solid #D9E2EC;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 0.95rem;
      color: #005EB8;
      font-weight: 500;
    }
    .related-link:hover { background: #e2eaf3; text-decoration: none; }
    .areas-cover-body { max-width: 720px; color: #64748b; margin-bottom: 24px; }

    /* ── Section label ────────────────────────────── */
    .section-label {
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #1CA9C9;
      margin-bottom: 10px;
    }

    /* ── Responsive ───────────────────────────────── */
    @media (max-width: 720px) {
      .hero-inner { flex-direction: column; gap: 28px; }
      .hero-text  { padding-bottom: 0; flex: 1 1 auto; }
      .hero-media { flex: 1 1 auto; max-width: 100%; width: 100%; }
      .hero-media img { border-radius: 12px; }
      .media-panel { padding: 16px; }
    }
  `;
}

function buildBodyContent(
  project: ProjectConfig,
  payload: PagePayload,
  mode: RenderMode
): string {
  const { mapEmbed } = payload;
  const showH1 = mode === "static";

  // Static mode: images are local paths like "assets/web-design/hero-v1.png".
  // Prefix with "/" so pages served from sub-directories resolve correctly.
  // WordPress mode: images are already full URLs after upload — use as-is.
  const imgSrc = (p: string) => mode === "static" ? `/${p}` : p;

  const faqHtml = payload.faq
    .map(
      (item) => `
        <div class="faq-card">
          <h3 class="faq-q">${item.question}</h3>
          <p class="faq-a">${item.answer}</p>
        </div>`
    )
    .join("");

  const linksHtml = payload.internalLinks
    .map(
      (link) => `
        <a class="related-link" href="${link.href}">${link.label}</a>`
    )
    .join("");

  const renderSectionBody = (body: string) =>
    body
      .split(/\n\n+/)
      .map((para) => `<p>${para.trim()}</p>`)
      .join("\n        ");

  const sections01 = payload.sections
    .slice(0, 2)
    .map(
      (s) => `
      <div class="content-card">
        <h2>${s.heading}</h2>
        ${renderSectionBody(s.body)}
      </div>`
    )
    .join("");

  const sections23 = payload.sections
    .slice(2, 4)
    .map(
      (s) => `
      <div class="content-card">
        <h2>${s.heading}</h2>
        ${renderSectionBody(s.body)}
      </div>`
    )
    .join("");

  // 5th section — hub pages only (authority / area coverage editorial)
  const section4 = payload.sections[4]
    ? `
  <!-- ══ HUB AUTHORITY SECTION ══════════════════════════════ -->
  <section class="section-band section-band--alt">
    <div class="wrap">
      <div class="content-card" style="max-width:780px;margin:0 auto;">
        <h2>${payload.sections[4].heading}</h2>
        ${renderSectionBody(payload.sections[4].body)}
      </div>
    </div>
  </section>`
    : "";

  // Areas We Cover section
  const areaCoverHtml = payload.areaCoverage
    ? `
  <!-- ══ AREAS WE COVER ═════════════════════════════════════ -->
  <section class="section-band">
    <div class="wrap">
      <h2>${payload.areaCoverage.heading}</h2>
      <p class="areas-cover-body">${payload.areaCoverage.body}</p>
      <div class="related-grid">
        ${payload.areaCoverage.links
          .map((l) => `<a class="related-link" href="${l.href}">${l.label}</a>`)
          .join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  return `
  <!-- ══ HERO ══════════════════════════════════════ -->
  <section class="hero">
    <div class="wrap">
      <div class="hero-inner">
        <div class="hero-text">
          <p class="section-label">${project.businessName}</p>
          ${showH1 ? `<h1>${payload.h1}</h1>` : ""}
          <p class="intro">${payload.intro}</p>
          <a class="btn" href="${payload.cta.buttonUrl}">${payload.cta.buttonText}</a>
        </div>
        <div class="hero-media">
          <div class="media-panel">
            <img src="${imgSrc(payload.images.hero)}" alt="${payload.h1} — professional service visual" />
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ══ CONTENT SECTIONS 1–2 ══════════════════════ -->
  <section class="section-band">
    <div class="wrap">
      <div class="content-grid">
        ${sections01}
      </div>
    </div>
  </section>

  <!-- ══ SUPPORT IMAGE ══════════════════════════════ -->
  <section class="section-band section-band--alt">
    <div class="wrap">
      <div class="media-panel">
        <img src="${imgSrc(payload.images.support)}" alt="${payload.h1} — trust and credibility" />
        <p class="media-panel-caption">${payload.cta.heading}</p>
      </div>
    </div>
  </section>

  <!-- ══ CONTENT SECTIONS 3–4 ══════════════════════ -->
  <section class="section-band">
    <div class="wrap">
      <div class="content-grid">
        ${sections23}
      </div>
    </div>
  </section>
  ${section4}

  <!-- ══ CONVERSION IMAGE ═══════════════════════════ -->
  <section class="section-band section-band--alt">
    <div class="wrap">
      <div class="media-panel">
        <img src="${imgSrc(payload.images.conversion)}" alt="${payload.h1} — generating enquiries" />
        <p class="media-panel-caption">Ready to see stronger results?</p>
      </div>
    </div>
  </section>

  <!-- ══ MAP ════════════════════════════════════════ -->
  <section class="section-band">
    <div class="wrap">
      <div class="map-panel">
        <h2>${mapEmbed.heading}</h2>
        <p>${mapEmbed.body}</p>
        <div class="map-frame">
          <iframe
            src="${mapEmbed.embedUrl}"
            width="100%"
            height="400"
            style="border:0;"
            allowfullscreen=""
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            title="Map showing ${mapEmbed.query}"
          ></iframe>
        </div>
      </div>
    </div>
  </section>
  ${areaCoverHtml}

  <!-- ══ CTA BAND ═══════════════════════════════════ -->
  <section class="cta-band">
    <div class="wrap">
      <h2>${payload.cta.heading}</h2>
      <p class="cta-close">${payload.cta.body}</p>
      <a class="btn-white" href="${payload.cta.buttonUrl}">${payload.cta.buttonText}</a>
    </div>
  </section>

  <!-- ══ FAQ ════════════════════════════════════════ -->
  <section class="section-band">
    <div class="wrap">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-list">
        ${faqHtml}
      </div>
    </div>
  </section>

  <!-- ══ RELATED LINKS — shown only when no areaCoverage section ══════════ -->
  ${!payload.areaCoverage && payload.internalLinks.length > 0 ? `
  <section class="section-band section-band--alt">
    <div class="wrap">
      <h2>Related Pages</h2>
      <div class="related-grid">
        ${linksHtml}
      </div>
    </div>
  </section>` : ""}
`;
}

export function renderServiceLocationTemplate(
  project: ProjectConfig,
  payload: PagePayload,
  mode: RenderMode = "static"
): string {
  const styles = buildStyles(mode);
  const body   = buildBodyContent(project, payload, mode);

  if (mode === "wordpress") {
    // WordPress mode: no outer HTML document — WordPress provides the page shell.
    // Schema JSON-LD and scoped styles are injected at the top of the content field.
    const schemaScripts = payload.schema
      .map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`)
      .join("\n");

    return `${schemaScripts}
<style>${styles}</style>
<div class="slv-page">
${body}
</div>`;
  }

  // Static mode: full HTML document for local preview / file export.
  const schemaJson = payload.schema
    .map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`)
    .join("\n  ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${payload.metaTitle}</title>
  <meta name="description" content="${payload.metaDescription}" />
  <link rel="canonical" href="${payload.canonicalUrl}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${schemaJson}
  <style>${styles}</style>
</head>
<body>
${body}
</body>
</html>`;
}
