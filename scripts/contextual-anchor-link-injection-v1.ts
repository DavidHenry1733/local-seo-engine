/**
 * Contextual Anchor Link Injection V1 — apply + validate hub/cluster body links.
 */
import fs from "node:fs";
import path from "node:path";
import {
  applyContextualBodyLinks,
  type ClusterRenderConfig,
  type RenderProjectConfig,
} from "../src/generator/renderClusterPage.js";

const PROJECT = "inboxingproweb";
const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "output", PROJECT);
const CONFIG_PATH = path.join(ROOT, "config", "projects", `${PROJECT}.json`);

interface PageSpec {
  slug: string;
  remotePath: string;
  service: string;
  tier: "hub" | "cluster";
  location: string;
}

const PAGES: PageSpec[] = [
  { slug: "web-hosting-rotherham", remotePath: "/web-hosting-rotherham/", service: "Web Hosting", tier: "hub", location: "Rotherham" },
  { slug: "web-hosting-rawmarsh", remotePath: "/web-hosting-rawmarsh/", service: "Web Hosting", tier: "cluster", location: "Rawmarsh" },
  { slug: "web-hosting-wickersley", remotePath: "/web-hosting-wickersley/", service: "Web Hosting", tier: "cluster", location: "Wickersley" },
  { slug: "email-marketing-rotherham", remotePath: "/email-marketing-rotherham/", service: "Email Marketing", tier: "hub", location: "Rotherham" },
  { slug: "email-marketing-rawmarsh", remotePath: "/email-marketing-rawmarsh/", service: "Email Marketing", tier: "cluster", location: "Rawmarsh" },
  { slug: "email-marketing-wickersley", remotePath: "/email-marketing-wickersley/", service: "Email Marketing", tier: "cluster", location: "Wickersley" },
];

const ROTHERHAM_AREAS = [
  "Aston", "Bramley", "Dinnington", "Kiveton Park", "Maltby", "Parkgate",
  "Rawmarsh", "Swallownest", "Thurcroft", "Wickersley",
];

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isInternalHref(href: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) return false;
  if (href.startsWith("/")) return true;
  try {
    const u = new URL(href);
    return u.hostname.includes("inboxingproweb.com");
  } catch {
    return false;
  }
}

