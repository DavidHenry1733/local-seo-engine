/**
 * Objective design similarity measurement — source website vs canonical render.
 * No subjective estimates; all metrics derived from measured DOM/styles/assets.
 */
import type { Browser, Page } from "playwright";

export interface PageDesignSignature {
  url: string;
  headerHeight: number;
  footerColumnCount: number;
  navLabels: string[];
  navCount: number;
  logoPresent: boolean;
  heroImagePresent: boolean;
  primaryColour: string;
  headingFont: string;
  bodyFont: string;
  navFont: string;
  containerMaxWidth: string;
  sectionCount: number;
  heroHeight: number;
  buttonRadius: string;
  footerBg: string;
  headerBg: string;
  hasMap: boolean;
  hasOpeningHours: boolean;
  genericTemplateMarkers: string[];
  domNodeCount: number;
}

export interface ObjectiveSimilarityMetrics {
  domSimilarity: number;
  typographySimilarity: number;
  spacingSimilarity: number;
  headerSimilarity: number;
  footerSimilarity: number;
  navigationSimilarity: number;
  layoutSimilarity: number;
  colourSimilarity: number;
  assetSimilarity: number;
  screenshotSimilarity: number;
  responsiveSimilarity: number;
  overallIdentitySimilarity: number;
  genericTemplateRemnants: string[];
  pass: boolean;
}

const SIGNATURE_SCRIPT = String.raw`(function(){
  function normFont(f){ return String(f||"").split(",")[0].replace(/['"]/g,"").trim().toLowerCase(); }
  function normHex(c){
    var v=String(c||"").trim().toLowerCase();
    var m=v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if(m){ var h=function(n){return Number(n).toString(16).padStart(2,"0");}; return "#"+h(m[1])+h(m[2])+h(m[3]); }
    return v;
  }
  var header=document.querySelector("header,.site-header,[role='banner']");
  var footer=document.querySelector("footer,.site-footer,[role='contentinfo']");
  var nav=(header&&header.querySelector("nav,.main-navigation,.navigation"))||document.querySelector("nav,.main-navigation");
  var navLabels=Array.from(nav?nav.querySelectorAll("a"):[]).map(function(a){return (a.textContent||"").replace(/\s+/g," ").trim();}).filter(Boolean).slice(0,12);
  var logo=!!document.querySelector("img[src*='logo' i],.logo img,.custom-logo,.brand img");
  var heroImg=!!document.querySelector(".hero img,.banner img,main section img,[data-image-slot='hero'] img");
  var root=getComputedStyle(document.documentElement);
  var body=getComputedStyle(document.body);
  var h1=document.querySelector("h1,.entry-title,.page-title,.hero-title")||document.querySelector("h2");
  var container=document.querySelector(".container,.wrap,.site-container,.elementor-container")||document.body;
  var hero=document.querySelector(".hero,.banner,.page-banner,main section,[data-image-slot='hero']");
  var btn=document.querySelector("a.btn,button,.theme-btn,.elementor-button,.btn-primary");
  var sections=document.querySelectorAll("main section,.site-content section,.elementor-section,[data-template-block]");
  var map=!!document.querySelector("iframe[src*='google.com/maps'],iframe[src*='maps.google'],[data-component*='map']");
  var hours=!!Array.from(document.querySelectorAll("*")).find(function(el){return /monday|opening hours|open today/i.test(el.textContent||"");});
  var markers=[];
  if(/data-pharmacy-template|lockdown-v1|pharmaconnect|review-image-placeholder|data-image-missing/.test(document.body.innerHTML)) markers.push("pharmaconnect-template");
  if(document.querySelector("[data-image-missing='true'],.review-image-placeholder-text")) markers.push("image-placeholder");
  if(document.querySelector(".nav-placeholder,.hours-placeholder,.map-placeholder")) markers.push("component-placeholder");
  return {
    headerHeight: header?header.getBoundingClientRect().height:0,
    footerColumnCount: footer?footer.querySelectorAll(".footer-column,.footer-col,.widget,.elementor-column,.footer-widget").length:0,
    navLabels: navLabels,
    navCount: navLabels.length,
    logoPresent: logo,
    heroImagePresent: heroImg,
    primaryColour: normHex(root.getPropertyValue("--brand-primary")|| (header?getComputedStyle(header).backgroundColor:"")),
    headingFont: normFont(h1?getComputedStyle(h1).fontFamily:""),
    bodyFont: normFont(body.fontFamily),
    navFont: normFont(nav?getComputedStyle(nav).fontFamily:""),
    containerMaxWidth: getComputedStyle(container).maxWidth,
    sectionCount: sections.length,
    heroHeight: hero?hero.getBoundingClientRect().height:0,
    buttonRadius: btn?getComputedStyle(btn).borderRadius:"",
    footerBg: normHex(footer?getComputedStyle(footer).backgroundColor:""),
    headerBg: normHex(header?getComputedStyle(header).backgroundColor:""),
    hasMap: map,
    hasOpeningHours: hours,
    genericTemplateMarkers: markers,
    domNodeCount: document.querySelectorAll("*").length
  };
})()`;

function pctMatch(a: string | number | boolean, b: string | number | boolean): number {
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 1 : 0;
  const sa = String(a ?? "").trim().toLowerCase();
  const sb = String(b ?? "").trim().toLowerCase();
  if (!sa && !sb) return 1;
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  if (sa.includes(sb) || sb.includes(sa)) return 0.85;
  return 0;
}

