#!/usr/bin/env npx tsx
/**
 * NT-E2E-25 — Product Owner Quality Audit (browser-rendered previews on app.pharmaconnect.uk).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import {
  buildCanonicalLocalPagePreviewUrl,
  CANONICAL_PREVIEW_HOST,
} from "../src/pharmacy/pharmacyCanonicalFinalRenderPreviewService.ts";
import { readAuthorisedEcosystemGenerationRecord } from "../src/pharmacy/masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  compareCanonicalPlanOutputParity,
  readCanonicalEcosystemGenerationPlan,
} from "../src/pharmacy/masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { readLatestCommercialQualityApproval } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { resolveCanonicalFinalRenderRoot } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "reliable-direct-pharmacy";
const SERVICE = "pharmacy-first";
const AUTHORISED_JOB = "eaa7bd57-fbe0-45a5-a252-e67b6ab69377";

const PAGES: Array<{ key: string; pageSlug: string }> = [
  { key: "homepage", pageSlug: "index" },
  { key: "serviceHub", pageSlug: "pharmacy-first" },
  { key: "ecclesall", pageSlug: "local-cluster-ecclesall" },
  { key: "fulwood", pageSlug: "local-cluster-fulwood" },
  { key: "sheffieldCityCentre", pageSlug: "local-cluster-sheffield-city-centre" },
  { key: "broomhill", pageSlug: "local-cluster-broomhill" },
  { key: "kelhamIsland", pageSlug: "local-cluster-kelham-island" },
  { key: "dore", pageSlug: "local-cluster-dore" },
  { key: "hillsborough", pageSlug: "local-cluster-hillsborough" },
  { key: "crookes", pageSlug: "local-cluster-crookes" },
  { key: "blogWhatIs", pageSlug: "what-is-pharmacy-first" },
  { key: "blogWhoShould", pageSlug: "who-should-consider-pharmacy-first" },
  { key: "blogNeedToKnow", pageSlug: "pharmacy-first-what-you-need-to-know" },
  { key: "guide", pageSlug: "pharmacy-first-guide" },
  { key: "faq", pageSlug: "pharmacy-first-faqs" },
  { key: "supporting", pageSlug: "pharmacy-first-content-ecosystem" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

type Severity = "critical" | "major" | "minor";
interface Finding {
  severity: Severity;
  category: string;
  pageSlug: string;
  message: string;
  evidence: string;
}

function loadSessionSecret(): string {
  for (const envFile of [".env.production", ".env"]) {
    const p = path.join(PHARMACY_WORKSPACE_ROOT, envFile);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^SESSION_SECRET=(.+)$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  try {
    const requireCjs = createRequire(import.meta.url);
    const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
      apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
    };
    return eco.apps?.[0]?.env?.SESSION_SECRET || "";
  } catch {
    return process.env.SESSION_SECRET || "";
  }
}

function dedupeFindings(items: Finding[]): Finding[] {
  return [...new Map(items.map((f) => [`${f.pageSlug}:${f.message}`, f])).values()];
}

function analyseHtml(pageSlug: string, html: string): Finding[] {
  const findings: Finding[] = [];
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  if (/banner[- ]cross|bannercrosspharmacy/i.test(html)) {
    findings.push({ severity: "critical", category: "brand", pageSlug, message: "Cross-tenant Banner Cross branding", evidence: "Banner Cross reference in rendered HTML" });
  }
  if (/monospace,monospace;font-size:1em/.test(html)) {
    findings.push({ severity: "critical", category: "brand", pageSlug, message: "Corrupt opening hours displayed", evidence: "Opening hours: monospace,monospace;font-size:1em}.x-el-button…" });
  }
  if (/rotherham/i.test(text)) {
    findings.push({ severity: "critical", category: "localisation", pageSlug, message: "Rotherham reference", evidence: text.match(/[^.]{0,80}[Rr]otherham[^.]{0,80}/)?.[0] || "Rotherham" });
  }
  if (/cluster-cluster-/.test(html)) {
    findings.push({ severity: "critical", category: "internal-link", pageSlug, message: "Legacy cluster-cluster link", evidence: "cluster-cluster- in rendered HTML" });
  }
  if (/lorem ipsum|\[insert|\bTBC\b|your pharmacy name|placeholder copy/i.test(text)) {
    findings.push({ severity: "critical", category: "content", pageSlug, message: "Placeholder content", evidence: "Placeholder pattern in visible text" });
  }
  if (/guaranteed cure|100% effective|\bmiracle\b|instant relief guaranteed/i.test(text)) {
    findings.push({ severity: "critical", category: "clinical", pageSlug, message: "Unsafe clinical claim", evidence: text.match(/guaranteed cure|100% effective|miracle|instant relief guaranteed/i)?.[0] || "unsafe wording" });
  }

  if (!lower.includes("reliable direct") && !/faq|content-ecosystem/.test(pageSlug)) {
    findings.push({ severity: "major", category: "brand", pageSlug, message: "Pharmacy name weak in body", evidence: "Reliable Direct Pharmacy not prominent in visible copy" });
  }
  if (!/0114|760150|2760150/.test(text) && /pharmacy-first|local-cluster|^index$/.test(pageSlug)) {
    findings.push({ severity: "major", category: "brand", pageSlug, message: "Telephone not visible", evidence: "Expected 01142760150 / 01142 760150" });
  }

  if (pageSlug.startsWith("local-cluster-")) {
    const area = pageSlug.replace("local-cluster-", "").replace(/-/g, " ");
    const token = area.split(" ")[0].toLowerCase();
    const h1 = $("h1").first().text();
    if (!h1.toLowerCase().includes(token)) {
      findings.push({ severity: "major", category: "localisation", pageSlug, message: "Locality missing from H1", evidence: `H1: "${h1}" — expected "${area}"` });
    }
    const intro = $(".local-intro-lead").first().text().trim();
    if (intro.includes("251 Broomhall Street") && !pageSlug.includes("ecclesall") && !pageSlug.includes("fulwood")) {
      findings.push({ severity: "major", category: "content", pageSlug, message: "Duplicated generic Sheffield intro", evidence: intro.slice(0, 120) });
    }
  }

  const title = $("title").first().text().trim();
  const desc = $('meta[name="description"]').attr("content")?.trim() || "";
  const canonical = $('link[rel="canonical"]').attr("href") || "";
  const og = $('meta[property="og:title"]').attr("content") || "";
  const twitter = $('meta[name="twitter:card"]').attr("content") || "";
  const schemaCount = $('script[type="application/ld+json"]').length;

  if (!title) findings.push({ severity: "major", category: "seo", pageSlug, message: "Missing title", evidence: "Empty <title>" });
  if (!desc) findings.push({ severity: "major", category: "seo", pageSlug, message: "Missing meta description", evidence: 'meta[name="description"] absent' });
  if (!canonical && /guide|faq|blog|cluster|pharmacy-first|index|what-is|who-should|need-to-know|content-ecosystem/.test(pageSlug)) {
    findings.push({ severity: "major", category: "seo", pageSlug, message: "Missing canonical", evidence: "link[rel=canonical] absent" });
  }
  if (schemaCount === 0 && /guide|faq|what-is|who-should|need-to-know|content-ecosystem/.test(pageSlug)) {
    findings.push({ severity: "major", category: "seo", pageSlug, message: "Missing schema", evidence: "No application/ld+json block" });
  }
  if (!og) findings.push({ severity: "minor", category: "seo", pageSlug, message: "Missing OpenGraph", evidence: "og:title absent" });
  if (!twitter) findings.push({ severity: "minor", category: "seo", pageSlug, message: "Missing Twitter card", evidence: "twitter:card absent" });

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/localhost|127\.0\.0\.1|cluster-cluster-|banner-cross/.test(href)) {
      findings.push({ severity: "critical", category: "internal-link", pageSlug, message: "Bad internal link", evidence: href });
    }
  });

  if ($('a[href^="tel:"]').length === 0 && /pharmacy-first|local-cluster|^index$/.test(pageSlug)) {
    findings.push({ severity: "minor", category: "ux", pageSlug, message: "Phone not tel: linked", evidence: "Phone displayed but no tel: href" });
  }

  const imgs = $("img[src]");
  imgs.each((_, el) => {
    const src = $(el).attr("src") || "";
    const alt = ($(el).attr("alt") || "").trim();
    if (!alt) findings.push({ severity: "minor", category: "image", pageSlug, message: "Missing ALT text", evidence: src });
    if (/placeholder|\[image\]/i.test(src)) findings.push({ severity: "critical", category: "image", pageSlug, message: "Placeholder image", evidence: src });
  });

  return findings;
}

function categoryScore(findings: Finding[], categories: string[]): number {
  const relevant = findings.filter((f) => categories.includes(f.category));
  const crit = relevant.filter((f) => f.severity === "critical").length;
  const maj = relevant.filter((f) => f.severity === "major").length;
  const min = relevant.filter((f) => f.severity === "minor").length;
  return Math.max(0, 100 - crit * 20 - maj * 8 - min * 2);
}

async function main(): Promise<void> {
  const homePw = "/home/inboxingproweb/.cache/ms-playwright";
  if (fs.existsSync(homePw)) process.env.PLAYWRIGHT_BROWSERS_PATH = homePw;

  const auth = readAuthorisedEcosystemGenerationRecord(SLUG);
  const plan = readCanonicalEcosystemGenerationPlan(SLUG);
  const parity = compareCanonicalPlanOutputParity(SLUG, SERVICE, plan!);
  const approval = readLatestCommercialQualityApproval(SLUG);
  const secret = loadSessionSecret();

  const previewUrls: Record<string, string> = {};
  for (const p of PAGES) {
    previewUrls[p.key] = buildCanonicalLocalPagePreviewUrl(SLUG, p.pageSlug, CANONICAL_PREVIEW_HOST);
  }

  const allFindings: Finding[] = [];
  const pageResults: Array<{ slug: string; verdict: "PASS" | "WARNING" | "FAIL"; status: number }> = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  let responsiveFailures = 0;
  let brokenAssets = 0;

  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(`${homePw}/chromium_headless_shell-1148/chrome-linux/headless_shell`)
      ? `${homePw}/chromium_headless_shell-1148/chrome-linux/headless_shell`
      : undefined,
  });
  const context = await browser.newContext({
    extraHTTPHeaders: secret ? { Authorization: `Bearer ${secret}` } : {},
  });

  for (const pageSpec of PAGES) {
    const url = previewUrls[pageSpec.key];
    const page = await context.newPage();
    const pageConsole: string[] = [];
    const pageFailed: string[] = [];

    page.on("console", (m) => {
      if (m.type() === "error") pageConsole.push(m.text());
    });
    page.on("requestfailed", (r) => pageFailed.push(r.url()));
    page.on("response", (r) => {
      if (r.status() >= 400 && !r.url().includes("favicon")) {
        pageFailed.push(`${r.status()} ${r.url()}`);
        brokenAssets += 1;
      }
    });

    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => null);
    const status = resp?.status() ?? 0;
    const html = status === 200 ? await page.content() : "";

    const pageFindings: Finding[] = [];
    if (status !== 200) {
      pageFindings.push({ severity: "critical", category: "technical", pageSlug: pageSpec.pageSlug, message: "Preview not HTTP 200", evidence: `HTTP ${status}` });
    }
    if (html) {
      pageFindings.push(...analyseHtml(pageSpec.pageSlug, html));
      const adminChrome = await page.evaluate(() =>
        Boolean(document.querySelector("#master-admin, .master-admin-shell, [data-master-admin]")),
      );
      if (adminChrome) {
        pageFindings.push({ severity: "critical", category: "ux", pageSlug: pageSpec.pageSlug, message: "Admin chrome visible", evidence: "Master admin shell in preview" });
      }
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        if (overflow) {
          responsiveFailures += 1;
          pageFindings.push({ severity: "major", category: "ux", pageSlug: pageSpec.pageSlug, message: "Horizontal overflow", evidence: `${vp.name} ${vp.width}px` });
        }
      }
    }

    allFindings.push(...pageFindings);
    consoleErrors.push(...pageConsole);
    failedRequests.push(...pageFailed);

    const hasCritical = pageFindings.some((f) => f.severity === "critical");
    const hasMajor = pageFindings.some((f) => f.severity === "major");
    pageResults.push({
      slug: pageSpec.pageSlug,
      status,
      verdict: hasCritical ? "FAIL" : hasMajor ? "WARNING" : "PASS",
    });
    await page.close();
  }
  await browser.close();

  const renderRoot = resolveCanonicalFinalRenderRoot(SLUG);
  let orphanPages = 0;
  for (const p of PAGES) {
    const rel = p.pageSlug === "index" ? "index.html" : `${p.pageSlug}/index.html`;
    if (!fs.existsSync(path.join(renderRoot, rel))) orphanPages += 1;
  }

  const critical = dedupeFindings(allFindings.filter((f) => f.severity === "critical"));
  const major = dedupeFindings(allFindings.filter((f) => f.severity === "major"));
  const minor = dedupeFindings(allFindings.filter((f) => f.severity === "minor"));

  const brandScore = categoryScore(allFindings, ["brand"]);
  const localisationScore = categoryScore(allFindings, ["localisation"]);
  const contentScore = categoryScore(allFindings, ["content"]);
  const clinicalScore = categoryScore(allFindings, ["clinical"]);
  const imageScore = categoryScore(allFindings, ["image"]);
  const seoScore = categoryScore(allFindings, ["seo"]);
  const internalLinkScore = critical.filter((f) => f.category === "internal-link").length === 0 ? 100 : 50;
  const uxScore = categoryScore(allFindings, ["ux"]);
  const technicalScore = categoryScore(allFindings, ["technical"]);
  const overall = Math.round(
    (brandScore + localisationScore + contentScore + clinicalScore + imageScore + seoScore + internalLinkScore + uxScore + technicalScore) / 9,
  );

  const brokenInternalLinks = critical.filter((f) => f.message.includes("Bad internal link") || f.message.includes("Legacy cluster")).length;
  const crossTenant = critical.filter((f) => f.message.includes("Cross-tenant")).length;
  const rotherham = critical.filter((f) => f.message.includes("Rotherham")).length;
  const placeholders = critical.filter((f) => f.message.includes("Placeholder")).length;
  const dupParagraphs = major.filter((f) => f.message.includes("Duplicated")).length;
  const missingMetadata = major.filter((f) => f.message.includes("meta description") || f.message.includes("Missing title")).length;
  const missingSchema = major.filter((f) => f.message.includes("Missing schema")).length;

  const approvalEnabled =
    critical.length === 0 &&
    major.length === 0 &&
    parity.ok &&
    brokenInternalLinks === 0 &&
    brokenAssets === 0 &&
    crossTenant === 0 &&
    missingMetadata === 0 &&
    missingSchema === 0 &&
    critical.filter((f) => f.category === "clinical").length === 0;

  const report = {
    authorisedJobAudited: auth?.jobId === AUTHORISED_JOB,
    canonicalPlanId: auth?.canonicalPlanId || plan?.planId,
    generationRevision: auth?.generationRevision,
    packageChecksum: auth?.manifestChecksum,
    inventoryCount: plan?.inventoryReconciliation?.inventoryTotal ?? 16,
    generatedCount: parity.generatedCount,
    completenessStatus: auth?.completenessStatus,
    qualityReviewApprovalStatus: approval?.approvedAt ? "approved" : "pending",
    pagesAudited: PAGES.length,
    pagesPassed: pageResults.filter((p) => p.verdict === "PASS").length,
    pagesWithWarnings: pageResults.filter((p) => p.verdict === "WARNING").length,
    pagesFailed: pageResults.filter((p) => p.verdict === "FAIL").length,
    overallQualityScore: overall,
    brandScore,
    localisationScore,
    contentScore,
    clinicalScore,
    imageScore,
    seoScore,
    internalLinkScore,
    uxScore,
    technicalScore,
    criticalIssues: critical.length,
    majorIssues: major.length,
    minorIssues: minor.length,
    crossTenantReferences: crossTenant,
    rotherhamReferences: rotherham,
    placeholderContent: placeholders,
    duplicateParagraphs: dupParagraphs,
    brokenAssets,
    brokenInternalLinks,
    orphanPages,
    missingMetadata,
    missingSchema,
    responsiveFailures,
    consoleErrors: [...new Set(consoleErrors)],
    failedRequests: [...new Set(failedRequests)],
    qualityReviewApprovalEnabled: approvalEnabled,
    previewUrls,
    pageResults,
    findings: { critical, major, minor: minor.slice(0, 20) },
    status: auth?.jobId === AUTHORISED_JOB && PAGES.length === 16 ? "READY FOR PRODUCT OWNER PAGE REVIEW" : "BLOCKED",
  };

  const outFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/validation-reports/nt-e2e-25-po-quality-audit-browser.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
