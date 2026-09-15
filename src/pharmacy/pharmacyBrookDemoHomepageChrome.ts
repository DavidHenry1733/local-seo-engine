/**
 * Accepted Brook demo homepage header/footer chrome.
 * Shared by the sales-demo service Preview and Brook Derby local-page rendering.
 * Does not rewrite body copy.
 */

const BROOK_DERBY_DEMO_SLUG = "brook-pharmacy-demo-derby";

export const BROOK_DEMO_NOTICE = "Demonstration website — for presentation purposes only.";

/** Verified from the live Brook demo site. Not the Rotherham brook-pharmacy profile. */
export const BROOK_SALES_DEMO_IDENTITY = {
  pharmacyName: "Brook Pharmacy",
  address: "56 West Burton Road, Derby, DA5 4NR",
  town: "Derby",
  phoneDisplay: "01332 445 076",
  logoUrl:
    "https://pharmacy.inboxingproweb.com/wp-content/uploads/2026/01/freepik__create-logo-for-a-pharmacy-brook-pharmacy-with-sty__54711-scaled-e1768071326843.png",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2405.7576969104966!2d-1.4825298233725033!3d52.91678930677714!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4879f122e3b24b99%3A0x183300050bae3a8c!2sThe%20Durham%20Ox%2C%2056%20Burton%20Rd%2C%20Derby%20DE1%201TG%2C%20UK!5e0!3m2!1sen!2slk!4v1768128088494!5m2!1sen!2slk",
} as const;

/** Computed from https://pharmacy.inboxingproweb.com/ (desktop, 2026-09-02). */
export const BROOK_SALES_DEMO_BRAND = {
  primary: "#005EB8",
  primaryHover: "#004a91",
  cta: "#F59E0B",
  ctaShadow: "rgba(245, 158, 11, 0.4)",
  accent: "#007A7A",
  charcoal: "#1F2933",
  slate: "#5F6C7B",
  footerBg: "#F5F7FA",
  headingFont: "'Montserrat', Helvetica, Arial, sans-serif",
  bodyFont: "'Open Sans', Arial, sans-serif",
  buttonRadius: "12px",
  headerCtaRadius: "9999px",
  fontsHref:
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600;700&display=swap",
} as const;

function escAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function usesBrookDemoHomepageChrome(slug: string): boolean {
  return String(slug || "").trim().toLowerCase() === BROOK_DERBY_DEMO_SLUG;
}

export function renderBrookHomepageHeader(): string {
  const id = BROOK_SALES_DEMO_IDENTITY;
  const b = BROOK_SALES_DEMO_BRAND;
  const phoneIcon = `<svg class="brook-demo-phone-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="${b.primary}" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z"/></svg>`;
  return `<header class="site-header brook-demo-header" data-sales-demo-brook="header">
<div class="brook-demo-header-inner">
<div class="brook-demo-header-left">
<a class="brook-demo-logo" href="#main-content" data-demo-inert="brand"><img src="${escAttr(id.logoUrl)}" alt="${escAttr(id.pharmacyName)}" width="250" height="52"/></a>
<nav class="brook-demo-nav" aria-label="Primary">
<a href="#main-content" data-demo-inert="nav">Home</a>
<a href="#service-definition" data-demo-inert="nav">Services</a>
<a href="#prescriptions" data-demo-inert="nav">Prescriptions</a>
<a href="#about-section" data-demo-inert="nav">About</a>
<a href="#contact" data-demo-inert="nav">Contact</a>
</nav>
</div>
<button type="button" class="brook-demo-nav-toggle" aria-label="Open menu" aria-expanded="false" onclick="var h=this.closest('.brook-demo-header'); h.classList.toggle('is-open'); this.setAttribute('aria-expanded', h.classList.contains('is-open') ? 'true' : 'false');">☰</button>
<div class="brook-demo-header-actions">
<a class="brook-demo-phone" href="#contact" data-demo-inert="tel">${phoneIcon}<span>${escHtml(id.phoneDisplay)}</span></a>
<a class="brook-demo-pill" href="#contact" data-demo-inert="cta">Order Prescription</a>
</div>
</div>
</header>`;
}

