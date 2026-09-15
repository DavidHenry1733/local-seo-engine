/**
 * Shared pharmacy brand visual system — Brook / PharmaConnect community pharmacy direction.
 * NHS blue + pharmacy green/teal accents, soft healthcare layout, trust-first hierarchy.
 */

import { pharmacyImageLibraryStyles } from "./pharmacyImageLibrary.ts";

export interface PharmacyBrandPreview {
  pharmacyName: string;
  phone?: string;
  email?: string;
  address?: string;
}

export type PharmacyFamilyAccent =
  | "clinical-nhs-services"
  | "vaccination-services"
  | "private-healthcare-services"
  | "travel-health-services"
  | "weight-management-services"
  | string;

const FAMILY_ACCENTS: Record<string, string> = {
  "clinical-nhs-services": "#005eb8",
  "vaccination-services": "#0072ce",
  "private-healthcare-services": "#2e4a7a",
  "travel-health-services": "#0d9488",
  "weight-management-services": "#059669",
};

export function familyAccentColor(familyKey?: string): string {
  return FAMILY_ACCENTS[familyKey ?? ""] ?? "#005eb8";
}

export function renderPharmacyBrandStyles(accent?: string, _familyKey?: string): string {
  const accentColor = accent ?? "#005eb8";
  return `:root{
--ink:#1a3347;--navy:#1e3a52;--nhs:#005eb8;--pharmacy-green:#007f3b;--accent:${accentColor};
--soft-blue:#f4f9fd;--soft-green:#f0fdf8;--soft:#f8fbfe;--line:#d9e8f2;--line-soft:#e8f2f8;
--text:#243447;--muted:#5a7186;--white:#fff;
--shadow-soft:0 8px 24px rgba(26,58,82,.06);--shadow-card:0 12px 32px rgba(26,58,82,.08);--radius:18px;--radius-lg:24px;
--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--font);color:var(--text);background:#fff;line-height:1.65;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
section{padding:64px 0}
h1,h2,h3{margin:0 0 12px;line-height:1.2;color:var(--ink);font-weight:700}
h1{font-size:clamp(2rem,4vw,2.85rem);letter-spacing:-.02em}
h2{font-size:clamp(1.55rem,3vw,2rem);letter-spacing:-.01em}
h3{font-size:1.15rem;font-weight:700}
p{font-size:1.02rem;margin:0 0 14px;color:var(--muted)}
a{color:var(--accent);font-weight:600;text-decoration:none}
a:hover{text-decoration:underline}
.contextual-link{color:var(--accent);font-weight:600}

.preview-banner{background:#fff8e6;color:#92400e;text-align:center;padding:9px 16px;font-size:13px;font-weight:700;border-bottom:1px solid #fde68a}

.top-trust-bar{background:var(--soft-blue);border-bottom:1px solid var(--line-soft);padding:8px 0;font-size:13px;color:var(--muted)}
.top-trust-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.trust-badges{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.trust-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;border:1px solid transparent}
.trust-badge--gphc{background:#fff;border-color:#c7dff5;color:var(--nhs)}
.trust-badge--nhs{background:#e8f4fd;border-color:#b9daf5;color:var(--nhs)}
.trust-badge--local{background:#ecfdf5;border-color:#bbf7d0;color:var(--pharmacy-green)}
.header-contact{font-weight:600;color:var(--ink);white-space:nowrap}

.site-header{background:#fff;border-bottom:1px solid var(--line-soft);position:sticky;top:0;z-index:40;padding:16px 0;box-shadow:0 2px 12px rgba(26,58,82,.04)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.brand{display:flex;flex-direction:column;gap:2px;font-weight:800;color:var(--ink);text-decoration:none;line-height:1.2}
.brand:hover{text-decoration:none}
.brand-name{font-size:1.15rem}
.brand-tagline{font-size:12px;font-weight:600;color:var(--pharmacy-green);letter-spacing:.02em}
.nav-links{display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-size:14px;font-weight:600}
.nav-links a{color:var(--ink)}
.nav-links a.nav-cta{display:inline-flex;align-items:center;min-height:42px;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff!important;text-decoration:none;font-weight:700;box-shadow:var(--shadow-soft)}
.nav-links a.nav-cta:hover{filter:brightness(1.05);text-decoration:none}

.hero{background:linear-gradient(180deg,var(--soft-blue) 0%,#fff 72%);color:var(--ink);padding:56px 0 64px;border-bottom:1px solid var(--line-soft)}
.hero h1{color:var(--ink)}
.hero p{color:var(--muted);font-size:1.12rem;max-width:680px}
.eyebrow{display:inline-block;padding:7px 14px;border-radius:999px;background:#e8f4fd;color:var(--nhs);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;margin-bottom:14px;border:1px solid #cce4f8}
.hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:36px;align-items:center}
.hero-media .image-slot{min-height:300px}
.btns{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:13px 24px;border-radius:999px;background:var(--accent);color:#fff!important;font-weight:700;text-decoration:none;border:2px solid var(--accent);box-shadow:var(--shadow-soft);font-size:15px}
.btn:hover{filter:brightness(1.04);text-decoration:none}
.btn.secondary{background:#fff;color:var(--ink)!important;border-color:var(--line)}
.btn.btn-green{background:var(--pharmacy-green);border-color:var(--pharmacy-green)}

.trust-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:28px}
.trust-item{background:#fff;border:1px solid var(--line-soft);border-radius:var(--radius);padding:14px 16px;font-size:13px;color:var(--muted);box-shadow:var(--shadow-soft)}
.trust-item strong{display:block;color:var(--accent);font-size:14px;margin-bottom:4px;font-weight:800}

.image-slot{border-radius:var(--radius-lg);border:2px dashed #c5dff0;background:linear-gradient(145deg,#f8fcff,#fff);min-height:240px;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px;color:var(--muted)}
.image-slot strong{display:block;color:var(--navy);font-size:17px;margin-bottom:6px;font-weight:700}
.image-slot span{font-size:13px}

.section-head{max-width:780px;margin-bottom:28px}
.section-head.center{text-align:center;margin-left:auto;margin-right:auto}
.section-kicker{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--pharmacy-green);margin-bottom:8px}

.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card{border:1px solid var(--line-soft);border-radius:var(--radius-lg);padding:22px 24px;background:#fff;box-shadow:var(--shadow-soft);transition:box-shadow .2s,border-color .2s}
.card:hover{box-shadow:var(--shadow-card);border-color:#c5dff0}
.card h3{margin-bottom:10px;color:var(--ink)}
.card p:last-child{margin-bottom:0}

.soft{background:var(--soft)}
.blue-band{background:linear-gradient(180deg,var(--soft-blue),#fff)}
.green-band{background:linear-gradient(180deg,var(--soft-green),#fff)}

.steps{counter-reset:step;max-width:820px}
.step{padding:20px 20px 20px 68px;position:relative;margin-bottom:14px;background:#fff;border:1px solid var(--line-soft);border-radius:var(--radius);box-shadow:var(--shadow-soft)}
.step:before{counter-increment:step;content:counter(step);position:absolute;left:18px;top:20px;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--pharmacy-green));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
.step h3{margin-bottom:6px;font-size:1.05rem}
.step p{margin:0;font-size:15px}

.areas-grid,.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.area-card,.related-card{display:block;border:1px solid var(--line-soft);border-radius:var(--radius-lg);padding:20px;background:#fff;text-decoration:none;color:inherit;box-shadow:var(--shadow-soft);transition:transform .15s,box-shadow .15s}
.area-card:hover,.related-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-card);text-decoration:none}
.area-card h3,.related-card h3{color:var(--ink);margin:0 0 8px;font-size:1rem}
.area-card p,.related-card p{margin:0;font-size:14px;color:var(--muted)}

.faq{border:1px solid var(--line-soft);border-radius:var(--radius);padding:20px 22px;margin-bottom:12px;background:#fff;box-shadow:var(--shadow-soft)}
.faq h3{font-size:1rem;margin-bottom:8px;color:var(--ink)}
.faq p{margin:0;font-size:15px;line-height:1.6}

.compliance{background:#fffbeb;border:1px solid #f0dfa0;border-radius:var(--radius-lg);padding:22px 24px}
.compliance h3{color:#7a5b00;margin-bottom:8px;font-size:1.05rem}
.compliance ul{margin:8px 0 0;padding-left:20px;color:#5d4a1f;font-size:14px;line-height:1.65}

.cta-band{background:linear-gradient(135deg,var(--nhs) 0%,#006847 100%);color:#fff;padding:72px 0;text-align:center}
.cta-band h2{color:#fff;font-size:clamp(1.6rem,3vw,2.1rem)}
.cta-band p{color:#e8f4ff;max-width:640px;margin:0 auto 22px;font-size:1.05rem}
.cta-band .btn.secondary{background:transparent;color:#fff!important;border-color:rgba(255,255,255,.55)}

.site-footer{background:var(--navy);color:#c8d9e8;padding:48px 0 28px;font-size:14px}
.footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:28px;margin-bottom:28px}
.footer-brand{font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:8px}
.footer-tagline{color:#8fb4cc;font-size:13px;margin-bottom:12px}
.footer-col h4{color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px;font-weight:700}
.footer-col p,.footer-col a{color:#b8cfe0;font-size:14px;line-height:1.7;margin:0 0 6px;display:block;text-decoration:none}
.footer-col a:hover{color:#fff;text-decoration:underline}
.footer-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding-top:18px;font-size:12px;color:#8fb4cc;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}

.check-list p{position:relative;padding-left:22px;margin-bottom:10px;color:var(--text)}
.check-list p:before{content:"✓";position:absolute;left:0;color:var(--pharmacy-green);font-weight:800}

@media(max-width:900px){
  section{padding:48px 0}
  .hero-grid,.grid-3,.grid-2,.areas-grid,.related-grid,.trust-row,.footer-grid{grid-template-columns:1fr}
  .nav-links{width:100%;justify-content:flex-start}
  .top-trust-inner{flex-direction:column;align-items:flex-start}
}${pharmacyImageLibraryStyles()}`;
}