function stripExistingContextualLinks(html: string): string {
  return html
    .replace(/\s*For the wider town overview, see <a class="contextual-link[^>]*>[\s\S]*?<\/a>\./gi, "")
    .replace(/\s*Nearby areas such as <a class="contextual-link[^>]*>[\s\S]*?<\/a> share the same priorities\./gi, "")
    .replace(/\s*Nearby areas such as\s+share the same priorities\./gi, "")
    .replace(/\s*Many businesses also explore <a class="contextual-link[^>]*>[\s\S]*?<\/a> alongside this work\./gi, "")
    .replace(/\s*You can review <a class="contextual-link[^>]*>[\s\S]*?<\/a> for full commercial detail\./gi, "")
    .replace(/\s*For the broader service overview, see <a class="contextual-link[^>]*>[\s\S]*?<\/a>\./gi, "")
    .replace(/\s*You may also find <a class="contextual-link[^>]*>[\s\S]*?<\/a> useful for the same local market\./gi, "")
    .replace(/\.{2,}/g, ".");
}

function serviceSlug(service: string): string {
  const s = service.toLowerCase();
  if (s.includes("hosting")) return "web-hosting";
  if (s.includes("email")) return "email-marketing";
  if (s.includes("seo")) return "local-seo";
  if (s.includes("design")) return "web-design";
  return s.replace(/\s+/g, "-");
}

function synthesizeClusterAreaLinks(
  project: RenderProjectConfig,
  spec: PageSpec,
): { href: string; label: string }[] {
  const svcKey = spec.service.toLowerCase().includes("hosting") ? "website_hosting" : "email_marketing";
  return (project.internalLinks?.links ?? [])
    .filter((link) => {
      const linkSvc = (link.service ?? "").toLowerCase();
      return link.tier === "area" &&
        (linkSvc === svcKey || linkSvc.replace("web_hosting", "website_hosting") === svcKey) &&
        ROTHERHAM_AREAS.some((a) => (link.location ?? "").toLowerCase() === a.toLowerCase());
    })
    .map((link) => ({
      href: link.href.startsWith("http") ? link.href : link.href,
      label: `${spec.service} ${link.location ?? ""}`.trim(),
    }));
}

function buildRenderInputs(
  rawProject: Record<string, unknown>,
  spec: PageSpec,
): { project: RenderProjectConfig; cluster: ClusterRenderConfig } {
  const project: RenderProjectConfig = {
    clientSlug: PROJECT,
    businessName: String(rawProject.businessName ?? "InboxingProWeb"),
    domain: String(rawProject.domain ?? "https://local.inboxingproweb.com"),
    phone: String(rawProject.phone ?? ""),
    email: String(rawProject.email ?? ""),
    primaryCtaText: String(rawProject.primaryCtaText ?? "Get in touch"),
    primaryCtaUrl: String(rawProject.primaryCtaUrl ?? "/contact/"),
    businessAddress: String(rawProject.businessAddress ?? ""),
    isHub: spec.tier === "hub",
    internalLinks: rawProject.internalLinks as RenderProjectConfig["internalLinks"],
    serviceMoneyPages: rawProject.serviceMoneyPages as Record<string, string>,
  };

  if (spec.tier === "hub") {
    project.clusterAreaLinks = synthesizeClusterAreaLinks(project, spec);
  }

  const hubSlug = `${serviceSlug(spec.service)}-rotherham`;
  const cluster: ClusterRenderConfig = {
    service: spec.service,
    location: spec.location,
    primaryKeyword: `${spec.service} ${spec.location}`,
    supportingKeywords: [],
    hubUrl: `/${hubSlug}/`,
    hubAnchor: `${spec.service} Rotherham`,
    remotePath: spec.remotePath,
    imageGroup: `assets/${serviceSlug(spec.service)}`,
    serviceKey: serviceSlug(spec.service),
  };

  return { project, cluster };
}

function extractParagraphBodyLinks(mainBody: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(mainBody))) {
    const inner = m[1];
    if (!/<a\b/i.test(inner)) continue;
    const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let a: RegExpExecArray | null;
    while ((a = aRe.exec(inner))) {
      const hrefM = a[1].match(/href=["']([^"']+)["']/i);
      if (!hrefM) continue;
      links.push({ href: hrefM[1], text: stripTags(a[2]) });
    }
  }
  return links;
}

function classifyLink(href: string): "hub" | "cluster" | "related-service" | "money-page" | "other" {
  const h = href.toLowerCase();
  if (h.includes("uk-website-hosting") || h.includes("email-sms-marketing") ||
      h.includes("local-seo-services") || h.includes("our-services") ||
      h.includes("custom-website-design") || h.includes("email-marketing-3")) {
    return "money-page";
  }
  if (/\/(web-hosting|email-marketing|local-seo|web-design)-rotherham\/?/.test(h)) return "hub";
  if (/\/(web-hosting|email-marketing|local-seo|web-design)-[a-z-]+\/?/.test(h)) {
    if (h.includes("-rotherham")) return "hub";
    return "cluster";
  }
  return "other";
}

function auditPage(html: string, spec: PageSpec) {
  const headerEnd = html.indexOf("</header>");
  const mainBodyEnd = html.search(/<div class="related-services"|<section class="hosting-review-cta"|<section class="email-review-cta"/);
  let mainBody = headerEnd > 0 && mainBodyEnd > headerEnd ? html.slice(headerEnd, mainBodyEnd) : "";
  mainBody = mainBody
    .replace(/<section class="money-page-band"[\s\S]*?<\/section>/gi, "")
    .replace(/<section class="faq"[\s\S]*?<\/section>/gi, "");

  const bodyLinks = extractParagraphBodyLinks(mainBody).filter((l) => isInternalHref(l.href));
  const contextualClass = (html.match(/class="contextual-link/g) ?? []).length;

  const hubLinks = bodyLinks.filter((l) => classifyLink(l.href) === "hub");
  const clusterLinks = bodyLinks.filter((l) => classifyLink(l.href) === "cluster");
  const relatedServiceLinks = bodyLinks.filter((l) => {
    const k = classifyLink(l.href);
    return k === "hub" && !l.href.toLowerCase().includes(serviceSlug(spec.service));
  }).concat(bodyLinks.filter((l) => {
    const h = l.href.toLowerCase();
    return h.includes("local-seo-rotherham") || h.includes("web-design-rotherham") ||
      (spec.service.includes("Hosting") && h.includes("email-marketing-rotherham")) ||
      (spec.service.includes("Email") && h.includes("web-hosting-rotherham"));
  }));
  const moneyPageLinks = bodyLinks.filter((l) => classifyLink(l.href) === "money-page");

  const anchorTexts = bodyLinks.map((l) => l.text.trim().toLowerCase());
  const duplicateAnchors = anchorTexts.filter((t, i) => anchorTexts.indexOf(t) !== i);
  const urls = bodyLinks.map((l) => l.href.replace(/\/+$/, "").toLowerCase());
  const duplicateUrls = urls.filter((u, i) => urls.indexOf(u) !== i);

  return {
    slug: spec.slug,
    remotePath: spec.remotePath,
    tier: spec.tier,
    service: spec.service,
    contextualBodyLinkCount: bodyLinks.length,
    contextualClassLinkCount: contextualClass,
    hubLinks: hubLinks.length,
    clusterLinks: clusterLinks.length,
    relatedServiceLinks: relatedServiceLinks.length,
    moneyPageLinks: moneyPageLinks.length,
    duplicateAnchors: [...new Set(duplicateAnchors)],
    duplicateUrls: [...new Set(duplicateUrls)],
    examples: bodyLinks.slice(0, 8).map((l) => `"${l.text}" -> ${l.href}`),
    pass: bodyLinks.length > 0 && duplicateAnchors.length === 0,
  };
}

function main(): void {
  const rawProject = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>;
  const applied: string[] = [];

  for (const spec of PAGES) {
    const htmlPath = path.join(OUTPUT_DIR, spec.slug, "index.html");
    if (!fs.existsSync(htmlPath)) continue;

    const { project, cluster } = buildRenderInputs(rawProject, spec);
    let html = fs.readFileSync(htmlPath, "utf8");
    html = stripExistingContextualLinks(html);
    html = applyContextualBodyLinks(html, project, cluster);
    fs.writeFileSync(htmlPath, html, "utf8");
    applied.push(spec.slug);
  }

  const pageResults = PAGES.map((spec) => {
    const htmlPath = path.join(OUTPUT_DIR, spec.slug, "index.html");
    if (!fs.existsSync(htmlPath)) {
      return {
        slug: spec.slug,
        remotePath: spec.remotePath,
        tier: spec.tier,
        fileExists: false,
        pass: false,
      };
    }
    const html = fs.readFileSync(htmlPath, "utf8");
    return { fileExists: true, ...auditPage(html, spec) };
  });

  const allExist = pageResults.every((p) => p.fileExists !== false);
  const allHaveLinks = pageResults.every((p) => "contextualBodyLinkCount" in p && (p.contextualBodyLinkCount ?? 0) > 0);
  const noDuplicateAnchors = pageResults.every((p) => "duplicateAnchors" in p && (p.duplicateAnchors?.length ?? 0) === 0);
  const clusterHubCoverage = pageResults
    .filter((p) => p.tier === "cluster")
    .every((p) => "hubLinks" in p && (p.hubLinks ?? 0) > 0);
  const hubClusterCoverage = pageResults
    .filter((p) => p.tier === "hub")
    .every((p) => "clusterLinks" in p && (p.clusterLinks ?? 0) > 0);

  const pass = allExist && allHaveLinks && noDuplicateAnchors && clusterHubCoverage && hubClusterCoverage;

  const report = {
    reportType: "contextual-anchor-link-injection-v1",
    verdict: pass
      ? "PASS: Contextual Anchor Link Injection V1 Complete"
      : "FAIL: Contextual Anchor Link Injection Requires Investigation",
    generatedAt: new Date().toISOString(),
    pagesProcessed: applied,
    summary: {
      pagesAudited: PAGES.length,
      pagesWithContextualBodyLinks: pageResults.filter((p) => (p as { contextualBodyLinkCount?: number }).contextualBodyLinkCount! > 0).length,
      totalContextualBodyLinks: pageResults.reduce((n, p) => n + ((p as { contextualBodyLinkCount?: number }).contextualBodyLinkCount ?? 0), 0),
      clusterHubLinksPresent: clusterHubCoverage,
      hubClusterLinksPresent: hubClusterCoverage,
      duplicateAnchorsFound: pageResults.some((p) => ((p as { duplicateAnchors?: string[] }).duplicateAnchors?.length ?? 0) > 0),
      duplicateUrlsFound: pageResults.some((p) => ((p as { duplicateUrls?: string[] }).duplicateUrls?.length ?? 0) > 0),
    },
    pages: pageResults,
    injectionRules: {
      maxLinksPerSection: 3,
      maxLinksPerPage: 10,
      hostingSections: ["hosting-features", "hosting-problems", "hosting-security", "hosting-comparison", "hosting-migration"],
      emailSections: ["email-why-works", "email-retention", "email-automation", "email-deliverability", "email-reporting"],
    },
  };

  const outPath = path.join(OUTPUT_DIR, "contextual-anchor-link-injection-v1-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(report.verdict);
  console.log(`Report: ${outPath}`);
}

main();