export function renderBrookHomepageFooter(): string {
  const id = BROOK_SALES_DEMO_IDENTITY;
  return `<footer class="site-footer brook-demo-footer" data-sales-demo-brook="footer">
<div class="brook-demo-footer-inner">
<div class="brook-demo-footer-brand">
<img src="${escAttr(id.logoUrl)}" alt="${escAttr(id.pharmacyName)}" width="300" height="63"/>
<p class="brook-demo-footer-quote">“Independent Community Pharmacy — Providing reliable NHS services with a focus on patient wellbeing and continuity of care.”</p>
</div>
<div class="brook-demo-footer-col">
<h3>Demonstration</h3>
<p class="brook-demo-footer-notice">${escHtml(BROOK_DEMO_NOTICE)}</p>
</div>
<div class="brook-demo-footer-col">
<h3>Information</h3>
<p>Privacy Policy<br/>Terms &amp; Conditions<br/>Accessibility Statement</p>
</div>
</div>
</footer>`;
}

export function brookHomepageFontsLink(): string {
  return `<link rel="stylesheet" href="${escAttr(BROOK_SALES_DEMO_BRAND.fontsHref)}" data-sales-demo-brook="fonts"/>`;
}

export function brookHomepageChromeCss(): string {
  const b = BROOK_SALES_DEMO_BRAND;
  return `<style data-sales-demo-brook="chrome">
.brook-demo-header.site-header{position:static;top:auto;z-index:20;background:#fff;border-bottom:0;color:${b.charcoal};font:400 14px/1.7 ${b.bodyFont}}
.pharmacy-review-preview-toolbar~.brook-demo-header.site-header{top:auto}
.brook-demo-header-inner{width:90%;max-width:1400px;margin:0 auto;padding:20px 0 27px;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:center;column-gap:24px;box-sizing:border-box}
.brook-demo-header-left{display:flex;align-items:center;min-width:0}
.brook-demo-logo{display:flex;align-items:center;flex:0 0 auto;width:280px;max-width:280px;margin-right:0;text-decoration:none}
.brook-demo-logo img{display:block;width:250px;height:auto;max-width:250px;max-height:none;object-fit:contain}
.brook-demo-nav{display:flex;align-items:center;flex:1 1 auto;min-width:0}
.brook-demo-nav a{display:flex;align-items:center;padding:31px 0;margin:0 11px;font:600 16px/14px ${b.bodyFont};color:${b.charcoal};text-decoration:none}
.brook-demo-nav a:hover{color:${b.primary}}
.brook-demo-header-actions{display:flex;align-items:center;justify-content:center;gap:16px}
.brook-demo-phone{display:flex;align-items:center;gap:8px;color:${b.charcoal}!important;font:700 14px/1.7 ${b.bodyFont};text-decoration:none}
.brook-demo-phone:hover{color:${b.accent}!important}
.brook-demo-phone-icon{flex:0 0 auto}
.brook-demo-pill{display:inline-flex;align-items:center;justify-content:center;background:${b.cta};color:#fff;padding:10px 24px;border-radius:9999px;font:700 12px/24px ${b.bodyFont};text-transform:uppercase;letter-spacing:.6px;text-decoration:none;box-shadow:0 4px 14px 0 ${b.ctaShadow};white-space:nowrap}
.brook-demo-nav-toggle{display:none;background:transparent;border:0;font-size:28px;line-height:1;padding:8px;color:#7EBEC5;cursor:pointer;justify-self:end}
.brook-demo-footer.site-footer{background:${b.footerBg};color:${b.charcoal};padding:0;border-top:1.6px solid ${b.accent};font-family:${b.bodyFont}}
.brook-demo-footer-inner{width:90%;max-width:1400px;margin:0 auto;padding:60px 0;display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr);gap:48px;box-sizing:border-box;align-items:start}
.brook-demo-footer-brand img{display:block;width:300px;max-width:100%;height:auto;margin:0 0 20px}
.brook-demo-footer.site-footer .brook-demo-footer-quote{margin:0;padding:0 0 0 30px;max-width:450px;color:${b.charcoal}!important;font:500 18px/1.5 ${b.bodyFont}}
.brook-demo-footer.site-footer .brook-demo-footer-col h3{margin:20px 0 0;color:${b.accent}!important;font:700 22px/1.4 ${b.bodyFont};letter-spacing:normal}
.brook-demo-footer.site-footer .brook-demo-footer-col p{margin:0;color:${b.charcoal}!important;font:600 16px/2 ${b.bodyFont}}
.brook-demo-footer.site-footer .brook-demo-footer-notice{font:600 16px/1.5 ${b.bodyFont}!important}
@media (max-width:980px){
  .brook-demo-header.site-header{overflow-x:hidden;max-width:100%;width:100%;box-sizing:border-box}
  .brook-demo-header-inner{width:100%;max-width:100%;grid-template-columns:minmax(0,1fr) auto;column-gap:8px;padding:10px 12px;min-width:0;box-sizing:border-box;overflow-x:hidden}
  .brook-demo-header-left{flex-direction:column;align-items:flex-start;min-width:0;max-width:100%}
  .brook-demo-logo{width:auto;max-width:100%;flex:0 1 auto}
  .brook-demo-logo img{width:min(250px,100%);max-width:100%}
  .brook-demo-nav,.brook-demo-header-actions{display:none}
  .brook-demo-nav-toggle{display:inline-flex;align-items:center;justify-content:center}
  .brook-demo-header.is-open .brook-demo-header-left{min-width:0;max-width:100%}
  .brook-demo-header.is-open .brook-demo-nav{display:flex;flex-direction:column;align-items:stretch;width:100%;max-width:100%;min-width:0;box-sizing:border-box;border-top:1px solid #e5e7eb}
  .brook-demo-header.is-open .brook-demo-header-actions{display:flex;width:100%;max-width:100%;min-width:0;grid-column:1/-1;padding:12px 0 8px;justify-content:flex-start;flex-wrap:wrap;box-sizing:border-box}
  .brook-demo-header.is-open .brook-demo-pill{max-width:100%;box-sizing:border-box}
  .brook-demo-header.is-open .brook-demo-nav a,
  .brook-demo-nav a{padding:12px 0;margin:0;max-width:100%;box-sizing:border-box}
  .brook-demo-footer-inner{grid-template-columns:1fr;gap:8px;padding:30px 0}
  .brook-demo-footer.site-footer .brook-demo-footer-quote{font-size:16px}
}
@media (max-width:639px){
  .brook-demo-phone{display:none}
  .brook-demo-header.is-open .brook-demo-phone{display:none}
}
</style>`;
}

export function applyBrookHomepageChrome(html: string): string {
  let out = String(html || "");
  if (!/data-sales-demo-brook="header"/i.test(out)) {
    out = out.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i, renderBrookHomepageHeader());
  }
  const footerHtml = renderBrookHomepageFooter();
  if (/data-sales-demo-brook="footer"/i.test(out)) {
    out = out.replace(/<footer\b[^>]*data-sales-demo-brook="footer"[^>]*>[\s\S]*?<\/footer>/i, footerHtml);
  } else {
    out = out.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/i, footerHtml);
  }
  const css = brookHomepageChromeCss();
  if (/data-sales-demo-brook="chrome"/i.test(out)) {
    out = out.replace(/<style data-sales-demo-brook="chrome">[\s\S]*?<\/style>/i, css);
  } else {
    out = out.includes("</head>") ? out.replace(/<\/head>/i, `${css}\n</head>`) : `${css}${out}`;
  }
  if (!/data-sales-demo-brook="fonts"/i.test(out)) {
    const fonts = brookHomepageFontsLink();
    out = out.includes("</head>") ? out.replace(/<\/head>/i, `${fonts}\n</head>`) : `${fonts}${out}`;
  }
  return out;
}
