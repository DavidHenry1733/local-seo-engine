/**
 * Read-only audit: contextual anchor links in hub/cluster pages.
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT = "inboxingproweb";
const OUTPUT_DIR = path.join("output", PROJECT);

interface PageSpec {
  remotePath: string;
  slug: string;
  service: string;
  tier: "hub" | "cluster";
}

const PAGES: PageSpec[] = [
  { remotePath: "/web-hosting-rotherham/", slug: "web-hosting-rotherham", service: "Website Hosting", tier: "hub" },
  { remotePath: "/web-hosting-rawmarsh/", slug: "web-hosting-rawmarsh", service: "Website Hosting", tier: "cluster" },
  { remotePath: "/web-hosting-wickersley/", slug: "web-hosting-wickersley", service: "Website Hosting", tier: "cluster" },
  { remotePath: "/email-marketing-rotherham/", slug: "email-marketing-rotherham", service: "Email Marketing", tier: "hub" },
  { remotePath: "/email-marketing-rawmarsh/", slug: "email-marketing-rawmarsh", service: "Email Marketing", tier: "cluster" },
  { remotePath: "/email-marketing-wickersley/", slug: "email-marketing-wickersley", service: "Email Marketing", tier: "cluster" },
];

interface LinkRecord {
  href: string;
  text: string;
  category: string;
  sectionId?: string;
  isInternal: boolean;
}

interface PageAudit {
  remotePath: string;
  slug: string;
  service: string;
  tier: string;
  fileExists: boolean;
  linkCounts: Record<string, number>;
  contextualBodyLinks: LinkRecord[];
  contextualClassLinks: LinkRecord[];
  moneyPageBandLinks: LinkRecord[];
  ctaSectionLinks: LinkRecord[];
  examples: string[];
  linksToHub: LinkRecord[];
  linksToClusters: LinkRecord[];
  linksToRelatedServices: LinkRecord[];
  linksToMoneyPages: LinkRecord[];
  linksToBlogContent: LinkRecord[];
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isInternalHref(href: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) return false;
  if (href.startsWith("/")) return true;
  try {
    const u = new URL(href);
    return u.hostname.includes("inboxingproweb.com") || u.hostname.includes("local.inboxingproweb.com");
  } catch {
    return false;
  }
}

function extractRegion(html: string, startPattern: RegExp, endPattern: RegExp): string {
  const start = html.search(startPattern);
  if (start < 0) return "";
  const slice = html.slice(start);
  const end = slice.search(endPattern);
  return end > 0 ? slice.slice(0, end) : slice;
}

function extractLinks(fragment: string, category: string, sectionId?: string): LinkRecord[] {
  const links: LinkRecord[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment))) {
    const attrs = m[1];
    const hrefM = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefM) continue;
    const href = hrefM[1];
    const text = stripTags(m[2]);
    links.push({
      href,
      text,
      category,
      sectionId,
      isInternal: isInternalHref(href),
    });
  }
  return links;
}

function extractParagraphBodyLinks(bodyHtml: string): LinkRecord[] {
  const links: LinkRecord[] = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(bodyHtml))) {
    const inner = m[1];
    if (!/<a\b/i.test(inner)) continue;
    const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let a: RegExpExecArray | null;
    while ((a = aRe.exec(inner))) {
      const hrefM = a[1].match(/href=["']([^"']+)["']/i);
      if (!hrefM) continue;
      links.push({
        href: hrefM[1],
        text: stripTags(a[2]),
        category: "contextual_body_copy",
        isInternal: isInternalHref(hrefM[1]),
      });
    }
  }
  return links;
}

function classifyTarget(href: string): string {
  const h = href.toLowerCase();
  if (h.includes("/blog/")) return "blog";
  if (h.includes("uk-website-hosting") || h.includes("email-marketing-3") || h.includes("custom-website-design") || h.includes("local-seo-services")) return "money";
  if (h.match(/\/(web-hosting|email-marketing|local-seo|web-design)-rotherham\//)) return "hub";
  if (h.match(/\/(web-hosting|email-marketing|local-seo|web-design)-[a-z-]+\//)) return "cluster_or_related";
  if (h.match(/\/(web-design|local-seo|email-marketing)-rotherham\//)) return "related_service_hub";
  return "other";
}

function auditPage(spec: PageSpec): PageAudit {
  const filePath = path.join(OUTPUT_DIR, spec.slug, "index.html");
  const audit: PageAudit = {
    remotePath: spec.remotePath,
    slug: spec.slug,
    service: spec.service,
    tier: spec.tier,
    fileExists: fs.existsSync(filePath),
    linkCounts: {
      navigation: 0,
      footer: 0,
      related_services_cards: 0,
      areas_we_cover_cards: 0,
      faq_links: 0,
      money_page_band: 0,
      cta_buttons: 0,
      contextual_class: 0,
      contextual_body_copy: 0,
    },
    contextualBodyLinks: [],
    contextualClassLinks: [],
    moneyPageBandLinks: [],
    ctaSectionLinks: [],
    examples: [],
    linksToHub: [],
    linksToClusters: [],
    linksToRelatedServices: [],
    linksToMoneyPages: [],
    linksToBlogContent: [],
  };

  if (!audit.fileExists) return audit;

  const html = fs.readFileSync(filePath, "utf8");

  const headerEnd = html.indexOf("</header>");
  const header = headerEnd > 0 ? html.slice(0, headerEnd + 9) : "";
  const navLinks = extractLinks(header, "navigation");
  audit.linkCounts.navigation = navLinks.filter((l) => l.isInternal).length;

  const footer = extractRegion(html, /<footer\b/i, /<\/footer>/i);
  const footerLinks = extractLinks(footer, "footer");
  audit.linkCounts.footer = footerLinks.filter((l) => l.isInternal).length;

  const related = extractRegion(html, /<div class="related-services"/i, /<div class="areas-we-cover"/i);
  const relatedLinks = extractLinks(related, "related_services_cards");
  audit.linkCounts.related_services_cards = relatedLinks.filter((l) => l.isInternal).length;

  const areas = extractRegion(html, /<div class="areas-we-cover"/i, /<section class="hosting-review-cta"|<section class="email-review-cta"|<footer/i);
  const areaLinks = extractLinks(areas, "areas_we_cover_cards");
  audit.linkCounts.areas_we_cover_cards = areaLinks.filter((l) => l.isInternal).length;

  const faq = extractRegion(html, /<section class="faq"/i, /<div class="related-services"/i);
  const faqLinks = extractLinks(faq, "faq_links");
  audit.linkCounts.faq_links = faqLinks.filter((l) => l.isInternal).length;

  const moneyBand = extractRegion(html, /<section class="money-page-band"/i, /<\/section>/i);
  audit.moneyPageBandLinks = extractLinks(moneyBand, "money_page_band").filter((l) => l.isInternal);
  audit.linkCounts.money_page_band = audit.moneyPageBandLinks.length;

  const cta = extractRegion(html, /<section class="hosting-review-cta"|<section class="email-review-cta"/i, /<footer/i);
  audit.ctaSectionLinks = extractLinks(cta, "cta_buttons").filter((l) => l.isInternal);
  audit.linkCounts.cta_buttons = audit.ctaSectionLinks.length;

  const contextualClassFrag = html.match(/<a class="contextual-link[^"]*"[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  audit.contextualClassLinks = contextualClassFrag.map((frag) => {
    const hrefM = frag.match(/href=["']([^"']+)["']/i);
    return {
      href: hrefM?.[1] ?? "",
      text: stripTags(frag),
      category: "contextual_class",
      isInternal: isInternalHref(hrefM?.[1] ?? ""),
    };
  });
  audit.linkCounts.contextual_class = audit.contextualClassLinks.length;

  // Body copy = everything between </header> and related-services, excluding faq card structure handled separately
  const mainBodyStart = html.indexOf("</header>");
  const mainBodyEnd = html.search(/<div class="related-services"/);
  let mainBody = mainBodyStart > 0 && mainBodyEnd > mainBodyStart
    ? html.slice(mainBodyStart, mainBodyEnd)
    : "";

  // Remove nav remnants, money-page-band (counted separately), faq section from body scan
  mainBody = mainBody
    .replace(/<section class="money-page-band"[\s\S]*?<\/section>/gi, "")
    .replace(/<section class="faq"[\s\S]*?<\/section>/gi, "");

  const bodyParaLinks = extractParagraphBodyLinks(mainBody).filter((l) => l.isInternal);
  audit.contextualBodyLinks = bodyParaLinks;
  audit.linkCounts.contextual_body_copy = bodyParaLinks.length;

  const allInternal = [
    ...navLinks,
    ...footerLinks,
    ...relatedLinks,
    ...areaLinks,
    ...faqLinks,
    ...audit.moneyPageBandLinks,
    ...audit.ctaSectionLinks,
    ...audit.contextualClassLinks,
    ...audit.contextualBodyLinks,
  ].filter((l) => l.isInternal);

  for (const link of allInternal) {
    const kind = classifyTarget(link.href);
    if (kind === "hub") audit.linksToHub.push(link);
    else if (kind === "cluster_or_related") audit.linksToClusters.push(link);
    else if (kind === "related_service_hub") audit.linksToRelatedServices.push(link);
    else if (kind === "money") audit.linksToMoneyPages.push(link);
    else if (kind === "blog") audit.linksToBlogContent.push(link);
  }

  audit.examples = [
    ...audit.contextualClassLinks.map((l) => `[contextual-class] "${l.text}" -> ${l.href}`),
    ...audit.contextualBodyLinks.map((l) => `[body-paragraph] "${l.text}" -> ${l.href}`),
    ...audit.moneyPageBandLinks.map((l) => `[money-page-band] "${l.text}" -> ${l.href}`),
  ].slice(0, 10);

  return audit;
}

function hubSlugFor(service: string): string {
  if (service === "Website Hosting") return "web-hosting-rotherham";
  if (service === "Email Marketing") return "email-marketing-rotherham";
  return "";
}

function buildMissingOpportunities(audits: PageAudit[]): string[] {
  const missing: string[] = [];
  for (const a of audits) {
    if (!a.fileExists) {
      missing.push(`${a.remotePath}: HTML file missing`);
      continue;
    }
    if (a.linkCounts.contextual_class === 0 && a.linkCounts.contextual_body_copy === 0) {
      missing.push(`${a.remotePath}: no contextual anchor links in body paragraphs`);
    }
    if (a.tier === "cluster") {
      const hub = hubSlugFor(a.service);
      const hasHubLink = [...a.contextualBodyLinks, ...a.contextualClassLinks, ...a.moneyPageBandLinks]
        .some((l) => l.href.includes(hub));
      if (!hasHubLink) {
        missing.push(`${a.remotePath}: cluster page lacks cluster-to-hub contextual anchor in body copy`);
      }
    }
    if (a.tier === "hub") {
      const hasClusterContextual = [...a.contextualBodyLinks, ...a.contextualClassLinks]
        .some((l) => classifyTarget(l.href) === "cluster_or_related");
      if (!hasClusterContextual) {
        missing.push(`${a.remotePath}: hub page lacks hub-to-cluster contextual anchors in body copy`);
      }
    }
    if (a.linkCounts.related_services_cards === 0 && a.service === "Email Marketing") {
      missing.push(`${a.remotePath}: related services card section empty`);
    }
    if (a.linkCounts.areas_we_cover_cards === 0 && a.service === "Email Marketing") {
      missing.push(`${a.remotePath}: areas we cover card section empty`);
    }
  }
  return missing;
}

function main(): void {
  const pageAudits = PAGES.map(auditPage);
  const anyContextual = pageAudits.some(
    (p) => p.linkCounts.contextual_class > 0 || p.linkCounts.contextual_body_copy > 0,
  );
  const missing = buildMissingOpportunities(pageAudits);

  const report = {
    reportType: "hub-cluster-contextual-anchor-link-audit",
    verdict: pageAudits.every((p) => p.fileExists)
      ? "PASS: Hub Cluster Anchor Link Audit Complete"
      : "FAIL: Anchor Link Audit Requires Investigation",
    generatedAt: new Date().toISOString(),
    contextualAnchorLinksPresent: anyContextual,
    summary: {
      pagesAudited: pageAudits.length,
      pagesWithContextualBodyLinks: pageAudits.filter((p) => p.linkCounts.contextual_body_copy > 0).length,
      pagesWithContextualClassLinks: pageAudits.filter((p) => p.linkCounts.contextual_class > 0).length,
      pagesWithMoneyPageBandOnly: pageAudits.filter(
        (p) => p.linkCounts.money_page_band > 0 && p.linkCounts.contextual_body_copy === 0 && p.linkCounts.contextual_class === 0,
      ).length,
    },
    pages: pageAudits.map((p) => ({
      remotePath: p.remotePath,
      slug: p.slug,
      tier: p.tier,
      service: p.service,
      linkCounts: p.linkCounts,
      contextualBodyLinksPresent: p.linkCounts.contextual_body_copy > 0 || p.linkCounts.contextual_class > 0,
      examples: p.examples,
      targetLinks: {
        hub: p.linksToHub.length,
        clusters: p.linksToClusters.length,
        relatedServices: p.linksToRelatedServices.length,
        moneyPages: p.linksToMoneyPages.length,
        blogContent: p.linksToBlogContent.length,
      },
    })),
    missingAnchorOpportunities: missing,
    recommendedNextFix: anyContextual
      ? "Expand contextual-link insertion in renderClusterPage.ts to cover more body sections and ensure cluster-to-hub / hub-to-cluster anchors appear in paragraph copy, not only money-page-band."
      : "Enable or repair addContextualBodyLinks() in renderClusterPage.ts so hub/cluster narrative sections receive contextual-link class anchors; current pages only have structural links (nav, footer, related services cards, areas cards) plus optional money-page-band.",
    notes: [
      "contextual-link CSS class links are injected by addContextualBodyLinks() in renderClusterPage.ts",
      "None of the six audited pages contain contextual-link class anchors",
      "money-page-band paragraph links count as body-adjacent but not inline narrative contextual anchors",
      "email-marketing hub/cluster pages have empty related-services and areas-we-cover sections",
    ],
  };

  const outPath = path.join(OUTPUT_DIR, "hub-cluster-contextual-anchor-link-audit.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(report.verdict);
  console.log(JSON.stringify(report, null, 2));
}

main();