export function renderTopTrustBar(preview: PharmacyBrandPreview): string {
  const phone = preview.phone ? `Tel: ${preview.phone}` : "";
  return `<div class="top-trust-bar"><div class="wrap top-trust-inner">
<div class="trust-badges">
<span class="trust-badge trust-badge--gphc">GPhC Registered</span>
<span class="trust-badge trust-badge--nhs">NHS Services</span>
<span class="trust-badge trust-badge--local">Independent Community Pharmacy</span>
</div>
${phone ? `<div class="header-contact">${phone.replace(/</g, "&lt;")}</div>` : ""}
</div></div>`;
}

export function renderSiteHeader(
  preview: PharmacyBrandPreview,
  brandHref: string,
  ctaLabel: string,
  ctaHref: string,
  faqAnchor = "#service-faq",
): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `${renderTopTrustBar(preview)}
<header class="site-header"><div class="wrap nav">
<a class="brand" href="${esc(brandHref)}">
<span class="brand-name">${esc(preview.pharmacyName)}</span>
<span class="brand-tagline">Your local community pharmacy</span>
</a>
<nav class="nav-links">
<a href="${esc(faqAnchor)}">FAQs</a>
<a href="${esc(ctaHref)}" class="nav-cta">${esc(ctaLabel)}</a>
</nav>
</div></header>`;
}

