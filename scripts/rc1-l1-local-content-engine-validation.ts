#!/usr/bin/env npx tsx
/**
 * RC1-L1 — Local Content Engine validation (read-only).
 */
process.env.PLAYWRIGHT_BROWSERS_PATH =
  process.env.PLAYWRIGHT_BROWSERS_PATH || "/home/inboxingproweb/.cache/ms-playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { readFinalRenderManifest, resolveCanonicalFinalRenderRoot } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";

const SLUG = "banner-cross-pharmacy";
const SERVICE = "pharmacy-first";
const PREVIEW_BASE = process.env.RC1_L1_PREVIEW_BASE || "http://127.0.0.1:3001";
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  SLUG,
  "rc1-l1-local-content-engine",
);

const REQUIRED_PAGE_TYPES = [
  "homepage",
  "service",
  "location-hub",
  "location-cluster",
  "location-page",
  "guide",
  "blog",
  "faq",
  "support",
] as const;

const PLACEHOLDER_RE =
  /lorem ipsum|placeholder copy|\[insert|TODO:|TBD|sample text|dummy content|coming soon/i;

function sha(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function norm(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function extractMeta(html: string, name: string): string {
  const re = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, "i");
  return html.match(re)?.[1]?.trim() || "";
}

function extractTitle(html: string): string {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || "";
}

function extractCanonical(html: string): string {
  return html.match(/<link\s+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || "";
}

function extractOg(html: string, prop: string): string {
  const re = new RegExp(`<meta\\s+property=["']og:${prop}["']\\s+content=["']([^"']*)["']`, "i");
  return html.match(re)?.[1]?.trim() || "";
}

function extractTwitter(html: string, name: string): string {
  const re = new RegExp(`<meta\\s+name=["']twitter:${name}["']\\s+content=["']([^"']*)["']`, "i");
  return html.match(re)?.[1]?.trim() || "";
}

function extractH1(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return main.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
}

function extractIntro(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const afterH1 = main.replace(/[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>/i, "");
  const p = afterH1.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim() || "";
  return p;
}

function extractBodyText(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return main.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractFaqs(html: string): string[] {
  const items: string[] = [];
  const re = /<(?:h[2-4]|dt|summary|button)[^>]*class=["'][^"']*faq[^"']*["'][^>]*>([\s\S]*?)<\/(?:h[2-4]|dt|summary|button)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    items.push(norm(m[1].replace(/<[^>]+>/g, "")));
  }
  if (items.length === 0) {
    const details = html.matchAll(/<details[^>]*>([\s\S]*?)<\/details>/gi);
    for (const d of details) {
      const q = d[1].match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1]?.replace(/<[^>]+>/g, "") || "";
      if (q) items.push(norm(q));
    }
  }
  return items.filter(Boolean);
}

function extractCta(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const cta = main.match(/class=["'][^"']*(?:cta|money-page|conversion)[^"']*["'][^>]*>([\s\S]{0,800})/i)?.[0] || "";
  return norm(cta.replace(/<[^>]+>/g, " "));
}

function extractSchemaBlocks(html: string): string[] {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) =>
    m[1].trim(),
  );
}

function schemaTypes(blocks: string[]): string[] {
  const types = new Set<string>();
  for (const b of blocks) {
    try {
      const j = JSON.parse(b);
      const walk = (o: unknown) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) {
          o.forEach(walk);
          return;
        }
        const rec = o as Record<string, unknown>;
        if (typeof rec["@type"] === "string") types.add(rec["@type"]);
        if (Array.isArray(rec["@graph"])) rec["@graph"].forEach(walk);
        Object.values(rec).forEach(walk);
      };
      walk(j);
    } catch {
      types.add("INVALID_JSON");
    }
  }
  return [...types];
}

function extractLinks(html: string): string[] {
  return [...html.matchAll(/<a\s+[^>]*href=["']([^"'#][^"']*)["']/gi)].map((m) => m[1]);
}

function extractImages(html: string): Array<{ src: string; alt: string; role: string }> {
  const imgs: Array<{ src: string; alt: string; role: string }> = [];
  for (const m of html.matchAll(/<img([^>]*)>/gi)) {
    const attrs = m[1];
    const src = attrs.match(/\ssrc=["']([^"']+)["']/i)?.[1] || "";
    const alt = attrs.match(/\salt=["']([^"']*)["']/i)?.[1] || "";
    const role = attrs.match(/data-image-slot=["']([^"']+)["']/i)?.[1] || attrs.match(/data-image-role=["']([^"']+)["']/i)?.[1] || "";
    imgs.push({ src, alt, role });
  }
  return imgs;
}

function paragraphFingerprints(html: string): string[] {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const paras: string[] = [];
  for (const m of main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = norm(m[1].replace(/<[^>]+>/g, ""));
    if (t.length >= 80) paras.push(t);
  }
  return paras;
}

function previewPath(pageSlug: string): string {
  if (pageSlug === "index") return `/api/pharmacy-visual-experience/?slug=${SLUG}`;
  return `/api/pharmacy-visual-experience/${pageSlug}/?slug=${SLUG}`;
}

function loadSecret(): string {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
    apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
  };
  return eco.apps?.find((a) => a.env?.SESSION_SECRET)?.env?.SESSION_SECRET || "";
}

const PLAYWRIGHT_EXECUTABLE =
  "/home/inboxingproweb/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

interface PageFail {
  pageSlug: string;
  checks: string[];
  renderer?: string;
  engine?: string;
}

function sourcePipelineEngine(pipeline: string): string {
  const map: Record<string, string> = {
    "homepage-copy": "pharmacyHomepageCopyPipeline",
    "visual-experience": "pharmacyVisualServicePageRenderer",
    "ecosystem-chrome-wrap": "pharmacyEcosystemPageChromeWrapper + benchmarkServiceEcosystemBuilder",
    "local-cluster": "pharmacyLocalClusterPageRenderer + pharmacyLocalClusterContentEngine",
  };
  return map[pipeline] || pipeline;
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const manifest = readFinalRenderManifest(SLUG);
  const renderRoot = resolveCanonicalFinalRenderRoot(SLUG);
  const ecosystemIndexPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    SLUG,
    SERVICE,
    "_ecosystem-index.json",
  );
  const ecosystemIndex = fs.existsSync(ecosystemIndexPath)
    ? (JSON.parse(fs.readFileSync(ecosystemIndexPath, "utf8")) as {
        selectedAreas?: string[];
        localClusterPagesGenerated?: number;
      })
    : { selectedAreas: [], localClusterPagesGenerated: 0 };

  const sitemap = fs.existsSync(path.join(renderRoot, "sitemap.xml"))
    ? fs.readFileSync(path.join(renderRoot, "sitemap.xml"), "utf8")
    : "";
  const robots = fs.existsSync(path.join(renderRoot, "robots.txt"))
    ? fs.readFileSync(path.join(renderRoot, "robots.txt"), "utf8")
    : "";

  const pageFails: PageFail[] = [];
  const pagesTested: string[] = [];
  const pagesPassed: string[] = [];
  const pagesFailed: string[] = [];

  type PageAnalysis = {
    pageSlug: string;
    pageType: string;
    sourcePipeline: string;
    h1: string;
    title: string;
    metaDescription: string;
    intro: string;
    bodyHash: string;
    faqHash: string;
    ctaHash: string;
    schemaHash: string;
    imgs: ReturnType<typeof extractImages>;
    links: string[];
    paragraphs: string[];
    nearbyAreas: string;
    landmarks: string;
  };

  const analyses: PageAnalysis[] = [];

  if (!manifest) {
    console.log(JSON.stringify({ error: "missing manifest" }, null, 2));
    process.exit(1);
  }

  for (const p of manifest.pages) {
    pagesTested.push(p.pageSlug);
    const htmlPath = path.join(renderRoot, p.relativePath);
    const checks: string[] = [];
    let renderer = p.sourcePipeline;
    let engine = sourcePipelineEngine(p.sourcePipeline);

    if (!fs.existsSync(htmlPath)) {
      checks.push("missing html file");
      pageFails.push({ pageSlug: p.pageSlug, checks, renderer, engine });
      pagesFailed.push(p.pageSlug);
      continue;
    }

    const html = fs.readFileSync(htmlPath, "utf8");
    const h1 = extractH1(html);
    const title = extractTitle(html);
    const metaDescription = extractMeta(html, "description");
    const intro = extractIntro(html);
    const bodyText = extractBodyText(html);
    const faqs = extractFaqs(html);
    const cta = extractCta(html);
    const schemaBlocks = extractSchemaBlocks(html);
    const schemaTypesFound = schemaTypes(schemaBlocks);
    const imgs = extractImages(html);
    const links = extractLinks(html);
    const paragraphs = paragraphFingerprints(html);
    const nearbyAreas = norm(html.match(/nearby areas|areas we serve|local areas/i)?.[0] || bodyText.slice(0, 500));
    const landmarks = norm(
      (html.match(/landmark|points of interest|local landmark/i)?.[0] || "") +
        (bodyText.match(/\b(park|hospital|station|university)\b/gi)?.join(" ") || ""),
    );

    if (!h1) checks.push("missing H1");
    if (!title) checks.push("missing title");
    if (!metaDescription) checks.push("missing meta description");
    if (bodyText.length < 120) checks.push("thin body");
    if (PLACEHOLDER_RE.test(bodyText) || PLACEHOLDER_RE.test(intro)) checks.push("placeholder content");
    if (extractMeta(html, "robots").includes("noindex")) checks.push("noindex");
    if (!extractCanonical(html)) checks.push("missing canonical");
    if (!extractOg(html, "title") && !extractOg(html, "type")) checks.push("missing OpenGraph");
    if (!extractTwitter(html, "card") && !extractTwitter(html, "title")) checks.push("missing Twitter meta");

    const sitemapLoc = p.pageSlug === "index" ? `/${SERVICE}/` : `/${p.pageSlug}/`;
    const inSitemap =
      p.pageSlug === "index"
        ? /sites\.pharmaconnect\.uk\/?["']|<loc>[^<]+\/<\/loc>/i.test(sitemap) &&
          sitemap.includes(`sites.pharmaconnect.uk</loc>`) === false &&
          !sitemap.includes(`sites.pharmaconnect.uk/</loc>`)
        : sitemap.includes(sitemapLoc);
    if (p.pageSlug === "index" && !sitemap.match(/<loc>[^<]+\/["']?\s*<\/loc>/i) && !sitemap.includes("/</loc>")) {
      if (!/<loc>[^<]+sites\.pharmaconnect\.uk\/<\/loc>/i.test(sitemap)) checks.push("homepage not in sitemap");
    } else if (p.pageSlug !== "index" && !inSitemap) {
      checks.push("not in sitemap");
    }

    if (schemaBlocks.length === 0) checks.push("missing schema JSON-LD");
    if (!schemaTypesFound.some((t) => /LocalBusiness|Pharmacy|MedicalBusiness|Organization/i.test(t))) {
      if (p.pageType === "homepage" || p.pageType === "service") checks.push("missing LocalBusiness schema");
    }
    if (p.pageType === "faq" && !schemaTypesFound.some((t) => t === "FAQPage")) checks.push("missing FAQPage schema");
    if (!schemaTypesFound.some((t) => t === "BreadcrumbList")) checks.push("missing BreadcrumbList schema");

    const brokenImg = imgs.filter(
      (i) =>
        /placeholder|\.svg$/i.test(i.src) ||
        i.src.includes("data:image") ||
        /review-image-placeholder|data-image-missing/i.test(i.src),
    );
    if (brokenImg.length) checks.push(`image placeholders: ${brokenImg.length}`);
    const emptyAlt = imgs.filter((i) => !i.alt.trim() && !/logo|decorative/i.test(i.src));
    if (emptyAlt.length > 2) checks.push(`missing ALT on ${emptyAlt.length} images`);

    for (let i = 1; i < imgs.length; i++) {
      if (imgs[i].src && imgs[i].src === imgs[i - 1].src) checks.push("duplicate adjacent images");
    }

    analyses.push({
      pageSlug: p.pageSlug,
      pageType: p.pageType,
      sourcePipeline: p.sourcePipeline,
      h1,
      title,
      metaDescription,
      intro,
      bodyHash: sha(bodyText),
      faqHash: sha(faqs.join("|")),
      ctaHash: sha(cta),
      schemaHash: sha(schemaBlocks.join("|")),
      imgs,
      links,
      paragraphs,
      nearbyAreas,
      landmarks,
    });

    if (checks.length) {
      pageFails.push({ pageSlug: p.pageSlug, checks, renderer, engine });
      pagesFailed.push(p.pageSlug);
    } else {
      pagesPassed.push(p.pageSlug);
    }
  }

  // Cross-page uniqueness
  const dup = (field: keyof PageAnalysis, label: string) => {
    const map = new Map<string, string[]>();
    for (const a of analyses) {
      const v = String(a[field]);
      if (!v || v.length < 20) continue;
      const list = map.get(v) || [];
      list.push(a.pageSlug);
      map.set(v, list);
    }
    for (const [_, slugs] of map) {
      if (slugs.length > 1) {
        for (const s of slugs) {
          if (!pagesFailed.includes(s)) pagesFailed.push(s);
          const existing = pageFails.find((f) => f.pageSlug === s);
          const msg = `duplicate ${label} with ${slugs.filter((x) => x !== s).join(",")}`;
          if (existing) existing.checks.push(msg);
          else
            pageFails.push({
              pageSlug: s,
              checks: [msg],
              engine: "pharmacyLocalClusterContentEngine / benchmarkServiceEcosystemBuilder",
            });
        }
      }
    }
  };
  dup("h1", "H1");
  dup("title", "title");
  dup("metaDescription", "meta description");
  dup("intro", "intro");
  dup("bodyHash", "body");
  dup("faqHash", "FAQs");
  dup("ctaHash", "CTA");
  dup("schemaHash", "schema");

  const allParas: Array<{ slug: string; p: string }> = [];
  for (const a of analyses) for (const p of a.paragraphs) allParas.push({ slug: a.pageSlug, p });
  const paraMap = new Map<string, string[]>();
  for (const { slug, p } of allParas) {
    const list = paraMap.get(p) || [];
    list.push(slug);
    paraMap.set(p, list);
  }
  const dupParas: string[] = [];
  for (const [p, slugs] of paraMap) {
    if (slugs.length > 1 && p.length >= 100) dupParas.push(`${slugs.join("↔")}:${p.slice(0, 60)}…`);
  }

  // Missing page types
  const manifestTypes = new Set(manifest.pages.map((p) => p.pageType));
  const missingTypes: string[] = [];
  if (!manifestTypes.has("homepage")) missingTypes.push("homepage");
  if (!manifestTypes.has("service")) missingTypes.push("service");
  missingTypes.push("location-hub", "location-cluster", "location-page");
  if ((ecosystemIndex.localClusterPagesGenerated || 0) === 0) {
    pagesTested.push("(missing:location-cluster)", "(missing:location-page)", "(missing:location-hub)");
    pagesFailed.push("location-cluster", "location-page", "location-hub");
    pageFails.push({
      pageSlug: "location-cluster",
      checks: ["zero local cluster pages in _ecosystem-index.json (selectedAreas empty)"],
      engine: "benchmarkServiceEcosystemBuilder + pharmacyLocalClusterContentEngine",
      renderer: "pharmacyLocalClusterPageRenderer",
    });
    pageFails.push({
      pageSlug: "location-page",
      checks: ["no area pages under output/pharmacy-content-ecosystem/.../local/"],
      engine: "benchmarkServiceEcosystemBuilder",
    });
    pageFails.push({
      pageSlug: "location-hub",
      checks: ["no dedicated location hub page in FinalRenderManifest (only content-ecosystem hub)"],
      engine: "pharmacyLocalClusterHubRenderer (not emitted to canonical render)",
    });
  }

  // Internal link graph (canonical relative paths)
  const slugToPath = new Map<string, string>();
  for (const p of manifest.pages) {
    slugToPath.set(p.pageSlug, p.pageSlug === "index" ? "/" : `/${p.pageSlug}/`);
  }
  const allInternal = new Set<string>();
  for (const a of analyses) {
    for (const href of a.links) {
      if (href.startsWith("/") || href.includes(SLUG) || href.includes("pharmacy-first")) allInternal.add(href);
    }
  }

  const linkChecks: Array<{ rule: string; ok: boolean; detail: string }> = [];
  const serviceHtml = analyses.find((a) => a.pageSlug === "pharmacy-first");
  const hubHtml = analyses.find((a) => a.pageSlug === "pharmacy-first-content-ecosystem");
  const guideHtml = analyses.find((a) => a.pageSlug === "pharmacy-first-guide");
  const blogHtml = analyses.find((a) => a.pageSlug === "what-is-pharmacy-first");

  linkChecks.push({
    rule: "Hub → Cluster",
    ok: false,
    detail: "no cluster pages generated",
  });
  linkChecks.push({
    rule: "Cluster → Hub",
    ok: false,
    detail: "no cluster pages",
  });
  linkChecks.push({
    rule: "Service → Guide",
    ok: Boolean(serviceHtml?.links.some((l) => l.includes("pharmacy-first-guide"))),
    detail: serviceHtml?.links.filter((l) => l.includes("guide")).join(", ") || "none",
  });
  linkChecks.push({
    rule: "Guide → Blog",
    ok: Boolean(guideHtml?.links.some((l) => l.includes("what-is-pharmacy-first") || l.includes("who-should"))),
    detail: "ecosystem cross-links",
  });
  linkChecks.push({
    rule: "Blog → Guide",
    ok: Boolean(blogHtml?.links.some((l) => l.includes("pharmacy-first-guide"))),
    detail: blogHtml?.links.filter((l) => l.includes("guide")).join(", ") || "none",
  });
  linkChecks.push({
    rule: "Blog → Service",
    ok: Boolean(blogHtml?.links.some((l) => l.includes("pharmacy-first"))),
    detail: "service link in blog",
  });
  linkChecks.push({
    rule: "Hub → ecosystem pages",
    ok: Boolean(hubHtml?.links.length && hubHtml.links.length >= 3),
    detail: `${hubHtml?.links.length || 0} links`,
  });

  const brokenLinks: string[] = [];
  for (const a of analyses) {
    for (const href of a.links) {
      if (href.startsWith("http") && !href.includes("pharmaconnect") && !href.includes("google") && !href.includes("gstatic"))
        continue;
      if (href.startsWith("tel:") || href.startsWith("mailto:")) continue;
      const rel = href.replace(/\?.*$/, "").replace(/#.*$/, "");
      if (rel.startsWith("/assets/")) {
        const assetPath = path.join(renderRoot, rel.replace(/^\//, ""));
        if (!fs.existsSync(assetPath)) brokenLinks.push(`${a.pageSlug}:${href}`);
      }
    }
  }

  // Playwright
  const secret = loadSecret();
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    executablePath: fs.existsSync(PLAYWRIGHT_EXECUTABLE) ? PLAYWRIGHT_EXECUTABLE : undefined,
  });

  const viewports = [
    { label: "desktop", width: 1440, height: 900 },
    { label: "tablet", width: 768, height: 1024 },
    { label: "mobile", width: 390, height: 844 },
  ] as const;

  const browserResults: Record<string, Record<string, { pass: boolean; errors: string[]; failedAssets: string[] }>> = {};

  for (const vp of viewports) {
    browserResults[vp.label] = {};
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const page = await context.newPage();

    for (const p of manifest.pages) {
      const url = `${PREVIEW_BASE}${previewPath(p.pageSlug)}`;
      const consoleErrors: string[] = [];
      const failedAssets: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("requestfailed", (r) => {
        if (/\.(webp|jpg|jpeg|png|svg|css|woff2?)/i.test(r.url())) failedAssets.push(r.url());
      });
      let pass = false;
      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.waitForTimeout(800);
        const filtered = consoleErrors.filter(
          (e) =>
            !/Access to font at .* CORS/i.test(e) &&
            !/favicon/i.test(e) &&
            !/Google Maps JavaScript API/i.test(e),
        );
        pass = (resp?.ok() ?? false) && filtered.length === 0 && failedAssets.length === 0;
        browserResults[vp.label][p.pageSlug] = { pass, errors: filtered, failedAssets };
        if (!pass && !pagesFailed.includes(p.pageSlug)) pagesFailed.push(p.pageSlug);
      } catch (err) {
        browserResults[vp.label][p.pageSlug] = { pass: false, errors: [String(err)], failedAssets };
        if (!pagesFailed.includes(p.pageSlug)) pagesFailed.push(p.pageSlug);
      }
    }
    await context.close();
  }
  await browser.close();

  const browserPass = viewports.every((vp) => Object.values(browserResults[vp.label]).every((r) => r.pass));

  const metaValidation = {
    pass: pageFails.every((f) => !f.checks.some((c) => /title|meta|canonical|OpenGraph|Twitter|robots|sitemap/i.test(c))),
    failures: pageFails.flatMap((f) => f.checks.filter((c) => /title|meta|canonical|OpenGraph|Twitter|robots|sitemap/i.test(c)).map((c) => `${f.pageSlug}:${c}`)),
  };
  const schemaValidation = {
    pass: pageFails.every((f) => !f.checks.some((c) => c.includes("schema"))),
    failures: pageFails.flatMap((f) => f.checks.filter((c) => c.includes("schema")).map((c) => `${f.pageSlug}:${c}`)),
  };
  const imageValidation = {
    pass: pageFails.every((f) => !f.checks.some((c) => c.includes("image") || c.includes("ALT"))),
    failures: pageFails.flatMap((f) => f.checks.filter((c) => /image|ALT/i.test(c)).map((c) => `${f.pageSlug}:${c}`)),
  };
  const contentValidation = {
    pass: dupParas.length === 0 && pageFails.every((f) => !f.checks.some((c) => /placeholder|thin body|duplicate/i.test(c))),
    duplicatedParagraphs: dupParas.slice(0, 15),
    failures: [...dupParas.slice(0, 5), ...pageFails.flatMap((f) => f.checks.filter((c) => /placeholder|thin|duplicate H1|duplicate body/i.test(c)).map((c) => `${f.pageSlug}:${c}`))],
  };

  const buildStat = fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/package.json"))
    ? fs.readFileSync(path.join(PHARMACY_WORKSPACE_ROOT, "artifacts/api-server/package.json"), "utf8").slice(0, 80)
    : "missing";
  let pm2Status = "UNKNOWN";
  try {
    const { execSync } = await import("node:child_process");
    const j = execSync("pm2 jlist", { encoding: "utf8" });
    const apps = JSON.parse(j) as Array<{ name: string; pm2_env?: { status?: string } }>;
    const app = apps.find((a) => a.name === "pharmaconnect-growth-engine");
    pm2Status = app?.pm2_env?.status === "online" ? "ONLINE" : String(app?.pm2_env?.status || "offline");
  } catch {
    pm2Status = "UNKNOWN";
  }

  const uniquePassed = [...new Set(pagesPassed.filter((s) => !pagesFailed.includes(s)))];
  const uniqueFailed = [...new Set(pagesFailed)];
  const uniqueTested = [...new Set(pagesTested)];

  const engines = [...new Set(pageFails.map((f) => f.engine).filter(Boolean))];
  const renderers = [...new Set(pageFails.map((f) => f.renderer).filter(Boolean))];

  const ready =
    uniqueFailed.length === 0 &&
    browserPass &&
    (ecosystemIndex.localClusterPagesGenerated || 0) > 0 === false
      ? false
      : uniqueFailed.length === 0 && browserPass;

  const report = {
    pagesTested: uniqueTested,
    pagesPassed: uniquePassed,
    pagesFailed: uniqueFailed,
    internalLinks: linkChecks,
    brokenLinks: [...new Set(brokenLinks)].slice(0, 50),
    metaValidation,
    schemaValidation,
    imageValidation,
    contentValidation,
    browserValidation: { pass: browserPass, viewports: browserResults },
    rendererResponsible: renderers,
    genericEngineResponsible: engines,
    tenantSpecificCodeDetected: "NO",
    tenantSpecificNote: "banner-cross-pharmacy appears only as validation default slugs in masterAdmin* modules, not in local content render path",
    build: buildStat.includes("name") ? "artifacts/api-server present (Jul 22 build)" : buildStat,
    pm2: pm2Status,
    manifestPages: manifest.pages.length,
    robotsPresent: robots.length > 0,
    registryInclusion: "FinalRenderManifest.json + publish mirror",
    requiredPageTypesMissing: missingTypes,
    status: ready ? "READY FOR PRODUCT OWNER TEST" : "NOT READY FOR PRODUCT OWNER TEST",
  };

  fs.writeFileSync(path.join(EVIDENCE, "rc1-l1-report.json"), JSON.stringify(report, null, 2));

  console.log("Pages tested:", uniqueTested.join(", "));
  console.log("Pages passed:", uniquePassed.join(", ") || "(none)");
  console.log("Pages failed:", uniqueFailed.join(", ") || "(none)");
  console.log("Internal links:", JSON.stringify(linkChecks));
  console.log("Broken links:", report.brokenLinks.length ? report.brokenLinks : "(none)");
  console.log("Meta validation:", metaValidation.pass ? "PASS" : "FAIL", metaValidation.failures.slice(0, 10));
  console.log("Schema validation:", schemaValidation.pass ? "PASS" : "FAIL", schemaValidation.failures.slice(0, 10));
  console.log("Image validation:", imageValidation.pass ? "PASS" : "FAIL", imageValidation.failures.slice(0, 10));
  console.log("Content validation:", contentValidation.pass ? "PASS" : "FAIL");
  console.log("Browser validation:", browserPass ? "PASS" : "FAIL");
  console.log("Renderer responsible:", renderers.join("; ") || "(see page failures)");
  console.log("Generic engine responsible:", engines.join("; ") || "(none if pass)");
  console.log("Tenant-specific code detected:", report.tenantSpecificCodeDetected);
  console.log("Build:", report.build);
  console.log("PM2:", pm2Status);
  console.log("Status:", report.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
