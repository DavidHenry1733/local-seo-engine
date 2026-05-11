/**
 * generate.ts — Keyword-first local SEO page generation API
 *
 * POST /api/generate/page
 *   Body: { keyword, templateId?, nearbyAreas?, businessProfile? }
 *   Returns: { keyword, service, location, intent, content, html }
 *
 * GET  /api/generate/page?keyword=Emergency+Plumber+Sheffield&templateId=plumber_local_service
 *   Returns: rendered HTML page (browser-viewable)
 *
 * GET  /api/generate/test
 *   Returns: HTML test form — submit a keyword and see the generated page
 *
 * Templates define structure (block order + style).
 * Content is generated entirely from the keyword.
 */

import { Router }        from "express";
import { generateKeywordPageContent, parseKeyword, type KeywordPageContent }
  from "../../../../../src/generator/generatePageContent";

const router = Router();

// ── Template style lookup (mirrors inline registry in templates.ts) ─────────────

interface TemplateStyle {
  primaryColor: string;
  accentColor:  string;
}

const TEMPLATE_STYLES: Record<string, TemplateStyle> = {
  plumber_local_service:  { primaryColor: "#0F2D4A", accentColor: "#E5380D" },
  trades_home_services:   { primaryColor: "#1B3A4B", accentColor: "#E8851A" },
  beauty_clinic:          { primaryColor: "#4A1942", accentColor: "#C9779A" },
  professional_services:  { primaryColor: "#1A2E44", accentColor: "#2563EB" },
  retail_local_shop:      { primaryColor: "#1F3D2B", accentColor: "#E63946" },
  inboxingproweb_default: { primaryColor: "#003A6D", accentColor: "#1CA9C9" },
};

function getStyle(templateId?: string): TemplateStyle {
  return TEMPLATE_STYLES[templateId ?? "plumber_local_service"]
    ?? TEMPLATE_STYLES.plumber_local_service;
}

// ── HTML renderer ─────────────────────────────────────────────────────────────
// Sections A–J per spec. No testimonials, no services grid, no map, no area
// link grid, no problems grid. Every section is prose or structured content
// tightly focused on the primary keyword.

