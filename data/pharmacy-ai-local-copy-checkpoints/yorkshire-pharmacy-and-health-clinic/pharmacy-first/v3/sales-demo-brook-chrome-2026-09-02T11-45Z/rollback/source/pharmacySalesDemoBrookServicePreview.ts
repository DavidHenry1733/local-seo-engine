/**
 * Isolated sales-demo Preview: Yorkshire Pharmacy First service layout/clinical
 * content, overlaid with Brook demo identity from pharmacy.inboxingproweb.com.
 * Request-time only. Does not write profiles, visual HTML, candidates, or
 * authoritative pages.
 */
import fs from "node:fs";
import { resolveVisualExperienceHtmlPath } from "./pharmacyVisualExperience.ts";
import { renderBenchmarkPagePreviewHtml } from "./pharmacyContentEcosystemPreviewRoute.ts";
import { loadSalesDemoBrookDerbyAreaSelection } from "./pharmacySalesDemoBrookDerbyAreaSelection.ts";

export const SALES_DEMO_BROOK_SERVICE_PAGE_ASSET = "sales-demo-brook-service-page";
export const SALES_DEMO_BROOK_NOTICE = "Demonstration website — for presentation purposes only.";
export const SALES_DEMO_BROOK_SOURCE_URL = "https://pharmacy.inboxingproweb.com/";

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

const YORKSHIRE_NAMES = [
  "Yorkshire Pharmacy &amp; Health Clinic",
  "Yorkshire Pharmacy & Health Clinic",
  "Yorkshire Pharmacy and Health Clinic",
] as const;

const LOCATION_DEPENDENT_FLAGS = [
  "hero eyebrow/lead — premises town in identity chrome",
  "trust card heading/body — Local {town} Pharmacy / nearby communities",
  "trust split copy — serving patients in the premises town",
  "visit/local-access — Yorkshire premises address, coverage tags, map, directions",
  "image alt text — premises-town identity in platform image alts (image files unchanged)",
  "page title, meta description, JSON-LD — areaServed and provider",
  "header/footer/CTA contact targets — previous tenant tel, mailto, website, maps dir",
] as const;

function escAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function replaceAll(source: string, from: string, to: string): string {
  if (!from) return source;
  return source.split(from).join(to);
}

function flag(section: string): string {
  return `<!-- SALES-DEMO-LOCATION-FLAG: ${section} -->`;
}

function applyBrookIdentityTokens(html: string): string {
  const id = BROOK_SALES_DEMO_IDENTITY;
  let out = html;

  out = replaceAll(
    out,
    "91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK",
    id.address,
  );
  out = replaceAll(out, "91 Snape Hill Rd, Darfield, Barnsley S73 9LR", id.address);
  out = replaceAll(
    out,
    "91%20Snape%20Hill%20Rd%2C%20Darfield%2C%20Barnsley%20S73%209LR%2C%20UK",
    encodeURIComponent(id.address),
  );
  out = replaceAll(out, "91 Snape Hill Rd", id.address);

  for (const name of YORKSHIRE_NAMES) {
    out = replaceAll(out, name, id.pharmacyName);
  }

  out = replaceAll(out, "01226 210477", id.phoneDisplay);
  out = replaceAll(out, "01226210477", "01332445076");
  out = replaceAll(out, "Local Barnsley Pharmacy", `Local ${id.town} Pharmacy`);
  out = replaceAll(out, "Pharmacy First Barnsley", `Pharmacy First ${id.town}`);
  out = replaceAll(out, "Areas served around Barnsley", `Areas served around ${id.town}`);
  out = replaceAll(out, "patients in Barnsley and nearby communities", `patients in ${id.town}`);
  out = replaceAll(out, "in Barnsley", `in ${id.town}`);
  out = replaceAll(out, "patients in Barnsley", `patients in ${id.town}`);
  out = replaceAll(out, "Patients in Barnsley", `Patients in ${id.town}`);
  out = replaceAll(out, ", Barnsley", `, ${id.town}`);
  out = replaceAll(out, " Barnsley", ` ${id.town}`);
  out = replaceAll(out, '"Barnsley"', `"${id.town}"`);

  return out;
}