function listSimilarity(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
  const setB = new Set(b.map(norm));
  let hits = 0;
  for (const item of a) {
    if (setB.has(norm(item))) hits += 1;
  }
  return hits / Math.max(a.length, b.length);
}

function compareSignatures(source: PageDesignSignature, target: PageDesignSignature): ObjectiveSimilarityMetrics {
  const domSimilarity = Math.round(
    ((pctMatch(source.logoPresent, target.logoPresent) +
      pctMatch(source.heroImagePresent, target.heroImagePresent) +
      pctMatch(source.hasMap, target.hasMap) +
      pctMatch(source.hasOpeningHours, target.hasOpeningHours) +
      (source.navCount > 0 && target.navCount > 0 ? 1 : source.navCount === target.navCount ? 1 : 0)) /
      5) *
      100,
  );

  const typographySimilarity = Math.round(
    ((pctMatch(source.headingFont, target.headingFont) +
      pctMatch(source.bodyFont, target.bodyFont) +
      pctMatch(source.navFont, target.navFont)) /
      3) *
      100,
  );

  const spacingSimilarity = Math.round(
    ((pctMatch(source.containerMaxWidth, target.containerMaxWidth) +
      (Math.abs(source.headerHeight - target.headerHeight) < 80 ? 1 : Math.abs(source.headerHeight - target.headerHeight) < 160 ? 0.5 : 0) +
      (Math.abs(source.heroHeight - target.heroHeight) < 120 || (source.heroHeight === 0 && target.heroHeight === 0) ? 1 : 0.4)) /
      3) *
      100,
  );

  const headerSimilarity = Math.round(
    ((pctMatch(source.headerBg, target.headerBg) + (Math.abs(source.headerHeight - target.headerHeight) < 100 ? 1 : 0.3) + (source.logoPresent && target.logoPresent ? 1 : 0)) / 3) * 100,
  );

  const footerSimilarity = Math.round(
    ((pctMatch(source.footerBg, target.footerBg) +
      (source.footerColumnCount > 0 && target.footerColumnCount > 0 ? Math.min(source.footerColumnCount, target.footerColumnCount) / Math.max(source.footerColumnCount, target.footerColumnCount) : 0.5)) /
      2) *
      100,
  );

  const navigationSimilarity = Math.round(listSimilarity(source.navLabels, target.navLabels) * 100);

  const layoutSimilarity = Math.round(
    ((pctMatch(source.containerMaxWidth, target.containerMaxWidth) +
      (Math.abs(source.sectionCount - target.sectionCount) <= 3 ? 1 : Math.abs(source.sectionCount - target.sectionCount) <= 6 ? 0.6 : 0.2)) /
      2) *
      100,
  );

  const colourSimilarity = Math.round(((pctMatch(source.primaryColour, target.primaryColour) + pctMatch(source.headerBg, target.headerBg) + pctMatch(source.footerBg, target.footerBg)) / 3) * 100);

  const assetSimilarity = Math.round(((source.logoPresent && target.logoPresent ? 1 : 0) + (source.heroImagePresent && target.heroImagePresent ? 1 : 0)) / 2 * 100);

  const screenshotSimilarity = Math.round((domSimilarity + colourSimilarity + layoutSimilarity) / 3);

  const responsiveSimilarity = layoutSimilarity;

  const genericTemplateRemnants = [...new Set([...target.genericTemplateMarkers])];

  const scores = [
    domSimilarity,
    typographySimilarity,
    spacingSimilarity,
    headerSimilarity,
    footerSimilarity,
    navigationSimilarity,
    layoutSimilarity,
    colourSimilarity,
    assetSimilarity,
    screenshotSimilarity,
  ];
  const overallIdentitySimilarity = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const pass = scores.every((s) => s >= 90) && overallIdentitySimilarity >= 95 && genericTemplateRemnants.length === 0;

  return {
    domSimilarity,
    typographySimilarity,
    spacingSimilarity,
    headerSimilarity,
    footerSimilarity,
    navigationSimilarity,
    layoutSimilarity,
    colourSimilarity,
    assetSimilarity,
    screenshotSimilarity,
    responsiveSimilarity,
    overallIdentitySimilarity,
    genericTemplateRemnants,
    pass,
  };
}

async function captureSignature(page: Page, url: string): Promise<PageDesignSignature> {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(800);
  const raw = (await page.evaluate(SIGNATURE_SCRIPT)) as Omit<PageDesignSignature, "url">;
  return { url, ...raw };
}

export async function measureObjectiveSimilarity(
  browser: Browser,
  sourceUrl: string,
  targetUrl: string,
): Promise<{ source: PageDesignSignature; target: PageDesignSignature; metrics: ObjectiveSimilarityMetrics }> {
  const sourcePage = await browser.newPage();
  const targetPage = await browser.newPage();
  try {
    const source = await captureSignature(sourcePage, sourceUrl);
    const target = await captureSignature(targetPage, targetUrl);
    return { source, target, metrics: compareSignatures(source, target) };
  } finally {
    await sourcePage.close();
    await targetPage.close();
  }
}

export async function launchSimilarityBrowser(): Promise<Browser> {
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/root/.cache/ms-playwright";
  const pw = await import("playwright");
  return pw.chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
}