function renderPageHtml(
  c: KeywordPageContent,
  style: TemplateStyle,
  bizPhone: string,
  bizName: string,
  bizAddress: string,
): string {
  const pri = style.primaryColor;
  const acc = style.accentColor;

  // ── Schema ──────────────────────────────────────────────────────────────────
  const schemaGraph = [
    {
      "@type": "WebPage",
      "name": c.meta.h1,
      "description": c.meta.description,
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "/" },
          { "@type": "ListItem", "position": 2, "name": c.meta.h1,
            "item": `/${c.keyword.toLowerCase().replace(/ /g, "-")}/` },
        ],
      },
    },
    {
      "@type": "LocalBusiness",
      "name": bizName,
      ...(bizPhone && bizPhone !== "{{BUSINESS_PHONE}}" ? { "telephone": bizPhone } : {}),
      ...(bizAddress && bizAddress !== "{{BUSINESS_ADDRESS}}" ? {
        "address": { "@type": "PostalAddress", "streetAddress": bizAddress,
          "addressLocality": c.location, "addressCountry": "GB" },
      } : {
        "address": { "@type": "PostalAddress", "addressLocality": c.location, "addressCountry": "GB" },
      }),
      "areaServed": { "@type": "City", "name": c.location },
    },
    {
      "@type": "Service",
      "name": c.meta.h1,
      "serviceType": c.service,
      "provider": { "@type": "LocalBusiness", "name": bizName },
      "areaServed": { "@type": "City", "name": c.location },
    },
    ...(c.faq?.length ? [{
      "@type": "FAQPage",
      "mainEntity": c.faq.map(f => ({
        "@type": "Question",
        "name": f.question,
        "acceptedAnswer": { "@type": "Answer", "text": f.answer },
      })),
    }] : []),
  ];
  const schema = JSON.stringify({ "@context": "https://schema.org", "@graph": schemaGraph });

  // ── Section helpers ─────────────────────────────────────────────────────────

  // Converts newline-separated paragraphs in AI body text to <p> tags
  function prose(raw: string): string {
    return (raw ?? "")
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escHtml(p)}</p>`)
      .join("\n");
  }

  const trustBulletsHtml = (c.hero?.trustBullets ?? []).map(t =>
    `<div class="trust-bullet"><div class="trust-dot"></div><span>${escHtml(t)}</span></div>`
  ).join("");

  const beforeStepsHtml = (c.beforeArrival?.steps ?? []).map((step, i) =>
    `<div class="before-step">
      <div class="before-step-num" style="background:${acc}">${i + 1}</div>
      <p>${escHtml(step)}</p>
    </div>`
  ).join("");

  const whyPointsHtml = (c.whyChooseUs?.points ?? []).map(p =>
    `<div class="why-point"><span class="why-tick" style="color:${acc}">✓</span><span>${escHtml(p)}</span></div>`
  ).join("");

  const processStepsHtml = (c.process?.steps ?? []).map(s =>
    `<div class="proc-step">
      <div class="proc-num" style="background:${acc}">${s.step}</div>
      <div class="proc-body"><h3>${escHtml(s.title)}</h3><p>${escHtml(s.description)}</p></div>
    </div>`
  ).join("");

  const faqHtml = (c.faq ?? []).map(f =>
    `<details class="faq-item">
      <summary class="faq-q">${escHtml(f.question)}</summary>
      <p class="faq-a">${escHtml(f.answer)}</p>
    </details>`
  ).join("");

  // ── AI Answer Block ─────────────────────────────────────────────────────────
  const aiAnswerHtml = c.aiAnswerBlock ? (() => {
    const ab = c.aiAnswerBlock as { question?: string; quickAnswer?: string; keyPoints?: string[] };
    const points = (ab.keyPoints ?? []).map(p =>
      `<li>${escHtml(p)}</li>`
    ).join("");
    return `<section class="section ai-answer-block" aria-label="Quick Answer">
  <div class="wrap">
    <p class="section-label">Quick Answer</p>
    <h2>${escHtml(ab.question ?? `What does ${c.service} in ${c.location} include?`)}</h2>
    <div class="ai-answer-box">
      <p class="ai-quick-answer">${escHtml(ab.quickAnswer ?? "")}</p>
      ${points ? `<ul class="ai-key-points">${points}</ul>` : ""}
    </div>
  </div>
</section>`;
  })() : "";

  // ── Intent Clusters ─────────────────────────────────────────────────────────
  const intentClustersHtml = c.intentClusters ? (() => {
    const ic = c.intentClusters as Record<string, { question?: string; answer?: string }>;
    const clusters = [
      ic.pricingQuestion,
      ic.processQuestion,
      ic.localQuestion,
      ic.comparisonQuestion,
    ].filter(Boolean);
    if (!clusters.length) return "";
    const rows = clusters.map(cl =>
      `<div class="intent-cluster">
        <h3>${escHtml(cl!.question ?? "")}</h3>
        <p>${escHtml(cl!.answer ?? "")}</p>
      </div>`
    ).join("");
    return `<section class="section section--alt intent-clusters" aria-label="Common Questions">
  <div class="wrap">
    <p class="section-label">Common questions</p>
    <h2>${escHtml(c.service)} in ${escHtml(c.location)} — questions answered</h2>
    <div class="intent-clusters-grid">${rows}</div>
  </div>