export function renderSiteFooter(
  preview: PharmacyBrandPreview,
  serviceLine: string,
): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const phone = preview.phone ? `<a href="tel:${preview.phone.replace(/\s+/g, "")}">${esc(preview.phone)}</a>` : "";
  const email = preview.email ? `<a href="mailto:${esc(preview.email)}">${esc(preview.email)}</a>` : "";
  const address = preview.address ? `<p>${esc(preview.address)}</p>` : "";
  return `<footer class="site-footer"><div class="wrap">
<div class="footer-grid">
<div>
<div class="footer-brand">${esc(preview.pharmacyName)}</div>
<div class="footer-tagline">Independent community pharmacy — personal, professional care</div>
<p>${esc(serviceLine)}</p>
<div class="footer-badges">
<span class="trust-badge trust-badge--gphc">GPhC Registered</span>
<span class="trust-badge trust-badge--nhs">NHS Pharmacy</span>
</div>
</div>
<div class="footer-col">
<h4>Contact</h4>
${address}
${phone}
${email}
</div>
<div class="footer-col">
<h4>Important</h4>
<p>Not for emergencies — call 999 or attend A&E.</p>
<p>Content is general information only — not personal medical advice.</p>
</div>
</div>
<div class="footer-bottom">
<span>&copy; ${esc(preview.pharmacyName)}. All rights reserved.</span>
<span>GPhC-registered pharmacy · ${esc(serviceLine)}</span>
</div>
</div></footer>`;
}

export function pharmacyImageSlot(label: string, slot: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<div class="image-slot image-slot--${esc(slot)}" aria-label="${esc(label)} placeholder"><div><strong>${esc(label)}</strong><span>Photo placeholder — ${esc(slot)}</span></div></div>`;
}

export function renderHeroTrustRow(items: string[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<div class="trust-row">${items
    .map((t) => {
      const words = t.trim().split(/\s+/);
      const lead = words[0] ?? "Trusted";
      return `<div class="trust-item"><strong>${esc(lead)}</strong>${esc(t)}</div>`;
    })
    .join("")}</div>`;
}