function renderDemoLocalityLabels(): string {
  const selection = loadSalesDemoBrookDerbyAreaSelection();
  const labels = selection.areas
    .map((row) => `<span class="coverage-tag" role="listitem">${escAttr(row.areaName)}</span>`)
    .join("");
  const origin = selection.demoLocation;
  return `${flag("locality section — Yorkshire cluster replaced with saved Derby demonstration labels; no local pages")}
<div data-sales-demo-localities="true"><strong>Areas served around Derby</strong><p class="sales-demo-locality-note">${escAttr(origin.label)}. Map origin: ${escAttr(origin.mapAddress)}.</p><div class="coverage-tags" role="list">${labels}</div></div>`;
}

function replaceYorkshireLocalClusterWithDemoLabels(html: string): string {
  const block = renderDemoLocalityLabels();
  const replaced = html.replace(
    /<div><strong>Areas served around [^<]*<\/strong><div class="coverage-tags"[\s\S]*?<\/div><\/div>/,
    block,
  );
  if (replaced !== html) return replaced;
  return html.replace(
    /<!-- SALES-DEMO-LOCATION-FLAG: coverage tags[\s\S]*?-->/,
    block,
  );
}

function replaceLogos(html: string): string {
  const logo = BROOK_SALES_DEMO_IDENTITY.logoUrl;
  let out = html.replace(
    /https:\/\/yorkshirepharmacyhealthclinic\.co\.uk\/img\/[^"'\s>]+/gi,
    logo,
  );
  out = out.replace(
    /(<a class="brand"[^>]*>\s*<img\b[^>]*src=")[^"]*(")/i,
    `$1${escAttr(logo)}$2`,
  );
  out = out.replace(
    /(<img\b[^>]*alt="Brook Pharmacy"[^>]*src=")[^"]*(")/i,
    `$1${escAttr(logo)}$2`,
  );
  out = out.replace(
    /(<footer[\s\S]*?<img\b[^>]*src=")[^"]*("[^>]*>)/i,
    `$1${escAttr(logo)}$2`,
  );
  return out;
}

function replaceMap(html: string): string {
  const src = BROOK_SALES_DEMO_IDENTITY.mapEmbedUrl;
  const title = `Map showing ${BROOK_SALES_DEMO_IDENTITY.pharmacyName} in ${BROOK_SALES_DEMO_IDENTITY.town}`;
  return html.replace(
    /<iframe\b([^>]*?)src="[^"]*"([^>]*?)title="[^"]*"/i,
    `<iframe$1src="${escAttr(src)}"$2title="${escAttr(title)}"`,
  );
}

function neutralizeContactActions(html: string): string {
  let out = html;
  out = out.replace(
    /href="tel:[^"]*"/gi,
    'href="#contact" data-demo-inert="tel"',
  );
  out = out.replace(
    /<p><a href="mailto:[^"]*">[^<]*<\/a><\/p>/gi,
    `${flag("footer email omitted — Brook demo site has no published email")}`,
  );
  out = out.replace(/href="mailto:[^"]*"/gi, 'href="#contact" data-demo-inert="mailto"');
  out = out.replace(
    /href="https:\/\/www\.google\.com\/maps\/dir\/[^"]*"/gi,
    'href="#local-access"',
  );
  out = out.replace(
    /(<a class="btn secondary" href="#local-access")[^>]*(>Get directions<\/a>)/i,
    "$1$2",
  );
  out = out.replace(
    /href="https?:\/\/[^"]*yorkshirepharmacyhealthclinic[^"]*"/gi,
    'href="#contact" data-demo-inert="website"',
  );
  out = out.replace(
    /href="https?:\/\/[^"]*broomlanepharmacy[^"]*"/gi,
    'href="#contact" data-demo-inert="website"',
  );
  out = out.replace(
    /href="\/api\/pharmacy-content-ecosystem-preview\/[^"]*"/gi,
    'href="#local-access" data-demo-inert="local-cluster"',
  );
  const brandOpen = out.match(/<a class="brand"[^>]*>/i)?.[0] || "";
  if (brandOpen && /href="https?:\/\//i.test(brandOpen)) {
    out = out.replace(
      /<a class="brand" href="[^"]*"/i,
      '<a class="brand" href="#main-content" data-demo-inert="brand"',
    );
  }
  return out;
}