</section>`;
  })() : "";

  // ── Entity Block (AI-extractable, visually subtle) ──────────────────────────
  const entityBlockHtml = c.entityBlock ? (() => {
    const eb = c.entityBlock as Record<string, string>;
    return `<aside class="entity-block" aria-label="About this service">
  <div class="wrap">
    <p class="entity-label">About this service</p>
    <ul class="entity-list">
      ${eb.service         ? `<li><strong>Service:</strong> ${escHtml(eb.service)}</li>` : ""}
      ${eb.location        ? `<li><strong>Location:</strong> ${escHtml(eb.location)}</li>` : ""}
      ${eb.provider        ? `<li><strong>Provider:</strong> ${escHtml(eb.provider)}</li>` : ""}
      ${eb.primaryKeyword  ? `<li><strong>Topic:</strong> ${escHtml(eb.primaryKeyword)}</li>` : ""}
      ${eb.targetAudience  ? `<li><strong>For:</strong> ${escHtml(eb.targetAudience)}</li>` : ""}
      ${eb.nearbyAreas     ? `<li><strong>Also covering:</strong> ${escHtml(eb.nearbyAreas)}</li>` : ""}
    </ul>
  </div>
</aside>`;
  })() : "";

  const phoneDisplay = (bizPhone && bizPhone !== "{{BUSINESS_PHONE}}") ? bizPhone : "";
  const nameDisplay  = (bizName  && bizName  !== "{{BUSINESS_NAME}}")  ? bizName  : c.service;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(c.meta.title)}</title>
<meta name="description" content="${escHtml(c.meta.description)}">
<link rel="canonical" href="/${c.keyword.toLowerCase().replace(/ /g, "-")}/">
<script type="application/ld+json">${schema}</script>
<style>
/* ── Reset & base ── */
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:17px;line-height:1.75;color:#334155;background:#fff}
img{max-width:100%;height:auto;display:block}
a{color:${pri};text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:900px;margin:0 auto;padding:0 24px}
.wrap--wide{max-width:1100px;margin:0 auto;padding:0 24px}
h1{font-size:clamp(1.75rem,4vw,2.6rem);line-height:1.15;margin:0 0 20px;font-weight:800}
h2{font-size:clamp(1.2rem,2.5vw,1.6rem);line-height:1.25;margin:0 0 18px;font-weight:700}
h3{font-size:1rem;margin:0 0 8px;color:${pri};font-weight:700}
p{margin:0 0 1rem}
p:last-child{margin-bottom:0}
details>p{margin-top:.5rem}

/* ── Header ── */
.site-header{background:#fff;border-bottom:2px solid #E2E8F0;padding:14px 0}
.header-inner{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{font-weight:800;font-size:1.05rem;color:${pri};line-height:1.2}
.btn-tel{background:${acc};color:#fff!important;padding:11px 22px;border-radius:5px;font-weight:700;font-size:.95rem;white-space:nowrap;display:inline-flex;align-items:center;gap:7px}
.btn-tel:hover{opacity:.9;text-decoration:none!important}

/* ── A: Hero ── */
.hero{background:${pri};padding:56px 0 60px}
.hero h1{color:#fff}
.hero-intro{color:rgba(255,255,255,.9);margin-bottom:26px;font-size:1.05rem;max-width:600px}
.hero-label{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${acc};margin-bottom:10px}
.cta-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.btn-call{display:inline-flex;align-items:center;gap:8px;background:${acc};color:#fff;padding:14px 26px;border-radius:5px;font-size:1rem;font-weight:700;white-space:nowrap}
.btn-call:hover{opacity:.9;text-decoration:none}
.btn-cb{display:inline-flex;align-items:center;gap:7px;background:transparent;color:#fff;border:2px solid rgba(255,255,255,.5);padding:13px 20px;border-radius:5px;font-size:.95rem;font-weight:600}
.btn-cb:hover{border-color:#fff;text-decoration:none}
.trust-bullets{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:4px}
.trust-bullet{display:flex;align-items:center;gap:6px;font-size:.82rem;color:rgba(255,255,255,.82);font-weight:600}
.trust-dot{width:6px;height:6px;background:${acc};border-radius:50%;flex-shrink:0}

/* ── Prose sections ── */
.section{padding:64px 0}
.section--alt{background:#F8FAFC}
.section-label{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${acc};margin-bottom:8px}
.section h2{color:${pri}}
.prose-body{max-width:800px}
.prose-body p{font-size:1rem;line-height:1.8;color:#334155}

/* ── B: Emergency reassurance ── */
.reassurance-box{background:#fff;border-left:4px solid ${acc};border-radius:0 8px 8px 0;padding:22px 28px;margin-top:24px;max-width:780px}
.reassurance-box p{font-size:.95rem}

/* ── E: Before arrival ── */
.before-steps{display:flex;flex-direction:column;gap:16px;margin-top:24px;max-width:780px}
.before-step{display:flex;align-items:flex-start;gap:16px}
.before-step-num{flex-shrink:0;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.95rem;font-weight:800}
.before-step p{margin:5px 0 0;font-size:.95rem;line-height:1.65}

/* ── G: Why choose us ── */
.why-points{display:flex;flex-direction:column;gap:14px;margin-top:20px;max-width:700px}
.why-point{display:flex;align-items:flex-start;gap:10px;font-size:.97rem;line-height:1.6}
.why-tick{font-size:1.15rem;line-height:1;flex-shrink:0;margin-top:2px}

/* ── H: Process ── */
.proc-steps{display:flex;flex-direction:column;gap:20px;margin-top:24px;max-width:760px}
.proc-step{display:flex;align-items:flex-start;gap:20px}
.proc-num{flex-shrink:0;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;font-weight:800}
.proc-body{padding-top:2px}
.proc-body h3{font-size:.97rem;margin-bottom:4px}
.proc-body p{font-size:.9rem;color:#475569;margin:0}

/* ── I: FAQ ── */
.faq-list{display:flex;flex-direction:column;gap:10px;margin-top:24px;max-width:800px}
.faq-item{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:0;overflow:hidden}
.faq-item[open]{border-color:${pri}}
.faq-q{padding:16px 20px;font-weight:700;color:${pri};font-size:.95rem;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}
.faq-q::after{content:"▸";font-size:.8rem;color:${acc};margin-left:8px;flex-shrink:0}
.faq-item[open] .faq-q::after{content:"▾"}
.faq-q::-webkit-details-marker{display:none}
.faq-a{margin:0;padding:0 20px 16px;font-size:.9rem;color:#475569;line-height:1.7;border-top:1px solid #E2E8F0}

/* ── J: CTA band ── */
.cta-band{background:${pri};padding:64px 0;text-align:center}
.cta-band h2{color:#fff;margin-bottom:12px}
.cta-body{color:rgba(255,255,255,.85);max-width:580px;margin:0 auto 28px;font-size:1rem}
.btn-white{background:#fff;color:${pri}!important;font-weight:700;padding:14px 30px;border-radius:5px;font-size:1rem;display:inline-flex;align-items:center;gap:8px}
.btn-white:hover{opacity:.9;text-decoration:none!important}
.btn-outline-white{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.45);font-weight:600;padding:13px 24px;border-radius:5px;font-size:.95rem;display:inline-flex;align-items:center;gap:7px}
.btn-outline-white:hover{border-color:#fff;text-decoration:none}

/* ── Footer ── */
.site-footer{background:#1e293b;color:#94a3b8;padding:40px 0 20px}
.footer-inner{max-width:1100px;margin:0 auto;padding:0 24px}
.footer-biz{margin-bottom:28px}
.footer-biz .biz-name{color:#fff;font-weight:700;font-size:1rem;margin-bottom:6px}
.footer-biz a{color:${acc};font-size:.9rem}
.footer-biz a:hover{color:#fff;text-decoration:none}
.footer-nav{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:12px}
.footer-nav a{color:#94a3b8;font-size:.82rem}
.footer-nav a:hover{color:#fff;text-decoration:none}
.footer-bottom{border-top:1px solid #334155;padding-top:16px;font-size:.76rem;text-align:center;color:#64748b;margin-top:20px}

/* ── Responsive ── */
@media(max-width:640px){
  .cta-row{flex-direction:column}
  .btn-call,.btn-cb{justify-content:center}
  .proc-num{width:36px;height:36px;font-size:.9rem}
  .before-step-num{width:30px;height:30px;font-size:.8rem}
  .intent-clusters-grid{grid-template-columns:1fr}
}

/* ── A1: AI Answer Block ── */
.ai-answer-block{background:#f8fafc}
.ai-answer-box{border-left:4px solid ${acc};background:#fff;border-radius:6px;padding:20px 24px;max-width:760px}
.ai-quick-answer{font-size:1rem;line-height:1.75;margin:0 0 14px;color:#1e293b;font-weight:500}
.ai-key-points{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}
.ai-key-points li{font-size:.94rem;color:#334155;line-height:1.6}

/* ── G1: Intent Clusters ── */
.intent-clusters-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;margin-top:20px}
.intent-cluster{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px}
.intent-cluster h3{font-size:.93rem;color:${pri};margin:0 0 10px;line-height:1.4;font-weight:700}
.intent-cluster p{margin:0;font-size:.9rem;color:#475569;line-height:1.7}

/* ── K: Entity Block ── */
.entity-block{border-top:1px solid #e2e8f0;padding:28px 0;background:#f8fafc}
.entity-label{font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:0 0 10px}
.entity-list{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px 28px}
.entity-list li{font-size:.82rem;color:#64748b;line-height:1.5}
.entity-list strong{color:#475569}
</style>
</head>
<body>

<!-- HEADER -->
<header class="site-header">
  <div class="header-inner">
    <div class="logo">${escHtml(nameDisplay)}</div>
    ${phoneDisplay ? `<a href="tel:${escHtml(phoneDisplay)}" class="btn-tel">📞 ${escHtml(phoneDisplay)}</a>` : ""}
  </div>
</header>

<!-- A: HERO -->
<section class="hero">
  <div class="wrap">
    <p class="hero-label">📍 ${escHtml(c.location)}${c.intent === "urgent" ? " — Emergency Response" : ""}</p>
    <h1>${escHtml(c.hero.headline)}</h1>
    <p class="hero-intro">${escHtml(c.hero.intro)}</p>
    <div class="cta-row">
      ${phoneDisplay
        ? `<a href="tel:${escHtml(phoneDisplay)}" class="btn-call">📞 Call ${escHtml(phoneDisplay)}</a>`
        : `<a href="tel:{{BUSINESS_PHONE}}" class="btn-call">📞 Call Now</a>`}
      <a href="/callback/" class="btn-cb">Request a Callback →</a>
    </div>
    <div class="trust-bullets">${trustBulletsHtml}</div>
  </div>
</section>

<!-- A1: AI ANSWER BLOCK -->
${aiAnswerHtml}

<!-- B: EMERGENCY REASSURANCE -->
<section class="section">
  <div class="wrap">
    <p class="section-label">Reassurance</p>
    <h2>${escHtml(c.emergencyReassurance.heading)}</h2>
    <div class="prose-body">
      ${prose(c.emergencyReassurance.body)}
    </div>
    <div class="reassurance-box">
      <strong>If water is actively escaping — turn off your stop tap immediately and call ${phoneDisplay || "us"} now.</strong>
    </div>
  </div>
</section>

<!-- C: WHAT WE HELP WITH -->
<section class="section section--alt">
  <div class="wrap">
    <p class="section-label">What we fix</p>
    <h2>${escHtml(c.whatWeHelp.heading)}</h2>
    <div class="prose-body">
      ${prose(c.whatWeHelp.body)}
    </div>
  </div>
</section>

<!-- D: LOCAL COVERAGE -->
<section class="section">
  <div class="wrap">
    <p class="section-label">Local coverage</p>
    <h2>${escHtml(c.localCoverage.heading)}</h2>
    <div class="prose-body">
      ${prose(c.localCoverage.body)}
    </div>
  </div>
</section>

<!-- E: BEFORE ARRIVAL -->
<section class="section section--alt">
  <div class="wrap">
    <p class="section-label">Practical advice</p>
    <h2>${escHtml(c.beforeArrival.heading)}</h2>
    ${c.beforeArrival.intro ? `<p style="max-width:720px;margin-bottom:8px">${escHtml(c.beforeArrival.intro)}</p>` : ""}
    <div class="before-steps">${beforeStepsHtml}</div>
  </div>
</section>

<!-- F: PRICING -->
<section class="section">
  <div class="wrap">
    <p class="section-label">Pricing</p>
    <h2>${escHtml(c.pricing.heading)}</h2>
    <div class="prose-body">
      ${prose(c.pricing.body)}
    </div>
  </div>
</section>

<!-- G: WHY CHOOSE US -->
<section class="section section--alt">
  <div class="wrap">
    <p class="section-label">Why us</p>
    <h2>${escHtml(c.whyChooseUs.heading)}</h2>
    <div class="why-points">${whyPointsHtml}</div>
  </div>
</section>

<!-- G1: INTENT CLUSTERS -->
${intentClustersHtml}

<!-- H: PROCESS -->
<section class="section">
  <div class="wrap">
    <p class="section-label">How it works</p>
    <h2>${escHtml(c.process.heading)}</h2>
    <div class="proc-steps">${processStepsHtml}</div>
  </div>
</section>

<!-- I: FAQ -->
<section class="section section--alt">
  <div class="wrap">
    <p class="section-label">FAQ</p>
    <h2>Frequently asked questions — ${escHtml(c.service)} in ${escHtml(c.location)}</h2>
    <div class="faq-list">${faqHtml}</div>
  </div>
</section>

<!-- J: FINAL CTA -->
<section class="cta-band">
  <div class="wrap">
    <h2>${escHtml(c.cta.heading)}</h2>
    <p class="cta-body">${escHtml(c.cta.body)}</p>
    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
      ${phoneDisplay
        ? `<a href="tel:${escHtml(phoneDisplay)}" class="btn-white">📞 Call ${escHtml(phoneDisplay)}</a>`
        : `<a href="tel:{{BUSINESS_PHONE}}" class="btn-white">📞 Call Now</a>`}
      <a href="/callback/" class="btn-outline-white">Request a Callback</a>
    </div>
  </div>
</section>

<!-- K: ENTITY BLOCK -->
${entityBlockHtml}

<!-- FOOTER — profile data only -->
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-biz">
      <div class="biz-name">${escHtml(nameDisplay)}</div>
      ${bizAddress && bizAddress !== "{{BUSINESS_ADDRESS}}"
        ? `<p style="font-size:.82rem;margin:4px 0">${escHtml(bizAddress)}</p>` : ""}
      ${phoneDisplay
        ? `<a href="tel:${escHtml(phoneDisplay)}">📞 ${escHtml(phoneDisplay)}</a>` : ""}
      <nav class="footer-nav" aria-label="Footer navigation">
        <a href="/">Home</a>
        <a href="/privacy/">Privacy Policy</a>
        <a href="/terms/">Terms &amp; Conditions</a>
      </nav>
    </div>
    <div class="footer-bottom">© ${new Date().getFullYear()} ${escHtml(nameDisplay)} · All rights reserved</div>
  </div>
</footer>

</body>
</html>`;
}

function escHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Test form page ─────────────────────────────────────────────────────────────

function renderTestForm(pri: string, acc: string, lastResult?: {
  keyword: string; service: string; location: string; intent: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Keyword-First Page Generator — Test</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F1F5F9;color:#1e293b}
.header{background:${pri};color:#fff;padding:20px 32px;display:flex;align-items:center;justify-content:space-between}
.header h1{margin:0;font-size:1.15rem;font-weight:700}
.header a{color:rgba(255,255,255,.7);font-size:.82rem}
.container{max-width:860px;margin:40px auto;padding:0 24px}
.card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);padding:36px}
h2{margin:0 0 6px;font-size:1.2rem;color:${pri}}
.subtitle{color:#64748b;margin-bottom:28px;font-size:.9rem}
label{display:block;font-weight:600;font-size:.88rem;color:#475569;margin-bottom:5px}
input,select,textarea{width:100%;padding:10px 14px;border:1.5px solid #CBD5E1;border-radius:6px;font-size:.95rem;color:#1e293b;background:#fff;margin-bottom:18px}
input:focus,select:focus{outline:none;border-color:${pri}}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.hint{font-size:.75rem;color:#94a3b8;margin-top:-14px;margin-bottom:14px}
.btn-primary{background:${acc};color:#fff;padding:13px 32px;border:none;border-radius:6px;font-size:1rem;font-weight:700;cursor:pointer;width:100%}
.btn-primary:hover{opacity:.9}
.examples{margin-top:28px;background:#F8FAFC;border-radius:8px;padding:20px}
.examples h3{margin:0 0 12px;font-size:.88rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em}
.example-links{display:flex;flex-wrap:wrap;gap:10px}
.example-link{padding:7px 14px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:20px;font-size:.8rem;color:${pri};font-weight:600;cursor:pointer;text-decoration:none}
.example-link:hover{background:${pri};color:#fff}
.result-badge{background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:14px 20px;margin-top:20px;font-size:.85rem;color:#065F46}
.result-badge strong{color:#047857}
.warning{background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:14px 20px;margin-bottom:20px;font-size:.85rem;color:#78350F}
</style>
</head>
<body>
<div class="header">
  <h1>🔑 Keyword-First Page Generator</h1>
  <a href="/api/dashboard?tab=templates">← Back to Templates</a>
</div>
<div class="container">
  <div class="card">
    <h2>Generate a Local SEO Landing Page from a Keyword</h2>
    <p class="subtitle">Enter a primary keyword. The system extracts the service, location, and intent — then generates all page content from that keyword alone. No homepage sections. No generic content.</p>

    <div class="warning">
      ⏱ Generation takes 10–20 seconds — the AI is writing all content sections from your keyword. The page will open in a new tab when ready.
    </div>

    ${lastResult ? `<div class="result-badge">
      ✅ Last generated: <strong>"${lastResult.keyword}"</strong> →
      service: <strong>${lastResult.service}</strong> ·
      location: <strong>${lastResult.location}</strong> ·
      intent: <strong>${lastResult.intent}</strong>
    </div>` : ""}

    <form action="/api/generate/page" method="GET" target="_blank" style="margin-top:24px">
      <label>Primary keyword <span style="color:#E5380D">*</span></label>
      <input type="text" name="keyword" required placeholder="e.g. Emergency Plumber Sheffield" value="${lastResult?.keyword ?? ""}">
      <p class="hint">The system extracts service + location + intent automatically.</p>

      <label>Template</label>
      <select name="templateId">
        <option value="plumber_local_service">Local Plumber — Service/Location Page</option>
        <option value="trades_home_services">Trades &amp; Home Services</option>
        <option value="professional_services">Professional Services</option>
        <option value="beauty_clinic">Beauty &amp; Clinic</option>
        <option value="retail_local_shop">Retail &amp; Local Shop</option>
      </select>

      <div class="grid-2">
        <div>
          <label>Business name (optional)</label>
          <input type="text" name="bizName" placeholder="e.g. Peak Plumbing Services">
        </div>
        <div>
          <label>Business phone (optional)</label>
          <input type="text" name="bizPhone" placeholder="e.g. 0114 000 0000">
        </div>
      </div>

      <label>Nearby areas (optional — comma separated)</label>
      <input type="text" name="nearbyAreas" placeholder="e.g. Crookes, Hillsborough, Ecclesall, Walkley">
      <p class="hint">Mentioned in prose within the local coverage section. Used to populate cluster page links.</p>

      <button type="submit" class="btn-primary">Generate Page from Keyword →</button>
    </form>

    <div class="examples">
      <h3>Quick examples — click to fill and generate</h3>
      <div class="example-links">
        <a class="example-link" href="/api/generate/page?keyword=Emergency+Plumber+Sheffield&templateId=plumber_local_service&bizName=Peak+Plumbing+Services&bizPhone=0144+245675&nearbyAreas=Crookes,Hillsborough,Ecclesall,Walkley,Nether+Edge,Woodseats" target="_blank">Emergency Plumber Sheffield</a>
        <a class="example-link" href="/api/generate/page?keyword=Boiler+Repair+Leeds&templateId=plumber_local_service&bizPhone=0113+000+0000&nearbyAreas=Headingley,Horsforth,Meanwood,Roundhay" target="_blank">Boiler Repair Leeds</a>
        <a class="example-link" href="/api/generate/page?keyword=Electrician+Manchester&templateId=trades_home_services&bizPhone=0161+000+0000&nearbyAreas=Didsbury,Chorlton,Salford,Stretford" target="_blank">Electrician Manchester</a>
        <a class="example-link" href="/api/generate/page?keyword=Accountant+Birmingham&templateId=professional_services&bizPhone=0121+000+0000&nearbyAreas=Edgbaston,Moseley,Solihull,Sutton+Coldfield" target="_blank">Accountant Birmingham</a>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/** GET /api/generate/test — HTML test form */
router.get("/generate/test", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderTestForm("#0F2D4A", "#E5380D"));
});

/** GET /api/generate/parse?keyword=... — keyword parser debug */
router.get("/generate/parse", (req, res) => {
  const keyword = String(req.query.keyword ?? "").trim();
  if (!keyword) {
    res.status(400).json({ error: "keyword query param required" });
    return;
  }
  const result = parseKeyword(keyword);
  res.json({ keyword, ...result });
});

/** GET /api/generate/page?keyword=...&templateId=...&bizName=...&bizPhone=...&nearbyAreas=...
 *  Browser-friendly endpoint — returns rendered HTML. Opens directly in a tab. */
router.get("/generate/page", async (req, res) => {
  const keyword     = String(req.query.keyword     ?? "").trim();
  const templateId  = String(req.query.templateId  ?? "plumber_local_service").trim();
  const bizName     = String(req.query.bizName     ?? "{{BUSINESS_NAME}}").trim();
  const bizPhone    = String(req.query.bizPhone     ?? "{{BUSINESS_PHONE}}").trim();
  const bizAddress  = String(req.query.bizAddress  ?? "{{BUSINESS_ADDRESS}}").trim();
  const nearbyRaw   = String(req.query.nearbyAreas ?? "").trim();
  const nearbyAreas = nearbyRaw ? nearbyRaw.split(",").map(a => a.trim()).filter(Boolean) : undefined;

  if (!keyword) {
    res.status(400).send("<h1>keyword query param required</h1>");
    return;
  }

  try {
    const content = await generateKeywordPageContent({
      keyword,
      templateId,
      nearbyAreas,
      businessProfile: {
        name:    bizName,
        phone:   bizPhone,
        address: bizAddress,
      },
    });

    const style = getStyle(templateId);
    const html  = renderPageHtml(content, style, bizPhone, bizName, bizAddress);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err: any) {
    console.error("[generate/page GET]", err);
    res.status(500).send(`<pre style="color:red;padding:24px">${err.message}</pre>`);
  }
});

/** POST /api/generate/page — JSON API */
router.post("/generate/page", async (req, res) => {
  const {
    keyword,
    templateId,
    nearbyAreas,
    businessProfile,
    format,
  } = req.body as {
    keyword:         string;
    templateId?:     string;
    nearbyAreas?:    string[];
    businessProfile?: { name: string; phone: string; email?: string; address?: string };
    format?:         "json" | "html";
  };

  if (!keyword || typeof keyword !== "string") {
    res.status(400).json({ error: "keyword (string) is required" });
    return;
  }

  try {
    const content = await generateKeywordPageContent({ keyword, templateId, nearbyAreas, businessProfile });
    const style   = getStyle(templateId);
    const html    = renderPageHtml(
      content,
      style,
      businessProfile?.phone   ?? "{{BUSINESS_PHONE}}",
      businessProfile?.name    ?? "{{BUSINESS_NAME}}",
      businessProfile?.address ?? "{{BUSINESS_ADDRESS}}",
    );

    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      return;
    }

    res.json({ keyword, service: content.service, location: content.location, intent: content.intent, content, html });
  } catch (err: any) {
    console.error("[generate/page POST]", err);
    res.status(500).json({ error: err.message ?? "Generation failed" });
  }
});

export default router;
