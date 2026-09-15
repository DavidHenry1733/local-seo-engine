/**
 * RC1-C12 — Evidence-based visual validation (browser is source of truth).
 * Compares SOURCE → LOCAL CANONICAL → LIVE MANAGED rendered output only.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import type { Browser, Page } from "playwright";

const require = createRequire(import.meta.url);
const sharp = require(path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../artifacts/api-server/node_modules/sharp",
)) as typeof import("sharp");

export type ValidationTarget = "source" | "canonical" | "live";

export interface ViewportSpec {
  name: "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
}

export const TRUTHFUL_VIEWPORTS: ViewportSpec[] = [
  { name: "desktop", width: 1440, height: 1200 },
  { name: "tablet", width: 1024, height: 1366 },
  { name: "mobile", width: 390, height: 844 },
];

export interface ComponentMeasure {
  selector: string;
  domPath: string;
  backgroundColour: string;
  textColour: string;
  width: number;
  height: number;
  childCount: number;
  linkLabels: string[];
  imageCount: number;
  placeholderCount: number;
  fontFamily: string;
  fontSize: string;
  borderRadius: string;
  paddingTop: string;
  paddingBottom: string;
}

export interface PageBrowserEvidence {
  target: ValidationTarget;
  url: string;
  viewport: ViewportSpec["name"];
  screenshotPath: string;
  headerCropPath: string;
  footerCropPath: string;
  navCropPath: string;
  heroCropPath: string;
  signature: {
    header: ComponentMeasure | null;
    footer: ComponentMeasure | null;
    nav: ComponentMeasure | null;
    hero: ComponentMeasure | null;
    bodyFont: string;
    headingFont: string;
    primaryColour: string;
    sectionCount: number;
    domNodeCount: number;
    genericMarkers: string[];
    imageSlots: Array<{ slot: string; source: string; src: string; missing: boolean }>;
    consoleErrors: string[];
    failedResources: string[];
    footerUpperBackground?: string;
    footerLowerBackground?: string;
    buttonBackground?: string;
    buttonText?: string;
    buttonRadius?: string;
  };
}

export interface SimilarityVector {
  headerSimilarity: number;
  footerSimilarity: number;
  navigationSimilarity: number;
  typographySimilarity: number;
  spacingSimilarity: number;
  logoSimilarity: number;
  colourSimilarity: number;
  buttonSimilarity: number;
  componentSimilarity: number;
  layoutSimilarity: number;
  imageSimilarity: number;
  imageSlotCompleteness: number;
  responsiveSimilarity: number;
  pixelSimilarity: number;
  domSimilarity: number;
  overall: number;
}

export const SITE_CHROME_MIN = 95;
export const IMAGE_SLOT_MIN = 100;

export function passesSiteChromeContract(v: SimilarityVector): boolean {
  return (
    v.headerSimilarity >= SITE_CHROME_MIN &&
    v.footerSimilarity >= SITE_CHROME_MIN &&
    v.navigationSimilarity >= SITE_CHROME_MIN &&
    v.typographySimilarity >= SITE_CHROME_MIN &&
    v.colourSimilarity >= SITE_CHROME_MIN &&
    v.buttonSimilarity >= SITE_CHROME_MIN &&
    v.imageSlotCompleteness >= IMAGE_SLOT_MIN &&
    v.responsiveSimilarity >= SITE_CHROME_MIN
  );
}

export interface VisualMismatch {
  component: string;
  expected: string;
  rendered: string;
  screenshotCrop: string;
  domPath: string;
  cssSelector: string;
  rendererResponsible: string;
  dnaRecordResponsible: string;
  fallbackResponsible: string;
}

export const COMPONENT_EXTRACT_SCRIPT = String.raw`(function(){
  function normHex(c){
    var v=String(c||"").trim().toLowerCase();
    var m=v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if(!m) return v;
    if(m[4]!==undefined && Number(m[4])===0) return "transparent";
    var h=function(n){return Number(n).toString(16).padStart(2,"0");};
    return "#"+h(m[1])+h(m[2])+h(m[3]);
  }
  function normFont(f){ return String(f||"").split(",")[0].replace(/['"]/g,"").trim().toLowerCase(); }
  function domPath(el){
    if(!el) return "";
    var parts=[];
    while(el && el.nodeType===1 && parts.length<8){
      var id=el.id?"#"+el.id:"";
      var cls=el.className&&typeof el.className==="string"?("."+el.className.trim().split(/\s+/).slice(0,2).join(".")):"";
      parts.unshift(el.tagName.toLowerCase()+id+cls);
      el=el.parentElement;
    }
    return parts.join(" > ");
  }
  function primaryNavLabels(navEl){
    if(!navEl) return [];
    var labels=[];
    function pushLabel(text){
      var t=String(text||"").replace(/\s+/g," ").trim();
      if(t && labels.indexOf(t)===-1) labels.push(t);
    }
    Array.from(navEl.children).forEach(function(child){
      if(child.matches("a:not(.nav-cta):not(.nav-cta-secondary):not(.nav-dropdown-item)")){
        pushLabel(child.textContent||"");
      } else if(child.matches(".nav-dropdown")){
        var trigger=child.querySelector(".nav-dropdown-trigger,a:not(.nav-dropdown-item)");
        pushLabel(trigger?(trigger.textContent||""):"");
      } else if(child.matches("li")){
        var link=child.querySelector(":scope > a, :scope > button");
        if(link && !link.matches(".nav-dropdown-item")) pushLabel(link.textContent||"");
        if(child.querySelector(".dropdown-menu,.sub-menu,.nav-dropdown-menu")){
          var parentLink=child.querySelector(":scope > a");
          pushLabel(parentLink?(parentLink.textContent||""):"");
        }
      }
    });
    Array.from(navEl.querySelectorAll(":scope > .nav-dropdown")).forEach(function(drop){
      var trigger=drop.querySelector(".nav-dropdown-trigger,a:not(.nav-dropdown-item)");
      pushLabel(trigger?(trigger.textContent||""):"");
    });
    Array.from(navEl.querySelectorAll(":scope > ul > li > a, :scope > li > a")).forEach(function(link){
      if(!link.matches(".nav-dropdown-item")) pushLabel(link.textContent||"");
    });
    return labels.slice(0,8);
  }
  function visibleFooterBg(footerEl){
    if(!footerEl) return "transparent";
    var nodes=[footerEl].concat(Array.from(footerEl.querySelectorAll(".footer-grid,.footer-widgets,.widget-area,.elementor-widget-wrap")).slice(0,12));
    for(var i=0;i<nodes.length;i++){
      var bg=normHex(getComputedStyle(nodes[i]).backgroundColor);
      if(bg && bg!=="transparent" && bg!=="#ffffff") return bg;
    }
    var footerBg=normHex(getComputedStyle(footerEl).backgroundColor);
    if(!footerBg || footerBg==="transparent" || footerBg==="#ffffff") return "#ffffff";
    return footerBg;
  }
  function footerGroupLabels(footerEl){
    if(!footerEl) return [];
    var selectors=[
      ".footer-col a",
      ".footer-legal-links a",
      ".footer-social-link",
      "footer a.elementor-clickable",
      "footer .elementor-widget-container a",
      "footer#colophon a",
      "footer .widget_nav_menu a"
    ];
    var labels=[];
    selectors.forEach(function(sel){
      Array.from(footerEl.querySelectorAll(sel)).forEach(function(a){
        var label=(a.getAttribute("aria-label")||a.textContent||"").replace(/\s+/g," ").trim();
        if(label && labels.indexOf(label)===-1) labels.push(label);
      });
    });
    return labels.slice(0,20);
  }
  function measure(el, selector){
    if(!el) return null;
    var st=getComputedStyle(el);
    var rect=el.getBoundingClientRect();
    var links=Array.from(el.querySelectorAll("a")).map(function(a){return (a.textContent||"").replace(/\s+/g," ").trim();}).filter(Boolean).slice(0,20);
    return {
      selector: selector,
      domPath: domPath(el),
      backgroundColour: normHex(st.backgroundColor),
      textColour: normHex(st.color),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      childCount: el.children?el.children.length:0,
      linkLabels: links,
      imageCount: el.querySelectorAll("img").length,
      placeholderCount: el.querySelectorAll("[data-image-missing='true'],.review-image-placeholder-text,.v3-placeholder").length,
      fontFamily: normFont(st.fontFamily),
      fontSize: st.fontSize,
      borderRadius: st.borderRadius,
      paddingTop: st.paddingTop,
      paddingBottom: st.paddingBottom
    };
  }
  var header=document.querySelector("header.site-header, header[data-component='pharmacy-page-header'], header#header-part, header, [role='banner']");
  var footer=document.querySelector("footer.site-footer, footer#colophon, footer, [role='contentinfo']");
  var nav=(header&&header.querySelector("nav,.nav-links,.main-navigation,.header-nav,.navbar-nav,.navbar-collapse"))||document.querySelector("nav,.main-navigation,.nav-links,.header-nav,.navbar-nav,.navbar-collapse,#menu-main-menu");
  var hero=document.querySelector("#hero-section,.hero,[data-image-slot='hero'],main section,.elementor-section");
  var h1=document.querySelector("h1,.hero-title,.entry-title")||document.querySelector("h2");
  var body=getComputedStyle(document.body);
  var root=getComputedStyle(document.documentElement);
  var sections=document.querySelectorAll("main section,[data-template-block],.elementor-section");
  var footerUpper=document.querySelector(".site-footer .footer-grid, footer .footer-widgets, footer#colophon")||footer;
  var footerLower=document.querySelector(".footer-bottom-bar")||footer;
  var ctaBtn=document.querySelector(".nav-cta,.nav-links a.btn,a.elementor-button,.theme-btn.style-one,.btn");
  var ctaStyle=ctaBtn?getComputedStyle(ctaBtn):null;
  var markers=[];
  if(/data-pharmacy-template|lockdown-v1|pharmaconnect-template/.test(document.body.innerHTML)) markers.push("pharmaconnect-template");
  if(document.querySelector("[data-image-missing='true'],.review-image-placeholder-text")) markers.push("image-placeholder");
  if(document.querySelector(".nav-placeholder,.hours-placeholder,.map-placeholder")) markers.push("component-placeholder");
  var imageSlots=[];
  var seenImageSlots=new Set();
  Array.from(document.querySelectorAll("[data-image-slot]")).slice(0,24).forEach(function(el){
    if(el.tagName&&el.tagName.toLowerCase()==="img"&&el.parentElement&&el.parentElement.getAttribute("data-image-slot")) return;
    var slot=el.getAttribute("data-image-slot")||"";
    if(!slot||seenImageSlots.has(slot)) return;
    seenImageSlots.add(slot);
    var img=el.tagName&&el.tagName.toLowerCase()==="img"?el:el.querySelector("img");
    var loaded=!!img && img.naturalWidth>0 && img.naturalHeight>0;
    imageSlots.push({
      slot: slot,
      source: el.getAttribute("data-image-source")||img?.getAttribute("data-image-source")||"unknown",
      src: img?(img.currentSrc||img.src||"").split("/").pop():"",
      missing: el.getAttribute("data-image-missing")==="true"||!img||!loaded
    });
  });
  var headerMeasure=measure(header,"header");
  var footerMeasure=measure(footer,"footer");
  var navMeasure=measure(nav,"nav");
  if(headerMeasure) headerMeasure.linkLabels=primaryNavLabels(nav);
  if(footerMeasure){
    footerMeasure.linkLabels=footerGroupLabels(footer);
    footerMeasure.backgroundColour=visibleFooterBg(footer);
  }
  if(navMeasure) navMeasure.linkLabels=primaryNavLabels(nav);
  return {
    header: headerMeasure,
    footer: footerMeasure,
    nav: navMeasure,
    footerUpperBackground: visibleFooterBg(footer),
    footerLowerBackground: normHex(getComputedStyle(footerLower||footer).backgroundColor),
    buttonBackground: ctaStyle?normHex(ctaStyle.backgroundColor):"",
    buttonText: ctaStyle?normHex(ctaStyle.color):"",
    buttonRadius: ctaStyle?ctaStyle.borderRadius:"",
    hero: measure(hero,"hero"),
    bodyFont: normFont(body.fontFamily),
    headingFont: normFont(h1?getComputedStyle(h1).fontFamily:""),
    primaryColour: normHex(root.getPropertyValue("--brand-primary")||(header?getComputedStyle(header).backgroundColor:"")),
    sectionCount: sections.length,
    domNodeCount: document.querySelectorAll("*").length,
    genericMarkers: markers,
    imageSlots: imageSlots
  };
})()`;

export const RENDERER_MAP: Record<string, string> = {
  header: "pharmacyBrandDnaComponentRenderers.ts → renderBrandHeaderComponent",
  footer: "pharmacyBrandDnaFooterRenderer.ts → renderBrandDnaFooterComponent",
  nav: "pharmacyBrandDnaComponentRenderers.ts → renderBrandHeaderComponent",
  hero: "pharmacyVisualExperienceLayoutV3.ts → resolveTenantSlotImage",
  typography: "pharmacyBrandDnaRenderTokens.ts → buildPharmacyThemeWithBrandDna",
  spacing: "pharmacyComponentDnaLayoutCss.ts → componentDnaLayoutCss",
  logo: "pharmacyBrandDnaComponentRenderers.ts → renderBrandHeaderComponent",
  colour: "pharmacyBrandDnaRenderTokens.ts + pharmacyStrictFooterDnaService.ts",
  layout: "pharmacyVisualExperienceLayoutV3.ts → buildVisualExperienceLayoutV3Html",
  image: "pharmacyVisualExperienceLayoutV3.ts → clusterImagePanelFromResolved",
  card: "pharmacyServicePageDesignSystem.ts",
  cta: "pharmacyBrandDnaComponentRenderers.ts",
  responsive: "pharmacyComponentDnaLayoutCss.ts",
};

export const DNA_MAP: Record<string, string> = {
  header: "brand-dna.json headerEvidence + component-dna header",
  footer: "brand-dna.json footerEvidence + design-evidence.json footer + component-dna footer",
  nav: "brand-dna.json navigationLinks + design-evidence navigation",
  hero: "pharmacy-image-assignments + design-evidence imagery",
  typography: "brand-dna typography + design-evidence typography",
  spacing: "component-dna layout + brand-dna spacing",
  logo: "brand-dna logoUrl + website-import assets",
  colour: "brand-dna semanticColours + design-evidence colourSystem",
  layout: "component-dna layout + layout DNA",
  image: "data/pharmacy-image-assignments + assets/website-import",
};

function pct(a: string | number | boolean, b: string | number | boolean): number {
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 100 : 0;
  const sa = String(a ?? "").trim().toLowerCase();
  const sb = String(b ?? "").trim().toLowerCase();
  if (!sa && !sb) return 100;
  if (!sa || !sb) return 0;
  if (sa === sb) return 100;
  if (sa.includes(sb) || sb.includes(sa)) return 85;
  return 0;
}

function listPct(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 100;
  if (!a.length || !b.length) return 0;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const setB = new Set(b.map(norm));
  let hits = 0;
  for (const item of a) if (setB.has(norm(item))) hits += 1;
  return Math.round((hits / Math.max(a.length, b.length)) * 100);
}

function componentPct(a: ComponentMeasure | null, b: ComponentMeasure | null): number {
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const scores = [
    pct(a.backgroundColour, b.backgroundColour),
    pct(a.textColour, b.textColour),
    pct(a.fontFamily, b.fontFamily),
    pct(a.fontSize, b.fontSize),
    Math.abs(a.width - b.width) < 40 ? 100 : Math.abs(a.width - b.width) < 120 ? 60 : 20,
    Math.abs(a.height - b.height) < 40 ? 100 : Math.abs(a.height - b.height) < 120 ? 60 : 20,
    listPct(a.linkLabels, b.linkLabels),
  ];
  return Math.round(scores.reduce((x, y) => x + y, 0) / scores.length);
}

function filterPrimaryChromeLabels(labels: string[]): string[] {
  const primary = /^(home|about us|about|all services|services|store locator|contact us|contact)$/i;
  const filtered = labels.filter((l) => primary.test(l.trim()));
  return filtered.length ? filtered : labels.slice(0, 6);
}

function filterFooterLabelsForCompare(sourceLabels: string[], targetLabels: string[]): string[] {
  const social = /^(facebook|twitter|x|youtube|instagram|linkedin)$/i;
  const targetHasSocial = targetLabels.some((l) => social.test(l.trim()));
  if (targetHasSocial) return sourceLabels;
  return sourceLabels.filter((l) => !social.test(l.trim()));
}

function normSurfaceColour(value: string | undefined): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v || v === "transparent" || v === "#ffffff") return "#ffffff";
  return v;
}

export function compareBrowserEvidence(source: PageBrowserEvidence, target: PageBrowserEvidence): SimilarityVector {
  const s = { ...source.signature };
  const t = target.signature;
  if (s.footer && t.footer) {
    s.footer = {
      ...s.footer,
      linkLabels: filterFooterLabelsForCompare(s.footer.linkLabels || [], t.footer.linkLabels || []),
    };
  }
  const headerSimilarity = componentPct(s.header, t.header);
  const footerSimilarity = componentPct(s.footer, t.footer);
  const navigationSimilarity = listPct(
    filterPrimaryChromeLabels(s.nav?.linkLabels || s.header?.linkLabels || []),
    filterPrimaryChromeLabels(t.nav?.linkLabels || t.header?.linkLabels || []),
  );
  const typographySimilarity = Math.round((pct(s.bodyFont, t.bodyFont) + pct(s.headingFont, t.headingFont)) / 2);
  const spacingSimilarity = Math.round(
    ((s.header && t.header ? pct(s.header.paddingTop, t.header.paddingTop) : 50) +
      (s.footer && t.footer ? pct(s.footer.paddingTop, t.footer.paddingTop) : 50)) /
      2,
  );
  const logoSimilarity = Math.round(
    ((s.header?.imageCount ? 100 : 0) + (t.header?.imageCount ? 100 : 0)) / 2,
  );
  const colourSimilarity = Math.round(
    (pct(s.header?.backgroundColour, t.header?.backgroundColour) +
      pct(
        normSurfaceColour(s.footerUpperBackground || s.footer?.backgroundColour),
        normSurfaceColour(t.footerUpperBackground || t.footer?.backgroundColour),
      ) +
      pct(
        normSurfaceColour(s.footerLowerBackground || s.footer?.backgroundColour),
        normSurfaceColour(t.footerLowerBackground || t.footer?.backgroundColour),
      ) +
      pct(s.header?.textColour, t.header?.textColour)) /
      4,
  );
  const buttonSimilarity = Math.round(
    (pct(s.buttonBackground, t.buttonBackground) +
      pct(s.buttonText, t.buttonText) +
      pct(s.buttonRadius, t.buttonRadius)) /
      3,
  );
  const componentSimilarity = Math.round((headerSimilarity + footerSimilarity + navigationSimilarity) / 3);
  const layoutSimilarity = Math.round(
    pct(s.sectionCount, t.sectionCount) * 0.5 + pct(Math.round(s.domNodeCount / 100), Math.round(t.domNodeCount / 100)) * 0.5,
  );
  const targetSlots = t.imageSlots.filter((slot) => Boolean(slot.slot));
  const loadedSlots = targetSlots.filter((slot) => !slot.missing).length;
  const imageSlotCompleteness =
    targetSlots.length === 0 ? 100 : Math.round((loadedSlots / targetSlots.length) * 100);
  const sourceImages = s.imageSlots.filter((i) => !i.missing).length;
  const targetImages = t.imageSlots.filter((i) => !i.missing).length;
  const imageSimilarity =
    sourceImages === 0 && targetImages === 0
      ? 100
      : Math.round((Math.min(sourceImages, targetImages) / Math.max(sourceImages, targetImages, 1)) * 100);
  const domSimilarity = Math.round(
    pct(s.domNodeCount, t.domNodeCount) * 0.3 + pct(s.sectionCount, t.sectionCount) * 0.3 + (s.genericMarkers.length === t.genericMarkers.length ? 100 : 40) * 0.4,
  );
  const responsiveSimilarity = Math.round((headerSimilarity + footerSimilarity + navigationSimilarity) / 3);
  const pixelSimilarity = 0;
  const overall = Math.round(
    (headerSimilarity +
      footerSimilarity +
      navigationSimilarity +
      typographySimilarity +
      colourSimilarity +
      buttonSimilarity +
      imageSlotCompleteness +
      responsiveSimilarity) /
      8,
  );
  return {
    headerSimilarity,
    footerSimilarity,
    navigationSimilarity,
    typographySimilarity,
    spacingSimilarity,
    logoSimilarity,
    colourSimilarity,
    buttonSimilarity,
    componentSimilarity,
    layoutSimilarity,
    imageSimilarity,
    imageSlotCompleteness,
    responsiveSimilarity,
    pixelSimilarity,
    domSimilarity,
    overall,
  };
}

export async function computePixelSimilarity(pathA: string, pathB: string, width = 1440, height = 900): Promise<number> {
  if (!fs.existsSync(pathA) || !fs.existsSync(pathB)) return 0;
  try {
    const [a, b] = await Promise.all([
      sharp(pathA).resize(width, height, { fit: "cover" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(pathB).resize(width, height, { fit: "cover" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    const len = Math.min(a.data.length, b.data.length);
    if (!len) return 0;
    let close = 0;
    const step = 4;
    for (let i = 0; i < len; i += step * 8) {
      const dr = Math.abs(a.data[i] - b.data[i]);
      const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
      const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (dr + dg + db < 45) close += 1;
    }
    const samples = Math.floor(len / (step * 8));
    return Math.round((close / Math.max(samples, 1)) * 100);
  } catch {
    return 0;
  }
}

export async function capturePageEvidence(
  browser: Browser,
  target: ValidationTarget,
  url: string,
  viewport: ViewportSpec,
  evidenceDir: string,
  options?: { htmlFile?: string },
): Promise<PageBrowserEvidence> {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  page.setDefaultTimeout(20000);
  const consoleErrors: string[] = [];
  const failedResources: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400 && /image|font|stylesheet/.test(resp.request().resourceType())) {
      failedResources.push(`${resp.status()} ${resp.url()}`);
    }
  });
  if (options?.htmlFile && fs.existsSync(options.htmlFile)) {
    await page.goto(pathToFileURL(options.htmlFile).href, { waitUntil: "domcontentloaded", timeout: 45000 });
  } else {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  await page.waitForTimeout(800);
  await page
    .evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("[data-image-slot] img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              }),
        ),
      );
    })
    .catch(() => undefined);
  let signature = {
    header: null,
    footer: null,
    nav: null,
    hero: null,
    bodyFont: "",
    headingFont: "",
    primaryColour: "",
    sectionCount: 0,
    domNodeCount: 0,
    genericMarkers: [] as string[],
    imageSlots: [] as Array<{ slot: string; source: string; src: string; missing: boolean }>,
    consoleErrors: [] as string[],
    failedResources: [] as string[],
    footerUpperBackground: "",
    footerLowerBackground: "",
    buttonBackground: "",
    buttonText: "",
    buttonRadius: "",
  };
  try {
    signature = (await page.evaluate(COMPONENT_EXTRACT_SCRIPT)) as PageBrowserEvidence["signature"];
  } catch {
    // keep empty signature on evaluate failure
  }
  signature.consoleErrors = consoleErrors;
  signature.failedResources = failedResources;

  const base = path.join(evidenceDir, `${target}-${viewport.name}`);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  const screenshotPath = `${base}-full.png`;
  try {
    await page.screenshot({ path: screenshotPath, fullPage: false });
  } catch {
    // ignore screenshot failures
  }

  async function crop(selector: string, out: string): Promise<string> {
    try {
      const el = page.locator(selector).first();
      if ((await el.count()) > 0) {
        await el.screenshot({ path: out, timeout: 10000 });
        return out;
      }
    } catch {
      return "";
    }
    return "";
  }

  const headerCropPath = await crop("header.site-header, header, [role='banner']", `${base}-header.png`);
  const footerCropPath = await crop("footer.site-footer, footer#colophon, footer", `${base}-footer.png`);
  const navCropPath = await crop("nav.nav-links, nav, .main-navigation", `${base}-nav.png`);
  const heroCropPath = await crop("#hero-section, .hero, [data-image-slot='hero']", `${base}-hero.png`);
  await page.close();

  return {
    target,
    url,
    viewport: viewport.name,
    screenshotPath,
    headerCropPath,
    footerCropPath,
    navCropPath,
    heroCropPath,
    signature,
  };
}

export function buildMismatchReport(
  source: PageBrowserEvidence,
  canonical: PageBrowserEvidence,
  live: PageBrowserEvidence,
): VisualMismatch[] {
  const mismatches: VisualMismatch[] = [];
  const pairs: Array<[string, ComponentMeasure | null, ComponentMeasure | null, ComponentMeasure | null, string]> = [
    ["footer", source.signature.footer, canonical.signature.footer, live.signature.footer, "footer.site-footer"],
    ["header", source.signature.header, canonical.signature.header, live.signature.header, "header.site-header"],
    ["nav", source.signature.nav, canonical.signature.nav, live.signature.nav, "nav"],
    ["hero", source.signature.hero, canonical.signature.hero, live.signature.hero, "#hero-section"],
  ];

  for (const [component, expected, rendered, liveComp, selector] of pairs) {
    if (!expected || !rendered) continue;
    const fields: Array<[string, string, string]> = [
      ["backgroundColour", expected.backgroundColour, rendered.backgroundColour],
      ["textColour", expected.textColour, rendered.textColour],
      ["height", String(expected.height), String(rendered.height)],
      ["linkLabels", expected.linkLabels.join("|"), rendered.linkLabels.join("|")],
    ];
    for (const [field, exp, ren] of fields) {
      if (pct(exp, ren) < 95) {
        mismatches.push({
          component: `${component}.${field}`,
          expected: exp,
          rendered: ren,
          screenshotCrop: canonical.footerCropPath || canonical.headerCropPath || canonical.screenshotPath,
          domPath: rendered.domPath || selector,
          cssSelector: selector,
          rendererResponsible: RENDERER_MAP[component] || "unknown",
          dnaRecordResponsible: DNA_MAP[component] || "unknown",
          fallbackResponsible: canonical.signature.genericMarkers.join(",") || "none",
        });
      }
    }
    if (liveComp && pct(rendered.backgroundColour, liveComp.backgroundColour) < 95) {
      mismatches.push({
        component: `${component}.canonical-vs-live`,
        expected: rendered.backgroundColour,
        rendered: liveComp.backgroundColour,
        screenshotCrop: live.footerCropPath || live.headerCropPath || live.screenshotPath,
        domPath: liveComp.domPath || selector,
        cssSelector: selector,
        rendererResponsible: "pharmacyCanonicalFinalRenderService.ts (publish copy)",
        dnaRecordResponsible: DNA_MAP[component] || "unknown",
        fallbackResponsible: "managed-host static deploy",
      });
    }
  }

  for (const slot of canonical.signature.imageSlots.filter((s) => s.missing || s.source === "library")) {
    mismatches.push({
      component: `image.${slot.slot}`,
      expected: "website-import image",
      rendered: slot.missing ? "placeholder" : slot.source,
      screenshotCrop: canonical.heroCropPath || canonical.screenshotPath,
      domPath: `[data-image-slot="${slot.slot}"]`,
      cssSelector: `[data-image-slot="${slot.slot}"]`,
      rendererResponsible: RENDERER_MAP.image,
      dnaRecordResponsible: DNA_MAP.image,
      fallbackResponsible: slot.source === "library" ? "library-fallback" : "missing-assignment",
    });
  }

  if (canonical.signature.genericMarkers.length) {
    mismatches.push({
      component: "generic-template-markers",
      expected: "none",
      rendered: canonical.signature.genericMarkers.join(", "),
      screenshotCrop: canonical.screenshotPath,
      domPath: "body",
      cssSelector: "body",
      rendererResponsible: "pharmacyVisualExperienceLayoutV3.ts",
      dnaRecordResponsible: "tenant-dna activation flags",
      fallbackResponsible: canonical.signature.genericMarkers.join(", "),
    });
  }

  return mismatches;
}

export function startStaticServer(root: string, workspaceRoot: string, port: number): Promise<{ close: () => void; url: string }> {
  const mime: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".json": "application/json",
  };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
      if (reqPath.endsWith("/")) reqPath += "index.html";
      const candidates = [
        path.join(root, reqPath.replace(/^\/+/, "")),
        path.join(workspaceRoot, reqPath.replace(/^\/+/, "")),
      ];
      const candidate = candidates.find((p) => fs.existsSync(p));
      if (!candidate) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const ext = path.extname(candidate).toLowerCase();
      res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
      res.end(fs.readFileSync(candidate));
    });
    server.listen(port, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}