function stripLeftoverYorkshireLocation(html: string): string {
  let out = html;
  out = out.replace(/\bWombwell\b/g, "");
  out = out.replace(/\bDarfield\b/g, "");
  out = out.replace(/\bThurnscoe\b/g, "");
  out = out.replace(/\bGrimethorpe\b/g, "");
  out = out.replace(/\bGoldthorpe\b/g, "");
  out = out.replace(/\bWorsbrough\b/g, "");
  out = out.replace(/\bHoyland\b/g, "");
  out = out.replace(/\bCudworth\b/g, "");
  out = out.replace(/\bRoyston\b/g, "");
  out = out.replace(/\bChapeltown\b/g, "");
  out = out.replace(/1\.7\s*km/gi, "");
  return out;
}

function applyBrookHomepageBrand(html: string): string {
  const b = BROOK_SALES_DEMO_BRAND;
  if (/data-sales-demo-brook="brand"/i.test(html)) return html;
  const fonts = `<link rel="stylesheet" href="${escAttr(b.fontsHref)}" data-sales-demo-brook="fonts"/>`;
  const css = `<style data-sales-demo-brook="brand">
:root{
  --brand-primary:${b.primary} !important;
  --brand-secondary:${b.primaryHover} !important;
  --brand-cta:${b.cta} !important;
  --brand-action:${b.cta} !important;
  --pharmacy-cta:${b.cta} !important;
  --brand-button-text:#ffffff !important;
  --brand-accent:${b.accent} !important;
  --brand-heading:${b.primary} !important;
  --brand-heading-primary:${b.primary} !important;
  --brand-heading-secondary:${b.accent} !important;
  --header-text:${b.charcoal} !important;
  --brand-nav-text:${b.charcoal} !important;
  --header-bg:#ffffff !important;
  --footer-bg:${b.footerBg} !important;
  --brand-footer-bg:${b.footerBg} !important;
  --brand-footer-bottom-bg:${b.footerBg} !important;
  --footer-text:${b.charcoal} !important;
  --brand-footer-text:${b.charcoal} !important;
  --footer-link:${b.primary} !important;
  --brand-footer-link:${b.primary} !important;
  --footer-accent:${b.accent} !important;
  --brand-footer-accent:${b.accent} !important;
  --brand-top-bar-bg:${b.primary} !important;
  --brand-font-heading:${b.headingFont} !important;
  --brand-font-body:${b.bodyFont} !important;
  --font-heading:${b.headingFont} !important;
  --font-body:${b.bodyFont} !important;
  --heading-font:${b.headingFont} !important;
  --body-font:${b.bodyFont} !important;
  --brand-radius-button:${b.buttonRadius} !important;
  --btn-radius:${b.buttonRadius} !important;
  --brand-muted:${b.slate} !important;
  --brand-text:${b.charcoal} !important;
  --navy:${b.primary} !important;
}
.btn{box-shadow:0 4px 14px 0 ${b.ctaShadow}}
.btn.secondary{background:#fff;color:${b.primary};border:2px solid ${b.primary};box-shadow:none}
.pc-v1-header .nav-cta.btn{border-radius:${b.headerCtaRadius};font-weight:700}
</style>`;
  let out = html;
  out = out.includes("</head>")
    ? out.replace(/<\/head>/i, `${fonts}\n${css}\n</head>`)
    : `${fonts}${css}${out}`;
  return out;
}

function applyDemoNotice(html: string): string {
  const extraCss = `<style data-sales-demo-brook="notice">.pharmacy-sales-demo-notice{display:block;margin-top:2px;font:600 12px/1.4 Inter,system-ui,sans-serif;color:#1e3a8a}.pharmacy-review-preview-toolbar{min-height:0}.pharmacy-review-preview-toolbar~.site-header{top:58px}html{scroll-padding-top:148px}section[id]{scroll-margin-top:148px}[data-demo-inert]{cursor:pointer}.sales-demo-locality-note{margin:8px 0 0;font:600 13px/1.45 Inter,system-ui,sans-serif;color:#1e3a8a}[data-sales-demo-localities] .coverage-tags{flex-wrap:wrap;overflow:visible}[data-sales-demo-localities] .coverage-tag{pointer-events:none;cursor:default;text-decoration:none}</style>`;
  let out = html;
  if (!out.includes('data-sales-demo-brook="notice"')) {
    out = out.includes("</head>")
      ? out.replace(/<\/head>/i, `${extraCss}\n</head>`)
      : `${extraCss}${out}`;
  }
  out = out.replace(
    /(<div class="pharmacy-review-preview-toolbar"[^>]*>)([\s\S]*?)(<\/div>)/i,
    `$1$2<span class="pharmacy-sales-demo-notice">${SALES_DEMO_BROOK_NOTICE}</span>$3`,
  );
  out = out.replace(
    /<body\b([^>]*)>/i,
    `<body data-sales-demo="brook-inboxingproweb" data-sales-demo-source="${escAttr(SALES_DEMO_BROOK_SOURCE_URL)}"$1>`,
  );
  return out;
}

function stampPreviewSource(html: string): string {
  if (/PREVIEW_SOURCE:\s*sales-demo-brook-service-page/i.test(html)) return html;
  return html.replace(
    /PREVIEW_SOURCE:\s*service-page-preview/i,
    "PREVIEW_SOURCE: sales-demo-brook-service-page",
  );
}

export function applyBrookSalesDemoIdentity(html: string): string {
  const flags = LOCATION_DEPENDENT_FLAGS.map(flag).join("\n");
  let out = String(html || "");
  out = out.replace(/<head\b[^>]*>/i, (open) => `${open}\n${flags}`);
  out = stampPreviewSource(out);
  out = applyBrookIdentityTokens(out);
  out = replaceYorkshireLocalClusterWithDemoLabels(out);
  out = replaceLogos(out);
  out = replaceMap(out);
  out = neutralizeContactActions(out);
  out = replaceAll(out, "https://yorkshirepharmacyhealthclinic.co.uk/", SALES_DEMO_BROOK_SOURCE_URL);
  out = replaceAll(out, "https://yorkshirepharmacyhealthclinic.co.uk", SALES_DEMO_BROOK_SOURCE_URL.replace(/\/$/, ""));
  out = replaceAll(out, "support@yorkshirepharmacyhealthclinic.co.uk/", "");
  out = replaceAll(out, "support@yorkshirepharmacyhealthclinic.co.uk", "");
  out = stripLeftoverYorkshireLocation(out);
  out = applyDemoNotice(out);
  out = applyBrookHomepageBrand(out);
  return out;
}

export function renderBrookSalesDemoServicePreview(slug: string, campaignId: string): {
  html: string;
  sourcePath: string | null;
  sourceRoute: string;
} {
  const allowed =
    slug === "yorkshire-pharmacy-and-health-clinic" && campaignId === "pharmacy-first";
  if (!allowed) {
    return {
      html: `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="robots" content="noindex, nofollow"/><title>Sales demo unavailable</title></head><body><p>This sales-demo Preview is not available.</p></body></html>`,
      sourcePath: null,
      sourceRoute: "sales-demo-brook-service-page-unavailable",
    };
  }
  const file = resolveVisualExperienceHtmlPath(campaignId as never, slug);
  if (!file || !fs.existsSync(file)) {
    return {
      html: `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="robots" content="noindex, nofollow"/><title>Sales demo unavailable</title></head><body><p>This sales-demo Preview is not available.</p></body></html>`,
      sourcePath: null,
      sourceRoute: "sales-demo-brook-service-page-unavailable",
    };
  }
  const base = renderBenchmarkPagePreviewHtml(file, campaignId, slug, "service-page");
  return {
    html: applyBrookSalesDemoIdentity(base),
    sourcePath: file,
    sourceRoute: "sales-demo-brook-service-page",
  };
}
